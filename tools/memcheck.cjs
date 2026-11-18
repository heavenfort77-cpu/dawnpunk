// Memory per step for ONE game window: sum of resident memory of the browser's own processes (in this software-rendered test the graphics memory sits in RAM too). Usage: node tools/memcheck.cjs <high|low>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
const tree = (pid) => { const out = execSync('ps -eo pid=,ppid=,rss=').toString().trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number)); const kids = new Set([pid]); let grew = true; while (grew) { grew = false; for (const [p, pp] of out) if (kids.has(pp) && !kids.has(p)) { kids.add(p); grew = true; } } let sum = 0, big = 0; for (const [p, , r] of out) if (kids.has(p)) { sum += r; big = Math.max(big, r); } return [Math.round(sum / 1024), Math.round(big / 1024)]; };
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const pid = process.pid; const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const at = async (l, f, w) => { await f(); await p.waitForTimeout(w); const [s, m] = tree(pid); console.log(l.padEnd(26), 'all processes', s, 'MB   largest', m, 'MB'); };
  await at('page loaded', () => p.goto('file://' + __dirname + '/../dist/index_single.html?seed=777&quality=' + process.argv[2], { timeout: 180000 }).then(() => p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 180000 })), 2000);
  await at('base (Marla in view)', () => p.evaluate(() => { const g = window.__game; g.enterBase(); }), 9000);
  if (process.argv[3] === 'lock') { await p.mouse.click(640, 300); for (let k = 1; k <= 12; k++) { await p.waitForTimeout(2500); const [sm, mx] = tree(pid); console.log('pointer held', String(k * 2.5).padStart(4), 's: all', sm, 'MB, largest', mx, 'MB'); } await at('pointer released 10 s', () => p.evaluate(() => document.exitPointerLock()), 10000); }
  await at('street run', () => p.evaluate(() => { document.getElementById('selRing').value = '0'; window.__game.startRun(0); }), 9000);
  await at('inside a house', () => p.evaluate(() => window.__game.enterHouse(0)), 6000);
  await at('night', () => p.evaluate(() => window.__game.endDay()), 8000);
  await b.close(); })();
