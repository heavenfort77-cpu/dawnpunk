// Headless night simulation. No rendering. Used by the game and by the balance bots.
// Multi-floor: bigger houses get more floors (config levelAt). Stairs: players AND Gloom. Ladder: PLAYER ONLY.
import { CONFIG as DEFAULT } from './config.js';
import { createBoss } from './boss.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function levelsFor(cfg, n) { let L = 1; for (const t of cfg.levelAt) if (n >= t) L++; return L; }

export function breachTypes(n) {
  const arr = new Array(n).fill('window');
  const put = (type, idx) => { let i = idx % n; while (arr[i] !== 'window') i = (i + 1) % n; arr[i] = type; };
  put('door', 0);
  if (n >= 6) put('door', Math.floor(n / 2));
  if (n >= 10) put('gap', Math.floor(n / 4));
  if (n >= 12) put('hatch', Math.floor((3 * n) / 4));
  return arr;
}

export function breachCount(cfg, ring, house) { return cfg.ring.bpBase[house] + cfg.ring.bpPerRing * ring; }

// doors and wall gap on the ground floor, roof hatch on the top floor, windows spread over all floors
export function makeBreaches(cfg, n, H, L) {
  const types = breachTypes(n), floors = new Array(n).fill(0), wins = [];
  types.forEach((t, i) => { if (t === 'hatch') floors[i] = L - 1; else if (t === 'window') wins.push(i); });
  wins.forEach((i, k) => { floors[i] = k % L; });
  const per = 8 * H, out = new Array(n);
  for (let f = 0; f < L; f++) {
    const list = []; for (let i = 0; i < n; i++) if (floors[i] === f) list.push(i);
    list.forEach((i, j) => {
      const s = ((j + 0.5) * per) / list.length, side = Math.floor(s / (2 * H)), u = s - side * 2 * H - H;
      let x, z, nx, nz;
      const at = (uu) => (side === 0 ? { x: uu, z: H, nx: 0, nz: -1 } : side === 1 ? { x: H, z: -uu, nx: -1, nz: 0 } : side === 2 ? { x: -uu, z: -H, nx: 0, nz: 1 } : { x: -H, z: uu, nx: 1, nz: 0 });
      // keep the opening off the house corners and 2 m clear of the stair and ladder markers
      const segs = []; for (let q = 0; q < L - 1; q++) { segs.push([-H * 0.55, -H + 1.4 + 2.4 * q, -H * 0.55 + 3.8, -H + 1.4 + 2.4 * q]); segs.push([H * 0.6, H - 1.2 - 1.6 * q, H * 0.6, H - 1.2 - 1.6 * q]); }
      const dseg = (px, pz, a) => { const dx = a[2] - a[0], dz = a[3] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2)); return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz); };
      const lim = H - 1.3; let pick = at(Math.max(-lim, Math.min(lim, u)));
      for (let k = 0; k <= 24; k++) { const d = Math.ceil(k / 2) * 0.5 * (k % 2 ? 1 : -1); const uu = Math.max(-lim, Math.min(lim, u + d)), c = at(uu); if (segs.every((a) => dseg(c.x + c.nx * 0.9, c.z + c.nz * 0.9, a) >= 2.0)) { pick = c; break; } }
      ({ x, z, nx, nz } = pick);
      out[i] = { i, type: types[i], floor: f, x, z, nx, nz, inX: x + nx * 0.9, inZ: z + nz * 0.9, outX: x - nx * 1.3, outZ: z - nz * 1.3, panel: null };
    });
  }
  return out;
}

// which CONFIG.cannon.shapes set the aimed shot uses (owner Nov 18 12:11: "desktop must be perfect; phone model allows more leeway on hit"): 'low' (phones, bots, tests) or 'high' (desktop);
// src/main.js sets it once from the graphics tier; opts.shotTier overrides it for one sim
let SHOT_TIER = 'low';
export function setShotTier(t) { SHOT_TIER = t === 'high' ? 'high' : 'low'; }
export function createSim(opts = {}) {
  const cfg = opts.cfg || DEFAULT;
  const ring = opts.ring || 0, house = opts.house || 0;
  const rng = mulberry32(opts.seed || 1);
  const n = breachCount(cfg, ring, house);
  const L = levelsFor(cfg, n);
  const H = cfg.room.base + (cfg.room.perBP * n) / L;
  const strength = Math.pow(cfg.ring.gloomStrength, ring);
  const breaches = makeBreaches(cfg, n, H, L);
  // stairs (player + Gloom) near the south wall, ladder (player only) near the north wall; one pair per floor gap
  const stairs = [], ladders = [];
  for (let f = 0; f < L - 1; f++) {
    // each floor gap gets its own spot so a floor's stair/ladder foot never stands over the hole cut for the gap below
    stairs.push({ f, bx: -H * 0.55, bz: -H + 1.4 + 2.4 * f, tx: -H * 0.55 + 3.8, tz: -H + 1.4 + 2.4 * f, panelB: null, panelT: null });
    ladders.push({ f, x: H * 0.6, z: H - 1.2 - 1.6 * f });
  }
  const total = Math.max(1, Math.round(cfg.gloom.gloomPerBP * n * ((cfg.ring.countMult && cfg.ring.countMult[ring]) || 1) * (opts.gloomMult || 1) * (L >= 3 ? (cfg.gloom.tallMult || 1) : 1)));
  const spawns = [];
  { const W = cfg.gloom.waves, wts = [], g = cfg.gloom; let sum = 0;
    for (let k = 0; k < W; k++) { wts.push(1 + (k / Math.max(1, W - 1)) * g.waveGrowth); sum += wts[k]; }
    let made = 0;
    for (let k = 0; k < W; k++) {
      const cnt = k === W - 1 ? total - made : Math.round((total * wts[k]) / sum), t0 = g.spawnStart + (k * (g.spawnEnd - g.spawnStart) * (g.fullWaveAt && L === 1 ? Math.max(g.waveMinFrac, Math.min(1, total / g.fullWaveAt)) : 1)) / Math.max(1, W - 1);
      for (let i = 0; i < cnt; i++) spawns.push({ t: t0 + rng() * g.waveSpread, bp: Math.floor(rng() * n), hpv: 1 + (rng() * 2 - 1) * g.hpVariance });
      made += cnt;
    }
    spawns.sort((a, b) => a.t - b.t); }
  // loot: night-only mode hands it over at the start; day mode hides it in crates you have to pick up
  const day = !!opts.day, lootTotal = cfg.loot.perBP * n * cfg.ring.mult[ring] * (opts.lootMul || 1);
  const foodTotal = Math.round(lootTotal * cfg.loot.foodShare), essTotal = Math.round(lootTotal * (1 - cfg.loot.foodShare));
  const packFood = day && !opts.noPack ? Math.min(cfg.day.packFood, foodTotal) : 0, crates = [];
  if (day) {
    const dr = mulberry32(((opts.seed || 1) + 7919) >>> 0); // own stream: the Gloom schedule stays the same with or without the day
    const nC = Math.max(3, Math.round(n * cfg.day.cratesPerBP)), nf = Math.min(foodTotal - packFood, Math.max(1, Math.ceil(nC * 0.6))), ne = Math.min(essTotal, Math.max(1, nC - nf)); // never an empty crate
    const catX = -(H - cfg.cat.inset), catZ = H - cfg.cat.inset;
    const share = (tot, k, i) => Math.floor(tot / k) + (i < tot % k ? 1 : 0);
    for (let i = 0; i < nf + ne; i++) {
      const food = i < nf, v = food ? share(foodTotal - packFood, nf, i) : share(essTotal, ne, i - nf);
      let x = 0, z = 0, f = 0;
      for (let tr = 0; tr < 30; tr++) {
        x = (dr() * 2 - 1) * (H - 1); z = (dr() * 2 - 1) * (H - 1); f = Math.floor(dr() * L);
        const nearMark = stairs.some((q) => (q.f === f && Math.hypot(x - q.bx, z - q.bz) < 1.8) || (q.f + 1 === f && Math.hypot(x - q.tx, z - q.tz) < 1.8)) || ladders.some((q) => (q.f === f || q.f + 1 === f) && Math.hypot(x - q.x, z - q.z) < 1.8);
        const dr0 = breaches.find((b) => b.floor === 0 && b.type === 'door') || breaches.find((b) => b.floor === 0), atDoor = f === 0 && dr0 && Math.hypot(x - (dr0.inX + dr0.nx * 1.4), z - (dr0.inZ + dr0.nz * 1.4)) < 1.8;
        const overHole = stairs.some((q) => q.f + 1 === f && x > q.bx - 0.6 && x < q.tx + 0.6 && Math.abs(z - q.bz) < 1.3), nearCat = f === 0 && Math.hypot(x - catX, z - catZ) < 2.6;
        if (!nearMark && !overHole && !nearCat && !atDoor && Math.hypot(x, z) > 1.5 && !crates.some((c) => c.floor === f && Math.hypot(c.x - x, c.z - z) < 1.5)) break;
      }
      crates.push({ id: i, kind: food ? 'food' : 'ess', v, x, z, floor: f, got: false });
    }
  }
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const s = {
    cfg, ring, house, n, H, L, strength, breaches, stairs, ladders, t: 0, done: false, win: false, nextId: 1, rng,
    player: { x: 0, z: 0, floor: 0, yaw: 0, hp: cfg.player.hp, energy: (day ? cfg.day.startEnergy : cfg.player.startEnergy) + (opts.extraEnergy || 0), cd: 0, eatCd: 0, stairCd: 0, ladderCd: 0, climb: null },
    food: day ? packFood : foodTotal, ess: 0, crates, phase: day ? 'day' : 'night', dayT: day ? cfg.day.duration : 0, eaten: 0, energySum: 0, steps: 0,
    gloom: [], devices: [], spawns, spawned: 0, killed: 0, total,
    cat: { x: -(H - cfg.cat.inset), z: H - cfg.cat.inset, found: !!opts.noCat }, coins: 0, zeroEnergyTime: 0, log: [],
    result: null,
  };
  // upright furniture (only in the run's houses: opts.furniture). Circles the player and the Gloom walk around; placed clear of openings, stairs, ladders, crates and the cat.
  s.furn = [];
  if (opts.furniture) {
    const fr = mulberry32((opts.seed || 1) ^ 0x5eedf00d), KIND = [['wardrobe', 0.62], ['table', 0.8], ['armchair', 0.62], ['stove', 0.55], ['dresser', 0.66], ['bookcase', 0.56], ['desk', 0.74], ['bed', 1.12]];
    for (let f = 0; f < L; f++) for (let k = 0, placed = 0; k < 40 && placed < cfg.furniture.perFloor; k++) {
      const [kind, r] = KIND[Math.floor(fr() * KIND.length)], x = (fr() * 2 - 1) * (H - 0.6 - r), z = (fr() * 2 - 1) * (H - 0.6 - r), wallHug = kind !== 'table' && kind !== 'armchair';
      const px = wallHug ? (Math.abs(x) > Math.abs(z) ? Math.sign(x) * (H - 0.25 - r) : x) : x, pz = wallHug ? (Math.abs(x) > Math.abs(z) ? z : Math.sign(z || 1) * (H - 0.25 - r)) : z, q = { x: px, z: pz };
      if (breaches.some((b) => b.floor === f && (Math.hypot(b.inX - px, b.inZ - pz) < r + 1.4 || Math.hypot(b.inX + b.nx * 1.4 - px, b.inZ + b.nz * 1.4 - pz) < r + 0.9 || Math.hypot(b.x - px, b.z - pz) < r + 1.2))) continue;
      if (stairs.some((st) => (st.f === f || st.f === f - 1) && Math.abs(pz - st.bz) < 1.5 + r && px > Math.min(st.bx, st.tx) - 1.4 - r && px < Math.max(st.bx, st.tx) + 1.4 + r)) continue;
      if (ladders.some((ld) => (ld.f === f || ld.f === f - 1) && Math.hypot(ld.x - px, ld.z - pz) < 1.5 + r)) continue;
      if (f === 0 && (Math.hypot(s.cat.x - px, s.cat.z - pz) < 2.6 + r || Math.hypot(px, pz) < 1.2 + r)) continue;
      if (crates.some((c) => c.floor === f && dist2(c, q) < 0.9 + r) || s.furn.some((o) => o.floor === f && dist2(o, q) < o.r + r + 1.1)) continue;
      s.furn.push({ kind, x: px, z: pz, r, floor: f, rot: wallHug ? (Math.abs(px) > Math.abs(pz) ? (px > 0 ? -Math.PI / 2 : Math.PI / 2) : (pz > 0 ? Math.PI : 0)) : fr() * 6.28 }); placed++;
    }
  }
  // push a walker out of the furniture on its floor; `slide` nudges it sideways so it goes round instead of stopping dead
  const furnPush = (o, floor, pad, slide) => { for (const q of s.furn) { if (q.floor !== floor) continue; const dx = o.x - q.x, dz = o.z - q.z, d = Math.hypot(dx, dz), m = q.r + pad; if (d < m) { const k = d > 1e-5 ? 1 / d : 0, ux = k ? dx * k : 1, uz = k ? dz * k : 0; o.x = q.x + ux * m - uz * (slide || 0); o.z = q.z + uz * m + ux * (slide || 0); } } };
  const HB = H - 0.3;
  const clamp = (v) => Math.max(-HB, Math.min(HB, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const addEnergy = (v) => { s.player.energy = Math.max(0, Math.min(cfg.player.energyCap, s.player.energy + v)); };

  // a Gloom bashing a panel or climbing in belongs to the floor of its breach point
  const gf = (g) => { if (g._fl !== undefined) return g._fl; if (g.phase === 'block' || g.phase === 'cross') return breaches[g.bp].floor; if (g.phase === 'approach') { const b = breaches[g.bp]; return Math.hypot(g.x - b.outX, g.z - b.outZ) <= 2 ? b.floor : g.floor; } return g.floor; };
  // a Gloom on the stairs can be hit from the floor it leaves and the floor it is climbing to
  const floorsOf = (g) => (g.climb ? [g.floor, g.climb.to] : [gf(g)]);
  const seen = (g, f) => gf(g) === f || (!!g.climb && g.climb.to === f);
  s.canSee = (g) => seen(g, s.player.floor) && openOK(s.player.x, s.player.z, g);
  // the height (m, world) a Gloom is drawn at: its floor; its breach point's floor while it bashes a panel or nears an upper opening; rising through the opening (a window lifts it 0.5 m on the way);
  // up or down the stairs. src/main.js draws it at this height and the aimed shot (hitBox) aims at it
  s.gloomY = (g) => { const FH = cfg.floorH, b = breaches[g.bp]; let y = g.floor * FH;
    if (b && g.phase === 'block') y = b.floor * FH;
    else if (b && g.phase === 'approach') y = (g.floor + (b.floor - g.floor) * Math.max(0, Math.min(1, 1 - (Math.hypot(g.x - b.outX, g.z - b.outZ) - 2) / 2))) * FH;
    if (b && g.phase === 'cross' && g.dl > 0) { const pg = g.prog || 0; y = (g.floor + (b.floor - g.floor) * pg) * FH + (b.type === 'window' ? 0.5 * Math.sin(Math.PI * pg) : 0); }
    if (g.climb) y = (g.floor + (g.climb.to - g.floor) * (1 - g.climb.t / g.climb.dur)) * FH;
    return y; };
  // no shooting through walls: a Gloom outside can only be hit through a breach opening on its floor
  function openOK(ax, az, g) {
    if (g.phase === 'inside' || g.phase === 'cross') return true;
    const dx = g.x - ax, dz = g.z - az; let t = 1e9;
    for (const w of [H, -H]) {
      if (Math.abs(dx) > 1e-9) { const tt = (w - ax) / dx; if (tt > 0 && tt < 1 && Math.abs(az + dz * tt) <= H + 1e-6 && tt < t) t = tt; }
      if (Math.abs(dz) > 1e-9) { const tt = (w - az) / dz; if (tt > 0 && tt < 1 && Math.abs(ax + dx * tt) <= H + 1e-6 && tt < t) t = tt; }
    }
    if (t > 1) return true; // no wall crossed (should not happen)
    const cx = ax + dx * t, cz = az + dz * t, fl = gf(g);
    return breaches.some((b) => b.floor === fl && Math.hypot(b.x - cx, b.z - cz) <= cfg.openingHalf);
  }
  function killGloom(g0) {
    const queue = [g0];
    while (queue.length) {
      const g = queue.pop();
      const i = s.gloom.indexOf(g); if (i < 0) continue;
      s.gloom.splice(i, 1); s.killed++;
      s.log.push({ e: 'pop', x: g.x, z: g.z, floor: g.floor });
      for (const o of s.gloom.slice()) {
        if (floorsOf(o).some((f) => floorsOf(g).includes(f)) && Math.hypot(o.x - g.x, o.z - g.z) <= cfg.gloom.explodeRadius) { o.hp -= cfg.gloom.explodeDmg; if (o.hp <= 0) queue.push(o); }
      }
    }
  }
  const boostAt = (o) => (s.devices.some((q) => q.kind === 'prism' && q.floor === o.floor && Math.hypot(q.x - o.x, q.z - o.z) <= cfg.devices.prism.radius) ? cfg.devices.prism.boost : 1);
  function burst(x, z, floor, r, dmg) { s.log.push({ e: 'boom', x, z, floor, r }); for (const g of s.gloom.slice()) if (s.gloom.includes(g) && floorsOf(g).includes(floor) && Math.hypot(g.x - x, g.z - z) <= r) damageGloom(g, dmg); }
  function damageGloom(g, d) { g.hp -= d; if (g.hp <= 0) killGloom(g); }

  // by day a heavy pack slows you down (settlement runs only)
  s.speedMult = () => (s.phase === 'day' && opts.loadTotal ? Math.max(cfg.day.carryMin, 1 - cfg.day.carrySlow * Math.min(1, Math.max(0, s.food + s.ess - cfg.day.packFood) / opts.loadTotal)) : 1);
  s.move = (dx, dz, dt) => {
    if (s.player.climb) return;
    const l = Math.hypot(dx, dz); if (l < 1e-6) return;
    const k = Math.min(1, l) / l * cfg.player.speed * s.speedMult() * dt;
    s.player.x = clamp(s.player.x + dx * k); s.player.z = clamp(s.player.z + dz * k);
    if (s.furn.length) { const p = s.player; furnPush(p, p.floor, 0.3); p.x = clamp(p.x); p.z = clamp(p.z);
      for (const q of s.furn) { if (q.floor !== p.floor) continue; const m = q.r + 0.3, ddx = p.x - q.x, ddz = p.z - q.z; if (Math.hypot(ddx, ddz) >= m - 1e-4) continue; // pinned between a piece and the wall: slide along the wall instead
        if (Math.abs(Math.abs(p.x) - HB) < 1e-6) p.z = clamp(q.z + Math.sign(ddz || 1) * Math.sqrt(Math.max(0, m * m - ddx * ddx))); else p.x = clamp(q.x + Math.sign(ddx || 1) * Math.sqrt(Math.max(0, m * m - ddz * ddz))); } }
  };
  s.eat = () => {
    const p = s.player;
    if (s.done || p.climb || s.food <= 0 || p.hp >= cfg.player.hp || p.eatCd > 0) return false;
    s.food--; s.eaten++; p.hp = Math.min(cfg.player.hp, p.hp + cfg.food.heal); p.eatCd = cfg.food.eatCd; s.log.push({ e: 'eat' });
    return true;
  };
  s.fireCannon = (mode = 'ray', hit = 1, charged = false, live = null) => { // charged: a held shot. It costs and hurts charge.cost / charge.dmg times as much and goes through every Gloom on its line
    const p = s.player, c = cfg.cannon, CH = charged ? c.charge : null, cost = c.cost * (CH ? CH.cost : 1), line = [];
    if (s.done || s.phase === 'day' || p.climb || (!CH && p.cd > 0) || p.energy < cost) return false;
    p.cd = 1 / c.rate; addEnergy(-cost);
    let target = null, best = 1e9, head = false, covered = false;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), tn = Math.tan(p.pitch || 0);
    // the aimed shot against a Gloom's drawn size (owner Nov 18): S = c.shapes[kind], an upright oval tube for its body and one for its head, in the machine's own frame, turned with it
    // (face + PI, as src/main.js turns its model) and standing at the height it is drawn at (s.gloomY). Ovals, not boxes: heads and some torsos turn to face you, so their parts sweep round.
    // tube(): where the aim (start o, direction dv per m flat) enters the tube with centre (cx, cz), radii (rx, rz), from height y0 to y1, or null
    const tube = (o, dv, cx, cz, rx, rz, y0, y1) => { let t0 = 0, t1 = c.range;
      const px = (o[0] - cx) / rx, pz = (o[2] - cz) / rz, qx = dv[0] / rx, qz = dv[2] / rz, a = qx * qx + qz * qz, b = px * qx + pz * qz, cc = px * px + pz * pz - 1;
      if (a < 1e-12) { if (cc > 0) return null; } else { const disc = b * b - a * cc; if (disc < 0) return null; const r = Math.sqrt(disc); t0 = Math.max(t0, (-b - r) / a); t1 = Math.min(t1, (-b + r) / a); }
      if (Math.abs(dv[1]) < 1e-9) { if (o[1] < y0 || o[1] > y1) return null; } else { let u = (y0 - o[1]) / dv[1], w = (y1 - o[1]) / dv[1]; if (u > w) { const q = u; u = w; w = q; } t0 = Math.max(t0, u); t1 = Math.min(t1, w); }
      return t0 <= t1 ? t0 : null; };
    // hitBox(): the entry distance into the body (t, m flat) and whether the shot also passes through the head (a head shot), or null for a miss; pad widens the body (a charged shot)
    // a live shape (desktop, src/main.js drawnShape): the shot against each drawn part's own box (in the part's frame), above the floor the machine stands on; { t, head } or null
    // (t: where it meets the first part; head: that first part is a head part)
    const hitParts = (Lv) => { const e0 = [p.x, c.eye + p.floor * cfg.floorH, p.z], dw = [fx, tn, fz]; let best = null, head = false;
      let f0 = 0, f1 = c.range; if (Math.abs(tn) < 1e-9) { if (e0[1] < Lv.floor) return null; } else { const tf = (Lv.floor - e0[1]) / tn; if (tn < 0) f1 = Math.min(f1, tf); else f0 = Math.max(f0, tf); } if (f0 > f1) return null;
      for (const P of Lv.parts) { const m = P.inv, o = [0, 1, 2].map((k) => m[k] * e0[0] + m[4 + k] * e0[1] + m[8 + k] * e0[2] + m[12 + k]), dv = [0, 1, 2].map((k) => m[k] * dw[0] + m[4 + k] * dw[1] + m[8 + k] * dw[2]);
        const t = slabT(o, dv, [P.box[0], P.box[1], P.box[2]], [P.box[3], P.box[4], P.box[5]], f0, f1); if (t === null) continue; if (best === null || t < best) { best = t; head = P.head; } }
      return best === null ? null : { t: best, head }; };
    const slabT = (o, dv, lo, hi, t0, t1) => { for (let k = 0; k < 3; k++) { if (Math.abs(dv[k]) < 1e-12) { if (o[k] < lo[k] || o[k] > hi[k]) return null; continue; } let a = (lo[k] - o[k]) / dv[k], b = (hi[k] - o[k]) / dv[k]; if (a > b) { const q = a; a = b; b = q; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return null; } return t0; };
    const hitBox = (g, S, pad) => { if (S.parts) return hitParts(S); const th = g.face + Math.PI, co = Math.cos(th), si = Math.sin(th), wx = p.x - g.x, wz = p.z - g.z, q = c.shapePad || 0, e = q + pad;
      const o = [wx * co - wz * si, c.eye + p.floor * cfg.floorH - s.gloomY(g), wx * si + wz * co], dv = [fx * co - fz * si, tn, fx * si + fz * co];
      const t = tube(o, dv, S[0], S[1], S[2] + e, S[3] + e, 0, S[4] + q); if (t === null) return null;
      return { t, head: tube(o, dv, S[5], S[6], S[7] + q, S[8] + q, S[9] - q, S[10] + q) !== null }; };
    // the boss's open weak points (src/boss.js): the player's aimed shot ('ray'), or a bot aiming at one ('boss', hit = its hit chance)
    const bh = s.boss && (mode === 'ray' || mode === 'boss') ? (() => { const cp = Math.cos(p.pitch || 0), sp = Math.sin(p.pitch || 0); const r = s.boss.ray(p.x, c.eye + p.floor * cfg.floorH, p.z, fx * cp, sp, fz * cp, p.floor); return r ? { id: r.id, along: r.along * cp } : null; })() : null;
    const bossHit = () => { s.boss.hit(bh.id, CH ? cfg.boss.weak.charged : 1); s.log.push({ e: 'shot', yaw: p.yaw, hit: true, boss: bh.id, charged: !!CH }); return true; };
    if (mode === 'boss') { if (bh && s.rng() < hit) return bossHit(); s.log.push({ e: 'shot', yaw: p.yaw, hit: false }); return true; }
    // a panel between the shooter and the target covers the body: only a shot that clears the panel top (onto the head) gets through
    const panelCross = (tx, tz) => { // returns distance fraction list of panels crossing the segment p -> (tx,tz)
      const out = [];
      for (const dv of s.devices) {
        if (!cfg.devices[dv.kind].wall || dv.floor !== p.floor) continue;
        const ax = p.x, az = p.z, bx = tx - p.x, bz = tz - p.z, cx = dv.x - dv.tx, cz = dv.z - dv.tz, ex = 2 * dv.tx, ez = 2 * dv.tz;
        const den = bx * ez - bz * ex; if (Math.abs(den) < 1e-9) continue;
        const u = ((cx - ax) * ez - (cz - az) * ex) / den, v = ((cx - ax) * bz - (cz - az) * bx) / den;
        if (u > 0.001 && u < 0.999 && v >= 0 && v <= 1) out.push({ u, tall: !!cfg.devices[dv.kind].tall });
      }
      return out;
    };
    for (const g of s.gloom) {
      if (!seen(g, p.floor)) continue;
      const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz);
      if (d > c.range || !openOK(p.x, p.z, g)) continue;
      if (mode === 'auto') { if (d < best) { best = d; target = g; covered = panelCross(g.x, g.z).length > 0; } }
      else {
        // the shape it is drawn with: live[id] (desktop: its model's parts as drawn this frame, src/main.js liveShapes; not for the wider charged shot), else its kind's shape for this graphics tier (c.shapes.low / .high);
        // a Gloom without a kind keeps the old cylinder (rayWidth round, gloomH tall, head shots above headZone)
        const tier = opts.shotTier || SHOT_TIER, TS = c.shapes && c.shapes[tier] && c.shapes[tier][g.kind], Lv = !CH && live && live[g.id], S = Lv || TS; let along, hd;
        if (S) { let r;
          // desktop: the drawn parts decide alone; phones (leeway): the kind's lenient oval or the drawn parts give the hit, the drawn parts alone decide a head shot
          if (Lv && Lv.parts) { const pr = hitParts(Lv); if (tier === 'high' || !TS) r = pr; else { const ro = hitBox(g, TS, 0); r = ro || pr ? { t: Math.min(ro ? ro.t : 1e9, pr ? pr.t : 1e9), head: !!(pr && pr.head) } : null; } }
          else r = hitBox(g, S, CH ? (CH.width - 1) * c.rayWidth : 0);
          if (!r || (!CH && r.t >= best)) continue; along = r.t; hd = r.head; }
        else {
          along = dx * fx + dz * fz; if (along < 0) continue;
          const perp = Math.abs(dx * fz - dz * fx); if (perp >= c.rayWidth * (CH ? CH.width : 1) || (!CH && along >= best)) continue;
          const yg = c.eye + tn * along; if (yg < 0 || yg > c.gloomH + 0.1) continue;       // shot flies over or into the ground
          hd = yg >= c.headZone;
        }
        const blocked = panelCross(g.x, g.z).some((o) => o.tall || c.eye + tn * (o.u * d) < c.panelH); // ray still below the panel top at the panel
        if (blocked) continue;
        if (CH) { line.push([g, hd]); target = g; continue; }
        best = along; target = g; head = hd;
      }
    }
    if (mode === 'auto' && target && covered) head = true; // a covered hit by a bot counts as the head shot it needed
    if (CH && mode === 'auto' && target) { // a bot's charged shot: aimed at the nearest one, it also goes through whatever stands on that line
      const tl = Math.hypot(target.x - p.x, target.z - p.z) || 1, ax = (target.x - p.x) / tl, az = (target.z - p.z) / tl;
      for (const g of s.gloom) { if (!seen(g, p.floor)) continue; const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz); if (d > c.range || !openOK(p.x, p.z, g)) continue; if (dx * ax + dz * az < 0 || Math.abs(dx * az - dz * ax) >= c.rayWidth * CH.width) continue; const cov = panelCross(g.x, g.z).length > 0; if (s.rng() < (cov ? hit * c.coverHit : hit)) line.push([g, cov]); } }
    if (CH) { if (bh) s.boss.hit(bh.id, cfg.boss.weak.charged); s.log.push({ e: 'shot', yaw: p.yaw, hit: line.length > 0 || !!bh, head: line.some((q) => q[1]), charged: true, n: line.length, boss: bh ? bh.id : undefined }); for (const [g, hd] of line) damageGloom(g, c.dmg * CH.dmg * (hd ? c.headMult : 1) * boostAt(p)); return true; }
    if (bh && (!target || bh.along < best)) return bossHit(); // the weak point is nearer on the line than any Gloom
    s.log.push({ e: 'shot', yaw: p.yaw, hit: !!target, head: !!(target && head) });
    if (target) {
      const chance = mode === 'ray' ? 1 : (covered ? hit * c.coverHit : hit);
      if (s.rng() < chance) damageGloom(target, c.dmg * (head ? c.headMult : 1) * boostAt(p));
    }
    return true;
  };
  s.place = (kind, o = {}) => {
    const d = cfg.devices[kind], p = s.player;
    if (s.done) return { ok: false, reason: 'over' };
    if (p.climb) return { ok: false, reason: 'climbing' };
    if (d.max && s.devices.filter((q) => q.kind === kind).length >= d.max) return { ok: false, reason: 'cap' };
    if (d.group && s.devices.filter((q) => cfg.devices[q.kind].group === d.group).length >= cfg.groupMax[d.group]) return { ok: false, reason: 'group' };
    if (p.energy < d.cost) return { ok: false, reason: 'energy' };
    if (kind === 'collector') {
      if (s.phase !== 'day') return { ok: false, reason: 'night' };
      const x = clamp(o.x !== undefined ? o.x : p.x - Math.sin(p.yaw) * 1.5), z = clamp(o.z !== undefined ? o.z : p.z - Math.cos(p.yaw) * 1.5);
      if (!breaches.some((b) => b.floor === p.floor && Math.hypot(b.inX - x, b.inZ - z) <= cfg.day.sunReach)) return { ok: false, reason: 'sun' };
      if (s.devices.some((q) => q.floor === p.floor && Math.hypot(q.x - x, q.z - z) < cfg.day.collectorGap)) return { ok: false, reason: 'close' };
      const dev = { id: s.nextId++, kind, x, z, floor: p.floor, hp: d.hp, cd: 0 }; s.devices.push(dev); return { ok: true, dev };
    }
    if (s.phase === 'day') return { ok: false, reason: 'day' }; // night devices wait for the night
    if (d.instant) { addEnergy(-d.cost); burst(p.x - Math.sin(p.yaw) * d.reach, p.z - Math.cos(p.yaw) * d.reach, p.floor, d.radius, d.dmg); return { ok: true }; }
    if (d.wall) {
      const tx = o.x !== undefined ? o.x : p.x - Math.sin(p.yaw) * 3, tz = o.z !== undefined ? o.z : p.z - Math.cos(p.yaw) * 3;
      let bp = null, bd = 1e9;
      let slot = null; // a stair end on this floor
      if (o.bp !== undefined) bp = breaches[o.bp];
      else {
        for (const b of breaches) { if (b.floor !== p.floor || (b.panel && b.panel.hp > 0)) continue; const dd = Math.hypot(b.x - tx, b.z - tz); if (dd < bd && Math.hypot(b.x - p.x, b.z - p.z) <= cfg.panelReach) { bd = dd; bp = b; } }
        for (const st of stairs) for (const end of ['B', 'T']) {
          const fl = end === 'B' ? st.f : st.f + 1; if (fl !== p.floor || (st['panel' + end] && st['panel' + end].hp > 0)) continue;
          const sx = end === 'B' ? st.bx : st.tx, sz = end === 'B' ? st.bz : st.tz, dd = Math.hypot(sx - tx, sz - tz);
          if (dd < bd && Math.hypot(sx - p.x, sz - p.z) <= cfg.panelReach) { bd = dd; bp = null; slot = { st, end, x: sx, z: sz }; }
        }
      }
      if (slot) { addEnergy(-d.cost); const dev = { id: s.nextId++, kind, x: slot.x, z: slot.z, floor: p.floor, hp: d.hp, cd: 0, stair: slot.end, tx: 0, tz: 0.45 }; slot.st['panel' + slot.end] = dev; s.devices.push(dev); return { ok: true, dev }; }
      if (!bp) return { ok: false, reason: 'no breach or stairs in reach' };
      if (bp.panel && bp.panel.hp > 0) return { ok: false, reason: 'occupied' };
      addEnergy(-d.cost);
      const dev = { id: s.nextId++, kind, x: bp.inX, z: bp.inZ, floor: bp.floor, hp: d.hp, cd: 0, bp: bp.i, tx: -bp.nz * 0.45, tz: bp.nx * 0.45 };
      bp.panel = dev; s.devices.push(dev); return { ok: true, dev };
    }
    const x = clamp(o.x !== undefined ? o.x : p.x - Math.sin(p.yaw) * 2.5), z = clamp(o.z !== undefined ? o.z : p.z - Math.cos(p.yaw) * 2.5);
    addEnergy(-d.cost);
    const dev = { id: s.nextId++, kind, x, z, floor: p.floor, hp: d.hp, cd: 0 };
    s.devices.push(dev); return { ok: true, dev };
  };

  // the seven machines (cfg.gloom.kinds): each Gloom is one kind, picked from its id and the seed by the kinds' shares (no extra random draws, so the wave schedule is unchanged)
  const KINDS = cfg.gloom.kinds || { walker: { share: 1, hp: 1, speed: 1, dmg: 1, wall: 1, reach: 1 } }, KN = Object.keys(KINDS), ONE = KINDS.walker || KINDS[KN[0]], HURRY = (KINDS.lantern && KINDS.lantern.hurry) || 1;
  const KD = (g) => KINDS[g.kind] || ONE, kindSeen = {};
  const kindOf = (id) => { const ok = KN.filter((k) => (KINDS[k].minRing || 0) <= ring), tot = ok.reduce((a, k) => a + KINDS[k].share, 0); let r = ((((id + 1) * 2654435761) ^ ((opts.seed || 1) * 40503)) >>> 0) % 10000 / 10000 * tot; for (const k of ok) { r -= KINDS[k].share; if (r < 0) return k; } return ok[0]; };
  function moveToward(g, tx, tz, dt) {
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz); if (d < 1e-6) return 0;
    const st = Math.min(d, cfg.gloom.speed * KD(g).speed * (g.hurry ? HURRY : 1) * (g.slowT > 0 ? cfg.devices.mist.slow : 1) * dt); g.x += (dx / d) * st; g.z += (dz / d) * st; g.face = Math.atan2(-dx, -dz);
    if (s.furn.length && Math.abs(g.x) < H && Math.abs(g.z) < H && !g.climb) furnPush(g, g.floor, 0.35, st * 0.9);
    return d - st;
  }
  function hurtDevice(dv, d) { dv.hp -= d; if (dv.hp <= 0) { s.devices.splice(s.devices.indexOf(dv), 1); if (cfg.devices[dv.kind].wall) { if (dv.stair) { for (const st of stairs) { if (st['panel' + dv.stair] === dv) st['panel' + dv.stair] = null; } } else breaches[dv.bp].panel = null; } s.log.push({ e: 'devdead', kind: dv.kind, x: dv.x, z: dv.z, floor: dv.floor, bp: dv.bp }); } else s.log.push({ e: 'devhit', kind: dv.kind, x: dv.x, z: dv.z, floor: dv.floor, id: dv.id }); }

  // stair / ladder travel for the player (walk onto the marker). Gloom use stairs only.
  const ZR = cfg.zoneRadius;
  function startClimb(to, l) { s.player.x = l.x; s.player.z = l.z; s.player.climb = { t: cfg.ladderTime, from: s.player.floor, to, ax: l.x, az: l.z - 1.7 }; s.log.push({ e: 'climb', to }); }
  function playerTravel() {
    const p = s.player;
    for (const st of stairs) {
      if (p.stairCd > 0) break;
      if (p.floor === st.f && Math.hypot(p.x - st.bx, p.z - st.bz) < ZR) { if (st.panelB && st.panelB.hp > 0) { s.log.push({ e: 'blocked' }); continue; } p.floor++; p.x = st.tx + 1.6; p.z = st.tz; p.stairCd = cfg.player.stairCd; s.log.push({ e: 'floor' }); return; }
      if (p.floor === st.f + 1 && Math.hypot(p.x - st.tx, p.z - st.tz) < ZR) { if (st.panelT && st.panelT.hp > 0) { s.log.push({ e: 'blocked' }); continue; } p.floor--; p.x = st.bx - 1.6; p.z = st.bz; p.stairCd = cfg.player.stairCd; s.log.push({ e: 'floor' }); return; }
    }
    for (const l of ladders) {
      if (p.ladderCd > 0) break;
      if (p.floor === l.f && Math.hypot(p.x - l.x, p.z - l.z) < ZR) { startClimb(p.floor + 1, l); return; }
      if (p.floor === l.f + 1 && Math.hypot(p.x - l.x, p.z - l.z) < ZR) { startClimb(p.floor - 1, l); return; }
    }
    // walking over the open stair or ladder gap in an upper floor drops you to the floor below (CONFIG.fall); the gaps are the slab holes drawn in main.js
    // you land where the stairs or the ladder would put you; standing on the stair-top or ladder marker still takes the stairs or ladder
    // opts.noFall (the bots, src/bots.js): bots walk in straight lines with no way-finding, so they would cross the gaps no player would; they keep the old floor (balance stays comparable)
    const F = opts.noFall ? null : cfg.fall;
    if (F && p.floor >= 1) {
      const st = stairs[p.floor - 1], l = ladders[p.floor - 1], e = F.edge, keep = ZR + F.keepTop;
      const inStair = !!st && p.x > st.bx - 0.6 + e && p.x < st.tx + 0.6 - e && p.z > st.bz - 1.2 + e && p.z < st.bz + 1.4 - e && Math.hypot(p.x - st.tx, p.z - st.tz) > keep;
      const inLadder = !!l && Math.abs(p.x - l.x) < 0.7 - e && Math.abs(p.z - l.z) < 0.7 - e && Math.hypot(p.x - l.x, p.z - l.z) > ZR;
      if (inStair || inLadder) {
        p.floor--;
        if (inStair) { p.x = st.bx - 1.6; p.z = st.bz; } else { p.x = l.x; p.z = l.z - 1.7; }
        p.stairCd = cfg.player.stairCd; p.ladderCd = cfg.ladderCd;
        if (F.dmg > 0) p.hp = Math.max(1, p.hp - F.dmg);
        s.log.push({ e: 'fall' }); s.log.push({ e: 'floor' });
      }
    }
  }

  s.step = (dt) => {
    if (s.done) return;
    if (s.phase === 'day') {
      const p = s.player;
      p.cd = Math.max(0, p.cd - dt); p.eatCd = Math.max(0, p.eatCd - dt); p.stairCd = Math.max(0, p.stairCd - dt);
      if (p.climb) { p.climb.t -= dt; if (p.climb.t <= 0) { p.floor = p.climb.to; p.x = p.climb.ax; p.z = p.climb.az; p.climb = null; p.ladderCd = cfg.ladderCd; s.log.push({ e: 'floor' }); } } else playerTravel();
      p.ladderCd = Math.max(0, p.ladderCd - dt);
      addEnergy((s.devices.filter((q) => q.kind === 'collector').length * cfg.devices.collector.chargePerSec + (opts.hand ? cfg.day.handCharge : 0)) * dt); // the sun fills the battery: collectors, plus the hand on a settlement run
      pickups();
      s.dayT -= dt; if (s.dayT <= 0) s.endDay();
      return;
    }
    s.t += dt;
    if (s.boss && s.boss.step(dt)) return; // the boss's dawn power-down or its collapse: the night holds still until the end screen
    const p = s.player;
    p.cd = Math.max(0, p.cd - dt); p.eatCd = Math.max(0, p.eatCd - dt); p.stairCd = Math.max(0, p.stairCd - dt); p.ladderCd = Math.max(0, p.ladderCd - dt);
    if (p.climb) { p.climb.t -= dt; if (p.climb.t <= 0) { p.floor = p.climb.to; p.x = p.climb.ax; p.z = p.climb.az; p.climb = null; p.ladderCd = cfg.ladderCd; s.log.push({ e: 'floor' }); } } else playerTravel();
    // spawn
    while (s.spawned < spawns.length && spawns[s.spawned].t <= s.t) {
      const sp = spawns[s.spawned++], b = breaches[sp.bp];
      const tx = -b.nz, tz = b.nx, j = (s.rng() - 0.5) * 3;
      const kind = kindOf(s.nextId), khp = (KINDS[kind] || ONE).hp * (cfg.gloom.kindHp || 1); if (!kindSeen[kind]) { kindSeen[kind] = true; s.log.push({ e: "kind", kind }); }
      const fr = sp.from; // summoned by the boss: they step off at its feet
      s.gloom.push({ id: s.nextId++, kind, x: fr ? fr.x : b.outX - b.nx * 9 + tx * j, z: fr ? fr.z : b.outZ - b.nz * 9 + tz * j, floor: 0, hp: cfg.gloom.hp * strength * sp.hpv * khp, maxhp: cfg.gloom.hp * strength * sp.hpv * khp, phase: 'approach', bp: sp.bp, timer: 0, cd: 0, face: 0 }); s.log.push({ e: 'alert', k: b.floor > 0 ? 'upper' : 'inbound', floor: b.floor, x: b.x, z: b.z });
    }
    // gloom
    const dmg = cfg.gloom.dmg * strength, FP = cfg.floorPenalty;
    // a Lantern hurries every other Gloom within its ring radius
    { const L = KINDS.lantern, ls = L && L.hurry ? s.gloom.filter((q) => q.kind === 'lantern') : []; for (const q of s.gloom) q.hurry = ls.some((l) => l !== q && Math.hypot(l.x - q.x, l.z - q.z) <= L.hurryR); }
    for (const g of s.gloom.slice()) {
      g.cd = Math.max(0, g.cd - dt); g.slowT = Math.max(0, (g.slowT || 0) - dt);
      const b = breaches[g.bp];
      const delay = () => (cfg.breachDelay[b.type] + cfg.breachDelay.upper * b.floor) * (b.smashed && cfg.boss ? cfg.boss.slam.openDelay : 1); // an opening smashed by the boss's slam is climbed faster
      if (g.phase === 'approach') {
        // a Lantern hangs back outside its opening while any other Gloom is still about (it only walks in when it is alone); it can be shot through the opening
        if (KD(g).hang && Math.hypot(g.x - b.outX, g.z - b.outZ) <= KD(g).hang && (s.spawned < spawns.length || s.gloom.some((q) => q !== g && !KD(q).hang))) { g.face = Math.atan2(g.x - b.outX, g.z - b.outZ); continue; }
        if (moveToward(g, b.outX, b.outZ, dt) < 0.2) { g.phase = (b.panel && b.panel.hp > 0) ? 'block' : 'cross'; g.timer = g.dl = delay(); }
      } else if (g.phase === 'block') {
        if (!b.panel || b.panel.hp <= 0) { g.phase = 'cross'; g.timer = g.dl = delay(); }
        else if (g.cd <= 0) { g.cd = cfg.gloom.cooldown; const ov = KD(g).over; // a Stilt held at a panel reaches over it for a player who stands close behind
          if (ov && p.floor === b.floor && !p.climb && Math.hypot(p.x - b.inX, p.z - b.inZ) <= ov) { p.hp -= dmg * KD(g).dmg; s.log.push({ e: 'hurt', over: true }); } else hurtDevice(b.panel, dmg * KD(g).wall); }
      } else if (g.phase === 'cross') {
        g.timer -= dt; g.prog = g.dl > 0 ? Math.max(0, Math.min(1, 1 - g.timer / g.dl)) : 1; // visible climb through the opening
        g.x = b.outX + (b.inX - b.outX) * g.prog; g.z = b.outZ + (b.inZ - b.outZ) * g.prog;
        if (g.timer <= 0) { g.x = b.inX; g.z = b.inZ; g.floor = b.floor; g.phase = 'inside'; }
      } else if (g.climb) {
        // on the stairs: walks the ramp, cannot attack, and can be shot from both floors
        // a barricade at the far end of the stairs stops the climber near the top: it has to break the panel from the stairs, where it can be shot
        const c = g.climb, far = c.st && c.st['panel' + (c.up ? 'T' : 'B')], held = far && far.hp > 0 && c.t <= 0.2 * c.dur;
        if (held) { c.t = 0.2 * c.dur; if (g.cd <= 0) { g.cd = cfg.gloom.cooldown; hurtDevice(far, dmg * KD(g).wall); } } else c.t -= dt;
        const k = 1 - Math.max(0, c.t) / c.dur;
        g.x = c.ax + (c.bx - c.ax) * k; g.z = c.az + (c.bz - c.az) * k;
        if (c.t <= 0) { g.floor = c.to; g.climb = null; }
      } else {
        let tgt = p, td = dist(g, p) + FP * Math.abs(g.floor - p.floor);
        for (const dv of s.devices) { const dc = cfg.devices[dv.kind]; if (dc.noTarget) continue; const dd = dist(g, dv) + FP * Math.abs(g.floor - dv.floor) - (dc.pull || 0); if (dd < td) { td = dd; tgt = dv; } }
        if (tgt.floor === g.floor) {
          if (dist(g, tgt) > cfg.gloom.reach * KD(g).reach) moveToward(g, tgt.x, tgt.z, dt);
          else if (g.cd <= 0) { g.cd = cfg.gloom.cooldown; if (tgt === p) { p.hp -= dmg * KD(g).dmg; s.log.push({ e: 'hurt' }); } else hurtDevice(tgt, dmg * KD(g).wall); }
        } else {
          // different floor: use the stairs (never the ladder)
          const up = tgt.floor > g.floor, st = stairs.find((q) => q.f === (up ? g.floor : g.floor - 1));
          if (st) {
            const gx = up ? st.bx : st.tx, gz = up ? st.bz : st.tz;
            const blk = up ? st.panelB : st.panelT; // a panel at this end is bashed from here; one at the far end is met on the stairs
            if (moveToward(g, gx, gz, dt) < 0.4) { if (blk && blk.hp > 0) { if (g.cd <= 0) { g.cd = cfg.gloom.cooldown; hurtDevice(blk, dmg * KD(g).wall); } } else { const dur = Math.max(0.05, cfg.gloom.stairTime); g.climb = up ? { st, up: true, to: g.floor + 1, t: dur, dur, ax: st.bx, az: st.bz, bx: st.tx + 1.0, bz: st.tz } : { st, up: false, to: g.floor - 1, t: dur, dur, ax: st.tx, az: st.tz, bx: st.bx - 1.0, bz: st.bz }; s.log.push({ e: 'alert', k: 'stair', from: g.floor, to: g.climb.to, x: g.x, z: g.z, floor: g.floor }); } }
          }
        }
      }
    }
    // devices
    for (const dv of s.devices.slice()) {
      const d = cfg.devices[dv.kind];
      if (dv.kind === 'turbine') addEnergy(d.energyPerSec * dt); // keeps producing at zero energy so the bank can recover
      else if (dv.kind === 'moon') addEnergy(d.energyPerSec * dt);
      else if (d.shooter) {
        dv.cd = Math.max(0, dv.cd - dt);
        if (dv.cd <= 0 && p.energy >= d.shotCost) {
          let tg = null, bd = d.range;
          for (const g of s.gloom) { if (!seen(g, dv.floor) || (!d.lob && !openOK(dv.x, dv.z, g))) continue; const dd = dist(g, dv); if (dd <= bd) { bd = dd; tg = g; } }
          if (tg) { dv.cd = 1 / d.rate; addEnergy(-d.shotCost); s.log.push({ e: 'lance', kind: dv.kind, x: dv.x, z: dv.z, tx: tg.x, tz: tg.z, floor: dv.floor }); if (d.slow) tg.slowT = d.slowTime; damageGloom(tg, d.dmg * (d.shots || 1) * boostAt(dv)); }
        }
      } else if (dv.kind === 'mine') {
        dv.arm = Math.max(0, (dv.arm === undefined ? d.arm : dv.arm) - dt);
        if (dv.arm <= 0 && s.gloom.some((g) => g.phase === 'inside' && !g.climb && g.floor === dv.floor && dist(g, dv) <= d.trigger)) { s.devices.splice(s.devices.indexOf(dv), 1); burst(dv.x, dv.z, dv.floor, d.radius, d.dmg); }
      } else if (dv.kind === 'shard') {
        for (const g of s.gloom.slice()) if (g.phase === 'inside' && !g.climb && g.floor === dv.floor && dist(g, dv) <= d.radius) damageGloom(g, d.dps * dt);
      } else if (dv.kind === 'press') {
        dv.cd = Math.max(0, dv.cd - dt);
        if (dv.cd <= 0) { const g = s.gloom.find((q) => q.phase === 'inside' && !q.climb && q.floor === dv.floor && dist(q, dv) <= d.reach); if (g) { dv.cd = d.reset; s.log.push({ e: 'press', x: dv.x, z: dv.z, floor: dv.floor }); killGloom(g); } }
      }
    }
    if (p.energy <= 0.0001) s.zeroEnergyTime += dt;
    s.energySum += p.energy; s.steps++;
    pickups();
    if (p.hp <= 0) { p.hp = 0; finish(false); }
    // s.holdDawn (set by the night-1 lesson in main.js) keeps the night going while the lesson holds the waves back, so killing the lesson's one machine is not dawn
    else if ((s.t >= cfg.night.duration && !s.boss) || (day && s.spawned >= spawns.length && s.gloom.length === 0 && !(s.boss && s.boss.alive()) && !(s.holdDawn && s.holdDawn()))) finish(true); // with the day phase, dawn comes as soon as the last Gloom is gone (the boss ends its own night: src/boss.js)
  };
  // walk over things: scavenge crates (day or night) and the hidden lucky cat (ground floor corner)
  function pickups() {
    const p = s.player;
    for (const c of crates) { if (c.got || c.floor !== p.floor || Math.hypot(p.x - c.x, p.z - c.z) > cfg.day.crateRadius) continue; c.got = true; if (c.kind === 'food') s.food += c.v; else s.ess += c.v; s.log.push({ e: 'crate', kind: c.kind, v: c.v }); }
    if (!s.cat.found && p.floor === 0 && Math.hypot(p.x - s.cat.x, p.z - s.cat.z) <= cfg.cat.radius) {
      s.cat.found = true; s.coins += cfg.cat.coins; addEnergy(cfg.cat.energy); s.log.push({ e: 'cat' });
    }
  }
  // machines woken by day remember you (CONFIG.dormant): k more Gloom tonight, arriving at random in the 'when' share of the spawn window; returns how many were added
  // o (the boss's summon, src/boss.js): { at: start time, gap: seconds between them, bps: breach indices to pick from, from: { x, z, r, rx, rz } their start round its feet, rng }
  s.addGloom = (k, o) => {
    k = Math.max(0, Math.round(k || 0)); if (!k || s.done) return 0;
    const g = cfg.gloom, W = (cfg.dormant && cfg.dormant.when) || [0.25, 0.9], rr = (o && o.rng) || mulberry32(((opts.seed || 1) + 4241 + s.total) >>> 0), win = g.spawnEnd - g.spawnStart;
    const rest = spawns.splice(s.spawned);
    for (let i = 0; i < k; i++) {
      if (o && o.at !== undefined) { const f = o.from, u = f ? (rr() * 2 - 1) * f.r : 0; rest.push({ t: o.at + i * (o.gap || 0), bp: o.bps[Math.floor(rr() * o.bps.length)], hpv: 1 + (rr() * 2 - 1) * g.hpVariance, from: f ? { x: f.x + f.rx * u, z: f.z + f.rz * u } : undefined }); }
      else rest.push({ t: Math.max(s.t, g.spawnStart + win * (W[0] + rr() * (W[1] - W[0]))), bp: Math.floor(rr() * n), hpv: 1 + (rr() * 2 - 1) * g.hpVariance });
    }
    rest.sort((a, b) => a.t - b.t); spawns.push(...rest); s.total += k; s.log.push({ e: o && o.at !== undefined ? 'summoned' : 'woken', k }); return k;
  };
  s.endDay = () => { if (s.phase === 'day' && !s.done) { s.phase = 'night'; s.dayT = 0; s.log.push({ e: 'dusk' }); } };
  // bots only: a compressed day. Sets the collectors by ground-floor openings, picks up a share of the crates, lets the sun charge for the whole day, then dusk
  s.botDay = (frac = 1) => {
    if (s.phase !== 'day') return;
    const gb = breaches.filter((b) => b.floor === 0);
    for (let i = 0; i < cfg.devices.collector.max && gb.length; i++) { const b = gb[i % gb.length]; s.place('collector', { x: b.inX - b.nx * 0.8 - b.nz * (i >= gb.length ? 1.5 : 0), z: b.inZ - b.nz * 0.8 + b.nx * (i >= gb.length ? 1.5 : 0) }); }
    const take = Math.round(crates.length * frac);
    for (let i = 0; i < take; i++) { const c = crates[i]; c.got = true; if (c.kind === 'food') s.food += c.v; else s.ess += c.v; }
    addEnergy(cfg.day.handCharge * cfg.day.duration + s.devices.filter((q) => q.kind === 'collector').length * cfg.devices.collector.chargePerSec * cfg.day.botStay); // the hand all day, the collectors for the time spent in the last house
    s.log.length = 0; s.endDay();
  };
  function finish(win) {
    s.done = true; s.win = win;
    const lasted = s.t;
    const total = cfg.loot.perBP * n * cfg.ring.mult[ring];
    s.result = win
      ? { win, ring, food: s.food, eaten: s.eaten, essentials: day ? s.ess + Math.max(s.devices.some((q) => q.kind === 'collector') ? 1 : 0, Math.round((s.devices.filter((q) => q.kind === 'collector').length / cfg.devices.collector.max) * cfg.day.collectorBonus * essTotal)) : Math.round(total * (1 - cfg.loot.foodShare)), collectors: s.devices.filter((q) => q.kind === 'collector').length, coins: s.coins }
      : { win, ring, lasted, food: cfg.loot.minPayoutFood, essentials: 0, coins: s.coins };
    if (s.boss) s.boss.reward(s.result); // the boss's bonus for broken paws and the coin-core (won nights only)
  }
  s.abandon = () => { if (!s.done) { finish(false); s.result.left = true; } }; // quitting counts as a loss: minimum payout only
  // can a shot from (ax, az) on floor fl reach the point (bx, bz) outside? (through an opening on that floor, like openOK)
  s.openAt = (ax, az, bx, bz, fl) => openOK(ax, az, { phase: 'approach', bp: 0, x: bx, z: bz, floor: fl, _fl: fl });
  // THE BECKONER (CONFIG.boss): on the boss ring's nights; opts.boss = false leaves it out (tests), true forces it
  s.boss = (opts.boss !== undefined ? opts.boss : !!(cfg.boss && cfg.boss.on && ring === cfg.boss.ring)) ? createBoss(s, cfg, opts, { spawns, breaches, finish, hurtDevice, openAt: s.openAt, addGloom: (k, o) => s.addGloom(k, o) }) : null;
  return s;
}
