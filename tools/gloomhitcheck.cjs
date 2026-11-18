// Aimed-shot check for every Gloom kind (owner Nov 18: "on phone I can't hit Ticks", then: every kind, desktop and phone). PASS/FAIL lines plus a table.
// Usage: node tools/gloomhitcheck.cjs <low|high> [page]
//   low  = the phone version: 731x304, touch, isMobile, low tier (dist/index.html)
//   high = desktop: 960x540 (the size does not change the geometry; frames are slow in the software renderer), mouse, high tier with the GLB models (dist/index_single.html: a page opened from a folder cannot fetch dist/models)
// In a night in house 0 the sim is frozen (sim.step does nothing), one machine at a time is put straight ahead at 2, 5, 10 and 15 m, facing you and turned side-on.
// The camera aim is set to: the middle of its largest drawn body part, the middle of its largest drawn head part (visible solid meshes; no sprites, glow, ground shade or see-through cards),
// and for the Ticks the centre of each of the three units (leaf cards and dirt decals, the see-through flat cards on them, are left out of the boxes). sim.fireCannon('ray') then says hit or miss, once with CONFIG.cannon.shapes off (the old hit cylinder)
// and once as the game fires (the tier's shapes; on desktop the live shapes of the models as drawn, window.__game.liveShapes). Also: aiming 0.3 m beside, and over, the drawn body must miss on desktop
// (on phones it is INFO: they get leeway, owner Nov 18 12:11).
// The machines stand where they are drawn even beyond the house walls (a geometry test: walls are not part of it). The cannon reaches CONFIG.cannon.range (14 m).
// MEASURE=1 also prints each kind's drawn box in its own frame (union over every trial), the numbers for CONFIG.cannon.shapes.
const { chromium } = require('playwright');
const path = require('path');
const tier = process.argv[2] === 'high' ? 'high' : 'low';
const page0 = process.argv[3] || path.resolve(__dirname, '../dist/' + (tier === 'high' ? 'index_single.html' : 'index.html'));
const KINDS = ['walker', 'lurcher', 'ticks', 'hauler', 'stilt', 'lantern', 'warden'], DISTS = [2, 5, 10, 15];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [], out = [];
  const add = (name, ok) => { out.push((ok ? 'PASS ' : 'FAIL ') + name); };
  const ctx = await b.newContext(tier === 'low' ? { viewport: { width: 731, height: 304 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.text().startsWith('trial ')) console.error(m.text()); });
  await p.addInitScript(() => { window.__dtMax = 0.5; window.__noHands = true; try { localStorage.clear(); localStorage.setItem('dawnpunk.drill', '{"skip":true}'); } catch (e) { /* none */ } });
  await p.goto('file://' + page0 + '?quality=' + tier + '&seed=777', { timeout: 300000 }); await p.waitForFunction(() => window.__game && window.__game.startRun, null, { timeout: 300000 });
  if (tier === 'high') { const st = await p.waitForFunction(() => { const s = window.__gloomGlb || {}; const ks = Object.keys(s); return ks.length && ks.every((k) => s[k] !== 'loading') ? s : null; }, null, { timeout: 240000 }).then((h) => h.jsonValue()).catch(() => null); out.push('INFO desktop models: ' + JSON.stringify(st)); }
  await p.evaluate(() => { const g = window.__game; g.enterBase(); g.save.nights = 3; document.getElementById('selRing').value = '0'; g.startRun(0); g.enterHouse(0); }); await p.waitForTimeout(2000);
  await p.evaluate(() => window.__game.endDay()); await p.waitForFunction(() => window.__game.sim && window.__game.sim.phase === 'night', null, { timeout: 60000 });
  await p.evaluate(() => { const s = window.__game.sim; s.step = () => {}; s.gloom.length = 0; const P = s.player; P.x = 0; P.z = 0; P.floor = 0; P.hp = 1e6; });
  const res = await p.evaluate(async ([KINDS, DISTS, FR]) => {
    const G = window.__game, s = G.sim, P = s.player, C = (typeof G.cfg === 'function' ? G.cfg() : G.cfg).cannon, FH = (typeof G.cfg === 'function' ? G.cfg() : G.cfg).floorH, SH0 = C.shapes;
    // the scene: the parent of a sample machine (removed again at once)
    G.gloomSample('walker', 0, -400, 0, 0, false); const smp = window.__lastSample, scene = smp.parent; scene.remove(smp);
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    // world corners of the visible meshes under o (no sprites, additive glow or ground shade); also the same points in the machine's own frame (m: position, turn)
    // only: this mesh alone (not the meshes under it)
    const pts = (o, m, only) => { const W = [], L = []; const th = m.rotation.y, co = Math.cos(th), si = Math.sin(th);
      o.updateMatrixWorld(true); (only ? (f) => f(o) : (f) => o.traverse(f))((q) => { if (!q.isMesh || q.isSprite || q.userData.blob) return; let v = q; while (v) { if (!v.visible) return; v = v.parent; } const mt = Array.isArray(q.material) ? q.material[0] : q.material; if (mt && (mt.blending === 2 || mt.visible === false || (mt.transparent && mt.opacity < 0.15))) return;
        // leaf cards and dirt decals (see-through flat cards) hang off the body; they are not part of what you aim at
        if (q.geometry && q.geometry.type === 'PlaneGeometry' && mt && mt.transparent) return;
        const gm = q.geometry; if (!gm || !gm.attributes || !gm.attributes.position) return; if (!gm.boundingBox) gm.computeBoundingBox(); const bb = gm.boundingBox, e = q.matrixWorld.elements;
        for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14]; W.push([wx, wy, wz]); const dx = wx - m.position.x, dz = wz - m.position.z; L.push([dx * co - dz * si, wy - m.position.y, dx * si + dz * co]); } });
      return { W, L }; };
    const box = (A) => { if (!A.length) return null; const b = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]; for (const q of A) { b[0] = Math.min(b[0], q[0]); b[1] = Math.max(b[1], q[0]); b[2] = Math.min(b[2], q[1]); b[3] = Math.max(b[3], q[1]); b[4] = Math.min(b[4], q[2]); b[5] = Math.max(b[5], q[2]); } return b; };
    const ctr = (b) => [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2];
    const uni = (a, c) => (!a ? c.slice() : [Math.min(a[0], c[0]), Math.max(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[3], c[3]), Math.min(a[4], c[4]), Math.max(a[5], c[5])]);
    const eyeY = () => 1.6 + P.floor * FH;
    const fire = (g, a, shapes) => { const dx = a[0] - P.x, dz = a[2] - P.z; return fireAng(g, Math.atan2(-dx, -dz), Math.atan2(a[1] - eyeY(), Math.hypot(dx, dz)), shapes); };
    // after = the game's own aimed shot: the tier's shapes, and on desktop the live shapes of the models as drawn (window.__game.liveShapes, as doFire passes them); before = the old cylinder
    const fireAng = (g, yaw, pitch, shapes) => { P.yaw = yaw; P.pitch = pitch; P.cd = 0; P.energy = 100;
      C.shapes = shapes; const live = shapes && G.liveShapes ? G.liveShapes() : null; const h0 = g.hp; s.log.length = 0; s.fireCannon('ray', 1, false, live); const hit = g.hp < h0, ev = s.log.filter((e) => e.e === 'shot').pop(); g.hp = 1e6; C.shapes = SH0; return hit ? (ev && ev.head ? 'H' : 'h') : '-'; };
    const rows = [], local = {}; let id = 70000;
    for (const kind of KINDS) for (const d of DISTS) for (const facing of ['front', 'side']) {
      s.gloom.length = 0; const g = { id: id++, kind, x: 0, z: -d, floor: 0, hp: 1e6, maxhp: 1e6, phase: 'inside', bp: 0, timer: 0, cd: 1e9, face: 0 };
      g.face = Math.atan2(-(P.x - g.x), -(P.z - g.z)) + (facing === 'side' ? Math.PI / 2 : 0); s.gloom.push(g);
      G.setYaw(0); G.setPitch(-0.2); console.log('trial ' + kind + ' ' + d + ' ' + facing + ' ' + new Date().toTimeString().slice(0, 8)); for (let k = 0; k < FR; k++) await raf();
      const m = scene.children.find((o) => o.userData.kind === kind && Math.abs(o.position.x - g.x) < 1e-3 && Math.abs(o.position.z - g.z) < 1e-3);
      if (!m) { rows.push({ kind, d, facing, err: 'no mesh' }); continue; }
      let lb = null, hb = null; for (let k = 0; k < FR; k++) { const A = pts(m, m); lb = uni(lb, box(A.L)); if (m.userData.head) { const H = pts(m.userData.head, m); const hh = box(H.L); if (hh) hb = uni(hb, hh); } await raf(); }
      const L0 = local[kind] = local[kind] || { body: null, head: null, pb: [], ph: [] }; L0.body = uni(L0.body, lb); if (hb) L0.head = uni(L0.head, hb);
      { const A1 = pts(m, m); for (let i = 0; i < A1.L.length; i += 2) L0.pb.push(A1.L[i]); if (m.userData.head) { const H1 = pts(m.userData.head, m); for (let i = 0; i < H1.L.length; i += 2) L0.ph.push(H1.L[i]); } }
      const A = pts(m, m), wb = box(A.W), LV = (typeof G.cfg === 'function' ? G.cfg() : G.cfg).cannon.live;
      // the drawn parts (each visible solid mesh's world box) and which are head parts, by the game's rule (src/main.js drawnShape): under the head node, or, when that node holds most
      // of the machine (the Warden's turning torso), the parts in its top headTop m. Aims: 'centre' = the middle of the largest body part, 'head' = the middle of the largest head part
      const hs = new Set(); for (const h of m.userData.heads || [m.userData.head]) if (h) h.traverse((q) => hs.add(q)); const PT = []; let hv = 0, av = 0;
      m.traverse((q) => { if (!q.isMesh) return; const W1 = pts(q, m, true).W; if (!W1.length) return; const bq = box(W1), v = (bq[1] - bq[0]) * (bq[3] - bq[2]) * (bq[5] - bq[4]); PT.push({ bq, v, head: hs.has(q) }); av += v; if (hs.has(q)) hv += v; });
      if (hv > LV.headShare * av) for (const q of PT) q.head = (q.bq[2] + q.bq[3]) / 2 >= wb[3] - LV.headTop;
      const big = (L2) => L2.filter((q) => q.bq[3] > 0.05).sort((x, y) => y.v - x.v)[0], bp = big(PT.filter((q) => !q.head)), hp = big(PT.filter((q) => q.head));
      const aims = [['centre', bp ? ctr(bp.bq) : ctr(wb)]]; let hw = null, headHidden = false;
      // the head aim: the largest head part the eye can see (the first drawn part on the line to its middle is a head part, by the parts the game measures); none seen = head hidden
      if (hp) { hw = box(PT.filter((q) => q.head).flatMap((q) => [[q.bq[0], q.bq[2], q.bq[4]], [q.bq[1], q.bq[3], q.bq[5]]])); const firstIsHead = (a) => { const dx = a[0] - P.x, dz = a[2] - P.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(a[1] - eyeY(), Math.hypot(dx, dz)); const Lv = G.liveShapes && G.liveShapes(); const S = Lv && Lv[g.id]; if (!S) return true;
          const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), tn = Math.tan(P.pitch), e0 = [P.x, eyeY(), P.z], dw = [fx, tn, fz]; let best = null, head = false;
          for (const Pt of S.parts) { const mm = Pt.inv, o = [0, 1, 2].map((k) => mm[k] * e0[0] + mm[4 + k] * e0[1] + mm[8 + k] * e0[2] + mm[12 + k]), dv = [0, 1, 2].map((k) => mm[k] * dw[0] + mm[4 + k] * dw[1] + mm[8 + k] * dw[2]); let t0 = 0, t1 = 99, ok = true;
            for (let k = 0; k < 3; k++) { if (Math.abs(dv[k]) < 1e-12) { if (o[k] < Pt.box[k] || o[k] > Pt.box[k + 3]) ok = false; continue; } let u = (Pt.box[k] - o[k]) / dv[k], w = (Pt.box[k + 3] - o[k]) / dv[k]; if (u > w) [u, w] = [w, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, w); }
            if (ok && t0 <= t1 && (best === null || t0 < best)) { best = t0; head = Pt.head; } } return head; };
        const cand = PT.filter((q) => q.head && q.bq[3] > 0.05).sort((x, y) => y.v - x.v).slice(0, 8).map((q) => ctr(q.bq)), seen = cand.find(firstIsHead); if (seen) aims.push(['head', seen]); else headHidden = true; } else hw = [0, 0, -9, -9, 0, 0];
      if (kind === 'ticks') { const inner = m.children[0]; const us = inner ? inner.children.filter((c) => c.isGroup && Math.hypot(c.position.x, c.position.z) > 0.2) : []; us.forEach((u, i) => { const ub = box(pts(u, m).W); if (ub) aims.push(['unit' + (i + 1), ctr(ub)]); }); }
      const r = { kind, d, facing, aims: {}, headInWay: false, headHidden };
      for (const [n, a] of aims) r.aims[n] = [fire(g, a, null), fire(g, a, SH0)];
      // does the straight line from the eye through the body centre (and on, to the cannon's range) pass the drawn head? then a head shot there is right
      { const e = [P.x, eyeY(), P.z], a = ctr(wb), dv = [a[0] - e[0], a[1] - e[1], a[2] - e[2]], L = Math.hypot(dv[0], dv[2]) || 1, k = C.range / L; let t0 = 0, t1 = k, ok = true;
        for (const [lo, hi, o, dd] of [[hw[0], hw[1], e[0], dv[0]], [hw[2], hw[3], e[1], dv[1]], [hw[4], hw[5], e[2], dv[2]]]) { if (Math.abs(dd) < 1e-9) { if (o < lo || o > hi) ok = false; continue; } let u = (lo - o) / dd, w = (hi - o) / dd; if (u > w) [u, w] = [w, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, w); }
        r.headInWay = ok && t0 <= t1; }
      // just outside the drawn body: the aim turned 0.3 m (at its distance) past the drawn point farthest to one side, or tipped 0.3 m over the drawn point that sticks up most (seen from the eye)
      { const c = ctr(wb), dc = Math.hypot(c[0] - P.x, c[2] - P.z), yc = Math.atan2(-(c[0] - P.x), -(c[2] - P.z)), pc = Math.atan2(c[1] - eyeY(), dc); let side = -9, up = -9;
        for (const q of A.W) { const dx = q[0] - P.x, dz = q[2] - P.z; let da = Math.atan2(-dx, -dz) - yc; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; side = Math.max(side, da); up = Math.max(up, Math.atan2(q[1] - eyeY(), Math.hypot(dx, dz))); }
        const m3 = Math.atan2(0.3, dc); r.aims.beside = [fireAng(g, yc + side + m3, pc, null), fireAng(g, yc + side + m3, pc, SH0)]; r.aims.over = [fireAng(g, yc, up + m3, null), fireAng(g, yc, up + m3, SH0)]; }
      rows.push(r); }
    s.gloom.length = 0;
    // how far the drawn points reach outside the oval inscribed in the box (1 = all inside; the oval's radii must grow by this factor to hold them all; also the 95th percentile)
    for (const k in local) { const L = local[k]; for (const [bk, pk] of [['body', 'pb'], ['head', 'ph']]) { const B = L[bk]; if (!B || !L[pk].length) continue; const cx = (B[0] + B[1]) / 2, cz = (B[4] + B[5]) / 2, rx = (B[1] - B[0]) / 2 || 1, rz = (B[5] - B[4]) / 2 || 1;
      const v = L[pk].filter((q) => q[1] > 0.02).map((q) => Math.sqrt(((q[0] - cx) / rx) ** 2 + ((q[2] - cz) / rz) ** 2)).sort((a, b) => a - b); L[bk + 'S'] = v.length ? [+v[v.length - 1].toFixed(3), +v[Math.floor(v.length * 0.95)].toFixed(3)] : null; } delete L.pb; delete L.ph; }
    return { rows, local, shapesOn: !!SH0, range: C.range };
  }, [KINDS, DISTS, tier === 'high' ? 2 : 3]);
  const T = tier === 'low' ? 'phone/low' : 'desktop/high';
  out.push('INFO ' + T + ': cell = before/after; h = hit, H = head shot, - = miss; cannon range ' + res.range + ' m');
  if (!res.shapesOn) out.push('INFO CONFIG.cannon.shapes is not set: "after" equals "before"');
  for (const r of res.rows) { if (r.err) { add(T + ' ' + r.kind + ' ' + r.d + ' m ' + r.facing + ': ' + r.err, false); continue; } out.push('ROW ' + T + ' ' + r.kind.padEnd(8) + String(r.d).padStart(3) + ' m ' + r.facing.padEnd(5) + ' ' + Object.entries(r.aims).map(([n, v]) => n + ' ' + v.join('/')).join('  ')); }
  for (const kind of KINDS) {
    const rs = res.rows.filter((r) => r.kind === kind && !r.err), inR = rs.filter((r) => r.d <= res.range), outR = rs.filter((r) => r.d > res.range);
    const onBody = (r) => Object.keys(r.aims).filter((n) => n !== 'beside' && n !== 'over');
    const missIn = inR.flatMap((r) => onBody(r).filter((n) => r.aims[n][1] === '-').map((n) => r.d + 'm ' + r.facing + ' ' + n));
    add(T + ' ' + kind + ': aiming at the drawn body or head hits at every distance in range' + (missIn.length ? ' (misses: ' + missIn.join(', ') + ')' : ''), inR.length && !missIn.length);
    const headMiss = inR.filter((r) => r.aims.head && r.aims.head[1] !== 'H').map((r) => r.d + 'm ' + r.facing), ctrHead = inR.filter((r) => r.aims.centre[1] === 'H' && !r.headInWay).map((r) => r.d + 'm ' + r.facing), inWay = inR.filter((r) => r.headInWay).length;
    add(T + ' ' + kind + ': the drawn head counts as a head shot, the body centre does not (where the line to the centre passes the head first, ' + inWay + ' of ' + inR.length + ', a head shot is right; head hidden behind its body in ' + inR.filter((r) => r.headHidden).length + ')' + (headMiss.length ? ' (head not counted: ' + headMiss.join(', ') + ')' : '') + (ctrHead.length ? ' (centre counted as head: ' + ctrHead.join(', ') + ')' : ''), !headMiss.length && !ctrHead.length);
    const loose = inR.flatMap((r) => ['beside', 'over'].filter((n) => r.aims[n][1] !== '-').map((n) => r.d + 'm ' + r.facing + ' ' + n));
    // phones get leeway (owner Nov 18 12:11): there the shapes are a little larger than the phone's models, so this line is information only
    if (tier === 'high') add(T + ' ' + kind + ': aiming 0.3 m beside or over the drawn body misses' + (loose.length ? ' (hits: ' + loose.join(', ') + ')' : ''), !loose.length); else out.push('INFO ' + T + ' ' + kind + ': aiming 0.3 m beside or over the phone model (leeway allowed) hits ' + loose.length + ' of ' + inR.length * 2 + (loose.length ? ': ' + loose.join(', ') : ''));
    add(T + ' ' + kind + ': out of range (' + outR.map((r) => r.d).join(',') + ' m) never hits', outR.every((r) => Object.values(r.aims).every((v) => v[1] === '-')));
  }
  if (process.env.MEASURE) for (const k of KINDS) { const L = res.local[k]; out.push('BOX ' + T + ' ' + k + ' body ' + JSON.stringify(L.body && L.body.map((v) => +v.toFixed(3))) + ' head ' + JSON.stringify(L.head && L.head.map((v) => +v.toFixed(3))) + ' ovalScale body ' + JSON.stringify(L.bodyS) + ' head ' + JSON.stringify(L.headS)); }
  add(T + ': no page errors' + (errs.length ? ' (' + errs.slice(0, 3).join(' | ') + ')' : ''), !errs.length);
  console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('FAIL')).length; console.log(bad ? bad + ' FAILED' : 'ALL PASS');
  await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
