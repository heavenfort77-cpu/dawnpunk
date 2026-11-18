// Desktop scenery pictures and counts (src/scenehi.js). Usage: node tools/scenevs.cjs <out_prefix> <base|street> <on|off> [views, comma list] [extra query]
// base views: base (the player's usual view on entering: (3, 7) looking down -z), garden (from the plaza toward the garden and the big tree), back (from the home toward the pond and the board)
// street views: wide (down the street, as streetvs), kerb (verge by house 0), night (down the street after nightfall from the nearest house door), nightwide (the wide view at night)
// Writes <out_prefix>_<view>_<on|off>.png and prints, per view, the draw calls and triangles of one whole frame counted at the WebGL calls (screen pass, picture-pass targets and shadows separately).
// NIGHTWAIT=<ms> in the environment: how long after nightfall the night views are taken (default 14000: early night, the sky still dusky).
// Software renderer (swiftshader): the counts are exact, the speed says nothing about a real graphics card.
const { chromium } = require('playwright'); const OUT = process.argv[2], WHERE = process.argv[3] || 'base', ON = (process.argv[4] || 'on') === 'on', VIEWS = (process.argv[5] || (WHERE === 'base' ? 'base' : 'wide')).split(','), XQ = process.argv[6] || '';
const COUNT = () => { const wrap = (gl) => { if (!gl || gl.__wrapped) return gl; gl.__wrapped = true; const S = (window.__glc = window.__glc || { fb: null, screen: { calls: 0, tris: 0 }, target: { calls: 0, tris: 0 } });
    const tri = (mode, n, inst) => (mode === gl.TRIANGLES ? n / 3 : mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN ? Math.max(0, n - 2) : 0) * (inst || 1);
    const bf = gl.bindFramebuffer.bind(gl); gl.bindFramebuffer = (t, f) => { if (t === gl.FRAMEBUFFER || t === gl.DRAW_FRAMEBUFFER) S.fb = f; return bf(t, f); };
    const add = (mode, n, inst) => { const b = S.fb ? S.target : S.screen; b.calls++; b.tris += tri(mode, n, inst); };
    for (const [k, ni, ii] of [['drawElements', 1, -1], ['drawArrays', 2, -1], ['drawElementsInstanced', 1, 4], ['drawArraysInstanced', 2, 3]]) { const f = gl[k] && gl[k].bind(gl); if (!f) continue; gl[k] = (...a) => { add(a[0], a[ni], ii >= 0 ? a[ii] : 1); return f(...a); }; }
    return gl; };
  const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { const c = gc.call(this, t, o); return /webgl/.test(t) ? wrap(c) : c; }; };
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = []; const p = await b.newPage({ viewport: { width: 960, height: 600 } }); p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.addInitScript(COUNT);
  await p.goto('file://' + __dirname + '/../dist/index_single.html?quality=high&seed=777&scenery=' + (ON ? 1 : 0) + (XQ ? '&' + XQ : ''), { timeout: 180000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
  const hide = async () => p.evaluate(() => { for (const id of ['hud', 'marla', 'msg', 'bprompt', 'bq', 'bstat', 'mlook']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
  // one whole frame: counts between two animation frames
  const frame = async () => p.evaluate(() => new Promise((res) => requestAnimationFrame(() => { const S = window.__glc; S.screen = { calls: 0, tris: 0 }; S.target = { calls: 0, tris: 0 }; requestAnimationFrame(() => res({ screen: S.screen, target: S.target })); })));
  const shot = async (v) => { await p.waitForTimeout(4000); const c = await frame(); await p.screenshot({ path: OUT + '_' + v + '_' + (ON ? 'on' : 'off') + '.png', timeout: 300000 }); const st = await p.evaluate(() => window.__scenery ? window.__scenery.stat : null);
    console.log(v, ON ? 'on' : 'off', '| screen pass: calls', c.screen.calls, 'triangles', Math.round(c.screen.tris), '| picture-pass targets + shadows: calls', c.target.calls, 'triangles', Math.round(c.target.tris), '| scenery', JSON.stringify(st)); };
  if (WHERE === 'base') {
    await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); }); await hide(); await p.waitForFunction(() => window.__game.marla.ready, null, { timeout: 120000 }).catch(() => {});
    const look = async (x, z, tx, tz, pitch, fov) => { await p.evaluate(([x, z, yaw, pt, fov]) => { const g = window.__game; g.setBase(x, z); g.setYaw(yaw); g.setPitch(pt); g.cam.fov = fov; g.cam.updateProjectionMatrix(); }, [x, z, Math.atan2(-(tx - x), -(tz - z)), pitch, fov]); };
    if (VIEWS.includes('base')) await shot('base');
    if (VIEWS.includes('garden')) { await look(-2, 4, 13, -9, 0.0, 65); await shot('garden'); }
    if (VIEWS.includes('back')) { await look(1, -6, -6, 13, 0.0, 65); await shot('back'); }
  } else {
    await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); }); await hide(); await p.waitForTimeout(3000);
    const look = async (x, z, tx, tz, pitch, fov) => { await p.evaluate(([x, z, yaw, pt, fov]) => { const g = window.__game; g.setTown(x, z); g.setYaw(yaw); g.setPitch(pt); g.cam.fov = fov; g.cam.updateProjectionMatrix(); }, [x, z, Math.atan2(-(tx - x), -(tz - z)), pitch, fov]); };
    const h0 = await p.evaluate(() => { const h = window.__game.run.houses[0]; return { dx: h.doorX, z: h.z }; }), side = Math.sign(h0.z) || 1;
    if (VIEWS.includes('wide')) { await look(-19.2, 0, -40, 0, 0.04, 55); await shot('wide'); }
    if (VIEWS.includes('kerb')) { await look(h0.dx + 6, side * 2.2, h0.dx - 6, side * 3.9, -0.12, 60); await shot('kerb'); }
    if (VIEWS.includes('side')) { await look(h0.dx + 14, -side * 1.0, h0.dx + 2, side * 12, 0.02, 60); await shot('side'); }
    if (VIEWS.includes('nightwide') || VIEWS.includes('night')) { await p.evaluate(() => { const g = window.__game; g.setTown(-19.2, 0); g.nightfall(); }); await p.waitForTimeout(+(process.env.NIGHTWAIT || 14000));
      if (VIEWS.includes('nightwide')) { await p.evaluate(() => { const g = window.__game, s = g.sim; s.player.x = -19.2; s.player.z = 0; }).catch(() => {}); await look(-19.2, 0, -40, 0, 0.04, 55).catch(() => {}); await shot('nightwide'); }
      if (VIEWS.includes('night')) { const H = await p.evaluate(() => { const s = window.__game.sim, d = s.breaches.find((q) => q.floor === 0 && q.type === 'door') || s.breaches[0]; return d; });
        await p.evaluate(([x, z, yaw]) => { const g = window.__game, s = g.sim; s.player.x = x; s.player.z = z; g.setYaw(yaw); g.setPitch(0.02); g.cam.fov = 70; g.cam.updateProjectionMatrix(); }, [H.x + H.nx * 1.5, H.z + H.nz * 1.5, Math.atan2(H.nx, H.nz)]); await shot('night'); } }
  }
  console.log(WHERE, ON ? 'on' : 'off', '|', errs.length ? [...new Set(errs)].join('|').slice(0, 600) : 'NO ERRORS'); await b.close(); })();
