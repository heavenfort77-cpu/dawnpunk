// Uncanny Gloom motion (owner Nov 16: "gloom to move uncanny"). A layer over each machine's own night pose (the builders in gloomkit.js and gloomhi.js).
// It never moves the machine itself: main.js places it from the sim, so speed, path, arrival and hit boxes stay the same. It only decides WHEN the pose is updated
// (held poses, freezes, snaps) and adds small wrong touches on top (a head locked on the player, a knee that bends too far, a leg running late, gestures with too-even timing).
// It breaks on purpose what reads as alive in real motion (docs/muybridge-motion-reference.md): even linear timing in gestures, a head fixed in space while the body moves,
// holds with no settle, all joints catching up at once. Every number is in CONFIG.gloomMotion; CONFIG.gloomMotion.on = false (or ?gm=0) gives the old motion back.
import * as THREE from 'three';
import { CONFIG } from './config.js';

// main.js sets cam: the camera the heads lock on to
export const motionEye = { cam: null };
try { if (new URLSearchParams(location.search).get('gm') === '0') CONFIG.gloomMotion.on = false; } catch (e) { }

// a small seeded random stream per machine, so each one rolls its own rates and timings
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const MI = new THREE.Matrix4(), MR = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), QY = new THREE.Quaternion(), V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), QP = new THREE.Quaternion(), QL = new THREE.Quaternion(), QT = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), FWD = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const roll = (r, v) => (Array.isArray(v) ? v[0] + (v[1] - v[0]) * r() : v);
// a linear envelope: up in `ramp` s, flat, down in `ramp` s (no easing: machine-even)
const env = (x, len, ramp) => (x < 0 || x > len ? 0 : Math.min(1, x / ramp, (len - x) / ramp));

export function makeMotion(kind, P, g, seed) {
  const KC = CONFIG.gloomMotion.kinds[kind === 'walker2' ? 'walker' : kind];
  if (!KC) return null;
  const r = rng(Math.floor(seed * 4294967296) ^ 0x2545f491);
  const heads = (P.heads || (P.head ? [P.head] : [])).filter((h) => h && h.parent), legs = (P.legs || []).filter((L) => L && L.hip && L.knee), arms = (P.arms || []).filter(Boolean);
  const hz = roll(r, KC.hz), lockRate = roll(r, KC.lockRate), tiltDir = r() < 0.5 ? -1 : 1, mimicDir = r() < 0.5 ? -1 : 1;
  // the joints this layer touches: their pose as the builder left it is kept, and put back before the builder poses again
  const keep = [], byObj = new Map();
  const add = (o) => { if (!o || byObj.has(o)) return; const k = { o, q: o.quaternion.clone(), p: o.position.clone() }; keep.push(k); byObj.set(o, k); };
  heads.forEach(add); legs.forEach((L) => { add(L.hip); add(L.knee); }); arms.forEach((a) => { add(a); add(a.userData.fore); });
  const save = () => { for (const k of keep) { k.q.copy(k.o.quaternion); k.p.copy(k.o.position); } };
  const restore = () => { for (const k of keep) { k.o.quaternion.copy(k.q); k.o.position.copy(k.p); } };
  // each head's resting turn relative to the machine (taken now, while the machine stands at the origin facing -z)
  g.updateMatrixWorld(true);
  const rest = heads.map((h) => h.getWorldQuaternion(new THREE.Quaternion()));
  const restInv = rest.map((q) => q.clone().invert());
  // wrong joints: which knee bends too far, which leg runs late
  const overLeg = legs.length ? Math.floor(r() * legs.length) : -1, lagLeg = legs.length > 1 ? (overLeg + 1) % legs.length : -1, lagN = Math.round(KC.lag || 0);
  const ring = []; const kdir = overLeg >= 0 ? Math.sign(legs[overLeg].fwd || 1) : 1;
  const overFore = !legs.length ? arms.map((a) => a.userData.fore).find((f) => f && f.visible) : null;
  // each head's parent turn and the head's place, relative to the machine's root, taken when the pose changes (the body is held between poses, so per frame only the root's place and heading are new)
  const relQ = heads.map(() => new THREE.Quaternion()), relP = heads.map(() => new THREE.Vector3());
  const cacheRel = () => { g.updateWorldMatrix(true, false); MI.copy(g.matrixWorld).invert(); for (let i = 0; i < heads.length; i++) { heads[i].parent.updateWorldMatrix(true, false); MR.multiplyMatrices(MI, heads[i].parent.matrixWorld); MR.decompose(V2, relQ[i], V3); relP[i].copy(byObj.get(heads[i]).p).applyMatrix4(MR); } };
  let relOK = false;
  // eyeS: where this machine thinks the player is, following the real camera smoothly (lockRate); the heads aim at it exactly, wherever the body puts them
  const eyeS = new THREE.Vector3(), sp = heads.map(() => new THREE.Vector3());
  let t0 = -1, lastT = 0, nextTick = 0, nextFreeze = 0, freezeEnd = 0, snapEnd = 0, state = 0, pend = 0, inited = false, active = false;
  let tiltAt = 0, tiltLen = 0, tiltNext = 0, gest = null, gAt = 0, gLen = 0, gArm = null, gN = Math.floor(r() * 7);
  const stats = { poses: 0, freezes: 0, ends: 0, lines: 0, get frozen() { return state === 1; } };
  let posed = false, curPose = null, curT = 0;
  const doPose = (mv) => { restore(); curPose(curT, mv); save(); wrongJoints(); posed = true; relOK = false; stats.poses++; };
  const interval = () => (1 / hz) * (1 + (KC.jitter || 0) * (r() - 0.5));

  // after each held pose: the wrong joints, held with the pose
  function wrongJoints() {
    if (!CONFIG.gloomMotion.joints.on) return;
    if (overLeg >= 0) { const kn = legs[overLeg].knee, rest0 = 0.08 * kdir; kn.rotation.x = rest0 + (kn.rotation.x - rest0) * (1 + KC.over) - KC.hyper * kdir; }
    if (lagLeg >= 0 && lagN > 0) {
      const L = legs[lagLeg]; let slot = ring.length > lagN ? ring.shift() : null; if (!slot) slot = [new THREE.Quaternion(), new THREE.Quaternion()];
      slot[0].copy(L.hip.quaternion); slot[1].copy(L.knee.quaternion); ring.push(slot);
      L.hip.quaternion.copy(ring[0][0]); L.knee.quaternion.copy(ring[0][1]);
    }
    if (overFore) { QT.identity().slerp(overFore.quaternion, 1 + KC.over); overFore.quaternion.copy(QT); }
  }
  // the gesture copied from people while the screen talks: perfectly even, linear timing
  function gestureNow(t) {
    if (!gest || !CONFIG.gloomMotion.mimic.on) return null;
    const x = t - gAt, MC = CONFIG.gloomMotion.mimic;
    if (x > gLen) { gest = null; return null; }
    const e = env(x, gLen, MC.ramp);
    if (gest === 'tilt') return { roll: mimicDir * MC.tilt * e, pitch: 0 };
    if (gest === 'nod') { const per = gLen / MC.nods, f = (x % per) / per, v = f < 0.25 ? f * 4 : f < 0.5 ? 1 : f < 0.75 ? 1 - (f - 0.5) * 4 : 0; return { roll: 0, pitch: -MC.nod * v }; }
    return { roll: 0, pitch: 0, wave: e, x };
  }
  function doWave(w) {
    if (!gArm || !w) return; const MC = CONFIG.gloomMotion.mimic, k = byObj.get(gArm), s = Math.sign(k.p.x || gArm.position.x) || 1, fore = gArm.userData.fore;
    const per = MC.period, f = (w.x % per) / per, tri = f < 0.5 ? f * 4 - 1 : 3 - f * 4;
    gArm.rotation.z = gArm.rotation.z + (s * MC.wave - gArm.rotation.z) * w.wave;
    if (fore && fore.visible) fore.rotation.z += s * MC.swing * tri * w.wave; else gArm.rotation.z += s * MC.swing * 0.4 * tri * w.wave;
  }

  // every frame: t = seconds, mvFrame = metres moved this frame, pose(t, mv) = the builder's own pose
  function frame(t, mvFrame, pose) {
    const C = CONFIG.gloomMotion; active = true;
    if (t0 < 0) { t0 = t; lastT = t; nextTick = t; nextFreeze = t + roll(r, KC.freezeEvery) * (0.4 + 0.6 * r()); tiltNext = t + roll(r, KC.tiltEvery) * r(); }
    const dt = clamp(t - lastT, 0, 0.25); lastT = t; pend += mvFrame;
    posed = false; curPose = pose; curT = t;
    if (state === 0 && C.freeze.on && t >= nextFreeze) { state = 1; freezeEnd = t + roll(r, KC.freezeLen); stats.freezes++; }
    if (state === 1 && (t >= freezeEnd || !C.freeze.on)) { state = 2; snapEnd = t + KC.snap; stats.ends++; }
    if (state === 2) {
      const left = snapEnd - t, give = left <= 0 ? pend : pend * Math.min(1, dt / (left + dt)); pend -= give; doPose(give);
      if (left <= 0) { state = 0; pend = 0; nextFreeze = t + roll(r, KC.freezeEvery); nextTick = t + (hz ? interval() : 0); }
    } else if (state === 0 && (!C.stutter.on || !hz || t >= nextTick)) {
      doPose(pend); pend = 0;
      if (hz) { nextTick += interval(); if (nextTick < t) nextTick = t + interval(); }
    }
    // the parts that move every frame (head lock, head tilt, gestures) start again from the held pose
    const headFrozen = state === 1 && C.freeze.freezeHead;
    if (!posed) { for (const h of heads) if (!headFrozen) { const k = byObj.get(h); h.quaternion.copy(k.q); h.position.copy(k.p); } if (gArm) { const k = byObj.get(gArm); gArm.quaternion.copy(k.q); const f = gArm.userData.fore; if (f) f.quaternion.copy(byObj.get(f).q); } }
    if (C.joints.on && t >= tiltNext) { tiltAt = t; tiltLen = roll(r, KC.tiltHold); tiltNext = t + tiltLen + roll(r, KC.tiltEvery); }
    const tl = C.joints.on ? KC.tilt * tiltDir * env(t - tiltAt, tiltLen, 0.12) : 0, G = gestureNow(t);
    if (G && G.wave !== undefined) doWave(G);
    if (headFrozen) return;
    const cam = motionEye.cam, rollA = tl + (G ? G.roll : 0), pitchA = G ? G.pitch : 0;
    let near = 0;
    // a root with no real place this frame (main.js gives a Gloom a NaN height for the one frame it starts crossing an opening): no lock, so nothing NaN is kept
    if (C.lock.on && cam && Number.isFinite(g.position.x + g.position.y + g.position.z)) { const d = Math.hypot(cam.position.x - g.position.x, cam.position.z - g.position.z); near = (d < C.range ? 1 : d < C.range + 4 ? (C.range + 4 - d) / 4 : 0) * (KC.lockMix === undefined ? 1 : KC.lockMix); }
    // the root stands straight in the scene (the game's case): cheap path from the cached pose; anything else: the full world matrices
    if (near) { if (!inited) eyeS.copy(cam.position); else eyeS.lerp(cam.position, 1 - Math.exp(-lockRate * dt)); }
    const flat = near && g.parent && g.parent.isScene && !g.rotation.x && !g.rotation.z && g.scale.x === 1;
    if (near && flat && !relOK) { for (const h of heads) { const k = byObj.get(h); h.quaternion.copy(k.q); h.position.copy(k.p); } cacheRel(); relOK = true; }
    for (let i = 0; i < heads.length; i++) {
      const h = heads[i], k = byObj.get(h);
      if (!near) { if (rollA || pitchA) { E.set(pitchA, 0, rollA); h.quaternion.multiply(QT.setFromEuler(E)); } continue; }
      if (flat) { QY.setFromAxisAngle(UP, g.rotation.y); QP.copy(QY).multiply(relQ[i]); V.copy(relP[i]).applyQuaternion(QY).add(g.position); }
      else { const par = h.parent; par.updateWorldMatrix(true, false); par.matrixWorld.decompose(V2, QP, V3); V.copy(k.p).applyMatrix4(par.matrixWorld); }
      const dx = eyeS.x - V.x, dy = eyeS.y - V.y, dz = eyeS.z - V.z, by = g.rotation.y;
      const yawT = by + clamp(wrap(Math.atan2(-dx, -dz) - by), -KC.lockYaw, KC.lockYaw), pitchT = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -KC.lockPitch, KC.lockPitch);
      E.set(pitchT + pitchA, yawT, rollA); QL.setFromEuler(E).multiply(rest[i]);
      QT.copy(QP).invert().multiply(QL);
      if (!Number.isFinite(QT.x + QT.y + QT.z + QT.w)) continue;
      h.quaternion.copy(k.q).slerp(QT, near);
      // steady: the head keeps its own smooth path while the body bobs and sways under it (measured in the machine's frame, so walking forward is not cancelled)
      if (KC.steady) {
        const cy = Math.cos(-by), sy = Math.sin(-by), rx = V.x - g.position.x, rz = V.z - g.position.z, lx = rx * cy + rz * sy, lz = -rx * sy + rz * cy, ly = V.y - g.position.y;
        if (!inited) sp[i].set(lx, ly, lz); else { const a = 1 - Math.exp(-dt / 0.6); sp[i].x += (lx - sp[i].x) * a; sp[i].y += (ly - sp[i].y) * a; sp[i].z += (lz - sp[i].z) * a; }
        V2.set(sp[i].x - lx, sp[i].y - ly, sp[i].z - lz).multiplyScalar(KC.steady * near); const m = V2.length(), mx = C.lock.steadyMax; if (m > mx) V2.multiplyScalar(mx / m);
        const ox = V2.x * Math.cos(by) + V2.z * Math.sin(by), oz = -V2.x * Math.sin(by) + V2.z * Math.cos(by); V2.set(ox, V2.y, oz).applyQuaternion(QT.copy(QP).invert());
        h.position.copy(k.p).add(V2);
      }
    }
    inited = inited || near > 0;
  }
  // the screen starts a line: pick the next gesture this kind copies (a wave needs a free arm)
  function speak(len) {
    stats.lines++;
    if (!CONFIG.gloomMotion.mimic.on || !KC.gestures || !KC.gestures.length) return;
    gest = KC.gestures[gN++ % KC.gestures.length]; gAt = lastT; gLen = len; gArm = null;
    if (gest === 'wave') { let best = null, bz = 9; for (const a of arms) { const k = byObj.get(a), z = Math.abs(new THREE.Euler().setFromQuaternion(k.q).z); if (z < bz) { bz = z; best = a; } } gArm = best; if (!gArm) gest = 'nod'; }
  }
  // master switch turned off while running: give the builder its joints back
  function off() { if (!active) return; restore(); active = false; t0 = -1; pend = 0; state = 0; inited = false; gest = null; gArm = null; ring.length = 0; }
  // for the checks: how far head i aims from the player, in degrees (its resting turn taken out)
  function aimError(i = 0) {
    const cam = motionEye.cam, h = heads[i]; if (!cam || !h) return null;
    h.updateWorldMatrix(true, false); h.matrixWorld.decompose(V, QL, V3);
    FWD.set(0, 0, -1).applyQuaternion(QL.multiply(restInv[i]));
    V2.copy(cam.position).sub(V).normalize();
    return (Math.acos(clamp(FWD.dot(V2), -1, 1)) * 180) / Math.PI;
  }
  return { frame, speak, off, stats, aimError, heads, get gesture() { return gest; }, get gestureAt() { return gAt; } };
}
