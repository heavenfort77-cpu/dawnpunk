// Screen check (Nov 20, after the Retina map fault: the checks ran at one or two window sizes at 1x only): the base by day at common desktop window sizes at 1x and
// 2x, and phone / tablet screens at 2x and 3x: no two interface boxes overlap, none is off screen, and the corner map is its own size.
// Usage: node tools/screencheck.cjs [low|high] (default low). Prints PASS / FAIL lines only, then ALL PASS or SOME FAILED. One headless browser, software renderer.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', URL0 = 'file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + tier;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function overlaps(p, ids) {
  return p.evaluate((ids) => { const vis = (e) => { if (!e) return null; for (let q = e; q && q !== document.body; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && (e.textContent.trim() || e.id === 'arc' || e.tagName === 'CANVAS' || e.querySelector('.ic') || e.tagName === 'BUTTON') ? r : null; };
    const L = ids.map((id) => [id, vis(document.querySelector(id))]).filter((q) => q[1]), bad = [];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const [na, a] = L[i], [nb, b] = L[j]; const ea = document.querySelector(na), eb = document.querySelector(nb); if (ea.contains(eb) || eb.contains(ea)) continue;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 2 && h > 2) bad.push(na + ' x ' + nb + ' (' + Math.round(w) + 'x' + Math.round(h) + ')'); }
    const off = L.filter(([n, r]) => r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map((q) => q[0] + ' off screen');
    return { n: L.length, bad: bad.concat(off) }; }, ids);
}
const DESK = ['#bstat', '#bq', '#hud #marla', '#mmap', '#bMus', '#bPause', '#bprompt', '#dkeys', '#bDusk', '#bLeave', '#aim', '#coins', '#slots', '#vit', '#clk'];
const TOUCH = ['#bstat', '#bq', '#hud #marla', '#mmap', '#bMus', '#bPause', '#bprompt', '#bDusk', '#bLeave', '#aim', '#coins', '#b0', '#b1', '#b2', '#b3', '#b4', '#b5', '#bEat', '#bFire', '#knob'];
const DESKS = [[1024, 640], [1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1080], [2560, 1440]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const open = async (vp, dpr, touch) => { const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: touch, hasTouch: touch }), p = await ctx.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript(() => { window.__dtMax = 0.6; window.__fakeLock = false; }); await p.goto(URL0, { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase);
    await p.evaluate(() => { const g = window.__game; g.enterBase(); const s = g.save; s.day = 2; s.nights = 1; s.nightsMet = 1; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.seenIntro = true; if (g.reBase) g.reBase(); });
    await p.waitForFunction(() => document.getElementById('mmap').classList.contains('on'), null, { timeout: 180000 }); await p.waitForTimeout(1200); return { ctx, p }; };
  const look = async (p, ids, where, size) => { const r = await overlaps(p, ids); ok(r.bad.length === 0 && r.n >= 3, 'base by day ' + where + ': nothing overlaps or leaves the screen (' + r.n + ' boxes)' + (r.bad.length ? ': ' + r.bad.join(', ') : ''));
    const m = await p.evaluate(() => { const q = document.getElementById('mmap').getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; }); ok(Math.abs(m[0] - size) <= 1 && Math.abs(m[1] - size) <= 1, 'base by day ' + where + ': corner map ' + m.join('x') + ' px (wanted ' + size + ')'); };
  for (const dpr of [1, 2]) { const { ctx, p } = await open({ width: 1280, height: 720 }, dpr, false); for (const [w, h] of DESKS) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(700); await look(p, DESK, 'desktop ' + w + 'x' + h + ' at ' + dpr + 'x', 150); } await ctx.close(); }
  for (const [w, h, dpr, nm] of [[844, 390, 3, 'phone'], [667, 375, 2, 'small phone'], [932, 430, 3, 'large phone'], [1024, 768, 2, 'tablet'], [1180, 820, 2, 'large tablet']]) { const { ctx, p } = await open({ width: w, height: h }, dpr, true);
    const fine = await p.evaluate(() => matchMedia('(pointer:fine)').matches); await look(p, TOUCH, nm + ' ' + w + 'x' + h + ' at ' + dpr + 'x', fine ? 150 : 96); await ctx.close(); }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 200)); process.exit(1); });
