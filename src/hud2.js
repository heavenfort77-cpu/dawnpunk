// HUD2 and the title screen (owner approved the mock-up docs/sample_title_hud_mockup.png on Nov 16, 2026).
// Desktop (pointer: fine) gets framed panels: brass by day, steel blue by night (body.hn). Phones keep their layout; both get the clock in in-world hours.
// Every number is in CONFIG.clock, CONFIG.hud2 and CONFIG.title; this file turns them into CSS variables and the title picture.
import { CONFIG } from './config.js';
import { TITLE_GLOOM } from './titleart.js';
import { DEVICE_ICONS } from './deviceicons.js';

export const FINE2 = (() => { try { return !matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
export const ICON = (k) => DEVICE_ICONS[k] || '';

// seconds of game time left -> in-world hours text ("3h 20m", "40m"), rounded UP to CONFIG.clock.step minutes
export function hoursLeft(sec, night) {
  const C = CONFIG.clock, dur = night ? CONFIG.night.duration : CONFIG.day.duration, hrs = night ? C.nightHours : C.dayHours;
  const m = Math.ceil((Math.max(0, sec) / dur) * hrs * 60 / C.step - 1e-6) * C.step, h = Math.floor(m / 60), r = m % 60;
  return h ? h + 'h ' + (r < 10 ? '0' : '') + r + 'm' : r + 'm';
}
// the same in words, for Marla ("2 hours", "40 minutes")
export function hoursWords(sec, night) {
  const C = CONFIG.clock, dur = night ? CONFIG.night.duration : CONFIG.day.duration, hrs = night ? C.nightHours : C.dayHours;
  const m = Math.ceil((Math.max(0, sec) / dur) * hrs * 60 / C.step - 1e-6) * C.step, h = Math.floor(m / 60), r = m % 60;
  if (!h) return r + ' minutes'; return h + (h === 1 ? ' hour' : ' hours') + (r ? ' ' + r + ' minutes' : '');
}
// the clock element: a small label (a block line on desktop, inline on phones) and the hours
export function setClock(el, sec, night) {
  const lab = night ? 'Dawn in' : 'Daylight left', t = hoursLeft(sec, night), key = lab + t;
  if (el.dataset.c !== key) { el.dataset.c = key; el.innerHTML = '<small>' + lab + ' </small>' + t; }
}
// the count line: [label, value, phoneOnly]; desktop drops the Sun number (it is on its bar) and uses a dot between parts
export function countLine(parts) { return parts.filter((q) => q && !(FINE2 && q[2])).map((q) => q[0] + ' ' + q[1]).join(FINE2 ? ' · ' : ' | '); }
// panel fix (Nov 17): the count line as HTML, with the small sun icon in front of the Sun part (CONFIG.ui.sun); written only when it changes
// (LAG FIX Nov 19: the pattern is made once per Sun word, not every frame)
let SUNRX = null, SUNW = '';
export function setCount(el, parts) { if (SUNW !== CONFIG.ui.sun) { SUNW = CONFIG.ui.sun; SUNRX = new RegExp('(^| )' + SUNW + ' '); } const h = countLine(parts).replace(SUNRX, '$1' + SUNI + SUNW + ' '); if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } }
// the small sun icon (CSS draws it from --sun-ic; .no = crossed out, for "can't afford")
export const SUNI = '<i class="sunic"></i>', SUNNO = '<i class="sunic no"></i>';
// a cost in Sun with its icon and unit ("12 Sun"), or "free"
export const sunCost = (n) => (n ? SUNI + n + ' ' + CONFIG.ui.sun : 'free');
// the charge label on desktop and the phone bar labels: one name, day and night (panel fix: it was "Sun charge" by day and "Battery" at night); hp in percent for the phone health bar
export function setVit(el, energy, night, hp) { const n = Math.round(energy), h = SUNI + CONFIG.ui.sun + ' ' + n; if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  const eb = document.getElementById('enb'), hb = document.getElementById('hpb'), et = CONFIG.ui.sun + ' ' + n; if (eb && eb.dataset.l !== et) eb.dataset.l = et;
  if (hb && hp !== undefined) { const ht = 'Health ' + Math.max(0, Math.round(hp)); if (hb.dataset.l !== ht) hb.dataset.l = ht; } }
// the thin bar under the clock: share of daylight left by day, share of the night already passed at night (it fills toward dawn)
export function setClockBar(sec, night) { const el = document.getElementById('clkfill'); if (!el) return; const dur = night ? CONFIG.night.duration : CONFIG.day.duration, f = Math.max(0, Math.min(1, sec / dur)), w = Math.round(1000 * (night ? 1 - f : f)) / 10 + '%';
  if (el.style.width !== w) el.style.width = w; el.parentNode.classList.toggle('n', !!night); }
// THE CENTRE QUEUE (coordinator, advisor round 2): other code puts a line in the centre column with say(kind, text, prio, secs); one line per kind (a new one replaces it);
// main.js tickCentre shows only the highest priority item among these lines and its own (Marla, flashes, aim line, mouse hint, prompts), CONFIG.ui.centre. secs <= 0 keeps it until unsay(kind).
const CQ = new Map();
export function say(kind, text, prio, secs) { const U = CONFIG.ui; if (!text) { CQ.delete(kind); return; } CQ.set(kind, { kind, text: String(text), prio: prio !== undefined ? prio : U.centre[kind] !== undefined ? U.centre[kind] : U.sayPrio, until: (secs !== undefined ? secs : U.saySecs) > 0 ? performance.now() / 1000 + (secs !== undefined ? secs : U.saySecs) : Infinity }); }
export function unsay(kind) { CQ.delete(kind); }
// the highest priority queued line still on time (or null)
export function topSaid() { const now = performance.now() / 1000; let best = null; for (const [k, q] of CQ) { if (q.until < now) { CQ.delete(k); continue; } if (!best || q.prio > best.prio) best = q; } return best; }
if (typeof window !== 'undefined') window.__hud = { say, unsay, topSaid };
// a sun icon as an SVG picture (disc and eight rays), crossed out with a red slash for "not enough Sun"
function sunSvg(col, crossed) { let r = ''; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a); r += '<line x1="' + (12 + 7.2 * c).toFixed(1) + '" y1="' + (12 + 7.2 * s).toFixed(1) + '" x2="' + (12 + 10.5 * c).toFixed(1) + '" y2="' + (12 + 10.5 * s).toFixed(1) + '"/>'; }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g stroke="#000" stroke-width="4.2" stroke-linecap="round">' + r + '</g><circle cx="12" cy="12" r="5.6" fill="#000"/><g stroke="' + col + '" stroke-width="2.2" stroke-linecap="round">' + r + '</g><circle cx="12" cy="12" r="4.6" fill="' + col + '"/>'
    + (crossed ? '<line x1="3" y1="21" x2="21" y2="3" stroke="#000" stroke-width="5" stroke-linecap="round"/><line x1="3" y1="21" x2="21" y2="3" stroke="#ff5a4a" stroke-width="2.6" stroke-linecap="round"/>' : '') + '</svg>';
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; }
// day / night look of the frames
let wasNight = null; export function mode(night) { if (night === wasNight) return; wasNight = night; document.body.classList.toggle('hn', !!night); }

// CSS variables from CONFIG.hud2 and CONFIG.title, and the title picture
export function applyHud2(tier) {
  const H = CONFIG.hud2, T = CONFIG.title, px = (v) => v + 'px', v = {}, n = {}, dd = {};
  // panel fix (Nov 17): CONFIG.ui as CSS variables (sun icon, text backing, smallest text, tap size, phone device buttons, crosshair, threat arc, clock bar), and the night edge darkness per tier (CONFIG.nightLook)
  { const U = CONFIG.ui, X = U.cross, CB = U.clockBar, NL = CONFIG.nightLook[tier === 'high' ? 'high' : 'low'];
    Object.assign(v, { '--sun-ic': sunSvg(U.sunIcon, false), '--sun-no': sunSvg(U.sunIcon, true), '--ui-back': U.backing, '--ui-min-d': px(U.minPx[0]), '--ui-min-p': px(U.minPx[1]), '--ui-cnt-d': px(U.countPx[0]), '--ui-cnt-p': px(U.countPx[1]), '--tap': px(U.tap),
      '--dev-w': px(U.devBtn[0]), '--dev-h': px(U.devBtn[1]), '--dev-ic': px(U.devBtn[2]), '--x-size': px(X.size), '--x-line': px(X.line), '--x-o': X.outline, '--x-neutral': X.neutral, '--x-use': X.use, '--x-gloom': X.gloom, '--arc-c': U.arc,
      '--cb-h': px(CB.h), '--cb-day': CB.day, '--cb-night': CB.night, '--cb-bg': CB.bg, '--nl-vig': 'rgba(0,0,0,' + NL.vig + ')' }); }
  for (const k in H.day) { const name = k === 'big' ? 'bigc' : k; v['--h2-' + name] = H.day[k]; dd['--h2d-' + name] = H.day[k]; n['--h2-' + name] = H.night[k]; }
  Object.assign(v, dd);
  v['--h2-tagl'] = H.tag.line; v['--h2-tagk'] = H.tag.label; v['--h2-tagt'] = H.tag.text; v['--h2-warn'] = H.warn; v['--h2-warnA'] = H.warn + 'cc'; v['--h2-crossc'] = H.day.text + 'cc';
  v['--h2-hp0'] = H.hp[0]; v['--h2-hp1'] = H.hp[1]; v['--h2-sun0'] = H.sun[0]; v['--h2-sun1'] = H.sun[1]; v['--h2-bat0'] = H.bat[0]; v['--h2-bat1'] = H.bat[1]; v['--h2-barBg'] = H.barBg;
  for (const k in H.px) v['--h2-' + k] = px(H.px[k]);
  v['--h2-vigc'] = 'rgba(0,0,0,' + H.vigA + ')'; v['--h2-phoneIcA'] = String(H.phoneIcA); v['--h2-arcR'] = px(H.arc.r); v['--h2-arcW'] = px(H.arc.w);
  v['--t-sky0'] = T.sky[0]; v['--t-wordc'] = T.word[0]; v['--t-glow'] = T.word[1]; v['--t-word'] = px(T.word[2]); v['--t-line'] = T.line[0]; v['--t-kick'] = T.line[1]; v['--t-dim'] = T.line[2];
  const css = (sel, o) => sel + '{' + Object.keys(o).map((k) => k + ':' + o[k]).join(';') + '}';
  const st = document.createElement('style'); st.id = 'h2vars'; st.textContent = css(':root', v) + css('body.hn', n); document.head.appendChild(st);
  const svg = document.getElementById('tsky'); if (svg) svg.innerHTML = titleSvg();
}

// the title picture in a 1280 x 720 frame: dusk sky, the last sun behind one lit house, dark ground, and the dormant machines (src/titleart.js)
function titleSvg() {
  const T = CONFIG.title, W = 1280, Hh = 720, G = TITLE_GLOOM, bw = W, bh = G.h * (W / G.w), hx = T.houseX, hw = T.houseW, hy = T.houseY, wall = T.feetY - 16 - hy;
  const stops = T.sky.map((c, i) => '<stop offset="' + T.stops[i] + '" stop-color="' + c + '"/>').join('');
  const hill = 'M0 ' + T.hill[0] + T.hill.map((y, i) => ' L' + Math.round((i / (T.hill.length - 1)) * W) + ' ' + y).join('') + ' V' + Hh + ' H0Z';
  const win = (x, c, o) => '<rect x="' + x + '" y="' + (hy + wall * 0.33) + '" width="' + hw * 0.21 + '" height="' + wall * 0.31 + '" fill="' + c + '" opacity="' + o + '"/>';
  return '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">' + stops + '</linearGradient>'
    + '<radialGradient id="ts" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="' + T.glow[0] + '" stop-opacity="' + T.glow[1] + '"/><stop offset="1" stop-color="' + T.glow[0] + '" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="twg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="' + T.win[0] + '" stop-opacity=".45"/><stop offset="1" stop-color="' + T.win[0] + '" stop-opacity="0"/></radialGradient></defs>'
    + '<rect width="' + W + '" height="' + Hh + '" fill="url(#tg)"/><rect x="' + (hx - 300) + '" y="' + (Hh - 300) + '" width="600" height="300" fill="url(#ts)"/>'
    + '<path d="' + hill + '" fill="' + T.ground + '"/>'
    + '<g fill="' + T.house + '"><rect x="' + (hx - hw / 2) + '" y="' + hy + '" width="' + hw + '" height="' + (wall + 20) + '"/><path d="M' + (hx - hw / 2 - 20) + ' ' + (hy + 4) + ' L' + hx + ' ' + (hy - 70) + ' L' + (hx + hw / 2 + 20) + ' ' + (hy + 4) + 'Z"/><rect x="' + (hx + hw * 0.29) + '" y="' + (hy - 78) + '" width="16" height="50"/></g>'
    + '<ellipse cx="' + hx + '" cy="' + (hy + wall * 0.48) + '" rx="' + hw * 0.7 + '" ry="' + wall * 0.5 + '" fill="url(#twg)"/>'
    + win(hx - hw * 0.275, T.win[0], 1) + win(hx + hw * 0.065, T.win[1], 0.85)
    + '<image id="tgimg" href="' + G.img + '" x="0" y="' + (T.feetY - bh).toFixed(1) + '" width="' + bw + '" height="' + bh.toFixed(1) + '" preserveAspectRatio="none"/>';
}
