// Player shadow sample and check (Stage 1, CONFIG.playerShadow, src/playershadow.js). Street by day, seed 777.
// Usage: node tools/playershadowshot.cjs <high|low|lowbody> <out_prefix> [b64]   (lowbody: the desktop body shadow on the phone tier, a cheap local test of the high views)
//   high: views walk (looking down while walking), wall (a sunlit house wall beside you), still (standing, shadow seen at an angle); then the same still view with the body hidden
//         (to prove the shadow only darkens sunlit ground and never adds light), and the frame time of that view with the shadow (?pshadow=1) and without it (?pshadow=0).
//   low:  view blob (standing, looking down at the soft blob), and the frame time with and without.
//   b64: also print every picture as base64 JPEG lines (PSIMG <name> <part> <data>), so the pictures come back through a GitHub job log.
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
    const f = OUT + name + '_' + tier + '.jpg'; await p.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 300000 }); shots.push([name, f]); info('wrote ' + f); return f;
  }
  // a clear stretch of road: away from cars, sleeping machines and Marla's spot
  const clearSpot = (p, len) => p.evaluate((len) => {
    const g = window.__game, r = g.run, G = g.cfg.marla.guide, obs = [...(r.cars || []).map((c) => [c.x, c.z, 4]), ...(r.dormant || []).map((d) => [d.x, d.z, 4]), [G.x, G.z, 4]];
    let best = null; for (let x = -40; x <= 40; x += 2) for (const z of [-2.5, -1, 0, 1, 2.5]) { let d = 99; for (let s = 0; s <= len; s += 0.5) for (const o of obs) d = Math.min(d, Math.hypot(x - s * 0.3 - o[0], z - o[1]) - o[2]); if (!best || d > best.d) best = { x, z, d }; }
    return best; }, len);
  const ps = (p) => p.evaluate(() => window.__pshadow ? window.__pshadow.info() : null);

  const p = await open(1); await frames(p, 4);
  let I = await ps(p);
  ok(I && I.on && (tier === 'high' || MODE === 'body' ? I.body : I.blob), 'player shadow is on for tier ' + tier + ': ' + JSON.stringify(I));
  // the sun as the shadow uses it (from the light to the ground)
  const sun = I.sun, hx = -sun[0], hz = -sun[2], hl = Math.hypot(hx, hz) || 1, sx = hx / hl, sz = hz / hl, along = Math.atan2(-sx, -sz);
  info('sun direction ' + sun.join(',') + ' (elevation ' + (Math.asin(sun[1]) * 180 / Math.PI).toFixed(1) + ' deg); shadows fall toward ' + sx.toFixed(3) + ',' + sz.toFixed(3));
  const sp = await clearSpot(p, 6); info('clear spot ' + JSON.stringify(sp));
  if (tier === 'high' || MODE === 'body') {
    // 1. looking down while walking (W held), the shadow ahead
    await place(p, sp.x - sx * 2.5, sp.z - sz * 2.5, along, -0.78, 70); await frames(p, 2);
    await p.keyboard.down('KeyW'); await frames(p, 7); I = await ps(p);
    ok(I.speed > 2 && I.amp > 0.9, 'walking: the body walks with the camera (speed ' + I.speed + ' m/s, stride ' + I.amp + ', phase ' + I.phase + ')');
    await shot(p, 'walk'); I = await ps(p); info('walk shot pose ' + JSON.stringify(I)); await p.keyboard.up('KeyW');
    // 3. standing still, the shadow seen at an angle (the body faces 50 degrees off the shadow line)
    await place(p, sp.x, sp.z, along + 0.9, -0.62, 70); await frames(p, 14); I = await ps(p);
    ok(I.amp < 0.05, 'standing: the stride has eased out (stride ' + I.amp + ', speed ' + I.speed + ')');
    const fStill = await shot(p, 'still');
    // the same view with the body hidden: the difference is the shadow alone
    await p.evaluate(() => { window.__pshadow.body.root.scale.setScalar(1e-4); }); await frames(p, 3); const fNone = await shot(p, 'still_nobody');
    await p.evaluate(() => { window.__pshadow.body.root.scale.setScalar(1); }); await frames(p, 2);
    const cmp = await p.evaluate(async ([a, c]) => {
      const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = s; });
      const A = await load(a), C = await load(c), cv = document.createElement('canvas'); cv.width = A.width; cv.height = A.height; const x = cv.getContext('2d', { willReadFrequently: true });
      x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, A.width, A.height).data; x.drawImage(C, 0, 0); const dc = x.getImageData(0, 0, A.width, A.height).data;
      let dark = 0, bright = 0, ratio = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; const L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      for (let i = 0; i < da.length; i += 4) { const la = L(da, i), lc = L(dc, i); if (la < lc - 10) { dark++; ratio += la / Math.max(1, lc); const q = i / 4, px = q % A.width, py = (q / A.width) | 0; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); } else if (la > lc + 10) bright++; }
      return { dark, bright, ratio: dark ? ratio / dark : 0, box: [x0, y0, x1, y1], n: da.length / 4 }; }, ['data:image/jpeg;base64,' + fs.readFileSync(fStill).toString('base64'), 'data:image/jpeg;base64,' + fs.readFileSync(fNone).toString('base64')]);
    info('still view, body shown vs hidden: ' + JSON.stringify(cmp));
    ok(cmp.dark > 1500, 'the body casts a visible shadow in the still view (' + cmp.dark + ' darker pixels, ' + (100 * cmp.dark / cmp.n).toFixed(2) + '% of the view, shadow/lit brightness ' + cmp.ratio.toFixed(2) + ')');
    ok(cmp.bright < cmp.dark * 0.02, 'the shadow adds no light anywhere (' + cmp.bright + ' brighter pixels against ' + cmp.dark + ' darker)');
    // 2. a sunlit house wall beside you: find a front wall facing the sun, stand 1.1 m off it, look at your shadow on it
    const wall = await p.evaluate((sun) => window.__pshadow.findWall(window.__game.world.g, window.__game.run.houses, sun), sun);
    info('wall pick ' + JSON.stringify(wall));
    if (wall) {
      await place(p, wall.x, wall.z, wall.yaw, wall.pitch, 70); await frames(p, 14); await shot(p, 'wall');
    } else ok(false, 'no sunlit house wall found for the wall view');
    // frame time, same still view, with the shadow
    await place(p, sp.x, sp.z, along + 0.9, -0.62, 70); await frames(p, 6); const tOn = await frameMs(p, 12); I = await ps(p);
    info('frame time with the shadow (?pshadow=1), still view: mean ' + tOn.mean.toFixed(0) + ' ms, median ' + tOn.median.toFixed(0) + ' ms; shadow passes ' + I.passes + ', CPU time in them ' + I.passMs + ' ms (' + (I.passMs / Math.max(1, I.passes)).toFixed(2) + ' ms each)');
    await p.close();
    const q = await open(0); await frames(q, 4); ok(!(await ps(q)), 'with ?pshadow=0 nothing is built');
    await place(q, sp.x, sp.z, along + 0.9, -0.62, 70); await frames(q, 6); const tOff = await frameMs(q, 12);
    info('frame time without the shadow (?pshadow=0), still view: mean ' + tOff.mean.toFixed(0) + ' ms, median ' + tOff.median.toFixed(0) + ' ms');
    info('FRAMECOST ' + arg + ': with ' + tOn.median.toFixed(0) + ' ms, without ' + tOff.median.toFixed(0) + ' ms (median of 12 frames, software renderer, 960x600)');
    await q.close();
  } else {
    // phone: standing, looking down at the blob
    await place(p, sp.x, sp.z, along + 0.9, -0.95, 75); await frames(p, 6); await shot(p, 'blob'); I = await ps(p);
    ok(I.active, 'blob shown in the street ' + JSON.stringify(I));
    const tOn = await frameMs(p, 20); await p.close();
    const q = await open(0); await frames(q, 4); ok(!(await ps(q)), 'with ?pshadow=0 nothing is built');
    await place(q, sp.x, sp.z, along + 0.9, -0.95, 75); await frames(q, 6); const tOff = await frameMs(q, 20);
    info('FRAMECOST low: with ' + tOn.median.toFixed(1) + ' ms, without ' + tOff.median.toFixed(1) + ' ms (median of 20 frames, software renderer, 844x390)');
    await q.close();
  }
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + [...new Set(errs)].join(' | ').slice(0, 600) : ''));
  if (B64) for (const [name, f] of shots) { const s = fs.readFileSync(f).toString('base64'); for (let i = 0, k = 0; i < s.length; i += 3000, k++) console.log('PSIMG ' + name + ' ' + k + ' ' + s.slice(i, i + 3000)); }
  await b.close();
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 500)); process.exit(1); });
