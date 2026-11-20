// Text check (bug hunt, "config gaps reach the screen"): in every scene and panel a player can open, no visible text holds "undefined", "NaN", "null",
// "[object" or an unfilled "{...}" / "${...}" slot, and no page error. Scenes: title, base, quest/scout panel, pause menu, keys card, big map, journal,
// street by day, house by day, the night, the night's pause menu, the end screen. Desktop 1280x720 and phone 844x390.
// Usage: node tools/textcheck.cjs [low|high] (default low). Prints PASS / FAIL lines only, then ALL PASS or SOME FAILED. One headless browser, software renderer.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', URL0 = 'file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + tier;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// every visible element's own text (not its children's), with the faults found in it
const scan = (p) => p.evaluate(() => { const BAD = /\bundefined\b|\bNaN\b|\bnull\b|\[object |\$\{|\{[a-zA-Z_.]+\}/, out = []; let n = 0;
  const vis = (e) => { for (let q = e; q && q !== document.documentElement; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  for (const e of document.body.querySelectorAll('*')) { if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue; let own = ''; for (const c of e.childNodes) if (c.nodeType === 3) own += c.nodeValue; own = own.trim();
    for (const a of ['title', 'aria-label', 'data-l', 'data-key', 'placeholder']) { const v = e.getAttribute && e.getAttribute(a); if (v && BAD.test(v) && vis(e)) out.push((e.id || e.tagName) + '@' + a + ': ' + v.slice(0, 60)); }
    if (!own || !vis(e)) continue; n++; if (BAD.test(own)) out.push((e.id || e.className || e.tagName) + ': ' + own.slice(0, 80)); }
  return { n, out }; });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  for (const [label, vp, touch] of [['desktop 1280x720', { width: 1280, height: 720 }, false], ['phone 844x390', { width: 844, height: 390 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 3 : 1 }), p = await ctx.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errs.push(label + ': ' + String(e).slice(0, 160)));
    await p.addInitScript(() => { window.__dtMax = 0.6; window.__fakeLock = false; try { localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
    await p.goto(URL0, { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase);
    const look = async (scene, min) => { await p.waitForTimeout(500); const r = await scan(p); ok(r.out.length === 0 && r.n >= (min || 1), label + ' ' + scene + ': ' + r.n + ' texts, none faulty' + (r.out.length ? ' -> ' + r.out.slice(0, 4).join(' | ') : '') + (r.n < (min || 1) ? ' (too few texts: the scene did not open)' : '')); };
    const step = async (scene, fn, min) => { try { await fn(); await look(scene, min); } catch (e) { ok(false, label + ' ' + scene + ': could not be opened (' + String(e).slice(0, 120) + ')'); } };
    await look('title', 2);
    await step('base by day', async () => { await p.evaluate(() => { const g = window.__game; g.enterBase(); const s = g.save; s.day = 2; s.nights = 1; s.nightsMet = 1; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.seenIntro = true; if (g.reBase) g.reBase(); }); await p.waitForFunction(() => window.__game.state === 'base'); await p.waitForTimeout(1500); }, 2);
    await step('scout panel', async () => { await p.evaluate(() => window.__game.openScout()); await p.waitForFunction(() => getComputedStyle(document.getElementById('scout')).display !== 'none', null, { timeout: 20000 }); }, 4);
    await p.evaluate(() => { const s = document.getElementById('sback'); if (s) s.click(); });
    await step('pause menu (base)', async () => { await p.evaluate(() => window.__game.setPause(true)); await p.waitForFunction(() => document.getElementById('pause').style.display === 'flex', null, { timeout: 20000 }); }, 5);
    await step('keys card', async () => { await p.evaluate(() => document.getElementById('pKeys').click()); await p.waitForFunction(() => document.getElementById('keys').style.display === 'flex', null, { timeout: 20000 }); }, 6);
    await p.evaluate(() => document.getElementById('keysClose').click());
    await step('big map', async () => { await p.evaluate(() => document.getElementById('pMap').click()); await p.waitForFunction(() => document.getElementById('bigmap').style.display === 'flex', null, { timeout: 20000 }); }, 2);
    await p.evaluate(() => document.getElementById('bmapClose').click());
    await step('journal', async () => { await p.evaluate(() => document.getElementById('pJournal').click()); await p.waitForTimeout(800); }, 2);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.evaluate(() => { const g = window.__game; g.setPause(false); });
    await step('street by day', async () => { await p.evaluate(() => { const g = window.__game; g.save.nights = 2; document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForFunction(() => window.__game.state === 'play'); await p.waitForTimeout(1500); }, 2);
    await step('house by day', async () => { await p.evaluate(() => window.__game.enterHouse(0)); await p.waitForFunction(() => !!window.__game.sim); await p.waitForTimeout(1500); }, 2);
    await step('night', async () => { await p.evaluate(() => { const g = window.__game; g.sim.player.hp = 1e6; g.nightfall(); }); await p.waitForFunction(() => window.__game.sim && window.__game.sim.phase === 'night', null, { timeout: 120000 }); await p.waitForTimeout(2500); }, 2);
    await step('pause menu (night)', async () => { await p.evaluate(() => window.__game.setPause(true)); await p.waitForFunction(() => document.getElementById('pause').style.display === 'flex', null, { timeout: 20000 }); }, 5);
    await p.evaluate(() => window.__game.setPause(false));
    await step('end screen', async () => { await p.evaluate(() => window.__game.endNight()); await p.waitForFunction(() => getComputedStyle(document.getElementById('end')).display !== 'none', null, { timeout: 120000 }); }, 2);
    await ctx.close();
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 300)); process.exit(1); });
