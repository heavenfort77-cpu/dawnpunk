// Marla the Scout as a real character in the base (user, 2026-11-14: "wire Marla in").
// The model is the light export of the character builder (art/models/marla.glb, packed into modeldata.js): skinned, with three face shapes (smile, grin, puzzled).
// One instance only; it is parked outside any scene when the base is torn down, so nobody disposes it.
import { GRITTY, GRIT } from './look.js';
import * as THREE from 'three';
import { withKtx2 } from './ktx2.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// (R3) the model files are stored with lossless EXT_meshopt_compression (build.mjs, tools/meshopt_glb.mjs): the loader decodes them with three.js's decoder
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MODELS, liteModel } from './modeldata.js';
import { QUALITY } from './quality.js';
import { hiMat, hiLights } from './marlahi.js';
import { lamps, lampRoot } from './shaderlamps.js';
import { createStepper } from './people.js';
import { cullSkinned, lodPrepare } from './lod.js';

// `key` picks the model in src/modeldata.js: 'marla', or a villager ('bram', 'oko', 'pip'). Villagers have a neutral face only.
export function createMarla(cfg, key = 'marla') {
  const root = new THREE.Group(); root.userData.keep = true; let ready = false, bones = {}, faces = [], faceW = {}, mood = 0, moodTo = 0, look = 0, t = 0, onReady = null;
  // desktop closed smile (owner approved Nov 16 23:29): hiModel = the desktop model loaded (it carries expr_smileClosed and expr_smileClosedSym); smile = its eased weight, 0..1 of CONFIG.marlaHi.smile.strength
  let hiModel = false, smile = 0, stepper = null, lookV = 0, lookAcc = 0;
  // LAG FIX Nov 19 (owner 11:40): the light model (a file, src/modeldata.js) is fetched only when it is used (phones, or the desktop model failing), not decoded at every start
  const lite = () => liteModel(key).then((b) => go(b, false)).catch((e) => console.error(key + ' light model failed to load', e));
  const HI = QUALITY === 'high' && cfg.marlaHi && cfg.marlaHi.files[key];      // desktops and laptops: her own high model and materials (src/marlahi.js); phones: the packed light model
  // (R4 worker 11, owner: Marla flat on LOW, CONFIG.marla.lowLamps) the light model has no key/rim light (medium has a key SpotLight and a rim PointLight on her,
  // src/marlahi.js hiLights): her own materials work out the same two lamps in their shader (no real light, no shadow, nobody else lit); the lamp places are set in
  // view space just before each of her pieces is drawn (vectors reused, no allocation)
  const LLC = cfg.marla.lowLamps, lampU = LLC && LLC.on && key === 'marla' ? { mlKeyP: { value: new THREE.Vector3() }, mlKeyD: { value: new THREE.Vector3() }, mlKeyC: { value: new THREE.Color(LLC.key[0]).multiplyScalar(LLC.key[1]) }, mlKeyR: { value: LLC.key[2] },
    mlKeyCos: { value: new THREE.Vector2(Math.cos(LLC.key[3]), Math.cos(LLC.key[3] * (1 - LLC.key[4]))) }, mlRimP: { value: new THREE.Vector3() }, mlRimC: { value: new THREE.Color(LLC.rim[0]).multiplyScalar(LLC.rim[1]) }, mlRimR: { value: LLC.rim[2] } } : null;
  const lampT = new THREE.Vector3(), lampHead = (c) => { const W = root.matrixWorld, V = c.matrixWorldInverse, kp = lampU.mlKeyP.value; kp.fromArray(LLC.keyAt).applyMatrix4(W).applyMatrix4(V); lampT.set(0, LLC.headY, 0).applyMatrix4(W).applyMatrix4(V);
    lampU.mlKeyD.value.subVectors(kp, lampT).normalize(); lampU.mlRimP.value.fromArray(LLC.rimAt).applyMatrix4(W).applyMatrix4(V); };
  const LAMP_GLSL = '#include <lights_fragment_end>\n{ vec3 mlP = - vViewPosition; vec3 mlL = mlKeyP - mlP; float mlD = length( mlL ); mlL /= max( mlD, 1e-4 );\n'
    + 'float mlA = smoothstep( mlKeyCos.x, mlKeyCos.y, dot( mlL, mlKeyD ) ) * getDistanceAttenuation( mlD, mlKeyR, 2.0 );\n'
    + 'reflectedLight.directDiffuse += saturate( dot( normal, mlL ) ) * mlA * mlKeyC * BRDF_Lambert( diffuseColor.rgb );\n'
    + 'mlL = mlRimP - mlP; mlD = length( mlL ); mlL /= max( mlD, 1e-4 );\n'
    + 'reflectedLight.directDiffuse += saturate( dot( normal, mlL ) ) * getDistanceAttenuation( mlD, mlRimR, 2.0 ) * mlRimC * BRDF_Lambert( diffuseColor.rgb ); }';
  const lampMat = (n, o) => { n.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, lampU); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 mlKeyP; uniform vec3 mlKeyD; uniform vec3 mlKeyC; uniform float mlKeyR; uniform vec2 mlKeyCos; uniform vec3 mlRimP; uniform vec3 mlRimC; uniform float mlRimR;').replace('#include <lights_fragment_end>', LAMP_GLSL); };
    n.customProgramCacheKey = () => 'marlaLamps'; o.onBeforeRender = (r, s, c) => lampHead(c); };
  const go = (buf, isHi) => withKtx2(new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)).parse(buf, '', (gltf) => {
    const sc = gltf.scene; sc.traverse((o) => {
      o.userData.keep = true; if (o.isBone) bones[o.name] = o;
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const conv = (m) => { if (isHi) return hiMat(m, o, cfg.marlaHi); const cut = m.alphaTest > 0 || m.transparent; const skin = /skin|face|head|body|hand|lip|eye/i.test(m.name || ''), col = m.color.clone(); if (GRITTY && !skin) { const h = {}; col.getHSL(h); col.setHSL(h.h, h.s * GRIT.clothSat, h.l * GRIT.clothLight); } const n = GRITTY ? new THREE.MeshPhongMaterial({ map: m.map || null, color: col, shininess: skin ? GRIT.skinShine : GRIT.clothShine, specular: skin ? 0x2a211d : 0x0c0c0c, alphaTest: cut ? Math.max(m.alphaTest, 0.4) : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide }) : new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color, alphaTest: cut ? Math.max(m.alphaTest, 0.4) : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide }); n.name = m.name; n.userData.keep = true; if (lampU) lampMat(n, o); m.dispose(); return n; }; // same simple lighting as the rest of the game
        o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); if (o.morphTargetDictionary) { faces.push(o); faceW = {}; } }
    });
    // out of the build's A-pose into a relaxed stand: arms down, a little weight on one leg
    const P = cfg.marla.pose, turn = (b, ax, ang) => { if (!b) return; sc.updateMatrixWorld(true); const pw = b.parent.getWorldQuaternion(new THREE.Quaternion()), rw = new THREE.Quaternion().setFromAxisAngle(ax, ang); b.quaternion.premultiply(pw.clone().invert().multiply(rw).multiply(pw)); }; // a turn about a world axis, whatever the bone's parents are doing
    const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
    for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1; turn(bones['upperarm_' + s], Z, -sg * P.armDown); turn(bones['lowerarm_' + s], Z, -sg * P.elbow); turn(bones['lowerarm_' + s], X, -P.elbowFwd); }
    for (const k of ['thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r']) if (bones[k]) rest[k] = bones[k].quaternion.clone();
    { sc.updateMatrixWorld(true); const a = new THREE.Vector3(), b = new THREE.Vector3(); if (bones.thigh_l && bones.foot_l) { bones.thigh_l.getWorldPosition(a); bones.foot_l.getWorldPosition(b); legLen = Math.max(0.3, a.y - b.y); } }
    scn = sc; root.add(sc);
    // LAG FIX Nov 19: culled again with a grown sphere (every tier), and on the desktop builds a reduced copy of the big meshes past CONFIG.lag.lod.kinds.people.near metres (src/lod.js)
    sc.traverse((q) => { if (q.isMesh) cullSkinned(q); }); if (QUALITY === 'high') lodPrepare(sc, 'people', true);
    // (OWNER DECISION Nov 20 14:15, CONFIG.lag.shaderLamps) no real key spot and rim lamp on her: the same two lamps worked out in her materials (src/shaderlamps.js)
    if (isHi) { const SL = cfg.lag && cfg.lag.shaderLamps, H = cfg.marlaHi; hiLights(root, H, SL); if (SL) lampRoot(root, lamps({ key: H.key, cone: H.keyShadow[1], penumbra: 0.6, keyAt: H.keyAt, headY: H.headY, rim: H.rim, rimAt: H.rimAt, root })); } hiModel = !!isHi; ready = true; if (onReady) onReady();
  }, (e) => console.error(key + ' model failed to load', e));
  // a page opened straight from a folder (file://) cannot fetch a model file beside it: play index_single.html from a folder (it carries every model inside)
  if (HI && (HI.startsWith('data:') || location.protocol !== 'file:')) fetch(HI).then((r) => { if (!r.ok) throw new Error('no file'); return r.arrayBuffer(); }).then((b) => go(b, true)).catch(() => lite()); else lite();
  // swing a bone about the model's own left-right axis, from its rest pose
  const rest = {}, qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qr = new THREE.Quaternion(), XA = new THREE.Vector3(1, 0, 0); let step = 0, legLen = 0.8, scn = null;
  const swing = (k, ang) => { const b = bones[k]; if (!b || !rest[k]) return; root.getWorldQuaternion(qr); b.parent.getWorldQuaternion(qa); qa.premultiply(qr.invert()); qb.setFromAxisAngle(XA, ang); b.quaternion.copy(qa).invert().multiply(qb).multiply(qa).multiply(rest[k]); };
  // LAG FIX Nov 19 (owner 11:27): a face shape is set only when its weight changed (it was looked up by name on every face mesh, three times a frame)
  const setFace = (name, v) => { if (faceW[name] === v) return; faceW[name] = v; for (const m of faces) { const i = m.morphTargetDictionary['expr_' + name]; if (i !== undefined) m.morphTargetInfluences[i] = v; } };
  return {
    root, get ready() { return ready; }, whenReady(f) { if (ready) f(); else onReady = f; },
    talk(on) { moodTo = on ? 1 : 0; },
    // turning: want = the facing she should take (rad, her holder's frame) or null; she gets there in pivot steps with her feet held (src/people.js createStepper)
    turn(dt, want) { if (!ready) return; if (!stepper) stepper = createStepper(cfg, root, bones, 'woman'); stepper.turn(dt, want); },
    // walking: legs and arms swing in step (amt 0 = stand still, 1 = full stride at `pace` steps per second)
    walk(dt, speed) {
      if (!ready) return; const W = cfg.marla.walk, A = W.stride, T = (legLen * 2 * A) / (W.stance * Math.max(0.1, speed)); step = (step + dt / T) % 1; // the step time comes from the leg length and the ground speed, so a planted foot does not slide
      const leg = (ph) => { const p = (step + ph) % 1; if (p < W.stance) return [-A + 2 * A * (p / W.stance), 0]; const q = (p - W.stance) / (1 - W.stance), e = q * q * (3 - 2 * q); return [A - 2 * A * e, W.knee * Math.sin(Math.PI * q)]; };
      const L = leg(0), R = leg(0.5); swing('thigh_l', L[0] - L[1] * 0.5); swing('calf_l', L[1]); swing('thigh_r', R[0] - R[1] * 0.5); swing('calf_r', R[1]);
      swing('upperarm_l', -R[0] * W.arm); swing('upperarm_r', -L[0] * W.arm); swing('lowerarm_l', -W.elbow); swing('lowerarm_r', -W.elbow);
      if (scn) scn.position.y = -Math.abs(Math.sin(step * 2 * Math.PI)) * W.bob; },                       // she smiles while you talk to her
    // dt, and where the player is relative to her (model space: +z is her front)
    update(dt, dx, dz, near) {
      if (!ready) return; t += dt; mood += (moodTo - mood) * Math.min(1, dt * 4);
      // desktop: the closed smile while she talks to you (same moments and hold as the phone smile), eased in and out over CONFIG.marlaHi.smile.easeIn / easeOut seconds; grin and puzzled stay off (made for the old face)
      const SM = cfg.marlaHi && cfg.marlaHi.smile;
      if (hiModel && SM && SM.on) { const up = moodTo > 0; smile = up ? Math.min(1, smile + dt / Math.max(0.01, SM.easeIn)) : Math.max(0, smile - dt / Math.max(0.01, SM.easeOut)); const w = smile * smile * (3 - 2 * smile) * SM.strength, sy = Math.min(1, Math.max(0, SM.sym || 0)); setFace('smileClosed', w * (1 - sy)); setFace('smileClosedSym', w * sy); setFace('smile', 0); setFace('grin', 0); setFace('puzzled', 0); }
      else if (hiModel) { setFace('smile', 0); setFace('grin', 0); setFace('puzzled', 0); }
      else if (cfg.marla.expressions) { setFace('smile', mood * 0.9); setFace('grin', 0); setFace('puzzled', near && !moodTo ? 0.35 : 0); }
      // the head turns to you on a critically damped spring (CONFIG.marla.lookHz), stepped in fixed slices so it is the same at any frame rate
      const want = near ? Math.max(-0.9, Math.min(0.9, Math.atan2(dx, dz))) : 0, w = 2 * Math.PI * cfg.marla.lookHz; lookAcc += dt; while (lookAcc >= 1 / 120) { lookAcc -= 1 / 120; lookV += (w * w * (want - look) - 2 * w * lookV) / 120; look += lookV / 120; }
      const h = bones.head, n = bones.neck_01, sp = bones.spine_02 || bones.spine_01; if (h) h.rotation.y = look * 0.6; if (n) n.rotation.y = look * 0.4; if (sp) sp.rotation.x = Math.sin(t * 1.4) * 0.012; // head follows you; a slow breath
      if (stepper) stepper.legs(dt);
    }
  };
}
