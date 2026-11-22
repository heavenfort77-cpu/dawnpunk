// zfightlist (diagnostic, not a check): tools/zfightcheck.cjs printing every view with fighting pixels and the pieces under them (default limit 0)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const D = process.argv[2] || require('path').join(__dirname, '..', 'dist'), QUAL = process.argv[3] || 'low', LIMIT = +(process.env.LIMIT || 0);
const srv = http.createServer((q, r) => { const f = path.join(D, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(b); }); });
// Z-fight check (owner Nov 22: z-fighting in the base): views round the workshop and Marla's house (7, 12 and 18 m out, 8 ways, and 4 inside each) drawn twice
// in the same frame with the clock held, the solid pieces in the usual order and then reversed (src/main.js zfightTest). Two surfaces at the same depth show
// whichever is drawn last, so the pixels that differ are surfaces fighting. A view fails over LIMIT px (default 300 of 640x360; the vault caps on the end walls
// were 1183-8209 px; distant ground edges are under 110). Usage: node tools/zfightcheck.cjs [dist] [quality]
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +(process.env.VW || 640), height: +(process.env.VH || 360) } })).newPage(); p.setDefaultTimeout(900000);
  await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?quality=' + QUAL + '&seed=7&cards=1');
  await p.waitForFunction(() => window.__game && window.__game.enterBase);
  await p.evaluate(() => { const g = window.__game; g.enterBase(); const s = g.save; s.day = 5; s.nights = 3; s.nightsMet = 3; s.trips = 3; s.talkedMarla = true; s.solarDone = true; s.jobCard = true; s.noteSeen = true; s.toldCharge = true; s.ringOpen = 3; s.scoutSpot = 2; });
  await p.waitForFunction(() => !window.__game.cardOn());
  await p.waitForTimeout(3000);
  const r = await p.evaluate((PP) => { const g = window.__game, pk = g.bview.peek(), R = pk.rooms, poses = [], rooms = [];
    for (const k of ['WS', 'MH']) { const w = R[k]; if (!w) continue; const cx = w.x != null ? w.x : (w.x0 + w.x1) / 2, cz = w.z != null ? w.z : (w.z0 + w.z1) / 2; rooms.push(k + ' ' + JSON.stringify(w).slice(0, 120)); for (const d of [7, 12, 18]) for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2, x = cx + Math.sin(t) * d, z = cz + Math.cos(t) * d; poses.push([+x.toFixed(2), 1.6, +z.toFixed(2), t + Math.PI, 0.12]); } }
    for (const k of ['WS', 'MH']) { const w = R[k]; if (!w) continue; for (let a = 0; a < 4; a++) poses.push([w.x + Math.sin(a * 1.57) * 0.6, 1.6, w.z + Math.cos(a * 1.57) * 0.6, a * 1.57, 0.05]); }
    const res = g.zfightTest(PP.length ? PP : poses); return { rooms, all: res.map((q) => q.fighting), res: res.filter((q) => q.fighting > 0).map((q) => q.pose.map((v) => +v.toFixed(1)).join(',') + ' fighting ' + q.fighting + '\n    ' + q.at.join('\n    ')) }; }, JSON.parse(process.env.POSES || '[]'));
  const worst = Math.max(...r.all), over = r.res.filter((t) => +t.split(' fighting ')[1].split('\n')[0] > LIMIT);
  console.log('views ' + r.all.length + ', fighting pixels per view: ' + r.all.join(' '));
  if (over.length) { console.log('FAIL surfaces fight (drawn order decides the colour) in ' + over.length + ' of ' + r.all.length + ' views over ' + LIMIT + ' px (worst ' + worst + ' px):\n  ' + over.join('\n  ')); process.exit(1); }
  console.log('PASS no two surfaces fight over ' + LIMIT + ' px in any of ' + r.all.length + ' views round the workshop and Marla\'s house, inside and out (worst ' + worst + ' px)'); process.exit(0);
  console.log(JSON.stringify(r, null, 1)); await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
