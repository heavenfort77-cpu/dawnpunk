// Campaign suite (Nov 24, owner: "panel decide a version that suits all 5 rings without increasing frame rate"). Bots only; no human has played these numbers.
// Each save plays NIGHTS nights with one strategy (tools/strategysuite.mjs) at one aim: the highest open ring each night, a win opens the next ring (ring 5 = boss, replayed after a win),
// the house changes by seed and night. No base research (a fresh player's power). CONFIG.tough applies from the second night with its catch-up (a lost night: old health next try).
// Default: the game's CONFIG.attention as the adapt knobs (A='{}' = without it). Optional version knobs (measuring only), env A = JSON:
//   adapt: { hp, dmg, max, clean, down, hitDown, streak }  per-night level L: streak won nights in a row with damage taken < clean -> L+1 (up to max); a won night with more damage -> L-hitDown; a lost night -> L-down (min 0); machines' health x (1 + hp L), damage x (1 + dmg L)
//   hard:  { hp, dmg }  a fixed extra (a player-chosen harder setting)
// Prints per aim: per ring, win % / hit % over all nights played at that ring (n nights), the median night of the first boss win, and the final level.
import { CONFIG } from '../src/config.js'; import { wallNight } from './wallbot.mjs'; import { STRATS, EXPLOITS } from './strategysuite.mjs';
const KEYS = ['DEV', 'SPOT', 'PLACE', 'SKILL', 'TPOS', 'BUILD', 'CLOSE', 'COVERHIT', 'FORT', 'BOSS'];
export function campaign(cfg, strat, skill, saves, nights, V = {}) {
  const ring = Array.from({ length: 5 }, () => ({ n: 0, w: 0, h: 0 })), firstBoss = [], finalL = [];
  for (const k of KEYS) delete process.env[k]; Object.assign(process.env, STRATS[strat] || EXPLOITS[strat], { SKILL: skill });
  for (let sv = 1; sv <= saves; sv++) { let open = 0, lossRun = 0, L = 0, fb = null, streak = 0;
    for (let nt = 0; nt < nights; nt++) { const r = open, a = V.adapt, hd = V.hard || {};
      const hpM = (nt === 0 ? 1 : 1 + ((cfg.tough.hp[r] || 1) - 1) * Math.pow(cfg.tough.ease, lossRun)) * (1 + (a ? a.hp * L : 0)) * (1 + (hd.hp || 0));
      const dmgM = (1 + (a ? a.dmg * L : 0)) * (1 + (hd.dmg || 0)), c = dmgM === 1 ? cfg : { ...cfg, gloom: { ...cfg.gloom, dmg: cfg.gloom.dmg * dmgM } };
      const x = wallNight(c, r, (sv * 7 + nt * 3) % 6, sv * 1009 + nt * 131, hpM);
      ring[r].n++; if (x.win) ring[r].w++; if (x.dmg > 0) ring[r].h++;
      if (x.win) { lossRun = 0; if (r === 4 && fb === null) fb = nt + 1; open = Math.min(4, open + 1); if (a && x.dmg < a.clean) { if (++streak >= (a.streak || 1)) { L = Math.min(a.max, L + 1); streak = 0; } } else if (a) { streak = 0; if (a.hitDown) L = Math.max(0, L - a.hitDown); } }
      else { lossRun++; if (a) { streak = 0; L = Math.max(0, L - a.down); } } }
    firstBoss.push(fb === null ? 99 : fb); finalL.push(L); }
  for (const k of KEYS) delete process.env[k];
  const med = (q) => q.slice().sort((x, y) => x - y)[q.length >> 1];
  return { ring: ring.map((q) => (q.n ? { win: Math.round(100 * q.w / q.n), hit: Math.round(100 * q.h / q.n), n: q.n } : null)), boss: med(firstBoss), L: med(finalL) };
}
export function table(cfg, V, strats, skills, saves = 16, nights = 10, title = '') {
  console.log(`${title} | per ring: win/hit % (nights played) | first boss win: median night (99 = none in ${nights}) | final level`);
  for (const sk of skills) for (const st of strats) { const r = campaign(cfg, st, sk, saves, nights, V);
    console.log(`${sk.padEnd(8)} ${st.padEnd(11)} ` + r.ring.map((q) => (q ? `${String(q.win).padStart(3)}/${String(q.hit).padStart(3)} (${String(q.n).padStart(3)})` : '      -      ')).join(' ') + `  boss@${r.boss}  L${r.L}`); }
}
if (import.meta.url === 'file://' + process.argv[1]) table(CONFIG, process.env.A ? JSON.parse(process.env.A) : { adapt: CONFIG.attention }, (process.argv[3] || 'turtle,spread,traps,panels,flask,gunner,fort,prismgunner').split(','), (process.argv[2] || 'novice,average,expert').split(','), +(process.env.SAVES || 16), +(process.env.NIGHTS || 10), process.env.A || 'this build');
