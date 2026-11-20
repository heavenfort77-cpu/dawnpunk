// Shader lamps (OWNER DECISION Nov 20 14:15: "remove all spotlight, all use shader"): the warm key spot and the cool rim lamp that used to be real lights on Marla
// (src/marlahi.js hiLights) and the people's shared key spot (src/peoplehi.js peopleHiLight) are worked out inside the lit materials of the person they light.
// The light reaches the surface through the material's own RE_Direct (the same code three runs for a real spot or point light), so the colour, falloff, cone,
// wrap and specular are the real light's; only the shadow map is gone (and nothing else in the scene is lit by them). No light object, no shadow pass, no
// light-count change, so no shader is rebuilt when a person comes or goes.
// lamps(spec) -> { u, add(material), place(camera) }: spec = { key: [colour, power, reach], cone (rad), penumbra (share), keyAt [x, y, z], headY, rim: [colour, power,
// reach] or null, rimAt, root (the Object3D the places are in) }. place() puts the lamps in view space; call it in an onBeforeRender of each lit piece.
import * as THREE from 'three';

const GLSL = '{ IncidentLight slI; vec3 slL = slKeyP - geometryPosition; float slD = length( slL ); slI.direction = slL / max( slD, 1e-4 );\n'
  + 'slI.color = slKeyC * slOn * smoothstep( slKeyCos.x, slKeyCos.y, dot( slI.direction, slKeyD ) ) * getDistanceAttenuation( slD, slKeyR, 2.0 ); slI.visible = true;\n'
  + 'RE_Direct( slI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n'
  + 'if ( slRimR > 0.0 ) { slL = slRimP - geometryPosition; slD = length( slL ); slI.direction = slL / max( slD, 1e-4 );\n'
  + 'slI.color = slRimC * slOn * getDistanceAttenuation( slD, slRimR, 2.0 ); RE_Direct( slI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); } }\n'
  + '#include <lights_fragment_maps>';
const DECL = '#include <common>\nuniform vec3 slKeyP; uniform vec3 slKeyD; uniform vec3 slKeyC; uniform float slKeyR; uniform vec2 slKeyCos; uniform vec3 slRimP; uniform vec3 slRimC; uniform float slRimR; uniform float slOn;';

export function lamps(S) {
  const u = { slKeyP: { value: new THREE.Vector3() }, slKeyD: { value: new THREE.Vector3() }, slKeyC: { value: new THREE.Color(S.key[0]).multiplyScalar(S.key[1]) }, slKeyR: { value: S.key[2] },
    // three's spot: smoothstep( cos( cone ), cos( cone * ( 1 - penumbra ) ), cos( angle ) )
    slKeyCos: { value: new THREE.Vector2(Math.cos(S.cone), Math.cos(S.cone * (1 - S.penumbra))) },
    slRimP: { value: new THREE.Vector3() }, slRimC: { value: S.rim ? new THREE.Color(S.rim[0]).multiplyScalar(S.rim[1]) : new THREE.Color(0) }, slRimR: { value: S.rim ? S.rim[2] : 0 },
    slOn: { value: S.on === undefined ? 1 : S.on } };
  const t = new THREE.Vector3(), done = new WeakSet();
  const place = (c) => { const W = S.root.matrixWorld, V = c.matrixWorldInverse, kp = u.slKeyP.value; kp.fromArray(S.keyAt).applyMatrix4(W).applyMatrix4(V);
    t.set(0, S.headY, 0).applyMatrix4(W).applyMatrix4(V); u.slKeyD.value.subVectors(kp, t).normalize(); if (S.rim) u.slRimP.value.fromArray(S.rimAt).applyMatrix4(W).applyMatrix4(V); };
  // the material keeps its own shader key (taken before its compile step is wrapped), with '|lamps' added: the same program for every person with the same material kind
  const add = (m) => { if (!m || done.has(m) || m.isMeshBasicMaterial || m.isShaderMaterial) return; done.add(m); const key = m.customProgramCacheKey.call(m) + '|lamps', pre = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { if (pre) pre.call(m, sh, r); Object.assign(sh.uniforms, u); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', DECL).replace('#include <lights_fragment_maps>', GLSL); };
    m.customProgramCacheKey = () => key; m.needsUpdate = true; };
  return { u, add, place };
}
// every lit material under root gets the lamps; each lit piece places them before it is drawn (a few vector sums, no objects made)
export function lampRoot(root, L) { root.traverse((o) => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; let lit = false;
  for (const m of ms) if (m && !m.isMeshBasicMaterial && !m.isShaderMaterial) { L.add(m); lit = true; }
  if (lit) { const pre = o.onBeforeRender; o.onBeforeRender = function (r, s, c, g, m, gr) { L.place(c); if (pre !== THREE.Object3D.prototype.onBeforeRender) pre.call(this, r, s, c, g, m, gr); }; } }); }
