// Strategy suite (Nov 24, owner: "a fix that this wall bot is not the only solution"). Bots only; no human has played these numbers.
// Distinct ways to hold a house, each played by tools/wallbot.mjs at one aim level; the night is the same for every strategy (same seeds).
//   turtle: back to a wall, 2 turbines beside, lances in front (the owner's wall bot)
//   spread: stands in the centre, 2 turbines beside, lances 1 m inside the ground-floor openings
//   traps:  centre, 2 turbines, mines and shards 1 m inside the openings, shoots what comes close
//   panels: wall, 2 turbines, walks to put a panel on each open ground-floor opening when the Sun covers it
//   flask:  wall, 2 turbines, throws a flask at anything inside within 4 m
//   gunner: wall, turbine + moon (two Sun makers), nothing else: the player's own aim
// Usage: node tools/strategysuite.mjs [seeds] [skill list]   env: overrides as in tools/turretprobe.mjs are not applied here; pass a cfg via suite(cfg)
import { CONFIG } from '../src/config.js'; import { wallNight } from './wallbot.mjs';
export const STRATS = { turtle: { DEV: 'lance' }, spread: { DEV: 'lance', SPOT: 'centre', PLACE: 'openings' }, traps: { DEV: 'mine+shard', SPOT: 'centre', PLACE: 'openings' }, panels: { DEV: 'panel' }, flask: { DEV: 'flask' }, gunner: { DEV: 'moon' } };
const KEYS = ['DEV', 'SPOT', 'PLACE', 'SKILL', 'TPOS', 'BUILD'];
export function suite(cfg = CONFIG, seeds = 6, skills = ['novice', 'average', 'expert'], strats = Object.keys(STRATS), tough = false) {
  const rows = [];
  for (const sk of skills) for (const st of strats) { const r = { sk, st, win: [], hurt: [] };
    for (let ring = 0; ring < 5; ring++) { let w = 0, h = 0, n = 0;
      for (const k of KEYS) delete process.env[k]; Object.assign(process.env, STRATS[st], { SKILL: sk });
      for (let hs = 0; hs < 6; hs++) for (let sd = 1; sd <= seeds; sd++) { const x = wallNight(cfg, ring, hs, sd * 97 + hs, tough ? (cfg.tough.hp[ring] || 1) : 1); n++; if (x.win) w++; if (x.dmg > 0) h++; }
      r.win.push(Math.round(100 * w / n)); r.hurt.push(Math.round(100 * h / n)); }
    for (const k of KEYS) delete process.env[k]; rows.push(r); }
  return rows;
}
export const show = (rows, title) => { console.log(title + ' | win% / hurt% per ring 1..5'); for (const r of rows) console.log(`${r.sk.padEnd(8)} ${r.st.padEnd(7)} ` + r.win.map((w, i) => `${String(w).padStart(3)}/${String(r.hurt[i]).padStart(3)}`).join('  ')); };
if (import.meta.url === 'file://' + process.argv[1]) show(suite(CONFIG, +process.argv[2] || 6, (process.argv[3] || 'novice,average,expert').split(',')), 'as released');
