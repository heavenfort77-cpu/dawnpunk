// Lag fix (lag report Nov 18, findings 4 and 5; owner approved Nov 19): desktop people, Gloom models and THE BECKONER.
// 1 cullSkinned: skinned characters were drawn with frustumCulled = false (every frame, and into every shadow map, even behind the camera). They are culled again,
//   with a bounding sphere taken in their bind pose and made larger (CONFIG.lag.cull) so an arm swing or a lean never pokes out of it.
// 2 a lower detail copy for things far away: the same vertices with a smaller index list made by meshoptimizer's simplifier (MIT, bundled; works inside the
//   single-file build). Up close the full mesh is drawn exactly as before; past CONFIG.lag.lod.near metres (per kind) the mesh draws the reduced index list.
//   Same mesh object, same materials, skin and face shapes: only mesh.geometry is swapped before each frame (lodTick, from main.js draw()).
// High tier only: phones never call this (their models and builders are unchanged). Every number: CONFIG.lag.
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { CONFIG } from './config.js';

const LG = () => CONFIG.lag;
// low detail geometry per full geometry (geometry objects are never put in userData: clone() copies userData through JSON)
const LOW = new WeakMap();
// registered meshes: mesh -> { full, low, near2, temp, gone }
const REG = new Map();
export const lodState = { meshes: 0, low: 0, built: 0, trisFull: 0, trisLow: 0, failed: 0 };
try { window.__lod = lodState; } catch (e) { /* no window */ }

// frustum culling back on for a skinned mesh, with a grown sphere
export function cullSkinned(o) {
  const C = LG().cull; if (!o || !o.isMesh) return;
  // the sphere of the mesh in its bind pose (the skinned vertices stay in the mesh's own frame however the character's root moves), grown to take in any pose
  try { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const b = o.geometry.boundingSphere.clone(); b.radius = b.radius * C.grow + C.pad; o.boundingSphere = b; o.frustumCulled = true; } catch (e) { o.frustumCulled = false; }
}

const tris = (g) => Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
// the reduced copy of one geometry: shares every attribute (and face shape) with the full one, only the index list is new
function simplify(g, ratio, err) {
  if (LOW.has(g)) return LOW.get(g); if (!g.index || !g.attributes.position) return null;
  const P = g.attributes.position, n = P.count, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = P.getX(i); pos[i * 3 + 1] = P.getY(i); pos[i * 3 + 2] = P.getZ(i); }
  const src = g.index.array, idx = src instanceof Uint32Array ? src : Uint32Array.from(src), want = Math.max(3, Math.floor(idx.length * ratio / 3) * 3);
  const [out] = MeshoptSimplifier.simplify(idx, pos, 3, want, err); if (!out || out.length >= idx.length * 0.92) { LOW.set(g, null); return null; }
  const low = new THREE.BufferGeometry(); for (const k in g.attributes) low.setAttribute(k, g.attributes[k]); low.morphAttributes = g.morphAttributes; low.morphTargetsRelative = g.morphTargetsRelative;
  low.setIndex(new THREE.BufferAttribute(n > 65535 ? out : Uint16Array.from(out), 1)); low.boundingSphere = g.boundingSphere; low.boundingBox = g.boundingBox; if (!low.boundingSphere) low.computeBoundingSphere();
  low.userData.shared = true; low.userData.lodLow = true; LOW.set(g, low); lodState.built++; lodState.trisFull += tris(g); lodState.trisLow += tris(low); return low;
}
// the mesh may use its low copy past `near` metres; temp: a copy that comes and goes (Gloom), dropped from the list once it has left the scene
export function lodRegister(o, kind, temp) {
  const L = LG().lod, k = L.kinds[kind]; if (!L.on || !k || !o.isMesh) return; const full = REG.has(o) ? REG.get(o).full : o.geometry, low = LOW.get(full); if (!low) return;
  REG.set(o, { full, low, near2: k.near * k.near, temp: !!temp, gone: 0 }); lodState.meshes = REG.size;
}
// build the low copies for every big enough mesh under root (a loaded model or template), then register the meshes (keep = long-lived ones; temp ones are registered by lodCopy)
export async function lodPrepare(root, kind, register) {
  const L = LG().lod, k = L.kinds[kind]; if (!L.on || !k || !root) return;
  try { await MeshoptSimplifier.ready; } catch (e) { lodState.failed++; return; }
  const list = []; root.traverse((o) => { if (!o.isMesh || !o.geometry || !o.geometry.index) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && (m.alphaTest > 0 || m.transparent)) return; if (tris(o.geometry) >= L.minTris) list.push(o); });
  for (const o of list) { try { simplify(o.geometry, k.ratio, k.error); } catch (e) { lodState.failed++; } if (register) lodRegister(o, kind, false); await new Promise((r) => setTimeout(r, 0)); }
}
// a copy of a prepared template (shares its geometry): register its meshes as passing ones
export function lodCopy(root, kind) { if (!root) return; root.traverse((o) => { if (o.isMesh && LOW.get(o.geometry)) lodRegister(o, kind, true); }); }

const v = new THREE.Vector3(); let pruneN = 0;
const inScene = (o) => { let p = o; while (p.parent) p = p.parent; return !!p.isScene; };
// before each frame: each registered mesh draws its full or low geometry by its distance from the camera
export function lodTick(cam) {
  if (!REG.size) return; const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z; let low = 0;
  if (++pruneN >= 120) { pruneN = 0; for (const [o, r] of REG) { if (!r.temp) continue; if (inScene(o)) r.gone = 0; else if (++r.gone >= 2) { o.geometry = r.full; REG.delete(o); } } lodState.meshes = REG.size; }
  for (const [o, r] of REG) { const e = o.matrixWorld.elements, dx = e[12] - cx, dy = e[13] - cy, dz = e[14] - cz, far = dx * dx + dy * dy + dz * dz > r.near2, g = far ? r.low : r.full; if (o.geometry !== g) o.geometry = g; if (far) low++; }
  lodState.low = low;
}
