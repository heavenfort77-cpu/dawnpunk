// Memory from night to night (Nov 23, owner's list item 14; rule 41: renderer.info.memory must not grow across levels). One page, one save, NIGHTS runs in a row
// as a player plays them: base -> ride (ring 0, 1, 2, ...) -> a house -> nightfall -> a real fight (the sim's own Gloom, killed by the game's own shots, so
// machines, scrap, effects and sounds are made and put back in their pools) -> back to the base. In the base after each night it records: GPU geometries
// and textures (renderer.info.memory), live shader programs, JS heap (Chrome's precise memory), scene nodes, and the count of objects under the scene.
// Counts do not depend on the GPU, so a small window on the software GPU is enough. PASS / FAIL: from night 2 on (night 1 builds what every later
// night reuses) geometries, textures and programs may not grow by more than SLACK, and the JS heap not by more than HEAP_MB after garbage collection.
// Usage: node tools/nightmem.cjs [medium|low] [nights, default 6]
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const TIER = process.argv[2] || 'medium', NIGHTS = +(process.argv[3] || 6), DIST = path.join(__dirname, '..', 'dist'), SLACK = 20, HEAP_MB = 15, FIGHT_S = +(process.env.FIGHT_S || 25);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => { await new Promise((r) => srv.listen(0, r)); const URL0 = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await b.newContext({ viewport: { width: 320, height: 180 } }); await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } window.__fakeLock = true; });
  const p = await ctx.newPage(); p.setDefaultTimeout(1800000); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL0 + '?quality=' + TIER + '&seed=777'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  const idle = (ms) => p.waitForFunction(() => !window.__game.cardOn || !window.__game.cardOn(), null, { polling: 500 }).then(() => p.waitForTimeout(ms));
  const loads = async () => { for (let k = 0; k < 600; k++) { const ok = await p.evaluate(() => { const q = window.__game.quality().hi, G = window.__gloomGlb || {}, B = window.__boss || {}; return q.ok + q.failed >= q.asked && Object.values(G).every((v) => v !== 'loading') && B.model !== 'loading'; }); if (ok) return; await p.waitForTimeout(1000); } };
  await p.evaluate(() => { const g = window.__game; g.enterBase(); const s = g.save; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.noteSeen = true; s.toldCharge = true; s.ringOpen = 6; s.loadout = ['turbine', 'lance', 'panel', 'mine']; s.met = { walker: true, lurcher: true, ticks: true, hauler: true, stilt: true }; });
  await idle(500); await loads();
  const snap = async (label) => { await p.evaluate(() => { if (window.gc) { window.gc(); window.gc(); } }); await p.waitForTimeout(300);
    return p.evaluate((label) => { const g = window.__game, R = g.renderer; let nodes = 0; g.scene.traverse(() => nodes++); const m = performance.memory || {};
      return { label, state: g.state, ...R.info.memory, programs: R.info.programs.length, heapMB: +((m.usedJSHeapSize || 0) / 1048576).toFixed(1), nodes, kids: g.scene.children.length }; }, label); };
  const rows = [await snap('base before night 1')];
  for (let n = 1; n <= NIGHTS; n++) { const ring = (n - 1) % 6;
    await p.evaluate((ring) => { document.getElementById('selRing').value = String(ring); window.__game.startRun(); }, ring); await p.waitForTimeout(300); await idle(500); await loads();
    await p.evaluate(() => { const g = window.__game, r = g.run; const hs = r.houses.filter((h) => h.i !== r.catHouse); g.enterHouse(hs[0].i); g.sim.player.energy = 60; }); await idle(300);
    await p.evaluate(() => window.__game.nightfall()); await p.waitForTimeout(300); await idle(300);
    // the fight: game time runs (frames drawn), the player cannot die, the game's own shots at the nearest machine, a device every few seconds
    const fight = await p.evaluate((secs) => new Promise((res) => { const g = window.__game, s = g.sim, P = s.player, k0 = s.killed, kinds = g.save.loadout; let last = performance.now(), tq = 0, tp = 0, slot = 0, gt = 0, frames = 0; window.__dtMax = 0.1;
      const loop = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; gt += dt; tq += dt; tp += dt; frames++; P.hp = Math.max(P.hp, 80); P.energy = Math.max(P.energy, 80);
        let t = null, bd = 1e9; for (const q of s.gloom) { if (q.floor !== P.floor) continue; const d = Math.hypot(q.x - P.x, q.z - P.z); if (d < bd) { bd = d; t = q; } }
        if (t) { const dx = t.x - P.x, dz = t.z - P.z; g.setYaw(Math.atan2(-dx, -dz)); g.setPitch(Math.max(-0.6, Math.min(0.6, Math.atan2(s.gloomY(t) + 0.9 - 1.6, Math.hypot(dx, dz))))); }
        if (tq >= 0.25) { tq = 0; g.doFire(false); } if (tp >= 5) { tp = 0; g.doPlace(kinds[slot++ % kinds.length]); }
        if (gt >= secs || s.done) res({ kills: s.killed - k0, frames, alive: s.gloom.length, t: +s.t.toFixed(1) }); else requestAnimationFrame(loop); };
      requestAnimationFrame(loop); }), FIGHT_S);
    await p.evaluate(() => window.__game.reBase()); await p.waitForTimeout(300); await idle(1000);
    const r = await snap('base after night ' + n + ' (ring index ' + ring + ')'); r.fight = fight; rows.push(r); console.log('INFO ' + JSON.stringify(r)); }
  const base = rows[1], last = rows[rows.length - 1];
  console.log('INFO first night ' + JSON.stringify(base) + '\nINFO last night ' + JSON.stringify(last));
  const ok = (k, lim) => last[k] <= base[k] + lim, line = (k, lim, unit) => (ok(k, lim) ? 'PASS' : 'FAIL') + ' ' + TIER + ': ' + k + ' after night ' + NIGHTS + ' ' + last[k] + unit + ' vs after night 1 ' + base[k] + unit + ' (allowed growth ' + lim + unit + '; nights: ' + rows.slice(1).map((q) => q[k]).join(', ') + ')';
  console.log(line('geometries', SLACK, '')); console.log(line('textures', SLACK, '')); console.log(line('programs', SLACK, '')); console.log(line('heapMB', HEAP_MB, ' MB'));
  console.log((rows.slice(1).every((q) => q.fight.kills > 0) ? 'PASS' : 'FAIL') + ' ' + TIER + ': every night had a real fight (kills ' + rows.slice(1).map((q) => q.fight.kills).join(', ') + ')');
  console.log((errs.length ? 'FAIL' : 'PASS') + ' ' + TIER + ': no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.close(); })().catch((e) => { console.log('FAIL nightmem crashed: ' + String(e).slice(0, 300)); process.exit(1); });
