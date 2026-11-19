// The ambient village cats (owner Nov 17: "cats strolling or lazing around"), living scenery only: where they go is src/catwalk.js; this file builds them and moves their bodies.
// Each cat is built in code from merged parts with its coat painted on the vertices (brown tabby, ginger, dark grey tabby, grey with white socks, tortoiseshell; never white, never black):
// a long body with hips and chest, a head with muzzle, nose, ears (inner ear pink), eyes with slit pupils and whiskers (desktop), four legs (desktop: upper leg and lower leg with a paw
// at a knee; phones: one piece each), a tail in segments. Poses blend smoothly: a diagonal walk with the tail up, sit, loaf (paws tucked), sleep curled on its side, groom (head to the
// flank: no raised paw, so nothing reads as the lucky cat's beckoning), watch (head toward the nearest hen), stretch, and a hop onto a perch. No collars, bells, coins or sound.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COATS, createCatBrains } from './catwalk.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), V(sx || 1, sy || sx || 1, sz || sx || 1));
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
// a part: geometries placed by matrices, painted per vertex by paint(local position, base colour) -> colour
function part(list, mat, paint) { const geos = list.map(([geo, m, col, painted]) => { const q = geo.index ? geo.toNonIndexed() : geo.clone(); q.applyMatrix4(m); for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    const P = q.attributes.position, n = P.count, cc = new Float32Array(n * 3), c = new THREE.Color(); for (let i = 0; i < n; i++) { c.setHex(col); if (painted && paint) paint(P.getX(i), P.getY(i), P.getZ(i), c); cc[3 * i] = c.r; cc[3 * i + 1] = c.g; cc[3 * i + 2] = c.b; } q.setAttribute('color', new THREE.BufferAttribute(cc, 3)); return q; });
  const g = mergeGeometries(geos, false); geos.forEach((q) => q.dispose()); const me = new THREE.Mesh(g, mat); me.castShadow = true; me.receiveShadow = true; return me; }
const MAT = {};
function mats(hi) { const k = hi ? 'h' : 'l'; if (MAT[k]) return MAT[k]; const mk = (o) => (hi ? new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.9 }, o)) : new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o)));
  MAT[k] = { fur: mk({}), eye: hi ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15 }) : mk({}) }; for (const m of Object.values(MAT[k])) m.userData.shared = true; return MAT[k]; }

export function makeCat(coatIdx, hi, seg) {
  const [, base, dark, belly, pattern, eyeCol] = COATS[coatIdx % COATS.length], M = mats(hi), s = seg, sph = new THREE.SphereGeometry(1, s, Math.max(6, (s * 0.7) | 0)), cyl = new THREE.CylinderGeometry(1, 0.85, 1, Math.max(5, (s / 2) | 0)), cone = new THREE.ConeGeometry(1, 1, Math.max(4, (s / 3) | 0));
  // the coat painted by where a point is on the body: tabby stripes round the body and rings on the tail, a lighter belly, white socks, tortoiseshell patches
  const paint = (wx, wy, wz) => (x, y, z, c) => { const X = x + wx, Y = y + wy, Z = z + wz;
    if (pattern === 'tabby' && Math.sin(Z * 70 + Y * 55 + Math.sin(X * 25) * 1.5) > 0.35) c.setHex(dark);
    if (pattern === 'tortie') { const h = hash(Math.floor(X * 14), Math.floor(Y * 14), Math.floor(Z * 14)); if (h > 0.6) c.setHex(dark); else if (h > 0.45) c.setHex(belly); }
    if (pattern !== 'solid' && wy > 0.2 && wy < 0.3 && Y < 0.18) c.setHex(belly);
    if (pattern === 'socks' && (Y < 0.07 || (Z > 0.12 && Y < 0.24 && wy < 0.3))) c.setHex(belly); };
  const root = new THREE.Group(), torso = new THREE.Group(); torso.position.y = 0.24; root.add(torso);
  // body: barrel, hips, chest, belly underneath
  torso.add(part([[sph, M4(0, 0, 0, 0, 0, 0, 0.098, 0.095, 0.21), base, true], [sph, M4(0, 0.005, -0.13, 0, 0, 0, 0.095, 0.092, 0.095), base, true], [sph, M4(0, -0.005, 0.13, 0, 0, 0, 0.09, 0.098, 0.09), base, true], [sph, M4(0, -0.05, 0.02, 0, 0, 0, 0.075, 0.05, 0.17), belly, false]], M.fur, paint(0, 0.24, 0)));
  // head on a neck pivot: skull, muzzle and chin, nose, ears with pink insides, eyes with slit pupils, whiskers
  const head = new THREE.Group(); head.position.set(0, 0.07, 0.2); torso.add(head);
  const hl = [[sph, M4(0, 0.03, 0.03, 0, 0, 0, 0.066, 0.06, 0.066), base, true], [sph, M4(0, 0.008, 0.083, 0, 0, 0, 0.034, 0.026, 0.03), belly, false], [sph, M4(0, -0.01, 0.075, 0, 0, 0, 0.022, 0.016, 0.022), belly, false], [sph, M4(0, 0.022, 0.108, 0, 0, 0, 0.009, 0.007, 0.006), 0x8a5a5a, false]];
  // ears: on desktop their own mesh on a pivot at the crown so they can flick (advisor round 2: idle life); on phones they stay part of the head
  const EY = 0.085, EZ = 0.023, er = [];
  for (const sx of [-1, 1]) { er.push([cone, M4(sx * 0.037, 0.088 - EY, 0.02 - EZ, -0.15, 0, -sx * 0.35, 0.026, 0.052, 0.014), base, true]); er.push([cone, M4(sx * 0.036, 0.083 - EY, 0.027 - EZ, -0.15, 0, -sx * 0.35, 0.016, 0.036, 0.006), 0xc88a88, false]);
    if (hi) for (let k = 0; k < 3; k++) hl.push([cyl, M4(sx * 0.055, 0.008 - 0.006 * k, 0.088, 0, 0, sx * (PI / 2 - 0.12 + 0.12 * k), 0.0012, 0.07, 0.0012), 0xd8d4c8, false]); }
  // eyes: their own glossy mesh on desktop, on a pivot at eye height so they can blink; on phones they join the head (one draw less per cat)
  const EH = 0.04, EF = 0.085, el = []; for (const sx of [-1, 1]) { el.push([sph, M4(sx * 0.026, 0, 0.083 - EF, 0, sx * 0.25, 0, 0.0125, 0.012, 0.008), eyeCol, false]); if (hi) el.push([sph, M4(sx * 0.0265, 0, 0.0905 - EF, 0, sx * 0.25, 0, 0.0035, 0.0105, 0.002), 0x080808, false]); }
  let ears = null, eyes = null;
  if (hi) { head.add(part(hl, M.fur, paint(0, 0.31, 0.2))); ears = new THREE.Group(); ears.position.set(0, EY, EZ); head.add(ears); ears.add(part(er, M.fur, paint(0, 0.31 + EY, 0.2 + EZ))); eyes = new THREE.Group(); eyes.position.set(0, EH, EF); head.add(eyes); eyes.add(part(el, M.eye)); }
  else { const sh = (L, dy, dz) => L.map(([gq, m, c, f]) => [gq, new THREE.Matrix4().makeTranslation(0, dy, dz).multiply(m), c, f]); head.add(part([...hl, ...sh(er, EY, EZ), ...sh(el, EH, EF)], M.fur, paint(0, 0.31, 0.2))); }
  // legs at shoulders and hips (desktop: knee joints), paws
  const legs = []; for (const [lx, lz] of [[-0.05, 0.13], [0.05, 0.13], [-0.05, -0.14], [0.05, -0.14]]) { const up = new THREE.Group(); up.position.set(lx, -0.03, lz); torso.add(up);
    if (hi) { up.add(part([[cyl, M4(0, -0.06, 0, 0, 0, 0, 0.022, 0.12, 0.022), base, true]], M.fur, paint(lx, 0.21, lz))); const kn = new THREE.Group(); kn.position.y = -0.115; up.add(kn); kn.add(part([[cyl, M4(0, -0.05, 0, 0, 0, 0, 0.016, 0.1, 0.016), base, true], [sph, M4(0, -0.1, 0.012, 0, 0, 0, 0.021, 0.013, 0.03), base, true]], M.fur, paint(lx, 0.095, lz))); legs.push({ up, kn }); }
    else { up.add(part([[cyl, M4(0, -0.105, 0, 0, 0, 0, 0.02, 0.21, 0.02), base, true], [sph, M4(0, -0.21, 0.012, 0, 0, 0, 0.021, 0.013, 0.03), base, true]], M.fur, paint(lx, 0.21, lz))); legs.push({ up, kn: null }); } }
  // tail in segments from the rump
  const tail = []; let parent = torso, px = 0, py = 0.03, pz = -0.215; const nt = hi ? 5 : 2, tl = 0.27 / nt;
  for (let k = 0; k < nt; k++) { const g = new THREE.Group(); g.position.set(px, py, pz); parent.add(g); const r0 = 0.02 - 0.009 * k / nt; g.add(part([[cyl, M4(0, 0, -tl / 2, PI / 2, 0, 0, r0, tl * 1.05, r0), base, true]], M.fur, paint(0, 0.27, -0.215 - k * tl)));
    tail.push(g); parent = g; px = 0; py = 0; pz = -tl; }
  return { root, torso, head, legs, tail, ears, eyes };
}

// pose targets per act (joint angles, rad): torso [height, pitch, roll], head [pitch, yaw, tilt], legs [upper, knee] x 4 (front left, front right, hind left, hind right), tail [lift, sweep]
const POSE = {
  stand: { t: [0.24, 0, 0], h: [0, 0, 0], l: [[0, 0], [0, 0], [0, 0], [0, 0]], tail: [-0.6, 0] },
  sit: { t: [0.19, -0.7, 0], h: [0.5, 0, 0], l: [[0.7, 0], [0.7, 0], [-1.25, 2.2], [-1.25, 2.2]], tail: [0.55, 0.5] },
  watch: { t: [0.19, -0.7, 0], h: [0.45, 0, 0], l: [[0.7, 0], [0.7, 0], [-1.25, 2.2], [-1.25, 2.2]], tail: [0.55, 0.45] },
  groom: { t: [0.19, -0.6, 0], h: [0.9, 1.15, 0.3], l: [[0.6, 0], [0.6, 0], [-1.25, 2.2], [-1.25, 2.2]], tail: [0.6, 0.6] },
  loaf: { t: [0.11, 0, 0], h: [0.05, 0, 0], l: [[1.45, -2.5], [1.45, -2.5], [-1.45, 2.5], [-1.45, 2.5]], tail: [0.75, 0.7] },
  // not used (owner 21:29: lying flat on its side read as a dead cat): a cat at a 'sleep' spot now dozes in the loaf pose, eyes shut, slow breath
  sleep: { t: [0.09, 0, 1.25], h: [0.35, 1.35, 0.4], l: [[1.2, -2.0], [1.2, -2.0], [-1.2, 2.0], [-1.2, 2.0]], tail: [0.8, 0.85] },
  stretch: { t: [0.18, 0.35, 0], h: [-0.25, 0, 0], l: [[-1.15, 0], [-1.15, 0], [0.15, 0], [0.15, 0]], tail: [-0.9, 0] },
  jump: { t: [0.22, -0.2, 0], h: [-0.1, 0, 0], l: [[-0.7, 0.2], [-0.7, 0.2], [0.6, -0.2], [0.6, -0.2]], tail: [-0.3, 0] },
};
export function createVillageCats(parent, cfg, hi, seed) {
  const VC = cfg.villageCats, n = VC.count[hi ? 'high' : 'low'], brains = createCatBrains(cfg, n, hi ? 'high' : 'low', seed), cats = [];
  brains.cats.forEach((b, i) => { const m = makeCat(i, hi, hi ? 14 : 8); m.root.position.set(b.x, b.y, b.z); parent.add(m.root); cats.push(Object.assign(m, { b, ph: 0, cur: null, flickT: 0, body: m.torso.children[0], rs: (b.id * 7919 + (seed | 0) * 31 + 1) >>> 0, side: 1 })); });
  // each cat's own small random numbers for its blinks and ear flicks (so they never blink together)
  const rn = (c) => (c.rs = (c.rs * 1664525 + 1013904223) >>> 0) / 4294967296;
  const lerp = (a, b2, k) => a + (b2 - a) * k;
  function update(dt, px, pz, evening, birds) {
    if (dt <= 0) return; brains.step(dt, px, pz, evening);
    for (const c of cats) { const b = c.b; c.root.position.set(b.x, b.y, b.z); c.root.rotation.y = b.yaw;
      const walking = b.mode === 'walk', act = b.mode === 'jump' ? 'jump' : walking ? 'stand' : POSE[b.act] && b.act !== 'sleep' ? b.act : 'loaf', T = POSE[act], k = Math.min(1, dt * (walking ? 8 : 3));
      if (!c.cur) c.cur = JSON.parse(JSON.stringify(T)); const C = c.cur;
      for (let j = 0; j < 3; j++) { C.t[j] = lerp(C.t[j], T.t[j], k); C.h[j] = lerp(C.h[j], T.h[j], k); } for (let j = 0; j < 4; j++) for (let q = 0; q < 2; q++) C.l[j][q] = lerp(C.l[j][q], T.l[j][q], k); C.tail[0] = lerp(C.tail[0], T.tail[0], k); C.tail[1] = lerp(C.tail[1], T.tail[1], k);
      // the walk: a diagonal gait, stride from the speed; a small head bob; the tail held up
      const sw = c.sw || (c.sw = [0, 0, 0, 0]), kn = c.kn || (c.kn = [0, 0, 0, 0]); let bob = 0; sw.fill(0); kn.fill(0); // LAG FIX Nov 19 (owner 11:27): the leg arrays are kept per cat, not made each frame
      if (walking) { c.ph += dt * (b.speed || VC.walk) / 0.32 * 2 * PI; const a = Math.sin(c.ph), d = Math.sin(c.ph + PI), cp = Math.cos(c.ph); sw[0] = a * 0.42; sw[1] = d * 0.42; sw[2] = d * 0.42; sw[3] = a * 0.42; kn[0] = Math.max(0, cp) * 0.55; kn[1] = Math.max(0, -cp) * 0.55; kn[2] = Math.max(0, -cp) * 0.55; kn[3] = Math.max(0, cp) * 0.55; bob = Math.abs(Math.sin(c.ph)) * 0.008; }
      c.torso.position.y = C.t[0] + bob; c.torso.rotation.set(C.t[1], 0, C.t[2]);
      // watching: the head turns to the nearest hen (or straight ahead); grooming: the head works at the flank
      let hy = C.h[1], hx = C.h[0]; if (act === 'watch' && birds && birds.length) { let best = null, bd = 9; for (const bb of birds) { if (bb.gone) continue; const d = Math.hypot(bb.x - b.x, bb.z - b.z); if (d < bd) { bd = d; best = bb; } } if (best) { let a = Math.atan2(best.x - b.x, best.z - b.z) - b.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); hy = Math.max(-1.1, Math.min(1.1, a)); } }
      if (act === 'groom') hx += Math.sin(performance.now() / 160) * 0.12;
      c.head.rotation.set(hx, hy, C.h[2]);
      // idle life (advisor round 2, CONFIG.villageCats.breathe / blink / twitch): the chest swells at rest (slower asleep), the eyes blink (shut asleep), an ear flicks now and then (phones: a small head shake)
      const rest = !walking && act !== 'jump', sl = !walking && b.act === 'sleep', BR = VC.breathe, BL = VC.blink, TW = VC.twitch; c.br = (c.br || 0) + dt * BR[0] * (sl ? 0.5 : 1) * 2 * PI; const sw2 = rest ? Math.sin(c.br) * BR[1] : 0; c.body.scale.set(1 + sw2, 1 + sw2, 1);
      if (c.bT === undefined) { c.bT = -rn(c) * BL[1]; c.tT = -rn(c) * TW[1]; } c.bT += dt; let lid = 1; if (c.bT > 0) { const u = c.bT / BL[2]; lid = Math.abs(1 - 2 * Math.min(1, u)); if (u >= 1) c.bT = -(BL[0] + rn(c) * (BL[1] - BL[0])); }
      if (c.eyes) c.eyes.scale.y = sl ? 0.12 : Math.max(0.12, lid);
      c.tT += dt; let tw = 0; if (c.tT > 0) { const u = c.tT / TW[3]; tw = u < 1 ? Math.sin(u * PI) * TW[2] : 0; if (u >= 1) { c.tT = -(TW[0] + rn(c) * (TW[1] - TW[0])); c.side = -c.side; } }
      if (c.ears) c.ears.rotation.set(-tw * 0.6, 0, c.side * tw * 0.5); else c.head.rotation.z += Math.sin(c.tT * 40) * tw / 4;
      c.legs.forEach((L, j) => { L.up.rotation.x = C.l[j][0] - sw[j]; if (L.kn) L.kn.rotation.x = C.l[j][1] + (j < 2 ? -kn[j] : kn[j]); });
      // tail: lift and sweep shared down the segments, a lazy flick now and then (more at the tip)
      c.flickT += dt; const fl = Math.sin(c.flickT * 2 * PI * VC.flick[1] * (1 + (b.id % 3) * 0.3)) * VC.flick[0];
      c.tail.forEach((g, j) => { const tip = j / Math.max(1, c.tail.length - 1); g.rotation.set(C.tail[0] / c.tail.length * (j === 0 ? 1.6 : 0.9), C.tail[1] / c.tail.length + fl * tip * 0.6, 0); }); }
  }
  return { cats, update, brains };
}
