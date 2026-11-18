// desolate SAMPLE: three Walkers and three Haulers side by side, each with its own random mud, rust, soot and moss. Usage: node tools/desogloom.cjs <out.png>
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=high&seed=777&look=desolate'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.__game; g.setTown(-19.2, 0); g.setYaw(-Math.PI / 2); g.setPitch && g.setPitch(0.06); ['walker', 'hauler', 'walker', 'warden', 'lurcher', 'walker', 'stilt', 'lantern', 'ticks'].forEach((k, i) => g.gloomSample(k, -14.2, -6.4 + i * 1.6, Math.PI / 2, 3 + i, false)); }); await p.waitForTimeout(2500);
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await b.close(); })();
