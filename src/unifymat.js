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
