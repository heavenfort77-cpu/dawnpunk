// How long does the game take? A bot plays whole saves: every day it takes the highest ring open, holds a house, banks the night.
// "Complete" = the first win on the last ring (ring 5). Reports days needed and clock time (base + day + night per day). Usage: node tools/campaign.mjs [saves]
import { createSim } from '../src/sim.js'; import { SKILLS } from '../src/bots.js'; import { CONFIG } from '../src/config.js'; if (process.argv[4]) CONFIG.ring.countMult = process.argv[4].split(',').map(Number); import * as B from '../src/base.js';
const spots = [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5]], tSpots = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 2]], build = ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel'];
const BASE_S = 60, MAXD = 60; // seconds spent in the base per day (walk to Marla, board, workshop), day cap per save
function night(cfg, ring, house, seed, k) {
  const s = createSim({ cfg, ring, house, seed, day: true }); s.botDay(k.scav); const dt = cfg.night.dt; let nextBuild = k.startAt, bi = 0, placed = 0, turb = 0;
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
const BUY = process.argv[3] !== 'nobuy'; const N = +process.argv[2] || 40, last = CONFIG.ring.mult.length - 1, med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const skill of ['novice', 'average', 'expert']) { const days = [], secs = [], ups = [], ess = []; let never = 0;
  for (let sd = 1; sd <= N; sd++) { const save = B.newSave(CONFIG, sd * 7919); let t = 0, done = 0;
    for (let d = 1; d <= MAXD && !done; d++) { if (BUY) { if (!save.project) for (const k of ['energy', 'panel', 'turbine']) { if (B.startResearch(CONFIG, save, k).ok) break; } B.helpResearch(CONFIG, save); }
      const top = (save.ringOpen || 1) - 1, ring = top, c0 = B.makeCfg(CONFIG, save), cfg = { ...c0, day: { ...c0.day, startEnergy: c0.day.startEnergy + B.nightEnergyBonus(CONFIG, save) } }, s = night(cfg, ring, 5, sd * 131 + d, SKILLS[skill]);
      t += BASE_S + CONFIG.day.duration + Math.min(CONFIG.night.duration, s.t); B.applyNight(CONFIG, save, { ...s.result, ring }, s.killed || 0); if (s.win && ring === last) done = d; }
    ups.push(save.up.energy + save.up.panel + save.up.turbine); ess.push(save.essTotal);
    if (done) { days.push(done); secs.push(t); } else never++; }
  console.log(skill.padEnd(8), days.length ? 'days to clear ring ' + (last + 1) + ': min ' + Math.min(...days) + ', median ' + med(days) + ', max ' + Math.max(...days) + ' | clock: min ' + Math.round(Math.min(...secs) / 60) + ' min, median ' + Math.round(med(secs) / 60) + ' min, max ' + Math.round(Math.max(...secs) / 60) + ' min' : 'never', '| upgrades owned at the end (median) ' + med(ups.filter((_, i) => true)) + ', essentials earned in all ' + med(ess) + ' | not cleared in ' + MAXD + ' days: ' + never + '/' + N); }
console.log('one day on the clock: base ' + BASE_S + ' s (assumed) + day ' + CONFIG.day.duration + ' s + night ' + CONFIG.night.duration + ' s = ' + ((BASE_S + CONFIG.day.duration + CONFIG.night.duration) / 60).toFixed(1) + ' min; one won night from the menu: ' + ((CONFIG.day.duration + CONFIG.night.duration) / 60).toFixed(1) + ' min');
