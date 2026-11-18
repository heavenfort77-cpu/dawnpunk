// Marla teaching review (fresh reviewer, Nov 18): a first-time player who does only what the game tells him, on a cleared save, with real controls.
// Logs every line the game shows (Marla's card, messages, prompts, the quest box, cards and panels, the drill's lines) with game time, wall time and the stage,
// plus every voice clip, every action the player takes and every shortcut the script had to take. Small JPEG screenshots at key moments.
// Usage: node tools/marlateach.cjs <desk|phone> <outdir/>     (desk: 1280x720 mouse+keys ?quality=high&film=1; phone: 844x390 touch ?quality=low&film=1)
// Steering stands in for the player reading the map / beam / prompt: the script reads where the target is from the game and walks there with W (or the left thumb),
// turning the view with the mouse (or a right-thumb drag). When straight walking is blocked, it teleports and logs it as a SHORTCUT.
// Game time: window.__dtMax (the game's own hook for slow headless renderers) is 0.25, and the page counts game seconds (__gt) the way the game does.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const MODE = process.argv[2] === 'phone' ? 'phone' : process.argv[2] === 'deskhi' ? 'deskhi' : 'desk', OUT = process.argv[3] || 'mt_' + MODE + '/';
const DESK = MODE !== 'phone', HI = MODE === 'deskhi';
// tier: the third argument overrides it (the desktop HIGH tier draws one frame in about 9 s on a 4-core runner with the software renderer, so the full desktop play runs on low
// with desktop controls, and 'deskhi' visits the key moments on high through the game's hooks, for pictures and lines only)
const TIER = process.argv[4] || (MODE === 'phone' ? 'low' : 'high');
fs.mkdirSync(OUT, { recursive: true });
const PAGE = path.resolve(__dirname, '../dist/index.html') + '?quality=' + TIER + '&film=1';
const SENS = 0.0022, TOUCH_SENS = 0.006;
const T0 = Date.now();
const wall = () => ((Date.now() - T0) / 1000).toFixed(1);
let shotN = 0;
class Phase extends Error { constructor(p) { super('phase ' + p); this.phase = p; } }

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext(DESK ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  p.setDefaultTimeout(600000);
  await p.addInitScript(() => {
    window.__dtMax = 0.25;
    try { localStorage.clear(); } catch (e) { /* none */ }
    const W = window; W.__gt = 0; W.__frames = 0; let lt = null;
    const tick = (now) => { if (lt !== null) W.__gt += Math.min(W.__dtMax || 0.1, (now - lt) / 1000); lt = now; W.__frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    W.__log = []; W.__stage = 'load'; const last = {};
    const vis = (el) => { if (!el) return false; if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const txt = (sel, max = 600) => { const el = document.querySelector(sel); if (!vis(el)) return ''; return (el.innerText || el.textContent || '').trim().replace(/\s*\n\s*/g, ' / ').replace(/\s+/g, ' ').slice(0, max); };
    const SRC = [['marla', '#marla', 1], ['msg', '#msg', 1], ['csay', '#csay', 1], ['bprompt', '#bprompt', 1], ['aim', '#aim', 1], ['mlook', '#mlook', 1], ['dsub', '#dsub', 1], ['dchip', '#dchip', 1], ['hchip', '#hchip', 0],
      ['enNote', '#enNote', 0], ['quest', '#bq', 0], ['bstat', '#bstat', 0], ['jobCard', '#jobCard', 1], ['scout', '#scout', 1], ['kit', '#kit', 1], ['panel', '#qb', 1], ['keys', '#keys', 1], ['end', '#end', 1],
      ['pause', '#pause', 1], ['cineCap', '#cineCap', 1], ['dkeys', '#dkeys', 0], ['bigmap', '#bigmap', 1], ['rot', '#rot', 1], ['hs', '#hs', 0]];
    W.__snapAll = () => { const o = {}; for (const [n, s] of SRC) { const t = txt(s, 2000); if (t) o[n] = t; } o.count = txt('#count'); o.time = txt('#time'); { const g = W.__game, s = g && g.sim; o.game = { state: g && g.state, hp: s ? Math.round(s.player.hp) : null, sun: s ? Math.round(s.player.energy) : null, food: s ? s.food : null, machines: s ? s.gloom.length : null, drill: g && g.drillInfo && g.drillInfo() ? g.drillInfo().step : null, dayLeft: g && g.run ? Math.round(g.run.dayT) : null }; }
      o.buttons = [...document.querySelectorAll('#hud .b, #hud button')].filter(vis).map((x) => x.id + ':' + (x.innerText || '').trim().replace(/\s+/g, ' ') + (x.classList.contains('pulse') ? '[pulse]' : '') + (x.classList.contains('sel') ? '[sel]' : '')); return o; };
    let qStart = null, qStage = '';
    setInterval(() => {
      let guide = false;
      for (const [n, s, g] of SRC) { const t = txt(s); if (t && g) guide = true; if (t !== (last[n] || '')) { last[n] = t; if (t) W.__log.push({ gt: +W.__gt.toFixed(1), wt: +(performance.now() / 1000).toFixed(1), st: W.__stage, k: n, t }); } }
      { const g = W.__game, s = g && g.sim; if (s && g.state === 'play') { const hp = Math.round(s.player.hp); if (last.hp === undefined || Math.abs(hp - last.hp) >= 5 || (hp === 0 && last.hp !== 0)) { const P = s.player; let nd = 1e9, nk = ''; for (const q of s.gloom) { const d = Math.hypot(q.x - P.x, q.z - P.z); if (d < nd) { nd = d; nk = q.kind; } } W.__log.push({ gt: +W.__gt.toFixed(1), wt: +(performance.now() / 1000).toFixed(1), st: W.__stage, k: 'HP', t: 'health ' + (last.hp === undefined ? '' : last.hp + ' -> ') + hp + ' (' + s.phase + '; ' + s.gloom.length + ' machines inside or near, nearest ' + (nd < 1e8 ? nk + ' ' + nd.toFixed(1) + ' m' : 'none') + ')' }); last.hp = hp; } } else last.hp = undefined; }
      { const g = W.__game, s = g && g.sim, F = W.__hpFloor; if (F && s && g.state === 'play' && s.phase === 'night' && !s.done) { const inDrill = !!(g.drillInfo && g.drillInfo()), lim = inDrill ? F.drill : F.night; if (lim && s.player.hp > 0 && s.player.hp < lim) { s.player.hp += 30; W.__hpTops = (W.__hpTops || 0) + 1; W.__log.push({ gt: +W.__gt.toFixed(1), wt: +(performance.now() / 1000).toFixed(1), st: W.__stage, k: 'SHORTCUT', t: 'health under ' + lim + (inDrill ? ' during the lesson' : '') + ': +30 health so the play goes on (top-up ' + W.__hpTops + ')' }); } } }
      const v = W.__marlaVoice; if (v && v.n !== (last.vn || 0)) { last.vn = v.n; W.__log.push({ gt: +W.__gt.toFixed(1), wt: +(performance.now() / 1000).toFixed(1), st: W.__stage, k: 'VOICE', t: v.last + ' (' + v.via + '): ' + v.lastText }); }
      if (!guide && W.__stage !== 'load') { if (qStart === null) { qStart = W.__gt; qStage = W.__stage; } }
      else if (qStart !== null) { const d = W.__gt - qStart; if (d >= 3) W.__log.push({ gt: +W.__gt.toFixed(1), wt: +(performance.now() / 1000).toFixed(1), st: qStage, k: 'QUIET', t: d.toFixed(1) + ' s with no guiding line on screen (from ' + qStart.toFixed(1) + ')' }); qStart = null; }
    }, 200);
  });

  const ev = (fn, a) => p.evaluate(fn, a);
  const gt = () => ev(() => window.__gt);
  const stage = async (n) => { await ev((n) => { window.__stage = n; }, n); console.log(wall() + ' STAGE ' + n); };
  const act = async (t, kind = 'ACT') => { await ev(([k, t]) => window.__log.push({ gt: +window.__gt.toFixed(1), wt: +(performance.now() / 1000).toFixed(1), st: window.__stage, k, t }), [kind, t]); console.log(wall() + ' ' + kind + ' ' + t); };
  const shortcut = (t) => act(t, 'SHORTCUT');
  const note = (t) => act(t, 'NOTE');
  const shot = async (n) => { shotN++; const f = OUT + String(shotN).padStart(2, '0') + '_' + n + '.jpg'; try { await p.screenshot({ path: f, type: 'jpeg', quality: 60, timeout: 120000 }); } catch (e) { console.log('shot fail ' + e); } const o = await ev(() => window.__snapAll()); await act(n + ' ' + JSON.stringify(o), 'SNAP'); };
  // the phase guard: what we expect ('day' = a run by day, 'night', 'base'); a change throws Phase
  let expect = null;
  const phaseNow = () => ev(() => { const g = window.__game; if (!g) return 'load'; if (g.state === 'end') return 'end'; if (g.state === 'base') return 'base'; if (g.state === 'play' && g.sim && g.sim.phase === 'night') return 'night'; if (g.state === 'play') return 'day'; return g.state; });
  const guard = async () => { if (!expect) return; const ph = await phaseNow(); if (ph !== expect) throw new Phase(ph); };
  const waitG = async (sec, cap = 600) => { const g0 = await gt(), w0 = Date.now(); while ((await gt()) - g0 < sec && Date.now() - w0 < cap * 1000) { await guard(); await p.waitForTimeout(150); } };
  const waitFor = async (fn, sec, arg) => { const g0 = await gt(), w0 = Date.now(); for (;;) { const r = await ev(fn, arg); if (r) return r; if ((await gt()) - g0 > sec || Date.now() - w0 > Math.max(sec * 6, 60) * 1000) return null; await p.waitForTimeout(200); } };
  const state = () => ev(() => window.__game && window.__game.state);
  const visible = (sel) => ev((sel) => { const el = document.querySelector(sel); if (!el) return false; if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
  const centre = (sel) => ev((sel) => { const el = document.querySelector(sel); if (!el) return null; let r = el.getBoundingClientRect(); if (el.closest('.ov') && (r.bottom > innerHeight || r.top < 0)) { el.scrollIntoView({ block: 'center' }); r = el.getBoundingClientRect(); } const x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y); const ok = !!hit && (hit === el || el.contains(hit)); return { x, y, w: r.width, h: r.height, cover: ok ? '' : (hit ? (hit.id ? '#' + hit.id : hit.tagName + '.' + hit.className) : 'nothing (off screen)') }; }, sel);
  const text = (sel) => ev((sel) => { const e = document.querySelector(sel); return e ? (e.innerText || e.textContent || '').trim() : ''; }, sel);
  const VW = DESK ? 1280 : 844, VH = DESK ? 720 : 390;

  // ---------- touch (phone): CDP touch points, so the stick and a look drag can be held together
  let cdp = null; const touches = new Map(); let tid = 1;
  if (!DESK) cdp = await ctx.newCDPSession(p);
  const tsend = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [...touches.entries()].map(([id, q]) => ({ x: q.x, y: q.y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  const tdown = async (x, y) => { const id = tid++; touches.set(id, { x, y }); await tsend('touchStart'); return id; };
  const tmove = async (id, x, y) => { touches.set(id, { x, y }); await tsend('touchMove'); };
  const tup = async (id) => { if (!touches.has(id)) return; touches.delete(id); await tsend(touches.size ? 'touchMove' : 'touchEnd'); };
  const tap = async (sel, holdMs = 80) => { const c = await centre(sel); if (!c || !c.w) return false; if (c.cover) await note('tap on ' + sel + ': its centre is covered by ' + c.cover); const id = await tdown(c.x, c.y); await p.waitForTimeout(holdMs); await tup(id); return true; };
  // a free point on a touch zone (checked every time: the buttons move between the base, the street, a house and the night)
  const zonePt = (zone, around) => ev(([zone, W, H, ar]) => { const ok = (x, y) => { const e = document.elementFromPoint(x, y); return e && (e.id === zone || (e.closest && e.closest('#' + zone))); }; if (ar && ok(ar.x, ar.y) && ok(ar.x + 60, ar.y) && ok(ar.x - 60, ar.y)) return ar; const xs = zone === 'zoneR' ? [0.6, 0.55, 0.65, 0.5, 0.7] : [0.18, 0.22, 0.14, 0.26]; const ys = zone === 'zoneR' ? [0.45, 0.35, 0.55, 0.3, 0.65] : [0.62, 0.55, 0.7, 0.48]; for (const fx of xs) for (const fy of ys) { const x = Math.round(fx * W), y = Math.round(fy * H); if (ok(x, y) && ok(x, y - 60) && (zone === 'zoneL' || (ok(x + 60, y) && ok(x - 60, y)))) return { x, y }; } return null; }, [zone, VW, VH, around || null]);
  let stickId = null, stickPt = null, lookPt = null;
  const stickOn = async () => { if (stickId !== null) return; stickPt = await zonePt('zoneL', stickPt); if (!stickPt) { await note('no free spot on the left thumb zone'); return; } stickId = await tdown(stickPt.x, stickPt.y); await p.waitForTimeout(40); await tmove(stickId, stickPt.x, stickPt.y - 55); };
  const stickOff = async () => { if (stickId === null) return; const id = stickId; stickId = null; await tup(id); };
  const touchTurn = async (dyaw, dpitch = 0) => { lookPt = await zonePt('zoneR', lookPt); if (!lookPt) { await note('no free spot on the right thumb zone'); return; } let dx = -dyaw / TOUCH_SENS, dy = -dpitch / TOUCH_SENS; dx = Math.max(-320, Math.min(320, dx)); dy = Math.max(-120, Math.min(120, dy));
    const id = await tdown(lookPt.x, lookPt.y); await tmove(id, lookPt.x + dx, lookPt.y + dy); if (Math.hypot(dx, dy) < 14) await p.waitForTimeout(380); await tup(id); };
  // ---------- desktop look: movement on the held pointer (headless gives no movement on a held pointer, so movementX is sent in the page; the game's own handler turns the view)
  const mouseTurn = (dyaw, dpitch = 0) => ev(([dx, dy]) => { const st = 300; let x = dx, y = dy; while (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) { const sx = Math.max(-st, Math.min(st, x)), sy = Math.max(-st, Math.min(st, y)); dispatchEvent(new MouseEvent('mousemove', { movementX: sx, movementY: sy })); x -= sx; y -= sy; } }, [-dyaw / SENS, -dpitch / SENS]);
  // desktop: the view turns only while the game holds the mouse; panels free it and the game then shows "Click to look with the mouse": do what it says
  let mouseClicks = 0;
  const ensureMouse = async () => { if (await ev(() => window.__game.mouseHeld)) return; const hint = await text('#mlook'); await p.mouse.move(VW / 2, VH / 2); await p.mouse.down(); await p.waitForTimeout(40); await p.mouse.up(); mouseClicks++; await act('clicked the game to take the mouse again (hint on screen: "' + hint + '")'); await p.waitForTimeout(150); };
  const turn = async (dyaw, dpitch = 0) => { if (DESK) { await ensureMouse(); return mouseTurn(dyaw, dpitch); } return touchTurn(dyaw, dpitch); };
  const walkOn = async () => { if (DESK) await p.keyboard.down('KeyW'); else await stickOn(); };
  const walkOff = async () => { if (DESK) await p.keyboard.up('KeyW'); else await stickOff(); };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const pos = () => ev(() => { const g = window.__game; if (!g) return null; if (g.state === 'base') { const b = g.basePos(); return { x: b.x, z: b.z, yaw: g.yaw, st: 'base' }; } if (g.sim && g.state === 'play') return { x: g.sim.player.x, z: g.sim.player.z, yaw: g.yaw, floor: g.sim.player.floor, st: 'house' }; if (g.run && g.state === 'play') return { x: g.run.px, z: g.run.pz, yaw: g.yaw, st: 'street' }; return { st: g.state, yaw: g.yaw }; });
  const teleport = (x, z) => ev(([x, z]) => { const g = window.__game; if (g.state === 'base') g.setBase(x, z); else if (g.sim) { g.sim.player.x = x; g.sim.player.z = z; } else if (g.run) g.setTown(x, z); }, [x, z]);
  const faceTo = async (tx, tz) => { const P = await pos(); if (!P || P.x === undefined) return; const want = Math.atan2(-(tx - P.x), -(tz - P.z)); const d = wrap(want - P.yaw); if (Math.abs(d) > 0.03) await turn(d); };

  // walk to a target; getT() returns {x,z} or null; o.stop() ends it early; blocked twice in a row -> teleport (SHORTCUT)
  async function walkTo(getT, o = {}) {
    const reach = o.reach || 1.0, maxG = o.maxG || 40, label = o.label || 'target'; const g0 = await gt(); let lastP = null, lastG = g0, stuck = 0, walking = false;
    try {
      for (;;) {
        await guard();
        if (o.stop && (await o.stop())) return 'stop';
        const P = await pos(), T = await getT(); if (!P || P.x === undefined || !T) return 'gone';
        const d = Math.hypot(T.x - P.x, T.z - P.z); if (d < reach) return 'ok';
        const want = Math.atan2(-(T.x - P.x), -(T.z - P.z)), dy = wrap(want - P.yaw);
        if (Math.abs(dy) > 0.5) { if (walking) { await walkOff(); walking = false; } await turn(dy); } else { if (Math.abs(dy) > 0.15) await turn(dy); if (!walking) { await walkOn(); walking = true; } }
        await p.waitForTimeout(DESK ? 100 : 120);
        const g = await gt();
        if (g - lastG > 2.0) { if (lastP && Math.hypot(P.x - lastP.x, P.z - lastP.z) < 0.6 && walking) { stuck++; await walkOff(); walking = false;
            if (stuck >= 2) { await shortcut('walking to ' + label + ' was blocked (straight-line steering; ' + d.toFixed(1) + ' m left); teleported next to it'); const k = Math.min(d, reach * 0.6) / d; await teleport(T.x + (P.x - T.x) * k, T.z + (P.z - T.z) * k); stuck = 0; }
            else { if (DESK) { await p.keyboard.down('KeyS'); await waitG(0.4, 20); await p.keyboard.up('KeyS'); const side = Math.random() < 0.5 ? 'KeyA' : 'KeyD'; await p.keyboard.down(side); await waitG(0.8, 20); await p.keyboard.up(side); } else { await turn(1.2); await walkOn(); await waitG(0.8, 20); await walkOff(); } } }
          lastP = P; lastG = g; }
        if (g - g0 > maxG) { await shortcut('could not reach ' + label + ' in ' + maxG + ' game s; teleported'); const k = Math.min(d, reach * 0.6) / d; await teleport(T.x + (P.x - T.x) * k, T.z + (P.z - T.z) * k); return 'tp'; }
      }
    } finally { await walkOff(); }
  }
  const press = async (key, label) => { await p.keyboard.press(key); await act('pressed ' + key + (label ? ' (' + label + ')' : '')); };
  const leftClick = async (label) => { await p.mouse.move(VW / 2, VH / 2); await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); if (label) await act('left click (' + label + ')'); };
  const rightClick = async (label) => { await p.mouse.move(VW / 2, VH / 2); await p.mouse.down({ button: 'right' }); await p.waitForTimeout(60); await p.mouse.up({ button: 'right' }); await act('right click' + (label ? ' (' + label + ')' : '')); };
  const clickEl = async (sel, label) => { if (DESK) { const c = await centre(sel); if (!c) return false; await p.mouse.click(c.x, c.y); } else await tap(sel); await act((DESK ? 'clicked ' : 'tapped ') + sel + (label ? ' (' + label + ')' : '')); return true; };
  const use = async (label) => { if (DESK) await press('KeyE', label); else { await tap('#bFire'); await act('tapped USE (' + label + ')'); } };
  const lastLines = (n = 6) => ev((n) => window.__log.filter((l) => !['SNAP', 'ACT', 'NOTE', 'SHORTCUT', 'QUIET', 'quest', 'bstat', 'VOICE'].includes(l.k)).slice(-n).map((l) => l.k + ': ' + l.t), n);
  const marlaXZ = () => ev(() => { const m = window.__game.marla.root, w = new (m.position.constructor)(); m.getWorldPosition(w); return { x: w.x, z: w.z }; });
  // walk toward T until the base prompt matches re, then USE
  const useAt = async (T, label, re) => {
    const ok = async () => re.test(await text('#bprompt'));
    if (!(await ok())) await walkTo(T, { reach: 1.6, maxG: 40, label, stop: ok });
    for (let k = 0; k < 5 && !(await ok()); k++) { const t = await T(); await faceTo(t.x, t.z); await waitG(0.5); if (await ok()) break; await walkTo(T, { reach: 1.4 - k * 0.2, maxG: 8, label: label + ' (closer)', stop: ok }); }
    await act('prompt at ' + label + ': "' + (await text('#bprompt')) + '"', 'NOTE'); await use(label); await waitG(1.2);
  };
  const closePanel = async () => { if (DESK) { await press('Escape', 'close the panel'); } else { const b = await ev(() => { const bs = [...document.querySelectorAll('.ov button')].filter((x) => x.getBoundingClientRect().width > 0 && /^(close|back|done|stay|ok)/i.test(x.innerText.trim())); return bs[0] ? (bs[0].id ? '#' + bs[0].id : null) : null; }); if (b) await clickEl(b, 'close'); else { const did = await ev(() => { const bs = [...document.querySelectorAll('.ov button')].filter((x) => x.getBoundingClientRect().width > 0 && /^(close|back|done|stay|ok)/i.test(x.innerText.trim())); if (bs[0]) { const r = bs[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: bs[0].innerText.trim() }; } return null; }); if (did) { const id = await tdown(did.x, did.y); await p.waitForTimeout(80); await tup(id); await act('tapped "' + did.t + '"'); } else await note('no close button found on the panel'); } } await waitG(0.8); };

  // ---------- the night: aim at a machine you can see on your floor
  const aimAt = async (pick) => { const a = await ev((pick) => { const g = window.__game, s = g.sim, c = g.cam.position; if (!s) return null; const P = s.player; let gl = s.gloom.filter((q) => q.floor === P.floor && !q.dead); if (pick === 'see') gl = gl.filter((q) => !s.canSee || s.canSee(q)); gl.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)); const q = gl[0]; if (!q) return null; const gy = (s.gloomY ? s.gloomY(q) : P.floor * 3.2) + 1.1; const dx = q.x - c.x, dz = q.z - c.z, dy = gy - c.y, d = Math.hypot(dx, dz); const want = Math.atan2(-dx, -dz); return { dyaw: Math.atan2(Math.sin(want - g.yaw), Math.cos(want - g.yaw)), dp: Math.atan2(dy, d) - (g.cam.rotation.x || 0), d, kind: q.kind, n: gl.length }; }, pick); if (!a) return null; if (Math.abs(a.dyaw) > 0.03 || Math.abs(a.dp) > 0.05) await turn(a.dyaw, a.dp); return a; };

  // =================================================================== DAY: the street and its houses
  const houseList = () => ev(() => { const r = window.__game.run; return r.houses.map((h) => ({ i: h.i, x: h.doorX, z: h.doorZ, row: h.row, seen: !!h.seen, d: Math.hypot(h.doorX - r.px, h.doorZ - r.pz) })).sort((a, b) => a.d - b.d); });
  const inHouse = () => ev(() => !!window.__game.sim);
  const kitCheck = async () => { if (await visible('#kit')) { await note('Marla\'s device panel opened: ' + (await text('#kit')).replace(/\s+/g, ' ').slice(0, 300)); await shot('street_kit'); await waitG(3); await clickEl('#kitDone', 'Done on the device panel'); await waitG(0.5); } return false; };
  const goInto = async (h, label) => {
    await walkTo(async () => ({ x: h.x, z: h.z - h.row * 2.5 }), { reach: 1.6, maxG: 30, label: label + ' (in front of its door)', stop: async () => { await kitCheck(); return await inHouse(); } });
    if (!(await inHouse())) await walkTo(async () => ({ x: h.x, z: h.z + h.row * 1.5 }), { reach: 0.3, maxG: 10, label: label + ' (through its door)', stop: inHouse });
    if (!(await inHouse())) { await shortcut('could not walk through the door of ' + label + '; entered with the game hook'); await ev((i) => window.__game.enterHouse(i), h.i); }
  };
  const collectors = () => ev(() => window.__game.sim ? window.__game.sim.devices.filter((d) => d.kind === 'collector').length : -1);
  const solarHere = async (label) => {
    const op = await ev(() => { const s = window.__game.sim, P = s.player; const b = s.breaches.filter((q) => q.floor === P.floor).sort((a, c) => Math.hypot(a.inX - P.x, a.inZ - P.z) - Math.hypot(c.inX - P.x, c.inZ - P.z))[0]; return b ? { x: b.inX, z: b.inZ, ox: b.x, oz: b.z, type: b.type } : null; });
    if (!op) return; await act(label + ': going to the nearest ' + op.type + ' to place a collector'); await walkTo(async () => ({ x: op.x, z: op.z }), { reach: 0.6, maxG: 8, label: 'the nearest ' + op.type }); await faceTo(op.ox, op.oz); await waitG(0.5);
    const before = await collectors();
    if (DESK) await press('KeyQ', 'Solar: "key Q"'); else { await tap('#b0'); await act('tapped SOLAR (#b0)'); }
    await waitG(1); let after = await collectors();
    if (after <= before) { await note('collector not placed; lines: ' + JSON.stringify(await lastLines(2))); await walkTo(async () => ({ x: op.x + (op.ox - op.x) * 0.5, z: op.z + (op.oz - op.z) * 0.5 }), { reach: 0.3, maxG: 6, label: 'closer to the ' + op.type }); await faceTo(op.ox, op.oz); await waitG(0.3);
      if (DESK) await rightClick('Solar with the right button (Keys card wording)'); else { await tap('#b0'); await act('tapped SOLAR again'); } await waitG(1); after = await collectors(); }
    await note(label + ': collectors ' + before + ' -> ' + after + '; lines: ' + JSON.stringify(await lastLines(2))); await shot(label.replace(/\s+/g, '_') + '_solar');
  };
  const grabCrates = async (label) => { let fails = 0; for (let k = 0; k < 14; k++) { const c = await ev(() => { const s = window.__game.sim; if (!s) return null; const P = s.player; const cs = s.crates.filter((c) => !c.got && c.floor === P.floor).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)); return cs[0] ? { x: cs[0].x, z: cs[0].z, left: cs.length, up: s.crates.filter((c) => !c.got && c.floor !== P.floor).length } : null; }); if (!c) break; if (k === 0) await act(label + ': ' + c.left + ' capsules on this floor, ' + c.up + ' on another floor (the stairs were not used)'); const r = await walkTo(async () => ({ x: c.x, z: c.z }), { reach: 0.6, maxG: 8, label: 'a capsule' }); if (r === 'tp') fails++; await waitG(0.5); } };
  const leaveHouse = async () => { const d = await ev(() => { const s = window.__game.sim, P = s.player; const b = s.breaches.filter((q) => q.floor === 0 && q.type === 'door').sort((a, c) => Math.hypot(a.inX - P.x, a.inZ - P.z) - Math.hypot(c.inX - P.x, c.inZ - P.z))[0]; return b ? { x: b.inX, z: b.inZ } : null; });
    await walkTo(async () => d, { reach: 0.6, maxG: 15, label: 'the door' }); await waitG(0.8); await shot('at_the_door_to_leave');
    if (DESK) await press('KeyE', 'leave at the door'); else { await tap('#bLeave'); await act('tapped LEAVE'); } await waitG(1.5);
    if (await inHouse()) { await note('still inside after E/LEAVE; lines: ' + JSON.stringify(await lastLines(3))); await shortcut('left with the game hook'); await ev(() => window.__game.leaveHouse()); await waitG(1); } };

  async function dayPart() {
    expect = 'day';
    await stage('street by day'); await waitG(2); await shot('street_start');
    await waitG(4, 120); await kitCheck();
    // a sleeping machine close by: walk toward it to about 6 m and look at it (the street's own lesson about them)
    const dorm = await ev(() => { const r = window.__game.run, d = (r.dormant || []).map((q) => ({ x: q.x, z: q.z, k: q.kind, d: Math.hypot(q.x - r.px, q.z - r.pz) })).sort((a, b) => a.d - b.d)[0]; return d || null; });
    if (dorm && dorm.d < 26) { await act('a sleeping machine stands ' + dorm.d.toFixed(0) + ' m away (' + dorm.k + '): walking toward it to see what the game says'); await walkTo(async () => dorm, { reach: 6.5, maxG: 8, label: 'a sleeping machine', stop: kitCheck }); await faceTo(dorm.x, dorm.z); await waitG(3); await shot('street_sleeper'); }
    for (let n = 1; n <= 3; n++) {
      if (!(await inHouse())) { const h = (await houseList()).filter((q) => !q.seen)[0]; await stage('street by day: to house ' + n); await act('walking to the nearest unvisited door (house ' + h.i + ', ' + h.d.toFixed(0) + ' m)'); await goInto(h, 'house ' + h.i); }
      await stage('house ' + n + ' by day'); await waitG(2); await shot('house' + n + '_inside'); await waitG(3); // read what she says on the way in
      const must = await ev(() => { const g = window.__game; return !!(g.save && !g.save.solarDone && !(g.save.nights > 0)); });
      const lines = (await lastLines(4)).join(' || ');
      if (must || /collector first|solar/i.test(lines)) await solarHere('house ' + n);
      await grabCrates('house ' + n); await shot('house' + n + '_after_capsules');
      const bell = await ev(() => { const r = window.__game.run; return r.bell || r.dayT < r.cfg.day.bell; });
      if (n >= 2 || bell) { // this is where we sleep: the game said to place Solar in the house you will sleep in
        if ((await collectors()) === 0) await solarHere('house ' + n + ' (the night house)');
        await stage('house ' + n + ': waiting for dusk'); await note('staying here for the night; day clock ' + JSON.stringify(await ev(() => { const r = window.__game.run, s = window.__game.sim; return { left: +(r.dayT).toFixed(1), sun: s ? +s.player.energy.toFixed(1) : null }; })));
        let held = false; const g0 = await gt();
        for (;;) { await waitG(1, 60); const s = await ev(() => { const s = window.__game.sim; return { sun: s.player.energy, cap: s.player.energyCap || (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).player.energyCap }; });
          if (!held && s.sun >= s.cap - 0.5) { held = true; await act('Sun is full: holding START NIGHT'); if (DESK) { await p.keyboard.down('KeyN'); await waitG(1.6, 40).catch(() => {}); await p.keyboard.up('KeyN'); } else await tap('#bDusk', 1800); }
          if ((await gt()) - g0 > 200) { await shortcut('dusk did not come in 200 game s; started the night with the game hook'); await ev(() => window.__game.nightfall()); } }
      }
      await leaveHouse(); await stage('street by day after house ' + n); await waitG(3); await shot('street_after_house' + n);
    }
  }

  // =================================================================== NIGHT
  async function nightPart() {
    expect = 'night'; await ev(() => { window.__hpFloor = { drill: 25, night: 15 }; }); await stage('night 1 drill'); await waitG(0.5); await shot('dusk');
    const drill = () => ev(() => { const d = window.__game.drillInfo(); return d ? d.step : null; });
    let drillSaves = 0, aimDbg = 0; const drillLog = []; let lastStep = 'none', stepG = await gt(); const g0 = await gt(); let started = false;
    while ((await gt()) - g0 < 240) {
      await guard(); const st = await drill(); const g = await gt();
      if (st !== lastStep) { drillLog.push([lastStep, +(g - stepG).toFixed(1)]); await act('drill step: ' + lastStep + ' -> ' + st + ' (the last one took ' + (g - stepG).toFixed(1) + ' game s)'); lastStep = st; stepG = g; if (st && st !== 'wait') { started = true; await waitG(1.2); await shot('drill_' + st); } }
      if (!st && (started || (await gt()) - g0 > 12)) break;
      if (!st || st === 'wait') { await p.waitForTimeout(250); continue; }
      const since = (await gt()) - stepG; if (since < 1.5) { await p.waitForTimeout(200); continue; } // read the order first
      if (aimDbg < 12 && (st === 'shoot' || st === 'charge')) { aimDbg++; const q = await ev(() => { const g = window.__game, s = g.sim, P = s.player, q = s.gloom[0]; return q ? { yaw: +g.yaw.toFixed(2), d: +Math.hypot(q.x - P.x, q.z - P.z).toFixed(1), see: s.canSee ? s.canSee(q) : null, floor: [q.floor, P.floor] } : null; }); await act('aim check ' + JSON.stringify(q), 'DBG'); }
      if (st === 'shoot') { const a = (await aimAt('see')) || (await aimAt('any')); if (a && (Math.abs(a.dyaw) < 1.2 || since > 5)) { if (DESK) await leftClick('fire at the ringed machine'); else { await tap('#bFire'); await act('tapped FIRE'); } await waitG(0.6, 20); } else if (!a) { await aimAt('any'); await p.waitForTimeout(300); } }
      else if (st === 'place') { await aimAt('any'); if (DESK) await rightClick('place the device'); else { const s = await ev(() => { const e = document.querySelector('#slots .b.pulse') || document.querySelector('#slots .b.dev.sel'); return e ? '#' + e.id : null; }); if (s) { await tap(s); await act('tapped the glowing device ' + s); } else await note('no glowing device button found'); } await waitG(1.5, 20); }
      else if (st === 'switch') { if (DESK) { const sel = await ev(() => window.__game.drillInfo().sel); await press(sel === 0 ? 'Digit2' : 'Digit1', 'another device number'); await waitG(1.2, 20); if ((await drill()) === 'switch') { await p.mouse.wheel(0, 120); await act('rolled the mouse wheel'); await waitG(1.2, 20); } if ((await drill()) === 'switch' && since > 10) { await shortcut('a number key and the wheel did not end "switch"; sent the key inside the page'); await ev((c) => { dispatchEvent(new KeyboardEvent('keydown', { code: c })); dispatchEvent(new KeyboardEvent('keyup', { code: c })); }, 'Digit2'); await waitG(1, 20); } }
        else { await tap('#bSwitch'); await act('tapped the switch tab'); await waitG(0.8, 20); const o = await ev(() => { const e = [...document.querySelectorAll('#slots .b.dev')].find((x) => !x.classList.contains('sel') && x.getBoundingClientRect().width > 0 && !/need/.test(x.innerText)); return e ? '#' + e.id : null; }); if (o) { await tap(o); await act('tapped another device ' + o); } else await note('no other device to tap'); await waitG(1.5, 20); } }
      else if (st === 'charge') { const a = await aimAt('see'); if (!a) { await aimAt('any'); await p.waitForTimeout(300); continue; } if (DESK) { await p.mouse.move(VW / 2, VH / 2); await p.mouse.down(); await act('holding the left button'); const gold = await waitFor(() => { const c = document.getElementById('cross').style.borderColor; return c === 'rgb(255, 215, 106)' || c === '#ffd76a'; }, 8); await aimAt('see'); await p.mouse.up(); await act('let go (ring gold: ' + !!gold + ')'); }
        else { const c = await centre('#bFire'); const id = await tdown(c.x, c.y); await act('holding FIRE'); const gold = await waitFor(() => { const c = document.getElementById('cross').style.borderColor; return c === 'rgb(255, 215, 106)' || c === '#ffd76a'; }, 8); await tup(id); await act('let go of FIRE (ring gold: ' + !!gold + ')'); } await waitG(1.5, 30); }
      else if (st === 'eat') { if (DESK) await press('KeyF', 'eat'); else { await tap('#bEat'); await act('tapped EAT'); } await waitG(1.5, 30); }
      else await p.waitForTimeout(300);
    }
    await note('drill steps [step, game s it took]: ' + JSON.stringify(drillLog));
    await stage('night 1 after the drill'); await shot('after_drill'); let fires = 0, eats = 0, saves = 0, lastShot = await gt(); const n0 = await gt();
    while ((await gt()) - n0 < 400) {
      await guard();
      const s = await ev(() => { const s = window.__game.sim; if (!s) return null; return { hp: s.player.hp, max: (typeof window.__game.cfg === 'function' ? window.__game.cfg() : window.__game.cfg).player.hp, food: s.food, n: s.gloom.length }; }); if (!s) break;
      if (s.hp < s.max * 0.4 && s.food > 0) { if (DESK) await p.keyboard.press('KeyF'); else await tap('#bEat'); eats++; if (eats === 1) await act('health under 40%: ate (as taught)'); }
      const a = await aimAt('see'); if (a && Math.abs(a.dyaw) < Math.max(0.08, Math.atan(0.3 / Math.max(0.3, a.d))) && a.d < 14) { if (DESK) await leftClick(); else await tap('#bFire', 50); fires++; } else if (!a) await p.waitForTimeout(300);
      if ((await gt()) - lastShot > 50) { lastShot = await gt(); await shot('night_' + Math.round(lastShot - n0) + 's'); }
    }
    await note('night after the drill: ' + fires + ' shots, ' + eats + ' meals; health top-ups in all (shortcut): ' + (await ev(() => window.__hpTops || 0)));
  }

  const waitFrames = async (n, cap = 900) => { const f0 = await ev(() => window.__frames), w0 = Date.now(); while ((await ev(() => window.__frames)) - f0 < n && Date.now() - w0 < cap * 1000) await p.waitForTimeout(500); };
  if (HI) { try {
    await p.goto('file://' + PAGE, { timeout: 600000 });
    await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.disabled; }, null, { timeout: 900000 });
    await stage('start'); await waitFrames(2); await shot('hi_start_screen'); await clickEl('#enter', 'the begin button'); await waitFrames(3);
    if ((await state()) === 'intro') { await stage('film'); await waitFrames(6); await shot('hi_film'); await shortcut('high tier: skipped the film (its lines were read in full on the low-tier desktop play)'); await p.keyboard.press('KeyX'); }
    await waitFor(() => window.__game.state === 'base', 900); await stage('base day 1: waking'); await waitFrames(6); await shot('hi_base_wake');
    if (await visible('#jobCard')) await clickEl('#jobCard button', 'Got it'); await waitFrames(2); await p.mouse.click(VW / 2, VH / 2); await act('clicked the game'); await waitFrames(3); await shot('hi_base_after_card');
    await press('KeyE', 'talk to Marla'); await waitFrames(3); await stage('base day 1: Marla dialog'); await shot('hi_marla_dialog_day1');
    if (await visible('#ssetup')) { await clickEl('#ssetup', 'Set up the run'); await waitFrames(2); await shot('hi_marla_setup_day1'); }
    await clickEl('#go', 'Ride out'); await waitFor(() => window.__game.state === 'play', 900); await stage('street by day'); await waitFrames(6); await shot('hi_street_start');
    await shortcut('high tier: entered the nearest house with the game hook'); await ev(() => { const g = window.__game, r = g.run, h = r.houses.slice().sort((a, b) => Math.hypot(a.doorX, a.doorZ) - Math.hypot(b.doorX, b.doorZ))[0]; g.enterHouse(h.i); }); await stage('house 1 by day'); await waitFrames(6); await shot('hi_house_inside');
    await press('KeyQ', 'Solar'); await waitFrames(3); await shot('hi_house_solar');
    await shortcut('high tier: started the night with the game hook'); await ev(() => window.__game.nightfall()); await stage('night 1 drill'); await waitFrames(4); await waitFor(() => { const d = window.__game.drillInfo(); return d && d.step === 'shoot'; }, 120); await waitFrames(3); await shot('hi_drill_shoot');
    await p.keyboard.down('KeyH'); await waitFrames(2); await shot('hi_drill_hold_H'); await p.keyboard.up('KeyH');
  } catch (e) { console.log('DRIVER ERROR ' + (e && e.stack || e)); try { await shot('driver_error'); } catch (e2) { /* none */ } } }
  else try {
    // ================= LOAD and START =================
    await p.goto('file://' + PAGE, { timeout: 300000 });
    await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.disabled; }, null, { timeout: 400000 });
    await stage('start'); await p.waitForTimeout(1500); await shot('start_screen');
    await clickEl('#enter', 'the begin button');
    await p.waitForTimeout(1500);
    if ((await state()) === 'intro') { await stage('film'); const g0 = await gt(); let mid = 0;
      while ((await state()) === 'intro' && (await gt()) - g0 < 120) { await p.waitForTimeout(400); const g = (await gt()) - g0; if ((mid === 0 && g > 10) || (mid === 1 && g > 50)) { mid++; await shot('film_' + mid); } }
      if ((await state()) === 'intro') { await shortcut('film still running after 120 game s; pressed a key to skip'); await p.keyboard.press('KeyX'); await p.waitForTimeout(3000); }
      await note('watched the opening film for ' + ((await gt()) - g0).toFixed(1) + ' game s'); }
    await waitFor(() => window.__game.state === 'base', 120);
    // ================= BASE, DAY 1 =================
    expect = 'base'; await stage('base day 1: waking'); await waitG(1); await shot('base_wake');
    // read the job card like a player: about 8 real seconds (its own timer is in real seconds), then its button
    { const w0 = Date.now(); while (Date.now() - w0 < 8000 && (await visible('#jobCard'))) await p.waitForTimeout(300); }
    if (await visible('#jobCard')) await clickEl('#jobCard button', 'Got it on the job card'); else await note('the job card closed by itself before 8 real seconds of reading');
    await waitG(2); await shot('base_after_card');
    if (DESK) { await p.mouse.move(VW / 2, VH / 2); await p.mouse.down(); await p.mouse.up(); await act('clicked the game (the prompt says Click to start)'); await waitG(1.5); }
    { const P = await pos(), M = await marlaXZ(); await note('waking at ' + P.x.toFixed(1) + ',' + P.z.toFixed(1) + '; Marla stands ' + Math.hypot(M.x - P.x, M.z - P.z).toFixed(1) + ' m away; prompt: "' + (await text('#bprompt')) + '"'); }
    await stage('base day 1: talk to Marla');
    for (let k = 0; k < 3 && !(await visible('#scout')); k++) { await useAt(marlaXZ, 'Marla', /talk to Marla/i); await waitG(1); }
    if (!(await visible('#scout'))) { await shortcut('Marla\'s dialog never opened; opened it with the game hook'); await ev(() => window.__game.openScout()); await waitG(1); }
    await stage('base day 1: Marla dialog'); await waitG(1); await shot('marla_dialog_day1'); await waitG(6, 60);
    expect = null; await clickEl('#go', 'Ride out');
    await waitFor(() => window.__game.state === 'play' && window.__game.run, 60);
    // ================= DAY on the street, NIGHT =================
    try { await dayPart(); } catch (e) { if (!(e instanceof Phase)) throw e; await note('day ended: the game moved to "' + e.phase + '"'); }
    if ((await phaseNow()) === 'night') { try { await nightPart(); } catch (e) { if (!(e instanceof Phase)) throw e; await note('night ended: the game moved to "' + e.phase + '"'); } }
    expect = null;
    // ================= DAWN =================
    await stage('dawn: night result'); await waitFor(() => window.__game.state === 'end', 120); await waitG(2); await shot('night_result'); await waitG(6, 60);
    if (await visible('#again')) await clickEl('#again', (await text('#again')) || 'continue');
    await waitFor(() => window.__game.state === 'base', 60);
    // ================= BASE, DAY 2 =================
    expect = 'base'; await stage('base day 2'); await waitG(3); await shot('base_day2'); await waitG(5, 60);
    const ST = await ev(() => { const S = window.__game.B.STATIONS; return { ws: { x: S.workshop.x, z: S.workshop.z }, board: { x: S.board.x, z: S.board.z } }; });
    await stage('base day 2: Workshop'); await useAt(async () => ST.ws, 'the Workshop', /USE.*(Oko|workshop|upgrade)/i); await shot('day2_workshop'); await waitG(5, 60); await closePanel();
    await stage('base day 2: quest board'); await useAt(async () => ST.board, 'the quest board', /USE.*(board|quest)/i); await shot('day2_quest_board'); await waitG(5, 60); await closePanel();
    await stage('base day 2: Marla, ring choice'); for (let k = 0; k < 3 && !(await visible('#scout')); k++) { await useAt(marlaXZ, 'Marla', /talk to Marla/i); await waitG(1); }
    await shot('marla_dialog_day2'); await note('ring picker: ' + (await ev(() => [...document.querySelectorAll('#selRing option')].map((o) => o.textContent + (o.disabled ? ' [locked]' : '')).join(' | '))));
    await waitG(4, 60); if (await visible('#ssetup')) { await clickEl('#ssetup', 'Set up the run'); await waitG(1); await shot('marla_setup_day2'); }
    if (await visible('#sback')) await clickEl('#sback', (await text('#sback')) || 'back'); await waitG(1);
    // ================= Keys card and pause menu (not prompted: exploring) =================
    expect = null; await stage('keys card (exploring)');
    if (DESK) { await p.keyboard.down('KeyH'); await waitG(1.2, 30); await shot('hold_H'); await p.keyboard.up('KeyH'); await waitG(0.5); await press('Escape', 'pause'); await waitG(1); await shot('pause_menu'); if (await visible('#pKeys')) { await clickEl('#pKeys', 'Keys'); await waitG(1); await shot('keys_card'); } }
    else { await tap('#bPause'); await act('tapped pause'); await waitG(1); await shot('pause_menu'); if (await visible('#pKeys')) { await clickEl('#pKeys', 'Keys'); await waitG(1); await shot('keys_card'); } }
  } catch (e) { console.log('DRIVER ERROR ' + (e && e.stack || e)); try { await shot('driver_error'); } catch (e2) { /* none */ } }
  const log = await ev(() => window.__log).catch(() => []); const fps = await ev(() => [window.__frames, performance.now() / 1000, window.__gt]).catch(() => null);
  fs.writeFileSync(OUT + 'log.json', JSON.stringify({ mode: MODE, page: PAGE, fps, errs, log }, null, 1));
  console.log('\nTRANSCRIPT (game s | wall s | stage | source | text)');
  for (const l of log) if (l.k !== 'SNAP') console.log(l.gt + ' | ' + l.wt + ' | ' + l.st + ' | ' + l.k + ' | ' + String(l.t).slice(0, 300));
  console.log('frames, wall s, game s: ' + JSON.stringify(fps)); console.log(errs.length ? 'PAGE ERRORS ' + errs.slice(0, 5).join(' || ') : 'NO PAGE ERRORS');
  await b.close();
})();
