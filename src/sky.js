// The sky dome (2026-11-14): not a painted backdrop. A gradient from a hazy horizon to a deeper zenith, a sun (moon at night) with a glow,
// drifting noise clouds that are bright at the edges and grey in the middle, and stars. One shader, used by the settlement and the base.
// All numbers come from CONFIG.sky.
import * as THREE from 'three';
import { Q } from './quality.js';
import { skyOverride } from './scenehi.js';

const FRAG = `
varying vec3 vD;
uniform vec3 uZen, uHor, uSun, uSunCol, uCloudA, uCloudB;
uniform int uOct;
uniform float uNight, uT, uCov, uScale, uSoft, uDisc, uGlow, uStars;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { if (i >= uOct) break; s += a * vn(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vD); float h = d.y, sd = max(dot(d, uSun), 0.0);
  vec3 col = mix(uHor, uZen, pow(clamp(h, 0.0, 1.0), 0.42));
  col += uSunCol * (pow(sd, 6.0) * 0.16 + pow(sd, 70.0) * 0.4) * uGlow;
  if (uNight > 0.01) { vec3 q = d * 150.0, c = floor(q); float r = fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    col += vec3(0.85, 0.92, 1.0) * step(1.0 - uStars, r) * smoothstep(0.45, 0.05, length(fract(q) - 0.5)) * uNight * smoothstep(0.02, 0.3, h) * (0.4 + 0.6 * fract(r * 71.0)); }
  float disc = smoothstep(uDisc, uDisc + 0.00035, sd);
  col = mix(col, uSunCol * (1.0 - 0.25 * uNight * vn(d.xy * 60.0)), disc);
  float fade = smoothstep(0.02, 0.28, h);
  if (fade > 0.0) { vec2 p = d.xz / (h + 0.22) * uScale + uT * vec2(0.011, 0.004); p += 0.55 * vec2(vn(p * 0.9 + 3.1), vn(p * 0.9 - 7.7));
    float n = fbm(p), dens = smoothstep(uCov, uCov + uSoft, n), thick = smoothstep(uCov, uCov + 0.5, n);
    vec3 cc = mix(uCloudA, uCloudB, thick * 0.8) + uSunCol * pow(sd, 9.0) * (1.0 - thick) * 0.45 * uGlow;
    col = mix(col, cc, dens * fade * 0.94); }
  col = mix(col, uHor * 0.82, smoothstep(0.0, -0.25, h));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createSky(cfg) {
  const S = skyOverride(cfg.sky), C = (h) => new THREE.Color(h), u = { uZen: { value: C(S.zenith[0]) }, uHor: { value: C(S.horizon) }, uSun: { value: new THREE.Vector3(35, 48, -70).normalize() }, uSunCol: { value: C(S.sun[0]) }, uCloudA: { value: C(S.cloudLit[0]) }, uCloudB: { value: C(S.cloudCore[0]) },
    uNight: { value: 0 }, uT: { value: 0 }, uCov: { value: S.cover }, uScale: { value: S.scale }, uSoft: { value: S.soft }, uDisc: { value: S.disc }, uGlow: { value: 1 }, uStars: { value: S.stars }, uOct: { value: Math.max(2, Math.min(6, Math.round(Q.skyDetail))) } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false, fragmentShader: FRAG,
    vertexShader: 'varying vec3 vD; void main() { vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }' });
  mat.userData.shared = true;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), mat); mesh.frustumCulled = false; mesh.renderOrder = 900; mesh.userData.keep = true;
  const a = new THREE.Color(), b = new THREE.Color(), three = (arr, k, out) => (k < 0.55 ? out.set(arr[0]).lerp(a.set(arr[1]), k / 0.55) : out.set(arr[1]).lerp(a.set(arr[2]), (k - 0.55) / 0.45));
  let slowT = 0, slowN = 0, strain = 0;
  // strain: how many times the frame was still too slow after the clouds were at their cheapest; the game sheds other costs by it (the machines' screen lights first)
  return { mesh, get detail() { return u.uOct.value; }, get strain() { return strain; },
    // slow device: when the average frame over `watch` frames is longer than `slowMs`, drop one cloud layer (never below 2)
    pace(dt) { if (!mesh.visible || dt <= 0) return; slowT += dt; if (++slowN >= S.watch) { if (slowT / slowN * 1000 > S.slowMs) { if (u.uOct.value > 2) u.uOct.value--; else strain++; } slowT = 0; slowN = 0; } },
    // k: 0 day, 0.55 dusk, 1 night. dawn: 0..1 pulls the night back toward morning. horizon: the fog colour, so the sky meets the ground
    set(k, dawn, horizon) { const kk = Math.max(0, k - dawn * 0.6); three(S.zenith, kk, u.uZen.value); three(S.sun, kk, u.uSunCol.value); three(S.cloudLit, kk, u.uCloudA.value); three(S.cloudCore, kk, u.uCloudB.value);
      if (horizon) u.uHor.value.copy(horizon); u.uNight.value = Math.max(0, Math.min(1, (kk - 0.6) / 0.4)); u.uGlow.value = 1 - 0.65 * u.uNight.value; b.copy(u.uZen.value); },
    // the dome rides on the camera; `turn` is the world's own turn (inside a house the world is rotated), so the sun stays over the same roofs
    sun(x, y, z) { u.uSun.value.set(x, y, z).normalize(); },
    follow(cam, turn, dt) { this.pace(dt); mesh.position.copy(cam.position); mesh.rotation.y = turn || 0; u.uT.value += dt * S.wind; } };
}
