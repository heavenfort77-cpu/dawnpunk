// Sample of the uncanny Gloom motion for the owner to judge by eye. Usage: node tools/gloomuncannyshot.cjs <low|high> <strip|video|videoold> <out dir>
// The Walker, the Lantern and the Warden walk out from a house at night toward the camera at their game speeds (1.0, 0.85, 0.6 m/s); the test clock calls each machine's animation 60 times a second.
// strip: 12 frames over 2 s with the old motion (CONFIG.gloomMotion.on = false), then 12 frames over the same 2 s path with the new motion -> <out>/strip_old_NN.png, strip_new_NN.png, plus strip_state.json (which machine was frozen in each frame).
//   The new pass waits (machines standing) until the Lantern starts its first freeze, so the 2 s window shows a hold and a snap.
// video / videoold: 5 s at 24 frames a second, new / old motion -> <out>/vid_NNN.png (join with ffmpeg). Headless software renderer: the pictures are right, the speed is not.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', mode = process.argv[3] || 'strip', out = process.argv[4] || '.';
const CD = mode === 'strip' ? 6.2 : 9.5, FOV = mode === 'strip' ? 62 : 52, KINDS = ['walker', 'lantern', 'warden'], SIDE = [-2.3, 0, 2.5], SPEED = [1.0, 0.85, 0.6];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=' + tier + '&seed=777', { timeout: 180000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__game.enterHouse(0); window.__game.nightfall(); }); await p.waitForTimeout(2500);
  // the spot: 3.2 m outside a ground-floor window, n = straight out from the house; the camera stands 6.2 m further out (9.5 m for the video)
  await p.evaluate(([KINDS, SIDE]) => { const G = window.__game, s = G.sim; s.gloom.length = 0; s.player.hp = 100; const q = s.breaches.find((x) => x.floor === 0 && x.type !== 'door') || s.breaches[0];
    const o = { x: q.x - q.nx * 3.2, z: q.z - q.nz * 3.2, nx: -q.nx, nz: -q.nz }; window.__o = o; window.__ms = [];
    const ry = Math.atan2(o.nx, o.nz) + Math.PI;
    KINDS.forEach((k, i) => { G.gloomSample(k, o.x + o.nz * SIDE[i], o.z - o.nx * SIDE[i], ry, 0, false); window.__ms.push(window.__lastSample); });
    const n = window.CONFIG.quality[G.quality().tier].lights, l0 = G.glights[0];
    if (l0) window.__ms.slice(0, Math.max(n, 3)).forEach((m) => { const l = l0.clone(); l.color.setHex(m.userData.lampColor); l.intensity = window.CONFIG.gloomLook.lightPower; l.distance = window.CONFIG.gloomLook.lightReach; l.position.copy(m.userData.lamp); l.visible = true; m.add(l); }); }, [KINDS, SIDE]);
  // place and animate: n sub-steps of 1/60 s from clock t and walked distance d (seconds of walking); the camera (the player) and its view are set again each time, the night's own Gloom kept away
  // until = 'freeze': stop at the first sub-step where the Lantern is frozen (machines standing). Returns [clock, which machines are frozen]
  const steps = (t, d, n, on, walk, until) => p.evaluate(([t, d, n, on, walk, until, SIDE, SPEED, CD, FOV]) => { const G = window.__game, s = G.sim, o = window.__o; window.CONFIG.gloomMotion.on = on; s.gloom.length = 0; s.player.hp = 100;
    s.player.x = o.x + o.nx * CD + o.nz * 0.1; s.player.z = o.z + o.nz * CD - o.nx * 0.1; G.setYaw(Math.atan2(o.nx, o.nz)); G.setPitch(0.12); G.cam.fov = FOV; G.cam.updateProjectionMatrix(); if (G.hands && G.hands.g) G.hands.g.visible = false;
    G.cam.position.set(s.player.x, 1.6, s.player.z);
    for (let f = 0; f < n; f++) { const tt = t + f / 60, dd = walk ? d + f / 60 : d;
      window.__ms.forEach((m, i) => { const w = dd * SPEED[i], x = o.x + o.nz * SIDE[i] + o.nx * w, z = o.z - o.nx * SIDE[i] + o.nz * w; m.position.set(x, 0, z); m.userData.anim(tt, { x, z }); });
      if (until && window.__ms[1].userData.motion.stats.frozen) return [tt, []]; }
    return [t + (n - 1) / 60, window.__ms.map((m) => (m.userData.motion && m.userData.motion.stats.frozen ? 1 : 0))]; }, [t, d, n, on, walk, until, SIDE, SPEED, CD, FOV]);
  const frame = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // run the clock from t0 for len s, a picture every `every` s (the sub-steps between pictures run in one go)
  const run = async (on, t0, len, every, name) => { const st = [], per = Math.round(every * 60), N = Math.round(len / every); await steps(t0, 0, 1, on, true);
    for (let k = 0; k <= N; k++) { const [, fr] = k ? await steps(t0 + ((k - 1) * per + 1) / 60, ((k - 1) * per + 1) / 60, per, on, true) : await steps(t0, 0, 1, on, true);
      await frame(); await p.screenshot({ path: `${out}/${name}_${String(k).padStart(3, '0')}.png` }); st.push(fr); } return st; };
  const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
  if (mode === 'strip') {
    const sOld = await run(false, 100, 2 - 1 / 6, 1 / 6, 'strip_old');
    // new: stand still (no walking) until the Lantern begins a freeze, then the same 2 s path
    const [t] = await steps(200, 0, 60 * 30, true, false, true);
    const sNew = await run(true, t, 2 - 1 / 6, 1 / 6, 'strip_new');
    fs.writeFileSync(out + '/strip_state.json', JSON.stringify({ kinds: KINDS, old: sOld, new: sNew }));
  } else { await run(mode === 'video', 300, 5, 1 / 24, 'vid'); }
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join('|').slice(0, 600) : 'NO ERRORS'); await b.close();
})();
