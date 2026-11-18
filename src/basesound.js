// The base's WATER SOUND (round 2, owner Nov 17 21:46 / 21:48): a soft stream (looping filtered noise), trickle grains (short bright drops) and the wheel's creak with paddle slaps,
// made in Web Audio (no files). ONLY while you walk the base: silent on the street, the title, the opening film, at night, in the boss fight and while a panel is open or the game paused.
// Louder near the stream and the wheel; muffled and quieter inside a room or your home; fades in and out over CONFIG.baseWater.sound.fade seconds; follows the music switch and volume.
// waterTarget() is pure (test.js checks it); createWaterSound() keeps its own level even without an audio context, so the fade can be tested headless too.

// what the levels should be now: s = { base, paused, ui, hidden, music, volume, near: { stream, wheel } (m), indoor }; returns { stream, wheel, lp (Hz) }
export function waterTarget(cfg, s) {
  const S = cfg.baseWater && cfg.baseWater.on && cfg.baseWater.sound;
  if (!S || !S.on || !s || !s.base || s.paused || s.ui || s.hidden || !s.music || !s.near) return { stream: 0, wheel: 0, lp: 18000 };
  const ns = Math.max(0, 1 - s.near.stream / S.reach), nw = Math.max(0, 1 - s.near.wheel / S.wheelReach), v = Math.max(0, s.volume || 0) * S.vol, k = s.indoor ? S.indoor[0] : 1;
  return { stream: v * ns * ns * k, wheel: v * S.wheel * nw * nw * k, lp: s.indoor ? S.indoor[1] : 18000 };
}

export function createWaterSound(cfg) {
  const S = (cfg.baseWater && cfg.baseWater.sound) || { fade: 1, creak: [3, 0], trickle: 0 }, cur = { stream: 0, wheel: 0 }; let N = null, ac = null, tricT = 0, creakT = 0, slapT = 0, last = 0;
  // the sound graph, made once the first time there is something to hear: noise -> band-pass -> stream gain; grains and creaks -> their own gains; all -> a low-pass (muffling indoors) -> out
  function build(ctx) {
    ac = ctx; const sr = ctx.sampleRate, buf = ctx.createBuffer(1, sr * 2, sr), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.35 + b * 2.2; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6; const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 2400; hs.gain.value = -8;
    const gs = ctx.createGain(); gs.gain.value = 0; const gw = ctx.createGain(); gw.gain.value = 0; const gg = ctx.createGain(); gg.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; const out = ctx.createGain(); out.gain.value = 1;
    src.connect(bp); bp.connect(hs); hs.connect(gs); gs.connect(lp); gw.connect(lp); gg.connect(lp); lp.connect(out); out.connect(ctx.destination); src.start();
    N = { gs, gw, gg, lp, noise: buf };
  }
  // one trickle grain: a short bright sine drop gliding down, very quiet
  function grain(t) { const o = ac.createOscillator(), e = ac.createGain(), f = 900 + Math.random() * 1900; o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.06); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.25, t + 0.004); e.gain.exponentialRampToValueAtTime(0.001, t + 0.07); o.connect(e); e.connect(N.gg); o.start(t); o.stop(t + 0.09); }
  // the wheel's creak: a low rasping saw through a narrow band that bends, and a paddle slap: a short burst of noise
  function creak(t) { const o = ac.createOscillator(), f = ac.createBiquadFilter(), e = ac.createGain(), base = 70 + Math.random() * 40; o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.35, t + 0.3); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(620, t + 0.3);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(S.creak[1], t + 0.05); e.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.connect(f); f.connect(e); e.connect(N.gw); o.start(t); o.stop(t + 0.42); }
  function slap(t) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain(); s.buffer = N.noise; f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 1.2; e.gain.setValueAtTime(0.5, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(f); f.connect(e); e.connect(N.gw); s.start(t, Math.random() * 1.5, 0.15); }
  // every frame: ctx = a running AudioContext or null; st = the state for waterTarget. Levels ease toward the target (about S.fade seconds of game or wall-clock time, whichever is longer,
  // so a frame stalled by loading the street still fades it) and are exactly 0 once faded out.
  function tick(dt, ctx, st) {
    const nowMs = Date.now(), real = last ? Math.min(1, (nowMs - last) / 1000) : 0, T = waterTarget(cfg, st), k = Math.min(1, Math.max(dt, real) * 3 / Math.max(0.05, S.fade)); last = nowMs;
    for (const key of ['stream', 'wheel']) { cur[key] += (T[key] - cur[key]) * k; if (T[key] === 0 && cur[key] < 0.002) cur[key] = 0; }
    if (!ctx) return; if (!N) { if (!cur.stream && !cur.wheel) return; build(ctx); }
    const now = ctx.currentTime; N.gs.gain.setTargetAtTime(cur.stream, now, 0.05); N.gw.gain.setTargetAtTime(cur.wheel, now, 0.05); N.gg.gain.setTargetAtTime(cur.stream * 0.5, now, 0.05); N.lp.frequency.setTargetAtTime(T.lp, now, 0.2);
    if (cur.stream > 0.002) { tricT -= dt; while (tricT < 0) { grain(now + Math.random() * 0.05); tricT += (0.3 + Math.random() * 1.4) / Math.max(0.1, S.trickle); } }
    if (cur.wheel > 0.002) { creakT -= dt; slapT -= dt; if (creakT < 0) { creak(now); creakT += S.creak[0] * (0.85 + Math.random() * 0.3); } if (slapT < 0) { slap(now); const p = (cfg.baseWater.wheel && cfg.baseWater.wheel.paddles) || 16; slapT += S.creak[0] / p * 2 * (0.7 + Math.random() * 0.6); } }
  }
  // if the game loop stops calling tick (tab hidden, page torn down), go quiet at once
  if (typeof setInterval === 'function' && typeof window !== 'undefined') setInterval(() => { if (Date.now() - last > 400) { cur.stream = 0; cur.wheel = 0; } if (N && Date.now() - last > 400) { const now = ac.currentTime; N.gs.gain.setTargetAtTime(0, now, 0.05); N.gw.gain.setTargetAtTime(0, now, 0.05); N.gg.gain.setTargetAtTime(0, now, 0.05); } }, 300);
  return { tick, gain: () => cur.stream + cur.wheel, levels: () => Object.assign({}, cur) };
}
