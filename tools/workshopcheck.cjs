// The rooms you walk into (owner Nov 16 23:32 / 23:35): outside the workshop the panel does not open and the prompt says to go in; you walk in through the doorway (not through a wall);
// talking to Oko inside opens the upgrade panel with her greeting; Marla tells you once where the workshop is after your first night; you walk into Marla's house, her journal shows
// 1 line and an unread ribbon, the ribbon goes once read, and after 2 more trips it shows 3 lines. Usage: node tools/workshopcheck.cjs <low|high> [page]   (PASS/FAIL lines only)
const { chromium } = require('playwright'); const QL = process.argv[2] || 'low', PAGE = process.argv[3] || (__dirname + '/../dist/index_single.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=3072'] }); const errs = [], out = [];
  const p = await b.newPage({ viewport: QL === 'low' ? { width: 915, height: 412 } : { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(String(e)));
  // the software renderer draws a frame every 0.3 s (phone tier) to 2 s (desktop tier); the test-only cap keeps each step of the walk short so the walls are met as in play
  await p.addInitScript(() => { window.__dtMax = 0.1; });
  await p.goto('file://' + PAGE + '?quality=' + QL, { timeout: 240000 }); await p.waitForFunction(() => window.__game && window.__game.enterBase, null, { timeout: 240000 });
  await p.evaluate(() => localStorage.clear()); await p.click('#enter').catch(() => {}); await p.waitForFunction(() => window.__game.save && window.__game.basePos, null, { timeout: 120000 }); await p.waitForTimeout(QL === 'low' ? 3000 : 10000);
  const g = (f, a) => p.evaluate(f, a); const ok = (t, v) => { out.push([t, !!v]); console.log((v ? 'PASS ' : 'FAIL ') + t); };
  // this check is about the workshop and Marla's house: the hatchery's own one-time line (tools/avianscheck.cjs) is marked as already said
  await g(() => { window.__game.save.toldHatchery = 1; });
  const at = (x, z, yaw) => g(([x, z, yaw]) => { const G = window.__game; G.setBase(x, z); G.setYaw(yaw); G.setPitch(0); }, [x, z, yaw]);
  const frames = async (n) => { for (let i = 0; i < n; i++) await g(() => new Promise((r) => requestAnimationFrame(() => r()))); };
  // walk forward (W held) until done(pos) or the time runs out; returns the last position
  const walk = async (done, ms) => { await p.keyboard.down('w'); const t0 = Date.now(); let pos; for (;;) { pos = await g(() => window.__game.basePos()); if (done(pos) || Date.now() - t0 > ms) break; await p.waitForTimeout(200); } await p.keyboard.up('w'); await frames(2); return g(() => window.__game.basePos()); };
  const panel = () => g(() => { const q = document.getElementById('qb'); return { open: q.style.display === 'flex', text: q.innerText }; });
  const close = () => g(() => { const c = document.getElementById('qclose'); if (c) c.click(); });
  const R = await g(() => { const r = window.__game.bview.rooms; return { WS: r.WS && { x: r.WS.x, z: r.WS.z, ry: r.WS.ry, hw: r.WS.w / 2, hd: r.WS.d / 2 }, MH: r.MH && { x: r.MH.x, z: r.MH.z } }; });
  // the workshop's own frame (door at +z; turned to face the plaza since Nov 17): room -> world and back; a yaw that looks along the room's -z (into the door from outside)
  const W = R.WS, c = Math.cos(W.ry), sn = Math.sin(W.ry), L2W = (lx, lz) => [W.x + lx * c + lz * sn, W.z - lx * sn + lz * c], W2L = (x, z) => [(x - W.x) * c - (z - W.z) * sn, (x - W.x) * sn + (z - W.z) * c];
  ok('both rooms are switched on (workshop at ' + JSON.stringify(R.WS) + ', Marla\'s house at ' + JSON.stringify(R.MH) + ')', R.WS && R.MH);
  // ---- outside the workshop door: the prompt says to go in; USE opens nothing
  await at(...L2W(0, W.hd + 2.2), W.ry); await frames(3); const pr = await g(() => document.getElementById('bprompt').textContent), tg = await g(() => window.__game.target);
  await g(() => window.__game.doUse()); const p0 = await panel();
  ok('outside the door the prompt says to go in ("' + pr + '") and USE opens no panel', /Workshop: go inside/.test(pr) && !(tg && tg.key === 'workshop') && !p0.open);
  // ---- behind the back wall: Oko cannot be talked to through it
  await at(...L2W(0, -W.hd - 0.6), W.ry + Math.PI); await frames(3); const tb = await g(() => window.__game.target);
  ok('behind the back wall Oko cannot be reached (target ' + JSON.stringify(tb) + ')', !(tb && tb.kind === 'npc' && tb.id === 'oko'));
  // ---- a side wall stops you
  await at(...L2W(-W.hw - 1.1, 0), W.ry - Math.PI / 2); const pw = await walk((q) => W2L(q.x, q.z)[0] > -W.hw + 0.5, QL === 'low' ? 12000 : 60000); const pwl = W2L(pw.x, pw.z)[0];
  ok('walking into the side wall stops you outside (room x ' + pwl.toFixed(2) + ', wall face at ' + (-W.hw).toFixed(2) + ')', pwl < -W.hw - 0.3 + 0.01);
  // ---- through the doorway
  await at(...L2W(0, W.hd + 1.4), W.ry); const pin = await walk((q) => W2L(q.x, q.z)[1] < 0.7, QL === 'low' ? 40000 : 240000); const pil = W2L(pin.x, pin.z);
  ok('you walk in through the doorway (room frame now ' + pil[0].toFixed(2) + ', ' + pil[1].toFixed(2) + '; the door faces ' + (Math.abs(Math.cos(W.ry) + 1) < 0.01 ? 'the plaza, -z' : 'ry ' + W.ry.toFixed(2)) + ')', pil[1] < 1.6 && pil[1] > -1.0 && Math.abs(pil[0]) < 2.1);
  // ---- Oko: talk = the upgrade panel with her greeting first
  await frames(3); const to = await g(() => window.__game.target), op = await g(() => document.getElementById('bprompt').textContent);
  ok('inside, the target is Oko ("' + op + '")', to && to.kind === 'npc' && to.id === 'oko');
  await g(() => window.__game.doUse()); const pk = await panel(); const greet = await g(() => window.__game.B.NPCS.oko.greet);
  ok('talking to Oko opens the workshop panel: her greeting, then the upgrades', pk.open && /Workshop/.test(pk.text) && /Oko/.test(pk.text) && greet.some((l) => pk.text.includes(l)) && /Start: \d+ essentials|Researching/.test(pk.text) && pk.text.indexOf('Oko') < pk.text.indexOf('Essentials'));
  const qk = await g(() => { const s = window.__game.save, q = window.__game.B.npcQuestOf(s, 'oko'); return q && q.state; });
  ok('Oko\'s panel has no quest step: no Take, Accept or Claim button; her posting (' + qk + ') is on the quest board', !/Accept|Claim|Take/.test(pk.text) && (!qk || /board by the Workshop/.test(pk.text)));
  await close(); const okoAt = await g(() => { const o = window.__game.bview.peek().npcG.oko.p.position; return [o.x, o.y, o.z]; });
  const okoL = W2L(okoAt[0], okoAt[2]); ok('Oko stands behind the bench on the room floor (room frame ' + okoL.map((v) => v.toFixed(2)).join(', ') + ', height ' + okoAt[1].toFixed(2) + ')', Math.abs(okoL[0]) < 0.3 && Math.abs(okoL[1] + 1.25) < 0.3 && okoAt[1] > 0.01);
  // ---- Marla's line: once, on the first base visit after a night
  const tip0 = await g(() => window.__game.wsTip());
  ok('no workshop line before the first night (timer ' + tip0 + ')', tip0 === 0);
  await g(() => { const G = window.__game; G.save.nights = 1; G.save.trips = 1; G.reBase(); }); let line = '';
  for (let i = 0; i < 40 && !/Workshop/.test(line); i++) { await p.waitForTimeout(250); line = await g(() => document.getElementById('marla').textContent); }
  const told = await g(() => window.__game.save.toldWorkshop);
  ok('after the first night Marla says where the workshop is: "' + line + '" (' + line.length + ' chars)', /Workshop's (ahead|behind you|on your left|on your right)\. Oko upgrades devices/.test(line) && told === await g(() => window.__game.save.day));
  await g(() => { const G = window.__game; document.getElementById('marla').textContent = ''; G.reBase(); }); await p.waitForTimeout(QL === 'low' ? 3000 : 6000); const again = await g(() => [window.__game.wsTip(), document.getElementById('marla').textContent]);
  ok('only once: coming back again, no line (timer ' + again[0] + ', line "' + again[1] + '")', again[0] === 0 && !/Workshop's/.test(again[1]));
  await g(() => { const G = window.__game; G.save.trips = 0; G.save.mjRead = 0; G.reBase(); }); await p.waitForTimeout(QL === 'low' ? 2000 : 6000);
  // ---- Marla's house: walk in, read the journal
  await at(R.MH.x + 4.2, R.MH.z, Math.PI / 2); const pm = await walk((q) => q.x < R.MH.x + 0.7, QL === 'low' ? 40000 : 240000);
  ok('you walk into Marla\'s house through her door (now at ' + pm.x.toFixed(2) + ', ' + pm.z.toFixed(2) + ')', pm.x < R.MH.x + 1.5 && pm.x > R.MH.x - 1.6 && Math.abs(pm.z - R.MH.z) < 1.9);
  await at(R.MH.x - 0.3, R.MH.z - 0.4, Math.PI / 2 + 0.7); await frames(3); const jt = await g(() => [window.__game.target, document.getElementById('bprompt').textContent, window.__game.bview.peek().journal]);
  ok('by her desk the target is her journal ("' + jt[1] + '"), with the unread ribbon and glow', jt[0] && jt[0].kind === 'mjournal' && jt[2].ribbon && jt[2].glow);
  await g(() => window.__game.doUse()); const j1 = await panel(); const n1 = (j1.text.match(/(First day|Trip \d+)\./g) || []).length;
  ok('her journal opens: "Marla\'s journal" (private) with 1 line (' + n1 + ')', j1.open && /Marla's journal/.test(j1.text) && /private/.test(j1.text) && n1 === 1 && /First day\.\s+New panel-tender\. Potts\./.test(j1.text));
  await close(); await frames(2); const rb = await g(() => window.__game.bview.peek().journal);
  ok('once read, the ribbon and glow are gone', !rb.ribbon && !rb.glow);
  await g(() => { const G = window.__game; G.save.trips += 2; G.reBase(); }); await p.waitForTimeout(QL === 'low' ? 2500 : 8000);
  await at(R.MH.x - 0.3, R.MH.z - 0.4, Math.PI / 2 + 0.7); await frames(3); const rb2 = await g(() => window.__game.bview.peek().journal); await g(() => window.__game.doUse()); const j3 = await panel(); const n3 = (j3.text.match(/(First day|Trip \d+)\./g) || []).length;
  ok('after 2 more trips: the ribbon is back and the journal shows 3 lines (' + n3 + ')', rb2.ribbon && n3 === 3 && /Trip 2\.\s+He waved from the panels/.test(j3.text));
  await close();
  ok('no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''), errs.length === 0);
  const all = out.every(([, v]) => v); console.log(all ? 'ALL PASS' : 'SOME FAILED'); await b.close();
})();
