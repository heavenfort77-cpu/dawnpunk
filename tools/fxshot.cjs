// Desktop picture pass before/after: the street with a car, houses and three machines, then the base. Usage: node tools/fxshot.cjs <out_prefix>
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  for (const fx of ['0', '1']) { const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'warning' && /picture pass/.test(m.text())) errs.push(m.text()); });
    await p.goto('file://' + __dirname + '/../dist/index.html?quality=high&seed=777&fx=' + fx); await p.waitForFunction(() => window.__game && window.__game.startRun);
    await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); for (const id of ['hud', 'marla', 'msg', 'bprompt', 'bq', 'bstat']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }); await p.waitForTimeout(3000);
    await p.screenshot({ path: process.argv[2] + '_base_' + fx + '.png' });
    await p.evaluate(() => { const g = window.__game; document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForTimeout(2500);
    await p.evaluate(() => { const g = window.__game; g.setTown(-19.2, 0); g.setYaw(-Math.PI / 2); g.setPitch(0.04); ['walker', 'hauler', 'warden'].forEach((k, i) => g.gloomSample(k, -15.2, -2.0 + i * 2.0, Math.PI / 2, 3 + i, false)); }); await p.waitForTimeout(4000);
    await p.screenshot({ path: process.argv[2] + '_street_' + fx + '.png' }); await p.close(); }
  console.log(errs.length ? errs.join('|').slice(0, 400) : 'NO ERRORS'); await b.close(); })();
