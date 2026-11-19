// The seven Gloom machines, DESKTOP builds (2026-11-16; owner: "the desktop version gets its own assets, built for a desktop, not the phone assets with settings turned up").
// Same design, sizes, colours, joints and movement as the phone machines in src/gloomkit.js (walkerDeso ... wardenDeso), but every part is modelled:
// casings are a dark core clad in separate bevelled plates with open seams between them and a bolt in every corner (a few plates bent or gone), legs and arms are
// sleeves with collars, polished rams, rubber bellows and cable runs, feet have toe caps and treaded soles, displays sit in a recess behind a glass pane under a hood,
// vents are louvres, the Warden runs on real track links round road wheels, wires hang and moss grows in clumps. Surfaces are physically based: worn paint that is bare
// steel where it is chipped or scratched, polished rod, rubber, glass. All parts of one moving group that share a surface are merged into one mesh, so a machine stays
// a few dozen draw calls. Every tunable number is in CONFIG.quality.high.gloom.
// DESKTOP PRIORITY (owner, 2026-11-16): this file is the MASTER build of the machines. Its detail is set by CONFIG.quality.<tier>.gloom (.detail switches what exists: bolts, cables, plates, rams,
// fittings, growth; the counts beside it set how much), so a phone version is to be made by dialling THIS builder down. Until such a low setting exists and is tested against the phone budget
// (CONFIG.quality.low.gloom is null today), phones keep their own builders in src/gloomkit.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { applyRelief } from './relief.js';
import { glbModel, glbCopy } from './gloomglb.js';

// E: what the phone file lends us, so both builds share the display picture, the stencil, the leaf and lamp colours and the config:
// { ptex, grp, pm (material registry), glow, halo, within, displayTex, stencilTex, leafDead, deso }
export function hiBuilders(E) {
  const H = E.detail || CONFIG.quality.high.gloom, DT = H.detail, W = E.deso(), grp = E.grp, within = E.within, PI = Math.PI, rnd = Math.random;

  // ---- surfaces
  // one painted picture gives both gloss and metal: green channel = roughness, blue channel = metalness. Paint is matt and not metal; chips and scratches are smooth bare steel; grime is dead matt.
  let rmTex = null;
  const rm = () => {
    if (rmTex) return rmTex;
    const n = H.mapSize, cv = document.createElement('canvas'); cv.width = cv.height = n; const x = cv.getContext('2d'), col = (r, m) => 'rgb(0,' + Math.round(r * 255) + ',' + Math.round(m * 255) + ')';
    x.fillStyle = col(H.paint[0], H.paint[1]); x.fillRect(0, 0, n, n);
    for (let k = 0; k < H.grime; k++) { const gx = rnd() * n, gy = rnd() * n, r = n * (0.04 + 0.1 * rnd()), g = x.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, 'rgba(0,255,0,0.75)'); g.addColorStop(1, 'rgba(0,255,0,0)'); x.fillStyle = g; x.fillRect(gx - r, gy - r, 2 * r, 2 * r); }
    x.fillStyle = col(H.chip[0], H.chip[1]);
    for (let k = 0; k < H.chips; k++) { const cx = rnd() * n, cy = rnd() * n, r = n * (0.004 + 0.018 * rnd() * rnd()); x.beginPath(); for (let a = 0; a < 7; a++) { const t = a / 7 * 2 * PI, q = r * (0.5 + rnd()); x.lineTo(cx + Math.cos(t) * q, cy + Math.sin(t) * q); } x.fill(); }
    x.strokeStyle = col(H.chip[0], H.chip[1]); x.lineWidth = 1;
    for (let k = 0; k < H.scratches; k++) { const sx = rnd() * n, sy = rnd() * n, a = rnd() * 2 * PI, l = n * (0.02 + 0.12 * rnd()); x.globalAlpha = 0.4 + 0.6 * rnd(); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke(); }
    x.globalAlpha = 1; rmTex = new THREE.CanvasTexture(cv); rmTex.wrapS = rmTex.wrapT = THREE.RepeatWrapping; rmTex.userData.shared = true; return rmTex;
  };
  const std = (k, o) => E.pm(k, () => { const m = new THREE.MeshStandardMaterial(o); m.userData.pbr = true; return m; });
  const M = {
    get civic() { return std('dWbody', { map: E.ptex('worn'), color: W.paint, roughness: 1, metalness: 1, roughnessMap: rm(), metalnessMap: rm() }); },
    get grime() { return std('dWleg', { map: E.ptex('worn'), color: 0x6e6450, roughness: 1, metalness: 1, roughnessMap: rm(), metalnessMap: rm() }); },
    get steel() { return std('dWsteel', { map: E.ptex('metal'), color: 0x9a9c98, roughness: H.steel[0], metalness: H.steel[1] }); },
    get chrome() { return std('dHrod', { color: H.chromeTint, roughness: H.chrome[0], metalness: H.chrome[1], envMapIntensity: H.chromeEnv }); },
    get rubber() { return std('dWboot', { color: 0x1a1a18, roughness: H.rubber[0], metalness: H.rubber[1] }); },
    get under() { return std('dHunder', { color: 0x24241f, roughness: H.under[0], metalness: H.under[1] }); },
    get dark() { return std('dHdark', { color: 0x121311, roughness: 0.6, metalness: 0.3 }); },
    get red() { return std('dHwr', { color: 0x7a2018, roughness: 0.7, metalness: 0 }); },
    get yel() { return std('dHwy', { color: 0xa88a28, roughness: 0.7, metalness: 0 }); },
    get moss() { return std('dHmoss', { map: E.ptex('leaves'), color: 0x8fae58, roughness: 1, metalness: 0 }); },
    get lens() { return std('dHlens', { color: 0xc8d2c8, roughness: 0.08, metalness: 0.2, emissive: 0x30342c }); },
    get edge() { return std('dHedge', { map: E.ptex('metal'), color: H.edgeTint, roughness: H.chip[0], metalness: H.chip[1] }); },
    get mud() { return std('dHmud', { color: H.mudTint, roughness: 1, metalness: 0 }); },
    get bulb() { return std('dHbulb', { color: 0xfff2d0, emissive: 0xffb040, emissiveIntensity: H.bulb, roughness: 0.4, metalness: 0 }); },
    get dome() { return E.pm('dHdome', () => { const m = new THREE.MeshStandardMaterial({ color: 0xdfe8e0, transparent: true, opacity: H.lens[1], roughness: H.lens[0], metalness: 0, envMapIntensity: H.lens[2], depthWrite: false }); m.userData.pbr = true; return m; }); },
    get glass() { return E.pm('dHglass', () => { const m = new THREE.MeshStandardMaterial({ color: 0x1c2a24, transparent: true, opacity: H.glass[1], roughness: H.glass[0], metalness: 0, envMapIntensity: H.glass[2], depthWrite: false }); m.userData.pbr = true; return m; }); },
  };
  // painted dirt laid on plate faces (the phone machines' rust, soot, moss and mud pictures), cut to the plates it lies on
  const dec = (k) => E.pm('dHdec' + k, () => { const m = new THREE.MeshStandardMaterial({ map: E.ptex(k), transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide, roughness: 1, metalness: 0 }); m.userData.pbr = true; m.userData.dec = true; return m; });

  // ---- shapes (made once, copied into place)
  const GC = {}, G = (k, f) => GC[k] || (GC[k] = f());
  // a box with every edge bevelled
  const cboxG = (w, h, d, bev) => {
    const b = Math.min(bev, w * 0.3, h * 0.3, d * 0.3), a = w / 2 - b, c = h / 2 - b, s = new THREE.Shape();
    s.moveTo(-a + b, -c); s.lineTo(a - b, -c); s.lineTo(a, -c + b); s.lineTo(a, c - b); s.lineTo(a - b, c); s.lineTo(-a + b, c); s.lineTo(-a, c - b); s.lineTo(-a, -c + b); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1, steps: 1 }); g.translate(0, 0, -(d / 2 - b)); return g;
  };
  const cylG = (rt, rb, h, n, open) => new THREE.CylinderGeometry(rt, rb, h, n || H.round, 1, !!open);
  const hexG = () => G('hex', () => new THREE.CylinderGeometry(1, 1, 0.7, 6));
  // a bolt for the instanced sets: a hex head (no hidden underside) standing on a flat washer, 26 triangles; its foot is at y 0, it stands up along y
  const boltG = () => G('boltI', () => { const h = new THREE.CylinderGeometry(1, 1, 0.7, 6, 1, true).toNonIndexed(), t = new THREE.CircleGeometry(1, 6).toNonIndexed(), w = new THREE.CircleGeometry(1.5, 8).toNonIndexed();
    h.translate(0, 0.47, 0); t.rotateX(-PI / 2); t.translate(0, 0.82, 0); w.rotateX(-PI / 2); w.translate(0, 0.12, 0); const g = mergeGeometries([h, t, w]); g.userData.inst = true; g.userData.shared = true; return g; });
  const washG = () => G('wash', () => new THREE.CylinderGeometry(1.5, 1.5, 0.12, 8));
  const rivG = () => G('riv', () => { const g = new THREE.SphereGeometry(1, 6, 2, 0, 2 * Math.PI, 0, Math.PI / 2); g.userData.inst = true; g.userData.shared = true; return g; });
  // a casing plate in two parts: its flat faces, and its bevelled rim (which can be worn to bare steel)
  const plateG = (pw, ph) => G('pl' + pw.toFixed(3) + ph.toFixed(3), () => { const g = cboxG(pw, ph, H.plate, H.plate * 0.35), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, a = [[], [], []], e = [[], [], []];
    for (let i = 0; i < P.count; i += 3) { const nz = Math.abs(N.getZ(i) + N.getZ(i + 1) + N.getZ(i + 2)) / 3, t = nz > 0.15 && nz < 0.9 ? e : a; for (let j = i; j < i + 3; j++) { t[0].push(P.getX(j), P.getY(j), P.getZ(j)); t[1].push(N.getX(j), N.getY(j), N.getZ(j)); t[2].push(U.getX(j), U.getY(j)); } }
    const mk = (t) => { const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(t[0], 3)); q.setAttribute('normal', new THREE.Float32BufferAttribute(t[1], 3)); q.setAttribute('uv', new THREE.Float32BufferAttribute(t[2], 2)); return q; };
    g.dispose(); return { flat: mk(a), edge: e[0].length ? mk(e) : null }; });
  // a plate that has taken one or two knocks: the sheet is pushed in (towards the machine) round each
  const dentG = (pw, ph) => { const g = new THREE.BoxGeometry(pw, ph, H.plate, 7, 7, 1), P = g.attributes.position, ds = [];
    for (let k = rnd() < 0.4 ? 2 : 1; k > 0; k--) ds.push([(rnd() - 0.5) * pw * 0.6, (rnd() - 0.5) * ph * 0.6, Math.min(pw, ph) * (0.18 + 0.2 * rnd()), H.dent[1] * (0.5 + 0.5 * rnd())]);
    for (let i = 0; i < P.count; i++) { let dz = 0; const x = P.getX(i), y = P.getY(i); for (const [dx, dy, r, dp] of ds) dz += dp * Math.exp(-((x - dx) * (x - dx) + (y - dy) * (y - dy)) / (r * r)); P.setZ(i, P.getZ(i) + dz); }
    g.computeVertexNormals(); return g; };

  // ---- placing: every shape is baked into its moving group, one merged mesh per surface per group
  const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), EU = new THREE.Euler(0, 0, 0, 'YXZ'), P3 = new THREE.Vector3(), S3 = new THREE.Vector3();
  const put = (p, m, geo, x, y, z, rx, ry, rz, sx, sy, sz) => {
    if (geo.userData.inst) { M4.compose(P3.set(x || 0, y || 0, z || 0), Q4.setFromEuler(EU.set(rx || 0, ry || 0, rz || 0)), S3.set(sx || 1, sy || sx || 1, sz || sx || 1)); let I = p.userData.hin; if (!I) I = p.userData.hin = new Map(); const key = geo.uuid + m.uuid; if (!I.has(key)) I.set(key, { geo, m, list: [] }); I.get(key).list.push(M4.clone()); return; }
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!m.userData.dec) { const uv = g.attributes.uv, ou = rnd(), ov = rnd(); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + ou, uv.getY(i) + ov); }
    M4.compose(P3.set(x || 0, y || 0, z || 0), Q4.setFromEuler(EU.set(rx || 0, ry || 0, rz || 0)), S3.set(sx || 1, sy || sx || 1, sz || sx || 1)); g.applyMatrix4(M4);
    let B = p.userData.hb; if (!B) B = p.userData.hb = new Map(); if (!B.has(m)) B.set(m, []); B.get(m).push(g);
  };
  const bake = (root) => { weather(); const ins = []; root.traverse((o) => { if (o.userData.hin) ins.push(o); });
    // bolts and rivets: one instanced set per moving group per shape (the GPU draws every copy in one call; the triangle count still counts every copy)
    for (const o of ins) { for (const { geo, m, list } of o.userData.hin.values()) { const im = new THREE.InstancedMesh(geo, m, list.length); list.forEach((q, i) => im.setMatrixAt(i, q)); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); o.add(im); } delete o.userData.hin; }
    const list = []; root.traverse((o) => { if (o.userData.hb) list.push(o); });
    for (const o of list) { for (const [m, geos] of o.userData.hb) { const g = mergeGeometries(geos, false); for (const q of geos) q.dispose(); if (g) o.add(new THREE.Mesh(g, m)); } delete o.userData.hb; } applyRelief(root); };
  const pbox = (p, m, w, h, d, x, y, z, rx, ry, rz) => put(p, m, G('ub', () => new THREE.BoxGeometry(1, 1, 1)), x, y, z, rx, ry, rz, w, h, d);
  const box = (p, m, w, h, d, x, y, z, rx, ry, rz, bev) => put(p, m, cboxG(w, h, d, bev === undefined ? H.bevel : bev), x, y, z, rx, ry, rz);
  const rod = (p, m, rt, rb, h, x, y, z, rx, ry, rz, n) => put(p, m, cylG(rt, rb, h, n), x, y, z, rx, ry, rz);
  const ring = (p, m, R, r, x, y, z, rx, ry, rz) => put(p, m, new THREE.TorusGeometry(R, r, 6, H.round), x, y, z, (rx || 0) + PI / 2, ry, rz);
  const ballH = (p, m, r, x, y, z, sx, sy, sz) => put(p, m, new THREE.SphereGeometry(r, H.round, Math.round(H.round * 0.6)), x, y, z, 0, 0, 0, sx, sy, sz);
  // a place on one face of a block centred at c: u along the face, v up it, n out from the centre. Faces: f front (-z), b back, l (-x), r (+x), t top, u under
  const fp = (face, c, u, v, n, tilt) => {
    const t = tilt || 0;
    if (face === 'f') return [c[0] + u, c[1] + v, c[2] - n, t, 0, 0];
    if (face === 'b') return [c[0] - u, c[1] + v, c[2] + n, t, PI, 0];
    if (face === 'l') return [c[0] - n, c[1] + v, c[2] + u, t, PI / 2, 0];
    if (face === 'r') return [c[0] + n, c[1] + v, c[2] - u, t, -PI / 2, 0];
    if (face === 't') return [c[0] + u, c[1] + n, c[2] + v, t + PI / 2, 0, 0];
    return [c[0] + u, c[1] - n, c[2] + v, t - PI / 2, 0, 0];
  };
  const bolt = (p, face, c, u, v, n, r) => { if (!DT.bolts) return; const s = r || H.bolt, q = fp(face, c, u, v, n - s * 0.1, -PI / 2); put(p, M.steel, boltG(), q[0], q[1], q[2], q[3], q[4], q[5], s); };
  const rivet = (p, face, c, u, v, n, r) => { if (!DT.bolts) return; const q = fp(face, c, u, v, n, -PI / 2); put(p, M.steel, rivG(), q[0], q[1], q[2], q[3], q[4], q[5], r || H.bolt * 0.7); };
  // a cable through points, sagging a little; a loose wire hanging from a point, frayed at the end
  const cable = (p, pts, r, m) => DT.cables && put(p, m || M.rubber, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2]))), Math.max(6, pts.length * 5), r || 0.009, 5), 0, 0, 0);
  const run = (p, a, b, sag, n, r) => { for (let k = 0; k < (n || 1); k++) { const o = (k - ((n || 1) - 1) / 2) * (r || 0.009) * 2.4, mid = [(a[0] + b[0]) / 2 + o, (a[1] + b[1]) / 2 - sag * (0.7 + 0.6 * rnd()), (a[2] + b[2]) / 2 + sag * 0.5]; cable(p, [[a[0] + o, a[1], a[2]], mid, [b[0] + o, b[1], b[2]]], r, k === 1 ? M.red : k === 2 ? M.yel : M.rubber); } };
  const hang = (p, x, y, z, len) => { const l = len || 0.2 + 0.25 * rnd(), dx = (rnd() - 0.5) * 0.12, dz = (rnd() - 0.5) * 0.12; cable(p, [[x, y, z], [x + dx * 0.3, y - l * 0.4, z + dz * 0.3], [x + dx, y - l * 0.8, z + dz], [x + dx * 1.3, y - l, z + dz * 1.2]], 0.006, rnd() < 0.5 ? M.red : rnd() < 0.5 ? M.yel : M.rubber);
    for (let k = 0; k < 3; k++) rod(p, M.steel, 0.0015, 0.0015, 0.03, x + dx * 1.3 + (k - 1) * 0.006, y - l - 0.012, z + dz * 1.2, (rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9, 4); };
  // moss: a clump of low lumps with a few blades standing in it
  const moss = (p, x, y, z, r) => { if (!DT.growth) return; for (let k = 0; k < H.mossLumps; k++) { const s = r * (0.45 + 0.6 * rnd());
      put(p, M.moss, G('lump', () => new THREE.IcosahedronGeometry(1, 1)), x + (rnd() - 0.5) * r * 1.6, y + s * 0.2, z + (rnd() - 0.5) * r * 1.6, rnd(), rnd() * 6, 0, s * (0.8 + 0.5 * rnd()), s * (0.4 + 0.3 * rnd()), s * (0.8 + 0.5 * rnd())); }
    for (let k = 0; k < 4; k++) put(p, M.moss, new THREE.ConeGeometry(r * 0.08, r * (0.8 + rnd()), 4), x + (rnd() - 0.5) * r, y + r * 0.5, z + (rnd() - 0.5) * r, (rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6); };
  const leaves = (p, n, y, r) => { if (!DT.growth) return; const m = E.leafDead(); for (let k = 0; k < n * H.leaves; k++) put(p, m, new THREE.PlaneGeometry(0.06, 0.045), (rnd() - 0.5) * r, y + (rnd() - 0.5) * 0.1, (rnd() - 0.5) * r, rnd() * 3, rnd() * 3, 0); };
  // rubber bellows round a joint
  const bellows = (p, r, y, x, z) => { const pts = [], nb = DT.bellows; for (let k = 0; k <= nb; k++) pts.push(new THREE.Vector2(r * (k % 2 ? 1.08 : 0.8), 0.075 - k * 0.15 / nb)); put(p, M.rubber, new THREE.LatheGeometry(pts, H.round), x || 0, y || 0, z || 0); };

  // ---- a casing: a dark core clad in bevelled plates that stand off it by a cavity. o.front / back / side / top = [across, up] plate counts; o.open = faces left bare (a display or a vent goes there);
  // o.inset = how far the core stands back from the front; o.hole = one plate is sure to be gone; o.ribs = faces whose plates carry pressed ribs; o.mud = faces that mud splashes up
  const FACES = [];
  // what shows where a plate is gone: the frame ribs, a brace, wiring across the gap, a junction box, and a wire hanging out
  const interior = (p, f, c, u, v, fn, pw, ph) => { const t = H.plate, cav = H.cavity, n0 = fn - t - cav / 2; hang(p, ...fp(f, c, u, v + ph * 0.3, fn - t).slice(0, 3), ph * 0.9); if (!DT.interiors) return;
    for (const s of [-1, 1]) { pbox(p, M.steel, 0.012, ph, cav, ...fp(f, c, u + s * (pw / 2 - 0.008), v, n0)); pbox(p, M.steel, pw, 0.012, cav, ...fp(f, c, u, v + s * (ph / 2 - 0.008), n0)); }
    pbox(p, M.steel, 0.014, ph, cav, ...fp(f, c, u + (rnd() - 0.5) * pw * 0.3, v, n0)); pbox(p, M.steel, pw, 0.01, cav * 0.6, ...fp(f, c, u, v + (rnd() - 0.5) * ph * 0.4, n0 - cav * 0.2));
    for (let k = 0; k < H.cables; k++) { const vv = v + (rnd() - 0.5) * ph * 0.7; cable(p, [-0.48, -0.16, 0.16, 0.48].map((s, i) => fp(f, c, u + s * pw, vv + (i % 3 ? (rnd() - 0.5) * ph * 0.25 : 0), fn - t - cav * (0.3 + 0.4 * rnd())).slice(0, 3)), 0.005, k === 0 ? M.red : k === 1 ? M.yel : M.rubber); }
    pbox(p, M.dark, Math.min(0.07, pw * 0.4), Math.min(0.05, ph * 0.4), cav * 0.8, ...fp(f, c, u + (rnd() - 0.5) * pw * 0.4, v + (rnd() - 0.5) * ph * 0.4, fn - t - cav * 0.6)); };
  const casing = (p, m, w, h, d, x, y, z, o) => {
    const O = o || {}, t = H.plate, gap = H.seam, cav = DT.interiors ? H.cavity : 0, c = [x, y, z], ci = O.inset || 0, cells = [];
    if (!DT.plates) { box(p, m, w, h, d - ci, x, y, z + ci / 2); return; }
    box(p, M.under, w - 2 * (t + cav), h - 2 * (t + cav), d - 2 * (t + cav) - ci, x, y, z + ci / 2);
    const faces = [['f', w, h, d / 2, O.front || [2, 2]], ['b', w, h, d / 2, O.back || O.front || [2, 2]], ['l', d, h, w / 2, O.side || [1, 2]], ['r', d, h, w / 2, O.side || [1, 2]], ['t', w, d, h / 2, O.top || [1, 1]], ['u', w, d, h / 2, [1, 1]]];
    for (const [f, fw, fh, fn, [nx, ny]] of faces) {
      if (O.open && O.open.includes(f)) continue;
      const pw = (fw - gap * (nx + 1)) / nx, ph = (fh - gap * (ny + 1)) / ny, F = { p, f, c, fw, fh, fn, plates: [], mud: !!(O.mud && O.mud.includes(f)) }; if (f !== 'u') FACES.push(F);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) cells.push({ F, f, fn, pw, ph, u: -fw / 2 + gap + pw / 2 + i * (pw + gap), v: -fh / 2 + gap + ph / 2 + j * (ph + gap), roll: f === 'u' || f === 't' ? 1 : rnd() });
    }
    if (O.hole && DT.interiors && !cells.some((q) => q.roll < H.missing)) { const side = cells.filter((q) => q.f === 'f' || q.f === 'l' || q.f === 'r'); if (side.length) side[Math.floor(rnd() * side.length)].roll = 0; }
    for (const { F, f, fn, pw, ph, u, v, roll } of cells) {
      if (roll < H.missing) { interior(p, f, c, u, v, fn, pw, ph); bolt(p, f, c, u - pw / 2 + 0.025, v + ph / 2 - 0.025, fn - t); continue; }
      const bent = roll < H.missing + H.bent, dent = !bent && DT.dents && roll < H.missing + H.bent + H.dent[0], q = fp(f, c, u, v, fn - t / 2 + (bent ? ph * 0.5 * Math.sin(H.bend) * 0.5 : 0), bent ? -H.bend : 0);
      if (dent) put(p, m, dentG(pw, ph), ...q); else { const g = plateG(pw, ph); put(p, m, g.flat, ...q); if (g.edge) put(p, rnd() < H.edgeWear ? M.edge : m, g.edge, ...q); }
      if (bent) continue;
      if (!dent) F.plates.push({ u, v, pw, ph });
      const bi = Math.min(0.028, pw * 0.2, ph * 0.2); for (const [bu, bv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (rnd() > H.boltLost) bolt(p, f, c, u + bu * (pw / 2 - bi), v + bv * (ph / 2 - bi), fn);
      // rivets along the four edges between the corner bolts
      if (H.boltGap && !dent) { const nu = Math.floor((pw - 2 * bi) / H.boltGap), nv = Math.floor((ph - 2 * bi) / H.boltGap);
        for (let k = 1; k < nu; k++) for (const s of [-1, 1]) if (rnd() > H.boltLost) rivet(p, f, c, u - pw / 2 + bi + k * (pw - 2 * bi) / nu, v + s * (ph / 2 - bi), fn);
        for (let k = 1; k < nv; k++) for (const s of [-1, 1]) if (rnd() > H.boltLost) rivet(p, f, c, u + s * (pw / 2 - bi), v - ph / 2 + bi + k * (ph - 2 * bi) / nv, fn); }
      if (O.ribs && O.ribs.includes(f) && !dent && ph > 0.16) for (const s of [-0.2, 0.2]) box(p, m, pw * 0.62, 0.022, 0.008, ...fp(f, c, u, v + s * ph, fn + 0.003), 0.003);
    }
  };
  // years outside, rolled new for every machine (counts and sizes from the same CONFIG.desolate grime block the phone machines use): rust blooms, soot, moss and splashed mud,
  // each laid flat on the plate faces it covers and cut at their edges, so a mark crosses the seams but never hangs in the air; it rides with the part it is on
  const weather = () => { const G = W.grime, F = FACES.filter((q) => q.plates.length); FACES.length = 0; if (!DT.marks || !F.length) return;
    const pick = (arr) => { let a = 0; for (const q of arr) a += q.fw * q.fh; let r = rnd() * a; for (const q of arr) { r -= q.fw * q.fh; if (r <= 0) return q; } return arr[arr.length - 1]; };
    const mark = (k, s, Fq, cu, cv) => { const sg = Fq.f === 'l' || Fq.f === 'r' ? -1 : 1, fl = rnd() < 0.5;
      for (const pl of Fq.plates) { const u0 = Math.max(pl.u - pl.pw / 2, cu - s / 2), u1 = Math.min(pl.u + pl.pw / 2, cu + s / 2), v0 = Math.max(pl.v - pl.ph / 2, cv - s / 2), v1 = Math.min(pl.v + pl.ph / 2, cv + s / 2); if (u1 - u0 < 0.012 || v1 - v0 < 0.012) continue;
        const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0), U = g.attributes.uv, P = g.attributes.position, um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
        for (let i = 0; i < U.count; i++) { const uu = (um + sg * P.getX(i) - cu) / s + 0.5; U.setXY(i, fl ? 1 - uu : uu, (vm + P.getY(i) - cv) / s + 0.5); }
        put(Fq.p, dec(k), g, ...fp(Fq.f, Fq.c, um, vm, Fq.fn + 0.0012)); g.dispose(); } };
    const any = (k, sz) => { const Fq = pick(F), s = sz[0] + rnd() * (sz[1] - sz[0]); mark(k, s, Fq, (rnd() - 0.5) * Fq.fw, (rnd() - 0.5) * Fq.fh); }, cnt = (a) => Math.round(ri(a) * H.marks);
    for (let k = cnt(G.rust); k > 0; k--) any(rnd() < 0.5 ? 'carrust' : 'stain', G.rustSize);
    for (let k = cnt(G.soot); k > 0; k--) any('scorch', G.sootSize);
    for (let k = cnt(G.moss); k > 0; k--) any('moss', G.mossSize);
    const MF = F.filter((q) => q.mud); if (MF.length) for (let k = cnt(G.mud); k > 0; k--) { const Fq = MF[Math.floor(rnd() * MF.length)], s = G.mudSize[0] + rnd() * (G.mudSize[1] - G.mudSize[0]); mark('footgrime', s, Fq, (rnd() - 0.5) * Fq.fw, -Fq.fh / 2 + s * (0.1 + 0.3 * rnd())); } };
  // lumps of dried mud
  const mudAt = (p, x, y, z, sp, sz, n) => { if (!DT.marks) return; for (let k = 0; k < n; k++) { const s = sz * (0.5 + 0.7 * rnd()); put(p, M.mud, G('lump', () => new THREE.IcosahedronGeometry(1, 1)), x + (rnd() - 0.5) * sp * 2, y, z + (rnd() - 0.5) * sp * 2, 0, rnd() * 6, 0, s, s * (0.35 + 0.3 * rnd()), s * (0.7 + 0.6 * rnd())); } };
  // a louvred vent let into a face
  const vent = (p, face, c, u, v, n, w, h) => { if (!DT.fittings) return; const q = fp(face, c, u, v, n + 0.002); pbox(p, M.dark, w, h, 0.004, q[0], q[1], q[2], q[3], q[4], q[5]);
    const k = Math.max(3, Math.round(h / 0.022)); for (let i = 0; i < k; i++) { const s = fp(face, c, u, v - h / 2 + (i + 0.5) * h / k, n + 0.008, 0.6); pbox(p, M.steel, w - 0.01, h / k * 0.8, 0.003, s[0], s[1], s[2], s[3], s[4], s[5]); }
    for (const [du, dv, bw, bh] of [[0, h / 2 + 0.006, w + 0.024, 0.012], [0, -h / 2 - 0.006, w + 0.024, 0.012], [w / 2 + 0.006, 0, 0.012, h], [-w / 2 - 0.006, 0, 0.012, h]]) { const s = fp(face, c, u + du, v + dv, n + 0.007); box(p, M.steel, bw, bh, 0.014, s[0], s[1], s[2], s[3], s[4], s[5], 0.003); } };
  // a grab handle on a face
  const handle = (p, face, c, u, v, n, w) => { if (!DT.fittings) return; const q = fp(face, c, u, v, n, -PI / 2); put(p, M.steel, new THREE.TorusGeometry(w / 2, 0.008, 5, 10, PI), q[0], q[1], q[2], q[3], q[4], q[5]); };
  // a lamp lens in a steel rim on a face
  // a lamp: an open steel rim, a polished reflector at the back, a glowing element, a clear glass lens over it
  const lamp = (p, face, c, u, v, n, r, m) => { if (!DT.fittings) return; put(p, M.steel, cylG(r * 1.25, r * 1.25, 0.026, 14, true), ...fp(face, c, u, v, n + 0.013, PI / 2)); put(p, M.steel, new THREE.TorusGeometry(r * 1.25, 0.004, 4, 14), ...fp(face, c, u, v, n + 0.026));
    put(p, M.chrome, cylG(r * 1.22, r * 1.22, 0.004, 14), ...fp(face, c, u, v, n + 0.003, PI / 2)); const s = fp(face, c, u, v, n + 0.012); put(p, m || M.bulb, new THREE.SphereGeometry(r * 0.4, 8, 6), s[0], s[1], s[2]);
    if (DT.glass) put(p, M.dome, new THREE.SphereGeometry(r * 1.15, 12, 6), ...fp(face, c, u, v, n + 0.018), 1, 1, 0.5); };
  // a maintenance hatch: a raised door on two hinges with a latch and a pull handle
  const hatch = (p, face, c, u, v, n, w, h, m) => { if (!DT.fittings) return; box(p, m || M.civic, w, h, 0.008, ...fp(face, c, u, v, n + 0.004), 0.003);
    for (const s of [-0.3, 0.3]) put(p, M.steel, cylG(0.008, 0.008, Math.min(0.06, h * 0.25), 8), ...fp(face, c, u - w / 2 - 0.004, v + s * h, n + 0.008));
    box(p, M.steel, 0.016, 0.05, 0.01, ...fp(face, c, u + w / 2 - 0.02, v, n + 0.012), 0.003); for (const [bu, bv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rivet(p, face, c, u + bu * (w / 2 - 0.012), v + bv * (h / 2 - 0.012), n + 0.008);
    handle(p, face, c, u + w * 0.2, v, n + 0.008, Math.min(0.07, w * 0.4)); };
  // a lifting eye on a top face, and a riveted maker's plate
  const eye = (p, x, y, z, ry) => { if (!DT.fittings) return; rod(p, M.steel, 0.014, 0.018, 0.016, x, y + 0.008, z, 0, 0, 0, 8); put(p, M.steel, new THREE.TorusGeometry(0.024, 0.007, 5, 12), x, y + 0.036, z, 0, ry || 0, 0); };
  const tag = (p, face, c, u, v, n) => { if (!DT.fittings) return; box(p, M.steel, 0.1, 0.055, 0.004, ...fp(face, c, u, v, n + 0.002), 0.001); for (const [bu, bv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rivet(p, face, c, u + bu * 0.042, v + bv * 0.02, n + 0.004, H.bolt * 0.45); };
  // the stencilled unit label (the same picture the phone machine carries)
  const stencil = (p, x, y, z, w) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshLambertMaterial({ map: E.stencilTex(W), transparent: true })); l.position.set(x, y, z - 0.003); l.rotation.y = PI; p.add(l); };

  // ---- the display: the face of the block (at z0, ow x oh) is a plate frame; behind it a recess, the screen at the back of the recess, a glass pane across the opening, a hood over it, a faint glow in front
  const display = (p, w, h, z0, kind, K, face, dead, ow, oh) => {
    const t = H.plate, OW = ow || w + 0.06, OH = oh || h + 0.06, c = [0, 0, z0], sw = (OW - w) / 2, sh = (OH - h) / 2, rec = H.recess;
    box(p, M.civic, OW, sh, t, 0, h / 2 + sh / 2, z0 + t / 2, 0, 0, 0, t * 0.35); box(p, M.civic, OW, sh, t, 0, -h / 2 - sh / 2, z0 + t / 2, 0, 0, 0, t * 0.35);
    box(p, M.civic, sw, h, t, -w / 2 - sw / 2, 0, z0 + t / 2, 0, 0, 0, t * 0.35); box(p, M.civic, sw, h, t, w / 2 + sw / 2, 0, z0 + t / 2, 0, 0, 0, t * 0.35);
    for (const [bu, bv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bolt(p, 'f', c, bu * (OW / 2 - 0.016), bv * (OH / 2 - 0.016), 0, H.bolt * 0.8);
    for (const [dx, dy, bw, bh] of [[0, h / 2 + 0.004, w + 0.016, 0.008], [0, -h / 2 - 0.004, w + 0.016, 0.008], [w / 2 + 0.004, 0, 0.008, h], [-w / 2 - 0.004, 0, 0.008, h]]) box(p, M.dark, bw, bh, rec + 0.01, dx, dy, z0 + rec / 2 - 0.005, 0, 0, 0, 0.001);
    box(p, M.dark, w + 0.02, h + 0.02, 0.006, 0, 0, z0 + rec + 0.004, 0, 0, 0, 0.001);
    box(p, M.steel, w + 0.05, 0.008, 0.07, 0, h / 2 + 0.012, z0 - 0.028, 0.12, 0, 0, 0.002);
    let D = null; const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dead ? M.dark : face); scr.position.set(0, 0, z0 + rec); scr.rotation.y = PI; p.add(scr);
    if (!dead) { D = E.displayTex(kind, K, W); face.map = D.tex; const hl = E.halo(p, 0, 0, z0 - 0.06, Math.max(w, h) * H.halo[0], K.screen); hl.material = hl.material.clone(); hl.material.opacity = 0; scr.onBeforeRender = () => { hl.material.opacity = H.halo[1] * Math.min(1, face.color.r); }; }
    if (DT.glass) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.012, h + 0.012), M.glass); gl.position.set(0, 0, z0 + 0.002); gl.rotation.y = PI; p.add(gl); }
    if (dead) for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, l = Math.min(w, h) * (0.3 + 0.4 * rnd()); box(p, M.lens, l, 0.002, 0.001, Math.cos(a) * l * 0.4, Math.sin(a) * l * 0.4, z0 + 0.001, 0, 0, a, 0); }
    return D;
  };

  // ---- limbs
  // a sleeve with collars at both ends, a polished inner tube showing at the lower end, and a hose down the back
  const sleeve = (p, m, r, r2, len, side) => {
    rod(p, m, r, (r + r2) / 2, len * 0.62, 0, -len * 0.36, 0); ring(p, M.steel, r * 1.03, r * 0.13, 0, -len * 0.06, 0); ring(p, M.steel, (r + r2) / 2 * 1.04, r * 0.13, 0, -len * 0.66, 0);
    rod(p, M.chrome, r2 * 0.7, r2 * 0.7, len * 0.34, 0, -len * 0.83, 0);
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; bolt(p, 't', [Math.cos(a) * r * 0.75, -len * 0.05, Math.sin(a) * r * 0.75], 0, 0, 0, H.bolt * 0.7); }
    const cx = -(side || 1) * r;
    cable(p, [[cx, -0.02, r * 0.3], [cx * 1.3, -len * 0.5, r * 0.42], [cx * 0.95, -len + 0.03, r * 0.3]], Math.max(0.006, r * 0.11));
    cable(p, [[cx, -0.02, -r * 0.3], [cx * 1.36, -len * 0.45, -r * 0.15], [cx * 0.95, -len + 0.03, -r * 0.3]], Math.max(0.005, r * 0.08), M.red);
  };
  // a hydraulic ram across a joint: the cylinder is pinned at a on the upper part P, the rod at b on the lower part C (a child of P). Each time it is drawn, both turn to point at each other,
  // so the rod slides in and out of the cylinder as the joint bends (whoever bent it: the walk, a wave, a dead machine's twitch)
  const DOWN = new THREE.Vector3(0, -1, 0), UPV = new THREE.Vector3(0, 1, 0);
  const ramCG = (r, L) => G('rc' + r.toFixed(3) + L.toFixed(2), () => { const a = cylG(r, r, L, 10); a.translate(0, -L / 2, 0); const b2 = cylG(r * 1.22, r * 1.22, L * 0.08, 10); b2.translate(0, -L * 0.96, 0); const c2 = cylG(r * 1.18, r * 1.18, L * 0.06, 10); c2.translate(0, -L * 0.05, 0); const e = new THREE.SphereGeometry(r * 1.25, 8, 6); return mergeGeometries([a, b2, c2, e]); });
  const ramRG = (r, L) => G('rr' + r.toFixed(3) + L.toFixed(2), () => { const a = cylG(r, r, L, 8); a.translate(0, L / 2, 0); const e = new THREE.SphereGeometry(r * 2.3, 8, 6); return mergeGeometries([a, e]); });
  const ram = (Pg, Cg, a, bq, rc) => { if (!DT.rams) return;
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(bq[0], bq[1], bq[2]), d = new THREE.Vector3(), qi = new THREE.Quaternion(), rest = d.copy(B).applyQuaternion(Cg.quaternion).add(Cg.position).distanceTo(A);
    const cm = new THREE.Mesh(ramCG(rc, +(rest * H.ram[0]).toFixed(2)), M.grime), rm2 = new THREE.Mesh(ramRG(rc * 0.45, +(rest * H.ram[1]).toFixed(2)), M.chrome); cm.position.copy(A); rm2.position.copy(B); Pg.add(cm); Cg.add(rm2);
    const aim = () => { d.copy(B).applyQuaternion(Cg.quaternion).add(Cg.position).sub(A).normalize(); cm.quaternion.setFromUnitVectors(DOWN, d); rm2.quaternion.setFromUnitVectors(UPV, d.negate().applyQuaternion(qi.copy(Cg.quaternion).invert())); };
    for (const o of [cm, rm2]) o.onBeforeRender = () => { aim(); o.updateMatrix(); o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); };
    aim(); pbox(Pg, M.steel, rc * 1.6, rc * 1.6, rc * 2.6, a[0], a[1], a[2] - Math.sign(a[2]) * rc * 1.6); pbox(Cg, M.steel, rc * 1.4, rc * 1.4, rc * 2.2, bq[0], bq[1], bq[2] - Math.sign(bq[2]) * rc * 1.3); };
  // a joint: a pin through two cheeks with a nut each side, inside a bellows
  const joint = (p, r) => { bellows(p, r * 1.1, 0); rod(p, M.steel, r * 0.5, r * 0.5, r * 2.9, 0, 0, 0, 0, 0, PI / 2, 12); for (const s of [-1, 1]) { put(p, M.steel, hexG(), s * r * 1.5, 0, 0, 0, 0, PI / 2, r * 0.42); box(p, M.grime, r * 0.22, r * 1.9, r * 1.5, s * r * 1.22, -r * 0.2, 0, 0, 0, 0, 0.004); } };
  // a hydraulic leg (same joints and sizes as the phone machine's leg): hip, thigh with a ram, knee, shin with a guard, ankle, a foot with a toe cap and a treaded sole
  const leg = (p, x, up, lo, r, fwd) => {
    const hip = grp(x, 0, 0, p), sg = Math.sign(x || 1); joint(hip, r * 1.15); sleeve(hip, M.grime, r, r * 0.85, up, sg);
    const knee = grp(0, -up, 0, hip); joint(knee, r); sleeve(knee, M.grime, r * 0.8, r * 0.95, lo, sg);
    // rams behind the hip and the knee
    ram(p, hip, [x, -r * 0.1, r * 1.8 * fwd], [0, -Math.min(up * 0.5, r * 4.5), r * 1.2 * fwd], r * 0.3); pbox(p, M.steel, r * 0.5, r * 0.45, r * 1.2, x, -r * 0.1, r * 0.9 * fwd);
    ram(hip, knee, [0, -up + Math.min(up * 0.65, r * 5), r * 1.35 * fwd], [0, -Math.min(lo * 0.35, r * 3), r * 1.25 * fwd], r * 0.26);
    FACES.push({ p: knee, f: fwd > 0 ? 'f' : 'b', c: [0, -lo * 0.4, 0], fw: r * 1.5, fh: lo * 0.5, fn: r + H.plate / 2, plates: [{ u: 0, v: 0, pw: r * 1.5, ph: lo * 0.5 }], mud: true });
    box(knee, M.civic, r * 1.5, lo * 0.5, H.plate, 0, -lo * 0.4, -r * 1.0 * fwd, 0, 0, 0, H.plate * 0.35); for (const [bu, bv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bolt(knee, fwd > 0 ? 'f' : 'b', [0, -lo * 0.4, 0], bu * r * 0.55, bv * lo * 0.2, r * 1.0 + H.plate / 2, H.bolt * 0.8);
    const fy = -lo - r * 0.2, fz = -r * 0.5 * fwd;
    rod(knee, M.steel, r * 0.45, r * 0.45, r * 2.2, 0, -lo + r * 0.15, 0, 0, 0, PI / 2, 12);
    box(knee, M.grime, r * 2.4, r * 0.55, r * 3.8, 0, fy, fz, 0, 0, 0, r * 0.12); box(knee, M.steel, r * 2.5, r * 0.5, r * 0.9, 0, fy - r * 0.02, fz - r * 1.55 * fwd, 0, 0, 0, r * 0.1);
    box(knee, M.rubber, r * 2.3, r * 0.25, r * 3.6, 0, -lo - r * 0.58, fz, 0, 0, 0, r * 0.05); for (let k = 0; k < DT.tread; k++) box(knee, M.rubber, r * 2.3, r * 0.08, r * 0.22, 0, -lo - r * 0.71, fz - r * 1.6 + k * r * 3.2 / Math.max(1, DT.tread - 1), 0, 0, 0, 0.002);
    for (const [bu, bv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bolt(knee, 't', [0, fy, fz], bu * r * 0.9, bv * r * 1.3, r * 0.275);
    box(knee, M.steel, r * 0.5, r * 0.9, r * 0.5, 0, fy + r * 0.5, fz + r * 0.5 * fwd, 0, 0, 0, 0.004);
    mudAt(knee, 0, fy + r * 0.27, fz - r * 0.8 * fwd, r * 0.6, r * 0.42, ri([1, 4])); for (const s of [-1, 1]) mudAt(knee, s * r * 1.2, -lo - r * 0.5, fz, r * 0.4, r * 0.3, ri([0, 2]));
    return { hip, knee, fwd };
  };
  // hands. claw: three two-part fingers on a wrist plate; fork: two tapered tines on a backplate; grip: a tool head with two jaws and a work light; ram: a ribbed pusher plate
  const hand = (fa, kind, y, s) => {
    if (kind === 'claw') { rod(fa, M.steel, 0.05 * s, 0.04 * s, 0.04 * s, 0, y + 0.02 * s, 0, 0, 0, 0, 12);
      for (let k = 0; k < 3; k++) { const a = k * 2.1, cx = Math.cos(a) * 0.04 * s, cz = Math.sin(a) * 0.04 * s; box(fa, M.steel, 0.022 * s, 0.09 * s, 0.03 * s, cx * 1.2, y - 0.04 * s, cz * 1.2, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35, 0.004);
        rod(fa, M.under, 0.014 * s, 0.014 * s, 0.034 * s, cx * 1.55, y - 0.085 * s, cz * 1.55, 0, -a, PI / 2, 8); rod(fa, M.steel, 0.012 * s, 0.005 * s, 0.1 * s, cx * 1.3, y - 0.13 * s, cz * 1.3, -Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4, 6); } }
    else if (kind === 'fork') { box(fa, M.steel, 0.22, 0.14, 0.03, 0, y + 0.03, 0.05, 0, 0, 0, 0.006); for (const sx of [-0.06, 0.06]) { box(fa, M.steel, 0.07, 0.035, 0.34, sx, y, -0.12, 0, 0, 0, 0.006); put(fa, M.steel, cylG(0.001, 0.035, 0.12, 4), sx, y, -0.35, -PI / 2, PI / 4, 0, 1, 1, 0.5); box(fa, M.steel, 0.07, 0.11, 0.025, sx, y + 0.045, 0.025, 0, 0, 0, 0.004); }
      for (const sx of [-0.08, 0.08]) bolt(fa, 'f', [sx, y + 0.06, 0.05], 0, 0, 0.015); }
    else if (kind === 'grip') { box(fa, M.grime, 0.12, 0.1, 0.14, 0, y, 0, 0, 0, 0, 0.012); for (const sx of [-1, 1]) { box(fa, M.steel, 0.018, 0.1, 0.05, sx * 0.04, y - 0.09, -0.02, 0, 0, sx * 0.25, 0.004); box(fa, M.steel, 0.016, 0.05, 0.045, sx * 0.022, y - 0.15, -0.02, 0, 0, -sx * 0.5, 0.003); }
      lamp(fa, 'f', [0, y, 0], 0, 0.01, 0.07, 0.022); }
    else { box(fa, M.steel, 0.3 * s, 0.12 * s, 0.34 * s, 0, y, -0.05 * s, 0, 0, 0, 0.012); for (let k = 0; k < 5; k++) box(fa, M.under, 0.3 * s, 0.014, 0.03, 0, y - 0.065 * s, -0.19 * s + k * 0.07 * s, 0, 0, 0, 0.003); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bolt(fa, 't', [sx * 0.11 * s, y, -0.05 * s + sz * 0.12 * s], 0, 0, 0.06 * s, H.bolt * 1.3); }
  };
  // an arm: shoulder joint, upper sleeve, elbow joint (the group the game bends: userData.fore), forearm, hand
  const arm = (p, x, y, z, r, len, r2, len2, kind, hs, rm0) => {
    const ar = grp(x, y, z, p), sg = Math.sign(x || 1); joint(ar, r * 1.3); sleeve(ar, M.grime, r, r * 0.88, len, sg);
    const fa = grp(0, -len, 0, ar); ar.userData.fore = fa; joint(fa, r2 * 1.25); sleeve(fa, M.grime, r2, r2 * 0.85, len2, sg);
    if (rm0) ram(ar, fa, [0, -len + Math.min(len * 0.65, r * 5), r * 1.4], [0, -Math.min(len2 * 0.35, r2 * 3), r2 * 1.3], r * 0.28); if (kind) hand(fa, kind, -len2 - 0.02, hs || 1);
    return ar;
  };
  const gait = (legs, ph, stride, kneeA, limpLeg, limp) => legs.forEach((L, i) => { const lim = i === limpLeg ? limp : 1, p = (ph + i / legs.length) % 1; let th, k = 0; if (p < 0.65) th = stride - 2 * stride * (p / 0.65); else { const e = (p - 0.65) / 0.35; th = -stride + 2 * stride * e; k = kneeA * Math.sin(PI * e) * lim; } L.hip.rotation.x = th * lim; L.knee.rotation.x = (k + 0.08) * L.fwd; });
  const flick = (face, u, a, b) => face.color.setScalar(within(u, a, a + 0.35) || within(u, b, b + 0.35) || rnd() < W.flicker ? 0.25 : 1);
  const ri = (a) => a[0] + Math.floor(rnd() * (a[1] - a[0] + 1));
  // what years outside add to any machine: wires hanging from its body, moss where water sits
  const age = (p, w, y0, y1, d, topY) => { for (let k = ri(H.hang); k > 0; k--) hang(p, (rnd() - 0.5) * w, y0 + rnd() * (y1 - y0), (rnd() < 0.5 ? -1 : 1) * d / 2); for (let k = ri(H.moss); k > 0; k--) moss(p, (rnd() - 0.5) * w * 0.8, topY, (rnd() - 0.5) * d * 0.8, 0.04 + 0.04 * rnd()); };

  // ---------------------------------------------------------------- 1. Walker: the municipal service machine
  // 1a. From the Blender model (src/gloomglb.js) when it is switched on (quality.high.gloom.models.walker) and loaded: same nodes, pivots, rams, display and night pose as the builder below.
  // a model copy with this machine's paint shade; reroll() (LAG FIX Nov 19, the Gloom pool in src/main.js) gives a reused machine a new shade from the same spread
  const tinted = (kind, base, sh) => { const sc = glbCopy(kind, new THREE.Color(sh.r / base.r, sh.g / base.g, sh.b / base.b).multiplyScalar(H.models.tint)), DP = W.paints;
    sc.userData.reroll = () => { const s2 = base.clone().offsetHSL((rnd() - 0.5) * DP.hue, (rnd() - 0.5) * DP.sat, (rnd() - 0.5) * DP.light); sc.userData.tintU.value.set(s2.r / base.r, s2.g / base.g, s2.b / base.b).multiplyScalar(H.models.tint); }; return sc; };
  const DOWNG = new THREE.Vector3(0, -1, 0), UPG = new THREE.Vector3(0, 1, 0);
  const ramGlb = (cm, rm2) => { const Cg = rm2.parent, A = cm.position.clone(), B = rm2.position.clone(), d = new THREE.Vector3(), qi = new THREE.Quaternion();
    const aim = () => { d.copy(B).applyQuaternion(Cg.quaternion).add(Cg.position).sub(A).normalize(); cm.quaternion.setFromUnitVectors(DOWNG, d); rm2.quaternion.setFromUnitVectors(UPG, d.negate().applyQuaternion(qi.copy(Cg.quaternion).invert())); };
    for (const o of [cm, rm2]) o.onBeforeRender = () => { aim(); o.updateMatrix(); o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); };
    aim(); };
  function walkerGlb(b, K, face) {
    const S = W.shape, hipY = S.hip, thigh = S.thigh, shin = S.shin, DP = W.paints, base = new THREE.Color(DP.walker), sh = base.clone().offsetHSL((rnd() - 0.5) * DP.hue, (rnd() - 0.5) * DP.sat, (rnd() - 0.5) * DP.light);
    const sc = tinted('walker', base, sh); b.add(sc);
    const n = (k) => sc.getObjectByName(k), pelvis = n('pelvis'), torso = n('torso'), head = n('head');
    const legs = [0, 1].map((i) => ({ hip: n('hip' + i), knee: n('knee' + i), fwd: 1 })), arms = [0, 1].map((i) => { const a = n('arm' + i); a.userData.fore = n('fore' + i); return a; });
    const rams = []; sc.traverse((o) => { if (o.name.startsWith('ramc_') && n('ramr_' + o.name.slice(5))) rams.push([o, n('ramr_' + o.name.slice(5))]); }); if (DT.rams) for (const [c2, r2] of rams) ramGlb(c2, r2); else for (const [c2, r2] of rams) { c2.visible = false; r2.visible = false; }
    // the display: the screen at the back of the model's recess, the glass across its opening, the glow in front
    const sa = n('screen'), z0 = sa.position.z, w = S.head[0] - 0.1, h = S.head[1] - 0.09, D2 = E.displayTex('walker', K, W); face.map = D2.tex;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face); scr.position.set(0, sa.position.y, z0 + H.recess); scr.rotation.y = PI; head.add(scr);
    const hl = E.halo(head, 0, sa.position.y, z0 - 0.06, Math.max(w, h) * H.halo[0], K.screen); hl.material = hl.material.clone(); hl.material.opacity = 0; scr.onBeforeRender = () => { hl.material.opacity = H.halo[1] * Math.min(1, face.color.r); };
    if (DT.glass) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.012, h + 0.012), M.glass); gl.position.set(0, sa.position.y, z0 + 0.002); gl.rotation.y = PI; head.add(gl); }
    let ph = 0, tw = 0, twT = 0;
    const step = () => legs.forEach((L, i) => { const lim = i === S.limpLeg ? S.limp : 1, p = ((ph + i * 0.5) % 1); let th, k = 0; if (p < 0.65) th = S.stride - 2 * S.stride * (p / 0.65); else { const e = (p - 0.65) / 0.35; th = -S.stride + 2 * S.stride * e; k = S.knee * Math.sin(PI * e) * lim; } L.hip.rotation.x = th * lim; L.knee.rotation.x = k + 0.08; });
    return { head, arms, legs, top: S.top, keepScale: true, glb: true, say: (text) => D2.draw(text), night(q, u, mv) {
      const wv = within(u, 1, 9.4), up = wv ? 1 : 0; ph += mv / (2 * S.stride * (thigh + shin) / 0.6); step();
      const sway = Math.sin(ph * 2 * PI), lim = Math.sin(ph * 2 * PI + S.limpLeg * PI);
      pelvis.rotation.z = S.sway * sway; pelvis.position.y = hipY - S.dip * Math.abs(Math.sin(ph * 2 * PI)) - (lim > 0.6 ? S.limpDrop * (lim - 0.6) : 0); torso.rotation.x = S.lean; torso.rotation.z = -S.sway * 0.6 * sway;
      arms[0].rotation.z = up * 1.9 * Math.min(1, (u - 1) * 0.6); arms[0].userData.fore.rotation.z = up * 0.5; arms[1].rotation.x = 0.12 * Math.sin(ph * 2 * PI + 1.2); arms[1].rotation.z = -0.05;
      if (q > twT) { tw = (rnd() - 0.5) * S.twitch; twT = q + 1.5 + rnd() * 4; } tw *= 0.85;
      head.rotation.z = -pelvis.rotation.z - torso.rotation.z + tw; head.rotation.x = -S.lean * 0.7; head.rotation.y = 0.1 * Math.sin(q * 0.4) + tw * 2;
      face.color.setScalar(within(u, 3, 3.35) || within(u, 7.2, 7.55) || rnd() < W.flicker ? 0.25 : 1); } };
  }
  // 1b. The builder's own Walker (also the fallback while the model loads or if it fails)
  function walker(b, K, face) {
    if (H.models && glbModel('walker')) return walkerGlb(b, K, face);
    const S = W.shape, legs = [], arms = [], hipY = S.hip, thigh = S.thigh, shin = S.shin, ch = S.chest, pelvis = grp(0, hipY, 0, b);
    for (const sx of [-1, 1]) { const L = leg(pelvis, sx * S.hipW, thigh, shin, 0.11, 1); legs.push(L); }
    box(pelvis, M.steel, S.hipW * 2 + 0.1, 0.09, 0.14, 0, 0, 0, 0, 0, 0, 0.01);
    const torso = grp(0, 0.08, 0, pelvis); casing(torso, M.civic, 0.62, 0.18, 0.46, 0, 0.05, 0, { front: [3, 1], side: [2, 1], top: [1, 1] });
    // the barrel chest: a dark core inside eight curved plates, two bolted bands round it
    const by = 0.14 + S.torso / 2, gone = DT.interiors ? Math.floor(rnd() * 8) : -1; put(torso, M.under, new THREE.CylinderGeometry(ch * 0.9, ch * 1.02, S.torso, 24, 1), 0, by, 0, 0, 0, 0, 1, 1, 0.78);
    for (let k = 0; k < 8; k++) { if (k === gone || rnd() < H.missing) { hang(torso, Math.sin(k * PI / 4 + 0.39) * ch, by + 0.1, Math.cos(k * PI / 4 + 0.39) * ch * 0.78);
        // inside the gap: three hoops of the frame, a strut, wiring
        if (DT.interiors) { for (const f of [0.18, 0.5, 0.82]) { const rr = ch * (1.12 - 0.12 * f) * 0.95; put(torso, M.steel, new THREE.CylinderGeometry(rr, rr, 0.022, 6, 1, true, k * PI / 4, PI / 4), 0, by - S.torso / 2 + f * S.torso, 0, 0, 0, 0, 1, 1, 0.78); }
          const am = k * PI / 4 + 0.39, rm = ch * 1.0; rod(torso, M.steel, 0.01, 0.01, S.torso - 0.04, Math.sin(am) * rm, by, Math.cos(am) * rm * 0.78, 0, 0, 0, 6);
          for (let j = 0; j < H.cables; j++) { const a0 = k * PI / 4 + 0.1 + 0.2 * j; cable(torso, [[Math.sin(a0) * rm, by + 0.2, Math.cos(a0) * rm * 0.78], [Math.sin(a0 + 0.15) * rm * 0.98, by + 0.02 * j, Math.cos(a0 + 0.15) * rm * 0.76], [Math.sin(a0 + 0.05) * rm, by - 0.2, Math.cos(a0 + 0.05) * rm * 0.78]], 0.005, j === 0 ? M.red : j === 1 ? M.yel : M.rubber); } }
        continue; } put(torso, M.civic, new THREE.CylinderGeometry(ch, ch * 1.12, S.torso - 0.03, 5, 1, true, k * PI / 4 + 0.03, PI / 4 - 0.06), 0, by, 0, 0, 0, 0, 1, 1, 0.78); }
    for (const yy of [0.32, 0.55]) { const rr = ch * (1.12 - 0.12 * (yy - 0.14) / S.torso) + 0.004; put(torso, M.steel, new THREE.CylinderGeometry(rr, rr, 0.03, 28, 1, true), 0, yy, 0, 0, 0, 0, 1, 1, 0.78); for (let k = 0; k < 14; k++) { const a = k / 14 * 2 * PI; put(torso, M.steel, hexG(), Math.sin(a) * (rr + 0.004), yy, Math.cos(a) * (rr + 0.004) * 0.78, PI / 2, a, 0, H.bolt * 0.8); } }
    stencil(torso, 0, 0.42, -ch * 0.84, 0.42); vent(torso, 'f', [0.22, 0.24, 0], 0, 0, ch * 0.84, 0.18, 0.08);
    // the power pack on its back, with a vent, two hoses to the shoulders and a filler cap
    casing(torso, M.grime, 0.38, 0.34, 0.14, 0, 0.42, ch * 0.78 + 0.05, { front: [1, 1], back: [2, 1], side: [1, 1], open: ['f'] }); vent(torso, 'b', [0, 0.42, ch * 0.78 + 0.05], 0, 0.04, 0.07, 0.26, 0.12); rod(torso, M.steel, 0.03, 0.03, 0.03, 0.12, 0.6, ch * 0.78 + 0.05, 0, 0, 0, 10);
    const yoke = 0.14 + S.torso; casing(torso, M.civic, 0.78, 0.12, 0.4, 0, yoke, 0, { front: [3, 1], side: [1, 1], top: [3, 1] }); for (const sx of [-0.27, 0.27]) eye(torso, sx, yoke + 0.06, 0.1, PI / 2); tag(torso, 'f', [0, 0.1, 0], -0.2, 0, 0.23); hatch(torso, 'b', [0, 0.42, ch * 0.78 + 0.05], 0, -0.1, 0.07, 0.2, 0.1, M.grime);
    for (const sx of [-1, 1]) { arms.push(arm(torso, sx * 0.46, yoke - 0.04, 0, 0.07, S.arm, 0.06, S.arm, 'claw', 1, true)); run(torso, [sx * 0.2, yoke + 0.02, 0.21], [sx * 0.44, yoke - 0.05, 0.1], 0.05, H.cables); run(torso, [sx * 0.12, 0.56, ch * 0.78 + 0.12], [sx * 0.3, yoke + 0.05, 0.16], 0.03, 1, 0.012); handle(torso, sx > 0 ? 'r' : 'l', [0, yoke, 0], 0, 0, 0.39, 0.12); }
    const neck = grp(0, yoke + 0.06, 0, torso); bellows(neck, 0.075, 0.02); rod(neck, M.steel, 0.05, 0.05, 0.14, 0, 0.09, 0, 0, 0, 0, 12); for (const sx of [-1, 1]) rod(neck, M.chrome, 0.012, 0.012, 0.16, sx * 0.08, 0.1, 0.03, 0, 0, sx * 0.25, 6);
    const head = grp(0, S.headUp, 0, neck), z0 = 0.02 - S.head[2] / 2; casing(head, M.civic, S.head[0], S.head[1], S.head[2], 0, 0, 0.02, { open: ['f'], side: [1, 1], back: [2, 1], inset: 0.03 });
    const D2 = display(head, S.head[0] - 0.1, S.head[1] - 0.09, z0, 'walker', K, face, false, S.head[0], S.head[1]);
    vent(head, 'b', [0, 0, 0.02], 0, 0, S.head[2] / 2, 0.2, 0.1); rod(head, M.steel, 0.006, 0.004, 0.3, S.head[0] / 2 - 0.04, S.head[1] / 2 + 0.15, 0.1, 0, 0, -0.15, 5); for (const sx of [-1, 1]) lamp(head, sx > 0 ? 'r' : 'l', [0, 0, 0.02], 0, 0.02, S.head[0] / 2, 0.03);
    leaves(pelvis, 8, 0, 0.4); age(torso, 0.6, 0.2, 0.6, 0.5, yoke + 0.06); moss(head, -0.1, S.head[1] / 2, 0.06, 0.05); bake(b);
    let ph = 0, tw = 0, twT = 0;
    const step = () => legs.forEach((L, i) => { const lim = i === S.limpLeg ? S.limp : 1, p = ((ph + i * 0.5) % 1); let th, k = 0; if (p < 0.65) th = S.stride - 2 * S.stride * (p / 0.65); else { const e = (p - 0.65) / 0.35; th = -S.stride + 2 * S.stride * e; k = S.knee * Math.sin(PI * e) * lim; } L.hip.rotation.x = th * lim; L.knee.rotation.x = k + 0.08; });
    return { head, arms, legs, top: S.top, keepScale: true, say: (text) => D2.draw(text), night(q, u, mv) {
      const wv = within(u, 1, 9.4), up = wv ? 1 : 0; ph += mv / (2 * S.stride * (thigh + shin) / 0.6); step();
      const sway = Math.sin(ph * 2 * PI), lim = Math.sin(ph * 2 * PI + S.limpLeg * PI);
      pelvis.rotation.z = S.sway * sway; pelvis.position.y = hipY - S.dip * Math.abs(Math.sin(ph * 2 * PI)) - (lim > 0.6 ? S.limpDrop * (lim - 0.6) : 0); torso.rotation.x = S.lean; torso.rotation.z = -S.sway * 0.6 * sway;
      arms[0].rotation.z = up * 1.9 * Math.min(1, (u - 1) * 0.6); arms[0].userData.fore.rotation.z = up * 0.5; arms[1].rotation.x = 0.12 * Math.sin(ph * 2 * PI + 1.2); arms[1].rotation.z = -0.05;
      if (q > twT) { tw = (rnd() - 0.5) * S.twitch; twT = q + 1.5 + rnd() * 4; } tw *= 0.85;
      head.rotation.z = -pelvis.rotation.z - torso.rotation.z + tw; head.rotation.x = -S.lean * 0.7; head.rotation.y = 0.1 * Math.sin(q * 0.4) + tw * 2;
      face.color.setScalar(within(u, 3, 3.35) || within(u, 7.2, 7.55) || rnd() < W.flicker ? 0.25 : 1); } };
  }

  // ---------------------------------------------------------------- 2. Lurcher: the inspection unit on reverse knees
  // 2a. From the Blender model (src/gloomglb.js) when quality.high.gloom.models.lurcher is on and loaded: curved shells, same nodes, pivots and night pose as the builder below.
  // The model stands upright at rest; like the builder, the torso is leaned (rotation.x -0.5) and the arms reach forward (0.6) here.
  const roundScreen = (w, h, r) => { const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
    s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    const g = new THREE.ShapeGeometry(s, 6), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5); return g; };
  function lurcherGlb(b, K, face) {
    const DP = W.paints, base = new THREE.Color(DP.lurcher), sh = base.clone().offsetHSL((rnd() - 0.5) * DP.hue, (rnd() - 0.5) * DP.sat, (rnd() - 0.5) * DP.light);
    const sc = tinted('lurcher', base, sh); b.add(sc);
    const n = (k) => sc.getObjectByName(k), pelvis = n('pelvis'), torso = n('torso'), head = n('head');
    const legs = [0, 1].map((i) => ({ hip: n('hip' + i), knee: n('knee' + i), fwd: -1 })), arms = [0, 1].map((i) => { const a = n('arm' + i); a.userData.fore = n('fore' + i); a.rotation.x = 0.6; return a; });
    torso.rotation.x = -0.5;
    const rams = []; sc.traverse((o) => { if (o.name.startsWith('ramc_') && n('ramr_' + o.name.slice(5))) rams.push([o, n('ramr_' + o.name.slice(5))]); }); if (DT.rams) for (const [c2, r2] of rams) ramGlb(c2, r2); else for (const [c2, r2] of rams) { c2.visible = false; r2.visible = false; }
    // the display: a round-cornered screen at the back of the pod's well, the glass across it, the glow in front
    const sa = n('screen'), z0 = sa.position.z, w = 0.26, h = 0.19, D2 = E.displayTex('lurcher', K, W); face.map = D2.tex;
    const scr = new THREE.Mesh(roundScreen(w, h, 0.05), face); scr.position.set(0, sa.position.y, z0 + H.recess); scr.rotation.y = PI; head.add(scr);
    const hl = E.halo(head, 0, sa.position.y, z0 - 0.06, Math.max(w, h) * H.halo[0], K.screen); hl.material = hl.material.clone(); hl.material.opacity = 0; scr.onBeforeRender = () => { hl.material.opacity = H.halo[1] * Math.min(1, face.color.r); };
    if (DT.glass) { const gl = new THREE.Mesh(roundScreen(w + 0.012, h + 0.012, 0.055), M.glass); gl.position.set(0, sa.position.y, z0 + 0.002); gl.rotation.y = PI; head.add(gl); }
    let ph = 0;
    return { head, arms, legs, top: 1.9, keepScale: true, glb: true, lamp: [1.45, -0.6], say: (t) => D2.draw(t), night(q, u, mv) { const lunge = within(u, 4, 4.35) || within(u, 8.2, 8.5); ph += mv / 0.5; gait(legs, ph, 0.3, 0.7, 0, 0.8);
      pelvis.position.y = 0.92 - 0.04 * Math.abs(Math.sin(ph * 2 * PI)); torso.rotation.x = lunge ? -0.95 : -0.5 + 0.04 * Math.sin(ph * 4 * PI); head.position.z = lunge ? -0.4 : -0.12; head.rotation.x = lunge ? 0.4 : 0.15 + 0.08 * Math.sin(q * 3.1);
      arms.forEach((a, i) => { a.rotation.x = lunge ? -0.4 : 0.6 + 0.2 * Math.sin(ph * 2 * PI + i * PI); }); flick(face, u, 2.5, 6.6); } };
  }
  // 2b. The builder's own Lurcher (also the fallback while the model loads or if it fails)
  function lurcher(b, K, face) {
    if (H.models && glbModel('lurcher')) return lurcherGlb(b, K, face);
    const legs = [], arms = [], pelvis = grp(0, 0.92, 0, b);
    for (const sx of [-1, 1]) legs.push(leg(pelvis, sx * 0.2, 0.42, 0.5, 0.075, -1));
    box(pelvis, M.steel, 0.52, 0.08, 0.12, 0, 0, 0, 0, 0, 0, 0.01); rod(pelvis, M.under, 0.07, 0.07, 0.1, 0, 0.04, 0, 0, 0, 0, 14);
    const torso = grp(0, 0.05, 0, pelvis); torso.rotation.x = -0.5; casing(torso, M.civic, 0.5, 0.55, 0.4, 0, 0.3, 0, { front: [2, 2], side: [1, 2], back: [1, 1], top: [2, 1], hole: true }); eye(torso, 0.15, 0.575, 0.1); tag(torso, 'f', [0, 0.3, 0], 0.13, 0.18, 0.2); hatch(torso, 'f', [0, 0.3, 0], -0.12, 0.15, 0.2, 0.16, 0.14); stencil(torso, 0, 0.25, -0.205, 0.32);
    // cooling fins and a battery box down its back, a vent on each flank
    for (let k = 0; k < 7; k++) box(torso, M.steel, 0.3, 0.012, 0.06, 0, 0.12 + k * 0.05, 0.225, 0, 0, 0, 0.002); box(torso, M.grime, 0.34, 0.08, 0.1, 0, 0.5, 0.22, 0, 0, 0, 0.01);
    for (const f of ['l', 'r']) vent(torso, f, [0, 0.3, 0], 0, 0.1, 0.25, 0.2, 0.1);
    const neck = grp(0, 0.6, -0.12, torso); bellows(neck, 0.06, 0); rod(neck, M.steel, 0.04, 0.045, 0.32, 0, 0.16, -0.06, 0, 0, 0, 12); rod(neck, M.chrome, 0.012, 0.012, 0.3, 0.05, 0.16, -0.02, 0, 0, 0, 6); ring(neck, M.steel, 0.048, 0.008, 0, 0.1, -0.06); ring(neck, M.steel, 0.046, 0.008, 0, 0.24, -0.06);
    cable(neck, [[-0.04, 0.0, 0.02], [-0.09, 0.14, 0.03], [-0.05, 0.3, -0.04]], 0.008); cable(neck, [[-0.02, 0.0, 0.04], [-0.07, 0.16, 0.07], [-0.03, 0.3, -0.02]], 0.006, M.yel);
    const head = grp(0, 0.34, -0.12, neck); casing(head, M.civic, 0.32, 0.26, 0.24, 0, 0, 0.02, { open: ['f'], side: [1, 1], back: [1, 1], inset: 0.03 }); const D = display(head, 0.26, 0.19, -0.1, 'lurcher', K, face, false, 0.32, 0.26);
    for (const sx of [-1, 1]) { rod(head, M.under, 0.035, 0.035, 0.04, sx * 0.18, 0.02, 0.02, 0, 0, PI / 2, 12); lamp(head, sx > 0 ? 'r' : 'l', [0, 0.02, 0.02], 0, 0, 0.2, 0.022); } vent(head, 'b', [0, 0, 0.02], 0, 0, 0.12, 0.16, 0.08);
    for (const sx of [-1, 1]) { const ar = arm(torso, sx * 0.3, 0.5, 0, 0.05, 0.5, 0.045, 0.45, 'claw', 1.1, true); ar.rotation.x = 0.6; arms.push(ar); run(torso, [sx * 0.2, 0.56, 0.1], [sx * 0.29, 0.5, 0.04], 0.03, 2, 0.007); }
    leaves(pelvis, 6, 0, 0.4); age(torso, 0.5, 0.1, 0.5, 0.42, 0.58); bake(b); let ph = 0;
    return { head, arms, legs, top: 1.9, keepScale: true, lamp: [1.45, -0.6], say: (t) => D.draw(t), night(q, u, mv) { const lunge = within(u, 4, 4.35) || within(u, 8.2, 8.5); ph += mv / 0.5; gait(legs, ph, 0.3, 0.7, 0, 0.8);
      pelvis.position.y = 0.92 - 0.04 * Math.abs(Math.sin(ph * 2 * PI)); torso.rotation.x = lunge ? -0.95 : -0.5 + 0.04 * Math.sin(ph * 4 * PI); head.position.z = lunge ? -0.4 : -0.12; head.rotation.x = lunge ? 0.4 : 0.15 + 0.08 * Math.sin(q * 3.1);
      arms.forEach((a, i) => { a.rotation.x = lunge ? -0.4 : 0.6 + 0.2 * Math.sin(ph * 2 * PI + i * PI); }); flick(face, u, 2.5, 6.6); } };
  }

  // ---------------------------------------------------------------- 3. Hauler: the freight loader
  // 3a. From the Blender model (src/gloomglb.js) when quality.high.gloom.models.hauler is on and loaded: same nodes (pelvis, torso, head on the torso, hips, knees, arms, forearms),
  // rams and night code as the builder below; the arms reach forward 0.15 at rest like the builder's. Its legs are 17% longer (coordinator, Nov 17: heavy, not toy-like),
  // so its pelvis rides at PELY (0.84) instead of 0.72 and it stands 0.12 m taller.
  function haulerGlb(b, K, face) {
    const PELY = 0.84;
    const DP = W.paints, base = new THREE.Color(DP.hauler), sh = base.clone().offsetHSL((rnd() - 0.5) * DP.hue, (rnd() - 0.5) * DP.sat, (rnd() - 0.5) * DP.light);
    const sc = tinted('hauler', base, sh); b.add(sc);
    const n = (k) => sc.getObjectByName(k), pelvis = n('pelvis'), torso = n('torso'), head = n('head');
    const legs = [0, 1].map((i) => ({ hip: n('hip' + i), knee: n('knee' + i), fwd: 1 })), arms = [0, 1].map((i) => { const a = n('arm' + i); a.userData.fore = n('fore' + i); a.rotation.x = 0.15; return a; });
    const rams = []; sc.traverse((o) => { if (o.name.startsWith('ramc_') && n('ramr_' + o.name.slice(5))) rams.push([o, n('ramr_' + o.name.slice(5))]); }); if (DT.rams) for (const [c2, r2] of rams) ramGlb(c2, r2); else for (const [c2, r2] of rams) { c2.visible = false; r2.visible = false; }
    const sa = n('screen'), z0 = sa.position.z, w = 0.42, h = 0.28, D = E.displayTex('hauler', K, W); face.map = D.tex;
    const scr = new THREE.Mesh(roundScreen(w, h, 0.06), face); scr.position.set(0, sa.position.y, z0 + H.recess); scr.rotation.y = PI; head.add(scr);
    const hl = E.halo(head, 0, sa.position.y, z0 - 0.06, Math.max(w, h) * H.halo[0], K.screen); hl.material = hl.material.clone(); hl.material.opacity = 0; scr.onBeforeRender = () => { hl.material.opacity = H.halo[1] * Math.min(1, face.color.r); };
    if (DT.glass) { const gl = new THREE.Mesh(roundScreen(w + 0.012, h + 0.012, 0.065), M.glass); gl.position.set(0, sa.position.y, z0 + 0.002); gl.rotation.y = PI; head.add(gl); }
    let ph = 0;
    return { head, arms, legs, top: 2.47, keepScale: true, glb: true, lamp: [2.12, -0.5], say: (t) => D.draw(t), night(q, u, mv) { const ham = within(u, 7, 9.8), k = ham ? (u - 7) % 0.7 : 0, dn = ham && k > 0.4; ph += mv / 0.75; gait(legs, ph, 0.18, 0.4, 1, 0.7);
      pelvis.position.y = PELY - 0.05 * Math.abs(Math.sin(ph * 2 * PI)); torso.rotation.z = 0.04 * Math.sin(ph * 2 * PI);
      arms.forEach((a) => { a.rotation.x = ham ? (dn ? 0.2 : -2.3) : 0.15 + 0.06 * Math.sin(ph * 2 * PI); }); torso.rotation.x = dn ? 0.12 : 0; flick(face, u, 3, 5.8); } };
  }
  // 3b. The builder's own Hauler (also the fallback while the model loads or if it fails)
  function hauler(b, K, face) {
    if (H.models && glbModel('hauler')) return haulerGlb(b, K, face);
    const legs = [], arms = [], pelvis = grp(0, 0.72, 0, b);
    for (const sx of [-1, 1]) legs.push(leg(pelvis, sx * 0.36, 0.34, 0.36, 0.12, 1));
    box(pelvis, M.steel, 0.9, 0.1, 0.2, 0, 0, 0, 0, 0, 0, 0.012);
    const torso = grp(0, 0.05, 0, pelvis), c = [0, 0.55, 0]; casing(torso, M.civic, 1.0, 0.9, 0.7, 0, 0.55, 0, { front: [3, 3], side: [2, 3], back: [2, 2], top: [1, 1], hole: true, ribs: 'lr' }); hatch(torso, 'f', c, 0.2, 0.18, 0.35, 0.3, 0.24); tag(torso, 'f', c, -0.33, 0.3, 0.35); for (const sx of [-0.3, 0.3]) eye(torso, sx, 1.08, 0); casing(torso, M.civic, 0.86, 0.08, 0.58, 0, 1.04, 0, { front: [3, 1], side: [2, 1], top: [2, 2] });
    stencil(torso, -0.22, 0.35, -0.356, 0.4); vent(torso, 'f', c, 0.27, -0.2, 0.35, 0.3, 0.16); vent(torso, 'b', c, 0, 0.1, 0.35, 0.5, 0.3); for (const f of ['l', 'r']) { vent(torso, f, c, 0.1, 0.2, 0.5, 0.26, 0.14); for (let k = 0; k < 3; k++) handle(torso, f, c, -0.18, -0.25 + k * 0.2, 0.5, 0.14); }
    // a bumper bar, a cargo rail round the roof deck, an exhaust stack with a rain cap, two headlamps
    rod(torso, M.steel, 0.025, 0.025, 1.06, 0, 0.16, -0.4, 0, 0, PI / 2, 10); for (const sx of [-0.4, 0.4]) box(torso, M.steel, 0.04, 0.05, 0.08, sx, 0.16, -0.37, 0, 0, 0, 0.005);
    for (const [px, pz] of [[-0.4, -0.26], [0.4, -0.26], [-0.4, 0.26], [0.4, 0.26]]) rod(torso, M.steel, 0.012, 0.012, 0.12, px, 1.14, pz, 0, 0, 0, 6); for (const pz of [-0.26, 0.26]) rod(torso, M.steel, 0.012, 0.012, 0.82, 0, 1.2, pz, 0, 0, PI / 2, 6); for (const px of [-0.4, 0.4]) rod(torso, M.steel, 0.012, 0.012, 0.54, px, 1.2, 0, PI / 2, 0, 0, 6);
    rod(torso, M.steel, 0.04, 0.04, 0.5, 0.36, 1.25, 0.28, 0, 0, 0, 12); rod(torso, M.under, 0.06, 0.045, 0.04, 0.36, 1.53, 0.28, 0, 0, 0, 12); for (const sx of [-0.36, 0.36]) lamp(torso, 'f', c, sx, -0.3, 0.35, 0.05);
    const head = grp(0, 1.25, -0.05, torso); casing(head, M.civic, 0.5, 0.36, 0.32, 0, 0, 0, { open: ['f'], side: [1, 1], back: [2, 1], inset: 0.03 }); const D = display(head, 0.42, 0.28, -0.16, 'hauler', K, face, false, 0.5, 0.36);
    rod(head, M.steel, 0.04, 0.045, 0.03, 0.15, 0.195, 0.05, 0, 0, 0, 12); put(head, E.glow('amber', 0xffc040), new THREE.SphereGeometry(0.035, 12, 8), 0.15, 0.215, 0.05, 0, 0, 0, 1, 1.2, 1); vent(head, 'b', [0, 0, 0], 0, 0, 0.16, 0.3, 0.12);
    for (const sx of [-1, 1]) { const ar = arm(torso, sx * 0.6, 0.9, 0, 0.09, 0.5, 0.08, 0.42, 'fork', 1, true); ar.rotation.x = 0.15; arms.push(ar); }
    for (let k = 0; k < 3; k++) cable(torso, [[-0.3 + k * 0.3, 1.0, 0.3], [-0.42 + k * 0.42, 0.82, 0.4], [-0.5 + k * 0.5, 0.6, 0.37]], 0.014, k === 1 ? M.red : M.rubber);
    leaves(pelvis, 8, 0.05, 0.6); leaves(torso, 6, 1.1, 0.7); age(torso, 1.0, 0.2, 0.9, 0.72, 1.09); bake(b); let ph = 0;
    return { head, arms, legs, top: 2.35, keepScale: true, lamp: [2.0, -0.5], say: (t) => D.draw(t), night(q, u, mv) { const ham = within(u, 7, 9.8), k = ham ? (u - 7) % 0.7 : 0, dn = ham && k > 0.4; ph += mv / 0.75; gait(legs, ph, 0.18, 0.4, 1, 0.7);
      pelvis.position.y = 0.72 - 0.05 * Math.abs(Math.sin(ph * 2 * PI)); torso.rotation.z = 0.04 * Math.sin(ph * 2 * PI);
      arms.forEach((a) => { a.rotation.x = ham ? (dn ? 0.2 : -2.3) : 0.15 + 0.06 * Math.sin(ph * 2 * PI); }); torso.rotation.x = dn ? 0.12 : 0; flick(face, u, 3, 5.8); } };
  }

  // ---------------------------------------------------------------- 4. Stilt: the streetlight maintenance unit
  // 4a. From the Blender model (src/gloomglb.js) when quality.high.gloom.models.stilt is on and loaded: same nodes (pelvis, torso, head on the torso, hips, knees,
  // arm0 = the working arm 'up' with fore0, arm1 = the stump 'off'), pivots, rams and night code as the builder below.
  function stiltGlb(b, K, face) {
    const DP = W.paints, base = new THREE.Color(DP.stilt), sh = base.clone().offsetHSL((rnd() - 0.5) * DP.hue, (rnd() - 0.5) * DP.sat, (rnd() - 0.5) * DP.light);
    const sc = tinted('stilt', base, sh); b.add(sc);
    const n = (k) => sc.getObjectByName(k), pelvis = n('pelvis'), torso = n('torso'), head = n('head'), up = n('arm0'), fa = n('fore0'), off = n('arm1');
    const legs = [0, 1].map((i) => ({ hip: n('hip' + i), knee: n('knee' + i), fwd: 1 })), arms = [up, off]; up.userData.fore = fa;
    const rams = []; sc.traverse((o) => { if (o.name.startsWith('ramc_') && n('ramr_' + o.name.slice(5))) rams.push([o, n('ramr_' + o.name.slice(5))]); }); if (DT.rams) for (const [c2, r2] of rams) ramGlb(c2, r2); else for (const [c2, r2] of rams) { c2.visible = false; r2.visible = false; }
    const sa = n('screen'), z0 = sa.position.z, w = 0.3, h = 0.21, D = E.displayTex('stilt', K, W); face.map = D.tex;
    const scr = new THREE.Mesh(roundScreen(w, h, 0.045), face); scr.position.set(0, sa.position.y, z0 + H.recess); scr.rotation.y = PI; head.add(scr);
    const hl = E.halo(head, 0, sa.position.y, z0 - 0.06, Math.max(w, h) * H.halo[0], K.screen); hl.material = hl.material.clone(); hl.material.opacity = 0; scr.onBeforeRender = () => { hl.material.opacity = H.halo[1] * Math.min(1, face.color.r); };
    if (DT.glass) { const gl = new THREE.Mesh(roundScreen(w + 0.012, h + 0.012, 0.05), M.glass); gl.position.set(0, sa.position.y, z0 + 0.002); gl.rotation.y = PI; head.add(gl); }
    let ph = 0;
    return { head, arms, legs, top: 3.5, keepScale: true, glb: true, lamp: [3.12, -0.3], say: (t) => D.draw(t), night(q, u, mv) { const reach = within(u, 5, 7.4), away = within(u, 3, 5); ph += mv / 1.1; gait(legs, ph, 0.14, 0.35, 0, 0.85);
      pelvis.position.y = 2.2 - 0.03 * Math.abs(Math.sin(ph * 2 * PI)); torso.rotation.z = 0.05 * Math.sin(ph * 2 * PI); head.rotation.y = away ? 1.6 : 0.15 * Math.sin(q * 0.3);
      up.rotation.x = reach ? -1.9 : 0.1; fa.rotation.x = reach ? -0.3 : 0.05; flick(face, u, 2, 8.5); } };
  }
  // 4b. The builder's own Stilt (also the fallback while the model loads or if it fails)
  function stilt(b, K, face) {
    if (H.models && glbModel('stilt')) return stiltGlb(b, K, face);
    const legs = [], arms = [], pelvis = grp(0, 2.2, 0, b);
    for (const sx of [-1, 1]) legs.push(leg(pelvis, sx * 0.16, 1.1, 1.05, 0.065, 1));
    box(pelvis, M.steel, 0.44, 0.08, 0.12, 0, 0, 0, 0, 0, 0, 0.01);
    const torso = grp(0, 0.05, 0, pelvis), c = [0, 0.3, 0]; casing(torso, M.civic, 0.44, 0.55, 0.34, 0, 0.3, 0, { front: [2, 2], side: [1, 2], back: [1, 2], top: [1, 1], hole: true }); eye(torso, -0.14, 0.575, 0.1); tag(torso, 'f', c, 0.1, 0.17, 0.17); hatch(torso, 'f', c, -0.1, 0.14, 0.17, 0.15, 0.16); stencil(torso, 0, 0.25, -0.172, 0.3);
    // a cable drum on its back, a tool rack on one flank, a vent on the other
    rod(torso, M.under, 0.1, 0.1, 0.12, 0, 0.3, 0.24, 0, 0, PI / 2, 16); for (const sx of [-1, 1]) rod(torso, M.steel, 0.13, 0.13, 0.01, sx * 0.065, 0.3, 0.24, 0, 0, PI / 2, 16); for (let k = 0; k < 5; k++) put(torso, M.rubber, new THREE.TorusGeometry(0.105, 0.01, 5, 16), -0.045 + k * 0.022, 0.3, 0.24, 0, PI / 2, 0);
    vent(torso, 'l', c, 0, 0.1, 0.22, 0.2, 0.1); for (let k = 0; k < 3; k++) { const q = fp('r', c, -0.08 + k * 0.08, -0.02, 0.235); rod(torso, k === 1 ? M.chrome : M.steel, 0.012, 0.01, 0.26, q[0], q[1], q[2], 0, 0, 0, 6); } { const q = fp('r', c, 0, -0.12, 0.235); box(torso, M.steel, 0.012, 0.03, 0.26, q[0], q[1], q[2], 0, 0, 0, 0.003); }
    rod(torso, M.steel, 0.035, 0.04, 0.12, 0, 0.62, 0, 0, 0, 0, 10);
    const head = grp(0, 0.82, 0, torso); bellows(head, 0.06, -0.2); casing(head, M.civic, 0.36, 0.28, 0.26, 0, 0, 0, { open: ['f'], side: [1, 1], back: [1, 1], inset: 0.03 }); const D = display(head, 0.3, 0.21, -0.13, 'stilt', K, face, false, 0.36, 0.28);
    lamp(head, 'r', [0, 0, 0], -0.05, 0.04, 0.18, 0.04); vent(head, 'b', [0, 0, 0], 0, 0, 0.13, 0.2, 0.1); rod(head, M.steel, 0.005, 0.003, 0.35, -0.14, 0.3, 0.08, 0, 0, 0.1, 5);
    const up = grp(0.24, 0.5, 0, torso); arms.push(up); joint(up, 0.075); sleeve(up, M.grime, 0.045, 0.04, 0.7, 1);
    const fa = grp(0, -0.7, 0, up); up.userData.fore = fa; joint(fa, 0.06); rod(fa, M.steel, 0.035, 0.035, 0.4, 0, -0.2, 0, 0, 0, 0, 12); rod(fa, M.chrome, 0.026, 0.026, 0.36, 0, -0.56, 0, 0, 0, 0, 12); ring(fa, M.steel, 0.037, 0.007, 0, -0.4, 0); hand(fa, 'grip', -0.78, 1); cable(fa, [[0.03, -0.02, 0.04], [0.06, -0.4, 0.07], [0.03, -0.72, 0.05]], 0.006);
    const off = grp(-0.24, 0.5, 0, torso); arms.push(off); joint(off, 0.065); rod(off, M.grime, 0.04, 0.035, 0.5, 0, -0.25, 0, 0, 0, 0, 12); ring(off, M.steel, 0.04, 0.007, 0, -0.06, 0); for (let k = 0; k < 3; k++) hang(off, (k - 1) * 0.012, -0.5, 0, 0.12 + 0.1 * rnd());
    leaves(pelvis, 5, 0, 0.3); age(torso, 0.44, 0.1, 0.5, 0.36, 0.58); bake(b); let ph = 0;
    return { head, arms, legs, top: 3.5, keepScale: true, lamp: [3.12, -0.3], say: (t) => D.draw(t), night(q, u, mv) { const reach = within(u, 5, 7.4), away = within(u, 3, 5); ph += mv / 1.1; gait(legs, ph, 0.14, 0.35, 0, 0.85);
      pelvis.position.y = 2.2 - 0.03 * Math.abs(Math.sin(ph * 2 * PI)); torso.rotation.z = 0.05 * Math.sin(ph * 2 * PI); head.rotation.y = away ? 1.6 : 0.15 * Math.sin(q * 0.3);
      up.rotation.x = reach ? -1.9 : 0.1; fa.rotation.x = reach ? -0.3 : 0.05; flick(face, u, 2, 8.5); } };
  }

  // ---------------------------------------------------------------- 5. Lantern: the public-address lighting unit
  // 5a. From the Blender model (src/gloomglb.js) when quality.high.gloom.models.lantern is on and loaded: same nodes (hub, mount0..2 with hip/knee legs, arm0 boom, pend, head),
  // pivots, rams and night code as the builder below; the leg mounts are turned here like the builder's (rotation.y = a, x = 0.35); the glowing globe and its halo are the builder's.
  function lanternGlb(b, K, face) {
    const DP = W.paints, base = new THREE.Color(DP.lantern), sh = base.clone().offsetHSL((rnd() - 0.5) * DP.hue, (rnd() - 0.5) * DP.sat, (rnd() - 0.5) * DP.light);
    const sc = tinted('lantern', base, sh); b.add(sc);
    const n = (k) => sc.getObjectByName(k), hub = n('hub'), armG = n('arm0'), pend = n('pend'), head = n('head'), arms = [armG];
    const legs = [0, 1, 2].map((k) => { const m = n('mount' + k); m.rotation.y = k * 2.094 + 0.5; m.rotation.x = 0.35; return { hip: n('hip' + k), knee: n('knee' + k), fwd: 1 }; });
    const rams = []; sc.traverse((o) => { if (o.name.startsWith('ramc_') && n('ramr_' + o.name.slice(5))) rams.push([o, n('ramr_' + o.name.slice(5))]); }); if (DT.rams) for (const [c2, r2] of rams) ramGlb(c2, r2); else for (const [c2, r2] of rams) { c2.visible = false; r2.visible = false; }
    const sa = n('screen'), z0 = sa.position.z, w = 0.3, h = 0.22, D = E.displayTex('lantern', K, W); face.map = D.tex;
    const scr = new THREE.Mesh(roundScreen(w, h, 0.045), face); scr.position.set(0, sa.position.y, z0 + H.recess); scr.rotation.y = PI; head.add(scr);
    const hs = E.halo(head, 0, sa.position.y, z0 - 0.06, Math.max(w, h) * H.halo[0], K.screen); hs.material = hs.material.clone(); hs.material.opacity = 0; scr.onBeforeRender = () => { hs.material.opacity = H.halo[1] * Math.min(1, face.color.r); };
    if (DT.glass) { const gl = new THREE.Mesh(roundScreen(w + 0.012, h + 0.012, 0.05), M.glass); gl.position.set(0, sa.position.y, z0 + 0.002); gl.rotation.y = PI; head.add(gl); }
    const glob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), E.glow('amber', 0xffc040)); glob.position.set(0, -0.25, 0); head.add(glob);
    const hl = E.halo(head, 0, -0.26, 0, 0.5, 0xffc040); hl.material = hl.material.clone(); hl.material.opacity = 0.08;
    let ph = 0;
    return { head: pend, arms, legs, top: 2.6, keepScale: true, glb: true, lamp: [1.85, -0.58], say: (t) => D.draw(t), night(q, u, mv) { const rg = within(u, 4, 5.2) || within(u, 9, 9.6); ph += mv / 0.5; gait(legs, ph, 0.12, 0.3, 2, 0.8);
      hub.position.y = 1.0 - 0.03 * Math.abs(Math.sin(ph * 3 * PI)); pend.rotation.z = rg ? 0.35 * Math.sin(q * 11) : 0.14 * Math.sin(q * 1.1); pend.rotation.x = 0.08 * Math.sin(q * 0.7);
      hl.material.opacity = rg ? 0.35 : 0.08; hl.scale.setScalar(rg ? 1.5 + 0.3 * Math.sin(q * 20) : 1); flick(face, u, 7, 10.2); } };
  }
  // 5b. The builder's own Lantern (also the fallback while the model loads or if it fails)
  function lantern(b, K, face) {
    if (H.models && glbModel('lantern')) return lanternGlb(b, K, face);
    const legs = [], arms = [], hub = grp(0, 1.0, 0, b);
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.5, g = grp(Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2, hub); g.rotation.y = a; g.rotation.x = 0.35; legs.push(leg(g, 0, 0.5, 0.55, 0.06, 1)); }
    casing(hub, M.civic, 0.4, 0.3, 0.4, 0, 0.1, 0, { front: [2, 1], side: [2, 1], back: [2, 1], top: [1, 1], hole: true, mud: 'flrb' }); tag(hub, 'f', [0, 0.1, 0], -0.1, 0.05, 0.2); for (const f of ['l', 'r']) hatch(hub, f, [0, 0.1, 0], 0, 0, 0.2, 0.2, 0.16); vent(hub, 'f', [0, 0.1, 0], 0.09, 0, 0.2, 0.14, 0.1); vent(hub, 'b', [0, 0.1, 0], 0, 0, 0.2, 0.2, 0.1);
    // the mast: collars, climbing pegs, a cable wound up it; the loudspeaker horn on a bracket
    rod(hub, M.steel, 0.05, 0.06, 1.1, 0, 0.8, 0, 0, 0, 0, 14); for (const yy of [0.3, 0.7, 1.1]) ring(hub, M.steel, 0.062 - (yy - 0.3) * 0.008, 0.012, 0, yy, 0); for (let k = 0; k < 6; k++) rod(hub, M.steel, 0.007, 0.007, 0.16, 0, 0.42 + k * 0.13, 0, 0, k * 1.2, PI / 2, 5);
    { const pts = []; for (let k = 0; k <= 16; k++) { const a = k * 1.1; pts.push([Math.sin(a) * 0.066, 0.28 + k * 0.062, Math.cos(a) * 0.066]); } cable(hub, pts, 0.007); }
    { const pts = [[0.03, -0.15], [0.036, -0.08], [0.06, 0.02], [0.105, 0.1], [0.16, 0.15], [0.168, 0.15], [0.112, 0.094], [0.066, 0.016], [0.042, -0.08], [0.036, -0.15]].map((q) => new THREE.Vector2(q[0], q[1])); put(hub, M.grime, new THREE.LatheGeometry(pts, 20), 0, 1.3, -0.12, -PI / 2 + 0.2, 0, 0);
      put(hub, M.steel, new THREE.TorusGeometry(0.164, 0.007, 5, 20), 0, 1.3 + 0.15 * Math.sin(0.2), -0.12 - 0.15 * Math.cos(0.2), 0.2, 0, 0); rod(hub, M.under, 0.045, 0.045, 0.1, 0, 1.3 - 0.19 * Math.sin(0.2), -0.12 + 0.19 * Math.cos(0.2), -PI / 2 + 0.2, 0, 0, 12); box(hub, M.steel, 0.03, 0.05, 0.14, 0, 1.3, 0.0, 0, 0, 0, 0.004); }
    const armG = grp(0, 1.32, 0, hub); arms.push(armG); box(armG, M.steel, 0.06, 0.06, 0.6, 0, 0, -0.3, 0, 0, 0, 0.008); cable(armG, [[0, -0.32, -0.05], [0, -0.16, -0.3], [0, -0.03, -0.52]], 0.012, M.steel); rod(armG, M.steel, 0.02, 0.02, 0.09, 0, 0, -0.58, 0, 0, PI / 2, 8); cable(armG, [[0.03, 0.02, 0], [0.04, 0.0, -0.3], [0.02, -0.04, -0.58]], 0.006);
    const pend = grp(0, 0, -0.58, armG); for (let k = 0; k < 6; k++) put(pend, M.steel, new THREE.TorusGeometry(0.02, 0.005, 5, 10), 0, -0.02 - k * 0.036, 0, 0, k % 2 ? PI / 2 : 0, 0); cable(pend, [[0.02, 0.0, 0], [0.05, -0.12, 0.01], [0.03, -0.23, 0]], 0.005);
    const head = grp(0, -0.42, 0, pend); casing(head, M.civic, 0.38, 0.36, 0.3, 0, 0, 0, { open: ['f'], side: [1, 1], back: [1, 1], inset: 0.03 }); const D = display(head, 0.3, 0.22, -0.15, 'lantern', K, face, false, 0.38, 0.36);
    put(head, M.grime, new THREE.ConeGeometry(0.3, 0.09, 4), 0, 0.225, 0, 0, PI / 4, 0, 1, 1, 0.82); vent(head, 'b', [0, 0, 0], 0, 0, 0.15, 0.22, 0.12);
    // the lamp under the box, in a wire cage
    rod(head, M.steel, 0.05, 0.06, 0.04, 0, -0.195, 0, 0, 0, 0, 12); put(head, E.glow('amber', 0xffc040), new THREE.SphereGeometry(0.07, 16, 12), 0, -0.25, 0);
    for (let k = 0; k < 4; k++) put(head, M.steel, new THREE.TorusGeometry(0.085, 0.004, 4, 16, PI), 0, -0.21, 0, PI, k * PI / 4, 0); ring(head, M.steel, 0.085, 0.004, 0, -0.25, 0);
    const hl = E.halo(head, 0, -0.26, 0, 0.5, 0xffc040); hl.material = hl.material.clone(); hl.material.opacity = 0.08;
    leaves(hub, 6, 0, 0.4); age(hub, 0.4, 0, 0.25, 0.42, 0.26); bake(b); let ph = 0;
    return { head: pend, arms, legs, top: 2.6, keepScale: true, lamp: [1.85, -0.58], say: (t) => D.draw(t), night(q, u, mv) { const rg = within(u, 4, 5.2) || within(u, 9, 9.6); ph += mv / 0.5; gait(legs, ph, 0.12, 0.3, 2, 0.8);
      hub.position.y = 1.0 - 0.03 * Math.abs(Math.sin(ph * 3 * PI)); pend.rotation.z = rg ? 0.35 * Math.sin(q * 11) : 0.14 * Math.sin(q * 1.1); pend.rotation.x = 0.08 * Math.sin(q * 0.7);
      hl.material.opacity = rg ? 0.35 : 0.08; hl.scale.setScalar(rg ? 1.5 + 0.3 * Math.sin(q * 20) : 1); flick(face, u, 7, 10.2); } };
  }

  // ---------------------------------------------------------------- 6. Ticks: three floor-cleaning units
  // 6a. From the Blender model (src/gloomglb.js) when quality.high.gloom.models.ticks is on and loaded: ONE unit in the file, copied three times at the builder's places and scales,
  // each with its own paint shade; same groups (body, sg), same screen tilt and night code as the builder below.
  function ticksGlb(b, K, face) {
    const all = [], DP = W.paints, base = new THREE.Color(DP.ticks), D = E.displayTex('ticks', K, W); face.map = D.tex;
    [[0, -0.28, 1], [-0.5, 0.32, 0.86], [0.48, 0.26, 1.1]].forEach(([x, z, s]) => { const t = grp(x, 0, z, b); t.scale.setScalar(s);
      const sh = base.clone().offsetHSL((rnd() - 0.5) * DP.hue, (rnd() - 0.5) * DP.sat, (rnd() - 0.5) * DP.light), sc = tinted('ticks', base, sh); t.add(sc);
      const body = sc.getObjectByName('body'), sg = sc.getObjectByName('sg'), sa = sc.getObjectByName('screen'); sg.rotation.x = -0.35;
      const w = 0.2, h = 0.13, z0 = sa.position.z, scr = new THREE.Mesh(roundScreen(w, h, 0.03), face); scr.position.set(sa.position.x, sa.position.y, z0 + H.recess); scr.rotation.y = PI; sg.add(scr);
      const hl = E.halo(sg, sa.position.x, sa.position.y, z0 - 0.06, Math.max(w, h) * H.halo[0], K.screen); hl.material = hl.material.clone(); hl.material.opacity = 0; scr.onBeforeRender = () => { hl.material.opacity = H.halo[1] * Math.min(1, face.color.r); };
      if (DT.glass) { const gl = new THREE.Mesh(roundScreen(w + 0.01, h + 0.01, 0.034), M.glass); gl.position.set(sa.position.x, sa.position.y, z0 + 0.002); gl.rotation.y = PI; sg.add(gl); }
      all.push({ t, body, sg, x, z }); });
    let ph = 0;
    return { head: all[0].sg, heads: all.map((A) => A.sg), arms: [], top: 0.75, low: true, keepScale: true, glb: true, lamp: [0.42, -0.48], say: (t) => D.draw(t), night(q, u, mv) { const held = within(u, 1.6, 2.4); if (!held) ph += 0.6 + mv * 14;
      for (const [n, T2] of all.entries()) { T2.t.position.x = T2.x + (held ? 0 : 0.06 * Math.sin(ph * 1.7 + n * 2)); T2.t.position.z = T2.z + (held ? 0 : 0.05 * Math.cos(ph * 1.3 + n)); T2.body.rotation.y = held ? 0 : 0.3 * Math.sin(ph * 0.9 + n * 3); T2.body.position.y = 0.16 + (held ? 0 : 0.008 * Math.sin(ph * 9 + n)); }
      flick(face, u, 0.5, 1.2); } };
  }
  // 6b. The builder's own Ticks (also the fallback while the model loads or if it fails)
  function ticks(b, K, face) {
    if (H.models && glbModel('ticks')) return ticksGlb(b, K, face);
    const all = []; let D = null;
    [[0, -0.28, 1], [-0.5, 0.32, 0.86], [0.48, 0.26, 1.1]].forEach(([x, z, s]) => { const t = grp(x, 0, z, b); t.scale.setScalar(s); const body = grp(0, 0.16, 0, t);
      casing(body, M.civic, 0.44, 0.2, 0.5, 0, 0.06, 0, { front: [2, 1], side: [2, 1], back: [2, 1], top: [2, 2], hole: s === 1, mud: 'flrb' }); hatch(body, 't', [0, 0.06, 0], -0.1, 0.17, 0.1, 0.12, 0.09); casing(body, M.civic, 0.36, 0.12, 0.34, 0, 0.21, 0.04, { front: [1, 1], side: [1, 1], back: [1, 1], top: [1, 1] });
      // a rubber bumper, a brush skirt of bristles, two side brushes, four wheels with hubs, a carry handle, a vent, charging strips, a whisker
      box(body, M.rubber, 0.47, 0.05, 0.03, 0, 0.0, -0.262, 0, 0, 0, 0.01); for (const sx of [-1, 1]) box(body, M.rubber, 0.03, 0.05, 0.2, sx * 0.232, 0.0, -0.17, 0, 0, 0, 0.01);
      rod(body, M.rubber, 0.24, 0.25, 0.03, 0, -0.055, 0, 0, 0, 0, 20); for (let k = 0; k < H.bristles; k++) { const a = k / H.bristles * 2 * PI; put(body, M.under, new THREE.ConeGeometry(0.012, 0.075, 4), Math.sin(a) * 0.25, -0.1, Math.cos(a) * 0.25, Math.cos(a) * 0.35 + PI, 0, -Math.sin(a) * 0.35); }
      for (const sx of [-1, 1]) { rod(body, M.under, 0.07, 0.07, 0.012, sx * 0.21, -0.12, -0.24, 0, 0, 0, 12); for (let k = 0; k < 8; k++) rod(body, M.yel, 0.004, 0.002, 0.07, sx * 0.21 + Math.sin(k * 0.785) * 0.085, -0.135, -0.24 + Math.cos(k * 0.785) * 0.085, Math.cos(k * 0.785) * 1.2, 0, -Math.sin(k * 0.785) * 1.2, 4); }
      for (const [wx, wz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) { rod(body, M.rubber, 0.06, 0.06, 0.05, wx, -0.08, wz, 0, 0, PI / 2, 16); rod(body, M.steel, 0.032, 0.032, 0.056, wx, -0.08, wz, 0, 0, PI / 2, 10); put(body, M.steel, hexG(), wx + Math.sign(wx) * 0.03, -0.08, wz, 0, 0, PI / 2, 0.012); }
      handle(body, 't', [0, 0.21, 0.04], 0, 0.06, 0.06, 0.16); vent(body, 't', [0, 0.06, 0], 0.1, 0.19, 0.1, 0.12, 0.05); for (const sx of [-0.05, 0.05]) box(body, M.chrome, 0.03, 0.05, 0.004, sx, 0.05, 0.252, 0, 0, 0, 0.001); rod(body, M.steel, 0.003, 0.002, 0.22, 0.14, 0.36, 0.14, 0.2, 0, -0.2, 4);
      for (const sx of [-0.14, 0.14]) lamp(body, 'f', [0, 0.06, 0], sx, 0.02, 0.25, 0.022);
      const sg = grp(0, 0.2, -0.17, body); sg.rotation.x = -0.35; box(sg, M.under, 0.25, 0.18, 0.04, 0, 0, 0.026, 0, 0, 0, 0.006); const d = display(sg, 0.2, 0.13, -0.02, 'ticks', K, face, false, 0.25, 0.18); if (!D) D = d;
      leaves(body, 2, 0.1, 0.3); if (rnd() < 0.6) moss(body, (rnd() - 0.5) * 0.2, 0.27, 0.08, 0.035); if (rnd() < 0.5) hang(body, 0.2, 0.1, 0.2, 0.12); all.push({ t, body, sg, x, z }); });
    bake(b); let ph = 0;
    return { head: all[0].sg, heads: all.map((A) => A.sg), arms: [], top: 0.75, low: true, keepScale: true, lamp: [0.42, -0.48], say: (t) => D.draw(t), night(q, u, mv) { const held = within(u, 1.6, 2.4); if (!held) ph += 0.6 + mv * 14;
      for (const [n, T2] of all.entries()) { T2.t.position.x = T2.x + (held ? 0 : 0.06 * Math.sin(ph * 1.7 + n * 2)); T2.t.position.z = T2.z + (held ? 0 : 0.05 * Math.cos(ph * 1.3 + n)); T2.body.rotation.y = held ? 0 : 0.3 * Math.sin(ph * 0.9 + n * 3); T2.body.position.y = 0.16 + (held ? 0 : 0.008 * Math.sin(ph * 9 + n)); }
      flick(face, u, 0.5, 1.2); } };
  }

  // ---------------------------------------------------------------- 7. Warden: the security unit on tracks
  // 7a. From the Blender model (src/gloomglb.js) when quality.high.gloom.models.warden is on and loaded: same nodes (base, torso, head with g1 / g2, arms, forearms),
  // pivots, rams and night code as the builder below; the left screen (g1) is live, the right one (g2) dead, like the builder's.
  function wardenGlb(b, K, face) {
    const DP = W.paints, base = new THREE.Color(DP.warden), sh = base.clone().offsetHSL((rnd() - 0.5) * DP.hue, (rnd() - 0.5) * DP.sat, (rnd() - 0.5) * DP.light);
    const sc = tinted('warden', base, sh); b.add(sc);
    const n = (k) => sc.getObjectByName(k), torso = n('torso'), g1 = n('g1'), g2 = n('g2');
    const arms = [0, 1].map((i) => { const a = n('arm' + i); a.userData.fore = n('fore' + i); return a; });
    const rams = []; sc.traverse((o) => { if (o.name.startsWith('ramc_') && n('ramr_' + o.name.slice(5))) rams.push([o, n('ramr_' + o.name.slice(5))]); }); if (DT.rams) for (const [c2, r2] of rams) ramGlb(c2, r2); else for (const [c2, r2] of rams) { c2.visible = false; r2.visible = false; }
    const w = 0.34, h = 0.27, D = E.displayTex('warden', K, W); face.map = D.tex;
    for (const [g, sa, live] of [[g1, n('screen'), true], [g2, n('screen2'), false]]) { const z0 = sa.position.z, scr = new THREE.Mesh(roundScreen(w, h, 0.05), live ? face : M.dark); scr.position.set(sa.position.x, sa.position.y, z0 + H.recess); scr.rotation.y = PI; g.add(scr);
      if (live) { const hl = E.halo(g, sa.position.x, sa.position.y, z0 - 0.06, Math.max(w, h) * H.halo[0], K.screen); hl.material = hl.material.clone(); hl.material.opacity = 0; scr.onBeforeRender = () => { hl.material.opacity = H.halo[1] * Math.min(1, face.color.r); }; }
      if (DT.glass) { const gl = new THREE.Mesh(roundScreen(w + 0.012, h + 0.012, 0.055), M.glass); gl.position.set(sa.position.x, sa.position.y, z0 + 0.002); gl.rotation.y = PI; g.add(gl); } }
    let ph = 0;
    return { head: torso, arms, top: 3.0, keepScale: true, glb: true, lamp: [2.4, -0.55], say: (t) => D.draw(t), night(q, u, mv) { const greet = within(u, 3, 6.5), ram = within(u, 6.5, 7); ph += mv;
      arms[0].rotation.z = greet ? -1.9 : 0.05 * Math.sin(ph * 2); arms[1].rotation.z = greet ? 1.9 : -0.05 * Math.sin(ph * 2); arms[0].userData.fore.rotation.z = greet ? -0.5 * (Math.floor(u * 1.2) % 2) : 0;
      torso.rotation.x = ram ? -0.25 : 0.02 * Math.sin(q * 1.4); torso.rotation.y = within(u, 9, 11) ? 0.45 : 0; torso.position.y = 0.7 + 0.01 * Math.sin(ph * 12); flick(face, u, 4, 10); } };
  }
  // 7b. The builder's own Warden (also the fallback while the model loads or if it fails)
  function warden(b, K, face) {
    if (H.models && glbModel('warden')) return wardenGlb(b, K, face);
    const arms = [], base = grp(0, 0, 0, b), R = 0.21, L = 0.44, cy = 0.24, per = 4 * L + 2 * PI * R, n = H.links, pitch = per / n;
    for (const sx of [-1, 1]) {
      // the track: links with a grouser bar outside and guide teeth inside, laid round a stadium path
      for (let k = 0; k < n; k++) { let s = k * pitch, py, pz, ny, nz;
        if (s < 2 * L) { py = cy - R; pz = -L + s; ny = -1; nz = 0; } else if ((s -= 2 * L) < PI * R) { const a = s / R; py = cy - R * Math.cos(a); pz = L + R * Math.sin(a); ny = -Math.cos(a); nz = Math.sin(a); }
        else if ((s -= PI * R) < 2 * L) { py = cy + R; pz = L - s; ny = 1; nz = 0; } else { const a = (s - 2 * L) / R; py = cy + R * Math.cos(a); pz = -L - R * Math.sin(a); ny = Math.cos(a); nz = -Math.sin(a); }
        const rx = Math.atan2(nz, ny), x = sx * 0.55; box(base, M.rubber, 0.34, 0.022, pitch * 0.86, x, py - ny * 0.011, pz - nz * 0.011, rx, 0, 0, 0.004); pbox(base, M.steel, 0.34, 0.014, pitch * 0.25, x, py + ny * 0.006, pz + nz * 0.006, rx, 0, 0);
        for (const tx of [-0.06, 0.06]) pbox(base, M.steel, 0.02, 0.03, pitch * 0.4, x + tx, py - ny * 0.035, pz - nz * 0.035, rx, 0, 0); }
      // road wheels with rubber tyres, hubs and wheel nuts; the end wheels carry sprocket teeth; a skirt and a mudguard
      for (let k = 0; k < 4; k++) { const wz = -0.45 + k * 0.3, wr = 0.176, x = sx * 0.55; rod(base, M.rubber, wr, wr, 0.3, x, cy, wz, 0, 0, PI / 2, 20); rod(base, M.grime, wr * 0.72, wr * 0.72, 0.32, x, cy, wz, 0, 0, PI / 2, 16); rod(base, M.steel, 0.045, 0.045, 0.36, x, cy, wz, 0, 0, PI / 2, 10);
        for (let j = 0; j < 6; j++) put(base, M.steel, hexG(), x + sx * 0.165, cy + Math.cos(j * 1.047) * 0.085, wz + Math.sin(j * 1.047) * 0.085, 0, 0, PI / 2, 0.014);
        if (k === 0 || k === 3) for (let j = 0; j < 12; j++) { const a = j * PI / 6; pbox(base, M.steel, 0.03, 0.03, 0.03, x + sx * 0.14, cy + Math.cos(a) * 0.185, wz + Math.sin(a) * 0.185, a, 0, 0); } }
      box(base, M.grime, 0.36, 0.016, 1.3, sx * 0.55, 0.475, 0, 0, 0, 0, 0.004); box(base, M.civic, 0.016, 0.14, 1.2, sx * 0.735, 0.41, 0, 0, 0, 0, 0.004); for (let k = 0; k < 6; k++) bolt(base, sx > 0 ? 'r' : 'l', [0, 0.44, 0], -0.5 + k * 0.2, 0, 0.743);
    }
    casing(base, M.grime, 0.74, 0.3, 1.1, 0, 0.5, 0, { front: [2, 1], side: [3, 1], back: [2, 1], top: [1, 2], mud: 'fb' }); for (const sx of [-1, 1]) { FACES.push({ p: base, f: sx > 0 ? 'r' : 'l', c: [0, 0.41, 0], fw: 1.2, fh: 0.14, fn: 0.743, plates: [{ u: 0, v: 0, pw: 1.2, ph: 0.14 }], mud: true }); mudAt(base, sx * 0.55, 0.483, 0, 0.13, 0.06, ri([2, 5])); } for (const sx of [-0.25, 0.25]) lamp(base, 'f', [0, 0.5, 0], sx, 0, 0.55, 0.05); box(base, M.steel, 0.2, 0.06, 0.05, 0, 0.42, -0.57, 0, 0, 0, 0.008);
    const torso = grp(0, 0.7, 0, base), c = [0, 0.62, 0]; casing(torso, M.civic, 1.15, 1.2, 0.8, 0, 0.62, 0, { front: [3, 3], side: [2, 3], back: [2, 3], top: [2, 1], hole: true, ribs: 'lrb' }); for (const sx of [-0.3, 0.3]) hatch(torso, 'f', c, sx, 0.3, 0.4, 0.3, 0.34); tag(torso, 'f', c, 0, 0.5, 0.4); for (const sx of [-0.4, 0.4]) eye(torso, sx, 1.22, 0.25); stencil(torso, 0.3, 0.2, -0.405, 0.4);
    // a ram frame of three bars in front, vents on the flanks, a generator and exhaust on the back, armour over the shoulders
    for (let k = 0; k < 3; k++) rod(torso, M.steel, 0.028, 0.028, 1.2, 0, 0.12 + k * 0.16, -0.5, 0, 0, PI / 2, 10); for (const sx of [-0.45, 0, 0.45]) { box(torso, M.steel, 0.04, 0.44, 0.04, sx, 0.28, -0.5, 0, 0, 0, 0.005); box(torso, M.steel, 0.04, 0.04, 0.1, sx, 0.2, -0.45, 0, 0, 0, 0.005); }
    for (const f of ['l', 'r']) { vent(torso, f, c, 0.12, -0.25, 0.575, 0.34, 0.2); handle(torso, f, c, -0.2, 0.1, 0.575, 0.2); } vent(torso, 'f', c, -0.3, -0.38, 0.4, 0.3, 0.12);
    casing(torso, M.grime, 0.6, 0.5, 0.2, 0, 0.5, 0.5, { front: [1, 1], back: [2, 2], side: [1, 1], open: ['f'] }); vent(torso, 'b', [0, 0.5, 0.5], 0, 0.05, 0.1, 0.4, 0.24); rod(torso, M.steel, 0.045, 0.045, 0.7, 0.42, 1.0, 0.46, 0, 0, 0, 12); rod(torso, M.under, 0.065, 0.05, 0.05, 0.42, 1.37, 0.46, 0, 0, 0, 12);
    for (const sx of [-1, 1]) { box(torso, M.civic, 0.3, 0.02, 0.6, sx * 0.62, 1.26, 0, 0, 0, sx * -0.3, 0.006); run(torso, [sx * 0.3, 1.0, 0.41], [sx * 0.6, 1.12, 0.12], 0.06, H.cables, 0.012); }
    const head = grp(0, 1.55, -0.02, torso); casing(head, M.civic, 0.9, 0.42, 0.5, 0, 0, 0, { open: ['f'], side: [2, 1], back: [3, 1], top: [3, 1], inset: 0.03 });
    const g1 = grp(-0.21, 0, 0, head), g2 = grp(0.21, 0, 0, head), D = display(g1, 0.34, 0.27, -0.25, 'warden', K, face, false, 0.45, 0.42); display(g2, 0.34, 0.27, -0.25, 'warden', K, face, true, 0.45, 0.42);
    // the light bar, two aerials, a camera dome under the head
    box(head, M.dark, 0.8, 0.075, 0.09, 0, 0.245, -0.2, 0, 0, 0, 0.01); for (let k = 0; k < 5; k++) box(head, k % 2 ? E.glow('wred', 0xff4030) : M.lens, 0.13, 0.05, 0.03, -0.3 + k * 0.15, 0.245, -0.24, 0, 0, 0, 0.006);
    for (const sx of [-0.38, 0.38]) { rod(head, M.steel, 0.006, 0.003, 0.5, sx, 0.46, 0.18, 0, 0, sx * 0.3, 5); rod(head, M.under, 0.016, 0.02, 0.04, sx, 0.22, 0.18, 0, 0, 0, 8); } ballH(head, M.dark, 0.06, 0, -0.22, -0.16, 1, 0.8, 1); vent(head, 'b', [0, 0, 0], 0, 0, 0.25, 0.5, 0.16);
    for (const sx of [-1, 1]) arms.push(arm(torso, sx * 0.68, 1.1, 0, 0.12, 0.6, 0.11, 0.55, 'ram', 1, true));
    leaves(base, 10, 0.55, 0.8); leaves(torso, 6, 1.24, 0.9); age(torso, 1.15, 0.2, 1.1, 0.82, 1.23); moss(base, 0.5, 0.485, 0.3, 0.07); moss(base, -0.55, 0.485, -0.4, 0.06); bake(b); let ph = 0;
    return { head: torso, arms, top: 3.0, keepScale: true, lamp: [2.4, -0.55], say: (t) => D.draw(t), night(q, u, mv) { const greet = within(u, 3, 6.5), ram = within(u, 6.5, 7); ph += mv;
      arms[0].rotation.z = greet ? -1.9 : 0.05 * Math.sin(ph * 2); arms[1].rotation.z = greet ? 1.9 : -0.05 * Math.sin(ph * 2); arms[0].userData.fore.rotation.z = greet ? -0.5 * (Math.floor(u * 1.2) % 2) : 0;
      torso.rotation.x = ram ? -0.25 : 0.02 * Math.sin(q * 1.4); torso.rotation.y = within(u, 9, 11) ? 0.45 : 0; torso.position.y = 0.7 + 0.01 * Math.sin(ph * 12); flick(face, u, 4, 10); } };
  }
  return { walker, lurcher, hauler, stilt, lantern, ticks, warden };
}
