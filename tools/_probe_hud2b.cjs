// temporary probe (HUD2 work): frame time at night with the HUD shown, with the HUD2 frame styles switched off, and with the HUD hidden
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  await p.goto('file:///home/claude/solard-g/dist/index.html?quality=low'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '2'; window.__game.startRun(0); }); await p.waitForTimeout(2000);
  await p.evaluate(() => window.__game.nightfall()); await p.waitForTimeout(3000);
  const fr = () => p.evaluate(() => new Promise((res) => { const a = []; let l = performance.now(); const f = () => { const n = performance.now(); a.push(Math.round(n - l)); l = n; if (a.length < 8) requestAnimationFrame(f); else res(a.slice(1)); }; requestAnimationFrame(f); }));
  console.log('hud as is', JSON.stringify(await fr()));
  await p.evaluate(() => { const s = document.createElement('style'); s.id = 'x'; s.textContent = '*{box-shadow:none !important;filter:none !important;text-shadow:none !important;background-image:none !important}'; document.head.appendChild(s); });
  console.log('no shadows', JSON.stringify(await fr()));
  await p.evaluate(() => { document.getElementById('x').remove(); document.getElementById('hud').style.visibility = 'hidden'; document.getElementById('bMus').style.display = 'none'; });
  console.log('hud hidden', JSON.stringify(await fr()));
  await b.close(); })();
