const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const S = '/tmp/claude-0/-home-claude/f6d1c949-d179-5fcf-9724-bf18824fc0f0/scratchpad/';
  await p.goto('file:///home/claude/solard-g/dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '1'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__game.setTown(-6, 2.5); window.__game.setYaw(0.9); }); await p.waitForTimeout(500); await p.screenshot({ path: S + 'p1.png' });
  // inside the cat's house: look at the cat, then at a crate
  await p.evaluate(() => { const g = window.__game, r = g.run; g.enterHouse(r.catHouse); const s = g.sim, c = s.cat; s.player.x = c.x * 0.55; s.player.z = c.z * 0.55; g.setYaw(Math.atan2(-(c.x - s.player.x), -(c.z - s.player.z))); }); await p.waitForTimeout(600); await p.screenshot({ path: S + 'p2.png' });
  await p.evaluate(() => { const g = window.__game, s = g.sim, c = s.crates.find(q => q.floor === 0 && !q.got); if (c) { s.player.x = c.x + 1.6; s.player.z = c.z + 0.6; g.setYaw(Math.atan2(-(c.x - s.player.x), -(c.z - s.player.z))); } }); await p.waitForTimeout(400); await p.screenshot({ path: S + 'p3.png' });
  // night: devices down, Gloom coming
  await p.evaluate(() => { const g = window.__game; g.nightfall(); const s = g.sim; s.player.energy = 60; s.player.x = 0; s.player.z = 0; for (const k of ['turbine', 'lance', 'mine']) { s.player.x += 0.9; g.doPlace(k); } }); await p.waitForTimeout(400);
  await p.evaluate(() => { const g = window.__game, s = g.sim; s.player.x = 1.8; s.player.z = 3.2; g.setYaw(0); }); await p.waitForTimeout(600); await p.screenshot({ path: S + 'p4.png' });
  for (let k = 0; k < 40; k++) { const n = await p.evaluate(() => window.__game.sim.gloom.length); if (n > 0) break; await p.waitForTimeout(500); }
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.__game, s = g.sim, q = s.gloom.find(z => z.floor === 0) || s.gloom[0]; if (q) { const dx = q.x - s.player.x, dz = q.z - s.player.z, d = Math.hypot(dx, dz); const fx = -Math.sin(q.yaw || 0), fz = -Math.cos(q.yaw || 0), m = g.sim && [...document.querySelectorAll('x')]; s.player.x = q.x + (s.player.x - q.x) * 0; const tx = s.player.x, tz = s.player.z; s.player.x = q.x + (dx / d) * 0 + (-dx / d) * -3.0; s.player.z = q.z + (-dz / d) * -3.0; g.setYaw(Math.atan2(-(q.x - s.player.x), -(q.z - s.player.z))); } }); await p.waitForTimeout(250); await p.screenshot({ path: S + 'p5.png' });
  await p.evaluate(() => { const g = window.__game, s = g.sim; s.player.energy = 60; g.doPlace('panel'); }); await p.waitForTimeout(300); await p.screenshot({ path: S + 'p6.png' });
  console.log(errs.length ? 'ERRORS ' + errs.slice(0, 3).join(' || ') : 'NO ERRORS'); await b.close();
})();
