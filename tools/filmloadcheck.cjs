// Start check (developer panel Nov 20, owner 23:34: 'Play' or 'Watch the opening film' when the loading bar finishes; owner 22:37: no black wait). A real
// player's page (?cards=1&film=1, not the scripted path). First visit: the loading page ends with both buttons; 'Play' leads straight to the base, no film;
// 'Watch the opening film' shows the loading card with its bar (never a bare black screen) while the film is prepared, then the film runs. A returning player
// (a save exists) sees one begin button and reaches the base.
// Usage: node tools/servedist.cjs tools/filmloadcheck.cjs [low|medium]. Prints PASS / FAIL lines only, then ALL PASS or SOME FAILED.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', PAGE = process.env.PAGE || 'file://' + __dirname + '/../dist/index.html', URL0 = PAGE + '?quality=' + tier + '&cards=1&film=1&seed=777';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(); p.setDefaultTimeout(600000); p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { window.__fakeLock = false; });
  const ready = async (pg) => { for (let i = 0; i < 1200; i++) { const r = await pg.evaluate(() => document.getElementById('spl').classList.contains('ph-ready')); if (r) return true; await pg.waitForTimeout(500); } return false; };
  const vis = (pg, id) => pg.evaluate((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 1 && r.height > 1 ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), e.textContent.trim()] : null; }, id);
  // ---- first visit, Play
  await p.goto(URL0, { timeout: 600000 }); await p.waitForFunction(() => window.__game && window.__splash); ok(await ready(p), 'first visit: the loading page reaches its buttons');
  { const a = await vis(p, 'enter'), w = await vis(p, 'enterFilm'), over = a && w && Math.min(a[0] + a[2], w[0] + w[2]) - Math.max(a[0], w[0]) > 2 && Math.min(a[1] + a[3], w[1] + w[3]) - Math.max(a[1], w[1]) > 2;
    ok(!!a && !!w && !over && a[4] === 'Play' && w[1] + w[3] <= 720 && w[0] >= 0, 'first visit: two buttons, "' + (a && a[4]) + '" and "' + (w && w[4]) + '", on screen and not overlapping ' + JSON.stringify([a && a.slice(0, 4), w && w.slice(0, 4)]));
    ok((await p.evaluate(() => window.__game.state)) === 'menu', 'first visit: nothing of the film is prepared before a button is pressed (state menu)'); }
  await p.click('#enter'); let base = false; try { await p.waitForFunction(() => window.__game.state === 'base' && !window.__game.cardOn(), null, { timeout: 300000 }); base = true; } catch (e) { base = false; }
  ok(base, 'first visit, Play: straight to the base, no film');
  // ---- first visit again (the save cleared), Watch
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } }); await p.goto(URL0, { timeout: 600000 }); await p.waitForFunction(() => window.__game && window.__splash); await ready(p);
  await p.click('#enterFilm'); let bare = 0, cardSeen = false, fills = new Set(), ran = false;
  for (let i = 0; i < 2400; i++) { const q = await p.evaluate(() => ({ state: window.__game.state, t: window.__game.introT(), card: getComputedStyle(document.getElementById('lcard')).display, fill: document.getElementById('lfill').style.width, text: document.getElementById('lct').textContent, menu: getComputedStyle(document.getElementById('menu')).display }));
    if (q.state === 'intro' && q.t > 0) { ran = true; break; } if (q.card !== 'none') { cardSeen = true; fills.add(q.fill); if (q.text !== 'Opening film') bare++; } else if (q.menu === 'none') bare++; await p.waitForTimeout(250); }
  ok(ran, 'first visit, Watch: the film runs after its preparation');
  ok(cardSeen && bare <= 1 && fills.size >= 3, 'first visit, Watch: the loading card "Opening film" with a moving bar covers the whole wait (bar steps seen ' + fills.size + ', moments without it ' + bare + ')');
  let later = null; try { await p.waitForFunction(() => window.__game.state === 'intro' && window.__game.introT() > 1, null, { timeout: 180000 }); later = await p.evaluate(() => ({ t: window.__game.introT(), card: getComputedStyle(document.getElementById('lcard')).display })); } catch (e) { later = null; }
  ok(!!later && later.card === 'none', 'first visit, Watch: the film keeps running and the loading card is gone' + (later ? ' (film time ' + later.t.toFixed(1) + ' s)' : ''));
  // ---- a returning player: a save exists, one begin button, the base
  await p.evaluate(() => { try { localStorage.setItem('solardg.save', JSON.stringify(window.__game.save)); } catch (e) { /* none */ } });
  await p.goto(URL0, { timeout: 600000 }); await p.waitForFunction(() => window.__game && window.__splash); await ready(p);
  ok(!!(await vis(p, 'enter')) && !(await vis(p, 'enterFilm')), 'returning player: one begin button, no film button on the loading page');
  await p.click('#enter'); let base2 = false; try { await p.waitForFunction(() => window.__game.state === 'base' && !window.__game.cardOn(), null, { timeout: 300000 }); base2 = true; } catch (e) { base2 = false; }
  ok(base2, 'returning player: the begin button leads to the base');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 300)); process.exit(1); });
