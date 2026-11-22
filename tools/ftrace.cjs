// (test branch probe3 only, never merged) film probe, owner Nov 22 21:26: "use probe find the exact issue do not guess".
// What runs, on every thread of the browser, at the moments the opening video drops frames and the page has long frames, and after Skip.
// Browser-level trace windows (every process: the page, the GPU process, the display compositor, the media threads); the page marks its own times
// with console.timeStamp ('FT <ms since the click>' every 100 ms, 'DROP n' when the video's dropped count rises, 'CLICK', 'SKIP'), so every event is
// placed on the film's clock. A bare page playing the same file (nothing else) gives the drop timeline of the decoder on its own.
const CATS = ['toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'gpu', 'media', 'viz', 'cc', 'disabled-by-default-gpu.service'];

function report(label, buf) {
  let evs; try { evs = JSON.parse(buf.toString()).traceEvents || []; } catch (e) { console.log('FTRACE ' + label + ': parse failed ' + String(e).slice(0, 120)); return; }
  const pn = new Map(), tn = new Map(); for (const e of evs) if (e.ph === 'M') { if (e.name === 'process_name') pn.set(e.pid, e.args.name); if (e.name === 'thread_name') tn.set(e.pid + ':' + e.tid, e.args.name); }
  const th = (e) => (pn.get(e.pid) || e.pid) + '/' + (tn.get(e.pid + ':' + e.tid) || e.tid);
  const msg = (e) => (e.args && e.args.data && e.args.data.message) || (e.args && e.args.message) || '';
  const marks = evs.filter((e) => e.name === 'TimeStamp' && /^(FT|DROP|CLICK|SKIP)/.test(msg(e)));
  const wps = evs.filter((e) => e.name === 'TimeStamp' && /^WP /.test(msg(e))).sort((x, y) => x.ts - y.ts);
  const offs = marks.filter((e) => /^FT \d/.test(msg(e))).map((e) => e.ts / 1000 - +msg(e).slice(3)).sort((a, b) => a - b), off = offs.length ? offs[offs.length >> 1] : null;
  const at = (us) => (off === null ? 'trace ' + (us / 1000).toFixed(0) + ' ms' : ((us / 1000 - off) / 1000).toFixed(2) + ' s');
  const main = marks[0] ? marks[0].pid + ':' + marks[0].tid : null;
  const X = evs.filter((e) => e.ph === 'X' && e.dur > 0);
  let t0 = Infinity, t1 = -Infinity; for (const e of X) { if (e.ts < t0) t0 = e.ts; if (e.ts + e.dur > t1) t1 = e.ts + e.dur; }
  console.log('FTRACE ' + label + ': ' + evs.length + ' events, ' + at(t0) + ' to ' + at(t1) + ' (film clock: s after the click), page main ' + (main ? th({ pid: +main.split(':')[0], tid: +main.split(':')[1] }) : 'not found'));
  // busy per thread over the window (top-level tasks)
  const busy = new Map(); for (const e of X) if (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'RunTask' || e.name === 'ThreadPool_RunTask') busy.set(th(e), (busy.get(th(e)) || 0) + e.dur / 1000);
  console.log('  busy (top-level tasks, ms): ' + [...busy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k.slice(0, 60) + ' ' + v.toFixed(0)).join(' ; '));
  const name = (e) => e.name + (e.args && e.args.src_func ? ' [' + (e.args.src_file || '').split('/').slice(-1)[0] + ':' + e.args.src_func + ']' : '') + (e.args && e.args.data && e.args.data.functionName ? ' {' + e.args.data.functionName + '}' : '');
  const inside = (a, b, minMs) => X.filter((e) => e.ts < b && e.ts + e.dur > a && Math.min(b, e.ts + e.dur) - Math.max(a, e.ts) >= minMs * 1000);
  const show = (title, a, b) => { const L = inside(a, b, 6).sort((x, y) => y.dur - x.dur), byTh = new Map(); for (const e of L) { const k = th(e); if (!byTh.has(k)) byTh.set(k, []); if (byTh.get(k).length < 5) byTh.get(k).push(e); }
    console.log('  ' + title + ' (' + at(a) + ' to ' + at(b) + '):' + (byTh.size ? '' : ' nothing over 6 ms on any thread'));
    for (const [k, es] of [...byTh.entries()].sort((x, y) => y[1][0].dur - x[1][0].dur).slice(0, 7)) console.log('    ' + k.slice(0, 50) + ': ' + es.map((e) => name(e).slice(0, 110) + ' ' + (e.dur / 1000).toFixed(0) + ' ms @' + at(e.ts)).join(' | ')); };
  // the page's frames: gaps between its animation-frame callbacks
  const raf = X.filter((e) => (e.pid + ':' + e.tid) === main && (e.name === 'FireAnimationFrame' || e.name === 'AnimationFrame')).map((e) => e.ts).sort((a, b) => a - b);
  const gaps = []; for (let i = 1; i < raf.length; i++) if (raf[i] - raf[i - 1] > 80000) gaps.push([raf[i - 1], raf[i]]);
  console.log('  page frames ' + raf.length + ', gaps over 80 ms: ' + gaps.length + (gaps.length ? ' (' + gaps.map((g) => ((g[1] - g[0]) / 1000).toFixed(0) + ' ms @' + at(g[0])).slice(0, 10).join(', ') + ')' : ''));
  for (const g of gaps.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0])).slice(0, 4)) show('long page frame ' + ((g[1] - g[0]) / 1000).toFixed(0) + ' ms', g[0], g[1]);
  // drops: each 'DROP' mark is the 25 ms poll that saw the count rise; the window is the 80 ms before it; marks within 200 ms are one cluster
  const dm = marks.filter((e) => /^DROP/.test(msg(e))).map((e) => [e.ts, +msg(e).slice(5)]); const cl = [];
  for (const [ts, n] of dm) { const c = cl[cl.length - 1]; if (c && ts - c[1] < 200000) { c[1] = ts; c[2] += n; } else cl.push([ts, ts, n]); }
  console.log('  drops in this window: ' + dm.reduce((s, q) => s + q[1], 0) + ' in ' + cl.length + ' clusters' + (cl.length ? ' (' + cl.map((c) => c[2] + ' @' + at(c[0])).join(', ') + ')' : ''));
  for (const c of cl.slice(0, 8)) show(c[2] + ' dropped', c[0] - 80000, c[1]);
  // (wmark) the warm's parts on the film clock, and the longest single events of the GPU process and the display compositor in the window, each with the warm
  // part drawn last before it started
  if (wps.length) { const lastWp = (ts) => { let r = null; for (const w of wps) { if (w.ts <= ts) r = w; else break; } return r ? msg(r).slice(3, 80) + ' (' + ((ts - r.ts) / 1000).toFixed(0) + ' ms earlier)' : 'none'; };
    console.log('  warm parts in this window: ' + wps.length + ', first @' + at(wps[0].ts) + ' ' + msg(wps[0]).slice(3, 60) + ', last @' + at(wps[wps.length - 1].ts));
    const ppl = wps.filter((w) => /rig|hair|scan_|brow|cornea|crinkle|lashes|body|eye_|buckle|belt|coat|collar|suit/.test(msg(w))); if (ppl.length) console.log('  people parts: ' + ppl.length + ' from @' + at(ppl[0].ts) + ' to @' + at(ppl[ppl.length - 1].ts));
    const G = X.filter((e) => /Gpu|GPU|viz|Viz|Compositor/i.test(th(e)) && e.dur >= 12000 && !/RunTask|ThreadPool|ThreadController|SequenceManager|Scheduler::|TaskGraphRunner/.test(e.name)).sort((x, y) => y.dur - x.dur).slice(0, 40);
    console.log('  longest GPU / compositor events (ms, name, thread, when, warm part before it):'); for (const e of G) console.log('    ' + (e.dur / 1000).toFixed(0) + ' ' + name(e).slice(0, 80) + ' | ' + th(e).slice(0, 40) + ' @' + at(e.ts) + ' | ' + lastWp(e.ts));
    for (const c of cl.slice(0, 12)) console.log('  cluster ' + c[2] + ' dropped @' + at(c[0]) + ': warm part before it: ' + lastWp(c[0])); }
  // the same listing for a quiet stretch with no drop and no long frame (what normal looks like), and the media/compositor events by name
  const busyNames = new Map(); for (const e of X) if (/media|Video|viz|Compositor|Gpu|GPU/i.test(th(e))) { const k = th(e).slice(0, 40) + ' | ' + e.name; const q = busyNames.get(k) || [0, 0, 0]; q[0] += e.dur / 1000; q[1]++; q[2] = Math.max(q[2], e.dur / 1000); busyNames.set(k, q); }
  console.log('  GPU / viz / media / compositor events by name (ms in all, count, longest): ' + [...busyNames.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, 24).map(([k, q]) => k + ' ' + q[0].toFixed(0) + 'x' + q[1] + ' max ' + q[2].toFixed(0)).join(' ; '));
}

// a bare page playing the same file from its start for secs s, nothing else on the page: its drop timeline (polled every 25 ms)
async function bare(ctx, url, vp, secs) {
  const pv = await ctx.newPage(); await pv.setViewportSize(vp);
  await pv.setContent('<!doctype html><html><body style="margin:0;background:#000"><video id="v" src="' + url + '" muted playsinline preload="auto" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video></body></html>');
  const r = await pv.evaluate((secs) => new Promise((res) => { const v = document.getElementById('v'); const go = () => { v.removeEventListener('canplay', go); const t0 = Date.now(), T = []; let d0 = 0; v.play();
    const iv = setInterval(() => { const q = v.getVideoPlaybackQuality(); if (q.droppedVideoFrames > d0) { T.push([Date.now() - t0, q.droppedVideoFrames - d0, +v.currentTime.toFixed(2)]); d0 = q.droppedVideoFrames; }
      if (Date.now() - t0 > secs * 1000 || v.ended) { clearInterval(iv); res({ total: q.totalVideoFrames, dropped: q.droppedVideoFrames, t: +v.currentTime.toFixed(2), dropT: T }); } }, 25); };
    if (v.readyState >= 3) go(); else v.addEventListener('canplay', go); }), secs);
  await pv.close(); return r;
}
// a browser-wide trace through CDP (record as much as possible, streamed to a file, so it is not cut to the last part like a ring buffer); stop() writes
// the file (and a .gz copy for the job's artifact) and returns its contents for report() when under 400 MB
async function recorder(b) {
  const fs = require('fs'), zlib = require('zlib'), cdp = await b.newBrowserCDPSession();
  return { start: () => cdp.send('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: { recordMode: 'recordAsMuchAsPossible', includedCategories: CATS, excludedCategories: ['*'] } }),
    stop: async (file) => { const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); const { stream } = await done; const fd = fs.openSync(file, 'w');
      for (;;) { const r = await cdp.send('IO.read', { handle: stream, size: 4 << 20 }); fs.writeSync(fd, r.base64Encoded ? Buffer.from(r.data, 'base64') : Buffer.from(r.data)); if (r.eof) break; } fs.closeSync(fd); await cdp.send('IO.close', { handle: stream });
      const size = fs.statSync(file).size; await new Promise((ok) => fs.createReadStream(file).pipe(zlib.createGzip()).pipe(fs.createWriteStream(file + '.gz')).on('finish', ok));
      console.log('FTRACE file ' + file + ' ' + (size / 1048576).toFixed(0) + ' MB'); return size < 400 * 1048576 ? fs.readFileSync(file) : Buffer.from('{"traceEvents":[]}'); } };
}
module.exports = { CATS, report, bare, recorder };
