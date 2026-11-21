// Skip check (owner Nov 22: "bright flash in the base when the player skips the opening"): a first-time player presses Skip in each part of the opening;
// from the moment the film's black is gone, every frame not covered by the loading card must show the base (the 3D picture sampled right after the game's
// own frame), not the empty sky colour, and nothing may clear and redraw the screen outside the game's own frame while no card covers it.
// Cause found: the film's warm-up (src/main.js filmWarm) kept drawing a few pieces at a time straight to the screen after the skip, over the base.
// Usage: node tools/skipcheck.cjs [dist] [tier]   env SKIPS=4,33 (seconds of film shown before Skip), CHROME (browser binary if Playwright's own is missing)
// Prints 'PASS skip at <s> s: ...' or 'FAIL skip at <s> s: ...' per skip moment. Exit 1 on any FAIL.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist')), TIER = process.argv[3] || 'low';
const SKIPS = (process.env.SKIPS || '4,33').split(',').map(Number);
// frames sampled after the card lifts; a frame counts as the base when its picture has at least MIN_COLORS colours (4-bit) and is not mostly the sky colour
const AFTER = +(process.env.AFTER || 400), MIN_COLORS = 24, SKY_SHARE = 0.85;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((ok) => { const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); srv.listen(0, '127.0.0.1', () => ok(srv)); });
// installed before the game: after each game frame (rAF callbacks run in the order asked), the picture is sampled while sampling is on
const INIT = () => {
  window.__fakeLock = true; const raf0 = window.requestAnimationFrame.bind(window); window.__sk = { on: false, frames: [], foreign: [] };
  const sample = () => { const c = document.getElementById('c'); if (!c) return null; const o = window.__skC || (window.__skC = document.createElement('canvas')); o.width = 48; o.height = 27; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 48, 27);
    const d = x.getImageData(0, 0, 48, 27).data, set = new Set(); let sky = 0; for (let i = 0; i < d.length; i += 4) { set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)); if (Math.abs(d[i] - 191) < 12 && Math.abs(d[i + 1] - 230) < 12 && Math.abs(d[i + 2] - 240) < 12) sky++; }
    return { colors: set.size, sky: sky / (d.length / 4) }; };
  const vis = (id) => { const e = document.getElementById(id); if (!e) return false; const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.5; };
  // colour clears and draws that go to the screen (default framebuffer), counted per game frame: a frame of the game clears the screen once (its main
  // render); a second clear in the same frame means something drew over the picture afterwards
  let fb = null, clears = 0, draws = 0, cur = null;
  for (const P of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) { if (!P) continue; const pr = P.prototype, bf = pr.bindFramebuffer, cl = pr.clear;
    pr.bindFramebuffer = function (t, f) { if (t !== 0x8CA9) fb = f; return bf.apply(this, arguments); }; pr.clear = function (m) { if (!fb && (m & 0x4000)) { clears++; if (!cur && window.__sk.on) window.__sk.foreign.push({ t: performance.now(), cine: vis('cine'), card: vis('lcard') }); } return cl.apply(this, arguments); };
    for (const nm of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) { const o = pr[nm]; if (o) pr[nm] = function () { if (!fb) draws++; return o.apply(this, arguments); }; } }
  // the game's main loop is the callback that asks for itself again while it runs (frame() calls requestAnimationFrame(frame) first); the picture is sampled
  // right after it, in the same task, before the browser shows the frame
  let n = 0; window.requestAnimationFrame = function (cb) { if (cb === cur) cb.__main = true; return raf0(function (t) { cur = cb; if (cb.__main) { clears = 0; draws = 0; } let r; try { r = cb(t); } finally { cur = null; }
    if (cb.__main && window.__sk.on && window.__game) { const f = { cine: vis('cine'), card: vis('lcard'), state: window.__game.state, clears, draws }; if (draws && (clears > 1 || n++ % 6 === 0)) Object.assign(f, sample()); window.__sk.frames.push(f); } return r; }); };
};
(async () => {
  const srv = await serve(), url = 'http://127.0.0.1:' + srv.address().port + '/index.html?quality=' + TIER + '&film=1&cards=1';
  const exe = process.env.CHROME && fs.existsSync(process.env.CHROME) ? process.env.CHROME : undefined;
  const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  let fails = 0;
  for (const at of SKIPS) {
    const ctx = await b.newContext({ viewport: { width: 640, height: 360 } }); await ctx.addInitScript(INIT); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    let line = '';
    try {
      await p.goto(url, { timeout: 300000 });
      await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && e.offsetParent && !e.disabled && window.__game; }, null, { timeout: 900000, polling: 500 });
      await p.click('#enter');
      // the film is showing: state intro, Skip on screen, the black lifted
      await p.waitForFunction(() => window.__game.state === 'intro' && getComputedStyle(document.getElementById('cineSkip')).display !== 'none' && +getComputedStyle(document.getElementById('cineFade')).opacity < 0.9, null, { timeout: 900000, polling: 200 });
      await p.waitForTimeout(at * 1000);
      const part = await p.evaluate(() => window.__game.state);
      await p.evaluate(() => { window.__sk.on = true; window.__sk.frames = []; window.__sk.foreign = []; });
      await p.click('#cineSkip', { timeout: 10000 }).catch(() => p.keyboard.press('Space'));
      // until AFTER frames have been drawn with the film gone and no loading card on top
      await p.waitForFunction((n) => window.__sk.frames.filter((f) => !f.cine && !f.card && f.state === 'base' && f.draws).length >= n, AFTER, { timeout: 900000, polling: 500 });
      const fr = await p.evaluate(() => window.__sk.frames), fo = await p.evaluate(() => window.__sk.foreign);
      if (process.env.SKDEBUG) console.log('FOREIGN ' + fo.length + ' film ' + fo.filter((f) => f.cine).length + ' card ' + fo.filter((f) => !f.cine && f.card).length + ' open ' + fo.filter((f) => !f.cine && !f.card).length + ' ' + fo.filter((f) => !f.cine && !f.card).slice(0, 20).map((f) => (f.cine ? 'F' : f.card ? 'K' : 'b') + Math.round(f.t / 100) / 10).join(' '));
      const shown = fr.filter((f) => !f.cine && !f.card), drawn = shown.filter((f) => f.draws), bad = drawn.filter((f) => f.colors !== undefined && (f.colors < MIN_COLORS || f.sky > SKY_SHARE)), over = drawn.filter((f) => f.clears > 1);
      // screen clears made outside the game's frame with neither the film's black nor the loading card on top: something drawing over the base the player sees
      const open = fo.filter((f) => !f.cine && !f.card);
      line = `skip at ${at} s (${part}): ${drawn.length} frames drawn after the film, ${open.length} screen redraws outside the game's frame with nothing on top (${fo.length - open.length} under the card or black), ${over.length} frames cleared twice, ${bad.length} of ${drawn.filter((f) => f.colors !== undefined).length} sampled without the base` + (bad.length ? ` (first: ${bad[0].colors} colours, ${(bad[0].sky * 100).toFixed(0)}% sky)` : '') + `, card frames ${fr.filter((f) => f.card).length}, page errors ${errs.length}`;
      if (process.env.SKDEBUG) console.log('FRAMES ' + fr.map((f) => (f.cine ? 'F' : f.card ? 'K' : f.state[0]) + f.clears + '/' + f.draws + (f.colors !== undefined ? ':' + f.colors : '')).join(' '));
      if (bad.length || over.length || open.length || errs.length) { fails++; console.log('FAIL ' + line + (errs[0] ? ' / ' + errs[0] : '')); } else console.log('PASS ' + line);
    } catch (e) { fails++; console.log(`FAIL skip at ${at} s: ${String(e.message).split('\n')[0]}`); }
    await ctx.close();
  }
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
