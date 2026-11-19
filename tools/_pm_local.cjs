// Premortem: the ways a long play session or an odd device could break Dawnpunk that the other checks do not try.
// Usage: node tools/premortem.cjs [distDir]      (default: dist next to tools/).
// Environment: TESTS=a,b runs only those tests, TIER is the page's tier (default low), SEED (default 777), TOTAL_CAP is the seconds all tests may take together (default 1200:
// the CI job stops at 25 minutes). Each test has its own cap (CAPS below), cut to what is left of TOTAL_CAP; each test's elapsed seconds and cap are printed (TIME line).
// Prints one 'PASS <name>' or 'FAIL <name>: <reason>' per test ('SKIP <name>: <why>' counts as neither), INFO lines along the way,
// then 'PREMORTEM <n> PASS, <m> FAIL, <k> CAPHIT'; exit 1 on any FAIL, else 2 on any CAPHIT, else 0.
// CAPHIT <name> is a TEST issue, not a game FAIL: the test ran out of its own cap (or the total cap) before it finished. Each test prints
// 'TIME <name>: <elapsed> s of cap <cap> s', so the next round can set the caps from measured times.
// Patterns from tools/guidecheck.cjs and tools/perfcheck.cjs: playwright chromium on the software renderer (swiftshader), the page served over http from a local
// server (the CI checks may open dist from a folder; this script always serves it), ?quality=low, the window.__game test hooks of src/main.js.
// Every wait is on a game condition with a cap (state, hooks, frame counters), never a fixed long sleep.
// Tests:
//   base_reuse      3 base visits plus a new run after the run end in one page: people (basePeople(), by id) place and pose checksum match visit 1; gpu() flat after visit 2
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
const SEED = +(process.env.SEED || 777), TIER = process.env.TIER || 'low', TOTAL_CAP = +(process.env.TOTAL_CAP || 1200);
const ONLY = process.env.TESTS ? process.env.TESTS.split(',').map((s) => s.trim()) : null;
// gpu() growth allowed between like visits; soak growth (heap and gpu, owner's 10%). The base_reuse people tolerances are not set here: they are measured
// in the run (3x the larger of the noise floor and NOISE_MIN, see base_reuse)
const TOL = { flat: 0.05, soak: 0.10 }, NOISE_MIN = 0.001;
// seconds per test on a software GPU; the 9 together (1105 s) fit in TOTAL_CAP
// (R3) tier_change: its first step (medium: load, base, night) took 120 s in suite 44478553660 (07:26:13 -> 07:28:13); three steps, the cap is 3 x 120 s
const CAPS = { base_reuse: 900, context_loss: 100, tier_change: 360, zip_serve: 120, old_save: 60, soak: 170, resize: 80, audio_resume: 55, wallclock_audit: 10 };
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
  // fallback for a build without window.__game.audioState(): every AudioContext the game makes is kept, so its state can be read; if that fails, audio is left as it is
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
async function settle(p, capS) { const ok = await waitFor(p, SETTLED, undefined, capS || 40, 500); if (!ok) console.log('INFO settle: loads not done after ' + (capS || 40) + ' s (state ' + await stateOf(p) + ')'); await frames(p, 3, 30); return ok; }
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
  if (!await waitFor(p, () => { const g = window.__game; return !!g && g.state === 'base'; }, undefined, 60)) throw new Error('base not reached via ' + how + ' (state ' + await stateOf(p) + ')');
  await settle(p);
}
// a run (ring 0, as perfcheck and crashrepro), then night by the hooks: nightfall() goes into the nearest house and ends the day, so endDay() after it does nothing more
async function toRun(p) {
  await p.evaluate(() => { const s = document.getElementById('selRing'); if (s) s.value = '0'; window.__game.startRun(); });
  if (!await waitFor(p, () => { const g = window.__game; return !!g && !!g.run && g.state === 'play'; }, undefined, 60)) throw new Error('run did not start (state ' + await stateOf(p) + ')');
  await settle(p);
}
async function toNight(p) {
  await toRun(p);
  await p.evaluate(() => { window.__game.nightfall(); window.__game.endDay(); });
  if (!await waitFor(p, () => { const g = window.__game, s = g && g.sim; return !!s && s.phase === 'night'; }, undefined, 60)) throw new Error('night did not start (state ' + await stateOf(p) + ')');
  await settle(p);
}
// the night ends through window.__game.endNight(true) (sim.endNow: the game's own finish, a won night) and the end screen comes on the next frame
async function endNight(p) {
  const ok0 = await p.evaluate(() => { const g = window.__game; return typeof g.endNight === 'function' ? g.endNight(true) : 'no hook'; });
  if (ok0 === 'no hook') throw new Error('needs hook: window.__game.endNight');
  if (!ok0) throw new Error('endNight(true) refused (state ' + await stateOf(p) + ')');
  if (!await waitFor(p, () => { const g = window.__game; return !!g && g.state === 'end'; }, undefined, 45)) throw new Error('no end screen after endNight(true) (state ' + await stateOf(p) + ')');
  await frames(p, 2, 30);
}
// people in the base: window.__game.basePeople() (id, x, z and a pose checksum per villager, recruit and Marla), matched by id
async function people(p) {
  const r = await p.evaluate(() => (typeof window.__game.basePeople === 'function' ? window.__game.basePeople() : 'no hook'));
  if (r === 'no hook') throw new Error('needs hook: window.__game.basePeople');
  return r;
}
// the same settle for every visit: loads done (settle), then polled each second until the people list (ids and checksums rounded) holds for 3 polls (cap 15 s)
async function peopleReady(p) {
  let last = '', same = 0;
  for (let i = 0; i < 15 && same < 3; i++) { const k = JSON.stringify((await people(p)).map((q) => q.id + ':' + Math.round(q.pose))); same = k === last ? same + 1 : 0; last = k; await p.waitForTimeout(1000); }
  return same >= 3;
}
function comparePeople(a, b) {
  if (!a || !b || !a.length) return { err: 'no people from basePeople()' };
  const byId = new Map(b.map((q) => [String(q.id), q])), missing = [], extra = b.filter((q) => !a.some((r) => String(r.id) === String(q.id))).map((q) => q.id);
  let wp = 0, wq = 0, wpId = '', wqId = ''; const rows = [];
  for (const A of a) {
    const B = byId.get(String(A.id)); if (!B) { missing.push(A.id); continue; }
    const dp = Math.hypot(A.x - B.x, A.z - B.z), dq = Math.abs(A.pose - B.pose); rows.push({ id: A.id, dp, dq });
    if (dp > wp) { wp = dp; wpId = A.id; } if (dq > wq) { wq = dq; wqId = A.id; }
  }
  return { wp, wq, wpId, wqId, missing, extra, rows };
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
  await p.goto((o.url || t.url) + '?quality=' + (o.tier || TIER) + '&seed=' + SEED, { timeout: 90000 });
  if (!await waitFor(p, () => !!(window.__game && window.__game.enterBase), undefined, 90)) throw new Error('game did not start (no window.__game)');
  await frames(p, 2, 60);
  return p;
}
const errsSince = (t, k, label, list) => { const e = (list || t.errs).slice(k); if (e.length) t.fail(label + ': ' + e.length + ' error(s), first: ' + e[0]); };

// OWNER DECISION 16:22 (Nov 19): people whose idle animation continues across base visits; base_reuse does not compare their pose (place still strict)
const IDLE_GOES_ON = ['bram', 'oko', 'pip', 'marla'];
async function base_reuse(t) {
  const p = await open(t), visits = []; let noise = null, tol = null;
  // (R3, owner: the control before calling the drift a test issue) PM_KEEPBASE=0 runs the same test with the kept base off (every visit builds the base again)
  if (process.env.PM_KEEPBASE === '0') { await p.evaluate(() => { window.__game.cfg.lag.keepBase = false; }); t.info('control: CONFIG.lag.keepBase off'); }
  const visit = async (how, label) => {
    const k = t.errs.length;
    // game time held nearly still in the base (as perfcheck's measuring), so people stand where a visit puts them
    // (R3, control 1e-9 vs 0.0005 locally: the recruits' 3.6-5.1 mm went to 0.0000) 0.0005 s a frame was not a hold: a walking recruit moved about 0.5 mm a frame,
    // and visit 1 ran a different number of frames than visits 2 and 3; the step is now 1e-9 s a frame (PM_DTMAX overrides it)
    await p.evaluate((d) => { window.__dtMax = d; }, +(process.env.PM_DTMAX || 1e-9));
    await toBase(p, how); if (!await peopleReady(p)) t.info(label + ': people still changing after 15 s');
    const pl = await people(p), g = await gpu(p);
    // noise floor (visit 1 only): basePeople() read again 1 s later with game time still held; the difference is what a still base drifts by
    if (!visits.length) {
      await p.waitForTimeout(1000); const pl2 = await people(p), c = comparePeople(pl, pl2);
      if (c.err || c.missing.length || c.extra.length) t.fail('noise floor: the people list changed within 1 s of held time: ' + (c.err || 'missing ' + c.missing.join(', ') + ' extra ' + c.extra.join(', ')));
      noise = { pos: c.wp || 0, pose: c.wq || 0 }; tol = { pos: 3 * Math.max(noise.pos, NOISE_MIN), pose: 3 * Math.max(noise.pose, NOISE_MIN) };
      t.info('noise floor (1 s, time held): place ' + noise.pos.toFixed(4) + ' m, pose checksum ' + noise.pose.toFixed(4) + '; tolerance used: place ' + tol.pos.toFixed(4) + ' m, pose ' + tol.pose.toFixed(4));
    }
    await p.evaluate(() => { delete window.__dtMax; });
    errsSince(t, k, label); visits.push({ people: pl, g }); t.info(label + ': ' + pl.length + ' people, gpu ' + JSON.stringify(g));
  };
  // (R3) PM_VISIT1=enter: visit 1 goes home the player's way (Enter at the title, under the home card), as visits 2 and 3 do (the end screen's Back), instead of
  // the enterBase hook
  await visit(process.env.PM_VISIT1 === 'enter' ? 'enter' : 'hook', 'visit 1');
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
    t.info(lb + ' per person (place m / pose checksum): ' + c.rows.map((q) => q.id + ' ' + q.dp.toFixed(4) + '/' + q.dq.toFixed(4)).join(', '));
    t.info(lb + ': worst place ' + c.wp.toFixed(4) + ' m (' + c.wpId + '), worst pose ' + c.wq.toFixed(4) + ' (' + c.wqId + '); tolerance ' + tol.pos.toFixed(4) + ' m / ' + tol.pose.toFixed(4));
    if (c.missing.length) t.fail(lb + ': people missing: ' + c.missing.join(', '));
    if (c.extra.length) t.fail(lb + ': people not there on visit 1: ' + c.extra.join(', '));
    if (c.wp > tol.pos) t.fail(lb + ': ' + c.wpId + ' stands ' + c.wp.toFixed(4) + ' m from visit 1 (tolerance ' + tol.pos.toFixed(4) + ' = 3x noise ' + noise.pos.toFixed(4) + ', at least 3x ' + NOISE_MIN + ')');
    // OWNER DECISION 16:22 (Nov 19): the villagers (src/base.js NPCS: bram, oko, pip) and Marla keep their idle animation going across base visits (no restart), so
    // their pose may differ; their place and every other reset item stay strict, and every other person's pose too
    const strict = c.rows.filter((q) => !IDLE_GOES_ON.includes(String(q.id))), sq = strict.reduce((a, q) => (q.dq > a.dq ? q : a), { dq: 0, id: '' });
    t.info(lb + ': pose not compared for ' + IDLE_GOES_ON.join(', ') + ' (owner 16:22); worst pose of the others ' + sq.dq.toFixed(4) + (sq.id ? ' (' + sq.id + ')' : ''));
    if (sq.dq > tol.pose) t.fail(lb + ': ' + sq.id + ' pose checksum differs by ' + sq.dq.toFixed(4) + ' (tolerance ' + tol.pose.toFixed(4) + ' = 3x noise ' + noise.pose.toFixed(4) + ', at least 3x ' + NOISE_MIN + ')');
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
    if (o.start) { if (!await waitFor(p, () => window.__game.state === 'base', undefined, 60)) t.fail(label + ': base not reached (state ' + await stateOf(p) + ')'); await settle(p); }
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
      await p.waitForURL((u) => u.searchParams.get('quality') === tier, { timeout: 60000 });
      if (!await waitFor(p, () => !!(window.__game && window.__game.enterBase), undefined, 90)) throw new Error('game did not start after the switch to ' + tier);
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
  // (R3: 'no zip' in suite 44478553660: the CI's dist artifact leaves out dist/solardg-itch.zip, .github/workflows/checks.yml) the build's own zip
  // dist/solardg-itch.zip is used; when it is not there, it is made from dist with the build's own list (build.mjs: index.html physics.js music tex models voice)
  let zip = path.join(DIST, 'solardg-itch.zip'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'premortem-zip-'));
  if (fs.existsSync(zip)) t.info('zip ' + path.basename(zip) + ' (the build\'s)');
  else { const list = ['index.html', 'physics.js', 'music', 'tex', 'models', 'voice'].filter((f) => fs.existsSync(path.join(DIST, f))); if (!list.includes('index.html')) { t.fail('no dist/index.html to zip'); return; }
    zip = path.join(dir + '-src', 'solardg-itch.zip'); fs.mkdirSync(path.dirname(zip), { recursive: true });
    try { execFileSync('zip', ['-q', '-r', zip, ...list], { cwd: DIST, stdio: 'pipe' }); } catch (e) { execFileSync('python3', ['-I', '-c', 'import sys,os,zipfile\nz=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED)\nfor a in sys.argv[2:]:\n  if os.path.isdir(a):\n    for r,d,fs in os.walk(a):\n      for f in fs: z.write(os.path.join(r,f))\n  else: z.write(a)\nz.close()', zip, ...list], { cwd: DIST, stdio: 'pipe' }); }
    t.info('zip made from dist with the build\'s list (' + list.join(' ') + '): ' + (fs.statSync(zip).size / 1048576).toFixed(1) + ' MB'); }
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
    const k = t.errs.length; await toNight(p); await frames(p, 5, 30); await endNight(p);
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
  // the AudioContext state from window.__game.audioState() ('none' before the first click); the constructor wrapper of INIT only when the hook is missing
  const AUDIO = () => { const g = window.__game; let m = null; try { m = g.music(); } catch (e) { m = null; } const ac = typeof g.audioState === 'function' ? g.audioState() : 'fallback ' + ((window.__pmAC || []).map((a) => a.state).join(',') || 'none'); return { music: m ? (m.playing || []).join(',') || '-' : 'no hook', on: m ? m.on : null, ac }; };
  const ON = () => { const g = window.__game; let m = null; try { m = g.music(); } catch (e) { m = null; } if (m && m.playing && m.playing.length) return true; return typeof g.audioState === 'function' ? g.audioState() === 'running' : (window.__pmAC || []).some((a) => a.state === 'running'); };
  { const k = t.errs.length; await toBase(p, 'enter'); errsSince(t, k, 'Enter'); }
  const before = await waitFor(p, ON, undefined, 15); t.info('before hiding: ' + JSON.stringify(await p.evaluate(AUDIO)) + (before ? '' : ' (no sound running yet)'));
  {
    const k = t.errs.length;
    await p.evaluate(() => window.__pmHide(true)); await frames(p, 3, 30); t.info('hidden: ' + JSON.stringify(await p.evaluate(AUDIO)));
    await p.evaluate(() => window.__pmHide(false));
    const back = await waitFor(p, ON, undefined, 15), st = await p.evaluate(AUDIO); t.info('visible again: ' + JSON.stringify(st));
    if (!back) t.fail('after the tab came back neither music (music().playing) nor the AudioContext (audioState()) runs: ' + JSON.stringify(st));
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

async function runTest(b, url, name, fn, cap) {
  const t = { name, b, url, errs: [], perrs: [], fails: [], ctxs: [], info: (m) => console.log('INFO ' + name + ': ' + m), fail: (m) => t.fails.push(m) };
  let r, timer, capHit = false; const t0 = Date.now(), CAPERR = 'premortem cap';
  try {
    const run = Promise.resolve().then(() => fn(t)); run.catch(() => {});
    r = await Promise.race([run, new Promise((_, no) => { timer = setTimeout(() => no(new Error(CAPERR)), cap * 1000); })]);
  } catch (e) { if (msg(e) === CAPERR) capHit = true; else t.fails.push('stopped: ' + msg(e)); } finally { clearTimeout(timer); for (const c of t.ctxs) await c.close().catch(() => {}); console.log('TIME ' + name + ': ' + Math.round((Date.now() - t0) / 1000) + ' s of cap ' + cap + ' s'); }
  // a cap hit is reported apart from game failures; failures found before the cap are still printed as FAIL
  if (capHit) { console.log('CAPHIT ' + name + ': cap of ' + cap + ' s reached before the test finished (a test issue, not a game failure)'); if (t.fails.length) console.log('FAIL ' + name + ': ' + t.fails.join('; ').slice(0, 1200)); return t.fails.length ? 'fail+cap' : 'caphit'; }
  if (typeof r === 'string' && r.startsWith('skip:')) { console.log('SKIP ' + name + ': ' + r.slice(5)); return 'skip'; }
  if (name === 'wallclock_audit') { if (t.fails.length) t.info('audit stopped early: ' + t.fails.join('; ')); console.log('PASS ' + name); return 'pass'; }
  if (t.fails.length) { console.log('FAIL ' + name + ': ' + t.fails.join('; ').slice(0, 1200)); return 'fail'; }
  console.log('PASS ' + name); return 'pass';
}

(async () => {
  process.on('unhandledRejection', (e) => console.log('INFO unhandled: ' + msg(e)));
  const want = TESTS.filter(([n]) => !ONLY || ONLY.includes(n)), needB = want.some(([n]) => n !== 'wallclock_audit');
  if (needB && !fs.existsSync(path.join(DIST, 'index.html'))) { console.log('FAIL setup: no index.html in ' + DIST); console.log('PREMORTEM 0 PASS, 1 FAIL, 0 CAPHIT'); process.exit(1); }
  // the total time counts from before the browser starts
  const T0 = Date.now(); let b = null, srv = null; if (needB) { srv = await serve(DIST); b = await chromium.launch({ args: ARGS }); }
  let pass = 0, fail = 0, capHits = 0;
  for (const [n, f] of want) {
    if (needB && n !== 'wallclock_audit' && !b.isConnected()) { console.log('INFO browser gone: launching again'); b = await chromium.launch({ args: ARGS }); }
    const left = Math.round(TOTAL_CAP - (Date.now() - T0) / 1000), cap = Math.max(5, Math.min(CAPS[n] || 60, left));
    if (left < 5 && n !== 'wallclock_audit') { console.log('TIME ' + n + ': 0 s of cap 0 s'); console.log('CAPHIT ' + n + ': not run, TOTAL_CAP of ' + TOTAL_CAP + ' s used up'); capHits++; continue; }
    const r = await runTest(b, srv && srv.url, n, f, cap); if (r === 'pass') pass++; else if (r === 'fail') fail++; else if (r === 'caphit') capHits++; else if (r === 'fail+cap') { fail++; capHits++; }
  }
  if (b) await b.close().catch(() => {}); if (srv) await srv.close();
  console.log('INFO total ' + Math.round((Date.now() - T0) / 1000) + ' s');
  console.log('PREMORTEM ' + pass + ' PASS, ' + fail + ' FAIL, ' + capHits + ' CAPHIT'); process.exit(fail ? 1 : capHits ? 2 : 0);
})().catch((e) => { console.log('FAIL premortem: ' + msg(e)); console.log('PREMORTEM 0 PASS, 1 FAIL, 0 CAPHIT'); process.exit(1); });
