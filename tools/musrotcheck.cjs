// Music switch and rotate screen (player comments Nov 16: "music interferes, a way to turn it off?"; "it tells me to rotate my phone, but rotating does not do anything").
// Desktop: the note button and M turn the music off and on, the pause menu label follows, the choice is remembered. Phone held upright: the rotate screen shows,
// its two buttons exist, "Play like this" hides it and the title menu works. Usage: node tools/musrotcheck.cjs ; prints PASS/FAIL lines only.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); const out = [], errs = [];
  const url = 'file://' + __dirname + '/../dist/index.html?quality=low';
  let p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  const vis = (pg, id) => pg.evaluate((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0; }, id);
  out.push(['desktop: note button visible on the title screen', await vis(p, 'bMus')]);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(1500);
  const m0 = await p.evaluate(() => window.__game.music().on); await p.keyboard.press('KeyM'); await p.waitForTimeout(300);
  const m1 = await p.evaluate(() => ({ on: window.__game.music().on, cls: document.getElementById('bMus').className, lab: document.getElementById('bMusic').textContent, saved: localStorage.getItem('solardg.music') }));
  out.push(['M turns the music off (' + m0 + ' -> ' + m1.on + ', button "' + m1.cls + '", menu "' + m1.lab + '", saved ' + m1.saved + ')', m0 === true && m1.on === false && /off/.test(m1.cls) && m1.lab === 'Music: off' && m1.saved === 'off']);
  await p.waitForTimeout(3000); const pl = await p.evaluate(() => window.__game.music().playing); out.push(['nothing is playing once off (' + pl.join(',') + ')', pl.length === 0]);
  await p.click('#bMus'); await p.waitForTimeout(300); const m2 = await p.evaluate(() => ({ on: window.__game.music().on, cls: document.getElementById('bMus').className }));
  out.push(['the note button turns it back on', m2.on === true && !/off/.test(m2.cls)]);
  await p.keyboard.press('KeyM'); await p.reload(); await p.waitForFunction(() => window.__game && window.__game.enterBase); await p.waitForTimeout(300);
  out.push(['off is remembered after a reload (button shows off)', /off/.test(await p.evaluate(() => document.getElementById('bMus').className))]);
  await p.evaluate(() => localStorage.removeItem('solardg.music')); await p.close();
  const ctx = await b.newContext({ ...devices['Pixel 7'] }); p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url); await p.waitForFunction(() => window.__game && window.__game.enterBase); await p.waitForTimeout(300);
  out.push(['phone upright: rotate screen shows', await vis(p, 'rot')]);
  out.push(['rotate screen has "Full screen, sideways" and "Play like this"', (await vis(p, 'rotFs')) && (await vis(p, 'rotAny'))]);
  await p.tap('#rotFs').catch(() => {}); await p.waitForTimeout(300);
  await p.tap('#rotAny'); await p.waitForTimeout(300); out.push(['"Play like this" hides the rotate screen', !(await vis(p, 'rot'))]);
  await p.tap('#enter').catch((e) => errs.push('enter: ' + e.message)); await p.waitForTimeout(1500); const st = await p.evaluate(() => window.__game.state);
  out.push(['the title menu works upright after that (state ' + st + ')', st === 'base']);
  out.push(['no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), errs.length === 0]);
  let ok = true; for (const [t, v] of out) { if (!v) ok = false; console.log((v ? 'PASS ' : 'FAIL ') + t); } console.log(ok ? 'ALL PASS' : 'SOME FAILED'); await b.close();
})();
