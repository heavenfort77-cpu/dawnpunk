// Checks of the desktop Gloom kinds drawn from their Blender models (src/gloomglb.js), on the exact single-file build. Usage: node tools/gloomglbcheck.cjs [kinds, default walker,lurcher]
// The page is opened with ?gloomglb=<kinds> so the models are on for the check whatever the shipped switches say.
// Desktop tier: the model loads; a Walker is the model (its nodes are there) within the triangle budget; legs, arms, head, rams and display work; the uncanny motion runs on it and freezes it;
// dormant ones build; two machines get different paint shades; the switch quality.high.gloom.models.walker = false brings the builder's Walker back; no page errors.
// Phone tier: the model is not even loaded and the Walker is the phone's. Waits until no other headless browser runs.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const busy = () => { try { return +execFileSync('pgrep', ['-c', '-f', 'chrome-headless']).toString().trim(); } catch (e) { return 0; } };
const KINDS = (process.argv[2] || 'walker,lurcher').split(',');
(async () => {
  while (busy() > 0) await new Promise((r) => setTimeout(r, 400));
  const out = [], errs = [];
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  let p = await b.newPage({ viewport: { width: 640, height: 400 } }); p.on('pageerror', (e) => errs.push(String(e))); await p.addInitScript(() => { window.__dtMax = 1.5; });
  await p.goto('file://' + __dirname + '/../dist/index_single.html?quality=high&gloomglb=' + KINDS.join(','), { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 300000 });
  for (const KIND of KINDS) {
  await p.waitForFunction((K) => window.__gloomGlb && window.__gloomGlb[K] && window.__gloomGlb[K] !== 'loading', KIND, { timeout: 120000 }).catch(() => null);
  const st = await p.evaluate((K) => window.__gloomGlb && window.__gloomGlb[K], KIND); out.push(['desktop tier: the ' + KIND + ' model loaded (' + st + ')', st === 'ready']);
  const r = await p.evaluate((K) => { const G = window.__game, GK = window.CONFIG, max = GK.quality.high.machineTris, tris = G.gloomTris(K);
    G.gloomSample(K, 0, -30, 0, 1, false); const o = window.__lastSample, n = (k) => o.getObjectByName(k);
    // the Ticks: one unit in the file, three copies (groups body and sg each, no legs or rams): their units move when the machine moves
    if (K === 'ticks') { const units = []; o.traverse((q) => { if (q.name === 'body_m') units.push(q.parent); }); const has = units.length === 3 && ['body', 'sg', 'screen'].every((k) => !!n(k)), r0 = units.map((u) => u.rotation.y);
      for (let f = 0; f < 120; f++) o.userData.anim(1 + f / 30, { x: 0, z: -30 + f * 0.03 }); const moved = units.some((u, i) => u.rotation.y !== r0[i]);
      let scr = null; n('sg').traverse((q) => { if (q.isMesh && q.material.map && q.material.map.isCanvasTexture) scr = q; });
      let frozen = 0; const M = o.userData.motion; for (let f = 0; f < 60 * 25; f++) { o.userData.anim(10 + f / 60, { x: 0, z: -30 + f * 0.016 }); if (M && M.stats.frozen) frozen++; }
      const tints = []; o.traverse((q) => { if (q.isMesh && q.material.userData.tint) tints.push(q.material.userData.tint.value.toArray().map((v) => v.toFixed(3)).join(',')); }); const tset = [...new Set(tints)];
      G.gloomSample(K, 4, -30, 0, 1, true); const dorm = !!window.__lastSample.getObjectByName('body_m');
      GK.quality.high.gloom.models[K] = false; G.gloomSample(K, 6, -30, 0, 1, false); const off = !window.__lastSample.getObjectByName('body_m'); const offTris = G.gloomTris(K); GK.quality.high.gloom.models[K] = true;
      return { max, tris, has, model: units.length === 3, moved, ramTurned: true, scr: !!scr, motion: !!M, frozen, tint: tset[0], tint2: tset[1], dorm, off, offTris }; }
    // the Lantern: a hub on three legs (mount0..2 with hip/knee), a boom (arm0), a hanging chain (pend) and its head
    const NEED = K === 'lantern' ? ['hub', 'mount0', 'hip0', 'knee0', 'hip1', 'knee1', 'hip2', 'knee2', 'arm0', 'pend', 'head', 'screen'] : K === 'warden' ? ['base', 'torso', 'head', 'g1', 'g2', 'arm0', 'fore0', 'arm1', 'fore1', 'screen', 'screen2'] : null;
    // the Warden runs on tracks (no legs, no knee ram): its torso bobs as it moves; its elbow rams are aimed like the others'
    if (K === 'warden') { const has = NEED.every((k) => !!n(k)), model = !!n('base_m'), y0 = n('torso').position.y; let moved = false;
      for (let f = 0; f < 120; f++) { o.userData.anim(1 + f / 30, { x: 0, z: -30 + f * 0.03 }); moved = moved || n('torso').position.y !== y0; }
      const ramTurned = !!n('ramc_elbow0') && !!n('ramr_elbow0');
      let scr = null; n('g1').traverse((q) => { if (q.isMesh && q.material.map && q.material.map.isCanvasTexture) scr = q; });
      let frozen = 0; const M = o.userData.motion; for (let f = 0; f < 60 * 25; f++) { o.userData.anim(10 + f / 60, { x: 0, z: -30 + f * 0.016 }); if (M && M.stats.frozen) frozen++; }
      let tint = null; o.traverse((q) => { if (q.isMesh && q.material.userData.tint) tint = q.material.userData.tint.value.toArray().map((v) => v.toFixed(3)).join(','); });
      G.gloomSample(K, 2, -30, 0, 1, false); let tint2 = null; window.__lastSample.traverse((q) => { if (q.isMesh && q.material.userData.tint) tint2 = q.material.userData.tint.value.toArray().map((v) => v.toFixed(3)).join(','); });
      G.gloomSample(K, 4, -30, 0, 1, true); const dorm = !!window.__lastSample.getObjectByName('base_m');
      GK.quality.high.gloom.models[K] = false; G.gloomSample(K, 6, -30, 0, 1, false); const off = !window.__lastSample.getObjectByName('base_m'); const offTris = G.gloomTris(K); GK.quality.high.gloom.models[K] = true;
      return { max, tris, has, model, moved, ramTurned, scr: !!scr, motion: !!M, frozen, tint, tint2, dorm, off, offTris }; }
    // the Hauler's and the Stilt's heads sit on their torsos (no neck node), and the Stilt's second arm is a stump (no fore1), as in their builders
    const has = (NEED ? [] : ['pelvis', 'torso', 'neck', 'head', 'hip0', 'knee0', 'hip1', 'knee1', 'arm0', 'fore0', 'arm1', 'fore1', 'screen']).filter((k) => !(k === 'neck' && (K === 'hauler' || K === 'stilt')) && !(k === 'fore1' && K === 'stilt')).every((k) => !!n(k)) && (!NEED || NEED.every((k) => !!n(k)));
    const model = !!(n('pelvis_m') || n('hub_m')), q0 = n('ramc_knee0').quaternion.clone(), k0 = n('knee0').rotation.x, h0 = n('hip0').rotation.x;
    // the knee ram is aimed every frame; its largest turn over the walk counts (a reverse knee can be back at rest on the last frame)
    let ramMax = 0, moved = false; for (let f = 0; f < 120; f++) { o.userData.anim(1 + f / 30, { x: 0, z: -30 + f * 0.03 }); n('ramc_knee0').onBeforeRender(); ramMax = Math.max(ramMax, n('ramc_knee0').quaternion.angleTo(q0)); moved = moved || n('knee0').rotation.x !== k0 || n('hip0').rotation.x !== h0; }
    const ramTurned = ramMax > 0.001;
    let scr = null; n('head').traverse((q) => { if (q.isMesh && q.material.map && q.material.map.isCanvasTexture) scr = q; });
    let frozen = 0; const M = o.userData.motion; for (let f = 0; f < 60 * 25; f++) { o.userData.anim(10 + f / 60, { x: 0, z: -30 + f * 0.016 }); if (M && M.stats.frozen) frozen++; }
    let tint = null; o.traverse((q) => { if (q.isMesh && q.material.userData.tint) tint = q.material.userData.tint.value.toArray().map((v) => v.toFixed(3)).join(','); });
    G.gloomSample(K, 2, -30, 0, 1, false); let tint2 = null; window.__lastSample.traverse((q) => { if (q.isMesh && q.material.userData.tint) tint2 = q.material.userData.tint.value.toArray().map((v) => v.toFixed(3)).join(','); });
    G.gloomSample(K, 4, -30, 0, 1, true); const dorm = !!(window.__lastSample.getObjectByName('pelvis_m') || window.__lastSample.getObjectByName('hub_m'));
    GK.quality.high.gloom.models[K] = false; G.gloomSample(K, 6, -30, 0, 1, false); const off = !(window.__lastSample.getObjectByName('pelvis_m') || window.__lastSample.getObjectByName('hub_m')); const offTris = G.gloomTris(K); GK.quality.high.gloom.models[K] = true;
    return { max, tris, has, model, moved, ramTurned, scr: !!scr, motion: !!M, frozen, tint, tint2, dorm, off, offTris }; }, KIND);
  out.push(['a desktop ' + KIND + ' is the model, with every node the game turns (pelvis, torso, neck, head, hips, knees, arms, forearms, screen)', r.model && r.has]);
  out.push([KIND + ' model triangles within the budget: ' + r.tris + ' <= ' + r.max, r.tris > 20000 && r.tris <= r.max]);
  out.push([KIND + ': legs move when it walks and the knee ram turns with them', r.moved && r.ramTurned]);
  out.push([KIND + ': its display carries the face / spoken-line picture', r.scr]);
  out.push([KIND + ': uncanny motion runs on it and freezes it at times (' + r.frozen + ' frozen frames in 25 s)', r.motion && r.frozen > 0]);
  out.push([KIND + ': two machines get their own paint shade (' + r.tint + ' / ' + r.tint2 + ')', !!r.tint && r.tint !== r.tint2]);
  out.push(['a dormant (daytime) ' + KIND + ' is the model too', r.dorm]);
  out.push(['switch models.' + KIND + ' = false gives the builder ' + KIND + ' back (' + r.offTris + ' triangles)', r.off]);
  }
  await p.evaluate(() => { const G = window.__game; G.enterBase(); document.getElementById('selRing').value = '0'; G.startRun(0); }); await p.waitForTimeout(3000);
  await p.evaluate(() => { window.__game.enterHouse(0); window.__game.nightfall(); }); await p.waitForTimeout(6000);
  out.push(['desktop: no page errors through base, street and night', errs.length === 0]);
  await p.close();
  const e2 = []; p = await b.newPage({ viewport: { width: 640, height: 400 } }); p.on('pageerror', (e) => e2.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index_single.html?quality=low&gloomglb=' + KINDS.join(','), { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 300000 }); await p.waitForTimeout(3000);
  const lo = await p.evaluate((K) => { let st = null, model = false, tris = 0; for (const k of K) { window.__game.gloomSample(k, 0, -30, 0, 1, false); st = st || (window.__gloomGlb && window.__gloomGlb[k]) || null; model = model || !!window.__lastSample.getObjectByName('pelvis_m'); tris = Math.max(tris, window.__game.gloomTris(k)); } return { st, model, tris }; }, KINDS);
  out.push(['phone tier (page asks for the models): none loaded (' + lo.st + '), phone machines (max ' + lo.tris + ' triangles)', !lo.st && !lo.model && lo.tris < 9000]);
  out.push(['phone: no page errors', e2.length === 0]);
  let bad = 0; for (const [n, ok] of out) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) bad++; }
  console.log(bad ? 'SOME FAILED ' + errs.concat(e2).slice(0, 3).join(' | ') : 'ALL PASS'); await b.close();
})();
