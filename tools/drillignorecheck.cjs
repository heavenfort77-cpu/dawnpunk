// A player may ignore the night-1 lesson (owner Nov 21, iPhone player: "they did not die ... it just kept coming"). PASS/FAIL lines only.
// Usage: node tools/drillignorecheck.cjs [abs page.html]
// Low tier (logic, the same on desktop and phone). Three fresh first nights:
//   A  the shoot step is done, then lesson machines are destroyed without placing a device: Marla says each one is down, and after CONFIG.drill.ignoreKills the lesson ends
//      itself (held waves back, dawn no longer held, health floor off, the skip is kept)
//   B  nothing is pressed: after CONFIG.drill.ignoreSecs of game time on the first step the lesson ends itself
//   C  the steps done in order still end the lesson the normal way (the new rule does not cut a lesson that is being followed)
// A lesson machine is "destroyed" here by taking it off the sim's list (the lesson only looks at "none left"); waits are on game time or a condition, with a large real-time cap.
const { chromium } = require('playwright');
(async () => {
  const page = process.argv[2] || require('path').resolve(__dirname, '../dist/index.html');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const out = [], errs = []; const add = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n);
  const open = async () => { const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.addInitScript(() => { window.__dtMax = 0.5; });
    await p.goto('file://' + page + '?quality=low&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
    await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 0; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); });
    await p.waitForFunction(() => window.__game.sim && window.__game.state === 'play', null, { timeout: 120000 }); await p.evaluate(() => window.__game.endDay());
    await p.waitForFunction(() => { const d = window.__game.drillInfo(); return d && d.step === 'shoot'; }, null, { timeout: 240000 }); return { ctx, p }; };
  const info = (p) => p.evaluate(() => { const g = window.__game, s = g.sim, d = g.drillInfo(); let st = {}; try { st = JSON.parse(localStorage.getItem((typeof g.cfg === 'function' ? g.cfg() : g.cfg).drill.store) || '{}'); } catch (e) { /* none */ }
    return { step: d ? d.step : null, gloom: s.gloom.length, waves: s.spawns.length - s.spawned, hold: !!(s.holdDawn && s.holdDawn()), floor: s.hpFloor ? s.hpFloor() : 0, skip: !!st.skip, marla: document.getElementById('marla').textContent, phase: s.phase, done: !!s.done }; });
  const cfg = (p) => p.evaluate(() => { const G0 = window.__game, D = (typeof G0.cfg === 'function' ? G0.cfg() : G0.cfg).drill; return { kills: D.ignoreKills, secs: D.ignoreSecs, down: D.down, ignored: D.ignored }; });
  // the lesson's machine is in: then it is taken off the list; the lesson notices on its next tick
  const destroy = async (p) => { await p.waitForFunction(() => window.__game.sim.gloom.length > 0 || !window.__game.drillInfo(), null, { timeout: 240000 }); return p.evaluate(() => { const s = window.__game.sim, n = s.gloom.length; s.gloom.length = 0; return n; }); };
  // ---- A: destroyed machines, step not done
  { const { ctx, p } = await open(); const C = await cfg(p); add('CONFIG.drill has ignoreKills, ignoreSecs and both lines (' + JSON.stringify(C) + ')', C.kills > 0 && C.secs > 0 && !!C.down && !!C.ignored && C.down.length <= 44 && C.ignored.length <= 44);
    const K = C.kills > 0 ? C.kills : 3;
    await p.evaluate(() => { window.__game.sim.player.energy = 60; window.__game.fire(); }); await p.waitForFunction(() => { const d = window.__game.drillInfo(); return d && d.step === 'place'; }, null, { timeout: 60000 }).catch(() => {});
    let i0 = await info(p); add('A: firing ends "shoot" -> "place" (' + i0.step + ')', i0.step === 'place'); const said = [];
    for (let k = 1; k <= K + 2; k++) { const n = await destroy(p); if (!n) break; await p.waitForFunction(() => { const g = window.__game; return !g.drillInfo() || g.sim.gloom.length > 0; }, null, { timeout: 120000 }).catch(() => {}); const i = await info(p); said.push(i.marla); if (!i.step) { i0 = Object.assign(i, { kills: k }); break; } i0 = Object.assign(i, { kills: k }); }
    add('A: Marla says a destroyed lesson machine is down (' + JSON.stringify(said[0]) + ')', said[0] === C.down);
    add('A: the lesson ends itself after ' + K + ' machines destroyed with the step not done (ended after ' + (i0.step ? 'never, ' + i0.kills + ' destroyed' : i0.kills) + ')', !i0.step && i0.kills === K);
    add('A: then the held waves are back (' + i0.waves + '), dawn is not held (' + i0.hold + '), the health floor is off (' + i0.floor + '), the skip is kept (' + i0.skip + '), Marla: ' + JSON.stringify(i0.marla), !i0.step && i0.waves > 0 && !i0.hold && !i0.floor && i0.skip && i0.marla === C.ignored);
    await ctx.close(); }
  // ---- B: nothing pressed
  { const { ctx, p } = await open(); const C = await cfg(p), S = C.secs > 0 ? C.secs : 60;
    // game time on the step: counted here from the frames' own delta (window.__dtMax caps one frame), read from the lesson's clock if the build has one
    const r = await p.evaluate((S) => new Promise((res) => { const g = window.__game; let t = 0, last = performance.now(); const t0 = Date.now(); const f = (now) => { t += Math.min(0.5, (now - last) / 1000); last = now; if (!g.drillInfo()) return res({ ended: true, t }); if (t > S * 1.5 + 20 || Date.now() - t0 > 900000) return res({ ended: false, t }); requestAnimationFrame(f); }; requestAnimationFrame(f); }), S);
    const i = await info(p); add('B: with nothing pressed the lesson ends itself after about ' + S + ' s of game time (' + (r.ended ? 'ended at about ' + Math.round(r.t) + ' s' : 'still held at ' + Math.round(r.t) + ' s') + ')', r.ended && r.t >= S * 0.5);
    add('B: you are alive, the night goes on, the waves are back (' + JSON.stringify({ phase: i.phase, done: i.done, waves: i.waves, hold: i.hold }) + ')', r.ended && i.phase === 'night' && !i.done && i.waves > 0 && !i.hold);
    await ctx.close(); }
  // ---- C: a followed lesson ends the normal way
  { const { ctx, p } = await open(); const to = (w) => p.waitForFunction((w) => { const d = window.__game.drillInfo(); return w ? d && d.step === w : !d; }, w, { timeout: 60000 }).catch(() => {});
    await p.evaluate(() => { window.__game.sim.player.energy = 60; window.__game.fire(); }); await to('place'); await p.mouse.click(480, 270, { button: 'right' }); await to('switch'); const i = await info(p);
    add('C: shoot then place move the lesson on as before, no skip kept (' + i.step + ', skip ' + i.skip + ')', i.step === 'switch' && !i.skip); await ctx.close(); }
  // ---- D: a new player who presses nothing at all, from the first day: the day's hold (first collector) must not keep the night away, the lesson lets go, and the night
  // reaches its end screen by itself (lost or won): no hold is left anywhere on the way. Waits are on the game's own clocks.
  { const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.addInitScript(() => { window.__dtMax = 0.5; });
    await p.goto('file://' + page + '?quality=low&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
    await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 0; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); });
    await p.waitForFunction(() => window.__game.sim && window.__game.state === 'play', null, { timeout: 120000 });
    const day = await p.evaluate(() => { const G = window.__game; return (typeof G.cfg === 'function' ? G.cfg() : G.cfg).day.duration; });
    const night = await p.waitForFunction(() => { const s = window.__game.sim; return s && s.phase === 'night'; }, null, { timeout: 900000, polling: 500 }).then(() => true, () => false);
    const t1 = await p.evaluate(() => { const s = window.__game.sim; return s ? { phase: s.phase, t: Math.round(s.t) } : null; });
    add('D: day 1 with nothing pressed: the night comes by itself (day ' + day + ' s; now ' + JSON.stringify(t1) + ')', night);
    const end = night && await p.waitForFunction(() => window.__game.state === 'end' || (window.__game.sim && window.__game.sim.done), null, { timeout: 1500000, polling: 500 }).then(() => true, () => false);
    const t2 = await p.evaluate(() => { const G = window.__game, s = G.sim; return { state: G.state, drill: !!G.drillInfo(), t: s ? Math.round(s.t) : null, hp: s ? Math.round(s.player.hp) : null }; });
    add('D: then night 1 with nothing pressed reaches its end by itself, the lesson not holding it (' + JSON.stringify(t2) + ')', !!end && !t2.drill); await ctx.close(); }
  add('no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), !errs.length);
  console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('FAIL')).length; console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
