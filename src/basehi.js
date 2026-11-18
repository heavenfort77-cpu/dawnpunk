// The base, MASTER build (2026-11-16; owner: desktop priority, "the desktop version gets its own assets"). Used on the high tier (HIBASE below); phones, and ?fx=0,
// keep the base of src/baseview.js, the devices of src/bloomtech.js and the cats of src/props.js until a tested low setting exists (CONFIG.quality.low.base is null).
// catHi(): the lucky cat rebuilt as a modelled ceramic figure in the SAME painted wraps (calico, kuro, kutani: the body is a lathe whose UVs lie like the phone sphere's, so the
// klad paint lands where it was painted): a pear-shaped body with haunches, a wide head with whisker pads, a mouth, nose and whiskers, ears with a hollow, eyes with a glint,
// a collar with a bell (slot, band and loop), a koban coin with a raised rim and stamped lines under a resting paw, a raised paw with pads and toes, a tail curled round the base;
// glazed ceramic under a clear coat, gold as metal. detailDevice(): every bloom-tech device gets copper bands with rivets on its ceramic shells, a lip on every rim,
// a ribbed copper cage over every glass dome, a frame and a midrib on every solar petal, collars where stems meet. station()/home(): the vaulted buildings get ribs over the vault,
// a cornice, corner pilasters, a course of glazed tiles above the plinth, gutters and downpipes, a panelled door with a handle and a step, sills and glazing bars at the round windows,
// and ivy of single leaves where the phone has creeper cards. Numbers: CONFIG.quality.high.base.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Q } from './quality.js';
import { ptex } from './props.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { densityOn, Placer, shapes, PROPS, weatherTex, cellUV, signTex, stainedTex, mapTex } from './density.js';
import { STATIONS } from './base.js';
import { LIFE_PLANTS } from './baseplants.js';

export const HIBASE = !!Q.base && (() => { try { return new URLSearchParams(location.search).get('fx') !== '0'; } catch (e) { return true; } })();
const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z), YAX = V(0, 1, 0), mc = {};
const shared = (k, make) => { if (!mc[k]) { mc[k] = make(); mc[k].userData.shared = true; mc[k].userData.pbr = true; } return mc[k]; };
const phys = (k, o) => shared(k, () => new THREE.MeshPhysicalMaterial(o)), std = (k, o) => shared(k, () => new THREE.MeshStandardMaterial(o));
const mesh = (geo, m, x, y, z, p) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (p) p.add(o); return o; };
function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }

// ---------------------------------------------------------------- the lucky cat
export function catHi(style) {
  const B = CONFIG.quality.high.base.cat, S = style || { name: 'plain', glaze: 0xf4efe4, earL: 0xf4efe4, earR: 0xf4efe4 }, n = S.name, g = new THREE.Group(), cer = { roughness: B.glaze[0], clearcoat: B.glaze[1], clearcoatRoughness: B.glaze[2], envMapIntensity: B.glaze[3] };
  const wrap = (key) => { const t = ptex(key); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  const mB = S.body ? phys('hcb_' + n, Object.assign({ map: wrap(S.body) }, cer)) : phys('hcg_' + n, Object.assign({ color: S.glaze }, cer)), mH = S.head ? phys('hch_' + n, Object.assign({ map: wrap(S.head) }, cer)) : mB;
  const mG = phys('hcg_' + n, Object.assign({ color: S.glaze }, cer)), ink = phys('hci', Object.assign({ color: 0x1a1816 }, cer)), pink = phys('hcp', Object.assign({ color: 0xe89a9a }, cer)), red = phys('hcr', { color: 0xb8302a, roughness: 0.5, clearcoat: 0.6, sheen: 0.4, sheenColor: 0xff9a8a });
  const gold = std('hcgold', { color: 0xe0b450, roughness: B.gold[0], metalness: B.gold[1], envMapIntensity: B.gold[2] }), eyeM = S.eye ? phys('hcy_' + n, Object.assign({ color: S.eye, emissive: 0x2a1c04 }, cer)) : ink, white = phys('hcw', { color: 0xffffff, roughness: 0.05, clearcoat: 1 });
  const sg = B.segments;
  // body: a lathe turned so u = 0.25 is the front (+z) and v runs bottom to top, as on the phone's sphere, so the wrap's patches sit where they were painted
  const prof = [[0.0, 0.0], [0.19, 0.004], [0.245, 0.04], [0.27, 0.13], [0.268, 0.24], [0.248, 0.34], [0.205, 0.43], [0.15, 0.5], [0.09, 0.545], [0.0, 0.56]].map((q) => new THREE.Vector2(q[0], q[1]));
  const body = mesh(new THREE.LatheGeometry(prof, sg).rotateY(-PI / 2), mB, 0, 0, 0, g); body.scale.set(1, 1, 0.86);
  for (const sx of [-1, 1]) { const hn = mesh(new THREE.SphereGeometry(0.13, sg / 2, sg / 4), mG, sx * 0.17, 0.11, -0.04, g); hn.scale.set(0.7, 0.85, 1.25); } // haunches
  // front paws with toes, resting on the base
  for (const sx of [-1, 1]) { const pw = mesh(new THREE.SphereGeometry(0.07, sg / 2, sg / 4), mG, sx * 0.12, 0.045, 0.17, g); pw.scale.set(1, 0.65, 1.2); for (let k = -1; k <= 1; k++) mesh(new THREE.SphereGeometry(0.024, 10, 8), mG, sx * 0.12 + k * 0.03, 0.035, 0.245, g); }
  // tail curled round the base on the left
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.12, 0.05, -0.2), V(-0.08, 0.04, -0.25), V(-0.24, 0.04, -0.1), V(-0.25, 0.045, 0.08), V(-0.17, 0.06, 0.16)]), 24, 0.032, 10, false), mG));
  // head: wide and a little flattened, whisker pads, nose, mouth, eyes with a glint, whiskers
  const head = new THREE.Group(); head.position.y = 0.68; g.add(head); const hs = mesh(new THREE.SphereGeometry(0.2, sg + 8, sg / 2 + 4), mH, 0, 0, 0, head); hs.scale.set(1.08, 0.95, 0.95);
  for (const sx of [-1, 1]) { const pd = mesh(new THREE.SphereGeometry(0.052, 16, 12), mG, sx * 0.048, -0.05, 0.165, head); pd.scale.set(1, 0.8, 0.75); }
  const nose = mesh(new THREE.SphereGeometry(0.022, 12, 8), pink, 0, -0.022, 0.197, head); nose.scale.set(1.3, 0.8, 0.8);
  head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.04, -0.075, 0.2), V(-0.02, -0.088, 0.205), V(0, -0.07, 0.205), V(0.02, -0.088, 0.205), V(0.04, -0.075, 0.2)]), 12, 0.0045, 5, false), ink));
  for (const sx of [-1, 1]) { const ey = mesh(new THREE.SphereGeometry(0.03, 16, 12), eyeM, sx * 0.078, 0.032, 0.17, head); ey.scale.set(1, 1.15, 0.6); mesh(new THREE.SphereGeometry(0.008, 8, 6), white, sx * 0.078 - 0.008, 0.045, 0.188, head);
    if (S.eye) { const sl = mesh(new THREE.BoxGeometry(0.006, 0.042, 0.004), ink, sx * 0.078, 0.032, 0.188, head); void sl; }
    for (let k = 0; k < 3; k++) { const a = (k - 1) * 0.22, p0 = V(sx * 0.085, -0.055 + k * 0.012, 0.175), p1 = V(sx * 0.27, -0.03 + (k - 1) * 0.06, 0.14); const d = p1.clone().sub(p0), w = mesh(new THREE.CylinderGeometry(0.0022, 0.0035, d.length(), 4), S.eye ? gold : ink, 0, 0, 0, head); w.position.copy(p0).addScaledVector(d, 0.5); w.quaternion.setFromUnitVectors(YAX, d.normalize()); void a; } }
  // ears: a rounded cone shell with a pink hollow, each in its own glaze colour
  for (const sx of [-1, 1]) { const eg = new THREE.Group(); eg.position.set(sx * 0.12, 0.15, -0.01); eg.rotation.set(-0.12, 0, -sx * 0.32); head.add(eg); const eM = phys('hce_' + n + sx, Object.assign({ color: sx < 0 ? S.earL : S.earR }, cer));
    const e = mesh(new THREE.ConeGeometry(0.075, 0.14, 20, 1), eM, 0, 0.05, 0, eg); e.scale.set(1, 1, 0.55); const inn = mesh(new THREE.ConeGeometry(0.05, 0.1, 16, 1), pink, 0, 0.04, 0.022, eg); inn.scale.set(1, 1, 0.3); }
  // collar, bell (band, slot and loop)
  const col = mesh(new THREE.TorusGeometry(0.168, 0.024, 12, 48), red, 0, 0.5, 0, g); col.rotation.x = PI / 2; col.scale.set(1, 0.86, 1);
  const bell = new THREE.Group(); bell.position.set(0, 0.445, 0.165); g.add(bell); mesh(new THREE.SphereGeometry(0.046, 20, 14), gold, 0, 0, 0, bell); const bd = mesh(new THREE.TorusGeometry(0.046, 0.005, 6, 24), gold, 0, 0.008, 0, bell); bd.rotation.x = PI / 2;
  mesh(new THREE.BoxGeometry(0.008, 0.03, 0.02), ink, 0, -0.026, 0.035, bell); mesh(new THREE.SphereGeometry(0.008, 8, 6), ink, 0, -0.012, 0.043, bell); mesh(new THREE.TorusGeometry(0.014, 0.005, 6, 12), gold, 0, 0.05, 0, bell);
  // koban coin: an oval with a raised rim and stamped lines, a paw resting on its top
  const coin = new THREE.Group(); coin.position.set(-0.02, 0.27, 0.21); coin.rotation.x = -0.12; g.add(coin); const cd = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.022, 36), gold, 0, 0, 0, coin); cd.rotation.x = PI / 2; cd.scale.set(1, 1, 1.4);
  const rim = mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 40), gold, 0, 0, 0.012, coin); rim.scale.set(1, 1.4, 1); for (let k = -2; k <= 2; k++) mesh(new THREE.BoxGeometry(0.11 - Math.abs(k) * 0.02, 0.005, 0.006), gold, 0, k * 0.032, 0.014, coin);
  const rest = mesh(new THREE.SphereGeometry(0.06, 16, 12), mG, -0.08, 0.36, 0.2, g); rest.scale.set(1, 0.75, 1.1);
  // the raised arm: a forearm, a paw with pads and toes facing out (the arm group is the phone's, so the waving and the kind's side work as before)
  const arm = new THREE.Group(); arm.position.set(0.2 * (S.side || 1), 0.52, 0.02); g.add(arm); mesh(new THREE.CapsuleGeometry(0.052, 0.2, 6, 16), mG, 0, 0.13, 0, arm);
  const paw = mesh(new THREE.SphereGeometry(0.066, 20, 14), mG, 0, 0.29, 0.012, arm); paw.scale.set(1, 1.08, 0.82); mesh(new THREE.SphereGeometry(0.026, 12, 8), pink, 0, 0.275, 0.064, arm).scale.set(1.1, 0.9, 0.5);
  for (let k = -1; k <= 1; k++) { mesh(new THREE.SphereGeometry(0.022, 10, 8), mG, k * 0.03, 0.345, 0.03, arm); mesh(new THREE.SphereGeometry(0.009, 8, 6), pink, k * 0.03, 0.33, 0.058, arm); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, arm };
}

// ---------------------------------------------------------------- bloom-tech devices: copper bands and rivets, rim lips, glass cages, petal frames, stem collars
export function detailDevice(root) {
  const B = CONFIG.quality.high.base.device, cop = std('hdcop', { map: ptex('metal'), color: 0xc98e5e, roughness: 0.35, metalness: 0.9 }), ver = std('hdver', { map: ptex('metal'), color: 0x76b4a2, roughness: 0.6, metalness: 0.5 });
  const list = []; root.traverse((o) => { if (o.isMesh && !o.userData.hiDetail) list.push(o); });
  for (const o of list) { const geo = o.geometry, P = geo.parameters || {}, m = o.material, kind = geo.type, mname = m && m.map && m.map.userData ? m.map.userData.tex : '';
    if (kind === 'LatheGeometry' && (mname === 'glaze')) { const pts = P.points, rmax = Math.max(...pts.map((p) => p.x)); if (rmax < 0.05) continue; let iw = 0; pts.forEach((p, i) => { if (p.x > pts[iw].x) iw = i; });
      const y = pts[iw].y, band = new THREE.Mesh(new THREE.TorusGeometry(pts[iw].x + 0.004, B.band, 8, 48), cop); band.rotation.x = PI / 2; band.position.y = y; band.userData.hiDetail = 1; o.add(band);
      const nr = Math.max(6, Math.round(rmax * B.rivets)); for (let k = 0; k < nr; k++) { const a = k / nr * 2 * PI, rv = new THREE.Mesh(new THREE.SphereGeometry(B.band * 0.75, 8, 6), cop); rv.position.set(Math.cos(a) * (pts[iw].x + B.band + 0.002), y, Math.sin(a) * (pts[iw].x + B.band + 0.002)); rv.userData.hiDetail = 1; o.add(rv); }
      const top = pts[pts.length - 1]; if (top.x > 0.03) { const lip = new THREE.Mesh(new THREE.TorusGeometry(top.x, B.band * 0.6, 6, 40), m); lip.rotation.x = PI / 2; lip.position.y = top.y; lip.userData.hiDetail = 1; o.add(lip); }
      const bot = pts[1] || pts[0]; if (bot.x > 0.05 && bot.y < 0.12) { const ft = new THREE.Mesh(new THREE.TorusGeometry(bot.x * 0.98, B.band * 0.7, 6, 40), ver); ft.rotation.x = PI / 2; ft.position.y = bot.y + 0.004; ft.userData.hiDetail = 1; o.add(ft); } }
    else if (kind === 'SphereGeometry' && m && m.transparent && P.radius > 0.08) { const r = P.radius + 0.003; for (let k = 0; k < B.cageRibs; k++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(r, B.band * 0.5, 5, 40, PI), cop); rib.rotation.y = k * PI / B.cageRibs; rib.userData.hiDetail = 1; o.add(rib); }
      const eq = new THREE.Mesh(new THREE.TorusGeometry(r, B.band * 0.7, 6, 48), cop); eq.rotation.x = PI / 2; eq.userData.hiDetail = 1; o.add(eq); const kn = new THREE.Mesh(new THREE.SphereGeometry(B.band * 1.6, 10, 8), cop); kn.position.y = r; kn.userData.hiDetail = 1; o.add(kn); }
    else if (kind === 'ShapeGeometry' && mname === 'cell') { // the petal shape is 1 x 1 before its own scale: a frame round its edge and a raised midrib
      if (!detailDevice.edge) { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.55, 0.2, 0.5, 0.75, 0, 1); s.bezierCurveTo(-0.5, 0.75, -0.55, 0.2, 0, 0); const pts = s.getPoints(24).map((p) => V(p.x, p.y, 0.004)); detailDevice.edge = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, B.petalEdge, 4, true); detailDevice.rib = new THREE.CylinderGeometry(B.petalEdge * 0.8, B.petalEdge * 1.4, 0.95, 5).translate(0, 0.475, 0.006); }
      for (const ge of [detailDevice.edge, detailDevice.rib]) { const f = new THREE.Mesh(ge, cop); f.userData.hiDetail = 1; f.userData.keepGeo = 1; o.add(f); } }
    else if (kind === 'TubeGeometry' && P.path && P.radius > 0.006) { for (const t of [0, 1]) { const p = P.path.getPoint(t), d = P.path.getTangent(t), c = new THREE.Mesh(new THREE.CylinderGeometry(P.radius * 1.6, P.radius * 1.6, P.radius * 3, 10), cop); c.position.copy(p); c.quaternion.setFromUnitVectors(YAX, d); c.userData.hiDetail = 1; o.add(c); } } }
  root.traverse((q) => { if (q.isMesh && q.userData.hiDetail) { q.castShadow = true; q.receiveShadow = true; } });
  // LAG FIX Nov 19: the detail pieces (bands, rivets, ribs, lips, end caps) of one part that share a material become ONE mesh on that part, so they still move with it
  // (each rivet and band was its own draw call; the look is unchanged)
  const byPart = new Map(); root.traverse((q) => { if (!q.isMesh || !q.userData.hiDetail || !q.parent || q.children.length || Array.isArray(q.material)) return; const k = q.parent.uuid + '|' + q.material.uuid; (byPart.get(k) || byPart.set(k, []).get(k)).push(q); });
  for (const L of byPart.values()) { if (L.length < 2) continue; const geos = [];
    for (const q of L) { q.updateMatrix(); const g = q.geometry.index ? q.geometry.toNonIndexed() : q.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv || !g.attributes.normal) { g.dispose(); geos.length = 0; break; } g.applyMatrix4(q.matrix); geos.push(g); }
    if (geos.length < 2) continue; const mg = mergeGeometries(geos, false); for (const g of geos) g.dispose(); if (!mg) continue;
    const one = new THREE.Mesh(mg, L[0].material); one.userData.hiDetail = 1; one.castShadow = true; one.receiveShadow = true; const par = L[0].parent; for (const q of L) { par.remove(q); if (!q.userData.keepGeo) q.geometry.dispose(); } par.add(one); }
  return root;
}

// ---------------------------------------------------------------- vaulted buildings in the base (stations and your home)
// b: { x, z, w (along x), d (along z), wall height h, vault radius R and height scale k, front: +1 or -1 (door side), door: [x offset, width, height], windows: [[x offset, y, radius]], open: home has a doorway with no leaf }
export function vaultHi(g, b) {
  const B = CONFIG.quality.high.base.building, r = rng(Math.round(b.x * 31 + b.z * 17) + 5), cer = phys('hbcer', { map: ptex('glaze'), color: 0xf2ecdc, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const cop = std('hbcop', { map: ptex('metal'), color: 0x7fbfae, roughness: 0.55, metalness: 0.6 }), wood = std('hbwood', { map: ptex('wood'), color: 0x3f8f6a, roughness: 0.6 }), brass = std('hbbr', { color: 0xc8a050, roughness: 0.3, metalness: 1 }), stone = std('hbst', { map: ptex('block'), color: 0xd8d0c0, roughness: 0.9 });
  const tileM = std('hbtile', { map: ptex('glaze'), roughness: 0.25 }), leafM = std('hbleaf', { roughness: 1, envMapIntensity: 0.35, side: THREE.DoubleSide });
  const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, b.x + x, y, b.z + z, g), F = b.front, hw = b.w / 2, hd = b.d / 2, top = b.h;
  // cornice where the wall meets the vault, pilasters at the corners
  box(b.w + 0.24, 0.14, b.d + 0.24, cer, 0, top, 0); box(b.w + 0.3, 0.05, b.d + 0.3, cer, 0, top + 0.08, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.26, top, 0.26, cer, sx * (hw + 0.02), top / 2, sz * (hd + 0.02));
  // ribs over the vault (a half ellipse, R across z and R * k up), gutters along both eaves with a downpipe at one end each
  for (let x = -hw + 0.3; x <= hw - 0.25; x += B.ribGap) { const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16 * PI; pts.push(V(b.x + x, top + 0.02 + Math.sin(t) * (b.R * b.k + 0.035), b.z + Math.cos(t) * (b.R + 0.035))); } g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, B.rib, 6, false), cop)); }
  for (const sz of [-1, 1]) { const gz = b.z + sz * (b.R + 0.08), gp = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, b.w + 0.5, 12), cop); gp.rotation.z = PI / 2; gp.position.set(b.x, top + 0.0, gz); g.add(gp);
    const px = b.x + (sz > 0 ? hw - 0.15 : -hw + 0.15), pz = b.z + sz * (hd + 0.1), pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, top, 10), cop); pipe.position.set(px, top / 2, pz); g.add(pipe); for (let y = 0.6; y < top; y += 1.0) mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), brass, px, y, pz, g); }
  // a course of glazed tiles above the plinth, two colours in a chequer (instanced)
  { const tw = B.tile[0], th = B.tile[1], n = [], c = []; const col = [new THREE.Color(0x4f9a7a), new THREE.Color(0xe8dcc0), new THREE.Color(0x3f7f9a)]; const m4 = new THREE.Matrix4();
    for (const [len, ax, off] of [[b.w, 'x', hd], [b.w, 'x', -hd], [b.d, 'z', hw], [b.d, 'z', -hw]]) for (let row = 0; row < 2; row++) for (let u = -len / 2 + tw / 2; u < len / 2; u += tw + 0.006) { const sgn = Math.sign(off), x = ax === 'x' ? u : off + sgn * 0.012, z = ax === 'x' ? off + sgn * 0.012 : u;
      if (b.open && ax === 'x' && sgn === F && Math.abs(u - b.door[0]) < b.door[1] / 2 + 0.05) continue; if (!b.open && ax === 'x' && sgn === F && Math.abs(u - b.door[0]) < b.door[1] / 2 + 0.12) continue;
      m4.makeRotationY(ax === 'x' ? 0 : PI / 2); m4.setPosition(b.x + x, 0.36 + row * (th + 0.006) + th / 2, b.z + z); n.push(...m4.elements); const cc = col[(Math.round(u / (tw + 0.006)) + row) % 2 ? 1 : (r() < 0.3 ? 2 : 0)].clone().multiplyScalar(0.9 + 0.2 * r()); c.push(cc.r, cc.g, cc.b); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(tw, th, 0.02), tileM, c.length / 3); im.instanceMatrix.array.set(n); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c), 3); im.computeBoundingSphere(); g.add(im); }
  // the door: stiles, rails and raised panels on the leaf, a brass handle, a stone step; or (home) a lined doorway
  const dz = b.z + F * (hd + 0.045), [dx, dw, dh] = b.door;
  if (!b.open) { const lf = (w, h, x, y, zz) => mesh(new THREE.BoxGeometry(w, h, 0.03), wood, b.x + dx + x, y, dz + F * zz, g);
    for (const sx of [-1, 1]) lf(0.1, dh - 0.05, sx * (dw / 2 - 0.05), dh / 2, 0.02); for (const [y, h] of [[0.12, 0.16], [dh * 0.48, 0.12], [dh - 0.1, 0.1]]) lf(dw - 0.2, h, 0, y, 0.02);
    for (const sx of [-1, 1]) for (const [y0, y1] of [[0.2, dh * 0.48 - 0.06], [dh * 0.48 + 0.06, dh - 0.15]]) { lf(dw / 2 - 0.16, y1 - y0, sx * (dw / 4 - 0.02), (y0 + y1) / 2, 0.035); }
    mesh(new THREE.SphereGeometry(0.035, 12, 8), brass, b.x + dx + dw / 2 - 0.15, 1.0, dz + F * 0.07, g); mesh(new THREE.BoxGeometry(0.06, 0.18, 0.012), brass, b.x + dx + dw / 2 - 0.15, 1.0, dz + F * 0.045, g); }
  else for (const sx of [-1, 1]) box(0.08, dh, 0.5, cer, dx + sx * (dw / 2 + 0.04), dh / 2, F * hd);
  box(dw + 0.5, 0.12, 0.5, stone, dx, 0.06, F * (hd + 0.3));
  // round windows: a sill under each, glazing bars across
  for (const [wx, wy, wr] of b.windows || []) { box(wr * 2 + 0.2, 0.05, 0.16, cer, wx, wy - wr - 0.04, F * (hd + 0.06)); for (const a of [0, PI / 2]) { const bar = mesh(new THREE.BoxGeometry(wr * 2, 0.025, 0.02), cop, b.x + wx, wy, dz + F * 0.02, g); bar.rotation.z = a; } }
  // ivy of single leaves up the side and back walls
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = [], n = []; for (let p = 0; p < B.ivy[0]; p++) { const side = p % 3, nx = side === 0 ? -1 : side === 1 ? 1 : 0, nz = side === 2 ? -F : 0, cx = b.x + nx * (hw + 0.012), cz = b.z + nz * (hd + 0.012), along = nx ? 'z' : 'x', u0 = (r() - 0.5) * (nx ? b.d : b.w) * 0.6;
      for (let k = 0; k < B.ivy[1]; k++) { const t = Math.pow(r(), 0.7), u = u0 + (r() - 0.5) * (0.6 + 1.6 * t), y = (1 - t) * top * (0.3 + 0.7 * r()) + 0.15, sz = B.ivy[2] * (0.6 + 0.7 * r()), out = 0.01 + r() * 0.05;
        e.set(-(0.3 + 0.6 * r()), Math.atan2(nx, nz || 0.0001), (r() - 0.5) * 1.4, 'YXZ'); q.setFromEuler(e); m4.compose(V(along === 'z' ? cx + nx * out : b.x + u, y, along === 'z' ? b.z + u : cz + nz * out), q, V(sz, sz, sz)); n.push(...m4.elements);
        const lc = new THREE.Color().setHSL(0.26 + 0.07 * r(), 0.45 + 0.2 * r(), 0.16 + 0.14 * r(), THREE.SRGBColorSpace); c.push(lc.r, lc.g, lc.b); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.5, -0.38, 0.05, 0, -1, 0, 0.5, -0.38, 0.05, 0, -0.42, 0.09], 3)); lg.setIndex([4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0]); lg.computeVertexNormals();
    const im = new THREE.InstancedMesh(lg, leafM, c.length / 3); im.instanceMatrix.array.set(n); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c), 3); im.computeBoundingSphere(); g.add(im); }

  if (densityOn()) vaultDense(g, b);
}

// ---------------------------------------------------------------- DENSITY (CONFIG.quality.high.density.base): the vaulted buildings lived in and cared for
// lanterns by the door (a glass bud on a verdigris bracket, warm light), a hand-painted sign, stained glass in the round windows, a mosaic round the door, window boxes and pots
// (soil only: the plants are the vegetation layer's), a bench with a cushion and a mug, a water butt under a downpipe, crates and sacks, tools and a watering can, a solar cell
// panel wired to a junction box and glass battery jars, a washing line (storage), a workbench and pegboard (workshop), repairs (render patches, copper patches riveted on the vault,
// a rope-bound downpipe), a stove flue on the roof; inside your home: a stove, coat hooks with a green coat, boots, a shelf of jars and books, a lantern on the desk.
// Everything is merged per surface (one mesh per surface for the whole base), colour variety rides on vertex colours.
function vaultDense(g, b) {
  const DB = densityOn().base, F = b.front, hw = b.w / 2, hd = b.d / 2, top = b.h, r = rng(b.seed || (Math.round(b.x * 13 + b.z * 29) + 77)), G = shapes(), home = !!b.open && !b.room;
  const word = b.word ? b.word : home ? 'POTTS' : Math.hypot(b.x - STATIONS.storage.x, b.z - STATIONS.storage.z) < 0.5 ? 'STORAGE' : 'WORKSHOP', isStore = word === 'STORAGE';
  const M = { wood: std('dnwood', { map: ptex('wood'), roughness: 0.75, vertexColors: true }), cer: phys('dncer', { map: ptex('glaze'), roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3, vertexColors: true }), cop: std('dncop', { map: ptex('metal'), roughness: 0.5, metalness: 0.6, vertexColors: true }),
    metal: std('dnmetal', { map: ptex('metal'), roughness: 0.45, metalness: 0.7, vertexColors: true }), cloth: std('dncloth', { map: ptex('fabric'), roughness: 1, side: THREE.DoubleSide, vertexColors: true }), soil: std('dnsoil', { map: ptex('grass'), color: 0x5a4632, roughness: 1, vertexColors: true }),
    pot: std('dnpot', { map: ptex('brick'), color: 0xd08860, roughness: 0.9, vertexColors: true }), glass: std('dnglass', { color: 0xd8ece8, roughness: 0.05, transparent: true, opacity: 0.35, envMapIntensity: 1.6, depthWrite: false, vertexColors: true }),
    glow: std('dnglow', { color: 0xffe0a0, emissive: 0xffc870, emissiveIntensity: DB.lantern, roughness: 0.3, vertexColors: true }), dark: std('dndark', { color: 0x2a2622, roughness: 0.8, vertexColors: true }),
    decal: std('dndecal', { map: weatherTex(), roughness: 0.95, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, vertexColors: true }),
    stained: std('dnstained', { map: stainedTex(), emissiveMap: stainedTex(), emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.2, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: true }),
    sign: std('dnsign' + word, { map: signTex(word, word.length * 31), roughness: 0.6, vertexColors: true }), cell: std('dncell', { map: ptex('cell'), roughness: 0.2, metalness: 0.3, vertexColors: true }) };
  M.leaf = std('dnleaf', { color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide, vertexColors: true }); M.fruit = std('dnfruit', { color: 0xffffff, roughness: 0.45, vertexColors: true }); M.mapt = std('dnmap', { map: mapTex(), roughness: 0.85, vertexColors: true }); M.plaster = std('dnplaster', { color: 0xffffff, roughness: 0.95, vertexColors: true });
  M.plastic = M.cer; M.paint = M.wood; M.paper = M.cer; M.stone = M.cer; M.rubber = M.dark;
  const acc = new Map(), emit = (key, geo, m, tint) => { let a = acc.get(key); if (!a) acc.set(key, a = []); a.push([geo, m.clone(), tint]); };
  const P = new Placer(emit), C = (hx) => new THREE.Color(hx), jit = (hx, k) => new THREE.Color(hx).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * (k || 0.08));
  P.push(b.x, 0, b.z, F > 0 ? 0 : PI);
  const fz = hd + 0.012, [dx, dw, dh] = b.door;
  // a wall mark (repair, drips, damp) on the front (side 0), right (1), back (2) or left (3) face: a quad laid on the wall, in the building's frame
  const wallMark = (side, cell, u, y, w, h, tint) => { const gq = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = cellUV(cell), uv = gq.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    const at = [[u, y, fz + 0.002, 0], [hw + 0.014, y, -u, PI / 2], [-u, y, -fz - 0.002, PI], [-hw - 0.014, y, u, -PI / 2]][side]; P.add('decal', gq, at[0], at[1], at[2], 0, at[3], 0, 1, 1, 1, tint); };
  // ---- lanterns beside the door: a verdigris bracket curling out of the wall, a glass bud with a warm bulb and a copper cap
  const lantern = (x, y, z, ry) => { P.push(x, y, z, ry); P.add('cop', G.box(0.08, 0.16, 0.02), 0, 0, 0.01, 0, 0, 0, 1, 1, 1, C(0xffffff)); let prev = V(0, 0.02, 0.02); for (let k = 1; k <= 6; k++) { const t = k / 6, q = V(0, 0.02 + Math.sin(t * PI * 0.8) * 0.16, 0.02 + t * 0.3); P.rod('cop', G, prev, q, 0.012, 6); prev = q; }
    P.add('cop', G.cyl(0.03, 0.07, 0.05, 10), 0, 0.12, 0.32); P.add('glass', G.lathe('bud', [[0.0, 0], [0.06, 0.02], [0.085, 0.09], [0.07, 0.17], [0.03, 0.21], [0, 0.22]], 14), 0, -0.13, 0.32, 0, 0, 0);
    P.add('glow', G.sphere(0.035, 10, 8), 0, -0.04, 0.32); P.add('cop', G.cyl(0.012, 0.012, 0.04, 6), 0, 0.08, 0.32); P.pop(); };
  if (home) { lantern(-dw / 2 - 0.3, 2.15, fz, 0); lantern(dw / 2 + 0.3, 2.15, fz, 0); } else if (b.lampX !== false) lantern(dx + dw / 2 + 0.38, 2.2, fz, 0);
  // ---- the hand-painted sign: a projecting board on a bracket beside a station door; over the doorway on your home
  // (the painted face is a plane with the whole picture on it; a box's uvs are in metres and showed only the bottom of the picture, without the word)
  if (DB.sign) { if (home) { P.add('wood', G.box(1.36, 0.5, 0.03), -2.3, 2.2, fz + 0.03, 0, 0, 0, 1, 1, 1, C(0x3f8f6a)); P.add('sign', new THREE.PlaneGeometry(1.3, 0.44), -2.3, 2.2, fz + 0.047); P.add('wood', G.box(1.4, 0.05, 0.05), -2.3, 2.44, fz + 0.03, 0, 0, 0, 1, 1, 1, C(0x3f8f6a)); }
    else { const sx = dx - dw / 2 - 0.42; P.add('cop', G.box(0.04, 0.04, 0.95), sx, 2.72, fz + 0.47, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.rod('cop', G, V(sx, 2.5, fz + 0.02), V(sx, 2.7, fz + 0.45), 0.012, 6); for (const zz of [0.25, 0.8]) P.rod('dark', G, V(sx, 2.7, fz + zz), V(sx, 2.56, fz + zz), 0.004, 4);
      P.push(sx, 2.36, fz + 0.52, PI / 2); P.add('wood', G.box(1.0, 0.41, 0.026), 0, 0, 0, 0, 0, 0, 1, 1, 1, C(0x3f8f6a)); for (const s2 of [1, -1]) P.add('sign', new THREE.PlaneGeometry(0.95, 0.36), 0, 0, s2 * 0.0145, 0, s2 > 0 ? 0 : PI, 0); P.pop(); } }
  // ---- stained glass in the round windows, a mosaic of glazed tiles round the door
  if (DB.stained) for (const [wx, wy, wr] of b.windows || []) P.add('stained', new THREE.CircleGeometry(wr * 0.98, 32), wx, wy, fz + 0.04, 0, 0, 0, 1, 1, 1, C(0xffffff));
  if (DB.mosaic) { const cols = [0x4f9a7a, 0xe8dcc0, 0xe0a040, 0x3f7f9a, 0x7fbf8a].map(C), cy = home ? dh : dh, R0 = dw / 2 + (home ? 0.12 : 0.12);
    if (!home) for (let row = 0; row < 2; row++) { const rad = R0 + 0.04 + row * 0.075, n = Math.round(PI * rad / 0.07); for (let k = 0; k <= n; k++) { const a = k / n * PI; P.add('cer', G.box(0.062, 0.062, 0.016), dx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 1.1, fz + 0.008, 0, 0, a, 1, 1, 1, cols[(k + row * 2) % 5].clone().multiplyScalar(0.92 + 0.16 * r())); } }
    for (const sx of [-1, 1]) for (let y = 0.5; y < (home ? dh : dh) - 0.05; y += 0.075) P.add('cer', G.box(0.062, 0.062, 0.016), dx + sx * (dw / 2 + (home ? 0.2 : 0.2)), y, fz + 0.008, 0, 0, 0, 1, 1, 1, cols[(Math.round(y / 0.075) + (sx > 0 ? 2 : 0)) % 5].clone().multiplyScalar(0.92 + 0.16 * r())); }
  // ---- planters: a glazed window box under each round window, pots by the door (soil only: plants are the vegetation layer's; their spots are in g.userData.plantSpots)
  const spots = g.userData.plantSpots || (g.userData.plantSpots = []), toWorld = (x, y, z) => V(b.x + (F > 0 ? x : -x), y, b.z + (F > 0 ? z : -z));
  if (DB.planters) { for (const [wx, wy, wr] of b.windows || []) { const y = wy - wr - 0.3; P.add('cer', G.box(wr * 2 + 0.1, 0.2, 0.22), wx, y, fz + 0.13, 0, 0, 0, 1, 1, 1, jit(0x8fc79a)); P.add('soil', G.box(wr * 2 + 0.02, 0.02, 0.16), wx, y + 0.09, fz + 0.13); for (const sx of [-1, 1]) P.add('cop', G.box(0.03, 0.18, 0.2), wx + sx * wr * 0.8, y - 0.12, fz + 0.1, 0.5, 0, 0, 1, 1, 1, C(0xffffff)); spots.push({ kind: 'box', at: toWorld(wx, y + 0.1, fz + 0.13), w: wr * 2, d: 0.16 }); }
    for (const sx of [-1, 1]) { const x = dx + sx * (dw / 2 + (home ? 0.75 : 0.5)), z = fz + 0.3; P.add('cer', G.lathe('urn', [[0, 0], [0.16, 0.0], [0.2, 0.08], [0.22, 0.3], [0.19, 0.42], [0.21, 0.45], [0.2, 0.47]], 16), x, 0, z, 0, 0, 0, 1, 1, 1, jit(sx > 0 ? 0xf2ecdc : 0x8fc79a)); P.add('soil', G.cyl(0.18, 0.18, 0.02, 14), x, 0.44, z); spots.push({ kind: 'pot', at: toWorld(x, 0.45, z), r: 0.18 }); } }
  // ---- a bench by the front wall with a cushion and a mug; a doormat
  { const bx2 = home ? -dw / 2 - 1.0 : -1.75, bz = fz + 0.32; P.push(bx2, 0, bz, 0); PROPS.bench(P, G, r, 1.3, jit(0x3f8f6a, 0.06)); P.add('cloth', G.box(0.42, 0.06, 0.32), 0.25, 0.5, 0, 0, 0.1, 0, 1, 1, 1, jit(0xd8a040)); P.add('cer', G.cyl(0.04, 0.035, 0.09, 10), -0.45, 0.52, 0.05, 0, 0, 0, 1, 1, 1, jit(0xf2ecdc)); P.pop();
    P.add('cloth', G.box(home ? 1.4 : 0.9, 0.012, 0.55), dx, 0.13, fz + 0.5, 0, 0, 0, 1, 1, 1, jit(0x8a6a3a)); }
  // ---- a water butt under the front downpipe, with a tap and a can
  { const x = hw - 0.15, z = hd + 0.45; P.add('cer', G.lathe('butt', [[0, 0], [0.28, 0], [0.32, 0.2], [0.33, 0.55], [0.3, 0.78], [0.31, 0.8]], 18), x, 0, z, 0, 0, 0, 1, 1, 1, jit(0x8fc79a)); P.add('cop', G.cyl(0.31, 0.31, 0.03, 18), x, 0.8, z, 0, 0, 0, 1, 1, 1, C(0xffffff));
    P.add('cop', G.cyl(0.015, 0.015, 0.1, 6), x - 0.3, 0.18, z, 0, 0, PI / 2, 1, 1, 1, C(0xffffff)); P.add('metal', G.lathe('can', [[0, 0], [0.11, 0], [0.12, 0.22], [0.1, 0.26]], 12), x - 0.55, 0, z + 0.1, 0, 0, 0, 1, 1, 1, jit(0x6a8a7a)); P.rod('metal', G, V(x - 0.47, 0.06, z + 0.1), V(x - 0.25, 0.3, z + 0.1), 0.012, 6, jit(0x6a8a7a)); }
  // ---- along the sides: crates and sacks, tools and a watering can, the solar cell panel wired to a junction box over glass battery jars
  if (DB.crates) { const n = isStore ? 5 : home ? 2 : 3; for (let k = 0; k < n; k++) { const z = -hd + 0.5 + (k % 3) * 0.55, y = Math.floor(k / 3) * 0.32; P.push(hw + 0.32, y, z, PI / 2 + (r() - 0.5) * 0.2); PROPS.crate(P, G, r, 1, jit(0xb08a5a, 0.12)); P.pop(); }
    for (let k = 0; k < (isStore ? 3 : 1); k++) P.add('cloth', G.lump(k + 3), hw + 0.35, 0.22, hd - 0.6 - k * 0.45, 0, r() * 3, 0, 0.24, 0.24, 0.2, jit(0xc8b080)); }
  if (DB.tools) { const sx = isStore ? -1 : 1; for (let k = 0; k < 3; k++) { P.push(sx * (hw + 0.08), 0, (isStore ? -0.6 : 0.3) + k * 0.32, sx * PI / 2); PROPS.tool(P, G, r, k, -0.22); P.pop(); } }
  { const sx = isStore ? hw : -hw, sgn = Math.sign(sx); P.push(sx + sgn * 0.02, 0, -0.9, sgn * PI / 2);
    P.add('cop', G.box(0.9, 0.04, 0.05), 0, 2.15, 0.1, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.add('cell', G.box(0.8, 0.5, 0.02), 0, 2.4, 0.3, -0.6, 0, 0, 1, 1, 1, C(0xffffff)); P.rod('cop', G, V(-0.3, 2.15, 0.05), V(-0.3, 2.3, 0.25), 0.01, 6); P.rod('cop', G, V(0.3, 2.15, 0.05), V(0.3, 2.3, 0.25), 0.01, 6);
    P.add('cer', G.box(0.22, 0.28, 0.1), 0.0, 1.45, 0.05, 0, 0, 0, 1, 1, 1, jit(0xf2ecdc)); P.add('cop', G.box(0.24, 0.03, 0.12), 0, 1.6, 0.05); P.rod('dark', G, V(0.05, 2.15, 0.03), V(0.05, 1.6, 0.03), 0.008, 5); P.rod('dark', G, V(-0.05, 1.31, 0.03), V(-0.05, 0.92, 0.03), 0.008, 5);
    P.add('wood', G.box(0.8, 0.03, 0.22), 0, 0.88, 0.11, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k < 3; k++) { const x = -0.25 + k * 0.25; P.add('glass', G.cyl(0.07, 0.07, 0.22, 12), x, 1.0, 0.12); P.add('glow', G.cyl(0.055, 0.055, 0.12, 10), x, 0.96, 0.12, 0, 0, 0, 1, 1, 1, C(0x60ffd8)); P.add('cop', G.cyl(0.075, 0.075, 0.03, 12), x, 1.12, 0.12); }
    P.pop(); }
  // ---- repairs: render patches and faint drips (cared for, not new), a copper patch riveted over a crack in the vault, rope bound round a cracked downpipe
  if (DB.repairs) { for (let k = 0; k < 3; k++) wallMark(1 + (k % 3), 'patch', (r() - 0.5) * (k % 2 ? b.d - 1 : b.w - 1), 0.8 + r() * 1.4, 0.8 + 0.4 * r(), 0.6 + 0.3 * r(), C(0xf4eedc));
    // lime-wash weathered unevenly: soft dirt, paler sun-bleached patches, rain streaks over the side and back walls; on a station front only round the foot, clear of the door and the windows
    for (let s2 = 1; s2 < 4; s2++) wallMark(s2, 'wash', 0, top / 2, (s2 % 2 ? b.d : b.w) - 0.06, top - 0.06, C(0xc8bca4));
    { const yTop = Math.min(home ? top - 0.1 : top, ...(b.windows || []).map((q) => q[1] - q[2] - 0.45)); for (const [u0, u1] of [[-hw + 0.03, dx - dw / 2 - 0.2], [dx + dw / 2 + 0.2, hw - 0.03]]) if (u1 - u0 > 0.3 && yTop > 0.4) wallMark(0, 'wash', (u0 + u1) / 2, yTop / 2, u1 - u0, yTop, C(0xc8bca4)); }
    for (const [wx, wy, wr] of b.windows || []) wallMark(0, 'streak', wx, wy - wr - 0.75, 0.7, 0.55, C(0xd8d0c0)); for (let s2 = home ? 1 : 0; s2 < 4; s2++) wallMark(s2, 'band', 0, 0.35 + 0.25, s2 % 2 ? b.d : b.w, 0.5, C(0xe0dccc));
    for (let k = 0; k < 2; k++) { const x = (r() - 0.5) * (b.w - 1), a = 0.5 + 0.6 * r(), z = Math.cos(a) * (b.R + 0.03), y = top + 0.02 + Math.sin(a) * (b.R * b.k + 0.03), nz = b.R * b.k * Math.cos(a), ny = b.R * Math.sin(a); P.push(x, y, z, 0, Math.atan2(-ny, nz)); P.add('cop', G.box(0.5, 0.35, 0.012), 0, 0, 0, 0, 0, 0, 1, 1, 1, C(0xd8b090));
      for (let i = 0; i < 10; i++) P.add('cop', G.sphere(0.012, 6, 4), -0.23 + (i % 5) * 0.115, i < 5 ? 0.16 : -0.16, 0.008, 0, 0, 0, 1, 1, 1, C(0xc89060)); P.pop(); }
    for (let k = 0; k < 3; k++) P.add('dark', G.torus(0.048, 0.008, 5, 12), hw - 0.15, 1.2 + k * 0.03, hd + 0.1, PI / 2, 0, 0, 1, 1, 1, C(0xb89a6a)); }
  // ---- a stove flue through the vault (workshop and home), a copper ridge cap along the top of the vault
  if (DB.stove && !isStore) { const x = b.flue ? b.flue[0] : home ? 2.75 : -1.2, z = b.flue ? b.flue[1] : -0.6, a = Math.acos(Math.min(1, Math.abs(z) / b.R)), ry2 = top + 0.02 + Math.sin(a) * b.R * b.k; P.add('metal', G.cyl(0.07, 0.07, 1.0, 12), x, ry2 + 0.3, z, 0, 0, 0, 1, 1, 1, C(0x5a5650)); P.add('metal', G.cyl(0.0, 0.16, 0.14, 12), x, ry2 + 0.9, z, 0, 0, 0, 1, 1, 1, C(0x5a5650)); for (const yy of [0.1, 0.5]) P.add('cop', G.cyl(0.085, 0.085, 0.04, 12), x, ry2 + yy, z); }
  P.add('cop', G.cyl(0.05, 0.05, b.w + 0.1, 10), 0, top + 0.02 + b.R * b.k + 0.035, 0, 0, 0, PI / 2, 1, 1, 1, C(0xffffff));
  // ---- the storage station's washing line along its left side (clothes with green in them); the workshop's bench and pegboard
  if (DB.line && isStore) { const a = V(-hw - 0.45, 1.8, -hd + 0.6), c2 = V(-hw - 0.45, 1.8, hd - 0.3); for (const p of [a, c2]) P.add('wood', G.cyl(0.03, 0.035, 1.85, 8), p.x, 0.925, p.z, 0, 0, 0, 1, 1, 1, jit(0x3f8f6a, 0.06)); PROPS.laundry(P, G, r, a, c2, [jit(0x4f8a4a), jit(0xe8e0cc), jit(0x6aa070), jit(0xb8c890), jit(0x3f7f5a)], 5); }
  if (!isStore && !home && !b.noBench) { P.push(-hw - 0.4, 0, 0.2, PI / 2); P.add('wood', G.box(1.6, 0.06, 0.6), 0, 0.9, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('wood', G.box(0.06, 0.88, 0.06), sx * 0.72, 0.44, sz * 0.24, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a));
    P.add('metal', G.box(0.16, 0.12, 0.12), -0.6, 1.0, 0.15, 0, 0, 0, 1, 1, 1, C(0x5a7a6a)); P.add('metal', G.cyl(0.012, 0.012, 0.22, 6), -0.6, 1.03, 0.25, PI / 2, 0, 0); P.add('wood', G.box(1.4, 0.9, 0.02), 0, 1.75, -0.33, 0, 0, 0, 1, 1, 1, jit(0xc8a878));
    for (let k = 0; k < 5; k++) { P.push(-0.5 + k * 0.25, 1.4, -0.3, 0); PROPS.tool(P, G, r, k % 3, 0); P.pop(); } P.pop(); }
  // ---- inside your home: a stove in the back corner (its flue goes up through the vault), coat hooks with a green coat and a scarf, boots by the doorway, a shelf of jars and books, a lantern on the desk
  if (home) { P.push(2.72, 0, -0.6, 0); P.add('metal', G.box(0.5, 0.7, 0.45), 0, 0.35, 0, 0, 0, 0, 1, 1, 1, C(0x3a3836)); P.add('glow', G.box(0.22, 0.14, 0.01), -0.26, 0.32, 0, 0, PI / 2, 0, 1, 1, 1, C(0xff8a40)); P.add('metal', G.cyl(0.07, 0.07, top + 1.3, 12), 0.03, 0.7 + (top + 1.3) / 2, 0, 0, 0, 0, 1, 1, 1, C(0x4a4642)); P.add('cer', G.cyl(0.09, 0.08, 0.16, 12), -0.05, 0.78, 0.1, 0, 0, 0, 1, 1, 1, jit(0x3f8f6a)); P.pop();
    P.push(-2.95, 0, 1.55, PI / 2); for (let k = 0; k < 3; k++) P.add('cop', G.cyl(0.01, 0.01, 0.1, 6), -0.25 + k * 0.25, 1.7, 0.05, PI / 2, 0, 0); P.add('cloth', G.cloth(0.5, 0.95, 2, 0.04, 2), -0.25, 1.24, 0.12, 0, 0, 0, 1, 1, 1, jit(0x3f7a4a, 0.04)); P.add('cloth', G.cloth(0.16, 0.7, 1, 0.02, 3), 0.25, 1.36, 0.1, 0, 0, 0, 1, 1, 1, jit(0xc8b060)); P.pop();
    for (const sx of [-0.12, 0.12]) { P.add('cloth', G.box(0.11, 0.24, 0.13), -1.1 + sx, 0.12, 1.5, 0, 0.2, 0, 1, 1, 1, C(0x4a3626)); P.add('cloth', G.box(0.11, 0.06, 0.26), -1.1 + sx, 0.03, 1.56, 0, 0.2, 0, 1, 1, 1, C(0x3a2a1e)); }
    P.push(2.98, 0, 0.7, -PI / 2); P.add('wood', G.box(1.0, 0.03, 0.22), 0, 1.55, 0.11, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k < 4; k++) P.add('glass', G.cyl(0.05, 0.05, 0.16, 10), -0.4 + k * 0.12, 1.65, 0.1); for (let k = 0; k < 6; k++) P.add('cer', G.box(0.04, 0.2 + 0.04 * r(), 0.16), 0.1 + k * 0.05, 1.67, 0.1, 0, 0, (r() - 0.5) * 0.1, 1, 1, 1, jit([0x8a3a2e, 0x2f5d8a, 0x3f6b4a, 0xc9a227][k % 4], 0.1)); P.pop();
    P.push(2.8, 0.82, 0.62, 0); P.add('cop', G.cyl(0.06, 0.07, 0.03, 12), 0, 0.015, 0); P.add('glass', G.lathe('bud', [[0.0, 0], [0.06, 0.02], [0.085, 0.09], [0.07, 0.17], [0.03, 0.21], [0, 0.22]], 14), 0, 0.03, 0); P.add('glow', G.sphere(0.035, 10, 8), 0, 0.12, 0); P.pop();
    for (let k = 0; k < 4; k++) P.add('cer', G.box(0.2, 0.04, 0.28), 1.85, 0.84 + k * 0.04, 1.0, 0, (r() - 0.5) * 0.4, 0, 1, 1, 1, jit([0x8a3a2e, 0x2f5d8a, 0x3f6b4a, 0xc9a227][k], 0.1)); }
  // ---- MORE (owner 17:10: "add more and the inside to meet solarpunk theme"): plants grown in every planter and pot, a climbing frame on a side wall,
  // and inside your home a lived-in, grown-in room: hanging planters with trailing vines, shelves of seedlings and seed jars, herbs drying from a beam, a patchwork quilt and cushions,
  // a woven rug, a curtain for the bed nook, a chest, a hand-made chair, produce from the garden, pots over the stove, a pinned-up map and notes, bloom-tech parts on the desk, warm solar bulbs strung under the vault
  const DM = DB.more; if (DM) {
    const green = [0x4f9a3a, 0x6aa84a, 0x3f7f3a, 0x7fb04a, 0x2f6a34], fl = [0xe8a23a, 0xd8577a, 0xf0d050, 0x7f8fd8, 0xf4f0e0];
    // a plant: n leaf blades fanning out from (x, y, z), s long; flowers: that many small blooms on stalks
    const plant = (x, y, z, s, n, flowers) => { if (LIFE_PLANTS.kit) { LIFE_PLANTS.kit.addIn(g, flowers ? 'flower' : s > 0.45 ? 'shrub' : 'herb', new THREE.Vector3(x, y, z).applyMatrix4(P.top()), Math.max(0.6, s * 2.2)); return; } const hue = green[Math.floor(r() * green.length)]; for (let k = 0; k < n; k++) { const a = k / n * 2 * PI + r() * 0.6, e = 0.45 + 0.75 * r(), len = s * (0.6 + 0.5 * r()); P.push(x, y, z, a, -e); P.add('leaf', G.box(0.16 * s, 0.006, len), 0, 0, len / 2, 0, 0, 0, 1, 1, 1, jit(hue, 0.12)); P.pop(); }
      for (let k = 0; k < (flowers || 0); k++) { const a = r() * 2 * PI, d = r() * s * 0.4, h = s * (0.5 + 0.5 * r()), fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d; P.rod('leaf', G, V(x, y, z), V(fx, y + h, fz), 0.006, 4, jit(hue)); P.add('fruit', G.sphere(0.035 * s / 0.3 + 0.01, 8, 6), fx, y + h, fz, 0, 0, 0, 1, 0.6, 1, jit(fl[Math.floor(r() * fl.length)], 0.06)); } };
    // a trailing vine: leaves hanging down from (x, y, z) for len m
    const books = (x, y, z) => { let bx3 = x; while (bx3 < x + 0.3) { const bw = 0.03 + 0.025 * r(), bh = 0.17 + 0.09 * r(), lean = r() < 0.12 ? 0.25 : 0; P.add('cer', G.box(bw, bh, 0.15), bx3 + bw / 2, y + bh / 2, z, 0, 0, lean, 1, 1, 1, jit([0x8a3a2e, 0x2f5d8a, 0x3f6b4a, 0xc9a227, 0x6a4a6a, 0xd8c8a0][Math.floor(r() * 6)], 0.08)); bx3 += bw + 0.004; } };
    const trail = (x, y, z, len) => { let px = x, pz = z; for (let t = 0; t < len; t += 0.07) { px += (r() - 0.5) * 0.04; pz += (r() - 0.5) * 0.04; P.push(px, y - t, pz, r() * 6, -0.3 - 0.6 * r()); P.add('leaf', G.box(0.07, 0.005, 0.09), 0, 0, 0.045, 0, 0, 0, 1, 1, 1, jit(0x4f9a3a, 0.1)); P.pop(); } };
    // plants in the window boxes and the urns by the door (the planters above)
    for (const [wx, wy, wr] of b.windows || []) { const y = wy - wr - 0.3 + 0.1; for (let k = 0; k < DM.boxPlants; k++) plant(wx - wr + (k + 0.5) * (2 * wr / DM.boxPlants), y, fz + 0.13, 0.28, 7, k % 2 ? 2 : 0); trail(wx - wr * 0.7, y, fz + 0.24, 0.35 + 0.2 * r()); trail(wx + wr * 0.6, y, fz + 0.24, 0.3 + 0.25 * r()); }
    for (const sx of [-1, 1]) { const x = dx + sx * (dw / 2 + (home ? 0.75 : 0.5)), z = fz + 0.3; plant(x, 0.46, z, 0.55, 11, 3); }
    // climbers on the front wall at both corners: stems wandering up from a planting pocket, leaves along them, a few blooms
    for (const x0 of [-hw + 0.35, hw - 0.5]) { P.add('cer', G.box(0.5, 0.25, 0.3), x0, 0.125, fz + 0.15, 0, 0, 0, 1, 1, 1, jit(0x8fc79a)); for (let st = 0; st < 3; st++) { let px = x0 + (st - 1) * 0.12, prev = V(px, 0.25, fz + 0.03); const hh = (home ? 2.4 : 2.0) + 0.6 * r();
      for (let y = 0.3; y < hh; y += 0.08) { px += (r() - 0.5) * 0.07; const q = V(px, y, fz + 0.03); P.rod('leaf', G, prev, q, 0.008, 4, jit(0x5a6a3a)); prev = q; P.push(px, y, fz + 0.05, r() * 6, -0.3 - 0.8 * r()); P.add('leaf', G.box(0.09, 0.005, 0.11), 0, 0, 0.05, 0, 0, 0, 1, 1, 1, jit(green[st % 5], 0.1)); P.pop(); if (r() < 0.06) P.add('fruit', G.sphere(0.03, 8, 6), px, y, fz + 0.09, 0, 0, 0, 1, 0.6, 1, jit(fl[Math.floor(r() * fl.length)], 0.05)); } } }
    // a climbing frame on the side wall away from the crates: a timber lattice with a vine grown up through it
    { const sx = isStore ? 1 : -1; P.push(sx * (hw + 0.06), 0, 0.2, sx * PI / 2); for (let k = 0; k <= 4; k++) P.add('wood', G.box(0.04, 2.2, 0.03), -0.8 + k * 0.4, 1.15, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k <= 5; k++) P.add('wood', G.box(1.7, 0.035, 0.03), 0, 0.25 + k * 0.4, 0.03, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a));
      P.add('cer', G.box(1.6, 0.3, 0.3), 0, 0.15, 0.2, 0, 0, 0, 1, 1, 1, jit(0x8fc79a)); for (let k = 0; k < 4; k++) { let px = -0.6 + k * 0.4; for (let y = 0.3; y < 2.0 + 0.3 * r(); y += 0.09) { px += (r() - 0.5) * 0.08; P.push(px, y, 0.06, r() * 6, -0.2 - 0.9 * r()); P.add('leaf', G.box(0.08, 0.005, 0.1), 0, 0, 0.05, 0, 0, 0, 1, 1, 1, jit(green[k % 5], 0.1)); P.pop(); } plant(px, 2.0, 0.06, 0.2, 4, k % 2); } P.pop(); }
    if (home) {
      // shelves on the back wall either side of the window: seedling trays, seed jars, rainwater jars, small potted plants
      for (const [x0, x1] of [[-2.7, -0.65]]) for (const y of [1.4, 1.95, 2.45]) { const xm = (x0 + x1) / 2, w = x1 - x0; P.add('wood', G.box(w, 0.035, 0.24), xm, y, -1.68, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (const bx2 of [x0 + 0.1, x1 - 0.1]) P.add('cop', G.box(0.03, 0.12, 0.2), bx2, y - 0.07, -1.7, 0, 0, 0, 1, 1, 1, C(0xffffff));
        let x = x0 + 0.12; while (x < x1 - 0.15) { const t = y < 1.6 ? -1 : y > 2.2 ? 0.66 + 0.13 * r() : r() * 0.65; if (t < 0) { books(x, y + 0.02, -1.68); x += 0.36; } else if (t < 0.35) { P.add('wood', G.box(0.36, 0.05, 0.2), x + 0.18, y + 0.04, -1.68, 0, 0, 0, 1, 1, 1, jit(0x9a7a5a)); for (let k = 0; k < 6; k++) plant(x + 0.05 + (k % 3) * 0.12, y + 0.07, -1.73 + Math.floor(k / 3) * 0.1, 0.08, 3); x += 0.4; }
          else if (t < 0.65) { const h = 0.12 + 0.08 * r(); P.add('glass', G.cyl(0.05, 0.05, h, 10), x + 0.05, y + 0.02 + h / 2, -1.68); P.add('fruit', G.cyl(0.044, 0.044, h * 0.6, 10), x + 0.05, y + 0.02 + h * 0.3, -1.68, 0, 0, 0, 1, 1, 1, jit([0xc8a050, 0x6a4a2a, 0xa83a2a, 0x3a3a2a, 0xe8d8a0][Math.floor(r() * 5)], 0.05)); P.add('cop', G.cyl(0.052, 0.052, 0.015, 10), x + 0.05, y + 0.03 + h, -1.68); x += 0.13; }
          else if (t < 0.8) { P.add('glass', G.cyl(0.08, 0.08, 0.26, 12), x + 0.08, y + 0.15, -1.68); P.add('glow', G.cyl(0.072, 0.072, 0.16, 12), x + 0.08, y + 0.1, -1.68, 0, 0, 0, 1, 1, 1, C(0x6fc8d8).multiplyScalar(0.35)); x += 0.2; }
          else { P.add('pot', G.lathe('spot', [[0, 0], [0.06, 0], [0.08, 0.12], [0.085, 0.13]], 10), x + 0.08, y + 0.02, -1.68); plant(x + 0.08, y + 0.14, -1.68, 0.18, 6, r() < 0.3 ? 2 : 0); x += 0.2; } } }
      for (const x of [-0.25, 0.25]) { P.add('pot', G.lathe('spot', [[0, 0], [0.06, 0], [0.08, 0.12], [0.085, 0.13]], 10), x, 1.56, -1.7); plant(x, 1.68, -1.7, 0.16, 6, 1); }
      // warm lime plaster over the bare walls with wear and damp at the foot, a plank floor (the woven rug lies on it); the room's floor top is 0.17 m (baseview.js floor slab), so floor things stand at 0.17
      { const pl = (w, h, x, y, z, ry) => { P.add('plaster', G.box(w, h, 0.01), x, y, z, 0, ry, 0, 1, 1, 1, jit(0xe6cfa6, 0.04)); const gq = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = cellUV('wash'), uv = gq.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0); P.push(x, y, z, ry); P.add('decal', gq, 0, 0, 0.007, 0, 0, 0, 1, 1, 1, C(0xb8a080)); P.pop(); };
        pl(6.0, 3.0, 0, 1.5, -1.79, 0); pl(3.6, 3.0, -2.99, 1.5, 0, PI / 2); pl(3.6, 3.0, 2.99, 1.5, 0, -PI / 2); pl(1.8, 3.0, -2.1, 1.5, 1.79, PI); pl(1.8, 3.0, 2.1, 1.5, 1.79, PI); pl(2.4, 0.6, 0, 2.7, 1.79, PI);
        for (let z = -1.75; z < 1.75; z += 0.2) { let x = -2.98; while (x < 2.97) { const l = Math.min(2.98 - x, 0.9 + 1.4 * r()); P.add('wood', G.box(l - 0.008, 0.012, 0.192), x + l / 2, 0.176, z + 0.1, 0, 0, 0, 1, 1, 1, jit(0x9a6a40, 0.1)); x += l; } } }
      // a small bloom-tech workbench wall to the right of the window: a pegboard of hand tools and coils, a shelf of solar petals, glass bulbs and wire spools, parts trays on the bench top between the cats' places
      { P.add('wood', G.box(1.7, 0.95, 0.025), 1.5, 1.85, -1.77, 0, 0, 0, 1, 1, 1, jit(0xb89a6a)); for (let i = 0; i < 6; i++) { const x = 0.85 + i * 0.26, y = 2.05 + (i % 2) * 0.05, t = i % 3; P.add('cop', G.cyl(0.006, 0.006, 0.04, 6), x, y + 0.14, -1.74, PI / 2, 0, 0, 1, 1, 1, C(0xffffff));
          if (t === 0) { P.add('metal', G.box(0.03, 0.22, 0.012), x, y, -1.75, 0, 0, 0.1, 1, 1, 1, C(0x8a8a84)); P.add('metal', G.box(0.07, 0.04, 0.014), x, y + 0.11, -1.75, 0, 0, 0.1, 1, 1, 1, C(0x8a8a84)); } else if (t === 1) { P.add('wood', G.cyl(0.018, 0.018, 0.1, 6), x, y + 0.06, -1.75, 0, 0, 0, 1, 1, 1, jit(0xc83a2a)); P.add('metal', G.cyl(0.005, 0.005, 0.12, 6), x, y - 0.05, -1.75); } else P.add('cop', G.torus(0.07, 0.012, 6, 16), x, y, -1.75, 0, 0, 0, 1, 1, 1, C(0xffffff)); }
        P.add('wood', G.box(1.6, 0.03, 0.22), 1.5, 1.38, -1.68, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k < 4; k++) P.add('cell', G.box(0.16, 0.012, 0.11), 0.85 + k * 0.17, 1.42 + k * 0.012, -1.68, 0.5, (r() - 0.5) * 0.3, 0, 1, 1, 1, C(0xffffff)); for (let k = 0; k < 3; k++) { P.add('glass', G.sphere(0.045, 10, 8), 1.6 + k * 0.12, 1.445, -1.68); P.add('glow', G.sphere(0.012, 6, 4), 1.6 + k * 0.12, 1.44, -1.68, 0, 0, 0, 1, 1, 1, C(0xffe0a0)); }
        for (let k = 0; k < 2; k++) P.add('cop', G.cyl(0.05, 0.05, 0.07, 12), 2.05 + k * 0.13, 1.43, -1.68, 0, 0, 0, 1, 1, 1, C(0xffffff));
        for (const x of [0.95, 2.6]) { P.add('wood', G.box(0.4, 0.05, 0.28), x, 1.0, -1.62, 0, 0.1, 0, 1, 1, 1, jit(0x9a7a5a)); for (let k = 0; k < 3; k++) P.add(k ? 'cop' : 'cell', k ? G.torus(0.035, 0.01, 6, 12) : G.box(0.13, 0.01, 0.09), x - 0.1 + k * 0.1, 1.04, -1.62, PI / 2 * (k ? 1 : 0), 0, 0, 1, 1, 1, C(0xffffff)); } }
      // the kitchen corner by the stove: a counter with a cutting board, carrots, tomatoes, a squash and a loaf, a bowl of plums; onions and garlic hung in strings
      { P.push(2.72, 0.17, 0.0, 0); P.add('wood', G.box(0.5, 0.86, 0.72), 0, 0.43, 0, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a)); P.add('wood', G.box(0.54, 0.04, 0.76), 0, 0.88, 0, 0, 0, 0, 1, 1, 1, jit(0x9a7a5a)); P.add('wood', G.box(0.3, 0.02, 0.22), -0.05, 0.91, -0.15, 0, 0.2, 0, 1, 1, 1, jit(0xc8a878));
        for (let k = 0; k < 4; k++) P.add('fruit', G.cyl(0.018, 0.002, 0.16, 6), -0.08 + k * 0.03, 0.93, -0.16, PI / 2, 0.3 + k * 0.1, 0, 1, 1, 1, jit(0xe8781a, 0.05)); for (let k = 0; k < 3; k++) P.add('fruit', G.sphere(0.04, 10, 8), 0.1, 0.94, 0.12 + k * 0.08, 0, 0, 0, 1, 0.85, 1, jit(0xc83a2a, 0.05));
        P.add('fruit', G.sphere(0.09, 12, 8), -0.1, 0.97, 0.2, 0, 0, 0, 1.3, 0.85, 1, jit(0xe8a23a)); P.add('fruit', G.sphere(0.08, 10, 6), 0.12, 0.95, -0.28, 0, 0, 0, 1.6, 0.8, 1, jit(0xb8803a)); P.add('cer', G.lathe('bowl', [[0, 0], [0.07, 0], [0.11, 0.06], [0.12, 0.065]], 14), -0.1, 0.9, 0.0, 0, 0, 0, 1, 1, 1, jit(0x3f7f6a)); for (let k = 0; k < 4; k++) P.add('fruit', G.sphere(0.03, 8, 6), -0.1 + (r() - 0.5) * 0.08, 0.96, (r() - 0.5) * 0.08, 0, 0, 0, 1, 1, 1, jit(0x5a2a5a, 0.05)); P.pop();
        for (const x of [2.5, 2.8]) { P.rod('dark', G, V(x, 2.7, -0.9), V(x, 2.0, -0.9), 0.005, 4, C(0xb89a6a)); for (let k = 0; k < 6; k++) P.add('fruit', G.sphere(0.04, 8, 6), x + (k % 2 ? 0.03 : -0.03), 2.05 + k * 0.1, -0.9, 0, 0, 0, 1, 1.1, 1, jit(x < 2.6 ? 0xc8a060 : 0xf0e8d8, 0.05)); } }
      // hanging planters on ropes from the vault, vines trailing
      for (const [x, z] of DM.hang) { P.rod('dark', G, V(x, 3.9, z), V(x, 2.42, z), 0.006, 4, C(0xb89a6a)); for (const a of [0, 2.1, 4.2]) P.rod('dark', G, V(x, 2.6, z), V(x + Math.cos(a) * 0.13, 2.32, z + Math.sin(a) * 0.13), 0.004, 4, C(0xb89a6a));
        P.add('cer', G.lathe('hang', [[0, 0], [0.08, 0.0], [0.13, 0.06], [0.14, 0.16], [0.145, 0.17]], 14), x, 2.18, z, 0, 0, 0, 1, 1, 1, jit([0xf2ecdc, 0x8fc79a, 0xd08860][Math.floor(r() * 3)])); plant(x, 2.34, z, 0.26, 9); for (let k = 0; k < 3; k++) trail(x + (r() - 0.5) * 0.2, 2.3, z + (r() - 0.5) * 0.2, 0.4 + 0.5 * r()); }
      // herbs drying from a beam across the room
      P.add('wood', G.box(6.0, 0.1, 0.12), 0, 2.75, -0.9, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a)); for (let k = 0; k < DM.herbs; k++) { const x = -2.6 + k * (5.2 / (DM.herbs - 1)) + (r() - 0.5) * 0.1, l = 0.2 + 0.12 * r(); P.rod('dark', G, V(x, 2.7, -0.9), V(x, 2.55, -0.9), 0.004, 4, C(0xb89a6a)); const hc = k % 3 ? 0x4a6a34 : 0x6a5a34; P.add('leaf', G.cyl(0.04, 0.012, l, 6), x, 2.55 - l / 2, -0.9, 0, r() * 3, 0, 1, 1, 1, jit(hc, 0.08)); for (let j = 0; j < 5; j++) { P.push(x, 2.55 - 0.03, -0.9, j * 1.26 + r(), PI / 2 - 0.25 - 0.2 * r()); P.add('leaf', G.box(0.035, 0.004, l * (0.8 + 0.3 * r())), 0, 0, l * 0.45, 0, 0, 0, 1, 1, 1, jit(hc, 0.1)); P.pop(); } }
      // warm solar bulbs strung under the front of the vault
      { let prev = null; for (let k = 0; k <= DM.bulbs; k++) { const t = k / DM.bulbs, q = V(-3.0 + 6.0 * t, 2.95 - 0.35 * 4 * t * (1 - t), 1.4); if (prev) P.rod('dark', G, prev, q, 0.004, 4); if (k > 0 && k < DM.bulbs) P.add('glow', G.sphere(0.03, 8, 6), q.x, q.y - 0.05, q.z, 0, 0, 0, 1, 1, 1, C(0xffd890)); prev = q; } }
      // the bed nook: a patchwork quilt, cushions, a curtain on a rod, a chest at the foot with a folded blanket
      { const qc = [0xc86a4a, 0xe8c87a, 0x5a8a6a, 0x8aa8c8, 0xd8a0a0, 0x3f6b4a, 0xf2ecdc]; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) P.add('cloth', G.box(0.27, 0.03, 0.29), -3.06 + i * 0.28, 0.615 + 0.004 * ((i + j) % 2), -0.36 + j * 0.3, 0, 0, 0, 1, 1, 1, jit(qc[(i * 7 + j * 3 + Math.floor(r() * 2)) % qc.length], 0.05));
        for (const x of [-2.75, -1.95]) P.add('cloth', G.box(0.55, 0.16, 0.32), x, 0.86, -0.72, -0.25, (r() - 0.5) * 0.2, 0, 1, 1, 1, jit(qc[Math.floor(r() * qc.length)], 0.05));
        P.rod('cop', G, V(-1.32, 2.35, -1.6), V(-1.32, 2.35, 1.45), 0.012, 6); P.push(-1.32, 2.33, 1.15, PI / 2); PROPS.curtain(P, G, r, 0.38, 1.95, jit(0x7f9a7a, 0.04), false); P.pop(); P.push(-1.32, 2.33, -1.3, PI / 2); PROPS.curtain(P, G, r, 0.32, 1.95, jit(0x7f9a7a, 0.04), false); P.pop();
        P.add('wood', G.box(1.0, 0.42, 0.38), -2.3, 0.38, 1.6, 0, 0, 0, 1, 1, 1, jit(0x8a5a3a)); P.add('cop', G.box(1.02, 0.03, 0.4), -2.3, 0.6, 1.6, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.add('cloth', G.box(0.6, 0.1, 0.32), -2.45, 0.66, 1.6, 0, 0.1, 0, 1, 1, 1, jit(0x5a8a6a)); P.add('cer', G.box(0.18, 0.05, 0.24), -1.95, 0.64, 1.6, 0, 0.4, 0, 1, 1, 1, jit(0x8a3a2e)); }
      // a woven rug (stripes and fringes over the plain one), floor cushions
      { const rc = [0xb8584a, 0xe8c87a, 0x3f7f6a, 0xf2ecdc, 0xb8584a, 0x8a6a3a, 0x3f7f6a, 0xe8c87a, 0xb8584a]; for (let k = 0; k < rc.length; k++) P.add('cloth', G.box(2.1, 0.006, 1.5 / rc.length), 0, 0.186, 0.6 - 0.75 + (k + 0.5) * 1.5 / rc.length, 0, 0, 0, 1, 1, 1, jit(rc[k], 0.04)); for (const sx of [-1, 1]) for (let k = 0; k < 14; k++) P.add('cloth', G.box(0.06, 0.004, 0.012), sx * 1.13, 0.185, -0.12 + k * 0.105, 0, 0, 0, 1, 1, 1, C(0xe8dcc0));
        for (const [x, z] of [[0.8, 1.25], [1.25, 0.95]]) P.add('cloth', G.box(0.5, 0.13, 0.5), x, 0.25, z, 0, r(), 0, 1, 1, 1, jit([0xd8a040, 0x5a8a6a][Math.floor(r() * 2)])); }
      // a hand-made chair at the desk, a crate of produce by the stove, pots on a rail over it
      { P.push(2.3, 0.17, 1.58, PI); P.add('wood', G.box(0.44, 0.05, 0.42), 0, 0.46, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (const [sx, sz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) P.add('wood', G.cyl(0.022, 0.026, 0.46, 6), sx, 0.23, sz, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); for (const sx of [-0.18, 0.18]) P.add('wood', G.cyl(0.02, 0.022, 0.5, 6), sx, 0.72, -0.19, -0.1, 0, 0, 1, 1, 1, jit(0x6a4a2a)); for (const y of [0.62, 0.78, 0.92]) P.add('wood', G.box(0.38, 0.05, 0.02), 0, y, -0.2, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); P.add('cloth', G.box(0.38, 0.05, 0.36), 0, 0.5, 0.01, 0, 0, 0, 1, 1, 1, jit(0x5a8a6a)); P.pop(); }
      { P.push(2.1, 0.17, -1.05, 0.1); PROPS.crate(P, G, r, 1, jit(0xb08a5a)); for (let k = 0; k < 9; k++) { const t = r(); P.add('fruit', G.sphere(t < 0.5 ? 0.045 : 0.07, 10, 8), (r() - 0.5) * 0.36, 0.25 + 0.04 * r(), (r() - 0.5) * 0.24, 0, 0, 0, 1, t < 0.5 ? 1 : 0.8, 1, jit(t < 0.35 ? 0xc83a2a : t < 0.5 ? 0xe8a23a : t < 0.75 ? 0x7fa83a : 0xd8b040, 0.06)); } plant(0.12, 0.3, 0.02, 0.22, 6); P.pop(); }
      { P.add('cop', G.cyl(0.012, 0.012, 1.1, 6), 2.95, 1.85, -0.6, PI / 2, 0, 0, 1, 1, 1, C(0xffffff)); for (let k = 0; k < 4; k++) { const z = -1.0 + k * 0.27; P.rod('dark', G, V(2.95, 1.85, z), V(2.95, 1.7, z), 0.004, 4); P.add(k === 3 ? 'cop' : 'metal', G.cyl(0.08 - 0.01 * k, 0.07 - 0.01 * k, 0.12, 12), 2.93, 1.62, z, 0, 0, 0, 1, 1, 1, k === 3 ? C(0xffffff) : C(0x5a5650)); } }
      // the map and notes pinned on the wall above the bed; bloom-tech parts on the desk being mended
      { P.push(-2.98, 0, 0.3, PI / 2); P.add('wood', G.box(1.6, 1.0, 0.03), 0, 1.85, 0, 0, 0, 0, 1, 1, 1, jit(0xb08a5a)); P.add('mapt', new THREE.PlaneGeometry(0.8, 0.6), -0.3, 1.88, 0.02, 0, 0, 0.03, 1, 1, 1, C(0xffffff)); for (let k = 0; k < 6; k++) P.add('cer', G.box(0.13, 0.17, 0.004), 0.2 + (k % 3) * 0.17, 1.98 - Math.floor(k / 3) * 0.24, 0.02 + 0.001 * k, 0, 0, (r() - 0.5) * 0.2, 1, 1, 1, jit([0xf2ecdc, 0xe8d8a0, 0xd8e8f0][k % 3], 0.05));
        for (let k = 0; k < 6; k++) P.add('fruit', G.sphere(0.012, 6, 4), -0.45 + r() * 0.9, 1.6 + r() * 0.5, 0.025, 0, 0, 0, 1, 1, 1, jit([0xc83a2a, 0x3f7fba, 0xe8c040][k % 3], 0.02)); P.pop(); }
      { P.add('cop', G.torus(0.05, 0.012, 6, 14), 1.75, 0.83, 0.6, PI / 2, 0, 0, 1, 1, 1, C(0xffffff)); P.add('cell', G.box(0.2, 0.012, 0.13), 1.82, 0.83, 0.85, 0, 0.4, 0, 1, 1, 1, C(0xffffff)); P.add('metal', G.cyl(0.006, 0.006, 0.16, 6), 2.0, 0.83, 0.58, 0, 0.3, PI / 2, 1, 1, 1, C(0x8a8a84)); P.add('glass', G.cyl(0.03, 0.03, 0.08, 8), 2.05, 0.86, 0.75); }
      // big potted plants by the door inside and by the bed
      for (const [x, z, s] of [[1.55, 1.55, 0.7], [-1.15, -1.12, 0.55], [2.75, 1.6, 0.6]]) { P.add('pot', G.lathe('bigpot', [[0, 0], [0.16, 0], [0.2, 0.3], [0.22, 0.34]], 14), x, 0.17, z); P.add('soil', G.cyl(0.19, 0.19, 0.02, 12), x, 0.49, z); plant(x, 0.5, z, s, 13, s > 0.6 ? 0 : 2); }
    }
    // a room you walk into (the workshop, Marla's house): its own dressing from src/rooms.js, merged with the rest of this building
    if (b.inside) b.inside({ P, G, r, M, C, jit, V, PI, plant, trail, books, b, hw, hd, top, fz, dw, dh });
  }
  P.pop();
  // merge per surface: one mesh per surface for this building
  let tri = 0; for (const [key, list] of acc) { const geos = []; for (const [geo, m, tint] of list) { const q = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k2 of Object.keys(q.attributes)) if (k2 !== 'position' && k2 !== 'normal' && k2 !== 'uv') q.deleteAttribute(k2); if (!q.attributes.normal) q.computeVertexNormals(); if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
      q.applyMatrix4(m); const n = q.attributes.position.count, cc = new Float32Array(n * 3), t = tint || C(0xffffff); for (let i = 0; i < n; i++) { cc[3 * i] = t.r; cc[3 * i + 1] = t.g; cc[3 * i + 2] = t.b; } q.setAttribute('color', new THREE.BufferAttribute(cc, 3)); geos.push(q); }
    const mg = mergeGeometries(geos, false); for (const q of geos) q.dispose(); if (!mg) continue; const me = new THREE.Mesh(mg, M[key] || M.cer); me.castShadow = !me.material.transparent; me.receiveShadow = true; g.add(me); tri += mg.attributes.position.count / 3; }
  (g.userData.densityB || (g.userData.densityB = {}))[word] = Math.round(tri);
}
