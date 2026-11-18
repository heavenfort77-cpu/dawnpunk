// Where the ambient village cats go (owner Nov 17): they stroll along a small network of path points (CONFIG.villageCats.nodes / edges) to a sunny spot, laze there a while
// (loaf, sleep curled, groom, sit, watch the hens or the pond, stretch), and stroll on; a running player close by makes one move off along the paths; at evening they go under the
// coop or indoors. No rendering here (headless-testable: test.js walks them for a long time and checks the HIDDEN LUCKY CAT rule: never within keepAway m of a hideout or the cat shelf).
// They are not part of save.cats, placedCats, the chime or any other lucky-cat code: they live only here and in src/villagecats.js.
import { CAT_SPOTS, HOME } from './base.js';

function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }

// coats (owner: real cats; the lucky cat is white, so NO white coat here; advisor round 2, Nov 17: NO black coat either, a still black cat could pass for the black 'kuro' lucky-cat figurine,
//   so the black cat became a dark grey tabby and the tortoiseshell's dark base is a shade lighter): [name, base, stripe or patch, belly, pattern, eyes]
export const COATS = [['brown tabby', 0x7e6044, 0x34261a, 0xb09070, 'tabby', 0x9aa83a], ['ginger', 0xc8742e, 0x8a4418, 0xe0a870, 'tabby', 0xd0a030], ['dark grey tabby', 0x58585a, 0x2c2c2e, 0x8a8a88, 'tabby', 0xc0b040],
  ['grey with white socks', 0x74767c, 0x56585e, 0xcfcfcc, 'socks', 0x8ab05a], ['tortoiseshell', 0x3c2a1e, 0xb8642a, 0x7a4a28, 'tortie', 0xc89a30]];
// spots usable on this tier (a perch only drawn on desktop is skipped on phones; the rooms' dusk spots need their rooms switched on)
export function catSpots(cfg, tier) { const V = cfg.villageCats; return V.spots.map((s, i) => ({ i, x: s[0], z: s[1], y: s[2], yaw: s[3], tier: s[4], acts: s[5].split(','), node: s[6] })).filter((s) => s.tier === 'both' || s.tier === tier); }
export function duskSpots(cfg) { const V = cfg.villageCats, out = []; V.dusk.forEach((d, i) => { if (i === 1 && !(cfg.marlaHouse && cfg.marlaHouse.on)) return; if (i === 2 && !(cfg.workshop && cfg.workshop.on)) return; if (i === 0 && !(cfg.avians && cfg.avians.on)) return; out.push({ x: d[0], z: d[1], y: d[2], yaw: d[3], node: d[4], via: d[5], acts: ['sleep', 'loaf'] }); }); return out; }
// the places a village cat must never come near: the lucky-cat hideouts (their cover and where the cat itself sits) and the home's cat shelf
export function noGo() { const out = []; for (const c of CAT_SPOTS) { const d = Math.hypot(c.x, c.z) || 1; out.push([c.x, c.z], [c.x + (c.x / d) * 1.2, c.z + (c.z / d) * 1.2]); } for (const s of HOME.slots) out.push([s[0], s[2]]); return out; }

// shortest node route (breadth first; the network is small)
function route(V, a, b) { if (a === b) return [a]; const prev = new Map([[a, -1]]), q = [a]; while (q.length) { const n = q.shift(); for (const [u, w] of V.edges) { const m = u === n ? w : w === n ? u : -1; if (m < 0 || prev.has(m)) continue; prev.set(m, n); if (m === b) { const out = [b]; let k = n; while (k !== -1) { out.unshift(k); k = prev.get(k); } return out; } q.push(m); } } return [a]; }
const nearestNode = (V, x, z) => { let best = 0, bd = 1e9; V.nodes.forEach(([nx, nz], i) => { const d = Math.hypot(nx - x, nz - z); if (d < bd) { bd = d; best = i; } }); return best; };

// n cats on this tier; each: { x, y, z, yaw, mode ('walk' / 'jump' / 'rest' / 'roost'), act, way (points to walk), spot, t, dur, speed, coat }
export function createCatBrains(cfg, n, tier, seed) {
  const V = cfg.villageCats, r = rng(seed || 9), spots = catSpots(cfg, tier), dusk = duskSpots(cfg), cats = [], taken = new Set();
  const free = (c) => { const opts = spots.filter((s) => !taken.has(s.i) || (c.spot && c.spot.i === s.i)); return opts[Math.floor(r() * opts.length)] || spots[0]; };
  const goTo = (c, s, via) => { c.spot0 = c.spot || c.spot0; if (c.spot) taken.delete(c.spot.i); c.spot = s; if (s.i !== undefined) taken.add(s.i); const from = nearestNode(V, c.x, c.z), ns = route(V, from, s.node), way = ns.map((k) => ({ x: V.nodes[k][0], z: V.nodes[k][1], y: 0 }));
    for (const p of via || []) way.push({ x: p[0], z: p[1], y: 0 }); way.push({ x: s.x, z: s.z, y: s.y, end: true }); c.way = way; c.mode = 'walk'; c.t = 0; down(c); };
  // off a perch: a hop down on the side it came up from (toward its spot's path point)
  const down = (c) => { if (c.y <= 0.1) return; const s = c.spot0 || { node: nearestNode(V, c.x, c.z) }, [nx, nz] = V.nodes[s.node], d = Math.hypot(nx - c.x, nz - c.z) || 1; c.mode = 'jump'; c.hop = { t: 0, x0: c.x, z0: c.z, y0: c.y, x1: c.x + (nx - c.x) / d * 0.5, z1: c.z + (nz - c.z) / d * 0.5, y1: 0 }; };
  for (let i = 0; i < n; i++) { const s = free({}); const c = { id: i, coat: i, x: s.x, y: s.y, z: s.z, yaw: s.yaw, mode: 'rest', act: s.acts[0], way: [], spot: s, t: r() * 5, dur: V.stay[0] + r() * (V.stay[1] - V.stay[0]), actT: 0, actDur: 4, speed: V.walk, hop: null }; taken.add(s.i); cats.push(c); }
  let ppx = null, ppz = null, pspeed = 0, roosted = false;
  function step(dt, px, pz, evening) {
    if (dt <= 0) return; if (px !== undefined && ppx !== null) { const v = Math.hypot(px - ppx, pz - ppz) / dt; pspeed += (v - pspeed) * Math.min(1, dt * 4); } if (px !== undefined) { ppx = px; ppz = pz; }
    if (evening && !roosted) { roosted = true; cats.forEach((c, k) => { const d = dusk[k % Math.max(1, dusk.length)]; if (d) goTo(c, d, d.via); c.roost = true; }); }
    for (const c of cats) { c.t += dt;
      // a running player close by: off along the paths to the next node away from them (never at evening)
      if (!c.roost && px !== undefined && pspeed > V.runSpeed && Math.hypot(px - c.x, pz - c.z) < V.flee && c.mode !== 'jump') { const n0 = nearestNode(V, c.x, c.z); let best = n0, bd = -1; for (const [u, w] of V.edges) { const m = u === n0 ? w : w === n0 ? u : -1; if (m < 0) continue; const d = Math.hypot(V.nodes[m][0] - px, V.nodes[m][1] - pz); if (d > bd) { bd = d; best = m; } }
        c.spot0 = c.spot || c.spot0; if (c.spot) taken.delete(c.spot.i); c.spot = null; c.way = [{ x: V.nodes[n0][0], z: V.nodes[n0][1], y: 0 }, { x: V.nodes[best][0], z: V.nodes[best][1], y: 0, end: true, flee: true }]; c.mode = 'walk'; c.fleeing = true; c.t = 0; down(c); }
      if (c.mode === 'rest') { c.actT += dt; if (c.actT > c.actDur && c.spot) { c.actT = 0; c.actDur = V.acts[0] + r() * (V.acts[1] - V.acts[0]); c.act = c.spot.acts[Math.floor(r() * c.spot.acts.length)]; }
        if (!c.roost && !c.leave && c.t > c.dur) { c.act = 'stretch'; c.actT = 0; c.actDur = 1.6; c.t = -1.6; c.dur = 0; c.leave = true; }
        if (c.leave && c.t >= 0) { c.leave = false; goTo(c, free(c)); }
        continue; }
      if (c.mode === 'jump') { const h = c.hop; h.t += dt; const u = Math.min(1, h.t / V.jump); c.x = h.x0 + (h.x1 - h.x0) * u; c.z = h.z0 + (h.z1 - h.z0) * u; c.y = h.y0 + (h.y1 - h.y0) * u + Math.sin(Math.PI * u) * 0.25; if (u >= 1) { c.mode = c.way.length ? 'walk' : 'rest'; if (c.mode === 'rest') { c.yaw = c.spot ? c.spot.yaw : c.yaw; c.dur = V.stay[0] + r() * (V.stay[1] - V.stay[0]); c.t = 0; c.act = c.spot ? c.spot.acts[0] : 'loaf'; c.actT = 0; } } continue; }
      // walk along the way points; a perch (height over 0.1 m) is reached with a hop from beside it
      const w = c.way[0]; if (!w) { c.mode = 'rest'; continue; } const dx = w.x - c.x, dz = w.z - c.z, d = Math.hypot(dx, dz), sp = c.fleeing ? V.trot : V.walk;
      if (w.end && (w.y > 0.1 || c.y > 0.1) && d < 0.45) { c.way.shift(); c.mode = 'jump'; c.hop = { t: 0, x0: c.x, z0: c.z, y0: c.y, x1: w.x, z1: w.z, y1: w.y }; continue; }
      if (d < 0.05) { c.way.shift(); if (w.end) { c.y = w.y; if (w.flee) { c.fleeing = false; goTo(c, free(c)); } else { c.mode = 'rest'; c.yaw = c.spot ? c.spot.yaw : c.yaw; c.t = 0; c.dur = V.stay[0] + r() * (V.stay[1] - V.stay[0]); c.act = c.spot ? c.spot.acts[Math.floor(r() * c.spot.acts.length)] : 'loaf'; c.actT = 0; c.actDur = V.acts[0] + r() * (V.acts[1] - V.acts[0]); } } continue; }
      const want = Math.atan2(dx, dz); let dy = want - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += Math.max(-dt * 4, Math.min(dt * 4, dy)); const go = Math.min(sp, d / dt) * Math.max(0.15, Math.cos(dy)); c.x += Math.sin(c.yaw) * go * dt; c.z += Math.cos(c.yaw) * go * dt; c.speed = go; }
  }
  return { cats, step, spots, dusk };
}
