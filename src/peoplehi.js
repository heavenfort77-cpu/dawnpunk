// Desktop and laptop materials and light for the base people's scan faces (owner Nov 16: "give Bram that treatment", Marla's desktop standard).
// The same approach as Marla's (src/marlahi.js, which stays hers): physically based skin with the relief and gloss maps, light that wraps past the shadow edge with
// a warm band there (light under the skin), baked soft shading (tools/people_ao.py, vertex colours) mixed in, a smaller share of the sky's fill light on the
// skin, hair and lash cut-outs with soft edges that keep the desktop contact shading off the hair (stencil, CONFIG.quality.high.fx.keepOut), and one warm key light shared by all of them that rides with whoever is nearest the player.
// Only the high tier with CONFIG.people.scanFaces on uses this; phones keep the light models. Every number is in CONFIG.people.hiMat.
import * as THREE from 'three';
import { lamps, lampRoot } from './shaderlamps.js';

const AOK = (o, k) => (o.geometry && o.geometry.attributes.color && !(o.name || '').startsWith('teeth') ? k : 0);
// baked shading: diffuse colour times the vertex colour at strength k; the sky's soft fill (indirect diffuse) times amb
function withAO(mat, k, amb, prev) { if (!k) return mat; mat.vertexColors = true; const pre = prev || mat.onBeforeCompile;
  // (Nov 20) strengths as uniforms, as Marla's (src/marlahi.js withAO): one shader for every strength
  const U = { aoK: { value: k }, aoAmb: { value: amb } };
  mat.onBeforeCompile = (sh, r) => { if (pre) pre(sh, r); Object.assign(sh.uniforms, U); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float aoK; uniform float aoAmb;').replace('#include <color_fragment>', 'diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.rgb, aoK );').replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse *= aoAmb;'); };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => ''; mat.customProgramCacheKey = () => key() + '-aoU'; return mat; }
// stencil mark: these pixels get no contact shading (otherwise the shading of the ground behind shows through the hair)
const mark = (m, H) => { if (!H.keepOut) return m; m.stencilWrite = true; m.stencilRef = H.keepOut; m.stencilFunc = THREE.AlwaysStencilFunc; m.stencilZPass = THREE.ReplaceStencilOp; return m; };
const RX = /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/;
export function peopleHiMat(m, o, H) {
  const n = m.name || '', keep = (x) => { x.name = n; x.userData.keep = true; x.userData.pbr = true; return x; };
  if (n.startsWith('skin')) {
    const s = new THREE.MeshPhysicalMaterial({ map: m.map, color: new THREE.Color(H.skinTint), normalMap: m.normalMap, normalScale: new THREE.Vector2(H.bump, H.bump), roughnessMap: m.roughnessMap, roughness: H.skinRough, metalness: 0,
      sheen: H.sheen, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffffff), specularIntensity: H.skinSpec, envMapIntensity: H.env });
    const sc = new THREE.Color(H.scatterCol), f = (v) => v.toFixed(4);
    s.onBeforeCompile = (sh) => { const src = THREE.ShaderChunk.lights_physical_pars_fragment; if (!RX.test(src)) return;
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', src.replace(RX, 'float rawNL = dot( geometryNormal, directLight.direction );\n\tfloat dotNL = saturate( ( rawNL + ' + f(H.wrap) + ' ) / ( 1.0 + ' + f(H.wrap) + ' ) );\n\tvec3 irradiance = dotNL * directLight.color;\n\tirradiance += directLight.color * vec3( ' + f(sc.r) + ', ' + f(sc.g) + ', ' + f(sc.b) + ' ) * ' + f(H.scatter) + ' * smoothstep( -0.5, 0.0, rawNL ) * ( 1.0 - smoothstep( 0.0, 0.55, rawNL ) );')); };
    s.customProgramCacheKey = () => 'people-skin-' + H.wrap + '-' + H.scatter; return keep(withAO(s, AOK(o, H.ao.skin), H.amb)); }
  if (m.alphaTest > 0 || m.transparent) { const hair = n.startsWith('hair'); if (hair) o.receiveShadow = false; if (hair && H.hairShadow === false) o.castShadow = false;
    return keep(mark(withAO(new THREE.MeshPhysicalMaterial({ map: m.map, color: hair && H.hairTint !== undefined ? m.color.clone().multiply(new THREE.Color(H.hairTint)) : m.color, alphaTest: H.cut, alphaToCoverage: false, transparent: false, side: THREE.DoubleSide, roughness: hair ? H.hairRough : 0.7, metalness: 0, specularIntensity: hair && H.hairSpec !== undefined ? H.hairSpec : 1, sheen: hair ? H.hairSheen : 0, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xfff0d8), envMapIntensity: H.env }), hair ? AOK(o, H.ao.hair) : 0, H.ambHair), H)); }
  if (n.startsWith('lash')) { o.castShadow = false; return keep(mark(m, H)); }
  m.envMapIntensity = H.env; if (n.startsWith('eye')) { m.roughness = H.eyeRough; m.metalness = 0; if (H.eyeCoat !== undefined) m.clearcoat = H.eyeCoat; if (H.eyeballEnv !== undefined) m.envMapIntensity = H.eyeballEnv; return keep(m); }
  m.vertexColors = false; return keep(withAO(m, AOK(o, n === 'scan_mouth' ? H.ao.mouth : H.ao.cloth), H.amb));
}
// eyes: a clear cornea over each eyeball that only ADDS its highlight and sky reflection (additive blending; real glass transmission would draw the scene twice, as Marla's
// first try did): a copy of the eyeball, scaled out about its own centre by H.corneaScale, bound to the same bones. Used for people without a cornea of their own (CONFIG.peopleHi).
export function peopleHiCornea(sc, H) { const add = [];
  sc.traverse((o) => { if (!o.isSkinnedMesh || !/^eye_[lr]$/.test(o.name)) return;
    const g = o.geometry.clone(), pa = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3(), n = pa.count;
    for (let i = 0; i < n; i++) c.add(v.fromBufferAttribute(pa, i)); c.multiplyScalar(1 / n);
    const out = new THREE.BufferAttribute(new Float32Array(n * 3), 3); for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i).sub(c).multiplyScalar(H.corneaScale).add(c); out.setXYZ(i, v.x, v.y, v.z); }
    g.setAttribute('position', out); g.deleteAttribute('color');
    const m = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: H.corneaRough, metalness: 0, ior: 1.376, specularIntensity: H.corneaSpec !== undefined ? H.corneaSpec : 1, envMapIntensity: H.eyeEnv, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    m.userData.keep = true; const k = new THREE.SkinnedMesh(g, m); k.name = 'cornea_' + o.name.slice(4); k.bind(o.skeleton, o.bindMatrix); k.castShadow = false; k.receiveShadow = false; k.renderOrder = 3; k.frustumCulled = false; k.userData.keep = true; add.push([o.parent, k]); });
  for (const [p, k] of add) p.add(k); return add.length; }
// (OWNER DECISION Nov 20 14:15, CONFIG.lag.shaderLamps) the same key worked out in each person's materials, switched on for the one person who holds it (the same
// nearest-person rule as the real light below), so no light object and no light-count change; returns the same bid function
let LOWN = null, LOWD = Infinity, LOWT = -1e9;
export function peopleHiLamp(root, K) {
  const L = lamps({ key: [K.col, K.power, K.reach], cone: K.cone, penumbra: 0.6, keyAt: K.at, headY: K.headY, rim: null, root, on: 0 }); lampRoot(root, L);
  const take = (d) => { if (LOWN && LOWN !== L) LOWN.u.slOn.value = 0; LOWN = L; L.u.slOn.value = 1; LOWD = d; LOWT = now(); };
  const hp = new THREE.Vector3(), cd = new THREE.Vector3();
  const facing = (d) => { if (!K.talk) return true; if (d > K.talk) return false; const g = typeof window !== 'undefined' && window.__game, cam = g && g.cam; if (!cam) return true;
    root.getWorldPosition(hp); hp.y += K.headY; cam.getWorldDirection(cd); hp.sub(cam.position); return hp.normalize().dot(cd) > K.faceCos; };
  const bid = (d) => { const t = now(); if (LOWN === L) { LOWD = facing(d) ? d : Math.max(d, K.talk || d); LOWT = t; return; } if (!facing(d)) return; if (!LOWN || t - LOWT > 500 || d < LOWD - K.swap) take(d); };
  if (!LOWN || now() - LOWT > 500) take(Infinity);
  return bid; }
// the key light: a narrow warm spotlight on the face from in front and to one side. ONE light is shared by every scan-face person (each extra light costs every lit
// pixel in the scene and a shader rebuild): it rides with whoever is nearest the player. peopleHiLight returns that person's bid(distance to the player, m) for drive()
// to call each frame; another person takes the light only when nearer by CONFIG.people.hiMat.key.swap. No shadow by default (one shadow map per light is costly).
let KEY = null, owner = null, ownerD = Infinity, ownerT = -1e9;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
// bias: [depth bias, normal bias] of its shadow (CONFIG.marlaHi.keyBias)
export function peopleHiLight(root, K, bias) { bias = bias || [-0.0015, 0.012];
  if (!KEY) { KEY = new THREE.SpotLight(K.col, K.power, K.reach, K.cone, 0.6, 2); KEY.position.set(K.at[0], K.at[1], K.at[2]); KEY.target.position.set(0, K.headY, 0.05);
    KEY.castShadow = !!K.shadow; if (K.shadow) { KEY.shadow.mapSize.set(K.shadow, K.shadow); KEY.shadow.bias = bias[0]; KEY.shadow.normalBias = bias[1]; KEY.shadow.camera.near = 0.2; KEY.shadow.camera.far = K.reach; }
    KEY.userData.keep = true; KEY.target.userData.keep = true; KEY.name = 'peopleKey'; }
  const take = (d) => { owner = root; ownerD = d; ownerT = now(); root.add(KEY); root.add(KEY.target); };
  // the holder must keep bidding (drive() runs every frame while it is shown): a holder silent for half a second (scene left, person removed) loses the light
  // with K.talk set, a person only bids while within talk range AND in front of the camera (the one you are facing; cos of the angle above K.faceCos); the light stays where it is otherwise
  const hp = new THREE.Vector3(), cd = new THREE.Vector3();
  const facing = (d) => { if (!K.talk) return true; if (d > K.talk) return false; const g = typeof window !== 'undefined' && window.__game, cam = g && g.cam; if (!cam) return true;
    root.getWorldPosition(hp); hp.y += K.headY; cam.getWorldDirection(cd); hp.sub(cam.position); return hp.normalize().dot(cd) > K.faceCos; };
  const bid = (d) => { const t = now(); if (owner === root) { ownerD = facing(d) ? d : Math.max(d, K.talk || d); ownerT = t; return; } if (!facing(d)) return; if (!owner || t - ownerT > 500 || d < ownerD - K.swap) take(d); };
  if (!owner || now() - ownerT > 500) take(Infinity);
  return bid; }
