// Base people motion check (owner, Nov 16: "base people movement ... natural"; rules from docs/muybridge-motion-reference.md). Bram, Oko, Pip and a walking recruit.
// The game's own clock is held still (window.__dtMax) and the people are stepped by hand inside the page at a fixed time step (1/60 s, and 1/20 s for the frame-rate test),
// through the same calls the game makes (bview.update), so the numbers do not depend on how slow the software renderer is. Every bone's WORLD turn is recorded (what the eye sees).
//   jump  = the fastest any bone turns between two frames, in degrees per second (a pose that snaps shows up as a huge number; scaled by dt, so 20 and 60 fps compare)
//   idle  = how far the bones turn on their own joints while the person stands alone (breathing, weight shift), how far the hips travel, and that the feet stay on the ground
//   turn  = a half turn to face the player behind: how long it takes, the order the head, chest, hips and feet start, how many pivot steps, the fastest foot turn, the final error
//   stride = time of one full stride (left + right step) from the foot's back-and-forth, against Muybridge's numbers (woman 1.0 s, man 1.05 s, child 0.65 s), within 15%
//   settle = the forearms still moving after the body has stopped (overlapping action)
// Usage: node tools/animcheck.cjs [low|high] [page.html] [--json]. Prints PASS / FAIL / INFO lines and ALL PASS or SOME FAILED.
const { chromium } = require('playwright');
const path = require('path');
const tier = process.argv[2] === 'high' ? 'high' : 'low', asJson = process.argv.includes('--json');
const page = process.argv.find((a) => a.endsWith('.html')) || path.join(__dirname, '../dist/index_single.html');
// limits (see the comment at the top)
const LIM = {
  standJump: 250,            // deg/s: fastest bone turn of a standing or turning person (a snapped pose is thousands)
  walkJump: 900,             // deg/s: fastest bone turn while walking (a knee swings at up to ~400-600 deg/s in real gait)
  idleDeg: 0.8, idleBones: 4, idleHipMm: 5, feetMm: 15, // idle: largest joint drift (deg), joints moving over 0.3 deg, hips travel (mm), feet up and down (mm)
  turnMin: 0.6, turnMax: 2.0, turnErr: 10, stepsMin: 2, stepsMax: 4, footSpin: 450, turnDt: 0.15, // half turn: time (s), final error (deg), pivot steps, fastest foot turn (deg/s), 20 vs 60 fps time difference (share)
  stride: { man: 1.05, woman: 1.0, child: 0.65 }, strideTol: 0.15,
  cornerYaw: 300,            // deg/s: fastest body turn of a walking recruit at a corner
  settleS: 0.15,             // s: the forearm must still be moving at least this long after the feet stop
};
const KIND = { bram: 'man', oko: 'woman', pip: 'child' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + path.resolve(page) + '?seed=777&fx=0&quality=' + tier); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 300000 });
  await p.evaluate(() => { window.__dtMax = 1e-6; window.__game.enterBase(); });
  await p.waitForFunction(() => { const pk = window.__game.bview.peek && window.__game.bview.peek(); return pk && ['bram', 'oko', 'pip'].every((k) => pk.chars[k] && pk.chars[k].ready && pk.chars[k].root.parent) && pk.npcs.some((o) => o.ch && o.ch.ready && o.ch.root.parent === o.n); }, null, { timeout: 600000 });
  const R = await p.evaluate(({ KIND }) => {
    const g = window.__game, pk = g.bview.peek(), D = 180 / Math.PI, out = {};
    const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'];
    const Q = (o) => o.getWorldQuaternion(new o.quaternion.constructor()), V = (o) => o.getWorldPosition(new o.position.constructor());
    const ang = (a, b) => { const d = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w); return 2 * Math.acos(Math.min(1, d)) * D; };
    const yawOf = (q) => Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
    const dyaw = (q, q0) => yawOf(q.clone().multiply(q0.clone().invert())) * D;
    let P = [40, 40]; const upd = (dt) => g.bview.update(dt, P[0], P[1], 1.6);
    // record a person: bones' world turns and local turns, the root and pelvis, the feet; step(dt) is called before each frame
    const rec = (ch, n, dt, step) => { const root = ch.root, bs = BONES.map((k) => root.getObjectByName(k)), f = { w: [], l: [], root: [], pel: [], feet: [], hip: [], dt };
      for (let i = 0; i < n; i++) { step(dt, i); root.updateMatrixWorld(true); f.w.push(bs.map((x) => (x ? Q(x) : null))); f.l.push(bs.map((x) => (x ? x.quaternion.clone() : null))); f.root.push(Q(root));
        const fl = root.getObjectByName('foot_l'), fr = root.getObjectByName('foot_r'), pe = root.getObjectByName('pelvis'); f.feet.push([V(fl), V(fr)]); f.hip.push(V(pe)); } return f; };
    const jump = (f) => { let m = 0, at = ''; for (let i = 1; i < f.w.length; i++) f.w[i].forEach((q, k) => { if (!q) return; const s = ang(q, f.w[i - 1][k]) / f.dt; if (s > m) { m = s; at = BONES[k] + '@' + i; } }); return { m, at }; };
    const idleOf = (f) => { const dev = BONES.map((_, k) => { let m = 0; for (const fr of f.l) if (fr[k] && f.l[0][k]) m = Math.max(m, ang(fr[k], f.l[0][k])); return m; });
      const hx = f.hip.map((v) => v.x), hz = f.hip.map((v) => v.z), fy = f.feet.map((v) => Math.min(v[0].y, v[1].y));
      return { max: Math.max(...dev), moving: dev.filter((d) => d > 0.3).length, hipMm: Math.hypot(Math.max(...hx) - Math.min(...hx), Math.max(...hz) - Math.min(...hz)) * 1000, feetMm: (Math.max(...fy) - Math.min(...fy)) * 1000 }; };
    // a turn: when each part has done 20% of the turn; pivot steps = bursts of foot (root) turning; fastest root turn
    const turnOf = (f, want) => { const k = (n) => BONES.indexOf(n), y = (sel) => f.w.map((fr, i) => dyaw(sel(fr, i), sel(f.w[0], 0)));
      const parts = { head: y((fr) => fr[k('head')]), chest: y((fr) => fr[k('spine_03')]), hips: y((fr) => fr[k('pelvis')]), feet: f.root.map((q) => dyaw(q, f.root[0])) };
      const tot = parts.feet[parts.feet.length - 1], t20 = {}; for (const [nm, s] of Object.entries(parts)) { const i = s.findIndex((v) => Math.abs(v) >= Math.abs(tot) * 0.2); t20[nm] = i < 0 ? null : i * f.dt; }
      const fv = []; for (let i = 1; i < parts.feet.length; i++) fv.push(Math.abs(parts.feet[i] - parts.feet[i - 1]) / f.dt);
      let steps = 0, on = false; for (const v of fv) { const o = v > 20; if (o && !on) steps++; on = o; }
      const mv = fv.map((v) => v > 1), s0 = mv.indexOf(true), e0 = mv.lastIndexOf(true), endYaw = yawOf(f.root[f.root.length - 1]);
      const hm = parts.head.findIndex((v) => Math.abs(v) > 1), fm = s0;
      return { time: s0 < 0 ? 0 : (e0 - s0 + 1) * f.dt, total: tot, t20, steps, footMax: Math.max(...fv), err: Math.abs(Math.atan2(Math.sin(want - endYaw), Math.cos(want - endYaw))) * D, headFirst: hm >= 0 && (fm < 0 || hm < fm), headStart: hm * f.dt, feetStart: fm * f.dt }; };
    // the foot's back-and-forth (forward distance from the pelvis, in the body's frame) -> stride time from rising mean-crossings
    const strideOf = (f) => { const s = f.feet.map((v, i) => { const q = f.root[i], fw = { x: 2 * (q.x * q.z + q.w * q.y), z: 1 - 2 * (q.x * q.x + q.y * q.y) }; return (v[0].x - f.hip[i].x) * fw.x + (v[0].z - f.hip[i].z) * fw.z; });
      const half = s.slice(Math.floor(s.length / 3)), mean = half.reduce((a, b) => a + b, 0) / half.length, amp = Math.max(...half) - Math.min(...half), cr = [];
      for (let i = 1; i < half.length; i++) if (half[i - 1] < mean && half[i] >= mean) cr.push(i); return { period: cr.length > 1 ? (cr[cr.length - 1] - cr[0]) / (cr.length - 1) * f.dt : 0, cycles: cr.length - 1, ampMm: amp * 1000 }; };
    const armOf = (f) => { const k = BONES.indexOf('upperarm_l'); let m = 0; const base = f.l[Math.floor(f.l.length / 3)][k]; for (const fr of f.l.slice(Math.floor(f.l.length / 3))) if (fr[k] && base) m = Math.max(m, ang(fr[k], base)); return m; };
    // ---- 1. each villager alone: idle, then a half turn to face the player behind them, at 60 and 20 fps
    for (const id of ['bram', 'oko', 'pip']) {
      const ch = pk.chars[id], h = pk.npcG[id].p, c = h.position, at = (a, d) => [c.x + Math.sin(a) * d, c.z + Math.cos(a) * d], r = {};
      P = [40, 40]; rec(ch, 240, 1 / 60, upd);
      { const f = rec(ch, 300, 1 / 60, upd); r.idle = idleOf(f); r.idleJump = jump(f); }
      P = at(0, 3.5); rec(ch, 300, 1 / 60, upd);
      const face0 = yawOf(Q(ch.root)); P = at(face0 + Math.PI * 0.999, 3.5);
      { const f = rec(ch, 240, 1 / 60, upd); r.turn = turnOf(f, Math.atan2(P[0] - c.x, P[1] - c.z)); r.turnJump = jump(f); }
      P = at(yawOf(Q(ch.root)), 3.5); rec(ch, 300, 1 / 60, upd); P = at(yawOf(Q(ch.root)) + Math.PI * 0.999, 3.5);
      { const f = rec(ch, 80, 1 / 20, upd); r.turn20 = turnOf(f, Math.atan2(P[0] - c.x, P[1] - c.z)); r.turn20Jump = jump(f); }
      // walking in place through the person's own controller (the villagers do not walk about in the game; the recruits do, below)
      if (ch.drive) { const fy = yawOf(Q(ch.root)) - yawOf(Q(h)); const f = rec(ch, 360, 1 / 60, (dt) => ch.drive(dt, { face: fy, go: true })); r.stride = strideOf(f); r.walkJump = jump(f); r.arm = armOf(f);
        // stop: when do the feet stop, and how long after that do the forearms still move
        // the legs have stopped after their last frame turning faster than 10 deg/s (a weight shift is slower); the loose parts (forearm, hand, head, each on its own joint) are still settling while one turns faster than 3 deg/s
        const g2 = rec(ch, 150, 1 / 60, (dt) => ch.drive(dt, { face: fy, go: false })), ks = ['lowerarm_l', 'hand_l', 'head'].map((n) => BONES.indexOf(n)), kf = BONES.indexOf('thigh_l'); let ls = -1, fs = -1;
        for (let i = 1; i < g2.l.length; i++) { if (ang(g2.l[i][kf], g2.l[i - 1][kf]) / g2.dt > 10) fs = i; if (ks.some((k) => ang(g2.l[i][k], g2.l[i - 1][k]) / g2.dt > 3)) ls = i; } r.settle = (ls - fs) * g2.dt; r.stopJump = jump(g2);
      } else if (ch.walk) { const f = rec(ch, 360, 1 / 60, (dt) => ch.walk(dt, 1.5)); r.stride = strideOf(f); r.walkJump = jump(f); r.arm = armOf(f); r.old = true; }
      P = [40, 40]; rec(ch, 300, 1 / 60, upd); out[id] = r;
    }
    // ---- 2. a recruit on patrol (real game path), 10 s with corners, player far away
    { const o = pk.npcs.find((x) => x.ch && x.ch.ready && x.ch.root.parent === x.n); P = [40, 40]; const f = rec(o.ch, 600, 1 / 60, upd), r = {};
      r.role = o.p.role; r.kind = o.ch.kind || '?'; r.jump = jump(f); r.stride = strideOf(f); let ys = 0; const ry = f.root.map((q) => yawOf(q)); for (let i = 1; i < ry.length; i++) ys = Math.max(ys, Math.abs(Math.atan2(Math.sin(ry[i] - ry[i - 1]), Math.cos(ry[i] - ry[i - 1]))) * D / f.dt); r.cornerYaw = ys; out.recruit = r; }
    out.inside = { bram: g.B.NPCS.bram.inside || null, oko: g.B.NPCS.oko.inside || null, pip: g.B.NPCS.pip.inside || null };
    return out;
  }, { KIND });
  if (asJson) console.log(JSON.stringify(R));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; }, f1 = (x) => (x == null ? '-' : (+x).toFixed(2)), f0 = (x) => (x == null ? '-' : Math.round(+x));
  console.log('INFO tier ' + tier + ', page ' + path.basename(page));
  for (const id of ['bram', 'oko', 'pip']) { const r = R[id], nm = id[0].toUpperCase() + id.slice(1), T = r.turn;
    ok(r.idle.max >= LIM.idleDeg && r.idle.moving >= LIM.idleBones && r.idle.hipMm >= LIM.idleHipMm, nm + ' idle moves: largest joint drift ' + f1(r.idle.max) + ' deg, joints moving ' + r.idle.moving + ', hips travel ' + f1(r.idle.hipMm) + ' mm');
    ok(r.idle.feetMm <= LIM.feetMm, nm + ' idle feet stay down: up and down ' + f1(r.idle.feetMm) + ' mm');
    ok(r.idleJump.m <= LIM.standJump, nm + ' idle no pose jump: fastest bone ' + f0(r.idleJump.m) + ' deg/s (' + r.idleJump.at + ')');
    ok(r.turnJump.m <= LIM.standJump * 2 && r.turn20Jump.m <= LIM.standJump * 2, nm + ' turn no pose jump: fastest bone ' + f0(r.turnJump.m) + ' deg/s at 60 fps, ' + f0(r.turn20Jump.m) + ' at 20 fps (' + r.turnJump.at + ')');
    // a villager who stands inside a room you walk into (Oko behind the workshop bench, 2026-11-17) turns to you only inside that room, and no one can stand behind her there:
    // the half-turn tests (player 3.5 m behind, outside the wall) do not apply to her; tools/workshopcheck.cjs checks her inside the room
    if (R.inside && R.inside[id]) console.log('INFO ' + nm + ' stands inside a room (' + R.inside[id] + '): half-turn tests skipped');
    else {
    ok(T.time >= LIM.turnMin && T.time <= LIM.turnMax && T.err <= LIM.turnErr, nm + ' half turn takes ' + f1(T.time) + ' s (turned ' + f0(T.total) + ' deg), final error ' + f1(T.err) + ' deg');
    const o = T.t20; ok(o.head != null && o.chest != null && o.hips != null && o.feet != null && o.head < o.chest && o.chest <= o.hips && o.hips <= o.feet, nm + ' turn order (20% of the turn reached at): head ' + f1(o.head) + ' s, chest ' + f1(o.chest) + ' s, hips ' + f1(o.hips) + ' s, feet ' + f1(o.feet) + ' s');
    ok(T.steps >= LIM.stepsMin && T.steps <= LIM.stepsMax && T.footMax <= LIM.footSpin, nm + ' turn in ' + T.steps + ' pivot steps, fastest foot turn ' + f0(T.footMax) + ' deg/s (no spin)');
    ok(T.time > 0 && Math.abs(r.turn20.time / T.time - 1) <= LIM.turnDt, nm + ' turn at 20 fps ' + f1(r.turn20.time) + ' s vs 60 fps ' + f1(T.time) + ' s');
    }
    const want = LIM.stride[KIND[id]]; ok(r.stride && Math.abs(r.stride.period / want - 1) <= LIM.strideTol, nm + ' (' + KIND[id] + ') stride ' + f1(r.stride && r.stride.period) + ' s (target ' + want + ' s, ' + (r.stride ? r.stride.cycles : 0) + ' cycles), foot travel ' + f0(r.stride && r.stride.ampMm) + ' mm' + (r.old ? ' [old walk at 1.5 m/s]' : ''));
    ok(r.walkJump && r.walkJump.m <= LIM.walkJump, nm + ' walking no pose jump: fastest bone ' + f0(r.walkJump && r.walkJump.m) + ' deg/s (' + (r.walkJump && r.walkJump.at) + ')');
    if (r.settle != null) ok(r.settle >= LIM.settleS && r.stopJump.m <= LIM.walkJump, nm + ' loose parts settle after the stop: forearm, hand or head still moving ' + f1(r.settle) + ' s after the legs stop; fastest bone ' + f0(r.stopJump.m) + ' deg/s');
    console.log('INFO ' + nm + ' arm swing ' + f1(r.arm) + ' deg; head starts ' + f1(T.headStart) + ' s, feet start ' + f1(T.feetStart) + ' s');
  }
  const W = R.recruit; ok(W.jump.m <= LIM.walkJump, 'recruit (' + W.role + ', ' + W.kind + ') walking no pose jump: fastest bone ' + f0(W.jump.m) + ' deg/s (' + W.jump.at + ')');
  ok(W.cornerYaw <= LIM.cornerYaw, 'recruit body turn at corners ' + f0(W.cornerYaw) + ' deg/s');
  if (LIM.stride[W.kind]) ok(Math.abs(W.stride.period / LIM.stride[W.kind] - 1) <= LIM.strideTol, 'recruit (' + W.kind + ') stride on patrol ' + f1(W.stride.period) + ' s (target ' + LIM.stride[W.kind] + ' s)'); else console.log('INFO recruit stride ' + f1(W.stride.period) + ' s (no gait kind: old build)');
  ok(!errs.length, 'no page errors ' + errs.join('|').slice(0, 200));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close();
})().catch((e) => { console.log('FAIL crashed', String(e).slice(0, 300)); console.log('SOME FAILED'); process.exit(1); });
