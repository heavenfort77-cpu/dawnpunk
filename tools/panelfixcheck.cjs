// Interface fix pass check (panel review, Nov 17). PASS/FAIL lines only. Usage: node tools/panelfixcheck.cjs [abs page.html]
// 1. Tap targets on a phone (touch) at 844x390 and 390x844: every button the player taps is at least CONFIG.ui.tap px on both sides
//    (music, pause, quest box, HOLD, LEAVE, devices, EAT, FIRE, title links, every panel button: hatchery, board, Oko, crew, kit, Scout), and LEAVE sits off the screen centre.
// 2. Phone device buttons: one text line, picture shown, a "need N" + crossed-sun state when the Sun is short.
// 3. Text size: the count line, the base line, the quest box and the title menu are at least CONFIG.ui.minPx (desktop 13, phone 14).
// 4. Contrast of HUD text over the scene, measured on screenshots: a bright day frame (looking at the sky) and a night frame, desktop 1280x720 and phone 844x390.
//    Background = the most common colour inside the element's box on the screenshot (its backing over the real scene); text = its CSS colour. Needs 4.5:1.
// One headless browser, software renderer, low tier (the HUD is DOM: the same on both tiers).
const { chromium } = require('playwright');
(async () => {
  const page = process.argv[2] || require('path').resolve(__dirname, '../dist/index.html');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const out = []; const errs = [];
  const add = (name, ok) => out.push([name, !!ok]);
  const open = async (vp, touch) => { const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript(() => { window.__dtMax = 0.5; if (!sessionStorage.getItem('pfc')) { sessionStorage.setItem('pfc', '1'); try { localStorage.clear(); } catch (e) { /* none */ } } });
    await p.goto('file://' + page + '?quality=low&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 }); return { ctx, p }; };
  // sizes of the visible ones among the selectors
  const sizes = (p, sels) => p.evaluate((sels) => { const r = []; for (const s of sels) for (const e of document.querySelectorAll(s)) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue; let b = e.getBoundingClientRect(); { const sc = e.closest('.pbody'); if (sc) { const c = sc.getBoundingClientRect(); b = { left: b.left, right: b.right, width: b.width, top: Math.max(b.top, c.top), bottom: Math.min(b.bottom, c.bottom), height: Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top) }; } } if (b.width < 1 || b.height < 1) continue; r.push([s + (e.id ? '' : '[' + (e.textContent || '').trim().slice(0, 18) + ']'), Math.round(b.width), Math.round(b.height), [b.left, b.top, b.right, b.bottom]]); } return r; }, sels);
  const overlaps = (s) => { const o = []; for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const a = s[i][3], c = s[j][3]; const inside = (a[0] >= c[0] && a[1] >= c[1] && a[2] <= c[2] && a[3] <= c[3]) || (c[0] >= a[0] && c[1] >= a[1] && c[2] <= a[2] && c[3] <= a[3]); if (!inside && a[0] < c[2] - 1 && c[0] < a[2] - 1 && a[1] < c[3] - 1 && c[1] < a[3] - 1) o.push(s[i][0] + ' / ' + s[j][0]); } return o; };
  const tapCheck = async (p, where, sels, min) => { const s = await sizes(p, sels); { const ov = overlaps(s); add(where + ': no two tap targets overlap' + (ov.length ? ' (' + ov.join(', ') + ')' : ''), !ov.length); } const small = s.filter((q) => Math.min(q[1], q[2]) < min); add(where + ': ' + s.length + ' tap targets, smallest ' + (s.length ? Math.min(...s.map((q) => Math.min(q[1], q[2]))) : '-') + ' px' + (small.length ? ' (under ' + min + ': ' + small.map((q) => q[0] + ' ' + q[1] + 'x' + q[2]).join(', ') + ')' : ''), s.length > 0 && !small.length); return s; };
  // contrast of the visible text elements on a screenshot, measured inside the page
  const contrast = async (p, where, sels) => {
    const png = (await p.screenshot({ timeout: 240000 })).toString('base64');
    const res = await p.evaluate(async ([png, sels]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }, L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b), ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const out = []; let sceneL = 0; { const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 16) s += L(d[i], d[i + 1], d[i + 2]); sceneL = s / (d.length / 16); }
      for (const s of sels) for (const e of document.querySelectorAll(s)) {
        const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || !(e.textContent || '').trim()) continue; const bb = e.getBoundingClientRect(); if (bb.width < 4 || bb.height < 4) continue;
        const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)/.exec(cs.color); if (!m) continue; const tl = L(+m[1], +m[2], +m[3]);
        const x0 = Math.max(0, Math.round(bb.left)), y0 = Math.max(0, Math.round(bb.top)), w = Math.min(c.width - x0, Math.round(bb.width)), h = Math.min(c.height - y0, Math.round(bb.height)); if (w < 2 || h < 2) continue;
        const d = x.getImageData(x0, y0, w, h).data, hist = new Map(); for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3); hist.set(k, (hist.get(k) || 0) + 1); }
        let best = 0, key = 0; for (const [k, n] of hist) if (n > best) { best = n; key = k; } const bl = L(((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4);
        out.push([s, Math.round(ratio(tl, bl) * 10) / 10, parseFloat(cs.fontSize)]);
      }
      return { out, sceneL };
    }, [png, sels]);
    const bad = res.out.filter((q) => q[1] < 4.5);
    add(where + ' (scene mean luminance ' + res.sceneL.toFixed(3) + '): ' + res.out.map((q) => q[0] + ' ' + q[1] + ':1').join(', ') + (bad.length ? ' -- under 4.5: ' + bad.map((q) => q[0]).join(', ') : ''), res.out.length > 0 && !bad.length);
    return res;
  };
  const fontMin = async (p, where, sels, min) => { const r = await p.evaluate((sels) => sels.map((s) => { const e = document.querySelector(s); if (!e) return [s, null]; const cs = getComputedStyle(e); return [s, cs.display === 'none' ? null : parseFloat(cs.fontSize), parseFloat(cs.opacity)]; }), sels); const seen = r.filter((q) => q[1] !== null); const bad = seen.filter((q) => q[1] < min || q[2] < 0.99); add(where + ': ' + seen.map((q) => q[0] + ' ' + q[1] + 'px').join(', ') + ' (need ' + min + ' px, full opacity)', seen.length && !bad.length); };
  const PANEL_BTNS = ['#qb button', '#qb select', '#scout button', '#scout select', '#kit button', '#kit select'];
  const panels = async (p, where, min) => {
    const ks = await p.evaluate(() => { const g = window.__game, s = g.save; if (s.avians) { s.avians.held = Math.max(1, s.avians.held || 0); } return ['hatchery', 'board', 'crew', 'oko', 'workshop']; });
    for (const k of ks) { const ok = await p.evaluate((k) => { try { window.__game.openPanel(k); return getComputedStyle(document.getElementById('qb')).display !== 'none'; } catch (e) { return String(e); } }, k); if (ok !== true) { add(where + ' panel ' + k + ' opens: ' + ok, false); continue; } await p.waitForTimeout(250); await tapCheck(p, where + ' panel ' + k, PANEL_BTNS, min);
      const look = await p.evaluate(() => { const ps = [...document.querySelectorAll('#qb .pbody > p:not(.hint)')]; return ps.length ? ps.every((e) => { const cs = getComputedStyle(e); return parseFloat(cs.borderTopWidth) === 0 && parseFloat(cs.borderLeftWidth) === 0 && parseFloat(cs.borderTopLeftRadius) < 3; }) : true; }); add(where + ' panel ' + k + ': info lines are plain text (no button-like outline)', look);
      { const pm = await p.evaluate(() => matchMedia('(pointer: coarse)').matches ? 14 : 15); await fontMin(p, where + ' panel ' + k + ' body text', ['#qb .pbody > p:not(.hint)', '#qb .pbody > p.hint'], pm); if (k === 'hatchery' || k === 'oko') await contrast(p, where + ' panel ' + k + ' text contrast', ['#qb .pbody > p']); }
      { const cl = await p.evaluate(() => { const c = document.getElementById('qclose').getBoundingClientRect(), b = document.querySelector('#qb .pbody').getBoundingClientRect(); return Math.max(0, Math.min(c.bottom, b.bottom) - Math.max(c.top, b.top)) * (c.left < b.right && b.left < c.right ? 1 : 0); }); add(where + ' panel ' + k + ': Close sits below the scrolling content, never over it (' + cl + ' px overlap)', cl === 0); }
      await p.evaluate(() => { const c = document.getElementById('qclose'); if (c) c.click(); document.getElementById('qb').style.display = 'none'; }); }
    await p.evaluate(() => { document.getElementById('scout').style.display = 'flex'; }); await tapCheck(p, where + ' Scout panel', PANEL_BTNS, min); await p.evaluate(() => { document.getElementById('scout').style.display = 'none'; document.getElementById('kit').style.display = 'flex'; }); await tapCheck(p, where + ' kit panel', PANEL_BTNS, min); await p.evaluate(() => { document.getElementById('kit').style.display = 'none'; });
  };
  const TXT = ['#time', '#count', '#bprompt', '#msg', '#marla', '#aim', '#bstat', '#bq', '#mlook', '#dkeys', '#hchip', '#clk', '#vit .l2'];
  // ---- PHONE 844x390 (touch)
  { const { ctx, p } = await open({ width: 844, height: 390 }, true); const T = await p.evaluate(() => (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).ui.tap), MP = await p.evaluate(() => (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).ui.minPx[1]);
    await tapCheck(p, 'phone 844x390 title', ['#enter', '#tlinks button'], T); await fontMin(p, 'phone title menu text', ['#tlinks button', '#tkick'], MP);
    await p.evaluate(() => document.getElementById('enter').click()); await p.waitForTimeout(2500);
    await tapCheck(p, 'phone 844x390 base HUD', ['#bMus', '#bPause', '#bq'], T); await fontMin(p, 'phone base line and quest box', ['#bstat', '#bq'], MP);
    await panels(p, 'phone 844x390', T);
    await p.evaluate(() => { document.getElementById('selRing').value = '0'; window.__game.startRun(0); }); await p.waitForTimeout(2500);
    await tapCheck(p, 'phone 844x390 street by day', ['#bMus', '#bPause', '#bDusk', '#b0'], T); await fontMin(p, 'phone count line', ['#count'], MP);
    await p.evaluate(() => { const g = window.__game; g.setPitch(0.75); g.say('Bright sky test line, Potts.'); }); await p.waitForTimeout(1500); await contrast(p, 'phone day contrast over the bright sky', TXT);
    await p.evaluate(() => window.__game.enterHouse(0)); await p.waitForTimeout(2000);
    const lv = await p.evaluate(() => { const e = document.getElementById('bLeave'), was = e.style.display; e.style.display = 'flex'; const r = e.getBoundingClientRect(); e.style.display = was; return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), innerWidth, innerHeight]; });
    const cx = lv[0] + lv[2] / 2, cy = lv[1] + lv[3] / 2; add('phone LEAVE is ' + lv[2] + 'x' + lv[3] + ' at (' + Math.round(cx) + ', ' + Math.round(cy) + '), off the screen centre (outside the middle third)', Math.min(lv[2], lv[3]) >= T && (cx < lv[4] / 3 || cx > lv[4] * 2 / 3 || cy < lv[5] / 3 || cy > lv[5] * 2 / 3));
    await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(1500); await p.evaluate(() => { const s = window.__game.sim; s.t = 40; s.player.energy = 60; }); await p.waitForTimeout(2500);
    await tapCheck(p, 'phone 844x390 night', ['#bMus', '#bPause', '#b1', '#b2', '#b3', '#bEat', '#bFire'], T);
    const dev = await p.evaluate(() => [1, 2, 3].map((i) => { const e = document.getElementById('b' + i), l = e.querySelector('.dl'), ic = e.querySelector('.ic'); if (!l) return null; const cs = getComputedStyle(l), lr = l.getBoundingClientRect(), icr = ic ? ic.getBoundingClientRect() : { width: 0 }; return [e.textContent.trim(), Math.round(lr.height), parseFloat(cs.fontSize), parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2, Math.round(icr.width)]; }));
    add('phone device buttons: one text line of 14 px or more and a picture of 36 px or more: ' + JSON.stringify(dev), dev.every((d) => d && d[2] >= 14 && d[1] <= d[3] * 1.6 && d[4] >= 36));
    await p.evaluate(() => { window.__game.sim.player.energy = 0; }); await p.waitForTimeout(1500);
    const poor = await p.evaluate(() => [1, 2, 3].map((i) => { const e = document.getElementById('b' + i); return [e.textContent.trim(), e.classList.contains('poor') || e.classList.contains('full'), !!e.querySelector('.sunic.no') || /max/.test(e.textContent)]; }));
    add("phone device buttons show can't-afford in words and a crossed sun, not only dimming: " + JSON.stringify(poor), poor.every((q) => q[1] && q[2] && /need \d+|max \d/.test(q[0])));
    await p.evaluate(() => { const g = window.__game, s = g.sim; s.player.energy = 30; g.say('Gloom on your left.'); }); await p.waitForTimeout(1200); await contrast(p, 'phone night contrast', TXT);
    await ctx.close(); }
  // ---- PHONE 390x844 (upright)
  { const { ctx, p } = await open({ width: 390, height: 844 }, true); const T = await p.evaluate(() => (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).ui.tap);
    await p.waitForTimeout(1200); await tapCheck(p, 'phone 390x844 rotate screen', ['#rotFs', '#rotAny'], T);
    await p.evaluate(() => document.getElementById('rotAny').click()); await p.waitForTimeout(300); await tapCheck(p, 'phone 390x844 title', ['#enter', '#tlinks button'], T);
    await p.evaluate(() => document.getElementById('enter').click()); await p.waitForTimeout(2500); await tapCheck(p, 'phone 390x844 base HUD', ['#bMus', '#bPause', '#bq'], T);
    await panels(p, 'phone 390x844', T);
    await p.evaluate(() => { document.getElementById('selRing').value = '0'; window.__game.startRun(0); window.__game.enterHouse(0); }); await p.waitForTimeout(2000); await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(1500);
    await tapCheck(p, 'phone 390x844 night', ['#bMus', '#bPause', '#b1', '#b2', '#b3', '#bEat', '#bFire'], T);
    await ctx.close(); }
  // ---- DESKTOP 1280x720 (mouse)
  { const { ctx, p } = await open({ width: 1280, height: 720 }, false); const MD = await p.evaluate(() => (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).ui.minPx[0]);
    await fontMin(p, 'desktop title menu text', ['#tlinks button', '#tkick'], MD);
    await p.evaluate(() => document.getElementById('enter').click()); await p.waitForTimeout(2500); await fontMin(p, 'desktop base line and quest box', ['#bstat', '#bq'], MD);
    const bp = await p.evaluate(() => getComputedStyle(document.getElementById('bPause')).display !== 'none'); add('pause button shows in the base', bp);
    await p.evaluate(() => { document.getElementById('selRing').value = '0'; window.__game.startRun(0); }); await p.waitForTimeout(2500); await fontMin(p, 'desktop count line', ['#count'], MD);
    await p.evaluate(() => { const g = window.__game; g.setPitch(0.75); g.say('Bright sky test line, Potts.'); }); await p.waitForTimeout(1500); await contrast(p, 'desktop day contrast over the bright sky', TXT);
    await p.evaluate(() => { const g = window.__game; g.enterHouse(0); }); await p.waitForTimeout(1500); await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(1500); await p.evaluate(() => { const s = window.__game.sim; s.t = 40; window.__game.say('Gloom on your left.'); }); await p.waitForTimeout(1500);
    await contrast(p, 'desktop night contrast', TXT.concat(['#slots .b']));
    await ctx.close(); }
  // floating base labels: drawn on a canvas in the scene, so worked out from CONFIG.ui.label (backing over a white sky and over black) for white and gold text
  { const cfg = await (async () => { const { ctx, p } = await open({ width: 400, height: 300 }, false); const c = await p.evaluate(() => (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).ui.label); await ctx.close(); return c; })();
    const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(cfg.bg.replace(/\s/g, '')); const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }, L = (r, g, bb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bb), R = (a, bb) => (Math.max(a, bb) + 0.05) / (Math.min(a, bb) + 0.05);
    const a = +m[4], over = (s) => [0, 1, 2].map((i) => +m[i + 1] * a + s * (1 - a)); const bgW = L(...over(255)), bgB = L(...over(0)); const r = [R(L(255, 255, 255), bgW), R(L(255, 233, 160), bgW), R(L(255, 208, 128), bgW), R(L(255, 255, 255), bgB)];
    add('floating labels: white / gold / Marla text on the backing over a white sky ' + r.slice(0, 3).map((v) => v.toFixed(1)).join(' / ') + ':1, over black ' + r[3].toFixed(1) + ':1', Math.min(...r) >= 4.5); }
  add('no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), !errs.length);
  let bad = 0; for (const [n, ok] of out) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) bad++; } console.log(bad ? 'SOME FAILED' : 'ALL PASS'); await b.close();
})();
