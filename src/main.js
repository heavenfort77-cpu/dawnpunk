import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MUSIC } from './musicdata.js';
import { GRITTY, DESO } from './look.js';
import { placeSample } from './desolate.js';
import { applyRelief } from './relief.js';
import { TEX } from './texdata.js';
import { Q, QUALITY, QPICK, TIER, hiState, hiPending, askAllHi, saveQuality, setGpuAniso, texLoad } from './quality.js';
import { CONFIG } from './config.js';
import { createSim, setShotTier } from './sim.js';
import * as RUN from './run.js';
import { createBaseView } from './baseview.js';
import { doorAt, inRoom } from './rooms.js';
import { createSky } from './sky.js';
import { MARLA_FACE } from './portrait.js';
import * as H2 from './hud2.js';
import * as B from './base.js';
import { createHands } from './hands.js';
import { createPlayerShadow } from './playershadow.js';
import { buildWorldIter } from './world.js';
import * as PR from './props.js';
import * as GK from './gloomkit.js';
if (DESO.on) GK.setDesoWalker(CONFIG);
import * as BT from './bloomtech.js';
import { createMarla } from './marla.js';
// the base people (Bram, Oko, Pip, recruits): their own motion module (src/people.js); Marla keeps hers
import { createPerson } from './people.js';
import { createFx } from './fx.js';
import { createPerfStep } from './perfstep.js';
import { lodTick, lodFull, lodCopy } from './lod.js';
import { createNightCull } from './nightcull.js';
import { installHouseLamps, bindHouseLamps, houseLamp, addLamp, listHouseLamps, unlistHouseLamps, houseLampState, houseLampList, houseLampsDrawn, houseLampsForceOff } from './houselamps.js';
import { freezeStillBones } from './glbmerge.js';
import { unifyStd } from './unifymat.js';
import { mergeStatic, mergeUnder, HIT_LAYER, splitVariants, singlePassFlat, twoPassGroups } from './mergestatic.js';
import { gloomPreload, glbHooks, glbCopy, glbState } from './gloomglb.js';
import { openBook, loadBookFonts, closeBook } from './book.js';
import { MODELS } from './modeldata.js';
// lore pieces (owner Nov 17 16:25): notes in the street houses, old notices on the board, the field guide's "Before:" lines
import * as LORE from './lore.js';
// THE BECKONER, the final-night boss on ring 5 (owner Nov 17): its picture, warnings and falling pieces (rules in src/boss.js)
import { bossTick, bossGuide, bossEndLine, gloomScrap, scrapTick, deviceHop, hopsClear, bossPreload, bossHooks, physicsPreload } from './bosshi.js';
import { createWaterSound } from './basesound.js';
import { createMarlaVoice } from './marlavoice.js';
import { createImpactSfx, impactSelfTest } from './impactsfx.js';

window.CONFIG = CONFIG; // tune in the console or edit src/config.js
const $ = (id) => document.getElementById(id);
// the journals' handwriting fonts load at start, so the book opens in ink
loadBookFonts();
const cvs = $('c');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: Q.smooth, stencil: !!(Q.fx && Q.fx.keepOut) }); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; } catch (e) { document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;z-index:99;background:#0b1020;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px">This game needs WebGL, which your browser could not start. Try another browser or turn on hardware acceleration.</div>'); throw e; }
// LAG FIX Nov 19 (CPU profile of the night: 30 % of the time in getProgramInfoLog): three.js reads every shader's compile log after building it, which makes the page
// wait for the driver. Players skip that read (CONFIG.lag.shaderLog); the scripted checks keep it so a broken shader still fails them (?cards=1 perf runs measure as a player)
try { renderer.debug.checkShaderErrors = CONFIG.lag.shaderLog || (!!navigator.webdriver && new URLSearchParams(location.search).get('cards') !== '1'); } catch (e) { /* keep the default */ }
// LAG FIX Nov 19 (owner 09:50; profile: shader switching about 9 % of the night frame): solid things are drawn grouped by the shader they need (a key made from the
// material's kind and the maps and switches that pick its shader), then by material and distance as before. Solid surfaces hide each other by depth, so the order
// changes nothing on screen; see-through things keep three.js's own back-to-front order. CONFIG.lag.sortByShader.
const PKEY = new WeakMap(), PIDS = new Map(), PMAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'envMap', 'aoMap', 'lightMap', 'bumpMap', 'specularMap'];
function shaderKey(it) { const m = it.material, o = it.object; let e = PKEY.get(m); if (!e || e.v !== m.version) { const k = m.type + '|' + (m.customProgramCacheKey ? m.customProgramCacheKey() : '') + '|' + PMAPS.map((q) => (m[q] ? 1 : 0)).join('') + '|' + m.vertexColors + (m.alphaTest > 0) + m.side + m.fog + m.flatShading + '|' + Object.keys(m.defines || {}).join(',');
    let id = PIDS.get(k); if (id === undefined) { id = PIDS.size * 4; PIDS.set(k, id); } e = { v: m.version, id }; PKEY.set(m, e); } return e.id + (o.isSkinnedMesh ? 1 : 0) + (o.isInstancedMesh ? 2 : 0); }
if (CONFIG.lag.sortByShader) renderer.setOpaqueSort((a, b) => (a.groupOrder - b.groupOrder) || (a.renderOrder - b.renderOrder) || (shaderKey(a) - shaderKey(b)) || (a.material.id - b.material.id) || (a.z - b.z) || (a.id - b.id));
renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.pixelRatio)); setGpuAniso(renderer.capabilities.getMaxAnisotropy()); if (CONFIG.render.tone) { renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = CONFIG.render.exposure; }
const hands = createHands(CONFIG);
const scene = new THREE.Scene();
// (R4 item A, card 26) the house lamps are shader data, not THREE lights, so the lamp count is not part of any shader's key (src/houselamps.js)
const HL_ON = !!(CONFIG.lag.houseLamps && CONFIG.lag.houseLamps.on); if (HL_ON) { installHouseLamps(CONFIG.lag.houseLamps.max); bindHouseLamps(scene); }
// LAG FIX Nov 19 (owner 09:50; profile: updateMatrixWorld 15 % of the night frame): the scene itself never moves, so it no longer forces every object's matrix to be
// worked out again each frame; objects that move still update themselves, and the still street (freezeWorld) is skipped
scene.matrixAutoUpdate = false;
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 8, 34);
const cam = new THREE.PerspectiveCamera(75, 1, 0.03, 90);
// the Gloom heads lock on to this camera (uncanny motion, CONFIG.gloomMotion)
GK.motionEye.cam = cam;
const hemi = new THREE.HemisphereLight(0xb4c4ff, 0x403830, 1.6); scene.add(hemi);
// the player's own shadow (src/playershadow.js; CONFIG.playerShadow): a real body shadow on desktop, a soft blob on phones
const pshadow = createPlayerShadow(renderer, scene, CONFIG, QUALITY);
// the floor under the player's feet for the shadow (m): a house floor (null while hanging on the ladder), the base's footbridge deck, the street 0
function pshadowFloor() { if (state === 'play' && sim) return sim.player.climb ? null : sim.player.floor * CONFIG.floorH; if (state === 'base') return (baseU && baseU.deck) || 0; return 0; }

const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const BM = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
const FH = CONFIG.floorH;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), M(0x24331f)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; scene.add(ground);

let homeMsg = '';
let run = null, townG = null, world = null, shadowT = 0; const crateMesh = new Map(), townDoors = [];
let skyShadowK = -1;
// by day a few machines stand dormant in the settlement (black screen, limp, a jerk now and then); they are part of the world, so they are also seen from inside a house, and they are gone at night
let dormG = null; const kindQ = []; let dormTold = false;
// the first time each kind of machine shows up in a night, Marla says what it does
const KIND_LINE = { lurcher: 'Lurcher. Fast one, Potts. Do not blink.', hauler: 'Hauler. It breaks panels. Hit it hard.', stilt: 'Stilt! It reaches over panels. Step back.', lantern: 'Lantern! Shoot it first, it hurries the rest.', ticks: 'Ticks. Weak, but quick. Aim low.', warden: 'A Warden. Everything you have, Potts. Now.' };
// real light from the nearest screens: a fixed pool of lights (made once, so nothing is recompiled), moved each frame to the closest machines
// perf: the automatic step-down (made after the renderer's first resize, below); perfRest(): a new scene starts, wait before measuring frames again
// paused: the picture is drawn once and then held (the page keeps the last frame) until play resumes; a lost WebGL context draws nothing until it is restored
// LAG FIX Nov 19 (owner 11:40, front/end audit): the title menu and the run-end screen are held like the pause: drawn once, then the picture is kept (and the run's
// machines, devices, boss and scrap are not stepped under them)
let holdDraw = false, pauseDrawn = false, ctxLost = false, ctxPaused = false; const MENU_EL = document.getElementById('menu') || { style: {} };
// at night inside a house only what shows through its openings is drawn (src/nightcull.js, CONFIG.lag.nightCull)
const nightCull = createNightCull();
let perf = null; const perfRest = () => { if (perf) perf.rest(); };
// desktop Gloom models (src/gloomglb.js) load per run, not at page start: every kind the ring can send (CONFIG.gloom.kinds minRing), asked for when the run starts;
// the opening film's kinds load at once for a first visit (no save yet), so the film shows the models
const FILM_KINDS = [...new Set([CONFIG.opening.grid.machine[0], ...CONFIG.opening.turning.walkers.map((w) => w[0])])];
function runModels() { const ring = +(($('selRing') || {}).value || 0), K = CONFIG.gloom.kinds; gloomPreload(Object.keys(K).filter((k) => (K[k].minRing || 0) <= ring && K[k].share > 0)); }
// (R4, lead area 2: no zero-intensity lights, 2-3 real lights) the machine screen lights are shader lamps (src/houselamps.js): a lamp at intensity 0 is not drawn
// at all, and how many are lit is not part of any shader's key
const glights = []; for (let i = 0; i < Q.lights; i++) { const l = HL_ON ? addLamp(houseLamp(0, CONFIG.gloomLook.lightReach, 0xffffff)) : new THREE.PointLight(0xffffff, 0, CONFIG.gloomLook.lightReach, 2); l.visible = false; scene.add(l); glights.push(l); }
const gl_v = new THREE.Vector3();
// LAG FIX Nov 19 (owner: no zero-intensity lights, light count fixed during play): the machine lights are in the scene only at night (and in the film); the change
// happens under the night card (sceneCard), which builds the shaders for it, so the light count never changes in the middle of play
const GLD = [], GLM = [];
// a device's spinning blade and turning barrel, found once (was getObjectByName per device per frame)
const DEVREF = new WeakMap();
function tickGloomLights(on) { GK.nightGlow(on ? 1 : 0); if (!glights.length) return; if (glights[0].visible !== on) for (const l of glights) l.visible = on; const use = Math.max(0, glights.length - sky.strain);
  // the `use` nearest machines with a lamp, in the same order a stable sort by distance gives (LAG FIX Nov 19: a scan into reused arrays, not a new sorted list a frame)
  let n = 0; if (on) for (const m of gMesh.values()) { if (!m.userData.lamp) continue; const d = m.position.distanceToSquared(cam.position); let k = Math.min(n, use); while (k > 0 && GLD[k - 1] > d) k--; if (k >= use) continue; for (let j = Math.min(n, use - 1); j > k; j--) { GLD[j] = GLD[j - 1]; GLM[j] = GLM[j - 1]; } GLD[k] = d; GLM[k] = m; if (n < use) n++; }
  glights.forEach((l, i) => { const m = i < n ? GLM[i] : null; if (!m) { l.intensity = 0; return; } gl_v.copy(m.userData.lamp); if (!m.matrixWorldAutoUpdate) m.updateWorldMatrix(false, false); m.localToWorld(gl_v); l.position.copy(gl_v); l.color.set(m.userData.lampColor); l.intensity = CONFIG.gloomLook.lightPower * (m.userData.glow === undefined ? 1 : m.userData.glow); }); }
let dormM = [];
function needDormant() {
  if (dormG || !world || !CONFIG.gloomLook.machines || GLOOM_Q === 'hood') return; dormG = new THREE.Group(); world.g.add(dormG);
  if (!run.dormant) { dormTold = false; run.dormant = []; let q = (run.seed ^ 0xd0a) >>> 0; const rn = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296), T = CONFIG.town, G = CONFIG.marla.guide, kinds = GK.GLOOM_KINDS.slice();
    for (let k = 0; k < 200 && run.dormant.length < CONFIG.gloomLook.dormant; k++) { const x = (rn() * 2 - 1) * (T.boundX - 6), z = (rn() < 0.5 ? -1 : 1) * (4 + rn() * 7);
      if (Math.hypot(x, z) < 7 || Math.hypot(x - G.x, z - G.z) < 5 || run.houses.some((h) => (Math.abs(x - h.x) < h.H + 1.8 && Math.abs(z - h.z) < h.H + 1.8) || Math.hypot(x - h.doorX, z - h.doorZ) < 4 || (h.ext && Math.hypot(x - h.ext.x, z - h.ext.z) < h.ext.r + 1.2)) || run.cars.some((c) => Math.hypot(x - c.x, z - c.z) < 3.4) || run.dormant.some((d) => Math.hypot(x - d.x, z - d.z) < 9)) continue;
      const kind = kinds.splice(Math.floor(rn() * kinds.length), 1)[0]; run.dormant.push({ x, z, ry: rn() * 6.28, kind, r: kind === 'warden' ? 1.4 : kind === 'hauler' ? 1.0 : 0.6 }); } }
  // (owner Nov 22, street over 500 draw calls: perfgpu 45003084654 street BREAK, the dormant lantern alone 93 draws at one spot, 45 + 34 + 14 pieces) a sleeping machine
  // moves only its body and head groups (src/gloomkit.js, the jerk), so every other piece is drawn merged with its parent's pieces of the same material (CONFIG.lag.mergeDormant)
  dormM = []; for (const d of run.dormant) { d.awake = 0; const o = GK.gloomMachine(d.kind, { dormant: true }); mergeDormant(o); dormM.push(o); shadeUnder(o, d.r * 3.4, 0.03); o.position.set(d.x, 0, d.z); o.rotation.y = d.ry; o.traverse((m) => { if (m.isMesh && !m.material.transparent) m.castShadow = true; }); dormG.add(o);
    // LAG FIX Nov 19 (owner 11:27): its awake and its spent (powered-down) machines are built now, under the ride card, and kept out of the scene until it wakes or
    // powers down (they were built at that moment); dropped with the run (dropSleeperPre)
    d.pre = { a: sleeperBuild(d, true), s: sleeperBuild(d, false) }; }
  renderer.shadowMap.needsUpdate = true;
}
function tickDormant(night) { if (!dormG) return; dormG.visible = !night; dormG.matrixWorldAutoUpdate = !night; if (night) return; const t = performance.now() / 1000, f2 = cam.far * cam.far; for (const o of dormG.children) if (!o.userData.awake && o.position.distanceToSquared(SLV.copy(cam.position).sub(world.g.position)) < f2) o.userData.anim(t, null); } // (owner 10:50) only the sleepers within the far plane are animated
const SLV = new THREE.Vector3();
// light sleepers: by day a dormant machine wakes if you pass close with a heavy pack, lurches after you, can hit once, then powers down in the sun
// mergeDormant: a sleeping machine's opaque pieces merged per material under its movers: the root, the body (its first child, src/gloomkit.js g.add(b)) and the head(s),
// the only nodes its sleep animation turns (the jerk); a head that is itself a piece stays a piece
function mergeDormant(o) { if (!(CONFIG.lag.mergeDormant && CONFIG.lag.mergeDormant.on)) return; mergeUnder(o, [o, o.children[0], ...(o.userData.heads || [])].filter(Boolean), { transparent: CONFIG.lag.mergeDormant.transparent }); }
function sleeperBuild(d, awake) { const o = GK.gloomMachine(d.kind, { dormant: !awake }); if (!awake) mergeDormant(o); shadeUnder(o, d.r * 3.4, 0.03); o.position.set(d.x, 0, d.z); o.rotation.y = d.ry; o.userData.awake = !!awake; o.traverse((q) => { if (q.isMesh && !q.material.transparent) q.castShadow = true; }); return o; }
function dropSleeperPre() { if (run && run.dormant) for (const d of run.dormant) if (d.pre) { for (const k of ['a', 's']) if (d.pre[k] && !d.pre[k].parent) drop(d.pre[k]); d.pre = null; } }
function sleeperMesh(i, awake) { const d = run.dormant[i], old = dormM[i]; if (old) { dormG.remove(old); drop(old); } const k = awake ? 'a' : 's', o = d.pre && d.pre[k] ? d.pre[k] : sleeperBuild(d, awake); if (d.pre) d.pre[k] = null; dormG.add(o); o.updateMatrixWorld(true); dormM[i] = o; renderer.shadowMap.needsUpdate = true; }
function tickSleepers(dt) { const S = CONFIG.sleepers; if (!S.on || !run || sim || !dormG || state !== 'play') return; const heavy = RUN.speedMult(run) <= S.pace, t = performance.now() / 1000;
  hurtT = Math.max(0, hurtT - dt); sty($('hurt'), 'opacity', String(hurtT * 2.5));
  run.dormant.forEach((d, i) => { const dx = run.px - d.x, dz = run.pz - d.z, dd = Math.hypot(dx, dz);
    if (!d.awake) { if (!d.spent && heavy && dd < S.wake) { wakeDormant(i, 'pack'); d.awake = S.chase; d.hit = false; sleeperMesh(i, true); sfxAlert(); hurtT = 0.15; marlaHint(run.toldSleeper ? 'Another one awake. Move!' : 'Your pack woke it, Potts! Get clear, it cannot keep going in the sun.'); run.toldSleeper = true; } return; }
    d.awake -= dt; if (dd > 0.95) { const st = Math.min(dd - 0.9, S.speed * dt); d.x += dx / dd * st; d.z += dz / dd * st; } d.ry = Math.atan2(dx, dz);
    const o = dormM[i]; o.position.set(d.x, 0, d.z); o.rotation.y = d.ry; o.userData.anim(t, { x: d.x, z: d.z });
    if (!d.hit && dd < S.reach) { d.hit = true; run.hurt = Math.min(S.maxHurt, (run.hurt || 0) + S.dmg); hurtT = 0.45; sfxHit({ pan: 0 }); flash('It struck you: ' + S.dmg + ' health gone for tonight', true); d.awake = Math.min(d.awake, 0.8); }
    if (d.awake <= 0) { d.awake = 0; d.spent = true; sleeperMesh(i, false); } }); }
// waking a dormant machine by day (owner, Nov 16: "night time to have more gloom"): a shot or a bump stirs it (screen flickers, a jolt, a sound; it does not attack by day), a heavy pack wakes it
// as a light sleeper (tickSleepers); each machine woken adds CONFIG.dormant.wakeExtra Gloom to tonight, at most wakeMax in all (added at dusk: sim.addGloom)
function wakeDormant(i, how) { const D = CONFIG.dormant, d = run && run.dormant && run.dormant[i]; if (!d || d.awake > 0 || (how !== 'pack' && d.stir > 0)) return false;
  if (how !== 'pack') { d.stir = D.stir; const o = dormM[i]; if (o && !o.userData.scr) { o.userData.scr = []; o.traverse((q) => { if (q.isMesh && q.material && q.material.isMeshBasicMaterial && q.material.map && q.material.color.r < 0.1) o.userData.scr.push(q.material); }); } sfxAlert(); }
  const first = !d.woke, add = first ? Math.max(0, Math.min(D.wakeExtra, D.wakeMax - (run.wakeExtra || 0))) : 0; d.woke = true; run.wakeExtra = (run.wakeExtra || 0) + add; if (first) run.woken = (run.woken || 0) + 1;
  if (how !== 'pack') marlaHint(!first ? 'Leave it, Potts. It already knows you.' : add ? "You woke it. It'll remember tonight." : 'You woke another one. Tonight cannot get much worse.');
  return true; }
function tickStir(dt) { if (!run || !run.dormant || !dormG) return; const D = CONFIG.dormant, t = performance.now() / 1000; run.dormant.forEach((d, i) => { if (!(d.stir > 0)) return; d.stir = Math.max(0, d.stir - dt); const o = dormM[i]; if (!o) return; const k = d.stir > 0 ? 1 : 0, w = t * D.shakeHz * Math.PI * 2;
  o.rotation.y = d.ry + k * D.shake * Math.sin(w); o.rotation.z = k * D.shake * 0.5 * Math.sin(w * 1.3); for (const m of o.userData.scr || []) m.color.setScalar(k && Math.sin(t * D.flick * Math.PI * 2) > 0 ? D.lit : 0.03); }); }
function aimedDormant(cs, reach) { if (!run || !run.dormant) return -1; const fx = -Math.sin(yaw), fz = -Math.cos(yaw); let best = cs, bi = -1; run.dormant.forEach((d, i) => { const dx = d.x - run.px, dz = d.z - run.pz, dd = Math.hypot(dx, dz); if (dd < 0.3 || dd > reach) return; const c = (dx * fx + dz * fz) / dd; if (c > best) { best = c; bi = i; } }); return bi; }
function dropWorld() { nightCull.reset(); dropWarm(); dropSleeperPre(); if (dormG) { if (world) world.g.remove(dormG); drop(dormG); dormG = null; } if (world) { scene.remove(world.g); world.dispose(); world = null; } }
function buildGrounding() { depthMats(); const D = CONFIG.depth, g = new THREE.Group(), put = (x, z, w, l, ry) => { const s = new THREE.Mesh(flatGeo, shadeMat); s.scale.set(w, 1, l); s.position.set(x, 0.035, z); s.rotation.y = ry; s.renderOrder = 1; s.userData.blob = true; g.add(s); };
  for (const h of run.houses) { const th = -Math.atan2(h.sn, h.cs), R = h.H + D.wallOut; for (const [lx, lz, q] of [[0, R, 0], [0, -R, 0], [R, 0, Math.PI / 2], [-R, 0, Math.PI / 2]]) put(h.x + lx * h.cs - lz * h.sn, h.z + lx * h.sn + lz * h.cs, 2 * h.H * D.wallLen, D.wallW, th + q); }
  for (const cr of run.cars || []) put(cr.x, cr.z, D.car[0], D.car[1], cr.yaw);
  world.g.add(g); }
function buildTrim() { const JOIN = !!CONFIG.lag.trimJoin, T = CONFIG.trim, foot = new THREE.MeshLambertMaterial({ color: T.footColor }), em = new THREE.MeshLambertMaterial({ map: depthTex('edge'), transparent: true, opacity: T.cornerPower, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }); em.userData.decal = true;
  for (const h of run.houses) { const feet = [], edges = [], hg = new THREE.Group(); hg.position.set(h.x, 0, h.z); hg.rotation.y = -Math.atan2(h.sn, h.cs); world.g.add(hg); const R = h.H + 0.2, top = h.L * FH;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cuts = h.sim.breaches.filter((b) => b.floor === 0 && b.type !== 'window' && Math.abs(b.nx + nx) < 0.1 && Math.abs(b.nz + nz) < 0.1).map((b) => (nx ? b.z : b.x)).sort((a, c) => a - c); let a0 = -R - T.footOut;
      const seg = (a, b2) => { if (b2 - a < 0.15) return; const o = new THREE.Mesh(new THREE.BoxGeometry(nx ? T.footOut * 2 : b2 - a, T.footH, nx ? b2 - a : T.footOut * 2), foot); o.position.set(nx ? nx * R : (a + b2) / 2, T.footH / 2, nz ? nz * R : (a + b2) / 2); o.castShadow = true; o.receiveShadow = true; hg.add(o); feet.push(o); };
      for (const u of cuts) { seg(a0, u - CONFIG.openingHalf - 0.05); a0 = u + CONFIG.openingHalf + 0.05; } seg(a0, R + T.footOut);
      for (const s of [-1, 1]) { const o = new THREE.Mesh(wallGeo, em); o.scale.set(T.cornerW * (s > 0 ? -1 : 1), top, 1); const u = s * (R - T.cornerW / 2); o.position.set(nx ? nx * (R + 0.012) : u, top / 2, nz ? nz * (R + 0.012) : u); o.rotation.y = nx > 0 ? Math.PI / 2 : nx < 0 ? -Math.PI / 2 : nz > 0 ? 0 : Math.PI; if (nx) o.scale.x *= nx > 0 ? -1 : 1; if (nz < 0) o.scale.x *= -1; hg.add(o); edges.push(o); } }
    if (JOIN) joinInto(hg, feet, foot, true); else TRIM_RAW.push({ hg, feet, edges, foot, em }); } }
// test hook (trimJoinTest): the unjoined pieces of a build with trimJoin off, joined later in the same frame for a same-frame picture comparison
const TRIM_RAW = [];
// (owner Nov 22, frame rate: the night fight's draws, Mac breakdown 44973307289: 16 foot boxes in view) each house's footing boxes are drawn as one mesh
// (CONFIG.lag.trimJoin): the same triangles, placed where the pieces stood, the same material. Same-frame picture test (trimJoinTest 'feet'): no change on the
// walls (the only changed pixels are the grass's wind). The corner shadings are left apart: joined, a thin line at a corner changed (trimJoinTest 'edges')
function joinInto(hg, list, mat, cast) { if (list.length < 2) return; const gs = []; for (const o of list) { o.updateMatrix(); const g = o.geometry.clone(); g.applyMatrix4(o.matrix);
    if (o.matrix.determinant() < 0 && g.index) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
    gs.push(g); }
  const m = mergeGeometries(gs, false); for (const g of gs) g.dispose(); if (!m) return; m.computeBoundingSphere(); const j = new THREE.Mesh(m, mat); j.castShadow = cast; j.receiveShadow = cast; j.layers.mask = list[0].layers.mask; j.renderOrder = list[0].renderOrder; Object.assign(j.userData, list[0].userData);
  for (const o of list) { hg.remove(o); if (o.geometry !== wallGeo) o.geometry.dispose(); } hg.add(j); }
// owner's rule (Nov 19): small props cast no shadow (CONFIG.lag.smallCaster: a piece whose bounding sphere is smaller than this radius, m)
// (Nov 20) the base's plain materials share one shader where only their pictures differed (src/unifymat.js, CONFIG.lag.unifyMats)
function unifyBase() { if (CONFIG.lag.unifyMats) unifyStd(bview.group); }
function noSmallCasters(root) { const R = CONFIG.lag.smallCaster, v = new THREE.Vector3(); root.updateMatrixWorld(true); root.traverse((o) => { if (!o.isMesh || !o.castShadow || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry) return; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); if (g.boundingSphere && g.boundingSphere.radius * o.getWorldScale(v).x < R) o.castShadow = false; }); }
// the street built (src/world.js buildWorldIter, which stops between its parts) and set in the scene; needWorld runs it at once, the film in time slices (filmPrep)
function* worldIter() { if (DESO.place && !run.desoPlaced) { placeSample(run, CONFIG); run.desoPlaced = true; } world = yield* buildWorldIter(CONFIG, run); noSmallCasters(world.g); scene.add(world.g); applyRelief(world.g); buildGrounding(); buildTrim(); shadowT = 1.5; }
// the sun's shadows are static: drawn again only when the world is moved or its textures arrive
function needWorld() { if (!world) { const it = worldIter(); while (!it.next().done); } renderer.shadowMap.needsUpdate = true; return world; }
let sim = null, state = 'menu', roomGroup = null, catG = null, catArm = null, camY = 1.6;
const landAt = new Map(); // device id -> time its thrown pod lands: the device is drawn from then, growing in over CONFIG.hands.landGrow s
// the still street (world.g): its own matrix is set by world.frame(); every child but the day machines (dormG, they move) is skipped by the per-frame matrix pass and
// worked out again only when the street is moved or a child is added (CONFIG.lag.freezeWorld)
let frozenN = -1, frozenG = null;
function freezeWorld() { if (!CONFIG.lag.freezeWorld || !world) return; const g = world.g; if (g === frozenG && g.children.length === frozenN) return;
  g.matrixAutoUpdate = false; g.updateMatrix(); world.worldAll(g); for (const c of g.children) c.matrixWorldAutoUpdate = c === dormG; frozenG = g; frozenN = g.children.length; }
// the night card's warm-up copies (sceneCard, warmNight below)
const warmG = new THREE.Group(); warmG.name = 'warm';
// LAG FIX Nov 19 (owner 10:35): a destroyed Gloom machine is kept, hidden, in a pool per kind and used again for the next one of that kind (a new paint shade from the
// same spread, its far copies registered again), instead of building a new one (model copy, skeleton, display canvases, decals, merge) at every spawn. The night card's
// warm-up machines start the pool. Emptied when the run's scene is cleared. CONFIG.lag.gloomPool: most kept per kind.
const gPool = {};
// the frame count the far machines' every-other-frame posing goes by (OWNER DECISION 12:35, CONFIG.lag.farAnim)
let GFRAME = 0;
const gloomBlob = (m, k) => shadeUnder(m, CONFIG.depth.gloom * (k === 'warden' ? 1.8 : k === 'hauler' ? 1.4 : k === 'ticks' ? 0.8 : 1));
function gloomTake(g) { const l = gPool[gloomKind(g)]; if (!l || !l.length) return null; const m = l.pop(); if (!m.userData.merged) mergeQ.push([m, g.x, g.z]); m.traverse((q) => { if (q.userData.reroll) q.userData.reroll(); }); if (QUALITY === 'high') lodCopy(m, 'gloom'); m.visible = true; return m; }
function gloomPut(m) { scene.remove(m); const k = m.userData.kind, l = gPool[k] || (gPool[k] = []); if (!k || !m.userData.anim || l.length >= CONFIG.lag.gloomPool) { drop(m); return; }
  if (m.userData.cullL) { m.userData.cullL = 0; m.traverse((q) => { if (!q.userData.hitOnly) q.layers.set(0); }); } m.matrixWorldAutoUpdate = true; l.push(m); }
function gloomPoolDrop() { for (const k in gPool) { for (const m of gPool[k]) drop(m); gPool[k].length = 0; } }
// phone-tier machines waiting for their still pieces to be merged (src/mergestatic.js)
const mergeQ = [];
let gMesh = new Map(), dMesh = new Map(), bpGroup = new THREE.Group(), bpParts = [], bpFlash = [];
scene.add(bpGroup);

// remove an object and free its GPU memory (geometries, materials, label textures); nothing here is shared between objects
function drop(o) { if (!o) return; scene.remove(o); o.traverse((q) => { if (q.isSkinnedMesh && q.userData.mergedDraw && q.skeleton) q.skeleton.dispose(); if (q.geometry && !(QUALITY === 'high' && q.geometry.userData.shared) && !q.geometry.userData.pool) q.geometry.dispose(); const ms = q.material ? (Array.isArray(q.material) ? q.material : [q.material]) : []; for (const m of ms) { if (m.userData.shared) continue; for (const k in m) { const t = m[k]; if (t && t.isTexture && !(t.userData && t.userData.shared)) t.dispose(); } m.dispose(); } }); } // shared prop materials and textures (props.js) stay loaded
// ---- light and depth inside a house: klad-painted contact shadows under things and pools of light on the floor at every opening
// one texture per name, kept (LAG FIX Nov 19: each call made a new one marked shared, so the street's corner trim left a new 'edge' texture on the GPU every run)
const depthTexes = {}, depthTex = (k) => { if (depthTexes[k]) return depthTexes[k]; const t = texLoad(k); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; depthTexes[k] = t; return t; };
let shadeMat = null, poolMat = null;
function depthMats() { if (shadeMat) return; shadeMat = new THREE.MeshBasicMaterial({ map: depthTex('shade'), transparent: true, opacity: CONFIG.depth.shade, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); shadeMat.userData.shared = true; poolMat = new THREE.MeshBasicMaterial({ map: depthTex('pool'), transparent: true, opacity: CONFIG.depth.pool, color: CONFIG.depth.poolSun, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); poolMat.userData.shared = true; }
const flatGeo = new THREE.PlaneGeometry(1, 1); flatGeo.rotateX(-Math.PI / 2);
function shadeUnder(o, size, y = 0.025) { depthMats(); const s = new THREE.Mesh(flatGeo, shadeMat); s.scale.set(size, 1, size); s.position.y = y; s.renderOrder = 1; s.userData.blob = true; o.add(s); return s; }
function buildDepth() { if (!sim || !bpGroup) return; depthMats(); const D = CONFIG.depth, g = new THREE.Group(); bpGroup.add(g);
  for (const q of sim.furn || []) { const s = new THREE.Mesh(flatGeo, shadeMat); s.scale.set(q.r * D.furn, 1, q.r * D.furn); s.position.set(q.x, q.floor * FH + 0.075, q.z); s.rotation.y = q.rot || 0; s.renderOrder = 1; g.add(s); }
  for (const b of sim.breaches) { const door = b.type === 'door', w = door ? D.doorW : D.poolW, l = door ? D.doorL : D.poolL, p = new THREE.Mesh(flatGeo, poolMat); p.scale.set(w, 1, l); p.position.set(b.x + b.nx * (l / 2 - 0.15), b.floor * FH + 0.085, b.z + b.nz * (l / 2 - 0.15)); p.rotation.y = Math.atan2(-b.nx, -b.nz); p.renderOrder = 2; g.add(p); } buildDirt(g);
  // LAG FIX Nov 19: these floor shades, pools and dirt decals never move: drawn as one mesh per material (src/mergestatic.js; about 45 draws became a few). All tiers.
  if (CONFIG.lag.mergeDecals) mergeStatic(g, () => {}, true);
  // they never move either: their matrices are worked out once (the breach group itself is never moved, so it does not force them every frame)
  if (CONFIG.lag.freezeWorld) { bpGroup.matrixAutoUpdate = false; bpGroup.updateMatrix(); g.updateMatrixWorld(true); g.matrixWorldAutoUpdate = false; } }
const dirtMats = {}; function dirtMat(k) { if (!dirtMats[k]) { dirtMats[k] = new THREE.MeshLambertMaterial({ map: depthTex(k), color: k === 'dust' ? CONFIG.dirt.dustTint : 0xffffff, transparent: true, opacity: CONFIG.dirt.power * (k === 'dust' ? 0.6 : 1), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }); dirtMats[k].userData.shared = true; } return dirtMats[k]; }
const wallGeo = new THREE.PlaneGeometry(1, 1);
function buildDirt(g) { const D = CONFIG.dirt, H = sim.H; let q = ((run ? run.seed : 7) * 31 + (run ? run.inside : 0) * 977 + 5) >>> 0; const rn = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296), ri = (a) => a[0] + Math.floor(rn() * (a[1] - a[0] + 1));
  const flat = (k, x, y, z, s, s2) => { const o = new THREE.Mesh(flatGeo, dirtMat(k)); o.scale.set(s, 1, s2 || s); o.position.set(x, y, z); o.rotation.y = rn() * 6.28; o.renderOrder = 1; g.add(o); };
  for (let f = 0; f < sim.L; f++) { const y0 = f * FH;
    for (let k = ri(D.floor); k > 0; k--) flat(rn() < 0.3 ? 'grime' : rn() < 0.6 ? 'dust' : 'debris', (rn() * 2 - 1) * (H - 0.9), y0 + 0.078 + 0.002 * k, (rn() * 2 - 1) * (H - 0.9), 1.3 + 2.2 * rn(), 1.0 + 1.8 * rn());
    for (const b of sim.breaches) if (b.floor === f) flat('grime', b.x + b.nx * 1.0, y0 + 0.079, b.z + b.nz * 1.0, 2.2 + rn(), 1.6 + rn());          // dirt blown in at every opening
    for (let k = ri(D.ceil); k > 0; k--) flat('grime', (rn() * 2 - 1) * (H - 1.2), y0 + FH - 0.125, (rn() * 2 - 1) * (H - 1.2), 1.6 + 2 * rn());
    const top = y0 + FH - 0.12, W = H - 0.215;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ry = nx > 0 ? -Math.PI / 2 : nx < 0 ? Math.PI / 2 : nz > 0 ? Math.PI : 0, open = sim.breaches.filter((b) => b.floor === f && Math.abs(b.nx + nx) < 0.1 && Math.abs(b.nz + nz) < 0.1).map((b) => (nx ? b.z : b.x));
      for (let u0 = -H + 1.2 + rn(); u0 < H - 1.2; u0 += 1.4 + 2.6 * rn()) { if (rn() < 0.22) continue; const roll = rn(), kind = roll < 0.45 ? 'grime' : roll < 0.75 ? 'leak' : 'dust', ww = (kind === 'leak' ? 0.8 : 1.5) + 2.6 * rn() * rn(), hh = kind === 'leak' ? 0.5 + 0.9 * rn() : 0.45 + 0.9 * rn(); if (open.some((v) => Math.abs(v - u0) < 0.7)) continue;
        const o = new THREE.Mesh(wallGeo, dirtMat(kind)); o.scale.set(ww * (rn() < 0.5 ? -1 : 1), hh, 1); o.position.set(nx ? nx * W : u0, y0 + 0.06 + hh * (kind === 'leak' ? 0.5 : 0.36 + 0.14 * rn()), nz ? nz * W : u0); o.rotation.y = ry; o.rotation.z = kind === 'leak' ? Math.PI : (rn() - 0.5) * 0.7; o.renderOrder = 1; g.add(o); } // dirt along the foot of every wall: three kinds (dark grime, rising damp, pale dust), each its own size, flip, tilt and spacing, with gaps
      for (let k = ri(D.wall); k > 0; k--) { const u = (rn() * 2 - 1) * (H - 0.9), roll = rn(), kind = roll < 0.5 ? 'leak' : roll < 0.8 ? 'crack' : 'grime', ww = kind === 'leak' ? 0.9 + 1.2 * rn() : kind === 'crack' ? 1.1 + 1.3 * rn() : 1.4 + 1.2 * rn(), hh = kind === 'leak' ? 1.3 + 1.5 * rn() : kind === 'crack' ? ww : 0.9 + 0.5 * rn();
        if (open.some((v) => Math.abs(v - u) < CONFIG.openingHalf + ww / 2 + 0.1)) continue; const o = new THREE.Mesh(wallGeo, dirtMat(kind)); o.scale.set(ww, hh, 1); o.position.set(nx ? nx * W : u, kind === 'leak' ? top - hh / 2 : kind === 'crack' ? y0 + 0.7 + rn() * 1.6 : y0 + 0.1 + hh / 2, nz ? nz * W : u); o.rotation.y = ry; if (kind === 'crack') o.rotation.z = rn() * 6.28; o.renderOrder = 1; g.add(o); } }
    if (D.webs) for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { if (rn() < 0.25) continue; const s = 0.9 + 0.7 * rn(), o = new THREE.Mesh(wallGeo, dirtMat('cobweb')); o.scale.set(s, s, 1); o.position.set(sx * (W - 0.02), top - s / 2 + 0.04, sz * (W - s * 0.35)); o.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; if ((sx > 0) === (sz > 0)) o.scale.x = -s; o.renderOrder = 2; g.add(o); } } }
function depthLight(k) { if (!shadeMat) return; const D = CONFIG.depth, n = Math.min(1, Math.max(0, (k - 0.35) / 0.5)); shadeMat.opacity = D.shade + (D.shadeNight - D.shade) * n; poolMat.opacity = D.pool + (D.poolNight - D.pool) * n; poolMat.color.setHex(D.poolSun).lerp(DLC.setHex(D.poolMoon), n); }
const DLC = new THREE.Color();
function clearScene() {
  tickGloomLights(false); if (panelGhost) { drop(panelGhost); panelGhost = null; }
  for (const m of gMesh.values()) drop(m); for (const m of dMesh.values()) drop(m); gMesh.clear(); dMesh.clear(); gloomPoolDrop();
  drop(bpGroup); bpGroup = new THREE.Group(); scene.add(bpGroup); bpParts = []; bpFlash = [];
  if (roomGroup) { if (HL_ON) unlistHouseLamps(roomGroup); drop(roomGroup); roomGroup = null; }
  if (townG) { drop(townG); townG = null; }
  for (const m of crateMesh.values()) drop(m); crateMesh.clear();
  for (const q of debris) opDone(q.m); debris.length = 0; for (const q of tracers) opDone(q.l); tracers.length = 0;
  bossTick(0, null, { scene }); scrapTick(0, { scene }, true); hopsClear(); // the boss and its pieces go with the night (src/bosshi.js)
}

// LAG FIX Nov 19 (owner, run-end screen at 15 fps on the Mac): the picture behind the run-end screen is held, so the screen's blur (.ov: blur(5px) saturate(1.15))
// is made once from the held frame (a canvas behind #end, the same filter at the canvas's own pixel scale) and the live backdrop blur is switched off while it shows.
// CONFIG.lag.endSnap; the snapshot goes when the screen does.
const ENDS = { cv: null, on: false };
function endSnap() { const want = CONFIG.lag.endSnap && state === 'end' && $('end').style.display === 'flex';
  if (!want) { if (ENDS.on) { ENDS.on = false; ENDS.cv.style.display = 'none'; $('end').style.backdropFilter = ''; $('end').style.webkitBackdropFilter = ''; } return; }
  if ((ENDS.on && !ENDS.re) || ctxLost) return; ENDS.re = false; if (!ENDS.cv) { const c = document.createElement('canvas'); c.id = 'endSnap'; c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:8;pointer-events:none;display:none'; document.body.appendChild(c); ENDS.cv = c; }
  const c = ENDS.cv, k = cvs.width / Math.max(1, cvs.clientWidth); c.width = cvs.width; c.height = cvs.height; const x = c.getContext('2d'); x.filter = 'blur(' + (5 * k).toFixed(2) + 'px) saturate(1.15)'; x.drawImage(cvs, 0, 0); x.filter = 'none';
  c.style.display = 'block'; $('end').style.backdropFilter = 'none'; $('end').style.webkitBackdropFilter = 'none'; ENDS.on = true; }
// ---- house: floors, walls, slabs with stair + ladder holes, stairs, ladder, markers, hidden cat
// rundown look (visual only): moss patches low on the walls and dark holes high up; more of both further out. side = 1 inside (marks on the inner wall faces), -1 outside
const mixHex = (a, b, k) => { const ca = new THREE.Color(a), cb = new THREE.Color(b); return ca.lerp(cb, Math.max(0, Math.min(1, k))).getHex(); };
function wearMarks(group, ring, f, H, side, seed, ox = 0, oz = 0) {
  let q = (seed * 9301 + 49297) % 233280; const rnd = () => { q = (q * 9301 + 49297) % 233280; return q / 233280; };
  for (let i = 0; i < ring * 3; i++) {
    const moss = i % 3 !== 2, wall = Math.floor(rnd() * 4), u = (rnd() * 2 - 1) * (H - 0.8), d = H - side * 0.23, w = moss ? 0.8 + rnd() * 1.2 : 0.5 + rnd() * 0.4, h = moss ? 0.4 + rnd() * 0.5 : 0.5 + rnd() * 0.3;
    const m = wall < 2 ? box(w, h, 0.06, moss ? 0x4f7a3a : 0x161a16) : box(0.06, h, w, moss ? 0x4f7a3a : 0x161a16);
    m.position.set(ox + (wall < 2 ? u : (wall === 2 ? d : -d)), f * FH + (moss ? 0.25 + rnd() * 0.5 : 2.75 + rnd() * 0.25), oz + (wall < 2 ? (wall === 0 ? d : -d) : u)); group.add(m);
  }
}
// the run's houses are part of the world (world.js); only what belongs to this visit is built here: lamps, stair and ladder marks, the hidden cat
function buildRoomDyn() {
  roomGroup = new THREE.Group();
  for (let f = 0; f < sim.L; f++) { const lamp = HL_ON ? houseLamp(CONFIG.world.lamp, sim.H * CONFIG.world.lampReach) : new THREE.PointLight(0xffe0a0, CONFIG.world.lamp, sim.H * CONFIG.world.lampReach); lamp.position.set(0, f * FH + 2.6, 0); lamp.userData.roomLamp = true; roomGroup.add(lamp); }
  // no floor marks at the stairs or the ladder (user, 2026-11-14): the stairs and the ladder are real and show where to go
  // the big crate the cat hides behind (owner Nov 22: it was a loot capsule at twice the size, blue band and glow, in every house, that could never be taken, so it
  // read as loot that does not go away): a plain wooden box, no band
  const crate = PR.crateMesh('ess', true); crate.scale.setScalar(2); crate.position.set(sim.cat.x + 1.1, 0.06, sim.cat.z - 1.1); roomGroup.add(crate);
  const c = PR.catMesh(CONFIG.catStyles[((run && run.inside) || 0) % CONFIG.catStyles.length]); catG = c.g; catArm = c.arm; catG.position.set(sim.cat.x, 0.06, sim.cat.z); catG.rotation.y = Math.atan2(-sim.cat.x, -sim.cat.z); // it faces the room
  roomGroup.add(catG); scene.add(roomGroup); if (HL_ON) listHouseLamps(roomGroup);
}
function buildRoom() {
  const H = sim.H, L = sim.L;
  roomGroup = new THREE.Group();
  const wear = sim.ring / 4, WC = mixHex(0x8a8f86, 0x4f5a48, wear * 0.8); // further rings look more rundown: darker, mossier walls
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), M(0x2b4a30)); yard.rotation.x = -Math.PI / 2; yard.position.y = -0.02; roomGroup.add(yard);
  const floor0 = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), M(0x5a4a3a)); floor0.rotation.x = -Math.PI / 2; floor0.position.y = 0.01; roomGroup.add(floor0);
  for (let f = 0; f < L; f++) {
    // walls with real openings at every breach point (door/gap from the floor, window/hatch from a sill), so the Gloom and their heads show through
    for (const [axis, fix] of [['x', H], ['x', -H], ['z', H], ['z', -H]]) {
      const ops = sim.breaches.filter((b) => b.floor === f && (axis === 'x' ? Math.abs(b.z - fix) < 0.01 && Math.abs(b.x) < H + 0.01 : Math.abs(b.x - fix) < 0.01 && Math.abs(b.z) < H + 0.01)).map((b) => ({ c: axis === 'x' ? b.x : b.z, low: b.type === 'door' || b.type === 'gap' })).sort((a, b) => a.c - b.c);
      const Y0 = f * FH + 0.1, Y1 = f * FH + FH - 0.1, TOP = f * FH + 2.7, SILL = f * FH + 0.9, hw = CONFIG.openingHalf;
      const put = (a, b, y0, y1) => { if (b - a < 0.02 || y1 - y0 < 0.02) return; const len = b - a, mid = (a + b) / 2, w1 = axis === 'x' ? box(len, y1 - y0, 0.4, WC) : box(0.4, y1 - y0, len, WC); w1.position.set(axis === 'x' ? mid : fix, (y0 + y1) / 2, axis === 'x' ? fix : mid); roomGroup.add(w1); };
      let cur = -H - 0.2;
      for (const o of ops) { put(cur, o.c - hw, Y0, Y1); if (!o.low) put(o.c - hw, o.c + hw, Y0, SILL); put(o.c - hw, o.c + hw, TOP, Y1); cur = o.c + hw; }
      put(cur, H + 0.2, Y0, Y1);
    }
    if (f === L - 1) { const roof = box(2 * H + 0.4, 0.2, 2 * H + 0.4, mixHex(0x6b6f68, 0x3f4a3a, wear * 0.8)); roof.position.set(0, L * FH + 0.1, 0); roomGroup.add(roof); }
    wearMarks(roomGroup, sim.ring, f, H, 1, sim.n * 31 + f);
    const lamp = HL_ON ? houseLamp(1.1, H * 2.2) : new THREE.PointLight(0xffe0a0, 1.1, H * 2.2); lamp.position.set(0, f * FH + 2.8, 0); roomGroup.add(lamp);
    if (f >= 1) { // upper floor slab with holes for the stairs and the ladder
      const sh = new THREE.Shape(); sh.moveTo(-H, -H); sh.lineTo(H, -H); sh.lineTo(H, H); sh.lineTo(-H, H); sh.lineTo(-H, -H);
      const st = sim.stairs[f - 1], ld = sim.ladders[f - 1];
      const h1 = new THREE.Path(); h1.moveTo(st.bx - 0.6, st.bz - 1.2); h1.lineTo(st.tx + 0.6, st.bz - 1.2); h1.lineTo(st.tx + 0.6, st.bz + 1.4); h1.lineTo(st.bx - 0.6, st.bz + 1.4); h1.lineTo(st.bx - 0.6, st.bz - 1.2);
      const h2 = new THREE.Path(); h2.moveTo(ld.x - 0.7, ld.z - 0.7); h2.lineTo(ld.x + 0.7, ld.z - 0.7); h2.lineTo(ld.x + 0.7, ld.z + 0.7); h2.lineTo(ld.x - 0.7, ld.z + 0.7); h2.lineTo(ld.x - 0.7, ld.z - 0.7);
      sh.holes.push(h1, h2);
      const slab = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ color: 0x4a3d30, side: THREE.DoubleSide }));
      slab.rotation.x = Math.PI / 2; slab.position.y = f * FH; roomGroup.add(slab); // rotated +90deg so shape y maps to world z
    }
  }
  // stairs (walk onto the green disc) and ladder (player only, yellow disc)
  for (const st of sim.stairs) {
    const y0 = st.f * FH, dx = st.tx - st.bx, dy = FH, len = Math.hypot(dx, dy);
    const ramp = box(len, 0.2, 1.6, 0xb89a6a); ramp.position.set((st.bx + st.tx) / 2, y0 + FH / 2, st.bz); ramp.rotation.z = Math.atan2(dy, dx); roomGroup.add(ramp);
    for (const [x, z, y] of [[st.bx, st.bz, y0], [st.tx, st.tz, y0 + FH]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 20), BM(0x70ff90, { transparent: true, opacity: 0.5 })); d.position.set(x, y + 0.05, z); roomGroup.add(d); }
  }
  for (const ld of sim.ladders) {
    const y0 = ld.f * FH;
    for (const sx of [-0.25, 0.25]) { const r = box(0.06, FH, 0.06, 0x9a7a3a); r.position.set(ld.x + sx, y0 + FH / 2, ld.z + 0.6); roomGroup.add(r); }
    for (let k = 1; k < 8; k++) { const r = box(0.5, 0.05, 0.05, 0x9a7a3a); r.position.set(ld.x, y0 + (k * FH) / 8, ld.z + 0.6); roomGroup.add(r); }
    for (const y of [y0, y0 + FH]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 20), BM(0xffe070, { transparent: true, opacity: 0.5 })); d.position.set(ld.x, y + 0.05, ld.z); roomGroup.add(d); }
  }
  // hidden lucky cat behind a crate in the far ground-floor corner (plain-shape stub)
  const crate = box(1.2, 1.1, 1.2, 0x6b4a2a); crate.position.set(sim.cat.x + 1.1, 0.55, sim.cat.z - 1.1); roomGroup.add(crate);
  catG = new THREE.Group(); catG.position.set(sim.cat.x, 0, sim.cat.z);
  const cb = box(0.45, 0.55, 0.35, 0xe8c24a); cb.position.y = 0.3; catG.add(cb);
  const ch = box(0.4, 0.32, 0.32, 0xf2d160); ch.position.y = 0.72; catG.add(ch);
  catArm = box(0.12, 0.34, 0.12, 0xf2d160); catArm.position.set(0.28, 0.75, 0); catG.add(catArm);
  roomGroup.add(catG); scene.add(roomGroup); if (HL_ON) listHouseLamps(roomGroup);
}
function buildBreaches() {
  // Nothing marks an opening on the floor (user, 2026-11-14: no rings, no studs). When a shield breaks, the opening itself flashes red for a moment:
  // a sheet of light in the opening that is black (adds nothing, so it cannot be seen) until the flash turns it red.
  const hw = CONFIG.openingHalf;
  for (const b of sim.breaches) { const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), k = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw, 2.6), m); k.position.set(b.x, b.floor * FH + 1.35, b.z); k.rotation.y = Math.atan2(b.nx, b.nz); bpGroup.add(k); bpParts[b.i] = { mats: [m], base: 0x000000 }; }
  // Where a wall device will go: a faint outline of it in that opening. Built one metre tall and stretched to the device's height (Panel or Trellis).
  if (panelGhost) drop(panelGhost); panelGhost = new THREE.Group(); const gm = new THREE.MeshBasicMaterial({ color: 0x66ffe0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }), pm2 = new THREE.MeshBasicMaterial({ color: 0xbffff0, transparent: true, opacity: 0.4, depthWrite: false }), gm2 = new THREE.MeshBasicMaterial({ color: 0x66ffe0, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const low = new THREE.Group(), sheet = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw, 1), gm); sheet.position.y = 0.5; low.add(sheet); for (const sd of [-1, 1]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1, 8), pm2); po.position.set(sd * hw, 0.5, 0); low.add(po); } panelGhost.add(low);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw, 1), gm2); top.position.y = 0.5; const tg = new THREE.Group(); tg.add(top); panelGhost.add(tg);
  panelGhost.userData = { sheet: gm, posts: pm2, low, tg }; panelGhost.visible = false; scene.add(panelGhost);
}
let panelGhost = null;
// the opening a Panel would go into right now: the free one nearest to where you look, within reach (the same rule the game uses when you tap Panel)
function tickPanelGhost(t) { if (!panelGhost) return; let best = null; const walls = sim ? slotKinds().filter((k) => k && CONFIG.devices[k].wall) : [];
  if (sim && walls.length) { const p = sim.player, tx = p.x - Math.sin(yaw) * 3, tz = p.z - Math.cos(yaw) * 3; let bd = 1e9; for (const b of sim.breaches) { if (b.floor !== p.floor || (b.panel && b.panel.hp > 0)) continue; const dd = Math.hypot(b.x - tx, b.z - tz); if (dd < bd && Math.hypot(b.x - p.x, b.z - p.z) <= CONFIG.panelReach) { bd = dd; best = b; } } }
  panelGhost.visible = !!best; if (!best) return; const U = panelGhost.userData, day = sim.phase === 'day', hP = CONFIG.cannon.panelH, hT = 2.7, hasP = walls.includes('panel'), hasT = walls.includes('trellis'), h = hasP ? hP : hT;
  // by day it is only a dim plan (wall devices are placed at night); with a Trellis carried as well as a Panel, a fainter sheet shows the Trellis's extra height
  panelGhost.position.set(best.x, best.floor * FH, best.z); panelGhost.rotation.y = Math.atan2(best.nx, best.nz); U.low.scale.y = h; U.tg.visible = hasP && hasT; U.tg.position.y = hP; U.tg.scale.y = hT - hP;
  U.sheet.opacity = (day ? 0.05 : 0.12) + (day ? 0.02 : 0.07) * Math.sin(t * 4); U.posts.opacity = day ? 0.16 : 0.4; }
// which machine a Gloom is: the sim decides (g.kind, by cfg.gloom.kinds); (?gloom=hood shows the old hooded Gloom, ?gloom=<kind> shows only that machine)
const GLOOM_Q = (() => { try { return new URLSearchParams(location.search).get('gloom'); } catch (e) { return null; } })();
function gloomKind(g) { if (GK.GLOOM_KINDS.includes(GLOOM_Q)) return GLOOM_Q; return GK.GLOOM_KINDS.includes(g.kind) ? g.kind : 'walker'; }
const relieved = (o) => { applyRelief(o); return o; }, gloomMesh = (g) => relieved(CONFIG.gloomLook.machines && GLOOM_Q !== 'hood' ? GK.gloomMachine(gloomKind(g)) : PR.gloomMesh()), deviceMesh = (kind) => relieved((!LOOK_OLD && BT.device(kind, CONFIG)) || PR.deviceMesh(kind, CONFIG));
// ?look=old shows the devices and machines as they were before the Bloomtech style (approved 2026-11-14)
const LOOK_OLD = (() => { try { return new URLSearchParams(location.search).get('look') === 'old'; } catch (e) { return false; } })(); // looks live in props.js
const tracers = [];
// LAG FIX Nov 19 (owner 10:35): short-lived effect objects (shot jets, splash drops, kill smoke, mine flashes, press marks) are kept in pools per kind and reused;
// they share their geometry and material (src/props.js), so a reused one draws exactly as a new one. opTake(key, make): a free one or a new one; opPut: back to its pool.
const OP = {}, opV1 = new THREE.Vector3(), opV2 = new THREE.Vector3();
function opTake(key, make) { const l = OP[key]; const o = l && l.length ? l.pop() : make(); o.userData.poolKey = key; o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); return o; }
function opPut(o) { scene.remove(o); const k = o.userData.poolKey, l = OP[k] || (OP[k] = []); if (l.length < CONFIG.lag.fxPool) l.push(o); }
const opDone = (o) => { if (o.userData.poolKey) opPut(o); else drop(o); };
function tracer(x1, z1, x2, z2, y1, floor, color) { // a shot: a water jet that lives for an instant, and a splash of drops where it lands
  const a = opV1.set(x1, floor * FH + y1, z1), b = opV2.set(x2, floor * FH + 1.0, z2), l = PR.jetPlace(opTake('jet' + color, () => PR.jet(a, b, color)), a, b); scene.add(l); tracers.push({ l, t: 0.12 });
  for (let i = 0; i < 5; i++) { const d = opTake('drop' + color, () => PR.droplet(color)); d.position.copy(b); scene.add(d); debris.push({ m: d, y0: floor * FH + 0.06, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, t: 0.4 }); }
}

// ---- start / restart
let yaw = 0, pitch = 0;
let fromBase = false;
// ---- daytime at the house: sky, crates, staged hints
const sky = createSky(CONFIG); sky.mesh.visible = false; scene.add(sky.mesh);
const SKY = { day: new THREE.Color(CONFIG.sky.horizon), dusk: new THREE.Color(0xe8935a), night: new THREE.Color(CONFIG.nightLook[QUALITY === 'high' ? 'high' : 'low'].sky), dawn: new THREE.Color(0xf0b890) }, skyC = new THREE.Color();
let skyK = 1, hintN = 0, duskT = 0, duskDown = false, solarT = 0;
// darker night (panel fix, CONFIG.nightLook per tier): at night n (0 day .. 1 full night) the exposure, the fill light and the house lamps go down by the tier's factors
function nightLook(n) { const NL = CONFIG.nightLook[QUALITY === 'high' ? 'high' : 'low']; if (CONFIG.render.tone) renderer.toneMappingExposure *= 1 + (NL.exposure - 1) * n; hemi.intensity *= 1 + (NL.fill - 1) * n; if (roomGroup) for (const l of roomGroup.children) if (l.userData.roomLamp) l.intensity = CONFIG.world.lamp * (1 + (NL.lamp - 1) * n); }
// (owner 10:50) the per-frame callers skip it while the sky has not moved (same k and dawn as the last call); every other caller still runs it in full
const SKYL = { k: NaN, d: NaN };
function applySkyIf(k, dawn) { if (k === SKYL.k && dawn === SKYL.d) return; applySky(k, dawn); }
function applySky(k, dawn) { SKYL.k = k; SKYL.d = dawn; depthLight(Math.max(0, k - dawn)); if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure + (CONFIG.render.exposureNight - CONFIG.render.exposure) * Math.min(1, Math.max(0, k - dawn)); if (world) { world.light(Math.max(0, k - dawn)); if (Math.abs(k - skyShadowK) > 0.04) { skyShadowK = k; if (QUALITY !== 'high') renderer.shadowMap.needsUpdate = true; } } if (k < 0.55) skyC.copy(SKY.day).lerp(SKY.dusk, k / 0.55); else skyC.copy(SKY.dusk).lerp(SKY.night, (k - 0.55) / 0.45); skyC.lerp(SKY.dawn, dawn); hemi.intensity = 1.6 + (world ? CONFIG.world.fillDay : 1.6) * Math.max(1 - k, dawn * 0.6); nightLook(Math.min(1, Math.max(0, k - dawn))); hemi.groundColor.setHex(world ? CONFIG.world.fill : 0x403830); hemi.color.setHex(0xb4c4ff); scene.background = skyC; sky.mesh.visible = true; sky.set(k, dawn, skyC); if (scene.fog) { scene.fog.color.copy(skyC); scene.fog.near = 20 - 12 * k; scene.fog.far = 80 - 46 * k; } }
function buildCrates() { for (const m of crateMesh.values()) drop(m); crateMesh.clear(); for (const c of sim.crates) { const m = (LOOK_OLD ? PR.crateMesh : BT.crateV2)(c.kind); m.position.set(c.x, c.floor * FH + 0.06, c.z); m.rotation.y = (c.id * 1.7) % 3; shadeUnder(m, CONFIG.depth.crate, 0.02); scene.add(m); crateMesh.set(c.id, m); if (CONFIG.lag.freezeWorld) { m.updateMatrixWorld(true); m.matrixWorldAutoUpdate = false; } } } // crates never move (owner 09:50: they skip the per-frame matrix pass)
const DAY_HINTS = [[0.5, 'Grab the crates, Potts. Green is food, blue is essentials.'], [7, 'Tap SOLAR by a door or window. It fills your Sun.'], [14, 'Full Sun wins nights. Do not rush the sunset.'], [21, 'Got what you came for? Hold START NIGHT. You choose when the fight begins.']];
const NIGHT_HINTS = [[0.8, 'Tap the right side to FIRE. Tap a device button to place it; hold it to read what it does.'], [9, 'Panels go in the openings: face one and tap Panel. Heads count double.'], [13, 'Hold FIRE until the ring turns gold, then let go: a charged shot through the whole line.'], [15, 'They smash collectors. Each one saved pays at dawn.']];
// the same night hints for mouse and keyboard (desktop players were told to "tap the right side")
const NIGHT_HINTS_DESK = [[0.8, 'Left click to fire. Pick a device with 1 to 5 or the wheel, right click to place it.'], [9, 'Panels go in the openings: face one, pick Panel, right click. Heads count double.'], [13, 'Hold left click until the ring turns gold, then let go: a charged shot through the whole line.'], [15, 'They smash collectors. Each one saved pays at dawn.']];
// ---- the settlement run: six houses on a street by day, the night in the last house you are in
const hintQ = []; let runT = 0;
// Marla tells you where the workshop is, once, on the first base visit after a night (owner Nov 16 23:32; B.workshopTip, CONFIG.workshop.tell); {w} = where it is from where you look
let wsTipT = 0;
function whereWord(q) { const dx = q.x - bp.x, dz = q.z - bp.z, d = Math.hypot(dx, dz) || 1, fx = -Math.sin(yaw), fz = -Math.cos(yaw), dot = (dx * fx + dz * fz) / d, cr = (dx * fz - dz * fx) / d; return dot > 0.7 ? 'ahead' : dot < -0.7 ? 'behind you' : cr > 0 ? 'on your left' : 'on your right'; }
// Marla's one hatchery line (owner Nov 17, CONFIG.avians.tell): on the first base visit after the hatchery appears; when the workshop line is due on the same visit, the hatchery waits for the next one
let tipKind = '';
function tickWsTip(dt) { if (wsTipT <= 0 || state !== 'base' || ui) return; wsTipT -= dt; if (wsTipT > 0) return; wsTipT = 0;
  if (tipKind === 'hatchery') { if (!B.hatcheryTip(CONFIG, save)) return; save.toldHatchery = save.day; persist(); marlaHint(B.HATCHERY_TIP.replace('{d}', 'pond')); return; }
  if (!bview.rooms.WS || !B.markWorkshopTip(save)) return; persist(); const [x, z] = doorAt(bview.rooms.WS, 0); marlaHint(B.WORKSHOP_TIP.replace('{w}', whereWord({ x, z }))); }
function marlaHint(text) { $('marla').textContent = text; marlaT = 5; sayAt = performance.now() / 1000 + 0.5; sayPrio = 3; } // for 3 s only a stairs alert may cut a hint
function queueHint(delay, text, where, skip) { hintQ.push({ at: runT + delay, text, where, skip }); hintQ.sort((a, b) => a.at - b.at); MV.warm(text); } // MV.warm: desktop voice decodes the line's clip ahead
// a hint only shows where it makes sense (street or house); others wait their turn
function dayHints(dt) { runT += dt; if (marlaT > 0.01 || mustSolar()) return; const here = sim ? 'house' : 'street', i = hintQ.findIndex((h) => runT >= h.at && (!h.where || h.where === here)); if (i < 0) return; const h = hintQ.splice(i, 1)[0]; if (!(h.skip && h.skip())) marlaHint(h.text); }
function bellCheck(dayT) { if (run && !run.bell && dayT <= CONFIG.day.bell) { run.bell = true; sfxAlert('stair'); marlaHint('The bell, Potts! ' + H2.hoursWords(CONFIG.day.bell, false) + ' of light left. Pick your house!'); const N = CONFIG.nightStart, once = () => { if (run.toldBell) return true; run.toldBell = true; return false; }; queueHint(N.afterBell, FINE ? N.houseD : N.houseP, 'house', once); queueHint(N.afterBell, N.street, 'street', once); } }
// starting the night (CONFIG.nightStart): Marla's one line on it, in the button's words; said once a run, whichever of its two queued places comes first
function nightLine() { return FINE ? CONFIG.nightStart.lineD : CONFIG.nightStart.lineP; }
function nightOnce() { if (!run || run.toldStart) return true; run.toldStart = true; return false; }
function duskHold(dt, active) { const held = active && (duskDown || keys.KeyN); duskT = held ? duskT + dt : 0; let fire = false; if (duskT >= 0.8) { duskT = 0; duskDown = false; fire = true; } const tx = duskT > 0 ? 'DUSK ' + Math.round(100 * duskT / 0.8) + '%' : CONFIG.nightStart.btn, de = $('bDusk'); if (de.textContent !== tx) de.textContent = tx; return fire; }

// ---- lore notes in the street houses and the board's old notices (owner Nov 17 16:25; texts in src/lore.js, every number in CONFIG.lore)
// One note may lie in a street house: on a table, desk or dresser (its height found with a downward ray onto the real top), else pinned on a small pinboard on a free wall.
// By day only: a soft glint and, within reach and looking at it, "E: read note" (a Read note button on phones). It opens as one page in ink (src/book.js) and goes into
// your journal under "Found notes" (save.loreFound); each note is found once. At night the paper stays, with no glint and no prompt, so the defence is unchanged.
let loreN = null, loreOn = false, loreOpen = false, lorePaper = null, loreMs = 0;
const loreRay = new THREE.Raycaster(), loreV = new THREE.Vector3(), loreD = new THREE.Vector3();
// (pieces hidden at night by src/nightcull.js sit on layer 1: the ray still sees them)
loreRay.layers.enableAll();
function loreCss() {
  if ($('loreCss')) return;
  const s = document.createElement('style'); s.id = 'loreCss';
  s.textContent = '#loreRead{position:fixed;left:50%;top:60%;transform:translateX(-50%);z-index:25;display:none;font:inherit;font-size:15px;font-weight:700;padding:8px 16px;border-radius:999px;border:2px solid #d9c48a;background:#141a17e0;color:#f3e8c8}'
    + '#loreRead.on{display:block}.oldn{margin:12px 0 4px;padding:8px 10px 4px;border:1px dashed #8a7a5299;border-radius:6px;background:#00000026}'
    + '.oldn h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 6px;opacity:.75}'
    + '.oldn p{font-size:13px;line-height:1.35;margin:0 0 7px;padding:5px 9px;max-width:none;opacity:1;background:#e6dcc0;color:#2a2418;border-radius:2px;box-shadow:0 1px 3px #0007;transform:rotate(-.5deg)}.oldn p:nth-of-type(2n){transform:rotate(.6deg)}';
  document.head.appendChild(s);
}
// the board's "Old notices" corner under the postings: CONFIG.lore.notices.shown of them, moving on by one every `every` days
function loreNotices() { loreCss(); const N = CONFIG.lore.notices; return '<div class="oldn"><h2>Old notices</h2>' + LORE.noticesFor(save ? save.day : 1, N.shown, N.every).map((t) => '<p>' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>').join('') + '</div>'; }
function loreBtn() { let b = $('loreRead'); if (b) return b; loreCss(); b = document.createElement('button'); b.id = 'loreRead'; b.type = 'button'; b.textContent = FINE ? 'E: read note' : 'Read note'; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); openLoreNote(); }); document.body.appendChild(b); return b; }
// the paper: off-white with faded handwriting lines (one small picture for every note)
function lorePaperTex() {
  if (lorePaper) return lorePaper;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const x = cv.getContext('2d');
  x.fillStyle = '#efe6cf'; x.fillRect(0, 0, 128, 96); x.strokeStyle = 'rgba(32,48,94,0.75)'; x.lineWidth = 2;
  for (let r = 0; r < 6; r++) { x.beginPath(); x.moveTo(12, 16 + r * 13); for (let k = 0; k < 9; k++) x.lineTo(14 + k * 11 + (r === 5 && k > 4 ? -40 : 0), 16 + r * 13 + ((k * 7 + r * 3) % 5) - 2); x.stroke(); }
  lorePaper = new THREE.CanvasTexture(cv); lorePaper.colorSpace = THREE.SRGBColorSpace; lorePaper.userData.shared = true; return lorePaper;
}
// first thing a ray meets in the world (null if nothing within far)
function loreHit(ox, oy, oz, dx, dy, dz, far) { loreRay.set(loreV.set(ox, oy, oz), loreD.set(dx, dy, dz).normalize()); loreRay.far = far; loreRay.camera = cam; const h = loreRay.intersectObject(world.g, true); return h.length ? h[0] : null; }
// where this house's note lies: a furniture top, else a free wall for the pinboard
let loreWhy = [];
function loreSpot(rnd) {
  const L = CONFIG.lore, s = sim; world.g.updateMatrixWorld(true);
  for (const q of s.furn.filter((o) => L.spots.includes(o.kind))) {
    const o = L.onTop[q.kind] || [0, 0], c = Math.cos(q.rot), sn = Math.sin(q.rot), x = q.x + o[0] * c + o[1] * sn, z = q.z - o[0] * sn + o[1] * c, y0 = q.floor * FH;
    const h = loreHit(x, y0 + 1.6, z, 0, -1, 0, 1.6); if (!h || h.point.y - y0 < L.topY[0] || h.point.y - y0 > L.topY[1]) continue;
    return { top: true, x, y: h.point.y + 0.006, z, floor: q.floor, ry: q.rot + 0.5 };
  }
  // (R3, lorecheck: with seeds 12 and 7 only 1 house of 6 got a note) loreWhy: why each wall place was turned down (test hook lore.why())
  const H = s.H, y = L.boardY; loreWhy = [];
  for (let k = 0, tries = 0; k < 24 && tries < 6; k++) {
    const wall = Math.floor(rnd() * 4), u = (rnd() * 2 - 1) * (H - 1.3), nx = wall === 2 ? 1 : wall === 3 ? -1 : 0, nz = wall === 0 ? 1 : wall === 1 ? -1 : 0, wx = nx ? nx * H : u, wz = nz ? nz * H : u;
    if (s.breaches.some((b) => b.floor === 0 && Math.hypot(b.x - wx, b.z - wz) < (b.type === 'door' ? L.doorKeep : 1.9))) { loreWhy.push('opening'); continue; }
    if (s.furn.some((q) => q.floor === 0 && Math.hypot(q.x - wx, q.z - wz) < q.r + 0.9)) { loreWhy.push('furniture'); continue; }
    // (worker 7, lorecheck 9 FAIL in 44529552521) a board beside the ground-floor ladder or stair foot: standing to read it put the player on the marker, which climbs
    if (s.ladders.some((l) => l.f === 0 && Math.hypot(l.x - wx, l.z - wz) < L.stairKeep) || s.stairs.some((t) => t.f === 0 && Math.hypot(t.bx - wx, t.bz - wz) < L.stairKeep)) { loreWhy.push('stairs'); continue; }
    tries++;
    const tx = nz, tz = -nx, ok = [0].every((a) => { const h = loreHit(wx - nx * 1.2 + tx * a, y, wz - nz * 1.2 + tz * a, nx, 0, nz, 1.3); loreWhy.push(h ? 'ray ' + h.distance.toFixed(2) + ' ' + (h.object.name || h.object.type) : 'ray none'); return h && h.distance > 0.93; });
    if (!ok) continue;
    const d = H - 0.2 - L.board[2] / 2 - L.boardGap;
    return { top: false, x: nx ? nx * d : u, y, z: nz ? nz * d : u, floor: 0, ry: Math.atan2(-nx, -nz) };
  }
  return null;
}
// the note (and its pinboard) for this visit, in bpGroup so it goes with the visit
function loreHouse(i) {
  loreN = null; loreOn = false; H2.unsay('note'); if (!run || !sim || !save || !world) return;
  const L = CONFIG.lore; let q = ((run.seed >>> 0) ^ Math.imul(i + 1, 2654435761)) >>> 0; const rnd = () => ((q = (Math.imul(q, 1664525) + 1013904223) >>> 0) / 4294967296);
  run.lore = run.lore || {};
  if (!(i in run.lore)) run.lore[i] = rnd() < L.chance ? LORE.pickNote(save, Object.values(run.lore).filter((v) => v >= 0), rnd) : -1;
  const n = run.lore[i]; if (n < 0 || LORE.foundList(save).includes(n)) return;
  if (!run.loreSpots) run.loreSpots = {};
  const t0 = performance.now(), sp = run.loreSpots[i] !== undefined ? run.loreSpots[i] : (run.loreSpots[i] = loreSpot(rnd)); loreMs = performance.now() - t0; if (!sp) return;
  const g = new THREE.Group(); g.position.set(sp.x, sp.y, sp.z); g.rotation.y = sp.ry; bpGroup.add(g);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(L.paper[0], L.paper[1]), new THREE.MeshLambertMaterial({ map: lorePaperTex(), emissive: 0x2a2618, side: THREE.DoubleSide }));
  if (sp.top) { paper.rotation.x = -Math.PI / 2; g.add(paper); }
  else {
    const [bw, bh, bt] = L.board, cork = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bt), new THREE.MeshLambertMaterial({ color: 0xa47a4c })), rim = new THREE.MeshLambertMaterial({ color: 0x4a3626 });
    g.add(cork); for (const [w, h, x0, y0] of [[bw + 0.04, 0.03, 0, bh / 2], [bw + 0.04, 0.03, 0, -bh / 2], [0.03, bh, bw / 2, 0], [0.03, bh, -bw / 2, 0]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, bt + 0.012), rim); r.position.set(x0, y0, 0); g.add(r); }
    for (const [x0, y0, c, rz] of [[-0.17, 0.08, 0xcfc4a6, 0.12], [0.18, -0.1, 0xb9c6b0, -0.2]]) { const o = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.17), new THREE.MeshLambertMaterial({ color: c })); o.position.set(x0, y0, bt / 2 + 0.002); o.rotation.z = rz; g.add(o); }
    paper.position.set(0.04, 0.02, bt / 2 + 0.004); paper.rotation.z = -0.08; g.add(paper);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc8302a })); pin.position.set(0.04, 0.08, bt / 2 + 0.012); g.add(pin);
  }
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: introGlow(), color: 0xfff2c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  glint.scale.setScalar(L.glint[0]); glint.position.set(0.03, sp.top ? 0.03 : 0.06, sp.top ? 0 : L.board[2] / 2 + 0.03); g.add(glint);
  // (Nov 20) the note takes its drawn form at once (it was drawn about a second in its first form, one more shader built in play), see the ride card's warm set
  if (fx && fx.upgradeOne) fx.upgradeOne(g);
  loreN = { i: n, g, glint, x: sp.x, z: sp.z, floor: sp.floor, top: sp.top, bp: bpGroup };
}
// every frame: the glint by day, and the prompt when you stand near and look at it
function loreTick() {
  requestAnimationFrame(loreTick);
  const L = CONFIG.lore, live = loreN && loreN.bp === bpGroup && sim && state === 'play'; let on = false;
  if (live) { const day = sim.phase === 'day' || !L.day, G = L.glint; loreN.glint.visible = day; if (day) loreN.glint.material.opacity = G[1] + (G[2] - G[1]) * (0.5 + 0.5 * Math.sin(performance.now() / 1000 * G[3] * Math.PI * 2));
    if (day && !paused && !loreOpen && sim.player.floor === loreN.floor && !sim.player.climb) { const dx = loreN.x - sim.player.x, dz = loreN.z - sim.player.z, d = Math.hypot(dx, dz); if (d < L.reach) { const c = (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / (d || 1); on = c > (d < 0.9 ? L.nearCos : L.aimCos); } } }
  // the prompt: on desktop a centre line through the interface queue (H2.say, kind 'note'); on phones a tap button of its own
  if (on !== loreOn) { if (FINE) { if (on) H2.say('note', 'E: read note', CONFIG.lore.sayPrio, 0); else H2.unsay('note'); } }
  loreOn = on; const b = loreBtn(), show = on && !FINE; if (b.classList.contains('on') !== show) b.classList.toggle('on', show);
}
requestAnimationFrame(loreTick);
// read it: it goes into the journal at once, and opens as one page in ink; the day stands still while you read
function openLoreNote() {
  if (!loreOn || !loreN || loreOpen) return false;
  const i = loreN.i, L = CONFIG.lore, B0 = CONFIG.book, el = $('qb'); if (LORE.markFound(save, i)) persist();
  loreN.g.visible = false; loreN = null; loreOn = false; loreBtn().classList.remove('on'); H2.unsay('note'); loreOpen = true; paused = true;
  const cfg = { ...B0, spreadMinW: 1e9, note: L.hand, lift: { ...B0.lift, note: L.lift }, pencilSize: { ...B0.pencilSize, note: L.pencil }, paper: L.page };
  openBook(el, { hand: 'note', title: LORE.LORE_NOTES[i].label, blocks: [{ k: 'line', text: LORE.LORE_NOTES[i].text }] }, cfg, () => { el.style.display = 'none'; loreOpen = false; paused = false; flash('The note goes in your journal, under Found notes.', true); });
  return true;
}
// keys come here first (capture): E reads the note in reach; while it is open Escape or E closes it and nothing else reaches the game but the page-turn keys
addEventListener('keydown', (e) => {
  if (loreOpen) { if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) closeBook(); } else if (!/^(Arrow|Page)/.test(e.code)) e.stopImmediatePropagation(); return; }
  if (loreOn && e.code === 'KeyE' && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); openLoreNote(); }
}, true);
// ---- opening cutscene, the OLD SAMPLE (kept while CONFIG.opening.on is false; delete once the new one is approved): the night the grid failed, the machines turning, the base at dawn, then waking in your own bed with Marla at the door
let intro = null, glowTex = null;
function introGlow() { if (!glowTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.35, 'rgba(255,200,110,0.55)'); g.addColorStop(1, 'rgba(255,180,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(cv); glowTex.userData.shared = true; } return glowTex; }
function startIntroOld() {
  if (!save) return; clearScene(); dropWorld(); bview.dispose(); sim = null; ui = null; paused = false;
  if (save.day === 1 && !save.nights) save.scoutSpot = 4; // she is at your door when you wake
  state = 'intro'; intro = { t: 0, part: 'town', lights: [], bots: [] };
  $('menu').style.display = 'none'; $('hud').style.display = 'none'; $('cine').style.display = 'block'; $('cineFade').style.opacity = 1; $('cineCap').textContent = '';
  run = RUN.createRun(CONFIG, 0, 4242, {}); scene.fog = new THREE.Fog(0xbfe6f0, 20, 80); needWorld().frame(-1); skyK = 0.4; applySky(skyK, 0);
  run.houses.forEach((h, i) => { for (const dy of [1.5, 4.3]) { if (dy > 2 && h.L < 2) continue; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: introGlow(), color: 0xffd890, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.position.set(h.doorX + (dy > 2 ? 1.5 : -1.2), dy, h.doorZ + h.row * 0.25); s.scale.setScalar(dy > 2 ? 5 : 6.5); s.userData.off = CONFIG.intro.lightsFrom + (i * 2 + (dy > 2 ? 1 : 0)) * CONFIG.intro.lightsEvery * 0.5; world.g.add(s); intro.lights.push(s); } });
  ['walker', 'hauler', 'lurcher', 'stilt'].forEach((k, i) => { const o = GK.gloomMachine(k); o.visible = false; o.userData.lane = (i - 1.5) * 1.5; o.userData.lag = i * 2.3; shadeUnder(o, CONFIG.depth.gloom, 0.03); world.g.add(o); intro.bots.push(o); });
}
function introToBaseOld() { const I = intro; I.part = 'base'; dropWorld(); run = null; hemi.intensity = CONFIG.baseLight.power; hemi.color.setHex(CONFIG.baseLight.sky); hemi.groundColor.setHex(CONFIG.baseLight.ground); sky.mesh.visible = false; scene.background = new THREE.Color(0xbfe6f0); scene.fog = new THREE.Fog(0xf6e8c8, 30, 95); bview.build(save); applyRelief(bview.group); bview.group.traverse((o) => { if (o.isSprite && o.renderOrder === 10) o.material.opacity = 0; }); renderer.shadowMap.needsUpdate = true; shadowT = 1.5; }
function finishIntroOld() { if (!intro) return; if (intro.part === 'town') introToBaseOld(); intro = null; $('cine').style.display = 'none'; state = 'base'; ui = null; bp = { x: -0.6, z: -9.3 }; bview.group.traverse((o) => { if (o.isSprite && o.renderOrder === 10) o.material.opacity = 1; }); const sp = B.scoutPos(save); yaw = Math.atan2(-(sp.x - bp.x), -(sp.z - bp.z)); pitch = 0; camY = 1.6; cam.rotation.set(0, yaw, 0, 'YXZ');
  $('hud').style.display = 'block'; $('hud').className = 'base'; $('bFire').textContent = 'USE'; save.seenIntro = true; persist(); flash('Dawn, day ' + save.day + '. Marla is ' + sp.hint + '. Talk to her to ride out. They say a lucky cat hides somewhere in the base.', 2); }
function introFrameOld(dt) { const I = intro, C = CONFIG.intro; I.t += dt; const t = I.t, sm = (v) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); }; let fade = Math.max(0, 1 - t / C.fade);
  let cap = ''; for (const [a, z, tx] of C.lines) if (t >= a && t <= z) cap = tx; const ce = $('cineCap'); if (ce.textContent !== cap) ce.textContent = cap; ce.classList.toggle('who', /^MARLA/.test(cap));
  if (t < C.town) { fade = Math.max(fade, 1 - (C.town - t) / C.fade); const k = t / C.town; cam.position.set(-36 + 15 * sm(k), 2.1 - 0.3 * k, 0.6); cam.rotation.set(-0.02, -Math.PI / 2 + 0.05 * Math.sin(t * 0.3), 0, 'YXZ');
    skyK = Math.min(1, 0.4 + 0.6 * sm(t / 7)); applySky(skyK, 0);
    for (const s of I.lights) s.material.opacity = t < s.userData.off ? 0.95 : Math.max(0, 0.95 - (t - s.userData.off) * 4) * (Math.sin(t * 40) > 0 ? 1 : 0.5);
    const tt = performance.now() / 1000; for (const o of I.bots) { const go = t - C.botsAt - o.userData.lag * 0.4; o.visible = go > 0; if (!o.visible) continue; const x = cam.position.x + 10.5 + o.userData.lag - go * C.botSpeed, z = o.userData.lane; o.position.set(x, 0, z); o.rotation.y = Math.atan2(cam.position.x - x, cam.position.z - z); o.userData.anim(tt, { x, z }); }
  } else { if (I.part === 'town') introToBaseOld(); const u = t - C.town; fade = Math.max(0, 1 - u / C.fade);
    if (u < C.base) { const h = C.base / 2; if (u < h) { const k = sm(u / h); cam.position.set(3.2, 3.6 - 1.2 * k, 24 - 10 * k); cam.rotation.set(0.05, 0.16, 0, 'YXZ'); fade = Math.max(fade, 1 - (h - u) / (C.fade * 0.6)); }
      else { const k = sm((u - h) / h), x = 7 - 3.5 * k, z = 14 - 4.5 * k; cam.position.set(x, 1.7, z); cam.rotation.set(0.05, Math.atan2(x, z) - 0.1, 0, 'YXZ'); fade = Math.max(1 - (u - h) / (C.fade * 0.6), 1 - (C.base - u) / C.fade, 0); } }
    else { const w = u - C.base, k = sm((w - 1.6) / 3.2), sp = B.scoutPos(save), ex = -0.6, ez = -9.3, ty = Math.atan2(-(sp.x - ex), -(sp.z - ez)); cam.position.set(-2.3 + 1.7 * k, 0.95 + 0.65 * k, -9.6 + 0.3 * k); cam.rotation.set(1.15 * (1 - k), ty * k + (1 - k) * 0.4, 0.5 * (1 - k), 'YXZ'); fade = w < 0.5 ? 1 : w < 1.3 ? 1 - (w - 0.5) / 0.8 : w < 1.7 ? (w - 1.3) / 0.4 * 0.85 : w < 2.3 ? 0.85 * (1 - (w - 1.7) / 0.6) : 0; if (w >= C.wake) { finishIntroOld(); return; } }
    bview.update(dt, cam.position.x, cam.position.z, cam.position.y); }
  sty($('cineFade'), 'opacity', String(Math.max(0, Math.min(1, fade)))); musicTick(dt); sky.follow(cam, 0, dt); draw(); }
// ---- opening cutscene (owner Nov 17 16:25): the game's own street, machines, base and light (every time, path and caption in CONFIG.opening)
// 1 grid: the street at night; house lights and street lamps die one by one; a dormant Gloom's screen wakes and it turns to the last lit window.
// 2 turning: inside that house in the dark, your ring and a device glowing; machines walk past the window, screens lit. 3 dawn: the camera rises over the base at sunrise.
// 4 wake: your own bed, eyelids opening, Marla at the door. Any key, click or tap, or Skip, ends it; it always ends exactly as before: you stand in the base with Marla.
const OP_SM = (v) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
// camera keys [t, x, y, z, lx, ly, lz] at time t -> [x, y, z, lx, ly, lz]
// (owner 11:40) the film's per-frame maths write into kept objects: one result array per key list (OPO), scratch vectors for opAt, scratch colours for opDawn
const OPO = new WeakMap(), OPV = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], OPC = [new THREE.Color(), new THREE.Color()];
function opPath(keys, t) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], k = b[0] > a[0] ? OP_SM((t - a[0]) / (b[0] - a[0])) : 1;
  let o = OPO.get(keys); if (!o) OPO.set(keys, o = new Array(a.length - 1)); for (let j = 1; j < a.length; j++) o[j - 1] = a[j] + (b[j] - a[j]) * k; return o;
}
// the target window's frame: x along the wall, y up, z out from the wall -> world
function opAt(I, x, y, z, out) { return (out || new THREE.Vector3()).set(I.W.x + I.u.x * x + I.n.x * z, y, I.W.z + I.u.z * x + I.n.z * z); }
// pick the target window: ground floor, facing the street, nothing standing where the camera crouches inside; the house nearest the street's middle wins
function opTarget() {
  let best = null; world.g.updateMatrixWorld(true);
  run.houses.forEach((h, i) => { const hg = world.houses[i], s = h.sim;
    for (const b of s.breaches) { if (b.type !== 'window' || b.floor !== 0) continue;
      const W = hg.localToWorld(new THREE.Vector3(b.x, 0, b.z)), o = hg.localToWorld(new THREE.Vector3(b.outX, 0, b.outZ)), n = o.sub(W).setY(0).normalize();
      if (n.z * -Math.sign(W.z) < 0.9) continue;
      const ix = b.x + (b.inX - b.x) / 0.9 * 2.5, iz = b.z + (b.inZ - b.z) / 0.9 * 2.5;
      if (s.furn.some((q) => q.floor === 0 && Math.hypot(q.x - ix, q.z - iz) < q.r + 0.9) || Math.abs(ix) > s.H - 0.6 || Math.abs(iz) > s.H - 0.6) continue;
      const score = Math.abs(W.x); if (!best || score < best.score) best = { score, i, b, W, n }; } });
  if (!best) { const h = run.houses[0]; best = { i: 0, W: new THREE.Vector3(h.doorX, 0, h.doorZ), n: new THREE.Vector3(0, 0, -Math.sign(h.doorZ) || 1) }; }
  return { i: best.i, W: best.W, n: best.n, u: new THREE.Vector3(best.n.z, 0, -best.n.x) };
}
function opGlow(color, size, opacity) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: introGlow(), color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity })); s.scale.setScalar(size); return s; }
// the lit windows of every house (warm light behind the opening, a glow outside); nearest the target first, as many as the tier allows
function opWindows(I) {
  const C = CONFIG.opening, G = C.grid, T = C[QUALITY === 'high' ? 'high' : 'low'], all = [];
  run.houses.forEach((h, i) => { const hg = world.houses[i]; for (const b of h.sim.breaches) { if (b.type !== 'window') continue;
    const inx = (b.inX - b.x) / 0.9, inz = (b.inZ - b.z) / 0.9, p = hg.localToWorld(new THREE.Vector3(b.x + inx * 0.32, b.floor * FH + 1.8, b.z + inz * 0.32)), q = hg.localToWorld(new THREE.Vector3(b.x - inx * 0.7, b.floor * FH + 1.8, b.z - inz * 0.7));
    all.push({ p, q, target: i === I.i && b.floor === 0 && Math.hypot(p.x - I.W.x, p.z - I.W.z) < 0.6, d: Math.hypot(p.x - I.W.x, p.z - I.W.z) + b.floor * 2 }); } });
  all.sort((a, b) => a.d - b.d); const use = all.slice(0, T.windows); const far = use.filter((w) => !w.target).sort((a, b) => b.d - a.d);
  far.forEach((w, k) => { w.off = G.winOff[0] + k * G.winOff[1]; }); use.filter((w) => w.target).forEach((w) => { w.off = G.targetOff; });
  for (const w of use) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.7), new THREE.MeshBasicMaterial({ color: G.warm, fog: false })); pl.position.copy(w.p); pl.lookAt(w.q); w.pl = pl; I.grp.add(pl);
    w.gl = opGlow(G.warm, G.glow, 0.55); w.gl.position.copy(w.q); I.grp.add(w.gl);
    if (w.target) { w.dev = opGlow(G.device[0], G.device[1], 0); w.dev.position.copy(w.p).lerp(w.q, 0.6); I.grp.add(w.dev); } }
  I.wins = use;
}
// street lamps along both sides near the target (built for the film only), with real light under the nearest on desktop
// (R4, lead area 2; diagnose 8 light ledger: the film had 6 real point lights, dying to intensity 0 one by one) the film's lamp lights, the device light and the
// machine's rim light are shader lamps (src/houselamps.js): a dead lamp (intensity 0) is not drawn at all
function opLamps(I) {
  const G = CONFIG.opening.grid, T = CONFIG.opening[QUALITY === 'high' ? 'high' : 'low'], [n, gap, side, hgt] = G.lamps, per = Math.min(n, T.lamps), metal = new THREE.MeshLambertMaterial({ color: 0x23262a });
  I.lamps = [];
  for (const sz of [-1, 1]) for (let k = 0; k < per; k++) { const x = I.W.x + (k - (per - 1) / 2) * gap + (sz > 0 ? gap * 0.35 : 0), g = new THREE.Group(); g.position.set(x, 0, sz * side);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, hgt, 8), metal); pole.position.y = hgt / 2; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.0), metal); arm.position.set(0, hgt - 0.05, -sz * 0.45); g.add(arm);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.26, 0.2, 10), metal); head.position.set(0, hgt - 0.15, -sz * 0.9); g.add(head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6), new THREE.MeshBasicMaterial({ color: G.lampColor, fog: false })); bulb.position.set(0, hgt - 0.27, -sz * 0.9); g.add(bulb);
    const gl = opGlow(G.lampColor, 2.6, 0.75); gl.position.copy(bulb.position); g.add(gl); I.grp.add(g);
    I.lamps.push({ g, bulb, gl, x, z: sz * side - sz * 0.9, light: null }); }
  const camEnd = opAt(I, G.cam[G.cam.length - 1][1], 0, G.cam[G.cam.length - 1][3]);
  I.lamps = I.lamps.filter((l) => { const ok = Math.hypot(l.x - camEnd.x, l.z - camEnd.z) >= G.lampClear; if (!ok) { I.grp.remove(l.g); drop(l.g); } return ok; });
  I.lamps.sort((a, b) => Math.hypot(b.x - I.W.x, b.z - I.W.z) - Math.hypot(a.x - I.W.x, a.z - I.W.z)).forEach((l, k) => { l.off = G.lampOff[0] + k * G.lampOff[1]; });
  if (T.lights) I.lamps.slice().sort((a, b) => Math.hypot(a.x - camEnd.x, a.z - camEnd.z) - Math.hypot(b.x - camEnd.x, b.z - camEnd.z)).slice(0, 4).forEach((l) => { l.light = HL_ON ? addLamp(houseLamp(G.lampLight[0], G.lampLight[1], G.lampColor)) : new THREE.PointLight(G.lampColor, G.lampLight[0], G.lampLight[1], 2); l.light.position.set(l.x, G.lamps[3] - 0.5, l.z); I.grp.add(l.light); });
}
// a light that flickers before it dies: 1 on, 0 off
function opFlick(t, off, flick) { if (t < off - flick) return 1; if (t >= off) return 0; const k = (off - t) / flick; return Math.sin(t * 47) + Math.sin(t * 23) > 0.6 - k ? 1 : 0.12; }
function opMachine(kind, dormant) { const o = GK.gloomMachine(kind, { dormant }); applyRelief(o); shadeUnder(o, CONFIG.depth.gloom, 0.03);
  // an awake machine gets a soft glow on its screen (phones have no screen lights; CONFIG.opening.grid.screenGlow)
  if (!dormant && o.userData.lamp) { const G = CONFIG.opening.grid.screenGlow, s = opGlow(o.userData.lampColor, G[0], G[1]); s.position.copy(o.userData.lamp); o.add(s); }
  return o; }
// LAG FIX Nov 19 (owner 12:17, the film's 1.4-2.2 s frames): the film's black is shown and painted first, then the film's street is built under it; its shaders are
// built in the background (compileAsync) and every piece drawn once under the black (filmWarm) before the film's clock starts; the same at the dawn shot. (Not in the
// scripted checks: they keep the old timing.)
// (H round 2: one draw of the whole street held a 15.8 s frame under the black, medium Mac 44468118946) its pieces are drawn on screen under the black in parts,
// CONFIG.lag.slice.film ms of them a frame (FILM.warm: draw calls made), then the GPU is made to finish
function filmWarm(I) { if (BOTRUN() || !CONFIG.lag.filmWarm) return; I.hold = true; const L = CONFIG.lag.card, S = CONFIG.lag.slice, raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  // (R3, Mac 44481169893: 11.5 s getProgramParameter < onFirstUse in the film's start, held frames of 19-22 s) the draws wait until every shader has finished
  // building in the background (CONFIG.lag.filmCompileCap, not the card's 12 s): a draw of a shader still building waited for it inside one frame
  // (R4 item D, card 28: "MeshStandardMaterial map transparent [edge.png]" and 5 more built in shown film frames) the simple surfaces are turned into their
  // physically based form first (fx.upgradeNow, as the cards do), so the shaders built here are the ones drawn; fx's own walk upgraded them later, in a shown frame
  { const tu = performance.now(); if (fx && fx.upgradeNow) fx.upgradeNow(); FILM.upgradeMs = Math.round(performance.now() - tu); FILM.compileSyncMax = 0; FILM.compileSyncSum = 0; FILM.drawSyncMax = 0; FILM.gpuWaitMax = 0; FILM.parts = 0; }
  // (owner Nov 22: a bright flash in the base after skipping the opening) the parts below draw pieces straight to the screen under the film's black; a skip
  // takes the black away at once, and the parts went on, one clear-and-draw of a few pieces a frame over the base, for 1-2 s on a fast machine (40 s on a slow
  // one). gone(): this film was skipped or ended, so no part is drawn after that
  const gone = () => intro !== I;
  (async () => { try { const tc = performance.now(); let built = !renderer.compileAsync;
    // (Nov 20, PROFILE 44737704647: under the black one frame of 1.6 s built 64 shaders' sources at once, and the next frame came 7.9 s later while the GPU
    // linked them all) CONFIG.lag.filmCompileParts: the street's shaders are built one top-level piece at a time, each waited for before the next, so frames
    // keep coming between them; the whole still stops at filmCompileCap
    // (Nov 20, run 44742360755: with a part per top-level piece every step of the black was short in the page (longest 0.3 s) and still no frame came for 9.1 s:
    // the first parts asked for nearly all 64 shaders at once and the GPU built them in one go) one material at a time: the first piece of each material (by
    // material, skinned, instanced) is built and waited for before the next, so the GPU has one shader to build between two frames
    if (renderer.compileAsync && CONFIG.lag.filmCompileParts) { const seen = new Set(), roots = []; scene.traverse((o) => { if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine) || o === sky.mesh || !o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { const k = m.uuid + (o.isSkinnedMesh ? 's' : '') + (o.isInstancedMesh ? 'i' : '') + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : ''); if (!seen.has(k)) { seen.add(k); if (roots[roots.length - 1] !== o) roots.push(o); } } });
      const capAt = tc + CONFIG.lag.filmCompileCap * 1000; built = true; FILM.compileParts = roots.length;
      let rk = 0; for (const c of roots) { if (gone()) break; FILM.step = 'compile ' + (++rk) + '/' + roots.length; filmCardFill(0.55 + 0.2 * rk / roots.length); if (performance.now() > capAt) { built = false; break; } if (!c.parent) continue; const t1 = performance.now(), n0 = nProg(), pr = renderer.compileAsync(c, cam, scene).catch(() => {}), d1 = performance.now() - t1; FILM.compileSyncMax = Math.max(FILM.compileSyncMax, Math.round(d1)); FILM.compileSyncSum += Math.round(d1);
        // a piece whose shader exists already is not waited for (the wait is at least one timer tick)
        if (nProg() !== n0) { const tw = performance.now(); await Promise.race([pr, nap(Math.max(0, capAt - performance.now()))]); FILM.compileWaitMax = Math.max(FILM.compileWaitMax || 0, Math.round(performance.now() - tw)); FILM.compileNew = (FILM.compileNew || 0) + 1; await raf(); } } }
    else if (renderer.compileAsync) await Promise.race([renderer.compileAsync(scene, cam).then(() => { built = true; }), nap(CONFIG.lag.filmCompileCap * 1000)]);
    FILM.compileMs = Math.round(performance.now() - tc); FILM.compileCut = !built;
    // (Nov 20, the home card after the film 2.8-4.1 s on the Mac: the base built under the black was first drawn under that card) the base's pieces are drawn here
    // too when it is built and not in the scene (CONFIG.lag.filmBase): it is put in for these parts and taken out after them
    const fbg = CONFIG.lag.filmBase && bview.group && !bview.group.parent && bview.group.children.length ? bview.group : null; if (fbg) { scene.add(fbg); FILM.fbg = fbg; }
    const tl = performance.now(); const list = []; scene.traverse((o) => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o !== sky.mesh) list.push(o); }); FILM.warm = 0; FILM.listMs = Math.round(performance.now() - tl); FILM.basePieces = fbg ? 1 : 0;
    // (R4 item B, card 27) after each part the GPU's own time for it is waited for (gpuDone) before the next; the closing gl.finish() (one frame that waited for
    // the whole queue) is a last fence wait now
    // (diagnose 7: parts sized by the fence wait shrank to 1-2 pieces, the wait being frame latency, not GPU work: cards of 26-183 s) the part stays S.film ms of
    // sending; only the wait after it is the GPU's (gpuDone) instead of one frame
    // (R4 item D, card 28: diagnose 7 'base 109112': 5 depth programs (render.jpg, canopy.png, glaze.jpg, the player's suit) built in the first base frames after the
    // film) the parts also draw the shadow maps (as the cards' parts do) and the body shadow is warmed, so the depth programs are built under the black
    const G = CONFIG.lag.gpuPart, gp = G && G.on; if (pshadow.warm) pshadow.warm();
    FILM.step = 'compiled'; for (let i = 0; i < list.length && !gone();) { FILM.step = 'draw ' + i + '/' + list.length; filmCardFill(0.75 + 0.25 * i / Math.max(1, list.length)); const t0 = performance.now(); while (i < list.length && !gone() && performance.now() - t0 < S.film) { const e = Math.min(list.length, i + (S.filmDraws || S.draws)); renderer.shadowMap.needsUpdate = true; FILM.warm += drawPieces(list, i, e, null); i = e; if (S.filmDraws) break; }
      FILM.parts = (FILM.parts || 0) + 1; FILM.drawSyncMax = Math.max(FILM.drawSyncMax, Math.round(performance.now() - t0)); if (gp) { const w = await gpuDone(G.cap); FILM.gpuWaitMax = Math.max(FILM.gpuWaitMax, Math.round(w)); } else await raf(); }
    if (fbg && fbg.parent === scene) scene.remove(fbg);
    // (R4 item D, card 28: diagnose 7 'intro 102695: 6 programs', the hands' own materials: MeshStandardMaterial #b08a3c, #8a8468, the cells map 64x64, the water
    // #4aa8e8, src/hands.js) the film shows the hands in its turning part (CONFIG.opening.turning.hands) and their scene was never drawn under the black: it is now
    FILM.step = 'hands'; if (hands.warm && !gone()) hands.warm(renderer, cam.aspect);
    if (gp) await gpuDone(G.cap); else { try { renderer.getContext().finish(); } catch (e) { /* no context */ } } } catch (e) { /* the film runs as before */ } finally { FILM.step = ''; filmCardOff(); FILM.prepT = 0; FILM.frac = 1; if (FILM.pre) FILM.preHold = true; if (FILM.fbg && FILM.fbg.parent === scene) scene.remove(FILM.fbg); FILM.fbg = null; if (FILM.preHold) { FILM.preHold = false; FILM.preDone = true; I.hold = true; } else I.hold = false; } })(); }
// (Nov 20, PROFILE 44648754836: 6 MeshDepthMaterial programs and 17 new shadow-target draw states in the first play frame after the first ride card) three r187
// keys every program, the shadow passes' depth programs too, on the light counts of the render BEFORE it (the shadow maps are drawn before that render's own lights
// are counted). With Marla's lights split off (ML.on) each play frame is: street render (sun shadow pass under the counts her pass left: the scene's lights plus her
// two), then her pass (her key's shadow pass under the street's counts). The card's parts (drawPieces) follow one another, so they only ever built the sun's depth
// programs under the street's counts: the other set was first needed in play. CONFIG.lag.shadowSets: under the card, after her pass, the shadow maps alone are drawn
// once with every piece shown and not culled (no piece goes to the screen: the camera looks at layer 31, which holds only the lights): the scene's lights after her
// pass, then her key after the street's counts, then the counts put back to the street's. Returns the draw calls made.
function shadowSets(list) { if (!ML.on || !CONFIG.lag.shadowSets) return 0; const B = 31, c0 = RSTAT.calls, cm = cam.layers.mask, pt = renderer.getRenderTarget(), own = [], hers = [], shm = [], was = [], lods = [];
  scene.traverse((o) => { if (!o.isLight) return; (ML.lights.includes(o) ? hers : own).push(o); if (o.castShadow && o.shadow && o.shadow.camera) { shm.push([o.shadow.camera, o.shadow.camera.layers.mask]); o.shadow.camera.layers.set(7); } });
  for (const o of list) { was.push([o, o.visible, o.frustumCulled, o.layers.mask]); o.visible = true; o.frustumCulled = false; o.layers.enable(7); for (let q = o.parent; q && q !== scene; q = q.parent) { if (q.isLOD && q.autoUpdate) { q.autoUpdate = false; lods.push(q); } if (!q.visible) { was.push([q, false, q.frustumCulled, q.layers.mask]); q.visible = true; } } }
  const pass = (ls, sh) => { for (const l of ls) l.layers.enable(B); renderer.shadowMap.needsUpdate = sh; try { renderer.render(scene, cam); } finally { for (const l of ls) l.layers.disable(B); } };
  try { ML.sh = false; marlaPass(); cam.layers.set(B); renderer.setRenderTarget(null); pass(own, true); if (hers.some((l) => l.castShadow)) pass(hers, true); pass(own, false); } catch (e) { /* drawn at first use instead */ }
  finally { renderer.setRenderTarget(pt); cam.layers.mask = cm; for (const [o, v, f, m] of was) { o.visible = v; o.frustumCulled = f; o.layers.mask = m; } for (const [c, m] of shm) c.layers.mask = m; for (const q of lods) q.autoUpdate = true; }
  return RSTAT.calls - c0; }
// draws the pieces list[i0..i1) once, each shown and not culled, alone (layer 7), into target (null: the screen; the film's black covers it); the scene's lights
// take part; everything is put back. Returns the draw calls made.
// (R4 item D, card 28) a piece inside a THREE.LOD was hidden again by the LOD's own update during this draw (three.js projectObject: lod.update(camera) sets each
// level's visible), so the level not in use was never drawn here and built its shader when the distance changed in play; the LOD is held still while drawn.
// On the tier with contact shading (GTAO) the pieces are also drawn into its normal pass (its MeshNormalMaterial, one program per kind of piece: 3-4 were built
// in play on high, diagnose 6)
// (R4, card 27: diagnose 7 44504877710 GPU timer: 'card shadow' 68.5 s of GPU in the medium run vs 'card main' 43.3 s) each part redrew the WHOLE shadow map:
// once the night cull has put its layer on a shadow camera (src/nightcull.js), three.js draws that camera's layers, not the main camera's layer 7, so every
// caster in the scene was drawn into the shadow map again for each part. The shadow cameras now take layer 7 alone while a part is drawn (only the part's
// pieces go into the shadow maps, which still builds their depth programs); put back after.
function drawPieces(list, i0, i1, target) { const lights = [], was = [], lods = [], shm = []; scene.traverse((o) => { if (o.isLight && !(ML.on && ML.lights.includes(o))) { lights.push(o); o.layers.enable(7); if (o.castShadow && o.shadow && o.shadow.camera) { shm.push([o.shadow.camera, o.shadow.camera.layers.mask]); o.shadow.camera.layers.set(7); } } });
  for (let k = i0; k < i1; k++) { const o = list[k]; if (ML.on && marlaHas(o)) continue; was.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; o.layers.enable(7); for (let q = o.parent; q && q !== scene; q = q.parent) { if (q.isLOD && q.autoUpdate) { q.autoUpdate = false; lods.push(q); } if (!q.visible) { was.push([q, false, q.frustumCulled]); q.visible = true; } } }
  const cm = cam.layers.mask, c0 = RSTAT.calls, pt = renderer.getRenderTarget(), ao = fx && fx.ao && fx.aoOn && fx.ao.normalRenderTarget ? fx.ao : null; cam.layers.set(7); renderer.setRenderTarget(target);
  try { renderer.render(scene, cam); if (ao) { const hid = []; for (let k = i0; k < i1; k++) { const o = list[k], m = o.material; if (o.isSprite || o.isPoints || o.isLine || o.userData.noAO || (m && !Array.isArray(m) && (m.transparent || m.alphaTest > 0))) { hid.push(o); o.visible = false; } }
    // the shading pass's own rule (src/fx.js: no sprites, points, lines, see-through or cut-out pieces, noAO), but NOT its distance cut: a piece far at the card can be near in play
    scene.overrideMaterial = ao.normalMaterial; renderer.setRenderTarget(ao.normalRenderTarget); try { renderer.render(scene, cam); } finally { for (const o of hid) o.visible = true; } } } catch (e) { /* drawn at first use instead */ } finally { scene.overrideMaterial = null; renderer.setRenderTarget(pt); cam.layers.mask = cm; for (const [o, v, f] of was) { o.visible = v; o.frustumCulled = f; o.layers.disable(7); } for (const l of lights) l.layers.disable(7); for (const [c, m] of shm) c.layers.mask = m; for (const q of lods) q.autoUpdate = true; }
  return RSTAT.calls - c0; }
// LAG FIX Nov 19 (owner 13:10, the film's start frame: "1224 ms blob < streetScenery < finish < buildWorld < needWorld < startIntro"): a player's film start is prepared
// in TIME SLICES under its black (filmPrep, stepped by filmSlice each frame: at most CONFIG.lag.slice.ms of parts a frame, one part is not cut): the scene cleared,
// the base built (or what the title left of it: src/baseview.js bgStep), then the street (src/world.js buildWorldIter); startIntro then finds them built (FILM.ready).
// FILM.worst: the longest prep frame's work (ms), FILM.ms: the whole prep, for perfcheck.
const FILM = { it: null, ready: false, worst: 0, ms: 0, t0: 0 };
// (owner Nov 20 22:37: "no one wants to see a black screen ... you have a loading screen, use it") while the film's street is prepared the loading card is shown
// over the film's black with a bar that follows the work: what the title left of the base (to 0.2), the street's build (to 0.55, by time, never full), its
// shaders (to 0.75, by material), its first draws (to 1, by piece); taken away when the film's clock starts
// (owner Nov 20 22:40: "you have a loading bar yet don't put the film in the loading bar") CONFIG.lag.loadFilm: for a first-time player (who gets the film from
// the begin button) the film's whole preparation runs on the loading page as its last stage ('Opening film'): filmPre() starts it as the button's click would,
// keeps the loading page on top of the film's black, and the film stays held when ready (FILM.preDone); filmGo() (the begin or watch button) takes the loading
// page away and lets the film run. If the button is pressed before it is ready, the rest is done under the loading card (filmCardOn) as before
// true when this page's first-time player will get the film from the begin button (so the loading page keeps a stage for it)
function filmPreWanted() { if (BOTRUN() || NOFILM || !CONFIG.lag.loadFilm || !CONFIG.lag.loadFilm.on || !CONFIG.lag.filmWarm || !CONFIG.opening.on) return false; try { return !(storage && storage.getItem('solardg.save')); } catch (e) { return true; } }
function filmMenuOver() { if (!FILM.pre) return; const m = $('menu'); m.style.display = 'flex'; m.style.zIndex = '45'; }
function filmPre() { if (FILM.pre || FILM.it || BOTRUN() || NOFILM || !CONFIG.lag.loadFilm || !CONFIG.lag.loadFilm.on || !CONFIG.lag.filmWarm || !CONFIG.opening.on || state !== 'menu') return false; let had = false; try { had = !!(storage && storage.getItem('solardg.save')); } catch (e) { had = false; } if (had) return false;
  if (!preSave) titleBase(); if (!preSave) return false; save = preSave; carry = save.carry || null; FILM.pre = true; FILM.preDone = false; FILM.frac = 0; startIntro(); if (!FILM.it && !(intro && intro.video)) { FILM.pre = false; save = null; return false; } filmMenuOver(); return true; }
function filmGo() { const m = $('menu'); m.style.display = 'none'; m.style.zIndex = ''; const done = FILM.preDone; FILM.pre = false; FILM.preDone = false; if (done) { if (intro) intro.hold = false; } else filmCardOn(); }
function filmCardOn() { if (!CONFIG.lag.card || !CONFIG.lag.card.on || !CONFIG.lag.filmCard || FILM.pre) return; FILM.card = true; $('lct').textContent = CONFIG.lag.card.titles.film || ''; $('lfill').style.width = Math.round((FILM.frac || 0.02) * 100) + '%'; $('lcard').style.display = 'flex'; }
function filmCardFill(k) { FILM.frac = Math.max(0.02, Math.min(1, k)); if (FILM.card) $('lfill').style.width = Math.round(Math.max(0.02, Math.min(1, k)) * 100) + '%'; }
function filmCardOff() { if (!FILM.card) return; FILM.card = false; if (!LCARD.on) $('lcard').style.display = 'none'; }
function introClear() { clearScene(); dropWorld(); bview.dispose(); sim = null; ui = null; paused = false;
  // she is at your door when you wake
  if (save.day === 1 && !save.nights) save.scoutSpot = 4; }
// (owner 11:40) the base is built under the film's opening black and kept hidden (src/baseview.js, CONFIG.lag.keepBase; its shaders built in the background), so the
// dawn shot shows it without building it; in parts (yield) for filmPrep, at once for the scripted checks
function* introBase() { if (!CONFIG.lag.keepBase) return; const g = bview.group;
  try { bview.build(save); yield; applyRelief(g); yield; noSmallCasters(g); yield; bview.mergeStill(); yield; unifyBase(); yield; if (renderer.compileAsync) renderer.compileAsync(g, cam, scene).catch(() => {}); } catch (e) { /* built at the dawn shot instead */ } bview.dispose(); }
function* filmPrep() { yield 'frame'; yield 'frame'; gloomPreload(FILM_KINDS); askAllHi(); bview.preChars(); yield;
  // (Nov 20, the home card after the film 2.4-5.5 s on the Mac: a film started before the title had finished the base left its pieces to be drawn first under
  // that card) CONFIG.lag.titleDraw.film: what the title had left of the base (build, passes, shaders, the corner draws) is finished here under the black, a
  // frame at a time, before the film's own preparation; a title that had finished costs nothing here
  if (CONFIG.lag.titleDraw && CONFIG.lag.titleDraw.on && CONFIG.lag.titleDraw.film) { const tf = performance.now(); let n = 0; while (TB.phase && TB.phase !== 'done' && performance.now() - tf < CONFIG.lag.titleDraw.filmCap * 1000) { baseSlice0(true); n++; filmCardFill(TB.phase === 'draw' && TB.dl ? 0.08 + 0.12 * TB.di / Math.max(1, TB.dl.length) : TB.phase === 'compile' ? 0.07 : TB.phase === 'post' ? 0.05 : 0.03); yield 'frame'; } FILM.titleLeft = [n, Math.round(performance.now() - tf), TB.phase]; }
  introClear(); yield;
  if (CONFIG.lag.keepBase) { bview.bgStart(save); while (bview.bgBusy && !bview.bgStep(0)) yield; yield* introBase(); }
  yield; run = RUN.createRun(CONFIG, 0, CONFIG.opening.seed, {}); yield; yield* worldIter();
  // (R3) the film's Gloom models and the street's sharp textures (both asked for only now) arrive under the black, so the film shows what it showed before
  { const tw = performance.now(); while ((FILM_KINDS.some((k) => glbState[k] === 'loading') || hiPending() > 0) && performance.now() - tw < CONFIG.lag.filmModelWait * 1000) yield 'frame'; FILM.modelWait = Math.round(performance.now() - tw); } }
function filmSlice() { if (!FILM.it) return; const S = CONFIG.lag.slice, t0 = performance.now();
  if ((FILM.card || FILM.pre) && !(TB.phase && TB.phase !== 'done' && FILM.titleLeft === undefined)) { FILM.prepT = FILM.prepT || t0; filmCardFill(0.2 + 0.35 * (1 - Math.exp(-(t0 - FILM.prepT) / 8000))); }
  for (;;) { let r; try { r = FILM.it.next(); } catch (e) { r = { done: true }; FILM.err = String(e && e.stack || e).slice(0, 300); }
    if (r.done) { FILM.it = null; FILM.ready = !FILM.err; const ts = performance.now(); try { startIntro(); filmMenuOver(); if (!(intro && intro.hold)) { filmCardOff(); if (FILM.pre) FILM.preDone = true; } } finally { FILM.ready = false; startIntro.go = false; FILM.ms = Math.round(ts - FILM.t0); FILM.introMs = Math.round(performance.now() - ts); } return; }
    if (r.value === 'frame' || performance.now() - t0 >= S.film) { FILM.worst = Math.max(FILM.worst, performance.now() - t0); return; } } }
function startIntro() { if (CONFIG.opening.on && save && vidOn()) { startVideoIntro(); return; } if (!BOTRUN() && CONFIG.lag.filmWarm && !startIntro.go && CONFIG.opening.on && save) { $('menu').style.display = 'none'; $('cine').style.display = 'block'; $('cineFade').style.opacity = 1; $('hud').style.display = 'none'; state = 'intro'; intro = { t: 0, hold: true, prep: true }; startIntro.go = true; FILM.worst = 0; FILM.err = null; FILM.t0 = performance.now(); FILM.it = filmPrep(); filmCardOn(); return; }
  if (!FILM.ready) { gloomPreload(FILM_KINDS); bview.preChars(); }
  if (!CONFIG.opening.on) { startIntroOld(); return; }
  if (!save) return; if (!FILM.ready) { introClear(); const it = introBase(); while (!it.next().done); }
  const C = CONFIG.opening, G = C.grid; state = 'intro';
  $('menu').style.display = 'none'; $('hud').style.display = 'none'; $('cine').style.display = 'block'; $('cineFade').style.opacity = 1; $('cineCap').textContent = ''; opLids(0);
  if (!FILM.ready) run = RUN.createRun(CONFIG, 0, C.seed, {}); scene.fog = DESO.on ? new THREE.Fog(CONFIG.desolate.over.fogColor, CONFIG.desolate.over.fogNear, CONFIG.desolate.over.fogFar) : new THREE.Fog(0xbfe6f0, 20, 80);
  needWorld().frame(-1); skyK = G.night; applySky(skyK, 0); GK.nightGlow(1);
  // (R4 worker 8, Card 45: plain medium 44560403739 'programs in play' 15, one entry ['intro', 26.0 s]) the film's black (#cineFade opacity 1, set above) holds the
  // picture from here, but I.hold was set only in filmWarm (end of this function), after the hidden machines' compileAsync below, so they were built in an
  // un-held moment under the black; I.hold now starts when the black does, on the same condition filmWarm sets it on
  const I = intro = { t: 0, part: 'town', p: 0, grp: new THREE.Group(), walkers: [], skipT: 0, hold: !BOTRUN() && !!CONFIG.lag.filmWarm }; scene.add(I.grp);
  Object.assign(I, opTarget()); opWindows(I); opLamps(I);
  const M = G.machine, mp = opAt(I, M[1], 0, M[2]); I.face = Math.atan2(-I.n.x, -I.n.z); I.mach = { kind: M[0], x: mp.x, z: mp.z, o: opMachine(M[0], true), awake: false };
  I.mach.o.position.copy(mp); I.mach.o.rotation.y = I.face + M[3]; I.grp.add(I.mach.o);
  // (owner 11:40) the awake machine is built now, hidden at the same spot (its shaders built in the background), and shown at the wake, not built at 10.3 s
  { const o = opMachine(M[0], false); o.position.copy(mp); o.rotation.y = I.face + M[3]; I.mach.pre = o; I.grp.add(o); if (renderer.compileAsync) renderer.compileAsync(o, cam, scene).catch(() => {}); o.visible = false; }
  const T2 = C.turning, dp = opAt(I, T2.device[1], 0, T2.device[2]); I.dev = deviceMesh(T2.device[0]); I.dev.position.copy(dp); I.dev.rotation.y = I.face + T2.device[3]; I.dev.visible = false; I.grp.add(I.dev);
  // (owner 11:40) the machines that pass the window are built now, hidden (they were built when the shot moved inside); their shaders built in the background
  for (const w of T2.walkers) { if (QUALITY !== 'high' && !w[8]) continue; const o = opMachine(w[0], false); I.grp.add(o); if (renderer.compileAsync) renderer.compileAsync(o, cam, scene).catch(() => {}); o.visible = false; I.walkers.push({ w, o }); }
  // (owner 11:40) the night's machine lights are in the scene (dark) from the start of the film, so the light count does not change mid-film (which rebuilt the shaders)
  for (const l of glights) { l.visible = true; l.intensity = 0; }
  if (C[QUALITY === 'high' ? 'high' : 'low'].lights) { I.devL = HL_ON ? addLamp(houseLamp(0, T2.light[2], T2.light[0])) : new THREE.PointLight(T2.light[0], 0, T2.light[2], 2); I.devL.position.set(dp.x, 0.6, dp.z); I.grp.add(I.devL); }
  { const R = G.rim, rp = opAt(I, M[1] + R[3], R[4], M[2] + R[5]); I.rim = HL_ON ? addLamp(houseLamp(0, R[2], R[0])) : new THREE.PointLight(R[0], 0, R[2], 2); I.rim.position.copy(rp); I.grp.add(I.rim); }
  I.fov0 = cam.fov; renderer.shadowMap.needsUpdate = true; filmWarm(I);
}
// the eyelids (part 4): closed share 0..1 (made once, inside #cine)
function opLids(closed) {
  let a = $('cineLidT'); if (!a) { for (const id of ['cineLidT', 'cineLidB']) { const d = document.createElement('div'); d.id = id; d.style.cssText = 'position:absolute;left:-5%;right:-5%;height:58%;pointer-events:none;background:#000;' + (id === 'cineLidT' ? 'top:0;border-radius:0 0 50% 50%/0 0 30% 30%;box-shadow:0 10px 40px 20px #000' : 'bottom:0;border-radius:50% 50% 0 0/30% 30% 0 0;box-shadow:0 -10px 40px 20px #000'); $('cine').insertBefore(d, $('cineCap')); } a = $('cineLidT'); }
  const k = Math.max(0, Math.min(1, closed)), b = $('cineLidB'); sty(a, 'transform', 'translateY(' + (-115 * (1 - k)) + '%)'); sty(b, 'transform', 'translateY(' + (115 * (1 - k)) + '%)'); // (owner 11:40) written only on change
}
// screen light on the nearest awake machines (the same pool of lights the night uses)
// (owner 11:40) without lists made each frame: OPS (kept) holds the lit machines, nearest first
const OPS = [], opsCmp = (a, b) => a.userData.opD2 - b.userData.opD2;
function opScreens(list) { OPS.length = 0; for (const o of list) if (o && o.userData.lamp && o.visible) { o.userData.opD2 = o.position.distanceToSquared(cam.position); OPS.push(o); } OPS.sort(opsCmp);
  glights.forEach((l, i) => { l.visible = true; const m = OPS[i]; if (!m) { l.intensity = 0; return; } gl_v.copy(m.userData.lamp); if (!m.matrixWorldAutoUpdate) m.updateWorldMatrix(false, false); m.localToWorld(gl_v); l.position.copy(gl_v); l.color.set(m.userData.lampColor); l.intensity = CONFIG.gloomLook.lightPower * (m.userData.glow === undefined ? 1 : m.userData.glow); }); }
// part 1: lights die, the machine wakes and turns
function opGrid(I, t) {
  const C = CONFIG.opening, G = C.grid, c = opPath(G.cam, t), tt = performance.now() / 1000;
  { const p = opAt(I, c[0], 0, c[2], OPV[0]); cam.position.set(p.x, c[1], p.z); cam.lookAt(opAt(I, c[3], c[4], c[5], OPV[1])); }
  for (const w of I.wins) { const on = opFlick(t, w.off, G.winOff[2]); w.pl.material.color.setHex(G.warm).multiplyScalar(on ? 1 : 0.02); w.gl.material.opacity = 0.55 * on; if (w.dev) w.dev.material.opacity = t > w.off + 0.4 ? 0.5 + 0.12 * Math.sin(t * 2.1) : 0; }
  for (const l of I.lamps) { const on = opFlick(t, l.off, G.lampOff[2]); l.bulb.material.color.setHex(G.lampColor).multiplyScalar(on ? 1 : 0.05); l.gl.material.opacity = 0.75 * on; if (l.light) l.light.intensity = G.lampLight[0] * on; }
  const m = I.mach;
  if (!m.awake && t >= G.wakeAt + G.flick) { const o = m.pre || opMachine(m.kind, false); m.pre = null; o.position.copy(m.o.position); o.rotation.y = m.o.rotation.y; o.visible = true; I.grp.remove(m.o); drop(m.o); m.o = o; if (o.parent !== I.grp) I.grp.add(o); m.awake = true; }
  const [t0, dur, steps] = G.turn, k = Math.max(0, Math.min(1, (t - t0) / dur)), st = Math.floor(k * steps), fr = k * steps - st, kk = Math.min(1, (st + OP_SM(Math.min(1, fr * 4))) / steps);
  m.o.rotation.y = I.face + G.machine[3] * (1 - kk); if (I.rim) I.rim.intensity = t >= G.wakeAt ? G.rim[1] : 0;
  if (m.awake) m.o.userData.anim(tt, { x: m.o.position.x, z: m.o.position.z }); else m.o.userData.anim(tt, null);
  // the dormant screen flickers awake (after its own idle pose, which keeps it dark)
  if (!m.awake && t >= G.wakeAt) { if (!m.scr) { m.scr = []; m.o.traverse((q) => { if (q.isMesh && q.material && q.material.isMeshBasicMaterial && q.material.map && q.material.color.r < 0.1) m.scr.push(q.material); }); } for (const s of m.scr) s.color.setScalar(Math.sin(tt * 31) > 0.2 ? 0.6 : 0.03); }
  (I.scr1 || (I.scr1 = [null]))[0] = m.awake ? m.o : null; opScreens(I.scr1);
}
// part 2: inside the target house; the machines pass the window
function opTurning(I, t, dt) {
  const C = CONFIG.opening, T = C.turning, hi = QUALITY === 'high', tt = performance.now() / 1000;
  if (!I.inside) { I.inside = true; for (const w of I.wins) { w.pl.visible = false; w.gl.visible = false; if (w.dev) w.dev.visible = false; } for (const l of I.lamps) { l.g.visible = false; if (l.light) l.light.intensity = 0; }
    I.dev.visible = true; if (I.devL) I.devL.intensity = T.light[1];
    { const m = I.mach; if (!m.awake) { const o = m.pre || opMachine(m.kind, false); m.pre = null; o.visible = true; o.position.copy(m.o.position); I.grp.remove(m.o); drop(m.o); m.o = o; I.grp.add(o); m.awake = true; } m.o.rotation.y = I.face; }
    if (!I.walkers.length) for (const w of T.walkers) { if (!hi && !w[8]) continue; const o = opMachine(w[0], false); o.visible = false; I.grp.add(o); I.walkers.push({ w, o }); } }
  const c = opPath(T.cam, t), sw = T.sway, p = opAt(I, c[0] + sw[0] * Math.sin(t * sw[1] * 6.28), c[1] + sw[0] * 0.6 * Math.sin(t * sw[1] * 4.1 + 1), c[2], OPV[0]);
  cam.position.copy(p); cam.lookAt(opAt(I, c[3], c[4], c[5], OPV[1]));
  for (const q of I.walkers) { const [, t0, sp, z, x0, x1, stopX, stopS] = q.w, dir = Math.sign(x1 - x0), run0 = t - t0; let x = x0 + dir * sp * Math.max(0, run0), still = false;
    if (stopX !== null && dir * (x - stopX) > 0) { const reach = Math.abs(stopX - x0) / sp; x = run0 < reach + stopS ? stopX : x0 + dir * sp * (run0 - stopS); still = run0 >= reach && run0 < reach + stopS; }
    q.o.visible = run0 > 0 && dir * (x1 - x) > 0; if (!q.o.visible) continue; const wp = opAt(I, x, 0, z, OPV[2]); q.o.position.copy(wp);
    q.o.rotation.y = still ? I.face : Math.atan2(I.u.x * dir, I.u.z * dir); q.o.userData.anim(tt, { x: wp.x, z: wp.z }); }
  const m = I.mach; m.o.userData.anim(tt, { x: m.o.position.x, z: m.o.position.z });
  if (I.dev.userData.tick) { try { I.dev.userData.tick(tt, { kind: C.turning.device[0], hp: CONFIG.devices[C.turning.device[0]].hp, x: I.dev.position.x, z: I.dev.position.z, floor: 0 }); } catch (e) { I.dev.userData.tick = null; } }
  if (!I.scr || I.scr[0] !== m.o) I.scr = [m.o, ...I.walkers.map((q) => q.o)]; opScreens(I.scr);
}
// leave the street: the base at dawn is built while the screen is black
function introToBase(noWarm) {
  const I = intro; if (!CONFIG.opening.on) { introToBaseOld(); return; } I.part = 'base'; if (I.grp) { scene.remove(I.grp); if (HL_ON) unlistHouseLamps(I.grp); drop(I.grp); I.grp = null; } I.walkers = [];
  dropWorld(); run = null; GK.nightGlow(0); glights.forEach((l) => { l.intensity = 0; l.visible = false; }); hemi.color.setHex(CONFIG.baseLight.sky); hemi.groundColor.setHex(CONFIG.baseLight.ground); sky.mesh.visible = false;
  scene.background = new THREE.Color(0xbfe6f0); scene.fog = new THREE.Fog(0xf6e8c8, 30, 95); if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure;
  bview.build(save); applyRelief(bview.group); I.hide = []; I.stands = []; bview.group.traverse((o) => { if (o.isSprite && o.renderOrder === 10) o.material.opacity = 0; if (o.isSprite && o.userData.kind) I.hide.push(o); if (o.isDirectionalLight && !I.sun) I.sun = o; if (opStandIn(o)) I.stands.push(o.parent); }); renderer.shadowMap.needsUpdate = true; shadowT = 1.5; if (!noWarm) filmWarm(I);
}
// a person's plain stand-in figure (src/baseview.js: a capsule body and a ball head in their own group, until the person's model has loaded)
function opStandIn(o) { const q = o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters; return !!q && ((q.radiusTop === 0.3 && q.radiusBottom === 0.38 && q.height === 1.2) || (q.radiusTop === 0.2 && q.radiusBottom === 0.26 && q.height === 1.3)) && !!o.parent; }
// stand-ins still in the base (their model not swapped in yet); they are hidden while the film runs
function opStands(I) { let n = 0; for (const g of I.stands || []) if (g.parent) { g.visible = false; n++; } return n; }
// part 3: sunrise light over the base (after bview.update, which sets the day sun)
function opDawn(I, t) {
  const D = CONFIG.opening.dawn, c = opPath(D.cam, t), k = OP_SM((t - D.cam[0][0]) / (D.cam[D.cam.length - 1][0] - D.cam[0][0])), mix = (a, b) => OPC[0].set(a).lerp(OPC[1].set(b), k);
  cam.position.set(c[0], c[1], c[2]); cam.lookAt(c[3], c[4], c[5]);
  if (I.sun) { I.sun.color.copy(mix(D.sun[0], D.sun[1])); I.sun.intensity *= D.sun[2] + (D.sun[3] - D.sun[2]) * k; }
  hemi.intensity = CONFIG.baseLight.power * (D.hemi[0] + (D.hemi[1] - D.hemi[0]) * k); hemi.color.copy(mix(D.hemiCol[0], D.hemiCol[1])); scene.background.copy(mix(D.sky[0], D.sky[1])); scene.fog.color.copy(mix(D.fog[0], D.fog[1])); scene.fog.near = D.fogNear; scene.fog.far = D.fogFar;
  if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure * (D.exposure[0] + (D.exposure[1] - D.exposure[0]) * k);
}
// part 4: waking in bed; eyelids, a little blur on desktop, then up and facing Marla at the door
function opWake(I, w) {
  const K = CONFIG.opening.wake, B0 = K.bed, S0 = K.stand, k = OP_SM((w - K.rise[0]) / K.rise[1]), sp = B.scoutPos(save), ty = Math.atan2(-(sp.x - S0[0]), -(sp.z - S0[2])), tp = Math.atan2(K.look - S0[1], Math.hypot(sp.x - S0[0], sp.z - S0[2]));
  cam.position.set(B0[0] + (S0[0] - B0[0]) * k, B0[1] + (S0[1] - B0[1]) * k, B0[2] + (S0[2] - B0[2]) * k); cam.rotation.set(B0[3] * (1 - k) + tp * k, ty * k + B0[4] * (1 - k), B0[5] * (1 - k), 'YXZ');
  const fv = I.fov0 + (K.fov - I.fov0) * k; if (Math.abs(cam.fov - fv) > 0.01) { cam.fov = fv; cam.updateProjectionMatrix(); }
  // Marla faces you; her marker beam and halo and every label are hidden for the shot; the plant inside the door too (phone tier)
  const mg = marla.root.parent; if (mg && mg !== scene && mg !== bview.group) { mg.rotation.y = Math.atan2(cam.position.x - mg.position.x, cam.position.z - mg.position.z); for (const c of mg.children) if (c !== marla.root && c.visible) { c.visible = false; I.hide.push(c); } }
  if (!I.pot) { I.pot = true; const H = K.hide, v = new THREE.Vector3(); bview.group.traverse((o) => { if (!o.isMesh || !o.geometry) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere.radius * o.getWorldScale(v).x; if (r > H[2]) return; o.getWorldPosition(v); if (Math.hypot(v.x - H[0], v.z - H[1]) < H[2] && v.y < 1.6) { o.visible = false; I.hide.push(o); } }); }
  opLids(lidAt(w)); sty(cvs, 'filter', QUALITY === 'high' && w < K.blur[1] ? 'blur(' + (K.blur[0] * (1 - w / K.blur[1])).toFixed(2) + 'px)' : '');
}
// the eyelids' closed share at the wake's time w (s), from CONFIG.opening.wake.lids (used by the 3D film and the video)
function lidAt(w) { const L = CONFIG.opening.wake.lids; let lid = 0; for (let i = 0; i < L.length - 1; i++) if (w >= L[i][0] && w <= L[i + 1][0]) lid = L[i][1] + (L[i + 1][1] - L[i][1]) * OP_SM((w - L[i][0]) / (L[i + 1][0] - L[i][0])); if (w > L[L.length - 1][0]) lid = L[L.length - 1][1]; return lid; }
// ---- VIDEO OPENING (owner Nov 22: "can't it be saved as a fixed item?"): the 3D opening recorded once (tools/filmrender.cjs) and played as a video; the captions,
// black fades, eyelids and music stay live, driven by the video's clock. No street is built and the film's machines are not fetched. If the video cannot play
// (no file, a page opened from a folder without it, a codec the browser lacks) the 3D film plays as before. ?film3d=1 asks for the 3D film; the scripted checks
// (webdriver) get the 3D film unless ?filmvideo=1 or ?cards=1 (the player's path)
const VID = { el: null, failed: false, ready: false, src: '' };
const VIDQ = (() => { try { const q = new URLSearchParams(location.search); return { v: q.get('filmvideo') === '1', d: q.get('film3d') === '1' }; } catch (e) { return { v: false, d: false }; } })();
function vidSrc() { const V = CONFIG.opening.video; let e; try { e = document.createElement('video'); } catch (x) { return ''; } const can = (t) => { try { return !!t && !!e.canPlayType(t); } catch (x) { return false; } };
  if (QUALITY !== 'low' && V.hiAv1 && can(V.av1Type)) return V.hiAv1; if (!can(V.type)) return ''; return QUALITY === 'low' ? V.lo : V.hi; }
function vidOn() { const V = CONFIG.opening.video; if (!V || !V.on || FILMREC || VID.failed || VIDQ.d || (BOTRUN() && !VIDQ.v)) return false; return !!vidSrc(); }
function vidFail(why) { if (VID.failed) return; VID.failed = true; VID.why = why; const v = VID.el; VID.el = null; VID.ready = false; if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* gone */ } v.remove(); }
  // the 3D film instead, from where the video was asked for (the loading page or after Enter)
  if (intro && intro.video) { const pre = FILM.pre; intro = null; startIntro.go = false; startIntro(); if (pre && !FILM.it && !intro) { FILM.pre = false; filmMenuOver(); } } }
function startVideoIntro() {
  const V = CONFIG.opening.video; $('menu').style.display = 'none'; $('hud').style.display = 'none'; $('cine').style.display = 'block'; $('cineFade').style.opacity = 1; $('cineCap').textContent = ''; opLids(0); state = 'intro';
  intro = { t: 0, video: true, part: 'town', hold: true, hide: [], stands: [] };
  const src = vidSrc(); let v = VID.el;
  if (!v || VID.src !== src) { if (v) v.remove(); v = VID.el = document.createElement('video'); VID.src = src; VID.ready = false; v.id = 'filmVid'; v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto';
    v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:' + (V.fit || 'contain') + ';background:#000;pointer-events:none';
    v.addEventListener('error', () => vidFail('error ' + (v.error ? v.error.code : '?')));
    const ok = () => { if (VID.ready || VID.el !== v) return; VID.ready = true; vidReady(); };
    v.addEventListener('canplaythrough', ok); v.addEventListener('progress', () => { if (FILM.pre || FILM.card) { try { const b = v.buffered, d = v.duration; if (b.length && d) filmCardFill(b.end(b.length - 1) / d); } catch (e) { /* not known yet */ } } });
    v.src = src; v.load(); clearTimeout(VID.waitT); VID.waitT = setTimeout(() => { if (!VID.ready && VID.el === v && v.readyState >= 3) ok(); else if (!VID.ready && VID.el === v) vidFail('slow'); }, V.waitMs);
  } else { try { v.currentTime = 0; } catch (e) { /* not seekable yet */ } }
  // the 3D picture behind the video is not shown (nothing in it belongs to the film): it comes back under the home card at the end
  $('cine').insertBefore(v, $('cine').firstChild); v.style.display = 'block'; FILM.err = null; cvs.style.visibility = 'hidden';
  if (VID.ready) vidReady(); else if (!FILM.pre) filmCardOn();
}
// the video can play through: on the loading page it waits for Enter (filmGo lets go of the hold); after Enter it starts at once
// (Mac 44992564917: 86 shaders built in shown frames at 1.7-1.9 s, 0 with the 3D film) the 3D film's preparation finished what the title had left of the
// base (its build, passes, shaders, corner draws: filmPrep, CONFIG.lag.titleDraw.film) under the loading page before the begin button; the video skipped that, so the
// title built those shaders in shown frames. The same finish is done here, a frame at a time, before the begin button (the film stage)
function vidReady() { if (!intro || !intro.video) return; clearTimeout(VID.waitT);
  if (FILM.pre) { const I = intro, TD = CONFIG.lag.titleDraw, tf = performance.now(); FILM.frac = 0.5;
    const step = () => { if (intro !== I || !FILM.pre) return; if (TD && TD.on && TD.film && TB.phase && TB.phase !== 'done' && performance.now() - tf < TD.filmCap * 1000) { baseSlice0(true); filmCardFill(0.5 + 0.4 * (TB.phase === 'draw' && TB.dl ? TB.di / Math.max(1, TB.dl.length) : 0)); requestAnimationFrame(step); return; }
      FILM.titleLeft = [Math.round(performance.now() - tf), TB.phase || 'none']; FILM.preDone = true; FILM.frac = 1; };
    step(); }
  else { intro.hold = false; if (FILM.card) filmCardOff(); } }
function videoFrame(dt) {
  const I = intro, C = CONFIG.opening, P = C.parts, v = VID.el; if (!v) return;
  if (I.hold || paused || document.hidden || (document.body.classList.contains('tall') && !document.body.classList.contains('portraitOk'))) { if (!v.paused) v.pause(); return; }
  if (v.paused && !v.ended) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => vidFail('play')); }
  const t = Math.min(v.currentTime || 0, P[4]); I.t = t;
  let cap = ''; for (const [a, z, tx] of C.lines) if (t >= a && t <= z) cap = tx; const ce = $('cineCap'); if (ce.textContent !== cap) ce.textContent = cap; ce.classList.toggle('who', /^MARLA/.test(cap));
  const part = t < P[1] ? 0 : t < P[2] ? 1 : t < P[3] ? 2 : 3, fade = Math.max(0, 1 - (t - P[part]) / C.fade, part === 3 ? 0 : 1 - (P[part + 1] - t) / C.fade);
  I.part = part >= 2 ? 'base' : 'town';
  sty($('cineFade'), 'opacity', String(Math.max(0, Math.min(1, part === 3 ? Math.max(0, 1 - (t - P[3]) / 0.4) : fade))));
  opLids(part === 3 ? lidAt(t - P[3]) : 0); musicTick(dt);
  if (v.ended || t >= P[4] - 0.02) finishIntro();
}
function finishIntro() {
  if (!intro || intro.prep) return; if (!CONFIG.opening.on) { finishIntroOld(); return; } const wasVid = !!intro.video, skipTown = intro.part === 'town' || wasVid, warming = !!intro.hold && !wasVid; if (skipTown) introToBase(true); const I0 = intro;
  if (wasVid && VID.el) { clearTimeout(VID.waitT); try { VID.el.pause(); } catch (e) { /* gone */ } VID.el.style.display = 'none'; } intro = null; opLids(0); cvs.style.filter = '';
  for (const o of (I0.hide || []).concat(I0.stands || [])) o.visible = true; if (I0.fov0 && cam.fov !== I0.fov0) { cam.fov = I0.fov0; cam.updateProjectionMatrix(); }
  scene.background = new THREE.Color(0xbfe6f0); scene.fog = new THREE.Fog(0xf6e8c8, 30, 95); hemi.intensity = CONFIG.baseLight.power; hemi.color.setHex(CONFIG.baseLight.sky); if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure;
  $('cine').style.display = 'none'; state = 'base'; ui = null; bp = { x: -0.6, z: -9.3 }; baseCamY = 1.6; bview.group.traverse((o) => { if (o.isSprite && o.renderOrder === 10) o.material.opacity = 1; }); const sp = B.scoutPos(save); yaw = Math.atan2(-(sp.x - bp.x), -(sp.z - bp.z)); pitch = 0; camY = 1.6; cam.rotation.set(0, yaw, 0, 'YXZ');
  $('hud').style.display = 'block'; $('hud').className = 'base'; $('bFire').textContent = 'USE'; save.seenIntro = true; persist(); flash('Dawn, day ' + save.day + '. Marla is ' + sp.hint + '. Talk to her to ride out. They say a lucky cat hides somewhere in the base.', 2);
  // (R4 worker 5, held frame of 7567 ms in diagnose 10: the film skipped in its street part built and drew the whole base in ONE frame: 1714 draws, 159 texture
  // uploads 6018 ms, 11 programs) the base's first frames are made under the home card instead (sliced parts, each waiting for the GPU), as Enter does
  // (R4 worker 6, lead 21:15) the first-time job card comes after the home card ends (both are z-index 40: under the card it closed unseen after jobCardSecs)
  // (owner Nov 22) a skip while the film's warm-up still runs (the dawn or wake hold) also goes through the home card: its draws were stopped part-way (gone())
  const back = () => { if (wasVid) cvs.style.visibility = ''; jobCard(); };
  if ((skipTown || warming) && CONFIG.lag.skipCard) { const c = sceneCard('home'); if (wasVid) requestAnimationFrame(() => { cvs.style.visibility = ''; }); c.then(back, back); } else back(); }
function introFrame(dt) {
  if (!CONFIG.opening.on) { introFrameOld(dt); return; }
  if (intro.video) { videoFrame(dt); return; }
  const I = intro, C = CONFIG.opening, P = C.parts; if (I.hold || (document.body.classList.contains('tall') && !document.body.classList.contains('portraitOk'))) return; I.t += dt; const t = I.t; // I.hold: filmWarm is still preparing under the black
  let cap = ''; for (const [a, z, tx] of C.lines) if (t >= a && t <= z) cap = tx; const ce = $('cineCap'); if (ce.textContent !== cap) ce.textContent = cap; ce.classList.toggle('who', /^MARLA/.test(cap));
  const part = t < P[1] ? 0 : t < P[2] ? 1 : t < P[3] ? 2 : 3, fade = Math.max(0, 1 - (t - P[part]) / C.fade, part === 3 ? 0 : 1 - (P[part + 1] - t) / C.fade);
  // the film's last frame still moves the base's people (from the bed, where the wake's camera is), so they do not stand still for one frame as you take over
  if (t >= P[4]) { if (part === 3) bview.update(dt, -0.6, -9.3, 1.6); finishIntro(); return; }
  if (part >= 2 && I.part === 'town') introToBase();
  // the wake waits (eyes shut) for the people's models, at most CONFIG.opening.wake.waitModels s; stand-ins left are hidden (opStands)
  if (part === 3 && t - P[3] < 0.5 && opStands(I) > 0 && (I.waitT = (I.waitT || 0) + dt) < C.wake.waitModels) { I.t = P[3]; }
  // (H round 2, warm-up gate: 6 programs built in a shown film frame at the wake: the people's models swapped in after the dawn shot's warm-up) once they are in,
  // with the eyes still shut, the scene is warmed again under a hold (filmWarm: shaders, then every piece drawn in parts)
  if (part === 3 && !I.wakeWarm && t - P[3] < 0.5 && opStands(I) === 0) { I.wakeWarm = true; filmWarm(I); if (I.hold) return; }
  if (part === 0) opGrid(I, t); else if (part === 1) opTurning(I, t, dt);
  if (part <= 1) { sky.follow(cam, 0, dt); sty($('cineFade'), 'opacity', String(Math.max(0, Math.min(1, fade)))); musicTick(dt); draw(); if (part === 1 && C.turning.hands > 0) { hands.update(dt, false, C.turning.hands, true); if (!REC_NODRAW) hands.render(renderer, cam.aspect); } return; }
  // the people decide inside the motion's slices on where the camera is at each moment of the frame (dawn path, then the bed at the wake), the same at any frame rate
  const filmAt = (a) => { const tt = t - dt + a * dt; if (tt >= P[3]) return [-0.6, -9.3]; const c = opPath(CONFIG.opening.dawn.cam, Math.max(P[2], tt)); return [c[0], c[2]]; };
  if (part === 2) { bview.update(dt, cam.position.x, cam.position.z, cam.position.y, filmAt); opDawn(I, t); opLids(0); for (const o of I.hide || []) o.visible = false; opStands(I); }
  else { if (!I.home) { I.home = true; hemi.color.setHex(CONFIG.baseLight.sky); scene.background = new THREE.Color(0xbfe6f0); scene.fog = new THREE.Fog(0xf6e8c8, 30, 95); hemi.intensity = CONFIG.baseLight.power; if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure; }
    bview.update(dt, -0.6, -9.3, 1.6, filmAt); opWake(I, t - P[3]); for (const o of I.hide) o.visible = false; opStands(I); }
  sty($('cineFade'), 'opacity', String(Math.max(0, Math.min(1, part === 3 ? Math.max(0, 1 - (t - P[3]) / 0.4) : fade)))); musicTick(dt); draw();
}
// ---- the panel-tender's job (owner Nov 17 16:56; texts in src/lore.js): Marla's one line the first time you talk to her, and the one-time "Your job" card after the opening
function loreScoutLine() { const j = LORE.jobLine(save); if (j) { persist(); return j; } return B.scoutLine(save); }
let jobAt = 0;
// the card: its own element and CSS (the HUD is not touched); gone on any key, click or tap after a short grace, and never shown again (save.jobCard)
function jobCard() {
  if (!LORE.jobCardDue(save) || $('jobCard') || NOFILM) return;
  if (!$('jobCss')) { const s = document.createElement('style'); s.id = 'jobCss';
    s.textContent = '#jobCard{position:fixed;left:calc(16px + env(safe-area-inset-left));top:56px;z-index:40;width:min(340px,calc(100vw - 32px))}'
      + '@media (orientation:portrait){#jobCard{left:50%;transform:translateX(-50%);width:min(360px,calc(100vw - 32px))}}#jobCard{max-height:calc(100vh - 72px);overflow:auto;box-sizing:border-box;padding:14px 16px 12px;border-radius:12px;border:2px solid #b08a4a;background:#141a17f2;color:#f3e8c8;font:inherit;font-size:15px;line-height:1.35;box-shadow:0 6px 24px #000a}'
      + '#jobCard h2{display:flex;align-items:center;gap:10px;margin:0 0 8px;font-size:18px;color:#ffe9a8}#jobCard h2 svg{flex:none}#jobCard ol{margin:0 0 8px;padding-left:22px}#jobCard li{margin:3px 0}#jobCard p{margin:0 0 10px;max-width:none;opacity:1;color:#e9dcb4}'
      + '#jobCard button{display:block;min-width:44px;min-height:44px;width:100%;font:inherit;font-weight:700;font-size:15px;border-radius:999px;border:2px solid #6fc2a8;background:#0d2a22;color:#f6f0dc}';
    document.head.appendChild(s); }
  const c = document.createElement('section'); c.id = 'jobCard'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'Your job');
  const h = document.createElement('h2'); h.innerHTML = '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="7" fill="#ffd978"/><g stroke="#ffd978" stroke-width="2.4" stroke-linecap="round">' + [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = k * Math.PI / 4; return '<line x1="' + (17 + 10.5 * Math.cos(a)).toFixed(1) + '" y1="' + (17 + 10.5 * Math.sin(a)).toFixed(1) + '" x2="' + (17 + 15 * Math.cos(a)).toFixed(1) + '" y2="' + (17 + 15 * Math.sin(a)).toFixed(1) + '"/>'; }).join('') + '</g></svg>';
  h.append('Your job: panel-tender'); const ol = document.createElement('ol'); for (const d of LORE.DUTIES) { const li = document.createElement('li'); li.textContent = d; ol.appendChild(li); }
  const g = document.createElement('p'); g.textContent = LORE.GUIDE_LINE; const b = document.createElement('button'); b.type = 'button'; b.textContent = FINE ? 'Got it (Enter)' : 'Got it';
  c.append(h, ol, g, b); document.body.appendChild(c); jobAt = performance.now(); H2.say('card', 'Your job: panel-tender', undefined, 0); setTimeout(() => { if ($('jobCard') === c) jobClose(); }, CONFIG.lore.jobCardSecs * 1000);
}
// a key or a click elsewhere also does its normal job (the card never eats the player's first input); a tap on the card itself goes no further
// it closes on its button or a tap on it, on Enter, E or Escape (those are kept from the game), or by itself after CONFIG.lore.jobCardSecs; moving, looking and every
// other input go on working while it is up and do not close it (coordinator Nov 17: the first W press wiped it before anyone read it)
function jobClose() { const c = $('jobCard'); if (!c) return; c.remove(); H2.unsay('card'); if (LORE.markJobCard(save)) persist(); }
function jobDone(e) { const c = $('jobCard'); if (!c || performance.now() - jobAt < 500) return;
  const hit = e.type === 'pointerdown' ? c.contains(e.target) : (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Escape' || e.code === 'NumpadEnter');
  if (!hit) return; e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'pointerdown') opSwallow = performance.now() + 700; jobClose(); }
addEventListener('keydown', jobDone, true); addEventListener('pointerdown', jobDone, true);
// skip: any key, click or tap (after the grace time); the click that skips is not also taken as a click in the base
let opSwallow = 0;
addEventListener('keydown', (e) => { if (state !== 'intro' || !intro || intro.t < CONFIG.opening.grace) return; e.preventDefault(); e.stopImmediatePropagation(); finishIntro(); }, true);
addEventListener('pointerdown', (e) => { if (state !== 'intro' || !intro || intro.t < CONFIG.opening.grace || e.target === $('cineSkip')) return; e.preventDefault(); e.stopImmediatePropagation(); opSwallow = performance.now() + 700; finishIntro(); }, true);
addEventListener('click', (e) => { if (performance.now() < opSwallow) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
$('watch').textContent = 'Watch the opening';
function startRun() { perfRest(); runModels(); queueMicrotask(() => sceneCard('ride'));
  fromBase = true; bview.dispose(); dropWorld(); $('scout').style.display = 'none'; ui = null;
  run = RUN.createRun(B.makeCfg(CONFIG, save), +$('selRing').value, (() => { try { const q = new URLSearchParams(location.search).get('seed'); if (q) return +q; } catch (e) { /* no address */ } return (Math.random() * 1e9) | 0; })(), { gloomMult: B.gloomMult(CONFIG, save), extraEnergy: B.nightEnergyBonus(CONFIG, save), boss: B.bossNight(CONFIG, save, +$('selRing').value) });
  if (run.houses.some((h) => h.sim && h.sim.boss)) bossPreload(); // desktop: the boss model loads while you walk the street (src/bosshi.js)
  $('msg').textContent = ''; flashT = 0;
  // a base line still on Marla's card (a base tip, said just before riding out) is cleared: it held back her first street line for the rest of its time, and base talk stays in the base
  $('marla').textContent = ''; marlaT = 0;
  // the one-time "Your job" card belongs to the base: riding out closes it (kept as seen), else its priority hid Marla's first street line until it timed out
  jobClose();
  sim = null; runT = 0; hintQ.length = 0; hintN = 0; state = 'play'; paused = false; hurtT = 0; $('pause').style.display = 'none';
  $('menu').style.display = 'none'; $('end').style.display = 'none'; $('hud').style.display = 'block'; $('bFire').textContent = 'FIRE';
  yaw = 0; pitch = 0; run.px = 0; run.pz = 0; skyK = 0; enterTown();
  const cn = run.houses[run.catHouse].n, newbie = (save.nights || 0) < 2; // the lessons are for the first two runs only
  if (newbie) { queueHint(0.5, 'Six houses, Potts. Walk into a door to loot it.', 'street'); queueHint(25, 'That bar is your Sun. Your hand drinks it in.'); queueHint(45, 'At dusk you defend the house you are in.'); queueHint(70, nightLine(), null, nightOnce); }
  queueHint(newbie ? 40 : 8, 'Something waves in a house with ' + cn + ' openings.', null, () => run.houses[run.catHouse].sim.cat.found);
}
let kitOpen = false, kitArmed = true, guideYaw = 0, kitWait = 0, guidePrev = 0, guideSet = 0;
function closeKit() { kitOpen = false; $('kit').style.display = 'none'; marla.talk(false); }
function openKit() { if (!save) return; kitOpen = true; kitArmed = false; stick.x = stick.y = 0; marla.talk(true); drawLoadout('kitLoadout'); $('kit').style.display = 'flex'; }
function enterTown() {
  clearScene(); sim = null; $('hud').className = 'town'; $('bLeave').style.display = 'none'; camY = 1.6;
  scene.fog = DESO.on ? new THREE.Fog(CONFIG.desolate.over.fogColor, CONFIG.desolate.over.fogNear, CONFIG.desolate.over.fogFar) : new THREE.Fog(0xbfe6f0, 20, 80); needWorld().frame(-1); applySky(skyK, 0);
  townDoors.length = 0; for (const m of world.marks) townDoors.push(m); needDormant();
  { const G = CONFIG.marla.guide; if (!run.guide) { run.guide = { x: G.x, z: G.z }; for (const dx of [0, -3, 3, -6, 6, -9, 9]) { const x = G.x + dx; if (!run.houses.some((h) => Math.abs(h.doorX - x) < G.clearDoor)) { run.guide.x = x; break; } } } G.x = run.guide.x; G.z = run.guide.z; marla.root.position.set(G.x, 0, G.z); marla.root.rotation.set(0, 0, 0); scene.add(marla.root); kitArmed = !run.guideMet || Math.hypot(run.px - G.x, run.pz - G.z) > G.rearm; run.guideMet = true; } // by day Marla stands on the street: walk up to her to change devices
}
function enterHouse(i, quiet) { perfRest();
  if (!run) return; const first = !run.houses[i].seen; duskT = 0;
  scene.remove(marla.root); if (kitOpen) closeKit();
  sim = RUN.enter(run, i); if (run.hurt) sim.player.hp = Math.min(sim.player.hp, CONFIG.player.hp - run.hurt); clearScene(); needWorld().frame(i); buildRoomDyn(); buildBreaches(); buildCrates(); buildDepth(); loreHouse(i); // same world, moved so this house sits at the sim's origin
  yaw = sim.player.yaw; pitch = 0; camY = 1.6; acc = 0; $('hud').className = ''; applySky(skyK, 0);
  if (!quiet) flash('House: ' + sim.n + ' openings, ' + sim.L + (sim.L > 1 ? ' floors' : ' floor'));
  if (first && run.visited === 1 && !quiet && (save.nights || 0) < 2) { hintQ.unshift({ at: 0, text: 'Walk into the capsules to take them. Green food, blue essentials.', where: 'house' }, { at: 0, text: 'LEAVE at the door for the next house.', where: 'house' }, { at: 0, text: 'SOLAR by a door or window, in the house you will sleep in.', where: 'house' }, { at: 0, text: nightLine(), where: 'house', skip: nightOnce }); }
}
// the first-collector flash names the real control (CONFIG.firstSolar: desktop key Q, phone SOLAR button)
function solarBlock() { return FINE ? CONFIG.firstSolar.blockD : CONFIG.firstSolar.blockP; }
let solarIgn = 0;
function mustSolar() { return !!(run && sim && fromBase && save && !save.solarDone && !(save.nights > 0) && sim.phase === 'day'); }
function leaveHouse() { if (!run || !sim || state !== 'play' || paused) return; if (mustSolar()) { flash(solarBlock(), 1); return; } const h = run.houses[run.inside], hp = sim.player.hp; if (!RUN.leave(run)) return; run.hurt = Math.max(0, CONFIG.player.hp - hp); if (save && (save.nights || 0) < 2 && !run.toldPick) { run.toldPick = true; queueHint(1, 'More openings, more Gloom. Pick where you stand.'); } sim = null; yaw = h.row < 0 ? Math.PI : 0; pitch = 0; enterTown(); } // step out facing the street
function nightfall(byHold) { if (!run) return; perfRest(); if (byHold && mustSolar()) { flash(solarBlock(), 1); return; } if (!sim) { const h = facedHouse() || RUN.nearest(run, run.px, run.pz); run.caught = !byHold; enterHouse(byHold ? h.i : RUN.nearest(run, run.px, run.pz).i, true); } sim.endDay(); }
// the house whose door you are looking at (within range and a narrow angle), else null
function facedHouse() { const T = CONFIG.town, fx = -Math.sin(yaw), fz = -Math.cos(yaw); let best = null, ba = T.faceAngle; for (const h of run.houses) { const dx = h.doorX - run.px, dz = h.doorZ - run.pz, d = Math.hypot(dx, dz); if (d > T.infoRange || d < 0.01) continue; const a = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))); if (a < ba) { ba = a; best = h; } } return best; }
// (R4 worker 6) NIGHT SET IN THE BACKGROUND: the ride card's night shaders (the night's machine lights on, Marla's and the street's spot and point lights off, Marla
// off the scene, the warm-up copies shown, stand-in lamps for each lamp count) are built on the day street a few pieces a frame: the light set is changed, compileAsync
// is called on a few of the scene's pieces (its own JS at most CONFIG.lag.nightBg.ms a frame; the GPU links them on its compiler threads), and everything is put back
// before the frame is drawn, so nothing on screen changes. Programs made here count in the warm-up gate like any other built outside a card (NBG.built shows how
// many); OFF by default (CONFIG.lag.nightBg.on): it needs the lead's decision on how the gate counts background compiles
// (window.__forceKhr: a local check without the extension runs the same path)
const KHR_PAR = (() => { try { return !!window.__forceKhr || !!renderer.getContext().getExtension('KHR_parallel_shader_compile'); } catch (e) { return false; } })();
const NBG = { q: [], on: false, inSlice: false, built: 0, ms: 0, slices: 0 };
function nightBgStart(lamps) { NBG.q = lamps.map((n) => ({ n, list: null, i: 0 })); NBG.on = NBG.q.length > 0; }
// by day only: on the street, and in a house by day (the night is spent in a house, so its pieces are built for the night's lights too); a new place starts its list again
function nightBgSlice() { if (!NBG.on || LCARD.on || state !== 'play' || !run || (sim && sim.phase !== 'day') || paused || document.hidden || !glights.length) return;
  const t0 = performance.now(), job = NBG.q[0], mp = marla.root.parent, tmp = [], spots = [], gv = glights.map((l) => l.visible), wv = warmG.visible, where = sim ? 'house' : 'street';
  if (!job.list || job.where !== where) { job.where = where; job.i = 0; job.list = scene.children.filter((c) => !c.isLight && c !== marla.root); }
  NBG.inSlice = true; if (mp) mp.remove(marla.root); for (const l of glights) l.visible = true; warmG.visible = true;
  scene.traverse((o) => { if ((o.isSpotLight || (o.isPointLight && !glights.includes(o))) && o.visible) { o.visible = false; spots.push(o); } });
  for (let k = 0; k < job.n; k++) { const lp = new THREE.PointLight(0xffe0a0, CONFIG.world.lamp, 6); lp.position.set(0, -40, 0); scene.add(lp); tmp.push(lp); }
  try { while (job.i < job.list.length && performance.now() - t0 < CONFIG.lag.nightBg.ms) { const c = job.list[job.i++]; if (c.parent === scene) renderer.compileAsync(c, cam, scene).catch(() => {}); } }
  finally { for (const lp of tmp) { scene.remove(lp); lp.dispose(); } for (const o of spots) o.visible = true; glights.forEach((l, i) => { l.visible = gv[i]; }); warmG.visible = wv; if (mp) mp.add(marla.root); NBG.inSlice = false; }
  if (job.i >= job.list.length) NBG.q.shift(); if (!NBG.q.length) NBG.on = false; NBG.slices++; NBG.ms += performance.now() - t0; }
function townFrame(dt) {
  const T = CONFIG.town, G = CONFIG.marla.guide;
  { const dx = run.px - G.x, dz = run.pz - G.z, d = Math.hypot(dx, dz), near = d < 9; // she turns to watch you, and blocks the way like anything else
    { const m0 = marla.root.userData, far = m0.lpx == null || Math.hypot(run.px - m0.lpx, run.pz - m0.lpz) > 2, x0 = far ? run.px : m0.lpx, z0 = far ? run.pz : m0.lpz, x1 = run.px, z1 = run.pz; m0.lpx = x1; m0.lpz = z1; // pivot steps with her feet held (src/people.js createStepper), deciding inside the motion's slices
      marla.turn(dt, (a) => { const qx = x0 + (x1 - x0) * a - G.x, qz = z0 + (z1 - z0) * a - G.z; return Math.hypot(qx, qz) < 9 ? Math.atan2(qx, qz) : null; }); }
    const c = Math.cos(-marla.root.rotation.y), s = Math.sin(-marla.root.rotation.y); marla.update(dt, dx * c + dz * s, -dx * s + dz * c, near);
    // her shadow turns with her (owner 10:50, as in the base: the sun's shadow map is drawn again once she has settled, not every 0.1 s while she turns)
    { const ry = marla.root.rotation.y; guideSet = Math.abs(ry - guidePrev) < 0.002 ? guideSet + dt : 0; guidePrev = ry; if (Math.abs(ry - guideYaw) > 0.06 && guideSet > CONFIG.lag.shadowSettle && shadowT <= 0) { guideYaw = ry; shadowT = 0.01; } }
    if (d > G.rearm) kitArmed = true; else if (d < G.open && kitArmed && !kitOpen && !paused && fromBase && save) { const still = Math.hypot(stick.x, stick.y) < 0.1 && !keys.KeyW && !keys.KeyA && !keys.KeyS && !keys.KeyD; kitWait = still ? kitWait + dt : 0; if (kitWait >= G.wait) { kitWait = 0; openKit(); } } else kitWait = 0;
    if (d < 0.55 && d > 1e-4) { run.px = G.x + dx / d * 0.55; run.pz = G.z + dz / d * 0.55; } }
  tickDormant(false); if (!dormTold && (run.dormant || []).some((d) => Math.hypot(run.px - d.x, run.pz - d.z) < 7)) { dormTold = true; marlaHint('Switched off by day, Potts. Do not shoot them, do not bump them, do not pass close with a heavy pack: wake one and it brings friends tonight.'); }
  (run.dormant || []).forEach((d, i) => { const dx = run.px - d.x, dz = run.pz - d.z, dd = Math.hypot(dx, dz); if (dd < d.r + CONFIG.dormant.touch) { if (!d.touch) { d.touch = true; wakeDormant(i, 'bump'); } } else d.touch = false; if (dd < d.r && dd > 1e-4) { run.px = d.x + dx / dd * d.r; run.pz = d.z + dz / dd * d.r; } }); tickStir(dt);
  if (!paused && !kitOpen) {
    let mx = stick.x, mz = stick.y;
    if (keys.KeyW) mz -= 1; if (keys.KeyS) mz += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } const sy = Math.sin(yaw), cy = Math.cos(yaw), v = T.speed * RUN.speedMult(run) * dt;
    [run.px, run.pz] = RUN.pushOut(run, run.px + (mx * cy + mz * sy) * v, run.pz + (-mx * sy + mz * cy) * v);
    dayHints(dt); bellCheck(run.dayT);
    { const out = RUN.tickTown(run, dt); if (out || duskHold(dt, true)) { nightfall(!out); return; } }
    if (!run.paceTold && RUN.speedMult(run) < 0.995) { run.paceTold = true; marlaHint('Loot is heavy: the more you carry, the slower you walk (Walk speed, top right).'); }
    if (!run.slowTold && RUN.speedMult(run) < 0.8) { run.slowTold = true; queueHint(0, 'Heavy pack, Potts. You are slowing down.'); }
    for (const h of run.houses) if (Math.hypot(run.px - h.doorX, run.pz - h.doorZ) <= T.doorRadius) { enterHouse(h.i); return; }
  }
  const nr = RUN.nearest(run, run.px, run.pz), nh = facedHouse() || nr, nd = nh === nr ? Math.hypot(run.px - nh.doorX, run.pz - nh.doorZ) : 0, ll = RUN.lootLeft(nh);
  $('bprompt').textContent = nd <= 10 ? 'Walk in the door: ' + ll.food + ' food, ' + ll.ess + ' essentials inside · ' + nh.n + ' openings to guard · ' + nh.L + (nh.L > 1 ? ' floors' : ' floor') : 'Walk to a house door';
  if (fromBase && save && Math.hypot(run.px - G.x, run.pz - G.z) < G.hintAt) $('bprompt').textContent = 'Stand by Marla to change your devices';
  if ((save && (save.nights || 0) < 2) && !run.toldBar && runT > 6 && nd > 0 && nd <= 12 && marlaT <= 0.01) { run.toldBar = true; marlaHint('Green bar over a door: loot inside. Red: empty.'); } // said when he first looks at a door from near
  for (const d of townDoors) { const q = RUN.lootLeft(d.h); d.mark.material.color.setHex(q.food + q.ess > 0 ? 0x7ac96a : 0xd04040); } // red bar = emptied
  skyK += (Math.min(1, Math.max(0, 1 - run.dayT / 12)) * 0.55 - skyK) * Math.min(1, dt * 1.5); applySkyIf(skyK, 0);
  cam.position.set(run.px, 1.6, run.pz); cam.rotation.set(pitch, yaw, 0, 'YXZ');
  $('hp').style.width = (100 - (run.hurt || 0)) + '%'; $('en').style.width = (100 * run.energy / CONFIG.player.energyCap) + '%';
  H2.setClock($('time'), run.dayT, false); H2.setClockBar(run.dayT, false); H2.setVit($('enL'), run.energy, false, 100 - (run.hurt || 0)); H2.setCount($('count'), [['Houses', run.visited + '/6'], ['Food', run.food], ['Essentials', run.ess], [CONFIG.ui.sun, Math.round(run.energy), 1], ['Walk speed', Math.round(100 * RUN.speedMult(run)) + '%']]); $('time').style.color = run.bell ? '#ff6a5a' : ''; $('coins').textContent = run.coins ? 'Lucky cat found' : '';
  tickSleepers(dt); tickHud(dt); tickAim(dt); sky.follow(cam, world ? world.g.rotation.y : 0, dt); freezeWorld(); draw();
  hands.update(dt, Math.hypot(stick.x, stick.y) > 0.1 || keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD, run.energy / CONFIG.player.energyCap, false); (window.__noHands || hands.render(renderer, cam.aspect));
}
function start(viaBase) {
  fromBase = !!viaBase; run = null; hintQ.length = 0; clearScene(); dropWorld(); bview.dispose(); scene.remove(marla.root); kitOpen = false; $('kit').style.display = 'none'; sky.mesh.visible = false; scene.background = new THREE.Color(0x0b1020); scene.fog = new THREE.Fog(0x0b1020, 8, 34);
  $('hud').className = ''; $('bFire').textContent = 'FIRE'; $('scout').style.display = 'none';
  const ring = +$('selRing').value, house = +$('selHouse').value;
  sim = createSim(fromBase ? { cfg: B.makeCfg(CONFIG, save), ring, house, seed: (Math.random() * 1e9) | 0, gloomMult: B.gloomMult(CONFIG, save), extraEnergy: B.nightEnergyBonus(CONFIG, save), day: true, boss: B.bossNight(CONFIG, save, ring) } : { cfg: CONFIG, ring, house, seed: (Math.random() * 1e9) | 0, boss: false });
  yaw = 0; pitch = 0; camY = 1.6; buildRoom(); buildBreaches();
  $('menu').style.display = 'none'; $('end').style.display = 'none'; $('hud').style.display = 'block';
  state = 'play'; hurtT = 0; paused = false; $('pause').style.display = 'none';
  buildCrates(); buildDepth(); hintN = 0; skyK = sim.phase === 'day' ? 0 : 1; applySky(skyK, 0); $('marla').textContent = ''; $('hs').textContent = ''; marlaT = 0; hsT = 0;
  if (sim.phase !== 'day') flash('Hold until dawn. Put panels in the openings, shoot Gloom heads over them.');
}
// ---- base (dawn): explorable, personnel, quests, the Scout, the hidden cat
const marla = createMarla(CONFIG);
const bview = createBaseView(scene, CONFIG, marla, (id) => (MODELS[id] ? createPerson(CONFIG, id) : null)); bview.setView(cam);
let save = null, carry = null, ui = null, bp = { x: 0, z: 4 }, curTarget = null, chimeT = 0, storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch (e) { storage = null; }
// a first visit (no save yet) plays the opening film on Enter: its Gloom models start loading now, behind the title (desktop only; src/gloomglb.js)
// (R3, owner 14:10: under 20 MB before the base) the film's desktop Gloom models are no longer asked for with the page: the film asks for them when it starts
// (filmPrep) and its black waits for them (CONFIG.lag.filmModelWait)
// MARLA'S VOICE (owner Nov 18; src/marlavoice.js, CONFIG.voice.marla): her run lines spoken; frame() ticks it, musicTick() ducks the music while she talks
const MV = createMarlaVoice(() => audio(), storage, H2.FINE2);
// impact sounds (src/impactsfx.js, CONFIG.sfx.impact): the cannon shot, hits on machines and boss weak points, a machine destroyed. Phones (the HUD's pointer test) get the phone mix; the street gets the drier room
const IMP = createImpactSfx(() => audio(), () => CONFIG.sfx.impact, () => !H2.FINE2, () => !sim);
// test hook (window.__game.impactCount): calls per sound, and how many were scheduled on the AudioContext
const impN = { shot: 0, hit: 0, head: 0, charged: 0, destroyed: 0, played: 0 };
const impOn = () => !!(CONFIG.sfx.impact && CONFIG.sfx.impact.on);
function impCall(kind, po, head) { impN[kind === 'hit' && head ? 'head' : kind]++; const t = kind === 'shot' ? IMP.shot() : kind === 'hit' ? IMP.hit(po, !!head) : IMP[kind](po); if (t > 0) impN.played++; }
// the cannon's shot sound: the impact shot, or the old one when CONFIG.sfx.impact.on is false
function shotSfx() { if (impOn()) impCall('shot'); else sfxShot(); }
// the impact sounds for a list of sim events, each event once (doFire plays its own shot's events on the shot's frame, the frame loop the rest). A machine destroyed in the same list plays
// its destroyed sound instead of its hit; a charged shot plays one queued hit per machine on its line; a boss weak point plays the body hit
function impactEvents(list) { if (!sim) return; const pops = list.filter((e) => e.e === 'pop' && !e.imp), gone = (q) => pops.some((o) => o.x === q.x && o.z === q.z && o.floor === q.floor);
  for (const ev of list) { if (ev.imp || (ev.e !== 'shot' && ev.e !== 'pop')) continue; ev.imp = true; if (!impOn()) continue;
    if (ev.e === 'pop') { impCall('destroyed', panOf(ev)); continue; } if (!ev.hit) continue;
    if (ev.boss !== undefined && ev.x !== undefined) impCall('hit', panOf(ev), false);
    if (ev.charged) { for (const q of ev.hits || []) if (!gone(q)) impCall('charged', panOf(q)); } else if (ev.boss === undefined && ev.x !== undefined && !gone(ev)) impCall('hit', panOf(ev), ev.head); } }
const persist = () => B.writeSave(save, storage);
function enterBase(intro) { perfRest(); baseCamY = 1.6;
  clearScene(); dropWorld(); sim = null; run = null; hintQ.length = 0; ui = null; state = 'base'; hemi.intensity = CONFIG.baseLight.power; hemi.color.setHex(CONFIG.baseLight.sky); hemi.groundColor.setHex(CONFIG.baseLight.ground);
  if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure;
  sky.mesh.visible = false; scene.background = new THREE.Color(0xbfe6f0); scene.fog = new THREE.Fog(0xf6e8c8, 30, 95);
  $('marla').textContent = ''; $('hs').textContent = ''; marlaT = 0; hsT = 0; $('bLeave').style.display = 'none'; $('time').style.color = '';
  (bview.build(save), applyRelief(bview.group), noSmallCasters(bview.group), bview.mergeStill(), unifyBase(), renderer.shadowMap.needsUpdate = true, shadowT = 1.5); bp = { x: 3, z: 7 }; yaw = 0; pitch = 0; camY = 1.6;
  $('menu').style.display = 'none'; $('end').style.display = 'none'; $('scout').style.display = 'none'; $('qb').style.display = 'none';
  $('hud').style.display = 'block'; $('hud').className = 'base'; $('bFire').textContent = 'USE';
  flash(intro || ('Dawn, day ' + save.day + '. Find Marla the Scout to go out on a collection run (last seen ' + B.scoutPos(save).hint + ').' + (save.day === 1 ? ' They say a lucky cat hides somewhere in the base.' : '')), 2);
  tipKind = bview.rooms.WS && B.workshopTip(save) ? 'workshop' : B.hatcheryTip(CONFIG, save) ? 'hatchery' : ''; wsTipT = tipKind === 'workshop' ? CONFIG.workshop.tell : tipKind === 'hatchery' ? CONFIG.avians.tell : 0;
  jobCard(); // the one-time "Your job" card for every new player on day 1 (coordinator Nov 17: also when the opening was not watched)
}
// the field guide in your journal: every device you can use, and every kind of machine you have met so far (the rest stay unknown)
// as book blocks (src/book.js): names are headings (devices with their ink sketch, src/booksketches.js), an unknown machine is a scribbled "???"
function fieldGuide() {
  const K = CONFIG.gloom.kinds, met = save.met || {}, out = [{ k: 'h2', text: 'Field guide' }, { k: 'h3', text: 'Devices you can carry' }];
  for (const k of B.unlocked(CONFIG, save)) { out.push({ k: 'term', text: CONFIG.devices[k].name, sketch: k }); if (CONFIG.devices[k].text) out.push({ k: 'text', text: CONFIG.devices[k].text }); }
  out.push({ k: 'h3', text: 'Machines met' });
  // a met machine also gets its old job, the "Before:" line (src/lore.js, owner Nov 17)
  for (const k of Object.keys(K)) out.push(...LORE.guideMachine(k, K, met));
  out.push(...bossGuide(met)); // the final-night boss, once met (src/bosshi.js)
  return out;
}
function drawLoadout(id) {
  const ok = B.unlocked(CONFIG, save), cur = B.loadout(CONFIG, save), el = $(id || 'loadout');
  el.innerHTML = 'Devices: ' + cur.map((k, i) => '<select data-i="' + i + '">' + ok.map((q) => '<option value="' + q + '"' + (q === k ? ' selected' : '') + '>' + CONFIG.devices[q].name + '</option>').join('') + '</select>').join(' ');
  // what each chosen device does, so the choice is not blind
  el.innerHTML += '<span class="hint" style="display:block;text-align:left;margin-top:6px">' + ['<b>Solar</b> (by day, free): place it by a door or window; it fills your Sun.'].concat(cur.map((k) => '<b>' + CONFIG.devices[k].name + '</b> (' + H2.sunCost(CONFIG.devices[k].cost) + '): ' + (CONFIG.devices[k].text || ''))).join('<br>') + '</span>';
  el.querySelectorAll('select').forEach((x) => { x.onchange = () => { B.setLoadout(CONFIG, save, +x.dataset.i, x.value); persist(); drawLoadout(id); }; });
}
// which way and how far a place in the base is from where you stand and look
const UP_MIN = Math.min(...Object.values(CONFIG.base.upgrades).map((u) => u.cost[0]));
function whereIs(q) { const dx = q.x - bp.x, dz = q.z - bp.z, d = Math.hypot(dx, dz), fx = -Math.sin(yaw), fz = -Math.cos(yaw), dot = (dx * fx + dz * fz) / (d || 1), cr = (dx * fz - dz * fx) / (d || 1); return d < 4 ? '' : ' · ' + Math.round(d) + ' m ' + (dot > 0.7 ? 'ahead' : dot < -0.7 ? 'behind you' : cr > 0 ? 'to your left' : 'to your right'); }
function doUse() {
  if (state !== 'base' || ui || paused || !curTarget || FILM.it) return;
  const t = curTarget;
  if (t.kind === 'cat') { if (B.foundCat(save, t.id)) { bview.hideCat(); persist(); chime(1); flash('You found a lucky cat! Carry it home and set it on the shelf to see what it does.', true); } return; }
  if (t.kind === 'slot') {
    const r = B.useSlot(save, t.k);
    if (r.act === 'none') { flash('Nothing to place. Lucky cats hide out in the base; when you find one, bring it here.', true); return; }
    bview.refreshHome(save); persist(); chime(1);
    if (r.act === 'took') { flash('You took the cat back.', true); return; }
    const en = r.cat.type === 'energy';
    flash((en ? 'It swings the arm on your RIGHT: a SUN cat. +' + CONFIG.cat.energyBonus + ' start Sun every night.' : 'It swings the arm on your LEFT: a LURE cat. It draws more Gloom (+' + Math.round(CONFIG.cat.lurePer * 100) + '%) but the loot is richer (+' + Math.round(CONFIG.cat.lureLoot * 100) + '%). Take it back if you do not want it.') + (r.note ? ' A note on the shelf: an odd number of these hide in the base.' : ''), true);
    return;
  }
  if (t.kind === 'desk') { if (!save.readDesk) { save.readDesk = true; persist(); } openPanel('journal'); return; }
  if (t.kind === 'npc') { openPanel(t.id === 'oko' && bview.rooms.WS ? 'oko' : 'npc:' + t.id); return; }
  if (t.kind === 'mjournal') { openPanel('mjournal'); return; }
  if (t.kind === 'coop') { const n = B.collectEggs(save); bview.refreshAvians(); persist(); flash(n ? 'You collect ' + n + ' egg' + (n > 1 ? 's' : '') + '. Warm them in the dome by the run.' : 'No eggs yet. Each hen lays one a day.', true); return; }
  if (t.kind === 'incubator') { if (save.avians.held > 0) { const r = B.placeEgg(CONFIG, save); bview.refreshAvians(); persist(); flash(r.msg, true); } openPanel('hatchery'); return; }
  if (t.kind === 'scout') { ui = 'scout'; marla.talk(true); drawLoadout(); { const open = save.ringOpen || 1, sel = $('selRing'); [...sel.options].forEach((o, i) => { o.disabled = i >= open; o.textContent = (i + 1) + ' (' + (i + 1) * CONFIG.ring.km + ' km) · loot x' + CONFIG.ring.mult[i] + ' · Gloom x' + CONFIG.ring.countMult[i] + (i === CONFIG.ring.mult.length - 1 ? ' · the goal' : '') + (i >= open ? ' - win ring ' + i + ' first' : ''); }); if (+sel.value >= open) sel.value = String(open - 1); } $('scoutLine').textContent = '"' + loreScoutLine() + '"'; scoutFirst(); $('scout').style.display = 'flex'; return; }
  if (t.kind === 'board') { openPanel('board'); return; }
  const r = B.interactStation(save, t.key, carry); carry = r.carry; save.carry = carry;
  if (r.msg) { flash(r.msg, true); persist(); return; }
  if (t.key === 'garden') openPanel('crew');
  else if (t.key === 'workshop') openPanel('workshop');
  else flash('Storage: ' + save.food + ' food, ' + save.essentials + ' essentials.', true);
}
// one overlay for the board, the crew list, the workshop and the journal
function openPanel(kind, after) {
  ui = kind; const el = $('qb'), U = CONFIG.base.upgrades; let h = '';
  const closePanel = () => { el.style.display = 'none'; ui = null; if (after) after(); };
  // the journals open as a book in ink (src/book.js, CONFIG.book); Marla's newest unread lines are in fresh ink and the book opens at the first of them
  if (kind === 'journal') { openBook(el, { hand: 'player', title: 'Journal', blocks: LORE.dutyBlocks().concat(B.journalLines(CONFIG, save).map((l) => ({ k: 'line', text: l }))).concat(fieldGuide()).concat(LORE.foundBlocks(save)), openAt: 0 }, CONFIG.book, closePanel); return; }
  if (kind === 'hatchery') {
    const F = save.avians, A = CONFIG.avians, y = B.dailyYield(CONFIG, F), sq = B.sunquills(F), can = F.held > 0 && F.inc.length < A.slots && B.flockSize(F) + F.inc.length < A.maxFlock;
    h = '<h1>Hatchery</h1><p>Eggs in hand: <b>' + F.held + '</b> · in the coop: ' + F.coop + '</p>'
      + '<p>Warm dome (' + F.inc.length + '/' + A.slots + '): ' + (F.inc.length ? F.inc.map((e, i) => 'egg ' + (i + 1) + ' hatches in ' + e.left + ' day' + (e.left === 1 ? '' : 's')).join(', ') : 'empty') + '</p>'
      + '<p>Chicks: ' + (F.chicks.length ? F.chicks.map((c) => (c.kind === 'sunquill' ? 'a Sunquill' : 'a chick') + ' (grown in ' + Math.max(0, A.growDays - c.age) + ' day' + (A.growDays - c.age === 1 ? '' : 's') + ')').join(', ') : 'none') + '</p>'
      + '<p>Flock: ' + (F.birds.length - sq) + ' hen' + (F.birds.length - sq === 1 ? '' : 's') + ', ' + sq + ' Sunquill' + (sq === 1 ? '' : 's') + ' · ' + B.flockSize(F) + '/' + A.maxFlock + ' birds</p>'
      + '<p class="hint">Each day the flock brings +' + y.food + ' food' + (y.seeds ? ' and +' + y.seeds + ' seed' + (y.seeds > 1 ? 's' : '') : '') + '. Seeds saved: ' + F.seeds + '. A hatch is sometimes a Sunquill.</p>'
      + (can ? '<button class="big act" data-a="egg">Put an egg in the dome</button>' : '');
  } else if (kind === 'mjournal') {
    const was = save.mjRead || 0, L = B.readMarlaJournal(save); persist(); bview.refreshJournal();
    openBook(el, { hand: 'marla', title: 'Marla\'s journal', note: '(private)', blocks: L.map((l, i) => ({ k: 'entry', label: B.marlaLabel(i), text: l, fresh: i >= was })), openAt: Math.min(was, L.length - 1) }, CONFIG.book, closePanel);
    return;
  }
  el.classList.remove('is-book');
  // quests come only from the quest board (owner Nov 17 15:59): a villager's talk is their line and a pointer to the board; the board lists, takes and hands in every quest
  const rew = (q) => '(+' + [q.reward.food ? q.reward.food + ' food' : '', q.reward.essentials ? q.reward.essentials + ' essentials' : ''].filter(Boolean).join(', ') + ')';
  const hintP = (T) => (T && T.hint ? '<p class="hint">' + T.hint + '</p>' : '');
  // the workshop's upgrade list (also behind Oko's greeting when the workshop is a room you walk into)
  const shop = () => { const pr = save.project, rs = B.count(save, 'researcher');
    return '<p>Essentials: ' + save.essentials + ' | Researchers: ' + rs + '</p>'
      + (pr ? '<p><b>Researching ' + U[pr.key].name + '</b>: ' + pr.left + ' day(s) of work left ' + (save.helped === save.day ? '<i>(you helped today)</i>' : '<button class="big act" data-a="help">Lend a hand (-1 day)</button>') + '</p>' + (rs ? '' : '<p class="hint">No researcher yet: only your own help moves it. Set someone to research at the Garden.</p>') : '<p class="hint">Pick a project. It costs essentials to start, then your researchers work on it each dawn.</p>')
      + Object.keys(U).map((k) => { const lv = save.up[k]; return '<p>' + U[k].name + ' (level ' + lv + '/' + U[k].max + '): ' + U[k].text + ' ' + (lv >= U[k].max ? '<i>done</i>' : pr ? '' : '<button class="big act" data-a="buy" data-id="' + k + '">Start: ' + U[k].cost[lv] + ' essentials, ' + U[k].days[lv] + ' days</button>') + '</p>'; }).join(''); };
  if (kind === 'oko') {
    const T = B.npcTalk(save, 'oko');
    h = '<h1>Workshop</h1><p><b>Oko, tinkerer:</b> <i>"' + T.greet + '"</i></p>' + hintP(T) + shop();
  } else
  if (kind.startsWith('npc:')) {
    const n = B.NPCS[kind.slice(4)], T = B.npcTalk(save, n.id);
    h = '<h1>' + n.name + ', ' + n.title + '</h1><p><i>"' + T.line + '"</i></p>' + hintP(T);
  } else
  if (kind === 'board') {
    const cp = save.cats.filter((c) => c.state === 'hidden').map((c) => B.CAT_SPOTS[c.spot].hint);
    // each line: the quest (progress in its text), its reward, then Take / in progress / Hand in (a villager's posting, once done) / done
    const row = (q) => '<p>' + q.text + ' <b>' + rew(q) + '</b> ' + (q.state === 'open' || q.state === 'offered' ? '<button class="big act" data-a="take" data-id="' + q.id + '">Take</button>' : q.state === 'active' ? '<i>in progress' + (carry && carry.questId === q.id ? ': carrying the crate' : '') + '</i>' : q.state === 'ready' ? '<button class="big act" data-a="hand" data-id="' + q.id + '">Hand in</button>' : '<i>done</i>') + '</p>';
    const L = B.boardPostings(save), own = L.filter((q) => !q.giver), ppl = L.filter((q) => q.giver);
    h = '<h1>Quest board</h1>' + own.map(row).join('') + (ppl.length ? '<p class="hint">Postings from your people:</p>' + ppl.map(row).join('') : '')
      + '<p class="hint">' + (cp.length ? 'Rumour: golden paws wave ' + cp.join(', and ') + '. ' : '') + 'Hunters thin the Gloom and bring essentials; gatherers bring food each dawn.</p>' + loreNotices();
  } else if (kind === 'crew') {
    h = '<h1>Garden and crew</h1><p>Food ' + save.food + '. Welcome someone for ' + CONFIG.base.recruitFood + ' food. ' + B.recruitLine(CONFIG, save.food) + '.</p><button class="big act" data-a="rec">Welcome a new person</button>'
      + save.personnel.map((p) => '<p>' + p.name + ': <b>' + p.role + '</b> <button class="big act" data-a="role" data-id="' + p.id + '">change</button></p>').join('')
      + '<p class="hint">Every dawn: each hunter thins the next night\'s Gloom 4% (up to 20%) and brings 1 essential; each gatherer brings 2 food; each researcher does 1 day of Workshop research.</p>';
  } else if (kind === 'workshop') {
    h = '<h1>Workshop</h1>' + shop();
  }
  // panel fix (Nov 17): the content scrolls in its own box and Close sits in a footer bar under it, so Close never covers a line or a button (it was sticky over the list on short phones)
  el.innerHTML = '<div class="pbody">' + h + '</div><div class="pfoot"><button class="big" id="qclose">Close</button></div>'; el.style.display = 'flex';
  el.querySelectorAll('.act').forEach((b) => { b.onclick = () => {
    const a = b.dataset.a, id = b.dataset.id;
    if (a === 'take') { const q0 = save.quests.find((x) => x.id === +id); if (q0 && q0.giver && q0.type === 'deliver' && carry) flash('Your hands are full: deliver the crate you carry first.', true); else { const q = B.takePosting(save, id); if (q && q.giver && q.type === 'deliver') { carry = { questId: q.id, to: q.to }; save.carry = carry; flash('You take ' + B.NPCS[q.giver].name + '\'s crate. Bring it to ' + B.STATIONS[q.to].name + '.', true); } } }
    else if (a === 'hand') { const q = B.handIn(save, id); if (q) flash(B.NPCS[q.giver].name + '\'s posting handed in: ' + rew(q).slice(1, -1), true); }
    else if (a === 'rec') { const g = B.recruit(CONFIG, save); flash(g.msg, true); if (g.ok) (bview.recruitsChanged(save), applyRelief(bview.group), noSmallCasters(bview.group), renderer.shadowMap.needsUpdate = true, shadowT = 1.5); } // (owner 11:27) the recruits and the base life only
    else if (a === 'role') { B.cycleRole(save, +id); (bview.recruitsChanged(save), applyRelief(bview.group), noSmallCasters(bview.group), renderer.shadowMap.needsUpdate = true, shadowT = 1.5); }
    else if (a === 'buy') flash(B.startResearch(CONFIG, save, id).msg, true);
    else if (a === 'help') flash(B.helpResearch(CONFIG, save).msg, true);
    else if (a === 'egg') { flash(B.placeEgg(CONFIG, save).msg, true); bview.refreshAvians(); persist(); }
    persist(); bview.refreshNpcs(); openPanel(kind);
  }; });
  $('qclose').onclick = closePanel;
}
// ---- Marla's own HUD line (separate from #msg and the headshot pip): one shared gap, priority stair > upper > inbound > hurt
const PRIO = { hurt: 1, inbound: 2, collector: 2, streak: 2.5, upper: 3, stair: 4 }, SAY_GAP = 2.5, KIND_CD = { inbound: 6, upper: 5, stair: 6, hurt: 7, collector: 9, streak: CONFIG.marlaTalk.streakCd };
let sayAt = -99, sayPrio = 0, marlaT = 0, hsT = 0; const kindAt = {}, kindN = {};
function sfxAlert(k) { const a = audio(); if (!a) return; const t = a.currentTime, fs = k === 'stair' ? [520, 520, 520] : k === 'upper' ? [660, 880] : [440, 330]; fs.forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.12); g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.2); o.connect(g); g.connect(a.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.22); }); }
const dirWord = (po) => (po.dFloor > 0 ? 'upstairs' : po.dFloor < 0 ? 'downstairs' : Math.abs(po.fwd) > Math.abs(po.pan) ? (po.fwd > 0 ? 'ahead' : 'behind') : (po.pan > 0 ? 'on your right' : 'on your left'));
function marlaSay(kind, vars) {
  const now = performance.now() / 1000, pr = PRIO[kind] || 1;
  if (now - (kindAt[kind] || -99) < KIND_CD[kind]) return;
  if (now - sayAt < SAY_GAP && pr <= sayPrio) return;
  const key = kind === 'hurt' && vars.low ? B.lowKey(CONFIG, vars.ate || 0) : kind, set = B.MARLA_LINES[key]; kindN[key] = (kindN[key] || 0) + 1;
  const text = set[(kindN[key] - 1) % set.length].replace('{d}', vars.d || '').replace('{f}', vars.f || '').replace('{u}', vars.u || '');
  kindAt[kind] = sayAt = now; sayPrio = pr; marlaT = 3; $('marla').textContent = text;
  if (kind !== 'hurt' && kind !== 'collector') sfxAlert(kind);
}
function marlaAlert(ev) { const po = panOf(ev); marlaSay(ev.k, { d: dirWord(po), f: ev.floor + 1, u: ev.to > ev.from ? 'up' : 'down' }); }
function marlaHurt() { marlaSay('hurt', { ate: sim.eaten || 0, low: sim.player.hp <= CONFIG.player.hp * 0.35 }); }
// first night only (owner Nov 16): a sarcastic line when the player keeps getting hit, and on desktop one reminder that holding H shows the keys. CONFIG.marlaTalk
const firstNight = () => !!(sim && sim.phase === 'night' && save && !(save.nights || 0)); const hitTimes = []; let hintsToldN = 0, nightClock = 0;
function marlaStreak() { const M = CONFIG.marlaTalk, now = performance.now() / 1000; hitTimes.push(now); while (hitTimes.length && now - hitTimes[0] > M.streakWindow) hitTimes.shift(); if (firstNight() && hitTimes.length >= M.streakHits) { hitTimes.length = 0; marlaSay('streak', {}); } }
function marlaNightTips(dt) { const M = CONFIG.marlaTalk; if (drill) return; if (!firstNight()) { nightClock = 0; return; } nightClock += dt; if (FINE && !document.body.classList.contains('nohints') && hintsToldN < M.hintTimes && nightClock >= M.hintDelay * (hintsToldN + 1) && marlaT <= 0.01) { const L = B.MARLA_LINES.hintsH; marlaHint(L[hintsToldN % L.length]); hintsToldN++; } }
// panel fix (Nov 17): the crosshair says what is under it by colour AND shape (CONFIG.ui.cross): '' plain ring, 'use' ring with a dot, 'gloom' ring with four ticks
let crossK = ''; function setCross(k) { if (k === crossK) return; crossK = k; const c = $('cross'); c.classList.toggle('x-use', k === 'use'); c.classList.toggle('x-gloom', k === 'gloom'); }
// one text at a time in the centre column and Marla's spot (CONFIG.ui.centre priorities): the game's own items and the lines other code queued with H2.say (shown in #csay); the others are hidden (class hq) but keep their text
const CENTRE_EL = { marla: 'marla', msg: 'msg', aim: 'aim', mlook: 'mlook', bprompt: 'bprompt' };
function tickCentre() { const P = CONFIG.ui.centre, q = H2.topSaid(), cs = $('csay'); if (q && q.kind === 'marla') { const mm = $('marla'); if (mm.textContent !== q.text) mm.textContent = q.text; mm.classList.toggle('face', !!sim && sim.phase === 'night'); return tickCentre2(null); } return tickCentre2(q); }
// (a queued 'marla' line is shown in Marla's own card, not in #csay)
// in tickCentre2, a queued 'card' line is not drawn in #csay: the card draws itself (the lore job card); its queue line only keeps the others quiet
function tickCentre2(q) { const P = CONFIG.ui.centre, cs = $('csay'); let win = q ? 'say' : null, wp = q ? q.prio : -1e9;
  for (const k in CENTRE_EL) { const el = $(CENTRE_EL[k]), has = k === 'mlook' ? el.style.display === 'block' && !document.body.classList.contains('nohints') : !!el.textContent; if (has && P[k] > wp) { wp = P[k]; win = k; } }
  for (const k in CENTRE_EL) { const el = $(CENTRE_EL[k]), hide = win !== k; if (el.classList.contains('hq') !== hide) el.classList.toggle('hq', hide); }
  const t = win === 'say' && q.kind !== 'card' ? q.text : ''; if (cs.textContent !== t) cs.textContent = t; { const nk = win === 'say' ? q.kind : ''; if (cs.dataset.k !== nk) cs.dataset.k = nk; } }
let aimT = 0; function tickAim(dt) { aimT -= dt; if (aimT > 0) return; aimT = 0.2; const el = $('aim'); let tx = '', dorm = ''; if (!sim && run && state === 'play' && run.dormant) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); let best = CONFIG.gloomLook.aimCos; for (const d of run.dormant) { const dx = d.x - run.px, dz = d.z - run.pz, dd = Math.hypot(dx, dz); if (dd < 0.3 || dd > CONFIG.gloomLook.aimReach) continue; const cs = (dx * fx + dz * fz) / dd; if (cs > best) { best = cs; const k = CONFIG.gloom.kinds[d.kind]; dorm = FINE && k && !d.awake ? k.name : ''; tx = k ? k.name + (d.awake ? ' (awake!): ' : d.spent ? ' (spent, asleep until dark): ' : ' (asleep until dark): ') + k.text : ''; } } } if (sim && !sim.done && sim.phase === 'night') { const p = sim.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); let best = CONFIG.gloomLook.aimCos; for (const g of sim.gloom) { const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz); if (d < 0.3 || d > CONFIG.gloomLook.aimReach || !sim.canSee(g)) continue; const c = (dx * fx + dz * fz) / d; if (c > best) { best = c; const k = CONFIG.gloom.kinds[gloomKind(g)]; tx = k ? k.name + ': ' + k.text : ''; } } } setCross(tx || dorm ? 'gloom' : state === 'base' && curTarget && !ui ? 'use' : ''); if (dorm) { const h = '<b>' + dorm + ' \u00b7 dormant \u00b7 power saver</b><span>Leave it. Waking it costs you: more of them tonight.</span>'; if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; } el.classList.add('dorm'); return; } if (el.dataset.h) { el.dataset.h = ''; el.textContent = ''; } el.classList.remove('dorm'); if (el.textContent !== tx) el.textContent = tx; }
// red arc round the crosshair toward the nearest machine that is off screen (desktop, night; CONFIG.hud2.arc)
function tickArc() { const el = $('arc'), A = CONFIG.hud2.arc; let on = false; if (FINE && A.on && sim && sim.phase === 'night' && state === 'play' && !paused) { const P = sim.player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw); let best = 1e9, ang = 0;
  for (const g of sim.gloom) { if (g.floor !== P.floor) continue; const dx = g.x - P.x, dz = g.z - P.z, d = Math.hypot(dx, dz); if (d < 1e-3 || (dx * fx + dz * fz) / d > A.off) continue; if (d < best) { best = d; ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz); } }
  if (best < 1e9) { on = true; sty(el, 'transform', 'rotate(' + Math.round((ang * 180) / Math.PI - 90) + 'deg)'); } } el.classList.toggle('on', on); }
function tickHud(dt) { keysAuto(); tickBar(dt); tickWake(); tickDrillUi(); tickChips(); musicTick(dt); marlaNightTips(dt); flashT = Math.max(0, flashT - dt); if (flashT <= 0) setText('msg', ''); marlaT = Math.max(0, marlaT - dt);
  // (R4 worker 5, item 5: diagnose 9 drill, #marla's text replaced 899 times in 12 s) a queued Marla line (the drill's orders: shown until the step changes) is not
  // cleared here only to be written back by tickCentre in the same frame; her card is written only when its text changes
  if (marlaT <= 0) { const tq = H2.topSaid(); if (!(tq && tq.kind === 'marla')) setText('marla', ''); } $('marla').classList.toggle('face', !!sim && sim.phase === 'night'); H2.mode(!!sim && sim.phase === 'night' && state === 'play'); tickArc(); hsT = Math.max(0, hsT - dt); if (hsT <= 0) setText('hs', ''); }
function chime(v) { const a = audio(); if (!a) return; const t = a.currentTime; [1318, 1760].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.14 * v, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5); o.connect(g); g.connect(a.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.55); }); }
$('lookT').textContent = 'Look: ' + (GRITTY ? 'realistic worn' : 'painted (old)') + ' - tap to switch'; $('lookT').onclick = () => { try { localStorage.setItem('dawnpunk.look', GRITTY ? 'painted' : 'gritty'); } catch (e) { /* not kept */ } location.href = location.href.split('?')[0]; };
// graphics tier (src/quality.js, CONFIG.quality): the title link and the pause-menu button switch it; the choice is saved and the page reloads, because edge smoothing and the texture set are fixed when the page starts
// the button switches medium (the default) <-> low (owner Nov 19: tiers by measured frame time; medium on every device by default); OWNER DECISION (lead 00:16,
// Card 47): no high for players: it is never offered; a page opened with ?quality=high (checks, tests) switches to medium
const GFX_OTHER = TIER === 'medium' ? 'low' : 'medium', gfxGo = () => { saveQuality(GFX_OTHER); let u = location.href.split('#')[0]; try { const x = new URL(u); x.searchParams.set('quality', GFX_OTHER); if (x.searchParams.get('film') !== '0') x.searchParams.set('film', '1'); u = x.href; } catch (e) { /* keep the address */ } location.href = u; };
const gfxPauseLabel = () => 'Graphics: ' + TIER + (TIER === 'medium' ? ' (default)' : '');
let gfxArm = 0; $('gfxT').textContent = 'Graphics: ' + TIER + (TIER === 'medium' ? ' (default)' : '') + ' - tap to switch'; $('gfxT').onclick = gfxGo;
$('bGfx').textContent = gfxPauseLabel(); $('bGfx').addEventListener('click', () => { if (!gfxArm) { gfxArm = 1; $('bGfx').textContent = 'Switch to ' + GFX_OTHER + '? Reloads: this night ends. Tap again'; return; } gfxGo(); });
GK.speak.fn = (kind, line, obj) => sfxVoice(kind, line, obj);
$('watch').onclick = () => { if (paused) setPause(false); audio(); musicUnlock(true); let had = false; try { had = !!(storage && storage.getItem('solardg.save')); } catch (e) { had = false; } save = !had && preSave ? preSave : B.loadSave(CONFIG, storage); preSave = null; carry = save.carry || null; if (FILM.pre) { preSave = null; filmGo(); return; } startIntro(); }; $('cineSkip').onclick = () => finishIntro();
// a first-time player (no save yet) gets the opening from "Enter the base" too (coordinator Nov 17); ?film=0 in the address skips that for the scripted checks
// the scripted checks always open the page with ?quality=..., so a ?quality address also skips it unless ?film=1 asks for it (openingcheck); the player's own Graphics switch (gfxGo) adds film=1 so a real player keeps the film and card
const NOFILM = (() => { try { const q = new URLSearchParams(location.search); return q.get('film') === '0' || (q.has('quality') && q.get('film') !== '1'); } catch (e) { return false; } })();
$('enter').onclick = () => { audio(); musicUnlock(); let had = false; try { had = !!(storage && storage.getItem('solardg.save')); } catch (e) { had = false; } save = !had && preSave ? preSave : B.loadSave(CONFIG, storage); preSave = null; carry = save.carry || null; persist(); if (FILM.pre) { filmGo(); return; } if (!had && !NOFILM) { startIntro(); return; }
  // (owner, returning player straight to the base) the 'home' card shows first (painted), then the base is built under it and its shaders and first frames done there
  // (sceneCard); the scripted checks keep the old direct path
  if (BOTRUN() || !CONFIG.lag.card.on) { enterBase(); return; } $('lct').textContent = CONFIG.lag.card.titles.home || ''; $('lfill').style.width = '10%'; $('lcard').style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => { const tb = performance.now(); enterBase(); LCARD.buildMs = Math.round(performance.now() - tb); sceneCard('home'); })); };
let resetArm = -1e9; // was 0: a first tap in the first 3 s after the page loaded counted as the second (erasing) tap
$('reset').onclick = () => { if (performance.now() - resetArm > 3000) { resetArm = performance.now(); $('reset').textContent = 'Tap again to erase your save'; return; } save = B.newSave(CONFIG); B.makeQuests(CONFIG, save); carry = null; persist(); $('reset').textContent = 'New game'; if (paused) setPause(false); audio(); musicUnlock(); startIntro(); }; // a new game plays the opening first (skippable); it lands in the base with Marla at your door
$('go').onclick = () => { audio(); startRun(); };
$('kitDone').onclick = () => closeKit(); $('marla').style.setProperty('--face', 'url(' + MARLA_FACE + ')'); H2.applyHud2(QUALITY); $('bEat').style.setProperty('--ic', 'url(' + H2.ICON('food') + ')');
$('sback').onclick = () => { $('scout').style.display = 'none'; ui = null; marla.talk(false); };
$('again').onclick = () => {
  if (fromBase && save && sim) {
    enterBase(homeMsg); sceneCard('home');
  } else { $('end').style.display = 'none'; $('menu').style.display = 'flex'; $('hud').style.display = 'none'; state = 'menu'; }
};

// ---- input
// menu buttons answer a touch at once, even while the other thumb holds the stick (a second finger gets no click event from the browser)
let menuTapAt = -1e9;
document.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; const b = e.target.closest && e.target.closest('.ov button'); if (!b) return; e.preventDefault(); menuTapAt = performance.now(); b.click(); }, true);
document.addEventListener('click', (e) => { if (e.isTrusted && performance.now() - menuTapAt < 600 && e.target.closest && e.target.closest('.ov')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
const keys = {}; addEventListener('keydown', (e) => { keys[e.code] = true; if (e.repeat) return; if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.altKey) { toggleMusic(); return; } if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.altKey) { document.body.classList.add('hkeys'); return; } if (e.code === CONFIG.drill.skipKey && drill) { drillEnd(true); return; } if (e.code === 'Escape' && escClose()) return; if (e.code === 'KeyP' && (ui || kitOpen || $('keys').style.display === 'flex' || $('bigmap').style.display === 'flex')) return; if (e.code === 'KeyN' && state === 'base' && !ui && !paused) H2.say('nbase', CONFIG.fresh.nBase, CONFIG.fresh.nBasePrio, 0); if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play' || (state === 'base' && !ui && (paused || e.code === 'KeyP'))) setPause(!paused); return; } if (state === 'base' && !ui && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'KeyF' || e.code === 'Enter')) { doUse(); return; } if (state === 'play' && !paused) { if (e.code === 'KeyQ') doPlace('collector'); if (e.code === 'KeyL') leaveHouse(); const dg = /^Digit([1-5])$/.exec(e.code);
    if (FINE) { if (dg) pickSlot(+dg[1] - 1); if (e.code === 'KeyE') leaveHouse(); if (e.code === 'KeyF') doEat(); if (e.code === 'Space') { doFire(); chargeHeld = true; } }
    else { if (dg) doSlot(+dg[1] - 1); if (e.code === 'KeyE') doEat(); if (e.code === 'Space' || e.code === 'KeyF') { doFire(); chargeHeld = true; } } } });
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyN') H2.unsay('nbase'); if (e.code === 'KeyH') document.body.classList.remove('hkeys'); if (e.code === 'Space' || e.code === 'KeyF') chargeHeld = false; });
// right mouse button: fire, hold to charge (the left button drags the view); in the base it uses what you face
// DESKTOP CONTROLS in the manner of a PC first-person shooter (owner, Nov 16: "follow bioshock or similar game in term of keys and mouse"): W A S D walk, the mouse looks,
// left button = your weapon (fire; hold to charge), right button = your device hand (by day the solar collector, at night the device picked with 1 to 5 or the mouse wheel),
// E = use / interact (talk and use in the base; leave the house at its door), F = eat (heal), Q = solar collector, hold N = start the night, Tab = quests, Esc = pause. Phones and touch are unchanged.
let selSlot = 0;
function pickSlot(i) { if (!slotKinds()[i]) return; const was = selSlot; selSlot = i; barOpen(); if (i !== was) drillDid('switch'); }
function deskPlace() { if (!sim) return; if (sim.phase === 'day') doPlace('collector'); else doSlot(selSlot); }
addEventListener('wheel', (e) => { if (!FINE || state !== 'play' || paused) return; const sk = slotKinds(), n = sk.length; if (!n) return; const d = e.deltaY > 0 ? 1 : -1; for (let k = 1; k <= n; k++) { const i = (((selSlot + d * k) % n) + n) % n; if (sk[i]) { selSlot = i; barOpen(); drillDid('switch'); break; } } }, { passive: true });
// MOUSE LOOK (desktop, player and user feedback Nov 15): click the game once and the mouse turns the view with no button held (the browser hides and holds the pointer);
// while held, the left and right buttons fire (hold to charge) or use what you face in the base; Esc frees the mouse (in a run it also pauses). Menus and panels free it by themselves.
const FINE = (() => { try { return !matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
// LAG FIX Nov 19 (lag report finding 10): the pointer kind, read once and again only when it changes (was a matchMedia call every frame in the base)
const COARSE = { now: false }; try { const mq = matchMedia('(pointer: coarse)'); COARSE.now = mq.matches; const f = (e) => { COARSE.now = e.matches; }; if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f); } catch (e) { COARSE.now = false; }
// write a HUD line only when its text changes (the base HUD rebuilt and wrote three lines every frame). On the desktop draw() shows a 'USE:' prompt as 'E:', so that form counts as unchanged.
// (LAG FIX Nov 19, owner 10:35) a style value written only when it changes: the last value written and what the element read back are remembered, so a change
// made elsewhere (endScreen hiding a button) is still seen
const STY = new WeakMap();
function sty(el, prop, v) { if (!el) return; let m = STY.get(el); if (!m) { m = {}; STY.set(el, m); } const q = m[prop]; if (q && q.v === v && el.style[prop] === q.n) return; el.style[prop] = v; m[prop] = { v, n: el.style[prop] }; }
// device counts by kind and by group ('g:' + group), counted once a frame for the device buttons (was a filter per button per frame)
const DEVN = {};
function setText(id, t) { const e = $(id); if (!e) return; const shown = FINE && id === 'bprompt' && t.startsWith('USE:') ? 'E:' + t.slice(4) : t; if (e.textContent !== shown) e.textContent = shown; } // (owner 11:40) writes what it compares (it wrote 'USE:' and draw() turned it into 'E:': two writes a frame)
// window.__fakeLock: TEST ONLY (tools/mousecheck.cjs). The headless test browser runs out of memory while it really holds the pointer, so tests set it to false before loading;
// the game then pretends to hold the pointer instead of asking the browser, and counts the requests it would have made in window.__lockAsks. Players never have it set.
// MEMFIX (Nov 18): a browser driven by a test tool (navigator.webdriver is true) gets the same pretend hold by itself, so a test that only clicks (the fresh-player driver)
// cannot crash the headless browser: its first click on the game used to take memory from 2.5 GB to 6 GB in about a minute. Players' browsers never set navigator.webdriver.
// A test that sets window.__fakeLock itself keeps its own value; CONFIG.mouse.fakeLockWhenAutomated false turns this off.
if (CONFIG.mouse.fakeLockWhenAutomated && typeof window.__fakeLock !== 'boolean' && typeof navigator !== 'undefined' && navigator.webdriver === true) window.__fakeLock = false;
const fakeLock = () => typeof window.__fakeLock === 'boolean';
const mouseHeld = () => (fakeLock() ? window.__fakeLock : document.pointerLockElement === cvs); let lockWanted = false, lockAt = -1e9;
function lockMouse() { if (!FINE || mouseHeld() || !cvs.requestPointerLock) return false; lockAt = performance.now(); if (fakeLock()) { window.__lockAsks = (window.__lockAsks || 0) + 1; window.__fakeLock = true; lockWanted = true; $('mlook').style.display = 'none'; return true; } try { const pr = cvs.requestPointerLock(); lockWanted = true; if (pr && pr.catch) pr.catch(() => { lockWanted = false; }); return true; } catch (e) { return false; } }
function freeMouse() { lockWanted = false; if (fakeLock()) { window.__fakeLock = false; return; } if (mouseHeld()) document.exitPointerLock(); }
addEventListener('mousemove', (e) => { if (!mouseHeld() || !(state === 'play' || state === 'base') || paused) return; yaw -= e.movementX * CONFIG.mouse.sens; pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * CONFIG.mouse.sens)); });
document.addEventListener('pointerlockchange', () => { $('mlook').style.display = 'none'; if (!mouseHeld() && lockWanted) { lockWanted = false; if (state === 'play' && !paused) setPause(true); } });
addEventListener('contextmenu', (e) => { if (state === 'play' || state === 'base') e.preventDefault(); });
addEventListener('mousedown', (e) => { if (e.target.closest && e.target.closest('.ov, #bq, #mmap, #hud .b')) return; if (e.button === 0 && performance.now() - lockAt < CONFIG.fresh.lockClickMs) return; if (!(e.button === 2 || (e.button === 0 && mouseHeld()))) return; if (state === 'base' && !ui) doUse(); else if (state === 'play' && !paused) { if (e.button === 2 && FINE) deskPlace(); else { doFire(); chargeHeld = true; } } });
addEventListener('mouseup', (e) => { if (e.button === 2 || e.button === 0) chargeHeld = false; });
let stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }, look = { id: -1, lx: 0, ly: 0 };
const L = $('zoneL'), R = $('zoneR');
L.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0 && lockMouse()) return; if (e.pointerType === 'mouse') { look = { id: e.pointerId, lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), viaL: true }; L.setPointerCapture(e.pointerId); return; } stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 }; L.setPointerCapture(e.pointerId); $('knob').style.display = 'block'; $('knob').style.left = e.clientX - 40 + 'px'; $('knob').style.top = e.clientY - 40 + 'px'; });
L.addEventListener('pointermove', (e) => { if (look.viaL && e.pointerId === look.id) { yaw -= (e.clientX - look.lx) * 0.006; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - look.ly) * 0.006)); look.lx = e.clientX; look.ly = e.clientY; return; } if (e.pointerId !== stick.id) return; const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, l = Math.hypot(dx, dy) || 1, c = Math.min(l, 50) / 50; stick.x = (dx / l) * c; stick.y = (dy / l) * c; });
const endStick = (e) => { if (look.viaL && e.pointerId === look.id) { endLook(e); return; } if (e.pointerId === stick.id) { stick.id = -1; stick.x = stick.y = 0; $('knob').style.display = 'none'; } };
L.addEventListener('pointerup', endStick); L.addEventListener('pointercancel', endStick);
R.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0 && lockMouse()) return; look = { id: e.pointerId, lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now() }; R.setPointerCapture(e.pointerId); });
R.addEventListener('pointermove', (e) => { if (e.pointerId !== look.id) return; yaw -= (e.clientX - look.lx) * 0.006; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - look.ly) * 0.006)); look.lx = e.clientX; look.ly = e.clientY; });
const endLook = (e) => { if (e.pointerId === look.id) { if (e.type === 'pointerup' && (state === 'play' || state === 'base') && Math.hypot(e.clientX - look.sx, e.clientY - look.sy) < 12 && performance.now() - look.t0 < 350) { if (state === 'base') doUse(); else doFire(); } look.id = -1; } };
R.addEventListener('pointerup', endLook); R.addEventListener('pointercancel', endLook);
function btn(id, fn) { const b = $(id); b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if ((state === 'play' && !paused) || (state === 'base' && id === 'bFire')) fn(); }); }
let paused = false;
const byDay = () => (!sim && !!run) || (!!sim && sim.phase === 'day');
const quitLabel = () => (byDay() ? 'End the day (go home)' : 'End night');
function setPause(v) { if (v && state !== 'play' && state !== 'base') return; paused = v; quitArm = 0; gfxArm = 0; $('bGfx').textContent = gfxPauseLabel(); $('quit').textContent = quitLabel(); $('quit').style.display = state === 'base' ? 'none' : ''; $('watch').style.display = $('reset').style.display = state === 'base' ? '' : 'none'; $('pJournal').style.display = save && (state === 'base' || fromBase) ? '' : 'none'; $('pMap').style.display = state === 'base' && CONFIG.miniMap.on ? '' : 'none'; if (!v) { $('keys').style.display = $('bigmap').style.display = 'none'; document.body.classList.remove('keyscard'); } $('pause').style.display = v ? 'flex' : 'none'; if (v) { for (const k in keys) keys[k] = false; stick = { id: -1, x: 0, y: 0 }; look.id = -1; $('knob').style.display = 'none'; } last = performance.now(); }
$('bPause').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); setPause(true); });
$('resume').addEventListener('click', () => setPause(false)); $('bMusic').addEventListener('click', toggleMusic); $('bVoice').addEventListener('click', () => { MV.setOn(!MV.on); showVoice(); }); $('bMus').addEventListener('click', (e) => { e.stopPropagation(); toggleMusic(); $('bMus').blur(); });
// music on or off from the pause menu, the note button always on screen, or M (players said the music got in the way and could not find the switch)
// hints on or off (owner Nov 16: "let player have a choice to close the crowded portion"): the pause menu's Hints button (H no longer toggles them: holding H shows the keys); hides the key legend, the mouse hint, the key badges and the second line of the dormant tag; remembered
function toggleHints() { if (document.body.classList.contains('keysoff')) { document.body.classList.remove('keysoff'); try { storage && storage.setItem('solardg.keysAuto', 'shown'); } catch (e) { /* not saved */ } return; } setHints(!document.body.classList.contains('nohints')); }
// panel fix (Nov 17): the desktop key strip hides by itself once CONFIG.ui.keysAfterNights nights are done, unless the player brought it back with H before
let keysAutoSeen = false; function keysAuto() { document.body.classList.toggle('n2', !!save && (save.nights || 0) >= CONFIG.ui.keysAfterNights); if (keysAutoSeen || !FINE || !save || (save.nights || 0) < CONFIG.ui.keysAfterNights) return; keysAutoSeen = true; let st = null; try { st = storage && storage.getItem('solardg.keysAuto'); } catch (e) { /* none */ } if (st !== 'shown') document.body.classList.add('keysoff'); }
function setHints(off) { document.body.classList.toggle('nohints', off); $('bHints').textContent = 'Hints: ' + (off ? 'off' : 'on'); try { storage && storage.setItem('solardg.hints', off ? 'off' : 'on'); } catch (e) { /* not saved */ } }
$('bHints').addEventListener('click', toggleHints);
try { if (storage && storage.getItem('solardg.hints') === 'off') setHints(true); } catch (e) { /* default on */ }
function toggleMusic() { musicUnlock(); mus.on = !mus.on; showMusic(); try { storage && storage.setItem('solardg.music', mus.on ? 'on' : 'off'); } catch (e) { /* not saved */ } musicTick(0.01); }
try { if (storage && storage.getItem('solardg.music') === 'off') $('bMus').classList.add('off'); } catch (e) { /* default on */ }
function showVoice() { $('bVoice').textContent = 'Voice: ' + (MV.on ? 'on' : 'off'); $('bVoice').style.display = MV.allowed ? '' : 'none'; }
showVoice();
function showMusic() { $('bMusic').textContent = 'Music: ' + (mus.on ? 'on' : 'off'); $('bMus').classList.toggle('off', !mus.on); }
// rotate screen: a phone with rotation lock on never turns; offer full screen locked sideways (Android), or playing upright anyway
if (!document.documentElement.requestFullscreen || !(screen.orientation && screen.orientation.lock)) $('rotFs').style.display = 'none';
$('rotFs').addEventListener('click', () => { const d = document.documentElement, go = d.requestFullscreen ? d.requestFullscreen() : null; Promise.resolve(go).then(() => screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null).catch(() => {}); });
$('rotAny').addEventListener('click', () => { document.body.classList.add('portraitOk'); setPause(false); });
let quitArm = 0;
$('quit').addEventListener('click', () => { if (performance.now() - quitArm > 3000) { quitArm = performance.now(); $('quit').textContent = 'Tap again to leave (counts as a loss)'; return; } const wasDay = byDay(); setPause(false); if (!sim && run) enterHouse(RUN.nearest(run, run.px, run.pz).i, true); if (sim) { sim.leftDay = wasDay; sim.left = true; sim.abandon(); } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; stick.x = stick.y = 0; setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { for (const k in keys) keys[k] = false; stick.x = stick.y = 0; setPause(true); } });
// upright or sideways is measured from the real visible size, rechecked on every resize and twice a second (player on an iPhone 16 Pro Max, Safari, on itch.io: the phone turned
// but the rotate screen stayed: inside itch's frame the CSS orientation test did not follow the turn). iPhones cannot lock the screen sideways, so that button is hidden there.
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); document.body.classList.toggle('ios', IOS);
function checkTall() { const vv = window.visualViewport, w = vv ? vv.width : innerWidth, h = vv ? vv.height : innerHeight, coarse = COARSE.now, tall = coarse && h > w * CONFIG.rotate.ratio, was = document.body.classList.contains('tall');
  document.body.classList.toggle('tall', tall); if (tall && !was && !document.body.classList.contains('portraitOk')) setPause(true); }
addEventListener('resize', checkTall); addEventListener('orientationchange', () => { checkTall(); setTimeout(checkTall, 300); setTimeout(checkTall, 1000); }); if (window.visualViewport) visualViewport.addEventListener('resize', checkTall); setInterval(checkTall, CONFIG.rotate.pollMs); checkTall();
let chargeHeld = false, chargeT = 0;
function tickCharge(dt) { const CH = CONFIG.cannon.charge, ok = !!sim && state === 'play' && !paused && sim.phase === 'night' && !sim.done, cr = $('cross'); if (!ok) { chargeHeld = false; chargeT = 0; }
  if (chargeHeld) { const was = chargeT; chargeT += dt; if (was < CH.time && chargeT >= CH.time) sfxAlert('upper'); } else if (chargeT > 0) { const full = chargeT >= CH.time; chargeT = 0; if (full) doFire(true); }
  const k = Math.min(1, chargeT / CH.time), on = chargeT > 0.15; sty(cr, 'transform', on ? 'scale(' + (1 + 1.6 * k) + ')' : ''); sty(cr, 'borderColor', k >= 1 ? '#ffd76a' : on ? '#9fe8ff' : ''); sty(cr, 'boxShadow', k >= 1 ? '0 0 0 1px #000, 0 0 12px #ffd76a' : '');
  const fb = $('bFire'), tx = state === 'base' ? 'USE' : k >= 1 ? 'LET GO!' : on ? 'CHARGE ' + Math.round(100 * k) + '%' : (sim && sim.phase === 'night' ? 'FIRE<br><small>hold:<br>charged</small>' : 'FIRE'); if (fb.dataset.t !== tx) { fb.innerHTML = tx; fb.dataset.t = tx; } }
// ---- NIGHT-1 DRILL (owner Nov 17 18:28; CONFIG.drill): one Gloom at a time, one action per step, Marla says it (H2.say 'marla'), one key chip (desktop) or a pulsing button (phone);
// the night clock is held while it runs; done steps are kept in localStorage; K (or the Skip button) skips it; afterwards the held spawns come back and the night runs as normal
let drill = null, drillSim = null, drillPh = null;
function drillStore() { try { return JSON.parse((storage && storage.getItem(CONFIG.drill.store)) || '{}') || {}; } catch (e) { return {}; } }
function drillKeep(o) { try { storage && storage.setItem(CONFIG.drill.store, JSON.stringify(o)); } catch (e) { /* not saved */ } }
function drillBegin() { const D = CONFIG.drill; drill = null; if (!D.on || !sim || sim.phase !== 'night' || !fromBase || !save || (save.nights || 0) > 0 || sim.boss) return; const st = drillStore(); if (st.skip) return; const todo = D.steps.filter((q) => !(st.done || []).includes(q.id)); if (todo.length) drill = { todo, i: -1, since: 0, again: false, held: null, t0: 0 }; }
function drillStep() { const D = CONFIG.drill, q = drill.todo[drill.i], P = sim.player; drill.since = performance.now(); drill.gs = 0; drill.again = false; drill.tot = 0; drill.lost = sim.gloom.length ? 0 : -1;
  if (q.id === 'eat') { if (P.hp > CONFIG.player.hp * D.eatHp) P.hp = CONFIG.player.hp * D.eatHp; if (sim.food <= 0) sim.food = 1; }
  if (q.id === 'charge') P.energy = Math.max(P.energy, CONFIG.cannon.cost * CONFIG.cannon.charge.cost + 1); if (q.id === 'place') P.energy = Math.max(P.energy, CONFIG.devices[slotKinds()[selSlot]].cost + 1); // the picked device (the cheapest, from the drill's start) is paid for, so the step cannot dead-end
  drillSay(FINE ? q.desk : q.phone); }
function drillSay(t) { H2.say('marla', t, CONFIG.ui.centre.marla, CONFIG.drill.lineSecs); }
function drillTick(dt) { if (drillSim !== sim || drillPh !== (sim && sim.phase)) { drillSim = sim; drillPh = sim && sim.phase; drillBegin(); } if (!drill || !sim || sim.phase !== 'night') return; const D = CONFIG.drill;
  // while the lesson holds the waves (drill.held), the night must not see "no Gloom left" as dawn: sim.holdDawn says so until drillEnd gives the waves back
  if (!drill.held) { if (sim.t < D.startAt) return; drill.held = sim.spawns.splice(sim.spawned); sim.holdDawn = () => !!(drill && drill.held && drillSim === sim); sim.tame = drillTame; sim.hpFloor = () => (drill && drill.held && drillSim === sim ? D.hpFloor : 0); drill.t0 = sim.t; drill.i = 0; { const sk = slotKinds(), li = sk.indexOf(D.device); let bi = li >= 0 ? li : 0; if (li < 0) sk.forEach((k, i) => { if (CONFIG.devices[k].cost < CONFIG.devices[sk[bi]].cost) bi = i; }); selSlot = bi; } drillStep(); }
  sim.t = Math.min(sim.t, drill.t0); const q = drill.todo[drill.i]; if (!q) return;
  // one machine at a time, of the step's kind, through an opening you can see (drillOpening: in view, a few metres out, so it walks in in front of you)
  // (owner Nov 21, iPhone player: "they did not die ... it just kept coming") a lesson machine destroyed while its step is still open: Marla says it is down and another comes,
  // and after D.ignoreKills of them, or D.ignoreSecs of game time on one step, the lesson lets go (a player may ignore the lesson): the held waves come back
  if (!sim.gloom.length && sim.spawned >= sim.spawns.length) { if (drill.kind && ++drill.lost > 0) { if (drill.lost >= D.ignoreKills) { drillEnd(true, D.ignored); return; } drillSay(D.down); drill.since = performance.now(); drill.gs = 0; drill.again = false; }
    const at = drillOpening(); sim.spawns.push({ t: sim.t, bp: at.bp, hpv: 1, from: { x: at.x, z: at.z } }); drill.kind = q.kind; drill.from = at; }
  drill.tot += dt; if (drill.tot >= D.ignoreSecs) { drillEnd(true, D.ignored); return; }
  for (const g of sim.gloom) if (!g.drillKind && drill.kind) { g.drillKind = true; g.kind = drill.kind; }
  // the repeat also waits D.idleGame seconds of game time, so the order is on screen (and spoken) for a few frames even where one frame takes longer than D.idle
  drill.gs += dt; if (!drill.again && performance.now() - drill.since > D.idle * 1000 && drill.gs >= D.idleGame) { drill.again = true; drillSay(q.again); } } // idle counts real seconds (game time runs slow on a slow machine)
// the lesson machine is tamed (CONFIG.drill shootSpeed/shootStop, laterSpeed/laterDmg): slow and halted short of you until the shoot step is done, then slower and light-handed
function drillTame() { const D = CONFIG.drill; if (!drill || !drill.held || drillSim !== sim) return null; const q = drill.todo[drill.i]; return q && q.id === 'shoot' ? { speed: D.shootSpeed, stop: D.shootStop, dmg: 0 } : { speed: D.laterSpeed, stop: 0, dmg: D.laterDmg }; }
// the step's action happened: next step, or the end of the drill
function drillDid(id) { if (!drill || !drill.held) return false; const q = drill.todo[drill.i]; if (!q || q.id !== id) return false; const st = drillStore(); st.done = (st.done || []).concat(id); drillKeep(st); drill.i++; if (drill.i >= drill.todo.length) drillEnd(false); else drillStep(); return true; }
function drillEnd(skip, line) { if (!drill) return; if (skip) { const st = drillStore(); st.skip = true; drillKeep(st); } if (sim && drill.held) { sim.spawns.push(...drill.held); sim.spawns.sort((a, b) => a.t - b.t); } drill = null; H2.say('marla', line || (skip ? CONFIG.drill.skipped : CONFIG.drill.done), CONFIG.ui.centre.marla, 4); }
// the key chip (desktop) or pulsing button (phone) for the current step, plus the Skip button; also the Q chip while day 1 asks for the first collector
function tickDrillUi() { if (drill && (!sim || sim.phase !== 'night' || (state !== 'play' && state !== 'end'))) { drill = null; H2.unsay('marla'); } const q = drill && drill.held ? drill.todo[drill.i] : null, solar = !q && sim && state === 'play' && mustSolar(), chip = q ? q.chip : solar ? 'Q' : '', btn = q ? (q.btn === 'sel' ? 'b' + (selSlot + 1) : q.btn) : solar ? 'b0' : wakeUse() ? 'bFire' : '';
  const c = $('dchip'); if (c.textContent !== chip) c.textContent = chip; if (chip && FINE) { const mr = $('marla').getBoundingClientRect(); sty(c, 'top', (mr.height ? Math.round(mr.bottom + 6) : 112) + 'px'); sty(c, 'right', (mr.width ? Math.round(innerWidth - mr.right) : 22) + 'px'); } for (const id of ['bFire', 'bEat', 'bSwitch', 'b0', 'b1', 'b2', 'b3', 'b4', 'b5']) { const on = !FINE && id === btn; if ($(id).classList.contains('pulse') !== on) $(id).classList.toggle('pulse', on); }
  document.body.classList.toggle('drill', !!drill); drillSub(q, c, chip); drillMark(q); drillTab(); }
// ---- FRESH-PLAYER FIXES (owner Nov 18, desktop player test; CONFIG.fresh and CONFIG.drill)
// the drill machine's opening: on your floor, its start point (CONFIG.drill.spawnOut m outside) seen through an opening, within CONFIG.drill.viewDeg of your view (the nearest such one); else the one closest to your view
function drillOpening() { const D = CONFIG.drill, P = sim.player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null;
  sim.breaches.forEach((b, k) => { const x = b.outX - b.nx * D.spawnOut, z = b.outZ - b.nz * D.spawnOut, dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz) || 1, ang = (Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))) * 180) / Math.PI;
    const score = (b.floor === P.floor ? 0 : 1e8) + (sim.openAt(P.x, P.z, x, z, P.floor) ? 0 : 1e6) + (ang <= D.viewDeg ? d : 1e4 + ang); if (!best || score < best.score) best = { bp: k, x, z, ang, score }; });
  return best || { bp: 0, x: sim.breaches[0].outX, z: sim.breaches[0].outZ, ang: 180, score: 0 }; }
// the plain second line under Marla's drill order (desktop names the key, a phone the button): under her card, below the key chip on desktop
function drillSub(q, chipEl, chip) { const el = $('dsub'), mm = $('marla'), t = q && mm.textContent && !mm.classList.contains('hq') ? (FINE ? q.subD : q.subP) || '' : ''; if (el.textContent !== t) el.textContent = t; if (el.classList.contains('on') !== !!t) el.classList.toggle('on', !!t); if (!t) return;
  const mr = mm.getBoundingClientRect(), cr = FINE && chip ? chipEl.getBoundingClientRect() : null, top = cr && cr.height ? cr.bottom : mr.bottom; sty(el, 'top', Math.round(top + 6) + 'px'); sty(el, 'right', Math.round(innerWidth - mr.right) + 'px'); }
// a pulsing ring on the drill machine while the step needs it (steps[].mark), or an arrow at the screen edge pointing to it when it is out of view
const dmV = new THREE.Vector3();
// phones (owner Nov 18): when the machine walks close its ring would sit on the touch buttons; it is lifted to just above the ones it would cover (same column, still over the machine)
const RING_BTNS = ['bFire', 'bEat', 'bSwitch', 'b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'bDusk'];
function ringClear(sx, sy) { if (FINE) return sy; const h = CONFIG.drill.mark.px / 2 + CONFIG.drill.mark.clear; let y = sy;
  for (let n = 0; n < 3; n++) { let moved = false; for (const id of RING_BTNS) { const el = $(id); if (!el || getComputedStyle(el).display === 'none') continue; const r = el.getBoundingClientRect(); if (!r.width || sx + h < r.left || sx - h > r.right || y + h < r.top || y - h > r.bottom) continue; y = r.top - h; moved = true; } if (!moved) break; }
  return Math.max(h, y); }
function drillMark(q) { const mk = $('dmark'), ar = $('darrow'), M = CONFIG.drill.mark; let ring = false, arrow = false;
  if (q && q.mark && sim && state === 'play' && !paused && !ui) { const P = sim.player; let g = null, gd = 1e9; for (const x of sim.gloom) { if (!x.drillKind) continue; const d = Math.hypot(x.x - P.x, x.z - P.z); if (d < gd) { gd = d; g = x; } } const m = g && gMesh.get(g.id);
    if (m) { cam.updateMatrixWorld(); dmV.copy(m.position); dmV.y += M.y; dmV.project(cam); const W = innerWidth, H = innerHeight, e = M.edge, sx = ((dmV.x + 1) / 2) * W, sy = ((1 - dmV.y) / 2) * H, front = dmV.z < 1;
      if (front && sx > e && sx < W - e && sy > e && sy < H - e) { ring = true; sty(mk, 'left', Math.round(sx) + 'px'); sty(mk, 'top', Math.round(ringClear(sx, sy)) + 'px'); }
      else { let ux, uy; if (front) { ux = sx - W / 2; uy = sy - H / 2; } else { const dx = g.x - P.x, dz = g.z - P.z, f = -dx * Math.sin(P.yaw) - dz * Math.cos(P.yaw), r = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw), a = Math.atan2(r, f); ux = Math.sin(a); uy = -Math.cos(a); }
        const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l; const k = Math.min((W / 2 - e) / Math.max(1e-6, Math.abs(ux)), (H / 2 - e) / Math.max(1e-6, Math.abs(uy))); arrow = true;
        sty(ar, 'left', Math.round(W / 2 + ux * k) + 'px'); sty(ar, 'top', Math.round(H / 2 + uy * k) + 'px'); sty(ar, 'transform', 'rotate(' + Math.atan2(ux, -uy).toFixed(3) + 'rad)'); } } }
  if (mk.classList.contains('on') !== ring) mk.classList.toggle('on', ring); if (ar.classList.contains('on') !== arrow) ar.classList.toggle('on', arrow); { const D = window.__drillMark || (window.__drillMark = {}); D.ring = ring; D.arrow = arrow; D.x = mk.style.left; D.y = mk.style.top; } } // (owner 11:40) the drill's marks: positions written only on change, one kept object for the checks
// phones: during the drill the full bar shows, and the switch tab sits just left of it (the switch step needs it)
function drillTab() { if (FINE) return; const sw = $('bSwitch'), on = !!(drill && drill.held) && state === 'play' && !!sim; if (sw.classList.contains('dshow') !== on) sw.classList.toggle('dshow', on); if (!on) { if (sw.style.right) sw.style.right = ''; return; }
  let left = 1e9; for (const el of document.querySelectorAll('#slots .b.dev')) { const r = el.getBoundingClientRect(); if (r.width) left = Math.min(left, r.left); } if (left < 1e9) { const v = Math.round(innerWidth - left + 8) + 'px'; if (sw.style.right !== v) sw.style.right = v; } }
// the waking prompt (CONFIG.fresh): desktop "Click to start · E to talk" in the centre queue until the mouse has been taken once and Marla talked to once; on a phone the USE button pulses until the talk
let everHeld = false, wakeArmed = false, wakeT = '';
function talkedMarla() { return !save || !!save.talkedMarla || (save.nights || 0) > 0 || save.day > 1; }
function wakeUse() { return wakeArmed && !FINE && state === 'base' && !ui && !paused && !talkedMarla(); }
function tickWake() { const F = CONFIG.fresh; if (F.wake && save && state === 'base' && !talkedMarla()) wakeArmed = true; const held = everHeld || mouseHeld(); if (wakeArmed && talkedMarla() && (held || !FINE)) wakeArmed = false;
  const show = wakeArmed && FINE && state === 'base' && !ui && !paused, t = !show ? '' : !held && !talkedMarla() ? F.wakeBoth : !held ? F.wakeClick : !talkedMarla() ? F.wakeTalk : '';
  if (t !== wakeT) { wakeT = t; if (t) H2.say('wake', t, F.wakePrio, 0); else H2.unsay('wake'); }
  if (state !== 'base' || !keys.KeyN || ui || paused) H2.unsay('nbase'); }
// the mouse-look hint stays away while N is held, during the drill and the opening, under the waking prompt and while any panel or the hold-H card is up
function mlookQuiet() { return !!keys.KeyN || !!drill || !!intro || !!wakeT || kitOpen || !!ui || loreOpen || !!$('jobCard') || document.body.classList.contains('hkeys'); }
// Marla's first talk on day 1: her line, one line on what "Ride out" does, Ride out and "Look around first"; the ring and device pickers open behind "Set up the run" (from the second talk on they show as before)
function scoutFirst() { const F = CONFIG.fresh, first = !talkedMarla(), sc = $('scout'); if (save) { save.talkedMarla = true; persist(); } sc.classList.toggle('first', first); sc.classList.remove('setup'); $('scoutRide').textContent = F.rideLine; $('sback').textContent = first ? F.lookBtn : F.stayBtn; $('ssetup').textContent = F.setupBtn; }
$('ssetup').onclick = () => { const sc = $('scout'), on = !sc.classList.contains('setup'); sc.classList.toggle('setup', on); $('ssetup').textContent = on ? CONFIG.fresh.setupHide : CONFIG.fresh.setupBtn; };
// the pause menu opens the Keys card, the journal and the big map; each hands back to the pause menu when it closes
function backToPause() { if (paused) $('pause').style.display = 'flex'; }
function openKeys() { $('pause').style.display = 'none'; document.body.classList.add('keyscard'); $('keys').style.display = 'flex'; }
function closeKeys() { document.body.classList.remove('keyscard'); $('keys').style.display = 'none'; backToPause(); }
function openBigMap() { const B2 = CONFIG.fresh.bigMap; $('pause').style.display = 'none'; $('bigmap').style.display = 'flex'; $('bmapKey').textContent = B2.key; drawMap($('bmap'), Math.max(120, Math.round(Math.min(innerWidth * B2.share, innerHeight * B2.share, innerHeight - 150))), B2.radius, B2.glyphMax); }
function closeBigMap() { $('bigmap').style.display = 'none'; backToPause(); }
$('pKeys').onclick = openKeys; $('keysClose').onclick = closeKeys; $('pMap').onclick = openBigMap; $('bmapClose').onclick = closeBigMap;
$('pJournal').onclick = () => { if (!save) return; $('pause').style.display = 'none'; openPanel('journal', backToPause); };
{ const L = FINE ? CONFIG.fresh.keysDesk : CONFIG.fresh.keysPhone; $('keysBody').innerHTML = L.map((q) => '<span class="k">' + q[0] + '</span><span>' + q[1] + '</span>').join(''); }
{ const D = CONFIG.drill, st = document.documentElement.style; st.setProperty('--dsub-px', D.subPx[FINE ? 0 : 1] + 'px'); st.setProperty('--dm-px', D.mark.px + 'px'); st.setProperty('--dm-c', D.mark.color); }
// Esc closes the open panel and does nothing else on that press (the ink books close themselves); true when a panel was open
function escClose() { if ($('keys').style.display === 'flex') { closeKeys(); return true; } if ($('bigmap').style.display === 'flex') { closeBigMap(); return true; } if (ui === 'journal' || ui === 'mjournal') return true;
  if (ui === 'scout') { $('sback').click(); return true; } if (kitOpen) { closeKit(); return true; } if (ui && $('qb').style.display !== 'none') { $('qb').style.display = 'none'; ui = null; return true; } return false; }
// ---- DEVICE BAR (owner Nov 17 18:28, CONFIG.devBar): only the picked device shows; a switch opens the full bar for openSecs, holding H too; on a phone the switch tab opens it and a tap picks one
let barOpenT = 0; function barOpen() { barOpenT = CONFIG.devBar.openSecs; }
function tickBar(dt) { barOpenT = Math.max(0, barOpenT - dt); $('hud').classList.toggle('devc', !(barOpenT > 0 || document.body.classList.contains('hkeys') || !!(drill && drill.held))); }
// context chips from night 2 on (desktop): hold H keys always, F eat when hurt at night, Q solar by day in a house while the Sun is not full, E leave at the door
// (owner 11:40) the chips' text is built only when what it says changes (CHK: food to eat, solar, leave)
let CHK = '';
function tickChips() { if (!FINE) return; const P = sim && sim.player, eat = P && sim.phase === 'night' && P.hp < CONFIG.player.hp * CONFIG.chips.eatBelow && sim.food > 0 ? sim.food : -1, sol = !!(P && sim.phase === 'day' && P.energy < CONFIG.player.energyCap), lv = $('bLeave').style.display === 'flex', key = eat + '|' + sol + '|' + lv; if (key === CHK) return; CHK = key;
  const ch = []; if (P && sim.phase === 'night' && P.hp < CONFIG.player.hp * CONFIG.chips.eatBelow && sim.food > 0) ch.push(['F', 'eat · ' + sim.food + ' to bring home']); if (P && sim.phase === 'day' && P.energy < CONFIG.player.energyCap) ch.push(['Q', 'solar']); if ($('bLeave').style.display === 'flex') ch.push(['E', 'leave']);
  const h = '<span class="k">hold H</span> keys' + ch.map((q) => ' <span class="k">' + q[0] + '</span> ' + q[1]).join(''), el = $('hchip'); if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } }
// ---- BASE MINIMAP (owner Nov 17 19:43, CONFIG.miniMap): a round top-down map in the quest corner, the player in the middle facing up, Marla as a bright dot (an arrow on the rim when she is
// farther than the radius), faint landmark letters, a north tick; a 2D canvas redrawn at CONFIG.miniMap.hz; shown in the base by day outside rooms and panels (holding H shows it in a room too)
let mapT = 0, mapInfo = null;
function mapMarks() { const S = B.STATIONS, m = [['W', S.workshop.x, S.workshop.z], ['B', S.board.x, S.board.z], ['home', B.HOME.x, B.HOME.z]]; if (CONFIG.avians && CONFIG.avians.at) m.push(['H', CONFIG.avians.at[0], CONFIG.avians.at[1]]);
  const BW = CONFIG.baseWater; if (BW && BW.on && BW.stream && BW.race) { const a = BW.stream[BW.race[0]], c = BW.stream[BW.race[1]]; if (a && c) m.push(['wheel', (a[0] + c[0]) / 2, (a[1] + c[1]) / 2]); } return m; }
function tickMap(dt) { const M = CONFIG.miniMap, cv = $('mmap'); const indoor = !!bview.rooms && (inRoom(bview.rooms.WS, bp.x, bp.z) || inRoom(bview.rooms.MH, bp.x, bp.z));
  const show = M.on && state === 'base' && !ui && !paused && save && (!indoor || document.body.classList.contains('hkeys')); if (cv.classList.contains('on') !== show) cv.classList.toggle('on', show); $('hud').classList.toggle('hasmap', show); if (!show) { mapInfo = null; return; }
  mapT -= dt; if (mapT > 0) return; mapT = 1 / M.hz;
  // LAG FIX Nov 19 (owner 11:27): drawn again only when what it shows changed (your place and facing, Marla's spot, the marks; every time while the first night's goal pulses)
  { const sp = B.scoutPos(save), mk = mapMarks(), k = bp.x.toFixed(2) + ',' + bp.z.toFixed(2) + ',' + yaw.toFixed(3) + ',' + sp.x.toFixed(2) + ',' + sp.z.toFixed(2) + ',' + (save.nights ? 0 : performance.now()) + ',' + (FINE ? 1 : 0) + ',' + mk.map((q) => q.join(':')).join(';'); if (k === mapKey && mapInfo) return; mapKey = k; }
  mapInfo = drawMap(cv, FINE ? M.px[0] : M.px[1], M.radius, 1e9); }
let mapKey = '';
// the round map drawn into a canvas: css size (px), metres from you to its rim, largest glyph (px); the corner map and the big pause-menu map (fresh-player fix, owner Nov 18) share it; returns where Marla and the marks were drawn
function drawMap(cv, css, rad, gMax) { const M = CONFIG.miniMap, dpr = Math.min(2, devicePixelRatio || 1); const W = Math.round(css * dpr);
  // (player report Nov 20, Retina Mac: the corner map filled the window) the size on screen is set whenever it differs, not only when the pixel size changes: at 2x a
  // 150 px map is 300 pixels, the size a new canvas already has, so the screen size was never set and the page's rule for canvases (full window) stretched it
  if (cv.width !== W) cv.width = cv.height = W; if (cv.style.width !== css + 'px' || cv.style.height !== css + 'px') cv.style.width = cv.style.height = css + 'px';
  const x = cv.getContext('2d'), C = M.col, r = css / 2, k = (r - 8) / rad, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), at = (wx, wz) => { const dx = wx - bp.x, dz = wz - bp.z; return [r + (dx * rx + dz * rz) * k, r - (dx * fx + dz * fz) * k]; };
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, css, css); x.globalAlpha = M.alpha; x.fillStyle = C.bg; x.beginPath(); x.arc(r, r, r - 1, 0, 7); x.fill(); x.save(); x.clip();
  x.strokeStyle = C.grid; x.lineWidth = 1; for (const q of [0.33, 0.66]) { x.beginPath(); x.arc(r, r, (r - 8) * q, 0, 7); x.stroke(); }
  x.fillStyle = C.glyph; x.strokeStyle = C.glyph; x.lineWidth = 1.5; const gs = Math.min(gMax, css * M.glyph); x.font = '800 ' + Math.round(gs) + 'px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const spm = B.scoutPos(save), [smx, smy] = at(spm.x, spm.z), drawn = [[smx, smy]]; for (const [g, wx, wz] of mapMarks()) { const [px, py] = at(wx, wz); if (Math.hypot(px - r, py - r) > r - gs * 0.7 || drawn.some((d) => Math.hypot(d[0] - px, d[1] - py) < gs * 1.1)) continue; drawn.push([px, py]); if (g === 'home') { const h = gs * 0.42; x.beginPath(); x.moveTo(px - h, py + h); x.lineTo(px - h, py - h * 0.2); x.lineTo(px, py - h); x.lineTo(px + h, py - h * 0.2); x.lineTo(px + h, py + h); x.closePath(); x.fill(); } else if (g === 'wheel') { const h = gs * 0.42; x.beginPath(); x.arc(px, py, h, 0, 7); x.stroke(); for (let q = 0; q < 4; q++) { x.beginPath(); x.moveTo(px + Math.cos(q * 0.785) * h, py + Math.sin(q * 0.785) * h); x.lineTo(px - Math.cos(q * 0.785) * h, py - Math.sin(q * 0.785) * h); x.stroke(); } } else x.fillText(g, px, py); }
  x.restore(); x.globalAlpha = 1; x.strokeStyle = C.rim; x.lineWidth = 2; x.beginPath(); x.arc(r, r, r - 1, 0, 7); x.stroke();
  { const [nx, ny] = at(bp.x, bp.z - 1000), a = Math.atan2(ny - r, nx - r); x.strokeStyle = C.north; x.lineWidth = 2; x.beginPath(); x.moveTo(r + Math.cos(a) * (r - 1), r + Math.sin(a) * (r - 1)); x.lineTo(r + Math.cos(a) * (r - 8), r + Math.sin(a) * (r - 8)); x.stroke(); }
  x.fillStyle = C.player; x.beginPath(); const as = 0.8 * Math.min(css / M.px[0], 1.6); x.moveTo(r, r - 7 * as); x.lineTo(r + 5 * as, r + 5 * as); x.lineTo(r, r + 2 * as); x.lineTo(r - 5 * as, r + 5 * as); x.closePath(); x.fill();
  const sp = B.scoutPos(save), [mx, my] = at(sp.x, sp.z), d = Math.hypot(mx - r, my - r), edge = d > r - 9, dot = M.dot * Math.min(css / M.px[0], 1.6), goal = !save.nights, pz = goal ? 0.5 + 0.5 * Math.sin(performance.now() / 1000 * M.pulse * 6.283) : 0;
  x.fillStyle = C.marla; x.strokeStyle = C.marla;
  if (!edge) { x.beginPath(); x.arc(mx, my, dot, 0, 7); x.fill(); x.lineWidth = 1.5; x.beginPath(); x.arc(mx, my, dot + 3 + 3 * pz, 0, 7); x.stroke(); return { marla: [mx, my], edge: false, size: css, marks: drawn.slice(1), gs }; }
  else { const a = Math.atan2(my - r, mx - r), ex = r + Math.cos(a) * (r - 7), ey = r + Math.sin(a) * (r - 7); x.save(); x.translate(ex, ey); x.rotate(a); x.beginPath(); x.moveTo(6 + 2 * pz, 0); x.lineTo(-5, -5); x.lineTo(-5, 5); x.closePath(); x.fill(); x.restore(); return { marla: [ex, ey], edge: true, angle: a, size: css, marks: drawn.slice(1), gs }; } }
// a short gold "+N Sun" pop by the Sun bar when the boss spills Sun (a broken paw or core; src/boss.js 'spill'); CONFIG.ui.sunPop
function sunPop(n) { const el = $('sunpop'), b = $('enb').getBoundingClientRect(); if (!(n > 0) || !b.width) return; el.innerHTML = H2.SUNI + '+' + Math.round(n) + ' ' + CONFIG.ui.sun; el.style.left = Math.round(b.right + 8) + 'px'; el.style.top = Math.round(b.top + b.height / 2) + 'px'; el.style.setProperty('--pop', CONFIG.ui.sunPop.secs + 's'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(sunPop.t); sunPop.t = setTimeout(() => el.classList.remove('on'), CONFIG.ui.sunPop.secs * 1000); }
// the first meal of a run: Marla reminds you it is the village's food (owner Nov 17 23:58); not during the night-1 drill, whose own lines run then
function supperLine() { const o = run || sim; if (!o || o.supperTold || drill) return; o.supperTold = true; H2.say('marla', B.MARLA_LINES.supper[0], CONFIG.ui.centre.marla, CONFIG.village.supperSecs); }
// AIM PER TIER (owner Nov 18 12:11: "desktop must be perfect; phone model allows more leeway on hit"): bots and tests use CONFIG.cannon.shapes.low. When you fire, the machines near the aim
// line are ray-cast as drawn this frame (their triangles; arms and turning torsos move): on desktop the shot hits exactly what is drawn; on phones the lenient .low oval also hits, and the
// drawn head decides head shots on both. CONFIG.cannon.live.
setShotTier(QUALITY);
// one drawn machine, hit by the aimed shot along the sim's own aim (eye, player yaw and pitch): the first of its visible solid triangles the shot meets, above the floor it stands on.
// Returns { t: distance along the aim measured flat (m, as the sim measures), head: that triangle belongs to a head part } or null for a miss. Head parts: the meshes under the
// builder's head nodes (each Ticks unit has its own screen); when they hold most of the machine (the Warden's turning torso), whatever is hit in its top live.headTop m
const LVR = new THREE.Raycaster(), LVO = new THREE.Vector3(), LVD = new THREE.Vector3(), LVB = new THREE.Box3(), LVH = [];
// the phone-tier machines' merged pieces stay as invisible hit shapes on HIT_LAYER (src/mergestatic.js): the aimed shot still sees them, and skips the merged draw mesh
LVR.layers.enable(HIT_LAYER); LVR.layers.enable(1);
// LAG FIX Nov 19: the hit test always uses the full meshes, also for a machine drawn with its far copy (src/lod.js lodFull)
// (owner 12:49) a machine posed every 2nd frame (farAnim) is posed now, before the aimed shot tests it, so the shot always meets the current pose
function drawnHit(m, P) { const st = m.userData.stale; if (st && m.userData.anim) { m.userData.anim(performance.now() / 1000, st); m.updateMatrixWorld(true); m.userData.stale = null; } const back = lodFull(m); try { return drawnHit0(m, P); } finally { if (back) back(); } }
// (LAG FIX Nov 19, owner 10:35) per machine, kept until its pieces change (a merge clears it): the head pieces as a Set and, in traverse order, every piece that can be a
// hit shape at all; each call still applies the full test (visible, opacity) to them, and the ray tests only them, so the result is the same as testing the whole machine
const HITC = new WeakMap();
function hitCache(m) { let c = HITC.get(m); if (c) return c; const heads = new Set(), list = []; for (const h of m.userData.heads || [m.userData.head]) if (h) h.traverse((q) => heads.add(q));
  m.traverse((q) => { if (q.isMesh && !q.isSprite && !q.userData.blob && !q.userData.mergedDraw) list.push(q); }); c = { heads, list }; HITC.set(m, c); return c; }
function drawnHit0(m, P) { const L = CONFIG.cannon.live, HC = hitCache(m), headSet = HC.heads;
  const solid = (q) => { if (!q.isMesh || q.isSprite || q.userData.blob || q.userData.mergedDraw) return false; let v = q; while (v) { if (!v.visible) return false; v = v.parent; } const mt = Array.isArray(q.material) ? q.material[0] : q.material; return !(mt && (mt.blending === THREE.AdditiveBlending || (mt.transparent && (mt.opacity < L.minOpacity || q.geometry.type === 'PlaneGeometry')))); };
  m.updateMatrixWorld(true);
  // (R4 worker 5) a part frozen out of the matrix pass (src/glbmerge.js freezeStillBones) keeps the world matrix of the moment it was frozen: the forced update above
  // skips it (matrixWorldAutoUpdate off), so the hit shape is put where it is drawn: its moving ancestor's world matrix times the kept offset
  // (Nov 21, phone shot probe: 75-89 hit shapes per machine lay where it was merged, not where it is drawn) a merged machine's hit shapes (src/mergestatic.js: hitOnly,
  // matrixWorldAutoUpdate off) are skipped by the forced update too: each is put under its parent as drawn (parent's world x its own kept matrix)
  for (const q of HC.list) { const z = q.userData.fz; if (z) q.matrixWorld.multiplyMatrices(z.a.matrixWorld, z.off); else if (q.userData.hitOnly && !q.matrixWorldAutoUpdate && q.parent) q.matrixWorld.multiplyMatrices(q.parent.matrixWorld, q.matrix); }
  let hv = 0, av = 0, top = -1e9;
  for (const q of HC.list) { if (!solid(q)) continue; const gm = q.geometry; if (!gm.boundingBox) gm.computeBoundingBox(); LVB.copy(gm.boundingBox).applyMatrix4(q.matrixWorld); const v = (LVB.max.x - LVB.min.x) * (LVB.max.y - LVB.min.y) * (LVB.max.z - LVB.min.z); av += v; if (headSet.has(q)) hv += v; if (LVB.max.y > top) top = LVB.max.y; }
  const torso = hv > L.headShare * av, cp = Math.cos(P.pitch || 0);
  LVO.set(P.x, P.floor * FH + CONFIG.cannon.eye, P.z); LVD.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch || 0), -Math.cos(P.yaw) * cp); LVR.set(LVO, LVD); LVR.camera = cam; LVR.near = 0; LVR.far = CONFIG.cannon.range / Math.max(0.05, cp);
  LVH.length = 0; for (const h of LVR.intersectObjects(HC.list, false, LVH)) { if (!solid(h.object) || h.point.y < m.position.y - 0.01) continue; return { t: h.distance * cp, head: torso ? h.point.y >= top - L.headTop : headSet.has(h.object) }; }
  return null; }
// the aimed shot against the machines near the aim line as drawn, by Gloom id (both tiers: desktop hits on it alone, phones use it for head shots and as extra body; src/sim.js fireCannon)
function liveShapes() { const L = CONFIG.cannon.live; if (!L.on || !sim) return null; const P = sim.player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), out = {};
  for (const g of sim.gloom) { const dx = g.x - P.x, dz = g.z - P.z, d = Math.hypot(dx, dz); if (d > CONFIG.cannon.range + 3 || (d > L.near && (dx * fx + dz * fz) / d < L.cos)) continue; const m = gMesh.get(g.id); if (m) out[g.id] = { ray: drawnHit(m, P) }; } return out; }
function doFire(charged) { if (!sim && run && state === 'play') { const i = aimedDormant(CONFIG.dormant.shotCos, CONFIG.dormant.shotReach); if (i >= 0) { hands.fire(); shotSfx(); wakeDormant(i, 'shot'); } return; } if (sim && sim.player.climb) { flash("can't shoot while climbing"); return; } if (charged) { if (sim && sim.fireCannon('ray', 1, true, liveShapes())) { hands.fire(); shotSfx(); impactEvents(sim.log); drillDid('charge'); const p = sim.player; tracer(p.x, p.z, p.x - Math.sin(p.yaw) * 14, p.z - Math.cos(p.yaw) * 14, 1.3, p.floor, 0xffe08a); if (!save || !save.toldCharge) { if (save) { save.toldCharge = true; persist(); } marlaHint('Charged shot: it goes through every one in the line. It drinks three shots of Sun.'); } } else if (sim && sim.phase === 'night') flash('not enough Sun for a charged shot (' + CONFIG.cannon.cost * CONFIG.cannon.charge.cost + ' Sun)', true); return; } if (sim && sim.fireCannon('ray', 1, false, liveShapes())) { hands.fire(); shotSfx(); impactEvents(sim.log); drillDid('shoot'); const p = sim.player; tracer(p.x, p.z, p.x - Math.sin(p.yaw) * 14, p.z - Math.cos(p.yaw) * 14, 1.3, p.floor, 0x7fd8ff); } }
// the devices you carry tonight: your loadout on a run, the first three in test mode
const slotKinds = () => (fromBase && save ? B.loadout(CONFIG, save) : CONFIG.loadout.first);
const doSlot = (i) => { const k = slotKinds()[i]; if (k) doPlace(k); };
function doPlace(kind) { if (!sim) return; const had = new Set(sim.devices.map((d) => d.id)), r = sim.place(kind); if (r.ok) { hands.throw(); if (kind !== 'collector') drillDid('place'); const land = performance.now() + 1000 * CONFIG.hands.throwTime * (CONFIG.hands.throwRelease + CONFIG.hands.throwFly); for (const d of sim.devices) if (!had.has(d.id)) landAt.set(d.id, land); if (kind === 'collector' && save && !save.solarDone) { save.solarDone = true; persist(); flash('First collector up. Your Sun now fills faster. You can leave when you like.', 2); return; } } const dn = CONFIG.devices[kind].name, dt2 = CONFIG.devices[kind].text; if (r.reason === 'day') { flash(dn + ': ' + dt2 + ' (Place it at night.)', 2); return; } flash(r.ok ? (dn + ' placed: ' + dt2) : (r.reason === 'energy' ? 'not enough Sun: ' + CONFIG.devices[kind].name + ' needs ' + CONFIG.devices[kind].cost + ' Sun' : r.reason === 'sun' ? 'Collectors need sunlight: face a door or window and step closer' : r.reason === 'close' ? 'Too close to another device: spread the collectors out' : r.reason === 'day' ? 'That is for the night. By day: SOLAR and crates' : r.reason === 'night' ? 'The sun is down: collectors only go up in daylight' : r.reason === 'no breach or stairs in reach' ? 'panels go on a breach point or the stairs on this floor: stand near one' : r.reason === 'climbing' ? "can't place while climbing" : r.reason === 'group' ? 'limit reached: only ' + CONFIG.groupMax.power + ' Sun makers at once (turbines and moon panels together)' : r.reason === 'cap' ? 'limit reached: only ' + CONFIG.devices[kind].max + ' ' + kind + 's at once' : r.reason)); if (r.ok) flashT = 4; }
function doEat() { if (!sim) return; if (sim.eat() && (supperLine() || true) && (drillDid('eat') || true)) flash('ate: +' + CONFIG.food.heal + ' HP'); else flash(sim.food <= 0 ? 'no food left' : sim.player.hp >= CONFIG.player.hp ? 'already full HP' : 'wait'); }
btn('bEat', doEat); for (const [id, fn] of [['bSkip', () => drillEnd(true)], ['bSwitch', () => { barOpenT = barOpenT > 0 ? 0 : CONFIG.devBar.tabSecs; }]]) $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (state === 'play' && !paused) fn(); }); btn('bFire', () => { if (state === 'base') doUse(); else { doFire(); chargeHeld = true; } }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('bFire').addEventListener(ev, () => { chargeHeld = false; }); btn('bLeave', () => leaveHouse()); btn('b0', () => doPlace('collector')); { const de = $('bDusk'); de.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); duskDown = true; }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) de.addEventListener(ev, () => { duskDown = false; }); } for (let i = 0; i < 5; i++) { const el = $('b' + (i + 1)); let tm = 0, read = false, downAt = 0; const tip = () => { read = true; const k = slotKinds()[i]; if (k) flash(CONFIG.devices[k].name + ': ' + CONFIG.devices[k].text, 2); }; const ok = () => state === 'play' && !paused; el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); read = false; downAt = e.timeStamp; clearTimeout(tm); if (!ok()) return; tm = setTimeout(tip, CONFIG.hud.holdMs); }); el.addEventListener('pointerup', (e) => { e.stopPropagation(); clearTimeout(tm); if (!read && ok() && e.timeStamp - downAt >= CONFIG.hud.holdMs) tip(); else if (!read && ok()) { if (barOpenT > 0 && i !== selSlot) { pickSlot(i); barOpenT = 0; } else doSlot(i); } read = false; }); el.addEventListener('pointercancel', () => { clearTimeout(tm); read = false; }); el.addEventListener('pointerleave', () => { clearTimeout(tm); }); }
let baseMoved = false, questOpenT = 0;
addEventListener('keydown', (e) => { if (e.code === 'Tab' && state === 'base') { e.preventDefault(); questOpenT = questOpenT > 0 ? 0 : CONFIG.baseHud.questOpen; } });
$('bq').addEventListener('pointerdown', (e) => { e.stopPropagation(); questOpenT = questOpenT > 0 ? 0 : CONFIG.baseHud.questOpen; });
let flashT = 0; function flash(t, red) { $('msg').textContent = t; $('msg').style.color = red === 2 ? '#ffe9b0' : red ? '#ff8a7a' : ''; flashT = red === 2 ? (state === 'base' ? CONFIG.baseHud.msgFade : 7) : red ? 3 : 2; } // red = true: warning; 2: good news / info, shown longer

// ---- break cue: debris, red blink at the breach, message with direction, sound
const debris = [];
let ac = null;
// the base's water sound (src/basesound.js, CONFIG.baseWater.sound): only in the base; baseU = the base view's last update (deck height, water distances, indoors); baseCamY = your eye height there (rides over bridge decks)
const waterSnd = createWaterSound(CONFIG); let baseU = null, baseCamY = 1.6;
const mus = { el: {}, cur: null, on: CONFIG.music.on };
// (R3, owner 14:10: under 20 MB before the base) the click that starts the game readies only the tracks it needs now (the base's; and the night's for the film);
// the others are readied at the player's next click or key (the same play-then-pause in a gesture, so phones allow them later) and load from then on; the
// remaining sharp textures are asked for then too (askAllHi)
function musicOne(k) { if (mus.el[k]) return; try { const a = (mus.pre && mus.pre[k]) || new Audio(MUSIC[k]); a.loop = true; a.volume = 0; a.preload = 'auto'; mus.el[k] = a; const pr = a.play(); if (pr && pr.then) pr.then(() => { if (mus.cur !== k) { a.pause(); try { a.currentTime = 0; } catch (e) { /* fine */ } } }).catch(() => {}); } catch (e) { /* no music on this browser */ } }
function musicRest() { for (const k in MUSIC) musicOne(k); askAllHi(); }
function musicUnlock(film) { if (mus.ready) { if (film) musicOne('night'); return; } mus.ready = true; try { mus.on = CONFIG.music.on && !(storage && storage.getItem('solardg.music') === 'off'); } catch (e) { /* keep default */ } showMusic(); musicOne('base'); if (film || !MUSIC.base) musicOne('night'); if (!MUSIC.base) musicRest(); else { const later = () => { removeEventListener('pointerdown', later, true); removeEventListener('keydown', later, true); musicRest(); }; setTimeout(() => { addEventListener('pointerdown', later, true); addEventListener('keydown', later, true); }, 0); } $('bMusic').textContent = 'Music: ' + (mus.on ? 'on' : 'off'); }
// ---- START FLOW (owner Nov 17 23:33 / 23:36; CONFIG.splash): the V logo, the DAWNPUNK title card, then the loading page with REAL progress (each stage is counted from actual
// loads: the three.js loading manager for models and textures, the handwriting fonts, the music files, a shader compile of the scene), then the begin button #enter.
// The scripted checks (?quality= in the address) skip the logo and title time unless &splash=1. window.__loadMs = milliseconds from navigation to the begin button.
// LAG FIX Nov 19 (owner 12:45/12:49): the base is prepared in TIME SLICES from the title on (titleBase starts it, baseSlice runs it each frame): its build parts
// (src/baseview.js bgStep, at most CONFIG.lag.slice.ms a frame; one part is not cut), then its whole-base passes one a frame, then its shaders in the background
// (compileAsync a few pieces a frame). Only on the title (and never while the tab is hidden); Enter or the film take over what is left.
// A first visit's base is prepared for the save made here (preSave), which Enter and 'watch' then use.
let preSave = null; const TB = { phase: '', list: null, i: 0, rt: null, t0: 0 };
function titleBase() { if (!CONFIG.lag.keepBase || BOTRUN() || state !== 'menu' || TB.phase || FILM.it) return; let sv = null; try { sv = B.loadSave(CONFIG, storage); } catch (e) { sv = null; } if (!sv) return;
  let had = false; try { had = !!(storage && storage.getItem('solardg.save')); } catch (e) { had = false; } if (!had) { if (sv.day === 1 && !sv.nights) sv.scoutSpot = 4; preSave = sv; }
  if (bview.bgStart(sv)) { TB.phase = 'build'; TB.t0 = performance.now(); } }
// (H round 2) the title's slow frames from this work, by phase (cardInfo().title.slow: [phase, post step, ms]) so a long title frame is named
function baseSlice() { const ph = TB.phase, t0 = performance.now(); baseSlice0(); const ms = performance.now() - t0; if (ms > 50) { TB.slow = TB.slow || []; if (TB.slow.length < 20) TB.slow.push([ph, TB.post || 0, Math.round(ms)]); } }
function baseSlice0(force) { const S = CONFIG.lag.slice, SB = S ? (force ? S.film : S.ms) : 0; if (!TB.phase || TB.phase === 'done' || !S) return; if (!force && (state !== 'menu' || document.hidden)) { if (state !== 'menu' && !bview.bgBusy && TB.phase === 'build') TB.phase = ''; return; }
  const g = bview.group;
  if (TB.phase === 'build') { if (!bview.bgBusy) { TB.phase = ''; return; } if (bview.bgStep(SB)) { TB.phase = 'post'; TB.post = 0; } return; }
  // after the build, one of its whole-base passes a frame (relief maps, small casters, the still pieces merged), then its shaders in the background
  // (Nov 20, title frames of 68-136 ms in these passes on the Mac) the relief and small-caster passes walk the base's top-level pieces SB at a time (each is a
  // plain walk, so piece by piece is the same); the merge and the material pass are a frame each
  if (TB.phase === 'post') { const k = TB.post, p0 = performance.now(); TB.postMs = TB.postMs || [];
    if (k === 0 || k === 1) { if (!TB.pq) { TB.pq = [...g.children]; if (k === 1) g.updateMatrixWorld(true); } while (TB.pq.length && performance.now() - p0 < SB) { const c = TB.pq.shift(); if (c.parent !== g) continue; if (k === 0) applyRelief(c); else noSmallCasters(c); } if (!TB.pq.length) { TB.pq = null; TB.post++; } }
    else if (k === 2) { if (!TB.mi) TB.mi = bview.mergeStillIter(); let dn = false; do { dn = TB.mi.next().done; } while (!dn && performance.now() - p0 < SB); if (dn) { TB.mi = null; TB.post++; } } else if (k === 3) { unifyBase(); TB.post++; } else { TB.phase = 'compile'; TB.cq = [...g.children]; }
    const pm = Math.round(performance.now() - p0); if (pm > 25) TB.postMs.push([k, pm]); return; }
  // (H round 2, the title's seconds-long frames) the base's shaders are built a few of its pieces at a time (compileAsync on each, its sync part at most SB a frame:
  // SPREAD); the off-screen draws are gone (REMOVED: they made the GPU's draw states for a 64 px target, not for the screen, so the home card draws on screen anyway)
  if (TB.phase === 'compile') { const t1 = performance.now(); if (!renderer.compileAsync) { TB.phase = 'done'; return; } const inS = !!g.parent; if (!inS) scene.add(g);
    // (owner Nov 22 16:22, "why is the title still so laggy": titleprobe on the Mac, run 45002689486) two causes in this phase. 1: a top-level piece holds many
    // materials, so one compileAsync's sync part took 142-250 ms in a frame; now one piece per material and kind (skinned, instanced, morphed) at a time, SB ms a frame.
    // 2: the draw phase began the frame the last compileAsync was ASKED, while the GPU was still building ~hundreds of programs; its first draw read a program's
    // link status, which waits for every queued build: one title frame of 7583 ms (getProgramParameter < getUniforms < renderBufferDirect, GPU main thread busy
    // 7574 ms). Now the draw phase waits until every compileAsync has resolved (they poll the GPU's completion flag, which never waits)
    if (!TB.lv) { TB.lv = true; TB.pend = []; const seen = new Set(), lv = []; for (const c of TB.cq) c.traverse((o) => { if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return; const ms = Array.isArray(o.material) ? o.material : [o.material], k = ms.map((m) => m.id).join(',') + (o.isSkinnedMesh ? 's' : '') + (o.isInstancedMesh ? 'i' : '') + (o.morphTargetInfluences ? 'm' : '') + (o.isBatchedMesh ? 'b' : ''); if (seen.has(k)) return; seen.add(k); lv.push(o); }); TB.cq = lv; }
    try { while (TB.cq.length && performance.now() - t1 < SB) { const c = TB.cq.shift(); let inG = false; for (let q = c; q; q = q.parent) if (q === g) { inG = true; break; } if (inG) TB.pend.push(renderer.compileAsync(c, cam, scene).catch(() => {})); } } finally { if (!inS) scene.remove(g); }
    if (TB.cq.length) return;
    if (!TB.pw) { TB.pw = true; TB.pdone = false; Promise.allSettled(TB.pend).then(() => { TB.pdone = true; }); }
    if (!TB.pdone) return;
    TB.pend = null; TB.pw = false; TB.lv = false; TB.phase = CONFIG.lag.titleDraw && CONFIG.lag.titleDraw.on ? 'draw' : 'done'; TB.ms = Math.round(performance.now() - TB.t0); pauseDrawn = false; return; }
  // (Nov 20, home card 7-12 s on the Mac, most of it the GPU making each draw state at its first draw: PROFILE=3 run 44722570694) CONFIG.lag.titleDraw: the base's
  // pieces are then drawn ON SCREEN a few at a time (the card's own drawPieces, shadow maps included) into a 2 px corner, each part waiting for the GPU to finish
  // the one before (gpuDone), so the draw states the home card needs exist before Enter; the card still makes its own passes (whatever is left is made there)
  if (TB.phase === 'draw') { const D = CONFIG.lag.titleDraw; if (TB.wait) return; const inS = !!g.parent; if (!inS) scene.add(g);
    try { if (!TB.dl) { TB.dl = []; TB.di = 0; TB.dn = 0; scene.traverse((o) => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o !== sky.mesh) TB.dl.push(o); }); }
      // the first parts are one piece each (the very first draws carry the scene's one-time costs: 141-362 ms in one part on the Mac); under the film's black
      // (force) the parts are larger, since no frame is shown there
      const e = Math.min(TB.dl.length, TB.di + (force ? D.filmPieces : TB.dn < D.single ? 1 : D.pieces)), V = new THREE.Vector4(), on = renderer.getScissorTest(); renderer.getScissor(V); renderer.setScissorTest(true); renderer.setScissor(0, 0, 2, 2);
      try { renderer.shadowMap.needsUpdate = true; drawPieces(TB.dl, TB.di, e, null); } finally { renderer.setScissor(V); renderer.setScissorTest(on); } TB.di = e; TB.dn++; }
    finally { if (!inS) scene.remove(g); }
    TB.wait = true; gpuDone(D.cap).then(() => { TB.wait = false; });
    if (TB.di >= TB.dl.length) { TB.phase = 'done'; TB.dl = null; TB.drawMs = Math.round(performance.now() - TB.t0) - TB.ms; renderer.shadowMap.needsUpdate = true; pauseDrawn = false; } } }
const SPLASH = (() => {
  const S = CONFIG.splash, el = $('spl'), q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })(), quick = q.has('quality') && q.get('splash') !== '1';
  const t0 = performance.now(), st = { scripts: [1, 1], assets: [0, 0], fonts: [0, 1], music: [0, 0], warm: [0, CONFIG.lag.logoWarm && CONFIG.lag.logoWarm.on ? 2 : 1], base: [CONFIG.lag.loadBase && CONFIG.lag.loadBase.on ? 0 : 1, 1], film: [0, 1] }, began = {}, label = { scripts: 'Scripts', assets: 'Models and textures', fonts: 'Handwriting fonts', music: 'Music', warm: 'First scene (shaders)', base: 'Home base', film: 'Opening film' };
  const root = document.documentElement.style; root.setProperty('--sp-bg0', S.bg[0]); root.setProperty('--sp-bg1', S.bg[1]); root.setProperty('--sp-w0', S.word[0]); root.setProperty('--sp-w1', S.word[1]); root.setProperty('--sp-glow', S.glow); root.setProperty('--sp-tag', S.tagline);
  root.setProperty('--sp-b0', S.bar[0]); root.setProperty('--sp-b1', S.bar[1]); root.setProperty('--sp-b2', S.bar[2]); root.setProperty('--sp-b3', S.bar[3]); root.setProperty('--sp-fade', S.fade + 's'); $('stag').textContent = S.tag;
  if (FINE && S.particles) { const pz = $('spart'); for (let i = 0; i < S.particles; i++) { const d = document.createElement('i'); d.style.left = (5 + ((i * 53) % 90)) + '%'; d.style.animationDelay = (-(i * 0.73) % 9) + 's'; d.style.animationDuration = (7 + (i % 5)) + 's'; pz.appendChild(d); } }
  // models and textures: every three.js loader without its own manager reports here
  const M = THREE.DefaultLoadingManager; M.onStart = (u, l, t) => { st.assets = [l, t]; }; M.onProgress = (u, l, t) => { st.assets = [l, t]; }; M.onLoad = () => { st.assets = [st.assets[1], st.assets[1]]; began.assetsDone = true; };
  // fonts: the journal's handwriting fonts and the page's own
  Promise.all([Promise.resolve(loadBookFonts()).catch(() => {}), document.fonts ? document.fonts.ready : null]).then(() => { st.fonts = [1, 1]; });
  // music: each track preloaded until the browser can play it through (the same elements are used once sound is allowed)
  // LAG FIX Nov 19 (owner 11:40): the begin button waits only for the tracks the first minutes play (the base's; R3: the night's is readied by the film's own click, musicUnlock);
  // the others load once readied (musicOne)
  const needT = (k) => k === 'base' || !MUSIC.base;
  for (const k in MUSIC) if (needT(k)) st.music[1]++;
  // (R3) only the tracks the begin button waits for are fetched with the page; the others when musicOne readies them
  mus.pre = {}; for (const k in MUSIC) { if (!needT(k)) continue; try { const a = new Audio(); a.preload = 'auto'; a.loop = true; a.volume = 0; const done = () => { if (!a.__ok) { a.__ok = true; if (needT(k)) st.music[0]++; } }; a.addEventListener('canplaythrough', done, { once: true }); a.addEventListener('error', done, { once: true }); a.src = MUSIC[k]; a.load(); mus.pre[k] = a; } catch (e) { if (needT(k)) st.music[0]++; } }
  const SPW = {}; let phase = '', ready = false, loreI = 0, loreT = 0; const lore = CONFIG.intro.lines.map((l) => l[2]).filter((t) => !/^MARLA/.test(t)).concat(LORE.OLD_NOTICES.filter((t) => t.length < 90));
  const set = (ph) => { if (phase === ph) return; phase = ph; el.className = 'ph-' + ph; };
  const frac = () => { const W = S.weights; let a = 0, b = 0; for (const k in W) { const [d, t] = st[k], f = t > 0 ? Math.min(1, d / t) : (k === 'assets' && (began.assetsDone || performance.now() - t0 > 1500) ? 1 : 0); a += W[k] * f; b += W[k]; } return a / b; };
  const tick = () => { const now = performance.now(), age = (now - t0) / 1000;
    for (const k in st) if (k !== 'film' && st[k][0] < st[k][1] && age > S.stageCap) st[k][0] = st[k][1];
    if (!began.warm && (began.assetsDone || st.assets[1] === 0 || age > S.stageCap) && st.fonts[0] >= 1) { began.warm = true; requestAnimationFrame(() => { try { renderer.compile(scene, cam); renderer.render(scene, cam); } catch (e) { /* nothing to warm */ } st.warm[0] = 1; }); }
    // (R4 worker 11, OWNER DECISION lead 03:33, CONFIG.lag.logoWarm { on, ms }) right after the logo, once every model, texture, font and track has arrived: the scene
    // as the title will draw it (the models that came after the first warm-up included) has its shaders built in the background (compileAsync: the GPU's parallel
    // compile) and is drawn once on screen under the opaque loading page, its shadows too, the GPU made to finish it (fence); at most ms ms, then the begin button
    { const LW = CONFIG.lag.logoWarm; if (LW && LW.on && st.warm[0] === 1 && !began.warm2 && (quick || age >= S.logoSecs) && ['assets', 'fonts', 'music'].every((k) => st[k][0] >= st[k][1]) && (began.assetsDone || age > S.stageCap)) {
      began.warm2 = true; const tw = performance.now(), cap = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, Math.max(0, ms)))]);
      (async () => { try { if (renderer.compileAsync) await cap(renderer.compileAsync(scene, cam), LW.ms); renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); await cap(gpuDone(LW.ms), LW.ms - (performance.now() - tw)); } catch (e) { /* nothing to warm */ }
        SPW.logoWarmMs = Math.round(performance.now() - tw); st.warm[0] = 2; })(); } }
    // (owner 11:40) the bar, the percent and the stage line are written only when they change
    const f = frac(); setText('spct', Math.floor(100 * f) + '%'); sty($('sfill'), 'width', (100 * f).toFixed(1) + '%');
    const cur = Object.keys(S.weights).find((k) => st[k][1] > 0 ? st[k][0] < st[k][1] : false) || (f < 1 ? 'assets' : ''); setText('sstage', f >= 1 ? 'Ready' : 'Loading: ' + label[cur] + (cur === 'assets' && st.assets[1] ? ' (' + st.assets[0] + ' of ' + st.assets[1] + ')' : cur === 'music' ? ' (' + st.music[0] + ' of ' + st.music[1] + ')' : ''));
    if (now > loreT) { loreT = now + S.loreSecs * 1000; $('slore').textContent = lore[loreI++ % lore.length] || ''; }
    if (f >= 1 && !ready) { ready = true; window.__loadMs = Math.round(now); }
    // (Nov 20, Mac 44668704519: title frames of 138 / 132 ms at 2.0 / 2.3 s; cardInfo().title.worstPart: the base's preparation parts 23, 40, 207-212 took
    // 85-207 ms each, on the shown title) CONFIG.lag.loadBase { on, ms }: the base is prepared as the loading page's last stage ('Home base'), before the begin
    // button, not on the title; at most ms ms, then the title comes and the rest is done there as before (OWNER DECISION Nov 20 03:33: a step on the loading page)
    { const LB = CONFIG.lag.loadBase; if (LB && LB.on) { if (!began.base && ['scripts', 'assets', 'fonts', 'music', 'warm'].every((k) => st[k][0] >= st[k][1]) && (began.assetsDone || age > S.stageCap)) { began.base = true; began.baseAt = now; titleBase(); }
        if (began.base && st.base[0] < 1 && (TB.phase === 'done' || TB.phase === '' || now - began.baseAt > LB.ms)) { st.base = [1, 1]; SPW.loadBaseMs = Math.round(now - began.baseAt); } } }
    // (owner Nov 20 22:40) the opening film's preparation as the loading page's last stage for a first-time player (filmPre): started when every other stage is
    // done; the bar follows FILM.frac; the begin button comes when the film is ready and held (FILM.preDone), or after CONFIG.lag.loadFilm.ms at most
    // whether this page has a film stage is settled at the first tick after the page's own start-up (the page's switches it reads are set after this block)
    if (!began.filmW) { let w = null; try { w = filmPreWanted(); } catch (e) { w = null; } if (w !== null) { began.filmW = true; if (!w) st.film = [1, 1]; } }
    { const LF = CONFIG.lag.loadFilm; if (LF && LF.on && !began.film && ['scripts', 'assets', 'fonts', 'music', 'warm', 'base'].every((k) => st[k][0] >= st[k][1]) && (began.assetsDone || age > S.stageCap)) { began.film = true; began.filmAt = now; st.film = filmPre() ? [0, 100] : [1, 1]; }
      if (began.film && st.film[0] < st.film[1]) { if (FILM.preDone || !FILM.pre || now - began.filmAt > LF.ms) { st.film = [100, 100]; SPW.loadFilmMs = Math.round(now - began.filmAt); } else st.film[0] = Math.min(99, Math.round(100 * (FILM.frac || 0))); } }
    if (ready && !began.base) { began.base = true; setTimeout(titleBase, CONFIG.lag.titleBase * 1000); }
    if (quick) set(ready ? 'ready' : 'load'); else if (age < S.logoSecs) set('logo'); else if (age < S.logoSecs + S.titleSecs) set('title'); else set(ready ? 'ready' : 'load');
    SPW.phase = phase; SPW.frac = f; SPW.stages = st; SPW.loadMs = window.__loadMs || null; window.__splash = SPW; // one object, updated in place (owner 11:40: no copy each tick)
    if (!(phase === 'ready' && ready) || $('menu').style.display !== 'none') setTimeout(tick, 150); };
  tick(); return { get phase() { return phase; } };
})();
function musicTick(dt) { if (!mus.ready) return; const want = !mus.on || document.hidden ? null : state === 'intro' ? (intro && intro.part === 'town' ? 'night' : 'base') : state === 'base' ? 'base' : sim ? (sim.phase === 'night' ? 'night' : 'day') : (run && state === 'play') ? 'day' : mus.cur; if (want !== mus.cur) { mus.cur = want; const a = want && mus.el[want]; if (a && a.paused) { if (a.volume <= 0.001) { try { a.currentTime = 0; } catch (e) { /* not seekable yet */ } } const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); } }
  const top = (paused ? CONFIG.music.pausedVolume : CONFIG.music.volume) * MV.duck(), step = dt / CONFIG.music.fade; for (const k in mus.el) { const a = mus.el[k], tv = k === mus.cur ? top : 0, v = a.volume + Math.max(-step, Math.min(step, tv - a.volume)); a.volume = Math.max(0, Math.min(1, v)); if (k !== mus.cur && a.volume <= 0.001 && !a.paused) a.pause(); } }
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state !== 'running') ac.resume(); } catch (e) { ac = null; } return ac; }
// (owner 13:10, premortem L) the sound comes back after the tab was hidden (the browser suspends it): resumed when the tab shows again, and at the next tap or key in
// case the browser wants a gesture for it; never started here (only audio() starts it, at the first click as before)
const acWake = () => { try { if (ac && ac.state !== 'running' && ac.state !== 'closed' && !document.hidden) ac.resume().catch(() => {}); } catch (e) { /* no sound */ } };
document.addEventListener('visibilitychange', acWake); addEventListener('pointerdown', acWake, true); addEventListener('keydown', acWake, true);
function panOf(ev) { const p = sim.player, dx = ev.x - p.x, dz = ev.z - p.z, d = Math.hypot(dx, dz) || 1, y = p.yaw; return { pan: Math.max(-1, Math.min(1, (dx * Math.cos(y) - dz * Math.sin(y)) / d)), fwd: (dx * -Math.sin(y) + dz * -Math.cos(y)) / d, dist: d, dFloor: (ev.floor || 0) - p.floor }; }
// (LAG FIX Nov 19, owner 10:35) the gain + panner out chains are kept per context and reused once their sound has ended (the caller says when: outBusy), not built per sound
const OUTS = new WeakMap();
function outNode(a, pan) { let l = OUTS.get(a); if (!l) { l = []; OUTS.set(a, l); } const now = a.currentTime; let c = l.find((q) => q.busy <= now);
  if (!c) { const g = a.createGain(); let last = g, sp = null; if (a.createStereoPanner) { sp = a.createStereoPanner(); g.connect(sp); last = sp; } last.connect(a.destination); c = { g, sp, busy: 0 }; g.__slot = c; l.push(c); }
  c.busy = now + 30; if (c.sp) c.sp.pan.value = pan; return c.g; }
const outBusy = (g, end) => { if (g.__slot) g.__slot.busy = (isFinite(end) ? end : g.context.currentTime + 10) + 0.1; };
// one second of white noise per context, shared by every voice line (was a new buffer per line)
const VNOISE = new WeakMap();
function voiceNoise(a) { let b = VNOISE.get(a); if (b) return b; b = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; VNOISE.set(a, b); return b; }
// the break crunch's fading noise, one per context (was a new buffer per break)
const BNOISE = new WeakMap();
function breakNoise(a, len) { let b = BNOISE.get(a); if (b) return b; b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); BNOISE.set(a, b); return b; }
function sfxShot() { const a = audio(); if (!a) return; const S = CONFIG.sfx.shot, t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(S.from, t); o.frequency.exponentialRampToValueAtTime(S.to, t + S.len); g.gain.setValueAtTime(S.vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + S.len); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + S.len + 0.02); }
// the machines' voices: broken loudspeaker speech, made here from a buzzing tone shaped into vowels, hiss for consonants, then crushed; it stutters, drops out and slips in pitch
let noiseBuf = null, crushCurve = null; const VOW = { a: [730, 1090], e: [530, 1840], i: [270, 2290], o: [570, 840], u: [300, 870], y: [300, 2100] };
function sfxVoice(kind, line, obj) { const V = CONFIG.voice; if (!V.on || !line || state !== 'play' && state !== 'intro') return; const a = audio(); if (!a) return;
  const v3 = obj.getWorldPosition(new THREE.Vector3()).sub(cam.position), dist = v3.length(), pan = Math.max(-1, Math.min(1, v3.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)) / (dist || 1))), vol = V.vol * Math.max(0, 1 - dist / V.reach); if (!(vol >= 0.02) || !isFinite(pan)) return; // also skips a machine that has no position yet
  const out = outNode(a, pan); out.gain.value = vol; voiceN++; outBusy(out, voiceInto(a, out, kind, line)); }
let voiceN = 0;
function voiceInto(a, out, kind, line) { const V = CONFIG.voice; if (!crushCurve) { crushCurve = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 255.5 - 1; crushCurve[i] = Math.round(x * V.crush) / V.crush; } } const nb = voiceNoise(a);
  const [hz, slow] = V.kinds[kind] || V.kinds.walker; const sh = a.createWaveShaper(); sh.curve = crushCurve; const env = a.createGain(); env.gain.value = 0; sh.connect(env); env.connect(out);
  const osc = a.createOscillator(); osc.type = 'sawtooth'; const f1 = a.createBiquadFilter(), f2 = a.createBiquadFilter(), mix = a.createGain(); f1.type = f2.type = 'bandpass'; f1.Q.value = 7; f2.Q.value = 9; mix.gain.value = 1.8; osc.connect(f1); osc.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(sh);
  const ns = a.createBufferSource(); ns.buffer = nb; ns.loop = true; const nf = a.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 2600; const ng = a.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(sh);
  let t = a.currentTime + 0.03; const vowel = (ch, len, hzK) => { const F = VOW[ch]; f1.frequency.setValueAtTime(F[0], t); f2.frequency.setValueAtTime(F[1], t); osc.frequency.setValueAtTime(hz * hzK, t); env.gain.setValueAtTime(1, t); env.gain.setValueAtTime(0.0001, t + len * 0.86); t += len; };
  for (const raw of line.toLowerCase()) { const u = 0.085 * slow;
    if (VOW[raw]) { const slip = Math.random() < V.slip ? (Math.random() < 0.5 ? 0.5 : 1.5) : 1 + (Math.random() - 0.5) * 0.06; if (Math.random() < V.drop) { t += u; continue; } const reps = Math.random() < V.stutter ? 2 + Math.floor(Math.random() * 3) : 1; for (let k = 0; k < reps; k++) vowel(raw, reps > 1 ? u * 0.55 : u * 1.2, slip); }
    else if (raw >= 'a' && raw <= 'z') { ng.gain.setValueAtTime(0.5, t); ng.gain.setValueAtTime(0, t + 0.03 * slow); env.gain.setValueAtTime(0.7, t); env.gain.setValueAtTime(0.0001, t + 0.03 * slow); t += 0.045 * slow; }
    else t += raw === ' ' ? u * 0.8 : u * 2; }
  osc.start(); ns.start(); osc.stop(t + 0.1); ns.stop(t + 0.1); return t + 0.15; }
function sfxBreak(po, low) {
  const a = audio(); if (!a) return; const t = a.currentTime, len = 0.4, out = outNode(a, po.pan); out.gain.value = Math.max(0.25, 0.9 - po.dist / 40);
  const buf = breakNoise(a, len); outBusy(out, t + len);
  const src = a.createBufferSource(); src.buffer = buf; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(low ? 1500 : 3200, t); f.frequency.exponentialRampToValueAtTime(250, t + len); src.connect(f); f.connect(out); src.start(t);
  const o = a.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(low ? 90 : 150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); const og = a.createGain(); og.gain.setValueAtTime(0.7, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.32);
}
let lastHitSfx = 0;
function sfxHit(po) { const a = audio(); if (!a || a.currentTime - lastHitSfx < 0.25) return; lastHitSfx = a.currentTime; const t = a.currentTime, out = outNode(a, po.pan); outBusy(out, t + 0.12); out.gain.value = 0.25; const o = a.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.08); const og = a.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12); }
function breakCue(ev) {
  const po = panOf(ev), isPanel = ev.kind === 'panel';
  const dir = dirWord(po);
  flash((isPanel ? 'PANEL BROKEN ' : ev.kind.toUpperCase() + ' DESTROYED ') + dir + ' (' + Math.round(po.dist) + ' m)', true);
  sfxBreak(po, !isPanel);
  if (isPanel && ev.bp !== undefined) bpFlash[ev.bp] = 2.4;
  for (let i = 0; i < 12; i++) { const m = PR.splinter(ev.kind); m.position.set(ev.x, (ev.floor || 0) * FH + 0.9, ev.z); scene.add(m); debris.push({ m, y0: (ev.floor || 0) * FH + 0.06, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 4, t: 1.1 }); }
}

// ---- loop
let fx = null; const FXOFF = (() => { try { return new URLSearchParams(location.search).get('fx') === '0'; } catch (e) { return false; } })();
// (R4 worker 5, item 3) window.__noBodyShadow (perfcheck's control only): the body shadow off, to read the GPU passes without it
// OWNER DECISION Nov 19 23:24 (CONFIG.lag.marlaOwnLight): in play Marla's key SpotLight and rim light light only her. Her pieces and her two lights are moved to
// their own layer; the street is drawn without them (the same light set by day as at night, so one program per material), then marlaPass draws only her pieces
// with the scene's lights plus her two, over the same picture (no clear, no background, matrices already updated). The other lights get her layer too, the
// shadow cameras draw her as a caster as before, and only her key's shadow map is drawn in her pass (when the frame's shadow maps were). Base and film: as before.
const ML = { on: false, bit: CONFIG.lag.marlaOwnLight ? CONFIG.lag.marlaOwnLight.layer : 6, lights: [], keys: [], all: [], k: 0, n: -1, sh: false, fxSet: false, save: [] };
function marlaSync() {
  const C = CONFIG.lag.marlaOwnLight, want = !!(C && C.on && state === 'play' && marla && marla.ready && marla.root.parent);
  if (want !== ML.on) {
    if (want) { ML.lights.length = 0; marla.root.traverse((o) => { if (o.isLight) ML.lights.push(o); }); if (!ML.lights.length) return; }
    ML.on = want; const m = want ? 1 << ML.bit : 1;
    marla.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh || o.isLight || o.isSprite || o.isPoints || o.isLine) o.layers.mask = m; });
    for (const l of ML.lights) if (l.castShadow && l.shadow && l.shadow.camera) { if (want) { l.userData.mlMask = l.shadow.camera.layers.mask; l.shadow.camera.layers.mask = 1 | (1 << ML.bit); } else if (l.userData.mlMask !== undefined) l.shadow.camera.layers.mask = l.userData.mlMask; }
    ML.n = -1;
  }
  if (!ML.on) return;
  // the scene's other lights: listed again every C.lightsEvery frames or when the scene's top level changes; each sees her layer, each shadow camera draws her
  if (++ML.k >= C.lightsEvery || ML.n !== scene.children.length) { ML.k = 0; ML.n = scene.children.length; ML.all.length = 0; scene.traverse((o) => { if (o.isLight && !ML.lights.includes(o)) ML.all.push(o); }); }
  for (const l of ML.all) { l.layers.enable(ML.bit); if (l.castShadow && l.shadow && l.shadow.camera) { const L = l.shadow.camera.layers; if (!L.isEnabled(ML.bit)) { if (!(L.mask & ~1)) L.mask = cam.layers.mask; L.enable(ML.bit); } } }
}
// a piece of Marla (her pieces are drawn only in her own pass while her lights are split off)
function marlaHas(o) { for (let q = o; q; q = q.parent) if (q === marla.root) return true; return false; }
function marlaPass() {
  if (!ML.on) return;
  const r = renderer, ac = r.autoClear, ar = r.info.autoReset, bg = scene.background, mu = scene.matrixWorldAutoUpdate, cm = cam.layers.mask, sv = ML.save; sv.length = 0;
  for (const l of ML.all) if (l.castShadow && l.shadow) { sv.push(l, l.shadow.autoUpdate, l.shadow.needsUpdate); l.shadow.autoUpdate = false; l.shadow.needsUpdate = false; }
  r.autoClear = false; r.info.autoReset = false; scene.background = null; scene.matrixWorldAutoUpdate = false; cam.layers.set(ML.bit); r.shadowMap.needsUpdate = ML.sh;
  try { r.render(scene, cam); } finally { r.autoClear = ac; r.info.autoReset = ar; scene.background = bg; scene.matrixWorldAutoUpdate = mu; cam.layers.mask = cm; for (let i = 0; i < sv.length; i += 3) { sv[i].shadow.autoUpdate = sv[i + 1]; sv[i].shadow.needsUpdate = sv[i + 2]; } sv.length = 0; }
}
// her own programs under the loading card (the street's are built without her lights): only her pieces, with the scene's lights plus her two
function marlaCompile() { if (!ML.on || !renderer.compileAsync) return Promise.resolve(); const cm = cam.layers.mask; cam.layers.set(ML.bit); try { return renderer.compileAsync(marla.root, cam, scene).catch(() => {}); } finally { cam.layers.mask = cm; } }
function draw() { if (REC_NODRAW) return; pshadow.tick(cam, (state === 'base' || state === 'play') && !window.__noBodyShadow, pshadowFloor());if (FINE) { const bpe = $('bprompt'); if (bpe.textContent.startsWith('USE:')) bpe.textContent = 'E:' + bpe.textContent.slice(4); const can = (state === 'play' && !paused) || (state === 'base' && !ui && !paused); if (mouseHeld() && !can) freeMouse(); if (mouseHeld()) everHeld = true; $('mlook').style.display = can && !mouseHeld() && !mlookQuiet() ? 'block' : 'none'; } tickCentre(); if (Q.fx && !FXOFF && !fx) { try { fx = createFx(renderer, scene, cam, Q.fx, Q.pbr, hemi); fx.setSize(innerWidth, innerHeight); } catch (e) { console.warn('picture pass off', e); fx = { render: null }; } } if (holdDraw) return; fitFar(); if (QUALITY === 'high') lodTick(cam); marlaSync(); ML.sh = renderer.shadowMap.needsUpdate; if (fx && fx.render) { if (fx.setAfterMain && !ML.fxSet) { ML.fxSet = true; fx.setAfterMain(marlaPass, ML.bit); } fx.render(); } else { renderer.render(scene, cam); marlaPass(); } }
// the far plane follows the fog (CONFIG.lag.farPad): nothing past the fog's end is drawn; the sky dome (40 m) shrinks to stay inside the far plane
const FAR0 = cam.far; function fitFar() { const f = scene.fog && scene.fog.isFog ? Math.min(FAR0, scene.fog.far + CONFIG.lag.farPad) : FAR0; if (Math.abs(cam.far - f) > 0.25) { cam.far = f; cam.updateProjectionMatrix(); } sky.mesh.scale.setScalar(Math.min(1, (cam.far - 1) / 40)); }
// (owner 13:10, premortem J) a new size clears the canvas: a held picture (pause, run end) is drawn once again and the run-end blur taken again from it
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); if (fx && fx.setSize) fx.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); pauseDrawn = false; ENDS.re = true; }
addEventListener('resize', resize); resize();
// ---- LOADING CARDS (owner Nov 19 05:49; CONFIG.lag.card): at a scene change the card covers the screen while the heavy work is done, so play does not hitch.
// The game is held still meanwhile (frame() returns at once), so no rule or timer changes: the change itself (startRun, dusk, enterBase) has already happened as before.
// Work: wait for the night's Gloom models and the boss model (they load from startRun; capped at maxWait s), build every shader the scene uses (renderer.compileAsync;
// skipped in the scripted checks, whose software GPU builds them on the first frame as before), and draw the sun shadow map once on the first frame after.
cvs.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ctxLost = true; if (!paused && (state === 'play' || state === 'base')) { setPause(true); ctxPaused = true; } }, false);
// (owner 13:10, premortem C) after a restore three.js uploads every geometry, texture and shader again on its next use (pools, the kept base, the baked ground, merged
// meshes: their data stays in memory); what the game drew only once is drawn again: the held picture under a pause or run-end screen (pauseDrawn) and the
// shadow map; the run-end blur is taken again from the new picture
cvs.addEventListener('webglcontextrestored', () => { ctxLost = false; if (ctxPaused) { ctxPaused = false; if (paused) setPause(false); } renderer.shadowMap.needsUpdate = true; pauseDrawn = false; ENDS.re = true;
}, false);
// ---- PERF OVERLAY (owner Nov 19 05:55): ?perf=1 shows real frame rates on a real device in a corner: FPS, average and worst frame (ms) over the last ~2 s, draw calls and
// triangles per frame (every render of the frame summed), tier, pixel ratio and the automatic step-downs taken. Off (and costing nothing) without ?perf=1.
const PERFHUD = (() => { try { return new URLSearchParams(location.search).get('perf') === '1'; } catch (e) { return false; } })();
const PH = { el: null, t: 0, n: 0, sum: 0, worst: 0, calls: 0, tris: 0 };
if (PERFHUD) { renderer.info.autoReset = false; PH.el = document.createElement('div'); PH.el.id = 'perfhud'; PH.el.style.cssText = 'position:fixed;left:calc(4px + env(safe-area-inset-left));bottom:calc(4px + env(safe-area-inset-bottom));z-index:60;pointer-events:none;font:12px/1.35 ui-monospace,monospace;color:#fff;background:#000a;padding:4px 6px;border-radius:4px;white-space:pre'; document.body.appendChild(PH.el); }
function perfHud(ms) {
  if (!PERFHUD) return; const I = renderer.info.render; PH.calls = I.calls; PH.tris = I.triangles; renderer.info.reset(); PH.n++; PH.sum += ms; PH.worst = Math.max(PH.worst, ms); PH.t += ms;
  if (PH.t < 2000) return; const st = perf ? perf.state : { taken: [] }, avg = PH.sum / PH.n;
  PH.el.textContent = (1000 / avg).toFixed(0) + ' fps  avg ' + avg.toFixed(1) + ' ms  worst ' + PH.worst.toFixed(0) + ' ms\ncalls ' + PH.calls + '  tris ' + (PH.tris / 1e6).toFixed(2) + ' M\ntier ' + TIER + ' (' + QPICK.by + ')  ratio ' + renderer.getPixelRatio().toFixed(2) + '  steps ' + st.taken.length + (st.taken.length ? ' ' + st.taken.join(',') : '');
  window.__perfHud = { fps: 1000 / avg, avg, worst: PH.worst, calls: PH.calls, tris: PH.tris }; PH.t = 0; PH.n = 0; PH.sum = 0; PH.worst = 0; }
// ?cards=1: the scripted checks get the real card work too (tools/perfcheck.cjs on the real GPU), not the quick bot card
const CARDS_REAL = (() => { try { return new URLSearchParams(location.search).get('cards') === '1'; } catch (e) { return false; } })();
// (owner 13:10: warm-ups must be proven to have run) every render's draw calls are counted (RSTAT), so each card reports the renders, draw calls and new shader
// programs made under it (LCARD.proofs, last 12: kind, renders, calls, programs)
const RSTAT = { renders: 0, calls: 0 }; { const r0 = renderer.render.bind(renderer); renderer.render = (s2, c2) => { const I = renderer.info.render, b = renderer.info.autoReset ? 0 : I.calls; r0(s2, c2); RSTAT.renders++; RSTAT.calls += I.calls - b; }; }
const nProg = () => (renderer.info.programs ? renderer.info.programs.length : 0);
// (owner Nov 22, video opening) ?filmrec=1: tools/filmrender.cjs records the 3D film frame by frame at a fixed clock; the page's own loop then leaves the film
// alone and window.__game.filmRec(dt) runs one film frame (it draws); not a player path
let REC_NODRAW = false;
const FILMREC = (() => { try { return new URLSearchParams(location.search).get('filmrec') === '1'; } catch (e) { return false; } })();
const LCARD = { on: false, n: 0, proofs: [] }, BOTRUN = () => { if (CARDS_REAL) return false; try { return !!window.__dtMax || !!navigator.webdriver; } catch (e) { return false; } };
// (owner 13:10, the shader built during a fight) ?proglog=1 (perfcheck): every NEW shader program is logged with the material and the piece that asked for it
// (window.__progLog, first 300: time, game state, under a card or not, material type, name, colour and maps, the piece and its owners up the tree, its userData keys);
// a program built by compile() (no piece) shows as '(compile)'. Off, and costing nothing, without the flag.
const PROGLOG = (() => { try { return new URLSearchParams(location.search).get('proglog') === '1'; } catch (e) { return false; } })();
// (owner 13:10, item 7: the drill's and the fight's long frames) ?proglog=1: a frame that starts more than CONFIG.lag.longFrame ms after the one before is logged with
// what the frame before it did: its JS time per part (logic, draw, hands), its draw calls, the programs built and shader look-ups redone in it; the rest of the gap
// is outside the page's JS (GPU, compositor, garbage collection). window.__longFrames, the last 400.
const LF = { s: 0, prev: 0, m: { logic: 0, draw: 0, hands: 0 }, last: null, p0: 0, w0: 0, d0: 0, u0: 0, um0: 0, b0: 0, bm0: 0, list: [] };
// (R3, the draws that stall with no shader built: Enter 7.4 s "texSubImage2D < uploadTexture < setTexture2D", the drill's and the house's long draws) every
// texture upload and buffer upload to the GPU is counted with its time (UPL: n, ms; buffers bn, bms), for the catcher entries and the cards' proofs
const UPL = { n: 0, ms: 0, bn: 0, bms: 0, big: [] };
{ const gl = renderer.getContext(), wrap = (k, b) => { const f = gl[k]; if (typeof f !== 'function') return; gl[k] = function (...a) { const t = performance.now(); try { return f.apply(gl, a); } finally { const d = performance.now() - t; if (b) { UPL.bn++; UPL.bms += d; } else { UPL.n++; UPL.ms += d; if (d > 20 && UPL.big.length < 60) { const src = a[a.length - 1], w = src && (src.width || src.videoWidth), h = src && (src.height || src.videoHeight); UPL.big.push([Math.round(d), k, (src && src.constructor && src.constructor.name) || '?', (w || '?') + 'x' + (h || '?'), state, LCARD.on ? 1 : 0, ((src && src.src) || '').split('/').pop().slice(0, 40)]); } } } }; };
  for (const k of ['texImage2D', 'texSubImage2D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'texImage3D', 'texSubImage3D', 'generateMipmap']) wrap(k, false); for (const k of ['bufferData', 'bufferSubData']) wrap(k, true); }
// (owner 14:25, the warm-up gate) shader programs made while you play (base, street, night, film shown; not under a card, the film's black or at the title), counted every
// frame from three.js's own list: window.__game.playPrograms() -> { n, at: [[state, page ms, count]] }; must stay 0
const PLAYP = { last: -1, n: 0, at: [], old: 0, k0: undefined };
// (R4 worker 5, item 1) KEEP BUILT PROGRAMS: three.js frees a shader program when the last material using it is freed (a run's street at the run's end, the base when
// you ride out), and the next card builds the same program again: plain 44512310503 medium, programs per card: ride 172 then 78, 76, 76; home 8 then 15, 17, 17,
// while the count at the end of each night card stayed at 389-398. Each program now gets one extra use when it is made, so it is never freed: a program is built
// once a visit (REMOVED: the rebuilds). Bounded by the distinct shader keys the game has (CONFIG.lag.keepPrograms.max, then programs are freed as before).
{ const K = CONFIG.lag.keepPrograms, PA = renderer.info.programs, push1 = PA.push; let kept = 0;
  if (K && K.on) PA.push = function (...a) { for (const pr of a) if (pr && kept < K.max) { pr.usedTimes++; kept++; } return push1.apply(this, a); };
  window.__game_kept = () => kept; }
// (R4 worker 6, A.2: programs in play 0 in 44512310503 -> 11 medium / 7 high in c120c3b, all at 'base' after the film skip) the gate counted the GROWTH of three.js's
// program list; before Card 32 the programs freed at the skip (releaseProgram) hid the ones built there. It now counts every program BUILT outside a card / the film's
// black / the title, at the moment it is built (each push into the list)
// (?proglog=1 only) how a new program's key differs from the closest earlier program of the same kind: 'field index:old>new' (the fields of three's cache key)
function progDiff(pr) { try { const a = String(pr.cacheKey).split(','); let best = null, bn = 1e9; for (const q of renderer.info.programs) { if (!q || q === pr || q.name !== pr.name) continue; const b = String(q.cacheKey).split(','); let n = Math.abs(a.length - b.length); const d = []; for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) { n++; if (d.length < 8) d.push(i + ':' + b[i].slice(0, 24) + '>' + a[i].slice(0, 24)); } if (n < bn) { bn = n; best = d; } } return 'key differs from the closest by ' + bn + ': ' + (best || []).join(' ') + ' | key ' + a.join(',').slice(0, 520) + ' | depth programs now ' + renderer.info.programs.filter((q) => q && q.name === pr.name).map((q) => { const b = String(q.cacheKey).split(','); return b.slice(7, 9).join('/') + ':' + b.slice(-28, -1).join('.'); }).slice(-40).join(' ; ').slice(0, 2600); } catch (e) { return 'no key'; } }
const playHeld = () => LCARD.on || !!FILM.it || !!(intro && intro.hold) || state === 'menu' || state === 'end';
{ const PA = renderer.info.programs, push2 = PA.push; PA.push = function (...a) { if (NBG.inSlice) NBG.built += a.length; if (PLAYP.last >= 0 && !playHeld()) { PLAYP.n += a.length; if (PLAYP.at.length < 30) PLAYP.at.push([state, Math.round(performance.now()), a.length, PROGLOG ? (window.__progLog || []).slice(-1).map((q) => q.mat + ' @ ' + q.owner + ' {' + q.geo + (q.tgt ? ' target' : '') + '}').concat(a[0] ? [progDiff(a[0])] : []) : null]); } return push2.apply(this, a); }; }
// (lead 21:15) the old count (the list's growth outside the held times) is kept beside it as PLAYP.old, printed next to the new one
function playProgs() { const k = nProg(); if (PLAYP.k0 !== undefined && k > PLAYP.k0 && !playHeld()) PLAYP.old += k - PLAYP.k0; PLAYP.k0 = k; PLAYP.last = 0; }
// (R3) the run-end screen's frames (Card 8, accepted: the runner's pacing) are not kept: 214 of them pushed the film's entries out of the 400-entry ring
// (R4 worker 5, items 2 and 4) GLS: the slowest single WebGL call between two frame starts (name, ms, the material being drawn), timed only while a card or the
// film's black holds the picture or for CONFIG.lag.glSlowAfter s after a card (?proglog=1 pages); a long frame's entry carries it as glw
const GLS = { on: false, worst: 0, name: '', mat: '', till: 0 };
function lfStart(now) { if (!PROGLOG) return; const gap = now - LF.prev; if (LF.prev && gap > CONFIG.lag.longFrame && LF.last && state !== 'end') { if (LF.list.length >= 400) LF.list.shift(); LF.list.push({ t: Math.round(now), gap: Math.round(gap), state, ...LF.last, glw: GLS.name ? [GLS.name, Math.round(GLS.worst), GLS.mat] : null }); window.__longFrames = LF.list; }
  { const held = LCARD.on || !!FILM.it || !!(intro && intro.hold); if (held) GLS.till = now + CONFIG.lag.glSlowAfter * 1000; GLS.on = held || now < GLS.till || now < (window.__glsTill || 0); GLS.worst = 0; GLS.name = ''; GLS.mat = ''; }
  LF.prev = now; LF.s = performance.now(); LF.k = LF.s; LF.m.logic = LF.m.draw = LF.m.hands = 0; LF.p0 = PN.prog; LF.fd0 = PN.fd; LF.w0 = PN.why; LF.d0 = PN.draws; LF.u0 = UPL.n; LF.um0 = UPL.ms; LF.b0 = UPL.bn; LF.bm0 = UPL.bms; LF.last = null; }
function lfMark(k) { if (!PROGLOG) return; const n = performance.now(); LF.m[k] += n - LF.k; LF.k = n; }
// (R3, boss vs hub) ?proglog=1: the frames' CPU cost summed for window.__game.frameCost(): JS per part, and inside the draw the shadow maps and the matrix pass
const FC = { n: 0, js: 0, logic: 0, draw: 0, hands: 0, shadow: 0, matrix: 0, calls: 0 };
function lfEnd() { if (!PROGLOG) return; LF.last = { js: Math.round(performance.now() - LF.s), logic: Math.round(LF.m.logic), draw: Math.round(LF.m.draw), hands: Math.round(LF.m.hands), draws: PN.draws - LF.d0, progs: PN.prog - LF.p0, fd: PN.fd - LF.fd0, whys: PN.why - LF.w0, up: UPL.n - LF.u0, upMs: Math.round(UPL.ms - LF.um0), buf: UPL.bn - LF.b0, bufMs: Math.round(UPL.bms - LF.bm0), film: FILM.it ? 'prep' : (FILM.step || '') };  FC.n++; FC.js += performance.now() - LF.s; FC.logic += LF.m.logic; FC.draw += LF.m.draw; FC.hands += LF.m.hands; }
const PN = { prog: 0, why: 0, draws: 0, fd: 0 };
if (PROGLOG) { const PL = window.__progLog = [], cur = { m: null, o: null }, rbd = renderer.renderBufferDirect;
  // (owner 13:10, the drill's and the fight's first long frames) also why a material's shader is looked up again (getParameters) without a new program: the scene's
  // light set changed (every lit material then redoes it; logged once per change, with the lights shown) or the material itself changed (needsUpdate); window.__progWhy
  const PW = window.__progWhy = [], WHY = { lv: -1 }, ownOf = (o) => { const own = []; for (let q = o; q && own.length < 7; q = q.parent) own.push((q.name || q.type) + (q.userData && q.userData.kind ? '[' + q.userData.kind + ']' : '')); return own.join(' < '); };
  const lightSig = () => { const c = {}; scene.traverseVisible((q) => { if (q.isLight) { const k = q.type + (q.castShadow ? '+shadow' : ''); c[k] = (c[k] || 0) + 1; } }); return JSON.stringify(c); };
  // (H round 2: the 300-entry lists were full before the fight) the lists keep the LATEST 300; window.__progAgg counts every event by kind, material and piece
  // (a material whose program switches between draws, 'switch', is counted with the two program names), reset with __progAggReset
  const AGG = window.__progAgg = new Map(); window.__progAggReset = () => AGG.clear(); const agg = (k) => AGG.set(k, (AGG.get(k) || 0) + 1);
  const why = (k, m, o, extra) => { agg(k + ' | ' + m.type + (m.name ? ' ' + m.name : '') + (m.color ? ' #' + m.color.getHexString() : '') + ' | ' + ownOf(o).split(' < ').slice(0, 3).join(' < ') + (extra ? ' | ' + extra : '')); if (k === 'switch') return; if (PW.length >= 300) PW.shift(); PW.push({ t: Math.round(performance.now()), state, card: LCARD.on, why: k, mat: m.type + (m.name ? ' ' + m.name : '') + (m.color ? ' #' + m.color.getHexString() : ''), owner: ownOf(o), lights: k === 'lights' ? lightSig() : '' }); };
  // (R4 worker 6, advisor item 1) FIRST-DRAW LEDGER: every draw state never drawn before (program id x vertex layout x render target format x blend), counted when it
  // is first drawn: window.__fd = { n, list (last 600: page ms, state, card id or 0, key, material @ piece) }; the long-frame catcher entry carries the count (fd)
  const FD = window.__fd = { n: 0, seen: new Set(), list: [] }, gsig = new WeakMap(), tsig = (t) => (!t ? 'screen' : (t.isWebGLCubeRenderTarget ? 'cube' : '') + (t.samples || 0) + 's' + (t.texture && (t.texture.type + ':' + t.texture.format)) + (t.depthBuffer ? 'd' : '') + (t.stencilBuffer ? 's' : '') + (t.depthTexture ? 'T' : ''));
  const layout = (g, o) => { let k = gsig.get(g); if (!k) { k = Object.keys(g.attributes).sort().map((n) => { const a = g.attributes[n], ar = a.isInterleavedBufferAttribute ? a.data.array : a.array; return n + a.itemSize + (ar && ar.constructor.name.slice(0, 3)) + (a.normalized ? 'n' : '') + (a.isInterleavedBufferAttribute ? 'i' + a.data.stride : ''); }).join(','); gsig.set(g, k); } return k + (o.isInstancedMesh ? '+inst' : ''); };
  // (?fdtime=1, probe pages only) every draw waits for the GPU before it starts, and a NEW draw state also after it, so each first-draw entry carries its own ms (entry [5])
  const FDT = (() => { try { return new URLSearchParams(location.search).get('fdtime') === '1'; } catch (e) { return false; } })(), fgl = renderer.getContext(); let fdt0 = 0;
  // (?fdtime=1) every draw's GPU-waited ms summed by what was new in it: 'state' (a first-draw state), 'tex' (a picture never drawn before), 'geo' (a shape never drawn
  // before), 'known' (nothing new), 'pre' (the GPU work queued before a draw started: shape uploads and the like); per card id (0 = not under a card): window.__fdc
  const FDC = window.__fdc = {}, fdGeo = new WeakSet(), fdTex = new WeakSet(), TEXK = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'lightMap', 'bumpMap', 'envMap', 'clearcoatNormalMap', 'specularIntensityMap', 'sheenColorMap', 'transmissionMap', 'thicknessMap'];
  const fdcAdd = (card, k, ms) => { const c = FDC[card] || (FDC[card] = { state: [0, 0], tex: [0, 0], geo: [0, 0], known: [0, 0], pre: [0, 0] }); c[k][0]++; c[k][1] += ms; };
  renderer.renderBufferDirect = function (c2, s2, g2, m2, o2, gr) { cur.m = m2; cur.o = o2; const mp = renderer.properties.get(m2), lv = mp.lightsStateVersion, mv = mp.__version, cp = mp.currentProgram;
    if (FDT) { const tp = performance.now(); fgl.finish(); fdt0 = performance.now(); fdcAdd(LCARD.on ? LCARD.n : 0, 'pre', fdt0 - tp); }
    try { return rbd.call(this, c2, s2, g2, m2, o2, gr); } finally { cur.m = null; cur.o = null; PN.draws++; const fdN0 = FD.n;
      { const pr = mp.currentProgram; if (pr) { const k = pr.id + '|' + layout(g2, o2) + '|' + tsig(renderer.getRenderTarget()) + '|' + (m2.transparent ? m2.blending : 0) + (m2.colorWrite === false ? 'nc' : ''); if (!FD.seen.has(k)) { FD.seen.add(k); FD.n++; PN.fd++; if (FD.list.length >= 600) FD.list.shift(); FD.list.push([Math.round(performance.now()), state, LCARD.on ? LCARD.n : 0, k, m2.type + (m2.name ? ' ' + m2.name : '') + ' @ ' + (o2.name || o2.type) + (o2.parent ? ' < ' + (o2.parent.name || o2.parent.type) : ''), FDT ? (fgl.finish(), Math.round(performance.now() - fdt0)) : 0]); } } }
      if (FDT) { fgl.finish(); const ms = performance.now() - fdt0, card = LCARD.on ? LCARD.n : 0; let k = FD.n > fdN0 ? 'state' : 'known'; const tx = []; for (const n of TEXK) { const t = m2[n]; if (t && t.isTexture) tx.push(t); } if (m2.uniforms) for (const u in m2.uniforms) { const v = m2.uniforms[u] && m2.uniforms[u].value; if (v && v.isTexture) tx.push(v); }
        if (k === 'known') { if (tx.some((t) => !fdTex.has(t.source || t))) k = 'tex'; else if (!fdGeo.has(g2)) k = 'geo'; } for (const t of tx) fdTex.add(t.source || t); fdGeo.add(g2); fdcAdd(card, k, ms); }
      if (lv !== undefined && mp.lightsStateVersion !== lv) { PN.why++; if (WHY.lv !== mp.lightsStateVersion) { WHY.lv = mp.lightsStateVersion; why('lights', m2, o2); } } else if (mv !== undefined && mp.__version !== mv) { PN.why++; why('version', m2, o2); }
      else if (cp && mp.currentProgram !== cp) { PN.why++; why('switch', m2, o2, (cp.name || cp.id) + ' -> ' + (mp.currentProgram && (mp.currentProgram.name || mp.currentProgram.id)) + (o2.isInstancedMesh ? ' instanced' : '') + (o2.isSkinnedMesh ? ' skinned' : '') + (renderer.getRenderTarget() ? ' target' : '')); } } };
  { const sr = renderer.shadowMap.render; renderer.shadowMap.render = function (...a) { const t = performance.now(); try { return sr.apply(this, a); } finally { FC.shadow += performance.now() - t; } };
    const um = scene.updateMatrixWorld; scene.updateMatrixWorld = function (...a) { const t = performance.now(); try { return um.apply(this, a); } finally { FC.matrix += performance.now() - t; } }; }
  // (R4 worker 5, items 2 and 4) every WebGL call timed while GLS.on (see lfStart): the slowest one between two frame starts is kept
  { const gl = renderer.getContext(), P0 = Object.getPrototypeOf(gl); for (const k of Object.getOwnPropertyNames(P0)) { let f; try { f = gl[k]; } catch (e) { continue; } if (typeof f !== 'function' || k === 'constructor') continue;
    gl[k] = function (...a) { if (!GLS.on) return f.apply(gl, a); const t = performance.now(); try { return f.apply(gl, a); } finally { const d = performance.now() - t; if (d > GLS.worst) { GLS.worst = d; GLS.name = k; const m = cur.m; GLS.mat = m ? m.type + (m.name ? ' ' + m.name : '') + (cur.o ? ' @ ' + (cur.o.name || cur.o.type) : '') + (renderer.getRenderTarget() ? ' target' : '') : ''; } } }; } }
  const PP = renderer.info.programs, push0 = PP.push;
  PP.push = function (...a) { PN.prog++; if (PL.length >= 300) PL.shift(); { const m = cur.m, o = cur.o, own = []; for (let q = o; q && own.length < 7; q = q.parent) own.push((q.name || q.type) + (q.userData && q.userData.kind ? '[' + q.userData.kind + ']' : ''));
      PL.push({ t: Math.round(performance.now()), state, card: LCARD.on, id: a[0] && a[0].id, name: a[0] && a[0].name, mat: m ? m.type + (m.name ? ' ' + m.name : '') + (m.color ? ' #' + m.color.getHexString() : '') + (m.map ? ' map' : '') + (m.transparent ? ' transparent' : '') + (m.vertexColors ? ' vcol' : '') + (m.side ? ' side' + m.side : '') + (m.map ? ' [' + (m.map.name || (m.map.image && (m.map.image.src || '').split('/').pop().slice(0, 30)) || (m.map.image ? m.map.image.width + 'x' + m.map.image.height : '')) + ']' : '') : '(compile)', owner: own.join(' < '), ud: o ? Object.keys(o.userData || {}).slice(0, 8).join(',') : '', geo: o && o.geometry ? Object.keys(o.geometry.attributes).join('+') + (o.isInstancedMesh ? ' inst' : '') + (o.isSkinnedMesh ? ' skin' : '') + (o.isBatchedMesh ? ' batch' : '') : '', tgt: !!renderer.getRenderTarget(), key: a[0] && a[0].cacheKey ? String(a[0].cacheKey).replace(/,+/g, ',').slice(0, 400) : '', shadow: !!(m && (m.isMeshDepthMaterial || m.isMeshDistanceMaterial)) }); }
    return push0.apply(this, a); }; }
// the scripted checks (a webdriver browser, not ?cards=1) fetch every Gloom model at page start as before the lag fix, so a check that starts a night at once meets the
// models, not their stand-ins, and the night card does not hold its frames waiting for them (players and ?cards=1 runs load them per run)
if (BOTRUN()) gloomPreload();
// warm-up copies for the night card: one machine of every kind the ring can send and one of every device you carry, built and drawn into the shader cache under the card,
// then kept hidden until the run ends (a disposed material would free its shader program), so the first machine of a kind or the first device placed does not stall a frame
// one plain single-sided piece with a picture that casts a shadow (a machine's lit display is the only such piece in play), for the warm-up sets
// (Mac PROFILE 44675546859 and a local list of the shadow shaders: the pictured plain one existed under the street's light counts and not under the counts Marla's
// pass leaves) three r187 picks a shadow pass's shader again only when a piece differs from the one before in instancing, skinning and the like, NOT in having a
// picture: a pictured plain piece gets its own shader only when it follows such a piece. So an instanced piece is drawn just before it: the pair, in this order
function warmCaster() { const g = new THREE.Group(), geo = new THREE.PlaneGeometry(0.1, 0.1), im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x808080 }), 1), dc = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: lorePaperTex() }));
  im.setMatrixAt(0, new THREE.Matrix4()); im.castShadow = true; dc.castShadow = true; g.add(im, dc); g.position.set(0, -50, 0); if (fx && fx.upgradeOne) fx.upgradeOne(g); return g; }
function dropWarm() { for (const c of [...warmG.children]) { warmG.remove(c); drop(c); } scene.remove(warmG); warmG.userData.day = false; }
// (owner 11:40) the night card keeps the ride card's set when it is for the same run and the same devices (warmKey), instead of building it again
const warmKey = () => (run ? run.seed + '|' + run.ring + '|' + slotKinds().join(',') : '');
function warmNight() { if (warmG.children.length && warmG.userData.run === run && warmG.userData.key === warmKey()) { warmG.visible = true; warmG.matrixWorldAutoUpdate = true; scene.add(warmG); return; }
  dropWarm(); if (!run) return; warmG.userData.run = run; warmG.userData.key = warmKey(); const K = CONFIG.gloom.kinds, ring = run.ring || 0;
  // (owner 13:10, a new Gloom's merge at its spawn: 204 ms) CONFIG.lag.gloomPrefill machines of each kind are built AND merged here, under the card (one probe pass each,
  // as mergeQ does at a spawn); after the card's draws they start the pool (gloomTake reuses them merged), so a spawn takes a ready machine
  for (const k of Object.keys(K)) if ((K[k].minRing || 0) <= ring && K[k].share > 0) for (let i = 0; i < Math.max(1, CONFIG.lag.gloomPrefill || 1); i++) { const m = gloomMesh({ kind: k, hp: 1, maxhp: 1 }); gloomBlob(m, k); m.position.set(0, -50, 0);
    if (CONFIG.lag.gloomPrefill && m.userData.anim && !m.userData.merged) { const pr = (j) => m.userData.anim(-(1 + j * 0.73), { x: j * 0.11, z: j * 0.07 }); mergeStatic(m, pr); freezeStillBones(m, pr, CONFIG.lag.mergeGloom.probes); m.userData.merged = true; HITC.delete(m); } warmG.add(m); }
  // (R4 worker 11, Mac afa1ffc 44571930050: 3 programs built at each fight start; ledger names: Gloom worn.jpg DoubleSide and gloom_lens DoubleSide on pieces not
  // yet merged, breach marks black additive DoubleSide) CONFIG.lag.warmFresh: one machine of each kind as a spawn builds it when the pool is empty (not merged; it
  // joins the pool after the card and is merged when taken) and one breach mark (same material and geometry as buildBreaches), drawn under the card
  if (CONFIG.lag.warmFresh) { for (const k of Object.keys(K)) if ((K[k].minRing || 0) <= ring && K[k].share > 0) { const m = gloomMesh({ kind: k, hp: 1, maxhp: 1 }); gloomBlob(m, k); m.position.set(0, -50, 0); warmG.add(m); }
    const hw = CONFIG.openingHalf, bm = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw, 2.6), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); bm.position.set(0, -50, 0); warmG.add(bm); }
  for (const k of new Set(slotKinds())) { const m = deviceMesh(k); m.position.set(0, -50, 0); warmG.add(m); }
  // the shot, its splash, a kill's smoke and a broken device's splinters (their shaders), and the scrap pieces' physics file (desktop)
  for (const c of [0x7fd8ff, 0x9fd8ff, 0x9fffa0, 0xd0a0ff, 0xffe08a]) { warmG.add(PR.jet(new THREE.Vector3(0, -50, 0), new THREE.Vector3(1, -50, 0), c)); warmG.add(PR.droplet(c)); }
  warmG.add(PR.smoke()); warmG.add(PR.splinter('panel')); warmG.add(PR.splinter('lance')); physicsPreload();
  // (Nov 20, PROFILE 44671232007: the display's shadow shader was still built at the first night's start, its key one field from the closest: no picture -> picture)
  // the night's set is built anew here (dropWarm above), so it gets the plain pictured shadow caster too, under the night's own light counts
  warmG.add(warmCaster());
  warmG.visible = true; warmG.matrixWorldAutoUpdate = true; scene.add(warmG); }
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
// (R4 items B/C, card 27) SPREAD by GPU time: work under the film's black and the cards is sent in parts, and each part waits until the GPU has done the one
// before it (a fence, gl.fenceSync, read once a frame without blocking: getSyncParameter), instead of queueing every part and then gl.finish(); the queue was what
// one held frame waited on (diagnose 6, Enter trace: "3345 ms CALayerTreeCoordinator::ApplyBackpressure" with "3333 ms CommandBufferHelper::WaitForAvailableEntries").
// gpuDone(cap) resolves with the ms the GPU took (at most cap ms waited); GPUQ: waits, their ms, the longest (perfcheck prints it with the card proofs)
const GPUQ = { waits: 0, ms: 0, worst: 0 };
function gpuDone(cap) { const gl = renderer.getContext(); let f = null; try { if (gl.fenceSync) { f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } } catch (e) { f = null; } if (!f) return Promise.resolve(0);
  const t0 = performance.now(); return new Promise((res) => { const poll = () => { let ok = true; try { ok = gl.isContextLost() || gl.getSyncParameter(f, gl.SYNC_STATUS) === gl.SIGNALED; } catch (e) { ok = true; } const ms = performance.now() - t0;
    if (ok || ms > cap) { try { gl.deleteSync(f); } catch (e) { /* lost */ } GPUQ.waits++; GPUQ.ms += ms; GPUQ.worst = Math.max(GPUQ.worst, ms); res(ms); } else requestAnimationFrame(poll); }; requestAnimationFrame(poll); }); }
async function sceneCard(kind) {
  const L = CONFIG.lag.card; if (!L || !L.on || LCARD.on) return; const id = ++LCARD.n, t0 = performance.now(), bot = BOTRUN(), fill = (k) => { $('lfill').style.width = Math.round(k * 100) + '%'; };
  // (owner 12:35) the card's time per step (LCARD.steps: [step, ms]), for perfcheck
  let tm = performance.now(); const mark = (k) => { const n = performance.now(); LCARD.steps.push([k, Math.round(n - tm)]); tm = n; }; LCARD.steps = []; LCARD.allParts = null; LCARD.lampCounts = null; LCARD.kind = kind;
  // (R4 worker 6, Card 40: drill 157-269 ms at 7.8-8.1 s; PROFILE 44532874070: 226 ms 'RendererRasterWorker' in the GPU process at 8.07 s, the only page writes then
  // #cross class x-gloom and #aim) the crosshair's Gloom state (two drop-shadow filters) is drawn the first time under the card, not in play: shown for the card's
  // frames under the opaque card, put back at its end
  const crW = $('cross'), crS = crW.getAttribute('style'), crK = crossK; if (CONFIG.lag.crossWarm) { crW.classList.add('x-gloom'); crW.style.setProperty('visibility', 'visible', 'important'); crW.style.setProperty('display', 'block', 'important'); }
  // (Nov 20, cause proven: PROFILE low 44664585924 'fight start trace': the frames of 137-286 ms in a fight's first 2 s are the page's own drawing of the interface
  // (GPU process: RendererRasterWorker DoEndRasterCHROMIUM 209 / 395 ms with a pipeline being built, the game's GL calls waiting on it), at the moments Marla's
  // line, the threat arc, the aim label and the crosshair's Gloom state first show (local write log: 0.1, 0.3, 1.5 s). Showing them under the card did nothing: a
  // browser does not draw what an opaque element covers.) CONFIG.lag.hudWarm: for the card's time the interface sits ABOVE the card at opacity 0.002 (no pixel of
  // the card changes: under half a colour step) with those states shown, so their first drawing is done here; everything is put back at the card's end
  // (Mac low 44667717773, what the page painted before each long raster: #arc 'Added to layout' at 0.357 s -> raster 293 ms; #arc's turn changed at 0.712 s -> raster
  // 336 ms: the first warm-up had not drawn it, and every turn of the arc drew it again with its two shadow filters.) The interface's fade is the browser's own
  // layer for the card's time (will-change: opacity), so its pieces are drawn in full and only shown at 0.002; and the arc is a layer of its own (index.template.html
  // #arc will-change: transform), drawn once and turned by the browser, not drawn again at every turn
  // (Mac low 44668711691 against 44666613327, same job's hub as the control: with the arc's shadow filters on the layer itself the browser applied them every frame,
  // fight 130.7 -> 78.9 fps.) The arc's stroke and its filters are on #arc::before, inside the layer: drawn once into it, no filter at draw time
  const hudW = []; if (CONFIG.lag.hudWarm) { const add = (k, o) => { const e = $(k); if (!e) return; const r = { e, st: e.getAttribute('style'), on: e.classList.contains('on'), ph: null }; hudW.push(r); if (o.on) e.classList.add('on');
      e.style.setProperty('visibility', 'visible', 'important'); e.style.setProperty('display', 'block', 'important'); if (o.up) { e.style.setProperty('z-index', '41', 'important'); e.style.setProperty('opacity', '0.002', 'important'); e.style.setProperty('will-change', 'opacity', 'important'); }
      if (o.text && !e.textContent) { r.ph = document.createElement('span'); r.ph.textContent = 'Warm-up line 0'; e.appendChild(r.ph); } };
    add('hud', { up: 1 }); add('arc', { on: 1 }); add('darrow', { on: 1, up: 1 }); for (const k of ['marla', 'aim', 'msg']) add(k, { text: 1 }); }
  // (H, owner 13:04: the home card's draws were no-ops: draw() returns while holdDraw is set, and the held title menu left it set) the card's own draws always draw
  holdDraw = false; pauseDrawn = false; const pf0 = [RSTAT.renders, RSTAT.calls, nProg(), UPL.n, UPL.ms, UPL.bn, UPL.bms, GPUQ.waits, GPUQ.ms]; GPUQ.worst = 0;
  LCARD.on = true; $('lct').textContent = L.titles[kind] || ''; if (kind === 'night') for (const l of glights) l.visible = true; else if (kind === 'ride') for (const l of glights) l.visible = false; fill(0.1); $('lcard').style.display = 'flex';
  try {
    // the night's models are waited for under the NIGHT card only: the ride card shows the day street, which does not need them (they keep loading behind it).
    // (Waiting on the ride card held the street hidden for up to maxWait s in the checks: playershadowcheck_desktop saw the card, not the street.)
    // (Nov 19 09:00) For a player the RIDE card waits for them too and builds the night's shaders already (below), so the night card stays short.
    if (QUALITY === 'high' && (kind === 'night' || (kind === 'ride' && !bot))) { const G = window.__gloomGlb || {}, B = window.__boss || {}; for (let t = 0; t < L.maxWait * 10; t++) { if (Object.values(G).every((v) => v !== 'loading') && B.model !== 'loading') break; await nap(100); } }
    // (R3) the sharp textures are no longer all asked for with the page (src/quality.js askHi): the ride and night cards ask for the rest, and every card waits for
    // those still on the way (as for the models), so nothing is shown with its soft picture first
    if (kind !== 'home') askAllHi(); if (!bot) { for (let t = 0; t < L.maxWait * 10 && hiPending() > 0; t++) await nap(100); }
    if (world && world.nightTufts) world.nightTufts(kind === 'night'); // OWNER DECISION 12:35: the night's lighter tufts, swapped in under the night card
    // (premortem D) a light step-down that waited for a card is taken here, before the shaders are built
    if (perf && perf.flush) perf.flush();
    if (kind === 'night') warmNight(); else dropWarm(); if (fx && fx.upgradeNow) fx.upgradeNow();
    // one material copy per kind of piece that draws it (src/mergestatic.js splitVariants), before the shaders are built
    if (CONFIG.lag.splitVariants) splitVariants(scene);
    // (H round 2) flat see-through two-sided pieces drawn in one pass, same pixels (src/mergestatic.js singlePassFlat); LCARD.twoPass: what is left in two passes
    if (CONFIG.lag.singlePassFlat && CONFIG.lag.singlePassFlat.on) { const gN = twoPassGroups(scene); LCARD.twoPass = singlePassFlat(scene, !CONFIG.lag.singlePassFlat.flat); LCARD.twoPass.groups = gN; }
    // the impact sounds' variants are rendered ahead (src/impactsfx.js impactPrerender): started by the ride card and left to finish during the day; the night card
    // waits a moment (CONFIG.lag.card.sfxWait s) if they are not done yet; until they are, a sound is built live as before
    if (!bot && kind === 'ride') IMP.prerender(); else if (!bot && kind === 'night') await Promise.race([IMP.prerender(), nap(L.sfxWait * 1000)]);
    // (R4 worker 8, lead 00:12 item a) the compile step's two waits timed apart: LCARD.cw = [street sync part, street ready, Marla sync part, Marla ready] (ms from the
    // step's start), in the card's proof as cw
    mark('prepare'); fill(0.6); marlaSync(); LCARD.cw = null; if (!bot && renderer.compileAsync) { const cw = LCARD.cw = [0, -1, 0, -1], tw = performance.now(), dt = () => Math.round(performance.now() - tw);
      const pS = renderer.compileAsync(scene, cam).then(() => { cw[1] = dt(); }); cw[0] = dt(); const pM = marlaCompile().then(() => { cw[3] = dt(); }); cw[2] = dt();
      await Promise.race([Promise.all([pS, pM]), nap(L.maxWait * 1000)]); } mark('compile');
    // the ride card also builds the NIGHT's shaders: the night's machine lights on (every lit shader is built per light count), one machine of each kind and each device
    // in the scene, then all put back as they were. The night card then finds them built (the first night card took 6.8 s on the test GPU, the next ones 0.5 s).
    // A house adds one ceiling lamp per floor (buildRoom), so the night's light count also depends on the house: stand-in lamps for each floor count among this ring's
    // houses are put in the scene in turn while the shaders are built, then removed.
    if (!bot && kind === 'ride' && run && renderer.compileAsync && glights.length) { for (const l of glights) l.visible = true; warmNight(); if (fx && fx.upgradeNow) fx.upgradeNow();
      // the night has no spot lights (Marla's and the people's key lights belong to the day street), so they are off while the night's shaders are built
      // every other point light of the day street is off too, and the house lamps are stood in for 0, 1, ... up to the most floors any house here has
      // (R4, first ride card 58.5 / 72.4 s: 404 / 471 programs, one set per lamp count 0..most) only the lamp counts this run's houses have (one per floor) are
      // built (LCARD.lampCounts); the night is spent inside a house, so a count no house has is never drawn
      // (R4 worker 5, item 1) Marla is off the scene too (the night is spent in a house, which she never enters: enterHouse removes her), so her ~15 materials are
      // not built a second time with the night's lights (local probe, first ride card medium: 195 programs, her night copies never drawn)
      const mpN = CONFIG.lag.nightNoMarla ? marla.root.parent : null; if (mpN) mpN.remove(marla.root);
      const most = Math.max(1, ...run.houses.map((h) => h.L || 1)), lamps = HL_ON ? [0] : CONFIG.lag.lampsUsed ? [...new Set(run.houses.map((h) => h.L || 1))].sort((a, b) => a - b) : [...Array(most + 1).keys()], tmp = []; LCARD.lampCounts = lamps.slice(); const spots = [];
      scene.traverse((o) => { if ((o.isSpotLight || (o.isPointLight && !glights.includes(o))) && o.visible) { o.visible = false; spots.push(o); } });
      // (R4 worker 6, first ride card 23.3 s, night shaders 2445 ms in 44530215200; KHR_parallel_shader_compile present) with CONFIG.lag.nightBg the night set is
      // built on the day street in the background instead (nightBgSlice: SPREAD), the card only queues it
      const NB = CONFIG.lag.nightBg && CONFIG.lag.nightBg.on && KHR_PAR; if (NB) nightBgStart(lamps);
      try { if (!NB) for (const n of lamps) { while (tmp.length > n) { const lp = tmp.pop(); scene.remove(lp); lp.dispose(); } while (tmp.length < n) { const lp = new THREE.PointLight(0xffe0a0, CONFIG.world.lamp, 6); lp.position.set(0, -40, 0); scene.add(lp); tmp.push(lp); }
          fill(0.7 + 0.2 * tmp.length / most); await Promise.race([renderer.compileAsync(scene, cam), nap(L.maxWait * 1000)]); } }
      finally { for (const lp of tmp) { scene.remove(lp); lp.dispose(); } for (const o of spots) o.visible = true; if (mpN) mpN.add(marla.root); for (const l of glights) l.visible = false; warmG.visible = false; warmG.matrixWorldAutoUpdate = false; } }
    // (H round 2, warm-up gate: 8-23 shader programs built on entering a house by day, no card there) a house by day: the day's lights with one ceiling lamp per floor
    // (1 up to the most floors among this ring's houses; buildRoomDyn), Marla off the street (she stays out of the house), and the room's own pieces (a food and an
    // essentials crate, the cat), built and kept hidden in the warm-up set until the run ends (a freed material would free its shader); their shaders built here
    if (!bot && kind === 'ride' && run && renderer.compileAsync) { const counts = HL_ON ? [0] : CONFIG.lag.lampsUsed ? [...new Set(run.houses.map((h) => h.L || 1))].sort((a, b) => a - b) : [...Array(Math.max(1, ...run.houses.map((h) => h.L || 1))).keys()].map((k) => k + 1), tmp = [], mp = marla.root.parent;
      if (!warmG.userData.day) { warmG.userData.day = true; for (const k of ['food', 'ess']) { const c = (LOOK_OLD ? PR.crateMesh : BT.crateV2)(k); shadeUnder(c, CONFIG.depth.crate, 0.02); c.position.set(0, -50, 0); warmG.add(c); } const cat = PR.catMesh(CONFIG.catStyles[0]); cat.g.position.set(0, -50, 0); warmG.add(cat.g);
        // (R3, Mac 44481169893: 3 shaders built entering the first house by day, "MeshLambertMaterial map transparent" x2 and "MeshBasicMaterial #ffe2a8 map transparent")
        // the house's dirt decals (dirtMat) and the light pools at its openings (poolMat), which buildDepth puts in every house, are in the set too
        depthMats(); for (const m of [dirtMat('grime'), poolMat, shadeMat]) { const d = new THREE.Mesh(flatGeo, m); d.position.set(0, -50, 0); d.renderOrder = 1; warmG.add(d); }
        // (Nov 20, PROFILE 44648754836: 'MeshLambertMaterial map side2 [128x96]' then 'MeshStandardMaterial map side2 [128x96]' built entering the first house by day)
        // a house's note paper (loreNote) is in the set too, in the form it is drawn in (src/fx.js upgradeOne)
        { const L2 = CONFIG.lore, pm = new THREE.Mesh(new THREE.PlaneGeometry(L2.paper[0], L2.paper[1]), new THREE.MeshLambertMaterial({ map: lorePaperTex(), emissive: 0x2a2618, side: THREE.DoubleSide })); pm.position.set(0, -50, 0); warmG.add(pm); if (fx && fx.upgradeOne) fx.upgradeOne(pm);
          // (Nov 20, PROFILE 44664177726: 'MeshDepthMaterial map side1 [256x192] @ Mesh < head < pend < arm0 < hub' built in play) a machine's display takes its picture
          // after the card, and no other piece that casts a shadow is a plain single-sided mesh with a picture: one such piece is in the set, so its shadow shader is built here
          warmG.add(warmCaster()); } }
      warmG.visible = true; if (mp) mp.remove(marla.root);
      // (R4) by day too: only the lamp counts this run's houses have
      try { for (const n of counts) { while (tmp.length < n) { const lp = new THREE.PointLight(0xffe0a0, CONFIG.world.lamp, 6); lp.position.set(0, -40, 0); scene.add(lp); tmp.push(lp); } await Promise.race([renderer.compileAsync(scene, cam), nap(L.maxWait * 1000)]); } }
      finally { for (const lp of tmp) { scene.remove(lp); lp.dispose(); } if (mp) mp.add(marla.root); warmG.visible = false; } }
    // LAG FIX Nov 19 (real GPU: the first frame after the night card still took 1.7 s): the scene is drawn once UNDER the card, with the warm-up copies set out in front of
    // the camera, so every shader's first use, every upload and the sun shadow map (whose depth shaders compileAsync does not build) happen here, not in play; then
    // drawn again without them, so the shadow map play starts with is the real one. (Not in the scripted checks: they keep the old timing.)
    mark('night shaders'); if (!bot) { if (kind === 'night') { const n = warmG.children.length; warmG.children.forEach((o, i) => { const a = yaw + ((i + 0.5) / n - 0.5) * 0.9, d = 2.5 + (i % 3); o.position.set(cam.position.x - Math.sin(a) * d, cam.position.y - 1.2, cam.position.z - Math.cos(a) * d); }); warmG.visible = true; }
      // the frame's own drawing (draw(): far plane, far copies, picture pass) and the hands; a last plain frame, then the GPU is made to finish all of it under the card
      // (real GPU: without the finish the first frame of play waited ~0.6 s for the card's queued work)
      const draw1 = (sh) => { if (sh) renderer.shadowMap.needsUpdate = true; draw(); if (sim && state === 'play' && !window.__noHands) hands.render(renderer, cam.aspect); }, raf = () => new Promise((r) => requestAnimationFrame(() => r()));
      const G = CONFIG.lag.gpuPart, gp = G && G.on;
      draw1(true); warmG.visible = false; if (gp) await gpuDone(G.cap); mark('first frame');
      // the hands' seed-pod token (its own scene, hidden until a device is thrown) drawn once with the token shown: its shader is built here, not at the first throw
      if ((kind === 'night' || kind === 'ride') && hands.warm) hands.warm(renderer, cam.aspect);
      await raf();
      // then the view all round (four quarter turns), with the pieces the night cull hides (layer 1) drawn too: every piece's first draw (its normals, uvs and colours go
      // to the GPU then; the shadow pass only sent positions) happens under the card, not when you turn round or step to a window in the fight
      // and once more with EVERY piece shown and not culled (hidden effects such as the boss's summon bars and sparks included; lights left as they are, so no shader changes)
      // (owner 12:35) the home card over a base already drawn at the title (titleBase: shaders built, every piece uploaded) skips the turn-round and all-pieces passes
      // (H round 2, Enter on medium: "3338 ms drawArrays < render < renderBufferDirect" in the first frame after the card) the title's off-screen draws (a 64 px target)
      // uploaded the data but did not make the draws the screen needs (the GPU builds its draw states per target), so the home card always makes its own passes on screen
      const preDrawn = false;
      // (Nov 20, home card 4.7-10.6 s on the Mac, its four turns 2.3-5.7 s of it: run 44692193700) CONFIG.lag.cardTurns[kind] === false: that card skips the four
      // quarter turns; the next step still draws every piece once with the scene's lights and shadows (to be proven by the enter and hub first-use frames)
      const noTurns = !!(CONFIG.lag.cardTurns && CONFIG.lag.cardTurns[kind] === false);
      // (R4, card 27) each quarter turn waits for the GPU to finish the one before (they were four whole-scene draws queued in one frame)
      if (!preDrawn && !noTurns) { const ry = cam.rotation.y; cam.layers.enable(1); try { for (let k = 1; k <= 4; k++) { cam.rotation.y = ry + k * Math.PI / 2; cam.updateMatrixWorld(); draw1(false); if (gp) { cam.layers.disable(1); cam.rotation.y = ry; cam.updateMatrixWorld(); await gpuDone(G.cap); cam.layers.enable(1); } } } finally { cam.layers.disable(1); cam.rotation.y = ry; cam.updateMatrixWorld(); } await raf(); mark('turns'); }
      // (H round 2, warm-up gate: shadow (depth) programs of pieces first seen by the shadow pass after the card) this pass also draws the shadow maps, with every
      // piece shown and not culled, so every caster's depth program is built here; the shadows are drawn again as they are just after; the body shadow too
      // (R3, home card 9.4-14 s on the Mac: the whole pass was one draw of every piece in one frame) the pass is drawn in parts: CONFIG.lag.slice.cardDraws pieces at a
      // time, each shown and not culled with the shadow maps drawn (drawPieces), at most CONFIG.lag.slice.card ms of parts a frame; LCARD.allParts: frames, longest ms
      if (!preDrawn) { const S = CONFIG.lag.slice, list = []; if (pshadow.warm) pshadow.warm(); scene.traverse((o) => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o !== sky.mesh) list.push(o); });
        // (R4, card 27) each part (S.card ms of sending) waits for the GPU to finish it (gpuDone) before the next, instead of one frame
        let fr = 0, worst = 0; for (let i = 0; i < list.length;) { const t0 = performance.now(); while (i < list.length && performance.now() - t0 < S.card) { const e = Math.min(list.length, i + S.cardDraws); renderer.shadowMap.needsUpdate = true; drawPieces(list, i, e, null); i = e; } worst = Math.max(worst, performance.now() - t0); fr++; if (gp) await gpuDone(G.cap); else await raf(); }
        LCARD.allParts = [fr, Math.round(worst)]; LCARD.shadowSets = shadowSets(list); mark('all pieces'); }
      draw1(true); if (gp) await gpuDone(G.cap); else await raf(); draw1(false); if (gp) await gpuDone(G.cap); else { try { renderer.getContext().finish(); } catch (e2) { /* no context */ } } }
    // the warm-up machines start the Gloom pool (they are built, drawn and uploaded); the rest of the warm-up copies stay hidden until the run ends, their matrices
    // skipping the per-frame pass too (owner 09:50)
    mark('first draws'); if (kind === 'night') for (const c of [...warmG.children]) if (c.userData.kind && c.userData.anim) { warmG.remove(c); gloomPut(c); }
    warmG.visible = false; warmG.matrixWorldAutoUpdate = false;
    // LAG FIX Nov 19 (owner 11:25): the real frame is drawn under the card until CONFIG.lag.card.settle.n frames in a row come in under settle.ms (cap settle.cap s), so a
    // scene's slow first frames are not the first frames of play; their times are kept in LCARD.settle (perfcheck logs them)
    if (!bot && L.settle) { const S = L.settle, ts = performance.now(), raf = () => new Promise((r) => requestAnimationFrame(() => r())), fr = []; let ok = 0, tp = performance.now();
      while (ok < S.n && performance.now() - ts < S.cap * 1000) { draw(); if (sim && state === 'play' && !window.__noHands) hands.render(renderer, cam.aspect); await raf(); const t = performance.now(), ms = t - tp; tp = t; fr.push(Math.round(ms)); ok = ms < S.ms ? ok + 1 : 0; }
      LCARD.settle = fr; mark('settle'); }
    fill(0.9); if (bot) renderer.shadowMap.needsUpdate = true;
  } catch (e) { try { window.__cardErr = String(e && e.stack || e).slice(0, 300); } catch (e2) { /* no window */ } }
  LCARD.ms = Math.round(performance.now() - t0); LCARD.proofs.push({ id, kind, ms: LCARD.ms, renders: RSTAT.renders - pf0[0], calls: RSTAT.calls - pf0[1], programs: nProg() - pf0[2], uploads: UPL.n - pf0[3], uploadMs: Math.round(UPL.ms - pf0[4]), buffers: UPL.bn - pf0[5], bufferMs: Math.round(UPL.bms - pf0[6]), steps: LCARD.steps, cw: LCARD.cw || null, allParts: LCARD.allParts || null, shadowSets: LCARD.shadowSets || 0, lamps: LCARD.lampCounts || null, gpu: [GPUQ.waits - pf0[7], Math.round(GPUQ.ms - pf0[8]), Math.round(GPUQ.worst)], bot }); if (LCARD.proofs.length > 24) LCARD.proofs.shift();
  const left = (bot ? 0 : (L.min[kind] || 0) * 1000) - (performance.now() - t0); if (left > 0) await nap(left);
  if (CONFIG.lag.crossWarm) { if (crS === null) crW.removeAttribute('style'); else crW.setAttribute('style', crS); crossK = '#'; setCross(crK); }
  for (const r of hudW) { if (r.ph) r.ph.remove(); if (r.st === null) r.e.removeAttribute('style'); else r.e.setAttribute('style', r.st); if (!r.on) r.e.classList.remove('on'); }
  fill(1); if (id === LCARD.n) { LCARD.on = false; LCARD.endT = Math.round(performance.now()); $('lcard').style.display = 'none'; perfRest(); }
}
// the automatic step-down on the desktop tier (src/perfstep.js, CONFIG.lag.step); phones never run it
perf = createPerfStep({ renderer, scene, resize, fx: () => fx, lights: glights, playing: () => !LCARD.on, onLow: () => flash('Graphics will start on low next time (frames were slow)', true) });
// LAG FIX Nov 19 (finding 5): a desktop model's maps go to the GPU as it finishes loading, and the Gloom model shader is built then (async), so the first machine
// of a kind (or the boss) no longer stalls the frame it first appears in
const warmMaps = (root) => root.traverse((o) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) if (m && m[k] && !m[k].userData.warm) { m[k].userData.warm = true; renderer.initTexture(m[k]); } });
// (R4 worker 6, lead 22:02: PROFILE 44532874070, 10 programs '(compile)' built at 24.6-24.7 s in the SHOWN film, no piece asking = this hook's compileAsync for
// a model that finished loading then) a model that arrives while the film or play is shown waits; its pictures and shaders are prepared at the next held time
// (a loading card, the film's black, the title or the run-end screen: glbFlush from frame()), where the warm-up gate does not count them (REMOVED from shown frames)
const GLBQ = []; const glbReady = (kind, sc) => { warmMaps(sc); if (renderer.compileAsync) renderer.compileAsync(glbCopy(kind, new THREE.Color(1, 1, 1)), cam, scene).catch(() => {}); };
glbHooks.ready = (kind, sc) => { if (CONFIG.lag.glbDefer && !playHeld()) GLBQ.push([kind, sc]); else glbReady(kind, sc); };
function glbFlush() { if (GLBQ.length && playHeld()) for (const [k, sc] of GLBQ.splice(0)) glbReady(k, sc); }
bossHooks.ready = (root) => warmMaps(root);
let last = performance.now(), acc = 0, hurtT = 0;
// (OWNER DECISION Nov 20 13:40: "lighter versions past a few metres", the base at 976 draw calls and 1.60 M triangles a frame against 500 / 0.5 M; Mac 44682486313
// BREAK hub: hundreds of pieces under 200 triangles drawn 17-28 m away) CONFIG.lag.baseFar { on, r, far, every, list }: in the base, a piece whose
// own size is under r m is not drawn when its middle (as placed when the list is made) is over far m from the eye. The list is made again every `list` s (not per frame); every `every` frames the pieces
// are tested (no objects made). Only a piece this code hid is ever shown again by it, so a piece hidden by anything else stays hidden. Pieces carried on a
// person's or an animal's bones are never in the list. Outside the base all are shown
const BFC = { recs: [], at: 0, k: 0, g: null, v: null, seen: new WeakMap(), mov: new WeakSet() };
function baseFarOff() { for (const r of BFC.recs) if (r.cull) { r.cull = false; r.o.visible = true; } BFC.recs.length = 0; BFC.g = null; }
// (Nov 20, street 500 draw calls a frame in plain medium 44689494109 / 44689500672, limit < 500) the street by day too, with its own distance (streetFar): the list
// and what counts as moved start again whenever the place changes (base, or the street as it stands for this run)
function baseFar(now) { const C = CONFIG.lag.baseFar; if (!C || !C.on) return; const street = !!(C.streetFar && state === 'play' && world && run && run.inside < 0), g = state === 'base' ? bview.group : street ? world.g : null;
  if (!g || BOTFAR()) { if (BFC.recs.length) baseFarOff(); return; }
  if (BFC.g !== g) { BFC.seen = new WeakMap(); BFC.mov = new WeakSet(); }
  const farM = street ? C.streetFar : C.far;
  if (BFC.g !== g || now - BFC.at > C.list * 1000) { for (const r of BFC.recs) if (r.cull) { r.cull = false; r.o.visible = true; } BFC.recs.length = 0; BFC.g = g; BFC.at = now; BFC.v = BFC.v || new THREE.Vector3();
    g.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.visible || o.userData.keep) return; for (let q = o.parent; q && q !== g; q = q.parent) if (q.isBone || q.isSkinnedMesh || (q.animations && q.animations.length) || q.userData.char) return; const ge = o.geometry; if (!ge.boundingSphere) ge.computeBoundingSphere(); const bs = ge.boundingSphere; if (!bs) return; const e = o.matrixWorld.elements, sc = Math.hypot(e[0], e[1], e[2]); if (bs.radius * sc >= C.r || BFC.mov.has(o)) return; BFC.v.copy(bs.center).applyMatrix4(o.matrixWorld); const was = BFC.seen.get(o);
      // only a piece found in the same place as at the list before is in the list: a walking animal or person is never hidden (once seen moved, never again)
      if (!was) { BFC.seen.set(o, [BFC.v.x, BFC.v.y, BFC.v.z]); return; } if (Math.abs(was[0] - BFC.v.x) + Math.abs(was[1] - BFC.v.y) + Math.abs(was[2] - BFC.v.z) > 0.02) { BFC.mov.add(o); return; }
      BFC.recs.push({ o, cull: false, x: BFC.v.x, y: BFC.v.y, z: BFC.v.z }); }); BFC.k = C.every; }
  if (++BFC.k < C.every) return; BFC.k = 0; const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, f2 = farM * farM;
  for (const r of BFC.recs) { const dx = r.x - cx, dy = r.y - cy, dz = r.z - cz, far = dx * dx + dy * dy + dz * dz > f2; if (far && !r.cull && r.o.visible) { r.cull = true; r.o.visible = false; } else if (!far && r.cull) { r.cull = false; r.o.visible = true; } } }
// the scripted checks look at the base's pieces from fixed spots: they keep every piece (as before); ?cards=1 runs (the Mac's real-play measurement) cull as players do
const BOTFAR = () => BOTRUN();
function frame(now) {
  requestAnimationFrame(frame);
  // a loading card is up (sceneCard): the game is held still and nothing is drawn under it
  // (player report Nov 21: "when I died and got sent back home my screen was covered with this and I couldn't get rid of it") the run-end screen's blurred
  // snapshot was only taken away by endSnap() at the end of a night frame; the base, the street, the film and the cards leave this function earlier, so after
  // any night it stayed over the base. It is now taken away here, on every frame, as soon as the run-end screen is not showing
  if (ENDS.on && !(state === 'end' && $('end').style.display === 'flex')) endSnap();
  lfStart(now); playProgs(); baseSlice(); filmSlice(); nightBgSlice(); glbFlush(); marlaSync(); baseFar(now);
  if (LCARD.on) { last = now; return; }
  // window.__dtMax is set only by the slow headless checks (software renderer, under 1 frame a second) so game time keeps up; players never set it.
  const rawMs = now - last, dt = Math.min(window.__dtMax || CONFIG.lag.dtMax, rawMs / 1000); last = now; const holdNow = paused || state === 'end' || (state === 'menu' && MENU_EL.style.display !== 'none'); holdDraw = (holdNow && pauseDrawn) || ctxLost; pauseDrawn = holdNow; perfHud(rawMs); perf.tick(rawMs, (state === 'base' || state === 'play') && !paused);
  if (shadowT > 0) { shadowT -= dt; if (shadowT <= 0) renderer.shadowMap.needsUpdate = true; }
  if (catArm) catArm.rotation.x = -0.5 + Math.sin(now / 280) * 0.45; // the lucky cat beckons
  // the scene's dark under-plane (y -0.08) would show through the base's sunken stream channel: while the base is in the scene it lies below the channel bed (CONFIG.baseWater.under)
  ground.position.y = bview.group && bview.group.parent && CONFIG.baseWater && CONFIG.baseWater.on ? -CONFIG.baseWater.under : -0.08;
  // Marla's voice: only in a run (state 'play'), stopped while paused or hidden; it plays the clip of the line her card (or a "Marla: " centre line) shows
  MV.tick(dt, state === 'play' && !!(run || sim), paused || document.hidden, $('marla').classList.contains('hq') ? '' : $('marla').textContent, $('csay').textContent);
  waterSnd.tick(dt, mus.ready ? audio() : null, { base: state === 'base' && !!baseU, paused, ui: !!ui, hidden: document.hidden, music: mus.on, volume: CONFIG.music.ambient || CONFIG.music.volume, near: baseU && baseU.water, indoor: baseU && baseU.indoor });
  if (state === 'base') {
    let mx = stick.x, mz = stick.y;
    if (keys.KeyW) mz -= 1; if (keys.KeyS) mz += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    if (!ui && !paused && !FILM.it) { const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } const sy = Math.sin(yaw), cy = Math.cos(yaw), v = CONFIG.base.speed * dt; [bp.x, bp.z] = bview.pushOut(bp.x + (mx * cy + mz * sy) * v, bp.z + (-mx * sy + mz * cy) * v); }
    // (owner 10:50) paused: the base is not stepped (its people and animals hold still, as the picture does); the last result is kept
    const u = paused && baseU ? baseU : bview.update(dt, bp.x, bp.z, 1.6); curTarget = u.target; baseU = u;
    // base evening (CONFIG.avians.evening / eveLight): the sky light and exposure go down with the sun
    { const ev = bview.evening ? bview.evening() : 0, EL = CONFIG.avians && CONFIG.avians.eveLight; if (EL) { hemi.intensity = CONFIG.baseLight.power * (1 - (1 - EL[0]) * ev); if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure * (1 - (1 - EL[1]) * ev); } } if (u.shadow) shadowT = 0.15;
    if (u.target && u.target.kind === 'cat' && !ui) doUse(); // the cat is collected by touching it
    baseCamY += (1.6 + (u.deck || 0) - baseCamY) * Math.min(1, dt * ((CONFIG.baseWater && CONFIG.baseWater.camEase) || 8)); cam.position.set(bp.x, baseCamY, bp.z); cam.rotation.set(pitch, yaw, 0, 'YXZ');
    { const hide = !!u.target && (u.target.kind === 'npc' || u.target.kind === 'scout'), q = $('bq'); if ((q.style.visibility === 'hidden') !== hide) q.style.visibility = hide ? 'hidden' : ''; }
    if (mx || mz) baseMoved = true;
    setText('bprompt', ui ? '' : (u.target && u.target.kind === 'cat' ? '' : (u.prompt || (save.day === 1 && !save.nights && !baseMoved ? (COARSE.now ? 'Left thumb walks, right thumb looks' : 'W A S D to walk, drag the mouse to look, E or click to use') : ''))));
    if (save) {
      const c = (r) => B.count(save, r);
      setText('bstat', 'Day ' + save.day + ' · Food ' + save.food + ' · Essentials ' + save.essentials + ' · People ' + save.personnel.length + ' · ' + (save.cleared ? 'Goal reached: ring 5 held' : 'Goal: survive a night in ring ' + CONFIG.ring.mult.length + ' · next ride: ring ' + (+$('selRing').value + 1) + ' (' + (save.ringOpen || 1) + ' of ' + CONFIG.ring.mult.length + ' open)') + ' · ' + B.recruitLine(CONFIG, save.food) + (B.carriedCats(save) ? ' · Cats carried ' + B.carriedCats(save) : '') + (B.placedCats(save) ? ' · Cats home ' + B.placedCats(save) : ''));
      if (questOpenT > 0) questOpenT -= dt;
      const act = save.quests.filter((q) => q.state === 'active' || q.state === 'ready').map((q) => (q.state === 'ready' ? '? Hand in ' + B.NPCS[q.giver].name + '\'s posting at the board' : '- ' + q.text)).join('\n');
      const qAll = (carry ? 'Carrying a crate: take it to ' + B.STATIONS[carry.to].name + '\n' : '') + (act ? 'Quests:\n' + act : 'Quests: read the board by the Workshop') + (CONFIG.miniMap.on ? '' : '\nFind Marla (' + B.scoutPos(save).hint + ')' + whereIs(B.scoutPos(save))) + (save.food >= CONFIG.base.recruitFood && save.personnel.length < CONFIG.base.maxPersonnel ? '\nGarden: welcome a new person (' + CONFIG.base.recruitFood + ' food)' : '') + (save.nights && (save.nights <= 3 || save.essentials >= UP_MIN) ? (bview.rooms.WS ? '\nWorkshop: go in, Oko upgrades devices (from ' + UP_MIN + ' essentials, you have ' + save.essentials + ')' + whereIs((([x, z]) => ({ x, z }))(doorAt(bview.rooms.WS, 0.6))) : '\nWorkshop: upgrades from ' + UP_MIN + ' essentials (you have ' + save.essentials + ')') : '') + (CONFIG.avians && CONFIG.avians.on && save.avians && (save.avians.coop || save.avians.held || save.toldHatchery === save.day) ? '\nHatchery: ' + (save.avians.held ? 'warm your ' + save.avians.held + ' egg' + (save.avians.held > 1 ? 's' : '') + ' in the dome' : save.avians.coop ? save.avians.coop + ' egg' + (save.avians.coop > 1 ? 's' : '') + ' in the coop' : 'eggs go in the warm dome') + whereIs({ x: CONFIG.avians.at[0] - 0.7, z: CONFIG.avians.at[1] - 2.35 }) : '') + (save.nights && !save.readDesk ? '\nJournal desk at home: every device and machine' + whereIs({ x: B.HOME.desk[0], z: B.HOME.desk[1] }) : '') + (save.cats.some((c) => c.state === 'carried') ? '\nLucky cat: set it on the shelf in your home' + whereIs({ x: B.HOME.x, z: B.HOME.z - 1 }) : '') + (save.cats.some((c) => c.state === 'hidden') ? '\nRumour: a golden paw waves ' + B.catPos(save.cats.find((c) => c.state === 'hidden')).hint : '');
      const qL = qAll.split('\n').filter((l) => l && l !== 'Quests:'); const qN = CONFIG.baseHud.questLines;
      if (!save.nights) { const mi = qL.findIndex((l) => l.startsWith('Find Marla')); if (mi > 0) qL.unshift(qL.splice(mi, 1)[0]); }
      if (save.toldHatchery === save.day) { const hi2 = qL.findIndex((l) => l.startsWith('Hatchery')); if (hi2 > 0) qL.unshift(qL.splice(hi2, 1)[0]); }
      if (bview.rooms.WS && save.toldWorkshop === save.day) { const wi = qL.findIndex((l) => l.startsWith('Workshop')); if (wi > 0) qL.unshift(qL.splice(wi, 1)[0]); }      // before the first night, finding Marla is the line that matters
      setText('bq', questOpenT > 0 || qL.length <= qN ? qL.join('\n') : qL.slice(0, qN).join('\n') + '\n+' + (qL.length - qN) + ' more (' + (FINE ? 'Tab' : 'tap') + ')');
    }
    if (u.catDist < CONFIG.cat.chimeRange) { chimeT -= dt; if (chimeT <= 0) { chime(1 - u.catDist / CONFIG.cat.chimeRange * 0.8); chimeT = 0.4 + (u.catDist / CONFIG.cat.chimeRange) * 1.6; } }
    tickWsTip(dt); tickHud(dt); tickAim(dt); tickCharge(dt); tickMap(dt);
    lfMark('logic'); draw(); lfMark('draw'); lfEnd(); return;
  }
  if (state === 'intro') { if (FILMREC) { lfEnd(); return; } introFrame(dt); lfMark('logic'); LF.last = null; lfEnd(); if (LF.last) LF.last.part = intro ? intro.part + ' ' + (intro.t || 0).toFixed(1) : 'end'; return; }
  if (state === 'play' && !sim && run) { townFrame(dt); return; }
  if (state === 'play' && sim && sim.done) endScreen();
  if (state === 'play' && sim && !sim.done && !paused) {
    sim.player.yaw = yaw; sim.player.pitch = pitch;
    let mx = stick.x, mz = stick.y; // stick up = forward
    if (keys.KeyW) mz -= 1; if (keys.KeyS) mz += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const wx = mx * cy + mz * sy, wz = -mx * sy + mz * cy;
    sim.move(wx, wz, dt); // smooth: every frame, real dt
    acc += dt; const step = CONFIG.night.dt;
    while (acc >= step) { sim.step(step); if (mustSolar()) sim.dayT += step; acc -= step; } drillTick(dt);
    // the first-collector order: up CONFIG.firstSolar.secs, again every .repeat s while the collector is still not up (no voice clip, so a repeat is silent)
    // (owner Nov 21: a player may ignore the lesson) the first-collector hold lets go after CONFIG.firstSolar.ignoreSecs of game time with no collector up: the day clock
    // runs again and you may leave or start the night; it does not come back (save.solarDone)
    if (mustSolar()) { solarIgn += dt; if (solarIgn >= CONFIG.firstSolar.ignoreSecs) { solarIgn = 0; save.solarDone = true; persist(); $('marla').textContent = CONFIG.firstSolar.ignored; marlaT = CONFIG.firstSolar.secs; } }
    if (mustSolar()) { solarT -= dt; if (solarT <= 0 && marlaT <= 0.01) { const F = CONFIG.firstSolar; $('marla').textContent = FINE ? F.marlaD : F.marlaP; marlaT = F.secs; solarT = F.repeat; } }
    const evs = sim.log.splice(0); impactEvents(evs);
    for (const ev of evs) { if (ev.e === 'boss' && ev.k === 'spill') sunPop(ev.sun);
      if (ev.e === 'hurt') { hurtT = 0.25; marlaHurt(); marlaStreak(); }
      if (ev.e === 'shot' && ev.head) { $('hs').textContent = 'HEADSHOT x' + CONFIG.cannon.headMult; hsT = 0.9; }
      if (ev.e === 'lance') tracer(ev.x, ev.z, ev.tx, ev.tz, 0.7, ev.floor, ev.kind === 'mist' ? 0x9fd8ff : ev.kind === 'sling' ? 0xd0a0ff : ev.kind === 'twin' ? 0xffe08a : 0x9fffa0);
      if (ev.e === 'boom') { const m = opTake('boom', () => { const o = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.45 })); o.geometry.userData.pool = true; o.material.userData.shared = true; return o; }); m.scale.setScalar(ev.r); m.position.set(ev.x, ev.floor * FH + 0.8, ev.z); scene.add(m); tracers.push({ l: m, t: 0.22 }); sfxHit(panOf(ev)); }
      if (ev.e === 'press') { const m = opTake('press', () => { const o = box(1.0, 0.2, 1.0, 0x7ad070); o.geometry.userData.pool = true; o.material.userData.shared = true; return o; }); m.position.set(ev.x, ev.floor * FH + 0.6, ev.z); scene.add(m); tracers.push({ l: m, t: 0.3 }); }
      if (ev.e === 'devhit' && ev.kind === 'panel') sfxHit(panOf(ev));
      if (ev.e === 'devhit' && ev.kind === 'collector') { sfxHit(panOf(ev)); marlaSay('collector', { d: dirWord(panOf(ev)) }); }
      if (ev.e === 'devdead') breakCue(ev);
      if (ev.e === 'pop') gloomScrap({ scene }, ev.x, ev.floor * FH, ev.z); // desktop scrap pieces (src/bosshi.js)
      if (ev.e === 'boss' && ev.k === 'rise' && save && fromBase) { save.met = save.met || {}; if (!save.met.beckoner) { save.met.beckoner = true; persist(); } }
      if (ev.e === 'pop') for (let i = 0; i < 9; i++) { const sm = opTake('smoke', () => PR.smoke()); sm.scale.setScalar(0.16 + Math.random() * 0.14); sm.position.set(ev.x + (Math.random() - 0.5) * 0.5, ev.floor * FH + 0.4 + Math.random() * 1.6, ev.z + (Math.random() - 0.5) * 0.5); scene.add(sm); debris.push({ m: sm, y0: -99, vx: (Math.random() - 0.5) * 1.2, vy: 9 * 0.55 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.2, t: 0.7, grow: 1.8 }); }
      if (ev.e === 'alert') marlaAlert(ev);
      if (ev.e === 'kind' && KIND_LINE[ev.kind] && GLOOM_Q !== 'hood' && CONFIG.gloomLook.machines) { kindQ.push(KIND_LINE[ev.kind]); }
      if (ev.e === 'kind' && save && fromBase) { save.met = save.met || {}; if (!save.met[ev.kind]) { save.met[ev.kind] = true; persist(); } }
      if (ev.e === 'dusk') { sceneCard('night'); kindQ.length = 0; if (run && run.wakeExtra && !sim.wakeAdded && sim.addGloom) { sim.wakeAdded = true; sim.addGloom(run.wakeExtra); } }
      if (ev.e === 'crate' || ev.e === 'cat') hands.grab();
      if (ev.e === 'crate') flash('+' + ev.v + (ev.kind === 'food' ? ' food' : ' essentials'));
      if (ev.e === 'dusk') { hintN = 0; hintQ.length = 0; $('time').style.color = ''; sfxAlert('inbound'); $('marla').textContent = run && run.caught ? 'Dark caught you outside, Potts. Nearest house it is.' : 'Sun is down, Potts. Turbine first, then lances, then panels.'; marlaT = 4.5; sayAt = performance.now() / 1000 + 2; sayPrio = 3; }
      if (ev.e === 'blocked') flash('Stairs are barricaded: take the ladder or wait for the Gloom to break it', true);
      if (ev.e === 'climb') flash('Climbing the ladder: no shooting, placing or eating while you hang here');
      if (ev.e === 'floor') flash('Floor ' + (sim.player.floor + 1) + ' of ' + sim.L);
      if (ev.e === 'cat') flash('You found the hidden lucky cat! +' + CONFIG.cat.energy + ' Sun', 2);
    }
    if (sim.done) endScreen();
  }
  if (sim && !holdDraw) {
    const p = sim.player;
    if (p.climb) camY = (p.floor + (p.climb.to - p.floor) * (1 - p.climb.t / CONFIG.ladderTime)) * FH + 1.6; else camY += (p.floor * FH + 1.6 - camY) * Math.min(1, dt * 8);
    cam.position.set(p.x, camY, p.z); cam.rotation.set(pitch, yaw, 0, 'YXZ');
    GFRAME = (GFRAME + 1) | 0;
    for (const g of sim.gloom) {
      let m = gMesh.get(g.id); const isNew = !m; if (!m) { m = gloomTake(g); if (m) { scene.add(m); gMesh.set(g.id, m); } else { m = gloomMesh(g); if (m.userData.anim) mergeQ.push([m, g.x, g.z]); gloomBlob(m, gloomKind(g)); scene.add(m); gMesh.set(g.id, m); } }
      // the height it is drawn at comes from the sim (src/sim.js gloomY), so the aimed shot aims where the model stands
      const gy = sim.gloomY(g);
      // LAG FIX Nov 19 (owner 07:10): at night in a house a machine outside that no opening shows is not drawn (src/nightcull.js sees; CONFIG.lag.nightCull.gloomR);
      // it stays visible and animated (the aimed shot tests the model as posed, src/main.js drawnHit, so the rules see exactly what they saw before); only its draws move to
      // layer 1, which the camera does not draw (pieces already on the hit layer stay there), and its matrices skip the per-frame pass (drawnHit works them out itself)
      m.position.set(g.x, gy, g.z); m.rotation.y = g.face + Math.PI; const L = nightCull.sees(g.x, gy + CONFIG.lag.nightCull.gloomY, g.z, CONFIG.lag.nightCull.gloomR, sim, cam) ? 0 : 1; if ((m.userData.cullL || 0) !== L) { m.userData.cullL = L; m.traverse((q) => { if (!q.userData.hitOnly) q.layers.set(L); }); m.matrixWorldAutoUpdate = L === 0; if (L === 0) m.userData.born = true; }
      // OWNER DECISION Nov 19 12:35 (a visible cut, approved): a machine farther than CONFIG.lag.farAnim.dist m from you, or one the night cull hides, is posed and has its
      // matrices worked out only every farAnim.every-th frame (its frames spread by its id); nearer, every frame as before
      // (Nov 21, whole-scene scan: a far machine was drawn for a frame where its model last stood, 53 m off) a machine on its first frame, or the frame the night cull
      // shows it again, is always posed and placed: the every-other-frame saving starts the frame after
      const born = isNew || m.userData.born; m.userData.born = false;
      const FA = CONFIG.lag.farAnim, skip = !born && !!FA && FA.every > 1 && (L === 1 || (g.x - cam.position.x) ** 2 + (g.z - cam.position.z) ** 2 > FA.dist * FA.dist) && (GFRAME + g.id) % FA.every !== 0;
      if (L === 0) m.matrixWorldAutoUpdate = !skip;
      if (m.userData.anim) { if (!skip) { m.userData.anim(performance.now() / 1000, g); m.userData.stale = null; } else m.userData.stale = g; } else m.scale.setScalar(0.9 + 0.1 * (g.hp / g.maxhp));
    }
    // every tier (desktop too since owner 09:50): a new machine's still pieces are merged a few machines a frame (CONFIG.lag.mergeGloom.perFrame); the probe poses use times before 0 (no caption line starts)
    for (let k = 0; k < CONFIG.lag.mergeGloom.perFrame && mergeQ.length; k++) { const [mm, mx, mz] = mergeQ.shift(); if (!mm.parent) continue; { const pr = (i) => mm.userData.anim(-(1 + i * 0.73), { x: mx + i * 0.11, z: mz + i * 0.07 }); mergeStatic(mm, pr); freezeStillBones(mm, pr, CONFIG.lag.mergeGloom.probes); } mm.userData.merged = true; HITC.delete(mm); if (CONFIG.lag.singlePassFlat && CONFIG.lag.singlePassFlat.on) twoPassGroups(mm); }
    tickGloomLights(sim.phase === 'night'); tickPanelGhost(now / 1000); freezeWorld(); nightCull.tick(world, sim, cam, dormG);
    bossTick(paused ? 0 : dt, sim, { scene, cam, audio }); scrapTick(paused ? 0 : dt, { scene }); // paused: 0 (owner 11:40: the boss pose, scrap and dawn collapse held still) // the final-night boss (src/bosshi.js): after the camera is set, before the frame is drawn
    if (run && sim.L > 1 && !run.toldStairs && save && (save.nights || 0) < 2 && [...sim.stairs.map((q) => [q.bx, q.bz]), ...sim.stairs.map((q) => [q.tx, q.tz]), ...sim.ladders.map((q) => [q.x, q.z])].some((q) => Math.hypot(q[0] - sim.player.x, q[1] - sim.player.z) < 3)) { run.toldStairs = true; marlaHint('Stairs: the Gloom use them too. The ladder: only you can climb it.'); }
    if (kindQ.length && sim.phase === 'night' && marlaT <= 0.01 && sim.t > CONFIG.gloomLook.kindLineAfter && !paused) marlaHint(kindQ.shift());
    for (const [id, m] of gMesh) if (!sim.gloom.find((g) => g.id === id)) { gloomPut(m); gMesh.delete(id); }
    for (const d of sim.devices) {
      let m = dMesh.get(d.id);
      if (!m) { m = deviceMesh(d.kind); if (!CONFIG.devices[d.kind].wall) shadeUnder(m, CONFIG.depth.device); scene.add(m); dMesh.set(d.id, m); if (CONFIG.devices[d.kind].wall) { if (d.bp !== undefined) { const b = sim.breaches[d.bp]; m.rotation.y = Math.atan2(b.nx, b.nz); } else m.rotation.y = Math.PI / 2; } }
      { const la = landAt.get(d.id); if (la !== undefined) { const k = (now - la) / (1000 * CONFIG.hands.landGrow); m.visible = k >= 0; if (m.visible) m.scale.setScalar(Math.min(1, 0.6 + 0.4 * k)); if (k >= 1) { landAt.delete(d.id); m.scale.setScalar(1); } } }
      m.position.set(d.x, d.floor * FH, d.z); deviceHop(m, d, !!CONFIG.devices[d.kind].wall, yaw); let dr = DEVREF.get(m); if (!dr) { dr = { blade: m.getObjectByName('blade'), barrel: m.getObjectByName('barrel') }; DEVREF.set(m, dr); } const bl = dr.blade; if (bl) bl.rotation.y += dt * 4; if (m.userData.tick) m.userData.tick(now / 1000, d);
      const br = dr.barrel; if (br) { let t = null, bd = 1e9; for (const g of sim.gloom) { if (g.floor !== d.floor) continue; const dd = Math.hypot(g.x - d.x, g.z - d.z); if (dd < bd) { bd = dd; t = g; } } if (t) m.rotation.y = Math.atan2(-(t.x - d.x), -(t.z - d.z)) + Math.PI; }
      if (m.userData.tintDamage) m.userData.tintDamage(1 - d.hp / CONFIG.devices[d.kind].hp); else if (d.kind === 'panel' && m.userData.body) { const t = 1 - d.hp / CONFIG.devices.panel.hp; m.userData.body.material.color.setRGB(0.42 + 0.5 * t, 0.48 - 0.3 * t, 0.42 - 0.3 * t); }
    }
    for (const [id, m] of dMesh) if (!sim.devices.find((d) => d.id === id)) { drop(m); dMesh.delete(id); }
    for (const i in bpFlash) { bpFlash[i] -= dt; const bp = bpParts[i]; if (!bp) continue; const on = bpFlash[i] > 0 && Math.floor(bpFlash[i] * 8) % 2 === 0; for (const mm of bp.mats) mm.color.setHex(on ? 0xff2020 : bp.base); if (bpFlash[i] <= 0) delete bpFlash[i]; }
    if (catG) { catG.visible = !sim.cat.found; catArm.rotation.z = Math.sin(now / 250) * 0.6; }
    const dayNow = sim.phase === 'day', leftN = CONFIG.night.duration - sim.t; if (world && world.nightTufts) world.nightTufts(!dayNow);
    skyK += ((dayNow ? Math.min(1, Math.max(0, 1 - sim.dayT / 12)) * 0.55 : 1) - skyK) * Math.min(1, dt * 1.5); // the last 12 s of daylight redden toward dusk
    applySkyIf(skyK, dayNow ? 0 : Math.max(0, Math.min(1, 1 - leftN / 20)));
    for (const c of sim.crates) { const m = crateMesh.get(c.id); if (m) m.visible = !c.got; }
    if (state === 'play' && !paused) { const hs = dayNow ? (run ? [] : DAY_HINTS) : (drill ? [] : FINE ? NIGHT_HINTS_DESK : NIGHT_HINTS), tt = dayNow ? CONFIG.day.duration - sim.dayT : sim.t; if (hintN < hs.length && tt >= hs[hintN][0] && marlaT <= 0.01) { const h = hs[hintN++]; if (h[1].indexOf('collectors') < 0 || sim.devices.some((q) => q.kind === 'collector')) marlaHint(h[1]); }
      if (run && !sim.cat.found && sim.player.floor === 0) { const cd = Math.hypot(sim.player.x - sim.cat.x, sim.player.z - sim.cat.z); if (cd < CONFIG.cat.chimeRange) { chimeT -= dt; if (chimeT <= 0) { chime(1 - cd / CONFIG.cat.chimeRange * 0.8); chimeT = 0.4 + (cd / CONFIG.cat.chimeRange) * 1.6; } } }
      if (dayNow && run) { sty($('time'), 'color', run.bell ? '#ff6a5a' : ''); if (!run.paceTold && sim.speedMult() < 0.995) { run.paceTold = true; marlaHint('Loot is heavy: the more you carry, the slower you walk (Walk speed, top right).'); } if (!run.slowTold && sim.speedMult() < 0.8) { run.slowTold = true; queueHint(0, 'Heavy pack, Potts. You are slowing down.'); } } if (dayNow && run) { run.dayT = sim.dayT; dayHints(dt); bellCheck(sim.dayT); } }
    if (duskHold(dt, dayNow && state === 'play' && !paused)) { if (mustSolar()) flash(solarBlock(), 1); else sim.endDay(); }
    { const d = run && dayNow && sim.player.floor === 0 ? RUN.exitDoor(sim) : null, near = !!d && Math.hypot(sim.player.x - d.inX, sim.player.z - d.inZ) <= CONFIG.town.leaveRadius; sty($('bLeave'), 'display', near ? 'flex' : 'none'); }
    $('hud').classList.toggle('day', dayNow && state === 'play');
    // HUD
    sty($('hp'), 'width', (100 * p.hp / CONFIG.player.hp) + '%'); sty($('en'), 'width', (100 * p.energy / CONFIG.player.energyCap) + '%');
    H2.setClock($('time'), dayNow ? sim.dayT : leftN, !dayNow); H2.setClockBar(dayNow ? sim.dayT : leftN, !dayNow); H2.setVit($('enL'), p.energy, !dayNow, 100 * p.hp / CONFIG.player.hp);
    H2.setCount($('count'), [dayNow ? ['Crates left', sim.crates.filter((c) => !c.got).length] : null, ['Food', sim.food], ['Essentials', sim.ess], [CONFIG.ui.sun, Math.round(p.energy), 1], dayNow && run ? ['Walk speed', Math.round(100 * sim.speedMult()) + '%'] : null, ['Floor', (p.floor + 1) + ' of ' + sim.L]]);
    setText('coins', sim.coins ? 'Lucky cat found' : '');
    { for (const q in DEVN) DEVN[q] = 0; for (const q of sim.devices) { DEVN[q.kind] = (DEVN[q.kind] || 0) + 1; const gr = CONFIG.devices[q.kind].group; if (gr) DEVN['g:' + gr] = (DEVN['g:' + gr] || 0) + 1; }
      const sk = slotKinds(), list = [['b0', 'collector', 'Solar', 'Q']]; for (let i = 0; i < 5; i++) list.push(['b' + (i + 1), sk[i] || null, sk[i] ? CONFIG.devices[sk[i]].name : '', String(i + 1)]);
      for (const [id, kind, key, hot] of list) {
        const el = $(id); el.classList.toggle('sel', id === 'b' + (selSlot + 1)); if (!kind) { if (el.style.display !== 'none') el.style.display = 'none'; continue; } if (el.style.display === 'none') el.style.display = '';
        if (el.dataset.k !== kind) { el.dataset.k = kind; el.style.setProperty('--ic', 'url(' + H2.ICON(kind) + ')'); }
        const dcfg = CONFIG.devices[kind], gm = dcfg.group ? CONFIG.groupMax[dcfg.group] : dcfg.max, n = dcfg.group ? (DEVN['g:' + dcfg.group] || 0) : (DEVN[kind] || 0), full = !!gm && n >= gm, poor = !full && p.energy < dcfg.cost, line = id === 'b0' && !FINE && !full ? CONFIG.firstSolar.btnP : dayNow && id !== 'b0' ? 'at night' : full ? 'max ' + gm : poor ? H2.SUNNO + 'need ' + dcfg.cost : H2.sunCost(dcfg.cost), txt = '<i class="ic"></i><span class="dn">' + key + '</span> <span class="dl">' + line + '</span>' + (gm ? ' <span class="cnt">' + n + '/' + gm + '</span>' : ''); // panel fix: picture, ONE line (cost in Sun with its icon, or what stops you), the count as a corner badge
        if (el.dataset.t !== txt) { el.innerHTML = txt; el.dataset.t = txt; }
        el.classList.toggle('poor', poor && !(dayNow && id !== 'b0')); el.classList.toggle('full', full);
        // (R4 worker 5, item 5: diagnose 9 drill, MutationObserver: b0-b3 'class' rewritten 745 times in 12 s) classList.remove always rewrites the attribute (DOM spec
        // update steps), so it runs only when the class is there
        if (el.classList.contains('dim')) el.classList.remove('dim');
      }
      const et = '<i class="ic"></i>' + B.eatLabel(sim.food, !FINE), eb = $('bEat'); if (eb.dataset.t !== et) { eb.innerHTML = et; eb.dataset.t = et; } }
  }
  if (!paused && state !== 'end') for (let i = debris.length - 1; i >= 0; i--) { const q = debris[i]; q.t -= dt; q.vy -= 9 * dt; q.m.position.x += q.vx * dt; q.m.position.y = Math.max(q.y0, q.m.position.y + q.vy * dt); q.m.position.z += q.vz * dt; q.m.rotation.x += dt * 6; if (q.grow) { q.vy += 9 * dt * 0.94; q.m.scale.multiplyScalar(1 + q.grow * dt); } if (q.t <= 0) { opDone(q.m); debris.splice(i, 1); } }
  if (!paused && state !== 'end') for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].t -= dt; if (tracers[i].t <= 0) { opDone(tracers[i].l); tracers.splice(i, 1); } }
  hurtT = Math.max(0, hurtT - dt); sty($('hurt'), 'opacity', String(hurtT * 2.5));
  tickHud(dt); tickAim(dt); tickCharge(dt);
  lfMark('logic'); sky.follow(cam, world ? world.g.rotation.y : 0, dt); draw(); lfMark('draw'); endSnap();
  if (sim && run) tickDormant(sim.phase === 'night');
  if (sim && state === 'play') { hands.update(paused ? 0 : dt, Math.hypot(stick.x, stick.y) > 0.1 || keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD, sim.player.energy / CONFIG.player.energyCap, sim.phase === 'night'); (window.__noHands || holdDraw || hands.render(renderer, cam.aspect)); }
  lfMark('hands'); lfEnd();
}
function endScreen() {
  state = 'end'; $('bLeave').style.display = 'none'; $('time').style.color = ''; const lm = fromBase && save ? B.lootMult(CONFIG, save) : 1, r = { ...sim.result, food: Math.round(sim.result.food * lm), essentials: Math.round(sim.result.essentials * lm) }; const opens = fromBase && r.win && save && (save.ringOpen || 1) < Math.min(CONFIG.ring.mult.length, r.ring + 2) ? '. Ring ' + (r.ring + 2) + ' is now open' : (fromBase && r.win && save && r.ring + 1 >= CONFIG.ring.mult.length && !save.cleared ? ((save.cleared = save.day), '. You held the farthest ring: the settlement can grow again. That is the end of this demo; you can keep playing') : ''); $('marla').textContent = ''; $('hs').textContent = ''; marlaT = 0; hsT = 0;
  $('endTitle').textContent = r.win ? 'Dawn. You held the house.' : (sim.left ? (sim.leftDay ? 'You went home before dark.' : 'You left the night.') : 'The night took you.');
  $('again').textContent = fromBase ? 'Back to the base' : 'Back';
  $('endBody').textContent = r.win ? 'Marla: "Still standing, Potts? Good. Hmph." ' + `Brought home: ${r.food} food (ate ${r.eaten}), ${r.essentials} essentials` + (r.collectors ? ` (${r.collectors} collector${r.collectors > 1 ? 's' : ''} saved)` : '') + (r.coins ? '. You found the lucky cat' : '') + (lm > 1 && r.win ? '. Misfortune cat at home: loot x' + lm : '') + opens : (sim.left ? 'Marla: "Leaving already, Potts? Hmph." ' : 'Marla: "Up you get. The sun owes us a rematch." ') + `Minimum payout: ${r.food} food` + '';
  if (sim.result && sim.result.boss) $('endBody').textContent += bossEndLine(sim.result, lm); // the boss's bonus (src/bosshi.js)
  $('hud').style.display = 'none'; $('end').style.display = 'flex';
  // bank the night at once (so a reload on this screen cannot lose or replay it)
  if (fromBase && save && !sim.banked) { sim.banked = true; const f0 = save.food, e0 = save.essentials, ro0 = save.ringOpen || 1, r = B.applyNight(CONFIG, save, sim.result, sim.killed); persist(); $('endBody').textContent += ' ' + B.nightFoodLine(CONFIG, save.food, sim.eaten || 0); homeMsg = 'Day ' + save.day + '. Home: +' + (save.food - f0) + ' food, +' + (save.essentials - e0) + ' essentials (run plus ' + r.passive.food + ' food from gatherers, ' + r.passive.essentials + ' essentials from hunters).' + (sim.result.win && (save.ringOpen || 1) > ro0 ? ' Ring ' + Math.min(CONFIG.ring.mult.length, sim.result.ring + 2) + ' is open.' : '') + (r.research ? ' Research finished: ' + r.research + '!' : ''); { const lvl = Math.min(CONFIG.base.growth.max, (save.ringOpen || 1) - 1 + (save.cleared ? 1 : 0)); if (lvl > (save.grown || 0)) { save.grown = lvl; persist(); homeMsg += ' The settlement grows: a new solar sapling and flower bed stand by the plaza (' + lvl + ' of ' + CONFIG.base.growth.max + ').'; } } }
}
requestAnimationFrame(frame);
// (worker 7, guidecheck TimeoutError 44529552521) setBase also takes the USE target at the new spot at once: a slow frame (1.2-1.7 s in software GL) left the old spot's target for USE
window.__game = { liveShapes, marlaStreak, marlaNightTips, get cam() { return cam; }, get yaw() { return yaw; }, get mouseHeld() { return mouseHeld(); }, hands, marla, sky, bview, B, devVisible: (id) => { const m = dMesh.get(id); return m ? m.visible : null; }, deviceSample: (k, x, z, ry, v2) => { const o = (v2 && BT.device(k, CONFIG)) || PR.deviceMesh(k, CONFIG); if (o.userData.tick) o.userData.tick(2, null); o.position.set(x, 0, z); o.rotation.y = ry || 0; scene.add(o); return true; }, gloomTris: (k) => GK.gloomTris(k), glights, captions: () => { let n = 0; for (const m of gMesh.values()) m.traverse((o) => { if (o.isSprite && o.visible && o.renderOrder === 9) n++; }); return n; }, catSample: (si, x, z, ry, sc) => { const o = PR.catMesh(CONFIG.catStyles[si]).g; o.position.set(x, 0, z); o.rotation.y = ry || 0; o.scale.setScalar(sc || 1); scene.add(o); return true; }, gloomSample: (kind, x, z, ry, t, dormant) => { const o = GK.gloomMachine(kind, { dormant }); o.position.set(x, 0, z); o.rotation.y = ry || 0; if (t !== undefined) o.userData.anim(t, null); scene.add(o); window.__lastSample = o; return true; }, get dormant() { return dormG; }, get kitOpen() { return kitOpen; }, closeKit, get world() { return world; }, drawCalls: () => { renderer.render(scene, cam); return renderer.info.render.calls; }, get sim() { return sim; }, get save() { return save; }, enterBase: () => { save = B.loadSave(CONFIG, null); enterBase(); }, reBase: () => enterBase(), voiceCount: () => voiceN, voiceWav: async (kind, line) => { const oc = new OfflineAudioContext(1, 44100 * 8, 44100), g0 = oc.createGain(); g0.gain.value = 0.8; g0.connect(oc.destination); const end = voiceInto(oc, g0, kind, line); const buf = await oc.startRendering(), d = buf.getChannelData(0), n = Math.min(d.length, Math.ceil(end * 44100)); let pk = 0; const out = new Array(n); for (let i = 0; i < n; i++) { out[i] = Math.round(d[i] * 32767); pk = Math.max(pk, Math.abs(d[i])); } return { n, pk, data: out }; }, introAt: (t) => { if (intro) intro.t = t; }, startIntro: () => { save = B.loadSave(CONFIG, null); startIntro(); }, openPanel: (k) => openPanel(k), openScout: () => { curTarget = { kind: 'scout' }; doUse(); }, music: () => ({ cur: mus.cur, on: mus.on, playing: Object.keys(mus.el).filter((k) => !mus.el[k].paused && mus.el[k].volume > 0.02), t: Object.fromEntries(Object.keys(mus.el).map((k) => [k, +mus.el[k].currentTime.toFixed(1)])) }), doUse, get target() { return curTarget; }, setBase: (x, z) => { bp.x = x; bp.z = z; if (state === 'base' && bview && !paused) { const u = bview.update(0, bp.x, bp.z, 1.6); curTarget = u.target; baseU = u; } }, start: () => start(false), doFire, doPlace, endDay: () => sim && sim.endDay(), get run() { return run; }, gpu: () => ({ ...renderer.info.memory }), startRun: () => startRun(), enterHouse: (i) => enterHouse(i), leaveHouse: () => leaveHouse(), setTown: (x, z) => { if (run) { run.px = x; run.pz = z; } }, nightfall: () => nightfall(), setYaw: (y) => { yaw = y; }, fire: () => doFire(), wakeDormant: (i, how) => wakeDormant(i, how || 'shot'), say: (t) => marlaHint(t), mapInfo: () => mapInfo, sunPop: (n) => sunPop(n), drillInfo: () => (drill ? { step: drill.held ? (drill.todo[drill.i] || {}).id : 'wait', i: drill.i, left: drill.todo.length - drill.i, sel: selSlot, kinds: slotKinds().length, paused } : null), cfg: () => CONFIG, setPitch: (v) => { pitch = v; }, get state() { return state; } };
// test hooks for tools/workshopcheck.cjs: where you stand in the base, the workshop-line timer
window.__game.basePos = () => ({ x: bp.x, z: bp.z, yaw });
// test hooks for tools/freshfixcheck.cjs: the drill machine's opening (index, degrees off your view when it came), and the waking prompt's text
window.__game.drillFrom = () => (drill && drill.from ? { bp: drill.from.bp, ang: drill.from.ang } : null);
// Marla's voice for the checks (tools/voicecheck.cjs): clips started (n), the last clip id and its shown text, how it played, playing now, Voice on
window.__game.marlaVoice = () => ({ n: MV.hook.n, last: MV.hook.last, lastText: MV.hook.lastText, via: MV.hook.via, playing: MV.hook.playing, on: MV.on, allowed: MV.allowed, duck: MV.duck() });
window.__game.wakeText = () => wakeT; window.__game.uiNow = () => ui; window.__game.isPaused = () => paused; window.__game.setPause = (v) => setPause(v);
window.__game.wsTip = () => wsTipT;
// the automatic step-down (tools/perfcheck.cjs): its state, and take the next step now
// (H, test hooks for tools/premortem.cjs, read-only but endNight) endNight(win): the night ends now through the game's own end (sim.endNow; the end screen follows on
// the next frame); audioState: the game's AudioContext state ('none' before the first click); basePeople: each base person (villagers, recruits, Marla) with id,
// world place and a pose checksum (the sum of its bones' turns), for the kept-base reset check
// (H round 2, test hook) the same frame drawn as now and with the one-pass / two-group changes undone (src/mergestatic.js): mean and largest per-channel difference
// (0-255) over the canvas, and how many meshes and materials were involved; everything is put back
// (R4 item A, card 26) the house lamps as shader data vs the same lamps as THREE point lights, same frame: a = shader lamps, a2 = the same again (noise),
// b = shader lamps off and THREE.PointLights put at the same places with the same colour, intensity, reach and decay, none = no lamps at all (shows the lamps light it)
window.__game.houseLampPixelTest = () => { const grab = () => { const c = document.createElement('canvas'); c.width = cvs.width; c.height = cvs.height; const x = c.getContext('2d'), N = performance.now, R = Math.random; let q = 7; performance.now = () => 1000; Math.random = () => { q = (q * 9301 + 49297) % 233280; return q / 233280; }; try { renderer.render(scene, cam); } finally { performance.now = N; Math.random = R; } x.drawImage(cvs, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const st0 = houseLampState(), a = grab(), st = houseLampState(), used = houseLampsDrawn(), a2 = grab(), pl = []; let b, none;
  try { houseLampsForceOff(true); none = grab(); for (const o of used) { const l = new THREE.PointLight(o.color.getHex(), o.intensity, o.distance, 2); o.getWorldPosition(l.position); scene.add(l); pl.push(l); } b = grab(); }
  finally { houseLampsForceOff(false); for (const l of pl) { scene.remove(l); l.dispose(); } }
  const cmp = (x, y) => { let sum = 0, mx = 0, n = 0; for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - y[i]); sum += d; if (d > mx) mx = d; if (d > 8 && i % 4 !== 3) n++; } return { mean: +(sum / x.length).toFixed(4), max: mx, over8: n }; };
  return { lamps: st.drawn, listed: st0.listed, stand: pl.length, change: cmp(a, b), noise: cmp(a, a2), lampLight: cmp(a, none), size: [cvs.width, cvs.height] }; };
window.__game.houseLampState = houseLampState;
// (owner decision 23:24, test hook) the same frame drawn with Marla's lights as before (on the street's light set) and with them lighting only her (marlaOwnLight):
// time and random held, every shadow map drawn for both; returns both pictures (PNG data) and the per-channel difference (0-255) over the canvas
window.__game.marlaLightPixelTest = () => { const C = CONFIG.lag.marlaOwnLight, on0 = C.on, N = performance.now, R = Math.random;
  const grab = (v) => { C.on = v; marlaSync(); let q = 7; performance.now = () => 1000; Math.random = () => { q = (q * 9301 + 49297) % 233280; return q / 233280; };
    try { renderer.shadowMap.needsUpdate = true; ML.sh = true; if (fx && fx.render) fx.render(); else { renderer.render(scene, cam); marlaPass(); } } finally { performance.now = N; Math.random = R; }
    const c = document.createElement('canvas'); c.width = cvs.width; c.height = cvs.height; const x = c.getContext('2d'); x.drawImage(cvs, 0, 0); return { url: c.toDataURL('image/png'), d: x.getImageData(0, 0, c.width, c.height).data }; };
  let a, a2, b; try { a = grab(false); a2 = grab(false); b = grab(true); } finally { C.on = on0; marlaSync(); }
  const cmp = (x, y) => { let sum = 0, mx = 0, n = 0; for (let i = 0; i < x.length; i++) { if (i % 4 === 3) continue; const d = Math.abs(x[i] - y[i]); sum += d; if (d > mx) mx = d; if (d > 0) n++; } return { mean: +(sum / x.length).toFixed(4), max: mx, changed: n }; };
  return { split: ML.lights.length, before: a.url, after: b.url, change: cmp(a.d, b.d), noise: cmp(a.d, a2.d), size: [cvs.width, cvs.height] }; };
// (R4 item I, card 30) every skinned character piece that is frustum culled (src/lod.js cullSkinned: Marla, the villagers, the recruits) is checked against its
// pose this frame: the posed vertices' sphere (SkinnedMesh.computeBoundingSphere) must lie inside the grown sphere the culling uses, so a piece can never be
// culled while any of it is on screen. Returns the pieces checked, how many stuck out, the worst overshoot (m) and its name.
window.__game.skinCullCheck = () => { let n = 0, bad = 0, worst = 0, who = ''; const c = new THREE.Vector3();
  scene.traverse((o) => { if (!o.isSkinnedMesh || !o.frustumCulled || !o.boundingSphere || !o.skeleton || o.userData.mergedDraw) return; let v = o; while (v && v.visible) v = v.parent; if (v) return;
    const keep = o.boundingSphere; o.boundingSphere = null; o.computeBoundingSphere(); const posed = o.boundingSphere; o.boundingSphere = keep; n++;
    const over = c.copy(posed.center).distanceTo(keep.center) + posed.radius - keep.radius; if (over > 0) { bad++; } if (over > worst || !who) { worst = Math.max(worst, over); who = (() => { const w = []; for (let q = o; q && w.length < 5; q = q.parent) w.push(q.name || q.type); return w.join(' < '); })() + ' posed c ' + posed.center.toArray().map((v) => v.toFixed(2)).join(',') + ' r ' + posed.radius.toFixed(2) + ' cull c ' + keep.center.toArray().map((v) => v.toFixed(2)).join(',') + ' r ' + keep.radius.toFixed(2) + ' bindMode ' + o.bindMode + ' bones ' + o.skeleton.bones.length; } });
  return { n, bad, worst: +worst.toFixed(4), who }; };
// (R4 item H, card 29) a machine with its still parts frozen (freezeStillBones) vs the same machine without, posed alike at several times, drawn alone from four
// sides into a 256 px target: per kind the changed pixels (over 8 of 255) and the largest change, and how many of its parts were frozen
window.__game.freezePixelTest = (kinds) => { const out = {}, rt = new THREE.WebGLRenderTarget(256, 256), sc = new THREE.Scene(), c2 = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(3, 5, 2); sc.add(dl); const pt = renderer.getRenderTarget();
  // the same machine drawn before and after its parts are frozen (one difference), and drawn twice before (noise)
  // Math.random and the clock held to the same values for every set of shots (some kinds' poses use them: ticks, lurcher)
  const shots = (m) => { const all = [], R = Math.random, N = performance.now; let q = 7; Math.random = () => { q = (q * 9301 + 49297) % 233280; return q / 233280; }; performance.now = () => 1000; try { sc.add(m); for (const t of [0.4, 1.3, 2.2, 3.7]) { m.position.set(0, 0, 0); m.userData.anim(t, { x: 0.6, z: 1.4 }); m.updateMatrixWorld(true);
      for (let v = 0; v < 4; v++) { const a = v * Math.PI / 2; c2.position.set(Math.sin(a) * 4.5, 1.6, Math.cos(a) * 4.5); c2.lookAt(0, 1.1, 0); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, c2); const b = new Uint8Array(256 * 256 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 256, 256, b); all.push(b); } } sc.remove(m); } finally { Math.random = R; performance.now = N; } return all; };
  const cmp = (x, y) => { let worst = 0, over = 0; for (let k = 0; k < x.length; k++) for (let i = 0; i < x[k].length; i++) { const d = Math.abs(x[k][i] - y[k][i]); if (d > worst) worst = d; if (d > 8) over++; } return { over8: over, max: worst }; };
  try { for (const k of kinds || Object.keys(CONFIG.gloom.kinds)) { const A = gloomMesh({ kind: k, hp: 1, maxhp: 1 }); if (!A.userData.anim) { out[k] = 'no anim'; continue; }
      shots(A); const s0 = shots(A), s0b = shots(A), pr = (j) => A.userData.anim(-(1 + j * 0.73), { x: j * 0.11, z: j * 0.07 });
      // and the skinning matrices themselves: every node's pose kept, the parts frozen, the same pose put back, the bone matrices compared (largest difference)
      A.userData.anim(2.9, { x: 0.3, z: 1.1 }); const nodes = []; A.traverse((o) => nodes.push(o)); const st = nodes.map((o) => [o.position.clone(), o.quaternion.clone(), o.scale.clone()]), sk = []; A.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) sk.push(o); });
      A.updateMatrixWorld(true); const bm0 = sk.map((m) => { m.skeleton.update(); return Float32Array.from(m.skeleton.boneMatrices); });
      const fz = freezeStillBones(A, pr, CONFIG.lag.mergeGloom.probes); nodes.forEach((o, i) => { o.position.copy(st[i][0]); o.quaternion.copy(st[i][1]); o.scale.copy(st[i][2]); o.updateMatrix(); }); A.updateMatrixWorld(true);
      let bd = 0; sk.forEach((m, i) => { m.skeleton.update(); const b1 = m.skeleton.boneMatrices; for (let j = 0; j < b1.length; j++) bd = Math.max(bd, Math.abs(b1[j] - bm0[i][j])); });
      const s1 = shots(A);
      out[k] = { frozen: fz, views: s0.length, change: cmp(s0b, s1), noise: cmp(s0, s0b), boneMax: +bd.toExponential(2) }; drop(A); } }
  finally { renderer.setRenderTarget(pt); rt.dispose(); } return out; };
window.__game.twoPassPixelTest = () => { const grab = () => { const c = document.createElement('canvas'); c.width = cvs.width; c.height = cvs.height; const x = c.getContext('2d'); renderer.render(scene, cam); x.drawImage(cvs, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const a = grab(), a2 = grab(), undo = [], ms = new Set(); scene.traverse((o) => { if (o.userData.twoPassOf && Array.isArray(o.material)) { undo.push([o, o.material]); o.material = o.userData.twoPassOf; } const m = o.material; if (m && !Array.isArray(m) && m.userData && m.userData.singlePassFlat && m.forceSinglePass) ms.add(m); });
  // b: both undone; bg: only the two-group meshes undone; bs: only the one-pass materials undone
  let b, bg, bs; try { bg = grab(); for (const m of ms) m.forceSinglePass = false; b = grab(); for (const [o, m] of undo) o.material = m; bs = grab(); } finally { for (const [o, m] of undo) o.material = m; for (const m of ms) m.forceSinglePass = true; }
  // also the same frame drawn twice with nothing changed (noise: anything that differs between two draws by itself), and where the changed pixels are
  const cmp = (x, y) => { let sum = 0, mx = 0, n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const W = cvs.width; for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - y[i]); sum += d; if (d > mx) mx = d; if (d > 8 && i % 4 !== 3) { n++; const px = (i >> 2) % W, py = Math.floor((i >> 2) / W); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); } } return { mean: +(sum / x.length).toFixed(4), max: mx, over8: n, box: n ? [x0, y0, x1, y1] : null }; };
  return { change: cmp(a, b), groupsOnly: cmp(a, bg), singleOnly: cmp(a, bs), noise: cmp(a, a2), groups: undo.length, single: ms.size, size: [cvs.width, cvs.height] }; };
// (H, test hook) the base the player's way, as the run-end screen's Back does: enterBase under the home card
window.__game.homeCard = () => { enterBase(); sceneCard('home'); };
window.__game.playPrograms = () => ({ n: PLAYP.n, old: PLAYP.old, at: PLAYP.at });
window.__game.endNight = (win = true) => { if (!sim || sim.done || !sim.endNow) return false; sim.endNow(win); return true; };
window.__game.audioState = () => (ac ? ac.state : 'none'); window.__game.musicCur = () => mus.cur;
window.__game.basePeople = () => { const pk = bview.peek(), out = [], v = new THREE.Vector3(), one = (id, root) => { if (!root || !root.parent) return; root.getWorldPosition(v); let sum = 0; root.traverse((q) => { if (q.isBone) sum += q.quaternion.x + q.quaternion.y * 2 + q.quaternion.z * 3 + q.quaternion.w * 4; }); out.push({ id, x: +v.x.toFixed(3), z: +v.z.toFixed(3), pose: +sum.toFixed(4) }); };
  for (const [id, c] of Object.entries(pk.chars || {})) if (c) one(id, c.root); for (const q of pk.npcs || []) one('recruit ' + (q.p && q.p.id), q.ch ? q.ch.root : q.n); if (marla) one('marla', marla.root); return out; };
// (R4, the film's 4721 ms upload of one 1024x1024 ImageBitmap, card 21) ?proglog=1 only: the same picture uploaded through the game's renderer as an ImageBitmap (as
// GLTFLoader makes it: premultiplyAlpha none, colorSpaceConversion none, flipY off) and as an <img>, twice each, timed (ms; gl.finish after each); the control
window.__game.uploadTest = async (blob) => { if (!PROGLOG) return null; const gl = renderer.getContext(), out = [], img = new Image(), u = URL.createObjectURL(blob); img.src = u; await img.decode();
  const one = (src, kind) => { const t = new THREE.Texture(src); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; const t0 = performance.now(); renderer.initTexture(t); const t1 = performance.now(); gl.finish(); out.push([kind, Math.round(t1 - t0), Math.round(performance.now() - t0)]); t.dispose(); };
  for (let k = 0; k < 2; k++) { const bm = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); one(bm, 'ImageBitmap'); bm.close(); }
  for (let k = 0; k < 2; k++) one(img, 'img'); URL.revokeObjectURL(u); return out; };
// shotAt (test hook): the scene drawn once from pose [x, y, z, yaw, pitch, fov] (the camera put back after), as a PNG data URL
window.__game.shotAt = (q) => { const P0 = cam.position.clone(), R0 = cam.rotation.clone(), F0 = cam.fov; try { cam.position.set(q[0], q[1], q[2]); cam.rotation.set(q[4] || 0, q[3], 0, 'YXZ'); if (q[5]) { cam.fov = q[5]; cam.updateProjectionMatrix(); } cam.updateMatrixWorld(); renderer.render(scene, cam); return renderer.domElement.toDataURL('image/png'); } finally { cam.position.copy(P0); cam.rotation.copy(R0); if (q[5]) { cam.fov = F0; cam.updateProjectionMatrix(); } } };
// zfightTest (owner Nov 22, z-fighting in the base): each pose drawn twice in the same frame, the solid pieces in the usual order and then in the reverse order (clock
// held). Two surfaces at the same depth show whichever is drawn last, so the pixels that differ are where surfaces fight. For a sample of those pixels the pieces under
// the pixel within `gap` m of the nearest one are listed (name, kind, colour, map, parents)
window.__game.zfightTest = (poses, gap = 0.03) => { const gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, P0 = cam.position.clone(), R0 = cam.rotation.clone(), PN = performance.now, FIX = PN.call(performance);
  const grab = (q, rev) => { performance.now = () => FIX; try { if (q) { cam.position.set(q[0], q[1], q[2]); cam.rotation.set(q[4] || 0, q[3], 0, 'YXZ'); cam.updateMatrixWorld(); } renderer.setOpaqueSort(rev ? (a, b) => (b.groupOrder - a.groupOrder) || (b.renderOrder - a.renderOrder) || (b.z - a.z) || (b.id - a.id) : null); renderer.render(scene, cam); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; } finally { performance.now = PN; renderer.setOpaqueSort(null); } };
  const rc = new THREE.Raycaster(), nd = new THREE.Vector2(), who = (o) => { const m = Array.isArray(o.material) ? o.material[0] : o.material, path = []; for (let p = o; p && path.length < 4; p = p.parent) path.push(p.name || (p.userData && (p.userData.part || p.userData.kind)) || p.type); const gp = o.geometry && o.geometry.parameters, gw = new THREE.Vector3(); o.getWorldPosition(gw); return path.join('<') + ' [' + (o.geometry ? o.geometry.type.replace('Geometry', '') : '') + (gp ? ' ' + Object.entries(gp).filter((e) => typeof e[1] === 'number').slice(0, 4).map((e) => e[0][0] + (+e[1].toFixed(2))).join(',') : '') + ' @' + gw.x.toFixed(1) + ',' + gw.y.toFixed(1) + ',' + gw.z.toFixed(1) + ' s' + o.scale.x.toFixed(2) + (o.userData.mergedDraw ? ' merged' : '') + '] ' + (m ? m.type.replace('Material', '') + ' ' + (m.color ? m.color.getHexString() : '') + (m.map ? ' map ' + ((m.map.userData && m.map.userData.tex) || m.map.name || 'yes') : '') + (m.side === 2 ? ' 2side' : m.side === 1 ? ' back' : '') + (m.polygonOffset ? ' poff' : '') : ''); };
  const res = (poses || [null]).map((q) => { grab(q, false); const a = grab(q, false), a2 = grab(q, false), b = grab(q, true); let n = 0; const hits = []; for (let i = 0; i < a.length; i += 4) { let d = 0, e = 0; for (let c = 0; c < 3; c++) { d = Math.max(d, Math.abs(a[i + c] - b[i + c])); e = Math.max(e, Math.abs(a[i + c] - a2[i + c])); } if (e || d <= 8) continue; n++; if (n % 97 === 1 && hits.length < 60) hits.push([(i / 4) % W, Math.floor(i / 4 / W)]); }
    const pairs = new Map(); rc.layers.mask = cam.layers.mask; for (const [x, y] of hits) { nd.set((x + 0.5) / W * 2 - 1, (y + 0.5) / H * 2 - 1); rc.setFromCamera(nd, cam); const hs = rc.intersectObjects(scene.children, true).filter((h) => h.object.visible && h.object.isMesh); if (!hs.length) continue; const near = hs.filter((h) => h.distance - hs[0].distance < gap).map((h) => who(h.object)); const k = [...new Set(near)].sort().join('  VS  '); pairs.set(k, (pairs.get(k) || 0) + 1); }
    return { pose: q, fighting: n, at: [...pairs.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, c]) => c + 'x ' + k) }; });
  cam.position.copy(P0); cam.rotation.copy(R0); return res; };
// baseRoomTest (needs the base built with CONFIG.lag.mergeBase.roomData false): the same frame drawn with the rooms' pieces apart, then merged; changed pixels and draw calls
window.__game.baseRoomTest = (poses, waitMs) => { if (!bview || !scene) return { err: 'no base' }; const gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, P0 = cam.position.clone(), R0 = cam.rotation.clone();
  // the clock is held while drawing (the wind reads performance.now() as it draws), so wind is the same in every picture
  const PN = performance.now, FIX = PN.call(performance); const grab = (q) => { performance.now = () => FIX; try { return grab0(q); } finally { performance.now = PN; } }, grab0 = (q) => { if (q) { cam.position.set(q[0], q[1], q[2]); cam.rotation.set(q[4] || 0, q[3], 0, 'YXZ'); } else { cam.position.copy(P0); cam.rotation.copy(R0); } cam.updateMatrixWorld(); renderer.render(scene, cam); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return [a, renderer.info.render.calls]; };
  const PS = poses || [null], A = PS.map((q) => { grab(q); grab(q); const [a, ca] = grab(q), [a2] = grab(q); return { a, a2, ca }; });
  // waitMs (control): no merge, the same real time waited instead, so what changes with time alone (wind) is seen
  const t0 = performance.now(); let x = { value: 0 }; if (waitMs) { while (performance.now() - t0 < waitMs); } else { const it = bview.mergeStillIter('rooms'); x = it.next(); while (!x.done) x = it.next(); twoPassGroups(scene); } const took = performance.now() - t0;
  const res = PS.map((q, k) => { grab(q); const [b, cb] = grab(q), { a, a2, ca } = A[k]; let noise = 0, ch = 0, max = 0, stable = 0; for (let i = 0; i < a.length; i += 4) { let d = 0, n = 0; for (let c = 0; c < 3; c++) { d = Math.max(d, Math.abs(a[i + c] - b[i + c])); n = Math.max(n, Math.abs(a[i + c] - a2[i + c])); } if (n) { noise++; continue; } stable++; if (d > 8) ch++; max = Math.max(max, d); }
    (window.__rt || (window.__rt = []))[k] = { W, H, a, b, a2 }; return { pose: q, callsApart: ca, callsMerged: cb, stable, noise, changed: ch, maxDiff: max }; });
  cam.position.copy(P0); cam.rotation.copy(R0); return { made: x.value, took: Math.round(took), res }; };
// trimJoinTest (needs a street built with CONFIG.lag.trimJoin false): the same frame drawn with the pieces apart, then joined; changed pixels and draw calls
window.__game.trimJoinTest = (which = 'both') => { if (!TRIM_RAW.length) return { err: 'no unjoined trim (build the street with trimJoin false)' }; const gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const grab = () => { renderer.render(scene, cam); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return [a, renderer.info.render.calls]; };
  grab(); grab(); const [a, ca] = grab(), [a2] = grab(); for (const t of TRIM_RAW.splice(0)) { if (which !== 'edges') joinInto(t.hg, t.feet, t.foot, true); if (which !== 'feet') joinInto(t.hg, t.edges, t.em, false); } if (world && world.worldAll) world.worldAll(world.g); twoPassGroups(scene); grab(); const [b, cb] = grab();
  let noise = 0, ch = 0, max = 0, stable = 0; for (let i = 0; i < a.length; i += 4) { let d = 0, n = 0; for (let k = 0; k < 3; k++) { d = Math.max(d, Math.abs(a[i + k] - b[i + k])); n = Math.max(n, Math.abs(a[i + k] - a2[i + k])); } if (n) { noise++; continue; } stable++; if (d > 8) ch++; max = Math.max(max, d); }
  // only pixels that are the same in two renders before the join are judged (moving things: wind, water, flicker)
  window.__tj = { W, H, a, b, a2 };
  return { px: W * H, stablePx: stable, changedOver8: ch, maxDiff: max, noisePx: noise, callsApart: ca, callsJoined: cb }; };
window.__game.filmRec = (dt, nodraw) => { if (!FILMREC) return 'off'; if (!intro) return 'done'; if (intro.prep || intro.hold) return 'hold'; const t0 = intro.t || 0; REC_NODRAW = !!nodraw; try { introFrame(dt); } finally { REC_NODRAW = false; } if (!intro) return 'done'; return intro.t > t0 + dt * 0.5 ? 'drew' : 'wait'; };
window.__game.baseFar = () => ({ pieces: BFC.recs.length, hidden: BFC.recs.filter((r) => r.cull).length }); window.__game.cardOn = () => LCARD.on; window.__game.introT = () => (intro ? intro.t : null); window.__game.filmPre = () => ({ pre: !!FILM.pre, done: !!FILM.preDone, frac: FILM.frac || 0 }); window.__game.cardStep = () => (LCARD.on ? (LCARD.kind || '') + ':' + LCARD.steps.length : ''); window.__game.frameCost = (reset) => { const n = Math.max(1, FC.n), o = { frames: FC.n }; for (const k of ['js', 'logic', 'draw', 'hands', 'shadow', 'matrix']) o[k] = +(FC[k] / n).toFixed(2); o.renderRest = +((FC.draw - FC.shadow - FC.matrix) / n).toFixed(2); if (reset) for (const k in FC) FC[k] = 0; return o; }; window.__game.uploads = () => ({ n: UPL.n, ms: Math.round(UPL.ms), bn: UPL.bn, bms: Math.round(UPL.bms), big: UPL.big.slice() }); window.__game.filmHold = () => !!(FILM.it || (intro && intro.hold)); window.__game.filmPrepInfo = () => ({ worst: Math.round(FILM.worst), ms: FILM.ms, err: FILM.err || null, compileMs: FILM.compileMs, compileCut: FILM.compileCut, modelWait: FILM.modelWait, introMs: FILM.introMs, upgradeMs: FILM.upgradeMs, titleLeft: FILM.titleLeft, compileParts: FILM.compileParts, compileSyncMax: FILM.compileSyncMax, compileSyncSum: FILM.compileSyncSum, compileNew: FILM.compileNew, compileWaitMax: FILM.compileWaitMax, drawParts: FILM.parts, drawSyncMax: FILM.drawSyncMax, gpuWaitMax: FILM.gpuWaitMax, listMs: FILM.listMs });
// the impact sound proof (tools/perfcheck.cjs, local probes): each kind rendered live and as a rendered variant through a pooled chain, RMS difference / RMS
window.__game.impactSelfTest = (ph) => impactSelfTest(44100, CONFIG.sfx.impact, !!ph, 12345);
window.__game.impactPrerender = () => IMP.prerender();
// the last card's work time (ms) and any error it swallowed (tools/perfcheck.cjs prints them)
window.__game.nightBg = () => ({ on: NBG.on, left: NBG.q.length, built: NBG.built, slices: NBG.slices, ms: Math.round(NBG.ms), khr: KHR_PAR });
window.__game.cardInfo = () => ({ twoPass: LCARD.twoPass || null, proof: LCARD.proofs[LCARD.proofs.length - 1] || null, proofs: LCARD.proofs, title: { phase: TB.phase, calls: TB.calls || 0, ms: TB.ms || 0, drawMs: TB.drawMs || 0, drawParts: TB.dn || 0, worstPart: bview.bgWorst, postMs: TB.postMs || null, slow: TB.slow || null }, ms: LCARD.ms, endT: LCARD.endT || 0, settle: LCARD.settle || null, steps: LCARD.steps || null, buildMs: LCARD.buildMs || null, err: window.__cardErr || '' });
// the shader programs built so far (tools/perfcheck.cjs: which ones are first built after the night card); name and a short key each
// (owner 12:35) which pieces use a given program id (perfcheck names the program built during a fight)
window.__game.programUsers = (ids) => { const want = new Set(ids), out = {}; const look = (o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { const pr = renderer.properties.get(m); const prog = pr && pr.currentProgram; if (prog && want.has(prog.id)) { const l = out[prog.id] || (out[prog.id] = []); if (l.length < 4) { let path = [], q = o; while (q && q !== scene && path.length < 4) { path.push(q.name || q.type); q = q.parent; } l.push(m.type + ' ' + (m.name || '') + ' col ' + (m.color ? m.color.getHexString() : '-') + (m.map ? ' map' : '') + ' on ' + path.join('<')); } } } };
  // the main scene and the hands' own scene (owner 13:10: the fight's late shader was the hands' token)
  scene.traverse(look); hands.scene.traverse(look); return out; };
window.__game.programs = (full) => (renderer.info.programs || []).map((q) => q.id + ' ' + q.name + ' ' + (full ? String(q.cacheKey) : String(q.cacheKey).replace(/,+/g, ',')));
window.__game.perfStep = () => (perf ? { ...perf.state } : null); window.__game.perfForce = () => (perf ? { ...perf.force() } : null);
window.__game.baseEvening = (t) => bview.setEvening(t);
window.__game.cfg = CONFIG;
window.__game.waterGain = () => waterSnd.gain();
window.__game.impactCount = () => ({ ...impN });
window.__game.tipKind = () => tipKind;
window.__game.catSet = (i, o) => bview.catSet(i, o);
// graphics tier readout for tools/qualitycheck.cjs: what was picked and what the renderer and the textures really use
window.__game.quality = () => { let shadow = 0, plaster = 0, plasterN = 0; const root = state === 'base' ? bview.group : world && world.g; if (root) root.traverse((o) => { if (o.isDirectionalLight && o.castShadow) shadow = Math.max(shadow, o.shadow.mapSize.x); const m0 = o.isMesh && o.material ? (Array.isArray(o.material) ? o.material[0] : o.material) : null; if (m0 && m0.map && m0.map.userData.tex === (state === 'base' ? 'render' : 'plaster')) { const m = m0; plaster = Math.max(plaster, (m.map.image && m.map.image.width) || 0); if (m.normalMap && m.normalMap.image) plasterN = Math.max(plasterN, m.normalMap.image.width); } });
  return { tier: TIER, asset: QUALITY, want: { pixelRatio: Math.min(window.devicePixelRatio || 1, Q.pixelRatio), lights: Q.lights, shadow: Q.shadowMap, baseShadow: Q.baseShadowMap, aniso: Q.aniso, fx: !!Q.fx }, by: QPICK.by, pixelRatio: renderer.getPixelRatio(), antialias: !!renderer.getContextAttributes().antialias, lights: glights.length, sky: sky.detail, shadow, wallTex: plaster, wallRelief: plasterN, hi: { ...hiState }, gpuAniso: renderer.capabilities.getMaxAnisotropy() }; };
// test hooks for tools/lorecheck.cjs: this visit's note (where, and whether the prompt shows), read it, is it open, the notes found
// test hook for tools/openingcheck.cjs: person stand-in figures visible in the base right now (the wake shot must show none)
window.__game.standInsShown = () => { let n = 0; bview.group.traverse((o) => { if (!opStandIn(o)) return; for (let q = o; q; q = q.parent) if (!q.visible) return; n++; }); return n; };
window.__game.lore = { note: () => (loreN && loreN.bp === bpGroup ? { i: loreN.i, x: loreN.x, z: loreN.z, floor: loreN.floor, top: loreN.top, prompt: loreOn } : null), read: () => openLoreNote(), open: () => loreOpen, found: () => LORE.foundList(save), ms: () => loreMs, why: () => loreWhy.slice() };
// (R4, lead's four areas, 1: GPU time) ?gputime=1 (perfcheck opens PROFILE pages with it): GPU ms per pass, measured by the GPU itself with
// EXT_disjoint_timer_query_webgl2 (TIME_ELAPSED queries, one per pass, not nested: a pass that starts inside another closes it and reopens it after).
// Passes: shadow (the shadow maps, inside a draw), main (the main scene to the screen), offscreen (the main scene into a target: the player's body shadow, the
// GTAO normal pass, card parts drawn into targets), hands (the hands' own scene), post (any other scene: GTAO and blend quads); under a card each is 'card <pass>'.
// window.__game.gpuTime(reset): { frames, ms a frame by pass, gpu (sum), disjoint (results thrown away), pending, ext } since the last reset; totals since load in .all
// (R4 worker 5) GT.cs: GPU ms by card step ('<card id>.<step index>'); GT.pf: GPU ms by frame (the last GT.keep frames, with rAF time and gap)
const GT = { on: false, ext: null, gl: null, cur: null, free: [], pend: [], acc: {}, all: {}, frames: 0, disjoint: 0, cs: {}, pf: new Map(), fr: 0, lt: 0, keep: 3000 };
(() => { try { if (!new URLSearchParams(location.search).has('gputime')) return; const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); GT.gl = gl; GT.ext = ext; if (!ext) return; GT.on = true;
  // (R4 worker 5, item 1) each query also carries the card step it ran in (card id '.' index of the step under way: LCARD.steps.length) and (item 4) the frame it ran in
  const begin = (label) => { if (GT.cur) { gl.endQuery(ext.TIME_ELAPSED_EXT); GT.pend.push(GT.cur); GT.cur = null; } if (!label || GT.pend.length > 600) return; const q = GT.free.pop() || gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); let ck = null; try { ck = LCARD.on ? LCARD.n + '.' + LCARD.steps.length : null; } catch (e) { /* label only */ } GT.cur = { q, label, ck, f: GT.fr }; };
  const card = () => { try { return LCARD.on ? 'card ' : ''; } catch (e) { return ''; } };
  const r0 = renderer.render.bind(renderer); renderer.render = function (sc, cm) { const prev = GT.cur ? GT.cur.label : null; let lb = 'post'; try { lb = card() + (sc === scene ? (renderer.getRenderTarget() ? 'offscreen' : 'main') : sc === hands.scene ? 'hands' : 'post'); } catch (e) { /* label only */ } begin(lb); try { return r0(sc, cm); } finally { begin(prev); } };
  const SM = renderer.shadowMap, s0 = SM.render.bind(SM); SM.render = function (...a) { const prev = GT.cur ? GT.cur.label : null; begin(card() + 'shadow'); try { return s0(...a); } finally { begin(prev); } };
  const poll = () => { if (!gl.isContextLost()) { while (GT.pend.length) { const e = GT.pend[0]; if (!gl.getQueryParameter(e.q, gl.QUERY_RESULT_AVAILABLE)) break; GT.pend.shift(); const ns = gl.getQueryParameter(e.q, gl.QUERY_RESULT);
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) GT.disjoint++; else { const ms = ns / 1e6; GT.acc[e.label] = (GT.acc[e.label] || 0) + ms; GT.all[e.label] = (GT.all[e.label] || 0) + ms;
        if (e.ck) GT.cs[e.ck] = (GT.cs[e.ck] || 0) + ms; const pf = GT.pf.get(e.f); if (pf) { pf.gpu += ms; pf[e.label] = (pf[e.label] || 0) + ms; } } GT.free.push(e.q); } }
    // one record a frame (rAF time, gap to the frame before), the last GT.keep frames; the GPU ms of the queries begun in it are added as they come back
    const now = performance.now(); GT.fr++; GT.pf.set(GT.fr, { t: Math.round(now), gap: Math.round(now - GT.lt), gpu: 0, card: (() => { try { return LCARD.on; } catch (e) { return false; } })() }); GT.lt = now; GT.pf.delete(GT.fr - GT.keep); GT.frames++; requestAnimationFrame(poll); };
  requestAnimationFrame(poll); } catch (e) { GT.on = false; } })();
// (R4 worker 5, item 1) PSO control (PROFILE pages): what a first draw costs the GPU process, by what changes. A new program (its own key) is linked and waited
// for, then drawn: to the screen, again, into a 64 px target, again, with Int16 positions, with an interleaved buffer, with a new 2048 px picture; after each
// draw a fence is waited for (gpuDone) and its ms kept. A first draw that costs far more than the second names per-draw-state work (Metal pipelines).
window.__game.psoTest = async () => { const out = {}, gl = renderer.getContext(), sc = new THREE.Scene(), cm = new THREE.PerspectiveCamera(50, 1, 0.1, 10); cm.position.set(0, 0, 3);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1)); const key = 'psoTest' + Math.random(), mat = new THREE.MeshStandardMaterial({ color: 0x88aa66 }); mat.customProgramCacheKey = () => key;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); sc.add(box); const t0 = performance.now(); await renderer.compileAsync(sc, cm); out.link = Math.round(performance.now() - t0);
  const pt = renderer.getRenderTarget(), ac = renderer.autoClear; const go = async (k, tg) => { renderer.setRenderTarget(tg || null); renderer.render(sc, cm); renderer.setRenderTarget(pt); out[k] = Math.round(await gpuDone(20000)); };
  try { await go('screen1'); await go('screen2'); const rt = new THREE.WebGLRenderTarget(64, 64); await go('target1', rt); await go('target2', rt); rt.dispose();
    { const g = box.geometry, q = new Int16Array(g.attributes.position.count * 3); for (let i = 0; i < q.length; i++) q[i] = Math.round(g.attributes.position.array[i] * 16000); const g2 = g.clone(); g2.setAttribute('position', new THREE.BufferAttribute(q, 3, true)); box.geometry = g2; await go('int16'); await go('int16b'); }
    { const g = new THREE.BoxGeometry(1, 1, 1), n = g.attributes.position.count, ib = new THREE.InterleavedBuffer(new Float32Array(n * 8), 8); for (let i = 0; i < n; i++) { ib.array.set([g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i), g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i), g.attributes.uv.getX(i), g.attributes.uv.getY(i)], i * 8); }
      const g3 = new THREE.BufferGeometry(); g3.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0)); g3.setAttribute('normal', new THREE.InterleavedBufferAttribute(ib, 3, 3)); g3.setAttribute('uv', new THREE.InterleavedBufferAttribute(ib, 2, 6)); g3.setIndex(g.index); box.geometry = g3; await go('interleaved'); await go('interleaved2'); }
    { const cv = document.createElement('canvas'); cv.width = cv.height = 2048; const x = cv.getContext('2d'); x.fillStyle = '#7a5'; x.fillRect(0, 0, 2048, 2048); const tx = new THREE.CanvasTexture(cv); const m2 = mat.clone(); m2.map = tx; m2.customProgramCacheKey = () => key + 'm'; box.material = m2; box.geometry = new THREE.BoxGeometry(1, 1, 1); await renderer.compileAsync(sc, cm); await go('newMapProgram1'); await go('newMapProgram2'); const tx2 = new THREE.CanvasTexture(cv); m2.map = tx2; await go('newPicture'); tx.dispose(); tx2.dispose(); m2.dispose(); } }
  catch (e) { out.err = String(e).slice(0, 120); } finally { renderer.setRenderTarget(pt); renderer.autoClear = ac; mat.dispose(); } return out; };
// (R4 worker 6, advisor item 1) SAME-FORMAT control (PROFILE pages): psoTest's 64 px target is plain RGBA8; the screen (or the picture pass's target) has its own
// samples and depth/stencil. A new program is drawn first into a 64 px target with the SCREEN's samples, depth and stencil, then the same program to the screen,
// then again to the screen; then a second new program straight to the screen (the reference). If the screen draw after the small same-format draw is as cheap as a
// second draw, the first-draw work can be done in idle time into a small target (SPREAD); if it costs a first draw again, it cannot.
window.__game.psoSameFmt = async () => { const out = {}, gl = renderer.getContext(), sc = new THREE.Scene(), cm = new THREE.PerspectiveCamera(50, 1, 0.1, 10); cm.position.set(0, 0, 3);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1)); const key = 'psoSame' + Math.random(), mat = new THREE.MeshStandardMaterial({ color: 0x6688aa }); mat.customProgramCacheKey = () => key;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); sc.add(box); const pt = renderer.getRenderTarget();
  let samples = 0; try { gl.bindFramebuffer(gl.FRAMEBUFFER, null); samples = gl.getParameter(gl.SAMPLES) || 0; } catch (e) { samples = 0; } const ca = gl.getContextAttributes() || {}; out.screen = { samples, depth: !!ca.depth, stencil: !!ca.stencil, fx: !!(fx && fx.render) };
  const go = async (k, tg) => { renderer.setRenderTarget(tg || null); renderer.render(sc, cm); renderer.setRenderTarget(pt); out[k] = Math.round(await gpuDone(20000)); };
  try { await renderer.compileAsync(sc, cm); const rt = new THREE.WebGLRenderTarget(64, 64, { samples, depthBuffer: !!ca.depth, stencilBuffer: !!ca.stencil });
    await go('sameFmtTarget1', rt); await go('screenAfter', null); await go('screen2', null); rt.dispose();
    const m2 = mat.clone(); const k2 = key + 'b'; m2.customProgramCacheKey = () => k2; box.material = m2; await renderer.compileAsync(sc, cm); await go('newProgramScreen1', null); await go('newProgramScreen2', null); m2.dispose(); }
  catch (e) { out.err = String(e).slice(0, 120); } finally { renderer.setRenderTarget(pt); mat.dispose(); } return out; };
// (R4 worker 5, item 1) GPU ms of each card's steps: [{ kind, ms, steps: [[step, CPU ms, GPU ms]] }] for the cards still in LCARD.proofs
window.__game.gpuCardSteps = () => LCARD.proofs.map((q) => ({ kind: q.kind, ms: q.ms, steps: (q.steps || []).map(([k, ms], i) => [k, ms, Math.round(GT.cs[q.id + '.' + i] || 0)]) }));
// (R4 worker 5, item 4) the frames whose rAF time is in [t0, t1] (page ms): time, gap to the frame before (ms), GPU ms in all and by pass, under a card or not
window.__game.gpuFrames = (t0, t1) => { const o = []; for (const r of GT.pf.values()) if (r.t >= t0 && r.t <= t1) { const q = { t: r.t, gap: r.gap, gpu: +r.gpu.toFixed(1) }; for (const k in r) if (!['t', 'gap', 'gpu', 'card'].includes(k)) q[k] = +r[k].toFixed(1); if (r.card) q.card = 1; o.push(q); } return o; };
window.__game.gpuTime = (reset) => { const n = Math.max(1, GT.frames), o = { frames: GT.frames, ext: GT.on ? 'EXT_disjoint_timer_query_webgl2' : (GT.gl ? 'none (extension missing)' : 'off'), disjoint: GT.disjoint, pending: GT.pend.length }; let sum = 0;
  for (const k of Object.keys(GT.acc).sort()) { o[k] = +(GT.acc[k] / n).toFixed(2); if (!k.startsWith('card ')) sum += GT.acc[k]; } o.gpu = +(sum / n).toFixed(2); o.all = Object.fromEntries(Object.entries(GT.all).map(([k, v]) => [k, Math.round(v)]));
  if (reset) { GT.acc = {}; GT.frames = 0; GT.disjoint = 0; } return o; };
// (R4, lead's four areas, 2: lights) with ?gputime=1 or ?proglog=1 the scene's light set is read every frame: the lights that draw (visible chain, by type, with
// '@0' for intensity 0 and '+shadow' for casters) and the shader lamps drawn (src/houselamps.js); each change is kept with the time, the state and whether a card
// or the film's black was up (window.__game.lightLog(); lightNow(): the set now). A change in play (no card, no black) changes shader keys during play.
const LLOG = { on: false, last: '', log: [] };
function lightNow() { const c = {}; scene.traverseVisible((q) => { if (!q.isLight) return; const k = q.type + (q.intensity === 0 ? '@0' : '') + (q.castShadow ? '+shadow' : ''); c[k] = (c[k] || 0) + 1; }); if (HL_ON) c.shaderLamps = houseLampState().drawn; return JSON.stringify(c); }
(() => { try { const u = new URLSearchParams(location.search); if (!u.has('gputime') && !u.has('proglog')) return; LLOG.on = true;
  // read every 4th frame (a whole-scene walk; a debug run only), so a change is placed within 4 frames
  let fr = 0; const tick = () => { if (fr++ % 4) { requestAnimationFrame(tick); return; } try { const s = lightNow(); if (s !== LLOG.last) { LLOG.last = s; let held = false; try { held = LCARD.on || !!(intro && intro.hold); } catch (e) { /* none */ } if (LLOG.log.length < 300) LLOG.log.push({ t: Math.round(performance.now()), state, held, lights: s }); } } catch (e) { /* none */ } requestAnimationFrame(tick); };
  requestAnimationFrame(tick); } catch (e) { LLOG.on = false; } })();
window.__game.lightLog = () => LLOG.log.slice(); window.__game.lightNow = () => lightNow();
