// Journal books (owner Nov 17 11:04: "Marla's journal or any journal should display like pages of book in ink").
// openBook(el, spec, cfg, onClose) fills the overlay el with a book: warm ruled paper, handwriting in ink, a two-page spread on wide screens and one page at a time on phones held upright.
// The blocks of the spec are laid onto pages by measuring them (a block never runs off its page), and pages turn with the corner buttons, the arrow keys or a swipe.
// The ribbon (#qclose) and Escape close it. Every tuning value is in CONFIG.book; the layout rules are the .bk rules in index.template.html.
// spec: { hand: 'player' | 'marla', title, note (pencilled under the title), blocks: [{ k, text, label, icon, fresh }], openAt (index into blocks) }
//   k: 'line' (a line of ink), 'entry' (a line with its label in the margin, e.g. "Trip 3."), 'h2' / 'h3' (headings), 'term' (a name heading, with an optional picture),
//   'text' (the words under a term), 'unk' (an unknown machine: scribbled "???" and a pencilled note in text). A term may carry sketch (a device key: its ink sketch, src/booksketches.js).
// Layouts (CONFIG.book arrays [a, b, c]): a = two-page spread, b = one page (phone upright), c = one wide page on a short screen (phone sideways).
import { BOOK_FONTS } from './bookfonts.js';
import { sketchSvg } from './booksketches.js';

const book = { el: null, root: null, wrap: null, spec: null, cfg: null, onClose: null, blocks: [], pages: [], at: 0, spread: false, open: false };
let fontsReady = null, bound = false;

// load the embedded handwriting fonts once; a browser without FontFace falls back to its own cursive font
export function loadBookFonts() {
  if (fontsReady) return fontsReady;
  const all = [];
  try {
    for (const [name, b64] of Object.entries(BOOK_FONTS)) {
      const f = new FontFace(name, 'url(data:font/woff2;base64,' + b64 + ') format("woff2")');
      document.fonts.add(f);
      all.push(f.load());
    }
  } catch (e) {
    all.length = 0;
  }
  fontsReady = Promise.all(all).catch(() => null);
  return fontsReady;
}

// seeded jitter: the same line always gets the same tilt and offset
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rand(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function jitter(node, seed, J) {
  const r = rand(seed), sym = () => r() * 2 - 1;
  node.style.setProperty('--jr', (sym() * J.rot).toFixed(3) + 'deg');
  node.style.setProperty('--jy', (sym() * J.dy).toFixed(2) + 'px');
  node.style.setProperty('--jx', (r() * J.dx).toFixed(2) + 'px');
}

// paper grain and fibres as tiny SVG noise images (no image files)
function noise(freq, oct, strength, rgb) {
  const k = (strength * 4).toFixed(3), off = (-strength * 2).toFixed(3);
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='" + freq + "' numOctaves='" + oct + "' stitchTiles='stitch'/>"
    + "<feColorMatrix values='0 0 0 0 " + rgb[0] + ' 0 0 0 0 ' + rgb[1] + ' 0 0 0 0 ' + rgb[2] + ' ' + k + ' 0 0 0 ' + off + "'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>";
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}
function scribble(ink) {
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 20' preserveAspectRatio='none'><path d='M2 13 L7 6 L11 15 L17 5 L22 15 L28 6 L33 14 L39 5 L44 15 L50 6 L55 13 L58 9' fill='none' stroke='" + ink
    + "' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' opacity='0.85'/></svg>";
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}

// the look of one hand (colours, fonts, paper) as CSS variables on the book
function paint(root, el, C, hand) {
  const H = C[hand], P = C.paper, v = (k, x) => root.style.setProperty(k, x);
  v('--bk-paper', P.base); v('--bk-gutter', P.gutter); v('--bk-gutterw', (P.gutterW * 100).toFixed(1) + '%'); v('--bk-rulec', P.rule); v('--bk-marginc', P.marginLine); v('--bk-edge', P.edge);
  v('--bk-grain', noise('0.85', 2, P.grain, [0.36, 0.28, 0.17])); v('--bk-fibre', noise('0.012 0.32', 2, P.fibre, [0.45, 0.36, 0.22]));
  v('--bk-font', "'" + H.font + "'"); v('--bk-ink', H.ink); v('--bk-bleed', H.bleed); v('--bk-fresh', H.fresh); v('--bk-freshbleed', H.freshBleed);
  v('--bk-cover', H.cover); v('--bk-ribbon', H.ribbon); v('--bk-pencil', C.pencil); v('--bk-lift', C.lift[hand] + 'px');
  v('--bk-wet', C.ink.wet + 'ms'); v('--bk-dry', C.ink.dry + 'ms'); v('--bk-sheen', C.ink.sheen); v('--bk-blot', C.ink.blot + 'px'); v('--bk-blotdry', String(C.ink.blotDry));
  v('--bk-scrib', scribble(H.ink)); v('--bk-turn', C.turnMs + 'ms'); v('--bk-nav', C.nav + 'px'); v('--bk-coverw', C.cover + 'px'); v('--bk-padr', C.padR + 'px');
  el.style.setProperty('--bk-desk', P.desk);
}

// one block of the spec as an element; .bk--keep marks headings that move to the next page with the block under them
function makeBlock(b, i, C, hand) {
  const tag = { h2: 'h2', h3: 'h3', title: 'h1' }[b.k] || 'p', n = document.createElement(tag);
  n.className = 'bk__' + b.k + (b.k === 'h2' || b.k === 'h3' || b.k === 'term' || b.k === 'title' ? ' bk--keep' : '') + (b.fresh ? ' is-fresh' : '');
  if (b.k === 'entry') { const lab = document.createElement('span'); lab.className = 'bk__label'; lab.textContent = b.label; n.append(lab, ' ' + b.text); }
  // an unknown machine: a short hand-drawn blank (coordinator review Nov 17: a scribbled "???" read as "222" in the handwriting)
  else if (b.k === 'unk') { const s = document.createElement('span'); s.className = 'bk__blank'; s.textContent = '______'; const p = document.createElement('span'); p.className = 'bk__pencilword'; p.textContent = b.text; n.append(s, ' ', p); }
  else if (b.k === 'term' && b.sketch && sketchSvg(b.sketch, C.sketchStroke)) { n.classList.add('bk__term--sk'); n.append(sketchSvg(b.sketch, C.sketchStroke), ' ' + b.text); }
  else n.textContent = b.text;
  if (b.k !== 'note') jitter(n, hashStr(hand + '|' + i + '|' + (b.label || '') + b.text), C.jitter);
  return n;
}

function newPage() {
  const pg = document.createElement('section'), body = document.createElement('div'), no = document.createElement('div');
  pg.className = 'bk__page'; body.className = 'bk__body'; no.className = 'bk__no';
  pg.append(body, no); book.wrap.appendChild(pg); book.pages.push(pg);
  return body;
}
const fits = (b, body) => b.offsetTop + b.offsetHeight <= body.clientHeight + 0.5;

// lay the blocks onto pages: a block that does not fit starts a new page, and takes the headings above it along
function paginate() {
  book.root.classList.add('is-measure');
  book.wrap.textContent = ''; book.pages.length = 0;
  let body = newPage();
  for (const b of book.blocks) {
    body.appendChild(b);
    if (fits(b, body) || body.children.length === 1) continue;
    const carry = [b];
    let prev = b.previousElementSibling;
    while (prev && prev.classList.contains('bk--keep') && prev !== body.firstElementChild) { carry.unshift(prev); prev = prev.previousElementSibling; }
    body = newPage();
    for (const c of carry) body.appendChild(c);
  }
  if (book.spread && book.pages.length % 2) newPage();
  book.pages.forEach((pg, i) => { pg.lastChild.textContent = String(i + 1); pg.classList.add(book.spread ? (i % 2 ? 'bk__page--r' : 'bk__page--l') : 'bk__page--one'); });
}

// sizes from the screen: spread or single page, page width, ruled lines per page
function measure() {
  const C = book.cfg, el = book.el, spread = innerWidth >= C.spreadMinW && innerHeight >= C.spreadMinH && innerWidth / innerHeight >= C.spreadMinAspect;
  const s = spread ? 0 : innerHeight < C.shortMaxH ? 2 : 1;
  el.style.setProperty('--bk-gap', C.gap[s] + 'px');
  const cs = getComputedStyle(el), W = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), H = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const rule = C.rule[s], pw = Math.max(C.pageMinW, Math.min(C.pageMaxW[s], Math.floor((W - 2 * C.cover) / (spread ? 2 : 1))));
  const lines = Math.max(C.lines[0], Math.min(C.lines[1], Math.floor((H - C.ribbonOut[s] - 2 * C.cover) / rule) - C.head - C.foot));
  return { spread, s, rule, pw, lines };
}

function layout(keep) {
  const m = measure(), C = book.cfg, hand = book.spec.hand, H = C[hand], s = m.s, v = (k, x) => book.root.style.setProperty(k, x);
  book.spread = m.spread; book.layout = ['spread', 'single', 'wide'][s];
  book.root.classList.toggle('bk--spread', m.spread); book.root.classList.toggle('bk--single', !m.spread); book.root.classList.toggle('bk--wide', s === 2);
  v('--bk-rule', m.rule + 'px'); v('--bk-pw', m.pw + 'px'); v('--bk-lines', String(m.lines)); v('--bk-margin', H.margin[s] + 'px'); v('--bk-size', H.size[s] + 'px');
  v('--bk-title', H.title[s] + 'px'); v('--bk-small', H.small[s] + 'px'); v('--bk-pencilsize', C.pencilSize[hand][s] + 'px'); v('--bk-ribbonout', C.ribbonOut[s] + 'px');
  v('--bk-sketch', Math.min(C.sketch[s], 2 * m.rule - 2) + 'px');
  const textW = m.pw - H.margin[s] - C.padR, tilt = Math.min(1, (Math.atan(C.jitter.rise / textW) * 180 / Math.PI) / C.jitter.rot);
  v('--bk-tilt', tilt.toFixed(3));
  v('--bk-head', (book.cfg.head * m.rule) + 'px'); v('--bk-foot', (book.cfg.foot * m.rule) + 'px');
  paginate();
  const pi = Math.max(0, book.pages.findIndex((pg) => pg.contains(keep)));
  book.at = m.spread ? pi - (pi % 2) : pi;
  show(0);
}

// show the current page (or spread); dir +1 / -1 plays the turn
function show(dir) {
  const step = book.spread ? 2 : 1;
  book.root.classList.remove('is-measure');
  book.pages.forEach((pg, i) => { const on = i >= book.at && i < book.at + step; pg.classList.toggle('is-on', on); pg.classList.remove('is-turn-next', 'is-turn-prev'); });
  if (dir) {
    const pg = book.pages[dir > 0 ? book.at + step - 1 : book.at];
    void pg.offsetWidth;
    pg.classList.add(dir > 0 ? 'is-turn-next' : 'is-turn-prev');
  }
  dryShown();
  book.root.querySelector('.bk__prev').classList.toggle('is-off', book.at <= 0);
  book.root.querySelector('.bk__next').classList.toggle('is-off', book.at + step >= book.pages.length);
}

// fresh ink dries once its page is on screen: two frames later is-dry starts the CSS transition (wet for CONFIG.book.ink.wet ms, then drying over ink.dry ms)
function dryShown() {
  const wet = book.root.querySelectorAll('.bk__page.is-on .is-fresh:not(.is-dry)');
  if (!wet.length) return;
  requestAnimationFrame(() => requestAnimationFrame(() => { for (const n of wet) n.classList.add('is-dry'); }));
}

export function turnPage(d) {
  if (!book.open) return false;
  const step = book.spread ? 2 : 1, to = book.at + d * step;
  if (to < 0 || to >= book.pages.length) return false;
  book.at = to; show(d);
  return true;
}

export function closeBook() {
  if (!book.open) return;
  book.open = false;
  book.el.classList.remove('is-book');
  if (book.onClose) book.onClose();
}

const isOpen = () => book.open && book.el && book.el.style.display !== 'none' && book.el.classList.contains('is-book');
function onKey(e) {
  if (!isOpen()) return;
  if (e.code === 'ArrowRight' || e.code === 'PageDown') { turnPage(1); e.preventDefault(); }
  else if (e.code === 'ArrowLeft' || e.code === 'PageUp') { turnPage(-1); e.preventDefault(); }
  else if (e.code === 'Escape') { closeBook(); e.preventDefault(); }
}
// re-lay the pages when the screen turns or the fonts arrive, keeping the first block of the page in view
function relayout() { if (!isOpen()) return; const pg = book.pages[book.at], first = pg && pg.querySelector('.bk__body > *'); layout(first); }
function bindOnce() {
  if (bound) return;
  bound = true;
  addEventListener('keydown', onKey);
  addEventListener('resize', relayout);
}
function bindSwipe(area, C) {
  let sx = 0, sy = 0, id = null;
  area.addEventListener('pointerdown', (e) => { id = e.pointerId; sx = e.clientX; sy = e.clientY; });
  area.addEventListener('pointerup', (e) => {
    if (e.pointerId !== id) return;
    id = null;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) >= C.swipe && Math.abs(dx) > Math.abs(dy)) turnPage(dx < 0 ? 1 : -1);
  });
}
function button(cls, text, key, label) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = cls; b.textContent = text; b.dataset.key = key; b.setAttribute('aria-label', label);
  return b;
}

export function openBook(el, spec, cfg, onClose) {
  loadBookFonts(); bindOnce();
  Object.assign(book, { el, spec, cfg, onClose, open: true, at: 0 });
  el.textContent = ''; el.classList.add('is-book'); el.style.display = 'flex';
  const root = document.createElement('div'), wrap = document.createElement('div');
  root.className = 'bk bk--' + spec.hand; wrap.className = 'bk__pages';
  const prev = button('bk__nav bk__prev', '‹', '←', 'Previous page'), next = button('bk__nav bk__next', '›', '→', 'Next page'), close = button('bk__ribbon', 'Close', 'Esc', 'Close the book');
  close.id = 'qclose';
  root.append(wrap, prev, next, close); el.appendChild(root);
  Object.assign(book, { root, wrap });
  paint(root, el, cfg, spec.hand);
  const head = [{ k: 'title', text: spec.title }].concat(spec.note ? [{ k: 'note', text: spec.note }] : []);
  book.blocks = head.concat(spec.blocks).map((b, i) => makeBlock(b, i, cfg, spec.hand));
  prev.onclick = () => turnPage(-1); next.onclick = () => turnPage(1); close.onclick = closeBook;
  bindSwipe(wrap, cfg);
  layout(book.blocks[head.length + (spec.openAt || 0)] || book.blocks[0]);
  loadBookFonts().then(() => { if (isOpen() && book.root === root) relayout(); });
}
// for checks: how many pages, which are showing, spread or not
export const bookInfo = () => ({ open: isOpen(), pages: book.pages.length, at: book.at, spread: book.spread, layout: book.layout });
