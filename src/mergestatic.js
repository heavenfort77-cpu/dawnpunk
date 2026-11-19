// LAG FIX Nov 19 (owner 07:10, night combat): fewer draw calls for the phone-tier Gloom machines (src/gloomkit.js builds each one from about a hundred small meshes).
// The pieces that never move against their parent while the machine animates are drawn as ONE mesh per parent node and material (same geometry, same place,
// same material object, so the picture and any colour change of that material are unchanged; a parent that turns or hides takes the merged mesh with it).
// See-through pieces of one material (the wear decals) are merged too when CONFIG.lag.mergeGloom.transparent is on: only their order among themselves can change.
// The original pieces stay where they were as invisible hit shapes: they move to layer HIT_LAYER, which no camera or shadow camera draws, and the aimed shot
// (src/main.js drawnHit) raycasts them exactly as before, so hits, head shots and the game rules are identical. Every number: CONFIG.lag.mergeGloom.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';

export const HIT_LAYER = 5;
export const mergeState = { machines: 0, pieces: 0, meshes: 0, failed: 0 };
try { window.__mergeStatic = mergeState; } catch (e) { /* no window */ }

// what a piece looks like against its parent: its local transform, whether it shows, its material and its parent
const keyOf = (o) => { o.updateMatrix(); return o.matrix.elements.map((v) => v.toFixed(5)).join(',') + '|' + o.visible + '|' + o.material.uuid + '|' + (o.parent ? o.parent.uuid : '') + '|' + o.renderOrder; };
const sigOf = (g) => Object.keys(g.attributes).sort().map((k) => k + g.attributes[k].itemSize + (g.attributes[k].normalized ? 'n' : '')).join(',') + (g.index ? '|i' : '|n') + (Object.keys(g.morphAttributes || {}).length ? '|m' : '');

// root: a built machine; probe(i): poses it in the i-th test state (CONFIG.lag.mergeGloom.probes of them). Returns the number of meshes drawn in place of the pieces.
// still: the pieces are known never to move (a house's floor decals): no probe poses, and see-through pieces are merged whatever the Gloom setting says
// opt (the base, owner 11:27): { transparent: merge see-through pieces too, skip(o): leave this piece alone, cell: also group by this many metres of world ground
// (so the merged meshes are still culled out of view piece by piece) }
export function mergeStatic(root, probe, still, opt) {
  const C = still ? { on: true, probes: 0, transparent: opt ? !!opt.transparent : true } : CONFIG.lag.mergeGloom; if (!C || !C.on) return 0; const wv = new THREE.Vector3();
  try {
    const leaves = [];
    root.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.children.length || !o.geometry || Array.isArray(o.material) || o.userData.blob || o.userData.mergedDraw || o.userData.hitOnly) return;
      const m = o.material; if (!m || (m.transparent && !C.transparent) || m.blending !== THREE.NormalBlending || o.morphTargetInfluences || (opt && opt.skip && opt.skip(o))) return; leaves.push(o); });
    if (leaves.length < 2) return 0;
    const k0 = leaves.map(keyOf), moving = new Set();
    for (let i = 0; i < C.probes; i++) { probe(i); leaves.forEach((o, j) => { if (!moving.has(o) && keyOf(o) !== k0[j]) moving.add(o); }); }
    const groups = new Map();
    for (const o of leaves) { if (moving.has(o) || !o.visible) continue; const k = o.parent.uuid + '|' + o.material.uuid + '|' + o.castShadow + o.receiveShadow + o.frustumCulled + o.renderOrder + '|' + sigOf(o.geometry) + (opt && opt.cell ? '|' + (o.getWorldPosition(wv), Math.floor(wv.x / opt.cell) + ',' + Math.floor(wv.z / opt.cell)) : '');
      const l = groups.get(k) || []; l.push(o); groups.set(k, l); }
    let made = 0;
    for (const l of groups.values()) { if (l.length < 2) continue;
      const geos = l.map((o) => { o.updateMatrix(); const g = o.geometry.clone(); g.applyMatrix4(o.matrix); return g; }), merged = mergeGeometries(geos, false); for (const g of geos) g.dispose(); if (!merged) { mergeState.failed++; continue; }
      const o0 = l[0], mesh = new THREE.Mesh(merged, o0.material); mesh.castShadow = o0.castShadow; mesh.receiveShadow = o0.receiveShadow; mesh.frustumCulled = o0.frustumCulled; mesh.renderOrder = o0.renderOrder; mesh.userData.mergedDraw = true; mesh.raycast = () => {}; o0.parent.add(mesh);
      // (owner 12:17, the matrix pass) these pieces never move against their parent (that is why they were merged): their local matrix is kept (matrixAutoUpdate off),
      // their world matrix still follows the parent each frame (the aimed shot reads it); the merged mesh sits at its parent's origin
      // (owner 13:10, boss p95: 1,434 of 1,774 matrix-pass nodes were Gloom, most of them these hit shapes) on a machine (not a still base piece) the hit shapes leave the
      // per-frame matrix pass too (matrixWorldAutoUpdate off; they are leaves, nothing below them is skipped): the aimed shot (src/main.js drawnHit0) forces the machine's
      // whole matrix update before it tests them, so it meets them exactly where they are drawn
      for (const o of l) { o.layers.set(HIT_LAYER); o.userData.hitOnly = true; o.updateMatrix(); o.matrixAutoUpdate = false; if (!still) o.matrixWorldAutoUpdate = false; } mesh.updateMatrix(); mesh.matrixAutoUpdate = false; made++; mergeState.pieces += l.length; }
    if (!still) mergeState.machines++; mergeState.meshes += made; return made;
  } catch (e) { mergeState.failed++; return 0; }
}

// LAG FIX Nov 19 (owner 11:25, CONFIG.lag.splitVariants): a material drawn by different kinds of piece (instanced or plain, with or without instance colours, skinned
// or not, with or without morphs) needs a different shader for each kind, and three.js looks its shader up again every time the kind changes between two draws in a frame
// (seen: about 60 lookups a frame on medium). Each extra kind gets its own copy of the material, sharing its colour objects and maps, so the look is the same.
// Materials with their own shader hook (onBeforeCompile) are left alone, as their hook may keep per-material state. Returns how many copies were made.
const VAR = new WeakMap();
const varKey = (o) => (o.isInstancedMesh ? 1 : 0) + (o.instanceColor ? 2 : 0) + (o.isSkinnedMesh ? 4 : 0) + (o.morphTargetInfluences && o.morphTargetInfluences.length ? 8 : 0) + (o.isBatchedMesh ? 16 : 0);
export function splitVariants(root) { let made = 0; const first = new Map();
  root.traverse((o) => { if (!o.isMesh || !o.material || Array.isArray(o.material) || o.userData.hitOnly) return; const m = o.material; if (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')) return;
    const k = varKey(o), f = first.has(m) ? first.get(m) : (VAR.has(m) ? VAR.get(m).k : null); if (f === null) { first.set(m, k); return; } if (f === k) return;
    let v = VAR.get(m); if (!v) VAR.set(m, v = { k: f, c: {} }); let c = v.c[k];
    if (!c) { try { c = m.clone(); } catch (e) { return; } for (const p of ['color', 'emissive', 'specularColor', 'sheenColor', 'attenuationColor']) if (m[p] && m[p].isColor) c[p] = m[p]; v.c[k] = c; VAR.set(c, { k, c: v.c }); m.addEventListener('dispose', () => c.dispose()); made++; }
    o.material = c; });
  return made; }

// (H round 2, troubleshoot card "two-pass transparent", trace "set needsUpdate < renderObject < renderObjects < renderScene": three.js draws a see-through, two-sided
// material in two passes, back faces then front faces, and marks the material changed (needsUpdate) before each pass, so its shader is looked up again (getParameters)
// twice per draw, every frame) a mesh whose triangles all lie in one plane and all face the same way covers each pixel with one triangle at most, all in the same pass,
// so drawing it in ONE pass (forceSinglePass) gives the same pixels in the same order. Set on a material only when every mesh drawing it in root is such a mesh.
// Returns { set: materials switched, left: two-sided see-through materials still drawn in two passes (a non-flat mesh uses them) }.
const FLAT = new WeakMap();
function flatOneWay(g) { let r = FLAT.get(g); if (r !== undefined) return r; r = false; try { const P = g.attributes.position, I = g.index, n = I ? I.count : P.count; if (P && n >= 3) {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nm = new THREE.Vector3(), n0 = new THREE.Vector3(); let d0 = 0, ok = true, have = false;
    for (let k = 0; k + 2 < n && ok; k += 3) { const i0 = I ? I.getX(k) : k, i1 = I ? I.getX(k + 1) : k + 1, i2 = I ? I.getX(k + 2) : k + 2; a.fromBufferAttribute(P, i0); b.fromBufferAttribute(P, i1); c.fromBufferAttribute(P, i2);
      nm.subVectors(c, b).cross(b.clone().sub(a)); const L = nm.length(); if (L < 1e-12) continue; nm.multiplyScalar(1 / L);
      if (!have) { n0.copy(nm); d0 = n0.dot(a); have = true; continue; } if (nm.dot(n0) < 0.9999) ok = false;
      for (const v of [a, b, c]) if (Math.abs(n0.dot(v) - d0) > 1e-4) ok = false; }
    r = ok && have; } } catch (e) { r = false; } FLAT.set(g, r); return r; }
export function singlePassFlat(root) { const users = new Map(); let set = 0, left = 0;
  root.traverse((o) => { if (!o.isMesh || !o.material || Array.isArray(o.material)) return; const m = o.material; if (!m.transparent || m.side !== THREE.DoubleSide || m.forceSinglePass) return; let u = users.get(m); if (!u) users.set(m, u = { flat: true }); if (!o.geometry || o.isInstancedMesh || o.isSkinnedMesh || !flatOneWay(o.geometry)) u.flat = false; });
  for (const [m, u] of users) { if (u.flat) { m.forceSinglePass = true; m.userData.singlePassFlat = true; set++; } else left++; }
  return { set, left }; }

// (H round 2, same card) a merged see-through two-sided mesh (ours: mergedDraw, or the street's merged meshes, ownGeo; its geometry its own) holds pieces in many planes, so it keeps two passes, but as two
// geometry groups over the same triangles with a back-side and a front-side copy of its material: three.js draws them in that order, back then front, as its own two
// passes do, and neither copy is ever marked changed (each keeps its shader). The copies share the colour objects; opacity and visibility follow the material each frame.
const SIDES = new WeakMap();
function sidesOf(m) { let p = SIDES.get(m); if (p) return p; const mk = (side) => { const c = m.clone(); c.side = side; for (const k of ['color', 'emissive', 'specular']) if (m[k] && m[k].isColor) c[k] = m[k];
    // a shader hook of the material's own (clone() does not copy it) goes with the copy too, so the copy builds the same shader
    if (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')) c.onBeforeCompile = m.onBeforeCompile; if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) c.customProgramCacheKey = m.customProgramCacheKey; return c; };
  p = [mk(THREE.BackSide), mk(THREE.FrontSide)]; m.addEventListener('dispose', () => { p[0].dispose(); p[1].dispose(); }); SIDES.set(m, p); return p; }
export function twoPassGroups(root) { let n = 0;
  root.traverse((o) => { if (!o.isMesh || !(o.userData.mergedDraw || o.userData.ownGeo) || o.isSkinnedMesh || Array.isArray(o.material)) return; const m = o.material, g = o.geometry; if (!m || !m.transparent || m.side !== THREE.DoubleSide || m.forceSinglePass || !g || g.groups.length) return;
    const cnt = g.index ? g.index.count : g.attributes.position.count, p = sidesOf(m); g.addGroup(0, cnt, 0); g.addGroup(0, cnt, 1); o.material = p; o.userData.twoPassOf = m;
    const ob = o.onBeforeRender; o.onBeforeRender = function (...a) { p[0].opacity = p[1].opacity = m.opacity; p[0].visible = p[1].visible = m.visible; return ob.apply(this, a); }; n++; });
  return n; }
