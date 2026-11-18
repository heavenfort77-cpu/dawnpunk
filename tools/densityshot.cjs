// DENSITY pass pictures and counts (desktop tier). Usage: node tools/densityshot.cjs <out_prefix> <0|1 density> <views, comma list> [page, default dist/index_single.html] [extra query]
// views: hfar:<i> (house i from about 5 m), hclose:<i> (2.3 m), hside:<i> (a side wall, 4 m), cfar:<i> (car i, 5 m), cclose:<i> (2.2 m, into the cabin), street (along the road), base, station, workshop, home, homein, count (no picture: numbers only)
// Writes <out_prefix>_<view>_d<0|1>.png and prints draw calls / triangles of one plain render (renderer.info and a WebGL-level count), plus scene totals for the street and the base.
const { chromium } = require('playwright'); const OUT = process.argv[2], DEN = process.argv[3] || '1', VIEWS = (process.argv[4] || 'hfar:0').split(','), PAGE = process.argv[5] || (__dirname + '/../dist/index_single.html'), XQ = process.argv[6] || '';
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=3072'] }); const errs = []; const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.addInitScript(() => { window.__glc = { on: false, calls: 0, tris: 0 }; const wrap = (proto) => { for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const o = proto[fn]; if (!o) continue;
    proto[fn] = function (...a) { const c = window.__glc; if (c.on) { c.calls++; let n = 0, k = 1; if (fn === 'drawArrays') n = a[2]; else if (fn === 'drawArraysInstanced') { n = a[2]; k = a[3]; } else if (fn === 'drawElements') n = a[1]; else { n = a[1]; k = a[4]; } if (a[0] === 4) c.tris += n / 3 * k; } return o.apply(this, a); }; } };
    if (window.WebGL2RenderingContext) wrap(WebGL2RenderingContext.prototype); if (window.WebGLRenderingContext) wrap(WebGLRenderingContext.prototype); });
  await p.goto('file://' + PAGE + '?quality=high&seed=777&density=' + DEN + (XQ ? '&' + XQ : ''), { timeout: 180000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
  const hide = async () => p.evaluate(() => { window.__noHands = true; for (const id of ['hud', 'marla', 'msg', 'mlook', 'bprompt', 'bq', 'bstat', 'hud2', 'devs']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
  const count = async (label) => { const r = await p.evaluate(() => { const g = window.__game; g.cam.updateMatrixWorld(); window.__glc.calls = 0; window.__glc.tris = 0; window.__glc.on = true; const calls = g.drawCalls(); window.__glc.on = false; return { calls, glCalls: window.__glc.calls, glTris: Math.round(window.__glc.tris) }; }); console.log(label, JSON.stringify(r)); return r; };
  const totals = async (label, which) => { const r = await p.evaluate((w) => { const g = window.__game, root = w === 'street' ? g.world && g.world.g : g.bview && g.bview.group; if (!root) return null; let tris = 0, meshes = 0, inst = 0; root.traverse((o) => { if (!o.isMesh || !o.visible) return; const geo = o.geometry, t = (geo.index ? geo.index.count : geo.attributes.position.count) / 3; meshes++; if (o.isInstancedMesh) { inst++; tris += t * o.count; } else tris += t; });
      const extra = w === 'street' ? g.world.houses.map((h) => h.userData.densityTris || 0) : (root.userData.densityB || {}); return { meshes, instanced: inst, tris: Math.round(tris), density: extra }; }, which); console.log(label, JSON.stringify(r)); };
  const shot = async (v) => { await p.waitForTimeout(4000); await p.screenshot({ path: OUT + '_' + v.replace(':', '') + '_d' + DEN + '.png', timeout: 300000 }); };
  let inTown = false, inBase = false;
  const goTown = async () => { if (inTown) return; await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForTimeout(8000); await hide(); inTown = true; inBase = false; console.log('cars', JSON.stringify(await p.evaluate(() => window.__game.run.cars.filter((q) => !q.ghost).map((c, i) => i + ':' + c.kind + '/' + c.cond)))); };
  const goBase = async () => { if (inBase) return; await p.evaluate(() => { window.__game.enterBase(); }); await p.waitForTimeout(8000); await hide(); inBase = true; inTown = false; };
  const lookT = async (x, z, tx, tz, pitch, fov) => p.evaluate(([x, z, yaw, pt, fov]) => { const g = window.__game; g.setTown(x, z); g.setYaw(yaw); g.setPitch(pt); g.cam.fov = fov; g.cam.updateProjectionMatrix(); }, [x, z, Math.atan2(-(tx - x), -(tz - z)), pitch, fov]);
  const lookB = async (x, z, tx, tz, pitch, fov) => p.evaluate(([x, z, yaw, pt, fov]) => { const g = window.__game; g.setBase(x, z); g.setYaw(yaw); g.setPitch(pt); g.cam.fov = fov; g.cam.updateProjectionMatrix(); }, [x, z, Math.atan2(-(tx - x), -(tz - z)), pitch, fov]);
  for (const v of VIEWS) { const [kind, arg] = v.split(':'), i = +(arg || 0);
    if (['hfar', 'hclose', 'hside', 'cfar', 'cclose', 'cside', 'cside5', 'cdoor', 'street', 'count'].includes(kind)) { await goTown();
      if (kind === 'count') { await lookT(0, 0, 40, 0, 0.05, 70); await count('street-view'); await totals('street-total', 'street'); continue; }
      if (kind === 'street') { await lookT(-30, -2.5, 10, 6, 0.06, 62); await shot(v); await count('street-view'); continue; }
      if (kind[0] === 'h') { const H = await p.evaluate((i) => { const h = window.__game.run.houses[i], s = h.sim, d = s.breaches.find((q) => q.floor === 0 && q.type === 'door'); return { hx: h.x, hz: h.z, cs: h.cs, sn: h.sn, H: s.H, d: { x: d.x, z: d.z, nx: d.nx, nz: d.nz } }; }, i);
        const W = (lx, lz) => [H.hx + lx * H.cs - lz * H.sn, H.hz + lx * H.sn + lz * H.cs], d = H.d, sx = -d.nz, sz = d.nx, at = (a, b2, c2, e) => { const [x, z] = W(a, b2), [tx, tz] = W(c2, e); return [x, z, tx, tz]; };
        if (kind === 'hfar') { const [x, z, tx, tz] = at(d.x - d.nx * 5.6 + sx * 2.8, d.z - d.nz * 5.6 + sz * 2.8, d.x + sx * 0.4, d.z + sz * 0.4); await lookT(x, z, tx, tz, 0.16, 62); }
        else if (kind === 'hclose') { const [x, z, tx, tz] = at(d.x - d.nx * 2.3 - sx * 1.6, d.z - d.nz * 2.3 - sz * 1.6, d.x - sx * (H.H * 0.75) + d.nx * 0.2, d.z - sz * (H.H * 0.75) + d.nz * 0.2); await lookT(x, z, tx, tz, -0.22, 64); }
        else { const R = H.H + 0.2, c = [-d.nx * R + sx * R, -d.nz * R + sz * R]; const [x, z, tx, tz] = at(c[0] - d.nx * 0.5 + sx * 4.2, c[1] - d.nz * 0.5 + sz * 4.2, c[0] + d.nx * R, c[1] + d.nz * R); await lookT(x, z, tx, tz, 0.08, 62); }
        await shot(v); continue; }
      const c = await p.evaluate((i) => { const c = window.__game.run.cars.filter((q) => !q.ghost)[i]; return c && { x: c.x, z: c.z, yaw: c.yaw, cond: c.cond, kind: c.kind, dmg: c.dmg }; }, i); if (!c) continue;
      if (kind === 'cside' || kind === 'cside5' || kind === 'cdoor') { const op = await p.evaluate(([cx, cz]) => { let best = null, bd = 9; window.__game.world.g.traverse((o) => { if (o.userData.dens) { const v = o.getWorldPosition(o.position.clone()); const d = Math.hypot(v.x - cx, v.z - cz); if (d < bd) { bd = d; best = o.userData.dens.open; } } }); return best; }, [c.x, c.z]);
        const sd = kind === 'cdoor' ? (op || 1) : kind === 'cside5' ? -1 : (op ? -op : 1), nx = Math.cos(c.yaw), nz = -Math.sin(c.yaw), px = -nz * sd, pz = nx * sd, along = kind === 'cdoor' ? 0.9 : 0.1, dist = kind === 'cdoor' ? 2.7 : kind === 'cside5' ? 4.2 : 1.7, x = c.x + px * dist + nx * along, z = c.z + pz * dist + nz * along;
        console.log('car', i, 'open', op, 'view side', sd); await lookT(x, z, c.x + nx * along * 0.5, c.z + nz * along * 0.5, kind === 'cside5' ? -0.08 : -0.5, kind === 'cside5' ? 55 : 66); await shot(v); continue; }
      if (kind === 'cfar') { const a = c.yaw + 0.9, x = c.x + Math.sin(a) * 5.2, z = c.z + Math.cos(a) * 5.2; await lookT(x, z, c.x, c.z, -0.12, 55); }
      else { const a = c.yaw + 0.3, x = c.x + Math.sin(a) * 2.4, z = c.z + Math.cos(a) * 2.4; await lookT(x, z, c.x, c.z, -0.2, 64); }
      await shot(v); console.log('car', i, JSON.stringify(c)); continue; }
    await goBase(); const st = await p.evaluate(() => { const B = window.__game.B; return { s: B.STATIONS.storage, w: B.STATIONS.workshop, h: B.HOME }; });
    if (kind === 'base') { await lookB(0, 4, 0, -9, 0.08, 62); await shot(v); await count('base-view'); await totals('base-total', 'base'); }
    else if (kind === 'station') { await lookB(st.s.x + 2.8, st.s.z + 5.6, st.s.x - 0.2, st.s.z + 0.5, 0.14, 62); await shot(v); }
    else if (kind === 'workshop') { await lookB(st.w.x - 3.0, st.w.z + 5.6, st.w.x + 0.2, st.w.z + 0.5, 0.14, 62); await shot(v); }
    else if (kind === 'home') { await lookB(st.h.x + 3.2, st.h.z + 7.4, st.h.x, st.h.z + 0.6, 0.12, 62); await shot(v); }
    else if (kind === 'homein') { await lookB(st.h.x - 0.6, st.h.z + 1.6, st.h.x + 2.6, st.h.z - 0.4, -0.05, 70); await shot(v); }
    else if (kind === 'homein2') { await lookB(st.h.x + 1.3, st.h.z + 1.55, st.h.x - 2.4, st.h.z - 0.5, 0.02, 72); await shot(v); }
    else if (kind === 'homeback') { await lookB(st.h.x + 0.2, st.h.z + 1.6, st.h.x - 0.2, st.h.z - 1.8, 0.12, 72); await shot(v); }
    else if (kind === 'sclose') { await lookB(st.s.x - 1.2, st.s.z + 3.6, st.s.x - 2.6, st.s.z + 1.4, -0.08, 64); await shot(v); }
  }
  console.log('density', DEN, '|', errs.length ? [...new Set(errs)].join('|').slice(0, 600) : 'NO ERRORS'); await b.close(); })();
