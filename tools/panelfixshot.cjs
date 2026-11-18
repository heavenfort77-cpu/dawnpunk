// Pictures for the interface fix pass (panel review, Nov 17). Usage: node tools/panelfixshot.cjs <abs page.html> <outPrefix> <views>
// views (comma list): dayD (desktop street by day, aimed at a dormant machine), nightD (desktop house at night, aimed at a machine), dayP / nightP (phone, Pixel 7 sideways),
// base (desktop base plaza with the floating labels), near (desktop, 5 m from the hatchery sign), panelD (hatchery panel, desktop), panelP (Oko's panel, phone 844x390).
// Night views also write <out>_<view>_scene.png (HUD hidden, for the scene's mean brightness) and <out>_<view>.json (where each machine in sight is on the screen).
const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const args = process.argv.slice(2).filter((a) => a !== '--dry'), [page, out, views = 'dayD'] = args; const list = views.split(',');
  // --dry: check the arguments and the view names without a browser (setup rule, Nov 17 20:35)
  { const known = ['dayD', 'nightD', 'dayP', 'nightP', 'base', 'near', 'panelD', 'panelP', 'drillD', 'n2D', 'drillP', 'n2P', 'mapD', 'mapP'], bad = list.filter((v) => !known.includes(v)), fs0 = require('fs');
    if (!page || !fs0.existsSync(page) || !out || !fs0.existsSync(require('path').dirname(out)) || bad.length) { console.error('ARG ERROR page ' + page + (page && fs0.existsSync(page) ? ' ok' : ' MISSING') + ', out dir ' + (out ? require('path').dirname(out) : '-') + ', unknown views: ' + bad.join(',')); process.exit(2); }
    if (process.argv.includes('--dry')) { console.log('DRY OK ' + list.length + ' views: ' + list.join(',')); process.exit(0); } }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const v of list) {
    const phone = /P$/.test(v), hi = !phone && v !== 'panelD';
    const ctx = phone ? (v === 'panelP' ? await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }) : await b.newContext({ ...devices['Pixel 7 landscape'] })) : await b.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript(() => { window.__dtMax = 0.6; try { localStorage.clear(); } catch (e) { /* none */ } });
    const t0 = Date.now();
    await p.goto('file://' + page + '?seed=777&quality=' + (hi ? 'high' : 'low'), { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 180000 });
    const shot = async (name) => { await p.screenshot({ path: out + '_' + name + '.png', timeout: 300000 }); console.log('wrote', out + '_' + name + '.png', Math.round((Date.now() - t0) / 1000) + ' s'); };
    // screen positions of the machines in sight (camera matrices read in the page; no THREE global)
    const where = () => p.evaluate(() => { const g = window.__game, s = g.sim, c = g.cam, C = typeof g.cfg === 'function' ? g.cfg() : g.cfg; if (!s || !c) return []; c.updateMatrixWorld(); const V = c.matrixWorldInverse.elements, P = c.projectionMatrix.elements, W = innerWidth, H = innerHeight;
      const proj = (x, y, z) => { const vx = V[0] * x + V[4] * y + V[8] * z + V[12], vy = V[1] * x + V[5] * y + V[9] * z + V[13], vz = V[2] * x + V[6] * y + V[10] * z + V[14]; const cx = P[0] * vx + P[4] * vy + P[8] * vz + P[12], cy = P[1] * vx + P[5] * vy + P[9] * vz + P[13], cw = P[3] * vx + P[7] * vy + P[11] * vz + P[15]; return cw <= 0 ? null : [(cx / cw + 1) / 2 * W, (1 - cy / cw) / 2 * H]; };
      return s.gloom.filter((q) => s.canSee(q)).map((q) => { const y0 = (q.floor || 0) * C.floorH, top = proj(q.x, y0 + C.gloomH, q.z), foot = proj(q.x, y0, q.z), mid = proj(q.x, y0 + C.panelH, q.z); return { kind: q.kind, d: Math.hypot(q.x - s.player.x, q.z - s.player.z), top, foot, mid }; }).filter((q) => q.top && q.foot); });
    if (v === 'dayD' || v === 'dayP') {
      await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); }); await p.waitForTimeout(3000);
      await p.evaluate(() => { const g = window.__game, d = g.run.dormant[0]; g.setTown(d.x + 5, d.z + 0.5); g.setYaw(Math.atan2(5, 0.5)); g.setPitch(0); });
      await p.waitForTimeout(phone ? 3000 : 7000); await shot(v);
    }
    if (v === 'nightD' || v === 'nightP') {
      await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await p.waitForTimeout(2500);
      await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(1500);
      await p.evaluate(() => { const s = window.__game.sim; s.t = 40; s.player.energy = 20; }); await p.waitForTimeout(phone ? 5000 : 10000);
      // face the nearest machine in sight (or the nearest one), keep the player alive
      for (let k = 0; k < 40; k++) { const ok = await p.evaluate(() => { const g = window.__game, s = g.sim; s.player.hp = 100; const P = s.player; const vis = s.gloom.filter((q) => q.floor === P.floor && s.canSee(q)).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)); const q = vis[0]; if (!q) return false; g.setYaw(Math.atan2(-(q.x - P.x), -(q.z - P.z))); g.setPitch(-0.05); return true; }); if (ok) break; await p.waitForTimeout(1000); }
      await p.keyboard.press('Digit2').catch(() => {}); await p.waitForTimeout(phone ? 1500 : 3500);
      await p.evaluate(() => { const g = window.__game, s = g.sim; s.paused = true; window.__freeze = s.t; });
      const w = await where(); fs.writeFileSync(out + '_' + v + '.json', JSON.stringify(w));
      await shot(v);
      await p.evaluate(() => { document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(300); await shot(v + '_scene');
      await p.evaluate(() => { document.getElementById('hud').style.visibility = ''; });
    }
    // drill pictures (Nov 17 18:28): night 1 with the drill (fresh storage) and night 2 (save.nights = 1: clean screen), desktop and phone
    if (/^(drill|n2)[DP]$/.test(v)) {
      const n2 = v.startsWith('n2');
      await p.evaluate((n2) => { const g = window.__game; g.enterBase(); g.save.nights = n2 ? 1 : 0; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }, n2); await p.waitForTimeout(2500);
      await p.evaluate(() => window.__game.endDay()); await p.waitForTimeout(phone ? 4000 : 8000);
      if (n2) await p.evaluate(() => { const s = window.__game.sim; s.t = 40; s.player.energy = 30; });
      for (let k = 0; k < 40; k++) { const ok = await p.evaluate(() => { const g = window.__game, s = g.sim; s.player.hp = 100; const P = s.player; const vis = s.gloom.filter((q) => q.floor === P.floor && s.canSee(q)); const q = vis[0]; if (!q) return false; g.setYaw(Math.atan2(-(q.x - P.x), -(q.z - P.z))); g.setPitch(-0.05); return true; }); if (ok) break; await p.waitForTimeout(1000); }
      await p.waitForTimeout(phone ? 1500 : 3500); await shot(v);
    }
    // the base minimap (Nov 17 19:43): base by day, standing about 10 m from Marla
    if (v === 'mapD' || v === 'mapP') {
      await p.evaluate(() => window.__game.enterBase()); await p.waitForTimeout(2500);
      await p.evaluate(() => { const g = window.__game, sp = g.B.scoutPos(g.save); g.setBase(sp.x * 0.4, sp.z * 0.4 + 2); g.setYaw(0.4); g.setPitch(0); }); await p.waitForTimeout(phone ? 3000 : 9000); await shot(v);
    }
    if (v === 'base' || v === 'near') {
      await p.evaluate(() => window.__game.enterBase()); await p.waitForTimeout(2500);
      await p.evaluate((near) => { const g = window.__game; const [x, z, tx, tz] = near ? [3.3, 7.6, 5.1, 12.0] : [-0.5, -1.5, 5.1, 12.0]; g.setBase(x, z); g.setYaw(Math.atan2(-(tx - x), -(tz - z))); g.setPitch(near ? 0.05 : 0); }, v === 'near'); await p.waitForTimeout(hi ? 9000 : 3000); await shot(v);
    }
    if (v === 'panelD' || v === 'panelP') {
      await p.evaluate(() => window.__game.enterBase()); await p.waitForTimeout(2000);
      await p.evaluate((ph) => { const g = window.__game, s = g.save; if (ph) { g.openPanel('oko'); return; } if (s.avians) { s.avians.held = Math.max(1, s.avians.held || 0); s.avians.coop = Math.max(2, s.avians.coop || 0); } g.openPanel('hatchery'); }, v === 'panelP'); await p.waitForTimeout(1200); await shot(v);
    }
    console.log(v, errs.length ? 'PAGE ERRORS ' + errs.slice(0, 3).join(' | ') : 'NO ERRORS');
    await ctx.close();
  }
  await b.close();
})();
