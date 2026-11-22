// Patrol probe (owner Nov 22: two researchers carrying crates walk through each other on their shared patrol line): the crate probe's base (nine recruits, four of
// them researchers, ids spread as quests spread them), the base's own update stepped FR times of 0.05 s (no drawing needed). Rules over every step:
//   no two recruits' bodies closer than BODY m (0.5: two bodies of about 0.25 m half width touch); no carried crate within CRATE m of another recruit's body line;
//   no recruit's body within 0.2 m of a solid's footprint (the base's boxes); every recruit keeps walking (each walks at least half the median distance).
// Usage: node tools/patrolprobe.cjs [dist] [quality]. PASS/FAIL per rule, exit 1 on any FAIL. Also prints the closest approach of each pair and the boxes near the routes.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const D = process.argv[2] || path.join(__dirname, '..', 'dist'), QUAL = process.argv[3] || 'low', BODY = 0.5, CRATE = 0.3;
const srv = http.createServer((q, r) => { const f = path.join(D, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(b); }); });
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 480 } })).newPage(); p.setDefaultTimeout(900000);
  await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?quality=' + QUAL + '&seed=7&cards=1');
  await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { const g = window.__game; g.enterBase(); const s = g.save; s.day = 5; s.nights = 3; s.nightsMet = 3; s.trips = 3; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.noteSeen = true; s.toldCharge = true; s.ringOpen = 4;
    const R = ['researcher', 'gatherer', 'hunter', 'researcher', 'engineer', 'researcher', 'gatherer', 'researcher', 'hunter'], N = ['Wen', 'Jun', 'Mei', 'Tomas', 'Ines', 'Bram', 'Lia', 'Kofi', 'Ana'], IDS = [100, 101, 103, 104, 105, 107, 108, 109, 112];
    s.personnel = R.map((r, k) => ({ id: IDS[k], name: N[k], role: r })); });
  await p.waitForFunction(() => !window.__game.cardOn(), null, { timeout: 600000 }); await p.waitForTimeout(2000);
  const r = await p.evaluate(({ F, BODY, CRATE }) => new Promise((res) => { const g = window.__game, pk = g.bview.peek(), A = pk.npcs, n = A.length, cp = g.cam.position, V = cp.constructor, cw = new V();
    const out = { people: n, roles: A.map((o) => o.p.name + ' ' + o.p.role), close: {}, crate: {}, inBox: {}, walked: A.map(() => 0), minPair: {} }; const last = A.map((o) => [o.n.position.x, o.n.position.z]);
    const near = (pk.boxes || []).map((bx) => { const I = bx.I || { x: 0, z: 0, ry: 0 }; return { bx, I }; });
    out.boxesNear = near.filter(({ I }) => Math.abs(I.x - 7.5) < 5 && Math.abs(I.z - 3) < 4).slice(0, 20).map(({ bx, I }) => [I.x, I.z, I.ry || 0, bx.cx || 0, bx.cz || 0, bx.hx, bx.hz].map((v) => +(+v).toFixed(2)));
    let k = 0; const f = () => { for (let st = 0; st < 3; st++) g.bview.update(0.05 / 3, cp.x, cp.z, cp.y); k++;
      for (let a = 0; a < n; a++) { const P = A[a].n.position; out.walked[a] += Math.hypot(P.x - last[a][0], P.z - last[a][1]); last[a][0] = P.x; last[a][1] = P.z;
        for (let c = a + 1; c < n; c++) { const Q = A[c].n.position, d = Math.hypot(P.x - Q.x, P.z - Q.z), key = A[a].p.name + '-' + A[c].p.name; if (out.minPair[key] == null || d < out.minPair[key]) out.minPair[key] = +d.toFixed(3); if (d < BODY) out.close[key] = (out.close[key] || 0) + 1; }
        if (A[a].crate.visible) { A[a].crate.getWorldPosition(cw); for (let c = 0; c < n; c++) { if (c === a) continue; const Q = A[c].n.position, d = Math.hypot(cw.x - Q.x, cw.z - Q.z); if (d < CRATE) { const key = A[a].p.name + ' crate-' + A[c].p.name; out.crate[key] = (out.crate[key] || 0) + 1; } } }
        for (const { bx, I } of near) { const dx = P.x - I.x, dz = P.z - I.z, co = Math.cos(-(I.ry || 0)), si = Math.sin(-(I.ry || 0)), lx = dx * co + dz * si - (bx.cx || 0), lz = -dx * si + dz * co - (bx.cz || 0); if (Math.max(Math.abs(lx) - bx.hx, Math.abs(lz) - bx.hz) < 0.2) { const key = A[a].p.name + ' at ' + P.x.toFixed(1) + ',' + P.z.toFixed(1) + ' box ' + (+I.x).toFixed(1) + ',' + (+I.z).toFixed(1); out.inBox[A[a].p.name] = out.inBox[A[a].p.name] || [0, key]; out.inBox[A[a].p.name][0]++; } } }
      if (k < F) { if (k % 100 === 0) setTimeout(f, 0); else f(); } else { out.frames = k; res(out); } }; f(); }), { F: +(process.env.FR || 3000), BODY, CRATE });
  const fails = [], line = (ok, t) => { console.log((ok ? 'PASS ' : 'FAIL ') + t); if (!ok) fails.push(t); };
  console.log('people ' + r.people + ': ' + r.roles.join(', ') + '; ' + r.frames + ' steps of 0.05 s');
  console.log('boxes near the researchers (x, z, ry, cx, cz, hx, hz): ' + JSON.stringify(r.boxesNear));
  console.log('closest approach per pair (m): ' + Object.entries(r.minPair).sort((a, b) => a[1] - b[1]).slice(0, 12).map(([k2, v]) => k2 + ' ' + v).join(', '));
  const cl = Object.entries(r.close); line(!cl.length, 'no two recruits closer than ' + BODY + ' m (steps per pair: ' + (cl.map(([k2, v]) => k2 + ' ' + v).join(', ') || 'none') + ')');
  const cr = Object.entries(r.crate); line(!cr.length, 'no carried crate within ' + CRATE + ' m of another recruit (' + (cr.map(([k2, v]) => k2 + ' ' + v).join(', ') || 'none') + ')');
  const ib = Object.entries(r.inBox); line(!ib.length, 'no recruit within 0.2 m of a solid footprint (' + (ib.map(([k2, v]) => v[0] + ' steps ' + v[1]).join('; ') || 'none') + ')');
  const w = [...r.walked].sort((a, b) => a - b), med = w[Math.floor(w.length / 2)], slow = r.walked.map((d, i) => [r.roles[i], d]).filter((q) => q[1] < med / 2);
  line(!slow.length, 'every recruit keeps walking (median ' + med.toFixed(1) + ' m; under half: ' + (slow.map((q) => q[0] + ' ' + q[1].toFixed(1)).join(', ') || 'none') + ')');
  await b.close(); srv.close(); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('FAIL probe error ' + (e && e.stack || e)); process.exit(1); });
