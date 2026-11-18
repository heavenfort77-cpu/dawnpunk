// the opening cutscene sample: ten moments on one sheet, and a check that it ends in the bedroom with Marla at the door. Usage: node tools/introshot.cjs <out.png>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_'), res = [];
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startIntro);
  await p.click('#watch'); await p.waitForTimeout(2500);
  res.push(['the title button starts the opening (state ' + await p.evaluate(() => window.__game.state) + ')', await p.evaluate(() => window.__game.state) === 'intro']);
  const TS = [3, 6.5, 10.5, 14.5, 19.5, 23, 27.5, 30.5, 34.4, 37.8];
  for (let i = 0; i < TS.length; i++) { await p.evaluate((t) => window.__game.introAt(t), TS[i]); await p.waitForTimeout(i === 4 ? 4500 : 900); await p.evaluate((t) => window.__game.introAt(t), TS[i]); await p.waitForTimeout(350); await p.screenshot({ path: T + i + '.png' }); }
  await p.evaluate(() => window.__game.introAt(38.9)); await p.waitForTimeout(1500);
  const end = await p.evaluate(() => { const g = window.__game, s = g.save, sp = g.B.scoutPos(s); return { state: g.state, hint: sp.hint, msg: document.getElementById('msg').textContent, cine: document.getElementById('cine').style.display }; });
  await p.screenshot({ path: T + '10.png' });
  res.push(['it ends in play, in the base, with Marla ' + end.hint + ': ' + end.msg, end.state === 'base' && end.hint === 'at your door' && end.cine === 'none'], ['no page errors ' + errs.join('|').slice(0, 200), !errs.length]);
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startIntro); await p.click('#watch'); await p.waitForTimeout(1500); await p.click('#cineSkip'); await p.waitForTimeout(2500);
  res.push(['Skip jumps straight to waking up (state ' + await p.evaluate(() => window.__game.state) + ')', await p.evaluate(() => window.__game.state) === 'base']);
  let f = 0; for (const [n, ok] of res) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) f++; } console.log(f ? 'SOME FAILED' : 'ALL PASS'); await b.close();
  execSync(`python3 -c "
from PIL import Image
n=11; ims=[Image.open('${T}%d.png'%i).resize((422,195)) for i in range(n)]
w,h=ims[0].size; o=Image.new('RGB',(w*4,h*3)); [o.paste(im,(w*(i%4),h*(i//4))) for i,im in enumerate(ims)]; o.save('${out}')"`);
})();
