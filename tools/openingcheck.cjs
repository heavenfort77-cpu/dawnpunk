// the opening cutscene (owner Nov 17 16:25, CONFIG.opening): it plays from the title, runs through its four parts in the game's own 3D world, skips with a key, a click and
// the Skip button, and always ends in the base standing with Marla at your door (new game), with the save and first-day flow as before; no page errors.
// Usage: node tools/openingcheck.cjs <low|high> [out_prefix] [abs page] [w x h]   (out_prefix: frames <out_prefix><t>.png at CONFIG.opening sample times)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const tier = process.argv[2] || 'low', out = process.argv[3] || '', page = 'file://' + (process.argv[4] || path.resolve(__dirname, '../dist/index.html')) + '?quality=' + tier + '&film=1';
  const [vw, vh] = (process.argv[5] || (tier === 'high' ? '1280x720' : '844x390')).split('x').map(Number), frames = (process.env.FRAMES || '').split(',').filter(Boolean).map(Number);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], res = [];
  const ok = (n, v, info) => { res.push(!!v); console.log((v ? 'PASS ' : 'FAIL ') + n + (info ? '  ' + info : '')); };
  const open = async () => { const p = await b.newPage({ viewport: { width: vw, height: vh } }); p.on('pageerror', (e) => errs.push(String(e))); await p.goto(page, { timeout: 900000 });
    await p.waitForFunction(() => window.__game && window.__game.startIntro, null, { timeout: 900000 });
    await p.waitForFunction(() => !window.__gloomGlb || Object.values(window.__gloomGlb).every((s) => s !== 'loading'), null, { timeout: 900000 }).catch(() => {});
    await p.evaluate(() => { localStorage.clear(); window.__dtMax = 0.5; }); return p; };
  const st = (p) => p.evaluate(() => window.__game.state);
  // 1. it plays: start from the title, step through every part, end in the base
  let p = await open();
  const C = await p.evaluate(() => window.__game.cfg.opening);
  ok('it runs ' + C.parts[4] + ' s with ' + C.lines.length + ' captions (45-75 s, 3-6 lines)', C.parts[4] >= 45 && C.parts[4] <= 75 && C.lines.length >= 3 && C.lines.length <= 6);
  await p.evaluate(() => document.getElementById('watch').click()); await p.waitForTimeout(3000);
  ok('"Watch the opening" (now in the pause menu; the title page is gone) starts it', await st(p) === 'intro', await p.evaluate(() => document.getElementById('watch').textContent));
  const snaps = frames.length ? frames : [3, 9, 14, 19, 22.5, 26, 33, 41, 46, 49, 53, 55.5];
  for (const t of snaps) {
    await p.evaluate((t) => { window.__dtMax = 0.15; window.__game.introAt(t); }, t); await p.waitForTimeout(tier === 'high' ? 6000 : 2500);
    await p.evaluate((t) => { window.__game.introAt(t); window.__dtMax = 0.0001; }, t); await p.waitForTimeout(tier === 'high' ? 4000 : 1500);
    const info = await p.evaluate(() => { const g = window.__game, c = g.cam; return { state: g.state, cap: document.getElementById('cineCap').textContent, cam: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(1)) }; });
    if (info.state !== 'intro') { ok('still playing at ' + t + ' s', false, JSON.stringify(info)); break; }
    if (out) await p.screenshot({ path: out + String(t).replace('.', '_') + '.png', timeout: 300000 });
    console.log('INFO t=' + t + ' ' + JSON.stringify(info));
  }
  // waits for the base, not a fixed time: the "Your job" card closes by itself CONFIG.lore.jobCardSecs (15 s) after it opens, and a fixed 15 s wait on high ran past it
  await p.evaluate(() => { window.__dtMax = 0.5; window.__game.introAt(window.__game.cfg.opening.parts[4] - 0.2); });
  await p.waitForFunction(() => window.__game.state === 'base', null, { timeout: 240000 }).catch(() => {}); await p.waitForTimeout(1500);
  const end = await p.evaluate(() => { const g = window.__game, s = g.save, sp = g.B.scoutPos(s); return { state: g.state, hint: sp.hint, cine: document.getElementById('cine').style.display, hud: document.getElementById('hud').style.display, msg: document.getElementById('msg').textContent, day: s.day, nights: s.nights, seen: s.seenIntro, pos: g.basePos(), filter: document.getElementById('c').style.filter }; });
  ok('played to the end it stands you in the base with Marla at your door', end.state === 'base' && end.hint === 'at your door' && end.cine === 'none' && end.hud === 'block' && !end.filter, JSON.stringify(end));
  ok('the save is the first day as before (day 1, no nights, opening marked seen)', end.day === 1 && end.nights === 0 && end.seen === true);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('solardg.save') || '{}'));
  ok('the stored save matches (day 1, Marla at your door, quests ready)', stored.day === 1 && stored.scoutSpot === 4 && Array.isArray(stored.quests) && stored.quests.length > 0 && stored.seenIntro === true);
  // the one-time "Your job" card: there after the opening, gone on a key, saved as seen
  const card = await p.evaluate(() => { const c = document.getElementById('jobCard'); if (!c) return null; const r = c.getBoundingClientRect(), bt = c.querySelector('button').getBoundingClientRect(); return { text: c.innerText, w: r.width, h: r.height, fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, btn: [bt.width, bt.height] }; });
  ok('the "Your job" card shows after the opening (three duties, the guide, a 44 px button, on screen)', card && /panel-tender/.test(card.text) && /panels/.test(card.text) && /food and essentials/.test(card.text) && /until dawn/.test(card.text) && /Marla the Scout/.test(card.text) && card.fits && card.btn[0] >= 44 && card.btn[1] >= 44, JSON.stringify(card).slice(0, 200));
  if (out) await p.screenshot({ path: out + 'card.png', timeout: 300000 });
  // moving and looking do not close it, and it stays clear of the crosshair; Enter closes it and it is saved as seen
  await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW'); await p.mouse.move(vw * 0.6, vh * 0.5); await p.mouse.move(vw * 0.7, vh * 0.45); await p.waitForTimeout(500);
  const stay = await p.evaluate(() => { const c = document.getElementById('jobCard'); if (!c) return { card: false }; const r = c.getBoundingClientRect(), cx = innerWidth / 2, cy = innerHeight / 2; return { card: true, clear: !(cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) }; });
  ok('walking and looking leave the card up, and it does not cover the crosshair', stay.card && stay.clear, JSON.stringify(stay));
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  const gone = await p.evaluate(() => ({ card: !!document.getElementById('jobCard'), seen: window.__game.save.jobCard, stored: JSON.parse(localStorage.getItem('solardg.save') || '{}').jobCard }));
  ok('Enter closes the card, and it is saved as seen', !gone.card && gone.seen === true && gone.stored === true, JSON.stringify(gone));
  // the first-day flow goes on: talk to Marla, then ride out
  const flow = await p.evaluate(async () => { const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)); g.openScout(); await wait(800); const sc = getComputedStyle(document.getElementById('scout')).display, line = document.getElementById('scoutLine').textContent; document.getElementById('sback').click(); await wait(300); g.openScout(); await wait(500); const line2 = document.getElementById('scoutLine').textContent; document.getElementById('sback').click(); g.startRun(); await wait(2500); return { scout: sc, line, line2, state: g.state, run: !!g.run }; });
  ok('the first day goes on as before: Marla\'s panel opens, the ride out starts', flow.scout !== 'none' && flow.state === 'play' && flow.run, JSON.stringify(flow));
  ok('Marla\'s job line the first time you talk to her, and only once', /panel-tender/.test(flow.line) && /guide/.test(flow.line) && !/panel-tender/.test(flow.line2), flow.line + ' / then: ' + flow.line2);
  await p.close();
  // 2. any key skips (part 1), 3. a click skips (part 2), 4. the Skip button skips (part 3)
  // SKIPS=key (or any of key,click,button,newgame,standins) runs only those tests (the slow desktop picture run); default all
  const SK = (process.env.SKIPS || 'key,click,button,newgame,standins').split(',');
  for (const [how, at] of [['a key', 4], ['a click', 20], ['the Skip button', 35]].filter((q) => SK.includes(q[0].split(' ').pop()))) {
    p = await open(); await p.evaluate(() => document.getElementById('watch').click()); await p.waitForTimeout(2000); await p.evaluate((t) => window.__game.introAt(t), at); await p.waitForTimeout(tier === 'high' ? 6000 : 2500);
    if (how === 'a key') await p.keyboard.press('KeyX'); else if (how === 'a click') await p.mouse.click(vw * 0.4, vh * 0.5); else await p.evaluate(() => document.getElementById('cineSkip').click());
    await p.waitForTimeout(tier === 'high' ? 8000 : 3500);
    const r = await p.evaluate(() => { const g = window.__game, sp = g.B.scoutPos(g.save); return { state: g.state, hint: sp.hint, cine: document.getElementById('cine').style.display, ui: !!document.getElementById('scout') && getComputedStyle(document.getElementById('scout')).display !== 'none', panel: getComputedStyle(document.getElementById('qb')).display !== 'none' }; });
    ok('skipping with ' + how + ' at ' + at + ' s ends in the base with Marla at your door (no panel opened by it)', r.state === 'base' && r.hint === 'at your door' && r.cine === 'none' && !r.ui && !r.panel, JSON.stringify(r));
    await p.close();
  }
  // a NEW game plays the opening (coordinator Nov 17); a key skips it into the base; the job card shows after the skip; a continued save goes straight in
  if (SK.includes('newgame')) {
    p = await open(); await p.evaluate(() => { document.getElementById('reset').click(); document.getElementById('reset').click(); }); await p.waitForTimeout(tier === 'high' ? 8000 : 3000);
    const ng = await p.evaluate(() => window.__game.state); ok('New game plays the opening first', ng === 'intro', ng);
    await p.keyboard.press('KeyX'); await p.waitForTimeout(tier === 'high' ? 8000 : 3500);
    const ns = await p.evaluate(() => { const g = window.__game; return { state: g.state, hint: g.B.scoutPos(g.save).hint, card: !!document.getElementById('jobCard'), day: g.save.day }; });
    ok('a key skips it into the base with Marla at your door, and the job card shows', ns.state === 'base' && ns.hint === 'at your door' && ns.card && ns.day === 1, JSON.stringify(ns));
    await p.keyboard.press('Escape'); await p.waitForTimeout(800); const seen = await p.evaluate(() => window.__game.save.jobCard === true && !document.getElementById('jobCard'));
    await p.reload(); await p.waitForFunction(() => window.__game && window.__game.startIntro, null, { timeout: 900000 }); await p.evaluate(() => document.getElementById('enter').click()); await p.waitForTimeout(tier === 'high' ? 8000 : 3000);
    const cont = await p.evaluate(() => ({ state: window.__game.state, card: !!document.getElementById('jobCard') }));
    ok('a continued save goes straight into the base: no film, no card again', seen && cont.state === 'base' && !cont.card, JSON.stringify(cont));
    await p.close();
  }
  // a first-time player (empty save) cannot reach the base without the film: Enter the base starts it too; ?film=0 (scripted checks) does not
  if (SK.includes('newgame')) {
    p = await open(); await p.evaluate(() => document.getElementById('enter').click()); await p.waitForTimeout(tier === 'high' ? 8000 : 3000);
    ok('Enter the base on an empty save starts the opening', await p.evaluate(() => window.__game.state) === 'intro'); await p.close();
  }
  // the wake shot shows no plain stand-in person (people wait for their models, or are hidden)
  if (SK.includes('standins')) {
    p = await open(); await p.evaluate(() => document.getElementById('watch').click()); await p.waitForTimeout(2000);
    await p.evaluate(() => { window.__dtMax = 0.15; window.__game.introAt(window.__game.cfg.opening.parts[3] + 6.5); }); await p.waitForTimeout(tier === 'high' ? 15000 : 6000);
    const si = await p.evaluate(() => ({ state: window.__game.state, shown: window.__game.standInsShown() }));
    ok('the wake shot shows no stand-in figure', si.state === 'intro' && si.shown === 0, JSON.stringify(si));
    await p.close();
  }
  ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 400));
  const bad = res.filter((x) => !x).length; console.log(bad ? 'SOME FAILED (' + bad + ')' : 'ALL PASS (' + res.length + ')'); await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL runner ' + String(e).slice(0, 400)); process.exit(2); });
