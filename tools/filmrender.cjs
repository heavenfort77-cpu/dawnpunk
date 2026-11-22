// Film render (owner Nov 22: the opening as a fixed video): the game's own 3D opening, recorded frame by frame at a fixed clock (?filmrec=1 page,
// window.__game.filmRec(1 / FPS) runs one film frame and draws it), each picture saved as a JPEG; then ffmpeg encodes the video files the game plays.
// Only the 3D picture is recorded: the captions, the black fades, the eyelids and the music stay live in the game, driven by the video's clock.
// Usage: node tools/filmrender.cjs <dist> <outDir> [width] [height] [tier]   env FPS (30), FROM/TO (film seconds: frames FROM*FPS .. TO*FPS-1 are saved), CHROME
// Prints 'FILMRENDER <frames> frames, <s> s of film, <ms> ms a frame' and writes <outDir>/f_00000.jpg ... plus <outDir>/render.json.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.resolve(process.argv[2] || 'dist'), OUT = path.resolve(process.argv[3] || 'film_frames'), W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720), TIER = process.argv[6] || 'high';
const FPS = +(process.env.FPS || 30), FROM = +(process.env.FROM || 0), TO = +(process.env.TO || 1e9);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.mp4': 'video/mp4' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await new Promise((ok) => { const s = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(0, '127.0.0.1', () => ok(s)); });
  const exe = process.env.CHROME && fs.existsSync(process.env.CHROME) ? process.env.CHROME : undefined;
  const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { window.__fakeLock = true; let s = 20261122; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?quality=' + TIER + '&film=1&cards=1&filmrec=1', { timeout: 300000 });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && e.offsetParent && !e.disabled && window.__game && window.__game.filmRec; }, null, { timeout: 1800000, polling: 1000 });
  await p.click('#enter');
  const t0 = Date.now(); let n = 0, saved = 0, last = 'hold', waits = 0, film = 0;
  for (;;) {
    // frames before this part's start are stepped without drawing (the same film state, much faster); frame k of the film is f_<k>.jpg in every part
    const r = await p.evaluate(([dt, skip]) => { const g = window.__game, st = g.filmRec(dt, skip); if (st !== 'drew') return { st }; const t = g.introT(); if (skip) return { st, t }; return { st, t, url: document.getElementById('c').toDataURL('image/jpeg', 0.95) }; }, [1 / FPS, n < FROM * FPS]);
    last = r.st;
    if (r.st === 'done' || r.st === 'off') break;
    if (r.st === 'hold' || r.st === 'wait') { waits++; if (r.st === 'hold') await p.waitForTimeout(100); if (waits > 200000) break; continue; }
    film = r.t; const k = n++; if (k >= TO * FPS) break;
    if (r.url) { fs.writeFileSync(path.join(OUT, 'f_' + String(k).padStart(5, '0') + '.jpg'), Buffer.from(r.url.split(',')[1], 'base64')); saved++; if (saved % 150 === 0) console.log(`INFO ${saved} frames, film ${r.t.toFixed(2)} s, ${((Date.now() - t0) / saved).toFixed(0)} ms a frame`); }
  }
  const ms = saved ? (Date.now() - t0) / saved : 0, size = await p.evaluate(() => { const c = document.getElementById('c'); return [c.width, c.height]; });
  fs.writeFileSync(path.join(OUT, 'render.json'), JSON.stringify({ frames: saved, fps: FPS, film, from: FROM, to: TO, canvas: size, tier: TIER, end: last, errors: errs }, null, 1));
  console.log(`FILMRENDER ${saved} frames, ${(saved / FPS).toFixed(2)} s of film (to ${film.toFixed(2)} s), ${ms.toFixed(0)} ms a frame, canvas ${size.join('x')}, end '${last}', page errors ${errs.length}${errs[0] ? ' / ' + errs[0] : ''}`);
  await b.close(); srv.close(); process.exit(saved ? 0 : 1);
})();
