// Base water and base life: layout and rules only (no drawing; headless-testable by test.js). Numbers in CONFIG.baseWater and CONFIG.baseLife.
// The stream (its centre line, the wheel race, the footbridges and what stops you walking into it), the villagers' houses, the recruits' house plots
// (which plot belongs to whom, saved in save.homes, and whether a house is still a timber frame or finished), the set pieces and the lanes, and where grass must not grow.
// Frames follow src/rooms.js: an item at (x, z) turned ry about up; its own +z is its front (a house's door), toLocal / toWorld convert.

export const toLocal = (I, wx, wz) => { const dx = wx - I.x, dz = wz - I.z; return [dx * Math.cos(I.ry) - dz * Math.sin(I.ry), dx * Math.sin(I.ry) + dz * Math.cos(I.ry)]; };
export const toWorld = (I, lx, lz) => [I.x + lx * Math.cos(I.ry) + lz * Math.sin(I.ry), I.z - lx * Math.sin(I.ry) + lz * Math.cos(I.ry)];
// the turn that makes an item's front (+z) face the plaza's middle
export const facePlaza = (x, z) => Math.atan2(-x, -z);
const waterOn = (cfg) => !!(cfg.baseWater && cfg.baseWater.on);
export const lifeOn = (cfg) => !!(cfg.baseLife && cfg.baseLife.on);

// ---------------------------------------------------------------- the stream
// a smooth centre line through CONFIG.baseWater.stream (centripetal Catmull-Rom), sampled every 'step' m: [{ x, z, tx, tz (unit tangent), s (m along) }]
export function streamLine(cfg, step) {
  const P = cfg.baseWater.stream, out = [], st = step || 0.25, n = P.length;
  const at = (i) => P[Math.max(0, Math.min(n - 1, i))];
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  const race = cfg.baseWater.race || [-1, -1]; let s = 0, px = null, pz = null;
  for (let i = 0; i < n - 1; i++) { const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2), L = Math.hypot(c[0] - b[0], c[1] - b[1]), k = Math.max(2, Math.ceil(L / st));
    for (let j = 0; j < k; j++) { const t = j / k, straight = i === race[0];
      const x = straight ? b[0] + (c[0] - b[0]) * t : cr(a[0], b[0], c[0], d[0], t), z = straight ? b[1] + (c[1] - b[1]) * t : cr(a[1], b[1], c[1], d[1], t);
      if (px !== null) s += Math.hypot(x - px, z - pz); out.push({ x, z, s, race: straight }); px = x; pz = z; } }
  { const e = P[n - 1]; s += Math.hypot(e[0] - px, e[1] - pz); out.push({ x: e[0], z: e[1], s, race: false }); }
  for (let i = 0; i < out.length; i++) { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; out[i].tx = (b.x - a.x) / l; out[i].tz = (b.z - a.z) / l; }
  return out;
}
const LINE = new WeakMap();
const line = (cfg) => { let L = LINE.get(cfg.baseWater); if (!L) { L = streamLine(cfg, 0.25); LINE.set(cfg.baseWater, L); } return L; };
// nearest point of the stream's centre line: { d, x, z, tx, tz, s }
export function nearStream(cfg, x, z) {
  const L = line(cfg); let best = null, bd = 1e9;
  for (let i = 0; i < L.length - 1; i++) { const a = L[i], b = L[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)), qx = a.x + dx * t, qz = a.z + dz * t, d = Math.hypot(x - qx, z - qz);
    if (d < bd) { bd = d; best = { d, x: qx, z: qz, tx: a.tx + (b.tx - a.tx) * t, tz: a.tz + (b.tz - a.tz) * t, s: a.s + (b.s - a.s) * t, race: a.race && b.race }; } }
  return best;
}
// the wheel: middle of the race, turned so its own +z runs downstream; axis along its own x
export function wheelFrame(cfg) { const W = cfg.baseWater, [i, j] = W.race, a = W.stream[i], b = W.stream[j], x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x, z, ry: Math.atan2((b[0] - a[0]) / l, (b[1] - a[1]) / l), len: l }; }
// the generator housing beside the wheel (its front faces the stream)
export function genFrame(cfg) { const W = cfg.baseWater, F = wheelFrame(cfg), [x, z] = toWorld(F, W.gen.side * W.gen.off, 0); return { x, z, ry: W.gen.ry !== undefined ? W.gen.ry : F.ry + (W.gen.side < 0 ? Math.PI / 2 : -Math.PI / 2), w: W.gen.size[0], d: W.gen.size[2], h: W.gen.size[1] }; }
// footbridges: own +x runs across the stream (the deck), +z along the stream
// (owner 13:10, base walkers: "nearStream < bridgeFrames < deckY < ... < patrolStep", about 20 calls a walker a frame each searching the whole stream line) the
// bridges' frames depend on the config only, so they are worked out once per config and kept (the same numbers every call)
const BRF = new WeakMap();
export function bridgeFrames(cfg) { if (!waterOn(cfg)) return []; let f = BRF.get(cfg); if (!f) { f = bridgeFrames0(cfg); BRF.set(cfg, f); } return f; }
function bridgeFrames0(cfg) { return cfg.baseWater.bridges.map(([bx, bz, len, wd]) => { const n = nearStream(cfg, bx, bz), nx = -n.tz, nz = n.tx; return { x: n.x, z: n.z, ry: Math.atan2(-nz, nx), len, wd }; }); }
// what you bump into near the water: [frame, cx, cz, hx, hz] boxes (the generator housing)
export function waterSolids(cfg) { if (!waterOn(cfg)) return []; const G = genFrame(cfg); return [{ I: G, cx: 0, cz: 0, hx: G.w / 2 + 0.05, hz: G.d / 2 + 0.05 }]; }
// the sunken channel (CONFIG.baseWater.bed): ground height at a distance d from the stream's middle; flat bed to 'floor', a smooth slope up to the bank top at 'top';
// in the wheel race the channel is cut straight down inside its stone walls ('race' = half width to the walls' outer face)
const sstep = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
export function bedY(cfg, d, race) { const B = cfg.baseWater.bed; if (race) return d < B.race ? -B.depth : 0; if (d >= B.top) return 0; if (d <= B.floor) return -B.depth; return -B.depth * (1 - sstep((d - B.floor) / (B.top - B.floor))); }
// the ground's height at (x, z): 0 except in the stream's channel
export function groundY(cfg, x, z) { if (!waterOn(cfg)) return 0; const n = nearStream(cfg, x, z); return n.d < cfg.baseWater.bed.top + 0.01 ? bedY(cfg, n.d, n.race) : 0; }
// half the water's width at its surface (CONFIG.baseWater.y, below the bank tops), in the open channel and in the race
export function waterHalf(cfg, race) { const B = cfg.baseWater.bed, y = cfg.baseWater.y; if (race) return B.race - 0.32; let lo = B.floor, hi = B.top; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (bedY(cfg, m) < y) lo = m; else hi = m; } return (lo + hi) / 2; }
// walking: the channel stops you at its bank top (you never step down into it) except on a footbridge, where the rails keep you on the deck. body = your radius (m)
export function waterPush(cfg, x, z, body) {
  if (!waterOn(cfg)) return [x, z]; const W = cfg.baseWater, R = body === undefined ? 0.35 : body, lim = W.bed.top + W.block + R;
  for (const b of bridgeFrames(cfg)) { const [lx, lz] = toLocal(b, x, z), wet = Math.abs(lx) < lim; if (Math.abs(lx) < b.len / 2 + W.ramp && Math.abs(lz) < b.wd / 2 + (wet ? R : 0)) { const m = b.wd / 2 - 0.12 - R * 0.5; return wet && Math.abs(lz) > m ? toWorld(b, lx, Math.sign(lz) * m) : [x, z]; } }
  const n = nearStream(cfg, x, z); if (!n || n.d >= lim) return [x, z];
  let ux = (x - n.x), uz = (z - n.z); const l = Math.hypot(ux, uz); if (l < 1e-5) { ux = -n.tz; uz = n.tx; } else { ux /= l; uz /= l; }
  return [n.x + ux * lim, n.z + uz * lim];
}
// height of a footbridge's deck under (x, z) (0 off the bridges): the arch over the channel and a short ramp down to the ground at each end (CONFIG.baseWater.ramp);
// people on patrol stand on it and your view rides over it (src/main.js eases the camera to it)
export const deckAt = (b, lx) => { const top = 0.22 + 0.2 * Math.cos(Math.PI * Math.min(Math.abs(lx), b.len / 2) / b.len) + 0.06; return Math.abs(lx) <= b.len / 2 ? top : top * (1 - sstep((Math.abs(lx) - b.len / 2) / b.ramp)); };
export function deckY(cfg, x, z) { if (!waterOn(cfg)) return 0; const rp = cfg.baseWater.ramp; for (const b of bridgeFrames(cfg)) { const [lx, lz] = toLocal(b, x, z); if (Math.abs(lx) < b.len / 2 + rp && Math.abs(lz) < b.wd / 2) return deckAt(Object.assign({ ramp: rp }, b), lx); } return 0; }
// how far (x, z) is from the stream's middle and from the wheel (m), for the water sound (src/basesound.js)
export function waterNear(cfg, x, z) { if (!waterOn(cfg)) return null; const F = wheelFrame(cfg); return { stream: nearStream(cfg, x, z).d, wheel: Math.hypot(x - F.x, z - F.z) }; }
// is (x, z) in the water (for checks)
export const inWater = (cfg, x, z) => { if (!waterOn(cfg)) return false; const n = nearStream(cfg, x, z); return n.d < waterHalf(cfg, n.race); };

// ---------------------------------------------------------------- the villagers' houses, the recruits' plots, the set pieces
export function houseFrames(cfg) { if (!lifeOn(cfg)) return []; return cfg.baseLife.houses.map((h) => Object.assign({}, h, { x: h.at[0], z: h.at[1], ry: facePlaza(h.at[0], h.at[1]) })); }
export function plotFrames(cfg) { const R = lifeOn(cfg) && cfg.baseLife.recruitHouses; if (!R || !R.on) return []; return R.plots.map(([x, z], k) => ({ k, x, z, ry: facePlaza(x, z), w: R.w, d: R.d, h: R.h })); }
// set pieces: { key, x, z, ry, w, d } footprints (m) for grass and the saplings to keep off; turn null = face the plaza
const PIECE_SIZE = { fire: null, stall: [2.6, 1.7], hives: [2.6, 0.9], cold: [1.5, 3.3], compost: [3.1, 1.3], rack: [2.5, 1.0], tower: [2.3, 2.3], wash: [2.4, 1.3] };
export function pieceFrames(cfg) { if (!lifeOn(cfg)) return []; const out = [];
  for (const [key, v] of Object.entries(cfg.baseLife.pieces)) { const [x, z, a] = v, ry = key === 'fire' ? 0 : (a === null || a === undefined ? facePlaza(x, z) : a), sz = PIECE_SIZE[key] || [2, 2]; out.push(key === 'fire' ? { key, x, z, ry, w: a * 2 + 0.4, d: a * 2 + 0.4, r: a } : { key, x, z, ry, w: sz[0], d: sz[1] }); }
  return out; }
// recruits who get a house: everyone past the starting crew (CONFIG.base.start.personnel), in the order they joined
export const recruitsOf = (cfg, save) => (save.personnel || []).slice(cfg.base.start.personnel.length);
// give each new recruit the next free plot and remember the day they joined (save.homes = [{ id, plot, day }]); an old save (no save.homes yet) gets finished houses for the
// recruits it already has. More recruits than plots: the extra ones wait (no house) until a plot is free. Returns save.homes.
export function settleHomes(cfg, save) {
  const P = plotFrames(cfg), rec = recruitsOf(cfg, save), old = !Array.isArray(save.homes); if (old) save.homes = [];
  const H = save.homes.filter((h) => rec.some((p) => p.id === h.id) && h.plot < P.length); save.homes = H;
  for (const p of rec) { if (H.some((h) => h.id === p.id)) continue; let k = 0; while (k < P.length && H.some((h) => h.plot === k)) k++; if (k >= P.length) break; H.push({ id: p.id, plot: k, day: old ? -1 : save.day }); }
  return H;
}
// 'frame' (timber frame and scaffolding: the day they joined) or 'house' (finished: any later day)
export const homeStage = (save, h) => ((save.day || 0) > h.day ? 'house' : 'frame');
// every plot with what stands on it: { ...frame, stage: 'empty' | 'frame' | 'house', name, role, id }
export function plotStates(cfg, save) {
  const P = plotFrames(cfg); if (!P.length) return []; const H = save ? settleHomes(cfg, save) : [];
  return P.map((f) => { const h = H.find((q) => q.plot === f.k), p = h && save.personnel.find((q) => q.id === h.id); return Object.assign({}, f, h && p ? { stage: homeStage(save, h), name: p.name, role: p.role, id: p.id } : { stage: 'empty' }); });
}
// lanes: the trodden paths (polylines)
export const lanes = (cfg) => (lifeOn(cfg) ? cfg.baseLife.lanes.paths : []);
const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
export const laneD = (cfg, x, z) => { let d = 1e9; for (const L of lanes(cfg)) for (let i = 0; i < L.length - 1; i++) d = Math.min(d, segD(x, z, L[i], L[i + 1])); return d; };

// ---------------------------------------------------------------- where grass, flowers and saplings must not go
// footprints: every house, plot, set piece and the generator, as frames with a size (m)
export function footprints(cfg) { const out = [];
  for (const h of houseFrames(cfg)) out.push({ x: h.x, z: h.z, ry: h.ry, w: h.w + (h.extra === 'leanto' ? 3.2 : 1.0), d: h.d + (h.extra === 'porch' ? 2.4 : 1.2) });
  for (const p of plotFrames(cfg)) out.push({ x: p.x, z: p.z, ry: p.ry, w: p.w + 1.4, d: p.d + 1.6 });
  for (const p of pieceFrames(cfg)) out.push({ x: p.x, z: p.z, ry: p.ry, w: p.w + 0.4, d: p.d + 0.4 });
  if (waterOn(cfg)) { const G = genFrame(cfg); out.push({ x: G.x, z: G.z, ry: G.ry, w: G.w + 0.6, d: G.d + 0.6 }); }
  return out; }
// keepOut(x, z): true where no grass clump may stand (the water and its banks, footprints, lanes). Fast: box tests first.
export function keepOut(cfg) {
  const F = footprints(cfg).map((f) => Object.assign(f, { R: Math.hypot(f.w, f.d) / 2 })), W = waterOn(cfg) ? cfg.baseWater : null, wr = W ? W.bed.top + 0.12 : 0, L = lanes(cfg), lw = lifeOn(cfg) ? cfg.baseLife.lanes.width / 2 : 0;
  const box = W ? line(cfg).reduce((b, p) => [Math.min(b[0], p.x), Math.max(b[1], p.x), Math.min(b[2], p.z), Math.max(b[3], p.z)], [1e9, -1e9, 1e9, -1e9]) : null;
  return (x, z) => { for (const f of F) { if (Math.abs(x - f.x) > f.R || Math.abs(z - f.z) > f.R) continue; const [lx, lz] = toLocal(f, x, z); if (Math.abs(lx) < f.w / 2 && Math.abs(lz) < f.d / 2) return true; }
    for (const P of L) for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (x < Math.min(a[0], b[0]) - lw || x > Math.max(a[0], b[0]) + lw || z < Math.min(a[1], b[1]) - lw || z > Math.max(a[1], b[1]) + lw) continue; if (segD(x, z, a, b) < lw) return true; }
    if (W && x > box[0] - wr && x < box[1] + wr && z > box[2] - wr && z < box[3] + wr && nearStream(cfg, x, z).d < wr) return true; return false; };
}
// circles [x, z, r] the base's growth saplings keep clear of (src/baseview.js growth)
export function reserved(cfg) { const out = footprints(cfg).map((f) => ({ x: f.x, z: f.z, r: Math.hypot(f.w, f.d) / 2 }));
  if (waterOn(cfg)) for (const p of line(cfg).filter((_, i) => i % 8 === 0)) out.push({ x: p.x, z: p.z, r: cfg.baseWater.bed.top + 0.3 });
  return out; }
// how far you may walk from the middle of the base
export const baseBound = (cfg) => (lifeOn(cfg) && cfg.baseLife.bound) || cfg.base.bound;
