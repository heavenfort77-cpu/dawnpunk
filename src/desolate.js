// DESOLATE SAMPLE (2026-11-15, not approved; off unless ?look=desolate): the old world left alone for years.
// realCar(): one abandoned car at real size with a crisp body, panel gaps, handles, mirrors, wipers, plates, trim, tyre tread, faded chalky paint rusting at the sills,
// arches and door bottoms, dirty cracked glass, a flat tyre, weeds through the wheels and leaves on the bonnet. Every number is in CONFIG.desolate.car.
import * as THREE from 'three';

function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }

// sample placing: car 0 moved onto the verge in front of the sample house, at an angle, with collision circles along its length
export function placeSample(run, cfg) {
  const D = cfg.desolate, h = run.houses[D.house], c = run.cars[0]; if (!h || !c) return;
  const side = Math.sign(h.z) || 1, A = D.car;
  c.x = h.doorX + A.along; c.z = side * (3.5 + A.verge * 0.25); c.yaw = side * A.angle; c.kind = 0; c.real = true; c.r = A.r;
  const ax = Math.cos(c.yaw), az = -Math.sin(c.yaw), half = A.len[0] / 2 - A.r;
  for (const s of [-1, 1]) run.cars.push({ x: c.x + ax * half * s, z: c.z + az * half * s, r: A.r, ghost: true });
}

// paint: faded, chalky, mostly intact; rust only where water sits (sills, arch rims, door bottoms, panel edges)
function paintTex(base, s, A) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const x = cv.getContext('2d'), r = rng(s);
  const col = new THREE.Color(base); const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, hsl.s * A.fadeSat, Math.min(0.82, hsl.l + A.fadeLight));
  x.fillStyle = '#' + col.getHexString(); x.fillRect(0, 0, 1024, 256);
  for (let k = 0; k < 2200; k++) { x.fillStyle = `rgba(255,255,250,${0.02 + 0.05 * r()})`; x.fillRect(r() * 1024, r() * 140, 2 + r() * 14, 1 + r() * 5); } // chalky oxidation, strongest on top surfaces (top of the texture)
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(60,55,45,${0.03 + 0.05 * r()})`; x.fillRect(r() * 1024, 150 + r() * 106, 1 + r() * 6, 1 + r() * 3); } // road grime low down
  const rust = (px, py, w, hgt, a) => { const g = x.createRadialGradient(px, py, 1, px, py, Math.max(w, hgt)); g.addColorStop(0, `rgba(118,58,28,${a})`); g.addColorStop(0.6, `rgba(140,78,40,${a * 0.6})`); g.addColorStop(1, 'rgba(140,78,40,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(px, py, w, hgt, 0, 0, 7); x.fill(); };
  for (let k = 0; k < 26; k++) rust(r() * 1024, 236 + r() * 20, 18 + r() * 40, 8 + r() * 12, 0.75); // sills
  for (const ax of [0.21, 0.79]) for (let k = 0; k < 10; k++) { const a = Math.PI * (0.1 + 0.8 * r()); rust(ax * 1024 + Math.cos(a) * 80, 200 - Math.sin(a) * 70, 8 + r() * 14, 5 + r() * 8, 0.7); } // wheel-arch rims
  for (let k = 0; k < 14; k++) { const px = 300 + r() * 420; rust(px, 225 + r() * 12, 10 + r() * 20, 4 + r() * 6, 0.6); x.fillStyle = 'rgba(110,60,30,0.35)'; x.fillRect(px, 140 + r() * 60, 1, 30 + r() * 40); } // door bottoms, rust runs
  for (let k = 0; k < 60; k++) { x.strokeStyle = `rgba(230,230,225,${0.08 + 0.1 * r()})`; x.lineWidth = 0.6; x.beginPath(); const px = r() * 1024, py = r() * 200; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 40, py + (r() - 0.5) * 6); x.stroke(); } // scratches
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// glass: dirty with a crack web, so it reads as old glass catching the sky
function glassTex(s, cracked) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), r = rng(s);
  x.fillStyle = 'rgba(40,48,46,0.78)'; x.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 500; k++) { x.fillStyle = `rgba(150,140,120,${0.04 + 0.08 * r()})`; x.fillRect(r() * 256, 120 + r() * 136, 2 + r() * 10, 1 + r() * 4); } // dust settled toward the bottom
  if (cracked) { const cx = 60 + r() * 140, cy = 60 + r() * 120; x.strokeStyle = 'rgba(225,230,230,0.7)'; x.lineWidth = 1; for (let k = 0; k < 9; k++) { let px = cx, py = cy, a = r() * 6.28; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 6; j++) { a += (r() - 0.5) * 0.7; px += Math.cos(a) * 18; py += Math.sin(a) * 18; x.lineTo(px, py); } x.stroke(); } for (let k = 1; k < 4; k++) { x.beginPath(); x.arc(cx, cy, k * 14, 0, 7); x.stroke(); } }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function realCar(c, cfg, M, base) {
  const A = cfg.desolate.car, r = rng(c.s * 7 + 3), L = A.len[0], L2 = L / 2, W2 = A.width / 2, g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ map: paintTex(base, c.s, A), shininess: 6, specular: 0x202020 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x141515 }), trim = new THREE.MeshPhongMaterial({ color: 0x1b1c1d, shininess: 20, specular: 0x333333 });
  const glass = (cr) => new THREE.MeshPhongMaterial({ map: glassTex(c.s + (cr ? 11 : 5), cr), transparent: true, shininess: 90, specular: 0x8c9496, side: THREE.DoubleSide, depthWrite: false });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  // lower body: side outline with crisp edges (small bevel), wheel arches; x forward
  const wb = A.wheelbase / 2, wr = A.wheelR, ar = wr + 0.06, belt = A.belt, s = new THREE.Shape();
  s.moveTo(-L2 + 0.02, 0.30); s.lineTo(-L2, 0.62); s.lineTo(-L2 + 0.06, belt + 0.04); s.lineTo(-L2 + 0.55, belt + 0.07); // tail and boot lid
  s.lineTo(L2 - 1.25, belt + 0.02); s.lineTo(L2 - 0.12, belt - 0.12); s.lineTo(L2, belt - 0.2); s.lineTo(L2 + 0.02, 0.34); // bonnet slopes to a near-flat nose
  s.lineTo(wb + ar, 0.30); s.absarc(wb, wr, ar, 0, Math.PI, false); s.lineTo(-wb + ar, 0.30); s.absarc(-wb, wr, ar, 0, Math.PI, false); s.lineTo(-L2 + 0.02, 0.30);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 2 * W2 - 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, steps: 4, curveSegments: 16 }); geo.translate(0, 0, -(W2 - 0.03));
  { const P = geo.attributes.position, U = geo.attributes.uv; for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i), pz = P.getZ(i), up = Math.max(0, Math.min(1, (py - 0.6) / (belt - 0.6))); P.setZ(i, pz * (1 - 0.035 * up) * (1 - 0.06 * Math.pow(Math.abs(px) / L2, 6))); U.setXY(i, (px + L2) / L, 1 - (py - 0.25) / (belt - 0.2) * 0.9 + Math.abs(pz) * 0.0); } geo.computeVertexNormals(); }
  g.add(new THREE.Mesh(geo, paint));
  // greenhouse: glass box under a painted roof and pillars (windscreen raked, rear window raked)
  const ws = [L2 - 1.25, belt + 0.02], rf = [L2 - 2.05, A.roof], rr = [-L2 + 1.45, A.roof], rw = [-L2 + 0.6, belt + 0.07], gW = W2 - 0.12;
  const gl = glass(false), glc = glass(true), quad = (p, m) => { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute([...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]], 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); ge.computeVertexNormals(); const o = new THREE.Mesh(ge, m); g.add(o); return o; };
  quad([[ws[0], ws[1], -gW], [ws[0], ws[1], gW], [rf[0], rf[1], gW - 0.08], [rf[0], rf[1], -gW + 0.08]], glc); // windscreen, cracked
  quad([[rw[0], rw[1], gW], [rw[0], rw[1], -gW], [rr[0], rr[1], -gW + 0.08], [rr[0], rr[1], gW - 0.08]], gl);
  for (const z of [-1, 1]) { const zz = z * gW, zt = z * (gW - 0.08); quad([[rw[0], rw[1], zz], [ws[0], ws[1], zz], [rf[0], rf[1], zt], [rr[0], rr[1], zt]], gl); }
  const roof = box(rf[0] - rr[0] + 0.1, 0.05, 2 * gW - 0.12, paint, (rf[0] + rr[0]) / 2, A.roof + 0.02, 0);
  const pillar = (p0, p1, z) => { const dx = p1[0] - p0[0], dy = p1[1] - p0[1], o = box(0.07, Math.hypot(dx, dy), 0.06, paint, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z); o.rotation.z = -Math.atan2(dx, dy); };
  for (const z of [-1, 1]) { const zz = z * (gW - 0.03); pillar(ws, rf, zz); pillar(rw, rr, zz); const bx = (rf[0] + rr[0]) / 2 - 0.15; pillar([bx, belt + 0.03], [bx, A.roof], zz); }
  // small parts: panel gaps, shoulder crease, handles, mirrors, wipers, plates, rubbing strip, lights, bumpers
  const zS = W2 + 0.002;
  for (const z of [-zS, zS]) {
    for (const gx of [wb - ar - 0.12, (rf[0] + rr[0]) / 2 - 0.15, -wb + ar + 0.1]) box(0.008, belt - 0.36, 0.004, dark, gx, (belt + 0.36) / 2, z); // door and wing gaps
    box(L - 0.5, 0.012, 0.006, paint, -0.05, belt - 0.07, z * 1.001); // shoulder crease
    box(L - 0.3, 0.05, 0.012, trim, 0, 0.47, z); // rubbing strip
    for (const hx of [(rf[0] + rr[0]) / 2 + 0.35, (rf[0] + rr[0]) / 2 - 0.6]) box(0.16, 0.025, 0.02, trim, hx, belt - 0.13, z * 1.003); // door handles
    const mir = box(0.14, 0.09, 0.16, trim, ws[0] - 0.12, belt + 0.12, z * (W2 + 0.07)); mir.rotation.y = 0.2 * Math.sign(z);
  }
  box(0.004, 0.006, 2 * W2 - 0.25, dark, L2 - 0.3, belt - 0.15, 0); // bonnet gap
  box(0.004, 0.006, 2 * W2 - 0.25, dark, -L2 + 0.5, belt + 0.06, 0); // boot gap
  for (const z of [-0.35, 0.3]) { const wp = box(0.5, 0.012, 0.02, trim, ws[0] - 0.05, ws[1] + 0.03, z); wp.rotation.y = 0.5; } // wipers
  const plate = new THREE.MeshLambertMaterial({ color: 0xd8d4c4 });
  box(0.012, 0.11, 0.52, plate, L2 + 0.045, 0.42, 0); box(0.012, 0.11, 0.52, plate, -L2 - 0.02, 0.5, 0); // blank plates
  for (const sx of [-1, 1]) box(0.09, 0.14, 2 * W2 - 0.04, trim, sx * (L2 + 0.02), 0.38, 0); // bumpers
  const lens = new THREE.MeshPhongMaterial({ color: 0xb7b2a2, shininess: 60, specular: 0x666666, transparent: true, opacity: 0.85 }), tail = new THREE.MeshPhongMaterial({ color: 0x5a1814, shininess: 40, specular: 0x333333 });
  for (const z of [-1, 1]) { const hl = box(0.06, 0.1, 0.42, lens, L2 - 0.015, belt - 0.25, z * (W2 - 0.3)); hl.rotation.y = -0.18 * z; if (r() < 0.5) hl.material = dark; const tl = box(0.04, 0.12, 0.38, tail, -L2 + 0.0, 0.7, z * (W2 - 0.28)); tl.rotation.y = 0.1 * z; }
  // inside, seen through the glass
  for (const z of [-0.38, 0.38]) { box(0.5, 0.14, 0.48, M.seat, rf[0] - 0.7, belt - 0.25, z); const bk = box(0.1, 0.55, 0.48, M.seat, rf[0] - 0.98, belt + 0.05, z); bk.rotation.z = 0.2; }
  box(0.3, 0.16, 2 * gW - 0.1, trim, ws[0] - 0.25, belt - 0.03, 0);
  // wheels: tyre with tread and sidewall, steel rim; front-left flat
  const tyreGeo = new THREE.CylinderGeometry(wr, wr, A.tyreW, 40, 1), tread = new THREE.MeshPhongMaterial({ color: 0x151515, shininess: 6, map: (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const x = cv.getContext('2d'); x.fillStyle = '#2a2a2a'; x.fillRect(0, 0, 256, 32); x.fillStyle = '#111'; for (let k = 0; k < 64; k++) { x.fillRect(k * 4, 4, 2, 10); x.fillRect(k * 4 + 2, 18, 2, 10); } const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })() });
  const rimM = new THREE.MeshPhongMaterial({ color: 0x6d6a64, shininess: 30, specular: 0x444444 });
  [[wb, 1], [wb, -1], [-wb, 1], [-wb, -1]].forEach(([wx, wz], k) => {
    const flat = k === 0, w = new THREE.Mesh(tyreGeo, tread); w.rotation.x = Math.PI / 2; w.position.set(wx, flat ? wr * 0.78 : wr, wz * (W2 - A.tyreW / 2 - 0.02)); if (flat) w.scale.set(1.04, 1, 0.78); g.add(w);
    const sw = new THREE.Mesh(new THREE.TorusGeometry(wr * 0.78, 0.035, 6, 32), trim); sw.position.copy(w.position); sw.position.z += wz * A.tyreW * 0.48; if (flat) sw.scale.set(1.04, 0.78, 1); g.add(sw);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.6, wr * 0.6, 0.02, 24), rimM); rim.rotation.x = Math.PI / 2; rim.position.copy(sw.position); rim.position.z += wz * 0.012; if (flat) rim.scale.set(1.04, 1, 0.78); g.add(rim);
    for (let t = 0; t < 3; t++) { const tu = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55), M.tuft); tu.position.set(wx + (r() - 0.5) * 0.5, 0.27, wz * (W2 + (r() - 0.2) * 0.3)); tu.rotation.y = r() * 3; g.add(tu); } // weeds grown through the wheels
  });
  // leaves on the bonnet and roof, and in the windscreen gutter
  const leaf = new THREE.MeshLambertMaterial({ color: 0x7a5a2a, side: THREE.DoubleSide });
  for (let k = 0; k < A.leaves; k++) { const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.05), leaf), onRoof = k % 3 === 0; lf.rotation.set(-Math.PI / 2 + (r() - 0.5) * 0.4, 0, r() * 6.3); lf.position.set(onRoof ? rr[0] + r() * (rf[0] - rr[0]) : ws[0] + 0.05 + r() * (L2 - ws[0] - 0.2), (onRoof ? A.roof + 0.05 : belt + 0.0) + 0.01, (r() - 0.5) * (2 * W2 - 0.4)); g.add(lf); }
  g.userData.lean = A.lean; return g;
}

// the sample house and the street in front of it, left alone for years (decals and props only; the house shape and its openings are unchanged, so the hole rule still holds)
export function decorateHouse(hg, h, cfg, M, look, tx, FH, add) {
  const D = cfg.desolate, s = h.sim, H = s.H, Ht = s.L * FH, r = rng(h.sim.seed || 4321 + h.i * 17), out = 0.215;
  look.wall.lerp(new THREE.Color(D.fadeTo), D.fade); // sun-bleached, washed-out wall colour
  const dm = (name, extra) => new THREE.MeshLambertMaterial(Object.assign({ map: tx(name), transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }, extra || {}));
  const ivy = dm('ivy'), moss = dm('moss'), streak = dm('streaks'), grime = dm('footgrime'), litter = dm('litter'), crack = dm('roadcrack'), leaves = dm('leaves', { color: 0x9a7a4a, alphaTest: 0.35 });
  // a plane on a wall face: wall = 0..3 (x = +H, x = -H, z = +H, z = -H), u = position along the wall, y = bottom, w x hgt
  const onWall = (m, wall, u, y, w, hgt) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), m), sg = wall % 2 ? -1 : 1; if (wall < 2) { p.position.set(sg * (H + out), y + hgt / 2, u); p.rotation.y = sg * Math.PI / 2; } else { p.position.set(u, y + hgt / 2, sg * (H + out)); p.rotation.y = sg > 0 ? 0 : Math.PI; } hg.add(p); return p; };
  for (let w = 0; w < 4; w++) { for (let u = -H + 0.6; u < H; u += 1.9 + r() * 0.6) onWall(grime, w, u, 0.0, 2.2, 0.55 + 0.35 * r()); } // grime and damp rising at the wall foot
  for (let k = 0; k < D.ivy; k++) { const w = Math.floor(r() * 4), u = (r() < 0.5 ? -1 : 1) * (H - 0.9 - r() * 0.8); onWall(ivy, w, u, 0, 1.8 + r() * 1.2, Math.min(Ht + 0.4, 2.6 + r() * Ht)); } // ivy climbing from the ground, reaching over the eaves
  for (let k = 0; k < D.moss; k++) onWall(moss, Math.floor(r() * 4), (r() * 2 - 1) * (H - 0.6), r() * 0.6, 0.7 + r() * 0.9, 0.4 + r() * 0.5);
  for (const b of s.breaches) { if (b.type !== 'window') continue; const wall = Math.abs(Math.abs(b.x) - H) < 0.05 ? (b.x > 0 ? 0 : 1) : (b.z > 0 ? 2 : 3), u = wall < 2 ? b.z : b.x; onWall(streak, wall, u, b.floor * FH + 0.15, 1.1, 0.8); } // rain streaks below every sill
  for (let w = 0; w < 4; w++) for (let k = 0; k < D.streaks; k++) onWall(streak, w, (r() * 2 - 1) * (H - 0.8), Ht - 1.3, 0.9, 1.25); // and below the eaves
  // one window boarded up, a gutter hanging off one corner
  const win = s.breaches.find((b) => b.type === 'window' && b.floor === 0);
  if (win) { const wall = Math.abs(Math.abs(win.x) - H) < 0.05 ? (win.x > 0 ? 0 : 1) : (win.z > 0 ? 2 : 3), u = wall < 2 ? win.z : win.x, sg = wall % 2 ? -1 : 1;
    for (let k = 0; k < 3; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(cfg.openingHalf * 2 + 0.4, 0.16, 0.03), M.wood); const y = 1.2 + k * 0.5 + (r() - 0.5) * 0.1; if (wall < 2) { pl.position.set(sg * (H + out + 0.02), y, u); pl.rotation.y = Math.PI / 2; } else pl.position.set(u, y, sg * (H + out + 0.02)); pl.rotation[wall < 2 ? 'x' : 'z'] = (r() - 0.5) * 0.25; hg.add(pl); } }
  const gut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8, 1, true, 0, Math.PI), M.frameDark || M.door); gut.position.set(H + 0.3, Ht - 0.9, H - 0.6); gut.rotation.set(0.15, 0, 0.9); hg.add(gut);
  // the street in front: cracks with weeds, litter, leaves, fallen bricks and a branch (world space, in front of the door)
  const sx = h.doorX, side = Math.sign(h.z) || 1, ground = (m, x, z, w, d, rot) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.set(-Math.PI / 2, 0, rot); p.position.set(x, 0.035 + r() * 0.01, z); add(p); return p; };
  for (let k = 0; k < D.cracks; k++) { const x = sx + (r() * 2 - 1) * D.street, z = (r() * 2 - 1) * 3.2; ground(crack, x, z, 2.2 + r() * 1.6, 1.2 + r(), r() * 3); for (let t = 0; t < 3; t++) { const tu = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + r() * 0.4, 0.45 + r() * 0.3), M.tuft); tu.position.set(x + (r() - 0.5) * 1.6, 0.22, z + (r() - 0.5) * 0.8); tu.rotation.y = r() * 3; add(tu); } } // weeds through the cracks
  for (let k = 0; k < D.litter; k++) ground(litter, sx + (r() * 2 - 1) * D.street, side * (1.5 + r() * 3.5), 0.9 + r() * 0.8, 0.9 + r() * 0.8, r() * 6);
  for (let k = 0; k < D.meadow; k++) ground(leaves, sx + (r() * 2 - 1) * D.street, side * (2.6 + r() * 1.2) * (r() < 0.7 ? 1 : -1), 0.5 + 0.4 * r(), 0.4 + 0.3 * r(), r() * 6); // drifts of dead leaves along the kerbs
  for (let k = 0; k < D.bricks; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.11), M.brick); b.position.set(h.doorX + (r() - 0.5) * 3, 0.035, h.doorZ - side * (0.6 + r() * 1.6)); b.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4); add(b); }
  const br = new THREE.Group(); for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03 - k * 0.005, 0.045 - k * 0.006, 1.6 - k * 0.3, 6), M.bark); c.rotation.z = Math.PI / 2; c.position.set(k * 0.35, 0.05, k ? (r() - 0.5) * 0.4 : 0); c.rotation.y = k ? (r() - 0.5) * 1.2 : 0; br.add(c); }
  br.position.set(sx - 2.5, 0.03, side * 2.6); br.rotation.y = r() * 3; add(br);
}

// second pass ("screaming desolate"): years of overgrowth over the whole stretch, a sagging holed roof, broken glass, washed-out walls, a fallen pole, weeds down the road
export function overgrow(hg, h, cfg, M, look, tx, FH, add) {
  const D = cfg.desolate, O = D.over, s = h.sim, H = s.H, Ht = s.L * FH, r = rng(7771 + h.i * 31), side = Math.sign(h.z) || 1, sx = h.doorX;
  const dm = (name, extra) => new THREE.MeshLambertMaterial(Object.assign({ map: tx(name), transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }, extra || {}));
  // roof: the middle sags and a hole is torn in it; slipped tiles lie below
  const rm = look.cover ? M.tiles : M.roof2, inv = new THREE.Matrix4(), v = new THREE.Vector3(); hg.updateMatrixWorld(true);
  hg.traverse((o) => { if (!o.isMesh || (o.material !== rm && !(Array.isArray(o.material) && o.material.includes(rm)))) return; const P = o.geometry.attributes.position; o.updateMatrix(); inv.copy(o.matrix).invert();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrix); if (v.y > Ht - 0.2) { const a = Math.max(0, 1 - (v.x / (H + 0.6)) ** 2), b = Math.max(0, 1 - (v.z / (H + 0.6)) ** 2); v.y -= D.sag * a * b * (0.6 + 0.4 * Math.min(1, (v.y - Ht) / 1.5)); } v.applyMatrix4(inv); P.setXYZ(i, v.x, v.y, v.z); }
    P.needsUpdate = true; o.geometry.computeVertexNormals(); });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 9), new THREE.MeshBasicMaterial({ color: 0x0b0a09, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }));
  { const p = hole.geometry.attributes.position; for (let i = 1; i < p.count; i++) p.setXY(i, p.getX(i) * (0.6 + 0.6 * r()), p.getY(i) * (0.6 + 0.6 * r())); }
  hole.scale.set(D.hole[0], D.hole[1], 1); hole.position.set((D.holeAt[0] - 0.5) * 2 * H, Ht + O.holeY, side * -0.4 * H); hole.rotation.set(-Math.PI / 2 + side * 0.55, 0, 0.2); hg.add(hole);
  for (let k = 0; k < O.slipped; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.24), rm); t.position.set((r() * 2 - 1) * H, 0.03, side * -(H + 0.6 + r() * 1.4)); t.rotation.set((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5); hg.add(t); }
  // walls: washed out by sun and dust, ivy in thick overlapping layers, some hanging from the eaves
  const wash = new THREE.MeshLambertMaterial({ color: 0xd9d4c6, transparent: true, opacity: O.wash, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, side: THREE.DoubleSide });
  const ivy = dm('ivy'), out = 0.22;
  const onWall = (m, wall, u, y, w, hgt, off) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), m), sg = wall % 2 ? -1 : 1, o2 = out + (off || 0); if (wall < 2) { p.position.set(sg * (H + o2), y + hgt / 2, u); p.rotation.y = sg * Math.PI / 2; } else { p.position.set(u, y + hgt / 2, sg * (H + o2)); p.rotation.y = sg > 0 ? 0 : Math.PI; } hg.add(p); return p; };
  for (let w = 0; w < 4; w++) onWall(wash, w, 0, 0, 2 * H + 0.4, Ht);
  for (let k = 0; k < O.ivyLayers; k++) { const w = Math.floor(r() * 4), u = (r() * 2 - 1) * (H - 0.5), hgt = 1.5 + r() * (Ht + 0.3); onWall(ivy, w, u, 0, 1.2 + r() * 1.6, Math.min(Ht + 0.3, hgt), 0.01 + 0.03 * r()); }
  for (let k = 0; k < O.ivyHang; k++) { const w = Math.floor(r() * 4); onWall(ivy, w, (r() * 2 - 1) * (H - 0.6), Ht - 1.2 - r() * 0.8, 0.9 + r() * 0.8, 1.4 + r() * 0.8, 0.05); }
  // broken glass left in some frames
  const gm = new THREE.MeshLambertMaterial({ color: 0x9fb2b0, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  for (const b of s.breaches.filter((q) => q.type === 'window').slice(1, 1 + O.shards)) { const wall = Math.abs(Math.abs(b.x) - H) < 0.05 ? (b.x > 0 ? 0 : 1) : (b.z > 0 ? 2 : 3), u = wall < 2 ? b.z : b.x;
    for (let k = 0; k < 3; k++) { const sh = new THREE.Shape(), w0 = cfg.openingHalf, cx = (k - 1) * w0 * 0.8; sh.moveTo(cx - 0.3, 0); sh.lineTo(cx + 0.3, 0); sh.lineTo(cx + (r() - 0.5) * 0.4, 0.25 + r() * 0.5); const p = new THREE.Mesh(new THREE.ShapeGeometry(sh), gm), sg = wall % 2 ? -1 : 1; p.position.set(wall < 2 ? sg * H : u, b.floor * FH + 0.92 + (k === 1 ? 0 : 0), wall < 2 ? u : sg * H); if (wall < 2) p.rotation.y = Math.PI / 2; hg.add(p); } }
  // overgrowth over the whole stretch: knee-to-waist-high meadow on lawns and verges, weeds down the road, saplings and bushes against the walls
  const tuftM = M.tuft, tuft = (x, z, sz) => { for (let q = 0; q < 2; q++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(sz * (0.9 + 0.3 * r()), sz), tuftM); t.position.set(x, sz / 2 - 0.04, z); t.rotation.y = r() * 3.14 + q * 1.57; add(t); } };
  const mat = dm('meadow'); for (let k = 0; k < O.meadowMats; k++) { const x = sx + (r() * 2 - 1) * O.len, z = (r() < 0.75 ? side : -side) * (3.8 + r() * 12), p = new THREE.Mesh(new THREE.PlaneGeometry(3 + r() * 2.5, 3 + r() * 2.5), mat); p.rotation.set(-Math.PI / 2, 0, r() * 6); p.position.set(x, 0.03, z); add(p); } // long dry grass over the mown lawns
  for (let k = 0; k < O.meadow; k++) { const x = sx + (r() * 2 - 1) * O.len, z = side * (3.6 + r() * (Math.abs(h.z) + H - 1)); if (Math.abs(x - h.doorX) < 1.0 && Math.abs(z - h.doorZ) < 3) continue; tuft(x, z, O.tall[0] + r() * (O.tall[1] - O.tall[0])); }
  for (let k = 0; k < O.meadow * 0.6; k++) tuft(sx + (r() * 2 - 1) * O.len, -side * (3.6 + r() * 6), O.tall[0] + r() * (O.tall[1] - O.tall[0]));
  for (let k = 0; k < O.roadWeeds; k++) { const along = r() < 0.55, x = sx + (r() * 2 - 1) * O.len, z = along ? (r() - 0.5) * 0.5 : Math.sign(r() - 0.5) * (3.0 + r() * 0.5); tuft(x, z, 0.35 + r() * 0.45); }
  for (let k = 0; k < O.saplings; k++) { const w = Math.floor(r() * 4), u = (r() * 2 - 1) * (H - 0.4), sg = w % 2 ? -1 : 1, lx = w < 2 ? sg * (H + 0.7) : u, lz = w < 2 ? u : sg * (H + 0.7), hgt = 1.4 + r() * 1.8, grp = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, hgt, 5), M.bark); st.position.y = hgt / 2; grp.add(st); for (let q = 0; q < 4; q++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(1.1 + r() * 0.6, 1.1 + r() * 0.6), M.canopy); c.position.set((r() - 0.5) * 0.5, hgt * (0.55 + 0.4 * r()), (r() - 0.5) * 0.5); c.rotation.set((r() - 0.5) * 0.6, q * 0.8, 0); grp.add(c); }
    grp.position.set(lx, 0, lz); grp.rotation.z = (r() - 0.5) * 0.2; hg.add(grp); }
  // a utility pole fallen across the verge, its wire hanging
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 7.5, 8), M.bark); pole.position.set(sx + O.poleAt, 0.9, side * 4.2); pole.rotation.set(0, 0.3, Math.PI / 2 - 0.28); add(pole);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sx + O.poleAt + 3.2, 1.8, side * 4.6), new THREE.Vector3(sx + O.poleAt + 5, 0.4, side * 3.6), new THREE.Vector3(sx + O.poleAt + 8, 0.05, side * 2.2)]), 20, 0.012, 4), M.frameDark); add(wire);
}
