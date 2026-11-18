// Pictures of the two journals from one build: Marla's (32 trips, the newest line unread) at the page it opens on (wet ink, then dry 2.6 s later) and at page 1, and yours (two machines met) at pages 1 and 2.
// Usage: node tools/bookshot.cjs <page> <out_prefix> [sizes]   sizes like 1280x720,844x390,390x844 (phones get touch); writes <out_prefix>_<w>x<h>_<marla|marla1|player>.png
const { chromium } = require('playwright');
const PAGE = process.argv[2], OUT = process.argv[3], SIZES = (process.argv[4] || '1280x720,844x390,390x844').split(',').map((s) => s.split('x').map(Number));
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=3072'] });
  for (const [w, h] of SIZES) {
    const touch = w < 1000, ctx = await br.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 }), p = await ctx.newPage();
    await p.goto('file://' + PAGE + '?quality=low', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 240000 });
    await p.evaluate(() => localStorage.clear()); await p.click('#rotAny', { timeout: 1500 }).catch(() => {}); await p.click('#enter').catch(() => {});
    await p.waitForFunction(() => window.__game.save && window.__game.basePos, null, { timeout: 120000 }); await p.waitForTimeout(3000);
    await p.evaluate(() => document.fonts.ready);
    const g = (f) => p.evaluate(f), tag = OUT + '_' + w + 'x' + h;
    await g(() => { const G = window.__game; G.save.trips = 32; G.save.mjRead = 32; G.openPanel('mjournal'); }); await p.waitForTimeout(150);
    await p.screenshot({ path: tag + '_marla.png' });
    await p.waitForTimeout(2600); await p.screenshot({ path: tag + '_marla_dry.png' });
    await g(() => { const q = document.getElementById('qb'); q.scrollTop = 0; for (let i = 0; i < 40; i++) { const b = document.querySelector('#qb .bk__prev'); if (!b || b.classList.contains('is-off')) break; b.click(); } });
    await p.waitForTimeout(700); await p.screenshot({ path: tag + '_marla1.png' });
    await g(() => { document.getElementById('qclose').click(); const G = window.__game, K = Object.keys(window.CONFIG.gloom.kinds); G.save.met = { [K[0]]: 1, [K[1]]: 1 }; G.openPanel('journal'); }); await p.waitForTimeout(700);
    await p.screenshot({ path: tag + '_player.png' });
    await g(() => { const b = document.querySelector('#qb .bk__next'); if (b) b.click(); }); await p.waitForTimeout(700);
    await p.screenshot({ path: tag + '_player2.png' });
    console.log('shots', tag);
    await ctx.close();
  }
  await br.close();
})().catch((e) => { console.log('runner error', String(e).slice(0, 200)); process.exit(1); });
