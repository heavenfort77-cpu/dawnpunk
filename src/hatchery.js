// The HATCHERY corner and its birds (owner Nov 17: living scenery AND a small loop). Rules are in src/flock.js; numbers in CONFIG.avians.
// The corner: a wooden coop on legs with a little green roof and a solar petal, three nest boxes on its outer side (E there collects the eggs), a ramp and a pop-hole into a fenced run,
// a feed trough and a water dish, a chick pen with a heat lamp, straw on the ground, the bloom-tech INCUBATOR outside the run (a ceramic base, a solar-warmed glass dome with a small
// cell panel, a warm glow and the eggs you put in), and a hand-painted "HATCHERY" sign. Desktop: the density standard (one merged mesh per surface); phones: the same layout in fewer, plainer shapes.
// Birds: built in code, each from a few merged parts (body, head, crest, two wings, two legs) so they can peck, scratch, look about, flutter, walk, flee a running player and go to roost.
// Hens come in five plumages; the Sunquill (our own design) is moss green with a lighter breast, copper-tipped tail and a copper sun-crest that glows faintly. Chicks follow a hen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Placer, shapes, signTex } from './density.js';
import { ptex } from './props.js';
import { leafGeo } from './rooms.js';
import { hatchLayout } from './flock.js';
export { hatchLayout };

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z), C = (h) => new THREE.Color(h);
function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }
const sstep = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

// ---------------------------------------------------------------- layout: hatchLayout lives in src/flock.js (pure numbers, also used by the village cats' paths)
// what you bump into (world boxes [cx, cz, hx, hz]): the run's fence (the coop closes its east side), the coop, the incubator, the sign posts
export function hatchSolids(cfg) {
  const L = hatchLayout(cfg), r = L.run, co = L.coop, t = 0.06, out = [];
  out.push([(r.x0 + r.x1) / 2, r.z0, (r.x1 - r.x0) / 2, t], [(r.x0 + r.x1) / 2, r.z1, (r.x1 - r.x0) / 2, t], [r.x0, (r.z0 + r.z1) / 2, t, (r.z1 - r.z0) / 2]);
  out.push([r.x1, (r.z0 + co.z - co.d / 2) / 2, t, (co.z - co.d / 2 - r.z0) / 2], [r.x1, (co.z + co.d / 2 + r.z1) / 2, t, (r.z1 - co.z - co.d / 2) / 2]);
  out.push([co.x, co.z, co.w / 2 + 0.05, co.d / 2 + 0.05], [L.inc[0], L.inc[1], 0.42, 0.42], [L.sign[0], L.sign[1], 0.7, 0.12], [L.bench[0], L.bench[1], 0.2, 0.62]);
  return out;
}

// ---------------------------------------------------------------- materials and merge
const MC = {};
function mats(hi) {
  const k = hi ? 'hi' : 'lo'; if (MC[k]) return MC[k];
  const M = hi ? (o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85 }, o)); m.userData.shared = true; m.userData.pbr = true; return m; } : (o) => { const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o)); delete m.roughness; m.userData.shared = true; return m; };
  const L = (o) => { const c = Object.assign({}, o); if (!hi) { delete c.roughness; delete c.metalness; delete c.envMapIntensity; } return M(c); };
  MC[k] = { wood: L({ map: ptex('wood') }), metal: L({ map: ptex('metal'), roughness: 0.5, metalness: hi ? 0.6 : undefined }), cer: L({ map: ptex('glaze'), roughness: 0.35 }), cloth: L({ map: ptex('fabric'), side: THREE.DoubleSide }),
    straw: L({ map: ptex('fabric'), roughness: 1 }), leaf: L({ side: THREE.DoubleSide, roughness: 0.7 }), cell: L({ map: ptex('cell'), roughness: 0.2 }), plain: L({ roughness: 0.9 }),
    glass: L({ transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.05, envMapIntensity: hi ? 1.6 : undefined }), glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    sign: L({ map: signTex('HATCHERY', 409), roughness: 0.6 }), net: L({ transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6 }) };
  for (const m of Object.values(MC[k])) if (m.roughness === undefined && hi) m.roughness = 0.85;
  return MC[k];
}
function mergeInto(parent, acc, M) { let tri = 0; for (const [key, list] of acc) { const geos = []; for (const [geo, m, tint] of list) { const q = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k2 of Object.keys(q.attributes)) if (k2 !== 'position' && k2 !== 'normal' && k2 !== 'uv') q.deleteAttribute(k2); if (!q.attributes.normal) q.computeVertexNormals(); if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
      q.applyMatrix4(m); const n = q.attributes.position.count, cc = new Float32Array(n * 3), t = tint || C(0xffffff); for (let i = 0; i < n; i++) { cc[3 * i] = t.r; cc[3 * i + 1] = t.g; cc[3 * i + 2] = t.b; } q.setAttribute('color', new THREE.BufferAttribute(cc, 3)); geos.push(q); }
    const mg = mergeGeometries(geos, false); for (const q of geos) q.dispose(); if (!mg) continue; const me = new THREE.Mesh(mg, M[key] || M.plain); me.castShadow = !me.material.transparent; me.receiveShadow = true; parent.add(me); tri += mg.attributes.position.count / 3; } return tri; }
function placer() { const acc = new Map(); return { acc, P: new Placer((key, geo, m, tint) => { let a = acc.get(key); if (!a) acc.set(key, a = []); a.push([geo, m.clone(), tint]); }) }; }

// ---------------------------------------------------------------- the corner
export function buildHatchery(parent, cfg, hi) {
  const A = cfg.avians, L = hatchLayout(cfg), r = rng(1907), G = shapes(), { acc, P } = placer(), jit = (hx, k) => C(hx).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * (k || 0.08)), g = new THREE.Group(); parent.add(g);
  const run = L.run, co = L.coop, LG = leafGeo();
  // ground: a straw-and-earth patch over the run, a trodden path to the nest boxes and the incubator
  P.add('straw', G.box(run.x1 - run.x0 + 0.3, 0.02, run.z1 - run.z0 + 0.3, 1), (run.x0 + run.x1) / 2, 0.01, (run.z0 + run.z1) / 2, 0, 0, 0, 1, 1, 1, C(0xc8a868));
  P.add('straw', G.box(1.4, 0.016, 1.2, 1), L.nestOut[0] + 0.1, 0.008, L.nestOut[1], 0, 0, 0, 1, 1, 1, C(0xa89068)); P.add('straw', G.box(1.6, 0.016, 1.4, 1), L.inc[0], 0.008, L.inc[1], 0, 0, 0, 1, 1, 1, C(0xa89068));
  for (let k = 0; k < (hi ? 520 : 90); k++) { const x = run.x0 + r() * (run.x1 - run.x0), z = run.z0 + r() * (run.z1 - run.z0), t = r(); P.add('straw', G.box(0.1 + 0.12 * r(), 0.006, hi ? 0.008 : 0.014), x, 0.024, z, 0, r() * PI, (r() - 0.5) * 0.2, 1, 1, 1, jit(t < 0.5 ? 0xe2c47c : t < 0.8 ? 0xc8a058 : 0x9a7a48, 0.1)); }
  // the fence: posts, two rails, wire netting between (the coop closes the east side round its pop-hole)
  const fence = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.9)), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) { const t = i / n; P.add('wood', G.box(0.07, 0.95, 0.07), x0 + (x1 - x0) * t, 0.475, z0 + (z1 - z0) * t, 0, 0, (r() - 0.5) * 0.04, 1, 1, 1, jit(0x7a5a3a, 0.1)); if (hi) P.add('wood', G.cyl(0.0, 0.05, 0.06, 6), x0 + (x1 - x0) * t, 0.98, z0 + (z1 - z0) * t, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); }
    for (const y of [0.25, 0.85]) P.add('wood', G.box(0.04, 0.06, len), (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ry, 0, 1, 1, 1, jit(0x8a6a4a, 0.08));
    P.add('net', new THREE.PlaneGeometry(len, 0.7), (x0 + x1) / 2, 0.55, (z0 + z1) / 2, 0, ry + PI / 2, 0, 1, 1, 1, C(0x9aa898));
    if (hi) for (let i = 0; i <= Math.round(len / 0.12); i++) { const t = i / Math.round(len / 0.12); P.add('metal', G.box(0.004, 0.7, 0.004), x0 + (x1 - x0) * t, 0.55, z0 + (z1 - z0) * t, 0, 0, 0, 1, 1, 1, C(0x8a908a)); } };
  fence(run.x0, run.z0, run.x1, run.z0); fence(run.x0, run.z1, run.x1, run.z1); fence(run.x0, run.z0, run.x0, run.z1); fence(run.x1, run.z0, run.x1, co.z - co.d / 2); fence(run.x1, co.z + co.d / 2, run.x1, run.z1);
  // ---- the coop: on four legs, plank walls, a little barrel roof that is green on one side and a solar petal panel on the other, a pop-hole with a ramp, nest boxes outside
  const cx0 = co.x, cz0 = co.z, y0 = co.y, hw = co.w / 2, hd = co.d / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('wood', G.box(0.08, y0, 0.08), cx0 + sx * (hw - 0.05), y0 / 2, cz0 + sz * (hd - 0.05), 0, 0, 0, 1, 1, 1, jit(0x6a4a2a));
  P.add('wood', G.box(co.w, 0.06, co.d), cx0, y0 + 0.03, cz0, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a));
  if (hi) { for (const sz of [-1, 1]) for (let y = y0 + 0.08; y < y0 + co.h; y += 0.14) P.add('wood', G.box(co.w, 0.13, 0.03), cx0, y + 0.065, cz0 + sz * hd, 0, 0, 0, 1, 1, 1, jit(0xb08a5a, 0.1));
    for (const sx of [-1, 1]) for (let z = -hd + 0.07; z < hd; z += 0.15) { if (sx < 0 && Math.abs(z) < 0.2) continue; P.add('wood', G.box(0.03, co.h, 0.14), cx0 + sx * hw, y0 + co.h / 2, cz0 + z, 0, 0, 0, 1, 1, 1, jit(0xa07a50, 0.1)); } }
  else { for (const sz of [-1, 1]) P.add('wood', G.box(co.w, co.h, 0.04), cx0, y0 + co.h / 2, cz0 + sz * hd, 0, 0, 0, 1, 1, 1, C(0xb08a5a)); for (const sx of [-1, 1]) P.add('wood', G.box(0.04, co.h, co.d), cx0 + sx * hw, y0 + co.h / 2, cz0, 0, 0, 0, 1, 1, 1, C(0xa07a50)); }
  P.add('plain', G.box(0.02, 0.32, 0.26), cx0 - hw - 0.005, y0 + 0.2, cz0, 0, 0, 0, 1, 1, 1, C(0x1a1410));
  { const R = hd + 0.15; P.push(cx0, y0 + co.h, cz0, PI / 2); P.add('leaf', new THREE.CylinderGeometry(R, R, co.w + 0.3, 16, 1, true, 0, PI), 0, 0, 0, 0, 0, PI / 2, 0.55, 1, 1, jit(0x5a8a3a, 0.06)); P.pop();
    for (let k = 0; k < 3; k++) { P.push(cx0 - hw + 0.25 + k * 0.38, y0 + co.h + 0.32, cz0 - 0.32, 0, -0.6); P.add('cell', G.box(0.32, 0.012, 0.42), 0, 0, 0, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.add('metal', G.box(0.34, 0.02, 0.02), 0, 0, 0.21, 0, 0, 0, 1, 1, 1, C(0x7fbfae)); P.pop(); }
    if (hi) for (let k = 0; k < 14; k++) { P.push(cx0 - hw + r() * co.w, y0 + co.h + 0.36, cz0 + 0.15 + r() * 0.3, r() * 6.28, -0.5 - 0.6 * r()); P.add('leaf', LG, 0, 0, 0, 0, 0, 0, 0.06, 0.06, 0.12, jit(0x4f9a3a, 0.12)); P.pop(); } }
  // the ramp with cleats from the run up to the pop-hole
  { const [[ax, az, ay], [bx, bz, by]] = L.ramp, len = Math.hypot(bx - ax, by - ay); P.push((ax + bx) / 2, (ay + by) / 2 + 0.02, az, 0, 0, -Math.atan2(by - ay, bx - ax)); P.add('wood', G.box(len, 0.03, 0.26), 0, 0, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k < 5; k++) P.add('wood', G.box(0.025, 0.025, 0.24), -len / 2 + 0.1 + k * (len - 0.2) / 4, 0.025, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); P.pop(); }
  // three nest boxes on the outer (east) side with a lifting lid and straw; the eggs in them come and go (eggMeshes)
  const nests = []; for (let k = 0; k < 3; k++) { const z = cz0 - 0.45 + k * 0.45, x = cx0 + hw + 0.18; P.add('wood', G.box(0.36, 0.3, 0.42), x, y0 + 0.3, z, 0, 0, 0, 1, 1, 1, jit(0x9a7048, 0.08)); P.add('wood', G.box(0.4, 0.03, 0.44), x + 0.02, y0 + 0.48, z, 0, 0, -0.25, 1, 1, 1, jit(0x3f8f6a, 0.06)); P.add('straw', G.box(0.3, 0.04, 0.36, 1), x, y0 + 0.18, z, 0, 0, 0, 1, 1, 1, C(0xe0c888)); nests.push([x, y0 + 0.22, z]); }
  // feed trough and water: a wooden trough of grain; a ceramic dish under a rain jar
  { const [tx, tz] = L.trough; P.add('wood', G.box(1.0, 0.16, 0.22), tx, 0.12, tz, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a)); P.add('straw', G.box(0.92, 0.02, 0.16, 1), tx, 0.2, tz, 0, 0, 0, 1, 1, 1, C(0xd8b060)); for (const sx of [-0.45, 0.45]) P.add('wood', G.box(0.06, 0.12, 0.26), tx + sx, 0.06, tz, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a));
    if (hi) for (let k = 0; k < 40; k++) P.add('cer', G.sphere(0.008, 4, 3), tx + (r() - 0.5) * 0.86, 0.215, tz + (r() - 0.5) * 0.12, 0, 0, 0, 1, 1, 1, jit(0xd8b060, 0.1));
    const [wx, wz] = L.water; P.add('cer', G.lathe('dish', [[0, 0], [0.18, 0], [0.22, 0.07], [0.23, 0.08]], 16), wx, 0.02, wz, 0, 0, 0, 1, 1, 1, jit(0x3f7f6a)); P.add('glass', G.cyl(0.18, 0.18, 0.01, 16), wx, 0.08, wz, 0, 0, 0, 1, 1, 1, C(0x8fd0e0));
    P.add('cer', G.lathe('rjar', [[0, 0], [0.1, 0], [0.14, 0.15], [0.12, 0.35], [0.06, 0.42], [0.07, 0.45]], 14), wx + 0.1, 0.0, wz + 0.25, 0, 0, 0, 1, 1, 1, jit(0xf2ecdc)); }
  // the chick pen: a low fence, straw, a heat lamp on a stand
  { const p = L.pen; for (const [a, b, c2, d] of [[p.x0, p.z0, p.x1, p.z0], [p.x1, p.z0, p.x1, p.z1 - 0.35], [p.x0, p.z0, p.x0, p.z1], [p.x0, p.z1, p.x1 - 0.35, p.z1]]) { const len = Math.hypot(c2 - a, d - b), ry = Math.atan2(c2 - a, d - b); P.add('wood', G.box(0.03, 0.22, len), (a + c2) / 2, 0.11, (b + d) / 2, 0, ry, 0, 1, 1, 1, jit(0xb08a5a)); }
    P.add('straw', G.box(p.x1 - p.x0 - 0.05, 0.03, p.z1 - p.z0 - 0.05, 1), (p.x0 + p.x1) / 2, 0.03, (p.z0 + p.z1) / 2, 0, 0, 0, 1, 1, 1, C(0xe8d098));
    P.rod('metal', G, V(p.x0 + 0.12, 0, p.z0 + 0.12), V(p.x0 + 0.12, 0.62, p.z0 + 0.12), 0.012, 6, C(0x5a5650)); P.rod('metal', G, V(p.x0 + 0.12, 0.62, p.z0 + 0.12), V(p.x0 + 0.4, 0.55, p.z0 + 0.4), 0.01, 6, C(0x5a5650));
    P.add('metal', G.cyl(0.04, 0.12, 0.1, 12, true), p.x0 + 0.4, 0.5, p.z0 + 0.4, 0, 0, 0, 1, 1, 1, C(0xc87a3a)); P.add('glow', G.sphere(0.04, 8, 6), p.x0 + 0.4, 0.46, p.z0 + 0.4, 0, 0, 0, 1, 1, 1, C(0xff9a50)); }
  // ---- the incubator: a ceramic base on leaf feet, a copper ring, a glass dome over a straw nest with a warm glow, a small solar cell panel on a curled stem
  const [ix, iz] = L.inc; let incEggs = [];
  { P.add('cer', G.lathe('incb', [[0, 0], [0.34, 0], [0.38, 0.05], [0.33, 0.18], [0.36, 0.42], [0.4, 0.46]], hi ? 24 : 12), ix, 0, iz, 0, 0, 0, 1, 1, 1, jit(0xf2ecdc));
    P.add('metal', G.torus(0.39, 0.025, 6, hi ? 32 : 14), ix, 0.47, iz, PI / 2, 0, 0, 1, 1, 1, C(0xd8a070)); P.add('straw', G.cyl(0.33, 0.33, 0.04, hi ? 20 : 10), ix, 0.48, iz, 0, 0, 0, 1, 1, 1, C(0xe8d098));
    P.add('glass', new THREE.SphereGeometry(0.38, hi ? 28 : 14, hi ? 14 : 7, 0, 2 * PI, 0, PI / 2), ix, 0.47, iz, 0, 0, 0, 1, 1, 1, C(0xe8f4f0)); P.add('glow', G.sphere(0.05, 8, 6), ix, 0.78, iz, 0, 0, 0, 1, 1, 1, C(0xffc870));
    P.add('metal', G.cyl(0.03, 0.05, 0.05, 10), ix, 0.85, iz, 0, 0, 0, 1, 1, 1, C(0xd8a070)); P.rod('metal', G, V(ix + 0.3, 0.42, iz + 0.2), V(ix + 0.5, 0.95, iz + 0.32), 0.012, 6, C(0x7fbfae));
    P.push(ix + 0.52, 1.0, iz + 0.33, -0.5, -0.9); P.add('cell', G.box(0.32, 0.012, 0.22), 0, 0, 0, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.add('metal', G.box(0.34, 0.02, 0.24), 0, -0.012, 0, 0, 0, 0, 1, 1, 1, C(0x7fbfae)); P.pop();
    if (hi) { for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.4; P.push(ix + Math.cos(a) * 0.36, 0.02, iz + Math.sin(a) * 0.36, Math.atan2(Math.cos(a), Math.sin(a)), -0.15); P.add('leaf', LG, 0, 0, 0, 0, 0, 0, 0.16, 0.16, 0.22, jit(0x7fbfae, 0.06)); P.pop(); }
      for (let k = 0; k < 12; k++) { const a = k / 12 * 2 * PI; P.add('metal', G.sphere(0.012, 5, 4), ix + Math.cos(a) * 0.39, 0.47, iz + Math.sin(a) * 0.39, 0, 0, 0, 1, 1, 1, C(0xb08048)); } } }
  // a bench along the run's west side (people and cats sit and watch the hens)
  { const [bx, bz] = L.bench; P.push(bx, 0, bz, PI / 2); for (const sx of [-0.5, 0.5]) P.add('wood', G.box(0.06, 0.44, 0.34), sx, 0.22, 0, 0, 0, 0, 1, 1, 1, jit(0x3f8f6a, 0.06)); P.add('wood', G.box(1.2, 0.05, 0.36), 0, 0.445, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); if (hi) { for (let k = 0; k < 5; k++) P.add('wood', G.box(0.22, 0.012, 0.36), -0.48 + k * 0.24, 0.475, 0, 0, 0, 0, 1, 1, 1, jit(0x9a7a5a, 0.1)); } P.pop(); }
  // the sign on two posts, facing the plaza
  { const [sx, sz] = L.sign; for (const dx of [-0.6, 0.6]) P.add('wood', G.box(0.07, 1.5, 0.07), sx + dx, 0.75, sz, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); P.add('wood', G.box(1.3, 0.48, 0.04), sx, 1.3, sz, 0, 0, 0, 1, 1, 1, C(0x3f8f6a)); P.add('sign', new THREE.PlaneGeometry(1.22, 0.42), sx, 1.3, sz - 0.022, 0, PI, 0);
    if (hi) for (const dx of [-0.6, 0.6]) { P.add('pot', G.cyl(0.14, 0.11, 0.24, 12), sx + dx, 0.12, sz - 0.25, 0, 0, 0, 1, 1, 1, C(0xd08860)); for (let k = 0; k < 7; k++) { P.push(sx + dx, 0.24, sz - 0.25, k * 0.9, -0.7 - 0.3 * r()); P.add('leaf', LG, 0, 0, 0, 0, 0, 0, 0.08, 0.08, 0.2, jit(0x4f9a3a, 0.1)); P.pop(); } } }
  const tri = mergeInto(g, acc, mats(hi));
  // eggs: meshes that show what the coop and the incubator hold (refresh)
  const eggG = new THREE.SphereGeometry(0.035, 10, 8); eggG.scale(1, 1.3, 1); const eggM = new THREE.MeshStandardMaterial({ color: 0xf2e6d0, roughness: 0.5 });
  const coopEggs = []; for (let k = 0; k < 6; k++) { const n = nests[k % 3], e = new THREE.Mesh(eggG, eggM); e.position.set(n[0] + (k < 3 ? -0.06 : 0.06), n[1], n[2] + (k < 3 ? 0.05 : -0.05)); e.visible = false; g.add(e); coopEggs.push(e); }
  for (let k = 0; k < A.slots; k++) { const a = k / A.slots * 2 * PI, e = new THREE.Mesh(eggG, eggM); e.position.set(ix + Math.cos(a) * 0.13, 0.535, iz + Math.sin(a) * 0.13); e.visible = false; g.add(e); incEggs.push(e); }
  const glowL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.0, depthWrite: false })); glowL.position.set(ix, 0.56, iz); glowL.scale.y = 0.6; g.add(glowL);
  return { group: g, tri, L, refresh(F) { const n = Math.min(6, F.coop); coopEggs.forEach((e, k) => { e.visible = k < n; }); incEggs.forEach((e, k) => { e.visible = k < F.inc.length; }); glowL.material.opacity = F.inc.length ? 0.22 : 0.06; } };
}

// ---------------------------------------------------------------- the birds
// plumages: [body, breast / hackle, tail and wing tips, pattern] (pattern: 0 plain, 1 laced, 2 barred, 3 speckled); the Sunquill: moss green, a lighter breast, dark green tail with copper tips
const PLUMAGE = [[0x8a4a28, 0xa8642e, 0x2a2018, 0], [0xd8cdb4, 0xe6dcc6, 0x3a3a34, 3], [0x24261f, 0x2e3a2a, 0x141a14, 0], [0x6e6e66, 0x8a8a80, 0x34342e, 2], [0xb88a4a, 0xcaa060, 0x5a3e20, 1]];
const SUN = [0x56703a, 0x8aa45a, 0x2f4422, 0];
const hsh = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
// a part from geometries placed by matrices; each vertex shaded: lighter where the surface faces up, darker underneath, a little feather mottling, and the plumage pattern (shade = [pattern, scale])
function partMesh(list, mat) { const geos = list.map(([geo, m, col, shade]) => { const q = geo.index ? geo.toNonIndexed() : geo.clone(); q.applyMatrix4(m); for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); if (!q.attributes.normal) q.computeVertexNormals();
    const P = q.attributes.position, N = q.attributes.normal, n = P.count, cc = new Float32Array(n * 3), c = C(col), t = new THREE.Color();
    for (let i = 0; i < n; i++) { t.copy(c); if (shade) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), up = N.getY(i), pat = shade[0], k = shade[1] || 1; let f = 0.78 + 0.3 * Math.max(-1, Math.min(1, up)) + (hsh(Math.floor(x * 90 * k), Math.floor(y * 90 * k), Math.floor(z * 90 * k)) - 0.5) * 0.14;
        if (pat === 1 && hsh(Math.floor(x * 40), Math.floor(y * 40), Math.floor(z * 40)) > 0.7) f *= 0.62; if (pat === 2 && Math.sin(y * 160 + z * 40) > 0.45) f *= 0.55; if (pat === 3 && hsh(Math.floor(x * 120), Math.floor(y * 120), Math.floor(z * 120)) > 0.86) f *= 0.4; t.multiplyScalar(f); }
      cc[3 * i] = t.r; cc[3 * i + 1] = t.g; cc[3 * i + 2] = t.b; } q.setAttribute('color', new THREE.BufferAttribute(cc, 3)); return q; });
  const g = mergeGeometries(geos, false); geos.forEach((q) => q.dispose()); const me = new THREE.Mesh(g, mat); me.castShadow = true; return me; }
const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), V(sx || 1, sy || sx || 1, sz || sx || 1));
const BM = {};
function birdMats(hi) { const k = hi ? 'h' : 'l'; if (BM[k]) return BM[k]; const mk = (o) => (hi ? new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }, o)) : new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true, side: THREE.DoubleSide }, o)));
  BM[k] = { feather: mk({}), crest: hi ? new THREE.MeshStandardMaterial({ color: 0xc8823e, metalness: 0.65, roughness: 0.38, emissive: 0xc86a24, emissiveIntensity: 0.3, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ color: 0xc8823e, emissive: 0x6a300c, side: THREE.DoubleSide }) }; for (const m of Object.values(BM[k])) m.userData.shared = true; return BM[k]; }
// one bird (owner Nov 17: a proper hen, not a toy): a deep breast, the back rising to an upturned fan of tail feathers, a cushion of saddle feathers, a hackled neck, a small head
// with a short beak, red serrated comb and wattles, an orange eye; wings of layered feather cards; feathered thighs over yellow scaly shanks with three toes forward and one back.
// kind 'hen' / 'sunquill' (same build, moss green with a copper sun-crest instead of the comb) / 'chick' (a small fluffy round chick); pal = plumage; D = detail (CONFIG.avians.high / low)
export function makeBird(kind, pal, hi, D) {
  const s = D.seg, M = birdMats(hi), chick = kind === 'chick', sun = kind === 'sunquill', [cb, cbr, ct, pat] = sun ? SUN : PLUMAGE[pal % PLUMAGE.length], root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const sph = new THREE.SphereGeometry(1, s, Math.max(6, s * 0.75 | 0)), cone = new THREE.ConeGeometry(1, 1, Math.max(5, s / 2 | 0)), cyl = new THREE.CylinderGeometry(1, 1, 1, Math.max(5, s / 2 | 0)), LG = leafGeo(), sh = [pat, 1];
  if (chick) { body.add(partMesh([[sph, M4(0, 0.075, 0, 0, 0, 0, 0.05, 0.048, 0.058), 0xe8c858, [3, 2]], [sph, M4(0, 0.07, -0.05, -0.4, 0, 0, 0.03, 0.026, 0.03), 0xd8b848, [0, 2]]], M.feather));
    const head = new THREE.Group(); head.position.set(0, 0.11, 0.035); body.add(head); head.add(partMesh([[sph, M4(0, 0.01, 0.0, 0, 0, 0, 0.032, 0.032, 0.033), 0xf0d468, [0, 2]], [cone, M4(0, 0.008, 0.038, PI / 2 + 0.2, 0, 0, 0.007, 0.016, 0.006), 0xc89a3a], [sph, M4(-0.024, 0.016, 0.02, 0, 0, 0, 0.005, 0.005, 0.005), 0x101010], [sph, M4(0.024, 0.016, 0.02, 0, 0, 0, 0.005, 0.005, 0.005), 0x101010]], M.feather));
    const wings = [new THREE.Group(), new THREE.Group()]; wings.forEach((w) => body.add(w)); const legs = []; for (const sx of [-1, 1]) { const l = new THREE.Group(); l.position.set(sx * 0.018, 0.04, 0); root.add(l); l.add(partMesh([[cyl, M4(0, -0.02, 0, 0, 0, 0, 0.005, 0.04, 0.005), 0xd8a838], [cyl, M4(0, -0.04, 0.008, PI / 2, 0, 0, 0.003, 0.02, 0.003), 0xd8a838]], M.feather)); legs.push(l); }
    return { root, body, head, wings, legs, kind, chick, headZ: 0.035 }; }
  // body: breast, back rising to the rear, saddle cushion, belly fluff, feathered thighs, the hackled neck
  const bl = [[sph, M4(0, 0.275, 0.07, 0.2, 0, 0, 0.115, 0.125, 0.125), cbr, sh], [sph, M4(0, 0.315, -0.04, -0.28, 0, 0, 0.11, 0.098, 0.185), cb, sh], [sph, M4(0, 0.385, -0.155, -0.7, 0, 0, 0.085, 0.075, 0.1), cb, sh], [sph, M4(0, 0.215, -0.05, 0, 0, 0, 0.098, 0.075, 0.12), cbr, sh],
    [sph, M4(0, 0.42, 0.115, 0.45, 0, 0, 0.058, 0.095, 0.06), cbr, sh]];
  for (const sx of [-1, 1]) bl.push([sph, M4(sx * 0.055, 0.2, -0.015, 0.2, 0, 0, 0.045, 0.06, 0.055), cb, sh]);
  // tail: an upturned fan of feathers (two rows), dark with a sheen; the Sunquill's tipped with copper
  // (the fan opens upward in the bird's own vertical plane: feathers point up and back, spread a little side to side, not a sideways skirt)
  const nf = D.feathers + 3; for (let row = 0; row < 2; row++) for (let k = 0; k < nf; k++) { const a = (k / (nf - 1) - 0.5) * 2; bl.push([LG, M4(a * 0.025, 0.37 + row * 0.015, -0.19 - row * 0.012, -1.3 + Math.abs(a) * 0.25 - row * 0.12, PI + a * 0.22, a * 0.25, 0.045 - row * 0.008, 1, 0.14 - row * 0.025), row === 0 && sun && k % 2 ? 0xb8742e : ct, [0, 3]]); }
  body.add(partMesh(bl, M.feather));
  // head on a neck pivot: skull, short beak, comb (serrated, red) and wattles, orange eye with a dark pupil, earlobe
  const head = new THREE.Group(); head.position.set(0, 0.47, 0.14); body.add(head);
  const hl = [[sph, M4(0, 0.02, 0.015, 0, 0, 0, 0.04, 0.042, 0.05), cbr, sh], [cone, M4(0, 0.012, 0.072, PI / 2 + 0.25, 0, 0, 0.011, 0.034, 0.008), 0xd0a040]];
  for (const sx of [-1, 1]) { hl.push([sph, M4(sx * 0.034, 0.03, 0.035, 0, 0, 0, 0.009, 0.009, 0.007), 0xd8782a], [sph, M4(sx * 0.038, 0.031, 0.037, 0, 0, 0, 0.0045, 0.0045, 0.004), 0x0a0a0a], [sph, M4(sx * 0.03, 0.0, 0.0, 0, 0, 0, 0.004, 0.01, 0.008), 0xd84030]); }
  if (!sun) { for (let k = 0; k < 5; k++) hl.push([cone, M4(0, 0.07 + 0.012 * Math.sin(k / 4 * PI), -0.012 + k * 0.016, -0.25 + k * 0.12, 0, 0, 0.009, 0.03 + 0.012 * Math.sin(k / 4 * PI), 0.006), 0xb81e28]); hl.push([sph, M4(0, 0.058, 0.02, 0, 0, 0, 0.006, 0.012, 0.03), 0xb81e28]);
    for (const sx of [-1, 1]) hl.push([sph, M4(sx * 0.007, -0.022, 0.058, 0.2, 0, 0, 0.008, 0.02, 0.008), 0xb81e28]); }
  head.add(partMesh(hl, M.feather));
  if (sun) { const cl = []; for (let k = 0; k < D.crest; k++) { const a = (k / (D.crest - 1) - 0.5) * 1.9; cl.push([cone, M4(Math.sin(a) * 0.01, 0.075 + Math.cos(a) * 0.03, 0.01 - Math.cos(a) * 0.008, -0.25, 0, -a, 0.006, 0.06 + 0.02 * Math.cos(a), 0.005), 0xffffff]); } cl.push([sph, M4(0, 0.068, 0.012, 0, 0, 0, 0.014, 0.01, 0.01), 0xffffff]); head.add(partMesh(cl, M.crest)); }
  // wings: a folded wing body with layered feather cards (coverts over primaries); on phones they join the body and do not flap
  const wings = [], lowW = []; for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * 0.1, 0.34, 0.04); body.add(w); const wl = [[sph, M4(sx * 0.012, -0.02, -0.07, 0.15, 0, 0, 0.032, 0.07, 0.125), cb, sh]];
    if (hi) for (let k = 0; k < 6; k++) wl.push([LG, M4(sx * 0.026, -0.035 - 0.008 * k, -0.03 - 0.022 * k, 0.12, sx * 0.04 + PI, sx * (PI / 2 - 0.05), 0.04, 0.4, 0.085 + 0.01 * k), k < 3 ? cb : ct, [pat, 1]]);
    else wl.push([sph, M4(sx * 0.028, -0.05, -0.12, 0.2, 0, 0, 0.022, 0.035, 0.08), ct]);
    if (hi) w.add(partMesh(wl, M.feather)); else for (const [geo, m, c, sd] of wl) lowW.push([geo, m.clone().premultiply(new THREE.Matrix4().makeTranslation(w.position.x, w.position.y, w.position.z)), c, sd]); wings.push(w); }
  if (lowW.length) body.add(partMesh(lowW, M.feather));
  // legs on hip pivots: yellow shanks banded like scales, three toes forward and one back
  const legs = []; for (const sx of [-1, 1]) { const l = new THREE.Group(); l.position.set(sx * 0.045, 0.17, 0); root.add(l); const ll = [[cyl, M4(0, -0.085, 0, 0, 0, 0, 0.011, 0.17, 0.011), 0xd2a83a, hi ? [2, 3] : null]];
    for (const [a, len] of [[-0.45, 0.06], [0, 0.07], [0.45, 0.06], [PI, 0.035]]) ll.push([cyl, M4(Math.sin(a) * len * 0.5, -0.168, Math.cos(a) * len * 0.5, PI / 2, a, 0, 0.006, len, 0.006), 0xc8a03a]);
    l.add(partMesh(ll, M.feather)); legs.push(l); }
  return { root, body, head, wings, legs, kind, chick, headZ: 0.14 };
}

// ---------------------------------------------------------------- the flock in the run: wander, peck, scratch, look, flutter, flee a running player, go to roost; chicks follow a hen
export function createFlock(parent, cfg, hi, F, seed) {
  const A = cfg.avians, D = hi ? A.high : A.low, L = hatchLayout(cfg), run = L.run, pen = L.pen, r = rng(seed || 77), birds = [];
  const list = [...F.birds.filter((b) => b.kind === 'sunquill'), ...F.birds.filter((b) => b.kind !== 'sunquill')].slice(0, D.birds), mothers = list.slice();
  // chicks have their own small cap on top of the grown birds (CONFIG.avians high / low chicks)
  const chicks = F.chicks.slice(0, D.chicks || 0);
  const inRun = (x, z, chick) => { x = Math.max(run.x0 + 0.25, Math.min(run.x1 - 0.25, x)); z = Math.max(run.z0 + 0.25, Math.min(run.z1 - 0.25, z)); if (!chick && x < pen.x1 + 0.1 && z < pen.z1 + 0.1) { if (pen.x1 + 0.1 - x < pen.z1 + 0.1 - z) x = pen.x1 + 0.1; else z = pen.z1 + 0.1; } return [x, z]; };
  const spot = (chick) => inRun(run.x0 + r() * (run.x1 - run.x0), run.z0 + r() * (run.z1 - run.z0), chick);
  for (const b of list) { const m = makeBird(b.kind, b.id, hi, D), [x, z] = spot(false); m.root.position.set(x, 0, z); m.root.rotation.y = r() * 6.28; parent.add(m.root); birds.push(Object.assign(m, { id: b.id, x, z, yaw: m.root.rotation.y, st: 'look', t: r() * 2, dur: 1 + r() * 2, tx: x, tz: z, ph: r() * 6, look: 0, peck: 0, home: false, gone: false })); }
  chicks.forEach((c, i) => { const mom = birds[i % Math.max(1, birds.length)], m = makeBird('chick', 0, hi, D), x = mom ? mom.x - 0.3 : run.x0 + 0.5, z = mom ? mom.z - 0.2 : run.z0 + 0.5; m.root.position.set(x, 0, z); parent.add(m.root); birds.push(Object.assign(m, { id: c.id, x, z, yaw: 0, st: 'follow', t: 0, dur: 1, ph: r() * 6, mom, slot: i, look: 0, peck: 0, gone: false })); });
  const pick = (b) => { const u = r(); if (u < 0.32) { b.st = 'walk'; [b.tx, b.tz] = spot(b.chick); b.dur = 6; } else if (u < 0.6) { b.st = 'peck'; b.dur = A.peck[0] + r() * (A.peck[1] - A.peck[0]); } else if (u < 0.75) { b.st = 'scratch'; b.dur = A.scratch[0] + r() * (A.scratch[1] - A.scratch[0]); } else if (u < 0.93) { b.st = 'look'; b.dur = A.look[0] + r() * (A.look[1] - A.look[0]); b.lookTo = (r() - 0.5) * 1.6; } else { b.st = 'flutter'; b.dur = A.flutter[0] + r() * (A.flutter[1] - A.flutter[0]); } b.t = 0; };
  let ppx = null, ppz = null, pspeed = 0;
  function update(dt, px, pz, roost) {
    if (dt <= 0) return; if (ppx !== null) { const v = Math.hypot(px - ppx, pz - ppz) / dt; pspeed += (v - pspeed) * Math.min(1, dt * 4); } ppx = px; ppz = pz; const running = pspeed > A.runSpeed;
    const [rax, raz, ray] = L.ramp[0], [rbx, rbz, rby] = L.ramp[1];
    for (const b of birds) { if (b.gone) continue; b.t += dt; b.ph += dt;
      let want = null, speed = A.walk;
      if (roost && !b.chick) { if (b.st !== 'roost') { b.st = 'roost'; b.t = 0; b.leg = 0; } want = b.leg === 0 ? [rax - 0.15, raz] : [rbx + 0.2, rbz]; }
      else if (roost && b.chick) { b.st = 'roost'; want = b.mom && !b.mom.gone ? [b.mom.x - 0.2, b.mom.z] : [rax - 0.15, raz]; if (b.mom && b.mom.gone) { b.gone = true; b.root.visible = false; continue; } }
      else if (running && Math.hypot(px - b.x, pz - b.z) < A.flee) { b.st = 'flee'; b.t = 0; b.dur = 0.9; const d = Math.hypot(b.x - px, b.z - pz) || 1; [b.tx, b.tz] = inRun(b.x + (b.x - px) / d * 1.2, b.z + (b.z - pz) / d * 1.2, b.chick); }
      if (!roost) { if (b.chick) { const m = b.mom; if (m && !m.gone) { const k = (b.slot % 3) - 1; [b.tx, b.tz] = inRun(m.x - Math.sin(m.yaw) * A.chick[0] + Math.cos(m.yaw) * k * 0.15, m.z - Math.cos(m.yaw) * A.chick[0] - Math.sin(m.yaw) * k * 0.15, true); } if (Math.hypot(b.tx - b.x, b.tz - b.z) > 0.12) want = [b.tx, b.tz]; speed = A.walk * 1.3; if (b.t > b.dur) { b.t = 0; b.dur = 0.6 + r() * 1.2; b.peck = r() < 0.5 ? 1 : 0; } }
        else if (b.st === 'flee') { want = [b.tx, b.tz]; speed = A.run; if (b.t > b.dur) pick(b); }
        else if (b.st === 'walk') { want = [b.tx, b.tz]; if (Math.hypot(b.tx - b.x, b.tz - b.z) < 0.1 || b.t > b.dur) pick(b); }
        else if (b.t > b.dur) pick(b); }
      // move toward 'want' along the body's facing, turning on the way
      let moving = false; if (want) { const dx = want[0] - b.x, dz = want[1] - b.z, d = Math.hypot(dx, dz);
        if (b.st === 'roost' && !b.chick) { if (b.leg === 0 && d < 0.12) b.leg = 1; if (b.leg === 1 && b.x > rbx + 0.1) { b.gone = true; b.root.visible = false; continue; } }
        if (d > 0.03) { const yw = Math.atan2(dx, dz); let dy = yw - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += Math.max(-dt * 6, Math.min(dt * 6, dy)); const sp = Math.min(speed, d / Math.max(dt, 1e-3)) * Math.max(0, Math.cos(dy)); b.x += Math.sin(b.yaw) * sp * dt; b.z += Math.cos(b.yaw) * sp * dt; moving = sp > 0.02; } }
      if (!(b.st === 'roost' && b.leg === 1)) [b.x, b.z] = inRun(b.x, b.z, b.chick);
      // height: on the ramp while going in to roost
      let y = 0; if (b.st === 'roost' && !b.chick && b.leg === 1) y = ray + (rby - ray) * Math.max(0, Math.min(1, (b.x - rax) / (rbx - rax)));
      b.root.position.set(b.x, y, b.z); b.root.rotation.y = b.yaw;
      // pose: legs step while walking, the head pulses forward and back, pecks and scratches, looks about, wings flap when fluttering or fleeing
      const S = b.chick ? 0.38 : 1, step = moving ? Math.sin(b.ph * (b.chick ? 16 : 11)) : 0;
      b.legs[0].rotation.x = step * 0.5; b.legs[1].rotation.x = -step * 0.5; b.body.position.y = moving ? Math.abs(step) * 0.012 * S : 0;
      // the head bob of a walking hen: the head holds still in space while the body walks under it, then thrusts forward (a saw-tooth, eased so it does not snap)
      const saw = (b.ph * (b.chick ? 2.6 : 1.75)) % 1, thrust = saw < 0.72 ? -saw / 0.72 : -1 + (saw - 0.72) / 0.28 * (2 - (saw - 0.72) / 0.28); let hx = 0, hy = 0, hz = moving ? (thrust + 0.5) * 0.045 * S : 0, fl = 0, bodyX = 0;
      if (b.st === 'peck' || (b.chick && b.peck)) { const pk = Math.max(0, Math.sin(b.ph * 9)); hx = 0.9 * Math.pow(pk, 3); bodyX = 0.35 * sstep(Math.min(1, b.t * 3)); }
      else if (b.st === 'scratch') { const k = Math.sin(b.ph * 8); b.legs[k > 0 ? 0 : 1].rotation.x = -0.8 * Math.abs(k); bodyX = 0.2; hx = 0.35; }
      else if (b.st === 'look') { b.look += (b.lookTo - b.look) * Math.min(1, dt * 5); hy = b.look; if (b.t > b.dur * 0.5 && b.t < b.dur * 0.5 + dt) b.lookTo = -b.lookTo * 0.7; }
      else if (b.st === 'flutter' || b.st === 'flee') { fl = Math.abs(Math.sin(b.ph * 22)) * (b.st === 'flee' ? 0.8 : 1.2); if (b.st === 'flutter') b.root.position.y += Math.sin(Math.min(1, b.t / b.dur) * PI) * 0.08; }
      b.head.rotation.set(hx, hy, 0); b.head.position.z = b.headZ + hz; b.body.rotation.x = bodyX; b.wings[0].rotation.z = -fl; b.wings[1].rotation.z = fl; }
  }
  return { birds, update, shown: () => birds.filter((b) => !b.gone).length };
}
