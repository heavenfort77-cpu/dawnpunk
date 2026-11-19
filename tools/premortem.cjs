// Premortem: the ways a long play session or an odd device could break Dawnpunk that the other checks do not try.
// Usage: node tools/premortem.cjs [distDir]      (default: dist next to tools/).
// Environment: TESTS=a,b runs only those tests, TIER is the page's tier (default low), SEED (default 777), TEST_CAP is seconds per test (default 1200).
// Prints one 'PASS <name>' or 'FAIL <name>: <reason>' per test ('SKIP <name>: <why>' counts as neither), INFO lines along the way,
// then 'PREMORTEM <n> PASS, <m> FAIL'; exit 1 on any FAIL.
// Patterns from tools/guidecheck.cjs and tools/perfcheck.cjs: playwright chromium on the software renderer (swiftshader), the page served over http from a local
// server (the CI checks may open dist from a folder; this script always serves it), ?quality=low, the window.__game test hooks of src/main.js.
// Every wait is on a game condition with a cap (state, hooks, frame counters), never a fixed long sleep.
// Tests:
//   base_reuse      3 base visits plus a new run after the run end in one page: people (bview.group) pose and place match visit 1; gpu() flat after visit 2
//   context_loss    WEBGL_lose_context lose + restore at the title, right after enterBase() starts, in the base and at night: frames go on, canvas not blank
//   tier_change     medium -> low -> medium the way the game switches (saved choice + reload with ?quality=), in the base and at night; gpu() flat
//   zip_serve       the newest dist/*.zip unzipped and served: title -> base -> night; again with one models/*.glb request aborted
//   old_save        a save of the shape written by commit a4bc250 (src/base.js writeSave, key solardg.save, v 4) loads and the base opens
//   soak            6 nights and 4 base visits in one page: JS heap and gpu() flat within 10% after the 2nd cycle
//   resize          1280x720 -> 800x1200 -> 1920x1080 in the base, at night and at the end screen: the drawing buffer follows
//   audio_resume    a hidden tab and back: music or the AudioContext runs again; doFire() within 100 ms of nightfall()
//   wallclock_audit static: long waitForTimeout / setTimeout outside polling loops in tools/*check*.cjs (INFO lines, always PASS)
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');
const { execFileSync } = require('child_process');
const DIST = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist')), TOOLS = __dirname;
const SEED = +(process.env.SEED || 777), TIER = process.env.TIER || 'low', CAP = +(process.env.TEST_CAP || 1200);
const ONLY = process.env.TESTS ? process.env.TESTS.split(',').map((s) => s.trim()) : null;
// tolerances: people place (m), facing (rad), mean bone turn (rad); gpu() growth allowed between like visits; soak growth (heap and gpu, owner's 10%)
const TOL = { pos: 0.5, yaw: 0.5, pose: 0.5, flat: 0.05, soak: 0.10 };
// the software-GL flags of guidecheck/perfcheck, plus gc() and exact heap numbers for the soak, and sound allowed without a click for audio_resume
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const msg = (e) => String((e && e.message) || e).split('\n')[0].slice(0, 240);

// a local http server over a folder (as perfcheck); close() also drops kept-alive connections
function serve(root) {
  root = path.resolve(root);
  return new Promise((ok) => {
    const srv = http.createServer((q, r) => {
      let f; try { f = path.join(root, decodeURIComponent(q.url.split('?')[0])); } catch (e) { r.writeHead(400); r.end(); return; }
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      const n = fs.statSync(f).size; r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': n }); fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + srv.address().port + '/index.html', close: () => new Promise((c) => { if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(() => c()); }) }));
  });
}

// installed before the page's own scripts on every load of a test's page
const INIT = ({ seed, oldSave }) => {
  // the seeded Math.random of perfcheck, so runs repeat
  let s = seed; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__fakeLock = true;
  // storage is cleared on the first load of the page only (sessionStorage remembers it), so a reload (tier_change) keeps the saved choice and the save
  // (storage blocked: the catch leaves it and the game runs on its defaults)
  try {
    if (!sessionStorage.getItem('pm.first')) {
      sessionStorage.setItem('pm.first', '1'); localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}');
      if (oldSave) for (const k of Object.keys(oldSave)) localStorage.setItem(k, oldSave[k]);
    }
  } catch (e) { }
  window.__pmFrames = 0; window.__pmDraws = 0; window.__pmLost = 0; window.__pmRestored = 0; window.__pmAC = [];
  // the page's animation frames are counted; this script's own waits use __pmRaf (not counted)
  const raf0 = window.requestAnimationFrame.bind(window); window.__pmRaf = raf0;
  window.requestAnimationFrame = function (cb) { return raf0(function (t) { window.__pmFrames++; return cb(t); }); };
  // every WebGL draw call is counted (rendering really goes on after a context restore)
  for (const P of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!P) continue; const pr = P.prototype;
    for (const nm of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) { const o = pr[nm]; if (!o) continue; pr[nm] = function () { window.__pmDraws++; return o.apply(this, arguments); }; }
  }
  // every AudioContext the game makes is kept, so its state can be read (main.js keeps its own private); if that fails, audio is left as it is
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { const W = class extends AC { constructor(...a) { super(...a); window.__pmAC.push(this); } }; window.AudioContext = W; if (window.webkitAudioContext) window.webkitAudioContext = W; }
  } catch (e) { }
  addEventListener('webglcontextlost', () => { window.__pmLost++; }, true); addEventListener('webglcontextrestored', () => { window.__pmRestored++; }, true);
  window.__pmGL = () => { const c = document.getElementById('c'); if (!c) return null; try { return c.getContext('webgl2') || c.getContext('webgl'); } catch (e) { return null; } };
  window.__pmLose = () => { const gl = window.__pmGL(), ext = gl && gl.getExtension('WEBGL_lose_context'); if (!ext) return false; window.__pmExt = ext; ext.loseContext(); return true; };
  window.__pmRestore = () => { if (!window.__pmExt) return false; window.__pmExt.restoreContext(); return true; };
  // a hidden tab and back, as the browser reports it (document.hidden, visibilityState, the visibilitychange event)
  window.__pmHide = (h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); };
  // the picture: the WebGL canvas copied into a small 2D canvas in the frame just after the game's own (rAF callbacks run in the order they were asked)
  window.__pmStat = () => new Promise((res) => raf0(() => {
    try {
      const c = document.getElementById('c'), o = document.createElement('canvas'); o.width = 64; o.height = 36; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 64, 36);
      const d = x.getImageData(0, 0, 64, 36).data, set = new Set(); let n = 0, s1 = 0, s2 = 0, a = 0;
      for (let i = 0; i < d.length; i += 4) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; s1 += l; s2 += l * l; n++; if (d[i + 3] > 0) a++; set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)); }
      const m = s1 / n; res({ mean: +m.toFixed(1), std: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(2), colors: set.size, opaque: +(a / n).toFixed(2), w: c.width, h: c.height });
    } catch (e) { res({ err: String(e).slice(0, 160) }); }
  }));
};
const isBlank = (st) => !!st.err || st.opaque < 0.05 || (st.std < 1.5 && st.colors <= 2);

// ---- page helpers ----
const waitFor = async (p, fn, arg, capS, poll) => {
  try { await p.waitForFunction(fn, arg === undefined ? null : arg, { timeout: capS * 1000, polling: poll || 250 }); return true; } catch (e) { if (/closed|crash/i.test(String(e))) throw e; return false; }
};
const stateOf = (p) => p.evaluate(() => { const g = window.__game; return g ? g.state + (g.sim ? '/' + g.sim.phase : '') : 'no game'; }).catch(() => '?');
const frames = async (p, n, capS) => { const f0 = await p.evaluate(() => window.__pmFrames); return waitFor(p, ([f0, n]) => window.__pmFrames >= f0 + n, [f0, n], capS || 60); };
// loads done: no loading card, the base's background build, Marla's model (base), hi textures, Gloom and boss models (as perfcheck waitLoads)
const SETTLED = () => {
  try {
    const g = window.__game; if (!g) return false; if (g.cardOn && g.cardOn()) return false;
    if (g.state === 'base' && g.bview && g.bview.bgBusy) return false; if (g.state === 'base' && g.marla && g.marla.ready === false) return false;
    const q = g.quality().hi; if (q && q.ok + q.failed < q.asked) return false;
    const G = window.__gloomGlb || {}; for (const k in G) if (G[k] === 'loading') return false; const B = window.__boss || {}; if (B.model === 'loading') return false;
    return true;
  } catch (e) { return false; }
};
async function settle(p, capS) { const ok = await waitFor(p, SETTLED, undefined, capS || 120, 500); if (!ok) console.log('INFO settle: loads not done after ' + (capS || 120) + ' s (state ' + await stateOf(p) + ')'); await frames(p, 3, 60); return ok; }
const gpu = (p) => p.evaluate(() => { const m = window.__game.gpu(); return { geometries: m.geometries, textures: m.textures }; });
const heap = (p) => p.evaluate(() => { if (window.gc) { window.gc(); window.gc(); } return performance.memory ? performance.memory.usedJSHeapSize : -1; });
const grew = (a, b, pct, slack) => b > a * (1 + pct) + (slack || 0);
const MB = (b) => (b / 1048576).toFixed(1) + ' MB';

// to the base: 'hook' = window.__game.enterBase() (a new save), 'again' = the end screen's button (keeps the save), 'enter' = the title's Enter (reads the stored save)
async function toBase(p, how) {
  if (how === 'hook') await p.evaluate(() => window.__game.enterBase());
  else if (how === 'again') await p.evaluate(() => document.getElementById('again').click());
  else { try { await p.click('#enter', { timeout: 20000 }); } catch (e) { await p.evaluate(() => document.getElementById('enter').click()); } }
  if (how === 'enter' && await waitFor(p, () => window.__game.state === 'intro', undefined, 3)) { console.log('INFO the opening film started from Enter; going to the base by the hook'); await p.evaluate(() => window.__game.reBase()); }
  if (!await waitFor(p, () => { const g = window.__game; return !!g && g.state === 'base'; }, undefined, 120)) throw new Error('base not reached via ' + how + ' (state ' + await stateOf(p) + ')');
  await settle(p);
}
// a run (ring 0, as perfcheck and crashrepro), then night by the hooks: nightfall() goes into the nearest house and ends the day, so endDay() after it does nothing more
async function toRun(p) {
  await p.evaluate(() => { const s = document.getElementById('selRing'); if (s) s.value = '0'; window.__game.startRun(); });
  if (!await waitFor(p, () => { const g = window.__game; return !!g && !!g.run && g.state === 'play'; }, undefined, 120)) throw new Error('run did not start (state ' + await stateOf(p) + ')');
  await settle(p);
}
async function toNight(p) {
  await toRun(p);
  await p.evaluate(() => { window.__game.nightfall(); window.__game.endDay(); });
  if (!await waitFor(p, () => { const g = window.__game, s = g && g.sim; return !!s && s.phase === 'night'; }, undefined, 120)) throw new Error('night did not start (state ' + await stateOf(p) + ')');
  await settle(p);
}
// the night ends as a loss (hp 0: src/sim.js finish(false) on the next step), the way other tools reach the end screen; abandon() if that does not come
async function endNight(p) {
  await p.evaluate(() => { const s = window.__game.sim; if (s) s.player.hp = 0; });
  let ok = await waitFor(p, () => { const g = window.__game; return !!g && g.state === 'end'; }, undefined, 60);
  if (!ok) { await p.evaluate(() => { const s = window.__game.sim; if (s && s.abandon) s.abandon(); }); ok = await waitFor(p, () => window.__game.state === 'end', undefined, 60); }
  if (!ok) throw new Error('night did not end (state ' + await stateOf(p) + ')');
  await frames(p, 2, 30);
}
// people in the base: every object carrying a name label (sprite userData.kind 'npc': recruits, villagers, Marla) in bview.group, in build order;
// place and facing from the first skinned mesh inside (the model, which turns) or the group itself (stand-in), and that model's bone rotations
const PEOPLE = () => {
  const g = window.__game, root = g.bview && g.bview.group; if (!root) return null; root.updateMatrixWorld(true);
  const seen = []; root.traverse((o) => { if (o.isSprite && o.userData && o.userData.kind === 'npc' && o.parent && !seen.includes(o.parent)) seen.push(o.parent); });
  return seen.map((n) => {
    let sk = null; n.traverse((o) => { if (!sk && o.isSkinnedMesh && o.skeleton) sk = o; });
    const e = (sk || n).matrixWorld.elements;
    return { x: e[12], y: e[13], z: e[14], yaw: Math.atan2(e[8], e[10]), vis: n.visible, bones: sk ? sk.skeleton.bones.map((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]) : null };
  });
};
async function peopleReady(p) {
  // the models swap in for the stand-ins when loaded: polled each second until the count of skinned meshes holds for 3 polls (cap 40 s)
  let last = -1, same = 0;
  for (let i = 0; i < 40 && same < 3; i++) { const n = await p.evaluate(() => { const r = window.__game.bview && window.__game.bview.group; let k = 0; if (r) r.traverse((o) => { if (o.isSkinnedMesh) k++; }); return k; }); same = n === last ? same + 1 : 0; last = n; await p.waitForTimeout(1000); }
  return last;
}
function comparePeople(a, b) {
  if (!a || !b) return { err: 'no people found in bview.group' };
  if (a.length !== b.length) return { err: 'people count ' + b.length + ' vs ' + a.length + ' on visit 1' };
  let wp = 0, wy = 0, wq = 0, model = 0;
  for (let i = 0; i < a.length; i++) {
    const A = a[i], B = b[i]; wp = Math.max(wp, Math.hypot(A.x - B.x, A.z - B.z));
    let dy = Math.abs(A.yaw - B.yaw) % (2 * Math.PI); if (dy > Math.PI) dy = 2 * Math.PI - dy; wy = Math.max(wy, dy);
    if (!!A.bones !== !!B.bones || (A.bones && A.bones.length !== B.bones.length)) { model++; continue; }
    if (A.bones && A.bones.length) { let s = 0; for (let j = 0; j < A.bones.length; j++) { const q = A.bones[j], r = B.bones[j], d = Math.min(1, Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3])); s += 2 * Math.acos(d); } wq = Math.max(wq, s / A.bones.length); }
  }
  return { wp, wy, wq, model };
}

// ---- the tests ----
async function open(t, o) {
  o = o || {};
  const ctx = await t.b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); t.ctxs.push(ctx);
  await ctx.addInitScript(INIT, { seed: SEED, oldSave: o.oldSave || null });
  const p = await ctx.newPage(); p.setDefaultTimeout(120000);
  p.on('pageerror', (e) => { const s = String(e).slice(0, 240); t.errs.push(s); t.perrs.push(s); });
  p.on('console', (m) => { if (m.type() === 'error') t.errs.push('console: ' + m.text().slice(0, 240)); });
  p.on('crash', () => { t.errs.push('page crashed'); t.perrs.push('page crashed'); });
  if (o.before) await o.before(p);
  await p.goto((o.url || t.url) + '?quality=' + (o.tier || TIER) + '&seed=' + SEED, { timeout: 300000 });
  if (!await waitFor(p, () => !!(window.__game && window.__game.enterBase), undefined, 300)) throw new Error('game did not start (no window.__game)');
  await frames(p, 2, 60);
  return p;
}
const errsSince = (t, k, label, list) => { const e = (list || t.errs).slice(k); if (e.length) t.fail(label + ': ' + e.length + ' error(s), first: ' + e[0]); };

async function base_reuse(t) {
  const p = await open(t), visits = [];
  const visit = async (how, label) => {
    const k = t.errs.length;
    // game time held nearly still in the base (as perfcheck's measuring), so people stand where a visit puts them
    await p.evaluate(() => { window.__dtMax = 0.0005; });
    await toBase(p, how); await peopleReady(p);
    const people = await p.evaluate(PEOPLE), g = await gpu(p);
    await p.evaluate(() => { delete window.__dtMax; });
    errsSince(t, k, label); visits.push({ people, g }); t.info(label + ': ' + (people ? people.length : 0) + ' people, gpu ' + JSON.stringify(g));
  };
  await visit('hook', 'visit 1');
  // each later visit gets visit 1's save back (put back after the night is banked, before going home), so the same people are compared
  const snap = await p.evaluate(() => JSON.stringify(window.__game.save));
  for (const n of [2, 3]) {
    const k = t.errs.length; await toNight(p); await endNight(p); errsSince(t, k, 'night before visit ' + n);
    await p.evaluate((s) => { const sv = window.__game.save, o = JSON.parse(s); for (const q of Object.keys(sv)) delete sv[q]; Object.assign(sv, o); }, snap);
    await visit('again', 'visit ' + n);
  }
  { const k = t.errs.length; await toRun(p); errsSince(t, k, 'new run after visit 3'); }
  for (const n of [1, 2]) {
    const c = comparePeople(visits[0].people, visits[n].people), lb = 'visit ' + (n + 1) + ' vs 1';
    if (c.err) { t.fail(lb + ': ' + c.err); continue; }
    t.info(lb + ': worst place ' + c.wp.toFixed(2) + ' m, facing ' + c.wy.toFixed(2) + ' rad, mean bone turn ' + c.wq.toFixed(2) + ' rad, model/stand-in mismatches ' + c.model);
    if (c.wp > TOL.pos) t.fail(lb + ': a person stands ' + c.wp.toFixed(2) + ' m from visit 1 (tolerance ' + TOL.pos + ')');
    if (c.wy > TOL.yaw) t.fail(lb + ': a person faces ' + c.wy.toFixed(2) + ' rad off visit 1 (tolerance ' + TOL.yaw + ')');
    if (c.wq > TOL.pose) t.fail(lb + ': a pose differs by ' + c.wq.toFixed(2) + ' rad mean bone turn (tolerance ' + TOL.pose + ')');
    if (c.model) t.fail(lb + ': ' + c.model + ' person(s) shown as model in one visit and stand-in in the other');
  }
  const a = visits[1].g, b = visits[2].g;
  for (const k of ['geometries', 'textures']) if (grew(a[k], b[k], TOL.flat, 2)) t.fail('gpu ' + k + ' grew after visit 2: ' + a[k] + ' -> ' + b[k]);
}

async function context_loss(t) {
  const p = await open(t);
  const MENU_COVERS = () => { const m = document.getElementById('menu'); if (!m) return false; const cs = getComputedStyle(m), r = m.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.95 && r.width >= innerWidth - 1 && r.height >= innerHeight - 1 && (/^rgb\(/.test(cs.backgroundColor) || /,\s*1\)$/.test(cs.backgroundColor) || cs.backgroundImage !== 'none'); };
  const cycle = async (label, o) => {
    const k = t.errs.length, c0 = await p.evaluate(() => [window.__pmLost, window.__pmRestored]);
    const ok = await p.evaluate(o.start ? () => { window.__game.enterBase(); return window.__pmLose(); } : () => window.__pmLose());
    if (!ok) { t.fail(label + ': WEBGL_lose_context not available'); return; }
    if (!await waitFor(p, (n) => window.__pmLost > n, c0[0], 30)) { t.fail(label + ': no webglcontextlost event'); return; }
    // a few of the game's frames run while the context is gone
    await frames(p, 3, 30);
    await p.evaluate(() => window.__pmRestore());
    if (!await waitFor(p, (n) => window.__pmRestored > n, c0[1], 30)) { t.fail(label + ': no webglcontextrestored event'); return; }
    if (o.start) { if (!await waitFor(p, () => window.__game.state === 'base', undefined, 120)) t.fail(label + ': base not reached (state ' + await stateOf(p) + ')'); await settle(p); }
    const f0 = await p.evaluate(() => [window.__pmFrames, window.__pmDraws]);
    if (!await waitFor(p, (f) => window.__pmFrames >= f + 5, f0[0], 60)) t.fail(label + ': animation frames stopped after the restore');
    const d1 = await p.evaluate(() => window.__pmDraws);
    if (!o.title && d1 <= f0[1]) t.fail(label + ': no draw calls after the restore');
    const st = await p.evaluate(() => window.__pmStat()), cover = o.title ? await p.evaluate(MENU_COVERS) : false;
    if (isBlank(st)) { if (cover) t.info(label + ': canvas blank under the title menu, which is opaque and covers it (the game holds drawing at the title) ' + JSON.stringify(st)); else t.fail(label + ': canvas blank after the restore ' + JSON.stringify(st)); }
    else t.info(label + ': picture after restore ' + JSON.stringify(st));
    errsSince(t, k, label);
  };
  await cycle('title', { title: true });
  await cycle('enterBase start', { start: true });
  await cycle('base', {});
  await toNight(p);
  await cycle('night', {});
}

async function tier_change(t) {
  const p = await open(t, { tier: 'medium' }), res = [];
  const tiers = ['medium', 'low', 'medium'];
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i], k = t.errs.length;
    if (i > 0) {
      // as gfxGo in src/main.js: saveQuality(tier) (localStorage dawnpunk.quality), then the address with ?quality=tier is loaded; film=0 here because gfxGo's film=1 is for players
      await p.evaluate((tier) => { try { localStorage.setItem('dawnpunk.quality', tier); } catch (e) { } const x = new URL(location.href); x.searchParams.set('quality', tier); x.searchParams.set('film', '0'); setTimeout(() => { location.href = x.href; }, 0); }, tier);
      await p.waitForURL((u) => u.searchParams.get('quality') === tier, { timeout: 120000 });
      if (!await waitFor(p, () => !!(window.__game && window.__game.enterBase), undefined, 300)) throw new Error('game did not start after the switch to ' + tier);
      await frames(p, 2, 60);
    }
    const got = await p.evaluate(() => window.__game.quality().tier); if (got !== tier) t.fail('step ' + (i + 1) + ': tier is ' + got + ', wanted ' + tier);
    await toBase(p, 'hook'); const gb = await gpu(p); errsSince(t, k, tier + ' (step ' + (i + 1) + ') base');
    const k2 = t.errs.length; await toNight(p); const gn = await gpu(p); errsSince(t, k2, tier + ' (step ' + (i + 1) + ') night');
    res.push({ gb, gn }); t.info('step ' + (i + 1) + ' ' + tier + ': base gpu ' + JSON.stringify(gb) + ', night gpu ' + JSON.stringify(gn));
  }
  for (const [w, lb] of [['gb', 'base'], ['gn', 'night']]) for (const k of ['geometries', 'textures']) if (grew(res[0][w][k], res[2][w][k], TOL.flat, 2)) t.fail(lb + ' gpu ' + k + ' grew from the first medium to the second: ' + res[0][w][k] + ' -> ' + res[2][w][k]);
}

async function zip_serve(t) {
  const zips = fs.readdirSync(DIST).filter((f) => /\.zip$/i.test(f)).map((f) => path.join(DIST, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!zips.length) return 'skip:no zip';
  const zip = zips[0], dir = fs.mkdtempSync(path.join(os.tmpdir(), 'premortem-zip-'));
  t.info('zip ' + path.basename(zip) + ' (newest of ' + zips.length + ')');
  try {
    try { execFileSync('unzip', ['-q', '-o', zip, '-d', dir], { stdio: 'pipe' }); } catch (e) { execFileSync('python3', ['-I', '-m', 'zipfile', '-e', zip, dir], { stdio: 'pipe' }); }
    let root = fs.existsSync(path.join(dir, 'index.html')) ? dir : null;
    if (!root) for (const d of fs.readdirSync(dir)) if (fs.existsSync(path.join(dir, d, 'index.html'))) { root = path.join(dir, d); break; }
    if (!root) { t.fail('no index.html in ' + path.basename(zip)); return; }
    const srv = await serve(root);
    try {
      const flow = async (p) => { await toBase(p, 'hook'); await toNight(p); return p.evaluate(() => window.__pmStat()); };
      {
        const k = t.errs.length, p = await open(t, { url: srv.url }), st = await flow(p);
        errsSince(t, k, 'served zip'); if (isBlank(st)) t.fail('served zip: canvas blank at night ' + JSON.stringify(st));
        await t.ctxs.pop().close();
      }
      {
        // one model file request aborted (the first models/*.glb asked for): no uncaught error and a picture at night; console 'failed to load' lines are expected
        let aborted = null; const k = t.perrs.length;
        const p = await open(t, { url: srv.url, before: (pg) => pg.route('**/models/*.glb', (r) => { if (!aborted) { aborted = r.request().url(); return r.abort(); } return r.continue(); }) });
        const st = await flow(p);
        t.info('aborted: ' + (aborted ? aborted.split('/').pop() : 'none (no models/*.glb asked for by night)'));
        errsSince(t, k, 'with ' + (aborted ? aborted.split('/').pop() : 'a model') + ' aborted', t.perrs);
        if (isBlank(st)) t.fail('with a model aborted: canvas blank at night ' + JSON.stringify(st));
      }
    } finally { await srv.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// a save as commit a4bc250 wrote it (src/base.js newSave/writeSave there: key solardg.save, v 4, the fields of that version), two nights in
const OLD_SAVE = () => {
  const up = {}; for (const k of ['panel', 'turbine', 'energy', 'slots', 'dev_twin', 'dev_mist', 'dev_trellis', 'dev_flask', 'dev_press', 'dev_shard', 'dev_sling', 'dev_prism', 'dev_chime', 'dev_moon']) up[k] = 0; up.panel = 1;
  const save = {
    v: 4, seed: 424242, day: 3, food: 14, essentials: 6, coins: 2,
    personnel: [{ id: 1, name: 'Ines', role: 'hunter' }, { id: 2, name: 'Tomas', role: 'gatherer' }, { id: 3, name: 'Wen', role: 'researcher' }],
    cats: [{ id: 1, spot: 0, type: 'energy', state: 'hidden', slot: -1 }, { id: 2, spot: 2, type: 'energy', state: 'hidden', slot: -1 }, { id: 3, spot: 4, type: 'lure', state: 'hidden', slot: -1 }],
    revealed: { energy: true, lure: false }, noteSeen: true, up, loadout: ['turbine', 'lance', 'panel'], project: null, helped: 1, scoutSpot: 3,
    quests: [
      { id: 103, type: 'deliver', from: 'storage', to: 'garden', text: 'Carry a crate of seedlings from Storage to Garden', reward: { food: 4, essentials: 0 }, state: 'open' },
      { id: 104, type: 'hunt', target: 6, got: 2, text: 'Hunt down 6 Gloom on your next nights (2/6)', reward: { food: 5, essentials: 0 }, state: 'open' },
      { id: 105, type: 'collect', target: 4, got: 1, text: 'Bring home 4 essentials from collection runs (1/4)', reward: { food: 0, essentials: 3 }, state: 'open' },
    ],
    nextId: 106, nights: 2, essTotal: 9, killsTotal: 14, trips: 2, mjRead: 1,
    avians: { birds: [{ id: 1, kind: 'hen' }, { id: 2, kind: 'hen' }, { id: 3, kind: 'sunquill' }], chicks: [], coop: 0, held: 0, inc: [], seeds: 0, nextId: 4 },
  };
  return { 'solardg.save': JSON.stringify(save), 'solardg.music': 'on', 'solardg.hints': 'on', 'dawnpunk.drill': '{"skip":true}' };
};
async function old_save(t) {
  const p = await open(t, { oldSave: OLD_SAVE() });
  { const k = t.errs.length; await toBase(p, 'enter'); errsSince(t, k, 'Enter with the old save'); }
  const sv = await p.evaluate(() => { const s = window.__game.save; return s ? { day: s.day, nights: s.nights, seed: s.seed, people: (s.personnel || []).length } : null; });
  t.info('save after Enter: ' + JSON.stringify(sv));
  if (!sv || sv.day !== 3 || sv.nights !== 2 || sv.seed !== 424242) t.fail('the old save was not kept (a new save replaced it): ' + JSON.stringify(sv));
  { const k = t.errs.length; await p.evaluate(() => window.__game.reBase()); if (!await waitFor(p, () => window.__game.state === 'base', undefined, 60)) t.fail('reBase: base not reached'); await settle(p); errsSince(t, k, 'reBase with the old save'); }
  { const k = t.errs.length; await toBase(p, 'hook'); errsSince(t, k, 'enterBase()'); }
}

async function soak(t) {
  const p = await open(t), m = []; let visits = 1;
  { const k = t.errs.length; await toBase(p, 'hook'); errsSince(t, k, 'base visit 1'); }
  for (let c = 1; c <= 6; c++) {
    // nights 1-4 start from the base; 5 and 6 straight from the end screen (6 nights with 4 base visits in one page)
    const k = t.errs.length; await toNight(p); await frames(p, 10, 120); await endNight(p);
    const r = { heap: await heap(p), g: await gpu(p) }; m.push(r); t.info('cycle ' + c + ': heap ' + MB(r.heap) + ', gpu ' + JSON.stringify(r.g));
    if (visits < 4) { await toBase(p, 'again'); visits++; }
    errsSince(t, k, 'cycle ' + c);
  }
  const a = m[1], b = m[5];
  if (a.heap > 0 && grew(a.heap, b.heap, TOL.soak)) t.fail('JS heap grew from cycle 2 to 6: ' + MB(a.heap) + ' -> ' + MB(b.heap));
  if (a.heap < 0) t.info('performance.memory not available: heap not checked');
  for (const k of ['geometries', 'textures']) if (grew(a.g[k], b.g[k], TOL.soak)) t.fail('gpu ' + k + ' grew from cycle 2 to 6: ' + a.g[k] + ' -> ' + b.g[k]);
}

async function resize(t) {
  const p = await open(t), sizes = [[1280, 720], [800, 1200], [1920, 1080]];
  const check = async (label) => {
    const k = t.errs.length, pr = await p.evaluate(() => window.__game.quality().pixelRatio);
    for (const [w, h] of sizes) {
      await p.setViewportSize({ width: w, height: h });
      // src/main.js resize(): renderer.setSize(innerWidth, innerHeight, false) -> drawing buffer floor(size x pixel ratio), camera aspect w / h
      const ok = await waitFor(p, ([w, h, pr]) => { const c = document.getElementById('c'), g = window.__game; return !!c && Math.abs(c.width - Math.floor(w * pr)) <= 1 && Math.abs(c.height - Math.floor(h * pr)) <= 1 && Math.abs(g.cam.aspect - w / h) < 0.01; }, [w, h, pr], 30);
      if (!ok) { const got = await p.evaluate(() => { const c = document.getElementById('c'); return c.width + 'x' + c.height + ' aspect ' + window.__game.cam.aspect.toFixed(3); }); t.fail(label + ' ' + w + 'x' + h + ': drawing buffer ' + got + ' (pixel ratio ' + pr + ')'); }
      await frames(p, 2, 30);
    }
    errsSince(t, k, label); await p.setViewportSize({ width: 1280, height: 720 }); await frames(p, 1, 30);
  };
  await toBase(p, 'hook'); await check('base');
  await toNight(p); await check('night');
  await endNight(p); await check('end screen');
}

async function audio_resume(t) {
  const p = await open(t);
  const AUDIO = () => { let m = null; try { m = window.__game.music(); } catch (e) { m = null; } return { music: m ? (m.playing || []).join(',') || '-' : 'no hook', on: m ? m.on : null, ac: (window.__pmAC || []).map((a) => a.state).join(',') || 'none' }; };
  const ON = () => { let m = null; try { m = window.__game.music(); } catch (e) { m = null; } return !!(m && m.playing && m.playing.length) || (window.__pmAC || []).some((a) => a.state === 'running'); };
  { const k = t.errs.length; await toBase(p, 'enter'); errsSince(t, k, 'Enter'); }
  const before = await waitFor(p, ON, undefined, 30); t.info('before hiding: ' + JSON.stringify(await p.evaluate(AUDIO)) + (before ? '' : ' (no sound running yet)'));
  {
    const k = t.errs.length;
    await p.evaluate(() => window.__pmHide(true)); await frames(p, 3, 30); t.info('hidden: ' + JSON.stringify(await p.evaluate(AUDIO)));
    await p.evaluate(() => window.__pmHide(false));
    const back = await waitFor(p, ON, undefined, 30), st = await p.evaluate(AUDIO); t.info('visible again: ' + JSON.stringify(st));
    if (!back) t.fail('after the tab came back neither music (music().playing) nor an AudioContext runs: ' + JSON.stringify(st));
    await p.evaluate(() => { const g = window.__game; if (g.isPaused && g.isPaused()) g.setPause(false); }); await frames(p, 2, 30);
    errsSince(t, k, 'hidden and back');
  }
  {
    const k = t.errs.length; await toRun(p);
    // doFire() at once, 50 ms and 90 ms after nightfall(); a throw in the timed calls arrives as a page error
    const ms = await p.evaluate(() => new Promise((res) => { const g = window.__game, t0 = performance.now(); g.nightfall(); g.doFire(); setTimeout(() => g.doFire(), 50); setTimeout(() => { res(performance.now() - t0); g.doFire(); }, 90); }));
    t.info('last doFire ' + Math.round(ms) + ' ms after nightfall');
    await frames(p, 5, 60); errsSince(t, k, 'doFire right after nightfall');
  }
}

// static: long fixed waits in the checks. A waitForTimeout(n) or setTimeout(.., n) with n > 2000 ms, not inside a for / while / do loop, is listed (INFO).
function wallclock_audit(t) {
  const files = fs.readdirSync(TOOLS).filter((f) => /check/.test(f) && /\.cjs$/.test(f)).sort(); let hits = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(TOOLS, f), 'utf8');
    // loop depth at each position: '{' opened right after a for/while header or 'do' counts as a loop body; a loop without braces covers up to its ';'
    const inLoop = new Uint8Array(src.length + 1); const stack = []; let pending = false, single = false, i = 0;
    const loopsOpen = () => stack.includes(true) || single;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') { inLoop[i] = loopsOpen() ? 1 : 0; i++; } continue; }
      if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; for (; i < end; i++) inLoop[i] = loopsOpen() ? 1 : 0; continue; }
      if (ch === '\'' || ch === '"' || ch === '`') { const q = ch; inLoop[i] = loopsOpen() ? 1 : 0; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') { inLoop[i] = loopsOpen() ? 1 : 0; i++; } inLoop[i] = loopsOpen() ? 1 : 0; i++; } inLoop[i] = loopsOpen() ? 1 : 0; i++; continue; }
      const kw = /^(for|while)\s*\(/.exec(src.slice(i, i + 12));
      if (kw && !/[\w$.]/.test(src[i - 1] || '')) {
        let j = i + kw[0].length, d = 1; while (j < src.length && d > 0) { if (src[j] === '(') d++; else if (src[j] === ')') d--; j++; }
        for (let q = i; q < j; q++) inLoop[q] = loopsOpen() ? 1 : 0;
        i = j; pending = true; continue;
      }
      if (/^do\s*\{/.test(src.slice(i, i + 6)) && !/[\w$.]/.test(src[i - 1] || '')) { pending = true; inLoop[i] = loopsOpen() ? 1 : 0; i += 2; continue; }
      if (ch === '{') { stack.push(pending); pending = false; }
      else if (ch === '}') stack.pop();
      else if (pending && !/\s/.test(ch)) { pending = false; single = true; }
      else if (ch === ';' && single) single = false;
      inLoop[i] = loopsOpen() ? 1 : 0; i++;
    }
    const lineOf = (k) => src.slice(0, k).split('\n').length;
    const lastArg = (k) => { let d = 0, j = k, start = k; for (; j < src.length; j++) { const c = src[j]; if (c === '(' || c === '[' || c === '{') d++; else if (c === ')' || c === ']' || c === '}') { if (d === 0) break; d--; } else if (c === ',' && d === 0) start = j + 1; } return src.slice(start, j).trim(); };
    const re = /\b(waitForTimeout|setTimeout)\(/g; let mm;
    while ((mm = re.exec(src))) {
      const arg = lastArg(mm.index + mm[0].length);
      if (!/^[\d\s*+._]+$/.test(arg)) continue;
      let n; try { n = Function('return (' + arg.replace(/_/g, '') + ')')(); } catch (e) { continue; }
      if (!(n > 2000) || inLoop[mm.index]) continue;
      hits++; console.log('INFO wallclock ' + f + ':' + lineOf(mm.index) + ' ' + mm[1] + '(' + n + ') outside a polling loop');
    }
  }
  t.info(files.length + ' check files scanned, ' + hits + ' long fixed wait(s) outside polling loops');
}

const TESTS = [['base_reuse', base_reuse], ['context_loss', context_loss], ['tier_change', tier_change], ['zip_serve', zip_serve], ['old_save', old_save], ['soak', soak], ['resize', resize], ['audio_resume', audio_resume], ['wallclock_audit', wallclock_audit]];

async function runTest(b, url, name, fn) {
  const t = { name, b, url, errs: [], perrs: [], fails: [], ctxs: [], info: (m) => console.log('INFO ' + name + ': ' + m), fail: (m) => t.fails.push(m) };
  let r, timer;
  try {
    const run = Promise.resolve().then(() => fn(t)); run.catch(() => {});
    r = await Promise.race([run, new Promise((_, no) => { timer = setTimeout(() => no(new Error('test cap of ' + CAP + ' s reached')), CAP * 1000); })]);
  } catch (e) { t.fails.push('stopped: ' + msg(e)); } finally { clearTimeout(timer); for (const c of t.ctxs) await c.close().catch(() => {}); }
  if (typeof r === 'string' && r.startsWith('skip:')) { console.log('SKIP ' + name + ': ' + r.slice(5)); return 'skip'; }
  if (name === 'wallclock_audit') { if (t.fails.length) t.info('audit stopped early: ' + t.fails.join('; ')); console.log('PASS ' + name); return 'pass'; }
  if (t.fails.length) { console.log('FAIL ' + name + ': ' + t.fails.join('; ').slice(0, 1200)); return 'fail'; }
  console.log('PASS ' + name); return 'pass';
}

(async () => {
  process.on('unhandledRejection', (e) => console.log('INFO unhandled: ' + msg(e)));
  const want = TESTS.filter(([n]) => !ONLY || ONLY.includes(n)), needB = want.some(([n]) => n !== 'wallclock_audit');
  if (needB && !fs.existsSync(path.join(DIST, 'index.html'))) { console.log('FAIL setup: no index.html in ' + DIST); console.log('PREMORTEM 0 PASS, 1 FAIL'); process.exit(1); }
  let b = null, srv = null; if (needB) { srv = await serve(DIST); b = await chromium.launch({ args: ARGS }); }
  let pass = 0, fail = 0;
  for (const [n, f] of want) {
    if (needB && n !== 'wallclock_audit' && !b.isConnected()) { console.log('INFO browser gone: launching again'); b = await chromium.launch({ args: ARGS }); }
    const r = await runTest(b, srv && srv.url, n, f); if (r === 'pass') pass++; else if (r === 'fail') fail++;
  }
  if (b) await b.close().catch(() => {}); if (srv) await srv.close();
  console.log('PREMORTEM ' + pass + ' PASS, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL premortem: ' + msg(e)); console.log('PREMORTEM 0 PASS, 1 FAIL'); process.exit(1); });
