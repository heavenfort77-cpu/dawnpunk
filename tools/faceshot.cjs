// (R4 worker 5, item 7, Card 30) Marla and one villager close up at the base, same camera rule in any build: the camera stands CAM_D m in front of the face (the
// middle of the two corneas), at eye height, looking at it. Usage: node tools/faceshot.cjs <dist dir> <out prefix>   (writes <prefix>_marla.png, <prefix>_villager.png)
// Local SwiftShader, high tier, seed 777, fresh save; the HUD hidden; game time held (window.__dtMax tiny) once the people are up, so the two builds are shot alike.
const { chromium } = require('playwright'); const path = require('path');
const DIST = process.argv[2], OUT = process.argv[3], CAM_D = +(process.env.CAM_D || 0.75);
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto('file://' + path.resolve(DIST, 'index_single.html') + '?quality=high&seed=777', { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 300000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } window.__noHands = true; window.__game.enterBase(); const h = document.getElementById('hud'); if (h) h.style.visibility = 'hidden'; });
  await p.waitForTimeout(20000);
  const who = await p.evaluate(() => { const g = window.__game; let sc = g.marla.root; while (sc.parent) sc = sc.parent; const V = sc.position.constructor, rigs = [];
    sc.traverse((o) => { if (o.name === 'cornea_l') { let r = o; while (r.parent && r.parent !== sc && !(r.userData && r.userData.person) && r.name !== 'rig') r = r.parent; rigs.push(o); } });
    const inMarla = (o) => { for (let q = o; q; q = q.parent) if (q === g.marla.root) return true; return false; };
    const face = (cl) => { const cr = cl.parent.getObjectByName('cornea_r') || cl; cl.updateWorldMatrix(true, false); cr.updateWorldMatrix(true, false); const a = new V(), c = new V(); cl.geometry.computeBoundingBox(); cr.geometry.computeBoundingBox(); cl.geometry.boundingBox.getCenter(a); cr.geometry.boundingBox.getCenter(c);
      // skinned (quantized) corneas: their place is the skeleton's; use the head bone when there is one
      let hb = null; cl.parent.traverse((q) => { if (!hb && q.isBone && /head/i.test(q.name)) hb = q; }); let at; if (hb) { at = new V(); hb.getWorldPosition(at); at.y += 0.08; } else { at = a.applyMatrix4(cl.matrixWorld).add(c.applyMatrix4(cr.matrixWorld)).multiplyScalar(0.5); }
      let root = cl; while (root.parent && root.parent !== sc) root = root.parent; const d = new V(); root.getWorldDirection(d); d.y = 0; d.normalize(); return { x: at.x, y: at.y, z: at.z, dx: d.x, dz: d.z }; };
    const M = rigs.filter(inMarla), O = rigs.filter((o) => !inMarla(o)); const f = (l) => (l.length ? face(l[0]) : null);
    const vs = O.map(face).sort((u, w) => Math.hypot(u.x - 3, u.z - 7) - Math.hypot(w.x - 3, w.z - 7));
    return { marla: f(M), villager: vs[0] || null, n: rigs.length }; });
  console.log('people found: ' + JSON.stringify(who));
  for (const k of ['marla', 'villager']) { const F = who[k]; if (!F) { console.log('no ' + k); continue; }
    await p.evaluate(([F, D]) => { const g = window.__game, cx = F.x + F.dx * D, cz = F.z + F.dz * D; g.setBase(cx, cz); g.setYaw(Math.atan2(cx - F.x, cz - F.z)); g.setPitch(Math.atan2(F.y - 1.6, D)); }, [F, CAM_D]);
    await p.waitForTimeout(2500); await p.screenshot({ path: OUT + '_' + k + '.png' }); }
  console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })().catch((e) => { console.log('ERR ' + e); process.exit(1); });
