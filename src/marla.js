// Marla the Scout as a real character in the base (user, 2026-11-14: "wire Marla in").
// The model is the light export of the character builder (art/models/marla.glb, packed into modeldata.js): skinned, with three face shapes (smile, grin, puzzled).
// One instance only; it is parked outside any scene when the base is torn down, so nobody disposes it.
import { GRITTY, GRIT } from './look.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODELS } from './modeldata.js';
import { QUALITY } from './quality.js';
import { hiMat, hiLights } from './marlahi.js';
import { createStepper } from './people.js';
import { cullSkinned, lodPrepare } from './lod.js';

// `key` picks the model in src/modeldata.js: 'marla', or a villager ('bram', 'oko', 'pip'). Villagers have a neutral face only.
export function createMarla(cfg, key = 'marla') {
  const root = new THREE.Group(); root.userData.keep = true; let ready = false, bones = {}, faces = [], mood = 0, moodTo = 0, look = 0, t = 0, onReady = null;
  // desktop closed smile (owner approved Nov 16 23:29): hiModel = the desktop model loaded (it carries expr_smileClosed and expr_smileClosedSym); smile = its eased weight, 0..1 of CONFIG.marlaHi.smile.strength
  let hiModel = false, smile = 0, stepper = null, lookV = 0, lookAcc = 0;
  const bin = Uint8Array.from(atob(MODELS[key]), (c) => c.charCodeAt(0)).buffer;
  const HI = QUALITY === 'high' && cfg.marlaHi && cfg.marlaHi.files[key];      // desktops and laptops: her own high model and materials (src/marlahi.js); phones: the packed light model
  const go = (buf, isHi) => new GLTFLoader().parse(buf, '', (gltf) => {
    const sc = gltf.scene; sc.traverse((o) => {
      o.userData.keep = true; if (o.isBone) bones[o.name] = o;
      if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; const conv = (m) => { if (isHi) return hiMat(m, o, cfg.marlaHi); const cut = m.alphaTest > 0 || m.transparent; const skin = /skin|face|head|body|hand|lip|eye/i.test(m.name || ''), col = m.color.clone(); if (GRITTY && !skin) { const h = {}; col.getHSL(h); col.setHSL(h.h, h.s * GRIT.clothSat, h.l * GRIT.clothLight); } const n = GRITTY ? new THREE.MeshPhongMaterial({ map: m.map || null, color: col, shininess: skin ? GRIT.skinShine : GRIT.clothShine, specular: skin ? 0x2a211d : 0x0c0c0c, alphaTest: cut ? Math.max(m.alphaTest, 0.4) : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide }) : new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color, alphaTest: cut ? Math.max(m.alphaTest, 0.4) : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide }); n.name = m.name; n.userData.keep = true; m.dispose(); return n; }; // same simple lighting as the rest of the game
        o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); if (o.morphTargetDictionary) faces.push(o); }
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
    if (isHi) hiLights(root, cfg.marlaHi); hiModel = !!isHi; ready = true; if (onReady) onReady();
  }, (e) => console.error(key + ' model failed to load', e));
  // a page opened straight from a folder (file://) cannot fetch the model file beside it: it then keeps the packed model (the single-file build carries the desktop model inside and is not affected)
  if (HI && (HI.startsWith('data:') || location.protocol !== 'file:')) fetch(HI).then((r) => { if (!r.ok) throw new Error('no file'); return r.arrayBuffer(); }).then((b) => go(b, true)).catch(() => go(bin, false)); else go(bin, false);
  // swing a bone about the model's own left-right axis, from its rest pose
  const rest = {}, qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qr = new THREE.Quaternion(), XA = new THREE.Vector3(1, 0, 0); let step = 0, legLen = 0.8, scn = null;
  const swing = (k, ang) => { const b = bones[k]; if (!b || !rest[k]) return; root.getWorldQuaternion(qr); b.parent.getWorldQuaternion(qa); qa.premultiply(qr.invert()); qb.setFromAxisAngle(XA, ang); b.quaternion.copy(qa).invert().multiply(qb).multiply(qa).multiply(rest[k]); };
  const setFace = (name, v) => { for (const m of faces) { const i = m.morphTargetDictionary['expr_' + name]; if (i !== undefined) m.morphTargetInfluences[i] = v; } };
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
