// MARLA'S VOICE (owner Nov 18): her run lines are spoken (clips made by art/voice/gen_voice.py; the table in src/voicelines.js). Numbers in CONFIG.voice.marla.
// Only on a run (the street by day, the house by day, the night and its drill): her base talk stays text only, and nothing plays outside state 'play'.
// The game shows a line as text as before; tick() sees the new text in Marla's card (#marla) or a "Marla: ..." centre line (#csay, the boss night) and plays its clip.
// One clip at a time (a new line stops the old one); the music is ducked while she talks; Voice off, the pause menu, a hidden tab or leaving the run stop the clip.
// Clips play through the game's AudioContext (fetched and decoded); where fetch cannot read the file (a page opened from disk), a plain audio element plays it.
import { CONFIG } from './config.js';
import { VOICE_LINES } from './voicelines.js';

// exact text -> line; lines with a {x} hole (a value the clip does not say) are matched by pattern
const EXACT = new Map(), HOLES = [];
for (const q of VOICE_LINES) { if (/\{\w+\}/.test(q.t)) HOLES.push({ q, re: new RegExp('^' + q.t.split(/\{\w+\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+?') + '$') }); else EXACT.set(q.t, q); }
export function lineFor(text) { const t = String(text || '').replace(/^Marla: /, ''); if (!t) return null; const q = EXACT.get(t); if (q) return q; const h = HOLES.find((x) => x.re.test(t)); return h ? h.q : null; }

// desk = desktop controls (pointer: fine); with CONFIG.voice.marla.desktopOnly a phone never plays a clip
export function createMarlaVoice(audio, storage, desk) {
  const V = () => CONFIG.voice.marla;
  let on = V().on, lastText = '', shown = '', cur = null, token = 0, duckK = 0;
  try { const s = storage && storage.getItem(V().storeKey); if (s === 'off') on = false; else if (s === 'on') on = true; } catch (e) { /* default */ }
  // test hook: clips started (n), the last clip id and its text, how it played ('ctx' = the AudioContext, 'el' = an audio element), whether one is playing now
  const allowed = () => !!desk || !V().desktopOnly;
  const hook = { dbg: [], n: 0, last: '', lastText: '', via: '', playing: false, get on() { return on; } };
  if (typeof window !== 'undefined') window.__marlaVoice = hook;
  // decoded clips, newest last; at most V().cache kept
  const buf = new Map();
  function decode(a, url) { if (buf.has(url)) { const p = buf.get(url); buf.delete(url); buf.set(url, p); return p; }
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error('voice ' + r.status); return r.arrayBuffer(); }).then((ab) => new Promise((res, rej) => { const pr = a.decodeAudioData(ab, res, rej); if (pr && pr.then) pr.then(res, rej); }));
    p.catch(() => buf.delete(url)); buf.set(url, p); while (buf.size > V().cache) buf.delete(buf.keys().next().value); return p; }
  function stop() { token++; if (cur) { try { cur.stop(); } catch (e) { /* already ended */ } cur = null; } hook.playing = false; }
  function started(q, via, node) { if (hook.dbg.length < 60) hook.dbg.push(['start', +performance.now().toFixed(0), q.id]); cur = node; hook.n++; hook.last = q.id; hook.lastText = shown; hook.via = via; hook.playing = true; }
  function viaElement(q, my) { if (my !== token) return; try { const el = new Audio(q.u); el.volume = Math.min(1, V().vol); el.onended = () => { if (cur && cur.el === el) { cur = null; hook.playing = false; } };
    const node = { el, stop() { el.pause(); } }; started(q, 'el', node); const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* no audio here */ } }
  function play(q) { stop(); const my = token, a = audio(); if (!a) { viaElement(q, my); return; }
    decode(a, q.u).then((b) => { if (my !== token) return; const src = a.createBufferSource(), g = a.createGain(); src.buffer = b; g.gain.value = V().vol; src.connect(g); g.connect(a.destination);
      const node = { stop() { try { src.stop(); } catch (e) { /* not started */ } src.disconnect(); } }; src.onended = () => { if (cur === node) { cur = null; hook.playing = false; } };
      src.start(a.currentTime + V().delay); started(q, 'ctx', node); }).catch(() => viaElement(q, my)); }
  // every frame: run = on a run in state 'play'; held = paused or the tab hidden; text = what Marla's card shows now ('' when hidden or empty), csay = the centre line
  function tick(dt, run, held, text, csay) {
    const t = text || (/^Marla: /.test(csay || '') ? csay : '');
    if (!run || held || !on || !allowed()) { if (t !== lastText && hook.dbg.length < 60) hook.dbg.push(['skip', +performance.now().toFixed(0), !!run, !!held, t.slice(0, 20)]); stop(); lastText = run ? t : ''; }
    else if (t !== lastText) { if (hook.dbg.length < 60) hook.dbg.push(['new', +performance.now().toFixed(0), t.slice(0, 20)]); lastText = t; const q = t && lineFor(t); if (q) { shown = t.replace(/^Marla: /, ''); play(q); } }
    const want = cur ? 1 : 0, sp = dt / Math.max(0.01, want ? V().duckIn : V().duckOut); duckK += Math.max(-sp, Math.min(sp, want - duckK));
  }
  // the music's volume multiplier while she talks (1 = no duck)
  const duck = () => 1 - V().duck * duckK;
  function setOn(v) { on = !!v; if (!on) stop(); try { storage && storage.setItem(V().storeKey, on ? 'on' : 'off'); } catch (e) { /* not saved */ } }
  return { tick, duck, stop, setOn, get on() { return on; }, get allowed() { return allowed(); }, hook };
}
