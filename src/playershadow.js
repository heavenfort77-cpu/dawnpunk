// Player shadow (STAGE 1 SAMPLE, owner Nov 18 13:21): desktop (high) gets a real body shadow, phones (low) a soft blob under the feet. Every number is in CONFIG.playerShadow.
// Desktop: an invisible body (never drawn in colour) casts into its own small shadow map. That map belongs to light PS: same direction as the sun, a tight box round the player, redrawn every frame.
// The big static sun maps are not redrawn for it: renderer.shadowMap.render is wrapped so the other lights are drawn only when the game asks (exactly as before) and PS's map every frame,
// from a private scene that holds the body alone. PS gives no light of its own (intensity 0); a small patch of three's light shader multiplies each directional light (the sun, the
// moonlight at night) by PS's shadow. So the body only takes away sunlight: where a house shadow already removed the sun, nothing doubles, and the sky fill and lamps are untouched.
// Phones: one soft dark ellipse on the floor under the feet (a transparent quad, no shadow map).
import * as THREE from 'three';

const EYE = 1.6;

function urlFlag() { try { return new URLSearchParams(location.search).get('pshadow'); } catch (e) { return null; } }
// ?pshadow=1 turns it on (the sample), ?pshadow=0 off; ?pshadow=body gives any tier the desktop body shadow (cheap local tests on the phone tier only)
function pickOn(C) {
  const u = urlFlag();
  if (u === '0') return false;
  if (u === '1' || u === 'body') return true;
  return !C.sampleOnly;
}

// the light-shader patch: when the first directional light is a shadow-only light (colour 0, so it is PS), every directional light is multiplied by its shadow
function patchShader() {
  const SC = THREE.ShaderChunk, src = SC.lights_fragment_begin;
  if (src.indexOf('pshMul') >= 0) return true;
  const head = '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n\tDirectionalLight directionalLight;';
  const tail = 'vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#endif\n';
  if (src.split(head).length !== 2 || src.split(tail).length !== 2) return false;
  // PS's own lookup: one hardware-filtered depth comparison (soft 0) or four in a small square (soft > 0), no noise; outside PS's box (all but a few metres round you) it costs one test
  const pre = 'float pshMul = 1.0;\n#if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHTS > 1 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )\n'
    + '\tif ( receiveShadow && dot( directionalLights[ 0 ].color, vec3( 1.0 ) ) == 0.0 ) {\n'
    + '\t\t#if defined( SHADOWMAP_TYPE_PCF )\n'
    + '\t\tvec4 psC = vDirectionalShadowCoord[ 0 ]; psC.xyz /= psC.w;\n'
    + '\t\t#ifdef USE_REVERSED_DEPTH_BUFFER\n\t\tpsC.z -= directionalLightShadows[ 0 ].shadowBias;\n\t\t#else\n\t\tpsC.z += directionalLightShadows[ 0 ].shadowBias;\n\t\t#endif\n'
    + '\t\tif ( psC.x >= 0.0 && psC.x <= 1.0 && psC.y >= 0.0 && psC.y <= 1.0 && psC.z <= 1.0 ) {\n'
    + '\t\t\tfloat psR = directionalLightShadows[ 0 ].shadowRadius / directionalLightShadows[ 0 ].shadowMapSize.x, psS;\n'
    + '\t\t\tif ( psR > 0.0 ) psS = 0.25 * ( texture( directionalShadowMap[ 0 ], vec3( psC.xy + vec2( -psR, -psR ) * 0.5, psC.z ) ) + texture( directionalShadowMap[ 0 ], vec3( psC.xy + vec2( psR, -psR ) * 0.5, psC.z ) )'
    + ' + texture( directionalShadowMap[ 0 ], vec3( psC.xy + vec2( -psR, psR ) * 0.5, psC.z ) ) + texture( directionalShadowMap[ 0 ], vec3( psC.xy + vec2( psR, psR ) * 0.5, psC.z ) ) );\n'
    + '\t\t\telse psS = texture( directionalShadowMap[ 0 ], psC.xyz );\n'
    + '\t\t\tpshMul = mix( 1.0, psS, directionalLightShadows[ 0 ].shadowIntensity );\n\t\t}\n'
    + '\t\t#else\n'
    + '\t\tpshMul = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowIntensity, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );\n'
    + '\t\t#endif\n\t}\n#endif\n';
  SC.lights_fragment_begin = src.replace(head, pre + head).replace(tail, tail + '\t\tdirectLight.color *= pshMul;\n');
  return true;
}

// the soft blob: a radial fade drawn once into a small canvas
function blobMesh(B) {
  const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2), s = Math.max(0, Math.min(0.99, 1 - B.soft));
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(s, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv);
  // black texels with a fading alpha: the colour stays black, the edge fades out
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: B.dark, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const o = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); o.rotation.order = 'YXZ'; o.scale.set(B.size[0], B.size[1], 1); o.renderOrder = 2; o.frustumCulled = false; o.userData.noAO = true; o.name = 'playerBlob';
  return o;
}

// the body: simple adult proportions, feet at y 0, facing -z (as the camera at yaw 0); eyes at 1.6 m, crown at about 1.75 m
function buildBody(S) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000 }), P = {};
  const cap = (r, len, parent, y, sx, sz) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 3, 8), mat); o.position.y = y; o.scale.set(sx || 1, 1, sz || 1); o.castShadow = true; parent.add(o); return o; };
  const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; P.root = root;
  // hips and legs
  P.hips = grp(root, 0, S.hip, 0);
  cap(0.15, 0.24, P.hips, -0.02, 1.15, 0.75);
  for (const s of [-1, 1]) {
    const th = grp(P.hips, s * 0.095, -0.03, 0); cap(0.075, S.thigh + 0.06, th, -S.thigh / 2, 1, 1);
    const kn = grp(th, 0, -S.thigh, 0); cap(0.058, S.shin + 0.04, kn, -S.shin / 2, 1, 1);
    const ft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.26), mat); ft.position.set(0, -S.shin - 0.02, -0.06); ft.castShadow = true; kn.add(ft);
    P[s < 0 ? 'thL' : 'thR'] = th; P[s < 0 ? 'knL' : 'knR'] = kn;
  }
  // chest, head, arms (the chest does not turn with the hips, so the shoulders face where you look)
  P.chest = grp(root, 0, S.hip, 0);
  cap(0.17, 0.52, P.chest, 0.27, 1.12, 0.66);
  cap(0.05, 0.12, P.chest, 0.58, 1, 1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mat); head.scale.set(0.95, 1.2, 1.08); head.position.set(0, S.headY - S.hip, 0.01); head.castShadow = true; P.chest.add(head);
  for (const s of [-1, 1]) {
    const sh = grp(P.chest, s * 0.2, S.shoulder - S.hip, 0); sh.rotation.order = 'ZXY'; cap(0.055, S.upper + 0.05, sh, -S.upper / 2, 1, 1);
    const el = grp(sh, 0, -S.upper, 0); cap(0.045, S.fore + 0.04, el, -S.fore / 2, 1, 1);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat); hand.position.y = -S.fore - 0.03; hand.castShadow = true; el.add(hand);
    P[s < 0 ? 'shL' : 'shR'] = sh; P[s < 0 ? 'elL' : 'elR'] = el;
    if (s > 0) { // the water cannon along the right forearm, past the fist: belly, nozzle, top panel, tail fin
      const gun = grp(el, 0, -S.fore - 0.02, 0); P.gun = gun;
      cap(0.075, 0.42, gun, -0.08, 1, 0.9);
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.2, 8), mat); noz.position.y = -0.38; noz.castShadow = true; gun.add(noz);
      const pan = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.02), mat); pan.position.set(0, -0.1, -0.09); pan.castShadow = true; gun.add(pan);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.1), mat); fin.position.set(0, 0.12, -0.06); fin.castShadow = true; gun.add(fin);
    }
  }
  return P;
}

export function createPlayerShadow(renderer, scene, CONFIG, tier) {
  const C = CONFIG.playerShadow, T = C && (urlFlag() === 'body' ? C.high : C[tier]);
  const api = { on: false, tick() {}, info: () => ({ on: false }) };
  if (!T || !pickOn(C) || (!T.body && !T.blob)) return api;
  api.on = true;
  let last = performance.now(), want = false, t = 0, phase = 0, spd = 0, amp = 0, yawS = null, twist = 0, back = 1, px = null, pz = 0, py = 0, passes = 0, passMs = 0;
  const sunDir = new THREE.Vector3(0, 1, 0), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  let blob = null;
  if (T.blob) { blob = blobMesh(C.blob); blob.visible = false; scene.add(blob); }
  // ---- desktop body shadow
  let PS = null, body = null, bodyScene = null, fresh = false, cleared = false, sun = null, lastCam = null;
  if (T.body && patchShader()) {
    const S = C.body;
    PS = new THREE.DirectionalLight(0xffffff, 0); PS.name = 'playerShadowLight'; PS.castShadow = true;
    PS.shadow.mapSize.set(T.map, T.map); PS.shadow.intensity = T.darkness; PS.shadow.radius = T.soft / (2 * T.box / T.map); PS.shadow.bias = T.bias[0]; PS.shadow.normalBias = T.bias[1];
    const sc = PS.shadow.camera; sc.left = sc.bottom = -T.box; sc.right = sc.top = T.box; sc.near = 0.1; sc.far = T.back + T.reach; sc.updateProjectionMatrix();
    // first in the scene, so it is directional light 0 for the shader patch (lights that cast shadows come first, in scene order)
    scene.add(PS); scene.add(PS.target); scene.children.splice(scene.children.indexOf(PS), 1); scene.children.unshift(PS);
    bodyScene = new THREE.Scene(); body = buildBody(S); bodyScene.add(body.root);
    const sm = renderer.shadowMap, orig = sm.render, others = [], only = [PS];
    sm.render = function (lights, sc2, cam) {
      const ask = sm.autoUpdate || sm.needsUpdate; let has = false; others.length = 0;
      for (const l of lights) { if (l === PS) has = true; else others.push(l); }
      if (ask && others.length) orig.call(sm, others, sc2, cam);
      let best = null; for (const l of others) if (l.isDirectionalLight && (!best || l.intensity > best.intensity)) best = l; if (best) sun = best;
      if (has && (fresh || !cleared)) { const t0 = performance.now(); fresh = false; cleared = !want; sm.needsUpdate = true; orig.call(sm, only, bodyScene, cam); passes++; passMs += performance.now() - t0; }
      sm.needsUpdate = ask && !others.length;
    };
  }
  // ---- per frame: follow the camera, pose the body, aim the shadow box
  api.tick = (cam, on) => {
    const now = performance.now(), dt = Math.min(window.__dtMax || 0.1, (now - last) / 1000); last = now; t += dt;
    want = !!on; lastCam = cam; const x = cam.position.x, y = cam.position.y - EYE, z = cam.position.z, yaw = cam.rotation.y, pitch = cam.rotation.x;
    if (blob) { blob.visible = want; if (want) { blob.position.set(x, y + C.blob.lift, z); blob.rotation.set(-Math.PI / 2, yaw, 0); } }
    if (!body) return;
    body.root.visible = want;
    if (!want) { PS.shadow.intensity = 0; px = null; return; }
    PS.shadow.intensity = T.darkness;
    // speed and direction from the camera's own movement (teleports and floor changes reset it)
    let vx = 0, vz = 0; if (px !== null && dt > 0) { const dx = x - px, dz = z - pz; if (Math.hypot(dx, dz) < 3 && Math.abs(y - py) < 1.5) { vx = dx / dt; vz = dz / dt; } }
    px = x; pz = z; py = y;
    const v = Math.hypot(vx, vz), M = C.motion; spd += (v - spd) * Math.min(1, dt * M.ease);
    if (yawS === null) yawS = yaw; { let d = yaw - yawS; d = Math.atan2(Math.sin(d), Math.cos(d)); yawS += d * Math.min(1, dt * M.turn); }
    // walking cycle: stride cadence from speed; the phase runs forward or backward with the direction of travel, the swing size follows the eased speed (no pop on stop)
    const fx = -Math.sin(yawS), fz = -Math.cos(yawS), f = vx * fx + vz * fz, side = vx * -fz + vz * fx;
    if (v > 0.2) { const bk = f < -0.35 * v; back = bk ? -1 : 1; const want2 = Math.max(-M.twist, Math.min(M.twist, Math.atan2(-side * back, f * back))); twist += (want2 - twist) * Math.min(1, dt * 6); } else twist += (0 - twist) * Math.min(1, dt * 4);
    const cad = M.cadence[0] + M.cadence[1] * spd; phase += dt * Math.PI * cad * Math.min(1, spd / 0.4) * back;
    amp = Math.min(1, spd / M.full); const run = Math.max(0, Math.min(1, (spd - M.full) / 2));
    const A = amp * (M.legSwing[0] + (M.legSwing[1] - M.legSwing[0]) * run), K = amp * (M.knee[0] + (M.knee[1] - M.knee[0]) * run), sL = Math.sin(phase), cL = Math.cos(phase);
    const B = body, idle = 1 - amp;
    B.root.position.set(x + Math.sin(yawS) * M.eyeFwd, y - M.bob * amp * Math.abs(sL), z + Math.cos(yawS) * M.eyeFwd); B.root.rotation.y = yawS;
    B.hips.rotation.y = twist;
    B.thL.rotation.x = A * sL; B.thR.rotation.x = -A * sL;
    B.knL.rotation.x = -(K * Math.pow(Math.max(0, cL), 1.5) + 0.08 * amp); B.knR.rotation.x = -(K * Math.pow(Math.max(0, -cL), 1.5) + 0.08 * amp);
    B.chest.rotation.x = -M.lean * run - 0.03 * amp; B.chest.rotation.z = M.sway * idle * Math.sin(t * 1.3) + 0.03 * amp * sL; B.chest.rotation.y = 0.05 * amp * sL;
    // left arm swings against the left leg; the right arm holds the cannon forward, follows the aim up and down, and bobs a little
    B.shL.rotation.set(-0.8 * A * sL + M.armRest[0] + idle * 0.02 * Math.sin(t * 1.3), 0, -0.1);
    B.elL.rotation.x = M.armRest[1] + 0.25 * amp * Math.max(0, -sL);
    const aim = Math.max(-0.7, Math.min(0.9, pitch * M.aimFollow));
    B.shR.rotation.set(M.gunArm[0] + aim + 0.06 * amp * sL, 0, M.gunArm[2]); B.elR.rotation.x = M.gunArm[1];
    bodyScene.updateMatrixWorld();
    // the shadow box: centred on the body, the light S.back metres up the sun's rays
    if (sun) { sun.getWorldPosition(v1); sun.target.getWorldPosition(v2); sunDir.copy(v1).sub(v2).normalize(); }
    v1.set(B.root.position.x, B.root.position.y + C.body.centre, B.root.position.z);
    PS.target.position.copy(v1); PS.position.copy(v1).addScaledVector(sunDir, T.back); PS.updateMatrixWorld(); PS.target.updateMatrixWorld();
    fresh = true;
  };
  api.info = () => ({ on: true, tier, body: !!body, blob: !!blob, active: want, speed: +spd.toFixed(3), amp: +amp.toFixed(3), phase: +phase.toFixed(3), twist: +twist.toFixed(3), sun: sunDir.toArray().map((q) => +q.toFixed(4)), passes, passMs: +passMs.toFixed(1), map: body ? T.map : 0 });
  // test helper for tools/playershadowshot.cjs: a flat, sunlit front wall beside a door, where to stand (stand m off it) and where to look to see your own shadow on it
  api.findWall = (root, houses, sun, stand) => {
    stand = stand || 0.75; const rc = new THREE.Raycaster(); rc.camera = lastCam; const L = new THREE.Vector3(-sun[0], -sun[1], -sun[2]), o = new THREE.Vector3(), d = new THREE.Vector3(); root.updateMatrixWorld(true);
    // the first solid surface along the ray; null when leaves or glass hang just in front of it (ivy-covered or a window)
    const hit = (x, y, z, nx, nz) => { o.set(x, y, z); d.set(-nx, 0, -nz); rc.set(o, d); rc.far = 6; let soft = -1; for (const h of rc.intersectObject(root, true)) { const m = h.object.material; if (!h.object.visible || !h.face) continue; if (m && (m.transparent || m.alphaTest > 0)) { soft = h.distance; continue; } return soft >= 0 && h.distance - soft < 0.5 ? null : h; } return null; };
    let best = null;
    for (const h of houses) {
      let nx = h.doorX - h.x, nz = h.doorZ - h.z; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl; const lit = -(nx * L.x + nz * L.z); if (lit < 0.2) continue;
      // beside the door, on the clear door path
      for (const off of [-1.5, -1.2, 1.2, 1.5]) {
        const sx = h.doorX + nx * 2 - nz * off, sz = h.doorZ + nz * 2 + nx * off, H = [1.0, 1.4, 1.8].map((y) => hit(sx, y, sz, nx, nz)); if (H.some((q) => !q)) continue;
        const dd = H.map((q) => q.distance); if (Math.max(...dd) - Math.min(...dd) > 0.04 || dd[1] > 3.2) continue;
        const wx = sx - nx * dd[1], wz = sz - nz * dd[1], px2 = wx + nx * stand, pz2 = wz + nz * stand, head = new THREE.Vector3(px2, 1.65, pz2), t = ((wx - px2) * nx + (wz - pz2) * nz) / (L.x * nx + L.z * nz);
        const sh = head.clone().addScaledVector(L, t), ty = sh.y - 0.3, dx = sh.x - px2, dz = sh.z - pz2, hd = Math.hypot(dx, dz);
        const c = { house: h.i, off, lit: +lit.toFixed(2), x: +px2.toFixed(3), z: +pz2.toFixed(3), yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(ty - 1.6, hd), headOnWall: +sh.y.toFixed(2) };
        if (sh.y > 0.9 && (!best || c.lit > best.lit)) best = c;
      }
    }
    return best;
  };
  // test helper: a spot in a house's shadow, where the feet and the ground 3 m further down the rays are both shaded by the house (the body's shadow must vanish there: nothing doubles)
  api.findShade = (root, houses, sun) => {
    const rc = new THREE.Raycaster(); rc.camera = lastCam; const U = new THREE.Vector3(sun[0], sun[1], sun[2]), hx = -sun[0], hz = -sun[2], hl = Math.hypot(hx, hz) || 1; root.updateMatrixWorld(true);
    const shaded = (x, z) => { rc.set(new THREE.Vector3(x, 0.08, z), U); rc.far = 40; return rc.intersectObject(root, true).some((h) => h.object.visible && h.face && !(h.object.material && (h.object.material.transparent || h.object.material.alphaTest > 0))); };
    for (const h of houses) for (const d of [3, 4, 5]) for (const s of [-1.5, 0, 1.5]) {
      const x = h.x + hx / hl * (h.H + d) - hz / hl * s, z = h.z + hz / hl * (h.H + d) + hx / hl * s;
      if (shaded(x, z) && shaded(x + hx / hl * 3, z + hz / hl * 3) && shaded(x + hx / hl * 1.5, z + hz / hl * 1.5)) return { house: h.i, x: +x.toFixed(3), z: +z.toFixed(3) };
    }
    return null;
  };
  // test helper: draw the frame twice in one go (no game time passes), with and without the body, and count the pixels its shadow darkens and brightens
  api.compare = () => {
    if (!lastCam || !body) return null; const cv = renderer.domElement, w = cv.width, h = cv.height, c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const x = c2.getContext('2d', { willReadFrequently: true });
    const grab = (vis) => { body.root.visible = vis; fresh = true; renderer.render(scene, lastCam); x.drawImage(cv, 0, 0); return x.getImageData(0, 0, w, h).data; };
    // game time stands still between the two draws (swaying grass and drifting clouds read the clock), so only the body differs
    const pn = performance.now, T0 = pn.call(performance); performance.now = () => T0; let a, b; try { a = grab(true); b = grab(false); } finally { performance.now = pn; } body.root.visible = want; fresh = true;
    let dark = 0, bright = 0, ratio = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; const L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    for (let i = 0; i < a.length; i += 4) { const la = L(a, i), lb = L(b, i); if (la < lb - 3) { dark++; ratio += la / Math.max(1, lb); const q = i / 4, px2 = q % w, py2 = (q / w) | 0; x0 = Math.min(x0, px2); x1 = Math.max(x1, px2); y0 = Math.min(y0, py2); y1 = Math.max(y1, py2); } else if (la > lb + 3) bright++; }
    return { dark, bright, ratio: dark ? +(ratio / dark).toFixed(3) : 0, box: [x0, y0, x1, y1], n: w * h };
  };
  api.light = PS; api.body = body; api.blob = blob;
  try { window.__pshadow = api; } catch (e) { /* no window */ }
  return api;
}
