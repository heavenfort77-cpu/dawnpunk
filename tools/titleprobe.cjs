// Title probe (owner Nov 22 16:22: "why is the title still so laggy, trace it"): the same page as perfcheck's flow (first visit, cards=1, seed 777, 1280x720),
// title timed TSECS s from the title being ready. Per frame: the gap between frames. Logged by the game (probe branch only, window.__fl): every per-frame job
// over 6 ms (name, ms, title-base phase). A browser trace (main thread, GPU process, V8 GC) and a CPU profile over the same seconds; for each frame over
// LONG ms: what the main thread ran in it (top functions by self time), the trace events over 15 ms inside it, and the game's own lines in it.
// Usage: node tools/titleprobe.cjs [dist] [quality]. Prints lines only; exit 0.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const D = process.argv[2] || path.join(__dirname, '..', 'dist'), QUAL = process.argv[3] || 'medium', TSECS = +(process.env.TSECS || 10), LONG = +(process.env.LONG || 40);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mp4': 'video/mp4', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const f = path.join(D, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
const INIT = ({ seed }) => { let s = seed; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; try { localStorage.clear(); } catch (e) { /* none */ } };
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  for (let run = 1; run <= +(process.env.RUNS || 2); run++) {
    const cx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); await cx.addInitScript(INIT, { seed: 777 }); const p = await cx.newPage(); p.setDefaultTimeout(900000);
    const cdp = await cx.newCDPSession(p);
    await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?quality=' + QUAL + '&seed=777&cards=1');
    await p.waitForFunction(() => window.__splash && window.__splash.phase === 'ready', null, { timeout: 900000 });
    await b.startTracing(p, { categories: ['toplevel', 'v8', 'disabled-by-default-v8.gc', 'devtools.timeline', 'blink.user_timing', 'gpu', 'disabled-by-default-gpu.service', 'gpu.angle', 'loading', 'blink'] });
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start');
    const mark = await p.evaluate(() => { const t = performance.now(); performance.mark('PROBE0'); console.timeStamp('PROBE0'); return t; });
    const fr = await p.evaluate((secs) => new Promise((res) => { const ts = []; let t0 = 0; const f = (now) => { if (!t0) t0 = now; ts.push(now); if (now - t0 < secs * 1000) requestAnimationFrame(f); else res(ts); }; requestAnimationFrame(f); }), TSECS);
    const { profile } = await cdp.send('Profiler.stop');
    const tr = JSON.parse((await b.stopTracing()).toString()).traceEvents || [];
    const game = await p.evaluate(() => ({ fl: window.__fl || [], ci: window.__game && window.__game.cardInfo ? window.__game.cardInfo().title : null, uploads: window.__game && window.__game.uploads ? window.__game.uploads() : null }));
    // align: the trace's PROBE0 mark (µs) = the page's performance.now() at the mark (ms)
    const mk = tr.find((e) => (e.name === 'PROBE0' || (e.args && e.args.data && e.args.data.message === 'PROBE0')) && e.ts);
    const off = mk ? mk.ts / 1000 - mark : null; const pg = (us) => us / 1000 - off;
    const pn = new Map(), tn = new Map(); for (const e of tr) if (e.ph === 'M') { if (e.name === 'process_name') pn.set(e.pid, e.args.name); if (e.name === 'thread_name') tn.set(e.pid + ':' + e.tid, e.args.name); }
    const th = (e) => ((pn.get(e.pid) || e.pid) + '/' + (tn.get(e.pid + ':' + e.tid) || e.tid)).slice(0, 44);
    const gaps = []; for (let i = 1; i < fr.length; i++) gaps.push({ a: fr[i - 1], b: fr[i], ms: fr[i] - fr[i - 1] });
    const so = gaps.map((g) => g.ms).sort((x, y) => x - y);
    console.log('TITLE run ' + run + ': ' + gaps.length + ' frames, fps ' + (1000 * gaps.length / (fr[fr.length - 1] - fr[0])).toFixed(1) + ', p95 ' + so[Math.floor(so.length * 0.95)].toFixed(1) + ' ms, worst ' + so[so.length - 1].toFixed(1) + ' ms; aligned ' + (off != null) + '; title base ' + JSON.stringify(game.ci).slice(0, 300));
    // samples in page ms
    const byId = new Map(profile.nodes.map((q) => [q.id, q])); let t = profile.startTime; const smp = profile.samples.map((id, i) => { t += profile.timeDeltas[i] || 0; return [pg(t), id]; });
    const fname = (n) => { const c = n.callFrame; return (c.functionName || '(anon)') + ':' + (c.lineNumber + 1) + (c.url ? ' ' + c.url.split('/').pop().slice(0, 18) : ''); };
    const parentOf = new Map(); for (const q of profile.nodes) for (const c of q.children || []) parentOf.set(c, q.id);
    const longs = gaps.filter((g) => g.ms > LONG).sort((x, y) => y.ms - x.ms).slice(0, 8);
    for (const g of longs) {
      const at = ((g.a - fr[0]) / 1000).toFixed(2); console.log('LONG ' + g.ms.toFixed(0) + ' ms frame at ' + at + ' s of the title');
      const self = new Map(), chain = new Map(); let n = 0; const dt = 0.25;
      for (const [ms, id] of smp) { if (ms < g.a || ms > g.b) continue; n++; const k = fname(byId.get(id)); self.set(k, (self.get(k) || 0) + dt); const ks = []; let q = id, d = 0; while (q && d < 9) { const nd = byId.get(q); const fn = nd.callFrame.functionName; if (fn && fn !== '(root)') ks.push(fname(nd)); q = parentOf.get(q); d++; } const ck = ks.slice(0, 7).join(' < '); chain.set(ck, (chain.get(ck) || 0) + dt); }
      console.log('  main thread JS samples ' + (n * dt).toFixed(0) + ' ms; top self: ' + [...self.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => k + ' ' + v.toFixed(0)).join(', '));
      for (const [k, v] of [...chain.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4)) console.log('    ' + v.toFixed(0) + ' ms ' + k.slice(0, 300));
      if (off != null) { const ev = tr.filter((e) => e.ph === 'X' && e.dur > 15000 && pg(e.ts) < g.b && pg(e.ts + e.dur) > g.a).sort((x, y) => y.dur - x.dur).slice(0, 12);
        for (const e of ev) console.log('    trace ' + (e.dur / 1000).toFixed(0) + ' ms @' + (pg(e.ts) - g.a).toFixed(0) + ' ' + th(e) + ' | ' + e.name + (e.args && e.args.data ? ' ' + JSON.stringify(e.args.data).slice(0, 140) : '')); }
      const gl = game.fl.filter((q) => q[0] >= g.a - 2 && q[0] <= g.b); if (gl.length) console.log('    game jobs: ' + gl.map((q) => q[1] + ' ' + q[2] + ' ms (' + q[3] + ' ' + q[4] + ')').join(', '));
    }
    console.log('  game jobs over 6 ms in the title (first 30): ' + game.fl.filter((q) => q[0] >= fr[0]).slice(0, 30).map((q) => ((q[0] - fr[0]) / 1000).toFixed(2) + 's ' + q[1] + ' ' + q[2] + ' (' + q[3] + ' ' + q[4] + ')').join(', '));
    console.log('  uploads ' + JSON.stringify(game.uploads).slice(0, 400));
    await cx.close();
  }
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.log('PROBE ERROR ' + (e && e.stack || e)); process.exit(1); });
