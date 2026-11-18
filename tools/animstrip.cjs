// Frame strips for the animation pass (before/after pictures): the hands firing and throwing, Marla turning to you, Bram turning to you, a recruit walking round a corner.
// Animation is stepped by hand at 1/60 s between pictures (the game's own clock is held still with window.__dtMax), so the frames are evenly spaced in game time.
// Usage: node tools/animstrip.cjs <outdir> <prefix> [low|high]  -> <outdir>/<prefix>_hands_fire_0..7.png, _hands_throw_, _marla_turn_, _bram_turn_, _walk_
const { chromium } = require('playwright');
const out = process.argv[2], pre = process.argv[3] || 'x', tier = process.argv[4] === 'high' ? 'high' : 'low';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index_single.html?seed=777&fx=0&quality=' + tier); await p.waitForFunction(() => window.__game && window.__game.startRun);
  const shot = (name) => p.screenshot({ path: out + '/' + pre + '_' + name + '.png' });
  const settle = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // hands
  await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); g.endDay(); });
  await p.waitForTimeout(1500); await p.evaluate(() => { window.__dtMax = 1e-6; });
  const hstep = (n) => p.evaluate((n) => { const h = window.__game.hands; for (let i = 0; i < n; i++) h.update(1 / 60, false, 1, true, window.__game.yaw, 0); }, n);
  await hstep(120);
  await p.evaluate(() => window.__game.hands.fire());
  for (let k = 0; k < 8; k++) { await hstep(k ? 2 : 1); await settle(); await shot('hands_fire_' + k); }
  await hstep(90); await p.evaluate(() => window.__game.hands.throw());
  for (let k = 0; k < 8; k++) { await hstep(k ? 6 : 1); await settle(); await shot('hands_throw_' + k); }
  // base: Marla turning to you
  await p.evaluate(() => { window.__dtMax = 0; window.__game.enterBase(); });
  await p.waitForFunction(() => { const g = window.__game, pk = g.bview.peek && g.bview.peek(); return g.marla.ready && pk && pk.scoutG && g.marla.root.parent === pk.scoutG && pk.chars.bram && pk.chars.bram.ready; }, null, { timeout: 60000 });
  await p.waitForTimeout(1500); await p.evaluate(() => { window.__dtMax = 1e-6; });
  // stand the player (and camera) at angle `a` round the figure at `c`, d m away, looking at it; then step the base n frames
  const place = (c, a, d) => p.evaluate(([c, a, d]) => { const g = window.__game, px = c[0] + Math.sin(a) * d, pz = c[1] + Math.cos(a) * d; g.setBase(px, pz); g.setYaw(Math.atan2(px - c[0], pz - c[1])); g.setPitch(-0.12); window.__P = [px, pz]; }, [c, a, d]);
  const bstep = (n) => p.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) g.bview.update(1 / 60, window.__P[0], window.__P[1], 1.6); }, n);
  const mc = await p.evaluate(() => { const S = window.__game.bview.peek().scoutG; return [S.position.x, S.position.z, S.rotation.y]; });
  await place(mc, mc[2], 3.2); await bstep(240);
  const m2 = await p.evaluate(() => window.__game.bview.peek().scoutG.rotation.y);
  await place(mc, m2 + 1.9, 3.2);
  for (let k = 0; k < 8; k++) { await bstep(k ? 9 : 1); await settle(); await shot('marla_turn_' + k); }
  // Bram turning to you
  const bc = await p.evaluate(() => { const o = window.__game.bview.peek().npcG.bram.p; return [o.position.x, o.position.z]; });
  await place(bc, 0, 3.2); await bstep(240); await place(bc, 1.7, 3.2);
  for (let k = 0; k < 8; k++) { await bstep(k ? 9 : 1); await settle(); await shot('bram_turn_' + k); }
  // a recruit walking round a corner of the patrol: wait until it is 2.2 m from its next corner, then watch the corner from 5 m
  const corner = await p.evaluate(() => { const g = window.__game, pk = g.bview.peek(), o = pk.npcs.find((x) => x.ch && x.ch.ready && x.p.role === 'hunter') || pk.npcs.find((x) => x.ch && x.ch.ready);
    for (let i = 0; i < 6000; i++) { const t = o.wp[o.i], d = Math.hypot(t[0] - o.n.position.x, t[1] - o.n.position.z); if (d < 2.6 && d > 2.2) return [t[0], t[1]]; g.bview.update(1 / 60, 40, 40, 1.6); } return null; });
  if (corner) { await place([corner[0] * 0.75, corner[1] * 0.75], 0, 0.001); await p.evaluate(([cx, cz]) => { const g = window.__game, px = cx * 0.75, pz = cz * 0.75, d = Math.hypot(cx - px, cz - pz), k = 5 / d; g.setBase(cx - (cx - px) * k, cz - (cz - pz) * k); g.setYaw(Math.atan2(-(cx - px), -(cz - pz))); g.setPitch(-0.1); window.__P = [40, 40]; }, corner);
    for (let k = 0; k < 8; k++) { await bstep(k ? 8 : 1); await settle(); await shot('walk_' + k); } }
  console.log(errs.length ? 'ERRORS ' + errs.join('|').slice(0, 300) : 'NO ERRORS', corner ? 'corner ' + corner : 'no walker'); await b.close();
})();
