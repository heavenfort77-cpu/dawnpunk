// the Walker close up, painted (left) and reshaped gritty (right), front and three-quarter. Usage: node tools/walkershot.cjs <out.png>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_');
  for (const [li, look] of [[0, 'painted'], [1, 'gritty']]) { const p = await b.newPage({ viewport: { width: 560, height: 420 } }); p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('file://' + __dirname + '/../dist/index.html?look=' + look); await p.waitForFunction(() => window.__game && window.__game.startRun);
    await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1600);
    await p.evaluate(() => { const g = window.__game; g.setTown(0, 0.5); g.setYaw(-Math.PI / 2); g.setPitch(0.03); g.gloomSample('walker', 3.3, 0.0, -Math.PI / 2, 3, false); g.gloomSample('walker', 4.4, 1.9, -Math.PI / 2 + 0.9, 5.2, false); }); await p.waitForTimeout(700); await p.screenshot({ path: T + li + '.png' }); await p.close(); }
  console.log(errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await b.close();
  execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${T}%d.png'%l) for l in range(2)]
w,h=ims[0].size; o=Image.new('RGB',(w*2,h)); [o.paste(ims[l],(w*l,0)) for l in range(2)]; o.save('${out}')"`);
})();
