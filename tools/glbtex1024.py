# Textures in a GLB larger than 1024 px are made 1024 px (owner's rule 37; OWNER DECISION Nov 20 16:31 for Marla's and Bram's 2048 skin textures).
# Usage: python3 tools/glbtex1024.py in.glb out.glb [max]   (max default 1024). Same image format (JPEG quality 92, PNG optimised); every other byte is kept.
import json, struct, sys, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
d = open(src, 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]; J = json.loads(d[20:20 + jl]); B = d[20 + jl + 8:]
bvs = J['bufferViews']; data = [B[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in bvs]; changed = []
for im in J.get('images', []):
    if 'bufferView' not in im: continue
    i = im['bufferView']; img = Image.open(io.BytesIO(data[i])); w, h = img.size
    if max(w, h) <= MAX: continue
    k = MAX / max(w, h); img2 = img.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS); out = io.BytesIO()
    if im.get('mimeType') == 'image/png': img2.save(out, 'PNG', optimize=True)
    else: img2.convert('RGB').save(out, 'JPEG', quality=92)
    data[i] = out.getvalue(); changed.append((im.get('name', ''), w, h, img2.size[0], img2.size[1]))
bin_ = b''
for i, v in enumerate(bvs):
    while len(bin_) % 4: bin_ += b'\x00'
    v['byteOffset'] = len(bin_); v['byteLength'] = len(data[i]); bin_ += data[i]
while len(bin_) % 4: bin_ += b'\x00'
J['buffers'][0]['byteLength'] = len(bin_)
js = json.dumps(J, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
out = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(bin_)) + b'BIN\x00' + bin_
open(dst, 'wb').write(out); print(src, '->', dst, len(d) // 1024, 'KB ->', len(out) // 1024, 'KB', changed)
