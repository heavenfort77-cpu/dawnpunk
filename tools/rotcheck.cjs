// Rotate screen follows the real visible size (player: iPhone 16 Pro Max, Safari: "it tells me to rotate my phone, but rotating does not do anything"). PASS/FAIL lines only.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const out = [], errs = [];
  const D = devices['iPhone 15 Pro Max'] || devices['iPhone 14 Pro Max'];
  const ctx = await b.newContext({ ...D }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto((process.env.PAGE || 'file://' + __dirname + '/../dist/index.html')); await p.waitForFunction(() => window.__game && window.__game.enterBase); await p.waitForTimeout(600);
  const vis = (id) => p.evaluate((id) => { const e = document.getElementById(id); return getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, id);
  out.push(['iPhone upright: rotate screen shows', await vis('rot')]);
  out.push(['iPhone: the lock-sideways button is hidden (iPhones cannot lock)', !(await vis('rotFs'))]);
  out.push(['iPhone: "Play like this" is there', await vis('rotAny')]);
  await p.setViewportSize({ width: D.viewport.height, height: D.viewport.width }); await p.waitForTimeout(1200);
  out.push(['turned sideways: rotate screen goes away', !(await vis('rot'))]);
  await p.setViewportSize({ width: D.viewport.width, height: D.viewport.height }); await p.waitForTimeout(1200);
  out.push(['turned upright again: rotate screen comes back', await vis('rot')]);
  await p.tap('#rotAny'); await p.waitForTimeout(300); out.push(['"Play like this" hides it', !(await vis('rot'))]);
  await ctx.close();
  const c2 = await b.newContext({ ...devices['Pixel 7'] }); const p2 = await c2.newPage(); p2.on('pageerror', (e) => errs.push(String(e)));
  await p2.goto((process.env.PAGE || 'file://' + __dirname + '/../dist/index.html')); await p2.waitForFunction(() => window.__game && window.__game.enterBase); await p2.waitForTimeout(600);
  out.push(['Android upright: lock-sideways button shown', await p2.evaluate(() => getComputedStyle(document.getElementById('rotFs')).display !== 'none')]);
  const p3 = await b.newPage({ viewport: { width: 700, height: 900 } }); await p3.goto((process.env.PAGE || 'file://' + __dirname + '/../dist/index.html')); await p3.waitForFunction(() => window.__game && window.__game.enterBase); await p3.waitForTimeout(600);
  out.push(['desktop window taller than wide: no rotate screen (mouse users)', await p3.evaluate(() => getComputedStyle(document.getElementById('rot')).display === 'none')]);
  out.push(['no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), errs.length === 0]);
  let ok = true; for (const [t, v] of out) { if (!v) ok = false; console.log((v ? 'PASS ' : 'FAIL ') + t); } console.log(ok ? 'ALL PASS' : 'SOME FAILED'); await b.close();
})();
