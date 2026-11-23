// KTX2 copies of the desktop pictures (Nov 23, owner's list item 1; rule 37: KTX2/Basis). The sources stay as they are; the copies are made once and kept in art/:
//   art/texhi/<name>.jpg|png      -> art/texhi_ktx2/<name>.ktx2      (the street, house and base pictures, CONFIG.quality.high.hiTex)
//   art/models_hi/<model>.glb     -> art/models_hi_ktx2/<model>.glb  (the same model, its pictures stored as KTX2 under KHR_texture_basisu)
// Encoding (owner's list item 1, the download kept near today's): normal maps are NOT converted (UASTC quadruples their download, ETC1S breaks their shading);
// street and machine colour pictures: ETC1S at quality 255 (about 1.5x a JPEG's bytes); people and Marla (faces): UASTC, the near-lossless mode, RDO lambda COLOR_RDO.
// A copy whose PSNR is under MIN_PSNR is made again in UASTC; still under: refused. All with mipmaps; UASTC with Zstandard. Street pictures are stored Y-flipped (three draws them with flipY = true; a compressed picture cannot be flipped
// at upload); model pictures are not (glTF's top-left origin, flipY false). Each copy is checked: decoded again with three's own transcoder and compared with
// its source, PSNR printed; a copy under MIN_PSNR dB is refused (its source is used by the game instead).
// Usage: node tools/makektx2.mjs [tex|models|all] [only-name-substring]   needs: npm i --no-save ktx2-encoder@0.6.0, python3 with Pillow
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { encodeToKTX2 } from 'ktx2-encoder';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const COLOR_RDO = 1, NORMAL_RDO = 0.5, MIN_PSNR = 38;
const [what = 'all', only = ''] = process.argv.slice(2);
const req = createRequire(import.meta.url);
// three's transcoder, loaded as CommonJS (three's package is "type": "module")
const btSrc = path.join(ROOT, 'node_modules/three/examples/jsm/libs/basis/basis_transcoder.js'), btCjs = path.join(ROOT, 'node_modules/.cache_basis_transcoder.cjs');
fs.writeFileSync(btCjs, fs.readFileSync(btSrc)); const BT = await req(btCjs)({ wasmBinary: fs.readFileSync(btSrc.replace(/\.js$/, '.wasm')) }); BT.initializeBasis();

const PY = 'import sys;from PIL import Image;im=Image.open(sys.stdin.buffer).convert("RGBA")\nif sys.argv[1]=="1": im=im.transpose(Image.FLIP_TOP_BOTTOM)\nsys.stdout.buffer.write(im.size[0].to_bytes(4,"little")+im.size[1].to_bytes(4,"little")+im.tobytes())';
const rgba = (buf, flip) => { const raw = execFileSync('python3', ['-c', PY, flip ? '1' : '0'], { input: buf, maxBuffer: 1 << 29 }); return { width: raw.readUInt32LE(0), height: raw.readUInt32LE(4), data: new Uint8Array(raw.buffer, raw.byteOffset + 8, raw.length - 8) }; };
// encode one picture; normal: linear normal-map mode; flip: stored upside down (street pictures)
async function encode(buf, normal, flip, etc, linear) {
  const src = rgba(buf, false); let alpha = false; for (let i = 3; i < src.data.length; i += 4) if (src.data[i] < 255) { alpha = true; break; }
  const k = await encodeToKTX2(new Uint8Array(1), { isUASTC: !etc, qualityLevel: 255, compressionLevel: 2, generateMipmap: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: normal ? NORMAL_RDO : COLOR_RDO, uastcLDRQualityLevel: 1,
    isNormalMap: normal, isPerceptual: !normal && !linear, isSetKTX2SRGBTransferFunc: !normal && !linear, isYFlip: flip, imageDecoder: async () => src });
  // check: decode level 0 to RGBA (format 13) and compare with the source as the game would see it
  const f = new BT.KTX2File(new Uint8Array(k)); if (!f.isValid() || !f.startTranscoding()) throw new Error('not a valid KTX2'); const w = f.getWidth(), h = f.getHeight(), out = new Uint8Array(f.getImageTranscodedSizeInBytes(0, 0, 0, 13)); f.transcodeImage(out, 0, 0, 0, 13, 0, -1, -1); f.close(); f.delete();
  const ref = flip ? rgba(buf, true) : src; let se = 0, n = 0; for (let i = 0; i < w * h * 4; i++) { if (!alpha && i % 4 === 3) continue; const d = out[i] - ref.data[i]; se += d * d; n++; }
  return { k: Buffer.from(k), psnr: se ? 10 * Math.log10(255 * 255 / (se / n)) : 99, w, h, alpha };
}
const log = []; let inB = 0, outB = 0, gpuB = 0, gpuK = 0;
const note = (name, a, r) => { inB += a; outB += r.k.length; const px = r.w * r.h * 4 / 3; gpuB += px * 4; gpuK += px; log.push(name + ' ' + r.w + 'x' + r.h + (r.alpha ? ' alpha' : '') + ' ' + (a / 1024).toFixed(0) + ' KB -> ' + (r.k.length / 1024).toFixed(0) + ' KB, PSNR ' + r.psnr.toFixed(1) + ' dB'); console.log(log[log.length - 1]); };

if (what === 'tex' || what === 'all') {
  const dir = path.join(ROOT, 'art/texhi'), outD = path.join(ROOT, 'art/texhi_ktx2'); fs.mkdirSync(outD, { recursive: true });
  for (const f of fs.readdirSync(dir).sort()) { if (!/\.(jpg|png)$/.test(f) || (only && !f.includes(only))) continue; const buf = fs.readFileSync(path.join(dir, f)), name = f.replace(/\.(jpg|png)$/, '');
    if (/_n$/.test(name)) { log.push('tex ' + f + ' kept (normal map)'); continue; }
    let r = await encode(buf, false, true, true); if (r.psnr < MIN_PSNR) r = await encode(buf, false, true, false); note('tex ' + f, buf.length, r);
    const o = path.join(outD, name + '.ktx2'); if (r.psnr < MIN_PSNR) { console.log('REFUSED ' + f + ' (PSNR under ' + MIN_PSNR + ')'); if (fs.existsSync(o)) fs.rmSync(o); } else fs.writeFileSync(o, r.k); }
}
if (what === 'models' || what === 'all') {
  const dir = path.join(ROOT, 'art/models_hi'), outD = path.join(ROOT, 'art/models_hi_ktx2'); fs.mkdirSync(outD, { recursive: true });
  for (const f of fs.readdirSync(dir).sort()) { if (!f.endsWith('.glb') || !/^(gloom_|boss_)/.test(f) || (only && !f.includes(only))) continue; // people and Marla (approved faces) keep their pictures const glb = fs.readFileSync(path.join(dir, f));
    const jl = glb.readUInt32LE(12), J = JSON.parse(glb.slice(20, 20 + jl).toString()), binAt = 20 + jl + 8, bin = glb.slice(binAt, binAt + glb.readUInt32LE(20 + jl));
    // which pictures are normal maps (linear) and which are colour (sRGB); a picture used both ways is kept as it is
    const use = {}; for (const m of J.materials || []) { const tag = (t, k) => { if (!t) return; const tx = J.textures[t.index]; if (tx && tx.source !== undefined) (use[tx.source] = use[tx.source] || new Set()).add(k); };
      tag(m.normalTexture, 'n'); tag(m.occlusionTexture, 'l'); tag(m.pbrMetallicRoughness && m.pbrMetallicRoughness.metallicRoughnessTexture, 'l'); tag(m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture, 'c'); tag(m.emissiveTexture, 'c');
      for (const e of Object.values(m.extensions || {})) for (const [k, v] of Object.entries(e)) if (v && typeof v === 'object' && v.index !== undefined) tag(v, /color|Color/.test(k) ? 'c' : 'l'); }
    const parts = [], views = J.bufferViews.map((v) => bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)); let changed = 0;
    for (let i = 0; i < (J.images || []).length; i++) { const im = J.images[i], u = use[i] || new Set(['c']); if (im.bufferView === undefined || u.size > 1) { log.push(f + ' image ' + i + ' kept (' + [...u] + ')'); continue; }
      if (u.has('n')) { log.push(f + ' image ' + i + ' kept (normal map)'); continue; }
      const buf = views[im.bufferView], etc = /^(gloom_|boss_)/.test(f), lin = !u.has('c'); let r = await encode(buf, false, false, etc, lin); if (etc && r.psnr < MIN_PSNR) r = await encode(buf, false, false, false, lin); note('model ' + f + ' #' + i + ' ' + (im.name || '') + ' (' + [...u] + ')', buf.length, r); if (r.psnr < MIN_PSNR) { console.log('REFUSED ' + f + ' #' + i); continue; }
      views.push(r.k); J.bufferViews.push({ buffer: 0, byteLength: r.k.length }); im.bufferView = J.bufferViews.length - 1; im.mimeType = 'image/ktx2'; changed++;
      for (const t of J.textures) if (t.source === i) { t.extensions = { ...(t.extensions || {}), KHR_texture_basisu: { source: i } }; delete t.source; } }
    if (!changed) { console.log(f + ': no picture changed'); continue; }
    // drop the replaced pictures' old bytes: rebuild the binary from the views still used
    const usedV = new Set(); const mark = (o) => { if (o && typeof o === 'object') { if (o.bufferView !== undefined) usedV.add(o.bufferView); for (const v of Object.values(o)) mark(v); } }; mark(J.accessors); mark(J.images); mark(J.meshes); mark(J.extensions);
    for (const v of J.bufferViews) if (v.extensions) usedV.add(J.bufferViews.indexOf(v));
    let at = 0; const remap = new Map(), nv = []; J.bufferViews.forEach((v, i) => { if (!usedV.has(i)) return; const d = views[i]; const pad = (4 - (at % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); at += pad; } remap.set(i, nv.length); nv.push({ ...v, byteOffset: at, byteLength: d.length }); parts.push(d); at += d.length; });
    const re = (o) => { if (o && typeof o === 'object') { if (o.bufferView !== undefined && remap.has(o.bufferView)) o.bufferView = remap.get(o.bufferView); for (const v of Object.values(o)) re(v); } }; re(J.accessors); re(J.images); re(J.meshes); re(J.extensions);
    J.bufferViews = nv; J.buffers = [{ byteLength: at }]; J.extensionsUsed = [...new Set([...(J.extensionsUsed || []), 'KHR_texture_basisu'])]; J.extensionsRequired = [...new Set([...(J.extensionsRequired || []), 'KHR_texture_basisu'])];
    const js = Buffer.from(JSON.stringify(J)), jp = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]), bb = Buffer.concat(parts), bp = Buffer.concat([bb, Buffer.alloc((4 - bb.length % 4) % 4)]);
    const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8);
    const c1 = Buffer.alloc(8); c1.writeUInt32LE(jp.length, 0); c1.writeUInt32LE(0x4e4f534a, 4); const c2 = Buffer.alloc(8); c2.writeUInt32LE(bp.length, 0); c2.writeUInt32LE(0x004e4942, 4);
    fs.writeFileSync(path.join(outD, f), Buffer.concat([head, c1, jp, c2, bp])); console.log(f + ': ' + changed + ' pictures, ' + (glb.length / 1048576).toFixed(1) + ' MB -> ' + ((12 + 16 + jp.length + bp.length) / 1048576).toFixed(1) + ' MB'); }
}
console.log('TOTAL pictures ' + log.filter((l) => / -> /.test(l)).length + ': files ' + (inB / 1048576).toFixed(1) + ' MB -> ' + (outB / 1048576).toFixed(1) + ' MB; on the graphics chip (with mipmaps) ' + (gpuB / 1048576).toFixed(0) + ' MB as RGBA -> ' + (gpuK / 1048576).toFixed(0) + ' MB as BC7/ASTC');
{ const d = path.join(ROOT, 'art/texhi_ktx2'); if (fs.existsSync(d)) { const names = fs.readdirSync(d).filter((f) => f.endsWith('.ktx2')).sort().map((f) => f.slice(0, -5));
  fs.writeFileSync(path.join(ROOT, 'src/texhi_ktx2.js'), '// generated by tools/makektx2.mjs: the desktop street pictures that have a KTX2 copy (dist/tex/<name>.ktx2; src/quality.js askHi, CONFIG.lag.ktx2.tex)\nexport const TEXK = {\n' + names.map((n) => '  ' + n + ": 'tex/" + n + ".ktx2',").join('\n') + '\n};\n'); } }
fs.mkdirSync(path.join(ROOT, 'art'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'art/ktx2_log.txt'), log.join('\n') + '\n');
