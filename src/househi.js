// The street houses, MASTER build (2026-11-16; owner: desktop priority, "the desktop version gets its own assets"). Used on the high tier (src/world.js HIHOUSE);
// phones, and ?fx=0, keep the houses in src/world.js until a tested low setting of this builder exists (CONFIG.quality.low.house is null).
// Same footprint, height, colours and openings as the phone house. The walls with their holes stay the phone's (the sim, the hole rule and the collectors go by them);
// this builder makes everything on and around them as modelled parts: window frames in the reveal with plaster liners, stone sills with a drip, casement sashes with glazing bars
// and glass, louvre-free board shutters with braces, panelled double doors with hinges, handles and letter plate, door frames, architraves inside and out, a stone step,
// a roof of single tiles in rows on battens over an underlay (or corrugated sheets on purlins for the felt-coloured roofs) with a ridge of half-round tiles, fascia, soffit,
// barge boards, half-round gutters on brackets, downpipes with swan necks, clips and shoes, a brick chimney laid in courses with cap, flaunching and pots, framed solar modules
// on rails, a chamfered stone plinth, string courses, quoins or corner boards, render cracks and spalled patches, climbing ivy as stems with single leaves, skirting, coving
// and a ceiling light fitting in every room. The approved DESOLATE look (CONFIG.desolate) is built in for every house when DESO.machines is on (the default): bleached walls,
// a sagging ridge, missing and slipped tiles, a hole torn in the roof with battens and rafters showing, broken sashes and panes, glass on the ground, a hanging gutter,
// a broken downpipe, a door hanging off its hinge, grime, rain streaks and moss. Repeated small parts (tiles, sheets, bricks, leaves) are instanced. Numbers: CONFIG.quality.high.house.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { densityOn, Placer, shapes, PROPS, weatherTex, cellUV, dormantSpots } from './density.js';

function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }
const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0), YAX = V(0, 1, 0);

// a box whose texture follows its size (tile metres per repeat), like world.js tbox
function boxG(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, k = 1 / (tile || 1);
  for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4), [a, b] = f < 2 ? [d, h] : f < 4 ? [w, d] : [w, h]; uv.setXY(i, uv.getX(i) * a * k, uv.getY(i) * b * k); }
  return g;
}
// half-round open channel along z (length len, open side up), optional end caps
function halfPipe(len, r, seg, caps) {
  const pos = [], idx = []; for (let j = 0; j <= seg; j++) { const t = PI + PI * j / seg, x = r * Math.cos(t), y = r * Math.sin(t); pos.push(x, y, -len / 2, x, y, len / 2); }
  for (let j = 0; j < seg; j++) { const a = 2 * j; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  if (caps) for (const z of [-len / 2, len / 2]) { const c = pos.length / 3; pos.push(0, 0, z); for (let j = 0; j <= seg; j++) { const t = PI + PI * j / seg; pos.push(r * Math.cos(t), r * Math.sin(t), z); } for (let j = 0; j < seg; j++) idx.push(c, c + 1 + j, c + 2 + j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push(pos[3 * i + 2] * 2, pos[3 * i] * 4); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
// an ivy leaf: stalk at the origin, tip at (0, -1), two side points, the middle cupped toward +z (4 triangles)
function leafGeo() {
  const p = [0, 0, 0, -0.5, -0.38, 0.05, 0, -1, 0, 0.5, -0.38, 0.05, 0, -0.42, 0.09], g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex([4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0]); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 0, 0.6, 0.5, 0, 1, 0.6, 0.5, 0.55], 2)); return g;
}
// corrugated sheet: width w across x, length 1 along z (scaled per instance), n waves of depth dp
function sheetGeo(w, n, dp) {
  const seg = n * 4, pos = [], idx = [], uv = []; for (let j = 0; j <= seg; j++) { const x = -w / 2 + w * j / seg, y = dp / 2 * Math.sin(j / seg * n * 2 * PI); pos.push(x, y, -0.5, x, y, 0.5); uv.push(x, 0, x, 2); }
  for (let j = 0; j < seg; j++) { const a = 2 * j; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// solar module face: dark blue cells with silver bus bars (drawn once)
function pvTex() {
  const c = document.createElement('canvas'); c.width = 192; c.height = 320; const x = c.getContext('2d'); x.fillStyle = '#c8ccd0'; x.fillRect(0, 0, 192, 320);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) { const px = 3 + i * 31.5, py = 3 + j * 31.6, gr = x.createLinearGradient(px, py, px + 30, py + 30); gr.addColorStop(0, '#1b2c55'); gr.addColorStop(1, '#14213f'); x.fillStyle = gr; x.fillRect(px, py, 29.5, 29.6); x.fillStyle = 'rgba(190,200,215,0.55)'; for (const k of [9, 20]) x.fillRect(px + k, py, 1.2, 29.6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// one set of materials and shared shapes per built world (the world frees them with itself). Merged parts take the house's tint through world.js tintM; instanced parts carry their own colour.
function kit(M, tx, HQ) {
  if (M.__hh) return M.__hh;
  const std = (o) => { const m = new THREE.MeshStandardMaterial(o); m.userData.pbr = true; return m; };
  const dm = (name, extra) => new THREE.MeshLambertMaterial(Object.assign({ map: tx(name), transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }, extra || {}));
  const [g0, g1, g2] = HQ.glass, B = HQ.brick;
  const K = {
    trim: std({ map: tx('wood'), roughness: 0.78 }), trimIn: std({ map: tx('wood'), color: 0xe9e4d8, roughness: 0.7 }), stone: std({ map: tx('block'), color: 0xc4bdb0, roughness: 0.95 }),
    timber: std({ map: tx('wood'), color: 0x8c765a, roughness: 0.9 }), under: std({ color: 0x23211e, roughness: 0.95, side: THREE.DoubleSide }), mortar: std({ map: tx('block'), color: 0xa49c90, roughness: 1 }),
    iron: std({ map: tx('rust'), color: 0x55504a, roughness: 0.6, metalness: 0.6 }), rain: std({ map: tx('metal'), color: 0x8a8e90, roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide }),
    lead: std({ map: tx('metal'), color: 0x7a7e84, roughness: 0.55, metalness: 0.35 }), brass: std({ color: 0xa68a52, roughness: 0.32, metalness: 1 }), alu: std({ color: 0xb4b8bc, roughness: 0.35, metalness: 0.9 }),
    glass: std({ color: 0xa6bcbc, roughness: g0, transparent: true, opacity: g1, envMapIntensity: g2, side: THREE.DoubleSide, depthWrite: false }),
    pv: std({ map: pvTex(), roughness: 0.12, metalness: 0.3, envMapIntensity: 1.4 }), pot: std({ map: tx('brick'), color: 0xd08860, roughness: 0.9 }),
    crack: std({ color: 0x2a2520, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), shade: std({ map: tx('fabric'), color: 0xd8c8a0, roughness: 1, side: THREE.DoubleSide }),
    bulb: std({ color: 0xf4efe2, emissive: 0x3a3426, roughness: 0.2 }), puddle: std({ color: 0x2a2c2c, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    tileI: std({ map: tx('tiles'), roughness: 0.72 }), sheetI: std({ map: tx('metal'), roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide }), brickI: std({ map: tx('brick'), roughness: 0.92 }), patch: std({ map: tx('brick'), color: 0x9c8a80, roughness: 0.95 }),
    ridgeI: std({ map: tx('tiles'), roughness: 0.72, side: THREE.DoubleSide }), leafI: std({ roughness: 1, envMapIntensity: 0.35, side: THREE.DoubleSide }), copeI: std({ map: tx('block'), roughness: 0.95 }), mossI: std({ map: tx('moss'), color: 0x9aa070, roughness: 1 }),
    grime: dm('footgrime'), streak: dm('streaks'), moss: dm('moss')
  };
  const [tw, , tl, tt] = HQ.tile, tg = new THREE.BoxGeometry(tw - 0.006, tt, tl); { const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.18, uv.getY(i) * 0.22); const ix = tg.index.array, keep = []; for (const gr of tg.groups) if (gr.materialIndex !== 3 && gr.materialIndex !== 4) for (let k = gr.start; k < gr.start + gr.count; k++) keep.push(ix[k]); tg.setIndex(keep); tg.clearGroups(); } // a tile shows its top, its sides and its lower edge only (8 triangles)
  const bg = new THREE.BoxGeometry(B[0], B[1], B[2]); { const uv = bg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.1, uv.getY(i) * 0.05); }
  K.geo = { tile: tg, brick: bg, ridge: new THREE.CylinderGeometry(HQ.ridge[0], HQ.ridge[0], HQ.ridge[1], 9, 1, true, -PI / 2, PI).rotateX(-PI / 2), leaf: leafGeo(), sheet: sheetGeo(HQ.sheet[0], HQ.sheet[1], HQ.sheet[2]),
    cope: new THREE.BoxGeometry(HQ.coping[0], HQ.coping[1], HQ.coping[2]), moss: new THREE.DodecahedronGeometry(1, 0) };
  M.__hh = K; return K;
}

// build one house's master parts into hg. o: { hg, h, s, look, M, hx (outside wall material), rm (phone roof material), cfg, FH, tx, run, poly (world.js flat polygon), deso }
export function houseHi(o) {
  const { hg, h, s, look, M, hx, cfg, FH, tx, run, poly } = o, HQ = CONFIG.quality.high.house, DT = HQ.detail, DS = cfg.desolate, deso = !!(o.deso && DT.desolate);
  const H = s.H, L = s.L, Ht = L * FH, hw = cfg.openingHalf, K = kit(M, tx, HQ), r = rng(run.seed * 7 + 4099 * (h.i + 1)), tintM = hg.userData.tintM;
  tintM[K.trim.uuid] = look.trim;
  if (deso) look.wall.lerp(new THREE.Color(DS.fadeTo), DS.fade);
  const brickCol = new THREE.Color(0x9a5a44), stoneCol = new THREE.Color(0xc4bdb0), tmpC = new THREE.Color();
  // instanced parts, gathered per (parent, kind) and made into one InstancedMesh each at the end
  const insts = new Map(), inst = (par, kind, m4, col) => { const key = par.uuid + kind; let c = insts.get(key); if (!c) { c = { par, kind, m: [], c: [] }; insts.set(key, c); } c.m.push(...m4.elements); c.c.push(col.r, col.g, col.b); };
  const box = (par, w, hh, d, m, x, y, z, tile, rx, ry, rz) => { const b = new THREE.Mesh(boxG(w, hh, d, tile || 1), m); b.position.set(x, y, z); if (rx || ry || rz) b.rotation.set(rx || 0, ry || 0, rz || 0); par.add(b); return b; };
  // a box from p to q (its length along q - p), its height toward `up`
  const beam = (par, p, q, w, hgt, up, m, tile) => { const z = q.clone().sub(p), len = z.length(); z.normalize(); const x = new THREE.Vector3().crossVectors(up, z).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    const b = new THREE.Mesh(boxG(w, hgt, len, tile || 1), m); b.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); b.position.copy(p).add(q).multiplyScalar(0.5); par.add(b); return b; };
  const rod = (par, p, q, rad, m, sg) => { const d = q.clone().sub(p), len = d.length(), b = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, sg || 10, 1, false), m); b.position.copy(p).addScaledVector(d, 0.5); b.quaternion.setFromUnitVectors(YAX, d.normalize()); par.add(b); return b; };
  // a box laid in a basis (x along a, y along n, z along b) centred at c
  const oriented = (par, w, hgt, d, m, c, a, n, b, tile) => { const o2 = new THREE.Mesh(boxG(w, hgt, d, tile || 1), m); o2.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, n, b)); o2.position.copy(c); par.add(o2); return o2; };

  // ---------------------------------------------------------------- the four walls as frames: x along the wall (u), y up, +z out of the house; the wall's middle plane at z = 0 (outside face z = 0.2, inside face z = -0.2)
  const WF = [['x', H], ['x', -H], ['z', H], ['z', -H]].map(([axis, fix]) => { const g = new THREE.Group(); if (axis === 'x') { g.position.set(0, 0, fix); g.rotation.y = fix > 0 ? 0 : PI; } else { g.position.set(fix, 0, 0); g.rotation.y = fix > 0 ? PI / 2 : -PI / 2; } hg.add(g);
    const uOf = (c) => (axis === 'x' ? (fix > 0 ? c : -c) : (fix > 0 ? -c : c));
    const ops = s.breaches.filter((b) => (axis === 'x' ? Math.abs(b.z - fix) < 0.01 && Math.abs(b.x) < H + 0.01 : Math.abs(b.x - fix) < 0.01 && Math.abs(b.z) < H + 0.01)).map((b) => ({ b, u: uOf(axis === 'x' ? b.x : b.z), f: b.floor, type: b.type, y0: b.type === 'window' || b.type === 'hatch' ? b.floor * FH + 0.9 : b.floor * FH, y1: b.floor * FH + 2.7 }));
    return { g, axis, fix, uOf, ops }; });
  const wfOf = (axis, fix) => WF.find((w) => w.axis === axis && Math.abs(w.fix - fix) < 0.01);
  let roofInfo = null; const DN = densityOn();
  const inOpening = (W, u, y, pad) => W.ops.some((q) => Math.abs(u - q.u) < hw + pad && y > q.y0 - pad && y < q.y1 + pad);
  const [fw, fd] = HQ.frame, [tw2, tt2] = HQ.trim;
  // a lintel over an opening: a soldier course of bricks on brick houses, a stone lintel on the others
  const lintel = (W, u0, top) => { if (look.fin === 1) { const n = Math.round((2 * hw + 0.24) / (HQ.brick[1] + HQ.brick[3])), m4 = new THREE.Matrix4();
      for (let k = 0; k < n; k++) { const x = u0 - (n - 1) / 2 * (HQ.brick[1] + HQ.brick[3]) + k * (HQ.brick[1] + HQ.brick[3]); m4.makeRotationZ(PI / 2); m4.setPosition(x, top + HQ.brick[0] / 2 + 0.005, 0.2 - HQ.brick[2] / 2 + 0.006); inst(W.g, 'brick', m4, tmpC.copy(brickCol).multiplyScalar(0.8 + 0.35 * r())); } }
    else box(W.g, 2 * hw + 0.32, 0.17, 0.05, K.stone, u0, top + 0.085, 0.2 + 0.02, 1.2); };

  // ---------------------------------------------------------------- windows: frame in the reveal, liners, sills, board, architraves, casements, shutters
  function windowAt(oo, axis, fix, f) {
    const W = wfOf(axis, fix), g = W.g, u0 = W.uOf(oo.c), SILL = f * FH + 0.9, TOP = f * FH + 2.7, zf = 0.2 - 0.04 - fd / 2, rr = rng(run.seed + 53 * (oo.i + 7) + 911 * h.i), mid = (SILL + TOP) / 2;
    for (const sd of [-1, 1]) box(g, fw, TOP - SILL, fd, K.trim, u0 + sd * (hw - fw / 2), mid, zf, 1.4);
    box(g, 2 * hw, fw, fd, K.trim, u0, TOP - fw / 2, zf, 1.4); box(g, 2 * hw, 0.05, fd, K.trim, u0, SILL + 0.025, zf, 1.4);
    const ld = 0.4 - 0.04 - fd, lz = -0.2 + ld / 2; for (const sd of [-1, 1]) box(g, 0.014, TOP - SILL, ld, M.int, u0 + sd * (hw - 0.007), mid, lz, 2.6);
    box(g, 2 * hw, 0.014, ld, M.int, u0, TOP - 0.007, lz, 2.6);
    if (DT.interior) { box(g, 2 * hw + 0.14, 0.028, ld + 0.05, K.trimIn, u0, SILL + 0.014, -0.2 + ld / 2 - 0.05 / 2 + 0.0, 1);
      for (const sd of [-1, 1]) box(g, tw2, TOP - SILL + tw2, tt2, K.trimIn, u0 + sd * (hw + tw2 / 2), (SILL + TOP + tw2) / 2, -0.2 - tt2 / 2, 1);
      box(g, 2 * hw + 2 * tw2, tw2, tt2, K.trimIn, u0, TOP + tw2 / 2, -0.2 - tt2 / 2, 1); }
    const [so, st] = HQ.sill, sl = box(g, 2 * hw + 0.22, st, 0.1 + so, K.stone, u0, SILL - st / 2 + 0.004, 0.1 + (0.1 + so) / 2, 1); sl.rotation.x = 0.07; box(g, 2 * hw + 0.22, 0.012, 0.012, K.stone, u0, SILL - st - 0.002, 0.2 + so - 0.03, 1);
    lintel(W, u0, TOP);
    if (DT.sashes) for (const sd of [-1, 1]) { const st2 = deso ? (rr() < HQ.broken[1] ? 'gone' : rr() < HQ.broken[0] ? 'hang' : 'open') : 'open'; if (st2 === 'gone') continue;
      const sw = hw - fw - 0.004, sh = TOP - SILL - fw - 0.05 - 0.006, pv = new THREE.Group(), sc = new THREE.Group(), xs = (x) => -sd * x; pv.position.set(u0 + sd * (hw - fw), SILL + 0.053, 0.16); g.add(pv); pv.add(sc);
      pv.rotation.y = sd * (st2 === 'open' ? 1.1 + 0.45 * rr() : 0.7 + 0.6 * rr());
      if (st2 === 'hang') { sc.position.set(0, sh, 0); sc.rotation.z = sd * (0.18 + 0.2 * rr()); sc.position.y -= 0.04; }
      const y0 = st2 === 'hang' ? -sh : 0, bar = 0.05, th = 0.045;
      for (const x of [bar / 2, sw - bar / 2]) box(sc, bar, sh, th, K.trim, xs(x), y0 + sh / 2, th / 2, 1);
      box(sc, sw - 2 * bar, bar, th, K.trim, xs(sw / 2), y0 + sh - bar / 2, th / 2, 1); box(sc, sw - 2 * bar, 0.07, th, K.trim, xs(sw / 2), y0 + 0.035, th / 2, 1); box(sc, sw - 2 * bar, 0.03, 0.035, K.trim, xs(sw / 2), y0 + sh * 0.52, th / 2, 1);
      const ph = (sh - 0.07 - bar - 0.03) / 2, pw = sw - 2 * bar;
      for (const [pyc, k] of [[y0 + 0.07 + ph / 2, 0], [y0 + sh * 0.52 + 0.015 + ph / 2, 1]]) {
        if (deso && rr() < 0.8) { for (let q = 0; q < 1 + Math.floor(rr() * 2); q++) { const cx = rr() < 0.5 ? -1 : 1, cy = rr() < 0.5 ? -1 : 1, a = 0.12 + 0.2 * rr(), b = 0.12 + 0.3 * rr(), gx = xs(sw / 2) + cx * pw / 2, gy = pyc + cy * ph / 2, tri = new THREE.BufferGeometry();
            tri.setAttribute('position', new THREE.Float32BufferAttribute([gx, gy, th / 2, gx - cx * a, gy, th / 2, gx, gy - cy * b, th / 2], 3)); tri.computeVertexNormals(); sc.add(new THREE.Mesh(tri, K.glass)); } }
        else { const pn = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), K.glass); pn.position.set(xs(sw / 2), pyc, th / 2); sc.add(pn); } void k; }
    }
    if (deso && f === 0) for (let q = 0; q < 5; q++) { const tri = new THREE.BufferGeometry(), a = 0.05 + 0.08 * rr(); tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, a, 0, 0.02, 0.3 * a, 0, a], 3)); tri.computeVertexNormals(); const sm = new THREE.Mesh(tri, K.glass); sm.position.set(u0 + (rr() * 2 - 1) * hw, 0.06, (q % 2 ? 1 : -1) * (0.35 + 0.6 * rr())); sm.rotation.y = rr() * 6; g.add(sm); }
    if (look.shut && DT.shutters) for (const sd of [-1, 1]) { if (rr() < (deso ? 0.35 : 0.2)) continue; const sg = new THREE.Group(), hS = TOP - SILL, wS = 0.52, tilt = deso && rr() < 0.4 ? (rr() - 0.5) * 0.5 : 0;
      sg.position.set(u0 + sd * (hw + tw2 + 0.04 + wS / 2), mid - Math.abs(tilt) * 0.3, 0.2 + 0.016); sg.rotation.z = tilt; g.add(sg);
      for (let k = 0; k < 4; k++) box(sg, wS / 4 - 0.006, hS, 0.022, K.trim, -wS / 2 + (k + 0.5) * wS / 4, 0, 0, 1.4);
      for (const y of [-hS * 0.36, hS * 0.36]) box(sg, wS - 0.04, 0.1, 0.022, K.trim, 0, y, 0.022, 1.4);
      beam(sg, V(-wS / 2 + 0.06, -hS * 0.36 + 0.05, 0.022), V(wS / 2 - 0.06, hS * 0.36 - 0.05, 0.022), 0.022, 0.09, V(0, 0, 1), K.trim, 1.4);
      for (const y of [-hS * 0.36, hS * 0.36]) box(sg, wS * 0.7, 0.03, 0.008, K.iron, -sd * wS * 0.15, y, 0.037, 1); }
    // desolate: one ground-floor window per house had been boarded; one board still hangs from a nail
    if (deso && f === 0 && !W.boarded && rr() < 0.5) { W.boarded = true; const p = new THREE.Group(); p.position.set(u0 - hw - 0.05, SILL + 1.15, 0.2 + 0.03); p.rotation.z = -1.25 - 0.2 * rr(); g.add(p); box(p, 1.5, 0.16, 0.025, M.wood, 0.7, 0, 0, 1); box(p, 0.02, 0.02, 0.03, K.iron, 0.04, 0, 0.012, 1); }
  }

  // ---------------------------------------------------------------- doors: frame, liners, architraves, threshold, step, a pair of panelled leaves (the phone's open angle sets how far the first one swings)
  function leafOf(par, sd, wl, hl, glazed, broken, rr) {
    const xs = (x) => -sd * x, T = 0.05, st = 0.11, ad = (w, hh, d, m, x, y, z) => box(par, w, hh, d, m, xs(x), y, z, 1.4);
    for (const x of [st / 2, wl - st / 2]) ad(st, hl, T, K.trim, x, hl / 2, T / 2);
    const rails = [[0.2, 0.1], [0.16, hl * 0.42], [0.11, hl - 0.055]]; for (const [hh, y] of rails) ad(wl - 2 * st, hh, T, K.trim, wl / 2, y, T / 2);
    const mw = 0.09; ad(mw, hl * 0.42 - 0.08 - 0.2, T, K.trim, wl / 2, (0.2 + hl * 0.42 - 0.08) / 2, T / 2); ad(mw, hl - 0.11 - hl * 0.42 - 0.08, T, K.trim, wl / 2, (hl * 0.42 + 0.08 + hl - 0.11) / 2, T / 2);
    const pw = (wl - 2 * st - mw) / 2, cells = [[0.2, hl * 0.42 - 0.08, false], [hl * 0.42 + 0.08, hl - 0.11, glazed]];
    for (const [ya, yb, gl] of cells) for (const side of [0, 1]) { const x = st + pw / 2 + side * (pw + mw), y = (ya + yb) / 2, ph = yb - ya;
      if (gl) { if (!broken || rr() < 0.3) { const pn = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), K.glass); pn.position.set(xs(x), y, T / 2); par.add(pn); } else { const tri = new THREE.BufferGeometry(), cx = xs(x - pw / 2), a = 0.15 + 0.2 * rr(); tri.setAttribute('position', new THREE.Float32BufferAttribute([cx, ya, T / 2, cx - sd * a, ya, T / 2, cx, ya + 0.3 + 0.3 * rr(), T / 2], 3)); tri.computeVertexNormals(); par.add(new THREE.Mesh(tri, K.glass)); } }
      else { ad(pw, ph, 0.016, K.trim, x, y, T / 2); ad(pw - 0.1, ph - 0.1, 0.034, K.trim, x, y, T / 2); } }
    for (const y of [0.25, hl * 0.5, hl - 0.3]) { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.11, 8), K.iron); kn.position.set(0, y, T / 2); par.add(kn); }
    for (const z of [-0.006, T + 0.006]) { ad(0.045, 0.2, 0.008, K.brass, wl - 0.075, hl * 0.42, z); const lv = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8), K.brass); lv.rotation.z = PI / 2; lv.position.set(xs(wl - 0.11), hl * 0.42 + 0.04, z + (z < 0 ? -0.03 : 0.03)); par.add(lv); }
    ad(wl - 0.06, 0.16, 0.006, K.brass, wl / 2, 0.1, T + 0.003);
  }
  function doorAt(oo, axis, fix, f, ang) {
    const W = wfOf(axis, fix), g = W.g, u0 = W.uOf(oo.c), Y0 = f * FH, TOP = Y0 + 2.7, dfw = 0.09, dfd = 0.13, zf = 0.2 - 0.03 - dfd / 2, rr = rng(run.seed + 71 * (oo.i + 5) + 613 * h.i);
    for (const sd of [-1, 1]) box(g, dfw, TOP - Y0, dfd, K.trim, u0 + sd * (hw - dfw / 2), Y0 + (TOP - Y0) / 2, zf, 1.4);
    box(g, 2 * hw, dfw, dfd, K.trim, u0, TOP - dfw / 2, zf, 1.4);
    const ld = 0.4 - 0.03 - dfd, lz = -0.2 + ld / 2; for (const sd of [-1, 1]) box(g, 0.014, TOP - Y0, ld, M.int, u0 + sd * (hw - 0.007), Y0 + (TOP - Y0) / 2, lz, 2.6); box(g, 2 * hw, 0.014, ld, M.int, u0, TOP - 0.007, lz, 2.6);
    if (look.fin !== 1) { for (const sd of [-1, 1]) box(g, 0.1, TOP - Y0 + 0.1, 0.028, K.trim, u0 + sd * (hw + 0.05), Y0 + (TOP - Y0 + 0.1) / 2, 0.2 + 0.014, 1.4); box(g, 2 * hw + 0.2, 0.1, 0.028, K.trim, u0, TOP + 0.05, 0.2 + 0.014, 1.4); } else lintel(W, u0, TOP);
    if (DT.interior) { for (const sd of [-1, 1]) box(g, tw2, TOP - Y0 + tw2, tt2, K.trimIn, u0 + sd * (hw + tw2 / 2), Y0 + (TOP - Y0 + tw2) / 2, -0.2 - tt2 / 2, 1); box(g, 2 * hw + 2 * tw2, tw2, tt2, K.trimIn, u0, TOP + tw2 / 2, -0.2 - tt2 / 2, 1);
      box(g, 0.08, 0.08, 0.012, K.trimIn, u0 + hw + tw2 + 0.12, Y0 + 1.25, -0.2 - 0.006, 1); }
    box(g, 2 * hw, 0.03, 0.42, K.stone, u0, Y0 + (f === 0 ? 0.065 : 0.015), 0, 1);
    if (f === 0) { const [sh, sdp] = HQ.step; if (deso) { const cut = (rr() - 0.5) * 0.8, E2 = hw + 0.25; box(g, E2 + cut - 0.006, sh, sdp, K.stone, u0 + (-E2 + cut - 0.006) / 2, sh / 2, 0.2 + sdp / 2, 1); box(g, E2 - cut - 0.006, sh, sdp, K.stone, u0 + (cut + 0.006 + E2) / 2, sh / 2 - 0.02, 0.2 + sdp / 2 + 0.02, 1, 0.05, 0.04, -0.03); }
      else box(g, 2 * hw + 0.5, sh, sdp, K.stone, u0, sh / 2, 0.2 + sdp / 2, 1); }
    if (!DT.doors) return; const wl = hw - dfw - 0.006, hl = TOP - Y0 - dfw - 0.05, a1 = 0.55 + 1.6 * (Math.abs(ang) - 0.25), first = ang > 0 ? -1 : 1;
    for (const sd of [-1, 1]) { const pv = new THREE.Group(), lg = new THREE.Group(); pv.position.set(u0 + sd * (hw - dfw), Y0 + 0.045, 0.2 - 0.03); g.add(pv); pv.add(lg);
      const hang = deso && sd !== first && rr() < 0.7; pv.rotation.y = sd * (sd === first ? a1 : 0.3 + 1.0 * rr());
      if (hang) { lg.position.set(0, hl, 0); lg.rotation.z = sd * (0.12 + 0.1 * rr()); lg.position.y -= 0.05; const hold = new THREE.Group(); hold.position.y = -hl; lg.add(hold); leafOf(hold, sd, wl, hl, true, deso, rr); }
      else leafOf(lg, sd, wl, hl, true, deso, rr); }
  }

  // ---------------------------------------------------------------- torn holes: loose bricks jutting from the ragged edge, on both faces
  function tornAt(oo, axis, fix, f, pts) {
    const W = wfOf(axis, fix), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length, rr = rng(run.seed + 37 * (oo.i + 11) + 577 * h.i);
    for (const p of pts) for (let k = 0; k < 2; k++) { const dx = p[0] - cx, dy = p[1] - cy, dl = Math.hypot(dx, dy) || 1, o2 = 0.04 + 0.06 * rr(), u = W.uOf(oo.c + p[0] + dx / dl * o2), y = Math.max(f * FH + 0.08, p[1] + dy / dl * o2), z = (k ? 1 : -1) * (0.08 + 0.08 * rr());
      e.set((rr() - 0.5) * 0.4, (rr() - 0.5) * 0.6, Math.atan2(dy, dx) + PI / 2 + (rr() - 0.5) * 0.5); q.setFromEuler(e); m4.compose(V(u, y, z), q, V(0.7 + 0.5 * rr(), 1, 1)); inst(W.g, 'brick', m4, tmpC.copy(brickCol).multiplyScalar(0.75 + 0.4 * rr())); }
  }

  // ---------------------------------------------------------------- the ceiling light in a room (replaces the phone's cone)
  function lampAt(f) {
    const c = (f + 1) * FH, g = new THREE.Group(); g.position.set(0, c, 0); hg.add(g); const add = (geo, m, y) => { const q = new THREE.Mesh(geo, m); q.position.y = y; g.add(q); return q; };
    add(new THREE.CylinderGeometry(0.075, 0.085, 0.025, 18), K.trimIn, -0.0125); add(new THREE.CylinderGeometry(0.004, 0.004, 0.45, 5), K.iron, -0.25); add(new THREE.CylinderGeometry(0.018, 0.02, 0.07, 12), K.brass, -0.5);
    const sh = add(new THREE.LatheGeometry([V(0.035, 0, 0), V(0.07, -0.03, 0), V(0.2, -0.17, 0), V(0.26, -0.25, 0), V(0.265, -0.262, 0)], 20), K.shade, -0.48); add(new THREE.SphereGeometry(0.032, 12, 8), K.bulb, -0.57);
    if (deso && r() < 0.5) { sh.rotation.z = 0.25 + 0.2 * r(); sh.position.x = 0.03; }
  }

  // ---------------------------------------------------------------- outside walls: plinth, string courses, quoins or corner boards, cracks, spalled patches, grime, ivy; inside: skirting and coving
  function walls() {
    const [ph, po] = HQ.plinth, R = H + 0.2;
    for (const W of WF) {
      if (DT.plinth) { const cuts = W.ops.filter((q) => q.f === 0 && q.type !== 'window' && q.type !== 'hatch').map((q) => q.u).sort((a, b) => a - b); let a0 = -R - po;
        const seg = (a, b) => { if (b - a < 0.15) return; const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(po, 0); sh.lineTo(po, ph - 0.08); sh.lineTo(0, ph); sh.lineTo(0, 0); const geo = new THREE.ExtrudeGeometry(sh, { depth: b - a, bevelEnabled: false }); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.3, uv.getY(i) / 1.3); geo.rotateY(-PI / 2); geo.translate(b, 0, 0.2); W.g.add(new THREE.Mesh(geo, K.stone)); };
        for (const u of cuts) { seg(a0, u - hw - 0.05); a0 = u + hw + 0.05; } seg(a0, R + po); }
      for (let f = 1; f < L; f++) box(W.g, 2 * R + 2 * HQ.band[1], HQ.band[0], HQ.band[1] + 0.01, K.stone, 0, f * FH, 0.2 + HQ.band[1] / 2 - 0.005, 1.3);
      if (look.fin === 0 && DT.quoins) { const [ql, qs, qh, qp] = HQ.quoin, wi = WF.indexOf(W); for (let k = 0, y = ph + 0.02; y + qh < Ht + 0.2; k++, y += qh + 0.025) for (const end of [-1, 1]) { const len = ((k + wi + (end > 0 ? 1 : 0)) % 2 ? ql : qs) + qp, u = end * (R + qp - len / 2); if (!inOpening(W, u, y + qh / 2, 0.05)) box(W.g, len, qh, qp + 0.01, K.stone, u, y + qh / 2, 0.2 + qp / 2 - 0.005, 1.3); } }
      if (look.fin === 2) for (const end of [-1, 1]) box(W.g, 0.14, Ht + 0.2, 0.03, K.trim, end * (R - 0.07 + 0.03), (Ht + 0.2) / 2, 0.2 + 0.015, 1.4);
      if (DT.cracks && look.fin !== 2) { const pos = [], nC = Math.round(HQ.cracks * (deso ? 1 : 0.4) * (look.fin === 1 ? 0.5 : 1));
        const crack = (u, y, ang, len, w0) => { let pu = u, py = y, a = ang; const n = Math.max(3, Math.round(len / 0.09)); for (let k = 0; k < n; k++) { const st = 0.06 + 0.06 * r(); a += (r() - 0.5) * 0.9; const nu = pu + Math.sin(a) * st, ny = py + Math.cos(a) * st, w = w0 * (1 - k / n) + 0.0012, nx = -Math.cos(a) * w, nyv = Math.sin(a) * w, w2 = w0 * (1 - (k + 1) / n) + 0.0012, nx2 = -Math.cos(a) * w2, ny2 = Math.sin(a) * w2, z = 0.2 + 0.0025;
            if (inOpening(W, nu, ny, 0.02) || Math.abs(nu) > R - 0.05 || ny < ph + 0.02 || ny > Ht) break; pos.push(pu - nx, py - nyv, z, pu + nx, py + nyv, z, nu + nx2, ny + ny2, z, pu - nx, py - nyv, z, nu + nx2, ny + ny2, z, nu - nx2, ny - ny2, z); if (k === Math.floor(n / 2) && r() < 0.6) crack(nu, ny, a + (r() < 0.5 ? 0.8 : -0.8), len * 0.4, w * 0.7); pu = nu; py = ny; } };
        for (const q of W.ops) for (const sd of [-1, 1]) for (const top of [true, false]) { if (q.type !== 'window' && !top) continue; if (r() > (deso ? 0.45 : 0.18)) continue; crack(q.u + sd * (hw + 0.02), top ? q.y1 + 0.02 : q.y0 - 0.02, (top ? 0 : PI) + sd * (0.4 + 0.4 * r()), 0.5 + 0.9 * r(), 0.006); }
        for (let k = 0; k < nC; k++) crack((r() * 2 - 1) * (R - 0.6), ph + 0.3 + r() * (Ht - 1.2), (r() - 0.5) * 2.4 + (r() < 0.5 ? 0 : PI), 0.4 + 1.0 * r(), 0.005);
        if (pos.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); W.g.add(new THREE.Mesh(geo, K.crack)); } }
    }
    // spalled render: the plaster has dropped off, the brick shows, a raised rim of render around it (plaster and block houses)
    if (DT.cracks && (look.fin === 0 || look.fin === 3)) for (let k = 0, n = deso ? HQ.patches : 1; k < n; k++) { for (let t = 0; t < 10; t++) { const W = WF[Math.floor(r() * 4)], u = (r() * 2 - 1) * (H - 1), y = 1.0 + r() * (Ht - 2.0), rx = 0.22 + 0.3 * r(), ry = 0.16 + 0.2 * r();
        if (inOpening(W, u, y, Math.max(rx, ry) + 0.15)) continue; const pts = []; for (let j = 0; j < 14; j++) { const a = j / 14 * 2 * PI, q = 0.7 + 0.3 * r(); pts.push(new THREE.Vector2(Math.cos(a) * rx * q, Math.sin(a) * ry * q)); }
        const inner = new THREE.Shape(pts), bg = new THREE.ShapeGeometry(inner), uv = bg.attributes.uv, P = bg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (P.getX(i) + u) / 2.6, (P.getY(i) + y) / 2.6); const bm = new THREE.Mesh(bg, K.patch); bm.position.set(u, y, 0.2 + 0.0015); W.g.add(bm);
        const outer = new THREE.Shape(pts.map((p) => p.clone().multiplyScalar(1.0 + 0.04 / Math.max(0.15, p.length())))), hole = new THREE.Path(pts.slice().reverse()); outer.holes.push(hole); const rg = new THREE.ExtrudeGeometry(outer, { depth: 0.018, bevelEnabled: false }), uv2 = rg.attributes.uv; for (let i = 0; i < uv2.count; i++) uv2.setXY(i, uv2.getX(i) / 2.6, uv2.getY(i) / 2.6);
        const rm2 = new THREE.Mesh(rg, hx); rm2.position.set(u, y, 0.2); W.g.add(rm2); break; } }
    if (deso) for (const W of WF) { // grime rising above the plinth, rain streaks under the sills and the eaves, moss low down
      const plane = (m, u, y, w, hh) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), m); p.position.set(u, y + hh / 2, 0.2 + 0.006); W.g.add(p); };
      for (let u = -H + 0.6; u < H; u += 1.9 + r() * 0.6) if (!inOpening(W, u, 0.6, 0.3)) plane(K.grime, u, ph - 0.05, 2.0, 0.5 + 0.3 * r());
      for (const q of W.ops) if (q.type === 'window') plane(K.streak, q.u, q.y0 - 0.95, 1.1, 0.85);
      for (let k = 0; k < 2; k++) { const u = (r() * 2 - 1) * (H - 0.8); if (!inOpening(W, u, Ht - 0.7, 0.4)) plane(K.streak, u, Ht - 1.3, 0.9, 1.25); }
      for (let k = 0; k < 2; k++) { const u = (r() * 2 - 1) * (H - 0.6); if (!inOpening(W, u, 0.8, 0.5)) plane(K.moss, u, ph + 0.02, 0.7 + r() * 0.8, 0.4 + r() * 0.4); } }
    if (DT.interior) for (let f = 0; f < L; f++) for (const W of WF) { const y0 = f * FH + (f === 0 ? 0.05 : 0), cuts = W.ops.filter((q) => q.f === f && (q.type === 'door' || q.type === 'gap')).map((q) => q.u).sort((a, b) => a - b), Ri = H - 0.2; let a0 = -Ri;
      const seg = (a, b) => { if (b - a < 0.1) return; box(W.g, b - a, HQ.skirt, 0.018, K.trimIn, (a + b) / 2, y0 + HQ.skirt / 2, -0.2 - 0.009, 1); };
      for (const u of cuts) { seg(a0, u - hw - tw2); a0 = u + hw + tw2; } seg(a0, Ri);
      box(W.g, 2 * Ri, 0.075, 0.075, K.trimIn, 0, (f + 1) * FH - 0.0, -0.2, 1, PI / 4); }
    if (DT.ivy) ivy();
  }

  // ---------------------------------------------------------------- ivy: stems climbing from the ground (round the openings, not over them) and hanging from the eaves, single leaves in layers
  function ivy() {
    const [patches, perPatch, size] = HQ.ivy, n = deso ? patches : 1, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    for (let pi = 0; pi < n + (deso ? 1 : 0); pi++) {
      const W = WF[Math.floor(r() * 4)], hanging = pi >= n, R = H + 0.2, ub = hanging ? (r() * 2 - 1) * (H - 1.5) : (r() < 0.5 ? -1 : 1) * (H - 0.5 - r() * 2.4), stems = [], pts0 = [];
      const grow = (u, y, a, steps, depth) => { const line = [V(u, y, 0.2 + 0.012)]; for (let k = 0; k < steps; k++) { a += (r() - 0.5) * 0.5; a = a * 0.92 + (hanging ? PI : 0) * 0.08; const nu = u + Math.sin(a) * 0.1, ny = y + Math.cos(a) * 0.1;
          if (Math.abs(nu) > R - 0.05 || ny < 0.02 || ny > Ht + 0.15 || inOpening(W, nu, ny, 0.06)) break; u = nu; y = ny; line.push(V(u, y, 0.2 + 0.012)); pts0.push([u, y]); if (depth < 2 && r() < 0.14) stems.push([u, y, a + (r() < 0.5 ? 1 : -1) * (0.6 + 0.6 * r()), 6 + Math.floor(r() * 16), depth + 1]); }
        if (line.length > 3 && depth === 0) { const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line), Math.min(40, line.length), 0.011, 4, false); W.g.add(new THREE.Mesh(tube, M.bark)); } };
      if (hanging) for (let k = 0; k < 4; k++) stems.push([ub + (r() - 0.5) * 1.6, Ht + 0.1, PI + (r() - 0.5) * 0.4, 6 + Math.floor(r() * 12), 1]);
      else for (let k = 0; k < 3; k++) stems.push([ub + (r() - 0.5) * 0.9, 0.05, (r() - 0.5) * 0.5, Math.floor((Ht * (0.55 + 0.45 * r())) / 0.1), 0]);
      for (let k = 0; k < stems.length && k < 40; k++) grow(...stems[k]);
      const want = hanging ? perPatch * 0.3 : perPatch; for (let k = 0; k < want && pts0.length; k++) { const [u0, y0] = pts0[Math.floor(r() * pts0.length)], u = u0 + (r() - 0.5) * 0.26, y = y0 + (r() - 0.5) * 0.14; if (inOpening(W, u, y, 0.02) || Math.abs(u) > R) continue;
        const layer = Math.floor(r() * 3), sz = size * (0.6 + 0.7 * r()); e.set(-(0.25 + 0.7 * r()), 0, (r() - 0.5) * 1.4, 'ZXY'); q.setFromEuler(e); m4.compose(V(u, y, 0.2 + 0.012 + layer * 0.028), q, V(sz, sz, sz));
        col.setHSL(0.25 + 0.07 * r(), 0.4 + 0.25 * r(), 0.14 + 0.14 * r(), THREE.SRGBColorSpace); if (deso && r() < 0.06) col.setHSL(0.1 + 0.04 * r(), 0.45, 0.22 + 0.1 * r(), THREE.SRGBColorSpace); inst(W.g, 'leaf', m4, col); } }
  }

  // ---------------------------------------------------------------- the roof (in rg: -z looks at the street). Returns the roof's top height.
  function roof(rg, e, Wo, Wv, pt, d0) {
    const RG = new THREE.Group(); rg.add(RG); const kind = look.roof, slate = look.cover !== 1 && kind === 1, tiles = (look.cover === 1 || slate) && DT.tiles, [tw, tg, tl, tt] = HQ.tile, [fh, ft] = HQ.fascia, [gr, gsp] = HQ.gutter, pr = HQ.pipe, rr = rng(run.seed * 3 + 1301 * (h.i + 1));
    const slopes = []; let top = e, rh = 0;
    const tileC = look.top.clone().multiplyScalar(slate ? 0.5 : 1), m4 = new THREE.Matrix4(), rot = new THREE.Matrix4();
    if (kind === 0) { rh = Wv * Math.tan(pt); top = e + rh; const S = Math.hypot(Wv, rh), sn = rh / S, cs = Wv / S;
      slopes.push({ P0: V(0, e, -Wv), b: V(0, sn, cs), n: V(0, cs, -sn), S, uR: () => [-Wv, Wv], street: true, eave: true }, { P0: V(0, e, Wv), b: V(0, sn, -cs), n: V(0, cs, sn), S, uR: () => [-Wv, Wv], eave: true });
      const y1 = rh * look.over / Wv; for (const sx of [-1, 1]) poly([[sx * Wo, e, -Wo], [sx * Wo, e, Wo], [sx * Wo, e + y1, Wo], [sx * Wo, e + rh, 0], [sx * Wo, e + y1, -Wo]], hx, RG, CONFIG.world.wallTile, [sx, 0, 0]); }
    else if (kind === 1) { rh = Wv * Math.tan(pt * 0.85); top = e + rh; const S = Math.hypot(Wv, rh), sn = rh / S, cs = Wv / S;
      for (let k = 0; k < 4; k++) { const th = k * PI / 2, ro = (v) => v.applyAxisAngle(UP, th); slopes.push({ P0: ro(V(0, e, -Wv)), b: ro(V(0, sn, cs)), n: ro(V(0, cs, -sn)), S, uR: (v) => { const hh = Wv * (1 - v / S); return [-hh, hh]; }, street: k === 0, side: k === 1, back: k === 2, eave: true, hip: true }); } }
    else if (kind === 2) { const t2 = Math.tan(pt * 0.42), ya = 0.15 + look.over * t2, yb = 0.15 + (Wv + Wo) * t2, S = 2 * Wv / Math.cos(pt * 0.42), sn = Math.sin(pt * 0.42), cs = Math.cos(pt * 0.42); top = e + yb;
      slopes.push({ P0: V(0, e + 0.15, -Wv), b: V(0, sn, cs), n: V(0, cs, -sn), S, uR: () => [-Wv, Wv], street: true, eave: true, mono: true });
      for (const sx of [-1, 1]) poly([[sx * Wo, e, -Wo], [sx * Wo, e, Wo], [sx * Wo, e + yb, Wo], [sx * Wo, e + ya, -Wo]], hx, RG, CONFIG.world.wallTile, [sx, 0, 0]);
      poly([[-Wo, e, Wo], [Wo, e, Wo], [Wo, e + yb, Wo], [-Wo, e + yb, Wo]], hx, RG, CONFIG.world.wallTile, [0, 0, 1]); poly([[-Wo, e, -Wo], [Wo, e, -Wo], [Wo, e + ya, -Wo], [-Wo, e + ya, -Wo]], hx, RG, CONFIG.world.wallTile, [0, 0, -1]); }
    const SAG = deso && kind < 3 ? DS.sag : 0, sagDy = (x, y, z) => { if (!SAG) return 0; const a = Math.max(0, 1 - (x / (Wv + 0.4)) ** 2), b = Math.max(0, 1 - (z / (Wv + 0.4)) ** 2), f = Math.min(1, Math.max(0, (y - e) / Math.max(0.3, top - e))); return -SAG * a * b * f; };
    const holeOn = deso ? (slopes.find((q) => q.side) || slopes.find((q) => q.street)) : null;
    if (holeOn) { const [hu, hv] = HQ.hole, [hu0, hv0] = HQ.holeAt, [ua, ub] = holeOn.uR(hv0 * holeOn.S); holeOn.hole = { u: ua + (ub - ua) * hu0, v: hv0 * holeOn.S, hu, hv }; }
    const inHole = (sl, u, v, jit) => { const H2 = sl.hole; if (!H2) return false; const d = ((u - H2.u) / H2.hu) ** 2 + ((v - H2.v) / H2.hv) ** 2; return d < 1 + (jit || 0); };
    const at = (sl, u, v, off) => { const a = new THREE.Vector3().crossVectors(sl.n, sl.b); return sl.P0.clone().addScaledVector(a, u).addScaledVector(sl.b, v).addScaledVector(sl.n, off); };
    for (const sl of slopes) {
      const a = new THREE.Vector3().crossVectors(sl.n, sl.b); sl.a = a;
      // underlay over the rafters (dark felt), cut where the roof is holed
      { const pos = [], nv = Math.ceil(sl.S / 0.5), nu = 24; for (let j = 0; j < nv; j++) { const v0 = j * sl.S / nv, v1 = (j + 1) * sl.S / nv, [a0, b0] = sl.uR(v0), [a1, b1] = sl.uR(v1);
          for (let i = 0; i < nu; i++) { const ua0 = a0 + (b0 - a0) * i / nu, ua1 = a0 + (b0 - a0) * (i + 1) / nu, ub0 = a1 + (b1 - a1) * i / nu, ub1 = a1 + (b1 - a1) * (i + 1) / nu; if (inHole(sl, (ua0 + ub1) / 2, (v0 + v1) / 2, -0.25)) continue;
            const p = [at(sl, ua0, v0, 0), at(sl, ua1, v0, 0), at(sl, ub1, v1, 0), at(sl, ub0, v1, 0)]; for (const k of [0, 1, 2, 0, 2, 3]) pos.push(p[k].x, p[k].y, p[k].z); } }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); const uvs = []; for (let i = 0; i < pos.length / 3; i++) uvs.push(pos[3 * i] / 2, pos[3 * i + 2] / 2); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        RG.add(new THREE.Mesh(geo, tiles || look.cover !== 1 ? K.under : o.rm)); }
      if ((look.cover === 1 || slate) && !tiles) continue;
      // battens (tiles) or purlins (sheets) across the slope; broken where the hole is
      const step = tiles ? tg : 0.95, bw = tiles ? HQ.batten[0] : 0.1, bh = tiles ? HQ.batten[1] : 0.06;
      for (let v = tiles ? tl - 0.09 : 0.3; v < sl.S - 0.05; v += step) { const [u0, u1] = sl.uR(v); if (u1 - u0 < 0.1) continue; const runs = []; if (sl.hole && Math.abs(v - sl.hole.v) < sl.hole.hv) { const w = sl.hole.hu * Math.sqrt(1 - ((v - sl.hole.v) / sl.hole.hv) ** 2) * (0.5 + 0.5 * rr()); runs.push([u0, sl.hole.u - w], [sl.hole.u + w * (0.4 + 0.6 * rr()), u1]); } else runs.push([u0, u1]);
        for (const [p0, p1] of runs) if (p1 - p0 > 0.05) oriented(RG, p1 - p0, bh, bw, K.timber, at(sl, (p0 + p1) / 2, v, bh / 2), a, sl.n, sl.b, 1.2); }
      if (sl.hole) { const H2 = sl.hole; for (const du of [-0.42, 0.18]) { const p = at(sl, H2.u + du, H2.v - H2.hv - 0.4, -0.08), q = at(sl, H2.u + du, H2.v + H2.hv + 0.4, -0.08); if (du > 0) q.copy(at(sl, H2.u + du, H2.v + 0.1, -0.5)); beam(RG, p, q, 0.05, 0.15, sl.n, K.timber, 1.2); } }
      if (tiles) { // single tiles in rows, each lapped over the one below; cut tiles at verges and hips; desolate: moss, missing and slipped tiles
        const lap = HQ.lap, bp = sl.b.clone().multiplyScalar(Math.cos(lap)).addScaledVector(sl.n, -Math.sin(lap)), np = sl.n.clone().multiplyScalar(Math.cos(lap)).addScaledVector(sl.b, Math.sin(lap)), base = new THREE.Matrix4().makeBasis(a, np, bp);
        const rows = Math.ceil((sl.S + 0.06) / tg); for (let k = 0; k < rows; k++) { const v = k * tg - 0.06, len = Math.min(tl, sl.S - v + 0.04); if (len < 0.08) continue; const [u0, u1] = sl.uR(Math.min(sl.S, v + len * 0.35)), stg = (k % 2) * tw * 0.5; if (u1 - u0 < 0.06) continue;
          for (let j = Math.floor((u0 - stg) / tw); ; j++) { let c0 = stg + j * tw, c1 = c0 + tw; if (c0 >= u1) break; if (c1 <= u0) continue; c0 = Math.max(c0, u0); c1 = Math.min(c1, u1); if (c1 - c0 < 0.04) continue; const uc = (c0 + c1) / 2;
            if (inHole(sl, uc, v + len / 2, (rr() - 0.5) * 0.7)) continue; if (deso && rr() < HQ.missing * (sl.hole && inHole(sl, uc, v + len / 2, 2.5) ? 6 : 1)) continue;
            let dv = 0, yaw = (rr() - 0.5) * 0.05; if (deso && rr() < HQ.slipped) { dv = -(0.08 + 0.2 * rr()); yaw += (rr() - 0.5) * 0.7; }
            const p = at(sl, uc + (rr() - 0.5) * 0.006, v + len / 2 + dv, HQ.batten[1] + tt / 2 + 0.004 + len / 2 * Math.sin(lap) + (dv ? 0.02 : 0)); p.y += sagDy(p.x, p.y, p.z);
            m4.copy(base).multiply(rot.makeRotationY(yaw)).scale(V((c1 - c0) / tw, 1, len / tl)); m4.setPosition(p);
            tmpC.copy(tileC).multiplyScalar(1 + (rr() - 0.5) * HQ.tileVar); if (rr() < (deso ? 0.1 + 0.3 * (1 - v / sl.S) : 0.03)) tmpC.lerp(new THREE.Color(0x56603a), 0.3 + 0.4 * rr()); inst(rg, 'tile', m4, tmpC); } } }
      else { // corrugated sheets in columns and rows, end laps, on purlins; desolate: lifted, missing
        const [sw, , sdp, sL] = HQ.sheet, cw = sw - 0.08, rl = sL - 0.15; for (let v = -0.06; v < sl.S - 0.05; v += rl) { const len = Math.min(sL, sl.S - v + 0.03), [u0, u1] = sl.uR(Math.min(sl.S, v + len * 0.4)); if (u1 - u0 < 0.1) continue;
          for (let c0 = u0; c0 < u1 - 0.05; c0 += cw) { const c1 = Math.min(u1, c0 + sw), uc = (c0 + c1) / 2; if (inHole(sl, uc, v + len / 2, 0.2)) continue; if (deso && rr() < HQ.missing * 0.8) continue;
            const lift = deso && rr() < 0.12 ? 0.1 + 0.25 * rr() : 0.012, bp = sl.b.clone().multiplyScalar(Math.cos(lift)).addScaledVector(sl.n, -Math.sin(lift)), np = sl.n.clone().multiplyScalar(Math.cos(lift)).addScaledVector(sl.b, Math.sin(lift));
            const p = at(sl, uc, v + len / 2, 0.06 + sdp / 2 + len / 2 * Math.sin(lift)); p.y += sagDy(p.x, p.y, p.z); m4.makeBasis(a, np, bp).scale(V((c1 - c0) / sw, 1, len)); m4.setPosition(p);
            tmpC.copy(tileC).multiplyScalar(0.85 + 0.3 * rr()); inst(rg, 'sheet', m4, tmpC); } } }
      // eaves: fascia, soffit, gutter on brackets, a downpipe with a swan neck down the wall
      if (DT.gutters && sl.eave) { const out = V(-sl.b.x, 0, -sl.b.z).normalize(), [u0, u1] = sl.uR(0), len = u1 - u0, P = sl.P0, over = Wv - Wo, ex = sl.hip ? ft + 2 * gr + 0.012 : 0.04;
        beam(RG, P.clone().addScaledVector(a, u0 - (sl.hip ? ft : 0.03)).addScaledVector(out, ft / 2).add(V(0, 0.03 - fh / 2, 0)), P.clone().addScaledVector(a, u1 + (sl.hip ? ft : 0.03)).addScaledVector(out, ft / 2).add(V(0, 0.03 - fh / 2, 0)), ft, fh, UP, K.trim, 1.4);
        beam(RG, P.clone().addScaledVector(a, u0 + (sl.hip ? over : 0)).addScaledVector(out, -over / 2).add(V(0, 0.03 - fh + 0.008, 0)), P.clone().addScaledVector(a, u1 - (sl.hip ? over : 0)).addScaledVector(out, -over / 2).add(V(0, 0.03 - fh + 0.008, 0)), over, 0.016, UP, K.trim, 1.4);
        const gc = (u) => P.clone().addScaledVector(a, u).addScaledVector(out, ft + gr + 0.012).add(V(0, -0.055, 0)), hangG = deso && sl.street, cut = u1 - 2.2 - 1.2 * rr();
        const gut = (p, q, caps) => { const z = q.clone().sub(p), l = z.length(); z.normalize(); const x = new THREE.Vector3().crossVectors(UP, z).normalize(), y = new THREE.Vector3().crossVectors(z, x), m = new THREE.Mesh(halfPipe(l, gr, 8, caps), K.rain); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); m.position.copy(p).add(q).multiplyScalar(0.5); RG.add(m); };
        if (hangG) { gut(gc(u0 - ex), gc(cut), true); const hp = gc(cut + 0.02), far = gc(cut + 0.02), dl = u1 + ex - cut, ang = 0.75 + 0.35 * rr(); far.addScaledVector(a, dl * Math.cos(ang)); far.y -= dl * Math.sin(ang); far.addScaledVector(out, 0.18); gut(hp, far, false); }
        else gut(gc(u0 - ex), gc(u1 + ex), !sl.hip);
        for (let u = u0 + 0.3; u < u1 - 0.2; u += gsp) { if (hangG && u > cut) continue; const c = gc(u); beam(RG, c.clone().addScaledVector(out, -gr - 0.02).add(V(0, -gr - 0.006, 0)), c.clone().addScaledVector(out, gr * 0.6).add(V(0, -gr * 0.4, 0)), 0.03, 0.012, UP, K.iron, 1); }
        const pipes = sl.mono ? [u0 + 0.35, u1 - 0.35] : sl.hip && !sl.street && !sl.back ? [] : [u1 - 0.35];
        for (const [pk, pu] of pipes.entries()) { if (hangG && pu > cut) continue; const g0 = gc(pu).add(V(0, -gr, 0)), wallP = P.clone().addScaledVector(a, pu).addScaledVector(out, -(over - 0.1 - pr)), g1 = g0.clone().add(V(0, -0.12, 0)), dz = g1.clone().sub(wallP).setY(0).length(), w1 = wallP.clone().setY(g1.y - dz);
          const brk = deso && pk === 0 && sl.street ? 0.9 + 1.4 * rr() : 0; rod(RG, g0, g1, pr, K.rain); rod(RG, g1, w1, pr, K.rain); const bot = V(w1.x, brk || 0.16, w1.z); rod(RG, w1, bot, pr, K.rain);
          for (let y = w1.y - 0.4; y > bot.y + 0.1; y -= 1.6) { const c = V(w1.x, y, w1.z); rod(RG, c.clone().add(V(0, -0.025, 0)), c.clone().add(V(0, 0.025, 0)), pr + 0.008, K.iron, 10); }
          if (brk) { const lyA = V(w1.x, 0.05, w1.z).addScaledVector(out, 0.5).addScaledVector(a, 0.3), lyB = lyA.clone().addScaledVector(a, -(brk - 0.3)).addScaledVector(out, 0.4); lyB.y = 0.05; rod(RG, lyA, lyB, pr, K.rain); }
          else rod(RG, bot, bot.clone().addScaledVector(out, 0.14).add(V(0, -0.11, 0)), pr, K.rain); } }
      // verges: barge boards up the gable and mono edges
      if (!sl.hip && DT.gutters) for (const sx of [-1, 1]) { const [u0, u1] = sl.uR(0), u = sx < 0 ? u0 - ft / 2 - 0.01 : u1 + ft / 2 + 0.01; beam(RG, at(sl, u, -0.04, 0.05 - fh / 2), at(sl, u, sl.S + (sl.mono ? 0.05 : 0), 0.05 - fh / 2), ft, fh, sl.n, K.trim, 1.4); }
    }
    // ridges: half-round tiles on a mortar bed (tiles) or a bent capping (sheets)
    const ridgeLine = (p, q) => { const d = q.clone().sub(p), len = d.length(); d.normalize(); const X = new THREE.Vector3().crossVectors(UP, d).normalize(), Y = new THREE.Vector3().crossVectors(d, X), n = Math.ceil(len / (HQ.ridge[1] - 0.02));
      if (tiles) { beam(RG, p.clone().add(V(0, -0.005, 0)), q.clone().add(V(0, -0.005, 0)), 0.26, 0.07, UP, K.mortar, 1); for (let k = 0; k < n; k++) { if (deso && rr() < HQ.missing * 0.6) continue; const c = p.clone().addScaledVector(d, (k + 0.5) * len / n).addScaledVector(Y, 0.012); c.y += sagDy(c.x, c.y, c.z); m4.makeBasis(X, Y, d).multiply(rot.makeRotationZ((rr() - 0.5) * 0.06)).scale(V(1, 1, (len / n + 0.02) / HQ.ridge[1])); m4.setPosition(c); inst(rg, 'ridge', m4, tmpC.copy(tileC).multiplyScalar(0.9 + 0.15 * rr())); } }
      else for (const sx of [-1, 1]) { const off = X.clone().multiplyScalar(sx * 0.1).addScaledVector(Y, 0.06); beam(RG, p.clone().add(off), q.clone().add(off), 0.2, 0.012, Y.clone().addScaledVector(X, -sx * 0.5).normalize(), K.lead, 1); } };
    if (kind === 0) ridgeLine(V(-Wv - 0.03, top, 0), V(Wv + 0.03, top, 0));
    else if (kind === 1) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ridgeLine(V(sx * Wv, e + 0.02, sz * Wv), V(0, top, 0));
    else if (kind === 2) { const sl = slopes[0]; beam(RG, at(sl, -Wv - 0.05, sl.S - 0.06, 0.1), at(sl, Wv + 0.05, sl.S - 0.06, 0.1), 0.24, 0.025, sl.n, K.lead, 1); }
    else { // flat roof: parapet with coping stones, a cornice under it, the membrane in lapped strips with puddles, a scupper and its pipe
      const ph = look.par; top = e + ph;
      for (const sz of [-1, 1]) { const pa = new THREE.Mesh(boxG(2 * Wo, ph, 0.25, CONFIG.world.wallTile), hx), pb = new THREE.Mesh(boxG(0.25, ph, 2 * Wo - 0.5, CONFIG.world.wallTile), hx); pa.position.set(0, e + ph / 2, sz * (Wo - 0.125)); pb.position.set(sz * (Wo - 0.125), e + ph / 2, 0); rg.add(pa, pb); }
      const [cl, ch, cd] = HQ.coping, q4 = new THREE.Quaternion(); for (let sd = 0; sd < 4; sd++) { const th = sd * PI / 2; for (let u = -Wo + cl / 2; u < Wo - 0.05; u += cl + 0.006) { if (deso && rr() < 0.04) continue; const tilt = deso && rr() < 0.08 ? (rr() - 0.5) * 0.2 : 0, p = V(u, e + ph + ch / 2, -(Wo - 0.125)).applyAxisAngle(UP, th);
          q4.setFromEuler(new THREE.Euler(tilt, th + (rr() - 0.5) * 0.02, 0, 'YXZ')); m4.compose(p, q4, V(1, 1, 1)); inst(rg, 'cope', m4, tmpC.copy(stoneCol).multiplyScalar(0.85 + 0.2 * rr())); } }
      for (let sd = 0; sd < 4; sd++) { const th = sd * PI / 2; const c = new THREE.Mesh(boxG(2 * Wo + 0.24, 0.2, 0.12, 1.3), K.stone); c.position.copy(V(0, e - 0.12, -(Wo + 0.06)).applyAxisAngle(UP, th)); c.rotation.y = th; rg.add(c); }
      for (let x = -Wo + 0.25 + 0.5; x < Wo - 0.25; x += 0.96) box(rg, 1.0, 0.008, 2 * Wo - 0.5, K.under, x, e + 0.004, 0, 2);
      for (let k = 0; k < 3; k++) { const pts = []; const rx = 0.5 + r() * 0.9, rz = 0.4 + r() * 0.6; for (let j = 0; j < 12; j++) { const a2 = j / 12 * 2 * PI, q = 0.75 + 0.25 * r(); pts.push(new THREE.Vector2(Math.cos(a2) * rx * q, Math.sin(a2) * rz * q)); } const pm = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), K.puddle); pm.rotation.x = -PI / 2; pm.position.set((r() * 2 - 1) * (Wo - 1.5), e + 0.011, (r() * 2 - 1) * (Wo - 1.5)); rg.add(pm); }
      { const sp = V(Wo * 0.6, e + 0.06, -Wo); box(rg, 0.22, 0.1, 0.4, K.lead, sp.x, sp.y, sp.z + 0.05, 1); const hd = V(sp.x, e - 0.1, -Wo - 0.18); box(rg, 0.3, 0.26, 0.24, K.rain, hd.x, hd.y, hd.z, 1); rod(rg, hd.clone().add(V(0, -0.13, 0)), V(hd.x, 0.16, -Wo - 0.11), pr, K.rain); for (let y = e - 0.8; y > 0.4; y -= 1.6) rod(rg, V(hd.x, y - 0.025, -Wo - 0.11), V(hd.x, y + 0.025, -Wo - 0.11), pr + 0.008, K.iron); }
    }
    // chimney: a brick stack laid in courses, lead collar, cap, flaunching and pots (only where the phone house has one)
    if (look.chim && kind < 2) { const cx = look.cx * H, cz = H * 0.35, surf = (x, z) => kind === 0 ? e + rh * (1 - Math.abs(z) / Wv) : e + rh * (1 - Math.max(Math.abs(x), Math.abs(z)) / Wv);
      const [bl, bh, bd, mj] = HQ.brick, cw = (3 * (bl + mj) - mj) / 2, ys = Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a2, b2]) => surf(cx + a2 * cw, cz + b2 * cw))) - 0.25 + sagDy(cx, top, cz) * 0.5, yt = top + 0.6, cg = new THREE.Group(); cg.position.set(cx, 0, cz); rg.add(cg);
      box(cg, 2 * cw - 0.02, yt - ys, 2 * cw - 0.02, K.mortar, 0, (ys + yt) / 2, 0, 1);
      if (DT.chimney) { const ang = [0, PI, PI / 2, -PI / 2], q4 = new THREE.Quaternion(); for (let k = 0, y = ys + bh / 2; y < yt - 0.09; k++, y += bh + mj) for (let sd = 0; sd < 4; sd++) { const full = (k + (sd < 2 ? 0 : 1)) % 2 === 0, s0 = full ? -cw : -cw + bd, s1 = -s0, off = full ? 0 : (bl + mj) / 2;
          for (let u = s0 - off; u < s1 - 0.01; u += bl + mj) { const c0 = Math.max(u, s0), c1 = Math.min(u + bl, s1); if (c1 - c0 < 0.03) continue; const pl = V((c0 + c1) / 2, y, cw + 0.004 - bd / 2).applyAxisAngle(UP, ang[sd]); q4.setFromAxisAngle(UP, ang[sd]); m4.compose(pl, q4, V((c1 - c0) / bl, 1, 1));
            tmpC.copy(brickCol).multiplyScalar(0.78 + 0.4 * rr()); if (y > yt - 0.5 && rr() < 0.5) tmpC.multiplyScalar(0.55); inst(cg, 'brick', m4, tmpC); } } }
      box(cg, 2 * cw + 0.12, 0.07, 2 * cw + 0.12, K.stone, 0, yt - 0.035, 0, 1); const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.46, 0.09, 4), K.mortar); fl.rotation.y = PI / 4; fl.position.y = yt + 0.045; cg.add(fl);
      for (const sx of [-1, 1]) { if (deso && sx > 0 && rr() < 0.6) { const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.16, 14, 1, true), K.pot); bp.position.set(sx * 0.16, yt + 0.16, 0); bp.rotation.z = 0.15; cg.add(bp); continue; }
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.4, 14, 1, true), K.pot); pot.position.set(sx * 0.16, yt + 0.28, 0); cg.add(pot); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.014, 6, 14), K.pot); rim.rotation.x = PI / 2; rim.position.set(sx * 0.16, yt + 0.47, 0); cg.add(rim); } }
    // solar modules on rails, on the street slope (or on frames on a flat roof), where the phone house has its panel
    if (DT.panels) { const [mw, mh] = HQ.module, sl = slopes.find((q) => q.street), pvW = kind === 1 ? 0.9 * H : kind === 3 ? 1.5 * H : 1.3 * H;
      const module = (par, c, a, n, b, broken) => { oriented(par, mw, 0.035, mh, K.alu, c, a, n, b); const gl = oriented(par, mw - 0.05, 0.012, mh - 0.05, broken ? K.glass : K.pv, c.clone().addScaledVector(n, 0.02), a, n, b); return gl; };
      if (sl) { const vp = sl.S * (kind === 1 ? 0.42 : 0.66), [u0, u1] = sl.uR(vp + mh / 2), nm = Math.max(1, Math.min(Math.floor((u1 - u0 - 0.5) / (mw + 0.02)), Math.floor(pvW / (mw + 0.02)))), lift = HQ.batten[1] + tt + 0.12;
        for (const dv of [-mh * 0.3, mh * 0.3]) beam(RG, at(sl, -nm * (mw + 0.02) / 2 - 0.1, vp + dv, lift - 0.05), at(sl, nm * (mw + 0.02) / 2 + 0.1, vp + dv, lift - 0.05), 0.04, 0.04, sl.n, K.alu, 1);
        for (let k = 0; k < nm; k++) { if (deso && k === nm - 1 && nm > 2 && rr() < 0.7) continue; const u = (k - (nm - 1) / 2) * (mw + 0.02); module(RG, at(sl, u, vp, lift), sl.a, sl.n, sl.b, deso && k === 1 && rr() < 0.5); } }
      else if (kind === 3) { const nm = Math.floor(pvW / (mw + 0.02)), tilt = 0.6, b = V(0, Math.sin(tilt), Math.cos(tilt)), n = V(0, Math.cos(tilt), -Math.sin(tilt)), a = new THREE.Vector3().crossVectors(n, b);
        for (let k = 0; k < nm; k++) { const u = (k - (nm - 1) / 2) * (mw + 0.02), c = V(u, e + 0.25 + mh / 2 * Math.sin(tilt), -(H - 0.9)); module(rg, c, a, n, b, false); for (const sx of [-0.4, 0.4]) { rod(rg, V(u + sx, e, c.z - mh / 2 * Math.cos(tilt) + 0.05), V(u + sx, e + 0.25, c.z - mh / 2 * Math.cos(tilt) + 0.05), 0.02, K.alu, 6); rod(rg, V(u + sx, e, c.z + mh / 2 * Math.cos(tilt) - 0.05), V(u + sx, e + 0.25 + mh * Math.sin(tilt), c.z + mh / 2 * Math.cos(tilt) - 0.05), 0.02, K.alu, 6); } } } }
    // the porch canopy over the front door: ledger, two timber brackets with struts, boarded top under tiles or lead, fascia
    if (look.porch && DT.porch) { const dg = new THREE.Group(); dg.position.set(d0.x, 0, d0.z); dg.rotation.y = Math.atan2(d0.nx, d0.nz); hg.add(dg); const Wp = 2 * hw + look.pw, pd = look.pd, y0 = 3.26, sag2 = deso ? 0.06 : 0;
      box(dg, Wp + 0.1, 0.12, 0.07, K.timber, 0, y0 + 0.04, -0.2 - 0.035, 1.2);
      for (const sx of [-1, 1]) { const x = sx * (Wp / 2 - 0.1); box(dg, 0.08, 0.75, 0.08, K.timber, x, y0 - 0.32, -0.24, 1.2); beam(dg, V(x, y0 - 0.02, -0.24), V(x, y0 - 0.02 - pd * Math.tan(0.18) - (sx > 0 ? sag2 : 0), -0.24 - pd + 0.05), 0.08, 0.1, UP, K.timber, 1.2); if (!(deso && sx > 0)) beam(dg, V(x, y0 - 0.62, -0.26), V(x, y0 - 0.06 - pd * 0.55 * Math.tan(0.18), -0.24 - pd * 0.55), 0.06, 0.07, UP, K.timber, 1.2); }
      const b = V(0, Math.sin(0.18), Math.cos(0.18)).negate(), n = V(0, Math.cos(0.18), -Math.sin(0.18)), a = new THREE.Vector3().crossVectors(n, b), c = V(0, y0 + 0.05 - pd / 2 * Math.tan(0.18), -0.2 - pd / 2);
      const top2 = oriented(dg, Wp + 0.12, 0.025, pd + 0.06, K.timber, c, a, n, b, 1.2); top2.rotation.z += sag2 * 0.6;
      oriented(dg, Wp + 0.14, 0.022, pd + 0.1, look.cover ? K.under : K.lead, c.clone().addScaledVector(n, 0.025), a, n, b, 1).rotation.z += sag2 * 0.6;
      if (look.cover && DT.tiles) { const lap = HQ.lap, bp = b.clone().multiplyScalar(-1), base = new THREE.Matrix4(); const P0 = c.clone().addScaledVector(b, pd / 2 + 0.03), a2 = a.clone().negate(); // rows from the outer edge up to the wall
        const bb = bp.clone().multiplyScalar(Math.cos(lap)).addScaledVector(n, -Math.sin(lap)), nn = n.clone().multiplyScalar(Math.cos(lap)).addScaledVector(bp, Math.sin(lap)); base.makeBasis(a2, nn, bb);
        for (let v = 0; v < pd; v += tg) for (let u = -(Wp + 0.1) / 2 + tw / 2 + ((Math.round(v / tg) % 2) ? tw / 2 : 0); u < (Wp + 0.1) / 2 - tw / 2 + 0.01; u += tw) { const p = P0.clone().addScaledVector(a2, u).addScaledVector(bp, v + tl / 2).addScaledVector(n, 0.05 + tt / 2 + tl / 2 * Math.sin(lap)); m4.copy(base).setPosition(p); inst(dg, 'tile', m4, tmpC.copy(tileC).multiplyScalar(1 + (rr() - 0.5) * HQ.tileVar)); } }
      oriented(dg, Wp + 0.16, 0.16, 0.025, K.trim, c.clone().addScaledVector(b, pd / 2 + 0.03).addScaledVector(n, -0.04), a, n, b, 1.4); }
    // desolate: tiles that slid off lie broken below the street eave
    if (deso && kind < 3) for (let k = 0; k < DS.over.slipped; k++) { const q4 = new THREE.Quaternion().setFromEuler(new THREE.Euler((rr() - 0.5) * 0.3, rr() * 6.28, (rr() - 0.5) * 0.3)); m4.compose(V((rr() * 2 - 1) * Wo, 0.03, -(Wv + 0.3 + rr() * 1.5)), q4, V(0.5 + 0.5 * rr(), 1, 0.4 + 0.6 * rr())); inst(rg, look.cover ? 'tile' : 'sheet', m4, tmpC.copy(tileC).multiplyScalar(0.8 + 0.3 * rr())); }
    // bake every roof part into its own geometry, then let the ridge sag
    RG.updateMatrix(); for (const m of RG.children.slice()) { if (!m.isMesh) continue; m.updateMatrix(); const geo = m.geometry.clone(); geo.applyMatrix4(m.matrix); m.geometry.dispose(); const P = geo.attributes.position; if (SAG) for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + sagDy(P.getX(i), P.getY(i), P.getZ(i))); m.geometry = geo; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); m.quaternion.identity(); }
    roofInfo = { rg, e, top, Wo, Wv, kind };
    return top;
  }

  // ---------------------------------------------------------------- DENSITY (CONFIG.quality.high.density.house): weathering marks cut round the openings, curtains, things fixed to the walls and the roof,
  // and the yard as people left it in a hurry (broken fence and gate, mailbox, bins and bags, pots, garden remains, debris, a suitcase, a child's tricycle, washing on the line).
  // Plain meshes on a few shared surfaces, so the world merge folds them into the street's existing draw calls (four new surfaces: plastic, cloth, soil, painted metal, plus the marks).
  function dense() {
    const D = DN.house, CS = DN.cell, G = K.dnG || (K.dnG = shapes()), rd = rng(run.seed * 13 + 7919 * (h.i + 1)), amt = deso ? 1 : 0.4, R = H + 0.2, V3 = new THREE.Vector3();
    if (!K.dn) { const std = (q) => { const m = new THREE.MeshStandardMaterial(q); m.userData.pbr = true; return m; };
      K.dn = { plastic: std({ roughness: 0.8, envMapIntensity: 0.45 }), cloth: std({ map: tx('fabric'), roughness: 1, side: THREE.DoubleSide }), soil: std({ map: tx('grass'), color: 0x5e4a38, roughness: 1 }), metal: std({ map: tx('rust'), roughness: 0.6, metalness: 0.35 }),
        decal: std({ map: weatherTex(), roughness: 0.95, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
      Object.assign(K.dn, { wood: K.timber, paint: K.trim, paper: M.paper, pot: K.pot, stone: K.stone, rubber: M.rubber, glass: K.glass, dark: M.rubber }); }
    const KD = K.dn; let added = 0; const LOG = {}, note = (k) => { LOG[k] = (LOG[k] || 0) + 1; };
    const emit = (key, geo, m, tint) => { const me = new THREE.Mesh(geo, KD[key] || KD.plastic); me.matrixAutoUpdate = false; me.matrix.copy(m); if (tint) me.userData.tint = tint; hg.add(me); added += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; };
    const P = new Placer(emit), col = (hx2, j) => new THREE.Color(hx2).offsetHSL((rd() - 0.5) * 0.02, -0.1 * rd(), (rd() - 0.5) * (j || 0.08));
    for (const W of WF) { W.g.updateMatrix(); W.inv = W.g.matrix.clone().invert(); }
    const d0 = s.breaches.find((b) => b.floor === 0 && b.type === 'door') || s.breaches[0], front = WF.find((W) => W.ops.some((q) => q.b === d0)) || WF[0], du = (front.ops.find((q) => q.b === d0) || { u: 0 }).u;
    const yd = Math.abs(h.z) - R - 4.95, dorm = dormantSpots(run), E = h.ext, toW = (lx, lz) => [h.x + lx * h.cs - lz * h.sn, h.z + lx * h.sn + lz * h.cs];
    const doors = []; for (const W of WF) for (const q of W.ops) if (q.f === 0 && q.type === 'door') doors.push({ W, u: q.u });
    // is a spot (u along wall W, zo out from its middle plane) clear of the road, cars, sleeping machines, the lean-to and every door's path? rad: the prop's own reach
    const free = (W, u, zo, rad, noDoor) => { const p = V3.set(u, 0, zo).applyMatrix4(W.g.matrix).clone(), [x, z] = toW(p.x, p.z);
      if (Math.abs(z) < 4.95 + rad || run.cars.some((c) => !c.ghost && Math.hypot(x - c.x, z - c.z) < 2.6 + rad) || dorm.some((q) => Math.hypot(x - q.x, z - q.z) < 1.3 + rad)) return false;
      if (E && Math.abs(p.x - E.lx) < (E.ax === 'x' ? E.w : E.d) / 2 + 0.3 + rad && Math.abs(p.z - E.lz) < (E.ax === 'x' ? E.d : E.w) / 2 + 0.3 + rad) return false;
      if (!noDoor) for (const q of doors) { const pp = p.clone().applyMatrix4(q.W.inv); if (pp.z > 0 && pp.z < 7 && Math.abs(pp.x - q.u) < hw + D.clear + rad) return false; }
      return true; };
    const underWin = (W, u, pad) => inOpening(W, u, 1.0, pad);

    // weathering marks laid on an outside wall and cut into cells; cells over a door, window or hole are left out, so no mark ever floats across an opening
    let zk = 0; const decal = (W, cell, u, y, w, hh, tint, fu, zo) => { const [a0, b0, a1, b1] = cellUV(cell), f0 = fu ? fu[0] : 0, f1 = fu ? fu[1] : 1, n = Math.max(1, Math.round(w / CS)), m = Math.max(1, Math.round(hh / CS)), pos = [], uv = [], z = (zo || 0.2) + 0.003 + (zk++ % 12) * 0.0005;
      const U = (t) => a0 + (a1 - a0) * (f0 + (f1 - f0) * t), Vv = (t) => b0 + (b1 - b0) * t;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const ua = u - w / 2 + i * w / n, ub = ua + w / n, ya = y + j * hh / m, yb = ya + hh / m;
        if (inOpening(W, (ua + ub) / 2, (ya + yb) / 2, 0.04) || ua < -R - 0.001 || ub > R + 0.001 || yb > Ht + 0.01 || ya < -0.001) continue;
        const ta = i / n, tb = (i + 1) / n, sa = j / m, sb = (j + 1) / m; pos.push(ua, ya, z, ub, ya, z, ub, yb, z, ua, ya, z, ub, yb, z, ua, yb, z); uv.push(U(ta), Vv(sa), U(tb), Vv(sa), U(tb), Vv(sb), U(ta), Vv(sa), U(tb), Vv(sb), U(ta), Vv(sb)); }
      if (!pos.length) return; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals(); emit('decal', geo, W.g.matrix, tint); };
    const grey = (k) => new THREE.Color(k, k, k), [ph, po] = HQ.plinth, foot = DT.plinth ? ph - 0.06 : 0, [nBand, nBlot, nPatch, nDrip, nRust] = D.wall;
    for (const W of WF) {
      for (let u = -R; u < R - 0.05; u += 2.0) { const w = Math.min(2.0, R - u), f0 = rd() * 0.75; decal(W, 'wash', u + w / 2, 0, w, Ht, grey(0.85 + 0.3 * rd()), [f0, f0 + 0.25 * w / 2]); }
      if (nBand) for (let u = -R; u < R - 0.05; u += 2.0) { const w = Math.min(2.0, R - u), hb = (0.75 + 0.55 * rd()) * nBand, f0 = rd() * 0.7; decal(W, 'band', u + w / 2, foot, w, hb, grey(0.85 + 0.25 * rd()), [f0, f0 + 0.3 * w / 2]); }
      if (nBand && DT.plinth) for (let u = -R - po; u < R + po - 0.05; u += 2.0) { const w = Math.min(2.0, R + po - u), f0 = rd() * 0.7; decal(W, 'band', u + w / 2, 0, w, ph - 0.1, grey(0.75 + 0.2 * rd()), [f0, f0 + 0.3 * w / 2], 0.2 + po); }
      for (let k = 0; k < Math.round(nBlot * amt * (0.5 + rd())); k++) { const sz = 0.6 + 0.9 * rd(); decal(W, 'blot', (rd() * 2 - 1) * (R - sz / 2), 0.4 + rd() * (Ht - 1.2), sz, sz * (0.7 + 0.5 * rd()), grey(0.8 + 0.3 * rd())); }
      for (let k = 0; k < Math.round(nPatch * amt * (0.4 + rd())); k++) { const sz = 0.7 + 0.9 * rd(), uc = (rd() * 2 - 1) * (R - sz / 2), yc = 0.8 + rd() * (Ht - 1.8);
        if (look.fin === 0 || look.fin === 3) decal(W, 'patch', uc, yc, sz * 1.3, sz, look.wall.clone().multiplyScalar(0.95 + 0.15 * rd())); else decal(W, 'blot', uc, yc, sz, sz * 0.8, grey(0.9)); }
      for (const q of W.ops) if (q.type === 'window' && rd() < nDrip * amt) { decal(W, 'streak', q.u + (rd() - 0.5) * 0.3, q.y0 - 0.95 - 0.4 * rd(), 2 * hw * (0.7 + 0.4 * rd()), 0.95 + 0.3 * rd(), grey(0.8 + 0.3 * rd())); }
      for (let k = 0; k < Math.round(2 * nRust * amt); k++) decal(W, 'rust', (rd() * 2 - 1) * (R - 0.4), Ht - 0.95 - 0.3 * rd(), 0.32, 0.9 + 0.3 * rd(), grey(0.9 + 0.2 * rd()));
      if (rd() < 0.8 * amt) decal(W, 'splash', (rd() * 2 - 1) * (R - 1), foot, 1.4 + rd(), 0.45 + 0.2 * rd(), grey(0.9 + 0.2 * rd()));
      // leaf litter and soil drifted against the foot of the wall (ground marks)
      P.pushM(W.g.matrix); for (let k = 0; k < Math.round(D.litter * amt / 4 * (0.5 + rd())); k++) { const u = (rd() * 2 - 1) * (R - 0.6); P.add('decal', G.floorDecal(rd() < 0.75 ? 'litter' : 'dirt'), u, 0.032 + 0.0015 * (k % 5), 0.2 + po + 0.25 + 0.3 * rd(), 0, (rd() - 0.5) * 0.4, 0, 1.0 + 0.8 * rd(), 1, 0.45 + 0.35 * rd(), grey(0.85 + 0.25 * rd())); } P.pop(); }
    // a sprayed search mark beside the front door, smoke above one window, a sprayed loop on a side wall
    if (rd() < D.spray * amt) { const sd = rd() < 0.5 ? -1 : 1; decal(front, 'spray', du + sd * (hw + 0.62), 1.15, 0.75, 0.75, grey(0.95)); }
    if (rd() < D.soot * amt) { const ws = []; for (const W of WF) for (const q of W.ops) if (q.type === 'window') ws.push([W, q]); if (ws.length) { const [W, q] = ws[Math.floor(rd() * ws.length)]; decal(W, 'soot', q.u, q.y1 - 0.1, 2 * hw + 0.9, Math.min(1.8, Ht - q.y1 + 0.3), grey(1)); } }
    if (rd() < D.tag * amt) { const W = WF.find((w) => w !== front && !w.ops.some((q) => q.f === 0 && q.type === 'door')) || WF[1]; decal(W, 'tag', (rd() - 0.5) * (R - 1.2), 1.1 + 0.4 * rd(), 1.3, 0.75, grey(0.9)); }

    // curtains inside the windows: a rod over the opening, faded panels gathered at the sides (some dropped at one end)
    for (const W of WF) for (const q of W.ops) if (q.type === 'window' && rd() < D.curtain) { P.pushM(W.g.matrix); const top = q.y1 + 0.07, len = q.y1 - q.y0 + 0.2, c = new THREE.Color().setHSL(rd(), 0.18 + 0.2 * rd(), 0.3 + 0.3 * rd());
      P.rod('metal', G, V(q.u - hw - 0.12, top, -0.27), V(q.u + hw + 0.12, top, -0.27), 0.011, 6, grey(0.5)); for (const sd of [-1, 1]) if (rd() < 0.85) { P.push(q.u + sd * (hw - 0.1), top, -0.29); PROPS.curtain(P, G, rd, 0.42 + 0.15 * rd(), len * (0.85 + 0.15 * rd()), c, rd() < 0.25); P.pop(); } P.pop(); }

    // on the walls: a satellite dish with its cable clipped down the wall, the electricity meter box hanging open, a lamp by the door with its glass gone
    if (rd() < D.dish) { const W = rd() < 0.5 ? front : WF[(WF.indexOf(front) + 2) % 4 === WF.indexOf(front) ? 1 : (WF.indexOf(front) + 2) % 4], sd = rd() < 0.5 ? -1 : 1, u = sd * (R - 0.45), y = Ht - 0.75;
      if (!inOpening(W, u, y, 0.5)) { P.pushM(W.g.matrix); P.push(u, y, 0.2); PROPS.dish(P, G, rd); P.pop(); let py = y - 0.15; P.rod('rubber', G, V(u, py, 0.215), V(u, 0.35, 0.215), 0.005, 4); for (; py > 0.5; py -= 0.55) P.add('plastic', G.box(0.02, 0.015, 0.012), u, py, 0.214, 0, 0, 0, 1, 1, 1, grey(0.85)); P.pop(); } }
    { const side = WF.find((w) => w !== front && w.ops.every((q) => Math.abs(q.u - (R - 1.1)) > hw + 0.5 || q.f > 0)) || WF[1]; if (!inOpening(side, R - 1.1, 1.5, 0.4)) { P.pushM(side.g.matrix); P.push(R - 1.1, 1.3, 0.2);
      P.add('metal', G.box(0.42, 0.55, 0.16), 0, 0.275, 0.08, 0, 0, 0, 1, 1, 1, grey(0.75)); P.add('dark', G.box(0.38, 0.5, 0.01), 0, 0.275, 0.165); P.push(-0.21, 0, 0.16, -1.9 - 0.5 * rd()); P.add('metal', G.box(0.42, 0.55, 0.015), 0.21, 0.275, 0, 0, 0, 0, 1, 1, 1, grey(0.75)); P.pop();
      for (let k = 0; k < 3; k++) P.rod('rubber', G, V(-0.1 + k * 0.1, 0.02, 0.1), V(-0.1 + k * 0.1 + (rd() - 0.5) * 0.2, -0.6 - 0.5 * rd(), 0.12), 0.008, 4); P.pop(); P.pop(); } }
    { const u = du + (hw + 0.35) * (rd() < 0.5 ? -1 : 1); if (!inOpening(front, u, 2.2, 0.15)) { P.pushM(front.g.matrix); P.push(u, 2.2, 0.2); P.add('metal', G.box(0.1, 0.16, 0.03), 0, 0, 0.015, 0, 0, 0, 1, 1, 1, grey(0.4)); P.add('metal', G.box(0.03, 0.03, 0.18), 0, 0.05, 0.1, 0, 0, 0, 1, 1, 1, grey(0.4));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('metal', G.box(0.012, 0.24, 0.012), sx * 0.08, -0.04, 0.2 + sz * 0.08, 0, 0, 0, 1, 1, 1, grey(0.35)); P.add('metal', G.cyl(0.0, 0.13, 0.08, 4), 0, 0.12, 0.2, 0, PI / 4, 0, 1, 1, 1, grey(0.35));
      P.add('glass', G.box(0.12, 0.1, 0.003), -0.02, -0.12, 0.28, 0, 0, 0.5); P.pop(); P.pop(); } }
    // a snapped service cable: from an insulator under the eaves it sags down and lies coiled in the yard
    if (rd() < D.wires * amt && yd > 1.6) { const sd = rd() < 0.5 ? -1 : 1, a = V(sd * (R - 0.3), Ht - 0.2, 0.3), gx = sd * (R - 1.2 - rd()), gz = 0.2 + Math.min(yd - 0.5, 1.8 + 1.2 * rd());
      if (free(front, gx, gz, 0.3)) { P.pushM(front.g.matrix); P.add('metal', G.box(0.04, 0.04, 0.12), a.x, a.y, 0.25, 0, 0, 0, 1, 1, 1, grey(0.5)); P.add('plastic', G.cyl(0.03, 0.03, 0.08, 8), a.x, a.y - 0.05, 0.32, 0, 0, 0, 1, 1, 1, grey(0.9));
        let prev = a; for (let k = 1; k <= 10; k++) { const t = k / 10, q = V(a.x + (gx - a.x) * t, a.y * (1 - t) * (1 - t) * (1 - 0.3 * t) + 0.02, a.z + (gz - a.z) * Math.pow(t, 0.7)); P.rod('rubber', G, prev, q, 0.007, 4); prev = q; }
        for (let k = 0; k < 12; k++) { const t0 = k / 12 * 2 * PI, t1 = (k + 1) / 12 * 2 * PI, rr0 = 0.3 + 0.02 * k, rr1 = 0.3 + 0.02 * (k + 1); P.rod('rubber', G, V(gx + Math.cos(t0) * rr0, 0.02, gz + Math.sin(t0) * rr0 * 0.6), V(gx + Math.cos(t1) * rr1, 0.02, gz + Math.sin(t1) * rr1 * 0.6), 0.007, 4); } P.pop(); } }

    // ---- the front yard: a picket fence (or a low brick wall on brick houses) along the footway, broken, with the gate hanging open; the mailbox by the gate, letters on the ground
    const fz = 0.2 + yd - 0.35, fcol = look.trim.clone().lerp(new THREE.Color(0xc8c4b8), 0.35), brickWall = look.fin === 1;
    if (yd > 1.4 && rd() < D.yard[0]) { P.pushM(front.g.matrix); const x0 = -R - 2.2, x1 = R + 2.2, g0 = du - 0.62, g1 = du + 0.62;
      for (const [a, b] of [[x0, g0], [g1, x1]]) for (let u = a; u < b - 0.2; u += 1.8) { const v = Math.min(b, u + 1.8), mid = (u + v) / 2; if (!free(front, mid, fz, 0.2, true)) { note('fenceBlocked'); continue; } const roll = rd(); note('fence');
        if (roll < 0.14) continue; P.push(0, 0, fz);
        if (brickWall) { const hh = 0.55 + 0.1 * rd(), bc = col(0x9a5a44, 0.1); if (roll < 0.3) { for (let k = 0; k < 5; k++) P.add('stone', G.box(0.215, 0.065, 0.1), mid + (rd() - 0.5) * 1.4, 0.035, (rd() - 0.5) * 0.8, 0, rd() * 3, (rd() - 0.5) * 0.4, 1, 1, 1, bc); P.add('stone', G.box(v - u, 0.2, 0.22), mid, 0.1, 0, 0, 0, 0, 1, 1, 1, bc); }
          else { P.add('stone', G.box(v - u, hh, 0.22), mid, hh / 2, 0, 0, 0, 0, 1, 1, 1, bc); for (let x = u + 0.15; x < v - 0.1; x += 0.3) if (rd() > 0.12) P.add('stone', G.box(0.28, 0.06, 0.3), x + 0.0, hh + 0.03, 0, 0, (rd() - 0.5) * 0.1, (rd() - 0.5) * 0.06, 1, 1, 1, grey(0.75 + 0.15 * rd())); } }
        else if (roll < 0.26) { P.push(mid, 0.1, -0.3, (rd() - 0.5) * 0.3, -PI / 2 + 0.06); PROPS.fence(P, G, rd, -(v - u) / 2, (v - u) / 2, 0.9, D.gone[1], 0, fcol); P.pop(); }
        else PROPS.fence(P, G, rd, u, v, 0.85 + 0.1 * rd(), D.gone[0] + (D.gone[1] - D.gone[0]) * rd(), roll < 0.45 ? (rd() - 0.5) * 0.45 : 0, fcol);
        P.pop(); }
      if (!brickWall) { P.push(g0, 0, fz, 0); PROPS.gate(P, G, rd, 1.15, 0.9, 1.0 + 0.7 * rd(), rd() < 0.5, fcol); P.pop(); }
      if (free(front, g1 + 0.45, fz - 0.2, 0.2, true)) { P.push(g1 + 0.45, 0, fz - 0.15, 0); note('mailbox'); PROPS.mailbox(P, G, rd, col([0x8a2a22, 0x2a4a6a, 0x3a5a3a, 0x6a6a64][Math.floor(rd() * 4)], 0.1)); P.pop(); }
      P.pop(); }
    // bins by the front wall (one tipped over with its bags spilled), bags, pots under the windows, a raised bed gone to soil with its canes fallen, a heap of bricks and boards
    const binCols = [0x2f4a32, 0x1d1e1d, 0x55585a, 0x2c405c, 0x6a4a2a], bagCols = [0x141414, 0x26341f, 0x2a2f3a, 0x3a3a34];
    P.pushM(front.g.matrix);
    { const sd = du > 0 ? -1 : 1; let placed = 0; for (let k = 0; k < 4 && placed < D.yard[1]; k++) { const u = sd * (R - 0.45 - k * 0.72), zo = 0.2 + 0.5; if (underWin(front, u, 0.35)) { note('binWin'); continue; } if (!free(front, u, zo, 0.4)) { note('binBlocked'); continue; } const tip = rd() < 0.4 * amt;
        P.push(u, 0, zo + (tip ? 0.3 : 0), tip ? PI / 2 * (rd() < 0.5 ? 1 : -1) + 0.3 : (rd() - 0.5) * 0.3); PROPS.bin(P, G, rd, col(binCols[Math.floor(rd() * binCols.length)], 0.06), tip); P.pop(); placed++; note('bin');
        if (tip) for (let b = 0; b < 3; b++) { P.push(u + (rd() - 0.5) * 0.9, 0, zo + 0.6 + 0.8 * rd()); PROPS.bag(P, G, rd, col(bagCols[Math.floor(rd() * 4)], 0.05)); P.pop(); P.add('paper', G.box(0.2, 0.004, 0.14), u + (rd() - 0.5) * 1.4, 0.035, zo + 0.5 + 1.2 * rd(), 0, rd() * 6, 0); } } }
    for (let k = 0; k < Math.round(D.yard[2] * amt * rd()); k++) { const u = (rd() * 2 - 1) * (R + 1.5), zo = 0.6 + rd() * Math.max(0.5, yd - 1); if (!free(front, u, zo, 0.3)) { note('bagBlocked'); continue; } note('bag'); P.push(u, 0, zo); PROPS.bag(P, G, rd, col(bagCols[Math.floor(rd() * 4)], 0.05)); P.pop(); }
    for (let k = 0; k < Math.round(D.yard[3] * (0.4 + 0.6 * rd())); k++) { const u = (rd() * 2 - 1) * (R - 0.4), zo = 0.2 + 0.25 + 0.3 * rd(); if (!free(front, u, zo, 0.2)) { note('potBlocked'); continue; } note('pot'); const st = rd(); P.push(u, 0, zo, rd() * 6); PROPS.pot(P, G, rd, st < 0.35 ? 'up' : st < 0.7 ? 'side' : 'broken', undefined, grey(0.55 + 0.25 * rd())); P.pop(); }
    if (yd > 2.4) { const sd = du > 0 ? -1 : 1, u = sd * (1.6 + rd() * (R - 1.4)), zo = 0.2 + yd * 0.55; if (free(front, u, zo, 1.0)) { note('bed'); P.push(u, 0, zo, (rd() - 0.5) * 0.3); const bw = 1.6, bd = 0.9;
        for (const sz of [-1, 1]) P.add('wood', G.box(bw, 0.24, 0.04), 0, 0.12, sz * bd / 2, 0, 0, sz > 0 && rd() < 0.4 ? 0.2 : 0, 1, 1, 1, grey(0.7)); for (const sx of [-1, 1]) P.add('wood', G.box(0.04, 0.24, bd), sx * bw / 2, 0.12, 0, 0, 0, 0, 1, 1, 1, grey(0.7));
        P.add('soil', G.lump(2), 0, 0.12, 0, 0, 0, 0, bw / 2 - 0.05, 0.1, bd / 2 - 0.05); for (let k = 0; k < 6; k++) { const x = -bw / 2 + 0.2 + k * 0.25; P.rod('wood', G, V(x, 0.2, 0), V(x + (rd() - 0.5) * 0.9, 0.2 + 0.9 * rd(), (rd() - 0.5) * 0.6), 0.008, 4, grey(1.1)); }
        P.add('wood', G.box(0.03, 1.4, 0.03), bw / 2 + 0.4, 0.02, 0.2, PI / 2, 0.5, 0); P.pop(); } }
    { const sd = rd() < 0.5 ? -1 : 1, u = sd * (R + 0.8), zo = 0.2 - R * 0.4; if (free(front, u, zo, 0.8)) { note('heap'); P.push(u, 0, zo, rd() * 6); for (let k = 0; k < 14; k++) P.add('stone', G.box(0.215, 0.065, 0.1), (rd() - 0.5) * 1.0, 0.035 + Math.floor(k / 6) * 0.065, (rd() - 0.5) * 0.7, 0, rd() * 3, 0, 1, 1, 1, col(0x9a5a44, 0.12));
        for (let k = 0; k < 3; k++) P.add('wood', G.box(1.4 + 0.6 * rd(), 0.025, 0.14), (rd() - 0.5) * 0.4, 0.15 + k * 0.03, 0.5 + (rd() - 0.5) * 0.2, 0, (rd() - 0.5) * 0.8, (rd() - 0.5) * 0.1, 1, 1, 1, grey(0.55 + 0.3 * rd())); P.pop(); } }
    // left in a hurry: an open suitcase beside the path, a child's tricycle on its side, a mattress against the wall, spare boards never nailed up
    if (rd() < D.flight * amt && yd > 1.5) { const sd = rd() < 0.5 ? -1 : 1, u = du + sd * (hw + D.clear + 0.6), zo = 0.2 + Math.min(yd - 0.6, 1.4 + rd()); if (free(front, u, zo, 0.4)) { P.push(u, 0, zo, rd() * 6); note('suitcase'); PROPS.suitcase(P, G, rd, col([0x3a2e28, 0x2a3a5a, 0x6a2a2a, 0x2f4a3a][Math.floor(rd() * 4)], 0.06)); P.pop(); }
      const u2 = du - sd * (hw + D.clear + 1.0), z2 = 0.2 + Math.min(yd - 0.8, 0.9 + 1.5 * rd()); if (rd() < 0.6 && free(front, u2, z2, 0.4)) { P.push(u2, 0, z2, rd() * 6); note('trike'); PROPS.trike(P, G, rd, col([0xb02a22, 0x2a6ab0, 0xd8b020][Math.floor(rd() * 3)], 0.05)); P.pop(); } }
    { const u = (du > 0 ? -1 : 1) * (R - 1.5 - rd() * 0.6); if (rd() < 0.55 * amt && !underWin(front, u, 0.55) && free(front, u, 0.55, 0.5)) { note('mattress'); P.add('cloth', G.box(0.9, 1.85, 0.18), u, 0.92, 0.5, -0.2, (rd() - 0.5) * 0.3, 0, 1, 1, 1, col(0xb8ae98, 0.1)); } }
    { const ws = front.ops.filter((q) => q.f === 0 && q.type === 'window'); if (ws.length && rd() < 0.7 * amt) { const q = ws[Math.floor(rd() * ws.length)]; for (let k = 0; k < 3; k++) { const u = q.u - 0.5 + k * 0.42 + (rd() - 0.5) * 0.1; if (!free(front, u, 0.55, 0.2)) continue; P.add('wood', G.box(0.16 + 0.05 * rd(), 1.25 + 0.3 * rd(), 0.025), u, 0.6, 0.45, -0.32 - 0.1 * rd(), 0, (rd() - 0.5) * 0.12, 1, 1, 1, grey(0.5 + 0.35 * rd())); } } }
    P.pop();
    // the back and the sides: washing still on the line, a pallet against a wall, a wheelbarrow, a garden chair on its back, an old tyre
    { const back = WF.find((w) => w.axis === front.axis && w !== front); if (back) { const a = V(-R + 1.0, 1.85, 0.2 + 2.6), b = V(R - 1.0, 1.85, 0.2 + 2.6); if (free(back, a.x, a.z, 0.3) && free(back, b.x, b.z, 0.3) && free(back, 0, a.z, 0.5)) { P.pushM(back.g.matrix);
        for (const p of [a, b]) { P.add('metal', G.cyl(0.03, 0.03, 1.95, 6), p.x, 0.975, p.z, 0, 0, 0, 1, 1, 1, grey(0.55)); P.add('metal', G.box(0.5, 0.03, 0.03), p.x, 1.88, p.z, 0, 0, 0, 1, 1, 1, grey(0.55)); }
        note('line'); PROPS.laundry(P, G, rd, a.clone().setY(1.88), b.clone().setY(1.88), [col(0xd8d0c0, 0.06), col(0x6a7a9a, 0.1), col(0xb07a6a, 0.1), col(0x9aa08a, 0.1), col(0xe0dccc, 0.05)], 4 + Math.floor(rd() * 4));
        P.add('cloth', G.crumple(Math.floor(rd() * 6)), (rd() - 0.5) * R, 0.0, a.z + 0.4, 0, rd() * 6, 0, 0.6, 1, 0.5, col(0xd8d0c0, 0.08)); P.pop(); }
      if (free(back, -R + 0.8, 1.6, 0.6)) { P.pushM(back.g.matrix); P.push(-R + 0.8, 0, 1.6, rd() * 6); PROPS.chair(P, G, rd, col(0xdedad0, 0.06), true); P.pop(); P.pop(); } } }
    for (const W of WF) { if (W === front || rd() > 0.75) continue; const u = (rd() * 2 - 1) * (R - 1.6); if (underWin(W, u, 0.8) || !free(W, u, 1.3, 0.9)) continue; note('dump'); P.pushM(W.g.matrix); P.push(u, 0, 1.3, (rd() - 0.5) * 0.8); const k = rd();
      if (k < 0.4) PROPS.whitegood(P, G, rd, rd() < 0.5, grey(0.62 + 0.15 * rd())); else if (k < 0.75) PROPS.armchair(P, G, rd, col([0x6a5a48, 0x4a5a3a, 0x7a4a3a, 0x5a5a6a][Math.floor(rd() * 4)], 0.06)); else PROPS.tyres(P, G, rd, 2 + Math.floor(rd() * 3));
      P.add('decal', G.floorDecal(rd() < 0.5 ? 'litter' : 'dirt'), 0.3, 0.031, 0.3, 0, rd() * 6, 0, 1.4, 1, 1.0, grey(0.9)); P.pop(); P.pop(); }
    for (const W of WF) { if (W === front) continue; const u = (rd() * 2 - 1) * (R - 1.2); if (underWin(W, u, 0.7) || !free(W, u, 0.5, 0.7)) continue; P.pushM(W.g.matrix); const k = rd(); note('side');
      if (k < 0.4) { P.push(u, 0.6, 0.45, 0, 1.35); PROPS.pallet(P, G, rd); P.pop(); } else if (k < 0.7) { P.push(u, 0, 1.0, rd() * 6); PROPS.barrow(P, G, rd, col(0x4a6a4a, 0.1), rd() < 0.5); P.pop(); }
      else { P.add('rubber', G.torus(0.3, 0.1, 8, 18), u, 0.1, 0.9, PI / 2, 0, 0); P.add('decal', G.floorDecal('dirt'), u, 0.03, 0.9, 0, 0, 0, 0.9, 1, 0.9, grey(0.9)); }
      if (rd() < 0.5) { P.push(u + 0.9, 0, 0.3); PROPS.tool(P, G, rd, Math.floor(rd() * 3), -0.25); P.pop(); } P.pop(); }
    // the roof: an old TV aerial on a mast clamped near the top
    if (roofInfo && rd() < D.aerial) { const { rg, top, Wo, Wv, kind } = roofInfo; rg.updateMatrix(); P.pushM(rg.matrix); const x = (rd() < 0.5 ? -1 : 1) * Wo * (kind === 1 ? 0.15 : 0.5), z = kind === 2 ? Wv - 0.3 : kind === 3 ? Wv * 0.5 : 0, y = top - (kind === 3 ? 0 : 0.12), tl = (rd() - 0.5) * 0.25;
      P.push(x, y, z, rd() * 3, 0, tl); P.add('metal', G.cyl(0.022, 0.022, 1.9, 6), 0, 0.95, 0, 0, 0, 0, 1, 1, 1, grey(0.65)); P.add('metal', G.box(1.3, 0.02, 0.02), 0, 1.75, 0, 0, 0, 0, 1, 1, 1, grey(0.65));
      for (let k = 0; k < 7; k++) P.add('metal', G.box(0.012, 0.012, 0.5 - k * 0.04), -0.6 + k * 0.2, 1.75, 0, 0, 0, 0, 1, 1, 1, grey(0.6)); if (rd() < 0.5) P.add('metal', G.box(0.7, 0.012, 0.012), 0.2, 1.45, 0, 0, 0.4, 0.9, 1, 1, 1, grey(0.6)); P.pop(); P.pop(); }
    // ---- MORE (coordinator review 16:44: "push much further"): heavier wall breakup, window dressing, wall fittings, and a yard full of a family's things left behind
    // (all plain meshes on the shared surfaces above, so the world merge still folds them into the same draw calls)
    const X = D.more; if (X) {
      const taken = [], ok = (W, u, zo, rad) => { const p = V3.set(u, 0, zo).applyMatrix4(W.g.matrix), q = [p.x, p.z]; if (taken.some((t) => Math.hypot(t[0] - q[0], t[1] - q[1]) < t[2] + rad)) return false; if (!free(W, u, zo, rad)) return false; taken.push([q[0], q[1], rad]); return true; };
      const yard = (rad, tries) => { for (let k = 0; k < (tries || 14); k++) { const W = rd() < X.frontShare ? front : WF[Math.floor(rd() * 4)], zo = W === front ? 0.2 + 0.45 + rd() * Math.max(0.3, yd - 0.9) : 0.2 + 0.5 + rd() * 1.6, u = (rd() * 2 - 1) * (R + (W === front ? 1.2 : -0.4)); if (zo < 0.2 + 0.9 && underWin(W, u, rad + 0.1)) continue; if (ok(W, u, zo, rad)) return [W, u, zo]; } return null; };
      const put = (rad, fn) => { const sp = yard(rad); if (!sp) { note('moreBlocked'); return; } const [W, u, zo] = sp; P.pushM(W.g.matrix); P.push(u, 0, zo, rd() * 6); fn(); P.pop(); P.pop(); };
      // walls: big damp patches, render left on brick or peeling paint, soot over windows, water streaks from the eaves, a hand-sprayed stencil
      for (const W of WF) {
        for (let k = 0; k < X.damp; k++) { const sz = 1.4 + 1.4 * rd(); decal(W, 'blot', (rd() * 2 - 1) * (R - sz / 2), 0.2 + rd() * (Ht - sz - 0.4), sz * 1.2, sz, grey(0.75 + 0.2 * rd())); }
        for (let k = 0; k < X.peel; k++) { const sz = 0.45 + 0.7 * rd(); decal(W, 'patch', (rd() * 2 - 1) * (R - sz / 2), 0.5 + rd() * (Ht - 1.4), sz * 1.4, sz, look.fin === 1 ? new THREE.Color(0xa09080).lerp(look.wall, 0.45).multiplyScalar(0.8 + 0.1 * rd()) : look.wall.clone().multiplyScalar(1.12 + 0.12 * rd())); }
        for (let u = -R + 0.4; u < R - 0.3; u += 0.9 + 1.4 * rd()) decal(W, 'streak', u, Ht - 1.6 - 0.8 * rd(), 0.5 + 0.4 * rd(), 1.6 + 0.8 * rd(), grey(0.75 + 0.2 * rd()));
        for (const q of W.ops) if (q.type === 'window' && rd() < X.soot) decal(W, 'soot', q.u, q.y1 + 0.35, 2 * hw + 0.7, Math.min(1.4, Ht - q.y1), grey(0.9));
        if (W !== front && rd() < X.stencil) decal(W, rd() < 0.5 ? 'tag' : 'spray', (rd() - 0.5) * (R - 1), 0.9 + 0.5 * rd(), 1.0, 0.8, grey(0.95)); }
      // windows: blinds hanging askew where there are no curtains, taped notes and a sprayed mark by the door
      for (const W of WF) for (const q of W.ops) if (q.type === 'window' && rd() < X.blind) { P.pushM(W.g.matrix); P.push(q.u, q.y1 - 0.04, -0.22); PROPS.blind(P, G, rd, 2 * hw - 0.08, (q.y1 - q.y0) * (0.25 + 0.4 * rd()), grey(0.75 + 0.2 * rd())); P.pop(); P.pop(); note('blind'); }
      { const u = du + (hw + 0.45) * (rd() < 0.5 ? 1 : -1); if (!inOpening(front, u, 1.45, 0.3)) { P.pushM(front.g.matrix); P.push(u, 1.45, 0.2); PROPS.notes(P, G, rd, 2 + Math.floor(rd() * 3)); P.pop(); P.pop(); note('notes'); } }
      // wall fittings: an air-conditioning box, a waste pipe from the roof, a second dish or a lamp bracket on another wall, cable runs along the eaves
      { const W = WF[(WF.indexOf(front) + 1 + Math.floor(rd() * 3)) % 4], u = (rd() * 2 - 1) * (R - 0.8); if (rd() < X.ac && !inOpening(W, u, 2.3, 0.6)) { P.pushM(W.g.matrix); P.push(u, Math.min(2.4, Ht - 0.6), 0.2); PROPS.ac(P, G, rd); P.pop(); P.pop(); decal(W, 'rust', u, Math.min(2.4, Ht - 0.6) - 1.1, 0.4, 0.8, grey(0.9)); note('ac'); } }
      for (const W of WF) { if (rd() > X.pipe) continue; const u = (rd() < 0.5 ? -1 : 1) * (R - 0.25 - 0.4 * rd()); if (inOpening(W, u, 1.5, 0.2)) continue; P.pushM(W.g.matrix); P.rod('dark', G, V(u, 0.05, 0.27), V(u, Ht - 0.15, 0.27), 0.05, 8, grey(0.3)); for (let y = 0.6; y < Ht - 0.3; y += 1.1) P.add('metal', G.box(0.13, 0.04, 0.09), u, y, 0.24, 0, 0, 0, 1, 1, 1, grey(0.45)); P.add('dark', G.cyl(0.07, 0.05, 0.12, 8), u, 0.08, 0.32, 0.5, 0, 0, 1, 1, 1, grey(0.3)); P.pop(); note('pipe'); }
      for (const W of WF) { if (rd() > X.cables) continue; P.pushM(W.g.matrix); const y0 = Ht - 0.25 - 0.1 * rd(); let prev = V(-R + 0.2, y0, 0.215); for (let k = 1; k <= 8; k++) { const t = k / 8, q = V(-R + 0.2 + t * (2 * R - 0.4), y0 - 0.12 * Math.sin(t * PI * 4) ** 2, 0.215); P.rod('rubber', G, prev, q, 0.006, 4); prev = q; } if (rd() < 0.6) { const u = (rd() - 0.5) * R; let pp = V(u, y0, 0.22); for (let k = 1; k <= 6; k++) { const t = k / 6, q = V(u + 0.2 * Math.sin(t * 3), y0 - t * (y0 - 0.9), 0.22 + 0.25 * t * t); P.rod('rubber', G, pp, q, 0.006, 4); pp = q; } } P.pop(); }
      // the yard: a bike, a pram, toys, a sofa and a table dragged out, cardboard boxes, more bags, tools on the wall, a hose, a plywood warning, a second bin
      const nb = Math.round(X.items * (0.75 + 0.5 * rd())), bike = [0x2a5a8a, 0x8a2a2a, 0x3a6a3a, 0xc8b030, 0x303030];
      for (let k = 0; k < nb; k++) { const t = k % 11;
        if (t === 0) put(0.75, () => { note('bike'); PROPS.bike(P, G, rd, col(bike[Math.floor(rd() * 5)], 0.08), rd() < 0.6); });
        else if (t === 1) put(0.5, () => { note('pram'); PROPS.pram(P, G, rd, col([0x2a3a5a, 0x6a3a4a, 0x3a4a3a][Math.floor(rd() * 3)], 0.06), rd() < 0.5); });
        else if (t === 2) put(0.45, () => { note('toys'); PROPS.toys(P, G, rd); });
        else if (t === 3) put(1.0, () => { note('sofa'); PROPS.sofa(P, G, rd, col([0x6a5a48, 0x4a5a6a, 0x7a3a34, 0x5a6a44, 0x8a7a5a][Math.floor(rd() * 5)], 0.06)); });
        else if (t === 4) put(0.75, () => { note('table'); PROPS.table(P, G, rd, col(0x8a6a4a, 0.1), rd() < 0.5); P.push(0.8, 0, 0.4, rd() * 6); PROPS.chair(P, G, rd, col(0x7a5a3a, 0.08), rd() < 0.6); P.pop(); });
        else if (t === 5) put(0.7, () => { note('boxes'); PROPS.boxes(P, G, rd, 2 + Math.floor(rd() * 4)); });
        else if (t === 6) put(0.4, () => { note('bags'); for (let b = 0; b < 3; b++) { P.push((rd() - 0.5) * 0.7, 0, (rd() - 0.5) * 0.6); PROPS.bag(P, G, rd, col(bagCols[Math.floor(rd() * 4)], 0.05), 0.75); P.pop(); } });
        else if (t === 7) put(0.35, () => { note('hose'); PROPS.hose(P, G, rd, col([0x2a7a3a, 0xc8702a, 0x3a5a9a][Math.floor(rd() * 3)], 0.05)); });
        else if (t === 8) put(0.6, () => { note('ply'); PROPS.ply(P, G, rd, 0.25 + 0.3 * rd(), rd() < 0.6 ? 'spray' : 'tag'); });
        else if (t === 9) put(0.45, () => { note('bin2'); PROPS.bin(P, G, rd, col(binCols[Math.floor(rd() * binCols.length)], 0.06), rd() < 0.5); });
        else put(0.6, () => { note('barrow'); PROPS.barrow(P, G, rd, col(0x8a3a2a, 0.1), rd() < 0.5); }); }
      // garden tools stood against the front wall, between the windows
      for (let k = 0; k < X.tools; k++) { const u = (rd() * 2 - 1) * (R - 0.5); if (underWin(front, u, 0.3) || !ok(front, u, 0.32, 0.15)) continue; P.pushM(front.g.matrix); P.push(u, 0, 0.3, (rd() - 0.5) * 0.4); PROPS.tool(P, G, rd, Math.floor(rd() * 3), -0.22 - 0.1 * rd()); P.pop(); P.pop(); note('tool'); }
      // leaf litter and soil drifts across the yard, not only at the wall foot
      P.pushM(front.g.matrix); for (let k = 0; k < X.drifts; k++) { const u = (rd() * 2 - 1) * (R + 1.5), zo = 0.2 + 0.4 + rd() * Math.max(0.3, yd - 0.6); if (!free(front, u, zo, 0.3, true)) continue; P.add('decal', G.floorDecal(rd() < 0.7 ? 'litter' : 'dirt'), u, 0.033 + 0.001 * (k % 7), zo, 0, rd() * 6, 0, 0.9 + 0.9 * rd(), 1, 0.6 + 0.6 * rd(), grey(0.85 + 0.2 * rd())); } P.pop();
    }
    hg.userData.densityTris = Math.round(added); hg.userData.densityLog = LOG; LOG.yd = +yd.toFixed(2);
  }

  // ---------------------------------------------------------------- finish: the outside walls and rooms, then every gathered instance list becomes one InstancedMesh
  function finish() {
    if (DN) dense();
    walls();
    const geos = { tile: K.geo.tile, brick: K.geo.brick, ridge: K.geo.ridge, leaf: K.geo.leaf, sheet: K.geo.sheet, cope: K.geo.cope, moss: K.geo.moss }, mats = { tile: K.tileI, brick: K.brickI, ridge: K.ridgeI, leaf: K.leafI, sheet: K.sheetI, cope: K.copeI, moss: K.mossI };
    let tris = 0; for (const c of insts.values()) { const n = c.c.length / 3, im = new THREE.InstancedMesh(geos[c.kind], mats[c.kind], n); im.instanceMatrix.array.set(c.m); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.c), 3); im.castShadow = true; im.receiveShadow = true; im.userData.hiInst = c.kind; im.computeBoundingSphere(); c.par.add(im);
      const g = geos[c.kind]; tris += n * (g.index ? g.index.count : g.attributes.position.count) / 3; }
    let merged = 0; hg.traverse((q) => { if (q.isMesh && !q.isInstancedMesh) { const g = q.geometry; merged += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); hg.userData.tris = { instanced: Math.round(tris), merged: Math.round(merged) };
  }

  return { window: windowAt, door: doorAt, torn: tornAt, lamp: lampAt, roof, finish };
}
