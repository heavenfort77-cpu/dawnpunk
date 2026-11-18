// The hatchery's rules (owner Nov 17): hens lay into the coop, you collect the eggs and warm them in the incubator, eggs hatch into chicks, chicks grow into hens;
// some hatches are Sunquills (our own bird: a moss-green hen with a copper sun-crest). Grown birds bring food each day, Sunquills seeds too. No rendering here (headless-testable).
// Numbers: CONFIG.avians. Save data: save.avians = { birds: [{ id, kind }], chicks: [{ id, kind, age }], coop, held, inc: [{ left }], seeds, nextId }.
import { mulberry32 } from './sim.js';

export function newFlock(cfg, old) {
  const A = cfg.avians, birds = []; let id = 1;
  if (old) for (let i = 0; i < A.oldStart; i++) birds.push({ id: id++, kind: 'hen' });
  else { for (let i = 0; i < A.start[0]; i++) birds.push({ id: id++, kind: 'hen' }); for (let i = 0; i < A.start[1]; i++) birds.push({ id: id++, kind: 'sunquill' }); }
  return { birds, chicks: [], coop: 0, held: 0, inc: [], seeds: 0, nextId: id };
}
// an older save (or a save from before the hatchery) gets a starter flock of CONFIG.avians.oldStart hens; damaged fields get their defaults
export function fillFlock(cfg, save) {
  if (!save.avians || typeof save.avians !== 'object') { save.avians = newFlock(cfg, true); return save.avians; }
  const F = save.avians; for (const k of ['birds', 'chicks', 'inc']) if (!Array.isArray(F[k])) F[k] = []; for (const k of ['coop', 'held', 'seeds']) if (typeof F[k] !== 'number') F[k] = 0;
  if (typeof F.nextId !== 'number') F.nextId = 1 + Math.max(0, ...F.birds.map((b) => b.id || 0), ...F.chicks.map((b) => b.id || 0)); return F;
}
export const flockSize = (F) => F.birds.length + F.chicks.length;
export const sunquills = (F) => F.birds.filter((b) => b.kind === 'sunquill').length;
// what the flock brings each day: food from every grown bird, seeds from the Sunquills
export const dailyYield = (cfg, F) => ({ food: F.birds.length * cfg.avians.foodPerHen, seeds: sunquills(F) * cfg.avians.seedPerSunquill });

// E at the nest boxes: every egg in the coop into your hands
export function collectEggs(save) { const F = save.avians, n = F.coop; F.coop = 0; F.held += n; return n; }
// E at the incubator: one egg you hold into the warm dome, if it has a free place and the flock has room for one more
export function placeEgg(cfg, save) {
  const F = save.avians, A = cfg.avians;
  if (F.held <= 0) return { ok: false, msg: 'No eggs in hand. The hens lay in the coop.' };
  if (F.inc.length >= A.slots) return { ok: false, msg: 'The dome is full (' + A.slots + ' eggs).' };
  if (flockSize(F) + F.inc.length >= A.maxFlock) return { ok: false, msg: 'The run is full (' + A.maxFlock + ' birds). No more eggs for now.' };
  F.held--; F.inc.push({ left: A.hatchDays }); return { ok: true, msg: 'Egg in the warm dome. It hatches in ' + A.hatchDays + ' days.' };
}

// one day passes (each night run back to base, in base.js applyNight): chicks grow, warm eggs hatch, every grown bird lays, the flock pays (unless pay is false)
export function flockDay(cfg, save, pay) {
  const F = fillFlock(cfg, save), A = cfg.avians, out = { grown: 0, hatched: [], laid: 0, food: 0, seeds: 0 };
  for (const c of F.chicks) c.age++;
  const big = F.chicks.filter((c) => c.age >= A.growDays); F.chicks = F.chicks.filter((c) => c.age < A.growDays); for (const c of big) F.birds.push({ id: c.id, kind: c.kind }); out.grown = big.length;
  for (const e of F.inc) e.left--;
  const keep = []; for (const e of F.inc) { if (e.left > 0) { keep.push(e); continue; } const id = F.nextId++, kind = mulberry32((save.seed || 1) * 7 + save.day * 131 + id * 977)() < A.sunquillChance ? 'sunquill' : 'hen'; F.chicks.push({ id, kind, age: 0 }); out.hatched.push(kind); }
  F.inc = keep;
  const laid = Math.max(0, Math.min(A.coopMax - F.coop, F.birds.length * A.eggsPerHen)); F.coop += laid; out.laid = laid;
  if (pay) { const y = dailyYield(cfg, F); save.food += y.food; F.seeds += y.seeds; out.food = y.food; out.seeds = y.seeds; }
  return out;
}

// Marla's one line about the hatchery (on the first base visit after it appears; the workshop line goes first when both are due)
export const HATCHERY_TIP = "Hatchery's by the {d}. Eggs go in the warm dome. Don't name them.";
export const hatcheryTip = (cfg, save) => !!(cfg.avians && cfg.avians.on && save && !save.toldHatchery);

// ---- the hatchery corner's layout (world metres, from CONFIG.avians.at); src/hatchery.js builds it, the village cats (src/catwalk.js) walk round it
export function hatchLayout(cfg) {
  const [cx, cz] = cfg.avians.at, run = { x0: cx - 2.5, x1: cx + 1.5, z0: cz - 1.6, z1: cz + 1.6 };
  return { cx, cz, run, coop: { x: cx + 2.15, z: cz + 0.4, w: 1.2, d: 1.5, y: 0.5, h: 1.0 }, inc: [cx - 0.7, cz - 2.35], sign: [cx - 2.7, cz - 2.0], pen: { x0: run.x0 + 0.1, x1: run.x0 + 1.1, z0: run.z0 + 0.1, z1: run.z0 + 0.9 },
    trough: [cx - 1.1, run.z1 - 0.3], bench: [run.x0 - 0.45, cz - 0.2], water: [run.x0 + 0.4, run.z1 - 0.35], nestOut: [cx + 3.25, cz + 0.4], ramp: [[cx + 0.9, cz + 0.4, 0.0], [cx + 1.52, cz + 0.4, 0.5]], rect: { x: cx + 0.3, z: cz - 0.35, w: 6.2, d: 4.9 } };
}
