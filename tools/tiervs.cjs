// The street (a car, houses, three machines) and the base on one graphics tier, same framing as tools/fxshot.cjs. Usage: node tools/tiervs.cjs <out_prefix> <low|high>
const { chromium } = require('playwright'); const tier = process.argv[3] || 'high';
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = []; const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index_single.html?quality=' + tier + '&seed=777'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); for (const id of ['hud', 'marla', 'msg', 'bprompt', 'bq', 'bstat']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }); await p.waitForFunction(() => window.__game.marla.ready, null, { timeout: 90000 }); await p.waitForTimeout(3000);
  await p.screenshot({ path: process.argv[2] + '_base_' + tier + '.png', timeout: 180000 });
  await p.evaluate(() => { const g = window.__game; document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.__game; g.setTown(-19.2, 0); g.setYaw(-Math.PI / 2); g.setPitch(0.04); ['walker', 'hauler', 'warden'].forEach((k, i) => g.gloomSample(k, -15.2, -2.0 + i * 2.0, Math.PI / 2, 3 + i, false)); }); await p.waitForTimeout(4000);
  await p.screenshot({ path: process.argv[2] + '_street_' + tier + '.png', timeout: 180000 }); console.log(tier, errs.length ? errs.join('|').slice(0, 400) : 'NO ERRORS'); await b.close(); })();
