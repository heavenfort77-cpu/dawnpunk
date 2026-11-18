// Phone look: the Nov 14 build (dist/dawnpunk_batch39.html, before the phone/desktop split) against today's phone version, same views, same size, same device scale.
// Usage: node tools/phonelookvs.cjs <out_dir> <old|new> <W>x<H>@<dpr> [page]
//   old = dist/dawnpunk_batch39.html (no tiers then), new = dist/index.html?quality=low; touch phone context (isMobile).
// Views: base (as you enter it), street (the first view of a ride), night (in house 0 after dusk), gloom (a Walker 2.5 m in front at night), play (night with the HUD,
// hands and the Walker). The first four are taken with the HUD hidden (the look alone); the HUD's share of the screen is measured in each view before it is hidden.
// Writes <out_dir>/<old|new>_<W>x<H>_<view>.png and one JSON line per view: { view, hud } (hud = share of the screen under visible HUD boxes, 0..1).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = process.argv[2], WHICH = process.argv[3] === 'old' ? 'old' : 'new', m = /^(\d+)x(\d+)@([\d.]+)$/.exec(process.argv[4] || '731x304@2.6');
const W = +m[1], H = +m[2], DPR = +m[3];
const page0 = process.argv[5] || path.resolve(__dirname, '../dist/' + (WHICH === 'old' ? 'dawnpunk_batch39.html' : 'index.html'));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: DPR });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => { window.__dtMax = 0.5; try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  await p.goto('file://' + page0 + (WHICH === 'new' ? '?quality=low&seed=777' : '?seed=777'), { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 300000 });
  const tag = WHICH + '_' + W + 'x' + H;
  // share of the screen covered by visible HUD boxes (#hud's children, the fixed buttons, Marla's card), counted on a 4 px grid so overlaps count once
  const hudShare = () => p.evaluate(() => { const Wd = innerWidth, Hd = innerHeight, g = 4, cols = Math.ceil(Wd / g), rows = Math.ceil(Hd / g), cov = new Uint8Array(cols * rows);
    const els = [...document.querySelectorAll('#hud *, .b, #bMus, #bPause')].filter((e) => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; let v = e.parentElement; while (v && v !== document.body) { const c = getComputedStyle(v); if (c.display === 'none' || c.visibility === 'hidden') return false; v = v.parentElement; } const q = e.getBoundingClientRect(); return q.width > 2 && q.height > 2 && q.width * q.height < Wd * Hd * 0.6; });
    for (const e of els) { const q = e.getBoundingClientRect(); for (let y = Math.max(0, Math.floor(q.top / g)); y < Math.min(rows, Math.ceil(q.bottom / g)); y++) for (let x = Math.max(0, Math.floor(q.left / g)); x < Math.min(cols, Math.ceil(q.right / g)); x++) cov[y * cols + x] = 1; }
    let n = 0; for (const v of cov) n += v; return +(n / cov.length).toFixed(3); });
  const hide = (on) => p.evaluate((on) => { window.__noHands = on; for (const id of ['hud', 'marla', 'msg', 'bprompt', 'bq', 'bstat', 'bMus', 'bPause', 'csay', 'mmap', 'knob']) { const e = document.getElementById(id); if (e) e.style.visibility = on ? 'hidden' : ''; } for (const e of document.querySelectorAll('.b')) e.style.visibility = on ? 'hidden' : ''; }, on);
  const shot = async (view, withHud) => { await hide(false); await p.waitForTimeout(400); const hud = await hudShare(); if (!withHud) { await hide(true); await p.waitForTimeout(1200); }
    await p.screenshot({ path: path.join(OUT, tag + '_' + view + '.png'), timeout: 240000 }); console.log(JSON.stringify({ build: WHICH, size: W + 'x' + H + '@' + DPR, view, hud })); };
  // base: as you enter it (a save past the first night)
  await p.evaluate(() => { const g = window.__game; g.enterBase(); if (g.save) { g.save.nights = 2; g.save.talkedMarla = true; } if (g.reBase) g.reBase(); }); await p.waitForTimeout(6000);
  await shot('base', false);
  // street: the first view of a ride
  await p.evaluate(() => { const g = window.__game; const s = document.getElementById('selRing'); if (s) s.value = '0'; g.startRun(0); }); await p.waitForTimeout(5000);
  await shot('street', false);
  // night in house 0, a moment after dusk
  await p.evaluate(() => { const g = window.__game; g.enterHouse(0); }); await p.waitForTimeout(2000);
  await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(16000);
  await p.evaluate(() => { const g = window.__game, s = g.sim; if (s) { s.step = () => {}; s.gloom.length = 0; } });
  await p.waitForTimeout(1500); await shot('night', false);
  // a Walker 2.5 m in front, facing you
  await p.evaluate(() => { const g = window.__game, P = g.sim.player, y = P.yaw; g.setPitch(-0.12); g.gloomSample('walker', P.x - Math.sin(y) * 2.5, P.z - Math.cos(y) * 2.5, y, 3, false); }); await p.waitForTimeout(3000);
  await shot('gloom', false);
  // the play screen: HUD, hands and the Walker
  await p.evaluate(() => { const g = window.__game, s = g.sim; s.food = 13; s.ess = 5; g.setPitch(-0.05); if (g.say) g.say('Sun is down, Potts. Turbine first, then lances, then panels.'); }); await p.waitForTimeout(1500);
  await shot('play', true);
  if (errs.length) console.error('PAGE ERRORS: ' + errs.slice(0, 3).join(' | '));
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
