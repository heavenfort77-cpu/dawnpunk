// Bug probe, logic layer (Nov 21): the game's pure modules (src/sim.js night and day, src/run.js street, src/base.js save and base economy) driven by
// random play under always-true rules (invariants), in Node, no browser. Bug classes from the published game-bug taxonomies (Lewis et al. 2010,
// Truelove et al. 2021, Butt et al. 2023): crash after action, invalid value change, object out of bounds, player stuck / unwinnable (a night or day
// that never ends), repeated-action inconsistency (caps), incorrect reward, save corruption, frame-rate dependence (temporal).
// Usage: node tools/bugprobe_logic.mjs [seeds]   (default 24 seeds per ring and house)
//        node tools/bugprobe_logic.mjs --selftest   plants one fault per monitor and prints PASS when every monitor fires (mutation check)
// Prints 'PASS <probe>' or 'FAIL <probe>: <count> x <first example>' per probe, then 'BUGPROBE_LOGIC <n> PASS, <m> FAIL'. Exit 1 on any FAIL.
import { CONFIG } from '../src/config.js';
import { createSim } from '../src/sim.js';
import * as R from '../src/run.js';
import * as B from '../src/base.js';

const SELF = process.argv.includes('--selftest');
const SEEDS = +(process.argv.find((a) => /^\d+$/.test(a)) || 24);
const RINGS = CONFIG.ring.mult.length, HOUSES = CONFIG.ring.bpBase.length;
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const viol = new Map();
const bad = (probe, ok, ex) => { if (ok) return; const v = viol.get(probe) || { n: 0, ex }; v.n++; viol.set(probe, v); };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// selftest: one planted fault per monitor; the run must report every one of them
const PLANT = SELF ? { nan: 1, bounds: 1, cap: 1, stuck: 1, after: 1, save: 1, dt: 1, run: 1 } : {};

// ---------- the sim monitor: every rule checked after every step ----------
function checkSim(s, tag) {
  const p = s.player, c = s.cfg, HB = s.H - 0.3 + 1e-6;
  bad('S1 values finite', [p.x, p.z, p.hp, p.energy, s.food, s.ess, s.t].every(fin) && s.gloom.every((g) => [g.x, g.z, g.hp].every(fin)) && s.devices.every((d) => [d.x, d.z, d.hp].every(fin)), tag + ' player ' + JSON.stringify({ x: p.x, z: p.z, hp: p.hp, e: p.energy, food: s.food, ess: s.ess }));
  bad('S2 health in 0..max', p.hp >= 0 && p.hp <= c.player.hp + 1e-9, tag + ' hp ' + p.hp);
  bad('S3 energy in 0..cap', p.energy >= -1e-9 && p.energy <= c.player.energyCap + 1e-9, tag + ' energy ' + p.energy);
  bad('S4 food and essentials not negative', s.food >= 0 && s.ess >= 0, tag + ' food ' + s.food + ' ess ' + s.ess);
  bad('S5 player inside the house', p.climb || (Math.abs(p.x) <= HB && Math.abs(p.z) <= HB), tag + ' player at ' + p.x.toFixed(2) + ',' + p.z.toFixed(2) + ' half-size ' + (s.H - 0.3).toFixed(2));
  bad('S6 floors valid', Number.isInteger(p.floor) && p.floor >= 0 && p.floor < s.L && s.gloom.every((g) => Number.isInteger(g.floor) && g.floor >= 0 && g.floor < s.L), tag + ' floor ' + p.floor + ' of ' + s.L);
  bad('S7 machines inside stay inside', s.gloom.every((g) => g.phase !== 'inside' || g.climb || (Math.abs(g.x) <= s.H + 0.5 && Math.abs(g.z) <= s.H + 0.5)), tag + ' ' + JSON.stringify(s.gloom.filter((g) => g.phase === 'inside' && !g.climb && (Math.abs(g.x) > s.H + 0.5 || Math.abs(g.z) > s.H + 0.5)).map((g) => [g.kind, +g.x.toFixed(2), +g.z.toFixed(2)])[0]));
  bad('S8 machine health in 0..max', s.gloom.every((g) => g.hp <= g.maxhp + 1e-6), tag);
  const per = {}; for (const d of s.devices) per[d.kind] = (per[d.kind] || 0) + 1;
  bad('S9 device caps hold', Object.entries(per).every(([k, n]) => !c.devices[k].max || n <= c.devices[k].max) && Object.entries(c.groupMax || {}).every(([g, m]) => s.devices.filter((d) => c.devices[d.kind].group === g).length <= m), tag + ' ' + JSON.stringify(per));
}
const snap = (s) => JSON.stringify({ p: s.player, g: s.gloom.map((g) => [g.x, g.z, g.hp]), d: s.devices.map((d) => [d.hp]), f: s.food, e: s.ess, t: s.t, r: s.result });

// random play: a held direction, walks to markers (stairs, ladders, openings), shots, every device kind at random spots, eating, extra machines
function play(s, r, dt0, tag, idle) {
  const kinds = Object.keys(s.cfg.devices); let dir = [0, 0], hold = 0, goal = null, steps = 0;
  const cap = (s.phase === 'day' ? s.cfg.day.duration : 0) + s.cfg.night.duration + (s.boss ? 400 : 30);
  let tDay = 0;
  while (!s.done && steps < 200000) {
    const dt = dt0 || (r() < 0.8 ? 0.05 : 0.001 + r() * 0.05);
    if (!idle) {
      if (hold <= 0) { const a = r() * 6.283; dir = r() < 0.15 ? [0, 0] : [Math.cos(a), Math.sin(a)]; hold = 0.3 + r() * 2; if (r() < 0.25) { const pool = [...s.stairs.map((q) => ({ x: q.bx, z: q.bz })), ...s.stairs.map((q) => ({ x: q.tx, z: q.tz })), ...s.ladders, ...s.breaches.map((b) => ({ x: b.inX, z: b.inZ }))]; goal = pool[Math.floor(r() * pool.length)]; } else goal = null; }
      hold -= dt;
      if (goal) s.move(goal.x - s.player.x, goal.z - s.player.z, dt); else s.move(dir[0], dir[1], dt);
      if (r() < 0.08) s.fireCannon(r() < 0.5 ? 'auto' : 'ray', r(), r() < 0.2);
      if (r() < 0.02) { const k = kinds[Math.floor(r() * kinds.length)]; const o = r() < 0.5 ? {} : { x: (r() * 2 - 1) * (s.H + 2), z: (r() * 2 - 1) * (s.H + 2), bp: Math.floor(r() * s.breaches.length) }; s.place(k, o); }
      if (r() < 0.01) s.eat();
      if (r() < 0.002 && s.phase !== 'day') s.addGloom(1);
      if (s.phase === 'day' && r() < 0.001) s.endDay();
      s.player.yaw = r() * 6.283;
    }
    const wasDay = s.phase === 'day'; s.step(dt); steps++; if (wasDay) tDay += dt;
    if (PLANT.nan && steps === 50) { s.player.energy = NaN; PLANT.nan = 0; }
    if (PLANT.bounds && steps === 60) { s.player.x = s.H + 3; PLANT.bounds = 0; }
    if (PLANT.cap && steps === 70) { for (let i = 0; i < 9; i++) s.devices.push({ kind: 'collector', x: 0, z: 0, hp: 1, floor: 0 }); PLANT.cap = 0; }
    checkSim(s, tag + ' t=' + s.t.toFixed(2));
    if (s.t > cap) break;
  }
  if (PLANT.stuck) { s.done = false; PLANT.stuck = 0; }
  bad('S10 every night and day ends (no soft-lock)', s.done, tag + ' still running at night t=' + s.t.toFixed(1) + ' s, day ' + tDay.toFixed(1) + ' s, phase ' + s.phase + ', ' + s.gloom.length + ' machines, ' + (s.boss ? 'boss night' : ''));
  if (s.done) {
    const r0 = s.result || {};
    bad('S11 night result finite and not negative', ['food', 'essentials'].every((k) => fin(r0[k]) && r0[k] >= 0) && (r0.lasted === undefined || fin(r0.lasted)), tag + ' result ' + JSON.stringify(r0));
    // the calls main.js can still make after the end (doFire, doPlace, doEat check only that a sim exists); sim.move is not one: main.js calls it only while !sim.done
    const a = snap(s); for (let i = 0; i < 20; i++) s.step(0.05); s.fireCannon('auto', 1); s.eat(); for (const k of kinds) s.place(k, {});
    if (PLANT.after) { s.player.hp -= 1; PLANT.after = 0; }
    bad('S12 nothing changes after the night is over', snap(s) === a, tag);
  }
  return s;
}

let sims = 0;
function simFuzz() {
  for (let ring = 0; ring < RINGS; ring++) for (let house = 0; house < HOUSES; house++) for (let k = 0; k < SEEDS; k++) {
    const seed = 1000 + k * 7919 + ring * 31 + house, r = mulberry(seed ^ 0x5eed);
    for (const mode of ['night', 'day', 'idle', 'hitch']) {
      const day = mode === 'day' || (mode === 'idle' && k % 2 === 1);
      const tag = `ring ${ring + 1} house ${house} seed ${seed} ${mode}`;
      let s; try { s = createSim({ cfg: CONFIG, ring, house, seed, day, furniture: true, hand: day, boss: ring === CONFIG.boss.ring && k % 3 === 0 ? true : false }); }
      catch (e) { bad('S0 no crash', false, tag + ' createSim: ' + String(e && e.message)); continue; }
      try { play(s, r, mode === 'hitch' ? CONFIG.lag.dtMax : mode === 'idle' ? 1 / 60 : 0, tag, mode === 'idle'); }
      catch (e) { bad('S0 no crash', false, tag + ' t=' + (s.t || 0).toFixed(2) + ': ' + String(e && e.stack).split('\n').slice(0, 2).join(' | ')); }
      sims++;
      if (SELF && sims > 3) return;
    }
  }
}

// ---------- frame-rate independence: the same idle night at 30, 60 and 144 frames a second ----------
function dtProbe() {
  const out = [];
  for (const [ring, house] of [[0, 0], [1, 3], [2, 5], [3, 1]]) for (let k = 0; k < 4; k++) {
    const seed = 500 + k, res = [];
    for (const fps of [30, 60, 144]) {
      // wall: real seconds passed at this frame rate; the planted fault runs the game 1.5x fast at 144 fps (a per-frame step that ignores dt)
      const s = createSim({ cfg: CONFIG, ring, house, seed, boss: false }); let firstHurt = null, wall = 0; const dt = 1 / fps, gdt = PLANT.dt && fps === 144 ? dt * 1.5 : dt;
      while (!s.done && wall < 90) { const hp = s.player.hp; s.step(gdt); wall += dt; if (firstHurt === null && s.player.hp < hp) firstHurt = wall; }
      res.push({ fps, firstHurt, hp: s.player.hp, t: s.t, done: s.done });
    }
    if (PLANT.dt) PLANT.dt = 0;
    const fh = res.map((q) => q.firstHurt).filter((v) => v !== null), hurt = res.map((q) => 100 - q.hp);
    const spreadHurt = fh.length === 3 ? Math.max(...fh) - Math.min(...fh) : (fh.length ? 99 : 0), spreadDmg = Math.max(...hurt) - Math.min(...hurt), ref = Math.max(1, ...hurt);
    out.push(`ring ${ring + 1} house ${house} seed ${seed}: first hit at ` + res.map((q) => q.fps + 'fps ' + (q.firstHurt === null ? '-' : q.firstHurt.toFixed(2) + 's')).join(', ') + '; health lost by 90 s ' + hurt.map((v) => v.toFixed(0)).join('/'));
    bad('T1 same night at 30, 60 and 144 fps', spreadHurt <= 0.25 && (spreadDmg <= 0.1 * ref + 1 || res.some((q) => q.done)), out[out.length - 1]);
  }
  return out;
}

// ---------- the street (src/run.js) ----------
function runFuzz() {
  for (let ring = 0; ring < RINGS; ring++) for (let k = 0; k < SEEDS; k++) {
    const seed = 77 + k * 13 + ring, r = mulberry(seed), tag = `street ring ${ring + 1} seed ${seed}`;
    try {
      const run = R.createRun(CONFIG, ring, seed, {}); let ended = false, t = 0;
      while (!ended && t < CONFIG.day.duration + 60) {
        const dt = 0.05; t += dt;
        if (run.inside < 0) {
          const x = run.px + (r() * 2 - 1) * 3, z = run.pz + (r() * 2 - 1) * 3, [px, pz] = R.pushOut(run, x, z); run.px = px; run.pz = pz;
          if (PLANT.run) { run.px = NaN; PLANT.run = 0; }
          bad('R1 street position finite', fin(run.px) && fin(run.pz), tag + ' t=' + t.toFixed(1));
          if (r() < 0.01) { const h = run.houses[Math.floor(r() * run.houses.length)]; R.enter(run, h.i); }
          ended = R.tickTown(run, dt);
        } else {
          const h = run.houses[run.inside]; h.sim.move(r() * 2 - 1, r() * 2 - 1, dt); h.sim.step(dt); checkSim(h.sim, tag + ' inside house ' + run.inside);
          if (r() < 0.02) R.leave(run); else ended = R.tickTown(run, dt);
        }
        bad('R2 street energy in 0..cap', fin(run.energy) && run.energy >= 0 && run.energy <= CONFIG.player.energyCap + 1e-9, tag + ' energy ' + run.energy);
      }
      bad('R3 the day on the street ends', ended, tag);
      const s = R.nightfall(run); bad('R4 nightfall gives a night', s && s.phase === 'night', tag + ' phase ' + (s && s.phase));
      if (SELF) return;
    } catch (e) { bad('R0 no crash on the street', false, tag + ': ' + String(e && e.stack).split('\n').slice(0, 2).join(' | ')); }
  }
}

// ---------- saves: corrupt, old, odd and blocked storage ----------
const store = (raw, mode) => ({ getItem: () => { if (mode === 'get') throw new Error('SecurityError'); return raw; }, setItem: (k, v) => { if (mode === 'set') throw new Error('QuotaExceededError'); raw = v; }, removeItem: () => {}, get raw() { return raw; } });
function deepNums(o, path = 'save', out = []) { if (o === null || o === undefined) return out; if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(path + '=' + o); return out; } if (typeof o === 'string') { if (/\bundefined\b|\bNaN\b|\[object/.test(o)) out.push(path + '="' + o.slice(0, 40) + '"'); return out; } if (typeof o === 'object') for (const k of Object.keys(o)) deepNums(o[k], path + '.' + k, out); return out; }
function useSave(sv, tag) {
  // the base ops a player's visit and a night run on the loaded save; none may throw, and nothing may turn into NaN, Infinity or "undefined"
  const cfgN = B.makeCfg(CONFIG, sv); const lo = B.loadout(CONFIG, sv);
  const nums = [B.gloomMult(CONFIG, sv), B.nightEnergyBonus(CONFIG, sv), B.lootMult(CONFIG, sv), cfgN.devices.panel.hp, cfgN.devices.turbine.energyPerSec];
  bad('V2 loaded save gives finite night settings', nums.every(fin), tag + ' ' + JSON.stringify(nums));
  bad('V3 loaded save gives a full loadout', lo.length === B.slots(CONFIG, sv) && lo.every((k) => typeof k === 'string' && CONFIG.devices[k]), tag + ' ' + JSON.stringify(lo));
  const txt = [...B.journalLines(CONFIG, sv), B.scoutLine(sv), B.recruitLine(CONFIG, sv.food), ...B.marlaJournal(sv)].join('\n');
  bad('V4 base text has no undefined/NaN', !/\bundefined\b|\bNaN\b|\[object|null\b/.test(txt), tag + ' ' + (txt.match(/.{0,40}(undefined|NaN|\[object|null).{0,20}/) || [''])[0]);
  for (const k of Object.keys(CONFIG.base.upgrades)) B.startResearch(CONFIG, sv, k);
  B.helpResearch(CONFIG, sv); B.recruit(CONFIG, sv);
  const s = createSim({ cfg: cfgN, ring: 0, house: 0, seed: 3, day: true, furniture: true, extraEnergy: B.nightEnergyBonus(CONFIG, sv), gloomMult: B.gloomMult(CONFIG, sv), lootMul: B.lootMult(CONFIG, sv) });
  s.botDay(0.5); let g = 0; while (!s.done && g++ < 5000) s.step(0.1);
  B.applyNight(CONFIG, sv, s.result || { win: false, ring: 0, lasted: 1, food: 1, essentials: 0 }, 3);
  const nb = deepNums(sv); if (PLANT.save) { nb.push('planted'); PLANT.save = 0; }
  bad('V5 save stays finite after a night', nb.length === 0, tag + ' ' + nb.slice(0, 3).join(', '));
  const st = store(null); B.writeSave(sv, st); const back = B.loadSave(CONFIG, st);
  bad('V6 a written save loads back the same', JSON.stringify(back) === JSON.stringify(sv), tag + ' (written save was ' + (back.day === sv.day ? 'changed on load' : 'thrown away and replaced by a new one: progress lost') + ')');
}
function saveFuzz() {
  // a lived-in save: 12 nights of results through the real applyNight
  const base = B.newSave(CONFIG, 4242); { const st = store(null); B.writeSave(base, st); }
  B.makeQuests(CONFIG, base);
  for (let i = 0; i < 12; i++) { const s = createSim({ cfg: B.makeCfg(CONFIG, base), ring: i % RINGS, house: i % HOUSES, seed: 9 + i, day: true }); s.botDay(1); let g = 0; while (!s.done && g++ < 5000) { s.fireCannon('auto', 0.8); s.step(0.1); } B.applyNight(CONFIG, base, s.result, 5); if (i % 3 === 0) B.recruit(CONFIG, base); B.startResearch(CONFIG, base, Object.keys(CONFIG.base.upgrades)[i % 4]); }
  try { useSave(JSON.parse(JSON.stringify(base)), 'lived-in save'); } catch (e) { bad('V0 no crash on a save', false, 'lived-in save: ' + String(e && e.stack).split('\n').slice(0, 2).join(' | ')); }
  const raw = JSON.stringify(base), r = mulberry(31337);
  const keys = []; (function walk(o, p) { for (const k of Object.keys(o)) { keys.push([...p, k]); if (o[k] && typeof o[k] === 'object') walk(o[k], [...p, k]); } })(base, []);
  const VALS = [undefined, null, '', '7', 'abc', -5, 1e12, 0.5, [], {}, true];
  const cases = [['truncated', raw.slice(0, raw.length >> 1)], ['garbage', '{{not json'], ['empty object', '{}'], ['old version', JSON.stringify({ ...base, v: 3 })], ['array', '[]'], ['number', '42']];
  for (let i = 0; i < (SELF ? 20 : 1500); i++) {
    const o = JSON.parse(raw), path = keys[Math.floor(r() * keys.length)], val = VALS[Math.floor(r() * VALS.length)];
    let t = o; for (let j = 0; j < path.length - 1; j++) t = t[path[j]]; if (val === undefined) delete t[path[path.length - 1]]; else t[path[path.length - 1]] = val;
    cases.push(['save.' + path.join('.') + ' = ' + JSON.stringify(val === undefined ? '(missing)' : val), JSON.stringify(o)]);
  }
  for (const [name, txt] of cases) {
    try {
      const sv = B.loadSave(CONFIG, store(txt)); bad('V1 any stored text loads to a usable save', sv && sv.v === 4 && Array.isArray(sv.personnel) && fin(sv.day), name);
      useSave(sv, name);
    } catch (e) { bad('V0 no crash on a save', false, name + ': ' + String(e && e.message).slice(0, 140)); }
  }
  for (const mode of ['get', 'set']) { try { const sv = B.loadSave(CONFIG, store(raw, mode)); B.writeSave(sv, store(raw, mode)); useSave(sv, 'storage ' + mode + ' blocked'); } catch (e) { bad('V7 blocked storage does not crash', false, mode + ': ' + String(e && e.message)); } }
}

const t0 = Date.now();
simFuzz(); const dtLines = dtProbe(); runFuzz(); saveFuzz();
const PROBES = ['S0 no crash', 'S1 values finite', 'S2 health in 0..max', 'S3 energy in 0..cap', 'S4 food and essentials not negative', 'S5 player inside the house', 'S6 floors valid', 'S7 machines inside stay inside', 'S8 machine health in 0..max', 'S9 device caps hold', 'S10 every night and day ends (no soft-lock)', 'S11 night result finite and not negative', 'S12 nothing changes after the night is over', 'T1 same night at 30, 60 and 144 fps', 'R0 no crash on the street', 'R1 street position finite', 'R2 street energy in 0..cap', 'R3 the day on the street ends', 'R4 nightfall gives a night', 'V0 no crash on a save', 'V1 any stored text loads to a usable save', 'V2 loaded save gives finite night settings', 'V3 loaded save gives a full loadout', 'V4 base text has no undefined/NaN', 'V5 save stays finite after a night', 'V6 a written save loads back the same', 'V7 blocked storage does not crash'];
for (const l of dtLines) console.log('INFO ' + l);
console.log(`INFO ${sims} nights/days fuzzed, ${SEEDS} seeds x ${RINGS} rings x ${HOUSES} houses x 4 modes, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (SELF) {
  const want = ['S1 values finite', 'S5 player inside the house', 'S9 device caps hold', 'S10 every night and day ends (no soft-lock)', 'S12 nothing changes after the night is over', 'V5 save stays finite after a night', 'T1 same night at 30, 60 and 144 fps', 'R1 street position finite'];
  let ok = 0; for (const w of want) { const hit = viol.has(w); console.log((hit ? 'PASS selftest fires: ' : 'FAIL selftest silent: ') + w); if (hit) ok++; }
  console.log(`BUGPROBE_SELFTEST ${ok} of ${want.length}`); process.exit(ok === want.length ? 0 : 1);
}
let np = 0, nf = 0;
for (const p of PROBES) { const v = viol.get(p); if (v) { nf++; console.log(`FAIL ${p}: ${v.n} x ${v.ex}`); } else { np++; console.log('PASS ' + p); } }
console.log(`BUGPROBE_LOGIC ${np} PASS, ${nf} FAIL`); process.exit(nf ? 1 : 0);
