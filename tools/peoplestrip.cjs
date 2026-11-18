// Frame strips of the base people's motion (before/after pictures for the people motion pass): Bram turning round to face the camera, and a recruit walking past.
// The game's clock is held still (window.__dtMax) and the base is stepped by hand at 1/60 s between pictures, so the frames are evenly spaced in game time.
// Usage: node tools/peoplestrip.cjs <page.html> <outdir> <prefix> [low|high] [frames] [seconds]  -> <outdir>/<prefix>_turn_<k>.png, <prefix>_walk_<k>.png
const { chromium } = require('playwright');
const path = require('path');
const page = path.resolve(process.argv[2]), out = process.argv[3], pre = process.argv[4] || 'x', tier = process.argv[5] === 'high' ? 'high' : 'low';
const N = +(process.argv[6] || 10), SEC = +(process.argv[7] || 1.5), per = Math.max(1, Math.round((SEC / (N - 1)) * 60));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + page + '?seed=777&fx=0&quality=' + tier); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 120000 });
  await p.evaluate(() => window.__game.enterBase());
  await p.waitForFunction(() => { const pk = window.__game.bview.peek && window.__game.bview.peek(); return pk && pk.chars.bram && pk.chars.bram.ready && pk.chars.bram.root.parent && pk.npcs.some((o) => o.ch && o.ch.ready && o.ch.root.parent === o.n); }, null, { timeout: 180000 });
  await p.waitForTimeout(1500); await p.evaluate(() => { window.__dtMax = 1e-6; });
  // pictures only: the HUD is hidden and the lens narrowed (fov degrees) so the person fills the frame
  const lens = (fov) => p.evaluate((fov) => { const st = document.getElementById('__ps') || document.head.appendChild(Object.assign(document.createElement('style'), { id: '__ps' })); st.textContent = 'body > *:not(canvas) { display: none !important; }'; const c = window.__game.cam; c.fov = fov; c.updateProjectionMatrix(); }, fov);
  const shot = (name) => p.screenshot({ path: out + '/' + pre + '_' + name + '.png' });
  const settle = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // the player (camera) at angle a round the point c, d m away, looking at it; the people react to window.__P (the player's spot for the step)
  const place = (c, a, d, look, pit = -0.1) => p.evaluate(([c, a, d, look, pit]) => { const g = window.__game, px = c[0] + Math.sin(a) * d, pz = c[1] + Math.cos(a) * d; g.setBase(px, pz); g.setYaw(Math.atan2(px - c[0], pz - c[1])); g.setPitch(pit); window.__P = look ? [px, pz] : [60, 60]; }, [c, a, d, look, pit]);
  const step = (n) => p.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) g.bview.update(1 / 60, window.__P[0], window.__P[1], 1.6); }, n);
  // Bram: you stand in front of him, he settles; you walk round behind him (well past his shoulder) and he turns to face you
  const bc = await p.evaluate(() => { const pk = window.__game.bview.peek(), o = pk.npcG.bram.p, r = pk.chars.bram.root; const q = r.getWorldQuaternion(r.quaternion.clone()); return [o.position.x, o.position.z, Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y))]; });
  await place(bc, bc[2], 4.0, true, -0.2); await step(300);
  const f2 = await p.evaluate(() => { const r = window.__game.bview.peek().chars.bram.root, q = r.getWorldQuaternion(r.quaternion.clone()); return Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y)); });
  await place(bc, f2 + 2.6, 4.0, true, -0.2);
  await lens(30); for (let k = 0; k < N; k++) { if (k) await step(per); await settle(); await shot('turn_' + k); }
  // a recruit walking: run the patrol until one is on a straight 3 m before its next corner, then watch it pass from 4.5 m to its side
  const w = await p.evaluate(() => { const g = window.__game, pk = g.bview.peek(), o = pk.npcs.find((x) => x.ch && x.ch.ready && x.ch.root.parent === x.n && x.p.role === 'gatherer') || pk.npcs.find((x) => x.ch && x.ch.ready && x.ch.root.parent === x.n);
    for (let i = 0; i < 8000; i++) { const t = o.wp[o.i], d = Math.hypot(t[0] - o.n.position.x, t[1] - o.n.position.z); if (d < 4.2 && d > 3.8 && i > 300) { const a = Math.atan2(t[0] - o.n.position.x, t[1] - o.n.position.z); return [o.n.position.x + Math.sin(a) * 0.9, o.n.position.z + Math.cos(a) * 0.9, a]; } g.bview.update(1 / 60, 60, 60, 1.6); } return null; });
  if (w) { const side = [1, -1].map((sg) => [sg, Math.hypot(w[0] + Math.sin(w[2] + sg * Math.PI / 2) * 4.5, w[1] + Math.cos(w[2] + sg * Math.PI / 2) * 4.5)]).sort((a, b) => a[1] - b[1])[0][0];
    await place([w[0], w[1]], w[2] + side * Math.PI / 2, 4.5, false, -0.18); await lens(40); for (let k = 0; k < N; k++) { if (k) await step(per); await settle(); await shot('walk_' + k); } }
  console.log(errs.length ? 'ERRORS ' + errs.join('|').slice(0, 300) : 'NO ERRORS', w ? 'walker found' : 'no walker', 'frames', N, 'every', per, 'game frames'); await b.close();
})().catch((e) => { console.log('crashed', String(e).slice(0, 300)); process.exit(1); });
