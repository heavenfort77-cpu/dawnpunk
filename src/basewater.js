// BASE WATER (owner Nov 17 16:01: "add in waterwheel in solarpunk style in the base"): the stream, the waterwheel, its race and generator, the footbridges and the flumes to the garden.
// Layout and walking rules are in src/baselife.js; every number is in CONFIG.baseWater (high = desktop, low = phones).
// The stream comes in through a gap in the north hedge, runs down a stone-and-timber race under a big wooden undershot wheel (curved paddles, iron straps, copper fittings, a vine
// on its frame), past the bloom-tech generator housing (copper coils behind a round window, a small glowing gauge, a belt from the wheel's axle, a cable over poles to your home),
// under the lane bridge, behind the garden (a sluice feeds a wooden flume into the greenhouse and to the raised beds), under the east bridge and out through the east hedge.
// The water surface runs (its picture and ripples move downstream); foam and drops at the wheel (desktop). Merged: one mesh per surface for everything that stands still.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Placer, shapes } from './density.js';
import { ptex } from './props.js';
import { leafGeo } from './rooms.js';
import { streamLine, nearStream, wheelFrame, genFrame, bridgeFrames, toWorld, groundY, bedY, waterHalf } from './baselife.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z), C = (h) => new THREE.Color(h);
export function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }

// ---------------------------------------------------------------- shared surfaces (also used by src/basevillage.js): one material per surface and tier, vertex colours carry the tints
const ALIAS = { paint: 'wood', metal: 'iron', plastic: 'plain', paper: 'cloth', pot: 'cer', rubber: 'iron', dark: 'iron', net: 'cloth', soil: 'soil', straw: 'soil' };
const MC = {};
export function lifeMats(hi) {
  const k = hi ? 'hi' : 'lo'; if (MC[k]) return MC[k];
  const M = (o) => { const c = Object.assign({ vertexColors: true }, o); let m; if (hi) { m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85 }, c)); m.userData.pbr = true; } else { delete c.roughness; delete c.metalness; delete c.envMapIntensity; m = new THREE.MeshLambertMaterial(c); } m.userData.shared = true; return m; };
  MC[k] = { wood: M({ map: ptex('wood') }), plaster: M({ map: ptex('render'), roughness: 0.92 }), stone: M({ map: ptex('block'), roughness: 0.95 }), iron: M({ map: ptex('metal'), roughness: 0.55, metalness: 0.5 }),
    copper: M({ roughness: 0.35, metalness: 0.75 }), cer: M({ map: ptex('glaze'), roughness: 0.35 }), cloth: M({ map: ptex('fabric'), side: THREE.DoubleSide, roughness: 0.95 }), leaf: M({ side: THREE.DoubleSide, roughness: 0.7 }),
    turf: M({ map: ptex('grass'), roughness: 0.95 }), moss: M({ map: ptex('grass'), roughness: 0.95 }), cell: M({ map: ptex('cell'), roughness: 0.2 }), soil: M({ map: ptex('worn'), roughness: 1 }), plain: M({ roughness: 0.9 }),
    glass: M({ transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.05, envMapIntensity: 1.4 }), glow: (() => { const m = new THREE.MeshBasicMaterial({ vertexColors: true }); m.userData.shared = true; return m; })() };
  return MC[k];
}
// a placer that gathers geometries per surface; aliases fold the shared prop builders' surface names (src/density.js PROPS) into ours
export function lifePlacer() { const acc = new Map(); return { acc, P: new Placer((key, geo, m, tint) => { const kk = ALIAS[key] || key; let a = acc.get(kk); if (!a) acc.set(kk, a = []); a.push([geo, m.clone(), tint]); }) }; }
// merge each surface into one mesh (a geometry that carries its own vertex colours keeps them, times its tint); returns triangles. extra: { surface: material } overrides
// (Nov 20, a title frame of 205 ms: the life pieces' merge was one part) mergeLifeIter stops after each material; mergeLife runs it at once
export function mergeLife(parent, acc, M, extra) { const it = mergeLifeIter(parent, acc, M, extra); let x = it.next(); while (!x.done) x = it.next(); return x.value; }
export function* mergeLifeIter(parent, acc, M, extra) { let tri = 0, meshes = 0;
  for (const [key, list] of acc) { yield; const geos = [];
    for (const [geo, m, tint] of list) { const own = geo.userData && geo.userData.ownColour, q = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k2 of Object.keys(q.attributes)) if (k2 !== 'position' && k2 !== 'normal' && k2 !== 'uv' && !(own && k2 === 'color')) q.deleteAttribute(k2);
      if (!q.attributes.normal) q.computeVertexNormals(); if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); q.applyMatrix4(m);
      const n = q.attributes.position.count, t = tint || C(0xffffff); if (own && q.attributes.color) { const cc = q.attributes.color; for (let i = 0; i < n; i++) cc.setXYZ(i, cc.getX(i) * t.r, cc.getY(i) * t.g, cc.getZ(i) * t.b); }
      else { const cc = new Float32Array(n * 3); for (let i = 0; i < n; i++) { cc[3 * i] = t.r; cc[3 * i + 1] = t.g; cc[3 * i + 2] = t.b; } q.setAttribute('color', new THREE.BufferAttribute(cc, 3)); } geos.push(q); }
    const mg = mergeGeometries(geos, false); for (const q of geos) q.dispose(); if (!mg) continue; const mat = (extra && extra[key]) || M[key] || M.plain, me = new THREE.Mesh(mg, mat);
    me.castShadow = !mat.transparent && key !== 'glow'; me.receiveShadow = true; me.userData.life = true; parent.add(me); tri += mg.attributes.position.count / 3; meshes++; }
  return { tri: Math.round(tri), meshes }; }
// a geometry from flat lists (positions, colours, uvs, indices); vertex colours are kept through the merge
export function ownGeo(pos, col, uv, idx) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.userData.ownColour = true; return g; }
// a reed clump: n thin tapered blades leaning out, bent a little (base at 0, about 1 m tall; scale it)
const RG = {};
export function reedGeo(n) { if (RG[n]) return RG[n]; const r = rng(91 + n), pos = [], col = [], uv = [], idx = [];
  for (let b = 0; b < n; b++) { const a = r() * 2 * PI, lean = 0.12 + 0.25 * r(), h = 0.7 + 0.35 * r(), w = 0.022 + 0.012 * r(), cx = Math.cos(a), cz = Math.sin(a), base = pos.length / 3;
    for (let j = 0; j <= 3; j++) { const t = j / 3, y = h * t, o = lean * t * t, ww = w * (1 - t * 0.9); for (const s of [-1, 1]) { pos.push(cx * o + -cz * ww * s, y, cz * o + cx * ww * s); const g = 0.55 + 0.45 * t; col.push(0.55 * g, 0.72 * g, 0.36 * g); uv.push(s * 0.5 + 0.5, t); } }
    for (let j = 0; j < 3; j++) { const q = base + j * 2; idx.push(q, q + 1, q + 3, q, q + 3, q + 2); } }
  return (RG[n] = ownGeo(pos, col, uv, idx)); }

// ---------------------------------------------------------------- the water's pictures: a running surface (streaks, light flecks, foam at the edges) and its ripple relief
const TX = {};
function waterTex() { if (TX.map) return TX;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'), r = rng(4242);
  const gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, '#9fc8c0'); gr.addColorStop(0.12, '#5f9c9c'); gr.addColorStop(0.5, '#3f7f8c'); gr.addColorStop(0.88, '#5f9c9c'); gr.addColorStop(1, '#9fc8c0'); x.fillStyle = gr; x.fillRect(0, 0, 128, 256);
  for (let k = 0; k < 260; k++) { const u = r() * 128, v = r() * 256, l = 8 + r() * 40, e = Math.min(u, 128 - u) / 64; x.strokeStyle = 'rgba(' + (r() < 0.5 ? '210,236,232' : '30,70,80') + ',' + (0.06 + 0.12 * r() * (1 - e * 0.6)) + ')'; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(u, v); x.bezierCurveTo(u + (r() - 0.5) * 6, v + l * 0.3, u + (r() - 0.5) * 6, v + l * 0.6, u + (r() - 0.5) * 4, v + l); x.stroke(); }
  for (let k = 0; k < 140; k++) { const side = r() < 0.5, u = side ? r() * 14 : 128 - r() * 14, v = r() * 256; x.fillStyle = 'rgba(240,248,244,' + (0.2 + 0.4 * r()) + ')'; x.beginPath(); x.ellipse(u, v, 1 + r() * 3, 2 + r() * 6, 0, 0, 2 * PI); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.userData.keep = true; TX.map = t;
  const n = document.createElement('canvas'); n.width = n.height = 128; const nx = n.getContext('2d'), img = nx.createImageData(128, 128);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) { const h = (u, v) => Math.sin(u * 0.31 + Math.sin(v * 0.05 * 2 * PI / 2.56) * 1.6) * 0.6 + Math.sin(v * 0.098 + Math.sin(u * 0.2) * 1.2) + Math.sin((u * 0.5 + v * 0.147)) * 0.35, dx = h(i + 1, j) - h(i - 1, j), dy = h(i, j + 1) - h(i, j - 1), k = (j * 128 + i) * 4; img.data[k] = 128 + dx * 46; img.data[k + 1] = 128 + dy * 46; img.data[k + 2] = 255; img.data[k + 3] = 255; }
  nx.putImageData(img, 0, 0); const nt = new THREE.CanvasTexture(n); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.userData.keep = true; TX.normal = nt;
  const f = document.createElement('canvas'); f.width = 128; f.height = 128; const fx = f.getContext('2d'); for (let k = 0; k < 220; k++) { const u = r() * 128, v = r() * 128, s = 1 + r() * 5; fx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.55 * r()) + ')'; fx.beginPath(); fx.ellipse(u, v, s, s * (0.6 + r()), r() * 3, 0, 2 * PI); fx.fill(); }
  const ft = new THREE.CanvasTexture(f); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.userData.keep = true; TX.foam = ft;
  return TX; }
function waterMat(cfg, hi) { const T = waterTex(), sw = cfg.quality && cfg.quality.high && cfg.quality.high.scenery && cfg.quality.high.scenery.water, col = sw ? sw.colour : 0x2f7f96;
  if (hi) { const m = new THREE.MeshPhysicalMaterial({ color: C(col).lerp(C(0xffffff), 0.55), map: T.map, roughness: 0.1, normalMap: T.normal, normalScale: new THREE.Vector2(0.45, 0.45), transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1, depthWrite: true }); m.userData.pbr = true; return m; }
  return new THREE.MeshLambertMaterial({ color: 0xd8eeee, map: T.map, transparent: true, opacity: 0.92 }); }

// ---------------------------------------------------------------- the build
// the ground sunk along the stream (round 2, owner 21:46): the base's flat ground becomes a grid that is fine round the stream (its channel dug to CONFIG.baseWater.bed)
// and coarse elsewhere (flat), with the same picture and tiling; src/scenehi.js shades it on desktop (userData.ownGround)
// (Nov 20, the title's longest frame on the Mac: the dug grid's heights were one step) sinkGroundIter stops every 24 rows of the dug grid; sinkGround runs it at once
function sinkGround(ground, cfg, hi) { const it = sinkGroundIter(ground, cfg, hi); let x = it.next(); while (!x.done) x = it.next(); return x.value; }
function* sinkGroundIter(ground, cfg, hi) {
  const L = streamLine(cfg, 0.5), top = cfg.baseWater.bed.top + 0.6, E = 60, st = hi ? 0.25 : 0.5, big = hi ? 1 : 6;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of L) { x0 = Math.min(x0, p.x - top); x1 = Math.max(x1, p.x + top); z0 = Math.min(z0, p.z - top); z1 = Math.max(z1, p.z + top); }
  x0 = Math.max(-E + 1, Math.floor(x0)); x1 = Math.min(E - 1, Math.ceil(x1)); z0 = Math.max(-E + 1, Math.floor(z0)); z1 = Math.min(E - 1, Math.ceil(z1));
  const pos = [], uv = [], idx = [];
  function* grid(ax, bx, az, bz, step, dig) { const nx = Math.max(1, Math.round((bx - ax) / step)), nz = Math.max(1, Math.round((bz - az) / step)), n0 = pos.length / 3;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = ax + (bx - ax) * i / nx, z = az + (bz - az) * j / nz; pos.push(x, dig ? groundY(cfg, x, z) : 0, z); uv.push((x + E) / (2 * E), (E - z) / (2 * E)); if (dig && i === nx && j % 24 === 23) yield; }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = n0 + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); } }
  yield* grid(x0, x1, z0, z1, st, true); yield* grid(-E, E, -E, z0, big, false); yield* grid(-E, E, z1, E, big, false); yield* grid(-E, x0, z0, z1, big, false); yield* grid(x1, E, z0, z1, big, false);
  yield; const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ge.setIndex(idx); ge.computeVertexNormals();
  ground.geometry.dispose(); ground.geometry = ge; ground.rotation.set(0, 0, 0); ground.userData.ownGround = true; return idx.length / 3; }
// g: the base group, ground: the base's ground mesh (sunk along the stream); returns { update(dt, t), group, cost, wheel }
// (Nov 20, a title frame of 169 ms: the base water was one part of the base's sliced build) buildBaseWaterIter stops between its sections (the same pieces in the
// same order); buildBaseWater runs it to the end at once
export function buildBaseWater(g, cfg, hi, ground, kit) { const it = buildBaseWaterIter(g, cfg, hi, ground, kit); let x = it.next(); while (!x.done) x = it.next(); return x.value; }
export function* buildBaseWaterIter(g, cfg, hi, ground, kit) {
  const W = cfg.baseWater, D = hi ? W.high : W.low, r = rng(5150), G = shapes(), { acc, P } = lifePlacer(), M = lifeMats(hi), grp = new THREE.Group(); grp.userData.life = 'water'; g.add(grp);
  const LG = leafGeo(), jit = (hx, k) => C(hx).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * (k || 0.08)), wy = W.y, BD = W.bed, hw = waterHalf(cfg), rh = waterHalf(cfg, true), L = streamLine(cfg, 1 / Math.max(0.5, D.seg)), F = wheelFrame(cfg), gTris = ground ? (yield* sinkGroundIter(ground, cfg, hi)) : 0;
  const raceLo = -F.len / 2 - 0.35, raceHi = F.len / 2 + 0.35, inRace = (x, z) => { const dx = x - F.x, dz = z - F.z, lz = dx * Math.sin(F.ry) + dz * Math.cos(F.ry), lx = dx * Math.cos(F.ry) - dz * Math.sin(F.ry); return lz > raceLo && lz < raceHi && Math.abs(lx) < 1.4; };
  const B = bridgeFrames(cfg), nearBridge = (x, z, m) => B.some((b) => Math.hypot(x - b.x, z - b.z) < b.wd / 2 + m);
  // ---- the water surface (stream and flumes) in one geometry: v runs downstream in metres / 2, u across
  const wp = [], wu = [], wi = [], strip = (pts, half, y, across) => { const n0 = wp.length / 3, A = across || (hi ? 4 : 1);
    for (const p of pts) { const nx = -p.tz, nz = p.tx; for (let a = 0; a <= A; a++) { const o = -half + (2 * half * a) / A; wp.push(p.x + nx * o, y, p.z + nz * o); wu.push(a / A, p.s / 2); } }
    for (let i = 0; i < pts.length - 1; i++) for (let a = 0; a < A; a++) { const q = n0 + i * (A + 1) + a, q2 = q + A + 1; wi.push(q, q + 1, q2, q + 1, q2 + 1, q2); } };
  // the water in the channel: narrower between the race walls; the strip runs a little into the banks so no gap shows
  { let run = [], race = null; const flush = () => { if (run.length > 1) strip(run, (race ? rh : hw) + 0.06, wy); run = []; }; for (const p of L) { if (race !== null && p.race !== race) { const last = run[run.length - 1]; flush(); if (last) run.push(last); } race = p.race; run.push(p); } flush(); }
  yield;
  // ---- the channel's lining laid on the dug ground: dark pebbly bed, wet earth at the waterline, a mossy band, then the ground's own grass up to the bank top (vertex colours); in the race a dark bed between the walls
  { const pos = [], col = [], uv = [], idx = [], T = BD.top - 0.14, F0 = BD.floor, open = [[-T, [0.42, 0.55, 0.25]], [-(hw + 0.3), [0.33, 0.42, 0.18]], [-(hw + 0.05), [0.3, 0.26, 0.17]], [-(hw - 0.12), [0.17, 0.15, 0.1]], [-F0, [0.2, 0.21, 0.14]], [0, [0.22, 0.23, 0.16]]], rows = (race) => { const o = race ? [[-rh - 0.02, [0.18, 0.17, 0.12]], [0, [0.2, 0.21, 0.14]]] : open; return [...o, ...o.slice(0, -1).reverse().map(([d, c]) => [-d, c])]; };
    let prevBase = -1, prevN = 0, prevRace = null;
    for (let i = 0; i < L.length; i++) { const p = L[i], nx = -p.tz, nz = p.tx, R0 = rows(p.race), base = pos.length / 3;
      for (const [d, c] of R0) { const jj = Math.abs(d) > 0.01 && Math.abs(d) < BD.top ? (r() - 0.5) * 0.04 : 0, dd = d + jj; pos.push(p.x + nx * dd, bedY(cfg, Math.abs(dd), p.race) + 0.014, p.z + nz * dd); const f = 0.88 + 0.24 * r(); col.push(c[0] * f, c[1] * f, c[2] * f); uv.push(dd, p.s); }
      if (prevBase >= 0 && prevRace === p.race && prevN === R0.length) for (let k = 0; k < R0.length - 1; k++) { const q = prevBase + k, q2 = base + k; idx.push(q, q + 1, q2, q + 1, q2 + 1, q2); }
      prevBase = base; prevN = R0.length; prevRace = p.race; }
    P.add('moss', ownGeo(pos, col, uv, idx), 0, 0, 0); }
  yield;
  // ---- stones, reeds and ferns along the banks (not in the race or on a bridge's landing)
  { const total = L[L.length - 1].s, st = Math.max(1, Math.round(total * D.stones)), rd = Math.round(total * D.reeds), fe = Math.round(total * D.ferns), at = (s) => { let i = 1; while (i < L.length - 1 && L[i].s < s) i++; return L[i]; };
    for (let k = 0; k < st; k++) { const p = at(r() * total), side = r() < 0.5 ? -1 : 1, o = hw - 0.15 + r() * 0.4, x = p.x - p.tz * side * o, z = p.z + p.tx * side * o; if (inRace(x, z) || nearBridge(x, z, 0.3)) continue; const s = 0.09 + 0.16 * r() * r();
      P.add('stone', G.lump(Math.floor(r() * 8)), x, bedY(cfg, o) + 0.02, z, r() * 3, r() * 6, 0, s * 1.4, s * 0.7, s * 1.1, jit(r() < 0.3 ? 0x7f8a66 : 0x9a9488, 0.12)); }
    for (let k = 0; k < rd; k++) { const p = at(r() * total), side = r() < 0.5 ? -1 : 1, o = hw - 0.05 + r() * 0.3, x = p.x - p.tz * side * o, z = p.z + p.tx * side * o; if (inRace(x, z) || nearBridge(x, z, 0.8)) continue; const s = 0.7 + 0.6 * r();
      P.add('leaf', reedGeo(hi ? 7 : 4), x, bedY(cfg, o), z, 0, r() * 6, 0, s * 0.9, s * (0.8 + 0.5 * r()), s * 0.9, jit(0xffffff, 0.1)); }
    for (let k = 0; k < fe; k++) { const p = at(r() * total), side = r() < 0.5 ? -1 : 1, o = hw + 0.2 + r() * (BD.top - hw - 0.1), x = p.x - p.tz * side * o, z = p.z + p.tx * side * o; if (inRace(x, z) || nearBridge(x, z, 0.6)) continue; const n = 6 + Math.floor(r() * 4), c = jit(0x4f8a34, 0.1); if (kit) { kit.add('fern', x, bedY(cfg, o) + 0.02, z, (0.9 + 0.5 * r()) * ((cfg.baseLife.plants.size || {}).fern || 1)); continue; }
      for (let f = 0; f < n; f++) { P.push(x, bedY(cfg, o) + 0.03, z, f / n * 2 * PI + r() * 0.4, -0.55 - 0.4 * r()); P.add('leaf', LG, 0, 0, 0, 0, 0, 0, 0.16, 0.16, 0.42 + 0.2 * r(), c); P.pop(); } } }
  yield;
  // ---- the race: stone walls each side with a timber cap, moss at the waterline, a little weir lip where the water drops onto the wheel
  { P.push(F.x, 0, F.z, F.ry); const wl = raceHi - raceLo, zc = (raceLo + raceHi) / 2;
    const wb = -BD.depth, wt = 0.25, rows = Math.round((wt - wb) / 0.18); for (const sx of [-1, 1]) { const x0 = sx * (rh + 0.16);
      if (hi) { for (let row = 0; row < rows; row++) for (let z = raceLo + (row % 2) * 0.22; z < raceHi - 0.05; z += 0.44 + r() * 0.08) { const l = Math.min(0.42 + r() * 0.1, raceHi - z); P.add('stone', G.box(0.32, 0.17, l - 0.02), x0 + (r() - 0.5) * 0.02, wb + 0.09 + row * 0.18, z + l / 2, 0, (r() - 0.5) * 0.03, 0, 1, 1, 1, jit(row > 2 ? 0xb8b0a0 : 0x8f8a7a, 0.1)); } }
      else P.add('stone', G.box(0.34, wt - wb, wl), x0, (wt + wb) / 2, zc, 0, 0, 0, 1, 1, 1, C(0xaaa292));
      P.add('wood', G.box(0.38, 0.07, wl + 0.1), x0, wt + 0.03, zc, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a, 0.06));
      for (let k = 0; k < D.moss; k++) { const z = raceLo + r() * wl; P.add('moss', G.lump(Math.floor(r() * 8)), sx * (rh + 0.01), wy - 0.02 + r() * 0.12, z, 0, r() * 6, 0, 0.05, 0.05 + 0.04 * r(), 0.12 + 0.12 * r(), jit(0x5a8a3a, 0.12)); } }
    P.add('stone', G.box(2 * rh + 0.1, 0.3, 0.3), 0, wb + 0.15 + 0.3, raceLo + 0.2, 0, 0, 0, 1, 1, 1, C(0x9a9284)); P.add('wood', G.box(2 * rh, 0.05, 0.12), 0, wy + 0.02, raceLo + 0.25, 0, 0, 0, 1, 1, 1, C(0x6a4a2a));
    // the wheel's timber trestles on the walls: two legs each side meeting under an iron bearing block with a copper cap, braced; a vine climbs the west trestle
    const ay = wy + W.wheel.R - W.wheel.dip;
    for (const sx of [-1, 1]) { const x0 = sx * (rh + 0.16); for (const sz of [-1, 1]) P.beam('wood', G, V(x0, wt + 0.05, sz * 0.75), V(x0, ay - 0.12, sz * 0.08), 0.13, 0.13, jit(0x6a4a30, 0.06)); P.beam('wood', G, V(x0, 1.0, -0.5), V(x0, 1.0, 0.5), 0.1, 0.08, jit(0x5a3e28));
      P.add('iron', G.box(0.22, 0.16, 0.26), x0, ay - 0.06, 0, 0, 0, 0, 1, 1, 1, C(0x3a3836)); P.add('copper', G.cyl(0.09, 0.09, 0.24, hi ? 14 : 8), x0, ay, 0, 0, 0, PI / 2, 1, 1, 1, C(0xc87a3a));
      if (hi) for (const sz of [-1, 1]) P.add('copper', G.sphere(0.022, 6, 4), x0 + sx * 0.12, ay - 0.06, sz * 0.09, 0, 0, 0, 1, 1, 1, C(0xd08848)); }
    { const vx = -(rh + 0.16), n = hi ? 46 : 0; for (let k = 0; k < n; k++) { const t = k / n, z = 0.75 - t * 0.67 + Math.sin(t * 9) * 0.06, y = 0.6 + t * (ay - 0.8); P.push(vx - 0.08 + (r() - 0.5) * 0.06, y, z, r() * 6, -0.3 - 0.6 * r()); P.add('leaf', LG, 0, 0, 0, 0, 0, 0, 0.07, 0.07, 0.13, jit(0x4f8f3a, 0.12)); P.pop(); }
      if (hi) for (let k = 0; k < 5; k++) P.rod('leaf', G, V(vx - 0.08, 0.6 + k * 0.18, 0.75 - k * 0.12), V(vx - 0.08, 0.78 + k * 0.18, 0.68 - k * 0.12), 0.008, 4, C(0x3f6a2a)); }
    // ferns and moss tufts at the foot of the race walls
    if (hi) for (let k = 0; k < 8; k++) { const sx = k % 2 ? 1 : -1, z = raceLo + r() * wl, n = 7; for (let f = 0; f < n; f++) { P.push(sx * (rh + 0.42 + r() * 0.15), 0.02, z, f / n * 2 * PI, -0.6 - 0.3 * r()); P.add('leaf', LG, 0, 0, 0, 0, 0, 0, 0.15, 0.15, 0.4, jit(0x4a8a32, 0.1)); P.pop(); } }
    P.pop(); }
  yield;
  // ---- the generator housing (bloom-tech): stone plinth, plaster body under a small green vault, round window onto copper coils, a gauge with a glowing needle, a status lamp, a belt pulley
  const Gf = genFrame(cfg), ay = wy + W.wheel.R - W.wheel.dip; let genPulley = null;
  { const { w, d, h } = Gf; P.push(Gf.x, 0, Gf.z, Gf.ry);
    P.add('stone', G.box(w + 0.2, 0.16, d + 0.2), 0, 0.08, 0, 0, 0, 0, 1, 1, 1, C(0x9a9284)); P.add('plaster', G.box(w, h - 0.16, d), 0, 0.16 + (h - 0.16) / 2, 0, 0, 0, 0, 1, 1, 1, C(0xeee6d2));
    P.push(0, h, 0, 0); P.add('turf', new THREE.CylinderGeometry(d / 2 + 0.12, d / 2 + 0.12, w + 0.2, hi ? 16 : 8, 1, true, 0, PI), 0, 0, 0, 0, 0, PI / 2, 0.55, 1, 1, C(0x9ac870)); for (const sx of [-1, 1]) P.add('plaster', new THREE.CircleGeometry(d / 2 + 0.1, hi ? 16 : 8, 0, PI), sx * (w / 2 + 0.005), 0, 0, 0, sx * PI / 2, 0, 1, 0.55, 1, C(0xeee6d2)); P.pop();
    P.add('wood', G.box(w + 0.06, 0.06, d + 0.06), 0, h, 0, 0, 0, 0, 1, 1, 1, C(0x6a4a2a));
    // round window and the coils behind it
    P.add('copper', G.torus(0.3, 0.035, 6, hi ? 28 : 12), -0.2, 0.86, d / 2 + 0.01, 0, 0, 0, 1, 1, 1, C(0xc87a3a)); P.add('glass', new THREE.CircleGeometry(0.29, hi ? 24 : 12), -0.2, 0.86, d / 2 + 0.02, 0, 0, 0, 1, 1, 1, C(0xe8f4f0)); P.add('glow', new THREE.CircleGeometry(0.29, hi ? 24 : 12), -0.2, 0.86, d / 2 - 0.08, 0, 0, 0, 1, 1, 1, C(0xffcf8a));
    for (let k = 0; k < (hi ? 7 : 3); k++) P.add('copper', G.torus(0.15, 0.03, 6, hi ? 18 : 8), -0.2 + (k - 3) * 0.035, 0.86, d / 2 - 0.05, 0, PI / 2, 0, 1, 1, 1, C(k % 2 ? 0xd88a48 : 0xb86a30));
    // the gauge: a brass rim, a cream face, a glowing green needle and a lamp
    P.add('copper', G.cyl(0.13, 0.13, 0.05, hi ? 20 : 10), 0.42, 1.0, d / 2 + 0.02, PI / 2, 0, 0, 1, 1, 1, C(0xd0a050)); P.add('glow', new THREE.CircleGeometry(0.105, hi ? 20 : 10), 0.42, 1.0, d / 2 + 0.05, 0, 0, 0, 1, 1, 1, C(0xf4ecd0));
    P.add('glow', G.box(0.012, 0.085, 0.006), 0.42 + 0.03, 1.03, d / 2 + 0.056, 0, 0, -0.65, 1, 1, 1, C(0x6af0a8)); if (hi) for (let k = 0; k < 9; k++) { const a = -2.2 + k * 0.55; P.add('iron', G.box(0.006, 0.02, 0.004), 0.42 + Math.sin(a) * 0.088, 1.0 + Math.cos(a) * 0.088, d / 2 + 0.054, 0, 0, -a, 1, 1, 1, C(0x2a2622)); }
    P.add('glow', G.sphere(0.035, 8, 6), 0.42, 0.72, d / 2 + 0.03, 0, 0, 0, 1, 1, 1, C(0x7af0b0)); P.add('copper', G.torus(0.04, 0.01, 5, 10), 0.42, 0.72, d / 2 + 0.02, 0, 0, 0, 1, 1, 1, C(0xc87a3a));
    // copper corner bands, rivets, a hatch, a vent; a cable box at the back
    for (const sx of [-1, 1]) P.add('copper', G.box(0.05, h - 0.16, 0.05), sx * (w / 2), 0.16 + (h - 0.16) / 2, d / 2, 0, 0, 0, 1, 1, 1, C(0xb87036));
    if (hi) { for (let k = 0; k < 10; k++) P.add('copper', G.sphere(0.016, 5, 4), -w / 2 + 0.1 + k * (w - 0.2) / 9, h - 0.08, d / 2 + 0.01, 0, 0, 0, 1, 1, 1, C(0xd08848)); for (let k = 0; k < 4; k++) P.add('iron', G.box(0.32, 0.02, 0.02), -0.2, 0.32 + k * 0.05, d / 2 + 0.01, 0, 0, 0, 1, 1, 1, C(0x4a4642)); }
    P.add('iron', G.box(0.12, 0.3, 0.3), -w / 2 - 0.06, 0.9, -0.2, 0, 0, 0, 1, 1, 1, C(0x4a5a52)); P.add('copper', G.cyl(0.03, 0.03, 0.2, 8), -w / 2 - 0.06, 1.12, -0.2, 0, 0, 0, 1, 1, 1, C(0xc87a3a));
    P.add('cer', G.cyl(0.08, 0.08, 0.06, hi ? 14 : 8), w / 2 + 0.03, 1.15, 0, 0, 0, PI / 2, 1, 1, 1, C(0x7fbfae));
    // moss and a fern at its foot
    if (hi) for (let k = 0; k < 9; k++) { P.push(-w / 2 - 0.1 + r() * (w + 0.2), 0.02, d / 2 + 0.15 + r() * 0.2, r() * 6, -0.7); P.add('leaf', LG, 0, 0, 0, 0, 0, 0, 0.14, 0.14, 0.34, jit(0x4f8a34, 0.1)); P.pop(); }
    P.pop(); }
  // the belt from the wheel's axle pulley (west end of the axle) down to the generator's pulley
  { const [px, pz] = toWorld(F, -(rh + 0.8), 0), [qx, qz] = toWorld(Gf, Gf.w / 2 + 0.1, 0), py = 1.15; for (const o of [-0.17, 0.17]) P.beam('cloth', G, V(px, ay + o * 1.6, pz), V(qx, py + o * 0.6, qz), 0.045, 0.01, C(0x3a2a20)); }
  // the cable from the generator's back over three poles to your home's wall
  { const [cx, cz] = toWorld(Gf, -Gf.w / 2 - 0.06, -0.2); let prev = V(cx, 1.15, cz); const pts = W.gen.cable;
    pts.forEach(([x, z], k) => { const last = k === pts.length - 1, top = last ? 2.35 : 3.1, q = V(x, top, z); if (!last) { P.add('wood', G.cyl(0.07, 0.09, top + 0.1, 8), x, (top + 0.1) / 2, z, 0, 0, (r() - 0.5) * 0.04, 1, 1, 1, jit(0x6a4a30)); P.add('wood', G.box(0.5, 0.06, 0.08), x, top, z, 0, r(), 0, 1, 1, 1, jit(0x5a3e28)); P.add('cer', G.cyl(0.03, 0.04, 0.08, 8), x + 0.18, top + 0.06, z, 0, 0, 0, 1, 1, 1, C(0x7fbfae)); P.add('copper', G.sphere(0.02, 6, 4), x + 0.18, top + 0.11, z, 0, 0, 0, 1, 1, 1, C(0xc87a3a)); }
      else P.add('copper', G.box(0.14, 0.14, 0.08), x, top, z, 0, 0, 0, 1, 1, 1, C(0xc87a3a));
      const n = 8; let a = prev; for (let i = 1; i <= n; i++) { const t = i / n, b = prev.clone().lerp(q, t); b.y -= Math.sin(PI * t) * 0.35; P.rod('iron', G, a, b, 0.012, 4, C(0x1e1e1e)); a = b; } prev = q.clone().add(V(0.18, 0.11, 0)); }); }
  yield;
  // ---- footbridges: stone abutments, two arched stringers, plank deck with gaps, posts with copper caps, top and mid rails, a lantern on one post, moss on the stones
  for (const b of B) { P.push(b.x, 0, b.z, b.ry); const hl = b.len / 2, hz = b.wd / 2, yA = (x) => 0.22 + 0.2 * Math.cos(PI * x / b.len);
    for (const sx of [-1, 1]) { P.add('stone', G.box(0.7, 0.34, b.wd + 0.35), sx * (hl - 0.3), 0.15, 0, 0, 0, 0, 1, 1, 1, jit(0x9a9284, 0.08)); if (hi) for (let k = 0; k < 4; k++) P.add('moss', G.lump(k), sx * (hl - 0.3) + (r() - 0.5) * 0.5, 0.3, (r() - 0.5) * b.wd, 0, r() * 6, 0, 0.12, 0.05, 0.16, jit(0x5a8a3a, 0.1)); }
    const seg = 6; for (const sz of [-1, 1]) for (let i = 0; i < seg; i++) { const x0 = -hl + 0.15 + (b.len - 0.3) * i / seg, x1 = -hl + 0.15 + (b.len - 0.3) * (i + 1) / seg; P.beam('wood', G, V(x0, yA(x0) - 0.06, sz * (hz - 0.14)), V(x1, yA(x1) - 0.06, sz * (hz - 0.14)), 0.12, 0.16, jit(0x5a3e28, 0.05)); }
    for (let x = -hl + 0.12; x <= hl - 0.1; x += 0.19) { const tilt = Math.atan(-0.2 * PI / b.len * Math.sin(PI * x / b.len)); P.add('wood', G.box(0.16, 0.045, b.wd + (r() - 0.5) * 0.04), x, yA(x) + 0.04, (r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.02, tilt, 1, 1, 1, jit(0x9a7a52, 0.12)); }
    for (const sz of [-1, 1]) { const posts = [-hl + 0.32, 0, hl - 0.32]; for (const x of posts) { P.add('wood', G.box(0.09, 0.95, 0.09), x, yA(x) + 0.47, sz * (hz - 0.02), 0, 0, 0, 1, 1, 1, jit(0x6a4a30, 0.06)); if (hi) P.add('copper', G.cyl(0.0, 0.065, 0.06, 6), x, yA(x) + 0.98, sz * (hz - 0.02), 0, PI / 4, 0, 1, 1, 1, C(0xc87a3a)); }
      for (let i = 0; i < posts.length - 1; i++) for (const yy of [0.92, 0.5]) P.beam('wood', G, V(posts[i], yA(posts[i]) + yy, sz * (hz - 0.02)), V(posts[i + 1], yA(posts[i + 1]) + yy, sz * (hz - 0.02)), 0.07, 0.06, jit(0x7a5a3a, 0.06)); }
    { const x = hl - 0.32, y = yA(x) + 0.98; P.add('iron', G.box(0.03, 0.3, 0.03), x, y + 0.15, hz - 0.02, 0, 0, 0, 1, 1, 1, C(0x2a2a28)); P.add('copper', G.box(0.18, 0.03, 0.18), x, y + 0.31, hz - 0.02, 0, 0, 0, 1, 1, 1, C(0xc87a3a)); P.add('glass', G.box(0.13, 0.17, 0.13), x, y + 0.2, hz - 0.02, 0, 0, 0, 1, 1, 1, C(0xfff0d0)); P.add('glow', G.sphere(0.035, 8, 6), x, y + 0.19, hz - 0.02, 0, 0, 0, 1, 1, 1, C(0xffd890)); }
    // ramps at both ends: planks on two bearers from the ground up to the deck's ends (people and your view ride up and over: deckY / deckAt)
    { const rp = W.ramp, ye = yA(hl) + 0.04; for (const sx of [-1, 1]) { for (const sz of [-1, 1]) P.beam('wood', G, V(sx * (hl + rp), 0.0, sz * (hz - 0.2)), V(sx * (hl - 0.05), ye - 0.07, sz * (hz - 0.2)), 0.1, 0.1, jit(0x5a3e28, 0.05)); for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4, x = sx * (hl + rp * (1 - t)); P.add('wood', G.box(0.16, 0.04, b.wd - 0.1), x, ye * t + 0.01, 0, 0, 0, sx * Math.atan(ye / rp), 1, 1, 1, jit(0x8a6a44, 0.12)); } } }
    P.pop(); }
  yield;
  // ---- the flumes: a sluice gate on the bank, a wooden channel on stone blocks into the greenhouse and along its planters (spouts into each), and a branch to the raised beds
  { const fl = W.flume, run = (pts, y0) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2; P.push(mx, 0, mz, ry);
      P.add('wood', G.box(0.32, 0.04, len + 0.3), 0, y0, 0, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a, 0.08)); for (const sx of [-1, 1]) P.add('wood', G.box(0.04, 0.17, len + 0.3), sx * 0.16, y0 + 0.1, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a2e, 0.08));
      for (let z = -len / 2; z <= len / 2 + 0.01; z += 1.1) { const [wx, wz] = toWorld({ x: mx, z: mz, ry }, 0, z), gy = groundY(cfg, wx, wz); P.add('stone', G.box(0.38, y0 - 0.01 - gy, 0.22), 0, (y0 - 0.01 + gy) / 2, z, 0, r() * 0.2, 0, 1, 1, 1, jit(0xa09888, 0.08)); if (hi) P.add('iron', G.box(0.4, 0.025, 0.03), 0, y0 + 0.17, z, 0, 0, 0, 1, 1, 1, C(0x3a3632)); }
      P.pop(); }
      const qs = pts.map(([x, z]) => ({ x, z })); for (let i = 0; i < qs.length; i++) qs[i].s = i ? qs[i - 1].s + Math.hypot(qs[i].x - qs[i - 1].x, qs[i].z - qs[i - 1].z) : 0;
      const dense = []; for (let i = 0; i < qs.length - 1; i++) { const a = qs[i], b = qs[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5)); for (let k = 0; k < n; k++) { const t = k / n, tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1; dense.push({ x: a.x + tx * t, z: a.z + tz * t, tx: tx / l, tz: tz / l, s: a.s + l * t }); } } const e = qs[qs.length - 1]; dense.push({ x: e.x, z: e.z, tx: dense[dense.length - 1].tx, tz: dense[dense.length - 1].tz, s: e.s });
      strip(dense, 0.12, y0 + 0.14, 1); };
    run(fl.main, 0.14); run(fl.beds, 0.14);
    // the sluice where the flume leaves the stream: two posts, a cross beam, a gate board half raised, an iron wheel to lift it
    { const [sx, sz] = fl.main[0], n = nearStream(cfg, sx, sz), ry = Math.atan2(n.tx, n.tz), gy = groundY(cfg, sx, sz); P.push(sx, 0, sz, ry); for (const o of [-0.3, 0.3]) P.add('wood', G.box(0.1, 0.95 - gy, 0.1), o, (0.95 + gy) / 2, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a30)); P.add('wood', G.box(0.75, 0.1, 0.12), 0, 0.95, 0, 0, 0, 0, 1, 1, 1, jit(0x5a3e28));
      P.add('wood', G.box(0.5, 0.42, 0.05), 0, 0.42, 0, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a)); P.add('iron', G.cyl(0.02, 0.02, 0.5, 6), 0, 1.15, 0, 0, 0, 0, 1, 1, 1, C(0x3a3632)); P.add('iron', G.torus(0.16, 0.018, 5, hi ? 16 : 8), 0, 1.4, 0, PI / 2, 0, 0, 1, 1, 1, C(0x3a3632)); if (hi) for (let k = 0; k < 4; k++) P.add('iron', G.box(0.32, 0.012, 0.012), 0, 1.4, 0, 0, k * PI / 4, 0, 1, 1, 1, C(0x3a3632)); P.pop(); }
    // spouts over the planters inside the greenhouse: a notch and a thin fall of water into each bed
    if (cfg.baseLife && cfg.baseLife.on) { const z = fl.main[fl.main.length - 1][1]; for (const x of [6.6, 8.2, 9.8, 11.4]) { P.add('wood', G.box(0.08, 0.03, 0.24), x, 0.29, z + 0.2, 0, 0, 0, 1, 1, 1, jit(0x6a4a2e)); P.add('glass', G.box(0.05, 0.22, 0.02), x, 0.35, z + 0.33, 0, 0, 0, 1, 1, 1, C(0xcfeef0)); } } }
  yield;
  // ---- merge what stands still, then the water surface, the turning wheel, foam and drops
  const res = yield* mergeLifeIter(grp, acc, M); let tri = res.tri, meshes = res.meshes;
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(wu, 2)); wg.setIndex(wi); wg.computeVertexNormals();
  const wm = waterMat(cfg, hi), water = new THREE.Mesh(wg, wm); water.receiveShadow = true; water.userData.life = true; water.userData.noAO = true; water.renderOrder = 2; grp.add(water); tri += wi.length / 3; meshes++;
  // the wheel: two rims (shrouds) with iron bands, spokes to a hub with copper bands, curved paddles between the rims, copper bolts; turns about its own x
  const wheel = new THREE.Group(); wheel.position.set(F.x, ay, F.z); wheel.rotation.y = F.ry; grp.add(wheel); const spin = new THREE.Group(); wheel.add(spin);
  { const WH = W.wheel, R = WH.R, ww = WH.width / 2, n = WH.paddles, seg = D.wheelSeg, w2 = lifePlacer(); const Q = w2.P;
    const ring = (ri, ro, t) => { const g2 = new THREE.LatheGeometry([[ri, -t], [ro, -t], [ro, t], [ri, t], [ri, -t]].map((q) => new THREE.Vector2(q[0], q[1])), seg); return g2; };
    for (const sx of [-1, 1]) { Q.add('wood', ring(R - 0.42, R - 0.06, 0.03), sx * ww, 0, 0, 0, 0, PI / 2, 1, 1, 1, jit(0x8a6a44, 0.05)); Q.add('iron', ring(R - 0.075, R - 0.02, 0.045), sx * ww, 0, 0, 0, 0, PI / 2, 1, 1, 1, C(0x3a3836)); Q.add('iron', ring(R - 0.44, R - 0.4, 0.04), sx * ww, 0, 0, 0, 0, PI / 2, 1, 1, 1, C(0x3a3836));
      for (let k = 0; k < WH.spokes; k++) { const a = k / WH.spokes * 2 * PI + (sx > 0 ? 0 : PI / WH.spokes); Q.push(sx * (ww - 0.02), 0, 0, 0, a); Q.add('wood', G.box(0.07, R - 0.62, 0.1), 0, 0.22 + (R - 0.62) / 2, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a30, 0.05)); if (hi) { Q.add('iron', G.box(0.09, 0.12, 0.12), 0, R - 0.42, 0, 0, 0, 0, 1, 1, 1, C(0x34322f)); Q.add('copper', G.sphere(0.022, 6, 4), sx * 0.05, R - 0.42, 0.03, 0, 0, 0, 1, 1, 1, C(0xd08848)); Q.add('copper', G.sphere(0.022, 6, 4), sx * 0.05, R - 0.42, -0.03, 0, 0, 0, 1, 1, 1, C(0xd08848)); } Q.pop(); } }
    for (let k = 0; k < n; k++) { const a = k / n * 2 * PI; Q.push(0, 0, 0, 0, a);
      Q.add('wood', G.box(WH.width - 0.02, 0.3, 0.04), 0, R - 0.32, 0, 0, 0, 0, 1, 1, 1, jit(0x9a7650, 0.1)); Q.push(0, R - 0.17, 0, 0, -0.42); Q.add('wood', G.box(WH.width - 0.02, 0.2, 0.035), 0, 0.09, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a44, 0.1)); Q.pop();
      if (hi) Q.add('iron', G.box(WH.width + 0.02, 0.025, 0.05), 0, R - 0.47, 0.0, 0, 0, 0, 1, 1, 1, C(0x3a3836)); Q.pop(); }
    Q.add('wood', G.cyl(0.24, 0.24, WH.width + 0.12, hi ? 16 : 8), 0, 0, 0, 0, 0, PI / 2, 1, 1, 1, jit(0x6a4a30)); for (const sx of [-1, 1]) Q.add('copper', G.cyl(0.26, 0.26, 0.06, hi ? 18 : 8), sx * (ww + 0.06), 0, 0, 0, 0, PI / 2, 1, 1, 1, C(0xc87a3a));
    Q.add('iron', G.cyl(0.07, 0.07, 2 * rh + 1.4, 10), -0.25, 0, 0, 0, 0, PI / 2, 1, 1, 1, C(0x3a3836)); Q.add('wood', G.cyl(0.3, 0.3, 0.08, hi ? 18 : 10), -(rh + 0.8), 0, 0, 0, 0, PI / 2, 1, 1, 1, jit(0x6a4a30));
    for (let k = 0; k < (hi ? 6 : 0); k++) { const a = k / 6 * 2 * PI; Q.add('copper', G.sphere(0.03, 6, 4), -(rh + 0.85), Math.sin(a) * 0.2, Math.cos(a) * 0.2, 0, 0, 0, 1, 1, 1, C(0xd08848)); }
    const wr = mergeLife(spin, w2.acc, M); tri += wr.tri; meshes += wr.meshes; spin.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
  // the generator's own pulley (turns with the belt, faster)
  { genPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, hi ? 14 : 8), M.wood); genPulley.geometry.rotateZ(PI / 2); const [qx, qz] = toWorld(Gf, Gf.w / 2 + 0.1, 0); genPulley.position.set(qx, 1.15, qz); genPulley.rotation.y = F.ry; const pc = new Float32Array(genPulley.geometry.attributes.position.count * 3).fill(0.55); genPulley.geometry.setAttribute('color', new THREE.BufferAttribute(pc, 3)); grp.add(genPulley); meshes++; }
  // foam on the water where the paddles strike and downstream of the wheel (desktop); drops thrown off the paddles
  let foam = null, drops = null, dropV = null;
  if (D.foam > 0) { const T = waterTex(), fm = new THREE.MeshBasicMaterial({ map: T.foam, transparent: true, opacity: 0.75, depthWrite: false, color: 0xf4fbf8 }), fg = new THREE.PlaneGeometry(2 * rh - 0.04, 2.6, 1, 4); fg.rotateX(-PI / 2); fg.translate(0, wy + 0.012, 1.3 - 0.35); foam = new THREE.Mesh(fg, fm); foam.position.set(F.x, 0, F.z); foam.rotation.y = F.ry; foam.renderOrder = 3; foam.userData.noAO = true; foam.userData.life = true; grp.add(foam); tri += 8; meshes++; }
  if (D.drops > 0) { const n = D.drops, pos = new Float32Array(n * 3); dropV = []; for (let i = 0; i < n; i++) dropV.push({ t: r() * 0.9, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0 }); const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    drops = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xe8f6f8, size: 0.05, transparent: true, opacity: 0.8, depthWrite: false })); drops.position.set(F.x, 0, F.z); drops.rotation.y = F.ry; dg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 6); drops.userData.life = true; grp.add(drops); meshes++; }
  let t = 0; const WT = waterTex(), flow = W.flow / 2, R = W.wheel.R;
  function update(dt) { t += dt; spin.rotation.x -= W.wheel.speed * dt; if (genPulley) genPulley.rotateX(-W.wheel.speed * dt * 2.6);
    WT.map.offset.y = -t * flow; WT.normal.offset.y = -t * flow * 1.15; WT.normal.offset.x = Math.sin(t * 0.3) * 0.02; if (foam) WT.foam.offset.y = -t * flow * 1.4;
    if (drops) { const a = drops.geometry.attributes.position.array; dropV.forEach((d, i) => { d.t -= dt; if (d.t <= 0 || d.y < wy) { const ang = 0.25 + Math.random() * 0.9; d.x = (Math.random() - 0.5) * W.wheel.width; d.y = ay - Math.cos(ang) * R; d.z = Math.sin(ang) * R * 0.98; d.vx = (Math.random() - 0.5) * 0.3; d.vy = 0.4 + Math.random() * 0.8; d.vz = 0.6 + Math.random() * 0.9; d.t = 0.5 + Math.random() * 0.6; }
      d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; a[3 * i] = d.x; a[3 * i + 1] = Math.max(wy, d.y); a[3 * i + 2] = d.z; }); drops.geometry.attributes.position.needsUpdate = true; } }
  // (owner 13:10, premortem A) a kept base shown again starts its flow and wheel where a fresh build does
  const spin0 = spin.rotation.x, pul0 = genPulley ? genPulley.quaternion.clone() : null;
  function reset() { t = 0; spin.rotation.x = spin0; if (genPulley) genPulley.quaternion.copy(pul0); update(0); }
  return { group: grp, update, reset, wheel: spin, cost: { tris: tri, meshes, ground: gTris }, angle: () => spin.rotation.x };
}
