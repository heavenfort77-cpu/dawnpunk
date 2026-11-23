// Bots at four skill levels. They use only the same actions a player has, and they WALK to a breach point to place a panel.
import { createSim } from './sim.js';
import { botBoss } from './boss.js';

export const SKILLS = {
  novice:  { scav: 0.6, hit: 0.55, react: 0.7, startAt: 5, gap: 3, reserve: 6,  kite: false, eatBelow: 30, build: ['turbine', 'lance', 'turbine', 'lance', 'panel'] },
  average: { scav: 0.8, hit: 0.70, react: 0.4, startAt: 3, gap: 3, reserve: 8,  kite: false, eatBelow: 55, build: ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel'] },
  expert:  { scav: 1, hit: 0.90, react: 0.2, startAt: 2, gap: 2, reserve: 15, kite: true,  eatBelow: 60, build: ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel', 'lance', 'panel'] },
  // the same players using the charged shot whenever three or more Gloom are in range (for measuring only; the balance gates use the plain ones)
  averageC: { scav: 0.8, hit: 0.70, react: 0.4, startAt: 3, gap: 3, reserve: 8,  kite: false, eatBelow: 55, charge: 3, build: ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel'] },
  expertC:  { scav: 1, hit: 0.90, react: 0.2, startAt: 2, gap: 2, reserve: 15, kite: true,  eatBelow: 60, charge: 3, build: ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel', 'lance', 'panel'] },
  // the "2 turbines + 2 lances" strategy a player found: stack energy and guns, then panels
  // the average player who never shoots the boss's weak points (balance measure for the final night: src/boss.js)
  averageNB: { scav: 0.8, hit: 0.70, react: 0.4, startAt: 3, gap: 3, reserve: 8,  kite: false, eatBelow: 55, noBoss: true, build: ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel'] },
  expertNB: { scav: 1, hit: 0.90, react: 0.2, startAt: 2, gap: 2, reserve: 15, kite: true,  eatBelow: 60, noBoss: true, build: ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel', 'lance', 'panel'] },
  // the expert who plays the boss properly: shoots every raised palm core and the open chest, whatever Sun is left (bossReserve 0; balance measure for src/boss.js)
  pawhunter: { scav: 1, hit: 0.90, react: 0.2, startAt: 2, gap: 2, reserve: 15, kite: true,  eatBelow: 60, bossReserve: 0, build: ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel', 'lance', 'panel'] },
  noviceNB: { scav: 0.6, hit: 0.55, react: 0.7, startAt: 5, gap: 3, reserve: 6,  kite: false, eatBelow: 30, noBoss: true, build: ['turbine', 'lance', 'turbine', 'lance', 'panel'] },
  stacker: { scav: 0.8, hit: 0.70, react: 0.4, startAt: 2, gap: 2, reserve: 5,  kite: false, eatBelow: 55, build: ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel'] },
};

function walkTo(s, x, z, fl, dt) {
  const p = s.player;
  if (p.floor === fl) { s.move(x - p.x, z - p.z, dt); return Math.hypot(x - p.x, z - p.z); }
  const up = fl > p.floor, st = s.stairs.find((q) => q.f === (up ? p.floor : p.floor - 1));
  s.move((up ? st.bx : st.tx) - p.x, (up ? st.bz : st.tz) - p.z, dt); return 99;
}

export function runBot(skillName, cfg, ring, house, seed, xo) { // xo: extra createSim options (measuring: toughHp)
  // noFall: a bot does not drop through the open stair and ladder gaps upstairs (it has no way-finding to walk round them; src/sim.js playerTravel)
  const k = SKILLS[skillName], s = createSim({ cfg, ring, house, seed, day: true, noFall: true, ...(xo || {}) });
  s.botDay(k.scav);
  const dt = cfg.night.dt;
  let nextBuild = k.startAt, bi = 0, lance = 0, turbine = 0, goal = null;
  const lanceSpots = [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]];
  const turbineSpots = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 2]];
  while (!s.done) {
    const p = s.player;
    // measuring only: a profile may carry probe(s), called every step (tools and scratch scripts)
    if (k.probe) k.probe(s);
    // the final-night boss (src/boss.js): an open weak point comes first unless a Gloom inside is close (bossNear m); it walks to an opening that sees it and shoots
    // k.bossAfter: the bot places this many of its build list before it starts on the weak points (a player builds first, then hunts)
    if (!k.noBoss && !goal && s.boss && bi >= (k.bossAfter || 0) && !s.gloom.some((g) => g.phase === 'inside' && g.floor === p.floor && Math.hypot(g.x - p.x, g.z - p.z) < (k.bossNear || 5)) && botBoss(s, k, cfg, (x, z) => walkTo(s, x, z, 0, dt))) { if (p.hp < k.eatBelow && s.food > 0) s.eat(); s.step(dt); continue; }
    if (goal) {
      // walking to a breach point to place a panel
      const d = walkTo(s, goal.x, goal.z, goal.floor, dt);
      if (d > cfg.panelReach - 1) { /* keep walking */ }
      else { const r = s.place('panel', { bp: goal.bp }); goal = null; if (r.ok) { bi++; nextBuild = s.t + k.gap; } else nextBuild = s.t + 1; }
    } else if (s.t >= nextBuild && bi < k.build.length) {
      const kind = k.build[bi], cost = cfg.devices[kind].cost;
      if (kind !== 'panel' && (p.floor !== 0 || Math.hypot(p.x, p.z) > 3)) walkTo(s, 0, 0, 0, dt); // go home before placing
      else if (p.energy >= cost + k.reserve) {
        if (kind === 'turbine') { const sp = turbineSpots[turbine % turbineSpots.length]; if (s.place('turbine', { x: sp[0], z: sp[1] }).ok) { turbine++; bi++; nextBuild = s.t + k.gap; } }
        else if (kind === 'lance') { const sp = lanceSpots[lance % lanceSpots.length]; if (s.place('lance', { x: sp[0], z: sp[1] }).ok) { lance++; bi++; nextBuild = s.t + k.gap; } }
        else {
          const free = s.breaches.filter((b) => !b.panel);
          let pick = free[Math.floor(s.rng() * free.length)];
          if (skillName === 'expert') { let bestC = -1; for (const b of free) { const c = s.gloom.filter((g) => g.bp === b.i).length; if (c > bestC) { bestC = c; pick = b; } } }
          if (pick) goal = { x: pick.inX, z: pick.inZ, bp: pick.i, floor: pick.floor }; else nextBuild = s.t + 1;
        }
      } else nextBuild = s.t + 1;
    } else if (p.floor !== 0 || Math.hypot(p.x, p.z) > 1) walkTo(s, 0, 0, 0, dt); // walk back home
    // combat
    const inRange = s.gloom.filter((g) => Math.hypot(g.x - p.x, g.z - p.z) < cfg.cannon.range);
    if (inRange.length) {
      if (!s._reactAt) s._reactAt = s.t + k.react;
      if (s.t >= s._reactAt) { const CH = cfg.cannon.charge; // charging takes time: the bot holds fire for charge.time, then lets the charged shot go
        if (k.charge && inRange.length >= k.charge && p.energy >= cfg.cannon.cost * CH.cost + k.reserve) { if (!s._chg) s._chg = s.t + CH.time; else if (s.t >= s._chg) { s.fireCannon('auto', k.hit, true); s._chg = 0; } }
        else { s._chg = 0; s.fireCannon('auto', k.hit); } }
    } else s._reactAt = 0;
    if (p.hp < k.eatBelow && s.food > 0) s.eat();
    if (k.kite) {
      let near = null, nd = 3;
      for (const g of s.gloom) { if (g.phase !== 'inside') continue; const d = Math.hypot(g.x - p.x, g.z - p.z); if (d < nd) { nd = d; near = g; } }
      if (near) s.move(p.x - near.x, p.z - near.z, dt);
    }
    s.step(dt);
  }
  return s;
}
