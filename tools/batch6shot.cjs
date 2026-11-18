const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(6000);
  // the three starting people, wherever they are walking now
  const W = await p.evaluate(() => { const out = []; window.__game.bview.group.traverse((o) => { if (o.userData.blob) out.push([o.parent.position.x, o.parent.position.z, o.parent.rotation.y]); }); return out; });
  for (let i = 0; i < W.length; i++) { const [x, z, ry] = W[i], cx = x + Math.sin(ry) * 3.2 + 0.8, cz = z + Math.cos(ry) * 3.2; await p.evaluate(([cx, cz, x, z]) => { window.__game.setBase(cx, cz); window.__game.setYaw(Math.atan2(x - cx, z - cz) + Math.PI); }, [cx, cz, x, z]); await p.waitForTimeout(350); await p.screenshot({ path: S + 'rec' + i + '.png' }); }
  const V = [[9, -1, 3.14], [-6, -14, 0.5], [12, 17, 3.6]];
  for (let i = 0; i < V.length; i++) { await p.evaluate(([x, z, y]) => { window.__game.setBase(x, z); window.__game.setYaw(y); }, V[i]); await p.waitForTimeout(900); await p.screenshot({ path: S + 'bb' + i + '.png' }); }
  await p.evaluate(() => { document.getElementById('hud').style.visibility = ''; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(3000);
  const E = await p.evaluate(() => window.__game.run.houses.filter((h) => h.ext).map((h) => { const e = h.ext, ox = e.x - h.x, oz = e.z - h.z, d = Math.hypot(ox, oz); return [e.x, e.z, ox / d, oz / d]; }));
  for (let i = 0; i < Math.min(2, E.length); i++) { const [x, z, nx, nz] = E[i], cx = x + nx * 4.2 + nz * 1.2, cz = z + nz * 4.2 - nx * 1.2; await p.evaluate(([cx, cz, x, z]) => { window.__game.setTown(cx, cz); window.__game.setYaw(Math.atan2(x - cx, z - cz) + Math.PI); }, [cx, cz, x, z]); await p.waitForTimeout(900); await p.screenshot({ path: S + 'shed' + i + '.png' }); }
  console.log(errs.length ? errs.join('|') : 'NO ERRORS', W.length, E.length); await b.close();
})();
