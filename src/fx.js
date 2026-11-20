// Desktop and laptop picture pass (2026-11-15; user: phones and desktops differ, "this includes everything"): everything on screen (houses, cars, Gloom, base, people)
// gets contact shading in creases, corners and under things (ambient occlusion). The picture itself is drawn exactly as on a phone; the shading is then laid over it,
// so no colour, sky or brightness changes. Phones never build this (CONFIG.quality.low.fx is off). Every number is in CONFIG.quality.high.fx.
import * as THREE from 'three';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { makeEnv, upgrade } from './pbr.js';
import { installGrade } from './scenehi.js';
import { CONFIG } from './config.js';
export function createFx(renderer, scene, cam, F, P, hemi) {
  let env = null, tick = 0; const hemi0 = hemi.intensity || 1;
  // desktop scenery (src/scenehi.js): the colour grade after AgX (saturation, warmth, contrast by day; night unchanged); nothing happens when the scenery is off
  installGrade(renderer);
  if (P) { env = makeEnv(renderer, P); scene.environment = env; }
  // (LAG FIX Nov 19, owner 10:35) a thing added straight to the scene gets its physically based surfaces at once; the whole scene is walked again only every
  // P.every x CONFIG.lag.pbrWalk frames, for pieces added deeper (into groups already in the scene) and for the loading cards' upgradeNow
  if (P && CONFIG.lag.pbrWalk > 1) { const add0 = scene.add.bind(scene); scene.add = (...objs) => { const r = add0(...objs); for (const o of objs) if (o && o.traverse) upgrade(o, P); return r; }; }
  // LAG FIX Nov 19 (owner approved): the shading pass runs at F.aoScale of the screen size (half width and height) with F.aoSamples samples, and leaves out things farther than F.aoFar m
  const sc = F.aoScale || 1, size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // (owner 11:40) the pass is built only for a tier that uses it (F.ao > 0); the medium tier built it and never drew it
  const ao = !(F.ao > 0) ? null : new GTAOPass(scene, cam, Math.max(1, Math.round(size.x * sc)), Math.max(1, Math.round(size.y * sc))); if (ao) ao.updateGtaoMaterial({ radius: F.aoRadius, distanceExponent: 1, thickness: 1, scale: 1, samples: F.aoSamples, distanceFallOff: 1, screenSpaceRadius: false }); if (ao) ao.output = GTAOPass.OUTPUT.Off;
  // noAO: the desktop scenery's swaying grass and flowers (src/scenehi.js) stay out too: the pass would see them unswayed, and their own vertex colours carry their dark roots
  // name labels (sprites), clear glass and cut-out cards (grass, leaves, flowers, hair) take no part in the contact shading: left in, a label came out as a black box and each card as a solid grey board
  // keepOut: pixels marked in the stencil buffer with this number (Marla's hair, src/marlahi.js) get no contact shading; without it the shading of whatever is behind
  // her hair (the hair is not in the shading pass) was laid over the hair: floor lines through her side hair, dark card shapes at her temples
  if (F.keepOut && ao) { const b = ao.blendMaterial; b.stencilWrite = true; b.stencilWriteMask = 0; b.stencilRef = F.keepOut; b.stencilFunc = THREE.NotEqualStencilFunc; b.stencilFail = THREE.KeepStencilOp; b.stencilZFail = THREE.KeepStencilOp; b.stencilZPass = THREE.KeepStencilOp; }
  const ov = ao ? ao._overrideVisibility.bind(ao) : null, rv = ao ? ao._restoreVisibility.bind(ao) : null, hid = [];
  // far: a mesh whose bounding sphere lies wholly beyond F.aoFar m from the camera is left out of the shading pass too (its draw call and triangles are saved)
  const far2 = F.aoFar ? F.aoFar : 0, cp = new THREE.Vector3(), sp = new THREE.Vector3();
  const tooFar = (o) => { if (!far2 || !o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry) return false; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const b = g.boundingSphere; if (!b) return false;
    sp.copy(b.center).applyMatrix4(o.matrixWorld); const e = o.matrixWorld.elements, k = Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10])); return sp.distanceTo(cp) - b.radius * k > far2; };
  if (ao) ao._overrideVisibility = () => { ov(); cp.setFromMatrixPosition(cam.matrixWorld); scene.traverse((o) => { if (o.visible && (o.isSprite || (o.material && !Array.isArray(o.material) && (o.material.transparent || o.material.alphaTest > 0)) || o.userData.noAO || tooFar(o))) { o.visible = false; hid.push(o); } }); };
  if (ao) ao._restoreVisibility = () => { for (const o of hid) o.visible = true; hid.length = 0; rv(); };
  const render = () => { if (P) { if (tick-- <= 0) { tick = P.every * Math.max(1, CONFIG.lag.pbrWalk); upgrade(scene, P); } scene.environmentIntensity = P.env * Math.min(1.5, hemi.intensity / P.hemiDay); } const h0 = hemi.intensity; if (P) hemi.intensity = h0 * P.hemiKeep; renderer.render(scene, cam); if (afterMain) afterMain(); hemi.intensity = h0; if (!aoOn || !ao) return; if (aoLayer) cam.layers.enable(aoLayer); try { ao.render(renderer, null, null); } finally { if (aoLayer) cam.layers.disable(aoLayer); } ao.blendMaterial.uniforms.intensity.value = F.ao; ao.blendMaterial.uniforms.tDiffuse.value = ao.pdRenderTarget.texture; ao._renderPass(renderer, ao.blendMaterial, null); };
  // F.ao 0 (the medium tier): no shading pass at all; setAO(false): the automatic step-down (src/perfstep.js) turns the contact shading off without a reload
  let aoOn = F.ao > 0;
  // afterMain: drawn right after the main picture, before the shading pass (Marla's own-light pass, src/main.js marlaPass); aoLayer: a layer the shading pass also sees (her pieces)
  let afterMain = null, aoLayer = 0;
  // upgradeNow: the loading card (src/main.js sceneCard) turns every new simple surface into its physically based form BEFORE it builds the shaders, so the first
  // frames after the card do not rebuild them (LAG FIX Nov 19: the night's first frame stalled 2.4 s on the real GPU)
  return { upgradeNow: () => { if (P) upgrade(scene, P); }, upgradeOne: (o) => { if (P && o) upgrade(o, P); }, render, setSize: () => { const s = renderer.getDrawingBufferSize(new THREE.Vector2()); if (ao) ao.setSize(Math.max(1, Math.round(s.x * sc)), Math.max(1, Math.round(s.y * sc))); }, ao, setAO: (v) => { aoOn = !!v && !!ao; }, get aoOn() { return aoOn; }, setAfterMain: (f, layer) => { afterMain = f; aoLayer = layer || 0; } };
}
