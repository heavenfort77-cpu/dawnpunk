// Each machine kind alone, same framing, on one graphics tier (day). Usage: node tools/gloomvs.cjs <out_prefix> <low|high> [kinds, comma separated] [extra query]
// writes <out_prefix>_<kind>_<tier>.png; then tools/gloomvs_join.py puts phone and desktop side by side.
const { chromium } = require('playwright');
const ALL = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'], tier = process.argv[3] || 'high', K = process.argv[4] ? process.argv[4].split(',') : ALL;
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 800, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + __dirname + '/../dist/index_single.html?quality=' + tier + '&seed=777' + (process.argv[5] ? '&' + process.argv[5] : '')); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  for (const k of K) { const i = ALL.indexOf(k), x = -60 + i * 9, d = k === 'stilt' ? 5.0 : k === 'warden' ? 4.6 : k === 'ticks' ? 1.9 : k === 'hauler' ? 3.6 : k === 'lantern' ? 3.6 : 3.2, eye = k === 'ticks' ? -0.62 : k === 'stilt' ? 0.1 : k === 'warden' ? 0.0 : k === 'lantern' ? -0.05 : -0.12;
    await p.evaluate(([k, x, d, pt]) => { const g = window.__game; g.gloomSample(k, x, 0.6, Math.PI + 0.45, 3 + Math.random() * 2, false); g.setTown(x, 0.6 + d); g.setYaw(0); g.setPitch && g.setPitch(pt); g.hands && g.hands.g && (g.hands.g.visible = false); g.cam.fov = 44; g.cam.updateProjectionMatrix(); }, [k, x, d, eye]); await p.waitForTimeout(2500);
    await p.screenshot({ path: process.argv[2] + '_' + k + '_' + tier + '.png', timeout: 180000 }); }
  const tris = await p.evaluate((K) => K.map((k) => k + ' ' + window.__game.gloomTris(k)), K); console.log(tier, 'triangles:', tris.join(', '));
  console.log(errs.length ? [...new Set(errs)].join('|').slice(0, 600) : 'NO ERRORS'); await b.close(); })();
