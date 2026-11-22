// Loot probe (owner Nov 22: "loot that don't disappear in the daytime map"): every crate of every street house, many seeds, every ring, must be one the
// player can pick up: some spot on its floor the player can stand on (inside the walls, outside every piece of furniture, not on a stair or ladder spot that
// moves them to another floor) lies within the pickup reach (CONFIG.day.crateRadius). Also: no crate inside furniture; no two crates on one spot.
// Then a walk test: the player is put on each standable spot nearest the crate and the sim is stepped; the crate must be taken.
// Usage: node tools/lootprobe.mjs [seeds]. Prints PASS/FAIL lines and LOOTPROBE <n> PASS, <m> FAIL. Exit 1 on any FAIL.
import { CONFIG } from '../src/config.js';
import * as R from '../src/run.js';
const SEEDS = +(process.argv[2] || 40), RINGS = CONFIG.ring.mult.length;
const viol = new Map(); const bad = (k, ok, ex) => { if (ok) return; const v = viol.get(k) || { n: 0, ex }; v.n++; viol.set(k, v); };
let crates = 0, houses = 0;
for (let ring = 0; ring < RINGS; ring++) for (let seed = 1; seed <= SEEDS; seed++) {
  const run = R.createRun(CONFIG, ring, seed * 7919, {});
  for (const h of run.houses) { houses++; const s = h.sim, HB = s.H - 0.3, P = s.player, ZR = CONFIG.player && CONFIG.player.stairZone || 0.9;
    for (const c of s.crates) { crates++; const tag = 'ring ' + ring + ' seed ' + seed + ' house ' + h.i + ' crate ' + c.id + ' floor ' + c.floor + ' at ' + c.x.toFixed(2) + ',' + c.z.toFixed(2);
      const inF = s.furn.find((q) => q.floor === c.floor && Math.hypot(q.x - c.x, q.z - c.z) < q.r); bad('L1 crate not inside furniture', !inF, tag + (inF ? ' in ' + inF.kind : ''));
      // standable spots on a 5 cm grid within reach
      const R0 = CONFIG.day.crateRadius; let stand = null;
      for (let dx = -R0; dx <= R0 && !stand; dx += 0.05) for (let dz = -R0; dz <= R0 && !stand; dz += 0.05) { const x = c.x + dx, z = c.z + dz; if (Math.hypot(dx, dz) > R0 - 0.01 || Math.abs(x) > HB || Math.abs(z) > HB) continue;
        if (s.furn.some((q) => q.floor === c.floor && Math.hypot(q.x - x, q.z - z) < q.r + 0.3)) continue; stand = [x, z]; }
      bad('L2 a spot within reach that the player can stand on', !!stand, tag);
      bad('L3 crates apart', !s.crates.some((o) => o !== c && o.floor === c.floor && Math.hypot(o.x - c.x, o.z - c.z) < 0.3), tag);
    }
    // walk test: a fresh copy of this house's day, the player put next to each crate in turn on its floor, the day stepped: the crate is taken
    const s2 = R.enter(run, h.i); if (!s2 || s2.phase !== 'day') continue;
    for (const c of s2.crates) { if (c.got) continue; const p = s2.player; p.floor = c.floor; p.climb = null; p.stairCd = 9; p.ladderCd = 9; p.x = c.x; p.z = c.z; s2.move(1e-3, 0, 0.001); s2.step(CONFIG.night.dt);
      bad('L4 standing at the crate takes it (after the walls and furniture push the player out)', c.got, 'ring ' + ring + ' seed ' + seed + ' house ' + h.i + ' crate ' + c.id + ' floor ' + c.floor + ' at ' + c.x.toFixed(2) + ',' + c.z.toFixed(2) + ' player pushed to ' + p.x.toFixed(2) + ',' + p.z.toFixed(2)); }
  }
}
const all = ['L1 crate not inside furniture', 'L2 a spot within reach that the player can stand on', 'L3 crates apart', 'L4 standing at the crate takes it (after the walls and furniture push the player out)']; let f = 0;
for (const k of all) { const v = viol.get(k); if (v) { f++; console.log('FAIL ' + k + ': ' + v.n + ' x ' + v.ex); } else console.log('PASS ' + k); }
console.log('checked ' + crates + ' crates in ' + houses + ' houses'); console.log('LOOTPROBE ' + (all.length - f) + ' PASS, ' + f + ' FAIL'); process.exit(f ? 1 : 0);
