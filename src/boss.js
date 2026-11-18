// THE BECKONER: the final-night boss, headless (no rendering). Used by the game (src/sim.js creates it on ring 5's nights) and by the balance bots.
// Deterministic: its own seeded random stream. All numbers in CONFIG.boss (src/bossconfig.js). Works in the held house's own frame (the house at the origin).
// Phases: 'wait' (before the rise), 'rise', 'idle', 'summon' (tele -> summon -> hold -> lower), 'slam' (tele -> impact -> stuck -> recover), 'down' (dawn power-down), 'wreck' (core broken).
// the same small seeded generator as src/sim.js (copied: importing sim.js here would make a loop)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, a) => a[0] + r() * (a[1] - a[0]);

// api: the sim's own pieces the boss needs: spawns, breaches, finish(win), hurtDevice(dv, d), openAt(ax, az, bx, bz, floor), addGloom(k, o)
export function createBoss(s, cfg, opts, api) {
  const C = cfg.boss, rng = mulberry32((((opts.seed || 1) * 7) ^ 0xb055) >>> 0), dur = cfg.night.duration;
  // where it stands: out from the front wall across the road, then along the street (dir = +1 / -1 along the front wall's tangent; run.js sets it toward the nearer street end)
  const door = api.breaches.find((b) => b.floor === 0 && b.type === 'door') || api.breaches.find((b) => b.floor === 0);
  const B = {
    on: true, phase: 'wait', t: 0, x: 0, z: 0, fx: 0, fz: 1, rx: 1, rz: 0, act: null, slams: 0, summons: 0, budget: 0, cap: C.summon.cap,
    paws: { beckon: { hits: 0, broken: false }, slam: { hits: 0, broken: false } }, core: { hits: 0, broken: false }, dead: false, ended: false, log: [],
    nextSlam: 0, nextSummon: 0, lastTarget: -1, endT: 0,
  };
  B.place = (dir) => {
    const H = s.H, ox = -door.nx, oz = -door.nz, tx = -oz * (dir || 1), tz = ox * (dir || 1);
    // the front wall's middle point, then out and along
    const wx = Math.abs(ox) > 0.5 ? Math.sign(ox) * H : 0, wz = Math.abs(oz) > 0.5 ? Math.sign(oz) * H : 0;
    B.x = wx + ox * C.place.out + tx * C.place.side; B.z = wz + oz * C.place.out + tz * C.place.side;
    const d = Math.hypot(B.x, B.z) || 1; B.fx = -B.x / d; B.fz = -B.z / d; B.rx = -B.fz; B.rz = B.fx; B.dir = dir || 1;
  };
  B.place(1);
  // face the street direction (lx, lz) in the house frame: run.js passes the way to the nearer street end
  B.placeToward = (lx, lz) => { const ox = -door.nx, oz = -door.nz; B.place(-oz * lx + ox * lz >= 0 ? 1 : -1); };
  // summons replace the normal waves after the first one: those spawns become the budget
  // (waveKeep: this share of the later normal spawns still comes, picked evenly; the rest become the budget)
  { const keepT = C.keepFrac * dur, sp = api.spawns; let i = sp.findIndex((q) => q.t >= keepT); if (i >= 0) { const late = sp.splice(i), wk = C.waveKeep || 0; let acc = 0; for (const q of late) { acc += wk; if (acc >= 1) { acc -= 1; sp.push(q); } else B.budget++; } s.total -= B.budget; } }
  // a point in the boss's own frame -> the house frame
  B.at = (p) => ({ x: B.x + B.rx * p[0] - B.fx * p[2], y: p[1], z: B.z + B.rz * p[0] - B.fz * p[2] });
  const say = (k) => B.log.push({ e: 'marla', k });
  const ev = (k, o) => { const q = Object.assign({ e: 'boss', k, t: s.t }, o || {}); B.log.push(q); s.log.push(q); };
  const rest = (a) => pick(rng, a) * (s.t >= C.lateFrac * dur ? C.lateMul : 1);
  // the slam paw's target: a ground-floor opening that faces the boss, never where the player stands, not the last one hit (seeded)
  function slamTarget() {
    const p = s.player, ok = [];
    for (const b of api.breaches) {
      if (b.floor !== 0) continue;
      const cx = b.x - b.nx * C.slam.out, cz = b.z - b.nz * C.slam.out, dx = B.x - cx, dz = B.z - cz, dl = Math.hypot(dx, dz) || 1;
      if ((-b.nx * dx - b.nz * dz) / dl < C.slam.face) continue;
      if (p.floor === 0 && Math.hypot(p.x - cx, p.z - cz) < C.slam.ring + C.slam.avoid) continue;
      ok.push({ b, x: cx, z: cz });
    }
    if (!ok.length) return null;
    const pool = ok.length > 1 ? ok.filter((q) => q.b.i !== B.lastTarget) : ok;
    return pool[Math.floor(rng() * pool.length)];
  }
  function impact(tg) {
    const R = C.slam.ring, p = s.player;
    ev('impact', { x: tg.x, z: tg.z, bp: tg.b.i });
    tg.b.smashed = true;
    for (const dv of s.devices.slice()) { if (dv.floor !== 0 || Math.hypot(dv.x - tg.x, dv.z - tg.z) > R) continue; api.hurtDevice(dv, C.slam.devFrac * cfg.devices[dv.kind].hp); }
    if (p.floor === 0 && !p.climb && Math.hypot(p.x - tg.x, p.z - tg.z) <= R) { p.hp -= C.slam.playerFrac * cfg.player.hp; s.log.push({ e: 'hurt', slam: true }); }
  }
  function summon() {
    // a bigger house (more openings than the smallest ring-5 house, summon.base) gets bigger summons (perOpen more Gloom per extra opening) and a higher alive cap (capOpen)
    const extra = Math.max(0, s.n - (C.summon.base || 15)), alive = s.gloom.length, want = Math.min(C.summon.max, C.summon.start + C.summon.add * B.summons) + Math.round((C.summon.perOpen || 0) * extra);
    B.summons++;
    const cap = B.cap + Math.round((C.summon.capOpen || 0) * extra);
    if (alive >= cap) { ev('skip', { alive }); return; }
    const k = Math.min(want, C.budgetCap === false ? want : B.budget, cap - alive);
    if (k <= 0) { ev('skip', { alive, empty: true }); return; }
    const face = api.breaches.filter((b) => { const dx = B.x - b.x, dz = B.z - b.z, dl = Math.hypot(dx, dz) || 1; return b.floor === 0 && (-b.nx * dx - b.nz * dz) / dl > C.slam.face; });
    const bps = (face.length ? face : api.breaches.filter((b) => b.floor === 0)).map((b) => b.i);
    B.budget -= k;
    // feet: this share steps off at its feet (walking up the street); the rest come out of the dark round the house like a wave (fromAll: any opening)
    const kf = Math.round(k * (C.summon.feet === undefined ? 1 : C.summon.feet));
    if (kf > 0) api.addGloom(kf, { at: s.t, gap: C.summon.gap, bps, from: { x: B.x, z: B.z, r: C.summon.spread, rx: B.rx, rz: B.rz }, rng });
    if (k - kf > 0) api.addGloom(k - kf, { at: s.t + 0.3, gap: C.summon.gap, bps: api.breaches.map((b) => b.i), rng });
    ev('summon', { n: k, alive });
  }
  // its death throe (CONFIG.boss.wreck.throe): one last call as it falls, a few Gloom step off at its feet (not held back by the alive cap)
  function throe() {
    const face = api.breaches.filter((b) => { const dx = B.x - b.x, dz = B.z - b.z, dl = Math.hypot(dx, dz) || 1; return b.floor === 0 && (-b.nx * dx - b.nz * dz) / dl > C.slam.face; });
    api.addGloom(C.wreck.throe, { at: s.t, gap: C.summon.gap, bps: (face.length ? face : api.breaches.filter((b) => b.floor === 0)).map((b) => b.i), from: { x: B.x, z: B.z, r: C.summon.spread, rx: B.rx, rz: B.rz }, rng });
    ev('throe', { n: C.wreck.throe });
  }
  // weak points: which are open now, and where (house frame, y = height above the ground floor)
  B.points = () => {
    const out = [], a = B.act, W = C.weak;
    if (B.dead || B.phase === 'down' || B.phase === 'wreck') return out;
    if (!B.paws.beckon.broken && a && a.kind === 'summon' && a.step !== 'lower') { const q = B.at(C.pts.beckon); out.push({ id: 'beckon', x: q.x, y: q.y, z: q.z, r: W.pawR }); }
    if (!B.paws.slam.broken && a && a.kind === 'slam' && (a.step === 'tele' || a.step === 'stuck')) {
      const k = a.step === 'tele' ? Math.min(1, 1 - a.left / a.dur) : 1, y = a.step === 'tele' ? C.pts.slamUp[0] + (C.pts.slamUp[1] - C.pts.slamUp[0]) * k : C.pts.slamCore;
      out.push({ id: 'slam', x: a.tg.x, y, z: a.tg.z, r: W.pawR });
    }
    if (B.paws.beckon.broken && B.paws.slam.broken && !B.core.broken) { const q = B.at(C.pts.chest); out.push({ id: 'core', x: q.x, y: q.y, z: q.z, r: W.coreR }); }
    return out;
  };
  // a broken weak point spills its Sun cells into the player's battery (CONFIG.boss.spill), so the hunt pays for its shots
  const spill = (v) => { if (!(v > 0)) return; s.player.energy = Math.min(cfg.player.energyCap, s.player.energy + v); ev('spill', { sun: v }); };
  // a hit on weak point id (n hits); returns true when it broke
  B.hit = (id, n) => {
    const W = C.weak;
    if (id === 'core') { B.core.hits += n; ev('hit', { id, hits: B.core.hits }); if (B.core.hits >= W.coreHits && !B.core.broken) { B.core.broken = true; B.dead = true; B.phase = 'wreck'; B.endT = C.wreck.hold; B.act = null; B.budget = 0; if (C.wreck.endNight) api.spawns.length = s.spawned; else if (C.wreck.throe > 0) throe(); ev('break', { id }); spill(C.spill.core); return true; } return false; }
    const P = B.paws[id]; P.hits += n; ev('hit', { id, hits: P.hits });
    if (P.hits >= W.pawHits && !P.broken) {
      P.broken = true; ev('break', { id }); say('paw'); spill(C.spill.paw);
      if (B.act && B.act.kind === (id === 'beckon' ? 'summon' : 'slam')) { B.act = null; B.phase = 'idle'; }
      if (B.paws.beckon.broken && B.paws.slam.broken) { ev('coreOpen'); say('core'); }
      return true;
    }
    return false;
  };
  // a shot along the player's aim: eye (ex, ey, ez), direction (dx, dy, dz) unit; returns { id, along } of the nearest open weak point hit, or null
  B.ray = (ex, ey, ez, dx, dy, dz, floor) => {
    let best = null;
    for (const q of B.points()) {
      const vx = q.x - ex, vy = q.y - ey, vz = q.z - ez, t = vx * dx + vy * dy + vz * dz;
      if (t <= 0 || t > C.weak.range) continue;
      const cx = ex + dx * t - q.x, cy = ey + dy * t - q.y, cz = ez + dz * t - q.z;
      if (cx * cx + cy * cy + cz * cz > q.r * q.r) continue;
      if (!api.openAt(ex, ez, q.x, q.z, floor)) continue;
      if (!best || t < best.along) best = { id: q.id, along: t };
    }
    return best;
  };
  B.alive = () => !B.dead;
  // one sim step at night; returns true when the rest of the sim step must be skipped (the dawn power-down or the collapse after the core broke)
  B.step = (dt) => {
    const t = s.t;
    if (B.phase === 'down' || (B.phase === 'wreck' && C.wreck.endNight)) { B.endT -= dt; if (B.endT <= 0 && !B.ended) { B.ended = true; api.finish(true); } return true; }
    // broken for good (wreck.endNight off): it lies in a heap and the night goes on to dawn (or to an early dawn once every Gloom is gone)
    if (B.phase === 'wreck') { B.endT -= dt; if (t >= dur && !B.ended) { B.ended = true; api.finish(true); return true; } return false; }
    if (t >= dur) { B.phase = 'down'; B.act = null; B.endT = C.dawn.hold; ev('dawn'); say('dawn'); return true; }
    if (B.phase === 'wait') { if (t >= C.rise.at) { B.phase = 'rise'; ev('rise'); say('rise'); } return false; }
    if (B.phase === 'rise') { if (t >= C.rise.at + C.rise.dur) { B.phase = 'idle'; B.nextSlam = t + C.slam.first; B.nextSummon = t + C.summon.first; } return false; }
    const a = B.act;
    if (a) {
      a.left -= dt;
      if (a.kind === 'summon') {
        if (a.step === 'tele' && a.left <= 0) { summon(); if (B.summons === 1) say('summon'); a.step = 'hold'; a.left = a.dur = C.summon.hold; }
        else if (a.step === 'hold' && a.left <= 0) { a.step = 'lower'; a.left = a.dur = C.summon.lower; }
        else if (a.step === 'lower' && a.left <= 0) { B.act = null; B.phase = 'idle'; B.nextSummon = t + rest(C.summon.every); B.nextSlam = Math.max(B.nextSlam, t + C.summon.noSlam); }
      } else if (a.kind === 'slam') {
        if (a.step === 'tele' && a.left <= 0) { impact(a.tg); a.step = 'stuck'; a.left = a.dur = C.slam.stuck; }
        else if (a.step === 'stuck' && a.left <= 0) { a.step = 'recover'; a.left = a.dur = C.slam.recover; ev('lift'); }
        else if (a.step === 'recover' && a.left <= 0) { B.act = null; B.phase = 'idle'; B.nextSlam = t + rest(C.slam.every); }
      }
      return false;
    }
    // idle: start the action that is due (the one waiting longer first)
    const canSlam = !B.paws.slam.broken && t >= B.nextSlam, canSum = !B.paws.beckon.broken && t >= B.nextSummon;
    if (canSum && (!canSlam || B.nextSummon <= B.nextSlam)) { B.phase = 'summon'; B.act = { kind: 'summon', step: 'tele', left: C.summon.tele, dur: C.summon.tele }; ev('beckon'); }
    else if (canSlam) {
      const tg = slamTarget();
      if (!tg) { B.nextSlam = t + 2; return false; }
      const T = C.slam.tele[Math.min(B.slams, C.slam.tele.length - 1)];
      B.slams++; B.lastTarget = tg.b.i; B.phase = 'slam'; B.act = { kind: 'slam', step: 'tele', left: T, dur: T, tg }; ev('tele', { x: tg.x, z: tg.z, bp: tg.b.i, tele: T });
      if (B.slams === 1) say('slam');
    }
    return false;
  };
  // the night's bonus on a won night: per broken paw, the broken core (added to the result's food and essentials)
  B.reward = (res) => {
    const BN = C.bonus, n = (B.paws.beckon.broken ? 1 : 0) + (B.paws.slam.broken ? 1 : 0), ess = n * BN.paw.ess + (B.core.broken ? BN.core.ess : 0), food = n * BN.paw.food + (B.core.broken ? BN.core.food : 0);
    res.boss = { paws: n, core: B.core.broken, ess, food };
    if (res.win) { res.essentials += ess; res.food += food; }
  };
  return B;
}

// a spot inside the house, on the ground floor, that sees weak point q straight through opening b (on the line from q through the opening's middle), or null
export function standFor(s, b, q, back = 1.4) {
  const dx = b.x - q.x, dz = b.z - q.z, d = Math.hypot(dx, dz) || 1, x = b.x + dx / d * back, z = b.z + dz / d * back, lim = s.H - 0.4;
  if (Math.abs(x) > lim || Math.abs(z) > lim || (dx * b.nx + dz * b.nz) <= 0) return null;
  return s.openAt(x, z, q.x, q.z, 0) ? { x, z } : null;
}

// BOTS: the boss part of a bot's night. When no Gloom is in cannon range and a weak point is open, walk to a ground-floor opening that sees it and shoot it.
// k: the bot's skill (k.hit = hit chance); move(x, z): walk toward; returns true if the bot spent this step on the boss
export function botBoss(s, k, cfg, move) {
  const B = s.boss; if (!B || B.dead) return false;
  // a player keeps out of the red ring: the slam paw is shot once it is stuck, never while it is coming down
  const pts = B.points().filter((q) => !(q.id === 'slam' && B.act && B.act.step === 'tele')); if (!pts.length) return false;
  const p = s.player, eye = cfg.cannon.eye;
  // a player does not spend the Sun the night's devices need: weak points only while the battery holds more than the bot's reserve and a margin (k.bossReserve)
  if (p.energy < (k.bossReserve !== undefined ? k.bossReserve : k.reserve + 2)) return false;
  let best = null;
  for (const q of pts) {
    if (p.floor === 0 && s.openAt(p.x, p.z, q.x, q.z, 0) && Math.hypot(q.x - p.x, q.z - p.z) <= cfg.boss.weak.range) { best = { q, stand: null }; break; }
    for (const b of s.breaches) { if (b.floor !== 0) continue; const st = standFor(s, b, q); if (!st) continue; const sx = st.x, sz = st.z; const d = Math.hypot(sx - p.x, sz - p.z); if (!best || (best.stand && d < best.d)) best = { q, stand: { x: sx, z: sz }, d }; }
  }
  if (!best) return false;
  if (best.stand && (p.floor !== 0 || Math.hypot(best.stand.x - p.x, best.stand.z - p.z) > 0.5)) { move(best.stand.x, best.stand.z); return true; }
  const q = best.q, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(q.y - eye, d);
  s.fireCannon('boss', k.hit);
  return true;
}
