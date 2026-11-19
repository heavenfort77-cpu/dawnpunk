// (R4 worker 5, item 1) local probe: the programs the first ride card builds, by material, and which could be shared.
// Usage: node tools/cardprogs.cjs [medium|high] [out.json]   (local SwiftShader; program keys do not depend on the GPU)
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const TIER = process.argv[2] || 'medium', OUT = process.argv[3] || '', DIST = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.json': 'application/json', '.ktx2': 'image/ktx2' };
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => { await new Promise((r) => srv.listen(0, r)); const URL0 = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  const p = await ctx.newPage(); p.setDefaultTimeout(1800000); p.on('pageerror', (e) => console.log('PAGEERR ' + String(e).slice(0, 200)));
  await p.goto(URL0 + '?quality=' + TIER + '&seed=777&cards=1&proglog=1'); await p.waitForFunction(() => window.__game && window.__game.enterBase && window.__splash && window.__splash.phase === 'ready');
  await p.evaluate(() => { const g = window.__game; g.enterBase(); if (g.homeCard) g.homeCard(); g.save.nights = 0; g.save.day = 1; });
  await p.waitForFunction(() => !window.__game.cardOn(), null, { polling: 500 }); const before = await p.evaluate(() => window.__game.programs(true).map((s) => s.split(' ')[0]));
  console.log('INFO programs before the ride card: ' + before.length);
  await p.evaluate(() => { document.getElementById('selRing').value = '0'; window.__game.startRun(); }); await p.waitForTimeout(500);
  await p.waitForFunction(() => !window.__game.cardOn(), null, { polling: 1000 });
  const r = await p.evaluate((before) => { const g = window.__game, old = new Set(before), all = g.programs(true), nu = all.filter((s) => !old.has(s.split(' ')[0])), ids = nu.map((s) => +s.split(' ')[0]), users = g.programUsers(ids);
    return { proof: g.cardInfo().proof, n: nu.length, progs: nu.map((s) => { const id = +s.split(' ')[0]; return { id, name: s.split(' ')[1], key: s.slice(s.indexOf(' ', s.indexOf(' ') + 1) + 1), users: users[id] || [] }; }) }; }, before);
  console.log('INFO ride card proof ' + JSON.stringify(r.proof).slice(0, 600)); console.log('INFO programs new in the ride card: ' + r.n);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(r, null, 1)); await b.close(); srv.close(); })().catch((e) => { console.log('ERR ' + e); process.exit(1); });
