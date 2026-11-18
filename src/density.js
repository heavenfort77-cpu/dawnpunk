// DENSITY pass (2026-11-16; owner: "the building, cars and gloom should have this sort of density", a QUALITY standard, nothing copied): shared parts for the desktop
// master builders of the street houses (src/househi.js), the abandoned cars (src/carhi.js) and the base buildings (src/basehi.js). High tier only; CONFIG.quality.high.density.
// What is here: the switch (densityOn), a weathering picture painted once (damp bands, drips, mould, patched render, soot, rust runs, spray marks, leaf litter, mud),
// number plates, hand-painted signs and stained glass pictures, a placer that stacks transforms, and small props built from a few shapes: bins, rubbish bags, pots,
// fences and gates, a mailbox, a satellite dish, a suitcase with spilled clothes, a tricycle, chairs, pallets, crates, a wheelbarrow, curtains, laundry, tools.
// Every prop is handed out as (surface key, geometry, matrix, tint): each builder turns keys into its own materials (houses: the world merge; cars: one mesh per surface; base: merged here).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { GLOOM_KINDS } from './gloomkit.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
export function rng(seed) { let q = (seed >>> 0) || 1; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; }

// the switch: CONFIG.quality.high.density.on; ?density=0 / ?density=1 in the address turns it off / on for one visit (before and after pictures)
export function densityOn() {
  const Q = CONFIG.quality.high.density; if (!Q) return null; let on = !!Q.on;
  try { const v = new URLSearchParams(location.search).get('density'); if (v === '0') on = false; if (v === '1') on = true; } catch (e) { on = !!Q.on; }
  return on ? Q : null;
}

// ---------------------------------------------------------------- pictures painted once per page
const pics = {};
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texOf(c, srgb) { const t = new THREE.CanvasTexture(c); if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// a soft blob of colour (radial fade)
function blob(x, cx, cy, r, col, a) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); }

// The weathering picture, 1024 x 1280, cut into named cells (ATLAS: [x, y, w, h] in pixels). Alpha is how strongly a mark covers the wall; colour is the mark's own colour.
export const ATLAS = { band: [0, 0, 1024, 256], streak: [0, 256, 256, 256], blot: [256, 256, 256, 256], patch: [512, 256, 256, 256], soot: [768, 256, 256, 256],
  rust: [0, 512, 256, 256], spray: [256, 512, 256, 256], tag: [512, 512, 256, 256], splash: [768, 512, 256, 256], litter: [0, 768, 256, 256], dirt: [256, 768, 256, 256],
  oil: [512, 768, 256, 256], ash: [768, 768, 256, 256], wash: [0, 1024, 1024, 256] };
export function weatherTex() {
  if (pics.weather) return pics.weather;
  const c = canvas(1024, 1280), x = c.getContext('2d'), r = rng(9127);
  // band: rising damp along the foot of a wall; dark and greenish at the bottom, a wavy tide line with a pale salt edge on top (repeats left to right)
  { const [X, Y, W, H] = ATLAS.band; const top = (u) => H * (0.28 + 0.1 * Math.sin(u / W * 2 * PI * 3) + 0.06 * Math.sin(u / W * 2 * PI * 7 + 1) + 0.03 * Math.sin(u / W * 2 * PI * 17));
    for (let u = 0; u < W; u += 2) { const t = top(u), g = x.createLinearGradient(0, Y + H, 0, Y + t); g.addColorStop(0, 'rgba(38,40,28,0.82)'); g.addColorStop(0.55, 'rgba(56,54,40,0.5)'); g.addColorStop(0.92, 'rgba(70,66,52,0.32)'); g.addColorStop(1, 'rgba(70,66,52,0.0)'); x.fillStyle = g; x.fillRect(X + u, Y + t, 2, H - t);
      x.fillStyle = 'rgba(60,56,44,0.12)'; x.fillRect(X + u, Y + t - 1, 2, 3); }
    for (let k = 0; k < 700; k++) { const u = r() * W, v = H - Math.pow(r(), 1.6) * (H - top(u)); blob(x, X + u, Y + v, 3 + r() * 12, r() < 0.5 ? '30,44,24' : '58,50,36', 0.25 + 0.3 * r()); } }
  // streak: rain drips running down from a sill or eave (narrow, uneven lines with heavier heads)
  { const [X, Y, W, H] = ATLAS.streak; for (let k = 0; k < 60; k++) { const u = W * (0.08 + 0.84 * r()), len = H * (0.3 + 0.7 * r()), w = 1.5 + r() * 4, g = x.createLinearGradient(0, Y, 0, Y + len); g.addColorStop(0, 'rgba(40,36,30,' + (0.35 + 0.35 * r()) + ')'); g.addColorStop(1, 'rgba(40,36,30,0)'); x.fillStyle = g; let px = u; for (let v = 0; v < len; v += 4) { px += (r() - 0.5) * 1.2; x.fillRect(X + px, Y + v, w, 4.5); } }
    blob(x, X + W / 2, Y + 10, W * 0.5, '46,40,32', 0.35); }
  // blot: damp and mould, a cloud of dark green-black spots round a wet heart
  { const [X, Y, W, H] = ATLAS.blot; blob(x, X + W / 2, Y + H * 0.55, W * 0.48, '48,52,36', 0.3); for (let k = 0; k < 40; k++) blob(x, X + W * (0.2 + 0.6 * r()), Y + H * (0.3 + 0.55 * r()), 14 + r() * 30, '40,46,32', 0.1 + 0.12 * r());
    for (let k = 0; k < 500; k++) { const a = r() * 2 * PI, d = Math.pow(r(), 0.6) * W * 0.42; blob(x, X + W / 2 + Math.cos(a) * d, Y + H * 0.55 + Math.abs(Math.sin(a)) * d * 0.8 * (r() < 0.75 ? 1 : -1), 1 + r() * 3, r() < 0.6 ? '22,30,20' : '60,58,40', 0.12 + 0.25 * r()); } }
  // patch: a later render repair, flat and paler, with a ragged edge and trowel arcs (it takes the wall's own colour through the tint)
  { const [X, Y, W, H] = ATLAS.patch; x.save(); x.beginPath(); for (let k = 0; k < 40; k++) { const a = k / 40 * 2 * PI, q = 0.38 + 0.08 * r(); x.lineTo(X + W / 2 + Math.cos(a) * W * q, Y + H / 2 + Math.sin(a) * H * q * 0.85); } x.closePath(); x.fillStyle = 'rgba(236,230,214,0.92)'; x.fill(); x.clip();
    for (let k = 0; k < 40; k++) { x.strokeStyle = 'rgba(180,172,154,' + (0.2 + 0.25 * r()) + ')'; x.lineWidth = 1 + r() * 2; x.beginPath(); x.arc(X + r() * W, Y + r() * H, 20 + r() * 60, r() * 6, r() * 6 + 1.2); x.stroke(); }
    for (let k = 0; k < 300; k++) blob(x, X + r() * W, Y + r() * H, 2 + r() * 6, '150,144,128', 0.2 * r()); x.restore();
    x.strokeStyle = 'rgba(60,54,46,0.5)'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k <= 40; k++) { const a = k / 40 * 2 * PI, q = 0.4 + 0.05 * Math.sin(k * 3); x.lineTo(X + W / 2 + Math.cos(a) * W * q, Y + H / 2 + Math.sin(a) * H * q * 0.85); } x.stroke(); }
  // soot: smoke from a window that burned, black at the bottom, rising and spreading
  { const [X, Y, W, H] = ATLAS.soot; for (let k = 0; k < 500; k++) { const v = Math.pow(r(), 0.8), spread = 0.15 + 0.35 * (1 - v); blob(x, X + W / 2 + (r() - 0.5) * 2 * W * spread, Y + H * v, 6 + 22 * (1 - v) * r(), '14,12,10', (0.08 + 0.2 * v) * (0.6 + 0.4 * r())); } }
  // rust: a rust run from an iron fixing (orange, narrowing downward)
  { const [X, Y, W, H] = ATLAS.rust; for (let k = 0; k < 14; k++) { const u = W / 2 + (r() - 0.5) * W * 0.3, len = H * (0.4 + 0.6 * r()), g = x.createLinearGradient(0, Y, 0, Y + len); g.addColorStop(0, 'rgba(120,58,22,0.75)'); g.addColorStop(1, 'rgba(120,70,30,0)'); x.fillStyle = g; let px = u; for (let v = 0; v < len; v += 3) { px += (r() - 0.5); x.fillRect(X + px, Y + v, 2 + 6 * (1 - v / len) * r(), 3.5); } }
    blob(x, X + W / 2, Y + 14, 34, '96,44,18', 0.6); }
  // spray: a search mark sprayed by whoever checked the house last (an X in a box with tallies), orange-red, overspray and runs
  { const [X, Y, W, H] = ATLAS.spray; x.lineCap = 'round'; const sp = (pts, w) => { for (let pass = 0; pass < 3; pass++) { x.strokeStyle = pass ? 'rgba(206,64,30,0.85)' : 'rgba(206,64,30,0.18)'; x.lineWidth = pass ? w : w * 3; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(X + p[0] + (r() - 0.5) * 3, Y + p[1] + (r() - 0.5) * 3) : x.moveTo(X + p[0], Y + p[1]))); x.stroke(); } };
    sp([[40, 40], [216, 216]], 9); sp([[216, 40], [40, 216]], 9); sp([[30, 30], [226, 30], [226, 226], [30, 226], [30, 30]], 6);
    for (let k = 0; k < 4; k++) sp([[70 + k * 14, 100], [70 + k * 14, 150]], 5); sp([[150, 92], [196, 92], [170, 128], [196, 160], [150, 160]], 5);
    for (let k = 0; k < 9; k++) { const u = 40 + r() * 180, v = 40 + r() * 170; x.fillStyle = 'rgba(206,64,30,0.6)'; x.fillRect(X + u, Y + v, 2.5, 12 + r() * 30); } }
  // tag: a sprayed loop (no words), black with a green outline
  { const [X, Y, W, H] = ATLAS.tag; x.lineCap = 'round'; for (const [col, w] of [['rgba(70,150,80,0.8)', 16], ['rgba(16,16,16,0.9)', 8]]) { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); for (let k = 0; k <= 60; k++) { const t = k / 60, a = t * 2 * PI * 2.2; x.lineTo(X + 30 + t * 196 + Math.cos(a) * 36, Y + H / 2 + Math.sin(a) * 52 * (1 - 0.4 * t)); } x.stroke(); } }
  // splash: mud splashed up from the ground (dots and a smear at the bottom)
  { const [X, Y, W, H] = ATLAS.splash; for (let k = 0; k < 500; k++) { const v = H - Math.pow(r(), 2.2) * H; blob(x, X + r() * W, Y + v, 1.5 + r() * 5 * (v / H), '74,60,42', 0.25 + 0.4 * r()); } }
  // litter: drifted dead leaves for the ground (brown, ochre, a few dark ones), dense in the middle
  { const [X, Y, W, H] = ATLAS.litter; for (let k = 0; k < 700; k++) { const a = r() * 2 * PI, d = Math.pow(r(), 0.6) * W * 0.46, cx = X + W / 2 + Math.cos(a) * d, cy = Y + H / 2 + Math.sin(a) * d, l = 5 + r() * 9, rot = r() * PI;
      const hue = r(); x.fillStyle = hue < 0.4 ? 'rgba(120,78,36,0.95)' : hue < 0.7 ? 'rgba(150,112,52,0.95)' : hue < 0.9 ? 'rgba(84,60,34,0.95)' : 'rgba(60,46,30,0.95)'; x.beginPath(); x.ellipse(cx, cy, l, l * 0.45, rot, 0, 2 * PI); x.fill();
      x.strokeStyle = 'rgba(40,28,16,0.5)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(cx - Math.cos(rot) * l, cy - Math.sin(rot) * l); x.lineTo(cx + Math.cos(rot) * l, cy + Math.sin(rot) * l); x.stroke(); } }
  // dirt: a soil spill (dark crumbs on a soft brown smear)
  { const [X, Y, W, H] = ATLAS.dirt; blob(x, X + W / 2, Y + H / 2, W * 0.42, '70,54,38', 0.8); for (let k = 0; k < 600; k++) { const a = r() * 2 * PI, d = Math.pow(r(), 0.5) * W * 0.45; blob(x, X + W / 2 + Math.cos(a) * d, Y + H / 2 + Math.sin(a) * d, 1 + r() * 3, r() < 0.5 ? '40,30,22' : '96,78,56', 0.6); } }
  // oil: a dark oil stain under a car, with a faint rainbow edge
  { const [X, Y, W, H] = ATLAS.oil; blob(x, X + W / 2, Y + H / 2, W * 0.45, '14,14,16', 0.85); blob(x, X + W * 0.55, Y + H * 0.45, W * 0.3, '30,26,40', 0.4); for (let k = 0; k < 120; k++) blob(x, X + W / 2 + (r() - 0.5) * W * 0.8, Y + H / 2 + (r() - 0.5) * H * 0.8, 3 + r() * 10, '10,10,10', 0.3); }
  // ash: pale grey ash and soot specks (burnt cars)
  { const [X, Y, W, H] = ATLAS.ash; blob(x, X + W / 2, Y + H / 2, W * 0.46, '150,146,138', 0.7); for (let k = 0; k < 700; k++) blob(x, X + r() * W, Y + r() * H, 1 + r() * 4, r() < 0.5 ? '20,18,16' : '190,186,178', 0.4 + 0.4 * r()); }
  // wash: weather over a whole wall, soft broad dirt, pale bleached patches and long rain streaks (repeats left to right; it is stretched up the wall)
  { const [X, Y, W, H] = ATLAS.wash; x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip(); const wb = (cx, cy, rad, col, a) => { for (const o of [-W, 0, W]) blob(x, X + cx + o, Y + cy, rad, col, a); };
    for (let k = 0; k < 140; k++) wb(r() * W, r() * H, 20 + r() * 70, '52,46,38', 0.06 + 0.1 * r()); for (let k = 0; k < 40; k++) wb(r() * W, r() * H, 30 + r() * 60, '230,226,214', 0.05 + 0.08 * r());
    for (let k = 0; k < 120; k++) { const u = r() * W, v0 = r() * H * 0.6, len = H * (0.2 + 0.6 * r()), w = 1 + r() * 3, g = x.createLinearGradient(0, Y + v0, 0, Y + v0 + len); g.addColorStop(0, 'rgba(44,40,34,' + (0.08 + 0.14 * r()) + ')'); g.addColorStop(1, 'rgba(44,40,34,0)'); x.fillStyle = g; x.fillRect(X + u, Y + v0, w, len); }
    for (let k = 0; k < 1500; k++) wb(r() * W, r() * H, 1 + r() * 2.5, r() < 0.5 ? '40,36,30' : '200,196,186', 0.1 + 0.15 * r()); x.restore(); }
  pics.weather = texOf(c); return pics.weather;
}
// uv corners of an atlas cell, inset by half a pixel
export function cellUV(name) { const [x, y, w, h] = ATLAS[name]; return [(x + 0.5) / 1024, 1 - (y + h - 0.5) / 1280, (x + w - 0.5) / 1024, 1 - (y + 0.5) / 1280]; }

// number plates: 8 plates in a 512 x 256 picture (2 across, 4 down), white or yellow, black letters, dirt along the bottom
export function plateTex() {
  if (pics.plate) return pics.plate;
  const c = canvas(512, 256), x = c.getContext('2d'), r = rng(4411), L = 'ABCDEFGHJKLMNPRSTUVWXYZ', D = '0123456789', ch = (s) => s[Math.floor(r() * s.length)];
  for (let k = 0; k < 8; k++) { const px = (k % 2) * 256, py = Math.floor(k / 2) * 64; x.fillStyle = k % 3 === 1 ? '#d8b830' : '#e2ded2'; x.fillRect(px + 2, py + 2, 252, 60); x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(px + 5, py + 5, 246, 54);
    x.fillStyle = '#1a1a1a'; x.font = 'bold 40px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch(L) + ch(L) + ch(D) + ch(D) + ' ' + ch(L) + ch(L) + ch(L), px + 128, py + 34);
    const g = x.createLinearGradient(0, py + 30, 0, py + 64); g.addColorStop(0, 'rgba(70,56,40,0)'); g.addColorStop(1, 'rgba(70,56,40,0.7)'); x.fillStyle = g; x.fillRect(px + 2, py + 2, 252, 60);
    for (let q = 0; q < 40; q++) blob(x, px + r() * 256, py + r() * 64, 2 + r() * 6, '90,60,30', 0.4 * r()); }
  pics.plate = texOf(c); return pics.plate;
}
export function plateUV(k) { const px = (k % 2) * 256, py = Math.floor(k / 2) * 64; return [(px + 2) / 512, 1 - (py + 62) / 256, (px + 254) / 512, 1 - (py + 2) / 256]; }

// a cracked windscreen: a stone strike with radial cracks and rings, white-ish lines on clear (alpha = the lines only)
export function crackTex() {
  if (pics.crack) return pics.crack;
  const c = canvas(512, 256), x = c.getContext('2d'), r = rng(2711), cx = 150 + r() * 200, cy = 80 + r() * 90; x.clearRect(0, 0, 512, 256); x.lineCap = 'round';
  blob(x, cx, cy, 16, '235,240,240', 0.9);
  for (let k = 0; k < 16; k++) { let a = k / 16 * 2 * PI + (r() - 0.5) * 0.3, px = cx, py = cy; const len = 60 + r() * 260; x.strokeStyle = 'rgba(230,236,236,' + (0.55 + 0.35 * r()) + ')'; x.lineWidth = 1 + r() * 1.5; x.beginPath(); x.moveTo(px, py);
    for (let t = 0; t < len; t += 12) { a += (r() - 0.5) * 0.35; px += Math.cos(a) * 12; py += Math.sin(a) * 12; x.lineTo(px, py); if (r() < 0.08) { x.moveTo(px, py); const b = a + (r() < 0.5 ? 0.7 : -0.7); x.lineTo(px + Math.cos(b) * 30, py + Math.sin(b) * 30); x.moveTo(px, py); } } x.stroke(); }
  for (const rad of [22, 40, 64]) { x.strokeStyle = 'rgba(230,236,236,0.45)'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * 2 * PI, q = rad * (0.8 + 0.4 * r()); x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.9); } x.stroke(); }
  pics.crack = texOf(c); return pics.crack;
}

// grime on car glass: clear at the top, a brownish dirt band rising from the bottom edge, rain runs and spots (alpha carries the dirt)
export function glassDirtTex() {
  if (pics.gdirt) return pics.gdirt;
  const c = canvas(256, 256), x = c.getContext('2d'), r = rng(6151); x.clearRect(0, 0, 256, 256);
  const g = x.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, 'rgba(96,84,66,0.85)'); g.addColorStop(0.25, 'rgba(110,98,78,0.45)'); g.addColorStop(0.55, 'rgba(120,110,92,0.12)'); g.addColorStop(1, 'rgba(120,110,92,0.04)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 40; k++) { const px = r() * 256, l = 30 + r() * 120, gg = x.createLinearGradient(0, 256 - l, 0, 256); gg.addColorStop(0, 'rgba(90,80,64,0)'); gg.addColorStop(1, 'rgba(90,80,64,0.35)'); x.fillStyle = gg; x.fillRect(px, 256 - l, 1.5 + r() * 2.5, l); }
  for (let k = 0; k < 400; k++) blob(x, r() * 256, r() * 256, 1 + r() * 3, '100,90,72', 0.1 + 0.25 * r());
  pics.gdirt = texOf(c); return pics.gdirt;
}

// a hand-drawn map of the valley for the base home's wall: parchment, fields and woods, a river, roads, the settlements ringed, routes inked in red
export function mapTex() {
  if (pics.map) return pics.map;
  const c = canvas(512, 384), x = c.getContext('2d'), r = rng(8123); x.fillStyle = '#e8dcb8'; x.fillRect(0, 0, 512, 384);
  for (let k = 0; k < 300; k++) blob(x, r() * 512, r() * 384, 4 + r() * 20, '170,140,90', 0.06 * r());
  for (let k = 0; k < 14; k++) blob(x, r() * 512, r() * 384, 30 + r() * 50, r() < 0.6 ? '110,150,80' : '150,170,90', 0.35);
  x.strokeStyle = 'rgba(60,110,170,0.85)'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(-10, 90); for (let k = 0; k <= 10; k++) x.lineTo(k * 54, 90 + Math.sin(k * 0.9) * 50 + k * 18); x.stroke();
  x.strokeStyle = 'rgba(90,70,50,0.8)'; x.lineWidth = 3; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(r() * 512, 0); x.bezierCurveTo(r() * 512, 130, r() * 512, 260, r() * 512, 384); x.stroke(); }
  for (let k = 0; k < 7; k++) { const px = 40 + r() * 430, py = 40 + r() * 300; x.fillStyle = 'rgba(80,60,40,0.9)'; for (let q = 0; q < 5; q++) x.fillRect(px + (r() - 0.5) * 24, py + (r() - 0.5) * 18, 5, 5); x.strokeStyle = 'rgba(190,40,30,0.85)'; x.lineWidth = 2.5; x.beginPath(); x.arc(px, py, 18, 0, 2 * PI); x.stroke(); }
  x.setLineDash([8, 6]); x.strokeStyle = 'rgba(190,40,30,0.8)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(256, 192); for (let k = 0; k < 4; k++) x.lineTo(40 + r() * 430, 40 + r() * 300); x.stroke(); x.setLineDash([]);
  x.fillStyle = 'rgba(40,110,80,0.95)'; x.beginPath(); x.arc(256, 192, 9, 0, 2 * PI); x.fill(); x.strokeStyle = 'rgba(60,40,20,0.7)'; x.lineWidth = 5; x.strokeRect(4, 4, 504, 376);
  pics.map = texOf(c); return pics.map;
}

// hand-painted signs for the base: cream ceramic board, hand-lettered word, a painted vine and flowers round it, slightly uneven strokes
export function signTex(word, seed) {
  const key = 'sign' + word; if (pics[key]) return pics[key];
  const c = canvas(512, 192), x = c.getContext('2d'), r = rng(seed || 77); x.fillStyle = '#efe6cf'; x.fillRect(0, 0, 512, 192);
  for (let k = 0; k < 400; k++) blob(x, r() * 512, r() * 192, 2 + r() * 10, '180,160,120', 0.08 * r());
  x.strokeStyle = '#4f8a5a'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); for (let k = 0; k <= 50; k++) { const t = k / 50; x.lineTo(14 + t * 484, 172 + Math.sin(t * 2 * PI * 3) * 8); } x.stroke();
  for (let k = 0; k < 14; k++) { const t = (k + 0.5) / 14, lx = 14 + t * 484, ly = 172 + Math.sin(t * 2 * PI * 3) * 8; x.fillStyle = k % 3 ? '#6aa86a' : '#3f7f5a'; x.beginPath(); x.ellipse(lx, ly - 10, 6, 13, (k % 2 ? 0.6 : -0.6), 0, 2 * PI); x.fill(); }
  for (let k = 0; k < 5; k++) { const fx = 40 + k * 108 + r() * 20, fy = 168; x.fillStyle = ['#e8a23a', '#d8577a', '#f0d050', '#7f8fd8', '#e8a23a'][k]; for (let p = 0; p < 5; p++) { const a = p / 5 * 2 * PI; x.beginPath(); x.ellipse(fx + Math.cos(a) * 7, fy + Math.sin(a) * 7, 6, 4, a, 0, 2 * PI); x.fill(); } x.fillStyle = '#7a4a1a'; x.beginPath(); x.arc(fx, fy, 3.5, 0, 2 * PI); x.fill(); }
  x.fillStyle = '#2f5d4a'; x.font = 'bold 84px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let off = -((word.length - 1) * 50) / 2; for (const chr of word) { x.save(); x.translate(256 + off, 88 + (r() - 0.5) * 6); x.rotate((r() - 0.5) * 0.08); x.fillText(chr, 0, 0); x.restore(); off += Math.min(56, 420 / Math.max(1, word.length)); }
  x.strokeStyle = 'rgba(60,80,60,0.6)'; x.lineWidth = 4; x.strokeRect(6, 6, 500, 180);
  pics[key] = texOf(c); return pics[key];
}

// stained glass for the round windows: a sun with leaf petals in lead lines (amber, leaf green, sky blue, cream); alpha a little below 1 so the glow behind shows through
export function stainedTex() {
  if (pics.stained) return pics.stained;
  const c = canvas(256, 256), x = c.getContext('2d'), r = rng(313), C = 128; x.clearRect(0, 0, 256, 256);
  const cols = ['rgba(230,170,60,0.82)', 'rgba(120,180,110,0.8)', 'rgba(110,170,210,0.78)', 'rgba(240,226,190,0.8)', 'rgba(80,140,90,0.82)'];
  x.save(); x.beginPath(); x.arc(C, C, 124, 0, 2 * PI); x.clip();
  for (let k = 0; k < 12; k++) { const a0 = k / 12 * 2 * PI, a1 = (k + 1) / 12 * 2 * PI; x.fillStyle = cols[2 + (k % 2)]; x.beginPath(); x.moveTo(C, C); x.arc(C, C, 124, a0, a1); x.closePath(); x.fill(); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 2 * PI; x.fillStyle = cols[k % 2 ? 1 : 4]; x.beginPath(); x.ellipse(C + Math.cos(a) * 66, C + Math.sin(a) * 66, 46, 20, a, 0, 2 * PI); x.fill(); }
  x.fillStyle = cols[0]; x.beginPath(); x.arc(C, C, 36, 0, 2 * PI); x.fill();
  for (let k = 0; k < 120; k++) blob(x, r() * 256, r() * 256, 4 + r() * 14, '255,255,255', 0.06 * r());
  x.strokeStyle = 'rgba(40,40,36,1)'; x.lineWidth = 4; x.beginPath(); x.arc(C, C, 36, 0, 2 * PI); x.stroke(); x.beginPath(); x.arc(C, C, 122, 0, 2 * PI); x.stroke();
  for (let k = 0; k < 8; k++) { const a = k / 8 * 2 * PI; x.beginPath(); x.ellipse(C + Math.cos(a) * 66, C + Math.sin(a) * 66, 46, 20, a, 0, 2 * PI); x.stroke(); }
  for (let k = 0; k < 12; k++) { const a = k / 12 * 2 * PI; x.beginPath(); x.moveTo(C + Math.cos(a) * 36, C + Math.sin(a) * 36); x.lineTo(C + Math.cos(a) * 122, C + Math.sin(a) * 122); x.stroke(); }
  x.restore(); pics.stained = texOf(c); return pics.stained;
}

// ---------------------------------------------------------------- placing: a stack of transforms; add() hands (key, geometry, matrix, tint) to the builder's emit
const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class Placer {
  constructor(emit) { this.emit = emit; this.st = [new THREE.Matrix4()]; }
  top() { return this.st[this.st.length - 1]; }
  // a frame at (x, y, z) turned ry about up, then rx, then rz, scaled s
  push(x, y, z, ry, rx, rz, s) { const m = new THREE.Matrix4().compose(_p.set(x || 0, y || 0, z || 0), _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0, 'YXZ')), _s.set(s || 1, s || 1, s || 1)); this.st.push(this.top().clone().multiply(m)); return this; }
  pushM(m) { this.st.push(this.top().clone().multiply(m)); return this; }
  pop() { if (this.st.length > 1) this.st.pop(); return this; }
  add(key, geo, x, y, z, rx, ry, rz, sx, sy, sz, tint) { const m = new THREE.Matrix4().compose(_p.set(x || 0, y || 0, z || 0), _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0, 'YXZ')), _s.set(sx || 1, sy || sx || 1, sz || sx || 1)); m.premultiply(this.top()); this.emit(key, geo, m, tint || null); }
  // a box from p to q (world-of-the-frame points), w wide, h tall, up = +y unless the run is vertical
  beam(key, G, p, q, w, h, tint) { const d = q.clone().sub(p), len = d.length(); if (len < 1e-4) return; const z = d.clone().normalize(), up = Math.abs(z.y) > 0.95 ? V(1, 0, 0) : V(0, 1, 0), xa = new THREE.Vector3().crossVectors(up, z).normalize(), ya = new THREE.Vector3().crossVectors(z, xa);
    const m = new THREE.Matrix4().makeBasis(xa, ya, z); m.setPosition(p.clone().add(q).multiplyScalar(0.5)); m.premultiply(this.top()); this.emit(key, G.box(w, h, len), m, tint || null); }
  rod(key, G, p, q, rad, n, tint) { const d = q.clone().sub(p), len = d.length(); if (len < 1e-4) return; const m = new THREE.Matrix4().compose(p.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)); m.premultiply(this.top()); this.emit(key, G.cyl(rad, rad, len, n || 6), m, tint || null); }
}

// ---------------------------------------------------------------- shapes, made once per size (uv in metres so textures keep their scale)
export function shapes() {
  const c = new Map(), k = (a) => a.map((v) => (typeof v === 'number' ? Math.round(v * 1000) : v)).join(':'), get = (key, make) => { let g = c.get(key); if (!g) { g = make(); c.set(key, g); } return g; };
  const G = {
    box: (w, h, d, tile) => get(k(['b', w, h, d, tile || 1]), () => { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, t = 1 / (tile || 1); for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4), [a, b] = f < 2 ? [d, h] : f < 4 ? [w, d] : [w, h]; uv.setXY(i, uv.getX(i) * a * t, uv.getY(i) * b * t); } return g; }),
    cyl: (rt, rb, h, n, open) => get(k(['c', rt, rb, h, n || 8, open ? 1 : 0]), () => { const g = new THREE.CylinderGeometry(rt, rb, h, n || 8, 1, !!open), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * PI * Math.max(rt, rb), uv.getY(i) * h); return g; }),
    sphere: (rad, w, h) => get(k(['s', rad, w || 10, h || 7]), () => new THREE.SphereGeometry(rad, w || 10, h || 7)),
    torus: (R, t, rs, ts, arc) => get(k(['t', R, t, rs, ts, arc || 2 * PI]), () => new THREE.TorusGeometry(R, t, rs, ts, arc || 2 * PI)),
    lathe: (name, pts, n) => get('l' + name + n, () => { const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), n); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 1.5); return g; }),
    // a lumpy heap (rubbish bag, soil pile, leaf drift): a squashed sphere with its own bumps
    lump: (seed) => get('lump' + (seed % 8), () => { const g = new THREE.SphereGeometry(1, 12, 8), P = g.attributes.position, rr = rng(1000 + (seed % 8)); const ph = [rr() * 6, rr() * 6, rr() * 6];
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), f = 1 + 0.16 * Math.sin(x * 3 + ph[0]) * Math.sin(z * 4 + ph[1]) + 0.1 * Math.sin(y * 5 + ph[2]); P.setXYZ(i, x * f, Math.max(-0.15, y) * f, z * f); } g.computeVertexNormals(); return g; }),
    // cloth: a plane w x h with folds (n folds across, depth dp), hanging from its top edge; tear: share of the lower edge torn ragged
    cloth: (w, h, n, dp, seed) => get(k(['f', w, h, n, dp, seed % 6]), () => { const g = new THREE.PlaneGeometry(w, h, Math.max(4, n * 4), 6), P = g.attributes.position, rr = rng(77 + (seed % 6));
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), t = (h / 2 - y) / h; P.setXYZ(i, x, y - (y < -h * 0.4 ? rr() * 0.12 * h : 0), Math.sin((x / w + 0.5) * n * 2 * PI) * dp * (0.6 + 0.4 * t)); } g.computeVertexNormals(); return g; }),
    // a crumpled cloth or paper lying on the ground (a few hundred mm across)
    crumple: (seed) => get('cr' + (seed % 6), () => { const g = new THREE.PlaneGeometry(1, 1, 6, 6), P = g.attributes.position, rr = rng(500 + (seed % 6)); for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), e = Math.max(Math.abs(x), Math.abs(y)); P.setXYZ(i, x * (0.8 + 0.3 * rr()), y * (0.8 + 0.3 * rr()), (1 - e * 1.6) * 0.18 * rr() + 0.02); } g.rotateX(-PI / 2); g.computeVertexNormals(); return g; }),
    // a decal quad 1 x 1 (x across, y up, facing +z) whose uvs cover one atlas cell
    decal: (cell) => get('d' + cell, () => { const g = new THREE.PlaneGeometry(1, 1), [u0, v0, u1, v1] = cellUV(cell), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0); return g; }),
    floorDecal: (cell) => get('fd' + cell, () => { const g = G.decal(cell).clone(); g.rotateX(-PI / 2); return g; })
  };
  return G;
}

// ---------------------------------------------------------------- props (origin on the ground at the prop's foot, +z its front). Keys: wood, paint (painted wood), plastic, metal, cloth, paper, soil, pot, stone, rubber, glass, decal, dark
export const PROPS = {
  // a wheelie bin: tapered body, rim, hinged lid (open, shut or gone), two wheels on an axle, a handle; tipped: lying on its side with the lid open
  bin(P, G, r, col, tipped) {
    if (tipped) P.push(0, 0.29, 0, 0, 0, PI / 2 * (r() < 0.5 ? 1 : -1)); else P.push(0, 0, 0);
    P.add('plastic', G.box(0.56, 0.95, 0.62), 0, 0.05 + 0.475, 0, 0, 0, 0, 1, 1, 1, col); P.add('plastic', G.box(0.62, 0.06, 0.7), 0, 1.0, 0, 0, 0, 0, 1, 1, 1, col);
    const lid = r(); if (lid < 0.75) { const a = tipped ? 1.2 + r() : lid < 0.4 ? 0 : 0.6 + 1.8 * r(); P.push(0, 1.04, -0.36, 0, -a); P.add('plastic', G.box(0.64, 0.05, 0.74), 0, 0.02, 0.37, 0, 0, 0, 1, 1, 1, col); P.pop(); }
    P.rod('rubber', G, V(-0.32, 0.12, -0.33), V(0.32, 0.12, -0.33), 0.012, 6); for (const sx of [-1, 1]) P.add('rubber', G.cyl(0.11, 0.11, 0.05, 12), sx * 0.3, 0.12, -0.33, 0, 0, PI / 2);
    P.add('plastic', G.box(0.5, 0.04, 0.05), 0, 1.02, -0.4, 0, 0, 0, 1, 1, 1, col); P.pop();
  },
  // a rubbish bag: a lumpy sack with a knotted neck
  bag(P, G, r, col, s) { const sc = (s || 1) * (0.25 + 0.12 * r()); P.add('plastic', G.lump(Math.floor(r() * 8)), 0, sc * 0.8, 0, 0, r() * 6, 0, sc * 1.1, sc * 0.9, sc, col); P.add('plastic', G.cyl(0.02, 0.05, 0.12, 6), 0.05, sc * 1.6, 0, 0.5, 0, 0.4, 1, 1, 1, col); },
  // a flower pot: upright with soil, on its side, or broken in pieces with the soil spilled
  pot(P, G, r, state, s, tint) { const sc = s || (0.7 + 0.6 * r()), pts = [[0, 0], [0.11, 0], [0.15, 0.24], [0.17, 0.25], [0.17, 0.29], [0.15, 0.29]];
    if (state === 'up') { P.add('pot', G.lathe('pot', pts, 14), 0, 0, 0, 0, 0, 0, sc, sc, sc, tint); P.add('soil', G.cyl(0.14, 0.14, 0.02, 12), 0, 0.26 * sc, 0, 0, 0, 0, sc, 1, sc); }
    else if (state === 'side') { P.add('pot', G.lathe('pot', pts, 14), 0, 0.15 * sc, 0, PI / 2 - 0.1, 0, 0, sc, sc, sc, tint); P.add('soil', G.lump(3), 0, 0.02, 0.33 * sc, 0, 0, 0, 0.22 * sc, 0.06, 0.18 * sc); }
    else { for (let k = 0; k < 4; k++) { const a = k * 1.7 + r(), q = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), 4, a, 1.3 + 0.4 * r()); P.add('pot', q, Math.cos(a) * 0.15 * sc, 0.02, Math.sin(a) * 0.15 * sc, PI / 2 * r(), r() * 6, PI / 2, sc, sc, sc, tint); }
      P.add('soil', G.lump(5), 0, 0.01, 0, 0, 0, 0, 0.3 * sc, 0.07, 0.24 * sc); P.add('decal', G.floorDecal('dirt'), 0, 0.012, 0, 0, r() * 6, 0, 0.9 * sc, 1, 0.9 * sc); } },
  // a picket fence run along x from x0 to x1 at height h: posts, two rails, pickets; gone = share of pickets missing, lean = tilt of the whole run, fallen = lying flat
  fence(P, G, r, x0, x1, h, gone, lean, col) { const len = x1 - x0; if (len < 0.3) return; P.push((x0 + x1) / 2, 0, 0, 0, lean, 0);
    for (let x = -len / 2; x <= len / 2 + 0.01; x += Math.min(1.8, len)) P.add('paint', G.box(0.08, h + 0.12, 0.08), x, (h + 0.12) / 2 - 0.06, 0, 0, 0, (r() - 0.5) * 0.06, 1, 1, 1, col);
    for (const y of [h * 0.28, h * 0.78]) if (r() > 0.15) P.add('paint', G.box(len, 0.07, 0.025), 0, y, -0.05, 0, 0, (r() - 0.5) * 0.03, 1, 1, 1, col);
    for (let x = -len / 2 + 0.08; x < len / 2 - 0.04; x += 0.13) { if (r() < gone) { if (r() < 0.35) P.add('paint', G.box(0.075, h, 0.018), x + 0.1, 0.02, 0.1 + 0.4 * r(), PI / 2, r() * 3, 0, 1, 1, 1, col); continue; } const ph = h * (0.85 + 0.15 * r()), tl = (r() - 0.5) * (r() < 0.15 ? 0.5 : 0.05);
      P.add('paint', G.box(0.075, ph, 0.018), x, ph / 2, -0.075, 0, 0, tl, 1, 1, 1, col); P.add('paint', G.cyl(0.0, 0.053, 0.06, 4), x, ph + 0.03, -0.075, 0, PI / 4, tl, 1, 1, 0.35, col); }
    P.pop(); },
  // a garden gate (frame, pickets, a brace) swung open by `open`, or hanging off its lower hinge
  gate(P, G, r, w, h, open, hang, col) { P.push(0, 0, 0, open, 0, hang ? -0.35 : 0); for (const x of [0.04, w - 0.04]) P.add('paint', G.box(0.06, h, 0.04), x, h / 2 + 0.05, 0, 0, 0, 0, 1, 1, 1, col);
    for (const y of [0.2, h - 0.1]) P.add('paint', G.box(w, 0.06, 0.04), w / 2, y + 0.05, 0, 0, 0, 0, 1, 1, 1, col); P.beam('paint', G, V(0.06, 0.25, 0.01), V(w - 0.06, h - 0.05, 0.01), 0.05, 0.03, col);
    for (let x = 0.15; x < w - 0.1; x += 0.13) P.add('paint', G.box(0.07, h - 0.1, 0.016), x, h / 2 + 0.05, -0.03, 0, 0, 0, 1, 1, 1, col); P.add('metal', G.box(0.18, 0.03, 0.05), w - 0.02, h * 0.6, 0.0); P.pop(); },
  // a mailbox on a post: a box with a round top, its door hanging open, the flag up; letters fallen out below
  mailbox(P, G, r, col) { P.add('wood', G.box(0.09, 1.15, 0.09), 0, 0.575, 0, 0, 0, (r() - 0.5) * 0.12); P.push(0, 1.15, 0, 0, 0, (r() - 0.5) * 0.12);
    P.add('metal', G.box(0.22, 0.18, 0.46), 0, 0.09, 0, 0, 0, 0, 1, 1, 1, col); P.add('metal', G.cyl(0.11, 0.11, 0.46, 12, true), 0, 0.18, 0, PI / 2, 0, 0, 1, 1, 1, col);
    P.push(0, 0.02, 0.23, 0, 1.2 + 0.5 * r()); P.add('metal', G.box(0.22, 0.26, 0.012), 0, 0.13, 0, 0, 0, 0, 1, 1, 1, col); P.pop(); P.add('metal', G.box(0.012, 0.16, 0.05), 0.12, 0.28, -0.12, 0, 0, 0, 1, 1, 1, new THREE.Color(0.7, 0.12, 0.08)); P.pop();
    for (let k = 0; k < 3 + Math.floor(r() * 4); k++) P.add('paper', G.box(0.22, 0.004, 0.11), (r() - 0.5) * 0.9, 0.006 + k * 0.002, 0.2 + r() * 0.7, (r() - 0.5) * 0.15, r() * 6, 0, 1, 1, 1, new THREE.Color().setHSL(0.1, 0.1 * r(), 0.7 + 0.2 * r())); },
  // a satellite dish on a wall bracket (dish, feed arm, LNB), facing out and up; the cable hangs from it
  dish(P, G, r) { P.add('metal', G.box(0.05, 0.3, 0.02), 0, 0, 0.01); P.rod('metal', G, V(0, 0, 0.02), V(0, 0, 0.32), 0.018, 6); P.push(0, 0, 0.36, (r() - 0.5) * 0.8, -0.35);
    P.add('plastic', G.lathe('dish', [[0, -0.05], [0.12, -0.04], [0.28, 0], [0.3, 0.012]], 18), 0, 0, 0, PI / 2, 0, 0, 1, 1, 1, new THREE.Color(0.78, 0.78, 0.74)); P.rod('metal', G, V(0, -0.24, 0.02), V(0, -0.02, 0.42), 0.01, 5); P.add('plastic', G.box(0.05, 0.05, 0.1), 0, -0.02, 0.44, 0, 0, 0, 1, 1, 1, new THREE.Color(0.2, 0.2, 0.2)); P.pop(); },
  // an open suitcase with clothes half out (the case, its lid flat back, folded clothes, two lying out)
  suitcase(P, G, r, col) { P.add('cloth', G.box(0.7, 0.12, 0.46), 0, 0.06, 0, 0, 0, 0, 1, 1, 1, col); P.add('cloth', G.box(0.7, 0.06, 0.46), 0, 0.03, -0.47, 0.06, 0, 0, 1, 1, 1, col); P.add('metal', G.box(0.2, 0.03, 0.04), 0, 0.14, 0.24, 0, 0, 0, 1, 1, 1, new THREE.Color(0.2, 0.2, 0.2));
    for (let k = 0; k < 3; k++) P.add('cloth', G.box(0.3, 0.04, 0.2), (k - 1) * 0.2, 0.13, (r() - 0.5) * 0.1, 0, r() * 0.4, 0, 1, 1, 1, new THREE.Color().setHSL(r(), 0.3, 0.35 + 0.3 * r()));
    for (let k = 0; k < 2; k++) P.add('cloth', G.crumple(Math.floor(r() * 6)), 0.5 + r() * 0.6, 0, (r() - 0.5) * 1.0, 0, r() * 6, 0, 0.5, 1, 0.4, new THREE.Color().setHSL(r(), 0.35, 0.3 + 0.3 * r())); },
  // a child's tricycle lying on its side (frame, three wheels, seat, bars)
  trike(P, G, r, col) { P.push(0, 0.16, 0, 0, 0, PI / 2 - 0.15); P.add('rubber', G.torus(0.2, 0.025, 6, 16), 0.38, 0.2, 0, 0, PI / 2, 0); for (const z of [-0.2, 0.2]) P.add('rubber', G.torus(0.13, 0.022, 6, 14), -0.25, 0.13, z, 0, PI / 2, 0);
    P.rod('metal', G, V(0.38, 0.2, 0), V(-0.25, 0.3, 0), 0.02, 6, col); P.rod('metal', G, V(0.38, 0.2, 0), V(0.3, 0.62, 0), 0.02, 6, col); P.rod('metal', G, V(0.25, 0.62, -0.2), V(0.25, 0.62, 0.2), 0.015, 6, col); P.rod('metal', G, V(-0.25, 0.13, -0.2), V(-0.25, 0.13, 0.2), 0.012, 6);
    P.add('plastic', G.box(0.2, 0.05, 0.18), -0.05, 0.36, 0, 0, 0, 0, 1, 1, 1, new THREE.Color(0.1, 0.1, 0.1)); P.pop(); },
  // a garden chair: plastic or wood; broken: on its back with a leg missing
  chair(P, G, r, col, broken) { if (broken) P.push(0, 0.42, 0, 0, -PI / 2 + 0.1, 0); else P.push(0, 0, 0);
    P.add('plastic', G.box(0.46, 0.04, 0.44), 0, 0.44, 0, 0, 0, 0, 1, 1, 1, col); P.add('plastic', G.box(0.46, 0.46, 0.04), 0, 0.68, -0.22, -0.12, 0, 0, 1, 1, 1, col);
    for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) { if (broken && x > 0 && z > 0) continue; P.add('plastic', G.box(0.04, 0.44, 0.04), x, 0.22, z, 0, 0, 0, 1, 1, 1, col); } P.pop(); },
  // a wooden pallet (three runners, top boards with gaps)
  pallet(P, G, r) { for (const z of [-0.5, 0, 0.5]) P.add('wood', G.box(1.2, 0.1, 0.1), 0, 0.05, z, 0, 0, 0, 1, 1, 1, new THREE.Color().setHSL(0.08, 0.2, 0.45 + 0.15 * r())); for (let x = -0.55; x <= 0.56; x += 0.14) if (r() > 0.1) P.add('wood', G.box(0.1, 0.02, 1.2), x, 0.11, 0, 0, 0, 0, 1, 1, 1, new THREE.Color().setHSL(0.08, 0.2, 0.42 + 0.18 * r())); },
  // a slatted crate (open top), empty or with something in it
  crate(P, G, r, s, col) { const w = 0.5 * (s || 1), h = 0.32 * (s || 1), d = 0.36 * (s || 1);
    for (const sz of [-1, 1]) for (let y = 0; y < 3; y++) P.add('wood', G.box(w, h * 0.22, 0.015), 0, h * (0.14 + 0.33 * y), sz * d / 2, 0, 0, 0, 1, 1, 1, col);
    for (const sx of [-1, 1]) for (let y = 0; y < 3; y++) P.add('wood', G.box(0.015, h * 0.22, d), sx * w / 2, h * (0.14 + 0.33 * y), 0, 0, 0, 0, 1, 1, 1, col);
    P.add('wood', G.box(w, 0.015, d), 0, 0.01, 0, 0, 0, 0, 1, 1, 1, col); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('wood', G.box(0.03, h, 0.03), sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02), 0, 0, 0, 1, 1, 1, col); },
  // a wheelbarrow, tipped forward on its wheel or upside down
  barrow(P, G, r, col, flip) { if (flip) P.push(0, 0.42, 0, 0, 0, PI); else P.push(0, 0, 0);
    P.add('metal', G.lathe('tray', [[0, 0], [0.3, 0.02], [0.36, 0.22], [0.37, 0.24]], 14), 0.1, 0.32, 0, 0, 0, 0, 1.3, 1, 1, col); P.add('rubber', G.torus(0.17, 0.05, 6, 16), 0.62, 0.17, 0, 0, 0, 0);
    for (const z of [-0.2, 0.2]) { P.rod('metal', G, V(0.62, 0.17, z * 0.4), V(-0.75, 0.6, z * 1.3), 0.015, 6); P.rod('metal', G, V(-0.2, 0.3, z), V(-0.25, 0, z), 0.014, 5); } P.pop(); },
  // a curtain panel hanging from a rod (w wide, h long), gathered; half: the rod end has dropped so it hangs diagonally
  curtain(P, G, r, w, h, col, half) { P.push(0, 0, 0, 0, 0, half ? (r() < 0.5 ? 0.25 : -0.25) : 0); P.add('cloth', G.cloth(w, h, 3, 0.04, Math.floor(r() * 6)), 0, -h / 2, 0, 0, 0, 0, 1, 1, 1, col); P.pop(); },
  // a tool leaning on a wall: spade, rake or fork (wooden handle, steel head), lean angle a
  tool(P, G, r, kind, a) { P.push(0, 0, 0, 0, a, 0); P.add('wood', G.cyl(0.016, 0.016, 1.3, 6), 0, 0.75, 0); P.add('wood', G.box(0.12, 0.03, 0.03), 0, 1.42, 0);
    if (kind === 0) P.add('metal', G.box(0.2, 0.26, 0.012), 0, 0.12, 0); else if (kind === 1) { P.add('metal', G.box(0.36, 0.025, 0.03), 0, 0.1, 0); for (let k = 0; k < 9; k++) P.add('metal', G.box(0.008, 0.07, 0.008), -0.16 + k * 0.04, 0.06, 0.01); }
    else { P.add('metal', G.box(0.18, 0.02, 0.02), 0, 0.3, 0); for (let k = 0; k < 4; k++) P.add('metal', G.box(0.01, 0.26, 0.01), -0.07 + k * 0.047, 0.16, 0); } P.pop(); },
  // a washing line between two points with pegged laundry (cols: the cloth colours); the line sags in the middle
  laundry(P, G, r, a, b, cols, n) { const sag = 0.18, pt = (t) => a.clone().lerp(b, t).add(V(0, -sag * 4 * t * (1 - t), 0)); let prev = pt(0); for (let k = 1; k <= 8; k++) { const q = pt(k / 8); P.rod('dark', G, prev, q, 0.004, 4); prev = q; }
    const dir = b.clone().sub(a).setY(0), ry = Math.atan2(-dir.z, dir.x); for (let k = 0; k < n; k++) { const t = (k + 0.7) / (n + 0.4), q = pt(t), w = 0.3 + 0.35 * r(), hh = 0.35 + 0.4 * r(); P.push(q.x, q.y, q.z, ry); P.add('cloth', G.cloth(w, hh, 2, 0.02, k), 0, -hh / 2, 0, 0, 0, 0, 1, 1, 1, cols[k % cols.length]); P.add('wood', G.box(0.012, 0.06, 0.02), -w * 0.35, 0.01, 0.01); P.add('wood', G.box(0.012, 0.06, 0.02), w * 0.35, 0.01, 0.01); P.pop(); } },
  // a dumped fridge or washing machine (white enamel gone grey, door hanging open, rust round the base)
  whitegood(P, G, r, fridge, col) { const w = 0.6, d = 0.6, h = fridge ? 1.45 : 0.85; P.add('metal', G.box(w, h, d), 0, h / 2, 0, 0, 0, 0, 1, 1, 1, col); P.add('dark', G.box(w - 0.08, h - 0.1, 0.01), 0, h / 2, d / 2 + 0.002);
    P.push(-w / 2, 0, d / 2, -(0.8 + 1.2 * r())); if (fridge) P.add('metal', G.box(w, h - 0.04, 0.06), w / 2, h / 2, 0.03, 0, 0, 0, 1, 1, 1, col); else P.add('glass', G.cyl(0.2, 0.2, 0.04, 16), w / 2, h * 0.55, 0.02, PI / 2, 0, 0); P.pop();
    P.add('decal', G.decal('rust'), 0, 0.2, d / 2 + 0.004, 0, 0, 0, w * 0.9, 0.4, 1); },
  // an armchair left outside: seat, back, arms, cushions sagging, one cushion fallen
  armchair(P, G, r, col) { P.add('cloth', G.box(0.8, 0.3, 0.75), 0, 0.25, 0, 0, 0, 0, 1, 1, 1, col); P.add('cloth', G.box(0.8, 0.55, 0.18), 0, 0.62, -0.3, -0.12, 0, 0, 1, 1, 1, col); for (const sx of [-1, 1]) P.add('cloth', G.box(0.16, 0.25, 0.75), sx * 0.4, 0.52, 0, 0, 0, sx * 0.05, 1, 1, 1, col);
    P.add('cloth', G.box(0.6, 0.1, 0.55), 0.05, 0.43, 0.05, 0.08, 0.1, 0.05, 1, 1, 1, col.clone().multiplyScalar(0.9)); P.add('cloth', G.box(0.55, 0.12, 0.5), 0.6, 0.06, 0.55, 0, 0.7, 0.1, 1, 1, 1, col.clone().multiplyScalar(0.85)); },
  // a stack of old tyres (one rolled away)
  tyres(P, G, r, n) { for (let k = 0; k < n; k++) P.add('rubber', G.torus(0.3, 0.1, 8, 18), (r() - 0.5) * 0.06, 0.1 + k * 0.19, (r() - 0.5) * 0.06, PI / 2, 0, (r() - 0.5) * 0.06); P.add('rubber', G.torus(0.3, 0.1, 8, 18), 0.9, 0.35, 0.3, 0.1, 0.6, 0); },
  // a bench: two legs, a seat of three slats, a back of two
  bench(P, G, r, w, col) { for (const sx of [-1, 1]) { P.add('wood', G.box(0.06, 0.44, 0.4), sx * (w / 2 - 0.1), 0.22, 0, 0, 0, 0, 1, 1, 1, col); P.add('wood', G.box(0.05, 0.5, 0.05), sx * (w / 2 - 0.1), 0.7, -0.2, -0.15, 0, 0, 1, 1, 1, col); }
    for (let k = 0; k < 3; k++) P.add('wood', G.box(w, 0.035, 0.12), 0, 0.455, -0.13 + k * 0.13, 0, 0, 0, 1, 1, 1, col); for (const y of [0.62, 0.82]) P.add('wood', G.box(w, 0.1, 0.03), 0, y, -0.22 - (y - 0.45) * 0.15, -0.15, 0, 0, 1, 1, 1, col); },
  // a bicycle, lying on its side (lie) or leaning (a lean angle about its long axis): two spoked wheels, a diamond frame, bars, a saddle
  bike(P, G, r, col, lie) { P.push(0, lie ? 0.05 : 0, 0, 0, 0, lie ? PI / 2 - 0.06 : 0.25); const wr = 0.33;
    for (const x of [-0.52, 0.52]) { P.add('rubber', G.torus(wr, 0.022, 6, 22), x, wr + 0.02, 0); for (let k = 0; k < 6; k++) P.add('metal', G.box(0.006, wr * 2 - 0.04, 0.006), x, wr + 0.02, 0, 0, 0, k * PI / 6, 1, 1, 1, null); }
    const A = V(-0.52, 0.35, 0), B2 = V(-0.08, 0.36, 0), C2 = V(-0.18, 0.84, 0), D2 = V(0.4, 0.82, 0), E = V(0.52, 0.35, 0);
    for (const [a, b] of [[A, B2], [B2, C2], [C2, D2], [B2, D2], [D2, E], [A, C2]]) P.rod('metal', G, a, b, 0.016, 6, col);
    P.rod('metal', G, D2, V(0.36, 1.0, 0), 0.014, 6, col); P.rod('metal', G, V(0.36, 1.0, -0.24), V(0.36, 1.0, 0.24), 0.012, 6, null); P.add('rubber', G.box(0.22, 0.05, 0.1), -0.2, 0.9, 0);
    P.add('metal', G.cyl(0.08, 0.08, 0.02, 12), -0.08, 0.36, 0.04, PI / 2, 0, 0); P.pop(); },
  // a pram: a deep body on a sprung chassis, four wheels, a push bar and a folded hood; tipped: lying on its side
  pram(P, G, r, col, tipped) { if (tipped) P.push(0, 0.3, 0, 0, 0, PI / 2 - 0.1); else P.push(0, 0, 0);
    P.add('cloth', G.box(0.42, 0.3, 0.75), 0, 0.62, 0, 0, 0, 0, 1, 1, 1, col); P.add('cloth', G.sphere(0.3, 12, 6), 0, 0.76, -0.25, 0, 0, 0, 0.72, 0.8, 0.9, col.clone().multiplyScalar(0.8));
    for (const sx of [-0.2, 0.2]) for (const z of [-0.28, 0.28]) { P.add('rubber', G.torus(0.11, 0.015, 5, 14), sx, 0.12, z, 0, PI / 2, 0); P.rod('metal', G, V(sx, 0.12, z), V(sx * 0.8, 0.47, z * 0.6), 0.008, 5); }
    P.rod('metal', G, V(-0.2, 0.75, -0.35), V(-0.18, 1.05, -0.62), 0.01, 5); P.rod('metal', G, V(0.2, 0.75, -0.35), V(0.18, 1.05, -0.62), 0.01, 5); P.rod('metal', G, V(-0.19, 1.05, -0.62), V(0.19, 1.05, -0.62), 0.014, 6); P.pop(); },
  // toys left on the grass: a ball, building blocks, a sand bucket with its spade, a small doll's chair (bright plastic)
  toys(P, G, r) { const bright = () => new THREE.Color().setHSL(r(), 0.75, 0.45 + 0.1 * r()); P.add('plastic', G.sphere(0.11, 12, 8), 0, 0.11, 0, 0, 0, 0, 1, 1, 1, bright());
    for (let k = 0; k < 5; k++) P.add('plastic', G.box(0.07, 0.07, 0.07), 0.25 + (r() - 0.5) * 0.4, 0.035, (r() - 0.5) * 0.4, (r() < 0.3 ? 0.5 : 0), r() * 3, 0, 1, 1, 1, bright());
    P.push(-0.3, 0.06, 0.2, 0, 0, PI / 2 - 0.2); P.add('plastic', G.lathe('bucket', [[0, 0], [0.07, 0], [0.09, 0.13], [0.095, 0.135]], 12), 0, -0.06, 0, 0, 0, 0, 1, 1, 1, bright()); P.pop(); P.add('plastic', G.box(0.04, 0.012, 0.22), -0.15, 0.01, 0.35, 0, 0.6, 0, 1, 1, 1, bright()); },
  // a sofa dragged out of the house: seat, back, arms, sagging cushions, one cushion on the ground
  sofa(P, G, r, col) { P.add('cloth', G.box(1.8, 0.3, 0.8), 0, 0.25, 0, 0, 0, 0, 1, 1, 1, col); P.add('cloth', G.box(1.8, 0.5, 0.2), 0, 0.62, -0.3, -0.15, 0, 0, 1, 1, 1, col); for (const sx of [-1, 1]) P.add('cloth', G.box(0.2, 0.28, 0.8), sx * 0.9, 0.5, 0, 0, 0, 0, 1, 1, 1, col);
    for (const x of [-0.4, 0.4]) if (r() < 0.75) P.add('cloth', G.box(0.78, 0.11, 0.6), x, 0.45, 0.06, 0.06, 0, (r() - 0.5) * 0.12, 1, 1, 1, col.clone().multiplyScalar(0.9)); P.add('cloth', G.box(0.7, 0.12, 0.55), 1.4, 0.06, 0.6, 0, 0.8, 0.12, 1, 1, 1, col.clone().multiplyScalar(0.85)); },
  // a kitchen table (on its feet, or on its side) with a chair
  table(P, G, r, col, side) { if (side) P.push(0, 0.42, 0, 0, PI / 2 - 0.05, 0); else P.push(0, 0, 0); P.add('wood', G.box(1.2, 0.04, 0.75), 0, 0.74, 0, 0, 0, 0, 1, 1, 1, col);
    for (const sx of [-0.52, 0.52]) for (const sz of [-0.3, 0.3]) P.add('wood', G.box(0.05, 0.72, 0.05), sx, 0.36, sz, 0, 0, 0, 1, 1, 1, col); P.pop(); },
  // cardboard boxes: a stack and loose ones, flaps open, one crushed flat
  boxes(P, G, r, n) { for (let k = 0; k < n; k++) { const w = 0.35 + 0.25 * r(), h = 0.25 + 0.2 * r(), d = 0.3 + 0.2 * r(), st = k > 0 && r() < 0.4, x = st ? 0 : (r() - 0.5) * 1.2, z = st ? 0 : (r() - 0.5) * 0.8, y = st ? 0.4 : 0, c = new THREE.Color().setHSL(0.08, 0.35, 0.36 + 0.12 * r());
      P.push(x, y, z, r() * 0.6); P.add('paper', G.box(w, h, d), 0, h / 2, 0, 0, 0, 0, 1, 1, 1, c); if (r() < 0.6) for (const sz of [-1, 1]) P.add('paper', G.box(w, 0.004, d / 2), 0, h + 0.07, sz * (d / 2 + 0.06), sz * 0.9, 0, 0, 1, 1, 1, c); P.pop(); }
    P.add('paper', G.box(0.7, 0.03, 0.5), 0.8, 0.015, 0.3, 0, r() * 3, 0, 1, 1, 1, new THREE.Color().setHSL(0.08, 0.3, 0.4)); },
  // an air-conditioning unit on a wall bracket (origin on the wall face): case, grille slats, fan disc, a drip stain below it is the builder's
  ac(P, G, r) { P.add('metal', G.box(0.82, 0.55, 0.3), 0, 0, 0.17, 0, 0, 0, 1, 1, 1, new THREE.Color(0.72, 0.72, 0.68)); for (let k = 0; k < 9; k++) P.add('dark', G.box(0.02, 0.48, 0.01), -0.1 + k * 0.05, 0, 0.325); P.add('dark', G.cyl(0.19, 0.19, 0.01, 16), -0.2, 0, 0.322, PI / 2, 0, 0);
    for (const sx of [-0.3, 0.3]) P.beam('metal', G, V(sx, -0.3, 0.02), V(sx, -0.3, 0.34), 0.03, 0.03, new THREE.Color(0.4, 0.38, 0.36)); P.rod('rubber', G, V(0.38, -0.2, 0.1), V(0.42, -1.4, 0.05), 0.008, 4); },
  // a venetian blind hanging in a window (origin at its head rail): slats w wide down to drop m, one cord broken so it hangs askew
  blind(P, G, r, w, drop, col) { const sk = r() < 0.5 ? (r() - 0.5) * 0.5 : 0; P.add('metal', G.box(w + 0.04, 0.04, 0.05), 0, 0, 0, 0, 0, 0, 1, 1, 1, col); for (let y = 0.06; y < drop; y += 0.045) { const t = y / drop; P.add('plastic', G.box(w, 0.006, 0.045), 0, -y - sk * w * 0.5 * t, 0, 0.6, 0, sk * t, 1, 1, 1, col); } },
  // notes taped up (origin on the wall face): papers at slight angles, each with two strips of tape
  notes(P, G, r, n) { for (let k = 0; k < n; k++) { const x = (r() - 0.5) * 0.5, y = (r() - 0.5) * 0.4, a = (r() - 0.5) * 0.3, c = new THREE.Color().setHSL(0.12, 0.2 * r(), 0.75 + 0.15 * r()); P.add('paper', G.box(0.21, 0.28, 0.002), x, y, 0.004 + k * 0.001, 0, 0, a, 1, 1, 1, c);
      for (const sx of [-1, 1]) P.add('plastic', G.box(0.06, 0.02, 0.002), x + sx * 0.08, y + 0.13, 0.006 + k * 0.001, 0, 0, a + sx * 0.4, 1, 1, 1, new THREE.Color(0.85, 0.82, 0.6)); } },
  // a plywood sheet with a sprayed warning, leaning on something (origin at its foot, lean a)
  ply(P, G, r, a, cell) { P.push(0, 0, 0, 0, -a, 0); P.add('wood', G.box(1.2, 1.2, 0.018), 0, 0.6, 0, 0, 0, 0, 1, 1, 1, new THREE.Color().setHSL(0.09, 0.35, 0.55 + 0.1 * r())); P.add('decal', G.decal(cell), 0, 0.62, 0.012, 0, 0, 0, 0.95, 0.95, 1); P.pop(); },
  // a garden hose in loose coils
  hose(P, G, r, col) { for (let k = 0; k < 3; k++) P.add('rubber', G.torus(0.22 + 0.04 * k, 0.012, 5, 20), (r() - 0.5) * 0.06, 0.012 + k * 0.024, (r() - 0.5) * 0.06, PI / 2, 0, 0, 1, 1, 1, col); }
};

// ---------------------------------------------------------------- where the dormant machines will stand by day (the same rule and random numbers as src/main.js needDormant), so props keep clear of them
const dormCache = new WeakMap();
export function dormantSpots(run) {
  if (dormCache.has(run)) return dormCache.get(run);
  const out = []; try { let q = (run.seed ^ 0xd0a) >>> 0; const rn = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296), T = CONFIG.town, G = CONFIG.marla.guide, kinds = GLOOM_KINDS.slice();
    for (let k = 0; k < 200 && out.length < CONFIG.gloomLook.dormant; k++) { const x = (rn() * 2 - 1) * (T.boundX - 6), z = (rn() < 0.5 ? -1 : 1) * (4 + rn() * 7);
      if (Math.hypot(x, z) < 7 || Math.hypot(x - G.x, z - G.z) < 5 || run.houses.some((h) => (Math.abs(x - h.x) < h.H + 1.8 && Math.abs(z - h.z) < h.H + 1.8) || Math.hypot(x - h.doorX, z - h.doorZ) < 4 || (h.ext && Math.hypot(x - h.ext.x, z - h.ext.z) < h.ext.r + 1.2)) || run.cars.some((c) => Math.hypot(x - c.x, z - c.z) < 3.4) || out.some((d) => Math.hypot(x - d.x, z - d.z) < 9)) continue;
      kinds.splice(Math.floor(rn() * kinds.length), 1); rn(); out.push({ x, z }); } } catch (e) { void e; }
  dormCache.set(run, out); return out;
}
