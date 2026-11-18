// the base at growth level N (rings held): pictures + count. Usage: node tools/growthshot.cjs <outprefix> [ringOpen] [cleared]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2], ro = +(process.argv[3] || 5), cl = +(process.argv[4] || 1);
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const url = 'file://' + __dirname + '/../dist/index.html'; await p.goto(url); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => window.__game.enterBase()); await p.waitForTimeout(800);
  const ok = await p.evaluate(([ro, cl]) => { const s = window.__game.save; if (!s) return false; s.ringOpen = ro; if (cl) s.cleared = 3; s.nights = 3; s.day = 4; window.__game.reBase(); return true; }, [ro, cl]); await p.waitForTimeout(2500);
  const n = await p.evaluate(() => window.__game.bview.growth()), bq = await p.evaluate(() => document.getElementById('bq').textContent);
  await p.evaluate(() => { document.getElementById('hud').style.visibility = 'hidden'; });
  const V = [[0, 13, 0], [0, -3, Math.PI], [-12, 0, -1.57]];
  for (let i = 0; i < V.length; i++) { await p.evaluate(([x, z, y]) => { window.__game.setBase(x, z); window.__game.setYaw(y); }, V[i]); await p.waitForTimeout(900); await p.screenshot({ path: S + 'g' + i + '.png' }); }
  console.log('save edited: ' + ok + ' | growth level shown: ' + n + ' | quest box: ' + bq.replace(/\n/g, ' / ')); console.log(errs.length ? errs.join('|') : 'NO ERRORS'); await b.close();
})();
