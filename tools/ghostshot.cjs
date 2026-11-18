// night, facing an empty opening: the shield outline shows where a Panel will go; then the Panel is placed there
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); window.__game.startRun(0); }); await p.waitForTimeout(2500);
  const h = await p.evaluate(() => { const r = window.__game.run, h = r.houses.slice().sort((a, b) => a.n - b.n)[0]; return [h.doorX, h.doorZ, h.row]; });
  await p.evaluate(([x, z, row]) => window.__game.setTown(x, z - row * 0.4), h); await p.waitForTimeout(1200); await p.evaluate(() => window.__game.nightfall()); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const g = window.__game, s = g.sim, q = s.breaches.find((b) => b.floor === 0 && b.type !== 'door') || s.breaches[0]; s.player.x = q.inX - q.nx * 0 + (q.inX - q.x) * 2.2; s.player.z = q.inZ + (q.inZ - q.z) * 2.2; s.player.energy = 60; g.setYaw(Math.atan2(-(q.x - s.player.x), -(q.z - s.player.z))); return q.i; }); await p.waitForTimeout(900); await p.screenshot({ path: S + 'ghost1.png' });
  const vis = await p.evaluate(() => { let n = 0; window.__game.scene && 0; return document.title; });
  await p.evaluate(() => window.__game.doPlace('panel')); await p.waitForTimeout(900); await p.screenshot({ path: S + 'ghost2.png' });
  console.log(await p.evaluate((i) => 'panel in the faced opening: ' + !!window.__game.sim.breaches[i].panel, r), errs.length ? errs.join('|') : 'NO ERRORS'); await b.close();
})();
