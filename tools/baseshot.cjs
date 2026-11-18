// four views of the base for the art review
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 560, height: 390 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(3000);
  const V = [[0, 9, 0], [0, -2.5, 0], [4, 1, -0.75], [-6, 6, 0.75], [-9, 6, 0.9], [8, 12, -0.6]];
  for (let i = 0; i < V.length; i++) { await p.evaluate(([x, z, y]) => { window.__game.setBase(x, z); window.__game.setYaw(y); }, V[i]); await p.waitForTimeout(900); await p.screenshot({ path: S + 'b' + i + '.png' }); }
  console.log(errs.length ? errs.join('|') : 'NO ERRORS'); await b.close();
})();
