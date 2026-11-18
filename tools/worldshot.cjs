const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); p.on('pageerror', e => errs.push(String(e)));
  const S = '/tmp/claude-0/-home-claude/f6d1c949-d179-5fcf-9724-bf18824fc0f0/scratchpad/';
  await p.goto('file:///home/claude/solard-g/dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '2'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__game.setTown(-30, 1.2); window.__game.setYaw(-1.45); }); await p.waitForTimeout(400); await p.screenshot({ path: S + 'v1.png' });
  const car = await p.evaluate(() => { const c = window.__game.run.cars.slice().sort((a, b) => b.rust - a.rust)[0]; return [c.x, c.z]; });
  await p.evaluate(([x, z]) => { window.__game.setTown(x - 4.2, z + 2.6); window.__game.setYaw(Math.atan2(4.2, 2.6) + Math.PI); }, car); await p.waitForTimeout(400); await p.screenshot({ path: S + 'v2.png' });
  const info = await p.evaluate(() => { const r = window.__game.run; for (const h of r.houses) for (const q of h.sim.breaches) if (q.type === 'gap' && q.floor === 0) return { i: h.i, x: q.x, z: q.z, nx: q.nx, nz: q.nz, hx: h.x, hz: h.z, cs: h.cs, sn: h.sn }; });
  const ox = info.x - info.nx * 7 + info.nz * 3, oz = info.z - info.nz * 7 - info.nx * 3, wx = info.hx + ox * info.cs - oz * info.sn, wz = info.hz + ox * info.sn + oz * info.cs, tx = info.hx + info.x * info.cs - info.z * info.sn, tz = info.hz + info.x * info.sn + info.z * info.cs;
  await p.evaluate(([x, z, yaw]) => { window.__game.setTown(x, z); window.__game.setYaw(yaw); }, [wx, wz, Math.atan2(-(tx - wx), -(tz - wz))]); await p.waitForTimeout(400); await p.screenshot({ path: S + 'v3.png' });
  await p.evaluate(([i, x, z, yaw]) => { window.__game.enterHouse(i); const s = window.__game.sim; s.player.x = x; s.player.z = z; window.__game.setYaw(yaw); }, [info.i, info.x + info.nx * 4.5 + info.nz * 1.5, info.z + info.nz * 4.5 - info.nx * 1.5, Math.atan2(info.nx, info.nz) + 0.3]); await p.waitForTimeout(500); await p.screenshot({ path: S + 'v4.png' });
  await p.evaluate(() => window.__game.nightfall()); await p.waitForTimeout(3000); await p.screenshot({ path: S + 'v5.png' });
  await p.evaluate(() => { window.__game.setYaw(window.__game.sim.player.yaw + 2.2); }); await p.waitForTimeout(300); await p.screenshot({ path: S + 'v6.png' });
  console.log(errs.length ? 'ERRORS ' + errs.slice(0, 3).join(' || ') : 'NO ERRORS'); await b.close();
})();
