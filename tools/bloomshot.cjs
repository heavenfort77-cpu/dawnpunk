// every device in the Bloomtech style, and several of each machine to show the random wear and missing parts
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = process.argv[2];
  const p = await b.newPage({ viewport: { width: 900, height: 480 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; window.__noHands = true; }); await p.waitForTimeout(2500);
  const rows = [[['lance', 0.5], ['twin', 0.5], ['mist', 0.5], ['sling', 0.6]], [['collector', 0], ['turbine', 0], ['moon', 0], ['prism', 0], ['chime', 0]], [['mine', 0], ['shard', 0], ['press', 0.4]], [['panel', 0], ['trellis', 0]]];
  for (let r = 0; r < rows.length; r++) { const x0 = 12 + r * 16, n = rows[r].length, sp = r === 3 ? 3.2 : r === 2 ? 2.2 : 1.5;
    await p.evaluate(([row, x0, sp, r]) => { const g = window.__game; row.forEach(([k, ry], i) => g.deviceSample(k, x0 + (i - (row.length - 1) / 2) * sp, -1.8, ry, true)); g.setTown(x0, r === 3 ? 2.6 : r === 1 ? 2.0 : 1.4); g.setYaw(0); g.setPitch(r === 3 ? -0.05 : r === 2 ? -0.3 : -0.16); }, [rows[r], x0, sp, r]); await p.waitForTimeout(1000); await p.screenshot({ path: S + 'bd' + r + '.png' }); }
  const K = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'];
  for (let i = 0; i < K.length; i++) { const x0 = -50 + i * 0, z0 = -3;
    await p.evaluate(([k, i]) => { const g = window.__game, sp = k === 'warden' ? 3.2 : k === 'hauler' ? 2.4 : 1.7; for (let j = 0; j < 3; j++) g.gloomSample(k, -52 + i * 12 + (j - 1) * sp, -2.6, Math.PI + (j - 1) * 0.3, 0.6); g.setTown(-52 + i * 12, k === 'warden' ? 4.6 : k === 'stilt' ? 3.8 : k === 'ticks' ? 0.8 : 2.6); g.setYaw(0); g.setPitch(k === 'ticks' ? -0.35 : 0.04); }, [K[i], i]); await p.waitForTimeout(900); await p.screenshot({ path: S + 'bw_' + K[i] + '.png' }); }
  console.log(errs.length ? errs.slice(0, 3).join('|') : 'NO ERRORS'); await b.close();
})();
