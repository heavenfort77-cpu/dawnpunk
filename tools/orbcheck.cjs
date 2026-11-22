// Orb check (owner Nov 22: "the loot are inside orb, some of the orb don't disappear"): in each street house by day, every crate is taken (the sim's own flag),
// a few frames are drawn, and no piece in loot colours (the capsule's lit band and glow: green food 0x8dff8a, blue essentials 0x7fc8ff) may still show anywhere.
// Before the fix the big capsule the cat hides behind (twice the size, blue) stood in every house and could never be taken.
// Usage: node tools/orbcheck.cjs [dist] [quality]. PASS/FAIL per house, exit 1 on any FAIL.
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const D = process.argv[2] || path.join(__dirname, '..', 'dist'), QUAL = process.argv[3] || 'low';
const srv = http.createServer((q, r) => { const f = path.join(D, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(b); }); });
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); let nf = 0, np = 0;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 480, height: 270 } })).newPage(); p.setDefaultTimeout(600000); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?quality=' + QUAL + '&seed=7&cards=1'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__game.enterBase(); const s = window.__game.save; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.noteSeen = true; s.toldCharge = true; s.ringOpen = 1; });
  await p.waitForFunction(() => !window.__game.cardOn()); await p.evaluate(() => { document.getElementById('selRing').value = '0'; window.__game.startRun(0); }); await p.waitForFunction(() => window.__game.run && !window.__game.cardOn());
  const N = await p.evaluate(() => window.__game.run.houses.length);
  for (let i = 0; i < N; i++) {
    await p.evaluate((i) => window.__game.enterHouse(i), i); await p.waitForFunction(() => window.__game.sim && !window.__game.cardOn(), null, { timeout: 600000 });
    const r = await p.evaluate(() => new Promise((res) => { const g = window.__game, sim = g.sim, n = sim.crates.length; for (const c of sim.crates) c.got = true; let k = 0; const f = () => { if (++k < 4) { requestAnimationFrame(f); return; }
      let sc = g.cam; while (sc.parent) sc = sc.parent; let root = null; for (const c of [g.world && g.world.g]) { let s = c; while (s && s.parent) s = s.parent; if (s) root = s; } root = root || sc; const left = [];
      root.traverse((o) => { if (!o.isMesh && !o.isSprite) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m || !m.color) return; const h = m.color.getHex(); if (h !== 0x8dff8a && h !== 0x7fc8ff) return; for (let q = o; q; q = q.parent) if (!q.visible) return; const v = o.getWorldPosition(new (o.position.constructor)()); left.push(h.toString(16) + ' at ' + v.x.toFixed(1) + ',' + v.y.toFixed(1) + ',' + v.z.toFixed(1)); });
      res({ n, left }); }; requestAnimationFrame(f); }));
    if (r.left.length) { nf++; console.log('FAIL house ' + i + ': ' + r.left.length + ' loot-coloured pieces still shown after all ' + r.n + ' crates were taken: ' + r.left.slice(0, 4).join('; ')); } else { np++; console.log('PASS house ' + i + ': nothing in loot colours shows after all ' + r.n + ' crates were taken'); }
    await p.evaluate(() => window.__game.leaveHouse && window.__game.leaveHouse()); await p.waitForTimeout(300);
  }
  if (errs.length) { nf++; console.log('FAIL page errors: ' + errs.slice(0, 3).join(' | ')); }
  console.log('ORBCHECK ' + np + ' PASS, ' + nf + ' FAIL'); await b.close(); srv.close(); process.exit(nf ? 1 : 0);
})().catch((e) => { console.error('FAIL ' + String(e).slice(0, 300)); process.exit(1); });
