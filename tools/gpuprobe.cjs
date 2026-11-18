// Real-GPU probe (owner Nov 19): on a GitHub macOS runner (Apple GPU through the VM), report which graphics chip WebGL really uses and the
// game's real frame rate in the day hub per tier. Linux runners only have a software GPU (SwiftShader), so their frame times are not real.
// Usage: node tools/gpuprobe.cjs [tiers, default high,low] [seconds per tier, default 10]
// Prints RENDERER (the WebGL chip string; "SwiftShader" or "llvmpipe" = software) and one FPS line per tier, plus draw calls and triangles.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const TIERS = (process.argv[2] || 'high,low').split(','), SECS = +(process.argv[3] || 10), DIST = path.resolve(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const ARGS = ['--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const URL0 = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  for (const headless of [true, false]) {
    let b;
    try { b = await chromium.launch({ headless, args: ARGS }); } catch (e) { console.log('LAUNCH headless=' + headless + ' failed: ' + String(e).slice(0, 160)); continue; }
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const p = await ctx.newPage(); p.setDefaultTimeout(600000);
    await p.addInitScript(() => { window.__fakeLock = true; try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
    await p.goto('about:blank');
    const gpu = await p.evaluate(() => { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return 'no WebGL'; const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) + ' | ' + gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
    console.log('RENDERER headless=' + headless + ': ' + gpu);
    for (const tier of TIERS) {
      const t0 = Date.now();
      await p.goto(URL0 + '?quality=' + tier + '&seed=777', { timeout: 600000 });
      await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 600000 });
      await p.evaluate(() => window.__game.enterBase());
      // let the high tier's models and textures arrive, then settle
      await p.waitForTimeout(15000);
      const r = await p.evaluate((secs) => new Promise((res) => {
        const ts = []; const t0 = performance.now();
        const f = (now) => { ts.push(now); if (now - t0 < secs * 1000) requestAnimationFrame(f); else {
          const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b); const avg = d.reduce((a, b) => a + b, 0) / d.length;
          const calls = window.__game && window.__game.drawCalls ? window.__game.drawCalls() : -1;
          res({ frames: d.length, fps: 1000 / avg, avg, p95: d[Math.floor(d.length * 0.95)], worst: d[d.length - 1], calls, tris: -1 });
        } };
        requestAnimationFrame(f);
      }), SECS);
      console.log('FPS headless=' + headless + ' tier=' + tier + ' hub: ' + r.fps.toFixed(1) + ' fps, avg ' + r.avg.toFixed(1) + ' ms, p95 ' + r.p95.toFixed(1) + ' ms, worst ' + r.worst.toFixed(1) + ' ms, frames ' + r.frames + ', calls ' + r.calls + ', tris ' + r.tris + ' (load+settle ' + Math.round((Date.now() - t0) / 1000) + ' s)');
    }
    await b.close();
  }
  srv.close(); process.exit(0);
})().catch((e) => { console.log('ERROR ' + String(e).slice(0, 300)); process.exit(1); });
