# BASE PEOPLE copy of tools/marla_ao.py (Nov 16, Bram scan sample 2): the skin also ignores the HAT as a blocker (the brim darkened the whole face), and the new lashes are skipped.
# Bakes ambient occlusion into Marla's desktop model as vertex colours (COLOR_0), so the game can darken the hollows the way the pick-18 render does
# (eye sockets, under the brows, nostrils, lip corners, under and inside the hair). Every mesh shares one armature space (one skin), so the rest pose is the raw positions.
# The file is gltfpack-quantized (KHR_mesh_quantization): positions are integers whose scale sits in the inverse bind matrices, so they are scaled by that; normals are signed bytes (direction only, so unscaled).
# Usage: python3 tools/marla_ao.py <in.glb> <out.glb> [rays] ; settings in AO below. Uses Blender's mathutils BVH tree (the bpy module), no Blender scene.
import json, struct, sys, math, random
import numpy as np
import bpy  # noqa: F401  (makes mathutils importable from the bpy module)
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# targets: mesh -> [ray length m, whole sphere (cards) or hemisphere, meshes NOT counted as blockers for it]; skin ignores the hair (hair cards shading the cheek sides read as sunken cheeks, owner Nov 16); skip: meshes that do not block light (glass, hidden cards, thin lashes)
AO = {'targets': {'scan_skin': [0.12, False, ('hair', 'hat')], 'body': [0.12, False, ('hair', 'hat')], 'scan_mouth': [0.05, False, ()], 'hair': [0.07, True, ()], 'collar': [0.1, False, ()], 'suit': [0.12, False, ()], 'coat': [0.12, False, ()]},
      'skip': ('cornea_l', 'cornea_r', 'crinkle', 'brow_l', 'brow_r', 'lashes', 'lash_scan'), 'offset': 0.0008, 'seed': 7}
CT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def load(path):
    d = open(path, 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + jl]); o = 20 + jl; bl = struct.unpack('<I', d[o:o + 4])[0]; return j, bytearray(d[o + 8:o + 8 + bl])

def read(j, b, ai):
    a = j['accessors'][ai]; v = j['bufferViews'][a['bufferView']]; n = NC[a['type']]; t = CT[a['componentType']]; sz = struct.calcsize(t)
    st = v.get('byteStride', sz * n); base = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    raw = np.frombuffer(bytes(b[base:base + st * (a['count'] - 1) + sz * n]), dtype=np.uint8)
    if st == sz * n: return np.frombuffer(raw.tobytes(), dtype=np.dtype(t)).reshape(a['count'], n).astype(np.float64)
    return np.array([np.frombuffer(raw[i * st:i * st + sz * n].tobytes(), dtype=np.dtype(t)) for i in range(a['count'])], dtype=np.float64)

def main():
    src, dst = sys.argv[1], sys.argv[2]; rays = int(sys.argv[3]) if len(sys.argv) > 3 else 64; j, b = load(src); rnd = random.Random(AO['seed'])
    ibm = read(j, b, j['skins'][0]['inverseBindMatrices'])[0].reshape(4, 4); unit = float(np.linalg.norm(ibm[0, :3])); print('metres per position unit', unit)
    meshes = {}
    for nd in j['nodes']:
        if 'mesh' not in nd: continue
        m = j['meshes'][nd['mesh']]
        for pi, p in enumerate(m['primitives']):
            P = read(j, b, p['attributes']['POSITION']) * unit; N = read(j, b, p['attributes']['NORMAL']); I = read(j, b, p['indices']).astype(int).reshape(-1, 3)
            meshes.setdefault(m['name'], []).append((pi, P, N, I))
    trees = {}
    def tree_for(ign):
        if ign in trees: return trees[ign]
        verts, tris = [], []
        for name, prims in meshes.items():
            if name in AO['skip'] or name in ign: continue
            for _, P, _, I in prims: o = len(verts); verts += [Vector(v) for v in P]; tris += [tuple(int(x) + o for x in t) for t in I]
        trees[ign] = BVHTree.FromPolygons(verts, tris, all_triangles=True); print('occluder triangles', len(tris), 'without', ign); return trees[ign]
    dirs = []
    for k in range(rays):
        u, v = (k + rnd.random()) / rays, rnd.random(); r = math.sqrt(u); ph = 2 * math.pi * v; dirs.append((r * math.cos(ph), r * math.sin(ph), math.sqrt(max(0.0, 1 - u))))
    newb = bytearray(b)
    for name, (dist, sphere, ign) in AO['targets'].items():
        tree = tree_for(tuple(ign))
        for pi, P, N, _ in meshes.get(name, []):
            out = np.zeros((len(P), 4), dtype=np.uint8)
            for i in range(len(P)):
                n = Vector(N[i]).normalized(); t = n.orthogonal().normalized(); bt = n.cross(t); open_ = 0.0; tot = 0
                for side in ((1, -1) if sphere else (1,)):
                    nn = n * side; o = Vector(P[i]) + nn * AO['offset']
                    for dx, dy, dz in dirs:
                        dv = (t * dx + bt * dy * side + nn * dz); hit = tree.ray_cast(o, dv, dist)
                        tot += 1; open_ += 1.0 if hit[0] is None else min(1.0, hit[3] / dist)
                a = open_ / tot; out[i] = (round(a * 255),) * 3 + (255,)
            while len(newb) % 4: newb.append(0)
            off = len(newb); newb += out.tobytes()
            j['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': out.nbytes})
            j['accessors'].append({'bufferView': len(j['bufferViews']) - 1, 'componentType': 5121, 'normalized': True, 'count': len(P), 'type': 'VEC4'})
            mm = [m for m in j['meshes'] if m['name'] == name][0]; mm['primitives'][pi]['attributes']['COLOR_0'] = len(j['accessors']) - 1
            print('%s prim %d: %d vertices, mean openness %.2f, darkest 5%% %.2f' % (name, pi, len(P), out[:, 0].mean() / 255, np.percentile(out[:, 0], 5) / 255))
    while len(newb) % 4: newb.append(0)
    j['buffers'][0]['byteLength'] = len(newb); js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(newb)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total)); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(newb), 0x004E4942)); f.write(newb)
    print('wrote', dst, round(total / 1e3), 'KB')

main()
