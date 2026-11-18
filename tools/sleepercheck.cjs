// light sleepers (day) and the charged shot (night). Usage: node tools/sleepercheck.cjs [picture prefix]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 844, height: 390 } }); const errs = [], out = [], S = process.argv[2];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '1'; window.__game.startRun(0); }); await p.waitForTimeout(2000);
  const light = await p.evaluate(async () => { const g = window.__game, r = g.run, d = r.dormant[0]; g.setTown(d.x + 2.2, d.z); await new Promise((q) => setTimeout(q, 1200)); return d.awake || 0; }); out.push(['a light pack does not wake a sleeper', light === 0]);
  const woke = await p.evaluate(async () => { const g = window.__game, r = g.run, d = r.dormant[0]; r.food = 40; g.setTown(d.x + 2.2, d.z); g.setYaw(Math.atan2(2.2, 0)); for (let k = 0; k < 40 && !d.awake; k++) await new Promise((q) => setTimeout(q, 100)); await new Promise((q) => setTimeout(q, 150)); return { awake: d.awake || 0, marla: document.getElementById('marla').textContent }; }); out.push(['a heavy pack close by wakes it, and Marla says so: ' + woke.marla, woke.awake > 0 && /woke/.test(woke.marla)]);
  if (S) await p.screenshot({ path: S + '_sleeper.png' });
  const res = await p.evaluate(async () => { const g = window.__game, r = g.run, d = r.dormant[0], x0 = d.x, z0 = d.z; for (let k = 0; k < 120 && !d.spent; k++) await new Promise((q) => setTimeout(q, 250)); return { hurt: r.hurt || 0, spent: !!d.spent, awake: d.awake || 0, moved: Math.hypot(d.x - x0, d.z - z0), msg: document.getElementById('msg').textContent, hp: document.getElementById('hp').style.width }; });
  out.push(['it came for the player, struck once (' + res.hurt + ' health, bar ' + res.hp + ') and powered down', res.hurt === 15 && res.spent && res.awake === 0]);
  const again = await p.evaluate(async () => { const g = window.__game, r = g.run, d = r.dormant[0]; g.setTown(d.x + 2, d.z); await new Promise((q) => setTimeout(q, 900)); return d.awake || 0; }); out.push(['a spent sleeper does not wake again', again === 0]);
  // night: charged shot
  const h = await p.evaluate(() => { const r = window.__game.run, h = r.houses[0]; return [h.doorX, h.doorZ, h.row]; }); await p.evaluate(([x, z, row]) => window.__game.setTown(x, z - row * 0.4), h); await p.waitForTimeout(900);
  await p.evaluate(() => window.__game.nightfall()); await p.waitForTimeout(1500);
  const hp0 = await p.evaluate(() => window.__game.sim.player.hp); out.push(['the strike carries into the night (health ' + hp0 + ')', hp0 === 85]);
  const lab = await p.evaluate(() => document.getElementById('bFire').textContent); out.push(['FIRE button tells about the charged shot: ' + lab, /hold/.test(lab)]);
  await p.evaluate(() => { window.__game.sim.player.energy = 30; }); const fb = await (await p.$('#bFire')).boundingBox(); await p.mouse.move(fb.x + 20, fb.y + 20); await p.mouse.down(); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); const mid = await p.evaluate(() => document.getElementById('bFire').textContent); let full = ''; for (let k = 0; k < 30 && !/LET GO/.test(full); k++) { await p.waitForTimeout(200); full = await p.evaluate(() => document.getElementById('bFire').textContent); } if (S) await p.screenshot({ path: S + '_charge.png' }); await p.mouse.up(); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ e: window.__game.sim.player.energy, marla: document.getElementById('marla').textContent }));
  out.push(['holding FIRE shows the charge, then LET GO: "' + mid + '" -> "' + full + '"', /CHARGE/.test(mid) && /LET GO/.test(full)], ['one normal shot on press (1) and one charged shot on release (3): battery 30 -> ' + after.e.toFixed(1) + '; Marla: ' + after.marla, after.e <= 26.6 && after.e >= 25.5 && /Charged shot/.test(after.marla)], ['no page errors', !errs.length]);
  let f = 0; for (const [n, ok] of out) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) f++; } console.log(f ? 'SOME FAILED ' + errs.slice(0, 2).join('|') : 'ALL PASS'); await b.close();
})();
