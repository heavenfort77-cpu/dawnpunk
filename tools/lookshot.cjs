// style samples: old Lance next to the Bloomtech Lance (day), and old Walker next to the new-finish Walker when present
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 900, height: 480 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; window.__noHands = true; }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.__game; g.deviceSample('lance', -0.75, -1.3, 0.6); g.deviceSample('lance', 0.75, -1.3, 0.6, true); g.setTown(0, 0.45); g.setYaw(0); g.setPitch && g.setPitch(-0.42); }); await p.waitForTimeout(1200); await p.screenshot({ path: S + 'look_lance.png' });
  if (process.argv[3]) { await p.evaluate(() => { const g = window.__game; g.gloomSample('walker', 18.5, -0.8, Math.PI + 0.25, 3.3); g.gloomSample('walker2', 20.3, -0.8, Math.PI - 0.25, 3.3); g.setTown(19.4, 2.4); g.setYaw(0); g.setPitch && g.setPitch(0); }); await p.waitForTimeout(1200); await p.screenshot({ path: S + 'look_walker.png' }); }
  console.log(errs.length ? errs.join('|') : 'NO ERRORS'); await b.close();
})();
