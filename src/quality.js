// Graphics tier (2026-11-15; user: "it is reasonable for mobile to be less detail but on desktop and laptop details and texture cannot skim").
// Picked once at start: ?quality=high|low in the address wins, then the choice saved from the Graphics link (localStorage 'dawnpunk.quality'),
// then the primary pointer: coarse (a phone or tablet) = low, fine (mouse or trackpad, touch laptops included) = high. Every number is in CONFIG.quality.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { TEX } from './texdata.js';
import { TEXHI } from './texhi.js';

export const QPICK = (() => {
  try { const u = new URLSearchParams(location.search).get('quality'); if (u === 'high' || u === 'low') return { tier: u, by: 'address' }; } catch (e) { /* no address */ }
  try { const s = localStorage.getItem('dawnpunk.quality'); if (s === 'high' || s === 'low') return { tier: s, by: 'saved' }; } catch (e) { /* storage blocked */ }
  let coarse = true;
  try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { /* unknown: stay on the phone settings */ }
  return { tier: coarse ? 'low' : 'high', by: 'pointer' };
})();
export const QUALITY = QPICK.tier;
export const Q = CONFIG.quality[QUALITY];
export function saveQuality(tier) { try { localStorage.setItem('dawnpunk.quality', tier); return true; } catch (e) { return false; } }

// texture sharpness at a slant: the tier's value, capped by what the GPU can do (main.js tells us once the renderer exists)
let gpuAniso = 1;
export function setGpuAniso(n) { gpuAniso = Math.max(1, n || 1); }
export const aniso = () => Math.min(Q.aniso, gpuAniso);
export const reliefAniso = () => Math.min(Q.reliefAniso, gpuAniso);

// High-tier textures: files beside index.html (dist/tex/). Each texture starts with the 512 px picture packed in the page and takes the
// sharper one when it has arrived; if a file fails (or is unreadable, as from a file:// page), that texture simply keeps the packed one.
const loader = new THREE.TextureLoader(), hiImg = {}, hiSrc = {}, waiting = {};
export const hiState = { asked: 0, ok: 0, failed: 0, used: 0 };
// every texture of one name shares one source, so the GPU holds each sharp picture once however many materials use it
function upgrade(t, name) { if (!hiImg[name] || (t.userData.hi && t.source === hiSrc[name])) return; t.source = hiSrc[name]; t.userData.hi = true; t.needsUpdate = true; hiState.used++; }
function readable(img) { try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 1, 1); x.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; } }
if (Q.hiTex && typeof Image !== 'undefined') {
  for (const name in TEXHI) {
    hiState.asked++; const img = new Image();
    img.onload = () => { if (!readable(img)) { hiState.failed++; delete waiting[name]; return; } hiImg[name] = img; hiSrc[name] = new THREE.Source(img); hiState.ok++; for (const t of waiting[name] || []) upgrade(t, name); delete waiting[name]; };
    img.onerror = () => { hiState.failed++; delete waiting[name]; };
    img.src = TEXHI[name];
  }
}
// follow a texture made from TEX[name] (also clones, which share its picture): it gets the high-tier picture if and when there is one
export function texTrack(t, name) { if (!Q.hiTex || !TEXHI[name]) return t; if (hiImg[name]) upgrade(t, name); else (waiting[name] = waiting[name] || []).push(t); return t; }
// a texture for TEX[name]: the packed picture now, the high-tier file once it has arrived (the packed picture never overwrites it)
export function texLoad(name) { const t = loader.load(TEX[name], () => { if (t.userData.hi && hiSrc[name]) { hiSrc[name].data = hiImg[name]; t.source = hiSrc[name]; t.needsUpdate = true; } }); return texTrack(t, name); }
// round parts: segment count for the tier
export const seg = (n) => Math.min(Math.max(n, Math.round(n * Q.round)), Q.roundMax);
