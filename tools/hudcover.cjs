// share of the screen covered by visible HUD boxes in the base (day 1, after a short walk), phone and laptop sizes; prints PASS/FAIL against the targets and saves pictures.
// Usage: node tools/hudcover.cjs <out_prefix>   Targets: phone 15%, laptop 10%; nothing but short prompts in the centre third.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); let bad = 0;
  for (const [n, w, h, t, lim] of [['phone', 915, 412, true, 0.15], ['phone16x9', 740, 416, true, 0.15], ['laptop', 1366, 768, false, 0.10]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: t, isMobile: t }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
    await p.evaluate(() => window.__game.enterBase()); await p.waitForTimeout(2500);
    await p.keyboard.down('KeyW'); await p.waitForTimeout(400); await p.keyboard.up('KeyW'); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const W = innerWidth, H = innerHeight, cv = document.createElement('canvas'); cv.width = 200; cv.height = 100; const g = cv.getContext('2d'); let centre = [];
      for (const e of document.querySelectorAll('#hud [id]')) { const s = getComputedStyle(e), r = e.getBoundingClientRect(); if (s.display === 'none' || s.visibility === 'hidden' || r.width * r.height < 40 || e.id === 'cross' || e.id === 'zoneL' || e.id === 'zoneR') continue; let v = e; while (v && v.id !== 'hud') { if (getComputedStyle(v).display === 'none') break; v = v.parentElement; } if (v && v.id !== 'hud') continue;
        g.fillRect(r.left / W * 200, r.top / H * 100, r.width / W * 200, r.height / H * 100); const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2; if (cx > W / 3 && cx < 2 * W / 3 && cy > H / 3 && cy < 2 * H / 3 && r.height > 0.12 * H) centre.push(e.id); }
      const d = g.getImageData(0, 0, 200, 100).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) k++; return { cover: k / 20000, centre }; });
    await p.screenshot({ path: process.argv[2] + '_' + n + '.png' });
    const ok = r.cover <= lim && !r.centre.length && !errs.length; bad += !ok;
    console.log((ok ? 'PASS ' : 'FAIL ') + n + ' HUD covers ' + (100 * r.cover).toFixed(1) + '% (limit ' + 100 * lim + '%)' + (r.centre.length ? ' | big boxes in the centre: ' + r.centre : '') + (errs.length ? ' | ' + errs[0].slice(0, 200) : '')); await p.close(); }
  await b.close(); console.log(bad ? 'FAIL' : 'ALL PASS'); })();
