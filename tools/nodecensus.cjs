// Node census (diagnostic, owner Nov 22: the night is slower than the hub; profile: updateMatrixWorld 14-16 % and projectObject 7-8 % of the frame at night):
// the same saves and steps as perfcheck's hub and combat spots (medium), then per top-level piece of the scene: nodes the per-frame matrix pass reaches (three.js
// updateMatrixWorld: a child is entered while its matrixWorldAutoUpdate is on), of those how many recompose their own matrix (matrixAutoUpdate), nodes the draw
// walk reaches (visible), meshes drawn candidates. Two levels deep for the biggest pieces. Usage: node tools/nodecensus.cjs [dist] [quality]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const D = process.argv[2] || path.join(__dirname, '..', 'dist'), QUAL = process.argv[3] || 'medium';
const srv = http.createServer((q, r) => { const f = path.join(D, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(b); }); });
const INIT = ({ seed }) => { let s = seed; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; try { localStorage.clear(); } catch (e) { /* none */ } };
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const cx = await b.newContext({ viewport: { width: 960, height: 540 } }); await cx.addInitScript(INIT, { seed: 777 }); const p = await cx.newPage(); p.setDefaultTimeout(900000);
  await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?quality=' + QUAL + '&seed=777&cards=1');
  await p.waitForFunction(() => window.__game && window.__game.enterBase);
  const noCard = () => p.waitForFunction(() => !window.__game.cardOn || !window.__game.cardOn(), null, { timeout: 600000 }).catch(() => null);
  const waitGame = (secs) => p.evaluate((secs) => new Promise((res) => { window.__dtMax = 0.3; let acc = 0, last = performance.now(), n = 0; const f = (now) => { acc += Math.min(0.3, (now - last) / 1000); last = now; if (acc >= secs || ++n > 400) res(n); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), secs);
  const census = (label) => p.evaluate((label) => { const g = window.__game; let s = g.cam; while (s.parent) s = s.parent; if (s === g.cam && g.world && g.world.g) { s = g.world.g; while (s.parent) s = s.parent; }
    const walk = (o) => { const r = { n: 0, mat: 0, vis: 0, mesh: 0 }; const reach = (q) => { r.n++; if (q.matrixAutoUpdate) r.mat++; for (const c of q.children) if (c.matrixWorldAutoUpdate !== false) reach(c); }; reach(o);
      const vis = (q) => { if (!q.visible) return; r.vis++; if (q.isMesh || q.isSprite || q.isPoints || q.isLine) r.mesh++; for (const c of q.children) vis(c); }; vis(o); return r; };
    const nm = (o) => (o.name || (o.userData && (o.userData.kind || o.userData.part || o.userData.role)) || o.type) + (o.visible ? '' : ' [hidden]') + (o.matrixWorldAutoUpdate === false ? ' [frozen]' : '');
    const all = walk(s), tops = s.children.map((c) => ({ c, r: c.matrixWorldAutoUpdate === false ? { n: 1, mat: 0, vis: 0, mesh: 0, frozen: true } : walk(c) })).sort((a, b) => b.r.n - a.r.n);
    const lines = ['CENSUS ' + label + ': scene nodes reached by the matrix pass ' + all.n + ' (recompose ' + all.mat + '), drawn walk ' + all.vis + ', meshes ' + all.mesh + '; top-level pieces ' + s.children.length];
    for (const { c, r } of tops.slice(0, 14)) { lines.push('  ' + r.n + ' reached (' + r.mat + ' recompose), ' + r.vis + ' drawn walk, ' + r.mesh + ' meshes | ' + nm(c) + ' children ' + c.children.length);
      if (r.n > 150) for (const { c: c2, r: r2 } of c.children.filter((q) => q.matrixWorldAutoUpdate !== false).map((q) => ({ c: q, r: walk(q) })).sort((a, x) => x.r.n - a.r.n).slice(0, 6)) lines.push('      ' + r2.n + ' reached (' + r2.mat + '), ' + r2.vis + ' drawn walk, ' + r2.mesh + ' meshes | ' + nm(c2) + ' children ' + c2.children.length); }
    return lines.join('\n'); }, label);
  await noCard(); await p.evaluate(() => { const g = window.__game; g.enterBase(); }); await noCard(); await waitGame(3);
  console.log(await census('hub (day 1 base)'));
  await p.evaluate(() => { const g = window.__game; const s = g.save; s.day = 7; s.nights = 5; s.nightsMet = 5; s.trips = 5; s.food = 19; s.essentials = 11; s.essTotal = 25; s.killsTotal = 45; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.noteSeen = true; s.toldCharge = true; s.ringOpen = 3; s.scoutSpot = 2; s.up.slots = 1; s.loadout = ['turbine', 'lance', 'panel', 'mine']; s.met = { walker: true, lurcher: true, ticks: true, hauler: true, stilt: true }; if (g.homeCard) g.homeCard(); else g.reBase(); });
  await noCard(); await waitGame(2);
  await p.evaluate(() => { document.getElementById('selRing').value = '2'; window.__game.startRun(); }); await p.waitForTimeout(300); await noCard(); await waitGame(2);
  console.log(await census('street (day, ring 2)'));
  const hi = await p.evaluate(() => { const r = window.__game.run; const ok = r.houses.filter((h) => h.i !== r.catHouse).sort((a, b) => a.sim.L - b.sim.L || Math.abs(a.n - 4) - Math.abs(b.n - 4)); return ok[0].i; });
  await p.evaluate((i) => { const g = window.__game; g.enterHouse(i); g.sim.player.energy = 62; }, hi); await waitGame(1.5);
  await p.evaluate(() => { window.__dtMax = 0.05; window.__game.nightfall(); }); await p.waitForTimeout(300); await noCard(); await waitGame(20);
  console.log(await census('night in a house (ring 2, 20 s of game time after nightfall)'));
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.log('CENSUS ERROR ' + (e && e.stack || e)); process.exit(1); });
