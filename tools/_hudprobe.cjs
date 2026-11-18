// HUD wording checks: no abbreviations, device buttons say cost and count, the aimed machine is named at night
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 844, height: 390 } }); await p.addInitScript(() => { window.__dtMax = 1.5; }); const errs = [], out = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/../dist/index.html?quality=high'); await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(2500); const mu = await p.evaluate(() => [...document.querySelectorAll('audio')].length + '|' + (window.__game.music ? JSON.stringify(window.__game.music()) : 'no hook')); out.push(['music: the base track is playing after Enter: ' + mu, /"cur":"base"/.test(mu) && /"playing":\["base"\]/.test(mu)]);
  await p.evaluate(() => { window.__game.enterBase(); }); await p.waitForTimeout(1200);
  const bstat = await p.evaluate(() => document.getElementById('bstat').textContent); out.push(['base people line is plain words, no codes: ' + bstat, /People \d/.test(bstat) && !/\(H\d/.test(bstat)]);
  const bq = await p.evaluate(() => document.getElementById('bq').textContent); await p.click('#bq'); await p.waitForTimeout(150); const bq2 = await p.evaluate(() => document.getElementById('bq').textContent); out.push(['day-1 quest box is 2 lines collapsed (' + bq.split('\n').length + ') and tapping it shows the cat rumour', bq.split('\n').length <= 2 && /paw/.test(bq2)]); if (process.argv[2]) await p.screenshot({ path: process.argv[2] + '_base.png' });
  await p.evaluate(() => { document.getElementById('selRing').value = '2'; window.__game.startRun(0); }); await p.waitForTimeout(2000);
  const h = await p.evaluate(() => { const r = window.__game.run, h = r.houses[0]; return [h.doorX, h.doorZ, h.row]; }); await p.evaluate(([x, z, row]) => window.__game.setTown(x, z - row * 0.4), h); await p.waitForTimeout(900);
  const dump = (tag) => p.evaluate((tag) => { const g = window.__game, s = g.sim, $ = (i) => document.getElementById(i); return tag + ' state=' + g.state + ' sim=' + !!s + ' hp=' + (s && s.player.hp) + ' night=' + (s && s.night) + ' dayT=' + (s && s.dayT && s.dayT.toFixed(1)) + ' b2=' + JSON.stringify($('b2').textContent) + ' b2disp=' + getComputedStyle($('b2')).display + ' count=' + JSON.stringify($('count').textContent) + ' msg=' + JSON.stringify($('msg').textContent) + ' hudvis=' + getComputedStyle($('b2').parentElement).display + ' ovs=' + [...document.querySelectorAll('.ov')].filter((o) => getComputedStyle(o).display !== 'none').map((o) => o.id).join(','); }, tag);
  console.log(await dump('inhouse'));
  await p.evaluate(() => window.__game.nightfall()); for (let i = 0; i < 4; i++) { await p.waitForTimeout(800); console.log(await dump('night' + i)); }
  await b.close(); })();
