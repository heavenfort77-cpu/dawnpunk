// desolate SAMPLE: each machine kind alone, same distance, one tile each (day). Usage: node tools/desokinds.cjs <out.png>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
const K = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'];
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 640, height: 480 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=high&seed=777&look=desolate'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  const T = process.argv[2].replace(/\.png$/, '_');
  for (let i = 0; i < K.length; i++) { const x = -60 + i * 9, d = K[i] === 'stilt' ? 4.0 : K[i] === 'warden' ? 3.6 : K[i] === 'ticks' ? 1.9 : 2.6, eye = K[i] === 'ticks' ? -0.35 : K[i] === 'stilt' ? 0.3 : 0.1;
    await p.evaluate(([k, x, d, pt]) => { const g = window.__game; g.gloomSample(k, x, 0.6, Math.PI, 3 + Math.random() * 2, false); g.setTown(x, 0.6 + d); g.setYaw(0); g.setPitch && g.setPitch(pt); g.hands && g.hands.g && (g.hands.g.visible = false); }, [K[i], x, d, eye]); await p.waitForTimeout(1800);
    await p.screenshot({ path: T + i + '.png' }); }
  await b.close(); execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${T}%d.png'%i) for i in range(${K.length})]; s=Image.new('RGB',(640*4,480*2),(20,20,20))
for i,im in enumerate(ims): s.paste(im,((i%4)*640,(i//4)*480))
s.save('${process.argv[2]}')"`); console.log(errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); })();
