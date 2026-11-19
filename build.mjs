import { build } from 'esbuild';
import fs from 'fs';
import { execFileSync } from 'child_process';
// guard: a // comment typed into the middle of a one-line statement silently removes the code after it; refuse to build if any live source file has one
{ const live = fs.readdirSync('src').filter(f => f.endsWith('.js') && !/_batch\d+|_before_|_sample|_plain|_backup/.test(f)).map(f => 'src/' + f);
  try { execFileSync('python3', ['tools/commentcheck.py', ...live], { stdio: 'pipe' }); } catch (e) { console.error(String(e.stdout)); process.exit(1); } }
// MINIFY=0 (the GPU runner's CPU profile, .github/workflows/perfgpu.yml): an unminified build, so the profile names the game's own functions
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: process.env.MINIFY !== '0', format: 'iife', write: false, target: 'es2019' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('index.template.html', 'utf8').replace('/*SCRIPT*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('built dist/index.html', (html.length / 1024).toFixed(0) + ' KB');

// music: files beside index.html (dist/music/), an itch upload zip, and a single-file build with the music embedded (for testing from one file)
fs.mkdirSync('dist/music', { recursive: true }); let single = html, n = 0;
for (const f of fs.readdirSync('art/music')) { if (!f.endsWith('.mp3')) continue; const buf = fs.readFileSync('art/music/' + f); fs.writeFileSync('dist/music/' + f, buf); single = single.split('music/' + f).join('data:audio/mpeg;base64,' + buf.toString('base64')); n++; }
// high graphics tier textures (desktops and laptops, CONFIG.quality.high.hiTex): files in dist/tex/ beside index.html, made by tools/maketex.py into art/texhi; the single-file build carries them inside
fs.rmSync('dist/tex', { recursive: true, force: true }); fs.mkdirSync('dist/tex', { recursive: true }); let nt = 0, tb = 0;
for (const f of fs.readdirSync('art/texhi')) { const buf = fs.readFileSync('art/texhi/' + f); fs.writeFileSync('dist/tex/' + f, buf); tb += buf.length; const uri = 'data:image/' + (f.endsWith('.png') ? 'png' : 'jpeg') + ';base64,' + buf.toString('base64'); single = single.split('"tex/' + f + '"').join('"' + uri + '"').split("'tex/" + f + "'").join("'" + uri + "'"); nt++; }
console.log('high-tier textures', nt, 'files', (tb / 1024).toFixed(0) + ' KB in dist/tex');
// desktop models (high tier, CONFIG.marlaHi.files): files in dist/models/ beside index.html, from art/models_hi; the single-file build carries them inside
// desktop Gloom models (art/models_hi/gloom_<kind>_hi.glb) ship only for kinds switched on in CONFIG.quality.high.gloom.models; a switched-off kind costs nothing in dist/models,
// the itch zip or index_single.html. GLOOMGLB=all (or a comma list, or none) overrides the switches for sample and check builds.
const { CONFIG: CFG } = await import('./src/config.js'); const GSW = (CFG.quality.high.gloom || {}).models || {}, GENV = process.env.GLOOMGLB;
const gloomOn = (k) => GENV ? (GENV === 'all' || GENV.split(',').includes(k)) : !!GSW[k]; const gloomSkip = [];
fs.rmSync('dist/models', { recursive: true, force: true }); fs.mkdirSync('dist/models', { recursive: true }); let nm = 0, mb = 0;
for (const f of fs.readdirSync('art/models_hi')) { const gk = /^gloom_(\w+)_hi\.glb$/.exec(f); if (gk && !gloomOn(gk[1])) { gloomSkip.push(gk[1]); continue; } const buf = fs.readFileSync('art/models_hi/' + f); fs.writeFileSync('dist/models/' + f, buf); mb += buf.length; const uri = 'data:model/gltf-binary;base64,' + buf.toString('base64'); single = single.split('"models/' + f + '"').join('"' + uri + '"').split("'models/" + f + "'").join("'" + uri + "'"); nm++; }
// LAG FIX Nov 19 (owner 11:40): the light character models (art/models, src/modeldata.js) as files dist/models/lo_<name>.glb (and lo_<name>.js, their script twins for a page
// opened from a folder, Nov 19 12:45); the single-file build carries them inside
for (const f of fs.readdirSync('art/models')) { if (!f.endsWith('.glb')) continue; const buf = fs.readFileSync('art/models/' + f), p = 'models/lo_' + f; fs.writeFileSync('dist/' + p, buf); fs.writeFileSync('dist/' + p.replace(/\.glb$/, '.js'), '(window.__LOMODELS || (window.__LOMODELS = {}))[' + JSON.stringify(f.slice(0, -4)) + '] = "' + buf.toString('base64') + '";\n'); const uri = 'data:model/gltf-binary;base64,' + buf.toString('base64'); single = single.split("'" + p + "'").join("'" + uri + "'").split('"' + p + '"').join('"' + uri + '"'); nm++; mb += buf.length; }
console.log('desktop models', nm, 'files', (mb / 1024).toFixed(0) + ' KB in dist/models', gloomSkip.length ? '| gloom models left out (switched off): ' + gloomSkip.join(', ') : '');
// THE BECKONER's falling pieces (desktop only): cannon-es (MIT) bundled with src/physics.js into its OWN file dist/physics.js; src/bosshi.js loads it with a script tag on the
// desktop tier only, so phones never fetch it. The single-file build carries it inside as a data address.
{ const rp = await build({ entryPoints: ['src/physics.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2019' }); const pj = rp.outputFiles[0].text; fs.writeFileSync('dist/physics.js', pj);
  single = single.split('"physics.js"').join('"data:text/javascript;base64,' + Buffer.from(pj).toString('base64') + '"'); console.log('desktop physics bundle', (pj.length / 1024).toFixed(0) + ' KB (dist/physics.js)'); }
// MARLA'S VOICE (owner Nov 18): her run-line clips from art/voice/mp3 (made by art/voice/gen_voice.py) go to dist/voice/ beside index.html; the single-file build carries them inside
fs.rmSync('dist/voice', { recursive: true, force: true }); fs.mkdirSync('dist/voice', { recursive: true }); let nv = 0, vb = 0;
// only the clips the game's table names (owner Nov 18 08:05: desktop only, so the phone-only clips kept in art/voice/mp3 are left out)
const { VOICE_LINES } = await import('./src/voicelines.js'), VWANT = new Set(VOICE_LINES.map((q) => q.u.slice(6)));
for (const f of fs.existsSync('art/voice/mp3') ? fs.readdirSync('art/voice/mp3') : []) { if (!f.endsWith('.mp3') || !VWANT.has(f)) continue; const buf = fs.readFileSync('art/voice/mp3/' + f); fs.writeFileSync('dist/voice/' + f, buf); vb += buf.length; const uri = 'data:audio/mpeg;base64,' + buf.toString('base64'); single = single.split('"voice/' + f + '"').join('"' + uri + '"').split("'voice/" + f + "'").join("'" + uri + "'"); nv++; }
console.log('Marla voice clips', nv, 'files', (vb / 1024).toFixed(0) + ' KB in dist/voice');
fs.writeFileSync('dist/index_single.html', single);
// (H, release check) a failed itch zip fails the build (it was only logged, and an old zip could have gone out)
const { execSync } = await import('child_process'); try { fs.rmSync('dist/solardg-itch.zip', { force: true }); execSync('cd dist && zip -q -r solardg-itch.zip index.html physics.js music tex models voice'); } catch (e) { console.error('zip failed', String(e).slice(0, 200)); process.exit(1); }
console.log('music files', n, '| single-file build', (single.length / 1024).toFixed(0) + ' KB', '| itch zip', (fs.statSync('dist/solardg-itch.zip').size / 1024).toFixed(0) + ' KB');
