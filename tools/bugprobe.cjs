// Bug probe, browser layer (Nov 21): the built game in headless Chromium (low tier, software renderer, served over http), driven through its real
// buttons and keys where the other checks use hooks, with an always-true monitor running every frame. Bug classes from the published game-bug taxonomies
// (Lewis et al. 2010, Truelove et al. 2021, Butt et al. 2023) and web-game field reports (itch.io storage, iOS Safari, pointer lock) that no other check
// in ci/checks.json covers:
//   loop      title Enter -> base -> ride out -> street -> house -> night -> won end screen -> base, 3 cycles in one page:
//             crash (page errors, unhandled promise rejections), abnormal text ("undefined", "NaN", "null", "[object" on screen), invalid values in the live night,
//             incorrect reward (one night banked once, even with the end button pressed twice), runaway sound (a looping sound started in a run still playing
//             in the base), object persistence (window/document listeners and timers growing per cycle)
//   pause     at night with machines about: Escape freezes everything (game time, health, energy, every machine); blur and a hidden tab too; play goes on after
//   keys      W held when the window loses focus (no keyup ever comes): after coming back the player stands still, in the base and at night
//   double    every scene button pressed twice in one moment (Enter, Ride out, Leave twice, Play again): one scene change, no error, the save counts one night
//   death     a lost night and a left night (Leave pressed twice): end screen, back to the base, the save stays usable
//   blocked   localStorage throws on every use (itch.io embeds with third-party storage blocked, Safari): the whole loop still plays
//   quota     localStorage.setItem throws QuotaExceededError (itch.io's shared storage full): the whole loop still plays
//   corrupt   a damaged save and damaged settings in storage: the game starts, reaches the base and plays a night
// Usage: node tools/bugprobe.cjs [distDir]   env TESTS=loop,pause (default all), TIER (default low), CHROME (a browser binary if Playwright's own is missing),
//        SELFTEST=1 plants a fault for each monitor (the probe must FAIL on every one).
// Prints 'PASS <test>' or 'FAIL <test>: <reason>' per test, 'TIME <test>: <s> s', then 'BUGPROBE <n> PASS, <m> FAIL'. Exit 1 on any FAIL.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const TIER = process.env.TIER || 'low', SEED = 777, SELF = !!process.env.SELFTEST;
const ALL = ['loop', 'pause', 'keys', 'double', 'death', 'blocked', 'quota', 'corrupt'];
const ONLY = process.env.TESTS ? process.env.TESTS.split(',').map((s) => s.trim()) : ALL;
const CAPS = { loop: 1500, pause: 400, keys: 400, double: 600, death: 900, blocked: 700, quota: 700, corrupt: 700 };
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };

function serve(root) {
  return new Promise((ok) => {
    const srv = http.createServer((q, r) => {
      let f; try { f = path.join(root, decodeURIComponent(q.url.split('?')[0])); } catch (e) { r.writeHead(400); r.end(); return; }
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(f).size }); fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + srv.address().port + '/index.html', close: () => new Promise((c) => { if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(() => c()); }) }));
  });
}

// installed before the game's scripts. storage: 'normal' (cleared once, lesson done), 'blocked', 'quota', 'corrupt'
const INIT = ({ seed, storage, self, fast }) => {
  // fast: game time keeps up on the software renderer (the slow checks' window.__dtMax, as guidecheck); the keys test keeps the players' own step
  if (fast) window.__dtMax = 0.2;
  let s = seed; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__fakeLock = true;
  if (storage === 'blocked') { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); }
  else {
    try { if (!sessionStorage.getItem('bp.first')) { sessionStorage.setItem('bp.first', '1'); localStorage.clear(); if (storage !== 'corrupt') localStorage.setItem('dawnpunk.drill', '{"skip":true}');
      if (storage === 'corrupt') { localStorage.setItem('solardg.save', '{"v":4,"day":3,"food":12,"essen'); localStorage.setItem('dawnpunk.drill', '{bad json'); localStorage.setItem('dawnpunk.quality', 'ultra'); localStorage.setItem('solardg.music', 'maybe'); localStorage.setItem('solardg.hints', '7'); localStorage.setItem('dawnpunk.look', '[]'); } } } catch (e) { }
    if (storage === 'quota') { const st = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (this === window.localStorage) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); return st.call(this, k, v); }; }
  }
  window.__bpFrames = 0; const raf0 = window.requestAnimationFrame.bind(window); window.__bpRaf = raf0;
  window.requestAnimationFrame = function (cb) { return raf0(function (t) { window.__bpFrames++; return cb(t); }); };
  // listeners and timers, counted per target and event type (object persistence across scene changes)
  const L = new Map(), key = (t, ty) => (t === window ? 'window' : t === document ? 'document' : t && t.id ? '#' + t.id : t && t.nodeName ? t.nodeName : 'other') + ':' + ty;
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (ty, fn, o) { if (this === window || this === document || (this && this.nodeType === 1 && this.isConnected)) { const k = key(this, ty); L.set(k, (L.get(k) || 0) + 1); } return add.call(this, ty, fn, o); };
  EventTarget.prototype.removeEventListener = function (ty, fn, o) { if (this === window || this === document || (this && this.nodeType === 1)) { const k = key(this, ty); if (L.has(k)) L.set(k, L.get(k) - 1); } return rem.call(this, ty, fn, o); };
  const iv = new Set(), si = window.setInterval, ci = window.clearInterval; window.setInterval = function () { const id = si.apply(window, arguments); iv.add(id); return id; }; window.clearInterval = function (id) { iv.delete(id); return ci.call(window, id); };
  window.__bpListen = () => ({ ...Object.fromEntries(L), intervals: iv.size });
  // every sound source: the scene it started in and whether it is still running (runaway sound)
  window.__bpSnd = []; const live = new Set();
  try {
    const P = AudioScheduledSourceNode.prototype, st0 = P.start, sp0 = P.stop;
    P.start = function () { const g = window.__game, rec = { st: g ? g.state : 'load', loop: !!this.loop || this instanceof OscillatorNode, open: true, kind: this.constructor.name }; this.__bp = rec; live.add(rec); this.addEventListener('ended', () => { rec.open = false; live.delete(rec); }); return st0.apply(this, arguments); };
    P.stop = function (w) { if (this.__bp && (!w || w <= this.context.currentTime + 0.05)) { this.__bp.open = false; live.delete(this.__bp); } else if (this.__bp) this.__bp.stopAt = w; return sp0.apply(this, arguments); };
  } catch (e) { }
  window.__bpLive = () => [...live].filter((r) => r.loop && r.open && (!r.stopAt || r.stopAt > 1e9)).map((r) => r.kind + ' from ' + r.st);
  // the monitor, every frame: live night values, on-screen text, the run log
  window.__bpV = {}; const V = (n, ok, ex) => { if (ok) return; const v = window.__bpV[n] || (window.__bpV[n] = { n: 0, ex }); v.n++; };
  const fin = (v) => typeof v === 'number' && isFinite(v);
  let k = 0; const mon = () => {
    raf0(mon); const g = window.__game; if (!g) return; k++;
    try {
      const sm = g.sim, c = typeof g.cfg === 'function' ? g.cfg() : g.cfg;
      if (sm && c) { const p = sm.player; if (self && k === 400) p.energy = NaN;
        V('live values finite', [p.x, p.z, p.hp, p.energy, sm.food, sm.ess, sm.t].every(fin) && sm.gloom.every((q) => fin(q.x) && fin(q.z) && fin(q.hp)), JSON.stringify({ x: p.x, z: p.z, hp: p.hp, e: p.energy, t: sm.t }));
        V('live health and energy in range', p.hp >= 0 && p.hp <= c.player.hp + 1e-9 && p.energy >= -1e-9 && p.energy <= c.player.energyCap + 1e-9, 'hp ' + p.hp + ' energy ' + p.energy);
        V('live player inside the house', p.climb || (Math.abs(p.x) <= sm.H && Math.abs(p.z) <= sm.H), p.x.toFixed(2) + ',' + p.z.toFixed(2) + ' half ' + sm.H.toFixed(2));
        V('run log does not grow without end', sm.log.length < 5000, 'log length ' + sm.log.length);
      }
      if (k % 20 === 0) { let txt = ''; for (const el of document.querySelectorAll('body *')) { if (el.children.length || !el.offsetParent) continue; const t = el.textContent; if (t && t.length < 400) txt += t + '\n'; } if (self && k === 600) txt += 'Food undefined'; const m = txt.match(/.{0,30}(\bundefined\b|\bNaN\b|\[object |\bnull\b).{0,20}/); V('screen text has no undefined/NaN/null', !m, m && m[0] + ' (state ' + g.state + ')'); }
    } catch (e) { V('monitor read failed', false, String(e).slice(0, 120)); }
  }; raf0(mon);
};

let STEP_T0 = Date.now(), CUR = null; const STEP = (n) => { console.log('STEP ' + ((Date.now() - STEP_T0) / 1000).toFixed(0) + 's ' + n); };
const waitFor = async (p, fn, arg, capS, poll) => { try { await p.waitForFunction(fn, arg === undefined ? null : arg, { timeout: capS * 1000, polling: poll || 250 }); return true; } catch (e) { if (/closed|crash/i.test(String(e))) throw e; return false; } };
const stateOf = (p) => p.evaluate(() => { const g = window.__game; return g ? g.state + (g.sim ? '/' + g.sim.phase : '') + (g.run ? '/run' : '') : 'no game'; }).catch(() => '?');
const frames = async (p, n, capS) => { const f0 = await p.evaluate(() => window.__bpFrames); return waitFor(p, ([f0, n]) => window.__bpFrames >= f0 + n, [f0, n], capS || 90); };
const SETTLED = () => { try { const g = window.__game; if (!g) return false; if (g.cardOn && g.cardOn()) return false; if (g.state === 'base' && g.bview && g.bview.bgBusy) return false; if (g.state === 'base' && g.marla && g.marla.ready === false) return false; const q = g.quality().hi; if (q && q.ok + q.failed < q.asked) return false; const G = window.__gloomGlb || {}; for (const k in G) if (G[k] === 'loading') return false; return true; } catch (e) { return false; } };
const settle = async (p, capS) => { await waitFor(p, SETTLED, undefined, capS || 60, 500); await frames(p, 3, 60); };
// a real mouse click (or several) at the button's place on screen: a later click lands on whatever is there by then, as for a player
async function realClicks(p, id, gaps) {
  const r = await p.evaluate((id) => { const b = document.getElementById(id); if (!b || !b.offsetParent) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, id);
  if (!r) throw new Error('button #' + id + ' is not on screen');
  await p.mouse.click(r.x, r.y); for (const g of gaps) { if (g) await p.waitForTimeout(g); await p.mouse.click(r.x, r.y); }
}
const press = (p, id) => p.evaluate((id) => { const b = document.getElementById(id); if (!b) return false; b.click(); return true; }, id);
const state = (p, want, capS) => waitFor(p, (w) => { const g = window.__game; return !!g && g.state === w; }, want, capS || 90);
// the job card and Marla's first card: closed with their own buttons, as a player does
const cards = (p) => p.evaluate(() => { const c = document.getElementById('jobCard'); if (c) c.querySelector('button').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });

async function enterBase(p) {
  STEP('enterBase');
  await p.click('#enter', { timeout: 60000 }).catch(() => press(p, 'enter'));
  if (!await state(p, 'base', 120)) throw new Error('Enter did not reach the base (state ' + await stateOf(p) + ')');
  await settle(p); await cards(p); await frames(p, 3);
}
// ride out with the real button (Ride out in the scout card), then into the nearest house and the night through the game's own nightfall
async function toNight(p) {
  STEP('toNight');
  await p.evaluate(() => { const s = document.getElementById('selRing'); if (s) s.value = '0'; });
  if (!await press(p, 'go')) throw new Error('no Ride out button');
  if (!await waitFor(p, () => { const g = window.__game; return !!g && !!g.run && g.state === 'play'; }, undefined, 120)) throw new Error('Ride out did not start a run (state ' + await stateOf(p) + ')');
  await settle(p);
  // a few real steps on the street (keys), then the nearest house and dusk
  await p.keyboard.down('KeyW'); await frames(p, 20); await p.keyboard.up('KeyW');
  await p.evaluate(() => { window.__game.nightfall(); window.__game.endDay(); });
  if (!await waitFor(p, () => { const g = window.__game, s = g && g.sim; return !!s && s.phase === 'night'; }, undefined, 120)) throw new Error('night did not start (state ' + await stateOf(p) + ')');
  await settle(p);
  // the night-1 lesson (storage blocked or corrupt: it has no record of being done): skipped with its own Skip button, as a player may
  await p.evaluate(() => { const d = window.__game.drillInfo && window.__game.drillInfo(); if (d) { const b = document.getElementById('bSkip'); if (b && b.offsetParent) b.click(); } });
}
// night play through the real inputs: look around (mouse), fire (mouse button), devices (number keys), eat (F), walk (WASD); game seconds of night
async function fight(p, gameS) {
  STEP('fight ' + gameS);
  const t0 = await p.evaluate(() => window.__game.sim.t); const box = await p.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  let i = 0; const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  while (i++ < 400) {
    const st = await p.evaluate(() => { const g = window.__game; return g.sim ? { t: g.sim.t, done: g.sim.done, state: g.state } : null; });
    if (!st || st.done || st.state !== 'play' || st.t - t0 >= gameS) break;
    const k = keys[i % 4]; await p.keyboard.down(k); await p.mouse.move(box.x + ((i * 37) % 200) - 100, box.y + ((i * 17) % 80) - 40);
    await p.mouse.down(); await frames(p, 2); await p.mouse.up(); await p.keyboard.up(k);
    if (i % 7 === 0) await p.keyboard.press('Digit' + (1 + (i % 4))); if (i % 11 === 0) await p.keyboard.press('KeyF');
  }
}
async function endNight(p, win) {
  STEP('endNight ' + win);
  const ok = await p.evaluate((w) => window.__game.endNight(w), win);
  if (!ok) throw new Error('endNight refused (state ' + await stateOf(p) + ')');
  if (!await state(p, 'end', 90)) throw new Error('no end screen (state ' + await stateOf(p) + ')');
  await frames(p, 3);
}
async function again(p, twice) {
  STEP('again');
  if (twice) await realClicks(p, 'again', [0]); else await press(p, 'again');
  if (!await state(p, 'base', 120)) throw new Error('Play again did not reach the base (state ' + await stateOf(p) + ')');
  await settle(p); await cards(p); await frames(p, 3);
}

async function open(t, storage, slow) {
  const ctx = await t.b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); t.ctxs.push(ctx);
  await ctx.addInitScript(INIT, { seed: SEED, storage: storage || 'normal', self: SELF, fast: !slow });
  const p = await ctx.newPage(); p.setDefaultTimeout(120000);
  p.on('pageerror', (e) => t.errs.push(String(e).slice(0, 240)));
  p.on('console', (m) => { if (m.type() === 'error') t.errs.push('console: ' + m.text().slice(0, 240)); });
  p.on('crash', () => t.errs.push('page crashed'));
  p.on('response', (r) => { if (r.status() >= 400) t.errs.push('HTTP ' + r.status() + ' ' + r.url().replace(t.url.replace('index.html', ''), '')); });
  await p.goto(t.url + '?quality=' + TIER + '&seed=' + SEED, { timeout: 120000 });
  if (!await waitFor(p, () => !!(window.__game && window.__game.enterBase), undefined, 120)) throw new Error('game did not start (no window.__game)');
  await frames(p, 3);
  return p;
}
// the monitor's findings and the page errors, as FAIL reasons
async function monitorFails(t, p) {
  const v = await p.evaluate(() => window.__bpV).catch(() => ({}));
  for (const [n, x] of Object.entries(v || {})) t.fail(n + ': ' + x.n + ' frame(s), first: ' + x.ex);
  if (t.errs.length) { const u = [...new Set(t.errs)]; t.fail('page errors: ' + t.errs.length + ' (' + u.length + ' kinds): ' + u.slice(0, 4).join(' / ')); }
}
const snapNight = (p) => p.evaluate(() => { const s = window.__game.sim; return JSON.stringify({ t: +s.t.toFixed(4), p: [s.player.x, s.player.z, s.player.hp, s.player.energy].map((v) => +v.toFixed(4)), g: s.gloom.map((q) => [+q.x.toFixed(3), +q.z.toFixed(3), +q.hp.toFixed(3), q.phase]), d: s.devices.map((q) => +q.hp.toFixed(3)) }); });

const TESTS = {
  async loop(t) {
    const p = await open(t); await enterBase(p);
    const sv0 = await p.evaluate(() => ({ nights: window.__game.save.nights }));
    const L = [];
    for (let c = 0; c < 3; c++) {
      await toNight(p); await fight(p, 25);
      await endNight(p, true);
      await again(p, true);
      await frames(p, 60);
      const live = await p.evaluate(() => window.__bpLive());
      if (SELF && c === 0) live.push('planted OscillatorNode from play');
      if (live.length) t.fail('runaway sound: ' + live.length + ' looping source(s) from the run still playing in the base, first: ' + live[0]);
      L.push(await p.evaluate(() => window.__bpListen()));
    }
    const sv1 = await p.evaluate(() => ({ nights: window.__game.save.nights }));
    if (sv1.nights - sv0.nights !== 3) t.fail('incorrect reward: 3 nights (Play again pressed twice each) counted ' + (sv1.nights - sv0.nights) + ' nights in the save');
    // listeners and timers: cycle 3 against cycle 2 (cycle 1 may still create its one-time listeners)
    if (SELF) L[2]['window:planted'] = (L[1]['window:planted'] || 0) + 5;
    const grew = Object.keys(L[2]).filter((k) => (L[2][k] || 0) > (L[1][k] || 0)).map((k) => k + ' ' + (L[1][k] || 0) + '->' + L[2][k]);
    console.log('INFO loop listeners after cycles 2 and 3: ' + Object.keys(L[2]).length + ' kinds, intervals ' + L[1].intervals + '->' + L[2].intervals);
    if (grew.length) t.fail('listeners/timers grow every cycle: ' + grew.slice(0, 6).join(', '));
    await monitorFails(t, p);
  },
  async pause(t) {
    const p = await open(t); await enterBase(p); await toNight(p);
    // wait until a machine is inside or close, so a frozen night is a real test
    await p.evaluate(() => window.__game.sim.addGloom(3));
    if (!await waitFor(p, () => window.__game.sim.gloom.length > 0, undefined, 120)) t.fail('no machine came after addGloom(3) (test setup)');
    for (const how of ['Escape', 'blur', 'hidden']) {
      if (how === 'Escape') await p.keyboard.press('Escape'); else if (how === 'blur') await p.evaluate(() => dispatchEvent(new Event('blur')));
      else await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await frames(p, 5); const a = await snapNight(p);
      if (SELF && how === 'Escape') await p.evaluate(() => { window.__game.sim.player.hp -= 1; });
      await frames(p, 90); const b = await snapNight(p);
      if (a !== b) t.fail('paused by ' + how + ' but the night moved: ' + a.slice(0, 120) + ' -> ' + b.slice(0, 120));
      if (how === 'hidden') await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
      await press(p, 'resume'); await frames(p, 5);
      const t1 = await p.evaluate(() => window.__game.sim.t); await frames(p, 30); const t2 = await p.evaluate(() => window.__game.sim.t);
      if (!(t2 > t1)) t.fail('after the pause by ' + how + ' the night did not go on (Resume): t ' + t1 + ' -> ' + t2);
    }
    await monitorFails(t, p);
  },
  async keys(t) {
    const p = await open(t, 'normal', true); await enterBase(p);
    for (const where of ['base', 'night']) {
      if (where === 'night') await toNight(p);
      const pos = () => p.evaluate(() => { const g = window.__game; return g.state === 'base' ? [g.basePos().x, g.basePos().z] : [g.sim.player.x, g.sim.player.z]; });
      await p.keyboard.down('KeyW'); await frames(p, 15);
      const a0 = await pos(); await frames(p, 10); const a1 = await pos();
      const moved = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
      // the window loses focus with W still down: the browser never sends its keyup
      await p.evaluate(() => dispatchEvent(new Event('blur'))); await frames(p, 5);
      await press(p, 'resume'); await frames(p, 5);
      if (SELF && where === 'base') await p.evaluate(() => { const q = window.__game.basePos(); window.__game.setBase(q.x + 0.5, q.z); });
      const b0 = await pos(); await frames(p, 30); const b1 = await pos();
      const drift = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
      console.log(`INFO keys ${where}: moved ${moved.toFixed(2)} m in 10 frames with W held; ${drift.toFixed(2)} m in 30 frames after focus came back`);
      if (moved < 0.01) t.fail(where + ': W held did not move the player (test setup)');
      if (drift > 0.01) t.fail(where + ': stuck key: the player kept walking ' + drift.toFixed(2) + ' m after the window lost focus with W held');
      await p.keyboard.up('KeyW');
    }
    await monitorFails(t, p);
  },
  async double(t) {
    const p = await open(t);
    await realClicks(p, 'enter', [0]);
    if (!await state(p, 'base', 120)) throw new Error('double Enter did not reach the base (state ' + await stateOf(p) + ')');
    await settle(p); await cards(p);
    const n0 = await p.evaluate(() => window.__game.save.nights);
    await p.evaluate(() => { const s = document.getElementById('selRing'); if (s) s.value = '0'; });
    if (!await p.evaluate(() => !!document.getElementById('go').offsetParent)) { await p.evaluate(() => window.__game.openScout()); await frames(p, 3); }
    await realClicks(p, 'go', [0]);
    if (!await waitFor(p, () => { const g = window.__game; return !!g.run && g.state === 'play'; }, undefined, 120)) throw new Error('double Ride out did not start a run (state ' + await stateOf(p) + ')');
    await settle(p);
    const r1 = await p.evaluate(() => { window.__bpRun = window.__game.run; return true; }); void r1;
    await frames(p, 30);
    if (!await p.evaluate(() => window.__game.run === window.__bpRun)) t.fail('double Ride out: a second run replaced the first one');
    await p.evaluate(() => { window.__game.nightfall(); window.__game.endDay(); });
    await waitFor(p, () => { const s = window.__game.sim; return !!s && s.phase === 'night'; }, undefined, 120); await settle(p);
    await endNight(p, true);
    // a double click, then a third click 0.7 s later (past the touch guard's 600 ms) on the same spot
    await realClicks(p, 'again', [0, 700]);
    if (!await state(p, 'base', 120)) { t.fail('Back to the base clicked twice, then once more 0.7 s later: the base was not reached (state ' + await stateOf(p) + ', title shown: ' + await p.evaluate(() => document.getElementById('menu').style.display) + ')'); return; }
    await settle(p);
    const n1 = await p.evaluate(() => window.__game.save.nights);
    if (n1 - n0 !== 1) t.fail('incorrect reward: one night, Play again pressed 3 times, the save counts ' + (n1 - n0) + ' nights');
    await monitorFails(t, p);
  },
  async death(t) {
    const p = await open(t); await enterBase(p);
    const n0 = await p.evaluate(() => window.__game.save.nights);
    await toNight(p); await fight(p, 8); await endNight(p, false); await again(p);
    await toNight(p); await fight(p, 6);
    // Leave: the pause menu's Leave, pressed twice (the second press confirms)
    await p.keyboard.press('Escape'); await frames(p, 3); await press(p, 'quit'); await frames(p, 2); await press(p, 'quit');
    if (!await waitFor(p, () => { const g = window.__game; return g.state === 'end' || g.state === 'base'; }, undefined, 120)) t.fail('Leave pressed twice at night did not leave (state ' + await stateOf(p) + ')');
    if (await p.evaluate(() => window.__game.state === 'end')) await again(p); else { await settle(p); await cards(p); }
    const n1 = await p.evaluate(() => window.__game.save.nights);
    if (n1 - n0 !== 2) t.fail('a lost and a left night counted ' + (n1 - n0) + ' nights (expected 2)');
    await toNight(p); await fight(p, 5); await endNight(p, true); await again(p);
    await monitorFails(t, p);
  },
  async blocked(t) { await storageRun(t, 'blocked'); },
  async quota(t) { await storageRun(t, 'quota'); },
  async corrupt(t) { await storageRun(t, 'corrupt'); },
};
async function storageRun(t, how) {
  const p = await open(t, how); await enterBase(p);
  const day = await p.evaluate(() => window.__game.save.day);
  await toNight(p); await fight(p, 10); await endNight(p, true); await again(p);
  const day2 = await p.evaluate(() => window.__game.save.day);
  if (day2 !== day + 1) t.fail(how + ' storage: the day did not move on after a night (' + day + ' -> ' + day2 + ')');
  await monitorFails(t, p);
}

(async () => {
  const srv = await serve(DIST); const exe = process.env.CHROME && fs.existsSync(process.env.CHROME) ? process.env.CHROME : undefined;
  const b = await chromium.launch({ args: ARGS, executablePath: exe });
  let np = 0, nf = 0;
  for (const name of ONLY) {
    STEP_T0 = Date.now(); const fails = [], t = { b, url: srv.url, errs: [], ctxs: [], fail: (s) => fails.push(s) }, t0 = Date.now();
    let capped = false;
    try { await Promise.race([TESTS[name](t), new Promise((_, rj) => setTimeout(() => { capped = true; rj(new Error('cap ' + CAPS[name] + ' s reached')); }, CAPS[name] * 1000))]); }
    catch (e) { let st = '?'; try { const pg = t.ctxs.length && t.ctxs[t.ctxs.length - 1].pages()[0]; if (pg) st = await stateOf(pg) + ' drill ' + JSON.stringify(await pg.evaluate(() => window.__game.drillInfo && window.__game.drillInfo())) + ' card ' + await pg.evaluate(() => window.__game.cardOn && window.__game.cardOn()); } catch (e2) { } fails.push((capped ? 'CAPHIT ' : 'error: ') + String(e && e.message).split('\n')[0].slice(0, 240) + ' (game at: ' + st + ')'); }
    for (const c of t.ctxs) await c.close().catch(() => {});
    console.log(`TIME ${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s of cap ${CAPS[name]} s`);
    if (fails.length) { nf++; console.log(`FAIL ${name}: ${fails.join(' | ')}`); } else { np++; console.log('PASS ' + name); }
  }
  await b.close(); await srv.close();
  console.log(`BUGPROBE ${np} PASS, ${nf} FAIL`); process.exit(nf ? 1 : 0);
})();
