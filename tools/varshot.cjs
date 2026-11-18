// one picture per house (from the street), plus one inside, for the "nothing is the same" review
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 560, height: 390 } });
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '1'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; window.__game.hands.g && (window.__game.hands.g.visible = false); }); await p.waitForTimeout(2500);
  const hs = await p.evaluate(() => window.__game.run.houses.map((h) => [h.x, h.z, h.doorX, h.doorZ, h.row]));
  for (let i = 0; i < hs.length; i++) { const [x, z, dx, dz, row] = hs[i], cx = dx + 9, cz = -row * 2.5; await p.evaluate(([cx, cz, x, z]) => { window.__game.setTown(cx, cz); window.__game.setYaw(Math.atan2(x - cx, z - cz) + Math.PI); }, [cx, cz, x, z]); await p.waitForTimeout(700); await p.screenshot({ path: S + 'h' + i + '.png' }); }
  await b.close();
})();
