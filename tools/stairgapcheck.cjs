// Stair and ladder gap in the browser (owner Nov 18: he stood over the open stair gap upstairs and did not drop). PASS/FAIL lines.
// Usage: node tools/stairgapcheck.cjs [page]   (phone context, low tier: game logic is the same on both tiers)
// In house 0 by day: upstairs over the middle of the stair gap (away from the stair-top marker), then over a ladder-gap corner, then on solid floor.
// Each time: the player must be on the floor below within a second (or stay up on solid floor), the camera must come down to that floor's eye height, and no page error.
const { chromium } = require('playwright');
const path = require('path');
const page0 = process.argv[2] || path.resolve(__dirname, '../dist/index.html');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = [];
  const add = (name, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + name);
  const ctx = await b.newContext({ viewport: { width: 731, height: 304 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => { window.__dtMax = 0.5; try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  await p.goto('file://' + page0 + '?quality=low&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
  await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 2; g.save.talkedMarla = true; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await p.waitForTimeout(2500);
  const L = await p.evaluate(() => window.__game.sim.L); add('house 0 has ' + L + ' floors (needs 2+)', L >= 2);
  const put = (where) => p.evaluate((where) => { const s = window.__game.sim, P = s.player, st = s.stairs[0], l = s.ladders[0]; P.floor = 1; P.climb = null; P.stairCd = 0; P.ladderCd = 0;
    if (where === 'stair') { P.x = (st.bx + st.tx) / 2 - 0.4; P.z = st.bz + 0.1; window.__game.setYaw(Math.atan2(-(st.bx - P.x), -(st.bz - P.z))); window.__game.setPitch(-0.9); }
    else if (where === 'ladder') { P.x = l.x + 0.52; P.z = l.z + 0.52; }
    else { let best = null; for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const d = Math.min(...s.stairs.map((q) => Math.min(Math.hypot(x - q.tx, z - q.tz), Math.hypot(x - q.bx, z - q.bz), Math.hypot(x - (q.bx + q.tx) / 2, z - q.bz))), ...s.ladders.map((q) => Math.hypot(x - q.x, z - q.z))); if (!best || d > best[2]) best = [x, z, d]; } P.x = best[0]; P.z = best[1]; }
    return { x: +P.x.toFixed(2), z: +P.z.toFixed(2) }; }, where);
  const after = () => p.evaluate(() => { const g = window.__game, P = g.sim.player; return { floor: P.floor, camY: +g.cam.position.y.toFixed(2), FH: (typeof g.cfg === 'function' ? g.cfg() : g.cfg).floorH }; });
  for (const [where, down] of [['stair', true], ['ladder', true], ['solid', false]]) {
    const at = await put(where); await p.waitForTimeout(2500); const a = await after();
    const want = down ? 0 : 1, eye = want * a.FH + 1.6;
    add(where + ' at ' + JSON.stringify(at) + ' upstairs: ' + (down ? 'drops to the floor below' : 'stays upstairs') + ' (floor ' + (a.floor + 1) + '), camera at ' + a.camY + ' m (eye height there ' + eye.toFixed(2) + ')', a.floor === want && Math.abs(a.camY - eye) < 0.15);
  }
  add('no page errors' + (errs.length ? ' (' + errs.slice(0, 3).join(' | ') + ')' : ''), !errs.length);
  console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('FAIL')).length; console.log(bad ? bad + ' FAILED' : 'ALL PASS');
  await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
