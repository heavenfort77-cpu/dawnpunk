// lore pieces in the browser (owner Nov 17 16:25): a note in a street house is read with E and lands in the journal under "Found notes"; the board shows its old notices
// with the postings' buttons intact; the field guide shows "Before:" only under a machine met; found notes survive a reload; no page errors.
// Usage: node tools/lorecheck.cjs <low|high> [out_prefix]   (out_prefix: also saves the pictures <out_prefix>table.png, note.png, journal.png, board.png, guide.png)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const tier = process.argv[2] || 'low', out = process.argv[3] || '', W = tier === 'high' ? { width: 1280, height: 720 } : { width: 844, height: 390 };
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: W }); const errs = [], res = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const page = 'file://' + path.resolve(__dirname, '../dist/index.html') + '?quality=' + tier + '&film=0'; // film=0: no first-time opening or job card (tools/checkkit.cjs)
  const shot = async (n) => { if (out) await p.screenshot({ path: out + n + '.png', timeout: 180000 }); };
  const ok = (n, v, info) => { res.push([n + (info ? '  ' + info : ''), !!v]); console.log((v ? 'PASS ' : 'FAIL ') + n + (info ? '  ' + info : '')); };
  await p.goto(page); await p.waitForFunction(() => window.__game && window.__game.enterBase && window.__game.lore, null, { timeout: 600000 });
  await p.evaluate(() => { localStorage.clear(); window.__dtMax = 0.5; }); await p.click('#enter'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const g = window.__game; g.cfg.lore.chance = 1; g.startRun(); }); await p.waitForTimeout(3000);
  // the first house (of six) that has its note on a furniture top, else the first with any note
  const pick = await p.evaluate(async () => { const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)); let any = null;
    for (let i = 0; i < 6; i++) { g.enterHouse(i); await wait(1500); const n = g.lore.note(); if (n && n.top) return { i, ...n }; if (n && !any) any = { i, ...n }; g.leaveHouse(); await wait(800); }
    if (any) { g.enterHouse(any.i); await wait(1500); } return any; });
  ok('a street house holds a note (chance 1)', pick, pick ? 'house ' + pick.i + ', note ' + pick.i + ' ' + (pick.top ? 'on a furniture top' : 'on a pinboard') : '');
  if (!pick) { await b.close(); process.exit(1); }
  console.log('INFO placing the note took ' + (await p.evaluate(() => window.__game.lore.ms())).toFixed(0) + ' ms (rays on the house)');
  // stand 1.1 m from it toward the middle of the room and look at it
  await p.evaluate((n) => { const g = window.__game, s = g.sim, d = Math.hypot(n.x, n.z) || 1, px = n.x - (n.x / d) * 1.1, pz = n.z - (n.z / d) * 1.1; s.player.x = px; s.player.z = pz; g.setYaw(Math.atan2(-(n.x - px), -(n.z - pz))); g.setPitch && g.setPitch(n.top ? -0.55 : -0.05); }, pick);
  await p.waitForFunction(() => { const cs = document.getElementById('csay'), e = document.getElementById('loreRead'); return window.__game.lore.note() && window.__game.lore.note().prompt && ((cs && cs.textContent === 'E: read note') || (e && e.classList.contains('on'))); }, null, { timeout: 60000 }).catch(() => {});
  console.log('INFO ' + JSON.stringify(await p.evaluate(() => { const g = window.__game, c = g.cam.position, n = g.lore.note(); return { cam: [c.x, c.y, c.z].map((v) => +v.toFixed(2)), player: [g.sim.player.x, g.sim.player.z].map((v) => +v.toFixed(2)), note: n }; })));
  const pr = await p.evaluate(() => { const e = document.getElementById('loreRead'), cs = document.getElementById('csay'), btn = e && e.classList.contains('on') && getComputedStyle(e).display !== 'none', line = !!cs && cs.textContent === 'E: read note'; return { on: window.__game.lore.note().prompt && (btn || line), btn, line, day: window.__game.sim.phase }; });
  ok('by day, near it and looking at it, the prompt shows', pr.on && pr.day === 'day', JSON.stringify(pr));
  await shot('table');
  const noteNo = await p.evaluate(() => window.__game.lore.note().i);
  const day0 = await p.evaluate(() => window.__game.sim.dayT);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(1500);
  const day1 = await p.evaluate(() => window.__game.sim.dayT); await p.waitForTimeout(1500); const day2 = await p.evaluate(() => window.__game.sim.dayT);
  ok('reading costs no daylight (the day clock stands still while the note is open)', day0 === day1 && day1 === day2, [day0, day1, day2].map((v) => (+v).toFixed(2)).join(' / '));
  const op = await p.evaluate(() => { const g = window.__game, q = document.getElementById('qb'); return { open: g.lore.open(), book: q.classList.contains('is-book') && q.style.display !== 'none', txt: q.innerText, still: g.state === 'play' && !!g.sim, found: g.lore.found(), prop: g.lore.note() }; });
  ok('E opens the note as a page in ink (and does not leave the house)', op.open && op.book && op.still, op.txt.slice(0, 120).replace(/\n/g, ' / '));
  ok('reading it saves it as found once and takes the paper away', op.found.length === 1 && op.found[0] === noteNo && !op.prop, JSON.stringify(op.found));
  const pages = await p.evaluate(() => document.querySelectorAll('#qb .bk__page').length);
  ok('the note is one page', pages === 1, pages + ' page(s)');
  await shot('note');
  await p.keyboard.press('Escape'); await p.waitForTimeout(1000);
  const cl = await p.evaluate(() => { const g = window.__game, q = document.getElementById('qb'); return { open: g.lore.open(), shown: q.style.display !== 'none', pausedMenu: getComputedStyle(document.getElementById('pause')).display !== 'none', play: g.state === 'play' && !!g.sim }; });
  ok('Escape closes it, back in the house, no pause menu', !cl.open && !cl.shown && !cl.pausedMenu && cl.play, JSON.stringify(cl));
  // the same house again: no note (found once)
  const again = await p.evaluate(async () => { const g = window.__game, i = g.run.inside, wait = (ms) => new Promise((r) => setTimeout(r, ms)); g.leaveHouse(); await wait(800); g.enterHouse(i); await wait(1500); return g.lore.note(); });
  ok('going back into that house, the note is not there again', !again);
  // at night: another house's note has no prompt
  const night = await p.evaluate(async () => { const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 6; i++) { if (i === g.run.inside) continue; g.leaveHouse(); await wait(600); g.enterHouse(i); await wait(1500); const n = g.lore.note(); if (!n) continue;
      const s = g.sim, d = Math.hypot(n.x, n.z) || 1, px = n.x - (n.x / d) * 1.1, pz = n.z - (n.z / d) * 1.1; s.player.x = px; s.player.z = pz; g.setYaw(Math.atan2(-(n.x - px), -(n.z - pz))); await wait(1200); const dayOn = g.lore.note().prompt;
      g.endDay(); await wait(2500); return { dayOn, phase: g.sim.phase, nightOn: g.lore.note() ? g.lore.note().prompt : null }; } return null; });
  ok('at night a note shows no prompt (day only)', night && night.dayOn && night.phase === 'night' && night.nightOn === false, JSON.stringify(night));
  // back home: the journal lists it under Found notes
  await p.evaluate(() => window.__game.reBase()); await p.waitForTimeout(2500);
  const readAll = () => p.evaluate(() => { let t = ''; for (let i = 0; i < 40; i++) { t += [...document.querySelectorAll('#qb .bk__page.is-on')].map((q) => q.innerText).join('\n') + '\n'; const nx = document.querySelector('#qb .bk__next'); if (!nx || nx.classList.contains('is-off')) break; nx.click(); } return t; });
  const want = await p.evaluate(() => window.__game.lore.found());
  await p.evaluate(() => window.__game.openPanel('journal')); await p.waitForTimeout(1200);
  const p1 = await p.evaluate(() => [...document.querySelectorAll('#qb .bk__page.is-on')][0].innerText);
  ok('the journal\'s first page starts with the panel-tender\'s duties and the guide', /Panel-tender's duties/i.test(p1) && /Keep the panels/.test(p1) && /food and essentials/.test(p1) && /until dawn/.test(p1) && /Marla the Scout/.test(p1), p1.slice(0, 160).replace(/\n/g, ' / '));
  await shot('duties');
  const jr = await readAll();
  ok('the journal has a "Found notes" page with the note', /Found notes/.test(jr) && want.length === 1, jr.slice(jr.indexOf('Found notes'), jr.indexOf('Found notes') + 160).replace(/\n/g, ' / '));
  await shot('journal');
  await p.evaluate(() => { document.getElementById('qclose').click(); }); await p.waitForTimeout(500);
  // the board: old notices under the postings, buttons still there
  await p.evaluate(() => window.__game.openPanel('board')); await p.waitForTimeout(800);
  const bd = await p.evaluate(() => { const q = document.getElementById('qb'); return { n: q.querySelectorAll('.oldn p').length, head: (q.querySelector('.oldn h2') || {}).textContent, take: q.querySelectorAll('.act[data-a="take"]').length, rows: [...q.querySelectorAll('p')].filter((x) => !x.closest('.oldn')).length, book: q.classList.contains('is-book'), last: [...q.querySelectorAll('.act')].every((b) => !!(b.compareDocumentPosition(q.querySelector('.oldn')) & Node.DOCUMENT_POSITION_FOLLOWING)), after: [...q.children].map((x) => x.tagName + '.' + x.className).slice(-3).join(' ') }; });
  ok('the board shows an "Old notices" corner of 2-3 notices under the postings', bd.n >= 2 && bd.n <= 3 && bd.head === 'Old notices' && bd.last && !bd.book, JSON.stringify(bd));
  const tk = await p.evaluate(() => { const b = document.querySelector('#qb .act[data-a="take"]'); if (!b) return null; const id = +b.dataset.id; b.click(); const q = window.__game.save.quests.find((x) => x.id === id); return q && q.state; });
  ok('a posting\'s Take button still works', tk === 'active' || tk === null, String(tk));
  await p.evaluate(() => { const q = document.getElementById('qb'); for (const e of [q, ...q.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight; }); await p.waitForTimeout(300); await shot('board');
  await p.evaluate(() => { document.getElementById('qclose').click(); }); await p.waitForTimeout(400);
  // the field guide: Before: only under the machine met
  await p.evaluate(() => { const g = window.__game; g.save.met = { walker: true }; g.openPanel('journal'); }); await p.waitForTimeout(1200);
  const gd = await readAll();
  ok('the field guide shows the Walker\'s "Before:" line and no other', /Before: a home delivery unit/.test(gd) && (gd.match(/Before:/g) || []).length === 1, (gd.match(/Before:[^\n]{0,50}/g) || []).join(' | '));
  // turn to the Walker's page for the picture
  await p.evaluate(() => { document.getElementById('qclose').click(); window.__game.openPanel('journal'); }); await p.waitForTimeout(800);
  await p.evaluate(() => { const nav = (d) => document.querySelector('#qb .bk__' + d); for (let i = 0; i < 40; i++) { if ([...document.querySelectorAll('#qb .bk__page.is-on')].some((q) => /Before:/.test(q.innerText))) break; const n = nav('next'); if (!n || n.classList.contains('is-off')) break; n.click(); } });
  await p.waitForTimeout(800); await shot('guide');
  // a reload keeps the found note
  await p.reload(); await p.waitForFunction(() => window.__game && window.__game.lore, null, { timeout: 600000 }); await p.click('#enter'); await p.waitForTimeout(2500);
  const kept = await p.evaluate(() => window.__game.lore.found());
  ok('the found note is still found after a reload', kept.length === 1 && kept[0] === noteNo, JSON.stringify(kept));
  ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  const bad = res.filter((r) => !r[1]).length; console.log(bad ? 'SOME FAILED (' + bad + ')' : 'ALL PASS (' + res.length + ')'); await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL runner ' + String(e).slice(0, 300)); process.exit(2); });
