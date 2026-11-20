// Run-end snapshot check (player report Nov 21: after dying and being sent home the screen stayed covered by a blurred picture). After a night that is lost and
// after a night that is won: the run-end screen shows its blurred snapshot; back in the base the snapshot is gone, and no other full-window element than the
// game view is left showing over it (scene-owned pieces must not leak into the next scene).
// Usage: node tools/endsnapcheck.cjs [low|high] (default low). Prints PASS / FAIL lines only, then ALL PASS or SOME FAILED. One headless browser, software renderer.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', URL0 = 'file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + tier;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.setDefaultTimeout(600000); p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { window.__dtMax = 0.6; window.__fakeLock = false; try { localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  await p.goto(URL0, { timeout: 600000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  const look = () => p.evaluate(() => { const e = document.getElementById('endSnap'), big = []; for (const q of document.body.querySelectorAll('*')) { if (q.id === 'c') continue; const cs = getComputedStyle(q); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue; const r = q.getBoundingClientRect(); if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.9) continue; const painted = q.tagName === 'CANVAS' || q.tagName === 'IMG' || q.tagName === 'VIDEO' || (cs.backgroundImage && cs.backgroundImage !== 'none') || !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.backgroundColor) || (cs.backdropFilter && cs.backdropFilter !== 'none'); if (painted) big.push(q.id || q.className || q.tagName); }
    return { state: window.__game.state, snap: e ? getComputedStyle(e).display : 'none', big }; });
  for (const how of ['lost', 'won']) {
    await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 2; g.save.talkedMarla = true; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); g.nightfall(); });
    await p.waitForFunction(() => window.__game.sim && window.__game.sim.phase === 'night'); await p.waitForFunction(() => !window.__game.cardOn());
    if (how === 'lost') await p.evaluate(() => { window.__game.sim.player.hp = 0; }); else await p.evaluate(() => window.__game.endNight());
    let shown = true; try { await p.waitForFunction(() => window.__game.state === 'end' && document.getElementById('end').style.display === 'flex' && document.getElementById('endSnap') && getComputedStyle(document.getElementById('endSnap')).display === 'block', null, { timeout: 180000 }); } catch (e) { shown = false; }
    ok(shown, 'a night ' + how + ': the run-end screen shows with its blurred snapshot');
    await p.click('#again'); await p.waitForFunction(() => window.__game.state === 'base' && !window.__game.cardOn(), null, { timeout: 300000 });
    // a few frames of the base (waits on frames drawn, not on seconds)
    await p.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const q = await look(); ok(q.snap === 'none', 'a night ' + how + ': back in the base the blurred snapshot is gone (it is ' + q.snap + ')');
    ok(q.big.length === 0, 'a night ' + how + ': nothing but the game view covers the window in the base' + (q.big.length ? ' (left showing: ' + q.big.join(', ') + ')' : ''));
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed: ' + String(e).slice(0, 300)); process.exit(1); });
