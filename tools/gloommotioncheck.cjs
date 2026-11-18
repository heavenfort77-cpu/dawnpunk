// Uncanny Gloom motion check (CONFIG.gloomMotion, src/gloommotion.js). Usage: node tools/gloommotioncheck.cjs <low|high>   (prints PASS / FAIL lines and ALL PASS)
// Part 1, every kind, its own machine walked along the same path by the test clock (30 poses a second of test time, 14 s): the pose changes and is held (fewer poses than the old motion),
// freezes happen and end and nothing in the body moves while frozen, the head aims at the camera within a few degrees, no NaN, the machine stays where the path puts it; then a line is said and a gesture plays.
// Part 2, in the game at night, twice (motion on, then ?gm=0 = the old motion), the sim recorded after every fixed step: every Gloom's ground position and phase match step for step (same speed, same arrival),
// each machine stands where the sim says, captions still show, no page errors. Headless software renderer (swiftshader): proves the logic, says nothing about smoothness on a real screen.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', K = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'], out = [];
const ok = (name, pass) => out.push([name, !!pass]);
async function open(b, gm) {
  const p = await b.newPage({ viewport: { width: 640, height: 360 } }), errs = [];
  await p.addInitScript(() => { window.__dtMax = 1.5; }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=' + tier + '&seed=777' + (gm ? '' : '&gm=0'), { timeout: 180000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 180000 });
  return { p, errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---- part 1
  { const { p, errs } = await open(b, true); await p.evaluate(() => window.__game.enterBase()); await p.waitForTimeout(1500);
    for (const kind of K) {
      const drive = (on, mimic) => p.evaluate(([kind, on, mimic]) => {
        const G = window.__game, C = window.CONFIG.gloomMotion, was = [C.on, C.mimic.on]; C.on = on; C.mimic.on = mimic;
        G.gloomSample(kind, 0, -20, Math.PI); const o = window.__lastSample, M = o.userData.motion, cam = G.cam, fps = 30, dur = 14, speed = 1.2;
        const hs = new Set(M ? M.heads : []); const parts = []; o.traverse((x) => { if (x !== o && !hs.has(x)) parts.push(x); });
        const hash = () => { const v = new Float64Array(parts.length * 7); parts.forEach((x, i) => { x.quaternion.toArray(v, i * 7); x.position.toArray(v, i * 7 + 4); }); return v; }, same = (a, c) => { for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - c[i]) > 1e-9) return false; return true; };
        const body = o.children[0], b0 = body.position.clone(); let ms = 0, top = [], prev = hash(), changes = 0, frozenMoved = 0, aim = 0, nan = 0, drift = 0, offPath = 0;
        const fin = () => { let bad = 0; o.traverse((x) => { if (![x.position.x, x.position.y, x.position.z, x.quaternion.x, x.quaternion.y, x.quaternion.z, x.quaternion.w].every(Number.isFinite)) bad++; }); return bad; };
        for (let f = 0; f <= dur * fps; f++) {
          const t = 1000 + f / fps, z = -20 + speed * f / fps; o.position.set(0, 0, z); o.rotation.y = Math.PI; cam.position.set(2.5, 1.6, 0);
          const a0 = performance.now(); o.userData.anim(t, { x: 0, z }); const dms = performance.now() - a0; ms += dms; top.push(dms);
          const h = hash(); if (!same(h, prev)) { changes++; if (M && M.stats.frozen) frozenMoved++; } prev = h;
          if (M && on && f > fps) for (let i = 0; i < M.heads.length; i++) aim = Math.max(aim, M.aimError(i));
          if (f % 30 === 0) nan += fin();
          drift = Math.max(drift, body.position.distanceTo(b0)); if (Math.abs(o.position.z - z) > 1e-9 || o.position.x !== 0) offPath++;
        }
        const st = M ? { poses: M.stats.poses, freezes: M.stats.freezes, ends: M.stats.ends } : null;
        // a line is said: the gesture this kind copies from people plays for the line's 3 s
        let gest = null, gestMove = 0;
        if (on && mimic && M) { const hd = M.heads[0], tilt = () => { const q = new window.THREE_Q(); hd.updateWorldMatrix(true, false); hd.matrixWorld.decompose(new window.THREE_V3(), q, new window.THREE_V3()); return q; };
          const arms = []; o.traverse((x) => { if (x.userData && x.userData.fore) arms.push(x); }); const armQ = () => arms.map((a) => a.quaternion.clone());
          let t = 1000 + dur + 0.5, base = 0; for (let f = 0; f < 15; f++) { t += 1 / 30; o.userData.anim(t, { x: 0, z: -3.2 }); } base = tilt(); const a0 = armQ(); let ended = false;
          M.speak(3); gest = M.gesture; const g0 = M.gestureAt;
          for (let f = 0; f < 90; f++) { t += 1 / 30; cam.position.set(2.5, 1.6, 0); o.userData.anim(t, { x: 0, z: -3.2 }); gestMove = Math.max(gestMove, tilt().angleTo(base), ...armQ().map((q2, i) => q2.angleTo(a0[i]))); }
          for (let f = 0; f < 30; f++) { t += 1 / 30; o.userData.anim(t, { x: 0, z: -3.2 }); if (!M.gesture || M.gestureAt !== g0) ended = true; }
          if (!ended) gest += ' (still playing after the line)'; }
        o.parent.remove(o); C.on = was[0]; C.mimic.on = was[1];
        top.sort((a, c) => c - a); ms -= top.slice(0, 5).reduce((a, c) => a + c, 0);
        return { ms: ms / (dur * fps + 1 - 5), changes, frozenMoved, aim, nan, drift, offPath, st, frames: dur * fps + 1, gest, gestMove };
      }, [kind, on, mimic]);
      await p.evaluate(() => { const T = window.__game.cam.position.constructor; window.THREE_V3 = T; window.THREE_Q = window.__game.cam.quaternion.constructor; });
      // warm-up (the first runs of the code are slow while the browser compiles it), so the cost lines compare like with like
      if (kind === K[0]) { await drive(true, false); await drive(false, false); }
      const n = await drive(true, false), o = await drive(false, false), m = await drive(true, true), hz = await p.evaluate((k) => window.CONFIG.gloomMotion.kinds[k].hz, kind);
      ok(`${kind}: pose changes (new ${n.changes} of ${n.frames} frames, old ${o.changes})`, n.changes >= 3 * 14);
      if (hz) ok(`${kind}: pose is held between updates (stop-motion: ${n.changes} pose changes in 14 s, at most ${hz[1]} a second allowed; old ${o.changes})`, n.changes <= 14 * hz[1] * 1.2);
      else ok(`${kind}: skitters in bursts (moves most frames between freezes: ${n.changes} vs old ${o.changes})`, n.changes >= 0.4 * o.changes && n.changes < o.changes);
      ok(`${kind}: freezes happen (${n.st.freezes}) and end (${n.st.ends}); nothing in the body moved while frozen (${n.frozenMoved} frames)`, n.st.freezes >= 1 && n.st.ends >= 1 && n.frozenMoved === 0);
      ok(`${kind}: head / display tracks the camera within 5 degrees (worst ${n.aim.toFixed(2)})`, n.aim <= 5);
      ok(`${kind}: machine stays on its path (root off path ${n.offPath} frames, body offset at most ${n.drift.toFixed(3)} m) and no NaN (${n.nan + o.nan})`, n.offPath === 0 && n.drift < 0.05 && n.nan + o.nan === 0);
      ok(`${kind}: animation cost per machine per frame at most 0.01 ms above the old (5 slowest frames left out: a line drawn on the screen is a one-off; new ${n.ms.toFixed(4)} ms, old ${o.ms.toFixed(4)} ms; CPU of this machine, timer is coarse)`, n.ms <= o.ms + 0.01);
      ok(`${kind}: a line starts a copied gesture (${m.gest}, moved ${(m.gestMove * 57.3).toFixed(1)} degrees) that ends with the line`, m.gest && !/still/.test(m.gest) && m.gestMove > 0.1);
    }
    ok('part 1: no page errors' + (errs.length ? ' ' + errs[0].slice(0, 160) : ''), errs.length === 0); await p.close(); }
  // ---- part 2: the same seeded night with and without the motion
  const night = async (gm) => { const { p, errs } = await open(b, gm);
    await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '2'; window.__game.startRun(0); }); await p.waitForTimeout(2000);
    const h = await p.evaluate(() => { const r = window.__game.run, h = r.houses[0]; return [h.doorX, h.doorZ, h.row]; }); await p.evaluate(([x, z, row]) => window.__game.setTown(x, z - row * 0.4), h); await p.waitForTimeout(900);
    await p.evaluate(() => { window.__game.nightfall(); const G = window.__game; G.gloomSample('walker', 0, -500, 0); const sc = window.__lastSample.parent; sc.remove(window.__lastSample); window.__scene = sc; window.__log = [];
      const s = G.sim, st = s.step; s.step = (dt) => { st(dt); window.__log.push([+s.t.toFixed(3), s.gloom.map((g) => [g.id, g.kind, g.x, g.z, g.phase])]); }; });
    let caps = 0, misplaced = 0, checked = 0, nan = 0, freezes = 0, lines = 0, T = 0; const t0 = Date.now();
    while (Date.now() - t0 < 300000) { await p.waitForTimeout(1500);
      const r = await p.evaluate(() => { const G = window.__game, s = G.sim; if (!s) return null; s.player.hp = 100; let mis = 0, n = 0, nan = 0, fr = 0, li = 0;
        const roots = window.__scene.children.filter((o) => o.userData && o.userData.kind && o.userData.anim);
        for (const g of s.gloom) { const m = roots.find((o) => Math.abs(o.position.x - g.x) < 1e-6 && Math.abs(o.position.z - g.z) < 1e-6); n++; if (!m) mis++; }
        for (const o of roots) { if (o.userData.motion) { fr += o.userData.motion.stats.freezes; li += o.userData.motion.stats.lines; } o.traverse((x) => { if (x !== o && !Number.isFinite(x.quaternion.x + x.quaternion.w + x.position.x + x.position.y)) nan++; }); }
        return { t: s.t, caps: G.captions(), mis, n, nan, fr, li }; });
      if (!r) break; caps = Math.max(caps, r.caps); misplaced += r.mis; checked += r.n; nan += r.nan; freezes = Math.max(freezes, r.fr); lines = Math.max(lines, r.li); T = r.t; if (T >= 40) break; }
    const log = await p.evaluate(() => window.__log); await p.close(); return { log, caps, misplaced, checked, nan, freezes, lines, T, errs }; };
  const A = await night(true), B = await night(false);
  const byT = new Map(B.log.map(([t, g]) => [t, g])); let steps = 0, diff = 0; const kinds = {}, arrA = {}, arrB = {};
  for (const [t, gs] of A.log) { const g2 = byT.get(t); if (!g2) continue; steps++; const m2 = new Map(g2.map((g) => [g[0], g]));
    for (const g of gs) { const q = m2.get(g[0]); kinds[g[1]] = kinds[g[1]] || { n: new Set(), bad: 0 }; kinds[g[1]].n.add(g[0]); if (!q || q[2] !== g[2] || q[3] !== g[3] || q[4] !== g[4]) { diff++; kinds[g[1]].bad++; } } }
  for (const [L, arr] of [[A.log, arrA], [B.log, arrB]]) for (const [t, gs] of L) for (const g of gs) if (g[4] !== 'approach' && arr[g[0]] === undefined) arr[g[0]] = t;
  const arrIds = Object.keys(arrA).filter((id) => arrB[id] !== undefined), arrSame = arrIds.filter((id) => arrA[id] === arrB[id]).length;
  for (const k of Object.keys(kinds)) ok(`in game, ${k}: ground position and phase identical with and without the motion at every sim step (${kinds[k].n.size} machines)`, kinds[k].bad === 0);
  ok(`in game: ${steps} sim steps compared (${A.T.toFixed(1)} s of night), ${diff} differences; arrivals at an opening identical: ${arrSame} of ${arrIds.length}`, steps > 50 && diff === 0 && arrSame === arrIds.length);
  ok(`in game: every machine stands where the sim says (${A.checked} checks, ${A.misplaced} off)`, A.checked > 0 && A.misplaced === 0);
  ok(`in game: freezes happen in play (${A.freezes} so far), no NaN (${A.nan})`, A.freezes > 0 && A.nan === 0);
  ok(`in game: machines still say their lines with the motion on (${A.lines} lines started, captions on screen at once at most ${A.caps})`, A.lines > 0 && A.caps <= 1);
  ok('in game: no page errors' + ([...A.errs, ...B.errs].length ? ' ' + [...A.errs, ...B.errs][0].slice(0, 160) : ''), A.errs.length + B.errs.length === 0);
  let bad = 0; for (const [n, pass] of out) { console.log((pass ? 'PASS ' : 'FAIL ') + '[' + tier + '] ' + n); if (!pass) bad++; }
  console.log(bad ? 'SOME FAILED' : 'ALL PASS'); await b.close();
})();
