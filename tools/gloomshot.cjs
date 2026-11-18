// the seven Gloom machines: a daylight lineup (awake pose), each one closer, the dormant day ones, and a night room
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 900, height: 420 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|swiftshader|WebGL/i.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  const K = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'];
  await p.evaluate((K) => { const g = window.__game; g.hands.g && (g.hands.g.visible = false); K.forEach((k, i) => g.gloomSample(k, -40 + i * 2.6, -8, Math.PI, 3.2 + i)); g.setTown(-32.2, -0.2); g.setYaw(0); }, K); await p.waitForTimeout(1500); await p.screenshot({ path: S + 'gl_line.png' });
  for (let i = 0; i < 7; i++) { await p.evaluate((i) => { const g = window.__game; g.setTown(-40 + i * 2.6 + 0.9, -8 + (i === 6 || i === 3 ? 5.2 : i === 5 ? 2.4 : 4)); g.setYaw(0.2); }, i); await p.waitForTimeout(500); await p.screenshot({ path: S + 'gl_' + K[i] + '.png' }); }
  const D = await p.evaluate(() => window.__game.run.dormant.map((d) => [d.x, d.z, d.kind]));
  for (let i = 0; i < Math.min(2, D.length); i++) { await p.evaluate(([x, z]) => { const g = window.__game; g.setTown(x + 1.2, z + (z > 0 ? -4 : 4)); g.setYaw(z > 0 ? Math.PI + 0.25 : -0.25); }, D[i]); await p.waitForTimeout(700); await p.screenshot({ path: S + 'gl_dorm' + i + '.png' }); }
  const h = await p.evaluate(() => { const r = window.__game.run, h = r.houses.slice().sort((a, b) => a.n - b.n)[0]; return [h.doorX, h.doorZ, h.row]; });
  await p.evaluate(([x, z, row]) => window.__game.setTown(x, z - row * 0.4), h); await p.waitForTimeout(900); await p.evaluate(() => window.__game.nightfall()); await p.waitForTimeout(1500);
  let n = 0; for (let k = 0; k < 40 && n < 2; k++) { await p.waitForTimeout(1500);
    const near = await p.evaluate(() => { const s = window.__game.sim; if (!s) return null; let best = null; for (const g of s.gloom) { const d = Math.hypot(g.x - s.player.x, g.z - s.player.z); if (g.floor === s.player.floor && d < 5.5 && d > 2.2 && Math.abs(g.x) < s.H && Math.abs(g.z) < s.H && (!best || d < best.d)) best = { d, x: g.x, z: g.z }; } if (best) { s.player.hp = 100; window.__game.setYaw(Math.atan2(best.x - s.player.x, best.z - s.player.z) + Math.PI); } return best; });
    if (near) { await p.waitForTimeout(150); await p.screenshot({ path: S + 'gl_night' + n + '.png' }); n++; await p.waitForTimeout(3000); } }
  console.log(errs.length ? errs.slice(0, 3).join('|') : 'NO ERRORS', 'dormant', D.map((d) => d[2]).join(','), 'night shots', n); await b.close();
})();
