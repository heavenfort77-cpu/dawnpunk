// One run = a day in the settlement (the ring's six houses on one street), then the night in the LAST house you are in (GDD section 2).
// Pure logic, no rendering: main.js draws the street and the interiors.
import { createSim, mulberry32 } from './sim.js';

export function createRun(cfg, ring, seed = 1, opts = {}) {
  const rnd = mulberry32(seed >>> 0), T = cfg.town;
  const slots = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const catHouse = Math.floor(rnd() * 6); // the hidden lucky cat is in ONE of the six houses
  // loot per house: size-based, times a random factor (a small house can be rich), rescaled so the settlement total is unchanged
  const [lo, hi] = cfg.day.lootSpread, bp = [0, 1, 2, 3, 4, 5].map((i) => cfg.ring.bpBase[i] + cfg.ring.bpPerRing * ring), raw = bp.map((n) => Math.pow(n, cfg.day.lootSizePow) * (lo + rnd() * (hi - lo)));
  const scale = bp.reduce((a, n) => a + n, 0) / raw.reduce((a, v) => a + v, 0), lootMul = raw.map((v, i) => (v * scale) / bp[i]);
  const loadTotal = cfg.loot.perBP * cfg.ring.mult[ring] * bp.reduce((a, n) => a + n, 0); // the settlement's loot; the food you packed does not weigh you down
  const houses = [], er = mulberry32((seed ^ 0xe47a) >>> 0);
  for (let i = 0; i < 6; i++) {
    // opts.boss: src/base.js bossNight (OWNER DECISION lead 00:25); left undefined, the sim keeps its ring rule (balance bots)
    const sim = createSim({ cfg, ring, house: i, seed: (seed + 101 * (i + 1)) >>> 0, day: true, noPack: true, hand: true, furniture: true, noCat: i !== catHouse, gloomMult: opts.gloomMult, lootMul: lootMul[i], loadTotal, boss: opts.boss });
    const slot = slots[i], row = slot < 3 ? -1 : 1, x = ((slot % 3) - 1) * T.gapX, z = row * T.rowZ; // two rows facing the street (z = 0)
    // the house is turned so that its real front door faces the street: town = (x, z) + R(local). cs/sn are that quarter turn.
    const d = exitDoor(sim); let cs = 1, sn = 0;
    for (const [c, s_] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const ox = -d.nx * c + d.nz * s_, oz = -d.nx * s_ - d.nz * c; if (Math.abs(ox) < 0.01 && Math.abs(oz + row) < 0.01) { cs = c; sn = s_; } }
    // a lean-to extension on a wall stretch that has no opening on the ground floor (never the door's wall), for most houses
    let ext = null; const H = sim.H;
    for (let k = 0; k < 8 && !ext && i % 3 !== 2; k++) { const ax = er() < 0.5 ? 'x' : 'z', sgn = er() < 0.5 ? -1 : 1, w = 2.4 + 1.2 * er(), dp = 1.4 + 0.8 * er(), c = (er() * 2 - 1) * (H - w / 2 - 0.3), hgt = 2.0 + 0.5 * er();
      if (sim.breaches.some((b) => b.floor === 0 && (ax === 'x' ? Math.abs(b.z - sgn * H) < 0.01 && Math.abs(b.x - c) < w / 2 + 1.5 : Math.abs(b.x - sgn * H) < 0.01 && Math.abs(b.z - c) < w / 2 + 1.5))) continue;
      if (ax === 'x' ? Math.abs(d.z - sgn * H) < 0.01 : Math.abs(d.x - sgn * H) < 0.01) continue;
      const lx = ax === 'x' ? c : sgn * (H + 0.2 + dp / 2), lz = ax === 'x' ? sgn * (H + 0.2 + dp / 2) : c; ext = { ax, sgn, c, w, d: dp, hgt, lx, lz, x: x + lx * cs - lz * sn, z: z + lx * sn + lz * cs, r: Math.max(w, dp) / 2 + 0.35 }; }
    if (sim.boss) { const sg = x !== 0 ? Math.sign(x) : (seed & 1 ? 1 : -1); sim.boss.placeToward(cs * sg, -sn * sg); } // the boss stands down the street toward the nearer end (src/boss.js)
    houses.push({ i, sim, x, z, row, cs, sn, ext, H: sim.H, L: sim.L, n: sim.n, doorX: x + d.x * cs - d.z * sn, doorZ: z + d.x * sn + d.z * cs - row * 0.6 });
  }
  // abandoned cars (GDD 2026-11-14): on the road edges and in the yards, never in front of a door; each has its own damage and rust
  const cars = [], spots = [];
  for (let k = 0; k < 14; k++) spots.push([(-T.boundX + 8) + rnd() * (2 * T.boundX - 16), (rnd() < 0.5 ? -1 : 1) * (1.9 + rnd() * 1.6), rnd() < 0.7 ? (rnd() - 0.5) * 0.5 : Math.PI / 2 + (rnd() - 0.5) * 1.2]);
  for (let k = 0; k < 6; k++) spots.push([(rnd() < 0.5 ? -1 : 1) * T.gapX * (0.5 + (rnd() - 0.5) * 0.2), (rnd() < 0.5 ? -1 : 1) * (T.rowZ + (rnd() - 0.5) * 6), rnd() * Math.PI]);
  for (const [cx, cz, yaw] of spots) {
    if (cars.length >= T.cars) break;
    if (houses.some((h) => (Math.abs(cx - h.doorX) < 3.2 && Math.abs(cz) < Math.abs(h.doorZ) + 1) || (Math.abs(cx - h.x) < h.H + 3 && Math.abs(cz - h.z) < h.H + 3)) || cars.some((c) => Math.hypot(c.x - cx, c.z - cz) < 6) || Math.hypot(cx, cz) < 4 || Math.hypot(cx - cfg.marla.guide.x, cz - cfg.marla.guide.z) < 4.5) continue; // also never on top of Marla's spot
    cars.push({ x: cx, z: cz, yaw, r: 1.9, kind: (Math.floor(rnd() * 0 + seed) + cars.length) % 5, dmg: rnd(), rust: 0.25 + 0.75 * rnd(), paint: (Math.floor(rnd() * 0 + seed * 7) + cars.length) % 6, wheels: Math.floor(rnd() * 16), s: Math.floor(rnd() * 1e6) });
    { const q = cars[cars.length - 1], ci = (seed + cars.length - 1) % cfg.carCond.length, C = cfg.carCond[ci], lerp = (v, t) => v[0] + (v[1] - v[0]) * t; q.cond = ci; q.rust = lerp(C.rust, q.rust); q.dmg = lerp(C.dmg, q.dmg); q.wheels = C.wheels === 'all' ? 0 : C.wheels === 'none' ? 15 : C.wheels === 'one' ? 1 << (q.wheels % 4) : q.wheels; if (C.skew) q.yaw += (q.dmg - 0.5) * C.skew * 4; }
  }
  return { cfg, ring, seed, houses, cars, catHouse, loadTotal, inside: -1, visited: 0, dayT: cfg.day.duration, bell: false,
    energy: cfg.day.startEnergy + (opts.extraEnergy || 0), food: cfg.day.packFood, ess: 0, coins: 0, px: 0, pz: 0 };
}
// the door you walk in and out by: a ground-floor door (every house has one), else any ground-floor opening
export const exitDoor = (sim) => sim.breaches.find((b) => b.floor === 0 && b.type === 'door') || sim.breaches.find((b) => b.floor === 0);
export function lootLeft(h) { let food = 0, ess = 0; for (const c of h.sim.crates) if (!c.got) { if (c.kind === 'food') food += c.v; else ess += c.v; } return { food, ess }; }
// walk in: what you carry goes with you, and the day clock keeps running inside
export function enter(run, i) {
  const h = run.houses[i], s = h.sim, d = exitDoor(s), p = s.player;
  p.energy = Math.min(run.cfg.player.energyCap, run.energy); s.food = run.food; s.ess = run.ess; s.coins = run.coins; s.dayT = Math.max(0.05, run.dayT);
  p.x = d.inX + d.nx * 1.4; p.z = d.inZ + d.nz * 1.4; p.floor = 0; p.climb = null; p.stairCd = 0; p.ladderCd = 0; p.yaw = Math.atan2(-d.nx, -d.nz);
  if (!h.seen) { h.seen = true; run.visited++; }
  run.inside = i; return s;
}
// walk out (daytime only): you keep what you picked up; collectors stay behind in that house
export function leave(run) {
  if (run.inside < 0) return false;
  const h = run.houses[run.inside], s = h.sim; if (s.phase !== 'day' || s.done) return false;
  const d = exitDoor(s), p = s.player; if (p.floor !== 0 || p.climb || Math.hypot(p.x - d.inX, p.z - d.inZ) > run.cfg.town.leaveRadius) return false; // only at the door
  run.energy = s.player.energy; run.food = s.food; run.ess = s.ess; run.coins = s.coins; run.dayT = s.dayT;
  run.inside = -1; run.px = h.doorX; run.pz = h.doorZ - h.row * 2.6; return true;
}
// on the street: the hand banks sunlight, the clock runs. Returns true when the sun is down
export const speedMult = (run) => Math.max(run.cfg.day.carryMin, 1 - run.cfg.day.carrySlow * Math.min(1, Math.max(0, run.food + run.ess - run.cfg.day.packFood) / run.loadTotal));
export function tickTown(run, dt) { run.energy = Math.min(run.cfg.player.energyCap, run.energy + run.cfg.day.handCharge * dt); run.dayT -= dt; return run.dayT <= 0; }
export function nearest(run, x, z) { let best = run.houses[0], bd = 1e9; for (const h of run.houses) { const d = Math.hypot(h.doorX - x, h.doorZ - z); if (d < bd) { bd = d; best = h; } } return best; }
// keep the walker out of the house boxes and inside the settlement
export function pushOut(run, x, z) {
  const T = run.cfg.town, r = 0.45;
  x = Math.max(-T.boundX, Math.min(T.boundX, x)); z = Math.max(-T.boundZ, Math.min(T.boundZ, z));
  const walls = () => { for (const h of run.houses) {
    const dx = x - h.x, dz = z - h.z, e = h.H + r;
    if (Math.abs(dx) < e && Math.abs(dz) < e) { if (e - Math.abs(dx) < e - Math.abs(dz)) x = h.x + Math.sign(dx || 1) * e; else z = h.z + Math.sign(dz || -h.row) * e; }
  } };
  walls();
  for (const h of run.houses) { const c = h.ext; if (!c) continue; const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz); if (d < c.r && d > 1e-6) { x = c.x + dx / d * c.r; z = c.z + dz / d * c.r; } }
  for (const c of run.cars) { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz); if (d < c.r && d > 1e-6) { x = c.x + dx / d * c.r; z = c.z + dz / d * c.r; } }
  // (R4 worker 10) a porch or car push can put you back inside a house's walls: the walls have the last word
  walls();
  return [x, z];
}
// dusk on the street (bell ran out or DUSK held): you are moved into the nearest house, and that is the last house
export function nightfall(run) { const i = run.inside >= 0 ? run.inside : nearest(run, run.px, run.pz).i; const s = run.inside >= 0 ? run.houses[i].sim : enter(run, i); s.endDay(); return s; }
