// Fairness probe (Nov 23, game-fairness-testing): a bot panel plays nights 1-6 of fresh saves (a win opens the next ring, as in tools/campaign.mjs).
// Per profile: wins, hits and health lost per night. Per cause (machine kind, strike or over-the-shield): hits, and the WARNING before each hit:
//   seen  = seconds since that machine first came within SEE m of the player on the player's floor
//   reach = seconds since it last came into its striking reach (0 = it struck in the step it arrived)
// Bots only, logic sim only: no human, no screen, no sound. Usage: node tools/fairprobe.mjs [saves]
import { createSim } from '../src/sim.js'; import { SKILLS } from '../src/bots.js'; import { CONFIG } from '../src/config.js'; import * as B from '../src/base.js';
const SEE = 5, FAST = 0.25, OK = 0.4, NIGHTS = 6, N = +process.argv[2] || 40;
const PANEL = { expert: SKILLS.expert, average: SKILLS.average, novice: SKILLS.novice, late: { ...SKILLS.average, startAt: 45 }, one: { ...SKILLS.average, build: ['lance'] }, nobuild: { ...SKILLS.average, build: [] } };
const spots = [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5]], tSpots = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 2]], med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0), pct = (a, f) => (a.length ? Math.round(100 * a.filter(f).length / a.length) : 0);
function night(cfg, ring, house, seed, k, hits) {
  const s = createSim({ cfg, ring, house, seed, day: true }); s.botDay(k.scav); const dt = cfg.night.dt, build = k.build, KN = cfg.gloom.kinds, seen = new Map(), inR = new Map(); let nextBuild = k.startAt, bi = 0, placed = 0, turb = 0, li = s.log.length, n = 0;
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
    if (p.hp < k.eatBelow && s.food > 0) s.eat();
    if (s.log.length < li) li = 0; const t0 = s.t; s.step(dt);
    for (; li < s.log.length; li++) { const e = s.log[li]; if (e.e !== 'hurt') continue; n++; hits.push({ kind: e.kind, over: !!e.over, seen: seen.has(e.id) ? t0 - seen.get(e.id) : 0, reach: inR.has(e.id) ? t0 - inR.get(e.id) : 0, t: s.t }); }
    for (const g of s.gloom) { const d = Math.hypot(g.x - p.x, g.z - p.z), same = g.floor === p.floor; if (same && d <= SEE && !seen.has(g.id)) seen.set(g.id, s.t);
      if (same && d <= cfg.gloom.reach * ((KN[g.kind] || {}).reach || 1)) { if (!inR.has(g.id)) inR.set(g.id, s.t); } else inR.delete(g.id); } }
  return { s, n }; }
const all = [];
for (const name of Object.keys(PANEL)) { const win = Array(NIGHTS).fill(0), hn = Array.from({ length: NIGHTS }, () => []), lost = Array.from({ length: NIGHTS }, () => []), first = [];
  for (let sd = 1; sd <= N; sd++) { const save = B.newSave(CONFIG, sd * 7919);
    for (let d = 1; d <= NIGHTS; d++) { if (!save.project) for (const k of ['energy', 'panel', 'turbine']) { if (B.startResearch(CONFIG, save, k).ok) break; } B.helpResearch(CONFIG, save);
      const ring = (save.ringOpen || 1) - 1, c0 = B.makeCfg(CONFIG, save), cfg = { ...c0, day: { ...c0.day, startEnergy: c0.day.startEnergy + B.nightEnergyBonus(CONFIG, save) } }, hits = [], r = night(cfg, ring, 5, sd * 131 + d, PANEL[name], hits), s = r.s;
      if (s.win) win[d - 1]++; hn[d - 1].push(r.n); lost[d - 1].push(Math.round(CONFIG.player.hp - Math.max(0, s.player.hp))); if (d === 1 && hits.length) first.push(hits[0].t); for (const h of hits) all.push({ ...h, who: name, night: d });
      B.applyNight(CONFIG, save, { ...s.result, ring }, s.killed || 0); } }
  console.log(name.padEnd(8), '| win %', win.map((w) => String(Math.round(100 * w / N)).padStart(3)).join(' '), '| hits (median)', hn.map((a) => String(med(a)).padStart(2)).join(' '), '| nights with 0 hits %', hn.map((a) => String(pct(a, (x) => x === 0)).padStart(3)).join(' '), '| night 1 first hit at s (median)', first.length ? med(first).toFixed(0) : '-'); }
console.log('\nCAUSES (all profiles, ' + all.length + ' hits) | hits | median seen s | median reach s | reach < ' + FAST + ' s % | reach < ' + OK + ' s %');
const by = new Map(); for (const h of all) { const k = h.kind + (h.over ? ' over shield' : ' strike'); if (!by.has(k)) by.set(k, []); by.get(k).push(h); }
for (const [k, a] of [...by.entries()].sort((x, y) => y[1].length - x[1].length)) console.log(k.padEnd(22), String(a.length).padStart(6), med(a.map((h) => h.seen)).toFixed(1).padStart(6), med(a.map((h) => h.reach)).toFixed(1).padStart(6), String(pct(a, (h) => h.reach < FAST)).padStart(5), String(pct(a, (h) => h.reach < OK)).padStart(5));
const fs = all.filter((h) => h.reach < FAST); console.log('hits with reach warning under ' + FAST + ' s: ' + fs.length + ' of ' + all.length + ' (' + pct(all, (h) => h.reach < FAST) + ' %); of those, seen under 1 s: ' + pct(fs, (h) => h.seen < 1) + ' %');
