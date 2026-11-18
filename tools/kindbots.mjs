// Average bot, standard build (2 turbines, 2 lances, 2 panels), with the seven machines against one plain kind: win % per ring. Usage: node tools/kindbots.mjs [runs]
import { createSim } from '../src/sim.js'; import { SKILLS } from '../src/bots.js'; import { CONFIG } from '../src/config.js';
const spots = [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5]], tSpots = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 2]], build = ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel'];
function run(cfg, ring, house, seed) {
  const k = SKILLS.average, s = createSim({ cfg, ring, house, seed, day: true }); s.botDay(k.scav); const dt = cfg.night.dt; let nextBuild = k.startAt, bi = 0, placed = 0, turb = 0;
  while (!s.done) { const p = s.player;
    if (s.t >= nextBuild && bi < build.length) { const kind = build[bi], d = cfg.devices[kind];
      if (p.floor !== 0 || Math.hypot(p.x, p.z) > 3) s.move(-p.x, -p.z, dt);
      else if (p.energy >= d.cost + k.reserve) { let r;
        if (d.wall) { const free = s.breaches.filter((b) => !b.panel && b.floor === 0); const b = free[Math.floor(s.rng() * free.length)]; r = b ? s.place(kind, { bp: b.i }) : { ok: false }; }
        else if (kind === 'turbine') { const sp = tSpots[turb++ % 3]; r = s.place(kind, { x: sp[0], z: sp[1] }); } else { const sp = spots[placed % spots.length]; r = s.place(kind, { x: sp[0], z: sp[1] }); }
        if (r.ok) { placed++; bi++; nextBuild = s.t + k.gap; } else { bi++; nextBuild = s.t + 0.5; } }
      else nextBuild = s.t + 1; }
    else if (p.floor !== 0 || Math.hypot(p.x, p.z) > 1) s.move(-p.x, -p.z, dt);
    const near = s.gloom.filter((g) => Math.hypot(g.x - p.x, g.z - p.z) < cfg.cannon.range);
    if (near.length) { if (!s._r) s._r = s.t + k.react; if (s.t >= s._r) s.fireCannon('auto', k.hit); } else s._r = 0;
    if (p.hp < k.eatBelow && s.food > 0) s.eat(); s.step(dt); }
  return s; }
const N = +process.argv[2] || 60, plain = JSON.parse(JSON.stringify(CONFIG)); delete plain.gloom.kinds; plain.gloom.kindHp = 1;
for (const [ring, house, name] of [[0, 0, 'ring 1 largest'], [1, 0, 'ring 2 largest'], [2, 0, 'ring 3 largest'], [3, 2, 'ring 4 mid'], [4, 3, 'ring 5 mid']]) {
  const w = (cfg) => { let n = 0; for (let sd = 1; sd <= N; sd++) if (run(cfg, ring, house, sd).win) n++; return Math.round(100 * n / N); };
  console.log(name.padEnd(16), 'one kind', String(w(plain)).padStart(3) + '%', ' seven machines', String(w(CONFIG)).padStart(3) + '%'); }
