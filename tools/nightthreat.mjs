// Night threat probe (Nov 23, balance Fault B: "the other nights were too easy once I knew how to build the defenses").
// Whole saves (as tools/balanceprobe.mjs): every day the bot takes the highest ring open, holds a house, banks the night, researches.
// Profiles: the src/bots.js players with their short build lists, and LEARNED: a player who has figured out building
// (two turbines, every ground opening panelled, six lances, broken panels re-placed all night) at three aim levels.
// Per night it reports: win %, median damage taken (health lost, before healing), median lowest health, median food eaten.
// Usage: node tools/nightthreat.mjs [saves] [house]   (house: 0 = biggest of the street ... 5 = smallest; mix = seed picks)
// ATT=step,cap (measuring only, not in the game): "Gloom attention" prototype, tonight's count x (1 + step x level); a win with no damage +1 (up to cap), a win with damage -1, a loss resets to 0
import { runBot, SKILLS } from '../src/bots.js'; import { CONFIG } from '../src/config.js'; import * as B from '../src/base.js';
const N = +process.argv[2] || 30, HOUSE = process.argv[3] || 'mix', NIGHTS = +(process.env.NIGHTS || 6);
const LEARN = ['turbine', 'turbine', 'panel', 'panel', 'lance', 'panel', 'panel', 'lance', 'lance', 'panel', 'panel', 'lance', 'lance', 'lance', 'panel'];
for (const a of ['novice', 'average', 'expert']) SKILLS['learned_' + a] = { ...SKILLS[a], startAt: 1, gap: 1, reserve: 4, build: LEARN };
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pad = (v, w = 4) => String(v).padStart(w);
export function campaign(profile, n = N, house = HOUSE, nights = NIGHTS, cfgIn = CONFIG) {
  const rows = Array.from({ length: nights }, () => ({ win: 0, dmg: [], low: [], ate: [], ring: [] }));
  const [aStep, aCap] = (process.env.ATT || '0,0').split(',').map(Number); // scratch: attention prototype (count x 1 + step x level; clean win +1, loss -1)
  for (let sd = 1; sd <= n; sd++) { const save = B.newSave(cfgIn, sd * 7919); let att = 0;
    for (let d = 1; d <= nights; d++) { if (!save.project) for (const k of ['energy', 'panel', 'turbine']) { if (B.startResearch(cfgIn, save, k).ok) break; } B.helpResearch(cfgIn, save);
      const ring = (save.ringOpen || 1) - 1, c0 = B.makeCfg(cfgIn, save), cfg = { ...c0, ring: { ...c0.ring, countMult: c0.ring.countMult.map((x) => x * (1 + aStep * att)) }, day: { ...c0.day, startEnergy: c0.day.startEnergy + B.nightEnergyBonus(cfgIn, save) } };
      let dmg = 0, low = 100, last = null; const k = SKILLS[profile];
      SKILLS[profile] = { ...k, probe: (s) => { const h = s.player.hp; if (last !== null && h < last) dmg += last - h; last = h; if (h < low) low = h; } };
      const hs = house === 'mix' ? (sd + d) % 6 : +house, s = runBot(profile, cfg, ring, hs, sd * 131 + d); SKILLS[profile] = k;
      const r = rows[d - 1]; if (s.win) r.win++; r.dmg.push(Math.round(dmg)); r.low.push(Math.max(0, Math.round(low))); r.ate.push(s.eaten || 0); r.ring.push(ring + 1);
      if (aStep) att = !s.win ? 0 : dmg < 1 ? Math.min(aCap, att + 1) : Math.max(0, att - 1);
      B.applyNight(cfgIn, save, { ...s.result, ring }, s.killed || 0); } }
  return rows.map((r) => ({ win: Math.round(100 * r.win / n), dmg: med(r.dmg), low: med(r.low), ate: med(r.ate), ring: med(r.ring) }));
}
if (import.meta.url === 'file://' + process.argv[1]) {
  console.log(`saves ${N}, house ${HOUSE}, nights 1-${NIGHTS}. Columns per night: win% / damage taken / lowest health / food eaten (medians)`);
  for (const p of ['novice', 'average', 'expert', 'learned_novice', 'learned_average', 'learned_expert']) {
    const rs = campaign(p); console.log(p.padEnd(16), '| ring', rs.map((r) => r.ring).join(' '), '|', rs.map((r) => `${pad(r.win)}/${pad(r.dmg)}/${pad(r.low, 3)}/${r.ate}`).join('  '));
  }
}
