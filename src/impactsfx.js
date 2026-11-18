// IMPACT SOUNDS (owner Nov 18 13:18: "add in audio for impact, especially when shots hit Gloom"). STAGE 1 DRAFT: not imported by main.js yet.
// Everything is made live in Web Audio from oscillators, white noise, filters and gain envelopes (no files, no outside samples).
// Sounds: 'hit' (cannon jet on a Gloom's metal shell), 'head' (hit plus a high ping and screen crack), 'charged' (heavier hit with a short steam sizzle),
// 'destroyed' (a Gloom machine breaking: crunch, spark crackle, its screen powering down), 'shot' (the archerfish cannon firing: brass thunk and water-jet hiss).
// IMPACT_SFX holds every value (Stage 2 can move it to CONFIG.sfx.impact unchanged). impactPlay() works on an AudioContext or an OfflineAudioContext,
// so docs/sample_impact_sfx.mp3 was rendered by this same code. createImpactSfx() is the in-game wrapper (rate limit, distance, pan, phone noise share).

export const IMPACT_SFX = {
  // loudness of every impact sound before distance (gain); the measured peaks are in docs/sample_impact_sfx.md
  vol: 0.5,
  // distance (m) at which the distance gain reaches its floor
  reach: 40,
  // lowest distance gain, so a far hit is still heard
  minGain: 0.3,
  // lowpass cutoff for a sound at 0 m (Hz); far sounds lose their top like real air
  airNear: 16000,
  // lowpass cutoff at 'reach' metres (Hz)
  airFar: 3500,
  // a dip on Marla's voice band so impacts mask her less: centre (Hz)
  dipHz: 1700,
  // depth of that dip (dB, negative = cut)
  dipDb: -7,
  // width of that dip (Q; lower = wider)
  dipQ: 0.7,
  // random pitch change per sound (share: 0.05 = up to 5 percent up or down)
  pitchVar: 0.05,
  // random loudness change per sound (dB, up or down)
  gainVarDb: 1.5,
  // random timing change between the layers of one sound (s)
  timeVar: 0.004,
  // share of the noise layers kept on phones (phone speakers turn noise bursts into crackle; game-audio skill 13f)
  phoneNoise: 0.4,
  // least time between two hit sounds (s); hits closer together wait this long (a charged shot through a line plays one per machine)
  hitGap: 0.045,
  // a hit that would have to wait longer than this (s) is dropped
  hitQueue: 0.25,

  // BODY HIT on a Gloom (metal shell): low thump + metal clank + noise crack
  hit: {
    // thump: start pitch (Hz)
    thumpF0: 150,
    // thump: end pitch (Hz)
    thumpF1: 55,
    // thump: time of the pitch drop (s)
    thumpDrop: 0.08,
    // thump: length of its decay (s)
    thumpLen: 0.16,
    // thump: loudness
    thumpGain: 0.75,
    // thump: saturation drive (adds harmonics so phone and laptop speakers show the low end)
    thumpDrive: 2.6,
    // thump: loudness of the octave-up triangle layer (share of the thump)
    thumpOct: 0.3,
    // clank: lowest partial (Hz)
    clankBase: 640,
    // clank: partial ratios (inharmonic, like a struck steel plate)
    clankRatios: [1, 2.76, 5.4, 8.93, 13.34],
    // clank: loudness of each partial
    clankGains: [0.22, 0.2, 0.26, 0.18, 0.1],
    // clank: decay of the lowest partial (s); higher partials decay faster
    clankDecay: 0.2,
    // clank: how much faster each higher partial decays (decay / (1 + fall x index))
    clankFall: 0.55,
    // clank: random detune of each partial (share)
    clankJitter: 0.025,
    // crack: noise highpass cutoff (Hz)
    crackHz: 2600,
    // crack: length (s)
    crackLen: 0.028,
    // crack: loudness
    crackGain: 0.32,
  },

  // HEAD SHOT: the body hit plus these (a bright ping and the screen cracking)
  head: {
    // delay of the head layers after the body hit (s)
    delay: 0.006,
    // ping: pitch (Hz)
    pingHz: 3150,
    // ping: partial ratios (slightly inharmonic, glassy)
    pingRatios: [1, 2.32, 3.86],
    // ping: loudness of each partial
    pingGains: [0.24, 0.1, 0.05],
    // ping: decay (s)
    pingDecay: 0.32,
    // ping: how much faster the higher partials decay
    pingFall: 0.8,
    // screen crack: number of glass ticks
    crackTicks: 4,
    // screen crack: time over which the ticks fall (s)
    crackSpan: 0.06,
    // screen crack: length of each tick (s)
    crackTick: 0.007,
    // screen crack: bandpass centre (Hz)
    crackHz: 6200,
    // screen crack: bandpass Q
    crackQ: 1.2,
    // screen crack: loudness of the first tick (later ticks are quieter)
    crackGain: 0.5,
    // glitch blip of the screen: start pitch (Hz)
    blipF0: 2300,
    // glitch blip: end pitch (Hz)
    blipF1: 900,
    // glitch blip: length (s)
    blipLen: 0.05,
    // glitch blip: loudness (square wave, so keep it low)
    blipGain: 0.05,
    // body layers of a head shot play at this share (the ping carries the difference)
    bodyShare: 0.85,
  },

  // CHARGED SHOT HIT: the body hit made heavier (these scale it) plus a steam sizzle
  charged: {
    // pitch of thump and clank (share of the body hit)
    pitch: 0.78,
    // decay lengths (share of the body hit)
    length: 1.6,
    // loudness (share of the body hit)
    gain: 1.12,
    // sizzle: delay after the hit (s)
    sizzleDelay: 0.02,
    // sizzle: length (s)
    sizzleLen: 0.38,
    // sizzle: bandpass centre at the start (Hz)
    sizzleF0: 5200,
    // sizzle: bandpass centre at the end (Hz)
    sizzleF1: 3600,
    // sizzle: bandpass Q
    sizzleQ: 1.4,
    // sizzle: loudness
    sizzleGain: 0.3,
    // sizzle: crackle rate at the start (Hz, square flutter)
    sizzleRate0: 46,
    // sizzle: crackle rate at the end (Hz)
    sizzleRate1: 17,
    // sizzle: flutter depth (0..1)
    sizzleDepth: 0.6,
  },

  // GLOOM DESTROYED (machines only; devices and panels keep sfxBreak): crunch + spark crackle + screen power-down whine
  destroyed: {
    // thump: start pitch (Hz)
    thumpF0: 120,
    // thump: end pitch (Hz)
    thumpF1: 36,
    // thump: time of the pitch drop (s)
    thumpDrop: 0.14,
    // thump: decay (s)
    thumpLen: 0.32,
    // thump: loudness
    thumpGain: 0.85,
    // thump: saturation drive
    thumpDrive: 3.2,
    // thump: octave-up layer share
    thumpOct: 0.35,
    // clanks: lowest partial of each clank (Hz); one clank per entry
    clankBases: [430, 610, 520],
    // clanks: start time of each clank (s)
    clankAt: [0, 0.032, 0.07],
    // clanks: loudness of each clank
    clankGain: [1, 0.75, 0.55],
    // clanks: partial ratios
    clankRatios: [1, 2.76, 5.4, 8.93],
    // clanks: loudness of each partial
    clankGains: [0.2, 0.18, 0.2, 0.12],
    // clanks: decay of the lowest partial (s)
    clankDecay: 0.3,
    // clanks: faster decay of higher partials
    clankFall: 0.6,
    // crunch: grains of filtered noise in the first moment
    crunchGrains: 7,
    // crunch: time span of the grains (s)
    crunchSpan: 0.14,
    // crunch: length of each grain (s)
    crunchGrain: 0.03,
    // crunch: bandpass centre (Hz)
    crunchHz: 1500,
    // crunch: bandpass Q
    crunchQ: 0.6,
    // crunch: loudness of a grain
    crunchGain: 0.55,
    // sparks: number of crackle ticks
    sparks: 22,
    // sparks: first tick (s)
    sparkFrom: 0.05,
    // sparks: last tick (s)
    sparkTo: 0.75,
    // sparks: thinning of the ticks over time (power; higher = more early ticks)
    sparkBunch: 1.8,
    // sparks: length of a tick (s)
    sparkTick: 0.004,
    // sparks: highpass cutoff (Hz)
    sparkHz: 4200,
    // sparks: loudness of the loudest tick
    sparkGain: 0.38,
    // whine: start time (s)
    whineAt: 0.06,
    // whine: start pitch (Hz)
    whineF0: 1250,
    // whine: end pitch (Hz)
    whineF1: 70,
    // whine: length (s)
    whineLen: 0.8,
    // whine: loudness
    whineGain: 0.11,
    // whine: lowpass on its sawtooth (Hz)
    whineLp: 2600,
    // whine: flicker rate at the start (Hz, the screen dying)
    flick0: 24,
    // whine: flicker rate at the end (Hz)
    flick1: 5,
    // whine: flicker depth (0..1)
    flickDepth: 0.55,
  },

  // THE CANNON SHOT (the player's own, not panned): brass thunk + water-jet hiss
  shot: {
    // loudness of the whole shot (share of vol)
    gain: 0.8,
    // thunk: start pitch (Hz)
    thunkF0: 270,
    // thunk: end pitch (Hz)
    thunkF1: 105,
    // thunk: time of the pitch drop (s)
    thunkDrop: 0.05,
    // thunk: decay (s)
    thunkLen: 0.11,
    // thunk: loudness
    thunkGain: 0.6,
    // thunk: saturation drive
    thunkDrive: 3,
    // thunk: octave-up layer share
    thunkOct: 0.25,
    // brass ring: lowest partial (Hz)
    brassBase: 330,
    // brass ring: partial ratios (near harmonic, a short brass tube)
    brassRatios: [1, 2, 3.01, 4.03],
    // brass ring: loudness of each partial
    brassGains: [0.16, 0.12, 0.08, 0.05],
    // brass ring: decay (s)
    brassDecay: 0.1,
    // brass ring: faster decay of higher partials
    brassFall: 0.4,
    // jet hiss: bandpass centre at the start (Hz)
    jetF0: 7200,
    // jet hiss: bandpass centre at the end (Hz)
    jetF1: 2800,
    // jet hiss: bandpass Q
    jetQ: 0.8,
    // jet hiss: length (s)
    jetLen: 0.17,
    // jet hiss: attack (s)
    jetAttack: 0.004,
    // jet hiss: loudness
    jetGain: 0.42,
    // pressure puff: lowpass noise cutoff at the start (Hz)
    puffF0: 1400,
    // pressure puff: cutoff at the end (Hz)
    puffF1: 300,
    // pressure puff: length (s)
    puffLen: 0.06,
    // pressure puff: loudness
    puffGain: 0.4,
  },
};

const NOISE = new WeakMap();
const CURVES = new Map();
function noiseBuf(a) { let b = NOISE.get(a); if (b) return b; b = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; NOISE.set(a, b); return b; }
function curve(drive) { let c = CURVES.get(drive); if (c) return c; c = new Float32Array(1024); const n = Math.tanh(drive); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(drive * x) / n; } CURVES.set(drive, c); return c; }
function env(g, t, peak, attack, len) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + len); }

// a pitch-dropping thump, saturated for harmonics, plus a triangle an octave up; returns its end time
function thump(a, d, t, f0, f1, drop, len, gain, drive, oct) {
  const o = a.createOscillator(), o2 = a.createOscillator(), sh = a.createWaveShaper(), g = a.createGain(), g2 = a.createGain();
  o.type = 'sine'; o2.type = 'triangle'; sh.curve = curve(drive);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + drop);
  o2.frequency.setValueAtTime(f0 * 2, t); o2.frequency.exponentialRampToValueAtTime(f1 * 2, t + drop);
  env(g, t, gain, 0.002, len); env(g2, t, gain * oct, 0.002, len * 0.6);
  o.connect(sh); sh.connect(g); g.connect(d); o2.connect(g2); g2.connect(d);
  const end = t + len + 0.01; o.start(t); o2.start(t); o.stop(end); o2.stop(end); return end;
}
// struck metal or glass: decaying sine partials; returns its end time
function partials(a, d, t, base, ratios, gains, decay, fall, jitter, k, rnd) {
  let end = t;
  ratios.forEach((r, i) => { const o = a.createOscillator(), g = a.createGain(), len = decay / (1 + fall * i), f = base * r * (1 + jitter * (rnd() * 2 - 1));
    if (f >= a.sampleRate * 0.45) return; o.type = 'sine'; o.frequency.value = f; env(g, t, gains[i] * k, 0.0012, len); o.connect(g); g.connect(d); o.start(t); o.stop(t + len + 0.01); end = Math.max(end, t + len + 0.01); });
  return end;
}
// a filtered noise burst with a swept cutoff; returns { g, end } (g = its gain node, for extra shaping)
function noise(a, d, t, type, f0, f1, q, len, gain, attack, rnd) {
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf(a); s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + len);
  env(g, t, gain, attack, len); s.connect(f); f.connect(g); g.connect(d);
  s.start(t, rnd() * 0.9); s.stop(t + attack + len + 0.01); return { g, end: t + attack + len + 0.01 };
}
// separate short ticks from one noise source (crackle, sparks, glass); times must be sorted; returns its end time
function ticks(a, d, t, times, gains, tick, type, hz, q, rnd) {
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf(a); s.loop = true; f.type = type; f.frequency.value = hz; f.Q.value = q; g.gain.setValueAtTime(0, t);
  let last = t, end = t;
  times.forEach((ti, i) => { const at = Math.max(t + ti, last + 0.0005); g.gain.setValueAtTime(Math.max(0.0002, gains[i]), at); g.gain.exponentialRampToValueAtTime(0.0001, at + tick); g.gain.setValueAtTime(0, at + tick + 0.0002); last = at + tick + 0.0003; end = last; });
  s.connect(f); f.connect(g); g.connect(d); s.start(t, rnd() * 0.9); s.stop(end + 0.01); return end + 0.01;
}
// a gain that flutters from rate r0 to r1 (Hz) with the given depth; connect a layer into .in, it plays into d; returns the input node
function flutter(a, d, t, len, r0, r1, depth) {
  const amp = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
  amp.gain.value = 1 - depth / 2; lfo.type = 'square'; lfo.frequency.setValueAtTime(r0, t); lfo.frequency.exponentialRampToValueAtTime(r1, t + len); lg.gain.value = depth / 2;
  lfo.connect(lg); lg.connect(amp.gain); amp.connect(d); lfo.start(t); lfo.stop(t + len + 0.02); return amp;
}

// the output chain of one sound: gain (vol, distance, variation) -> voice-band dip -> air lowpass -> pan -> dest. po = { pan (-1..1), dist (m) }
export function impactOut(a, dest, po, C, gain) {
  const dist = Math.max(0, (po && po.dist) || 0), pan = Math.max(-1, Math.min(1, (po && po.pan) || 0)), near = Math.min(1, dist / C.reach);
  const g = a.createGain(), dip = a.createBiquadFilter(), air = a.createBiquadFilter();
  g.gain.value = C.vol * gain * Math.max(C.minGain, 1 - near);
  dip.type = 'peaking'; dip.frequency.value = C.dipHz; dip.Q.value = C.dipQ; dip.gain.value = C.dipDb;
  air.type = 'lowpass'; air.Q.value = 0.5; air.frequency.value = C.airNear * Math.pow(C.airFar / C.airNear, near);
  g.connect(dip); dip.connect(air); let last = air;
  if (a.createStereoPanner) { const sp = a.createStereoPanner(); sp.pan.value = pan; air.connect(sp); last = sp; }
  last.connect(dest || a.destination); return g;
}

// plays one impact sound at time t into dest (null = speakers). kind: 'hit' | 'head' | 'charged' | 'destroyed' | 'shot'.
// opt: { po: { pan, dist }, C: IMPACT_SFX, rnd: () => 0..1, phone: true for the phone noise share }. Returns the time the sound ends.
export function impactPlay(a, dest, kind, t, opt) {
  const o = opt || {}, C = o.C || IMPACT_SFX, rnd = o.rnd || Math.random, nk = o.phone ? C.phoneNoise : 1;
  const pv = 1 + C.pitchVar * (rnd() * 2 - 1), gv = Math.pow(10, (C.gainVarDb * (rnd() * 2 - 1)) / 20), jt = () => t + C.timeVar * rnd();
  const H = C.hit;
  if (kind === 'shot') {
    const S = C.shot, out = impactOut(a, dest, { pan: 0, dist: 0 }, C, S.gain * gv);
    let end = thump(a, out, t, S.thunkF0 * pv, S.thunkF1 * pv, S.thunkDrop, S.thunkLen, S.thunkGain, S.thunkDrive, S.thunkOct);
    end = Math.max(end, partials(a, out, jt(), S.brassBase * pv, S.brassRatios, S.brassGains, S.brassDecay, S.brassFall, 0.004, 1, rnd));
    end = Math.max(end, noise(a, out, t, 'bandpass', S.jetF0 * pv, S.jetF1 * pv, S.jetQ, S.jetLen, S.jetGain * nk, S.jetAttack, rnd).end);
    end = Math.max(end, noise(a, out, t, 'lowpass', S.puffF0, S.puffF1, 0.7, S.puffLen, S.puffGain * nk, 0.002, rnd).end);
    return end;
  }
  if (kind === 'destroyed') {
    const D = C.destroyed, out = impactOut(a, dest, o.po, C, gv);
    let end = thump(a, out, t, D.thumpF0 * pv, D.thumpF1 * pv, D.thumpDrop, D.thumpLen, D.thumpGain, D.thumpDrive, D.thumpOct);
    D.clankBases.forEach((b, i) => { end = Math.max(end, partials(a, out, t + D.clankAt[i] + C.timeVar * rnd(), b * pv * (1 + 0.04 * (rnd() * 2 - 1)), D.clankRatios, D.clankGains, D.clankDecay, D.clankFall, H.clankJitter, D.clankGain[i], rnd)); });
    const ct = [], cg = []; for (let i = 0; i < D.crunchGrains; i++) { ct.push(D.crunchSpan * (i / D.crunchGrains) + 0.008 * rnd()); cg.push(D.crunchGain * nk * (1 - 0.6 * i / D.crunchGrains) * (0.6 + 0.4 * rnd())); }
    end = Math.max(end, ticks(a, out, t, ct, cg, D.crunchGrain, 'bandpass', D.crunchHz * pv, D.crunchQ, rnd));
    const st = [], sg = []; for (let i = 0; i < D.sparks; i++) st.push(D.sparkFrom + (D.sparkTo - D.sparkFrom) * Math.pow(rnd(), D.sparkBunch)); st.sort((x, y) => x - y);
    st.forEach((x) => sg.push(D.sparkGain * nk * (0.25 + 0.75 * rnd()) * (1 - 0.7 * (x - D.sparkFrom) / (D.sparkTo - D.sparkFrom))));
    end = Math.max(end, ticks(a, out, t, st, sg, D.sparkTick, 'highpass', D.sparkHz, 0.7, rnd));
    const wt = t + D.whineAt, w = a.createOscillator(), wl = a.createBiquadFilter(), wg = a.createGain(), fl = flutter(a, out, wt, D.whineLen, D.flick0, D.flick1, D.flickDepth);
    w.type = 'sawtooth'; w.frequency.setValueAtTime(D.whineF0 * pv, wt); w.frequency.exponentialRampToValueAtTime(D.whineF1 * pv, wt + D.whineLen); wl.type = 'lowpass'; wl.frequency.value = D.whineLp;
    wg.gain.setValueAtTime(0.0001, wt); wg.gain.exponentialRampToValueAtTime(D.whineGain, wt + 0.02); wg.gain.setValueAtTime(D.whineGain, wt + D.whineLen * 0.35); wg.gain.exponentialRampToValueAtTime(0.0001, wt + D.whineLen);
    w.connect(wl); wl.connect(wg); wg.connect(fl); w.start(wt); w.stop(wt + D.whineLen + 0.02);
    return Math.max(end, wt + D.whineLen + 0.02);
  }
  const ch = kind === 'charged', hd = kind === 'head', X = C.charged, P = C.head;
  const pk = ch ? X.pitch : 1, lk = ch ? X.length : 1, gk = (ch ? X.gain : 1) * (hd ? P.bodyShare : 1);
  const out = impactOut(a, dest, o.po, C, gv);
  let end = thump(a, out, t, H.thumpF0 * pv * pk, H.thumpF1 * pv * pk, H.thumpDrop * lk, H.thumpLen * lk, H.thumpGain * gk, H.thumpDrive * (ch ? 1.25 : 1), H.thumpOct);
  end = Math.max(end, partials(a, out, jt(), H.clankBase * pv * pk, H.clankRatios, H.clankGains, H.clankDecay * lk, H.clankFall, H.clankJitter, gk, rnd));
  end = Math.max(end, noise(a, out, jt(), 'highpass', H.crackHz * pv, H.crackHz * pv * 0.8, 0.7, H.crackLen * lk, H.crackGain * gk * nk, 0.0015, rnd).end);
  if (hd) {
    const ht = t + P.delay;
    end = Math.max(end, partials(a, out, ht, P.pingHz * pv, P.pingRatios, P.pingGains, P.pingDecay, P.pingFall, 0.006, 1, rnd));
    const tt = [], tg = []; for (let i = 0; i < P.crackTicks; i++) { tt.push(i === 0 ? 0 : P.crackSpan * (i / P.crackTicks) * (0.6 + 0.8 * rnd())); tg.push(P.crackGain * nk * (1 - 0.6 * i / P.crackTicks)); } tt.sort((x, y) => x - y);
    end = Math.max(end, ticks(a, out, ht, tt, tg, P.crackTick, 'bandpass', P.crackHz * pv, P.crackQ, rnd));
    const b = a.createOscillator(), bg = a.createGain(); b.type = 'square'; b.frequency.setValueAtTime(P.blipF0 * pv, ht); b.frequency.exponentialRampToValueAtTime(P.blipF1 * pv, ht + P.blipLen);
    env(bg, ht, P.blipGain, 0.002, P.blipLen); b.connect(bg); bg.connect(out); b.start(ht); b.stop(ht + P.blipLen + 0.01); end = Math.max(end, ht + P.blipLen + 0.01);
  }
  if (ch) {
    const zt = t + X.sizzleDelay, fl = flutter(a, out, zt, X.sizzleLen, X.sizzleRate0, X.sizzleRate1, X.sizzleDepth);
    end = Math.max(end, noise(a, fl, zt, 'bandpass', X.sizzleF0, X.sizzleF1, X.sizzleQ, X.sizzleLen, X.sizzleGain * nk, 0.006, rnd).end);
  }
  return end;
}

// the in-game wrapper. audio() returns the running AudioContext or null; cfg() returns the IMPACT_SFX block; phone() is true on phones.
// hit(po, head) and charged(po) share one queue (hitGap apart, dropped past hitQueue); destroyed(po) and shot() always play.
export function createImpactSfx(audio, cfg, phone) {
  let nextHit = 0;
  const C = () => (cfg && cfg()) || IMPACT_SFX;
  const go = (kind, po, t) => { const a = audio(); if (!a) return 0; try { return impactPlay(a, null, kind, t === undefined ? a.currentTime + 0.003 : t, { po, C: C(), phone: !!(phone && phone()) }); } catch (e) { return 0; } };
  const queued = (kind, po) => { const a = audio(); if (!a) return 0; const now = a.currentTime + 0.003, t = Math.max(now, nextHit); if (t - now > C().hitQueue) return 0; nextHit = t + C().hitGap; return go(kind, po, t); };
  return { shot: () => go('shot', { pan: 0, dist: 0 }), hit: (po, head) => queued(head ? 'head' : 'hit', po), charged: (po) => queued('charged', po), destroyed: (po) => go('destroyed', po) };
}
