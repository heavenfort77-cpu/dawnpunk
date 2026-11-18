// HUD2 check (2026-11-16): clock in hours (never seconds) by day and night, no Gloom count at night, Marla's portrait beside her line (desktop),
// a picture on every device slot, the green dormant tag when aiming at a sleeping machine by day, waking one by day (shot and bump) adds CONFIG.dormant.wakeExtra
// Gloom to tonight and it does not attack, the title shows the lore lines and every title button works, and nothing overlaps at 1280x720, 1920x1080 and phone 844x390.
// Usage: node tools/hud2check.cjs [low|high] (default low). Prints PASS / FAIL lines only, then ALL PASS or SOME FAILED. One headless browser, software renderer, fake pointer lock.
const { chromium } = require('playwright');
const tier = process.argv[2] || 'low', URL0 = 'file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + tier;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const SLOW = tier === 'high' ? 4 : 1, wait = (p, ms) => p.waitForTimeout(ms * SLOW);
const DAY = /^Daylight left (\d+h \d\dm|\d+m)$/, NIGHT = /^Dawn in (\d+h \d\dm|\d+m)$/, SECS = /\b\d+\s?s\b|\bseconds?\b|\bsec\b/i;
// visible boxes of the named elements, and the pairs that overlap by more than 2 px both ways (a box inside its own parent is not counted)
async function overlaps(p, ids) {
  return p.evaluate((ids) => { const vis = (e) => { if (!e) return null; for (let q = e; q && q !== document.body; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && (e.textContent.trim() || e.id === 'arc' || e.querySelector('.ic') || e.tagName === 'BUTTON') ? r : null; };
    const L = ids.map((id) => [id, vis(document.querySelector(id))]).filter((q) => q[1]), bad = [];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const [na, a] = L[i], [nb, b] = L[j]; const ea = document.querySelector(na), eb = document.querySelector(nb); if (ea.contains(eb) || eb.contains(ea)) continue;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 2 && h > 2) bad.push(na + ' x ' + nb + ' (' + Math.round(w) + 'x' + Math.round(h) + ')'); }
    const off = L.filter(([n, r]) => r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map((q) => q[0] + ' off screen');
    return { n: L.length, bad: bad.concat(off) }; }, ids);
}
// CI Nov 18: the old title (#tkick/#tword/#ttag lore lines over the dormant machines picture, #tdesc, #thelp) became the start flow's loading page (V logo #slogo, bar, rotating lore line #slore, begin #enter)
const TITLE_IDS = ['#slogo', '#sbar', '#slore', '#enter', '#watch', '#lookT', '#gfxT', '#reset', '#bMus'];
const DESK_IDS = ['#vit', '#clk', '#hud #marla', '#slots', '#dkeys', '#bDusk', '#bLeave', '#bPause', '#bMus', '#aim', '#coins', '#bprompt'];
const PHONE_IDS = ['#hpb', '#enb', '#time', '#count', '#hud #marla', '#b0', '#b1', '#b2', '#b3', '#b4', '#b5', '#bEat', '#bFire', '#bDusk', '#bLeave', '#bPause', '#bMus', '#aim', '#coins', '#bprompt'];
async function over(p, ids, where) { const r = await overlaps(p, ids); ok(r.bad.length === 0 && r.n >= 3, 'nothing overlaps: ' + where + ' (' + r.n + ' boxes)' + (r.bad.length ? ': ' + r.bad.join(', ') : '')); }
const clockText = (p) => p.evaluate(() => document.getElementById('time').textContent.trim());
const hudSecs = (p) => p.evaluate(() => ['time', 'count', 'marla', 'msg', 'aim', 'enL', 'bprompt'].map((id) => document.getElementById(id).textContent).join(' | '));
const pics = (p) => p.evaluate(() => ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'bEat'].map((id) => { const e = document.getElementById(id); if (getComputedStyle(e).display === 'none') return null; const ic = e.querySelector('.ic'), cs = ic && getComputedStyle(ic), r = ic && ic.getBoundingClientRect(); return [id, !!(cs && cs.display !== 'none' && /data:image\/webp/.test(cs.backgroundImage) && r.width > 8)]; }).filter(Boolean));
async function gotoGame(p) { await p.goto(URL0, { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 }); }

async function titlePart(p, label, sizes) {
  // CI Nov 18: the same two title checks on the start flow: the DAWNPUNK wordmark, the tagline (CONFIG.splash.tag) and a lore line on the loading page; the title picture is now the V logo
  await p.waitForFunction(() => (document.getElementById('slore').textContent || '').trim().length > 0, null, { timeout: 60000 }).catch(() => {});
  const t = await p.evaluate(() => [(document.getElementById('sword') || { textContent: '' }).textContent.trim(), document.getElementById('stag').textContent, document.getElementById('slore').textContent.trim(), !!document.querySelector('#slogo svg'), window.CONFIG && window.CONFIG.splash ? window.CONFIG.splash.tag : '?']);
  ok(t[0] === 'DAWNPUNK' && t[1] === t[4] && t[2].length > 10, label + ': title shows the lore lines (' + t[1] + ' | ' + t[2].slice(0, 60) + ')');
  ok(t[3], label + ': title shows the title picture (the V logo)');
  for (const [w, h] of sizes) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(400); await over(p, TITLE_IDS, label + ' title ' + w + 'x' + h); }
}
async function buttons(p, b) {
  // CI Nov 18: window.__game.cfg is now the CONFIG object itself, not a function (read either way below)
  // CI Nov 18: in the current game New game (#reset) and Watch the opening (#watch) sit in the pause menu, and the title's Look / Graphics buttons (#lookT, #gfxT) are hidden
  // (the Graphics switch is the pause menu's #bGfx, tested by tools/qualitycheck.cjs). So the two buttons are tried from the pause menu in the base; the old title test is in hud2check_before_ci.cjs.
  console.log('INFO title Look / Graphics buttons: hidden in the current game (display:none), not tested here');
  await p.evaluate(() => window.__game.enterBase()); await wait(p, 1500);
  await p.evaluate(() => document.getElementById('bPause').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))); await wait(p, 800);
  await p.click('#reset'); ok(/Tap again/.test(await p.evaluate(() => document.getElementById('reset').textContent)), 'pause menu: New game asks to tap again');
  await p.click('#watch'); await wait(p, 1500); ok(await p.evaluate(() => getComputedStyle(document.getElementById('cine')).display !== 'none'), 'pause menu: Watch the opening plays the opening');
  await p.click('#cineSkip').catch(() => {}); await wait(p, 800); await gotoGame(p);
  await p.click('#enter'); await wait(p, 1500); ok(await p.evaluate(() => document.getElementById('menu').style.display === 'none' && document.getElementById('hud').style.display === 'block'), 'title: Enter the base enters the base');
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  // ---------------- desktop (mouse) ----------------
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript(() => { window.__dtMax = 0.6; window.__fakeLock = false; }); await gotoGame(p);
    ok(await p.evaluate(() => matchMedia('(pointer: fine)').matches), 'desktop page has a fine pointer');
    await titlePart(p, 'desktop', [[1280, 720], [1920, 1080], [1280, 720]]); await buttons(p, b);
    const C = await p.evaluate(() => { const g = window.__game, c = typeof g.cfg === 'function' ? g.cfg() : g.cfg; return { d: c.dormant, clock: c.clock }; });
    await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); }); await wait(p, 2500);
    let tx = await clockText(p); ok(DAY.test(tx), 'desktop street by day: clock in hours "' + tx + '"');
    // aim at a sleeping machine from 5 m
    await p.evaluate(() => { const g = window.__game, d = g.run.dormant[0]; g.setTown(d.x + 5, d.z); g.setYaw(Math.atan2(5, 0)); g.setPitch(0); }); await wait(p, 1500);
    const tag = await p.evaluate(() => { const a = document.getElementById('aim'); return [a.className, a.textContent, getComputedStyle(a).display]; });
    ok(/dorm/.test(tag[0]) && /dormant/i.test(tag[1]) && /power saver/i.test(tag[1]) && /Leave it\. Waking it costs you: more of them tonight\./.test(tag[1]) && tag[2] !== 'none', 'desktop: aiming at a dormant machine by day shows the green tag "' + tag[1] + '"');
    ok(await p.evaluate(() => /rgb\(57, 217, 138\)/.test(getComputedStyle(document.getElementById('aim')).borderTopColor)), 'desktop: the dormant tag frame is green');
    for (const [w, h] of [[1280, 720], [1920, 1080], [1280, 720]]) { await p.setViewportSize({ width: w, height: h }); await wait(p, 600); await over(p, DESK_IDS, 'desktop street by day ' + w + 'x' + h); }
    // wake one with a shot
    const s0 = await p.evaluate(() => { const r = window.__game.run; return [r.wakeExtra || 0, r.hurt || 0]; });
    await p.evaluate(() => window.__game.fire()); await wait(p, 300);
    const s1 = await p.evaluate(() => { const r = window.__game.run, d = r.dormant[0]; return [r.wakeExtra || 0, r.hurt || 0, d.stir || 0, d.awake || 0, document.getElementById('marla').textContent]; });
    ok(s1[0] - s0[0] === Math.min(C.d.wakeExtra, C.d.wakeMax), 'shooting a dormant machine by day adds ' + C.d.wakeExtra + ' Gloom for tonight (' + s0[0] + ' -> ' + s1[0] + ')');
    ok(s1[2] > 0 && s1[3] === 0, 'the shot machine stirs (stir ' + s1[2].toFixed(2) + ') and does not wake to attack (awake ' + s1[3] + ')');
    ok(/remember tonight/.test(s1[4]), 'Marla says it: "' + s1[4] + '"');
    // Marla's portrait beside her line
    const face = await p.evaluate(() => { const m = document.getElementById('marla'), a = getComputedStyle(m, '::after'), r = m.getBoundingClientRect(); return [a.backgroundImage.slice(0, 30), parseFloat(a.width), parseFloat(a.left), parseFloat(m.style.paddingLeft || getComputedStyle(m).paddingLeft), r.right > innerWidth / 2, getComputedStyle(m).display]; });
    ok(/data:image\/jpeg/.test(face[0]) && face[1] >= 40 && face[2] + face[1] <= face[3] && face[4] && face[5] !== 'none', 'desktop: Marla\'s portrait (' + face[1] + ' px) sits beside her line, top right');
    // 1 more shot at the same machine adds nothing; bump a second machine
    await wait(p, 1500); await p.evaluate(() => window.__game.fire()); await wait(p, 300);
    const s2 = await p.evaluate(() => window.__game.run.wakeExtra || 0); ok(s2 === s1[0], 'the same machine woken again adds nothing (' + s2 + ')');
    await p.evaluate(() => { const g = window.__game, d = g.run.dormant[1]; g.setTown(d.x + d.r * 0.6, d.z); }); await wait(p, 2500);
    const s3 = await p.evaluate(() => { const r = window.__game.run; return [r.wakeExtra || 0, r.hurt || 0, r.dormant[1].awake || 0]; });
    ok(s3[0] - s2 === Math.min(C.d.wakeExtra, C.d.wakeMax - s2), 'bumping into another dormant machine adds ' + C.d.wakeExtra + ' more (' + s2 + ' -> ' + s3[0] + ')');
    ok(s3[1] === s0[1] && s3[2] === 0, 'no attack by day after a shot or a bump (hurt ' + s0[1] + ' -> ' + s3[1] + ')');
    // into a house: day clock, pictures, then dusk adds the woken ones
    await p.evaluate(() => window.__game.enterHouse(0)); await wait(p, 2500);
    tx = await clockText(p); ok(DAY.test(tx), 'desktop house by day: clock in hours "' + tx + '"');
    let pc = await pics(p); ok(pc.length >= 2 && pc.every((q) => q[1]), 'desktop by day: each shown slot has a picture ' + JSON.stringify(pc));
    const t0 = await p.evaluate(() => [window.__game.sim.total, window.__game.sim.spawns.length, window.__game.run.wakeExtra]);
    await p.evaluate(() => window.__game.endDay()); await wait(p, 2500);
    const t1 = await p.evaluate(() => [window.__game.sim.total, window.__game.sim.spawns.length, window.__game.sim.phase]);
    ok(t1[2] === 'night' && t1[0] === t0[0] + t0[2] && t1[1] === t0[1] + t0[2] && t0[2] > 0, 'tonight\'s Gloom count rose by the woken amount: ' + t0[0] + ' -> ' + t1[0] + ' (+' + t0[2] + ')');
    await p.evaluate(() => { const s = window.__game.sim; s.t = 40; s.player.energy = 30; s.player.hp = 100; });
    for (let k = 0; k < 40 && !(await p.evaluate(() => window.__game.sim.gloom.length)); k++) await p.waitForTimeout(1000);
    await p.evaluate(() => window.__game.say('Gloom on your left. Look awake, Potts.')); await wait(p, 800);
    tx = await clockText(p); ok(NIGHT.test(tx), 'desktop at night: clock in hours "' + tx + '"');
    const cn = await p.evaluate(() => [document.getElementById('count').textContent, window.__game.sim.gloom.length]); ok(cn[1] > 0 && !/Gloom/i.test(cn[0]), 'desktop at night: no Gloom count with ' + cn[1] + ' machines in: "' + cn[0] + '"');
    pc = await pics(p); ok(pc.length >= 3 && pc.every((q) => q[1]), 'desktop at night: each slot has a picture ' + JSON.stringify(pc));
    ok(await p.evaluate(() => document.body.classList.contains('hn') && getComputedStyle(document.getElementById('vig')).display === 'block' && /rgb\(122, 142, 160\)/.test(getComputedStyle(document.getElementById('clk')).borderTopColor)), 'desktop at night: steel-blue frames and a dark screen edge');
    ok(await p.evaluate(() => /data:image\/jpeg/.test(getComputedStyle(document.getElementById('marla'), '::after').backgroundImage)), 'desktop at night: Marla\'s portrait still beside her line');
    ok(!SECS.test(await hudSecs(p)), 'desktop: no seconds shown to the player: "' + (await hudSecs(p)).slice(0, 160) + '"');
    for (const [w, h] of [[1280, 720], [1920, 1080]]) { await p.setViewportSize({ width: w, height: h }); await wait(p, 600); await p.evaluate(() => window.__game.say('Gloom on your left. Look awake, Potts.')); await over(p, DESK_IDS.concat(['#arc']), 'desktop night ' + w + 'x' + h); }
    await ctx.close(); }
  // ---------------- phone (touch, 844x390) ----------------
  { const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), p = await ctx.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript(() => { window.__dtMax = 0.6; }); await gotoGame(p);
    ok(await p.evaluate(() => matchMedia('(pointer: coarse)').matches), 'phone page has a coarse pointer');
    await titlePart(p, 'phone', [[844, 390]]);
    await p.tap('#enter', { timeout: 240000 }); await wait(p, 1500); ok(await p.evaluate(() => document.getElementById('menu').style.display === 'none'), 'phone: Enter the base works by tap');
    await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); }); await wait(p, 2500);
    let tx = await clockText(p); ok(DAY.test(tx), 'phone street by day: clock in hours "' + tx + '"'); await over(p, PHONE_IDS, 'phone street by day 844x390');
    await p.evaluate(() => window.__game.enterHouse(0)); await wait(p, 2500); tx = await clockText(p); ok(DAY.test(tx), 'phone house by day: clock in hours "' + tx + '"');
    let pc = await pics(p); ok(pc.length >= 2 && pc.every((q) => q[1]), 'phone by day: device buttons carry their picture ' + JSON.stringify(pc)); await over(p, PHONE_IDS, 'phone house by day 844x390');
    await p.evaluate(() => window.__game.endDay()); await wait(p, 2000); await p.evaluate(() => { const s = window.__game.sim; s.t = 40; s.player.hp = 100; });
    for (let k = 0; k < 40 && !(await p.evaluate(() => window.__game.sim.gloom.length)); k++) await p.waitForTimeout(1000);
    await p.evaluate(() => window.__game.say('Gloom on your left. Look awake, Potts.')); await wait(p, 800);
    tx = await clockText(p); ok(NIGHT.test(tx), 'phone at night: clock in hours "' + tx + '"');
    const cn = await p.evaluate(() => [document.getElementById('count').textContent, window.__game.sim.gloom.length]); ok(cn[1] > 0 && !/Gloom/i.test(cn[0]), 'phone at night: no Gloom count with ' + cn[1] + ' machines in: "' + cn[0] + '"');
    pc = await pics(p); ok(pc.length >= 3 && pc.every((q) => q[1]), 'phone at night: device buttons carry their picture ' + JSON.stringify(pc));
    ok(!SECS.test(await hudSecs(p)), 'phone: no seconds shown to the player'); await over(p, PHONE_IDS, 'phone night 844x390');
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('vit')).display === 'contents' && getComputedStyle(document.getElementById('dkeys')).display === 'none'), 'phone keeps its own layout (no desktop frames)');
    await ctx.close(); }
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ').slice(0, 200));
  console.log(fail ? 'SOME FAILED' : 'ALL PASS'); await b.close();
})();
