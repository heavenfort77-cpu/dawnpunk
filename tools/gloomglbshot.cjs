// Pictures of the desktop Walker from its Blender model next to the builder's Walker, from the exact build (dist/index_single.html, desktop tier).
// Usage: node tools/gloomglbshot.cjs <out dir> [views] [kind] [which]   views: comma list of day, night, head, leg, walk (default all); kind: walker (default) or lurcher;
// which: both (default: builder and model), new (model only) or old (builder only). PAGE=<file> shoots another build of the page (e.g. one carrying an earlier model).
// day: about 3 m away on the street; night: seen from inside house 0 through a ground-floor window (the Ticks: through the doorway, looking down at the road), the machine 2.6 m outside it with its own light, as the game lights it;
// head / leg: close-ups; each of these twice, old = builder (CONFIG.quality.high.gloom.models[kind] false), new = model -> <out>/<view>_old.png, <view>_new.png.
// walk: the model walking toward the camera at 1 m/s with the uncanny motion on, a picture every 0.25 s -> <out>/walk_NN.png. Join with tools/gloomglbjoin.py.
// Waits until no other headless browser runs (this machine has little memory). Software renderer: right pictures, wrong speed.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const out = process.argv[2] || '.', V = (process.argv[3] || 'day,night,head,leg,walk').split(','), KIND = process.argv[4] || 'walker', WHICH = process.argv[5] || 'both';
const PAGE = 'file://' + (process.env.PAGE || __dirname + '/../dist/index_single.html') + '?quality=high&seed=777&gloomglb=' + KIND, GLBS = WHICH === 'new' ? [true] : WHICH === 'old' ? [false] : [false, true];
// close-up cameras per kind: [x, z offsets from the machine, yaw, target height, distance for the pitch]
const HEADCAM = { walker: [0.25, 0.95, 0.25, 2.05, 0.95], lurcher: [0.47, 1.45, 0.17, 1.72, 0.9], ticks: [0.3, 1.0, 0.25, 0.4, 1.0], hauler: [0.4, 1.5, 0.2, 2.02, 1.4], stilt: [0.3, 1.6, 0.15, 3.07, 1.5], lantern: [0.45, 1.5, 0.17, 1.9, 1.0], warden: [0.3, 1.8, 0.12, 2.25, 1.7] }[KIND];
// day view aim height and leg close-up [aim height, distance, fov] per kind (the Ticks are low: the 'leg' view looks at their wheels and bristles)
const DAYY = { ticks: 0.35, stilt: 1.85, lantern: 1.25, warden: 1.5 }[KIND] || 2.15 * 0.52, LEGCAM = { ticks: [0.12, 1.3, 38] }[KIND] || [0.45, 2.0, 38];
const busy = () => { try { return +execFileSync('pgrep', ['-c', '-f', 'chrome-headless']).toString().trim(); } catch (e) { return 0; } };
(async () => {
  while (busy() > 0) await new Promise((r) => setTimeout(r, 400));
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 800, height: 760 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
  await p.addInitScript(() => { window.__dtMax = 1.5; });
  await p.goto(PAGE, { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 300000 });
  await p.waitForFunction((KIND) => window.__gloomGlb && window.__gloomGlb[KIND] && window.__gloomGlb[KIND] !== 'loading', KIND, { timeout: 120000 });
  console.log('model', await p.evaluate((k) => window.__gloomGlb[k], KIND));
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  // one walker, old or new, at x, z facing ry, posed at clock t; the previous one is taken away
  const stand = (glb, x, z, ry, t, light) => p.evaluate(([glb, x, z, ry, t, light, K]) => { const g = window.__game; if (window.__w) { window.__w.parent.remove(window.__w); window.__w = null; }
    window.CONFIG.quality.high.gloom.models[K] = glb; g.gloomSample(K, x, z, ry, t, false); const o = window.__w = window.__lastSample; window.CONFIG.quality.high.gloom.models[K] = true;
    let n = 0; o.traverse((q) => { if (q.isMesh) n += (q.geometry.index ? q.geometry.index.count : q.geometry.attributes.position.count) / 3 * (q.isInstancedMesh ? q.count : 1); }); o.userData.tris = Math.round(n);
    o.traverse((q) => { if (q.isMesh && !q.material.transparent) q.castShadow = true; });
    if (light && g.glights[0]) { const l = g.glights[0].clone(); l.color.setHex(o.userData.lampColor); l.intensity = window.CONFIG.gloomLook.lightPower; l.distance = window.CONFIG.gloomLook.lightReach; l.position.copy(o.userData.lamp); l.visible = true; o.add(l); }
    return [o.userData.tris, !!(o.getObjectByName('pelvis_m') || o.getObjectByName('body_m') || o.getObjectByName('hub_m') || o.getObjectByName('base_m'))]; }, [glb, x, z, ry, t, light, KIND]);
  const look = (cx, cz, yaw, pitch, fov, night) => p.evaluate(([cx, cz, yaw, pitch, fov, night]) => { const g = window.__game; if (night) { g.sim.player.x = cx; g.sim.player.z = cz; g.sim.player.hp = 100; g.sim.gloom.length = 0; } else g.setTown(cx, cz); g.setYaw(yaw); g.setPitch(pitch); g.cam.fov = fov; g.cam.updateProjectionMatrix(); if (g.hands && g.hands.g) g.hands.g.visible = false; }, [cx, cz, yaw, pitch, fov, night]);
  const shot = async (name) => { for (let k = 0; k < 2; k++) await p.waitForTimeout(1500); await p.screenshot({ path: out + '/' + name + '.png', timeout: 240000 }); };
  const X = -60, Z = 0.6, info = {};
  for (const v of ['day', 'head', 'leg']) { if (!V.includes(v)) continue;
    for (const glb of GLBS) { const r = await stand(glb, X, Z, Math.PI + 0.5, 3.6, false); info[v + (glb ? '_new' : '_old')] = r;
      if (v === 'day') await look(X, Z + 3.0, 0, Math.atan((DAYY - 1.6) / 3.0), 50);
      if (v === 'head') await look(X + HEADCAM[0], Z + HEADCAM[1], HEADCAM[2], Math.atan((HEADCAM[3] - 1.6) / HEADCAM[4]), 48);
      if (v === 'leg') await look(X + 0.2, Z + LEGCAM[1], 0.1, Math.atan((LEGCAM[0] - 1.6) / LEGCAM[1]), LEGCAM[2]);
      await shot(v + (glb ? '_new' : '_old')); } }
  if (V.includes('night')) {
    await p.evaluate(() => { window.__game.enterHouse(0); window.__game.nightfall(); }); await p.waitForTimeout(2500);
    const q = await p.evaluate((K) => { const s = window.__game.sim; s.gloom.length = 0; s.player.hp = 100; const q = s.breaches.find((x) => x.floor === 0 && (K === 'ticks' ? x.type === 'door' : x.type !== 'door')) || s.breaches.find((x) => x.floor === 0) || s.breaches[0]; return { x: q.x, z: q.z, nx: q.nx, nz: q.nz }; }, KIND);
    for (const glb of GLBS) { info['night' + (glb ? '_new' : '_old')] = await stand(glb, q.x - q.nx * 2.6, q.z - q.nz * 2.6, Math.atan2(q.nx, q.nz) + Math.PI, 3.6, true);
      for (let k = 0; k < 3; k++) { await look(q.x + q.nx * 1.4, q.z + q.nz * 1.4, Math.atan2(q.nx, q.nz), KIND === 'ticks' ? Math.atan((0.3 - 1.6) / 4.0) : 0.1, 56, true); await p.waitForTimeout(800); }
      await shot('night' + (glb ? '_new' : '_old')); } }
  if (V.includes('walk')) {
    // a fresh page by day (after a night the run is over)
    await p.goto(PAGE, { timeout: 300000 }); await p.waitForFunction((K) => window.__game && window.__game.startRun && window.__gloomGlb && window.__gloomGlb[K] !== 'loading', KIND, { timeout: 300000 });
    await p.evaluate(() => { window.__w = null; window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
    await stand(true, X, Z - 2.5, Math.PI, 0, false); await look(X + 0.2, Z + 3.0, 0, Math.atan((1.15 - 1.6) / 4), 50);
    for (let k = 0; k < 12; k++) {
      const st = await p.evaluate((k) => { const o = window.__w; window.CONFIG.gloomMotion.on = true; if (window.__game.run) window.__game.run.dayT = 100; for (let f = 0; f < 15; f++) { const t = 50 + (k * 15 + f) / 60, z = 0.6 - 2.5 + (k * 15 + f) / 60; o.position.z = z; o.userData.anim(t, { x: o.position.x, z }); } return o.userData.motion ? (o.userData.motion.stats.frozen ? 'frozen' : 'moving') : 'no motion'; }, k);
      await p.waitForTimeout(1200); await p.screenshot({ path: out + '/walk_' + String(k).padStart(2, '0') + '.png', timeout: 240000 }); info['walk' + k] = st; } }
  fs.writeFileSync(out + '/info.json', JSON.stringify(info));
  console.log(JSON.stringify(info));
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ').slice(0, 900) : 'NO ERRORS'); await b.close();
})();
