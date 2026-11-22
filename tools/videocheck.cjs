// Video opening check (owner Nov 22: the opening as a fixed video): a first-time player on the player's path (?cards=1), in a browser that plays H.264.
//  A  loading page: the opening is ready without the 3D film being prepared (no film street, no film machine models fetched); the right file for the tier
//  B  after Enter: the video plays (its clock moves), the 3D picture is not shown, the captions follow the video's clock, the night track plays in the street part
//  C  the end: home card, then the base drawn (no redraw over it), the job card, the video gone; the save marks the opening seen
//  D  Skip at 10 s: the same end
//  E  the video file missing: the 3D film plays instead, no page error
// Usage: node tools/videocheck.cjs [dist] [tier]   env CHROME (a browser with H.264; Google Chrome on the CI runner: /usr/bin/google-chrome), PARTS (default ABCDE)
// Prints PASS/FAIL lines. Exit 1 on any FAIL.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist')), TIER = process.argv[3] || 'medium', PARTS = process.env.PARTS || 'ABCDE';
const CHROME = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find((p) => p && fs.existsSync(p));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };
// http with range requests (a video element asks for byte ranges)
const serve = () => new Promise((ok) => { const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  const size = fs.statSync(f).size, ty = TYPES[path.extname(f)] || 'application/octet-stream', m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
  if (m) { const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1; r.writeHead(206, { 'Content-Type': ty, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 }); fs.createReadStream(f, { start: a, end: b }).pipe(r); }
  else { r.writeHead(200, { 'Content-Type': ty, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r); } }); srv.listen(0, '127.0.0.1', () => ok(srv)); });
let fails = 0; const line = (ok, s) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + s); };
// screen clears outside the game's frame (as tools/skipcheck.cjs): something drawing over the base the player sees
const INIT = () => { window.__fakeLock = true; window.__vc = { foreign: 0, on: false }; let fb = null, cur = null; const raf0 = window.requestAnimationFrame.bind(window);
  for (const P of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) { if (!P) continue; const pr = P.prototype, bf = pr.bindFramebuffer, cl = pr.clear; pr.bindFramebuffer = function (t, f) { if (t !== 0x8CA9) fb = f; return bf.apply(this, arguments); };
    pr.clear = function (m) { if (!fb && (m & 0x4000) && !cur && window.__vc.on) { const lc = document.getElementById('lcard'); if (!(lc && getComputedStyle(lc).display !== 'none')) { window.__vc.foreign++; if (!window.__vc.ex) window.__vc.ex = (new Error().stack || '').split('\n').slice(2, 9).map((x) => x.trim().replace(/\(?http[^)]*\/([^/)]*)\)?/, '$1')).join(' < '); } } return cl.apply(this, arguments); }; }
  window.requestAnimationFrame = function (cb) { if (cb === cur) cb.__main = true; return raf0(function (t) { cur = cb; try { return cb(t); } finally { cur = null; } }); }; };
(async () => {
  const srv = await serve(), base = 'http://127.0.0.1:' + srv.address().port + '/index.html?quality=' + TIER + '&film=1&cards=1';
  if (!CHROME) { console.log('FAIL no browser with H.264 (set CHROME)'); process.exit(1); }
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const open = async (block) => { const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); await ctx.addInitScript(INIT); const p = await ctx.newPage(); const errs = [], req = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/film\/opening/.test(m.text() + ((m.location() || {}).url || '')) && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); }); p.on('request', (r) => req.push(r.url())); p.on('response', (r) => { if (r.status() >= 400 && !(block && /film\/opening/.test(r.url()))) errs.push('HTTP ' + r.status() + ' ' + r.url().split('/').slice(3).join('/')); });
    if (block) await p.route('**/film/*.mp4', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(base, { timeout: 300000 }); await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && e.offsetParent && !e.disabled && window.__game; }, null, { timeout: 900000, polling: 500 });
    return { ctx, p, errs, req }; };
  const st = (p) => p.evaluate(() => { const g = window.__game, v = document.getElementById('filmVid'), c = document.getElementById('c'); return { state: g.state, t: g.introT(), vid: !!v && v.style.display !== 'none' && !!v.offsetParent, vt: v ? v.currentTime : -1, paused: v ? v.paused : null, src: v ? v.currentSrc : '', cvs: getComputedStyle(c).visibility, cap: document.getElementById('cineCap').textContent, music: g.musicCur ? g.musicCur() : null, job: !!document.getElementById('jobCard'), seen: g.save && g.save.seenIntro }; });
  const toBase = async (p, cap) => p.waitForFunction(() => { const g = window.__game, lc = document.getElementById('lcard'); return g.state === 'base' && !(lc && getComputedStyle(lc).display !== 'none'); }, null, { timeout: cap * 1000, polling: 250 }).then(() => true, () => false);
  const lines = await (async () => { const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'config.js'), 'utf8'); const m = /lines:\s*(\[\[[\s\S]*?\]\]),/.exec(src.slice(src.indexOf('opening: {'))); try { return eval(m[1]); } catch (e) { return []; } })();
  if (/[ABC]/.test(PARTS)) { const { ctx, p, errs, req } = await open(false);
    const pre = await p.evaluate(() => ({ vid: !!document.getElementById('filmVid'), filmInfo: window.__game.filmPrepInfo ? JSON.stringify(window.__game.filmPrepInfo()).slice(0, 200) : '' }));
    const filmGlb = req.filter((u) => /gloom_\w+_hi\.glb/.test(u)), mp4 = req.filter((u) => /film\/opening_/.test(u));
    line(pre.vid && filmGlb.length === 0 && mp4.length > 0 && mp4.every((u) => u.includes(TIER === 'low' ? 'opening_lo' : 'opening_hi')), `A loading page: video ready without the 3D film (film machine models fetched ${filmGlb.length}, video file ${mp4.length ? mp4[0].split('/').pop() : 'none'})`);
    await p.click('#enter'); const ok = await p.waitForFunction(() => { const v = document.getElementById('filmVid'); return v && !v.paused && v.currentTime > 0.5; }, null, { timeout: 120000 }).then(() => true, () => false);
    const s1 = await st(p); await p.waitForTimeout(3000); const s2 = await st(p);
    line(ok && s2.vt > s1.vt + 1 && s2.vid && s1.cvs === 'hidden' && s1.state === 'intro', `B video plays after Enter: clock ${s1.vt.toFixed(1)} -> ${s2.vt.toFixed(1)} s in 3 s, shown ${s2.vid}, 3D canvas ${s1.cvs}`);
    // captions on the video's clock: seek inside each line (setup), the game's own frame writes the caption
    let capOk = 0; for (const [a, z, tx] of lines) { await p.evaluate((x) => { document.getElementById('filmVid').currentTime = x; }, (a + z) / 2); await p.waitForFunction((x) => document.getElementById('cineCap').textContent === x, tx, { timeout: 20000 }).then(() => capOk++, () => {}); }
    line(capOk === lines.length, `B captions follow the video's clock: ${capOk} of ${lines.length} lines shown at their time`);
    line(s1.music === 'night', `B the night track in the street part (playing: ${s1.music})`);
    if (PARTS.includes('C')) { await p.evaluate(() => { const v = document.getElementById('filmVid'); v.currentTime = v.duration - 1.5; window.__vc.on = true; });
      const got = await toBase(p, 300); await p.waitForTimeout(4000); const s3 = await st(p), fo = await p.evaluate(() => window.__vc.foreign); if (fo) console.log('INFO redraw over the base: ' + await p.evaluate(() => window.__vc.ex));
      line(got && !s3.vid && s3.cvs === 'visible' && s3.job && s3.seen && fo === 0, `C video end: base after the home card ${got}, video gone ${!s3.vid}, 3D canvas ${s3.cvs}, job card ${s3.job}, opening marked seen ${s3.seen}, redraws over the base ${fo}`); }
    line(errs.length === 0, `A-C page errors ${errs.length}${errs[0] ? ': ' + errs[0] : ''}`); await ctx.close(); }
  if (PARTS.includes('D')) { const { ctx, p, errs } = await open(false); await p.click('#enter'); await p.waitForFunction(() => { const v = document.getElementById('filmVid'); return v && v.currentTime > 10; }, null, { timeout: 180000 }).catch(() => {});
    await p.evaluate(() => { window.__vc.on = true; }); await p.click('#cineSkip').catch(() => p.keyboard.press('Space')); const got = await toBase(p, 300); await p.waitForTimeout(4000); const s = await st(p), fo = await p.evaluate(() => window.__vc.foreign);
    line(got && !s.vid && s.cvs === 'visible' && fo === 0 && errs.length === 0, `D Skip at 10 s: base ${got}, video gone ${!s.vid}, 3D canvas ${s.cvs}, redraws over the base ${fo}, page errors ${errs.length}${errs[0] ? ': ' + errs[0] : ''}`); await ctx.close(); }
  if (PARTS.includes('E')) { const { ctx, p, errs } = await open(true); await p.click('#enter');
    const ok = await p.waitForFunction(() => { const g = window.__game; return g.state === 'intro' && !document.getElementById('filmVid') && g.introT() > 1; }, null, { timeout: 900000, polling: 500 }).then(() => true, () => false);
    line(ok && errs.length === 0, `E video file missing: the 3D film plays instead (${ok ? 'film clock moving' : 'not seen: state ' + (await st(p)).state}), page errors ${errs.length}${errs[0] ? ': ' + errs[0] : ''}`); await ctx.close(); }
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
