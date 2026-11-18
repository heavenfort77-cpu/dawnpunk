// THE BECKONER check (final-night boss): start a ring-5 night, see it rise, summon (teal glow), slam with a telegraph (ring), break a paw, reach dawn and collapse; no page errors.
// Usage: node tools/bosscheck.cjs <low|high> [shot_dir]   (low: dist/index.html?quality=low; high: dist/index_single.html?quality=high, the desktop model and cannon-es inside)
// With a shot_dir it also saves pictures of each moment (rise, summon, telegraph, impact, broken paw, dawn collapse) for the sample sheet.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const tier = process.argv[2] || 'low', dir = process.argv[3] || null, W = +(process.env.W || 1280), H = +(process.env.H || 720);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [], out = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.setDefaultTimeout(240000);
  const page = tier === 'high' ? 'dist/index_single.html?quality=high' : 'dist/index.html?quality=low';
  await p.goto('file://' + path.resolve(__dirname, '..', page.split('?')[0]) + '?' + page.split('?')[1] + '&seed=' + (process.env.SEED || 11));
  await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 240000 });
  await p.evaluate(() => { window.__dtMax = 0.25; window.__noHands = true; const g = window.__game; g.enterBase(); const sel = document.getElementById('selRing'); [...sel.options].forEach((o) => { o.disabled = false; }); sel.value = '4'; g.startRun(); });
  await p.waitForTimeout(1500);
  const house = +(process.env.HOUSE || 0);
  await p.evaluate((hi) => { const g = window.__game, r = g.run, h = r.houses.slice().sort((a, b) => a.n - b.n)[hi === 9 ? 0 : 0]; const hh = hi === 9 ? h : r.houses[hi]; g.setTown(hh.doorX, hh.doorZ - hh.row * 0.4); }, house);
  // desktop: the model starts loading when the boss ring's run starts (src/bosshi.js bossPreload); a player walks the street first, so the check waits for it here, before the night
  if (tier === 'high') { for (let k = 0; k < 120; k++) { if (await p.evaluate(() => window.__boss.model === 'ready' || window.__boss.model === 'failed')) break; await p.waitForTimeout(1000); } }
  await p.waitForTimeout(600); await p.evaluate(() => window.__game.nightfall()); await p.waitForTimeout(800);
  // the player: plenty of health, stands where it can see the boss (inside, at an opening that faces it), looks at a point
  const look = async (what, back) => p.evaluate(([what, back]) => { const g = window.__game, s = g.sim, B = s.boss, C = window.CONFIG.boss; s.player.hp = 1e6;
    const pt = what === 'body' ? B.at([0, 4.2, 0]) : what === 'beckon' ? B.at(C.pts.beckon) : what === 'chest' ? B.at(C.pts.chest) : what && what.x !== undefined ? what : B.at([0, 4.5, 0]);
    let best = null; for (const b of s.breaches) { if (b.floor !== 0) continue; const dx = b.x - pt.x, dz = b.z - pt.z, d = Math.hypot(dx, dz) || 1, x = b.x + dx / d * (back || 2.2), z = b.z + dz / d * (back || 2.2); if (Math.abs(x) > s.H - 0.4 || Math.abs(z) > s.H - 0.4 || dx * b.nx + dz * b.nz <= 0) continue; if (!s.openAt(x, z, pt.x, pt.z, 0)) continue; const dd = Math.hypot(x - pt.x, z - pt.z); if (!best || dd < best.dd) best = { x, z, dd }; }
    if (!best) return null; s.player.x = best.x; s.player.z = best.z; s.player.floor = 0; const dx = pt.x - best.x, dz = pt.z - best.z; g.setYaw(Math.atan2(-dx, -dz)); g.setPitch(Math.atan2((pt.y || 4) - 1.6, Math.hypot(dx, dz))); return best; }, [what, back]);
  // run the night forward (sim steps in the page) until a condition, letting frames draw in between
  const until = async (fn, maxS, arg) => { for (let k = 0; k < (maxS || 200) * 2; k++) { const r = await p.evaluate(([f, a]) => { const g = window.__game, s = g.sim; if (!s) return 'nosim'; s.player.hp = Math.max(s.player.hp, 1e6); const test = new Function('s', 'B', 'a', 'return (' + f + ')(s, B, a)'); for (let i = 0; i < 5 && !s.done; i++) { if (test(s, s.boss, a)) return true; s.step(0.1); } return test(s, s.boss, a); }, [fn.toString(), arg]); if (r === true) return true; if (r === 'nosim') return false; await p.waitForTimeout(60); } return false; };
  // game time is held almost still while a picture is taken (a software-rendered screenshot takes seconds; the fight must not move on meanwhile)
  const shot = async (name) => { if (!dir) return; fs.mkdirSync(dir, { recursive: true }); await p.waitForTimeout(400); await p.evaluate(() => { window.__dtKeep = window.__dtMax; window.__dtMax = 0.0005; }); await p.screenshot({ path: path.join(dir, tier + '_' + name + '.png') }); await p.evaluate(() => { window.__dtMax = window.__dtKeep; }); };
  const st = () => p.evaluate(() => { const s = window.__game.sim, B = s && s.boss; return { b: window.__boss.built, model: window.__boss.model, phys: window.__boss.physics, ev: window.__boss.events.slice(), phase: B && B.phase, t: s && s.t, done: s && s.done, win: s && s.win, pieces: window.__boss.pieces, tris: window.__boss.tris }; });
  out.push(['a ring-5 night has the boss (sim)', await p.evaluate(() => !!(window.__game.sim && window.__game.sim.boss))]);
  if (tier === 'high') { for (let k = 0; k < 90; k++) { const s = await st(); if (s.model === 'ready' || s.model === 'failed') break; await p.waitForTimeout(1000); } }
  await look('body', 2.6);
  const rose = await until((s, B) => B.phase === 'rise' && s.t > 2.6, 30); await shot('1_rise');
  await until((s, B) => B.phase === 'idle', 30); let s0 = await st();
  if (dir) { // a picture from out in the street (the player moved outside for the picture only), then back in the house
    const keep = await p.evaluate(() => { const g = window.__game, s = g.sim, B = s.boss, p0 = { x: s.player.x, z: s.player.z }, d = +(window.__streetD || 15); s.player.x = B.x + B.fx * d + B.rx * 4; s.player.z = B.z + B.fz * d + B.rz * 4; const dx = B.x - s.player.x, dz = B.z - s.player.z; g.setYaw(Math.atan2(-dx, -dz)); g.setPitch(0.2); return p0; });
    await shot('1b_street'); await p.evaluate(() => { const g = window.__game, s = g.sim, B = s.boss; s.player.x = B.x + B.fx * 7 + B.rx * 2; s.player.z = B.z + B.fz * 7 + B.rz * 2; const dx = B.x - s.player.x, dz = B.z - s.player.z; g.setYaw(Math.atan2(-dx, -dz) + 0.05); g.setPitch(0.42); }); await shot('1c_close');
    await look('body', 2.6); }
  out.push(['it rises at night start (' + s0.b + ' build, model ' + s0.model + ', ' + Math.round(s0.tris) + ' triangles)', rose && s0.ev.includes('rise') && !!s0.b]);
  if (tier === 'high') out.push(['desktop draws the Blender model and loads cannon-es (model ' + s0.model + ', physics ' + s0.phys + ')', s0.b === 'glb' && (s0.phys === 'ready' || s0.phys === 'running')]);
  else out.push(['the phone draws the code-built cat and never loads cannon-es (physics ' + s0.phys + ', ' + Math.round(s0.tris) + ' triangles)', s0.b === 'code' && s0.phys === 'none' && s0.tris < 14000]);
  // summon: the teal glow, then Gloom
  const okB = await until((s, B) => B.act && B.act.kind === 'summon' && B.act.step === 'tele' && B.act.left < 0.8, 90); await look('beckon', 2.4); await shot('2_summon_glow');
  if (dir) { await p.evaluate(() => { const g = window.__game, s = g.sim, B = s.boss; s.player.x = B.x + B.fx * 13 - B.rx * 5; s.player.z = B.z + B.fz * 13 - B.rz * 5; const dx = B.x - s.player.x, dz = B.z - s.player.z; g.setYaw(Math.atan2(-dx, -dz) - 0.12); g.setPitch(0.26); }); await shot('2b_itch_summon'); }
  await until((s, B) => B.act && B.act.kind === 'summon' && B.act.step === 'hold', 10); s0 = await st();
  out.push(['it beckons with a glow, then summons (or skips at the cap)', okB && (s0.ev.includes('summon') || s0.ev.includes('skip'))]);
  // break the beckoning paw while it is raised (7 cannon hits)
  // the hits land while the paw is up (the next summon if this one is over)
  const broke = await until((s, B) => { if (B.points().some((q) => q.id === 'beckon')) { let n = 0; while (!B.paws.beckon.broken && n++ < 20) B.hit('beckon', 1); } return B.paws.beckon.broken; }, 90);
  for (let k = 0; k < 10; k++) await p.waitForTimeout(150); s0 = await st(); await shot('3_paw_broken');
  out.push(['a raised paw breaks after 7 hits and its plates fall (' + s0.pieces + ' pieces)', broke && s0.ev.includes('break') && s0.pieces >= 1]);
  // slam: a telegraph ring, then the impact
  const okT = await until((s, B) => B.act && B.act.kind === 'slam' && B.act.step === 'tele' && B.act.left < B.act.dur * 0.5, 90);
  const tg = await p.evaluate(() => { const a = window.__game.sim.boss.act; return a ? { x: a.tg.x, z: a.tg.z, y: 2.5 } : null; });
  if (tg) await look({ x: tg.x, y: 1.2, z: tg.z }, 3.2); await shot('4_slam_telegraph');
  const ringOn = await p.evaluate(() => !!window.__boss.ringSeen);
  const okI = await until((s, B) => B.act && B.act.kind === 'slam' && B.act.step === 'stuck', 10); await shot('5_slam_stuck'); s0 = await st();
  out.push(['the slam is telegraphed (warning ring shown) and lands', okT && ringOn && okI && s0.ev.includes('tele') && s0.ev.includes('impact')]);
  // dawn: power saver, collapse, the night is won
  await until((s, B) => B.phase === 'down', 200); await look('body', 2.6); for (let k = 0; k < 14; k++) await p.waitForTimeout(250); await shot('6_dawn_saver');
  await until((s) => s.done, 30); for (let k = 0; k < 20; k++) await p.waitForTimeout(250); s0 = await st(); await shot('7_dawn_collapse');
  out.push(['at dawn it powers down and collapses; the night is won (' + s0.pieces + ' pieces)', s0.ev.includes('dawn') && s0.done && s0.win && s0.pieces >= 6]);
  const endTxt = await p.evaluate(() => document.getElementById('endBody').textContent);
  out.push(['the night results show the boss line', /Beckoner/.test(endTxt) && !/lucky/i.test(endTxt)]);
  out.push(['no page errors', errs.length === 0]);
  let bad = 0; for (const [n, ok] of out) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) bad++; } console.log(bad ? 'SOME FAILED ' + errs.slice(0, 3).join(' | ') : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
