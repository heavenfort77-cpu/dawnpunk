// Boss night vs the same ring-5 night without the boss, per strategy (tools/strategysuite.mjs) and house, win / hit %; "!" = the boss night is not harder. Measuring only. Usage: node tools/bosshard.mjs
import { CONFIG } from '../src/config.js'; import { wallNight } from './wallbot.mjs'; import { STRATS } from './strategysuite.mjs';
const ring = CONFIG.boss.ring, M = 24, NB = { ...CONFIG, boss: { ...CONFIG.boss, on: false } }, EK = ['DEV', 'SPOT', 'PLACE', 'BOSS', 'SKILL'];
const one = (cfg, st, sk, mode, h) => { for (const k of EK) delete process.env[k]; Object.assign(process.env, STRATS[st], { SKILL: sk, BOSS: mode }); let w = 0, hu = 0; for (let i = 1; i <= M; i++) { const x = wallNight(cfg, ring, h, i * 97 + h); if (x.win) w++; if (x.dmg > 0) hu++; } return [Math.round(100 * w / M), Math.round(100 * hu / M)]; };
for (const sk of ['average', 'expert']) for (const [st, mode] of [['turtle', 'no'], ['spread', 'no'], ['traps', 'no'], ['traps', 'hunt'], ['gunner', 'no'], ['gunner', 'hunt'], ['panels', 'no'], ['flask', 'no']]) {
  const o = []; for (const h of [5, 3, 0]) { const b = one(CONFIG, st, sk, mode, h), n = one(NB, st, sk, mode, h); o.push(`h${h} boss ${b[0]}/${b[1]} plain ${n[0]}/${n[1]}${b[0] < n[0] || (b[0] === n[0] && (b[0] === 0 || b[1] > n[1])) ? '' : ' !'}`); }
  console.log(sk.padEnd(8), (st + (mode === 'hunt' ? '+hunt' : '')).padEnd(12), o.join(' | ')); }
