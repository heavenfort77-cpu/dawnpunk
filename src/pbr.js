// Desktop and laptop surfaces (2026-11-15; user: "if phone have limit, why does the desktop version look the same"): on the high tier every lit surface in the game
// (houses, cars, Gloom, devices, base, people) becomes a physically based one: it takes soft light from the sky all round, metal and glazed things shine and reflect the sky,
// rough things stay matt. Phones keep the simple surfaces. A material is changed in place (same object), so game code that later changes its colour, glow or opacity still works.
// Every number is in CONFIG.quality.high.pbr.
import * as THREE from 'three';
const BASE = new THREE.MeshStandardMaterial();
// the sky as a light source: a small gradient dome (zenith, horizon, ground) with a warm bright patch for the sun, blurred into an environment map
export function makeEnv(renderer, P) {
  const sc = new THREE.Scene(), g = new THREE.SphereGeometry(10, 32, 16), col = [], pos = g.attributes.position, c = new THREE.Color(), top = new THREE.Color(P.sky[0]), mid = new THREE.Color(P.sky[1]), low = new THREE.Color(P.sky[2]);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 0.6)); else c.copy(mid).lerp(low, Math.min(1, -y * 4)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.sun).multiplyScalar(P.sunPower) })); sun.position.set(-5, 7.5, -3.5); sc.add(sun);
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(sc, 0.04).texture; pm.dispose(); g.dispose(); return env;
}
function rule(m, P) {
  const tag = (m.map && m.map.userData && m.map.userData.tex) || '', R = P.rules;
  for (const k in R) if (tag === k || tag.startsWith(k)) return R[k];
  if (m.transparent && m.opacity < 0.75) return P.glass;
  if (m.isMeshPhongMaterial) return [Math.max(0.25, Math.min(0.95, 1 - m.shininess / P.shineFull)), 0];
  return P.plain;
}
// change every simple lit material under root into a physically based one, in place; returns how many were changed
export function upgrade(root, P) { let n = 0;
  root.traverse((o) => { if (!o.isMesh || !o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (!m || m.userData.pbr || !(m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue;
    const [rough, metal] = rule(m, P), wasPhong = m.isMeshPhongMaterial; m.userData.pbr = true;
    if (m.alphaTest > 0) continue;      // cut-out cards (leaves, grass, hair) stay as they are
    delete m.isMeshLambertMaterial; delete m.isMeshPhongMaterial; Object.setPrototypeOf(m, THREE.MeshStandardMaterial.prototype); m.isMeshStandardMaterial = true; m.type = 'MeshStandardMaterial'; m.defines = { STANDARD: '' };
    for (const k of ['roughnessMap', 'metalnessMap', 'envMapRotation', 'bumpMap', 'bumpScale', 'displacementMap', 'displacementScale', 'displacementBias', 'lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity', 'emissiveMap', 'emissiveIntensity', 'normalMapType', 'normalScale', 'alphaMap', 'envMap', 'wireframeLinecap', 'wireframeLinejoin', 'emissive', 'normalMap', 'flatShading']) if (m[k] === undefined) m[k] = BASE[k] && BASE[k].clone ? BASE[k].clone() : BASE[k];
    m.roughness = rough; m.metalness = metal; m.envMapIntensity = 1; if (wasPhong) { delete m.specular; delete m.shininess; } m.needsUpdate = true; n++; } });
  return n; }
