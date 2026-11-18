// Desktop and laptop picture pass (2026-11-15; user: phones and desktops differ, "this includes everything"): everything on screen (houses, cars, Gloom, base, people)
// gets contact shading in creases, corners and under things (ambient occlusion). The picture itself is drawn exactly as on a phone; the shading is then laid over it,
// so no colour, sky or brightness changes. Phones never build this (CONFIG.quality.low.fx is off). Every number is in CONFIG.quality.high.fx.
import * as THREE from 'three';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { makeEnv, upgrade } from './pbr.js';
import { installGrade } from './scenehi.js';
export function createFx(renderer, scene, cam, F, P, hemi) {
  let env = null, tick = 0; const hemi0 = hemi.intensity || 1;
  // desktop scenery (src/scenehi.js): the colour grade after AgX (saturation, warmth, contrast by day; night unchanged); nothing happens when the scenery is off
  installGrade(renderer);
  if (P) { env = makeEnv(renderer, P); scene.environment = env; }
  // LAG FIX Nov 19 (owner approved): the shading pass runs at F.aoScale of the screen size (half width and height) with F.aoSamples samples, and leaves out things farther than F.aoFar m
  const sc = F.aoScale || 1, size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const ao = new GTAOPass(scene, cam, Math.max(1, Math.round(size.x * sc)), Math.max(1, Math.round(size.y * sc))); ao.updateGtaoMaterial({ radius: F.aoRadius, distanceExponent: 1, thickness: 1, scale: 1, samples: F.aoSamples, distanceFallOff: 1, screenSpaceRadius: false }); ao.output = GTAOPass.OUTPUT.Off;
  // noAO: the desktop scenery's swaying grass and flowers (src/scenehi.js) stay out too: the pass would see them unswayed, and their own vertex colours carry their dark roots
  // name labels (sprites), clear glass and cut-out cards (grass, leaves, flowers, hair) take no part in the contact shading: left in, a label came out as a black box and each card as a solid grey board
  // keepOut: pixels marked in the stencil buffer with this number (Marla's hair, src/marlahi.js) get no contact shading; without it the shading of whatever is behind
  // her hair (the hair is not in the shading pass) was laid over the hair: floor lines through her side hair, dark card shapes at her temples
  if (F.keepOut) { const b = ao.blendMaterial; b.stencilWrite = true; b.stencilWriteMask = 0; b.stencilRef = F.keepOut; b.stencilFunc = THREE.NotEqualStencilFunc; b.stencilFail = THREE.KeepStencilOp; b.stencilZFail = THREE.KeepStencilOp; b.stencilZPass = THREE.KeepStencilOp; }
  const ov = ao._overrideVisibility.bind(ao), rv = ao._restoreVisibility.bind(ao), hid = [];
  // far: a mesh whose bounding sphere lies wholly beyond F.aoFar m from the camera is left out of the shading pass too (its draw call and triangles are saved)
  const far2 = F.aoFar ? F.aoFar : 0, cp = new THREE.Vector3(), sp = new THREE.Vector3();
  const tooFar = (o) => { if (!far2 || !o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry) return false; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const b = g.boundingSphere; if (!b) return false;
    sp.copy(b.center).applyMatrix4(o.matrixWorld); const e = o.matrixWorld.elements, k = Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10])); return sp.distanceTo(cp) - b.radius * k > far2; };
  ao._overrideVisibility = () => { ov(); cp.setFromMatrixPosition(cam.matrixWorld); scene.traverse((o) => { if (o.visible && (o.isSprite || (o.material && !Array.isArray(o.material) && (o.material.transparent || o.material.alphaTest > 0)) || o.userData.noAO || tooFar(o))) { o.visible = false; hid.push(o); } }); };
  ao._restoreVisibility = () => { for (const o of hid) o.visible = true; hid.length = 0; rv(); };
  const render = () => { if (P) { if (tick-- <= 0) { tick = P.every; upgrade(scene, P); } scene.environmentIntensity = P.env * Math.min(1.5, hemi.intensity / P.hemiDay); } const h0 = hemi.intensity; if (P) hemi.intensity = h0 * P.hemiKeep; renderer.render(scene, cam); hemi.intensity = h0; if (!aoOn) return; ao.render(renderer, null, null); ao.blendMaterial.uniforms.intensity.value = F.ao; ao.blendMaterial.uniforms.tDiffuse.value = ao.pdRenderTarget.texture; ao._renderPass(renderer, ao.blendMaterial, null); };
  // F.ao 0 (the medium tier): no shading pass at all; setAO(false): the automatic step-down (src/perfstep.js) turns the contact shading off without a reload
  let aoOn = F.ao > 0;
  return { render, setSize: () => { const s = renderer.getDrawingBufferSize(new THREE.Vector2()); ao.setSize(Math.max(1, Math.round(s.x * sc)), Math.max(1, Math.round(s.y * sc))); }, ao, setAO: (v) => { aoOn = !!v; }, get aoOn() { return aoOn; } };
}
