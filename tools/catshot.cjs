// lucky cat SAMPLE: the old plain white cat beside each painted style, front and back. Usage: node tools/catshot.cjs <out.png> [quality]
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1000, height: 560 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=' + (process.argv[3] || 'high') + '&seed=777'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  const n = await p.evaluate(() => { const g = window.__game, S = [0, 1, 2]; g.setTown(-18.2, 0.3); g.setYaw(-Math.PI / 2); g.setPitch(-0.32);
    let k = 0; for (const si of S) { g.catSample(si, -16.6, -1.0 + k * 1.3, Math.PI / 2, 1); g.catSample(si, -16.6, -1.0 + k * 1.3 + 0.62, -Math.PI / 2, 1); k++; } return S.length; }); await p.waitForTimeout(2000);
  await p.screenshot({ path: process.argv[2] }); console.log(n + ' looks', errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await b.close(); })();
