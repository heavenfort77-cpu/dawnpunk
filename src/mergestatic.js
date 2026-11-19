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
export function mergeStatic(root, probe, still) {
  const C = still ? { on: true, probes: 0, transparent: true } : CONFIG.lag.mergeGloom; if (!C || !C.on) return 0;
  try {
    const leaves = [];
    root.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.children.length || !o.geometry || Array.isArray(o.material) || o.userData.blob || o.userData.mergedDraw || o.userData.hitOnly) return;
      const m = o.material; if (!m || (m.transparent && !C.transparent) || m.blending !== THREE.NormalBlending || o.morphTargetInfluences) return; leaves.push(o); });
    if (leaves.length < 2) return 0;
    const k0 = leaves.map(keyOf), moving = new Set();
    for (let i = 0; i < C.probes; i++) { probe(i); leaves.forEach((o, j) => { if (!moving.has(o) && keyOf(o) !== k0[j]) moving.add(o); }); }
    const groups = new Map();
    for (const o of leaves) { if (moving.has(o) || !o.visible) continue; const k = o.parent.uuid + '|' + o.material.uuid + '|' + o.castShadow + o.receiveShadow + o.frustumCulled + o.renderOrder + '|' + sigOf(o.geometry);
      const l = groups.get(k) || []; l.push(o); groups.set(k, l); }
    let made = 0;
    for (const l of groups.values()) { if (l.length < 2) continue;
      const geos = l.map((o) => { o.updateMatrix(); const g = o.geometry.clone(); g.applyMatrix4(o.matrix); return g; }), merged = mergeGeometries(geos, false); for (const g of geos) g.dispose(); if (!merged) { mergeState.failed++; continue; }
      const o0 = l[0], mesh = new THREE.Mesh(merged, o0.material); mesh.castShadow = o0.castShadow; mesh.receiveShadow = o0.receiveShadow; mesh.frustumCulled = o0.frustumCulled; mesh.renderOrder = o0.renderOrder; mesh.userData.mergedDraw = true; mesh.raycast = () => {}; o0.parent.add(mesh);
      for (const o of l) { o.layers.set(HIT_LAYER); o.userData.hitOnly = true; } made++; mergeState.pieces += l.length; }
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
