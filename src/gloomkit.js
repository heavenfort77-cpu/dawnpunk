// The Gloom machines (2026-11-14). Style: the user's Dawnfront kit study "Gloom weathered machines" (approved 2026-11-10); every model here is new.
// Seven machines, each with its own shape, material, hands, faults, plants, screen face, night movement and things it says.
// At night they move wrong (stop-motion steps, holds, snaps) and say innocent things. By day a few stand dormant: black screen, limp, a jerk now and then.
// All numbers are in GLOOMKIT. The front of every machine is -z, like the old hooded Gloom.
import * as THREE from 'three';
import { ptex } from './props.js';
import { seg as QSEG, QUALITY } from './quality.js';
import { CONFIG } from './config.js';
import { hiBuilders } from './gloomhi.js';
import { makeMotion, motionEye } from './gloommotion.js';
export { motionEye };
import { BM, halo, stem as stem0, petal as petal0 } from './bloomtech.js';

export const GLOOMKIT = {
  // say: each machine speaks every `every` seconds (its own gap inside that range) for `hold` s; only ONE machine speaks at a time, with `gapAll` s of silence between speakers, so captions never overlap
  say: { every: [7, 13], hold: 3.0, size: 3.6, gapAll: 0.6 },
  dormant: { jerk: [5, 12], jerkLen: 0.22, lean: 0.12, headDrop: 0.5 },
  // wear and tear, rolled new for every single machine: lose = chance that each small part (cap, plate, finger, rivet, solar leaf) is gone; arm = chance that one forearm is torn off (wires hang from the stump);
  // scorch / rust = how many burnt and rusted patches [min, max]; wires = loose hanging wires [min, max]; moss = extra moss pads [min, max]; lean = how far it may list to one side (radians); dim = chance the screen is dimmer than it should be
  wear: { lose: 0.16, loseMax: 5, arm: 0.28, scorch: [3, 8], rust: [3, 9], wires: [0, 3], moss: [0, 4], lean: 0.07, dim: 0.3 },
  // status lights under each machine's screen [x, y, z of the middle one], and a creeper up one leg for those that had none [[x, y, z] points]
  dots: { lurcher: [0.4, 1.36, -0.1], hauler: [0, 1.68, -0.57], stilt: [0, 2.13, -0.13], lantern: [0, 2.2, -0.33], ticks: [0, 0.36, -0.44], warden: [0, 2.2, -0.52] },
  creeper: { lurcher: [[0.2, 0.05, -0.2], [0.24, 0.35, 0.2], [0.18, 0.7, 0.3], [0.26, 1.0, 0.1]], hauler: [[0.3, 0.05, -0.1], [0.42, 0.4, 0.05], [0.56, 0.8, -0.2], [0.66, 1.2, 0.1], [0.6, 1.55, -0.1]] },
  walker: { lamp: [2.08, -0.55], h: 2.3, fps: 9, loop: 10, body: 0xc8a676, cap: 0xb04a2a, body2: 0xf2ecd8, cap2: 0x7fc4b0, screen: '#f6efd2', leg: 0.9, stride: 0.42,
    lines: ['Hello! Hello! Hello!', 'Welcome home!', 'We missed you so much.', 'Come out and say hi!', 'Stay for dinner?'] },
  lurcher: { lamp: [1.42, -0.95], h: 1.9, fps: 12, loop: 10, body: 0x9fe0cc, cap: 0xe09a6a, screen: '#ffe4e0', leg: 0.8, stride: 0.6,
    lines: ['Tag! You are it.', 'Do not run. It is no fun if you run.', 'Found you!', 'Ready or not.', 'I only want a hug.'] },
  hauler: { lamp: [1.28, -0.95], h: 2.2, fps: 8, loop: 12, body: 0x7a8296, cap: 0xe8884a, screen: '#eef0ea', leg: 0.7, stride: 0.3,
    lines: ['Let me carry that for you.', 'Delivery. Please open up.', 'Heavy lifting is my job.', 'I will take you home.', 'Hold still. Nearly done.'] },
  stilt: { lamp: [2.68, -0.45], h: 3.0, fps: 5, loop: 12, body: 0xfaf6ea, cap: 0x9fc0d8, screen: '#e4f6ff', leg: 1.5, stride: 0.3,
    lines: ['I can see you from up here.', 'Let me reach that for you.', 'Nothing is out of reach.', 'You look so small.', 'Up we go.'] },
  lantern: { lamp: [1.78, -0.4], h: 2.4, fps: 8, loop: 11, body: 0xe8c878, cap: 0x2a2826, screen: '#ffd890', leg: 2.2, stride: 0.18,
    lines: ['Bedtime, everyone.', 'Lights out soon.', 'Gather round, gather round.', 'Sleep tight.', 'Everybody come and see.'] },
  ticks: { lamp: [0.55, -0.5], h: 0.6, fps: 14, loop: 2.4, body: 0xf4f6ec, cap: 0xe09a6a, screen: '#eaffea', leg: 0.2, stride: 0.5,
    lines: ['Tidy tidy tidy.', 'Cleaning up!', 'Crumbs. Crumbs. Crumbs.', 'We tidy everything away.', 'Nothing left behind.'] },
  warden: { lamp: [1.8, -0.95], h: 3.0, fps: 7, loop: 14, body: 0xa8d490, cap: 0x4a4e58, screen: '#dff6d8', leg: 1, stride: 1,
    lines: ['Visiting hours are over.', 'Please stay where you are.', 'Everyone inside, please.', 'This will not take long.', 'Thank you for waiting.'] },
};
export const GLOOM_KINDS = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'];

import { GRITTY, GRIT, DESO } from './look.js';
const mc = {}, UP = new THREE.Vector3(0, 1, 0);
const petal = (...a) => (GRITTY ? new THREE.Group() : petal0(...a)), stem = (...a) => (GRITTY ? new THREE.Group() : stem0(...a));
const grit = (o, gloss) => { if (!GRITTY || o.color === undefined) return o; const c = new THREE.Color(o.color), h = {}; c.getHSL(h); c.setHSL(h.h, h.s * GRIT.sat, h.l * GRIT.light); o = Object.assign({}, o, { color: c.getHex() }); if (o.map && gloss) { o.map = ptex('worn'); o.color = new THREE.Color(0xffffff).lerp(c, GRIT.tint).multiplyScalar(GRIT.metal).getHex(); } if (gloss) { o.shininess = Math.min(o.shininess || 30, GRIT.shine); o.specular = GRIT.spec; } return o; }; // the gritty look: every painted or plain part is pulled toward dull, dark, greyed metal
const lam = (k, o) => { if (!mc[k]) { mc[k] = new THREE.MeshLambertMaterial(grit(o)); mc[k].userData.shared = true; } return mc[k]; };
const pho = (k, o) => { if (!mc[k]) { mc[k] = new THREE.MeshPhongMaterial(grit(o, true)); mc[k].userData.shared = true; mc[k].userData.k = k; } return mc[k]; };
// the finish (approved 2026-11-14): chipped enamel that still shines where it is whole, glazed caps, dark gunmetal joints
const paint = (k, c) => pho('gk_p' + k, { map: ptex('paint'), color: c, shininess: 45, specular: 0x444444 });
const rusty = (k, c) => pho('gk_r' + k, { map: ptex('paint'), color: c, shininess: 60, specular: 0x555555 });
const metal = (k, c) => pho('gk_m' + k, { map: ptex('metal'), color: c, shininess: 80, specular: 0x8a8a9a, side: THREE.DoubleSide });
const flat = (k, c, o) => lam('gk_f' + k, Object.assign({ color: c }, o || {}));
const glow = (k, c) => { if (!mc['g' + k]) { mc['g' + k] = new THREE.MeshBasicMaterial({ color: c }); mc['g' + k].userData.shared = true; } return mc['g' + k]; };
const mesh = (geo, m, x, y, z, p) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (p) p.add(o); return o; };
const ball0 = (r, m, x, y, z, p, sx, sy, sz) => { const o = mesh(new THREE.SphereGeometry(r, QSEG(10), QSEG(8)), m, x, y, z, p); if (sx) o.scale.set(sx, sy, sz); return o; };
const cyl0 = (r0, r1, h, m, x, y, z, p, n) => mesh(new THREE.CylinderGeometry(r0, r1, h, QSEG(n || 9)), m, x, y, z, p);
// ---- the realistic worn look: the same builders, but every toy shape becomes machinery. A round body = a cage of hoops round a dark core with a few torn casing plates left on it;
// a ball joint = a hinge pin; a flattened ball (a foot, a pad) = a steel plate; a thick limb = a thin strut; a barrel or pot = a casing with a section torn away and its core showing.
const hard = (m) => GRITTY && m && !m.isMeshBasicMaterial && m !== mc.gk_moss && !(m.map && m.map === ftexAny);
let ftexAny = null, gk = 0; const wornM = () => pho('g3worn', { map: ptex('worn'), color: 0xffffff, shininess: 12, specular: 0x1a1a1a, side: THREE.DoubleSide }), coreM = () => flat('g3core', 0x1b1b1e);
// Realistic worn, second pass (user: "give them holes and cracks instead of gutting them"): bodies stay whole. Only the toy joints change: a ball joint is a hinge pin, a flattened ball (a foot, a pad) is a steel plate, limbs are a little slimmer.
// The damage is painted on by wearAndTear with the klad 'hole' and 'crack' textures.
const ball = (r, m, x, y, z, p, sx, sy, sz) => { if (!hard(m)) return ball0(r, m, x, y, z, p, sx, sy, sz);
  if (r <= 0.11) { const g = grp(x || 0, y || 0, z || 0, p); if (sx) g.scale.set(sx, sy, sz); const c = mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, r * 1.7, QSEG(8)), coreM(), 0, 0, 0, g); c.rotation.z = Math.PI / 2; mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.28, r * 2.1, QSEG(6)), wornM(), 0, 0, 0, g).rotation.z = Math.PI / 2; return g; }
  if (sx && sy < 0.6) { const g = grp(x || 0, y || 0, z || 0, p); mesh(new THREE.BoxGeometry(r * 1.7, r * 0.5, r * 1.9), m, 0, 0, 0, g); g.scale.set(sx, 1, sz); return g; }
  const o = mesh(new THREE.SphereGeometry(r, QSEG(14), QSEG(10)), m, x, y, z, p); if (sx) o.scale.set(sx, sy, sz); return o; };
const cyl = (r0, r1, h, m, x, y, z, p, n) => { const R = Math.max(r0, r1); if (!hard(m) || R < 0.035 || R > 0.2 || h <= 2.4 * R) return cyl0(r0, r1, h, m, x, y, z, p, R > 0.2 ? 14 : n); return cyl0(Math.max(GRIT.minRod, r0 * GRIT.limb), Math.max(GRIT.minRod, r1 * GRIT.limb), h, m, x, y, z, p, 8); };
const lathe = (pts, n, m, p) => mesh(new THREE.LatheGeometry(pts, QSEG(n)), m, 0, 0, 0, p);
const bx = (w, h, d, m, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, p);
const grp = (x, y, z, p) => { const o = new THREE.Group(); o.position.set(x, y, z); p.add(o); return o; };
// a rod from a to b (r at a, r2 at b)
const seg = (p, a, b, r, m, r2) => { const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), o = cyl(r2 === undefined ? r : r2, r, d.length(), m, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, p, 7); o.quaternion.setFromUnitVectors(UP, d.normalize()); return o; };
const LEAF = () => flat('leaf', 0x4a9a3a, { side: THREE.DoubleSide }), MOSS = () => lam('gk_moss', { map: ptex('leaves'), color: 0x9fd060 }), DARK = () => flat('dark', 0x1c1c22), WIRE = () => flat('wire', 0xc02a20), JOINT = () => metal('joint', 0x4a4e5a), BRASS = () => metal('brass', 0xd8b060);
const leafAt = (p, x, y, z, l, ry, rx) => { if (GRITTY) return new THREE.Group(); const o = mesh(new THREE.PlaneGeometry(l * 0.42, l), LEAF(), x, y, z, p); o.rotation.set(rx === undefined ? 0.5 : rx, ry || 0, 0.5); return o; };
const mossAt = (p, x, y, z, r) => ball(r || 0.08, MOSS(), x, y, z, p, 1.4, 0.45, 1.2);
const sprout = (p, x, y, z, s) => { if (GRITTY) return; cyl(0.012 * s, 0.016 * s, 0.2 * s, LEAF(), x, y + 0.1 * s, z, p, 5); leafAt(p, x + 0.05 * s, y + 0.24 * s, z, 0.2 * s, 0.5); leafAt(p, x - 0.04 * s, y + 0.22 * s, z + 0.03 * s, 0.16 * s, -0.8); };

// ---- screen faces: friendly, and wrong. One canvas per kind (shared); each machine has its own material so its screen can dip or go black alone.
const ftex = {};
function faceTex(kind, K) {
  if (ftex[kind]) return ftex[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), ink = '#16130f', dot = (px, py, r) => { x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); };
  x.fillStyle = K.screen; x.fillRect(0, 0, 128, 128); x.strokeStyle = ink; x.fillStyle = ink; x.lineCap = 'round';
  const blush = (y) => { x.fillStyle = '#f0a0a0'; x.globalAlpha = 0.8; x.beginPath(); x.ellipse(24, y, 10, 5, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(104, y, 10, 5, 0, 0, 7); x.fill(); x.globalAlpha = 1; x.fillStyle = ink; };
  const crack = (pts) => { x.lineWidth = 2; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const q of pts) x.lineTo(q[0], q[1]); x.stroke(); }, dead = (list) => { for (const q of list) x.fillRect(q[0], q[1], q[2], q[3]); };
  if (kind === 'walker') { dot(42, 56, 10); dot(88, 54, 13); x.fillStyle = '#fff'; dot(45, 52, 3); dot(92, 49, 4); blush(78); x.lineWidth = 5; x.beginPath(); x.moveTo(48, 82); x.quadraticCurveTo(56, 96, 64, 82); x.quadraticCurveTo(72, 96, 80, 82); x.stroke(); crack([[96, 4], [84, 30], [92, 40], [78, 70], [84, 96]]); dead([[14, 30, 8, 8], [22, 38, 6, 6], [100, 98, 10, 6], [108, 30, 6, 10]]); }
  else if (kind === 'lurcher') { x.lineWidth = 4; for (const cx of [40, 88]) { x.beginPath(); for (let a = 0; a < 15; a += 0.3) { const r = 1 + a * 1.05; x.lineTo(cx + Math.cos(a) * r, 54 + Math.sin(a) * r); } x.stroke(); } blush(80); x.lineWidth = 5; x.beginPath(); x.arc(64, 82, 18, 0.25, Math.PI - 0.25); x.stroke(); crack([[70, 0], [64, 24], [72, 34], [66, 60]]); dead([[104, 100, 10, 8], [8, 20, 8, 6]]); }
  else if (kind === 'hauler') { x.lineWidth = 6; for (const [cx, s] of [[38, 1], [90, -1]]) { x.beginPath(); x.moveTo(cx - 12 * s, 40); x.lineTo(cx + 10 * s, 52); x.lineTo(cx - 12 * s, 64); x.stroke(); } blush(80); x.fillStyle = ink; x.beginPath(); x.moveTo(36, 78); x.quadraticCurveTo(64, 116, 92, 78); x.closePath(); x.fill(); x.fillStyle = '#fff'; for (let k = 0; k < 4; k++) x.fillRect(46 + k * 10, 79, 7, 8); x.fillStyle = '#f08a8a'; x.beginPath(); x.ellipse(64, 100, 12, 5, 0, 0, 7); x.fill(); x.fillStyle = ink; dead([[10, 8, 10, 8], [112, 108, 8, 10]]); }
  else if (kind === 'stilt') { x.lineWidth = 5; for (const cx of [42, 86]) { x.beginPath(); x.arc(cx, 50, 12, Math.PI + 0.3, -0.3); x.stroke(); } blush(70); x.beginPath(); x.ellipse(64, 86, 5, 8, 0, 0, 7); x.fill(); crack([[20, 128], [30, 100], [22, 90], [34, 70]]); dead([[98, 12, 8, 12]]); }
  else if (kind === 'lantern') { dot(30, 58, 7); dot(98, 58, 7); x.lineWidth = 5; x.beginPath(); x.arc(64, 86, 9, 0, 7); x.stroke(); crack([[0, 30], [26, 40], [34, 30], [60, 44], [70, 36], [128, 60]]); crack([[60, 44], [56, 70]]); dead([[108, 96, 8, 8]]); }
  else if (kind === 'ticks') { dot(64, 54, 22); x.fillStyle = '#fff'; dot(72, 46, 7); x.fillStyle = ink; x.lineWidth = 4; x.beginPath(); x.arc(64, 92, 10, 0.3, Math.PI - 0.3); x.stroke(); dead([[12, 100, 8, 8], [104, 14, 8, 8]]); }
  else if (kind === 'warden') { x.lineWidth = 7; x.beginPath(); x.moveTo(26, 52); x.lineTo(52, 52); x.moveTo(76, 52); x.lineTo(102, 52); x.stroke(); x.lineWidth = 5; x.beginPath(); x.moveTo(40, 88); x.lineTo(88, 88); x.stroke(); x.beginPath(); x.moveTo(88, 88); x.lineTo(94, 82); x.stroke(); dead([[8, 8, 12, 8], [20, 16, 8, 8], [106, 104, 12, 10]]); }
  else { x.fillStyle = '#07080a'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#3a3e44'; for (let k = 0; k < 90; k++) x.fillRect((k * 53) % 128, (k * 97) % 128, 3, 2); crack([[10, 0], [40, 50], [30, 64], [70, 128]]); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; ftex[kind] = t; return t;
}
const screenMat = (kind, K) => new THREE.MeshBasicMaterial({ map: faceTex(kind, K) });
// a screen disc facing -z with a dark bezel
const screen = (p, m, x, y, z, r, sy) => { const s = mesh(new THREE.CircleGeometry(r, 20), m, x, y, z, p); s.rotation.y = Math.PI; s.scale.set(1, sy || 1, 1); const b = mesh(new THREE.TorusGeometry(r, r * 0.1, 6, 20), DARK(), x, y, z + 0.012, p); b.scale.set(1, sy || 1, 1); halo(p, x, y, z + 0.3, r * 5, 0xffe8b0); return s; };

// the line a machine says: a small glowing caption over it
function caption(g, y, size) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.scale.set(size, size * 96 / 512, 1); sp.position.y = y; sp.visible = false; sp.renderOrder = 9; g.add(sp); let cur = null;
  return (text) => { if (text === cur) return; cur = text; sp.visible = !!text; if (!text) return; x.clearRect(0, 0, 512, 96); x.fillStyle = 'rgba(8,10,8,0.78)'; x.beginPath(); x.roundRect(4, 14, 504, 68, 18); x.fill(); x.strokeStyle = '#bfe8c0'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#e8ffe0'; x.font = 'bold 36px ui-monospace,Menlo,Consolas,monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; let f = 36; while (x.measureText(text).width > 480 && f > 16) { f -= 2; x.font = 'bold ' + f + 'px ui-monospace,Menlo,Consolas,monospace'; } x.fillText(text, 256, 49); t.needsUpdate = true; };
}
// two-legged walking: the planted foot goes back at ground speed, the free foot swings forward with a bent knee
const stepLegs = (legs, ph, A, kn) => legs.forEach((L, i) => { const p = (ph + i * 0.5) % 1; let th, k = 0; if (p < 0.6) th = A - 2 * A * (p / 0.6); else { const e = (p - 0.6) / 0.4; th = -A + 2 * A * e; k = kn * Math.sin(Math.PI * e); } L.hip.rotation.x = th + k * 0.4; if (L.knee) L.knee.rotation.x = -k; });
const within = (u, a, b) => u >= a && u < b;

// ---------------------------------------------------------------- 1. Walker: the common one. Pear body, egg head, it waves too long.
// fin = the cleaner finish (sample, ?look=new): chipped cream enamel that catches the light, dark gunmetal joints, faded green ceramic caps, a leaf-veined solar petal, status lights, a glow round the screen, a creeper and flowers
function walker(b, K, face, fin) {
  const pm = (k, o) => { if (!mc[k]) { mc[k] = new THREE.MeshPhongMaterial(grit(o, true)); mc[k].userData.shared = true; mc[k].userData.k = k; } return mc[k]; };
  const iron = fin ? pm('w2body', { map: ptex('paint'), color: K.body2, shininess: 45, specular: 0x444444 }) : paint('walker', K.body), cap = fin ? pm('w2cap', { map: ptex('paint'), color: K.cap2, shininess: 60, specular: 0x555555 }) : rusty('wcap', K.cap), jn = fin ? pm('w2joint', { map: ptex('metal'), color: 0x4a4e5a, shininess: 80, specular: 0x8a8a9a }) : JOINT(), ft = fin ? pm('w2foot', { map: ptex('glaze'), color: 0xd8d4c8, shininess: 60, specular: 0x555555 }) : metal('foot', 0x9a9aa6), legs = [], arms = [];
  for (const sx of [-1, 1]) { const hip = grp(sx * 0.17, 1.0, 0, b); cyl(0.085, 0.075, 0.4, iron, 0, -0.2, 0, hip); ball(0.105, jn, 0, -0.43, 0, hip); const knee = grp(0, -0.43, 0, hip); cyl(0.07, 0.085, 0.42, iron, 0, -0.23, 0, knee); ball(0.2, ft, 0, -0.5, -0.06, knee, 1, 0.42, 1.45); cyl(0.02, 0.02, 0.34, jn, sx * 0.07, -0.2, 0.05, hip, 5); legs.push({ hip, knee }); }
  ball(0.36, cap, 0, 1.04, 0, b, 1, 0.42, 0.9);
  mesh(new THREE.LatheGeometry([[0.2, 1.0], [0.33, 1.08], [0.41, 1.26], [0.39, 1.42], [0.31, 1.58], [0.2, 1.7], [0.1, 1.74]].map((q) => new THREE.Vector2(q[0], q[1])), 14), iron, 0, 0, 0, b);
  mesh(new THREE.TorusGeometry(0.335, 0.026, 6, 18), DARK(), 0, 1.53, 0, b).rotation.x = Math.PI / 2;
  const hatch = cyl(0.13, 0.13, 0.05, DARK(), 0, 1.36, -0.375, b, 14); hatch.rotation.x = Math.PI / 2; hatch.scale.set(1, 1, 1.25); ball(0.035, ft, 0.02, 1.36, -0.405, b);
  const plate = bx(0.34, 0.22, 0.03, cap, 0.02, 1.14, -0.37, b); plate.rotation.set(-0.22, 0, 0.06); for (const [rx, ry] of [[-0.14, 0.08], [0.14, 0.08], [-0.14, -0.08], [0.14, -0.08]]) ball(0.014, jn, 0.02 + rx, 1.14 + ry, -0.39 + ry * 0.2, b);
  for (const q of [[-0.3, 1.3, -0.22, 0.1], [0.22, 1.66, 0.12, 0.09], [0.3, 1.02, -0.16, 0.08], [-0.2, 1.5, 0.28, 0.1], [0.34, 1.34, 0.12, 0.09], [-0.1, 1.08, 0.3, 0.09]]) mossAt(b, q[0], q[1], q[2], q[3]);
  for (const sx of [-1, 1]) { ball(0.175, cap, sx * 0.47, 1.6, 0, b, 1, 0.72, 1); mossAt(b, sx * 0.47, 1.72, 0.03, 0.07); const ar = grp(sx * 0.5, 1.56, 0, b); arms.push(ar); cyl(0.055, 0.05, 0.36, iron, 0, -0.2, 0, ar); ball(0.08, jn, 0, -0.4, 0, ar); const fa = grp(0, -0.4, 0, ar); ar.userData.fore = fa;
    if (sx > 0) { cyl(0.022, 0.022, 0.36, jn, 0, -0.2, 0, fa, 5); mesh(new THREE.TorusGeometry(0.11, 0.008, 4, 10, 4.2), WIRE(), 0.03, -0.2, 0, fa).rotation.y = 1.2; } else cyl(0.06, 0.05, 0.36, iron, 0, -0.2, 0, fa);
    ball(0.07, jn, 0, -0.42, 0, fa); for (let k = 0; k < 3; k++) { const f = cyl(0.013, 0.013, 0.15, BRASS(), Math.cos(k * 2.1) * 0.04, -0.53, Math.sin(k * 2.1) * 0.04, fa, 5); f.rotation.set(Math.sin(k * 2.1) * 0.25, 0, -Math.cos(k * 2.1) * 0.25); } }
  if (fin) { const pg = grp(-0.52, 1.5, 0.16, b); pg.rotation.set(0.45, 0.4, 0.75); petal(pg, 0.62, 0.36, BM.cell); const pg2 = grp(0.5, 1.62, 0.2, b); pg2.rotation.set(0.9, -0.5, -1.9); petal(pg2, 0.4, 0.22, BM.cell);
    for (let k = 0; k < 3; k++) ball(0.02, glow(k ? 'amber' : 'teal', k ? 0xffc040 : 0x66ffe0), -0.12 + k * 0.07, 1.6, -0.3, b);
    stem([[0.2, 0.08, 0.06], [0.26, 0.4, 0.02], [0.15, 0.7, -0.08], [0.26, 0.98, 0.04], [0.36, 1.2, -0.05]], 0.012, LEAF(), b); for (let k = 0; k < 6; k++) leafAt(b, 0.2 + 0.06 * Math.sin(k * 2.2), 0.2 + k * 0.17, 0.02 * Math.cos(k * 2), 0.15, k * 1.4, 0.3);
    if (!GRITTY) for (const [fx, fy, fz, c] of [[-0.44, 1.76, 0.02, 0xffe070], [-0.36, 1.74, 0.1, 0xff9ab0], [0.5, 1.75, -0.02, 0xffffff]]) { ball(0.035, glow('fl' + c, c), fx, fy, fz, b); ball(0.014, glow('amber', 0xffc040), fx, fy + 0.02, fz, b); }
    seg(b, [0.16, 1.2, -0.38], [0.2, 1.05, -0.4], 0.006, DARK()); for (let k = 0; k < 4; k++) bx(0.12, 0.012, 0.01, DARK(), -0.2, 1.48 - k * 0.03, -0.345 - k * 0.006, b); }
  const pt = fin ? new THREE.Group() : mesh(new THREE.CircleGeometry(0.24, 12), metal('petal', 0x39405a), -0.56, 1.72, 0.2, b); if (!fin) { pt.material.side = THREE.DoubleSide; pt.scale.set(1, 1.5, 1); pt.rotation.set(0.5, 0.4, 0.9); } cyl(0.012, 0.012, 0.3, jn, -0.5, 1.62, 0.14, b, 4).rotation.z = 0.7;
  cyl(0.07, 0.08, 0.1, jn, 0, 1.78, 0, b); mesh(new THREE.TorusGeometry(0.09, 0.012, 4, 12), WIRE(), 0, 1.79, 0, b).rotation.x = Math.PI / 2;
  const head = grp(0, 2.08, 0, b); ball(0.31, iron, 0, 0, 0, head, 1, 1.06, 1); for (const sx of [-1, 1]) ball(0.09, jn, sx * 0.315, 0, 0, head, 0.6, 1, 1); screen(head, face, 0, 0, -0.295, 0.255, 0.95); sprout(head, 0.02, 0.32, 0, 1.2); mossAt(head, -0.12, 0.27, 0.1, 0.08);
  let ph = 0;
  return { head, arms, top: 2.75, night(q, u, mv) { const wv = within(u, 1, 9.4), fr = within(u, 9.4 - 2.4, 9.4), up = wv ? 1 : 0, s = fr ? 0.7 : Math.sin((u - 1) * 7.5);
    arms[0].rotation.z = up * 2.5; arms[0].rotation.x = up * -0.2; arms[0].userData.fore.rotation.z = up * (0.5 + 0.55 * s); arms[1].rotation.x = 0.08 * Math.sin(q * 1.3); head.rotation.z = fr ? 0.24 : 0.05 * Math.sin(q * 0.9); head.rotation.y = 0.12 * Math.sin(q * 0.6);
    face.color.setScalar(within(u, 3, 3.35) || within(u, 7.2, 7.55) ? 0.2 : 1); ph += mv / (2 * K.stride * K.leg / 0.6); stepLegs(legs, ph, K.stride, 0.8); b.position.y = -0.03 * Math.abs(Math.sin(ph * 2 * Math.PI)); } };
}
// ---------------------------------------------------------------- 1c. Walker as an old municipal service machine left out for years (DESOLATE SAMPLE, ?look=desolate only). Same rig, size, hit area and rules.
// The face is shown on a real old display (pixel grid, scan lines, a dead row, burn-in, flicker); faded civic paint with a stencilled unit number and a warning label; pistons and rubber boots
// at the joints instead of balls; dirt climbing the legs; moss and leaves in the seams. Body stays whole (holes and cracks come from wearAndTear as before).
function displayTex(kind, K, W) {      // the face on an old display. The draw function with a text puts a spoken line on the screen instead of the face, with null it brings the face back
  const src = faceTex(kind, K).image, [gw, gh] = W.grid, cv = document.createElement('canvas'); cv.width = 256; cv.height = 192; const x = cv.getContext('2d'), t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const sm = document.createElement('canvas'); sm.width = gw; sm.height = gh; const sx = sm.getContext('2d');
  const finish = () => { x.globalCompositeOperation = 'multiply'; x.fillStyle = '#b8f0c8'; x.fillRect(0, 0, 256, 192); x.globalCompositeOperation = 'source-over';
    x.globalAlpha = W.burn; x.fillStyle = '#9fd8b0'; x.font = 'bold 18px monospace'; x.fillText('OUT OF SERVICE', 40, 170); x.globalAlpha = 1;
    for (let yy = 0; yy < 192; yy += 192 / gh) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, yy + 192 / gh * 0.7, 256, 192 / gh * 0.3); }
    for (let xx = 0; xx < 256; xx += 256 / gw) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(xx + 256 / gw * 0.75, 0, 256 / gw * 0.25, 192); }
    x.fillStyle = '#060806'; x.fillRect(0, W.deadRow * 192 / gh, 256, 192 / gh);
    const g = x.createRadialGradient(128, 96, 40, 128, 96, 170); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = g; x.fillRect(0, 0, 256, 192); t.needsUpdate = true; };
  const draw = (text) => { sx.fillStyle = '#0b120e'; sx.fillRect(0, 0, gw, gh); x.imageSmoothingEnabled = false;
    if (!text) { sx.filter = 'grayscale(1) contrast(1.4)'; sx.drawImage(src, gw * 0.12, 0, gw * 0.76, gh); sx.filter = 'none'; x.drawImage(sm, 0, 0, 256, 192); return finish(); }
    x.drawImage(sm, 0, 0, 256, 192); x.fillStyle = '#e8ffe8'; x.font = 'bold 26px monospace'; x.textBaseline = 'top'; const words = text.toUpperCase().split(' '), lines = ['']; for (const w of words) { if ((lines[lines.length - 1] + ' ' + w).trim().length > 13) lines.push(w); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim(); }
    lines.slice(0, 4).forEach((l, k) => x.fillText(l, 14, 30 + k * 34 - (Math.min(lines.length, 4) - 1) * 12)); finish(); };
  draw(null); return { tex: t, draw };
}
function stencilTex(W) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); x.clearRect(0, 0, 256, 128);
  x.fillStyle = 'rgba(30,30,26,0.85)'; x.font = 'bold 44px sans-serif'; x.fillText(W.unit, 18, 58); x.fillStyle = '#c9a227'; x.fillRect(18, 74, 150, 34); x.fillStyle = '#1b1a16'; x.font = 'bold 15px sans-serif'; x.fillText('KEEP CLEAR', 34, 97);
  for (let k = 0; k < 9; k++) { x.fillStyle = '#1b1a16'; x.beginPath(); x.moveTo(170 + k * 9, 108); x.lineTo(178 + k * 9, 74); x.lineTo(182 + k * 9, 74); x.lineTo(174 + k * 9, 108); x.fill(); }
  for (let k = 0; k < 500; k++) x.clearRect(Math.random() * 256, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// v2 (user: rig, size and lines made it cartoonish): 2.1 m, heavy torso, thick hydraulic legs and wide feet, a smaller monitor head; a slow heavy gait with weight shift and a limp,
// arms hanging, the head held steady with an occasional servo twitch; its lines appear on its own screen and in its voice, never in a floating bubble.
function walkerDeso(b, K, face) {
  const W = GLOOMKIT_DESO(), S = W.shape, pm = (k, o) => { if (!mc[k]) { mc[k] = new THREE.MeshPhongMaterial(o); mc[k].userData.shared = true; mc[k].userData.k = k; } return mc[k]; };
  const civic = pm('dWbody', { map: ptex('worn'), color: W.paint, shininess: 8, specular: 0x222222 }), grime = pm('dWleg', { map: ptex('worn'), color: 0x6e6450, shininess: 4, specular: 0x111111 }), steel = pm('dWsteel', { map: ptex('metal'), color: 0x8a8c88, shininess: 40, specular: 0x666666 }), rubber = pm('dWboot', { color: 0x1a1a18, shininess: 6, specular: 0x111111 });
  const boot = (r, p, y) => { const lt = new THREE.LatheGeometry([[r * 0.7, 0.07], [r * 1.05, 0.045], [r * 0.85, 0.02], [r * 1.05, 0], [r * 0.85, -0.02], [r * 1.05, -0.045], [r * 0.7, -0.07]].map((q) => new THREE.Vector2(q[0], q[1])), 12); mesh(lt, rubber, 0, y, 0, p); };
  const cylT = (rt, rb, h, m, x, y, z, p, n) => mesh(new THREE.CylinderGeometry(rt, rb, h, n || 10), m, x, y, z, p);      // real thickness: the shared cylinder helper thins limbs into struts in the gritty look
  const legs = [], arms = [], hipY = S.hip, thigh = S.thigh, shin = S.shin;
  const pelvis = grp(0, hipY, 0, b);
  for (const sx of [-1, 1]) { const hip = grp(sx * S.hipW, 0, 0, pelvis); boot(0.13, hip, 0); cylT(0.12, 0.1, thigh, grime, 0, -thigh / 2, 0, hip, 10); cyl(0.04, 0.04, thigh * 0.8, steel, sx * 0.1, -thigh / 2, 0.06, hip, 6);
    const knee = grp(0, -thigh, 0, hip); boot(0.11, knee, 0); cylT(0.095, 0.11, shin, grime, 0, -shin / 2, 0, knee, 10); cyl(0.03, 0.03, shin * 0.8, steel, 0, -shin / 2, -0.11, knee, 6);
    const ft = bx(0.26, 0.09, 0.42, grime, 0, -shin - 0.03, -0.06, knee); ft.userData.k = 'foot'; bx(0.24, 0.03, 0.1, rubber, 0, -shin - 0.08, -0.25, knee); legs.push({ hip, knee }); }
  const torso = grp(0, 0.08, 0, pelvis); bx(0.62, 0.18, 0.46, civic, 0, 0.05, 0, torso);
  const body = mesh(new THREE.CylinderGeometry(S.chest, S.chest * 1.12, S.torso, 10, 1), civic, 0, 0.14 + S.torso / 2, 0, torso); body.scale.set(1, 1, 0.78);
  for (const yy of [0.32, 0.55]) bx(S.chest * 2.3, 0.012, S.chest * 1.8, DARK(), 0, yy, 0, torso);
  for (const [qx, qy] of [[-0.3, 0.6], [0.3, 0.6], [-0.33, 0.22], [0.33, 0.22]]) ball(0.016, steel, qx, qy, -S.chest * 0.82, torso);
  const lab = mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshLambertMaterial({ map: stencilTex(W), transparent: true }), 0, 0.42, -S.chest * 0.84, torso); lab.rotation.y = Math.PI;
  bx(0.2, 0.1, 0.02, DARK(), 0.22, 0.24, -S.chest * 0.83, torso);
  const yoke = 0.14 + S.torso; bx(0.78, 0.12, 0.4, civic, 0, yoke, 0, torso);
  for (const sx of [-1, 1]) { const ar = grp(sx * 0.46, yoke - 0.04, 0, torso); arms.push(ar); boot(0.1, ar, 0); cylT(0.07, 0.06, S.arm, grime, 0, -S.arm / 2, 0, ar, 8); const fa = grp(0, -S.arm, 0, ar); ar.userData.fore = fa; boot(0.08, fa, 0);
    cylT(0.06, 0.05, S.arm, grime, 0, -S.arm / 2, 0, fa, 8); for (let k = 0; k < 3; k++) { const f = cyl(0.02, 0.014, 0.16, steel, Math.cos(k * 2.1) * 0.045, -S.arm - 0.07, Math.sin(k * 2.1) * 0.045, fa, 5); f.rotation.set(Math.sin(k * 2.1) * 0.25, 0, -Math.cos(k * 2.1) * 0.25); }
    for (let k = 0; k < 2; k++) seg(torso, [sx * 0.24, yoke + 0.04 - k * 0.04, 0.2], [sx * 0.44, yoke - 0.06, 0.1], 0.009, DARK()); }
  const neck = grp(0, yoke + 0.06, 0, torso); boot(0.075, neck, 0.02); cyl(0.05, 0.05, 0.12, steel, 0, 0.08, 0, neck, 8);
  const head = grp(0, S.headUp, 0, neck); bx(S.head[0], S.head[1], S.head[2], civic, 0, 0, 0.02, head); bx(S.head[0] - 0.05, S.head[1] - 0.05, 0.02, DARK(), 0, 0, -S.head[2] / 2 + 0.005, head);
  const D2 = displayTex('walker', K, W); face.map = D2.tex; const scr = mesh(new THREE.PlaneGeometry(S.head[0] - 0.1, S.head[1] - 0.09), face, 0, 0, -S.head[2] / 2 - 0.008, head); scr.rotation.y = Math.PI;
  const gl = mesh(new THREE.PlaneGeometry(S.head[0] - 0.08, S.head[1] - 0.07), new THREE.MeshPhongMaterial({ color: 0x223028, transparent: true, opacity: 0.18, shininess: 120, specular: 0xbfd6d0 }), 0, 0, -S.head[2] / 2 - 0.014, head); gl.rotation.y = Math.PI;
  for (let k = 0; k < 8; k++) { const lf = mesh(new THREE.PlaneGeometry(0.06, 0.045), LEAFDEAD(), (Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.3, pelvis); lf.rotation.set(Math.random() * 3, Math.random() * 3, 0); }
  let ph = 0, tw = 0, twT = 0;
  const gait = () => legs.forEach((L, i) => { const lim = i === S.limpLeg ? S.limp : 1, p = ((ph + i * 0.5) % 1); let th, k = 0; if (p < 0.65) th = S.stride - 2 * S.stride * (p / 0.65); else { const e = (p - 0.65) / 0.35; th = -S.stride + 2 * S.stride * e; k = S.knee * Math.sin(Math.PI * e) * lim; } L.hip.rotation.x = th * lim; L.knee.rotation.x = k + 0.08; });
  return { head, arms, legs, top: S.top, keepScale: true, say: (text) => D2.draw(text), night(q, u, mv) {
    const wv = within(u, 1, 9.4), up = wv ? 1 : 0; ph += mv / (2 * S.stride * (thigh + shin) / 0.6); gait();
    const sway = Math.sin(ph * 2 * Math.PI), lim = Math.sin(ph * 2 * Math.PI + S.limpLeg * Math.PI);
    pelvis.rotation.z = S.sway * sway; pelvis.position.y = hipY - S.dip * Math.abs(Math.sin(ph * 2 * Math.PI)) - (lim > 0.6 ? S.limpDrop * (lim - 0.6) : 0); torso.rotation.x = S.lean; torso.rotation.z = -S.sway * 0.6 * sway;
    arms[0].rotation.z = up * 1.9 * Math.min(1, (u - 1) * 0.6); arms[0].userData.fore.rotation.z = up * 0.5; arms[1].rotation.x = 0.12 * Math.sin(ph * 2 * Math.PI + 1.2); arms[1].rotation.z = -0.05;
    if (q > twT) { tw = (Math.random() - 0.5) * S.twitch; twT = q + 1.5 + Math.random() * 4; } tw *= 0.85;
    head.rotation.z = -pelvis.rotation.z - torso.rotation.z + tw; head.rotation.x = -S.lean * 0.7; head.rotation.y = 0.1 * Math.sin(q * 0.4) + tw * 2;
    face.color.setScalar(within(u, 3, 3.35) || within(u, 7.2, 7.55) || Math.random() < W.flicker ? 0.25 : 1); } };
}
// ---- the other six, rebuilt the same way for the desolate look (user: real proportions and thickness, heavy movement, a display face, lines on that screen with no bubble).
// Each keeps its role and its silhouette idea: Lurcher hunched and fast, Hauler wide and heavy, Stilt tall and reaching, Lantern a lamp on a tripod, Ticks three small floor units, Warden big on tracks.
function dkit() {
  const W = GLOOMKIT_DESO(), pm = (k, o) => { if (!mc[k]) { mc[k] = new THREE.MeshPhongMaterial(o); mc[k].userData.shared = true; mc[k].userData.k = k; } return mc[k]; };
  const civic = pm('dWbody', { map: ptex('worn'), color: W.paint, shininess: 8, specular: 0x222222 }), grime = pm('dWleg', { map: ptex('worn'), color: 0x6e6450, shininess: 4, specular: 0x111111 }), steel = pm('dWsteel', { map: ptex('metal'), color: 0x8a8c88, shininess: 40, specular: 0x666666 }), rubber = pm('dWboot', { color: 0x1a1a18, shininess: 6, specular: 0x111111 });
  const cylT = (rt, rb, h, m, x, y, z, p, n) => mesh(new THREE.CylinderGeometry(rt, rb, h, n || 10), m, x, y, z, p);
  const boot = (r, p, y) => { const lt = new THREE.LatheGeometry([[r * 0.7, 0.07], [r * 1.05, 0.045], [r * 0.85, 0.02], [r * 1.05, 0], [r * 0.85, -0.02], [r * 1.05, -0.045], [r * 0.7, -0.07]].map((q) => new THREE.Vector2(q[0], q[1])), 12); mesh(lt, rubber, 0, y, 0, p); };
  const glassM = () => new THREE.MeshPhongMaterial({ color: 0x223028, transparent: true, opacity: 0.18, shininess: 120, specular: 0xbfd6d0 });
  // a display set into a box face: w x h screen, the box face at z0 (facing -z); returns the drawer for spoken lines
  const display = (p, w, h, z0, kind, K, face, dead) => { bx(w + 0.05, h + 0.05, 0.02, DARK(), 0, 0, z0 + 0.005, p);
    let D = null; if (dead) { mesh(new THREE.PlaneGeometry(w, h), DARK(), 0, 0, z0 - 0.008, p).rotation.y = Math.PI; } else { D = displayTex(kind, K, W); face.map = D.tex; mesh(new THREE.PlaneGeometry(w, h), face, 0, 0, z0 - 0.008, p).rotation.y = Math.PI; }
    mesh(new THREE.PlaneGeometry(w + 0.02, h + 0.02), glassM(), 0, 0, z0 - 0.014, p).rotation.y = Math.PI; return D; };
  const stencil = (p, x, y, z, w) => { const l = mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshLambertMaterial({ map: stencilTex(W), transparent: true }), x, y, z, p); l.rotation.y = Math.PI; };
  const leaves = (p, n, y, r) => { for (let k = 0; k < n; k++) { const lf = mesh(new THREE.PlaneGeometry(0.06, 0.045), LEAFDEAD(), (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * r, p); lf.rotation.set(Math.random() * 3, Math.random() * 3, 0); } };
  // a hydraulic leg: boot, thick upper part with a ram, knee boot, lower part, a wide foot; knee bends forward (fwd 1) or backward (fwd -1, reverse knee)
  const leg = (p, x, up, lo, r, fwd) => { const hip = grp(x, 0, 0, p); boot(r * 1.15, hip, 0); cylT(r, r * 0.85, up, grime, 0, -up / 2, 0, hip); cylT(r * 0.33, r * 0.33, up * 0.8, steel, r * 0.8 * Math.sign(x || 1), -up / 2, r * 0.5, hip, 6);
    const knee = grp(0, -up, 0, hip); boot(r, knee, 0); cylT(r * 0.8, r * 0.95, lo, grime, 0, -lo / 2, 0, knee); bx(r * 2.4, r * 0.8, r * 3.8, grime, 0, -lo - r * 0.3, -r * 0.5 * fwd, knee); return { hip, knee, fwd }; };
  // a heavy gait: stance most of the cycle, a short lift; lim < 1 makes that leg drag
  const gait = (legs, ph, stride, kneeA, limpLeg, limp) => legs.forEach((L, i) => { const lim = i === limpLeg ? limp : 1, p = (ph + i / legs.length) % 1; let th, k = 0; if (p < 0.65) th = stride - 2 * stride * (p / 0.65); else { const e = (p - 0.65) / 0.35; th = -stride + 2 * stride * e; k = kneeA * Math.sin(Math.PI * e) * lim; } L.hip.rotation.x = th * lim; L.knee.rotation.x = (k + 0.08) * L.fwd; });
  const flick = (face, u, a, b) => face.color.setScalar(within(u, a, a + 0.35) || within(u, b, b + 0.35) || Math.random() < W.flicker ? 0.25 : 1);
  return { W, civic, grime, steel, rubber, cylT, boot, display, stencil, leaves, leg, gait, flick };
}
// Lurcher: an inspection unit on reverse knees, body pitched forward, a small display on a long neck held low, long arms near the ground. Fast, short steps; lunges.
function lurcherDeso(b, K, face) {
  const T = dkit(), legs = [], arms = []; const pelvis = grp(0, 0.92, 0, b);
  for (const sx of [-1, 1]) legs.push(T.leg(pelvis, sx * 0.2, 0.42, 0.5, 0.075, -1));
  const torso = grp(0, 0.05, 0, pelvis); torso.rotation.x = -0.5; bx(0.5, 0.55, 0.4, T.civic, 0, 0.3, 0, torso); bx(0.54, 0.012, 0.44, DARK(), 0, 0.42, 0, torso); T.stencil(torso, 0, 0.25, -0.205, 0.32);
  const neck = grp(0, 0.6, -0.12, torso); T.boot(0.06, neck, 0); T.cylT(0.04, 0.045, 0.32, T.steel, 0, 0.16, -0.06, neck, 8);
  const head = grp(0, 0.34, -0.12, neck); bx(0.32, 0.26, 0.24, T.civic, 0, 0, 0.02, head); const D = T.display(head, 0.26, 0.19, -0.1, 'lurcher', K, face);
  for (const sx of [-1, 1]) { const ar = grp(sx * 0.3, 0.5, 0, torso); arms.push(ar); T.boot(0.07, ar, 0); T.cylT(0.05, 0.045, 0.5, T.grime, 0, -0.25, 0, ar, 8); const fa = grp(0, -0.5, 0, ar); ar.userData.fore = fa; T.boot(0.06, fa, 0); T.cylT(0.045, 0.04, 0.45, T.grime, 0, -0.22, 0, fa, 8); for (let k = 0; k < 3; k++) T.cylT(0.015, 0.01, 0.16, T.steel, Math.cos(k * 2.1) * 0.035, -0.5, Math.sin(k * 2.1) * 0.035, fa, 5); ar.rotation.x = 0.6; }
  T.leaves(pelvis, 6, 0, 0.4); let ph = 0;
  return { head, arms, legs, top: 1.9, keepScale: true, lamp: [1.45, -0.6], say: (t) => D.draw(t), night(q, u, mv) { const lunge = within(u, 4, 4.35) || within(u, 8.2, 8.5); ph += mv / 0.5; T.gait(legs, ph, 0.3, 0.7, 0, 0.8);
    pelvis.position.y = 0.92 - 0.04 * Math.abs(Math.sin(ph * 2 * Math.PI)); torso.rotation.x = lunge ? -0.95 : -0.5 + 0.04 * Math.sin(ph * 4 * Math.PI); head.position.z = lunge ? -0.4 : -0.12; head.rotation.x = lunge ? 0.4 : 0.15 + 0.08 * Math.sin(q * 3.1);
    arms.forEach((a, i) => { a.rotation.x = lunge ? -0.4 : 0.6 + 0.2 * Math.sin(ph * 2 * Math.PI + i * Math.PI); }); T.flick(face, u, 2.5, 6.6); } };
}
// Hauler: a freight loader. Wide cargo body low on short thick legs, two heavy lifting arms with flat forks, display high on the front. Slow and heavy; hammers.
function haulerDeso(b, K, face) {
  const T = dkit(), legs = [], arms = []; const pelvis = grp(0, 0.72, 0, b);
  for (const sx of [-1, 1]) legs.push(T.leg(pelvis, sx * 0.36, 0.34, 0.36, 0.12, 1));
  const torso = grp(0, 0.05, 0, pelvis); bx(1.0, 0.9, 0.7, T.civic, 0, 0.55, 0, torso); bx(1.04, 0.014, 0.74, DARK(), 0, 0.7, 0, torso); bx(0.86, 0.08, 0.58, T.civic, 0, 1.04, 0, torso);
  for (const [qx, qy] of [[-0.42, 0.95], [0.42, 0.95], [-0.42, 0.18], [0.42, 0.18]]) ball(0.02, T.steel, qx, qy, -0.355, torso); T.stencil(torso, -0.22, 0.35, -0.356, 0.4);
  const head = grp(0, 1.25, -0.05, torso); bx(0.5, 0.36, 0.32, T.civic, 0, 0, 0, head); const D = T.display(head, 0.42, 0.28, -0.16, 'hauler', K, face);
  for (const sx of [-1, 1]) { const ar = grp(sx * 0.6, 0.9, 0, torso); arms.push(ar); T.boot(0.11, ar, 0); T.cylT(0.09, 0.08, 0.5, T.grime, 0, -0.25, 0, ar); const fa = grp(0, -0.5, 0, ar); ar.userData.fore = fa; T.boot(0.09, fa, 0); T.cylT(0.08, 0.07, 0.42, T.grime, 0, -0.21, 0, fa);
    bx(0.08, 0.04, 0.42, T.steel, -0.05, -0.46, -0.16, fa); bx(0.08, 0.04, 0.42, T.steel, 0.05, -0.46, -0.16, fa); ar.rotation.x = 0.15; }
  for (let k = 0; k < 3; k++) seg(torso, [-0.3 + k * 0.3, 1.0, 0.3], [-0.5 + k * 0.5, 0.6, 0.36], 0.012, DARK());
  T.leaves(pelvis, 8, 0.05, 0.6); let ph = 0;
  return { head, arms, legs, top: 2.35, keepScale: true, lamp: [2.0, -0.5], say: (t) => D.draw(t), night(q, u, mv) { const ham = within(u, 7, 9.8), k = ham ? (u - 7) % 0.7 : 0, dn = ham && k > 0.4; ph += mv / 0.75; T.gait(legs, ph, 0.18, 0.4, 1, 0.7);
    pelvis.position.y = 0.72 - 0.05 * Math.abs(Math.sin(ph * 2 * Math.PI)); torso.rotation.z = 0.04 * Math.sin(ph * 2 * Math.PI);
    arms.forEach((a) => { a.rotation.x = ham ? (dn ? 0.2 : -2.3) : 0.15 + 0.06 * Math.sin(ph * 2 * Math.PI); }); torso.rotation.x = dn ? 0.12 : 0; T.flick(face, u, 3, 5.8); } };
}
// Stilt: a streetlight maintenance unit on long telescopic legs, a small body, one long reaching arm with a tool head, display at the top. Slow; reaches over a panel.
function stiltDeso(b, K, face) {
  const T = dkit(), legs = [], arms = []; const pelvis = grp(0, 2.2, 0, b);
  for (const sx of [-1, 1]) { const L = T.leg(pelvis, sx * 0.16, 1.1, 1.05, 0.065, 1); legs.push(L); }
  const torso = grp(0, 0.05, 0, pelvis); bx(0.44, 0.55, 0.34, T.civic, 0, 0.3, 0, torso); T.stencil(torso, 0, 0.25, -0.172, 0.3);
  const head = grp(0, 0.82, 0, torso); T.boot(0.06, grp(0, -0.2, 0, head), 0); bx(0.36, 0.28, 0.26, T.civic, 0, 0, 0, head); const D = T.display(head, 0.3, 0.21, -0.13, 'stilt', K, face);
  const up = grp(0.24, 0.5, 0, torso); arms.push(up); T.boot(0.06, up, 0); T.cylT(0.045, 0.04, 0.7, T.grime, 0, -0.35, 0, up, 8); const fa = grp(0, -0.7, 0, up); up.userData.fore = fa; T.boot(0.05, fa, 0); T.cylT(0.035, 0.035, 0.75, T.steel, 0, -0.37, 0, fa, 8); bx(0.12, 0.1, 0.14, T.grime, 0, -0.78, 0, fa);
  const off = grp(-0.24, 0.5, 0, torso); arms.push(off); T.boot(0.05, off, 0); T.cylT(0.04, 0.035, 0.5, T.grime, 0, -0.25, 0, off, 8);
  T.leaves(pelvis, 5, 0, 0.3); let ph = 0;
  return { head, arms, legs, top: 3.5, keepScale: true, lamp: [3.12, -0.3], say: (t) => D.draw(t), night(q, u, mv) { const reach = within(u, 5, 7.4), away = within(u, 3, 5); ph += mv / 1.1; T.gait(legs, ph, 0.14, 0.35, 0, 0.85);
    pelvis.position.y = 2.2 - 0.03 * Math.abs(Math.sin(ph * 2 * Math.PI)); torso.rotation.z = 0.05 * Math.sin(ph * 2 * Math.PI); head.rotation.y = away ? 1.6 : 0.15 * Math.sin(q * 0.3);
    up.rotation.x = reach ? -1.9 : 0.1; fa.rotation.x = reach ? -0.3 : 0.05; T.flick(face, u, 2, 8.5); } };
}
// Lantern: a public-address lighting unit. Tripod of hydraulic legs, a mast with a loudspeaker horn, a lamp box hanging from an arm with the display in it. Creeps; rings and flares.
function lanternDeso(b, K, face) {
  const T = dkit(), legs = [], arms = []; const hub = grp(0, 1.0, 0, b);
  for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.5, g = grp(Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2, hub); g.rotation.y = a; g.rotation.x = 0.35; const L = T.leg(g, 0, 0.5, 0.55, 0.06, 1); legs.push(L); }
  bx(0.4, 0.3, 0.4, T.civic, 0, 0.1, 0, hub); T.cylT(0.05, 0.06, 1.1, T.steel, 0, 0.8, 0, hub, 8); const horn = mesh(new THREE.ConeGeometry(0.16, 0.3, 12, 1, true), T.grime, 0, 1.3, -0.12, hub); horn.rotation.x = -Math.PI / 2 + 0.2;
  const armG = grp(0, 1.32, 0, hub); arms.push(armG); bx(0.06, 0.06, 0.6, T.steel, 0, 0, -0.3, armG); const pend = grp(0, 0, -0.58, armG); seg(pend, [0, 0, 0], [0, -0.22, 0], 0.012, DARK());
  const head = grp(0, -0.42, 0, pend); bx(0.38, 0.36, 0.3, T.civic, 0, 0, 0, head); const D = T.display(head, 0.3, 0.22, -0.15, 'lantern', K, face); T.stencil(head, 0, -0.14, 0.152, 0.2);
  const lampM = glow('amber', 0xffc040), bulb = mesh(new THREE.SphereGeometry(0.07, 10, 8), lampM, 0, -0.24, 0, head); const hl = halo(head, 0, -0.26, 0, 0.5, 0xffc040); hl.material = hl.material.clone(); hl.material.opacity = 0.08;
  T.leaves(hub, 6, 0, 0.4); let ph = 0;
  return { head: pend, arms, legs, top: 2.6, keepScale: true, lamp: [1.85, -0.58], say: (t) => D.draw(t), night(q, u, mv) { const rg = within(u, 4, 5.2) || within(u, 9, 9.6); ph += mv / 0.5; T.gait(legs, ph, 0.12, 0.3, 2, 0.8);
    hub.position.y = 1.0 - 0.03 * Math.abs(Math.sin(ph * 3 * Math.PI)); pend.rotation.z = rg ? 0.35 * Math.sin(q * 11) : 0.14 * Math.sin(q * 1.1); pend.rotation.x = 0.08 * Math.sin(q * 0.7);
    hl.material.opacity = rg ? 0.35 : 0.08; hl.scale.setScalar(rg ? 1.5 + 0.3 * Math.sin(q * 20) : 1); T.flick(face, u, 7, 10.2); } };
}
// Ticks: three small floor-cleaning units, boxy with brush skirts, a small display each. They skitter together and freeze together.
function ticksDeso(b, K, face) {
  const T = dkit(), all = []; let D = null;
  [[0, -0.28, 1], [-0.5, 0.32, 0.86], [0.48, 0.26, 1.1]].forEach(([x, z, s], n) => { const t = grp(x, 0, z, b); t.scale.setScalar(s); const body = grp(0, 0.16, 0, t);
    bx(0.44, 0.2, 0.5, T.civic, 0, 0.06, 0, body); bx(0.36, 0.12, 0.34, T.civic, 0, 0.21, 0.04, body); T.cylT(0.24, 0.26, 0.05, T.rubber, 0, -0.07, 0, body, 14);
    for (const [wx, wz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) { const w = T.cylT(0.06, 0.06, 0.05, T.rubber, wx, -0.08, wz, body, 10); w.rotation.z = Math.PI / 2; }
    const sg = grp(0, 0.2, -0.17, body); sg.rotation.x = -0.35; const d = T.display(sg, 0.2, 0.13, -0.02, 'ticks', K, face); if (!D) D = d; T.leaves(body, 2, 0.1, 0.3); all.push({ t, body, sg, x, z }); });
  let ph = 0;
  return { head: all[0].sg, heads: all.map((A) => A.sg), arms: [], top: 0.75, low: true, keepScale: true, lamp: [0.42, -0.48], say: (t) => D.draw(t), night(q, u, mv) { const held = within(u, 1.6, 2.4); if (!held) ph += 0.6 + mv * 14;
    for (const [n, T2] of all.entries()) { T2.t.position.x = T2.x + (held ? 0 : 0.06 * Math.sin(ph * 1.7 + n * 2)); T2.t.position.z = T2.z + (held ? 0 : 0.05 * Math.cos(ph * 1.3 + n)); T2.body.rotation.y = held ? 0 : 0.3 * Math.sin(ph * 0.9 + n * 3); T2.body.position.y = 0.16 + (held ? 0 : 0.008 * Math.sin(ph * 9 + n)); }
    T.flick(face, u, 0.5, 1.2); } };
}
// Warden: a security unit on tracks. A big armoured torso with two displays (one dead), heavy arms, a light bar. Slow; greets with both arms, rams.
function wardenDeso(b, K, face) {
  const T = dkit(), arms = []; const base = grp(0, 0, 0, b);
  for (const sx of [-1, 1]) { bx(0.34, 0.42, 1.3, T.rubber, sx * 0.55, 0.24, 0, base); for (let k = 0; k < 4; k++) { const w = T.cylT(0.16, 0.16, 0.36, T.grime, sx * 0.55, 0.2, -0.45 + k * 0.3, base, 10); w.rotation.z = Math.PI / 2; } }
  bx(0.8, 0.3, 1.1, T.grime, 0, 0.5, 0, base);
  const torso = grp(0, 0.7, 0, base); bx(1.15, 1.2, 0.8, T.civic, 0, 0.62, 0, torso); bx(1.2, 0.014, 0.84, DARK(), 0, 0.85, 0, torso); bx(1.2, 0.014, 0.84, DARK(), 0, 0.35, 0, torso); T.stencil(torso, 0.3, 0.2, -0.405, 0.4);
  const head = grp(0, 1.55, -0.02, torso); bx(0.9, 0.42, 0.5, T.civic, 0, 0, 0, head); const g1 = grp(-0.21, 0, 0, head), g2 = grp(0.21, 0, 0, head); const D = T.display(g1, 0.34, 0.27, -0.25, 'warden', K, face); T.display(g2, 0.34, 0.27, -0.25, 'warden', K, face, true);
  for (let k = 0; k < 5; k++) mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), k % 2 ? glow('wred', 0xff4030) : DARK(), -0.3 + k * 0.15, 0.24, -0.2, head);
  for (const sx of [-1, 1]) { const ar = grp(sx * 0.68, 1.1, 0, torso); arms.push(ar); T.boot(0.14, ar, 0); T.cylT(0.12, 0.11, 0.6, T.grime, 0, -0.3, 0, ar); const fa = grp(0, -0.6, 0, ar); ar.userData.fore = fa; T.boot(0.12, fa, 0); T.cylT(0.11, 0.1, 0.55, T.grime, 0, -0.27, 0, fa); bx(0.3, 0.12, 0.34, T.steel, 0, -0.6, -0.05, fa); }
  T.leaves(base, 10, 0.55, 0.8); let ph = 0;
  return { head: torso, arms, top: 3.0, keepScale: true, lamp: [2.4, -0.55], say: (t) => D.draw(t), night(q, u, mv) { const greet = within(u, 3, 6.5), ram = within(u, 6.5, 7); ph += mv;
    arms[0].rotation.z = greet ? -1.9 : 0.05 * Math.sin(ph * 2); arms[1].rotation.z = greet ? 1.9 : -0.05 * Math.sin(ph * 2); arms[0].userData.fore.rotation.z = greet ? -0.5 * (Math.floor(u * 1.2) % 2) : 0;
    torso.rotation.x = ram ? -0.25 : 0.02 * Math.sin(q * 1.4); torso.rotation.y = within(u, 9, 11) ? 0.45 : 0; torso.position.y = 0.7 + 0.01 * Math.sin(ph * 12); T.flick(face, u, 4, 10); } };
}
let GLOOMKIT_DESO = () => CONFIG.desolate.walker;
export function setDesoWalker(cfg) { GLOOMKIT_DESO = () => cfg.desolate.walker; }
const LEAFDEAD = () => { if (!mc.leafDead) { mc.leafDead = new THREE.MeshLambertMaterial({ color: 0x7a5a2a, side: THREE.DoubleSide }); mc.leafDead.userData.shared = true; } return mc.leafDead; };
// ---------------------------------------------------------------- 1b. Walker, reshaped (SAMPLE, gritty look only): no toy body. A tall thin service frame: bare struts, a rib cage you can see through, a battery slung inside, cables, long arms, a flat monitor for a head.
function walkerGrit(b, K, face) {
  const fr = pho('g3frame', { map: ptex('metal'), color: 0x4a4c50, shininess: 30, specular: 0x333333 }), pl = pho('g3plate', { map: ptex('paint'), color: 0x8a8474, shininess: 20, specular: 0x222222, side: THREE.DoubleSide }), dk = DARK(), cab = flat('g3cable', 0x18181b), cab2 = flat('g3cable2', 0x5a2420), legs = [], arms = [];
  const hipY = 1.3, TH = 0.62, SH = 0.64;
  for (const sx of [-1, 1]) { const hip = grp(sx * 0.13, hipY, 0, b); for (const dz of [-0.035, 0.035]) cyl(0.026, 0.026, TH, fr, 0, -TH / 2, dz, hip, 6); cyl(0.016, 0.016, TH * 0.7, dk, sx * 0.03, -TH * 0.45, 0.06, hip, 5).rotation.x = 0.1; const kh = cyl(0.045, 0.045, 0.1, dk, 0, -TH, 0, hip, 10); kh.rotation.z = Math.PI / 2;
    const knee = grp(0, -TH, 0, hip); cyl(0.03, 0.026, SH, fr, 0, -SH / 2, 0, knee, 6); seg(knee, [sx * 0.03, -0.05, 0.03], [sx * 0.025, -SH + 0.08, 0.04], 0.011, cab); bx(0.15, 0.035, 0.3, fr, 0, -SH + 0.015, -0.05, knee); bx(0.05, 0.08, 0.05, dk, 0, -SH + 0.06, 0.03, knee); legs.push({ hip, knee }); }
  bx(0.34, 0.09, 0.16, fr, 0, hipY + 0.02, 0, b); // pelvis bar
  // rib cage: four bent struts and three hoops, open between them
  const top = 2.12; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { seg(b, [sx * 0.13, hipY + 0.05, sz * 0.06], [sx * 0.2, hipY + 0.42, sz * 0.12], 0.021, fr); seg(b, [sx * 0.2, hipY + 0.42, sz * 0.12], [sx * 0.17, top, sz * 0.09], 0.021, fr); }
  for (const [y, rx, rz] of [[hipY + 0.2, 0.17, 0.1], [hipY + 0.45, 0.215, 0.13], [top - 0.14, 0.19, 0.105]]) { const h = mesh(new THREE.TorusGeometry(1, 0.016, 5, 18), fr, 0, y, 0, b); h.rotation.x = Math.PI / 2; h.scale.set(rx, rz, 1); }
  bx(0.2, 0.26, 0.11, dk, 0.01, hipY + 0.36, 0.01, b); bx(0.16, 0.035, 0.09, cab2, 0.01, hipY + 0.5, 0.01, b); // the battery slung inside
  seg(b, [0.06, hipY + 0.5, 0.02], [0.1, top - 0.05, -0.02], 0.011, cab); seg(b, [-0.05, hipY + 0.5, 0.0], [-0.14, hipY + 0.2, 0.08], 0.011, cab); seg(b, [-0.02, hipY + 0.24, 0.02], [-0.1, hipY - 0.12, 0.07], 0.011, cab2); // cables, one hanging loose below the hips
  { const p1 = bx(0.3, 0.3, 0.012, pl, 0.03, hipY + 0.52, -0.135, b); p1.rotation.set(0.05, 0, 0.3); const p2 = bx(0.2, 0.34, 0.012, pl, -0.16, hipY + 0.44, 0.1, b); p2.rotation.set(0, 0.9, 0.05); } // what is left of the casing: one front plate hanging by a corner, one side plate
  const shb = cyl(0.03, 0.03, 0.62, fr, 0, top, 0, b, 7); shb.rotation.z = Math.PI / 2;
  const UA = 0.5, FA = 0.52; for (const sx of [-1, 1]) { const sj = cyl(0.04, 0.04, 0.07, dk, sx * 0.32, top, 0, b, 9); sj.rotation.z = Math.PI / 2; const ar = grp(sx * 0.33, top, 0, b); arms.push(ar); cyl(0.024, 0.022, UA, fr, 0, -UA / 2, 0, ar, 6); const eh = cyl(0.03, 0.03, 0.06, dk, 0, -UA, 0, ar, 8); eh.rotation.z = Math.PI / 2; const fa = grp(0, -UA, 0, ar); ar.userData.fore = fa;
    cyl(0.021, 0.019, FA, fr, 0, -FA / 2, 0, fa, 6); seg(fa, [sx * 0.02, -0.03, 0.02], [sx * 0.018, -FA + 0.05, 0.02], 0.011, cab); bx(0.05, 0.05, 0.04, dk, 0, -FA, 0, fa);
    for (let k = 0; k < 3; k++) { const f = cyl(0.011, 0.009, 0.2, fr, (k - 1) * 0.02, -FA - 0.11, 0, fa, 5); f.rotation.set(0.12 * (k - 1), 0, -(k - 1) * 0.16); } }
  // neck and the monitor head
  cyl(0.03, 0.03, 0.26, fr, 0, top + 0.13, 0.01, b, 6); seg(b, [0.03, top, 0.04], [0.04, top + 0.3, 0.07], 0.011, cab); seg(b, [-0.03, top + 0.02, 0.04], [-0.06, top + 0.28, 0.06], 0.011, cab2);
  const head = grp(0, top + 0.42, 0, b); bx(0.5, 0.42, 0.13, fr, 0, 0, 0.01, head); bx(0.54, 0.03, 0.16, dk, 0, 0.22, 0.01, head); bx(0.1, 0.1, 0.06, dk, 0, -0.04, 0.1, head); screen(head, face, 0, 0, -0.058, 0.195, 0.95);
  { const an = cyl(0.009, 0.009, 0.34, dk, 0.16, 0.33, 0.04, head, 4); an.rotation.z = -0.25; } mossAt(head, -0.15, 0.19, 0.03, 0.05); mossAt(b, 0.18, hipY + 0.44, 0.1, 0.05);
  let ph = 0;
  return { head, arms, top: 3.15, night(q, u, mv) { const wv = within(u, 1, 9.4), frz = within(u, 9.4 - 2.4, 9.4), up = wv ? 1 : 0, s = frz ? 0.7 : Math.sin((u - 1) * 7.5);
    arms[0].rotation.z = up * 2.5; arms[0].rotation.x = up * -0.2; arms[0].userData.fore.rotation.z = up * (0.5 + 0.55 * s); arms[1].rotation.x = 0.08 * Math.sin(q * 1.3); head.rotation.z = frz ? 0.24 : 0.05 * Math.sin(q * 0.9); head.rotation.y = 0.12 * Math.sin(q * 0.6);
    face.color.setScalar(within(u, 3, 3.35) || within(u, 7.2, 7.55) ? 0.2 : 1); ph += mv / (2 * K.stride * K.leg / 0.6); stepLegs(legs, ph, K.stride * 0.8, 0.7); b.position.y = -0.03 * Math.abs(Math.sin(ph * 2 * Math.PI)); b.rotation.x = 0.06; } };
}
// ---------------------------------------------------------------- 2. Lurcher: the fast one. Hunched, huge tilted screen, knees the wrong way, rake hooks.
function lurcher(b, K, face) {
  const cu = paint('lurcher', K.body), cap = rusty('lcap', K.cap), jn = JOINT(), legs = [], arms = [];
  const torso = grp(0, 1.0, 0.05, b); const bean = ball(0.36, cu, 0, 0.12, 0, torso, 0.95, 1.05, 1.35); bean.rotation.x = -0.5; ball(0.2, cap, 0, -0.05, 0.3, torso, 1.4, 0.8, 1);
  for (const sx of [-1, 1]) { const hip = grp(sx * 0.2, 0.95, 0.12, b); seg(hip, [0, 0, 0], [0, -0.38, 0.3], 0.06, cu, 0.07); ball(0.085, jn, 0, -0.38, 0.3, hip); const knee = grp(0, -0.38, 0.3, hip); seg(knee, [0, 0, 0], [0, -0.5, -0.36], 0.05, cu, 0.045); ball(0.13, metal('foot', 0x9a9aa6), 0, -0.52, -0.4, knee, 1, 0.4, 1.5); legs.push({ hip, knee }); }
  const head = grp(0, 1.42, -0.42, b); head.rotation.z = 0.16; ball(0.38, cu, 0, 0, 0.06, head, 1, 1, 0.8); screen(head, face, 0, 0, -0.26, 0.33, 1); for (let k = 0; k < 9; k++) { const a = k * 0.7; ball(0.022, DARK(), Math.cos(a) * 0.4, Math.sin(a) * 0.4, -0.12, head); }
  seg(b, [0, 1.2, -0.1], [0, 1.36, -0.3], 0.08, jn);
  for (const sx of [-1, 1]) { ball(0.15, cap, sx * 0.4, 1.25, 0.02, b, 1, 0.75, 1); const ar = grp(sx * 0.42, 1.22, 0, b); arms.push(ar); seg(ar, [0, 0, 0], [sx * 0.06, -0.45, -0.1], 0.045, cu); ball(0.065, jn, sx * 0.06, -0.45, -0.1, ar); const fa = grp(sx * 0.06, -0.45, -0.1, ar); ar.userData.fore = fa; seg(fa, [0, 0, 0], [0, -0.42, -0.14], 0.04, cu); ball(0.06, jn, 0, -0.42, -0.14, fa);
    for (let k = 0; k < 4; k++) seg(fa, [(k - 1.5) * 0.035, -0.44, -0.14], [(k - 1.5) * 0.05, -0.76, -0.2 - (k % 2) * 0.03], 0.011, BRASS()); }
  { const fg = grp(0.04, 1.36, 0.2, b); fg.rotation.set(0.5, 0, -0.25); petal(fg, 0.55, 0.3, BM.cell); }
  const sparks = []; for (let k = 0; k < 4; k++) sparks.push(ball(0.018, glow('amber', 0xffc040), 0.1 + k * 0.05, 1.86 + (k % 2) * 0.07, 0.32 - k * 0.03, b));
  leafAt(b, -0.16, 1.5, 0.3, 0.36, 0.4, -0.6); leafAt(b, 0.2, 1.42, 0.38, 0.3, -0.9, -0.5); leafAt(b, -0.05, 1.28, 0.5, 0.26, 2.2, -0.7); mossAt(b, 0.1, 1.42, 0.2, 0.1); mossAt(b, -0.3, 1.34, 0.0, 0.07);
  let ph = 0;
  return { head, arms, top: 2.25, night(q, u, mv) { const lunge = within(u, 4, 4.35) || within(u, 8.2, 8.5); torso.rotation.x = lunge ? -0.38 : 0; head.position.z = lunge ? -0.6 : -0.42;
    head.rotation.z = within(u, 2.5, 3.6) ? 0.95 : within(u, 6, 7.1) ? -0.9 : 0.16; arms[0].rotation.x = lunge ? -1.3 : 0.1; arms[1].rotation.x = within(u, 5, 6.6) ? 1.9 : (lunge ? -1.3 : 0.1); arms[1].userData.fore.rotation.x = within(u, 5, 6.6) ? -1.2 : 0;
    for (const s of sparks) s.visible = Math.sin(q * 31 + s.position.x * 90) > 0.2; ph += mv / (2 * K.stride * K.leg / 0.6); stepLegs(legs, ph, K.stride, -0.5); b.position.y = -0.05 * Math.abs(Math.sin(ph * 2 * Math.PI)); } };
}
// ---------------------------------------------------------------- 3. Hauler: the tough one. Barrel with a belly screen, one amber eye, crusher clamps.
function hauler(b, K, face) {
  const ir = paint('hauler', K.body), pl = paint('haulp', 0xb8bcc8), cap = rusty('hcap', K.cap), jn = JOINT(), legs = [], arms = [];
  lathe([[0.3, 0.72], [0.52, 0.82], [0.64, 1.1], [0.66, 1.4], [0.58, 1.66], [0.4, 1.8], [0.2, 1.84]].map((q) => new THREE.Vector2(q[0], q[1])), 16, ir, b);
  for (const y of [0.92, 1.62]) { const t = mesh(new THREE.TorusGeometry(y < 1 ? 0.57 : 0.6, 0.03, 6, 22), cap, 0, y, 0, b); t.rotation.x = Math.PI / 2; } for (let k = 0; k < 14; k++) ball(0.02, BRASS(), Math.cos(k * 0.449) * 0.63, 1.62, Math.sin(k * 0.449) * 0.63, b);
  screen(b, face, 0, 1.28, -0.655, 0.34, 0.82);
  const tp = bx(0.3, 0.26, 0.03, pl, 0.34, 0.98, -0.56, b); tp.rotation.set(-0.5, -0.5, 0.5); const gear = mesh(new THREE.TorusGeometry(0.07, 0.022, 5, 9), BRASS(), 0.3, 1.0, -0.58, b); gear.rotation.y = -0.5; seg(b, [0.26, 0.98, -0.58], [0.2, 0.7, -0.62], 0.008, WIRE()); seg(b, [0.34, 0.98, -0.58], [0.38, 0.74, -0.6], 0.008, WIRE());
  const head = grp(0, 1.95, 0, b); mesh(new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), ir, 0, -0.06, 0, head); const eye = ball(0.075, glow('amber', 0xffc040), 0, 0.02, -0.2, head); mesh(new THREE.TorusGeometry(0.085, 0.02, 5, 12), DARK(), 0, 0.02, -0.195, head);
  for (const sx of [-1, 1]) { ball(0.3, cap, sx * 0.84, 1.68, 0, b, 1, 0.8, 1); const ar = grp(sx * 0.86, 1.6, 0, b); arms.push(ar); cyl(0.15, 0.13, 0.5, ir, 0, -0.3, 0, ar); ball(0.16, jn, 0, -0.58, 0, ar); const fa = grp(0, -0.58, 0, ar); ar.userData.fore = fa; cyl(0.14, 0.16, 0.46, ir, 0, -0.26, 0, fa); seg(fa, [sx * 0.15, 0.05, 0], [sx * 0.15, -0.4, -0.05], 0.02, BRASS());
    bx(0.1, 0.34, 0.26, pl, -0.11, -0.64, -0.03, fa).rotation.z = 0.12; if (sx < 0) bx(0.1, 0.34, 0.26, pl, 0.11, -0.64, -0.03, fa).rotation.z = -0.12; else { bx(0.1, 0.14, 0.26, pl, 0.11, -0.54, -0.03, fa).rotation.z = -0.4; seg(fa, [0.1, -0.56, 0], [0.16, -0.8, 0.02], 0.007, WIRE()); } }
  for (const sx of [-1, 1]) { const hip = grp(sx * 0.3, 0.74, 0, b); cyl(0.17, 0.15, 0.3, ir, 0, -0.16, 0, hip); const knee = grp(0, -0.32, 0, hip); ball(0.16, jn, 0, 0, 0, knee); cyl(0.14, 0.17, 0.26, ir, 0, -0.16, 0, knee); ball(0.26, metal('foot', 0x9a9aa6), 0, -0.34, -0.06, knee, 1, 0.36, 1.4); legs.push({ hip, knee }); }
  leafAt(b, -0.8, 1.98, 0.05, 0.5, 0.6, -0.9); leafAt(b, 0.74, 1.96, 0.12, 0.42, -1.2, -0.8); leafAt(b, 0.5, 0.9, 0.5, 0.36, 2.0, -0.4); mossAt(b, -0.84, 1.9, 0, 0.16); mossAt(b, 0.3, 1.82, 0.2, 0.12); mossAt(b, -0.4, 1.0, -0.42, 0.1);
  let ph = 0;
  return { head, arms, top: 2.6, night(q, u, mv) { const ham = within(u, 7, 9.8), k = ham ? Math.floor((u - 7) / 0.4) : 0, dn = ham && ((u - 7) % 0.4) > 0.2;
    arms[0].rotation.x = ham ? (dn ? -0.5 : -3.3) : within(u, 3.5, 6) ? -3.3 : 0.05; arms[1].rotation.x = within(u, 3.5, 6) ? 1.7 : 0.05; arms[0].userData.fore.rotation.x = ham && dn ? -0.6 : 0; head.rotation.y = 0.5 * Math.sin(Math.floor(q) * 2.3 + k);
    face.color.setScalar(within(u, 6, 7.2) ? 0.04 : 1); eye.scale.setScalar(within(u, 6, 7.2) ? 1.5 : 1); const stall = within(u % 3, 2.1, 3); ph += (stall ? 0 : mv) / (2 * K.stride * K.leg / 0.6); stepLegs(legs, ph, K.stride, 0.4); b.rotation.z = 0.05 * Math.sin(ph * 2 * Math.PI); } };
}
// ---------------------------------------------------------------- 4. Stilt: reaches over walls. Very tall and thin, teardrop head, needle pincers.
function stilt(b, K, face) {
  const en = paint('stilt', K.body), cap = rusty('scap', K.cap), jn = JOINT(), legs = [], arms = [];
  for (const sx of [-1, 1]) { const hip = grp(sx * 0.1, 1.55, 0, b); seg(hip, [0, 0, 0], [sx > 0 ? 0.09 : 0, -0.72, 0], 0.034, en); const knee = grp(sx > 0 ? 0.09 : 0, -0.72, 0, hip); ball(0.06, cap, 0, 0, 0, knee); seg(knee, [0, 0, 0], [sx > 0 ? -0.08 : 0, -0.76, 0], 0.03, en); ball(0.085, metal('foot', 0x9a9aa6), sx > 0 ? -0.08 : 0, -0.79, -0.03, knee, 1, 0.45, 1.5); legs.push({ hip, knee }); }
  ball(0.11, cap, 0, 1.56, 0, b, 1.3, 0.8, 1); const up = grp(0, 1.56, 0, b); seg(up, [0, 0, 0], [0, 0.34, 0], 0.03, jn); ball(0.17, en, 0, 0.5, 0, up, 1, 1.25, 0.8); { const sg = grp(0, 0.38, 0.16, up); sg.rotation.x = 0.25; petal(sg, 0.5, 0.36, BM.cell); }
  mesh(new THREE.CircleGeometry(0.05, 10), DARK(), 0, 0.5, -0.137, up).rotation.y = Math.PI; seg(up, [0, 0.7, 0], [0, 0.95, 0], 0.022, jn);
  const head = grp(0, 1.14, 0, up); ball(0.2, en, 0, 0, 0, head, 0.9, 1.5, 0.9); screen(head, face, 0, -0.02, -0.176, 0.135, 1.55); seg(head, [0.03, 0.28, 0], [0.06, 0.44, 0.02], 0.008, jn); seg(head, [0.06, 0.44, 0.02], [0.2, 0.4, 0.06], 0.008, jn); seg(head, [0.2, 0.4, 0.06], [0.22, 0.24, 0.07], 0.004, WIRE());
  for (const sx of [-1, 1]) { ball(0.06, cap, sx * 0.2, 0.6, 0, up); const ar = grp(sx * 0.2, 0.6, 0, up); arms.push(ar); seg(ar, [0, 0, 0], [sx * 0.03, -0.5, 0], 0.022, en); ball(0.04, cap, sx * 0.03, -0.5, 0, ar); const fa = grp(sx * 0.03, -0.5, 0, ar); ar.userData.fore = fa; seg(fa, [0, 0, 0], [0, -0.5, -0.04], 0.018, en); ball(0.035, jn, 0, -0.5, -0.04, fa);
    seg(fa, [-0.015, -0.5, -0.04], [-0.05, -0.74, -0.06], 0.006, BRASS()); if (sx < 0) seg(fa, [0.015, -0.5, -0.04], [0.05, -0.74, -0.06], 0.006, BRASS()); }
  for (let k = 0; k < 5; k++) leafAt(b, -0.1 + 0.05 * Math.sin(k * 2), 0.25 + k * 0.24, 0.04 * Math.cos(k * 2), 0.14, k * 1.3, 0.3); seg(b, [-0.1, 0.05, 0.03], [-0.1, 1.3, 0.0], 0.006, LEAF()); mossAt(b, -0.1, 0.07, 0.02, 0.06); sprout(up, -0.05, 0.72, 0.06, 0.8);
  let ph = 0;
  return { head, arms, top: 3.55, night(q, u, mv) { const away = within(u, 3, 5); up.rotation.y = away ? 2.1 : 0; head.rotation.y = within(u, 3.4, 5) ? -2.1 : 0; const reach = within(u, 5, 7.4), st = reach ? Math.min(1, Math.floor((u - 5) * 5) / 6) : 0;
    arms[0].rotation.x = -2.5 * st; arms[0].userData.fore.rotation.x = -0.5 * st; arms[1].rotation.x = within(u, 9, 10.5) ? -1.2 : 0; up.rotation.x = -0.35 * st; head.rotation.z = within(u, 8, 9) ? 1.2 : 0;
    ph += mv / (2 * K.stride * K.leg / 0.6); stepLegs(legs, ph, K.stride, 0.5); } };
}
// ---------------------------------------------------------------- 5. Lantern: shoot it first. A lamp head hung in a three-legged hooped frame; it rings and the others hurry.
function lantern(b, K, face) {
  const br = metal('lbrass', K.body), soot = rusty('soot', 0x55504a), legs = [], arms = [];
  const ring = mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 18), br, 0, 2.2, 0, b); ring.rotation.x = Math.PI / 2;
  for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.52, hip = grp(Math.cos(a) * 0.3, 2.2, Math.sin(a) * 0.3, b); seg(hip, [0, 0, 0], [Math.cos(a) * 0.32, -1.15, Math.sin(a) * 0.32], 0.028, soot); seg(hip, [Math.cos(a) * 0.32, -1.15, Math.sin(a) * 0.32], [Math.cos(a) * 0.42, -2.16, Math.sin(a) * 0.42], 0.024, soot); ball(0.07, br, Math.cos(a) * 0.42, -2.17, Math.sin(a) * 0.42, hip, 1, 0.5, 1); ball(0.05, br, Math.cos(a) * 0.32, -1.15, Math.sin(a) * 0.32, hip); legs.push({ hip, a }); }
  const hoop = mesh(new THREE.TorusGeometry(0.62, 0.02, 5, 22), br, 0.05, 1.08, 0, b); hoop.rotation.set(Math.PI / 2 + 0.22, 0.1, 0); hoop.scale.set(1, 0.86, 1);
  const pend = grp(0, 2.2, 0, b); seg(pend, [0, 0, 0], [0, -0.14, 0], 0.012, soot); const head = grp(0, -0.42, 0, pend); cyl(0.1, 0.16, 0.08, br, 0, 0.27, 0, head); cyl(0.16, 0.1, 0.08, br, 0, -0.27, 0, head);
  mesh(new THREE.SphereGeometry(0.27, 14, 10), lam('gk_glass', { color: 0x30281c, transparent: true, opacity: 0.38, depthWrite: false }), 0, 0, 0, head); const sc = mesh(new THREE.CircleGeometry(0.2, 18), face, 0, 0, -0.1, head); sc.rotation.y = Math.PI; const halo = ball(0.3, new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.0, depthWrite: false }), 0, 0, 0, head);
  ball(0.2, soot, 0, -0.52, 0, head, 1, 0.9, 1); mesh(new THREE.TorusGeometry(0.2, 0.018, 5, 14), br, 0, -0.52, 0, head).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) { const ar = grp(sx * 0.22, -0.5, 0, head); arms.push(ar); for (let k = 0; k < 4; k++) cyl(0.07 - (k % 2) * 0.02, 0.07 - (k % 2) * 0.02, 0.035, k % 2 ? br : soot, sx * (0.03 + k * 0.035), -0.02 * k, 0, ar, 8).rotation.z = Math.PI / 2; }
  for (let k = 0; k < 4; k++) leafAt(b, Math.cos(0.52) * (0.34 + k * 0.03), 1.9 - k * 0.3, Math.sin(0.52) * (0.34 + k * 0.03), 0.16, k * 1.7, 0.3); mossAt(b, Math.cos(2.61) * 0.42, 0.06, Math.sin(2.61) * 0.42, 0.07); sprout(b, 0.12, 2.22, 0.2, 0.9);
  let ph = 0;
  return { head: pend, arms, top: 2.75, night(q, u, mv) { const rg = within(u, 4, 5.2) || within(u, 9, 9.6); pend.rotation.z = rg ? 0.5 * Math.sin(q * 14) : 0.22 * Math.sin(q * 1.1); pend.rotation.x = 0.12 * Math.sin(q * 0.7); face.color.setScalar(rg ? 1.8 : within(u, 7, 7.3) ? 0.15 : 1); halo.material.opacity = rg ? 0.35 : 0.06; halo.scale.setScalar(rg ? 1.5 + 0.3 * Math.sin(q * 20) : 1);
    for (const ar of arms) ar.scale.x = rg ? 1.6 : 1; ph += mv * 1.6; const i = Math.floor(ph) % 3; legs.forEach((L, k) => { L.hip.rotation.x = k === i ? 0.22 * Math.sin((ph % 1) * Math.PI) * Math.sin(L.a) : 0; L.hip.rotation.z = k === i ? -0.22 * Math.sin((ph % 1) * Math.PI) * Math.cos(L.a) : 0; }); } };
}
// ---------------------------------------------------------------- 6. Ticks: the swarm. Three plate-sized domes on six legs, a screen on top; they all stop at once.
function ticks(b, K, face) {
  const tin = paint('ticks', K.body), cap = rusty('tcap', K.cap), all = [];
  [[0, -0.28, 1], [-0.46, 0.3, 0.86], [0.44, 0.24, 1.12]].forEach(([x, z, s], n) => { const t = grp(x, 0, z, b); t.scale.setScalar(s); const body = grp(0, 0.24, 0, t); mesh(new THREE.SphereGeometry(0.27, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), tin, 0, 0, 0, body).scale.y = 0.62; cyl(0.275, 0.25, 0.05, cap, 0, -0.02, 0, body, 12);
    const sg = grp(0, 0.13, -0.1, body); sg.rotation.x = 1.0; const sc = mesh(new THREE.CircleGeometry(0.115, 14), face, 0, 0, -0.012, sg); sc.rotation.y = Math.PI; mesh(new THREE.TorusGeometry(0.115, 0.014, 5, 14), DARK(), 0, 0, 0, sg);
    const lg = []; for (let k = 0; k < 6; k++) { if (n === 1 && k === 4) continue; const a = (k < 3 ? -1 : 1) * (0.6 + (k % 3) * 0.95) + Math.PI / 2, L = grp(Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24, body); seg(L, [0, 0, 0], [Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14], 0.014, DARK()); seg(L, [Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14], [Math.cos(a) * 0.24, -0.24, Math.sin(a) * 0.24], 0.011, DARK()); lg.push({ L, a, k }); }
    if (n === 2) seg(t, [0, 0.2, 0.26], [0.1, 0.02, 0.7], 0.008, WIRE()); if (n === 0) sprout(body, 0.08, 0.14, 0.08, 0.7); else mossAt(body, n === 1 ? -0.1 : 0.12, 0.14, 0.1, 0.07); leafAt(body, -0.15, 0.1, 0.12, 0.12, n * 2.1, 0.2);
    all.push({ t, body, sg, lg, x, z }); });
  let ph = 0;
  return { head: all[0].sg, arms: [], top: 1.15, low: true, night(q, u, mv) { const held = within(u, 1.6, 2.4); if (!held) ph += 0.9 + mv * 20;
    for (const [n, T] of all.entries()) { T.t.position.x = T.x + (held ? 0 : 0.05 * Math.sin(ph * 1.7 + n * 2)); T.t.position.z = T.z + (held ? 0 : 0.05 * Math.cos(ph * 1.3 + n)); T.body.rotation.y = held ? 0 : 0.25 * Math.sin(ph * 0.9 + n * 3); T.sg.rotation.x = held ? 0.45 : 1.0; T.body.position.y = held ? 0.2 : 0.24 + 0.015 * Math.sin(ph * 3 + n);
      for (const l of T.lg) l.L.rotation.y = held ? 0 : 0.35 * Math.sin(ph * 2.2 + l.k * 2.1 + n); } } };
}
// ---------------------------------------------------------------- 7. Warden: the rare big one. Two screens (one dead) on a boiler torso, on tracks; a shovel hand and a stump.
function warden(b, K, face) {
  const bo = paint('warden', K.body), dk = rusty('wdark', K.cap), jn = JOINT(), arms = [], wheels = [];
  bx(1.3, 0.34, 1.35, dk, 0, 0.42, 0, b); for (const sx of [-1, 1]) { const tr = bx(0.3, 0.5, 1.6, rusty('track', 0x4a4640), sx * 0.74, 0.27, 0, b); for (let k = 0; k < 4; k++) { const w = cyl(0.2, 0.2, 0.32, jn, sx * 0.74, 0.22, -0.6 + k * 0.4, b, 10); w.rotation.z = Math.PI / 2; wheels.push(w); } for (const z of [-0.8, 0.8]) { const e = cyl(0.25, 0.25, 0.3, tr.material, sx * 0.74, 0.27, z, b, 10); e.rotation.z = Math.PI / 2; } }
  cyl(0.3, 0.42, 0.5, dk, 0, 0.84, 0, b, 12); const torso = grp(0, 1.75, 0, b); ball(1, bo, 0, 0, 0, torso, 1.02, 0.74, 0.62);
  for (let k = 0; k < 16; k++) { const a = k / 15 * Math.PI; ball(0.022, BRASS(), Math.cos(a) * 0.98, 0.3 * Math.sin(a * 2), -Math.sin(a) * 0.58, torso); }
  screen(torso, face, -0.4, 0.06, -0.575, 0.29, 0.9); const deadM = new THREE.MeshBasicMaterial({ map: faceTex('dead', K) }); const ds = screen(torso, deadM, 0.4, 0.06, -0.575, 0.29, 0.9); ds.rotation.z = 0.12;
  const seam = bx(0.03, 0.62, 0.02, glow('amber', 0xffc040), 0.02, -0.02, -0.625, torso); seam.rotation.z = 0.3;
  cyl(0.14, 0.18, 0.4, dk, -0.3, 0.86, 0.1, torso, 10); cyl(0.2, 0.14, 0.06, dk, -0.3, 1.08, 0.1, torso, 10); mesh(new THREE.TorusGeometry(0.1, 0.018, 5, 12), BRASS(), 0.3, 0.8, 0.05, torso).rotation.x = Math.PI / 2;
  { const ar = grp(-1.02, 0.25, 0, torso); arms.push(ar); ball(0.26, dk, 0, 0, 0, ar); cyl(0.13, 0.11, 0.62, bo, 0, -0.4, 0, ar); const fa = grp(0, -0.72, 0, ar); ar.userData.fore = fa; ball(0.13, jn, 0, 0, 0, fa); cyl(0.1, 0.12, 0.5, bo, 0, -0.28, 0, fa); const sh = bx(0.5, 0.42, 0.06, rusty('shovel', 0x8a8c94), 0, -0.74, -0.05, fa); sh.rotation.x = 0.2; bx(0.5, 0.06, 0.2, sh.material, 0, -0.94, -0.14, fa); }
  { const ar = grp(1.02, 0.25, 0, torso); arms.push(ar); ball(0.26, dk, 0, 0, 0, ar); cyl(0.13, 0.11, 0.42, bo, 0, -0.3, 0, ar); const fa = grp(0, -0.52, 0, ar); ar.userData.fore = fa; for (let k = 0; k < 3; k++) seg(fa, [(k - 1) * 0.04, 0, 0], [(k - 1) * 0.1, -0.2 - k * 0.05, 0.04 * k], 0.008, WIRE()); }
  const vine = lam('gk_vine', { map: ptex('vine'), alphaTest: 0.45, side: THREE.DoubleSide }); for (const [x, y, z, ry, w] of [[-0.6, 0.2, 0.42, 0.3, 1.1], [0.7, 0.1, 0.3, -0.5, 0.9], [0.1, 0.3, 0.6, 0, 1.3], [0.9, 0.0, -0.38, 0.9, 0.7]]) { const v = mesh(new THREE.PlaneGeometry(w, w * 1.2), vine, x, y, z, torso); v.rotation.y = ry; } mossAt(torso, -0.5, 0.72, 0.1, 0.2); mossAt(torso, 0.6, 0.66, 0, 0.16); sprout(torso, 0.5, 0.7, 0.1, 1.4);
  let ph = 0;
  return { head: torso, arms, top: 3.2, night(q, u, mv) { const greet = within(u, 3, 6.5), ram = within(u, 6.5, 7); arms[0].rotation.z = greet ? -2.2 : 0; arms[1].rotation.z = greet ? 2.2 : 0; arms[0].userData.fore.rotation.z = greet ? -0.6 * (Math.floor(u * 2) % 2) : 0; torso.rotation.x = ram ? -0.22 : greet ? 0.06 : 0; torso.rotation.y = within(u, 9, 11) ? 0.5 : 0;
    deadM.color.setScalar(within(u, 11.2, 11.35) || within(u, 12.1, 12.2) ? 2.2 : 1); seam.scale.y = 0.8 + 0.2 * Math.sin(q * 9); face.color.setScalar(within(u, 8, 8.3) ? 0.2 : 1); ph += mv * 3; for (const w of wheels) w.rotation.x = ph; b.position.y = 0.012 * Math.sin(q * 30) * (mv > 0 ? 1 : 0); } };
}
// Wear and tear and missing parts, different on every machine (GLOOMKIT.wear).
function wearAndTear(b, P, face) {
  const hiNow = HIGLOOM && DESO.machines, W = GLOOMKIT.wear, rnd = Math.random, ri = (a) => a[0] + Math.floor(rnd() * (a[1] - a[0] + 1)), meshes = [], small = [], v = new THREE.Vector3();
  b.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(b.matrixWorld).invert();
  b.traverse((o) => { if (!o.isMesh || !o.geometry.attributes.position) return; const k = o.material.userData.k || ''; if (k.startsWith('gk_p') || k === 'w2body' || (hiNow ? k === 'dWbody' || k === 'dWleg' : k.startsWith('dW'))) meshes.push(o); if (/^(gk_r[wlhst]cap|w2cap|gk_mbrass)$/.test(k) || o.material === BM.cell) small.push(o); });
  // a point on the machine's skin, in the body's own space
  const nrm = new THREE.Vector3(), skin0 = () => { const o = meshes[Math.floor(rnd() * meshes.length)], P2 = o.geometry.attributes.position, N2 = o.geometry.attributes.normal, i = Math.floor(rnd() * P2.count); v.fromBufferAttribute(P2, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); if (N2) nrm.fromBufferAttribute(N2, i).transformDirection(o.matrixWorld).transformDirection(inv); else nrm.set(0, 0, -1); return v; };
  // desktop builds: a machine is many plates, so a mark goes at a random point inside a random plate face (not at a corner), facing the way that face does; slivers (bevels, bolts) are passed over
  const ta = new THREE.Vector3(), tb = new THREE.Vector3(), tc = new THREE.Vector3(), skin = !hiNow ? skin0 : () => { const o = meshes[Math.floor(rnd() * meshes.length)], P2 = o.geometry.attributes.position, nt = P2.count / 3;
    for (let t = 0; t < CONFIG.quality.high.gloom.markTries; t++) { const i = Math.floor(rnd() * nt) * 3; ta.fromBufferAttribute(P2, i); tb.fromBufferAttribute(P2, i + 1); tc.fromBufferAttribute(P2, i + 2); nrm.copy(tb).sub(ta).cross(v.copy(tc).sub(ta)); if (nrm.length() > CONFIG.quality.high.gloom.markFace || t === CONFIG.quality.high.gloom.markTries - 1) break; }
    let u = rnd(), w = rnd(); if (u + w > 1) { u = 1 - u; w = 1 - w; } v.copy(ta).addScaledVector(tb.sub(ta), u).addScaledVector(tc.sub(ta), w).applyMatrix4(o.matrixWorld).applyMatrix4(inv); nrm.normalize().transformDirection(o.matrixWorld).transformDirection(inv); return v; };
  // a painted mark (klad burn or rust bloom) laid flat on the skin where it was sampled, its runs pointing down
  const dm = (k) => { if (!mc['dec' + k]) { mc['dec' + k] = new THREE.MeshLambertMaterial({ map: ptex(k), transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }); mc['dec' + k].userData.shared = true; mc['dec' + k].userData.decal = true; } return mc['dec' + k]; };
  const mark = (k, size) => { const q = skin(), o = mesh(new THREE.PlaneGeometry(size, size), dm(k), q.x + nrm.x * 0.012, q.y + nrm.y * 0.012, q.z + nrm.z * 0.012, b); o.lookAt(q.x + nrm.x, q.y + nrm.y, q.z + nrm.z); if (k !== 'stain') o.rotateZ(rnd() * 6.28); return o; };
  // where a part has gone: a bare mount with a torn, jagged rim and a loose wire
  const stump = (o) => { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const r = Math.min(0.16, Math.max(0.03, o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) * 0.45)), st = grp(o.position.x, o.position.y, o.position.z, o.parent); ball(r * 0.7, DARK(), 0, 0, 0, st, 1, 0.6, 1);
    for (let k = 0; k < 6; k++) { const a = k * 1.047 + rnd(), c = mesh(new THREE.ConeGeometry(r * 0.22, r * (0.5 + rnd()), 4), JOINT(), Math.cos(a) * r * 0.75, 0.01, Math.sin(a) * r * 0.75, st); c.rotation.set((rnd() - 0.5) * 1.2, a, (rnd() - 0.5) * 1.2); }
    seg(st, [0, 0, 0], [r * (rnd() - 0.5) * 2, -r * (1 + rnd()), r * (rnd() - 0.5)], 0.005, rnd() < 0.5 ? WIRE() : flat('wirey', 0xe0c040)); };
  // small parts gone
  let lost = 0; for (const o of small.sort(() => rnd() - 0.5)) { if (lost >= W.loseMax) break; if (rnd() < W.lose) { o.visible = false; lost++; if (o.material !== BRASS()) stump(o); } }
  // one forearm torn off: a dark stump, three wires, a spark
  const arms = P.arms.filter((a) => a.userData.fore); if (arms.length && rnd() < W.arm) { const a = arms[Math.floor(rnd() * arms.length)], f = a.userData.fore; f.visible = false; const st = grp(f.position.x, f.position.y, f.position.z, a); ball(0.05, DARK(), 0, 0, 0, st); for (let k = 0; k < 3; k++) seg(st, [(k - 1) * 0.02, 0, 0], [(k - 1) * 0.06, -0.1 - 0.12 * rnd(), 0.05 * (rnd() - 0.5)], 0.006, k === 1 ? flat('wirey', 0xe0c040) : WIRE()); ball(0.018, glow('amber', 0xffc040), 0, -0.03, 0, st); }
  // a machine with no builder-painted casing (the desktop Walker from its Blender model, src/gloomglb.js, carries its wear in its textures) still gets its lean and its dim screen
  if (!meshes.length) { if (!P.low) b.rotation.z += (rnd() - 0.5) * 2 * W.lean; if (rnd() < W.dim) face.userData.dim = 0.55 + 0.3 * rnd(); return; }
  const blot = (r, m, q, sy) => { const o = mesh(new THREE.SphereGeometry(r, 6, 4), m, q.x, q.y, q.z, b); o.scale.set(1, sy, 1); return o; }; // marks are cheap shapes: 48 triangles each
  if (GRITTY && !hiNow) { // holes and cracks go on the big casings (body, head), mostly where you can see them: front and sides, sized to the part
    const big = meshes.map((o) => { o.geometry.computeBoundingSphere(); const s = new THREE.Vector3(); o.getWorldScale(s); return [o, o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z)]; }).sort((a, c) => c[1] - a[1]).slice(0, 3);
    const onBig = (k, f0, f1) => { const [o, R] = big[Math.floor(rnd() * rnd() * big.length)], P2 = o.geometry.attributes.position, N2 = o.geometry.attributes.normal; let i = 0; for (let t = 0; t < 8; t++) { i = Math.floor(rnd() * P2.count); v.fromBufferAttribute(P2, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); nrm.fromBufferAttribute(N2, i).transformDirection(o.matrixWorld).transformDirection(inv); if (nrm.z < 0.25 && Math.abs(nrm.y) < 0.8) break; }
      const size = R * (f0 + (f1 - f0) * rnd()), d = mesh(new THREE.PlaneGeometry(size, size), dm(k), v.x + nrm.x * 0.014, v.y + nrm.y * 0.014, v.z + nrm.z * 0.014, b); d.lookAt(v.x + nrm.x, v.y + nrm.y, v.z + nrm.z); d.rotateZ(rnd() * 6.28); d.renderOrder = k === 'hole' ? 3 : 2; };
    if (big.length) { for (let k = ri(GRIT.holes); k > 0; k--) onBig('hole', GRIT.holeSize[0], GRIT.holeSize[1]); for (let k = ri(GRIT.cracks); k > 0; k--) onBig('crack', GRIT.crackSize[0], GRIT.crackSize[1]); } }
  if (DESO.machines && !hiNow) { // desolate look (the desktop builds lay their own marks, cut to their plates): years outside, rolled new for every machine: mud splashed up from the ground, rust blooms, soot-blackened patches, moss; every one in a different random place
    const G = GLOOMKIT_DESO().grime, low = () => { let best = null; for (let t = 0; t < G.mudTries; t++) { const q = skin(); if (!best || q.y < best.q.y) best = { q: q.clone(), n: nrm.clone() }; } return best; };
    const at = (k, size, q, n) => { const o = mesh(new THREE.PlaneGeometry(size, size * (0.7 + 0.6 * rnd())), dm(k), q.x + n.x * 0.013, q.y + n.y * 0.013, q.z + n.z * 0.013, b); o.lookAt(q.x + n.x, q.y + n.y, q.z + n.z); o.rotateZ(k === 'carrust' ? 0 : rnd() * 6.28); return o; };
    for (let k = ri(G.mud); k > 0; k--) { const s0 = low(); at('footgrime', G.mudSize[0] + rnd() * (G.mudSize[1] - G.mudSize[0]), s0.q, s0.n); }
    for (let k = ri(G.rust); k > 0; k--) { const q = skin().clone(), n = nrm.clone(); at(rnd() < 0.5 ? 'carrust' : 'stain', G.rustSize[0] + rnd() * (G.rustSize[1] - G.rustSize[0]), q, n); }
    for (let k = ri(G.soot); k > 0; k--) { const q = skin().clone(), n = nrm.clone(); at('scorch', G.sootSize[0] + rnd() * (G.sootSize[1] - G.sootSize[0]), q, n); }
    for (let k = ri(G.moss); k > 0; k--) { const q = skin().clone(), n = nrm.clone(); at('moss', G.mossSize[0] + rnd() * (G.mossSize[1] - G.mossSize[0]), q, n); }      // painted moss, not the round pads (they read as green pancakes)
  }
  if (!hiNow) for (let k = ri(W.scorch); k > 0; k--) mark('scorch', 0.16 + 0.2 * rnd());
  if (!hiNow) for (let k = ri(W.rust); k > 0; k--) mark('stain', 0.18 + 0.22 * rnd());
  if (!hiNow) for (let k = ri(GRITTY ? GRIT.wires : W.wires); k > 0; k--) { const q = skin(), x = q.x, y = q.y, z = q.z; seg(b, [x, y, z], [x + 0.08 * (rnd() - 0.5), y - 0.12 - 0.25 * rnd(), z + 0.08 * (rnd() - 0.5)], 0.006, rnd() < 0.5 ? WIRE() : flat('wirey', 0xe0c040)); }
  if (!hiNow) for (let k = ri(W.moss); k > 0; k--) { const q = skin(); blot(0.05 + 0.06 * rnd(), MOSS(), q, 0.45); }
  if (!P.low) b.rotation.z += (rnd() - 0.5) * 2 * W.lean; if (rnd() < W.dim) face.userData.dim = 0.55 + 0.3 * rnd();
}
// Desktop and laptop (high tier): each machine is built by its own desktop builder in src/gloomhi.js; phones keep the builders above. ?fx=0 (desktop passes off) also falls back to the phone builds.
const HIGLOOM = QUALITY === 'high' && (() => { try { return new URLSearchParams(location.search).get('fx') !== '0'; } catch (e) { return true; } })();
let HB = null; const hiB = () => HB || (HB = hiBuilders({ ptex, grp, glow, halo, within, displayTex, stencilTex, leafDead: LEAFDEAD, deso: GLOOMKIT_DESO, pm: (k, f) => { if (!mc[k]) { mc[k] = f(); mc[k].userData.shared = true; mc[k].userData.k = k; } return mc[k]; } }));
const pick = (kind, deso, old) => (b, K, f) => (DESO.machines ? (HIGLOOM ? hiB()[kind] : deso) : old)(b, K, f);
const BUILD = { walker: pick('walker', walkerDeso, (b, K, face) => walker(b, K, face, true)), walkerFrame: walkerGrit, lurcher: pick('lurcher', lurcherDeso, lurcher), hauler: pick('hauler', haulerDeso, hauler), stilt: pick('stilt', stiltDeso, stilt), lantern: pick('lantern', lanternDeso, lantern), ticks: pick('ticks', ticksDeso, ticks), warden: pick('warden', wardenDeso, warden), walker2: (b, K, face) => walker(b, K, face, true) }, talk = { until: 0 };
// triangles in one machine (for the budget check)
export function gloomTris(kind) { const g = gloomMachine(kind); let n = 0; g.traverse((o) => { if (o.isMesh && !o.userData.hitOnly) n += (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3) * (o.isInstancedMesh ? o.count : 1); }); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); return Math.round(n); }

// One machine. opts.dormant: the daytime kind (black screen, limp, a jerk now and then; it says nothing).
// at night the worn metal gets a faint cold sheen so a dark frame still reads against a dark room (k = 0 by day, 1 at night)
let glowK = -1; export function nightGlow(k) { if (!GRITTY) return; const n = Object.keys(mc).length; if (k === glowK && n === nightGlow.n) return; glowK = k; nightGlow.n = n; for (const key in mc) { const q = mc[key]; if (q.isMeshPhongMaterial && q.emissive) q.emissive.setHex(GRIT.nightSheen).multiplyScalar(k); } }
export const speak = { fn: null }; // main.js sets fn(kind, line, machine): the machine's line is also heard, not only shown
export function gloomMachine(kind, opts) {
  const K = GLOOMKIT[kind === 'walker2' ? 'walker' : kind] || GLOOMKIT.walker, g = new THREE.Group(), b = new THREE.Group(), dormant = !!(opts && opts.dormant), face = screenMat(kind === 'walker2' ? 'walker' : kind, K); g.add(b);
  const P = (BUILD[kind] || walker)(b, K, face); if (GRITTY && kind !== 'warden' && !P.low && !P.keepScale) { b.scale.set(GRIT.thin, GRIT.tall, GRIT.thin); P.top *= GRIT.tall; } // taller and thinner, like the reshaped Walker
  const seed = Math.random(), ph = seed * 20, D = GLOOMKIT.dormant, SY = GLOOMKIT.say, say = dormant ? null : (P.say || caption(g, P.top, SY.size));
  const gap = SY.every[0] + (SY.every[1] - SY.every[0]) * seed, jgap = D.jerk[0] + (D.jerk[1] - D.jerk[0]) * seed; let lx = null, lz = 0;
  // the same extras the Walker has, for the others: three status lights and (where it had none) a creeper
  { const d = GLOOMKIT.dots[kind], c = GLOOMKIT.creeper[kind]; if (d) for (let k = 0; k < 3; k++) ball(0.02, glow(k ? 'amber' : 'teal', k ? 0xffc040 : 0x66ffe0), d[0] + (k - 1) * 0.06, d[1], d[2], b); if (c) { stem(c, 0.012, LEAF(), b); c.forEach((q, k) => { leafAt(b, q[0] + 0.03, q[1] + 0.06, q[2], 0.16, k * 1.4, 0.3); leafAt(b, q[0] - 0.02, q[1] + 0.18, q[2] + 0.02, 0.13, k * 2.3, 0.4); }); } }
  const hiTier = HIGLOOM && DESO.machines;
  if (DESO.machines) { // desolate look: each kind in its own faded service colour, and each machine its own shade of it (a new material per machine, freed with it)
    const DP = GLOOMKIT_DESO().paints, base = new THREE.Color(DP[kind === 'walker2' ? 'walker' : kind] || DP.walker), sh = new THREE.Color().copy(base).offsetHSL((Math.random() - 0.5) * DP.hue, (Math.random() - 0.5) * DP.sat, (Math.random() - 0.5) * DP.light), done = new Map();
    b.traverse((o) => { if (!o.isMesh || Array.isArray(o.material)) return; const k = o.material.userData.k || ''; if (!(k.startsWith('gk_p') || k === 'w2body' || k === 'dWbody')) return;
      if (!done.has(o.material)) { const m = o.material.clone(); m.color.copy(sh); if (hiTier) m.color.multiplyScalar(CONFIG.quality.high.gloom.paintLift); if (m.map && k !== 'dWbody') { m.map = ptex('worn'); m.shininess = 8; } m.userData.shared = false; done.set(o.material, m); } o.material = done.get(o.material); });
    // reroll (LAG FIX Nov 19, the Gloom pool in src/main.js): a reused machine gets a new shade of its colour from the same spread
    g.userData.reroll = () => { const s2 = new THREE.Color().copy(base).offsetHSL((Math.random() - 0.5) * DP.hue, (Math.random() - 0.5) * DP.sat, (Math.random() - 0.5) * DP.light); for (const m of done.values()) { m.color.copy(s2); if (hiTier) m.color.multiplyScalar(CONFIG.quality.high.gloom.paintLift); } };
  }
  wearAndTear(b, P, face);
  g.userData.kind = kind; g.userData.head = P.head; g.userData.heads = P.heads || [P.head]; g.userData.dormant = dormant; if (!dormant) { g.userData.lamp = new THREE.Vector3(0, (P.lamp || K.lamp)[0], (P.lamp || K.lamp)[1]); g.userData.lampColor = K.screen; }
  let next = ph % gap, until = -1, line = null;
  if (dormant) { face.color.setScalar(0.03); P.night(0, 0.5, 0); face.color.setScalar(0.03); b.rotation.x = -D.lean * (P.low ? 0 : 1); b.rotation.z = (seed - 0.5) * 0.2 * (P.low ? 0 : 1); if (!P.low) P.head.rotation.x = -D.headDrop; for (const a of P.arms) { a.rotation.set(0.12, 0, 0); if (a.userData.fore) a.userData.fore.rotation.set(-0.15, 0, 0); } }
  // the builder's own pose at time t, mv metres walked since the last pose
  let M = null; const pose = (t, mv) => { const q = Math.floor((t + ph) * K.fps) / K.fps; P.night(q, q % K.loop, mv); if (face.userData.dim) face.color.multiplyScalar(face.userData.dim); g.userData.glow = Math.min(1.6, face.color.r); };
  g.userData.anim = (t, gl) => {
    if (dormant) { const j = (t + ph) % jgap < D.jerkLen, s = Math.floor((t + ph) / jgap) % 2 ? 1 : -1; b.rotation.z = (seed - 0.5) * 0.2 * (P.low ? 0 : 1) + (j ? 0.07 * s : 0); if (P.low) P.head.rotation.x = j ? 0.5 : 1.0; else P.head.rotation.z = j ? 0.4 * s : 0; if (P.arms[0]) P.arms[0].rotation.x = j ? -0.5 : 0.12; face.color.setScalar(j && seed > 0.5 ? 0.3 : 0.03); return; }
    let mv = 0; if (gl) { if (lx !== null) mv = Math.min(0.2, Math.hypot(gl.x - lx, gl.z - lz)); lx = gl.x; lz = gl.z; }
    // uncanny motion (CONFIG.gloomMotion, src/gloommotion.js) decides when the builder's pose is updated; switched off it is the old motion, a pose every frame
    if (M && CONFIG.gloomMotion.on) M.frame(t, mv, pose); else { if (M) M.off(); pose(t, mv); }
    if (line && t > until) { line = null; say(null); } if (!line && t > next && t > talk.until) { line = K.lines[Math.floor(Math.random() * K.lines.length)]; until = t + SY.hold; talk.until = until + SY.gapAll; next = t + gap; say(line); if (speak.fn) speak.fn(kind === 'walker2' ? 'walker' : kind, line, g); if (M && CONFIG.gloomMotion.on) M.speak(SY.hold); }
  };
  g.userData.anim(0, null);
  if (!dormant) { M = makeMotion(kind, P, g, seed); g.userData.motion = M; }
  return g;
}
