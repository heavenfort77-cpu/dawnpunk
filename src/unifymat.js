// One shader for many plain materials (Nov 20, the first home card: 27 MeshStandard programs of the base on the GitHub Mac, each one costing 50-100 ms the first
// time it is drawn). three builds a separate program for every combination of "has a colour picture / a relief picture / a roughness picture / vertex colours".
// unifyStd(root) gives every plain MeshStandardMaterial under root all four: a 1x1 white colour picture, a 1x1 flat relief picture, a 1x1 white roughness picture and
// white vertex colours where a piece had none. White times a colour is that colour, a flat relief leaves the surface normal as it was, white roughness keeps the
// roughness number: the picture stays the same (checked by a pixel comparison), the programs fall to the few that differ in other ways (fog, see-through, two sides).
// CONFIG.lag.unifyMats switches it.
import * as THREE from 'three';

let T = null;
function tex() {
  if (T) return T; const mk = (r, g, b, srgb) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; t.userData.shared = true; t.userData.keep = true; return t; };
  // the flat relief picture holds exactly (0.5, 0.5, 1): an 8-bit 128 would tilt every normal a little
  const flat = new THREE.DataTexture(new Float32Array([0.5, 0.5, 1, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType); flat.minFilter = flat.magFilter = THREE.NearestFilter; flat.needsUpdate = true; flat.userData.shared = true; flat.userData.keep = true;
  T = { white: mk(255, 255, 255, true), flat, rough: mk(255, 255, 255, false) }; return T;
}
const plain = (m) => m && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.userData.noUnify && !m.onBeforeCompileSet;
export function unifyStd(root) {
  const t = tex(), mats = new Set(); let n = 0;
  root.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (plain(m)) mats.add(m); });
  // vertex colours: a material only takes them if every piece drawn with it has them (white is added where missing)
  const users = new Map(); root.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (mats.has(m)) { let l = users.get(m); if (!l) users.set(m, l = []); l.push(o); } });
  for (const m of mats) { let ch = false;
    if (!m.map) { m.map = t.white; ch = true; }
    // the relief picture's frame comes from the uv's slope: a piece without uvs (grass blades, cards) would get a broken normal, so such materials keep none
    if (!m.normalMap && (users.get(m) || []).every((o) => o.geometry.attributes.uv)) { m.normalMap = t.flat; ch = true; }
    if (!m.roughnessMap) { m.roughnessMap = t.rough; ch = true; }
    // a piece that already carries colours its material did not use (grass: a sway weight) keeps its material without vertex colours
    if (!m.vertexColors && (users.get(m) || []).every((o) => !o.geometry.attributes.color)) { for (const o of users.get(m) || []) { const g = o.geometry; if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); } } m.vertexColors = true; ch = true; }
    if (ch) { m.needsUpdate = true; n++; } }
  return n;
}
// (Nov 23, owner's list item 3: the first ride card built 69 programs, 4-6.5 s of it on the Mac) the street's and the house rooms' plain materials share programs the
// same way, without the flat relief picture (that one adds work for every pixel of the street): a 1x1 white colour picture and a 1x1 white roughness picture where a
// material has none, white vertex colours (one byte a channel) where its pieces have none, white instance colours on repeated pieces without their own. White times a
// colour is that colour, so the picture is unchanged. A material also drawn by a skinned or morphing piece anywhere in `all` is left as it is. CONFIG.lag.unifyStreet.
export function unifyLite(root, all) {
  const t = tex(), mats = new Set(), list = (o) => (Array.isArray(o.material) ? o.material : [o.material]); let n = 0;
  root.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh) return; for (const m of list(o)) if (plain(m)) mats.add(m); });
  const users = new Map(), seen = new Set(), take = (o) => { if (!o.isMesh || seen.has(o)) return; seen.add(o); for (const m of list(o)) if (mats.has(m)) { let l = users.get(m); if (!l) users.set(m, l = []); l.push(o); } };
  root.traverse(take); if (all) all.traverse(take);
  for (const m of mats) { const us = users.get(m) || []; if (us.some((o) => o.isSkinnedMesh || o.morphTargetInfluences || !o.geometry || !o.geometry.attributes.position)) continue; let ch = false;
    if (!m.map) { m.map = t.white; ch = true; }
    if (!m.roughnessMap) { m.roughnessMap = t.rough; ch = true; }
    if (!m.vertexColors && us.every((o) => !o.geometry.attributes.color)) { for (const o of us) { const g = o.geometry; if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(g.attributes.position.count * 3).fill(255), 3, true)); } m.vertexColors = true; ch = true; }
    for (const o of us) if (o.isInstancedMesh && !o.instanceColor) { o.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(o.count * 3).fill(1), 3); ch = true; }
    if (ch) { m.needsUpdate = true; n++; } }
  return n;
}
