const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 900, height: 420 } });
  await p.goto('file:///home/claude/solard-g/dist/index.html'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); window.__game.startRun(0); document.getElementById('hud').style.visibility = 'hidden'; }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.__game; g.gloomSample('warden', 14, -1.2, Math.PI, 4.2); g.gloomSample('stilt', 17.5, -1.2, Math.PI, 6); g.gloomSample('ticks', 11, 0.5, Math.PI, 0.5); g.gloomSample('hauler', 20.5, -1, Math.PI, 2, true); g.setTown(15.5, 5.2); g.setYaw(0); }); await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/f6d1c949-d179-5fcf-9724-bf18824fc0f0/scratchpad/gl_warden.png' }); await b.close(); })();
