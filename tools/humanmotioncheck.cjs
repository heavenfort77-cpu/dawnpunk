// Human motion check (owner Nov 18 13:21: "Check the motion of human characters: is it smooth?"). Measures, does not fix.
// People: Marla (base, street, opening film), Bram, Oko, Pip, the recruits in the base (Ines the hunter on her patrol rounds, Tomas the gatherer, Wen the researcher carrying a crate),
// and the player's first-person hands (walking bob, firing, placing, eating, switching device, picking up).
// How: the page's clock is replaced by a fixed step (requestAnimationFrame gets a made-up time stamp, so the game's own dt is exactly 1/60 s, or 1/30 s in the second pass).
//   base:   the game loop is held and the base is stepped through the game's own call (bview.update(dt, player x, z, 1.6), as src/main.js does), with a scripted player walking
//           up to each villager at the game's base speed (4 m/s), standing to talk, circling them 270 deg and back, and leaving; the recruits walk their real patrols meanwhile.
//   street: a run's street by day: the player walks up to Marla, stands (her kit opens), circles her, leaves (the game's own townFrame, fixed step).
//   night:  the night in a house: start and stop walking four times (bob), fire, place two devices 0.35 s apart, pick up twice, eat, switch device, fire while walking.
//   film:   the opening (&film=1) from 44 s (dawn over the base) to its end (Marla at your door when you wake).
// Every sample records each bone's WORLD position (20 bones), the root's world position and facing, the head's world turn. Pass 2 runs the same script at 30 fps; its paths are compared.
// Limits (physics; numbers in LIM below):
//   pop    = a bone moving faster in one sample than a body can: 1.0 m/s + 2.5 x the person's own walking speed (CONFIG.people.gait; a swing foot peaks at ~2.5 x walking
//            speed, Winter 1990, and a stepping foot in a turn on the spot is no faster). snap = the extra jump of one sample over both neighbours (a pose change with no in-between): a 20 m/s2 (standing)
//            or 50 m/s2 (walking) body part cannot add more than a*dt^2 in one sample (0.56 cm / 1.4 cm at 60 fps).
//   feet   = a planted foot (the lower foot, within 1.5 cm of its floor) may drift at most 3 cm per plant (heel-to-toe roll); walking: planted-foot speed under 15% of body speed,
//            stride length / stride time within 15% of the ground speed (else the feet skate or moonwalk).
//   turn   = body yaw at most 450 deg/s (a pivot step) and 5700 deg/s2 (100 rad/s2: about the most torque legs put into a body's turn); a jump in turn speed above that is a snapped turn.
//   head   = at most 400 deg/s (fast gaze shifts) and 10000 deg/s2.
//   fps    = the same script at 30 and 60 fps: root path within 5 cm, facing within 5 deg, any bone within 5 cm.
//   hands  = no action running: under 0.25 m/s (the walking bob moves them ~0.07 m/s) and under 30 deg/s; throw, pick-up or recoil: under 2.5 m/s and 720 deg/s;
//            a one-sample jump over its neighbours at most 2 mm (about 4 px at 1080p, 0.5 m from the eye). 30 vs 60 fps within 1 mm.
// Usage: node tools/humanmotioncheck.cjs <low|high> [page.html] [--frames <dir>] [--b64] [--json <file>] [--only base,street,night,film] [--no30]
//   --frames: writes the contact-strip frames (JPEG) there; --b64: prints them as IMG lines (CI: pictures are not uploaded; tools/humanmotionsheet.py reads them from the job log).
// Prints PASS / FAIL / INFO lines, a JSON line, and ALL PASS or SOME FAILED.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const A = process.argv.slice(2);
const tier = A[0] === 'high' ? 'high' : 'low';
const opt = (k) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const page0 = A.find((a) => a.endsWith('.html')) || path.join(__dirname, '../dist/index_single.html');
const DUMP = opt('--dump'), FR = opt('--frames'), B64 = A.includes('--b64'), JSONF = opt('--json'), ONLY = (opt('--only') || 'base,street,night,film').split(','), NO30 = A.includes('--no30');
const LIM = {
  popBase: 1.0, popK: 2.5,                 // m/s, and times the ground speed
  snapStand: 20, snapWalk: 50, walkV: 0.3, // m/s2; ground speed (m/s) above which a person counts as walking
  plantCm: 3, plantDy: 0.015, skate: 0.15, stride: 0.15, slideDeg: 0.1, hipJump: 0.5,
  yawRate: 450, yawAcc: 5700, headRate: 400, headAcc: 10000,
  fpsCm: 5, fpsDeg: 5, blackCut: 0.999,    // film: a fully black screen = a hidden cut
  handIdle: 0.25, handAct: 2.5, handIdleDeg: 30, handActDeg: 720, handSnapMm: 2, handFpsMm: 1,
};
const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'];
const S = 72, HS = 24; // floats per person sample (12 header + 20 bones x 3), per hands sample

// ---------------- page side ----------------
// replaces requestAnimationFrame: the game gets a fixed time step (window.__fix s per frame), can be held (window.__hold), and window.__after(t) runs right after each game frame
function initClock() {
  window.__dtMax = 1e-6;
  try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ }
  const nat = window.requestAnimationFrame.bind(window), q = new Map(); let id = 0, pend = false, lastT = null;
  window.__fix = 1e-6; window.__hold = false; window.__after = null; window.__flushes = 0;
  const req = () => { if (!pend) { pend = true; nat(flush); } };
  function flush(ts) {
    pend = false; if (window.__hold) { req(); return; }
    const cbs = [...q.values()]; q.clear(); const t = lastT == null ? ts : lastT + window.__fix * 1000; lastT = t; window.__flushes++;
    for (const cb of cbs) { try { cb(t); } catch (e) { setTimeout(() => { throw e; }); } }
    if (window.__after) { try { window.__after(t); } catch (e) { window.__afterErr = String((e && e.stack) || e); window.__after = null; } }
    req();
  }
  window.requestAnimationFrame = (cb) => { const k = ++id; q.set(k, cb); req(); return k; };
  window.cancelAnimationFrame = (k) => { q.delete(k); };
}

// recorder and scripts (runs in the page)
function pageSetup(o) {
  const g = window.__game, BONES = o.BONES, HM = window.__HM = { traces: {}, labels: [], frames: [], hand: [], events: [], notes: [] };
  const Q = g.marla.root.quaternion.constructor, q0 = new Q();
  HM.offAll = () => { for (const tr of Object.values(HM.traces)) tr.off = true; };
  HM.lab = (s) => { let i = HM.labels.indexOf(s); if (i < 0) { HM.labels.push(s); i = HM.labels.length - 1; } return i; };
  HM.track = (key, root, info) => { let tr = HM.traces[key]; if (tr) { tr.root = root; return tr; } const bones = {}; root.traverse((x) => { if (x.isBone && !bones[x.name]) bones[x.name] = x; });
    tr = HM.traces[key] = { key, off: false, info: info || {}, root, list: BONES.map((n) => bones[n] || null), eyes: Object.keys(bones).filter((n) => /eye/i.test(n)), d: [], n: 0 }; tr.info.missing = BONES.filter((n) => !bones[n]); tr.info.eyes = tr.eyes; return tr; };
  HM.sample = (t, ph, aux) => { for (const tr of Object.values(HM.traces)) { const r = tr.root; if (!r.parent || tr.off) continue; r.updateWorldMatrix(true, true); const e = r.matrixWorld.elements, d = tr.d, h = tr.list[5];
    const hq = h ? h.getWorldQuaternion(q0) : null; d.push(t, ph, e[12], e[13], e[14], Math.atan2(e[8], e[10]), hq ? hq.x : NaN, hq ? hq.y : NaN, hq ? hq.z : NaN, hq ? hq.w : NaN, aux ? aux(tr) : 0, 0);
    for (const b of tr.list) { if (b) { const m = b.matrixWorld.elements; d.push(m[12], m[13], m[14]); } else d.push(NaN, NaN, NaN); } tr.n++; } };
  const H = g.hands, tok = H.scene.children.find((x) => x.isGroup && x !== H.left && x !== H.right) || null;
  HM.handSample = (t, ph, moving) => { const s = H.state(), L = H.left, R = H.right; HM.hand.push(t, ph, L.position.x, L.position.y, L.position.z, L.quaternion.x, L.quaternion.y, L.quaternion.z, L.quaternion.w,
    R.position.x, R.position.y, R.position.z, R.quaternion.x, R.quaternion.y, R.quaternion.z, R.quaternion.w, tok && tok.visible ? 1 : 0, tok ? tok.position.x : 0, tok ? tok.position.y : 0, tok ? tok.position.z : 0, s.tThrow, s.tGrab, s.tFire, moving ? 1 : 0); };
  // export one trace as base64 float32
  const b64 = (arr) => { const u = new Uint8Array(new Float32Array(arr).buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  HM.take = (key) => { const tr = HM.traces[key]; return { key, n: tr.n, info: tr.info, b64: b64(tr.d) }; };
  HM.takeHands = () => ({ n: HM.hand.length / o.HS, b64: b64(HM.hand) });
  HM.cvs = () => document.getElementById('c');
  // the main scene (the parent of a sample machine, removed again at once)
  HM.scene = () => { g.gloomSample('walker', 0, -400, 0, 0, false); const smp = window.__lastSample, sc = smp.parent; sc.remove(smp); return sc; };
  // drawing cost only: on frames that are not pictures, everything but the measured people (and lights) is hidden; the game's logic does not read what is drawn
  HM.hid = []; HM.mkHide = (scene, keep) => { HM.setHidden(false); HM.hid = []; const ks = new Set(); for (const k of keep) { let x = k; while (x) { ks.add(x); x = x.parent; } }
    const lit = (o) => { let f = false; o.traverse((x) => { if (x.isLight) f = true; }); return f; };
    const walk = (o) => { for (const c of o.children) { if (!c.visible || c.isLight || c.isCamera) continue; if (ks.has(c)) { if (!keep.includes(c)) walk(c); continue; } if (lit(c)) { walk(c); continue; } HM.hid.push(c); } };
    walk(scene); HM.hidOn = false; };
  HM.setHidden = (on) => { if (HM.hidOn === on) return; HM.hidOn = on; for (const c of HM.hid) c.visible = !on; };
  HM.shot = (label) => { if (!o.frames) return; try { HM.frames.push({ label, url: HM.cvs().toDataURL('image/jpeg', 0.82) }); } catch (e) { HM.notes.push('frame ' + label + ': ' + e); } };
  // base: render from a camera placed by the test (the game loop is held), labels hidden for the picture
  // pictures in the base show only the people and the ground (houses, trees and posts stood between the camera and the person); world boxes of the meshes decide what is ground
  const lowTop = (x) => { const gm = x.geometry; if (!gm || !gm.attributes || !gm.attributes.position) return false; if (!gm.boundingBox) gm.computeBoundingBox(); const b = gm.boundingBox, e = x.matrixWorld.elements; let top = -1e9;
    for (const px of [b.min.x, b.max.x]) for (const py of [b.min.y, b.max.y]) for (const pz of [b.min.z, b.max.z]) top = Math.max(top, e[1] * px + e[5] * py + e[9] * pz + e[13]); return top < 0.25; };
  HM.baseShot = (label, from, at) => { if (!o.frames) return; const cam = g.cam, hid = [], people = new Set(); for (const tr of Object.values(HM.traces)) tr.root.traverse((x) => people.add(x));
    const scn = g.bview.group.parent || g.bview.group; scn.updateMatrixWorld(true); scn.traverse((x) => { if (!x.visible || people.has(x)) return; if (x.isSprite || ((x.isMesh || x.isPoints || x.isLine) && !lowTop(x))) { x.visible = false; hid.push(x); } });
    cam.position.set(from[0], from[1], from[2]); cam.lookAt(at[0], at[1], at[2]); cam.updateMatrixWorld(); g.drawCalls(); HM.shot(label); for (const x of hid) x.visible = true; };
  return true;
}

// the base by day, stepped through bview.update with a scripted player (game loop held)
function baseRun(o) {
  const g = window.__game, HM = window.__HM, pk = g.bview.peek(), dt = o.dt, out = { subjects: [], notes: [] };
  const wpos = (x) => { x.updateWorldMatrix(true, false); const e = x.matrixWorld.elements; return [e[12], e[14], Math.atan2(e[8], e[10])]; };
  // who: the villagers, Marla, the recruits that carry their model
  const subj = [];
  if (g.marla.ready && pk.scoutG && g.marla.root.parent === pk.scoutG) { const w = wpos(pk.scoutG); subj.push({ id: 'marla', c: [w[0], w[1]], f: w[2], inside: false, marla: true }); HM.track('marla', g.marla.root, { kind: 'woman', who: 'Marla' }); }
  else out.notes.push('Marla model not in the base');
  for (const id of ['bram', 'pip', 'oko']) { const ch = pk.chars[id], og = pk.npcG[id]; if (!ch || !ch.ready || !og) { out.notes.push(id + ' not ready'); continue; } const w = wpos(og.p); const fr = wpos(ch.root);
    subj.push({ id, c: [w[0], w[1]], f: fr[2], inside: !!(g.B.NPCS[id] && g.B.NPCS[id].inside) }); HM.track(id, ch.root, { kind: ch.kind, who: id[0].toUpperCase() + id.slice(1), scan: ch.scan, gait: ch.probe && ch.probe() }); }
  for (const r of pk.npcs) if (r.ch && r.ch.ready && r.ch.root.parent === r.n) HM.track('rec_' + r.p.role, r.ch.root, { kind: r.ch.kind, who: r.p.name + ' (' + r.p.role + ')', role: r.p.role, carry: !!r.crate.visible, gait: r.ch.probe && r.ch.probe() });
  // the script: a list of [duration, label, P(u) (u = seconds into the segment), on start]
  const seg = [], SP = 4, R0 = 2.2, at = (c, a, r) => [c[0] + Math.sin(a) * r, c[1] + Math.cos(a) * r];
  seg.push([4, 'start (player far)', () => [40, 40]]);
  for (const s of subj) {
    const c = s.c, f = s.f, k = s.id + ':';
    if (s.inside && pk.rooms && pk.rooms.WS) {
      // inside the workshop (room frame of src/rooms.js: she stands at CONFIG.workshop.oko.at, the door at local +z): in through the door to 2.15 m in front of her, 1 m to each side, out again
      const I = pk.rooms.WS, at0 = (typeof g.cfg === 'function' ? g.cfg() : g.cfg).workshop.oko.at, W = (lx, lz) => [I.x + lx * Math.cos(I.ry) + lz * Math.sin(I.ry), I.z - lx * Math.sin(I.ry) + lz * Math.cos(I.ry)], zf = at0[1] + 2.15;
      s.cam = W(0.7, zf + 0.35); s.look = W(at0[0], at0[1]);
      seg.push([(3.5 - zf) / SP, k + 'approach', (u) => W(0, 3.5 - SP * u)], [3, k + 'talk', () => W(0, zf)], [1 / SP, k + 'sidestep', (u) => W(SP * u, zf)], [1.5, k + 'hold', () => W(1, zf)],
        [2 / SP, k + 'sidestep2', (u) => W(1 - SP * u, zf)], [1.5, k + 'hold2', () => W(-1, zf)], [1 / SP, k + 'centre', (u) => W(-1 + SP * u, zf)], [(3.5 - zf) / SP, k + 'leave', (u) => W(0, zf + SP * u)],
        [6.5 / SP, k + 'out', (u) => W(0, 3.5 + SP * u)], [6, k + 'far', () => W(0, 10)]);
    } else {
      const w = SP / R0;
      seg.push([(10 - R0) / SP, k + 'approach', (u) => at(c, f, 10 - SP * u)], [3, k + 'talk', () => at(c, f, R0), s.marla ? () => g.marla.talk(true) : null],
        [1.5 * Math.PI / w, k + 'circle', (u) => at(c, f + w * u, R0), s.marla ? () => g.marla.talk(false) : null], [2, k + 'hold', () => at(c, f + 1.5 * Math.PI, R0)],
        [Math.PI / w, k + 'circleBack', (u) => at(c, f + 1.5 * Math.PI - w * u, R0)], [1.5, k + 'hold2', () => at(c, f + 0.5 * Math.PI, R0)],
        [(12 - R0) / SP, k + 'leave', (u) => at(c, f + 0.5 * Math.PI, R0 + SP * u)], [5, k + 'far', () => at(c, f + 0.5 * Math.PI, 12)]);
    }
  }
  // pictures (first pass only): recruits side-on over one stride, each villager from a fixed spot in front-right while you circle them
  const shots = [];
  if (o.frames) {
    const recs = Object.values(HM.traces).filter((t) => t.key.startsWith('rec_'));
    recs.forEach((tr, j) => { for (let i = 0; i < 4; i++) shots.push({ t: 0.4 + j * 1.2 + i * 0.25, key: tr.key, side: true }); });
    let t0 = 0; for (const sg of seg) { const lab = sg[1]; if (/:(circle|sidestep)$/.test(lab)) { const id = lab.split(':')[0]; for (let i = 0; i < 4; i++) shots.push({ t: t0 + (lab.endsWith('sidestep') ? -2.4 + i * 0.9 : i * sg[0] / 3.2), key: id, fixed: subj.find((s) => s.id === id) }); } t0 += sg[0]; }
    shots.sort((a, b) => a.t - b.t);
  }
  let t = 0, P = [40, 40], si = 0; const total = seg.reduce((a, s) => a + s[0], 0), nearAux = (tr) => { const n = pk.npcG[tr.key]; if (n) return n.near ? 1 : 0; if (tr.key === 'marla') { const w = wpos(pk.scoutG); return Math.hypot(P[0] - w[0], P[1] - w[1]) < 7 ? 1 : 0; } return 0; };
  const segAt = (tt) => { let a = 0; for (const s of seg) { if (tt < a + s[0] - 1e-9) return [s, tt - a]; a += s[0]; } return [seg[seg.length - 1], seg[seg.length - 1][0]]; };
  let cur = null; const N = Math.round(total / dt);
  for (let i = 1; i <= N; i++) {
    const [sg, u] = segAt(t); if (sg !== cur) { cur = sg; if (sg[3]) sg[3](); } P = sg[2](u);
    // the player's path between frames is known here: the base gets it (posAt), so 30 and 60 fps decide on the same positions
    // (the positions during the frame being stepped: from this frame's start t to its end t + dt, the same game times at any frame rate)
    g.bview.update(dt, P[0], P[1], 1.6, (a) => { const [s2, u2] = segAt(t + a * dt); return s2[2](u2); }); t = i * dt; HM.sample(t, HM.lab(sg[1]), nearAux);
    while (si < shots.length && shots[si].t <= t + 1e-9) { const sh = shots[si++], tr = HM.traces[sh.key]; if (!tr || !tr.root.parent) continue; const w = wpos(tr.root);
      if (sh.side) { const a = w[2] + Math.PI / 2; HM.baseShot(tr.info.who + ' walking', [w[0] + Math.sin(a) * 2.5, 1.0, w[1] + Math.cos(a) * 2.5], [w[0], 0.8, w[1]]); }
      else if (sh.fixed.cam) { const s = sh.fixed; HM.baseShot(tr.info.who + ' at the bench, turning to you', [s.cam[0], 1.35, s.cam[1]], [s.look[0], 0.95, s.look[1]]); }
      else { const s = sh.fixed, a = s.f + 0.75, r = 2.7; HM.baseShot(tr.info.who + ' turning to you', [s.c[0] + Math.sin(a) * r, 1.15, s.c[1] + Math.cos(a) * r], [s.c[0], 0.85, s.c[1]]); } }
  }
  g.setBase(P[0], P[1]); HM.offAll();
  out.subjects = subj.map((s) => ({ id: s.id, inside: s.inside, c: s.c, f: s.f })); out.total = total; out.segs = seg.map((s) => [s[1], s[0]]); return out;
}

// a fixed-step segment through the game's own frame: script(t) sets the inputs for the frame that ends at t; sampling after every frame
function fixedSeg(o) {
  return new Promise((done) => {
    const HM = window.__HM, dt = o.dt; let k = 0; const N = Math.round(o.dur / dt), sc = window.__seg, caps = sc.caps || [], t0 = performance.now();
    const hideNow = () => { HM.mkHide(sc.scene(), sc.keep()); HM.setHidden(true); };
    const capIn = (t) => caps.some((c) => c > t - dt + 1e-9 && c <= t + 1e-9);
    sc.input(dt); if (!sc.lateHide) hideNow(); if (capIn(dt)) HM.setHidden(false);
    window.__fix = dt; window.__dtMax = 1;
    window.__after = () => { k++; const t = k * dt; sc.sample(t); if (k >= N || (sc.stop && sc.stop(t))) { window.__after = null; HM.setHidden(false); window.__fix = 1e-6; window.__dtMax = 1e-6; done({ frames: k, t, msPerFrame: (performance.now() - t0) / k }); return; }
      if (sc.lateHide && (k === 2 || (sc.rehide && sc.rehide()))) hideNow(); sc.input(t + dt); HM.setHidden(!capIn(t + dt)); };
  });
}
// ---- street: Marla by day
function streetPrep(o) {
  const g = window.__game, HM = window.__HM, G = (typeof g.cfg === 'function' ? g.cfg() : g.cfg).marla.guide, M = g.marla.root, c = [M.position.x, M.position.z], f = M.rotation.y, SP = 4, R0 = 2.5, at = (a, r) => [c[0] + Math.sin(a) * r, c[1] + Math.cos(a) * r];
  HM.offAll(); HM.track('marla_street', M, { kind: 'woman', who: 'Marla (street)' });
  const seg = [[0.6, 'street:far', () => at(f, 10)], [(10 - R0) / SP, 'street:approach', (u) => at(f, 10 - SP * u)], [3.5, 'street:talk', () => at(f, R0)], [1.5 * Math.PI * R0 / SP, 'street:circle', (u) => at(f + SP / R0 * u, R0), () => { if (g.kitOpen) g.closeKit(); }],
    [2, 'street:hold', () => at(f + 1.5 * Math.PI, R0)], [Math.PI * R0 / SP, 'street:circleBack', (u) => at(f + 1.5 * Math.PI - SP / R0 * u, R0)], [1.5, 'street:hold2', () => at(f + 0.5 * Math.PI, R0)],
    [(12 - R0) / SP, 'street:leave', (u) => at(f + 0.5 * Math.PI, R0 + SP * u)], [3, 'street:far2', () => at(f + 0.5 * Math.PI, 12)]];
  const total = seg.reduce((a, s) => a + s[0], 0), segAt = (tt) => { let a = 0; for (const s of seg) { if (tt < a + s[0] - 1e-9) return [s, tt - a]; a += s[0]; } return [seg[seg.length - 1], 0]; };
  let cur = null, lab = 0; const shots = o.frames ? [0, 1, 2, 3].map((i) => (0.6 + (10 - R0) / SP + 3.5) + i * (1.5 * Math.PI * R0 / SP) / 3.2) : []; let si = 0;
  window.__seg = { scene: () => M.parent, keep: () => [M], caps: shots, input: (t) => { const [sg, u] = segAt(t - o.dt); if (sg !== cur) { cur = sg; lab = HM.lab(sg[1]); if (sg[3]) sg[3](); } const P = sg[2](u); g.setTown(P[0], P[1]); g.setYaw(Math.atan2(-(c[0] - P[0]), -(c[1] - P[1]))); },
    sample: (t) => { HM.sample(t, lab, () => (g.kitOpen ? 1 : 0)); while (si < shots.length && shots[si] <= t + 1e-9) { si++; HM.shot('Marla (street) turning to you'); } } };
  return { total, c, f };
}
// ---- night: the hands
function nightPrep(o) {
  window.__HM.offAll(); const g = window.__game, HM = window.__HM, s = g.sim, FINE = !matchMedia('(pointer: coarse)').matches, kinds = ((typeof g.cfg === 'function' ? g.cfg() : g.cfg).loadout && (typeof g.cfg === 'function' ? g.cfg() : g.cfg).loadout.first) || [];
  const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  const placeOk = (k) => { if (!k) return false; const before = g.hands.state().tThrow; g.doPlace(k); return g.hands.state().tThrow < before; };
  const fireOk = () => { const before = g.hands.state().tFire; g.doFire(); return g.hands.state().tFire < before; };
  // [time, label, action]; walking on/off at four different points of the bob
  const ev = [[1.0, 'walk start', () => key('KeyW', true)], [2.1, 'walk stop', () => key('KeyW', false)], [3.3, 'walk start', () => key('KeyW', true)], [4.6, 'walk stop', () => key('KeyW', false)],
    [5.5, 'walk start', () => key('KeyS', true)], [6.4, 'walk stop', () => key('KeyS', false)], [7.4, 'walk start', () => key('KeyS', true)], [8.2, 'walk stop', () => key('KeyS', false)],
    [9.5, 'fire', fireOk], [9.9, 'fire', fireOk], [10.3, 'fire', fireOk], [10.4, 'fire (too soon, the game should refuse)', fireOk],
    [11.5, 'place', () => placeOk(kinds[0])], [11.9, 'place again mid-throw', () => placeOk(kinds[1] || kinds[0])],
    [13.5, 'pick up (hands.grab, as a crate or cat pick-up)', () => g.hands.grab()], [13.7, 'pick up again mid pick-up', () => g.hands.grab()],
    [14.8, 'eat', () => { key(FINE ? 'KeyF' : 'KeyE', true); key(FINE ? 'KeyF' : 'KeyE', false); }], [15.6, FINE ? 'switch device (key 2)' : 'device button 2 (phones: places it)', () => { key('Digit2', true); key('Digit2', false); }],
    [17.0, 'walk start', () => key('KeyW', true)], [17.5, 'fire while walking', fireOk], [18.4, 'walk stop', () => key('KeyW', false)]];
  const lab = (t) => { let l = 'night:idle'; for (const e of ev) if (t >= e[0]) l = 'night:after ' + e[1]; return HM.lab(l); };
  let ei = 0, moving = false; const shots = o.frames ? [[0.8, 'hands idle'], [1.9, 'hands walking (bob)'], [9.55, 'hands firing (recoil)'], [11.5 + 0.75 * 0.4, 'hands placing a device']] : []; let si = 0;
  const scn = HM.scene();
  window.__seg = { scene: () => scn, keep: () => [], caps: shots.map((x) => x[0]), input: (t) => { s.player.hp = Math.max(s.player.hp, 90); s.player.energy = 100; s.gloom.length = 0; while (ei < ev.length && ev[ei][0] <= t - o.dt + 1e-9) { const e = ev[ei++]; const r = e[2](); HM.events.push({ t: e[0], what: e[1], ok: r !== false }); if (/walk start/.test(e[1])) moving = true; if (/walk stop/.test(e[1])) moving = false; } },
    sample: (t) => { HM.handSample(t, lab(t), moving); while (si < shots.length && shots[si][0] <= t + 1e-9) HM.shot(shots[si++][1]); } };
  return { FINE, kinds, dur: 19.5 };
}
// ---- film: from 44 s to the end
function filmPrep(o) {
  window.__HM.offAll(); const g = window.__game, HM = window.__HM, C = (typeof g.cfg === 'function' ? g.cfg() : g.cfg).opening, P = C.parts, t0 = o.from, fade = document.getElementById('cineFade');
  let lastPk = null; const trackAll = () => { const pk = g.bview.peek && g.bview.peek(); if (!pk || !pk.chars) return; lastPk = pk;
    if (pk.scoutG && g.marla.root.parent === pk.scoutG) HM.track('marla_film', g.marla.root, { kind: 'woman', who: 'Marla (film)' });
    for (const id of ['bram', 'pip', 'oko']) { const ch = pk.chars[id]; if (ch && ch.ready && ch.root.parent) HM.track(id + '_film', ch.root, { kind: ch.kind, who: id[0].toUpperCase() + id.slice(1) + ' (film)', gait: ch.probe && ch.probe() }); }
    for (const r of pk.npcs || []) if (r.ch && r.ch.ready && r.ch.root.parent === r.n) HM.track('rec_' + r.p.role + '_film', r.ch.root, { kind: r.ch.kind, who: r.p.name + ' (' + r.p.role + ', film)', role: r.p.role, carry: !!(r.crate && r.crate.visible), gait: r.ch.probe && r.ch.probe() }); };
  const shots = o.frames ? [P[3] + 5.5, P[3] + 7, P[3] + 8.5, P[3] + 10] : []; let si = 0, lab = 0;
  let nKeep = 0; const keepNow = () => Object.values(HM.traces).filter((x) => x.key.endsWith('_film') && x.root.parent).map((x) => x.root);
  window.__seg = { lateHide: true, scene: () => g.bview.group.parent || HM.scene(), keep: () => { const k = keepNow(); nKeep = k.length; return k; }, rehide: () => keepNow().length !== nKeep, caps: shots.map((x) => x - t0),
    input: () => { trackAll(); }, stop: () => g.state !== 'intro',
    sample: (t) => { const ft = t0 + t; lab = HM.lab(ft < P[3] ? 'film:dawn' : 'film:wake'); if (Object.keys(HM.traces).some((k) => k.endsWith('_film'))) HM.sample(t, lab, () => +(fade && fade.style.opacity || 0)); while (si < shots.length && shots[si] <= ft + 1e-9) { si++; HM.shot('opening: you wake, Marla at the door'); } } };
  return { parts: P, from: t0 };
}

// ---------------- node side: one pass ----------------
async function pass(b, dt, frames) {
  const ctx = await b.newContext(tier === 'low' ? { viewport: { width: 731, height: 304 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(), errs = [], R = { dt, notes: [] }; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  await p.addInitScript(initClock);
  const t0 = Date.now(), lg = (m) => console.error('[' + Math.round((Date.now() - t0) / 1000) + ' s, ' + Math.round(1 / dt) + ' fps] ' + m);
  await p.goto('file://' + path.resolve(page0) + '?quality=' + tier + '&seed=777&fx=0&film=1', { timeout: 600000 });
  await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 600000 });
  await p.evaluate(pageSetup, { BONES, HS, frames: !!frames });
  await p.evaluate(() => window.__game.enterBase());
  lg('base entered; waiting for the people');
  await p.waitForFunction(() => { const g = window.__game, pk = g.bview.peek && g.bview.peek(); return pk && g.marla.ready && g.marla.root.parent === pk.scoutG && ['bram', 'oko', 'pip'].every((k) => pk.chars[k] && pk.chars[k].ready && pk.chars[k].root.parent) && pk.npcs.every((o) => !o.ch || (o.ch.ready && o.ch.root.parent === o.n)); }, null, { timeout: 900000, polling: 1000 });
  // which model each person drew: desktop = physically based materials (src/peoplehi.js, src/marlahi.js), phones = the light Phong/Lambert copies
  R.models = await p.evaluate(() => { const g = window.__game, pk = g.bview.peek(), out = {}, look = (root) => { const m = {}; root.traverse((o) => { if (o.isSkinnedMesh) for (const x of [].concat(o.material)) m[x.type] = (m[x.type] || 0) + 1; }); return m.MeshPhysicalMaterial ? 'desktop (PBR)' : 'light (' + Object.keys(m).join('/') + ')'; };
    out.marla = look(g.marla.root); for (const [k, c] of Object.entries(pk.chars)) out[k] = c.kind + (c.scan ? ', scan face' : '') + ', ' + look(c.root); return out; });
  if (ONLY.includes('base')) { await p.evaluate(() => { window.__hold = true; }); R.base = await p.evaluate(baseRun, { dt, frames: !!frames }); await p.evaluate(() => { window.__hold = false; }); lg('base done (' + Math.round(R.base.total) + ' s of game time)'); }
  if (ONLY.includes('street') || ONLY.includes('night')) {
    await p.evaluate(() => { const g = window.__game; g.save.nights = 3; document.getElementById('selRing').value = '0'; g.startRun(); });
    await p.waitForFunction(() => window.__game.state === 'play' && window.__game.run && window.__game.marla.root.parent, null, { timeout: 300000 });
    if (ONLY.includes('street')) { R.street = await p.evaluate(streetPrep, { dt, frames: !!frames }); R.street.run = await p.evaluate(fixedSeg, { dt, dur: R.street.total }); lg('street done, ' + Math.round(R.street.run.msPerFrame) + ' ms per frame'); }
    if (ONLY.includes('night')) {
      await p.evaluate(() => window.__game.nightfall());
      await p.waitForFunction(() => window.__game.sim && window.__game.sim.phase === 'night', null, { timeout: 120000 }).catch(() => null);
      R.nightPhase = await p.evaluate(() => window.__game.sim && window.__game.sim.phase);
      R.night = await p.evaluate(nightPrep, { dt, frames: !!frames }); R.night.run = await p.evaluate(fixedSeg, { dt, dur: R.night.dur }); R.night.events = await p.evaluate(() => window.__HM.events); lg('night done, ' + Math.round(R.night.run.msPerFrame) + ' ms per frame');
    }
  }
  if (ONLY.includes('film')) {
    await p.evaluate(() => { window.__game.startIntro(); });
    await p.waitForFunction(() => window.__game.state === 'intro', null, { timeout: 120000 });
    await p.evaluate(() => window.__game.introAt(44));
    R.film = await p.evaluate(filmPrep, { dt, frames: !!frames, from: 44 }); R.film.run = await p.evaluate(fixedSeg, { dt, dur: 15 }); lg('film done (' + R.film.run.t.toFixed(1) + ' s, ' + Math.round(R.film.run.msPerFrame) + ' ms per frame)');
  }
  R.labels = await p.evaluate(() => window.__HM.labels);
  R.cfgH = await p.evaluate(() => { const g = window.__game, c = (typeof g.cfg === 'function' ? g.cfg() : g.cfg).hands; return { throwTime: c.throwTime, grabTime: c.grabTime, recoilTime: c.recoilTime }; });
  R.notes.push(...(await p.evaluate(() => window.__HM.notes)), ...(R.base ? R.base.notes : []));
  R.afterErr = await p.evaluate(() => window.__afterErr || null);
  const keys = await p.evaluate(() => Object.keys(window.__HM.traces));
  R.traces = {}; for (const k of keys) { const x = await p.evaluate((k) => window.__HM.take(k), k); R.traces[k] = { n: x.n, info: x.info, f: new Float32Array(new Uint8Array(Buffer.from(x.b64, 'base64')).buffer) }; }
  if (R.night) { const x = await p.evaluate(() => window.__HM.takeHands()); R.hands = { n: x.n, f: new Float32Array(new Uint8Array(Buffer.from(x.b64, 'base64')).buffer) }; }
  if (frames) R.frames = await p.evaluate(() => window.__HM.frames);
  R.errs = errs; await ctx.close(); return R;
}

// ---------------- analysis ----------------
const D = 180 / Math.PI;
const hyp3 = (a, b, c) => Math.sqrt(a * a + b * b + c * c);
function analyzePerson(tr, dt, labels, film) {
  const F = tr.f, n = tr.n, at = (i, k) => F[i * S + k], T = (i) => at(i, 0), lab = (i) => labels[at(i, 1)] || '?';
  // the film: a sample on a fully black screen (the cut between its parts) is not seen, so it does not count; hidden = how many were left out
  const black = (i) => film && (at(i, 10) >= LIM.blackCut || at(i - 1, 10) >= LIM.blackCut);
  const ok = (i) => i > 0 && Math.abs(T(i) - T(i - 1) - dt) < dt * 0.5 && !black(i);
  const bp = (i, b) => [at(i, 12 + b * 3), at(i, 13 + b * 3), at(i, 14 + b * 3)];
  const gs = ((tr.info.gait && tr.info.gait.speed) || 1.1) * (tr.info.carry ? 0.85 : 1), cyc = (tr.info.gait && tr.info.gait.cycle) || 1;
  const vb = new Float64Array(n); for (let i = 1; i < n; i++) vb[i] = ok(i) ? Math.hypot(at(i, 2) - at(i - 1, 2), at(i, 4) - at(i - 1, 4)) / dt : 0;
  let hidden = 0; for (let i = 1; i < n; i++) if (black(i)) hidden++;
  const r = { n, seconds: n * dt, hidden };
  // pops (speed) and snaps (one-sample excess over both neighbours), and the largest acceleration
  let pop = { ratio: 0 }, snap = { ratio: 0 }, acc = { a: 0 }, popN = 0, snapN = 0;
  for (let b = 0; b < BONES.length; b++) {
    if (isNaN(at(0, 12 + b * 3))) continue;
    for (let i = 1; i < n; i++) { if (!ok(i)) continue; const p1 = bp(i, b), p0 = bp(i - 1, b), d = hyp3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), v = d / dt, lim = LIM.popBase + LIM.popK * Math.max(gs, vb[i]);
      if (v > lim) popN++; if (v / lim > pop.ratio) pop = { ratio: v / lim, bone: BONES[b], v, lim, cm: d * 100, t: T(i), at: lab(i), aux: at(i, 10) };
      if (i + 1 < n && ok(i + 1)) { const p2 = bp(i + 1, b), d2 = hyp3(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
        const prev = i > 1 && ok(i - 1) ? (() => { const q = bp(i - 2, b); return hyp3(p0[0] - q[0], p0[1] - q[1], p0[2] - q[2]); })() : d;
        const ex = d - Math.max(prev, d2), walk = vb[i] > LIM.walkV, sl = (walk ? LIM.snapWalk : LIM.snapStand) * dt * dt;
        if (ex > sl) snapN++; if (ex / sl > snap.ratio) snap = { ratio: ex / sl, bone: BONES[b], cm: ex * 100, limCm: sl * 100, t: T(i), at: lab(i), aux: at(i, 10) };
        const a = hyp3(p2[0] - 2 * p1[0] + p0[0], p2[1] - 2 * p1[1] + p0[1], p2[2] - 2 * p1[2] + p0[2]) / (dt * dt); if (a > acc.a) acc = { a, bone: BONES[b], t: T(i), at: lab(i), walking: vb[i] > LIM.walkV }; } }
  }
  r.pop = Object.assign(pop, { count: popN }); r.snap = Object.assign(snap, { count: snapN }); r.acc = acc;
  // body facing: rate and acceleration
  let yr = { v: 0 }, ya = { v: 0 }, prevR = null;
  for (let i = 1; i < n; i++) { if (!ok(i)) { prevR = null; continue; } let d = at(i, 5) - at(i - 1, 5); d = Math.atan2(Math.sin(d), Math.cos(d)); const rate = d / dt * D;
    if (Math.abs(rate) > yr.v) yr = { v: Math.abs(rate), t: T(i), at: lab(i) }; if (prevR !== null) { const a = Math.abs(rate - prevR) / dt; if (a > ya.v) ya = { v: a, t: T(i), at: lab(i), from: prevR, to: rate, aux: at(i, 10) }; } prevR = rate; }
  r.yaw = { rate: yr, acc: ya };
  // head: world angular velocity from quaternions
  let hr = { v: 0 }, ha = { v: 0 }, pw = null;
  for (let i = 1; i < n; i++) { if (!ok(i) || isNaN(at(i, 6))) { pw = null; continue; } const qa = [at(i - 1, 6), at(i - 1, 7), at(i - 1, 8), at(i - 1, 9)], qb = [at(i, 6), at(i, 7), at(i, 8), at(i, 9)];
    // qd = qb * conj(qa)
    const [ax, ay, az, aw] = [-qa[0], -qa[1], -qa[2], qa[3]], [bx, by, bz, bw] = qb;
    let x = bw * ax + bx * aw + by * az - bz * ay, y = bw * ay - bx * az + by * aw + bz * ax, z = bw * az + bx * ay - by * ax + bz * aw, w = bw * aw - bx * ax - by * ay - bz * az; if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
    const s = Math.hypot(x, y, z), ang = 2 * Math.atan2(s, w), om = s > 1e-9 ? [x / s * ang / dt, y / s * ang / dt, z / s * ang / dt] : [0, 0, 0], mag = ang / dt * D;
    if (mag > hr.v) hr = { v: mag, t: T(i), at: lab(i) }; if (pw) { const a = hyp3(om[0] - pw[0], om[1] - pw[1], om[2] - pw[2]) / dt * D; if (a > ha.v) ha = { v: a, t: T(i), at: lab(i), aux: at(i, 10) }; } pw = om; }
  r.head = { rate: hr, acc: ha };
  // feet: planted = the lower foot (or level), within LIM.plantDy of its own floor (lowest point within 0.6 s)
  const W = Math.round(0.6 / dt), plants = [];
  for (const [fb, ob] of [[18, 19], [19, 18]]) { if (isNaN(at(0, 12 + fb * 3))) continue; const y = (i) => at(i, 13 + fb * 3), yo = (i) => at(i, 13 + ob * 3);
    let cur = null; for (let i = 0; i < n; i++) { let fl = Infinity; for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) fl = Math.min(fl, y(j)); const pl = y(i) - fl <= LIM.plantDy && y(i) <= yo(i) + 0.01 && (i === 0 || ok(i) || !cur);
      if (pl && cur && ok(i)) { const a = bp(i, fb), q = bp(i - 1, fb), d = Math.hypot(a[0] - q[0], a[2] - q[2]); cur.path += d; cur.vb += vb[i]; cur.m++; const dx = at(i, 2) - at(i - 1, 2), dz = at(i, 4) - at(i - 1, 4), L = Math.hypot(dx, dz); if (L > 1e-6) cur.along += ((a[0] - q[0]) * dx + (a[2] - q[2]) * dz) / L; cur.max = Math.max(cur.max, d); cur.i1 = i; }
      else if (pl && !cur) cur = { foot: BONES[fb], i0: i, i1: i, path: 0, vb: 0, m: 0, along: 0, max: 0 };
      if (!pl && cur) { plants.push(cur); cur = null; } }
    if (cur) plants.push(cur); }
  for (const p of plants) { const a = bp(p.i0, BONES.indexOf(p.foot)), c = bp(p.i1, BONES.indexOf(p.foot)); p.net = Math.hypot(c[0] - a[0], c[2] - a[2]); p.t = T(p.i0); p.dur = (p.i1 - p.i0) * dt; p.at = lab(p.i0); p.walk = p.m > 0 && p.vb / p.m > LIM.walkV; p.mid = [(a[0] + c[0]) / 2, (a[2] + c[2]) / 2]; }
  const worstPlant = plants.reduce((m, p) => (p.path > (m ? m.path : -1) ? p : m), null);
  const walkP = plants.filter((p) => p.walk && p.m >= 3 && p.vb / p.m > 0.6 * gs), skate = walkP.length ? walkP.reduce((s, p) => s + (p.path / (p.m * dt)) / (p.vb / p.m), 0) / walkP.length : null, worstSkate = walkP.reduce((m, p) => Math.max(m, (p.path / (p.m * dt)) / (p.vb / p.m)), 0);
  const signed = walkP.length ? walkP.reduce((s, p) => s + (p.along / (p.m * dt)) / (p.vb / p.m), 0) / walkP.length : null;
  // stride: consecutive plants of the same foot while walking
  const strides = []; for (const f of ['foot_l', 'foot_r']) { const ps = plants.filter((p) => p.foot === f && p.walk); for (let k = 1; k < ps.length; k++) { const a = ps[k - 1], b = ps[k], Tt = (b.i0 - a.i0) * dt; if (Tt < 0.6 * cyc || Tt > 1.6 * cyc) continue; let v = 0, vmin = 9; for (let i = a.i0 + 1; i <= b.i0; i++) { v += vb[i]; vmin = Math.min(vmin, vb[i]); } v /= (b.i0 - a.i0); if (vmin < 0.6 * gs) continue; strides.push({ ratio: Math.hypot(b.mid[0] - a.mid[0], b.mid[1] - a.mid[1]) / Tt / v, T: Tt, v, t: T(a.i0), at: lab(a.i0) }); } }
  strides.sort((a, b) => a.ratio - b.ratio); const med = strides.length ? strides[Math.floor(strides.length / 2)] : null, worstStride = strides.reduce((m, s) => (Math.abs(s.ratio - 1) > (m ? Math.abs(m.ratio - 1) : -1) ? s : m), null);
  r.feet = { plants: plants.length, worst: worstPlant && { cm: worstPlant.path * 100, net: worstPlant.net * 100, foot: worstPlant.foot, t: worstPlant.t, dur: worstPlant.dur, at: worstPlant.at, walk: worstPlant.walk },
    over: plants.filter((p) => p.path * 100 > LIM.plantCm).length, walkPlants: walkP.length, skate, worstSkate, signed, strides: strides.length, strideMed: med && med.ratio, strideT: med && med.T, worstStride };
  // per-phase worst foot drift (where the slides happen)
  const byPh = {}; for (const p of plants) { const k = p.at.replace(/^[a-z_]+:/, ''); if (!byPh[k] || p.path > byPh[k]) byPh[k] = p.path; } 
  { let turnSlide = 0, turnDeg = 0, win = { cm: 0 }; const y5 = (i) => at(i, 5);
    for (const fb of [18, 19]) { const arr = new Float64Array(n); for (const p of plants) { if (BONES[fb] !== p.foot) continue; for (let i = p.i0 + 1; i <= p.i1; i++) { if (!ok(i)) continue; const a = bp(i, fb), q = bp(i - 1, fb), d = Math.hypot(a[0] - q[0], a[2] - q[2]); let dy = y5(i) - y5(i - 1); dy = Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy))) * D; arr[i] = d; if (dy > 0.05 && vb[i] < LIM.walkV) { turnSlide += d; turnDeg += dy; } } }
      const Wn = Math.round(1 / dt); let acc = 0; for (let i = 0; i < n; i++) { acc += arr[i]; if (i >= Wn) acc -= arr[i - Wn]; if (vb[i] < LIM.walkV && acc * 100 > win.cm) win = { cm: acc * 100, foot: BONES[fb], t: T(i), at: lab(i) }; } }
    r.slide = { perDeg: turnDeg > 1 ? turnSlide * 100 / turnDeg : null, turnDeg, win };
    // walking: the pelvis moving up or down faster than LIM.hipJump in one sample (a 2-3 cm walking bob at 2 Hz peaks near 0.3 m/s)
    let hj = 0, hjMax = { cm: 0 }, wT = 0; for (let i = 1; i < n; i++) { if (!ok(i) || vb[i] < 0.6 * gs) continue; wT += dt; const dyp = Math.abs(at(i, 13) - at(i - 1, 13)); if (dyp / dt > LIM.hipJump) hj++; if (dyp * 100 > hjMax.cm) hjMax = { cm: dyp * 100, t: T(i), at: lab(i) }; }
    r.hip = { jumps: hj, perSec: wT ? hj / wT : 0, walkS: wT, max: hjMax };
    // turning in bursts: how often the body starts turning (still -> turning) per second of turning
    let bursts = 0, turnS = 0, on = false; for (let i = 1; i < n; i++) { if (!ok(i)) { on = false; continue; } let dy = at(i, 5) - at(i - 1, 5); dy = Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy))) * D / dt; const m = dy > 5; if (m) turnS += dt; if (m && !on) bursts++; on = m; }
    r.bursts = { n: bursts, turnS, perSec: turnS ? bursts / turnS : 0 }; }
  r.feet.byPhase = Object.fromEntries(Object.entries(byPh).map(([k, v]) => [k, +(v * 100).toFixed(1)]));
  return r;
}
function compareFps(a, b, labels) {
  // a: 60 fps trace, b: 30 fps trace; compare at b's times
  if (!a || !b) return null; const idx = new Map(); for (let i = 0; i < a.n; i++) idx.set(Math.round(a.f[i * S] * 600), i);
  let root = { v: 0 }, yaw = { v: 0 }, bone = { v: 0 }, m = 0;
  for (let j = 0; j < b.n; j++) { const t = b.f[j * S], i = idx.get(Math.round(t * 600)); if (i === undefined) continue; m++; const A = (k) => a.f[i * S + k], B = (k) => b.f[j * S + k];
    const dr = Math.hypot(A(2) - B(2), A(4) - B(4)) * 100; if (dr > root.v) root = { v: dr, t, at: labels[A(1)] };
    let dy = A(5) - B(5); dy = Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy))) * D; if (dy > yaw.v) yaw = { v: dy, t, at: labels[A(1)] };
    for (let k = 0; k < BONES.length; k++) { const o = 12 + k * 3; if (isNaN(A(o))) continue; const d = hyp3(A(o) - B(o), A(o + 1) - B(o + 1), A(o + 2) - B(o + 2)) * 100; if (d > bone.v) bone = { v: d, bone: BONES[k], t, at: labels[A(1)] }; } }
  return { matched: m, root, yaw, bone };
}
function analyzeHands(h, dt, labels, events, cfgH) {
  const F = h.f, n = h.n, at = (i, k) => F[i * HS + k], T = (i) => at(i, 0);
  const act = (i) => at(i, 20) < cfgH.throwTime + dt || at(i, 21) < cfgH.grabTime + dt || at(i, 22) < cfgH.recoilTime + dt;
  const qang = (i, o) => { const a = [at(i - 1, o), at(i - 1, o + 1), at(i - 1, o + 2), at(i - 1, o + 3)], b = [at(i, o), at(i, o + 1), at(i, o + 2), at(i, o + 3)]; const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)) * D; };
  const step = (i, o) => hyp3(at(i, o) - at(i - 1, o), at(i, o + 1) - at(i - 1, o + 1), at(i, o + 2) - at(i - 1, o + 2));
  const out = { idle: { v: 0 }, action: { v: 0 }, idleRot: { v: 0 }, actRot: { v: 0 }, snap: { mm: 0 }, stop: { a: 0 }, perEvent: [] };
  for (let i = 1; i < n; i++) { const a = act(i) || act(i - 1);
    for (const [o, side] of [[2, 'left'], [9, 'right']]) { const v = step(i, o) / dt, w = qang(i, o + 3) / dt, k = a ? 'action' : 'idle', kr = a ? 'actRot' : 'idleRot';
      if (v > out[k].v) out[k] = { v, hand: side, t: T(i), at: labels[at(i, 1)] }; if (w > out[kr].v) out[kr] = { v: w, hand: side, t: T(i), at: labels[at(i, 1)] };
      if (i + 1 < n && i > 1) { const ex = step(i, o) - Math.max(step(i - 1, o), step(i + 1, o)); if (ex * 1000 > out.snap.mm) out.snap = { mm: ex * 1000, hand: side, t: T(i), at: labels[at(i, 1)] };
        const acc = hyp3(at(i + 1, o) - 2 * at(i, o) + at(i - 1, o), at(i + 1, o + 1) - 2 * at(i, o + 1) + at(i - 1, o + 1), at(i + 1, o + 2) - 2 * at(i, o + 2) + at(i - 1, o + 2)) / (dt * dt); if (acc > out.stop.a) out.stop = { a: acc, hand: side, t: T(i), at: labels[at(i, 1)] }; } } }
  // each event: the largest move and one-sample jump in the 0.15 s after it, against the 0.15 s before it
  for (const e of events) { let mv = 0, sn = 0, before = 0; for (let i = 2; i < n - 1; i++) { const t = T(i); if (t < e.t - 0.15 || t > e.t + 0.15 + dt) continue;
      for (const o of [2, 9]) { const d = step(i, o) * 1000; if (t <= e.t) before = Math.max(before, d); else { mv = Math.max(mv, d); sn = Math.max(sn, (step(i, o) - Math.max(step(i - 1, o), step(i + 1, o))) * 1000); } } }
    out.perEvent.push({ t: e.t, what: e.what, ok: e.ok, mmPerSample: mv, mmBefore: before, snapMm: sn }); }
  return out;
}
function compareHands(a, b) { if (!a || !b) return null; const idx = new Map(); for (let i = 0; i < a.n; i++) idx.set(Math.round(a.f[i * HS] * 600), i); let w = { mm: 0, t: 0, hand: '-' }, m = 0;
  for (let j = 0; j < b.n; j++) { const t = b.f[j * HS], i = idx.get(Math.round(t * 600)); if (i === undefined) continue; m++; for (const o of [2, 9]) { const d = hyp3(a.f[i * HS + o] - b.f[j * HS + o], a.f[i * HS + o + 1] - b.f[j * HS + o + 1], a.f[i * HS + o + 2] - b.f[j * HS + o + 2]) * 1000; if (d > w.mm) w = { mm: d, t, hand: o === 2 ? 'left' : 'right' }; } }
  w.matched = m; return w; }

// ---------------- run ----------------
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=3072'] });
  let fail = 0; const lines = [], ok = (c, m) => { lines.push((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; }, info = (m) => lines.push('INFO ' + m);
  const f1 = (x) => (x == null || isNaN(x) ? '-' : (+x).toFixed(1)), f2 = (x) => (x == null || isNaN(x) ? '-' : (+x).toFixed(2)), f0 = (x) => (x == null || isNaN(x) ? '-' : String(Math.round(+x)));
  const W = (o) => (o && o.t != null ? ' at ' + f2(o.t) + ' s (' + o.at + (/^film:/.test(o.at) && o.aux != null ? ', screen black ' + Math.round(100 * o.aux) + '%' : '') + ')' : '');
  const RA = await pass(b, 1 / 60, true);
  let RB = null; if (!NO30) { try { RB = await pass(b, 1 / 30, false); } catch (e) { info('30 fps pass failed: ' + String(e).slice(0, 200)); } }
  await b.close();
  const cfgH = RA.cfgH; // the hand action times from the game's CONFIG.hands
  const summary = { tier, page: path.basename(page0), limits: LIM, people: {}, hands: null, notes: RA.notes, models: RA.models };
  info('tier ' + tier + ', page ' + path.basename(page0) + ', samples at 60 fps' + (RB ? ' and a second pass at 30 fps' : '') + '; models ' + JSON.stringify(RA.models));
  if (RA.afterErr) ok(false, 'test script error in a frame: ' + RA.afterErr.slice(0, 200));
  for (const nt of RA.notes) info('note: ' + nt);
  if (RA.night) info('night: phase ' + RA.nightPhase + ', fine pointer ' + RA.night.FINE + ', devices ' + JSON.stringify(RA.night.kinds) + ', events ' + RA.night.events.map((e) => e.what + (e.ok ? '' : ' (refused)')).join('; '));
  if (RA.film) info('film: sampled ' + f1(RA.film.run.t) + ' s from 44 s (parts ' + JSON.stringify(RA.film.parts) + ')');
  for (const [key, tr] of Object.entries(RA.traces)) {
    const film = key.endsWith('_film'), r = analyzePerson(tr, RA.dt, RA.labels, film), rb = RB && RB.traces[key] ? analyzePerson(RB.traces[key], RB.dt, RB.labels, film) : null, cmp = RB ? compareFps(tr, RB.traces[key], RA.labels) : null, nm = tr.info.who || key;
    summary.people[key] = { who: nm, info: tr.info, r60: r, r30: rb, fps: cmp };
    if (tr.info.missing && tr.info.missing.length) info(nm + ': bones missing ' + tr.info.missing.join(','));
    info(nm + ': ' + f1(r.seconds) + ' s sampled' + (r.hidden ? ' (' + r.hidden + ' samples on a black screen left out)' : '') + ', eyes ' + (tr.info.eyes && tr.info.eyes.length ? 'as bones ' + tr.info.eyes.join(',') : 'ride the head (no eye bones)'));
    ok(r.pop.ratio <= 1, nm + ' pops (bone speed): worst ' + r.pop.bone + ' ' + f2(r.pop.v) + ' m/s (' + f1(r.pop.cm) + ' cm in one sample, limit ' + f2(r.pop.lim) + ' m/s)' + W(r.pop) + ', ' + r.pop.count + ' samples over');
    ok(r.snap.ratio <= 1, nm + ' snaps (one-sample jump over both neighbours): worst ' + r.snap.bone + ' ' + f2(r.snap.cm) + ' cm (limit ' + f2(r.snap.limCm) + ' cm)' + W(r.snap) + ', ' + r.snap.count + ' over');
    info(nm + ' largest bone acceleration ' + f0(r.acc.a) + ' m/s2 (' + r.acc.bone + (r.acc.walking ? ', walking' : ', standing') + ')' + W(r.acc));
    ok(r.slide.win.cm <= LIM.plantCm, nm + ' planted foot slide (not walking): worst ' + f1(r.slide.win.cm) + ' cm in 1 s (' + r.slide.win.foot + W(r.slide.win) + ', limit ' + LIM.plantCm + ' cm)');
    if (r.slide.turnDeg > 10) ok(r.slide.perDeg <= LIM.slideDeg, nm + ' feet while the body turns on the spot: ' + f2(r.slide.perDeg) + ' cm of planted-foot slide per degree (' + f0(r.slide.turnDeg) + ' deg turned; a 90 deg turn slides ' + f0(r.slide.perDeg * 90) + ' cm; limit ' + LIM.slideDeg + ' cm/deg = pivoting on the ball of the foot)');
    if (r.bursts.turnS > 0.5) info(nm + ' turning: ' + r.bursts.n + ' starts in ' + f1(r.bursts.turnS) + ' s of turning (' + f1(r.bursts.perSec) + ' per s)');
    if (r.hip.walkS > 1) ok(r.hip.perSec === 0, nm + ' walking hiccup: pelvis moves up/down faster than ' + LIM.hipJump + ' m/s in ' + r.hip.jumps + ' samples (' + f1(r.hip.perSec) + ' per s of walking, ' + f0(r.hip.walkS) + ' s walked), largest ' + f1(r.hip.max.cm) + ' cm in one sample' + W(r.hip.max));
    if (r.feet.walkPlants) { ok(r.feet.worstSkate <= LIM.skate, nm + ' walking: planted foot speed / body speed mean ' + f2(r.feet.skate) + ', worst ' + f2(r.feet.worstSkate) + ' (signed along the walk ' + f2(r.feet.signed) + '; + skates forward, - moonwalks)');
      if (r.feet.strides) ok(Math.abs(r.feet.worstStride.ratio - 1) <= LIM.stride, nm + ' stride / ground speed: median ' + f2(r.feet.strideMed) + ' (stride time ' + f2(r.feet.strideT) + ' s), worst ' + f2(r.feet.worstStride.ratio) + W(r.feet.worstStride) + ' over ' + r.feet.strides + ' strides'); }
    ok(r.yaw.rate.v <= LIM.yawRate && r.yaw.acc.v <= LIM.yawAcc, nm + ' body turn: fastest ' + f0(r.yaw.rate.v) + ' deg/s' + W(r.yaw.rate) + ', sharpest change ' + f0(r.yaw.acc.v) + ' deg/s2' + (r.yaw.acc.from != null ? ' (' + f0(r.yaw.acc.from) + ' -> ' + f0(r.yaw.acc.to) + ' deg/s in one sample)' : '') + W(r.yaw.acc));
    ok(r.head.rate.v <= LIM.headRate && r.head.acc.v <= LIM.headAcc, nm + ' head: fastest ' + f0(r.head.rate.v) + ' deg/s' + W(r.head.rate) + ', sharpest change ' + f0(r.head.acc.v) + ' deg/s2' + W(r.head.acc));
    if (rb) ok(rb.pop.ratio <= 1 && rb.snap.ratio <= 1 && rb.yaw.acc.v <= LIM.yawAcc && rb.head.acc.v <= LIM.headAcc && rb.slide.win.cm <= LIM.plantCm, nm + ' at 30 fps: pop ' + f2(rb.pop.v) + ' m/s (' + rb.pop.bone + W(rb.pop) + '), snap ' + f2(rb.snap.cm) + ' cm (limit ' + f2(rb.snap.limCm) + '), turn change ' + f0(rb.yaw.acc.v) + ' deg/s2, head change ' + f0(rb.head.acc.v) + ' deg/s2, foot slide ' + f1(rb.slide.win.cm) + ' cm in 1 s');
    if (cmp) ok(cmp.root.v <= LIM.fpsCm && cmp.yaw.v <= LIM.fpsDeg && cmp.bone.v <= LIM.fpsCm, nm + ' same motion at 30 and 60 fps: root path ' + f1(cmp.root.v) + ' cm' + W(cmp.root) + ', facing ' + f1(cmp.yaw.v) + ' deg' + W(cmp.yaw) + ', any bone ' + f1(cmp.bone.v) + ' cm (' + cmp.bone.bone + W(cmp.bone) + '), ' + cmp.matched + ' samples');
  }
  if (RA.hands) {
    const evA = RA.night.events, h = analyzeHands(RA.hands, RA.dt, RA.labels, evA, cfgH), hb = RB && RB.hands ? analyzeHands(RB.hands, RB.dt, RB.labels, RB.night.events, cfgH) : null, hc = RB && RB.hands ? compareHands(RA.hands, RB.hands) : null;
    summary.hands = { h60: h, h30: hb, fps: hc };
    ok(h.idle.v <= LIM.handIdle && h.idleRot.v <= LIM.handIdleDeg, 'hands with no action running: fastest ' + f2(h.idle.v) + ' m/s (' + h.idle.hand + W(h.idle) + '), turn ' + f0(h.idleRot.v) + ' deg/s' + W(h.idleRot) + ' (limits ' + LIM.handIdle + ' m/s, ' + LIM.handIdleDeg + ' deg/s)');
    ok(h.action.v <= LIM.handAct && h.actRot.v <= LIM.handActDeg, 'hands in an action: fastest ' + f2(h.action.v) + ' m/s (' + h.action.hand + W(h.action) + '), turn ' + f0(h.actRot.v) + ' deg/s' + W(h.actRot));
    ok(h.snap.mm <= LIM.handSnapMm, 'hands one-sample jump over both neighbours: worst ' + f2(h.snap.mm) + ' mm (' + h.snap.hand + W(h.snap) + ', limit ' + LIM.handSnapMm + ' mm)');
    info('hands largest acceleration ' + f0(h.stop.a) + ' m/s2 (' + h.stop.hand + W(h.stop) + ')');
    for (const e of h.perEvent) ok(e.snapMm <= LIM.handSnapMm, 'hands at "' + e.what + '"' + (e.ok ? '' : ' (game refused it)') + ' t ' + f2(e.t) + ' s: largest move ' + f2(e.mmPerSample) + ' mm/sample (before ' + f2(e.mmBefore) + '), one-sample jump ' + f2(e.snapMm) + ' mm');
    // 30 fps: a perfectly smooth minimum-jerk reach (0.18 m in 0.165 s, a fast hand move) leaves a one-sample excess of 2.7 mm at 60 fps but 18.6 mm at 30 fps (6.9 x, not 4 x:
    // a smooth curve's excess grows with the sample time cubed), so this line allows 8 x the 60 fps limit; real jumps are caught by the 60 fps line and the 30-vs-60 path line
    if (hb) ok(hb.snap.mm <= LIM.handSnapMm * 8 && hb.idle.v <= LIM.handIdle, 'hands at 30 fps: worst jump ' + f2(hb.snap.mm) + ' mm (limit ' + LIM.handSnapMm * 8 + ' mm at 30 fps)' + W(hb.snap) + ', fastest with no action ' + f2(hb.idle.v) + ' m/s');
    if (hc) ok(hc.mm <= LIM.handFpsMm, 'hands same path at 30 and 60 fps: worst ' + f2(hc.mm) + ' mm (' + hc.hand + ' at ' + f2(hc.t) + ' s), ' + hc.matched + ' samples compared');
  }
  ok(!RA.errs.length && !(RB && RB.errs.length), 'no page errors ' + RA.errs.concat(RB ? RB.errs : []).join(' | ').slice(0, 300));
  for (const l of lines) console.log(l);
  const js = JSON.stringify(summary, (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v));
  console.log('JSON ' + js); if (JSONF) fs.writeFileSync(JSONF, js);
  if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); for (const [nm, R] of [['60', RA], ['30', RB]]) { if (!R) continue; fs.writeFileSync(path.join(DUMP, 'labels' + nm + '.json'), JSON.stringify(R.labels)); for (const [k, t] of Object.entries(R.traces)) fs.writeFileSync(path.join(DUMP, k + '_' + nm + '.f32'), Buffer.from(t.f.buffer)); if (R.hands) fs.writeFileSync(path.join(DUMP, 'hands_' + nm + '.f32'), Buffer.from(R.hands.f.buffer)); } }
  if (RA.frames) {
    if (FR) { fs.mkdirSync(FR, { recursive: true }); RA.frames.forEach((fr, i) => fs.writeFileSync(path.join(FR, tier + '_' + String(i).padStart(3, '0') + '.jpg'), Buffer.from(fr.url.split(',')[1], 'base64'))); fs.writeFileSync(path.join(FR, tier + '_labels.json'), JSON.stringify(RA.frames.map((f) => f.label))); }
    if (B64) RA.frames.forEach((fr, i) => { const d = fr.url.split(',')[1]; console.log('IMG ' + i + ' ' + tier + ' ' + fr.label); for (let k = 0; k < d.length; k += 3000) console.log('IMGD ' + i + ' ' + d.slice(k, k + 3000)); });
  }
  console.log(fail ? 'SOME FAILED' : 'ALL PASS');
})().catch((e) => { console.log('FAIL crashed ' + String((e && e.stack) || e).slice(0, 400)); console.log('SOME FAILED'); process.exit(1); });
