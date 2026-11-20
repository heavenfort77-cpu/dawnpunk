// Film loading check (owner Nov 20 22:40: the film's loading belongs in the start loading bar, no black wait after the button). A real player's page (not the
// scripted path: ?cards=1&film=1), first visit: the loading page shows the 'Opening film' stage, the begin button comes only when the film is ready, pressing it
// takes the loading page away, shows no loading card and the film's clock runs within 3 s; a returning player (a save exists) gets no film stage and the home card.
// Usage: node tools/filmloadcheck.cjs [low|medium] (default low). Prints PASS / FAIL lines only, then ALL PASS or SOME FAILED. Served over http (tools/servedist.cjs sets PAGE).
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', PAGE = process.env.PAGE || 'file://' + __dirname + '/../dist/index.html', URL0 = PAGE + '?quality=' + tier + '&cards=1&film=1&seed=777';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(); p.setDefaultTimeout(600000); p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { window.__fakeLock = false; });
  // ---- first visit
  await p.goto(URL0, { timeout: 600000 }); await p.waitForFunction(() => window.__game && window.__splash);
  const seen = new Set(); let shownEarly = false;
  for (let i = 0; i < 1200; i++) { const s = await p.evaluate(() => ({ stage: document.getElementById('sstage').textContent, enter: getComputedStyle(document.getElementById('enter')).display !== 'none' && document.getElementById('spl').classList.contains('ph-ready'), film: window.__splash.stages && window.__splash.stages.film ? window.__splash.stages.film.slice() : null, menu: getComputedStyle(document.getElementById('menu')).display, frac: window.__splash.frac }));
    seen.add(s.stage.replace(/\s*\(.*\)$/, '')); if (s.enter && s.film && s.film[0] < s.film[1]) shownEarly = true; if (s.enter) break; if (s.menu === 'none') { ok(false, 'first visit: the loading page disappeared before the begin button came (stage "' + s.stage + '")'); break; } await p.waitForTimeout(500); }
  ok(seen.has('Loading: Opening film'), 'first visit: the loading page shows the stage "Loading: Opening film" (stages seen: ' + [...seen].join(' / ') + ')');
  ok(!shownEarly, 'first visit: the begin button comes only when the film stage is done');
  const before = await p.evaluate(() => ({ state: window.__game.state, card: getComputedStyle(document.getElementById('lcard')).display, loadFilmMs: window.__splash.loadFilmMs || null }));
  ok(before.state === 'intro' && before.card === 'none', 'first visit: the film is prepared and held under the loading page (state ' + before.state + ', loading card ' + before.card + ', stage took ' + before.loadFilmMs + ' ms)');
  await p.click('#enter'); const t0 = Date.now(); let ran = null, cardSeen = false;
  for (let i = 0; i < 40; i++) { const s = await p.evaluate(() => ({ menu: getComputedStyle(document.getElementById('menu')).display, card: getComputedStyle(document.getElementById('lcard')).display, t: window.__game.introT ? window.__game.introT() : null, state: window.__game.state })); if (s.card !== 'none') cardSeen = true; if (s.menu === 'none' && s.t > 0) { ran = Date.now() - t0; break; } await p.waitForTimeout(100); }
  ok(ran !== null && ran <= 3000, 'first visit: after the begin button the loading page is gone and the film runs' + (ran === null ? ' (it did not within 4 s)' : ' (' + ran + ' ms after the click)'));
  ok(!cardSeen, 'first visit: no loading card and no wait after the begin button');
  // (a slow renderer runs the film slowly: wait on the film's own clock, not on seconds)
  let later = null; try { await p.waitForFunction(() => window.__game.state === 'intro' && window.__game.introT() > 1, null, { timeout: 180000 }); later = await p.evaluate(() => ({ t: window.__game.introT(), state: window.__game.state, fade: +getComputedStyle(document.getElementById('cineFade')).opacity })); } catch (e) { later = null; }
  ok(!!later, 'first visit: the film keeps running' + (later ? ' (film time ' + later.t.toFixed(1) + ' s, black at ' + later.fade.toFixed(2) + ')' : ' (its clock did not pass 1 s in 180 s)'));
  // ---- a returning player: a save exists, no film stage, the begin button gives the home card and the base
  await p.evaluate(() => { try { const g = window.__game; localStorage.setItem('solardg.save', JSON.stringify(g.save)); } catch (e) { /* none */ } });
  await p.goto(URL0, { timeout: 600000 }); await p.waitForFunction(() => window.__game && window.__splash); const seen2 = new Set();
  for (let i = 0; i < 600; i++) { const s = await p.evaluate(() => ({ stage: document.getElementById('sstage').textContent, enter: getComputedStyle(document.getElementById('enter')).display !== 'none' && document.getElementById('spl').classList.contains('ph-ready') })); seen2.add(s.stage.replace(/\s*\(.*\)$/, '')); if (s.enter) break; await p.waitForTimeout(500); }
  ok(!seen2.has('Loading: Opening film'), 'returning player: no film stage on the loading page (stages seen: ' + [...seen2].join(' / ') + ')');
  await p.click('#enter'); let base = false; try { await p.waitForFunction(() => window.__game.state === 'base' && !window.__game.cardOn(), null, { timeout: 300000 }); base = true; } catch (e) { base = false; }
  ok(base, 'returning player: the begin button leads to the base');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 300)); process.exit(1); });
