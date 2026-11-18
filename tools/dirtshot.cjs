// the inside of a house by day and at night, and an outside corner, to judge dirt, wood and house edges. Usage: node tools/dirtshot.cjs <out.png>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_');
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '1'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1600);
  const h = await p.evaluate(() => { const h = window.__game.run.houses[1]; return { x: h.x, z: h.z, H: h.H, row: h.row, cs: h.cs, sn: h.sn }; }); const cx = h.x + (h.H + 4.5), cz = h.z - h.row * (h.H + 4.5);
  await p.evaluate(([x, z, yaw]) => { const g = window.__game; g.setTown(x, z); g.setYaw(yaw); g.setPitch(0.12); }, [cx, cz, Math.atan2(-(h.x + h.H - cx), -(h.z - h.row * h.H - cz))]); await p.waitForTimeout(700); await p.screenshot({ path: T + '0.png' });
  await p.evaluate(() => { const g = window.__game; g.enterHouse(1); const s = g.sim; s.player.x = 0; s.player.z = 0; g.setYaw(0.6); g.setPitch(-0.1); }); await p.waitForTimeout(900); await p.screenshot({ path: T + '1.png' });
  await p.evaluate(() => { const g = window.__game; g.setYaw(2.6); g.setPitch(0.22); }); await p.waitForTimeout(600); await p.screenshot({ path: T + '2.png' });
  await p.evaluate(() => { const g = window.__game; g.nightfall(); }); await p.waitForTimeout(2500); await p.evaluate(() => { const g = window.__game, s = g.sim; s.gloom.length = 0; s.player.hp = 100; g.setYaw(0.6); g.setPitch(-0.1); }); await p.waitForTimeout(500); await p.screenshot({ path: T + '3.png' });
  console.log(errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await b.close();
  execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${T}%d.png'%i) for i in range(4)]
w,h=ims[0].size; o=Image.new('RGB',(w*2,h*2)); [o.paste(im,(w*(i%2),h*(i//2))) for i,im in enumerate(ims)]; o.save('${out}')"`); })();
