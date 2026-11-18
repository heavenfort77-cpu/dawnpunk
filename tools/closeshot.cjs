// two machines close up at phone size, sharp (2x), to judge edges and textures. Usage: node tools/closeshot.cjs <out.png> [kindA] [kindB]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1600);
  await p.evaluate(([a, c]) => { const g = window.__game; g.setTown(-20, 0.8); g.setYaw(-Math.PI / 2); g.setPitch(0.04); g.gloomSample(a, -17.2, -0.5, Math.PI / 2 + 0.35, 3, false); g.gloomSample(c, -16.6, 2.2, Math.PI / 2 - 0.4, 3, false); }, [process.argv[3] || 'walker', process.argv[4] || 'hauler']); await p.waitForTimeout(900);
  await p.screenshot({ path: process.argv[2] }); console.log('pixel ratio ' + (await p.evaluate(() => window.devicePixelRatio)) + ' | ' + (errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS')); await b.close();
})();
