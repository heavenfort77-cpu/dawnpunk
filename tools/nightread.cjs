// can you read the machines at night? Inside a house at night each machine stands 5 m in front of the player; the picture is taken with it and without it.
// Reported per machine: % of the picture that changes (its visible area) and how far its body differs in brightness from what is behind it (screen pixels left out). Usage: node tools/nightread.cjs <out.png> [painted]
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = process.argv[2], T = out.replace(/\.png$/, '_'), look = process.argv[3] || 'gritty';
  const p = await b.newPage({ viewport: { width: 480, height: 300 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?look=' + look); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => { window.__noHands = true; window.__game.enterBase(); document.getElementById('selRing').value = '0'; window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const g = window.__game; g.enterHouse(0); g.nightfall(); }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.__game, s = g.sim; s.gloom.length = 0; s.player.x = 0; s.player.z = 3; s.player.hp = 100; g.setYaw(0); g.setPitch(0); }); await p.waitForTimeout(1200);
  const cmp = (a, c) => p.evaluate(async ([a, c]) => { const px = async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const t = document.createElement('canvas'); t.width = 240; t.height = 150; const x = t.getContext('2d'); x.drawImage(im, 0, 0, 240, 150); return x.getImageData(0, 0, 240, 150).data; }; const A = await px(a), C = await px(c); let n = 0, sum = 0, body = 0; for (let i = 0; i < A.length; i += 4) { const la = A[i] * 0.3 + A[i + 1] * 0.59 + A[i + 2] * 0.11, lc = C[i] * 0.3 + C[i + 1] * 0.59 + C[i + 2] * 0.11, d = Math.abs(la - lc); if (d > 12) { n++; if (la < 150) { body++; sum += d; } } } return [100 * n / (A.length / 4), body ? sum / body : 0]; }, [a, c]);
  const K = ['walker', 'lurcher', 'hauler', 'stilt', 'lantern', 'ticks', 'warden'], rows = [];
  for (let i = 0; i < K.length; i++) { await p.evaluate(() => { const s = window.__game.sim; s.player.hp = 100; s.gloom.length = 0; }); await p.waitForTimeout(200); const c = (await p.screenshot()).toString('base64');
    await p.evaluate((k) => { const g = window.__game; g.sim.gloom.length = 0; g.sim.player.hp = 100; g.gloomSample(k, 0.3, -2, 0.3, 3, false); }, K[i]); await p.waitForTimeout(500); const a = await p.screenshot({ path: T + i + '.png' });
    const [area, diff] = await cmp(a.toString('base64'), c); rows.push([K[i], area, diff]); await p.evaluate(() => { const o = window.__lastSample; if (o && o.parent) o.parent.remove(o); }); await p.waitForTimeout(150); }
  // outside, seen through an opening against the night
  const bp = await p.evaluate(() => { const s = window.__game.sim, q = s.breaches.find((x) => x.floor === 0 && x.type !== 'door') || s.breaches[0]; return { x: q.x, z: q.z, nx: q.nx, nz: q.nz }; });
  await p.evaluate((q) => { const g = window.__game, s = g.sim; s.player.x = q.x + q.nx * 2.6; s.player.z = q.z + q.nz * 2.6; g.setYaw(Math.atan2(q.nx, q.nz)); g.setPitch(0); }, bp); await p.waitForTimeout(700);
  for (const k of ['walker', 'lurcher', 'stilt']) { await p.evaluate(() => { const s = window.__game.sim; s.player.hp = 100; s.gloom.length = 0; }); await p.waitForTimeout(200); const c = (await p.screenshot()).toString('base64');
    await p.evaluate(([k, q]) => { const g = window.__game; g.sim.gloom.length = 0; g.gloomSample(k, q.x - q.nx * 2.4, q.z - q.nz * 2.4, Math.atan2(q.nx, q.nz) + Math.PI, 3, false); }, [k, bp]); await p.waitForTimeout(500); const a = await p.screenshot({ path: T + 'out_' + k + '.png' });
    const [area, diff] = await cmp(a.toString('base64'), c); rows.push([k + ' outside', area, diff]); await p.evaluate(() => { const o = window.__lastSample; if (o && o.parent) o.parent.remove(o); }); await p.waitForTimeout(150); }
  let bad = 0; for (const [k, area, diff] of rows) { const ok = area >= 0.3 && diff >= 14; if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + k.padEnd(15) + ' visible area ' + area.toFixed(1) + '% of the picture, body stands out by ' + diff.toFixed(0) + ' of 255'); }
  console.log(look + ': ' + (bad ? bad + ' HARD TO READ' : 'ALL READABLE') + (errs.length ? ' ' + errs.join('|').slice(0, 200) : '')); await b.close();
  execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${T}%d.png'%i) for i in range(7)]
w,h=ims[0].size; o=Image.new('RGB',(w*4,h*2)); [o.paste(im,(w*(i%4),h*(i//4))) for i,im in enumerate(ims)]; o.save('${out}')"`);
})();
