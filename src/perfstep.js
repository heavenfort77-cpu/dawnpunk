// Lag fix (lag report Nov 18, finding 6; owner approved Nov 19): the automatic step-down on the desktop tier. While you play (base or a run, not paused), the frame time is
// averaged over CONFIG.lag.step.watch seconds; when `hold` readings in a row are slower than slowMs, ONE step of CONFIG.lag.step.order is taken, without a reload:
// ratio (sharpness cap down), ao (contact shading off), shadow (sun shadow maps smaller), lights (fewer machine screen lights). A strong PC never gets slow readings
// and keeps the full look. Never on phones (the low tier has its own, older cloud-layer shedding in src/sky.js), never in the scripted checks unless ?autostep=1.
import { CONFIG } from './config.js';
import { QUALITY, Q, QPICK, saveQuality } from './quality.js';

export function createPerfStep(o) {
  const S = CONFIG.lag.step; let url = null; try { url = new URLSearchParams(location.search).get('autostep'); } catch (e) { url = null; }
  let bot = false; try { bot = !!window.__dtMax || !!navigator.webdriver; } catch (e) { bot = false; }
  // a tier given in the address (?quality=low|medium|high: the checks, or the owner testing a tier) is locked: no step-down unless ?autostep=1
  const on = QUALITY === 'high' && !!S && (url === '1' || (url !== '0' && S.on && !bot && QPICK.by !== 'address'));
  let acc = 0, n = 0, slow = 0, settle = S ? S.settle : 0, level = 0;
  const state = { on, level: 0, taken: [], lastAvg: 0 };
  try { window.__perfStep = state; } catch (e) { /* no window */ }
  function apply(k) {
    const R = o.renderer;
    if (k === 'ratio') { R.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.ratio)); o.resize(); }
    else if (k === 'ao') { const fx = o.fx(); if (fx && fx.setAO) fx.setAO(false); }
    else if (k === 'shadow') { Q.shadowMap = Math.min(Q.shadowMap, S.shadow); Q.baseShadowMap = Math.min(Q.baseShadowMap, S.shadow);
      o.scene.traverse((l) => { if (!l.isDirectionalLight || !l.castShadow || l.name === 'playerShadowLight' || l.shadow.mapSize.x <= S.shadow) return; const k2 = l.shadow.mapSize.x / S.shadow; l.shadow.mapSize.set(S.shadow, S.shadow); l.shadow.radius = Math.max(1, l.shadow.radius / k2); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } });
      R.shadowMap.needsUpdate = true; }
    else if (k === 'lights') { const L = o.lights; for (const l of L.slice(S.lights)) { l.intensity = 0; if (l.parent) l.parent.remove(l); } L.length = Math.min(L.length, S.lights); }
    state.taken.push(k); state.level = ++level;
  }
  return { state,
    // ms: the real time since the last frame; live: a 3D scene is being played (not a menu, not paused)
    tick(ms, live) {
      if (!on || state.savedLow) return; if (!live || document.hidden) { acc = 0; n = 0; settle = Math.max(settle, 1); return; }
      if (ms > S.ignoreMs) return; if (settle > 0) { settle -= ms / 1000; return; }
      acc += ms; n++; if (acc < S.watch * 1000) return; const avg = acc / n; acc = 0; n = 0; state.lastAvg = Math.round(avg * 10) / 10;
      if (avg > S.slowMs) slow++; else slow = 0;
      // every step taken and still slow: the next start uses the low tier (saved as if picked with the Graphics button; this visit keeps its scene)
      if (slow >= S.hold) { slow = 0; settle = S.settle; if (level < S.order.length) apply(S.order[level]); else { state.savedLow = saveQuality('low'); if (o.onLow) o.onLow(); } }
    },
    // a new scene has started (its first frames compile shaders and upload textures): wait before measuring again
    rest() { settle = Math.max(settle, S.settle); acc = 0; n = 0; slow = 0; },
    // the checks: take the next step now
    force() { if (level < S.order.length) apply(S.order[level]); return state; } };
}
