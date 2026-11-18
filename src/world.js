// The settlement as ONE world (user, 2026-11-14): street, overgrowth, abandoned cars and six real houses.
// A house is the same geometry seen from outside and from inside, so every hole matches on both sides and
// whatever stands outside is in the right place when you look out. Night uses the same world, only darker.
import { GRITTY, GRIT, DESO } from './look.js';
import { realCar, decorateHouse, overgrow } from './desolate.js';
import { carHi } from './carhi.js';
import { houseHi } from './househi.js';
import { streetHi, tuftGeo, tuftMat } from './streethi.js';
import * as THREE from 'three';
import { TEX } from './texdata.js';
import { Q, QUALITY, texLoad, aniso, seg } from './quality.js';
import { CONFIG } from './config.js';
// desktop and laptop: cars are built by the master car builder (src/carhi.js); phones, and ?fx=0, keep the cars below
const HICAR = !!Q.car && (() => { try { return new URLSearchParams(location.search).get('fx') !== '0'; } catch (e) { return true; } })();
// desktop and laptop: the houses' frames, sashes, doors, roof, chimney, gutters, trims and ivy come from the master house builder (src/househi.js), with the approved desolate look; phones, and ?fx=0, keep the parts below
// desktop and laptop: kerbs, footway, drains, road damage, litter, the fallen pole, blade grass and single-leaf tree crowns come from the master street builder (src/streethi.js)
const HISTREET = !!Q.street && (() => { try { return new URLSearchParams(location.search).get('fx') !== '0'; } catch (e) { return true; } })();
const HIHOUSE = !!Q.house && (() => { try { return new URLSearchParams(location.search).get('fx') !== '0'; } catch (e) { return true; } })();

const FH = 3.2;
const loader = new THREE.TextureLoader();
function tx(name, alpha) { const t = texLoad(name); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.userData.tex = name; t.anisotropy = aniso(); return t; }
function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }

// box whose texture follows world size (tile metres per repeat), so neighbouring wall pieces line up
function tbox(w, h, d, mats, tile, ox, oy, oz) {
  const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const f = Math.floor(i / 4), x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
    if (f < 2) uv.setXY(i, z / tile, y / tile); else if (f < 4) uv.setXY(i, x / tile, z / tile); else uv.setXY(i, x / tile, y / tile);
  }
  const m = new THREE.Mesh(g, mats); m.position.set(ox, oy, oz); return m;
}
function scaleUV(g, k) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return g; }

export function buildWorld(cfg, run) {
  const W = cfg.world, T = cfg.town, g = new THREE.Group(), R = rng(run.seed ^ 0x51ed), wear = run.ring / 4;
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const M = {
    ext: lam({ map: tx('plaster'), color: new THREE.Color(W.extTint).lerp(new THREE.Color(W.extTintFar), wear * W.wearTint) }),
    int: lam({ map: tx('interior'), color: W.intTint }), brick: lam({ map: tx('brick'), color: 0xd8d0c8, side: THREE.DoubleSide }),
    wood: lam({ map: tx('wood'), color: W.floorTint, side: THREE.DoubleSide }), roof: lam({ map: tx('roof'), color: 0xc8d0c0 }), asphalt: lam({ map: tx('asphalt') }),
    grass: lam({ map: tx('grass') }), dirt: lam({ map: tx('grass'), color: 0xb09a70 }), bark: lam({ map: tx('bark') }), leaf: lam({ map: tx('leaves'), color: 0xdfe8d0 }),
    tuft: lam({ map: tx('tuft'), alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide }), vine: lam({ map: tx('vine'), alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide }),
    debris: lam({ map: tx('debris'), alphaTest: 0.4, side: THREE.DoubleSide }), glass: lam({ color: 0xa8c8d0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    door: lam({ map: tx('wood'), color: 0x8a6a4a }), pv: lam({ color: 0x1f3f7a }), rubber: new THREE.MeshPhongMaterial({ color: 0x0b0b0c, shininess: 12, specular: 0x222222 }), shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    stair: lam({ map: tx('wood'), color: 0xc8a878 }), canopy: lam({ map: tx('canopy'), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide }), canopyDark: lam({ map: tx('canopy'), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, color: 0x9fb08a }),
    cloth: lam({ map: tx('fabric') }), rug: lam({ map: tx('fabric'), color: 0xb86a5a }), woodDark: lam({ map: tx('wood'), color: 0x6a4e36 }), book: [0x8a3a2e, 0x2f5d8a, 0x3f6b4a, 0xc9a227, 0x5a4a6a].map((c) => lam({ color: c })),
    extB: lam({ map: tx('brick'), color: 0xd8d0c8 }), extS: lam({ map: tx('siding') }), extK: lam({ map: tx('block') }), tiles: lam({ map: tx('tiles'), side: THREE.DoubleSide }), roof2: lam({ map: tx('roof'), color: 0xc8d0c0, side: THREE.DoubleSide }),
    chrome: lam({ map: tx('rust'), color: 0xb8bcc0 }), seat: lam({ map: tx('fabric'), color: 0x5a5048 }), lampShade: lam({ map: tx('fabric'), color: 0xd8c8a0, side: THREE.DoubleSide }), frameDark: lam({ color: 0x3a2e24 }), paper: lam({ color: 0xcfc6ae })
  };
  for (const [k, r] of [['grass', 60], ['asphalt', 1]]) { M[k].map = M[k].map.clone(); M[k].map.needsUpdate = true; }
  for (const k of ['extB', 'extS', 'extK']) M[k].color.lerp(new THREE.Color(W.extTintFar), wear * W.wearTint);
  const add = (o, p) => { (p || g).add(o); return o; };
  const SH = HISTREET ? streetHi({ g, cfg, run, M, tx, deso: DESO.machines }) : null;
  // nothing is exactly the same (2026-11-14): every house, car, tree and piece of furniture gets its own signature; a repeat is rolled again
  const sigs = { house: [], car: [], tree: [], furn: [] }, hslc = (h, s2, l) => new THREE.Color().setHSL(h, s2, l), hexc = (c) => new THREE.Color(c);
  const uniq = (cat, make) => { let o; for (let k = 0; k < 8; k++) { o = make(); if (!sigs[cat].includes(o.sig)) break; } sigs[cat].push(o.sig); return o; };
  // flat polygon (fan) with UVs laid along its own first edge; `out` is the side it must face
  const poly = (pts, m, p, tile, out) => {
    const A = pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])); let n = new THREE.Vector3().subVectors(A[1], A[0]).cross(new THREE.Vector3().subVectors(A[2], A[0])).normalize();
    if (out && n.dot(new THREE.Vector3(out[0], out[1], out[2])) < 0) { A.reverse(); n.negate(); }
    const u = new THREE.Vector3().subVectors(A[1], A[0]).normalize(), w = new THREE.Vector3().crossVectors(n, u), pos = [], uv = [], q = new THREE.Vector3();
    for (let k = 1; k < A.length - 1; k++) for (const i of [0, k, k + 1]) { pos.push(A[i].x, A[i].y, A[i].z); q.subVectors(A[i], A[0]); uv.push(q.dot(u) / tile, q.dot(w) / tile); }
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ge.computeVertexNormals(); const o = new THREE.Mesh(ge, m); p.add(o); return o;
  };
  const bxm = (w, h, d, m, x, y, z, p) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
  const plane = (w, d, m, x, y, z, rep, p) => { const geo = new THREE.PlaneGeometry(w, d); if (rep) scaleUV(geo, 1), geo.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? d : w) / rep; }); const o = new THREE.Mesh(geo, m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); return add(o, p); };

  // ---------------------------------------------------------------- ground, road, light
  plane(2 * T.boundX + 80, 2 * T.boundZ + 80, M.grass, 0, 0.0, 0, 5);
  plane(2 * T.boundX + 20, 7, M.asphalt, 0, 0.03, 0, 6);
  const sunDir = new THREE.Vector3(35, 48, -70).normalize();
  const sun = add(new THREE.DirectionalLight(0xfff1d6, W.sun)); sun.position.set(35, 48, -70); add(sun.target); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap); sun.shadow.radius = Q.shadowSoft; const sc = sun.shadow.camera; sc.left = -T.boundX - 22; sc.right = T.boundX + 22; sc.top = T.boundZ + 22; sc.bottom = -T.boundZ - 22; sc.near = 20; sc.far = 190; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;

  // ---------------------------------------------------------------- houses
  const houses = [], marks = []; let tornN = 0;
  const LOOK0 = Math.floor(R() * 4), WALLPAL = [['#f0dfb0', '#cfe0bc', '#e8c4a8', '#c4d6e6', '#ecd88a', '#e6bcc0'], ['#ffffff', '#e8c8b8', '#d8d0c0', '#f0b8a0'], ['#8fc08a', '#e0bc74', '#86aad0', '#f0ece0', '#d0937a', '#b8b478'], ['#f4f4f0', '#dde6c0', '#f4dcc0', '#c4d4e0']];
  const INPAL = ['#ffffff', '#e4eedc', '#f0e2cc', '#dfe7f0', '#f0dede', '#efefd4'], TILEPAL = ['#c86a48', '#8a5a48', '#6a7480', '#a88a5a', '#7a8a6a', '#b0563e'], FELTPAL = ['#ffffff', '#d8dccc', '#c8c8c8', '#e0d4c0', '#b8c4b8', '#d0d0dc'], TRIMPAL = ['#ffffff', '#9ab890', '#c8d8e0', '#e0c8a0', '#d09080', '#f0f0e8'];
  for (const h of run.houses) {
    const hg = new THREE.Group(), s = h.sim, H = s.H, L = s.L, hr = rng(run.seed + 977 * (h.i + 1));
    hg.position.set(h.x, 0, h.z); hg.rotation.y = Math.atan2(-h.sn, h.cs);
    // this house's own look: wall finish, roof form and pitch, roof covering, and its colours (wall, inside, roof, trim)
    const look = uniq('house', () => { const o = { fin: (h.i + LOOK0) % 4, roof: (h.i + (h.i >> 2) + LOOK0 * 3) % 4, cover: hr() < 0.6 ? 1 : 0, pitch: 0.42 + 0.34 * hr(), chim: hr() < 0.6, cx: (hr() < 0.5 ? -1 : 1) * (0.3 + 0.4 * hr()), par: 0.35 + 0.4 * hr(), over: 0.2 + 0.3 * hr(), shut: hr() < 0.55, porch: hr() < 0.6, pw: 0.5 + 0.9 * hr(), pd: 1.0 + 0.6 * hr() };
      const pal = WALLPAL[o.fin]; o.wall = hexc(pal[(h.i + Math.floor(hr() * pal.length)) % pal.length]).offsetHSL((hr() - 0.5) * 0.03, (hr() - 0.5) * 0.08, (hr() - 0.5) * 0.06);
      o.inner = hexc(INPAL[(h.i + LOOK0) % INPAL.length]).offsetHSL(0, 0, (hr() - 0.5) * 0.05); o.top = hexc((o.cover ? TILEPAL : FELTPAL)[Math.floor(hr() * 6)]).offsetHSL((hr() - 0.5) * 0.02, 0, (hr() - 0.5) * 0.06); o.trim = hexc(TRIMPAL[(h.i * 5 + LOOK0) % TRIMPAL.length]);
      o.sig = [o.shut, o.porch, o.pw.toFixed(2), h.ext ? h.ext.w.toFixed(2) + h.ext.ax : 'n', o.fin, o.roof, o.cover, o.pitch.toFixed(2), o.wall.getHexString(), o.inner.getHexString(), o.top.getHexString(), o.trim.getHexString()].join('-'); return o; });
    const hx = [M.ext, M.extB, M.extS, M.extK][look.fin], rm = look.cover ? M.tiles : M.roof2;
    hg.userData.tintM = { [hx.uuid]: look.wall, [M.int.uuid]: look.inner, [rm.uuid]: look.top, [M.door.uuid]: look.trim }; hg.userData.look = look;
    const HH = HIHOUSE ? houseHi({ hg, h, s, look, M, hx, rm, cfg, FH, tx, run, poly, deso: DESO.machines }) : null;
    plane(2 * H, 2 * H, M.wood, 0, 0.05, 0, 2.2, hg);
    // a piece's own size and colour: wood from pale to dark, cloth in any faded hue
    const dress = (fg, kind, soft) => { const o = uniq('furn', () => { const sc = [0.9 + 0.14 * hr(), 0.92 + 0.12 * hr(), 0.9 + 0.14 * hr()], c = soft ? hslc(hr(), 0.18 + 0.2 * hr(), 0.62 + 0.25 * hr()) : hslc(0.05 + 0.07 * hr(), 0.15 + 0.3 * hr(), 0.55 + 0.42 * hr()); return { sc, c, sig: kind + sc.map((v) => v.toFixed(3)).join('/') + c.getHexString() }; }); fg.scale.set(o.sc[0], o.sc[1], o.sc[2]); fg.userData.tint = o.c; };
    for (let f = 0; f < L; f++) {
      for (const [axis, fix] of [['x', H], ['x', -H], ['z', H], ['z', -H]]) {
        const ops = s.breaches.filter((b) => b.floor === f && (axis === 'x' ? Math.abs(b.z - fix) < 0.01 && Math.abs(b.x) < H + 0.01 : Math.abs(b.x - fix) < 0.01 && Math.abs(b.z) < H + 0.01)).map((b) => ({ c: axis === 'x' ? b.x : b.z, type: b.type, i: b.i })).sort((a, b) => a.c - b.c);
        const Y0 = f * FH, Y1 = f * FH + FH, TOP = f * FH + 2.7, SILL = f * FH + 0.9, hw = cfg.openingHalf, inPos = fix > 0;
        // material per box face: outside plaster on the face that looks away from the room, interior paint on the face that looks in, brick where the wall is cut
        const mats = axis === 'x' ? [M.brick, M.brick, M.brick, M.brick, inPos ? hx : M.int, inPos ? M.int : hx] : [inPos ? hx : M.int, inPos ? M.int : hx, M.brick, M.brick, M.brick, M.brick];
        const put = (a, b, y0, y1) => { if (b - a < 0.02 || y1 - y0 < 0.02) return; const len = b - a, mid = (a + b) / 2; hg.add(axis === 'x' ? tbox(len, y1 - y0, 0.4, mats, W.wallTile, mid, (y0 + y1) / 2, fix) : tbox(0.4, y1 - y0, len, mats, W.wallTile, fix, (y0 + y1) / 2, mid)); };
        // a hole that is not a door or a window is torn, never a clean rectangle: a wall plate with a jagged opening, the same from both sides
        const torn = (o) => {
          const r = rng(run.seed + 131 * (o.i + 1) + 7919 * h.i), low = o.type === 'gap', y0 = low ? Y0 : SILL, y1 = TOP, sh = new THREE.Shape();
          sh.moveTo(-hw, y0); sh.lineTo(hw, y0); sh.lineTo(hw, y1); sh.lineTo(-hw, y1); sh.lineTo(-hw, y0);
          const hole = new THREE.Path(), n = 13, cy = low ? Y0 + 1.15 : (y0 + y1) / 2 + 0.1, ry = low ? 1.25 : (y1 - y0) / 2 - 0.12, pts = [];
          for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, j = 0.62 + 0.38 * r(), px = Math.cos(a) * (hw - 0.1) * j, py = cy + Math.sin(a) * ry * (0.7 + 0.3 * r()); pts.push([px, low ? Math.max(Y0 - 0.01, py) : py]); }
          if (low) { pts.sort((p, q) => Math.atan2(p[1] - cy, p[0]) - Math.atan2(q[1] - cy, q[0])); for (const p of pts) if (p[1] < Y0 + 0.35) p[1] = Y0 - 0.01; }
          hole.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < n; k++) hole.lineTo(pts[k][0], pts[k][1]); hole.lineTo(pts[0][0], pts[0][1]); sh.holes.push(hole);
          const m = new THREE.Mesh(scaleUV(new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: false }), 1 / W.wallTile), M.brick);
          if (axis === 'x') m.position.set(o.c, 0, fix - 0.2); else { m.rotation.y = -Math.PI / 2; m.position.set(fix + 0.2, 0, o.c); }
          hg.add(m); tornN++; if (HH) HH.torn(o, axis, fix, f, pts);
          for (let k = 0; k < 5; k++) { // rubble on both sides of the hole
            const rb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + 0.16 * r(), 0), M.brick), u = o.c + (r() - 0.5) * 1.6, dd = (r() < 0.5 ? -1 : 1) * (0.35 + 0.5 * r());
            rb.position.set(axis === 'x' ? u : fix + dd, (low ? Y0 : Y0) + 0.1, axis === 'x' ? fix + dd : u); rb.rotation.set(r() * 3, r() * 3, r() * 3); if (f === 0 || Math.abs(dd) < 0) hg.add(rb); else if ((axis === 'x' ? Math.abs(fix + dd) : Math.abs(fix + dd)) < H) hg.add(rb);
          }
        };
        let cur = -H - 0.2;
        for (const o of ops) {
          put(cur, o.c - hw, Y0, Y1); put(o.c - hw, o.c + hw, TOP, Y1);
          if (o.type === 'gap' || o.type === 'hatch') { torn(o); if (o.type === 'hatch') put(o.c - hw, o.c + hw, Y0, SILL); }
          else if (o.type === 'window') {
            put(o.c - hw, o.c + hw, Y0, SILL);
            if (HH) HH.window(o, axis, fix, f); else { const r = rng(run.seed + 17 * (o.i + 3) + 31 * h.i); // broken panes: shards left in the corners of the frame
            for (let k = 0; k < 3; k++) { const sx = r() < 0.5 ? -1 : 1, top = r() < 0.5, w = 0.25 + 0.45 * r(), hh = 0.25 + 0.5 * r(), tri = new THREE.BufferGeometry(), yb = top ? TOP : SILL, sy = top ? -1 : 1;
              tri.setAttribute('position', new THREE.Float32BufferAttribute([sx * hw, yb, 0, sx * (hw - w), yb, 0, sx * hw, yb + sy * hh, 0], 3)); tri.computeVertexNormals();
              const sm = new THREE.Mesh(tri, M.glass); if (axis === 'x') sm.position.set(o.c, 0, fix); else { sm.rotation.y = Math.PI / 2; sm.position.set(fix, 0, o.c); } hg.add(sm); }
            if (look.shut) for (const sx of [-1, 1]) { if (r() < 0.25) continue; const u = o.c + sx * (hw + 0.29), ot = Math.sign(fix) * 0.23, y = (SILL + TOP) / 2, tilt = r() < 0.35 ? (r() - 0.5) * 0.5 : 0; // shutters in the house's trim colour: some missing, some hanging crooked
              if (axis === 'x') bxm(0.52, TOP - SILL, 0.05, M.door, u, y - Math.abs(tilt) * 0.3, fix + ot, hg).rotation.z = tilt; else bxm(0.05, TOP - SILL, 0.52, M.door, fix + ot, y - Math.abs(tilt) * 0.3, u, hg).rotation.x = tilt; }
            const sill = axis === 'x' ? tbox(2 * hw + 0.2, 0.06, 0.56, M.door, 1, o.c, SILL + 0.03, fix) : tbox(0.56, 0.06, 2 * hw + 0.2, M.door, 1, fix, SILL + 0.03, o.c); hg.add(sill); }
          } else { // door: the leaf hangs open on the outside
            if (HH) HH.door(o, axis, fix, f, (0.25 + 0.5 * hr()) * (hr() < 0.5 ? 1 : -1)); else { const leaf = tbox(0.08, 2.6, 2 * hw - 0.1, M.door, 1.4, 0, 0, 0), sgn = fix > 0 ? 1 : -1, piv = new THREE.Group();
            leaf.position.set(0, Y0 + 1.35, hw - 0.05); piv.add(leaf); piv.rotation.y = (0.25 + 0.5 * hr()) * (hr() < 0.5 ? 1 : -1);
            if (axis === 'x') { piv.position.set(o.c - hw, 0, fix + sgn * 0.22); const pv2 = new THREE.Group(); pv2.rotation.y = sgn > 0 ? -Math.PI / 2 : Math.PI / 2; pv2.position.copy(piv.position); piv.position.set(0, 0, 0); pv2.add(piv); hg.add(pv2); }
            else { piv.position.set(fix + sgn * 0.22, 0, o.c - hw); if (sgn < 0) piv.rotation.y += Math.PI; hg.add(piv); } }
          }
          cur = o.c + hw;
        }
        put(cur, H + 0.2, Y0, Y1);
      }
      if (f >= 1) { // upper floor slab with holes for the stairs and the ladder
        const sh = new THREE.Shape(); sh.moveTo(-H, -H); sh.lineTo(H, -H); sh.lineTo(H, H); sh.lineTo(-H, H); sh.lineTo(-H, -H);
        const st = s.stairs[f - 1], ld = s.ladders[f - 1];
        const h1 = new THREE.Path(); h1.moveTo(st.bx - 0.6, st.bz - 1.2); h1.lineTo(st.tx + 0.6, st.bz - 1.2); h1.lineTo(st.tx + 0.6, st.bz + 1.4); h1.lineTo(st.bx - 0.6, st.bz + 1.4); h1.lineTo(st.bx - 0.6, st.bz - 1.2);
        const h2 = new THREE.Path(); h2.moveTo(ld.x - 0.7, ld.z - 0.7); h2.lineTo(ld.x + 0.7, ld.z - 0.7); h2.lineTo(ld.x + 0.7, ld.z + 0.7); h2.lineTo(ld.x - 0.7, ld.z + 0.7); h2.lineTo(ld.x - 0.7, ld.z - 0.7);
        sh.holes.push(h1, h2);
        const slab = new THREE.Mesh(scaleUV(new THREE.ShapeGeometry(sh), 1 / 2.2), M.wood); slab.rotation.x = Math.PI / 2; slab.position.y = f * FH; hg.add(slab);
      }
      for (const q of s.furn) { // upright furniture: the sim knows where it stands, so the player and the Gloom walk around it
        if (q.floor !== f) continue; const fg = new THREE.Group(), y = f * FH + 0.06; fg.position.set(q.x, y, q.z); fg.rotation.y = q.rot; hg.add(fg); dress(fg, q.kind, q.kind === 'armchair' || q.kind === 'bed');
        const cy = (r0, r1, h, m, x, yy, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 12), m); o.position.set(x, yy, z); fg.add(o); return o; };
        if (q.kind === 'wardrobe') { bxm(1.0, 1.9, 0.5, M.woodDark, 0, 0.95, 0, fg); bxm(1.06, 0.06, 0.56, M.door, 0, 1.93, 0, fg); bxm(0.46, 1.7, 0.03, M.door, -0.25, 0.95, 0.265, fg); const dr = new THREE.Group(); dr.position.set(0.48, 0, 0.26); dr.rotation.y = 0.9 + hr() * 0.6; bxm(0.46, 1.7, 0.03, M.door, -0.23, 0.95, 0, dr); fg.add(dr); bxm(0.44, 1.6, 0.02, M.frameDark, 0.24, 0.95, 0.245, fg); bxm(0.3, 0.5, 0.2, M.cloth, 0.22, 0.4, 0.1, fg); }
        else if (q.kind === 'dresser') { bxm(1.1, 0.9, 0.5, M.woodDark, 0, 0.45, 0, fg); for (let k = 0; k < 3; k++) bxm(1.0, 0.24, 0.04, M.door, 0, 0.17 + k * 0.28, 0.26 + (k === 1 ? 0.18 : 0), fg); bxm(1.0, 0.2, 0.3, M.frameDark, 0, 0.45, 0.2, fg); bxm(0.3, 0.3, 0.2, M.paper, -0.25, 1.05, 0, fg).rotation.y = 0.3; bxm(0.12, 0.2, 0.12, M.book[2], 0.3, 1.0, 0.05, fg); }
        else if (q.kind === 'stove') { bxm(0.8, 0.9, 0.6, M.chrome, 0, 0.45, 0, fg); bxm(0.5, 0.4, 0.03, M.frameDark, 0, 0.4, 0.31, fg); bxm(0.84, 0.05, 0.64, M.frameDark, 0, 0.92, 0, fg); cy(0.08, 0.08, FH - 1.0, M.chrome, -0.2, 0.95 + (FH - 1.0) / 2, -0.15); cy(0.14, 0.12, 0.16, M.frameDark, 0.18, 1.02, 0.05); }
        else if (q.kind === 'table') { cy(0.75, 0.75, 0.05, M.door, 0, 0.76, 0); cy(0.07, 0.1, 0.74, M.woodDark, 0, 0.37, 0); cy(0.3, 0.34, 0.04, M.woodDark, 0, 0.02, 0); cy(0.13, 0.11, 0.02, M.paper, 0.3, 0.8, 0.1); cy(0.13, 0.11, 0.02, M.paper, -0.25, 0.8, -0.2); bxm(0.1, 0.18, 0.1, M.book[3], -0.1, 0.87, 0.3, fg); }
        else if (q.kind === 'bookcase') { bxm(0.9, 1.3, 0.3, M.woodDark, 0, 0.65, 0, fg); for (let k = 0; k < 4; k++) { bxm(0.84, 0.03, 0.3, M.door, 0, 0.2 + 0.3 * k, 0.012, fg); for (let j = 0, n = Math.floor(hr() * 6); j < n; j++) bxm(0.06 + 0.04 * hr(), 0.16 + 0.08 * hr(), 0.18, M.book[Math.floor(hr() * 5)], -0.36 + j * 0.11 + 0.03 * hr(), 0.32 + 0.3 * k, 0.05, fg).rotation.z = hr() < 0.2 ? 0.3 : 0; } }
        else if (q.kind === 'desk') { bxm(1.2, 0.05, 0.6, M.door, 0, 0.74, 0, fg); bxm(0.36, 0.6, 0.56, M.woodDark, 0.4, 0.42, 0, fg); for (let k = 0; k < 2; k++) bxm(0.3, 0.22, 0.03, M.door, 0.4, 0.3 + 0.27 * k, 0.29 + (k ? 0.06 : 0), fg); for (const z of [-0.25, 0.25]) bxm(0.05, 0.72, 0.05, M.woodDark, -0.55, 0.36, z, fg); bxm(0.3, 0.02, 0.22, M.paper, -0.2, 0.775, 0.05, fg).rotation.y = 0.4; }
        else if (q.kind === 'bed') { bxm(1.0, 0.3, 1.95, M.woodDark, 0, 0.2, 0, fg); bxm(0.94, 0.2, 1.85, M.cloth, 0, 0.44, 0, fg); bxm(1.0, 0.9, 0.06, M.woodDark, 0, 0.5, -0.96, fg); bxm(0.6, 0.1, 0.35, M.paper, 0.05, 0.58, -0.7, fg).rotation.y = 0.15; bxm(0.98, 0.05, 1.0, M.rug, 0.02, 0.56, 0.42, fg).rotation.y = 0.06; }
        else { bxm(0.8, 0.26, 0.7, M.cloth, 0, 0.36, 0.02, fg); bxm(0.8, 0.62, 0.18, M.cloth, 0, 0.72, -0.28, fg).rotation.x = -0.12; for (const x of [-0.42, 0.42]) bxm(0.14, 0.4, 0.7, M.cloth, x, 0.5, 0.02, fg); for (const [x, z] of [[-0.36, -0.3], [0.36, -0.3], [-0.36, 0.3], [0.36, 0.3]]) bxm(0.06, 0.24, 0.06, M.woodDark, x, 0.12, z, fg); }
      }
      { // what the people left: besides the standing pieces, things lie toppled and low, or hang on the wall
        const y0 = f * FH + 0.06, taken = s.furn.filter((q) => q.floor === f).map((q) => [q.x, q.z, q.r + 0.2]), st = s.stairs, ok = (x, z, rad) => Math.abs(x) < H - 0.9 && Math.abs(z) < H - 0.9 && !taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < rad + t[2]) && !s.breaches.some((b) => b.floor === f && Math.hypot(b.inX - x, b.inZ - z) < rad + 0.9)
          && !st.some((q) => (q.f === f || q.f === f - 1) && Math.abs(z - q.bz) < 1.4 + rad && x > Math.min(q.bx, q.tx) - 1.2 - rad && x < Math.max(q.bx, q.tx) + 1.2 + rad) && !s.ladders.some((q) => (q.f === f || q.f === f - 1) && Math.hypot(q.x - x, q.z - z) < 1.3 + rad) && !(f === 0 && Math.hypot(s.cat.x - x, s.cat.z - z) < 2.4 + rad) && !s.crates.some((q) => q.floor === f && Math.hypot(q.x - x, q.z - z) < 0.7 + rad);
        const spot = (rad) => { for (let k = 0; k < 14; k++) { const x = (hr() * 2 - 1) * (H - 1), z = (hr() * 2 - 1) * (H - 1); if (ok(x, z, rad)) { taken.push([x, z, rad]); return [x, z]; } } return null; };
        const piece = (rad, make) => { const p = spot(rad); if (!p) return; const fg = new THREE.Group(); fg.position.set(p[0], y0, p[1]); fg.rotation.y = hr() * 6.28; make(fg); hg.add(fg); dress(fg, 'low' + rad, rad === 1.2 || rad === 1.3); };
        piece(1.2, (q) => { bxm(1.9, 0.2, 0.9, M.cloth, 0, 0.1, 0, q); bxm(0.5, 0.1, 0.32, M.paper, -0.6, 0.25, 0.1, q).rotation.y = 0.3; }); // mattress and pillow
        piece(1.2, (q) => { bxm(1.8, 0.3, 0.5, M.woodDark, 0, 0.15, 0, q); for (const x of [-0.6, 0, 0.6]) bxm(0.03, 0.31, 0.5, M.door, x, 0.155, 0, q); for (let k = 0; k < 7; k++) { const bk = bxm(0.22, 0.05, 0.16, M.book[k % 5], (hr() - 0.5) * 2.2, 0.03, 0.5 + hr() * 0.7, q); bk.rotation.y = hr() * 3; } }); // bookcase on its back, books spilled
        piece(1.0, (q) => { const tp = bxm(1.2, 0.05, 0.7, M.door, 0, 0.2, 0, q); tp.rotation.z = 0.3; for (const [x, z] of [[0.5, 0.3], [0.5, -0.3]]) bxm(0.06, 0.06, 0.6, M.woodDark, x + 0.2, 0.03, z + 0.4, q).rotation.y = 0.6 + z; }); // table with two legs gone
        piece(0.8, (q) => { bxm(0.42, 0.42, 0.05, M.woodDark, 0, 0.21, 0, q); const bk = bxm(0.42, 0.05, 0.5, M.woodDark, 0, 0.025, -0.25, q); for (const x of [-0.18, 0.18]) bxm(0.04, 0.04, 0.42, M.woodDark, x, 0.4, 0.2, q); bk.rotation.y = 0.05; }); // chair on its side
        if (hr() < 0.8) piece(1.3, (q) => { const rg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.5), M.rug); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.012; q.add(rg); }); // rug
        // on the walls: crooked pictures and a high shelf, never over an opening
        for (let k = 0; k < 5; k++) { const wall = Math.floor(hr() * 4), u = (hr() * 2 - 1) * (H - 1.2), nx = wall === 2 ? 1 : wall === 3 ? -1 : 0, nz = wall === 0 ? 1 : wall === 1 ? -1 : 0, wx = nx ? nx * H : u, wz = nz ? nz * H : u;
          if (s.breaches.some((b) => b.floor === f && Math.hypot(b.x - wx, b.z - wz) < 1.9)) continue; const fg = new THREE.Group(); fg.position.set(wx - nx * 0.225, f * FH, wz - nz * 0.225); fg.rotation.y = Math.atan2(-nx, -nz); hg.add(fg);
          if (k % 2) { bxm(0.55, 0.42, 0.03, M.frameDark, 0, 1.7, 0, fg).rotation.z = (hr() - 0.5) * 0.5; bxm(0.45, 0.32, 0.035, M.paper, 0, 1.7, 0.004, fg).rotation.z = fg.children[0].rotation.z; }
          else { bxm(1.1, 0.04, 0.2, M.woodDark, 0, 2.05, 0.1, fg).rotation.z = (hr() - 0.5) * 0.12; for (let j = 0; j < 3; j++) bxm(0.1, 0.16 + 0.1 * hr(), 0.1, M.book[(j + k) % 5], -0.35 + j * 0.3, 2.16, 0.1, fg); } }
        if (HH) HH.lamp(f); else { const cord = bxm(0.02, 0.5, 0.02, M.frameDark, 0, f * FH + FH - 0.25, 0, hg), shd = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 10, 1, true), M.lampShade); shd.position.set(0, f * FH + FH - 0.6, 0); hg.add(shd); cord.rotation.z = 0; } // ceiling lamp
      }
      // dirt, leaves and rubble lying on the floor, and creepers on the walls: on the outside always, and coming in on the inside in the far rings
      for (let k = 0; k < 3 + run.ring; k++) { const d = plane(1.2 + 1.6 * hr(), 1.2 + 1.6 * hr(), M.debris, (hr() * 2 - 1) * (H - 1.2), f * FH + 0.07 + 0.002 * k, (hr() * 2 - 1) * (H - 1.2), 0, hg); d.rotation.z = hr() * 6.28; }
      for (let k = 0; k < 2 + run.ring * 2; k++) {
        const wall = Math.floor(hr() * 4), u = (hr() * 2 - 1) * (H - 1.2), w = 1.4 + 1.8 * hr(), hh2 = 1.6 + 1.5 * hr(), out = hr() < 0.72 ? 1 : -1, d = H + out * 0.215;
        const v = new THREE.Mesh(new THREE.PlaneGeometry(w, hh2), M.vine); v.position.set(wall < 2 ? u : (wall === 2 ? d : -d), f * FH + hh2 / 2 + (hr() < 0.5 ? 0 : FH - hh2), wall < 2 ? (wall === 0 ? d : -d) : u); if (wall >= 2) v.rotation.y = Math.PI / 2; if (!HH || out < 0) hg.add(v);
      }
    }
    // roof: overgrown, with a tired solar panel tilted toward the street
    hg.add(tbox(2 * H + 0.4, 0.22, 2 * H + 0.4, M.roof, 3, 0, L * FH + 0.11, 0)); // the ceiling slab; the roof itself stands on it
    const d0 = s.breaches.find((b) => b.floor === 0 && b.type === 'door') || s.breaches[0], rg = new THREE.Group(), e = L * FH + 0.22, Wo = H + 0.2, Wv = Wo + look.over, pt = look.pitch;
    rg.rotation.y = Math.atan2(d0.nx, d0.nz); hg.add(rg); // rg turns -z onto the door side, so the solar panel always looks at the street
    let pv = [0, e + 0.38, -(H - 0.9), -0.75, 1.5 * H], top = e;
    if (HH) top = HH.roof(rg, e, Wo, Wv, pt, d0); else if (look.roof === 0) { // gable: ridge along x, a slope to the street and one to the back
      const rh = Wv * Math.tan(pt), y1 = rh * look.over / Wv; top = e + rh;
      poly([[-Wv, e, -Wv], [Wv, e, -Wv], [Wv, e + rh, 0], [-Wv, e + rh, 0]], rm, rg, 2.2, [0, 1, -1]); poly([[Wv, e, Wv], [-Wv, e, Wv], [-Wv, e + rh, 0], [Wv, e + rh, 0]], rm, rg, 2.2, [0, 1, 1]);
      for (const sx of [-1, 1]) poly([[sx * Wo, e, -Wo], [sx * Wo, e, Wo], [sx * Wo, e + y1, Wo], [sx * Wo, e + rh, 0], [sx * Wo, e + y1, -Wo]], hx, rg, W.wallTile, [sx, 0, 0]);
      pv = [0, e + rh * 0.5 + 0.1, -Wv * 0.5, -pt, 1.3 * H];
    } else if (look.roof === 1) { // hip: four slopes to one point
      const rh = Wv * Math.tan(pt * 0.85); top = e + rh;
      for (const [a, b, o] of [[[-Wv, -Wv], [Wv, -Wv], [0, 1, -1]], [[Wv, -Wv], [Wv, Wv], [1, 1, 0]], [[Wv, Wv], [-Wv, Wv], [0, 1, 1]], [[-Wv, Wv], [-Wv, -Wv], [-1, 1, 0]]]) poly([[a[0], e, a[1]], [b[0], e, b[1]], [0, e + rh, 0]], rm, rg, 2.2, o);
      pv = [0, e + rh * 0.42 + 0.1, -Wv * 0.58, -pt * 0.85, 0.9 * H];
    } else if (look.roof === 2) { // mono-pitch: one low slope falling to the street
      const t2 = Math.tan(pt * 0.42), ya = 0.15 + look.over * t2, yb = 0.15 + (Wv + Wo) * t2; top = e + yb;
      poly([[-Wv, e + 0.15, -Wv], [Wv, e + 0.15, -Wv], [Wv, e + 0.15 + 2 * Wv * t2, Wv], [-Wv, e + 0.15 + 2 * Wv * t2, Wv]], rm, rg, 2.2, [0, 1, -1]);
      for (const sx of [-1, 1]) poly([[sx * Wo, e, -Wo], [sx * Wo, e, Wo], [sx * Wo, e + yb, Wo], [sx * Wo, e + ya, -Wo]], hx, rg, W.wallTile, [sx, 0, 0]);
      poly([[-Wo, e, Wo], [Wo, e, Wo], [Wo, e + yb, Wo], [-Wo, e + yb, Wo]], hx, rg, W.wallTile, [0, 0, 1]); poly([[-Wo, e, -Wo], [Wo, e, -Wo], [Wo, e + ya, -Wo], [-Wo, e + ya, -Wo]], hx, rg, W.wallTile, [0, 0, -1]);
      pv = [0, e + 0.15 + (Wv * 0.9) * t2 + 0.1, -Wv * 0.1, -pt * 0.42, 1.3 * H];
    } else { // flat roof behind a parapet
      const ph = look.par; top = e + ph;
      for (const sz of [-1, 1]) { rg.add(tbox(2 * Wo, ph, 0.25, hx, W.wallTile, 0, e + ph / 2, sz * (Wo - 0.125))); rg.add(tbox(0.25, ph, 2 * Wo - 0.5, hx, W.wallTile, sz * (Wo - 0.125), e + ph / 2, 0)); }
      pv[1] = e + 0.45 + ph * 0.5;
    }
    if (look.porch && !HH) { const dg = new THREE.Group(); dg.position.set(d0.x, 0, d0.z); dg.rotation.y = Math.atan2(d0.nx, d0.nz); hg.add(dg); // a canopy over the front door (dg's -z looks out), on two brackets, above the loot sign
      bxm(2 * cfg.openingHalf + look.pw, 0.07, look.pd, rm, 0, 3.22, -0.2 - look.pd / 2, dg).rotation.x = -0.18; for (const sx of [-1, 1]) bxm(0.06, 0.06, 0.95, M.woodDark, sx * (cfg.openingHalf + look.pw / 2 - 0.1), 2.82, -0.58, dg).rotation.x = 0.64; }
    if (h.ext) { const E = h.ext, eg = new THREE.Group(), w2 = E.w / 2, d2 = E.d / 2; eg.position.set(E.lx, 0, E.lz); eg.rotation.y = E.ax === 'x' ? (E.sgn > 0 ? Math.PI : 0) : -E.sgn * Math.PI / 2; hg.add(eg); // lean-to extension: eg's -z looks away from the house
      // an open-fronted shed: two side walls, posts at the front, and what was left inside it (each shed has its own mix)
      for (const sx of [-1, 1]) { eg.add(tbox(0.14, E.hgt, E.d, hx, W.wallTile, sx * (w2 - 0.07), E.hgt / 2, 0)); bxm(0.12, E.hgt, 0.12, M.woodDark, sx * (w2 - 0.06), E.hgt / 2, -d2 + 0.06, eg); }
      bxm(E.w, 0.14, 0.12, M.woodDark, 0, E.hgt - 0.07, -d2 + 0.06, eg); plane(E.w - 0.3, E.d, M.dirt, 0, 0.03, 0, 1, eg);
      { const fx = (hr() < 0.5 ? -1 : 1), bx0 = fx * (w2 - 0.75); bxm(1.1, 0.06, 0.5, M.door, bx0, 0.82, d2 - 0.3, eg); for (const lx of [-0.5, 0.5]) bxm(0.06, 0.8, 0.44, M.woodDark, bx0 + lx, 0.4, d2 - 0.3, eg); // workbench against the house wall
        for (let k = 0, n = 2 + Math.floor(hr() * 3); k < n; k++) bxm(0.1 + 0.08 * hr(), 0.14 + 0.12 * hr(), 0.1, M.book[Math.floor(hr() * 5)], bx0 - 0.4 + k * 0.25, 0.94, d2 - 0.3, eg);
        bxm(1.0, 0.04, 0.2, M.woodDark, bx0, 1.5, d2 - 0.12, eg).rotation.z = (hr() - 0.5) * 0.15; // a shelf, hanging a little crooked
        const brl = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.8, 10), M.woodDark); brl.position.set(-fx * (w2 - 0.5), 0.4, d2 - 0.4); eg.add(brl);
        for (let k = 0, n = 4 + Math.floor(hr() * 5); k < n; k++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6), M.bark); lg.rotation.z = Math.PI / 2; lg.position.set(-fx * (w2 - 0.6), 0.08 + 0.15 * Math.floor(k / 3), -d2 + 0.35 + (k % 3) * 0.17); eg.add(lg); } // firewood
        if (hr() < 0.6) { const rk = bxm(0.04, 1.6, 0.04, M.door, fx * 0.1, 0.8, d2 - 0.1, eg); rk.rotation.x = 0.12; rk.rotation.z = (hr() - 0.5) * 0.3; }
        if (hr() < 0.5) bxm(0.5, 0.4, 0.4, M.door, (hr() - 0.5) * 0.6, 0.2, -d2 + 0.5, eg).rotation.y = hr(); }
      poly([[-w2 - 0.15, E.hgt + 0.5, d2], [w2 + 0.15, E.hgt + 0.5, d2], [w2 + 0.15, E.hgt + 0.04, -d2 - 0.25], [-w2 - 0.15, E.hgt + 0.04, -d2 - 0.25]], rm, eg, 2.2, [0, 1, -0.3]);
      for (const sx of [-1, 1]) poly([[sx * w2, E.hgt, -d2], [sx * w2, E.hgt, d2], [sx * w2, E.hgt + 0.48, d2], [sx * w2, E.hgt + 0.06, -d2]], hx, eg, W.wallTile, [sx, 0, 0]);
    }
    if (!HH) { const pvm = new THREE.Mesh(new THREE.BoxGeometry(pv[4], 0.08, 1.4), M.pv); pvm.rotation.x = pv[3]; pvm.position.set(0, pv[1], pv[2]); rg.add(pvm); }
    if (!HH && look.chim && look.roof < 2) rg.add(tbox(0.55, top - e + 0.6, 0.55, M.brick, 1.3, look.cx * H, e + (top - e + 0.6) / 2, H * 0.35));
    for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), M.tuft); if (look.roof === 3) t.position.set((hr() * 2 - 1) * (H - 0.6), e + 0.38, (hr() * 2 - 1) * (H - 0.6)); else t.position.set((hr() * 2 - 1) * H, e + 0.3, (k % 2 ? 1 : -1) * (Wv - 0.25)); t.rotation.y = hr() * 3; if (!HH) rg.add(t); }
    // stairs and ladder
    for (const st of s.stairs) { const y0 = st.f * FH, dx = st.tx - st.bx, n = 12; // real steps, with a stringer under them
      for (let k = 0; k < n; k++) { const stp = tbox(Math.abs(dx) / n + 0.03, 0.07, 1.5, M.stair, 1.2, 0, 0, 0); stp.position.set(st.bx + dx * (k + 0.5) / n, y0 + FH * (k + 1) / n - 0.035, st.bz); hg.add(stp); }
      for (const sz of [-0.7, 0.7]) { const len = Math.hypot(dx, FH), bar = tbox(len, 0.24, 0.07, M.woodDark, 1.2, 0, 0, 0); bar.position.set((st.bx + st.tx) / 2, y0 + FH / 2 - 0.16, st.bz + sz); bar.rotation.z = Math.atan2(FH, dx); hg.add(bar); } }
    for (const ld of s.ladders) { const y0 = ld.f * FH; for (const sx of [-0.25, 0.25]) { const r = tbox(0.06, FH, 0.06, M.stair, 1, 0, 0, 0); r.position.set(ld.x + sx, y0 + FH / 2, ld.z + 0.6); hg.add(r); } for (let k = 1; k < 8; k++) { const r = tbox(0.5, 0.05, 0.05, M.stair, 1, 0, 0, 0); r.position.set(ld.x, y0 + (k * FH) / 8, ld.z + 0.6); hg.add(r); } }
    // loot sign over the door (green = loot left, red = emptied): the one clean, maintained thing on the house
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.12), new THREE.MeshBasicMaterial({ color: 0x7ac96a })); mark.position.set(d0.x - d0.nx * 0.45, 2.95, d0.z - d0.nz * 0.45); if (Math.abs(d0.nx) > 0.5) mark.rotation.y = Math.PI / 2; hg.add(mark); marks.push({ h, mark });
    if (HH) HH.finish(); else if (DESO.on && h.i === cfg.desolate.house) { decorateHouse(hg, h, cfg, M, look, tx, FH, add); overgrow(hg, h, cfg, M, look, tx, FH, add); }
    g.add(hg); houses.push(hg);
    // worn dirt path from the road to the door
    const pz = (h.doorZ + 0) / 2; plane(1.7, Math.abs(h.doorZ) - 3.2, M.dirt, h.doorX, 0.02, Math.sign(h.doorZ) * (3.4 + (Math.abs(h.doorZ) - 3.2) / 2), 2.5);
  }

  // ---------------------------------------------------------------- overgrowth: tufts everywhere, bushes, trees
  const free = (x, z, pad) => !run.houses.some((h) => Math.abs(x - h.x) < h.H + pad && Math.abs(z - h.z) < h.H + pad);
  const tg = SH && Q.street.detail.tufts ? tuftGeo(Q.street.tuftBlades, 7) : new THREE.PlaneGeometry(1, 1); if (!(SH && Q.street.detail.tufts)) tg.translate(0, 0.5, 0);
  const tufts = new THREE.InstancedMesh(tg, SH && Q.street.detail.tufts ? tuftMat() : lam({ map: M.tuft.map, alphaTest: 0.5, side: THREE.DoubleSide }), (W.tufts + Q.grassMore) * 2), dm = new THREE.Object3D(); let ti = 0;
  for (let k = 0; k < W.tufts * 3 && ti < W.tufts * 2; k++) {
    const x = (R() * 2 - 1) * (T.boundX + 14), z = (R() * 2 - 1) * (T.boundZ + 14), road = Math.abs(z) < 3.5; if (!free(x, z, 0.3) || (road && R() < 0.82) || run.houses.some((h) => Math.abs(x - h.doorX) < 0.9 && Math.abs(z) < Math.abs(h.doorZ) && Math.sign(z) === Math.sign(h.doorZ))) continue;
    const sc = road ? 0.5 + 0.4 * R() : 0.7 + 1.3 * R(), ry = R() * Math.PI;
    for (const a of [0, Math.PI / 2]) { dm.position.set(x, 0.0, z); dm.rotation.set(0, ry + a, 0); dm.scale.set(sc * 1.3, sc, 1); dm.updateMatrix(); tufts.setMatrixAt(ti++, dm.matrix); }
  }
  // high graphics tier: more tufts, from their own random stream, so trees, bushes and cars stand where they always stand
  { const R2 = rng(((run.seed || 1) ^ 0x6a55) >>> 0), cap = (W.tufts + Q.grassMore) * 2;
    for (let k = 0; k < Q.grassMore * 3 && ti < cap; k++) {
      const x = (R2() * 2 - 1) * (T.boundX + 14), z = (R2() * 2 - 1) * (T.boundZ + 14), road = Math.abs(z) < 3.5; if (!free(x, z, 0.3) || (road && R2() < 0.82) || run.houses.some((h) => Math.abs(x - h.doorX) < 0.9 && Math.abs(z) < Math.abs(h.doorZ) && Math.sign(z) === Math.sign(h.doorZ))) continue;
      const sc = road ? 0.5 + 0.4 * R2() : 0.7 + 1.3 * R2(), ry = R2() * Math.PI;
      for (const a of [0, Math.PI / 2]) { dm.position.set(x, 0.0, z); dm.rotation.set(0, ry + a, 0); dm.scale.set(sc * 1.3, sc, 1); dm.updateMatrix(); tufts.setMatrixAt(ti++, dm.matrix); } } }
  tufts.count = ti; tufts.receiveShadow = true; add(tufts);
  // a tree: leaning trunk, real branches, and a crown made of many leaf sprays on twigs (not one green ball)
  const RL = rng(((run.seed || 1) ^ 0x1eaf) >>> 0);
  // high graphics tier: leafMore smaller extra cards round each spray (own random stream, so nothing else moves)
  const spray = (p, x, y, z, s, dark) => { for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(s, s), dark ? M.canopyDark : M.canopy); c.position.set(x, y, z); c.rotation.set((R() - 0.5) * 1.2, R() * Math.PI + k * 1.05, (R() - 0.5) * 0.8); p.add(c); }
    if (SH) SH.spray(p, x, y, z, s); else for (let k = 0; k < Q.leafMore; k++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.7, s * 0.7), dark ? M.canopyDark : M.canopy); c.position.set(x + (RL() - 0.5) * s * 0.5, y + (RL() - 0.5) * s * 0.3, z + (RL() - 0.5) * s * 0.5); c.rotation.set((RL() - 0.5) * 1.2, RL() * Math.PI, (RL() - 0.5) * 0.8); p.add(c); } };
  const limb = (p, x0, y0, z0, x1, y1, z1, r0, r1) => { const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), len = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 6), M.bark); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(m); };
  // five crown forms (reference: tree shape guides), and every tree has its own height, lean, branch count and leaf colour
  const FORMS = [{ n: 'broad', th: [2.6, 1.4], nb: [5, 3], hf: [0.5, 0.45], bl: [1.3, 1.2], rise: [0.35, 0.5], sp: 1, top: 2.6 }, { n: 'columnar', th: [4.4, 1.6], nb: [8, 3], hf: [0.25, 0.7], bl: [0.45, 0.4], rise: [1.2, 0.6], sp: 0.62, top: 1.5 },
    { n: 'conical', th: [4.0, 1.6], nb: [9, 3], hf: [0.2, 0.75], bl: [1.7, 0.3], rise: [-0.15, 0.1], sp: 0.7, top: 1.2, tier: 1, dark: 1 }, { n: 'weeping', th: [3.0, 1.0], nb: [6, 2], hf: [0.6, 0.35], bl: [1.5, 0.9], rise: [0.2, 0.2], sp: 0.9, top: 2.2, hang: 1 }, { n: 'snag', th: [2.4, 2.0], nb: [3, 2], hf: [0.45, 0.5], bl: [0.8, 0.9], rise: [0.3, 0.6], sp: 0, top: 0 }];
  let treeN = Math.floor(R() * 5);
  const treeAt = (x, z, sc) => {
    const F = FORMS[treeN % 5 === 4 && treeN % 3 ? 0 : treeN % 5]; treeN++;
    const o = uniq('tree', () => { const th = (F.th[0] + F.th[1] * R()) * sc, nb = F.nb[0] + Math.floor(R() * F.nb[1]), leaf = hslc(0.19 + 0.15 * R(), 0.3 + 0.35 * R(), 0.6 + 0.32 * R()), bark = hslc(0.07, 0.12 * R(), 0.68 + 0.32 * R()); return { th, nb, leaf, bark, sig: F.n + th.toFixed(3) + '/' + nb + leaf.getHexString() + bark.getHexString() }; });
    const t = new THREE.Group(), th = o.th, lx = (R() - 0.5) * 0.5 * sc, lz = (R() - 0.5) * 0.5 * sc, nb = o.nb; t.userData.tintM = { [M.canopy.uuid]: o.leaf, [M.canopyDark.uuid]: o.leaf, [M.bark.uuid]: o.bark };
    limb(t, 0, 0, 0, lx * 0.4, th * 0.55, lz * 0.4, 0.30 * sc, 0.20 * sc); limb(t, lx * 0.4, th * 0.55, lz * 0.4, lx, th, lz, 0.20 * sc, F.sp ? 0.12 * sc : 0.16 * sc);
    for (let k = 0; k < 3; k++) { const a = R() * 6.28; limb(t, 0.28 * sc * Math.cos(a), 0.02, 0.28 * sc * Math.sin(a), 0.55 * sc * Math.cos(a), -0.12, 0.55 * sc * Math.sin(a), 0.09 * sc, 0.03 * sc); }
    for (let k = 0; k < nb; k++) {
      const fr = F.tier ? k / nb : R(), a = k * (F.tier ? 2.4 : 6.28 / nb) + R() * 0.8, h0 = th * (F.hf[0] + F.hf[1] * fr), bl = (F.tier ? F.bl[0] * (1 - fr) + F.bl[1] : F.bl[0] + F.bl[1] * R()) * sc, bx0 = lx * h0 / th, bz0 = lz * h0 / th, ex = bx0 + Math.cos(a) * bl, ez2 = bz0 + Math.sin(a) * bl, ey = h0 + bl * (F.rise[0] + F.rise[1] * R());
      limb(t, bx0, h0, bz0, ex, ey, ez2, 0.10 * sc, 0.035 * sc);
      if (!F.sp) continue;
      spray(t, ex, ey, ez2, (2.0 + 0.9 * R()) * sc * F.sp, !!F.dark); spray(t, (bx0 + ex) / 2, (h0 + ey) / 2 + 0.25 * sc, (bz0 + ez2) / 2, (1.5 + 0.6 * R()) * sc * F.sp, k % 2 === 0);
      if (F.hang) { spray(t, ex * 1.05, ey - 0.8 * sc, ez2 * 1.05, 1.7 * sc, false); spray(t, ex * 1.08, ey - 1.6 * sc, ez2 * 1.08, 1.3 * sc, true); }
    }
    if (F.top) { spray(t, lx, th + 0.5 * sc * F.sp, lz, F.top * sc, !!F.dark); spray(t, lx, th - 0.1 * sc, lz, F.top * 0.85 * sc, true); }
    t.position.set(x, 0, z); t.rotation.y = R() * 6; add(t); if (SH) SH.tree(x, z);
  };
  for (let i = 0; i < 8; i++) treeAt([-1.5, -0.5, 0.5, 1.5][i % 4] * T.gapX + (R() - 0.5) * 4, (i < 4 ? -1 : 1) * (4.6 + R() * 2), 0.9 + 0.5 * R());
  for (let k = 0, n = 0; k < 80 && n < W.trees; k++) { const x = (R() * 2 - 1) * (T.boundX + 10), z = (R() * 2 - 1) * (T.boundZ + 10); if (Math.abs(z) < 5 || Math.hypot(x - cfg.marla.guide.x, z - cfg.marla.guide.z) < 3 || !free(x, z, 2.5) || run.cars.some((c) => Math.hypot(c.x - x, c.z - z) < 3) || run.houses.some((h) => Math.abs(x - h.doorX) < 2.5 && Math.sign(z) === Math.sign(h.doorZ) && Math.abs(z) < Math.abs(h.doorZ) + 1)) continue; treeAt(x, z, 0.8 + 0.9 * R()); n++; }
  for (let k = 0, n = 0; k < 120 && n < W.bushes; k++) { const x = (R() * 2 - 1) * (T.boundX + 10), z = (R() * 2 - 1) * (T.boundZ + 10); if (Math.abs(z) < 3.6 || !free(x, z, 0.6) || run.houses.some((h) => Math.abs(x - h.doorX) < 1.6 && Math.sign(z) === Math.sign(h.doorZ) && Math.abs(z) < Math.abs(h.doorZ) + 1)) continue;
    const bg = new THREE.Group(), s2 = 0.8 + 0.8 * R(); for (let q = 0; q < 3; q++) spray(bg, (R() - 0.5) * 0.7 * s2, (0.35 + 0.35 * q) * s2, (R() - 0.5) * 0.7 * s2, (1.3 - 0.2 * q) * s2, q === 0); bg.position.set(x, 0, z); bg.userData.tint = hslc(0.18 + 0.16 * R(), 0.3 + 0.3 * R(), 0.62 + 0.3 * R()); add(bg); n++; }
  // ---------------------------------------------------------------- abandoned cars: each with its own paint, rust and damage
  const PAINT = ['#b23a2e', '#2f5d8a', '#d8d2c0', '#3f6b4a', '#c9a227', '#5a5a5e'];
  const PROF = [[[-2.1, 0.35], [-2.1, 0.85], [-1.5, 0.95], [-0.9, 1.45], [0.6, 1.45], [1.2, 0.95], [2.1, 0.85], [2.1, 0.35]], [[-2.2, 0.35], [-2.2, 1.9], [1.3, 1.9], [1.9, 1.2], [2.2, 1.1], [2.2, 0.35]], [[-2.3, 0.35], [-2.3, 0.95], [-0.3, 0.95], [-0.3, 1.6], [0.9, 1.6], [1.4, 1.0], [2.3, 0.9], [2.3, 0.35]]];
  const WIN = [[[-0.85, 1.0], [-0.75, 1.38], [0.55, 1.38], [1.05, 1.0]], [[0.2, 1.25], [0.2, 1.78], [1.25, 1.78], [1.75, 1.25]], [[-0.2, 1.02], [-0.2, 1.52], [0.85, 1.52], [1.25, 1.02]], [[-1.55, 1.0], [-1.38, 1.4], [0.15, 1.4], [0.7, 1.0]], [[-1.95, 1.18], [-1.8, 1.78], [0.42, 1.78], [1.0, 1.18]]];
  const paintImg = new Image(); paintImg.src = TEX.worn; // klad 'worn': gritty metal, multiplied over the faded paint
  const rustImg = new Image(); let rustReady = false; const pending = []; rustImg.onload = () => { rustReady = true; pending.forEach((f) => f()); }; rustImg.src = TEX.rust;
  function carTex(c, side) { // paint first, then rust eats in from the bottom and in patches; the side view also gets windows and door lines
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const draw = () => {
      const x = cv.getContext('2d'), r = rng(c.s + (side ? 5 : 9)), burnt = c.dmg > 0.85; { const pc = new THREE.Color(PAINT[c.paint]).offsetHSL(((c.s % 97) / 97 - 0.5) * 0.05, ((c.s % 89) / 89 - 0.5) * 0.2, ((c.s % 83) / 83 - 0.5) * 0.12); if (GRITTY) { const h = {}; pc.getHSL(h); pc.setHSL(h.h, h.s * GRIT.carSat, Math.min(0.62, h.l * GRIT.carLight + 0.06)); } x.fillStyle = burnt ? '#2a2623' : '#' + pc.getHexString(); } x.fillRect(0, 0, 256, 128);
      if (GRITTY && !burnt) { if (paintImg.complete && paintImg.naturalWidth) { x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.5 + 0.3 * c.rust; x.drawImage(paintImg, 0, 0, 256, 128); x.globalAlpha = 0.25 * c.rust; x.drawImage(paintImg, 60, 30, 196, 98, 0, 0, 256, 128); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
        for (let k = 0; k < 260; k++) { const px = r() * 256, py = 128 - Math.pow(r(), 2.4) * 128, s = 1 + r() * 4 * (0.4 + c.rust); x.fillStyle = k % 4 ? 'rgba(96,52,26,' + (0.25 + 0.5 * r()) + ')' : 'rgba(40,26,18,' + (0.3 + 0.4 * r()) + ')'; x.fillRect(px, py, s * (1 + r()), s); }  // fine rust pitting, thick along the sills
        for (let k = 0; k < 16; k++) { const px = r() * 256, py = 30 + r() * 60, l = 8 + r() * 34; const gr = x.createLinearGradient(0, py, 0, py + l); gr.addColorStop(0, 'rgba(84,46,24,0.55)'); gr.addColorStop(1, 'rgba(84,46,24,0)'); x.fillStyle = gr; x.fillRect(px, py, 1.5 + r() * 2.5, l); } } // rust runs
      x.globalAlpha = burnt ? 0.16 : (GRITTY ? 0.5 : 1) * (0.35 + 0.65 * c.rust); x.globalCompositeOperation = 'source-over';
      const n = Math.round((GRITTY ? 0.45 : 1) * (4 + 22 * c.rust)); for (let k = 0; k < n; k++) { const px = r() * 256, py = 128 - Math.pow(r(), 1.6) * 128, s = 14 + r() * 52 * c.rust; x.save(); x.beginPath(); x.ellipse(px, py, s, s * (0.5 + 0.5 * r()), r() * 3, 0, 6.3); x.clip(); x.drawImage(rustImg, px - s, py - s, 2 * s, 2 * s); x.restore(); }
      x.globalAlpha = burnt ? 0.2 : 0.5 + 0.5 * c.rust; x.drawImage(rustImg, 0, 96, 256, 32); x.globalAlpha = 1; if (burnt) { for (let k = 0; k < 26; k++) { x.fillStyle = k % 3 ? 'rgba(12,11,10,0.5)' : 'rgba(150,146,138,0.28)'; x.beginPath(); x.ellipse(r() * 256, r() * 128, 8 + r() * 30, 5 + r() * 16, r() * 3, 0, 6.3); x.fill(); } } // burnt: soot and pale ash, hardly any rust colour
      if (GRITTY) { const gr = x.createLinearGradient(0, 128, 0, 40); gr.addColorStop(0, 'rgba(46,38,30,0.78)'); gr.addColorStop(0.45, 'rgba(60,50,38,0.3)'); gr.addColorStop(1, 'rgba(60,50,38,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 128); x.fillStyle = 'rgba(176,168,150,0.16)'; x.fillRect(0, 0, 256, 26); } // road dirt up from the sills, dust on top
      if (side) { const X = (v) => (v + 2.4) / 4.8 * 256, Y = (v) => 128 - v / 2.4 * 128, w = WIN[c.kind];
        x.fillStyle = '#0f1416'; x.beginPath(); x.moveTo(X(w[0][0]), Y(w[0][1])); for (const p of w) x.lineTo(X(p[0]), Y(p[1])); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(210,225,230,0.55)'; x.lineWidth = 1.5; for (let k = 0; k < 5; k++) { x.beginPath(); const sx = X(w[0][0] + r() * (w[3][0] - w[0][0])), sy = Y(w[0][1] + 0.05); x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 30, sy - 8 - r() * 28); x.stroke(); }
        x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(-0.1), Y(0.4)); x.lineTo(X(-0.1), Y(1.0)); x.stroke(); }
      t.needsUpdate = true;
    };
    if (rustReady) draw(); else pending.push(draw); return t;
  }
  const quad = (pts, m, p) => { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute([].concat(pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]), 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); ge.computeVertexNormals(); const o = new THREE.Mesh(ge, m); p.add(o); return o; };
  // cabin corner points per kind: [rear base, rear roof, front roof, front base] as (x, y); x is forward
  const CAB = [[[-1.25, 0.92], [-0.8, 1.42], [0.4, 1.42], [1.0, 0.92]], [[-2.15, 1.0], [-2.15, 1.9], [1.1, 1.9], [1.7, 1.0]], [[-0.35, 0.92], [-0.3, 1.55], [0.7, 1.55], [1.2, 0.92]], [[-1.72, 0.92], [-1.5, 1.44], [0.2, 1.44], [0.82, 0.92]], [[-2.12, 1.1], [-1.95, 1.84], [0.5, 1.84], [1.12, 1.1]]], LEN = [4.2, 4.5, 4.7, 3.9, 4.6], TOPY = [0.92, 1.0, 0.92, 0.92, 1.1];
  for (const c of run.cars) {
    if (c.ghost) continue;
    if (c.real && DESO.on) { const rg = realCar(c, cfg, M, PAINT[c.paint]); const lg = new THREE.Group(); lg.add(rg); rg.rotation.set(-rg.userData.lean, 0, rg.userData.lean * 0.6); lg.rotation.y = c.yaw; lg.position.set(c.x, -0.04, c.z); add(lg); continue; }
    const cg = new THREE.Group(), r = rng(c.s), L2 = LEN[c.kind] / 2, top = TOPY[c.kind], burnt = c.dmg > 0.85, CC = (cfg.carCond && cfg.carCond[c.cond]) || {}, cr = CC.crush || 1, paint = lam({ map: carTex(c, false) }), glass = lam({ color: burnt ? 0x15181a : GRITTY ? 0x39423e : 0x8fb0b8, transparent: true, opacity: burnt ? 0.85 : GRITTY ? 0.74 : 0.45, side: THREE.DoubleSide });
    let lean = 0, roll = 0;
    if (HICAR) { const hw = carHi(cg, c, { L2, top, cab: CAB[c.kind], r, CC, burnt, tex: paint.map, M }); lean = hw.lean; roll = hw.roll; } else {
    // lower body: side outline with two wheel arches, extruded across the car's width
    const sh = new THREE.Shape(); sh.moveTo(-L2, 0.5); if (GRITTY) { sh.lineTo(-L2 - 0.02, top - 0.34); sh.quadraticCurveTo(-L2, top - 0.02, -L2 + 0.4, top); sh.lineTo(L2 - 1.0, top); sh.quadraticCurveTo(L2 - 0.25, top - 0.03, L2 - 0.04, top - 0.3); sh.quadraticCurveTo(L2 + 0.03, top - 0.42, L2, 0.56); } else { sh.lineTo(-L2, top - 0.1); sh.lineTo(-L2 + 0.15, top); sh.lineTo(L2 - 0.3, top - 0.02); sh.lineTo(L2, top - 0.16); sh.lineTo(L2, 0.5); } sh.lineTo(L2 - 0.08, 0.34);
    sh.lineTo(1.35 + 0.42, 0.34); sh.absarc(1.35, 0.34, 0.42, 0, Math.PI, false); sh.lineTo(-1.35 + 0.42, 0.34); sh.absarc(-1.35, 0.34, 0.42, 0, Math.PI, false); sh.lineTo(-L2 + 0.08, 0.34); sh.lineTo(-L2, 0.5);
    const geo = new THREE.ExtrudeGeometry(sh, GRITTY ? { depth: 1.5, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.12, bevelSegments: seg(4), steps: 8, curveSegments: seg(12) } : { depth: 1.66, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, steps: 6, curveSegments: 8 }); geo.translate(0, 0, GRITTY ? -0.75 : -0.83);
    if (GRITTY) { const Q = geo.attributes.position; for (let i = 0; i < Q.count; i++) { const x = Q.getX(i), y = Q.getY(i), z = Q.getZ(i), hk = Math.max(0, Math.min(1, (y - 0.5) / (top - 0.5))), zn = Math.min(1, Math.abs(z) / 0.87); Q.setXYZ(i, x, y + (y > top - 0.12 ? 0.06 * (1 - zn * zn) : 0), z * (1 - 0.09 * hk) * (1 - 0.13 * Math.pow(Math.abs(x) / L2, 4))); } } // real car shape: sides lean in toward the roof, the nose and tail narrow, the bonnet is crowned
    const P = geo.attributes.position, uv = geo.attributes.uv, cxs = r() < 0.5 ? -1 : 1, czs = r() < 0.5 ? -1 : 1, crush = (x, y, z) => { const d = Math.hypot(x - cxs * L2, z - czs * 0.85), k = Math.max(0, 1 - d / 1.9) * c.dmg * cr; return [x - cxs * 0.6 * k + Math.sin(x * 7 + z * 5 + c.s) * 0.03 * c.dmg, Math.max(0.3, y - 0.3 * k * (y > 0.8 ? 1 : 0.3)), z - czs * 0.3 * k + Math.cos(x * 5 + y * 9 + c.s) * 0.025 * c.dmg]; };
    for (let i = 0; i < P.count; i++) { const q = crush(P.getX(i), P.getY(i), P.getZ(i)); uv.setXY(i, (P.getX(i) + 2.4) / 4.8, (P.getY(i) + Math.abs(P.getZ(i)) * 0.5) / 2.4); P.setXYZ(i, q[0], q[1], q[2]); }
    geo.computeVertexNormals(); cg.add(new THREE.Mesh(geo, paint));
    // cabin: roof on pillars with real window openings; panes are missing, cracked or dirty
    const cb = CAB[c.kind], zc = GRITTY ? 0.66 : 0.72, pil = (p0, p1, z) => { const dx = p1[0] - p0[0], dy = p1[1] - p0[1], m = bxm(GRITTY ? 0.05 : 0.07, Math.hypot(dx, dy) + 0.04, 0.07, paint, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z, cg); m.rotation.z = -Math.atan2(dx, dy); };
    for (const z of [-zc, zc]) { pil(cb[0], cb[1], z); pil(cb[3], cb[2], z); const mx = (cb[1][0] + cb[2][0]) / 2; pil([mx, top], [mx, cb[1][1]], z); bxm(cb[2][0] - cb[1][0], 0.06, 0.07, paint, mx, cb[1][1], z, cg); }
    bxm(cb[2][0] - cb[1][0] + 0.08, 0.06, 2 * zc + 0.07, paint, (cb[1][0] + cb[2][0]) / 2, cb[1][1] + 0.03, 0, cg);
    const pane = (pts) => { const keep = r() > 0.25 + 0.6 * c.dmg; if (keep) quad(pts, glass, cg); else { const a = pts[0], b2 = pts[1], d2 = pts[3]; quad([a, [a[0] + (b2[0] - a[0]) * 0.45, a[1] + (b2[1] - a[1]) * 0.45, a[2] + (b2[2] - a[2]) * 0.45], [a[0] + (d2[0] - a[0]) * 0.3 + (b2[0] - a[0]) * 0.2, a[1] + (d2[1] - a[1]) * 0.3 + (b2[1] - a[1]) * 0.2, a[2] + (d2[2] - a[2]) * 0.3 + (b2[2] - a[2]) * 0.2], [a[0] + (d2[0] - a[0]) * 0.5, a[1] + (d2[1] - a[1]) * 0.5, a[2] + (d2[2] - a[2]) * 0.5]], glass, cg); } }; // a broken pane leaves a shard in one corner
    pane([[cb[3][0], cb[3][1], -zc], [cb[3][0], cb[3][1], zc], [cb[2][0], cb[2][1], zc], [cb[2][0], cb[2][1], -zc]]); pane([[cb[0][0], cb[0][1], zc], [cb[0][0], cb[0][1], -zc], [cb[1][0], cb[1][1], -zc], [cb[1][0], cb[1][1], zc]]);
    for (const z of [-zc, zc]) { const mx = (cb[1][0] + cb[2][0]) / 2; pane([[cb[0][0], top, z], [mx, top, z], [mx, cb[1][1], z], [cb[1][0], cb[1][1], z]]); pane([[mx, top, z], [cb[3][0], top, z], [cb[2][0], cb[2][1], z], [mx, cb[2][1], z]]); }
    // inside: seats, dashboard and a steering wheel, seen through the windows
    const sx0 = (cb[1][0] + cb[2][0]) / 2 + 0.15; for (const z of [-0.36, 0.36]) { bxm(0.5, 0.14, 0.5, M.seat, sx0, top - 0.28, z, cg); const bk = bxm(0.12, 0.6, 0.5, M.seat, sx0 - 0.27, top + 0.0, z, cg); bk.rotation.z = 0.18; }
    bxm(0.25, 0.2, 1.4, M.frameDark, cb[3][0] - 0.25, top - 0.06, 0, cg); const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 5, 12), M.frameDark); sw.position.set(cb[3][0] - 0.45, top + 0.1, 0.36); sw.rotation.y = Math.PI / 2 - 0.3; cg.add(sw);
    if (c.kind === 1) { bxm(1.9, 0.86, 2 * zc + 0.06, paint, -1.15, 1.45, 0, cg); } // van: closed load space
    if (c.kind === 2) { for (const z of [-0.8, 0.8]) bxm(1.85, 0.36, 0.06, paint, -1.35, top + 0.18, z, cg); bxm(0.06, 0.36, 1.6, paint, -L2 + 0.05, top + 0.18, 0, cg); bxm(0.3, 0.3, 0.3, M.frameDark, -1.3, top + 0.15, 0.2, cg).rotation.y = 0.5; } // pickup: open bed with junk in it
    // bumpers, lights, grille; the bonnet stands open on the worst wrecks
    if (GRITTY) { for (const sx of [-1, 1]) { const bm = bxm(0.1, 0.11, 1.56, M.frameDark, sx * (L2 + 0.06), 0.47, 0, cg); bm.userData.k = 'bumper'; for (const z of [-0.74, 0.74]) bxm(0.2, 0.11, 0.08, M.frameDark, sx * (L2 - 0.02), 0.47, z, cg); // slim dark bumper that wraps the corners
        for (const z of [-0.5, 0.5]) { const broken = r() < 0.5 + 0.4 * c.dmg; if (sx > 0) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 12), broken ? M.frameDark : M.paper); l.rotation.z = Math.PI / 2; l.position.set(L2 + 0.0, top - 0.36, z); cg.add(l); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 5, 14), M.chrome); rg.rotation.y = Math.PI / 2; rg.position.set(L2 + 0.03, top - 0.36, z); cg.add(rg); } else bxm(0.04, 0.09, 0.3, broken ? M.frameDark : M.rug, -L2 - 0.03, top - 0.3, z, cg); } }
      for (let k = 0; k < 5; k++) bxm(0.03, 0.022, 0.62, M.frameDark, L2 + 0.03, top - 0.3 - k * 0.035, 0, cg); // grille slats
      for (const [wx, wz] of [[1.35, 0.6], [1.35, -0.6], [-1.35, 0.6], [-1.35, -0.6]]) bxm(0.86, 0.5, 0.34, M.frameDark, wx, 0.58, wz, cg); } // dark wheel wells
    else { for (const sx of [-1, 1]) { bxm(0.12, 0.16, 1.7, M.chrome, sx * (L2 + 0.03), 0.46, 0, cg); for (const z of [-0.6, 0.6]) bxm(0.05, 0.14, 0.26, r() < 0.5 + 0.4 * c.dmg ? M.frameDark : (sx > 0 ? M.paper : M.rug), sx * (L2 + 0.03), top - 0.22, z, cg); }
    bxm(0.04, 0.2, 0.9, M.frameDark, L2 + 0.03, top - 0.24, 0, cg); }
    if (c.dmg > 0.55 && c.kind !== 1) { const hd = bxm(1.0, 0.04, 1.5, paint, 0, 0, 0, cg); hd.position.set(cb[3][0] + 0.55, top + 0.42, 0); hd.rotation.z = -0.95; bxm(0.6, 0.3, 0.9, M.frameDark, cb[3][0] + 0.6, top - 0.2, 0, cg); }
    [[1.35, 0.86], [1.35, -0.86], [-1.35, 0.86], [-1.35, -0.86]].forEach(([wx, wz], k) => {
      if (c.wheels & (1 << k) && (c.rust > 0.45 || CC.wheels === 'none' || CC.wheels === 'one')) { if (CC.blocks) { for (let b = 0; b < 2; b++) bxm(0.34, 0.15, 0.2, M.frameDark, wx + (b ? 0.03 : -0.02), 0.08 + b * 0.16, wz * 0.9, cg).rotation.y = b * 1.57; } else if (!CC.sink) { lean += wx > 0 ? -0.05 : 0.05; roll += wz > 0 ? 0.05 : -0.05; } const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), M.chrome); hub.rotation.x = Math.PI / 2; hub.position.set(wx, 0.34, wz * 0.92); cg.add(hub); return; }
      const flat = !!CC.flat || r() < 0.3 + 0.4 * c.rust, w = new THREE.Mesh(GRITTY ? new THREE.TorusGeometry(0.245, 0.115, seg(8), seg(18)) : new THREE.CylinderGeometry(0.36, 0.36, 0.24, seg(14)), M.rubber); if (!GRITTY) w.rotation.x = Math.PI / 2; w.position.set(wx, flat ? 0.3 : 0.36, GRITTY ? wz * 0.9 : wz); if (flat) { if (GRITTY) w.scale.set(1.06, 0.84, 1); else w.scale.set(1.06, 1, 0.82); } cg.add(w);
      const rim = new THREE.Mesh(GRITTY ? new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12) : new THREE.CylinderGeometry(0.2, 0.2, 0.26, 10), M.chrome); rim.rotation.x = Math.PI / 2; rim.position.copy(w.position); cg.add(rim);
    });
    }
    { const o = uniq('car', () => { const sc = [0.94 + 0.12 * r(), 0.95 + 0.1 * r(), 0.95 + 0.1 * r()]; return { sc, sig: [c.kind, c.paint, c.s, sc.map((v) => v.toFixed(3)).join('/')].join('-') }; }); cg.scale.set(o.sc[0], o.sc[1], o.sc[2]); }
    if (CC.tipped) roll = Math.PI / 2 - 0.06; cg.rotation.set(roll, c.yaw, lean, 'YXZ'); cg.position.set(c.x, CC.tipped ? 0.8 : -(CC.sink || 0) - (lean || roll ? 0.08 : 0), c.z);
    if (CC.green) { for (let k = 0; k < 5; k++) { const v = new THREE.Mesh(new THREE.PlaneGeometry(1.5 + r(), 1.2 + r() * 0.6), M.vine); v.rotation.set(-Math.PI / 2 + (r() - 0.5) * 0.3, 0, r() * 3); const vx = (r() - 0.5) * 2 * L2 * 0.8; v.position.set(vx, top + 0.05 + (Math.abs(vx + 0.3) < 0.9 ? 0.55 : 0), (r() - 0.5) * 1.2); cg.add(v); } for (const sz of [-0.9, 0.9]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), M.vine); v.position.set(r() - 0.5, 0.75, sz); cg.add(v); } const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.9, 6), M.bark); tr.position.set(L2 - 0.75, top + 0.7, 0.15); tr.rotation.z = 0.12; cg.add(tr); for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), k % 2 ? M.canopy : M.canopyDark); cn.position.set(L2 - 0.8, top + 1.7, 0.15); cn.rotation.y = k * 1.05; cg.add(cn); } }
    for (let k = 0; k < (CC.green ? 9 : c.cond === 0 ? 0 : 2 + Math.round(4 * c.rust)); k++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), M.tuft), a = r() * 6.28; t.position.set(c.x + Math.cos(a) * 1.6, 0.5, c.z + Math.sin(a) * 1.6); t.rotation.y = r() * 3; add(t); }
    if (c.rust > 0.7) { const v = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5), M.vine); v.rotation.x = -Math.PI / 2 + 0.2; v.position.set(L2 - 0.9, top + 0.03, 0); cg.add(v); }
    add(cg);
  }

  if (SH) SH.finish();
  // ---------------------------------------------------------------- batching: everything static is merged per material (about 1,100 draw calls become a few dozen)
  {
    g.updateMatrixWorld(true); const keep = new Set(marks.map((q) => q.mark)); keep.add(tufts); const buckets = new Map(), dead = [], v = new THREE.Vector3(), nm = new THREE.Matrix3(), WHITE = new THREE.Color(1, 1, 1);
    const CELL = QUALITY === 'high' ? CONFIG.lag.mergeCell : 0;
    const tintOf = (o, m) => { for (let q = o; q; q = q.parent) { if (q.userData.tint) return q.userData.tint; if (q.userData.tintM && q.userData.tintM[m.uuid]) return q.userData.tintM[m.uuid]; } return WHITE; };
    g.traverse((o) => {
      // (desktop scenery, src/scenehi.js: its leaf masses, hills and roofs carry their own vertex colours and cells, so they are left out of the merge)
      if (!o.isMesh || o.isInstancedMesh || keep.has(o) || o.userData.scenery) return; const geo = o.geometry, P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, idx = geo.index, mats = Array.isArray(o.material) ? o.material : [o.material];
      const total = idx ? idx.count : P.count, groups = geo.groups.length && mats.length > 1 ? geo.groups : [{ start: 0, count: total, materialIndex: 0 }]; nm.getNormalMatrix(o.matrixWorld);
      // LAG FIX Nov 19 (desktop): one merged mesh per material AND per cell of CELL m (by where each piece stands), so the parts behind you or out of view are culled
      const ck = CELL ? Math.floor(o.matrixWorld.elements[12] / CELL) + ',' + Math.floor(o.matrixWorld.elements[14] / CELL) : '';
      for (const gr of groups) { const m = mats[gr.materialIndex] || mats[0], bk = CELL ? m.uuid + ck : m; let b = buckets.get(bk); if (!b) { b = { p: [], n: [], u: [], c: [], m }; buckets.set(bk, b); } const tc = tintOf(o, m);
        for (let k = gr.start; k < Math.min(total, gr.start + gr.count); k++) { const i = idx ? idx.getX(k) : k; v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); b.p.push(v.x, v.y, v.z); if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); b.n.push(v.x, v.y, v.z); } else b.n.push(0, 1, 0); if (U) b.u.push(U.getX(i), U.getY(i)); else b.u.push(0, 0); b.c.push(tc.r, tc.g, tc.b); } }
      dead.push(o);
    });
    for (const o of dead) { o.geometry.dispose(); o.parent.remove(o); }
    // a material with few vertices in all stays ONE mesh (splitting it by cell only adds draws); only big ones are split
    if (CELL) { const byM = new Map(); for (const [k, b] of buckets) { const l = byM.get(b.m) || []; l.push([k, b]); byM.set(b.m, l); }
      for (const l of byM.values()) { if (l.length < 2 || l.reduce((a, q) => a + q[1].p.length / 3, 0) >= CONFIG.lag.mergeSplitVerts) continue; const b0 = l[0][1]; for (const [k, b] of l.slice(1)) { for (const key of ['p', 'n', 'u', 'c']) for (const x of b[key]) b0[key].push(x); buckets.delete(k); } } }
    for (const b of buckets.values()) { const m = b.m, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); m.vertexColors = true; m.needsUpdate = true; const mm = new THREE.Mesh(geo, m); mm.receiveShadow = true; mm.castShadow = !m.transparent; g.add(mm); }
  }

  return {
    g, houses, marks, torn: tornN, sigs, sunDir,
    // house i becomes the origin (the sim's own coordinates); -1 puts the world back for the street
    frame(i) { if (i < 0) { g.position.set(0, 0, 0); g.rotation.y = 0; return; } const h = run.houses[i]; g.rotation.y = -houses[i].rotation.y; g.position.set(-(h.x * h.cs + h.z * h.sn), 0, -(-h.x * h.sn + h.z * h.cs)); },
    light(k) { sun.intensity = W.sun * Math.max(0.06, 1 - k * 1.05); sun.color.setHex(k > 0.6 ? 0x9db4ff : 0xfff1d6); const dk = 1 - 0.55 * Math.min(1, k * 1.2); M.int.color.setHex(W.intTint).multiplyScalar(dk); M.wood.color.setHex(W.floorTint).multiplyScalar(dk); },
    // LAG FIX Nov 19: every picture a material holds is freed (not only .map: relief, cut-out and glow pictures piled up run after run), unless it is marked shared
    dispose() { g.traverse((q) => { if (q.geometry) q.geometry.dispose(); const ms = q.material ? (Array.isArray(q.material) ? q.material : [q.material]) : []; for (const m of ms) { for (const k in m) { const t = m[k]; if (t && t.isTexture && !(t.userData && t.userData.shared)) t.dispose(); } m.dispose(); } }); }
  };
}
