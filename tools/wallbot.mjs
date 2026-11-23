// Wall bot (owner Nov 23 23:56): the weakest bot (novice aim and reactions) with the owner's plan, on every ring.
// "back to the wall, turbine beside him, lance in front. Once enough Sun, add more turbines or lances. Other than that, shoot any Gloom that comes close."
// Wall spot: ground floor, 0.6 m off a wall, the point along the walls farthest from every opening, stair and ladder foot.
// Builds: turbine beside, lance in front, then (Sun >= cost + reserve) the second turbine, then lances up to the cap, spread in front of him.
// Shoots only at a Gloom within CLOSE m on his floor. Eats below the novice's eatBelow.
// Usage: node tools/wallbot.mjs [seeds per house]   env CLOSE (m, default 6), TOUGH=1 (CONFIG.tough as from the second night), SKILL (default novice), LANCE (JSON overrides of CONFIG.devices.lance, measuring only), BUILD (build only the first N of the plan), SPOT=centre (stand in the room's centre instead)
import { createSim } from '../src/sim.js'; import { SKILLS } from '../src/bots.js'; import { CONFIG } from '../src/config.js';
const SEEDS = +process.argv[2] || 8, CLOSE = +(process.env.CLOSE || 6), K = SKILLS[process.env.SKILL || 'novice'];
function walkTo(s, x, z, fl, dt) { const p = s.player;
  if (p.floor === fl) { s.move(x - p.x, z - p.z, dt); return Math.hypot(x - p.x, z - p.z); }
  const up = fl > p.floor, st = s.stairs.find((q) => q.f === (up ? p.floor : p.floor - 1)); s.move((up ? st.bx : st.tx) - p.x, (up ? st.bz : st.tz) - p.z, dt); return 99; }
function wallSpot(s) { const W = s.H - 0.6, avoid = s.breaches.filter((b) => b.floor === 0).map((b) => [b.inX, b.inZ]).concat(s.stairs.filter((q) => q.f === 0).map((q) => [q.bx, q.bz]), s.ladders.filter((q) => q.f === 0).map((q) => [q.x, q.z]));
  let best = null, bd = -1;
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let u = -W + 1.2; u <= W - 1.2; u += 0.4) {
    const x = nx ? nx * W : u, z = nz ? nz * W : u, d = Math.min(...avoid.map(([ax, az]) => Math.hypot(ax - x, az - z)));
    if (d > bd) { bd = d; best = { x, z, ix: -nx, iz: -nz, ax: nz ? 1 : 0, az: nx ? 1 : 0 }; } } // ix,iz: into the room; ax,az: along the wall
  return best; }
export function wallNight(cfg, ring, house, seed, toughHp = 1) {
  const s = createSim({ cfg, ring, house, seed, day: true, noFall: true, toughHp }); s.botDay(K.scav);
  const dt = cfg.night.dt, w = process.env.SPOT === 'centre' ? { x: 0, z: 0, ix: 0, iz: -1, ax: 1, az: 0 } : wallSpot(s), at = (along, inward) => ({ x: w.x + w.ax * along + w.ix * inward, z: w.z + w.az * along + w.iz * inward });
  const plan = [['turbine', at(1.0, 0)], ['lance', at(0, 1.5)], ['turbine', at(-1.0, 0)], ['lance', at(1.2, 1.8)], ['lance', at(-1.2, 1.8)], ['lance', at(0, 2.6)], ['lance', at(2.2, 1.2)], ['lance', at(-2.2, 1.2)]].slice(0, process.env.BUILD !== undefined ? +process.env.BUILD : 99);
  let bi = 0, reactAt = 0, dmg = 0, lh = null, peak = 0, li = 0, shots = 0, lances = 0, close = 99, lost = 0; const placedAt = [];
  while (!s.done) { const p = s.player;
    const home = walkTo(s, w.x, w.z, 0, dt) < 0.4 && p.floor === 0;
    if (home && bi < plan.length) { const [kind, o] = plan[bi], d = cfg.devices[kind], first = bi < 2;
      if (p.energy >= d.cost + (first ? 0 : K.reserve)) { const r = s.place(kind, o); if (r.ok) placedAt.push(kind[0] + Math.round(s.t)); bi++; if (!r.ok && r.reason !== 'cap' && r.reason !== 'group') bi--; } }
    let near = null, nd = CLOSE; for (const g of s.gloom) { if (g.floor !== p.floor && !(g.climb && g.climb.to === p.floor)) continue; const d = Math.hypot(g.x - p.x, g.z - p.z); if (d < nd) { nd = d; near = g; } }
    if (near) { if (!reactAt) reactAt = s.t + K.react; if (s.t >= reactAt) s.fireCannon('auto', K.hit); } else reactAt = 0;
    if (p.hp < K.eatBelow && s.food > 0) s.eat();
    const nD = s.devices.length; s.step(dt); if (s.devices.length < nD) lost++; for (; li < s.log.length; li++) { const e = s.log[li]; if (e.e === 'lance') lances++; if (e.e === 'shot') shots++; } for (const g of s.gloom) if (g.floor === p.floor) close = Math.min(close, Math.hypot(g.x - p.x, g.z - p.z)); if (lh !== null && p.hp < lh) dmg += lh - p.hp; lh = p.hp; if (s.gloom.length > peak) peak = s.gloom.length; }
  return { win: s.win, dmg, peak, placedAt, lances, shots, close, lost, killed: s.killed, total: s.spawns.length, boss: !!s.boss, placed: s.devices.filter((q) => q.kind === 'turbine' || q.kind === 'lance').length };
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  console.log(`wall bot, skill ${process.env.SKILL || 'novice'}, shoots within ${CLOSE} m, ${process.env.TOUGH ? 'with CONFIG.tough' : 'as released (no tough)'}, 6 houses x ${SEEDS} seeds per ring (boss on ring 5)`);
  const LC = JSON.parse(process.env.LANCE || '{}'), CFG = { ...CONFIG, devices: { ...CONFIG.devices, lance: { ...CONFIG.devices.lance, ...LC } } }; if (process.env.LANCE) console.log('lance overrides', process.env.LANCE);
  for (let ring = 0; ring < 5; ring++) { let w = 0, hurt = 0; const dm = [], pk = [], pl = [];
    for (let h = 0; h < 6; h++) for (let sd = 1; sd <= SEEDS; sd++) { const r = wallNight(CFG, ring, h, sd * 97 + h, process.env.TOUGH ? (CONFIG.tough.hp[ring] || 1) : 1); if (r.win) w++; if (r.dmg > 0) hurt++; dm.push(Math.round(r.dmg)); pk.push(r.peak); pl.push(r.placed); }
    const n = 6 * SEEDS; console.log(`ring ${ring + 1}: win ${Math.round(100 * w / n)}%, hurt ${Math.round(100 * hurt / n)}% of nights, damage median ${med(dm)}, turbines+lances placed median ${med(pl)}, most alive median ${med(pk)}`); }
}
