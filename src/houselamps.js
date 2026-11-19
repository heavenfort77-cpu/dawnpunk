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
let MAX = 0, C = null, P = [], Q = [], OFF = false, LASTN = 0, OVER = 0;
// (pixel test only) the shader lamps switched off, so stand-in THREE lights can draw the same lamps for comparison
export function houseLampsForceOff(v) { OFF = !!v; }

export function installHouseLamps(max) {
  if (MAX || !(max > 0)) return; MAX = max | 0;
  C = { value: new Float32Array(4) }; P = []; Q = [];
  for (let i = 0; i < MAX; i++) { P.push({ value: new Float32Array(4) }); Q.push({ value: new Float32Array(4) }); }
  // a Float32Array value is passed on by reference when three.js copies a material's uniforms (UniformsUtils.cloneUniforms), so every material reads the
  // same arrays and nothing is copied per material; each is a plain vec4 uniform, whose upload three.js skips while the value is unchanged
  for (const k of ['lambert', 'phong', 'standard', 'physical', 'toon']) {
    const U = THREE.ShaderLib[k] && THREE.ShaderLib[k].uniforms; if (!U) continue;
    U.hlN = C; for (let i = 0; i < MAX; i++) { U['hlP' + i] = P[i]; U['hlC' + i] = Q[i]; }
  }
  let decl = '\nuniform vec4 hlN;\n'; for (let i = 0; i < MAX; i++) decl += 'uniform vec4 hlP' + i + ';\nuniform vec4 hlC' + i + ';\n';
  THREE.ShaderChunk.lights_pars_begin += decl;
  // lamp i (while hlN.x > i): position hlP.xyz (world), reach hlP.w, colour x intensity hlC.rgb, decay 2 (three.js PointLight's default and the game's)
  let body = '\n#if defined( RE_Direct )\n';
  for (let i = 0; i < MAX; i++) {
    body += '\tif ( hlN.x > ' + i + '.5 ) {\n' +
      '\t\tvec3 hlV = ( viewMatrix * vec4( hlP' + i + '.xyz, 1.0 ) ).xyz - geometryPosition;\n' +
      '\t\tfloat hlD = length( hlV );\n' +
      '\t\tdirectLight.direction = normalize( hlV );\n' +
      '\t\tdirectLight.color = hlC' + i + '.rgb * getDistanceAttenuation( hlD, hlP' + i + '.w, 2.0 );\n' +
      '\t\tdirectLight.visible = ( directLight.color != vec3( 0.0 ) );\n' +
      '\t\tRE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n' +
      '\t}\n';
  }
  body += '#endif\n';
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
    let n = 0;
    for (const o of LAMPS) {
      if (OFF || n >= MAX || !(o.intensity > 0) || !inScene(o, scene)) continue;
      const e = o.matrixWorld.elements, v = P[n].value, c = Q[n].value;
      v[0] = e[12]; v[1] = e[13]; v[2] = e[14]; v[3] = o.distance; c[0] = o.color.r * o.intensity; c[1] = o.color.g * o.intensity; c[2] = o.color.b * o.intensity;
      n++;
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
