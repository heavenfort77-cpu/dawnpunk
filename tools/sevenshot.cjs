// all seven machines close up on one sheet in the current look (or ?look=painted). Usage: node tools/sevenshot.cjs <out.png> [painted]
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_'), look = process.argv[3] || 'gritty';
  const p = await b.newPage({ viewport: { width: 480, height: 400 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?look=' + look); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1600);
  const K = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'], names = await p.evaluate(() => { const s = new Set(); window.__game.marla.root.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => s.add(m.name + ':' + m.type)); }); return [...s].join(', '); });
  for (let i = 0; i < K.length; i++) { const x = -34 + i * 9; await p.evaluate(([k, x]) => { const g = window.__game; g.setTown(x, 0.8); g.setYaw(-Math.PI / 2); g.setPitch(k === 'ticks' ? -0.25 : k === 'stilt' || k === 'warden' ? 0.12 : 0.03); g.gloomSample(k, x + (k === 'warden' || k === 'stilt' ? 4.6 : k === 'ticks' ? 2.6 : 3.4), 0.8, Math.PI / 2 + 0.5, 3, false); }, [K[i], x]); await p.waitForTimeout(600); await p.screenshot({ path: T + i + '.png' }); }
  console.log('tris ' + (await p.evaluate((K) => K.map((k) => k + ' ' + window.__game.gloomTris(k)).join(', '), K))); console.log('marla materials: ' + names); console.log(errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await b.close();
  execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${T}%d.png'%i) for i in range(7)]
w,h=ims[0].size; o=Image.new('RGB',(w*4,h*2)); [o.paste(im,(w*(i%4),h*(i//4))) for i,im in enumerate(ims)]; o.save('${out}')"`);
})();
