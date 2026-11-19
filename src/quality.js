// Graphics tier (2026-11-15, tiers reworked Nov 19 below; user: "it is reasonable for mobile to be less detail but on desktop and laptop details and texture cannot skim").
// Picked once at start (see TIERS below). Every number is in CONFIG.quality.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { TEX } from './texdata.js';
import { TEXHI } from './texhi.js';

// TIERS (owner's performance rules, Nov 19): low | medium | high. MEDIUM is the default on every device (desktop included), never high by default; the tier is chosen
// by measured frame time, not by mouse or touch: src/perfstep.js steps the look down while you play and, if frames are still slow after its last step, saves low for the
// next start. ?quality=low|medium|high in the address wins (the scripted checks pass their tier), then the choice saved from the Graphics button.
// medium and high both use the desktop builds and models (QUALITY 'high' below, the switch every module reads); medium is CONFIG.quality.medium laid over CONFIG.quality.high.
export const QPICK = (() => {
  const ok = (t) => t === 'high' || t === 'low' || t === 'medium';
  try { const u = new URLSearchParams(location.search).get('quality'); if (ok(u)) return { tier: u, by: 'address' }; } catch (e) { /* no address */ }
  try { const s = localStorage.getItem('dawnpunk.quality'); if (ok(s)) return { tier: s, by: 'saved' }; } catch (e) { /* storage blocked */ }
  return { tier: 'medium', by: 'default' };
})();
export const TIER = QPICK.tier;
export const QUALITY = TIER === 'low' ? 'low' : 'high';
// medium: its settings laid over the high block in place (every module that reads CONFIG.quality.high sees them); arrays and plain values replace, objects merge
if (TIER === 'medium' && CONFIG.quality.medium) { const lay = (a, b) => { for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) lay(a[k], v); else a[k] = v; } }; lay(CONFIG.quality.high, CONFIG.quality.medium); }
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
// (R3, owner 14:10: under 20 MB before the base) each sharp picture is asked for when a texture of its name is first made (texTrack), not all with the page: the
// street's pictures then load when the street is built (under the film's black or the ride card, which wait for them: hiPending), not before the base
const askedHi = {};
function askHi(name) {
  if (askedHi[name] || !Q.hiTex || typeof Image === 'undefined' || !TEXHI[name]) return; askedHi[name] = true;
  hiState.asked++; const img = new Image();
  // (R4, diagnose 6 film profile: "3922 ms getImageData < readable < img.onload") the 1 px canvas check drew every whole picture on the main thread (a full decode
  // there); a picture can only be unreadable when the page itself is a file:// page and the picture a file beside it, so only then is it checked (REMOVED elsewhere);
  // the picture is decoded off the main thread first (img.decode) before it is used
  const chk = typeof location !== 'undefined' && location.protocol === 'file:' && !String(TEXHI[name]).startsWith('data:');
  const ok = () => { if (chk && !readable(img)) { hiState.failed++; delete waiting[name]; return; } hiImg[name] = img; hiSrc[name] = new THREE.Source(img); hiState.ok++; for (const t of waiting[name] || []) upgrade(t, name); delete waiting[name]; };
  const bad = () => { hiState.failed++; delete waiting[name]; };
  img.src = TEXHI[name];
  if (img.decode) img.decode().then(ok, bad); else { img.onload = ok; img.onerror = bad; }
}
// every sharp picture asked for at once: at the film's start, the ride card and the player's first click or key in the base (so the street and the houses have
// them before they are shown, as when they all came with the page)
export function askAllHi() { for (const name in TEXHI) askHi(name); }
// sharp pictures asked for and not yet arrived (or failed)
export const hiPending = () => hiState.asked - hiState.ok - hiState.failed;
// follow a texture made from TEX[name] (also clones, which share its picture): it gets the high-tier picture if and when there is one
export function texTrack(t, name) { if (!Q.hiTex || !TEXHI[name]) return t; askHi(name); if (hiImg[name]) upgrade(t, name); else (waiting[name] = waiting[name] || []).push(t); return t; }
// a texture for TEX[name]: the packed picture now, the high-tier file once it has arrived (the packed picture never overwrites it)
export function texLoad(name) { const t = loader.load(TEX[name], () => { if (t.userData.hi && hiSrc[name]) { hiSrc[name].data = hiImg[name]; t.source = hiSrc[name]; t.needsUpdate = true; } }); return texTrack(t, name); }
// round parts: segment count for the tier
export const seg = (n) => Math.min(Math.max(n, Math.round(n * Q.round)), Q.roundMax);
