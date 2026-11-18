# Lag fix (lag report Nov 18, finding 5; owner approved Nov 19): the Gloom and boss models carried three 2048 px JPEG maps each (24 in all, about 0.5 GB of video
# memory once uploaded). This writes each map at 1024 px (Lanczos, JPEG quality Q) back into the GLB; geometry, nodes, materials and every other byte stay as they were.
# The 2048 px originals are kept in art/models_hi_src2048/ (copied there once, before the first change; this script always reads from there, so it can be run again).
# Usage: python3 tools/glbtex.py [size] [quality]      (defaults 1024 and 90); prints each file's size before and after.
import json, struct, sys, io, os, shutil
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC, DST = os.path.join(ROOT, 'art', 'models_hi_src2048'), os.path.join(ROOT, 'art', 'models_hi')
SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 1024
Q = int(sys.argv[2]) if len(sys.argv) > 2 else 90
FILES = [f for f in sorted(os.listdir(DST)) if f.endswith('.glb') and (f.startswith('gloom_') or f.startswith('boss_'))]
os.makedirs(SRC, exist_ok=True)
for f in FILES:
    if not os.path.exists(os.path.join(SRC, f)): shutil.copy2(os.path.join(DST, f), os.path.join(SRC, f))


def read(path):
    d = open(path, 'rb').read(); assert d[:4] == b'glTF'
    n = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + n]); o = 20 + n
    bn = struct.unpack('<I', d[o:o + 4])[0]; assert d[o + 4:o + 8] == b'BIN\x00'
    return j, d[o + 8:o + 8 + bn]


def write(path, j, binv):
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    binv += b'\x00' * ((4 - len(binv) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binv)
    open(path, 'wb').write(b'glTF' + struct.pack('<II', 2, total) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(binv)) + b'BIN\x00' + binv)


for f in FILES:
    j, b = read(os.path.join(SRC, f))
    imgView = {im['bufferView']: im for im in j.get('images', []) if 'bufferView' in im}
    # maps that hold data in each channel (normals, metal-rough-paint mask) keep full colour resolution (no chroma subsampling)
    data = set()
    for m in j.get('materials', []):
        for t in [m.get('normalTexture'), (m.get('pbrMetallicRoughness') or {}).get('metallicRoughnessTexture'), m.get('occlusionTexture')]:
            if t: data.add(j['textures'][t['index']]['source'])
    dataView = {j['images'][k]['bufferView'] for k in data if 'bufferView' in j['images'][k]}
    out = bytearray(); changed = 0
    for i, bv in enumerate(j['bufferViews']):
        assert bv.get('buffer', 0) == 0
        chunk = b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        if i in imgView:
            im = Image.open(io.BytesIO(chunk))
            if max(im.size) > SIZE and imgView[i].get('mimeType') == 'image/jpeg':
                im = im.convert('RGB').resize((SIZE, SIZE * im.size[1] // im.size[0]), Image.LANCZOS)
                buf = io.BytesIO(); im.save(buf, 'JPEG', quality=Q, optimize=True, subsampling=0 if i in dataView else 2); chunk = buf.getvalue(); changed += 1
        while len(out) % 4: out += b'\x00'
        bv['byteOffset'] = len(out); bv['byteLength'] = len(chunk); out += chunk
    j['buffers'][0]['byteLength'] = len(out)
    write(os.path.join(DST, f), j, bytes(out))
    print(f, 'maps resized', changed, '|', round(os.path.getsize(os.path.join(SRC, f)) / 1048576, 2), 'MB ->', round(os.path.getsize(os.path.join(DST, f)) / 1048576, 2), 'MB')
