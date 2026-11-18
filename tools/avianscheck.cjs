// The hatchery (owner Nov 17): Marla's one hatchery line on the first visit; a day passes and the hens have laid; you walk to the nest boxes and collect the eggs; E at the incubator
// puts one in and its panel shows it; two days later a chick walks with a hen; two more and it is a hen; at evening the birds go to roost; a running player sends them off.
// Usage: node tools/avianscheck.cjs <low|high> [page]   (PASS/FAIL lines only)
const { chromium } = require('playwright'); const QL = process.argv[2] || 'low', PAGE = process.argv[3] || (__dirname + '/../dist/index_single.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=3072'] }); const errs = [], out = [];
  const p = await b.newPage({ viewport: QL === 'low' ? { width: 915, height: 412 } : { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(String(e)));
  // the software renderer draws a frame every 0.3 s (phone tier) to 2 s (desktop tier); the test-only cap keeps each step short
  await p.addInitScript(() => { window.__dtMax = 0.1; });
  await p.goto('file://' + PAGE + '?quality=' + QL, { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 240000 });
  await p.evaluate(() => localStorage.clear()); await p.click('#enter').catch(() => {}); await p.waitForFunction(() => window.__game.save && window.__game.basePos, null, { timeout: 120000 });
  const g = (f, a) => p.evaluate(f, a); const ok = (t, v) => { out.push([t, !!v]); console.log((v ? 'PASS ' : 'FAIL ') + t); }; const slow = QL === 'low' ? 1 : 5;
  const frames = async (n) => { for (let i = 0; i < n; i++) await g(() => new Promise((r) => requestAnimationFrame(() => r()))); };
  const at = (x, z, yaw) => g(([x, z, yaw]) => { const G = window.__game; G.setBase(x, z); G.setYaw(yaw); G.setPitch(0); }, [x, z, yaw]);
  const walk = async (done, ms) => { await p.keyboard.down('w'); const t0 = Date.now(); for (;;) { const q = await g(() => window.__game.basePos()); if (done(q) || Date.now() - t0 > ms) break; await p.waitForTimeout(200); } await p.keyboard.up('w'); await frames(2); return g(() => window.__game.basePos()); };
  const panel = () => g(() => { const q = document.getElementById('qb'); return { open: q.style.display === 'flex', text: q.innerText }; });
  const close = () => g(() => { const c = document.getElementById('qclose'); if (c) c.click(); });
  const day = (n) => g((n) => { const G = window.__game; for (let i = 0; i < n; i++) { G.save.day++; G.B.flockDay(G.cfg, G.save, true); } G.reBase(); }, n);
  const L = await g(() => window.__game.bview.peek().avians && window.__game.bview.peek().avians.layout);
  ok('the hatchery is built (centre ' + (L ? L.cx + ', ' + L.cz : 'none') + ')', !!L);
  let line = ''; for (let i = 0; i < 40 && !/Hatchery/.test(line); i++) { await p.waitForTimeout(250 * slow); line = await g(() => document.getElementById('marla').textContent); }
  ok('Marla\'s hatchery line on the first visit: "' + line + '"', /Hatchery's by the pond\. Eggs go in the warm dome\. Don't name them\./.test(line));
  const shown0 = await g(() => window.__game.bview.peek().avians.shown), F0 = await g(() => JSON.parse(JSON.stringify(window.__game.save.avians)));
  ok('the flock walks in the run (' + shown0 + ' birds drawn, ' + F0.birds.length + ' in the save)', shown0 >= Math.min(F0.birds.length, QL === 'low' ? 5 : 10) && shown0 > 0);
  await day(1); await p.waitForTimeout(1500 * slow); const coop = await g(() => window.__game.save.avians.coop);
  ok('a day later the hens have laid (' + coop + ' eggs in the coop)', coop === F0.birds.length);
  // walk to the nest boxes from the east, collect
  await at(L.nestOut[0] + 2.6, L.nestOut[1], Math.PI / 2); const pn = await walk((q) => Math.hypot(q.x - L.nestOut[0], q.z - L.nestOut[1]) < 1.0, QL === 'low' ? 30000 : 200000); await frames(3);
  const tc = await g(() => [window.__game.target, document.getElementById('bprompt').textContent]); ok('you walk to the nest boxes (' + pn.x.toFixed(2) + ', ' + pn.z.toFixed(2) + '): "' + tc[1] + '"', tc[0] && tc[0].kind === 'coop' && /collect the eggs \(\d+\)/.test(tc[1]));
  await g(() => window.__game.doUse()); const held = await g(() => [window.__game.save.avians.held, window.__game.save.avians.coop]); ok('E collects every egg (' + held[0] + ' in hand, ' + held[1] + ' left)', held[0] === coop && held[1] === 0);
  // the incubator: one egg in, the panel shows it
  await at(L.inc[0], L.inc[1] - 1.3, Math.PI); await frames(3); const ti = await g(() => [window.__game.target, document.getElementById('bprompt').textContent]);
  ok('at the incubator: "' + ti[1] + '"', ti[0] && ti[0].kind === 'incubator' && /put an egg in the warm dome/.test(ti[1]));
  await g(() => window.__game.doUse()); const pi = await panel(), inc = await g(() => window.__game.save.avians.inc.length);
  ok('E puts an egg in the dome and its panel shows it (' + inc + ' warming)', inc === 1 && pi.open && /Hatchery/.test(pi.text) && /hatches in 2 days/.test(pi.text) && /Eggs in hand: \d+/.test(pi.text)); await close();
  await day(2); await p.waitForTimeout(1500 * slow); const c1 = await g(() => { const A = window.__game.bview.peek().avians, F = window.__game.save.avians; return { chicks: F.chicks.length, drawn: A.birds.filter((b) => b.kind === 'chick').length, birds: F.birds.length }; });
  ok('two days later a chick has hatched and walks with a hen (' + c1.chicks + ' in the save, ' + c1.drawn + ' drawn)', c1.chicks === 1 && c1.drawn === 1);
  await day(2); await p.waitForTimeout(1500 * slow); const c2 = await g(() => ({ chicks: window.__game.save.avians.chicks.length, birds: window.__game.save.avians.birds.length }));
  ok('two days more and it is a hen (' + c2.birds + ' grown, ' + c2.chicks + ' chicks)', c2.chicks === 0 && c2.birds === c1.birds + 1);
  // a running player sends nearby birds off
  const bb = await g(() => window.__game.bview.peek().avians.birds.find((x) => !x.gone && x.kind !== 'chick')); let fled = false;
  for (let k = 0; k < 8 && !fled; k++) { await at(bb.x - 3 + k * 0.6, bb.z - 1.0, 0); await frames(1); fled = await g(() => window.__game.bview.peek().avians.birds.some((x) => x.st === 'flee')); }
  ok('a running player close by sends birds off', fled);
  // evening: they go to roost
  await at(L.cx, L.cz - 3.5, Math.PI); await g(() => window.__game.baseEvening(window.__game.cfg.avians.evening + 5)); let ro = null; for (let i = 0; i < (QL === 'low' ? 120 : 12); i++) { await frames(2); ro = await g(() => { const A = window.__game.bview.peek().avians; return { roost: A.birds.filter((b) => b.st === 'roost').length, gone: A.birds.filter((b) => b.gone).length, n: A.birds.length }; }); if (ro.gone > 0 && ro.roost + ro.gone >= ro.n) break; }
  // (desktop: the software renderer draws a frame every 2 s, so only the start of the walk in is waited for there; the phone run waits until birds are inside)
  ok('at evening the birds head for the coop' + (QL === 'low' ? ' and go in' : '') + ' (' + ro.roost + ' on the way, ' + ro.gone + ' inside, of ' + ro.n + ')', ro.roost + ro.gone >= ro.n && (QL !== 'low' || ro.gone > 0));
  ok('no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), errs.length === 0);
  const all = out.every(([, v]) => v); console.log(all ? 'ALL PASS' : 'SOME FAILED'); await b.close();
})();
