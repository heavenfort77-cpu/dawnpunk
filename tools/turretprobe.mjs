// Turret fairness probe (Nov 24, owner: "Lance, Sling, Twin, Mist are broken with this strategy"). Bots only; no human has played these numbers.
// Panel per ring 1-5 (fresh saves, 6 houses x SEEDS seeds; ring 5 has the boss):
//   wall_<dev>[@skill]: the owner's turtle (tools/wallbot.mjs): 2 turbines + that turret to its cap; dev may be a mix (lance+twin); skill default novice
//   novice / average / expert / stacker: the src/bots.js players (short build lists, panels, shoot at range)
// Env (measuring only): SHOT = x on every turret's shotCost, DMG = x on every turret's damage, RATE = x fire rate, RANGE = m, CAP = most of each kind, TURB = x on turbine Sun, TOUGH=1 (CONFIG.tough), P = profiles.
// Prints win % / hurt % per ring. Usage: node tools/turretprobe.mjs [seeds]
import { CONFIG } from '../src/config.js'; import { runBot, SKILLS } from '../src/bots.js'; import { wallNight } from './wallbot.mjs';
const SEEDS = +process.argv[2] || 8, SHOT = +(process.env.SHOT || 1), DMG = +(process.env.DMG || 1), TURB = +(process.env.TURB || 1);
const dv = { ...CONFIG.devices }; for (const k of ['lance', 'twin', 'sling', 'mist']) dv[k] = { ...dv[k], shotCost: dv[k].shotCost * SHOT, dmg: dv[k].dmg * DMG, rate: dv[k].rate * +(process.env.RATE || 1), range: process.env.RANGE ? +process.env.RANGE : dv[k].range, max: process.env.CAP ? +process.env.CAP : dv[k].max }; dv.turbine = { ...dv.turbine, energyPerSec: dv.turbine.energyPerSec * TURB };
const cfg = { ...CONFIG, devices: dv }, P = (process.env.P || 'wall_lance,wall_sling,wall_twin,wall_mist,novice,average,expert,stacker').split(',');
console.log(`SHOT x${SHOT} DMG x${DMG} TURB x${TURB} RATE x${process.env.RATE || 1} RANGE ${process.env.RANGE || '-'} CAP ${process.env.CAP || '-'}${process.env.TOUGH ? ' TOUGH' : ''} | win% / hurt% per ring 1..5, 6 houses x ${SEEDS} seeds`);
for (const p of P) { const out = [];
  for (let ring = 0; ring < 5; ring++) { let w = 0, h = 0, n = 0; const th = process.env.TOUGH ? (CONFIG.tough.hp[ring] || 1) : 1;
    for (let hs = 0; hs < 6; hs++) for (let sd = 1; sd <= SEEDS; sd++) { const seed = sd * 97 + hs; n++;
      if (p.startsWith('wall_')) { const [dvs, sk] = p.slice(5).split('@'); process.env.DEV = dvs; process.env.SKILL = sk || 'novice'; const r = wallNight(cfg, ring, hs, seed, th); if (r.win) w++; if (r.dmg > 0) h++; }
      else { let d = 0, lh = null; const k = SKILLS[p]; SKILLS[p] = { ...k, probe: (s) => { if (lh !== null && s.player.hp < lh) d += lh - s.player.hp; lh = s.player.hp; } };
        const s = runBot(p, cfg, ring, hs, seed, { toughHp: th }); SKILLS[p] = k; if (s.win) w++; if (d > 0) h++; } }
    out.push(`${String(Math.round(100 * w / n)).padStart(3)}/${String(Math.round(100 * h / n)).padStart(3)}`); }
  console.log(p.padEnd(11), out.join('  ')); }
