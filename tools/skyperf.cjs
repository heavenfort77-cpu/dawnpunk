// the sky lowers its own detail on a slow renderer: under software rendering it must end at 2
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__game.enterBase(); window.__game.startRun(0); }); const d0 = await p.evaluate(() => window.__game.sky.detail);
  await p.waitForFunction(() => window.__game.sky.detail === 2, null, { timeout: 100000 }).catch(() => {}); const d1 = await p.evaluate(() => window.__game.sky.detail);
  console.log((d0 >= 3 && d1 === 2 ? 'PASS' : 'FAIL') + ' sky detail drops by itself on a slow renderer: ' + d0 + ' -> ' + d1); await b.close();
})();
