// Marla's first-night lines (owner Nov 16): three quick hits give a sarcastic 'streak' line; on desktop with hints on she reminds that H hides them; neither after the first night. PASS/FAIL lines only.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], out = [];
  // the software renderer draws about 3 frames a second, so Marla's 5 s lines last far longer here than in play; the test-only frame time cap lets game time keep up
  await p.addInitScript(() => { window.__dtMax = 0.5; });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=low'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(800);
  await p.evaluate(() => window.__game.startRun(0)); await p.waitForTimeout(1200);
  const h = await p.evaluate(() => { const r = window.__game.run, hh = r.houses[0]; return [hh.doorX, hh.doorZ, hh.row]; }); await p.evaluate(([x, z, row]) => window.__game.setTown(x, z - row * 0.4), h); await p.waitForTimeout(900);
  await p.evaluate(() => window.__game.nightfall()); await p.waitForTimeout(1500);
  const L = await p.evaluate(() => ({ nights: window.__game.save ? (window.__game.save.nights || 0) : -1, phase: window.__game.sim && window.__game.sim.phase }));
  out.push(['first night running (nights done ' + L.nights + ', phase ' + L.phase + ')', L.nights === 0 && L.phase === 'night']);
  let hint = '';
  for (let i = 0; i < 40 && !/\bH\b/.test(hint); i++) { await p.waitForTimeout(500); hint = await p.evaluate(() => { window.__game.marlaNightTips(30); return document.getElementById('marla').textContent; }); }
  out.push(['H reminder on the first night: ' + hint, /\bH\b/.test(hint)]);
  await p.waitForTimeout(6000);
  let st = '';
  for (let i = 0; i < 12 && !/collecting|Bold plan|Allegedly|renting|doorstop/.test(st); i++) { st = await p.evaluate(() => { const g = window.__game; g.marlaStreak(); g.marlaStreak(); g.marlaStreak(); return document.getElementById('marla').textContent; }); if (!/collecting|Bold plan|Allegedly|renting|doorstop/.test(st)) await p.waitForTimeout(1000); }
  out.push(['three quick hits give a sarcastic line: ' + st, /collecting|Bold plan|Allegedly|renting|doorstop/.test(st)]);
  await p.evaluate(() => { window.__game.save.nights = 1; document.getElementById('marla').textContent = ''; }); await p.waitForTimeout(25000);
  await p.evaluate(() => { const g = window.__game; g.marlaStreak(); g.marlaStreak(); g.marlaStreak(); g.marlaNightTips(60); });
  const st2 = await p.evaluate(() => document.getElementById('marla').textContent);
  out.push(['nothing of this after the first night (line now: "' + st2 + '")', !/collecting|Bold plan|Allegedly|renting|doorstop|\bH\b/.test(st2)]);
  out.push(['no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), errs.length === 0]);
  let ok = true; for (const [t, v] of out) { if (!v) ok = false; console.log((v ? 'PASS ' : 'FAIL ') + t); } console.log(ok ? 'ALL PASS' : 'SOME FAILED'); await b.close();
})();
