// Debug the base stream's water in the real page: what draws over the channel. Usage: node tools/waterdebug.cjs <low|high> <page> <out_prefix>
// Prints the ground and water meshes' facts, then takes three pictures of the same stream view: as is, water hidden, ground hidden (and the pixel at the middle of each).
const { chromium } = require('playwright'); const [QL, PAGE, OUT] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 915, height: 412 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + PAGE + '?quality=' + QL + '&seed=777', { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 240000 });
  await p.evaluate(() => { localStorage.clear(); window.__game.enterBase(); }); await p.waitForTimeout(4000);
  const info = await p.evaluate(() => { const g = window.__game, root = g.bview.group, out = [];
    root.traverse((o) => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const P = o.geometry.attributes.position; let mn = 1e9, mx = -1e9; for (let i = 0; i < P.count; i++) { mn = Math.min(mn, P.getY(i)); mx = Math.max(mx, P.getY(i)); }
      if ((mn < -0.1 && P.count > 50) || (o.material && o.material.transparent && mn < 0)) out.push({ type: o.material.type, tr: o.material.transparent, op: o.material.opacity, vis: o.visible, ord: o.renderOrder, cnt: P.count, mn: +mn.toFixed(3), mx: +mx.toFixed(3), rotX: +o.rotation.x.toFixed(2), posY: o.position.y, parentVis: o.parent && o.parent.visible, map: o.material.map ? [o.material.map.image && o.material.map.image.width, o.material.map.image && o.material.map.image.height] : null, side: o.material.side, dt: o.material.depthTest, dw: o.material.depthWrite, own: !!o.userData.ownGround }); });
    return out; });
  console.log(JSON.stringify(info, null, 0));
  await p.evaluate(() => { for (const id of ['msg', 'mlook', 'marla', 'hud', 'hud2', 'bq', 'bprompt']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } const g = window.__game; g.setBase(14.2, -5.9); g.setYaw(Math.atan2(-(11.4 - 14.2), -(-8.9 + 5.9))); g.setPitch(-0.45); });
  const px = async (name) => { await p.waitForTimeout(1500); await p.screenshot({ path: OUT + '_' + name + '.png' }); const c = await p.evaluate(() => { const cv = document.querySelector('canvas'); const gl = cv.getContext('webgl2') || cv.getContext('webgl'); return null; }); console.log('shot', name); };
  await px('asis');
  await p.evaluate(() => { const g = window.__game; g.bview.group.traverse((o) => { if (o.isMesh && o.material && o.material.transparent && o.geometry.attributes.position.count > 300 && o.material.map) o.visible = false; }); }); await px('nowater');
  await p.evaluate(() => { const g = window.__game; g.bview.group.traverse((o) => { if (o.isMesh && o.material && o.material.transparent && o.geometry.attributes.position.count > 300 && o.material.map) o.visible = true; if (o.isMesh && o.userData.ownGround) o.visible = false; }); }); await px('noground');
  console.log('errors', errs.length, errs.slice(0, 3).join(' | ')); await b.close(); })();
