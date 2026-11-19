// Lossless GLB compression (R3, owner 14:10: under 20 MB before the base, no visual loss): every vertex-attribute and index buffer view of a GLB is stored with
// EXT_meshopt_compression, filter NONE and no quantization (the bytes come back exactly as they were); images and all other data stay as they are.
// Used by build.mjs for dist/models. Usage (proof): node tools/meshopt_glb.mjs verify <a.glb> ...   decodes each compressed view with three.js's own decoder
// (three/examples/jsm/libs/meshopt_decoder.module.js) and compares it byte for byte with the original, and compares the accessors' counts.
import fs from 'fs';
import { MeshoptEncoder } from 'meshoptimizer';

const EXT = 'EXT_meshopt_compression';
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

// the JSON and binary chunks of a GLB
export function readGlb(buf) {
  const jl = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8'));
  const bin = buf.length > 20 + jl ? buf.subarray(20 + jl + 8, 20 + jl + 8 + buf.readUInt32LE(20 + jl)) : Buffer.alloc(0);
  return { json, bin };
}
function writeGlb(json, bin) {
  let js = Buffer.from(JSON.stringify(json), 'utf8'); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const bp = (4 - (bin.length % 4)) % 4, b = Buffer.concat([bin, Buffer.alloc(bp)]), total = 12 + 8 + js.length + 8 + b.length, h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(b.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, jh, js, bh, b]);
}

// which views can be compressed: views used only by mesh vertex attributes (ATTRIBUTES, by the element stride) or only by indices (INDICES, exact order)
function plan(json) {
  const use = new Map(), add = (acc, kind) => { const a = json.accessors[acc]; if (!a || a.bufferView === undefined || a.sparse) return; const u = use.get(a.bufferView) || []; u.push([kind, a]); use.set(a.bufferView, u); };
  for (const m of json.meshes || []) for (const pr of m.primitives) { if (pr.extensions && Object.keys(pr.extensions).length) continue; for (const k in pr.attributes) add(pr.attributes[k], 'attr'); for (const t of pr.targets || []) for (const k in t) add(t[k], 'attr'); if (pr.indices !== undefined) add(pr.indices, 'index'); }
  // a view also used by anything else (skins, animations, images) is left as it is
  const other = new Set(); for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) other.add(json.accessors[s.inverseBindMatrices].bufferView);
  for (const an of json.animations || []) for (const sm of an.samplers) { other.add(json.accessors[sm.input].bufferView); other.add(json.accessors[sm.output].bufferView); }
  for (const im of json.images || []) if (im.bufferView !== undefined) other.add(im.bufferView);
  const out = new Map();
  for (const [v, list] of use) { if (other.has(v)) continue; const bv = json.bufferViews[v]; if (!bv || bv.buffer !== 0 || (bv.extensions && bv.extensions[EXT])) continue;
    const kinds = new Set(list.map((x) => x[0])); if (kinds.size !== 1) continue;
    if (kinds.has('index')) { const cs = new Set(list.map((x) => COMP[x[1].componentType])); if (cs.size !== 1) continue; const size = [...cs][0]; if (size !== 2 && size !== 4) continue; if (bv.byteLength % size) continue; out.set(v, { mode: 'INDICES', size, count: bv.byteLength / size }); continue; }
    const el = (a) => COMP[a.componentType] * NUM[a.type], stride = bv.byteStride || (new Set(list.map((x) => el(x[1]))).size === 1 ? el(list[0][1]) : 0);
    if (!stride || stride % 4 || stride > 256 || bv.byteLength % stride) continue; out.set(v, { mode: 'ATTRIBUTES', size: stride, count: bv.byteLength / stride }); }
  return out;
}

// returns { out (Buffer), stats } ; a GLB that already uses the extension, or has nothing to compress, comes back unchanged
export async function meshoptGlb(buf) {
  await MeshoptEncoder.ready;
  const { json, bin } = readGlb(buf);
  if ((json.extensionsUsed || []).includes(EXT) || !json.bufferViews || !json.buffers || json.buffers.length !== 1) return { out: buf, stats: { views: 0, before: buf.length, after: buf.length } };
  const P = plan(json); if (!P.size) return { out: buf, stats: { views: 0, before: buf.length, after: buf.length } };
  const parts = []; let off = 0; const put = (b) => { const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; } const at = off; parts.push(Buffer.from(b.buffer, b.byteOffset, b.byteLength)); off += b.byteLength; return at; };
  // the fallback buffer (no data: the extension's data is required) keeps every compressed view's original place and length
  let fbLen = 0;
  json.bufferViews.forEach((bv, i) => {
    const src = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), p = P.get(i);
    if (!p) { bv.byteOffset = put(src); return; }
    const enc = MeshoptEncoder.encodeGltfBuffer(new Uint8Array(src.buffer, src.byteOffset, src.byteLength), p.count, p.size, p.mode, 0);
    const at = put(enc), fo = fbLen + ((4 - (fbLen % 4)) % 4); fbLen = fo + bv.byteLength;
    bv.extensions = { ...(bv.extensions || {}), [EXT]: { buffer: 0, byteOffset: at, byteLength: enc.byteLength, byteStride: p.size, count: p.count, mode: p.mode, filter: 'NONE' } };
    bv.buffer = 1; bv.byteOffset = fo;
  });
  const body = Buffer.concat(parts);
  json.buffers = [{ byteLength: body.length }, { byteLength: fbLen, extensions: { [EXT]: { fallback: true } } }];
  json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), EXT])]; json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), EXT])];
  const out = writeGlb(json, body);
  return { out, stats: { views: P.size, before: buf.length, after: out.length } };
}

// proof: every compressed view decodes (three.js's decoder) to the original bytes; accessors, meshes and images unchanged
export async function verifyGlb(orig, comp) {
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js'); await MeshoptDecoder.ready;
  const A = readGlb(orig), B = readGlb(comp); const bad = []; let views = 0, verts = 0;
  if (JSON.stringify(A.json.accessors) !== JSON.stringify(B.json.accessors)) bad.push('accessors differ');
  if (JSON.stringify(A.json.meshes) !== JSON.stringify(B.json.meshes)) bad.push('meshes differ');
  if ((A.json.images || []).length !== (B.json.images || []).length) bad.push('image count differs');
  B.json.bufferViews.forEach((bv, i) => { const a = A.json.bufferViews[i], want = A.bin.subarray(a.byteOffset || 0, (a.byteOffset || 0) + a.byteLength); let got;
    const e = bv.extensions && bv.extensions[EXT];
    if (e) { views++; got = new Uint8Array(e.count * e.byteStride); MeshoptDecoder.decodeGltfBuffer(got, e.count, e.byteStride, B.bin.subarray(e.byteOffset, e.byteOffset + e.byteLength), e.mode, e.filter); got = Buffer.from(got.buffer, got.byteOffset, bv.byteLength); }
    else got = B.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    if (!want.equals(got)) bad.push('view ' + i + ' differs'); });
  for (const m of A.json.meshes || []) for (const pr of m.primitives) if (pr.attributes.POSITION !== undefined) verts += A.json.accessors[pr.attributes.POSITION].count;
  return { ok: !bad.length, bad, views, verts };
}

if (process.argv[2] === 'verify') {
  for (const f of process.argv.slice(3)) { const orig = fs.readFileSync(f), { out, stats } = await meshoptGlb(orig), v = await verifyGlb(orig, out);
    console.log((v.ok ? 'PASS ' : 'FAIL ') + f.split('/').pop() + ': ' + (stats.before / 1048576).toFixed(2) + ' -> ' + (stats.after / 1048576).toFixed(2) + ' MB, ' + stats.views + ' views compressed, every view decodes to the same bytes: ' + v.ok + (v.bad.length ? ' ' + v.bad.slice(0, 4).join(', ') : '') + ', vertices ' + v.verts); }
}
