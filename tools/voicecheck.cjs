// Marla's voice (owner Nov 18): PASS/FAIL lines only. Usage: node tools/voicecheck.cjs [abs page.html] [low|high]   (default dist/index_single.html, low; the clips are inside that file)
// Desktop 1280x720: a run line plays its clip (hook count up, right id; the desktop drill order), the base never plays one (not even a run line's text),
// Pixel 7 sideways (owner Nov 18 08:05, desktop only): the phone plays no clip and its pause menu has no Voice button;
// one clip at a time, the music ducks while she talks, Voice off stops and blocks clips (kept in localStorage), pausing stops the clip, the Voice button sits in the pause menu, no page errors.
const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const page = process.argv[2] || path.resolve(__dirname, '../dist/index_single.html'), tier = process.argv[3] === 'high' ? 'high' : 'low';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); const out = [], errs = [];
  const add = (n, ok) => { out.push([n, !!ok]); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
  const open = async (opts) => { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.addInitScript(() => { window.__dtMax = 0.5; window.__gt = 0; let l = 0; const f = (now) => { if (l) window.__gt += Math.min(window.__dtMax || 0.1, (now - l) / 1000); l = now; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await p.goto('file://' + page + '?quality=' + tier + '&seed=777', { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 240000 });
    await p.evaluate(() => localStorage.clear()); return { ctx, p }; };
  const mv = (p) => p.evaluate(() => window.__game.marlaVoice());
  // every wait is in GAME time (window.__gt adds up each frame's dt as the game's frame() does, capped by __dtMax), not wall time: the slow software-GL runner draws a frame every few seconds
  // and the game only moves on per frame; WALL = the most real time one wait may take
  const WALL = 300000, gt = (p) => p.evaluate(() => window.__gt);
  const waitMv = async (p, fn, ms = 8000) => { const t0 = Date.now(), g0 = await gt(p); let v; while (Date.now() - t0 < WALL) { v = await mv(p); if (fn(v)) return v; if ((await gt(p)) - g0 >= ms / 1000) return v; await p.waitForTimeout(150); } return v; };
  const gwait = async (p, ms) => { const t0 = Date.now(), g0 = await gt(p); while (Date.now() - t0 < WALL && (await gt(p)) - g0 < ms / 1000) await p.waitForTimeout(100); };
  const say = (p, t) => p.evaluate((t) => window.__game.say(t), t);
  const night = async (p, nights) => { await p.evaluate((n) => { const g = window.__game; g.enterBase(); g.save.nights = n; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }, nights); await gwait(p, 1500); await p.evaluate(() => window.__game.endDay()); await gwait(p, 1500); };
  const btnIn = (p) => p.evaluate(() => { const e = document.getElementById('bVoice'), m = document.getElementById('bMusic'), r = e.getBoundingClientRect(), q = m.getBoundingClientRect(); const over = [...document.querySelectorAll('#pause button')].filter((x) => x !== e && getComputedStyle(x).display !== 'none').some((x) => { const s = x.getBoundingClientRect(); return s.width > 0 && r.left < s.right - 1 && s.left < r.right - 1 && r.top < s.bottom - 1 && s.top < r.bottom - 1; });
    return { text: e.textContent, inView: r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, nextToMusic: Math.abs(r.top - q.top) < 2 * q.height + 30, over }; });
  const HEAVY = 'Heavy pack, Potts. You are slowing down.', GREEN = 'Green bar over a door: loot inside. Red: empty.', BAR = 'That bar is your Sun. Your hand drinks it in.';
  // ---- DESKTOP
  { const { ctx, p } = await open({ viewport: { width: 1280, height: 720 } });
    await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 1; }); await gwait(p, 1500);
    const b0 = await mv(p); await say(p, HEAVY); await gwait(p, 2500);
    const b1 = await mv(p); add('desktop base: no clip plays, not even for a run line\'s text or a base tip (count ' + b0.n + ' -> ' + b1.n + ', voice on ' + b1.on + ')', b1.n === b0.n && b1.on === true && !b1.playing);
    await p.evaluate(() => { const g = window.__game; g.save.nights = 0; document.getElementById('selRing').value = '0'; g.startRun(0); }); const s1 = await waitMv(p, (v) => v.last === 'day_six_houses', 12000);
    add('desktop street: "Six houses, Potts..." shows and its clip plays (last ' + s1.last + ', via ' + s1.via + ', count ' + s1.n + ')', s1.last === 'day_six_houses' && s1.via === 'ctx' && s1.n === b1.n + 1);
    const pl = await waitMv(p, (v) => v.playing && v.duck < 0.9, 3000); add('desktop: the music is ducked while she talks (music x' + pl.duck.toFixed(2) + ')', pl.playing && pl.duck < 0.9);
    const en = await waitMv(p, (v) => !v.playing && v.duck > 0.99, 12000); add('desktop: the duck lifts after the clip ends (music x' + en.duck.toFixed(2) + ')', !en.playing && en.duck > 0.99);
    await say(p, HEAVY); const h1 = await waitMv(p, (v) => v.last === 'day_heavy_pack'); add('desktop street: a hint line plays its clip (' + h1.last + ', "' + h1.lastText + '")', h1.last === 'day_heavy_pack' && h1.lastText === HEAVY);
    await say(p, GREEN); await p.waitForTimeout(50); await say(p, BAR); const o1 = await waitMv(p, (v) => v.last === 'day_sun_bar' && v.playing, 4000); await gwait(p, 400); const o2 = await mv(p);
    add('desktop: a new line takes over: the last started clip is the newest line and it is the one playing (' + o2.last + ', playing ' + o2.playing + ')', o1.last === 'day_sun_bar' && o2.last === 'day_sun_bar' && o2.playing);
    await p.evaluate(() => document.getElementById('bPause').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); const pa = await waitMv(p, (v) => !v.playing, 2000);
    add('desktop: pausing stops the clip (paused ' + (await p.evaluate(() => window.__game.isPaused())) + ', playing ' + pa.playing + ')', !pa.playing && (await p.evaluate(() => window.__game.isPaused())));
    const bt = await btnIn(p); add('desktop pause menu: "' + bt.text + '" next to Music, on screen, overlapping no other button (allowed ' + pa.allowed + ')', bt.text === 'Voice: on' && bt.inView && bt.nextToMusic && !bt.over && pa.allowed === true);
    await say(p, GREEN); await gwait(p, 1500); const pz = await mv(p); add('desktop: no clip starts while paused (count ' + pa.n + ' -> ' + pz.n + ')', pz.n === pa.n);
    await p.evaluate(() => document.getElementById('resume').click()); await gwait(p, 1500); const rs = await mv(p); add('desktop: resuming does not play the line shown during the pause (last ' + rs.last + ')', rs.last !== 'day_green_bar');
    await say(p, HEAVY); await waitMv(p, (v) => v.playing, 3000); await p.evaluate(() => document.getElementById('bVoice').click()); const of = await waitMv(p, (v) => !v.playing, 2000);
    const ls = await p.evaluate(() => [localStorage.getItem('solardg.voice'), document.getElementById('bVoice').textContent]);
    add('desktop: Voice off stops the clip, the button reads "' + ls[1] + '", localStorage solardg.voice = ' + ls[0], !of.playing && !of.on && ls[0] === 'off' && ls[1] === 'Voice: off');
    await say(p, GREEN); await gwait(p, 1500); const o3 = await mv(p); add('desktop: with Voice off no clip plays (count ' + of.n + ' -> ' + o3.n + ')', o3.n === of.n);
    await p.evaluate(() => document.getElementById('bVoice').click()); await say(p, BAR); const o4 = await waitMv(p, (v) => v.last === 'day_sun_bar' && v.n > o3.n, 4000);
    add('desktop: Voice on again plays the next line (' + o4.last + ', saved ' + (await p.evaluate(() => localStorage.getItem('solardg.voice'))) + ')', o4.last === 'day_sun_bar' && o4.n > o3.n && o4.on);
    await night(p, 0); const d1 = await waitMv(p, (v) => /^drill_/.test(v.last), 30000);
    add('desktop night 1: the drill order plays the DESKTOP clip (' + d1.last + ': "' + d1.lastText + '")', d1.last === 'drill_shoot_desk' && d1.lastText === "One machine. Shoot it, Potts. Left click.");
    await p.evaluate(() => window.__game.enterBase()); await gwait(p, 1500); const e0 = await mv(p); await say(p, HEAVY); await gwait(p, 2500); const e1 = await mv(p);
    add('desktop: back in the base the clip is stopped and no line plays (count ' + e0.n + ' -> ' + e1.n + ', playing ' + e1.playing + ')', e1.n === e0.n && !e1.playing && !e0.playing);
    await ctx.close(); }
  // ---- PHONE (Pixel 7 sideways)
  { const { ctx, p } = await open({ ...devices['Pixel 7 landscape'] });
    await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 0; }); await gwait(p, 1500); const b0 = await mv(p); await say(p, HEAVY); await gwait(p, 2500); const b1 = await mv(p);
    add('phone base: no clip plays (count ' + b0.n + ' -> ' + b1.n + ')', b1.n === b0.n);
    await night(p, 0); await p.waitForFunction(() => window.__game.drillInfo() && document.getElementById('marla').textContent === 'One machine. Tap FIRE, Potts.', null, { timeout: 30000 }).catch(() => {}); await gwait(p, 2500);
    const d1 = await mv(p), dt = await p.evaluate(() => document.getElementById('marla').textContent);
    add('phone night 1 (desktop only, owner 08:05): the drill order shows ("' + dt + '") and no clip plays (count ' + b1.n + ' -> ' + d1.n + ', allowed ' + d1.allowed + ')', dt === 'One machine. Tap FIRE, Potts.' && d1.n === b1.n && d1.allowed === false && !d1.playing);
    await p.evaluate(() => document.getElementById('bPause').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await gwait(p, 800);
    const bv = await p.evaluate(() => [getComputedStyle(document.getElementById('pause')).display, getComputedStyle(document.getElementById('bVoice')).display]);
    add('phone pause menu: open (' + bv[0] + ') with no Voice button (display ' + bv[1] + ')', bv[0] === 'flex' && bv[1] === 'none');
    await ctx.close(); }
  add('no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), errs.length === 0);
  await b.close(); const bad = out.filter((q) => !q[1]); console.log(bad.length ? 'SOME FAIL (' + bad.length + ')' : 'ALL PASS (' + out.length + ')'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.log('FAIL voicecheck crashed: ' + String(e).split('\n')[0]); process.exit(2); });
