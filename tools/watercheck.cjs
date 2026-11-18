// Base water check in the real page (src/basewater.js, src/baselife.js): walks across each footbridge with the base's own collision (bview.pushOut), tries to cross the stream
// everywhere else, checks the wheel turns, and that the houses, plots and set pieces are built. Usage: node tools/watercheck.cjs <low|high> [page]
const { chromium } = require('playwright'); const QL = process.argv[2] || 'low', PAGE = process.argv[3] || (__dirname + '/../dist/index_single.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=3072'] }); const errs = [], res = [];
  const p = await b.newPage({ viewport: QL === 'low' ? { width: 915, height: 412 } : { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(String(e)));
  const check = (name, ok, info) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  await p.goto('file://' + PAGE + '?quality=' + QL + '&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 240000 });
  await p.evaluate(() => { localStorage.clear(); window.__game.enterBase(); }); await p.waitForTimeout(QL === 'low' ? 4000 : 9000);
  const R = await p.evaluate(() => { const g = window.__game, cfg = g.cfg, bv = g.bview, W = cfg.baseWater, out = { bridges: [], tried: 0, crossed: 0 };
    const rot = (b, lx, lz) => [b.x + lx * Math.cos(b.ry) + lz * Math.sin(b.ry), b.z - lx * Math.sin(b.ry) + lz * Math.cos(b.ry)];
    const walk = (x, z, tx, tz) => { for (let k = 0; k < 600; k++) { const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz); if (d < 0.08) break; x += dx / d * 0.07; z += dz / d * 0.07; [x, z] = bv.pushOut(x, z); } return Math.hypot(tx - x, tz - z); };
    // the bridges, as baselife lays them out (the deck runs along its own x)
    const near = (x, z) => { let best = null, bd = 1e9; const P = W.stream; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz); if (d < bd) { bd = d; const l = Math.sqrt(l2); best = { x: qx, z: qz, tx: dx / l, tz: dz / l, d }; } } return best; };
    for (const [bx, bz, len] of W.bridges) { const n = near(bx, bz), fr = { x: bx, z: bz, ry: Math.atan2(-n.tx, -n.tz) }, [ax, az] = rot(fr, -len / 2 - 0.8, 0), [cx, cz] = rot(fr, len / 2 + 0.8, 0);
      const there = walk(ax, az, cx, cz), back = walk(cx, cz, ax, az); const [ux, uz] = rot(fr, 0, 3.2), [vx, vz] = rot(fr, 0, -3.2); const beside = walk(ux + (ax - bx), uz + (az - bz), ux + (cx - bx), uz + (cz - bz)), beside2 = walk(vx + (ax - bx), vz + (az - bz), vx + (cx - bx), vz + (cz - bz));
      out.bridges.push({ there: +there.toFixed(2), back: +back.toFixed(2), beside: +beside.toFixed(2), beside2: +beside2.toFixed(2) }); }
    // along the stream every 1.5 m, away from the bridges and inside the walls: walk straight across
    const P = W.stream, bound = cfg.baseLife && cfg.baseLife.on ? cfg.baseLife.bound : cfg.base.bound;
    for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], l = Math.hypot(bx - ax, bz - az); for (let s = 0; s < l; s += 1.5) { const x = ax + (bx - ax) * s / l, z = az + (bz - az) * s / l; if (Math.hypot(x, z) > bound - 1.5 || W.bridges.some((q) => Math.hypot(x - q[0], z - q[1]) < q[3] / 2 + 1.6)) continue; const nx = -(bz - az) / l, nz = (bx - ax) / l; out.tried++; if (walk(x - nx * 2.4, z - nz * 2.4, x + nx * 2.4, z + nz * 2.4) < 1.0) out.crossed++; } }
    const pk = bv.peek(); out.a0 = pk.life && pk.life.wheel; out.cost = pk.life && pk.life.cost; out.plots = pk.life && pk.life.plots.map((q) => q.stage); return out; });
  R.bridges.forEach((q, i) => { check('footbridge ' + (i + 1) + ': you walk across it both ways', q.there < 0.15 && q.back < 0.15, q.there + ' / ' + q.back + ' m short'); check('footbridge ' + (i + 1) + ': 3.2 m up and down the stream from it you cannot cross', q.beside > 1.0 && q.beside2 > 1.0, q.beside + ' / ' + q.beside2 + ' m short'); });
  check('the stream stops you everywhere else (' + R.tried + ' crossings tried)', R.tried >= 10 && R.crossed === 0, R.crossed + ' got across');
  // CI Nov 18: the wheel turns by game time (CONFIG.baseWater.wheel.speed rad per game second), and on the GitHub runner one high-tier frame takes several seconds, so 8 s of wall
  // time gave about one frame (0.06 rad). Wait for WHEEL_GAME_SECS of the game's own time instead: each frame adds at most window.__dtMax (0.1 s for players), as src/main.js frame() counts it.
  // At the configured speed that is about 0.55 rad, well over the 0.2 rad the line asks for; a stopped or crawling wheel still fails.
  const WHEEL_GAME_SECS = 1.0;
  await p.waitForTimeout(2500); await p.evaluate((secs) => new Promise((res) => { let t = 0, last = performance.now(), done = false; const f = (now) => { t += Math.max(0, Math.min(window.__dtMax || 0.1, (now - last) / 1000)); last = now; if (done) return res(); if (t >= secs) done = true; requestAnimationFrame(f); }; requestAnimationFrame(f); }), WHEEL_GAME_SECS);
  const a1 = await p.evaluate(() => window.__game.bview.peek().life.wheel);
  check('the waterwheel turns', R.a0 !== null && Math.abs(a1 - R.a0) > 0.2, 'angle ' + (+R.a0).toFixed(2) + ' -> ' + (+a1).toFixed(2) + ' rad');
  check('houses, plots and set pieces built (' + (R.cost ? R.cost.tris + ' triangles in ' + R.cost.meshes + ' meshes' : 'none') + ')', !!R.cost && R.cost.meshes > 5 && R.plots.length === 6 && R.plots.every((s) => s === 'empty'), JSON.stringify(R.plots));
  // round 2: your view rides over a footbridge (rises up the ramp, over the arch, back down) with the game's own frames running; the water sound is heard by the stream, and 0 off the base
  const V2 = await p.evaluate(async () => { const g = window.__game, W = g.cfg.baseWater, [bx, bz, len] = W.bridges[0], P = W.stream; let best = null, bd = 1e9; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [cx, cz] = P[i + 1], dx = cx - ax, dz = cz - az, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((bx - ax) * dx + (bz - az) * dz) / l2)), d = Math.hypot(bx - ax - dx * t, bz - az - dz * t); if (d < bd) { bd = d; const l = Math.sqrt(l2); best = { tx: dx / l, tz: dz / l }; } }
    const nx = -best.tz, nz = best.tx, half = len / 2 + W.ramp + 1.2, ys = [], frame = () => new Promise((res) => requestAnimationFrame(() => res())); let gain = 0;
    for (let s = -half; s <= half + 1.5; s += 0.07) { g.setBase(bx + nx * s, bz + nz * s); await frame(); await frame(); ys.push(g.cam.position.y); if (Math.abs(s) < 0.1) gain = g.waterGain ? g.waterGain() : -1; }
    return { ys, gain }; });
  { const y = V2.ys, peak = Math.max(...y), steps = y.slice(1).map((v, i) => Math.abs(v - y[i])), up = y.indexOf(peak); check('your view rides over footbridge 1: up the ramp, over the arch (+' + (peak - 1.6).toFixed(2) + ' m) and back down, smoothly', peak - 1.6 > 0.3 && Math.abs(y[0] - 1.6) < 0.02 && Math.abs(y[y.length - 1] - 1.6) < 0.03 && up > 3 && up < y.length - 4 && Math.max(...steps) < 0.06, 'largest step between frames ' + Math.max(...steps).toFixed(3) + ' m'); }
  check('the water sound is heard on the bridge (level ' + (+V2.gain).toFixed(3) + ')', V2.gain > 0);
  { await p.evaluate(() => { const g = window.__game; document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForTimeout(3500); const off = await p.evaluate(() => window.__game.waterGain()); check('the water sound is 0 once you leave the base (on the street)', off === 0, 'level ' + off); }
  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED'); await b.close(); process.exit(res.every(Boolean) ? 0 : 1); })();
