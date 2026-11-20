// Engine check (Nov 20, Firefox and WebKit runs of the checks): what the browser gives the game. Prints the WebGL renderer, then the frame rate on the title, in
// the base by day and in a house by day (5 s each, by requestAnimationFrame), and page errors. PASS when the base and the house reach 30 fps and no page error.
// Usage: node tools/enginecheck.cjs [low|medium|high] (default medium). Prints INFO, PASS and FAIL lines, then ALL PASS or SOME FAILED.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'medium', URL0 = 'file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + tier;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(); p.setDefaultTimeout(300000); p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => { window.__fakeLock = false; });
  const t0 = Date.now(); await p.goto(URL0, { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 300000 });
  console.log('INFO page ready in ' + Math.round((Date.now() - t0) / 1000) + ' s; ' + await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); if (!c) return 'no WebGL2'; const d = c.getExtension('WEBGL_debug_renderer_info'); return 'renderer ' + (d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)) + ' | ' + navigator.userAgent; }));
  const fps = (secs) => p.evaluate((secs) => new Promise((ok) => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = (now) => { n++; worst = Math.max(worst, now - last); last = now; if (now - t0 < secs * 1000) requestAnimationFrame(f); else ok({ fps: Math.round(10 * n / ((now - t0) / 1000)) / 10, worst: Math.round(worst) }); }; requestAnimationFrame(f); }), secs);
  let f = await fps(5); console.log('INFO title: ' + f.fps + ' fps, worst frame ' + f.worst + ' ms');
  await p.evaluate(() => { const g = window.__game; g.enterBase(); const s = g.save; s.day = 2; s.nights = 1; s.nightsMet = 1; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.seenIntro = true; if (g.reBase) g.reBase(); });
  await p.waitForFunction(() => window.__game.state === 'base', null, { timeout: 300000 }); await p.waitForTimeout(3000);
  f = await fps(5); ok(f.fps >= 30, 'base by day: ' + f.fps + ' fps, worst frame ' + f.worst + ' ms (want 30+ here, a software renderer gives less)');
  await p.evaluate(() => { const g = window.__game; g.save.nights = 2; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); });
  await p.waitForFunction(() => window.__game.state === 'play', null, { timeout: 300000 }); await p.waitForTimeout(3000);
  f = await fps(5); ok(f.fps >= 30, 'house by day: ' + f.fps + ' fps, worst frame ' + f.worst + ' ms');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 300)); process.exit(1); });
