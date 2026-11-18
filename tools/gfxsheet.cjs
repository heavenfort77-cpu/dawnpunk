// six views on one sheet for before/after graphics work: street, house outside, inside by day, inside at night, night close-up, base. Usage: node tools/gfxsheet.cjs <out.png> [query]
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_');
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html' + (process.argv[3] || '')); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = false; window.__game.enterBase(); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__game.setBase(-6, 6); window.__game.setYaw(0.75); }); await p.waitForTimeout(900); await p.screenshot({ path: T + '5.png' });
  await p.evaluate(() => { document.getElementById('selRing').value = '2'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__game.setTown(-30, 1.2); window.__game.setYaw(-1.45); }); await p.waitForTimeout(500); await p.screenshot({ path: T + '0.png' });
  const info = await p.evaluate(() => { const r = window.__game.run; for (const h of r.houses) for (const q of h.sim.breaches) if (q.type === 'gap' && q.floor === 0) return { i: h.i, x: q.x, z: q.z, nx: q.nx, nz: q.nz, hx: h.x, hz: h.z, cs: h.cs, sn: h.sn }; });
  const ox = info.x - info.nx * 7 + info.nz * 3, oz = info.z - info.nz * 7 - info.nx * 3, wx = info.hx + ox * info.cs - oz * info.sn, wz = info.hz + ox * info.sn + oz * info.cs, tx = info.hx + info.x * info.cs - info.z * info.sn, tz = info.hz + info.x * info.sn + info.z * info.cs;
  await p.evaluate(([x, z, yaw]) => { window.__game.setTown(x, z); window.__game.setYaw(yaw); }, [wx, wz, Math.atan2(-(tx - wx), -(tz - wz))]); await p.waitForTimeout(500); await p.screenshot({ path: T + '1.png' });
  await p.evaluate(([i, x, z, yaw]) => { window.__game.enterHouse(i); const s = window.__game.sim; s.player.x = x; s.player.z = z; window.__game.setYaw(yaw); }, [info.i, info.x + info.nx * 4.5 + info.nz * 1.5, info.z + info.nz * 4.5 - info.nx * 1.5, Math.atan2(info.nx, info.nz) + 0.3]); await p.waitForTimeout(700); await p.screenshot({ path: T + '2.png' });
  await p.evaluate(() => { const g = window.__game; g.nightfall(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const g = window.__game, s = g.sim; s.player.energy = 60; s.player.x = 0; s.player.z = 0; for (const k of ['turbine', 'lance', 'panel']) g.doPlace(k); }); 
  for (let k = 0; k < 16; k++) { await p.waitForTimeout(1200); const n = await p.evaluate(() => { const s = window.__game.sim; if (!s) return 9; s.player.hp = 100; s.player.energy = 60; return s.gloom.filter((q) => q.phase !== 'approach').length; }); if (n >= 2) break; }
  await p.evaluate(() => { const g = window.__game, s = g.sim, P = s.player, q = s.gloom.slice().sort((a, c) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(c.x - P.x, c.z - P.z))[0]; if (q) g.setYaw(Math.atan2(-(q.x - P.x), -(q.z - P.z))); }); await p.waitForTimeout(400); await p.screenshot({ path: T + '3.png' });
  await p.evaluate(() => { const g = window.__game, s = g.sim, d = s.devices[0]; if (d) { const P = s.player; g.setYaw(Math.atan2(-(d.x - P.x), -(d.z - P.z))); g.setPitch && g.setPitch(-0.25); } }); await p.waitForTimeout(400); await p.screenshot({ path: T + '4.png' });
  console.log(errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await b.close();
  execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${T}%d.png'%i) for i in range(6)]
w,h=ims[0].size; o=Image.new('RGB',(w*2,h*3)); [o.paste(im,(w*(i%2),h*(i//2))) for i,im in enumerate(ims)]; o.save('${out}')"`);
})();
