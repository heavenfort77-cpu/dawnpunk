// first-day solar rule and the device landing: a new game's first house cannot be left or ended by DUSK until a collector is up, and the day clock waits;
// a placed device is not drawn until the thrown pod lands. Usage: node tools/solarcheck.cjs   (pass/fail lines)
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 915, height: 412 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); let bad = 0;
  const ok = (c, t) => { console.log((c ? 'PASS ' : 'FAIL ') + t); if (!c) bad++; };
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=low'); await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } }); await p.reload(); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); }); await p.waitForTimeout(2000);
  await p.evaluate(() => window.__game.enterHouse(0)); await p.waitForTimeout(1500);
  const t0 = await p.evaluate(() => window.__game.sim.dayT); await p.waitForTimeout(2500); const t1 = await p.evaluate(() => window.__game.sim.dayT);
  ok(Math.abs(t1 - t0) < 0.2, 'day clock waits before the first collector (' + t0.toFixed(1) + ' -> ' + t1.toFixed(1) + ')');
  await p.evaluate(() => window.__game.leaveHouse()); await p.waitForTimeout(300); ok(await p.evaluate(() => !!window.__game.sim), 'LEAVE is blocked');
  ok((await p.evaluate(() => document.getElementById('msg').textContent)).includes('collector'), 'the player is told why');
  await p.keyboard.down('KeyN'); await p.waitForTimeout(1600); await p.keyboard.up('KeyN'); await p.waitForTimeout(300); ok(await p.evaluate(() => window.__game.sim && window.__game.sim.phase === 'day'), 'DUSK hold is blocked');
  // stand so the spot 1.5 m ahead is an opening's inner point, and press Q
  const placed = await p.evaluate(() => { const g = window.__game, s = g.sim; s.player.energy = Math.max(s.player.energy, 20); for (const bp of s.breaches.filter((q) => q.floor === s.player.floor)) { const yaw = Math.atan2(bp.nx, bp.nz); s.player.x = bp.inX + Math.sin(yaw) * 1.5; s.player.z = bp.inZ + Math.cos(yaw) * 1.5; g.setYaw(yaw); s.player.yaw = yaw;
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' })); if (s.devices.some((d) => d.kind === 'collector')) return 1; } return 0; });
  ok(placed, 'a collector can be placed at an opening');
  await p.waitForTimeout(80); const vis0 = await p.evaluate(() => { const s = window.__game.sim, d = s.devices.find((q) => q.kind === 'collector'); return d ? window.__game.devVisible(d.id) : null; });
  await p.waitForTimeout(1500); const vis1 = await p.evaluate(() => { const s = window.__game.sim, d = s.devices.find((q) => q.kind === 'collector'); return d ? window.__game.devVisible(d.id) : null; });
  ok(vis0 === false && vis1 === true, 'the device is drawn only after the throw lands (just after: ' + vis0 + ', 1.5 s later: ' + vis1 + ')');
  const t2 = await p.evaluate(() => window.__game.sim.dayT); await p.waitForTimeout(2000); const t3 = await p.evaluate(() => window.__game.sim.dayT); ok(t3 < t2 - 0.05, 'day clock runs again after the first collector (' + t2.toFixed(1) + ' -> ' + t3.toFixed(1) + ', ' + JSON.stringify(await p.evaluate(() => { const g = window.__game; return { st: g.state, paused: g.paused, kit: g.kitOpen, ph: g.sim.phase, done: g.sim.done }; })) + ')');
  await p.evaluate(() => window.__game.leaveHouse()); await p.waitForTimeout(400); ok(await p.evaluate(() => !window.__game.sim), 'LEAVE works after the first collector');
  ok(await p.evaluate(() => !!window.__game.save.solarDone), 'saved: the rule never comes back');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0].slice(0, 200) : ''));
  await b.close(); console.log(bad ? 'SOME FAILED' : 'ALL PASS'); })();
