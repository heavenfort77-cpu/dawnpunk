// Night pressure probe (Nov 23, balance Fault B). Fresh saves (no research), per ring 1-4, the six street houses x 10 seeds.
// Per bot: win %, and on WON nights only: nearest a Gloom came to you inside (m), most Gloom inside at once, panels lost, and the share of all nights where you were hurt at all.
// Env (measuring only): P = profiles (comma list; 'learned' = average aim, 2 turbines, every opening panelled, 6 lances), R = rings [0-based JSON], CM = ring.countMult JSON, G = CONFIG.gloom overrides JSON (e.g. {"waveSpread":20,"waveGrowth":0}).
// Usage: node tools/nightpressure.mjs
import { runBot, SKILLS } from '../src/bots.js'; import { CONFIG } from '../src/config.js';
const LEARN = ['turbine', 'turbine', 'panel', 'panel', 'lance', 'panel', 'panel', 'lance', 'lance', 'panel', 'panel', 'lance', 'lance', 'lance', 'panel'];
SKILLS.learned = { ...SKILLS.average, startAt: 1, gap: 1, reserve: 4, build: LEARN };
const cm = JSON.parse(process.env.CM || 'null') || CONFIG.ring.countMult, cfg = { ...CONFIG, gloom: { ...CONFIG.gloom, ...JSON.parse(process.env.G || '{}') }, ring: { ...CONFIG.ring, countMult: cm } };
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : NaN);
for (const prof of (process.env.P || 'novice,average,expert,learned').split(',')) { const out = [];
  for (const ring of JSON.parse(process.env.R || '[0,1,2,3]')) { let w = 0, n = 0; const near = [], ins = [], lost = [], dm = [];
    for (let h = 0; h < 6; h++) for (let sd = 1; sd <= 10; sd++) { let close = 99, mi = 0, pl = 0, d = 0, lh = null, prevP = new Set(); const k = SKILLS[prof];
      SKILLS[prof] = { ...k, probe: (s) => { const p = s.player; for (const g of s.gloom) if (g.phase === 'inside' && g.floor === p.floor) close = Math.min(close, Math.hypot(g.x - p.x, g.z - p.z));
        mi = Math.max(mi, s.gloom.filter((g) => g.phase === 'inside').length); const cur = new Set(s.breaches.filter((b) => b.panel && b.panel.hp > 0).map((b) => b.i)); for (const i of prevP) if (!cur.has(i)) pl++; prevP = cur;
        if (lh !== null && p.hp < lh) d += lh - p.hp; lh = p.hp; } };
      const s = runBot(prof, cfg, ring, h, sd * 97 + h); SKILLS[prof] = k; n++; if (s.win) { w++; near.push(close); ins.push(mi); lost.push(pl); } dm.push(d > 0 ? 1 : 0); }
    out.push(`r${ring + 1} win ${String(Math.round(100 * w / n)).padStart(3)}% | wins: nearest ${med(near).toFixed(1)} m, most inside ${med(ins)}, panels lost ${med(lost)}, hurt ${Math.round(100 * dm.reduce((a, b) => a + b) / n)}%`); }
  console.log(prof.padEnd(8), JSON.stringify(cm), '\n   ' + out.join('\n   ')); }
