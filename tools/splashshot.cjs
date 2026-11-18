// Start-flow pictures and load times (owner Nov 17 23:33 / 23:36). Usage: node tools/splashshot.cjs <abs page.html> <outPrefix> [views] [--dry]
// views: logoD (V logo mid-fade), titleD (title card), loadD (loading near 60%), readyD (begin button), loadP / readyP (Pixel 7 sideways), timeD / timeP (load time only:
// milliseconds from navigation to the begin button, desktop = high tier, phone = low tier; software renderer, not a real GPU). The splash phases are forced on with &splash=1.
const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const args = process.argv.slice(2).filter((a) => a !== '--dry'), [page, out, views = 'logoD,titleD,loadD,readyD,loadP,readyP,timeD,timeP'] = args, list = views.split(',');
  const known = ['logoD', 'titleD', 'loadD', 'readyD', 'loadP', 'readyP', 'timeD', 'timeP'], bad = list.filter((v) => !known.includes(v));
  if (!page || !fs.existsSync(page) || !out || bad.length) { console.error('ARG ERROR page ' + page + ' unknown views ' + bad.join(',')); process.exit(2); }
  if (process.argv.includes('--dry')) { console.log('DRY OK ' + list.join(',')); process.exit(0); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const v of list) {
    const phone = /P$/.test(v), tier = v === 'timeD' ? 'high' : 'low';
    const ctx = phone ? await b.newContext({ ...devices['Pixel 7 landscape'] }) : await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('file://' + page + '?quality=' + tier + '&splash=1', { timeout: 300000, waitUntil: 'commit' });
    const phase = (want, ms) => p.waitForFunction((w) => window.__splash && window.__splash.phase === w, want, { timeout: ms, polling: 50 });
    const shot = async () => { await p.screenshot({ path: out + '_' + v + '.png', timeout: 300000 }); const s = await p.evaluate(() => window.__splash); console.log('wrote', out + '_' + v + '.png', 'phase ' + (s && s.phase) + ' ' + Math.round(100 * ((s && s.frac) || 0)) + '%'); };
    if (v === 'logoD') { await phase('logo', 120000); await p.waitForTimeout(700); await shot(); }
    if (v === 'titleD') { await phase('title', 120000); await p.waitForTimeout(1200); await shot(); }
    if (v === 'loadD' || v === 'loadP') { await phase('load', 180000).catch(() => {}); await p.waitForFunction(() => window.__splash && (window.__splash.frac >= 0.55 || window.__splash.phase === 'ready'), null, { timeout: 180000, polling: 30 }).catch(() => {}); await shot(); }
    if (v === 'readyD' || v === 'readyP') { await phase('ready', 300000); await p.waitForTimeout(800); await shot(); }
    if (v === 'timeD' || v === 'timeP') { await p.waitForFunction(() => window.__loadMs, null, { timeout: 600000, polling: 200 }); const s = await p.evaluate(() => window.__splash); console.log('LOADTIME ' + v + ' (' + tier + ' tier): ' + s.loadMs + ' ms from navigation to the begin button; stages ' + JSON.stringify(s.stages)); }
    console.log(v, errs.length ? 'PAGE ERRORS ' + errs.slice(0, 3).join(' | ') : 'NO ERRORS'); await ctx.close();
  }
  await b.close();
})();
