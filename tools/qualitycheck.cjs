// CI Nov 18: every wait in a test page may take up to 240 s (the 30 s default timed out loading the page on a GitHub runner, as it did here before).
// Graphics tier checks (CONFIG.quality, src/quality.js). Usage: node tools/qualitycheck.cjs
// 1 the tier follows the primary pointer: fine = high, coarse = low, and touch points alone do not make a laptop a phone; 2 ?quality= and the saved choice override it (address first);
// 3 the pause-menu button switches and keeps the choice; 4 high really uses the 1024 px textures, full-size relief, 2048 shadow maps, 3 screen lights and pixel ratio 1.25 (LAG FIX Nov 19; were 4096, 6 and 2), low keeps the phone set;
// 5 if the high-tier files cannot be loaded, high falls back to the packed 512 px textures without an error. dist/ is served over local http so the files beside index.html really load.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.join(__dirname, '..', 'dist'), TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const URL0 = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const out = [], errs = [];
  const open = async (opt, q, init) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, ...opt }); if (init) await ctx.addInitScript(init); ctx.setDefaultTimeout(240000); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    if (opt.block) await p.route('**/tex/**', (r) => r.abort()); await p.goto(URL0 + (q || '')); await p.waitForFunction(() => window.__game && window.__game.quality); return { ctx, p }; };
  const tierOf = (p) => p.evaluate(() => ({ ...window.__game.quality(), coarse: matchMedia('(pointer: coarse)').matches }));
  const street = async (p) => { await p.evaluate(() => { window.__game.enterBase(); });
    // (Nov 21) waits on the condition, not on 1.5 wall-clock seconds: the sharper picture files are all in (or none are asked for) and a few frames have been drawn since
    await p.waitForTimeout(1500); await p.waitForFunction(() => { const q = window.__game.quality(); return !q.hi || !q.hi.asked || q.hi.ok >= q.hi.asked; }, null, { timeout: 180000 }).catch(() => {}); await p.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n >= 5 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const base = await p.evaluate(() => window.__game.quality());
    await p.evaluate(() => { document.getElementById('selRing').value = '1'; window.__game.startRun(0); }); await p.waitForTimeout(1500);
    for (let k = 0; k < 40; k++) { const h = await p.evaluate(() => window.__game.quality().hi); if (h.ok + h.failed >= h.asked) break; await p.waitForTimeout(500); } await p.waitForTimeout(800); return { base, st: await p.evaluate(() => window.__game.quality()) }; };

  // 1 pointer
  let o = await open({}); let t = await tierOf(o.p); out.push(['fine pointer (mouse, trackpad) -> medium by default (coarse=' + t.coarse + ', tier ' + t.tier + ' by ' + t.by + ')', !t.coarse && t.tier === 'medium' && t.by === 'default']);
  const s1 = await street(o.p); await o.ctx.close();
  o = await open({ isMobile: true, hasTouch: true, viewport: { width: 844, height: 390 } }); t = await tierOf(o.p); out.push(['coarse pointer (phone) -> medium by default too (owner Nov 19: tier by frame time, not by pointer) (coarse=' + t.coarse + ', tier ' + t.tier + ' by ' + t.by + ')', t.coarse && t.tier === 'medium' && t.by === 'default']); await o.ctx.close();
  o = await open({ isMobile: true, hasTouch: true, viewport: { width: 844, height: 390 } }, '?quality=low');
  const s0 = await street(o.p); await o.ctx.close(); o = await open({}, '?quality=high'); const sH = await street(o.p); await o.ctx.close();
  o = await open({}, '', () => { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 10 }); window.ontouchstart = null; }); t = await tierOf(o.p); out.push(['touch laptop (fine pointer, 10 touch points) -> medium (tier ' + t.tier + ')', t.tier === 'medium']); await o.ctx.close();
  // 2 overrides
  o = await open({}, '?quality=low'); t = await tierOf(o.p); out.push(['?quality=low on a laptop -> low (by ' + t.by + ')', t.tier === 'low' && t.by === 'address']); await o.ctx.close();
  o = await open({ isMobile: true, hasTouch: true, viewport: { width: 844, height: 390 } }, '?quality=high'); t = await tierOf(o.p); out.push(['?quality=high on a phone -> ' + t.tier + ' (by ' + t.by + '; high is removed: medium)', t.tier === 'medium' && t.by === 'address']); await o.ctx.close();
  o = await open({}, '', () => { try { localStorage.setItem('dawnpunk.quality', 'low'); } catch (e) { /* none */ } }); t = await tierOf(o.p); out.push(['saved choice low on a laptop -> low (by ' + t.by + ')', t.tier === 'low' && t.by === 'saved']); await o.ctx.close();
  o = await open({}, '?quality=high', () => { try { localStorage.setItem('dawnpunk.quality', 'low'); } catch (e) { /* none */ } }); t = await tierOf(o.p); out.push(['address beats saved choice (?quality=high over saved low -> ' + t.tier + '; high is removed: medium)', t.tier === 'medium']); await o.ctx.close();
  o = await open({}, '', () => { Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('blocked'); } }); }); t = await tierOf(o.p); out.push(['storage blocked: no error, pointer decides (' + t.tier + ')', t.tier === 'medium']); await o.ctx.close();
  // 3 pause-menu button
  // (Nov 21) the button switches medium <-> low (owner rule: default medium, never high; src/main.js GFX_OTHER). The check still asked for high: out of date, brought to the rule
  o = await open({}); await o.p.evaluate(() => { window.__game.enterBase(); document.getElementById('selRing').value = '1'; window.__game.startRun(0); }); await o.p.waitForTimeout(1500); await o.p.keyboard.press('Escape'); await o.p.waitForTimeout(300);
  const lab0 = await o.p.textContent('#bGfx'); await o.p.evaluate(() => document.getElementById('bGfx').click()); const lab1 = await o.p.textContent('#bGfx'); await Promise.all([o.p.waitForNavigation(), o.p.evaluate(() => document.getElementById('bGfx').click())]); await o.p.waitForFunction(() => window.__game && window.__game.quality);
  t = await tierOf(o.p); const kept = await o.p.evaluate(() => { try { return localStorage.getItem('dawnpunk.quality'); } catch (e) { return null; } });
  out.push(['pause menu: "' + lab0 + '" -> "' + lab1 + '" -> reload as ' + t.tier + ', saved ' + kept, lab0.includes('medium') && /Switch to low/.test(lab1) && /Tap again/.test(lab1) && t.tier === 'low' && kept === 'low']);
  await o.p.goto(URL0); await o.p.waitForFunction(() => window.__game && window.__game.quality); t = await tierOf(o.p); out.push(['the choice stays after reopening without ?quality (' + t.tier + ')', t.tier === 'low']); await o.ctx.close();
  // 4 what each tier really uses
  const H = sH.st, M = s1.st, L = s0.st, W = (x) => x.want;
  out.push(['high: wall texture ' + H.wallTex + ' px, wall relief ' + H.wallRelief + ' px, street shadow ' + H.shadow + ', base shadow ' + sH.base.shadow + ', base wall ' + sH.base.wallTex + ' px (files ' + H.hi.ok + '/' + H.hi.asked + ' loaded, ' + H.hi.used + ' textures upgraded)', H.wallTex === 1024 && H.wallRelief === 1024 && H.shadow === 2048 && sH.base.shadow === 2048 && sH.base.wallTex === 1024 && H.hi.ok === H.hi.asked && H.hi.asked > 30]);
  out.push(['high: pixel ratio ' + H.pixelRatio + ' (screen 2), smoothing ' + H.antialias + ', screen lights ' + H.lights + ', cloud layers start ' + H.sky, H.pixelRatio === 1.25 && H.antialias && H.lights === W(H).lights && H.lights <= 3]);
  out.push(['medium (default): pixel ratio ' + M.pixelRatio + ', lights ' + M.lights + ', street shadow ' + M.shadow + ', wall ' + M.wallTex + ' px, contact shading ' + W(M).fx + ' (want ' + JSON.stringify(W(M)) + ')', M.pixelRatio === W(M).pixelRatio && M.pixelRatio <= 1.25 && M.lights === W(M).lights && M.shadow === W(M).shadow && M.shadow <= 2048 && W(M).aniso <= 4 && M.wallTex === 1024]);
  out.push(['low (phone set, unchanged): wall ' + L.wallTex + ' px, relief ' + L.wallRelief + ' px, street shadow ' + L.shadow + ', base shadow ' + s0.base.shadow + ', pixel ratio ' + L.pixelRatio + ', lights ' + L.lights + ', high files asked ' + L.hi.asked, L.wallTex === 512 && L.wallRelief === 256 && L.shadow === 2048 && s0.base.shadow === 2048 && L.pixelRatio === 1.5 && L.lights === 3 && L.hi.asked === 0]);
  // 5 fallback
  o = await open({ block: true }); const sf = await street(o.p); const F = sf.st; out.push(['high with tex/ blocked: falls back to packed ' + F.wallTex + ' px wall, ' + F.wallRelief + ' px relief (' + F.hi.failed + '/' + F.hi.asked + ' failed), shadow still ' + F.shadow, F.wallTex === 512 && F.wallRelief === 256 && F.hi.failed === F.hi.asked && F.shadow === 2048]); await o.ctx.close();
  const tris = await (async () => { const a = await open({}, '?quality=low'), lo = await a.p.evaluate(() => ['walker', 'hauler', 'warden'].map((k) => window.__game.gloomTris(k))); await a.ctx.close(); const c = await open({}, '?quality=high'), hi = await c.p.evaluate(() => ['walker', 'hauler', 'warden'].map((k) => window.__game.gloomTris(k))); await c.ctx.close(); return { lo, hi }; })();
  out.push(['round parts smoother on high (triangles walker/hauler/warden low ' + tris.lo.join('/') + ', high ' + tris.hi.join('/') + ')', tris.hi.every((n, i) => n > tris.lo[i])]);
  out.push(['no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), errs.length === 0]);
  let bad = 0; for (const [n, ok] of out) { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + n); } console.log(bad ? 'QUALITY CHECK FAILED (' + bad + ')' : 'ALL QUALITY CHECKS PASS');
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})();
