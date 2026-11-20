// Desktop and laptop Marla (2026-11-15; user: "a real marla render full on desktop, the max of desktop, not a dial"). Only the high tier loads her desktop model
// (art/models_hi, a file beside index.html) and only the high tier builds these materials; phones keep the packed light model and its simple materials.
// Skin: physically based, with her bump and gloss maps, a soft sheen, and light that wraps past the shadow edge with a warm red band there (light scattering under skin).
// Eyes: a clear cornea over the eyeball that only adds its highlight and sky reflection (drawn additively over the eye; true glass transmission would draw the whole scene twice for two tiny lenses). Hair, brows, lashes: soft-edged cut-outs with a sheen. Cloth, leather, metal: their exported surfaces.
// A warm key light and a cool rim light ride with her. Every number is in CONFIG.marlaHi.
import * as THREE from 'three';
// Baked shading (tools/marla_ao.py): skin, hair and clothes carry how open each point is to the sky as vertex colours; mixed in at H.ao strength, it darkens
// the hollows the pick-18 render shows (under the fringe, eye sockets, nostrils, lip corners, inside the hair).
// AMB: her share of the sky's soft fill light (the render had one key light and a dark room, so her face had shape; the open sky in the game flattened it). Set from CONFIG.marlaHi.amb.
let AMB = 1;
const AOK = (o, k) => o.geometry && o.geometry.attributes.color && !(o.name || '').startsWith('teeth') ? k : 0;
function withAO(mat, k, prev, amb) { if (!k) return mat; const A = amb === undefined ? AMB : amb; mat.vertexColors = true; const pre = prev || mat.onBeforeCompile;
  // (Nov 20, the first home card's 90 shader programs: the strengths were written into the shader, so every strength was its own program) aoK / aoAmb are uniforms:
  // the same shader for every strength (the same picture), shared with the people's (src/peoplehi.js) where the rest of the material is the same
  const U = { aoK: { value: k }, aoAmb: { value: A } };
  // (Nov 20, playershadowcheck on high: "'aoK' : redefinition") a material given the baked shading twice keeps the first one's (as before the strengths were uniforms)
  mat.onBeforeCompile = (sh, r) => { if (pre) pre(sh, r); if (sh.fragmentShader.includes('uniform float aoK')) return; Object.assign(sh.uniforms, U); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float aoK; uniform float aoAmb;').replace('#include <color_fragment>', 'diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.rgb, aoK );').replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse *= aoAmb;'); };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => ''; mat.customProgramCacheKey = () => key() + '-aoU'; return mat; }
const RX = /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/;
export function hiMat(m, o, H) {
  AMB = H.amb;
  const n = m.name || '', on = o.name || '', keep = (x) => { x.name = n; x.userData.keep = true; x.userData.pbr = true; return x; };
  if (on === 'crinkle') o.visible = !!H.crinkle;
  if (on.startsWith('brow')) o.visible = !!H.browCards;
  if (on.startsWith('cornea')) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 3; return keep(new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: H.corneaRough, metalness: 0, ior: 1.376, specularIntensity: 1, envMapIntensity: H.eyeEnv, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); }
  if (n.startsWith('skin')) {
    const s = new THREE.MeshPhysicalMaterial({ map: m.map, color: new THREE.Color(H.skinTint), normalMap: m.normalMap, normalScale: m.normalScale ? m.normalScale.clone().multiplyScalar(H.bump) : new THREE.Vector2(H.bump, H.bump), roughnessMap: m.roughnessMap, roughness: H.skinRough, metalness: 0,
      sheen: H.sheen, sheenRoughness: H.sheenRough, sheenColor: new THREE.Color(H.sheenCol), specularIntensity: H.skinSpec, envMapIntensity: H.skinEnv });
    const sc = new THREE.Color(H.scatterCol), f = (v) => v.toFixed(4);
    s.onBeforeCompile = (sh) => { const src = THREE.ShaderChunk.lights_physical_pars_fragment; if (!RX.test(src)) return;
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', src.replace(RX, 'float rawNL = dot( geometryNormal, directLight.direction );\n\tfloat dotNL = saturate( ( rawNL + ' + f(H.wrap) + ' ) / ( 1.0 + ' + f(H.wrap) + ' ) );\n\tvec3 irradiance = dotNL * directLight.color;\n\tirradiance += directLight.color * vec3( ' + f(sc.r) + ', ' + f(sc.g) + ', ' + f(sc.b) + ' ) * ' + f(H.scatter) + ' * smoothstep( -0.5, 0.0, rawNL ) * ( 1.0 - smoothstep( 0.0, 0.55, rawNL ) );')); };
    s.customProgramCacheKey = () => 'marla-skin-' + H.wrap + '-' + H.scatter; return keep(withAO(s, AOK(o, H.ao.skin))); }
  if (m.alphaTest > 0 || m.transparent) { const hair = n.startsWith('hair'), brow = n.startsWith('brow');
    if (hair && !H.hairShadow) o.receiveShadow = false;
    if (brow && !o.geometry.userData.lifted) { o.geometry.translate(0, 0, H.browLift); o.geometry.userData.lifted = true; }
    return keep(mark(withAO(new THREE.MeshPhysicalMaterial({ map: m.map, color: hair ? m.color.clone().multiply(new THREE.Color(H.hairTint)) : m.color, alphaTest: brow ? H.browCut : H.cut, alphaToCoverage: hair ? !!H.hairA2C : true, transparent: false, side: THREE.DoubleSide, roughness: hair ? H.hairRough : 0.7, metalness: 0, sheen: hair ? H.hairSheen : 0, sheenRoughness: 0.35, sheenColor: new THREE.Color(H.hairSheenCol), envMapIntensity: H.hairEnv }), hair ? AOK(o, H.ao.hair) : 0, undefined, hair ? H.ambHair : undefined), H)); }
  if (n.startsWith('eye')) { m.roughness = H.eyeRough; m.metalness = 0; m.envMapIntensity = 0.8; return keep(m); }
  if (n === 'enamel') { m.roughness = H.enamelRough; m.envMapIntensity = H.enamelEnv; return keep(m); }
  if (H.metalRough[n] !== undefined) { m.metalness = 1; m.roughness = H.metalRough[n]; return keep(m); }
  if (m.color) m.color.multiply(new THREE.Color(H.clothTint));
  m.vertexColors = false; return keep(withAO(m, AOK(o, n === 'scan_mouth' ? H.ao.mouth : H.ao.cloth)));
}
// The key light is a narrow spotlight on her head that casts shadows (nose, brow ridge, fringe onto the forehead), as the render's key did; keyShadow: [shadow map size, cone angle rad, blur]; keyBias: [depth bias, normal bias] against striped self-shadow
// noLights (CONFIG.lag.shaderLamps): her hair only; the key and rim are worked out in her materials instead (src/shaderlamps.js)
export function hiLights(root, H, noLights) { hiHair(root, H); if (noLights) return; const k = new THREE.SpotLight(H.key[0], H.key[1], H.key[2], H.keyShadow[1], 0.6, 2); k.position.set(H.keyAt[0], H.keyAt[1], H.keyAt[2]); k.target.position.set(0, H.headY, 0); k.target.userData.keep = true; root.add(k.target);
  k.castShadow = true; k.shadow.mapSize.set(H.keyShadow[0], H.keyShadow[0]); k.shadow.radius = H.keyShadow[2]; k.shadow.bias = H.keyBias[0]; k.shadow.normalBias = H.keyBias[1]; k.shadow.camera.near = 0.3; k.shadow.camera.far = H.key[2]; const r = new THREE.PointLight(H.rim[0], H.rim[1], H.rim[2], 2); r.position.set(H.rimAt[0], H.rimAt[1], H.rimAt[2]); for (const l of [k, r]) { l.userData.keep = true; root.add(l); } }
// Hair under-layer (owner Nov 16: "work on the hair"): the pick-18 render's hair reads solid with darker hair showing between the strands; in the game the gaps between
// cards showed the scene. A second copy of the hair cards, cut far more loosely (so each card is nearly solid), darker, pulled a little toward the head and drawn behind
// the real strands, fills those gaps with hair. H.hairUnder: { cut, shade (colour times this), shrink (share pulled toward the head centre), ao, top (share of the hair's height, from the crown down, left without an under-layer: under the crown it darkened the top of her head) }
// mark: her hair writes H.keepOut into the stencil buffer so the desktop contact-shading overlay (src/fx.js) leaves those pixels alone
const mark = (m, H) => { if (!H.keepOut) return m; m.stencilWrite = true; m.stencilRef = H.keepOut; m.stencilFunc = THREE.AlwaysStencilFunc; m.stencilZPass = THREE.ReplaceStencilOp; return m; };
export function hiHair(root, H) { const U = H.hairUnder; if (!U) return; let hair = null; root.traverse((o) => { if (!hair && o.isSkinnedMesh && o.name === 'hair') hair = o; }); if (!hair) return;
  const g = hair.geometry; g.computeBoundingBox(); const bb = g.boundingBox, c = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y - (bb.max.y - bb.min.y) * 0.12, (bb.min.z + bb.max.z) / 2), m0 = hair.material;
  const m = new THREE.MeshStandardMaterial({ map: m0.map, color: m0.color.clone().multiply(new THREE.Color(U.tint || 0xffffff)).multiplyScalar(U.shade), alphaTest: U.cut, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, envMapIntensity: H.hairEnv * U.shade, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
  const f = (v) => v.toFixed(5); const topY = bb.max.y - (bb.max.y - bb.min.y) * (U.top || 0); withAO(m, AOK(hair, U.ao), (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = vec3( ' + f(c.x) + ', ' + f(c.y) + ', ' + f(c.z) + ' ) + ( transformed - vec3( ' + f(c.x) + ', ' + f(c.y) + ', ' + f(c.z) + ' ) ) * ' + f(1 - U.shrink) + ';'); }, H.ambHair);
  const P = g.attributes.position, src = g.index ? g.index.array : null, keepT = [];
  // the under-layer keeps only the cards below topY (a separate triangle list over the same points), so it also stays off the crown in the contact-shading pass
  if (src) for (let t = 0; t < src.length; t += 3) { if (P.getY(src[t]) <= topY && P.getY(src[t + 1]) <= topY && P.getY(src[t + 2]) <= topY) keepT.push(src[t], src[t + 1], src[t + 2]); }
  const g2 = new THREE.BufferGeometry(); for (const k in g.attributes) g2.setAttribute(k, g.attributes[k]); g2.morphAttributes = g.morphAttributes; g2.morphTargetsRelative = g.morphTargetsRelative; g2.setIndex(src ? keepT : null); g2.boundingSphere = g.boundingSphere; g2.boundingBox = g.boundingBox;
  const under = new THREE.SkinnedMesh(g2, m); under.name = 'hair_under'; under.bind(hair.skeleton, hair.bindMatrix); under.frustumCulled = false; under.castShadow = false; under.receiveShadow = !!H.hairShadow; under.renderOrder = -1; mark(m, H);
  if (hair.morphTargetInfluences) under.morphTargetInfluences = hair.morphTargetInfluences; under.morphTargetDictionary = hair.morphTargetDictionary; m.userData.keep = true; m.userData.pbr = true; under.userData.keep = true; hair.parent.add(under); }

