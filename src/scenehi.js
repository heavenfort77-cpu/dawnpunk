// Desktop scenery (2026-11-16; owner, sharing another solarpunk jam game: "see the standard? this is how the background should be", then "i meant standard not copy the background").
// The QUALITY BAR of that picture, built from Dawnpunk's own content: the frame full of plants (no bare lawn), layered round canopies, varied wildflowers, soft shading,
// warm saturated light, cumulus sky and depth haze. Nothing of its layout or buildings is taken: the base keeps its own stations, bloom-tech, garden and people, and the
// horizon is our own world (rolling farmland and woods, the old settlement's roofs, bloom-tech solar masts on the hills).
// High tier only (phones keep their scenery: CONFIG.quality.low.scenery is null). Switch: CONFIG.quality.high.scenery.on; ?scenery=0 / ?scenery=1 in the address override it for one visit; ?fx=0 also turns it off.
// How the density is paid for: grass and flowers are InstancedMesh clumps (many blades and flowers in one clump geometry) in 10-12 m chunks; every chunk is a THREE.LOD (full clump near,
// a clump of fewer blades further away, nothing beyond `far`), so frustum culling and distance work per chunk. Leaf masses (canopies, hedges, shrubs) are leaf geometry baked into
// one mesh per 20 m cell (no picture cards, so the contact shading pass sees their real shape: no grey boards). Grass and flowers sway in the wind in the vertex shader and are kept
// out of the contact shading pass (userData.noAO, src/fx.js): their own vertex colours carry dark roots instead. Every number: CONFIG.quality.high.scenery.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { Q } from './quality.js';

const URLQ = (k) => { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } };
export const SCENERY = !!Q.scenery && URLQ('fx') !== '0' && URLQ('scenery') !== '0' && (!!Q.scenery.on || URLQ('scenery') === '1');
const S = () => CONFIG.quality.high.scenery;
const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz), a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, z) => 0.55 * vnoise(x, z) + 0.3 * vnoise(x * 2.1 + 5.3, z * 2.1 - 3.1) + 0.15 * vnoise(x * 4.3 - 1.7, z * 4.3 + 8.2);

// ---------------------------------------------------------------- the sky and the colour grade (read by src/sky.js and src/fx.js)
// the sky's daytime settings with the scenery's cumulus values laid over them (night colours are untouched)
export function skyOverride(sky) {
  if (!SCENERY) return sky; const K = S().sky, o = Object.assign({}, sky);
  o.cover = K.cover; o.scale = K.scale; o.soft = K.soft; o.horizon = K.horizon; o.zenith = [K.zenith, sky.zenith[1], sky.zenith[2]]; o.cloudLit = [K.cloudLit, sky.cloudLit[1], sky.cloudLit[2]]; o.cloudCore = [K.cloudCore, sky.cloudCore[1], sky.cloudCore[2]];
  return o;
}
// the desktop colour grade: AgX (as before), then saturation, warmth and contrast. Their day strength fades to the night values as the exposure falls from the day exposure
// to the night exposure (CONFIG.render), so the night keeps its own cold, dark look. Installed once by src/fx.js as THREE.CustomToneMapping.
export function installGrade(renderer) {
  if (!SCENERY || installGrade.done) return; installGrade.done = true; const G = S().grade, R = CONFIG.render, f = (v) => Number(v).toFixed(4);
  const fn = 'vec3 CustomToneMapping( vec3 color ) { vec3 c = AgXToneMapping( color ); float day = clamp( ( toneMappingExposure - ' + f(R.exposureNight) + ' ) / ' + f(Math.max(0.01, R.exposure - R.exposureNight)) + ', 0.0, 1.0 );\n'
    + ' float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); c = max( mix( vec3( l ), c, mix( ' + f(G.satNight) + ', ' + f(G.sat) + ', day ) ), 0.0 );\n'
    + ' c *= mix( vec3( 1.0 ), vec3( ' + f(1 + G.warm) + ', ' + f(1 + G.warm * 0.35) + ', ' + f(1 - G.warm) + ' ), day );\n'
    + ' c = mix( c, c * c * ( 3.0 - 2.0 * c ), ' + f(G.contrast) + ' * day ); return clamp( c, 0.0, 1.0 ); }';
  THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }', fn);
  renderer.toneMapping = THREE.CustomToneMapping;
}

// ---------------------------------------------------------------- materials: wind sway, two-sided without dark backs
const WIND = { value: 0 };
const PROJ = `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif
vec4 wPos = modelMatrix * mvPosition;
float hW = max( position.y, 0.0 );
float gW = sin( uWindT * 1.6 + wPos.x * 0.31 + wPos.z * 0.17 ) * 0.7 + sin( uWindT * 2.9 + wPos.x * 0.83 - wPos.z * 0.61 ) * 0.3;
wPos.xz += vec2( 0.8, 0.45 ) * ( gW + 0.35 ) * uSway * hW * hW;
mvPosition = viewMatrix * wPos;
gl_Position = projectionMatrix * mvPosition;`;
// a plant material: vertex colours, both sides lit from the same soft normal (a blade seen from behind must not turn dark), optional sway (m at the top of a 1-tall clump)
function plantMat(sway, rough) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough === undefined ? 0.9 : rough, side: THREE.DoubleSide, envMapIntensity: 0.5 }); m.userData.pbr = true; m.userData.scenery = true;
  // keepOut (CONFIG.quality.high.fx.keepOut, the same stencil number as Marla's hair): the contact shading pass leaves these pixels alone, so the shading of the ground or a wall
  // behind a blade is never laid over the blade (the pass does not see the swaying grass, userData.noAO)
  const ko = CONFIG.quality.high.fx && CONFIG.quality.high.fx.keepOut; if (ko) { m.stencilWrite = true; m.stencilRef = ko; m.stencilFunc = THREE.AlwaysStencilFunc; m.stencilZPass = THREE.ReplaceStencilOp; }
  m.onBeforeCompile = (sh) => { sh.uniforms.uWindT = WIND; sh.uniforms.uSway = { value: sway };
    if (sway) sh.vertexShader = 'uniform float uWindT;\nuniform float uSway;\n' + sh.vertexShader.replace('#include <project_vertex>', PROJ);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '')); nightHook(sh); };
  m.customProgramCacheKey = () => 'scnplant' + (sway ? 1 : 0);
  return m;
}
// a solid material for baked geometry with vertex colours (bark, stones, roofs, ceramic)
// the far world's materials take the same night hook (its meshes call tick before drawing): the far hills and woods must not stay green after dark
function nightMat(m) { m.onBeforeCompile = nightHook; m.customProgramCacheKey = () => 'scnfar'; return m; }
// a leaf-mass material: solid, with the night hook (its meshes call tick before drawing)
function leafMat(extra) { const m = solidMat(0.85, Object.assign({ side: THREE.FrontSide }, extra || {})); m.onBeforeCompile = nightHook; m.customProgramCacheKey = () => 'scnleaf'; return m; }
function solidMat(rough, extra) { const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: rough, envMapIntensity: 0.6 }, extra || {})); m.userData.pbr = true; m.userData.scenery = true; return m; }
// NIGHT: 0 by day, 1 at full night, from the exposure (CONFIG.render.exposure by day, exposureNight at night), read each frame before plants are drawn
const NIGHT = { value: 0 };
const tick = (rd) => { WIND.value = performance.now() / 1000 * S().grass.windSpeed; const R = CONFIG.render; if (rd && rd.toneMappingExposure !== undefined) NIGHT.value = Math.max(0, Math.min(1, (R.exposure - rd.toneMappingExposure) / Math.max(0.01, R.exposure - R.exposureNight))); };
// after dark the plants lose colour and light (night.grey, night.dark): the meadow and the leaf masses must not glow green while the houses go dark
function nightHook(sh) { const N = S().night; sh.uniforms.uNight = NIGHT; sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix( diffuseColor.rgb, vec3( dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) ), uNight * ' + N.grey.toFixed(3) + ' ) * ( 1.0 - uNight * ' + N.dark.toFixed(3) + ' );'); }

// ---------------------------------------------------------------- baking many small parts into a few meshes (one per cell, so far cells are culled)
// join the plain meshes hanging straight under g (no instancing, no children, the same attributes) per material, shadow flags and cell of `cell` m; the joined
// mesh keeps the first piece's draw hook (the night tint) and flags
function joinCells(g, cell) { const it = joinCellsIter(g, cell); let x = it.next(); while (!x.done) x = it.next(); return x.value; }
// the same, stopping (yield) after each joined mesh, for the base's sliced build on the title
function* joinCellsIter(g, cell) { const groups = new Map(), v = new THREE.Vector3(); let seen = 0; g.updateMatrixWorld(true); yield;
  for (const o of [...g.children]) { if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.children.length || Array.isArray(o.material) || !o.geometry || o.morphTargetInfluences) continue;
    const ge = o.geometry; if (!ge.boundingSphere) ge.computeBoundingSphere(); v.copy(ge.boundingSphere.center).applyMatrix4(o.matrixWorld);
    const k = o.material.uuid + '|' + o.castShadow + o.receiveShadow + '|' + Object.keys(ge.attributes).sort().join(',') + '|' + !!ge.index + '|' + Math.floor(v.x / cell) + ',' + Math.floor(v.z / cell);
    let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(o); if (++seen % 120 === 0) yield; }
  // (Nov 20, title frames of 106-184 ms in this step on the Mac) the sorting above stops every 120 pieces, and a group's pieces are copied and moved in steps of
  // about 12 000 corners, so no one step is long; the result is the same
  let n = 0; for (const l of groups.values()) { if (l.length < 2) continue; const gs = []; let vc = 0; for (const o of l) { const c = o.geometry.clone(); o.updateMatrix(); c.applyMatrix4(o.matrix); gs.push(c); vc += c.attributes.position.count; if (vc > 12000) { vc = 0; yield; } } const m = mergeGeometries(gs, false); for (const c of gs) c.dispose(); if (!m) continue;
    m.computeBoundingSphere(); const a = l[0], j = new THREE.Mesh(m, a.material); j.castShadow = a.castShadow; j.receiveShadow = a.receiveShadow; j.onBeforeRender = a.onBeforeRender; j.renderOrder = a.renderOrder; Object.assign(j.userData, a.userData);
    for (const o of l) { g.remove(o); o.geometry.dispose(); } g.add(j); n += l.length - 1; yield; }
  return n; }
function Bake(cell) {
  const B = new Map(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  const at = (x, z) => { const k = Math.floor(x / cell) + ',' + Math.floor(z / cell); let b = B.get(k); if (!b) B.set(k, b = { P: [], N: [], C: [], I: [] }); return b; };
  return {
    at,
    // every vertex so far: fn(colour array, index of r, x, y, z) may change its colour (the woods' baked haze)
    each(fn) { for (const b of B.values()) for (let i = 0; i < b.P.length; i += 3) fn(b.C, i, b.P[i], b.P[i + 1], b.P[i + 2]); },
    // a ready geometry, moved by m4, in one colour (or col(i, worldPos) per vertex)
    geo(geo, m4, col, x, z) { const b = at(x, z), P = geo.attributes.position, N = geo.attributes.normal, idx = geo.index, v0 = b.P.length / 3; nm.getNormalMatrix(m4);
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m4); b.P.push(v.x, v.y, v.z); const c = typeof col === 'function' ? col(i, v) : col; b.C.push(c.r, c.g, c.b); v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); b.N.push(v.x, v.y, v.z); }
      if (idx) for (let i = 0; i < idx.count; i++) b.I.push(idx.getX(i) + v0); else for (let i = 0; i < P.count; i++) b.I.push(v0 + i); },
    meshes(mat, parent, o) { let tris = 0; for (const b of B.values()) { if (!b.I.length) continue; const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3)); ge.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3)); ge.setAttribute('color', new THREE.Float32BufferAttribute(b.C, 3));
      ge.setIndex(b.I.length > 65000 ? new THREE.Uint32BufferAttribute(b.I, 1) : new THREE.Uint16BufferAttribute(b.I, 1)); ge.computeBoundingSphere(); const m = new THREE.Mesh(ge, mat); Object.assign(m.userData, o && o.ud || {}); m.castShadow = !!(o && o.cast); m.receiveShadow = true; if (o && o.tick) m.onBeforeRender = tick; parent.add(m); tris += b.I.length / 3; }
      B.clear(); return tris; },
  };
}

// ---------------------------------------------------------------- the ground under the grass
// a finer plane in place of the flat one; its vertex colours carry large soft patches (deep green, light green, dry straw) and a finer mottle, so the gaps between the clumps
// never read as one flat lawn. w, d: size (m); uvRep: metres per texture repeat when the old plane scaled its own uvs (the street), 0 when its texture repeats (the base)
// the base's own ground (src/basewater.js sinkGround: a grid in world x / z, dug along the stream): shaded in place with the same patches; the channel's slopes a little darker and browner
function mottleOwn(mesh) {
  const K = S().ground, ge = mesh.geometry, P = ge.attributes.position, cl = [], c = new THREE.Color(), dk = new THREE.Color(K.dark), lt = new THREE.Color(K.light), dry = new THREE.Color(K.dry), mud = new THREE.Color(0x6a5a3a);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), n = fbm(x * K.scale, z * K.scale), f = vnoise(x * K.fine + 3.1, z * K.fine - 7.7), dz = fbm(x * K.scale * 0.5 + 17, z * K.scale * 0.5 - 5);
    c.copy(dk).lerp(lt, Math.max(0, Math.min(1, (n - 0.25) * 2))); if (dz > K.dryFrom) c.lerp(dry, Math.min(1, (dz - K.dryFrom) * 4) * K.dryMax); c.multiplyScalar(1 - K.fineK * 0.5 + K.fineK * f); if (y < -0.005) c.lerp(mud, Math.min(0.7, -y * 2.2)); cl.push(c.r, c.g, c.b); }
  ge.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); mesh.material.vertexColors = true; mesh.material.needsUpdate = true; mesh.userData.scenery = true; mesh.receiveShadow = true; mesh.castShadow = false;
  return (ge.index ? ge.index.count : P.count) / 3;
}
export function mottle(mesh, w, d, uvRep) {
  if (mesh.userData.ownGround) return mottleOwn(mesh);
  if (CONFIG.lag && CONFIG.lag.groundBake) return mottleBaked(mesh, w, d, uvRep);
  const K = S().ground, sx = Math.max(1, Math.round(w * K.seg)), sz = Math.max(1, Math.round(d * K.seg)), ge = new THREE.PlaneGeometry(w, d, sx, sz), P = ge.attributes.position, U = ge.attributes.uv, cl = [], c = new THREE.Color(), dk = new THREE.Color(K.dark), lt = new THREE.Color(K.light), dry = new THREE.Color(K.dry);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i) + mesh.position.x, z = mesh.position.z - P.getY(i), n = fbm(x * K.scale, z * K.scale), f = vnoise(x * K.fine + 3.1, z * K.fine - 7.7), dz = fbm(x * K.scale * 0.5 + 17, z * K.scale * 0.5 - 5);
    c.copy(dk).lerp(lt, Math.max(0, Math.min(1, (n - 0.25) * 2))); if (dz > K.dryFrom) c.lerp(dry, Math.min(1, (dz - K.dryFrom) * 4) * K.dryMax); c.multiplyScalar(1 - K.fineK * 0.5 + K.fineK * f); cl.push(c.r, c.g, c.b); }
  if (uvRep) for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * w / uvRep, U.getY(i) * d / uvRep);
  ge.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); mesh.geometry.dispose(); mesh.geometry = ge; mesh.material.vertexColors = true; mesh.material.needsUpdate = true; mesh.userData.scenery = true; mesh.receiveShadow = true; mesh.castShadow = false;
  return ge.index.count / 3;
}

// LAG FIX Nov 19 (owner 11:25, CONFIG.lag.groundBake): the same mottle, kept in a texture with one texel per point of the old 1 m grid (texel centres on the grid
// points, filtered linearly between them) on a 2-triangle sheet, instead of 57k coloured triangles. The sheet's own material (only this sheet uses it) multiplies its
// colour by the texture where it multiplied by the grid's point colours.
function mottleBaked(mesh, w, d, uvRep) {
  const K = S().ground, sx = Math.max(1, Math.round(w * K.seg)), sz = Math.max(1, Math.round(d * K.seg)), W = sx + 1, H = sz + 1, px = new Uint8Array(W * H * 4), c = new THREE.Color(), dk = new THREE.Color(K.dark), lt = new THREE.Color(K.light), dry = new THREE.Color(K.dry), e = new THREE.Color();
  for (let iy = 0; iy <= sz; iy++) for (let ix = 0; ix <= sx; ix++) { const x = ix * w / sx - w / 2 + mesh.position.x, z = mesh.position.z - (d / 2 - iy * d / sz), n = fbm(x * K.scale, z * K.scale), f = vnoise(x * K.fine + 3.1, z * K.fine - 7.7), dz = fbm(x * K.scale * 0.5 + 17, z * K.scale * 0.5 - 5);
    c.copy(dk).lerp(lt, Math.max(0, Math.min(1, (n - 0.25) * 2))); if (dz > K.dryFrom) c.lerp(dry, Math.min(1, (dz - K.dryFrom) * 4) * K.dryMax); c.multiplyScalar(1 - K.fineK * 0.5 + K.fineK * f);
    e.copy(c).convertLinearToSRGB(); const o = ((sz - iy) * W + ix) * 4; px[o] = Math.round(Math.min(1, e.r) * 255); px[o + 1] = Math.round(Math.min(1, e.g) * 255); px[o + 2] = Math.round(Math.min(1, e.b) * 255); px[o + 3] = 255; }
  const tx = new THREE.DataTexture(px, W, H, THREE.RGBAFormat, THREE.UnsignedByteType); tx.colorSpace = THREE.SRGBColorSpace; tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearFilter; tx.generateMipmaps = false; tx.needsUpdate = true;
  const ge = new THREE.PlaneGeometry(w, d, 1, 1), U = ge.attributes.uv, mu = new Float32Array(U.count * 2);
  for (let i = 0; i < U.count; i++) { const u = U.getX(i), v = U.getY(i); mu[i * 2] = (u * sx + 0.5) / W; mu[i * 2 + 1] = (v * sz + 0.5) / H; if (uvRep) U.setXY(i, u * w / uvRep, v * d / uvRep); }
  ge.setAttribute('mUv', new THREE.Float32BufferAttribute(mu, 2)); mesh.geometry.dispose(); mesh.geometry = ge;
  const m = mesh.material; if (!m.userData.mottleOn) { m.userData.mottleOn = true; m.addEventListener('dispose', () => { if (m.__mot) m.__mot.dispose(); }); m.__motPrev = m.onBeforeCompile; } else if (m.__mot) m.__mot.dispose();
  const prev = m.__motPrev; m.vertexColors = false; m.__mot = tx;
  m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); sh.uniforms.mMot = { value: tx }; sh.vertexShader = 'attribute vec2 mUv;\nvarying vec2 vMUv;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvMUv = mUv;');
    sh.fragmentShader = 'uniform sampler2D mMot;\nvarying vec2 vMUv;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= texture2D(mMot, vMUv).rgb;'); };
  m.customProgramCacheKey = () => 'mottle'; m.needsUpdate = true; mesh.userData.scenery = true; mesh.receiveShadow = true; mesh.castShadow = false;
  return 2;
}

// ---------------------------------------------------------------- leaf masses: clusters of real leaves round a dark core, shaded as one soft round mass
const cA = new THREE.Color(), cB = new THREE.Color(), cC = new THREE.Color();
// palette: [top (lit), mid, shade] colours of one plant
function blob(bk, c, rx, ry, rz, o) {
  const F = S().foliage, r = o.r, crown = o.crown || c, sun = o.sun, leaf = o.leaf || F.leaf, pal = o.pal, lower = o.lower === undefined ? 0.5 : o.lower;
  const area = 4 * PI * (rx * ry + rx * rz + ry * rz) / 3, n = Math.max(12, Math.round((o.cover || F.cover) * area / (leaf * leaf * 0.42))), b = bk.at(c.x, c.z);
  const top = cA.set(pal[0]), mid = cB.set(pal[1]), shd = cC.set(pal[2]), col = new THREE.Color(), d = new THREE.Vector3(), nS = new THREE.Vector3(), nL = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), p = new THREE.Vector3(), cr = o.crownR || Math.max(rx, ry, rz);
  const shadeAt = (pt, nrm) => { const lit = Math.max(0, nrm.dot(sun)) * 0.7 + 0.3 * (nrm.y * 0.5 + 0.5), ht = Math.max(-1, Math.min(1, (pt.y - crown.y) / cr)), t = Math.max(0, Math.min(1, 0.62 * lit + 0.3 * (ht * 0.5 + 0.5) + (r() - 0.5) * F.jitter)); if (t < 0.5) col.copy(shd).lerp(mid, t * 2); else col.copy(mid).lerp(top, (t - 0.5) * 2); return col; };
  // the core: a dark round body under the leaves, so the mass never shows through
  if (o.core !== false) { const ico = blob.ico || (blob.ico = new THREE.IcosahedronGeometry(1, 2)), P = ico.attributes.position, v0 = b.P.length / 3;
    for (let i = 0; i < P.count; i++) { d.fromBufferAttribute(P, i); p.set(c.x + d.x * rx * 0.86, c.y + d.y * ry * 0.86, c.z + d.z * rz * 0.86); nS.copy(p).sub(crown).normalize().add(d).normalize(); b.P.push(p.x, p.y, p.z); b.N.push(nS.x, nS.y, nS.z); const cc = shadeAt(p, nS).multiplyScalar(F.coreDark); b.C.push(cc.r, cc.g, cc.b); b.I.push(v0 + i); } }
  for (let k = 0; k < n; k++) {
    d.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); if (d.lengthSq() > 1 || d.lengthSq() < 0.01) { k--; continue; } d.normalize(); if (d.y < -lower) continue;
    const s = o.fill ? 0.3 + 0.75 * Math.cbrt(r()) : 0.86 + 0.2 * r(); p.set(c.x + d.x * rx * s, c.y + d.y * ry * s, c.z + d.z * rz * s);
    const n0 = t1.set(d.x / rx, d.y / ry, d.z / rz).normalize(); nS.copy(p).sub(crown).normalize().lerp(n0, 0.5).addScaledVector(UP, 0.15).normalize();
    nL.copy(n0).add(t2.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(F.tilt)).addScaledVector(UP, 0.35).normalize();
    // the leaf's own frame: v along the leaf (pointing roughly down the slope, turned at random), u across it, u x v = nL
    const vv = t2.copy(UP).addScaledVector(nL, -nL.y); if (vv.lengthSq() < 1e-4) vv.set(1, 0, 0); vv.normalize().applyAxisAngle(nL, (r() - 0.5) * 2.4); const uu = new THREE.Vector3().crossVectors(vv, nL);
    const L = leaf * (0.75 + 0.5 * r()), W = L * F.width, cc = shadeAt(p, nS), v0 = b.P.length / 3, tipC = cc.clone().offsetHSL(0.01, 0.02, 0.04);
    const pts = [p.clone().addScaledVector(vv, -L / 2), p.clone().addScaledVector(uu, W / 2), p.clone().addScaledVector(vv, L / 2), p.clone().addScaledVector(uu, -W / 2), p.clone().addScaledVector(nL, L * 0.12)];
    for (let i = 0; i < 5; i++) { b.P.push(pts[i].x, pts[i].y, pts[i].z); b.N.push(nS.x, nS.y, nS.z); const q = i === 2 ? tipC : cc; b.C.push(q.r, q.g, q.b); }
    b.I.push(v0 + 4, v0, v0 + 1, v0 + 4, v0 + 1, v0 + 2, v0 + 4, v0 + 2, v0 + 3, v0 + 4, v0 + 3, v0);
  }
}
// a tree: trunk with a root flare and limbs into a crown of leaf clusters. o: { h trunk height, R crown radius, lean, pal, leaf, sun, r, blobs, bark }
function tree(bark, fol, x, z, o) {
  const r = o.r, h = o.h, R = o.R, lx = (r() - 0.5) * o.lean, lz = (r() - 0.5) * o.lean, top = V(x + lx, h, z + lz), cc = V(x + lx * 1.2, h + R * 0.5, z + lz * 1.2), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), bc = new THREE.Color(o.bark || S().tree.bark);
  const rod = (a, b2, r0, r1) => { const d = b2.clone().sub(a), l = d.length(), ge = new THREE.CylinderGeometry(r1, r0, l, 7, 2); q.setFromUnitVectors(UP, d.normalize()); m4.compose(a.clone().lerp(b2, 0.5), q, V(1, 1, 1)); bark.geo(ge, m4, (i, w) => cA.copy(bc).multiplyScalar(0.55 + 0.45 * Math.min(1, w.y / 2.5)), x, z); ge.dispose(); };
  const tr = 0.07 + R * 0.08; rod(V(x, -0.1, z), V(x + lx * 0.12, 0.45, z + lz * 0.12), tr * 1.7, tr * 1.1); rod(V(x + lx * 0.12, 0.4, z + lz * 0.12), top, tr * 1.1, tr * 0.7);
  const nb = o.blobs || 7, spots = [[cc.clone(), R * 0.62, R * 0.55]];
  for (let k = 0; k < nb - 1; k++) { const a = k / (nb - 1) * 2 * PI + r() * 0.6, up = k % 3 === 0 ? 0.45 : (r() - 0.35) * 0.4, dd = R * (k % 3 === 0 ? 0.3 : 0.62); spots.push([V(cc.x + Math.cos(a) * dd, cc.y + up * R, cc.z + Math.sin(a) * dd), R * (0.4 + 0.14 * r()), R * (0.34 + 0.12 * r())]); }
  for (const [c] of spots.slice(1)) if (r() < 0.75) rod(top, V(c.x, c.y - R * 0.25, c.z), tr * 0.6, tr * 0.25);
  for (const [c, rr, ry] of spots) blob(fol, c, rr, ry, rr, { r, crown: cc, crownR: R, sun: o.sun, pal: o.pal, leaf: o.leaf, cover: o.cover, lower: 0.35 });
}

// ---------------------------------------------------------------- grass clumps with wildflowers in them (one geometry per kind; instanced)
// blades: curved blades from one root, dark at the root (the clump's own contact shade), green in the middle, warm light green at the tip. Unit size: about 1 tall, 0.5 across.
function clumpGeo(blades, seed, flowers) {
  const G = S().grass, r = rng(seed), P = [], N = [], C = [], I = [], cR = new THREE.Color(G.root), cM = new THREE.Color(G.mid), cT = new THREE.Color(G.tip), dry = new THREE.Color(G.dry), c = new THREE.Color();
  const vtx = (x, y, z, nx, ny, nz, col) => { P.push(x, y, z); const l = Math.hypot(nx, ny, nz) || 1; N.push(nx / l, ny / l, nz / l); C.push(col.r, col.g, col.b); return P.length / 3 - 1; };
  for (let b = 0; b < blades; b++) {
    const a = r() * 2 * PI, rad = Math.sqrt(r()) * 0.2, ox = Math.cos(a) * rad, oz = Math.sin(a) * rad, la = a + (r() - 0.5) * 1.4, dx = Math.cos(la), dz = Math.sin(la), lean = 0.12 + 0.5 * r(), h = 0.5 + 0.5 * r(), w = G.width * (0.7 + 0.6 * r());
    const px = -dz, pz = dx, isDry = r() < G.dryShare, tipK = 0.6 + 0.4 * r(), shade = 0.85 + 0.3 * r(), v0 = P.length / 3, nx = ox * 2.4 + dx * 0.4, nz = oz * 2.4 + dz * 0.4;
    for (let k = 0; k <= 3; k++) { const t = k / 3, bend = lean * t * t, x = ox + dx * bend, z = oz + dz * bend, y = h * t * (1 - 0.3 * lean * t), ww = w * (1 - 0.8 * t);
      if (t < 0.5) c.copy(cR).lerp(cM, t * 2); else c.copy(cM).lerp(cT, (t - 0.5) * 2 * tipK); if (isDry) c.lerp(dry, 0.6 * t); c.multiplyScalar(shade);
      if (k < 3) { vtx(x - px * ww, y, z - pz * ww, nx, 1, nz, c); vtx(x + px * ww, y, z + pz * ww, nx, 1, nz, c); } else vtx(x, y, z, nx, 1, nz, c); }
    for (let k = 0; k < 2; k++) { const i = v0 + 2 * k; I.push(i, i + 1, i + 3, i, i + 3, i + 2); } I.push(v0 + 4, v0 + 5, v0 + 6);
  }
  // flowers: a stalk and a head per kind (poppy, daisy, lupine, buttercup), above the blades
  const FL = S().flowers, stalkC = new THREE.Color(G.mid).multiplyScalar(0.8), hc = new THREE.Color(), cc = new THREE.Color();
  for (const kind of flowers || []) {
    const a = r() * 2 * PI, rad = 0.05 + 0.25 * Math.sqrt(r()), x0 = Math.cos(a) * rad, z0 = Math.sin(a) * rad, H = FL.height[0] + (FL.height[1] - FL.height[0]) * r(), tx = x0 + (r() - 0.5) * 0.15, tz = z0 + (r() - 0.5) * 0.15, sw = 0.012;
    { const v0 = P.length / 3; vtx(x0 - sw, 0, z0, 0, 1, 0, cR); vtx(x0 + sw, 0, z0, 0, 1, 0, cR); vtx(tx - sw * 0.6, H, tz, 0, 1, 0, stalkC); vtx(tx + sw * 0.6, H, tz, 0, 1, 0, stalkC); I.push(v0, v0 + 1, v0 + 3, v0, v0 + 3, v0 + 2);
      const v1 = P.length / 3; vtx(x0, 0, z0 - sw, 0, 1, 0, cR); vtx(x0, 0, z0 + sw, 0, 1, 0, cR); vtx(tx, H, tz - sw * 0.6, 0, 1, 0, stalkC); vtx(tx, H, tz + sw * 0.6, 0, 1, 0, stalkC); I.push(v1, v1 + 1, v1 + 3, v1, v1 + 3, v1 + 2); }
    hc.set(FL.colours[kind]).offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.08);
    // a flat or cupped star of petals facing up (tilted a little); np petals, radius R, cup = rise of the petal tips
    const star = (np, R, inner, cup, col, centre, cR2) => { const ty = (r() - 0.5) * 0.5, tw = (r() - 0.5) * 0.5, ctr = vtx(tx, H, tz, ty, 1, tw, col.clone().multiplyScalar(0.8)), off = r() * 2 * PI;
      for (let k = 0; k < np; k++) { const a0 = off + k / np * 2 * PI, a1 = a0 + PI / np, a2 = a0 - PI / np, y = (rr) => H + cup * rr / R + (Math.cos(a0) * ty + Math.sin(a0) * tw) * rr * 0.5;
        const t = vtx(tx + Math.cos(a0) * R, y(R), tz + Math.sin(a0) * R, ty, 1, tw, col), l = vtx(tx + Math.cos(a1) * inner, y(inner), tz + Math.sin(a1) * inner, ty, 1, tw, col), rr = vtx(tx + Math.cos(a2) * inner, y(inner), tz + Math.sin(a2) * inner, ty, 1, tw, col); I.push(ctr, rr, t, ctr, t, l); }
      if (centre) { const c0 = vtx(tx, H + 0.012 + cup * 0.3, tz, 0, 1, 0, centre); for (let k = 0; k < 6; k++) { const a0 = k / 6 * 2 * PI, a1 = (k + 1) / 6 * 2 * PI; const p0 = vtx(tx + Math.cos(a0) * cR2, H + 0.006 + cup * 0.3, tz + Math.sin(a0) * cR2, 0, 1, 0, centre), p1 = vtx(tx + Math.cos(a1) * cR2, H + 0.006 + cup * 0.3, tz + Math.sin(a1) * cR2, 0, 1, 0, centre); I.push(c0, p1, p0); } } };
    if (kind === 'daisy') star(11, FL.size * 0.95, FL.size * 0.16, 0.01, hc, cc.set(FL.colours.eye), FL.size * 0.26);
    else if (kind === 'poppy') star(5, FL.size * 1.15, FL.size * 0.55, FL.size * 0.5, hc, cc.set(0x2a1c18), FL.size * 0.2);
    else if (kind === 'buttercup') star(5, FL.size * 0.75, FL.size * 0.4, FL.size * 0.3, hc, cc.set(0xd8b020), FL.size * 0.18);
    else { const n = 8; for (let k = 0; k < n; k++) { const t = k / n, y = H - 0.32 + t * 0.36, s2 = 0.05 * (1 - 0.6 * t), bc = hc.clone().offsetHSL(0, 0, 0.12 * t), cy = vtx(tx, y + s2 * 1.4, tz, 0, 1, 0, bc.clone().offsetHSL(0, 0, 0.06)), cb = vtx(tx, y - s2 * 0.6, tz, 0, -0.2, 0, bc.clone().multiplyScalar(0.7)), off = k * 0.9, ring = [];
        for (let q = 0; q < 4; q++) { const aa = off + q * PI / 2; ring.push(vtx(tx + Math.cos(aa) * s2, y, tz + Math.sin(aa) * s2, Math.cos(aa), 0.6, Math.sin(aa), bc)); } for (let q = 0; q < 4; q++) { const i0 = ring[q], i1 = ring[(q + 1) % 4]; I.push(cy, i1, i0, cb, i0, i1); } } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g;
}
// the clump kinds: plain grass and three wildflower mixes (warm, cool, white), each in a near (full) and a far (fewer blades) geometry
let GEOS = null;
function clumpGeos() {
  if (GEOS) return GEOS; const G = S().grass, F = S().flowers.mixes, near = [], far = [];
  ['grass', 'warm', 'cool', 'white'].forEach((k, i) => { const fl = k === 'grass' ? [] : F[k]; near.push(clumpGeo(G.blades, 101 + i * 7, fl)); far.push(clumpGeo(G.bladesFar, 101 + i * 7, fl)); });
  for (const g of [...near, ...far]) g.userData.keep = true;
  return (GEOS = { near, far });
}
// a meadow over a rectangle: o = { x0, z0, x1, z1, seed, density(x, z) -> clumps per m2, height(x, z) -> metres, flower(x, z) -> share of clumps in flower }
// (Nov 20, the title's frames of 200-260 ms: the base's whole lawn was one part of its sliced build) meadowIter stops after each chunk; the
// grass is the same (the same random numbers in the same order); meadow() runs it to the end at once
function meadow(parent, o) { const it = meadowIter(parent, o); let x = it.next(); while (!x.done) x = it.next(); return x.value; }
function* meadowIter(parent, o) {
  const G = S().grass, geos = clumpGeos(), mat = o.mat, cell = o.chunk || G.chunk, r = rng(o.seed), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), cool = new THREE.Color(G.patchCool), warm = new THREE.Color(G.patchWarm);
  let n = 0, tris = 0, draws = 0;
  let first = true; for (let cx = o.x0; cx < o.x1; cx += cell) { for (let cz = o.z0; cz < o.z1; cz += cell) { if (!first) yield; first = false;
    const mx = cx + cell / 2, mz = cz + cell / 2, lists = [[], [], [], []], cols = [[], [], [], []], maxD = o.maxD || G.density;
    for (let k = 0, m = Math.round(cell * cell * maxD); k < m; k++) { const x = cx + r() * cell, z = cz + r() * cell, dn = o.density(x, z); if (dn <= 0 || r() * maxD > dn) continue;
      const fz = o.flower ? o.flower(x, z) : 0, patch = fbm(x * 0.07 + 11, z * 0.07 - 4); let kind = 0;
      if (r() < fz) { const pk = fbm(x * 0.11 - 7, z * 0.11 + 2); kind = pk < 0.42 ? 1 : pk < 0.58 ? 3 : 2; }
      const h = o.height(x, z) * (0.75 + 0.5 * r()), wd = h * (0.9 + 0.5 * r()) * (o.width ? o.width(x, z) : G.spread); e.set((r() - 0.5) * 0.25, r() * 2 * PI, (r() - 0.5) * 0.25); q.setFromEuler(e); m4.compose(V(x - mx, 0, z - mz), q, V(wd, h, wd)); lists[kind].push(...m4.elements);
      if (kind === 0) col.copy(cool).lerp(warm, Math.max(0, Math.min(1, (patch - 0.3) * 2.2))).multiplyScalar(0.92 + 0.16 * r()); else col.setScalar(0.94 + 0.12 * r()); cols[kind].push(col.r, col.g, col.b); n++; }
    // at most two flower kinds per chunk (one draw each): the rarer kinds take the colour of the chunk's commonest
    { const order = [1, 2, 3].sort((x, y) => lists[y].length - lists[x].length); for (const k of order.slice(2)) { lists[order[0]].push(...lists[k]); cols[order[0]].push(...cols[k]); lists[k] = []; cols[k] = []; } }
    if (!lists.some((l) => l.length)) continue;
    const lod = new THREE.LOD(), nearG = new THREE.Group(), farG = new THREE.Group(); lod.position.set(mx, o.y || 0, mz);
    lists.forEach((l, k) => { if (!l.length) return; const cnt = l.length / 16, a = new THREE.InstancedMesh(geos.near[k], mat, cnt); a.instanceMatrix.array.set(l); a.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cols[k]), 3); a.computeBoundingSphere();
      const b2 = new THREE.InstancedMesh(geos.far[k], mat, cnt); b2.instanceMatrix = a.instanceMatrix; b2.instanceColor = a.instanceColor; b2.computeBoundingSphere();
      for (const im of [a, b2]) { im.userData.noAO = true; im.userData.scenery = true; im.castShadow = false; im.receiveShadow = true; im.onBeforeRender = tick; }
      nearG.add(a); farG.add(b2); tris += cnt * geos.near[k].index.count / 3; draws++; });
    lod.addLevel(nearG, 0); lod.addLevel(farG, o.near || G.near); lod.addLevel(new THREE.Object3D(), o.far || G.far); parent.add(lod);
  } }
  return { n, tris, draws };
}
// free the instance buffers (three keeps them until the mesh itself is disposed) when the scenery leaves the scene
// single clumps at chosen spots (no chunks): items = [x, z, height, kind (0 grass, 1 warm, 2 cool, 3 white flowers)]; one draw per kind used
function scatter(parent, items, mat, r, y) {
  const geos = clumpGeos(), lists = [[], [], [], []], cl = [[], [], [], []], c = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const [x, z, h, k] of items) { m4.compose(V(x, y || 0, z), q.setFromAxisAngle(UP, r() * 6.28), V(h * (0.9 + 0.4 * r()), h, h * (0.9 + 0.4 * r()))); lists[k].push(...m4.elements); c.setScalar(0.9 + 0.2 * r()); cl[k].push(c.r, c.g, c.b); }
  let n = 0; lists.forEach((l, k) => { if (!l.length) return; const im = new THREE.InstancedMesh(geos.near[k], mat, l.length / 16); im.instanceMatrix.array.set(l); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cl[k]), 3); im.computeBoundingSphere(); im.userData.noAO = true; im.castShadow = false; im.receiveShadow = true; im.onBeforeRender = tick; parent.add(im); n += l.length / 16; });
  return n;
}
function freeOnRemove(grp) { grp.addEventListener('removed', () => grp.traverse((o) => { if (o.isInstancedMesh) o.dispose(); })); }

// ---------------------------------------------------------------- the far world: hills, woods, the old settlement's roofs, bloom-tech solar masts
// ring between an inner ellipse (rx, rz) and depth metres further out; heights rise to wooded hilltops. haze: colour the far rows fade to (baked, so it works without fog).
function horizon(parent, o) {
  const H = S().horizon, r = rng(o.seed), seg = 160, rows = 7, P = [], C = [], I = [], near = new THREE.Color(H.near), far = new THREE.Color(H.far), field = new THREE.Color(H.field), haze = new THREE.Color(o.haze), c = new THREE.Color();
  const hAt = (a, t) => { const n = fbm(Math.cos(a) * 3 + 7, Math.sin(a) * 3 - 2), ridge = Math.sin(t * PI * 0.9) * (0.55 + 0.45 * n); return -0.6 + (o.height[0] + (o.height[1] - o.height[0]) * n) * Math.pow(t, 0.8) * (0.6 + 0.6 * ridge); };
  const ptAt = (a, t) => { const k = 1 + t * o.depth / Math.max(o.rx, o.rz); return [Math.cos(a) * o.rx * k, hAt(a, t), Math.sin(a) * o.rz * k]; };
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= seg; i++) { const a = i / seg * 2 * PI, t = j / rows, p = ptAt(a, t); P.push(p[0] + o.cx, p[1], p[2] + o.cz); const f = fbm(Math.cos(a) * 9, Math.sin(a) * 9 + t * 3); c.copy(near).lerp(far, f * 0.6); if (fbm(Math.cos(a) * 31, Math.sin(a) * 31 + t * 9) > 0.55) c.lerp(field, 0.5); c.lerp(haze, Math.min(1, t * o.hazeK)); C.push(c.r, c.g, c.b); }
  for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; I.push(a, a + 1, b, a + 1, b + 1, b); }
  const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ge.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); ge.setIndex(I); ge.computeVertexNormals();
  const mat = nightMat(solidMat(1, { fog: o.fog })), hill = new THREE.Mesh(ge, mat); hill.receiveShadow = false; hill.userData.scenery = true; hill.onBeforeRender = tick; parent.add(hill);
  // woods: round far trees (a few lobes each, no single leaves) in clusters along the hills
  const ft = new THREE.BufferGeometry(), FP = [], FN = [], FC = [], ico = new THREE.IcosahedronGeometry(1, 1), IP = ico.attributes.position, top = new THREE.Color(H.treeTop), shd = new THREE.Color(H.treeShade), sunD = V(-0.5, 0.7, -0.4).normalize();
  for (const [lx, ly, lz, lr] of [[0, 1.9, 0, 1.05], [0.6, 1.6, 0.2, 0.75], [-0.55, 1.55, -0.25, 0.75], [0.1, 2.5, -0.1, 0.65], [-0.15, 1.5, 0.6, 0.7]]) for (let i = 0; i < IP.count; i++) { const d = V(IP.getX(i), IP.getY(i), IP.getZ(i)), p = V(lx + d.x * lr, ly + d.y * lr, lz + d.z * lr), nn = p.clone().sub(V(0, 1.9, 0)).normalize().add(d).normalize(); FP.push(p.x, p.y, p.z); FN.push(nn.x, nn.y, nn.z); const t = Math.max(0, Math.min(1, 0.55 * Math.max(0, nn.dot(sunD)) + 0.3 * (nn.y * 0.5 + 0.5) + 0.1)); c.copy(shd).lerp(top, t); FC.push(c.r, c.g, c.b); }
  ft.setAttribute('position', new THREE.Float32BufferAttribute(FP, 3)); ft.setAttribute('normal', new THREE.Float32BufferAttribute(FN, 3)); ft.setAttribute('color', new THREE.Float32BufferAttribute(FC, 3)); ico.dispose();
  const list = [], cl = []; for (let k = 0; k < o.trees; k++) { const a = r() * 2 * PI, t = H.woodsFrom + (0.9 - H.woodsFrom) * Math.pow(r(), 1.2); if (fbm(Math.cos(a) * 5 + 3, Math.sin(a) * 5) < 0.42 && r() < 0.7) continue; const p = ptAt(a, t), s = (H.woodsSize[0] + (H.woodsSize[1] - H.woodsSize[0]) * r()) * (1 + t);
    list.push(new THREE.Matrix4().compose(V(p[0] + o.cx, p[1] - 0.4, p[2] + o.cz), new THREE.Quaternion().setFromAxisAngle(UP, r() * 6), V(s, s * (0.85 + 0.4 * r()), s))); c.setScalar(0.85 + 0.25 * r()).lerp(haze, Math.min(0.85, t * o.hazeK * 0.9)); cl.push(c.r, c.g, c.b); }
  // LAG FIX Nov 19: the far trees go into CONFIG.lag.woodsSectors slices round the ring (one instanced mesh each, same trees), so the slices behind you are culled
  { const NS = (CONFIG.lag && CONFIG.lag.woodsSectors) || 1, wm = nightMat(solidMat(1, { fog: o.fog })), sec = Array.from({ length: NS }, () => []), pv = new THREE.Vector3();
    list.forEach((m, i) => { pv.setFromMatrixPosition(m); const a = Math.atan2(pv.z - o.cz, pv.x - o.cx) + PI; sec[Math.min(NS - 1, Math.floor(a / (2 * PI) * NS))].push(i); });
    for (const ids of sec) { if (!ids.length) continue; const woods = new THREE.InstancedMesh(ft, wm, ids.length), cc = new Float32Array(ids.length * 3); ids.forEach((id, j) => { woods.setMatrixAt(j, list[id]); cc[3 * j] = cl[3 * id]; cc[3 * j + 1] = cl[3 * id + 1]; cc[3 * j + 2] = cl[3 * id + 2]; });
      woods.instanceColor = new THREE.InstancedBufferAttribute(cc, 3); woods.computeBoundingSphere(); woods.userData.scenery = true; woods.onBeforeRender = tick; parent.add(woods); } }
  let tris = I.length / 3 + list.length * FP.length / 9;
  // the old settlement's roofs on one side (walls faded, tiles and slates, some roofs open), and the bloom-tech solar masts on the hilltops
  const bk = Bake(400), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), wall = new THREE.Color(), roof = new THREE.Color(), box = new THREE.BoxGeometry(1, 1, 1), pr = new THREE.CylinderGeometry(0.71, 0.71, 1, 3, 1); pr.rotateZ(PI / 2); pr.rotateX(PI / 6);
  for (let k = 0; k < o.roofs; k++) { const a = o.roofAt + (r() - 0.5) * H.roofSpread, t = 0.05 + 0.2 * r(), p = ptAt(a, t), w = 6 + 4 * r(), d = 5 + 3 * r(), hh = 4 + 4 * r(), yaw = a + PI / 2 + (r() - 0.5) * 0.3, X = p[0] + o.cx, Z = p[2] + o.cz, Y = p[1] - 0.5; q.setFromAxisAngle(UP, yaw);
    wall.set(H.walls[k % H.walls.length]).lerp(haze, Math.min(0.8, t * o.hazeK)); roof.set(H.roofs[k % H.roofs.length]).lerp(haze, Math.min(0.75, t * o.hazeK));
    m4.compose(V(X, Y + hh / 2, Z), q, V(w, hh, d)); bk.geo(box, m4, wall, X, Z); if (r() < 0.8) { m4.compose(V(X, Y + hh + d * 0.28, Z), q, V(w * 1.04, d * 0.56, d * 1.08)); bk.geo(pr, m4, roof, X, Z); } }
  for (let k = 0; k < o.masts; k++) { const a = o.mastAt + (k - (o.masts - 1) / 2) * H.mastGap + (r() - 0.5) * 0.1, p = ptAt(a, 0.45 + 0.2 * r()), X = p[0] + o.cx, Z = p[2] + o.cz, Y = p[1] - 0.5, hh = H.mast * (0.8 + 0.4 * r());
    const st = new THREE.LatheGeometry([[0, 0], [1.4, 0.1], [0.9, 1.0], [0.55, hh * 0.3], [0.4, hh * 0.85], [0.7, hh]].map((v) => new THREE.Vector2(v[0], v[1])), 10); m4.makeTranslation(X, Y, Z); bk.geo(st, m4, wall.set(0xf2ecdc).lerp(haze, 0.35), X, Z); st.dispose();
    const pet = new THREE.SphereGeometry(1, 8, 4); for (let j = 0; j < 6; j++) { const aa = j / 6 * 2 * PI; q.setFromEuler(new THREE.Euler(0.9, aa, 0, 'YXZ')); m4.compose(V(X + Math.cos(aa) * 2.2, Y + hh + 0.6, Z - Math.sin(aa) * 2.2), q, V(1.3, 0.12, 2.6)); bk.geo(pet, m4, roof.set(H.cell).lerp(haze, 0.3), X, Z); } pet.dispose(); }
  tris += bk.meshes(nightMat(solidMat(0.7, { fog: o.fog })), parent, { tick: true }); box.dispose(); pr.dispose();
  return tris;
}

// ---------------------------------------------------------------- THE BASE
// o: { g (the base group), scene, sky, sun (DirectionalLight), ground, pond, ST (stations), CATS (cat cover spots), HOME, bound, obst, keepOut(x, z) (base water and life: no grass there), hedge (ring radius, m) }
// (H round 2, the title's 930 ms frame: the base's scenery was one part of its sliced build) baseSceneryIter stops (yield) between its parts; baseScenery runs it at once
export function baseScenery(o) { const it = baseSceneryIter(o); for (;;) { const q = it.next(); if (q.done) return q.value; } }
export function* baseSceneryIter(o) {
  const C = S(), B = C.base, grp = new THREE.Group(), r = rng(B.seed), sun = o.sun.position.clone().normalize(), HEDGE = o.hedge || B.hedge, KO = o.keepOut || (() => false); grp.userData.scenery = true; o.g.add(grp); freeOnRemove(grp);
  const stat = { meadow: 0, flowers: 0, leafTris: 0, far: 0 };
  // light, haze, sky
  o.sun.color.setHex(C.sun[0]); o.sun.intensity = C.sun[1]; o.scene.fog = new THREE.Fog(B.fog[0], B.fog[1], B.fog[2]); if (o.sky) o.sky.set(0, 0, new THREE.Color(C.sky.horizon));
  yield;
  if (o.ground) { o.ground.material.color.setHex(B.ground); stat.ground = mottle(o.ground, 120, 120, 0); }
  // the paved plaza shrinks to a circle round the solar tree; the rest of it becomes short lawn and flowers (walking is unchanged: paving and lawn are only pictures)
  if (o.plaza && B.paved < 12) { o.plaza.geometry.dispose(); o.plaza.geometry = new THREE.CircleGeometry(B.paved, 48); if (o.plaza.material.map) o.plaza.material.map.repeat.multiplyScalar(B.paved / 12); }
  // where things may grow: off the plaza, off the paths, clear of buildings, devices, the pond and the hidden cats' spots
  const ST = o.ST, lines = [...Object.values(ST).map((s) => [s.x * 0.8, s.z * 0.8]), [0, -7.4], [0, 14]];
  const pathD = (x, z) => Math.min(...lines.map(([ex, ez]) => { const l2 = ex * ex + ez * ez, t = Math.max(0, Math.min(1, (x * ex + z * ez) / l2)); return Math.hypot(x - ex * t, z - ez * t); }));
  const keepOff = [...o.CATS.map((c) => [c.x, c.z, 1.6]), ...o.CATS.map((c) => { const d = Math.hypot(c.x, c.z) || 1; return [c.x + c.x / d * 1.2, c.z + c.z / d * 1.2, 1.0]; }), [ST.board.x, ST.board.z, 2.4], [-4, 12, 2.9]];
  // o.rooms: rooms you walk into (src/rooms.js; Marla's house is not a station): no grass inside them or against their walls
  const inRoomRect = (x, z) => (o.rooms || []).some((I) => { const dx = x - I.x, dz = z - I.z, lx = dx * Math.cos(I.ry) - dz * Math.sin(I.ry), lz = dx * Math.sin(I.ry) + dz * Math.cos(I.ry); return Math.abs(lx) < I.w / 2 + 0.6 && Math.abs(lz) < I.d / 2 + 0.5; });
  const inRect = (x, z) => Object.values(ST).some((s) => s !== ST.board && Math.abs(x - s.x) < 3.6 && Math.abs(z - s.z) < 2.5) || (Math.abs(x - o.HOME.x) < 3.8 && Math.abs(z - o.HOME.z) < 2.8) || inRoomRect(x, z);
  const dens = (x, z) => { const R = Math.hypot(x, z); if (R < B.paved + 0.4) return 0; if (inRect(x, z) || KO(x, z) || keepOff.some(([a, b, rr]) => Math.hypot(x - a, z - b) < rr)) return 0; const pd = pathD(x, z); if (pd < 1.0) return 0; let d = C.grass.density * (pd < 1.3 ? 0.7 : 1); if (R < B.plaza) d *= B.lawnDensity; return R > HEDGE + 1 ? d * B.outside : d; };
  const height = (x, z) => { const R = Math.hypot(x, z); if (R < B.plaza) return B.lawn * (0.85 + 0.4 * fbm(x * 0.12, z * 0.12)); return R > HEDGE + 1 ? B.tallOut * (0.8 + 0.5 * fbm(x * 0.05, z * 0.05)) : B.tall * (0.85 + 0.4 * fbm(x * 0.09 + 3, z * 0.09)); };
  const flower = (x, z) => { const R = Math.hypot(x, z), drift = fbm(x * 0.06 - 9, z * 0.06 + 4); return Math.max(0, Math.min(1, (R > HEDGE + 1 ? B.flowersOut : B.flowersIn) * (0.4 + 1.4 * drift))); };
  const grassMat = plantMat(C.grass.sway);
  // (owner Nov 22, z-fighting: zfightlist run 45005110419 named the meadow chunks' blade feet, at y 0, against the base lawn in far views) the blades' depth is pulled
  // a little toward the eye (CONFIG.lag.plants.bias; GL state only, no new shader), so a blade foot on the ground always draws over it
  { const B = CONFIG.lag && CONFIG.lag.plants && CONFIG.lag.plants.bias; if (B) { grassMat.polygonOffset = true; grassMat.polygonOffsetFactor = B[0]; grassMat.polygonOffsetUnits = B[1]; } }
  yield;
  const m1 = yield* meadowIter(grp, { width: (x, z) => (Math.hypot(x, z) < B.plaza ? B.lawnSpread : C.grass.spread), maxD: C.grass.density * Math.max(1, B.lawnDensity), x0: -B.meadowR, z0: -B.meadowR, x1: B.meadowR, z1: B.meadowR, seed: B.seed + 1, density: (x, z) => (Math.hypot(x, z) > B.meadowR ? 0 : dens(x, z)), height, flower, mat: grassMat });
  stat.meadow = m1.n; stat.grassTris = m1.tris; stat.grassDraws = m1.draws;
  // leaf masses: hedge ring, trees, shrubs at the station walls, orchard and wood outside the hedge
  yield;
  const fol = Bake(B.cell), bark = Bake(B.cell), P = C.palettes;
  { const n = Math.round(2 * PI * HEDGE / B.hedgeStep); for (let k = 0; k < n; k++) { yield; const a = k / n * 2 * PI + (r() - 0.5) * 0.04, R = HEDGE + (r() - 0.5) * 0.3, x = Math.cos(a) * R, z = Math.sin(a) * R, h = B.hedgeH * (0.85 + 0.3 * r()); if (KO(x, z)) continue;
    blob(fol, V(x, h * 0.55, z), B.hedgeStep * 0.85, h * 0.55, 0.75, { r, sun, pal: P.hedge, leaf: C.foliage.hedgeLeaf, lower: 0.2 }); } }
  yield;
  for (const t of o.trees || []) { yield; tree(bark, fol, t.x, t.z, { r, h: 2.6 * t.s, R: 2.3 * t.s, lean: 0.6 * t.s, pal: P.tree[Math.floor(r() * P.tree.length)], sun, blobs: 8 }); }
  // shrubs along each station's back wall; a room turned round (the workshop faces the plaza since Nov 17) has its back on the other side
  const backZ = (s) => { const I = (o.rooms || []).find((q) => Math.abs(q.x - s.x) < 0.1 && Math.abs(q.z - s.z) < 0.1); return s.z - 2.35 * (I ? Math.cos(I.ry) : 1); };
  yield;
  for (const s of [ST.storage, ST.workshop, ST.garden]) { yield; for (let k = -2; k <= 2; k++) blob(fol, V(s.x + k * 0.95 + (r() - 0.5) * 0.3, 0.45, backZ(s)), 0.55, 0.5, 0.45, { r, sun, pal: P.shrub[k & 1], leaf: C.foliage.shrubLeaf, lower: 0.2 });
    if (s !== ST.garden) for (const sx of [-1, 1]) for (const dz of [-0.9, 0.2]) blob(fol, V(s.x + sx * 2.75, 0.42, s.z + dz), 0.42, 0.45, 0.5, { r, sun, pal: P.shrub[(sx + 1) / 2], leaf: C.foliage.shrubLeaf, lower: 0.2 }); }
  // outside the hedge: orchards and woods (our own farmland), sunflower fields stand in the meadow there as their own clumps
  yield;
  for (let k = 0, placed = 0; k < 400 && placed < B.outTrees; k++) { const a = r() * 2 * PI, R = HEDGE + 4 + Math.pow(r(), 0.8) * (B.meadowR - HEDGE - 6), x = Math.cos(a) * R, z = Math.sin(a) * R; if (fbm(x * 0.05 + 2, z * 0.05) < 0.45) continue; placed++; if (placed % 3 === 0) yield;
    const s = 0.8 + 0.6 * r(); tree(bark, fol, x, z, { r, h: 1.3 * s + 0.5, R: 2.3 * s, lean: 0.7, pal: P.tree[Math.floor(r() * P.tree.length)], sun, blobs: 8, leaf: C.foliage.leaf * 1.4, cover: C.foliage.cover * 0.9 }); }
  // borders: both edges of every path are planted (taller flowering clumps, a low shrub now and then), so a path runs between beds, never across bare lawn; the paths stay clear
  yield;
  const border = [];
  for (const [ex, ez] of lines) { yield; const L = Math.hypot(ex, ez), ux = ex / L, uz = ez / L; for (let t = B.paved + 0.9; t < L + 1.5; t += B.borderStep * (0.7 + 0.6 * r())) for (const sd of [-1, 1]) {
    const off = B.borderOff + r() * 0.4, x = ux * t - uz * off * sd, z = uz * t + ux * off * sd; if (dens(x, z) <= 0) continue;
    if (r() < B.borderShrub) blob(fol, V(x - uz * sd * 0.25, 0.32, z + ux * sd * 0.25), 0.42, 0.36, 0.42, { r, sun, pal: P.shrub[Math.floor(r() * 2)], leaf: C.foliage.shrubLeaf, lower: 0.2 });
    else border.push([x, z, B.borderH * (0.7 + 0.6 * r()), r() < 0.2 ? 0 : 1 + Math.floor(fbm(x * 0.2, z * 0.2) * 3)]); } }
  yield;
  stat.border = scatter(grp, border, grassMat, r);
  yield;
  stat.leafTris = fol.meshes(leafMat(), grp, { cast: true, tick: true }); stat.barkTris = bark.meshes(solidMat(0.9), grp, { cast: true });
  // sunflowers: tall stalks with a gold head, in drifts in the farmland outside the hedge
  yield;
  stat.sunflowers = sunflowers(grp, r, (x, z) => { const R = Math.hypot(x, z); return R > HEDGE + 2.5 && R < B.meadowR - 2 && fbm(x * 0.045 + 21, z * 0.045 - 5) > B.sunDrift; }, B.meadowR, B.sunflowers);
  // flower collars at the foot of the plaza lanterns and round the solar tree in the middle (low, so walking past them reads right)
  yield;
  { const items = []; for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2 + 0.3, lx = Math.cos(a) * 11.5, lz = Math.sin(a) * 11.5; if (Math.hypot(lx - ST.board.x, lz - ST.board.z) < 2.4) continue; for (let j = 0; j < B.collar; j++) { const b = j / B.collar * 2 * PI + r(), d = 0.3 + 0.35 * r(); items.push([lx + Math.cos(b) * d, lz + Math.sin(b) * d, 0.32 + 0.15 * r(), j % 3 ? 1 + (k % 3) : 0]); } }
    for (let j = 0; j < B.collar * 3; j++) { const b = j / (B.collar * 3) * 2 * PI + r() * 0.3, d = 0.75 + 0.5 * r(); items.push([Math.cos(b) * d, Math.sin(b) * d, 0.3 + 0.2 * r(), j % 2 ? 1 + (j % 3) : 0]); }
    stat.collars = scatter(grp, items, grassMat, r); }
  // the pond: clear water with a soft ripple and sky reflection, reeds and stones round its edge
  yield;
  if (o.pond) stat.pond = pond(grp, o.pond, r, sun);
  // the far world
  yield;
  stat.far = horizon(grp, { seed: B.seed + 9, cx: 0, cz: 0, rx: B.farR, rz: B.farR, depth: B.farDepth, height: B.farH, haze: C.sky.horizon, hazeK: 1.1, fog: true, trees: B.farTrees, roofs: B.roofs, roofAt: B.roofAt, masts: B.masts, mastAt: B.mastAt });
  grp.traverse((q) => { q.userData.scenery = true; });
  grp.userData.stat = stat; window.__scenery = { where: 'base', stat, grp };
  // (Nov 20) the base's still scenery meshes joined as the street's are (CONFIG.lag.sceneryJoin)
  if (CONFIG.lag && CONFIG.lag.sceneryJoin) { yield; yield* joinCellsIter(grp, CONFIG.lag.sceneryJoin); }
  return grp;
}
// sunflowers as one instanced geometry (stalk, two leaves, ring of petals, dark seed disc) facing the sun
function sunflowers(parent, r, ok, R, n) {
  const P = [], N = [], C = [], I = [], vt = (x, y, z, nx, ny, nz, c) => { P.push(x, y, z); N.push(nx, ny, nz); C.push(c.r, c.g, c.b); return P.length / 3 - 1; }, gs = new THREE.Color(0x3f6a26), gl = new THREE.Color(0x6a9a34), pe = new THREE.Color(S().flowers.colours.sun), dk = new THREE.Color(0x3a2414);
  { const a = vt(-0.025, 0, 0, 0, 0.3, 1, gs), b = vt(0.025, 0, 0, 0, 0.3, 1, gs), c = vt(-0.018, 1.0, 0, 0, 0.3, 1, gl), d = vt(0.018, 1.0, 0, 0, 0.3, 1, gl); I.push(a, b, d, a, d, c); const e = vt(0, 0, -0.025, 1, 0.3, 0, gs), f = vt(0, 0, 0.025, 1, 0.3, 0, gs), g = vt(0, 1.0, -0.018, 1, 0.3, 0, gl), h = vt(0, 1.0, 0.018, 1, 0.3, 0, gl); I.push(e, f, h, e, h, g); }
  for (const [y, s] of [[0.45, 1], [0.7, -1]]) { const a = vt(0, y, 0, 0, 1, 0, gs), b = vt(s * 0.12, y + 0.06, 0.07, 0, 1, 0.2, gl), c = vt(s * 0.24, y + 0.02, 0, 0, 1, 0, gl), d = vt(s * 0.12, y + 0.06, -0.07, 0, 1, -0.2, gl); I.push(a, b, c, a, c, d); }
  const cy = 1.02, ctr = vt(0, cy, 0.03, 0, 0.2, 1, dk); for (let k = 0; k < 10; k++) { const a0 = k / 10 * 2 * PI, a1 = (k + 1) / 10 * 2 * PI; I.push(ctr, vt(Math.cos(a0) * 0.07, cy + Math.sin(a0) * 0.07, 0.02, 0, 0.2, 1, dk), vt(Math.cos(a1) * 0.07, cy + Math.sin(a1) * 0.07, 0.02, 0, 0.2, 1, dk)); }
  for (let k = 0; k < 16; k++) { const a0 = k / 16 * 2 * PI, l = vt(Math.cos(a0 - 0.18) * 0.065, cy + Math.sin(a0 - 0.18) * 0.065, 0.015, 0, 0.2, 1, pe), rr = vt(Math.cos(a0 + 0.18) * 0.065, cy + Math.sin(a0 + 0.18) * 0.065, 0.015, 0, 0.2, 1, pe), t = vt(Math.cos(a0) * 0.16, cy + Math.sin(a0) * 0.16, 0.0, 0, 0.2, 1, pe); I.push(l, rr, t); }
  const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ge.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); ge.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); ge.setIndex(I);
  const list = [], cl = [], c = new THREE.Color(); for (let k = 0; k < n * 6 && list.length < n; k++) { const x = (r() * 2 - 1) * R, z = (r() * 2 - 1) * R; if (!ok(x, z)) continue; const s = 1.5 + 0.7 * r(); list.push(new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.15, Math.atan2(-x, -z) + (r() - 0.5) * 0.7, 0, 'YXZ')), V(s, s, s))); c.setScalar(0.9 + 0.2 * r()); cl.push(c.r, c.g, c.b); }
  if (!list.length) return 0; const im = new THREE.InstancedMesh(ge, plantMat(S().grass.sway * 0.5), list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cl), 3); im.computeBoundingSphere(); im.userData.noAO = true; im.userData.scenery = true; im.onBeforeRender = tick; parent.add(im);
  return list.length;
}
// the pond: water surface with a moving ripple (relief picture made here), a ring of stones, reeds at the edge
function pond(parent, p, r, sun) {
  const W = S().water, cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), img = x.createImageData(128, 128);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) { const h = (u, v) => Math.sin(u * 0.19 + Math.sin(v * 0.07) * 2) + Math.sin(v * 0.23 + Math.sin(u * 0.09) * 1.5) * 0.7 + Math.sin((u + v) * 0.31) * 0.3, dx = h(i + 1, j) - h(i - 1, j), dy = h(i, j + 1) - h(i, j - 1), k = (j * 128 + i) * 4; img.data[k] = 128 + dx * 40; img.data[k + 1] = 128 + dy * 40; img.data[k + 2] = 255; img.data[k + 3] = 255; }
  x.putImageData(img, 0, 0); const nt = new THREE.CanvasTexture(cv); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(3, 3);
  const m = new THREE.MeshPhysicalMaterial({ color: W.colour, roughness: W.rough, metalness: 0, normalMap: nt, normalScale: new THREE.Vector2(W.ripple, W.ripple), envMapIntensity: W.env, transparent: true, opacity: W.opacity, clearcoat: 1, clearcoatRoughness: 0.05 }); m.userData.pbr = true;
  const old = p.material; p.material = m; if (old && old.dispose) old.dispose(); p.onBeforeRender = () => { nt.offset.set(performance.now() * 0.00002, performance.now() * 0.000013); };
  const bk = Bake(50), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), st = new THREE.DodecahedronGeometry(1, 1), c = new THREE.Color(), cx = p.position.x, cz = p.position.z, R = W.radius;
  for (let k = 0; k < W.stones; k++) { const a = k / W.stones * 2 * PI + (r() - 0.5) * 0.1, rr = R + 0.05 + r() * 0.12, s = 0.13 + 0.12 * r(); q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); m4.compose(V(cx + Math.cos(a) * rr, 0.02, cz + Math.sin(a) * rr), q, V(s * 1.3, s * 0.6, s)); bk.geo(st, m4, c.set(0xb8b0a0).multiplyScalar(0.75 + 0.3 * r()).lerp(new THREE.Color(0x6a8a4a), r() < 0.3 ? 0.4 : 0), cx, cz); }
  const tris = bk.meshes(solidMat(0.95), parent, { cast: true }); st.dispose();
  // reeds: tall thin clumps (the grass clump stretched), on the edge away from the path
  const geos = clumpGeos(), list = [], cl = []; for (let k = 0; k < W.reeds; k++) { const a = PI * (0.1 + 1.1 * r()), rr = R - 0.2 + r() * 0.5, h = 1.0 + 0.6 * r(); list.push(new THREE.Matrix4().compose(V(cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr), new THREE.Quaternion().setFromAxisAngle(UP, r() * 6), V(0.35, h, 0.35))); c.set(0x9ab868).multiplyScalar(0.85 + 0.25 * r()); cl.push(c.r, c.g, c.b); }
  const im = new THREE.InstancedMesh(geos.near[0], plantMat(S().grass.sway), list.length); list.forEach((mm, i) => im.setMatrixAt(i, mm)); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cl), 3); im.computeBoundingSphere(); im.userData.noAO = true; im.onBeforeRender = tick; parent.add(im);
  return tris;
}

// ---------------------------------------------------------------- THE STREET (desolate houses stay desolate; nature takes the street back)
// o: { g (world group), run, cfg, M (world materials), sprays [[group, x, y, z, size]], free(x, z, pad), onPath(x, z), X0, RZ, inner (where the footway ends, from the road middle), tufts (crack and slab-gap weed spots) }
// (LAG FIX Nov 19, owner 13:10) streetSceneryIter stops (yield) between its parts so the film builds the street in time slices; streetScenery runs it at once
export function streetScenery(o) { const it = streetSceneryIter(o); for (;;) { const q = it.next(); if (q.done) return q.value; } }
export function* streetSceneryIter(o) {
  const C = S(), T = C.street, grp = new THREE.Group(), r = rng((o.run.seed || 1) * 7 + 99), sun = V(-0.45, 0.75, -0.5).normalize(), stat = {}; grp.userData.scenery = true; o.g.add(grp); freeOnRemove(grp);
  if (o.M.grass) o.M.grass.color.setHex(T.ground);
  // the tree and bush crowns: every leaf spray of world.js becomes a leaf cluster (the picture cards and the single leaves go)
  const dead = []; o.g.traverse((q) => { if (q.isMesh && (q.material === o.M.canopy || q.material === o.M.canopyDark)) dead.push(q); }); for (const q of dead) { q.parent.remove(q); q.geometry.dispose(); }
  o.g.updateMatrixWorld(true); const fol = Bake(T.cell), byTree = new Map(), v = new THREE.Vector3();
  // bare branches of the street crowns (bark colour, darker toward the foot)
  const brB = Bake(T.cell), bq = new THREE.Quaternion(), bm = new THREE.Matrix4(), bcol = new THREE.Color(), barkC = new THREE.Color(C.tree.bark);
  const branch = (a, b, r0, r1) => { const d = b.clone().sub(a), l = d.length(); if (l < 0.05) return; const ge = new THREE.CylinderGeometry(r1, r0, l, 5, 1); bq.setFromUnitVectors(UP, d.normalize()); bm.compose(a.clone().lerp(b, 0.5), bq, V(1, 1, 1)); brB.geo(ge, bm, bcol.copy(barkC).multiplyScalar(0.7), a.x, a.z); ge.dispose(); };
  // one tree = the sprays standing within crownJoin metres (across the ground) of the first spray of a group (a tree's limbs can be separate groups in world.js)
  for (const [p, x, y, z, s] of o.sprays) { v.set(x, y, z).applyMatrix4(p.matrixWorld); let t = null; for (const [k, l] of byTree) if (Math.hypot(k.x - v.x, k.z - v.z) < T.crownJoin) { t = l; break; } if (!t) byTree.set(v.clone(), t = []); t.push([v.clone(), s]); }
  let ti = 0; for (const [, list] of byTree) { const cc = list.reduce((a, q) => a.add(q[0]), V(0, 0, 0)).multiplyScalar(1 / list.length), cr = Math.max(1, ...list.map((q) => q[0].distanceTo(cc) + q[1] * 0.45)), pal = C.palettes.street[(ti++ * 7 + Math.floor(r() * 3)) % C.palettes.street.length];
    // a crown of separate leaf clumps with sky between them (owner's coordinator, 18:50: the round crowns read as foam balls and lollipops): every spray becomes clumpsPer
    // small clumps scattered round it, a few loose clumps hang between the sprays, and twigs, seen through the gaps, tie the clumps to the limbs
    yield;
    const clumps = [];
    for (const [c, s] of list) { const rr = s * T.sprayR; for (let k = 0; k < T.clumpsPer; k++) { const d = V(r() - 0.5, (r() - 0.5) * 0.7, r() - 0.5).normalize().multiplyScalar(rr * (0.35 + 0.75 * r())); clumps.push([c.clone().add(d), rr * T.clumpR * (0.6 + 0.6 * r()), c]); } }
    for (let k = 0, n = Math.round(list.length * T.looseClumps); k < n; k++) { const a = list[Math.floor(r() * list.length)][0], b = list[Math.floor(r() * list.length)][0], t = r(); const p = a.clone().lerp(b, t).add(V((r() - 0.5) * 1.2, (r() - 0.3) * 0.8, (r() - 0.5) * 1.2)); clumps.push([p, T.clumpR * (0.25 + 0.3 * r()), list.reduce((m, q) => (q[0].distanceTo(p) < m.distanceTo(p) ? q[0] : m), list[0][0])]); }
    // clumps: leaves through the whole clump (no solid core), so each clump is a loose leafy cluster with light through it; short twigs run from the limb end (the spray, where world.js ends a limb) out to a share of the clumps
    for (const [c, rr, at] of clumps) { yield; blob(fol, c, rr, rr * 0.7, rr, { r, crown: cc, crownR: cr, sun, pal, leaf: T.leaf, lower: 0.6, cover: C.foliage.cover * T.clumpCover, core: false, fill: true });
      if (r() < T.branchShare && at.distanceTo(c) > rr) branch(at.clone().lerp(c, -0.15), c, 0.03, 0.012); } }
  // shrubs between the houses and along the plot edges (low, below the window sills; never on a door path)
  for (let k = 0, n = 0; k < T.shrubs * 6 && n < T.shrubs; k++) { const x = (r() * 2 - 1) * (o.X0 - 4), sd = r() < 0.5 ? -1 : 1, z = sd * (o.inner + 0.8 + r() * (o.cfg.town.boundZ - 2)); if (!o.free(x, z, 1.6) || o.onPath(x, z) || (o.run.cars || []).some((c) => Math.hypot(c.x - x, c.z - z) < 3)) continue; n++;
    yield;
    const s = T.shrubSize * (0.7 + 0.6 * r()); for (let q = 0; q < 3; q++) blob(fol, V(x + (r() - 0.5) * s, s * (0.45 + 0.2 * q), z + (r() - 0.5) * s), s * (0.65 - 0.1 * q), s * 0.5, s * (0.6 - 0.1 * q), { r, sun, pal: C.palettes.shrub[q & 1], leaf: C.foliage.shrubLeaf, lower: 0.2 }); }
  // woods round the town: trees behind the plots and across both road ends (the road's own end stays open a little), larger leaves (seen from 6 m and more behind the bounds)
  // their own meshes without the street's fog (by day it hides everything past 80 m); the haze is baked into their colours by distance from the playable street instead, like the far hills
  yield;
  const bark = Bake(T.cell), wf = Bake(T.cell), BZ = o.cfg.town.boundZ, BX = o.cfg.town.boundX, WX = o.X0 + T.farGap - 2, WZ = BZ + T.farGap - 2;
  // tall (crowns 9-13 m up, so they show over the roofs), first behind the plots on both sides, then across both road ends where the street looks out
  const wood = (x, z) => { const s = 0.8 + 0.6 * r(); tree(bark, wf, x, z, { r, h: 2.2 * s + 1.0, R: 4.6 * s, lean: 1, pal: C.palettes.tree[Math.floor(r() * C.palettes.tree.length)], sun, blobs: 6, leaf: T.woodsLeaf, cover: C.foliage.cover * 0.75 }); };
  for (let k = 0, n = 0; k < T.woods * 10 && n < T.woods; k++) { const x = (r() * 2 - 1) * WX, z = (r() < 0.5 ? -1 : 1) * (BZ + 6 + r() * (WZ - BZ - 6)); if (fbm(x * 0.04 + 5, z * 0.04 - 2) < 0.3) continue; n++; wood(x, z); }
  yield;
  for (const sd of [-1, 1]) for (let k = 0, n = 0; k < T.woodsEnd * 10 && n < T.woodsEnd; k++) { const x = sd * (o.X0 + 3 + r() * (WX - o.X0 - 3)), z = (r() * 2 - 1) * (BZ + 6); if (Math.abs(z) < o.RZ + 4 && Math.abs(x) < o.X0 + T.roadOpen) continue; n++; wood(x, z); }
  yield;
  { const hz = new THREE.Color(C.sky.horizon); const haze = (cl, i, x, y, z) => { const k = Math.min(T.woodsHazeMax, T.woodsHaze * Math.hypot(Math.max(0, Math.abs(x) - BX), Math.max(0, Math.abs(z) - BZ))); cl[i] += (hz.r - cl[i]) * k; cl[i + 1] += (hz.g - cl[i + 1]) * k; cl[i + 2] += (hz.b - cl[i + 2]) * k; };
    wf.each(haze); bark.each(haze); }
  yield;
  stat.branchTris = brB.meshes(solidMat(0.9), grp, { cast: true }); stat.leafTris = fol.meshes(leafMat(), grp, { cast: true, tick: true }); stat.woodsTris = wf.meshes(leafMat({ fog: false }), grp, { cast: false, tick: true }); stat.barkTris = bark.meshes(solidMat(0.9, { fog: false }), grp, { cast: false });
  // the ground: the world's flat grass plane becomes a mottled one (patches of deep and light green and dry straw); it keeps its texture and size
  yield;
  { let gp = null; o.g.traverse((q) => { if (!gp && q.isMesh && q.material === o.M.grass && q.geometry.parameters && q.geometry.parameters.width >= 2 * o.cfg.town.boundX + 80) gp = q; });
    if (gp) stat.ground = mottle(gp, gp.geometry.parameters.width, gp.geometry.parameters.height, 5); }
  // the meadow: verges, lawns and plots in long grass and wildflowers; weeds and flowers in the footway gaps and the road cracks
  const cars = o.run.cars || [], inner = o.inner, carAt = (x, z) => cars.some((c) => Math.hypot(c.x - x, c.z - z) < T.carClear);
  const dens = (x, z) => { const az = Math.abs(z); if (carAt(x, z)) return 0; if (az < o.RZ - 0.15) return 0; if (az < inner) return C.grass.density * T.edge; if (!o.free(x, z, 0.35)) return 0; if (o.onPath(x, z)) return C.grass.density * 0.12; return C.grass.density * T.verge; };
  const height = (x, z) => { const az = Math.abs(z); return az < inner ? T.tall * 0.45 : T.tall * (0.7 + 0.6 * fbm(x * 0.06, z * 0.06)); };
  const flower = (x, z) => Math.max(0, Math.min(1, T.flowers * (0.3 + 1.5 * fbm(x * 0.05 + 13, z * 0.05 - 6))));
  yield;
  const gm = plantMat(C.grass.sway), m1 = meadow(grp, { x0: -o.X0 - 4, z0: -(o.cfg.town.boundZ + 8), x1: o.X0 + 4, z1: o.cfg.town.boundZ + 8, seed: (o.run.seed || 1) + 5, density: dens, height, flower, mat: gm, chunk: T.chunk, near: T.near, far: T.far });
  stat.meadow = m1.n; stat.grassTris = m1.tris; stat.grassDraws = m1.draws;
  // weeds and flowers in the road cracks and slab gaps (the world's own weed spots)
  yield;
  stat.cracks = scatter(grp, (o.tufts || []).filter(([x, z]) => !carAt(x, z)).map(([x, z, sz]) => [x, z, 0.15 + 0.25 * sz, r() < T.crackFlowers ? 1 + Math.floor(r() * 3) : 0]), gm, r, 0.02);
  // the far world round the town: hills and woods, more of the old town's roofs, our solar masts on the far hills (no fog: the street's day fog is short; the haze is baked)
  yield;
  stat.far = horizon(grp, { seed: (o.run.seed || 1) + 31, cx: 0, cz: 0, rx: o.X0 + T.farGap, rz: o.cfg.town.boundZ + T.farGap, depth: T.farDepth, height: T.farH, haze: C.sky.horizon, hazeK: 0.9, fog: false, trees: T.farTrees, roofs: T.roofs, roofAt: PI * 0.5, masts: T.masts, mastAt: -PI * 0.5 });
  grp.traverse((q) => { q.userData.scenery = true; });
  grp.userData.stat = stat; window.__scenery = { where: 'street', stat, grp };
  // (Nov 20, street about 580 draws a frame: some 60 small leaf, bark and wood meshes of a few hundred vertices each) the street's still scenery meshes that hang
  // straight under it are joined per material, shadow flag and CONFIG.lag.sceneryJoin cell; the pieces and their places are the same, only fewer draws
  if (CONFIG.lag && CONFIG.lag.sceneryJoin) joinCells(grp, CONFIG.lag.sceneryJoin);
  return grp;
}
