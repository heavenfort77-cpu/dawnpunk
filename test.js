// Balance test. Prints win rates and PASS/FAIL against targets. Usage: node test.js [seeds]
import { CONFIG } from './src/config.js';
import { runBot, SKILLS } from './src/bots.js';
import { createSim, breachTypes, makeBreaches, levelsFor } from './src/sim.js';
import { createRun } from './src/run.js';
import { standFor } from './src/boss.js';

const N = +process.argv[2] || 200;
const fails = [];
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) fails.push(name); };

// structure checks
const types14 = breachTypes(14);
check('14-point house = 2 doors, 10 windows, 1 gap, 1 hatch', types14.filter((t) => t === 'door').length === 2 && types14.filter((t) => t === 'window').length === 10 && types14.includes('gap') && types14.includes('hatch'));
for (const [r, expect] of [[0, [14, 12, 10, 9, 8, 7]], [4, [22, 20, 18, 17, 16, 15]]]) {
  const got = CONFIG.ring.bpBase.map((b) => b + CONFIG.ring.bpPerRing * r);
  check(`ring ${r + 1} breach table`, JSON.stringify(got) === JSON.stringify(expect), got.join(','));
}
const s0 = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 });
check('zero energy: cannon refuses to fire', (() => { s0.player.energy = 0; return s0.fireCannon('auto', 1) === false; })());
const s1 = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 });
check('panel only on a breach point (rejects none in reach)', (() => { s1.player.x = 0; s1.player.z = 0; return s1.place('panel').ok === false; })());
const s2 = createSim({ cfg: CONFIG, ring: 0, house: 5, seed: 1 });
check('hidden cat gives coin + energy once', (() => { s2.player.x = s2.cat.x; s2.player.z = s2.cat.z; s2.player.energy = 10; s2.step(0.1); const a = s2.coins === 1 && s2.player.energy >= 10 + CONFIG.cat.energy - 1; s2.step(0.1); return a && s2.coins === 1; })());
const s3 = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 });
check('explosion hurts Gloom only (player + devices untouched)', (() => {
  s3.place('turbine', { x: 1, z: 1 }); const hp0 = s3.player.hp, dh = s3.devices[0].hp;
  s3.gloom.push({ id: 90, x: 1, z: 1, hp: 1, maxhp: 1, phase: 'inside', bp: 0, timer: 0, cd: 5, face: 0 }, { id: 91, x: 1.5, z: 1, hp: 100, maxhp: 100, phase: 'approach', bp: 0, timer: 0, cd: 5, face: 0 });
  s3.fireCannon('auto', 1); // may or may not kill; kill directly via damage path
  s3.gloom[0].hp = 0; s3.gloom.splice(0, 1); return s3.player.hp === hp0 && s3.devices[0].hp === dh;
})());

check('house footprint grows with breach points on the same number of floors (14 vs 9 openings, both 2 floors)', createSim({ cfg: CONFIG, ring: 0, house: 0 }).H > createSim({ cfg: CONFIG, ring: 0, house: 3 }).H);
check('breaking a panel logs a devdead event with position', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); t.player.energy = 50; const r = t.place('panel', { bp: 0 }); t.devices[0].hp = 0.001; t.gloom.push({ id: 7, x: t.devices[0].x, z: t.devices[0].z, hp: 99, maxhp: 99, phase: 'block', bp: 0, timer: 0, cd: 0, face: 0 }); t.step(0.1); return r.ok && t.log.some((e) => e.e === 'devdead' && e.kind === 'panel' && typeof e.x === 'number'); })());

check('floors: 4-BP = 1, 14-BP = 2, 22-BP = 3', levelsFor(CONFIG, 4) === 1 && levelsFor(CONFIG, 14) === 2 && levelsFor(CONFIG, 22) === 3);
{ const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 });
  check('14-BP house has breach points on both floors, hatch on top, doors on ground', t.breaches.some((b) => b.floor === 0) && t.breaches.some((b) => b.floor === 1) && t.breaches.find((b) => b.type === 'hatch').floor === 1 && t.breaches.filter((b) => b.type === 'door').every((b) => b.floor === 0));
  const st = t.stairs[0]; t.player.x = st.bx; t.player.z = st.bz; t.step(0.1);
  check('player walks onto the stairs and arrives on floor 2', t.player.floor === 1);
  for (let i = 0; i < 13; i++) t.step(0.1); t.player.x = st.tx; t.player.z = st.tz; t.step(0.1);
  check('player walks back down the stairs', t.player.floor === 0);
  const l = t.ladders[0]; t.player.x = l.x; t.player.z = l.z; t.step(0.1);
  check('ladder is a timed climb: floor changes only after ladderTime', t.player.floor === 0 && !!t.player.climb);
  check('no shooting, placing, eating or moving while climbing', (() => { t.player.energy = 90; t.player.hp = 50; const x0 = t.player.x; t.move(1, 0, 0.1); return t.fireCannon('auto', 1) === false && t.place('turbine').ok === false && t.eat() === false && t.player.x === x0; })());
  for (let i = 0; i < 20 && t.player.climb; i++) t.step(0.1);
  check('after the climb the player is on the next floor and can act again', t.player.floor === 1 && !t.player.climb && t.fireCannon('auto', 1) === true);
  // Gloom: on floor 0, target (player) on floor 1 -> climbs via stairs, never the ladder
  t.gloom.length = 0; t.player.x = 0; t.player.z = 5; t.player.floor = 1; t.player.hp = 1e6;
  t.gloom.push({ id: 500, x: 0, z: 0, floor: 0, hp: 1e6, maxhp: 1e6, phase: 'inside', bp: 0, timer: 0, cd: 0, face: 0 });
  let usedStairs = false, nearLadder = false;
  for (let i = 0; i < 400 && t.gloom[0].floor === 0; i++) { t.step(0.1); const g = t.gloom[0]; if (Math.hypot(g.x - l.x, g.z - l.z) < 1.2) nearLadder = true; }
  usedStairs = t.gloom[0].floor === 1;
  check('Gloom climb the stairs to reach the player upstairs', usedStairs);
  check('Gloom do not go to the ladder', !nearLadder); }
check('a Gloom on the stairs can be shot from the upper floor, then arrives after stairTime', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); const st = t.stairs[0]; t.player.floor = 1; t.player.x = st.tx + 1; t.player.z = st.tz; t.player.yaw = Math.atan2(-(st.bx - t.player.x), -(st.bz - t.player.z)); t.gloom.push({ id: 1, x: st.bx, z: st.bz, floor: 0, hp: 50, maxhp: 50, phase: 'inside', bp: 0, timer: 0, cd: 9, face: 0 }); t.player.floor = 0; t.player.x = st.tx + 1.6; t.player.z = st.tz; t.player.yaw = Math.PI / 2; t.player.floor = 1; t.step(0.1); const g = t.gloom[0]; const onStair = !!(g && g.climb); const alert = t.log.some((e) => e.e === 'alert' && e.k === 'stair'); t.fireCannon('auto', 1); const hit = !g || g.hp < 50; for (let i = 0; i < 20; i++) t.step(0.1); return onStair && alert && hit && (!t.gloom[0] || t.gloom[0].floor === 1); })());
check('spawn logs inbound alert', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); for (let i = 0; i < 300; i++) t.step(0.1); return t.log.some((e) => e.e === 'alert' && (e.k === 'inbound' || e.k === 'upper')); })());
{ const B = await import('./src/base.js'); const R = CONFIG.base.recruitFood;
  check('village food 1: the EAT label shows what is left to bring home (desktop and phone)', B.eatLabel(7, false) === 'EAT · 7 to bring home' && B.eatLabel(7, true) === 'EAT<br>7 home');
  check('village food 2: Marla has the "village\'s supper" line, 44 characters or fewer', B.MARLA_LINES.supper && B.MARLA_LINES.supper[0] === "That's the village's supper, Potts. Hmph." && B.MARLA_LINES.supper[0].length <= 44);
  check('village food 3: the night results line: next recruit against the price, and what was eaten (left out when 0)', B.nightFoodLine(CONFIG, 22, 3) === 'Next recruit: 22/' + R + ' food. You ate 3.' && B.nightFoodLine(CONFIG, 22, 0) === 'Next recruit: 22/' + R + ' food.');
  check('village food 4: the base line reads "Next recruit: n/price food", and "ready" once there is enough', B.recruitLine(CONFIG, 22) === 'Next recruit: 22/' + R + ' food' && /ready/.test(B.recruitLine(CONFIG, R + 4)));
  check('village food 5: low health after eating ' + CONFIG.village.ateLow + '+ times tonight swaps to the hungry line (44 characters or fewer)', B.lowKey(CONFIG, CONFIG.village.ateLow) === 'lowAte' && B.lowKey(CONFIG, CONFIG.village.ateLow - 1) === 'low' && B.MARLA_LINES.lowAte[0] === 'Eat. Better we go hungry than you dying.' && B.MARLA_LINES.lowAte[0].length <= 44); }
check('Marla night barks stay short (<= 44 chars with the longest direction filled in)', await (async () => { const B = await import('./src/base.js'); const dirs = ['on your right', 'downstairs']; return Object.values(B.MARLA_LINES).flat().every((l) => dirs.every((d) => l.replace('{d}', d).replace('{f}', '3').replace('{u}', 'down').length <= 44)); })());
check('stairTime 0 does not produce NaN positions', (() => { const c = JSON.parse(JSON.stringify(CONFIG)); c.gloom.stairTime = 0; const t = createSim({ cfg: c, ring: 0, house: 0, seed: 1 }); const st = t.stairs[0]; t.player.floor = 1; t.player.x = st.bx + 2; t.player.z = st.bz; t.gloom.push({ id: 1, x: st.bx, z: st.bz, floor: 0, hp: 50, maxhp: 50, phase: 'inside', bp: 0, timer: 0, cd: 9, face: 0 }); for (let i = 0; i < 20; i++) t.step(0.1); return t.gloom.every((g) => Number.isFinite(g.x) && Number.isFinite(g.z)); })());
check('player stair cooldown blocks an instant stair re-use', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); const st = t.stairs[0]; t.player.x = st.bx; t.player.z = st.bz; t.step(0.1); const up = t.player.floor === 1; t.player.x = st.tx; t.player.z = st.tz; t.step(0.1); const stuck = t.player.floor === 1; for (let i = 0; i < 13; i++) t.step(0.1); t.player.x = st.tx; t.player.z = st.tz; t.step(0.1); return up && stuck && t.player.floor === 0; })());
check('explosion from a Gloom dying on the stairs hits Gloom on the floor it is arriving on', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); const st = t.stairs[0]; const mk = (id, fl, x) => ({ id, x, z: st.bz, floor: fl, hp: 1, maxhp: 1, phase: 'inside', bp: 0, timer: 0, cd: 9, face: 0 }); const a = mk(1, 0, st.bx + 1), o = mk(2, 1, st.bx + 1.2); a.climb = { to: 1, t: 0.4, dur: 0.8, ax: st.bx, az: st.bz, bx: st.tx + 1, bz: st.tz }; a.hp = 0.5; t.gloom.push(a, o); t.player.floor = 1; t.player.x = st.bx + 3; t.player.z = st.bz; t.player.yaw = Math.PI / 2; o.hp = CONFIG.gloom.explodeDmg; t.fireCannon('auto', 1); return !t.gloom.includes(o); })());
// ---- daytime before the night
{ const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 3, day: true });
  check('day: starts in daylight with the small battery, pack food only, crates hold the rest of the loot', t.phase === 'day' && t.player.energy === CONFIG.day.startEnergy && t.food === CONFIG.day.packFood && t.crates.length >= 3 && t.crates.reduce((a, c) => a + c.v, 0) + t.food === Math.round(14 * 0.7) + Math.round(14 * 0.3));
  for (let i = 0; i < 50; i++) t.step(0.1);
  check('day: no Gloom and the night clock does not run in daylight', t.gloom.length === 0 && t.t === 0 && t.spawned === 0);
  const b = t.breaches.find((q) => q.floor === 0);
  check('day: a collector needs sunlight (refused in the middle of the room)', t.place('collector', { x: 0, z: 0 }).reason === 'sun');
  const e0 = t.player.energy; const r = t.place('collector', { x: b.inX - b.nx * 0.8, z: b.inZ - b.nz * 0.8 }); for (let i = 0; i < 100; i++) t.step(0.1);
  check('day: a collector by an opening is free and charges the battery', r.ok && Math.abs(t.player.energy - e0 - CONFIG.devices.collector.chargePerSec * 10) < 0.05);
  const c = t.crates.find((q) => q.floor === 0) || t.crates[0]; t.player.floor = c.floor; t.player.x = c.x; t.player.z = c.z; const f0 = t.food, s0 = t.ess; t.step(0.1);
  check('day: walking over a crate picks it up once', c.got && (t.food + t.ess) === f0 + s0 + c.v && t.log.some((e) => e.e === 'crate'));
  t.endDay(); const e1 = t.player.energy; for (let i = 0; i < 30; i++) t.step(0.1);
  check('dusk: night starts, collectors stop charging and cannot be placed', t.phase === 'night' && t.t > 2.9 && t.player.energy <= e1 + 0.001 && t.place('collector', { x: b.inX, z: b.inZ }).reason === 'night' && t.log.some((e) => e.e === 'dusk'));
  const t2 = createSim({ cfg: CONFIG, ring: 0, house: 5, seed: 3, day: true }); for (let i = 0; i < CONFIG.day.duration * 10 + 2; i++) t2.step(0.1);
  check('day ends by itself at dusk', t2.phase === 'night');
  const t3 = createSim({ cfg: CONFIG, ring: 1, house: 5, seed: 3, day: true }); const b3 = t3.breaches[0]; t3.place('collector', { x: b3.inX - b3.nx * 0.8, z: b3.inZ - b3.nz * 0.8 }); t3.crates.forEach((q) => { q.got = true; if (q.kind === 'ess') t3.ess += q.v; }); t3.endDay(); t3.gloom.length = 0; t3.spawned = 1e9; t3.t = CONFIG.night.duration; t3.step(0.1);
  check('dawn: scavenged essentials plus a bonus for each collector still standing; ring is reported', t3.win && t3.result.ring === 1 && t3.result.collectors === 1 && t3.result.essentials === t3.ess + Math.round((1 / CONFIG.devices.collector.max) * CONFIG.day.collectorBonus * t3.crates.filter((q) => q.kind === 'ess').reduce((a, q) => a + q.v, 0)));
  check('day: no empty crates in any house, none by the cat corner; devices and FIRE wait for the night; collectors keep a gap', (() => { for (let r = 0; r < 5; r++) for (let h = 0; h < 6; h++) for (let sd = 1; sd < 6; sd++) { const q = createSim({ cfg: CONFIG, ring: r, house: h, seed: sd, day: true }); if (q.crates.some((c) => c.v < 1 || (c.floor === 0 && Math.hypot(c.x - q.cat.x, c.z - q.cat.z) < 2.6))) return false; } const q = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 2, day: true }); q.player.energy = 50; const b = q.breaches.find((v) => v.floor === 0), sp = { x: b.inX - b.nx * 0.8, z: b.inZ - b.nz * 0.8 }; return q.place('turbine').reason === 'day' && q.fireCannon('auto', 1) === false && q.place('collector', sp).ok && q.place('collector', sp).reason === 'close'; })());
  check('dawn comes early once every Gloom has spawned and died (day mode)', (() => { const q = createSim({ cfg: CONFIG, ring: 0, house: 5, seed: 2, day: true }); q.endDay(); q.spawned = 1e9; q.step(0.1); return q.done && q.win && q.t < 1; })());
  check('ring multipliers and Gloom count multipliers rise with the ring', CONFIG.ring.mult.every((v, i, a) => i === 0 || v > a[i - 1]) && CONFIG.ring.countMult.every((v, i, a) => i === 0 || v > a[i - 1]));
}
// ---- settlement run: six houses by day, the last house at night
{ const RUN = await import('./src/run.js'); const r = RUN.createRun(CONFIG, 0, 5, { extraEnergy: 5 });
  check('run: six houses on two rows, none overlapping, one hidden cat, doors on the street side', r.houses.length === 6 && r.houses.filter((h) => !h.sim.cat.found).length === 1 && r.houses.every((h) => Math.abs(h.doorZ) < Math.abs(h.z) && r.houses.every((o) => o === h || Math.abs(o.x - h.x) >= h.H + o.H + 1 || Math.abs(o.z - h.z) >= h.H + o.H + 1)));
  check('run: starts with the small battery, pack food, full daylight', r.energy === CONFIG.day.startEnergy + 5 && r.food === CONFIG.day.packFood && r.dayT === CONFIG.day.duration && r.inside === -1);
  const all = r.houses.reduce((a, h) => a + h.sim.crates.reduce((b, c) => b + c.v, 0), 0); check('run: the settlement holds about the loot of all six sizes, but not always more in the bigger house', Math.abs(all - 60) <= 4 && Array.from({ length: 40 }, (_, k) => k + 1).some((sd) => { const q = RUN.createRun(CONFIG, 0, sd), lt = (h) => h.sim.crates.reduce((b, c) => b + c.v, 0); return lt(q.houses[5]) > lt(q.houses[0]); }), 'total ' + all);
  check('run: a heavy pack slows the daytime walk, on the street and inside, never at night', (() => { const q = RUN.createRun(CONFIG, 0, 5); const m0 = RUN.speedMult(q); q.food = q.loadTotal + CONFIG.day.packFood; const m1 = RUN.speedMult(q); const sq = RUN.enter(q, 0); const x0 = sq.player.x, z0 = sq.player.z; sq.move(0, -1, 0.1); const dDay = Math.hypot(sq.player.x - x0, sq.player.z - z0); sq.endDay(); const x1 = sq.player.x, z1 = sq.player.z; sq.move(0, -1, 0.1); const dNight = Math.hypot(sq.player.x - x1, sq.player.z - z1); return m0 === 1 && Math.abs(m1 - (1 - CONFIG.day.carrySlow)) < 1e-9 && Math.abs(dDay - CONFIG.player.speed * 0.1 * m1) < 1e-6 && Math.abs(dNight - CONFIG.player.speed * 0.1) < 1e-6; })());
  check('quitting the night earns nothing at home (no passive income, no research day)', await (async () => { const B = await import('./src/base.js'); const sv = B.newSave(CONFIG, 3); B.makeQuests(CONFIG, sv); const f0 = sv.food, e0 = sv.essentials; const q = createSim({ cfg: CONFIG, ring: 0, house: 5, seed: 1 }); q.abandon(); const r = B.applyNight(CONFIG, sv, q.result, 0); return q.result.left === true && sv.food === f0 + CONFIG.loot.minPayoutFood && sv.essentials === e0 && r.passive.food === 0; })());
  check('the ladder cannot be reused at once (cooldown), so it is an escape and not a loop', (() => { const q = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); const l = q.ladders[0]; q.player.x = l.x; q.player.z = l.z; for (let i = 0; i < 14; i++) q.step(0.1); const up = q.player.floor === 1; q.player.x = l.x; q.player.z = l.z; q.step(0.1); const blocked = !q.player.climb; for (let i = 0; i < CONFIG.ladderCd * 10; i++) q.step(0.1); q.player.x = l.x; q.player.z = l.z; q.step(0.1); return up && blocked && !!q.player.climb; })());
  check('a barricade at the TOP of the stairs also holds Gloom coming up', (() => { const q = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); const st = q.stairs[0]; q.player.floor = 1; q.player.x = st.tx + 2.5; q.player.z = st.tz; q.player.energy = 50; q.player.yaw = Math.PI / 2; const r = q.place('panel'); q.player.x = st.tx + 4; q.gloom.push({ id: 1, x: st.bx, z: st.bz, floor: 0, hp: 50, maxhp: 50, phase: 'inside', bp: 0, timer: 0, cd: 0, face: 0 }); for (let i = 0; i < 20; i++) q.step(0.1); return r.ok && r.dev.stair === 'T' && q.gloom[0].floor === 0 && !!q.gloom[0].climb && r.dev.hp < CONFIG.devices.panel.hp; })());
  for (let i = 0; i < 50; i++) RUN.tickTown(r, 0.1);
  check('run: on the street the hand banks sunlight and the clock runs', Math.abs(r.energy - (CONFIG.day.startEnergy + 5 + CONFIG.day.handCharge * 5)) < 0.01 && Math.abs(r.dayT - (CONFIG.day.duration - 5)) < 0.01);
  const [qx, qz] = RUN.pushOut(r, r.houses[0].x, r.houses[0].z); check('run: house boxes are solid on the street', Math.abs(qx - r.houses[0].x) >= r.houses[0].H || Math.abs(qz - r.houses[0].z) >= r.houses[0].H);
  const s = RUN.enter(r, 3); const c = s.crates[0]; s.player.floor = c.floor; s.player.x = c.x; s.player.z = c.z; for (let i = 0; i < 20; i++) s.step(0.1);
  check('run: inside, crates are picked up, the hand keeps charging and the clock keeps running', c.got && s.food + s.ess === CONFIG.day.packFood + c.v && s.dayT < r.dayT - 1.9 && s.player.energy > r.energy + 0.3);
  const atDoor = (q) => { const d = RUN.exitDoor(q); q.player.floor = 0; q.player.climb = null; q.player.x = d.inX + d.nx; q.player.z = d.inZ + d.nz; };
  const far = RUN.leave(r); atDoor(s);
  const carried = s.food + s.ess; check('run: leaving works only at the door, and keeps the loot and the time', far === false && RUN.leave(r) && r.inside === -1 && r.food + r.ess === carried && Math.abs(r.dayT - s.dayT) < 1e-9);
  const s2 = RUN.enter(r, 5); check('run: loot and battery are carried into the next house', s2.food + s2.ess === carried && Math.abs(s2.player.energy - r.energy) < 1e-9 && r.visited === 2);
  atDoor(s2); RUN.leave(r); r.px = r.houses[1].doorX; r.pz = r.houses[1].doorZ; const sn = RUN.nightfall(r);
  check('run: dusk on the street moves you into the nearest house, which becomes the last house', sn === r.houses[1].sim && sn.phase === 'night' && r.inside === 1 && sn.food + sn.ess === carried);
  check('run: no leaving at night', RUN.leave(r) === false && r.inside === 1);
  sn.gloom.length = 0; sn.spawned = 1e9; sn.step(0.1); check('run: the night is won in the last house and pays what was carried', sn.done && sn.win && sn.result.food === sn.food && sn.result.ring === 0);
  const r2 = RUN.createRun(CONFIG, 0, 9); const sx = RUN.enter(r2, 2); for (let i = 0; i < CONFIG.day.duration * 10 + 5; i++) sx.step(0.1); check('run: staying inside until the clock runs out starts the night there', sx.phase === 'night');
}
// ---- the rest of the roster
{ const D = CONFIG.devices, mk = () => { const q = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 4 }); q.player.energy = 100; q.player.x = -3; q.player.z = 3; return q; };
  const G = (q, x, z, hp = 100) => { const g = { id: q.nextId++, x, z, floor: 0, hp, maxhp: hp, phase: 'inside', bp: 0, timer: 0, cd: 99, face: 0 }; q.gloom.push(g); return g; };
  const run = (q, sec) => { for (let i = 0; i < sec * 10; i++) q.step(0.1); };
  { const q = mk(), a = mk(); q.place('twin', { x: 0, z: 0 }); a.place('lance', { x: 0, z: 0 }); const g1 = G(q, 3, 0), g2 = G(a, 3, 0); run(q, 0.2); run(a, 0.2); check('Twin Lance: two pellets per shot (double a lance)', 100 - g1.hp === 2 * (100 - g2.hp) && g2.hp < 100); }
  { const q = mk(); q.place('mist', { x: 0, z: 0 }); const g = G(q, 3, 0); run(q, 0.2); const x0 = g.x; g.cd = 99; q.player.x = -6; run(q, 1); const slowMove = Math.abs(g.x - x0); check('Mist Coil: a hit Gloom is slowed', g.slowT > 0 && slowMove < CONFIG.gloom.speed * 1 * 0.75 && slowMove > 0.1, 'moved ' + slowMove.toFixed(2)); }
  { const q = mk(), b = q.breaches.find((v) => v.floor === 0), r = q.place('trellis', { bp: b.i }); q.player.x = b.inX + b.nx * 3; q.player.z = b.inZ + b.nz * 3; q.player.yaw = Math.atan2(-(b.outX - q.player.x), -(b.outZ - q.player.z)); q.player.pitch = 0.3; const g = { id: 99, x: b.outX, z: b.outZ, floor: 0, hp: 50, maxhp: 50, phase: 'block', bp: b.i, timer: 0, cd: 99, face: 0 }; q.gloom.push(g); q.fireCannon('ray', 1); check('Tall Trellis: a tough wall on a breach point that nothing shoots over', r.ok && b.panel === r.dev && r.dev.hp === D.trellis.hp && D.trellis.hp > D.panel.hp && g.hp === 50); }
  { const q = mk(); q.player.x = 0; q.player.z = 0.2; q.player.hp = 1e6; const r = q.place('mine', { x: 0, z: 0 }); const g = G(q, 0.5, 0, 25), far = G(q, 6, 6, 25); q.step(0.1); const early = q.devices.includes(r.dev); run(q, 2); check('Capacitor Mine: arms after a delay, then bursts under a Gloom and is used up; Gloom ignore it', early && !q.devices.includes(r.dev) && !q.gloom.includes(g) && q.gloom.includes(far) && q.log.some((e) => e.e === 'boom')); }
  { const q = mk(); q.player.x = 0; q.player.z = 0; q.player.yaw = 0; const g = G(q, 0, -3, 30), far = G(q, 0, 6.5, 30); const e0 = q.player.energy; const r = q.place('flask'); check('Biogas Flask: one-shot area burst where you aim, nothing left behind', r.ok && !q.gloom.includes(g) && q.gloom.includes(far) && q.devices.length === 0 && q.player.energy === e0 - D.flask.cost); }
  { const q = mk(); q.player.x = 0; q.player.z = 0.2; q.player.hp = 1e6; q.place('press', { x: 0, z: 0 }); const g1 = G(q, 1, 0), g2 = G(q, -1, 0); q.spawned = 1e9; const left = () => [g1, g2].filter((g) => q.gloom.includes(g)).length; q.step(0.1); const one = left() === 1; run(q, 2); const still = left() === 1; run(q, D.press.reset); check('Mulch Press: grinds one Gloom, then needs time to reset', one && still && left() === 0); }
  { const q = mk(); const r = q.place('shard', { x: 0, z: 0 }); const g = G(q, 0.5, 0); g.cd = 99; q.player.x = 0.6; q.player.z = 0; q.player.hp = 1e6; run(q, 1); check('Shard Plate: hurts Gloom standing on it, does not block and is not attacked', g.hp < 100 - D.shard.dps * 0.8 && r.dev.hp === D.shard.hp); }
  { const q = mk(), a = mk(), b = q.breaches.find((v) => v.floor === 0 && Math.abs(v.nz) > 0.5); const spot = (w) => ({ id: w.nextId++, x: b.x + 4, z: b.outZ - b.nz * 2, floor: 0, hp: 100, maxhp: 100, phase: 'approach', bp: b.i, timer: 0, cd: 99, face: 0 }); const g1 = spot(q), g2 = spot(a); q.gloom.push(g1); a.gloom.push(g2); q.place('sling', { x: b.x + 4, z: b.inZ + b.nz * 2 }); a.place('lance', { x: b.x + 4, z: b.inZ + b.nz * 2 }); q.step(0.1); a.step(0.1); check('Sling Press: lobs over the wall where a lance has no line of sight', g1.hp < 100 && g2.hp === 100); }
  { const q = mk(), a = mk(); q.place('lance', { x: 0, z: 0 }); q.place('prism', { x: 1, z: 0 }); a.place('lance', { x: 0, z: 0 }); const g1 = G(q, 3, 0), g2 = G(a, 3, 0); q.step(0.1); a.step(0.1); check('Prism Lens: a lance near it does not hit harder (Nov 24: your own shots only, CONFIG.devices.prism.turrets false)', !D.prism.turrets && Math.abs((100 - g1.hp) - (100 - g2.hp)) < 1e-9 && g2.hp < 100); }
  { const q = mk(), a = mk(); for (const w of [q, a]) { w.player.x = 0; w.player.z = 0; w.player.yaw = 0; w.player.pitch = 0; w.player.energy = 90; } q.place('prism', { x: 1, z: 0 }); const g1 = G(q, 0, -3), g2 = G(a, 0, -3); q.fireCannon('ray'); a.fireCannon('ray'); check('Prism Lens: your own shot fired near it hits CONFIG.devices.prism.boost x harder', g2.hp < 100 && Math.abs((100 - g1.hp) - (100 - g2.hp) * D.prism.boost) < 1e-9, (100 - g1.hp).toFixed(2) + ' vs ' + (100 - g2.hp).toFixed(2)); }
  { const q = mk(); q.player.x = 2; q.player.z = 0; q.player.hp = 1e6; const r = q.place('chime', { x: -6, z: 0 }); const g = G(q, 0, 0); g.cd = 0; run(q, 1); check('Chime Pole: pulls Gloom toward it, away from the player', g.x < -0.5); }
  { const q = mk(); q.place('moon', { x: 0, z: 0 }); q.player.energy = 10; run(q, 2); check('Moon Panel: makes energy at night', Math.abs(q.player.energy - 10 - D.moon.energyPerSec * 2) < 0.01); }
  { const q = mk(); const a1 = q.place('turbine', { x: 2, z: 2 }), a2 = q.place('moon', { x: -2, z: 2 }), a3 = q.place('turbine', { x: 2, z: -2 }), a4 = q.place('moon', { x: -2, z: -2 }); check('energy makers share one limit: two in all, turbines and moon panels together; the moon panel costs more and makes more', a1.ok && a2.ok && a3.reason === 'group' && a4.reason === 'group' && D.moon.cost > D.turbine.cost && D.moon.energyPerSec > D.turbine.energyPerSec); }
  const B = await import('./src/base.js'); const sv = B.newSave(CONFIG, 3);
  check('loadout: three slots, the starting four devices known, the rest locked', B.slots(CONFIG, sv) === 3 && B.unlocked(CONFIG, sv).join() === 'turbine,lance,panel,mine' && B.loadout(CONFIG, sv).join() === 'turbine,lance,panel' && B.setLoadout(CONFIG, sv, 2, 'twin') === false);
  check('loadout: swapping in a device you know; picking one already carried swaps the two slots', B.setLoadout(CONFIG, sv, 2, 'mine') && B.loadout(CONFIG, sv).join() === 'turbine,lance,mine' && B.setLoadout(CONFIG, sv, 0, 'mine') && B.loadout(CONFIG, sv).join() === 'mine,lance,turbine');
  sv.essentials = 200; const r1 = B.startResearch(CONFIG, sv, 'dev_twin'); sv.project.left = 1; B.helpResearch(CONFIG, sv); const r2 = B.startResearch(CONFIG, sv, 'slots'); sv.project.left = 1; sv.helped = -1; B.helpResearch(CONFIG, sv);
  check('workshop: a device unlock and an extra slot are research projects paid in essentials', r1.ok && r2.ok && sv.essentials === 200 - CONFIG.base.upgrades.dev_twin.cost[0] - CONFIG.base.upgrades.slots.cost[0] && B.unlocked(CONFIG, sv).includes('twin') && B.slots(CONFIG, sv) === 4 && B.loadout(CONFIG, sv).length === 4 && B.setLoadout(CONFIG, sv, 3, 'twin'));
  check('every device in the roster has a name and a Workshop unlock unless it is a starting device', Object.keys(D).filter((k) => k !== 'collector').length === 14 && Object.keys(D).every((k) => k === 'collector' || (D[k].name && (CONFIG.loadout.start.includes(k) || CONFIG.base.upgrades['dev_' + k]))));
  const old = { v: 4, seed: 1, day: 3, food: 5, essentials: 2, cats: sv.cats, personnel: sv.personnel, quests: sv.quests, up: { panel: 1, turbine: 0, energy: 0 }, revealed: {}, nights: 2 }; const st = { getItem: () => JSON.stringify(old) }; const ld = B.loadSave(CONFIG, st);
  check('an older save gets the new fields (unlock levels, loadout)', ld.day === 3 && ld.up.panel === 1 && ld.up.dev_twin === 0 && ld.up.slots === 0 && ld.loadout.join() === 'turbine,lance,panel');
}
check('cannon only hits Gloom on the player\'s floor', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); t.player.floor = 0; t.gloom.push({ id: 1, x: 0, z: -5, floor: 1, hp: 50, maxhp: 50, phase: 'inside', bp: 0, timer: 0, cd: 9, face: 0 }); t.fireCannon('ray', 1); return t.gloom[0].hp === 50; })());

{ // rule: a Gloom always needs longer to get through a window than through a door, and longer still to a window on an upper floor
  const timeThrough = (type, floorMin) => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 3 }); t.spawns.length = 0; t.player.hp = 1e9;
    const b = t.breaches.find((q) => q.type === type && q.floor >= floorMin); t.gloom.push({ id: 1, x: b.outX, z: b.outZ, floor: 0, hp: 1e9, maxhp: 1e9, phase: 'approach', bp: b.i, timer: 0, cd: 0, face: 0 });
    let n = 0; while (t.gloom[0].phase !== 'inside' && n < 400) { t.step(0.1); n++; } return n * 0.1; };
  const door = timeThrough('door', 0), winG = timeThrough('window', 0), winU = timeThrough('window', 1);
  check('Gloom take longer through a window than a door (always)', winG > door, `door ${door.toFixed(1)}s, ground window ${winG.toFixed(1)}s`);
  check('Gloom take longer through an upper-floor window than a ground window', winU > winG, `upper window ${winU.toFixed(1)}s`);
  check('config keeps window delay above door delay', CONFIG.breachDelay.window > CONFIG.breachDelay.door);
}

{ // stairs can be barricaded; the barricade blocks the player and the Gloom and can be destroyed
  const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 5 }); t.spawns.length = 0; t.player.energy = 90; const st = t.stairs[0];
  t.player.x = st.bx + 1.6; t.player.z = st.bz + 0.2; t.player.floor = 0;
  const r = t.place('panel', { x: st.bx, z: st.bz });
  check('a panel can be placed on the stairs (bottom end)', r.ok && !!st.panelB);
  t.player.x = st.bx; t.player.z = st.bz; t.step(0.1);
  check('barricaded stairs block the player', t.player.floor === 0 && t.log.some((e) => e.e === 'blocked'));
  t.log.length = 0; t.player.x = 0; t.player.z = 6; t.player.floor = 1; t.player.hp = 1e9;
  t.gloom.push({ id: 1, x: st.bx + 0.6, z: st.bz, floor: 0, hp: 1e9, maxhp: 1e9, phase: 'inside', bp: 0, timer: 0, cd: 0, face: 0 });
  for (let i = 0; i < 30; i++) t.step(0.1);
  check('barricaded stairs hold the Gloom back (panel being hit)', t.gloom[0].floor === 0 && st.panelB && st.panelB.hp < CONFIG.devices.panel.hp);
  for (let i = 0; i < 200 && t.gloom[0].floor === 0; i++) t.step(0.1);
  check('the barricade is destroyed by the Gloom and the stairs open', !st.panelB && t.gloom[0].floor === 1);
  const u = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 5 }); u.spawns.length = 0; u.player.energy = 90; const s2 = u.stairs[0];
  u.player.x = s2.bx + 1.6; u.player.z = s2.bz; u.place('panel', { x: s2.bx, z: s2.bz }); const l = u.ladders[0]; u.player.x = l.x; u.player.z = l.z; for (let i = 0; i < 20; i++) u.step(0.1);
  check('the ladder still gets the player past a barricaded stair', u.player.floor === 1);
}

{ // cover and headshots: a panel covers 3/4 of a Gloom; only a head shot over the top gets through, for double damage
  check('panel height is 3/4 of Gloom height', Math.abs(CONFIG.cannon.panelH / CONFIG.cannon.gloomH - 0.75) < 0.02, (CONFIG.cannon.panelH / CONFIG.cannon.gloomH).toFixed(2));
  const mk = (pitch, withPanel) => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 2 }); t.spawns.length = 0; t.player.energy = 90; t.player.x = 0; t.player.z = 0; t.player.yaw = 0; t.player.pitch = pitch;
    if (withPanel) t.devices.push({ id: 50, kind: 'panel', x: 0, z: -3, floor: 0, hp: 50, cd: 0, bp: 0, tx: 0.45, tz: 0 });
    t.gloom.push({ id: 1, x: 0, z: -6, floor: 0, hp: 100, maxhp: 100, phase: 'inside', bp: 0, timer: 0, cd: 9, face: 0 }); t.fireCannon('ray', 1); return t.gloom[0].hp; };
  check('no cover: a level shot hits the body for normal damage', mk(0, false) === 100 - CONFIG.cannon.dmg, 'hp ' + mk(0, false));
  check('behind a panel: a level shot is blocked', mk(0, true) === 100);
  check('behind a panel: aiming up over the top hits the head for double damage', mk(Math.atan(0.1), true) === 100 - CONFIG.cannon.dmg * CONFIG.cannon.headMult, 'hp ' + mk(Math.atan(0.1), true));
  check('shooting too high misses over the Gloom', mk(Math.atan(0.3), false) === 100);
}
{ // the aimed shot hits what is drawn (owner Nov 18, "on phone I can't hit Ticks"; CONFIG.cannon.shapes, measured by tools/gloomhitcheck.cjs): every kind, at 2, 5 and 10 m, facing you and side-on
  const SH = CONFIG.cannon.shapes.low, PAD = CONFIG.cannon.shapePad, KS = Object.keys(SH);
  // fire at the point (lx, ly, lz) in the machine's own frame (as src/main.js turns its model: face + PI); returns '-' miss, 'h' hit, 'H' head shot
  // (angles: [yaw, pitch] given straight instead of a point)
  const W = (d, side, lx, ly, lz) => { const th = Math.atan2(0, -d) + (side ? Math.PI / 2 : 0) + Math.PI; return [lx * Math.cos(th) + lz * Math.sin(th), ly, -d - lx * Math.sin(th) + lz * Math.cos(th)]; };
  const shoot = (kind, d, side, lx, ly, lz, shapesOff, ang) => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 2, boss: false }); t.spawns.length = 0; const P = t.player; P.energy = 90; P.x = 0; P.z = 0; P.floor = 0;
    const g = { id: 1, kind, x: 0, z: -d, floor: 0, hp: 1e6, maxhp: 1e6, phase: 'inside', bp: 0, timer: 0, cd: 9, face: Math.atan2(0, -d) + (side ? Math.PI / 2 : 0) }; t.gloom.push(g);
    const [wx, wy, wz] = W(d, side, lx, ly, lz); P.yaw = ang ? ang[0] : Math.atan2(-wx, -wz); P.pitch = ang ? ang[1] : Math.atan2(wy - CONFIG.cannon.eye, Math.hypot(wx, wz));
    const keep = CONFIG.cannon.shapes; if (shapesOff) CONFIG.cannon.shapes = null; t.log.length = 0; t.fireCannon('ray', 1); CONFIG.cannon.shapes = keep;
    const ev = t.log.find((e) => e.e === 'shot'); return g.hp < 1e6 ? (ev && ev.head ? 'H' : 'h') : '-'; };
  const bad = { centre: [], head: [], beside: [], over: [] };
  for (const k of KS) { const S = SH[k], cx = S[0], cz = S[1], mid = Math.min(S[4], S[9]) / 2;
    for (const d of [2, 5, 10]) for (const side of [false, true]) { const w = k + ' ' + d + 'm' + (side ? ' side' : '');
      if (shoot(k, d, side, cx, mid, cz) !== 'h') bad.centre.push(w);
      if (shoot(k, d, side, S[5], (S[9] + S[10]) / 2, S[6]) !== 'H') bad.head.push(w);
      // past the whole padded body seen from the eye: 0.25 m (at its distance) beyond its rim farthest to either side, and over the rim that sticks up most
      const cs = []; for (let i = 0; i < 32; i++) { const a = i / 32 * 2 * Math.PI; for (const y of [0, S[4] + PAD]) cs.push(W(d, side, cx + Math.cos(a) * (S[2] + PAD), y, cz + Math.sin(a) * (S[3] + PAD))); }
      const [qx, qy, qz] = W(d, side, cx, mid, cz), yc = Math.atan2(-qx, -qz), pc = Math.atan2(qy - CONFIG.cannon.eye, Math.hypot(qx, qz)), m = Math.atan2(0.25, d);
      const da = cs.map((q) => Math.atan2(-q[0], -q[2]) - yc), up = Math.max(...cs.map((q) => Math.atan2(q[1] - CONFIG.cannon.eye, Math.hypot(q[0], q[2]))));
      if (shoot(k, d, side, 0, 0, 0, false, [yc + Math.max(...da) + m, pc]) !== '-' || shoot(k, d, side, 0, 0, 0, false, [yc + Math.min(...da) - m, pc]) !== '-') bad.beside.push(w);
      if (shoot(k, d, side, 0, 0, 0, false, [yc, up + m]) !== '-') bad.over.push(w); } }
  check('aimed shot: the middle of every kind\'s drawn body hits, not as a head shot (7 kinds, 2/5/10 m, facing and side-on)', !bad.centre.length, bad.centre.join(', '));
  check('aimed shot: every kind\'s drawn head counts as a head shot', !bad.head.length, bad.head.join(', '));
  check('aimed shot: 0.25 m beside either side of the drawn body misses', !bad.beside.length, bad.beside.join(', '));
  check('aimed shot: 0.25 m over the drawn top misses', !bad.over.length, bad.over.join(', '));
  { const S = SH.ticks, near = S[1] + S[3] - 0.1, low = S[4] * 0.4;
    // the Ticks' near end (facing you, the machine's +z end is the near one), low down, 2 m away: the old cylinder put that shot into the ground before it reached the centre
    check('aimed shot: a Ticks hit low on its near end from 2 m (missed with the old cylinder)', shoot('ticks', 2, false, S[0], low, near) === 'h' && shoot('ticks', 2, false, S[0], low, near, true) === '-'); }
  check('aimed shot: a Gloom without a kind keeps the old cylinder (level shot hits, a shot 0.3 m over 2.4 m misses)', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 2, boss: false }); t.spawns.length = 0; t.player.energy = 90; t.player.yaw = 0; t.player.pitch = 0; t.gloom.push({ id: 1, x: 0, z: -6, floor: 0, hp: 100, maxhp: 100, phase: 'inside', bp: 0, timer: 0, cd: 9, face: 0 }); t.fireCannon('ray', 1); const a = t.gloom[0].hp < 100; t.player.pitch = Math.atan((2.7 - 1.6) / 6); t.player.cd = 0; const h = t.gloom[0].hp; t.fireCannon('ray', 1); return a && t.gloom[0].hp === h; })());
  { // per graphics tier (owner Nov 18 12:11): phones, bots and tests use shapes.low; desktop uses shapes.high, and a live shape (the model as drawn this frame) wins over both
    const lo = CONFIG.cannon.shapes.low.stilt, hi = CONFIG.cannon.shapes.high.stilt, side = (S) => S[0] + S[2] + PAD;
    // a level-ish shot passing just outside the desktop Stilt's side but inside the lenient phone shape (the phone's Stilt reaches further sideways)
    const x = (side(lo) + side(hi)) / 2, aim = (o, live) => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 2, boss: false, ...o }); t.spawns.length = 0; const P = t.player; P.energy = 90; t.gloom.push({ id: 7, kind: 'stilt', x: 0, z: -5, floor: 0, hp: 1e6, maxhp: 1e6, phase: 'inside', bp: 0, timer: 0, cd: 9, face: Math.PI });
      const th = 2 * Math.PI, wx = x * Math.cos(th), wz = -5 - x * Math.sin(th); P.yaw = Math.atan2(-wx, -wz); P.pitch = Math.atan2(1.0 - CONFIG.cannon.eye, Math.hypot(wx, wz)); t.fireCannon('ray', 1, false, live || null); return t.gloom[0].hp < 1e6; };
    check('aimed shot per tier: a shot just past the desktop Stilt\'s side hits with the phone shapes (leeway) and misses with the desktop shapes', side(lo) > side(hi) + 0.1 && aim({}) && !aim({ shotTier: 'high' }), 'phone side ' + side(lo).toFixed(2) + ' m, desktop ' + side(hi).toFixed(2) + ' m');
    check('aimed shot per tier: a live (as drawn) shape wins over the tier shapes', !aim({}, { 7: [0, 0, 0.2, 0.2, 2, 0, 0, 0.1, 0.1, 1.8, 2] }) && aim({ shotTier: 'high' }, { 7: [x, 0, 0.3, 0.3, 2, x, 0, 0.1, 0.1, 1.8, 2] })); }
  check('aimed shot: a Gloom halfway up the stairs is drawn (and hit) half a floor up (sim.gloomY)', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); const g = { id: 1, kind: 'walker', x: 0, z: 0, floor: 0, hp: 9, maxhp: 9, phase: 'inside', bp: 0, timer: 0, cd: 9, face: 0, climb: { to: 1, t: 1, dur: 2 } }; return Math.abs(t.gloomY(g) - CONFIG.floorH / 2) < 1e-9; })());
}
{ // the open stair and ladder gaps upstairs (owner Nov 18, CONFIG.fall): walking over one drops you to the floor below; the stair-top marker still takes the stairs
  let h = -1, s; for (let i = 0; i < 12; i++) { s = createSim({ cfg: CONFIG, ring: 0, house: i, seed: 1 }); if (s.L >= 2) { h = i; break; } }
  const st = s.stairs[0], l = s.ladders[0], p = s.player, run = () => { s.log.length = 0; for (let k = 0; k < 3; k++) s.step(0.05); return s.log.map((e) => e.e); };
  p.floor = 1; p.x = (st.bx + st.tx) / 2 - 0.4; p.z = st.bz + 0.1; p.stairCd = 0; p.ladderCd = 0; p.climb = null; let ev = run();
  check('stair gap: standing over the middle of the open stair gap upstairs drops you to the floor below', h >= 0 && p.floor === 0 && ev.includes('fall'));
  p.floor = 1; p.x = st.bx - 3; p.z = st.bz - 3; p.stairCd = 0; ev = run(); check('stair gap: solid floor away from the gaps keeps you upstairs', p.floor === 1 && !ev.includes('fall'));
  p.floor = 1; p.x = st.bx - 0.6 - 0.05; p.z = st.bz; p.stairCd = 0; ev = run(); check('stair gap: just outside the gap rim keeps you upstairs', p.floor === 1 && !ev.includes('fall'));
  p.floor = 1; p.x = st.tx; p.z = st.tz; p.stairCd = 0; ev = run(); check('stair gap: on the stair-top marker you walk down the stairs (no fall)', p.floor === 0 && !ev.includes('fall'));
  p.floor = 1; p.x = l.x + 0.52; p.z = l.z + 0.52; p.stairCd = 0; p.ladderCd = 0; p.climb = null; ev = run(); check('stair gap: a ladder-gap corner outside the ladder marker drops you', p.floor === 0 && ev.includes('fall'));
}
// balance
const res = {};
for (const house of [0, 5]) for (const sk of Object.keys(SKILLS)) {
  let wins = 0, hp = 0, zero = 0, en = 0;
  for (let seed = 1; seed <= N; seed++) { const s = runBot(sk, CONFIG, 0, house, seed); if (s.win) wins++; hp += s.player.hp; zero += s.zeroEnergyTime; en += 100 * s.energySum / s.steps / CONFIG.player.energyCap; }
  res[`${house}:${sk}`] = { win: (wins / N) * 100, hp: hp / N, zero: zero / N, energy: en / N };
}
const bp = (h) => CONFIG.ring.bpBase[h];
console.log(`\nring 1, ${N} runs per row, gloomPerBP=${CONFIG.gloom.gloomPerBP}`);
console.log('house  skill     win%   avgHP  zeroEnergy(s)  energy%');
for (const k of Object.keys(res)) { const [h, sk] = k.split(':'); const r = res[k]; console.log(`${String(bp(+h)).padStart(2)}-BP  ${sk.padEnd(8)} ${r.win.toFixed(0).padStart(4)}  ${r.hp.toFixed(0).padStart(6)}  ${r.zero.toFixed(1).padStart(8)}  ${r.energy.toFixed(0).padStart(8)}`); }
console.log('');
const w = (h, sk) => res[`${h}:${sk}`].win;
// (OWNER DECISION Nov 24, turret fairness panel) the stacker check '14-BP stacker is not invincible: 75-95%' is replaced by the strategy checks below (tools/strategysuite.mjs)
check('14-BP stacker energy bar is not always full (mean <= 60% of cap)', res['0:stacker'].energy <= 60, res['0:stacker'].energy.toFixed(0) + '%');
check('14-BP novice wins less than the stacker', w(0, 'novice') < w(0, 'stacker'), w(0, 'novice').toFixed(0) + '%');
check('4-BP novice wins >= 85% (target about 90)', w(5, 'novice') >= 85, w(5, 'novice').toFixed(0) + '%');
check('14-BP expert wins >= stacker', w(0, 'expert') >= w(0, 'stacker'), w(0, 'expert').toFixed(0) + '%');
check('eating heals and costs carried food', (() => { const e = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); e.player.hp = 50; const f = e.food; return e.eat() && e.player.hp === 50 + CONFIG.food.heal && e.food === f - 1 && e.eat() === false; })());

// caps + wall line of sight
{ const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); t.player.energy = 100; t.player.x = 0; t.player.z = 0;
  let ok = 0; for (let i = 0; i < 6; i++) { t.player.x = i * 0.3; if (t.place('turbine').ok) ok++; }
  check('turbine cap: only max placed, next refused with reason cap', ok === CONFIG.devices.turbine.max && t.place('turbine').reason === 'cap', 'placed ' + ok); }
{ const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }); t.player.x = 0; t.player.z = 0; t.player.pitch = 0; t.player.yaw = 0; t.player.energy = 50;
  const far = t.breaches.length ? 0 : 0; const H = t.H;
  t.gloom.push({ id: 90, x: 0, z: -(H + 2.5), hp: 20, maxhp: 20, phase: 'approach', bp: 0, floor: 0, timer: 0, cd: 0, face: 0 });
  const before = t.gloom[0].hp; t.fireCannon('auto', 1);
  check('cannon cannot hit a Gloom through a solid wall (no opening on the line)', t.gloom[0].hp === before, 'hp ' + t.gloom[0].hp); }

// RELOAD = LEFT (Nov 24, abuse list): a reload before the night is banked counts as leaving it; never on the first night (src/base.js markPending / settlePending)
{ const TB = await import('./src/base.js'), mem = {}, st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const a = TB.newSave(CONFIG, 9); a.nights = 2; a.day = 3; a.lossRun = 0; const ro = a.ringOpen || 1; TB.markPending(a, 1); TB.writeSave(a, st); const l = TB.loadSave(CONFIG, st);
  check('reload = left: a save loaded with a night still pending counts it as left (day and nights +1, no ring opened, loss streak +1, mark cleared)', l.day === 4 && l.nights === 3 && (l.ringOpen || 1) === ro && l.lossRun === 1 && !l.pending && l.settledLeave === true, JSON.stringify({ day: l.day, nights: l.nights, ring: l.ringOpen, lossRun: l.lossRun, pending: !!l.pending }));
  const b = TB.newSave(CONFIG, 10); TB.markPending(b, 0); TB.writeSave(b, st); const m = TB.loadSave(CONFIG, st);
  check('reload = left: not on the very first night (the first night is simply played again)', m.day === b.day && m.nights === 0 && !m.pending && !m.settledLeave, 'day ' + m.day + ', nights ' + m.nights);
  const c = TB.newSave(CONFIG, 11); c.nights = 1; TB.markPending(c, 0); TB.applyNight(CONFIG, c, { win: true, ring: 0, food: 3, essentials: 2, coins: 0 }, 5); TB.writeSave(c, st); const k = TB.loadSave(CONFIG, st);
  check('reload = left: a banked night leaves no mark (reloading after dawn changes nothing)', !k.pending && !k.settledLeave && k.nights === 2, 'nights ' + k.nights); }

// TOUGH (OWNER DECISION Nov 23 23:26, CONFIG.tough): rings 1-3 tougher machines from the second night, eased after a lost night, same number alive (frame rate)
{ const TB = await import('./src/base.js'), sv = TB.newSave(CONFIG, 5), t0 = TB.toughHp(CONFIG, sv, 0); sv.nights = 1; sv.lossRun = 0; const t1 = TB.toughHp(CONFIG, sv, 0), t4 = TB.toughHp(CONFIG, sv, 3);
  sv.lossRun = 1; const tl = TB.toughHp(CONFIG, sv, 0), want = 1 + (CONFIG.tough.hp[0] - 1) * CONFIG.tough.ease;
  check('tough: first night 1, ring 1 later CONFIG.tough.hp[0], ring 4 1, after a lost night eased by CONFIG.tough.ease', t0 === 1 && t1 === CONFIG.tough.hp[0] && t4 === 1 && Math.abs(tl - want) < 1e-9, [t0, t1, t4, tl].join('/'));
  const sim = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 3, toughHp: 1.5 }), b = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 3 }); for (let i = 0; i < 200; i++) { sim.step(0.1); b.step(0.1); }
  check('tough: a tougher night spawns the same number of Gloom with toughHp x the health', sim.spawns.length === b.spawns.length && sim.gloom.length > 0 && sim.gloom.every((g, i) => Math.abs(g.maxhp - 1.5 * b.gloom[i].maxhp) < 1e-6), sim.gloom.length + ' alive');
  const M = Math.min(N, 24), peak = (th) => { const a = []; for (let h = 0; h < 6; h++) for (let i = 1; i <= Math.ceil(M / 6); i++) { let m = 0; const k = SKILLS.average; SKILLS.average = { ...k, probe: (q) => { if (q.gloom.length > m) m = q.gloom.length; } }; runBot('average', CONFIG, 2, h, i * 97 + h, { toughHp: th }); SKILLS.average = k; a.push(m); } a.sort((x, y) => x - y); return a[a.length >> 1]; };
  const p0 = peak(1), p1 = peak(CONFIG.tough.hp[2]);
  check('tough: most Gloom alive at once on ring 3 (average bot, median) not above the old health + 1 (frame-rate budget)', p1 <= p0 + 1, p0 + ' -> ' + p1);
  /* (Nov 24) the runBot expert ring-1 window (70-96%) moved to the strategy checks below (expert aim over six strategies) */ }

// STRATEGIES (OWNER DECISION Nov 24, turret fairness panel, docs/turret-fairness-panel.md): replaces the stacker's ring-1 window and ring curve.
// Six ways to hold a house (tools/strategysuite.mjs: turtle, spread, traps, panels, flask, gunner), the same nights for each, CONFIG.tough as from the second night.
{ const { suite } = await import('./tools/strategysuite.mjs'), SD = 8, A = suite(CONFIG, SD, ['average'], undefined, true), E = suite(CONFIG, SD, ['expert'], undefined, true);
  const good = [0, 1, 2].map((r) => A.filter((x) => x.win[r] >= 80).length), alone = A.filter((x) => [0, 1, 2].every((r) => x.win[r] === 100 && x.hurt[r] === 0)).map((x) => x.st);
  check('strategies: at average aim, at least 3 of the 6 win >= 80% on each of rings 1-3 (not one answer)', good.every((g) => g >= 3), 'per ring ' + good.join('/') + ' | ' + A.map((x) => x.st + ' ' + x.win.slice(0, 3).join('/')).join(', '));
  check('strategies: no strategy at average aim wins every night unhit on rings 1-3 (the wall turtle was)', alone.length === 0, alone.join(',') || 'none');
  const best = [0, 1, 2, 3, 4].map((r) => Math.max(...A.map((x) => x.win[r])));
  check('strategies: ring curve at average aim (best strategy) falls gently ring 1..5 (no step over 50 points, ring 1 >= 80, ring 5 <= 80)', best.every((v, i) => i === 0 || best[i - 1] - v <= 50) && best[0] >= 80 && best[4] <= 80, best.join('/'));
  { const { EXPLOITS } = await import('./tools/strategysuite.mjs'), X = suite(CONFIG, 6, ['novice', 'average'], Object.keys(EXPLOITS), true), free = X.filter((x) => [0, 1, 2].every((r) => x.win[r] === 100 && x.hurt[r] === 0)).map((x) => x.sk + ' ' + x.st);
    check('exploits: none of the known abuse strategies (tools/strategysuite.mjs EXPLOITS: kill box, press traps, prism turtle, mist and shard, upstairs forts, prism gunner) wins every night unhit on rings 1-3 at novice or average aim', free.length === 0, free.join(', ') || X.map((x) => x.sk[0] + ':' + x.st + ' ' + x.win.slice(0, 3).join('/')).join(', ')); }
  const hit1 = E.filter((x) => x.hurt[0] >= 10).length;
  check('tough: ring 1 from the second night is a challenge at expert aim (at least 2 of 6 strategies hit on >= 10% of nights)', hit1 >= 2, E.map((x) => x.st + ' ' + x.win[0] + '/' + x.hurt[0]).join(', ')); }
{ const q = createSim({ cfg: CONFIG, ring: 4, house: 0, seed: 1 }); q.abandon();
  check('quitting the night pays the loss payout (1 food, 0 essentials), never a win', q.done && q.win === false && q.result.food === CONFIG.loot.minPayoutFood && q.result.essentials === 0); }
{ const q = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }), b = q.breaches.find((x) => x.floor === 1);
  q.gloom.push({ id: 5, x: b.outX, z: b.outZ, hp: 20, maxhp: 20, phase: 'approach', bp: b.i, floor: 0, timer: 0, cd: 0, face: 0 });
  check('an approaching Gloom counts as being on its breach point floor (shootable from upstairs)', q.gloom.length === 1 && (() => { q.player.floor = 1; q.player.x = b.inX - b.nx * 2; q.player.z = b.inZ - b.nz * 2; q.player.yaw = Math.atan2(-(b.outX - q.player.x), -(b.outZ - q.player.z)); q.player.pitch = 0.05; q.player.energy = 50; const h = q.gloom[0].hp; q.fireCannon('ray', 1); return q.gloom[0].hp < h || q.gloom.length === 0; })()); }
{ let bad = 0; for (let r = 0; r < 5; r++) for (let h = 0; h < 6; h++) { const q = createSim({ cfg: CONFIG, ring: r, house: h, seed: 1 }); if (q.L < 2) continue;
    for (const b of q.breaches) { if (Math.abs(b.x) > q.H - 1.29 && Math.abs(b.z) > q.H - 1.29) bad++;
      for (const st of q.stairs) { const dx = st.tx - st.bx, t = Math.max(0, Math.min(1, ((b.inX - st.bx) * dx) / (dx * dx))); if (Math.hypot(b.inX - st.bx - t * dx, b.inZ - st.bz) < 1.99) bad++; }
      for (const ld of q.ladders) if (Math.hypot(b.inX - ld.x, b.inZ - ld.z) < 1.99) bad++; } }
  check('breach openings keep off house corners and 2 m clear of stair and ladder markers (all rings, houses)', bad === 0, 'violations ' + bad); }
// base logic
{ const B = await import('./src/base.js'); const st = B.newSave(CONFIG, 7); B.makeQuests(CONFIG, st);
  check('base: new save has 3 personnel (one per role), 3 quests, a cat hideout and a Scout spot', st.personnel.length === 3 && new Set(st.personnel.map((p) => p.role)).size === 3 && st.personnel.some((p) => p.role === 'researcher') && st.quests.filter((q) => !q.giver).length === 3 && st.quests.filter((q) => q.giver).length === 3);
  const q = st.quests.find((x) => x.type === 'deliver'); q.state = 'active'; let carry = null;
  carry = B.interactStation(st, q.to, carry).carry; check('base: delivery cannot be handed in before pickup', carry === null && q.state === 'active');
  carry = B.interactStation(st, q.from, carry).carry; const f0 = st.food; const r = B.interactStation(st, q.to, carry);
  check('base: delivery pickup then handover pays food and completes', q.state === 'done' && st.food === f0 + CONFIG.base.quests.deliverFood && r.carry === null);
  st.food = 3; check('base: recruiting needs food', B.recruit(CONFIG, st).ok === false); st.food = CONFIG.base.recruitFood + 12; const n0 = st.personnel.length; const rr = B.recruit(CONFIG, st);
  check('base: recruiting spends food, adds a person to the thinnest role', rr.ok && st.personnel.length === n0 + 1 && st.food === 12);
  const h = st.quests.find((x) => x.type === 'hunt'); h.state = 'active'; const e0 = st.essentials, g0 = B.gloomMult(CONFIG, st);
  B.applyNight(CONFIG, st, { win: true, food: 5, essentials: 2 }, h.target);
  check('base: hunt quest completes from night kills and the day advances', st.day === 2 && st.quests.filter((q) => !q.giver).length === 3 && st.essentials >= e0 + 2);
  check('base: hunters thin the next night (multiplier < 1, capped)', g0 < 1 && g0 >= 1 - CONFIG.base.passive.hunterCap);
  check('base: an ODD number of cats hide, both kinds present, different spots', st.cats.length % 2 === 1 && st.cats.some((c) => c.type === 'energy') && st.cats.some((c) => c.type === 'lure') && new Set(st.cats.map((c) => c.spot)).size === st.cats.length, st.cats.map((c) => c.type[0]).join(''));
  const ce = st.cats.find((c) => c.type === 'energy'), cl = st.cats.find((c) => c.type === 'lure');
  check('base: a cat can be picked up once; it counts for nothing until placed', B.foundCat(st, ce.id) && B.foundCat(st, ce.id) === null && B.nightEnergyBonus(CONFIG, st) === 0);
  const u1 = B.useSlot(st, 0);
  check('base: placing reveals the kind, gives the first-time note once, and the energy cat adds start energy', u1.act === 'placed' && u1.first && u1.note && st.revealed.energy && B.nightEnergyBonus(CONFIG, st) === CONFIG.cat.energyBonus);
  B.foundCat(st, cl.id); const gm0 = B.gloomMult(CONFIG, st), lm0 = B.lootMult(CONFIG, st), u2 = B.useSlot(st, 1);
  check('base: the lure cat draws more Gloom and richer loot', u2.act === 'placed' && !u2.note && B.gloomMult(CONFIG, st) > gm0 && B.lootMult(CONFIG, st) > lm0);
  check('base: using an occupied slot takes the cat back', B.useSlot(st, 1).act === 'took' && B.lootMult(CONFIG, st) === lm0);
  const bram = B.npcQuestOf(st, 'bram'), f2 = st.food; let cr = null;
  const ac = B.takePosting(st, bram.id); cr = { questId: ac.id, to: ac.to }; const dl = B.interactStation(st, ac.to, cr);
  check('base: Bram\'s delivery posting is taken at the board; handing the crate over only makes it ready, the reward comes when you hand it in at the board', bram.state === 'ready' && dl.done && st.food === f2 && B.handIn(st, bram.id) && st.food > f2 && B.npcQuestOf(st, 'bram') === null);
  const pq = B.takePosting(st, B.npcQuestOf(st, 'pip').id); B.applyNight(CONFIG, st, { win: true, food: 0, essentials: 0 }, pq.target);
  check('base: a villager hunt quest becomes ready after enough Gloom and a new one is offered to others the next dawn', B.npcQuestOf(st, 'pip').state === 'ready' && !!B.npcQuestOf(st, 'oko') && B.scoutLine(st).length > 10 && /Potts/.test(B.scoutLine(st)));
  st.essentials = 20; const rs0 = B.startResearch(CONFIG, st, 'panel');
  check('base: research costs essentials, takes days, and only one project runs at a time', rs0.ok && st.essentials === 20 - CONFIG.base.upgrades.panel.cost[0] && st.project.left === CONFIG.base.upgrades.panel.days[0] && B.startResearch(CONFIG, st, 'turbine').ok === false);
  const hp = B.helpResearch(CONFIG, st), hp2 = B.helpResearch(CONFIG, st);
  check('base: the player can help once a day', hp.ok && !hp2.ok && (CONFIG.base.upgrades.panel.days[0] === 1 ? st.project === null && st.up.panel === 1 : st.project.left === CONFIG.base.upgrades.panel.days[0] - 1));
  const researchers = B.count(st, 'researcher'), left0 = st.project.left, apn = B.applyNight(CONFIG, st, { win: true, food: 1, essentials: 0 }, 0);
  check('base: researchers advance the project each dawn until it finishes and strengthens panels', researchers >= 1 && (st.project ? st.project.left < left0 : (apn.research && st.up.panel === 1 && B.makeCfg(CONFIG, st).devices.panel.hp > CONFIG.devices.panel.hp)));
  const f0q = st.food; B.applyNight(CONFIG, st, { win: false, lasted: 10, food: 1, essentials: 0 }, 0);
  check('base: dying almost at once earns only the minimum payout (no farming by dying)', st.food === f0q + 1);
  const f1 = st.food; B.applyNight(CONFIG, st, { win: false, lasted: CONFIG.base.tryTime + 5, food: 1, essentials: 0 }, 0);
  check('base: gatherers bring food and hunters bring scrap each dawn', st.food >= f1 + 1 + B.count(st, 'gatherer') * CONFIG.base.passive.gatherFood);
  const pid = st.personnel[0].id, r0 = st.personnel[0].role; B.cycleRole(st, pid);
  check('base: crew roles can be changed', st.personnel[0].role !== r0);
  const mem = { v: null, setItem(k, v) { this.v = v; }, getItem() { return this.v; } }; B.writeSave(st, mem); const back = B.loadSave(CONFIG, mem);
  check('base: save round-trips and survives broken storage', back.cats.length === st.cats.length && back.day === st.day && B.loadSave(CONFIG, { getItem() { throw new Error('no'); } }).day === 1);
  const sim2 = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1, extraEnergy: 5, gloomMult: 0.5, noCat: true }), sim3 = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 });
  check('sim: extra energy, Gloom multiplier and noCat options work', sim2.player.energy === sim3.player.energy + 5 && sim2.total < sim3.total && sim2.cat.found === true); }

// ---- furniture (2026-11-14): upright pieces in the run's houses; clear of openings, stairs and the cat; the player and the Gloom go round them
{
  let total = 0, bad = 0, inside = 0, stuck = 0, nights = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const run = createRun(CONFIG, seed % 5, seed * 7919);
    for (const h of run.houses) {
      const s = h.sim; total += s.furn.length;
      for (const q of s.furn) { if (s.breaches.some((b) => b.floor === q.floor && Math.hypot(b.inX - q.x, b.inZ - q.z) < q.r + 1.39)) bad++; if (q.floor === 0 && Math.hypot(s.cat.x - q.x, s.cat.z - q.z) < q.r + 2.59) bad++; if (s.stairs.some((st) => st.f === q.floor && Math.hypot(st.bx - q.x, st.bz - q.z) < q.r + 1.3)) bad++; }
      const q0 = s.furn.find((q) => q.floor === 0); if (q0) { const dq = Math.hypot(q0.x, q0.z) || 1, ux = -q0.x / dq, uz = -q0.z / dq; s.player.x = q0.x + ux * (q0.r + 1.0); s.player.z = q0.z + uz * (q0.r + 1.0); for (let k = 0; k < 80; k++) { s.move(-ux, -uz, 0.05); if (Math.hypot(s.player.x - q0.x, s.player.z - q0.z) < q0.r + 0.29) { inside++; break; } } }
    }
    // a night with the player standing still behind a piece of furniture: the Gloom must still reach and kill them (nobody gets stuck)
    const h = run.houses.find((q) => q.sim.furn.some((f) => f.floor === 0)); if (!h) continue; const s = h.sim, f0 = s.furn.find((f) => f.floor === 0), d = Math.hypot(f0.x, f0.z) || 1;
    s.player.x = Math.max(-s.H + 0.4, Math.min(s.H - 0.4, f0.x + (f0.x / d) * (f0.r + 0.5))); s.player.z = Math.max(-s.H + 0.4, Math.min(s.H - 0.4, f0.z + (f0.z / d) * (f0.r + 0.5))); s.endDay();
    for (let k = 0; k < 2200 && !s.done; k++) s.step(0.1); nights++; if (!s.done || (s.result && s.result.win)) stuck++;
  }
  check('run houses have upright furniture (' + total + ' pieces in 72 houses)', total > 72);
  check('no furniture stands in front of an opening, on the stairs or by the cat', bad === 0, String(bad));
  check('the player cannot walk into furniture', inside === 0, String(inside));
  check('Gloom get round furniture to a player hiding behind it (' + nights + ' nights)', stuck === 0, String(stuck));
}
// the seven machines have their own rules (2026-11-14)
{
  const kindsIn = (ring, seed) => { const t = createSim({ cfg: CONFIG, ring, house: 0, seed }); const ks = new Set(); for (let i = 0; i < 1500 && !t.over; i++) { t.player.hp = 100; t.step(0.1); for (const g of t.gloom) ks.add(g.kind); } return ks; };
  const r0 = new Set(), r2 = new Set(); for (let sd = 1; sd <= 6; sd++) { for (const k of kindsIn(0, sd)) r0.add(k); for (const k of kindsIn(2, sd)) r2.add(k); }
  check('ring 1 brings at least five kinds of machine and never a Warden', r0.size >= 5 && !r0.has('warden'), [...r0].join(','));
  check('a Warden can come from ring 3 on', r2.has('warden'), [...r2].join(','));
  const one = (kind, f) => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 3 }); t.player.energy = 99; return f(t, kind); };
  const walkTime = (kind) => one(kind, (t) => { const b = t.breaches[0]; t.gloom.push({ id: 900, kind, x: b.outX - b.nx * 9, z: b.outZ - b.nz * 9, floor: 0, hp: 999, maxhp: 999, phase: 'approach', bp: 0, timer: 0, cd: 0, face: 0 }); const g = t.gloom[t.gloom.length - 1]; let n = 0; while (g.phase === 'approach' && n < 400) { t.player.hp = 100; t.step(0.1); n++; } return n; });
  check('a Lurcher reaches the wall sooner than a Walker, a Hauler later', walkTime('lurcher') < walkTime('walker') && walkTime('hauler') > walkTime('walker'), [walkTime('lurcher'), walkTime('walker'), walkTime('hauler')].join('/'));
  const panelLeft = (kind) => one(kind, (t) => { t.place('panel', { bp: 0 }); const b = t.breaches[0], hp0 = b.panel.hp; t.player.x = b.inX - b.nx * 5; t.player.z = b.inZ - b.nz * 5; t.gloom.push({ id: 901, kind, x: b.outX, z: b.outZ, floor: 0, hp: 999, maxhp: 999, phase: 'block', bp: 0, timer: 0, cd: 0, face: 0 }); for (let i = 0; i < 30 && b.panel; i++) { t.player.hp = 100; t.step(0.1); } return hp0 - (b.panel ? b.panel.hp : 0); });
  check('a Hauler breaks a panel faster than a Walker', panelLeft('hauler') > panelLeft('walker') * 1.3, panelLeft('hauler') + ' vs ' + panelLeft('walker'));
  const overHit = (kind) => one(kind, (t) => { t.place('panel', { bp: 0 }); const b = t.breaches[0]; t.player.x = b.inX; t.player.z = b.inZ; t.player.floor = b.floor; t.gloom.push({ id: 902, kind, x: b.outX, z: b.outZ, floor: 0, hp: 999, maxhp: 999, phase: 'block', bp: 0, timer: 0, cd: 0, face: 0 }); const h0 = t.player.hp; for (let i = 0; i < 25; i++) t.step(0.1); return h0 - t.player.hp; });
  check('a Stilt held at a panel hits a player standing close behind it; a Walker cannot', overHit('stilt') > 0 && overHit('walker') === 0, overHit('stilt') + ' vs ' + overHit('walker'));
  check('a Lantern hurries the Gloom near it', one('walker', (t) => { const b = t.breaches[0], mk = (id, kind, off) => ({ id, kind, x: b.outX - b.nx * (9 + off), z: b.outZ - b.nz * (9 + off), floor: 0, hp: 999, maxhp: 999, phase: 'approach', bp: 0, timer: 0, cd: 0, face: 0 }); t.gloom.push(mk(903, 'walker', 0), mk(904, 'lantern', 1)); t.step(0.1); return t.gloom.find((g) => g.id === 903).hurry === true && t.gloom.find((g) => g.id === 904).hurry === false; }));
}
// the workshop you walk into and Marla's house (owner Nov 16 23:32 / 23:35)
{ const B = await import('./src/base.js'); const fs = await import('fs');
  // Marla's workshop line: never before the first night, once on the first base visit after a night, never again
  const sv = B.newSave(CONFIG, 11); B.makeQuests(CONFIG, sv); const before = B.workshopTip(sv);
  B.applyNight(CONFIG, sv, { win: true, food: 3, essentials: 2 }, 1); const day2 = B.workshopTip(sv), told = B.markWorkshopTip(sv), again = B.workshopTip(sv), toldDay = sv.toldWorkshop;
  B.applyNight(CONFIG, sv, { win: false, food: 1, essentials: 0, lasted: 120 }, 0); const day3 = B.workshopTip(sv);
  check('workshop line: not before the first night, fires once on the first base visit after it, never again', !before && day2 && told && !again && toldDay === 2 && !day3 && !B.markWorkshopTip(sv), [before, day2, told, again, toldDay, day3].join(','));
  const longest = Math.max(...['ahead', 'behind you', 'on your left', 'on your right'].map((w) => B.WORKSHOP_TIP.replace('{w}', w).length));
  check('workshop line stays within 60 characters with the longest direction (' + longest + ')', longest <= 60);
  check('Oko stands inside the workshop, behind the bench', !CONFIG.workshop.on || (B.NPCS.oko.inside === 'workshop' && Math.abs(B.NPCS.oko.x - B.STATIONS.workshop.x) < 2 && Math.abs(B.NPCS.oko.z - B.STATIONS.workshop.z) < 1.6));
  // Marla's journal: the lines exactly as in docs/marla_journal.md; 0 trips = 1 line, n trips = n + 1 lines, after 30 the closing line repeats; every trip adds one
  const doc = fs.readFileSync('docs/marla_journal.md', 'utf8'), want = [...doc.matchAll(/^(\d+)\. (.+)$/gm)].map((m) => m[2]), endDoc = (/repeats a short closing line: "(.+)"/.exec(doc) || [])[1];
  check('Marla\'s journal: 30 lines and the closing line exactly as in docs/marla_journal.md', want.length === 30 && B.MARLA_JOURNAL.length === 30 && want.every((l, i) => l === B.MARLA_JOURNAL[i]) && endDoc === B.MARLA_JOURNAL_END, want.length + ' / ' + B.MARLA_JOURNAL.length);
  const J = (trips) => B.marlaJournal({ trips });
  check('Marla\'s journal: 0 trips give line 1 only', J(0).length === 1 && J(0)[0] === B.MARLA_JOURNAL[0]);
  check('Marla\'s journal: n trips give n + 1 lines, in order', [1, 2, 5, 17, 29].every((n) => J(n).length === n + 1 && J(n)[n] === B.MARLA_JOURNAL[n]) && J(29)[29] === B.MARLA_JOURNAL[29]);
  check('Marla\'s journal: after line 30 every trip adds the closing line once', J(30).length === 31 && J(30)[30] === B.MARLA_JOURNAL_END && J(33).length === 34 && J(33).slice(30).every((l) => l === B.MARLA_JOURNAL_END) && J(33).slice(0, 30).join() === B.MARLA_JOURNAL.join());
  const sj = B.newSave(CONFIG, 12); B.makeQuests(CONFIG, sj); const l0 = B.marlaJournal(sj).length, u0 = B.marlaJournalUnread(sj); B.readMarlaJournal(sj); const u1 = B.marlaJournalUnread(sj);
  B.applyNight(CONFIG, sj, { win: true, food: 3, essentials: 2 }, 1); B.applyNight(CONFIG, sj, { left: true, food: 0, essentials: 0 }, 0); const l2 = B.marlaJournal(sj).length, u2 = B.marlaJournalUnread(sj);
  check('Marla\'s journal: every trip (won, lost or left) adds one line; unread until read', l0 === 1 && u0 && !u1 && l2 === 3 && u2 && sj.trips === 2, [l0, u0, u1, l2, u2].join(','));
  const old = { v: 4, seed: 5, day: 6, food: 7, essentials: 3, nights: 5, cats: sj.cats, personnel: sj.personnel, quests: sj.quests, up: { panel: 0, turbine: 0, energy: 0 }, revealed: {} };
  const ld = B.loadSave(CONFIG, { getItem: () => JSON.stringify(old) });
  check('Marla\'s journal: an older save without the journal loads (trips from its nights, nothing read yet)', ld.day === 6 && ld.trips === 5 && ld.mjRead === 0 && B.marlaJournal(ld).length === 6 && B.marlaJournalUnread(ld) && !ld.toldWorkshop && B.workshopTip(ld), [ld.day, ld.trips, ld.mjRead].join(','));
  // margin labels (owner Nov 17 13:22): the first entry is there before any trip, so "First day.", then "Trip 1.", "Trip 2." ...; her words are untouched by the labels
  // the field guide's ink sketches (src/booksketches.js): every device has one
  { const SK = (await import('./src/booksketches.js')).SKETCHES; check('Journal field guide: every device has an ink sketch', Object.keys(CONFIG.devices).every((k) => SK[k] && SK[k].d.length > 40), Object.keys(CONFIG.devices).filter((k) => !SK[k]).join(',')); }
  check('Marla\'s journal: margin labels "First day.", then "Trip n." from the second entry', B.marlaLabel(0) === 'First day.' && B.marlaLabel(1) === 'Trip 1.' && B.marlaLabel(32) === 'Trip 32.' && J(32).every((l, i) => !l.startsWith(B.marlaLabel(i))), [B.marlaLabel(0), B.marlaLabel(1), B.marlaLabel(32)].join(' | '));
}
// the hatchery and its flock (owner Nov 17; src/flock.js, CONFIG.avians)
{ const B = await import('./src/base.js'), A = CONFIG.avians;
  const sv = B.newSave(CONFIG, 21); B.makeQuests(CONFIG, sv); const F = sv.avians;
  check('flock: a new game starts with ' + A.start[0] + ' hens and ' + A.start[1] + ' Sunquill, nothing laid yet', F.birds.filter((b) => b.kind === 'hen').length === A.start[0] && B.sunquills(F) === A.start[1] && F.coop === 0 && F.held === 0);
  const d1 = B.flockDay(CONFIG, sv, true); check('flock: every grown bird lays one egg a day into the coop', d1.laid === F.birds.length * A.eggsPerHen && F.coop === d1.laid, String(d1.laid));
  for (let i = 0; i < 5; i++) B.flockDay(CONFIG, sv, false); check('flock: the coop holds at most ' + A.coopMax + ' eggs', F.coop === A.coopMax, String(F.coop));
  const got = B.collectEggs(sv); check('flock: E at the nest boxes collects every egg', got === A.coopMax && F.coop === 0 && F.held === A.coopMax);
  const p1 = B.placeEgg(CONFIG, sv), p2 = B.placeEgg(CONFIG, sv), p3 = B.placeEgg(CONFIG, sv), p4 = B.placeEgg(CONFIG, sv);
  check('flock: the dome warms ' + A.slots + ' eggs at once', p1.ok && p2.ok && p3.ok && !p4.ok && F.inc.length === A.slots && F.held === A.coopMax - A.slots);
  const before = F.birds.length; B.flockDay(CONFIG, sv, false); const mid = F.chicks.length; B.flockDay(CONFIG, sv, false); const hatched = F.chicks.length;
  check('flock: eggs hatch after ' + A.hatchDays + ' days into chicks', mid === 0 && hatched === A.slots && F.inc.length === 0, mid + ' -> ' + hatched);
  B.flockDay(CONFIG, sv, false); B.flockDay(CONFIG, sv, false); check('flock: chicks grow into hens after ' + A.growDays + ' days', F.chicks.length === 0 && F.birds.length === before + A.slots, F.birds.length + ' birds');
  const full = B.placeEgg(CONFIG, sv); check('flock: at ' + A.maxFlock + ' birds no more eggs go in (the cap counts chicks and warming eggs)', B.flockSize(F) >= A.maxFlock - 1 ? !full.ok || B.flockSize(F) + F.inc.length <= A.maxFlock : true, B.flockSize(F) + ' + ' + F.inc.length);
  const capS = B.newSave(CONFIG, 22); capS.avians.held = 20; let placed = 0; for (let day = 0; day < 12; day++) { while (B.placeEgg(CONFIG, capS).ok) placed++; B.flockDay(CONFIG, capS, false); } check('flock: the flock never grows past ' + A.maxFlock, B.flockSize(capS.avians) + capS.avians.inc.length <= A.maxFlock, String(B.flockSize(capS.avians)));
  // Sunquill share over many seeded hatches; the same seed gives the same birds
  const share = (seed0) => { let n = 0, sq = 0; for (let k = 0; k < 120; k++) { const t = B.newSave(CONFIG, seed0 + k); t.avians.birds = []; t.avians.held = 3; for (let j = 0; j < 3; j++) B.placeEgg(CONFIG, t); B.flockDay(CONFIG, t, false); B.flockDay(CONFIG, t, false); for (const c of t.avians.chicks) { n++; if (c.kind === 'sunquill') sq++; } } return [n, sq]; };
  const [n1, s1] = share(1000), [n2, s2] = share(1000); check('flock: about ' + Math.round(A.sunquillChance * 100) + '% of hatches are Sunquills (' + s1 + ' of ' + n1 + '), seeded (same seeds, same birds)', n1 === 360 && Math.abs(s1 / n1 - A.sunquillChance) < 0.05 && s1 === s2 && n1 === n2);
  const ys = B.newSave(CONFIG, 23), f0 = ys.food, y = B.flockDay(CONFIG, ys, true); check('flock: each grown bird brings +' + A.foodPerHen + ' food a day, each Sunquill +' + A.seedPerSunquill + ' seed', y.food === ys.avians.birds.length * A.foodPerHen && ys.food === f0 + y.food && y.seeds === B.sunquills(ys.avians) * A.seedPerSunquill && ys.avians.seeds === y.seeds);
  const ls = B.newSave(CONFIG, 24), lf = ls.food, ly = B.flockDay(CONFIG, ls, false); check('flock: no food or seeds on a night you walked out of', ls.food === lf && ly.food === 0 && ls.avians.seeds === 0);
  const old = { v: 4, seed: 5, day: 4, food: 9, essentials: 1, nights: 3, cats: sv.cats, personnel: sv.personnel, quests: sv.quests, up: { panel: 0, turbine: 0, energy: 0 }, revealed: {} }, ld = B.loadSave(CONFIG, { getItem: () => JSON.stringify(old) });
  check('flock: an older save without the hatchery loads with ' + A.oldStart + ' hens', ld.day === 4 && ld.avians && ld.avians.birds.length === A.oldStart && ld.avians.birds.every((b) => b.kind === 'hen') && B.flockSize(ld.avians) === A.oldStart);
  check('flock: Marla\'s hatchery line is due once (' + B.HATCHERY_TIP.replace('{d}', 'pond').length + ' chars)', B.hatcheryTip(CONFIG, ld) && !B.hatcheryTip(CONFIG, Object.assign({}, ld, { toldHatchery: 4 })));
  // a 5-day demo: a new game, the player collects and warms every egg each day and wins every night: how much food the flock adds
  const demo = B.newSave(CONFIG, 31); B.makeQuests(CONFIG, demo); let flockFood = 0, seeds = 0; for (let d = 0; d < 5; d++) { B.collectEggs(demo); while (B.placeEgg(CONFIG, demo).ok); const r = B.applyNight(CONFIG, demo, { win: true, food: 0, essentials: 0 }, 0); flockFood += r.flock.food; seeds += r.flock.seeds; }
  console.log('INFO flock 5-day demo: +' + flockFood + ' food, +' + seeds + ' seeds from the flock; flock now ' + demo.avians.birds.length + ' grown, ' + demo.avians.chicks.length + ' chicks, ' + demo.avians.inc.length + ' eggs warming');
  check('flock: the 5-day demo adds a modest amount of food (' + flockFood + ')', flockFood > 0 && flockFood <= 5 * A.maxFlock * A.foodPerHen);
}
// the ambient village cats (owner Nov 17; src/catwalk.js): the HIDDEN LUCKY CAT rule
{ const B = await import('./src/base.js'), W = await import('./src/catwalk.js'), VC = CONFIG.villageCats, ng = W.noGo();
  for (const tier of ['high', 'low']) { const sv = B.newSave(CONFIG, 41); B.makeQuests(CONFIG, sv); const cats0 = JSON.stringify(sv.cats), placed0 = B.placedCats(sv), carried0 = B.carriedCats(sv);
    const br = W.createCatBrains(CONFIG, VC.count[tier], tier, 77); let minD = 1e9, rests = 0, walks = 0, perch = 0;
    for (let i = 0; i < 72000; i++) { const t = i * 0.1, run = i % 600 < 40; br.step(0.1, Math.cos(t * (run ? 0.6 : 0.05)) * 9, Math.sin(t * (run ? 0.8 : 0.07)) * 9, i > 70000);
      for (const c of br.cats) { for (const [x, z] of ng) minD = Math.min(minD, Math.hypot(c.x - x, c.z - z)); if (c.mode === 'rest') rests++; else walks++; if (c.y > 0.3) perch++; } }
    check('village cats (' + tier + ', ' + VC.count[tier] + ' cats, 2 hours of wandering with a player running about): never within ' + VC.keepAway + ' m of a lucky-cat hideout or the home cat shelf (closest ' + minD.toFixed(2) + ' m)', minD >= VC.keepAway);
    check('village cats (' + tier + '): they both stroll and laze (' + Math.round(100 * rests / (rests + walks)) + '% of the time resting, ' + (tier === 'high' ? 'on perches ' + Math.round(100 * perch / (rests + walks)) + '%' : '') + ')', rests > 0 && walks > 0);
    check('village cats (' + tier + '): no lucky-cat code counts them (save.cats, placed and carried cats unchanged)', JSON.stringify(sv.cats) === cats0 && B.placedCats(sv) === placed0 && B.carriedCats(sv) === carried0 && !('cats' in br && br.cats === sv.cats)); }
  check('village cats: no white coat (the lucky cat is white)', W.COATS.every((c) => { const col = c[1], r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255; return (r + g + b) / 3 < 200; }), W.COATS.map((c) => c[0]).join(', '));
  check('village cats: every spot and path point is ' + VC.keepAway + ' m or more from a hideout and the shelf', [...VC.nodes, ...VC.spots, ...VC.dusk].every((p) => ng.every(([x, z]) => Math.hypot(p[0] - x, p[1] - z) >= VC.keepAway)));
  // advisor round 2 (Nov 17): no black coat (a still black cat could pass for the black lucky-cat figurine), and a living cat is never fully still
  check('village cats: no black or solid dark coat (' + W.COATS.map((c) => c[0]).join(', ') + ')', W.COATS.every((c) => { const col = c[1], lum = (0.2126 * ((col >> 16) & 255) + 0.7152 * ((col >> 8) & 255) + 0.0722 * (col & 255)) / 255; return c[4] !== 'solid' && lum > 0.15 && !/black/i.test(c[0]); }));
  { const THREE = await import('three'), VCM = await import('./src/villagecats.js');
    for (const hi of [true, false]) { const g = new THREE.Group(), vc = VCM.createVillageCats(g, CONFIG, hi, 99); let worst = 0, blinks = true, flicks = true, breathes = true, shut = true;
      for (const act of ['loaf', 'sleep', 'sit']) { vc.cats.forEach((c) => Object.assign(c.b, { mode: 'rest', act, t: 0, dur: 999, actT: 0, actDur: 999, leave: false, roost: false }));
        const seen = vc.cats.map(() => ({ blink: false, flick: false, b0: 9, b1: -9, run: 0, prev: null }));
        for (let f = 0; f < 400; f++) { vc.update(0.05, 50, 50, false, []); vc.cats.forEach((c, k) => { const S = seen[k], a = []; c.root.traverse((o) => { if (o.isGroup || o.isMesh) a.push(o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y); });
          if (S.prev) { const d = Math.max(...a.map((v, i) => Math.abs(v - S.prev[i]))); S.run = d < 1e-4 ? S.run + 0.05 : 0; worst = Math.max(worst, S.run); } S.prev = a; S.b0 = Math.min(S.b0, c.body.scale.y); S.b1 = Math.max(S.b1, c.body.scale.y);
          if (c.eyes && c.eyes.scale.y < 0.5) S.blink = true; if (c.eyes && act === 'sleep' && f > 60 && c.eyes.scale.y > 0.2) shut = false; if (c.ears ? Math.abs(c.ears.rotation.x) > 0.1 : Math.abs(c.head.rotation.z - (c.cur ? c.cur.h[2] : 0)) > 0.005) S.flick = true; }); }
        seen.forEach((S) => { if (hi && act !== 'sleep' && !S.blink) blinks = false; if (!S.flick) flicks = false; if (S.b1 - S.b0 < 0.02) breathes = false; }); }
      check('village cats (' + (hi ? 'high' : 'low') + '): never fully still at rest (longest still ' + worst.toFixed(2) + ' s over 20 s each of loaf, sleep and sit): they breathe, ' + (hi ? 'blink (eyes shut asleep), flick an ear' : 'give a small head shake') + ' and flick the tail', worst < 0.5 && breathes && flicks && (!hi || (blinks && shut)));
    } }
}
// the quest board beside the Workshop; quests come ONLY from the board (owner Nov 17 15:59)
{ const B = await import('./src/base.js'), fs = await import('fs'), R = await import('./src/rooms.js'), H = await import('./src/flock.js'), VC = CONFIG.villageCats;
  const st = B.newSave(CONFIG, 11); B.makeQuests(CONFIG, st); const ids = Object.keys(B.NPCS);
  // talking to a villager never starts, takes or hands in a quest, whatever state their posting is in; they point you to the board while they have one
  let quiet = true, hinted = true;
  for (const phase of ['offered', 'active', 'ready']) { for (const id of ids) B.npcQuestOf(st, id).state = phase; const snap = JSON.stringify(st);
    for (const id of ids) for (let k = 0; k < 3; k++) { const T = B.npcTalk(st, id); if (!T || !T.line || T.hint !== (phase === 'ready' ? B.BOARD_HAND_IN : B.BOARD_HINT)) hinted = false; }
    if (JSON.stringify(st) !== snap) quiet = false; }
  for (const id of ids) B.npcQuestOf(st, id).state = 'done'; const none = ids.every((id) => B.npcTalk(st, id).hint === null);
  const src = fs.readFileSync('./src/main.js', 'utf8');
  check('quest board: talking to Bram, Oko or Pip never starts or completes a quest (offered, taken, done: the save is unchanged) and points to the board while they have a posting', quiet && hinted && none);
  check('quest board: no villager accept or claim is left (base.js exports none; the villager and Oko panels only read npcTalk, no Accept or Claim buttons)', !B.acceptNpc && !B.claimNpc && !/acceptNpc|claimNpc|data-a="nacc"|data-a="nclaim"|Claim reward/.test(src) && /startsWith\('npc:'\)\) \{\s*const n = B\.NPCS\[kind\.slice\(4\)\], T = B\.npcTalk\(save, n\.id\);/.test(src) && /kind === 'oko'\) \{\s*const T = B\.npcTalk\(save, 'oko'\);/.test(src));
  const s2 = B.newSave(CONFIG, 12); B.makeQuests(CONFIG, s2); const L = B.boardPostings(s2), byG = ids.map((id) => L.filter((q) => q.giver === id));
  check('quest board: it lists the board\'s own 3 quests and one posting in each villager\'s name (' + byG.map((a, i) => a.length && a[0].text.split(':')[0]).join(', ') + ')', L.filter((q) => !q.giver).length === 3 && byG.every((a, i) => a.length === 1 && a[0].text.startsWith(B.NPCS[ids[i]].name + ': ') && a[0].state === 'offered'));
  const okT = B.takePosting(s2, byG[2][0].id), okTwice = B.takePosting(s2, byG[2][0].id), early = B.handIn(s2, byG[2][0].id);
  check('quest board: a posting is taken once there, and cannot be handed in before it is done', okT && okT.state === 'active' && okTwice === null && early === null);
  // an older save: Bram's delivery under way (its old text), Pip's hunt done and waiting, Oko's still offered, the board's hunt under way: all carry over to the board
  const o = B.newSave(CONFIG, 13); B.makeQuests(CONFIG, o); const ob = B.npcQuestOf(o, 'bram'), op = B.npcQuestOf(o, 'pip'), oh = o.quests.find((q) => !q.giver && q.type === 'hunt');
  ob.state = 'active'; ob.text = 'Bram: take this crate of seedlings to Garden, then come back to me'; op.state = 'ready'; oh.state = 'active'; o.carry = { questId: ob.id, to: ob.to }; delete o.avians;
  const mem = { v: JSON.stringify(o), getItem() { return this.v; }, setItem(k, v) { this.v = v; } }, ld = B.loadSave(CONFIG, mem), lq = (q) => ld.quests.find((x) => x.id === q.id);
  const kept = lq(ob).state === 'active' && lq(op).state === 'ready' && lq(oh).state === 'active' && B.npcQuestOf(ld, 'oko').state === 'offered' && ld.carry && ld.carry.questId === ob.id && B.boardPostings(ld).length === ld.quests.length;
  const dl = B.interactStation(ld, ob.to, ld.carry), f0 = ld.food, hp = B.handIn(ld, op.id), hb = B.handIn(ld, ob.id);
  B.applyNight(CONFIG, ld, { win: true, food: 0, essentials: 0 }, 0); const after = ld.quests.find((x) => x.id === oh.id);
  check('quest board: an older save keeps its quests under way (Bram\'s crate in hand, Pip\'s done hunt, Oko\'s offer, the board\'s hunt) and hands them in at the board', kept && dl.done && hp && hb && ld.food > f0 && after && after.state === 'active');
  // where it stands: beside the workshop door, facing the plaza, clear of everything else
  const S = B.STATIONS.board, yaw = B.boardYaw(), [bhx, bhz] = B.BOARD_BOX, WS = R.roomInfo('workshop'), MH = R.roomInfo('marla'), [dx0, dz0] = R.doorAt(WS, 0);
  const boxD = (x, z) => { const dx = x - S.x, dz = z - S.z, lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw) + 0.12; return Math.hypot(Math.max(0, Math.abs(lx) - bhx), Math.max(0, Math.abs(lz) - bhz)); };
  const segD = (a, b) => { let m = 1e9; for (let t = 0; t <= 1.0001; t += 0.01) m = Math.min(m, boxD(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); return m; };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [S.x + u * bhx * Math.cos(yaw) + (v * bhz - 0.12) * Math.sin(yaw), S.z - u * bhx * Math.sin(yaw) + (v * bhz - 0.12) * Math.cos(yaw)]);
  const inWs = corners.some(([x, z]) => { const [lx, lz] = R.toLocal(WS, x, z); return Math.abs(lx) < WS.w / 2 + 0.3 && Math.abs(lz) < WS.d / 2 + 0.3; }), doorway = corners.concat([[S.x, S.z]]).some(([x, z]) => { const [lx, lz] = R.toLocal(WS, x, z); return Math.abs(lx) < WS.dw / 2 + 0.3 && lz > 0 && lz < WS.d / 2 + 1.8; });
  const face = [Math.sin(yaw), Math.cos(yaw)], toPl = [-S.x / Math.hypot(S.x, S.z), -S.z / Math.hypot(S.x, S.z)], faceDot = face[0] * toPl[0] + face[1] * toPl[1], doorD = Math.hypot(S.x - dx0, S.z - dz0);
  const catD = Math.min(...B.CAT_SPOTS.map((c) => boxD(c.x, c.z))), scoutD = Math.min(...B.SCOUT_SPOTS.map((c) => boxD(c.x, c.z))), shelfD = boxD(B.HOME.x, B.HOME.z);
  const paths = [...Object.entries(B.STATIONS).filter(([k]) => k !== 'board').map(([, s]) => [s.x * 0.8, s.z * 0.8]), [0, -7.4], [0, 14]], pathD = Math.min(...paths.map((e) => segD([0, 0], e)));
  const hr = H.hatchLayout(CONFIG).rect, hatchD = Math.min(...corners.map(([x, z]) => Math.max(Math.abs(x - hr.x) - hr.w / 2, Math.abs(z - hr.z) - hr.d / 2))), mhD = Math.min(...corners.map(([x, z]) => { const [lx, lz] = R.toLocal(MH, x, z); return Math.max(Math.abs(lx) - MH.w / 2, Math.abs(lz) - MH.d / 2); }));
  const cn = VC.nodes, cEdge = Math.min(...VC.edges.map(([a, b]) => segD(cn[a], cn[b]))), cSpot = Math.min(...VC.spots.map((q) => boxD(q[0], q[1])), ...VC.dusk.map((q) => boxD(q[0], q[1])));
  check('quest board: beside the Workshop door (' + doorD.toFixed(1) + ' m), outside the workshop and its doorway, facing the plaza (' + Math.round(Math.acos(faceDot) * 180 / Math.PI) + ' deg off)', doorD < 3.2 && !inWs && !doorway && faceDot > 0.95);
  check('quest board: clear of the paths (' + pathD.toFixed(2) + ' m from a path centre), hideouts (' + catD.toFixed(2) + '), the Scout\'s spots (' + scoutD.toFixed(1) + '), the home (' + shelfD.toFixed(1) + '), the hatchery (' + hatchD.toFixed(1) + '), Marla\'s house (' + mhD.toFixed(1) + ') and the village cats\' walks (' + cEdge.toFixed(2) + ') and spots (' + cSpot.toFixed(2) + ')',
    pathD > 0.95 && catD > 1.8 && scoutD > 3 && shelfD > 5 && hatchD > 0.5 && mhD > 3 && cEdge > 0.6 && cSpot > 1.0);
}
// lore pieces (owner Nov 17 16:25; src/lore.js): the texts are word for word from docs/lore_notes.md, notes are found once and saved, the journal lists them,
// the board's old notices move on by day, "Before:" lines only for machines met, and old saves still load
{ const B = await import('./src/base.js'), LO = await import('./src/lore.js'), fs = await import('fs'), doc = fs.readFileSync('docs/lore_notes.md', 'utf8');
  const sec = (a, b) => doc.slice(doc.indexOf(a), b ? doc.indexOf(b) : undefined);
  const dn = [...sec('## A.', '## B.').matchAll(/^\d+\. \*\*(.+?):\*\* "(.+)"\s*$/gm)].map((m) => [m[1], m[2]]);
  const db = [...sec('## B.', '## C.').matchAll(/^\d+\. "(.+?)"( \*\(.*\)\*)?\s*$/gm)].map((m) => m[1]);
  const dc = Object.fromEntries([...sec('## C.').matchAll(/^- \*\*(\w+):\*\* "(.+)"\s*$/gm)].map((m) => [m[1].toLowerCase(), m[2]]));
  check('lore: the 12 house notes are word for word as in docs/lore_notes.md', dn.length === 12 && LO.LORE_NOTES.length === 12 && dn.every(([l, t], i) => LO.LORE_NOTES[i].label === l && LO.LORE_NOTES[i].text === t), dn.length + ' / ' + LO.LORE_NOTES.length);
  check('lore: the 6 old notices are word for word as in docs/lore_notes.md', db.length === 6 && LO.OLD_NOTICES.length === 6 && db.every((t, i) => LO.OLD_NOTICES[i] === t), db.length + ' / ' + LO.OLD_NOTICES.length);
  check('lore: every machine kind has its "Before:" line word for word', Object.keys(CONFIG.gloom.kinds).every((k) => dc[k] && LO.BEFORE[k] === dc[k] && dc[k].startsWith('Before: ')) && Object.keys(dc).length === 7, Object.keys(dc).join(','));
  // notes are found once: picking for many houses never repeats a note, never gives a found one, and runs out with -1
  const sv = B.newSave(CONFIG, 11); B.makeQuests(CONFIG, sv); let q = 5; const rnd = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296);
  const taken = []; for (let h = 0; h < 6; h++) taken.push(LO.pickNote(sv, taken, rnd));
  check('lore: one run\'s six houses get six different notes', new Set(taken).size === 6 && taken.every((i) => i >= 0 && i < 12));
  const first = LO.markFound(sv, taken[0]), again = LO.markFound(sv, taken[0]);
  check('lore: a note is found once (a second pick-up adds nothing)', first === true && again === false && LO.foundList(sv).length === 1);
  let allOk = true; for (let k = 0; k < 40; k++) { const i = LO.pickNote(sv, [], rnd); if (i < 0) break; if (LO.foundList(sv).includes(i)) allOk = false; LO.markFound(sv, i); }
  check('lore: a found note is never offered again; when all 12 are found no house gets one', allOk && LO.foundList(sv).length === 12 && new Set(LO.foundList(sv)).size === 12 && LO.pickNote(sv, [], rnd) === -1);
  // saved: through the real save and load
  const mem = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } }, s2 = B.newSave(CONFIG, 12); B.makeQuests(CONFIG, s2); LO.markFound(s2, 4); LO.markFound(s2, 9); B.writeSave(s2, mem);
  const back = B.loadSave(CONFIG, mem);
  check('lore: found notes are saved and load back in the order found', back.seed === s2.seed && JSON.stringify(LO.foundList(back)) === '[4,9]');
  const jb = LO.foundBlocks(back);
  check('lore: the journal lists found notes under "Found notes" (label, then the words)', jb.length === 5 && jb[0].k === 'h2' && jb[0].text === 'Found notes' && jb[1].text === LO.LORE_NOTES[4].label && jb[2].text === LO.LORE_NOTES[4].text && jb[3].text === LO.LORE_NOTES[9].label && jb[4].text === LO.LORE_NOTES[9].text);
  check('lore: no "Found notes" pages before the first note', LO.foundBlocks(B.newSave(CONFIG, 13)).length === 0);
  // old saves (no loreFound field) load, show no found notes, and can find one
  const old = B.newSave(CONFIG, 14); B.makeQuests(CONFIG, old); delete old.loreFound; const mo = { d: { 'solardg.save': JSON.stringify(old) }, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } }, ol = B.loadSave(CONFIG, mo);
  check('lore: an old save without found notes loads as itself, with none found, and can find one', ol.seed === old.seed && LO.foundList(ol).length === 0 && LO.foundBlocks(ol).length === 0 && LO.markFound(ol, 0) && LO.foundList(ol).length === 1);
  // notices: N.shown at a time, the same within N.every days, then the next one comes round; every notice shows within a full turn
  const N = CONFIG.lore.notices, d1 = LO.noticesFor(1, N.shown, N.every), seen = new Set();
  for (let d = 1; d <= 6 * N.every; d++) LO.noticesFor(d, N.shown, N.every).forEach((t) => seen.add(t));
  check('lore: the board shows ' + N.shown + ' old notices, the same for ' + N.every + ' days, then they move on; all 6 come round', d1.length === N.shown && N.shown >= 2 && N.shown <= 3 && JSON.stringify(LO.noticesFor(N.every, N.shown, N.every)) === JSON.stringify(d1) && JSON.stringify(LO.noticesFor(N.every + 1, N.shown, N.every)) !== JSON.stringify(d1) && seen.size === 6);
  // the field guide: "Before:" only under machines met
  const K = CONFIG.gloom.kinds, met = { walker: true, lurcher: true }, gb = Object.keys(K).map((k) => LO.guideMachine(k, K, met)), txt = JSON.stringify(gb);
  check('lore: the field guide shows "Before:" only for machines met', Object.keys(K).every((k, i) => (met[k] ? gb[i].some((b) => b.text === LO.BEFORE[k]) : gb[i].length === 1 && gb[i][0].k === 'unk')) && (txt.match(/Before: /g) || []).length === 2);
  check('lore: no machine met, no "Before:" line', !JSON.stringify(Object.keys(K).map((k) => LO.guideMachine(k, K, {}))).includes('Before:'));
  // the panel-tender's job (owner 16:56): the journal's duties, Marla's line once, the card once
  const db2 = LO.dutyBlocks(), dtx = db2.map((x) => x.text);
  check('job: the journal starts with the panel-tender\'s three duties and the guide', db2[0].k === 'h3' && /duties/.test(db2[0].text) && db2.length === 5 && /panels/.test(dtx[1]) && /food and essentials/.test(dtx[2]) && /Gloom until dawn/.test(dtx[3]) && dtx[4] === 'Work with your guide: Marla the Scout.');
  const js = B.newSave(CONFIG, 15), l1 = LO.jobLine(js), l2 = LO.jobLine(js), jn = B.newSave(CONFIG, 16); jn.nights = 2;
  check('job: Marla\'s job line plays once (' + LO.JOB_LINE.length + ' chars, at most 90), and never after the first night', l1 === LO.JOB_LINE && l2 === null && js.toldJob === true && LO.JOB_LINE.length <= 90 && LO.jobLine(jn) === null);
  const jc = B.newSave(CONFIG, 17), due0 = LO.jobCardDue(jc), m1 = LO.markJobCard(jc), m2 = LO.markJobCard(jc);
  check('job: the "Your job" card is due once per save (gone once seen, never for a save past its first night)', due0 && m1 && !m2 && !LO.jobCardDue(jc) && !LO.jobCardDue(jn));
  const mj = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } }; B.makeQuests(CONFIG, jc); B.writeSave(jc, mj);
  check('job: card seen and line heard are kept in the save', B.loadSave(CONFIG, mj).jobCard === true && !LO.jobCardDue(B.loadSave(CONFIG, mj)));
}
// ---- BASE WATER and BASE LIFE (owner Nov 17 16:01-16:03; src/baselife.js, CONFIG.baseWater / CONFIG.baseLife): the stream stops you except on its footbridges; the villagers' houses,
// the set pieces and the recruits' plots keep clear of the hideouts, the Scout's spots, the stations and the water; each new recruit gets a house on its own plot (scaffold first), saved
{ const B = await import('./src/base.js'), L = await import('./src/baselife.js'), W = CONFIG.baseWater, BL = CONFIG.baseLife;
  const walk = (x, z, tx, tz) => { let wet = false; for (let k = 0; k < 500; k++) { const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz); if (d < 0.08) break; x += dx / d * 0.06; z += dz / d * 0.06; [x, z] = L.waterPush(CONFIG, x, z); if (L.inWater(CONFIG, x, z)) wet = true; } return { left: Math.hypot(tx - x, tz - z), wet }; };
  const BR = L.bridgeFrames(CONFIG);
  check('base water: ' + BR.length + ' footbridges, each over the stream', BR.length === W.bridges.length && BR.every((b) => L.nearStream(CONFIG, b.x, b.z).d < 0.05));
  BR.forEach((b, i) => { const [ax, az] = L.toWorld(b, -b.len / 2 - 0.8, 0), [bx, bz] = L.toWorld(b, b.len / 2 + 0.8, 0), a = walk(ax, az, bx, bz), back = walk(bx, bz, ax, az);
    check('base water: you walk across footbridge ' + (i + 1) + ' both ways', a.left < 0.15 && back.left < 0.15, a.left.toFixed(2) + ' / ' + back.left.toFixed(2) + ' m short');
    const [ex, ez] = L.toWorld(b, -0.6, b.wd / 2 - 0.05), e = walk(ex, ez, ...L.toWorld(b, -0.6, b.wd / 2 + 1.5)); check('base water: the rails keep you on footbridge ' + (i + 1) + ' over the water (no stepping off sideways into it)', e.left > 1.0, e.left.toFixed(2) + ' m short of the water beside it'); });
  { const Ls = L.streamLine(CONFIG, 1.0), bound = L.baseBound(CONFIG); let tried = 0, crossed = 0, wet = 0;
    for (const p of Ls) { if (Math.hypot(p.x, p.z) > bound - 1.5 || BR.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < b.wd / 2 + 1.6)) continue; const nx = -p.tz, nz = p.tx, w = walk(p.x - nx * 2.2, p.z - nz * 2.2, p.x + nx * 2.2, p.z + nz * 2.2); tried++; if (w.left < 1.0) crossed++; if (w.wet) wet++; }
    check('base water: away from the bridges the stream stops you everywhere (' + tried + ' crossings tried along it)', tried > 20 && crossed === 0 && wet === 0, crossed + ' got across, ' + wet + ' got wet'); }
  { const sq = [[-15, -15], [15, -15], ...(BL.rounds || []), [15, 15], [-15, 15], [-15, -15]], VC = CONFIG.villageCats, ways = [sq, [[-9, -8], [0, -16]], ...VC.edges.map(([u, w]) => [VC.nodes[u], VC.nodes[w]])]; let over = 0, wade = 0;
    for (const R of ways) for (let i = 0; i < R.length - 1; i++) { const [ax, az] = R[i], [bx, bz] = R[i + 1], l = Math.hypot(bx - ax, bz - az); for (let t = 0; t < l; t += 0.1) { const x = ax + (bx - ax) * t / l, z = az + (bz - az) * t / l; if (L.inWater(CONFIG, x, z)) { over++; if (!(L.deckY(CONFIG, x, z) > 0)) wade++; } } }
    check('base water: the hunters\' rounds, the gatherers\' walk and the village cats\' paths cross the water only on a footbridge deck', wade === 0 && over > 0, over + ' points over the water, ' + wade + ' off a deck'); }
  { const F = L.wheelFrame(CONFIG); check('base water: the wheel sits in its race and turns at a set speed (CONFIG)', W.wheel.speed > 0 && L.nearStream(CONFIG, F.x, F.z).d < 0.05 && W.wheel.R * 2 >= 3 && W.wheel.R * 2 <= 4, 'diameter ' + W.wheel.R * 2 + ' m'); }
  // round 2 (owner 21:46): the stream lies in a channel below the ground, the water below the bank tops; your view rides up the ramp, over the arch and down, smoothly
  { const C0 = L.groundY(CONFIG, 30, 30), mid = L.streamLine(CONFIG, 1.0)[12], bed = L.groundY(CONFIG, mid.x, mid.z), wh = L.waterHalf(CONFIG);
    check('base water: the stream lies in a channel ' + (-bed).toFixed(2) + ' m below the ground, the water ' + (-W.y).toFixed(2) + ' m below the bank tops (' + (2 * wh).toFixed(2) + ' m wide), the ground flat away from it', C0 === 0 && bed <= -0.5 && bed >= -0.75 && W.y < -0.1 && W.y > bed && L.groundY(CONFIG, mid.x - mid.tz * (W.bed.top + 0.05), mid.z + mid.tx * (W.bed.top + 0.05)) === 0); }
  BR.forEach((b, i) => { const ease = W.camEase, dt = 1 / 60, v = CONFIG.base.speed; let cam = 1.6, maxStep = 0, peak = 0, lastDeck = 0, maxJump = 0;
    for (let lx = -b.len / 2 - W.ramp - 1; lx <= b.len / 2 + W.ramp + 2.5; lx += v * dt) { const [x, z] = L.toWorld(b, lx, 0), d = L.deckY(CONFIG, x, z), nc = cam + (1.6 + d - cam) * Math.min(1, dt * ease); maxStep = Math.max(maxStep, Math.abs(nc - cam)); maxJump = Math.max(maxJump, Math.abs(d - lastDeck)); lastDeck = d; cam = nc; peak = Math.max(peak, cam); }
    check('base water: crossing footbridge ' + (i + 1) + ' your view rises up the ramp, over the arch (' + (peak - 1.6).toFixed(2) + ' m) and back down smoothly', peak - 1.6 > 0.35 && Math.abs(cam - 1.6) < 0.01 && maxStep < 0.03 && maxJump < 0.05, 'largest step per frame ' + maxStep.toFixed(3) + ' m, deck step ' + maxJump.toFixed(3) + ' m'); });
  { const Gf = L.genFrame(CONFIG), fx = Math.sin(Gf.ry), fz = Math.cos(Gf.ry), P = BL.lanes.paths.flat(); let best = null, bd = 1e9; for (const [x, z] of P) { const d = Math.hypot(x - Gf.x, z - Gf.z); if (d < bd) { bd = d; best = [x, z]; } }
    const facing = ((best[0] - Gf.x) * fx + (best[1] - Gf.z) * fz) / bd; check('base water: the generator\'s window and gauge face the lane (' + bd.toFixed(1) + ' m away, ' + Math.round(Math.acos(Math.min(1, facing)) * 180 / Math.PI) + ' deg off)', facing > 0.7 && bd < 4); }
  // the water sound: only in the base, quieter and muffled indoors, fades in and out in about a second
  { const SND = await import('./src/basesound.js'), base = { base: true, paused: false, ui: false, hidden: false, music: true, volume: CONFIG.music.volume, near: { stream: 1.5, wheel: 3 }, indoor: false };
    const off = [Object.assign({}, base, { base: false }), Object.assign({}, base, { paused: true }), Object.assign({}, base, { ui: true }), Object.assign({}, base, { music: false }), Object.assign({}, base, { hidden: true }), null];
    const tOn = SND.waterTarget(CONFIG, base), tIn = SND.waterTarget(CONFIG, Object.assign({}, base, { indoor: true })), tFar = SND.waterTarget(CONFIG, Object.assign({}, base, { near: { stream: 40, wheel: 40 } }));
    check('base water sound: heard by the stream and the wheel in the base, nothing far from it', tOn.stream > 0 && tOn.wheel > 0 && tFar.stream === 0 && tFar.wheel === 0);
    check('base water sound: its level is 0 whenever the scene is not the base (street, title, opening, night, boss), the game is paused, a panel is open, the music is off or the tab hidden', off.every((st) => { const t = SND.waterTarget(CONFIG, st); return t.stream === 0 && t.wheel === 0; }));
    check('base water sound: inside a room or your home it is quieter and muffled (low-pass)', tIn.stream < tOn.stream * 0.6 && tIn.lp < 2000 && tOn.lp > 10000);
    const S = SND.createWaterSound(CONFIG), run = (sec, st) => { for (let t = 0; t < sec; t += 1 / 60) S.tick(1 / 60, null, st); return S.gain(); };
    const g1 = run(1.0, base), g3 = run(2.0, base), g4 = run(1.5, Object.assign({}, base, { base: false })), g5 = run(1.0, null);
    check('base water sound: fades in over about a second on entering the base and to exactly 0 within 1.5 s of leaving it', g1 > (tOn.stream + tOn.wheel) * 0.85 && g3 > 0 && g4 === 0 && g5 === 0, 'after 1 s ' + g1.toFixed(3) + ' of ' + (tOn.stream + tOn.wheel).toFixed(3) + ', after leaving ' + g4); }
  // clearances (3 m from hideouts, the Scout's spots and the stations; houses and set pieces off the water and inside the walls)
  const pts = [...B.CAT_SPOTS, ...B.SCOUT_SPOTS, ...Object.values(B.STATIONS)], items = [...L.houseFrames(CONFIG), ...L.plotFrames(CONFIG), ...L.pieceFrames(CONFIG)];
  const samp = (f) => { const o = []; if (f.r) for (let a = 0; a < 48; a++) o.push([f.x + Math.cos(a / 48 * 2 * Math.PI) * f.r, f.z + Math.sin(a / 48 * 2 * Math.PI) * f.r]); else for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) o.push(L.toWorld(f, -f.w / 2 + f.w * i / 8, -f.d / 2 + f.d * j / 8)); return o; };
  let near = 1e9, wetM = 1e9, far = 0; for (const f of items) for (const [x, z] of samp(f)) { for (const p of pts) near = Math.min(near, Math.hypot(x - p.x, z - p.z)); wetM = Math.min(wetM, L.nearStream(CONFIG, x, z).d); far = Math.max(far, Math.hypot(x, z)); }
  check('base life: ' + items.length + ' houses, plots and set pieces are 3 m or more from every hideout, Scout spot and station (' + near.toFixed(2) + ' m), off the water (' + wetM.toFixed(2) + ' m from its middle) and inside the walls', near >= 3.0 && wetM > W.bed.top && far < L.baseBound(CONFIG));
  // recruits' houses
  const fresh = () => { const s = B.newSave(CONFIG, 21); s.food = 10000; L.settleHomes(CONFIG, s); return s; }, mock = (s) => ({ d: { 'solardg.save': JSON.stringify(s) }, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } });
  { const s = fresh(), P = L.plotFrames(CONFIG).length, N = Math.min(P, CONFIG.base.maxPersonnel - s.personnel.length); for (let i = 0; i < N; i++) { B.recruit(CONFIG, s); L.settleHomes(CONFIG, s); }
    const st = L.plotStates(CONFIG, s), built = st.filter((p) => p.stage !== 'empty'), ids = new Set(built.map((p) => p.id));
    check('base life: recruiting ' + N + ' crew gives ' + N + ' houses on ' + N + ' different plots', built.length === N && ids.size === N && new Set(built.map((p) => p.k)).size === N);
    check('base life: a new recruit\'s house is a timber frame with scaffolding the day they join', built.every((p) => p.stage === 'frame'));
    const s2 = B.loadSave(CONFIG, mock(s)), st2 = L.plotStates(CONFIG, s2); check('base life: the plots stay with the same people after saving and loading', !!s2 && JSON.stringify(st2.map((p) => [p.k, p.id || 0, p.stage])) === JSON.stringify(st.map((p) => [p.k, p.id || 0, p.stage])));
    s2.day++; check('base life: the next day every one of them is a finished house', L.plotStates(CONFIG, s2).filter((p) => p.id).every((p) => p.stage === 'house'));
    check('base life: the three you start with get no plot (they live in the villagers\' houses)', L.plotStates(CONFIG, fresh()).every((p) => p.stage === 'empty')); }
  { const cap = Object.assign({}, CONFIG, { baseLife: Object.assign({}, BL, { recruitHouses: Object.assign({}, BL.recruitHouses, { plots: BL.recruitHouses.plots.slice(0, 2) }) }) }), s = B.newSave(CONFIG, 22); s.food = 10000; L.settleHomes(cap, s);
    for (let i = 0; i < 4; i++) { B.recruit(cap, s); L.settleHomes(cap, s); } const st = L.plotStates(cap, s);
    check('base life: more recruits than plots (4 on 2 plots): two houses, the other two wait without one', st.length === 2 && st.every((p) => p.id) && s.homes.length === 2 && s.personnel.length === 7); }
  { const s = B.newSave(CONFIG, 23); s.food = 10000; B.recruit(CONFIG, s); B.recruit(CONFIG, s); delete s.homes; const s2 = B.loadSave(CONFIG, mock(s)), st = L.plotStates(CONFIG, s2).filter((p) => p.id);
    check('base life: an old save (no plots yet) gives its 2 recruits finished houses', st.length === 2 && st.every((p) => p.stage === 'house')); }
}

// ---- THE BECKONER, the final-night boss (src/boss.js, CONFIG.boss)
{ const BC = CONFIG.boss, dur = CONFIG.night.duration;
  // a night with a player who only stands still (a lot of health so the timers can be watched); returns the sim and the boss events
  const night = (seed, house = 5, o = {}) => { const q = createSim({ cfg: CONFIG, ring: BC.ring, house, seed, day: true, ...o }); q.botDay(0.8); q.player.hp = o.hp || 1e6; const evs = []; let guard = 0;
    while (!q.done && guard++ < 5000) { if (o.each) o.each(q); q.step(CONFIG.night.dt); for (const e of q.boss.log.splice(0)) if (e.e === 'boss') evs.push(e); } return { q, evs }; };
  check('boss: only on the boss ring (ring 5), never on ring 4', !createSim({ cfg: CONFIG, ring: BC.ring - 1, house: 0, seed: 1, day: true }).boss && !!createSim({ cfg: CONFIG, ring: BC.ring, house: 0, seed: 1, day: true }).boss);
  { const ds = [0, 2, 5].map((h) => { const q = createSim({ cfg: CONFIG, ring: BC.ring, house: h, seed: 3, day: true }), B = q.boss; return Math.hypot(B.x, B.z) - q.H; });
    check('boss: stands 18-30 m out from the held house (advisor 22-28 m from the front), facing it', ds.every((d) => d >= 18 && d <= 30), ds.map((d) => d.toFixed(1)).join('/')); }
  { const a = createSim({ cfg: CONFIG, ring: BC.ring, house: 5, seed: 9, day: true }), b = createSim({ cfg: { ...CONFIG, boss: { ...BC, on: false } }, ring: BC.ring, house: 5, seed: 9, day: true });
    check('boss: the normal ring-5 waves are kept to CONFIG.boss.waveKeep (all of them at 1) and the summons come on top', a.total + a.boss.budget === b.total && (BC.waveKeep < 1 || a.total === b.total), a.total + ' kept of ' + b.total); }
  const runs = [1, 2, 3, 4, 5, 6].map((sd) => night(sd));
  { const r = runs[0].evs.find((e) => e.k === 'rise'); check('boss: rises at night start (CONFIG.boss.rise.at)', !!r && Math.abs(r.t - BC.rise.at) < 0.15, r && r.t.toFixed(2)); }
  { let ok = true, info = ''; for (const { evs } of runs) { const tel = evs.filter((e) => e.k === 'tele'), imp = evs.filter((e) => e.k === 'impact');
      tel.forEach((e, i) => { const want = BC.slam.tele[Math.min(i, BC.slam.tele.length - 1)]; if (Math.abs(e.tele - want) > 1e-9) { ok = false; info = 'tele ' + e.tele; } const m = imp[i]; if (m && Math.abs(m.t - e.t - want) > 0.15) { ok = false; info = 'impact ' + (m.t - e.t).toFixed(2); } });
      if (tel.length < 3) { ok = false; info = 'only ' + tel.length + ' slams'; } }
    check('boss: every slam is telegraphed (2.0 s, 2.0 s, then 1.6 s) and lands exactly then', ok, info); }
  { let ok = true, info = ''; for (const { evs } of runs) { const tel = evs.filter((e) => e.k === 'tele'), sum = evs.filter((e) => e.k === 'summon' || e.k === 'skip');
      for (let i = 1; i < tel.length; i++) { const gap = tel[i].t - tel[i - 1].t; if (gap < BC.slam.every[0] * BC.lateMul + BC.slam.tele[0] - 0.2 - 3) { ok = false; info = 'gap ' + gap.toFixed(1); } }
      for (const t of tel) for (const m of sum) if (t.t > m.t && t.t < m.t + BC.summon.noSlam - 0.15) { ok = false; info = 'slam ' + (t.t - m.t).toFixed(1) + ' s after a summon'; } }
    check('boss: slams come every 16-20 s (shorter in the finale) and never within 5 s after a summon', ok, info); }
  { let ok = true, n = 0, info = ''; for (const sd of [1, 2, 3, 4]) { const { q } = night(sd, 5, { each: (q) => { const a = q.boss.act; if (a && a.kind === 'slam' && a.step === 'tele' && Math.abs(a.left - a.dur) < 1e-6) { n++; const p = q.player; if (p.floor === 0 && Math.hypot(p.x - a.tg.x, p.z - a.tg.z) < BC.slam.ring) { ok = false; info = 'ring on the player'; } } } }); }
    check('boss: a slam never targets the spot where the player stands', ok && n > 0, info || n + ' slams'); }
  { const q = createSim({ cfg: CONFIG, ring: BC.ring, house: 5, seed: 4, day: true }); q.botDay(0.8); q.player.energy = 100; const b = q.breaches.find((x) => x.floor === 0 && -x.nx * (q.boss.x - x.x) - x.nz * (q.boss.z - x.z) > 0);
    q.place('panel', { bp: b.i }); const pan = b.panel, tg = { b, x: b.x - b.nx * BC.slam.out, z: b.z - b.nz * BC.slam.out }; q.player.x = b.inX; q.player.z = b.inZ; q.player.floor = 0; const hp0 = q.player.hp;
    q.step(0.1); q.boss.phase = 'slam'; q.boss.act = { kind: 'slam', step: 'tele', left: 0.05, dur: 2, tg }; q.step(0.1);
    check('boss: a slam takes CONFIG.boss.slam.devFrac of a full panel (never one hit) and at most a quarter of the player\'s health; the opening is smashed', pan.hp > 0 && Math.abs(pan.hp - CONFIG.devices.panel.hp * (1 - BC.slam.devFrac)) < 1e-6 && hp0 - q.player.hp <= CONFIG.player.hp * BC.slam.playerFrac + 1e-9 && hp0 - q.player.hp > 0 && b.smashed, 'panel ' + pan.hp + ', player -' + (hp0 - q.player.hp)); }
  { let ok = true, info = ''; for (const sd of [1, 2, 3]) night(sd, 5, { each: (q) => { const a = q.boss.act, pts = q.boss.points().map((p) => p.id), up = !!a && a.kind === 'summon' && a.step !== 'lower', sl = !!a && a.kind === 'slam' && (a.step === 'tele' || a.step === 'stuck'); if (pts.includes('beckon') !== up || pts.includes('slam') !== sl || pts.includes('core')) { ok = false; info = (a ? a.kind + ' ' + a.step : 'idle') + ' ' + pts.join(','); } } });
    check('boss: a paw core is open only while that paw is raised (beckon: glow + hold; slam: telegraph + stuck); the chest is shut', ok, info); }
  // (OWNER DECISION Nov 20 14:04 / 15:00: the boss at Gloom size, scale 4 -> 1, its weak points low and close accepted) the coin's height follows the boss's size (k = scale / 4);
  // the hit sizes are unchanged
  { const pt = BC.pts.beckon, pr = BC.weak, k = (BC.scale || 4) / 4; check('boss: palm cores at 6 m or lower, 0.9 m wide; chest coin 1.2 m wide at (3-4 m) x scale / 4', pt[1] <= 6 && pr.pawR * 2 >= 0.9 && pr.coreR * 2 >= 1.2 && BC.pts.chest[1] >= 3 * k && BC.pts.chest[1] <= 4 * k && BC.pts.slamUp[0] <= 6); }
  { let breaks = []; const { q, evs } = night(2, 5, { each: (q) => { for (const p of q.boss.points()) q.boss.hit(p.id, 1); } });
    const br = evs.filter((e) => e.k === 'break').map((e) => e.id), bk = evs.find((e) => e.k === 'break' && e.id === 'beckon'), sl = evs.find((e) => e.k === 'break' && e.id === 'slam'), core = evs.find((e) => e.k === 'break' && e.id === 'core');
    const sumAfter = bk && evs.some((e) => (e.k === 'summon' || e.k === 'beckon') && e.t > bk.t + 0.05), slamAfter = sl && evs.some((e) => e.k === 'tele' && e.t > sl.t + 0.05), open = evs.find((e) => e.k === 'coreOpen');
    check('boss: weak.pawHits hits break a paw; a broken paw stops its action; both broken open the chest; weak.coreHits hits break the core', !!bk && !!sl && !sumAfter && !slamAfter && !!open && !!core && q.boss.paws.beckon.hits >= BC.weak.pawHits && q.boss.core.hits >= BC.weak.coreHits, br.join(','));
    const thr = evs.find((e) => e.k === 'throe');
    check('boss: breaking the core collapses it with a last summon, but the night goes on (to dawn, or to the early dawn once every Gloom is gone)', q.win && !!core && !!thr && Math.abs(thr.t - core.t) < 0.15 && q.boss.phase === 'wreck' && q.t > core.t + BC.wreck.hold, 'core broken at ' + (core ? core.t.toFixed(1) : '-') + ', night ended at ' + q.t.toFixed(1));
    check('boss: the full break pays both paw bonuses and the core bonus on a win', q.result.boss && q.result.boss.paws === 2 && q.result.boss.core && q.result.boss.ess === 2 * BC.bonus.paw.ess + BC.bonus.core.ess, JSON.stringify(q.result.boss)); }
  { const { q, evs } = night(5); const dn = evs.find((e) => e.k === 'dawn');
    check('boss: at dawn it powers down; the end screen waits for the collapse; the night is won', q.win && !!dn && Math.abs(dn.t - dur) < 0.15 && q.t >= dur + BC.dawn.hold - 0.15 && q.boss.phase === 'down', 't ' + q.t.toFixed(1)); }
  { const a = night(7).evs.map((e) => e.k + e.t.toFixed(1)).join(), b = night(7).evs.map((e) => e.k + e.t.toFixed(1)).join(); check('boss: deterministic: the same seed gives the same fight', a === b && a.length > 20); }
  { let ok = true, info = '', n = 0; const capRuns = [1, 2, 3].map((sd) => night(sd, 5, { each: (q) => { const a = q.boss.act; if (a && a.kind === 'summon' && a.step === 'tele') q.gloom.length = Math.min(q.gloom.length, 1 + (q.boss.summons % 4)); } })); for (const { evs } of capRuns) for (const e of evs) { if (e.k === 'summon') { n++; if (e.alive + e.n > BC.summon.cap || e.n > BC.summon.max) { ok = false; info = e.alive + ' + ' + e.n; } } if (e.k === 'skip' && e.alive < BC.summon.cap && !e.empty) { ok = false; info = 'skipped at ' + e.alive; } }
    if (n < 3) { ok = false; info = 'only ' + n + ' summons'; }
    info = info || n + ' summons';
    check('boss: a summon never brings more Gloom than the alive cap allows', ok, info); }
  { const L = Object.values(BC.marla), all = [...L, BC.before, BC.name, BC.powerSaver].join(' ');
    check('boss: Marla\'s boss lines are 44 characters or fewer', L.every((l) => l.length <= 44), L.map((l) => l.length).join('/'));
    check('boss: no boss text calls it a lucky cat (hidden-cat safety)', !/lucky/i.test(all) && !/maneki/i.test(all)); }
  { const q = createSim({ cfg: CONFIG, ring: BC.ring, house: 5, seed: 4, day: true }); q.botDay(0.8); q.player.energy = 100; q.player.hp = 1e6; const B = q.boss; let t = 0;
    while (!(B.act && B.act.kind === 'summon' && B.act.step === 'hold') && t++ < 3000) q.step(0.1);
    const w = B.points().find((p) => p.id === 'beckon'), stand = q.breaches.filter((b) => b.floor === 0).map((b) => standFor(q, b, w)).find((p) => !!p), facing = q.breaches.filter((b) => b.floor === 0 && standFor(q, b, w)).length;
    const aim = (p) => { q.player.x = p.x; q.player.z = p.z; q.player.floor = 0; const dx = w.x - p.x, dz = w.z - p.z; q.player.yaw = Math.atan2(-dx, -dz); q.player.pitch = Math.atan2(w.y - CONFIG.cannon.eye, Math.hypot(dx, dz)); q.player.cd = 0; };
    aim(stand); const h0 = B.paws.beckon.hits; q.fireCannon('ray'); const hitOk = B.paws.beckon.hits === h0 + 1;
    aim({ x: 0, z: 0 }); const blocked = !q.openAt(0, 0, w.x, w.z, 0); const h1 = B.paws.beckon.hits; q.fireCannon('ray');
    check('boss: an aimed cannon shot through an opening hits the raised palm; through a wall it does not', !!stand && hitOk && (!blocked || B.paws.beckon.hits === h1), 'openings that see the palm ' + facing + ', hit ' + hitOk + ', blocked from the middle ' + blocked); }
  // balance (owner, Nov 17: "rather it be the hardest night"; coordinator 22:40): on every house size and for every bot profile the boss night is won LESS often than the same
  // night without the boss (the novice at most as often; a cell where both are 0 passes)
  // pawhunter (coordinator, Nov 17): the expert who shoots every open weak point. Its boss night is still harder than its ordinary night, it wins the boss night more often
  // than expertNB (so breaking the paws is worth doing: the Sun spill, CONFIG.boss.spill), and it breaks about 1-2 paws a night
  { const M = Math.min(N, 40), NB0 = { ...CONFIG, boss: { ...BC, on: false } }, bad = [], cells = [], br = {}, hunt = [];
    const rate = (cfg, sk, h) => { let k = 0, paws = 0; for (let i = 1; i <= M; i++) { const r = runBot(sk, cfg, BC.ring, h, i); if (r.win) k++; if (r.boss) paws += (r.boss.paws.beckon.broken ? 1 : 0) + (r.boss.paws.slam.broken ? 1 : 0); } return { w: Math.round(100 * k / M), paws: paws / M }; };
    for (const h of [5, 3, 0]) for (const sk of ['novice', 'average', 'averageNB', 'expert', 'expertNB', 'pawhunter']) { const B = rate(CONFIG, sk, h), b = B.w, o = rate(NB0, sk, h).w, ok = b < o || (sk.startsWith('novice') && b <= o) || (o === 0 && b === 0); br[h + sk] = B; cells.push('h' + h + ' ' + sk + ' ' + b + '/' + o); if (!ok) bad.push('h' + h + ' ' + sk); }
    check('boss: balance: the boss night is the hardest night: every house and every bot profile wins less often than without the boss', bad.length === 0, (bad.length ? 'NOT HARDER: ' + bad.join(', ') + ' | ' : '') + cells.join(', '));
    // (OWNER DECISION Nov 24, turret armour) the pawhunter / expertNB comparison measured the lance build that armour now limits (both 0-13%); the same rule on the strategy suite
    // (tools/wallbot.mjs BOSS=hunt): at average aim, hunting the paws wins at least as often on every house and more often in total, for traps and for the gunner; at expert aim 1-2 paws a night
    { const { STRATS } = await import('./tools/strategysuite.mjs'), { wallNight } = await import('./tools/wallbot.mjs'), WM = 24, EK = ['DEV', 'SPOT', 'PLACE', 'BOSS', 'SKILL', 'TPOS', 'BUILD'];
      const one = (st, sk, mode, h) => { for (const k of EK) delete process.env[k]; Object.assign(process.env, STRATS[st], { SKILL: sk, BOSS: mode }); let w = 0, paws = 0; for (let i = 1; i <= WM; i++) { const x = wallNight(CONFIG, BC.ring, h, i * 97 + h); if (x.win) w++; paws += x.paws; } for (const k of EK) delete process.env[k]; return { w: Math.round(100 * w / WM), paws: paws / WM }; };
      const rows = []; let ok = true;
      for (const st of ['traps', 'gunner']) { let tn = 0, th = 0, ge = true; const cells = [];
        for (const h of [5, 3, 0]) { const a = one(st, 'average', 'no', h), b = one(st, 'average', 'hunt', h), e = one(st, 'expert', 'hunt', h); tn += a.w; th += b.w; if (b.w < a.w) ge = false; if (e.paws < 1 || e.paws > 2) ok = false; cells.push('h' + h + ' ' + a.w + '->' + b.w + '% (' + e.paws.toFixed(1) + ' paws)'); }
        if (!ge || th <= tn) ok = false; rows.push(st + ': ' + cells.join(' ')); }
      check('boss: balance: breaking the paws is worth it: at average aim hunting wins >= on every house and more in total (traps, gunner); expert breaks 1-2 paws a night', ok, rows.join(' | ')); } }
}
// fresh-player fixes (owner Nov 18, desktop player test): drill wording, the waking prompt, Marla's first talk, the Keys card, the pause menu, the drill machine's start point
{ const D = CONFIG.drill, F = CONFIG.fresh, fs = await import('fs'), tpl = fs.readFileSync('./index.template.html', 'utf8'), src = fs.readFileSync('./src/main.js', 'utf8');
  const lines = D.steps.flatMap((q) => [q.desk, q.phone, q.again]).concat([D.done, D.skipped]);
  check('fresh: every drill order Marla gives is 44 characters or fewer', lines.every((l) => l.length <= 44), lines.filter((l) => l.length > 44).join(' | '));
  check('fresh: every drill step has a plain second line for desktop (naming a key) and for a phone (naming a button, no mouse words)', D.steps.every((q) => q.subD && q.subP && /click|left button|wheel|\b[1F]\b|number/i.test(q.subD) && !/click|mouse|wheel|\bkey/i.test(q.subP) && /FIRE|EAT|device|switch tab/.test(q.subP)), D.steps.map((q) => q.id + ': ' + q.subD + ' / ' + q.subP).join(' ; '));
  check('fresh: the shoot, place and charge steps mark the machine; switch and eat do not', D.steps.filter((q) => q.mark).map((q) => q.id).join(',') === 'shoot,place,charge');
  check('fresh: the drill machine starts a few metres out, picked within about 25 degrees of the view', D.spawnOut > 2 && D.spawnOut < 9 && D.viewDeg >= 15 && D.viewDeg <= 30 && D.mark.px >= 40);
  check('fresh: the waking prompt says click and E on desktop', /Click to start/.test(F.wakeBoth) && /E to talk/.test(F.wakeBoth) && F.wakePrio > CONFIG.ui.centre.msg && F.wakePrio < CONFIG.ui.centre.card);
  // teaching review fix 5 (Nov 18): Marla's talk prompt always hides the base walk line, so the waking prompt after the click teaches moving and looking, and the key strip and Keys card list W A S D
  { const dk = (/<div id="dkeys">([\s\S]*?)<\/div>/.exec(tpl) || ['', ''])[1]; check('teach: the waking prompt after the click says W A S D to move and mouse to look, the desktop key strip and Keys card list W A S D', /W A S D to move/.test(F.wakeTalk) && /mouse to look/.test(F.wakeTalk) && /E to talk/.test(F.wakeTalk) && /W A S D/.test(F.wakeClick) && F.wakeTalk.length <= 60 && /W A S D<\/span> move/.test(dk) && F.keysDesk.some((q) => q[0] === 'W A S D')); }
  // teaching review fix 7 (Nov 18): H only shows the keys while held (main.js keydown/keyup add and remove body.hkeys), so every desktop place says "hold H" and none says H hides hints
  { const dk = (/<div id="dkeys">([\s\S]*?)<\/div>/.exec(tpl) || ['', ''])[1], Bm = await import('./src/base.js'), hk = F.keysDesk.find((q) => /H$/.test(q[0])), hl = Bm.MARLA_LINES.hintsH;
    check('teach: H means one thing (hold for the keys) in the strip, the chip, the Keys card and Marla\'s reminders', /<span class="k">hold H<\/span> keys/.test(dk) && !/hide hints/.test(tpl) && /'<span class="k">hold H<\/span> keys'/.test(src) && hk && hk[0] === 'Hold H' && /^keys/.test(hk[1]) && hl.every((t) => /Hold H/.test(t) && !/Press H|H hides/.test(t)) && /classList\.add\('hkeys'\)/.test(src) && /classList\.remove\('hkeys'\)/.test(src)); }
  check('fresh: the ride-out line is one short line', F.rideLine.length <= 64 && /^Ride out: /.test(F.rideLine));
  check('fresh: the Keys card: desktop keys only on desktop, touch controls only on a phone', F.keysDesk.length >= 8 && F.keysPhone.length >= 8 && F.keysDesk.some((q) => /click/i.test(q[0])) && !F.keysPhone.some((q) => /click|mouse|\bEsc\b|W A S D/i.test(q.join(' '))));
  { const sc = /<div class="ov" id="scout"[\s\S]*?\n<\/div>/.exec(tpl); check('fresh: Marla\'s dialog no longer carries the controls text; the pickers sit in their own block with a "Set up the run" toggle', sc && !/Desktop: W A S D|left thumb moves/.test(sc[0]) && /id="scoutSetup"/.test(sc[0]) && /id="ssetup"/.test(sc[0]) && /id="scoutRide"/.test(sc[0])); }
  check('fresh: the pause menu has Keys, Journal and Map, and the Keys card and big map exist', ['pKeys', 'pJournal', 'pMap', 'keys', 'keysBody', 'bigmap', 'bmap'].every((id) => tpl.includes('id="' + id + '"')));
  check('fresh: Esc closes a panel first, the first click only takes the mouse, the quest chip says Tab or tap', /e\.code === 'Escape' && escClose\(\)/.test(src) && /performance\.now\(\) - lockAt < CONFIG\.fresh\.lockClickMs/.test(src) && /FINE \? 'Tab' : 'tap'/.test(src));
  check('fresh: the full device bar shows while the drill runs', /hkeys'\) \|\| !!\(drill && drill\.held\)/.test(src));
  { const q = createSim({ cfg: CONFIG, ring: 0, house: 5, seed: 3 }), P = q.player, b = q.breaches.find((x) => x.floor === P.floor && x.type === 'window') || q.breaches.find((x) => x.floor === P.floor);
    P.x = b.x + b.nx * 2.5; P.z = b.z + b.nz * 2.5; P.yaw = Math.atan2(b.nx, b.nz); const x = b.outX - b.nx * D.spawnOut, z = b.outZ - b.nz * D.spawnOut, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), d = Math.hypot(x - P.x, z - P.z), ang = (Math.acos(((x - P.x) * fx + (z - P.z) * fz) / d) * 180) / Math.PI;
    q.spawns.splice(q.spawned); q.gloom.length = 0; q.spawns.push({ t: q.t, bp: b.i, hpv: 1, from: { x, z } }); q.step(0.05); const g = q.gloom[0], at0 = g ? Math.hypot(g.x - x, g.z - z) : 99, d0 = g ? Math.hypot(g.x - b.outX, g.z - b.outZ) : 0; for (let k = 0; k < 20; k++) q.step(0.1); const d1 = g ? Math.hypot(g.x - b.outX, g.z - b.outZ) : 0;
    check('fresh: a drill machine starts at the given point outside the opening you face (seen through it), and walks to that opening', ang < 1 && q.openAt(P.x, P.z, x, z, P.floor) && g && g.bp === b.i && at0 < 0.3 && d1 < d0, 'angle ' + ang.toFixed(1) + ' deg, start off by ' + at0.toFixed(2) + ' m, to the opening ' + d0.toFixed(1) + ' -> ' + d1.toFixed(1) + ' m'); }
}
// MARLA'S VOICE (owner Nov 18): her run lines have clips, her base talk has none, the table matches the game's text, the Gloom's own voice settings are untouched
{ const VL = (await import('./src/voicelines.js')).VOICE_LINES, MV = await import('./src/marlavoice.js'), B = await import('./src/base.js'), LO = await import('./src/lore.js'), fs = await import('fs');
  const src = ['src/main.js', 'src/config.js', 'src/base.js', 'src/bossconfig.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n').replace(/\\'/g, "'");
  const holes = (t) => t.split(/\{\w+\}|' \+ [^']+ \+ '/).map((x) => x.replace(/^'|'$/g, '')).filter((x) => x.length > 3);
  const miss = VL.filter((q) => !holes(q.s).every((p) => src.includes(p))).map((q) => q.id);
  check('voice: every voiced line\'s text (as written in the source) is still in the game', miss.length === 0, miss.join(','));
  const D = ['ahead', 'behind', 'on your right', 'on your left', 'upstairs', 'downstairs'], run = [];
  // hintsH left out (teaching review fix 7, Nov 18): its words changed to "Hold H", so its old clips were dropped from the table; the new lines play no clip
  for (const k of ['supper', 'lowAte', 'low', 'hurt', 'streak']) run.push(...B.MARLA_LINES[k]);
  check('voice: the hold-H reminders (hintsH) play no clip and hint_h_1/2 are out of the voice table', B.MARLA_LINES.hintsH.every((t) => !MV.lineFor(t)) && !VL.some((q) => /^hint_h_/.test(q.id)));
  for (const k of ['inbound', 'collector']) for (const t of B.MARLA_LINES[k]) for (const d of D) run.push(t.replace('{d}', d));
  for (const t of B.MARLA_LINES.stair) for (const u of ['up', 'down']) run.push(t.replace('{u}', u));
  for (const t of B.MARLA_LINES.upper) for (const f of [2, 3]) for (const d of D) run.push(t.replace('{f}', f).replace('{d}', d));
  for (const q of CONFIG.drill.steps) run.push(q.desk, q.again); run.push(CONFIG.drill.done, CONFIG.drill.skipped);
  for (const k in CONFIG.boss.marla) run.push('Marla: ' + CONFIG.boss.marla[k]);
  for (const n of [7, 12, 22]) run.push('Something waves in a house with ' + n + ' openings.');
  const unv = run.filter((t) => !MV.lineFor(t));
  check('voice: every night bark (each direction), desktop drill order, boss line and street hint has a clip (' + run.length + ' texts)', unv.length === 0, unv.join(' | '));
  // owner Nov 18 08:05: desktop only; the phone-only texts (phone drill orders, phone night hints) have no clip
  const dv = CONFIG.drill.steps.every((q) => MV.lineFor(q.desk).id === 'drill_' + q.id + '_desk' && !MV.lineFor(q.phone)), ph = ['Tap the right side to FIRE. Tap a device button to place it; hold it to read what it does.', 'Panels go in the openings: face one and tap Panel. Heads count double.'].filter((t) => MV.lineFor(t));
  check('voice: desktop drill orders map to their desktop clips; phone-only texts (phone drill orders, phone night hints) have none', dv && ph.length === 0, ph.join(' | '));
  const baseT = [B.WORKSHOP_TIP.replace('{w}', 'north'), B.HATCHERY_TIP.replace('{d}', 'pond'), LO.JOB_LINE, ...B.MARLA_JOURNAL.slice(0, 3)].filter((t) => MV.lineFor(t));
  check('voice: Marla\'s base talk (workshop and hatchery tips, the job line, her journal) has no clip', baseT.length === 0, baseT.join(' | '));
  const mp3 = fs.existsSync('art/voice/mp3') ? fs.readdirSync('art/voice/mp3') : [], noFile = VL.filter((q) => !mp3.includes(q.id + '.mp3')).map((q) => q.id);
  check('voice: every line that needs a clip (the desktop table) has it in art/voice/mp3 (' + VL.length + ' lines)', noFile.length === 0, noFile.slice(0, 12).join(','));
  const M = CONFIG.voice.marla; check('voice: CONFIG.voice.marla holds desktopOnly (true), on, storeKey, vol, duck, duckIn, duckOut, delay, cache; the Gloom voice settings are still there', M && M.on === true && M.desktopOnly === true && M.storeKey === 'solardg.voice' && M.vol > 0 && M.vol <= 1 && M.duck > 0 && M.duck < 1 && M.duckIn > 0 && M.duckOut > 0 && M.delay >= 0 && M.cache >= 4 && CONFIG.voice.kinds.walker && CONFIG.voice.crush > 0);
  const ms = fs.readFileSync('src/main.js', 'utf8'), tpl = fs.readFileSync('index.template.html', 'utf8');
  check('voice: it plays only in state play (never the base), stops while paused or hidden, the pause menu has Voice next to Music', /MV\.tick\(dt, state === 'play' && !!\(run \|\| sim\), paused \|\| document\.hidden,/.test(ms) && /id="bMusic">Music: on<\/button><button class="big" id="bVoice">Voice: on<\/button>/.test(tpl) && /\* MV\.duck\(\)/.test(ms));
}
// MARLA TEACHING FIXES (fresh-player review Nov 18, docs/marla_teaching_review.md): the lesson cannot kill, the first collector's words and message, one night-start instruction
{ const D = CONFIG.drill, F = CONFIG.firstSolar, N = CONFIG.nightStart, MV = await import('./src/marlavoice.js'), fs = await import('fs'), ms = fs.readFileSync('src/main.js', 'utf8'), tpl = fs.readFileSync('index.template.html', 'utf8');
  // the lesson in the sim: a Walker 3 m away, the lesson's tame and health floor; 30 s of game time with no input, first the shoot step's tame, then the later steps'
  const lesson = (tm) => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 3 }), P = t.player; t.phase = 'night'; t.gloom.length = 0; t.spawns.length = 0; P.hp = CONFIG.player.hp; P.floor = 0;
    t.gloom.push({ id: 900, kind: 'walker', x: P.x + 3, z: P.z, floor: 0, hp: 1e6, maxhp: 1e6, phase: 'inside', bp: 0, timer: 0, cd: 0, face: 0 }); t.tame = () => tm; t.hpFloor = () => D.hpFloor;
    let minD = 99, minHp = P.hp; for (let i = 0; i < 300; i++) { t.step(0.1); const g = t.gloom[0]; if (g) minD = Math.min(minD, Math.hypot(g.x - P.x, g.z - P.z)); minHp = Math.min(minHp, P.hp); } return { minD, minHp, hp: P.hp, done: t.done, win: t.win }; };
  const a = lesson({ speed: D.shootSpeed, stop: D.shootStop, dmg: 0 }), b = lesson({ speed: D.laterSpeed, stop: 0, dmg: D.laterDmg });
  check('teach: shoot step, 30 s with no input: the lesson machine halts short of arm\'s length and never hits (closest ' + a.minD.toFixed(2) + ' m, health ' + Math.round(a.minHp) + ')', a.minD > CONFIG.gloom.reach + 0.5 && a.minD <= D.shootStop + 0.05 && a.minHp === CONFIG.player.hp && !a.done);
  check('teach: later steps, 30 s with no input: it hits (health ' + Math.round(b.minHp) + ') but health stops at the lesson floor ' + D.hpFloor + ' and you live', b.minHp < CONFIG.player.hp && b.minHp >= D.hpFloor && !b.done && b.hp > 0);
  check('teach: without the lesson\'s tame and floor the same Walker still kills in 30 s (the floor is what saves you)', (() => { const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 3 }), P = t.player; t.gloom.length = 0; t.spawns.length = 0; P.hp = CONFIG.player.hp; t.gloom.push({ id: 901, kind: 'walker', x: P.x + 3, z: P.z, floor: 0, hp: 1e6, maxhp: 1e6, phase: 'inside', bp: 0, timer: 0, cd: 0, face: 0 }); for (let i = 0; i < 300 && !t.done; i++) t.step(0.1); return t.done && !t.win; })());
  check('teach: every lesson value is in CONFIG.drill (shootSpeed, shootStop over arm\'s length, laterSpeed, laterDmg under 1, hpFloor under eatHp) and main.js gives the sim its tame and floor only while the lesson holds the waves', D.shootSpeed > 0 && D.shootSpeed < 1 && D.shootStop > CONFIG.gloom.reach + 0.5 && D.laterSpeed > 0 && D.laterDmg > 0 && D.laterDmg < 1 && D.hpFloor > 0 && D.hpFloor < D.eatHp * CONFIG.player.hp && /sim\.tame = drillTame; sim\.hpFloor = \(\) => \(drill && drill\.held && drillSim === sim \? D\.hpFloor : 0\)/.test(ms) && /function drillTame\(\) \{ const D = CONFIG\.drill; if \(!drill \|\| !drill\.held \|\| drillSim !== sim\) return null;/.test(ms));
  const noName = Object.keys(CONFIG.devices).filter((k) => !CONFIG.devices[k].name || !CONFIG.devices[k].text);
  check('teach: every device has a name and a text (the collector placed message read "undefined placed: undefined")', noName.length === 0, noName.join(','));
  check('teach: the first collector keeps its own message (no generic "placed" flash over it)', /flash\('First collector up\. Your Sun now fills faster\. You can leave when you like\.', 2\); return; \}/.test(ms));
  check('teach: the collector order names the real control: desktop key Q, phone SOLAR (and the phone button reads ' + F.btnP + '); no "tap Solar" left', /press Q/.test(F.marlaD) && /press Q/.test(F.blockD) && /tap SOLAR/.test(F.marlaP) && /tap SOLAR/.test(F.blockP) && F.btnP === 'SOLAR' && !/tap Solar/.test(ms + JSON.stringify(F)) && /line = id === 'b0' && !FINE && !full \? CONFIG\.firstSolar\.btnP/.test(ms));
  check('teach: the collector order repeats every ' + F.repeat + ' s (was 4), and has no voice clip (its words changed), so a repeat is never re-voiced', F.repeat >= 15 && F.secs > 0 && F.secs < F.repeat && !MV.lineFor(F.marlaD) && !MV.lineFor(F.marlaP) && !/firstSolar\.marla\b/.test(ms));
  const lines = [N.lineD, N.lineP, N.houseD, N.houseP], gone = ['HOLD DUSK', 'only when your Sun is full', 'START NIGHT'];
  check('teach: the night-start lines agree with the button ("' + N.btn + '", desktop key N): desktop lines say "Hold N to start night", phone lines say Hold "start night"; none asks for full Sun', N.btn === 'HOLD: start night' && tpl.includes('id="bDusk" data-key="hold N">' + N.btn + '<') && /: CONFIG\.nightStart\.btn, de = \$\('bDusk'\)/.test(ms) && /Hold N to start night/.test(N.lineD) && /Hold N to start night/.test(N.houseD) && /Hold "start night"/.test(N.lineP) && /Hold "start night"/.test(N.houseP) && !lines.some((l) => gone.some((g) => l.includes(g))) && !gone.slice(0, 2).some((g) => ms.includes(g)));
  check('teach: the night-start line is said once a run (house or street) and the bell is followed by one line ' + N.afterBell + ' s later (house or street)', /queueHint\(70, nightLine\(\), null, nightOnce\)/.test(ms) && /\{ at: 0, text: nightLine\(\), where: 'house', skip: nightOnce \}/.test(ms) && /queueHint\(N\.afterBell, FINE \? N\.houseD : N\.houseP, 'house', once\); queueHint\(N\.afterBell, N\.street, 'street', once\)/.test(ms) && N.afterBell > 5 && N.afterBell < CONFIG.day.bell - 3);
  const voiced = [N.lineD, N.lineP, N.houseD, N.houseP, N.street, F.marlaD, F.marlaP].filter((t) => MV.lineFor(t)), VL = (await import('./src/voicelines.js')).VOICE_LINES;
  check('teach: the changed lines play no clip, and the two stale clips (day_hold_start, day_first_solar) are out of the voice table', voiced.length === 0 && !VL.some((q) => q.id === 'day_hold_start' || q.id === 'day_first_solar'), voiced.join(' | '));
}
// IMPACT SOUNDS (owner approved round 2, Nov 18): the CONFIG switch and values, the module with no AudioContext, the positions on the 'shot' event
{ const IM = await import('./src/impactsfx.js'), I = CONFIG.sfx.impact, ks = Object.keys(IM.IMPACT_SFX);
  check('impact: CONFIG.sfx.impact has on (true) and every IMPACT_SFX value (' + ks.length + ' keys); the old shot sound is kept for impact.on false', !!I && I.on === true && ks.every((k) => I[k] === IM.IMPACT_SFX[k]) && I.vol > 0 && I.hitGap > 0 && I.hitQueue > 0 && !!(I.room && I.hit && I.head && I.charged && I.destroyed && I.shot) && CONFIG.sfx.shot.vol > 0);
  let r = null; try { const S = IM.createImpactSfx(() => (typeof AudioContext !== 'undefined' ? new AudioContext() : null), () => I, () => true, () => false); r = [S.shot(), S.hit({ pan: 0.3, dist: 4 }, false), S.hit({ pan: 0, dist: 4 }, true), S.charged({ pan: -0.2, dist: 6 }), S.destroyed({ pan: 1, dist: 30 })]; } catch (e) { r = String(e); }
  check('impact: createImpactSfx with no AudioContext returns safely (every sound returns 0, nothing throws)', Array.isArray(r) && r.every((v) => v === 0), JSON.stringify(r));
  const t = createSim({ cfg: CONFIG, ring: 0, house: 0, seed: 1 }), P = t.player, mk = (id, z) => ({ id, x: 0.1, z, floor: 0, hp: 1e6, maxhp: 1e6, phase: 'inside', bp: 0, timer: 0, cd: 1e9, face: 0 });
  const fire = (ch) => { P.x = 0; P.z = 0; P.floor = 0; P.yaw = 0; P.pitch = -0.1; P.energy = 100; P.cd = 0; t.log.length = 0; t.fireCannon('ray', 1, ch, null); return t.log.slice(); };
  t.gloom.length = 0; t.gloom.push(mk(801, -4)); const e1 = fire(false).find((e) => e.e === 'shot');
  check('impact: a normal shot\'s event carries the hit machine\'s x, z, floor', !!e1 && e1.hit && e1.x === 0.1 && e1.z === -4 && e1.floor === 0, JSON.stringify(e1));
  t.gloom[0].hp = 1; const e2 = fire(false), s2 = e2.find((e) => e.e === 'shot'), p2 = e2.find((e) => e.e === 'pop');
  check('impact: a killing shot\'s event and its pop event name the same machine position (main.js plays destroyed instead of the hit)', !!s2 && !!p2 && s2.x === p2.x && s2.z === p2.z && s2.floor === p2.floor);
  t.gloom.length = 0; t.gloom.push(mk(802, -3), mk(803, -6)); const e3 = fire(true).find((e) => e.e === 'shot'), h3 = (e3 && e3.hits) || [];
  check('impact: a charged shot\'s event lists { x, z, floor, head } for every machine on its line', !!e3 && e3.charged && h3.length === 2 && h3.every((q) => q.x === 0.1 && q.floor === 0 && typeof q.head === 'boolean') && h3.map((q) => q.z).sort().join() === '-3,-6', JSON.stringify(e3));
  const ms = (await import('fs')).readFileSync('src/main.js', 'utf8');
  check('impact: main.js plays the shot through shotSfx (3 places in doFire) and runs impactEvents in doFire and the frame loop', (ms.match(/hands\.fire\(\); shotSfx\(\);/g) || []).length === 3 && !/hands\.fire\(\); sfxShot\(\)/.test(ms) && /const evs = sim\.log\.splice\(0\); impactEvents\(evs\);/.test(ms));
}
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(' | ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
