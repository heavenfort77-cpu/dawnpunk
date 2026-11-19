// Base renderer + walking logic (plain shapes). Built into the shared Three scene by main.js.
import * as THREE from 'three';
import { createSky } from './sky.js';
import { BM, BLOOM, petal, stem, halo, lathe, collectorV2 } from './bloomtech.js';
import { HIBASE, vaultHi, detailDevice } from './basehi.js';
import { SCENERY, baseSceneryIter } from './scenehi.js';
import { STATIONS, CAT_SPOTS, HOME, NPCS, catPos, scoutPos, marlaJournalUnread, boardYaw, BOARD_BOX } from './base.js';
import { roomInfo, roomSolids, toWorld, toLocal, inRoom, doorAt, workshopLow, marlaLow, workshopHi, marlaHi } from './rooms.js';
import { densityOn } from './density.js';
import { CONFIG } from './config.js';
import { okoWork } from './okowork.js';
import { mergeStatic } from './mergestatic.js';
import { buildHatchery, createFlock, hatchLayout, hatchSolids } from './hatchery.js';
import { createVillageCats } from './villagecats.js';
import { buildBaseLifeIter, startPlants } from './basevillage.js';
import { LIFE_PLANTS } from './baseplants.js';
import { reserved as lifeReserved, keepOut as lifeKeepOut, baseBound, lifeOn, plotStates } from './baselife.js';

import { TEX } from './texdata.js';
import { Q, texLoad, aniso } from './quality.js';
import { catMesh } from './props.js';
// ---- the base's look (2026-11-14): clean and green, but not brand new. Every plain colour of the old prototype maps to a klad texture and a tint here.
// [texture, tint, metres per texture tile]. Change a tint to recolour that material everywhere in the base.
const SKIN = {
  0x4a8f8a: ['render', 0xffffff, 2.6], 0xb08a4a: ['render', 0xf4faea, 2.6], 0x9a8a6a: ['render', 0xfff8ea, 2.6], 0x3f8f6a: ['glaze', 0x7fc4a0, 1.5], 0x7fbfae: ['metal', 0x8fd0bc, 1.5],             // storage, workshop, home walls
  0x4aa84a: ['grass', 0xa8e078, 3], 0x3a9a4a: ['leaves', 0xa0e080, 2], 0x2f8a40: ['leaves', 0x88d070, 2], 0x3fa04a: ['leaves', 0xb0f088, 2], 0x2f7a3a: ['leaves', 0x7cc468, 2.4], // green roofs, creepers, planters, hedge
  0x5a3d28: ['glaze', 0xece6d6, 1.6], 0x6a4a2a: ['bark', 0xffffff, 1.2], 0x8a6a3a: ['wood', 0xf0c890, 1.6], 0x8a5a3a: ['wood', 0xe8b080, 1.6], 0x4a3a2a: ['wood', 0x9a8068, 1.6],
  0x7a8f9a: ['metal', 0xb8d0dc, 2], 0x555555: ['metal', 0x9a9a9a, 2], 0xe8e8e8: ['metal', 0xffffff, 2], 0xf4f4f4: ['metal', 0xffffff, 2],
  0xe9dcb0: ['block', 0xfff0c8, 3], 0xd8d0b8: ['fabric', 0xf0e8d0, 1.5], 0xb8584a: ['fabric', 0xd87868, 1.5],
  0x2f4f9a: ['cell', 0xffffff, 1.0], 0x2a4f9a: ['cell', 0xffffff, 1.0], 0x2a58b4: ['cell', 0xffffff, 1.0],                               // solar: roofs, racks, the solar tree, the canopy
};
const loader = new THREE.TextureLoader(), tcache = {};
const tex = (n) => { if (!tcache[n]) { let t; if (n === 'pv') { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#1d3f86'; x.fillRect(0, 0, 128, 128); // solar cells: dark blue, silver grid lines, a little dust
      for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '120,150,210' : '10,20,50') + ',0.12)'; x.fillRect(Math.random() * 128, Math.random() * 128, 6, 6); } x.strokeStyle = '#aab8cc'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 128); x.moveTo(0, i * 32); x.lineTo(128, i * 32); x.stroke(); }
      x.fillStyle = 'rgba(190,180,150,0.16)'; for (let i = 0; i < 30; i++) x.fillRect(Math.random() * 128, Math.random() * 128, 20 * Math.random(), 3); t = new THREE.CanvasTexture(c); } else { t = texLoad(n); t.userData.tex = n; t.anisotropy = aniso(); }
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.userData.keep = true; tcache[n] = t; } return tcache[n]; };
const mat = (c) => { const k = SKIN[c]; if (!k) return new THREE.MeshLambertMaterial({ color: c }); const m = new THREE.MeshLambertMaterial({ map: tex(k[0]), color: k[1] }); m.userData.tile = k[2]; return m; };
let shadeM = null; const flatG = new THREE.PlaneGeometry(1, 1); flatG.rotateX(-Math.PI / 2);
const shadeAt = (p, x, z, w, l, op = 0.42) => { if (!shadeM) shadeM = new THREE.MeshBasicMaterial({ map: tex('shade'), transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); const s = new THREE.Mesh(flatG, shadeM); s.scale.set(w, 1, l); s.position.set(x, 0.075, z); s.renderOrder = 1; s.userData.blob = true; p.add(s); return s; }; // klad 'shade': soft grounding under things
const cut = (n, c) => new THREE.MeshLambertMaterial({ map: tex(n), color: c || 0xffffff, alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide }); // leaf, creeper and grass cards
// a box whose texture keeps its real size (metres per tile), whatever the box measures
const bx = (w, h, d, c, x, y, z, g) => { const geo = new THREE.BoxGeometry(w, h, d), m = new THREE.Mesh(geo, mat(c)), tl = m.material.userData.tile;
  if (tl) { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) { const f = Math.floor(i / 4), X = p.getX(i) + x, Y = p.getY(i) + y, Z = p.getZ(i) + z; if (f < 2) uv.setXY(i, Z / tl, Y / tl); else if (f < 4) uv.setXY(i, X / tl, Z / tl); else uv.setXY(i, X / tl, Y / tl); } }
  m.position.set(x, y, z); g.add(m); return m; };
const card = (w, h, m, x, y, z, ry, g) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry || 0; g.add(o); return o; };
// a lucky cat; the arm on the viewer's right (+x) swings for the energy kind, the arm on the viewer's left (-x) for the lure kind
// a lucky cat in its own painted look (CONFIG.catStyles, by cat id); the waving paw tells the kind: energy waves the paw on its +x side, lure the other
function makeCat(c, cfg) {
  const st = cfg.catStyles[(c.id - 1) % cfg.catStyles.length], r = catMesh(Object.assign({}, st, { side: c.type === 'energy' ? 1 : -1 })), cg = r.g;
  cg.userData.arm = r.arm; cg.userData.type = c.type; cg.userData.id = c.id; return cg;
}
const LABELS = []; if (typeof window !== 'undefined') window.__labels = LABELS; // test hook: tools/drillcheck.cjs reads each label's text and canvas width
function label(text, color = '#fff', w = 3.2) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  // panel fix (Nov 17, CONFIG.ui.label): a solid dark backing and a dark outline round the letters, and the scene's tone mapping and fog leave it alone (the old 70% teal wash read about 2.7:1 on a bright sky)
  // the canvas is as wide as the measured text plus padding (at least 256 px), so no name is clipped ("ram (old gardene", coordinator 21:4x); the sprite keeps that width-to-height ratio
  const L = CONFIG.ui.label, FONT = 'bold 30px system-ui,sans-serif'; x.font = FONT; const tw = Math.ceil(x.measureText(text).width); c.width = Math.max(256, tw + 2 * L.pad + L.strokeW);
  x.font = FONT; x.fillStyle = L.bg; x.fillRect(0, 0, c.width, 64); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = L.strokeW; x.strokeStyle = L.stroke; x.strokeText(text, c.width / 2, 34); x.fillStyle = color; x.fillText(text, c.width / 2, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: true, depthWrite: false, toneMapped: false, fog: false })); s.userData.aspect = c.width / 256; s.scale.set(w * s.userData.aspect, w / 4, 1); s.renderOrder = 10; s.userData.w = w; s.userData.text = text; s.userData.textW = tw; s.userData.canvasW = c.width; LABELS.push(s); return s;
}
// the quest marks' '!' and '?' pictures, made once and kept (owner 10:50: each change made a throwaway label sprite and left its picture on the GPU)
const MARKS = {};
function markTex(ch) { if (MARKS[ch]) return MARKS[ch]; const s = label(ch, ch === '?' ? '#7ae87a' : '#ffe14a', 1.2); LABELS.splice(LABELS.indexOf(s), 1); const t = s.material.map; t.userData.keep = true; s.material.dispose(); MARKS[ch] = t; return t; }
// the base's sprite list and scratch vectors for the label pass (update)
const SPV = { b: -1, n: -1, k: 0, list: [], c: new THREE.Vector3(), w: new THREE.Vector3() };
const ROLE_COL = { hunter: 0xc0583a, gatherer: 0xc8b43a, researcher: 0x3a7ac0 };
const PATROL = { hunter: [[-15, -15], [15, -15], [15, 15], [-15, 15]], gatherer: [[-9, -8], [0, -16], [-9, -8]], researcher: [[6.0, 3.9], [9, 3.4], [9.55, 2.2], [9, 3.4]] }; // researchers walk past the workshop door (it faces the plaza since Nov 17), clear of its step and urns, and stop to read the quest board beside it

// LAG FIX Nov 19 (owner 11:27, CONFIG.lag.farStep): a villager out of view AND farther than farStep.dist m (Oko: also while you are not in the workshop) takes her motion
// steps farFrom.hz times a second with the time added up (the motion decides in fixed slices, so the same choices); in view or near, every frame as before.
// The view is the camera given by setView. Module-level temporary maths objects.
const FR = new THREE.Frustum(), FM = new THREE.Matrix4(), FS = new THREE.Sphere();
export function createBaseView(scene, cfg, marla, makeChar) {
  let buildN = 0, shadowDirty = false; const chars = {}, bakedYaw = []; // the villagers' real models, made once and kept (bram, oko, pip)
  const g = new THREE.Group(), obst = [], npcs = [];
  let save = null, scoutG = null, towers = [], t = 0, homeCats = [], hiddenCats = [], npcG = {};
  // rooms you walk into (src/rooms.js): WS = the workshop, MH = Marla's house (null when switched off); boxes = their walls and furniture you bump into; jn = Marla's journal on her desk
  const WS = roomInfo('workshop'), MH = roomInfo('marla'), ROOMS = [WS, MH].filter(Boolean), boxes = []; let jn = null;
  // the hatchery corner (src/hatchery.js, CONFIG.avians): AV = its layout or null; KEEP = rooms and the hatchery, kept clear of grass, flowers and saplings; hatch = the built corner, flock = its birds; eveT = seconds in the base (the birds roost after CONFIG.avians.evening)
  const AV = cfg.avians && cfg.avians.on ? hatchLayout(cfg) : null, KEEP = [...ROOMS, ...(AV ? [{ key: 'hatchery', x: AV.rect.x, z: AV.rect.z, ry: 0, w: AV.rect.w, d: AV.rect.d }] : [])]; let hatch = null, flock = null, eveT = 0, eveE = 0, sunL = null, sun0 = 1.9, vcats = null; // vcats: the ambient village cats (src/villagecats.js), scenery only
  const inAnyRoom = (x, z, m) => KEEP.some((I) => { const [lx, lz] = toLocal(I, x, z); return Math.abs(lx) < I.w / 2 + m && Math.abs(lz) < I.d / 2 + m; });
  const circle = (x, z, r) => obst.push({ x, z, r });
  // base water and base life (src/basevillage.js; CONFIG.baseWater, CONFIG.baseLife): life = the built stream, wheel, houses and set pieces; LIFE_KEEP = their footprints the saplings keep clear of; HEDGE_R / LIFE_KO = the hedge ring and where it opens for the stream
  let life = null; const LIFE_ANY = lifeOn(cfg) || !!(cfg.baseWater && cfg.baseWater.on), LIFE_KEEP = LIFE_ANY ? lifeReserved(cfg) : [], LIFE_KO = LIFE_ANY ? lifeKeepOut(cfg) : () => false, HEDGE_R = lifeOn(cfg) ? cfg.baseLife.hedge : 20.5;

  // LAG FIX Nov 19 (owner 11:27, CONFIG.lag.keepBase): the base is built once and kept (hidden) while you are out; a visit shows the kept base again when nothing the
  // build reads from the save has changed (keySig: recruits and roles, ring and cleared, Marla's spot, the cats, the hatchery, the seed, the recruits' plots and their
  // stage), and only the people, home, cat, quests and journal are refreshed. Anything else changed: built again as before.
  let keptSig = null, keptFog = null;
  const keySig = (sv) => { try { return JSON.stringify([(sv.personnel || []).map((p) => [p.id, p.role, p.name]), sv.ringOpen || 1, !!sv.cleared, sv.scoutSpot, (sv.cats || []).map((c) => [c.id, c.state, c.spot, c.slot]), sv.avians || null, sv.seed, plotStates(cfg, sv).map((f) => [f.k, f.stage, f.id || 0, f.role || ''])]); } catch (e) { return null; } };
  // LAG FIX Nov 19 (owner 11:27, CONFIG.lag.mergeBase): the base's still pieces drawn as one mesh per material and ground cell (src/mergestatic.js; the pieces stay as
  // invisible stand-ins). Left alone: anything that moves, turns, shows or hides on its own (people, Marla, cats, towers, the journal, labels, the hatchery, flock,
  // village cats, base life), every piece with its own data or draw hook, see-through pieces, the sky and ground, and the pieces the opening film hides one by one
  // round the plant inside the door (CONFIG.opening.wake.hide). Called after the small-shadow pass (src/main.js), once per build.
  function mergeStill() { const M = cfg.lag && cfg.lag.mergeBase; if (!M || !M.on || g.userData.merged) return 0; g.userData.merged = true; g.updateMatrixWorld(true);
    const off = new Set([scoutG, sky.mesh, ...npcs.map((o) => o.n), ...Object.values(npcG), ...hiddenCats.map((o) => o.cg), ...homeCats.map((h) => h.cg), ...towers, jn && jn.ribbon, jn && jn.glow].filter(Boolean));
    const H = cfg.opening && cfg.opening.wake && cfg.opening.wake.hide, v = new THREE.Vector3(), base = THREE.Object3D.prototype.onBeforeRender;
    const skip = (o) => { if (Object.keys(o.userData).length || o.onBeforeRender !== base) return true; for (let p = o; p && p !== g; p = p.parent) if (off.has(p) || (p !== o && Object.keys(p.userData).length)) return true;
      if (H) { o.getWorldPosition(v); if (Math.hypot(v.x - H[0], v.z - H[1]) < H[2] + M.hidePad) return true; } return false; };
    // the base makes a new material for nearly every box; pieces whose materials are alike in every setting share one first (so they can be drawn together); a material
    // with its own shader hook or data stays its own. A replaced material no other piece uses is freed.
    const users = new Map(), canon = new Map(), hook = THREE.Material.prototype.onBeforeCompile, tk = (t) => (t ? (t.source ? t.source.uuid : t.uuid) + ':' + t.repeat.x + ',' + t.repeat.y + ',' + t.offset.x + ',' + t.offset.y + ',' + t.rotation + ',' + t.wrapS + ',' + t.wrapT + ',' + t.colorSpace + ',' + t.flipY : '');
    const mk = (m) => (m.onBeforeCompile !== hook || Object.keys(m.userData).some((k) => k !== 'tile' && k !== 'pbr' && k !== 'relief') ? null : [m.type, m.color ? m.color.getHex() : '', m.emissive ? m.emissive.getHex() : '', m.emissiveIntensity, tk(m.map), tk(m.normalMap), m.normalScale ? m.normalScale.x : '', m.roughness, m.metalness, m.envMapIntensity, m.transparent, m.opacity, m.side, m.alphaTest, m.vertexColors, m.flatShading, m.fog, m.depthWrite, m.depthTest, m.toneMapped, m.userData.tile].join('|'));
    g.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) users.set(o.material, (users.get(o.material) || 0) + 1); });
    g.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || skip(o)) return; const k = mk(o.material); if (!k) return; const c = canon.get(k); if (!c) { canon.set(k, o.material); return; } if (c === o.material) return;
      const old = o.material; o.material = c; const n = users.get(old) - 1; users.set(old, n); if (n <= 0) old.dispose(); });
    return mergeStatic(g, null, true, { transparent: false, skip, cell: M.cell }); }
  let snap0 = [], sunC0 = 0;
  function reuse(sv) {
    save = sv; scene.add(g); if (keptFog) scene.fog = keptFog; eveT = 0; shadowDirty = true;
    // (owner 13:10, premortem A) everything a rebuild used to reset: the pieces back where the build left them (a piece moved to another parent since keeps its new
    // place), the sun as built, the stream's flow and the wheel from their start, the village cats' wander state started over
    for (const [o, p, q, k] of snap0) if (o.parent) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(k); }
    if (sunL) { sunL.intensity = sun0; sunL.color.setHex(sunC0); }
    if (life && life.water && life.water.reset) life.water.reset();
    // (H round 2: making the cats again cost 377 ms at Enter, "mergeAttributes < makeCat < createVillageCats < reuse") their wander state is reset instead
    if (vcats) vcats.reset();
    // the kept pieces point at this save's own records (a cat found or a recruit's role is written to the save the game keeps)
    for (const h of hiddenCats) { const c = (sv.cats || []).find((x) => x.id === h.c.id); if (c) h.c = c; h.cg.visible = h.c.state === 'hidden'; }
    // the recruits start their rounds again where a fresh build puts them, each person restarted (as a fresh build does)
    for (const o of npcs) { const p = (sv.personnel || []).find((x) => x.id === o.p.id); if (p) o.p = p; o.i = o.i0; o.n.position.set(o.wp[o.i0][0], 0, o.wp[o.i0][1]); o.n.rotation.set(0, 0, 0); o.facc = 0; if (o.ch && o.ch.restart && o.ch.root.parent === o.n) o.ch.restart(); }
    // Marla back at her spot (she walks the street with you while you are out)
    if (marla && scoutG) marla.whenReady(() => { if (!scoutG || !g.parent) return; shadowDirty = true; if (scoutG.userData.stand) scoutG.remove(scoutG.userData.stand); marla.root.position.set(0, 0, 0); marla.root.rotation.set(0, 0, 0); scoutG.add(marla.root); });
    // the villagers' own turn-to-you and work-loop state starts over, as their nodes did in a fresh build (owner 12:49)
    for (const n of Object.values(NPCS)) { const o = npcG[n.id]; if (o) { o.wt = 0; o.work = undefined; o.near = false; o.away = 0; o.lpx = null; o.lpz = null; o.facc = 0; } }
    refreshNpcs(); refreshHome(); refreshJournal(); refreshAvians();
  }
  // the recruits' nodes (owner 11:27: also rebuilt alone, recruitsChanged)
  // base life (src/basevillage.js) with what it adds kept apart (lifeKids: its groups in g; lifeObst: its boxes and circles), so it can be built again alone
  let lifeKids = [], lifeObst = [], lifeGround = null;
  // addLifeIter: the same in parts (the sliced base build); addLife runs it at once (a recruit's change, a kept base)
  function* addLifeIter() { const n0 = g.children.length, b0 = boxes.length, o0 = obst.length; life = yield* buildBaseLifeIter(g, cfg, HIBASE, save, lifeGround); if (life) { for (const q of life.solids) boxes.push(q); for (const [x, z, rr] of life.circles) circle(x, z, rr); }
    lifeKids = g.children.slice(n0); lifeObst = [...boxes.slice(b0), ...obst.slice(o0)]; for (const c of lifeKids) c.userData.noMerge = true; }
  function addLife() { const it = addLifeIter(); while (!it.next().done); }
  // a recruit joined or changed role: only the recruits' nodes and the base life (where their plot houses stand) are built again, not the whole base. The base life is
  // one merged build (every house, plot, sign and plant share a few meshes per material, one random stream and one sign texture with every name), so it is built
  // again as a whole; the stations, rooms, scenery, hedge, Marla and the cats stay.
  function recruitsChanged(sv) { if (!keptSig || !g.parent) { build(sv); return; } save = sv;
    // freed as freeAll frees (every texture slot, shared and kept ones left), the recruits' labels taken off the label list
    const dropT = (o) => { o.traverse((q) => { if (q.userData.keep) return; if (q.isLight && q.shadow && q.shadow.map) q.shadow.dispose(); if (q.geometry && !(q.geometry.userData && q.geometry.userData.shared)) q.geometry.dispose(); for (const m of q.material ? (Array.isArray(q.material) ? q.material : [q.material]) : []) { if (!m || (m.userData && m.userData.shared)) continue; for (const k in m) { const t = m[k]; if (t && t.isTexture && !(t.userData && (t.userData.shared || t.userData.keep))) t.dispose(); } m.dispose(); } if (q.isSprite) { const i = LABELS.indexOf(q); if (i >= 0) LABELS.splice(i, 1); } }); };
    for (const o of npcs) { if (o.ch && o.ch.root.parent === o.n) o.n.remove(o.ch.root); g.remove(o.n); dropT(o.n); } npcs.length = 0;
    for (const c of lifeKids) { g.remove(c); dropT(c); } { const gone = new Set(lifeObst); for (const a of [boxes, obst]) { const k = a.filter((q) => !gone.has(q)); a.length = 0; a.push(...k); } }
    startPlants(cfg, HIBASE); addLife(); addRecruits(buildN); shadowDirty = true; keptSig = keySig(sv);
    // the shadow settings the build gives (see 'static shadows' in build): the base life casts and takes shadows, the recruits only take them
    const rule = (o, cast) => { if (!o.isMesh || o === sky.mesh || o.isSkinnedMesh || o.userData.blob || o.userData.scenery) return; o.receiveShadow = !o.material.transparent; o.castShadow = cast && !o.material.transparent; };
    for (const c of lifeKids) c.traverse((o) => rule(o, true)); for (const q of npcs) q.n.traverse((o) => rule(o, false)); }
  function addRecruits(tok) {
    for (const p of save.personnel) {
      const n = new THREE.Group(), stand = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.2, 8), mat(ROLE_COL[p.role] || 0xaaaaaa)); body.position.y = 0.8; stand.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(0xe0b890)); head.position.y = 1.65; stand.add(head); n.add(stand);
      // every recruit is their own person: one of the nine recruit models (gen1..gen9) by the order they joined; a soft blob is their shadow as they walk
      const key = 'gen' + cfg.base.recruitOrder[(p.id - 1) % Math.min(cfg.base.recruitModels, cfg.base.recruitOrder.length)], ch = makeChar ? (chars[key] || (chars[key] = makeChar(key))) : null;
      // a person kept from the last build starts over (restart): the same motion as on a fresh page, whatever it did before
      if (ch) ch.whenReady(() => { if (tok !== buildN) return; n.remove(stand); n.rotation.set(0, 0, 0); ch.root.position.set(0, 0, 0); if (ch.restart) ch.restart(); ch.root.traverse((o) => { o.castShadow = false; }); n.add(ch.root); });
      { const bl = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })); bl.rotation.x = -Math.PI / 2; bl.position.y = 0.035; bl.userData.blob = true; n.add(bl); }
      const lab = label(p.name + ' (' + p.role + ')', '#fff', 2.6); lab.position.y = 2.4; lab.userData.kind = 'npc'; n.add(lab);
      const crate = bx(0.4, 0.3, 0.4, 0xb08a4a, 0, 1.05, 0.4, n); crate.visible = p.role === 'researcher';
      const wp = p.role === 'hunter' && cfg.baseWater && cfg.baseWater.on && cfg.baseLife && cfg.baseLife.rounds ? [PATROL.hunter[0], PATROL.hunter[1], ...cfg.baseLife.rounds, PATROL.hunter[2], PATROL.hunter[3]] : PATROL[p.role] || PATROL.hunter, i = p.id % wp.length; n.position.set(wp[i][0], 0, wp[i][1]);
      g.add(n); npcs.push({ n, p, wp, i, i0: i, crate, ch });
    }
  }
  // LAG FIX Nov 19 (owner 12:45): the build is a generator that stops (yield) between its parts, so it can run in time slices in the background (bgStart / bgStep,
  // CONFIG.lag.slice) while the title idles; build() runs what is left of it at once (Enter, the film) or the whole of it as before
  function* buildIter(sv) {
    const sig = cfg.lag && cfg.lag.keepBase ? keySig(sv) : null; if (sig && sig === keptSig && g.children.length) { reuse(sv); return; }
    keptSig = null; const tok = ++buildN; // a model that finishes loading after this base is gone must not be pulled back into it (Marla is on the street then)
    save = sv; freeAll(); g.clear(); g.userData.merged = false; g.userData.drawn = false; obst.length = 0; npcs.length = 0; towers = []; boxes.length = 0; jn = null; life = null; startPlants(cfg, HIBASE); hatch = null; flock = null; eveT = 0; vcats = null;
    const gt = tex('grass').clone(); gt.repeat.set(34, 34); gt.needsUpdate = true; const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshLambertMaterial({ map: gt, color: 0xc4ec9a })); ground.rotation.x = -Math.PI / 2; g.add(ground);
    const pt = tex('block').clone(); pt.repeat.set(7, 7); pt.needsUpdate = true; const plaza = new THREE.Mesh(new THREE.CircleGeometry(12, 32), new THREE.MeshLambertMaterial({ map: pt, color: 0xf6e8c0 })); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; g.add(plaza);
    // stations
    const st = STATIONS;
    const vineM = cut('vine', 0xd8f0c0), tuftM = cut('tuft', 0xd0f0a0), canM = cut('canopy', 0xc8f0a8), canD = cut('canopy', 0x9cc880);
    // greenery has no box inside it: a rounded leafy mound, with leaf cards over it
    const mound = (x, y, z, sx, sy, sz, c, ry) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry || 0; g.add(m); return m; };
    const flM = [0xffc0d4, 0xffe9a0, 0xffffff, 0xd8c0ff, 0xffc8a0].map((c) => cut('flowers', c));
    // leaves breaking up a box of greenery (hedge, bush, pot plant): leaf cards scattered over its top and sides
    const leafy = (x, y, z, w, h, d, n, ry, sd) => { let q = sd || 7; const rn = () => ((q = (q * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff), c = Math.cos(ry || 0), s2 = Math.sin(ry || 0);
      for (let k = 0; k < n; k++) { const top = rn() < 0.55, lx = (rn() - 0.5) * w * (top ? 1 : 1.1), lz = top ? (rn() - 0.5) * d : (rn() < 0.5 ? -1 : 1) * d * 0.5, ly = top ? h * 0.5 : (rn() - 0.3) * h * 0.6, sz = 0.7 + rn() * 0.7, o = card(sz, sz, k % 3 ? canM : canD, x + lx * c + lz * s2, y + ly, z - lx * s2 + lz * c, rn() * 3, g); o.rotation.x = (rn() - 0.5) * 1.2; } };
    // a station house: white plaster walls that have weathered, a barrel roof that is a garden on one side and leaf-shaped solar cells on the sunny side,
    // an arched glazed door, round windows that glow, a ceramic plinth. (No comments inside the long lines below: a comment there cuts off the rest of the line.)
    const house = (s, col, roof) => {
      bx(5, 3, 4, col, s.x, 1.5, s.z, g); bx(5.2, 0.3, 4.2, 0x5a3d28, s.x, 0.15, s.z, g); shadeAt(g, s.x, s.z, cfg.depth.baseHouse[0], cfg.depth.baseHouse[1]);
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 5.5, 18, 1, false, 0, Math.PI), mat(0x4aa84a)); vault.material.side = THREE.DoubleSide; vault.rotation.z = Math.PI / 2; vault.scale.set(0.6, 1, 1); vault.position.set(s.x, 3.0, s.z); g.add(vault);
      for (const sx of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(2.25, 18, 0, Math.PI), mat(col)); end.scale.y = 0.6; end.position.set(s.x + sx * 2.75, 3.0, s.z); end.material.side = THREE.DoubleSide; end.rotation.y = sx * Math.PI / 2; g.add(end); }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) { const a = 0.35 + r * 0.38, pg = new THREE.Group(); pg.position.set(s.x - 2.25 + c * 0.75 + (r % 2) * 0.37, 3.0 + Math.sin(a) * 2.25 * 0.6 + 0.03, s.z - Math.cos(a) * 2.25); pg.rotation.x = -(Math.PI / 2 - a) - 0.5; g.add(pg); petal(pg, 0.95, 0.62, BM.cell); }
      for (let k = 0; k < 6; k++) for (let c = 0; c < 2; c++) card(1.0, 0.9, flM[(k + (s.x > 0 ? 2 : 0)) % 5], s.x - 2.2 + k * 0.85 + (c ? 0.2 : 0), 4.2 - Math.abs(k - 2.5) * 0.03, s.z + 0.9 + (c ? 0.25 : 0), c * 1.57 + k * 0.7, g);
      bx(1.1, 2.0, 0.08, 0x3f8f6a, s.x, 1.0, s.z + 2.03, g); const dtop = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14, 0, Math.PI), mat(0x3f8f6a)); dtop.position.set(s.x, 2.0, s.z + 2.07); g.add(dtop);
      g.add(stem([[s.x - 0.62, 0, s.z + 2.08], [s.x - 0.62, 2.0, s.z + 2.08], [s.x - 0.42, 2.48, s.z + 2.08], [s.x, 2.66, s.z + 2.08], [s.x + 0.42, 2.48, s.z + 2.08], [s.x + 0.62, 2.0, s.z + 2.08], [s.x + 0.62, 0, s.z + 2.08]], 0.05, BM.verdigris));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), BM.glow(BLOOM.glowPower)); knob.position.set(s.x + 0.35, 1.05, s.z + 2.1); g.add(knob);
      for (const wx of [-1.7, 1.7]) { const gl = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), BM.glow(0xffe9b0)); gl.position.set(s.x + wx, 1.8, s.z + 2.02); g.add(gl); const pane = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), BM.glass); pane.position.set(s.x + wx, 1.8, s.z + 2.04); g.add(pane); const fr = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.045, 6, 22), BM.verdigris); fr.position.set(s.x + wx, 1.8, s.z + 2.05); g.add(fr); g.add(stem([[s.x + wx - 0.46, 1.8, s.z + 2.06], [s.x + wx, 1.9, s.z + 2.06], [s.x + wx + 0.46, 1.8, s.z + 2.06]], 0.018, BM.verdigris)); halo(g, s.x + wx, 1.8, s.z + 2.2, 1.3, 0xffe0a0); }
      card(2.2, 2.6, vineM, s.x - 2.52, 1.5, s.z + 0.4, Math.PI / 2, g); card(1.8, 2.2, vineM, s.x + 2.52, 1.3, s.z - 0.6, Math.PI / 2, g); card(2.4, 2.4, vineM, s.x + 0.8, 1.4, s.z - 2.02, 0, g); // creepers on the side and back walls
      for (let k = 0; k < 7; k++) card(0.9, 0.6, tuftM, s.x - 2.6 + k * 0.85, 0.3, s.z + 2.12 + (k % 2) * 0.1, (k % 3) * 0.3, g); // grass at the foot of the wall
      if (HIBASE) vaultHi(g, { x: s.x, z: s.z, w: 5, d: 4, h: 3, R: 2.25, k: 0.6, front: 1, door: [0, 1.1, 2.0], windows: [[-1.7, 1.8, 0.46], [1.7, 1.8, 0.46]] });
      circle(s.x, s.z, 2.9); const l = label(s.name, '#fff'); l.position.set(s.x, 4.6, s.z); l.userData.kind = 'station'; g.add(l); };
    yield;
    // a room you walk into (src/rooms.js): the station house's look (plaster walls, a barrel vault that is a garden on one side and solar petals on the other, round windows that glow),
    // with an arched doorway you walk through, walls you bump into (boxes, not one circle round the house), a plank floor and a dressed room inside (phones: workshopLow / marlaLow;
    // desktop: the DENSITY pass of src/basehi.js with workshopHi / marlaHi). Built in the room's own frame (door at +z), turned and placed by its group.
    const vaultRoom = (I, col, lab, labCol, Lt) => {
      const rg = new THREE.Group(); rg.position.set(I.x, 0, I.z); rg.rotation.y = I.ry; g.add(rg);
      const hw = I.w / 2, hd = I.d / 2, tw = I.t, h = I.h, rw = I.dw / 2, R = I.R, kk = I.k;
      bx(I.w, h, tw, col, 0, h / 2, -hd + tw / 2, rg); bx(tw, h, I.d - 2 * tw, col, -hw + tw / 2, h / 2, 0, rg); bx(tw, h, I.d - 2 * tw, col, hw - tw / 2, h / 2, 0, rg);
      { const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(-rw, 0); sh.lineTo(-rw, I.dh); sh.absarc(0, I.dh, rw, Math.PI, 0, true); sh.lineTo(rw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, h); sh.lineTo(-hw, h); sh.lineTo(-hw, 0);
        const fg = new THREE.ExtrudeGeometry(sh, { depth: tw, bevelEnabled: false, curveSegments: 18 }), uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.6, uv.getY(i) / 2.6); fg.translate(0, 0, hd - tw); rg.add(new THREE.Mesh(fg, mat(col))); }
      bx(I.w + 0.2, 0.3, tw + 0.1, 0x5a3d28, 0, 0.15, -hd + tw / 2 - 0.05, rg); for (const sx of [-1, 1]) { bx(tw + 0.1, 0.3, I.d + 0.2, 0x5a3d28, sx * (hw - tw / 2 + 0.05), 0.15, 0, rg); bx(hw - rw + 0.1, 0.3, tw + 0.1, 0x5a3d28, sx * ((hw + rw) / 2 + 0.05), 0.15, hd - tw / 2 + 0.05, rg); }
      bx(I.w - 2 * tw, I.floor, I.d - 2 * tw, 0x8a6a3a, 0, I.floor / 2, 0, rg); bx(I.dw, I.floor, tw, 0x8a6a3a, 0, I.floor / 2, hd - tw / 2, rg);
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(R, R, I.w + 0.5, 18, 1, false, 0, Math.PI), mat(0x4aa84a)); vault.material.side = THREE.DoubleSide; vault.rotation.z = Math.PI / 2; vault.scale.set(kk, 1, 1); vault.position.set(0, h, 0); rg.add(vault);
      for (const sx of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(R, 18, 0, Math.PI), mat(col)); end.scale.y = kk; end.position.set(sx * (hw + 0.25), h, 0); end.material.side = THREE.DoubleSide; end.rotation.y = sx * Math.PI / 2; rg.add(end); }
      const nc = Math.floor((I.w - 0.5) / 0.75) + 1; for (let r = 0; r < 3; r++) for (let c = 0; c < nc; c++) { const a = 0.35 + r * 0.38, pg = new THREE.Group(); pg.position.set(-hw + 0.25 + c * 0.75 + (r % 2) * 0.37, h + Math.sin(a) * R * kk + 0.03, -Math.cos(a) * R); pg.rotation.x = -(Math.PI / 2 - a) - 0.5; rg.add(pg); petal(pg, 0.95, 0.62, BM.cell); }
      const nf = Math.floor((I.w - 0.6) / 0.85) + 1, fy = h + Math.sqrt(Math.max(0, 1 - (0.9 / R) * (0.9 / R))) * R * kk - 0.04; for (let k = 0; k < nf; k++) for (let c = 0; c < 2; c++) card(1.0, 0.9, flM[(k + 2) % 5], -hw + 0.3 + k * 0.85 + (c ? 0.2 : 0), fy - Math.abs(k - nf / 2) * 0.03, 0.9 + (c ? 0.25 : 0), c * 1.57 + k * 0.7, rg);
      { const pts = [[-rw - 0.07, 0, hd + 0.03], [-rw - 0.07, I.dh, hd + 0.03]]; for (let k = 1; k < 8; k++) { const a = Math.PI - k / 8 * Math.PI; pts.push([Math.cos(a) * (rw + 0.07), I.dh + Math.sin(a) * (rw + 0.07), hd + 0.03]); } pts.push([rw + 0.07, I.dh, hd + 0.03], [rw + 0.07, 0, hd + 0.03]); rg.add(stem(pts, 0.05, BM.verdigris)); }
      const dense = HIBASE && densityOn() && densityOn().base && densityOn().base.more;
      for (const [wx, wy, wr] of I.windows) { const gl = new THREE.Mesh(new THREE.CircleGeometry(wr, 20), BM.glow(0xffe9b0)); gl.position.set(wx, wy, hd + 0.02); rg.add(gl); const pane = new THREE.Mesh(new THREE.CircleGeometry(wr, 20), BM.glass); pane.position.set(wx, wy, hd + 0.04); rg.add(pane); const fr = new THREE.Mesh(new THREE.TorusGeometry(wr + 0.01, 0.045, 6, 22), BM.verdigris); fr.position.set(wx, wy, hd + 0.05); rg.add(fr);
        if (!dense) { const gi = new THREE.Mesh(new THREE.CircleGeometry(wr * 0.95, 20), BM.glow(0xffe9b0)); gi.position.set(wx, wy, hd - tw - 0.012); gi.rotation.y = Math.PI; rg.add(gi); } }
      card(Math.min(2.2, I.d - 0.6), 2.4, vineM, -hw - 0.02, 1.4, 0.3, Math.PI / 2, rg); card(1.8, 2.2, vineM, hw + 0.02, 1.3, -0.5, Math.PI / 2, rg); card(2.4, 2.3, vineM, 0.8, 1.35, -hd - 0.02, 0, rg);
      for (let k = 0; k < 7; k++) { const x = -hw - 0.1 + k * (I.w + 0.2) / 6; if (Math.abs(x) > rw + 0.2) card(0.9, 0.6, tuftM, x, 0.3, hd + 0.12 + (k % 2) * 0.1, (k % 3) * 0.3, rg); }
      const L = (HIBASE ? Lt.high : Lt.low); if (L && L[1] > 0) { const lamp = new THREE.PointLight(L[0], L[1], L[2]); lamp.position.set(0, h - 0.35, 0); rg.add(lamp); }
      if (HIBASE) { vaultHi(rg, { x: 0, z: 0, w: I.w, d: I.d, h, R, k: kk, front: 1, open: true, room: I.key, word: I.word, seed: I.seed, lampX: false, noBench: I.key !== 'workshop', flue: I.key === 'marla' ? [-0.6, -1.32] : undefined, door: [0, I.dw, I.dh], windows: I.windows, inside: dense ? (c) => (I.key === 'workshop' ? workshopHi : marlaHi)(c, I) : null });
        if (rg.userData.densityB) Object.assign(g.userData.densityB || (g.userData.densityB = {}), rg.userData.densityB); }
      if (!dense) { const lin = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.05, R - 0.05, I.w - 2 * tw, 16, 1, true, 0, Math.PI), mat(0x8a5a3a)); lin.material.side = THREE.DoubleSide; lin.rotation.z = Math.PI / 2; lin.scale.set(kk, 1, 1); lin.position.set(0, h, 0); rg.add(lin);
        // the vault's ends closed from inside at the walls (phones saw a sliver of the green roof's underside above the side walls)
        for (const sx of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(R - 0.04, 16, 0, Math.PI), mat(col)); cap.material.side = THREE.DoubleSide; cap.scale.y = kk; cap.position.set(sx * (hw - tw - 0.005), h, 0); cap.rotation.y = sx * Math.PI / 2; rg.add(cap); }
        (I.key === 'workshop' ? workshopLow : marlaLow)(rg, I); }
      for (const q of roomSolids(I).reverse()) boxes.push({ I, cx: q[0], cz: q[1], hx: q[2], hz: q[3] });
      const l = label(lab, labCol); l.position.set(I.x, h + R * kk + 0.9, I.z); l.userData.kind = 'station'; g.add(l);
      return rg; };
    house(st.storage, 0x4a8f8a, 0x2f4f9a); if (WS) vaultRoom(WS, 0xb08a4a, 'Workshop', '#fff', cfg.workshop.light); else house(st.workshop, 0xb08a4a, 0x2f4f9a);
    yield;
    // Marla's house (owner Nov 16 23:35): her journal lies on the desk; a ribbon and a warm glow show while a line is unread (refreshJournal)
    if (MH) { const rg = vaultRoom(MH, 0x9a8a6a, "Marla's place", '#ffd080', cfg.marlaHouse.light), dk = cfg.marlaHouse.desk, y = MH.floor + 0.785, jg = new THREE.Group(); jg.position.set(dk[0], y, dk[1]); jg.rotation.y = 0.18; rg.add(jg);
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.32), new THREE.MeshLambertMaterial({ color: 0x5a3424 })); cover.position.y = 0.0175; jg.add(cover); const pages = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.025, 0.305), new THREE.MeshLambertMaterial({ color: 0xf0e6cc })); pages.position.set(0.006, 0.018, 0); jg.add(pages);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.038, 0.33), new THREE.MeshLambertMaterial({ color: 0x3a2018 })); strap.position.set(0.07, 0.018, 0); jg.add(strap);
      const ribbon = new THREE.Group(), rm = new THREE.MeshLambertMaterial({ color: 0xc0302a, emissive: 0x401008 }); { const a = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.1), rm); a.position.set(-0.05, 0.037, 0.13); ribbon.add(a); const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.004), rm); b2.position.set(-0.05, -0.008, 0.182); b2.rotation.x = 0.15; ribbon.add(b2); } jg.add(ribbon);
      const glow = halo(jg, 0, 0.12, 0, cfg.marlaHouse.ribbon[1], 0xffc871); glow.material.opacity = Math.min(1, glow.material.opacity * cfg.marlaHouse.ribbon[0]); glow.userData.kind = 'mark';
      jn = { ribbon, glow, at: toWorld(MH, dk[0], dk[1]) }; refreshJournal(); }
    // garden: planters
    for (let i = 0; i < 4; i++) bx(1.6, 0.5, 1.6, 0x5a3d28, st.garden.x - 2.4 + i * 1.6, 0.25, st.garden.z, g), bx(1.44, 0.06, 1.44, 0x4a3a2a, st.garden.x - 2.4 + i * 1.6, 0.5, st.garden.z, g), [0, 1, 2, 3, 4, 5].forEach((k) => card(0.8 + (i % 2) * 0.3, 0.7 + (i % 3) * 0.25, [tuftM, vineM, flM[1], canM][i], st.garden.x - 2.4 + i * 1.6 + ((k % 3) - 1) * 0.42, 0.85 + (i % 3) * 0.1, st.garden.z + (k < 3 ? -0.3 : 0.3), k * 0.9 + i, g)); // soil and a different crop in each planter
    circle(st.garden.x, st.garden.z, 2.6); { const l = label('Garden', '#fff'); l.position.set(st.garden.x, 2.6, st.garden.z); l.userData.kind = 'station'; g.add(l); }
    // quest board, beside the Workshop's door (owner Nov 17 15:59): built in its own frame (x along the board, +z its painted face), turned to face the plaza; a solar petal shades it,
    //   leaning back away from the plaza so it stays clear of the workshop's vault; you bump into its footprint (BOARD_BOX) instead of a round disc
    { const bg = new THREE.Group(); bg.position.set(st.board.x, 0, st.board.z); bg.rotation.y = boardYaw(); g.add(bg);
      for (const sx of [-1, 1]) { const po = lathe([[0.0, 0], [0.16, 0.02], [0.1, 0.2], [0.07, 2.2], [0.1, 2.34]], BM.ceramic, bg, 10); po.position.set(sx * 1.0, 0, 0); const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), BM.glow(BLOOM.glowPower)); l.position.set(sx * 1.0, 2.42, 0); bg.add(l); halo(bg, sx * 1.0, 2.42, 0, 0.5, BLOOM.glowPower); }
      bg.add(stem([[-1.0, 2.3, 0], [-0.5, 2.6, 0], [0, 2.7, 0], [0.5, 2.6, 0], [1.0, 2.3, 0]], 0.05, BM.verdigris));
      const glow2 = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.2), BM.glow(0xfff0c8)); glow2.position.set(0, 1.65, 0); glow2.material.side = THREE.DoubleSide; bg.add(glow2); for (const z of [-0.03, 0.03]) { const gp = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.3), BM.glass); gp.position.set(0, 1.65, z); gp.material.side = THREE.DoubleSide; bg.add(gp); }
      for (const [nx, ny, c] of [[-0.55, 1.9, 0xf4ecd0], [0.05, 1.75, 0xdff0d8], [0.55, 1.95, 0xf4ecd0], [-0.25, 1.4, 0xf8dcd0], [0.45, 1.4, 0xf4ecd0]]) { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); n.position.set(nx, ny, 0.05); n.rotation.z = (nx * 7 % 1 - 0.5) * 0.2; bg.add(n); }
      for (const sx of [-1, 1]) bg.add(stem([[sx * 0.75, 0, -0.32], [sx * 0.8, 1.9, -0.36], [sx * 0.6, 2.85, -0.42], [sx * 0.22, 3.1, -0.5]], 0.045, BM.verdigris));
      { const yaw = new THREE.Group(); yaw.position.set(0, 3.12, -0.45); yaw.rotation.y = Math.PI; bg.add(yaw); const pg = new THREE.Group(); pg.rotation.x = 1.25; yaw.add(pg); petal(pg, 1.9, 1.5, BM.cell);
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), BM.glow(BLOOM.glowPower)); c.position.set(0, 3.1, -0.45); bg.add(c); halo(bg, 0, 3.1, -0.45, 0.7, BLOOM.glowPower); }
      boxes.push({ I: { x: st.board.x, z: st.board.z, ry: bg.rotation.y }, cx: 0, cz: -0.12, hx: BOARD_BOX[0], hz: BOARD_BOX[1] }); }
    { const l = label('Quest board', '#ffe9a0'); l.position.set(st.board.x, 3.1, st.board.z); l.userData.kind = 'station'; g.add(l); }
    yield;
    // scenery that doubles as cat cover: water tank, big tree, solar racks, wind tower, bushes
    { const tx = CAT_SPOTS[0].x, tz = CAT_SPOTS[0].z, tk = lathe([[0.0, 0.3], [0.7, 0.34], [1.05, 0.8], [1.12, 1.5], [0.95, 2.2], [0.6, 2.6], [0.5, 2.75], [0.62, 2.82]], BM.ceramic, g, 20); tk.position.set(tx, 0, tz);
      for (const [y, r] of [[1.15, 1.1], [1.75, 1.08]]) { const w = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 30), BM.glow(0x7fe8ff)); w.rotation.x = Math.PI / 2; w.position.set(tx, y, tz); g.add(w); } const wb = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.12, 0.56, 24, 1, true), new THREE.MeshPhongMaterial({ color: 0x6fd8f0, transparent: true, opacity: 0.55, shininess: 120, specular: 0xffffff, side: THREE.DoubleSide })); wb.position.set(tx, 1.45, tz); g.add(wb);
      for (let k = 0; k < 3; k++) { const a = k * 2.094; g.add(stem([[tx + Math.cos(a) * 0.6, 0.4, tz + Math.sin(a) * 0.6], [tx + Math.cos(a) * 0.95, 0.25, tz + Math.sin(a) * 0.95], [tx + Math.cos(a) * 1.05, 0.03, tz + Math.sin(a) * 1.05]], 0.07, BM.verdigris)); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 6, 20), BM.copper); ring.rotation.x = Math.PI / 2; ring.position.set(tx, 2.76, tz); g.add(ring); card(1.6, 2.2, vineM, tx - 0.2, 1.4, tz + 1.14, 0.1, g); card(1.3, 1.8, vineM, tx + 1.12, 1.2, tz, Math.PI / 2, g); halo(g, tx, 1.45, tz, 3.2, 0x7fe8ff); circle(tx, tz, 1.3); }
    // desktop scenery (src/scenehi.js): the tree is drawn there (trunk and a crown of leaf clusters); its spot and collision stay here
    const sceneTrees = [];
    const tree = (x, z, s) => { if (SCENERY) { sceneTrees.push({ x, z, s }); circle(x, z, 0.8 * s); return; } let q = Math.abs(Math.round(x * 31 + z * 17)) + 3; const rn = () => ((q = (q * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); // trunk, a few limbs, and a crown of leaf cards: each tree's own shape from its place
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.42 * s, 3.2 * s, 8), mat(0x6a4a2a)); tr.position.set(x, 1.6 * s, z); g.add(tr);
      for (let k = 0; k < 5; k++) { const a = k * 1.26 + rn(), l = (1.2 + rn()) * s, b = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.1 * s, l, 5), mat(0x6a4a2a)); b.position.set(x + Math.cos(a) * l * 0.35, (2.6 + rn() * 0.8) * s, z + Math.sin(a) * l * 0.35); b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(b); }
      for (let k = 0; k < 16; k++) { const a = rn() * 6.28, r = rn() * 2.1 * s, y = (3.0 + rn() * 2.4) * s, sz = (1.7 + rn() * 1.3) * s; for (let c = 0; c < 2; c++) { const o = card(sz, sz, k % 3 ? canM : canD, x + Math.cos(a) * r, y, z + Math.sin(a) * r, rn() * 3 + c * 1.57, g); o.rotation.x = (rn() - 0.5) * 0.9; } }
      circle(x, z, 0.8 * s); };
    tree(CAT_SPOTS[1].x, CAT_SPOTS[1].z, 1.8); tree(-17, 14, 1.2); tree(17, 12, 1.3); tree(-18, -3, 1);
    for (let i = 0; i < 3; i++) { const f = collectorV2(); if (HIBASE) detailDevice(f); f.scale.setScalar(2.1 + (i % 2) * 0.35); f.position.set(CAT_SPOTS[2].x + i * 2.7 - 2.7, 0, CAT_SPOTS[2].z); f.rotation.y = i * 1.1; g.add(f); circle(CAT_SPOTS[2].x + i * 2.7 - 2.7, CAT_SPOTS[2].z, 1.2); }
    const tower = (x, z) => { const m = lathe([[0.0, 0], [0.5, 0.03], [0.36, 0.3], [0.22, 1.5], [0.15, 6.9], [0.2, 7.05]], BM.ceramic, g, 12); m.position.set(x, 0, z); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 6, 24), BM.glow(BLOOM.glowPower)); rg.rotation.x = Math.PI / 2; rg.position.set(x, 0.1, z); g.add(rg);
      for (const y of [1.6, 4.2]) { const c = new THREE.Mesh(new THREE.TorusGeometry(y < 2 ? 0.23 : 0.19, 0.02, 6, 16), BM.copper); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); g.add(c); }
      const bl = new THREE.Group(); for (let k = 0; k < 3; k++) { const yaw = new THREE.Group(); yaw.rotation.z = (k * Math.PI * 2) / 3; bl.add(yaw); const pg = new THREE.Group(); pg.position.y = 0.2; pg.rotation.y = 0.35; yaw.add(pg); petal(pg, 3.1, 0.8, BM.ceramic2); const in2 = new THREE.Group(); in2.position.set(0, 0.25, 0.03); pg.add(in2); petal(in2, 2.2, 0.42, BM.cell); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), BM.glow(BLOOM.glowPower)); tip.position.set(0, 3.1, 0.06); pg.add(tip); }
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), BM.glow(BLOOM.glowPower)); bl.add(hub); const hg = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), BM.glass); bl.add(hg); bl.position.set(x, 7.05, z + 0.4); g.add(bl); towers.push(bl); g.add(stem([[x, 6.9, z], [x, 7.1, z + 0.15], [x, 7.05, z + 0.4]], 0.07, BM.verdigris)); circle(x, z, 0.6); };
    tower(CAT_SPOTS[3].x, CAT_SPOTS[3].z); tower(-4, 15); tower(16, -16);
    // with the layered plants rolled out (desktop, src/baseplants.js) the two cat-cover bushes are clusters of leafy bushes, not leaf-wrapped balls; the same cover and the same circle you bump into
    if (LIFE_PLANTS.kit) { const c = CAT_SPOTS[4], K = LIFE_PLANTS.kit; circle(c.x, c.z, 1.2); for (const [dx, dz, s] of [[-0.45, 0.1, 1.35], [0.4, -0.25, 1.2], [0.15, 0.45, 1.05], [-0.2, -0.45, 0.95], [0.5, 1.75, 1.25], [0.25, 2.2, 1.0], [0.85, 2.05, 0.9]]) K.add('bush', c.x + dx, 0, c.z + dz, s); }
    else { mound(CAT_SPOTS[4].x, 0.5, CAT_SPOTS[4].z, 1.25, 0.72, 0.95, 0x3a9a4a, 0.3); circle(CAT_SPOTS[4].x, CAT_SPOTS[4].z, 1.2); mound(CAT_SPOTS[4].x + 0.5, 0.7, CAT_SPOTS[4].z + 1.9, 0.85, 0.9, 0.85, 0x2f8a40, 0); leafy(CAT_SPOTS[4].x, 0.7, CAT_SPOTS[4].z, 2.2, 1.1, 1.6, 12, 0, 11); leafy(CAT_SPOTS[4].x + 0.5, 0.9, CAT_SPOTS[4].z + 1.9, 1.4, 1.5, 1.4, 10, 0, 17); }
    // hedge ring
    // (desktop scenery: the hedge ring is a leaf-cluster hedge made in src/scenehi.js)
    if (!SCENERY) for (let i = 0, n = Math.round(28 * HEDGE_R / 20.5); i < n; i++) { const a = (i / n) * Math.PI * 2, r = HEDGE_R; if (LIFE_KO(Math.cos(a) * r, Math.sin(a) * r)) continue; mound(Math.cos(a) * r, 0.55, Math.sin(a) * r, 1.8, 0.78 + (i % 3) * 0.08, 0.66, 0x2f7a3a, -a); card(1.6, 0.9, tuftM, Math.cos(a) * (r - 0.7), 0.42, Math.sin(a) * (r - 0.7), -a + Math.PI / 2, g); leafy(Math.cos(a) * r, 0.75, Math.sin(a) * r, 3.2, 1.3, 1, 7, -a, i * 13 + 5); }
    yield;
    // your home: three walls, a roof, a doorway facing the plaza and a shelf for the lucky cat
    { const hx = HOME.x, hz = HOME.z, wc = 0x9a8a6a;
      bx(6.4, 3, 0.4, wc, hx, 1.5, hz - 2, g); bx(0.4, 3, 4.4, wc, hx - 3.2, 1.5, hz, g); bx(0.4, 3, 4.4, wc, hx + 3.2, 1.5, hz, g);
      bx(2.0, 3, 0.4, wc, hx - 2.2, 1.5, hz + 2, g); bx(2.0, 3, 0.4, wc, hx + 2.2, 1.5, hz + 2, g); bx(2.4, 0.6, 0.4, wc, hx, 2.7, hz + 2, g);
      { const vault = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 7.2, 20, 1, false, 0, Math.PI), mat(0x4aa84a)); vault.material.side = THREE.DoubleSide; vault.rotation.z = Math.PI / 2; vault.scale.set(0.55, 1, 1); vault.position.set(hx, 3.0, hz); g.add(vault);
        for (const sx of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(2.45, 20, 0, Math.PI), mat(wc)); end.material.side = THREE.DoubleSide; end.scale.y = 0.55; end.position.set(hx + sx * 3.6, 3.0, hz); end.rotation.y = sx * Math.PI / 2; g.add(end); }
        for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { const a = 0.35 + r * 0.36, pg = new THREE.Group(); pg.position.set(hx - 3.1 + c * 0.76 + (r % 2) * 0.38, 3.0 + Math.sin(a) * 2.45 * 0.55 + 0.03, hz - Math.cos(a) * 2.45); pg.rotation.x = -(Math.PI / 2 - a) - 0.5; g.add(pg); petal(pg, 0.95, 0.62, BM.cell); }
        for (let k = 0; k < 8; k++) for (let c = 0; c < 2; c++) card(1.0, 0.9, flM[k % 5], hx - 3.0 + k * 0.85 + (c ? 0.2 : 0), 4.1, hz + 0.9 + (c ? 0.25 : 0), c * 1.57 + k * 0.7, g);
        g.add(stem([[hx - 1.2, 0, hz + 2.22], [hx - 1.2, 2.2, hz + 2.22], [hx - 0.8, 2.75, hz + 2.22], [hx, 2.95, hz + 2.22], [hx + 0.8, 2.75, hz + 2.22], [hx + 1.2, 2.2, hz + 2.22], [hx + 1.2, 0, hz + 2.22]], 0.06, BM.verdigris)); bx(6.8, 0.3, 4.4, 0x5a3d28, hx, 0.02, hz, g); }
      bx(5.6, 0.9, 0.5, 0x6a4a2a, hx, 0.45, hz - 1.65, g); bx(5.6, 0.08, 0.6, 0x8a6a3a, hx, 0.94, hz - 1.65, g);
      bx(1.8, 0.5, 2.4, 0xd8d0b8, hx - 2.3, 0.35, hz + 0.2, g); bx(1.8, 0.2, 0.6, 0x7a9a6a, hx - 2.3, 0.7, hz - 0.8, g); // bed
      bx(1.5, 0.08, 0.9, 0x8a5a3a, hx + 2.3, 0.78, hz + 0.9, g); bx(0.08, 0.78, 0.08, 0x6a4a2a, hx + 1.6, 0.39, hz + 0.5, g); bx(0.08, 0.78, 0.08, 0x6a4a2a, hx + 3.0, 0.39, hz + 1.3, g); bx(0.5, 0.04, 0.4, 0xf4f0e0, hx + 2.3, 0.84, hz + 0.9, g); // desk with a journal
      bx(2.2, 0.02, 1.6, 0xb8584a, hx, 0.03, hz + 0.6, g); // rug
      // plant pot: right of the doorway (fresh-player fix, owner Nov 18: at hx - 0.2 it stood between your waking spot and Marla at the door and hid her body)
      bx(0.4, 0.4, 0.4, 0x5a3d28, hx + 0.9, 0.2, hz + 1.55, g); mound(hx + 0.9, 0.6, hz + 1.55, 0.24, 0.26, 0.24, 0x3fa04a, 0); leafy(hx + 0.9, 0.75, hz + 1.55, 0.5, 0.6, 0.5, 5, 0, 3);
      bx(0.9, 0.7, 0.05, 0x9ac8e8, hx, 1.9, hz - 1.78, g); // window
      card(2.6, 2.6, vineM, hx - 3.43, 1.5, hz - 0.3, Math.PI / 2, g); card(2.2, 2.2, vineM, hx + 3.43, 1.3, hz + 0.5, Math.PI / 2, g);
      for (let k = -3; k <= 3; k += 0.9) { circle(hx + k, hz - 2, 0.35); }
      for (let k = -2; k <= 2; k += 0.9) { circle(hx - 3.2, hz + k, 0.35); circle(hx + 3.2, hz + k, 0.35); }
      for (const k of [-2.9, -2.2, -1.5, 1.5, 2.2, 2.9]) circle(hx + k, hz + 2, 0.35);
      const lamp = new THREE.PointLight(0xffe0a0, 1.6, 9); lamp.position.set(hx, 2.6, hz); g.add(lamp);
      const hl = label('Your home', '#ffe9a0'); hl.position.set(hx, 4.9, hz); hl.userData.kind = 'station'; g.add(hl);
      if (HIBASE) vaultHi(g, { x: hx, z: hz, w: 6.8, d: 4.4, h: 3, R: 2.45, k: 0.55, front: 1, open: true, door: [0, 2.4, 2.4] });
      homeCats = HOME.slots.map(() => ({ cg: null })); refreshHome(); }
    yield;
    // personnel (addRecruits)
    addRecruits(tok);
    yield;
    // the Scout (you have to look for him)
    const sp = scoutPos(save); scoutG = new THREE.Group();
    // Marla is the real character model; a simple stand-in shows only until the model has loaded
    const stand = new THREE.Group(); { const sb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.3, 8), mat(0x8fa67e)); sb.position.y = 0.85; stand.add(sb); const sh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xe5c7b8)); sh.position.y = 1.62; stand.add(sh); } scoutG.add(stand);
    scoutG.userData.stand = stand;
    if (marla) marla.whenReady(() => { if (!scoutG || tok !== buildN) return; shadowDirty = true; scoutG.remove(stand); marla.root.position.set(0, 0, 0); marla.root.rotation.set(0, 0, 0); scoutG.add(marla.root); });
    { const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.22, 9, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })); bm.position.y = 7; scoutG.add(bm); halo(scoutG, 0, 11.6, 0, 2.2, 0xffd080); }
    const sl = label('Marla (Scout)', '#ffd080', 2.8); sl.position.y = 2.25; sl.userData.kind = 'npc'; scoutG.add(sl); scoutG.position.set(sp.x, 0, sp.z); g.add(scoutG);
    // the hidden lucky cat: behind its cover, only if not found yet
    hiddenCats = [];
    for (const c of save.cats) { const cp = catPos(c), d = Math.hypot(cp.x, cp.z) || 1, cg = makeCat(c, cfg); cg.position.set(cp.x + (cp.x / d) * 1.2, 0, cp.z + (cp.z / d) * 1.2); cg.rotation.y = Math.atan2(-cp.x, -cp.z); cg.visible = c.state === 'hidden'; g.add(cg); hiddenCats.push({ c, cg }); }
    yield;
    decorate(); yield; buildNpcs();
    yield;
    // the hatchery corner and its flock (CONFIG.avians): the corner on both tiers (desktop at the density standard), the birds you own walking in the run
    const live0 = g.children.length; // the hatchery, flock, village cats and base life (they move and change) are marked below: never merged (mergeStill)
    if (AV && save.avians) { hatch = buildHatchery(g, cfg, HIBASE); hatch.refresh(save.avians); flock = createFlock(g, cfg, HIBASE, save.avians, save.seed); const W0 = { x: 0, z: 0, ry: 0 }; for (const q of hatchSolids(cfg)) boxes.push({ I: W0, cx: q[0], cz: q[1], hx: q[2], hz: q[3] });
      const hl = label('Hatchery', '#ffe9a0'); hl.position.set(AV.cx, 2.6, AV.cz); hl.userData.kind = 'station'; g.add(hl); }
    yield;
    // the ambient village cats (CONFIG.villageCats): scenery only, never near a lucky-cat hideout, not part of any cat code
    if (cfg.villageCats && cfg.villageCats.on) vcats = createVillageCats(g, cfg, HIBASE, (save.seed || 1) + 4321);
    yield;
    // base water and base life (src/basevillage.js): the stream and waterwheel, bridges, flumes, the villagers' houses, the recruits' plots and the set pieces; what you bump into joins the boxes and circles
    lifeGround = ground; yield* addLifeIter();
    for (let i = live0; i < g.children.length; i++) g.children[i].userData.noMerge = true;
    yield;
    // sun
    const sun = new THREE.DirectionalLight(0xffe8c0, 1.9); sunL = sun; sun0 = sun.intensity; sun.position.set(-20, 30, -14); g.add(sun); g.add(sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(Q.baseShadowMap, Q.baseShadowMap); sun.shadow.radius = Q.shadowSoft; { const c = sun.shadow.camera; c.left = c.bottom = -28; c.right = c.top = 28; c.near = 2; c.far = 90; } sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
    yield;
    // desktop scenery (src/scenehi.js): meadow, flowers, hedge, trees, shrubs, sunflowers, pond, far hills, sky and light; its parts keep their own shadow settings (userData.scenery)
    if (SCENERY) { let pondM = null; g.traverse((o) => { if (o.userData.pond) pondM = o; }); yield* baseSceneryIter({ g, scene, sky, sun, ground, plaza, pond: pondM, ST: STATIONS, CATS: CAT_SPOTS, HOME, trees: sceneTrees, rooms: KEEP, keepOut: LIFE_ANY ? LIFE_KO : null, hedge: HEDGE_R }); }
    yield;
    // static shadows: everything that stands still casts one; walkers, turbine blades, labels and glass do not
    const still = new Set(); for (const q of npcs) q.n.traverse((o) => still.add(o)); for (const q of towers) q.traverse((o) => still.add(o)); g.traverse((o) => { if (o.isSprite || o.isSkinnedMesh) still.add(o); });
    g.traverse((o) => { if (!o.isMesh || o === sky.mesh || o.isSkinnedMesh || o.userData.blob || o.userData.scenery) return; o.receiveShadow = !o.material.transparent; o.castShadow = !still.has(o) && !o.material.transparent && o !== ground && o !== plaza; });
    scene.add(g); circle(scoutG.position.x, scoutG.position.z, 0.6);
    keptSig = sig; keptFog = scene.fog;
    // (owner 13:10, premortem A) what a fresh build leaves, kept for a kept base shown again: every piece's place, turn and size (pieces whose matrix is fixed are left
    // out), and the sun's colour and strength (the film's dawn shot changes them)
    // (the people's own models are left out: their motion keeps its own state, foot lock included, and restarts on its own)
    { const ppl = new Set(), mark = (r) => { if (r) r.traverse((q) => ppl.add(q)); }; for (const c of Object.values(chars)) if (c) mark(c.root); if (marla) mark(marla.root); for (const q of npcs) if (q.ch) mark(q.ch.root);
      snap0 = []; g.traverse((o) => { if (o.matrixAutoUpdate && !ppl.has(o)) snap0.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); }); } sunC0 = sunL ? sunL.color.getHex() : 0;
  }
  let bg = null;
  // the rest of a background build of the same base first (it ends kept, so buildIter then only shows it again), else the whole build or the kept base shown again
  function build(sv) { if (bg) { const same = bg.sig === keySig(sv), it = bg.it; bg = null; if (same) runAll(it); } runAll(buildIter(sv)); }
  function runAll(it) { while (!it.next().done); }
  // background: bgStart(sv) begins a build of sv's base unless that base is kept already; bgStep(ms) runs its parts (at least one) until ms have gone by (a part is not cut);
  // returns true once it is built (and taken out of the scene again, kept hidden)
  function bgStart(sv) { const sig = keySig(sv); if (!sig || (keptSig === sig && g.children.length) || (bg && bg.sig === sig)) return false; bg = { sig, it: buildIter(sv) }; return true; }
  // bgWorst: the longest single part so far and its number (for perfcheck: a part too long for a slice is named, then cut)
  const bgWorst = { ms: 0, part: -1, n: 0 };
  function bgStep(ms) { if (!bg) return false; const t0 = performance.now(); do { const p0 = performance.now(), dn = bg.it.next().done, pm = performance.now() - p0; bgWorst.n++; if (pm > bgWorst.ms) { bgWorst.ms = Math.round(pm); bgWorst.part = bgWorst.n; } if (dn) { bg = null; scene.remove(g); return true; } } while (performance.now() - t0 < ms); return false; }

  // ---- solarpunk dressing: sky, solar tree, pond, greenhouse, canopy, paths, flowers, lanterns
  const sky = createSky(cfg);
  let growN = 0;
  function decorate() {
    sky.set(0, 0, new THREE.Color(0xe9e4d2)); sky.sun(-40, 24, -60); g.add(sky.mesh); // the same sky as the settlement: real gradient, sun and drifting clouds
    // paths
    const path = (x1, z1, x2, z2) => { const l = Math.hypot(x2 - x1, z2 - z1), m = bx(l, 0.04, 1.7, 0xe9dcb0, (x1 + x2) / 2, 0.03, (z1 + z2) / 2, g); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); };
    for (const s of Object.values(STATIONS)) path(0, 0, s.x * 0.8, s.z * 0.8); path(0, 0, 0, -7.4); path(0, 0, 0, 14);
    // the solar tree: a tall trunk with blue leaf-panels
    { const tr = lathe([[0.0, 0], [0.55, 0.03], [0.42, 0.3], [0.3, 1.2], [0.24, 3.2], [0.2, 5.6], [0.26, 5.9]], BM.ceramic, g, 14); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 26), BM.glow(BLOOM.glowPower)); rg.rotation.x = Math.PI / 2; rg.position.y = 0.12; g.add(rg); for (const y of [1.3, 3.3]) { const c = new THREE.Mesh(new THREE.TorusGeometry(y < 2 ? 0.31 : 0.25, 0.025, 6, 18), BM.copper); c.rotation.x = Math.PI / 2; c.position.y = y; g.add(c); } circle(0, 0, 0.7); shadeAt(g, 0, 0, cfg.depth.baseTree, cfg.depth.baseTree); }
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), y0 = 4.2 + (k % 3) * 0.6, len = 1.5 + (k % 2) * 0.5; g.add(stem([[c * 0.2, y0, sn * 0.2], [c * len * 0.5, y0 + 0.7, sn * len * 0.5], [c * len, y0 + 0.8, sn * len]], 0.06, BM.verdigris)); const yaw = new THREE.Group(); yaw.position.set(c * len, y0 + 0.8, sn * len); yaw.rotation.y = Math.atan2(c, sn) + Math.PI; g.add(yaw); const pg = new THREE.Group(); pg.rotation.x = -1.2; yaw.add(pg); petal(pg, 2.3, 1.3, BM.cell); const fr = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), BM.glow(BLOOM.glowPower)); fr.position.set(c * len * 0.6, y0 + 0.45, sn * len * 0.6); g.add(fr); halo(g, c * len * 0.6, y0 + 0.45, sn * len * 0.6, 0.7, BLOOM.glowPower); }
    { const top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), BM.glow(0xfff0a0)); top.position.y = 6.2; g.add(top); const gl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), BM.glass); gl.position.y = 6.2; g.add(gl); halo(g, 0, 6.2, 0, 2.6, 0xffe9a0); }
    // pond with lily pads
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), new THREE.MeshLambertMaterial({ color: 0x4aa8d8, transparent: true, opacity: 0.88 })); pond.rotation.x = -Math.PI / 2; pond.position.set(-4, 0.04, 12); pond.userData.pond = true; g.add(pond); circle(-4, 12, 2.5);
    for (let k = 0; k < 5; k++) { const lp = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10), mat(0x3a9a4a)); lp.rotation.x = -Math.PI / 2; lp.position.set(-4 + Math.cos(k * 1.7) * 1.3, 0.06, 12 + Math.sin(k * 1.7) * 1.3); g.add(lp); }
    // glass greenhouse over the garden
    { const gx = STATIONS.garden.x, gz = STATIONS.garden.z, gm = new THREE.MeshPhongMaterial({ color: BLOOM.glass, transparent: true, opacity: 0.2, shininess: 120, specular: 0xffffff, depthWrite: false, side: THREE.DoubleSide });
      const gv = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 6.6, 20, 1, false, 0, Math.PI), gm); gv.rotation.z = Math.PI / 2; gv.scale.set(1.3, 1, 1); gv.position.set(gx, 0, gz); g.add(gv);
      for (const sx of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20, 0, Math.PI), gm); end.scale.y = 1.3; end.position.set(gx + sx * 3.3, 0, gz); end.rotation.y = sx * Math.PI / 2; g.add(end); }
      for (let k = 0; k < 6; k++) { const x = gx - 3.3 + k * 1.32; g.add(stem([[x, 0, gz - 1.9], [x, 1.5, gz - 1.6], [x, 2.3, gz - 0.8], [x, 2.47, gz], [x, 2.3, gz + 0.8], [x, 1.5, gz + 1.6], [x, 0, gz + 1.9]], 0.035, BM.verdigris)); }
      g.add(stem([[gx - 3.3, 2.47, gz], [gx + 3.3, 2.47, gz]], 0.04, BM.verdigris)); for (const sz of [-1, 1]) bx(6.7, 0.18, 0.16, 0x5a3d28, gx, 0.09, gz + sz * 1.9, g);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), BM.glow(BLOOM.glowPower)); l.position.set(gx, 2.2, gz); g.add(l); halo(g, gx, 2.2, gz, 1.4, BLOOM.glowPower); }

    // lantern posts ring
    // (a post that would stand in the quest board's way is left out: the board has its own lamps)
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + 0.3, lx = Math.cos(a) * 11.5, lz = Math.sin(a) * 11.5, ix = -Math.cos(a), iz = -Math.sin(a); if (Math.hypot(lx - STATIONS.board.x, lz - STATIONS.board.z) < 2.4) continue; const ft = lathe([[0.0, 0], [0.16, 0.02], [0.08, 0.14], [0.05, 0.4]], BM.ceramic, g, 10); ft.position.set(lx, 0, lz); shadeAt(g, lx, lz, cfg.depth.basePost, cfg.depth.basePost); g.add(stem([[lx, 0.35, lz], [lx, 1.8, lz], [lx + ix * 0.15, 2.6, lz + iz * 0.15], [lx + ix * 0.5, 2.9, lz + iz * 0.5], [lx + ix * 0.75, 2.62, lz + iz * 0.75]], 0.035, BM.verdigris)); const bx2 = lx + ix * 0.75, bz2 = lz + iz * 0.75; const co = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), BM.glow(0xffe08a)); co.position.set(bx2, 2.45, bz2); g.add(co); const gl = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), BM.glass); gl.position.set(bx2, 2.45, bz2); gl.scale.y = 1.25; g.add(gl); halo(g, bx2, 2.45, bz2, 1.2, 0xffe08a); const lf = new THREE.Group(); lf.position.set(lx, 1.2 + (k % 3) * 0.3, lz); lf.rotation.set(0.7, k * 1.3, 0); g.add(lf); petal(lf, 0.3, 0.14, BM.leaf); }
    // flowers (instanced)
    const N = 90, fgeo = new THREE.PlaneGeometry(0.8, 0.7); fgeo.translate(0, 0.35, 0); const fl = new THREE.InstancedMesh(fgeo, cut('flowers'), N * 2), dm = new THREE.Object3D(), cols = [0xffc0d4, 0xffe9a0, 0xffffff, 0xd8c0ff, 0xffc8a0, 0xc0f0ff];
    let r = 1234567; const rn = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < N; i++) { const a = rn() * 6.283, d = 13 + rn() * 6.2, ry = rn() * 3, sc = (0.7 + rn() * 0.7) * (inAnyRoom(Math.cos(a) * d, Math.sin(a) * d, 0.6) ? 0.0001 : 1), col = new THREE.Color(cols[i % cols.length]); for (let c = 0; c < 2; c++) { dm.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); dm.rotation.set(0, ry + c * 1.57, 0); dm.scale.setScalar(sc); dm.updateMatrix(); fl.setMatrixAt(i * 2 + c, dm.matrix); fl.setColorAt(i * 2 + c, col); } }
    // (desktop scenery: the meadow's own wildflowers take the place of these flower cards)
    if (!SCENERY) g.add(fl);
    growth();
  }
  // the settlement grows with every new ring you hold: one solar sapling and a flower bed per ring opened, one more when the last ring is held
  function growth() {
    const G = cfg.base.growth, lvl = Math.min(G.max, ((save && save.ringOpen) || 1) - 1 + (save && save.cleared ? 1 : 0)); growN = lvl; if (lvl <= 0) return;
    const keep = [...Object.values(STATIONS), ...Object.values(NPCS), ...CAT_SPOTS, ...KEEP.map((I) => ({ x: I.x, z: I.z, r: Math.max(I.w, I.d) / 2 })), { x: HOME.x, z: HOME.z }, { x: 0, z: -7.4 }, { x: 0, z: 14 }, ...obst, ...LIFE_KEEP], spots = [];
    const lines = [...Object.values(STATIONS).map((s) => [s.x * 0.8, s.z * 0.8]), [0, -7.4], [0, 14]];
    const offPath = (x, z) => lines.every(([ex, ez]) => { const l2 = ex * ex + ez * ez, t = Math.max(0, Math.min(1, (x * ex + z * ez) / l2)); return Math.hypot(x - ex * t, z - ez * t) > G.clear * 0.6; });
    for (let k = 0; k < 36 && spots.length < G.max; k++) { const a = ((k * 7) % 36) / 36 * Math.PI * 2 + 0.2, x = Math.cos(a) * G.r, z = Math.sin(a) * G.r; if (keep.every((o) => Math.hypot(x - o.x, z - o.z) > G.clear + (o.r || 0)) && offPath(x, z) && spots.every((s) => Math.hypot(x - s[0], z - s[1]) > G.clear * 1.5)) spots.push([x, z]); }
    const fgeo = new THREE.PlaneGeometry(0.8, 0.7); fgeo.translate(0, 0.35, 0); const n = Math.min(lvl, spots.length), fl = new THREE.InstancedMesh(fgeo, cut('flowers'), n * G.flowers * 2), dm = new THREE.Object3D(), cols = [0xffc0d4, 0xffe9a0, 0xffffff, 0xd8c0ff, 0xffc8a0, 0xc0f0ff]; let r = 424242, fi = 0; const rn = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < n; i++) { const [x, z] = spots[i], h = G.height * (0.85 + 0.3 * rn()), sp = new THREE.Group(); sp.position.set(x, 0, z); g.add(sp);
      lathe([[0.0, 0], [0.26, 0.02], [0.17, 0.16], [0.1, 0.6], [0.075, h * 0.7], [0.06, h], [0.09, h + 0.1]], BM.ceramic, sp, 12);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.014, 6, 16), BM.copper); ring.rotation.x = Math.PI / 2; ring.position.y = 0.62; sp.add(ring);
      for (let k = 0; k < G.leaves; k++) { const a = (k / G.leaves) * Math.PI * 2 + i, cs = Math.cos(a), sn = Math.sin(a), y0 = h * (0.5 + 0.1 * (k % 4)), len = 0.6 + 0.16 * (k % 3); sp.add(stem([[cs * 0.06, y0, sn * 0.06], [cs * len * 0.5, y0 + 0.3, sn * len * 0.5], [cs * len, y0 + 0.34, sn * len]], 0.028, BM.verdigris)); const yaw = new THREE.Group(); yaw.position.set(cs * len, y0 + 0.34, sn * len); yaw.rotation.y = Math.atan2(cs, sn) + Math.PI; sp.add(yaw); const pg = new THREE.Group(); pg.rotation.x = -1.2; yaw.add(pg); petal(pg, G.leaf, G.leaf * 0.58, BM.cell); }
      for (let k = 0; k < 4; k++) { const a = k * 1.57 + i * 0.7, pg = new THREE.Group(); pg.position.y = h + 0.05; pg.rotation.set(0.5, a, 0, 'YXZ'); sp.add(pg); petal(pg, 0.75, 0.42, BM.leaf); } // a green crown instead of a lamp, so it reads as a young tree
      { const fr = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), BM.glow(BLOOM.glowPower)); fr.position.set(0.3, h * 0.72, 0.12); sp.add(fr); }
      sp.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; }); circle(x, z, 0.4); shadeAt(g, x, z, cfg.depth.basePost * 1.3, cfg.depth.basePost * 1.3);
      for (let f = 0; f < G.flowers; f++) { const a = rn() * 6.283, d = 0.6 + rn() * 1.5, ry = rn() * 3, sc = 0.6 + rn() * 0.6, col = new THREE.Color(cols[(i + f) % cols.length]); for (let q = 0; q < 2; q++) { dm.position.set(x + Math.cos(a) * d, 0, z + Math.sin(a) * d); dm.rotation.set(0, ry + q * 1.57, 0); dm.scale.setScalar(sc); dm.updateMatrix(); fl.setMatrixAt(fi, dm.matrix); fl.setColorAt(fi, col); fi++; } } }
    fl.instanceMatrix.needsUpdate = true; if (fl.instanceColor) fl.instanceColor.needsUpdate = true; g.add(fl);
  }
  // idle villagers (their quest markers are off since Nov 17: quests come only from the quest board, so a '!' over a villager would point the wrong way)
  function buildNpcs() {
    npcG = {};
    for (const n of Object.values(NPCS)) {
      const p = new THREE.Group(), stand = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.2, 8), mat(n.col)); body.position.y = 0.8; stand.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(0xe0b890)); head.position.y = 1.65; stand.add(head);
      const hr = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(n.hair)); hr.position.set(0, 1.74, -0.06); stand.add(hr); p.add(stand);
      // the villager's real model; the plain stand-in shows only until it has loaded
      if (makeChar) { const ch = chars[n.id] || (chars[n.id] = makeChar(n.id)); if (ch) ch.whenReady(() => { if (!npcG[n.id] || npcG[n.id].p === p) { shadowDirty = true; p.remove(stand); ch.root.position.set(0, 0, 0); p.add(ch.root); } }); }
      const lab = label(n.name + ' (' + n.title + ')', '#fff', 2.8); lab.position.y = 2.4; lab.userData.kind = 'npc'; p.add(lab);
      const mk = label('!', '#ffe14a', 1.2); mk.material.map.dispose(); mk.material.map = markTex('!'); mk.userData.ch = '!'; mk.scale.set(1.2, 0.3, 1); mk.position.y = 3.1; mk.userData.kind = 'mark'; p.add(mk);
      p.position.set(n.x, n.inside && WS ? WS.floor : 0, n.z); g.add(p); circle(n.x, n.z, 0.5); npcG[n.id] = { p, mk, lab };
    }
    refreshNpcs();
  }
  function refreshNpcs() { for (const n of Object.values(NPCS)) { const o = npcG[n.id]; if (!o || !save) continue; const q = save.quests.find((x) => x.giver === n.id && x.state !== 'done'); o.mk.userData.show = false; const ch = q && q.state === 'ready' ? '?' : '!'; if (o.mk.userData.ch !== ch) { o.mk.userData.ch = ch; o.mk.material.map = markTex(ch); o.mk.material.needsUpdate = true; } } }
  function refreshHome() { homeCats.forEach((h, k) => { const c = save.cats.find((x) => x.state === 'placed' && x.slot === k); if (h.cg && (!c || h.cg.userData.id !== c.id)) { h.cg.parent.remove(h.cg); h.cg = null; } if (c && !h.cg) { h.cg = makeCat(c, cfg); h.cg.position.set(HOME.slots[k][0], HOME.slots[k][1] - 0.16, HOME.slots[k][2] + 0.05); g.add(h.cg); } }); for (const o of hiddenCats) o.cg.visible = o.c.state === 'hidden'; }
  // free GPU memory: every base rebuild made new geometries and materials
  // (LAG FIX Nov 19: the base sun's shadow map is freed with it; a new 2048 map stayed on the GPU after every visit. Owner 10:50: shared materials and kept
  // textures (cached for every visit) are left alone, and the label list is emptied, as its labels are freed here)
  function freeAll() { if (marla && marla.root.parent) marla.root.parent.remove(marla.root); for (const c of Object.values(chars)) if (c && c.root.parent) c.root.parent.remove(c.root); g.traverse((o) => { if (o.userData.keep) return; if (o.isLight && o.shadow && o.shadow.map) o.shadow.dispose(); if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (m.userData && m.userData.shared) continue; for (const k in m) { const t = m[k]; if (t && t.isTexture && !(t.userData && (t.userData.shared || t.userData.keep))) t.dispose(); } m.dispose(); } }); LABELS.length = 0; }
  // dispose: with the base kept (CONFIG.lag.keepBase) it is only taken out of the scene; free() really frees it
  function dispose() { if (keptSig) { scene.remove(g); return; } free(); }
  function free() { keptSig = null; buildN++; freeAll(); g.clear(); scene.remove(g); }
  // out of a room's wall or furniture box (room frame): to the nearest point on the box plus the body radius, or out by the nearest face when inside it
  const outOfBox = (q, x, z) => { const R = 0.35, [lx, lz] = toLocal(q.I, x, z), qx = Math.max(q.cx - q.hx, Math.min(q.cx + q.hx, lx)), qz = Math.max(q.cz - q.hz, Math.min(q.cz + q.hz, lz)), dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz); if (d >= R) return [x, z];
    let nx = lx, nz = lz; if (d > 1e-5) { nx = qx + (dx / d) * R; nz = qz + (dz / d) * R; } else { const ex = [q.cx + q.hx - lx, lx - (q.cx - q.hx), q.cz + q.hz - lz, lz - (q.cz - q.hz)], k = ex.indexOf(Math.min(...ex)); if (k === 0) nx = q.cx + q.hx + R; else if (k === 1) nx = q.cx - q.hx - R; else if (k === 2) nz = q.cz + q.hz + R; else nz = q.cz - q.hz - R; }
    return toWorld(q.I, nx, nz); };
  const pushOut = (x, z) => { for (const o of obst) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = o.r + 0.35; if (d < m) { const k = d > 1e-4 ? m / d : 1; x = o.x + (dx || 1) * k; z = o.z + dz * k; } } for (let pass = 0; pass < 2; pass++) for (const q of boxes) [x, z] = outOfBox(q, x, z); if (life) [x, z] = life.push(x, z); const b = baseBound(cfg), r = Math.hypot(x, z); if (r > b) { x *= b / r; z *= b / r; } return [x, z]; };
  // returns { prompt, target, catDist }
  const LV = new THREE.Vector3();
  function sizeLabels(px, pz) {
    const H = cfg.baseHud;
    for (let i = LABELS.length - 1; i >= 0; i--) {
      const s = LABELS[i];
      if (!s.parent) continue;
      s.getWorldPosition(LV); const d = Math.hypot(LV.x - px, LV.z - pz), k = Math.max(H.labelMin, Math.min(1, d / H.labelD0)), w = s.userData.w * k;
      if (s.userData.kind !== 'mark') s.scale.set(w * (s.userData.aspect || 1), w / 4, 1);
      if (s.userData.kind === 'npc') s.material.opacity = Math.max(0, Math.min(1, (H.npcFar - d) / 2));
      // panel fix: a building's label hides when you are close enough to read its own painted sign (CONFIG.ui.signHide; desktop dressing has signs, phones only the hatchery)
      if (s.userData.kind === 'station') { const SH = CONFIG.ui.signHide, D = HIBASE && densityOn() && densityOn().base, signed = (D && D.sign ? SH.high : SH.low).includes(s.userData.text); s.userData.signHid = signed && d < SH.near; }
    }
  }
  // one slice of a recruit's patrol (src/people.js drive plan): the next waypoint once within CONFIG.people.motion.wpReach m; over the last cornerDist m before a waypoint
  // the walk slows as much as the coming corner needs (none for a bend gentler than motion.cornerCos, down to a near stop at people.walk.stopCos), so a sharp corner is met nearly standing and turned in pivot steps
  function patrolStep(o) { const M = cfg.people.motion, Wk = cfg.people.walk; let tgt = o.wp[o.i], dx = tgt[0] - o.n.position.x, dz = tgt[1] - o.n.position.z, d = Math.hypot(dx, dz);
    if (d < M.wpReach) { o.i = (o.i + 1) % o.wp.length; tgt = o.wp[o.i]; dx = tgt[0] - o.n.position.x; dz = tgt[1] - o.n.position.z; d = Math.hypot(dx, dz); }
    const nx = o.wp[(o.i + 1) % o.wp.length], ex = nx[0] - tgt[0], ez = nx[1] - tgt[1], el = Math.hypot(ex, ez) || 1, c = d > 1e-6 ? (dx * ex + dz * ez) / (d * el) : 1;
    const keep = Math.max(0.12, Math.min(1, (c - Wk.stopCos) / (M.cornerCos - Wk.stopCos))), near = Math.max(0, Math.min(1, 1 - (d - M.wpReach) / M.cornerDist));
    // carry: researchers carry their crate (by role, as the crate is shown; hiding the crate for a picture does not change the walk)
    // a footbridge deck: the body stands at its height, each slice (the walk slows on its ramps below, from M.deckLook m before them until 0.6 m past them, where its trailing foot still stands, so it never climbs faster than M.deckRise)
    if (life) o.n.position.y = life.deckY(o.n.position.x, o.n.position.z);
    let rise = 1; if (life && d > 1e-6) for (let k = -2; k < M.deckLook / 0.3; k++) { const at = (j) => life.deckY(o.n.position.x + dx / d * 0.3 * j, o.n.position.z + dz / d * 0.3 * j), sl = Math.abs(at(k + 1) - at(k)) / 0.3; if (sl > 1e-4) rise = Math.min(rise, Math.max(0.35, M.deckRise / (1.2 * sl))); }
    return { face: Math.atan2(dx, dz), go: true, move: true, carry: o.p.role === 'researcher', slow: Math.min(1 - (1 - keep) * near, rise), groundAt: o.gAt || (o.gAt = (x, z) => (life ? life.deckY(x, z) : 0)) }; }
  // posAt (optional): a function of the share of this frame done (0..1] giving the player's [x, z] at that moment, for callers that know the path between frames
  // (without it the slices take the spot on a line from last frame's)
  const yawChk = (o, k) => { if (!o) return k; const y = o.rotation.y, was = bakedYaw[k] === undefined ? y : bakedYaw[k]; if (Math.abs(y - was) > 0.06) { shadowDirty = true; bakedYaw[k] = y; } else if (bakedYaw[k] === undefined) bakedYaw[k] = y; return k + 1; };
  let viewCam = null; const FAR = cfg.lag && cfg.lag.farStep;
  const live = (x, z, px, pz) => { if (!FAR || !viewCam) return true; if (Math.hypot(x - px, z - pz) < FAR.dist) return true; FS.center.set(x, 0.9, z); FS.radius = 1.3; return FR.intersectsSphere(FS); };
  const stepDt = (o, on, dt) => { const a = (o.facc || 0) + dt; if (on || a >= 1 / FAR.hz) { o.facc = 0; return a; } o.facc = a; return 0; };
  function update(dt, px, pz, camY, posAt) {
    const pAt = (x0, z0, a) => (posAt ? posAt(a) : [x0 + (px - x0) * a, z0 + (pz - z0) * a]);
    sizeLabels(px, pz);
    sky.follow({ position: { x: px, y: camY, z: pz } }, 0, dt);
    t += dt;
    // villagers turn to you when you come close (eyes and head first, then shoulders, hips, and the feet in small pivot steps: src/people.js), and back to their own spot a while after you leave
    const PT = cfg.people.turn;
    // each person decides inside the motion's fixed slices (ch.drive's plan), the player's spot taken on a line from last frame's: the same choices at any frame rate
    if (FAR && viewCam) { FM.multiplyMatrices(viewCam.projectionMatrix, viewCam.matrixWorldInverse); FR.setFromProjectionMatrix(FM); }
    for (const n of Object.values(NPCS)) { const o = npcG[n.id], ch = chars[n.id]; if (!o || !ch || !ch.drive) continue;
      const dt0 = dt, dtN = FAR ? stepDt(o, n.inside && WS ? inRoom(WS, px, pz) || live(n.x, n.z, px, pz) : live(n.x, n.z, px, pz), dt0) : dt0; if (!dtN) continue;
      { const dt = dtN; const jump = o.lpx == null || Math.hypot(px - o.lpx, pz - o.lpz) > 2, x0 = jump ? px : o.lpx, z0 = jump ? pz : o.lpz; o.lpx = px; o.lpz = pz;
      // Oko inside the workshop: bent over the bench (head down to the trays, small turns from one tray to the next), standing back now and then; she turns to you only inside the room.
      // (Not the arms-forward 'carry' pose: switching it flicked her hands at 427 deg/s in tools/animcheck.cjs. Her hands work through src/okowork.js, eased in and out.)
      if (n.inside && WS) { const W = cfg.workshop.oko; let working = false;
        ch.drive(dt, { plan: (h, a) => { const pq = pAt(x0, z0, a), qx = pq[0], qz = pq[1], dx = qx - n.x, dz = qz - n.z, d = Math.hypot(dx, dz); o.near = inRoom(WS, qx, qz) && d < (o.near ? W.far : W.near); o.wt = (o.wt || 0) + h;
          const cyc = W.work[0] + W.work[1], turn = W.turns[Math.floor(o.wt / cyc) % W.turns.length]; working = !o.near && (o.wt % cyc) < W.work[0]; const fy = WS.ry + (working ? turn : 0);
          return o.near ? { face: Math.atan2(dx, dz), gaze: [dx, camY, dz] } : { face: fy, gaze: working ? [Math.sin(fy) * W.look[0], W.look[1] + WS.floor, Math.cos(fy) * W.look[0]] : null }; } });
        okoWork(ch, o.work || (o.work = {}), dt, working); continue; }
      ch.drive(dt, { plan: (h, a) => { const pq = pAt(x0, z0, a), dx = pq[0] - n.x, dz = pq[1] - n.z, d = Math.hypot(dx, dz); o.near = d < (o.near ? PT.far : PT.near); o.away = o.near ? 0 : (o.away || 0) + h;
        return o.near ? { face: Math.atan2(dx, dz), gaze: [dx, camY, dz] } : { face: o.away > PT.back ? 0 : null }; } }); } }
    // Marla turns to you in pivot steps (her own root, inside scoutG; src/people.js createStepper), her feet held where they stand
    if (marla && scoutG) { const dx = px - scoutG.position.x, dz = pz - scoutG.position.z, d = Math.hypot(dx, dz), near = d < 7; const m0 = scoutG.userData; const jump = m0.lpx == null || Math.hypot(px - m0.lpx, pz - m0.lpz) > 2, x0 = jump ? px : m0.lpx, z0 = jump ? pz : m0.lpz; m0.lpx = px; m0.lpz = pz;
      if (marla.turn) marla.turn(dt, (a) => { const pq = pAt(x0, z0, a), qx = pq[0] - scoutG.position.x, qz = pq[1] - scoutG.position.z; m0.near = Math.hypot(qx, qz) < 7; return m0.near ? Math.atan2(qx, qz) - scoutG.rotation.y : null; }); const ry = scoutG.rotation.y + marla.root.rotation.y, c = Math.cos(-ry), s = Math.sin(-ry); marla.update(dt, dx * c + dz * s, -dx * s + dz * c, near); }
    for (const w of towers) w.rotation.z += dt * 1.2;
    if (life) life.update(dt);
    // evening in the base: after CONFIG.avians.evening seconds the sun warms and dims over dusk seconds and the birds go to roost
    eveT += dt; if (AV) { const E = cfg.avians, e = E.evening > 0 ? Math.max(0, Math.min(1, (eveT - E.evening) / E.dusk)) : 0; eveE = e; if (sunL) { sunL.intensity = sun0 * (1 - 0.45 * e); sunL.color.setHex(0xffe8c0).lerp(new THREE.Color(0xff9a5a), e); } if (flock) flock.update(dt, px, pz, E.evening > 0 && eveT > E.evening); }
    if (vcats) { const ev = cfg.avians && cfg.avians.evening > 0 && eveT > cfg.avians.evening; vcats.update(dt, px, pz, ev, flock ? flock.birds : null); }
    // the quest marker bobs; the villager stands on the ground (the old whole-body float is gone)
    for (const n of Object.values(NPCS)) { const o = npcG[n.id]; if (!o) continue; o.mk.position.y = 3.1 + Math.sin(t * 3 + n.z) * 0.12; }
    // recruits on patrol: the person's own motion decides the pace (eases in and out, slows in a bend, stops and turns on the spot in pivot steps at a sharp corner); the holder moves along their facing
    for (const o of npcs) {
      if (o.ch && o.ch.drive && o.ch.ready && o.ch.root.parent === o.n) { const r = o.ch.drive(dt, { plan: () => patrolStep(o) }); if (!r.moved) { o.n.position.x += Math.sin(r.yaw) * r.speed * dt; o.n.position.z += Math.cos(r.yaw) * r.speed * dt; } o.crate.position.set(Math.sin(r.yaw) * 0.4, 1.05, Math.cos(r.yaw) * 0.4); o.crate.rotation.y = r.yaw; continue; }
      const tgt = o.wp[o.i], dx = tgt[0] - o.n.position.x, dz = tgt[1] - o.n.position.z, d = Math.hypot(dx, dz); if (d < 0.6) o.i = (o.i + 1) % o.wp.length;
      if (d >= 0.6) { o.n.position.x += (dx / d) * 1.2 * dt; o.n.position.z += (dz / d) * 1.2 * dt; o.n.rotation.y = Math.atan2(dx, dz); }
    }
    // on a footbridge (src/baselife.js) a walker stands on its deck
    // (eased over about 1 / CONFIG.people.motion.deckEase s, so stepping onto a deck is not a jump)
    if (life) { const k = 1 - Math.exp(-dt * cfg.people.motion.deckEase); for (const o of npcs) { if (o.ch && o.ch.drive && o.ch.ready && o.ch.root.parent === o.n) continue; const y = life.deckY(o.n.position.x, o.n.position.z); o.n.position.y += (y - o.n.position.y) * k; } }
    for (const o of hiddenCats) if (o.cg.visible) o.cg.userData.arm.rotation.z = Math.sin(t * 4 + o.c.id) * 0.6;
    for (const h of homeCats) if (h.cg) h.cg.userData.arm.rotation.z = Math.sin(t * 3) * 0.6;
    // (owner 10:50) the base's sprites are listed once per build (again when the base's node count changes, and once a second for labels added deeper), with
    // reused vectors, not a full walk each frame;
    // signHid: panel fix, the label hides near its painted sign (sizeLabels)
    const cam = SPV.c.set(px, camY, pz);
    if (SPV.b !== buildN || SPV.n !== g.children.length || ++SPV.k > 60) { SPV.k = 0; SPV.b = buildN; SPV.n = g.children.length; SPV.list.length = 0; g.traverse((o) => { if (o.isSprite) SPV.list.push(o); }); }
    for (const o of SPV.list) { const wp = o.getWorldPosition(SPV.w), d = wp.distanceTo(cam), lim = cfg.base.labelRange * (o.userData.kind === 'station' ? 1.8 : 1); o.visible = o.userData.kind === 'mark' ? (!!o.userData.show && d < 22) : d < lim && !o.userData.signHid; }
    // indoors her floating name sat over the pegboard and her head (owner's review, Nov 17): inside the room the talk prompt names her, so the label is hidden there
    for (const n of Object.values(NPCS)) if (n.inside && WS && npcG[n.id] && npcG[n.id].lab && inRoom(WS, px, pz)) npcG[n.id].lab.visible = false;
    // (the quest board beside the workshop door answers only when you are nearer to it than to the doorway: at the door the prompt still says to go in)
    let target = null, prompt = '', best = 1e9;
    for (const [key, s] of Object.entries(STATIONS)) { const d = Math.hypot(px - s.x, pz - s.z); if (key === 'workshop' && WS) continue; if (key === 'board' && WS && Math.hypot(px - doorAt(WS, 0.6)[0], pz - doorAt(WS, 0.6)[1]) < d) continue; if (d < s.r + 1.4 && d < best) { best = d; target = { kind: key === 'board' ? 'board' : 'station', key }; prompt = { board: 'USE: quest board (jobs from your people)', storage: 'USE: Storage (your stores and deliveries)', garden: 'USE: Garden (food, and welcoming new people)', workshop: 'USE: Workshop (upgrades and new devices)' }[key] || 'USE: ' + s.name; } }
    { let bk = -1, bd = 1.3; HOME.slots.forEach((s, k) => { const d = Math.hypot(px - s[0], pz - s[2]); if (d < bd + 0.01 && pz > -11.4 && Math.abs(px - HOME.x) < 3.2) { bd = d; bk = k; } });
      if (bk >= 0) { const occ = save.cats.some((c) => c.state === 'placed' && c.slot === bk), car = save.cats.some((c) => c.state === 'carried'); target = { kind: 'slot', k: bk }; prompt = occ ? 'USE: take the cat back' : car ? 'USE: set the cat here' : 'An empty spot on the shelf'; }
      const dd = Math.hypot(px - HOME.x - HOME.desk[0], pz - HOME.desk[1]); if (dd < 1.5 && !(bk >= 0)) { target = { kind: 'desk' }; prompt = 'USE: read your journal'; } }
    // the workshop you walk into: outside, a prompt that says to go in; inside, Oko (talk to her: the upgrade panel) and the crate drop for deliveries
    if (WS && !target) { if (!inRoom(WS, px, pz)) { const [ddx, ddz] = doorAt(WS, 0.6); if (Math.hypot(px - ddx, pz - ddz) < cfg.workshop.prompt) prompt = 'Workshop: go inside (Oko upgrades devices)'; else if (Math.hypot(px - WS.x, pz - WS.z) < STATIONS.workshop.r + 1.4) prompt = 'Workshop: the door is round the front'; } }
    for (const n of Object.values(NPCS)) if (Math.hypot(px - n.x, pz - n.z) < (n.inside ? CONFIG.ui.okoTalk : 2.4) && (!n.inside || inRoom(WS, px, pz))) { target = { kind: 'npc', id: n.id }; prompt = 'USE: Talk to ' + n.name + (n.inside ? ' (upgrades devices)' : ''); } // panel fix: inside the workshop Oko answers across her bench (CONFIG.ui.okoTalk)
    if (WS && save && inRoom(WS, px, pz)) { const cr = save.carry, pick = !cr && save.quests.some((x) => x.type === 'deliver' && !x.giver && x.state === 'active' && x.from === 'workshop'); if ((cr && cr.to === 'workshop') || pick) { target = { kind: 'station', key: 'workshop' }; prompt = cr ? 'USE: set the crate down here' : 'USE: pick up the crate'; } }
    // Marla's journal on her desk (private)
    // the hatchery: E at the nest boxes collects the eggs; E at the incubator puts one in (or opens its panel)
    if (AV && save && save.avians) { const R = cfg.avians.reach, F = save.avians;
      if (Math.hypot(px - AV.nestOut[0], pz - AV.nestOut[1]) < R) { target = { kind: 'coop' }; prompt = F.coop ? 'USE: collect the eggs (' + F.coop + ')' : 'Coop: no eggs yet (each hen lays one a day)'; }
      if (Math.hypot(px - AV.inc[0], pz - AV.inc[1]) < R + 0.4) { target = { kind: 'incubator' }; prompt = F.held > 0 ? 'USE: put an egg in the warm dome (you hold ' + F.held + ')' : 'USE: look at the incubator'; } }
    if (jn && inRoom(MH, px, pz) && Math.hypot(px - jn.at[0], pz - jn.at[1]) < cfg.marlaHouse.read) { target = { kind: 'mjournal' }; prompt = "USE: read Marla's journal (private)"; }
    const sp = scoutG.position; if (Math.hypot(px - sp.x, pz - sp.z) < 2.6) { target = { kind: 'scout' }; prompt = 'USE: talk to Marla, the Scout'; }
    let catDist = 1e9; for (const o of hiddenCats) { if (!o.cg.visible) continue; const d = Math.hypot(px - o.cg.position.x, pz - o.cg.position.z); if (d < catDist) catDist = d; if (d <= cfg.cat.baseRadius) target = { kind: 'cat', id: o.c.id }; }
    { let k = yawChk(scoutG, 0); for (const id in NPCS) k = yawChk(chars[id] && chars[id].root, k); } // a figure that has turned gets its shadow drawn again (no list made each frame: owner 11:27)
    const shadow = shadowDirty; shadowDirty = false; // a model that has just arrived must get into the (static) shadow map
    // deck: height of a footbridge deck under you (your view rides over it); water: how far the stream and the wheel are; indoor: inside a room or your home (the water sound is muffled there)
    const indoor = (WS && inRoom(WS, px, pz)) || (MH && inRoom(MH, px, pz)) || (Math.abs(px - HOME.x) < 3.2 && Math.abs(pz - HOME.z) < 2.2);
    return { prompt, target, catDist, pushOut, shadow, deck: life ? life.deckY(px, pz) : 0, water: life && life.near ? life.near(px, pz) : null, indoor: !!indoor };
  }
  // the unread mark on Marla's journal: a ribbon and a warm glow while a line is unread
  function refreshJournal() { if (!jn || !save) return; const on = marlaJournalUnread(save); jn.ribbon.visible = on; jn.glow.userData.show = on; }
  // the hatchery's eggs after you collect or place one; the evening clock (test hook for pictures and checks)
  function refreshAvians() { if (hatch && save && save.avians) hatch.refresh(save.avians); }
  function hideCat() { for (const o of hiddenCats) o.cg.visible = o.c.state === 'hidden'; }
  // read-only view of the people for tools/animcheck.cjs (the villagers' and recruits' models, their holders, and Marla's spot)
  // meshes and triangles under some objects (for the cost report of the hatchery, its birds and the village cats)
  const meshCost = (roots) => { let meshes = 0, tris = 0; for (const r of roots) r.traverse((o) => { if (!o.isMesh) return; meshes++; const gq = o.geometry; tris += (gq.index ? gq.index.count : gq.attributes.position.count) / 3; }); return { meshes, tris: Math.round(tris) }; };
  const peek = () => ({ cost: { hatchery: hatch ? meshCost([hatch.group]) : null, birds: flock ? meshCost(flock.birds.map((b) => b.root)) : null, cats: vcats ? meshCost(vcats.cats.map((c) => c.root)) : null }, chars, npcG, npcs, scoutG, rooms: { WS, MH }, journal: jn && { ribbon: jn.ribbon.visible, glow: !!jn.glow.userData.show, at: jn.at }, avians: flock && { shown: flock.shown(), birds: flock.birds.map((b) => ({ id: b.id, kind: b.kind, st: b.st, x: b.x, z: b.z, gone: b.gone })), eveT, layout: AV }, vcats: vcats && vcats.cats.map((c) => ({ x: c.b.x, y: c.b.y, z: c.b.z, mode: c.b.mode, act: c.b.act })), life: life && { cost: life.cost, plots: life.plots, wheel: life.water ? life.water.angle() : null } });
  // preChars (owner 11:40): the villagers' models are made ahead (during the opening film), so the base's first build does not load and parse them in the dawn shot
  return { bgStart, bgStep, bgWorst, get bgBusy() { return !!bg; }, recruitsChanged, mergeStill, free, get kept() { return keptSig !== null; }, preChars: () => { if (makeChar) for (const n of Object.values(NPCS)) if (!chars[n.id]) chars[n.id] = makeChar(n.id); }, setView: (c) => { viewCam = c; }, build, dispose, update, pushOut, hideCat, refreshHome, refreshNpcs, refreshJournal, refreshAvians, setEvening: (t) => { eveT = t; }, evening: () => eveE, catSet: (i, o) => { if (vcats && vcats.cats[i]) Object.assign(vcats.cats[i].b, { t: 0, dur: 999, actT: 0, actDur: 999, leave: false, fleeing: false }, o); }, peek, group: g, growth: () => growN, rooms: { WS, MH } };
}
