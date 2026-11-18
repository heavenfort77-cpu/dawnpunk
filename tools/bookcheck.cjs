// Journal books (src/book.js, CONFIG.book): opens your journal and Marla's (32 trips simulated = 33 lines) at 1280x720, 844x390 and 390x844, turns every page,
// reads every line (Marla's lines must equal src/base.js MARLA_JOURNAL + the closing line, word for word), checks no text runs off its page, the text size,
// ink-on-paper contrast, arrow keys and swipe turning, the fresh-ink line, and that the ribbon and Escape close the book.
// Usage: node tools/bookcheck.cjs [page] [log]   (PASS/FAIL lines only; each line is also appended to the log file when given)
const { chromium } = require('playwright'); const fs = require('fs');
const PAGE = process.argv[2] || (__dirname + '/../dist/index_single.html'), LOG = process.argv[3];
const SIZES = [[1280, 720, false], [844, 390, true], [390, 844, true]];
const say = (t, v) => { const l = (v ? 'PASS ' : 'FAIL ') + t; console.log(l); if (LOG) fs.appendFileSync(LOG, new Date().toISOString().slice(11, 19) + ' bookcheck ' + l + '\n'); };
// WCAG contrast ratio of two #rrggbb colours
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// every visible page: text inside its page, block bottoms inside the ruled area, smallest font size, lines read
const readPages = () => {
  const out = { lines: [], over: [], minFont: 99, pages: 0 };
  // finish any page-turn animation first: a page caught mid-turn measures smaller
  for (const pg of document.querySelectorAll('#qb .bk__page')) pg.getAnimations().forEach((an) => an.finish());
  for (const pg of document.querySelectorAll('#qb .bk__page.is-on')) {
    out.pages++;
    const pr = pg.getBoundingClientRect(), body = pg.querySelector('.bk__body'), br = body.getBoundingClientRect();
    for (const b of body.children) {
      // tol: a tilted line's box corner may rise or drop a few px into the blank band above or below the ruled lines (a quarter of a line at most)
      const r = b.getBoundingClientRect(), fs = parseFloat(getComputedStyle(b).fontSize), tol = parseFloat(getComputedStyle(b).lineHeight) / 4;
      out.minFont = Math.min(out.minFont, fs);
      b.querySelectorAll('span').forEach((s) => { out.minFont = Math.min(out.minFont, parseFloat(getComputedStyle(s).fontSize)); });
      if (b.offsetTop + b.offsetHeight > body.clientHeight + 0.5 || r.bottom > br.bottom + tol || r.top < br.top - tol || r.right > pr.right + 1 || r.left < pr.left - 1) out.over.push(b.textContent.slice(0, 40));
      const sk = b.querySelector('svg.bk__sketch');
      out.lines.push({ cls: (b.getAttribute('class') || ''), text: b.textContent, label: (b.querySelector('.bk__label') || {}).textContent || null, sk: sk ? Math.round(sk.getBoundingClientRect().width) : 0 });
    }
  }
  return out;
};

(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=3072'] });
  const errs = [];
  for (const [w, h, touch] of SIZES) {
    const tag = w + 'x' + h;
    const ctx = await br.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(tag + ' ' + String(e)));
    await p.goto('file://' + PAGE + '?quality=low', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 240000 });
    await p.evaluate(() => localStorage.clear()); await p.click('#rotAny', { timeout: 1500 }).catch(() => {}); await p.click('#enter').catch(() => {});
    await p.waitForFunction(() => window.__game.save && window.__game.basePos, null, { timeout: 120000 }); await p.waitForTimeout(2500);
    await p.evaluate(() => document.fonts.ready);
    const g = (f, a) => p.evaluate(f, a);
    const C = await g(() => window.CONFIG.book);
    // ---- Marla's journal, 32 trips: 33 lines, the newest unread
    // open it and read the newest line at once: it must start wet (fresh colour, blot at full strength)
    const wet0 = await g(() => { const G = window.__game; G.save.trips = 32; G.save.mjRead = 32; G.openPanel('mjournal'); const n = document.querySelector('#qb .bk__page.is-on .is-fresh'); return n && { color: getComputedStyle(n).color, blot: +getComputedStyle(n, '::after').opacity, dry: n.classList.contains('is-dry') }; });
    await p.waitForTimeout(400);
    const info0 = await g(() => ({ open: document.getElementById('qb').style.display === 'flex', spread: !!document.querySelector('#qb .bk--spread'), n: document.querySelectorAll('#qb .bk__page').length, fonts: [document.fonts.check('20px Caveat'), document.fonts.check('20px Kalam')] }));
    say(tag + ' Marla\'s journal opens as a book (' + info0.n + ' pages, ' + (info0.spread ? 'two-page spread' : 'one page at a time') + '), fonts loaded ' + info0.fonts, info0.open && info0.n > 1 && info0.fonts.every(Boolean));
    const lay = await g(() => { const r = document.querySelector('#qb .bk'), st = r.style; return { wide: r.classList.contains('bk--wide'), pw: st.getPropertyValue('--bk-pw'), lines: st.getPropertyValue('--bk-lines'), rule: st.getPropertyValue('--bk-rule') }; });
    // the page size and lines the first version (round 1 values: rule 30 / 29, ribbon 34, cover 7, head 1, foot 2, widest page 500) gives on this screen: unchanged on desktop and phone upright
    const old = await g(([r, two]) => { const q = document.getElementById('qb'), cs = getComputedStyle(q), W = q.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), H = q.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); return [Math.max(250, Math.min(500, Math.floor((W - 14) / (two ? 2 : 1)))) + 'px', String(Math.max(6, Math.min(22, Math.floor((H - 34 - 14) / r) - 3)))]; }, [tag === '1280x720' ? 30 : 29, tag === '1280x720']);
    const wantLay = { '1280x720': [true, false, old[0], old[1], '30px'], '844x390': [false, true, null, null, '25px'], '390x844': [false, false, old[0], old[1], '29px'] }[tag];
    say(tag + ' layout: ' + (info0.spread ? 'two-page spread' : lay.wide ? 'one wide page' : 'one page') + ', page ' + lay.pw + ', ' + lay.lines + ' lines of ' + lay.rule + (tag !== '844x390' ? ' (as before the sideways change)' : ''),
      info0.spread === wantLay[0] && lay.wide === wantLay[1] && (wantLay[2] === null || (lay.pw === wantLay[2] && lay.lines === wantLay[3])) && lay.rule === wantLay[4]);
    if (tag === '844x390') say(tag + ' Marla\'s 33 entries fit on ' + info0.n + ' pages (aim 4 to 5)', info0.n <= 5);
    const fresh0 = await g(() => [...document.querySelectorAll('#qb .bk__page.is-on .is-fresh')].map((n) => n.textContent));
    say(tag + ' it opens at the newest line, in fresh ink (' + JSON.stringify(fresh0.map((t) => t.slice(0, 20))) + ')', fresh0.length === 1 && /^Trip 32\./.test(fresh0[0]));
    const rgb = (hx) => 'rgb(' + [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)).join(', ') + ')';
    await p.waitForTimeout(C.ink.wet + C.ink.dry + 600);
    const dry0 = await g(() => { const n = document.querySelector('#qb .bk__page.is-on .is-fresh'); return { color: getComputedStyle(n).color, blot: +getComputedStyle(n, '::after').opacity, dry: n.classList.contains('is-dry') }; });
    say(tag + ' the fresh line starts wet (' + (wet0 && wet0.color) + ', blot ' + (wet0 && wet0.blot) + ') and dries to the ink colour in ' + (C.ink.wet + C.ink.dry) + ' ms (' + dry0.color + ', blot ' + dry0.blot + ')',
      wet0 && !wet0.dry && wet0.color === rgb(C.marla.fresh) && wet0.blot === 1 && dry0.dry && dry0.color === rgb(C.marla.ink) && Math.abs(dry0.blot - C.ink.blotDry) < 0.02);
    // back to the first page with the arrow key (desktop) or swipes (phones), then read forward page by page
    for (let i = 0; i < 40; i++) {
      const at0 = await g(() => document.querySelector('#qb .bk__page.is-on .bk__no').textContent);
      if (touch) { const r = await g(() => { const q = document.querySelector('#qb .bk__pages').getBoundingClientRect(); return [q.left + q.width * 0.3, q.top + q.height * 0.5, q.left + q.width * 0.8]; }); await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.mouse.move(r[2], r[1], { steps: 4 }); await p.mouse.up(); }
      else await p.keyboard.press('ArrowLeft');
      const at1 = await g(() => document.querySelector('#qb .bk__page.is-on .bk__no').textContent);
      if (at1 === at0) break;
    }
    const first = await g(() => document.querySelector('#qb .bk__page.is-on .bk__no').textContent);
    say(tag + ' ' + (touch ? 'swiping' : 'the left arrow key') + ' turns back to page 1 (now page ' + first + ')', first === '1');
    let all = [], over = [], minF = 99, turns = 0;
    for (let i = 0; i < 60; i++) {
      const r = await g(readPages); all = all.concat(r.lines); over = over.concat(r.over); minF = Math.min(minF, r.minFont);
      const moved = touch ? await g(() => { const b = document.querySelector('#qb .bk__next'); if (b.classList.contains('is-off')) return false; b.click(); return true; }) : await g(() => !document.querySelector('#qb .bk__next').classList.contains('is-off'));
      if (!moved) break;
      if (!touch) await p.keyboard.press('ArrowRight');
      turns++; await p.waitForTimeout(C.turnMs + 60);
    }
    const want = await g(() => { const B = window.__game.B; return B.marlaJournal({ trips: 32 }); });
    const entries = all.filter((l) => /bk__entry/.test(l.cls)), got = entries.map((l) => l.text.slice(l.label.length + 1));
    say(tag + ' Marla: read ' + entries.length + ' entries over ' + (turns + 1) + ' views; labels "First day.", "Trip 1." to "Trip 32."; every line word for word as in src/base.js, in order, line 30 and the closing lines included', entries.length === 33 && got.every((t, i) => t === want[i]) && want[29] === got[29] && entries.every((l, i) => l.label === (i === 0 ? 'First day.' : 'Trip ' + i + '.')));
    say(tag + ' Marla: title "Marla\'s journal" and the pencilled "(private)" note on page 1', all.some((l) => /bk__title/.test(l.cls) && l.text === 'Marla\'s journal') && all.some((l) => /bk__note/.test(l.cls) && l.text === '(private)'));
    say(tag + ' Marla: no text runs off its page (' + over.length + (over.length ? ': ' + over.slice(0, 3).join(' | ') : '') + ')', over.length === 0);
    // how big Caveat reads: its small letters against the menu font's (the body font) at the same size
    const xr = await g(() => { const c = document.createElement('canvas').getContext('2d'), xh = (f) => { c.font = '100px ' + f; return c.measureText('x').actualBoundingBoxAscent; }; return xh('Caveat') / xh(getComputedStyle(document.body).fontFamily); });
    say(tag + ' Marla: smallest text ' + minF + ' px, reads like ' + (minF * xr).toFixed(1) + ' px of the menu font (at least 15)', minF * xr >= 15);
    // Escape closes
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    const shut = await g(() => ({ shown: document.getElementById('qb').style.display }));
    say(tag + ' Escape closes Marla\'s journal', shut.shown === 'none');
    // reopened: nothing unread, so no fresh ink
    await g(() => window.__game.openPanel('mjournal')); await p.waitForTimeout(200);
    const fresh1 = await g(() => document.querySelectorAll('#qb .is-fresh').length);
    say(tag + ' read once, the fresh ink has dried (fresh lines ' + fresh1 + ')', fresh1 === 0);
    await g(() => document.getElementById('qclose').click()); await p.waitForTimeout(100);
    say(tag + ' the ribbon (Close) closes it', await g(() => document.getElementById('qb').style.display === 'none'));
    // ---- your journal: journal lines and the field guide, with two machines met
    await g(() => { const G = window.__game, K = Object.keys(window.CONFIG.gloom.kinds); G.save.met = { [K[0]]: 1, [K[1]]: 1 }; G.openPanel('journal'); });
    await p.waitForTimeout(400);
    const wantJ = await g(() => { const G = window.__game, cfg = window.CONFIG, K = cfg.gloom.kinds; return { lines: G.B.journalLines(cfg, G.save), dev: G.B.unlocked(cfg, G.save).map((k) => cfg.devices[k].name), met: Object.keys(K).filter((k) => G.save.met[k]).map((k) => K[k].name), unk: Object.keys(K).filter((k) => !G.save.met[k]).length }; });
    let jall = [], jover = [], jmin = 99, jt = 0;
    for (let i = 0; i < 40; i++) {
      const r = await g(readPages); jall = jall.concat(r.lines); jover = jover.concat(r.over); jmin = Math.min(jmin, r.minFont);
      if (!(await g(() => !document.querySelector('#qb .bk__next').classList.contains('is-off')))) break;
      await (touch ? g(() => document.querySelector('#qb .bk__next').click()) : p.keyboard.press('ArrowRight')); jt++; await p.waitForTimeout(C.turnMs + 60);
    }
    const lines = jall.filter((l) => /bk__line/.test(l.cls)).map((l) => l.text), terms = jall.filter((l) => /bk__term/.test(l.cls)).map((l) => l.text.trim()), unks = jall.filter((l) => /bk__unk/.test(l.cls));
    say(tag + ' your journal: ' + jall.length + ' blocks over ' + (jt + 1) + ' pages; every journal line there', wantJ.lines.every((l) => lines.includes(l)));
    say(tag + ' field guide: devices ' + JSON.stringify(wantJ.dev) + ' and met machines ' + JSON.stringify(wantJ.met) + ' as headings, ' + unks.length + ' unknown as a blank line', wantJ.dev.every((d) => terms.includes(d)) && wantJ.met.every((d) => terms.includes(d)) && unks.length === wantJ.unk && unks.every((u) => /^_+ not met yet$/.test(u.text)) && jall.some((l) => l.text === 'Field guide'));
    say(tag + ' your journal: no text runs off its page (' + jover.length + (jover.length ? ': ' + jover.slice(0, 3).join(' | ') : '') + ')', jover.length === 0);
    say(tag + ' your journal: smallest text ' + jmin + ' px (at least 15)', jmin >= 15);
    const sks = jall.filter((l) => /bk__term--sk/.test(l.cls)).map((l) => l.text.trim() + ' ' + l.sk), lay2 = await g(() => document.querySelector('#qb .bk').style.getPropertyValue('--bk-sketch'));
    say(tag + ' every carried device has its ink sketch, ' + lay2 + ' (' + sks.join(', ') + ')', sks.length === wantJ.dev.length && jall.filter((l) => /bk__term--sk/.test(l.cls)).every((l) => l.sk === parseInt(lay2, 10) && l.sk >= 40) && (tag !== '1280x720' || parseInt(lay2, 10) >= 48));
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    say(tag + ' Escape closes your journal', await g(() => document.getElementById('qb').style.display === 'none'));
    // the other panels are unchanged (no book look)
    await g(() => window.__game.openPanel('board')); await p.waitForTimeout(100);
    say(tag + ' the quest board panel is not a book', await g(() => !document.getElementById('qb').classList.contains('is-book') && !document.querySelector('#qb .bk') && !!document.getElementById('qclose')));
    await g(() => document.getElementById('qclose').click());
    await ctx.close();
  }
  // contrast of the ink on the paper and on the darkest gutter shade
  const cfg = (await import('file://' + __dirname + '/../src/config.js')).CONFIG.book;
  const pairs = [['player ink', cfg.player.ink], ['player fresh', cfg.player.fresh], ['Marla ink', cfg.marla.ink], ['Marla fresh', cfg.marla.fresh], ['pencil', cfg.pencil]];
  const worst = pairs.map(([n, c]) => [n, Math.min(ratio(c, cfg.paper.base), ratio(c, cfg.paper.gutter))]);
  say('contrast on paper and gutter (4.5:1 or more): ' + worst.map(([n, r]) => n + ' ' + r.toFixed(1)).join(', '), worst.every(([, r]) => r >= 4.5));
  say('no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), errs.length === 0);
  await br.close();
})().catch((e) => { say('runner error ' + String(e).slice(0, 200), false); process.exit(1); });
