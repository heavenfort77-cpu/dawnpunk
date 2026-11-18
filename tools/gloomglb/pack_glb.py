# Puts the painted atlas on a raw Gloom GLB and makes it small. Usage: python3 tools/gloomglb/pack_glb.py <raw.glb> <tex_dir> <out.glb> [size] [jpeg quality base,orm,nrm]
# tex_dir holds base.png, orm.png, nrm.png from paint_tex.py. Material gloom_body gets them as base colour, metal-rough (G rough, B metal; R = paint mask the game reads for the tint)
# and normal map. Normals become 1 byte per axis, UVs 2 bytes per axis (KHR_mesh_quantization, read by three.js's GLTFLoader), images JPEG.
import sys, json, struct, io
import numpy as np
from PIL import Image

src, tdir, dst = sys.argv[1], sys.argv[2], sys.argv[3]
SIZE = int(sys.argv[4]) if len(sys.argv) > 4 else 2048
QB, QO, QN = [int(q) for q in (sys.argv[5] if len(sys.argv) > 5 else '86,88,90').split(',')]
d = open(src, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]
J = json.loads(d[20:20 + jl])
B = d[20 + jl + 8:]
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = dict(SCALAR=1, VEC2=2, VEC3=3, VEC4=4, MAT4=16)


def read(i):
    A = J['accessors'][i]
    v = J['bufferViews'][A['bufferView']]
    n = NC[A['type']]
    dt = np.dtype(CT[A['componentType']])
    st = v.get('byteStride') or dt.itemsize * n
    off = v.get('byteOffset', 0) + A.get('byteOffset', 0)
    raw = np.frombuffer(B, np.uint8, A['count'] * st if A['count'] else 0, off) if A['count'] else np.zeros(0, np.uint8)
    if st == dt.itemsize * n:
        return np.frombuffer(raw.tobytes(), dt).reshape(A['count'], n).copy()
    return np.array([np.frombuffer(raw[k * st:k * st + dt.itemsize * n].tobytes(), dt) for k in range(A['count'])])


new = {}
for m in J['meshes']:
    for p in m['primitives']:
        at = p['attributes']
        if 'NORMAL' in at and at['NORMAL'] not in new:
            n = read(at['NORMAL'])
            n /= np.maximum(1e-9, np.linalg.norm(n, axis=1, keepdims=True))
            q = np.zeros((len(n), 4), np.int8)
            q[:, :3] = np.round(n * 127)
            new[at['NORMAL']] = (q, 5120, True, 4)
        if 'TEXCOORD_0' in at and at['TEXCOORD_0'] not in new:
            uv = read(at['TEXCOORD_0'])
            if uv.min() >= -1e-4 and uv.max() <= 1 + 1e-4:
                new[at['TEXCOORD_0']] = (np.round(np.clip(uv, 0, 1) * 65535).astype(np.uint16), 5123, True, None)
        if 'indices' in p and p['indices'] not in new:
            ix = read(p['indices']).reshape(-1)
            if ix.max() < 65536:
                new[p['indices']] = (ix.astype(np.uint16).reshape(-1, 1), 5123, False, None)
# rebuild the binary: one view per accessor, then the images
out = bytearray()
views = []


def add(data, target=None, stride=None):
    while len(out) % 4:
        out.append(0)
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
    if target:
        v['target'] = target
    if stride:
        v['byteStride'] = stride
    out.extend(data)
    views.append(v)
    return len(views) - 1


idx_acc = set(p['indices'] for m in J['meshes'] for p in m['primitives'] if 'indices' in p)
for i, A in enumerate(J['accessors']):
    if i in new:
        arr, ct, norm, stride = new[i]
        A['componentType'] = ct
        if norm:
            A['normalized'] = True
        A.pop('byteOffset', None)
        if 'min' in A and ct != 5126 and i not in idx_acc:
            A.pop('min', None)
            A.pop('max', None)
        A['bufferView'] = add(arr.tobytes(), 34963 if i in idx_acc else 34962, stride)
    else:
        arr = read(i)
        A.pop('byteOffset', None)
        A['bufferView'] = add(arr.astype(CT[A['componentType']]).tobytes(), 34963 if i in idx_acc else 34962)
# images
imgs = []
for name, q in (('base', QB), ('orm', QO), ('nrm', QN)):
    im = Image.open(f'{tdir}/{name}.png').convert('RGB')
    if im.width != SIZE:
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
    bio = io.BytesIO()
    im.save(bio, 'JPEG', quality=q, subsampling=0 if name != 'base' else 2, optimize=True)
    imgs.append({'bufferView': add(bio.getvalue()), 'mimeType': 'image/jpeg', 'name': 'walker_' + name})
    print(name, len(bio.getvalue()) // 1024, 'KB')
J['images'] = imgs
J['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]
J['textures'] = [{'sampler': 0, 'source': k} for k in range(3)]
for m in J['materials']:
    if m['name'] == 'gloom_body':
        m['pbrMetallicRoughness'] = {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 1}, 'metallicFactor': 1.0, 'roughnessFactor': 1.0}
        m['normalTexture'] = {'index': 2}
        m.pop('emissiveFactor', None)
J['bufferViews'] = views
J['buffers'] = [{'byteLength': len(out)}]
for k in ('extensionsUsed', 'extensionsRequired'):
    J[k] = sorted(set(J.get(k, [])) | {'KHR_mesh_quantization'})
js = json.dumps(J, separators=(',', ':')).encode()
while len(js) % 4:
    js += b' '
while len(out) % 4:
    out.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb)
print('wrote', dst, len(glb) // 1024, 'KB')
