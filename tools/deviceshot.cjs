// all 14 devices in daylight, one picture each, for the device graphics review
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  const K = await p.evaluate(() => { const g = window.__game, K = ['collector', 'turbine', 'lance', 'panel', 'mine', 'twin', 'mist', 'trellis', 'flask', 'press', 'shard', 'sling', 'prism', 'chime', 'moon']; K.forEach((k, i) => { try { g.deviceSample(k, -20 + i * 3, -1.2, 0); } catch (e) { K[i] = '!' + k; } }); return K; });
  for (let i = 0; i < K.length; i++) { await p.evaluate((i) => { const g = window.__game; g.setTown(-20 + i * 3 + 0.5, 1.9); g.setYaw(0.16); }, i); await p.waitForTimeout(350); await p.screenshot({ path: S + 'dev_' + i + '.png' }); }
  console.log(K.join(',')); await b.close();
})();
