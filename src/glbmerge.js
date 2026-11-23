// LAG FIX Nov 19 (owner 07:10, night combat; profile: the night frame is bound by the cost of each draw): the desktop Gloom models (src/gloomglb.js) are built from
// about 25 rigid parts, each its own draw. Here every part of one material is drawn by ONE skinned mesh: each part is a "bone" of that mesh (its vertices follow the
// part's own matrix, weight 1), so whatever moves a part (the walk, the arms, the head) moves its triangles exactly as before. Same geometry, same material,
// same place: the picture is unchanged. The original parts stay in the model as invisible hit shapes on layer HIT_LAYER (src/mergestatic.js): the aimed shot
// (src/main.js drawnHit) raycasts them as before, and the walk code still moves them. (Nov 23) The pistons (parts named ram*) are merged too: their aim runs in the pose (src/gloomhi.js ramAims, src/gloomkit.js pose).
// Done once per kind on the loaded model; each machine's copy gets its own skeleton over its own parts (rebindMerged). Switch: CONFIG.lag.glbMerge.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { HIT_LAYER } from './mergestatic.js';

export const glbMergeState = { models: 0, parts: 0, meshes: 0, failed: 0 };
try { window.__glbMerge = glbMergeState; } catch (e) { /* no window */ }

// a float copy of a part's geometry moved into the model's frame (the models use quantized attributes, which cannot hold positions outside their own range)
function partGeo(o, bone, keys) {
  const g = o.geometry, out = new THREE.BufferGeometry();
  for (const k of keys) { const a = g.attributes[k]; if (!a) continue; const n = a.count, s = a.itemSize, f = new Float32Array(n * s);
    for (let i = 0; i < n; i++) { f[i * s] = a.getX(i); if (s > 1) f[i * s + 1] = a.getY(i); if (s > 2) f[i * s + 2] = a.getZ(i); } out.setAttribute(k, new THREE.BufferAttribute(f, s)); }
  if (g.index) out.setIndex(Array.from(g.index.array)); else out.setIndex([...Array(g.attributes.position.count).keys()]);
  out.applyMatrix4(o.matrixWorld);
  const n = out.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
  out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return out;
}
// rays (the aimed shot) never test the skinned draw mesh: the parts are the hit shapes, and a skinned ray test poses every vertex on the CPU
const noRay = () => {};

// sc: a loaded model (not in the scene, its root at rest). Adds the skinned draw meshes and hides the parts' draws.
// keep(o): optional, false leaves that part as it is (the boss's lens parts, which each copy gives its own glow material); pad: extra metres on the culling sphere
export function mergeGlb(sc, keep, pad) {
  const C = CONFIG.lag.glbMerge; if (!C || !C.on || !sc) return;
  try {
    sc.updateMatrixWorld(true); const parts = [];
    sc.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh || !o.geometry || Array.isArray(o.material) || o.morphTargetInfluences || !o.visible) return; const m = o.material; if (!m || m.transparent || (keep && !keep(o))) return; parts.push(o); });
    if (parts.length < 2) return;
    const byMat = new Map(); for (const o of parts) { const l = byMat.get(o.material) || []; l.push(o); byMat.set(o.material, l); }
    for (const [m, l] of byMat) { if (l.length < 2) continue;
      const keys = ['position', 'normal', 'uv'].filter((k) => l.every((o) => o.geometry.attributes[k])), geos = l.map((o, i) => partGeo(o, i, keys)), geo = mergeGeometries(geos, false); for (const g of geos) g.dispose(); if (!geo) { glbMergeState.failed++; continue; }
      geo.userData.shared = true; geo.computeBoundingSphere();
      const skel = new THREE.Skeleton(l, l.map((o) => o.matrixWorld.clone().invert())), mesh = new THREE.SkinnedMesh(geo, m);
      mesh.name = 'glbMerged'; mesh.userData.mergedDraw = true; mesh.raycast = noRay; mesh.castShadow = l.some((o) => o.castShadow); mesh.receiveShadow = l.some((o) => o.receiveShadow);
      sc.add(mesh); mesh.bind(skel, new THREE.Matrix4());
      // culling: the sphere of the whole model at rest, grown (as src/lod.js cullSkinned does for the people), so a swing never pokes out of it
      const b = geo.boundingSphere.clone(); b.radius = b.radius * CONFIG.lag.cull.grow + CONFIG.lag.cull.pad + (pad || 0); mesh.boundingSphere = b; mesh.frustumCulled = true;
      for (const o of l) { o.layers.set(HIT_LAYER); o.userData.hitOnly = true; }
      glbMergeState.parts += l.length; glbMergeState.meshes++; }
    glbMergeState.models++;
  } catch (e) { glbMergeState.failed++; }
}

// a copy made with tpl.clone(true): its skinned meshes still point at the template's parts; give each its own skeleton over the copy's parts
export function rebindMerged(tpl, copy) {
  const map = new Map(), a = [], b = []; tpl.traverse((o) => a.push(o)); copy.traverse((o) => b.push(o)); if (a.length !== b.length) return;
  for (let i = 0; i < a.length; i++) map.set(a[i], b[i]);
  for (let i = 0; i < a.length; i++) { const t = a[i], c = b[i]; if (!t.isSkinnedMesh || !t.userData.mergedDraw) continue;
    const bones = t.skeleton.bones.map((x) => map.get(x)); if (bones.some((x) => !x)) continue;
    c.raycast = noRay; c.bind(new THREE.Skeleton(bones, t.skeleton.boneInverses.map((m) => m.clone())), t.bindMatrix.clone()); c.boundingSphere = t.boundingSphere.clone(); }
}

// A material drawn both by a merged (skinned) mesh and by an ordinary part needs two shader programs, and three.js looked the program up again at every draw that
// switched between them (owner 09:50 profile: getProgram / getParameters). The ordinary parts get their own copy of it: same values, same tint uniform, same shader
// changes, so they draw exactly as before. LAG FIX Nov 19.
export function splitShared(root) {
  const skinMats = new Set(); root.traverse((o) => { if (o.isSkinnedMesh && o.userData.mergedDraw) skinMats.add(o.material); }); if (!skinMats.size) return 0;
  const copies = new Map(); let n = 0;
  root.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh || o.userData.hitOnly || Array.isArray(o.material) || !skinMats.has(o.material)) return; const m = o.material; let c = copies.get(m);
    if (!c) { c = m.clone(); c.userData = { ...m.userData }; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; copies.set(m, c); } o.material = c; n++; });
  return n;
}

// (R4 item H, card 29: boss night vs hub, the matrix pass 2.6 ms of 16.2 ms a frame, 806 of its 1209 nodes were Gloom; about 51 a machine) a part that never moves
// against the moving piece it hangs from (found with probe poses, as src/mergestatic.js does for the code-built machines) is skinned by that piece instead: its
// skeleton entry points at the moving ancestor (or the machine itself) with the constant offset folded into the entry's inverse matrix, so its triangles are
// drawn exactly where they were (bone matrix = ancestor's world x (offset x old inverse) = the part's own world x old inverse). The part itself (a leaf, now
// only the aimed shot's hit shape) leaves the per-frame matrix pass; the aimed shot (src/main.js drawnHit0) forces the machine's whole matrix update before it
// tests it, as for the merged pieces. root: a machine copy; probe(i): poses it in the i-th test state; n: how many. Returns the parts taken out of the pass.
const _mi = new THREE.Matrix4(), _mc = new THREE.Matrix4();
export function freezeStillBones(root, probe, n) {
  const F = CONFIG.lag.glbFreeze; if (!F || !F.on || !root) return 0;
  try {
    const meshes = []; root.traverse((o) => { if (o.isSkinnedMesh && o.userData.mergedDraw && o.skeleton) meshes.push(o); }); if (!meshes.length) return 0;
    const bones = new Set(); for (const m of meshes) for (const b of m.skeleton.bones) bones.add(b);
    const nodes = new Set(); for (const b of bones) for (let p = b; p && p !== root; p = p.parent) nodes.add(p);
    const key = (o) => { o.updateMatrix(); return o.matrix.elements.map((v) => v.toFixed(5)).join(',') + (o.visible ? '' : '|h'); };
    const k0 = new Map(); for (const o of nodes) k0.set(o, key(o));
    const moving = new Set(); for (let i = 0; i < n; i++) { probe(i); for (const o of nodes) if (!moving.has(o) && key(o) !== k0.get(o)) moving.add(o); }
    root.updateMatrixWorld(true);
    // the moving ancestor of each still leaf part (null: the chain to the root is broken, leave the part as it is)
    const anchor = new Map(); for (const b of bones) { if (moving.has(b) || b.children.length) continue; let a = b.parent; while (a && a !== root && !moving.has(a)) a = a.parent; if (a) anchor.set(b, a); }
    if (!anchor.size) return 0;
    for (const m of meshes) { const S = m.skeleton; let ch = false;
      for (let i = 0; i < S.bones.length; i++) { const b = S.bones[i], a = anchor.get(b); if (!a) continue;
        // offset = ancestor's world inverse x part's world (constant: nothing between them moves)
        _mc.copy(a.matrixWorld).invert().multiply(b.matrixWorld); S.boneInverses[i] = _mi.copy(_mc).multiply(S.boneInverses[i]).clone(); S.bones[i] = a; ch = true;
        // (R4 worker 5) kept for the aimed shot: the part's world matrix is ancestor's world x offset (src/main.js drawnHit0 puts it back before testing the part)
        if (!b.userData.fz) b.userData.fz = { a, off: _mc.clone() }; } }
    let k = 0; for (const b of anchor.keys()) { b.updateMatrix(); b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false; k++; }
    glbMergeState.frozen = (glbMergeState.frozen || 0) + k; glbMergeState.frozenOf = (glbMergeState.frozenOf || 0) + bones.size; return k;
  } catch (e) { glbMergeState.failed++; return 0; }
}
