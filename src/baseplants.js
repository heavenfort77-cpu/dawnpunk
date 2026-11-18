// LAYERED PLANTS for the base (round 2, owner Nov 17 21:46: "replace the simple leaf fans"): desktop only; phones keep the cheaper leaf fans.
// Six kinds built in code, each one geometry with its colours painted on the vertices, drawn as one instanced mesh per kind (so a whole base of plants costs six draw calls):
//   herb   - a clump of thin upright stems with pairs of small oval leaves up each stem (basil, mint, sage)
//   leafy  - a rosette of broad, cupped, ruffled leaves, dark outside and pale at the heart (lettuce, chard, young cabbage)
//   shrub  - a woody flowering shrub: branching stems, many small pointed leaves and clusters of five-petal flowers
//   fern   - arching fronds with leaflets in pairs along each rib, for the stream banks
//   flower - a leafy perennial with a few tall stalks and daisy heads (window boxes, planters)
//   bush   - a garden bush of overlapping lobes of small leaves, darker inside, stems at the foot (the cat-cover bushes by the garden, desktop)
// Each placement gets its own turn, size and tint (instanceColor), so beds read as many different plants. Numbers: CONFIG.baseLife.plants.
import * as THREE from 'three';

const PI = Math.PI;
function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }
// a growing list of triangles with vertex colours
function Mesh() { const P = [], C = [], I = []; return { P, C, I, v(x, y, z, c) { P.push(x, y, z); C.push(c.r, c.g, c.b); return P.length / 3 - 1; }, t(a, b, c) { I.push(a, b, c); } }; }
const col = (h) => new THREE.Color(h), mix = (a, b, t) => a.clone().lerp(b, t);
// a leaf along a direction: base at p, pointing along dir (unit), its face turned by 'roll' about dir; length L, width W, shape(t) = width profile 0..1,
// bend = droop along its length, cup = how much the sides curl up; colours from base (cb) to tip (ct), midrib a little lighter; n = segments along, m = across (odd)
function leaf(M, p, dir, roll, L, W, shape, bend, cup, cb, ct, n, m) {
  const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(dir, up).normalize(), nrm = new THREE.Vector3().crossVectors(side, dir).normalize();
  side.applyAxisAngle(dir, roll); nrm.applyAxisAngle(dir, roll); const rows = [];
  for (let i = 0; i <= n; i++) { const t = i / n, w = W * shape(t), drop = bend * t * t, row = [];
    for (let j = 0; j < m; j++) { const s = (j / (m - 1)) * 2 - 1, cupY = cup * s * s * w, q = p.clone().addScaledVector(dir, L * t).addScaledVector(side, s * w).addScaledVector(nrm, cupY - drop * L);
      const c = mix(cb, ct, t).multiplyScalar(1 - 0.12 * Math.abs(s) + (Math.abs(s) < 0.2 ? 0.08 : 0)); row.push(M.v(q.x, q.y, q.z, c)); } rows.push(row); }
  for (let i = 0; i < n; i++) for (let j = 0; j < m - 1; j++) { const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j], d = rows[i + 1][j + 1]; M.t(a, c, b); M.t(b, c, d); }
}
// a stem: a tapered tube through points (k sides)
function stem(M, pts, r0, r1, c0, c1, k) {
  const rings = []; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], d = q.clone().sub(o).normalize(), a = Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), u = new THREE.Vector3().crossVectors(d, a).normalize(), w = new THREE.Vector3().crossVectors(d, u), t = i / (pts.length - 1), r = r0 + (r1 - r0) * t, c = mix(c0, c1, t), ring = [];
    for (let j = 0; j < k; j++) { const an = j / k * 2 * PI, x = p.clone().addScaledVector(u, Math.cos(an) * r).addScaledVector(w, Math.sin(an) * r); ring.push(M.v(x.x, x.y, x.z, c)); } rings.push(ring); }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < k; j++) { const a = rings[i][j], b = rings[i][(j + 1) % k], c = rings[i + 1][j], d = rings[i + 1][(j + 1) % k]; M.t(a, b, c); M.t(b, d, c); }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z), dirOf = (az, el) => V(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
const OVAL = (t) => Math.sin(PI * Math.min(1, t * 1.02)) ** 0.8, LANCE = (t) => Math.sin(PI * t) ** 1.3 * (1 - 0.35 * t), BROAD = (t) => Math.sin(PI * Math.min(1, 0.15 + t * 0.85)) ** 0.6 * (t < 0.12 ? t / 0.12 : 1), POINT = (t) => Math.sin(PI * t) ** 1.1 * (1 - 0.5 * t);
// the five kinds, about 0.3-0.6 m tall at scale 1; base on y = 0
const BUILD = {
  herb(M, r, hi) { const g0 = col(0x2f5a22), g1 = col(0x6fa840), sc = col(0x4a7a30), n = hi ? 7 : 4;
    for (let s = 0; s < n; s++) { const az = s / n * 2 * PI + r(), lean = 0.15 + 0.2 * r(), h = 0.26 + 0.14 * r(), pts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push(V(Math.sin(az) * lean * h * t * t, h * t, Math.cos(az) * lean * h * t * t)); }
      stem(M, pts, 0.006, 0.003, sc, g1, 4); for (let i = 1; i <= 4; i++) { const t = i / 4.4, p = V(Math.sin(az) * lean * h * t * t, h * t, Math.cos(az) * lean * h * t * t), L = 0.07 * (1.15 - t * 0.5);
        for (const sd of [0, PI]) leaf(M, p, dirOf(az + PI / 2 + sd + i * 0.9, 0.35 - 0.2 * t), 0.2, L, L * 0.38, OVAL, 0.12, 0.25, g0.clone().lerp(g1, t * 0.6), g1, hi ? 4 : 2, 3); } } },
  leafy(M, r, hi) { const out = col(0x3f7a2a), inn = col(0xb8dc78), n = hi ? 16 : 8;
    for (let k = 0; k < n; k++) { const t = k / n, az = k * 2.4 + r() * 0.3, el = 0.25 + t * 1.0, L = 0.2 * (1.05 - 0.55 * t), W = L * 0.55, p = V(Math.sin(az) * 0.02 * (1 - t), 0.015 + 0.04 * t, Math.cos(az) * 0.02 * (1 - t));
      leaf(M, p, dirOf(az, el), 0, L, W, BROAD, 0.25 * (1 - t), 0.45 + 0.3 * t, mix(out, inn, t * 0.8).multiplyScalar(0.85), mix(out, inn, 0.3 + t * 0.7), hi ? 6 : 3, hi ? 5 : 3); } },
  shrub(M, r, hi) { const bark = col(0x5a4630), g0 = col(0x2a5020), g1 = col(0x5a9038), fl = [col(0xf0a0c0), col(0xffffff), col(0xc8a0f0)], petal = fl[Math.floor(r() * 3)], n = hi ? 6 : 3;
    for (let s = 0; s < n; s++) { const az = s / n * 2 * PI + r() * 0.5, h = 0.4 + 0.2 * r(), lean = 0.35 + 0.25 * r(), pts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push(V(Math.sin(az) * lean * h * t, h * t, Math.cos(az) * lean * h * t)); }
      stem(M, pts, 0.012, 0.004, bark, bark, 4); const tip = pts[4];
      for (let i = 0; i < (hi ? 12 : 5); i++) { const t = 0.3 + 0.7 * (i / (hi ? 12 : 5)), p = pts[0].clone().lerp(tip, t).add(V((r() - 0.5) * 0.06, (r() - 0.5) * 0.04, (r() - 0.5) * 0.06)); leaf(M, p, dirOf(r() * 2 * PI, 0.2 + r() * 0.5), r(), 0.06, 0.022, POINT, 0.1, 0.2, g0, g1, hi ? 3 : 2, 3); }
      for (let f = 0; f < (hi ? 4 : 2); f++) { const c = tip.clone().add(V((r() - 0.5) * 0.1, 0.01 + r() * 0.05, (r() - 0.5) * 0.1)); for (let pp = 0; pp < 5; pp++) leaf(M, c, dirOf(pp / 5 * 2 * PI + f, 0.5), 0, 0.022, 0.012, OVAL, 0, 0.3, petal.clone().multiplyScalar(0.9), petal, 2, 3); M.t(M.v(c.x, c.y + 0.006, c.z, col(0xf0c030)), M.v(c.x + 0.006, c.y + 0.006, c.z, col(0xf0c030)), M.v(c.x, c.y + 0.006, c.z + 0.006, col(0xf0c030))); } } },
  fern(M, r, hi) { const g0 = col(0x2a5a20), g1 = col(0x7ab848), rib = col(0x4a6a28), n = hi ? 9 : 5;
    for (let f = 0; f < n; f++) { const az = f / n * 2 * PI + r() * 0.4, L = 0.45 + 0.2 * r(), el = 1.2 - 0.3 * r(), seg = hi ? 8 : 4, pts = []; for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push(V(Math.sin(az) * L * t * (0.35 + 0.4 * t), L * Math.sin(el) * t - L * 0.5 * t * t, Math.cos(az) * L * t * (0.35 + 0.4 * t))); }
      stem(M, pts, 0.005, 0.002, rib, rib, 3); for (let i = 1; i < seg; i++) { const p = pts[i], d = pts[i + 1].clone().sub(pts[i]).normalize(), side = new THREE.Vector3().crossVectors(d, V(0, 1, 0)).normalize(), ln = 0.09 * Math.sin(PI * (i / seg) * 0.95 + 0.15);
        for (const sd of [-1, 1]) leaf(M, p, side.clone().multiplyScalar(sd).addScaledVector(d, 0.45).normalize(), 0, ln, ln * 0.28, LANCE, 0.15, 0.15, g0, g1, hi ? 3 : 2, 3); } } },
  // a garden bush about 1.3 m across and 1 m tall: several overlapping lobes of small leaves (no ball outline), darker deep inside and underneath, woody stems showing at the foot
  bush(M, r, hi) { const deep = col(0x183a16), mid = col(0x3a6e28), lit = col(0x7aae48), bark = col(0x4a3a28), lobes = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * 2 * PI + r() * 0.6, d = k === 0 ? 0 : 0.28 + 0.2 * r(); lobes.push([V(Math.sin(a) * d, 0.42 + 0.32 * r() + (k === 0 ? 0.25 : 0), Math.cos(a) * d * 0.85), 0.26 + 0.14 * r()]); }
    for (const [c] of lobes) stem(M, [V(c.x * 0.15, 0, c.z * 0.15), V(c.x * 0.55, c.y * 0.45, c.z * 0.55), c.clone().multiplyScalar(0.9)], 0.022, 0.01, bark, bark, 4);
    const n = hi ? 320 : 120; for (let i = 0; i < n; i++) { const [c, rad] = lobes[i % lobes.length], u = r() * 2 * PI, v = Math.acos(1 - 2 * Math.min(0.92, r())), nrm = V(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)), p = c.clone().addScaledVector(nrm, rad * (0.7 + 0.35 * r()));
      if (p.y < 0.08) continue; const out = Math.min(1, p.length() / 0.85), shade = Math.max(0, Math.min(1, 0.25 + 0.5 * out + 0.3 * nrm.y)), cb = mix(deep, mid, shade), ct = mix(mid, lit, shade), dir = nrm.clone().add(V((r() - 0.5) * 0.8, 0.35, (r() - 0.5) * 0.8)).normalize();
      leaf(M, p, dir, r() * PI, 0.085 + 0.04 * r(), 0.04, OVAL, 0.15, 0.25, cb, ct, hi ? 3 : 2, 3); } },
  flower(M, r, hi) { const g0 = col(0x2f6a28), g1 = col(0x6aa848), heads = [col(0xffe070), col(0xf08a50), col(0xffffff), col(0xe070a0)], hc = heads[Math.floor(r() * 4)], n = hi ? 9 : 5;
    for (let k = 0; k < n; k++) { const az = k * 2.4, el = 0.35 + 0.4 * r(); leaf(M, V(0, 0.01, 0), dirOf(az, el), 0, 0.13, 0.035, LANCE, 0.3, 0.3, g0, g1, hi ? 4 : 2, 3); }
    for (let s = 0; s < (hi ? 3 : 2); s++) { const az = s * 2.1 + r(), h = 0.3 + 0.15 * r(), top = V(Math.sin(az) * 0.05, h, Math.cos(az) * 0.05); stem(M, [V(0, 0, 0), V(top.x * 0.5, h * 0.5, top.z * 0.5), top], 0.004, 0.003, g0, g1, 3);
      for (let pp = 0; pp < (hi ? 12 : 7); pp++) leaf(M, top, dirOf(pp / (hi ? 12 : 7) * 2 * PI, 0.15), 0, 0.04, 0.011, OVAL, 0.05, 0.1, hc.clone().multiplyScalar(0.9), hc, 2, 3);
      const cc = col(0x8a5a1a); M.t(M.v(top.x - 0.008, top.y + 0.004, top.z, cc), M.v(top.x + 0.008, top.y + 0.004, top.z, cc), M.v(top.x, top.y + 0.004, top.z + 0.01, cc)); } },
};
const GEO = {};
// one geometry per kind and tier
export function plantGeo(kind, hi) { const key = kind + (hi ? 'h' : 'l'); if (GEO[key]) return GEO[key]; const M = Mesh(); BUILD[kind](M, rng(31 + kind.length * 7), hi);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(M.P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(M.C, 3)); g.setIndex(M.I); g.computeVertexNormals(); g.userData.keep = true; return (GEO[key] = g); }
let MAT = null;
const plantMat = () => { if (MAT) return MAT; MAT = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.72, envMapIntensity: 0.5 }); MAT.userData.pbr = true; MAT.userData.shared = true; return MAT; };
// the base build's shared kit while plants are rolled out (src/basevillage.js startPlants sets it; src/basehi.js puts the density pass's window-box and urn plants into it)
export const LIFE_PLANTS = { kit: null };
// a kit that collects placements and makes one instanced mesh per kind: add(kind, x, y, z, size, turn, tint 0xRRGGBB or null, tilt)
export function plantKit(hi, seed) {
  const r = rng(seed || 5), list = {};
  const later = [];
  return { add(kind, x, y, z, s, ry, tint, tilt) { (list[kind] || (list[kind] = [])).push([x, y, z, s, ry === undefined ? r() * 2 * PI : ry, tint, tilt || 0]); },
    // a plant at a point in another group's own frame (placed in the base's frame when the kit is built, once that group has its place)
    addIn(parent, kind, v, s) { later.push([parent, kind, v.clone(), s]); },
    count: () => Object.values(list).reduce((a, l) => a + l.length, 0) + later.length,
    build(parent) { let draws = 0, tris = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      for (const [g, kind, v, sz] of later) { g.updateMatrixWorld(true); const w = v.applyMatrix4(g.matrixWorld); this.add(kind, w.x, w.y, w.z, sz); } later.length = 0;
      for (const [kind, L] of Object.entries(list)) { const geo = plantGeo(kind, hi), im = new THREE.InstancedMesh(geo, plantMat(), L.length), cl = new Float32Array(L.length * 3);
        L.forEach(([x, y, z, s, ry, tint, tilt], i) => { e.set((r() - 0.5) * 0.12 + tilt, ry, (r() - 0.5) * 0.12, 'YXZ'); q.setFromEuler(e); const sy = s * (0.85 + 0.3 * r()); m4.compose(V(x, y, z), q, V(s, sy, s)); im.setMatrixAt(i, m4);
          c.set(tint === null || tint === undefined ? 0xffffff : tint).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.12, (r() - 0.5) * 0.1); cl[3 * i] = c.r; cl[3 * i + 1] = c.g; cl[3 * i + 2] = c.b; });
        im.instanceColor = new THREE.InstancedBufferAttribute(cl, 3); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); im.userData.life = true; im.userData.noAO = true; parent.add(im); draws++; tris += (geo.index.count / 3) * L.length; }
      return { draws, tris: Math.round(tris) }; } };
}
