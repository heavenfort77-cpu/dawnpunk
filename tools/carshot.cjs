// one picture per abandoned car on a sheet, with its condition name. Usage: node tools/carshot.cjs <out.png>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_');
  const p = await b.newPage({ viewport: { width: 560, height: 330 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '1'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1800);
  const cars = await p.evaluate(() => window.__game.run.cars.map((c) => ({ x: c.x, z: c.z, yaw: c.yaw, cond: c.cond, name: window.__game.CONFIG ? '' : '' , rust: c.rust, dmg: c.dmg })));
  for (let i = 0; i < cars.length; i++) { const c = cars[i], a = c.yaw + 0.9, x = c.x + Math.sin(a) * 5.2, z = c.z + Math.cos(a) * 5.2; await p.evaluate(([x, z, yaw]) => { window.__game.setTown(x, z); window.__game.setYaw(yaw); window.__game.setPitch && window.__game.setPitch(-0.12); }, [x, z, Math.atan2(-(c.x - x), -(c.z - z))]); await p.waitForTimeout(450); await p.screenshot({ path: T + i + '.png' }); }
  console.log('cars ' + cars.length + ' conditions ' + cars.map((c) => c.cond).join(',') + ' | ' + (errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS')); await b.close();
  execSync(`python3 -c "
from PIL import Image
n=${cars.length}; ims=[Image.open('${T}%d.png'%i) for i in range(n)]
w,h=ims[0].size; o=Image.new('RGB',(w*3,h*((n+2)//3))); [o.paste(im,(w*(i%3),h*(i//3))) for i,im in enumerate(ims)]; o.save('${out}')"`);
})();
