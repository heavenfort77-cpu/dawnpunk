const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__game.enterBase(); window.__game.startRun(0); }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const m = window.__game.marla.root.position; window.__game.setTown(m.x - 2.2, m.z - 1.2); window.__game.setYaw(Math.atan2(-2.2, -1.2)); }); await p.waitForTimeout(1500); await p.screenshot({ path: S + 'guide1.png' });
  await p.evaluate(() => { const m = window.__game.marla.root.position; window.__game.setTown(m.x - 0.9, m.z); }); await p.waitForTimeout(900); await p.screenshot({ path: S + 'guide2.png' });
  await b.close();
})();
