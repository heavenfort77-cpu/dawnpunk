// Lag check (lag report Nov 18, fix batch Nov 19): draw calls and triangles per frame at four fixed spots, and the bytes the page downloads.
// Usage: node tools/perfcheck.cjs [high|low|both] [out_dir]     (out_dir given: a 1280x720 picture of each spot is written there as <tier>_<spot>.png)
// Spots (set up with the test hooks on window.__game, as tools/itchshot.cjs does): hub = day 1 in the base just after "click to begin" (fresh save, the start spot);
// street = the old street by day at the run's start; house = night inside a house with a Gloom crossing the yard toward the opening you face; boss = THE BECKONER's night, seen from the house.
// Counting is done on the WebGL calls themselves (every drawArrays / drawElements and their instanced forms, all passes: sun shadow map, contact shading, screen, hands),
// so it equals renderer.info.render.calls / .triangles summed over every renderer.render() of a frame, averaged over FRAMES frames (default 6) with game time held still.
// "screen" = the draws into the visible picture only (framebuffer null). Bytes = everything the local server sent (index.html and the files beside it), as itch serves the zip.
// Frame time is printed for reference only (software GPU on the runner: not a real frame rate).
// REAL FRAME RATES (coordinator Nov 19): GPU=1 runs Chromium on the real GPU of a GitHub macOS runner (.github/workflows/perfgpu.yml; tools/gpu_task.sh starts it):
// at each spot, after the counting, SETTLE seconds of frames are drawn (first-use hitches: shader builds, uploads; their worst frame is printed as 'first'), then
// SECS seconds are timed: fps, average, 95th percentile and worst frame (ms) of steady play, with game time held still so the picture is the same throughout.
// PASS / FAIL lines: the targets below, set from the measured numbers after the lag fixes (Nov 19); the low tier (phone) is printed but has no targets (phones are frozen).
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ARG = process.argv[2] || 'high', OUT = process.argv[3] || '', SEED = +(process.env.SEED || 777), FRAMES = +(process.env.FRAMES || 6), DIST = path.join(__dirname, '..', 'dist');
const GPU = !!process.env.GPU, SECS = +(process.env.SECS || (GPU ? 8 : 0)), SETTLE = +(process.env.SETTLE || 6);
const ONLY = process.env.SPOTS ? process.env.SPOTS.split(',') : ['hub', 'street', 'house', 'boss'];
// targets on the high tier: draw calls per frame (all passes), triangles per frame (all passes), MB downloaded before the hub is ready
const TARGET = { hub: { calls: 500, tris: 1.0e6 }, street: { calls: 500, tris: 1.0e6 }, house: { calls: 500, tris: 1.0e6 }, boss: { calls: 500, tris: 1.0e6 }, startMB: 20 };
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
  const groups = new Map(); let tv = 0, dv = 0, ts = 0, ds = 0, tAll = 0, dAll = 0, nLights = 0;
  const walk = (o, path, vis) => { if (!o.visible) return; if (o.isLight) nLights++; const nm = o.name || (o.userData && (o.userData.hiInst || o.userData.kind || o.userData.part)) || ''; const p2 = nm ? (path ? path + '/' : '') + String(nm).slice(0, 18) : path;
    if ((o.isMesh || o.isPoints || o.isLine) && o.geometry) { const ge = o.geometry, n = ge.index ? ge.index.count : (ge.attributes.position ? ge.attributes.position.count : 0), dr = Math.min(n, ge.drawRange.count === Infinity ? n : ge.drawRange.count), mats = Array.isArray(o.material) ? o.material.length : 1;
      const t = Math.floor(dr / 3) * (o.isInstancedMesh ? o.count : 1) * (o.isMesh ? 1 : 0), iv = inView(o); tAll += t; dAll += mats; if (o.castShadow) { ts += t; ds += mats; }
      if (iv) { tv += t; dv += mats; const ud = Object.keys(o.userData || {}).filter((k) => k !== 'keep').slice(0, 3).join(','), sz = t > 20000 ? '>20k' : t > 2000 ? '>2k' : t > 200 ? '>200' : '<200'; const key = p2.split('/').slice(-3).join('/') + ' | ' + o.type + ' ' + (ge.type || '').replace('Geometry', 'G') + ' ' + (Array.isArray(o.material) ? 'multi' : o.material.type) + (o.castShadow ? ' cs' : '') + (o.frustumCulled ? '' : ' NOCULL') + ' ud[' + ud + '] ' + sz + ' top:' + topOf(o); const q = groups.get(key) || { t: 0, d: 0, n: 0 }; q.t += t; q.d += mats; q.n++; groups.set(key, q); } }
    for (const c of o.children) walk(c, p2, vis); };
  walk(sc, '', true);
  const top = (f, n) => [...groups.entries()].sort((a, b) => f(b[1]) - f(a[1])).slice(0, n).map(([k, q]) => '  ' + (q.t / 1000).toFixed(1) + 'k tris ' + q.d + ' draws ' + q.n + ' obj  ' + k).join('\n');
  return 'BREAK ' + spot + ': in view ' + dv + ' draws ' + (tv / 1e6).toFixed(2) + ' M tris; whole scene ' + dAll + ' draws ' + (tAll / 1e6).toFixed(2) + ' M tris; shadow casters ' + ds + ' draws ' + (ts / 1e6).toFixed(2) + ' M tris; lights ' + nLights + '\n BY TRIANGLES\n' + top((q) => q.t, 35) + '\n BY DRAWS\n' + top((q) => q.d, 35);
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
    await p.goto(URL0 + '?quality=' + tier + '&seed=' + SEED, { timeout: 900000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 900000 }); info(tier + ': page up ' + el() + ', ' + MB(sumB()) + ' MB so far');
    const frames = (n) => p.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const waitGame = (secs, cap) => p.evaluate(([secs, cap]) => new Promise((res) => { window.__dtMax = cap; let acc = 0, last = performance.now(), n = 0; const f = (now) => { acc += Math.min(cap, (now - last) / 1000); last = now; if (acc >= secs || ++n > 400) res(n); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), [secs, cap || 0.3]);
    async function waitLoads(what) { for (let k = 0; k < 400; k++) { const s = await p.evaluate(() => { const q = window.__game.quality().hi, G = window.__gloomGlb || {}, B = window.__boss || {}; return { hi: q.ok + q.failed >= q.asked, marla: window.__game.marla.ready, glb: Object.values(G).every((v) => v !== 'loading'), boss: B.model !== 'loading' }; }); if (s.hi && s.marla && s.glb && s.boss) { info(what + ' loaded ' + el() + ' ' + MB(sumB()) + ' MB so far'); return; } await p.waitForTimeout(1000); } info(what + ': loads not all done'); }
    // the measurement: game time held (as the picture tools do), 2 frames to settle, then FRAMES frames counted
    async function measure(spot) {
      await p.evaluate(() => { window.__fakeLock = true; window.__dtMax = 0.0005; }); await frames(2);
      const c0 = await p.evaluate(() => ({ ...window.__pc, t: performance.now() })); await frames(FRAMES); const c1 = await p.evaluate(() => ({ ...window.__pc, t: performance.now() }));
      const r = { tier, spot, calls: Math.round((c1.calls - c0.calls) / FRAMES), tris: Math.round((c1.tris - c0.tris) / FRAMES), sCalls: Math.round((c1.sCalls - c0.sCalls) / FRAMES), sTris: Math.round((c1.sTris - c0.sTris) / FRAMES), ms: Math.round((c1.t - c0.t) / FRAMES), mb: MB(sumB()) };
      r.cam = await p.evaluate(() => { const c = window.__game.cam; return [c.position.x, c.position.y, c.position.z].map((v) => v.toFixed(1)).join(',') + ' yaw ' + window.__game.yaw.toFixed(2); });
      if (process.env.BREAK) console.log(await p.evaluate(BREAKDOWN, spot));
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
      if (tier === 'high') out.push(['high: downloaded before the hub is ready ' + startMB + ' MB (target < ' + TARGET.startMB + ')', startMB < TARGET.startMB]);
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
    const lo = served.filter((s) => /models\//.test(s.f)).map((s) => s.f.replace('models/', '') + ' @' + Math.round((s.t - T0) / 1000) + 's').join(', ');
    info(tier + ' total downloaded ' + MB(sumB()) + ' MB in ' + served.length + ' requests; models fetched: ' + (lo || 'none'));
    console.log(errs.length ? 'INFO page errors (' + tier + '): ' + [...new Set(errs)].slice(0, 4).join(' | ') : 'INFO no page errors (' + tier + ')');
    if (tier === 'high') out.push(['high: no page errors' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 2).join(' | ') : ''), errs.length === 0]);
    await ctx.close();
  }
  for (const r of rows) { if (r.tier !== 'high' || !TARGET[r.spot]) continue; const T = TARGET[r.spot];
    out.push(['high ' + r.spot + ': ' + r.calls + ' draw calls per frame (target < ' + T.calls + ')', r.calls < T.calls]);
    out.push(['high ' + r.spot + ': ' + (r.tris / 1e6).toFixed(2) + ' M triangles per frame (target < ' + (T.tris / 1e6).toFixed(2) + ' M)', r.tris < T.tris]); }
  console.log('PERFJSON ' + JSON.stringify(rows));
  let bad = 0; for (const [n, ok] of out) { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + n); }
  console.log(bad ? 'PERF CHECK FAILED (' + bad + ')' : 'ALL PERF CHECKS PASS');
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e && e.stack || e).slice(0, 800)); process.exit(1); });
