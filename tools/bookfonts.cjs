// Writes src/bookfonts.js: the two handwriting fonts of the journal books (src/book.js) as base64 woff2, latin subset only, so the single-file build works offline.
// Sources: art/fonts/*.woff2 from npm @fontsource/caveat 5.3.0 and @fontsource/kalam 5.3.0, both SIL Open Font License 1.1 (art/fonts/OFL-*.txt).
// Usage: node tools/bookfonts.cjs
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const FONTS = { Caveat: 'art/fonts/caveat-latin-400-normal.woff2', Kalam: 'art/fonts/kalam-latin-400-normal.woff2' };
const out = {};
let raw = 0;
for (const [name, file] of Object.entries(FONTS)) {
  const buf = fs.readFileSync(path.join(root, file));
  raw += buf.length;
  out[name] = buf.toString('base64');
}
const head = '// The journal books\' handwriting fonts (latin subset woff2, base64), made by tools/bookfonts.cjs from art/fonts. Do not edit by hand.\n'
  + '// Caveat (c) 2014 The Caveat Project Authors; Kalam (c) 2014 Indian Type Foundry. Both SIL Open Font License 1.1 (art/fonts/OFL-Caveat.txt, OFL-Kalam.txt).\n';
fs.writeFileSync(path.join(root, 'src/bookfonts.js'), head + 'export const BOOK_FONTS = ' + JSON.stringify(out) + ';\n');
console.log('src/bookfonts.js', Object.keys(out).join(', '), 'raw', (raw / 1024).toFixed(1) + ' KB', 'base64', (Object.values(out).join('').length / 1024).toFixed(1) + ' KB');
