const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const D = require('path').join(__dirname, '..', 'dist');
const srv = http.createServer((q, r) => { const f = path.join(D, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(b); }); });
// (test branch) researchers' crates: crate shown without its body, hands far from the crate, head inside the crate
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 480, height: 270 } })).newPage(); p.setDefaultTimeout(900000);
  await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?quality=medium&seed=7&cards=1');
  await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { const g = window.__game; g.enterBase(); const s = g.save; s.day = 5; s.nights = 3; s.nightsMet = 3; s.trips = 3; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.noteSeen = true; s.toldCharge = true; s.ringOpen = 4;
    const R = ['researcher', 'gatherer', 'hunter', 'researcher', 'engineer', 'researcher', 'gatherer', 'researcher', 'hunter'], N = ['Wen', 'Jun', 'Mei', 'Tomas', 'Ines', 'Bram', 'Lia', 'Kofi', 'Ana']; s.personnel = R.map((r, k) => ({ id: k + 1, name: N[k], role: r })); s.nextId = 10; if (g.homeCard) g.homeCard(); else g.reBase(); });
  console.log('base set ' + new Date().toISOString()); await p.waitForFunction(() => !window.__game.cardOn(), null, { timeout: 600000 }); await p.waitForTimeout(2000); console.log('base up ' + new Date().toISOString());
  const r = await p.evaluate((F) => new Promise((res) => { const g = window.__game, pk = g.bview.peek(), out = { frames: 0, carriers: 0, bad: {} }, V = g.cam.position.constructor; const t = new V(), hl = new V(), hr = new V(), hd = new V();
    const note = (k, ex) => { const q = out.bad[k] || (out.bad[k] = { n: 0, ex }); q.n++; };
    window.__dtMax = 0.05; let k = 0; const f = () => { k++; out.frames = k;
      for (const o of pk.npcs) { if (!o.crate.visible) continue; if (k === 1) out.carriers++; const root = o.ch && o.ch.root; const nm = o.p.name;
        if (!root || root.parent !== o.n) { note('crate shown, model not in place', nm); continue; }
        let vis = true; for (let q = o.crate; q; q = q.parent) if (!q.visible) vis = false; if (!vis) continue;
        let bodyVis = true; for (let q = root; q; q = q.parent) if (!q.visible) bodyVis = false; let sk = null; root.traverse((q) => { if (q.isSkinnedMesh && !sk) sk = q; }); if (sk && !sk.visible) bodyVis = false; if (!bodyVis) note('crate shown, body hidden', nm);
        let L = null, Rr = null, H = null; root.traverse((q) => { if (q.isBone) { if (q.name === 'hand_l') L = q; if (q.name === 'hand_r') Rr = q; if (q.name === 'head') H = q; } }); if (!L || !Rr || !H) { note('no bones', nm); continue; }
        o.crate.updateWorldMatrix(true, false); const inv = o.crate.matrixWorld.clone().invert(); hl.setFromMatrixPosition(L.matrixWorld).applyMatrix4(inv); hr.setFromMatrixPosition(Rr.matrixWorld).applyMatrix4(inv); hd.setFromMatrixPosition(H.matrixWorld).applyMatrix4(inv);
        const dl = Math.hypot(hl.x, hl.y, hl.z), dr = Math.hypot(hr.x, hr.y, hr.z); if (Math.max(dl, dr) > 0.45) note('hand far from crate (>0.45 m)', nm + ' ' + dl.toFixed(2) + '/' + dr.toFixed(2));
        if (Math.abs(hd.x) < 0.2 + 0.1 && Math.abs(hd.y) < 0.15 + 0.1 && Math.abs(hd.z) < 0.2 + 0.1) note('head inside crate (+0.1 m)', nm + ' head at ' + [hd.x, hd.y, hd.z].map((v) => v.toFixed(2)).join(','));
        if (k % 200 === 1) { (out.samples || (out.samples = [])).push(nm + ' head ' + [hd.x, hd.y, hd.z].map((v) => v.toFixed(2)).join(',') + ' handsDist ' + dl.toFixed(2) + '/' + dr.toFixed(2)); } }
      if (k < F) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); }), +(process.env.FR || 1500));
  console.log(JSON.stringify(r, null, 1)); await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
