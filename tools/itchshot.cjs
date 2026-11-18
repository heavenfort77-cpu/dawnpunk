// itch.io page pictures (owner Nov 18): the desktop build (high tier) exactly as shipped, 1280x720 at device scale 1.5 (1920x1080 PNG), HUD on, real play moments
// framed with the test hooks. A mid-game save (day, nights, rings, a 4th device slot) so the first-night lessons and the job card are past, as for a returning player.
// Usage: node tools/itchshot.cjs <base|street|house|gloom|boss|title> <out_dir>     (SEED in the environment changes the run's seed and Math.random;
//   SCALE = device scale (default 1.5; 0.5 for a quick look at the candidates); PICK = comma list of the pictures to write, the others are skipped)
// Writes <out_dir>/<shot>_<k>.png candidates (and <shot>_<k>_clean.png with the HUD hidden, for the cover) and prints INFO lines: the HUD text at each picture,
// where the camera stood, and whether a hidden lucky cat (base hideouts, the run's cat house) could be in view (CATVIEW lines).
// dist/ is served over local http (as itch serves it) so the high tier's textures and models load.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const SHOT = process.argv[2] || 'base', OUT = process.argv[3] || 'shots', SEED = +(process.env.SEED || 777), SCALE = +(process.env.SCALE || 1.5), PICK = process.env.PICK ? process.env.PICK.split(',') : null, DIST = path.join(__dirname, '..', 'dist');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const info = (m) => console.log('INFO ' + m);
const T0 = Date.now(), el = () => Math.round((Date.now() - T0) / 1000) + ' s';
const INIT = ({ seed }) => { let s = seed; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__fakeLock = true; // the mouse counts as taken (a player who has clicked the game); no pointer lock in the headless browser
  try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } };

(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const URL0 = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  async function open(extra, scale) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale || SCALE }); await ctx.addInitScript(INIT, { seed: SEED });
    const p = await ctx.newPage(); p.setDefaultTimeout(900000); p.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.goto(URL0 + '?quality=high&seed=' + SEED + (extra || ''), { timeout: 900000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 900000 }); info('page up ' + el()); return p;
  }
  const frames = (p, n) => p.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  // let this much GAME time pass (each frame's dt is capped by window.__dtMax, as the game does), drawing frames as it goes
  const waitGame = (p, secs, cap) => p.evaluate(([secs, cap]) => new Promise((res) => { window.__dtMax = cap; let acc = 0, last = performance.now(), n = 0; const f = (now) => { acc += Math.min(cap, (now - last) / 1000); last = now; if (acc >= secs || ++n > 400) res(n); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), [secs, cap || 0.3]);
  const hud = (p) => p.evaluate(() => { const t = (id) => { const e = document.getElementById(id); return e && e.offsetParent !== null ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }; return ['marla', 'csay', 'msg', 'bprompt', 'bstat', 'time', 'hs'].map((k) => k + '=' + JSON.stringify(t(k))).join(' '); });
  // is any hidden lucky cat inside the view (ignoring walls)? base: the hideouts of the save's hidden cats; a run: the cat house's cat when you are in that house
  const catView = (p) => p.evaluate(() => { const g = window.__game, c = g.cam; c.updateMatrixWorld(); const V = c.matrixWorldInverse.elements, P = c.projectionMatrix.elements, out = [];
    const pr = (x, y, z) => { const vx = V[0] * x + V[4] * y + V[8] * z + V[12], vy = V[1] * x + V[5] * y + V[9] * z + V[13], vz = V[2] * x + V[6] * y + V[10] * z + V[14]; if (vz > -0.1) return null; const cx = P[0] * vx + P[8] * vz, cy = P[5] * vy + P[9] * vz, w = -vz; return [cx / w, cy / w, -vz]; };
    if (g.state === 'base' && g.save) { const SP = [[-13, 11], [14, -11], [-16, -10], [1, 15], [13, 1]]; for (const k of g.save.cats) { if (k.state !== 'hidden') continue; const [x, z] = SP[k.spot], d = Math.hypot(x, z) || 1, q = pr(x + x / d * 1.2, 0.3, z + z / d * 1.2); if (q && Math.abs(q[0]) < 1.05 && Math.abs(q[1]) < 1.05) out.push('base hideout ' + k.spot + ' at ' + q[2].toFixed(1) + ' m'); } }
    const r = g.run; if (r && g.sim && r.inside === r.catHouse && !g.sim.cat.found) out.push('inside the cat house');
    return out.join('; ') || 'none'; });
  async function shot(p, name, clean) {
    if (PICK && !PICK.includes(name)) { info('skip ' + name); return; }
    // the mouse is taken (as for any player who has clicked the game once: no "Click to look" hint)
    await p.evaluate(() => { window.__fakeLock = true; window.__dtKeep = window.__dtMax; window.__dtMax = 0.0005; }); await frames(p, 2);
    const h = await hud(p), cv = await catView(p), cam = await p.evaluate(() => { const c = window.__game.cam; return [c.position.x, c.position.y, c.position.z].map((v) => v.toFixed(2)).join(',') + ' yaw ' + window.__game.yaw.toFixed(3); });
    const f = path.join(OUT, name + '.png'); await p.screenshot({ path: f, timeout: 900000 }); info('wrote ' + f + ' (' + el() + ') cam ' + cam + ' | HUD ' + h); console.log('CATVIEW ' + name + ': ' + cv);
    if (clean) { await p.evaluate(() => { document.getElementById('hud').style.visibility = 'hidden'; }); await frames(p, 1); const f2 = path.join(OUT, name + '_clean.png'); await p.screenshot({ path: f2, timeout: 900000 }); info('wrote ' + f2); await p.evaluate(() => { document.getElementById('hud').style.visibility = ''; }); }
    await p.evaluate(() => { window.__dtMax = window.__dtKeep; });
  }
  async function waitLoads(p, what) { for (let k = 0; k < 400; k++) { const s = await p.evaluate(() => { const q = window.__game.quality().hi, G = window.__gloomGlb || {}; return { hi: q.ok + q.failed >= q.asked, q, marla: window.__game.marla.ready, glb: Object.values(G).every((v) => v !== 'loading'), G }; }); if (s.hi && s.marla && s.glb) { info(what + ' loaded ' + el() + ' ' + JSON.stringify(s)); return; } await p.waitForTimeout(1000); } info(what + ': loads not all done'); }
  // a returning player's save: past the first two nights (no lessons, no drill, no job card), a 4th device slot from the Workshop
  async function midSave(p, o) {
    await p.evaluate((o) => { const g = window.__game; g.enterBase(); const s = g.save; s.day = o.day; s.nights = o.nights; s.trips = o.nights; s.food = o.food; s.essentials = o.ess; s.essTotal = o.ess + 14; s.killsTotal = o.nights * 9;
      s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.noteSeen = true; s.toldCharge = true; s.ringOpen = o.ringOpen; s.scoutSpot = o.scout; s.up.slots = 1; s.loadout = ['turbine', 'lance', 'panel', 'mine'];
      s.met = { walker: true, lurcher: true, ticks: true, hauler: true, stilt: true }; if (o.cats) s.cats.forEach((c, i) => { c.spot = o.cats[i]; }); g.reBase(); }, o);
    await waitLoads(p, 'base');
  }
  const startRun = async (p, ring) => { await p.evaluate((ring) => { document.getElementById('selRing').value = String(ring); window.__game.startRun(); }, ring); await waitGame(p, 1, 0.3); await waitLoads(p, 'run');
    const r = await p.evaluate(() => { const r = window.__game.run; return { ring: r.ring, cat: r.catHouse, houses: r.houses.map((h) => ({ i: h.i, n: h.n, L: h.sim.L, door: [h.doorX.toFixed(1), h.doorZ.toFixed(1)], row: h.row })), dormant: (r.dormant || []).map((d) => [d.kind, d.x.toFixed(1), d.z.toFixed(1)]) }; }); info('run ' + JSON.stringify(r)); return r; };
  // the house to hold: not the cat's house, one floor, a fair number of openings
  const pickHouse = (r, want) => { const ok = r.houses.filter((h) => h.i !== r.cat); ok.sort((a, b) => (a.L - b.L) || (Math.abs(a.n - want) - Math.abs(b.n - want))); return ok[0].i; };
  // night in house i: Sun for the night, dusk, then step the sim (no drawing) until the first Gloom is on its way; returns the breach it comes for
  async function nightIn(p, i, energy) {
    await p.evaluate(([i, e]) => { const g = window.__game; g.enterHouse(i); g.sim.player.energy = e; }, [i, energy]); await waitGame(p, 1.5, 0.3);
    await p.evaluate(() => window.__game.nightfall()); await waitGame(p, 0.5, 0.1);
    const first = await p.evaluate(() => { const s = window.__game.sim; let k = 0; while (!s.gloom.length && k++ < 900) s.step(0.05); const g0 = s.gloom[0]; if (!g0) return null; const b = s.breaches[g0.bp]; return { t: s.t, kind: g0.kind, bp: g0.bp, b: { x: b.x, z: b.z, nx: b.nx, nz: b.nz, type: b.type, floor: b.floor }, H: s.H, n: s.breaches.length }; });
    info('night: first Gloom ' + JSON.stringify(first)); return first;
  }
  // stand at (x, z) on the floor, looking at (tx, ty, tz)
  const stand = (p, x, z, tx, ty, tz) => p.evaluate(([x, z, tx, ty, tz]) => { const g = window.__game, s = g.sim, P = s.player; P.x = x; P.z = z; P.floor = 0; P.climb = null; const dx = tx - x, dz = tz - z, y = Math.atan2(-dx, -dz), pi = Math.atan2(ty - 1.6 - P.floor * 3, Math.hypot(dx, dz)); g.setYaw(y); g.setPitch(pi); P.yaw = y; P.pitch = pi; }, [x, z, tx, ty, tz]);
  // place a device the way a player does (looking at the spot, 2.5 m ahead; a panel goes on the breach in front)
  const place = (p, kind, x, z, fx, fz) => p.evaluate(([kind, x, z, fx, fz]) => { const g = window.__game, s = g.sim, P = s.player, d = kind === 'panel' ? 2 : 2.5; P.x = x - fx * d; P.z = z - fz * d; const y = Math.atan2(-fx, -fz); g.setYaw(y); P.yaw = y; g.setPitch(-0.2); P.pitch = -0.2; const n = s.devices.length; g.doPlace(kind); return s.devices.length > n ? 'ok' : 'refused'; }, [kind, x, z, fx, fz]);
  const step = (p, test, maxS, arg, hp) => p.evaluate(([f, maxS, a, hp]) => { const s = window.__game.sim, T = new Function('s', 'a', 'return (' + f + ')(s, a)'); for (let k = 0; k < maxS * 20; k++) { s.player.hp = Math.max(s.player.hp, hp); if (T(s, a)) return { ok: true, t: s.t }; s.step(0.05); } return { ok: false, t: s.t }; }, [test.toString(), maxS, arg, hp || 60]);

  if (SHOT === 'title') {
    // the DAWNPUNK title card exactly as the page draws it (CSS #stitle: the wordmark, the flourish, the tagline), at 3x for the cover; the card on its own background as reference,
    // then the same card on a transparent page (page background, canvas and the other splash parts hidden; the phase held on the title card)
    const p = await open('&splash=1', 3); await p.waitForFunction(() => window.__splash && window.__splash.phase, null, { timeout: 900000 }).catch(() => {}); info('splash phase ' + await p.evaluate(() => window.__splash.phase));
    await p.evaluate(() => { const e = document.getElementById('spl'); e.className = 'ph-title'; Object.defineProperty(e, 'className', { configurable: true, get: () => 'ph-title', set: () => {} }); });
    await p.waitForTimeout(4000); await p.evaluate(() => document.fonts && document.fonts.ready);
    const fam = await p.evaluate(() => { const s = getComputedStyle(document.getElementById('sword')); return s.fontFamily + ' ' + s.fontWeight + ' ' + s.fontSize + ' | tag ' + getComputedStyle(document.getElementById('stag')).fontFamily; }); info('title font ' + fam);
    await p.screenshot({ path: path.join(OUT, 'title_card.png') });
    await p.evaluate(() => { for (const e of document.body.children) if (e.id !== 'menu') e.style.visibility = 'hidden'; for (const id of ['spart', 'slogo', 'sload']) document.getElementById(id).style.visibility = 'hidden'; document.getElementById('menu').style.background = 'transparent'; document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; for (const c of document.querySelectorAll('canvas')) c.style.visibility = 'hidden'; });
    await p.waitForTimeout(800); const bx = await p.evaluate(() => { const r = document.getElementById('stitle').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }); info('stitle box ' + JSON.stringify(bx));
    await p.screenshot({ path: path.join(OUT, 'title_alpha.png'), omitBackground: true, clip: { x: 0, y: Math.max(0, bx.y - 70), width: 1280, height: Math.min(720 - Math.max(0, bx.y - 70), bx.h + 140) } });
    info('wrote title_card.png and title_alpha.png');
  }

  // freeze game time (frames still draw), for trying several views of one moment
  const freeze = (p) => p.evaluate(() => { window.__dtMax = 0.0005; });
  // open the device bar the way a player does (the mouse wheel picks the next device; the bar shows while you choose)
  const wheel = (p, n) => p.evaluate((n) => { for (let i = 0; i < Math.abs(n); i++) window.dispatchEvent(new WheelEvent('wheel', { deltaY: n > 0 ? 100 : -100 })); }, n);
  const CLEAN = (process.env.CLEAN || '').split(',');

  if (SHOT === 'base') {
    // the base by day: Marla under the big tree (her spot 1), the waterwheel and the gardens; the save's three hidden cats sit at hideouts 0, 2, 3 (none in these views)
    const p = await open(); await midSave(p, { day: 6, nights: 4, food: 23, ess: 9, ringOpen: 3, scout: 1, cats: [0, 2, 3] }); await waitGame(p, 9, 1);
    const views = process.env.VIEWS ? JSON.parse(process.env.VIEWS) : [[10.5, -8, 11, -15], [11.5, -8.5, 10.5, -15.5], [9, -8.5, 11.5, -15], [13.5, -8, 10, -15.5], [8, -9.5, 12, -15], [12, -7, 10, -16], [16, -9, 9, -16], [9.5, -10, 12, -15.5], [7, -8, 11.5, -16], [6.5, -6.5, 11.5, -15.5]];
    await freeze(p);
    for (let k = 0; k < views.length; k++) { const [x, z, tx, tz] = views[k]; await p.evaluate(([x, z, tx, tz, pt]) => { const g = window.__game; g.setBase(x, z); g.setYaw(Math.atan2(-(tx - x), -(tz - z))); g.setPitch(pt || 0); }, [x, z, tx, tz, +(process.env.BPITCH || 0)]); await frames(p, 2); await shot(p, 'base_' + k, CLEAN.includes('base_' + k)); }
  }

  if (SHOT === 'street') {
    // the old street by day after looting two houses: sleeping machines by the houses, the loot on the HUD
    const p = await open(); await midSave(p, { day: 5, nights: 3, food: 17, ess: 6, ringOpen: 3, scout: 2, cats: [0, 2, 3] }); const r = await startRun(p, 1);
    // Marla's run lines come and go first (the cat-house rumour line is never in the picture)
    let seenW = false; for (let k = 0; k < 10; k++) { await waitGame(p, 3, 1); const h = await hud(p); info('street wait ' + h); if (/waves/.test(h)) seenW = true; else if (seenW) break; }
    let looted = 0; for (const h of r.houses) { if (h.i === r.cat || looted >= 2) continue; looted++;
      await p.evaluate((i) => window.__game.enterHouse(i), h.i); await waitGame(p, 0.6, 0.3);
      const got = await p.evaluate(() => { const s = window.__game.sim, P = s.player, x0 = P.x, z0 = P.z; let n = 0; for (const c of s.crates.filter((c) => c.floor === 0).slice(0, 4)) { P.x = c.x; P.z = c.z; s.step(0.02); n++; } P.x = x0; P.z = z0; return { n, food: s.food, ess: s.ess }; });
      info('looted house ' + h.i + ' ' + JSON.stringify(got)); await waitGame(p, 0.6, 0.3); await p.evaluate(() => window.__game.leaveHouse()); await waitGame(p, 1, 0.3); }
    for (let k = 0; k < 4; k++) { await waitGame(p, 2.5, 1); const h = await hud(p); info('street wait ' + h); if (!/waves|heavy/i.test(h) && k >= 1) break; }
    const ds = await p.evaluate(() => (window.__game.run.dormant || []).map((d, i) => ({ i, kind: d.kind, x: d.x, z: d.z, awake: d.awake })).filter((d) => !(d.awake > 0)));
    info('sleepers ' + JSON.stringify(ds));
    const views = []; for (const d of ds) { const sx = d.x > 0 ? -1 : 1, sz = d.z > 0 ? 1 : -1; views.push([d.x + sx * 5.5, -sz * 0.8, d.x, d.z, 0.3 * sx], [d.x + sx * 8, sz * 1.5, d.x, d.z, -0.25 * sx]); }
    if (process.env.VIEWS) views.splice(0, views.length, ...JSON.parse(process.env.VIEWS));
    await freeze(p);
    for (let k = 0; k < views.length; k++) { const [x, z, tx, tz, off] = views[k]; await p.evaluate(([x, z, tx, tz, off]) => { const g = window.__game; g.setTown(x, z); g.setYaw(Math.atan2(-(tx - x), -(tz - z)) + off); g.setPitch(-0.03); }, [x, z, tx, tz, off]); await frames(p, 2); await shot(p, 'street_' + k, false); }
  }

  if (SHOT === 'house') {
    // night inside a house: the opening (a door or a wide gap) where a Gloom comes early is guarded by two lances a few steps inside, a panel shields the next opening along
    // the wall, the turbine stands behind; the picture is taken as the Gloom crosses the yard outside and the lances open up; the cannon in your hands
    const p = await open(); await midSave(p, { day: 7, nights: 5, food: 19, ess: 11, ringOpen: 3, scout: 2, cats: [0, 2, 3] }); const r = await startRun(p, 2);
    const hi = +(process.env.HOUSE || pickHouse(r, 4)); info('house ' + hi);
    await p.evaluate(([i, e]) => { const g = window.__game; g.enterHouse(i); g.sim.player.energy = e; }, [hi, 62]); await waitGame(p, 1.5, 0.3);
    await p.evaluate(() => window.__game.nightfall()); await waitGame(p, 0.5, 0.1);
    const pick = await p.evaluate((want) => { const s = window.__game.sim, B = s.breaches, out = [];
      for (const b of B) { if (b.floor !== 0) continue; const ts = s.spawns.filter((q) => q.bp === b.i && q.t > s.t + 4).map((q) => +q.t.toFixed(1)); out.push({ i: b.i, type: b.type, x: b.x, z: b.z, nx: b.nx, nz: b.nz, ts: ts.slice(0, 4) }); }
      const pref = (b) => (b.type === 'door' ? 0 : b.type === 'gap' ? 1 : 2) * 40 + (b.ts.length ? b.ts[0] : 999);
      const ok = out.filter((b) => b.ts.length && (!want || want.includes(b.type))).sort((u, v) => pref(u) - pref(v)); return { all: out.map((b) => [b.i, b.type, b.ts.join('/')]), pick: ok[0] || null, H: s.H };
    }, process.env.BTYPES ? process.env.BTYPES.split(',') : null);
    info('openings ' + JSON.stringify(pick.all) + ' pick ' + JSON.stringify(pick.pick)); const b = pick.pick, nx = b.nx, nz = b.nz, tx = -nz, tz = nx;
    const b2 = await p.evaluate(([bp, nx, nz]) => { const s = window.__game.sim, B = s.breaches[bp]; let best = null; for (const q of s.breaches) { if (q.i === bp || q.floor !== 0 || Math.abs(q.nx * nx + q.nz * nz) < 0.9) continue; const d = Math.hypot(q.x - B.x, q.z - B.z); if (d > 1.5 && d < 7 && (!best || d < best.d)) best = { x: q.x, z: q.z, d, type: q.type, i: q.i }; } return best; }, [b.i, nx, nz]); info('second opening ' + JSON.stringify(b2));
    const res = []; res.push(await place(p, 'turbine', b.x + nx * 5.2 - tx * 2.4, b.z + nz * 5.2 - tz * 2.4, -nx, -nz));
    if (b2) res.push(await place(p, 'panel', b2.x, b2.z, -nx, -nz));
    res.push(await place(p, 'lance', b.x + nx * 3.2 + tx * 1.5, b.z + nz * 3.2 + tz * 1.5, -nx, -nz));
    res.push(await place(p, 'lance', b.x + nx * 3.2 - tx * 1.5, b.z + nz * 3.2 - tz * 1.5, -nx, -nz)); info('placed ' + res.join(','));
    await stand(p, b.x + nx * 5.4, b.z + nz * 5.4, b.x, 1.4, b.z); await waitGame(p, 3, 0.3);
    const OUTD = (process.env.OUTD || '5,2.5').split(',').map(Number);
    for (let m = 0; m < OUTD.length; m++) {
      const st = await step(p, (s, a) => s.gloom.some((g) => g.bp === a[0] && g.floor === 0 && Math.hypot(g.x - s.breaches[a[0]].x, g.z - s.breaches[a[0]].z) < a[1]), 60, [b.i, OUTD[m]], 70);
      info('moment ' + OUTD[m] + ' m ' + JSON.stringify(st) + ' ' + JSON.stringify(await p.evaluate(() => window.__game.sim.gloom.map((g) => [g.kind, g.phase, g.bp, +g.x.toFixed(1), +g.z.toFixed(1)]))));
      await stand(p, b.x + nx * 5.4, b.z + nz * 5.4, b.x, 1.4, b.z); await p.evaluate(() => { window.__game.sim.player.hp = 74; }); await waitGame(p, 0.35, 0.1); await wheel(p, 1); await frames(p, 1); await freeze(p);
      const C = [[5.4, 0, 0], [4.6, -1.0, 0.3], [4.6, 1.0, 0.3], [6.2, 0.6, 0.2]];
      for (let k = 0; k < C.length; k++) { const [d, l, f] = C[k]; await stand(p, b.x + nx * d + tx * l, b.z + nz * d + tz * l, b.x - tx * l * f, 1.4, b.z - tz * l * f); await frames(p, 2); await shot(p, 'house_' + m + k, CLEAN.includes('house_' + m + k)); }
      await p.evaluate(() => { window.__dtMax = 0.1; });
    }
  }

  if (SHOT === 'gloom') {
    // a Gloom through the opening and close, its screen face toward you; you shoot it (a hit: the HEADSHOT or hit mark shows)
    const p = await open(); await midSave(p, { day: 7, nights: 5, food: 19, ess: 11, ringOpen: 3, scout: 2, cats: [0, 2, 3] }); const r = await startRun(p, 2);
    const hi = +(process.env.HOUSE || pickHouse(r, 3)); info('house ' + hi); const f = await nightIn(p, hi, 48); const b = f.b, nx = b.nx, nz = b.nz;
    info('turbine ' + await place(p, 'turbine', b.x + nx * 6 + nz * 2.5, b.z + nz * 6 - nx * 2.5, nx, nz));
    const ex = b.x + nx * 4.6, ez = b.z + nz * 4.6; await stand(p, ex, ez, b.x, 1.6, b.z); await waitGame(p, 2.5, 0.3);
    const DIST = (process.env.DISTS || '3.6,3.3,3.0,3.6,3.3,3.0').split(',').map(Number);
    const aimAt = () => p.evaluate(() => { const g = window.__game, s = g.sim, P = s.player; const q = s.gloom.slice().sort((u, v) => Math.hypot(u.x - P.x, u.z - P.z) - Math.hypot(v.x - P.x, v.z - P.z))[0]; if (!q) return null; const S = (window.CONFIG.cannon.shapes.high || {})[q.kind], hy = S ? (S[9] + S[10]) / 2 : 2.1; const dx = q.x - P.x, dz = q.z - P.z, y = Math.atan2(-dx, -dz), pi = Math.atan2(s.gloomY(q) + hy - 1.6, Math.hypot(dx, dz)); g.setYaw(y); g.setPitch(pi * 0.8); P.yaw = y; P.pitch = pi; P.hp = Math.min(Math.max(P.hp, 55), 100); P.cd = 0; P.energy = Math.max(P.energy, 20); return { kind: q.kind, d: Math.hypot(dx, dz).toFixed(2), phase: q.phase }; });
    for (let k = 0; k < DIST.length; k++) {
      const st = await step(p, (s, a) => s.gloom.some((g) => (g.phase === 'inside' || g.phase === 'cross') && Math.hypot(g.x - s.player.x, g.z - s.player.z) < a), 60, DIST[k], 55); info('close Gloom ' + JSON.stringify(st));
      const q = await aimAt(); info('target ' + JSON.stringify(q)); if (!q) continue; await waitGame(p, 0.3, 0.1); await aimAt();
      const hit = await p.evaluate(() => { window.__dtMax = 0.02; const g = window.__game, s = g.sim; const n0 = s.log.length; g.fire(); const ev = s.log.slice(n0).filter((e) => e.e === 'shot'); return JSON.stringify(ev.map((e) => ({ hit: e.hit, head: e.head }))); }); info('fired ' + hit);
      await frames(p, 2); await shot(p, 'gloom_' + k, CLEAN.includes('gloom_' + k));
      await waitGame(p, 1.2, 0.2);
    }
  }

  if (SHOT === 'boss') {
    // THE BECKONER, the last ring's night, seen from inside the house you hold (at the door that faces it)
    const p = await open(); await midSave(p, { day: 14, nights: 11, food: 31, ess: 18, ringOpen: 5, scout: 2, cats: [0, 2, 3] }); const r = await startRun(p, 4);
    for (let k = 0; k < 150; k++) { if (await p.evaluate(() => window.__boss.model === 'ready' || window.__boss.model === 'failed')) break; await p.waitForTimeout(1000); }
    const hi = pickHouse(r, 4); await p.evaluate((i) => { const g = window.__game; g.enterHouse(i); g.sim.player.energy = 60; }, hi); await waitGame(p, 1.5, 0.3); await p.evaluate(() => window.__game.nightfall()); await waitGame(p, 0.6, 0.1);
    info('boss ' + JSON.stringify(await p.evaluate(() => ({ model: window.__boss.model, built: window.__boss.built, boss: !!window.__game.sim.boss }))));
    const look = (what, back, pk, side, fl) => p.evaluate(([what, back, pk, side, fl]) => { fl = fl || 0; const FH = window.CONFIG.floorH; const g = window.__game, s = g.sim, B = s.boss, C = window.CONFIG.boss;
      const pt = what === 'beckon' ? B.at(C.pts.beckon) : what === 'chest' ? B.at(C.pts.chest) : B.at([0, 4.5, 0]);
      let best = null; for (const b of s.breaches) { if (b.floor !== fl) continue; const dx = b.x - pt.x, dz = b.z - pt.z, d = Math.hypot(dx, dz) || 1, x = b.x + dx / d * back - dz / d * side, z = b.z + dz / d * back + dx / d * side; if (Math.abs(x) > s.H - 0.3 || Math.abs(z) > s.H - 0.3 || dx * b.nx + dz * b.nz <= 0) continue; if (!s.openAt(x, z, pt.x, pt.z, fl)) continue; const w = b.type === 'door' ? -3 : b.type === 'gap' ? -2 : 0, dd = Math.hypot(x - pt.x, z - pt.z) + w; if (!best || dd < best.dd) best = { x, z, dd, type: b.type }; }
      if (!best) return null; s.player.x = best.x; s.player.z = best.z; s.player.floor = fl; s.player.climb = null; const dx = pt.x - best.x, dz = pt.z - best.z; g.setYaw(Math.atan2(-dx, -dz)); g.setPitch(Math.min(0.5, Math.atan2((pt.y || 4) - 1.6 - fl * FH, Math.hypot(dx, dz)) * pk)); s.player.hp = 1e6; return best; }, [what, back, pk, side, fl]);
    const until = async (fn, maxS) => { for (let k = 0; k < maxS * 2; k++) { const v = await p.evaluate((f) => { const s = window.__game.sim; if (!s) return 'nosim'; s.player.hp = 1e6; const T = new Function('s', 'B', 'return (' + f + ')(s, B)'); for (let i = 0; i < 5 && !s.done; i++) { if (T(s, s.boss)) return true; s.step(0.1); } return T(s, s.boss); }, fn.toString()); if (v === true) return true; if (v === 'nosim') return false; await p.waitForTimeout(40); } return false; };
    const V = process.env.BV ? JSON.parse(process.env.BV) : [['body', 0.5, 0.8, 0, 1], ['body', 1.2, 0.8, 0, 1], ['beckon', 0.8, 0.9, 0.5, 1], ['body', 0.8, 0.7, -0.6, 1], ['chest', 2.0, 0.8, 0, 1], ['body', 1.0, 0.7, 0, 0]];
    const moments = [['summon glow', (s, B) => B.act && B.act.kind === 'summon' && B.act.step === 'tele' && B.act.left < 0.8, 120], ['summoned', (s, B) => B.act && B.act.kind === 'summon' && B.act.step === 'hold' && s.gloom.length > 0, 20]];
    for (let m = 0; m < moments.length; m++) { const ok = await until(moments[m][1], moments[m][2]); info('moment ' + moments[m][0] + ' ' + ok); await look('body', 0.3, 0.7, 0); await p.evaluate(() => { window.__game.sim.player.hp = 81; }); await waitGame(p, 0.2, 0.05); await freeze(p);
      for (let k = 0; k < V.length; k++) { const w = await look(...V[k]); info('look ' + JSON.stringify(V[k]) + ' ' + JSON.stringify(w)); if (!w) continue; await p.evaluate(() => { window.__game.sim.player.hp = 81; window.__dtMax = 0.25; }); await frames(p, 3); await freeze(p); await frames(p, 1); await shot(p, 'boss_' + m + k, CLEAN.includes('boss_' + m + k)); }
      await p.evaluate(() => { window.__dtMax = 0.1; }); }
  }

  console.log(errs.length ? 'PAGE ERRORS ' + [...new Set(errs)].slice(0, 5).join(' | ') : 'NO PAGE ERRORS'); console.log('done ' + el());
  await b.close(); srv.close();
})().catch((e) => { console.log('FAIL crashed: ' + String(e && e.stack || e).slice(0, 800)); process.exit(1); });
