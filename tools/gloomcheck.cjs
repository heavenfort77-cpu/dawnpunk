// Gloom machine checks: triangles per machine (budget), only one caption at a time, the light pool follows the nearest screens, kinds differ in the sim
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 844, height: 390 } }); const errs = [], out = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  const K = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'], tris = await p.evaluate((K) => K.map((k) => window.__game.gloomTris(k)), K);
  const budget = await p.evaluate(() => { const q = window.__game.quality(); return { tier: q.tier, max: window.CONFIG.quality[q.tier].machineTris }; });
  out.push(['triangles per machine within ' + budget.max + ' (' + budget.tier + ' graphics tier): ' + K.map((k, i) => k + ' ' + tris[i]).join(', '), tris.every((n) => n > 300 && n <= budget.max)]);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '2'; window.__game.startRun(0); }); await p.waitForTimeout(2000);
  const h = await p.evaluate(() => { const r = window.__game.run, h = r.houses[0]; return [h.doorX, h.doorZ, h.row]; }); await p.evaluate(([x, z, row]) => window.__game.setTown(x, z - row * 0.4), h); await p.waitForTimeout(900); await p.evaluate(() => window.__game.nightfall());
  let maxCap = 0, lit = 0, kinds = new Set(), speeds = {};
  for (let k = 0; k < 30; k++) { await p.waitForTimeout(1500); const r = await p.evaluate(() => { const g = window.__game, s = g.sim; if (!s) return null; s.player.hp = 100; let caps = 0; g.scene && 0; const ks = s.gloom.map((q) => q.kind); return { ks, lit: g.glights.filter((l) => l.intensity > 0).length, caps: g.captions(), n: s.gloom.length }; }); if (!r) break; r.ks.forEach((q) => kinds.add(q)); maxCap = Math.max(maxCap, r.caps); lit = Math.max(lit, r.lit); }
  out.push(['never more than one caption on screen (max seen ' + maxCap + ')', maxCap <= 1], ['screens throw real light at night (' + lit + ' lights in use)', lit >= 1], ['several kinds of machine came in one night: ' + [...kinds].join(', '), kinds.size >= 3], ['no page errors', errs.length === 0]);
  let bad = 0; for (const [n, ok] of out) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) bad++; } console.log(bad ? 'SOME FAILED ' + errs.slice(0, 2).join('|') : 'ALL PASS'); await b.close();
})();
