// Ashley's first-person hands (user reference, 2026-11-14): left hand open with the solar bracer, right hand on the water cannon.
// The hands are real posed meshes (src/handsdata.js, exported from the character builder); the bracer, sleeves and cannon are built here.
// Drawn in their own little scene on top of the world, so they never poke into walls. The plain-shape version is kept in hands_plain_shapes_backup.js.
import * as THREE from 'three';
import { HANDS } from './handsdata.js';

export function createHands(cfg) {
  const H = cfg.hands, scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(H.fov, 1, 0.01, 10);
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x4a4038, 1.25); scene.add(hemi); const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-0.6, 1.6, 1.2); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffd9a0, 0.5); rim.position.set(1, 0.3, -1); scene.add(rim);
  const glowLight = new THREE.PointLight(H.glow, 0, 0.6, 2);      // the bracer ring lights the hand and wrist, so the hand sits in the scene's light
  const std = (c, r, m, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m || 0 }, o || {}));
  function cells(nx, ny) { // solar panel face: dark blue cells with pale grid lines
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#1d3a78'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#9fb6e0'; g.lineWidth = 2;
    for (let i = 0; i <= nx; i++) { g.beginPath(); g.moveTo(i * 64 / nx, 0); g.lineTo(i * 64 / nx, 64); g.stroke(); } for (let j = 0; j <= ny; j++) { g.beginPath(); g.moveTo(0, j * 64 / ny); g.lineTo(64, j * 64 / ny); g.stroke(); }
    return new THREE.CanvasTexture(cv);
  }
  const M = { skin: std(0xffffff, 0.62, 0, { side: THREE.DoubleSide, vertexColors: true }), sleeve: std(H.sleeve, 0.95), leather: std(H.leather, 0.7), brass: std(H.brass, 0.38, 0.55), brassDark: std(0x7a5f2a, 0.5, 0.5), dark: std(0x2a211a, 0.8),
    cell: std(0xffffff, 0.3, 0.3, { map: cells(3, 2) }), glass: std(H.glass, 0.08, 0, { transparent: true, opacity: 0.45 }), water: std(0x4aa8e8, 0.2, 0, { transparent: true, opacity: 0.7 }), glow: new THREE.MeshBasicMaterial({ color: H.glow }) };
  const add = (geo, m, p, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); p.add(o); return o; };
  function handMesh(d) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3)); g.setIndex(d.i); g.computeVertexNormals();
    // skin shading baked per vertex: creases and the gaps between fingers darker, knuckles and fingertips a little redder
    const P = d.p, N = g.attributes.normal.array, nv = P.length / 3, acc = new Float32Array(nv), cnt = new Float32Array(nv), I = d.i;
    for (let k = 0; k < I.length; k += 3) for (let e = 0; e < 3; e++) { const a = I[k + e], b = I[k + (e + 1) % 3];
      const dx = P[b * 3] - P[a * 3], dy = P[b * 3 + 1] - P[a * 3 + 1], dz = P[b * 3 + 2] - P[a * 3 + 2], l = Math.hypot(dx, dy, dz) || 1;
      acc[a] += (N[a * 3] * dx + N[a * 3 + 1] * dy + N[a * 3 + 2] * dz) / l; cnt[a]++; acc[b] -= (N[b * 3] * dx + N[b * 3 + 1] * dy + N[b * 3 + 2] * dz) / l; cnt[b]++; }
    const base = new THREE.Color(H.skin), col = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) { const cav = Math.max(-0.5, Math.min(0.5, acc[v] / (cnt[v] || 1))), sh = 1 - Math.max(0, cav) * H.crease + Math.max(0, -cav) * 0.12, tip = Math.max(0, Math.min(1, (-P[v * 3 + 2] - 0.06) / 0.12));
      col[v * 3] = base.r * sh * (1 + 0.05 * tip); col[v * 3 + 1] = base.g * sh * (1 - 0.07 * tip); col[v * 3 + 2] = base.b * sh * (1 - 0.09 * tip); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return new THREE.Mesh(g, M.skin);
  }
  function slice(d, z) { // cross-section of the arm mesh at depth z: centre and half-sizes
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9; const P = d.p;
    for (let k = 0; k < P.length; k += 3) if (Math.abs(P[k + 2] - z) < 0.012) { x0 = Math.min(x0, P[k]); x1 = Math.max(x1, P[k]); y0 = Math.min(y0, P[k + 1]); y1 = Math.max(y1, P[k + 1]); }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 };
  }
  function band(d, z0, z1, off, m, p, nz) { // a strap that hugs the arm between z0 and z1 (follows the arm's own cross-section, so it does not float)
    nz = nz || 4; const seg = 20, v = [], idx = [];
    for (let j = 0; j <= nz; j++) { const z = z0 + (z1 - z0) * j / nz, c = slice(d, z); for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; v.push(c.cx + (c.rx + off) * Math.cos(a), c.cy + (c.ry + off) * Math.sin(a), z); } }
    for (let j = 0; j < nz; j++) for (let k = 0; k < seg; k++) { const a = j * (seg + 1) + k, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); const o = new THREE.Mesh(g, m); o.material.side = THREE.DoubleSide; p.add(o); return o;
  }
  function sleeve(p) { // rolled cloth sleeve over the far half of the forearm (the forearm runs along +z from the wrist)
    const s = add(new THREE.CylinderGeometry(0.050, 0.060, 0.30, 14, 1, true), M.sleeve, p, 0, 0, 0.27); s.rotation.x = Math.PI / 2; s.material.side = THREE.DoubleSide;
    const cuff = add(new THREE.TorusGeometry(0.050, 0.011, 8, 16), M.sleeve, p, 0, 0, 0.122); return s && cuff;
  }
  // LEFT: open hand; bracer on the wrist with a brass disc, glowing ring and a small solar panel
  const left = new THREE.Group(); left.add(handMesh(HANDS.l)); sleeve(left);
  band(HANDS.l, -0.006, 0.095, 0.0035, M.leather, left, 6); band(HANDS.l, -0.010, 0.000, 0.0055, M.brassDark, left, 1); band(HANDS.l, 0.090, 0.100, 0.0055, M.brassDark, left, 1);
  const wc = slice(HANDS.l, 0.055);
  const face = new THREE.Group(); face.position.set(wc.cx, wc.cy + wc.ry + 0.0075, 0.055); left.add(face);                     // on the back of the wrist
  add(new THREE.CylinderGeometry(0.026, 0.029, 0.010, 20), M.brass, face); add(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 16), M.dark, face);
  const ring = add(new THREE.TorusGeometry(0.0200, 0.0040, 8, 24), M.glow, face, 0, 0.006, 0); ring.rotation.x = Math.PI / 2;
  const core = add(new THREE.CircleGeometry(0.010, 14), M.glow, face, 0, 0.0065, 0); core.rotation.x = -Math.PI / 2; glowLight.position.set(0, 0.05, -0.02); face.add(glowLight);
  const lp = new THREE.Group(); lp.position.set(wc.cx - HANDS.l.t * (wc.rx + 0.022), wc.cy + 0.012, 0.055); lp.rotation.z = -HANDS.l.t * 0.75; left.add(lp);   // panel on the outer side (away from the thumb)
  add(new THREE.BoxGeometry(0.058, 0.004, 0.046), M.brassDark, lp); add(new THREE.BoxGeometry(0.052, 0.002, 0.040), M.cell, lp, 0, 0.003, 0);
  // RIGHT: fist on the grip of the brass archerfish cannon (glass belly with water, panel on top, tail fin, nozzle)
  const right = new THREE.Group(); right.add(handMesh(HANDS.r)); sleeve(right);
  const gun = new THREE.Group(); gun.position.fromArray(HANDS.r.g); gun.rotation.z = -HANDS.r.t * Math.PI / 2; gun.scale.setScalar(H.gunScale); right.add(gun);        // gun space: +y = thumb side (up), -z = forward
  const grip = add(new THREE.CylinderGeometry(0.0165, 0.019, 0.125, 12), M.dark, gun, 0, -0.012, 0.004); grip.rotation.x = 0.16;
  for (let k = 0; k < 5; k++) add(new THREE.TorusGeometry(0.0185, 0.0025, 5, 12), M.brassDark, gun, 0, -0.055 + k * 0.02, 0.011 - k * 0.0032).rotation.x = Math.PI / 2 + 0.16;
  add(new THREE.SphereGeometry(0.012, 8, 6), M.glass, gun, 0, -0.082, 0.016);
  const bodyG = new THREE.Group(); bodyG.position.set(0, 0.088, -0.035); gun.add(bodyG);
  const prof = []; for (let k = 0; k <= 14; k++) { const t = k / 14, r = 0.052 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02 + 0.02)), 0.6) * (1 - 0.25 * t); prof.push(new THREE.Vector2(Math.max(0.004, r), -0.085 + 0.17 * t)); }
  const shell = add(new THREE.LatheGeometry(prof, 18), M.brass, bodyG); shell.rotation.x = -Math.PI / 2;                     // lathe axis y -> forward (-z): tail at +z, nose at -z
  const belly = add(new THREE.SphereGeometry(0.047, 16, 12), M.glass, bodyG, 0, -0.006, -0.012); belly.scale.set(1.16, 0.95, 1.05);
  const wat = add(new THREE.SphereGeometry(0.040, 12, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), M.water, bodyG, 0, -0.006, -0.012); wat.scale.set(1.16, 0.95, 1.05);
  add(new THREE.TorusGeometry(0.049, 0.0045, 6, 20), M.brassDark, bodyG, 0, 0, -0.050); add(new THREE.TorusGeometry(0.050, 0.0045, 6, 20), M.brassDark, bodyG, 0, 0, 0.030);
  const noz = add(new THREE.CylinderGeometry(0.010, 0.017, 0.05, 12), M.brass, bodyG, 0, 0, -0.105); noz.rotation.x = -Math.PI / 2;
  add(new THREE.TorusGeometry(0.011, 0.003, 6, 12), M.brassDark, bodyG, 0, 0, -0.130);
  const finS = new THREE.Shape(); finS.moveTo(0, 0); finS.quadraticCurveTo(0.05, 0.075, 0.105, 0.05); finS.quadraticCurveTo(0.07, 0.0, 0.105, -0.05); finS.quadraticCurveTo(0.05, -0.075, 0, 0);
  const fin = add(new THREE.ExtrudeGeometry(finS, { depth: 0.006, bevelEnabled: false }), M.brass, bodyG, 0.003, 0, 0.07); fin.rotation.y = -Math.PI / 2;
  add(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6), M.brassDark, bodyG, 0, 0.058, -0.02);
  const top = new THREE.Group(); top.position.set(0, 0.075, -0.02); top.rotation.x = 0.12; bodyG.add(top);
  add(new THREE.BoxGeometry(0.082, 0.005, 0.066), M.brassDark, top); add(new THREE.BoxGeometry(0.076, 0.002, 0.060), M.cell, top, 0, 0.0035, 0);
  const guard = add(new THREE.TorusGeometry(0.017, 0.003, 6, 14, Math.PI), M.brassDark, gun, 0, 0.040, -0.030); guard.rotation.set(0, Math.PI / 2, Math.PI);
  scene.add(left, right);
  let tThrow = 9, tGrab = 9, tFire = 9, bob = 0, mv = 0, fadeO = 9, fadeG = 9, fromG = 0, lastG = 0; const fromO = [0, 0, 0, 0, 0, 0], lastO = [0, 0, 0, 0, 0, 0], prevO = [0, 0, 0, 0, 0, 0], velO = [0, 0, 0, 0, 0, 0]; let lastDt = 1 / 60, velG = 0, prevG = 0;
  const ease = (t) => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI), sst = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
  // recoil: a quick smooth kick back over the first H.recoilAttack share of the recoil, then an eased return (a sine kick started at full speed: a jump in the first frame)
  const kick = (u) => (u >= 1 ? 0 : u < H.recoilAttack ? sst(u / H.recoilAttack) : 1 - sst((u - H.recoilAttack) / (1 - H.recoilAttack)));
  // the device in the hand while it is being placed: a small ceramic seed pod with a glowing band
  const token = new THREE.Group(), relPos = new THREE.Vector3(); { const pod = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshPhongMaterial({ color: 0xf2ead2, shininess: 70 })); pod.scale.set(1, 1.25, 1); token.add(pod); const band = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16), new THREE.MeshBasicMaterial({ color: 0x8ff0c0 })); band.rotation.x = Math.PI / 2; token.add(band); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 8), new THREE.MeshPhongMaterial({ color: 0x4f9a78 })); tip.position.y = 0.045; token.add(tip); token.visible = false; scene.add(token); }
  return {
    scene, cam, left, right, ring,
    // an action started again while it runs cross-fades from where the hand is over H.restartFade s (it used to jump back to the start)
    // (the pose it fades from keeps the hand's speed and slows to a stop, so the hand does not halt in one frame either)
    throw() { if (tThrow < H.throwTime) { for (let i = 0; i < 6; i++) { fromO[i] = lastO[i]; velO[i] = (lastO[i] - prevO[i]) / lastDt; } fadeO = 0; } tThrow = 0; }, grab() { if (tGrab < H.grabTime) { fromG = lastG; velG = (lastG - prevG) / lastDt; fadeG = 0; } tGrab = 0; }, fire() { tFire = 0; }, pose(u) { tThrow = u * H.throwTime; },
    state() { return { tThrow, tGrab, tFire, lz: left.position.z, ly: left.position.y, rz: right.position.z }; },
    update(dt, moving, energyFrac, night) {
      const nt = night ? 1 : 0, ef = Math.max(0, Math.min(1, energyFrac == null ? 1 : energyFrac));      // match the world: dim and cool at night, with the ring as the warm light
      hemi.intensity = 1.25 - 0.65 * nt; hemi.color.setHex(nt ? 0x8fa6d8 : 0xfff4e0); sun.intensity = 1.5 - 1.05 * nt; rim.intensity = 0.5 - 0.3 * nt; glowLight.intensity = (0.08 + 0.30 * nt) * (0.3 + 0.7 * ef);
      // the walking bob fades in and out over about 1 / H.bobEase s (switching it on and off at once twitched the hands when a walk started or stopped)
      tThrow += dt; tGrab += dt; tFire += dt; fadeO += dt; fadeG += dt; mv += ((moving ? 1 : 0) - mv) * (1 - Math.exp(-dt * H.bobEase)); bob += dt * (1.6 + 7.4 * mv);
      const by = Math.sin(bob) * H.bob * (0.3 + 0.7 * mv), bx = Math.cos(bob * 0.5) * H.bob * mv;
      const th = ease(tThrow / H.throwTime), wind = tThrow < H.throwTime * 0.35 ? ease(tThrow / (H.throwTime * 0.35)) : 0, fi = kick(tFire / H.recoilTime);
      const tau = H.restartFade / 3, coast = (t) => tau * (1 - Math.exp(-t / tau)); if (dt > 0) lastDt = dt;
      let gr = ease(tGrab / H.grabTime); if (fadeG < H.restartFade) { const f0 = fromG + velG * coast(fadeG); gr = f0 + (gr - f0) * sst(fadeG / H.restartFade); } prevG = lastG; lastG = gr;
      const L = H.left, R = H.right;
      // left: at rest the hand is up and open; a throw winds back then sweeps forward with the fingers leading; a pick-up reaches forward and down
      // placing a device: the hand drops to the belt and takes one (take), lifts it into view (show), swings out and lets it fly (throw), follows through and comes back
      const TK = H.throwKeys, u = Math.min(1, tThrow / H.throwTime), o = [0, 0, 0, 0, 0, 0]; void th; void wind;
      if (u < 1) { let a = TK[0], b = TK[TK.length - 1]; for (let i = 0; i < TK.length - 1; i++) if (u >= TK[i][0] && u <= TK[i + 1][0]) { a = TK[i]; b = TK[i + 1]; break; } const ft = (u - a[0]) / Math.max(1e-6, b[0] - a[0]), f = ft * ft * (3 - 2 * ft); for (let i = 0; i < 6; i++) o[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * f; }
      if (fadeO < H.restartFade) { const k = sst(fadeO / H.restartFade), c = coast(fadeO); for (let i = 0; i < 6; i++) { const f0 = fromO[i] + velO[i] * c; o[i] = f0 + (o[i] - f0) * k; } } for (let i = 0; i < 6; i++) { prevO[i] = lastO[i]; lastO[i] = o[i]; }
      left.position.set(L.pos[0] + bx + o[0], L.pos[1] + by + o[1] - 0.10 * gr, L.pos[2] + o[2] - 0.16 * gr);
      left.rotation.set(L.rot[0] + o[3] - 1.25 * gr, L.rot[1] + o[4], L.rot[2] + o[5]);
      { const inHand = u >= H.throwShow && u < H.throwRelease, fly = u >= H.throwRelease && u < H.throwRelease + H.throwFly; token.visible = inHand || fly;
        if (inHand) { token.position.set(left.position.x + H.tokenAt[0], left.position.y + H.tokenAt[1], left.position.z + H.tokenAt[2]); token.scale.setScalar(1); relPos.copy(token.position); }
        else if (fly) { const k = (u - H.throwRelease) / H.throwFly; token.position.set(relPos.x + 0.10 * k, relPos.y + 0.10 * k - 0.22 * k * k, relPos.z - 0.9 * k); token.scale.setScalar(1 - 0.55 * k); token.rotation.x += dt * 14; } }
      right.position.set(R.pos[0] - bx, R.pos[1] - by, R.pos[2] + 0.05 * fi);
      right.rotation.set(R.rot[0] + 0.10 * fi, R.rot[1], R.rot[2] + HANDS.r.t * Math.PI / 2);
      M.glow.color.setHex(H.glow).multiplyScalar(0.35 + 0.65 * Math.max(0, Math.min(1, energyFrac == null ? 1 : energyFrac)));
    },
    render(renderer, aspect) {
      if (cam.aspect !== aspect) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
      const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, cam); renderer.autoClear = ac;
    }
  };
}
