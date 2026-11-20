// Map size check (player report Nov 20, Retina Mac: the corner map filled the whole window): in the base the corner map (#mmap) is drawn at its own size
// (CONFIG.miniMap.px: desktop, phone) and inside the window, at 1x, 2x and 3x pixel density on desktop and at 2x and 3x on a phone; the pause menu's big map
// (#bmap) fits the window too. The other checks run at 1x only, where the fault did not show.
// Usage: node tools/mapdprcheck.cjs [low|high] (default low). Prints PASS / FAIL lines only, then ALL PASS or SOME FAILED. One headless browser, software renderer.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', URL0 = 'file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + tier;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const box = (p, id) => p.evaluate((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), W: innerWidth, H: innerHeight }; }, id);
const inside = (q) => q.l >= -1 && q.t >= -1 && q.r <= q.W + 1 && q.b <= q.H + 1;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const runs = [['desktop 1280x720', 1, false], ['desktop 1280x720', 2, false], ['desktop 1280x720', 3, false], ['phone 844x390', 2, true], ['phone 844x390', 3, true]];
  for (const [label, dpr, phone] of runs) {
    const vp = phone ? { width: 844, height: 390 } : { width: 1280, height: 720 };
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: phone, hasTouch: phone }), p = await ctx.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript(() => { window.__dtMax = 0.6; window.__fakeLock = false; });
    await p.goto(URL0, { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase);
    const px = await p.evaluate((phone) => { const g = window.__game; g.enterBase(); const s = g.save; s.day = 2; s.nights = 1; s.nightsMet = 1; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.seenIntro = true; if (g.reBase) g.reBase(); return null; }, phone);
    try { await p.waitForFunction(() => document.getElementById('mmap').classList.contains('on'), null, { timeout: 180000 }); } catch (e) { ok(false, label + ' at ' + dpr + 'x: the corner map never showed in the base'); await ctx.close(); continue; }
    await p.waitForTimeout(800);
    const want = await p.evaluate(() => { const M = window.__game.CONFIG ? window.__game.CONFIG.miniMap : null; return M ? M.px : null; }) || [150, 96];
    const fine = await p.evaluate(() => matchMedia('(pointer:fine)').matches), size = fine ? want[0] : want[1], q = await box(p, 'mmap');
    ok(Math.abs(q.w - size) <= 1 && Math.abs(q.h - size) <= 1 && inside(q), label + ' at ' + dpr + 'x: corner map ' + q.w + 'x' + q.h + ' px at ' + q.l + ',' + q.t + ' (wanted ' + size + 'x' + size + ', inside the ' + q.W + 'x' + q.H + ' window)');
    // the big map from the pause menu
    const opened = await p.evaluate(() => { const g = window.__game; if (g.setPause) g.setPause(true); const pm = document.getElementById('pMap'); if (!pm) return false; pm.click(); return document.getElementById('bigmap').style.display === 'flex'; });
    if (opened) { await p.waitForTimeout(300); const m = await box(p, 'bmap'), cx = (m.l + m.r) / 2;
      // laid out in the map panel: centred across the window, below the panel's title and above its key line (none of them overlapping)
      const lay = await p.evaluate(() => { const bm = document.getElementById('bmap').getBoundingClientRect(), o = []; for (const e of document.querySelectorAll('#bigmap h1, #bigmap p, #bigmap button, #bmapClose')) { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; const w = Math.min(r.right, bm.right) - Math.max(r.left, bm.left), h = Math.min(r.bottom, bm.bottom) - Math.max(r.top, bm.top); if (w > 2 && h > 2) o.push((e.id || e.tagName) + ' ' + Math.round(w) + 'x' + Math.round(h)); } return o; });
      ok(m.w > 100 && Math.abs(m.w - m.h) <= 1 && inside(m) && Math.abs(cx - m.W / 2) <= 2 && !lay.length, label + ' at ' + dpr + 'x: big map ' + m.w + 'x' + m.h + ' px at ' + m.l + ',' + m.t + ', centre ' + Math.round(cx) + ' of ' + m.W + ' (round, inside the window, centred, overlapping nothing in its panel' + (lay.length ? ': overlaps ' + lay.join(', ') : '') + ')');
      if (process.argv[3]) await p.screenshot({ path: process.argv[3] + '_' + dpr + (phone ? 'p' : 'd') + '.png' }); }
    else ok(false, label + ' at ' + dpr + 'x: the pause menu big map did not open');
    await ctx.close();
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 200)); process.exit(1); });
