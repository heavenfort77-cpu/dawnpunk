// the left hand placing a device: eight moments of the movement on one sheet. Usage: node tools/throwshot.cjs <out.png>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_');
  const p = await b.newPage({ viewport: { width: 422, height: 195 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1500);
  const U = [0.02, 0.14, 0.24, 0.36, 0.46, 0.56, 0.66, 0.74, 0.84, 0.95];
  for (let i = 0; i < U.length; i++) { await p.evaluate((u) => { const h = window.__game.hands; window.__thr = setInterval(() => h.pose(u), 4); }, U[i]); await p.waitForTimeout(260); await p.screenshot({ path: T + i + '.png' }); await p.evaluate(() => clearInterval(window.__thr)); }
  console.log(errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await b.close();
  execSync(`python3 -c "
from PIL import Image
n=${U.length}; ims=[Image.open('${T}%d.png'%i) for i in range(n)]
w,h=ims[0].size; o=Image.new('RGB',(w*5,h*2)); [o.paste(im,(w*(i%5),h*(i//5))) for i,im in enumerate(ims)]; o.save('${out}')"`);
})();
