// THE BECKONER on screen: the final-night boss's picture, poses, warnings, sounds and falling pieces. The rules are in src/boss.js; numbers in CONFIG.boss (src/bossconfig.js).
// DESKTOP: the Blender model (art/models_hi/boss_beckoner_hi.glb, tools/gloomglb/boss_model.py), loaded only on the desktop tier when a boss night is near; cannon-es pieces (src/physics.js).
// PHONES: a code-built cat with the same node names in ONE skinned mesh (plus one glow mesh and the screen), scripted falling pieces. The desktop shows this one while the model loads.
// main.js calls bossTick(dt, sim, ctx) every frame of a run; it builds the boss on a boss night and drops it otherwise. Nothing here changes the game's rules.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { QUALITY } from './quality.js';
import { say } from './hud2.js';
import { lodPrepare, lodCopy } from './lod.js';
import { mergeGlb, rebindMerged } from './glbmerge.js';

const BC = CONFIG.boss, VW = BC.view, PH = BC.physics, S = BC.scale;
const fxOff = (() => { try { return new URLSearchParams(location.search).get('fx') === '0'; } catch (e) { return false; } })();
export const DESK = QUALITY === 'high' && !fxOff;
const MODEL = 'models/boss_beckoner_hi.glb', PHYS = 'physics.js';
// the state the checks read (tools/bosscheck.cjs): window.__boss
export const bossState = { model: 'none', physics: 'none', built: null, pieces: 0, events: [], draws: 0, tris: 0 };
try { window.__boss = bossState; } catch (e) { /* no window */ }

// pivots of the nodes in the model's own (quarter-scale) frame, copied from tools/gloomglb/boss_model.py (the code-built cat uses them; the GLB carries its own)
const PIV = {
  base: [0, 0, 0, null], body: [0, 0.2, 0, 'base'], head: [0, 1.32, -0.05, 'body'], jaw: [0, 1.42, -0.44, 'head'], eyeL: [-0.115, 1.745, -0.43, 'head'], eyeR: [0.115, 1.745, -0.43, 'head'],
  bell: [0, 1.26, -0.24, 'body'], coin: [0, 0.86, -0.28, 'body'], coreDoorL: [-0.17, 0.86, -0.28, 'body'], coreDoorR: [0.17, 0.86, -0.28, 'body'],
  beckonArm: [-0.38, 1.15, -0.06, 'body'], beckonFore: [-0.38, 0.85, -0.06, 'beckonArm'], beckonPaw: [-0.38, 0.59, -0.06, 'beckonFore'], beckonCore: [-0.38, 0.44, -0.125, 'beckonPaw'],
  slamArm: [0.38, 1.15, -0.06, 'body'], slamFore: [0.38, 0.93, -0.06, 'slamArm'], slamS1: [0.38, 0.77, -0.06, 'slamFore'], slamS2: [0.38, 0.65, -0.06, 'slamS1'], slamS3: [0.38, 0.53, -0.06, 'slamS2'],
  slamS4: [0.38, 0.41, -0.06, 'slamS3'], slamPaw: [0.38, 0.29, -0.06, 'slamS4'], slamCore: [0.38, 0.17, -0.22, 'slamPaw'],
  plate0: [-0.41, 1.21, -0.06, 'beckonArm'], plate1: [0.41, 1.21, -0.06, 'slamArm'], plate2: [-0.38, 1.0, -0.15, 'beckonArm'], plate3: [0.38, 1.02, -0.15, 'slamArm'],
  plate4: [-0.38, 0.72, -0.14, 'beckonFore'], plate5: [0.38, 0.84, -0.16, 'slamFore'], plate6: [-0.3, 1.66, -0.36, 'head'], plate7: [0.3, 1.66, -0.36, 'head'],
  plate8: [-0.14, 0.59, -0.32, 'body'], plate9: [0.14, 0.59, -0.32, 'body'], screen: [0, 1.69, -0.413, 'head'],
};
// falling pieces: [centre offset from the pivot x, y, z, half sizes x, y, z] in model units (bind pose)
const PIECE = {
  head: [0, 0.3, -0.04, 0.4, 0.32, 0.32], jaw: [0, -0.05, -0.04, 0.15, 0.05, 0.03], bell: [0, -0.09, -0.03, 0.08, 0.08, 0.08], coin: [0, 0, 0.0, 0.16, 0.2, 0.03],
  coreDoorL: [0.08, 0, 0, 0.09, 0.15, 0.03], coreDoorR: [-0.08, 0, 0, 0.09, 0.15, 0.03], beckonFore: [0, -0.3, 0, 0.13, 0.3, 0.1], slamPaw: [0, -0.12, 0, 0.16, 0.15, 0.16],
  slamFore: [0, -0.3, 0, 0.08, 0.3, 0.08],
};
for (let i = 0; i < 10; i++) PIECE['plate' + i] = [0, 0, 0, 0.1, 0.1, 0.03];
const BREAK_PLATES = { beckon: ['plate0', 'plate2', 'plate4'], slam: ['plate1', 'plate3', 'plate5'] };
const COLLAPSE = ['plate6', 'plate7', 'plate8', 'plate9', 'coreDoorL', 'coreDoorR', 'jaw', 'bell', 'head', 'beckonFore', 'slamPaw', 'coin'];

const V3 = (x, y, z) => new THREE.Vector3(x, y, z), UPV = V3(0, 1, 0);
// LAG FIX Nov 19 (owner: never frustumCulled = false): the code-built cat's skinned meshes get a sphere twice their bind-pose size (arms swing, pieces fall), the sparks and scissor bars a 40 m one
const bigSphere = (g) => { if (!g.boundingSphere) g.computeBoundingSphere(); const b = g.boundingSphere.clone(); b.radius *= 2; return b; };
const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const col = (h) => new THREE.Color(h);

// ---------------------------------------------------------------- the face screen (the game's screen style: ink on a pale, cracked display, scan lines, dead pixels)
function makeScreen(eyes) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const x = cv.getContext('2d'), t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  let cur = null;
  const draw = (mode) => {
    if (mode === cur) return; cur = mode;
    const ink = '#16130f';
    if (mode === 'off') { x.fillStyle = '#050605'; x.fillRect(0, 0, 256, 160); }
    else if (mode === 'saver') { x.fillStyle = '#071008'; x.fillRect(0, 0, 256, 160); x.fillStyle = '#9fe8b0'; x.font = 'bold 30px monospace'; x.textAlign = 'center'; x.fillText(BC.powerSaver, 128, 94); x.font = 'bold 14px monospace'; x.fillText('GRID CO.', 128, 122); }
    else {
      // a dark CRT with the cat face drawn in phosphor lines (coordinator, Nov 17: dark base, amber lines; teal while it summons, hot red-amber while it slams)
      const ph = mode === 'summon' ? '#5ff5dc' : mode === 'slam' ? '#ff7a3a' : '#ffb347', dim = mode === 'summon' ? '#1d5a50' : mode === 'slam' ? '#5a2410' : '#5a3c14';
      x.fillStyle = mode === 'summon' ? '#04100e' : mode === 'slam' ? '#120604' : '#0c0a06'; x.fillRect(0, 0, 256, 160);
      x.strokeStyle = ph; x.fillStyle = ph; x.lineCap = 'round'; x.lineJoin = 'round'; x.shadowColor = ph; x.shadowBlur = 6;
      // eyes (the phone build; the desktop model has lamp eyes in front of the screen): a slit-pupil eye, the other dead (dim static and a crack)
      if (eyes) { const ey = 46, eh = mode === 'slam' ? 12 : 19;
        x.lineWidth = 4; x.beginPath(); x.moveTo(146, ey); x.quadraticCurveTo(176, ey - eh * 1.6, 206, ey); x.quadraticCurveTo(176, ey + eh * 1.6, 146, ey); x.stroke();
        x.beginPath(); x.ellipse(176, ey, 4, eh, 0, 0, 7); x.fill();
        x.shadowBlur = 0; for (let k = 0; k < 120; k++) { x.fillStyle = k % 3 ? dim : '#3a3a30'; x.fillRect(52 + (k * 37) % 56, ey - 15 + (k * 23) % 30, 3, 2); }
        x.strokeStyle = dim; x.lineWidth = 3; x.beginPath(); x.moveTo(50, ey); x.quadraticCurveTo(80, ey - 28, 110, ey); x.quadraticCurveTo(80, ey + 28, 50, ey); x.stroke(); x.shadowBlur = 6; x.strokeStyle = ph; x.fillStyle = ph; }
      // brows, nose, muzzle line, a fixed too-wide grin with square teeth (wider open while it slams), whisker marks
      const by = eyes ? -12 : 0; x.lineWidth = 5; x.beginPath(); x.moveTo(56, 22 + by); x.lineTo(92, (mode === 'slam' ? 34 : 18) + by); x.moveTo(200, 22 + by); x.lineTo(164, (mode === 'slam' ? 34 : 18) + by); x.stroke();
      x.beginPath(); x.moveTo(116, 72); x.lineTo(140, 72); x.lineTo(128, 84); x.closePath(); x.fill();
      x.lineWidth = 4; x.beginPath(); x.moveTo(128, 84); x.lineTo(128, 98); x.stroke();
      { const op = mode === 'slam' ? 26 : 14; x.lineWidth = 4; x.beginPath(); x.moveTo(70, 96); x.quadraticCurveTo(128, 104 + op * 2.2, 186, 96); x.quadraticCurveTo(128, 104 + op * 0.6, 70, 96); x.closePath(); x.stroke();
        for (let k = 0; k < 9; k++) x.fillRect(84 + k * 10.5, 100, 6, mode === 'slam' ? 9 : 6); }
      x.lineWidth = 3; for (const s of [-1, 1]) for (const dy of [-8, 2, 12]) { x.beginPath(); x.moveTo(128 + s * 58, 86 + dy); x.lineTo(128 + s * 106, 80 + dy * 1.6); x.stroke(); }
      // cracks from the top left corner (dark with a lit edge), dead pixel blocks
      x.shadowBlur = 0; x.strokeStyle = '#000000'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 30); x.lineTo(26, 42); x.lineTo(34, 30); x.lineTo(60, 52); x.lineTo(72, 44); x.lineTo(110, 60); x.moveTo(34, 30); x.lineTo(40, 0); x.moveTo(60, 52); x.lineTo(52, 90); x.stroke();
      x.strokeStyle = dim; x.lineWidth = 1; x.stroke();
      x.fillStyle = '#000000'; for (const q of [[220, 120, 14, 10], [234, 130, 8, 8], [12, 130, 10, 8], [190, 8, 8, 12]]) x.fillRect(q[0], q[1], q[2], q[3]);
    }
    for (let yy = 0; yy < 160; yy += 4) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, yy + 3, 256, 1); }
    const g = x.createRadialGradient(128, 80, 40, 128, 80, 160); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); x.fillStyle = g; x.fillRect(0, 0, 256, 160);
    t.needsUpdate = true;
  };
  draw('face');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), new THREE.MeshBasicMaterial({ map: t, fog: false, toneMapped: false }));
  m.rotation.y = Math.PI; m.name = 'screenFace';
  return { mesh: m, draw, tex: t };
}

// ---------------------------------------------------------------- PHONE (and stand-in): the code-built cat, one skinned mesh + one glow mesh, bones named like the GLB's nodes
function grime(geo, base, pos, edge) {
  // vertex colours with strong value contrast (owner 18:11: "it does not read machine"): worn enamel varied by noise, DARK rust runs down from seams, chipped light edges
  // on every plate (edge: from the plate's own uv), grime low down and under ledges
  const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv, c = new Float32Array(P.count * 3), b = col(base), rust = col(0x4a2410), rust2 = col(0x7a3c18), dirt = col(0x2a261e), chip = col(0x3a2a1e), tmp = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), n = Math.sin(x * 37.1 + y * 13.7) * Math.sin(z * 29.3 - y * 21.1) * 0.5 + 0.5, ny = N ? N.getY(i) : 0;
    tmp.copy(b).multiplyScalar(0.8 + 0.25 * n);
    // rust only in thin drips (owner 20:44: about a fifth of the paint), at the plate edges and seams; the rest stays aged ivory enamel
    if (pos !== false) { const ang = Math.atan2(x, z), run = Math.sin(ang * 37 + Math.floor(y * 9) * 2.3) * 0.5 + 0.5, streak = run > 0.9 ? 0.6 : run > 0.84 ? 0.3 : 0; tmp.lerp(n > 0.7 ? rust2 : rust, Math.min(0.75, streak + (n > 0.9 ? 0.3 : 0))); }
    if (edge && UV) { const u = UV.getX(i), v = UV.getY(i), e = Math.min(u, 1 - u, v, 1 - v); if (e < 0.04) tmp.lerp(chip, 0.65 * (1 - e / 0.04) * (0.5 + n)); else if (e < 0.08) tmp.lerp(rust2, 0.18); }
    tmp.lerp(dirt, Math.min(0.65, Math.max(0, (0.3 - y) * 1.0) + Math.max(0, -ny) * 0.4));
    c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
function buildCode() {
  // the code-built cat moves its shoulders in and down a little from the desktop model's (a seated cat's front legs, not a robot's arms): offsets per arm chain
  const BO = [0.08, -0.1, -0.06], SO = [-0.08, -0.1, -0.06], BCH = ['beckonArm', 'beckonFore', 'beckonPaw', 'beckonCore', 'plate0', 'plate2', 'plate4'], SCH = ['slamArm', 'slamFore', 'slamS1', 'slamS2', 'slamS3', 'slamS4', 'slamPaw', 'slamCore', 'plate1', 'plate3', 'plate5'];
  const root = new THREE.Group(), bones = {}, list = [];
  for (const k in PIV) { if (k === 'screen') continue; const [x, y, z, p] = PIV[k], b = new THREE.Bone(); b.name = k; const pp = p ? PIV[p] : [0, 0, 0]; b.position.set(x - pp[0], y - pp[1], z - pp[2]); bones[k] = b; list.push(b); }
  for (const k in bones) { const p = PIV[k][3]; if (p) bones[p].add(bones[k]); }
  bones.beckonArm.position.add(V3(...BO)); bones.slamArm.position.add(V3(...SO));
  root.add(bones.base); root.updateMatrixWorld(true);
  const solid = [], glow = [], idx = {}; list.forEach((b, i) => { idx[b.name] = i; });
  const part = (geo, bone, color, M, opts) => { if (M) geo.applyMatrix4(M); const o = BCH.includes(bone) ? BO : SCH.includes(bone) ? SO : null; if (o) geo.translate(o[0], o[1], o[2]);
    // bend: the body's shape from the side: the chest pushed forward, and an S-curve down the back (the rounded back bulging behind, a dip at the neck)
    if (opts && opts.bend) { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i), z = P.getZ(i); if (z < 0) P.setZ(i, z - opts.bend * Math.max(0, Math.sin(Math.PI * (y - 0.45) / 0.85)));
      else P.setZ(i, z + 0.12 * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (y - 0.22) / 0.8)))) - 0.07 * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (y - 1.02) / 0.3))))); } }
    geo = geo.index ? geo.toNonIndexed() : geo; geo.computeVertexNormals(); grime(geo, color, !(opts && opts.clean), !!(opts && opts.edge)); geo.deleteAttribute('uv');
    const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = idx[bone]; sw[i * 4] = 1; }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); (opts && opts.glow ? glow : solid).push(geo); if (opts && opts.glow) geo.userData.glow = opts.glow; return geo; };
  const M = (x, y, z, sx, sy, sz, rx, ry, rz) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), V3(sx || 1, sy || 1, sz || 1));
  const rod = (bone, a, b, r, c, sides) => { const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), sides || 5); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d.clone().normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); part(g, bone, c, null, { clean: true }); };
  const tube = (bone, pts, r, c, seg) => part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V3(p[0], p[1], p[2]))), seg || 8, r, 5, false), bone, c, null, { clean: true });
  // dark, dirty colours (nothing but lamps and screen lines lighter than mid-grey): worn enamel, dull oxide red, gunmetal, steel, rubber, verdigris
  // OWNER 20:44 'closer to white': aged ivory enamel; RED is now a gunmetal-painted replacement plate (no red collar or trim: the hidden lucky cat in the base is the white cat
  // with a red collar, a gold bell and a coin, so the boss must not copy them); EARIN = the muted inner ear
  const CREAM = 0xc9c1ad, RED = 0x4a4b47, EARIN = 0x6a4a40, DARK = 0x1a1915, STEEL = 0x4c4a45, CHROME = 0x6c6a64, RUB = 0x121110, COP = 0x41604f;
  // a curved plate: a patch of an ellipsoid (three.js sphere angles; phi 1.5 pi faces the front, -z), chipped at its edges
  const plate = (bone, c, r, p0, pl, t0, tl, color, sw, sh, bend) => { const g = new THREE.SphereGeometry(1, sw || 4, sh || 3, p0, pl, t0, tl); g.scale(r[0], r[1], r[2]); g.translate(c[0], c[1], c[2]); part(g, bone, color, null, { edge: true, bend }); };
  // an ellipsoid of plates with gaps over a dark core: 8 sectors x 3 bands; skip(sector, band) leaves a plate out
  const shell = (bone, c, r, color, gaps, skip, sw, bend) => {
    { const g = new THREE.SphereGeometry(1, 10, 7); g.scale(r[0] * 0.93, r[1] * 0.93, r[2] * 0.93); g.translate(c[0], c[1], c[2]); part(g, bone, DARK, null, { clean: true, bend }); }
    const T = [[0.1, 0.95], [1.1, 0.95], [2.1, 0.95]];
    T.forEach(([t0, tl], ti) => { for (let k = 0; k < 8; k++) { if (skip && skip(k, ti)) continue; plate(bone, c, r, k / 8 * Math.PI * 2 + gaps, Math.PI / 4 - gaps * 2, t0, tl, typeof color === 'function' ? color(k, ti) : color, sw || 3, 3, bend); } }); };
  const rivet = (bone, x, y, z) => part(new THREE.BoxGeometry(0.016, 0.016, 0.016), bone, STEEL, M(x, y, z), { clean: true });
  const frontOf = (k) => { const mid = (k + 0.5) / 8 * Math.PI * 2; return Math.abs(Math.atan2(Math.sin(mid - 1.5 * Math.PI), Math.cos(mid - 1.5 * Math.PI))); };
  // ---- base: octagonal shopfront plinth on rollers; big round haunches of plates (a seated cat); hind feet with steel toes; the tail curling round the base to the front
  part(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 8, 1), 'base', RED, M(0, 0.1, 0, 1, 1, 1, 0, Math.PI / 8));
  part(new THREE.CylinderGeometry(0.53, 0.53, 0.03, 8, 1), 'base', DARK, M(0, 0.015, 0, 1, 1, 1, 0, Math.PI / 8));
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * Math.PI * 2; rivet('base', Math.sin(a) * 0.6, 0.16, Math.cos(a) * 0.6); }
  for (const s of [-1, 1]) {
    shell('base', [s * 0.3, 0.44, 0.04], [0.23, 0.27, 0.37], CREAM, 0.05, null, 3);
    part(new THREE.BoxGeometry(0.15, 0.08, 0.14), 'base', CREAM, M(s * 0.3, 0.24, -0.42), { edge: true });
    for (const k of [-1, 0, 1]) part(new THREE.CylinderGeometry(0.02, 0.022, 0.1, 5), 'base', STEEL, M(s * 0.3 + k * 0.045, 0.23, -0.51, 1, 1, 1, Math.PI / 2), { clean: true });
    part(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), 'base', DARK, M(s * 0.5, 0.42, 0.04, 1, 1, 1, 0, 0, Math.PI / 2));
  }
  { const pts = [[0.0, 0.3, 0.4], [0.06, 0.24, 0.6], [0.14, 0.34, 0.78], [0.2, 0.62, 0.84], [0.22, 0.86, 0.74], [0.2, 0.94, 0.6], [0.17, 0.88, 0.52]]; tube('base', pts, 0.055, DARK, 14);
    const c = new THREE.CatmullRomCurve3(pts.map((p) => V3(p[0], p[1], p[2]))); for (let k = 1; k < 10; k++) { const p = c.getPoint(k / 10), t = c.getTangent(k / 10); const g = new THREE.TorusGeometry(0.06, 0.012, 4, 10); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), t)); g.translate(p.x, p.y, p.z); part(g, 'base', STEEL, null, { clean: true }); } }
  // ---- body: a round pear (wide at the base, the chest pushed forward) of big curved plates with gaps over a dark frame; one side plate gone (ribs, a cable)
  const prof = (o) => [[0.36, 0.2], [0.4, 0.34], [0.39, 0.52], [0.35, 0.72], [0.3, 0.9], [0.24, 1.06], [0.18, 1.2], [0.14, 1.3]].map((q) => [q[0] + o, q[1]]);
  { const g = new THREE.LatheGeometry(prof(-0.03).map((q) => new THREE.Vector2(q[0], q[1])), 10); g.scale(1, 1, 0.9); part(g, 'body', DARK, null, { clean: true, bend: 0.06 }); }
  const BANDS = [[0.21, 0.62], [0.64, 1.06], [1.08, 1.29]], SEC = 5;
  BANDS.forEach(([y0, y1], bi) => { const pr = prof(0.004).filter((q) => q[1] >= y0 - 0.2 && q[1] <= y1 + 0.2).map((q) => [q[0], Math.max(y0, Math.min(y1, q[1]))]);
    for (let k = 0; k < SEC; k++) { const p0 = k / SEC * Math.PI * 2 + 0.03 + Math.PI - Math.PI / SEC, mid = p0 + Math.PI / SEC, front = Math.abs(Math.atan2(Math.sin(mid - Math.PI), Math.cos(mid - Math.PI))) < 0.5;
      if (bi === 0 && k === 1) continue;
      if (bi === 1 && front) continue;
      const g = new THREE.LatheGeometry(pr.map((q) => new THREE.Vector2(q[0], q[1])), 4, p0, Math.PI * 2 / SEC - 0.06); g.scale(1, 1, 0.9); part(g, 'body', (bi === 2 && front) ? RED : CREAM, null, { edge: true, bend: 0.06 });
      for (let r = 0; r < 3; r++) { const a = p0 + (r + 0.5) / 3 * (Math.PI * 2 / SEC - 0.06), rr = pr[pr.length - 1][0] + 0.006; rivet('body', Math.sin(a) * rr, y1 - 0.02, Math.cos(a) * rr * 0.9); } } });
  { const a0 = 1 / SEC * Math.PI * 2 + 0.03 + Math.PI - Math.PI / SEC + 0.6; for (const y of [0.3, 0.42, 0.54]) rod('body', V3(Math.sin(a0 - 0.5) * 0.36, y, Math.cos(a0 - 0.5) * 0.32), V3(Math.sin(a0 + 0.5) * 0.36, y, Math.cos(a0 + 0.5) * 0.32), 0.012, STEEL);
    tube('body', [[Math.sin(a0) * 0.35, 0.6, Math.cos(a0) * 0.31], [Math.sin(a0 + 0.2) * 0.38, 0.42, Math.cos(a0 + 0.2) * 0.34], [Math.sin(a0 + 0.3) * 0.39, 0.25, Math.cos(a0 + 0.3) * 0.35]], 0.013, 0x5a160e); }
  part(new THREE.TorusGeometry(0.3, 0.014, 3, 18), 'body', STEEL, M(0, 0.63, -0.02, 1, 1, 0.9, Math.PI / 2), { clean: true });
  part(new THREE.TorusGeometry(0.16, 0.035, 4, 14), 'body', RED, M(0, 1.27, -0.03, 1, 1, 0.85, Math.PI / 2));
  part(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), 'body', DARK, M(0, 0.86, -0.33, 1, 1.25, 1, Math.PI / 2));
  // shoulder joint drums with a dark gap, hoses
  for (const s of [-1, 1]) { part(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 10), 'body', DARK, M(s * 0.26, 1.05, -0.13, 1, 1, 1, 0, 0, Math.PI / 2)); part(new THREE.TorusGeometry(0.09, 0.013, 3, 10), 'body', STEEL, M(s * 0.3, 1.05, -0.13, 1, 1, 1, 0, Math.PI / 2), { clean: true });
    tube('body', [[s * 0.18, 1.12, 0.05], [s * 0.27, 0.98, 0.16], [s * 0.3, 0.75, 0.2]], 0.016, RUB); }
  // ---- neck: a dark column, three pistons and two cables in the gap under the head
  part(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 8), 'body', DARK, M(0, 1.33, -0.06));
  for (const a of [0.5, 2.6, 4.7]) rod('body', V3(Math.sin(a) * 0.12, 1.27, -0.06 + Math.cos(a) * 0.1), V3(Math.sin(a) * 0.1, 1.4, -0.08 + Math.cos(a) * 0.08), 0.02, CHROME, 6);
  tube('body', [[-0.08, 1.27, 0.04], [-0.13, 1.33, 0.0], [-0.1, 1.41, -0.04]], 0.012, 0x5a160e); tube('body', [[0.09, 1.27, 0.05], [0.13, 1.34, 0.02], [0.1, 1.41, -0.02]], 0.012, 0x6a5010);
  // ---- head: a cat skull of plates (wide, a little flattened) with wide cheeks and a tapered muzzle, the CRT set INTO the face as its face plate,
  // big triangular ears standing clear above it (the right a riveted pyramid with a red inner plate, the left torn to its full triangular frame), whisker rods, antenna, broken lamp
  const HC = [0, 1.68, -0.1], HR = [0.44, 0.31, 0.35];
  shell('head', HC, HR, (k, ti) => (ti === 1 && k === 7) ? RED : CREAM, 0.035, (k, ti) => (ti === 1 && frontOf(k) < 1.0) || (ti === 0 && k === 2), 3);
  for (const s of [-1, 1]) shell('head', [s * 0.25, 1.56, -0.22], [0.19, 0.15, 0.17], CREAM, 0.05, (k, ti) => ti === 0 || (s < 0 ? k === 5 || k === 6 : k === 0 || k === 1), 3);
  shell('head', [0, 1.48, -0.47], [0.16, 0.1, 0.17], CREAM, 0.05, (k, ti) => ti === 0, 3);
  // the CRT face plate: the screen sits in a shallow dark well with a thin bezel, flush with the face
  const SW = 0.42, SH = 0.24, SY = 1.7, SZ = -0.43;
  part(new THREE.BoxGeometry(SW + 0.02, SH + 0.02, 0.1), 'head', DARK, M(0, SY, SZ + 0.06), { clean: true });
  for (const [x, y, w, h] of [[0, SY + SH / 2 + 0.018, SW + 0.07, 0.035], [0, SY - SH / 2 - 0.018, SW + 0.07, 0.035], [-SW / 2 - 0.018, SY, 0.035, SH], [SW / 2 + 0.018, SY, 0.035, SH]]) part(new THREE.BoxGeometry(w, h, 0.04), 'head', STEEL, M(x, y, SZ + 0.005), { edge: true });
  for (const [x, y] of [[-0.22, 1.83], [0.22, 1.83], [-0.22, 1.57], [0.22, 1.57]]) rivet('head', x, y, SZ - 0.02);
  part(new THREE.BoxGeometry(0.008, 0.1, 0.14), 'head', DARK, M(0, 1.46, -0.57), { clean: true });
  for (const s of [-1, 1]) { rivet('head', s * 0.09, 1.51, -0.6); rivet('head', s * 0.09, 1.44, -0.59);
    part(new THREE.CylinderGeometry(0.035, 0.04, 0.05, 6), 'head', DARK, M(s * 0.15, 1.48, -0.55, 1, 1, 1, Math.PI / 2));
    for (const dy of [0.025, 0, -0.025]) { const bend = (dy > 0 && s > 0) || (dy < 0 && s < 0) ? -0.07 : 0; rod('head', V3(s * 0.15, 1.48, -0.57), V3(s * 0.56, 1.48 + dy * 3.4 + bend, -0.6), 0.008, STEEL, 4); } }
  // hanging jaw plate with loose cables
  part(new THREE.BoxGeometry(0.22, 0.09, 0.02), 'jaw', CREAM, M(0, 1.36, -0.53, 1, 1, 1, -0.6), { edge: true });
  tube('jaw', [[0.07, 1.4, -0.5], [0.09, 1.33, -0.56], [0.08, 1.24, -0.56]], 0.008, 0x5a160e); tube('jaw', [[-0.06, 1.4, -0.5], [-0.08, 1.32, -0.55], [-0.05, 1.26, -0.53]], 0.007, RUB);
  // ears: 0.36 tall (more than a third of the head), standing clear above the skull
  part(new THREE.ConeGeometry(0.17, 0.38, 4, 1), 'head', CREAM, M(0.26, 2.05, -0.12, 1, 1, 0.42, 0, Math.PI / 4, -0.28), { edge: true });
  part(new THREE.ConeGeometry(0.1, 0.26, 4, 1), 'head', EARIN, M(0.255, 2.02, -0.17, 1, 1, 0.25, 0, Math.PI / 4, -0.28));
  for (const f of [0.25, 0.5, 0.75]) rivet('head', 0.26 + (0.08 - 0.16 * f) * 0, 1.88 + f * 0.04, -0.2 + 0 * f);
  { const b0 = V3(-0.1, 1.9, -0.11), b1 = V3(-0.42, 1.82, -0.13), tip = V3(-0.33, 2.25, -0.14); rod('head', b0, tip, 0.016, STEEL); rod('head', tip, b1, 0.016, STEEL); rod('head', b1, b0, 0.016, STEEL);
    part(new THREE.BoxGeometry(0.15, 0.11, 0.02), 'head', CREAM, M(-0.24, 1.93, -0.12, 1, 1, 1, 0, 0, 0.3), { edge: true }); rod('head', V3(-0.2, 1.98, -0.12), V3(-0.15, 1.88, -0.2), 0.006, 0x6a5010); }
  rod('head', V3(-0.05, 1.98, 0.02), V3(-0.09, 2.3, 0.08), 0.008, STEEL); part(new THREE.BoxGeometry(0.06, 0.04, 0.06), 'head', DARK, M(0.12, 1.98, 0.04, 1, 1, 1, 0.4, 0, 0.3));
  // ---- bell, coin, shutters
  part(new THREE.CylinderGeometry(0.045, 0.08, 0.1, 9), 'bell', COP, M(0, 1.17, -0.265)); part(new THREE.TorusGeometry(0.08, 0.01, 3, 9), 'bell', DARK, M(0, 1.12, -0.265, 1, 1, 1, Math.PI / 2), { clean: true });
  part(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 14), 'coin', COP, M(0, 0.86, -0.3, 1, 1, 1.22, Math.PI / 2));
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; part(new THREE.BoxGeometry(0.03, 0.1, 0.01), 'coin', DARK, M(Math.sin(a) * 0.08, 0.86 + Math.cos(a) * 0.1, -0.322, 1, 1, 1, 0, 0, -a), { clean: true }); }
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.17, 0.3, 0.02), s < 0 ? 'coreDoorL' : 'coreDoorR', RED, M(s * 0.085, 0.86, -0.35), { edge: true });
  // ---- beckoning arm (the raised front leg): struts, an elbow drum, a ram, guard plates, a wide paw with four fingers and a palm pad round the core
  const strut = (bone, x, y0, y1, z, r) => { part(new THREE.CylinderGeometry(r, r * 0.8, y0 - y1, 6), bone, DARK, M(x, (y0 + y1) / 2, z)); rod(bone, V3(x + 0.04, y0 - 0.02, z + 0.05), V3(x + 0.035, y1 + 0.03, z + 0.05), 0.012, CHROME); };
  strut('beckonArm', -0.38, 1.1, 0.87, -0.06, 0.05); strut('beckonFore', -0.38, 0.83, 0.6, -0.06, 0.045);
  part(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), 'beckonFore', DARK, M(-0.38, 0.85, -0.06, 1, 1, 1, 0, 0, Math.PI / 2));
  part(new THREE.BoxGeometry(0.13, 0.2, 0.04), 'plate2', CREAM, M(-0.38, 1.0, -0.12), { edge: true }); part(new THREE.BoxGeometry(0.11, 0.17, 0.04), 'plate4', CREAM, M(-0.38, 0.72, -0.11), { edge: true });
  plate('plate0', [-0.41, 1.17, -0.06], [0.13, 0.11, 0.13], 0, Math.PI * 2, 0, 1.4, RED, 6, 3);
  part(new THREE.BoxGeometry(0.26, 0.24, 0.08), 'beckonPaw', CREAM, M(-0.38, 0.45, -0.06), { edge: true });
  for (let k = 0; k < 4; k++) { part(new THREE.CylinderGeometry(0.026, 0.022, 0.12, 5), 'beckonPaw', k === 1 ? RED : CREAM, M(-0.47 + 0.06 * k, 0.28, -0.08, 1, 1, 1, 0.4)); rivet('beckonPaw', -0.47 + 0.06 * k, 0.34, -0.105); }
  part(new THREE.TorusGeometry(0.095, 0.022, 4, 12), 'beckonPaw', RUB, M(-0.38, 0.44, -0.1));
  // ---- slam arm (the lower front leg): shoulder cowl, a heavy strut, the boom housing and four telescoping sleeves, the stamp paw with pads and claws
  plate('plate1', [0.41, 1.17, -0.06], [0.13, 0.11, 0.13], 0, Math.PI * 2, 0, 1.4, CREAM, 6, 3);
  strut('slamArm', 0.38, 1.1, 0.93, -0.06, 0.055); part(new THREE.BoxGeometry(0.13, 0.16, 0.04), 'plate3', CREAM, M(0.38, 1.02, -0.12), { edge: true });
  part(new THREE.BoxGeometry(0.15, 0.17, 0.15), 'slamFore', DARK, M(0.38, 0.845, -0.06), { edge: true }); part(new THREE.BoxGeometry(0.15, 0.14, 0.02), 'plate5', CREAM, M(0.38, 0.84, -0.145), { edge: true });
  for (let k = 1; k <= 4; k++) { const r = 0.07 - 0.008 * k, y0 = PIV['slamS' + k][1]; part(new THREE.CylinderGeometry(r, r, 0.14, 6), 'slamS' + k, k % 2 ? STEEL : CHROME, M(0.38, y0 - 0.06, -0.06), { clean: true }); part(new THREE.TorusGeometry(r + 0.008, 0.01, 3, 6), 'slamS' + k, DARK, M(0.38, y0 - 0.12, -0.06, 1, 1, 1, Math.PI / 2), { clean: true }); }
  part(new THREE.CylinderGeometry(0.14, 0.15, 0.22, 8), 'slamPaw', CREAM, M(0.38, 0.18, -0.06), { edge: true }); part(new THREE.CylinderGeometry(0.15, 0.13, 0.05, 8), 'slamPaw', RUB, M(0.38, 0.05, -0.06));
  for (let k = 0; k < 3; k++) { const a = -0.6 + 0.6 * k; part(new THREE.ConeGeometry(0.02, 0.07, 4), 'slamPaw', DARK, M(0.38 + Math.sin(a) * 0.15, 0.03, -0.06 - Math.cos(a) * 0.15, 1, 1, 1, Math.PI - 0.4, a)); }
  part(new THREE.TorusGeometry(0.095, 0.02, 4, 12), 'slamPaw', STEEL, M(0.38, 0.17, -0.2), { clean: true });
  for (const pl of ['plate6', 'plate7']) { const x = PIV[pl][0] < 0 ? -1 : 1; part(new THREE.BoxGeometry(0.08, 0.2, 0.03), pl, x < 0 ? CREAM : RED, M(x * 0.36, 1.62, -0.3, 1, 1, 1, 0, x * 0.7), { edge: true }); }
  for (const pl of ['plate8', 'plate9']) { const [x, y, z] = PIV[pl]; part(new THREE.BoxGeometry(0.22, 0.2, 0.025), pl, CREAM, M(x, y - 0.12, z - 0.02, 1, 1, 1, 0, x < 0 ? 0.35 : -0.35), { edge: true }); }
  // ---- lights (the glow mesh): cores, coin heart, bell bulb, small lamps, red standby lights; the eyes are drawn on the CRT screen
  const lamp = (bone, x, y, z, r, key, flat) => part(flat ? new THREE.CircleGeometry(r, 10) : new THREE.SphereGeometry(r, 6, 4), bone, 0xffffff, flat ? M(x, y, z, 1, 1, 1, 0, Math.PI) : M(x, y, z, 1, 1, 0.5), { glow: key, clean: true });
  lamp('beckonCore', -0.38, 0.44, -0.112, 0.075, 'beckonCore', true); lamp('slamCore', 0.38, 0.17, -0.225, 0.076, 'slamCore', true);
  lamp('coin', 0, 0.86, -0.33, 0.045, 'coin'); lamp('bell', 0, 1.14, -0.265, 0.042, 'bell');
  for (const s of [-1, 1]) lamp('head', s * 0.3, 1.6, -0.36, 0.022, 'lamp'); lamp('head', 0, 1.56, -0.62, 0.024, 'lamp'); lamp('head', -0.09, 2.31, 0.08, 0.02, 'standby');
  for (const [x, y, z] of [[0.2, 1.1, -0.22], [-0.27, 0.62, -0.3], [0.33, 0.4, 0.2], [-0.2, 0.95, 0.27], [0.33, 0.1, -0.45]]) lamp('body', x, y, z, 0.014, 'standby');
  const mk = (geos, mat) => { const g = mergeGeometries(geos, false); for (const q of geos) q.dispose(); const sk = new THREE.Skeleton(list), m = new THREE.SkinnedMesh(g, mat); m.add(bones.base); m.bind(sk); m.boundingSphere = bigSphere(g); return m; };
  root.remove(bones.base);
  // Phong with flat shading for hard highlights on the metal edges; its own lamps light the paint a little at night (CONFIG.boss.view.selfLit), tinted by each part's own colour
  // (the night's strong sky fill washed the first in-game picture pale: a softer highlight and a little less light taken in, so it keeps the approved dark colours)
  const bm = new THREE.MeshPhongMaterial({ vertexColors: true, fog: !VW.fogOff, shininess: 24, specular: 0x2e2c26, flatShading: true, color: 0xc8c8c8 });
  bm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'); };
  bm.customProgramCacheKey = () => 'bossVcEmissive';
  const body = mk(solid, bm);
  // the glow mesh keeps per-light vertex ranges so each light can change colour alone
  const ranges = {}; let at = 0; for (const g of glow) { const n = g.attributes.position.count, k = g.userData.glow; (ranges[k] = ranges[k] || []).push([at, n]); at += n; }
  const gl = mergeGeometries(glow, false); for (const q of glow) q.dispose(); const gm = new THREE.SkinnedMesh(gl, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false })); gm.bind(body.skeleton, body.matrixWorld); gm.boundingSphere = bigSphere(gl);
  root.add(body); root.add(gm);
  const C = gl.attributes.color;
  const setGlow = (key, c, k) => { const r = ranges[key]; if (!r) return; const cc = col(c).multiplyScalar(k); for (const [a, n] of r) for (let i = a; i < a + n; i++) C.setXYZ(i, cc.r, cc.g, cc.b); C.needsUpdate = true; };
  bossState.tris = (body.geometry.attributes.position.count + gl.attributes.position.count) / 3;
  return { root, nodes: bones, setGlow, kind: 'code', mats: [body.material], solid: body, screenEyes: true, screenAt: [0, SY - PIV.head[1], SZ - 0.012 - PIV.head[2]], screenSize: [SW, SH] };
}

// ---------------------------------------------------------------- DESKTOP: the Blender model
let tpl = null;
function loadModel() {
  if (bossState.model !== 'none') return; bossState.model = 'loading';
  if (!MODEL.startsWith('data:') && location.protocol === 'file:') { bossState.model = 'failed'; return; }
  const fail = (e) => { bossState.model = 'failed'; console.warn('boss model not loaded', e); };
  fetch(MODEL).then((r) => { if (!r.ok) throw new Error('no file'); return r.arrayBuffer(); }).then((buf) => new GLTFLoader().parse(buf, '', (g) => { tpl = g.scene; bossState.model = 'ready'; tpl.traverse((o) => { if (o.isMesh) o.geometry.userData.shared = true; });
    // LAG FIX Nov 19: the parts drawn as one skinned mesh per material (src/glbmerge.js; the lens parts keep their own glow materials), before the far copies are made
    mergeGlb(tpl, (o) => o.material.name !== 'gloom_lens', CONFIG.lag.glbMerge.bossPad); lodPrepare(tpl, 'boss', false); if (bossHooks.ready) try { bossHooks.ready(tpl); } catch (e) { /* warm-up only */ } }, fail)).catch(fail);
}
// desktop: start loading the Blender model when a run on the boss ring starts (main.js startRun), so it is ready before the boss rises 1 s into the night
// (a night begun straight from the street, or with Dusk at once, left too little time and the code-built stand-in stayed all night)
export function bossPreload() { if (DESK && VW.glb) loadModel(); }
// bossHooks.ready(scene): main.js uploads the model's maps while it loads (LAG FIX Nov 19), not at the boss's first frame
export const bossHooks = { ready: null };
function buildGlb() {
  const sc = tpl.clone(true), nodes = {}, mats = [], glows = {}, byBase = new Map(); rebindMerged(tpl, sc);
  sc.traverse((o) => { if (o.name && PIV[o.name] !== undefined && !nodes[o.name]) nodes[o.name] = o; });
  const lensFor = (name) => { const m = new THREE.MeshBasicMaterial({ color: 0x111111, fog: false, toneMapped: false }); glows[name] = m; return m; };
  // LAG FIX Nov 19: the model's parts are rigid (moved by their nodes), so they are culled again like any mesh (they were drawn even when off screen)
  sc.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    const m0 = o.material; if (m0.name === 'gloom_lens') { let p = o.parent, key = 'lamp'; while (p) { if (['eyeL', 'eyeR', 'beckonCore', 'slamCore', 'coin', 'bell'].includes(p.name)) { key = p.name; break; } p = p.parent; } o.material = glows[key] || lensFor(key); return; }
    // one copy per model material (LAG FIX Nov 19; was one per part): every change the boss makes to them (m.mats) is the same for all, so nothing looks different,
    // and the merged mesh and its parts share it
    if (!o.userData.bossMat) { let m = byBase.get(m0); if (!m) { m = m0.clone(); m.fog = !VW.fogOff; if (m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0x000000); } byBase.set(m0, m); mats.push(m); } o.material = m; o.userData.bossMat = true; } });
  // small red standby lights on the body (the code-built cat has them in its glow mesh)
  if (nodes.body) { const sm = lensFor('standby'), sg = new THREE.SphereGeometry(0.014, 6, 4); for (const [x, y, z] of [[0.2, 1.1, -0.2], [-0.25, 0.62, -0.27], [0.33, 0.4, 0.15], [-0.18, 0.95, 0.27]]) { const me = new THREE.Mesh(sg, sm); me.position.set(x - PIV.body[0], y - PIV.body[1], z - PIV.body[2]); nodes.body.add(me); } }
  const setGlow = (key, c, k) => { const m = glows[key]; if (m) m.color.set(c).multiplyScalar(k); };
  let n = 0; sc.traverse((o) => { if (o.isMesh && !o.userData.hitOnly) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); bossState.tris = n;
  // v2 model (owner 18:51): the CRT face plate is 0.42 x 0.24 and the screen draws the eyes, like the approved phone build
  lodCopy(sc, 'boss');
  return { root: sc, nodes, setGlow, kind: 'glb', mats, screenEyes: true, screenSize: [0.42, 0.24] };
}

// ---------------------------------------------------------------- PHYSICS loader (desktop only; a script tag, so phones never fetch it)
// LAG FIX Nov 19 (owner 07:10): the night card fetches the physics file before the fight, so the first scrap does not wait on it (desktop only, as before)
export function physicsPreload() { loadPhysics(); }
function loadPhysics() {
  if (bossState.physics !== 'none' || !DESK || !PH.on) return; bossState.physics = 'loading';
  try { const s = document.createElement('script'); s.src = PHYS; s.onload = () => { bossState.physics = window.__bossPhysics ? 'ready' : 'failed'; }; s.onerror = () => { bossState.physics = 'failed'; }; document.head.appendChild(s); } catch (e) { bossState.physics = 'failed'; }
}

// ---------------------------------------------------------------- one boss night
let V = null;
const scratch = { q: new THREE.Quaternion(), q2: new THREE.Quaternion(), m: new THREE.Matrix4(), v: V3(0, 0, 0), v2: V3(0, 0, 0) };
function worldPos(o, out) { return o.getWorldPosition(out || V3(0, 0, 0)); }
// turn node o so its local -y points along dir (world) and its local -z leans toward front (world)
function aim(o, dir, front) {
  const y = dir.clone().normalize().negate(); let z = front.clone().addScaledVector(y, -front.dot(y)); if (z.lengthSq() < 1e-6) z = V3(0, 0, 1).addScaledVector(y, -y.z); z.normalize().negate();
  const x = V3(0, 0, 0).crossVectors(y, z).normalize(); z.crossVectors(x, y);
  const qw = new THREE.Quaternion().setFromRotationMatrix(scratch.m.makeBasis(x, y, z)); o.parent.getWorldQuaternion(scratch.q); o.quaternion.copy(scratch.q.invert().multiply(qw));
  o.updateMatrixWorld(true);
}
function slerpTo(o, qLocal, k) { o.quaternion.slerp(qLocal, k); }

function build(sim) {
  const B = sim.boss, useGlb = DESK && VW.glb && bossState.model === 'ready';
  const m = useGlb ? buildGlb() : buildCode();
  const g = new THREE.Group(); g.name = 'beckoner'; g.add(m.root);
  m.root.scale.setScalar(S); m.root.rotation.y = Math.atan2(B.x, B.z); m.root.position.set(B.x, -VW.riseDepth, B.z);
  const scr = makeScreen(!!m.screenEyes); const sp = PIV.screen; if (m.screenSize) scr.mesh.scale.set(m.screenSize[0] / 0.46, m.screenSize[1] / 0.28, 1);
  if (m.nodes.screen) m.nodes.screen.add(scr.mesh); else { m.nodes.head.add(scr.mesh); if (m.screenAt) scr.mesh.position.set(...m.screenAt); else scr.mesh.position.set(sp[0] - PIV.head[0], sp[1] - PIV.head[1], sp[2] - PIV.head[2]); }
  // bind pose of every node (to blend from)
  const bind = {}; for (const k in m.nodes) bind[k] = { p: m.nodes[k].position.clone(), q: m.nodes[k].quaternion.clone() };
  // the slam warning: a ring that fills from amber to red, a growing shadow; the summon halo; the scissor boom; sparks
  const flat = (geo, c, o) => { const me = new THREE.Mesh(geo, new THREE.MeshBasicMaterial(Object.assign({ color: c, transparent: true, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }, o || {}))); me.rotation.x = -Math.PI / 2; me.visible = false; me.renderOrder = 3; g.add(me); return me; };
  const ring = flat(new THREE.RingGeometry(BC.slam.ring - 0.25, BC.slam.ring, 40), VW.ring[0], { opacity: 0.95 }), fill = flat(new THREE.CircleGeometry(1, 40), VW.ring[0], { opacity: 0.35 }), shadow = flat(new THREE.CircleGeometry(1, 24), 0x000000, { opacity: 0.0 });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: VW.teal, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.visible = false; halo.scale.setScalar(VW.halo); g.add(halo);
  const SC = VW.scissor, bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, SC.bar, SC.bar * 0.6), new THREE.MeshStandardMaterial({ color: 0x5c5248, roughness: 0.75, metalness: 0.55, fog: !VW.fogOff }), SC.cells * 2); bars.visible = false; bars.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40); g.add(bars);
  const spk = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffd080, size: 0.12, fog: false, transparent: true, depthWrite: false })); spk.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VW.sparks * 3 * 4), 3)); spk.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40); g.add(spk);
  // a steel grille over the coin (both tiers), on the body node
  let grille = null; if (m.nodes.body) { grille = new THREE.Group(); const bm = new THREE.MeshStandardMaterial({ color: 0x3e3c36, roughness: 0.6, metalness: 0.7, fog: !VW.fogOff }), bg = new THREE.BoxGeometry(0.018, 0.34, 0.018);
    for (const x of [-0.08, 0, 0.08]) { const b = new THREE.Mesh(bg, bm); b.position.set(x, 0.86 - 0.2, -0.305); grille.add(b); } const hb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.018), bm); hb.position.set(0, 0.66, -0.305); grille.add(hb); m.nodes.body.add(grille); }
  V = { grille, sim, B, m, g, scr, bind, ring, fill, shadow, halo, bars, spk, sparks: [], t: 0, shakeT: 0, shakeA: 0, riseT: 0, pieces: [], phys: null, dawnT: -1, broken: { beckon: false, slam: false }, slamPos: null, gone: new Set(), restQ: {}, lookT: 0, twitch: { t: 2, yaw: 0, pitch: 0 }, eyeFlick: 0, coreOpen: 0 };
  bossState.built = m.kind; bossState.pieces = 0; bossState.events = [];
  return V;
}
let haloT = null;
function haloTex() { if (haloT) return haloT; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); haloT = new THREE.CanvasTexture(c); return haloT; }

// ---------------------------------------------------------------- sounds (made here, like the game's other sounds)
function tone(a, f0, f1, len, vol, type, at) { if (!a) return; const t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + len + 0.05); }
function noise(a, len, vol, lp) { if (!a) return; const t = a.currentTime, b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; const g = a.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); }
const SFX = {
  bell: (a) => { for (const [f, v] of [[392, 0.22], [587, 0.12], [784, 0.07], [1176, 0.04]]) tone(a, f, f * 0.995, 3.2, v, 'sine'); },
  thud: (a) => { tone(a, 70, 28, 0.7, 0.9, 'sine'); noise(a, 0.6, 0.7, 700); tone(a, 220, 180, 0.9, 0.12, 'triangle', 0.05); },
  creak: (a, len) => { tone(a, 140, 260, len, 0.08, 'sawtooth'); },
  clang: (a) => { tone(a, 1240, 1180, 0.35, 0.18, 'triangle'); tone(a, 1860, 1800, 0.25, 0.08, 'sine'); noise(a, 0.08, 0.25, 5000); },
  breakIt: (a) => { noise(a, 0.9, 0.8, 2400); tone(a, 330, 90, 0.8, 0.3, 'square'); },
  rise: (a) => { noise(a, 3.5, 0.5, 300); tone(a, 42, 60, 4.5, 0.5, 'sine'); },
  down: (a) => { tone(a, 520, 60, 2.6, 0.18, 'sawtooth'); },
};

// ---------------------------------------------------------------- falling pieces
function addPiece(name, vel, spin) {
  if (!V || V.gone.has(name) || V.pieces.length >= PH.max) return; const o = V.m.nodes[name]; if (!o) return; V.gone.add(name);
  const pc = PIECE[name] || [0, 0, 0, 0.1, 0.1, 0.1], wrap = new THREE.Group(); o.updateMatrixWorld(true);
  const c = V3(pc[0], pc[1], pc[2]).multiplyScalar(S).applyQuaternion(o.getWorldQuaternion(scratch.q)); wrap.position.copy(worldPos(o).add(c)); V.g.add(wrap); wrap.updateMatrixWorld(true); wrap.attach(o);
  const h = [pc[3] * S, pc[4] * S, pc[5] * S], p = { o, wrap, h, v: vel.clone(), w: spin.clone(), t: 0, id: 0 };
  if (V.phys) { const q = wrap.quaternion; p.id = V.phys.add(h[0], h[1], h[2], [wrap.position.x, wrap.position.y, wrap.position.z], [q.x, q.y, q.z, q.w], [vel.x, vel.y, vel.z], [spin.x, spin.y, spin.z], 2 + h[0] * h[1] * h[2] * 8); }
  V.pieces.push(p); bossState.pieces = V.pieces.length;
}
function stepPieces(dt) {
  if (!V.pieces.length) return;
  if (V.phys) V.phys.step(dt);
  for (const p of V.pieces) {
    p.t += dt;
    if (p.t > PH.life + PH.fade) { if (p.wrap.visible) { p.wrap.position.y -= dt * 0.15; if (p.t > PH.life + PH.fade + 6) p.wrap.visible = false; } continue; }
    if (p.t > PH.life) { if (p.id && V.phys) { V.phys.remove(p.id); p.id = 0; } continue; }
    if (p.id && V.phys) { const s = V.phys.get(p.id); if (s) { p.wrap.position.set(s.p[0], s.p[1], s.p[2]); p.wrap.quaternion.set(s.q[0], s.q[1], s.q[2], s.q[3]); } continue; }
    // phones: scripted fall, a bounce or two, no collisions
    p.v.y += PH.g * dt; p.wrap.position.addScaledVector(p.v, dt); const lo = Math.min(p.h[0], p.h[1], p.h[2]);
    if (p.wrap.position.y < lo) { p.wrap.position.y = lo; p.v.y = Math.abs(p.v.y) * PH.bounce; p.v.x *= 0.6; p.v.z *= 0.6; p.w.multiplyScalar(0.55); if (Math.abs(p.v.y) < 0.6) p.v.y = 0; }
    const wl = p.w.length(); if (wl > 1e-3) p.wrap.quaternion.premultiply(scratch.q2.setFromAxisAngle(scratch.v.copy(p.w).divideScalar(wl), wl * dt));
  }
}
function sparks(at) { for (let i = 0; i < VW.sparks; i++) V.sparks.push({ p: at.clone(), v: V3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6), t: VW.sparkLife * (0.5 + Math.random() * 0.5) }); if (V.sparks.length > VW.sparks * 4) V.sparks.splice(0, V.sparks.length - VW.sparks * 4); }

// ---------------------------------------------------------------- the pose of one frame
function pose(dt, ctx) {
  const { B, m, sim } = V, N = m.nodes, R = m.root, now = sim.t, k = Math.min(1, dt * VW.follow);
  const toW = (x, y, z) => R.localToWorld(V3(x, y, z));
  const dirW = (x, y, z) => V3(x, y, z).applyQuaternion(R.quaternion).normalize();
  const fwd = dirW(0, 0, -1);
  // reset to bind, then pose (smoothly toward the wanted pose)
  const want = {};
  // RISE: up out of the street
  const r0 = BC.rise.at, r1 = BC.rise.at + BC.rise.dur;
  const rk = B.phase === 'wait' ? 0 : B.phase === 'rise' ? sm((now - r0) / BC.rise.dur) : 1;
  R.position.y = -VW.riseDepth * (1 - rk) + (B.phase === 'rise' ? Math.sin(now * 23) * 0.06 : 0);
  R.visible = B.phase !== 'wait';
  R.updateMatrixWorld(true);
  // the dawn / wreck collapse
  const down = B.phase === 'down' || B.phase === 'wreck', dk = down ? sm((V.dawnT) / VW.sag) : 0;
  // head: follows you a little, servo twitches; droops when it powers down
  { V.twitch.t -= dt; if (V.twitch.t <= 0) { V.twitch.t = 1.5 + Math.random() * 3; V.twitch.yaw = (Math.random() - 0.5) * 0.3; V.twitch.pitch = (Math.random() - 0.5) * 0.15; }
    const hp = worldPos(N.head), pl = V3(sim.player.x, 1.6, sim.player.z), d = pl.sub(hp); const yawTo = Math.atan2(-d.x, -d.z) - R.rotation.y; let yw = Math.atan2(Math.sin(yawTo), Math.cos(yawTo));
    yw = Math.max(-VW.look, Math.min(VW.look, yw)) + V.twitch.yaw; const pt = 0.12 + V.twitch.pitch - dk * 0.7;
    want.head = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pt, down ? yw * (1 - dk) : yw, down ? dk * 0.3 : 0, 'YXZ')); }
  want.body = new THREE.Quaternion().setFromEuler(new THREE.Euler(-dk * VW.tilt * 0.6, 0, dk * VW.tilt * 0.4));
  want.jaw = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15 - 0.2 * Math.max(0, Math.sin(now * 1.7)) - (B.act && B.act.kind === 'slam' ? 0.3 : 0), 0, 0));
  // chest shutters open when both paws are broken
  const co = B.paws.beckon.broken && B.paws.slam.broken ? 1 : 0; V.coreOpen += (co - V.coreOpen) * Math.min(1, dt * 2);
  // the shutters stand half open (the coin always shows behind its grille); fully open, and the grille gone, once both paws are broken
  want.coreDoorL = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -(0.75 + 0.85 * V.coreOpen), 0)); want.coreDoorR = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.75 + 0.85 * V.coreOpen, 0));
  if (V.grille) V.grille.visible = V.coreOpen < 0.5;
  for (const kk in want) if (N[kk] && !V.gone.has(kk)) slerpTo(N[kk], V.bind[kk].q.clone().multiply(want[kk]), k * 1.5);
  R.updateMatrixWorld(true);

  // BECKONING ARM: rest on the knee; raised to the summon point (the sim's weak point) with the palm to the house and the wrist flapping; limp when broken
  if (N.beckonArm && !V.gone.has('beckonFore')) {
    const a = B.act, up = !B.paws.beckon.broken && a && a.kind === 'summon' && !down ? (a.step === 'tele' ? sm((1 - a.left / a.dur) * 2.5) : a.step === 'hold' ? 1 : sm(a.left / a.dur)) : 0;
    V.bUp = (V.bUp || 0) + (up - (V.bUp || 0)) * Math.min(1, dt * 8);
    const Sh = worldPos(N.beckonArm), L1 = 0.3 * S, L2 = 0.26 * S;
    const P = B.at(BC.pts.beckon), palm = V3(P.x, P.y, P.z), hdir = V3(-palm.x, 0, -palm.z).normalize();
    let wristUp = palm.clone().addScaledVector(UPV, -0.15 * S).addScaledVector(hdir, -0.065 * S);
    // at rest the paw is held up by the cheek like the classic beckoning cat (its core shut); summoning reaches it out toward the house
    const wristRest = toW(-0.47, 1.1, -0.33);
    let W = wristRest.clone().lerp(wristUp, V.bUp), fingers = dirW(0.1, 1, -0.15).lerp(UPV, V.bUp).normalize(), palmN = dirW(0.1, 0, -1).lerp(hdir, V.bUp).normalize();
    if (B.paws.beckon.broken || down) { W = Sh.clone().addScaledVector(UPV, -(L1 + L2) * 0.97).addScaledVector(dirW(-1, 0, 0), 0.3 + Math.sin(now * 1.3) * 0.15); fingers = V3(0, -1, 0); palmN = fwd.clone(); }
    if (V.bUp > 0.5 && !down) { const fl = Math.sin(now * VW.flapSpeed) * VW.flap * V.bUp, ax = V3(0, 0, 0).crossVectors(fingers, palmN).normalize(); fingers.applyAxisAngle(ax, fl); palmN.applyAxisAngle(ax, fl); }
    const d = Math.min(W.distanceTo(Sh), L1 + L2 - 1e-3), u = W.clone().sub(Sh).normalize(), aa = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - aa * aa));
    let pole = dirW(-0.6, -0.4, 0.5); pole.addScaledVector(u, -pole.dot(u)).normalize();
    const E = Sh.clone().addScaledVector(u, aa).addScaledVector(pole, hh), Wr = Sh.clone().addScaledVector(u, d);
    aim(N.beckonArm, E.clone().sub(Sh), fwd); aim(N.beckonFore, Wr.clone().sub(E), fwd); aim(N.beckonPaw, fingers.clone().negate().negate(), palmN);
  }
  // SLAM ARM: rest on the lap; telegraph: the scissor boom unfolds and holds the paw over the target, rising; impact; stuck on the ground with the core to the house; recover
  if (N.slamArm && !V.gone.has('slamPaw')) {
    const a = B.act, Sh = worldPos(N.slamArm), rest = toW(0.3, 0.3, -0.64); let Pp = rest.clone(), stamp = dirW(0, -1, 0), coreF = fwd.clone(), ext = 0;
    if (a && a.kind === 'slam' && !B.paws.slam.broken && !down) {
      const tg = V3(a.tg.x, 0, a.tg.z), h = V3(-a.tg.x, 0, -a.tg.z).normalize(), ground = tg.clone().addScaledVector(h, -0.16 * S).setY(1.24);
      if (a.step === 'tele') { const kk = 1 - a.left / a.dur, y = BC.pts.slamUp[0] + (BC.pts.slamUp[1] - BC.pts.slamUp[0]) * kk, over = tg.clone().addScaledVector(h, -0.16 * S).setY(y + 0.12 * S);
        Pp = a.left < 0.14 ? over.clone().lerp(ground, sm(1 - a.left / 0.14)) : rest.clone().lerp(over, sm(kk / 0.3)); ext = sm(kk / 0.3); }
      else if (a.step === 'stuck') { Pp = ground; ext = 1; }
      else { const kk = 1 - a.left / a.dur; Pp = ground.clone().lerp(rest, sm(kk)); ext = 1 - sm(kk); }
      coreF = h; stamp = V3(0, -1, 0);
    }
    if (B.paws.slam.broken || down) { Pp = Sh.clone().addScaledVector(UPV, -3.6).addScaledVector(dirW(1, 0, 0), 0.5 + Math.sin(now * 1.1) * 0.2); stamp = V3(0, -1, 0); }
    V.slamPos = Pp;
    const d1 = Pp.clone().sub(Sh).normalize().lerp(V3(0, -1, 0), 0.4).normalize(), E = Sh.clone().addScaledVector(d1, 0.22 * S);
    aim(N.slamArm, d1, fwd); const d2 = Pp.clone().sub(E); aim(N.slamFore, d2, fwd);
    for (let i = 1; i <= 4; i++) if (N['slamS' + i]) { N['slamS' + i].position.copy(V.bind['slamS' + i].p); N['slamS' + i].quaternion.copy(V.bind['slamS' + i].q); }
    N.slamFore.updateMatrixWorld(true);
    // the paw hangs at the telescope's end at rest; on the scissor's end when extended
    // the scissor boom always shows between the telescope and the paw (folded short at rest, unfolding when it slams)
    const tip = worldPos(N.slamS4).addScaledVector(d2.clone().normalize(), 0.12 * S), span = Pp.distanceTo(tip), useSc = span > 0.3;
    const paw = N.slamPaw; if (!V.pawFree) { V.g.attach(paw); V.pawFree = true; }
    const target = useSc ? Pp : tip;
    paw.position.lerp(target, Math.min(1, dt * (useSc ? 30 : 10))); if (paw.position.distanceTo(target) > 6) paw.position.copy(target);
    { const y = stamp.clone().negate(), z = coreF.clone().negate().addScaledVector(y, coreF.dot(y)).normalize(), x = V3(0, 0, 0).crossVectors(y, z).normalize(); z.crossVectors(x, y); paw.quaternion.setFromRotationMatrix(scratch.m.makeBasis(x, y, z)); paw.scale.setScalar(S); }
    // the scissor: cells of crossed bars from the telescope tip to the paw, in the upright plane through the boom
    const SC = VW.scissor; V.bars.visible = useSc;
    if (useSc) { const ax = paw.position.clone().sub(tip), L = ax.length(), ux = ax.clone().normalize(), side = V3(0, 0, 0).crossVectors(ux, UPV).normalize(), uy = V3(0, 0, 0).crossVectors(side, ux).normalize(), c = L / SC.cells, lk = Math.max(c * 1.02, Math.min(SC.link, c * 3)), hh = Math.sqrt(Math.max(0, lk * lk - c * c));
      const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V3(lk, 1, 1);
      for (let i = 0; i < SC.cells; i++) for (let j = 0; j < 2; j++) { const s = j ? 1 : -1, a0 = tip.clone().addScaledVector(ux, c * i).addScaledVector(uy, s * hh / 2).addScaledVector(side, (j - 0.5) * SC.bar), a1 = tip.clone().addScaledVector(ux, c * (i + 1)).addScaledVector(uy, -s * hh / 2).addScaledVector(side, (j - 0.5) * SC.bar), dd = a1.clone().sub(a0);
        q.setFromUnitVectors(V3(1, 0, 0), dd.clone().normalize()); mm.compose(a0.add(a1).multiplyScalar(0.5), q, sc); V.bars.setMatrixAt(i * 2 + j, mm); }
      V.bars.instanceMatrix.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- warnings, glows, screen
function looks(dt) {
  const { B, m, sim } = V, now = sim.t, a = B.act, down = B.phase === 'down' || B.phase === 'wreck';
  // slam warning ring: amber filling to red inward, with the paw's shadow growing in it
  const slam = a && a.kind === 'slam' && (a.step === 'tele' || a.step === 'stuck');
  V.ring.visible = V.fill.visible = V.shadow.visible = !!slam && !down; bossState.ring = V.ring.visible; bossState.ringSeen = bossState.ringSeen || V.ring.visible;
  if (slam) { const kk = a.step === 'tele' ? 1 - a.left / a.dur : 1, c = col(VW.ring[0]).lerp(col(VW.ring[1]), kk);
    for (const o of [V.ring, V.fill, V.shadow]) o.position.set(a.tg.x, 0.06, a.tg.z);
    V.ring.material.color.copy(c); V.ring.material.opacity = 0.75 + 0.25 * Math.sin(now * 14);
    V.fill.material.color.copy(c); V.fill.scale.setScalar(Math.max(0.05, BC.slam.ring * kk)); V.fill.material.opacity = 0.32;
    V.shadow.scale.setScalar(0.6 + 1.6 * kk); V.shadow.material.opacity = 0.25 + 0.4 * kk; }
  // summon: the palm glows cold teal, a halo round it
  const sum = a && a.kind === 'summon' && !B.paws.beckon.broken && !down, sk = sum ? (a.step === 'tele' ? 1 - a.left / a.dur : a.step === 'hold' ? 1 : a.left / a.dur) : 0;
  V.halo.visible = sk > 0.02; if (V.halo.visible) { const P = B.at(BC.pts.beckon); V.halo.position.set(P.x, P.y, P.z); V.halo.material.opacity = sk * (0.7 + 0.3 * Math.sin(now * 9)); V.halo.scale.setScalar(VW.halo * (0.6 + 0.4 * sk)); }
  // weak points: dark and shut; open = pulsing white-amber (the beckon palm teal-white while it summons)
  const open = new Set(B.points().map((p) => p.id)), pulse = 0.65 + 0.35 * Math.sin(now * 8);
  m.setGlow('beckonCore', open.has('beckon') ? (a && a.kind === 'summon' && a.step === 'tele' ? VW.teal : VW.open) : 0x101010, open.has('beckon') ? pulse * (1 + sk) : 1);
  m.setGlow('slamCore', open.has('slam') ? VW.open : 0x101010, open.has('slam') ? pulse * 1.4 : 1);
  m.setGlow('coin', B.core.broken ? 0x080808 : open.has('core') ? VW.coin : 0x6a5a30, open.has('core') ? 1.2 + 0.6 * Math.sin(now * 6) : 0.5);
  const dead = down ? Math.max(0, 1 - V.dawnT * 1.4) : 1;
  m.setGlow('bell', VW.bell, (0.6 + 0.3 * Math.sin(now * 2.1) + (sum ? 0.8 * sk : 0)) * dead);
  V.eyeFlick -= dt; if (V.eyeFlick < -0.12) V.eyeFlick = 3 + Math.random() * 6;
  m.setGlow('eyeR', VW.eye, 1.3 * dead); m.setGlow('eyeL', VW.eye, (V.eyeFlick < 0 ? 0.5 : 0.03) * dead);
  m.setGlow('lamp', VW.lamp, 0.9 * dead); m.setGlow('standby', VW.standby, (Math.sin(now * 2.4) > 0.2 ? 1 : 0.15) * dead);
  V.scr.draw(down ? (B.phase === 'down' ? (V.dawnT > VW.sag + 1.2 ? 'off' : 'saver') : 'off') : a && a.kind === 'slam' ? 'slam' : a && a.kind === 'summon' ? 'summon' : 'face');
  // its own lamps light its paint a little at night
  for (const mt of m.mats) if (mt.emissive) mt.emissive.setScalar(VW.selfLit * dead);
  // sparks
  const pa = V.spk.geometry.attributes.position; let n = 0;
  for (let i = V.sparks.length - 1; i >= 0; i--) { const s = V.sparks[i]; s.t -= dt; if (s.t <= 0) { V.sparks.splice(i, 1); continue; } s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt); if (n < pa.count) pa.setXYZ(n++, s.p.x, s.p.y, s.p.z); }
  for (let i = n; i < pa.count; i++) pa.setXYZ(i, 0, -50, 0); pa.needsUpdate = true; V.spk.visible = n > 0;
}

// ---------------------------------------------------------------- events from the sim
function events(ctx) {
  const { B, sim } = V, a = ctx.audio ? ctx.audio() : null;
  for (const e of B.log.splice(0)) {
    if (e.e === 'marla') { const t = BC.marla[e.k]; if (t) say('boss', 'Marla: ' + t, 6, 3.5); continue; }
    bossState.events.push(e.k); if (bossState.events.length > 200) bossState.events.shift();
    if (e.k === 'rise') { SFX.rise(a); V.shakeT = BC.rise.dur; V.shakeA = VW.riseShake; }
    if (e.k === 'tele') { SFX.creak(a, e.tele); }
    if (e.k === 'impact') { SFX.thud(a); V.shakeT = BC.shake.time; V.shakeA = BC.shake.deg; sparks(V3(e.x, 0.3, e.z)); gloomScrap(ctx, e.x, -0.5, e.z); } // desktop: chunks of road thrown up by the paw
    if (e.k === 'summon' || e.k === 'skip' || e.k === 'throe') SFX.bell(a);
    if (e.k === 'beckon') tone(a, 300, 900, 1.8, 0.05, 'sine');
    if (e.k === 'hit') { SFX.clang(a); const p = B.points().find((q) => q.id === e.id) || (e.id === 'slam' && V.slamPos ? { x: V.slamPos.x, y: V.slamPos.y - 0.4, z: V.slamPos.z } : null); if (p) sparks(V3(p.x, p.y, p.z)); try { const cr = document.getElementById('cross'); if (cr && cr.animate) cr.animate([{ transform: 'scale(1.6)', borderColor: '#ffe2a0' }, { transform: 'scale(1)' }], { duration: 180 }); } catch (er) { /* no crosshair */ } }
    if (e.k === 'break') { SFX.breakIt(a); const out = V3(-V.B.fx, 0, -V.B.fz);
      if (e.id === 'beckon' || e.id === 'slam') { for (const pl of BREAK_PLATES[e.id]) addPiece(pl, V3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4).addScaledVector(out, -2), V3(Math.random() * 6, Math.random() * 6, Math.random() * 6)); }
      if (e.id === 'core') { V.dawnT = 0; } }
    if (e.k === 'dawn') { SFX.down(a); V.dawnT = 0; }
  }
}
function collapse() {
  const fwd = V3(V.B.fx, 0, V.B.fz), side = V3(V.B.rx, 0, V.B.rz);
  for (const nm of COLLAPSE) { const sp = nm === 'coin' ? fwd.clone().multiplyScalar(5).addScaledVector(side, 3).setY(2) : nm === 'head' ? fwd.clone().multiplyScalar(2.5).setY(1.5) : fwd.clone().multiplyScalar(1 + Math.random() * 2).addScaledVector(side, (Math.random() - 0.5) * 4).setY(1 + Math.random() * 3);
    addPiece(nm, sp, V3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4)); }
  V.bars.visible = false;
}

// ---------------------------------------------------------------- main.js calls this every frame (sim may be null). ctx: { audio(), cam }
export function bossTick(dt, sim, ctx) {
  const want = !!(sim && sim.boss && sim.phase === 'night');
  if (sim && sim.boss && DESK) { loadModel(); if (sim.phase === 'night') loadPhysics(); }
  if (V && (!want || V.sim !== sim)) dropView(ctx);
  if (!want) return;
  if (!V) { build(sim); ctx.scene.add(V.g); }
  // the desktop model arrived after the stand-in was built: swap it in while it is still underground
  if (V.m.kind === 'code' && DESK && VW.glb && bossState.model === 'ready' && V.B.phase === 'wait') { dropView(ctx); build(sim); ctx.scene.add(V.g); }
  if (!V.phys && bossState.physics === 'ready' && window.__bossPhysics) { V.phys = window.__bossPhysics.createWorld(PH); bossState.physics = 'running'; }
  V.t += dt;
  events(ctx);
  if (V.dawnT >= 0) { V.dawnT += dt; if (V.dawnT > VW.sag && !V.collapsed) { V.collapsed = true; collapse(); } }
  pose(dt, ctx); looks(dt); stepPieces(dt);
  if (V.dawnT >= 0) { const k = sm((V.dawnT - VW.sag) / 2.5); V.m.root.position.y = -VW.sink * k; }
  // camera shake (impact, the rise): a short turn, half on phones
  if (V.shakeT > 0 && ctx.cam) { V.shakeT -= dt; const a = (V.shakeA * Math.PI / 180) * (DESK ? 1 : BC.shake.phone) * Math.min(1, V.shakeT / 0.15); ctx.cam.rotation.x += Math.sin(V.t * 61) * a; ctx.cam.rotation.y += Math.sin(V.t * 47 + 1) * a * 0.7; }
}
function dropView(ctx) {
  if (!V) return; if (V.phys) V.phys.clear(); ctx.scene.remove(V.g);
  V.g.traverse((o) => { if (o.isMesh || o.isPoints || o.isSprite) { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); } });
  V = null; bossState.built = null;
}
// for checks and pictures: the live view
export const bossView = () => V;

// ---------------------------------------------------------------- QUEUED EXTRA (owner): desktop scrap when an ordinary Gloom is destroyed (cannon-es, CONFIG.boss.physics.gloomScrap)
let scrapW = null; const scraps = []; let scrapGeo = null, scrapMat = null;
export function gloomScrap(ctx, x, y, z) {
  if (!DESK || !PH.on || !PH.gloomScrap) return; loadPhysics(); if (bossState.physics !== 'ready' && bossState.physics !== 'running') return;
  if (!scrapW) scrapW = window.__bossPhysics.createWorld(PH);
  if (!scrapGeo) { scrapGeo = new THREE.BoxGeometry(1, 0.5, 0.7); scrapGeo.userData.shared = true; scrapMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.7, metalness: 0.6 }); scrapMat.userData.shared = true; }
  for (let i = 0; i < PH.scrap; i++) { if (scraps.length >= PH.max) { const o = scraps.shift(); ctx.scene.remove(o.m); scrapW.remove(o.id); }
    const s = PH.scrapSize * (0.6 + Math.random() * 0.8), m = new THREE.Mesh(scrapGeo, scrapMat); m.scale.set(s, s, s); m.castShadow = true; ctx.scene.add(m);
    const id = scrapW.add(s / 2, s / 4, s * 0.35, [x + (Math.random() - 0.5) * 0.5, y + 0.8 + Math.random(), z + (Math.random() - 0.5) * 0.5], [0, 0, 0, 1], [(Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4], [Math.random() * 8, Math.random() * 8, Math.random() * 8], 0.4);
    scraps.push({ m, id, t: 0 }); }
}
export function scrapTick(dt, ctx, clear) {
  if (clear) { for (const o of scraps) { ctx.scene.remove(o.m); if (scrapW) scrapW.remove(o.id); } scraps.length = 0; return; }
  if (!scrapW || !scraps.length) return; scrapW.step(dt);
  for (const o of scraps) { o.t += dt; if (o.t > PH.life) continue; const s = scrapW.get(o.id); if (s) { o.m.position.set(s.p[0], s.p[1], s.p[2]); o.m.quaternion.set(s.q[0], s.q[1], s.q[2], s.q[3]); } }
}

// ---------------------------------------------------------------- texts for main.js: the field guide entry (once met) and the night results line
export function bossGuide(met) {
  if (!(met && met.beckoner)) return [];
  return [{ k: 'term', text: 'The Beckoner' }, { k: 'text', text: 'Rises in the street on the farthest ring. One paw slams where the red ring shows; the other calls Gloom in. Shoot a raised palm. Hold till dawn.' }, { k: 'text', text: BC.before }];
}
export function bossEndLine(res, lm) {
  const b = res.boss; if (!b) return '';
  const part = b.paws + (b.paws === 1 ? ' paw' : ' paws') + ' broken' + (b.core ? ', coin-core broken' : '');
  if (!res.win) return '. The Beckoner: ' + part + ' (no bonus on a lost night)';
  return b.ess || b.food ? '. The Beckoner: ' + part + ': bonus +' + Math.round(b.ess * (lm || 1)) + ' essentials, +' + Math.round(b.food * (lm || 1)) + ' food' : '. The Beckoner powered down at dawn (no paw broken, no bonus)';
}
try { window.__bossView = bossView; } catch (e) { /* no window */ }

// ---------------------------------------------------------------- QUEUED EXTRA (owner): desktop only, a thrown device bounces and rolls to rest (CONFIG.boss.physics.devices).
// Picture only: the device is where the rules put it; the bounce starts a little short of that spot and blends into it within hopTime seconds.
const hops = new Map(), HOP = { time: 1.1, from: 0.9, up: 0.7 };
let hopW = null;
export function deviceHop(m, d, wall, yaw) {
  if (!DESK || !PH.on || !PH.devices || wall) return;
  let h = hops.get(d.id);
  if (!h) { if (!m.visible) return; loadPhysics(); if (!window.__bossPhysics) { hops.set(d.id, { done: true }); return; } if (!hopW) hopW = window.__bossPhysics.createWorld(PH);
    const fx = -Math.sin(yaw || 0), fz = -Math.cos(yaw || 0), y0 = m.position.y;
    const id = hopW.add(0.18, 0.18, 0.18, [m.position.x - fx * HOP.from, y0 + HOP.up + 0.18, m.position.z - fz * HOP.from], [0, 0, 0, 1], [fx * 2.4, -0.5, fz * 2.4], [fz * 9, 0, -fx * 9], 1.5);
    h = { id, t: 0, y0, done: false }; hops.set(d.id, h); }
  if (h.done) return;
  h.t += 1 / 60; hopW.step(1 / 60);
  const s = hopW.get(h.id), k = sm((h.t - HOP.time * 0.55) / (HOP.time * 0.45));
  if (s && h.t < HOP.time) { m.position.x += (s.p[0] - m.position.x) * (1 - k); m.position.z += (s.p[2] - m.position.z) * (1 - k); m.position.y = h.y0 + Math.max(0, s.p[1] - 0.18) * (1 - k); m.rotation.x = (1 - k) * 2 * Math.asin(Math.max(-1, Math.min(1, s.q[0]))); m.rotation.z = (1 - k) * 2 * Math.asin(Math.max(-1, Math.min(1, s.q[2]))); }
  else { h.done = true; m.rotation.x = 0; m.rotation.z = 0; hopW.remove(h.id); }
}
export function hopsClear() { hops.clear(); if (hopW) hopW.clear(); }
