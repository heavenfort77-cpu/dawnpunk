// Renders the impact sounds of src/impactsfx.js offline (OfflineAudioContext in headless Chromium on a blank page, no game page, no GL).
// Usage: node tools/impactsfx_render.cjs <out dir> [--tune]
//   --tune: first measures every layer alone (loudest 50 ms window, 3 seeds, 0 m, indoors), sets each layer's gain so it meets TARGET below
//           (rounded to 3 significant digits), writes that tuned copy as <out>/impactsfx.js and renders with it; without --tune it renders src/impactsfx.js as it is.
// Writes: <out>/sample.wav (the owner's sample: each sound 3 or 2 times with 0.5 s gaps, then a fight sequence), <out>/solo/*.wav (each sound alone, plus the
// current game's sfxHit / sfxShot / sfxBreak copied from src/main.js), <out>/marks.json (timestamps), <out>/layers.json (layer levels before and after tuning).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(process.argv[2] || 'impact_out');
const TUNE = process.argv.includes('--tune');
const SRC = path.join(__dirname, '..', 'src', 'impactsfx.js');

// loudest 50 ms window of each layer alone (dBFS, 0 m, indoors, room included); a layer's gain is scaled to meet it
const TARGET = {
  hit: { strikeGain: -26, weightGain: -31, slapGain: -30, splashGain: -33, sprayGain: -35, rattleGain: -35 },
  head: { crackGain: -28, glassGain: -30, fizzGain: -29 },
  charged: { steamGain: -31, sizzleGain: -37 },
  destroyed: { strikeGain: -24, rumbleGain: -28, crunchGain: -31, settleGain: -36, staticGain: -34, sparkGain: -35 },
  shot: { jetGain: -28, pushGain: -31, dropGain: -35, valveGain: -31 },
};

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import { impactPlay, IMPACT_SFX } from './impactsfx.js';
const SR = 44100;
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function refOut(a, dest, pan) { const g = a.createGain(), sp = a.createStereoPanner(); sp.pan.value = pan; g.connect(sp); sp.connect(dest); return g; }
function refShot(a, dest, t) { const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.11); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.13); return t + 0.13; }
function refHit(a, dest, t, pan) { const out = refOut(a, dest, pan); out.gain.value = 0.25; const o = a.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.08); const og = a.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12); return t + 0.12; }
function refBreak(a, dest, t, po, low) { const len = 0.4, out = refOut(a, dest, po.pan); out.gain.value = Math.max(0.25, 0.9 - po.dist / 40);
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = a.createBufferSource(); src.buffer = buf; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(low ? 1500 : 3200, t); f.frequency.exponentialRampToValueAtTime(250, t + len); src.connect(f); f.connect(out); src.start(t);
  const o = a.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(low ? 90 : 150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); const og = a.createGain(); og.gain.setValueAtTime(0.7, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.32); return t + len; }
function b64(buf, n) { const L = buf.getChannelData(0), R = buf.getChannelData(1), u = new Int16Array(n * 2); let pk = 0; for (let i = 0; i < n; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); u[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))); u[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))); }
  const by = new Uint8Array(u.buffer); let s = ''; for (let i = 0; i < by.length; i += 32768) s += String.fromCharCode.apply(null, by.subarray(i, i + 32768)); return { pk, b: btoa(s) }; }
async function render(len, fill) { const a = new OfflineAudioContext(2, Math.ceil(SR * len), SR); const end = fill(a, a.destination); const buf = await a.startRendering(); const n = Math.min(buf.length, Math.ceil((end + 0.05) * SR)); return { n, ...b64(buf, n) }; }
const max50 = (buf, n) => { const d = buf.getChannelData(0), w = Math.round(0.05 * SR); let m = 0; for (let s = 0; s + w <= n; s += Math.round(w / 4)) { let e = 0; for (let i = s; i < s + w; i++) e += d[i] * d[i]; m = Math.max(m, e / w); } return 10 * Math.log10(m + 1e-12); };
async function level(kind, C, seed) { const a = new OfflineAudioContext(2, SR * 2, SR); const e = impactPlay(a, a.destination, kind, 0.01, { po: { pan: 0, dist: 0 }, C, rnd: mulberry(seed) }); const b = await a.startRendering(); return max50(b, Math.min(b.length, Math.ceil(e * SR))); }
// every layer alone (the other layers' gains at 0), mean of 3 seeds; head and charged layers are measured without the body layers
window.layers = async (T) => { const out = {};
  const zero = () => { const C = JSON.parse(JSON.stringify(IMPACT_SFX)); for (const k in T) for (const g in T[k]) C[k][g] = 0; return C; };
  for (const kind in T) { let all = 0; for (let s = 0; s < 3; s++) all += await level(kind, IMPACT_SFX, 11 + s); out[kind + '.ALL'] = all / 3;
    for (const g in T[kind]) { const C = zero(); C[kind][g] = IMPACT_SFX[kind][g]; let v = 0; for (let s = 0; s < 3; s++) v += await level(kind, C, 11 + s); out[kind + '.' + g] = v / 3; } }
  return out; };
window.go = async () => {
  const res = { marks: [], solo: {} };
  const near = { pan: 0, dist: 0 }, seq = { pan: 0.2, dist: 6 };
  const order = [['hit', 3, 'body hit on a Gloom'], ['head', 3, 'head shot'], ['charged', 2, 'charged shot hit'], ['destroyed', 2, 'Gloom destroyed'], ['shot', 3, 'cannon shot']];
  res.sample = await render(60, (a, d) => { let t = 0.3;
    for (const [k, n, label] of order) for (let i = 0; i < n; i++) { const e = impactPlay(a, d, k, t, { po: near, rnd: mulberry(1000 + k.length * 31 + i * 7) }); res.marks.push({ label: label + ' ' + (i + 1), kind: k, t0: t, t1: e }); t = e + 0.5; }
    t += 0.5; const s0 = t, r = mulberry(77), sh = (x) => impactPlay(a, d, 'shot', x, { rnd: r }), land = 0.09, far = { pan: -0.35, dist: 9 }, ev = [];
    const at = (what, x) => { ev.push([what, x]); };
    sh(t); at('shot', t); impactPlay(a, d, 'hit', t + land, { po: seq, rnd: r }); at('body hit', t + land); t += 0.75;
    sh(t); at('shot', t); impactPlay(a, d, 'hit', t + land, { po: seq, rnd: r }); at('body hit', t + land); t += 0.6;
    sh(t); at('shot', t); impactPlay(a, d, 'head', t + land, { po: seq, rnd: r }); at('head shot', t + land); t += 1.1;
    sh(t); at('charged shot', t); impactPlay(a, d, 'charged', t + land, { po: seq, rnd: r }); at('charged hit 6 m', t + land); impactPlay(a, d, 'charged', t + land + 0.045, { po: far, rnd: r }); at('charged hit 9 m left', t + land + 0.045); t += 1.2;
    sh(t); at('shot', t); const e = impactPlay(a, d, 'destroyed', t + land, { po: seq, rnd: r }); at('Gloom destroyed', t + land);
    res.marks.push({ label: 'fight sequence inside a house (target 6 m ahead, pan 0.2 right)', kind: 'seq', t0: s0, t1: e, events: ev });
    return e + 0.5; });
  for (const [k, n] of order) for (let i = 0; i < n; i++) res.solo[k + (i + 1)] = await render(2, (a, d) => impactPlay(a, d, k, 0.01, { po: near, rnd: mulberry(1000 + k.length * 31 + i * 7) }));
  res.solo.hit_seq6m = await render(2, (a, d) => impactPlay(a, d, 'hit', 0.01, { po: seq, rnd: mulberry(5) }));
  res.solo.hit_outdoors = await render(2, (a, d) => impactPlay(a, d, 'hit', 0.01, { po: near, rnd: mulberry(1000 + 3 * 31), outdoors: true }));
  res.solo.hit_phone = await render(2, (a, d) => impactPlay(a, d, 'hit', 0.01, { po: near, rnd: mulberry(1000 + 3 * 31), phone: true }));
  res.solo.ref_sfxHit = await render(1, (a, d) => refHit(a, d, 0.01, 0));
  res.solo.ref_sfxShot = await render(1, (a, d) => refShot(a, d, 0.01));
  res.solo.ref_sfxBreak_machine0m = await render(1, (a, d) => refBreak(a, d, 0.01, near, true));
  return res; };
window.ready = true;
</script>`;

// sets block.key = value in the module text (the line '    key: value,' inside '  block: {' ... '  },')
function setVal(text, block, key, v) {
  const b0 = text.indexOf('\n  ' + block + ': {\n'); if (b0 < 0) throw new Error('no block ' + block); const b1 = text.indexOf('\n  },', b0);
  const seg = text.slice(b0, b1), re = new RegExp('\\n    ' + key + ': [^,\\n]+,'); if (!re.test(seg)) throw new Error('no key ' + block + '.' + key);
  return text.slice(0, b0) + seg.replace(re, '\n    ' + key + ': ' + v + ',') + text.slice(b1);
}
const sig3 = (x) => Number(x.toPrecision(3));

(async () => {
  fs.mkdirSync(path.join(OUT, 'solo'), { recursive: true });
  let mod = fs.readFileSync(SRC, 'utf8');
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const open = async (text) => { const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      await p.route('http://impact.test/**', (r) => (r.request().url().endsWith('/impactsfx.js') ? r.fulfill({ contentType: 'text/javascript', body: text }) : r.fulfill({ contentType: 'text/html', body: PAGE })));
      await p.goto('http://impact.test/index.html'); await p.waitForFunction(() => window.ready, null, { timeout: 30000 }); return { p, errs }; };
    const layers = { target: TARGET };
    if (TUNE) {
      const { p, errs } = await open(mod); const before = await p.evaluate((T) => window.layers(T), TARGET); await p.close(); if (errs.length) throw new Error(errs.join('\n'));
      const cur = await (async () => { const m = await import('file://' + SRC); return m.IMPACT_SFX; })();
      layers.before = before; layers.gains = {};
      for (const k in TARGET) for (const g in TARGET[k]) { const nv = sig3(cur[k][g] * Math.pow(10, (TARGET[k][g] - before[k + '.' + g]) / 20)); layers.gains[k + '.' + g] = [cur[k][g], nv]; mod = setVal(mod, k, g, nv); }
    }
    fs.writeFileSync(path.join(OUT, 'impactsfx.js'), mod);
    const { p, errs } = await open(mod);
    layers.after = await p.evaluate((T) => window.layers(T), TARGET);
    const res = await p.evaluate(() => window.go());
    if (errs.length) throw new Error(errs.join('\n'));
    const wav = (name, r) => { const data = Buffer.from(r.b, 'base64'), h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40); fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.concat([h, data])); };
    wav('sample', res.sample); for (const k in res.solo) wav('solo/' + k, res.solo[k]);
    fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ marks: res.marks, len: res.sample.n / 44100 }, null, 1));
    fs.writeFileSync(path.join(OUT, 'layers.json'), JSON.stringify(layers, null, 1));
    console.log('layers', JSON.stringify(layers));
    console.log('rendered', (res.sample.n / 44100).toFixed(2), 's; sample peak', res.sample.pk.toFixed(3), '; solo', Object.keys(res.solo).length);
  } finally { await b.close(); }
})().catch((e) => { console.error('RENDER FAIL', e); process.exit(1); });
