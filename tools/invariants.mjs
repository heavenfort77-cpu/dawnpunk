// Bug hunt, layer 1: rules that must ALWAYS hold, checked after every sim tick in hundreds of nights played by bots and by a "chaos" player that does random things.
// Prints INVARIANT lines (name, count, first example). Usage: node tools/invariants.mjs [seeds] [mutate]   ("mutate" breaks a rule on purpose to prove the monitor fires)
import { createSim } from '../src/sim.js'; import { SKILLS } from '../src/bots.js'; import { CONFIG } from '../src/config.js'; import * as B from '../src/base.js';
const N = +process.argv[2] || 4, MUT = process.argv[3] === 'mutate', bad = {}, hit = (name, ex) => { if (!bad[name]) bad[name] = { n: 0, ex }; bad[name].n++; };
const fin = (v) => typeof v === 'number' && isFinite(v), PH = new Set(['approach', 'block', 'cross', 'inside']), KINDS = new Set(Object.keys(CONFIG.gloom.kinds));
function monitor(s, cfg, ctx) { const p = s.player, cap = cfg.player.energyCap, H = s.H;
  if (![p.x, p.z, p.hp, p.energy, s.t].every(fin)) hit('player or clock value not a finite number', ctx + ' ' + JSON.stringify([p.x, p.z, p.hp, p.energy, s.t]));
  if (p.energy < -1e-6 || p.energy > cap + 1e-6) hit('battery outside 0..cap', ctx + ' energy ' + p.energy);
  if (p.hp > cfg.player.hp + 1e-6) hit('health above the maximum', ctx + ' hp ' + p.hp);
  if (!s.done && p.hp <= 0) hit('player at zero health but the night goes on', ctx);
  if (s.done && s.win && p.hp <= 0) hit('a win with a dead player', ctx);
  if (Math.abs(p.x) > H + 0.01 || Math.abs(p.z) > H + 0.01) hit('player outside the house', ctx + ' ' + p.x.toFixed(2) + ',' + p.z.toFixed(2) + ' H ' + H);
  if (!(p.floor >= 0 && p.floor < s.L)) hit('player on a floor that does not exist', ctx + ' floor ' + p.floor);
  if (!(s.food >= 0) || !(s.ess >= 0)) hit('food or essentials negative or not a number', ctx + ' ' + s.food + '/' + s.ess);
  if (s.phase === 'day' && s.gloom.length) hit('Gloom present by day', ctx);
  for (const g of s.gloom) { if (![g.x, g.z, g.hp].every(fin)) hit('Gloom value not a finite number', ctx + ' ' + JSON.stringify([g.x, g.z, g.hp])); if (g.hp <= 0) hit('dead Gloom still on the list', ctx); if (!PH.has(g.phase)) hit('Gloom in an unknown phase', ctx + ' ' + g.phase); if (g.kind && !KINDS.has(g.kind)) hit('Gloom of an unknown kind', ctx + ' ' + g.kind); if (!(g.floor >= 0 && g.floor < s.L)) hit('Gloom on a floor that does not exist', ctx + ' floor ' + g.floor); if (Math.hypot(g.x, g.z) > H + 30) hit('Gloom far from the house', ctx); if ((g.phase === 'inside') && (Math.abs(g.x) > H + 0.3 || Math.abs(g.z) > H + 0.3)) hit('Gloom marked inside but outside the walls', ctx + ' ' + g.x.toFixed(2) + ',' + g.z.toFixed(2)); }
  const cnt = {}, grp = {};
  for (const d of s.devices) { const D = cfg.devices[d.kind]; if (!D) { hit('device of an unknown kind', ctx + ' ' + d.kind); continue; } cnt[d.kind] = (cnt[d.kind] || 0) + 1; if (D.group) grp[D.group] = (grp[D.group] || 0) + 1; if (![d.x, d.z, d.hp].every(fin)) hit('device value not a finite number', ctx + ' ' + d.kind); if (d.hp <= 0) hit('destroyed device still on the list', ctx + ' ' + d.kind); if (Math.abs(d.x) > H + 0.45 || Math.abs(d.z) > H + 0.45) hit('device outside the house', ctx + ' ' + d.kind + ' ' + d.x.toFixed(2) + ',' + d.z.toFixed(2)); if (!(d.floor >= 0 && d.floor < s.L)) hit('device on a floor that does not exist', ctx + ' ' + d.kind); }
  for (const k in cnt) if (cfg.devices[k].max && cnt[k] > cfg.devices[k].max) hit('more devices of one kind than its limit', ctx + ' ' + k + ' ' + cnt[k]);
  for (const k in grp) if (grp[k] > cfg.groupMax[k]) hit('more devices in a group than the group limit', ctx + ' ' + k + ' ' + grp[k]);
  for (const b of s.breaches) if (b.panel != null && !s.devices.some((d) => d.id === b.panel || d === b.panel)) hit('an opening points at a panel that no longer exists', ctx + ' bp ' + b.i);
  if (s.done && !s.result) hit('night over without a result', ctx);
  if (s.done && s.result && (!(s.result.food >= 0) || !(s.result.essentials >= 0))) hit('result with negative or missing loot', ctx + ' ' + JSON.stringify(s.result));
}
const spots = [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5]], tSpots = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 2]], build = ['turbine', 'lance', 'turbine', 'lance', 'panel', 'panel'];
let ticks = 0, nights = 0;
function botNight(cfg, ring, house, seed, k, ctx) { const s = createSim({ cfg, ring, house, seed, day: true }); s.botDay(k.scav); const dt = cfg.night.dt; let nextBuild = k.startAt, bi = 0, placed = 0, turb = 0, lastT = -1;
  while (!s.done) { const p = s.player;
    if (s.t >= nextBuild && bi < build.length) { const kind = build[bi], d = cfg.devices[kind]; if (p.floor !== 0 || Math.hypot(p.x, p.z) > 3) s.move(-p.x, -p.z, dt); else if (p.energy >= d.cost + k.reserve) { let r; if (d.wall) { const free = s.breaches.filter((b) => !b.panel && b.floor === 0); const b = free[Math.floor(s.rng() * free.length)]; r = b ? s.place(kind, { bp: b.i }) : { ok: false }; } else if (kind === 'turbine') { const sp = tSpots[turb++ % 3]; r = s.place(kind, { x: sp[0], z: sp[1] }); } else { const sp = spots[placed % spots.length]; r = s.place(kind, { x: sp[0], z: sp[1] }); } if (r.ok) { placed++; bi++; nextBuild = s.t + k.gap; } else { bi++; nextBuild = s.t + 0.5; } } else nextBuild = s.t + 1; }
    else if (p.floor !== 0 || Math.hypot(p.x, p.z) > 1) s.move(-p.x, -p.z, dt);
    const near = s.gloom.filter((g) => Math.hypot(g.x - p.x, g.z - p.z) < cfg.cannon.range); if (near.length) { if (!s._r) s._r = s.t + k.react; if (s.t >= s._r) s.fireCannon('auto', k.hit, k.charge && near.length >= 3); } else s._r = 0;
    if (p.hp < k.eatBelow && s.food > 0) s.eat(); s.step(dt); ticks++; if (s.t < lastT - 1e-9) hit('the night clock ran backwards', ctx); lastT = s.t; if (MUT && ticks === 500) s.player.energy = 1e6; monitor(s, cfg, ctx); }
  nights++; return s; }
function chaosNight(cfg, ring, house, seed, ctx) { const s = createSim({ cfg, ring, house, seed, day: true }), r = (() => { let q = seed * 2654435761 >>> 0; return () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296); })(), kinds = Object.keys(cfg.devices), dt = cfg.night.dt; let guard = 0;
  while (!s.done && guard++ < 40000) { const p = s.player, a = r();
    if (a < 0.35) { const an = r() * 6.28; s.move(Math.cos(an) * 9, Math.sin(an) * 9, dt); } else if (a < 0.5) { const kd = kinds[Math.floor(r() * kinds.length)]; const o = r() < 0.5 ? { bp: Math.floor(r() * s.breaches.length) } : { x: (r() * 2 - 1) * (s.H + 2), z: (r() * 2 - 1) * (s.H + 2) }; if (r() < 0.2) p.energy = Math.min(cfg.player.energyCap, p.energy + 30); s.place(kd, r() < 0.3 ? {} : o); }
    else if (a < 0.7) { p.yaw = r() * 6.28; p.pitch = (r() - 0.5) * 1.2; s.fireCannon(r() < 0.5 ? 'ray' : 'auto', r(), r() < 0.3); } else if (a < 0.76) s.eat(); else if (a < 0.78 && s.phase === 'day') s.endDay(); else if (a < 0.8 && s.stairs.length) { const st = s.stairs[Math.floor(r() * s.stairs.length)]; s.move(st.bx - p.x, st.bz - p.z, dt); }
    if (r() < 0.02) p.hp = Math.min(cfg.player.hp, p.hp + 40); s.step(dt); ticks++; monitor(s, cfg, ctx); }
  if (!s.done) hit('a night that never ends', ctx); nights++; }
for (const skill of ['novice', 'average', 'expert', 'stacker', 'averageC']) for (let ring = 0; ring < 5; ring++) for (const house of [0, 3, 5]) for (let sd = 1; sd <= N; sd++) botNight(CONFIG, ring, house, sd * 17 + ring, SKILLS[skill], `bot ${skill} ring ${ring + 1} house ${house} seed ${sd}`);
{ const save = B.newSave(CONFIG, 5); Object.assign(save.up, { panel: 3, turbine: 3, energy: 3, slots: 2 }); const c0 = B.makeCfg(CONFIG, save); for (let ring = 0; ring < 5; ring++) for (let sd = 1; sd <= N; sd++) botNight(c0, ring, 2, sd * 31, SKILLS.average, `bot upgraded ring ${ring + 1} seed ${sd}`); }
for (let ring = 0; ring < 5; ring++) for (const house of [0, 2, 5]) for (let sd = 1; sd <= N * 3; sd++) chaosNight(CONFIG, ring, house, sd * 101 + house, `chaos ring ${ring + 1} house ${house} seed ${sd}`);
const names = Object.keys(bad); for (const k of names) console.log('INVARIANT ' + k + ': ' + bad[k].n + ' times, first: ' + bad[k].ex);
console.log((names.length ? 'FAIL ' : 'PASS ') + nights + ' nights, ' + ticks + ' ticks, ' + names.length + ' rules broken' + (MUT ? ' (mutation run: at least one must be broken)' : ''));
