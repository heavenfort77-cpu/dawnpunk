// Fresh-player fixes (owner Nov 18, desktop player test): PASS/FAIL lines only. Usage: node tools/freshfixcheck.cjs [abs page.html] [low|high]   (default low; desktop 1280x720 and Pixel 7 sideways)
// Waking prompt, the first click only takes the mouse, Esc closes Marla's dialog without pausing, her day-1 first talk (line, ride-out line, two buttons, pickers behind a toggle), the goal line's ring,
// hold N in the base, the quest chip (Tab / tap, a click does not reach the game), the pause menu (Keys, Journal, Map; music button clear of the title), hold H shows the Keys card,
// the mouse hint stays away while N is held, the drill (machine in view, ring or edge arrow, full bar, plain second line), phones (USE pulses, phone keys only, switch tab in the drill),
// and the loading page as one centred group.
const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const page = process.argv[2] || path.resolve(__dirname, '../dist/index.html'), tier = process.argv[3] === 'high' ? 'high' : 'low';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const out = [], errs = []; const add = (n, ok) => { out.push([n, !!ok]); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
  const open = async (opts, q) => { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.setDefaultTimeout(SLOW); p.on('pageerror', (e) => errs.push(String(e))); await p.addInitScript(() => { window.__dtMax = 0.5; });
    await p.goto('file://' + page + '?quality=' + tier + '&seed=777' + (q || ''), { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 }); return { ctx, p }; };
  const vis = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; }).map((e) => e.id || e.className), sel);
  const shown = async (p, id) => (await vis(p, '#' + id)).length > 0;
  const txt = (p, id) => p.evaluate((id) => document.getElementById(id).textContent, id);
  const key = (p, code, type) => p.evaluate(([code, type]) => window.dispatchEvent(new KeyboardEvent(type || 'keydown', { code, bubbles: true })), [code, type]);
  const press = async (p, code) => { await key(p, code, 'keydown'); await key(p, code, 'keyup'); };
  // CI Nov 18 (desktop high tier on the GitHub runner: software renderer, one frame can take several seconds): the game moves on per frame, so a wait in wall seconds alone can end before
  // the game has drawn a single frame. frames(p, n): n whole game frames pass (the game's frame() asked for its next frame before this does, so it runs first in each one).
  const frames = (p, n) => p.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  // wait(p, ms): the old wall-clock wait, then at least two game frames, so what the check reads next has been through the game's own update
  const wait = async (p, ms) => { await p.waitForTimeout(ms); await frames(p, 2); };
  // gameWait(p, secs): secs of the game's own time pass (each frame adds at most window.__dtMax, as src/main.js frame() counts it), then one more frame so the HUD shows it
  const gameWait = (p, secs) => p.evaluate((secs) => new Promise((res) => { let t = 0, last = performance.now(), done = false; const f = (now) => { t += Math.max(0, Math.min(window.__dtMax || 0.1, (now - last) / 1000)); last = now; if (done) return res(); if (t >= secs) done = true; requestAnimationFrame(f); }; requestAnimationFrame(f); }), secs);
  // condition waits on the slow runner: a few game frames can take a minute, so these wait for the game state itself (up to this many ms) instead of a short wall-clock cap
  const SLOW = 600000;
  const only = (process.env.SECT || '').split(',').filter(Boolean), sect = async (name, fn) => { if (only.length && !only.some((q) => name.startsWith(q))) return; try { await fn(); } catch (e) { add(name + ' ran to the end (' + String(e).split('\n')[0].slice(0, 160) + ')', false); } };
  // ---- DESKTOP: the waking flow from the opening's end (skip), Marla's first talk, Esc, N, the quest chip, the pause menu, hold H
  await sect('desktop waking flow', async () => { const { ctx, p } = await open({ viewport: { width: 1280, height: 720 } }, '&film=1');
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); document.getElementById('watch').click(); }); await wait(p, 2500);
    await p.evaluate(() => document.getElementById('cineSkip').click()); await p.waitForFunction(() => window.__game.state === 'base', null, { timeout: 120000 }); await wait(p, 2500);
    const card = await p.evaluate(() => { const c = !!document.getElementById('jobCard'); if (c) for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code: 'Enter', bubbles: true })); return c; }); await wait(p, 1200);
    const w = await p.evaluate(() => [window.__game.wakeText(), document.getElementById('csay').textContent, window.__game.B.scoutPos(window.__game.save).hint]);
    add('waking (after the opening): "' + w[1] + '" shows in the centre, Marla ' + w[2] + (card ? '' : ' (the job card had closed by itself)'), w[0] === 'Click to start · E to talk' && w[1] === w[0]);
    add('the mouse-look hint is not shown under the waking prompt', !(await shown(p, 'mlook')));
    await p.mouse.click(640, 420); await wait(p, 1200);
    // teaching review fix 5 (Nov 18): after the click the centre prompt also teaches moving and looking (CONFIG.fresh.wakeTalk), shown in the centre line
    const c1 = await p.evaluate(() => [window.__game.mouseHeld, window.__game.uiNow(), getComputedStyle(document.getElementById('scout')).display, window.__game.wakeText(), document.getElementById('csay').textContent]);
    add('the first click only takes the mouse (held ' + c1[0] + ', panel ' + c1[1] + ', dialog ' + c1[2] + '); the prompt then reads "' + c1[3] + '" (centre: "' + c1[4] + '")', c1[0] === true && c1[1] === null && c1[2] === 'none' && c1[3] === 'W A S D to move · mouse to look · E to talk to Marla' && c1[4] === c1[3]);
    await press(p, 'KeyE'); await wait(p, 1200);
    const d1 = await p.evaluate(() => { const sc = document.getElementById('scout'), v = (id) => { const e = document.getElementById(id), c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; };
      return { first: sc.classList.contains('first'), shown: getComputedStyle(sc).display, line: document.getElementById('scoutLine').textContent, ride: document.getElementById('scoutRide').textContent, setup: v('scoutSetup'), ring: v('selRing'), go: v('go') && document.getElementById('go').textContent, back: v('sback') && document.getElementById('sback').textContent, toggle: v('ssetup') && document.getElementById('ssetup').textContent, controls: /W A S D|left thumb/.test(sc.textContent), h: Math.round(sc.scrollHeight) }; });
    add('day-1 first talk: her line, the ride-out line, "Ride out" and "Look around first", the pickers hidden behind "Set up the run", no controls text: ' + JSON.stringify(d1), d1.shown === 'flex' && d1.first && d1.line.length > 2 && /^Ride out: go loot the old street, then hold a house tonight\.$/.test(d1.ride) && !d1.setup && !d1.ring && d1.go === 'Ride out' && d1.back === 'Look around first' && d1.toggle === 'Set up the run' && !d1.controls && d1.h <= 720);
    await p.click('#ssetup'); await wait(p, 400); const st = await p.evaluate(() => [getComputedStyle(document.getElementById('selRing')).display, document.getElementById('ssetup').textContent]);
    add('"Set up the run" opens the ring and device pickers: ' + JSON.stringify(st), st[0] !== 'none' && st[1] === 'Hide the setup');
    await press(p, 'Escape'); await wait(p, 800);
    const e1 = await p.evaluate(() => [getComputedStyle(document.getElementById('scout')).display, getComputedStyle(document.getElementById('pause')).display, window.__game.uiNow(), window.__game.isPaused()]);
    add('Esc closes Marla\'s dialog and does not open the pause menu: ' + JSON.stringify(e1), e1[0] === 'none' && e1[1] === 'none' && e1[2] === null && e1[3] === false);
    add('the waking prompt is gone once the mouse was taken and Marla talked to ("' + (await p.evaluate(() => window.__game.wakeText())) + '")', (await p.evaluate(() => window.__game.wakeText())) === '');
    await press(p, 'KeyE'); await wait(p, 1000);
    const d2 = await p.evaluate(() => [document.getElementById('scout').classList.contains('first'), getComputedStyle(document.getElementById('selRing')).display, document.getElementById('sback').textContent, getComputedStyle(document.getElementById('ssetup')).display]);
    add('second talk: the pickers show as before, "Stay at the base", no toggle: ' + JSON.stringify(d2), !d2[0] && d2[1] !== 'none' && d2[2] === 'Stay at the base' && d2[3] === 'none');
    await p.evaluate(() => { document.getElementById('selRing').value = '0'; }); await press(p, 'Escape'); await wait(p, 800);
    const goal = await txt(p, 'bstat'); add('the goal line names the ring the picker is set to: ' + goal, /next ride: ring 1 /.test(goal));
    await p.evaluate(() => { window.__fakeLock = false; }); await wait(p, 700); const ml0 = await shown(p, 'mlook');
    await key(p, 'KeyN'); await wait(p, 900); const nb = await p.evaluate(() => [document.getElementById('csay').textContent, getComputedStyle(document.getElementById('mlook')).display]); await key(p, 'KeyN', 'keyup'); await wait(p, 700); const nb2 = await txt(p, 'csay');
    add('holding N in the base says "' + nb[0] + '" and hides the mouse hint (shown before: ' + ml0 + ', while N: ' + nb[1] + '); letting go clears it ("' + nb2 + '")', nb[0] === 'Ride out with Marla first' && nb[1] === 'none' && ml0 && nb2 !== nb[0]);
    await p.evaluate(() => { const g = window.__game; g.setBase(3, 7); g.setYaw(0); }); await wait(p, 1200); // the quest box hides while Marla is the target (within 2.6 m), so step away from her first
    await p.mouse.click(640, 420); await wait(p, 800);
    const q0 = await txt(p, 'bq'); const bb = await (await p.$('#bq')).boundingBox(); const m0 = await txt(p, 'msg');
    await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await wait(p, 700); const q1 = await txt(p, 'bq'); const m1 = await p.evaluate(() => [document.getElementById('msg').textContent, window.__game.uiNow()]);
    add('the quest chip says Tab on desktop (' + JSON.stringify(q0.split('\n').pop()) + '); a click on it (mouse held) opens the list and nothing else (msg "' + m1[0] + '", panel ' + m1[1] + ')', (!/\+\d+ more/.test(q0) || /\(Tab\)$/.test(q0)) && q1.split('\n').length >= q0.split('\n').length && m1[0] === m0 && m1[1] === null);
    await press(p, 'Tab'); await wait(p, 600); add('Tab toggles the quest list', (await txt(p, 'bq')) !== q1 || !/more/.test(q0));
    await press(p, 'KeyP'); await wait(p, 700);
    const pm = await p.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), h = document.querySelector('#pause h1').getBoundingClientRect(), m = r('bMus'), hit = !(m.right <= h.left || h.right <= m.left || m.bottom <= h.top || h.bottom <= m.top); return { shown: getComputedStyle(document.getElementById('pause')).display, btns: ['pKeys', 'pJournal', 'pMap'].map((id) => getComputedStyle(document.getElementById(id)).display !== 'none' && r(id).width > 0), hit, mus: [Math.round(m.left), Math.round(m.top)], bottom: Math.round(Math.max(...[...document.querySelectorAll('#pause button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().bottom))) }; });
    add('pause menu: Keys, Journal and Map; the music button is clear of "Paused" (at ' + pm.mus + '); every button on screen (bottom ' + pm.bottom + ')', pm.shown === 'flex' && pm.btns.every(Boolean) && !pm.hit && pm.bottom <= 720);
    await p.click('#pKeys'); await wait(p, 600); const kc = await p.evaluate(() => [getComputedStyle(document.getElementById('keys')).display, getComputedStyle(document.getElementById('pause')).display, document.getElementById('keysBody').textContent]);
    add('Keys opens the desktop Keys card (desktop keys only)', kc[0] === 'flex' && kc[1] === 'none' && /Left click/.test(kc[2]) && !/thumb|tap /i.test(kc[2]));
    await press(p, 'Escape'); await wait(p, 600); const k2 = await p.evaluate(() => [getComputedStyle(document.getElementById('keys')).display, getComputedStyle(document.getElementById('pause')).display, window.__game.isPaused()]);
    add('Esc closes the Keys card back to the pause menu: ' + JSON.stringify(k2), k2[0] === 'none' && k2[1] === 'flex' && k2[2]);
    await p.click('#pMap'); await wait(p, 800); const mp = await p.evaluate(() => { const c = document.getElementById('bmap'), r = c.getBoundingClientRect(), d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data; return [getComputedStyle(document.getElementById('bigmap')).display, Math.round(r.width), Math.round(r.bottom), d[3]]; });
    add('Map opens a big round map (' + mp[1] + ' px, drawn ' + (mp[3] > 0) + ', bottom ' + mp[2] + ')', mp[0] === 'flex' && mp[1] >= 300 && mp[3] > 0 && mp[2] <= 720);
    await press(p, 'Escape'); await wait(p, 600); add('Esc closes the map back to the pause menu', (await p.evaluate(() => getComputedStyle(document.getElementById('pause')).display)) === 'flex');
    await p.click('#pJournal'); await wait(p, 1500); const jb = await p.evaluate(() => [getComputedStyle(document.getElementById('qb')).display, document.getElementById('qb').classList.contains('is-book'), window.__game.uiNow()]);
    add('Journal opens the journal book from the pause menu: ' + JSON.stringify(jb), jb[0] !== 'none' && jb[1] && jb[2] === 'journal');
    await press(p, 'Escape'); await wait(p, 800); const j2 = await p.evaluate(() => [getComputedStyle(document.getElementById('qb')).display, getComputedStyle(document.getElementById('pause')).display, window.__game.isPaused()]);
    add('Esc closes the book back to the pause menu: ' + JSON.stringify(j2), j2[0] === 'none' && j2[1] === 'flex' && j2[2]);
    await press(p, 'Escape'); await wait(p, 600); add('Esc on the pause menu resumes', (await p.evaluate(() => window.__game.isPaused())) === false);
    await key(p, 'KeyH'); await wait(p, 700); const hk = await p.evaluate(() => [getComputedStyle(document.getElementById('keys')).display, getComputedStyle(document.getElementById('keys')).pointerEvents]); await key(p, 'KeyH', 'keyup'); await wait(p, 600);
    const hk2 = await p.evaluate(() => getComputedStyle(document.getElementById('keys')).display); add('holding H shows the Keys card (not in the way of the mouse) and letting go hides it: ' + JSON.stringify(hk) + ' -> ' + hk2, hk[0] === 'flex' && hk[1] === 'none' && hk2 === 'none');
    await ctx.close(); });
  // ---- DESKTOP: the drill machine comes in view, ring or edge arrow, the full bar, the second line
  await sect('desktop drill', async () => { const { ctx, p } = await open({ viewport: { width: 1280, height: 720 } });
    await p.evaluate(() => { localStorage.removeItem('dawnpunk.drill'); const g = window.__game; g.enterBase(); g.save.nights = 0; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await wait(p, 1500);
    await p.evaluate(() => window.__game.endDay()); await p.waitForFunction(() => { const g = window.__game, d = g.drillInfo(); return d && d.step === 'shoot' && g.sim.gloom.length > 0; }, null, { timeout: SLOW }).catch(() => {}); await wait(p, 2500);
    const sp = await p.evaluate(() => { const g = window.__game, s = g.sim, P = s.player, C = g.cfg.drill, f = g.drillFrom(), fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let min = 999; for (const b of s.breaches) { if (b.floor !== P.floor) continue; const x = b.outX - b.nx * C.spawnOut, z = b.outZ - b.nz * C.spawnOut, d = Math.hypot(x - P.x, z - P.z); if (!s.openAt(P.x, P.z, x, z, P.floor)) continue; min = Math.min(min, Math.acos(Math.max(-1, Math.min(1, ((x - P.x) * fx + (z - P.z) * fz) / d))) * 180 / Math.PI); } return { f, min: Math.round(min), mark: window.__drillMark, devs: [...document.querySelectorAll('#slots .b.dev')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent), sub: document.getElementById('dsub').textContent, subOn: getComputedStyle(document.getElementById('dsub')).display, marla: document.getElementById('marla').textContent }; });
    add('the drill machine comes through an opening ' + (sp.f ? Math.round(sp.f.ang) : '?') + ' degrees off the view (closest visible one: ' + sp.min + ')', sp.f && (sp.f.ang <= 25.5 || Math.round(sp.f.ang) <= sp.min + 1));
    add('it is marked: ' + JSON.stringify(sp.mark), sp.mark && (sp.mark.ring || sp.mark.arrow));
    add('the full device bar shows during the drill, each slot with its cost: ' + JSON.stringify(sp.devs), sp.devs.length >= 3 && sp.devs.every((t) => /\d/.test(t)));
    add('under Marla\'s order ("' + sp.marla + '") a plain second line names the key: "' + sp.sub + '"', sp.subOn !== 'none' && /left click/i.test(sp.sub) && sp.marla.length <= 44);
    { const pos = await p.evaluate(() => { const m = document.getElementById('marla').getBoundingClientRect(), s = document.getElementById('dsub').getBoundingClientRect(), c = document.getElementById('dchip').getBoundingClientRect(); return [Math.round(s.top - Math.max(m.bottom, c.bottom)), Math.round(Math.abs(s.right - m.right))]; }); add('the second line sits under her card and key chip (gap ' + pos[0] + ' px, right edges ' + pos[1] + ' px apart)', pos[0] >= 0 && pos[0] <= 14 && pos[1] <= 2); }
    await p.evaluate(() => { const g = window.__game; g.setYaw(g.yaw + Math.PI); }); await wait(p, 2000); const back = await p.evaluate(() => window.__drillMark);
    add('looking away, an edge arrow points to it: ' + JSON.stringify(back), back && back.arrow && !back.ring);
    await p.evaluate(() => { window.__game.sim.player.energy = 60; window.__game.fire(); }); await p.waitForFunction(() => (window.__game.drillInfo() || {}).step === 'place', null, { timeout: SLOW }).catch(() => {});
    await wait(p, 1500); const pl = await p.evaluate(() => [document.getElementById('dsub').textContent, window.__drillMark]); add('place step: "' + pl[0] + '", the machine still marked ' + JSON.stringify(pl[1]), /Right click to place it where they walk in/.test(pl[0]) && pl[1] && (pl[1].ring || pl[1].arrow));
    await p.mouse.click(640, 360, { button: 'right' }); await p.waitForFunction(() => (window.__game.drillInfo() || {}).step === 'switch', null, { timeout: SLOW }).catch(() => {}); await wait(p, 1200);
    const sw = await p.evaluate(() => [window.__game.drillInfo() && window.__game.drillInfo().step, document.getElementById('dsub').textContent, window.__drillMark]); add('switch step: "' + sw[1] + '", no marker ' + JSON.stringify(sw[2]), sw[0] === 'switch' && /1 to 5|wheel/.test(sw[1]) && sw[2] && !sw[2].ring && !sw[2].arrow);
    await p.evaluate(() => { const g = window.__game; g.sim.player.energy = 60; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' })); }); await wait(p, 1500); await gameWait(p, (await p.evaluate(() => window.__game.cfg.devBar.openSecs)) + 0.5);
    const n2 = await p.evaluate(() => [...document.querySelectorAll('#slots .b.dev')].filter((e) => e.getBoundingClientRect().width > 0).length); add('after the drill the bar is back to the picked device only (' + n2 + ')', n2 === 1);
    await ctx.close(); });
  // ---- PHONE: USE pulses on waking, phone keys only, the drill
  await sect('phone', async () => { const { ctx, p } = await open({ ...devices['Pixel 7 landscape'] });
    await p.evaluate(() => { localStorage.removeItem('dawnpunk.drill'); window.__game.enterBase(); }); await wait(p, 2000);
    const w = await p.evaluate(() => [document.getElementById('bFire').classList.contains('pulse'), document.getElementById('bFire').textContent, window.__game.wakeText()]);
    add('phone waking: the USE button pulses and no key text shows: ' + JSON.stringify(w), w[0] && /USE/.test(w[1]) && w[2] === '');
    await p.evaluate(() => { window.__game.save.talkedMarla = true; }); await wait(p, 800); add('after talking to Marla the pulse stops', !(await p.evaluate(() => document.getElementById('bFire').classList.contains('pulse'))));
    await p.evaluate(() => { const d = document.getElementById('bPause'), o = { bubbles: true, pointerId: 1, pointerType: 'touch' }; d.dispatchEvent(new PointerEvent('pointerdown', o)); }); await wait(p, 600);
    await p.evaluate(() => document.getElementById('pKeys').click()); await wait(p, 500); const kc = await p.evaluate(() => [getComputedStyle(document.getElementById('keys')).display, document.getElementById('keysBody').textContent, (() => { const r = document.querySelector('#keys .kcard').getBoundingClientRect(); return Math.round(r.bottom); })(), innerHeight]);
    add('phone Keys card: touch controls only, fits the screen (bottom ' + kc[2] + ' of ' + kc[3] + ')', kc[0] === 'flex' && /thumb/.test(kc[1]) && !/click|W A S D|Esc/.test(kc[1]) && kc[2] <= kc[3]);
    await p.evaluate(() => document.getElementById('keysClose').click()); await wait(p, 400);
    const pm = await p.evaluate(() => { const h = document.querySelector('#pause h1').getBoundingClientRect(), m = document.getElementById('bMus').getBoundingClientRect(); return [!(m.right <= h.left || h.right <= m.left || m.bottom <= h.top || h.bottom <= m.top), Math.round(Math.max(...[...document.querySelectorAll('#pause button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().bottom))), innerHeight]; });
    add('phone pause menu: music button clear of "Paused", every button on screen (bottom ' + pm[1] + ' of ' + pm[2] + ')', !pm[0] && pm[1] <= pm[2]);
    await p.evaluate(() => document.getElementById('resume').click()); await wait(p, 300);
    await p.evaluate(() => { const g = window.__game; g.save.nights = 0; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await wait(p, 1500); await p.evaluate(() => window.__game.endDay());
    await p.waitForFunction(() => { const g = window.__game, d = g.drillInfo(); return d && d.step === 'shoot' && g.sim.gloom.length > 0; }, null, { timeout: SLOW }).catch(() => {}); await wait(p, 2500);
    const ph = await p.evaluate(() => ({ mark: window.__drillMark, devs: [...document.querySelectorAll('.b.dev')].filter((e) => e.getBoundingClientRect().width > 0).length, sw: (() => { const e = document.getElementById('bSwitch'), r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 ? r.toJSON() : null; })(), devR: [...document.querySelectorAll('.b.dev')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect().toJSON()), sub: document.getElementById('dsub').textContent, fire: document.getElementById('bFire').classList.contains('pulse') }));
    add('phone drill: the machine is marked ' + JSON.stringify(ph.mark) + ', the full bar shows (' + ph.devs + '), FIRE pulses', ph.mark && (ph.mark.ring || ph.mark.arrow) && ph.devs >= 3 && ph.fire);
    add('phone drill: the switch tab shows beside the full bar without covering a device', ph.sw && ph.devR.every((r) => r.right <= ph.sw.left || r.left >= ph.sw.right || r.bottom <= ph.sw.top || r.top >= ph.sw.bottom));
    add('phone drill: the second line names the button, no mouse words: "' + ph.sub + '"', /FIRE/.test(ph.sub) && !/click|mouse|key/i.test(ph.sub));
    await ctx.close(); });
  // ---- LOADING PAGE: the V, the bar, the stage line, the lore line and the begin button as one group in the middle; the music button top right
  // ---- MARLA TEACHING FIXES (fresh-player review Nov 18): a scripted day 1 on desktop and phone: the collector order names the real control and repeats rarely, no "undefined" ever on screen,
  // the first collector keeps its own message, the night-start line matches the button, the bell is followed by one line
  for (const [lab, opts] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['phone', { ...devices['Pixel 7 landscape'] }]]) await sect('teach ' + lab, async () => { const { ctx, p } = await open(opts);
    const C = await p.evaluate(() => { const c = typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg; return { F: c.firstSolar, N: c.nightStart, bell: c.day.bell }; }), D = lab === 'desktop';
    await p.evaluate(() => { localStorage.setItem('dawnpunk.drill', '{"skip":true}'); const g = window.__game; g.enterBase(); g.save.nights = 0; g.save.solarDone = false; document.getElementById('selRing').value = '0'; g.startRun(0);
      const S = window.__seen = { marla: [], undef: [], solarShows: 0 }; let last = ''; const f = () => { const m = document.getElementById('marla'), t = m.classList.contains('hq') ? '' : m.textContent; if (t && !S.marla.includes(t)) S.marla.push(t); if (t !== last && /Collector first/.test(t)) S.solarShows++; last = t;
        const b = document.body.innerText; if (/undefined/.test(b) && S.undef.length < 5) S.undef.push(b.split('\n').filter((l) => /undefined/.test(l))[0]); requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await gameWait(p, 3); await p.evaluate(() => window.__game.enterHouse(0)); await gameWait(p, 2);
    const s1 = await p.evaluate(() => ({ marla: document.getElementById('marla').textContent, b0: document.getElementById('b0').textContent, chip: document.getElementById('dchip').textContent }));
    add(lab + ' teach: the first house\'s collector order names the real control ("' + s1.marla + '", chip "' + s1.chip + '", collector button "' + s1.b0 + '")', s1.marla === (D ? C.F.marlaD : C.F.marlaP) && (D ? s1.chip === 'Q' : /SOLAR/.test(s1.b0)));
    await p.evaluate(() => window.__game.leaveHouse()); await frames(p, 2); const m1 = await txt(p, 'msg');
    add(lab + ' teach: leaving before the collector flashes "' + m1 + '"', m1 === (D ? C.F.blockD : C.F.blockP));
    await gameWait(p, 20); const n1 = await p.evaluate(() => window.__seen.solarShows);
    add(lab + ' teach: over 22 game seconds the collector order showed ' + n1 + ' times (every ' + C.F.repeat + ' s, not every 4 s)', n1 >= 1 && n1 <= Math.ceil(22 / C.F.repeat));
    const pl = await p.evaluate(() => { const g = window.__game, s = g.sim, P = s.player, bs = s.breaches.filter((b) => b.floor === P.floor && b.type !== 'hatch'), out = [];
      for (const b of bs.slice(0, 4)) { P.x = b.inX + b.nx * 1.0; P.z = b.inZ + b.nz * 1.0; P.yaw = Math.atan2(b.nx, b.nz); const n = s.devices.length; g.doPlace('collector'); out.push([s.devices.length > n, document.getElementById('msg').textContent]); if (out.length === 1 && !out[0][0]) continue; if (out.filter((q) => q[0]).length >= 2) break; } return out; });
    const ok = pl.filter((q) => q[0]);
    add(lab + ' teach: the first collector keeps "First collector up..." and the next one reads "Solar collector placed: ..." (' + JSON.stringify(pl.map((q) => q[1])) + ')', ok.length >= 2 && /^First collector up\./.test(ok[0][1]) && /^Solar collector placed: /.test(ok[1][1]));
    await gameWait(p, 60); await p.evaluate((b) => { window.__game.sim.dayT = b + 0.5; }, C.bell); await gameWait(p, 13);
    const s2 = await p.evaluate(() => ({ seen: window.__seen.marla, undef: window.__seen.undef, dusk: document.getElementById('bDusk').textContent }));
    const nl = D ? C.N.lineD : C.N.lineP, hl = D ? C.N.houseD : C.N.houseP, bad = s2.seen.filter((t) => /HOLD DUSK|Sun is full/.test(t));
    add(lab + ' teach: the night-start line (' + nl + ') and the after-bell line (' + hl + ') were said, the button reads "' + s2.dusk + '", no old wording' + (bad.length ? ' (' + bad.join(' | ') + ')' : ''), s2.seen.includes(nl) && s2.seen.includes(hl) && s2.dusk === C.N.btn && !bad.length);
    add(lab + ' teach: no "undefined" on screen in the whole day-1 run' + (s2.undef.length ? ' (' + s2.undef.join(' | ') + ')' : ''), s2.undef.length === 0);
    await ctx.close(); });
  if (!only.length || only.includes('loading')) for (const [lab, opts] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['phone', { ...devices['Pixel 7 landscape'] }]]) {
    const { ctx, p } = await open(opts); await p.waitForFunction(() => window.__splash && window.__splash.phase === 'ready', null, { timeout: 180000 }).catch(() => {}); await p.waitForTimeout(1200);
    const g = await p.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), a = r('slogo'), e = r('enter'), m = r('bMus'), H = innerHeight, W = innerWidth; return { top: Math.round(a.top), bottom: Math.round(e.bottom), mid: Math.round((a.top + e.bottom) / 2), H, mus: [Math.round(W - m.right), Math.round(m.top)], gapLogoBar: Math.round(r('sbar').top - a.bottom) }; });
    add(lab + ' loading page: the group (' + g.top + '-' + g.bottom + ') is centred (middle ' + g.mid + ' of ' + g.H + '), logo just above the bar (' + g.gapLogoBar + ' px), music button top right ' + JSON.stringify(g.mus), Math.abs(g.mid - g.H / 2) <= g.H * 0.08 && g.top >= 0 && g.bottom <= g.H && g.gapLogoBar >= 0 && g.gapLogoBar <= 40 && g.mus[0] <= 40 && g.mus[1] <= 40);
    await ctx.close(); }
  add('no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), !errs.length);
  let bad = 0; for (const [, ok] of out) if (!ok) bad++; console.log(bad ? 'SOME FAILED' : 'ALL PASS'); await b.close();
})();
