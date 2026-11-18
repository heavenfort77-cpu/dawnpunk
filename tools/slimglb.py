# Shrinks a character GLB without any outside tool (2026-11-14). Usage: python3 tools/slimglb.py in.glb out.glb
# What it does: normals -> 1 byte per axis, skin weights -> 1 byte each, UVs in 0..1 -> 2 bytes each, skinned positions -> 2 bytes per axis
# (the skeleton's inverse bind matrices and the morph targets are rescaled to match), PNG images without transparency -> JPEG.
# Needs the KHR_mesh_quantization extension, which three.js's GLTFLoader reads by itself.
import json, struct, sys, io
import numpy as np
from PIL import Image
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}; NC = dict(SCALAR=1, VEC2=2, VEC3=3, VEC4=4, MAT4=16)
src, dst = sys.argv[1], sys.argv[2]; d = open(src, 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]; J = json.loads(d[20:20 + jl]); B = d[20 + jl + 8:]
bvs, accs = J['bufferViews'], J['accessors']; blobs = {}   # new data per bufferView index
def view(i): v = bvs[i]; return B[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
def read(a):
    A = accs[a]; v = bvs[A['bufferView']]; n = NC[A['type']]; dt = np.dtype(CT[A['componentType']]); st = v.get('byteStride') or dt.itemsize * n; raw = view(A['bufferView'])[A.get('byteOffset', 0):]
    return np.array([np.frombuffer(raw, dt, n, k * st) for k in range(A['count'])]) if st != dt.itemsize * n else np.frombuffer(raw, dt, A['count'] * n).reshape(A['count'], n).copy()
def put(a, arr, ctype, normalized, stride=None):
    A = accs[a]; arr = np.ascontiguousarray(arr.astype(CT[ctype])); row = arr.dtype.itemsize * arr.shape[1]; st = stride or row
    if st != row: pad = np.zeros((arr.shape[0], st), np.uint8); pad[:, :row] = arr.view(np.uint8).reshape(arr.shape[0], row); data = pad.tobytes()
    else: data = arr.tobytes()
    bvs.append({'buffer': 0, 'byteLength': len(data), **({'byteStride': st} if stride else {}), **({'target': 34962} if stride else {})}); blobs[len(bvs) - 1] = data
    A['bufferView'] = len(bvs) - 1; A.pop('byteOffset', None); A['componentType'] = ctype; A['normalized'] = bool(normalized)
    if not normalized: A.pop('normalized')
prims = [p for m in J['meshes'] for p in m['primitives']]; skinned = [p for p in prims if 'JOINTS_0' in p['attributes']]
done = set(); S = 1.0
if skinned:
    mx = max(float(np.abs(read(p['attributes']['POSITION'])).max()) for p in skinned); S = float(int(32000 / mx))
for p in prims:
    at = p['attributes']
    if 'NORMAL' in at and at['NORMAL'] not in done: n = read(at['NORMAL']); n /= np.maximum(1e-9, np.linalg.norm(n, axis=1, keepdims=True)); put(at['NORMAL'], np.round(n * 127), 5120, True, 4); done.add(at['NORMAL'])
    if 'WEIGHTS_0' in at and at['WEIGHTS_0'] not in done:
        w = read(at['WEIGHTS_0']); w = w / np.maximum(1e-9, w.sum(1, keepdims=True)); q = np.round(w * 255).astype(np.int32); q[np.arange(len(q)), q.argmax(1)] += 255 - q.sum(1); put(at['WEIGHTS_0'], q, 5121, True, 4); done.add(at['WEIGHTS_0'])
    if 'TEXCOORD_0' in at and at['TEXCOORD_0'] not in done:
        u = read(at['TEXCOORD_0']); done.add(at['TEXCOORD_0'])
        if u.min() >= 0 and u.max() <= 1: put(at['TEXCOORD_0'], np.round(u * 65535), 5123, True, 4)
    if p in skinned and at['POSITION'] not in done:
        v = np.round(read(at['POSITION']) * S); A = accs[at['POSITION']]; put(at['POSITION'], v, 5122, False, 8); A['min'] = [int(x) for x in v.min(0)]; A['max'] = [int(x) for x in v.max(0)]; done.add(at['POSITION'])
        for t in p.get('targets', []):
            a = t.get('POSITION')
            if a is None or a in done: continue
            done.add(a); T = accs[a]
            if 'sparse' in T: vv = T['sparse']['values']; arr = np.frombuffer(view(vv['bufferView'])[vv.get('byteOffset', 0):], np.float32, T['sparse']['count'] * 3) * S; bvs.append({'buffer': 0, 'byteLength': arr.nbytes}); blobs[len(bvs) - 1] = arr.astype(np.float32).tobytes(); vv['bufferView'] = len(bvs) - 1; vv.pop('byteOffset', None)
            else: put(a, read(a) * S, 5126, False)
            for k in ('min', 'max'):
                if k in T: T[k] = [x * S for x in T[k]]
for sk in J.get('skins', []):
    a = sk.get('inverseBindMatrices')
    if a is None or a in done or not skinned: continue
    done.add(a); m = read(a); m[:, :12] /= S; put(a, m, 5126, False)
for im in J.get('images', []):
    if im.get('mimeType') != 'image/png' or 'bufferView' not in im: continue
    pic = Image.open(io.BytesIO(view(im['bufferView'])))
    if pic.mode in ('RGBA', 'LA', 'P') and np.array(pic.convert('RGBA'))[:, :, 3].min() < 250: continue
    pic = pic.convert('RGB'); 
    if max(pic.size) > 256 and len(sys.argv) > 3: pic = pic.resize((256, 256), Image.LANCZOS)
    o = io.BytesIO(); pic.save(o, 'JPEG', quality=85); bvs.append({'buffer': 0, 'byteLength': o.tell()}); blobs[len(bvs) - 1] = o.getvalue(); im['bufferView'] = len(bvs) - 1; im['mimeType'] = 'image/jpeg'
# rebuild the buffer with only the views still in use
used = set(); 
for A in accs:
    if 'bufferView' in A: used.add(A['bufferView'])
    if 'sparse' in A: used.add(A['sparse']['indices']['bufferView']); used.add(A['sparse']['values']['bufferView'])
for im in J.get('images', []):
    if 'bufferView' in im: used.add(im['bufferView'])
order = sorted(used); remap = {o: i for i, o in enumerate(order)}; out = bytearray(); nb = []
for o in order:
    data = blobs.get(o) or view(o); 
    while len(out) % 4: out.append(0)
    v = dict(bvs[o]); v['byteOffset'] = len(out); v['byteLength'] = len(data); out += data; nb.append(v)
for A in accs:
    if 'bufferView' in A: A['bufferView'] = remap[A['bufferView']]
    if 'sparse' in A: A['sparse']['indices']['bufferView'] = remap[A['sparse']['indices']['bufferView']]; A['sparse']['values']['bufferView'] = remap[A['sparse']['values']['bufferView']]
for im in J.get('images', []):
    if 'bufferView' in im: im['bufferView'] = remap[im['bufferView']]
while len(out) % 4: out.append(0)
J['bufferViews'] = nb; J['buffers'] = [{'byteLength': len(out)}]
for k in ('extensionsUsed', 'extensionsRequired'): J[k] = sorted(set(J.get(k, []) + ['KHR_mesh_quantization']))
js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print(src.split('/')[-1], len(d) // 1024, '->', (28 + len(js) + len(out)) // 1024, 'KB, position scale', S)
