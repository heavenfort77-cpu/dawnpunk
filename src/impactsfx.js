// IMPACT SOUNDS, ROUND 2 (owner Nov 18 13:28 on round 1: "sounds like an arcade game, not matching the tone of the game"). STAGE 1 SAMPLE: not imported by main.js yet.
// Round 1 is kept as src/impactsfx_round1.js and docs/sample_impact_sfx_round1.mp3.
// Film/foley approach: every layer is shaped noise. There are no oscillators and no pitched sweeps. Metal and glass come from damped modal resonances: bandpass resonators struck by short
// noise impulses (Q sets how fast a mode dies). A generated small-room impulse response puts each hit in the space (drier outdoors).
// Sounds: 'shot' (pressurised water jet release + brass valve clack), 'hit' (water slap and spray on dented sheet metal + loose panel rattle),
// 'head' (the hit + a brittle screen crack + electrical static), 'charged' (a heavier water impact + steam hiss on hot metal),
// 'destroyed' (a machine slumping: several dull clanks settling, its screen's static fading out, a few sparks).
// IMPACT_SFX holds every value (Stage 2 can move it to CONFIG.sfx.impact unchanged). impactPlay() works on an AudioContext or an OfflineAudioContext,
// so docs/sample_impact_sfx.mp3 was rendered by this same code. createImpactSfx() is the in-game wrapper (rate limit, distance, pan, phone noise share).
// Phones (opt.phone): the bright noise layers play at phoneNoise, the crackle grains are cut to phoneGrains of their count, and everything passes a phoneLp lowpass.

export const IMPACT_SFX = {
  // variants (LAG FIX Nov 19): sources rendered ahead per kind of sound, each with its own random draws (0 = build every sound live as before)
  variants: 8,
  // renderMax: longest a kind's sources can last (s), the length each variant is rendered at before it is cut to its real end
  renderMax: 3.5,
  // loudness of every impact sound before distance (gain); set so the loudest 50 ms of every sound stays under the music's 95th-percentile 50 ms level (docs/sample_impact_sfx.md)
  vol: 0.33,
  // distance (m) at which the distance gain reaches its floor
  reach: 40,
  // lowest distance gain, so a far hit is still heard
  minGain: 0.3,
  // lowpass cutoff for a sound at 0 m (Hz); far sounds lose their top like real air
  airNear: 15000,
  // lowpass cutoff at 'reach' metres (Hz)
  airFar: 3000,
  // a dip on Marla's voice band so impacts mask her less: centre (Hz)
  dipHz: 1700,
  // depth of that dip (dB, negative = cut)
  dipDb: -5,
  // width of that dip (Q; lower = wider)
  dipQ: 0.7,
  // random change of every resonance and filter frequency per sound (share: 0.04 = up to 4 percent)
  pitchVar: 0.04,
  // random loudness change per sound (dB, up or down)
  gainVarDb: 1.5,
  // share of the high noise layers (spray, hiss, static, sparks) kept on phones (phone speakers turn bright noise into crackle; game-audio skill 13f)
  phoneNoise: 0.5,
  // share of the crackle grains kept on phones (droplets, static bursts, sizzle, sparks; fewer separate clicks)
  phoneGrains: 0.5,
  // lowpass on every impact sound on phones (Hz; rounds off the click edges a phone speaker turns into crackle)
  phoneLp: 6000,
  // least time between two hit sounds (s); hits closer together wait this long (a charged shot through a line plays one per machine)
  hitGap: 0.045,
  // a hit that would have to wait longer than this (s) is dropped
  hitQueue: 0.25,
  // peak softener on every sound: level where it starts to round off the rare sharp spikes of ticks and knocks (0..1, before the pan)
  limitKnee: 0.35,
  // highest level it lets through (0..1, before the pan; the centre pan lowers each side by a further 3 dB)
  limitCeil: 0.7,

  // THE ROOM: a generated impulse response shared by every sound
  room: {
    // reverb time inside a house (s, RT60)
    rt60In: 0.42,
    // reverb time outdoors (s; streets between houses)
    rt60Out: 0.3,
    // reverb send inside (gain; the impulse response has unit energy)
    wetIn: 0.32,
    // reverb send outdoors
    wetOut: 0.09,
    // early reflections inside: [delay (s), gain] pairs (walls and floor of a small room)
    early: [[0.006, 0.55], [0.011, 0.4], [0.017, 0.33], [0.024, 0.25], [0.031, 0.18]],
    // brightness of the tail at its start (Hz)
    dampFrom: 6000,
    // brightness of the tail at its end (Hz)
    dampTo: 900,
    // extra send for far sounds (share added per 'reach' of distance; far hits sound more in the room)
    farWet: 0.6,
  },

  // BODY HIT: water slapping onto a Gloom's dented sheet-metal shell
  hit: {
    // wet slap: bandpass noise centre at the start (Hz)
    slapF0: 1150,
    // wet slap: centre at the end (Hz)
    slapF1: 650,
    // wet slap: Q
    slapQ: 0.9,
    // wet slap: length (s)
    slapLen: 0.035,
    // wet slap: loudness
    slapGain: 3.58,
    // splash: highpass noise cutoff at the start (Hz)
    splashF0: 3200,
    // splash: cutoff at the end (Hz)
    splashF1: 1900,
    // splash: attack (s)
    splashAttack: 0.003,
    // splash: length (s)
    splashLen: 0.15,
    // splash: loudness
    splashGain: 0.341,
    // spray: number of droplet grains
    spray: 18,
    // spray: time span of the droplets (s)
    spraySpan: 0.2,
    // spray: length of a droplet (s)
    sprayGrain: 0.0025,
    // spray: bandpass centre of the droplets (Hz)
    sprayHz: 3600,
    // spray: bandpass Q
    sprayQ: 1.2,
    // spray: loudness of the first droplet (later ones are quieter)
    sprayGain: 3.57,
    // thud: length of the knock on the metal (s; shorter = brighter strike)
    strikeLen: 0.0022,
    // thud: lowpass on the strike (Hz; lower = softer, duller strike)
    strikeLp: 2200,
    // thud: loudness of the strike into the resonances
    strikeGain: 1.91,
    // thud: resonances of the dented panel (Hz)
    modes: [118, 187, 263, 349, 446, 571, 760],
    // thud: Q of each resonance (higher = rings longer; these are heavily damped)
    modeQ: [5, 6, 8, 9, 9, 10, 11],
    // thud: loudness of each resonance
    modeGain: [1, 0.85, 0.75, 0.6, 0.45, 0.35, 0.25],
    // weight: lowpass noise cutoff at the start (Hz)
    weightF0: 280,
    // weight: cutoff at the end (Hz)
    weightF1: 120,
    // weight: length (s)
    weightLen: 0.07,
    // weight: loudness
    weightGain: 4.51,
    // rattle: number of loose-panel knocks
    rattle: 4,
    // rattle: first knock (s)
    rattleFrom: 0.035,
    // rattle: last knock (s)
    rattleTo: 0.13,
    // rattle: resonances of the loose panel (Hz)
    rattleModes: [930, 1460, 2240],
    // rattle: Q of those resonances
    rattleQ: [16, 18, 20],
    // rattle: loudness of the first knock
    rattleGain: 20.6,
    // rattle: the knocks alternate between two loose panels; the second one's resonances are this share of the first's (no single ringing pitch)
    rattleSpread: 1.14,
  },

  // HEAD SHOT: the body hit plus a brittle screen crack and electrical static
  head: {
    // delay of the head layers after the body hit (s)
    delay: 0.004,
    // body layers of a head shot play at this share
    bodyShare: 0.85,
    // crack: number of glass fracture ticks
    crackTicks: 10,
    // crack: time span of the ticks (s)
    crackSpan: 0.04,
    // crack: length of a tick (s)
    crackTick: 0.0015,
    // crack: highpass on the ticks (Hz)
    crackHp: 2600,
    // crack: loudness of the first tick
    crackGain: 4.86,
    // crack: tiny glass resonances (Hz)
    glassModes: [2950, 4370, 5830, 7690],
    // crack: Q of the glass resonances
    glassQ: [28, 30, 32, 34],
    // crack: loudness of the glass resonances (struck by the same ticks)
    glassGain: 23.9,
    // static: number of crackle bursts
    fizz: 46,
    // static: first burst (s)
    fizzFrom: 0.02,
    // static: last burst (s)
    fizzTo: 0.32,
    // static: how fast it fades over that time (power; lower = holds longer)
    fizzFade: 0.7,
    // static: length of a burst (s)
    fizzGrain: 0.004,
    // static: bandpass centre (Hz)
    fizzHz: 2600,
    // static: bandpass Q
    fizzQ: 0.6,
    // static: loudness of the loudest burst
    fizzGain: 3.41,
  },

  // CHARGED SHOT HIT: the body hit made heavier (these scale it) plus steam hissing on hot metal
  charged: {
    // resonance and filter frequencies (share of the body hit)
    pitch: 0.85,
    // lengths (share of the body hit)
    length: 1.5,
    // loudness of the body layers (share of the body hit)
    gain: 1,
    // more droplets (share of the body hit's count)
    spray: 1.7,
    // steam: delay after the hit (s)
    steamAt: 0.015,
    // steam: bandpass centre at the start (Hz)
    steamF0: 5600,
    // steam: centre at the end (Hz)
    steamF1: 3900,
    // steam: bandpass Q
    steamQ: 0.5,
    // steam: attack (s)
    steamAttack: 0.035,
    // steam: length (s)
    steamLen: 0.55,
    // steam: loudness
    steamGain: 0.371,
    // sizzle: number of small crackles in the steam
    sizzle: 26,
    // sizzle: length of a crackle (s)
    sizzleGrain: 0.002,
    // sizzle: highpass (Hz)
    sizzleHp: 3200,
    // sizzle: loudness of the loudest crackle
    sizzleGain: 1.09,
  },

  // GLOOM DESTROYED (machines only; devices and panels keep sfxBreak): the body slumps and settles, the screen's static dies, a few sparks
  destroyed: {
    // collapse: time of each dull clank (s); the first is the hit that kills it
    clankAt: [0, 0.17, 0.3, 0.49, 0.74],
    // collapse: loudness of each clank
    clankGain: [1, 0.62, 0.48, 0.32, 0.2],
    // collapse: resonance scale of each clank (different parts of the body hit the floor)
    clankScale: [0.8, 1.3, 0.95, 1.6, 1.15],
    // collapse: lowpass on each clank's strike (Hz)
    clankLp: [1800, 2400, 2000, 2800, 2600],
    // collapse: resonances of the body (Hz, scaled per clank)
    modes: [104, 166, 231, 318, 409, 540, 702],
    // collapse: Q of each resonance
    modeQ: [5, 6, 7, 8, 9, 10, 11],
    // collapse: loudness of each resonance
    modeGain: [1, 0.85, 0.75, 0.6, 0.45, 0.35, 0.25],
    // collapse: strike loudness into the resonances
    strikeGain: 2.29,
    // collapse: length of a strike (s)
    strikeLen: 0.0026,
    // rumble: lowpass noise cutoff at the start (Hz)
    rumbleF0: 320,
    // rumble: cutoff at the end (Hz)
    rumbleF1: 90,
    // rumble: length (s)
    rumbleLen: 0.4,
    // rumble: loudness
    rumbleGain: 1.8,
    // crunch: grains of torn sheet metal in the first moment
    crunch: 7,
    // crunch: time span (s)
    crunchSpan: 0.09,
    // crunch: length of a grain (s)
    crunchGrain: 0.012,
    // crunch: bandpass centre (Hz)
    crunchHz: 1300,
    // crunch: bandpass Q
    crunchQ: 0.7,
    // crunch: loudness of the first grain
    crunchGain: 3.37,
    // settling: number of small knocks as it comes to rest
    settle: 7,
    // settling: first knock (s)
    settleFrom: 0.82,
    // settling: last knock (s)
    settleTo: 1.25,
    // settling: resonances of the small parts (Hz)
    settleModes: [880, 1390, 2150],
    // settling: Q of those resonances
    settleQ: [14, 16, 18],
    // settling: loudness of the first knock
    settleGain: 19.2,
    // settling: the knocks alternate between two small parts; the second one's resonances are this share of the first's
    settleSpread: 0.86,
    // static: first burst (s)
    staticFrom: 0.03,
    // static: last burst (s)
    staticTo: 0.95,
    // static: number of bursts (it breaks up as the screen dies)
    staticBursts: 26,
    // static: length of a burst at the start (s)
    staticGrain0: 0.03,
    // static: length of a burst at the end (s)
    staticGrain1: 0.008,
    // static: bandpass centre at the start (Hz)
    staticF0: 3800,
    // static: centre at the end (Hz)
    staticF1: 1600,
    // static: bandpass Q
    staticQ: 0.45,
    // static: loudness of the first burst (it fades out)
    staticGain: 0.86,
    // sparks: number of crackles
    sparks: 6,
    // sparks: first (s)
    sparkFrom: 0.08,
    // sparks: last (s)
    sparkTo: 1.0,
    // sparks: length of a crackle (s)
    sparkGrain: 0.0018,
    // sparks: highpass (Hz)
    sparkHp: 4500,
    // sparks: loudness of the loudest crackle
    sparkGain: 2.91,
  },

  // THE CANNON SHOT (the player's own, not panned): a pressurised water jet released through a brass valve
  shot: {
    // loudness of the whole shot (share of vol)
    gain: 1,
    // room send of the shot (share of the room's send; it is at the player's hands)
    wet: 0.6,
    // jet: bandpass noise centre at the start (Hz)
    jetF0: 4600,
    // jet: centre at the end (Hz)
    jetF1: 2300,
    // jet: bandpass Q
    jetQ: 0.6,
    // jet: attack (s)
    jetAttack: 0.004,
    // jet: length (s)
    jetLen: 0.2,
    // jet: loudness
    jetGain: 0.815,
    // air push: lowpass noise cutoff at the start (Hz)
    pushF0: 900,
    // air push: cutoff at the end (Hz)
    pushF1: 240,
    // air push: length (s)
    pushLen: 0.05,
    // air push: loudness
    pushGain: 2.92,
    // wet edge: number of droplet grains as the jet leaves the nozzle
    drops: 14,
    // wet edge: time span of the droplets (s)
    dropSpan: 0.17,
    // wet edge: length of a droplet (s)
    dropGrain: 0.003,
    // wet edge: bandpass centres of the two droplet layers (Hz)
    dropHz: [2500, 5200],
    // wet edge: loudness of the first droplet
    dropGain: 2.74,
    // valve clack: brass resonances (Hz)
    valveModes: [1180, 2470, 3720, 5310],
    // valve clack: Q of those resonances
    valveQ: [18, 22, 20, 16],
    // valve clack: loudness of each resonance
    valveGains: [1, 0.7, 0.5, 0.3],
    // valve clack: strike loudness
    valveGain: 28,
    // valve clack: lowpass on the strike (Hz)
    valveLp: 7000,
    // valve clack: the valve reseats this long after firing (s)
    reseatAt: 0.06,
    // valve clack: loudness of the reseat (share of the first clack)
    reseat: 0.45,
  },
};

const NOISE = new WeakMap();
const SOFT = new Map();
// the peak softener's curve: straight below the knee, then a tanh bend that never passes the ceiling
function softCurve(k, c) { const key = k + ':' + c; let v = SOFT.get(key); if (v) return v; v = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1, m = Math.abs(x); v[i] = Math.sign(x) * (m <= k ? m : k + (c - k) * Math.tanh((m - k) / (c - k))); } SOFT.set(key, v); return v; }
const ROOMS = new WeakMap();
function noiseBuf(a) { let b = NOISE.get(a); if (b) return b; b = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; NOISE.set(a, b); return b; }
function env(g, t, peak, attack, len) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + len); }
const PULSES = new WeakMap();
// a smooth one-off knock (raised-cosine pulse, len seconds) that strikes the resonances the same way each time; noise on top gives each strike its texture
function pulseBuf(a, len) { let m = PULSES.get(a); if (!m) { m = new Map(); PULSES.set(a, m); } const n = Math.max(2, Math.round(len * a.sampleRate)); let b = m.get(n); if (b) return b; b = a.createBuffer(1, n, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n); m.set(n, b); return b; }
function src(a, t, stop, rnd) { const s = a.createBufferSource(); s.buffer = noiseBuf(a); s.loop = true; s.start(t, rnd() * 0.9); s.stop(stop); return s; }

// a noise burst through a filter whose cutoff glides from f0 to f1; returns its end time
function burst(a, d, t, type, f0, f1, q, attack, len, gain, rnd) {
  const f = a.createBiquadFilter(), g = a.createGain(), end = t + attack + len + 0.01, s = src(a, t, end, rnd);
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + attack + len);
  env(g, t, gain, attack, len); s.connect(f); f.connect(g); g.connect(d); return end;
}
// short separate noise grains from one source through one filter (droplets, ticks, crackle, static); lens may be a number or a list; returns the end time
function grains(a, d, t, times, gains, lens, type, hz, q, rnd) {
  const f = a.createBiquadFilter(), g = a.createGain(); f.type = type; f.Q.value = q;
  if (Array.isArray(hz)) { f.frequency.setValueAtTime(hz[0], t); f.frequency.exponentialRampToValueAtTime(hz[1], t + times[times.length - 1] + 0.01); } else f.frequency.value = hz;
  g.gain.setValueAtTime(0, t); let last = t;
  times.forEach((ti, i) => { const len = Array.isArray(lens) ? lens[i] : lens, at = Math.max(t + ti, last + 0.0004); g.gain.setValueAtTime(Math.max(0.0002, gains[i]), at); g.gain.exponentialRampToValueAtTime(0.0001, at + len); g.gain.setValueAtTime(0, at + len + 0.0002); last = at + len + 0.0003; });
  const s = src(a, t, last + 0.02, rnd); s.connect(f); f.connect(g); g.connect(d); return last + 0.02;
}
// a bank of damped resonances (bandpass filters in parallel) playing into d; returns its input node (strike it with noise)
function resonator(a, d, freqs, qs, gains, k) {
  const inp = a.createGain();
  freqs.forEach((f, i) => { if (f * k >= a.sampleRate * 0.45) return; const b = a.createBiquadFilter(), g = a.createGain(); b.type = 'bandpass'; b.frequency.value = f * k; b.Q.value = qs[i]; g.gain.value = gains[i]; inp.connect(b); b.connect(g); g.connect(d); });
  return inp;
}
// a strike into a resonator bank: a smooth knock of length len plus lowpassed noise (share 'grit' of it); the ring time follows Q (about Q / (pi f) per e-fold); returns the end time
function strike(a, d, t, len, lp, gain, freqs, qs, gains, k, rnd, grit) {
  const r = resonator(a, d, freqs, qs, gains, k), f = a.createBiquadFilter(), g = a.createGain(), end = t + len + 0.01, s = src(a, t, end, rnd), p = a.createBufferSource(), pg = a.createGain();
  p.buffer = pulseBuf(a, len); pg.gain.value = gain; p.connect(pg); pg.connect(r); p.start(t);
  f.type = 'lowpass'; f.frequency.value = lp; env(g, t, gain * (grit === undefined ? 0.3 : grit), 0.0008, len); s.connect(f); f.connect(g); g.connect(r);
  const ring = Math.max(...freqs.map((fr, i) => (qs[i] / (Math.PI * fr * k)) * 7)); return end + ring;
}
// small knocks (3 ms lowpassed noise grains) that alternate between two resonator banks, the second scaled by 'spread' (two loose parts); returns the end time
function alternate(a, d, t, tms, gns, freqs, qs, gains, k, spread, lp, rnd) {
  let end = t;
  for (let j = 0; j < 2; j++) { const ix = tms.map((x, i) => i).filter((i) => i % 2 === j); if (!ix.length) continue;
    const r = resonator(a, d, freqs, qs, gains, k * (j ? spread : 1)); end = Math.max(end, grains(a, r, t, ix.map((i) => tms[i]), ix.map((i) => gns[i]), 0.003, 'lowpass', lp, 0.7, rnd)); }
  return end;
}
// sorted random times between from and to, bunched early by 'bunch' (1 = even)
function times(n, from, to, bunch, rnd) { const out = []; for (let i = 0; i < n; i++) out.push(from + (to - from) * Math.pow(rnd(), bunch)); return out.sort((x, y) => x - y); }

// the shared room (one per context and destination): a generated stereo impulse response with early reflections and a darkening tail; returns { inp } (send into inp)
function room(a, dest, R, out) {
  let m = ROOMS.get(a); if (!m) { m = new Map(); ROOMS.set(a, m); } const key = (out ? 'out' : 'in'); let r = m.get(dest) && m.get(dest)[key]; if (r) return r;
  const rt = out ? R.rt60Out : R.rt60In, n = Math.ceil(a.sampleRate * rt * 1.2), ir = a.createBuffer(2, n, a.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0, e = 0;
    for (let i = 0; i < n; i++) { const tt = i / a.sampleRate, cut = R.dampFrom * Math.pow(R.dampTo / R.dampFrom, tt / rt), al = 1 - Math.exp(-2 * Math.PI * cut / a.sampleRate); lp += al * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.pow(10, (-3 * tt) / rt) * Math.min(1, tt / 0.004); }
    for (const [dt, g] of R.early) { const i = Math.floor((dt * (c ? 1.13 : 1)) * a.sampleRate); if (i < n) d[i] += (c ? -g : g) * 0.6; }
    for (let i = 0; i < n; i++) e += d[i] * d[i]; const k = 1 / Math.sqrt(e || 1); for (let i = 0; i < n; i++) d[i] *= k; }
  const cv = a.createConvolver(); cv.normalize = false; cv.buffer = ir; const inp = a.createGain(); inp.connect(cv); cv.connect(dest || a.destination);
  r = { inp }; const o = m.get(dest) || {}; o[key] = r; m.set(dest, o); return r;
}

// the output chain of one sound: gain (vol, distance, variation) -> voice-band dip -> air lowpass -> peak softener -> pan -> dest, plus a send into the room. po = { pan (-1..1), dist (m) }
export function impactOut(a, dest, po, C, gain, wet, outdoors, phone) {
  const dist = Math.max(0, (po && po.dist) || 0), pan = Math.max(-1, Math.min(1, (po && po.pan) || 0)), near = Math.min(1, dist / C.reach), R = C.room;
  const g = a.createGain(), dip = a.createBiquadFilter(), air = a.createBiquadFilter(), send = a.createGain(), soft = a.createWaveShaper();
  soft.curve = softCurve(C.limitKnee, C.limitCeil); soft.oversample = '2x';
  g.gain.value = C.vol * gain * Math.max(C.minGain, 1 - near);
  dip.type = 'peaking'; dip.frequency.value = C.dipHz; dip.Q.value = C.dipQ; dip.gain.value = C.dipDb;
  air.type = 'lowpass'; air.Q.value = 0.5; air.frequency.value = Math.min(phone ? C.phoneLp : 1e9, C.airNear * Math.pow(C.airFar / C.airNear, near));
  send.gain.value = (outdoors ? R.wetOut : R.wetIn) * (wet === undefined ? 1 : wet) * (1 + R.farWet * near);
  g.connect(dip); dip.connect(air); air.connect(soft); soft.connect(send); send.connect(room(a, dest, R, outdoors).inp); let last = soft;
  if (a.createStereoPanner) { const sp = a.createStereoPanner(); sp.pan.value = pan; soft.connect(sp); last = sp; }
  last.connect(dest || a.destination); return g;
}

// plays one impact sound at time t into dest (null = speakers). kind: 'hit' | 'head' | 'charged' | 'destroyed' | 'shot'.
// opt: { po: { pan, dist }, C: IMPACT_SFX, rnd: () => 0..1, phone: true for the phone noise share, grain count and lowpass, outdoors: true for the drier street room }. Returns the time the sound ends (room tail included).
export function impactPlay(a, dest, kind, t, opt) {
  const o = opt || {}, C = o.C || IMPACT_SFX, rnd = o.rnd || Math.random, od = !!o.outdoors, ph = !!o.phone;
  const pv = 1 + C.pitchVar * (rnd() * 2 - 1), gv = Math.pow(10, (C.gainVarDb * (rnd() * 2 - 1)) / 20);
  const tail = (od ? C.room.rt60Out : C.room.rt60In) * 1.2;
  const out = kind === 'shot' ? impactOut(a, dest, { pan: 0, dist: 0 }, C, C.shot.gain * gv, C.shot.wet, od, ph) : impactOut(a, dest, o.po, C, gv, 1, od, ph);
  return impactSources(a, out, kind, t, C, rnd, ph, pv) + tail;
}
// the sound's own sources (everything before the output chain of impactOut) into out, from time t; pv: the pitch variation; returns when they end (no room tail)
// (LAG FIX Nov 19: split out of impactPlay unchanged, so the same sources can be rendered ahead into buffers: impactPrerender)
export function impactSources(a, out, kind, t, C, rnd, ph, pv) {
  const nk = ph ? C.phoneNoise : 1;
  // crackle grain count after the phone share (at least one)
  const cnt = (n) => Math.max(1, Math.round(n * (ph ? C.phoneGrains : 1)));
  if (kind === 'shot') {
    const S = C.shot;
    let end = burst(a, out, t, 'bandpass', S.jetF0 * pv, S.jetF1 * pv, S.jetQ, S.jetAttack, S.jetLen, S.jetGain * nk, rnd);
    end = Math.max(end, burst(a, out, t, 'lowpass', S.pushF0 * pv, S.pushF1 * pv, 0.7, 0.002, S.pushLen, S.pushGain, rnd));
    S.dropHz.forEach((hz, j) => { const tm = times(cnt(S.drops), 0.015, 0.015 + S.dropSpan, 1.4, rnd); end = Math.max(end, grains(a, out, t, tm, tm.map((x) => S.dropGain * nk * (0.3 + 0.7 * rnd()) * (1 - 0.7 * x / (S.dropSpan + 0.015)) * (j ? 0.7 : 1)), S.dropGrain, 'bandpass', hz * pv, 1.3, rnd)); });
    end = Math.max(end, strike(a, out, t + 0.002, 0.002, S.valveLp, S.valveGain, S.valveModes, S.valveQ, S.valveGains, pv, rnd));
    end = Math.max(end, strike(a, out, t + S.reseatAt * (0.9 + 0.2 * rnd()), 0.0015, S.valveLp, S.valveGain * S.reseat, S.valveModes, S.valveQ, S.valveGains, pv * 1.05, rnd));
    return end;
  }
  if (kind === 'destroyed') {
    const D = C.destroyed;
    let end = burst(a, out, t, 'lowpass', D.rumbleF0 * pv, D.rumbleF1 * pv, 0.7, 0.004, D.rumbleLen, D.rumbleGain, rnd);
    D.clankAt.forEach((at, i) => { const tt = t + (i ? at * (0.9 + 0.2 * rnd()) : 0); end = Math.max(end, strike(a, out, tt, D.strikeLen, D.clankLp[i], D.strikeGain * D.clankGain[i], D.modes, D.modeQ, D.modeGain, D.clankScale[i] * pv * (0.96 + 0.08 * rnd()), rnd)); });
    const ct = times(D.crunch, 0, D.crunchSpan, 1.3, rnd); end = Math.max(end, grains(a, out, t, ct, ct.map((x, i) => D.crunchGain * (1 - 0.6 * i / D.crunch) * (0.6 + 0.4 * rnd())), D.crunchGrain, 'bandpass', D.crunchHz * pv, D.crunchQ, rnd));
    const st = times(D.settle, D.settleFrom, D.settleTo, 1.6, rnd), sg = st.map((x, i) => D.settleGain * (1 - 0.75 * i / D.settle) * (0.5 + 0.5 * rnd()));
    end = Math.max(end, alternate(a, out, t, st, sg, D.settleModes, D.settleQ, [1, 0.7, 0.5], pv, D.settleSpread, 3000, rnd));
    const zt = times(cnt(D.staticBursts), D.staticFrom, D.staticTo, 1.5, rnd), span = D.staticTo - D.staticFrom;
    end = Math.max(end, grains(a, out, t, zt, zt.map((x) => D.staticGain * nk * Math.pow(1 - (x - D.staticFrom) / span, 1.5) * (0.5 + 0.5 * rnd())), zt.map((x) => D.staticGrain0 + (D.staticGrain1 - D.staticGrain0) * (x - D.staticFrom) / span), 'bandpass', [D.staticF0 * pv, D.staticF1 * pv], D.staticQ, rnd));
    const kt = times(cnt(D.sparks), D.sparkFrom, D.sparkTo, 1.2, rnd); end = Math.max(end, grains(a, out, t, kt, kt.map(() => D.sparkGain * nk * (0.3 + 0.7 * rnd())), D.sparkGrain, 'highpass', D.sparkHp, 0.7, rnd));
    return end;
  }
  const H = C.hit, X = C.charged, P = C.head, ch = kind === 'charged', hd = kind === 'head';
  const pk = pv * (ch ? X.pitch : 1), lk = ch ? X.length : 1, gk = (ch ? X.gain : 1) * (hd ? P.bodyShare : 1);
  let end = burst(a, out, t, 'bandpass', H.slapF0 * pk, H.slapF1 * pk, H.slapQ, 0.001, H.slapLen * lk, H.slapGain * gk, rnd);
  end = Math.max(end, burst(a, out, t + 0.002, 'highpass', H.splashF0 * pk, H.splashF1 * pk, 0.7, H.splashAttack, H.splashLen * lk, H.splashGain * gk * nk, rnd));
  const n = cnt(H.spray * (ch ? X.spray : 1)), sp = times(n, 0.008, 0.008 + H.spraySpan * lk, 1.5, rnd);
  end = Math.max(end, grains(a, out, t, sp, sp.map((x, i) => H.sprayGain * gk * nk * (1 - 0.8 * i / n) * (0.3 + 0.7 * rnd())), H.sprayGrain, 'bandpass', H.sprayHz * pk, H.sprayQ, rnd));
  end = Math.max(end, strike(a, out, t + 0.001, H.strikeLen * lk, H.strikeLp * pk, H.strikeGain * gk, H.modes, H.modeQ, H.modeGain, pk, rnd));
  end = Math.max(end, burst(a, out, t, 'lowpass', H.weightF0 * pk, H.weightF1 * pk, 0.7, 0.002, H.weightLen * lk, H.weightGain * gk, rnd));
  const rk = pk * (0.95 + 0.1 * rnd()), rt = times(H.rattle, H.rattleFrom, H.rattleTo * lk, 1.2, rnd), rg = rt.map((x, i) => H.rattleGain * gk * (1 - 0.6 * i / H.rattle) * (0.5 + 0.5 * rnd()));
  end = Math.max(end, alternate(a, out, t, rt, rg, H.rattleModes, H.rattleQ, [1, 0.7, 0.45], rk, H.rattleSpread, 3500, rnd));
  if (hd) {
    const ht = t + P.delay, gr = resonator(a, out, P.glassModes, P.glassQ, [1, 0.8, 0.6, 0.45], pv), ct = times(P.crackTicks, 0, P.crackSpan, 1.8, rnd), cg = ct.map((x, i) => (1 - 0.7 * i / P.crackTicks) * (0.5 + 0.5 * rnd()));
    end = Math.max(end, grains(a, out, ht, ct, cg.map((x) => x * P.crackGain), P.crackTick, 'highpass', P.crackHp, 0.7, rnd));
    end = Math.max(end, grains(a, gr, ht, ct, cg.map((x) => x * P.glassGain), P.crackTick, 'highpass', P.crackHp, 0.7, rnd));
    const ft = times(cnt(P.fizz), P.fizzFrom, P.fizzTo, 1.3, rnd);
    end = Math.max(end, grains(a, out, ht, ft, ft.map((x) => P.fizzGain * nk * Math.pow(1 - (x - P.fizzFrom) / (P.fizzTo - P.fizzFrom), P.fizzFade) * (0.3 + 0.7 * rnd())), P.fizzGrain, 'bandpass', P.fizzHz * pv, P.fizzQ, rnd));
  }
  if (ch) {
    end = Math.max(end, burst(a, out, t + X.steamAt, 'bandpass', X.steamF0 * pv, X.steamF1 * pv, X.steamQ, X.steamAttack, X.steamLen, X.steamGain * nk, rnd));
    const zt = times(cnt(X.sizzle), X.steamAt + 0.02, X.steamAt + X.steamLen * 0.9, 1.2, rnd);
    end = Math.max(end, grains(a, out, t, zt, zt.map((x) => X.sizzleGain * nk * (1 - 0.7 * x / (X.steamAt + X.steamLen)) * (0.3 + 0.7 * rnd())), X.sizzleGrain, 'highpass', X.sizzleHp, 0.7, rnd));
  }
  return end;
}

// the in-game wrapper. audio() returns the running AudioContext or null; cfg() returns the IMPACT_SFX block; phone() is true on phones; outdoors() is true on the street (drier room).
// hit(po, head) and charged(po) share one queue (hitGap apart, dropped past hitQueue); destroyed(po) and shot() always play.
export function createImpactSfx(audio, cfg, phone, outdoors) {
  let nextHit = 0;
  const C = () => (cfg && cfg()) || IMPACT_SFX;
  // a rendered variant through a pooled chain when there is one (LAG FIX Nov 19, below), else the sound built live as before
  const go = (kind, po, t) => { const a = audio(); if (!a) return 0; try { const tt = t === undefined ? a.currentTime + 0.003 : t, op = { po, C: C(), phone: !!(phone && phone()), outdoors: !!(outdoors && outdoors()) }; const r = impactPlayPre(a, null, kind, tt, op); return r === null ? impactPlay(a, null, kind, tt, op) : r; } catch (e) { return 0; } };
  const queued = (kind, po) => { const a = audio(); if (!a) return 0; const now = a.currentTime + 0.003, t = Math.max(now, nextHit); if (t - now > C().hitQueue) return 0; nextHit = t + C().hitGap; return go(kind, po, t); };
  // prerender(): renders the variants (the loading cards call it; returns a promise)
  return { prerender: () => { const a = audio(); return a ? impactPrerender(a.sampleRate, C(), !!(phone && phone())).catch(() => 0) : Promise.resolve(0); }, shot: () => go('shot', { pan: 0, dist: 0 }), hit: (po, head) => queued(head ? 'head' : 'hit', po), charged: (po) => queued('charged', po), destroyed: (po) => go('destroyed', po) };
}

// ---- LAG FIX Nov 19 (owner 10:15; profile: one 3.76 s frame and many stutters inside impactOut): the impact sounds no longer build their whole node graph per shot.
// 1. Sources rendered ahead: each kind's sources (impactSources, unchanged) are rendered into a few AudioBuffers with an OfflineAudioContext while a loading card is
//    up, every variant with its own random draws from the same ranges (CONFIG.sfx.impact.variants of them; the pitch variation is in the variant).
// 2. Output chains built once: the nodes impactOut makes (gain, presence dip, air filter, soft limiter, room send, panner) are kept in a small pool per context and
//    reused with the same values set for each sound; a chain is used again only after its sound has ended. The level variation is still drawn per sound.
// Until the buffers exist (or if rendering fails) a sound is built live exactly as before. impactSelfTest renders a sound both ways and gives the RMS difference.
const PRE = new Map(), POOLS = new WeakMap();
const preKey = (kind, ph, sr) => kind + '|' + (ph ? 1 : 0) + '|' + sr;
function chainNew(a, dest, C, od) {
  const g = a.createGain(), dip = a.createBiquadFilter(), air = a.createBiquadFilter(), send = a.createGain(), soft = a.createWaveShaper(), R = C.room;
  soft.curve = softCurve(C.limitKnee, C.limitCeil); soft.oversample = '2x';
  dip.type = 'peaking'; dip.frequency.value = C.dipHz; dip.Q.value = C.dipQ; dip.gain.value = C.dipDb; air.type = 'lowpass'; air.Q.value = 0.5;
  g.connect(dip); dip.connect(air); air.connect(soft); soft.connect(send); send.connect(room(a, dest, R, od).inp); let last = soft, sp = null;
  if (a.createStereoPanner) { sp = a.createStereoPanner(); soft.connect(sp); last = sp; }
  last.connect(dest || a.destination); return { g, air, send, sp, busy: 0 };
}
// the values impactOut sets, for this sound
function chainSet(c, po, C, gain, wet, od, phone) {
  const dist = Math.max(0, (po && po.dist) || 0), pan = Math.max(-1, Math.min(1, (po && po.pan) || 0)), near = Math.min(1, dist / C.reach), R = C.room;
  c.g.gain.value = C.vol * gain * Math.max(C.minGain, 1 - near); c.air.frequency.value = Math.min(phone ? C.phoneLp : 1e9, C.airNear * Math.pow(C.airFar / C.airNear, near));
  c.send.gain.value = (od ? R.wetOut : R.wetIn) * (wet === undefined ? 1 : wet) * (1 + R.farWet * near); if (c.sp) c.sp.pan.value = pan;
}
function chainGet(a, dest, C, od, now) {
  let m = POOLS.get(a); if (!m) { m = new Map(); POOLS.set(a, m); } const k = (od ? 'o' : 'i') + (dest ? 'd' : ''); let l = m.get(k); if (!l) { l = []; m.set(k, l); }
  for (const c of l) if (c.busy <= now && c.dest === dest) return c; const c = chainNew(a, dest, C, od); c.dest = dest; l.push(c); return c;
}
// a seeded random source (the variant's draws, repeatable so its length can be learnt first)
const seeded = (s0) => { let s = s0 >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
// render one variant's sources (mono, from time 0) into a buffer of exactly their length; pv from rnd first, as impactPlay draws it. The sources are first laid out
// in a one-sample context to learn where they end (the same draws), so only that length is rendered
async function renderSources(sr, kind, C, ph, seed, maxLen) {
  const dry = new OfflineAudioContext(1, 1, sr), r0 = seeded(seed), pv0 = 1 + C.pitchVar * (r0() * 2 - 1); r0(); const end = Math.min(maxLen, impactSources(dry, dry.createGain(), kind, 0, C, r0, ph, pv0)), n = Math.max(1, Math.ceil(end * sr));
  const oc = new OfflineAudioContext(1, n, sr), cap = oc.createGain(), rnd = seeded(seed); cap.connect(oc.destination);
  const pv = 1 + C.pitchVar * (rnd() * 2 - 1); rnd(); impactSources(oc, cap, kind, 0, C, rnd, ph, pv); return oc.startRendering();
}
// render the variants for this device (phone or not) at this sample rate; safe to call again (does nothing once done)
let preBusy = null;
export function impactPrerender(sr, C, ph) { if (!preBusy) preBusy = prerender0(sr, C, ph).finally(() => { preBusy = null; }); return preBusy; }
async function prerender0(sr, C, ph) {
  const V = C.variants || 0; if (!V || typeof OfflineAudioContext === 'undefined') return 0; let n = 0;
  for (const kind of ['shot', 'hit', 'head', 'charged', 'destroyed']) { const k = preKey(kind, ph, sr); if (PRE.has(k)) continue; const l = [];
    for (let i = 0; i < V; i++) { l.push(await renderSources(sr, kind, C, ph, Math.floor(Math.random() * 4294967296), C.renderMax)); n++; } PRE.set(k, l); }
  return n;
}
// play one impact sound from a rendered variant through a pooled chain; null when there are no variants yet (the caller then builds it live)
export function impactPlayPre(a, dest, kind, t, opt) {
  const o = opt || {}, C = o.C || IMPACT_SFX, rnd = o.rnd || Math.random, od = !!o.outdoors, ph = !!o.phone, l = PRE.get(preKey(kind, ph, a.sampleRate)); if (!l || !l.length) return null;
  const buf = l[Math.floor(rnd() * l.length)], gv = Math.pow(10, (C.gainVarDb * (rnd() * 2 - 1)) / 20), c = chainGet(a, dest, C, od, a.currentTime);
  if (kind === 'shot') chainSet(c, { pan: 0, dist: 0 }, C, C.shot.gain * gv, C.shot.wet, od, ph); else chainSet(c, o.po, C, gv, 1, od, ph);
  const src = a.createBufferSource(); src.buffer = buf; src.connect(c.g); src.start(t); c.busy = t + buf.duration + 0.05; src.onended = () => src.disconnect();
  return t + buf.duration + (od ? C.room.rt60Out : C.room.rt60In) * 1.2;
}
// the proof that a rendered-and-pooled sound is the live one: the same sound (same random draws, same noise and room) rendered both ways; RMS of the difference / RMS
export async function impactSelfTest(sr, C, ph, seed) {
  const mk = (s0) => { let s = s0 >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
  const MR = Math.random, res = {}, len = C.renderMax + C.room.rt60In * 1.3, po = { pan: 0.3, dist: 6 };
  const prep = (oc) => { Math.random = mk(seed + 1); noiseBuf(oc); Math.random = mk(seed + 2); room(oc, null, C.room, false); Math.random = MR; };
  try {
    for (const kind of ['shot', 'hit', 'head', 'charged', 'destroyed']) {
      const A = new OfflineAudioContext(2, Math.ceil(sr * len), sr); prep(A); impactPlay(A, null, kind, 0, { C, rnd: mk(seed), phone: ph, outdoors: false, po }); const a = await A.startRendering();
      const S = new OfflineAudioContext(1, Math.ceil(sr * C.renderMax), sr); Math.random = mk(seed + 1); noiseBuf(S); Math.random = MR;
      const g = {}, buf = await (async () => { const oc = S, cap = oc.createGain(); cap.connect(oc.destination); const r = mk(seed), pv = 1 + C.pitchVar * (r() * 2 - 1); g.gv = Math.pow(10, (C.gainVarDb * (r() * 2 - 1)) / 20); impactSources(oc, cap, kind, 0, C, r, ph, pv); return oc.startRendering(); })();
      const B = new OfflineAudioContext(2, Math.ceil(sr * len), sr); prep(B); const c = chainNew(B, null, C, false); if (kind === 'shot') chainSet(c, { pan: 0, dist: 0 }, C, C.shot.gain * g.gv, C.shot.wet, false, ph); else chainSet(c, po, C, g.gv, 1, false, ph);
      const src = B.createBufferSource(); src.buffer = buf; src.connect(c.g); src.start(0); const b = await B.startRendering();
      let e = 0, d = 0; for (let ch = 0; ch < 2; ch++) { const x = a.getChannelData(ch), y = b.getChannelData(ch); for (let i = 0; i < x.length; i++) { e += x[i] * x[i]; d += (x[i] - y[i]) * (x[i] - y[i]); } }
      res[kind] = +(Math.sqrt(d / Math.max(1e-30, e))).toExponential(2); }
  } finally { Math.random = MR; }
  return res;
}
