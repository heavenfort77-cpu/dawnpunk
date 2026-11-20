// Nothing is drawn (or lit) away from where its node really is (owner Nov 21: "any other similar fault"; the phone probe found a merged machine's hit shapes lying where it was
// merged). PASS/FAIL lines only. Usage: node tools/stalecheck.cjs <low|medium|high> [abs page.html]
// The rule, for every node in the scene, in the base, the street, a night fight and the boss night, over many frames: a node's kept world matrix must equal its parent's true
// world x its own place (worked out here from the root down, ignoring every "skip the matrix pass" switch). A drawn node (visible, on the camera's layer) or a light that
// differs is a FAIL: it is on screen somewhere it is not. Shapes kept only for the aimed shot (hit layer) are put in place by the shot itself (tools/gloomhitcheck.cjs
// tests that); they are counted as INFO. A planted fault (a drawn copy moved with its matrix pass off) must be seen, or the scan itself FAILs.
const { chromium } = require('playwright');
(async () => {
  const tier = ['low', 'medium', 'high'].includes(process.argv[2]) ? process.argv[2] : 'low';
  const page = process.argv[3] || require('path').resolve(__dirname, '../dist/' + (tier === 'low' ? 'index.html' : 'index_single.html'));
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const out = [], errs = []; const add = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n);
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage(); p.setDefaultTimeout(600000); p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { window.__dtMax = 0.5; try { localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  await p.goto('file://' + page + '?quality=' + tier + '&seed=777', { timeout: 600000 }); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => {
    const G = window.__game; G.gloomSample('walker', 0, -400, 0, 0, false); const smp = window.__lastSample, scene = smp.parent; scene.remove(smp); const M4 = smp.matrix.constructor;
    const L = new M4(), T = new M4(); const stack = []; let HIST = new Map(), FIRST = true; const FA = (typeof G.cfg === 'function' ? G.cfg() : G.cfg).lag.farAnim, KEEP = Math.max(1, ((FA && FA.every) || 1) - 1);
    const same = (a, c) => { for (let i = 0; i < 16; i++) if (Math.abs(a[i] - c[i]) > 2e-3) return false; return true; };
    // one pass from the root: true world = parent's true world x (its own matrix if it keeps one by hand, else position / turn / size put together)
    window.__stale = (plantOnly) => { const bad = { drawn: 0, light: 0, hit: 0, other: 0, late: 0, nodes: 0, ex: {} }, H2 = new Map();
      const walk = (o, PT, vis) => { vis = vis && o.visible; let W; if (o === scene) W = new M4().copy(o.matrixWorld); else { if (o.matrixAutoUpdate) L.compose(o.position, o.quaternion, o.scale); else L.copy(o.matrix); W = (stack.pop() || new M4()).multiplyMatrices(PT, L); }
        // OWNER DECISION Nov 19 12:35 (CONFIG.lag.farAnim, approved): a far machine is posed and placed only every farAnim.every-th frame, and the game marks it (userData.stale).
        // Such a machine may be drawn where it truly stood at one of its last (every - 1) frames, nowhere else: its true places are kept per frame here and compared
        if (o.parent === scene && o.userData.kind && !plantOnly) { const h = (HIST.get(o) || []).slice(-KEEP); if (o.userData.stale && !same(o.matrixWorld.elements, W.elements) && (FIRST || h.some((m4) => same(o.matrixWorld.elements, m4)))) { bad.late++; h.push(W.elements.slice()); H2.set(o, h); W.copy(o.matrixWorld); } else { h.push(W.elements.slice()); H2.set(o, h); } }
        if (vis && o !== scene) { bad.nodes++; const a = o.matrixWorld.elements, c = W.elements; let d = 0; for (let i = 0; i < 16; i++) d = Math.max(d, Math.abs(a[i] - c[i]));
          if (d > 2e-3 && (!plantOnly || o.userData.__plant)) { const draws = (o.isMesh || o.isSprite || o.isPoints || o.isLine) && (o.layers.mask & 1) && !(o.material && o.material.visible === false), kind = o.isLight ? 'light' : draws ? 'drawn' : (o.isMesh ? 'hit' : 'other'); bad[kind]++;
            if (kind === 'drawn' || kind === 'light') { let r = o; while (r.parent && r.parent !== scene) r = r.parent; const key = (r.userData.kind || r.name || r.type) + ' > ' + (o.name || o.type) + ' [' + Object.keys(o.userData).slice(0, 4).join('+') + ']'; const e = bad.ex[key] || (bad.ex[key] = { n: 0, off: 0 }); e.n++; e.off = Math.max(e.off, +Math.hypot(a[12] - c[12], a[13] - c[13], a[14] - c[14]).toFixed(2)); } } }
        for (const ch of o.children) walk(ch, W, vis); if (o !== scene) stack.push(W); };
      walk(scene, null, true); if (!plantOnly) { HIST = H2; FIRST = false; } return bad; };
    // the worst of n frames, read after the game's own frame
    // (the kept places start empty at each scan, so on a scan's first frame a far machine marked late is taken as placed; from the second frame on it is compared)
    window.__staleRun = (n) => new Promise((res) => { HIST = new Map(); FIRST = true; const tot = { drawn: 0, light: 0, hit: 0, other: 0, late: 0, nodes: 0, frames: 0, ex: {} }; const f = () => { const r = window.__stale(false); tot.frames++; tot.nodes = Math.max(tot.nodes, r.nodes); for (const k of ['drawn', 'light', 'hit', 'other', 'late']) tot[k] = Math.max(tot[k], r[k]); for (const k in r.ex) if (!tot.ex[k] || tot.ex[k].off < r.ex[k].off) tot.ex[k] = r.ex[k]; if (tot.frames >= n) res(tot); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    window.__plant = () => new Promise((res) => { let src = null; scene.traverse((o) => { if (!src && o.isMesh && o.visible && (o.layers.mask & 1) && o.geometry && !o.isSkinnedMesh && !o.isInstancedMesh) src = o; }); if (!src) return res(-1);
      const c = new src.constructor(src.geometry, src.material); c.userData.__plant = true; scene.add(c); c.updateMatrixWorld(true); c.matrixWorldAutoUpdate = false; c.position.x += 5; requestAnimationFrame(() => requestAnimationFrame(() => { const r = window.__stale(true); scene.remove(c); res(r.drawn); })); });
  });
  const scan = async (name, frames) => { const r = await p.evaluate((n) => window.__staleRun(n), frames); const ex = Object.entries(r.ex).sort((x, y) => y[1].off - x[1].off).slice(0, 6).map(([k, v]) => k + ' x' + v.n + ' off ' + v.off + ' m');
    add(name + ': no drawn node or light is away from its true place (' + r.nodes + ' nodes, ' + r.frames + ' frames; drawn ' + r.drawn + ', lights ' + r.light + ')' + (ex.length ? ': ' + ex.join(' | ') : ''), r.drawn === 0 && r.light === 0 && r.nodes > 20);
    out.push('INFO ' + name + ': shot-only shapes left to the aimed shot ' + r.hit + ', other undrawn nodes ' + r.other + ', far machines drawn at a place of their last frame (owner-approved farAnim) ' + r.late); };
  // ---- base
  await p.evaluate(() => window.__game.enterBase()); await p.waitForFunction(() => window.__game.state === 'base' && !window.__game.cardOn()); await scan('base', 40);
  { const n = await p.evaluate(() => window.__plant()); add('the scan sees a planted fault (a drawn copy moved 5 m with its matrix pass off: seen ' + n + ')', n >= 1); }
  // ---- street
  await p.evaluate(() => { const g = window.__game; g.save.nights = 2; g.save.talkedMarla = true; document.getElementById('selRing').value = '0'; g.startRun(0); });
  await p.waitForFunction(() => window.__game.state === 'play' && !window.__game.cardOn()); await scan('street', 40);
  // ---- night fight: machines in the house, some culled outside, shots fired between the scans (the aimed shot moves the shot-only shapes)
  await p.evaluate(() => { const g = window.__game; g.enterHouse(0); g.nightfall(); }); await p.waitForFunction(() => window.__game.sim && window.__game.sim.phase === 'night' && !window.__game.cardOn());
  for (let k = 0; k < 4; k++) { await p.waitForFunction((k) => { const s = window.__game.sim; s.player.hp = 100; return s.done || s.gloom.length >= 2 + k; }, k, { polling: 250, timeout: 400000 }).catch(() => {});
    await p.evaluate(() => { const s = window.__game.sim; s.player.cd = 0; s.player.energy = 100; window.__game.fire(); }); await scan('night fight ' + (k + 1) + ' (' + (await p.evaluate(() => window.__game.sim.gloom.length)) + ' machines)', 30); }
  // ---- boss night
  const boss = await p.evaluate(() => { const g = window.__game; try { g.enterBase(); const sel = document.getElementById('selRing'); [...sel.options].forEach((o) => { o.disabled = false; }); sel.value = '4'; const s = g.save; s.nights = 5; s.trips = 5; s.nightsMet = 5; const k = Object.keys(s.up)[0]; s.up[k] = Math.max(1, s.up[k] || 0); g.startRun(); return true; } catch (e) { return String(e); } });
  if (boss === true) { await p.waitForFunction(() => window.__game.state === 'play' && !window.__game.cardOn()); await p.evaluate(() => window.__game.nightfall()); await p.waitForFunction(() => window.__game.sim && window.__game.sim.phase === 'night' && !window.__game.cardOn());
    const has = await p.waitForFunction(() => { const s = window.__game.sim; s.player.hp = 100; return !!s.boss; }, null, { timeout: 120000 }).then(() => true, () => false); add('the boss night starts with its boss', has);
    for (let k = 0; k < 3; k++) { await p.evaluate(() => { const s = window.__game.sim; s.player.hp = 100; s.player.cd = 0; s.player.energy = 100; window.__game.fire(); }); await scan('boss night ' + (k + 1), 30); await p.waitForFunction(() => { const s = window.__game.sim, t = (window.__t0 = window.__t0 || s.t); s.player.hp = 100; return s.done || s.t > t + 6; }, null, { polling: 250, timeout: 300000 }).catch(() => {}); await p.evaluate(() => { window.__t0 = 0; }); } }
  else add('the boss night could be started (' + boss + ')', false);
  add('no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), !errs.length);
  console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('FAIL')).length; console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
