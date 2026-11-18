const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(3500);
  const N = [['bram', 4.6, -1.2], ['oko', 6.5, 10.4], ['pip', -5.2, 1.4]];
  for (const [id, x, z] of N) { await p.evaluate(([x, z]) => { window.__game.setBase(x - 1.0, z + 1.5); window.__game.setYaw(Math.atan2(-1.0, 1.5)); }, [x, z]); await p.waitForTimeout(2500); await p.screenshot({ path: S + 'npc_' + id + '.png' }); }
  console.log(errs.length ? errs.join('|') : 'NO ERRORS'); await b.close();
})();
