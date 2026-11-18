// Rooms you walk into in the base (owner Nov 16 23:32 and 23:35): the WORKSHOP, where Oko the tinkerer upgrades your devices, and MARLA'S HOUSE, where her private journal lies on the desk.
// The shell (walls with an arched doorway, the vault roof, collision) is built in src/baseview.js vaultRoom(); this file holds where each room is, what you bump into inside it,
// the phone dressing (workshopLow / marlaLow: a few plain shapes merged into one mesh per surface) and the desktop dressing (workshopHi / marlaHi, called from the DENSITY pass in
// src/basehi.js vaultDense so everything lands in that building's per-surface merge). Room frame: x across the door, z toward the door (the door is at +z), y up from the ground.
// Numbers: CONFIG.workshop and CONFIG.marlaHouse (layout positions are in metres from the room's centre, as in the home's dressing in src/basehi.js).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { STATIONS } from './base.js';
import { ptex } from './props.js';
import { Placer, shapes, cellUV, mapTex } from './density.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }

// ---------------------------------------------------------------- where the rooms are
// the room's frame and size; null when its switch is off
export function roomInfo(key) {
  if (key === 'workshop') { const W = CONFIG.workshop; if (!W || !W.on) return null; const s = STATIONS.workshop;
    return { key, x: s.x, z: s.z, ry: W.ry || 0, w: 5, d: 4, h: 3, R: 2.25, k: 0.6, t: W.wall, dw: W.door[0], dh: W.door[1], floor: W.floor, windows: [[-1.7, 1.8, 0.46], [1.7, 1.8, 0.46]], seed: 9177, word: 'WORKSHOP' }; }
  if (key === 'marla') { const M = CONFIG.marlaHouse; if (!M || !M.on) return null;
    return { key, x: M.at[0], z: M.at[1], ry: M.ry, w: M.w, d: M.d, h: M.h, R: M.d / 2 + 0.25, k: M.k, t: M.wall, dw: M.door[0], dh: M.door[1], floor: M.floor, windows: M.windows, seed: 4421, word: 'MARLA' }; }
  return null;
}
export const ROOM_KEYS = ['workshop', 'marla'];
export const toWorld = (I, lx, lz) => [I.x + lx * Math.cos(I.ry) + lz * Math.sin(I.ry), I.z - lx * Math.sin(I.ry) + lz * Math.cos(I.ry)];
export const toLocal = (I, wx, wz) => { const dx = wx - I.x, dz = wz - I.z; return [dx * Math.cos(I.ry) - dz * Math.sin(I.ry), dx * Math.sin(I.ry) + dz * Math.cos(I.ry)]; };
// is a world point inside the room (inside its walls, less margin m)?
export function inRoom(I, wx, wz, margin) { if (!I) return false; const [lx, lz] = toLocal(I, wx, wz), m = margin || 0; return Math.abs(lx) < I.w / 2 - I.t - m && Math.abs(lz) < I.d / 2 - I.t - m; }
// the doorway's middle, just outside (world)
export const doorAt = (I, out) => toWorld(I, 0, I.d / 2 + (out || 0));

// what you bump into: boxes [centre x, centre z, half x, half z] in the room frame (walls with the doorway left open, then the furniture)
export function roomSolids(I) {
  // (callers push out of these in reverse order, so the walls come last)
  const hw = I.w / 2, hd = I.d / 2, t = I.t, fw = (hw - I.dw / 2) / 2, out = [[0, -hd + t / 2, hw, t / 2], [-hw + t / 2, 0, t / 2, hd], [hw - t / 2, 0, t / 2, hd], [-hw + fw, hd - t / 2, fw, t / 2], [hw - fw, hd - t / 2, fw, t / 2]];
  if (I.key === 'workshop') out.push([0, -0.575, 1.25, 0.4], [-1.75, -1.25, 0.47, 0.42], [1.95, -0.85, 0.27, 0.86], [-2.0, 0.25, 0.22, 0.72], [-1.75, 1.2, 0.24, 0.24], [1.75, 1.15, 0.36, 0.3], [2.0, 0.35, 0.22, 0.22], [-1.0, 0.15, 0.17, 0.17]);
  if (I.key === 'marla') out.push([-1.55, -0.45, 0.39, 1.02], [-0.55, -1.27, 0.27, 0.26], [1.2, -1.22, 0.63, 0.31], [1.15, -0.62, 0.2, 0.2], [1.6, 0.75, 0.31, 0.26], [1.4, 1.25, 0.3, 0.2], [-1.55, 0.95, 0.24, 0.34], [1.65, 0.15, 0.22, 0.22], [0.15, -1.3, 0.21, 0.21]);
  return out;
}

// ---------------------------------------------------------------- pictures painted once
const pics = {};
// a blueprint: blue paper, a white grid, a device drawn in white lines with dimension marks and hand notes
export function blueprintTex() {
  if (pics.bp) return pics.bp;
  const c = document.createElement('canvas'); c.width = 512; c.height = 384; const x = c.getContext('2d'), r = rng(5150);
  x.fillStyle = '#25507e'; x.fillRect(0, 0, 512, 384); for (let k = 0; k < 160; k++) { x.fillStyle = 'rgba(255,255,255,' + (0.02 * r()) + ')'; x.fillRect(r() * 512, r() * 384, 30 * r(), 20 * r()); }
  x.strokeStyle = 'rgba(200,225,255,0.18)'; x.lineWidth = 1; for (let i = 0; i <= 512; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 384); x.stroke(); } for (let i = 0; i <= 384; i += 24) { x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.strokeStyle = 'rgba(240,248,255,0.92)'; x.lineWidth = 2.5; x.beginPath(); x.arc(170, 200, 26, 0, 2 * PI); x.stroke();
  for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3 - PI / 2; x.save(); x.translate(170, 200); x.rotate(a); x.beginPath(); x.moveTo(0, -26); x.bezierCurveTo(40, -60, 34, -120, 0, -150); x.bezierCurveTo(-30, -120, -30, -60, 0, -26); x.stroke(); x.restore(); }
  x.beginPath(); x.moveTo(170, 226); x.lineTo(170, 360); x.stroke(); x.strokeRect(150, 352, 40, 14);
  x.lineWidth = 2; x.beginPath(); x.moveTo(320, 90); x.lineTo(470, 90); x.lineTo(470, 300); x.lineTo(320, 300); x.closePath(); x.stroke(); for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(320 + i * 37.5, 90); x.lineTo(320 + i * 37.5, 300); x.stroke(); } for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(320, 90 + i * 42); x.lineTo(470, 90 + i * 42); x.stroke(); }
  x.setLineDash([6, 5]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(300, 90); x.lineTo(300, 300); x.moveTo(320, 320); x.lineTo(470, 320); x.stroke(); x.setLineDash([]);
  x.fillStyle = 'rgba(240,248,255,0.9)'; x.font = 'italic 18px Georgia, serif'; x.fillText('blade v3 - thinner root?', 40, 40); x.fillText('panel frame 4x5', 330, 70); x.font = '14px Georgia, serif'; x.fillText('1.20 m', 370, 338); x.fillText('Oko', 450, 370);
  x.strokeStyle = 'rgba(240,248,255,0.5)'; x.lineWidth = 4; x.strokeRect(6, 6, 500, 372);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; pics.bp = t; return t;
}
// a pencil sketch on cream paper (a hand, a gear, notes)
export function sketchTex() {
  if (pics.sk) return pics.sk;
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const x = c.getContext('2d'), r = rng(818); x.fillStyle = '#efe6cf'; x.fillRect(0, 0, 256, 320);
  x.strokeStyle = 'rgba(60,55,50,0.75)'; x.lineWidth = 1.6; x.beginPath(); x.arc(128, 120, 50, 0, 2 * PI); x.stroke(); x.beginPath(); x.arc(128, 120, 18, 0, 2 * PI); x.stroke();
  for (let k = 0; k < 12; k++) { const a = k * PI / 6; x.beginPath(); x.moveTo(128 + Math.cos(a) * 50, 120 + Math.sin(a) * 50); x.lineTo(128 + Math.cos(a) * 62, 120 + Math.sin(a) * 62); x.stroke(); }
  for (let k = 0; k < 7; k++) { x.beginPath(); const y = 210 + k * 14; x.moveTo(24, y); for (let i = 0; i < 20; i++) x.lineTo(24 + i * 10, y + (r() - 0.5) * 3); x.stroke(); }
  for (let k = 0; k < 40; k++) { x.strokeStyle = 'rgba(60,55,50,' + 0.2 * r() + ')'; x.beginPath(); const a = r() * 2 * PI, d = 30 + r() * 50; x.moveTo(128 + Math.cos(a) * d, 120 + Math.sin(a) * d); x.lineTo(128 + Math.cos(a) * (d + 8), 120 + Math.sin(a) * (d + 8)); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; pics.sk = t; return t;
}

// ---------------------------------------------------------------- shared helpers for both dressings
// a plaster panel (warm lime) with a wash stain over it, on a wall, facing into the room (ry turns it)
function plaster(c, w, h, x, y, z, ry) { const { P, C, jit } = c; P.add('plaster', c.G.box(w, h, 0.01), x, y, z, 0, ry, 0, 1, 1, 1, jit(0xe6cfa6, 0.04)); const gq = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = cellUV('wash'), uv = gq.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0); P.push(x, y, z, ry); P.add('decal', gq, 0, 0, 0.007, 0, 0, 0, 1, 1, 1, C(0xb8a080)); P.pop(); }
// a row of wainscot planks (lower wall), len long, along a wall facing into the room
function wainscot(c, len, x, z, ry, h) { const { P, G, jit } = c; P.push(x, 0, z, ry); for (let y = c.F + 0.08; y < h; y += 0.16) P.add('wood', G.box(len, 0.15, 0.02), 0, y + 0.075, 0.012, 0, 0, 0, 1, 1, 1, jit(0x8a6240, 0.1)); P.add('wood', G.box(len, 0.05, 0.04), 0, h + 0.05, 0.02, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a, 0.05)); P.pop(); }
// plank floor over the room
function planks(c, hw, hd) { const { P, G, r, jit } = c; for (let z = -hd; z < hd - 0.01; z += 0.2) { let x = -hw; while (x < hw - 0.01) { const l = Math.min(hw - x, 0.9 + 1.4 * r()); P.add('wood', G.box(l - 0.008, 0.012, 0.192), x + l / 2, c.F - 0.004, z + 0.1, 0, 0, 0, 1, 1, 1, jit(0x9a6a40, 0.1)); x += l; } } }
// boards lining the vault from inside (a half ellipse R across, R * k up, starting at the wall top), n of them, and a ridge beam
function vaultBoards(c, I, n) { const { P, G, jit } = c, R = I.R - 0.06, Rk = I.R * I.k - 0.06, hd = I.d / 2 - I.t, t0 = Math.acos(Math.min(0.999, hd / R)), len = I.w - 2 * I.t;
  for (let i = 0; i < n; i++) { const t = t0 + (i + 0.5) / n * (PI - 2 * t0), y = I.h + Math.sin(t) * Rk, z = Math.cos(t) * R, th = Math.atan2(-Math.cos(t) * Rk, -Math.sin(t) * R), bw = (PI - 2 * t0) / n * Math.hypot(R, Rk) * 0.9; P.add('wood', G.box(len, 0.02, bw), 0, y, z, th, 0, 0, 1, 1, 1, jit(0xa07a50, 0.12)); }
  P.add('wood', G.box(len, 0.12, 0.12), 0, I.h + Rk - 0.06, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a, 0.04)); }
// a jar on a shelf: glass, contents of a colour (or glowing), a copper lid
function jar(c, x, y, z, h, col, glow) { const { P, G } = c; P.add('glass', G.cyl(0.05, 0.05, h, 10), x, y + h / 2, z); P.add(glow ? 'cyan' : 'fruit', G.cyl(0.043, 0.043, h * 0.6, 10), x, y + h * 0.3, z, 0, 0, 0, 1, 1, 1, glow ? c.C(col).multiplyScalar(0.45) : c.jit(col, 0.05)); P.add('cop', G.cyl(0.053, 0.053, 0.015, 10), x, y + h + 0.007, z); }
// a hanging pot on three cords with trailing leaves
function hanger(c, x, z, yTop, yPot, n) { const { P, G, r, V: v, C } = c; P.rod('dark', G, v(x, yTop, z), v(x, yPot + 0.42, z), 0.006, 4, C(0xb89a6a)); for (const a of [0, 2.1, 4.2]) P.rod('dark', G, v(x, yPot + 0.42, z), v(x + Math.cos(a) * 0.13, yPot + 0.14, z + Math.sin(a) * 0.13), 0.004, 4, C(0xb89a6a));
  P.add('cer', G.lathe('hang', [[0, 0], [0.08, 0.0], [0.13, 0.06], [0.14, 0.16], [0.145, 0.17]], 14), x, yPot, z, 0, 0, 0, 1, 1, 1, c.jit([0xf2ecdc, 0x8fc79a, 0xd08860][Math.floor(r() * 3)])); plantHi(c, x, yPot + 0.16, z, 0.24, 8); for (let k = 0; k < n; k++) trailHi(c, x + (r() - 0.5) * 0.2, yPot + 0.12, z + (r() - 0.5) * 0.2, 0.35 + 0.45 * r()); }
// a pot on the floor with a big plant
function bigPot(c, x, z, s) { const { P, G } = c; P.add('pot', G.lathe('bigpot', [[0, 0], [0.16, 0], [0.2, 0.3], [0.22, 0.34]], 14), x, c.F, z); P.add('soil', G.cyl(0.19, 0.19, 0.02, 12), x, c.F + 0.32, z); plantHi(c, x, c.F + 0.33, z, s, 13, 2); }
// a woven rug: stripes with fringes
function rug(c, x, z, w, d, cols) { const { P, G, C, jit } = c; for (let k = 0; k < cols.length; k++) P.add('cloth', G.box(w, 0.006, d / cols.length), x, c.F + 0.006, z - d / 2 + (k + 0.5) * d / cols.length, 0, 0, 0, 1, 1, 1, jit(cols[k], 0.04)); for (const sx of [-1, 1]) for (let k = 0; k < 12; k++) P.add('cloth', G.box(0.06, 0.004, 0.012), x + sx * (w / 2 + 0.03), c.F + 0.005, z - d / 2 + 0.05 + k * (d - 0.1) / 11, 0, 0, 0, 1, 1, 1, C(0xe8dcc0)); }
// a work light hanging from a beam: cord, metal shade, warm bulb
function workLight(c, x, z, yTop, y) { const { P, G, V: v, C } = c; P.rod('dark', G, v(x, yTop, z), v(x, y + 0.12, z), 0.005, 4); P.add('metal', G.cyl(0.03, 0.17, 0.14, 14, true), x, y + 0.05, z, 0, 0, 0, 1, 1, 1, C(0x3f6b5a)); P.add('glow', G.sphere(0.045, 10, 8), x, y - 0.03, z, 0, 0, 0, 1, 1, 1, C(0xffd890)); }
// outside: a lantern hanging over the doorway from the cornice (the station lantern beside the door would cover a window here)
function doorLamp(c, I) { const { P, G, V: v } = c; P.push(0, I.h - 0.12, I.d / 2 + 0.02, 0); P.add('cop', G.box(0.1, 0.1, 0.02), 0, 0, 0); P.rod('cop', G, v(0, 0, 0.01), v(0, 0.02, 0.32), 0.012, 6); P.rod('dark', G, v(0, 0.02, 0.32), v(0, -0.14, 0.32), 0.004, 4); P.add('glass', G.lathe('bud', [[0.0, 0], [0.06, 0.02], [0.085, 0.09], [0.07, 0.17], [0.03, 0.21], [0, 0.22]], 14), 0, -0.36, 0.32); P.add('glow', G.sphere(0.035, 10, 8), 0, -0.27, 0.32); P.add('cop', G.cyl(0.03, 0.07, 0.05, 10), 0, -0.13, 0.32); P.pop(); }
// a crate of scrap: wooden crate, bits of machine sticking out
function scrapCrate(c, x, y, z, ry) { const { P, G, r, jit, C } = c; P.push(x, y, z, ry); P.add('wood', G.box(0.6, 0.38, 0.45), 0, 0.19, 0, 0, 0, 0, 1, 1, 1, jit(0xa07a50, 0.1)); for (const yy of [0.08, 0.3]) P.add('wood', G.box(0.62, 0.06, 0.47), 0, yy, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a3a, 0.08));
  for (let k = 0; k < 7; k++) { const t = r(), px = (r() - 0.5) * 0.45, pz = (r() - 0.5) * 0.3; if (t < 0.3) P.add('metal', G.torus(0.07, 0.018, 6, 14), px, 0.4, pz, PI / 2 * r(), r() * 3, 0, 1, 1, 1, jit(0x7a7a72, 0.1)); else if (t < 0.55) P.add('metal', G.cyl(0.02, 0.02, 0.4, 6), px, 0.42, pz, 0.6 * r(), r() * 3, 0.5, 1, 1, 1, jit(0x6a6a64, 0.1)); else if (t < 0.75) P.add('cop', G.torus(0.05, 0.012, 6, 12), px, 0.39, pz, r(), 0, 0, 1, 1, 1, C(0xffffff)); else P.add('metal', G.box(0.14, 0.08, 0.1), px, 0.4, pz, 0.3 * r(), r() * 3, 0, 1, 1, 1, jit(0x5a5a54, 0.1)); } P.pop(); }

// ---------------------------------------------------------------- better furniture (owner Nov 17): leaves on stems, puffy quilts and cushions, a real turbine blade
const GEO = {};
// a leaf 1 long (+z) and 1 wide: pointed oval outline, cupped across, its tip drooping; 2 x 8 faces each side
export function leafGeo() { if (GEO.leaf) return GEO.leaf; const g = new THREE.PlaneGeometry(1, 1, 2, 8), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const t = P.getY(i) + 0.5, w = 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.75) * (t < 0.06 ? t / 0.06 : 1), x = P.getX(i) * 2 * w; P.setXYZ(i, x, 0.6 * x * x - 0.22 * t * t, t); }
  g.computeVertexNormals(); return (GEO.leaf = g); }
// a puffy pad 1 x 1 x 1 (cushion, pillow, quilt patch): rounded corners in plan, the top and bottom swelling in the middle and pinched at the edges
export function puffyGeo() { if (GEO.puff) return GEO.puff; const g = new THREE.BoxGeometry(1, 1, 1, 8, 2, 8), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const nx = Math.abs(2 * x), nz = Math.abs(2 * z), m = Math.max(nx, nz);
    if (m > 1e-4) { const k = m / Math.pow(Math.pow(nx, 4) + Math.pow(nz, 4), 0.25); x *= k; z *= k; } const f = (1 - Math.pow(nx, 4)) * (1 - Math.pow(nz, 4)); y *= 0.3 + 0.7 * Math.sqrt(Math.max(0, f)); P.setXYZ(i, x, y, z); }
  g.computeVertexNormals(); return (GEO.puff = g); }
// a turbine blade 1 long (+y) and 1 chord: a cambered aerofoil lofted root to tip, tapering and twisting (more pitch at the root), a round root that meets the hub
export function bladeGeo() { if (GEO.blade) return GEO.blade; const N = 16, M = 14, pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const s = i / N, chord = s < 0.1 ? 0.3 + 0.7 * (s / 0.1) : 1 - 0.55 * (s - 0.1) / 0.9, thick = s < 0.1 ? 0.3 - 0.18 * (s / 0.1) : 0.12 - 0.05 * s, tw = 0.95 * (1 - s) - 0.1, round = s < 0.1 ? 1 - s / 0.1 : 0;
    for (let j = 0; j < M; j++) { const a = j / M * 2 * Math.PI, cx = 0.5 * Math.cos(a), lead = Math.cos(a) > 0 ? 1 : 0.6, tz = thick * Math.sin(a) * (1 - 0.3 * Math.cos(a)) * lead + 0.08 * (1 - 4 * cx * cx) * (1 - round);
      let x = cx * chord * (1 - round) + 0.15 * Math.cos(a) * round, z = tz * chord * (1 - round) + 0.15 * Math.sin(a) * round; const c = Math.cos(tw), sn = Math.sin(tw); pos.push(x * c - z * sn, s, x * sn + z * c); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M, c2 = a + M, d = b + M; idx.push(a, c2, b, b, c2, d); }
  const tip = pos.length / 3; pos.push(0, 1.01, 0); for (let j = 0; j < M; j++) idx.push(N * M + j, tip, N * M + (j + 1) % M);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return (GEO.blade = g); }
// a plant with real leaves: n stems curving up and out from (x, y, z), each with a few leaves along it and one at its tip; s = its size (m); flowers = that many small blooms
export function plantHi(c, x, y, z, s, n, flowers) { const { P, G, r, jit, V: v } = c, hue = [0x4f9a3a, 0x6aa84a, 0x3f7f3a, 0x7fb04a, 0x2f6a34][Math.floor(r() * 5)], LG = leafGeo(), fl = [0xe8a23a, 0xd8577a, 0xf0d050, 0x7f8fd8, 0xf4f0e0];
  for (let k = 0; k < n; k++) { const a = k / n * 2 * PI + r() * 0.7, up = 0.55 + 0.4 * r(), len = s * (0.55 + 0.45 * r()), ca = Math.cos(a), sa = Math.sin(a);
    const p0 = v(x, y, z), p1 = v(x + ca * len * 0.25, y + len * up * 0.6, z + sa * len * 0.25), p2 = v(x + ca * len * 0.6, y + len * up * 0.85, z + sa * len * 0.6); P.rod('leaf', G, p0, p1, 0.004 + 0.006 * s, 4, jit(0x4a6a2a, 0.08)); P.rod('leaf', G, p1, p2, 0.003 + 0.005 * s, 4, jit(0x4a6a2a, 0.08));
    const yaw = Math.atan2(ca, sa), leaf = (q, l, side, tilt) => { P.push(q.x, q.y, q.z, yaw + side, -tilt); P.add('leaf', LG, 0, 0, 0, 0, 0, (r() - 0.5) * 0.6, l * 0.45, l, l, jit(hue, 0.1)); P.pop(); };
    leaf(p2, len * 0.55, (r() - 0.5) * 0.4, 0.15 + 0.3 * r()); leaf(p1, len * 0.4, 0.9 + 0.3 * r(), 0.3 * r()); if (r() < 0.6) leaf(p1.clone().lerp(p2, 0.5), len * 0.38, -0.9 - 0.3 * r(), 0.2 * r()); }
  for (let k = 0; k < (flowers || 0); k++) { const a = r() * 2 * PI, d = r() * s * 0.3, h = s * (0.7 + 0.4 * r()), fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d; P.rod('leaf', G, v(x, y, z), v(fx, y + h, fz), 0.004, 4, jit(0x4a6a2a)); const fc = jit(fl[Math.floor(r() * fl.length)], 0.05);
    for (let q = 0; q < 5; q++) { P.push(fx, y + h, fz, q * 1.257, -1.0); P.add('fruit', LG, 0, 0, 0, 0, 0, 0, 0.035, 0.035, 0.05, fc); P.pop(); } P.add('fruit', G.sphere(0.012, 6, 4), fx, y + h + 0.01, fz, 0, 0, 0, 1, 1, 1, C0(0xf0d050)); } }
const C0 = (hx) => new THREE.Color(hx);
// a trailing stem with leaves hanging down from (x, y, z), len long
export function trailHi(c, x, y, z, len) { const { P, G, r, jit, V: v } = c, LG = leafGeo(); let px = x, pz = z, prev = v(x, y, z);
  for (let t = 0.06; t < len; t += 0.06) { px += (r() - 0.5) * 0.035; pz += (r() - 0.5) * 0.035; const q = v(px, y - t, pz); P.rod('leaf', G, prev, q, 0.003, 3, jit(0x4a6a2a, 0.08)); prev = q; P.push(px, y - t, pz, r() * 6.28, 0.3 + 0.6 * r()); P.add('leaf', LG, 0, 0, 0, 0, 0, 0, 0.045, 0.06, 0.07, jit(0x4f9a3a, 0.1)); P.pop(); } }
// a quilt over a bed (centre x, z in the current frame, top at y): puffy patches in a grid, stitched seams, a border, and the side hanging over the edge
function quiltHi(c, x, y, z, nx, nz, cell, cols) { const { P, G, r, jit } = c, PG = puffyGeo();
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) P.add('cloth', PG, x + (i - (nx - 1) / 2) * cell, y + 0.012, z + (j - (nz - 1) / 2) * cell, 0, 0, 0, cell * 1.02, 0.045 + 0.01 * r(), cell * 1.02, jit(cols[(i * 3 + j * 5 + Math.floor(r() * 2)) % cols.length], 0.05));
  const W = nx * cell, D = nz * cell, th = 0x3a2a1e; for (let i = 0; i <= nx; i++) for (let t = -D / 2 + 0.02; t < D / 2; t += 0.04) P.add('dark', G.box(0.004, 0.006, 0.02), x - W / 2 + i * cell, y + 0.034, z + t, 0, 0, 0, 1, 1, 1, C0(th));
  for (let j = 0; j <= nz; j++) for (let t = -W / 2 + 0.02; t < W / 2; t += 0.04) P.add('dark', G.box(0.02, 0.006, 0.004), x + t, y + 0.034, z - D / 2 + j * cell, 0, 0, 0, 1, 1, 1, C0(th));
  P.add('cloth', G.cloth(D, 0.22, 7, 0.018, 3), x + W / 2 + 0.01, y - 0.09, z, 0, PI / 2, 0, 1, 1, 1, jit(cols[1], 0.04)); }

// ---------------------------------------------------------------- merge for the phone dressing: one mesh per surface (vertex colours carry the tints)
const LOWM = {};
function lowMats() { if (LOWM.wood) return LOWM; const L = (o) => { const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o)); m.userData.shared = true; return m; };
  Object.assign(LOWM, { wood: L({ map: ptex('wood') }), cloth: L({ map: ptex('fabric'), side: THREE.DoubleSide }), metal: L({ map: ptex('metal') }), cer: L({ map: ptex('glaze') }), plaster: L({}), glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    glass: L({ transparent: true, opacity: 0.45, depthWrite: false }), blue: L({ map: blueprintTex() }), mapt: L({ map: mapTex() }), leaf: L({ side: THREE.DoubleSide }), pot: L({ map: ptex('brick'), color: 0xd08860 }) });
  LOWM.cop = LOWM.metal; LOWM.fruit = LOWM.cer; LOWM.dark = LOWM.plaster; LOWM.soil = LOWM.plaster; LOWM.cell = L({ map: ptex('cell') }); LOWM.cyan = LOWM.glow; return LOWM; }
function mergeLow(parent, acc) { const M = lowMats(); for (const [key, list] of acc) { const geos = []; for (const [geo, m, tint] of list) { const q = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k2 of Object.keys(q.attributes)) if (k2 !== 'position' && k2 !== 'normal' && k2 !== 'uv') q.deleteAttribute(k2); if (!q.attributes.normal) q.computeVertexNormals(); if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
      q.applyMatrix4(m); const n = q.attributes.position.count, cc = new Float32Array(n * 3), t = tint || new THREE.Color(0xffffff); for (let i = 0; i < n; i++) { cc[3 * i] = t.r; cc[3 * i + 1] = t.g; cc[3 * i + 2] = t.b; } q.setAttribute('color', new THREE.BufferAttribute(cc, 3)); geos.push(q); }
    const mg = mergeGeometries(geos, false); for (const q of geos) q.dispose(); if (!mg) continue; const me = new THREE.Mesh(mg, M[key] || M.cer); me.userData.roomLow = true; parent.add(me); } }
function lowCtx(I, seed) { const acc = new Map(), r = rng(seed), P = new Placer((key, geo, m, tint) => { let a = acc.get(key); if (!a) acc.set(key, a = []); a.push([geo, m.clone(), tint]); });
  const C = (hx) => new THREE.Color(hx), jit = (hx, k) => new THREE.Color(hx).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * (k || 0.08));
  return { acc, P, G: shapes(), r, C, jit, V, F: I.floor, plant: null, trail: null }; }

// ---------------------------------------------------------------- the workshop, phones: bench, pegboard, shelves of jars, a glowing battery bank, a lance on a stand, a panel on an easel, crates, a rug, a work light
export function workshopLow(parent, I) {
  const c = lowCtx(I, 991), { P, G, C, jit } = c, F = I.floor, L = CONFIG.workshop.low;
  P.add('wood', G.box(2.5, 0.08, 0.8), 0, F + 0.92, -0.575, 0, 0, 0, 1, 1, 1, C(0xb08a5a)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('wood', G.box(0.09, 0.9, 0.09), sx * 1.15, F + 0.45, -0.575 + sz * 0.32, 0, 0, 0, 1, 1, 1, C(0x6a4a2a));
  P.add('metal', G.box(0.22, 0.14, 0.16), 1.0, F + 1.03, -0.35, 0, 0, 0, 1, 1, 1, C(0x4f6a5f)); P.add('cer', G.sphere(1, 10, 6), 1.0, F + 1.35, -0.35, 0, 0, 0.2, 0.06, 0.28, 0.015, C(0xf2ecdc)); P.add('cell', G.box(0.4, 0.02, 0.3), -0.3, F + 0.97, -0.6, 0, 0.2, 0, 1, 1, 1, C(0xffffff));
  P.add('wood', G.box(3.0, 1.1, 0.025), 0, F + 1.95, -1.68, 0, 0, 0, 1, 1, 1, C(0xc8a878)); for (let i = 0; i < 6; i++) P.add(i % 2 ? 'metal' : 'cop', i % 2 ? G.box(0.05, 0.3, 0.02) : G.torus(0.09, 0.015, 5, 12), -1.2 + i * 0.48, F + 1.95, -1.66, 0, 0, 0, 1, 1, 1, C(i % 2 ? 0x8a8a84 : 0xd8a070));
  P.add('blue', new THREE.PlaneGeometry(0.75, 0.56), 1.75, F + 2.05, 0.75, 0, -PI / 2, 0); P.add('blue', new THREE.PlaneGeometry(0.6, 0.45), -1.85, F + 2.2, -1.68, 0, 0, 0.04);
  for (const y of [0.7, 1.15, 1.6]) P.add('wood', G.box(0.28, 0.03, 1.4), -2.05, F + y, 0.25, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k < L.jars; k++) jar(c, -2.05, F + [0.715, 1.165, 1.615][k % 3], -0.3 + (k * 0.27) % 1.2, 0.16, [0xc8a050, 0x6a4a2a, 0xa83a2a, 0x3a3a2a][k % 4], k % 3 === 1 ? 0x6fc8d8 : 0);
  P.add('wood', G.box(0.45, 1.0, 1.6), 1.97, F + 0.5, -0.85, 0, 0, 0, 1, 1, 1, C(0x8a6a4a)); for (let k = 0; k < L.cells; k++) { const z = -1.4 + (k % 4) * 0.36; P.add('glass', G.cyl(0.1, 0.1, 0.3, 10), 1.95, F + 1.16, z); P.add('glow', G.cyl(0.08, 0.08, 0.2, 10), 1.95, F + 1.12, z, 0, 0, 0, 1, 1, 1, C(0x6fd8e8)); P.add('cop', G.cyl(0.1, 0.1, 0.03, 10), 1.95, F + 1.32, z, 0, 0, 0, 1, 1, 1, C(0xd8a070)); }
  for (let k = 0; k < 3; k++) { const a = k * 2.094; P.add('metal', G.cyl(0.015, 0.015, 1.0, 5), -1.75 + Math.cos(a) * 0.12, F + 0.48, 1.2 + Math.sin(a) * 0.12, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25, 1, 1, 1, C(0x5a5650)); } P.add('cer', G.cyl(0.04, 0.05, 1.0, 10), -1.75, F + 1.05, 1.2, 0, 0, PI / 2 - 0.3, 1, 1, 1, C(0xf2ecdc)); P.add('glow', G.sphere(0.07, 10, 8), -1.3, F + 1.2, 1.2, 0, 0, 0, 1, 1, 1, C(0xffe08a));
  P.add('wood', G.box(0.05, 1.2, 0.05), 1.75, F + 0.6, 1.0, -0.15, 0, 0, 1, 1, 1, C(0x6a4a2a)); P.add('cell', G.box(0.7, 0.55, 0.03), 1.75, F + 1.0, 1.05, -0.25, 0, 0, 1, 1, 1, C(0xffffff));
  scrapCrate(c, -1.75, F, -1.25, 0.1); scrapCrate(c, 2.0, F, 0.35, 1.6);
  for (const [k, col] of [[0, 0xb8584a], [1, 0xe8c87a], [2, 0x3f7f6a], [3, 0xe8c87a], [4, 0xb8584a]]) P.add('cloth', G.box(1.8, 0.006, 0.2), 0, F + 0.006, 0.35 + k * 0.2, 0, 0, 0, 1, 1, 1, C(col));
  P.add('glow', G.sphere(0.06, 10, 8), 0, F + 2.35, -0.6, 0, 0, 0, 1, 1, 1, C(0xffd890)); P.add('metal', G.cyl(0.04, 0.18, 0.14, 12, true), 0, F + 2.45, -0.6, 0, 0, 0, 1, 1, 1, C(0x3f6b5a));
  P.add('wood', G.box(0.36, 0.04, 0.36), -1.0, F + 0.55, 0.15, 0, 0.3, 0, 1, 1, 1, C(0x8a6a4a)); P.add('wood', G.cyl(0.03, 0.03, 0.55, 6), -1.0, F + 0.27, 0.15, 0, 0, 0, 1, 1, 1, C(0x6a4a2a));
  // a few cheap things more (owner Nov 17: phone rooms not bare): hanging plants, a potted plant, a bench lamp, jars on the pegboard shelf, coils on the bench
  for (const sx of [-1.35, 1.35]) { P.add('pot', G.cyl(0.13, 0.1, 0.16, 8), sx, F + 2.1, 1.0); P.add('leaf', G.sphere(0.2, 7, 5), sx, F + 2.0, 1.0, 0, 0, 0, 1, 1.3, 1, C(0x4f9a3a)); }
  P.add('pot', G.cyl(0.17, 0.13, 0.3, 8), 2.0, F + 0.15, 0.35 + 0.0); P.add('leaf', G.sphere(0.3, 7, 5), 2.0, F + 0.55, 0.35, 0, 0, 0, 1, 1.2, 1, C(0x3f7f3a));
  P.add('metal', G.cyl(0.06, 0.07, 0.03, 8), -1.05, F + 0.975, -0.45, 0, 0, 0, 1, 1, 1, C(0x3f6b5a)); P.add('metal', G.cyl(0.015, 0.015, 0.4, 5), -1.05, F + 1.17, -0.5, 0.3, 0, 0, 1, 1, 1, C(0x3f6b5a)); P.add('glow', G.sphere(0.04, 8, 6), -1.0, F + 1.33, -0.38, 0, 0, 0, 1, 1, 1, C(0xffd890));
  P.add('wood', G.box(2.8, 0.03, 0.2), 0, F + 2.55, -1.6, 0, 0, 0, 1, 1, 1, C(0x8a6a4a)); for (let k = 0; k < 6; k++) jar(c, -1.1 + k * 0.45, F + 2.565, -1.6, 0.15, [0xc8a050, 0x6a4a2a, 0x7fa83a][k % 3], k % 2 ? 0x6fc8d8 : 0);
  for (let k = 0; k < 3; k++) P.add('cop', G.torus(0.05, 0.012, 5, 10), 0.2 + k * 0.13, F + 0.975, -0.35, PI / 2, 0, 0, 1, 1, 1, C(0xd8a070));
  mergeLow(parent, c.acc);
}

// ---------------------------------------------------------------- Marla's house, phones: a cot with a quilt, a stove and kettle, a desk under her patrol map, a crate, a pack and red scarves, a rug, a shelf of carved figures
export function marlaLow(parent, I) {
  const c = lowCtx(I, 4242), { P, G, C } = c, F = I.floor;
  P.add('wood', G.box(0.78, 0.3, 2.0), -1.55, F + 0.22, -0.45, 0, 0, 0, 1, 1, 1, C(0x7a5a3a)); P.add('cloth', G.box(0.72, 0.12, 1.94), -1.55, F + 0.43, -0.45, 0, 0, 0, 1, 1, 1, C(0xe8dcc0)); P.add('cloth', G.box(0.76, 0.05, 1.3), -1.55, F + 0.5, -0.1, 0, 0, 0, 1, 1, 1, C(0xb84a3a)); P.add('cloth', G.box(0.5, 0.12, 0.3), -1.55, F + 0.55, -1.25, 0, 0, 0, 1, 1, 1, C(0x5a8a6a));
  P.add('metal', G.box(0.5, 0.55, 0.45), -0.55, F + 0.28, -1.27, 0, 0, 0, 1, 1, 1, C(0x3a3836)); P.add('glow', G.box(0.2, 0.12, 0.01), -0.55, F + 0.25, -1.04, 0, 0, 0, 1, 1, 1, C(0xff8a40)); P.add('metal', G.cyl(0.06, 0.06, 3.2, 10), -0.55, F + 2.15, -1.32, 0, 0, 0, 1, 1, 1, C(0x4a4642)); P.add('cop', G.sphere(0.1, 10, 8), -0.45, F + 0.63, -1.2, 0, 0, 0, 1, 0.8, 1, C(0xd8905a));
  P.add('wood', G.box(1.2, 0.05, 0.56), 1.2, F + 0.76, -1.22, 0, 0, 0, 1, 1, 1, C(0x8a6a4a)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('wood', G.box(0.05, 0.74, 0.05), 1.2 + sx * 0.55, F + 0.37, -1.22 + sz * 0.23, 0, 0, 0, 1, 1, 1, C(0x6a4a2a));
  P.add('wood', G.box(1.5, 0.95, 0.03), 0.4, F + 1.75, -1.5, 0, 0, 0, 1, 1, 1, C(0xb08a5a)); P.add('mapt', new THREE.PlaneGeometry(1.4, 0.85), 0.4, F + 1.75, -1.48);
  scrapCrate(c, 1.6, F, 0.75, 1.5); P.add('cloth', G.box(0.4, 0.5, 0.25), 1.4, F + 0.25, 1.25, 0, 0.3, 0, 1, 1, 1, C(0x4f7a4a));
  for (let k = 0; k < 3; k++) P.add('cloth', G.box(0.18, 0.7, 0.03), -1.4 + k * 0.22, F + 1.25, 1.47, 0, 0, 0, 1, 1, 1, C(k === 1 ? 0xa83a32 : 0xc0443a));
  for (const [k, col] of [[0, 0x7f5a8a], [1, 0xe8c87a], [2, 0xb8584a], [3, 0x3f7f6a]]) P.add('cloth', G.box(1.4, 0.006, 0.22), 0.15, F + 0.006, 0.0 + k * 0.22, 0, 0, 0, 1, 1, 1, C(col));
  P.add('wood', G.box(0.2, 0.03, 0.9), 1.82, F + 1.45, 0.4, 0, 0, 0, 1, 1, 1, C(0x8a6a4a)); for (let k = 0; k < 4; k++) P.add('wood', G.cyl(0.03, 0.04, 0.12 + 0.03 * (k % 2), 8), 1.82, F + 1.53, 0.05 + k * 0.22, 0, 0, 0, 1, 1, 1, C(0xc8a070));
  P.add('pot', G.cyl(0.18, 0.14, 0.3, 10), 1.65, F + 0.15, 0.15); P.add('leaf', G.sphere(0.3, 8, 6), 1.65, F + 0.55, 0.15, 0, 0, 0, 1, 1.2, 1, C(0x4f9a3a));
  P.add('glow', G.sphere(0.05, 10, 8), 0, F + 2.2, 0, 0, 0, 0, 1, 1, 1, C(0xffd890));
  // a few cheap things more (owner Nov 17): a chair, books, two mugs, a rope coil, boots, a hanging plant, a chest at the cot's foot, her coat on a peg, herbs on the beam
  P.add('wood', G.box(0.4, 0.05, 0.4), 1.15, F + 0.46, -0.62, 0, 0, 0, 1, 1, 1, C(0x8a6a4a)); P.add('wood', G.box(0.4, 0.5, 0.04), 1.15, F + 0.72, -0.42, 0, 0, 0, 1, 1, 1, C(0x7a5a3a)); P.add('wood', G.box(0.36, 0.44, 0.36), 1.15, F + 0.22, -0.62, 0, 0, 0, 1, 1, 1, C(0x6a4a2a));
  for (let k = 0; k < 3; k++) P.add('cer', G.box(0.22, 0.04, 0.28), 0.4, F + 0.02 + k * 0.042, -0.95, 0, k * 0.3, 0, 1, 1, 1, C([0x8a3a2e, 0x2f5d8a, 0x3f6b4a][k])); P.add('cer', G.cyl(0.04, 0.035, 0.09, 8), 0.45, F + 1.31, -1.32, 0, 0, 0, 1, 1, 1, C(0xa8402e)); P.add('cer', G.cyl(0.04, 0.035, 0.09, 8), 0.64, F + 1.31, -1.32, 0, 0, 0, 1, 1, 1, C(0xf4f0e4)); P.add('wood', G.box(0.42, 0.03, 0.18), 0.55, F + 1.25, -1.32, 0, 0, 0, 1, 1, 1, C(0x8a6a4a));
  P.add('dark', G.torus(0.16, 0.03, 5, 12), 1.05, F + 0.04, 0.98, PI / 2, 0, 0, 1, 1, 1, C(0xb89a6a)); for (const sx of [-0.1, 0.1]) P.add('cloth', G.box(0.11, 0.26, 0.2), 0.75 + sx, F + 0.13, 1.3, 0, 0.3, 0, 1, 1, 1, C(0x4a3626));
  P.add('pot', G.cyl(0.13, 0.1, 0.16, 8), -1.55, F + 1.95, 0.3); P.add('leaf', G.sphere(0.2, 7, 5), -1.55, F + 1.85, 0.3, 0, 0, 0, 1, 1.3, 1, C(0x4f9a3a)); P.add('wood', G.box(0.62, 0.38, 0.4), -1.55, F + 0.19, 0.95, 0, PI / 2, 0, 1, 1, 1, C(0x7a4a2a)); P.add('cloth', G.box(0.4, 0.08, 0.3), -1.55, F + 0.42, 0.95, 0, PI / 2, 0, 1, 1, 1, C(0xc0443a));
  P.add('cloth', G.box(0.06, 0.95, 0.42), 1.88, F + 1.22, -0.45, 0, 0, 0, 1, 1, 1, C(0x3f6a42)); for (let k = 0; k < 3; k++) P.add('leaf', G.cyl(0.04, 0.012, 0.25, 5), -0.6 + k * 0.5, I.h - 0.25, 0.3, 0, 0, 0, 1, 1, 1, C(0x5a7a34));
  mergeLow(parent, c.acc);
}

// ---------------------------------------------------------------- the workshop, desktop (inside the DENSITY merge of src/basehi.js; c: its placer, shapes, random, materials, tints, plant/trail/books)
// warm plaster above plank wainscot, a plank floor, boards lining the vault; a big workbench (parts trays, a vice holding a turbine blade, hand tools, a half-built lance, a soldering
// lamp and a lens); a pegboard of tools; shelves of jars, coils, lenses and salvaged parts; a glowing glass battery bank wired up to the roof; a lance on a tripod and a solar panel on an
// easel being mended; cables along the walls; warm work lights; blueprints and sketches pinned up; plants hanging and in pots; a stool, a rug, crates of scrap.
const hiMats = {};
function addMats(M) { if (!hiMats.blue) { const S = (o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o)); m.userData.shared = true; m.userData.pbr = true; return m; }; hiMats.blue = S({ map: blueprintTex(), roughness: 0.85 }); hiMats.sketch = S({ map: sketchTex(), roughness: 0.9 }); hiMats.cyan = S({ color: 0x9fe8dc, emissive: 0x3fc8b4, emissiveIntensity: CONFIG.workshop.high.cyan, roughness: 0.3 }); } M.blue = hiMats.blue; M.sketch = hiMats.sketch; M.cyan = hiMats.cyan; }
export function workshopHi(c, I) {
  addMats(c.M); const { P, G, r, C, jit, V: v } = c, H = CONFIG.workshop.high, F = I.floor, hw = I.w / 2 - I.t, hd = I.d / 2 - I.t; c.F = F;
  // walls: plaster above, planks below; the floor; the vault lined with boards; two tie beams for the lights and cables
  plaster(c, 2 * hw, 1.98, 0, F + 1.96, -hd + 0.006, 0); plaster(c, 2 * hd, 1.98, -hw + 0.006, F + 1.96, 0, PI / 2); plaster(c, 2 * hd, 1.98, hw - 0.006, F + 1.96, 0, -PI / 2);
  for (const sx of [-1, 1]) plaster(c, hw - I.dw / 2, 1.98, sx * (hw + I.dw / 2) / 2, F + 1.96, hd - 0.006, PI);
  wainscot(c, 2 * hw, 0, -hd + 0.004, 0, 1.0); wainscot(c, 2 * hd, -hw + 0.004, 0, PI / 2, 1.0); wainscot(c, 2 * hd, hw - 0.004, 0, -PI / 2, 1.0); for (const sx of [-1, 1]) wainscot(c, hw - I.dw / 2 - 0.05, sx * (hw + I.dw / 2) / 2, hd - 0.004, PI, 1.0);
  planks(c, hw, hd); vaultBoards(c, I, H.boards);
  for (const z of [-1.0, 1.0]) P.add('wood', G.box(2 * hw, 0.12, 0.14), 0, I.h + 0.05, z, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a, 0.04));
  // the inside of the round front windows: stained glass seen from within, a deep sill with a small pot
  for (const [wx, wy, wr] of I.windows) { P.add('stained', new THREE.CircleGeometry(wr * 0.95, 28), wx, wy, hd - 0.02, 0, PI, 0, 1, 1, 1, C(0xffffff)); P.add('wood', G.box(wr * 2 + 0.1, 0.04, 0.22), wx, wy - wr - 0.05, hd - 0.1, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); P.add('pot', G.lathe('spot', [[0, 0], [0.06, 0], [0.08, 0.12], [0.085, 0.13]], 10), wx + 0.15, wy - wr - 0.03, hd - 0.1); plantHi(c, wx + 0.15, wy - wr + 0.09, hd - 0.1, 0.18, 6, 1); }
  // ---- the workbench (Oko works behind it, facing the door)
  P.push(0, F, -0.575, 0);
  P.add('wood', G.box(2.5, 0.08, 0.8), 0, 0.92, 0, 0, 0, 0, 1, 1, 1, jit(0xa87a4a, 0.05)); P.add('wood', G.box(2.5, 0.16, 0.03), 0, 0.8, 0.39, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('wood', G.box(0.09, 0.88, 0.09), sx * 1.15, 0.44, sz * 0.33, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a));
  P.add('wood', G.box(2.3, 0.03, 0.66), 0, 0.22, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k < 4; k++) P.add('cop', G.torus(0.09, 0.025, 6, 14), -0.8 + k * 0.18, 0.27, 0.05, PI / 2, 0, 0, 1, 1, 1, C(0xffffff)); scrapCrate(c, 0.6, 0.235, 0.0, 0.05);
  for (let k = 0; k < 6; k++) { P.add('cer', G.box(0.36, 0.11, 0.2), -0.95 + k * 0.38, 1.03, -0.29, 0, 0, 0, 1, 1, 1, jit(0x8fc79a, 0.06)); P.add('cop', G.sphere(0.014, 6, 4), -0.95 + k * 0.38, 1.03, -0.185); }
  // parts trays with copper rings, solar cell chips, glass bulbs, screws
  for (const tx of [-0.75, -0.25, 0.3]) { P.add('wood', G.box(0.42, 0.035, 0.3), tx, 0.98, -0.05, 0, 0, 0, 1, 1, 1, jit(0x9a7a5a)); for (const sx of [-1, 1]) P.add('wood', G.box(0.012, 0.05, 0.3), tx + sx * 0.2, 1.0, -0.05); for (const sz of [-1, 0, 1]) P.add('wood', G.box(0.42, 0.05, 0.012), tx, 1.0, -0.05 + sz * 0.14); }
  for (let k = 0; k < H.parts; k++) { const tx = [-0.75, -0.25, 0.3][k % 3] + (r() - 0.5) * 0.34, tz = -0.05 + (r() - 0.5) * 0.22, t = r(); if (t < 0.3) P.add('cop', G.torus(0.025, 0.007, 5, 10), tx, 1.01, tz, PI / 2, 0, 0, 1, 1, 1, C(0xffffff)); else if (t < 0.55) P.add('cell', G.box(0.06, 0.006, 0.045), tx, 1.003, tz, 0, r() * 3, 0, 1, 1, 1, C(0xffffff)); else if (t < 0.75) { P.add('glass', G.sphere(0.022, 8, 6), tx, 1.02, tz); P.add('glow', G.sphere(0.007, 5, 4), tx, 1.02, tz, 0, 0, 0, 1, 1, 1, C(0xffe0a0)); } else P.add('metal', G.cyl(0.004, 0.004, 0.04, 5), tx, 1.003, tz, PI / 2, r() * 3, 0, 1, 1, 1, C(0x9a9a94)); }
  // the vice at the right end, holding a turbine blade (ceramic, copper root)
  P.push(0.95, 0.96, 0.28, 0); P.add('metal', G.box(0.2, 0.06, 0.16), 0, 0.03, 0, 0, 0, 0, 1, 1, 1, C(0x3f5a4f)); for (const sx of [-1, 1]) P.add('metal', G.box(0.05, 0.14, 0.14), sx * 0.045, 0.13, 0, 0, 0, 0, 1, 1, 1, C(0x4f6a5f)); P.add('metal', G.cyl(0.012, 0.012, 0.32, 8), 0.2, 0.12, 0, 0, 0, PI / 2, 1, 1, 1, C(0xb0b0a8)); P.add('metal', G.cyl(0.01, 0.01, 0.2, 6), 0.36, 0.12, 0, 0, 0, 0, 1, 1, 1, C(0xb0b0a8));
  P.add('cop', G.cyl(0.05, 0.05, 0.05, 16), 0, 0.2, 0); P.add('cop', G.cyl(0.035, 0.045, 0.04, 16), 0, 0.245, 0); P.add('cer', bladeGeo(), 0, 0.26, 0, 0, 0.9, -0.1, 0.085, 0.4, 0.085, C(0xf2ecdc)); P.add('cell', bladeGeo(), 0.002, 0.3, 0.004, 0, 0.9, -0.1, 0.05, 0.3, 0.08, C(0xffffff)); P.pop();
  // hand tools lying on the bench: a hammer, a screwdriver, pliers, a file; a half-built lance on a cloth
  P.add('wood', G.cyl(0.014, 0.016, 0.3, 6), 0.55, 0.975, 0.2, 0, 0.4, PI / 2, 1, 1, 1, jit(0x8a5a3a)); P.add('metal', G.box(0.04, 0.04, 0.13), 0.68, 0.98, 0.26, 0, 0.4, 0, 1, 1, 1, C(0x5a5a54));
  P.add('cer', G.cyl(0.016, 0.016, 0.1, 8), -0.05, 0.97, 0.27, 0, -0.3, PI / 2, 1, 1, 1, C(0xc83a2a)); P.add('metal', G.cyl(0.004, 0.004, 0.12, 6), 0.06, 0.97, 0.235, 0, -0.3, PI / 2, 1, 1, 1, C(0xb0b0a8));
  for (const a of [-0.12, 0.12]) P.add('metal', G.box(0.17, 0.012, 0.02), 0.25, 0.966, 0.3, 0, 0.6 + a, 0, 1, 1, 1, C(0x6a6a64)); P.add('metal', G.box(0.2, 0.006, 0.02), -0.3, 0.965, 0.32, 0, 0.15, 0, 1, 1, 1, C(0x8a8a84));
  P.add('cloth', G.box(0.7, 0.006, 0.3), -0.55, 0.963, 0.15, 0, 0.05, 0, 1, 1, 1, jit(0xd8c8a0)); P.add('cer', G.cyl(0.03, 0.03, 0.62, 10), -0.55, 1.0, 0.15, 0, 0.05, PI / 2, 1, 1, 1, C(0xf2ecdc)); for (let k = 0; k < 4; k++) P.add('cop', G.torus(0.04, 0.008, 5, 12), -0.75 + k * 0.1, 1.0, 0.15, 0, PI / 2 + 0.05, 0, 1, 1, 1, C(0xffffff)); P.add('glass', G.sphere(0.06, 12, 8), -0.2, 1.0, 0.17); P.add('cyan', G.sphere(0.025, 8, 6), -0.2, 1.0, 0.17, 0, 0, 0, 1, 1, 1, C(0xffffff));
  // the soldering lamp at the left end: weighted foot, jointed arm, metal shade, warm bulb; the iron in its coil stand; a lens on a copper ring
  P.push(-1.05, 0.96, 0.1, 0); P.add('metal', G.cyl(0.08, 0.09, 0.04, 14), 0, 0.02, 0, 0, 0, 0, 1, 1, 1, C(0x3f6b5a)); P.rod('metal', G, v(0, 0.04, 0), v(0.08, 0.45, -0.05), 0.012, 6, C(0x3f6b5a)); P.rod('metal', G, v(0.08, 0.45, -0.05), v(0.3, 0.52, 0.05), 0.012, 6, C(0x3f6b5a));
  P.add('metal', G.cyl(0.03, 0.11, 0.12, 14, true), 0.32, 0.47, 0.06, 0.3, 0, -0.4, 1, 1, 1, C(0x3f6b5a)); P.add('glow', G.sphere(0.035, 10, 8), 0.33, 0.43, 0.07, 0, 0, 0, 1, 1, 1, C(0xffd890));
  P.add('cop', G.torus(0.03, 0.006, 5, 10), 0.18, 0.06, 0.22, PI / 2, 0, 0, 1, 1, 1, C(0xffffff)); for (let k = 0; k < 5; k++) P.add('cop', G.torus(0.025, 0.004, 4, 10), 0.18, 0.08 + k * 0.018, 0.22, PI / 2, 0, 0, 1, 1, 1, C(0xffffff)); P.add('metal', G.cyl(0.008, 0.004, 0.2, 6), 0.18, 0.15, 0.22, 0.4, 0, 0, 1, 1, 1, C(0x8a8a84));
  P.rod('cop', G, v(-0.1, 0.03, 0.2), v(-0.1, 0.28, 0.25), 0.006, 5); P.add('cop', G.torus(0.065, 0.008, 6, 18), -0.1, 0.33, 0.27, -0.3, 0, 0, 1, 1, 1, C(0xffffff)); P.add('glass', G.cyl(0.062, 0.062, 0.006, 18), -0.1, 0.33, 0.27, PI / 2 - 0.3, 0, 0); P.pop();
  P.pop();
  // ---- the pegboard behind Oko: tools on pegs, copper coils, a top shelf of jars
  P.add('wood', G.box(3.0, 1.1, 0.025), 0, F + 1.95, -hd + 0.03, 0, 0, 0, 1, 1, 1, jit(0xc8a878)); for (let i = 0; i < 18; i++) for (let j = 0; j < 6; j++) if ((i + j) % 3 === 0) P.add('dark', G.cyl(0.006, 0.006, 0.005, 5), -1.4 + i * 0.165, F + 1.48 + j * 0.18, -hd + 0.044, PI / 2, 0, 0, 1, 1, 1, C(0x4a3a2a));
  for (let i = 0; i < H.tools; i++) { const x = -1.3 + i * (2.6 / Math.max(1, H.tools - 1)), y = F + 1.95 + (i % 2 ? 0.08 : -0.05), t = i % 4; P.add('cop', G.cyl(0.006, 0.006, 0.05, 6), x, y + 0.2, -hd + 0.06, PI / 2, 0, 0, 1, 1, 1, C(0xffffff));
    if (t === 0) { P.add('metal', G.box(0.03, 0.26, 0.012), x, y, -hd + 0.06, 0, 0, 0.08, 1, 1, 1, C(0x8a8a84)); P.add('metal', G.box(0.08, 0.045, 0.014), x, y + 0.13, -hd + 0.06, 0, 0, 0.08, 1, 1, 1, C(0x8a8a84)); }
    else if (t === 1) { P.add('wood', G.cyl(0.02, 0.02, 0.11, 6), x, y + 0.08, -hd + 0.06, 0, 0, 0, 1, 1, 1, jit([0xc83a2a, 0x3f7f5a, 0xe8b040][i % 3])); P.add('metal', G.cyl(0.005, 0.005, 0.14, 6), x, y - 0.05, -hd + 0.06); }
    else if (t === 2) P.add('cop', G.torus(0.08, 0.014, 6, 16), x, y, -hd + 0.06, 0, 0, 0, 1, 1, 1, C(0xffffff));
    else { P.add('metal', G.box(0.22, 0.09, 0.006), x, y, -hd + 0.06, 0, 0, 0.1, 1, 1, 1, C(0xa0a09a)); P.add('wood', G.box(0.07, 0.1, 0.02), x + 0.13, y + 0.01, -hd + 0.06, 0, 0, 0.1, 1, 1, 1, jit(0x8a5a3a)); } }
  P.add('wood', G.box(3.0, 0.03, 0.2), 0, F + 2.55, -hd + 0.1, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k < 9; k++) jar(c, -1.35 + k * 0.33, F + 2.565, -hd + 0.1, 0.13 + 0.05 * (k % 3), [0xc8a050, 0x6a4a2a, 0x7fa83a, 0x3a3a2a, 0xe8d8a0][k % 5], k % 4 === 2 ? 0x6fc8d8 : 0);
  // blueprints and sketches pinned up: by the pegboard, on the right wall over the battery bank, on the left wall over the shelves, by the door
  const pin = (x, y, z, ry) => { P.push(x, y, z, ry); P.add('fruit', G.sphere(0.012, 6, 4), 0, 0, 0.01, 0, 0, 0, 1, 1, 1, jit([0xc83a2a, 0x3f7fba, 0xe8c040][Math.floor(r() * 3)], 0.02)); P.pop(); };
  const sheet = (key, w, h, x, y, z, ry, tilt) => { P.push(x, y, z, ry); P.add(key, new THREE.PlaneGeometry(w, h), 0, 0, 0.004, 0, 0, tilt || 0, 1, 1, 1, C(0xffffff)); P.pop(); pin(x + Math.cos(ry) * (-w / 2 + 0.04), y + h / 2 - 0.04, z - Math.sin(ry) * (-w / 2 + 0.04), ry); pin(x + Math.cos(ry) * (w / 2 - 0.04), y + h / 2 - 0.04, z - Math.sin(ry) * (w / 2 - 0.04), ry); };
  sheet('blue', 0.55, 0.42, -1.86, F + 2.3, -hd + 0.01, 0, 0.03); sheet('sketch', 0.3, 0.38, 1.85, F + 2.25, -hd + 0.01, 0, -0.05); sheet('blue', 0.85, 0.62, hw - 0.01, F + 2.15, 0.85, -PI / 2, -0.02); sheet('sketch', 0.3, 0.38, hw - 0.01, F + 2.2, 1.45, -PI / 2, 0.06);
  sheet('blue', 0.62, 0.46, -hw + 0.01, F + 2.4, 0.3, PI / 2, 0.02); sheet('sketch', 0.28, 0.36, -hw + 0.01, F + 2.35, -0.55, PI / 2, -0.04); sheet('sketch', 0.26, 0.34, -1.4, F + 1.05, hd - 0.012, PI, 0.05);
  // ---- shelves on the left wall: jars, coils, lenses, gears, a small motor, wire spools
  P.push(-hw + 0.15, F, 0.25, PI / 2); for (const sx of [-0.68, 0.68]) P.add('wood', G.box(0.04, 1.75, 0.26), sx, 0.875, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); const ys = [0.68, 1.12, 1.56];
  for (const y of ys) P.add('wood', G.box(1.4, 0.03, 0.28), 0, y, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a));
  for (let k = 0; k < H.jars; k++) { const y = ys[k % 3] + 0.015, x = -0.58 + ((k * 0.37) % 1.16), t = k % 5;
    if (t < 2) jar(c, x, y, 0, 0.12 + 0.06 * r(), [0xc8a050, 0x6a4a2a, 0xa83a2a, 0x3a3a2a, 0xe8d8a0, 0x7fa83a][k % 6], k % 4 === 1 ? 0x6fc8d8 : 0);
    else if (t === 2) P.add('cop', G.torus(0.06, 0.016, 6, 16), x, y + 0.075, 0, 0, 0, 0, 1, 1, 1, C(0xffffff));
    else if (t === 3) { P.add('cop', G.torus(0.05, 0.007, 5, 14), x, y + 0.055, 0.02, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.add('glass', G.cyl(0.048, 0.048, 0.006, 16), x, y + 0.055, 0.02, PI / 2, 0, 0); }
    else { P.add('metal', G.torus(0.055, 0.02, 5, 10), x, y + 0.08, 0, 0, 0, 0, 1, 1, 1, jit(0x7a7a72, 0.1)); for (let q = 0; q < 8; q++) { const a = q * PI / 4; P.add('metal', G.box(0.025, 0.025, 0.03), x + Math.cos(a) * 0.08, y + 0.08 + Math.sin(a) * 0.08, 0, 0, 0, a, 1, 1, 1, jit(0x7a7a72, 0.1)); } } }
  P.add('metal', G.cyl(0.07, 0.07, 0.16, 12), 0.45, ys[2] + 0.1, 0, 0, 0, PI / 2, 1, 1, 1, C(0x4f5a55)); P.add('cop', G.cyl(0.072, 0.072, 0.08, 12), 0.45, ys[2] + 0.1, 0, 0, 0, PI / 2, 1, 1, 1, C(0xffffff)); for (const x of [-0.3, -0.12]) { P.add('wood', G.cyl(0.05, 0.05, 0.06, 10), x, ys[0] + 0.08, 0.05, PI / 2, 0, 0, 1, 1, 1, jit(0x9a7a5a)); P.add('cop', G.cyl(0.04, 0.04, 0.055, 10), x, ys[0] + 0.08, 0.05, PI / 2, 0, 0, 1, 1, 1, C(0xffffff)); }
  for (const x of [-0.5, 0.55]) { P.add('pot', G.lathe('spot', [[0, 0], [0.06, 0], [0.08, 0.12], [0.085, 0.13]], 10), x, ys[2] + 0.015, 0.02); plantHi(c, x, ys[2] + 0.14, 0.02, 0.2, 7, 1); trailHi(c, x, ys[2] + 0.1, 0.1, 0.5 + 0.3 * r()); }
  P.pop();
  // ---- the battery bank on the right wall: a three-tier rack of glass cells glowing sea-green, copper bus bars, a gauge, cables up to the roof's solar skin
  P.push(hw - 0.24, F, -0.85, -PI / 2); for (const sx of [-0.8, 0.8]) P.add('wood', G.box(0.05, 1.7, 0.42), sx, 0.85, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); const ty = [0.3, 0.85, 1.4];
  for (const y of ty) P.add('wood', G.box(1.65, 0.04, 0.44), 0, y, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a));
  for (let j = 0; j < 3; j++) for (let i = 0; i < H.cells; i++) { if (j === 2 && i % 2) continue; const y = ty[j] + 0.02, x = -0.62 + i * (1.24 / Math.max(1, H.cells - 1)); P.add('glass', G.cyl(0.07, 0.07, 0.3, 14), x, y + 0.15, 0.02); P.add('cyan', G.cyl(0.058, 0.058, 0.22 * (0.5 + 0.5 * r()), 12), x, y + 0.12, 0.02, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.add('cop', G.cyl(0.075, 0.075, 0.03, 14), x, y + 0.31, 0.02, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.add('cop', G.cyl(0.012, 0.012, 0.05, 6), x, y + 0.34, 0.02); }
  for (const y of [ty[0], ty[1]]) P.add('cop', G.box(1.3, 0.015, 0.03), 0, y + 0.37, 0.02, 0, 0, 0, 1, 1, 1, C(0xffffff));
  P.add('cer', G.cyl(0.11, 0.11, 0.03, 20), 0.4, 1.62, 0.06, PI / 2, 0, 0, 1, 1, 1, C(0xf2ecdc)); P.add('cop', G.torus(0.11, 0.012, 6, 20), 0.4, 1.62, 0.075, 0, 0, 0, 1, 1, 1, C(0xffffff)); P.add('dark', G.box(0.006, 0.08, 0.004), 0.42, 1.64, 0.08, 0, 0, -0.6, 1, 1, 1, C(0x8a2a22));
  for (const x of [-0.3, 0.1]) { P.rod('dark', G, v(x, 1.45, 0.0), v(x + 0.05, 2.6, -0.17), 0.012, 5, C(0x2a2a28)); P.rod('dark', G, v(x + 0.05, 2.6, -0.17), v(x + 0.05, I.h + 0.4, -0.17), 0.012, 5, C(0x2a2a28)); }
  P.pop();
  // cables clipped along the back wall top and down to the bench lamp; another across the tie beam to the work lights
  { let prev = v(hw - 0.05, F + 2.75, -hd + 0.05); for (let k = 1; k <= 8; k++) { const q = v(hw - 0.05 - k * (2 * hw - 0.1) / 8, F + 2.75 - 0.04 * Math.sin(k * 1.3), -hd + 0.05); P.rod('dark', G, prev, q, 0.01, 5, C(0x2a2a28)); prev = q; } P.rod('dark', G, prev, v(-1.1, F + 1.0, -0.5), 0.01, 5, C(0x2a2a28));
    for (let k = 0; k < 8; k++) P.add('cop', G.box(0.03, 0.02, 0.025), hw - 0.3 - k * 0.55, F + 2.76, -hd + 0.05, 0, 0, 0, 1, 1, 1, C(0xffffff)); }
  { let prev = v(-hw + 0.05, I.h + 0.0, -1.0); for (let k = 1; k <= 8; k++) { const t = k / 8, q = v(-hw + 0.05 + t * (2 * hw - 0.1), I.h - 0.04 - 0.08 * 4 * t * (1 - t), -0.92); P.rod('dark', G, prev, q, 0.008, 4, C(0x2a2a28)); prev = q; } }
  // warm work lights over the bench, hung from the back tie beam
  for (let k = 0; k < H.bulbs; k++) workLight(c, -0.9 + k * (1.8 / Math.max(1, H.bulbs - 1)), -0.6, I.h - 0.02, F + 2.15 + (k % 2) * 0.08);
  // ---- prototypes on stands: a lance on a tripod (front left), a solar panel being mended on an easel (front right)
  P.push(-1.75, F, 1.2, 0.5); for (let k = 0; k < 3; k++) { const a = k * 2.094; P.rod('metal', G, v(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26), v(0, 0.95, 0), 0.014, 6, C(0x5a5650)); } P.add('cop', G.cyl(0.05, 0.05, 0.06, 12), 0, 0.97, 0);
  P.push(0, 1.06, 0, 0, 0, 0.32); P.add('cer', G.cyl(0.05, 0.06, 0.9, 14), 0, 0, 0, 0, 0, PI / 2, 1, 1, 1, C(0xf2ecdc)); for (let k = 0; k < 5; k++) P.add('cop', G.torus(0.065 - k * 0.003, 0.01, 6, 16), -0.3 + k * 0.12, 0, 0, 0, PI / 2, 0, 1, 1, 1, C(0xffffff));
  P.add('cer', G.lathe('bud', [[0.0, 0], [0.06, 0.02], [0.085, 0.09], [0.07, 0.17], [0.03, 0.21], [0, 0.22]], 14), 0.45, 0, 0, 0, 0, -PI / 2, 1.3, 1.3, 1.3, C(0x8fc79a)); P.add('glass', G.sphere(0.1, 14, 10), 0.62, 0, 0); P.add('cyan', G.sphere(0.05, 10, 8), 0.62, 0, 0, 0, 0, 0, 1, 1, 1, C(0xffffff)); for (let k = 0; k < 5; k++) { P.push(0.55, 0, 0, 0, k * 1.256, 0); P.add('cell', G.box(0.04, 0.008, 0.16), 0, 0.09, 0.0, 0.5, 0, 0, 1, 1, 1, C(0xffffff)); P.pop(); } P.pop(); P.pop();
  P.push(1.75, F, 1.15, -0.5); for (const sx of [-0.28, 0.28]) P.add('wood', G.box(0.04, 1.35, 0.04), sx, 0.66, 0.05, -0.12, 0, 0, 1, 1, 1, jit(0x6a4a2a)); P.add('wood', G.box(0.04, 1.3, 0.04), 0, 0.62, -0.22, 0.25, 0, 0, 1, 1, 1, jit(0x6a4a2a)); P.add('wood', G.box(0.75, 0.04, 0.08), 0, 0.62, 0.09, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a));
  P.push(0, 0.98, 0.04, 0, -0.18, 0); P.add('wood', G.box(0.74, 0.62, 0.035), 0, 0, 0, 0, 0, 0, 1, 1, 1, jit(0x3f6b5a)); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const gone = i === 2 && j === 1; P.add(gone ? 'dark' : 'cell', G.box(0.16, 0.17, 0.01), -0.255 + i * 0.17, -0.19 + j * 0.19, 0.022, 0, 0, gone ? 0 : (r() - 0.5) * 0.02, 1, 1, 1, gone ? C(0x1a1a18) : C(0xffffff)); }
  P.add('cell', G.box(0.16, 0.17, 0.01), 0.2, -0.45, 0.1, -0.6, 0.3, 0.1, 1, 1, 1, C(0xffffff)); P.add('cop', G.box(0.03, 0.08, 0.02), -0.37, 0.25, 0.03, 0, 0, 0.3, 1, 1, 1, C(0xffffff)); P.pop(); P.pop();
  // ---- crates of scrap in the back left corner (stacked), a sack beside them; another crate by the battery bank with a big potted fern
  scrapCrate(c, -1.75, F, -1.25, 0.1); scrapCrate(c, -1.72, F + 0.4, -1.27, -0.15); P.add('cloth', G.lump(3), -1.55, F + 0.22, -0.82, 0, 0.4, 0, 0.26, 0.25, 0.22, jit(0xb8a070));
  bigPot(c, 2.0, 0.35, 0.6);
  // ---- hanging planters from the front tie beam, a stool, a rug in front of the bench
  for (let k = 0; k < 2; k++) hanger(c, k ? 1.35 : -1.35, 1.0, I.h - 0.01, F + 2.05, H.plants);
  P.push(-1.0, F, 0.15, 0.3); P.add('wood', G.cyl(0.18, 0.18, 0.04, 14), 0, 0.56, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (let k = 0; k < 3; k++) { const a = k * 2.094; P.add('wood', G.cyl(0.018, 0.022, 0.56, 6), Math.cos(a) * 0.12, 0.28, Math.sin(a) * 0.12, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12, 1, 1, 1, jit(0x6a4a2a)); } P.add('cloth', puffyGeo(), 0, 0.61, 0, 0, 0.4, 0, 0.3, 0.07, 0.3, jit(0x5a8a6a)); P.pop();
  rug(c, 0.1, 0.75, 1.9, 1.0, [0xb8584a, 0xe8c87a, 0x3f7f6a, 0xf2ecdc, 0xb8584a, 0x8a6a3a, 0x3f7f6a]);
  doorLamp(c, I);
}

// ---------------------------------------------------------------- Marla's house, desktop: a scout's room
// a wall map of patrol routes with pins and red string, binoculars on a hook, a spyglass on the desk; rope, boots and a pack by the door, spare red scarves on hooks;
// a cot with a patchwork quilt; a tea kettle on a small stove, two mugs (one used, one never used); plants, a rug, a crate of salvaged bits, a little shelf of carved figures.
export function marlaHi(c, I) {
  addMats(c.M); const { P, G, r, C, jit, V: v } = c, H = CONFIG.marlaHouse.high, F = I.floor, hw = I.w / 2 - I.t, hd = I.d / 2 - I.t; c.F = F;
  plaster(c, 2 * hw, 1.72, 0, F + 1.78, -hd + 0.006, 0); plaster(c, 2 * hd, 1.72, -hw + 0.006, F + 1.78, 0, PI / 2); plaster(c, 2 * hd, 1.72, hw - 0.006, F + 1.78, 0, -PI / 2);
  for (const sx of [-1, 1]) plaster(c, hw - I.dw / 2, 1.72, sx * (hw + I.dw / 2) / 2, F + 1.78, hd - 0.006, PI);
  wainscot(c, 2 * hw, 0, -hd + 0.004, 0, 0.95); wainscot(c, 2 * hd, -hw + 0.004, 0, PI / 2, 0.95); wainscot(c, 2 * hd, hw - 0.004, 0, -PI / 2, 0.95); for (const sx of [-1, 1]) wainscot(c, hw - I.dw / 2 - 0.05, sx * (hw + I.dw / 2) / 2, hd - 0.004, PI, 0.95);
  planks(c, hw, hd); vaultBoards(c, I, H.boards); P.add('wood', G.box(2 * hw, 0.11, 0.13), 0, I.h + 0.05, 0.3, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a, 0.04));
  for (const [wx, wy, wr] of I.windows) { P.add('stained', new THREE.CircleGeometry(wr * 0.95, 28), wx, wy, hd - 0.02, 0, PI, 0, 1, 1, 1, C(0xffffff)); P.add('wood', G.box(wr * 2 + 0.1, 0.04, 0.2), wx, wy - wr - 0.05, hd - 0.1, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); }
  P.add('pot', G.lathe('spot', [[0, 0], [0.06, 0], [0.08, 0.12], [0.085, 0.13]], 10), I.windows[0][0], I.windows[0][1] - I.windows[0][2] - 0.03, hd - 0.1); plantHi(c, I.windows[0][0], I.windows[0][1] - I.windows[0][2] + 0.09, hd - 0.1, 0.2, 7, 2);
  // ---- the wall map of patrol routes over the desk: cork board, the map, pins, red string from pin to pin, notes; binoculars hung on a peg beside it
  P.push(0.35, F + 1.72, -hd + 0.02, 0); P.add('wood', G.box(1.55, 1.0, 0.03), 0, 0, 0, 0, 0, 0, 1, 1, 1, jit(0xb08a5a)); P.add('mapt', new THREE.PlaneGeometry(1.15, 0.8), -0.12, 0.02, 0.02, 0, 0, 0.02, 1, 1, 1, C(0xffffff));
  const pins = []; for (let k = 0; k < H.pins; k++) { const q = v(-0.62 + r() * 1.0, -0.35 + r() * 0.72, 0.035); pins.push(q); P.add('fruit', G.sphere(0.014, 6, 4), q.x, q.y, q.z, 0, 0, 0, 1, 1, 1, jit(k % 4 ? 0xc83a2a : 0xe8c040, 0.02)); }
  for (let k = 1; k < pins.length; k++) if (k % 5) P.rod('fruit', G, pins[k - 1], pins[k], 0.0025, 3, C(0xb8302a));
  for (let k = 0; k < 4; k++) P.add('cer', G.box(0.13, 0.16, 0.004), 0.58, 0.3 - k * 0.19, 0.022 + 0.001 * k, 0, 0, (r() - 0.5) * 0.2, 1, 1, 1, jit([0xf2ecdc, 0xe8d8a0][k % 2], 0.05));
  P.add('cop', G.cyl(0.008, 0.008, 0.06, 6), 0.9, 0.38, 0.03, PI / 2, 0, 0); P.rod('dark', G, v(0.9, 0.38, 0.06), v(0.86, 0.12, 0.06), 0.004, 4); P.rod('dark', G, v(0.9, 0.38, 0.06), v(0.98, 0.12, 0.06), 0.004, 4);
  for (const sx of [-0.045, 0.045]) { P.add('dark', G.cyl(0.032, 0.036, 0.14, 12), 0.92 + sx, 0.06, 0.07, 0, 0, 0, 1, 1, 1, C(0x2a2a26)); P.add('glass', G.cyl(0.03, 0.03, 0.005, 12), 0.92 + sx, -0.015, 0.07); } P.add('cop', G.box(0.06, 0.03, 0.03), 0.92, 0.1, 0.07); P.pop();
  // ---- the desk (the journal itself is drawn by baseview.js, so its unread ribbon can come and go): an oil lamp, ink and pen, a spyglass, a used mug, a pinecone, a folded map
  P.push(1.2, F, -1.22, 0); P.add('wood', G.box(1.2, 0.05, 0.56), 0, 0.76, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('wood', G.box(0.05, 0.74, 0.05), sx * 0.55, 0.37, sz * 0.23, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); P.add('wood', G.box(0.42, 0.14, 0.48), -0.3, 0.64, 0, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a)); P.add('cop', G.sphere(0.012, 6, 4), -0.3, 0.64, 0.25);
  P.add('cop', G.cyl(0.06, 0.07, 0.03, 12), 0.42, 0.8, -0.12); P.add('glass', G.lathe('bud', [[0.0, 0], [0.06, 0.02], [0.085, 0.09], [0.07, 0.17], [0.03, 0.21], [0, 0.22]], 14), 0.42, 0.815, -0.12); P.add('glow', G.sphere(0.03, 10, 8), 0.42, 0.9, -0.12, 0, 0, 0, 1, 1, 1, C(0xffd890));
  P.add('glass', G.cyl(0.025, 0.03, 0.05, 10), 0.25, 0.81, -0.15, 0, 0, 0, 1, 1, 1); P.add('dark', G.cyl(0.022, 0.022, 0.03, 10), 0.25, 0.8, -0.15); P.add('cer', G.cyl(0.003, 0.002, 0.18, 4), 0.27, 0.86, -0.15, 0.4, 0, 0.3, 1, 1, 1, C(0xf2ecdc));
  for (const [x, rad, len] of [[-0.42, 0.024, 0.2], [-0.25, 0.02, 0.16], [-0.12, 0.016, 0.12]]) P.add('cop', G.cyl(rad, rad, len, 12), x, 0.8, 0.12, 0, 0.15, PI / 2, 1, 1, 1, C(0xd8a868)); P.add('glass', G.cyl(0.024, 0.024, 0.004, 12), -0.52, 0.8, 0.105, 0, 0.15, PI / 2);
  P.add('cer', G.cyl(0.04, 0.035, 0.09, 12), 0.35, 0.83, 0.15, 0, 0, 0, 1, 1, 1, jit(0x3f7f6a)); P.add('dark', G.cyl(0.034, 0.034, 0.005, 12), 0.35, 0.86, 0.15, 0, 0, 0, 1, 1, 1, C(0x5a3a22)); P.add('cer', G.torus(0.025, 0.006, 5, 10), 0.39, 0.83, 0.15, 0, PI / 2, 0, 1, 1, 1, jit(0x3f7f6a));
  P.add('cer', G.box(0.22, 0.012, 0.16), -0.1, 0.79, -0.1, 0, 0.3, 0, 1, 1, 1, C(0xe8d8a0)); P.pop();
  // a chair at the desk (a scarf over its back)
  P.push(1.15, F, -0.62, PI); P.add('wood', G.box(0.42, 0.05, 0.4), 0, 0.46, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (const [sx, sz] of [[-0.17, -0.16], [0.17, -0.16], [-0.17, 0.16], [0.17, 0.16]]) P.add('wood', G.cyl(0.02, 0.024, 0.46, 6), sx, 0.23, sz, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); for (const sx of [-0.17, 0.17]) P.add('wood', G.cyl(0.02, 0.022, 0.5, 6), sx, 0.72, -0.18, -0.1, 0, 0, 1, 1, 1, jit(0x6a4a2a)); P.add('wood', G.box(0.36, 0.06, 0.02), 0, 0.92, -0.19); P.add('cloth', G.cloth(0.2, 0.55, 2, 0.02, 1), 0.05, 0.8, -0.21, 0, 0, 0, 1, 1, 1, C(0xb8342c)); P.pop();
  // ---- the cot along the left wall: a wooden frame, mattress, patchwork quilt, pillow, a folded blanket at the foot
  P.push(-1.55, F, -0.45, 0); P.add('wood', G.box(0.78, 0.08, 2.0), 0, 0.3, 0, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a)); for (const sx of [-0.35, 0.35]) for (const sz of [-0.95, 0.95]) P.add('wood', G.box(0.06, 0.3, 0.06), sx, 0.15, sz, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); P.add('wood', G.box(0.78, 0.35, 0.05), 0, 0.45, -0.98, 0, 0, 0, 1, 1, 1, jit(0x7a5a3a));
  P.add('cloth', puffyGeo(), 0, 0.41, 0, 0, 0, 0, 0.74, 0.14, 1.94, jit(0xe8dcc0)); const qc = [0xb84a3a, 0xe8c87a, 0x5a8a6a, 0x8aa8c8, 0xd8a0a0, 0x3f6b4a, 0xc0443a]; quiltHi(c, 0, 0.47, -0.05, 4, 7, 0.19, qc);
  P.add('cloth', puffyGeo(), 0, 0.55, -0.78, -0.18, 0.05, 0, 0.52, 0.15, 0.32, jit(0xf2ecdc)); for (let k = 0; k < 3; k++) P.add('cloth', puffyGeo(), 0.02, 0.52 + k * 0.035, 0.76, 0, 0.1 + 0.04 * k, 0, 0.56 - 0.02 * k, 0.04, 0.3, jit(k % 2 ? 0x5a7a8a : 0x4a6a7a)); P.pop();
  // ---- the small stove in the back corner (its flue goes up through the roof), a copper kettle on it, two mugs on a little shelf: one stained with tea, one never used
  P.push(-0.55, F, -1.27, 0); P.add('metal', G.box(0.5, 0.55, 0.45), 0, 0.28, 0, 0, 0, 0, 1, 1, 1, C(0x3a3836)); P.add('metal', G.box(0.54, 0.03, 0.49), 0, 0.565, 0, 0, 0, 0, 1, 1, 1, C(0x2a2826)); P.add('glow', G.box(0.2, 0.12, 0.01), 0, 0.26, 0.228, 0, 0, 0, 1, 1, 1, C(0xff8a40)); for (const sx of [-0.18, 0.18]) P.add('metal', G.cyl(0.02, 0.025, 0.06, 6), sx, 0.03, 0.15);
  P.add('metal', G.cyl(0.06, 0.06, I.h + 1.0, 10), -0.05, 0.58 + (I.h + 1.0) / 2, -0.05, 0, 0, 0, 1, 1, 1, C(0x4a4642));
  P.add('cop', G.lathe('kettle', [[0, 0], [0.1, 0], [0.12, 0.05], [0.11, 0.12], [0.06, 0.16], [0.03, 0.17]], 16), 0.1, 0.58, 0.05, 0, 0, 0, 1, 1, 1, C(0xd8905a)); P.rod('cop', G, v(0.2, 0.65, 0.05), v(0.29, 0.73, 0.05), 0.012, 6, C(0xd8905a)); P.add('cop', G.torus(0.07, 0.008, 5, 14, PI), 0.1, 0.74, 0.05, 0, 0, 0, 1, 1, 1, C(0x5a3a22));
  P.add('wood', G.box(0.42, 0.03, 0.18), 0.55, 1.25, -0.05, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); P.add('cer', G.cyl(0.04, 0.035, 0.09, 12), 0.45, 1.31, -0.05, 0, 0, 0, 1, 1, 1, C(0xa8402e)); P.add('dark', G.cyl(0.033, 0.033, 0.004, 12), 0.45, 1.34, -0.05, 0, 0, 0, 1, 1, 1, C(0x6a4428)); P.add('cer', G.torus(0.025, 0.006, 5, 10), 0.49, 1.31, -0.05, 0, PI / 2, 0, 1, 1, 1, C(0xa8402e));
  P.add('cer', G.cyl(0.04, 0.035, 0.09, 12), 0.64, 1.31, -0.05, 0, 0, 0, 1, 1, 1, C(0xf4f0e4)); P.add('cer', G.torus(0.025, 0.006, 5, 10), 0.68, 1.31, -0.05, 0, PI / 2, 0, 1, 1, 1, C(0xf4f0e4)); P.add('fruit', G.box(0.09, 0.02, 0.006), 0.64, 1.335, -0.008, 0, 0, 0.6, 1, 1, 1, C(0x5a8a6a)); P.add('fruit', G.box(0.09, 0.02, 0.006), 0.64, 1.335, -0.008, 0, 0, -0.6, 1, 1, 1, C(0x5a8a6a));
  P.add('wood', G.box(0.25, 0.4, 0.04), -0.42, 0.2, 0.1, 0, 0.3, 0.15, 1, 1, 1, jit(0x8a6a4a)); P.pop();
  // ---- by the door: hooks on the front wall with spare red scarves and a coil of rope (left); her pack and a pair of boots (right)
  P.push(-1.25, F, hd - 0.03, PI); P.add('wood', G.box(0.8, 0.06, 0.03), 0, 1.6, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); for (let k = 0; k < 4; k++) P.add('cop', G.cyl(0.008, 0.008, 0.07, 6), -0.3 + k * 0.2, 1.6, 0.04, PI / 2, 0, 0);
  for (let k = 0; k < 3; k++) P.add('cloth', G.cloth(0.17, 0.75, 2, 0.025, k + 2), -0.3 + k * 0.2, 1.22, 0.06, 0, 0, (k - 1) * 0.04, 1, 1, 1, jit([0xb8342c, 0xc0443a, 0xa83a32][k], 0.03));
  for (let k = 0; k < 6; k++) P.add('dark', G.torus(0.14, 0.018, 5, 18), 0.3, 1.42 - k * 0.012, 0.07, 0, 0, 0, 1, 1.25, 1, C(0xb89a6a)); P.pop();
  P.push(1.4, F, 1.25, PI + 0.25); P.add('cloth', G.box(0.38, 0.48, 0.24), 0, 0.26, 0, 0, 0, 0, 1, 1, 1, jit(0x4f7a4a, 0.05)); P.add('cloth', G.box(0.4, 0.14, 0.26), 0, 0.48, 0.02, 0.15, 0, 0, 1, 1, 1, jit(0x3f6a3a)); for (const sx of [-0.12, 0.12]) P.add('cloth', G.box(0.04, 0.42, 0.01), sx, 0.27, -0.125, 0, 0, 0, 1, 1, 1, C(0x6a4a2a)); P.add('cloth', G.box(0.26, 0.18, 0.06), 0, 0.2, 0.15, 0, 0, 0, 1, 1, 1, jit(0x4f7a4a)); P.add('cop', G.box(0.04, 0.04, 0.01), 0, 0.42, 0.155); P.pop();
  for (const sx of [-0.1, 0.1]) { P.add('cloth', G.box(0.11, 0.26, 0.13), 0.75 + sx, F + 0.13, 1.3, 0, 0.3, 0, 1, 1, 1, C(0x4a3626)); P.add('cloth', G.box(0.11, 0.06, 0.27), 0.75 + sx, F + 0.03, 1.36, 0, 0.3, 0, 1, 1, 1, C(0x3a2a1e)); }
  // ---- the shelf of carved figures on the right wall (a fox, a bird, a cat, little people, a tiny Gloom with a crack), over the crate of salvaged bits
  P.push(hw - 0.12, F, 0.45, -PI / 2); P.add('wood', G.box(0.95, 0.03, 0.2), 0, 1.45, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (const sx of [-0.4, 0.4]) P.add('cop', G.box(0.03, 0.12, 0.18), sx, 1.38, 0, 0, 0, 0, 1, 1, 1, C(0xffffff));
  for (let k = 0; k < H.figures; k++) { const x = -0.38 + k * (0.76 / Math.max(1, H.figures - 1)), y = 1.465, t = k % 4, wc = jit([0xc8a070, 0xa8804a, 0xd8b888, 0x8a6a3a][k % 4], 0.06); P.push(x, y, 0, (r() - 0.5) * 0.8);
    if (t === 0) { P.add('wood', G.sphere(0.035, 8, 6), 0, 0.035, 0, 0, 0, 0, 1.4, 1, 1, wc); P.add('wood', G.sphere(0.022, 8, 6), 0.045, 0.07, 0, 0, 0, 0, 1, 1, 1, wc); P.add('wood', G.cyl(0.004, 0.012, 0.035, 5), 0.05, 0.095, 0.01, 0, 0, 0, 1, 1, 1, wc); }
    else if (t === 1) { P.add('wood', G.sphere(0.03, 8, 6), 0, 0.04, 0, 0, 0, 0, 1, 1.2, 1, wc); P.add('wood', G.sphere(0.018, 8, 6), 0, 0.085, 0.01, 0, 0, 0, 1, 1, 1, wc); P.add('wood', G.cyl(0.001, 0.008, 0.02, 4), 0, 0.085, 0.03, PI / 2, 0, 0, 1, 1, 1, wc); }
    else if (t === 2) { P.add('wood', G.cyl(0.018, 0.026, 0.09, 8), 0, 0.045, 0, 0, 0, 0, 1, 1, 1, wc); P.add('wood', G.sphere(0.02, 8, 6), 0, 0.11, 0, 0, 0, 0, 1, 1, 1, wc); }
    else { P.add('wood', G.box(0.04, 0.06, 0.03), 0, 0.03, 0, 0, 0, 0, 1, 1, 1, wc); P.add('wood', G.box(0.045, 0.035, 0.03), 0, 0.08, 0, 0, 0, 0, 1, 1, 1, wc); P.add('cyan', G.box(0.03, 0.02, 0.002), 0, 0.08, 0.016, 0, 0, 0, 1, 1, 1, C(0xffffff)); }
    P.pop(); } P.pop();
  scrapCrate(c, 1.6, F, 0.75, PI / 2 + 0.1); P.add('dark', G.box(0.18, 0.12, 0.01), 1.55, F + 0.46, 0.7, -0.5, 0.4, 0.1, 1, 1, 1, C(0x1a2a28)); P.add('cyan', G.box(0.06, 0.012, 0.002), 1.55, F + 0.465, 0.705, -0.5, 0.4, 0.1, 1, 1, 1, C(0xffffff));
  // ---- plants: a big pot in the front left corner, a hanging planter from the beam, a rug
  bigPot(c, 1.65, 0.15, 0.55); hanger(c, -1.55, 0.3, I.h + 0.0, F + 1.95, H.plants); hanger(c, -1.55, -1.0, I.h + 0.4, F + 1.95, H.plants - 1); hanger(c, 0.95, 1.0, I.h + 0.3, F + 2.0, H.plants - 1);
  // ---- MORE (owner's review, Nov 17: her room was sparser than the home and the workshop)
  // a shelf over the cot: books, jars of tea and dried berries, a candle stub, a little pot of herbs; a child's drawing pinned under it (Pip's)
  P.push(-hw + 0.12, F, -0.5, PI / 2); P.add('wood', G.box(1.3, 0.03, 0.22), 0, 1.6, 0, 0, 0, 0, 1, 1, 1, jit(0x8a6a4a)); for (const sx of [-0.55, 0.55]) P.add('cop', G.box(0.03, 0.12, 0.2), sx, 1.53, 0); if (c.books) c.books(-0.6, 1.615, 0);
  for (let k = 0; k < 3; k++) jar(c, -0.15 + k * 0.13, 1.615, 0, 0.12 + 0.03 * k, [0x6a4a2a, 0xa83a2a, 0x3f6b4a][k], 0); P.add('cer', G.cyl(0.03, 0.03, 0.06, 10), 0.3, 1.645, 0, 0, 0, 0, 1, 1, 1, C(0xf2ecdc)); P.add('glow', G.sphere(0.012, 6, 4), 0.3, 1.69, 0, 0, 0, 0, 1, 1.6, 1, C(0xffd890));
  P.add('pot', G.lathe('spot', [[0, 0], [0.06, 0], [0.08, 0.12], [0.085, 0.13]], 10), 0.48, 1.615, 0); plantHi(c, 0.48, 1.74, 0, 0.18, 7, 1); trailHi(c, 0.52, 1.7, 0.06, 0.45);
  P.add('sketch', new THREE.PlaneGeometry(0.3, 0.38), 0.1, 1.2, 0.012, 0, 0, -0.06, 1, 1, 1, C(0xffffff)); P.add('fruit', G.sphere(0.012, 6, 4), 0.1, 1.38, 0.02, 0, 0, 0, 1, 1, 1, C(0xc83a2a)); P.pop();
  // herbs drying from the beam, warm solar bulbs strung under the front of the vault
  for (let k = 0; k < H.herbs; k++) { const x = -0.9 + k * (1.9 / Math.max(1, H.herbs - 1)), l = 0.18 + 0.1 * r(), hc = k % 3 ? 0x4a6a34 : 0x6a5a34; P.rod('dark', G, v(x, I.h - 0.02, 0.3), v(x, I.h - 0.16, 0.3), 0.004, 4, C(0xb89a6a)); P.add('leaf', G.cyl(0.035, 0.01, l, 6), x, I.h - 0.16 - l / 2, 0.3, 0, r() * 3, 0, 1, 1, 1, jit(hc, 0.08)); for (let j = 0; j < 5; j++) { P.push(x, I.h - 0.19, 0.3, j * 1.26 + r(), PI / 2 - 0.25 - 0.2 * r()); P.add('leaf', G.box(0.03, 0.004, l * 0.9), 0, 0, l * 0.45, 0, 0, 0, 1, 1, 1, jit(hc, 0.1)); P.pop(); } }
  { let prev = null; for (let k = 0; k <= H.bulbs; k++) { const t = k / H.bulbs, q = v(-hw + 0.05 + (2 * hw - 0.1) * t, I.h + 0.15 - 0.3 * 4 * t * (1 - t), 1.15); if (prev) P.rod('dark', G, prev, q, 0.004, 4); if (k > 0 && k < H.bulbs) P.add('glow', G.sphere(0.028, 8, 6), q.x, q.y - 0.05, q.z, 0, 0, 0, 1, 1, 1, C(0xffd890)); prev = q; } }
  // her green patrol coat on a peg by the desk, a satchel over it; a small round mirror and a lantern on a hook by the door
  P.push(hw - 0.03, F, -0.45, -PI / 2); P.add('wood', G.box(0.5, 0.06, 0.03), 0, 1.7, 0, 0, 0, 0, 1, 1, 1, jit(0x6a4a2a)); for (const x of [-0.15, 0.15]) P.add('cop', G.cyl(0.008, 0.008, 0.07, 6), x, 1.7, 0.04, PI / 2, 0, 0); P.add('cloth', G.cloth(0.42, 0.95, 3, 0.04, 4), -0.12, 1.22, 0.07, 0, 0, 0, 1, 1, 1, jit(0x3f6a42, 0.04)); P.add('cloth', G.box(0.06, 0.95, 0.02), -0.2, 1.2, 0.1, 0, 0, 0.12, 1, 1, 1, C(0xb8b8b0)); P.add('cloth', G.box(0.24, 0.18, 0.08), 0.17, 1.38, 0.08, 0, 0, 0.05, 1, 1, 1, jit(0x6a4a2a)); P.rod('cloth', G, v(0.15, 1.7, 0.06), v(0.1, 1.47, 0.08), 0.01, 4, C(0x5a3a22)); P.pop();
  P.push(0.95, F, hd - 0.03, PI); P.add('wood', G.torus(0.13, 0.025, 6, 20), 0, 1.08, 0.02, 0, 0, 0, 1, 1, 1, jit(0x8a6a3a)); P.add('glass', G.cyl(0.125, 0.125, 0.006, 20), 0, 1.08, 0.02, PI / 2, 0, 0, 1, 1, 1, C(0xe8f0f0)); P.pop();
  P.push(-0.92, F + 2.45, hd - 0.04, PI); P.add('cop', G.cyl(0.008, 0.008, 0.08, 6), 0, 0, 0.04, PI / 2, 0, 0); P.rod('dark', G, v(0, 0, 0.08), v(0, -0.12, 0.08), 0.004, 4); P.add('cop', G.cyl(0.03, 0.06, 0.04, 10), 0, -0.14, 0.08); P.add('glass', G.lathe('bud', [[0.0, 0], [0.06, 0.02], [0.085, 0.09], [0.07, 0.17], [0.03, 0.21], [0, 0.22]], 14), 0, -0.38, 0.08); P.add('glow', G.sphere(0.03, 10, 8), 0, -0.29, 0.08, 0, 0, 0, 1, 1, 1, C(0xffd890)); P.pop();
  // a chest at the foot of the cot (a folded blanket and her spare boots on it), a basket of firewood by the stove, a coil of rope by the pack, a stack of books by the desk, a sheepskin by the cot
  P.push(-1.55, F, 0.95, PI / 2); P.add('wood', G.box(0.62, 0.38, 0.4), 0, 0.19, 0, 0, 0, 0, 1, 1, 1, jit(0x7a4a2a)); P.add('cop', G.box(0.64, 0.03, 0.42), 0, 0.36, 0, 0, 0, 0, 1, 1, 1, C(0xffffff)); for (const sx of [-0.2, 0.2]) P.add('cop', G.box(0.03, 0.38, 0.42), sx, 0.19, 0); P.add('cloth', puffyGeo(), -0.08, 0.425, 0, 0, 0.1, 0, 0.42, 0.09, 0.31, jit(0xc0443a)); P.add('cloth', puffyGeo(), -0.06, 0.49, 0, 0, 0.15, 0, 0.38, 0.06, 0.28, jit(0xe8c87a)); P.pop();
  P.push(0.15, F, -1.3, 0.2); P.add('cloth', G.cyl(0.2, 0.17, 0.3, 14, true), 0, 0.15, 0, 0, 0, 0, 1, 1, 1, jit(0xa8804a)); P.add('cloth', G.torus(0.2, 0.015, 5, 16), 0, 0.3, 0, PI / 2, 0, 0, 1, 1, 1, jit(0x8a6a3a)); for (let k = 0; k < 7; k++) { const a = k * 0.9; P.add('wood', G.cyl(0.035, 0.04, 0.4, 7), Math.cos(a) * 0.09, 0.32, Math.sin(a) * 0.08, 0.15 * Math.sin(a), 0, 0.15 * Math.cos(a), 1, 1, 1, jit(0x8a6040, 0.12)); } P.pop();
  for (let k = 0; k < 7; k++) P.add('dark', G.torus(0.16, 0.022, 5, 18), 1.05, F + 0.025 + k * 0.03, 0.98, PI / 2, 0, 0, 1, 1, 1, C(0xb89a6a));
  for (let k = 0; k < 4; k++) P.add('cer', G.box(0.22, 0.04, 0.28), 0.4, F + 0.02 + k * 0.042, -0.95, 0, (r() - 0.5) * 0.4, 0, 1, 1, 1, jit([0x8a3a2e, 0x2f5d8a, 0x3f6b4a, 0xc9a227][k], 0.1));
  P.add('cloth', G.lump(5), -0.95, F + 0.01, -0.2, 0, 0.3, 0, 0.45, 0.04, 0.32, C(0xe8e0cc));
  // more on the map: arrows painted along the routes, more notes round its edge
  P.push(0.35, F + 1.72, -hd + 0.02, 0); for (const [x, y, a] of [[-0.45, 0.22, -0.5], [-0.1, -0.2, 0.3], [0.2, 0.18, 2.6], [0.38, -0.28, 1.9]]) { P.push(x, y, 0.03, 0, 0, a); P.add('fruit', G.box(0.12, 0.012, 0.003), 0, 0, 0, 0, 0, 0, 1, 1, 1, C(0xb8302a)); for (const s2 of [-1, 1]) P.add('fruit', G.box(0.04, 0.01, 0.003), 0.045, s2 * 0.01, 0, 0, 0, -s2 * 0.59, 1, 1, 1, C(0xb8302a)); P.pop(); }
  for (const [x, y, w2, h2] of [[-0.72, 0.38, 0.12, 0.1], [-0.7, -0.3, 0.13, 0.15], [0.05, 0.42, 0.15, 0.08], [-0.35, -0.44, 0.16, 0.08]]) P.add('cer', G.box(w2, h2, 0.004), x, y, 0.025, 0, 0, (r() - 0.5) * 0.25, 1, 1, 1, jit(0xf2ecdc, 0.05)); P.pop();
  // a small pot on the desk, a plant on the second window sill
  P.add('pot', G.lathe('spot', [[0, 0], [0.06, 0], [0.08, 0.12], [0.085, 0.13]], 10), 1.62, F + 0.785, -1.38); plantHi(c, 1.62, F + 0.91, -1.38, 0.16, 6, 1);
  P.add('pot', G.lathe('spot', [[0, 0], [0.06, 0], [0.08, 0.12], [0.085, 0.13]], 10), I.windows[1][0], I.windows[1][1] - I.windows[1][2] - 0.03, hd - 0.1); plantHi(c, I.windows[1][0], I.windows[1][1] - I.windows[1][2] + 0.09, hd - 0.1, 0.18, 7, 0); trailHi(c, I.windows[1][0] + 0.05, I.windows[1][1] - I.windows[1][2], hd - 0.06, 0.4);
  rug(c, 0.15, 0.25, 1.5, 1.05, [0x7f5a8a, 0xe8c87a, 0xb8584a, 0x3f7f6a, 0xe8c87a, 0x7f5a8a]);
  // a warm bulb over the room, hung from the beam
  workLight(c, 0.6, 0.3, I.h - 0.01, F + 2.05);
  doorLamp(c, I);
}
