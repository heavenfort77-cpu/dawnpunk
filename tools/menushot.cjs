// pictures of the menus (main, Marla's ride-out panel, a base panel, pause) on one sheet. Usage: node tools/menushot.cjs <outprefix>
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase); await p.waitForTimeout(500);
  await p.screenshot({ path: S + 'm0.png' });
  await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.essentials = 60; g.save.nights = 2; }); await p.waitForTimeout(2000);
  await p.evaluate(() => { const g = window.__game; if (g.openPanel) g.openPanel('workshop'); }); await p.waitForTimeout(400); await p.screenshot({ path: S + 'm1.png' });
  await p.evaluate(() => { const g = window.__game; if (g.openPanel) g.openPanel('journal'); }); await p.waitForTimeout(400); await p.screenshot({ path: S + 'm2.png' });
  await p.evaluate(() => { document.getElementById('qb').style.display = 'none'; const g = window.__game; if (g.openScout) g.openScout(); else document.getElementById('scout').style.display = 'flex'; }); await p.waitForTimeout(400); await p.screenshot({ path: S + 'm3.png' });
  console.log(errs.length ? errs.join('|') : 'NO ERRORS'); await b.close();
})();
