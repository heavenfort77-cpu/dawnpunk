// Night-1 drill and small-screen check (owner Nov 17 18:28). PASS/FAIL lines only. Usage: node tools/drillcheck.cjs [abs page.html]
// Desktop (mouse, 1280x720, low tier): each drill step advances only on its own action (a wrong action leaves it), the idle repeat, the end of the drill (held Gloom come back),
// skip (K) and that a skipped drill stays skipped; night 2: no key strip, the "H keys" tag, holding H shows the strip and the full device bar; the bar shows only the picked device
// and opens for a moment on a switch. Phone (Pixel 7 sideways): no key text, the step's button pulses, the switch tab opens the bar and a tap picks a device and closes it.
const { chromium, devices } = require('playwright');
(async () => {
  const page = process.argv[2] || require('path').resolve(__dirname, '../dist/index.html');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const out = [], errs = []; const add = (n, ok) => out.push([n, !!ok]);
  const open = async (opts) => { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.addInitScript(() => { window.__dtMax = 0.5; });
    await p.goto('file://' + page + '?quality=low&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 }); return { ctx, p }; };
  const night = async (p, nights) => { await p.evaluate((n) => { const g = window.__game; g.enterBase(); g.save.nights = n; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }, nights); await p.waitForTimeout(1500); await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(1500); };
  const step = (p) => p.evaluate(() => { const d = window.__game.drillInfo(); return d ? d.step : null; });
  const waitStep = async (p, want, ms = 20000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await step(p); if (s === want) return s; await p.waitForTimeout(400); } return s; };
  const vis = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; }).map((e) => e.id), sel);
  // ---- DESKTOP: the drill step by step
  { const { ctx, p } = await open({ viewport: { width: 1280, height: 720 } });
    await night(p, 0); let s = await waitStep(p, 'shoot'); add('night 1 starts the drill at "shoot" (' + s + ')', s === 'shoot'); await p.waitForTimeout(2500);
    const m1 = await p.evaluate(() => [document.getElementById('marla').textContent, document.getElementById('dchip').textContent, getComputedStyle(document.getElementById('dkeys')).display, window.__game.sim.gloom.length]);
    { const sel = await p.evaluate(() => { const e = document.querySelector('#slots .b.dev.sel'); return e ? e.textContent : ''; }); add('the drill picks an affordable device from its start (picked: ' + sel + ')', sel && !/need/.test(sel)); }
    add('Marla says the step, one key chip shows, no key strip, one Gloom at a time: ' + JSON.stringify(m1), m1[0].length > 0 && m1[0].length <= 44 && m1[1] === 'Left click' && m1[2] === 'none' && m1[3] <= 1);
    await p.keyboard.press('Digit2'); await p.waitForTimeout(500); s = await step(p); add('a wrong action (switch) leaves the step at "shoot" (' + s + ')', s === 'shoot');
    await p.evaluate(() => { window.__game.sim.player.energy = 60; window.__game.fire(); }); s = await waitStep(p, 'place', 3000); add('firing ends "shoot" -> "place" (' + s + ')', s === 'place');
    await p.keyboard.press('KeyF'); await p.waitForTimeout(400); s = await step(p); add('a wrong action (eat) leaves "place" (' + s + ')', s === 'place');
    await p.mouse.click(640, 360, { button: 'right' }); s = await waitStep(p, 'switch', 3000); add('right click places a device: "place" -> "switch" (' + s + ')', s === 'switch');
    { const cur = await p.evaluate(() => window.__game.drillInfo().sel); await p.evaluate((code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); }, cur === 0 ? 'Digit2' : 'Digit1'); } s = await waitStep(p, 'charge', 15000); add('pressing another device number (sent inside the page: after the headless right click, Playwright key presses did not arrive) ends "switch" -> "charge" (' + s + ' ' + JSON.stringify(await p.evaluate(() => window.__game.drillInfo())) + ')', s === 'charge');
    await p.evaluate(() => { window.__game.sim.player.energy = 60; }); await p.keyboard.down('Space'); await p.waitForFunction(() => { const c = document.getElementById('cross').style.borderColor; return c === 'rgb(255, 215, 106)' || c === '#ffd76a'; }, null, { timeout: 15000 }).catch(() => {}); await p.keyboard.up('Space'); s = await waitStep(p, 'eat', 4000); add('holding fire and letting go ends "charge" -> "eat" (' + s + ' ' + JSON.stringify(await p.evaluate(() => [window.__game.drillInfo(), Math.round(window.__game.sim.player.energy), document.getElementById('msg').textContent])) + ')', s === 'eat');
    const hp = await p.evaluate(() => window.__game.sim.player.hp); await p.keyboard.press('KeyF'); await p.waitForTimeout(600); s = await step(p);
    const after = await p.evaluate(() => { const s = window.__game.sim; return [s.spawns.length - s.spawned, document.getElementById('marla').textContent]; });
    add('eating (health ' + Math.round(hp) + ') ends the drill; the held Gloom come back (' + after[0] + ' still to come); Marla: ' + after[1], s === null && after[0] > 0);
    const st = await p.evaluate(() => localStorage.getItem('dawnpunk.drill')); add('done steps are saved: ' + st, /shoot/.test(st) && /eat/.test(st));
    await ctx.close(); }
  // ---- DESKTOP: idle repeat and skip
  { const { ctx, p } = await open({ viewport: { width: 1280, height: 720 } });
    await night(p, 0); await waitStep(p, 'shoot'); const l1 = await p.evaluate(() => document.getElementById('marla').textContent); await p.waitForTimeout(23000); const l2 = await p.evaluate(() => document.getElementById('marla').textContent);
    add('after 20 s idle Marla repeats the step, shorter: "' + l1 + '" -> "' + l2 + '"', l2 && l2 !== l1 && l2.length < l1.length);
    await p.keyboard.press('KeyK'); await p.waitForTimeout(600); const sk = await p.evaluate(() => [window.__game.drillInfo(), localStorage.getItem('dawnpunk.drill')]); add('K skips the drill and it is remembered: ' + JSON.stringify(sk), sk[0] === null && /skip/.test(sk[1]));
    await night(p, 0); await p.waitForTimeout(3000); const again = await step(p); add('a skipped drill does not come back (' + again + ')', again === null);
    await ctx.close(); }
  // ---- DESKTOP: night 2, a clean screen, H, the device bar
  { const { ctx, p } = await open({ viewport: { width: 1280, height: 720 } });
    await night(p, 1); await p.waitForTimeout(1500);
    const n2 = await p.evaluate(() => [getComputedStyle(document.getElementById('dkeys')).display, getComputedStyle(document.getElementById('hchip')).display, document.getElementById('hchip').textContent, window.__game.drillInfo()]);
    add('night 2: no key strip, an "H keys" tag, no drill: ' + JSON.stringify(n2), n2[0] === 'none' && n2[1] !== 'none' && /H keys/.test(n2[2]) && n2[3] === null);
    { const sp = await p.evaluate(() => { window.__game.sunPop(18); const e = document.getElementById('sunpop'), r = e.getBoundingClientRect(), b = document.getElementById('enb').getBoundingClientRect(); return [getComputedStyle(e).display, e.textContent, Math.round(r.left - b.right), Math.round(Math.abs((r.top + r.height / 2) - (b.top + b.height / 2)))]; });
      add('a boss Sun spill shows a gold pop by the Sun bar: ' + JSON.stringify(sp), sp[0] !== 'none' && /\+18 Sun/.test(sp[1]) && sp[2] >= 0 && sp[2] < 40 && sp[3] < 30); }
    { const note = await p.evaluate(() => getComputedStyle(document.getElementById('enNote')).display); add('night 2: the "Sun is down" note in the health box is hidden (' + note + ')', note === 'none'); }
    let v = await vis(p, '#slots .b.dev'); add('the device bar shows only the picked device: ' + v.join(','), v.length === 1);
    await p.keyboard.down('KeyH'); await p.waitForTimeout(600); const hk = await p.evaluate(() => getComputedStyle(document.getElementById('dkeys')).display); v = await vis(p, '#slots .b.dev'); await p.keyboard.up('KeyH'); await p.waitForTimeout(600);
    const hk2 = await p.evaluate(() => getComputedStyle(document.getElementById('dkeys')).display); add('holding H shows the key list (' + hk + ') and the full bar (' + v.length + '); letting go hides it (' + hk2 + ')', hk !== 'none' && v.length >= 3 && hk2 === 'none');
    await p.keyboard.press('Digit2'); await p.waitForTimeout(300); const v1 = await vis(p, '#slots .b.dev'); await p.waitForTimeout(2500); const v2 = await vis(p, '#slots .b.dev');
    add('a switch opens the full bar for a moment (' + v1.length + ') then it collapses to the picked one (' + v2.join(',') + ')', v1.length >= 3 && v2.length === 1 && v2[0] === 'b2');
    await p.evaluate(() => { const s = window.__game.sim; s.player.hp = 20; s.food = Math.max(1, s.food); }); await p.waitForTimeout(800); const ch = await p.evaluate(() => document.getElementById('hchip').textContent); add('at low health the "F eat" chip shows: ' + ch, /F eat/.test(ch));
    await ctx.close(); }
  // ---- PHONE: no key text, pulsing button, switch tab
  { const { ctx, p } = await open({ ...devices['Pixel 7 landscape'] });
    await night(p, 0); await waitStep(p, 'shoot'); await p.waitForTimeout(2500); const ph = await p.evaluate(() => [getComputedStyle(document.getElementById('dchip')).display, document.getElementById('bFire').classList.contains('pulse'), document.getElementById('marla').textContent, getComputedStyle(document.getElementById('bFire'), '::after').content]);
    add('phone drill: no key chip, the FIRE button pulses, Marla names the button: ' + JSON.stringify(ph), ph[0] === 'none' && ph[1] && /FIRE/.test(ph[2]) && (ph[3] === 'none' || ph[3] === 'normal'));
    await p.evaluate(() => { const d = document.getElementById('bSkip'), o = { bubbles: true, pointerId: 1, pointerType: 'touch' }; d.dispatchEvent(new PointerEvent('pointerdown', o)); }); await p.waitForTimeout(500); add('phone: the Skip button ends the drill', (await step(p)) === null);
    let v = await vis(p, '.b.dev'); const sw = (await vis(p, '#bSwitch')).length; add('phone: one device shown (' + v.join(',') + ') with the switch tab (' + sw + ')', v.length === 1 && sw === 1);
    const tap = (id) => p.evaluate((id) => { const el = document.getElementById(id), o = { bubbles: true, pointerId: 2, pointerType: 'touch', button: 0 }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, id);
    await tap('bSwitch'); await p.waitForTimeout(400); v = await vis(p, '.b.dev'); add('phone: the switch tab opens the full bar (' + v.length + ')', v.length >= 3);
    const other = await p.evaluate(() => { const s = document.querySelector('.b.dev.sel'); return s && s.id === 'b2' ? 'b3' : 'b2'; });
    const n0 = await p.evaluate(() => window.__game.sim.devices.length); await tap(other); await p.waitForTimeout(500); v = await vis(p, '.b.dev'); const n1 = await p.evaluate(() => window.__game.sim.devices.length);
    add('phone: tapping a device in the open bar picks it and closes the bar, placing nothing (' + v.join(',') + ', devices ' + n0 + ' -> ' + n1 + ')', v.length === 1 && v[0] === other && n1 === n0);
    await tap('bSwitch'); await p.waitForTimeout(300); await tap('b1'); await p.waitForTimeout(300);
    await p.evaluate(() => { window.__game.sim.player.energy = 60; }); await tap('b1'); await p.waitForTimeout(500); const n2 = await p.evaluate(() => window.__game.sim.devices.length); add('phone: one tap on the picked device places it (' + n1 + ' -> ' + n2 + ')', n2 === n1 + 1);
    const keyText = await p.evaluate(() => [...document.querySelectorAll('#hud *')].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && /Left click|Right click|\bkeys\b|Hold left/.test(e.textContent) && !e.children.length; }).map((e) => e.id || e.className));
    add('phone: no key text on screen (' + keyText.join(',') + ')', !keyText.length);
    await ctx.close(); }
  // ---- BASE MINIMAP (owner 19:43): desktop and phone
  for (const [lab, opts] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['phone', { ...devices['Pixel 7 landscape'] }]]) {
    const { ctx, p } = await open(opts); await p.evaluate(() => window.__game.enterBase()); await p.waitForTimeout(2500);
    const probe = () => p.evaluate(() => { const g = window.__game, cv = document.getElementById('mmap'), info = g.mapInfo(), C = typeof g.cfg === 'function' ? g.cfg() : g.cfg, M = C.miniMap, sp = g.B.scoutPos(g.save), w = g.basePos(), y = w.yaw;
      const size = parseFloat(cv.style.width), r = size / 2, k = (r - 8) / M.radius, dx = sp.x - w.x, dz = sp.z - w.z, ex = r + (dx * Math.cos(y) - dz * Math.sin(y)) * k, ey = r - (dx * -Math.sin(y) + dz * -Math.cos(y)) * k;
      const dpr = cv.width / size, px = (q) => { const d = cv.getContext('2d').getImageData(Math.round(q[0] * dpr), Math.round(q[1] * dpr), 1, 1).data; return [d[0], d[1], d[2]]; };
      return { shown: getComputedStyle(cv).display !== 'none', size, info, exp: [ex, ey], dist: Math.hypot(ex - r, ey - r), r, ang: Math.atan2(ey - r, ex - r), col: info ? px(info.marla) : null, bq: document.getElementById('bq').textContent, rect: cv.getBoundingClientRect().toJSON(), btn: ['bPause', 'bMus'].map((id) => document.getElementById(id).getBoundingClientRect().toJSON()) }; });
    await p.waitForTimeout(400); let q = await probe();
    add(lab + ' base by day: the round map shows (' + q.size + ' px) and the quest box has no "Find Marla (" words', q.shown && q.info && !/Find Marla \(/.test(q.bq) && q.size === (lab === 'desktop' ? 150 : 96));
    const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom; add(lab + ': the map overlaps neither pause nor music', !q.btn.some((c) => hit(q.rect, c)));
    { const lf = await p.evaluate(() => (window.__labels || []).map((l) => [l.userData.text, l.userData.textW, l.userData.canvasW])); const bad = lf.filter((q) => !(q[1] + 4 <= q[2]));
      add(lab + ': every name tag fits its canvas (' + lf.length + ' tags' + (lf.find((q) => /Bram/.test(q[0])) ? ', e.g. ' + JSON.stringify(lf.find((q) => /Bram/.test(q[0]))) : '') + ')' + (bad.length ? ' too wide: ' + JSON.stringify(bad) : ''), lf.length > 0 && !bad.length); }
    // owner 20:56 "the map is covering words": the map's box against every visible text and button nearby, with Marla speaking and the quest box open (1 px is a fail)
    await p.evaluate(() => { window.__game.say("Over here, Potts. Don't make me wave."); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' })); }); await p.waitForTimeout(800);
    const ov = await p.evaluate(() => { const m = document.getElementById('mmap').getBoundingClientRect(), out = [];
      for (const sel of ['#bq', '#bstat', '#marla', '#bPause', '#bMus', '#hchip', '#dchip', '#bprompt', '#msg', '#csay', '#time', '#count']) { const e = document.querySelector(sel); if (!e) continue; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); if (c.display === 'none' || c.visibility === 'hidden' || r.width < 1 || r.height < 1) continue;
        const w = Math.min(m.right, r.right) - Math.max(m.left, r.left), h = Math.min(m.bottom, r.bottom) - Math.max(m.top, r.top); if (w >= 1 && h >= 1) out.push(sel + ' ' + Math.round(w) + 'x' + Math.round(h)); }
      return [out, Math.round(m.left) + ',' + Math.round(m.top) + ' ' + Math.round(m.width)]; });
    add(lab + ': the map (at ' + ov[1] + ') covers no text or button, with Marla speaking and the quest box open' + (ov[0].length ? ' (overlaps: ' + ov[0].join(', ') + ')' : ''), !ov[0].length);
    { const gap = await p.evaluate(() => { const m = document.getElementById('marla').getBoundingClientRect(), b = document.getElementById('bMus').getBoundingClientRect(); if (!m.width || !b.width || m.bottom < b.top || b.bottom < m.top) return 99; return Math.max(m.left - b.right, b.left - m.right); }); add(lab + ": Marla's card keeps 8 px or more from the music button (" + Math.round(gap) + ' px)', gap >= 8); }
    { const mk = await p.evaluate(() => { const i = window.__game.mapInfo(); if (!i || !i.marks) return null; let min = 1e9; const all = [i.marla].concat(i.marks); for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) min = Math.min(min, Math.hypot(all[a][0] - all[b][0], all[a][1] - all[b][1])); return [i.marks.length, Math.round(min), Math.round(i.gs)]; });
      add(lab + ': map marks and Marla never overlap (' + JSON.stringify(mk) + ' = marks, closest px, glyph px)', mk && (mk[0] === 0 || mk[1] >= mk[2])); }
    await p.evaluate(() => { const g = window.__game, sp = g.B.scoutPos(g.save); g.setBase(sp.x + 6, sp.z + 5); g.setYaw(0.7); }); await p.waitForTimeout(1200); q = await probe();
    add(lab + ": Marla's dot is within 4 px of her projected place (" + (q.info && q.info.marla.map(Math.round)) + ' vs ' + q.exp.map(Math.round) + ') and drawn in her colour ' + JSON.stringify(q.col), q.info && !q.info.edge && Math.hypot(q.info.marla[0] - q.exp[0], q.info.marla[1] - q.exp[1]) <= 4 && q.col && q.col[0] > 180 && q.col[1] < 140);
    await p.evaluate(() => { const g = window.__game, sp = g.B.scoutPos(g.save), a = Math.atan2(sp.z, sp.x) + Math.PI; g.setBase(Math.cos(a) * 17, Math.sin(a) * 17); g.setYaw(-1.1); }); await p.waitForTimeout(1200); q = await probe();
    const da = q.info ? Math.abs(Math.atan2(Math.sin(q.info.angle - q.ang), Math.cos(q.info.angle - q.ang))) : 9; add(lab + ': far away she is an arrow on the rim pointing her way (off by ' + da.toFixed(2) + ' rad)', q.info && q.info.edge && da < 0.12);
    await p.evaluate(() => { const g = window.__game; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); g.endDay(); }); await p.waitForTimeout(1500);
    const night = await p.evaluate(() => getComputedStyle(document.getElementById('mmap')).display); add(lab + ': the map is hidden at night (' + night + ')', night === 'none');
    await ctx.close(); }
  // ---- STREET HUD overlap (coordinator 21:5x): with a mouse at 844x390 and 1280x720, the clock frame against #csay, #bq, the chips, the device bar, Marla, pause and music; then the same at night in a house
  for (const vp of [{ width: 844, height: 390 }, { width: 1280, height: 720 }]) {
    const { ctx, p } = await open({ viewport: vp }); await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 1; document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForTimeout(2000);
    const clash = () => p.evaluate(() => { window.__hud.say('boss', 'A queued centre line for the overlap test', 6, 30); window.__game.say('Marla test line, Potts.'); return new Promise((res) => setTimeout(() => { const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return c.display === 'none' || c.visibility === 'hidden' || r.width < 1 || r.height < 1 ? null : r; };
      const k = box('#clk'), out = []; if (!k) { res(['no clock']); return; } for (const sel of ['#csay', '#bq', '#hchip', '#dchip', '#slots', '#marla', '#bPause', '#bMus', '#bDusk', '#bLeave', '#msg', '#aim']) { const r = box(sel); if (!r) continue; const w = Math.min(k.right, r.right) - Math.max(k.left, r.left), h = Math.min(k.bottom, r.bottom) - Math.max(k.top, r.top); if (w >= 1 && h >= 1) out.push(sel + ' ' + Math.round(w) + 'x' + Math.round(h)); } window.__hud.unsay('boss'); res(out); }, 900)); });
    let o = await clash(); add(vp.width + 'x' + vp.height + ' street by day: the clock frame overlaps nothing' + (o.length ? ' (' + o.join(', ') + ')' : ''), !o.length);
    await p.evaluate(() => { const g = window.__game; g.enterHouse(0); }); await p.waitForTimeout(1200); await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(1500);
    o = await clash(); add(vp.width + 'x' + vp.height + ' night in a house: the clock frame overlaps nothing' + (o.length ? ' (' + o.join(', ') + ')' : ''), !o.length);
    await ctx.close(); }
  add('no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), !errs.length);
  let bad = 0; for (const [n, ok] of out) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) bad++; } console.log(bad ? 'SOME FAILED' : 'ALL PASS'); await b.close();
})();
