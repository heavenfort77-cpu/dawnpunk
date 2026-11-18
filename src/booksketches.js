// Ink sketches of the devices for the field guide in your journal (owner Nov 17 13:22: "bigger ... drawn in dark ink ... the Turbine as a proper turbine").
// Each is drawn by hand from the device's look in the game (the HUD device pictures in src/deviceicons.js): line work in a 64 x 64 box, ground at y 60.
// The strokes take the ink colour of the page (currentColor); size and pen width come from CONFIG.book.sketch / sketchStroke (src/book.js).
const LEGS = 'M27 47 Q22 54 20 60 M37 47 Q42 54 44 60 M16 60 H24 M40 60 H48';
const BASE = 'M24 60 Q32 56 40 60';
const bulb = (x, y, r) => 'M' + (x - r) + ' ' + y + ' A' + r + ' ' + r + ' 0 1 0 ' + (x + r) + ' ' + y + ' A' + r + ' ' + r + ' 0 1 0 ' + (x - r) + ' ' + y;
const ring = (x, y, rx, ry) => 'M' + (x - rx) + ' ' + y + ' A' + rx + ' ' + ry + ' 0 1 0 ' + (x + rx) + ' ' + y + ' A' + rx + ' ' + ry + ' 0 1 0 ' + (x - rx) + ' ' + y;
// a horn (the emitter of the lance and its kin) from (x, y) pointing right, length l, mouth half-height h
const horn = (x, y, l, h) => 'M' + x + ' ' + (y - 2) + ' L' + (x + l) + ' ' + (y - h) + ' M' + x + ' ' + (y + 2) + ' L' + (x + l) + ' ' + (y + h)
  + ' M' + (x + l) + ' ' + (y - h - 1) + ' Q' + (x + l + 5) + ' ' + y + ' ' + (x + l) + ' ' + (y + h + 1) + ' Q' + (x + l - 2) + ' ' + y + ' ' + (x + l) + ' ' + (y - h - 1);
// small hexagons for the shield panel
function hexes() {
  let d = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x = 21 + c * 11 + (r % 2 ? 5.5 : 0), y = 24 + r * 9.5, k = 4.6;
      if (x > 47) continue;
      d += ' M' + (x - k) + ' ' + y + ' L' + (x - k / 2) + ' ' + (y - k * 0.87) + ' L' + (x + k / 2) + ' ' + (y - k * 0.87) + ' L' + (x + k) + ' ' + y + ' L' + (x + k / 2) + ' ' + (y + k * 0.87) + ' L' + (x - k / 2) + ' ' + (y + k * 0.87) + ' Z';
    }
  }
  return d;
}
const POSTS = 'M8 60 V13 M12 60 V13 M52 60 V13 M56 60 V13 ' + bulb(10, 10, 2.6) + ' ' + bulb(54, 10, 2.6) + ' M12 16 H52 M12 54 H52 M5 60 H15 M49 60 H59';
const LEAVES = 'M26 32 Q20 23 27 16 Q30 25 26 32 M30 31 Q37 21 46 21 Q40 30 30 31';

// path data per device; 'h' = hatching drawn thinner (shade)
export const SKETCHES = {
  // a mast with a three-blade rotor, its hub and tail, on a foot
  turbine: { d: 'M30.6 60 L31.3 22 M33.4 60 L32.7 22 ' + BASE + ' ' + bulb(32, 19, 3) + ' M35 18 L41 15 L41 22 L35 20'
    + ' M32 16 Q35 9 32 2 Q29.5 9 31 16 M29.6 20.5 Q22 22 17.5 28 Q24 27 30.2 22 M34.4 20.5 Q42 22 46.5 28 Q40 27 33.8 22', h: 'M31.4 30 h1.6 M31.4 38 h1.6 M31.4 46 h1.6' },
  // a solar flower: open petals on a bulb body that walks on two legs
  collector: { d: LEGS + ' ' + bulb(32, 40, 8) + ' M24.5 38 Q32 41.5 39.5 38 M32 30 Q20 24 14 13 Q26 15 32 30 M32 30 Q44 24 50 13 Q38 15 32 30 M32 30 Q28 18 32 6 Q36 18 32 30'
    + ' M32 30 Q20 30 9 25 Q20 21 32 30 M32 30 Q44 30 55 25 Q44 21 32 30 ' + bulb(32, 30, 2.5), h: 'M27 44 l3 3 M30 43 l3 3' },
  // a walker with one horn aimed ahead and leaves on top
  lance: { d: LEGS + ' ' + bulb(30, 40, 8) + ' ' + horn(37, 38, 11, 6) + ' ' + LEAVES + ' ' + bulb(28, 33.5, 2.2), h: 'M25 44 l3 3 M28 43 l3 3' },
  // a walker with two horns
  twin: { d: LEGS + ' ' + bulb(28, 41, 8) + ' ' + horn(34, 35, 12, 5) + ' ' + horn(35, 45, 12, 5) + ' ' + LEAVES, h: 'M23 45 l3 3 M26 44 l3 3' },
  // a walker under a cage dome, a short horn ahead
  mist: { d: LEGS + ' ' + bulb(30, 42, 8) + ' M21 35 Q30 14 39 35 M25 35 Q30 20 35 35 M30 35 V18 M21 35 H39 ' + horn(37, 42, 8, 4.5), h: 'M23 28 h14 M24 24 h12' },
  // a walker with a curled stem holding a seed pod
  sling: { d: LEGS + ' ' + bulb(30, 44, 7) + ' M30 37 Q27 26 35 19 Q44 13 47 21 ' + bulb(47, 25, 4) + ' M31 29 Q24 25 22 18 Q29 20 31 29', h: 'M26 47 l3 3' },
  // a shield of hex cells between two posts
  panel: { d: POSTS + ' ' + hexes(), h: 'M14 40 l6 6 M14 46 l4 4 M44 20 l6 6' },
  // a frame between two posts, grown over with vines and leaves
  trellis: { d: POSTS + ' M20 54 Q15 42 22 33 Q29 24 22 16 M36 54 Q42 40 35 30 Q29 22 37 16 M46 54 Q50 44 45 34'
    + ' M22 33 q-6 -2 -7 -7 q6 1 7 7 M22 24 q5 -3 9 -1 q-4 4 -9 1 M35 30 q6 -3 9 0 q-5 4 -9 0 M40 44 q-6 -1 -8 -6 q6 0 8 6 M45 34 q4 -4 7 -3 q-3 5 -7 3 M18 46 q5 -3 8 0 q-5 3 -8 0', h: '' },
  // a flat trap: a ring on the ground, a domed charge in the middle, leaf vanes and a little spark
  mine: { d: ring(32, 50, 23, 6) + ' ' + ring(32, 50, 14, 3.5) + ' M24 49 Q32 33 40 49 M28 48 Q30 40 32 37 M36 48 Q34 40 32 37'
    + ' M9 50 Q3 45 1 49 Q5 54 9 50 M55 50 Q61 45 63 49 Q59 54 55 50 M32 30 v-5 M26 32 l-3 -4 M38 32 l3 -4', h: '' },
  // a shallow basin bristling with glass spikes
  shard: { d: ring(32, 49, 26, 9) + ' ' + ring(32, 48, 20, 6) + ' M17 47 L20 33 L23 47 M28 45 L31 26 L34 45 M39 46 L43 31 L46 46 M23 52 L26 40 L29 52 M35 52 L38 39 L41 52', h: '' },
  // an arch with a dome hanging over a ring on the ground
  press: { d: 'M13 60 V25 Q32 3 51 25 V60 M17 60 V26 Q32 9 47 26 V60 M32 14 V24 M22 35 Q32 22 42 35 H22 ' + ring(32, 56, 16, 3.5), h: 'M26 31 h12' },
  // a tall stem with a cut crystal at the top
  prism: { d: 'M32 60 V30 ' + BASE + ' M32 6 L42 18 L32 30 L22 18 Z M22 18 H42 M27 18 L32 6 L37 18 L32 30 M32 45 Q24 41 22 35 Q30 37 32 45', h: 'M24 20 l4 5 M38 13 l2 3' },
  // a post with a crossbar and two hanging bells
  chime: { d: 'M30.8 60 V12 M33.2 60 V12 ' + BASE + ' M15 12 Q32 6 49 12 M18 11 V21 M46 11 V21 M12 32 Q18 16 24 32 Z M40 32 Q46 16 52 32 Z ' + bulb(18, 34, 1.6) + ' ' + bulb(46, 34, 1.6), h: 'M15 27 h6 M43 27 h6' },
  // a post with a wide tilted dish that drinks moonlight
  moon: { d: 'M30.8 60 V29 M33.2 60 V29 ' + BASE + ' M7 23 Q32 13 58 19 Q35 30 7 23 Z M32 26 V29 M42 40 Q49 36 51 30 Q44 33 42 40', h: 'M16 22 h3 M26 20 h3 M36 20 h3 M46 20 h3' },
  // a round-bellied flask with a curling stem for a stopper
  flask: { d: 'M25 15 V22 Q12 30 14 46 Q16 58 32 58 Q48 58 50 46 Q52 30 39 22 V15 M23 15 H41 M32 15 Q33 7 40 4', h: 'M18 44 l5 5 M17 38 l7 7 M20 32 l5 5' },
};

// the sketch as an inline SVG element built with createElementNS (no innerHTML)
export function sketchSvg(key, stroke) {
  const s = SKETCHES[key];
  if (!s) return null;
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'bk__sketch');
  const line = (d, w) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', String(w)); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); svg.appendChild(p); };
  line(s.d, stroke);
  if (s.h) line(s.h, stroke * 0.5);
  return svg;
}
