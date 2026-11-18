// Pictures for the fresh-player fixes (owner Nov 18). Usage: node tools/freshfixshot.cjs <abs page.html> <high|low> <desk|phone> <out_prefix> <shots>
// shots (comma list, in this order): wake (the first view after the opening, job card closed), dialog (Marla's day-1 first talk), pause (the pause menu), drill (night 1, the shoot step)
// Writes <out_prefix><shot>.png and prints a "wrote" line for each, or "FAIL <shot>" with what was on screen.
const { chromium, devices } = require('playwright');
(async () => {
  const [page, tier, dev, out, list] = process.argv.slice(2); const shots = (list || 'wake').split(','), hi = tier === 'high';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const ctx = await b.newContext(dev === 'phone' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => { window.__dtMax = 0.5; });
  await p.goto('file://' + page + '?quality=' + tier + '&film=1&seed=777', { timeout: 900000 }); await p.waitForFunction(() => window.__game && window.__game.startIntro, null, { timeout: 900000 });
  await p.waitForFunction(() => !window.__gloomGlb || Object.values(window.__gloomGlb).every((s) => s !== 'loading'), null, { timeout: 900000 }).catch(() => {});
  const shot = async (name) => { await p.screenshot({ path: out + name + '.png', timeout: 600000 }); console.log('wrote ' + out + name + '.png'); };
  const key = (code, type) => p.evaluate(([code, type]) => window.dispatchEvent(new KeyboardEvent(type || 'keydown', { code, bubbles: true })), [code, type]);
  const press = async (code) => { await key(code, 'keydown'); await key(code, 'keyup'); };
  await p.evaluate(() => { localStorage.clear(); document.getElementById('watch').click(); }); await p.waitForTimeout(hi ? 8000 : 3000);
  await p.evaluate(() => document.getElementById('cineSkip').click()); await p.waitForFunction(() => window.__game.state === 'base', null, { timeout: 600000 });
  await p.waitForTimeout(hi ? 25000 : 5000); if (await p.evaluate(() => !!document.getElementById('jobCard'))) { await press('Enter'); await p.waitForTimeout(hi ? 6000 : 2000); } // Enter in the base talks once the card has closed by itself
  for (const s of shots) {
    if (s === 'wake') { await shot('wake'); continue; }
    if (s === 'dialog') { if (dev !== 'phone') { await p.mouse.click(640, 430); await p.waitForTimeout(hi ? 4000 : 1200); } await press('KeyE'); await p.waitForTimeout(hi ? 6000 : 1500);
      if ((await p.evaluate(() => getComputedStyle(document.getElementById('scout')).display)) !== 'flex') console.log('FAIL dialog: not open'); await shot('dialog'); await press('Escape'); await p.waitForTimeout(hi ? 4000 : 1000); continue; }
    if (s === 'pause') { await press('KeyP'); await p.waitForTimeout(hi ? 5000 : 1200); await shot('pause'); await press('Escape'); await p.waitForTimeout(hi ? 4000 : 1000); continue; }
    if (s === 'drill') {
      await p.evaluate(() => { const g = window.__game; g.save.nights = 0; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await p.waitForTimeout(hi ? 20000 : 3000);
      await p.evaluate(() => window.__game.endDay()); await p.waitForFunction(() => { const g = window.__game, d = g.drillInfo(); return d && d.step === 'shoot' && g.sim.gloom.length > 0; }, null, { timeout: 600000 }).catch(() => {});
      await p.waitForFunction(() => window.__drillMark && window.__drillMark.ring, null, { timeout: hi ? 240000 : 60000 }).catch(() => {}); await p.waitForTimeout(hi ? 3000 : 1000);
      const m = await p.evaluate(() => JSON.stringify([window.__drillMark, window.__game.drillFrom(), document.getElementById('marla').textContent, document.getElementById('dsub').textContent]));
      console.log('INFO drill ' + m); if (!/"ring":true/.test(m)) console.log('FAIL drill: no ring on screen ' + m); await shot('drill'); continue; }
    console.log('FAIL unknown shot ' + s);
  }
  if (errs.length) console.log('FAIL page errors: ' + errs.slice(0, 2).join(' | '));
  await b.close();
})();
