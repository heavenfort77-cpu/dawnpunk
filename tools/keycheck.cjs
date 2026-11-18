// drill (Nov 17 18:28): the night-1 drill is skipped here (tools/drillcheck.cjs tests it)
// Desktop controls in the manner of a PC shooter (owner, Nov 16): Space fires, 1 to 5 PICK a device without placing it, the wheel cycles, the right button places, F eats, E leaves at the door;
// the big FIRE button is gone on a mouse-and-keyboard screen and the picked slot is lit; phones keep the touch buttons and no key badges. Usage: node tools/keycheck.cjs [screenshot.png]
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); await p.addInitScript(() => { try { localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  await p.goto('file://' + __dirname + '/../dist/index_single.html?seed=777&fx=0'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); g.endDay(); }); await p.waitForTimeout(1800);
  const en = () => p.evaluate(() => window.__game.sim.player.energy), nd = () => p.evaluate(() => window.__game.sim.devices.length), sel = () => p.evaluate(() => { const e = document.querySelector('.b.sel'); return e ? e.id : null; });
  let e0 = await en(); await p.keyboard.press('Space'); await p.waitForTimeout(500); let e1 = await en(); ok(e1 < e0, 'Space fires (energy ' + e0.toFixed(1) + ' -> ' + e1.toFixed(1) + ')');
  const n0 = await nd(); await p.keyboard.press('Digit2'); await p.waitForTimeout(1200); { const w = await sel(), n = await nd(); ok(w === 'b2' && n === n0, '2 picks the second device and places nothing (lit: ' + w + ', devices ' + n0 + ' -> ' + n + ')'); }
  await p.mouse.move(640, 300); await p.mouse.wheel(0, 100); for (let k = 0; k < 25 && await sel() !== 'b3'; k++) await p.waitForTimeout(200); { const w = await sel(); ok(w === 'b3', 'the wheel moves to the next device (lit: ' + w + ')'); }
  await p.evaluate(() => { const s = window.__game.sim; s.player.energy = 30; const bp = s.breaches.find((q) => q.floor === s.player.floor); if (bp) { s.player.x = bp.inX; s.player.z = bp.inZ; } }); await p.keyboard.press('Digit1'); await p.waitForTimeout(200);
  const n1 = await nd(); e0 = await en(); await p.mouse.click(640, 300, { button: 'right' }); await p.waitForTimeout(600); const n2 = await nd(); e1 = await en(); ok(n2 === n1 + 1 || e1 < e0, 'the right button places the picked device (devices ' + n1 + ' -> ' + n2 + ', energy ' + e0.toFixed(0) + ' -> ' + e1.toFixed(0) + ')');
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('bFire')).display) === 'none', 'desktop has no big FIRE button');
  ok(/Left click/.test(await p.evaluate(() => getComputedStyle(document.getElementById('dkeys')).display === 'block' ? document.getElementById('dkeys').textContent : '')), 'desktop shows the key legend');
  if (process.argv[2]) await p.screenshot({ path: process.argv[2] });
  const p2 = await (await b.newContext({ ...devices['Pixel 7 landscape'] })).newPage(); await p2.goto('file://' + __dirname + '/../dist/index_single.html?fx=0'); await p2.waitForFunction(() => window.__game);
  const ph = await p2.evaluate(() => [getComputedStyle(document.getElementById('bFire'), '::after').content, getComputedStyle(document.getElementById('dkeys')).display, getComputedStyle(document.getElementById('bFire')).width]); ok(ph[0] === 'none' && ph[1] === 'none' && ph[2] === '96px', 'phone keeps its touch buttons, no key badges, no legend (' + ph.join(', ') + ')');
  ok(!errs.length, 'no page errors ' + errs.join('|').slice(0, 200)); console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); })();
