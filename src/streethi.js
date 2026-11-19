// The street and its plants, MASTER build (2026-11-16; owner: desktop priority, "the desktop version gets its own assets"). Used on the high tier (src/world.js HISTREET);
// phones, and ?fx=0, keep the street of src/world.js until a tested low setting exists (CONFIG.quality.low.street is null). Nothing here is read by the game: it is all looks.
// What is modelled: kerb stones with real height (some sunk, tilted or gone), a slab footway on both sides (cracked, lifted and missing slabs, weeds in the gaps, pits round trees),
// drain grates with frames and bars in the gutter, a broken road edge with loose asphalt lumps, fissures and potholes with a rim, a worn centre line, grass tufts made of single
// curved blades (instead of crossed picture cards), tree and bush crowns with thousands of single leaves round the painted sprays, dead leaves drifted along the kerbs,
// a utility pole fallen across the verge with its crossarm, insulators and sagging wires, a standing pole the wires still hang from, and litter as small objects
// (cans, bottles, paper, bags, a tyre, bricks). The approved desolate look (overgrown, broken) is built in when DESO.machines is on (the default). Numbers: CONFIG.quality.high.street.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SCENERY, streetSceneryIter } from './scenehi.js';

function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }
const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z), YAX = V(0, 1, 0);

// a grass tuft of n curved blades from one root (base at y 0, about 1 tall and 1.3 wide like the phone's card), coloured dark at the root to straw at the tip
export function tuftGeo(n, seed) {
  const r = rng(seed || 77), pos = [], col = [], idx = [], base = new THREE.Color(0x3d4a22), mid = new THREE.Color(0x6f7d3a), tip = new THREE.Color(0xb7b06a);
  for (let b = 0; b < n; b++) { const a = r() * 2 * PI, lean = 0.15 + 0.5 * r(), h = 0.45 + 0.55 * r(), w = 0.02 + 0.02 * r(), ox = (r() - 0.5) * 0.25, oz = (r() - 0.5) * 0.25, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, v0 = pos.length / 3;
    for (let k = 0; k <= 3; k++) { const t = k / 3, bend = lean * t * t, x = ox + dx * bend * 0.65, z = oz + dz * bend * 0.65, y = h * t * (1 - 0.25 * lean * t), ww = w * (1 - t) + 0.002, c = t < 0.5 ? base.clone().lerp(mid, t * 2) : mid.clone().lerp(tip, (t - 0.5) * 2);
      if (k < 3) { pos.push(x - px * ww, y, z - pz * ww, x + px * ww, y, z + pz * ww); col.push(c.r, c.g, c.b, c.r, c.g, c.b); } else { pos.push(x, y, z); col.push(c.r, c.g, c.b); } }
    for (let k = 0; k < 2; k++) { const i = v0 + 2 * k; idx.push(i, i + 1, i + 3, i, i + 3, i + 2); } idx.push(v0 + 4, v0 + 5, v0 + 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const N = g.attributes.normal; for (let i = 0; i < N.count; i++) { const y = N.getY(i); N.setXYZ(i, N.getX(i) * 0.5, Math.abs(y) * 0.5 + 0.6, N.getZ(i) * 0.5); } N.needsUpdate = true; // soft, sky-facing normals so thin blades do not flash dark or white as they turn
  return g;
}
export function tuftMat() { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }); m.userData.pbr = true; return m; }
// a broad leaf: stalk at the origin, tip at (0, 0, 1), a little cupped (4 triangles)
function leafGeo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.42, 0.04, 0.45, 0, 0, 1, 0.42, 0.04, 0.45, 0, 0.08, 0.45], 3)); g.setIndex([4, 1, 0, 4, 2, 1, 4, 3, 2, 4, 0, 3]); g.computeVertexNormals(); return g; }

// one builder per built world: collects tree and bush sprays and tree trunks while world.js builds, then makes everything at finish()
export function streetHi(o) {
  const { g, cfg, run, M, tx, deso } = o, SQ = CONFIG.quality.high.street, D = SQ.detail, T = cfg.town, r = rng(run.seed * 13 + 3571), sprays = [], trees = [];
  const std = (p) => { const m = new THREE.MeshStandardMaterial(p); m.userData.pbr = true; return m; };
  const K = { stone: std({ map: tx('block'), color: 0xbab4a8, roughness: 0.95 }), slab: std({ map: tx('block'), roughness: 0.95 }), iron: std({ map: tx('rust'), color: 0x4a4642, roughness: 0.6, metalness: 0.65 }), asphalt: std({ map: tx('asphalt'), roughness: 0.9 }),
    dark: std({ map: tx('asphalt'), color: 0x3c3c3a, roughness: 0.15, envMapIntensity: 1.2 }), crack: std({ color: 0x24221f, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), paint: std({ color: 0xd8d4c4, roughness: 0.8, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }),
    leaf: std({ roughness: 1, envMapIntensity: 0.35, side: THREE.DoubleSide }), wood: std({ map: tx('bark'), color: 0x7a6a58, roughness: 0.9 }), cer: std({ color: 0xd8d4c8, roughness: 0.25 }), wire: std({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 }), small: std({ roughness: 0.6, metalness: 0.2 }), rubber: std({ color: 0x141414, roughness: 0.9 }) };
  const inst = new Map(), put = (kind, m4, col) => { let c = inst.get(kind); if (!c) inst.set(kind, c = { m: [], c: [] }); c.m.push(...m4.elements); c.c.push(col.r, col.g, col.b); };
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), eu = new THREE.Euler(), col = new THREE.Color();
  const place = (kind, x, y, z, rx, ry, rz, sx, sy, sz, c) => { eu.set(rx, ry, rz); q4.setFromEuler(eu); m4.compose(V(x, y, z), q4, V(sx, sy, sz)); put(kind, m4, c); };
  const free = (x, z, pad) => !run.houses.some((h) => Math.abs(x - h.x) < h.H + pad && Math.abs(z - h.z) < h.H + pad);
  const nearTree = (x, z, d) => trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < d);
  const onPath = (x, z) => run.houses.some((h) => Math.abs(x - h.doorX) < 1.0 && Math.sign(z) === Math.sign(h.doorZ) && Math.abs(z) < Math.abs(h.doorZ) + 0.5);
  const X0 = T.boundX + 10, RZ = 3.5, [kl, kh, kd] = SQ.kerb, [sl, st] = SQ.slab, FW = SQ.footway;

  function street() {
    // kerbs: a stone every kl metres along both road edges, top kh above the road; desolate: some sunk, tilted, knocked out
    for (const sd of [-1, 1]) for (let x = -X0; x < X0; x += kl + 0.008) { if (deso && r() < 0.03) { if (r() < 0.5) place('stone', x + kl / 2, 0.06, sd * (RZ + 0.5 + r()), (r() - 0.5) * 0.4, r() * 3, PI / 2 * (r() < 0.5 ? 1 : 0), 1, 1, 1, col.setHex(0xb0aa9e)); continue; }
      const sink = deso && r() < 0.12 ? 0.03 + 0.06 * r() : 0, tilt = deso && r() < 0.1 ? (r() - 0.5) * 0.25 : 0; place('stone', x + kl / 2, kh / 2 - 0.0 - sink, sd * (RZ + kd / 2), tilt * sd, (r() - 0.5) * 0.02, 0, 1, 1, 1, col.setHex(0xc4beb2).multiplyScalar(0.85 + 0.2 * r())); }
    // footway slabs behind the kerb, rows of sl x sl; a path from a door breaks through them; pits round trees; desolate: lifted, cracked in two, missing (weeds come through)
    for (const sd of [-1, 1]) for (let row = 0; row < Math.round(FW / sl); row++) for (let x = -X0 + (row % 2) * sl / 2; x < X0; x += sl + 0.012) { const z = sd * (RZ + kd + 0.006 + (row + 0.5) * (sl + 0.012));
      if (nearTree(x, z, 0.9) || !free(x, z, 0.3)) continue; if (deso && r() < 0.06) { tufts.push([x, z, 0.4 + 0.5 * r()]); continue; }
      const lift = deso && r() < 0.1, y = kh - 0.03 - st / 2, c = col.setHex(0xb4ada2).multiplyScalar(0.8 + 0.25 * r()); if (deso && r() < 0.1) c.lerp(new THREE.Color(0x56603a), 0.35);
      if (deso && r() < 0.08) { for (const hx of [-1, 1]) place('slab', x + hx * sl / 4, y + (hx > 0 ? 0.02 : 0), z, (r() - 0.5) * 0.08, (r() - 0.5) * 0.06, hx * 0.04, 0.48, 1, 1, c); continue; }
      place('slab', x, y + (lift ? 0.03 : 0), z, lift ? (r() - 0.5) * 0.14 : (r() - 0.5) * 0.01, (r() - 0.5) * 0.015, lift ? (r() - 0.5) * 0.14 : 0, 1, 1, 1, c); }
    // a soil strip under the slabs (so a missing slab shows earth, not grass at road level)
    for (const sd of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(2 * X0, kh - 0.05, FW + 0.1), M.dirt); m.position.set(0, (kh - 0.05) / 2, sd * (RZ + kd + FW / 2)); g.add(m); }
    // drains in the gutter: a frame and bars over a dark well, every `drain` metres, alternating sides
    for (let x = -X0 + 6, k = 0; x < X0 - 2; x += SQ.drain, k++) { const sd = k % 2 ? 1 : -1, z = sd * (RZ - 0.24), gd = new THREE.Group(); gd.position.set(x, 0.03, z); g.add(gd);
      const bx = (w, h, d, m, px, py, pz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); gd.add(b); };
      bx(0.6, 0.004, 0.38, K.dark, 0, 0.004, 0); for (const s2 of [-1, 1]) { bx(0.66, 0.025, 0.035, K.iron, 0, 0.012, s2 * 0.2); bx(0.035, 0.025, 0.4, K.iron, s2 * 0.315, 0.012, 0); }
      for (let b = 0; b < 9; b++) bx(0.022, 0.02, 0.37, K.iron, -0.26 + b * 0.065, 0.014, 0); if (deso) for (let q = 0; q < 6; q++) place('dead', x + (r() - 0.5) * 0.8, 0.045, z + (r() - 0.5) * 0.5, -PI / 2 + (r() - 0.5) * 0.4, r() * 6, 0, 0.07, 0.07, 0.07, col.setHSL(0.08 + 0.04 * r(), 0.5, 0.22 + 0.12 * r(), THREE.SRGBColorSpace)); }
    // the road: fissures (dark), lumps of broken asphalt at the edge, potholes with a raised rim, a worn centre line
    { const pos = [], crack = (x, z, a, len, w0) => { let px = x, pz = z; const n = Math.max(3, Math.round(len / 0.18)); for (let k = 0; k < n; k++) { a += (r() - 0.5) * 0.8; const nx = px + Math.cos(a) * 0.18, nz = pz + Math.sin(a) * 0.18; if (Math.abs(nz) > RZ - 0.05) break; const w = w0 * (1 - k / n) + 0.002, ox = -Math.sin(a) * w, oz = Math.cos(a) * w, y = 0.033;
          pos.push(px - ox, y, pz - oz, nx + ox, y, nz + oz, px + ox, y, pz + oz, px - ox, y, pz - oz, nx - ox, y, nz - oz, nx + ox, y, nz + oz); if (k === Math.floor(n / 2) && r() < 0.5) crack(nx, nz, a + (r() < 0.5 ? 1 : -1), len * 0.4, w * 0.7); if (r() < 0.25) tufts.push([nx, nz, 0.25 + 0.3 * r()]); px = nx; pz = nz; } };
      for (let k = 0; k < SQ.cracks * (deso ? 1 : 0.4); k++) crack((r() * 2 - 1) * X0, (r() * 2 - 1) * (RZ - 0.5), r() * 6.28, 1.5 + 4 * r(), 0.012 + 0.012 * r());
      for (let k = 0; k < SQ.cracks * 0.3; k++) { const sd = r() < 0.5 ? -1 : 1; crack((r() * 2 - 1) * X0, sd * (RZ - 0.3), sd > 0 ? -PI / 2 + (r() - 0.5) : PI / 2 + (r() - 0.5), 1 + 2 * r(), 0.015); }
      if (pos.length) { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.computeVertexNormals(); g.add(new THREE.Mesh(ge, K.crack)); } }
    for (let k = 0; k < SQ.potholes * (deso ? 1 : 0.3); k++) { const x = (r() * 2 - 1) * (X0 - 4), z = (r() * 2 - 1) * (RZ - 1), rx = 0.3 + 0.5 * r(), rz = 0.25 + 0.35 * r(), pts = []; for (let j = 0; j < 14; j++) { const a = j / 14 * 2 * PI, qq = 0.75 + 0.25 * r(); pts.push(new THREE.Vector2(Math.cos(a) * rx * qq, Math.sin(a) * rz * qq)); }
      const hole = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), K.dark); hole.rotation.x = -PI / 2; hole.position.set(x, 0.034, z); g.add(hole);
      const rim = new THREE.Shape(pts.map((p) => p.clone().multiplyScalar(1.18))); rim.holes.push(new THREE.Path(pts.slice().reverse())); const rg = new THREE.ExtrudeGeometry(rim, { depth: 0.025, bevelEnabled: false }); const uv = rg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
      const rm = new THREE.Mesh(rg, K.asphalt); rm.rotation.x = -PI / 2; rm.position.set(x, 0.03, z); g.add(rm); for (let q = 0; q < 4; q++) place('lump', x + (r() - 0.5) * rx * 3, 0.04, z + (r() - 0.5) * rz * 3, r() * 3, r() * 3, r() * 3, 0.05 + 0.06 * r(), 0.025, 0.05 + 0.05 * r(), col.setHex(0xb4b2ac)); }
    for (const sd of [-1, 1]) for (let k = 0; k < SQ.lumps; k++) { const x = (r() * 2 - 1) * X0; if (r() < 0.6) place('lump', x, 0.045, sd * (RZ - 0.1 - 0.4 * r()), (r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5, 0.08 + 0.12 * r(), 0.03, 0.06 + 0.1 * r(), col.setHex(0xb8b6b0).multiplyScalar(0.8 + 0.3 * r())); }
    for (let x = -X0 + 1; x < X0 - 2; x += 4.5) { if (deso && r() < 0.35) continue; const len = 2.4 * (deso ? 0.4 + 0.6 * r() : 1), p = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.12), K.paint); p.rotation.x = -PI / 2; p.position.set(x + len / 2, 0.034, (r() - 0.5) * 0.02); g.add(p); }
    // dead leaves drifted against the kerbs, and litter along the edges and verges
    for (let k = 0; k < SQ.deadLeaves * (deso ? 1 : 0.3); k++) { const sd = r() < 0.5 ? -1 : 1, x = (r() * 2 - 1) * X0, z = sd * (RZ - 0.06 - Math.pow(r(), 2) * 0.9); place('dead', x, 0.036 + 0.01 * r(), z, -PI / 2 + (r() - 0.5) * 0.6, r() * 6.28, (r() - 0.5) * 0.4, 0.06 + 0.05 * r(), 0.06 + 0.05 * r(), 0.06 + 0.05 * r(), col.setHSL(0.06 + 0.06 * r(), 0.45 + 0.2 * r(), 0.18 + 0.16 * r(), THREE.SRGBColorSpace)); }
    if (D.litter) for (let k = 0; k < SQ.litter * (deso ? 1 : 0.4); k++) { const sd = r() < 0.5 ? -1 : 1, x = (r() * 2 - 1) * X0, z = sd * (RZ - 0.4 + r() * 3.5), y0 = Math.abs(z) > RZ + kd ? kh - 0.03 : 0.03; if (!free(x, z, 0.2)) continue; const kind = Math.floor(r() * 6);
      if (kind === 0) place('can', x, y0 + 0.033, z, PI / 2, r() * 6, (r() - 0.5) * 0.3, 1, r() < 0.4 ? 0.6 : 1, 1, col.setHSL(r(), 0.5, 0.35 + 0.2 * r(), THREE.SRGBColorSpace));
      else if (kind === 1) place('bottle', x, y0 + 0.035, z, PI / 2, r() * 6, 0, 1, 1, 1, col.setHSL(0.3 + 0.1 * r(), 0.4, 0.25 + 0.2 * r(), THREE.SRGBColorSpace));
      else if (kind === 2) place('paper', x, y0 + 0.03, z, r() * 3, r() * 3, r() * 3, 0.05 + 0.04 * r(), 0.035, 0.05 + 0.04 * r(), col.setHex(0xd8d2c0).multiplyScalar(0.7 + 0.3 * r()));
      else if (kind === 3) place('paper', x, y0 + 0.02, z, 0, r() * 3, 0, 0.14 + 0.1 * r(), 0.03, 0.12 + 0.08 * r(), col.setHSL(r(), 0.2, 0.55 + 0.2 * r(), THREE.SRGBColorSpace));
      else if (kind === 4) place('brick', x, y0 + 0.035, z, (r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3, 1, 1, 1, col.setHex(0x9a5a44).multiplyScalar(0.8 + 0.3 * r()));
      else if (r() < 0.25) place('tyre', x, y0 + 0.1, z, PI / 2 + (r() - 0.5) * 0.3, 0, r() * 6, 1, 1, 1, col.setHex(0xffffff)); }
    // meadow: long grass on the verges and lawns, and weeds where slabs are gone and down the cracks (all as blade tufts)
    // (desktop scenery, src/scenehi.js: its own meadow of grass and wildflower clumps takes the place of these tufts)
    if (!SCENERY) for (let k = 0; k < SQ.meadow * (deso ? 1 : 0.35); k++) { const x = (r() * 2 - 1) * (X0 + 4), sd = r() < 0.5 ? -1 : 1, z = sd * (RZ + kd + FW + 0.3 + Math.pow(r(), 1.5) * (T.boundZ + 8)); if (!free(x, z, 0.35) || onPath(x, z)) continue; tufts.push([x, z, 0.6 + 0.9 * r()]); }
    if (D.pole && deso) pole();
  }
  const tufts = [];
  // a utility pole fallen across the verge (crossarm, insulators), the wires still hanging to a standing pole down the street
  function pole() { const h = run.houses[0] || { doorX: 0, z: 15 }, side = Math.sign(h.z) || 1, len = 8.5, dir = V(Math.cos(0.3), 0, Math.sin(0.3) * side).normalize(), PZ = side * 5.6, clear = (x) => (run.cars || []).every((c) => { for (let t = 0; t <= 1; t += 0.1) if (Math.hypot(c.x - (x + dir.x * len * t), c.z - (PZ + dir.z * len * t)) < 3.2) return false; return true; });
    let x0 = h.doorX + CONFIG.desolate.over.poleAt; for (const dx of [0, -6, 6, -12, 12, -18, 18, -24]) if (clear(h.doorX + CONFIG.desolate.over.poleAt + dx)) { x0 = h.doorX + CONFIG.desolate.over.poleAt + dx; break; } // lie clear of every car
    const base = V(x0, 0, PZ);
    const pg = new THREE.Group(); g.add(pg); const rod = (p, q, rad, m, sg) => { const d = q.clone().sub(p), l = d.length(), b = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.2, l, sg || 10), m); b.position.copy(p).addScaledVector(d, 0.5); b.quaternion.setFromUnitVectors(YAX, d.normalize()); pg.add(b); return b; };
    const fallTop = base.clone().addScaledVector(dir, len).setY(0.75), stump = base.clone().setY(0.55); rod(base, stump, 0.15, K.wood, 12); rod(stump.clone().add(V(0.05, 0.05, 0)), fallTop, 0.12, K.wood, 12);
    const up = V(0, 1, 0), along = fallTop.clone().sub(stump).normalize(), across = new THREE.Vector3().crossVectors(along, up).normalize(), arm = fallTop.clone().addScaledVector(along, -0.5).add(V(0, 0.12, 0));
    rod(arm.clone().addScaledVector(across, -0.9), arm.clone().addScaledVector(across, 0.9), 0.05, K.wood, 6); const ins = [];
    for (const s of [-0.75, -0.25, 0.25, 0.75]) { const p = arm.clone().addScaledVector(across, s); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.12, 10), K.cer); c.position.copy(p).add(V(0, 0.09, 0)); pg.add(c); ins.push(c.position.clone().add(V(0, 0.05, 0))); }
    const stand = base.clone().addScaledVector(V(1, 0, 0), -22).setZ(side * 4.3), sh = 7.5; rod(stand, stand.clone().setY(sh), 0.13, K.wood, 12); const arm2 = stand.clone().setY(sh - 0.4); rod(arm2.clone().add(V(0, 0, -0.9)), arm2.clone().add(V(0, 0, 0.9)), 0.05, K.wood, 6);
    ins.forEach((p, i) => { const a = arm2.clone().add(V(0, 0.12, -0.75 + i * 0.5)), mid = a.clone().lerp(p, 0.5); mid.y = Math.min(a.y, p.y) - 1.2 - 0.5 * r(); if (i === 3) { mid.y = 0.05; mid.x += 1.5; } const cv = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).add(V(0, -0.6, 0)), mid, p]); pg.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 40, 0.009, 4, false), K.wire)); });
    const loose = new THREE.CatmullRomCurve3([fallTop.clone(), fallTop.clone().add(V(1.2, -0.6, side * 0.6)), fallTop.clone().add(V(2.6, -0.73, side * 1.4)), fallTop.clone().add(V(4.5, -0.73, side * 1.1))]); pg.add(new THREE.Mesh(new THREE.TubeGeometry(loose, 40, 0.009, 4, false), K.wire)); }

  // world.js: a tree or bush leaf spray (tree group p, local centre, size), and a trunk on the ground
  const spray = (p, x, y, z, s) => { if (D.leaves) sprays.push([p, x, y, z, s]); };
  const tree = (x, z) => trees.push([x, z]);

  // (LAG FIX Nov 19, owner 13:10) finishIter stops between its parts so the film builds the street in time slices; finish runs it at once
  function finish() { const it = finishIter(); while (!it.next().done); }
  function* finishIter() {
    if (D.street) street();
    yield;
    g.updateMatrixWorld(true); const v = new THREE.Vector3(), lc = new THREE.Color(), LEAFC = new THREE.Color(0x4a6630), WHITE = new THREE.Color(1, 1, 1), tint = (p) => { for (let q = p; q; q = q.parent) { if (q.userData.tint) return q.userData.tint; if (q.userData.tintM) { const t = Object.values(q.userData.tintM)[0]; if (t) return t; } } return WHITE; };
    // (desktop scenery: the sprays become leaf clusters in src/scenehi.js instead of single leaves; the crack weeds become its grass and flower clumps)
    for (const [p, x, y, z, s] of SCENERY ? [] : sprays) { const tc = tint(p), n = Math.round(SQ.leaves * Math.min(1.6, s / 1.8)); for (let k = 0; k < n; k++) { const u = r() * 2 * PI, w = Math.acos(2 * r() - 1), rad = s * (0.28 + 0.24 * Math.cbrt(r()));
        v.set(x + Math.sin(w) * Math.cos(u) * rad, y + Math.cos(w) * rad * 0.7, z + Math.sin(w) * Math.sin(u) * rad).applyMatrix4(p.matrixWorld); const sz = SQ.leafSize * (0.7 + 0.6 * r());
        eu.set(-0.6 + (r() - 0.5) * 1.6, r() * 6.28, (r() - 0.5) * 1.2, 'YXZ'); q4.setFromEuler(eu); m4.compose(v, q4, V(sz, sz, sz)); lc.copy(tc).multiply(LEAFC).multiplyScalar(0.7 + 0.5 * r()).offsetHSL((r() - 0.5) * 0.04, 0, 0, THREE.SRGBColorSpace); if (r() < 0.05) lc.setHSL(0.1 + 0.05 * r(), 0.45, 0.3, THREE.SRGBColorSpace); put('leaf', m4, lc); } }
    for (const [x, z, s] of SCENERY ? [] : tufts) place('tuft', x, 0.0, z, 0, r() * 6.28, 0, s * 1.3, s, s * 1.3, col.setHSL(0.18 + 0.08 * r(), 0.25 + 0.2 * r(), 0.72 + 0.16 * r(), THREE.SRGBColorSpace));
    const [kl2, kh2, kd2] = SQ.kerb, G = { stone: new THREE.BoxGeometry(kl2, kh2 + 0.12, kd2), slab: new THREE.BoxGeometry(sl, st, sl), lump: new THREE.DodecahedronGeometry(1, 0), leaf: leafGeo(), dead: leafGeo(), can: new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), bottle: new THREE.CylinderGeometry(0.035, 0.035, 0.26, 10).translate(0, 0, 0), paper: new THREE.IcosahedronGeometry(1, 0), brick: new THREE.BoxGeometry(0.215, 0.065, 0.1), tyre: new THREE.TorusGeometry(0.26, 0.1, 8, 18), tuft: tuftGeo(12, 91) };
    G.stone.translate(0, -0.06, 0); for (const k of ['stone', 'slab']) { const uv = G[k].attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.4, uv.getY(i) * 0.4); }
    const MAT = { stone: K.stone, slab: K.slab, lump: K.asphalt, leaf: K.leaf, dead: K.leaf, can: K.small, bottle: K.small, paper: K.leaf, brick: K.slab, tyre: K.rubber, tuft: tuftMat() };
    let tris = 0; for (const [kind, c] of inst) { const n = c.c.length / 3, im = new THREE.InstancedMesh(G[kind], MAT[kind], n); im.instanceMatrix.array.set(c.m); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.c), 3); im.castShadow = kind !== 'dead' && kind !== 'tuft'; im.receiveShadow = true; im.userData.hiInst = kind; im.computeBoundingSphere(); g.add(im); const ge = G[kind]; tris += n * (ge.index ? ge.index.count : ge.attributes.position.count) / 3; }
    g.userData.streetTris = Math.round(tris);
    yield;
    if (SCENERY) yield* streetSceneryIter({ g, run, cfg, M, sprays, free, onPath, X0, RZ, inner: RZ + kd + FW, tufts });
  }
  return { spray, tree, finish, finishIter };
}
