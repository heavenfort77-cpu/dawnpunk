// desolate SAMPLE pictures: same camera, today's look with the sample placed (?desolate=place) and the restyle (?look=desolate).
// Usage: node tools/desoshot.cjs <out_prefix> [car|street]   -> <out>_before.png, <out>_after.png
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const what = process.argv[3] || 'car';
  for (const [tag, q] of [['before', 'desolate=place'], ['after', 'look=desolate']]) {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('file://' + __dirname + '/../dist/index.html?quality=high&seed=777&' + q); await p.waitForFunction(() => window.__game && window.__game.startRun);
    await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
    const c = await p.evaluate(() => { const c = window.__game.run.cars[0], h = window.__game.run.houses[0]; return { x: c.x, z: c.z, yaw: c.yaw, hx: h.doorX, hz: h.z }; });
    if (what === 'street') { const side = Math.sign(c.hz) || 1, cx = c.hx + 9, cz = -side * 2.8, tx = c.hx + 2.5, tz = c.hz * 0.75; await p.evaluate(([x, z, yaw]) => { const g = window.__game; g.setTown(x, z); g.setYaw(yaw); g.setPitch && g.setPitch(0.06); }, [cx, cz, Math.atan2(-(tx - cx), -(tz - cz))]); await p.waitForTimeout(2500); await p.screenshot({ path: process.argv[2] + '_' + tag + '.png' }); console.log(tag, errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await p.close(); continue; }
    if (what === 'walker') { const side = Math.sign(c.hz) || 1, wx = c.hx - 3, wz = side * 1.8; await p.evaluate(([x, z]) => { const g = window.__game; g.gloomSample('walker', x, z, Math.PI / 2 + 0.3, 3, false); g.setTown(x - 2.6, z + 0.2); g.setYaw(Math.atan2(-2.6, 0.2)); g.hands && g.hands.g && (g.hands.g.visible = false); g.setPitch && g.setPitch(0.02); }, [wx, wz]); await p.waitForTimeout(2500); await p.screenshot({ path: process.argv[2] + '_' + tag + '.png' }); console.log(tag, errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await p.close(); continue; }
    const [d, a, pitch] = what === 'car' ? [5.0, 0.75, -0.12] : [11, 0.35, 0.0];
    const ang = c.yaw + Math.PI / 2 + a, cx = c.x + Math.cos(ang) * d, cz = c.z - Math.sin(ang) * d;
    await p.evaluate(([x, z, yaw, pt]) => { const g = window.__game; g.setTown(x, z); g.setYaw(yaw); g.setPitch && g.setPitch(pt); }, [cx, cz, Math.atan2(-(c.x - cx), -(c.z - cz)), pitch]); await p.waitForTimeout(2500);
    await p.screenshot({ path: process.argv[2] + '_' + tag + '.png' }); console.log(tag, errs.length ? errs.join('|').slice(0, 300) : 'NO ERRORS'); await p.close(); }
  await b.close(); })();
