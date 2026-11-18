const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 844, height: 390 } }); p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const S = '/tmp/claude-0/-home-claude/f6d1c949-d179-5fcf-9724-bf18824fc0f0/scratchpad/';
  await p.goto('file://' + __dirname + '/../dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.startRun);
  await p.evaluate(() => window.__game.enterBase()); await p.waitForFunction(() => window.__game.marla.ready && window.__game.marla.root.parent, null, { timeout: 30000 }); await p.waitForTimeout(500);
  const pos = await p.evaluate(() => { const v = window.__game.marla.root.parent.position; return [v.x, v.z]; });
  for (const [k, d] of [[1, 3.2], [2, 1.5]]) { await p.evaluate(([x, z, d]) => { const g = window.__game, l = Math.hypot(x, z) || 1, px = x - x / l * d, pz = z - z / l * d; g.setBase(px, pz); g.setYaw(Math.atan2(-(x - px), -(z - pz))); }, [pos[0], pos[1], d]); await p.waitForTimeout(1800); await p.screenshot({ path: S + 'marla_base' + k + '.png' }); }
  const info = await p.evaluate(() => { const g = window.__game, r = g.marla.root; let tris = 0, bones = 0, morph = 0; r.traverse(o => { if (o.isMesh) { tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; if (o.morphTargetDictionary) morph = Math.max(morph, Object.keys(o.morphTargetDictionary).length); } if (o.isBone) bones++; }); return { tris, bones, morph, calls: g.drawCalls() }; });
  console.log(JSON.stringify(info), errs.length ? 'ERRORS ' + errs.slice(0, 3).join(' || ') : 'NO ERRORS'); await b.close();
})();
