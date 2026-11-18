const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const S = '/tmp/claude-0/-home-claude/f6d1c949-d179-5fcf-9724-bf18824fc0f0/scratchpad/';
  const url = 'file:///home/claude/solard-g/dist/index.html?quality=low';
  let p = await b.newPage({ viewport: { width: 1280, height: 720 } }); await p.goto(url); await p.waitForFunction(() => window.__game && window.__game.enterBase); await p.waitForTimeout(800); await p.screenshot({ path: S + 'm_title.png' });
  await p.click('#enter'); await p.waitForTimeout(2500); await p.evaluate(() => window.__game.startRun(0)); await p.waitForTimeout(3000); await p.screenshot({ path: S + 'm_play_desk.png' }); await p.close();
  const c = await b.newContext({ ...devices['Pixel 7 landscape'] }); p = await c.newPage(); await p.goto(url); await p.waitForFunction(() => window.__game && window.__game.enterBase); await p.tap('#enter'); await p.waitForTimeout(2500); await p.evaluate(() => window.__game.startRun(0)); await p.waitForTimeout(3000); await p.screenshot({ path: S + 'm_play_phone.png' });
  const c2 = await b.newContext({ ...devices['Pixel 7'] }); p = await c2.newPage(); await p.goto(url); await p.waitForTimeout(1500); await p.screenshot({ path: S + 'm_rot.png' }); await b.close(); })();
