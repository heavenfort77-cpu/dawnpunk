// Player shadow sample and check (Stage 1, CONFIG.playerShadow, src/playershadow.js). Street by day, seed 777.
// Usage: node tools/playershadowshot.cjs <high|low|lowbody> <out_prefix> [b64]   (lowbody: the desktop body shadow on the phone tier, a cheap local test of the high views)
//   high: views walk (looking down while walking), wall (a sunlit house wall beside you), still (standing, shadow seen at an angle); then the same still view with the body hidden
//         (to prove the shadow only darkens sunlit ground and never adds light), and the frame time of that view with the shadow (?pshadow=1) and without it (?pshadow=0).
//   low:  view blob (standing, looking down at the soft blob), and the frame time with and without.
//   b64: also print every picture as base64 JPEG lines (PSIMG <name> <part> <data>), so the pictures come back through a GitHub job log.
//   timing (4th argument): no pictures; frame time of the still view with and without the shadow, page loads interleaved on, off, on, off.
// Writes <out_prefix><view>_<tier>.jpg. Prints PASS / FAIL / INFO lines.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const arg = process.argv[2] || 'high', tier = arg === 'lowbody' ? 'low' : arg, MODE = arg === 'lowbody' ? 'body' : '1', OUT = process.argv[3] || '/tmp/ps_', B64 = process.argv[4] === 'b64';
const PAGE = 'file://' + path.resolve(__dirname, '../dist/index_single.html');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m), info = (m) => console.log('INFO ' + m);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const VP = tier === 'high' || MODE === 'body' ? { width: 960, height: 600 } : { width: 844, height: 390 };
  async function open(ps) {
    const p = await b.newPage({ viewport: VP }); p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
    await p.goto(PAGE + '?quality=' + tier + '&seed=777&pshadow=' + (ps ? MODE : 0), { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 240000 });
    await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); });
    await p.waitForFunction(() => window.__game.world && window.__game.run, null, { timeout: 240000 });
    await p.evaluate(() => { for (const id of ['hud', 'marla', 'msg', 'mlook', 'bprompt', 'csay']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
    return p;
  }
  // wait n drawn frames
  const frames = (p, n) => p.evaluate((n) => new Promise((res) => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  const frameMs = (p, n) => p.evaluate((n) => new Promise((res) => { const t = []; const f = (now) => { t.push(now); if (t.length > n) { const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]); d.sort((a, c) => a - c); res({ mean: d.reduce((a, c) => a + c, 0) / d.length, median: d[d.length >> 1] }); } else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  const place = (p, x, z, yaw, pitch, fov) => p.evaluate(([x, z, yaw, pitch, fov]) => { const g = window.__game; g.setTown(x, z); g.setYaw(yaw); g.setPitch(pitch); g.cam.fov = fov; g.cam.updateProjectionMatrix(); }, [x, z, yaw, pitch, fov]);
  const shots = [];
  async function shot(p, name) {
    const f = OUT + name + '_' + tier + '.jpg'; await p.screenshot({ path: f, type: 'jpeg', quality: 90, timeout: 300000 }); shots.push([name, f]); info('wrote ' + f);
    if (B64) { const s = fs.readFileSync(f).toString('base64'); for (let i = 0, k = 0; i < s.length; i += 3000, k++) console.log('PSIMG ' + name + ' ' + k + ' ' + s.slice(i, i + 3000)); console.log('PSIMG ' + name + ' end'); }
    return f;
  }
  // a clear stretch of road: away from cars, sleeping machines and Marla's spot
  const clearSpot = (p, len) => p.evaluate((len) => {
    const g = window.__game, r = g.run, G = g.cfg.marla.guide, obs = [...(r.cars || []).map((c) => [c.x, c.z, 4]), ...(r.dormant || []).map((d) => [d.x, d.z, 4]), [G.x, G.z, 4]];
    let best = null; for (let x = -40; x <= 40; x += 2) for (const z of [-2.5, -1, 0, 1, 2.5]) { let d = 99; for (let s = 0; s <= len; s += 0.5) for (const o of obs) d = Math.min(d, Math.hypot(x - s * 0.3 - o[0], z - o[1]) - o[2]); if (!best || d > best.d) best = { x, z, d }; }
    return best; }, len);
  const ps = (p) => p.evaluate(() => window.__pshadow ? window.__pshadow.info() : null);

  if (process.argv[4] === 'timing') {
    const res = { 1: [], 0: [] };
    for (const on of [1, 0, 1, 0]) { const q = await open(on); await frames(q, 4); const I0 = await ps(q), sp0 = await clearSpot(q, 6), sun0 = I0 ? I0.sun : [0.3812, 0.5228, -0.7624], al = Math.atan2(sun0[0], sun0[2]);
      await place(q, sp0.x, sp0.z, al + 0.6, -0.55, 75); await frames(q, 8); const t = await frameMs(q, 12); res[on].push(t.median); info('timing ' + tier + ' pshadow=' + on + ': median ' + t.median.toFixed(1) + ' ms, mean ' + t.mean.toFixed(1) + ' ms'); await q.close(); }
    const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    info('FRAMECOST ' + arg + ' interleaved: with ' + m(res[1]).toFixed(1) + ' ms (' + res[1].map((v) => v.toFixed(0)).join(', ') + '), without ' + m(res[0]).toFixed(1) + ' ms (' + res[0].map((v) => v.toFixed(0)).join(', ') + '), difference ' + (100 * (m(res[1]) / m(res[0]) - 1)).toFixed(1) + '%');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + [...new Set(errs)].join(' | ').slice(0, 600) : '')); await b.close(); return;
  }
  const p = await open(1); await frames(p, 4);
  let I = await ps(p);
  ok(I && I.on && (tier === 'high' || MODE === 'body' ? I.body : I.blob), 'player shadow is on for tier ' + tier + ': ' + JSON.stringify(I));
  // the sun as the shadow uses it (from the light to the ground)
  const sun = I.sun, hx = -sun[0], hz = -sun[2], hl = Math.hypot(hx, hz) || 1, sx = hx / hl, sz = hz / hl, along = Math.atan2(-sx, -sz);
  info('sun direction ' + sun.join(',') + ' (elevation ' + (Math.asin(sun[1]) * 180 / Math.PI).toFixed(1) + ' deg); shadows fall toward ' + sx.toFixed(3) + ',' + sz.toFixed(3));
  const sp = await clearSpot(p, 6); info('clear spot ' + JSON.stringify(sp));
  if (tier === 'high' || MODE === 'body') {
    // 1. looking down while walking (W held), the shadow ahead
    // walk along the road, the shadow falling ahead and a little to the right (start on the far side of the road so the shadow stays on the asphalt)
    const wy = along + 0.45 * Math.sign(sz || 1) * Math.sign(sx || 1); await place(p, sp.x + 1.5, -3.1 * Math.sign(sz || 1), wy, -0.8, 75); await frames(p, 2);
    await p.keyboard.down('KeyW'); await frames(p, 7); I = await ps(p);
    ok(I.speed > 2 && I.amp > 0.9, 'walking: the body walks with the camera (speed ' + I.speed + ' m/s, stride ' + I.amp + ', phase ' + I.phase + ')');
    await shot(p, 'walk'); I = await ps(p); info('walk shot pose ' + JSON.stringify(I)); await p.keyboard.up('KeyW');
    // 3. standing still, the shadow seen at an angle (the body faces 50 degrees off the shadow line)
    await place(p, sp.x, sp.z, along + 0.6, -0.55, 75); await frames(p, 14); I = await ps(p);
    ok(I.amp < 0.05, 'standing: the stride has eased out (stride ' + I.amp + ', speed ' + I.speed + ')');
    await shot(p, 'still');
    // the same frame drawn twice in one go, with and without the body: the difference is the shadow alone
    const cmp = await p.evaluate(() => window.__pshadow.compare()); info('still view, body shown vs hidden (same frame): ' + JSON.stringify(cmp));
    ok(cmp && cmp.dark > 1500, 'the body casts a visible shadow in the still view (' + (cmp && cmp.dark) + ' darker pixels, ' + (cmp ? (100 * cmp.dark / cmp.n).toFixed(2) : 0) + '% of the view, shadow/lit brightness ' + (cmp && cmp.ratio) + ')');
    ok(cmp && cmp.bright === 0, 'the shadow adds no light anywhere (' + (cmp && cmp.bright) + ' brighter pixels)');
    // standing in a house's shadow: the body's shadow must vanish (it only removes sunlight, so nothing doubles)
    const sh = await p.evaluate((sun) => window.__pshadow.findShade(window.__game.world.g, window.__game.run.houses, sun), sun); info('house-shadow spot ' + JSON.stringify(sh));
    if (sh) { await place(p, sh.x, sh.z, along + 0.6, -0.55, 75); await frames(p, 4); const c2 = await p.evaluate(() => window.__pshadow.compare()); info('in a house shadow, body shown vs hidden: ' + JSON.stringify(c2));
      ok(c2 && c2.dark < 0.05 * cmp.dark && c2.bright === 0, 'in a house\'s shadow the body adds no second shadow (' + (c2 && c2.dark) + ' darker pixels against ' + cmp.dark + ' in the sun)'); }
    else info('no house-shadow spot found; the no-doubling test was not run');
    // 2. a sunlit house wall beside you: find a front wall facing the sun, stand 1.1 m off it, look at your shadow on it
    const wall = await p.evaluate((sun) => window.__pshadow.findWall(window.__game.world.g, window.__game.run.houses, sun), sun);
    info('wall pick ' + JSON.stringify(wall));
    if (wall) {
      await place(p, wall.x, wall.z, wall.yaw, wall.pitch, 75); await frames(p, 14); await shot(p, 'wall');
    } else ok(false, 'no sunlit house wall found for the wall view');
    // frame time, same still view, with the shadow
    await place(p, sp.x, sp.z, along + 0.6, -0.55, 75); await frames(p, 6); const tOn = await frameMs(p, 12); I = await ps(p);
    info('frame time with the shadow (?pshadow=1), still view: mean ' + tOn.mean.toFixed(0) + ' ms, median ' + tOn.median.toFixed(0) + ' ms; shadow passes ' + I.passes + ', CPU time in them ' + I.passMs + ' ms (' + (I.passMs / Math.max(1, I.passes)).toFixed(2) + ' ms each)');
    await p.close();
    const q = await open(0); await frames(q, 4); ok(!(await ps(q)), 'with ?pshadow=0 nothing is built');
    await place(q, sp.x, sp.z, along + 0.6, -0.55, 75); await frames(q, 6); const tOff = await frameMs(q, 12);
    info('frame time without the shadow (?pshadow=0), still view: mean ' + tOff.mean.toFixed(0) + ' ms, median ' + tOff.median.toFixed(0) + ' ms');
    info('FRAMECOST ' + arg + ': with ' + tOn.median.toFixed(0) + ' ms, without ' + tOff.median.toFixed(0) + ' ms (median of 12 frames, software renderer, 960x600)');
    await q.close();
  } else {
    // phone: standing, looking down at the blob
    await place(p, sp.x, sp.z, along + 0.9, -1.2, 75); await frames(p, 6); await shot(p, 'blob'); I = await ps(p);
    ok(I.active, 'blob shown in the street ' + JSON.stringify(I));
    const tOn = await frameMs(p, 20); await p.close();
    const q = await open(0); await frames(q, 4); ok(!(await ps(q)), 'with ?pshadow=0 nothing is built');
    await place(q, sp.x, sp.z, along + 0.9, -1.2, 75); await frames(q, 6); const tOff = await frameMs(q, 20);
    info('FRAMECOST low: with ' + tOn.median.toFixed(1) + ' ms, without ' + tOff.median.toFixed(1) + ' ms (median of 20 frames, software renderer, 844x390)');
    await q.close();
  }
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + [...new Set(errs)].join(' | ').slice(0, 600) : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 500)); process.exit(1); });
