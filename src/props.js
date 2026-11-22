// Things that move or come and go during a visit: the Gloom, the 14 devices, crates, the lucky cat, floor marks.
// (user, 2026-11-14: no more bright prototype shapes.) Materials and textures here are shared and flagged, so main.js drop() leaves them alone.
import * as THREE from 'three';
import { TEX } from './texdata.js';
import { texLoad, aniso, seg as Q_SEG } from './quality.js';
import { HIBASE, catHi } from './basehi.js';

const loader = new THREE.TextureLoader(), tcache = {};
export function ptex(name) { if (!tcache[name]) { const t = texLoad(name); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; t.userData.tex = name; t.anisotropy = aniso(); tcache[name] = t; } return tcache[name]; }
const mcache = {};
function mat(key, make) { if (!mcache[key]) { mcache[key] = make(); mcache[key].userData.shared = true; } return mcache[key]; }
const lam = (key, o) => mat(key, () => new THREE.MeshLambertMaterial(o));
const MT = {
  get brass() { return lam('brass', { map: ptex('metal'), color: 0xe8d8b0 }); }, get steel() { return lam('steel', { map: ptex('metal'), color: 0x9aa4a8 }); }, get dark() { return lam('dark', { map: ptex('metal'), color: 0x4a4640 }); },
  get wood() { return lam('pwood', { map: ptex('wood'), color: 0xc8a878 }); }, get woodDark() { return lam('pwoodd', { map: ptex('wood'), color: 0x8a6a4a }); }, get cloth() { return lam('pcloth', { map: ptex('fabric') }); },
  get glass() { return lam('pglass', { color: 0x9fd8ff, transparent: true, opacity: 0.55 }); }, get water() { return lam('pwater', { color: 0x4aa8e8, transparent: true, opacity: 0.75 }); },
  get cell() { return mat('pcell', () => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#1d3a78'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#9fb6e0'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, 64); g.stroke(); g.beginPath(); g.moveTo(0, i * 16); g.lineTo(64, i * 16); g.stroke(); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; return new THREE.MeshLambertMaterial({ map: t }); }); },
  get moon() { return lam('pmoon', { color: 0xdfe6ff, emissive: 0x39406a }); }, get vine() { return lam('pvine', { map: ptex('vine'), alphaTest: 0.45, side: THREE.DoubleSide }); },
  get gloomBody() { return lam('gbody', { map: ptex('gloom'), color: 0xbfb4d0, emissive: 0xa890d8, emissiveMap: ptex('gloom'), side: THREE.DoubleSide }); }, get gloomHead() { return lam('ghead', { map: ptex('gloom'), color: 0xd8c8e8, emissive: 0xe0b8ff, emissiveMap: ptex('gloom') }); },
  get eye() { return mat('geye', () => new THREE.MeshBasicMaterial({ color: 0xffd060 })); }, get ember() { return mat('ember', () => new THREE.MeshBasicMaterial({ color: 0xff7a30 })); }, get prism() { return mat('prismm', () => new THREE.MeshBasicMaterial({ color: 0x9fe8ff })); },
  get catWhite() { return lam('catw', { color: 0xf4efe4 }); }, get catGold() { return lam('catg', { map: ptex('metal'), color: 0xffd870, emissive: 0x3a2a08 }); }, get catRed() { return lam('catr', { color: 0xc0392b }); }, get catInk() { return lam('cati', { color: 0x1c1a18 }); }, get catPink() { return lam('catp', { color: 0xe8a0a0 }); },
  get food() { return lam('cfood', { color: 0x6fae5a }); }, get ess() { return lam('cess', { color: 0x5a96c0 }); }
};
const mesh = (geo, m, x, y, z, p) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (p) p.add(o); return o; };
const cyl = (r0, r1, h, m, x, y, z, p, seg) => mesh(new THREE.CylinderGeometry(r0, r1, h, Q_SEG(seg || 10)), m, x, y, z, p);
const bx = (w, h, d, m, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, p);

// ---- the Gloom: a hooded drift of dark smoke with two ember eyes. The head stays where the old one was (2.08 m), so headshots are unchanged.
export function gloomMesh() {
  const g = new THREE.Group(), pr = [];
  for (let k = 0; k <= 9; k++) { const t = k / 9, r = 0.58 - 0.26 * t + 0.10 * Math.sin(t * 3.1) + (k === 9 ? -0.06 : 0); pr.push(new THREE.Vector2(r, 0.02 + 1.78 * t)); }
  const cloak = new THREE.LatheGeometry(pr, 12), P = cloak.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i), a = Math.atan2(P.getZ(i), P.getX(i)); if (y < 0.5) { const k = 1 + 0.22 * Math.sin(a * 5) * (1 - y / 0.5); P.setX(i, P.getX(i) * k); P.setZ(i, P.getZ(i) * k); P.setY(i, y + 0.12 * Math.max(0, Math.sin(a * 5)) * (1 - y / 0.5)); } }
  cloak.computeVertexNormals(); mesh(cloak, MT.gloomBody, 0, 0, 0, g);
  const sh = mesh(new THREE.SphereGeometry(0.46, 10, 6), MT.gloomBody, 0, 1.62, 0, g); sh.scale.set(1.25, 0.5, 0.8);                    // shoulders
  mesh(new THREE.SphereGeometry(0.32, 10, 8), MT.gloomHead, 0, 2.08, 0, g);                                                               // head
  const hood = mesh(new THREE.SphereGeometry(0.37, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), MT.gloomBody, 0, 2.1, 0.05, g); hood.rotation.x = 0.35;
  for (const sx of [-0.115, 0.115]) mesh(new THREE.SphereGeometry(0.05, 8, 6), MT.eye, sx, 2.1, -0.285, g);                               // ember eyes on the front (-z)
  for (const sx of [-1, 1]) { const arm = cyl(0.05, 0.11, 1.0, MT.gloomBody, sx * 0.52, 1.22, -0.12, g, 6); arm.rotation.set(0.5, 0, sx * 0.22); const cl = mesh(new THREE.ConeGeometry(0.07, 0.3, 5), MT.gloomHead, sx * 0.60, 0.72, -0.40, g); cl.rotation.x = 2.6; }
  return g;
}

// ---- devices
export function deviceMesh(kind, cfg) {
  const g = new THREE.Group();
  const mast = (h, r) => cyl((r || 0.05) * 0.7, r || 0.05, h, MT.brass, 0, h / 2, 0, g, 8), foot = (r) => cyl(r, r * 1.15, 0.06, MT.dark, 0, 0.03, 0, g, 10);
  const barrel = (x, y, len, r) => { const b = cyl(r * 0.8, r, len, MT.brass, x, y, -len / 2 + 0.05, g, 10); b.rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(r * 0.95, r * 0.25, 5, 10), MT.dark, x, y, -len + 0.06, g); return b; };
  const base = (col) => { bx(0.46, 0.34, 0.46, MT.wood, 0, 0.17, 0, g); bx(0.50, 0.05, 0.50, MT.dark, 0, 0.36, 0, g); cyl(0.13, 0.16, 0.16, MT.brass, 0, 0.46, 0, g); if (col) mesh(new THREE.SphereGeometry(0.15, 10, 8), col, 0, 0.52, 0.16, g); };
  if (kind === 'turbine') { foot(0.22); mast(1.75, 0.055); const rot = new THREE.Group(); rot.name = 'blade'; rot.position.y = 1.55; g.add(rot);
    for (let k = 0; k < 3; k++) { const v = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.75, 8, 1, true, 0, Math.PI), MT.steel, 0, 0, 0); v.material.side = THREE.DoubleSide; const arm = new THREE.Group(); arm.rotation.y = k * 2.094; v.position.x = 0.22; arm.add(v); rot.add(arm); }
    cyl(0.07, 0.07, 0.06, MT.dark, 0, 1.96, 0, g); }
  else if (kind === 'collector') { for (let k = 0; k < 3; k++) { const l = cyl(0.02, 0.025, 0.95, MT.brass, Math.cos(k * 2.094) * 0.2, 0.44, Math.sin(k * 2.094) * 0.2, g, 6); l.rotation.set(Math.sin(k * 2.094) * 0.4, 0, -Math.cos(k * 2.094) * 0.4); }
    const pn = new THREE.Group(); pn.position.y = 0.95; pn.rotation.x = -0.5; g.add(pn); bx(1.06, 0.04, 0.76, MT.brass, 0, 0, 0, pn); bx(1.0, 0.02, 0.7, MT.cell, 0, 0.03, 0, pn); }
  else if (kind === 'lance') { base(MT.glass); barrel(0, 0.6, 0.75, 0.06).name = 'barrel'; }
  else if (kind === 'twin') { base(MT.glass); barrel(-0.1, 0.6, 0.75, 0.05).name = 'barrel'; barrel(0.1, 0.6, 0.75, 0.05); }
  else if (kind === 'mist') { base(MT.water); const n = cyl(0.2, 0.06, 0.5, MT.brass, 0, 0.6, -0.3, g, 12); n.rotation.x = Math.PI / 2; n.name = 'barrel'; }
  else if (kind === 'sling') { base(null); const arm = bx(0.07, 0.07, 0.95, MT.wood, 0, 0.85, -0.3, g); arm.rotation.x = 0.7; arm.name = 'barrel'; const cup = mesh(new THREE.SphereGeometry(0.14, 8, 6, 0, 6.3, 1.4, 1.75), MT.brass, 0, 1.18, -0.68, g); cup.material.side = THREE.DoubleSide; }
  else if (kind === 'mine') { cyl(0.26, 0.3, 0.1, MT.brass, 0, 0.05, 0, g, 12); mesh(new THREE.SphereGeometry(0.1, 8, 6, 0, 6.3, 0, 1.6), MT.ember, 0, 0.1, 0, g); for (let k = 0; k < 4; k++) bx(0.06, 0.04, 0.14, MT.dark, Math.cos(k * 1.571) * 0.26, 0.03, Math.sin(k * 1.571) * 0.26, g).rotation.y = -k * 1.571 + 1.571; }
  else if (kind === 'shard') { cyl(0.82, 0.86, 0.05, MT.dark, 0, 0.03, 0, g, 14); for (const [x, z, s] of [[-0.4, -0.4, 1], [0.4, -0.4, 0.8], [-0.4, 0.4, 0.9], [0.4, 0.4, 1.1], [0, 0, 1.3], [0.1, -0.5, 0.6], [-0.5, 0.05, 0.7]]) { const c = mesh(new THREE.ConeGeometry(0.07 * s, 0.34 * s, 5), MT.glass, x, 0.05 + 0.17 * s, z, g); c.rotation.set((x + z) * 0.3, x * 7, x * 0.3); } }
  else if (kind === 'press') { bx(0.95, 0.4, 0.95, MT.wood, 0, 0.2, 0, g); for (const x of [-0.4, 0.4]) cyl(0.04, 0.04, 1.05, MT.steel, x, 0.9, 0, g, 8); bx(0.9, 0.12, 0.2, MT.dark, 0, 1.45, 0, g); const blk = bx(0.8, 0.26, 0.8, MT.steel, 0, 1.2, 0, g); mesh(new THREE.PlaneGeometry(0.8, 0.5), MT.vine, 0, 1.2, 0.41, g); blk.name = 'ram'; }
  else if (kind === 'prism') { foot(0.18); mast(1.0); mesh(new THREE.OctahedronGeometry(0.3), MT.prism, 0, 1.28, 0, g); mesh(new THREE.TorusGeometry(0.34, 0.02, 5, 14), MT.brass, 0, 1.28, 0, g).rotation.x = 1.571; }
  else if (kind === 'chime') { foot(0.2); const p = cyl(0.04, 0.06, 2.0, MT.wood, 0, 1.0, 0, g, 8); bx(0.7, 0.05, 0.05, MT.wood, 0, 1.95, 0, g); for (const [x, l] of [[-0.28, 0.5], [-0.09, 0.38], [0.09, 0.56], [0.28, 0.42]]) cyl(0.03, 0.03, l, MT.brass, x, 1.9 - l / 2 - 0.06, 0, g, 8); p.name = 'pole'; }
  else if (kind === 'moon') { foot(0.2); mast(0.95); const d = cyl(0.5, 0.5, 0.05, MT.moon, 0, 1.0, 0, g, 18); d.rotation.x = 0.35; mesh(new THREE.TorusGeometry(0.5, 0.025, 5, 20), MT.brass, 0, 1.0, 0, g).rotation.x = 1.571 + 0.35; }
  else { // wall devices: a plank barricade (panel) or a tall planted lattice (trellis). userData.body is tinted by damage in main.js, so its material is its own.
    const tall = kind === 'trellis', ph = tall ? 2.7 : cfg.cannon.panelH, bm = new THREE.MeshLambertMaterial({ map: ptex('wood') }), n = tall ? 9 : Math.max(3, Math.round(ph / 0.26));
    const body = new THREE.Group(); g.add(body); g.userData.body = { material: bm };
    for (let k = 0; k < n; k++) { const pl = bx(0.92, ph / n - 0.03, 0.07, bm, (k % 2 ? 0.02 : -0.02), (k + 0.5) * ph / n, 0, body); pl.rotation.z = (k % 3 - 1) * 0.02; }
    for (const x of [-0.36, 0.36]) bx(0.08, ph, 0.06, MT.woodDark, x, ph / 2, 0.06, g);
    const br = bx(0.07, Math.hypot(0.72, ph * 0.8), 0.05, MT.woodDark, 0, ph / 2, 0.09, g); br.rotation.z = Math.atan2(0.72, ph * 0.8);
    if (tall) { mesh(new THREE.PlaneGeometry(1.0, 2.6), MT.vine, 0, 1.35, -0.06, g); mesh(new THREE.PlaneGeometry(1.0, 2.6), MT.vine, 0.05, 1.35, 0.12, g); }
  }
  return g;
}

// ---- crates: slatted wooden boxes with a painted band (green food, blue essentials)
// plain (owner Nov 22: "the loot are inside orb, some of the orb don't disappear"): no painted band, a plain wooden box that is no loot (the big box the cat hides behind)
export function crateMesh(kind, plain) {
  const g = new THREE.Group(); bx(0.58, 0.46, 0.58, MT.wood, 0, 0.23, 0, g); bx(0.62, 0.05, 0.62, MT.woodDark, 0, 0.47, 0, g);
  for (const [x, z] of [[-0.29, -0.29], [0.29, -0.29], [-0.29, 0.29], [0.29, 0.29]]) bx(0.07, 0.48, 0.07, MT.woodDark, x, 0.24, z, g);
  if (!plain) bx(0.6, 0.12, 0.6, kind === 'food' ? MT.food : MT.ess, 0, 0.24, 0, g).scale.set(1.01, 1, 1.01);
  return g;
}

// ---- the hidden lucky cat: a white beckoning cat with a red collar, a gold bell and a gold coin; arm is the waving paw's pivot
// style: an entry of CONFIG.catStyles (painted body and head wraps from klad, glaze colour, ear colours); none = the old plain white cat
const glaze = (key, o) => mat(key, () => new THREE.MeshPhongMaterial(Object.assign({ shininess: 70, specular: 0x555555 }, o)));
export function catMesh(style) {
  if (HIBASE) return catHi(style); // desktop: the modelled cat master (src/basehi.js), same painted wraps
  const S = style || null, mB = S ? glaze('catb_' + S.name, { map: ptex(S.body), color: 0xffffff }) : MT.catWhite, mH = S ? glaze('cath_' + S.name, { map: ptex(S.head), color: 0xffffff }) : MT.catWhite, mG = S ? glaze('catg_' + S.name, { color: S.glaze }) : MT.catWhite;
  if (S) for (const m of [mB, mH]) { m.map.wrapS = m.map.wrapT = THREE.ClampToEdgeWrapping; }
  const g = new THREE.Group(), body = mesh(new THREE.SphereGeometry(0.24, 24, 18), mB, 0, 0.27, 0, g); body.scale.set(1, 1.15, 0.9);
  mesh(new THREE.SphereGeometry(0.2, 24, 18), mH, 0, 0.68, 0, g);
  for (const sx of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.075, 0.13, 4), S ? glaze('cate_' + S.name + sx, { color: sx < 0 ? S.earL : S.earR }) : MT.catWhite, sx * 0.12, 0.88, 0, g); e.rotation.y = 0.785; mesh(new THREE.ConeGeometry(0.04, 0.08, 4), MT.catPink, sx * 0.12, 0.87, 0.02, g).rotation.y = 0.785;
    mesh(new THREE.SphereGeometry(0.028, 6, 5), S && S.eye ? glaze('caty_' + S.name, { color: S.eye, emissive: 0x2a1c04 }) : MT.catInk, sx * 0.075, 0.71, 0.18, g); mesh(new THREE.SphereGeometry(0.075, 8, 6), mG, sx * 0.13, 0.07, 0.14, g); }
  mesh(new THREE.SphereGeometry(0.022, 6, 5), MT.catPink, 0, 0.66, 0.197, g);
  const col = mesh(new THREE.TorusGeometry(0.165, 0.03, 6, 16), MT.catRed, 0, 0.5, 0, g); col.rotation.x = 1.571; mesh(new THREE.SphereGeometry(0.045, 8, 6), MT.catGold, 0, 0.46, 0.175, g);
  const coin = cyl(0.1, 0.1, 0.025, MT.catGold, 0, 0.26, 0.215, g, 14); coin.rotation.x = 1.571; coin.scale.y = 1; coin.scale.set(1, 1, 1.35);
  const arm = new THREE.Group(); arm.position.set(0.2, 0.52, 0.02); g.add(arm); const paw = cyl(0.05, 0.06, 0.3, mG, 0, 0.15, 0, arm, 8); mesh(new THREE.SphereGeometry(0.065, 8, 6), mG, 0, 0.31, 0.01, arm); paw.rotation.z = 0;
  if (S && S.side) arm.position.x = 0.2 * S.side;
  return { g, arm };
}

// ---- effects: a water jet for every shot, splinters when something breaks, smoke when a Gloom is destroyed
const UP = new THREE.Vector3(0, 1, 0);
// LAG FIX Nov 19 (owner's rule: pool shots and particles): the shot's jet, its splash drops and a kill's smoke share one geometry each (made once, marked pool so
// main.js drop() never frees it) and one material per colour (shared), instead of a new geometry and material for every shot. The jet is a cylinder 1 m long
// stretched to the shot's length along its axis (a basic material has no lighting, so the stretch changes nothing); smoke is a unit ball scaled to its size.
const PGEO = {};
const pgeo = (k, make) => { if (!PGEO[k]) { PGEO[k] = make(); PGEO[k].userData.pool = true; PGEO[k].userData.shared = true; } return PGEO[k]; };
export function jet(a, b, color) { // a thin stream from a to b: wider at the nozzle, with a brighter core
  const g = new THREE.Group();
  const o = new THREE.Mesh(pgeo('jetO', () => new THREE.CylinderGeometry(0.012, 0.04, 1, 6, 1, true)), mat('jetO' + color, () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false })));
  const c = new THREE.Mesh(pgeo('jetC', () => new THREE.CylinderGeometry(0.005, 0.014, 1, 5, 1, true)), mat('jetC', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })));
  g.add(o); g.add(c); return jetPlace(g, a, b);
}
// (LAG FIX Nov 19, owner 10:35: jets are pooled in main.js) set a jet made by jet() to run from a to b
const JD = new THREE.Vector3();
export function jetPlace(g, a, b) { JD.subVectors(b, a); const len = JD.length(); g.position.copy(a).addScaledVector(JD, 0.5); g.quaternion.setFromUnitVectors(UP, JD.normalize()); for (const m of g.children) m.scale.y = len; return g; }
export function droplet(color) { return new THREE.Mesh(pgeo('drop', () => new THREE.SphereGeometry(0.035, 5, 4)), mat('drop' + color, () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }))); }
// (LAG FIX Nov 19: one shared 1 m box scaled to each splinter's size, not a new box geometry per splinter)
export function splinter(kind) { const m = mesh(pgeo('unitBox', () => new THREE.BoxGeometry(1, 1, 1)), kind === 'panel' || kind === 'trellis' ? MT.wood : Math.random() < 0.5 ? MT.brass : MT.dark, 0, 0, 0);
  m.scale.set(0.1 + Math.random() * 0.25, 0.03 + Math.random() * 0.03, 0.04 + Math.random() * 0.05); m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); return m; }
export function smoke() { const m = new THREE.Mesh(pgeo('smoke', () => new THREE.SphereGeometry(1, 6, 5)), mat('smoke', () => new THREE.MeshBasicMaterial({ map: ptex('gloom'), color: 0xb8a0e0, transparent: true, opacity: 0.75, depthWrite: false }))); m.scale.setScalar(0.16 + Math.random() * 0.14); return m; }

// ---- a chalk ring on the floor (opening you can barricade, stair foot, ladder foot). Its material is its own: main.js flashes it.
export function ringMark(color, radius, opacity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * radius, 2 * radius), new THREE.MeshBasicMaterial({ map: ptex('ring'), color, transparent: true, opacity: opacity == null ? 0.8 : opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}
