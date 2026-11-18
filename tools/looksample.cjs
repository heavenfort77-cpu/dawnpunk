// before/after sample of the look switch: the same cars and machines, painted (top) and gritty (bottom). Usage: node tools/looksample.cjs <out.png>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_');
  for (const [li, look] of [[0, 'painted'], [1, 'gritty']]) { const p = await b.newPage({ viewport: { width: 640, height: 360 } }); p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('file://' + __dirname + '/../dist/index.html?look=' + look); await p.waitForFunction(() => window.__game && window.__game.startRun);
    await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '1'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1800);
    const cars = await p.evaluate(() => window.__game.run.cars.map((c) => ({ x: c.x, z: c.z, yaw: c.yaw, cond: c.cond })));
    let k = 0; for (const cond of [0, 4]) { const c = cars.find((q) => q.cond === cond) || cars[0], a = c.yaw + 0.9, x = c.x + Math.sin(a) * 4.6, z = c.z + Math.cos(a) * 4.6; await p.evaluate(([x, z, yaw]) => { window.__game.setTown(x, z); window.__game.setYaw(yaw); window.__game.setPitch(-0.14); }, [x, z, Math.atan2(-(c.x - x), -(c.z - z))]); await p.waitForTimeout(500); await p.screenshot({ path: T + li + '_' + (k++) + '.png' }); }
    await p.evaluate(() => { const g = window.__game, r = g.run; g.setTown(0, 0.5); g.setYaw(-Math.PI / 2); g.setPitch(-0.05); g.gloomSample('walker', 4.2, -0.9, -Math.PI / 2, 3, false); g.gloomSample('hauler', 4.6, 1.2, -Math.PI / 2, 3, false); g.gloomSample('lurcher', 3.4, 2.4, -Math.PI / 2, 3, false); }); await p.waitForTimeout(700); await p.screenshot({ path: T + li + '_2.png' }); await p.close(); }
  console.log(errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await b.close();
  execSync(`python3 -c "
from PIL import Image
ims=[[Image.open('${T}%d_%d.png'%(l,i)) for i in range(3)] for l in range(2)]
w,h=ims[0][0].size; o=Image.new('RGB',(w*3,h*2)); [o.paste(ims[l][i],(w*i,h*l)) for l in range(2) for i in range(3)]; o.save('${out}')"`);
})();
