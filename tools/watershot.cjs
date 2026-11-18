// Pictures and counts of the base water, set pieces and houses (src/basewater.js, src/baselife.js). Works on old builds too (only enterBase / reBase / setBase / setYaw / setPitch are used).
// Usage: node tools/watershot.cjs <page> <low|high> <out_prefix> "<view>;<view>;..."
//   view = name@x,z,tx,tz,pitch,fov   (camera at x, z looking toward tx, tz; pitch rad; fov deg). A name starting with "count" takes no picture: it prints draw calls and triangles.
//   env WSETUP = JavaScript run once in the page after the first base visit (g = window.__game, s = its save), then the base is built again (e.g. add recruits, set the day).
//   env WWAIT = ms to wait before each picture (default 7000 desktop, 2500 phone).
const { chromium } = require('playwright'); const [PAGE, QL, OUT, VIEWS] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=3072'] }); const errs = [];
  const p = await b.newPage({ viewport: QL === 'low' ? { width: 915, height: 412 } : { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => { window.__dtMax = 0.1; window.__glc = { on: false, calls: 0, tris: 0 }; const wrap = (proto) => { for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const o = proto[fn]; if (!o) continue;
    proto[fn] = function (...a) { const c = window.__glc; if (c.on) { c.calls++; let n = 0, k = 1; if (fn === 'drawArrays') n = a[2]; else if (fn === 'drawArraysInstanced') { n = a[2]; k = a[3]; } else if (fn === 'drawElements') n = a[1]; else { n = a[1]; k = a[4]; } if (a[0] === 4) c.tris += n / 3 * k; } return o.apply(this, a); }; } };
    if (window.WebGL2RenderingContext) wrap(WebGL2RenderingContext.prototype); if (window.WebGLRenderingContext) wrap(WebGLRenderingContext.prototype); });
  await p.goto('file://' + PAGE + '?quality=' + QL + '&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 240000 });
  await p.evaluate(() => { localStorage.clear(); window.__game.enterBase(); }); await p.waitForTimeout(QL === 'low' ? 4000 : 9000);
  if (process.env.WSETUP) { await p.evaluate((code) => { const g = window.__game, s = g.save; new Function('g', 's', code)(g, s); g.reBase(); }, process.env.WSETUP); await p.waitForTimeout(QL === 'low' ? 4000 : 9000); }
  await p.waitForFunction(() => { const pk = window.__game.bview.peek && window.__game.bview.peek(); return pk && ['bram', 'pip'].every((k) => pk.chars[k] && pk.chars[k].ready && pk.chars[k].root.parent); }, null, { timeout: 300000 }).catch(() => console.log('WARN people models not ready'));
  await p.evaluate(() => { for (const id of ['msg', 'mlook', 'marla']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
  const look = (x, z, tx, tz, pitch, fov) => p.evaluate(([x, z, yaw, pt, fov]) => { const g = window.__game; g.setBase(x, z); g.setYaw(yaw); g.setPitch(pt); g.cam.fov = fov; g.cam.updateProjectionMatrix(); }, [x, z, Math.atan2(-(tx - x), -(tz - z)), pitch, fov]);
  const count = async (label) => { const r = await p.evaluate(() => { const g = window.__game; g.cam.updateMatrixWorld(); window.__glc.calls = 0; window.__glc.tris = 0; window.__glc.on = true; const calls = g.drawCalls(); window.__glc.on = false; let meshes = 0, tris = 0; g.bview.group.traverse((o) => { if (!o.isMesh || !o.visible) return; meshes++; const q = o.geometry, n = (q.index ? q.index.count : q.attributes.position.count) / 3; tris += o.isInstancedMesh ? n * o.count : n; }); const life = g.bview.peek && g.bview.peek().life; return { calls, glCalls: window.__glc.calls, glTris: Math.round(window.__glc.tris), baseMeshes: meshes, baseTris: Math.round(tris), life: life ? life.cost : null }; }); console.log(label, JSON.stringify(r)); };
  const wait = +(process.env.WWAIT || (QL === 'low' ? 2500 : 7000));
  for (const v of VIEWS.split(';').filter(Boolean)) { const [name, nums] = v.split('@'), [x, z, tx, tz, pitch, fov] = nums.split(',').map(Number); await look(x, z, tx, tz, pitch, fov);
    if (name.startsWith('count')) { await p.waitForTimeout(1500); await count(name); continue; }
    await p.waitForTimeout(wait); await p.screenshot({ path: OUT + '_' + name + '.png', timeout: 300000 }); console.log('shot', name); }
  console.log('errors', errs.length, errs.slice(0, 5).join(' | ')); await b.close(); })();
