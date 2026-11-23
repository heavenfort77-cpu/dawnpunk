// Pixel proof for a change to how the desktop Gloom models are drawn (Nov 23: pistons merged into each model's one draw). Each kind (and THE BECKONER's model
// is not included: it is loaded on its night only) is posed at fixed times in a private scene (fixed lights, fixed camera, 512x512, no fog, no shadows) and read
// back; the pixels are written to <out>/<kind>_<t>.rgba with a JSON list of draw calls per pose. Run it on two builds and compare with tools/gloompixels.py.
// Usage: node tools/gloompixels.cjs <out dir> [dist dir, default dist]
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2], DIST = path.resolve(process.argv[3] || path.join(__dirname, '..', 'dist')); fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2' };
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => { await new Promise((r) => srv.listen(0, r));
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ viewport: { width: 320, height: 180 } });
  await ctx.addInitScript(() => { let s = 777; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  const p = await ctx.newPage(); p.setDefaultTimeout(900000); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?quality=medium&seed=777&gm=0'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => window.__game.enterBase());
  await p.waitForFunction(() => { const G = window.__gloomGlb || {}; return Object.keys(G).length >= 7 && Object.values(G).every((v) => v !== 'loading'); }, null, { polling: 1000 });
  const kinds = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'], times = [0.7, 1.9, 3.3], res = {};
  for (const kind of kinds) for (const t of times) {
    const r = await p.evaluate(([kind, t]) => { const g = window.__game, T = g.T3, R = g.renderer, N = performance.now; performance.now = () => 1000; try {
      { let sd = 4242; Math.random = () => { sd |= 0; sd = (sd + 0x6D2B79F5) | 0; let q = Math.imul(sd ^ (sd >>> 15), 1 | sd); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; const R1 = Math.random; let u = 9; Math.random = () => (/generateUUID/.test(new Error().stack) ? (u = (u * 16807) % 2147483647) / 2147483647 : R1()); } g.gloomSample(kind, 0, 0, 0.5, t); const o = window.__lastSample; g.scene.remove(o); o.userData.anim(t, { x: 0, z: 0.05 * t });
      const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x404040, 1.6)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(3, 5, 4); sc.add(dl); sc.add(o);
      const top = o.userData.top || 2.2, cam = new T.PerspectiveCamera(38, 1, 0.1, 60); cam.position.set(2.6, top * 0.75, 3.6); cam.lookAt(0, top * 0.48, 0); cam.updateMatrixWorld();
      sc.updateMatrixWorld(true); const rt = new T.WebGLRenderTarget(512, 512); const old = R.getRenderTarget(), sm = R.shadowMap.enabled; R.shadowMap.enabled = false; R.setRenderTarget(rt); R.setClearColor(0x203040, 1); R.clear(); R.info.reset(); const ar = R.info.autoReset; R.info.autoReset = false;
      R.render(sc, cam); const calls = R.info.render.calls, tris = R.info.render.triangles; R.info.autoReset = ar; const px = new Uint8Array(512 * 512 * 4); R.readRenderTargetPixels(rt, 0, 0, 512, 512, px); R.setRenderTarget(old); R.shadowMap.enabled = sm; rt.dispose();
      let s = ''; for (let i = 0; i < px.length; i += 8192) s += String.fromCharCode.apply(null, px.subarray(i, i + 8192)); return { calls, tris, b64: btoa(s) }; } finally { performance.now = N; } }, [kind, t]);
    fs.writeFileSync(path.join(OUT, kind + '_' + t + '.rgba'), Buffer.from(r.b64, 'base64')); res[kind + '_' + t] = { calls: r.calls, tris: r.tris }; console.log('INFO ' + kind + ' t=' + t + ': ' + r.calls + ' draws, ' + r.tris + ' triangles'); }
  fs.writeFileSync(path.join(OUT, 'draws.json'), JSON.stringify(res, null, 1)); console.log(errs.length ? 'FAIL page errors: ' + errs.slice(0, 3).join(' | ') : 'PASS no page errors'); await b.close(); srv.close(); })().catch((e) => { console.log('FAIL ' + String(e).slice(0, 300)); process.exit(1); });
