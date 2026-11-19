import * as THREE from 'three';
import { MUSIC } from './musicdata.js';
import { GRITTY, DESO } from './look.js';
import { placeSample } from './desolate.js';
import { applyRelief } from './relief.js';
import { TEX } from './texdata.js';
import { Q, QUALITY, QPICK, TIER, hiState, saveQuality, setGpuAniso, texLoad } from './quality.js';
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
import { buildWorld } from './world.js';
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
import { mergeStatic, HIT_LAYER, splitVariants } from './mergestatic.js';
import { gloomPreload, glbHooks, glbCopy } from './gloomglb.js';
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
let holdDraw = false, pauseDrawn = false, ctxLost = false; const MENU_EL = document.getElementById('menu') || { style: {} };
// at night inside a house only what shows through its openings is drawn (src/nightcull.js, CONFIG.lag.nightCull)
const nightCull = createNightCull();
let perf = null; const perfRest = () => { if (perf) perf.rest(); };
// desktop Gloom models (src/gloomglb.js) load per run, not at page start: every kind the ring can send (CONFIG.gloom.kinds minRing), asked for when the run starts;
// the opening film's kinds load at once for a first visit (no save yet), so the film shows the models
const FILM_KINDS = [...new Set([CONFIG.opening.grid.machine[0], ...CONFIG.opening.turning.walkers.map((w) => w[0])])];
function runModels() { const ring = +(($('selRing') || {}).value || 0), K = CONFIG.gloom.kinds; gloomPreload(Object.keys(K).filter((k) => (K[k].minRing || 0) <= ring && K[k].share > 0)); }
const glights = []; for (let i = 0; i < Q.lights; i++) { const l = new THREE.PointLight(0xffffff, 0, CONFIG.gloomLook.lightReach, 2); l.visible = false; scene.add(l); glights.push(l); }
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
  dormM = []; for (const d of run.dormant) { d.awake = 0; const o = GK.gloomMachine(d.kind, { dormant: true }); dormM.push(o); shadeUnder(o, d.r * 3.4, 0.03); o.position.set(d.x, 0, d.z); o.rotation.y = d.ry; o.traverse((m) => { if (m.isMesh && !m.material.transparent) m.castShadow = true; }); dormG.add(o);
    // LAG FIX Nov 19 (owner 11:27): its awake and its spent (powered-down) machines are built now, under the ride card, and kept out of the scene until it wakes or
    // powers down (they were built at that moment); dropped with the run (dropSleeperPre)
    d.pre = { a: sleeperBuild(d, true), s: sleeperBuild(d, false) }; }
  renderer.shadowMap.needsUpdate = true;
}
function tickDormant(night) { if (!dormG) return; dormG.visible = !night; dormG.matrixWorldAutoUpdate = !night; if (night) return; const t = performance.now() / 1000, f2 = cam.far * cam.far; for (const o of dormG.children) if (!o.userData.awake && o.position.distanceToSquared(SLV.copy(cam.position).sub(world.g.position)) < f2) o.userData.anim(t, null); } // (owner 10:50) only the sleepers within the far plane are animated
const SLV = new THREE.Vector3();
// light sleepers: by day a dormant machine wakes if you pass close with a heavy pack, lurches after you, can hit once, then powers down in the sun
function sleeperBuild(d, awake) { const o = GK.gloomMachine(d.kind, { dormant: !awake }); shadeUnder(o, d.r * 3.4, 0.03); o.position.set(d.x, 0, d.z); o.rotation.y = d.ry; o.userData.awake = !!awake; o.traverse((q) => { if (q.isMesh && !q.material.transparent) q.castShadow = true; }); return o; }
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
function buildTrim() { const T = CONFIG.trim, foot = new THREE.MeshLambertMaterial({ color: T.footColor }), em = new THREE.MeshLambertMaterial({ map: depthTex('edge'), transparent: true, opacity: T.cornerPower, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  for (const h of run.houses) { const hg = new THREE.Group(); hg.position.set(h.x, 0, h.z); hg.rotation.y = -Math.atan2(h.sn, h.cs); world.g.add(hg); const R = h.H + 0.2, top = h.L * FH;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cuts = h.sim.breaches.filter((b) => b.floor === 0 && b.type !== 'window' && Math.abs(b.nx + nx) < 0.1 && Math.abs(b.nz + nz) < 0.1).map((b) => (nx ? b.z : b.x)).sort((a, c) => a - c); let a0 = -R - T.footOut;
      const seg = (a, b2) => { if (b2 - a < 0.15) return; const o = new THREE.Mesh(new THREE.BoxGeometry(nx ? T.footOut * 2 : b2 - a, T.footH, nx ? b2 - a : T.footOut * 2), foot); o.position.set(nx ? nx * R : (a + b2) / 2, T.footH / 2, nz ? nz * R : (a + b2) / 2); o.castShadow = true; o.receiveShadow = true; hg.add(o); };
      for (const u of cuts) { seg(a0, u - CONFIG.openingHalf - 0.05); a0 = u + CONFIG.openingHalf + 0.05; } seg(a0, R + T.footOut);
      for (const s of [-1, 1]) { const o = new THREE.Mesh(wallGeo, em); o.scale.set(T.cornerW * (s > 0 ? -1 : 1), top, 1); const u = s * (R - T.cornerW / 2); o.position.set(nx ? nx * (R + 0.012) : u, top / 2, nz ? nz * (R + 0.012) : u); o.rotation.y = nx > 0 ? Math.PI / 2 : nx < 0 ? -Math.PI / 2 : nz > 0 ? 0 : Math.PI; if (nx) o.scale.x *= nx > 0 ? -1 : 1; if (nz < 0) o.scale.x *= -1; hg.add(o); } } } }
// owner's rule (Nov 19): small props cast no shadow (CONFIG.lag.smallCaster: a piece whose bounding sphere is smaller than this radius, m)
function noSmallCasters(root) { const R = CONFIG.lag.smallCaster, v = new THREE.Vector3(); root.updateMatrixWorld(true); root.traverse((o) => { if (!o.isMesh || !o.castShadow || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry) return; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); if (g.boundingSphere && g.boundingSphere.radius * o.getWorldScale(v).x < R) o.castShadow = false; }); }
function needWorld() { if (!world) { if (DESO.place && !run.desoPlaced) { placeSample(run, CONFIG); run.desoPlaced = true; } world = buildWorld(CONFIG, run); noSmallCasters(world.g); scene.add(world.g); applyRelief(world.g); buildGrounding(); buildTrim(); shadowT = 1.5; } renderer.shadowMap.needsUpdate = true; return world; } // the sun's shadows are static: drawn again only when the world is moved or its textures arrive
let sim = null, state = 'menu', roomGroup = null, catG = null, catArm = null, camY = 1.6;
const landAt = new Map(); // device id -> time its thrown pod lands: the device is drawn from then, growing in over CONFIG.hands.landGrow s
// the still street (world.g): its own matrix is set by world.frame(); every child but the day machines (dormG, they move) is skipped by the per-frame matrix pass and
// worked out again only when the street is moved or a child is added (CONFIG.lag.freezeWorld)
let frozenN = -1, frozenG = null;
function freezeWorld() { if (!CONFIG.lag.freezeWorld || !world) return; const g = world.g; if (g === frozenG && g.children.length === frozenN) return;
  g.matrixAutoUpdate = false; g.updateMatrix(); for (const c of g.children) c.matrixWorldAutoUpdate = c === dormG; g.updateMatrixWorld(true); frozenG = g; frozenN = g.children.length; }
// the night card's warm-up copies (sceneCard, warmNight below)
const warmG = new THREE.Group(); warmG.name = 'warm';
// LAG FIX Nov 19 (owner 10:35): a destroyed Gloom machine is kept, hidden, in a pool per kind and used again for the next one of that kind (a new paint shade from the
// same spread, its far copies registered again), instead of building a new one (model copy, skeleton, display canvases, decals, merge) at every spawn. The night card's
// warm-up machines start the pool. Emptied when the run's scene is cleared. CONFIG.lag.gloomPool: most kept per kind.
const gPool = {};
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
  if (roomGroup) { drop(roomGroup); roomGroup = null; }
  if (townG) { drop(townG); townG = null; }
  for (const m of crateMesh.values()) drop(m); crateMesh.clear();
  for (const q of debris) opDone(q.m); debris.length = 0; for (const q of tracers) opDone(q.l); tracers.length = 0;
  bossTick(0, null, { scene }); scrapTick(0, { scene }, true); hopsClear(); // the boss and its pieces go with the night (src/bosshi.js)
}

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
  for (let f = 0; f < sim.L; f++) { const lamp = new THREE.PointLight(0xffe0a0, CONFIG.world.lamp, sim.H * CONFIG.world.lampReach); lamp.position.set(0, f * FH + 2.6, 0); lamp.userData.roomLamp = true; roomGroup.add(lamp); }
  // no floor marks at the stairs or the ladder (user, 2026-11-14): the stairs and the ladder are real and show where to go
  const crate = (LOOK_OLD ? PR.crateMesh : BT.crateV2)('ess'); crate.scale.setScalar(2); crate.position.set(sim.cat.x + 1.1, 0.06, sim.cat.z - 1.1); roomGroup.add(crate); // the big crate the cat hides behind
  const c = PR.catMesh(CONFIG.catStyles[((run && run.inside) || 0) % CONFIG.catStyles.length]); catG = c.g; catArm = c.arm; catG.position.set(sim.cat.x, 0.06, sim.cat.z); catG.rotation.y = Math.atan2(-sim.cat.x, -sim.cat.z); // it faces the room
  roomGroup.add(catG); scene.add(roomGroup);
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
    const lamp = new THREE.PointLight(0xffe0a0, 1.1, H * 2.2); lamp.position.set(0, f * FH + 2.8, 0); roomGroup.add(lamp);
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
  roomGroup.add(catG); scene.add(roomGroup);
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
function loreSpot(rnd) {
  const L = CONFIG.lore, s = sim; world.g.updateMatrixWorld(true);
  for (const q of s.furn.filter((o) => L.spots.includes(o.kind))) {
    const o = L.onTop[q.kind] || [0, 0], c = Math.cos(q.rot), sn = Math.sin(q.rot), x = q.x + o[0] * c + o[1] * sn, z = q.z - o[0] * sn + o[1] * c, y0 = q.floor * FH;
    const h = loreHit(x, y0 + 1.6, z, 0, -1, 0, 1.6); if (!h || h.point.y - y0 < L.topY[0] || h.point.y - y0 > L.topY[1]) continue;
    return { top: true, x, y: h.point.y + 0.006, z, floor: q.floor, ry: q.rot + 0.5 };
  }
  const H = s.H, y = L.boardY;
  for (let k = 0, tries = 0; k < 24 && tries < 6; k++) {
    const wall = Math.floor(rnd() * 4), u = (rnd() * 2 - 1) * (H - 1.3), nx = wall === 2 ? 1 : wall === 3 ? -1 : 0, nz = wall === 0 ? 1 : wall === 1 ? -1 : 0, wx = nx ? nx * H : u, wz = nz ? nz * H : u;
    if (s.breaches.some((b) => b.floor === 0 && Math.hypot(b.x - wx, b.z - wz) < (b.type === 'door' ? L.doorKeep : 1.9))) continue;
    if (s.furn.some((q) => q.floor === 0 && Math.hypot(q.x - wx, q.z - wz) < q.r + 0.9)) continue;
    tries++;
    const tx = nz, tz = -nx, ok = [0].every((a) => { const h = loreHit(wx - nx * 1.2 + tx * a, y, wz - nz * 1.2 + tz * a, nx, 0, nz, 1.3); return h && h.distance > 0.93; });
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
  if (T.lights) I.lamps.slice().sort((a, b) => Math.hypot(a.x - camEnd.x, a.z - camEnd.z) - Math.hypot(b.x - camEnd.x, b.z - camEnd.z)).slice(0, 4).forEach((l) => { l.light = new THREE.PointLight(G.lampColor, G.lampLight[0], G.lampLight[1], 2); l.light.position.set(l.x, G.lamps[3] - 0.5, l.z); I.grp.add(l.light); });
}
// a light that flickers before it dies: 1 on, 0 off
function opFlick(t, off, flick) { if (t < off - flick) return 1; if (t >= off) return 0; const k = (off - t) / flick; return Math.sin(t * 47) + Math.sin(t * 23) > 0.6 - k ? 1 : 0.12; }
function opMachine(kind, dormant) { const o = GK.gloomMachine(kind, { dormant }); applyRelief(o); shadeUnder(o, CONFIG.depth.gloom, 0.03);
  // an awake machine gets a soft glow on its screen (phones have no screen lights; CONFIG.opening.grid.screenGlow)
  if (!dormant && o.userData.lamp) { const G = CONFIG.opening.grid.screenGlow, s = opGlow(o.userData.lampColor, G[0], G[1]); s.position.copy(o.userData.lamp); o.add(s); }
  return o; }
function startIntro() { gloomPreload(FILM_KINDS); bview.preChars();
  if (!CONFIG.opening.on) { startIntroOld(); return; }
  if (!save) return; clearScene(); dropWorld(); bview.dispose(); sim = null; ui = null; paused = false;
  if (save.day === 1 && !save.nights) save.scoutSpot = 4; // she is at your door when you wake
  const C = CONFIG.opening, G = C.grid; state = 'intro';
  $('menu').style.display = 'none'; $('hud').style.display = 'none'; $('cine').style.display = 'block'; $('cineFade').style.opacity = 1; $('cineCap').textContent = ''; opLids(0);
  run = RUN.createRun(CONFIG, 0, C.seed, {}); scene.fog = DESO.on ? new THREE.Fog(CONFIG.desolate.over.fogColor, CONFIG.desolate.over.fogNear, CONFIG.desolate.over.fogFar) : new THREE.Fog(0xbfe6f0, 20, 80);
  needWorld().frame(-1); skyK = G.night; applySky(skyK, 0); GK.nightGlow(1);
  const I = intro = { t: 0, part: 'town', p: 0, grp: new THREE.Group(), walkers: [], skipT: 0 }; scene.add(I.grp);
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
  if (C[QUALITY === 'high' ? 'high' : 'low'].lights) { I.devL = new THREE.PointLight(T2.light[0], 0, T2.light[2], 2); I.devL.position.set(dp.x, 0.6, dp.z); I.grp.add(I.devL); }
  { const R = G.rim, rp = opAt(I, M[1] + R[3], R[4], M[2] + R[5]); I.rim = new THREE.PointLight(R[0], 0, R[2], 2); I.rim.position.copy(rp); I.grp.add(I.rim); }
  I.fov0 = cam.fov; renderer.shadowMap.needsUpdate = true;
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
function introToBase() {
  const I = intro; if (!CONFIG.opening.on) { introToBaseOld(); return; } I.part = 'base'; if (I.grp) { scene.remove(I.grp); drop(I.grp); I.grp = null; } I.walkers = [];
  dropWorld(); run = null; GK.nightGlow(0); glights.forEach((l) => { l.intensity = 0; l.visible = false; }); hemi.color.setHex(CONFIG.baseLight.sky); hemi.groundColor.setHex(CONFIG.baseLight.ground); sky.mesh.visible = false;
  scene.background = new THREE.Color(0xbfe6f0); scene.fog = new THREE.Fog(0xf6e8c8, 30, 95); if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure;
  bview.build(save); applyRelief(bview.group); I.hide = []; I.stands = []; bview.group.traverse((o) => { if (o.isSprite && o.renderOrder === 10) o.material.opacity = 0; if (o.isSprite && o.userData.kind) I.hide.push(o); if (o.isDirectionalLight && !I.sun) I.sun = o; if (opStandIn(o)) I.stands.push(o.parent); }); renderer.shadowMap.needsUpdate = true; shadowT = 1.5;
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
  let lid = 0; const L = K.lids; for (let i = 0; i < L.length - 1; i++) if (w >= L[i][0] && w <= L[i + 1][0]) lid = L[i][1] + (L[i + 1][1] - L[i][1]) * OP_SM((w - L[i][0]) / (L[i + 1][0] - L[i][0])); if (w > L[L.length - 1][0]) lid = L[L.length - 1][1];
  opLids(lid); sty(cvs, 'filter', QUALITY === 'high' && w < K.blur[1] ? 'blur(' + (K.blur[0] * (1 - w / K.blur[1])).toFixed(2) + 'px)' : '');
}
function finishIntro() {
  if (!intro) return; if (!CONFIG.opening.on) { finishIntroOld(); return; } if (intro.part === 'town') introToBase(); const I0 = intro; intro = null; opLids(0); cvs.style.filter = '';
  for (const o of (I0.hide || []).concat(I0.stands || [])) o.visible = true; if (I0.fov0 && cam.fov !== I0.fov0) { cam.fov = I0.fov0; cam.updateProjectionMatrix(); }
  scene.background = new THREE.Color(0xbfe6f0); scene.fog = new THREE.Fog(0xf6e8c8, 30, 95); hemi.intensity = CONFIG.baseLight.power; hemi.color.setHex(CONFIG.baseLight.sky); if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure;
  $('cine').style.display = 'none'; state = 'base'; ui = null; bp = { x: -0.6, z: -9.3 }; bview.group.traverse((o) => { if (o.isSprite && o.renderOrder === 10) o.material.opacity = 1; }); const sp = B.scoutPos(save); yaw = Math.atan2(-(sp.x - bp.x), -(sp.z - bp.z)); pitch = 0; camY = 1.6; cam.rotation.set(0, yaw, 0, 'YXZ');
  $('hud').style.display = 'block'; $('hud').className = 'base'; $('bFire').textContent = 'USE'; save.seenIntro = true; persist(); flash('Dawn, day ' + save.day + '. Marla is ' + sp.hint + '. Talk to her to ride out. They say a lucky cat hides somewhere in the base.', 2); jobCard(); }
function introFrame(dt) {
  if (!CONFIG.opening.on) { introFrameOld(dt); return; }
  const I = intro, C = CONFIG.opening, P = C.parts; I.t += dt; const t = I.t;
  let cap = ''; for (const [a, z, tx] of C.lines) if (t >= a && t <= z) cap = tx; const ce = $('cineCap'); if (ce.textContent !== cap) ce.textContent = cap; ce.classList.toggle('who', /^MARLA/.test(cap));
  const part = t < P[1] ? 0 : t < P[2] ? 1 : t < P[3] ? 2 : 3, fade = Math.max(0, 1 - (t - P[part]) / C.fade, part === 3 ? 0 : 1 - (P[part + 1] - t) / C.fade);
  // the film's last frame still moves the base's people (from the bed, where the wake's camera is), so they do not stand still for one frame as you take over
  if (t >= P[4]) { if (part === 3) bview.update(dt, -0.6, -9.3, 1.6); finishIntro(); return; }
  if (part >= 2 && I.part === 'town') introToBase();
  // the wake waits (eyes shut) for the people's models, at most CONFIG.opening.wake.waitModels s; stand-ins left are hidden (opStands)
  if (part === 3 && t - P[3] < 0.5 && opStands(I) > 0 && (I.waitT = (I.waitT || 0) + dt) < C.wake.waitModels) { I.t = P[3]; }
  if (part === 0) opGrid(I, t); else if (part === 1) opTurning(I, t, dt);
  if (part <= 1) { sky.follow(cam, 0, dt); sty($('cineFade'), 'opacity', String(Math.max(0, Math.min(1, fade)))); musicTick(dt); draw(); if (part === 1 && C.turning.hands > 0) { hands.update(dt, false, C.turning.hands, true); hands.render(renderer, cam.aspect); } return; }
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
  run = RUN.createRun(B.makeCfg(CONFIG, save), +$('selRing').value, (() => { try { const q = new URLSearchParams(location.search).get('seed'); if (q) return +q; } catch (e) { /* no address */ } return (Math.random() * 1e9) | 0; })(), { gloomMult: B.gloomMult(CONFIG, save), extraEnergy: B.nightEnergyBonus(CONFIG, save) });
  if (CONFIG.boss && CONFIG.boss.on && run.ring === CONFIG.boss.ring) bossPreload(); // desktop: the boss model loads while you walk the street (src/bosshi.js)
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
function mustSolar() { return !!(run && sim && fromBase && save && !save.solarDone && !(save.nights > 0) && sim.phase === 'day'); }
function leaveHouse() { if (!run || !sim || state !== 'play' || paused) return; if (mustSolar()) { flash(solarBlock(), 1); return; } const h = run.houses[run.inside]; if (!RUN.leave(run)) return; if (save && (save.nights || 0) < 2 && !run.toldPick) { run.toldPick = true; queueHint(1, 'More openings, more Gloom. Pick where you stand.'); } sim = null; yaw = h.row < 0 ? Math.PI : 0; pitch = 0; enterTown(); } // step out facing the street
function nightfall(byHold) { if (!run) return; perfRest(); if (byHold && mustSolar()) { flash(solarBlock(), 1); return; } if (!sim) { const h = facedHouse() || RUN.nearest(run, run.px, run.pz); run.caught = !byHold; enterHouse(byHold ? h.i : RUN.nearest(run, run.px, run.pz).i, true); } sim.endDay(); }
// the house whose door you are looking at (within range and a narrow angle), else null
function facedHouse() { const T = CONFIG.town, fx = -Math.sin(yaw), fz = -Math.cos(yaw); let best = null, ba = T.faceAngle; for (const h of run.houses) { const dx = h.doorX - run.px, dz = h.doorZ - run.pz, d = Math.hypot(dx, dz); if (d > T.infoRange || d < 0.01) continue; const a = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))); if (a < ba) { ba = a; best = h; } } return best; }
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
  sim = createSim(fromBase ? { cfg: B.makeCfg(CONFIG, save), ring, house, seed: (Math.random() * 1e9) | 0, gloomMult: B.gloomMult(CONFIG, save), extraEnergy: B.nightEnergyBonus(CONFIG, save), day: true } : { cfg: CONFIG, ring, house, seed: (Math.random() * 1e9) | 0 });
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
try { if (!(storage && storage.getItem('solardg.save'))) gloomPreload(FILM_KINDS); } catch (e) { gloomPreload(FILM_KINDS); }
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
function enterBase(intro) { perfRest();
  clearScene(); dropWorld(); sim = null; run = null; hintQ.length = 0; ui = null; state = 'base'; hemi.intensity = CONFIG.baseLight.power; hemi.color.setHex(CONFIG.baseLight.sky); hemi.groundColor.setHex(CONFIG.baseLight.ground);
  if (CONFIG.render.tone) renderer.toneMappingExposure = CONFIG.render.exposure;
  sky.mesh.visible = false; scene.background = new THREE.Color(0xbfe6f0); scene.fog = new THREE.Fog(0xf6e8c8, 30, 95);
  $('marla').textContent = ''; $('hs').textContent = ''; marlaT = 0; hsT = 0; $('bLeave').style.display = 'none'; $('time').style.color = '';
  (bview.build(save), applyRelief(bview.group), noSmallCasters(bview.group), bview.mergeStill(), renderer.shadowMap.needsUpdate = true, shadowT = 1.5); bp = { x: 3, z: 7 }; yaw = 0; pitch = 0; camY = 1.6;
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
  if (state !== 'base' || ui || paused || !curTarget) return;
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
    else if (a === 'rec') { const g = B.recruit(CONFIG, save); flash(g.msg, true); if (g.ok) (bview.build(save), renderer.shadowMap.needsUpdate = true, shadowT = 1.5); }
    else if (a === 'role') { B.cycleRole(save, +id); (bview.build(save), renderer.shadowMap.needsUpdate = true, shadowT = 1.5); }
    else if (a === 'buy') flash(B.startResearch(CONFIG, save, id).msg, true);
    else if (a === 'help') flash(B.helpResearch(CONFIG, save).msg, true);
    else if (a === 'egg') { flash(B.placeEgg(CONFIG, save).msg, true); bview.refreshAvians(); }
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
function tickHud(dt) { keysAuto(); tickBar(dt); tickWake(); tickDrillUi(); tickChips(); musicTick(dt); marlaNightTips(dt); flashT = Math.max(0, flashT - dt); if (flashT <= 0) setText('msg', ''); marlaT = Math.max(0, marlaT - dt); if (marlaT <= 0) setText('marla', ''); $('marla').classList.toggle('face', !!sim && sim.phase === 'night'); H2.mode(!!sim && sim.phase === 'night' && state === 'play'); tickArc(); hsT = Math.max(0, hsT - dt); if (hsT <= 0) setText('hs', ''); }
function chime(v) { const a = audio(); if (!a) return; const t = a.currentTime; [1318, 1760].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.14 * v, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5); o.connect(g); g.connect(a.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.55); }); }
$('lookT').textContent = 'Look: ' + (GRITTY ? 'realistic worn' : 'painted (old)') + ' - tap to switch'; $('lookT').onclick = () => { try { localStorage.setItem('dawnpunk.look', GRITTY ? 'painted' : 'gritty'); } catch (e) { /* not kept */ } location.href = location.href.split('?')[0]; };
// graphics tier (src/quality.js, CONFIG.quality): the title link and the pause-menu button switch it; the choice is saved and the page reloads, because edge smoothing and the texture set are fixed when the page starts
// the button cycles medium (the default) -> high -> low -> medium (owner Nov 19: tiers by measured frame time; medium on every device by default)
const GFX_OTHER = TIER === 'medium' ? 'high' : TIER === 'high' ? 'low' : 'medium', gfxGo = () => { saveQuality(GFX_OTHER); let u = location.href.split('#')[0]; try { const x = new URL(u); x.searchParams.set('quality', GFX_OTHER); if (x.searchParams.get('film') !== '0') x.searchParams.set('film', '1'); u = x.href; } catch (e) { /* keep the address */ } location.href = u; };
const gfxPauseLabel = () => 'Graphics: ' + TIER + (TIER === 'medium' ? ' (default)' : '');
let gfxArm = 0; $('gfxT').textContent = 'Graphics: ' + TIER + (TIER === 'medium' ? ' (default)' : '') + ' - tap to switch'; $('gfxT').onclick = gfxGo;
$('bGfx').textContent = gfxPauseLabel(); $('bGfx').addEventListener('click', () => { if (!gfxArm) { gfxArm = 1; $('bGfx').textContent = 'Switch to ' + GFX_OTHER + '? Reloads: this night ends. Tap again'; return; } gfxGo(); });
GK.speak.fn = (kind, line, obj) => sfxVoice(kind, line, obj);
$('watch').onclick = () => { if (paused) setPause(false); audio(); musicUnlock(); save = B.loadSave(CONFIG, storage); carry = save.carry || null; startIntro(); }; $('cineSkip').onclick = () => finishIntro();
// a first-time player (no save yet) gets the opening from "Enter the base" too (coordinator Nov 17); ?film=0 in the address skips that for the scripted checks
// the scripted checks always open the page with ?quality=..., so a ?quality address also skips it unless ?film=1 asks for it (openingcheck); the player's own Graphics switch (gfxGo) adds film=1 so a real player keeps the film and card
const NOFILM = (() => { try { const q = new URLSearchParams(location.search); return q.get('film') === '0' || (q.has('quality') && q.get('film') !== '1'); } catch (e) { return false; } })();
$('enter').onclick = () => { audio(); musicUnlock(); let had = false; try { had = !!(storage && storage.getItem('solardg.save')); } catch (e) { had = false; } save = !had && preSave ? preSave : B.loadSave(CONFIG, storage); preSave = null; carry = save.carry || null; persist(); if (!had && !NOFILM) { startIntro(); return; } enterBase(); };
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
function lockMouse() { if (!FINE || mouseHeld() || !cvs.requestPointerLock) return false; lockAt = performance.now(); if (fakeLock()) { window.__lockAsks = (window.__lockAsks || 0) + 1; window.__fakeLock = true; lockWanted = true; $('mlook').style.display = 'none'; return true; } try { const pr = cvs.requestPointerLock(); if (pr && pr.catch) pr.catch(() => {}); lockWanted = true; return true; } catch (e) { return false; } }
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
function drillStep() { const D = CONFIG.drill, q = drill.todo[drill.i], P = sim.player; drill.since = performance.now(); drill.gs = 0; drill.again = false;
  if (q.id === 'eat') { if (P.hp > CONFIG.player.hp * D.eatHp) P.hp = CONFIG.player.hp * D.eatHp; if (sim.food <= 0) sim.food = 1; }
  if (q.id === 'charge') P.energy = Math.max(P.energy, CONFIG.cannon.cost * CONFIG.cannon.charge.cost + 1); if (q.id === 'place') P.energy = Math.max(P.energy, CONFIG.devices[slotKinds()[selSlot]].cost + 1); // the picked device (the cheapest, from the drill's start) is paid for, so the step cannot dead-end
  drillSay(FINE ? q.desk : q.phone); }
function drillSay(t) { H2.say('marla', t, CONFIG.ui.centre.marla, CONFIG.drill.lineSecs); }
function drillTick(dt) { if (drillSim !== sim || drillPh !== (sim && sim.phase)) { drillSim = sim; drillPh = sim && sim.phase; drillBegin(); } if (!drill || !sim || sim.phase !== 'night') return; const D = CONFIG.drill;
  // while the lesson holds the waves (drill.held), the night must not see "no Gloom left" as dawn: sim.holdDawn says so until drillEnd gives the waves back
  if (!drill.held) { if (sim.t < D.startAt) return; drill.held = sim.spawns.splice(sim.spawned); sim.holdDawn = () => !!(drill && drill.held && drillSim === sim); sim.tame = drillTame; sim.hpFloor = () => (drill && drill.held && drillSim === sim ? D.hpFloor : 0); drill.t0 = sim.t; drill.i = 0; { const sk = slotKinds(), li = sk.indexOf(D.device); let bi = li >= 0 ? li : 0; if (li < 0) sk.forEach((k, i) => { if (CONFIG.devices[k].cost < CONFIG.devices[sk[bi]].cost) bi = i; }); selSlot = bi; } drillStep(); }
  sim.t = Math.min(sim.t, drill.t0); const q = drill.todo[drill.i]; if (!q) return;
  // one machine at a time, of the step's kind, through an opening you can see (drillOpening: in view, a few metres out, so it walks in in front of you)
  if (!sim.gloom.length && sim.spawned >= sim.spawns.length) { const at = drillOpening(); sim.spawns.push({ t: sim.t, bp: at.bp, hpv: 1, from: { x: at.x, z: at.z } }); drill.kind = q.kind; drill.from = at; }
  for (const g of sim.gloom) if (!g.drillKind && drill.kind) { g.drillKind = true; g.kind = drill.kind; }
  // the repeat also waits D.idleGame seconds of game time, so the order is on screen (and spoken) for a few frames even where one frame takes longer than D.idle
  drill.gs += dt; if (!drill.again && performance.now() - drill.since > D.idle * 1000 && drill.gs >= D.idleGame) { drill.again = true; drillSay(q.again); } } // idle counts real seconds (game time runs slow on a slow machine)
// the lesson machine is tamed (CONFIG.drill shootSpeed/shootStop, laterSpeed/laterDmg): slow and halted short of you until the shoot step is done, then slower and light-handed
function drillTame() { const D = CONFIG.drill; if (!drill || !drill.held || drillSim !== sim) return null; const q = drill.todo[drill.i]; return q && q.id === 'shoot' ? { speed: D.shootSpeed, stop: D.shootStop, dmg: 0 } : { speed: D.laterSpeed, stop: 0, dmg: D.laterDmg }; }
// the step's action happened: next step, or the end of the drill
function drillDid(id) { if (!drill || !drill.held) return false; const q = drill.todo[drill.i]; if (!q || q.id !== id) return false; const st = drillStore(); st.done = (st.done || []).concat(id); drillKeep(st); drill.i++; if (drill.i >= drill.todo.length) drillEnd(false); else drillStep(); return true; }
function drillEnd(skip) { if (!drill) return; if (skip) { const st = drillStore(); st.skip = true; drillKeep(st); } if (sim && drill.held) { sim.spawns.push(...drill.held); sim.spawns.sort((a, b) => a.t - b.t); } drill = null; H2.say('marla', skip ? CONFIG.drill.skipped : CONFIG.drill.done, CONFIG.ui.centre.marla, 4); }
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
function drawMap(cv, css, rad, gMax) { const M = CONFIG.miniMap, dpr = Math.min(2, devicePixelRatio || 1); if (cv.width !== Math.round(css * dpr)) { cv.width = cv.height = Math.round(css * dpr); cv.style.width = cv.style.height = css + 'px'; }
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
function drawnHit(m, P) { const back = lodFull(m); try { return drawnHit0(m, P); } finally { if (back) back(); } }
// (LAG FIX Nov 19, owner 10:35) per machine, kept until its pieces change (a merge clears it): the head pieces as a Set and, in traverse order, every piece that can be a
// hit shape at all; each call still applies the full test (visible, opacity) to them, and the ray tests only them, so the result is the same as testing the whole machine
const HITC = new WeakMap();
function hitCache(m) { let c = HITC.get(m); if (c) return c; const heads = new Set(), list = []; for (const h of m.userData.heads || [m.userData.head]) if (h) h.traverse((q) => heads.add(q));
  m.traverse((q) => { if (q.isMesh && !q.isSprite && !q.userData.blob && !q.userData.mergedDraw) list.push(q); }); c = { heads, list }; HITC.set(m, c); return c; }
function drawnHit0(m, P) { const L = CONFIG.cannon.live, HC = hitCache(m), headSet = HC.heads;
  const solid = (q) => { if (!q.isMesh || q.isSprite || q.userData.blob || q.userData.mergedDraw) return false; let v = q; while (v) { if (!v.visible) return false; v = v.parent; } const mt = Array.isArray(q.material) ? q.material[0] : q.material; return !(mt && (mt.blending === THREE.AdditiveBlending || (mt.transparent && (mt.opacity < L.minOpacity || q.geometry.type === 'PlaneGeometry')))); };
  m.updateMatrixWorld(true); let hv = 0, av = 0, top = -1e9;
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
function musicUnlock() { if (mus.ready) return; mus.ready = true; try { mus.on = CONFIG.music.on && !(storage && storage.getItem('solardg.music') === 'off'); } catch (e) { /* keep default */ } showMusic(); for (const k in MUSIC) { try { const a = (mus.pre && mus.pre[k]) || new Audio(MUSIC[k]); a.loop = true; a.volume = 0; a.preload = 'auto'; mus.el[k] = a; const pr = a.play(); if (pr && pr.then) pr.then(() => { if (mus.cur !== k) { a.pause(); try { a.currentTime = 0; } catch (e) { /* fine */ } } }).catch(() => {}); } catch (e) { /* no music on this browser */ } } $('bMusic').textContent = 'Music: ' + (mus.on ? 'on' : 'off'); }
// ---- START FLOW (owner Nov 17 23:33 / 23:36; CONFIG.splash): the V logo, the DAWNPUNK title card, then the loading page with REAL progress (each stage is counted from actual
// loads: the three.js loading manager for models and textures, the handwriting fonts, the music files, a shader compile of the scene), then the begin button #enter.
// The scripted checks (?quality= in the address) skip the logo and title time unless &splash=1. window.__loadMs = milliseconds from navigation to the begin button.
let preSave = null;
const SPLASH = (() => {
  const S = CONFIG.splash, el = $('spl'), q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })(), quick = q.has('quality') && q.get('splash') !== '1';
  const t0 = performance.now(), st = { scripts: [1, 1], assets: [0, 0], fonts: [0, 1], music: [0, 0], warm: [0, 1] }, began = {}, label = { scripts: 'Scripts', assets: 'Models and textures', fonts: 'Handwriting fonts', music: 'Music', warm: 'First scene (shaders)' };
  const root = document.documentElement.style; root.setProperty('--sp-bg0', S.bg[0]); root.setProperty('--sp-bg1', S.bg[1]); root.setProperty('--sp-w0', S.word[0]); root.setProperty('--sp-w1', S.word[1]); root.setProperty('--sp-glow', S.glow); root.setProperty('--sp-tag', S.tagline);
  root.setProperty('--sp-b0', S.bar[0]); root.setProperty('--sp-b1', S.bar[1]); root.setProperty('--sp-b2', S.bar[2]); root.setProperty('--sp-b3', S.bar[3]); root.setProperty('--sp-fade', S.fade + 's'); $('stag').textContent = S.tag;
  if (FINE && S.particles) { const pz = $('spart'); for (let i = 0; i < S.particles; i++) { const d = document.createElement('i'); d.style.left = (5 + ((i * 53) % 90)) + '%'; d.style.animationDelay = (-(i * 0.73) % 9) + 's'; d.style.animationDuration = (7 + (i % 5)) + 's'; pz.appendChild(d); } }
  // models and textures: every three.js loader without its own manager reports here
  const M = THREE.DefaultLoadingManager; M.onStart = (u, l, t) => { st.assets = [l, t]; }; M.onProgress = (u, l, t) => { st.assets = [l, t]; }; M.onLoad = () => { st.assets = [st.assets[1], st.assets[1]]; began.assetsDone = true; };
  // fonts: the journal's handwriting fonts and the page's own
  Promise.all([Promise.resolve(loadBookFonts()).catch(() => {}), document.fonts ? document.fonts.ready : null]).then(() => { st.fonts = [1, 1]; });
  // music: each track preloaded until the browser can play it through (the same elements are used once sound is allowed)
  // LAG FIX Nov 19 (owner 11:40): the begin button waits only for the tracks the first minutes play (the base's, and the night's for a first visit: the opening film);
  // the others keep loading behind
  const firstVisit = (() => { try { return !(storage && storage.getItem('solardg.save')); } catch (e) { return true; } })(), needT = (k) => k === 'base' || (k === 'night' && firstVisit) || !MUSIC.base;
  for (const k in MUSIC) if (needT(k)) st.music[1]++;
  mus.pre = {}; for (const k in MUSIC) { try { const a = new Audio(); a.preload = 'auto'; a.loop = true; a.volume = 0; const done = () => { if (!a.__ok) { a.__ok = true; if (needT(k)) st.music[0]++; } }; a.addEventListener('canplaythrough', done, { once: true }); a.addEventListener('error', done, { once: true }); a.src = MUSIC[k]; a.load(); mus.pre[k] = a; } catch (e) { if (needT(k)) st.music[0]++; } }
  const SPW = {}; let phase = '', ready = false, loreI = 0, loreT = 0; const lore = CONFIG.intro.lines.map((l) => l[2]).filter((t) => !/^MARLA/.test(t)).concat(LORE.OLD_NOTICES.filter((t) => t.length < 90));
  const set = (ph) => { if (phase === ph) return; phase = ph; el.className = 'ph-' + ph; };
  const frac = () => { const W = S.weights; let a = 0, b = 0; for (const k in W) { const [d, t] = st[k], f = t > 0 ? Math.min(1, d / t) : (k === 'assets' && (began.assetsDone || performance.now() - t0 > 1500) ? 1 : 0); a += W[k] * f; b += W[k]; } return a / b; };
  const tick = () => { const now = performance.now(), age = (now - t0) / 1000;
    for (const k in st) if (st[k][0] < st[k][1] && age > S.stageCap) st[k][0] = st[k][1];
    // (owner 11:40) the base is built here, hidden, under the loading page (a first visit: for the new save made here, kept in preSave and used on Enter, Marla at the door
    // as the film leaves her) (its shaders built with the warm-up), and shown again on Enter (src/baseview.js
    // keeps it: CONFIG.lag.keepBase); the title is then drawn once more without it
    if (!began.warm && (began.assetsDone || st.assets[1] === 0 || age > S.stageCap) && st.fonts[0] >= 1) { began.warm = true; requestAnimationFrame(() => { let pre = false; try { if (CONFIG.lag.keepBase && !BOTRUN()) { const sv = B.loadSave(CONFIG, storage); if (sv && firstVisit && sv.day === 1 && !sv.nights) sv.scoutSpot = 4; preSave = firstVisit ? sv : null; if (sv) { bview.build(sv); applyRelief(bview.group); noSmallCasters(bview.group); bview.mergeStill(); pre = true; } } } catch (e) { /* built on Enter instead */ }
      try { renderer.compile(scene, cam); renderer.render(scene, cam); } catch (e) { /* nothing to warm */ } if (pre) bview.dispose(); pauseDrawn = false; st.warm = [1, 1]; }); }
    // (owner 11:40) the bar, the percent and the stage line are written only when they change
    const f = frac(); setText('spct', Math.floor(100 * f) + '%'); sty($('sfill'), 'width', (100 * f).toFixed(1) + '%');
    const cur = Object.keys(S.weights).find((k) => st[k][1] > 0 ? st[k][0] < st[k][1] : false) || (f < 1 ? 'assets' : ''); setText('sstage', f >= 1 ? 'Ready' : 'Loading: ' + label[cur] + (cur === 'assets' && st.assets[1] ? ' (' + st.assets[0] + ' of ' + st.assets[1] + ')' : cur === 'music' ? ' (' + st.music[0] + ' of ' + st.music[1] + ')' : ''));
    if (now > loreT) { loreT = now + S.loreSecs * 1000; $('slore').textContent = lore[loreI++ % lore.length] || ''; }
    if (f >= 1 && !ready) { ready = true; window.__loadMs = Math.round(now); }
    if (quick) set(ready ? 'ready' : 'load'); else if (age < S.logoSecs) set('logo'); else if (age < S.logoSecs + S.titleSecs) set('title'); else set(ready ? 'ready' : 'load');
    SPW.phase = phase; SPW.frac = f; SPW.stages = st; SPW.loadMs = window.__loadMs || null; window.__splash = SPW; // one object, updated in place (owner 11:40: no copy each tick)
    if (!(phase === 'ready' && ready) || $('menu').style.display !== 'none') setTimeout(tick, 150); };
  tick(); return { get phase() { return phase; } };
})();
function musicTick(dt) { if (!mus.ready) return; const want = !mus.on || document.hidden ? null : state === 'intro' ? (intro && intro.part === 'town' ? 'night' : 'base') : state === 'base' ? 'base' : sim ? (sim.phase === 'night' ? 'night' : 'day') : (run && state === 'play') ? 'day' : mus.cur; if (want !== mus.cur) { mus.cur = want; const a = want && mus.el[want]; if (a && a.paused) { if (a.volume <= 0.001) { try { a.currentTime = 0; } catch (e) { /* not seekable yet */ } } const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); } }
  const top = (paused ? CONFIG.music.pausedVolume : CONFIG.music.volume) * MV.duck(), step = dt / CONFIG.music.fade; for (const k in mus.el) { const a = mus.el[k], tv = k === mus.cur ? top : 0, v = a.volume + Math.max(-step, Math.min(step, tv - a.volume)); a.volume = Math.max(0, Math.min(1, v)); if (k !== mus.cur && a.volume <= 0.001 && !a.paused) a.pause(); } }
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state !== 'running') ac.resume(); } catch (e) { ac = null; } return ac; }
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
function draw() { pshadow.tick(cam, state === 'base' || state === 'play', pshadowFloor());if (FINE) { const bpe = $('bprompt'); if (bpe.textContent.startsWith('USE:')) bpe.textContent = 'E:' + bpe.textContent.slice(4); const can = (state === 'play' && !paused) || (state === 'base' && !ui && !paused); if (mouseHeld() && !can) freeMouse(); if (mouseHeld()) everHeld = true; $('mlook').style.display = can && !mouseHeld() && !mlookQuiet() ? 'block' : 'none'; } tickCentre(); if (Q.fx && !FXOFF && !fx) { try { fx = createFx(renderer, scene, cam, Q.fx, Q.pbr, hemi); fx.setSize(innerWidth, innerHeight); } catch (e) { console.warn('picture pass off', e); fx = { render: null }; } } if (holdDraw) return; fitFar(); if (QUALITY === 'high') lodTick(cam); if (fx && fx.render) fx.render(); else renderer.render(scene, cam); }
// the far plane follows the fog (CONFIG.lag.farPad): nothing past the fog's end is drawn; the sky dome (40 m) shrinks to stay inside the far plane
const FAR0 = cam.far; function fitFar() { const f = scene.fog && scene.fog.isFog ? Math.min(FAR0, scene.fog.far + CONFIG.lag.farPad) : FAR0; if (Math.abs(cam.far - f) > 0.25) { cam.far = f; cam.updateProjectionMatrix(); } sky.mesh.scale.setScalar(Math.min(1, (cam.far - 1) / 40)); }
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); if (fx && fx.setSize) fx.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
// ---- LOADING CARDS (owner Nov 19 05:49; CONFIG.lag.card): at a scene change the card covers the screen while the heavy work is done, so play does not hitch.
// The game is held still meanwhile (frame() returns at once), so no rule or timer changes: the change itself (startRun, dusk, enterBase) has already happened as before.
// Work: wait for the night's Gloom models and the boss model (they load from startRun; capped at maxWait s), build every shader the scene uses (renderer.compileAsync;
// skipped in the scripted checks, whose software GPU builds them on the first frame as before), and draw the sun shadow map once on the first frame after.
cvs.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ctxLost = true; }, false);
cvs.addEventListener('webglcontextrestored', () => { ctxLost = false; renderer.shadowMap.needsUpdate = true; }, false);
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
const LCARD = { on: false, n: 0 }, BOTRUN = () => { if (CARDS_REAL) return false; try { return !!window.__dtMax || !!navigator.webdriver; } catch (e) { return false; } };
// the scripted checks (a webdriver browser, not ?cards=1) fetch every Gloom model at page start as before the lag fix, so a check that starts a night at once meets the
// models, not their stand-ins, and the night card does not hold its frames waiting for them (players and ?cards=1 runs load them per run)
if (BOTRUN()) gloomPreload();
// warm-up copies for the night card: one machine of every kind the ring can send and one of every device you carry, built and drawn into the shader cache under the card,
// then kept hidden until the run ends (a disposed material would free its shader program), so the first machine of a kind or the first device placed does not stall a frame
function dropWarm() { for (const c of [...warmG.children]) { warmG.remove(c); drop(c); } scene.remove(warmG); }
// (owner 11:40) the night card keeps the ride card's set when it is for the same run and the same devices (warmKey), instead of building it again
const warmKey = () => (run ? run.seed + '|' + run.ring + '|' + slotKinds().join(',') : '');
function warmNight() { if (warmG.children.length && warmG.userData.run === run && warmG.userData.key === warmKey()) { warmG.visible = true; warmG.matrixWorldAutoUpdate = true; scene.add(warmG); return; }
  dropWarm(); if (!run) return; warmG.userData.run = run; warmG.userData.key = warmKey(); const K = CONFIG.gloom.kinds, ring = run.ring || 0;
  for (const k of Object.keys(K)) if ((K[k].minRing || 0) <= ring && K[k].share > 0) { const m = gloomMesh({ kind: k, hp: 1, maxhp: 1 }); gloomBlob(m, k); m.position.set(0, -50, 0); warmG.add(m); }
  for (const k of new Set(slotKinds())) { const m = deviceMesh(k); m.position.set(0, -50, 0); warmG.add(m); }
  // the shot, its splash, a kill's smoke and a broken device's splinters (their shaders), and the scrap pieces' physics file (desktop)
  for (const c of [0x7fd8ff, 0x9fd8ff, 0x9fffa0, 0xd0a0ff, 0xffe08a]) { warmG.add(PR.jet(new THREE.Vector3(0, -50, 0), new THREE.Vector3(1, -50, 0), c)); warmG.add(PR.droplet(c)); }
  warmG.add(PR.smoke()); warmG.add(PR.splinter('panel')); warmG.add(PR.splinter('lance')); physicsPreload();
  warmG.visible = true; warmG.matrixWorldAutoUpdate = true; scene.add(warmG); }
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
async function sceneCard(kind) {
  const L = CONFIG.lag.card; if (!L || !L.on || LCARD.on) return; const id = ++LCARD.n, t0 = performance.now(), bot = BOTRUN(), fill = (k) => { $('lfill').style.width = Math.round(k * 100) + '%'; };
  LCARD.on = true; $('lct').textContent = L.titles[kind] || ''; if (kind === 'night') for (const l of glights) l.visible = true; else if (kind === 'ride') for (const l of glights) l.visible = false; fill(0.1); $('lcard').style.display = 'flex';
  try {
    // the night's models are waited for under the NIGHT card only: the ride card shows the day street, which does not need them (they keep loading behind it).
    // (Waiting on the ride card held the street hidden for up to maxWait s in the checks: playershadowcheck_desktop saw the card, not the street.)
    // (Nov 19 09:00) For a player the RIDE card waits for them too and builds the night's shaders already (below), so the night card stays short.
    if (QUALITY === 'high' && (kind === 'night' || (kind === 'ride' && !bot))) { const G = window.__gloomGlb || {}, B = window.__boss || {}; for (let t = 0; t < L.maxWait * 10; t++) { if (Object.values(G).every((v) => v !== 'loading') && B.model !== 'loading') break; await nap(100); } }
    if (kind === 'night') warmNight(); else dropWarm(); if (fx && fx.upgradeNow) fx.upgradeNow();
    // one material copy per kind of piece that draws it (src/mergestatic.js splitVariants), before the shaders are built
    if (CONFIG.lag.splitVariants) splitVariants(scene);
    // the impact sounds' variants are rendered ahead (src/impactsfx.js impactPrerender): started by the ride card and left to finish during the day; the night card
    // waits a moment (CONFIG.lag.card.sfxWait s) if they are not done yet; until they are, a sound is built live as before
    if (!bot && kind === 'ride') IMP.prerender(); else if (!bot && kind === 'night') await Promise.race([IMP.prerender(), nap(L.sfxWait * 1000)]);
    fill(0.6); if (!bot && renderer.compileAsync) await Promise.race([renderer.compileAsync(scene, cam), nap(L.maxWait * 1000)]);
    // the ride card also builds the NIGHT's shaders: the night's machine lights on (every lit shader is built per light count), one machine of each kind and each device
    // in the scene, then all put back as they were. The night card then finds them built (the first night card took 6.8 s on the test GPU, the next ones 0.5 s).
    // A house adds one ceiling lamp per floor (buildRoom), so the night's light count also depends on the house: stand-in lamps for each floor count among this ring's
    // houses are put in the scene in turn while the shaders are built, then removed.
    if (!bot && kind === 'ride' && run && renderer.compileAsync && glights.length) { for (const l of glights) l.visible = true; warmNight(); if (fx && fx.upgradeNow) fx.upgradeNow();
      // the night has no spot lights (Marla's and the people's key lights belong to the day street), so they are off while the night's shaders are built
      // every other point light of the day street is off too, and the house lamps are stood in for 0, 1, ... up to the most floors any house here has
      const most = Math.max(1, ...run.houses.map((h) => h.L || 1)), lamps = [...Array(most + 1).keys()], tmp = [], spots = [];
      scene.traverse((o) => { if ((o.isSpotLight || (o.isPointLight && !glights.includes(o))) && o.visible) { o.visible = false; spots.push(o); } });
      try { for (const n of lamps) { while (tmp.length < n) { const lp = new THREE.PointLight(0xffe0a0, CONFIG.world.lamp, 6); lp.position.set(0, -40, 0); scene.add(lp); tmp.push(lp); }
          fill(0.7 + 0.2 * tmp.length / most); await Promise.race([renderer.compileAsync(scene, cam), nap(L.maxWait * 1000)]); } }
      finally { for (const lp of tmp) { scene.remove(lp); lp.dispose(); } for (const o of spots) o.visible = true; for (const l of glights) l.visible = false; warmG.visible = false; warmG.matrixWorldAutoUpdate = false; } }
    // LAG FIX Nov 19 (real GPU: the first frame after the night card still took 1.7 s): the scene is drawn once UNDER the card, with the warm-up copies set out in front of
    // the camera, so every shader's first use, every upload and the sun shadow map (whose depth shaders compileAsync does not build) happen here, not in play; then
    // drawn again without them, so the shadow map play starts with is the real one. (Not in the scripted checks: they keep the old timing.)
    if (!bot) { if (kind === 'night') { const n = warmG.children.length; warmG.children.forEach((o, i) => { const a = yaw + ((i + 0.5) / n - 0.5) * 0.9, d = 2.5 + (i % 3); o.position.set(cam.position.x - Math.sin(a) * d, cam.position.y - 1.2, cam.position.z - Math.cos(a) * d); }); warmG.visible = true; }
      // the frame's own drawing (draw(): far plane, far copies, picture pass) and the hands; a last plain frame, then the GPU is made to finish all of it under the card
      // (real GPU: without the finish the first frame of play waited ~0.6 s for the card's queued work)
      const draw1 = (sh) => { if (sh) renderer.shadowMap.needsUpdate = true; draw(); if (sim && state === 'play' && !window.__noHands) hands.render(renderer, cam.aspect); }, raf = () => new Promise((r) => requestAnimationFrame(() => r()));
      draw1(true); warmG.visible = false; await raf();
      // then the view all round (four quarter turns), with the pieces the night cull hides (layer 1) drawn too: every piece's first draw (its normals, uvs and colours go
      // to the GPU then; the shadow pass only sent positions) happens under the card, not when you turn round or step to a window in the fight
      // and once more with EVERY piece shown and not culled (hidden effects such as the boss's summon bars and sparks included; lights left as they are, so no shader changes)
      { const ry = cam.rotation.y; cam.layers.enable(1); try { for (let k = 1; k <= 4; k++) { cam.rotation.y = ry + k * Math.PI / 2; cam.updateMatrixWorld(); draw1(false); } } finally { cam.layers.disable(1); cam.rotation.y = ry; cam.updateMatrixWorld(); } await raf(); }
      { const was = []; cam.layers.enable(1); try { scene.traverse((o) => { if (o.isLight || o === sky.mesh) return; was.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; }); renderer.render(scene, cam); }
        finally { for (const [o, v, f] of was) { o.visible = v; o.frustumCulled = f; } cam.layers.disable(1); } await raf(); }
      if (kind === 'night') { draw1(true); await raf(); } draw1(false); try { renderer.getContext().finish(); } catch (e2) { /* no context */ } }
    // the warm-up machines start the Gloom pool (they are built, drawn and uploaded); the rest of the warm-up copies stay hidden until the run ends, their matrices
    // skipping the per-frame pass too (owner 09:50)
    if (kind === 'night') for (const c of [...warmG.children]) if (c.userData.kind && c.userData.anim) { warmG.remove(c); gloomPut(c); }
    warmG.visible = false; warmG.matrixWorldAutoUpdate = false;
    // LAG FIX Nov 19 (owner 11:25): the real frame is drawn under the card until CONFIG.lag.card.settle.n frames in a row come in under settle.ms (cap settle.cap s), so a
    // scene's slow first frames are not the first frames of play; their times are kept in LCARD.settle (perfcheck logs them)
    if (!bot && L.settle) { const S = L.settle, ts = performance.now(), raf = () => new Promise((r) => requestAnimationFrame(() => r())), fr = []; let ok = 0, tp = performance.now();
      while (ok < S.n && performance.now() - ts < S.cap * 1000) { draw(); if (sim && state === 'play' && !window.__noHands) hands.render(renderer, cam.aspect); await raf(); const t = performance.now(), ms = t - tp; tp = t; fr.push(Math.round(ms)); ok = ms < S.ms ? ok + 1 : 0; }
      LCARD.settle = fr; }
    fill(0.9); if (bot) renderer.shadowMap.needsUpdate = true;
  } catch (e) { try { window.__cardErr = String(e && e.stack || e).slice(0, 300); } catch (e2) { /* no window */ } }
  LCARD.ms = Math.round(performance.now() - t0);
  const left = (bot ? 0 : (L.min[kind] || 0) * 1000) - (performance.now() - t0); if (left > 0) await nap(left);
  fill(1); if (id === LCARD.n) { LCARD.on = false; $('lcard').style.display = 'none'; perfRest(); }
}
// the automatic step-down on the desktop tier (src/perfstep.js, CONFIG.lag.step); phones never run it
perf = createPerfStep({ renderer, scene, resize, fx: () => fx, lights: glights, onLow: () => flash('Graphics will start on low next time (frames were slow)', true) });
// LAG FIX Nov 19 (finding 5): a desktop model's maps go to the GPU as it finishes loading, and the Gloom model shader is built then (async), so the first machine
// of a kind (or the boss) no longer stalls the frame it first appears in
const warmMaps = (root) => root.traverse((o) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) if (m && m[k] && !m[k].userData.warm) { m[k].userData.warm = true; renderer.initTexture(m[k]); } });
glbHooks.ready = (kind, sc) => { warmMaps(sc); if (renderer.compileAsync) renderer.compileAsync(glbCopy(kind, new THREE.Color(1, 1, 1)), cam, scene).catch(() => {}); };
bossHooks.ready = (root) => warmMaps(root);
let last = performance.now(), acc = 0, hurtT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // a loading card is up (sceneCard): the game is held still and nothing is drawn under it
  if (LCARD.on) { last = now; return; }
  // window.__dtMax is set only by the slow headless checks (software renderer, under 1 frame a second) so game time keeps up; players never set it.
  const rawMs = now - last, dt = Math.min(window.__dtMax || CONFIG.lag.dtMax, rawMs / 1000); last = now; const holdNow = paused || state === 'end' || (state === 'menu' && MENU_EL.style.display !== 'none'); holdDraw = (holdNow && pauseDrawn) || ctxLost; pauseDrawn = holdNow; perfHud(rawMs); perf.tick(rawMs, (state === 'base' || state === 'play') && !paused);
  if (shadowT > 0) { shadowT -= dt; if (shadowT <= 0) renderer.shadowMap.needsUpdate = true; }
  if (catArm) catArm.rotation.x = -0.5 + Math.sin(now / 280) * 0.45; // the lucky cat beckons
  // the scene's dark under-plane (y -0.08) would show through the base's sunken stream channel: while the base is in the scene it lies below the channel bed (CONFIG.baseWater.under)
  ground.position.y = bview.group && bview.group.parent && CONFIG.baseWater && CONFIG.baseWater.on ? -CONFIG.baseWater.under : -0.08;
  // Marla's voice: only in a run (state 'play'), stopped while paused or hidden; it plays the clip of the line her card (or a "Marla: " centre line) shows
  MV.tick(dt, state === 'play' && !!(run || sim), paused || document.hidden, $('marla').classList.contains('hq') ? '' : $('marla').textContent, $('csay').textContent);
  waterSnd.tick(dt, mus.ready ? audio() : null, { base: state === 'base' && !!baseU, paused, ui: !!ui, hidden: document.hidden, music: mus.on, volume: CONFIG.music.volume, near: baseU && baseU.water, indoor: baseU && baseU.indoor });
  if (state === 'base') {
    let mx = stick.x, mz = stick.y;
    if (keys.KeyW) mz -= 1; if (keys.KeyS) mz += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    if (!ui && !paused) { const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } const sy = Math.sin(yaw), cy = Math.cos(yaw), v = CONFIG.base.speed * dt; [bp.x, bp.z] = bview.pushOut(bp.x + (mx * cy + mz * sy) * v, bp.z + (-mx * sy + mz * cy) * v); }
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
    draw(); return;
  }
  if (state === 'intro') { introFrame(dt); return; }
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
    for (const g of sim.gloom) {
      let m = gMesh.get(g.id); if (!m) { m = gloomTake(g); if (m) { scene.add(m); gMesh.set(g.id, m); } else { m = gloomMesh(g); if (m.userData.anim) mergeQ.push([m, g.x, g.z]); gloomBlob(m, gloomKind(g)); scene.add(m); gMesh.set(g.id, m); } }
      // the height it is drawn at comes from the sim (src/sim.js gloomY), so the aimed shot aims where the model stands
      const gy = sim.gloomY(g);
      // LAG FIX Nov 19 (owner 07:10): at night in a house a machine outside that no opening shows is not drawn (src/nightcull.js sees; CONFIG.lag.nightCull.gloomR);
      // it stays visible and animated (the aimed shot tests the model as posed, src/main.js drawnHit, so the rules see exactly what they saw before); only its draws move to
      // layer 1, which the camera does not draw (pieces already on the hit layer stay there), and its matrices skip the per-frame pass (drawnHit works them out itself)
      m.position.set(g.x, gy, g.z); m.rotation.y = g.face + Math.PI; { const L = nightCull.sees(g.x, gy + CONFIG.lag.nightCull.gloomY, g.z, CONFIG.lag.nightCull.gloomR, sim, cam) ? 0 : 1; if ((m.userData.cullL || 0) !== L) { m.userData.cullL = L; m.traverse((q) => { if (!q.userData.hitOnly) q.layers.set(L); }); m.matrixWorldAutoUpdate = L === 0; } }
      if (m.userData.anim) m.userData.anim(performance.now() / 1000, g); else m.scale.setScalar(0.9 + 0.1 * (g.hp / g.maxhp));
    }
    // every tier (desktop too since owner 09:50): a new machine's still pieces are merged a few machines a frame (CONFIG.lag.mergeGloom.perFrame); the probe poses use times before 0 (no caption line starts)
    for (let k = 0; k < CONFIG.lag.mergeGloom.perFrame && mergeQ.length; k++) { const [mm, mx, mz] = mergeQ.shift(); if (!mm.parent) continue; mergeStatic(mm, (i) => mm.userData.anim(-(1 + i * 0.73), { x: mx + i * 0.11, z: mz + i * 0.07 })); mm.userData.merged = true; HITC.delete(mm); }
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
    const dayNow = sim.phase === 'day', leftN = CONFIG.night.duration - sim.t;
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
        el.classList.toggle('poor', poor && !(dayNow && id !== 'b0')); el.classList.toggle('full', full); el.classList.remove('dim');
      }
      const et = '<i class="ic"></i>' + B.eatLabel(sim.food, !FINE), eb = $('bEat'); if (eb.dataset.t !== et) { eb.innerHTML = et; eb.dataset.t = et; } }
  }
  if (!paused && state !== 'end') for (let i = debris.length - 1; i >= 0; i--) { const q = debris[i]; q.t -= dt; q.vy -= 9 * dt; q.m.position.x += q.vx * dt; q.m.position.y = Math.max(q.y0, q.m.position.y + q.vy * dt); q.m.position.z += q.vz * dt; q.m.rotation.x += dt * 6; if (q.grow) { q.vy += 9 * dt * 0.94; q.m.scale.multiplyScalar(1 + q.grow * dt); } if (q.t <= 0) { opDone(q.m); debris.splice(i, 1); } }
  if (!paused && state !== 'end') for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].t -= dt; if (tracers[i].t <= 0) { opDone(tracers[i].l); tracers.splice(i, 1); } }
  hurtT = Math.max(0, hurtT - dt); sty($('hurt'), 'opacity', String(hurtT * 2.5));
  tickHud(dt); tickAim(dt); tickCharge(dt);
  sky.follow(cam, world ? world.g.rotation.y : 0, dt); draw();
  if (sim && run) tickDormant(sim.phase === 'night');
  if (sim && state === 'play') { hands.update(paused ? 0 : dt, Math.hypot(stick.x, stick.y) > 0.1 || keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD, sim.player.energy / CONFIG.player.energyCap, sim.phase === 'night'); (window.__noHands || holdDraw || hands.render(renderer, cam.aspect)); }
}
function endScreen() {
  state = 'end'; $('bLeave').style.display = 'none'; $('time').style.color = ''; const lm = fromBase && save ? B.lootMult(CONFIG, save) : 1, r = { ...sim.result, food: Math.round(sim.result.food * lm), essentials: Math.round(sim.result.essentials * lm) }; const opens = fromBase && r.win && save && (save.ringOpen || 1) < Math.min(CONFIG.ring.mult.length, r.ring + 2) ? '. Ring ' + (r.ring + 2) + ' is now open' : (fromBase && r.win && save && r.ring + 1 >= CONFIG.ring.mult.length && !save.cleared ? ((save.cleared = save.day), '. You held the farthest ring: the settlement can grow again. That is the end of this demo; you can keep playing') : ''); $('marla').textContent = ''; $('hs').textContent = ''; marlaT = 0; hsT = 0;
  $('endTitle').textContent = r.win ? 'Dawn. You held the house.' : (sim.left ? (sim.leftDay ? 'You went home before dark.' : 'You left the night.') : 'The night took you.');
  $('again').textContent = fromBase ? 'Back to the base' : 'Back';
  $('endBody').textContent = r.win ? 'Marla: "Still standing, Potts? Good. Hmph." ' + `Brought home: ${r.food} food (ate ${r.eaten}), ${r.essentials} essentials` + (r.collectors ? ` (${r.collectors} collector${r.collectors > 1 ? 's' : ''} saved)` : '') + (r.coins ? '. You found the lucky cat' : '') + (lm > 1 && r.win ? '. Misfortune cat at home: loot x' + lm : '') + opens : (sim.left ? 'Marla: "Leaving already, Potts? Hmph." ' : 'Marla: "Up you get. The sun owes us a rematch." ') + `Minimum payout: ${r.food} food` + '';
  if (sim.result && sim.result.boss) $('endBody').textContent += bossEndLine(sim.result, lm); // the boss's bonus (src/bosshi.js)
  $('hud').style.display = 'none'; $('end').style.display = 'flex';
  // bank the night at once (so a reload on this screen cannot lose or replay it)
  if (fromBase && save && !sim.banked) { sim.banked = true; const f0 = save.food, e0 = save.essentials, r = B.applyNight(CONFIG, save, sim.result, sim.killed); persist(); $('endBody').textContent += ' ' + B.nightFoodLine(CONFIG, save.food, sim.eaten || 0); homeMsg = 'Day ' + save.day + '. Home: +' + (save.food - f0) + ' food, +' + (save.essentials - e0) + ' essentials (run plus ' + r.passive.food + ' food from gatherers, ' + r.passive.essentials + ' essentials from hunters).' + (sim.result.win && (save.ringOpen || 1) > sim.result.ring + 1 ? ' Ring ' + Math.min(CONFIG.ring.mult.length, sim.result.ring + 2) + ' is open.' : '') + (r.research ? ' Research finished: ' + r.research + '!' : ''); { const lvl = Math.min(CONFIG.base.growth.max, (save.ringOpen || 1) - 1 + (save.cleared ? 1 : 0)); if (lvl > (save.grown || 0)) { save.grown = lvl; persist(); homeMsg += ' The settlement grows: a new solar sapling and flower bed stand by the plaza (' + lvl + ' of ' + CONFIG.base.growth.max + ').'; } } }
}
requestAnimationFrame(frame);
window.__game = { liveShapes, marlaStreak, marlaNightTips, get cam() { return cam; }, get yaw() { return yaw; }, get mouseHeld() { return mouseHeld(); }, hands, marla, sky, bview, B, devVisible: (id) => { const m = dMesh.get(id); return m ? m.visible : null; }, deviceSample: (k, x, z, ry, v2) => { const o = (v2 && BT.device(k, CONFIG)) || PR.deviceMesh(k, CONFIG); if (o.userData.tick) o.userData.tick(2, null); o.position.set(x, 0, z); o.rotation.y = ry || 0; scene.add(o); return true; }, gloomTris: (k) => GK.gloomTris(k), glights, captions: () => { let n = 0; for (const m of gMesh.values()) m.traverse((o) => { if (o.isSprite && o.visible && o.renderOrder === 9) n++; }); return n; }, catSample: (si, x, z, ry, sc) => { const o = PR.catMesh(CONFIG.catStyles[si]).g; o.position.set(x, 0, z); o.rotation.y = ry || 0; o.scale.setScalar(sc || 1); scene.add(o); return true; }, gloomSample: (kind, x, z, ry, t, dormant) => { const o = GK.gloomMachine(kind, { dormant }); o.position.set(x, 0, z); o.rotation.y = ry || 0; if (t !== undefined) o.userData.anim(t, null); scene.add(o); window.__lastSample = o; return true; }, get dormant() { return dormG; }, get kitOpen() { return kitOpen; }, closeKit, get world() { return world; }, drawCalls: () => { renderer.render(scene, cam); return renderer.info.render.calls; }, get sim() { return sim; }, get save() { return save; }, enterBase: () => { save = B.loadSave(CONFIG, null); enterBase(); }, reBase: () => enterBase(), voiceCount: () => voiceN, voiceWav: async (kind, line) => { const oc = new OfflineAudioContext(1, 44100 * 8, 44100), g0 = oc.createGain(); g0.gain.value = 0.8; g0.connect(oc.destination); const end = voiceInto(oc, g0, kind, line); const buf = await oc.startRendering(), d = buf.getChannelData(0), n = Math.min(d.length, Math.ceil(end * 44100)); let pk = 0; const out = new Array(n); for (let i = 0; i < n; i++) { out[i] = Math.round(d[i] * 32767); pk = Math.max(pk, Math.abs(d[i])); } return { n, pk, data: out }; }, introAt: (t) => { if (intro) intro.t = t; }, startIntro: () => { save = B.loadSave(CONFIG, null); startIntro(); }, openPanel: (k) => openPanel(k), openScout: () => { curTarget = { kind: 'scout' }; doUse(); }, music: () => ({ cur: mus.cur, on: mus.on, playing: Object.keys(mus.el).filter((k) => !mus.el[k].paused && mus.el[k].volume > 0.02), t: Object.fromEntries(Object.keys(mus.el).map((k) => [k, +mus.el[k].currentTime.toFixed(1)])) }), doUse, get target() { return curTarget; }, setBase: (x, z) => { bp.x = x; bp.z = z; }, start: () => start(false), doFire, doPlace, endDay: () => sim && sim.endDay(), get run() { return run; }, gpu: () => ({ ...renderer.info.memory }), startRun: () => startRun(), enterHouse: (i) => enterHouse(i), leaveHouse: () => leaveHouse(), setTown: (x, z) => { if (run) { run.px = x; run.pz = z; } }, nightfall: () => nightfall(), setYaw: (y) => { yaw = y; }, fire: () => doFire(), wakeDormant: (i, how) => wakeDormant(i, how || 'shot'), say: (t) => marlaHint(t), mapInfo: () => mapInfo, sunPop: (n) => sunPop(n), drillInfo: () => (drill ? { step: drill.held ? (drill.todo[drill.i] || {}).id : 'wait', i: drill.i, left: drill.todo.length - drill.i, sel: selSlot, kinds: slotKinds().length, paused } : null), cfg: () => CONFIG, setPitch: (v) => { pitch = v; }, get state() { return state; } };
// test hooks for tools/workshopcheck.cjs: where you stand in the base, the workshop-line timer
window.__game.basePos = () => ({ x: bp.x, z: bp.z, yaw });
// test hooks for tools/freshfixcheck.cjs: the drill machine's opening (index, degrees off your view when it came), and the waking prompt's text
window.__game.drillFrom = () => (drill && drill.from ? { bp: drill.from.bp, ang: drill.from.ang } : null);
// Marla's voice for the checks (tools/voicecheck.cjs): clips started (n), the last clip id and its shown text, how it played, playing now, Voice on
window.__game.marlaVoice = () => ({ n: MV.hook.n, last: MV.hook.last, lastText: MV.hook.lastText, via: MV.hook.via, playing: MV.hook.playing, on: MV.on, allowed: MV.allowed, duck: MV.duck() });
window.__game.wakeText = () => wakeT; window.__game.uiNow = () => ui; window.__game.isPaused = () => paused; window.__game.setPause = (v) => setPause(v);
window.__game.wsTip = () => wsTipT;
// the automatic step-down (tools/perfcheck.cjs): its state, and take the next step now
window.__game.cardOn = () => LCARD.on;
// the impact sound proof (tools/perfcheck.cjs, local probes): each kind rendered live and as a rendered variant through a pooled chain, RMS difference / RMS
window.__game.impactSelfTest = (ph) => impactSelfTest(44100, CONFIG.sfx.impact, !!ph, 12345);
window.__game.impactPrerender = () => IMP.prerender();
// the last card's work time (ms) and any error it swallowed (tools/perfcheck.cjs prints them)
window.__game.cardInfo = () => ({ ms: LCARD.ms, settle: LCARD.settle || null, err: window.__cardErr || '' });
// the shader programs built so far (tools/perfcheck.cjs: which ones are first built after the night card); name and a short key each
window.__game.programs = (full) => (renderer.info.programs || []).map((q) => q.id + ' ' + q.name + ' ' + (full ? String(q.cacheKey) : String(q.cacheKey).replace(/,+/g, ',').slice(0, 160)));
window.__game.perfStep = () => (perf ? { ...perf.state } : null); window.__game.perfForce = () => (perf ? { ...perf.force() } : null);
window.__game.baseEvening = (t) => bview.setEvening(t);
window.__game.cfg = CONFIG;
window.__game.waterGain = () => waterSnd.gain();
window.__game.impactCount = () => ({ ...impN });
window.__game.tipKind = () => tipKind;
window.__game.catSet = (i, o) => bview.catSet(i, o);
// graphics tier readout for tools/qualitycheck.cjs: what was picked and what the renderer and the textures really use
window.__game.quality = () => { let shadow = 0, plaster = 0, plasterN = 0; const root = state === 'base' ? bview.group : world && world.g; if (root) root.traverse((o) => { if (o.isDirectionalLight && o.castShadow) shadow = Math.max(shadow, o.shadow.mapSize.x); if (o.isMesh && o.material && o.material.map && o.material.map.userData.tex === (state === 'base' ? 'render' : 'plaster')) { const m = o.material; plaster = Math.max(plaster, (m.map.image && m.map.image.width) || 0); if (m.normalMap && m.normalMap.image) plasterN = Math.max(plasterN, m.normalMap.image.width); } });
  return { tier: TIER, asset: QUALITY, want: { pixelRatio: Math.min(window.devicePixelRatio || 1, Q.pixelRatio), lights: Q.lights, shadow: Q.shadowMap, baseShadow: Q.baseShadowMap, aniso: Q.aniso, fx: !!Q.fx }, by: QPICK.by, pixelRatio: renderer.getPixelRatio(), antialias: !!renderer.getContextAttributes().antialias, lights: glights.length, sky: sky.detail, shadow, wallTex: plaster, wallRelief: plasterN, hi: { ...hiState }, gpuAniso: renderer.capabilities.getMaxAnisotropy() }; };
// test hooks for tools/lorecheck.cjs: this visit's note (where, and whether the prompt shows), read it, is it open, the notes found
// test hook for tools/openingcheck.cjs: person stand-in figures visible in the base right now (the wake shot must show none)
window.__game.standInsShown = () => { let n = 0; bview.group.traverse((o) => { if (!opStandIn(o)) return; for (let q = o; q; q = q.parent) if (!q.visible) return; n++; }); return n; };
window.__game.lore = { note: () => (loreN && loreN.bp === bpGroup ? { i: loreN.i, x: loreN.x, z: loreN.z, floor: loreN.floor, top: loreN.top, prompt: loreOn } : null), read: () => openLoreNote(), open: () => loreOpen, found: () => LORE.foundList(save), ms: () => loreMs };
