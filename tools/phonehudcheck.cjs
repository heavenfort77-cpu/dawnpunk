// Phone HUD fit check (owner Nov 18: the night HUD on his phone ran together). PASS/FAIL lines.
// Usage: node tools/phonehudcheck.cjs [page] [out_dir]
// A touch phone (isMobile, low tier) at 731x304 (his phone inside the claude.ai page), 800x360, 844x390 and 915x412, in five scenes:
//   base (by day, the goal line), street by day, a house by day upstairs (Solar button, HOLD, 3-part count) and by its way out (LEAVE), a night in a house (EAT with food, a long Marla line, the lucky-cat badge),
//   the night-1 drill (the gold ring on the machine and Marla's second line).
// In each: the box of every visible HUD element; FAIL when two overlap by more than 1 px both ways, or one runs off the screen.
// The crosshair and the drill ring may meet (the ring sits on the machine you aim at). Also: Marla's name sits on its own line (not run into her words),
// the count line is at most 2 lines at night and 3 by day, the goal line in the base at most 2 lines.
// DESK=1: instead, prints the desktop boxes (1280x720, mouse) of the same scenes as JSON lines, to compare two builds (desktop must not change).
// With out_dir: a picture per scene at 731x304 (<out_dir>/hud_<scene>.png).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const page0 = process.argv[2] || path.resolve(__dirname, '../dist/index.html'), OUT = process.argv[3] || '';
const DESK = !!process.env.DESK, SIZES = DESK ? [[1280, 720]] : [[731, 304], [800, 360], [844, 390], [915, 412]];
const IDS = ['hpb', 'enb', 'time', 'clkbar', 'count', 'coins', 'bPause', 'bMus', 'marla', 'bEat', 'bFire', 'b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'bSwitch', 'bDusk', 'bLeave', 'bSkip', 'dmark', 'darrow', 'dsub', 'msg', 'csay', 'aim', 'hs', 'bprompt', 'bstat', 'bq', 'mmap', 'cross', 'hchip', 'dchip', 'mlook', 'vit', 'clk', 'slots', 'dkeys'];
const LONG = 'Hold FIRE until the ring turns gold, then let go: a charged shot through the whole line.';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = [];
  const add = (name, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + name);
  const ctx = await b.newContext(DESK ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } : { viewport: { width: 731, height: 304 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => { window.__dtMax = 0.5; window.__fakeLock = false; if (!sessionStorage.getItem('phc')) { sessionStorage.setItem('phc', '1'); try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } } });
  await p.goto('file://' + page0 + '?quality=low&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
  // CSS=<file>: extra style rules put on the page (to try layout changes before they go into index.template.html)
  if (process.env.CSS) await p.addStyleTag({ content: fs.readFileSync(process.env.CSS, 'utf8') });
  const boxes = (ids) => p.evaluate((ids) => { const W = innerWidth, H = innerHeight, r = [];
    for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
      let v = e.parentElement, hid = false; while (v && v !== document.body) { const c2 = getComputedStyle(v); if (c2.display === 'none' || c2.visibility === 'hidden') { hid = true; break; } v = v.parentElement; } if (hid) continue;
      const q = e.getBoundingClientRect(); if (q.width < 1 || q.height < 1) continue; r.push([id, Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]); }
    const lines = (id) => { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') return 0; const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2, h = e.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); return Math.round(h / lh); };
    const mb = getComputedStyle(document.getElementById('marla'), '::before');
    return { W, H, r, countL: lines('count'), bqL: lines('bq'), bstatL: lines('bstat'), nameBlock: mb.display === 'block', marlaTxt: document.getElementById('marla').textContent }; }, ids);
  // the HUD's containers on desktop hold other elements (vit holds the bars, clk the clock and count, slots the buttons): a box inside its own container does not count
  const nest = { vit: ['hpb', 'enb'], clk: ['time', 'clkbar', 'count'], slots: ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'bEat'] };
  const okPair = (a, c) => (a === 'cross' && c === 'dmark') || (a === 'dmark' && c === 'cross') || (nest[a] && nest[a].includes(c)) || (nest[c] && nest[c].includes(a));
  const judge = async (scene, opts = {}) => {
    for (const [w, h] of SIZES) {
      await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(700); if (opts.before) await opts.before();
      const m = await boxes(IDS); const where = scene + ' ' + w + 'x' + h;
      if (DESK) { out.push('DESK ' + where + ' ' + JSON.stringify(m.r)); continue; }
      const bad = [], off = [];
      for (let i = 0; i < m.r.length; i++) { const a = m.r[i]; if (a[1] < 0 || a[2] < 0 || a[3] > m.W || a[4] > m.H) off.push(a[0]); for (let j = i + 1; j < m.r.length; j++) { const c = m.r[j]; if (okPair(a[0], c[0])) continue; const ox = Math.min(a[3], c[3]) - Math.max(a[1], c[1]), oy = Math.min(a[4], c[4]) - Math.max(a[2], c[2]); if (ox > 1 && oy > 1) bad.push(a[0] + '/' + c[0] + ' ' + ox + 'x' + oy); } }
      add(where + ': nothing overlaps (' + m.r.length + ' boxes: ' + m.r.map((q) => q[0]).join(',') + ')' + (bad.length ? ' -- ' + bad.join(', ') : ''), m.r.length >= 4 && !bad.length);
      add(where + ': everything on screen' + (off.length ? ' -- off: ' + off.join(',') : ''), !off.length);
      if (opts.marla && m.marlaTxt) add(where + ': Marla\'s name on its own line above her words', m.nameBlock);
      if (opts.countMax) add(where + ': count line ' + m.countL + ' line(s), at most ' + opts.countMax, m.countL <= opts.countMax);
      if (opts.goal) add(where + ': goal line ' + m.bqL + ' line(s), base line ' + m.bstatL + ', at most 2 each', m.bqL <= 2 && m.bstatL <= 2);
      if (opts.need) for (const id of opts.need) add(where + ': ' + id + ' shows', m.r.some((q) => q[0] === id));
      if (OUT && w === SIZES[0][0]) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, 'hud_' + scene + '.png'), timeout: 120000 }); }
    }
  };
  // 1. the base by day (a save past the first night, so no waking prompt)
  await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 2; g.save.talkedMarla = true; g.reBase(); }); await p.waitForTimeout(3000);
  await judge('base', { goal: true });
  // 2. the street by day
  await p.evaluate(() => { const g = window.__game; document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForTimeout(2500);
  await judge('street');
  // 3. a house by day, upstairs, with food and essentials (the owner's day screenshot)
  await p.evaluate(() => { const g = window.__game; g.enterHouse(0); }); await p.waitForTimeout(1500);
  const dayUp = async () => p.evaluate((t) => { const g = window.__game, s = g.sim, P = s.player; s.food = 13; s.ess = 2; P.energy = 25; if (s.L > 1 && P.floor !== 1) { let best = null; for (let x = -4; x <= 4; x += 1) for (let z = -4; z <= 4; z += 1) { const d = Math.min(...s.stairs.map((q) => Math.min(Math.hypot(x - q.tx, z - q.tz), Math.hypot(x - q.bx, z - q.bz))), ...s.ladders.map((q) => Math.hypot(x - q.x, z - q.z))); if (!best || d > best[2]) best = [x, z, d]; } P.floor = 1; P.x = best[0]; P.z = best[1]; } g.say(t); }, LONG);
  await dayUp(); await p.waitForTimeout(800);
  await judge('dayup', { marla: true, countMax: 3, need: ['bDusk'], before: dayUp });
  // 3b. the same house by day, downstairs at the way out (LEAVE shows), with a Marla line
  const door = async () => p.evaluate((t) => { const g = window.__game, s = g.sim, P = s.player; P.floor = 0; for (const b of s.breaches) { if (b.type !== 'door' || b.floor !== 0) continue; P.x = b.inX - b.nx * 0.6; P.z = b.inZ - b.nz * 0.6; break; } g.say(t); }, LONG);
  await door(); await p.waitForTimeout(1500);
  await judge('door', { marla: true, need: ['bLeave'], before: door });
  // 4. a night in the house: food to eat, a long Marla line
  await p.evaluate(() => { const g = window.__game; g.endDay(); }); await p.waitForFunction(() => window.__game.sim.phase === 'night', null, { timeout: 60000 });
  const nightSet = async () => p.evaluate((t) => { const g = window.__game, s = g.sim, P = s.player; s.food = 13; s.ess = 5; s.coins = 1; P.hp = 41; P.energy = 22; P.floor = 0; g.say(t); }, LONG);
  await nightSet(); await p.waitForTimeout(800);
  await judge('night', { marla: true, countMax: 2, need: ['bEat', 'bFire', 'marla'], before: nightSet });
  // 5. the night-1 drill: a new save, the drill not skipped
  await p.evaluate(() => { localStorage.removeItem('dawnpunk.drill'); const g = window.__game; g.enterBase(); g.save.nights = 0; g.save.talkedMarla = true; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await p.waitForTimeout(1500);
  await p.evaluate(() => window.__game.endDay());
  await p.waitForFunction(() => { const g = window.__game, d = g.drillInfo(); return d && d.step === 'shoot' && g.sim.gloom.length > 0; }, null, { timeout: 60000 }).catch(() => out.push('INFO drill did not reach the shoot step'));
  await p.waitForTimeout(2500);
  // the machine straight ahead so the ring shows (the drill puts it in view; turn to it in case)
  const face = async () => p.evaluate(() => { const g = window.__game, s = g.sim, P = s.player, m = s.gloom.find((q) => q.drillKind) || s.gloom[0]; if (m) { g.setYaw(Math.atan2(-(m.x - P.x), -(m.z - P.z))); g.setPitch(-0.05); } });
  await face(); await p.waitForTimeout(1500);
  await judge('drill', { marla: true, need: ['dsub'], before: async () => { await face(); await p.waitForTimeout(600); } });
  add('no page errors' + (errs.length ? ' (' + errs.slice(0, 3).join(' | ') + ')' : ''), !errs.length);
  console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('FAIL')).length; console.log(DESK ? 'DESK DONE' : bad ? bad + ' FAILED' : 'ALL PASS');
  await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
