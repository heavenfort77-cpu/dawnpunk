// Lag check (lag report Nov 18, fix batch Nov 19): draw calls and triangles per frame at four fixed spots, and the bytes the page downloads.
// Usage: node tools/perfcheck.cjs [medium|high|low|all|both|comma list, default medium] [out_dir]     (out_dir given: a 1280x720 picture of each spot is written there as <tier>_<spot>.png)
// Spots (set up with the test hooks on window.__game, as tools/itchshot.cjs does): hub = day 1 in the base just after "click to begin" (fresh save, the start spot);
// street = the old street by day at the run's start; house = night inside a house with a Gloom crossing the yard toward the opening you face; boss = THE BECKONER's night, seen from the house.
// Counting is done on the WebGL calls themselves (every drawArrays / drawElements and their instanced forms, all passes: sun shadow map, contact shading, screen, hands),
// so it equals renderer.info.render.calls / .triangles summed over every renderer.render() of a frame, averaged over FRAMES frames (default 6) with game time held still.
// "screen" = the draws into the visible picture only (framebuffer null). Bytes = everything the local server sent (index.html and the files beside it), as itch serves the zip.
// Frame time is printed for reference only (software GPU on the runner: not a real frame rate).
// REAL FRAME RATES (coordinator Nov 19): GPU=1 runs Chromium on the real GPU of a GitHub macOS runner (.github/workflows/perfgpu.yml; tools/gpu_task.sh starts it):
// at each spot, after the counting, SETTLE seconds of frames are drawn (first-use hitches: shader builds, uploads; their worst frame is printed as 'first'), then
// SECS seconds are timed: fps, average, 95th percentile and worst frame (ms) of steady play, with game time held still so the picture is the same throughout.
// PASS / FAIL lines: the owner's budget (Nov 19) on the default tier (medium) at every spot; other tiers are printed only. On the default tier it also checks the ?perf=1
// overlay, the automatic step-down and that GPU memory does not grow across runs (NOEXTRA=1 skips that).
// COMBAT (owner Nov 19 07:10: night combat must not fail; FPS first). Two more spots measure REAL combat, not a still camera, with game time running:
// combat = a street house at night (ring index 2), bosscombat = THE BECKONER's night (ring index 4) once the boss is up and summoning. A bot drives the game's own
// input paths in the page: it aims at the nearest Gloom (and at the boss on its night), fires quick shots and a charged shot every few seconds (the shots, hits, kills,
// scrap debris and impact effects of main.js doFire), places the loadout's devices (main.js doPlace) and lets Marla's lines run. The number of Gloom alive is kept
// at the night's normal maximum (COMBAT_N / BOSS_N; the average bot's median of the most alive at once over 12 nights per ring: ring index 2 -> 18, ring index 4 -> 24),
// topped up through the sim's own addGloom at the breaches. After SETTLE s it times CSECS s (default 20): fps, p95, worst; draw calls and triangles are averaged
// per frame over the same window (max printed too). The loading cards run for real (?cards=1: shader builds and uploads under the card, as for a player).
// Gates (PASS/FAIL) on the DEFAULT tier: average >= 60 fps, p95 <= 25 ms, no frame over 100 ms from the first frame after the card (settle included),
// fps >= the hub's (when the hub is measured in the same job: spots joined with '+' run in one job, one machine), under 500 calls and 0.5 M triangles.
// Low tier: >= 60 fps gate too. High: printed only.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ARG = process.argv[2] || 'medium', OUT = process.argv[3] || '', SEED = +(process.env.SEED || 777), FRAMES = +(process.env.FRAMES || 6), DIST = path.join(__dirname, '..', 'dist');
const GPU = !!process.env.GPU, SECS = +(process.env.SECS || (GPU ? 8 : 0)), SETTLE = +(process.env.SETTLE || 6);
const ONLY = process.env.SPOTS ? process.env.SPOTS.split(/[,+]/) : ['hub', 'street', 'house', 'boss'];
// combat spots: ring index, Gloom kept alive (the night's normal most at once, see the header), seconds timed
const COMBAT = { combat: { ring: 2, n: +(process.env.COMBAT_N || 18) }, bosscombat: { ring: 4, n: +(process.env.BOSS_N || 24), boss: true } }, CSECS = +(process.env.CSECS || 20);
// combat gates: fps at least, 95th percentile frame at most (ms), worst frame at most (ms); on the default tier, and the fps gate on low too
const CGATE = { fps: 60, p95: 25, worst: 100 };
// targets (owner's budget Nov 19) on the DEFAULT tier (TT, medium): draw calls per frame (all passes), triangles per frame (all passes), MB downloaded before the hub is ready
const TT = 'medium', TARGET = { hub: { calls: 500, tris: 0.5e6 }, street: { calls: 500, tris: 0.5e6 }, house: { calls: 500, tris: 0.5e6 }, boss: { calls: 500, tris: 0.5e6 }, startMB: 20 };
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.json': 'application/json', '.ktx2': 'image/ktx2' };
let served = [], T0 = Date.now();
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  const n = fs.statSync(f).size; served.push({ f: path.relative(DIST, f), n, t: Date.now() }); r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Content-Length': n }); fs.createReadStream(f).pipe(r); });
const info = (m) => console.log('INFO ' + m), el = () => Math.round((Date.now() - T0) / 1000) + ' s', MB = (b) => +(b / 1048576).toFixed(1);
const sumB = () => served.reduce((a, s) => a + s.n, 0);
// counts every draw on the WebGL context (installed before the page's own scripts run)
const INIT = ({ seed }) => { let s = seed; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__fakeLock = true; try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ }
  const C = window.__pc = { calls: 0, tris: 0, sCalls: 0, sTris: 0 }; let screen = true;
  const tri = (gl, mode, n, inst) => (mode === gl.TRIANGLES ? Math.floor(n / 3) : (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) ? Math.max(0, n - 2) : 0) * (inst || 1);
  for (const P of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) { if (!P) continue; const pr = P.prototype;
    const bf = pr.bindFramebuffer; pr.bindFramebuffer = function (tg, fb) { if (tg === this.FRAMEBUFFER || tg === this.DRAW_FRAMEBUFFER) screen = !fb; return bf.apply(this, arguments); };
    const wrap = (name, f) => { const o = pr[name]; if (!o) return; pr[name] = function () { const t = f(this, arguments); C.calls++; C.tris += t; if (screen) { C.sCalls++; C.sTris += t; } return o.apply(this, arguments); }; };
    wrap('drawArrays', (gl, a) => tri(gl, a[0], a[2])); wrap('drawElements', (gl, a) => tri(gl, a[0], a[1]));
    wrap('drawArraysInstanced', (gl, a) => tri(gl, a[0], a[2], a[3])); wrap('drawElementsInstanced', (gl, a) => tri(gl, a[0], a[1], a[4])); wrap('drawRangeElements', (gl, a) => tri(gl, a[0], a[3])); } };

// BREAK=1 in the environment: what the triangles and draws are made of at each spot (objects in view, grouped by their named ancestors, object type and material), for finding the costs
const BREAKDOWN = (spot) => {
  const g = window.__game, cam = g.cam; let sc = null; for (const c of [g.world && g.world.g, g.dormant, g.bview.group, g.marla && g.marla.root]) { let s = c; while (s && s.parent) s = s.parent; if (s && s.isScene) { sc = s; break; } } if (!sc) return 'BREAK ' + spot + ': no scene';
  cam.updateMatrixWorld(); const P = cam.projectionMatrix.elements, V = cam.matrixWorldInverse.elements, M = new Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + j] * V[i * 4 + k]; M[i * 4 + j] = s; }
  const me = M, pl = [[me[3] - me[0], me[7] - me[4], me[11] - me[8], me[15] - me[12]], [me[3] + me[0], me[7] + me[4], me[11] + me[8], me[15] + me[12]], [me[3] + me[1], me[7] + me[5], me[11] + me[9], me[15] + me[13]], [me[3] - me[1], me[7] - me[5], me[11] - me[9], me[15] - me[13]], [me[3] - me[2], me[7] - me[6], me[11] - me[10], me[15] - me[14]], [me[3] + me[2], me[7] + me[6], me[11] + me[10], me[15] + me[14]]].map((q) => { const l = Math.hypot(q[0], q[1], q[2]); return q.map((v) => v / l); });
  const inView = (o) => { if (!o.frustumCulled) return true; let bs = o.boundingSphere; if (!bs && o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); bs = o.geometry.boundingSphere; } if (o.isInstancedMesh && !o.boundingSphere) { o.computeBoundingSphere(); bs = o.boundingSphere; } if (!bs) return true;
    const e = o.matrixWorld.elements, cx = e[0] * bs.center.x + e[4] * bs.center.y + e[8] * bs.center.z + e[12], cy = e[1] * bs.center.x + e[5] * bs.center.y + e[9] * bs.center.z + e[13], cz = e[2] * bs.center.x + e[6] * bs.center.y + e[10] * bs.center.z + e[14], sr = bs.radius * Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
    for (const q of pl) if (q[0] * cx + q[1] * cy + q[2] * cz + q[3] < -sr) return false; return true; };
  const topOf = (o) => { let q = o, c = null; while (q.parent && q.parent !== sc) q = q.parent; c = q; return (c.name || c.type) + '#' + sc.children.indexOf(c) + (c.children[0] && c !== o ? '>' + (c.children.indexOf(o.parent) >= 0 ? 'direct' : 'deep') : ''); };
  let hT = 0, hD = 0;
  const groups = new Map(); let tv = 0, dv = 0, ts = 0, ds = 0, tAll = 0, dAll = 0, nLights = 0;
  const walk = (o, path, vis) => { if (!o.visible) return; if (o.isLight) nLights++; const nm = o.name || (o.userData && (o.userData.hiInst || o.userData.kind || o.userData.part)) || ''; const p2 = nm ? (path ? path + '/' : '') + String(nm).slice(0, 18) : path;
    if ((o.isMesh || o.isPoints || o.isLine) && o.geometry) { const ge = o.geometry, n = ge.index ? ge.index.count : (ge.attributes.position ? ge.attributes.position.count : 0), dr = Math.min(n, ge.drawRange.count === Infinity ? n : ge.drawRange.count), mats = Array.isArray(o.material) ? o.material.length : 1;
      const t = Math.floor(dr / 3) * (o.isInstancedMesh ? o.count : 1) * (o.isMesh ? 1 : 0), iv0 = inView(o), lay = (o.layers.mask & cam.layers.mask) !== 0, iv = iv0 && lay; tAll += t; dAll += mats; if (iv0 && !lay) { hT += t; hD += mats; } if (o.castShadow) { ts += t; ds += mats; }
      if (iv) { tv += t; dv += mats; const ud = Object.keys(o.userData || {}).filter((k) => k !== 'keep').slice(0, 3).join(','), sz = t > 20000 ? '>20k' : t > 2000 ? '>2k' : t > 200 ? '>200' : '<200'; const key = p2.split('/').slice(-3).join('/') + ' | ' + o.type + ' ' + (ge.type || '').replace('Geometry', 'G') + ' ' + (Array.isArray(o.material) ? 'multi' : o.material.type) + (o.castShadow ? ' cs' : '') + (o.frustumCulled ? '' : ' NOCULL') + (o.layers.mask === 2 ? ' HIDDEN-BEHIND-WALLS' : '') + ' ud[' + ud + '] ' + sz + ' top:' + topOf(o); const q = groups.get(key) || { t: 0, d: 0, n: 0 }; q.t += t; q.d += mats; q.n++; groups.set(key, q); } }
    for (const c of o.children) walk(c, p2, vis); };
  walk(sc, '', true);
  const top = (f, n) => [...groups.entries()].sort((a, b) => f(b[1]) - f(a[1])).slice(0, n).map(([k, q]) => '  ' + (q.t / 1000).toFixed(1) + 'k tris ' + q.d + ' draws ' + q.n + ' obj  ' + k).join('\n');
  return 'BREAK ' + spot + ': in view ' + dv + ' draws ' + (tv / 1e6).toFixed(2) + ' M tris; whole scene ' + dAll + ' draws ' + (tAll / 1e6).toFixed(2) + ' M tris; in view but hidden behind the walls (night cull) ' + hD + ' draws ' + (hT / 1e6).toFixed(2) + ' M tris; shadow casters ' + ds + ' draws ' + (ts / 1e6).toFixed(2) + ' M tris; lights ' + nLights + '\n BY TRIANGLES\n' + top((q) => q.t, 20) + '\n BY DRAWS\n' + top((q) => q.d, 20);
};
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const URL0 = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ args: GPU ? ['--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const out = [], rows = [];
  { const files = ['index.html', 'index_single.html', 'solardg-itch.zip']; for (const d of ['models', 'tex', 'music', 'voice']) { const p = path.join(DIST, d); if (fs.existsSync(p)) files.push(d + '/'); }
    const size = (f) => { const p = path.join(DIST, f); if (!fs.existsSync(p)) return 0; if (!fs.statSync(p).isDirectory()) return fs.statSync(p).size; return fs.readdirSync(p).reduce((a, x) => a + size(path.join(f, x)), 0); };
    info('dist sizes MB: ' + files.map((f) => f + ' ' + MB(size(f))).join(', ')); }
  if (GPU) { const pg = await b.newPage(); console.log('RENDERER ' + await pg.evaluate(() => { const c = document.createElement('canvas'), gl = c.getContext('webgl2'); if (!gl) return 'no WebGL2'; const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })); await pg.close(); }
  for (const tier of ARG === 'both' ? ['high', 'low'] : ARG === 'all' ? ['medium', 'high', 'low'] : ARG.split(',')) {
    served = []; T0 = Date.now(); const errs = [];
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); await ctx.addInitScript(INIT, { seed: SEED });
    const p = await ctx.newPage(); p.setDefaultTimeout(900000); p.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.goto(URL0 + '?quality=' + tier + '&seed=' + SEED + (GPU ? '&cards=1' : ''), { timeout: 900000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 900000 }); info(tier + ': page up ' + el() + ', ' + MB(sumB()) + ' MB so far');
    const frames = (n) => p.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const waitGame = (secs, cap) => p.evaluate(([secs, cap]) => new Promise((res) => { window.__dtMax = cap; let acc = 0, last = performance.now(), n = 0; const f = (now) => { acc += Math.min(cap, (now - last) / 1000); last = now; if (acc >= secs || ++n > 400) res(n); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), [secs, cap || 0.3]);
    async function waitLoads(what) { for (let k = 0; k < 400; k++) { const s = await p.evaluate(() => { const q = window.__game.quality().hi, G = window.__gloomGlb || {}, B = window.__boss || {}; return { hi: q.ok + q.failed >= q.asked, marla: window.__game.marla.ready, glb: Object.values(G).every((v) => v !== 'loading'), boss: B.model !== 'loading' }; }); if (s.hi && s.marla && s.glb && s.boss) { info(what + ' loaded ' + el() + ' ' + MB(sumB()) + ' MB so far'); return; } await p.waitForTimeout(1000); } info(what + ': loads not all done'); }
    // the measurement: game time held (as the picture tools do), 2 frames to settle, then FRAMES frames counted
    async function measure(spot) {
      await p.evaluate(() => { window.__fakeLock = true; window.__dtMax = 0.0005; }); await frames(2);
      const c0 = await p.evaluate(() => ({ ...window.__pc, t: performance.now() })); await frames(FRAMES); const c1 = await p.evaluate(() => ({ ...window.__pc, t: performance.now() }));
      const r = { tier, spot, calls: Math.round((c1.calls - c0.calls) / FRAMES), tris: Math.round((c1.tris - c0.tris) / FRAMES), sCalls: Math.round((c1.sCalls - c0.sCalls) / FRAMES), sTris: Math.round((c1.sTris - c0.sTris) / FRAMES), ms: Math.round((c1.t - c0.t) / FRAMES), mb: MB(sumB()) };
      r.cam = await p.evaluate(() => { const c = window.__game.cam, n = window.__nightCull; return [c.position.x, c.position.y, c.position.z].map((v) => v.toFixed(1)).join(',') + ' yaw ' + window.__game.yaw.toFixed(2) + ' far ' + c.far.toFixed(0) + (n && n.hidden ? ' nightcull ' + n.hidden + '/' + n.items : ''); });
      if (process.env.BREAK) console.log(await p.evaluate(BREAKDOWN, spot));
      // PROFILE=1: a CPU profile of 5 s of normal play here (game time running), the top 15 functions by self time (build with MINIFY=0 for readable names)
      if (process.env.PROFILE && (spot === 'house' || spot === 'boss')) { const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
        await p.evaluate(() => { window.__dtMax = 0.05; const s = window.__game.sim; if (s) s.player.hp = 1e6; }); await cdp.send('Profiler.start'); await p.waitForTimeout(5000); const { profile } = await cdp.send('Profiler.stop'); await p.evaluate(() => { window.__dtMax = 0.0005; });
        const self = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n])); let tot = 0; profile.samples.forEach((id, i) => { const dt = (profile.timeDeltas[i] || 0) / 1000, n = byId.get(id), cf = n.callFrame; tot += dt; const k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1); self.set(k, (self.get(k) || 0) + dt); });
        console.log('PROFILE ' + tier + ' ' + spot + ' (' + Math.round(tot) + ' ms sampled):\n' + [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => '  ' + v.toFixed(0) + ' ms ' + (100 * v / tot).toFixed(1) + '% ' + k).join('\n')); await cdp.detach(); }
      if (SECS) { const f = await p.evaluate(([settle, secs]) => new Promise((res) => { const ts = []; let t0 = 0, first = 0, last = 0; const step = (now) => { if (!t0) t0 = now; if (now - t0 < settle * 1000) { if (last) first = Math.max(first, now - last); last = now; requestAnimationFrame(step); return; } ts.push(now); if (now - t0 < (settle + secs) * 1000) requestAnimationFrame(step); else {
          const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b), avg = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length); res({ n: d.length, fps: 1000 / avg, avg, p95: d[Math.floor(d.length * 0.95)] || 0, worst: d[d.length - 1] || 0, first }); } }; requestAnimationFrame(step); }), [SETTLE, SECS]);
        r.fps = +f.fps.toFixed(1); r.avgMs = +f.avg.toFixed(1); r.p95 = +f.p95.toFixed(1); r.worst = +f.worst.toFixed(1); r.first = Math.round(f.first);
        console.log('FPS ' + tier + ' ' + spot + ': ' + r.fps + ' fps, avg ' + r.avgMs + ' ms, p95 ' + r.p95 + ' ms, worst ' + r.worst + ' ms (' + f.n + ' frames), worst first-use frame ' + r.first + ' ms'); }
      rows.push(r); console.log('PERF ' + tier + ' ' + spot + ': calls ' + r.calls + ' (screen ' + r.sCalls + '), triangles ' + (r.tris / 1e6).toFixed(2) + ' M (screen ' + (r.sTris / 1e6).toFixed(2) + ' M), frame ' + r.ms + ' ms (software GPU), downloaded ' + r.mb + ' MB, cam ' + r.cam);
      if (OUT) { const f = path.join(OUT, tier + '_' + spot + '.png'); await p.screenshot({ path: f, timeout: 900000 }); info('wrote ' + f); }
      await p.evaluate(() => { window.__dtMax = 0.3; });
      return r;
    }
    const midSave = async (o) => { await p.evaluate((o) => { const g = window.__game; g.enterBase(); const s = g.save; s.day = o.day; s.nights = o.nights; s.trips = o.nights; s.food = o.food; s.essentials = o.ess; s.essTotal = o.ess + 14; s.killsTotal = o.nights * 9;
      s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.noteSeen = true; s.toldCharge = true; s.ringOpen = o.ringOpen; s.scoutSpot = o.scout; s.up.slots = 1; s.loadout = ['turbine', 'lance', 'panel', 'mine'];
      s.met = { walker: true, lurcher: true, ticks: true, hauler: true, stilt: true }; if (o.cats) s.cats.forEach((c, i) => { c.spot = o.cats[i]; }); g.reBase(); }, o); await waitLoads('base'); };
    const startRun = async (ring) => { await p.evaluate((ring) => { document.getElementById('selRing').value = String(ring); window.__game.startRun(); }, ring); await waitGame(1, 0.3); await waitLoads('run');
      return p.evaluate(() => { const r = window.__game.run; return { ring: r.ring, cat: r.catHouse, houses: r.houses.map((h) => ({ i: h.i, n: h.n, L: h.sim.L })) }; }); };
    const pickHouse = (r, want) => { const ok = r.houses.filter((h) => h.i !== r.cat); ok.sort((a, b) => (a.L - b.L) || (Math.abs(a.n - want) - Math.abs(b.n - want))); return ok[0].i; };
    const stand = (x, z, tx, ty, tz) => p.evaluate(([x, z, tx, ty, tz]) => { const g = window.__game, s = g.sim, P = s.player; P.x = x; P.z = z; P.floor = 0; P.climb = null; const dx = tx - x, dz = tz - z, y = Math.atan2(-dx, -dz), pi = Math.atan2(ty - 1.6, Math.hypot(dx, dz)); g.setYaw(y); g.setPitch(pi); P.yaw = y; P.pitch = pi; }, [x, z, tx, ty, tz]);
    const step = (test, maxS, arg) => p.evaluate(([f, maxS, a]) => { const s = window.__game.sim, T = new Function('s', 'a', 'return (' + f + ')(s, a)'); for (let k = 0; k < maxS * 20; k++) { s.player.hp = Math.max(s.player.hp, 60); if (T(s, a)) return { ok: true, t: s.t }; s.step(0.05); } return { ok: false, t: s.t }; }, [test.toString(), maxS, arg]);

    if (ONLY.includes('hub')) {
      // day 1, a fresh save, the start spot and view
      await p.evaluate(() => window.__game.enterBase()); await waitLoads('hub'); const startMB = MB(sumB()); await waitGame(3, 0.3);
      const r = await measure('hub'); r.startMB = startMB; info(tier + ' downloaded before the hub was ready: ' + startMB + ' MB (' + served.length + ' requests)');
      if (tier === TT) out.push([TT + ': downloaded before the hub is ready ' + startMB + ' MB (target < ' + TARGET.startMB + ')', startMB < TARGET.startMB]);
    }
    if (ONLY.includes('street')) {
      await midSave({ day: 5, nights: 3, food: 17, ess: 6, ringOpen: 3, scout: 2, cats: [0, 2, 3] }); await startRun(1); await waitGame(3, 0.5); await measure('street');
    }
    if (ONLY.includes('house')) {
      await midSave({ day: 7, nights: 5, food: 19, ess: 11, ringOpen: 3, scout: 2, cats: [0, 2, 3] }); const r = await startRun(2); const hi = pickHouse(r, 4);
      await p.evaluate(([i, e]) => { const g = window.__game; g.enterHouse(i); g.sim.player.energy = e; }, [hi, 62]); await waitGame(1.5, 0.3);
      await p.evaluate(() => window.__game.nightfall()); await waitGame(0.5, 0.1); await waitLoads('night');
      const first = await p.evaluate(() => { const s = window.__game.sim; let k = 0; while (!s.gloom.length && k++ < 900) s.step(0.05); const g0 = s.gloom[0]; if (!g0) return null; const b = s.breaches[g0.bp]; return { kind: g0.kind, bp: g0.bp, b: { x: b.x, z: b.z, nx: b.nx, nz: b.nz } }; });
      info('night: first Gloom ' + JSON.stringify(first));
      if (first) { const b = first.b; await step((s, a) => s.gloom.some((g) => g.bp === a[0] && Math.hypot(g.x - s.breaches[a[0]].x, g.z - s.breaches[a[0]].z) < a[1]), 60, [first.bp, 5]);
        await stand(b.x + b.nx * 5.4, b.z + b.nz * 5.4, b.x, 1.4, b.z); await waitGame(0.4, 0.1); await waitLoads('night gloom'); await stand(b.x + b.nx * 5.4, b.z + b.nz * 5.4, b.x, 1.4, b.z); }
      const g = await p.evaluate(() => window.__game.sim.gloom.map((q) => q.kind).join(',')); info('Gloom present: ' + g);
      await measure('house');
    }
    if (ONLY.includes('boss')) {
      await midSave({ day: 14, nights: 11, food: 31, ess: 18, ringOpen: 5, scout: 2, cats: [0, 2, 3] }); const r = await startRun(4);
      for (let k = 0; k < 300; k++) { if (await p.evaluate(() => !window.__boss || window.__boss.model === 'ready' || window.__boss.model === 'failed' || window.__boss.model === 'none')) break; await p.waitForTimeout(1000); }
      const hi = pickHouse(r, 4); await p.evaluate((i) => { const g = window.__game; g.enterHouse(i); g.sim.player.energy = 60; }, hi); await waitGame(1.5, 0.3); await p.evaluate(() => window.__game.nightfall()); await waitGame(0.6, 0.1);
      for (let k = 0; k < 300; k++) { if (await p.evaluate(() => window.__boss.model !== 'loading')) break; await p.waitForTimeout(1000); }
      // until it is up and summoning (the itch picture's moment), then stand at the opening that faces it
      for (let k = 0; k < 240; k++) { const v = await p.evaluate(() => { const s = window.__game.sim; s.player.hp = 1e6; for (let i = 0; i < 5 && !s.done; i++) { const B = s.boss; if (B && B.act && B.act.kind === 'summon') return true; s.step(0.1); } return false; }); if (v) break; }
      const w = await p.evaluate(() => { const g = window.__game, s = g.sim, B = s.boss; if (!B) return null; const pt = B.at([0, 4.5, 0]); let best = null;
        for (const b of s.breaches) { if (b.floor !== 0) continue; const dx = b.x - pt.x, dz = b.z - pt.z, d = Math.hypot(dx, dz) || 1, x = b.x + dx / d * 1.2, z = b.z + dz / d * 1.2; if (Math.abs(x) > s.H - 0.3 || Math.abs(z) > s.H - 0.3 || dx * b.nx + dz * b.nz <= 0) continue; if (!s.openAt(x, z, pt.x, pt.z, 0)) continue; const dd = Math.hypot(x - pt.x, z - pt.z) + (b.type === 'door' ? -3 : b.type === 'gap' ? -2 : 0); if (!best || dd < best.dd) best = { x, z, dd }; }
        if (!best) return null; s.player.x = best.x; s.player.z = best.z; s.player.floor = 0; s.player.climb = null; const dx = pt.x - best.x, dz = pt.z - best.z; g.setYaw(Math.atan2(-dx, -dz)); g.setPitch(Math.min(0.5, Math.atan2(4.5 - 1.6, Math.hypot(dx, dz)) * 0.8)); return best; });
      info('boss view ' + JSON.stringify(w) + ' ' + JSON.stringify(await p.evaluate(() => ({ model: window.__boss.model, boss: !!window.__game.sim.boss }))));
      await waitGame(0.3, 0.05); await measure('boss');
    }
    // COMBAT spots (see the header): a real night fight driven by the bot below, game time running
    for (const spot of ['combat', 'bosscombat']) { if (!ONLY.includes(spot)) continue; const C = COMBAT[spot];
      await midSave(C.boss ? { day: 14, nights: 11, food: 31, ess: 18, ringOpen: 5, scout: 2, cats: [0, 2, 3] } : { day: 7, nights: 5, food: 19, ess: 11, ringOpen: 3, scout: 2, cats: [0, 2, 3] });
      const r = await startRun(C.ring); await p.waitForFunction(() => !window.__game.cardOn(), null, { timeout: 120000 }).catch(() => null);
      if (C.boss) for (let k = 0; k < 300; k++) { if (await p.evaluate(() => !window.__boss || ['ready', 'failed', 'none'].includes(window.__boss.model))) break; await p.waitForTimeout(1000); }
      const hi = pickHouse(r, 4); await p.evaluate((i) => { const g = window.__game; g.enterHouse(i); g.sim.player.energy = 62; }, hi); await waitGame(1.5, 0.3);
      await p.evaluate(() => { window.__dtMax = 0.05; window.__game.nightfall(); }); await p.waitForTimeout(300); await p.waitForFunction(() => !window.__game.cardOn(), null, { timeout: 120000 }).catch(() => null); await waitLoads('combat night');
      // the boss night: on until THE BECKONER is up and acting (summoning or striking), in the sim alone (as the boss spot does)
      if (C.boss) for (let k = 0; k < 240; k++) { const v = await p.evaluate(() => { const s = window.__game.sim; s.player.hp = 1e6; for (let i = 0; i < 5 && !s.done; i++) { const B = s.boss; if (B && B.act) return true; s.step(0.1); } return false; }); if (v) break; }
      // the bot: the game's own shot, charged shot and device placing (main.js doFire / doPlace), the aim set as the mouse would; HP and Sun topped up so the fight goes on
      await p.evaluate(({ n, boss }) => { const g = window.__game, s = g.sim, P = s.player, bps = s.breaches.map((b, i) => i).filter((i) => s.breaches[i].floor === 0);
        const kinds = (g.save && g.save.loadout) || ['turbine', 'lance', 'panel', 'mine']; const st = window.__cb = { on: true, quick: 0, charged: 0, placed: 0, placeOk: 0, kills0: s.killed, maxAlive: 0, sumAlive: 0, sumInside: 0, frames: 0, lines: 0, boss: !!s.boss };
        P.x = 0; P.z = 0; P.floor = 0; P.climb = null; let last = performance.now(), tq = 0, tc = 0, tp = 0, tb = 0, slot = 0, line = '';
        const loop = (now) => { if (!st.on || s.done) return; const dt = Math.min(0.1, (now - last) / 1000); last = now; tq += dt; tc += dt; tp += dt; tb += dt;
          P.hp = Math.max(P.hp, 60); P.energy = Math.max(P.energy, 80); if (s.gloom.length < n) s.addGloom(n - s.gloom.length, { at: s.t, gap: 0.35, bps });
          let t = null, bd = 1e9, inside = 0; for (const q of s.gloom) { if (q.phase === 'inside') inside++; if (q.floor !== P.floor) continue; const d = Math.hypot(q.x - P.x, q.z - P.z) - (q.phase === 'inside' ? 8 : 0); if (d < bd) { bd = d; t = q; } }
          st.frames++; st.sumAlive += s.gloom.length; st.sumInside += inside; st.maxAlive = Math.max(st.maxAlive, s.gloom.length);
          let tx, ty, tz; if (boss && s.boss && s.boss.at && (tb % 6) > 3.5) { const pt = s.boss.at([0, 4.5, 0]); tx = pt.x; ty = 4.5; tz = pt.z; } else if (t) { tx = t.x; ty = s.gloomY(t) + 0.9; tz = t.z; }
          if (tx !== undefined) { const dx = tx - P.x, dz = tz - P.z; g.setYaw(Math.atan2(-dx, -dz)); g.setPitch(Math.max(-0.6, Math.min(0.6, Math.atan2(ty - 1.6, Math.hypot(dx, dz))))); }
          if (tq >= 0.3) { tq = 0; g.doFire(false); st.quick++; }
          if (tc >= 3) { tc = 0; g.doFire(true); st.charged++; }
          if (tp >= 4) { tp = 0; const nd = s.devices.length; g.doPlace(kinds[slot++ % kinds.length]); st.placed++; if (s.devices.length > nd) st.placeOk++; }
          const m = document.getElementById('marla'); if (m && m.textContent && m.textContent !== line) { line = m.textContent; st.lines++; }
          requestAnimationFrame(loop); };
        requestAnimationFrame(loop); }, { n: C.n, boss: !!C.boss });
      // timing: every frame from the first one after the card (the settle counts toward the worst frame), the steady window for fps / p95 / calls / triangles
      const f = await p.evaluate(([settle, secs]) => new Promise((res) => { const ts = [], cs = [], tr = []; let t0 = 0, last = 0, worstAll = 0, c0 = null; const step = (now) => { if (!t0) t0 = now; if (last) worstAll = Math.max(worstAll, now - last); last = now;
          if (now - t0 < settle * 1000) { requestAnimationFrame(step); return; } const pc = window.__pc; if (c0) { cs.push(pc.calls - c0.calls); tr.push(pc.tris - c0.tris); } c0 = { calls: pc.calls, tris: pc.tris }; ts.push(now);
          if (now - t0 < (settle + secs) * 1000) { requestAnimationFrame(step); return; }
          const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b), avg = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length), mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
          res({ n: d.length, fps: 1000 / avg, avg, p95: d[Math.floor(d.length * 0.95)] || 0, worst: d[d.length - 1] || 0, worstAll, calls: Math.round(mean(cs)), callsMax: Math.max(0, ...cs), tris: Math.round(mean(tr)), trisMax: Math.max(0, ...tr) }); }; requestAnimationFrame(step); }), [SETTLE, CSECS]);
      const cb = await p.evaluate(() => { const c = window.__cb, s = window.__game.sim; c.on = false; return { quick: c.quick, charged: c.charged, placed: c.placed, placeOk: c.placeOk, kills: s.killed - c.kills0, maxAlive: c.maxAlive, avgAlive: +(c.sumAlive / Math.max(1, c.frames)).toFixed(1), avgInside: +(c.sumInside / Math.max(1, c.frames)).toFixed(1), lines: c.lines, devices: s.devices.length, boss: !!s.boss && !!s.boss.act, done: s.done, gpu: window.__game.gpu() }; });
      const row = { tier, spot, calls: f.calls, tris: f.tris, callsMax: f.callsMax, trisMax: f.trisMax, fps: +f.fps.toFixed(1), avgMs: +f.avg.toFixed(1), p95: +f.p95.toFixed(1), worst: +f.worst.toFixed(1), worstAll: Math.round(f.worstAll), mb: MB(sumB()), combat: cb }; rows.push(row);
      console.log('FPS ' + tier + ' ' + spot + ': ' + row.fps + ' fps, avg ' + row.avgMs + ' ms, p95 ' + row.p95 + ' ms, worst ' + row.worst + ' ms (' + f.n + ' frames), worst from the card on ' + row.worstAll + ' ms');
      console.log('PERF ' + tier + ' ' + spot + ': calls ' + row.calls + ' (max ' + row.callsMax + '), triangles ' + (row.tris / 1e6).toFixed(2) + ' M (max ' + (row.trisMax / 1e6).toFixed(2) + ' M), downloaded ' + row.mb + ' MB');
      console.log('INFO combat ' + tier + ' ' + spot + ': ' + JSON.stringify(cb));
      if (process.env.BREAK) console.log(await p.evaluate(BREAKDOWN, spot));
      if (process.env.PROFILE) { const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await p.evaluate(() => { window.__cb.on = true; });
        await cdp.send('Profiler.start'); await p.waitForTimeout(5000); const { profile } = await cdp.send('Profiler.stop');
        const self = new Map(), byId = new Map(profile.nodes.map((q) => [q.id, q])); let tot = 0; profile.samples.forEach((id, i) => { const dt = (profile.timeDeltas[i] || 0) / 1000, cf = byId.get(id).callFrame; tot += dt; const k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1); self.set(k, (self.get(k) || 0) + dt); });
        console.log('PROFILE ' + tier + ' ' + spot + ' (' + Math.round(tot) + ' ms sampled; the bot was stopped, so this is the game alone):\n' + [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => '  ' + v.toFixed(0) + ' ms ' + (100 * v / tot).toFixed(1) + '% ' + k).join('\n')); await cdp.detach(); }
      if (OUT) { await p.screenshot({ path: path.join(OUT, tier + '_' + spot + '.png'), timeout: 900000 }); }
      await p.evaluate(() => { window.__dtMax = 0.3; });
    }
    const lo = served.filter((s) => /models\//.test(s.f)).map((s) => s.f.replace('models/', '') + ' @' + Math.round((s.t - T0) / 1000) + 's').join(', ');
    info(tier + ' total downloaded ' + MB(sumB()) + ' MB in ' + served.length + ' requests; models fetched: ' + (lo || 'none'));
    console.log(errs.length ? 'INFO page errors (' + tier + '): ' + [...new Set(errs)].slice(0, 4).join(' | ') : 'INFO no page errors (' + tier + ')');
    if (tier === TT) out.push([TT + ': no page errors' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 2).join(' | ') : ''), errs.length === 0]);
    await ctx.close();
  }
  // EXTRA (the default tier, when it is measured): the ?perf=1 overlay, the automatic step-down (forced) and GPU memory across runs (renderer.info.memory must not grow)
  if (!process.env.NOEXTRA && rows.some((r) => r.tier === TT)) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); await ctx.addInitScript(INIT, { seed: SEED }); const p = await ctx.newPage(); p.setDefaultTimeout(900000); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await p.goto(URL0 + '?quality=' + TT + '&perf=1&autostep=1&seed=' + SEED, { timeout: 900000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 900000 });
    await p.evaluate(() => window.__game.enterBase()); await p.waitForFunction(() => window.__perfHud, null, { timeout: 600000 }).catch(() => null);
    const hud = await p.evaluate(() => { const e = document.getElementById('perfhud'); return e ? e.textContent.replace(/\n/g, ' | ') : ''; });
    out.push([TT + ': ?perf=1 overlay shows fps, frame ms, calls, triangles, tier, ratio, steps: "' + hud + '"', /fps/.test(hud) && /worst/.test(hud) && /calls \d+/.test(hud) && /tris/.test(hud) && new RegExp('tier ' + TT + ' \\(address\\)').test(hud) && /ratio/.test(hud) && /steps 0/.test(hud)]);
    const st = await p.evaluate(() => { const g = window.__game; for (let i = 0; i < 4; i++) g.perfForce(); const q = g.quality(); return { s: g.perfStep(), ratio: q.pixelRatio, lights: q.lights, shadow: q.shadow }; });
    out.push([TT + ': the step-down (forced 4 times) takes ratio, ao, shadow, lights: ' + JSON.stringify(st), st.s.taken.join(',') === 'ratio,ao,shadow,lights' && st.ratio === 1 && st.lights <= 1]);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const mem = []; for (let k = 0; k < 3; k++) { await p.evaluate(() => { const g = window.__game; document.getElementById('selRing').value = '1'; g.startRun(); g.enterHouse(0); g.nightfall(); const s = g.sim; for (let i = 0; i < 400 && !s.gloom.length; i++) s.step(0.05); });
      for (let f = 0; f < 4; f++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      await p.evaluate(() => window.__game.reBase()); for (let f = 0; f < 4; f++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r))); mem.push(await p.evaluate(() => window.__game.gpu())); }
    out.push([TT + ': GPU memory back in the base after runs 1, 2, 3 (geometries/textures): ' + mem.map((m) => m.geometries + '/' + m.textures).join(', ') + ' (must not grow from run 2 to run 3)', mem[2].geometries <= mem[1].geometries + 20 && mem[2].textures <= mem[1].textures + 4]);
    out.push([TT + ': no page errors in the overlay, step and memory run' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), errs.length === 0]);
    await ctx.close();
  }
  for (const r of rows) { if (r.tier !== TT || !TARGET[r.spot]) continue; const T = TARGET[r.spot];
    out.push([TT + ' ' + r.spot + ': ' + r.calls + ' draw calls per frame (target < ' + T.calls + ')', r.calls < T.calls]);
    out.push([TT + ' ' + r.spot + ': ' + (r.tris / 1e6).toFixed(2) + ' M triangles per frame (target < ' + (T.tris / 1e6).toFixed(2) + ' M)', r.tris < T.tris]); }
  // owner Nov 19 07:10: night combat must not fail. On the default tier every combat gate; on low the frame-rate gates; high is printed only.
  { const hub = (rows.find((r) => r.tier === TT && r.spot === 'hub') || {}).fps;
    for (const r of rows) { if (!COMBAT[r.spot] || r.tier === 'high' || !r.fps) continue; const t = r.tier + ' ' + r.spot + ' (combat): ';
      out.push([t + r.fps + ' fps (target >= ' + CGATE.fps + ')', r.fps >= CGATE.fps]); out.push([t + 'p95 ' + r.p95 + ' ms (target <= ' + CGATE.p95 + ')', r.p95 <= CGATE.p95]);
      out.push([t + 'worst frame from the card on ' + r.worstAll + ' ms (target <= ' + CGATE.worst + ')', r.worstAll <= CGATE.worst]);
      if (r.tier !== TT) continue;
      if (hub) out.push([t + r.fps + ' fps vs hub ' + hub + ' fps in the same job (the night must not be slower)', r.fps >= hub]);
      out.push([t + r.calls + ' draw calls per frame on average (target < 500; max ' + r.callsMax + ')', r.calls < 500]); out.push([t + (r.tris / 1e6).toFixed(2) + ' M triangles per frame on average (target < 0.50 M; max ' + (r.trisMax / 1e6).toFixed(2) + ' M)', r.tris < 0.5e6]);
      const c = r.combat || {}; out.push([t + 'the fight was real: ' + c.quick + ' quick and ' + c.charged + ' charged shots, ' + c.kills + ' kills, ' + c.placeOk + ' devices placed, ' + c.avgAlive + ' Gloom alive on average (' + c.avgInside + ' inside)' + (COMBAT[r.spot].boss ? ', boss acting ' + c.boss : ''), c.kills > 0 && c.charged > 0 && c.avgAlive >= COMBAT[r.spot].n * 0.6 && (!COMBAT[r.spot].boss || c.boss)]); } }
  // owner Nov 19 06:43: the night house and the boss night are the most intense play, so on the default tier their real frame rate (GPU=1) must be at least the hub's
  { const f = (sp) => (rows.find((r) => r.tier === TT && r.spot === sp) || {}).fps; const hub = f('hub');
    if (hub) for (const sp of ['house', 'boss']) if (f(sp)) out.push([TT + ' ' + sp + ': ' + f(sp) + ' fps, hub ' + hub + ' fps (the night must not be slower than the hub)', f(sp) >= hub]); }
  console.log('PERFJSON ' + JSON.stringify(rows));
  let bad = 0; for (const [n, ok] of out) { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + n); }
  console.log(bad ? 'PERF CHECK FAILED (' + bad + ')' : 'ALL PERF CHECKS PASS');
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e && e.stack || e).slice(0, 800)); process.exit(1); });
