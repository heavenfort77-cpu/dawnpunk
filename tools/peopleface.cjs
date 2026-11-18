// Front close-up of a base person's face in the game (for the scan-face samples): the player stands d m in front of them, they turn to face him, then a picture.
// Stands outside the person's obstacle circle (the game pushes the player out of it) and narrows the lens to FOV degrees for the close-up; the HUD is hidden.
// Usage: node tools/peopleface.cjs <page.html> <out.png> [low|high] [who] [scanfaces 0|1] [distance m] [extra address options, e.g. peoplehi=0 or -] [side: 1 = stand on their +z side, -1 = on their -z side (Oko faces -z in the workshop)]
const { chromium } = require('playwright');
const path = require('path');
const page = path.resolve(process.argv[2]), outp = process.argv[3], tier = process.argv[4] === 'high' ? 'high' : 'low', who = process.argv[5] || 'bram', scan = process.argv[6] || '0', dist = +(process.argv[7] || 1.4), extra = process.argv[8] || '', side = +(process.argv[9] || 1), FOV = 18;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 480 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + page + '?seed=777&quality=' + tier + '&scanfaces=' + scan + (extra ? '&' + extra : '')); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 120000 });
  await p.evaluate(() => window.__game.enterBase());
  await p.waitForFunction((who) => { const pk = window.__game.bview.peek && window.__game.bview.peek(); return pk && pk.chars[who] && pk.chars[who].ready && pk.chars[who].root.parent; }, who, { timeout: 240000 });
  await p.waitForTimeout(1500); await p.evaluate(() => { window.__dtMax = 1e-6; });
  // stand in front of them (along their home facing), let them turn and settle, look at the head
  const info = await p.evaluate(([who, d, side]) => { const g = window.__game, pk = g.bview.peek(), h = pk.npcG[who].p, ch = pk.chars[who], c = h.position, px = c.x, pz = c.z + side * d;
    g.setBase(px, pz); g.setYaw(Math.atan2(px - c.x, pz - c.z)); for (let i = 0; i < 360; i++) g.bview.update(1 / 60, px, pz, 1.6);
    const hb = ch.root.getObjectByName('head'), hp = hb.getWorldPosition(hb.position.clone()); g.setPitch(Math.atan2(hp.y + 0.05 - g.cam.position.y, d)); let tris = 0, scanParts = 0;
    ch.root.traverse((o) => { if (o.isMesh && o.visible) { const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; if (/scan/.test(o.name)) scanParts++; } });
    let top = ch.root; while (top.parent) top = top.parent; let keys = 0; top.traverse((o) => { if (o.name === 'peopleKey') keys++; });
    return { headY: hp.y, tris, scanParts, scanFlag: ch.scan, keyLights: keys, cam: [g.cam.position.x, g.cam.position.z, g.yaw, c.x, c.z] }; }, [who, dist, side]);
  await p.evaluate((fov) => { const st = document.head.appendChild(document.createElement('style')); st.textContent = 'body > *:not(canvas) { display: none !important; }'; const c = window.__game.cam; c.fov = fov; c.updateProjectionMatrix(); }, FOV);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  // the desktop scan face compiles its physical skin and shadow shaders on the first frames: the software renderer can need minutes for that
  await p.screenshot({ path: outp, timeout: 300000 });
  console.log(errs.length ? 'ERRORS ' + errs.join('|').slice(0, 300) : 'NO ERRORS', JSON.stringify(info)); await b.close();
})().catch((e) => { console.log('crashed', String(e).slice(0, 300)); process.exit(1); });
