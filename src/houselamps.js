// Lamps as shader data, not THREE lights (R4, item A / card 26; lead area 2). Used for the house ceiling lamps (one a floor), the night machines' screen lights
// (src/main.js glights) and the base's room lamps (src/baseview.js).
// Why: three.js puts the number of point lights into every lit shader's program key, so each house lamp count (1..3 floors) needed its own copy of every lit
// shader: the first ride card built 404 / 471 programs (Mac, diagnose 5) for lamp counts 0..most. Here each lamp is two vec4 uniforms (position + reach,
// colour x intensity) and one vec4 holds how many are lit, so one program per material serves every house and every night; the light math is three.js's own
// (getDistanceAttenuation + RE_Direct, decay 2), so the picture stays the same. A lamp at intensity 0 is skipped (no zero-intensity light is drawn); the real
// lights left are the sun, the sky fill and the player's shadow light (owner's rule: 2-3 real lights).
// Use: installHouseLamps(max) once, before any lit shader is built; houseLamp(intensity, distance, color) makes a lamp (an Object3D placed like a light, with
// .intensity / .distance / .color); addLamp / listHouseLamps register lamps; bindHouseLamps(scene) makes the scene's draws use the registered lamps that are
// in it (visible chain); any other scene's draws (the hands) see no lamps.
import * as THREE from 'three';

const LAMPS = [];
let MAX = 0, C = null, P = null, Q = null, OFF = false, LASTN = 0, OVER = 0; const DRAWN = [];
// (pixel test only) the shader lamps switched off, so stand-in THREE lights can draw the same lamps for comparison
export function houseLampsForceOff(v) { OFF = !!v; }

export function installHouseLamps(max) {
  if (MAX || !(max > 0)) return; MAX = max | 0;
  // (worker 7) the lamps as two vec4 arrays read in a loop that stops at the lit count: software GL ran all 10 unrolled lamp branches in every lit pixel (frames 2x)
  C = { value: new Float32Array(4) }; P = { value: new Float32Array(4 * MAX) }; Q = { value: new Float32Array(4 * MAX) };
  // a Float32Array value is passed on by reference when three.js copies a material's uniforms (UniformsUtils.cloneUniforms), so every material reads the
  // same arrays and nothing is copied per material; hlP / hlC are vec4 arrays (one uniform4fv each when a material's uniforms are sent)
  for (const k of ['lambert', 'phong', 'standard', 'physical', 'toon']) {
    const U = THREE.ShaderLib[k] && THREE.ShaderLib[k].uniforms; if (!U) continue;
    U.hlN = C; U.hlP = P; U.hlC = Q;
  }
  const decl = '\nuniform vec4 hlN;\nuniform vec4 hlP[ ' + MAX + ' ];\nuniform vec4 hlC[ ' + MAX + ' ];\n';
  THREE.ShaderChunk.lights_pars_begin += decl;
  // lamp i: position hlP[i].xyz (world), reach hlP[i].w, colour x intensity hlC[i].rgb, decay 2 (three.js PointLight's default and the game's)
  // lamp i runs while hlN.x > i + 0.5 (the same test and the same math, lamp by lamp in the same order as the unrolled form); the loop ends at the first unlit one
  const body = '\n#if defined( RE_Direct )\n' +
    '\tfor ( int hlI = 0; hlI < ' + MAX + '; hlI ++ ) {\n' +
    '\t\tif ( hlN.x <= float( hlI ) + 0.5 ) break;\n' +
    '\t\tvec3 hlV = ( viewMatrix * vec4( hlP[ hlI ].xyz, 1.0 ) ).xyz - geometryPosition;\n' +
    '\t\tfloat hlD = length( hlV );\n' +
    '\t\tdirectLight.direction = normalize( hlV );\n' +
    '\t\tdirectLight.color = hlC[ hlI ].rgb * getDistanceAttenuation( hlD, hlP[ hlI ].w, 2.0 );\n' +
    '\t\tdirectLight.visible = ( directLight.color != vec3( 0.0 ) );\n' +
    '\t\tRE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n' +
    '\t}\n#endif\n';
  const SRC = THREE.ShaderChunk.lights_fragment_begin, AT = '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )';
  // the standard shader's multiple-scattering term is worked out only when the scene has a direct light; the lamps are direct lights too
  const MS = '#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )';
  if (SRC.indexOf(AT) < 0 || SRC.indexOf(MS) < 0) throw new Error('houselamps: three.js light chunk changed');
  THREE.ShaderChunk.lights_fragment_begin = SRC.replace(MS, '#if 1').replace(AT, body + AT);
}

export const houseLampsOn = () => MAX > 0;

export function houseLamp(intensity, distance, color = 0xffe0a0) {
  const o = new THREE.Object3D(); o.intensity = intensity; o.distance = distance; o.color = new THREE.Color(color); o.userData.houseLamp = true; return o;
}

// the lamps of a scene are gathered at each of its draws (scene.onBeforeRender, after three.js has updated the matrices) and cleared after it
function inScene(o, scene) { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === scene) return true; } return false; }
export function bindHouseLamps(scene) {
  if (!MAX) return;
  // a lamp at intensity 0 (or hidden, or not in this scene) is not drawn at all: no zero-intensity light costs anything
  scene.onBeforeRender = () => {
    let n = 0; DRAWN.length = 0;
    for (const o of LAMPS) {
      if (OFF || n >= MAX || !(o.intensity > 0) || !inScene(o, scene)) continue;
      const e = o.matrixWorld.elements, v = P.value, c = Q.value, k = n * 4;
      v[k] = e[12]; v[k + 1] = e[13]; v[k + 2] = e[14]; v[k + 3] = o.distance; c[k] = o.color.r * o.intensity; c[k + 1] = o.color.g * o.intensity; c[k + 2] = o.color.b * o.intensity;
      DRAWN.push(o); n++;
    }
    C.value[0] = n; LASTN = n; if (n >= MAX) OVER++;
  };
  scene.onAfterRender = () => { C.value[0] = 0; };
}

// a house's lamps are listed while they exist (add when built, drop when the house is dropped)
export function addLamp(o) { if (!LAMPS.includes(o)) LAMPS.push(o); return o; }
export function listHouseLamps(root) { root.traverse((o) => { if (o.userData.houseLamp && !LAMPS.includes(o)) LAMPS.push(o); }); }
export function unlistHouseLamps(root) { root.traverse((o) => { const i = LAMPS.indexOf(o); if (i >= 0) LAMPS.splice(i, 1); }); }
export const houseLampState = () => ({ max: MAX, listed: LAMPS.length, drawn: LASTN, full: OVER });
export const houseLampList = () => LAMPS.slice();
// the lamps the last draw of the bound scene used (the pixel test stands real lights in for exactly these)
export const houseLampsDrawn = () => DRAWN.slice();
