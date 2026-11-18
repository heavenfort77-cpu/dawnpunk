// Impact sounds wired into the game (owner approved round 2, Nov 18; src/impactsfx.js, CONFIG.sfx.impact). PASS/FAIL lines.
// Usage: node tools/impactcheck.cjs <low|high> [page]
//   low  = the phone version: 731x304, touch, isMobile, low tier (dist/index.html)
//   high = desktop: 960x540, mouse, high tier (dist/index_single.html)
// In a night in house 0 the sim is frozen (sim.step does nothing) and a walker stands straight ahead. window.__game.doFire() is called as the fire button does, and
// window.__game.impactCount() (calls per sound, and how many were scheduled on the AudioContext) must show: a hit on a Gloom plays the shot and one hit (or head) sound;
// a killing shot plays destroyed and no hit; a charged shot plays one charged sound per machine on its line; the frame loop does not play the same events again.
const { chromium } = require('playwright');
const path = require('path');
const tier = process.argv[2] === 'high' ? 'high' : 'low';
const page0 = process.argv[3] || path.resolve(__dirname, '../dist/' + (tier === 'high' ? 'index_single.html' : 'index.html'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); const errs = [], out = [];
  const add = (name, ok, info) => { out.push((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  const ctx = await b.newContext(tier === 'low' ? { viewport: { width: 731, height: 304 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => { window.__dtMax = 0.5; window.__noHands = true; try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  await p.goto('file://' + page0 + '?quality=' + tier + '&seed=777', { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 300000 });
  if (tier === 'high') { const st = await p.waitForFunction(() => { const s = window.__gloomGlb || {}; const ks = Object.keys(s); return ks.length && ks.every((k) => s[k] !== 'loading') ? s : null; }, null, { timeout: 240000 }).then((h) => h.jsonValue()).catch(() => null); out.push('INFO desktop models: ' + JSON.stringify(st)); }
  await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 3; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await p.waitForTimeout(2000);
  await p.evaluate(() => window.__game.endDay()); await p.waitForFunction(() => window.__game.sim && window.__game.sim.phase === 'night', null, { timeout: 60000 });
  await p.evaluate(() => { const s = window.__game.sim; s.step = () => {}; s.gloom.length = 0; const P = s.player; P.x = 0; P.z = 0; P.floor = 0; P.hp = 1e6; });
  const res = await p.evaluate(async () => {
    const G = window.__game, s = G.sim, P = s.player, raf = () => new Promise((r) => requestAnimationFrame(() => r())), C = () => G.impactCount();
    const d = (a, b) => { const o = {}; for (const k in b) o[k] = b[k] - (a[k] || 0); return o; };
    const mk = (id, z) => ({ id, kind: 'walker', x: 0, z, floor: 0, hp: 1e6, maxhp: 1e6, phase: 'inside', bp: 0, timer: 0, cd: 1e9, face: 0 });
    const aim = (pt) => { G.setYaw(0); G.setPitch(pt); P.yaw = 0; P.pitch = pt; P.cd = 0; P.energy = 100; };
    const CF = typeof G.cfg === 'function' ? G.cfg() : G.cfg, r = { on: !!(CF.sfx && CF.sfx.impact && CF.sfx.impact.on), ac: typeof AudioContext !== 'undefined', coarse: matchMedia('(pointer: coarse)').matches };
    s.gloom.length = 0; const g = mk(91001, -4); s.gloom.push(g); for (let k = 0; k < 6; k++) await raf();
    // 1. a hit on a Gloom: find a pitch that hits its body (the shot is aimed as drawn), then compare the counts around that one shot
    let pitch = null;
    for (let pt = -0.02; pt > -0.45 && pitch === null; pt -= 0.03) { aim(pt); await raf(); const c0 = C(), h0 = g.hp; G.doFire(); if (g.hp < h0) { pitch = pt; r.hit = d(c0, C()); r.hitEv = s.log.filter((e) => e.e === 'shot').pop(); } }
    r.pitch = pitch; g.hp = 1e6;
    if (pitch !== null) {
      // 2. the frame loop drains the same events: the counts must not move
      const c1 = C(); for (let k = 0; k < 6; k++) await raf(); r.again = d(c1, C());
      // 3. a killing shot: destroyed, and no hit for that machine
      await new Promise((res) => setTimeout(res, 400)); aim(pitch); g.hp = 1; const c2 = C(); G.doFire(); r.kill = d(c2, C()); r.killed = !s.gloom.includes(g);
      for (let k = 0; k < 4; k++) await raf();
    }
    // 4. a charged shot through two machines on one line
    await new Promise((res) => setTimeout(res, 400)); s.gloom.length = 0; const g1 = mk(91002, -3), g2 = mk(91003, -6); s.gloom.push(g1, g2); for (let k = 0; k < 6; k++) await raf();
    for (let pt = -0.02; pt > -0.45 && !r.charged; pt -= 0.03) { aim(pt); await raf(); const c3 = C(); g1.hp = g2.hp = 1e6; G.doFire(true); const ev = s.log.filter((e) => e.e === 'shot').pop(); if (ev && ev.charged && ev.hits && ev.hits.length === 2) { r.charged = d(c3, C()); r.chEv = ev; } else await new Promise((res) => setTimeout(res, 300)); }
    r.ctx = window.__game && G.impactCount ? G.impactCount() : null; return r;
  });
  out.push('INFO impact on: ' + res.on + ', AudioContext: ' + res.ac + ', pointer coarse (phone mix): ' + res.coarse + ', aim pitch: ' + res.pitch + ', totals: ' + JSON.stringify(res.ctx));
  const H = res.hit || {}, K = res.kill || {}, A = res.again || {}, X = res.charged || {};
  add(tier + ': a hit on a Gloom calls the impact sounds (1 shot + 1 hit or head) and both are scheduled', res.pitch !== null && H.shot === 1 && H.hit + H.head === 1 && H.charged === 0 && H.destroyed === 0 && H.played === 2, JSON.stringify(H));
  add(tier + ': the shot event of that hit carries the machine\'s position', !!res.hitEv && res.hitEv.x === 0 && res.hitEv.z === -4 && res.hitEv.floor === 0, JSON.stringify(res.hitEv));
  add(tier + ': the frame loop does not play those events a second time', res.pitch !== null && Object.values(A).every((v) => v === 0), JSON.stringify(A));
  add(tier + ': a killing shot plays destroyed and no hit for that machine', res.killed === true && K.shot === 1 && K.destroyed === 1 && K.hit + K.head === 0 && K.played === 2, JSON.stringify(K));
  add(tier + ': a charged shot through two machines plays one charged sound per machine (queued) plus the shot', X.shot === 1 && X.charged === 2 && X.hit + X.head === 0 && X.played === 3, JSON.stringify(X));
  add(tier + ': no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(out.join('\n')); await b.close(); process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log('FAIL impactcheck crashed: ' + e); process.exit(1); });
