// Nov 17 18:28 (owner): H is now HOLD to show the keys (and the full device bar); the hints switch lives in the pause menu (#bHints). Hints on/off (owner Nov 16: "let player have a choice to close the crowded portion"): H and the pause menu button hide the key legend, mouse hint, key badges and the dormant tag's second line; remembered. PASS/FAIL lines only.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], out = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=low'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => localStorage.removeItem('solardg.hints')); await p.reload(); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(800); await p.evaluate(() => window.__game.startRun(0)); await p.waitForTimeout(1500);
  const vis = (id) => p.evaluate((id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; }, id);
  // (owner Nov 20 23:27) the key legend is hidden from the start and only the small 'hold H: keys' chip shows; holding H shows the legend; the pause menu's
  // Hints button first brings the legend back (remembered), and pressed again turns every hint off
  await p.evaluate(() => localStorage.removeItem('solardg.keysAuto')); out.push(['the key legend is hidden by default and the "hold H" chip shows', !(await vis('dkeys')) && (await vis('hchip')) && /hold H/.test(await p.evaluate(() => document.getElementById('hchip').textContent))]);
  await p.keyboard.down('KeyH'); await p.waitForTimeout(300); const held = await vis('dkeys'); await p.keyboard.up('KeyH'); await p.waitForTimeout(300);
  out.push(['holding H shows the key legend, letting go hides it again (drill, Nov 17 18:28)', held && !(await vis('dkeys'))]);
  await p.evaluate(() => document.getElementById('bHints').click()); await p.waitForTimeout(200);
  out.push(['the pause menu Hints button brings the key legend back', await vis('dkeys')]);
  await p.evaluate(() => document.getElementById('bHints').click()); await p.waitForTimeout(200);
  out.push(['pressed again, the pause menu Hints button hides the key legend', !(await vis('dkeys'))]);
  out.push(['pause menu label reads Hints: off', (await p.evaluate(() => document.getElementById('bHints').textContent)) === 'Hints: off']);
  out.push(['key badges hidden', await p.evaluate(() => getComputedStyle(document.getElementById('bDusk'), '::after').display === 'none')]);
  await p.reload(); await p.waitForFunction(() => window.__game && window.__game.enterBase); await p.waitForTimeout(300);
  out.push(['off is remembered after a reload', await p.evaluate(() => document.body.classList.contains('nohints'))]);
  await p.evaluate(() => document.getElementById('bHints').click()); await p.waitForTimeout(200);
  out.push(['pause menu button turns hints back on', await p.evaluate(() => !document.body.classList.contains('nohints') && document.getElementById('bHints').textContent === 'Hints: on')]);
  await p.evaluate(() => { localStorage.removeItem('solardg.hints'); localStorage.removeItem('solardg.keysAuto'); });
  out.push(['no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), errs.length === 0]);
  let ok = true; for (const [t, v] of out) { if (!v) ok = false; console.log((v ? 'PASS ' : 'FAIL ') + t); } console.log(ok ? 'ALL PASS' : 'SOME FAILED'); await b.close();
})();
