// Desktop mouse look: one click asks for the pointer and the mouse then turns the view with no button held, the left button fires, pausing lets the pointer go; phones never ask for it.
// The headless test browser runs out of memory while it really holds the pointer (even on a blank page: tools/pltest.cjs; tools/memcheck.cjs <q> lock), so this test sets the game's
// test-only window.__fakeLock: the game pretends to hold the pointer and counts the requests it would have made. A real browser holds it normally. Usage: node tools/mousecheck.cjs [high|low]
const { chromium, devices } = require('playwright');
(async () => { const q = process.argv[2] || 'high'; const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(() => { window.__fakeLock = false; }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + q, { timeout: 180000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
  await p.evaluate(() => window.__game.enterBase()); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('mlook')).display) === 'block', 'the base shows "Click to look with the mouse"');
  await p.mouse.click(640, 300); await p.waitForTimeout(600); ok(await p.evaluate(() => window.__game.mouseHeld && window.__lockAsks >= 1), 'one click asks the browser for the pointer');
  const y0 = await p.evaluate(() => window.__game.yaw); await p.evaluate(() => dispatchEvent(new MouseEvent('mousemove', { movementX: 90, movementY: 10 }))); await p.waitForTimeout(300); const y1 = await p.evaluate(() => window.__game.yaw);
  ok(Math.abs(y1 - y0) > 0.05, 'moving the mouse turns the view with no button held (' + y0.toFixed(2) + ' -> ' + y1.toFixed(2) + ')');
  await p.evaluate(() => { const g = window.__game; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); g.endDay(); }); await p.waitForTimeout(3000);
  if (!(await p.evaluate(() => window.__game.mouseHeld))) { await p.mouse.click(640, 300); await p.waitForTimeout(600); }
  ok(await p.evaluate(() => window.__game.mouseHeld), 'the pointer is held at night');
  const e0 = await p.evaluate(() => window.__game.sim.player.energy); await p.waitForTimeout(900); await p.mouse.down(); await p.waitForTimeout(120); await p.mouse.up(); await p.waitForTimeout(600); const e1 = await p.evaluate(() => window.__game.sim.player.energy);
  ok(e1 < e0, 'with the pointer held, the left button fires (energy ' + e0.toFixed(1) + ' -> ' + e1.toFixed(1) + ')');
  await p.keyboard.press('KeyP'); await p.waitForTimeout(600); ok(!(await p.evaluate(() => window.__game.mouseHeld)), 'pausing lets the pointer go');
  const p2 = await (await b.newContext({ ...devices['Pixel 7 landscape'] })).newPage(); await p2.addInitScript(() => { window.__fakeLock = false; }); await p2.goto('file://' + __dirname + '/../dist/index_single.html?seed=777', { timeout: 180000 }); await p2.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 180000 });
  await p2.evaluate(() => window.__game.enterBase()); await p2.waitForTimeout(1500); await p2.tap('#c').catch(() => {}); await p2.waitForTimeout(500); ok(!(await p2.evaluate(() => window.__lockAsks || 0)), 'a phone never asks for the pointer');
  ok(!errs.length, 'no page errors ' + errs.join('|').slice(0, 200)); console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); })();
