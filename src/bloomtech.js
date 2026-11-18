// "Bloomtech": the settlement's own device style (2026-11-14, study: docs/bloomtech-device-style-study.md).
// Solarpunk, not steampunk and not a woodshed: glazed ceramic shells in flowing lathe shapes, glass domes with a glowing core,
// solar cells shaped like leaves and petals, thin curved copper stems, and something living on every device. No boxes, no planks.
// cellGlow: the solar leaves' own faint light (through their texture), so their undersides are never black. Style approved by the user on 2026-11-14 ("all yes but make it nicer"). Every placed device is built here now (14 of them). ?look=old shows the old devices. All values are in BLOOM.
import * as THREE from 'three';
import { ptex } from './props.js';
import { HIBASE, detailDevice } from './basehi.js';

export const BLOOM = {
  ceramic: 0xf6f1e4, ceramicGreen: 0x8fc79a, copper: 0xd09a6a, verdigris: 0x7fbfae, glass: 0xbfeee6, soil: 0x4a3a2c, leaf: 0x58a84a,
  cellGlow: 0x7a8cc8, glowAct: 0x66ffe0, glowPower: 0xffd060, glowWarn: 0xff8a50, shine: 70, glassOpacity: 0.32, halo: 0.55,
  lance: { h: 1.0, legs: 3, legR: 0.03, petals: 5, petalLen: 0.36, barrel: 0.56, sway: 0.12 },
  panel: { post: 0.1, hex: 0.2, field: 0.22 }, turbine: { h: 1.85, blades: 3, bladeLen: 0.7 }, collector: { h: 0.95, petals: 7, petalLen: 0.42, open: 0.95, breathe: 0.08 },
};
const mc = {}, RED = new THREE.Color(0xd04a3a);
const sh = (k, make) => { if (!mc[k]) { mc[k] = make(); mc[k].userData.shared = true; } return mc[k]; };
export const BM = {
  get ceramic() { return sh('b_cer', () => new THREE.MeshPhongMaterial({ map: ptex('glaze'), color: BLOOM.ceramic, shininess: BLOOM.shine, specular: 0x555555 })); },
  get ceramic2() { return sh('b_cer2', () => new THREE.MeshPhongMaterial({ map: ptex('glaze'), color: BLOOM.ceramic, shininess: BLOOM.shine, specular: 0x555555, side: THREE.DoubleSide })); },
  get green() { return sh('b_grn', () => new THREE.MeshPhongMaterial({ map: ptex('glaze'), color: BLOOM.ceramicGreen, shininess: BLOOM.shine, specular: 0x444444 })); },
  get copper() { return sh('b_cop', () => new THREE.MeshPhongMaterial({ map: ptex('metal'), color: BLOOM.copper, shininess: 50, specular: 0x886644 })); },
  get verdigris() { return sh('b_ver', () => new THREE.MeshPhongMaterial({ map: ptex('metal'), color: BLOOM.verdigris, shininess: 30, specular: 0x335544 })); },
  get glass() { return sh('b_gls', () => new THREE.MeshPhongMaterial({ color: BLOOM.glass, transparent: true, opacity: BLOOM.glassOpacity, shininess: 120, specular: 0xffffff, depthWrite: false })); },
  get cell() { return sh('b_cell', () => new THREE.MeshPhongMaterial({ map: ptex('cell'), emissiveMap: ptex('cell'), emissive: BLOOM.cellGlow, shininess: 90, specular: 0x8899cc, side: THREE.DoubleSide })); },
  get moon() { return sh('b_moon', () => new THREE.MeshPhongMaterial({ color: 0xdfe6ff, emissive: 0x5a6aa0, transparent: true, opacity: 0.8, shininess: 100, specular: 0xffffff })); },
  get leaf() { return sh('b_leaf', () => new THREE.MeshLambertMaterial({ color: BLOOM.leaf, side: THREE.DoubleSide })); },
  get soil() { return sh('b_soil', () => new THREE.MeshLambertMaterial({ color: BLOOM.soil })); },
  glow(c) { return sh('b_glow' + c, () => new THREE.MeshBasicMaterial({ color: c })); },
};
let haloTex = null;
// a soft glow around a light source (drawn additively, so it brightens what is behind it)
export function halo(p, x, y, z, size, color) {
  if (!haloTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); haloTex = new THREE.CanvasTexture(c); haloTex.userData.shared = true; }
  const s = new THREE.Sprite(sh('b_halo' + color, () => new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, opacity: BLOOM.halo, blending: THREE.AdditiveBlending, depthWrite: false }))); s.scale.setScalar(size); s.position.set(x, y, z); p.add(s); return s;
}
const mesh = (geo, m, x, y, z, p) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (p) p.add(o); return o; };
export const lathe = (pts, m, p, seg) => mesh(new THREE.LatheGeometry(pts.map((q) => new THREE.Vector2(q[0], q[1])), seg || 18), m, 0, 0, 0, p);
// a thin stem along a smooth curve through the points
export const stem = (pts, r, m, p) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2]))), 14, r, 6), m, 0, 0, 0, p);
let leafGeo = null;
// a leaf or petal, 1 long and 1 wide before scaling, growing along +y from its stalk, gently cupped
export function petal(p, len, wid, m) {
  if (!leafGeo) { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.55, 0.2, 0.5, 0.75, 0, 1); s.bezierCurveTo(-0.5, 0.75, -0.55, 0.2, 0, 0); leafGeo = new THREE.ShapeGeometry(s, 8); const P = leafGeo.attributes.position, U = leafGeo.attributes.uv; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); U.setXY(i, x * 0.9 + 0.5, y); P.setZ(i, -0.5 * x * x + 0.12 * Math.sin(y * Math.PI)); } leafGeo.computeVertexNormals(); }
  const o = mesh(leafGeo, m, 0, 0, 0, p); o.scale.set(wid, len, len); return o;
}
export const sprout = (p, x, y, z, s) => { stem([[x, y, z], [x + 0.01 * s, y + 0.1 * s, z], [x + 0.03 * s, y + 0.18 * s, z + 0.01 * s]], 0.008 * s, BM.leaf, p); for (const [a, l] of [[0.6, 0.16], [-0.9, 0.13], [2.6, 0.1]]) { const g = new THREE.Group(); g.position.set(x + 0.03 * s, y + 0.17 * s, z); g.rotation.set(0.9, a, 0); p.add(g); petal(g, l * s, l * s * 0.5, BM.leaf); } };

// a small bright glint on glass, so a dome reads as glass even without a room to reflect
const glint = (p, x, y, z, s) => { const o = mesh(new THREE.SphereGeometry(s, 6, 4), BM.glow(0xffffff), x, y, z, p); o.scale.set(1, 1.6, 0.4); o.rotation.z = 0.6; return o; };
// three curved legs on leaf feet, shared by the standing devices
const legs = (g, n, r, top, spread) => { for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n + 0.5, c = Math.cos(a), s = Math.sin(a); stem([[c * 0.07, top, s * 0.07], [c * spread * 0.55, top - 0.08, s * spread * 0.55], [c * spread * 0.85, 0.13, s * spread * 0.85], [c * spread, 0.035, s * spread]], r, BM.verdigris, g); const f = mesh(new THREE.SphereGeometry(0.1, 10, 6), BM.green, c * (spread + 0.03), 0.028, s * (spread + 0.03), g); f.scale.set(1.35, 0.3, 0.85); f.rotation.y = -a; } };
const planter = (g, x, y, z, s) => { mesh(new THREE.CylinderGeometry(0.05 * s, 0.035 * s, 0.05 * s, 10), BM.green, x, y, z, g); mesh(new THREE.CylinderGeometry(0.045 * s, 0.045 * s, 0.01, 10), BM.soil, x, y + 0.027 * s, z, g); sprout(g, x, y + 0.03 * s, z, 0.9 * s); };

// ---- the Lance: a flower that aims. Three curved legs on leaf feet, a ceramic pod, a glass dome with the charge inside, a lily-shaped barrel, a corolla of solar petals that stir.
// twin: two blooms on one pod (the Twin Lance).
function lanceHead(head, L, x) {
  mesh(new THREE.SphereGeometry(0.085, 12, 8), BM.glow(BLOOM.glowAct), x, 0, 0, head); halo(head, x, 0, 0, 0.62, BLOOM.glowAct); mesh(new THREE.SphereGeometry(0.17, 16, 12), BM.glass, x, 0, 0, head); glint(head, x - 0.07, 0.09, -0.11, 0.022);
  const br = lathe([[0.035, 0], [0.04, 0.2], [0.05, 0.38], [0.085, L.barrel - 0.05], [0.12, L.barrel], [0.105, L.barrel + 0.012], [0.075, L.barrel - 0.05]], BM.ceramic2, head, 16); br.rotation.x = -Math.PI / 2; br.position.set(x, 0, -0.12);
  for (const d of [0.22, 0.34, 0.46]) mesh(new THREE.TorusGeometry(0.047 + (d - 0.22) * 0.09, 0.008, 5, 14), BM.copper, x, 0, -0.12 - d, head);
  mesh(new THREE.SphereGeometry(0.03, 8, 6), BM.glow(BLOOM.glowAct), x, 0, -0.12 - L.barrel + 0.06, head);
  const ps = []; for (let k = 0; k < L.petals; k++) { const a = (k - (L.petals - 1) / 2) * 0.62, pg = new THREE.Group(); pg.position.set(x + Math.sin(a) * 0.1, Math.cos(a) * 0.1, 0.1); pg.rotation.set(-0.95, 0, -a, 'ZXY'); head.add(pg); petal(pg, L.petalLen, L.petalLen * 0.55, BM.cell); ps.push(pg); } return ps;
}
export function lanceV2(twin) {
  const L = BLOOM.lance, g = new THREE.Group(); legs(g, L.legs, L.legR, 0.42, 0.36);
  lathe([[0.0, 0.36], [0.1, 0.38], [0.17, 0.47], [0.185, 0.58], [0.15, 0.69], [0.09, 0.75], [0.07, 0.79]], BM.ceramic, g);
  mesh(new THREE.TorusGeometry(0.186, 0.012, 6, 24), BM.glow(BLOOM.glowAct), 0, 0.575, 0, g).rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 16), BM.copper, 0, 0.79, 0, g).rotation.x = Math.PI / 2;
  const head = new THREE.Group(); head.position.set(0, 0.93, 0); g.add(head); head.name = 'barrel';
  const ps = twin ? [...lanceHead(head, L, -0.2), ...lanceHead(head, L, 0.2)] : lanceHead(head, L, 0); if (twin) stem([[-0.2, -0.06, 0.02], [0, -0.14, 0.02], [0.2, -0.06, 0.02]], 0.03, BM.ceramic, head);
  planter(g, 0.13, 0.7, 0.08, 1); stem([[-0.15, 0.6, 0.06], [-0.2, 0.75, 0.1], [-0.1, 0.9, 0.12], [-0.03, 0.95, 0.1]], 0.008, BM.copper, g);
  g.userData.tick = (t) => { ps.forEach((pg, k) => { pg.rotation.x = -0.95 + L.sway * Math.sin(t * 1.3 + k * 0.9); }); };
  g.scale.setScalar(L.h); return g;
}
// ---- the Solar collector: an open flower of cell petals round an amber heart, turned up to the sun; the petals breathe.
export function collectorV2() {
  const C = BLOOM.collector, g = new THREE.Group(); legs(g, 3, 0.026, 0.5, 0.3);
  lathe([[0.0, 0.44], [0.07, 0.46], [0.11, 0.54], [0.1, 0.62], [0.05, 0.68], [0.04, 0.74]], BM.ceramic, g); mesh(new THREE.TorusGeometry(0.112, 0.01, 6, 20), BM.glow(BLOOM.glowPower), 0, 0.56, 0, g).rotation.x = Math.PI / 2;
  const cup = lathe([[0.04, 0.74], [0.09, 0.78], [0.12, 0.84]], BM.green, g); cup.material.side = THREE.DoubleSide;
  mesh(new THREE.SphereGeometry(0.075, 12, 8), BM.glow(BLOOM.glowPower), 0, 0.86, 0, g); halo(g, 0, 0.88, 0, 0.7, BLOOM.glowPower); mesh(new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), BM.glass, 0, 0.84, 0, g); glint(g, -0.04, 0.92, -0.05, 0.016);
  const ps = []; for (let k = 0; k < C.petals; k++) { const a = k * 2 * Math.PI / C.petals, yaw = new THREE.Group(); yaw.position.set(0, 0.82, 0); yaw.rotation.y = a; g.add(yaw); const pg = new THREE.Group(); pg.position.set(0, 0, -0.1); pg.rotation.x = -C.open; yaw.add(pg); petal(pg, C.petalLen * (k % 2 ? 0.86 : 1), C.petalLen * 0.5, BM.cell); ps.push(pg); }
  planter(g, -0.1, 0.6, 0.05, 0.8);
  g.userData.tick = (t) => { ps.forEach((pg, k) => { pg.rotation.x = -C.open + C.breathe * Math.sin(t * 0.9 + k * 0.5); }); };
  g.scale.setScalar(C.h / 0.95); return g;
}
// ---- the Turbine: a reed with three twisted ceramic petals that turn in the wind (the group named 'blade' is spun by the game).
export function turbineV2() {
  const T = BLOOM.turbine, g = new THREE.Group(), top = T.h - 0.3;
  lathe([[0.0, 0.0], [0.2, 0.02], [0.22, 0.07], [0.12, 0.16], [0.06, 0.3], [0.04, 0.6], [0.034, top]], BM.ceramic, g, 14); mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 22), BM.glow(BLOOM.glowPower), 0, 0.075, 0, g).rotation.x = Math.PI / 2;
  for (const y of [0.62, 1.0]) mesh(new THREE.TorusGeometry(0.048, 0.01, 5, 12), BM.copper, 0, y, 0, g).rotation.x = Math.PI / 2;
  const rot = new THREE.Group(); rot.name = 'blade'; rot.position.y = top; g.add(rot); mesh(new THREE.SphereGeometry(0.07, 10, 8), BM.green, 0, 0, 0, rot); mesh(new THREE.SphereGeometry(0.045, 8, 6), BM.glow(BLOOM.glowPower), 0, 0.3, 0, rot); halo(rot, 0, 0.3, 0, 0.45, BLOOM.glowPower);
  for (let k = 0; k < T.blades; k++) { const yaw = new THREE.Group(); yaw.rotation.y = k * 2 * Math.PI / T.blades; rot.add(yaw); const pg = new THREE.Group(); pg.position.set(0.05, -0.32, 0); pg.rotation.set(0, 1.15, -0.28); yaw.add(pg); petal(pg, T.bladeLen, T.bladeLen * 0.42, BM.ceramic2); const in2 = new THREE.Group(); in2.position.z = 0.012; pg.add(in2); petal(in2, T.bladeLen * 0.72, T.bladeLen * 0.24, BM.cell); stem([[0, 0, 0.02], [0, T.bladeLen * 0.5, 0.06], [0, T.bladeLen * 0.98, 0.02]], 0.008, BM.copper, pg); mesh(new THREE.SphereGeometry(0.022, 8, 6), BM.glow(BLOOM.glowPower), 0, T.bladeLen, 0.02, pg); stem([[0.02, 0.0, 0], [0.05, -0.3, 0]], 0.012, BM.verdigris, yaw); }
  stem([[0, top, 0], [0, top + 0.3, 0]], 0.012, BM.verdigris, rot); planter(g, 0.1, 0.17, 0.08, 1); stem([[0.06, 0.2, -0.04], [0.1, 0.5, -0.06], [-0.02, 0.8, -0.05], [0.05, 1.05, 0.03]], 0.007, BM.leaf, g);
  return g;
}
// ---- wall devices: a shield, not a fence. Two pylons with a light in each, and between them a wall of six-sided ceramic plates set in a sheet of teal light.
// Trellis: the same, taller, grown through with creepers. userData.tintDamage reddens the plates as it is broken down.
export function wallV2(kind, cfg) {
  const P = BLOOM.panel, tall = kind === 'trellis', ph = tall ? 2.7 : cfg.cannon.panelH, hw = cfg.openingHalf, g = new THREE.Group();
  const bm = new THREE.MeshPhongMaterial({ map: ptex('glaze'), color: 0xffffff, shininess: BLOOM.shine, specular: 0x666666 }), bm2 = new THREE.MeshPhongMaterial({ map: ptex('glaze'), color: BLOOM.ceramicGreen, shininess: BLOOM.shine, specular: 0x555555 });
  const field = new THREE.MeshBasicMaterial({ color: BLOOM.glowAct, transparent: true, opacity: P.field, depthWrite: false, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) { const po = lathe([[0.0, 0], [P.post * 1.7, 0.02], [P.post * 1.5, 0.1], [P.post, 0.24], [P.post * 0.8, ph * 0.5], [P.post, ph - 0.16], [P.post * 1.3, ph - 0.05], [P.post * 0.9, ph + 0.02]], BM.ceramic, g, 12); po.position.x = sx * hw;
    mesh(new THREE.SphereGeometry(0.06, 10, 8), BM.glow(BLOOM.glowAct), sx * hw, ph + 0.09, 0, g); mesh(new THREE.SphereGeometry(0.1, 12, 8), BM.glass, sx * hw, ph + 0.09, 0, g); halo(g, sx * hw, ph + 0.09, 0, 0.42, BLOOM.glowAct);
    for (const y of [0.26, ph - 0.18]) mesh(new THREE.TorusGeometry(P.post * 1.08, 0.012, 5, 14), BM.copper, sx * hw, y, 0, g).rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(P.post * 0.86, 0.01, 5, 14), BM.glow(BLOOM.glowAct), sx * hw, ph * 0.5, 0, g).rotation.x = Math.PI / 2; }
  mesh(new THREE.PlaneGeometry(2 * hw - P.post * 1.6, ph - 0.12), field, 0, ph / 2 + 0.02, 0, g);
  stem([[-hw, ph - 0.02, 0], [0, ph + 0.03, 0], [hw, ph - 0.02, 0]], 0.022, BM.verdigris, g); stem([[-hw, 0.08, 0], [0, 0.06, 0], [hw, 0.08, 0]], 0.03, BM.verdigris, g);
  // flat-topped six-sided plates in a true honeycomb: columns 1.5 R apart, every other column half a plate higher
  const R = P.hex, dx = R * 1.5, dy = R * 1.732, hexG = new THREE.CylinderGeometry(R * 0.94, R * 0.94, 0.05, 6), cols = Math.floor((hw - P.post - R * 0.6) / dx);
  for (let c = -cols; c <= cols; c++) { const up = (Math.abs(c) % 2) * dy / 2; for (let r = 0; 0.16 + R * 0.87 + up + r * dy <= ph - R * 0.8; r++) { const h = mesh(hexG, (r * 2 + Math.abs(c)) % 3 === 0 ? bm2 : bm, c * dx, 0.16 + R * 0.87 + up + r * dy, 0, g); h.rotation.x = Math.PI / 2; } }
  g.userData.tintDamage = (t) => { bm.color.setRGB(1, 1 - 0.55 * t, 1 - 0.62 * t); bm2.color.set(BLOOM.ceramicGreen).lerp(RED, t * 0.7); field.opacity = P.field * (1 - 0.7 * t); };
  g.userData.tick = (t) => { field.opacity = Math.max(0.04, field.opacity + 0.004 * Math.sin(t * 3)); };
  if (tall) { const vm = new THREE.MeshLambertMaterial({ map: ptex('vine'), alphaTest: 0.45, side: THREE.DoubleSide }); for (const [x, y, w, h] of [[-0.5, 1.5, 1.3, 2.4], [0.55, 1.2, 1.1, 2.0]]) for (const z of [-0.06, 0.06]) mesh(new THREE.PlaneGeometry(w, h), vm, x, y, z, g); }
  stem([[hw - 0.02, 0.1, 0.09], [hw + 0.04, 0.6, 0.07], [hw - 0.07, 1.1, -0.08], [hw + 0.02, 1.5, 0.07]], 0.009, BM.leaf, g); for (let k = 0; k < 4; k++) { const lg = new THREE.Group(); lg.position.set(hw - 0.02 + 0.03 * Math.sin(k * 2), 0.35 + k * 0.33, 0.07 * Math.cos(k * 2)); lg.rotation.set(0.6, k * 1.5, 0); g.add(lg); petal(lg, 0.14, 0.07, BM.leaf); }
  return g;
}
// a standing device's lower half: legs, pod, glow ring; returns the height of the pod's neck
const pod = (g, glowC) => { legs(g, 3, 0.03, 0.42, 0.36); lathe([[0.0, 0.36], [0.1, 0.38], [0.17, 0.47], [0.185, 0.58], [0.15, 0.69], [0.09, 0.75], [0.07, 0.79]], BM.ceramic, g); mesh(new THREE.TorusGeometry(0.186, 0.012, 6, 24), BM.glow(glowC), 0, 0.575, 0, g).rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 16), BM.copper, 0, 0.79, 0, g).rotation.x = Math.PI / 2; planter(g, 0.13, 0.7, 0.08, 1); return 0.79; };
const core = (p, x, y, z, r, c, hs) => { mesh(new THREE.SphereGeometry(r, 10, 8), BM.glow(c), x, y, z, p); halo(p, x, y, z, hs || r * 7, c); };
// ---- Mist: a glass bell of cold fog with three horns that breathe it out (slows the Gloom).
export function mistV2() { const g = new THREE.Group(); pod(g, BLOOM.glowAct); const head = new THREE.Group(); head.position.y = 0.95; head.name = 'barrel'; g.add(head);
  core(head, 0, 0, 0, 0.09, 0xbff8ff, 0.8); mesh(new THREE.SphereGeometry(0.2, 16, 12), BM.glass, 0, 0, 0, head); glint(head, -0.08, 0.1, -0.13, 0.024);
  for (const a of [-0.55, 0, 0.55]) { const h = lathe([[0.03, 0], [0.035, 0.14], [0.06, 0.26], [0.1, 0.32], [0.085, 0.33], [0.05, 0.27]], BM.ceramic2, head, 12); h.rotation.set(-Math.PI / 2, 0, 0); const yg = new THREE.Group(); yg.rotation.y = a; yg.add(h); h.position.z = -0.16; head.add(yg); mesh(new THREE.TorusGeometry(0.045, 0.007, 5, 12), BM.copper, 0, 0, -0.34, yg); }
  const fog = halo(head, 0, 0, -0.55, 0.9, 0xbff8ff); g.userData.tick = (t) => { fog.scale.setScalar(0.8 + 0.25 * Math.sin(t * 2.2)); }; return g; }
// ---- Sling: a fern frond that flicks a glass seed over walls.
export function slingV2() { const g = new THREE.Group(); pod(g, BLOOM.glowAct); const arm = new THREE.Group(); arm.position.y = 0.8; arm.name = 'barrel'; g.add(arm);
  const pts = [[0, 0, 0], [0, 0.3, 0.12], [0, 0.62, 0.1], [0, 0.86, -0.12], [0, 0.9, -0.42], [0, 0.74, -0.58]]; stem(pts, 0.026, BM.verdigris, arm);
  for (let k = 1; k < 5; k++) for (const sx of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(0, pts[k][1], pts[k][2]); lg.rotation.set(0.3, 0, -sx * 1.25); arm.add(lg); petal(lg, 0.26 - k * 0.03, 0.1, BM.cell); }
  core(arm, 0, 0.7, -0.6, 0.06, BLOOM.glowAct, 0.5); mesh(new THREE.SphereGeometry(0.1, 12, 10), BM.glass, 0, 0.7, -0.6, arm); const cup = lathe([[0.02, -0.1], [0.08, -0.06], [0.11, 0.0]], BM.ceramic2, arm, 10); cup.position.set(0, 0.7, -0.6);
  g.userData.tick = (t) => { arm.rotation.x = 0.06 * Math.sin(t * 1.7); }; return g; }
// ---- Mine: a seed head in the floor. A low ceramic dome, a ring of light, five cell petals lying open; its heart pulses.
export function mineV2() { const g = new THREE.Group(); lathe([[0.0, 0.11], [0.12, 0.1], [0.22, 0.06], [0.27, 0.02], [0.28, 0]], BM.ceramic, g, 16); mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 22), BM.glow(BLOOM.glowWarn), 0, 0.07, 0, g).rotation.x = Math.PI / 2;
  for (let k = 0; k < 5; k++) { const yaw = new THREE.Group(); yaw.rotation.y = k * 1.2566; g.add(yaw); const pg = new THREE.Group(); pg.position.set(0, 0.02, -0.24); pg.rotation.x = -1.45; yaw.add(pg); petal(pg, 0.22, 0.13, BM.cell); }
  const c = mesh(new THREE.SphereGeometry(0.055, 10, 8), BM.glow(BLOOM.glowWarn), 0, 0.12, 0, g), h = halo(g, 0, 0.14, 0, 0.5, BLOOM.glowWarn); mesh(new THREE.SphereGeometry(0.085, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), BM.glass, 0, 0.1, 0, g);
  g.userData.tick = (t) => { const s = 1 + 0.35 * Math.max(0, Math.sin(t * 4)); c.scale.setScalar(s); h.scale.setScalar(0.5 * s); }; return g; }
// ---- Shard: a bed of glass crystals lit from inside, on a ceramic ring.
export function shardV2() { const g = new THREE.Group(); const ring = mesh(new THREE.TorusGeometry(0.8, 0.045, 8, 30), BM.ceramic, 0, 0.04, 0, g); ring.rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(0.72, 0.012, 6, 30), BM.glow(BLOOM.glowAct), 0, 0.05, 0, g).rotation.x = Math.PI / 2; mesh(new THREE.CircleGeometry(0.76, 24), BM.soil, 0, 0.012, 0, g).rotation.x = -Math.PI / 2;
  for (const [x, z, s] of [[-0.4, -0.4, 1], [0.4, -0.4, 0.8], [-0.4, 0.4, 0.9], [0.4, 0.4, 1.1], [0, 0, 1.4], [0.1, -0.5, 0.6], [-0.5, 0.05, 0.7], [0.5, 0.1, 0.75], [-0.1, 0.5, 0.65]]) { const sg = new THREE.Group(); sg.position.set(x, 0.02, z); sg.rotation.set((x + z) * 0.3, x * 7, x * 0.3); g.add(sg); mesh(new THREE.ConeGeometry(0.075 * s, 0.4 * s, 5), BM.glass, 0, 0.2 * s, 0, sg); mesh(new THREE.ConeGeometry(0.03 * s, 0.3 * s, 5), BM.glow(BLOOM.glowAct), 0, 0.16 * s, 0, sg); }
  halo(g, 0, 0.3, 0, 1.3, BLOOM.glowAct); for (const a of [0.6, 2.7, 4.6]) { const lg = new THREE.Group(); lg.position.set(Math.cos(a) * 0.8, 0.05, Math.sin(a) * 0.8); lg.rotation.set(0.9, a, 0); g.add(lg); petal(lg, 0.16, 0.08, BM.leaf); } return g; }
// ---- Press: an arch of two pylons with a heavy ceramic seed hanging in it (the part named 'ram').
export function pressV2(cfg) { const g = new THREE.Group(); lathe([[0.0, 0.06], [0.42, 0.05], [0.5, 0.02], [0.5, 0]], BM.ceramic, g, 20); mesh(new THREE.TorusGeometry(0.44, 0.012, 6, 26), BM.glow(BLOOM.glowWarn), 0, 0.055, 0, g).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) { const po = lathe([[0.0, 0], [0.09, 0.02], [0.06, 0.2], [0.045, 1.3], [0.06, 1.42]], BM.ceramic, g, 10); po.position.x = sx * 0.44; mesh(new THREE.TorusGeometry(0.052, 0.01, 5, 12), BM.copper, sx * 0.44, 0.7, 0, g).rotation.x = Math.PI / 2; }
  stem([[-0.44, 1.4, 0], [-0.3, 1.62, 0], [0, 1.7, 0], [0.3, 1.62, 0], [0.44, 1.4, 0]], 0.04, BM.verdigris, g);
  const ram = new THREE.Group(); ram.name = 'ram'; ram.position.y = 1.2; g.add(ram); stem([[0, 0.5, 0], [0, 0.2, 0]], 0.02, BM.copper, ram); lathe([[0.0, 0.24], [0.14, 0.2], [0.3, 0.05], [0.33, -0.1], [0.26, -0.22], [0.0, -0.26]], BM.ceramic, ram, 16); mesh(new THREE.TorusGeometry(0.33, 0.014, 6, 24), BM.glow(BLOOM.glowWarn), 0, -0.09, 0, ram).rotation.x = Math.PI / 2;
  planter(g, 0.3, 0.06, 0.3, 1);
  // the seed slams down when the Press strikes (its timer d.cd jumps to the reset time), then is drawn slowly back up; ready, it hangs and sways a little
  g.userData.tick = (t, d) => { const R = cfg ? cfg.devices.press.reset : 8, cd = d && d.cd > 0 ? d.cd : 0, k = cd / R; ram.position.y = cd > R - 0.35 ? 0.34 : 1.2 - 0.86 * k * k * (cd > 0 ? 1 : 0) + (cd > 0 ? 0 : 0.03 * Math.sin(t * 1.6)); ram.rotation.z = cd > 0 ? 0 : 0.05 * Math.sin(t * 1.1); };
  return g; }
// ---- Prism: a glass bud on a reed that lends its light to the devices round it; it turns slowly.
export function prismV2() { const g = new THREE.Group(); lathe([[0.0, 0.0], [0.17, 0.02], [0.18, 0.06], [0.08, 0.14], [0.04, 0.4], [0.03, 1.0]], BM.ceramic, g, 12); mesh(new THREE.TorusGeometry(0.16, 0.01, 6, 20), BM.glow(BLOOM.glowPower), 0, 0.065, 0, g).rotation.x = Math.PI / 2;
  const bud = new THREE.Group(); bud.position.y = 1.3; g.add(bud); mesh(new THREE.OctahedronGeometry(0.3), BM.glass, 0, 0, 0, bud); mesh(new THREE.OctahedronGeometry(0.13), BM.glow(BLOOM.glowPower), 0, 0, 0, bud); halo(g, 0, 1.3, 0, 1.3, BLOOM.glowPower);
  for (let k = 0; k < 3; k++) { const yaw = new THREE.Group(); yaw.position.y = 1.0; yaw.rotation.y = k * 2.094; g.add(yaw); const pg = new THREE.Group(); pg.position.z = -0.03; pg.rotation.x = -0.55; yaw.add(pg); petal(pg, 0.3, 0.14, BM.cell); }
  g.userData.tick = (t) => { bud.rotation.y = t * 0.6; }; planter(g, 0.1, 0.1, 0.08, 0.9); return g; }
// ---- Chime Pole: a tall reed with four glass bells that glow as they call the Gloom to it (the part named 'pole').
export function chimeV2() { const g = new THREE.Group(); const p = lathe([[0.0, 0.0], [0.19, 0.02], [0.2, 0.06], [0.09, 0.16], [0.05, 0.5], [0.035, 1.95]], BM.ceramic, g, 12); p.name = 'pole'; mesh(new THREE.TorusGeometry(0.18, 0.01, 6, 20), BM.glow(BLOOM.glowWarn), 0, 0.065, 0, g).rotation.x = Math.PI / 2;
  const bells = []; [[-0.34, 0.5, 0.2], [-0.12, 0.34, -0.25], [0.14, 0.58, 0.22], [0.36, 0.42, -0.18]].forEach(([x, l, z]) => { stem([[0, 1.93, 0], [x * 0.6, 2.08, z * 0.6], [x, 1.98, z]], 0.014, BM.verdigris, g); const bg = new THREE.Group(); bg.position.set(x, 1.98, z); g.add(bg); stem([[0, 0, 0], [0, -l, 0]], 0.005, BM.copper, bg); const b = mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), BM.glass, 0, -l - 0.02, 0, bg); core(bg, 0, -l - 0.05, 0, 0.03, BLOOM.glowWarn, 0.36); bells.push(bg); });
  g.userData.tick = (t) => { bells.forEach((b, k) => { b.rotation.z = 0.16 * Math.sin(t * 2.3 + k * 1.7); b.rotation.x = 0.1 * Math.sin(t * 1.9 + k); }); }; return g; }
// ---- Moon Panel: a pale glass lily pad on a reed that drinks moonlight, rimmed with small cell petals.
export function moonV2() { const g = new THREE.Group(); lathe([[0.0, 0.0], [0.19, 0.02], [0.2, 0.06], [0.09, 0.16], [0.045, 0.5], [0.04, 0.95]], BM.ceramic, g, 12); mesh(new THREE.TorusGeometry(0.18, 0.01, 6, 20), BM.glow(BLOOM.glowPower), 0, 0.065, 0, g).rotation.x = Math.PI / 2;
  const pad = new THREE.Group(); pad.position.y = 1.0; pad.rotation.x = 0.35; g.add(pad); mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.04, 22), BM.moon, 0, 0, 0, pad); mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 26), BM.ceramic, 0, 0, 0, pad).rotation.x = Math.PI / 2; mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14), BM.glow(0xeaf0ff), 0, 0.005, 0, pad);
  for (let k = 0; k < 9; k++) { const yaw = new THREE.Group(); yaw.rotation.y = k * 0.698; pad.add(yaw); const pg = new THREE.Group(); pg.position.set(0, 0, -0.48); pg.rotation.x = -1.25; yaw.add(pg); petal(pg, 0.2, 0.1, BM.cell); }
  halo(g, 0, 1.05, 0, 1.5, 0xcfdcff); planter(g, 0.1, 0.1, 0.08, 0.9); return g; }
// every placed device is drawn in this style now
export function device(kind, cfg) { const f = { lance: () => lanceV2(false), twin: () => lanceV2(true), collector: collectorV2, turbine: turbineV2, panel: () => wallV2('panel', cfg), trellis: () => wallV2('trellis', cfg), mist: mistV2, sling: slingV2, mine: mineV2, shard: shardV2, press: () => pressV2(cfg), prism: prismV2, chime: chimeV2, moon: moonV2 }[kind]; const o = f ? f() : null; return o && HIBASE ? detailDevice(o) : o; }
// ---- loot: a sealed ceramic capsule from the old world, with a lit band that tells what is in it (green food, blue essentials) and a carrying loop.
export function crateV2(kind) { const g = new THREE.Group(), c = kind === 'food' ? 0x8dff8a : 0x7fc8ff;
  lathe([[0.0, 0.0], [0.2, 0.01], [0.27, 0.08], [0.29, 0.26], [0.26, 0.4], [0.16, 0.5], [0.07, 0.53]], BM.ceramic, g, 14); mesh(new THREE.TorusGeometry(0.292, 0.016, 6, 22), BM.glow(c), 0, 0.26, 0, g).rotation.x = Math.PI / 2; halo(g, 0, 0.3, 0, 0.9, c);
  mesh(new THREE.TorusGeometry(0.27, 0.012, 5, 20), BM.copper, 0, 0.09, 0, g).rotation.x = Math.PI / 2; stem([[-0.07, 0.52, 0], [-0.06, 0.62, 0], [0.06, 0.62, 0], [0.07, 0.52, 0]], 0.012, BM.verdigris, g);
  const lg = new THREE.Group(); lg.position.set(0.2, 0.42, 0.1); lg.rotation.set(0.9, 0.6, 0); g.add(lg); petal(lg, 0.13, 0.07, kind === 'food' ? BM.leaf : BM.cell); return g; }
