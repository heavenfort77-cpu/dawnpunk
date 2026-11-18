// THE BECKONER turn smoke test (tools/bosssmoke.cjs): cheap: the phone page loads and the game object exists (first Chrome job of a boss turn)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + path.resolve('/home/claude/solard-g/dist/index.html') + '?quality=low'); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 120000 });
  console.log(errs.length ? 'SMOKE FAIL ' + errs[0] : 'SMOKE PASS'); await b.close(); process.exit(errs.length ? 1 : 0); })();
