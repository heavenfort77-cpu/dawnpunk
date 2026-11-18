// Hang hunt: counts frames for 4 s in the base before and after the click that holds the mouse, on the given quality; prints the longest frame. Usage: node tools/hangcheck.cjs <high|low>
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.route('**/marla_hi.glb', (r) => r.abort());
  await p.goto('file://' + __dirname + '/../dist/index.html?seed=777&fx=0&quality=' + process.argv[2]); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); window.__fr = []; let last = performance.now(); const f = (t) => { window.__fr.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); }); await p.waitForTimeout(3000);
  const meas = async (label) => { await p.evaluate(() => { window.__fr = []; }); const t0 = Date.now(); await p.waitForTimeout(4000); const r = await p.evaluate(() => { const a = window.__fr; return { n: a.length, max: Math.round(Math.max(0, ...a)), avg: Math.round(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)) }; }); console.log(label, 'frames', r.n, 'avg ms', r.avg, 'longest ms', r.max, 'wall s', ((Date.now() - t0) / 1000).toFixed(1)); };
  await meas('before click:'); const t1 = Date.now(); await p.mouse.click(640, 300); console.log('click took s', ((Date.now() - t1) / 1000).toFixed(1)); await meas('after click: ');
  await b.close(); })();
