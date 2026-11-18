// Player shadow check, Stage 2 (CONFIG.playerShadow, src/playershadow.js; on by default since the owner approved the sample Nov 18 15:37). PASS / FAIL / INFO lines.
// Usage: node tools/playershadowcheck.cjs <high|low> [abs page] [out_prefix]   (high = desktop body shadow, low = phone blob; out_prefix: a few JPEG views)
// No ?pshadow in the address: it must be on by default. Seed 777, the night-1 drill skipped.
//   1. the opening film: no shadow body and no blob anywhere in it; the shadow is there once the film ends in the base
//   2. the base: on the ground and on a footbridge deck (the body / blob stands on the deck)
//   3. the street by day: high: the body shadow is there, only darkens (0 brighter pixels), moves with you when you walk, adds nothing inside a house's shadow; low: the blob darkens under you
//   4. a house by day: floors 1 and 2, up and down the stairs, a drop through the stair gap, a ladder climb: every frame the feet stand on the floor the game has you on
//      (never under it, never floating), the blob shows only once the view has settled over that floor, and it hides on the ladder
//   5. night: high: the sun is down to a few percent, so the body shadow is nearly invisible; low: the blob stays
//   6. no page errors
const { chromium } = require('playwright');
const path = require('path');
const tier = process.argv[2] === 'low' ? 'low' : 'high', HI = tier === 'high';
const PAGE = 'file://' + (process.argv[3] || path.resolve(__dirname, '../dist/index_single.html')), OUT = process.argv[4] || '';
const res = []; const ok = (c, m) => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + m); }, info = (m) => console.log('INFO ' + m);
const J = (o) => JSON.stringify(o);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  async function open() {
    const ctx = await b.newContext(HI ? { viewport: { width: 640, height: 400 } } : { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
    await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
    await p.goto(PAGE + '?quality=' + tier + '&seed=777', { timeout: 600000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 600000 });
    return p;
  }
  const frames = (p, n) => p.evaluate((n) => new Promise((r) => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  // n frames and at least ms of real time (the view eases over about half a second; fast and slow renderers both get there)
  const settle = async (p, n, ms) => { await frames(p, n); await p.waitForTimeout(ms || 900); await frames(p, 2); };
  const ps = (p) => p.evaluate(() => (window.__pshadow ? window.__pshadow.info() : null));
  const cmp = (p) => p.evaluate(() => window.__pshadow.compare());
  const hideHud = (p) => p.evaluate(() => { for (const id of ['hud', 'marla', 'msg', 'mlook', 'bprompt', 'csay']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
  async function shot(p, name) { if (!OUT) return; const f = OUT + name + '_' + tier + '.jpg'; await p.screenshot({ path: f, type: 'jpeg', quality: 85, timeout: 300000 }); info('wrote ' + f); }
  const C = { lift: 0.1, settle: 0.35, eyeFwd: 0.08, FH: 3.2 };

  // ---- 1. the opening film
  let p = await open();
  Object.assign(C, await p.evaluate(() => { const c = (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg), P = c.playerShadow; return { lift: P.blob.lift, settle: P.blob.settle, eyeFwd: P.motion.eyeFwd, FH: c.floorH, parts: c.opening.parts, bridges: (c.baseWater && c.baseWater.bridges) || [] }; }));
  await p.evaluate(() => { window.__dtMax = 0.15; window.__game.startIntro(); });
  await frames(p, 3);
  const film = [];
  for (const t of [4, 12, 22, 36, 50, C.parts[4] - 4]) {
    await p.evaluate((t) => window.__game.introAt(t), t); await frames(p, 3);
    const r = await p.evaluate((hi) => { const g = window.__game, I = window.__pshadow.info(), c = hi ? window.__pshadow.compare() : null; return { t: 0, state: g.state, active: I.active, bodyVis: I.bodyVis, blobVis: I.blobVis, psI: I.psI, dark: c ? c.dark : 0 }; }, HI); r.t = t; film.push(r);
  }
  info('film ' + J(film));
  ok(film.every((r) => r.state === 'intro') && film.every((r) => !r.active && !r.bodyVis && !r.blobVis && !r.psI && r.dark === 0), 'the opening film shows no shadow body and no blob (' + film.length + ' points from ' + film[0].t + ' s to ' + film[film.length - 1].t + ' s: shadow off, ' + (HI ? 'the body darkens 0 pixels even when forced visible' : 'blob hidden') + ')');
  await p.evaluate(() => { window.__dtMax = 0.5; (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).lore.jobCardSecs = 600; window.__game.introAt((typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).opening.parts[4] - 0.2); });
  await p.waitForFunction(() => window.__game.state === 'base', null, { timeout: 300000 }).catch(() => {}); await frames(p, 4);
  let I = await ps(p); ok(I && I.active && (HI ? I.bodyVis : I.blobOn), 'after the film, standing in the base, the shadow is on ' + J({ state: await p.evaluate(() => window.__game.state), active: I && I.active, bodyVis: I && I.bodyVis, blobOn: I && I.blobOn, feet: I && I.feet }));
  await p.close();

  // ---- 2. the base: on by default, ground and a footbridge deck
  p = await open(); await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); }); await settle(p, 6); await hideHud(p);
  I = await ps(p);
  ok(I && I.on && (HI ? I.body && !I.blob : I.blob && !I.body), 'on by default (no ?pshadow): ' + (HI ? 'desktop body shadow' : 'phone blob') + ' ' + J(I && { on: I.on, tier: I.tier, body: I.body, blob: I.blob, map: I.map }));
  const camY = () => p.evaluate(() => window.__game.cam.position.y);
  // the feet stand on the floor y: the body (desktop) or the blob (phone) is there, the view has settled 1.6 m above it
  const standsOn = async (y, where) => { const I2 = await ps(p), cy = await camY(); const good = Math.abs(I2.feet - y) < 0.02 && Math.abs(cy - 1.6 - y) < 0.1 && (HI ? I2.bodyVis && I2.at[1] <= y + 0.005 && I2.at[1] >= y - 0.05 : I2.blobOn && Math.abs(I2.blobAt[1] - y - C.lift) < 0.005);
    ok(good, where + ': the ' + (HI ? 'body' : 'blob') + ' stands on the floor at ' + y.toFixed(2) + ' m ' + J({ feet: I2.feet, eye: +cy.toFixed(3), at: HI ? I2.at : I2.blobAt, shown: HI ? I2.bodyVis : I2.blobOn })); return I2; };
  I = await standsOn(0, 'base ground');
  if (HI) { const c = await cmp(p); info('base, body shown vs hidden ' + J(c)); ok(c && c.bright === 0, 'base: the shadow adds no light (' + (c && c.bright) + ' brighter pixels, ' + (c && c.dark) + ' darker)'); }
  else { const c = await cmp(p); ok(c && c.bright === 0, 'base: the blob adds no light (' + (c && c.bright) + ' brighter pixels, ' + (c && c.dark) + ' darker)'); }
  // a footbridge: walk the deck's spots near the bridge's point until the game puts the view over the deck
  let deck = null;
  for (const [bx, bz] of C.bridges.slice(0, 1)) for (const [dx, dz] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (deck) break; await p.evaluate(([x, z]) => window.__game.setBase(x, z), [bx + dx, bz + dz]); await settle(p, 6); const I2 = await ps(p); if (I2.feet > 0.1) deck = [bx + dx, bz + dz, I2.feet];
  }
  if (deck) { await p.evaluate(([x, z]) => { window.__game.setPitch(-1.1); window.__game.setBase(x, z); }, deck); await frames(p, 4); await standsOn(deck[2], 'footbridge deck at ' + deck[0] + ',' + deck[1]); await shot(p, 'deck'); }
  else ok(!C.bridges.length, 'a footbridge deck was found to stand on (bridges ' + J(C.bridges) + ')');

  // ---- 3. the street by day
  await p.evaluate(() => { const g = window.__game; g.save.nights = 2; g.save.talkedMarla = true; document.getElementById('selRing').value = '0'; g.startRun(); });
  await p.waitForFunction(() => window.__game.world && window.__game.run && window.__game.state === 'play', null, { timeout: 300000 }); await frames(p, 4); await hideHud(p);
  I = await ps(p);
  const sun = I.sun, hx = -sun[0], hz = -sun[2], hl = Math.hypot(hx, hz) || 1, along = Math.atan2(hx / hl, hz / hl) + Math.PI, daySun = I.sunI;
  info('sun ' + J(sun) + ' intensity ' + daySun);
  const spot = await p.evaluate(() => { const g = window.__game, r = g.run, G = (typeof g.cfg === 'function' ? g.cfg() : g.cfg).marla.guide, obs = [...(r.cars || []).map((c) => [c.x, c.z, 4]), ...(r.dormant || []).map((d) => [d.x, d.z, 4]), [G.x, G.z, 4]];
    let best = null; for (let x = -40; x <= 40; x += 2) for (const z of [-2.5, -1, 0, 1, 2.5]) { let d = 99; for (let s = 0; s <= 6; s += 0.5) for (const o of obs) d = Math.min(d, Math.hypot(x - s * 0.3 - o[0], z - o[1]) - o[2]); if (!best || d > best.d) best = { x, z, d }; } return best; });
  const place = (x, z, yaw, pitch) => p.evaluate(([x, z, yaw, pitch]) => { const g = window.__game; g.setTown(x, z); g.setYaw(yaw); g.setPitch(pitch); }, [x, z, yaw, pitch]);
  await place(spot.x, spot.z, along + 0.6, -0.55); await settle(p, 8);
  I = await standsOn(0, 'street');
  const c1 = await cmp(p); info('street still view, shown vs hidden ' + J(c1));
  if (HI) {
    ok(c1 && c1.dark > 0.005 * c1.n, 'street by day: the body casts a visible shadow (' + (c1 && c1.dark) + ' darker pixels, ' + (c1 ? (100 * c1.dark / c1.n).toFixed(2) : 0) + '% of the view)');
    ok(c1 && c1.bright === 0, 'street by day: the shadow only darkens (' + (c1 && c1.bright) + ' brighter pixels)');
    await shot(p, 'street');
    // walking: the body walks with the view and its shadow is still there at the new spot
    const at0 = I.at; await p.evaluate(() => window.__game.setYaw(window.__game.yaw - 0.6)); await p.keyboard.down('KeyW'); for (let k = 0; k < 60; k++) { await frames(p, 2); const q = await ps(p); if (Math.hypot(q.at[0] - at0[0], q.at[2] - at0[2]) > 1.5) break; } const Iw = await ps(p); const camW = await p.evaluate(() => window.__game.cam.position.toArray()); await p.keyboard.up('KeyW');
    const moved = Math.hypot(Iw.at[0] - at0[0], Iw.at[2] - at0[2]), off = Math.hypot(Iw.at[0] - camW[0], Iw.at[2] - camW[2]);
    ok(Iw.speed > 2 && Iw.amp > 0.9 && moved > 1 && off <= C.eyeFwd + 0.02, 'walking: the body moves with you (' + moved.toFixed(2) + ' m, ' + off.toFixed(3) + ' m behind the eye, speed ' + Iw.speed + ' m/s, stride ' + Iw.amp + ')');
    await settle(p, 12); const c2 = await cmp(p); I = await ps(p);
    ok(c2 && c2.dark > 0.005 * c2.n && c2.bright === 0 && I.amp < 0.1, 'after the walk: the shadow is there at the new spot and the stride has eased out (' + (c2 && c2.dark) + ' darker, ' + (c2 && c2.bright) + ' brighter pixels, stride ' + I.amp + ')');
    // in a house's shadow nothing doubles
    const sh = await p.evaluate((sun) => window.__pshadow.findShade(window.__game.world.g, window.__game.run.houses, sun), sun); info('house-shadow spot ' + J(sh));
    if (sh) { await place(sh.x, sh.z, along + 0.6, -0.55); await settle(p, 6); const c3 = await cmp(p); ok(c3 && c3.dark < 0.05 * c1.dark && c3.bright === 0, 'in a house\'s shadow the body adds no second shadow (' + (c3 && c3.dark) + ' darker pixels against ' + c1.dark + ' in the sun, ' + (c3 && c3.bright) + ' brighter)'); }
    else info('no house-shadow spot found; the no-doubling test was not run');
  } else {
    await p.evaluate(() => window.__game.setPitch(-1.2)); await frames(p, 4); const c = await cmp(p);
    ok(c && c.dark > 0.002 * c.n && c.bright === 0, 'street: the blob darkens the ground under you and adds no light (' + (c && c.dark) + ' darker, ' + (c && c.bright) + ' brighter pixels)');
    await shot(p, 'street');
    const at0 = I.blobAt; await p.keyboard.down('KeyW'); for (let k = 0; k < 60; k++) { await frames(p, 2); const q = await ps(p); if (Math.hypot(q.blobAt[0] - at0[0], q.blobAt[2] - at0[2]) > 1) break; } await p.keyboard.up('KeyW'); await frames(p, 2); const I2 = await ps(p), cw = await p.evaluate(() => window.__game.cam.position.toArray());
    ok(Math.hypot(I2.blobAt[0] - at0[0], I2.blobAt[2] - at0[2]) > 0.5 && Math.hypot(I2.blobAt[0] - cw[0], I2.blobAt[2] - cw[2]) < 0.01 && I2.blobOn, 'walking: the blob stays under you ' + J({ from: at0, to: I2.blobAt, eye: cw.map((q) => +q.toFixed(3)) }));
  }

  // ---- 4. a house by day: floors, stairs, the stair gap, the ladder
  await p.evaluate(() => window.__game.enterHouse(0)); await p.waitForFunction(() => window.__game.sim && window.__game.state === 'play', null, { timeout: 300000 }); await frames(p, 6); await hideHud(p);
  const L = await p.evaluate(() => window.__game.sim.L); ok(L >= 2, 'house 0 has ' + L + ' floors (needs 2+)');
  // a spot on floor f away from the stairs and ladders
  const solid = (f) => p.evaluate((f) => { const s = window.__game.sim, P = s.player; let best = null; for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const d = Math.min(...s.stairs.map((q) => Math.min(Math.hypot(x - q.tx, z - q.tz), Math.hypot(x - q.bx, z - q.bz), Math.hypot(x - (q.bx + q.tx) / 2, z - q.bz))), ...s.ladders.map((q) => Math.hypot(x - q.x, z - q.z))); if (!best || d > best[2]) best = [x, z, d]; }
    P.floor = f; P.climb = null; P.x = best[0]; P.z = best[1]; P.stairCd = 1; P.ladderCd = 1; window.__game.setPitch(-1.0); return best; }, f);
  for (const f of [0, 1]) { const at = await solid(f); await settle(p, 10); await standsOn(f * C.FH, 'house floor ' + (f + 1) + ' at ' + J(at.slice(0, 2)));
    const c = await cmp(p); ok(c && c.bright === 0, 'house floor ' + (f + 1) + ': the shadow adds no light (' + (c && c.bright) + ' brighter, ' + (c && c.dark) + ' darker pixels)'); if (f === 1) await shot(p, 'floor2'); }
  // every frame of a move: what the game says (floor, ladder) against what the shadow shows
  const watch = (n, ms) => p.evaluate(([n, ms]) => new Promise((r) => { const out = [], t0 = performance.now(); const f = () => { const g = window.__game, P = g.sim.player, I = window.__pshadow.info(); out.push({ floor: P.floor, climb: !!P.climb, eye: g.cam.position.y, feet: I.feet, hang: I.hang, blobOn: I.blobOn, blobY: I.blobAt ? I.blobAt[1] : null, atY: I.at ? I.at[1] : null, bodyVis: I.bodyVis }); if ((out.length >= n && performance.now() - t0 >= ms) || out.length >= 600) r(out); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), [n, ms]);
  const judge = (fr, name, endFloor, needClimb) => {
    const bad = []; let climbN = 0, hidden = 0;
    for (const [i, q] of fr.entries()) {
      if (q.climb) { climbN++; if (!q.hang || q.blobOn) bad.push(i + ': on the ladder the blob must hide ' + J(q)); if (HI && Math.abs(q.atY - (q.eye - 1.6)) > 0.05) bad.push(i + ': on the ladder the body hangs at the view ' + J(q)); continue; }
      if (Math.abs(q.feet - q.floor * C.FH) > 0.01) bad.push(i + ': feet off the floor ' + J(q));
      if (HI && (q.atY > q.feet + 0.005 || q.atY < q.feet - 0.05)) bad.push(i + ': body not on the floor ' + J(q));
      if (q.blobOn && (Math.abs(q.eye - 1.6 - q.feet) > C.settle + 0.01 || Math.abs(q.blobY - q.feet - C.lift) > 0.005)) bad.push(i + ': blob shown off its floor ' + J(q));
      if (!HI && !q.blobOn) hidden++;
    }
    const last = fr[fr.length - 1];
    ok(!bad.length, name + ': ' + fr.length + ' frames, the ' + (HI ? 'body' : 'blob') + ' follows the floor the game has you on' + (HI ? '' : ' (hidden while the view settles in ' + hidden + ' frames)') + (bad.length ? ' | ' + bad.slice(0, 3).join(' | ') : ''));
    ok(last.floor === endFloor && !last.climb && (HI ? last.bodyVis : last.blobOn) && (!needClimb || climbN > 0), name + ': ends on floor ' + (last.floor + 1) + ' (want ' + (endFloor + 1) + ')' + (needClimb ? ', ' + climbN + ' frames on the ladder' : '') + ', shadow shown ' + J(last));
  };
  const put = (f, where) => p.evaluate(([f, where]) => { const s = window.__game.sim, P = s.player, st = s.stairs[0], l = s.ladders[0]; P.floor = f; P.climb = null; P.stairCd = 0; P.ladderCd = 0;
    if (where === 'stairUp') { P.x = st.bx; P.z = st.bz; } else if (where === 'stairDown') { P.x = st.tx; P.z = st.tz; } else if (where === 'gap') { P.stairCd = 5; P.x = (st.bx + st.tx) / 2 - 0.4; P.z = st.bz + 0.1; } else if (where === 'ladder') { P.stairCd = 5; P.x = l.x; P.z = l.z; } return { x: P.x, z: P.z }; }, [f, where]);
  if (L >= 2) {
    const moves = [['stairs up', 0, 'stairUp', 1, false, 20, 1500], ['stairs down', 1, 'stairDown', 0, false, 20, 1500], ['the stair gap upstairs (drop)', 1, 'gap', 0, false, 20, 1500], ['ladder climb', 0, 'ladder', 1, true, 30, 2600]];
    for (const [name, f, where, end, climb, n, ms] of moves) { const at = await put(f, where); const fr = await watch(n, ms); info(name + ' from ' + J(at) + ': eye ' + fr.map((q) => q.eye.toFixed(2)).join(' ')); judge(fr, name, end, climb); await frames(p, 6); }
  }

  // ---- 5. night
  await solid(0); await p.evaluate(() => window.__game.nightfall()); let night = null;
  for (let k = 0; k < 12; k++) { await settle(p, 6, 500); night = await ps(p); if (night.sunI <= 0.08 * daySun) break; }
  if (HI) {
    ok(night.sunI <= 0.1 * daySun && night.psI > 0, 'night: the sun is down to ' + (100 * night.sunI / daySun).toFixed(1) + '% of the day\'s, so the body shadow (still on) takes away almost nothing ' + J({ day: daySun, night: night.sunI, psI: night.psI }));
    const c = await cmp(p); ok(c && c.bright === 0, 'night: the shadow adds no light (' + (c && c.bright) + ' brighter, ' + (c && c.dark) + ' darker pixels)');
  } else {
    I = await ps(p); const cy = await camY(); ok(I.blobOn && Math.abs(I.blobAt[1] - I.feet - C.lift) < 0.005 && Math.abs(cy - 1.6 - I.feet) < 0.1, 'night: the blob stays under you ' + J({ blobOn: I.blobOn, at: I.blobAt, feet: I.feet, state: await p.evaluate(() => window.__game.state) }));
    await shot(p, 'night');
  }
  await p.close();
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + [...new Set(errs)].join(' | ').slice(0, 600) : ''));
  const bad = res.filter((v) => !v).length; console.log(bad ? bad + ' FAILED' : 'ALL PASS');
  await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 500)); process.exit(1); });
