// The base people (Bram, Oko, Pip and the recruits) as real characters with natural motion (owner, Nov 16: "base people movement ... natural").
// Motion rules and numbers from Muybridge's photo studies (docs/muybridge-motion-reference.md): a fixed stride time per build (woman 1.0 s, man ~1.05 s, child 0.65 s),
// arm swing from the shoulder, hips over the standing foot, a few per cent random change in every step; turns led by the head, then the shoulders, then the hips,
// the feet last in two or three small pivot steps (never a spin on the spot); at rest a slow weight shift, breathing and a drifting gaze; loose parts (forearms,
// hands, head, chest lean) are springs that settle after the body stops. Every change is smoothed by time (1 - exp(-k dt) or springs stepped in fixed slices),
// so the motion is the same at any frame rate. Every number is in CONFIG.people. Marla keeps her own module (src/marla.js).
// The model is the packed light model (art/models/<key>.glb in src/modeldata.js); with CONFIG.people.scanFaces on, a person listed in CONFIG.people.scan loads
// their scan-kit face model instead (desktop file on the high tier, lighter phone file on the low tier; both in art/models_hi beside index.html).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GRITTY, GRIT } from './look.js';
import { MODELS } from './modeldata.js';
import { QUALITY } from './quality.js';
import { peopleHiMat, peopleHiLight, peopleHiCornea } from './peoplehi.js';

const XA = new THREE.Vector3(1, 0, 0), ZA = new THREE.Vector3(0, 0, 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sat = (v, m) => m * Math.tanh(v / m);
// a critically damped follower (frame-rate independent); s = { x, v }; maxV caps its speed (units per second)
function follow(s, target, time, dt, maxV) { if (dt <= 0) return s.x; const om = 2 / Math.max(1e-3, time), x = om * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x), lim = maxV ? maxV * time : Infinity, ch = clamp(s.x - target, -lim, lim), to = s.x - ch, tmp = (s.v + om * ch) * dt;
  s.v = (s.v - om * tmp) * e; let o = to + (ch + tmp) * e; if ((target - s.x > 0) === (o > target)) { o = target; s.v = 0; } s.x = o; return o; }
// a loose part: a damped spring stepped in slices of at most 1/240 s, so it settles the same at 20 or 60 frames a second; s = { x, v }
function spring(s, target, hz, damp, dt) { if (dt <= 0) return s.x; const w = 2 * Math.PI * hz, n = Math.ceil(dt * 240), h = dt / n; for (let i = 0; i < n; i++) { s.v += (w * w * (target - s.x) - 2 * damp * w * s.v) * h; s.x += s.v * h; } return s.x; }
// two-bone leg reach (world space): bends the knee so hip-to-foot is as long as hip-to-target, swings the thigh to point at it, and gives the foot back its own turn
const _H = new THREE.Vector3(), _K = new THREE.Vector3(), _F = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qf = new THREE.Quaternion();
function turnWorld(b, q) { b.parent.getWorldQuaternion(_qa); _qb.copy(_qa).invert().multiply(q).multiply(_qa); b.quaternion.premultiply(_qb); b.updateWorldMatrix(false, true); }
function legReach(th, ca, ft, T) {
  ft.getWorldQuaternion(_qf); th.getWorldPosition(_H); ca.getWorldPosition(_K); ft.getWorldPosition(_F);
  const a = _H.distanceTo(_K), b = _K.distanceTo(_F), d = clamp(_H.distanceTo(T), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  _u.subVectors(_H, _K); _w.subVectors(_F, _K); _n.crossVectors(_u, _w);
  if (_n.lengthSq() > 1e-10) { _n.normalize(); const cur = _u.angleTo(_w), want = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1)); _qb.setFromAxisAngle(_n, want - cur); turnWorld(ca, _qb.clone()); ft.getWorldPosition(_F); }
  _u.subVectors(_F, _H).normalize(); _w.subVectors(T, _H).normalize(); turnWorld(th, new THREE.Quaternion().setFromUnitVectors(_u, _w));
  ft.parent.getWorldQuaternion(_qa); ft.quaternion.copy(_qa.invert().multiply(_qf)); ft.updateWorldMatrix(false, true);
}
const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'];
let seedN = 0;
// scan faces: CONFIG.people.scanFaces, or ?scanfaces=1 / ?scanfaces=0 in the address for one visit (to compare before the owner approves)
const SCANON = (P) => { let q = null; try { q = new URLSearchParams(location.search).get('scanfaces'); } catch (e) { q = null; } return q === '1' ? true : q === '0' ? false : !!P.scanFaces; };

// phone materials: the same light materials the villagers had (src/marla.js), so the approved look does not change
function lowMat(m) {
  const cut = m.alphaTest > 0 || m.transparent, skin = /skin|face|head|body|hand|lip|eye/i.test(m.name || ''), col = m.color.clone();
  if (GRITTY && !skin) { const h = {}; col.getHSL(h); col.setHSL(h.h, h.s * GRIT.clothSat, h.l * GRIT.clothLight); }
  const n = GRITTY ? new THREE.MeshPhongMaterial({ map: m.map || null, color: col, shininess: skin ? GRIT.skinShine : GRIT.clothShine, specular: skin ? 0x2a211d : 0x0c0c0c, alphaTest: cut ? Math.max(m.alphaTest, 0.4) : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide })
    : new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color, alphaTest: cut ? Math.max(m.alphaTest, 0.4) : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide });
  n.name = m.name; n.userData.keep = true; m.dispose(); return n;
}
export function createPerson(cfg, key) {
  const P = cfg.people, kind = P.kinds[key] || 'man', G = Object.assign({}, P.gait[kind], (P.own && P.own[key]) || {}), T = P.turn, I = P.idle, S = P.settle;
  const root = new THREE.Group(); root.userData.keep = true; root.userData.person = key;
  let ready = false, scn = null, legLen = 0.8, headY = 1.55, wait = [], keyBid = null;
  const bones = {}, rest = {}, pm = {}, pmi = {}, pelvisRest = new THREE.Vector3(), pelvisM = new THREE.Matrix3();
  // a different random stream per person, so two people never shift their weight or breathe in step
  let rs = (++seedN * 2654435761 + key.length * 97) >>> 0; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const scan = SCANON(P) && P.scan && P.scan[key];
  // desktop light and materials for people keeping their approved face (CONFIG.peopleHi, high tier only): their desktop copy with baked soft shading, Marla-style skin, a cornea, the shared key
  // ?peoplehi=0 / ?peoplehi=1 in the address overrides CONFIG.peopleHi.on for one visit (before / after pictures)
  let phq = null; try { phq = new URLSearchParams(location.search).get('peoplehi'); } catch (e) { phq = null; }
  const PH = cfg.peopleHi, phOn = phq === '1' ? true : phq === '0' ? false : !!(PH && PH.on), hiCopy = !scan && QUALITY === 'high' && PH && phOn && PH.files && PH.files[key];
  const file = scan ? (QUALITY === 'high' ? scan.hi : scan.lo) : (hiCopy || null), isHi = !!((scan && QUALITY === 'high') || hiCopy), HM = scan ? P.hiMat : Object.assign({}, PH, (PH && PH.own && PH.own[key]) || {});
  const go = (buf, useScan) => new GLTFLoader().parse(buf, '', (gltf) => {
    const sc = gltf.scene; sc.traverse((o) => {
      o.userData.keep = true; if (o.isBone) bones[o.name] = o;
      if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; const conv = (m) => (useScan && isHi ? peopleHiMat(m, o, HM) : lowMat(m)); o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); }
    });
    // out of the build pose into a relaxed stand (arms down), as Marla's model
    const Q = P.pose, turn = (b, ax, ang) => { if (!b) return; sc.updateMatrixWorld(true); const pw = b.parent.getWorldQuaternion(new THREE.Quaternion()), rw = new THREE.Quaternion().setFromAxisAngle(ax, ang); b.quaternion.premultiply(pw.clone().invert().multiply(rw).multiply(pw)); };
    for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1; turn(bones['upperarm_' + s], ZA, -sg * Q.armDown); turn(bones['lowerarm_' + s], ZA, -sg * Q.elbow); turn(bones['lowerarm_' + s], XA, -Q.elbowFwd); }
    sc.updateMatrixWorld(true); const qs = sc.getWorldQuaternion(new THREE.Quaternion()).invert();
    // each bone's rest turn and its parent's rest turn in model space: a pose turn about a model axis is then parent^-1 * turn * parent * rest
    for (const k of BONES) { const b = bones[k]; if (!b) continue; rest[k] = b.quaternion.clone(); pm[k] = qs.clone().multiply(b.parent.getWorldQuaternion(new THREE.Quaternion())); pmi[k] = pm[k].clone().invert(); }
    if (bones.pelvis) { pelvisRest.copy(bones.pelvis.position); const m4 = new THREE.Matrix4().copy(sc.matrixWorld).invert().multiply(bones.pelvis.parent.matrixWorld); pelvisM.setFromMatrix4(m4).invert(); }
    { const a = new THREE.Vector3(), b = new THREE.Vector3(); if (bones.thigh_l && bones.foot_l) { bones.thigh_l.getWorldPosition(a); bones.foot_l.getWorldPosition(b); legLen = Math.max(0.3, a.y - b.y); } if (bones.head) headY = bones.head.getWorldPosition(new THREE.Vector3()).y - sc.getWorldPosition(new THREE.Vector3()).y; }
    scn = sc; root.add(sc); if (useScan && isHi) { keyBid = peopleHiLight(root, P.hiMat.key, cfg.marlaHi && cfg.marlaHi.keyBias); if (hiCopy) peopleHiCornea(sc, HM); } ready = true; const w0 = wait; wait = []; for (const f of w0) f();
  }, (e) => console.error(key + ' model failed to load', e));
  const packed = () => go(Uint8Array.from(atob(MODELS[key]), (c) => c.charCodeAt(0)).buffer, false);
  // a page opened straight from a folder (file://) cannot fetch a file beside it: it then keeps the packed (approved) model
  if (file && (file.startsWith('data:') || location.protocol !== 'file:')) fetch(file).then((r) => { if (!r.ok) throw new Error('no file'); return r.arrayBuffer(); }).then((b) => go(b, true)).catch(() => packed()); else packed();

  // ---- motion state
  const st = { time: 0, speed: { x: 0, v: 0 }, phase: rnd(), rate: 1, half: 0, head: { x: 0, v: 0 }, chest: { x: 0, v: 0 }, hips: { x: 0, v: 0 }, feet: 0, step: null, stepSide: 1, hist: [],
    pitch: { x: 0, v: 0 }, lean: { x: 0, v: 0 }, arm: [{ x: 0, v: 0 }, { x: 0, v: 0 }], fore: [{ x: 0, v: 0 }, { x: 0, v: 0 }], hand: [{ x: 0, v: 0 }, { x: 0, v: 0 }], nod: { x: 0, v: 0 },
    shift: { a: rnd() * 6.28, len: 0, x: 0, from: 0, to: rnd() < 0.5 ? -1 : 1, t: 0 }, breath: rnd() * 6.28, drift: [rnd() * 100, rnd() * 100], carry: { x: 0, v: 0 }, init: false };
  st.shift.len = I.shift[0] + rnd() * (I.shift[1] - I.shift[0]);
  const delayed = (d) => { const tt = st.time - d, h = st.hist; for (let i = h.length - 1; i >= 0; i--) if (h[i][0] <= tt) return h[i][1]; return h.length ? h[0][1] : st.head.x; };
  const pose = {}; for (const k of BONES) pose[k] = [0, 0, 0];
  const add = (k, x, y, z) => { const p = pose[k]; p[0] += x; p[1] += y; p[2] += z; };
  const eul = new THREE.Euler(), qE = new THREE.Quaternion(), off = new THREE.Vector3();
  function apply(px, py) {
    for (const k of BONES) { const b = bones[k], p = pose[k]; if (!b || !rest[k]) continue; eul.set(p[0], p[1], p[2], 'YXZ'); qE.setFromEuler(eul); b.quaternion.copy(pmi[k]).multiply(qE).multiply(pm[k]).multiply(rest[k]); }
    if (bones.pelvis) { off.set(px, py, 0).applyMatrix3(pelvisM); bones.pelvis.position.copy(pelvisRest).add(off); }
  }

  // o: { face: wanted facing (rad, the holder's frame; +z = 0), go: wants to walk, gaze: [x, y, z] point to look at (holder frame) or null, carry: holding a load in both arms,
  //      move: true = drive() walks the holder (root.parent) itself, in the same fixed slices, so the path is the same at any frame rate }
  // returns { speed (m/s, along the body's facing), yaw (the body's facing), moved } so a caller that does not pass move can move the holder
  // The motion runs in fixed slices of CONFIG.people.motion.slice s (a frame of 1/30 or 1/60 s is a whole number of slices), so 30 and 60 frames a second give the same motion.
  const M = P.motion, lock = [{ on: false, w: 0, rel: 9, T: new THREE.Vector3() }, { on: false, w: 0, rel: 9, T: new THREE.Vector3() }];
  st.acc = 0; st.feetV = 0; st.plant = [true, true]; st.hipX = 0; st.drop = 0;
  // the swing foot's path over the ground: speeds up over the first `ramp` share of the swing, keeps its pace, slows over the last `ramp` share (heel strike), so it never
  // rushes; returns the share of the step's ground covered at q (0..1 of the swing)
  const ramp = clamp(M.swingRamp, 0.05, 0.5), vPk = 1 / (1 - ramp);
  const swingW = (q) => { q = clamp(q, 0, 1); if (q < ramp) { const u = q / ramp; return vPk * ramp * (u * u * u - 0.5 * u * u * u * u); } if (q > 1 - ramp) return 1 - swingW(1 - q);
    return vPk * ramp * 0.5 + vPk * (q - ramp); };
  function slice(dt, o) {
    st.time += dt;
    for (const k of BONES) { const p = pose[k]; p[0] = p[1] = p[2] = 0; }
    // where to face: unwrapped next to the head so a turn always takes the short way
    let face = o.face == null ? st.feet : o.face, gy = null, gp = 0;
    if (o.gaze) { gy = Math.atan2(o.gaze[0], o.gaze[2]); }
    const want = st.head.x + wrap((gy == null ? face : gy) - st.head.x); face = st.feet + wrap(face - st.feet);
    st.hist.push([st.time, want]); while (st.hist.length > 2 && st.hist[1][0] < st.time - 1.5) st.hist.shift();
    // speed: eases in and out; slows for a bend and stops for a sharp one (then turns on the spot in pivot steps)
    const err = wrap(face - st.feet), wantV = o.go ? G.speed * (o.carry ? P.walk.carrySpeed : 1) * clamp((Math.cos(err) - P.walk.stopCos) / (1 - P.walk.stopCos), 0, 1) : 0;
    const v = Math.max(0, follow(st.speed, wantV, P.walk.blend, dt)), w = clamp(v / G.speed, 0, 1.2), gw = sstep(w / 0.35);
    // ---- the turn chain: head, then chest (lead s later), then hips (2 x lead), the feet last
    follow(st.head, want, T.follow[0], dt, T.maxSpeed[0]);
    follow(st.chest, delayed(T.lead), T.follow[1], dt, T.maxSpeed[1]);
    follow(st.hips, delayed(2 * T.lead), T.follow[2], dt, T.maxSpeed[2]);
    let lift = 0, liftSide = 0;
    // the feet: a pivot step, once started, always finishes (cutting it off dropped the lifted leg in one frame); walking, the feet follow the hips at a turn rate that
    // changes by at most M.turnAcc rad/s each second; a new pivot step starts only once that turn has slowed to a stop
    const ac = M.turnAcc * dt;
    if (st.step) { /* finished below */ } else if (gw > 0.2) { const goalV = clamp((st.hips.x - st.feet) * P.walk.follow, -P.walk.corner, P.walk.corner); st.feetV += clamp(goalV - st.feetV, -ac, ac); st.feet += st.feetV * dt; }
    else if (Math.abs(st.feetV) > 1e-3) { st.feetV -= clamp(st.feetV, -ac, ac); st.feet += st.feetV * dt; }
    else { st.feetV = 0; const e = st.hips.x - st.feet, goal = delayed(2 * T.lead) - st.feet; if (Math.abs(e) > T.stepStart || (Math.abs(e) > T.minStep && Math.abs(st.hips.v) < 0.3)) { const len = G.step * (1 + G.vary * (rnd() * 2 - 1)), cap = Math.min(T.maxStep, M.stepAcc * len * len / 6); let amt = clamp(e + st.hips.v * G.step * T.predict, -cap, cap); if (Math.abs(amt) > Math.abs(goal) && Math.sign(goal) === Math.sign(amt)) amt = goal; st.stepSide = amt > 0 ? 1 : -1; if (st.lastSide === st.stepSide) st.stepSide = -st.stepSide; st.lastSide = st.stepSide; st.step = { from: st.feet, by: amt, t: 0, len }; } }
    if (st.step) { const s = st.step; s.t += dt; const u = clamp(s.t / s.len, 0, 1); st.feet = s.from + s.by * sstep(u); st.feetV = s.by * 6 * u * (1 - u) / s.len; lift = Math.sin(Math.PI * u); liftSide = st.stepSide; if (u >= 1) { st.step = null; st.feetV = 0; } }
    if (!st.step && gw <= 0.2 && Math.abs(st.hips.x - st.feet) < T.minStep * 0.5) st.lastSide = 0;
    const hipOff = sat(st.hips.x - st.feet, T.twist), chestOff = sat(st.chest.x - (st.feet + hipOff), T.chestTwist), headOff = sat(st.head.x - (st.feet + hipOff + chestOff), T.headMax);
    // ---- gait (Muybridge: fixed stride time per build, leg swing from speed so planted feet do not slide, a little random change in every step)
    if (v > 0.01 || gw > 0.001) { const before = st.phase; st.phase += dt / (G.cycle * st.rate); if (Math.floor(before * 2) !== Math.floor(st.phase * 2)) st.rate = 1 + G.vary * (rnd() * 2 - 1); st.phase %= 1; }
    const S0 = G.stance, A = Math.asin(clamp((v * S0 * G.cycle) / (2 * legLen), 0, 0.7));
    // swing: the leg comes forward so the FOOT covers the ground on swingW's path (the body keeps moving meanwhile), which also carries on the stance leg's motion at toe-off
    const leg = (ph) => { const p = (st.phase + ph) % 1; if (p < S0) return [-A + 2 * A * (p / S0), G.kneeStance * Math.sin(Math.PI * p / S0)]; const q = (p - S0) / (1 - S0), e = (swingW(q) - (1 - S0) * q) / S0; return [A - 2 * A * e, G.knee * Math.sin(Math.PI * q) * (A / 0.45)]; };
    const L = leg(0), R = leg(0.5);
    // hips over the standing foot: furthest left (+x) at the left foot's mid-stance; the body is lowest when both feet are down (the middle of each double support) and
    // highest over the standing foot, on a smooth curve (it was taken from the standing leg's angle, which jumped when a foot left the ground)
    const sw = Math.cos(2 * Math.PI * (st.phase - S0 / 2)), sway = sw * G.sway * gw;
    let drop = legLen * (1 - Math.cos(A)) * G.drop * gw * (0.5 + 0.5 * Math.cos(4 * Math.PI * (st.phase - (S0 - 0.5) / 2)));
    // ---- rest: slow weight shift from foot to foot, breathing, the gaze drifting
    const idle = 1 - gw; const sh = st.shift; sh.t += dt; if (sh.t >= sh.len) { sh.t = 0; sh.from = sh.to; sh.to = -sh.to * (0.6 + 0.4 * rnd()); sh.len = I.shift[0] + rnd() * (I.shift[1] - I.shift[0]); }
    st.sway2 = (st.sway2 || rnd() * 6.28) + dt * 2 * Math.PI / I.slow; const wsh = ((sh.from + (sh.to - sh.from) * sstep(sh.t / Math.min(sh.len, I.move))) * (1 - I.slowShare) + Math.sin(st.sway2) * I.slowShare) * idle;
    st.breath += dt * 2 * Math.PI / I.breath; const br = Math.sin(st.breath);
    st.drift[0] += dt * 0.37; st.drift[1] += dt * 0.23; const dy = (Math.sin(st.drift[0]) + 0.5 * Math.sin(st.drift[0] * 2.3 + 1)) * I.look * idle * (o.gaze ? 0.35 : 1), dp = (Math.sin(st.drift[1] * 1.7) * 0.6) * I.look * 0.5 * idle;
    // ---- hips: over the standing foot (walk) or the weighted foot (rest); the free side drops a little; thighs turned back so the feet stay where they stand
    const stepShift = lift * -liftSide * T.stepSway;
    const hipX = sway + wsh * I.hip + stepShift, hipRoll = sw * G.roll * gw + wsh * I.roll, legComp = -hipX / legLen - hipRoll;
    drop += Math.abs(wsh) * I.knee * 0.06 * legLen + lift * 0.01;
    add('pelvis', 0, hipOff + G.twist * Math.sin(2 * Math.PI * st.phase) * gw, hipRoll);
    // legs: stride, narrow (woman) or wide (child) track, the free knee bent at rest, a pivot step lifts one foot
    for (const [s, Lg, sg] of [['l', L, 1], ['r', R, -1]]) {
      const free = idle * Math.max(0, -wsh * sg) * I.knee, st1 = liftSide === sg ? lift : 0, th = Lg[0] * gw - st1 * T.stepLift - free * 0.4, cf = Lg[1] * gw + free + st1 * T.stepLift * 2;
      add('thigh_' + s, th, -hipOff, legComp - sg * G.track); add('calf_' + s, cf, 0, 0); add('foot_' + s, -(th + cf) * 0.85 + st1 * 0.2, 0, -legComp * 0.6 + sg * G.track);
    }
    // which feet stand on the ground (held there by the foot lock in drive): walking, the leg in its stance; a pivot step, the other foot; standing, both
    const walking = gw > 0.2 && !st.step;
    st.plant[0] = walking ? st.phase % 1 < S0 : liftSide !== 1; st.plant[1] = walking ? (st.phase + 0.5) % 1 < S0 : liftSide !== -1;
    // body: lean (a spring, so it rocks a little when a walk starts or stops), counter-turn against the hips, waddle (child), breathing; the head kept level
    const lean = spring(st.lean, G.lean * gw + (G.stoop || 0) - (o.carry ? 0.04 : 0), S.leanHz, S.leanDamp, dt);
    const counter = -G.twist * Math.sin(2 * Math.PI * st.phase) * gw * 1.4, waddle = (G.waddle || 0) * Math.sin(2 * Math.PI * (st.phase - S0 / 2)) * gw;
    add('spine_01', lean * 0.5, chestOff * 0.3 + counter * 0.3, -hipRoll * 0.7 + waddle * 0.5);
    add('spine_02', lean * 0.3 - br * I.chest, chestOff * 0.3 + counter * 0.3, waddle * 0.5);
    add('spine_03', lean * 0.2 - br * I.chest * 0.6, chestOff * 0.4 + counter * 0.4, 0);
    add('clavicle_l', 0, 0, br * I.chest * 0.8); add('clavicle_r', 0, 0, -br * I.chest * 0.8);
    // head: turns toward where it looks, pitched toward the player's eyes, a nod spring that settles after steps
    if (o.gaze) { const d = Math.hypot(o.gaze[0], o.gaze[2]); gp = clamp(Math.atan2(o.gaze[1] - headY, Math.max(0.5, d)), -0.5, 0.4); }
    const pit = follow(st.pitch, -gp * 0.7, 0.25, dt), nod = spring(st.nod, -(lean - (G.stoop || 0)) * 0.6 + drop * 2 + (G.headBob || 0) * Math.sin(4 * Math.PI * st.phase) * gw, G.headHz || S.headHz, G.headDamp || S.headDamp, dt);
    add('neck_01', pit * 0.4 + nod * 0.5, headOff * 0.4 + dy * 0.4, -hipRoll * 0.3 - waddle * 0.4);
    add('head', pit * 0.6 + nod * 0.5 + dp, headOff * 0.6 + dy * 0.6, -waddle * 0.4);
    // arms: swing from the shoulder against the legs (springs, so they lag and settle), forearms and hands follow later; carrying holds them forward
    const car = spring(st.carry, o.carry ? 1 : 0, 1.2, 0.9, dt);
    for (const [s, k, Lo, sg] of [['l', 0, R, 1], ['r', 1, L, -1]]) {
      const a = spring(st.arm[k], -Lo[0] * G.arm * gw * (1 - car) - car * 0.75, S.armHz, S.armDamp, dt);
      // the forearm hangs from the upper arm: when the upper arm speeds up or slows down, the forearm is thrown the other way and swings on a moment (double pendulum)
      if (dt > 0) { const av = st.arm[k].v, acc = (av - (st.arm[k].pv || 0)) / dt; st.arm[k].pv = av; st.fore[k].v -= clamp(acc, -60, 60) * S.inertia * dt; st.hand[k].v -= clamp(acc, -60, 60) * S.inertia * 0.5 * dt; }
      const f = spring(st.fore[k], -G.elbow - G.elbowSwing * Math.max(0, -a) - car * 0.9, S.foreHz, S.foreDamp, dt);
      const hd = spring(st.hand[k], (f + G.elbow) * 0.3, S.handHz, S.handDamp, dt);
      add('upperarm_' + s, a, 0, sg * (G.armOut + br * I.chest * 0.3) - sg * hipRoll * 0.2);
      add('lowerarm_' + s, f + G.elbow, 0, 0); add('hand_' + s, hd, 0, 0);
    }
    st.hipX = hipX; st.drop = drop;
    // walk the holder along the facing (o.move)
    if (o.move && root.parent) { root.parent.position.x += Math.sin(st.feet) * v * dt; root.parent.position.z += Math.cos(st.feet) * v * dt; }
    return v;
  }
  // the foot lock: a foot on the ground stays where it was put down (two-bone leg reach, src people.js legReach); a foot that lifts is let go over M.lockRelease s
  const LEGS = [['thigh_l', 'calf_l', 'foot_l'], ['thigh_r', 'calf_r', 'foot_r']], fk = new THREE.Vector3(), tg = new THREE.Vector3();
  function footLock(dt) {
    if (!scn) return; scn.updateWorldMatrix(true, true);
    for (let i = 0; i < 2; i++) { const [a, b, c] = LEGS[i], th = bones[a], ca = bones[b], ft = bones[c], lk = lock[i]; if (!th || !ca || !ft) continue;
      ft.getWorldPosition(fk);
      if (st.plant[i] && !lk.on) { if (lk.w > 0) lk.T.lerpVectors(fk, lk.T, lk.w); else lk.T.copy(fk); lk.on = true; lk.w = 1; }
      else if (!st.plant[i] && lk.on) { lk.on = false; lk.rel = 0; }
      if (!lk.on && lk.w > 0) { lk.rel += dt; lk.w = 1 - sstep(lk.rel / M.lockRelease); }
      if (lk.w <= 0) continue;
      // a foot far from where the leg puts it (a teleport, a long pause) is let go
      if (Math.hypot(lk.T.x - fk.x, lk.T.z - fk.z) > M.lockSlip) { lk.on = false; lk.w = 0; continue; }
      tg.lerpVectors(fk, lk.T, lk.w); legReach(th, ca, ft, tg);
    }
  }
  function drive(dt, o) {
    if (!ready) return { speed: 0, yaw: root.rotation.y };
    dt = Math.max(0, dt);
    // desktop scan faces: bid for the one shared key light by distance to the player (src/peoplehi.js)
    if (keyBid) keyBid(o.gaze ? Math.hypot(o.gaze[0], o.gaze[2]) : 1e3);
    if (!st.init) { st.init = true; st.feet = root.rotation.y; st.head.x = st.chest.x = st.hips.x = st.feet; }
    // a long gap (the scene was left) is not played through: at most M.maxSlices slices, and the feet are let go
    const h = M.slice; st.acc += dt; let n = Math.floor(st.acc / h + 1e-6); st.acc -= n * h; if (n > M.maxSlices) { n = M.maxSlices; st.acc = 0; lock[0].w = lock[1].w = 0; lock[0].on = lock[1].on = false; }
    let v = st.speed.x; for (let i = 0; i < n; i++) v = slice(h, o);
    root.rotation.y = st.feet;
    apply(st.hipX, -st.drop);
    footLock(n * h);
    return { speed: v, yaw: st.feet, moved: !!o.move };
  }
  // the gait numbers and live turn state, for tools/animcheck.cjs
  const probe = () => ({ kind, cycle: G.cycle, speed: G.speed, now: st.speed.x, phase: st.phase, step: !!st.step, yaw: { head: st.head.x, chest: st.chest.x, hips: st.hips.x, feet: st.feet }, legLen });
  return { root, kind, get ready() { return ready; }, whenReady(f) { if (ready) f(); else wait.push(f); }, drive, probe, get scan() { return !!scan; } };
}
