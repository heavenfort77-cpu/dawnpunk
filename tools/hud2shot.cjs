// Pictures of HUD2 from the built game (2026-11-16). Usage: node tools/hud2shot.cjs <outPrefix> <title|day|night|phone> [low|high] [w] [h]
// title: the title screen (desktop size w x h, default 1280x720; 'phone' size uses a Pixel 7 landscape). day / night: desktop interface in the street by day
// (aimed at a dormant machine) and in a house at night. phone: the phone layout by day in a house and at night. One headless browser, software renderer.
const { chromium, devices } = require('playwright');
(async () => {
  const [out, what, q = 'high', w = '1280', h = '720'] = process.argv.slice(2); const phone = what === 'phone' || w === 'phone';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = phone ? await b.newContext({ ...devices['Pixel 7 landscape'] }) : await b.newContext({ viewport: { width: +w, height: +h } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); await p.addInitScript(() => { window.__dtMax = 0.6; });
  await p.goto('file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + q, { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 120000 });
  const shot = async (name) => { await p.screenshot({ path: out + name + '.png', timeout: 240000 }); console.log('wrote', out + name + '.png'); };
  if (what === 'title') { await p.waitForTimeout(1500); await shot(''); }
  if (what === 'day' || what === 'phone') {
    await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForTimeout(3000);
    await p.evaluate(async () => { const g = window.__game, d = g.run.dormant[0]; g.setTown(d.x + 5, d.z + 0.5); g.setYaw(Math.atan2(5, 0.5)); g.setPitch(0); });
    await p.waitForTimeout(phone ? 2500 : 6000); await shot(phone ? '_town' : '');
  }
  if (what === 'phone') { await p.evaluate(() => { window.__game.enterHouse(0); }); await p.waitForTimeout(3000); await shot('_day'); }
  if (what === 'night' || what === 'phone') {
    if (what === 'night') { await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await p.waitForTimeout(2500); }
    await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(1500);
    // let the first machines come in (game time runs slowly in the software renderer): skip the clock forward
    await p.evaluate(() => { const s = window.__game.sim; s.t = 40; s.player.energy = 20; }); await p.waitForTimeout(phone ? 4000 : 9000);
    await p.evaluate(() => { const g = window.__game; g.marlaSay ? 0 : 0; document.getElementById('marla').textContent = document.getElementById('marla').textContent || 'Sun is down, Potts. Turbine first, then lances, then panels.'; });
    await p.keyboard.press('Digit2').catch(() => {}); await p.waitForTimeout(phone ? 1000 : 3000); await shot(phone ? '_night' : '');
  }
  console.log(errs.length ? 'PAGE ERRORS ' + errs.slice(0, 3).join(' | ') : 'NO ERRORS'); await b.close();
})();
