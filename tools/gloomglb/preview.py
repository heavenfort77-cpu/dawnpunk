# Quick look at a Gloom model in Blender (Cycles CPU, few samples). Usage: python3 tools/gloomglb/preview.py <in.blend> <out.png> [views] [size] [textured]
# views: comma list of front34, back34, side, head, leg. textured=1 uses the materials already on the model (after the bake); else flat colours per class.
import sys, math, os
import bpy
from mathutils import Vector

src, out = sys.argv[1], sys.argv[2]
views = (sys.argv[3] if len(sys.argv) > 3 else 'front34').split(',')
size = int(sys.argv[4]) if len(sys.argv) > 4 else 520
textured = len(sys.argv) > 5 and sys.argv[5] == '1'
if src.endswith('.glb'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    textured = True
else:
    bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene
COL = {'paint': (0.55, 0.42, 0.12, 0, 0.6), 'dark': (0.09, 0.09, 0.08, 0.6, 0.55), 'steel': (0.45, 0.45, 0.43, 1, 0.35), 'chrome': (0.6, 0.6, 0.6, 1, 0.15), 'rubber': (0.025, 0.025, 0.022, 0, 0.9),
       'wire_r': (0.4, 0.05, 0.03, 0, 0.6), 'wire_y': (0.5, 0.38, 0.05, 0, 0.6), 'brass': (0.6, 0.45, 0.2, 1, 0.35), 'core': (0.03, 0.03, 0.03, 0.4, 0.8), 'lens': (0.9, 0.85, 0.6, 0, 0.1), 'bolt': (0.45, 0.45, 0.43, 1, 0.35), 'leafdry': (0.35, 0.2, 0.08, 0, 0.8), 'mud': (0.2, 0.15, 0.09, 0, 0.95), 'crack': (0.01, 0.01, 0.01, 0, 0.5), 'copper': (0.3, 0.45, 0.38, 0.5, 0.5), 'plant': (0.15, 0.3, 0.05, 0, 0.8), 'grassdry': (0.4, 0.33, 0.15, 0, 0.8), 'moss': (0.15, 0.25, 0.05, 0, 0.9)}
if not textured:
    mats = {}
    for k, (r, g, b, m, ro) in COL.items():
        mt = bpy.data.materials.new(k)
        mt.use_nodes = True
        p = mt.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = (r, g, b, 1)
        p.inputs['Metallic'].default_value = m
        p.inputs['Roughness'].default_value = ro
        mats[k] = mt
    for ob in sc.objects:
        if ob.type == 'MESH' and 'cls' in ob:
            ob.data.materials.clear()
            ob.data.materials.append(mats.get(ob['cls'], mats['paint'] if ob['cls'].startswith('paint') else mats['steel']))
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 24
sc.cycles.use_denoising = True
try:
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
sc.render.resolution_x = size
sc.render.resolution_y = int(size * 1.25)
sc.render.film_transparent = False
w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.42, 0.45, 0.5, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
sc.collection.objects.link(sun)
fl = bpy.data.objects.new('floor', bpy.data.meshes.new('floor'))
fl.data.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
sc.collection.objects.link(fl)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
# game front = -z = Blender +y
V = {'bfront': ((0.0, 4.6, 1.25), (0, 0, 1.12), 45), 'b34': ((2.6, 3.6, 1.6), (0, 0, 1.12), 45), 'front34': ((1.6, 3.4, 1.5), (0, 0, 1.1), 45), 'back34': ((-1.7, -3.3, 1.6), (0, 0, 1.1), 45), 'side': ((3.7, 0.2, 1.3), (0, 0, 1.1), 45),
     'head': ((0.45, 0.95, 2.15), (0, 0.0, 2.04), 50), 'lback': ((1.4, -2.6, 1.3), (0, 0, 0.95), 50), 'lfront': ((-1.6, 2.4, 1.4), (0, 0, 0.95), 50), 'lhead': ((-0.35, 0.95, 1.95), (0, 0.24, 1.9), 45), 'lleg': ((-0.8, 1.2, 0.5), (0.2, 0, 0.35), 50), 'tfront': ((-0.6, 0.95, 0.7), (0, 0, 0.22), 45), 'tback': ((0.75, -0.8, 0.75), (0, 0, 0.22), 45), 'hfront': ((-2.0, 3.0, 1.7), (0, 0, 1.1), 50), 'hback': ((1.9, -2.9, 1.8), (0, 0, 1.1), 50), 'sfront': ((-2.6, 3.9, 2.3), (0, 0, 1.7), 50), 'sback': ((2.5, -3.9, 2.4), (0, 0, 1.7), 50), 'lafront': ((-1.9, 2.8, 1.9), (0, 0.15, 1.3), 50), 'laback': ((2.0, -2.6, 2.0), (0, 0.15, 1.3), 50), 'chest': ((0.55, 1.5, 1.5), (0.0, 0, 1.45), 50), 'leg': ((0.75, 1.1, 0.55), (0.2, 0, 0.4), 50), 'torso': ((0.9, 1.4, 1.5), (0.05, 0, 1.45), 50)}
paths = []
for v in views:
    p, t, lens = V[v]
    cam.location = p
    d = Vector(t) - Vector(p)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    o = out.replace('.png', '_' + v + '.png') if len(views) > 1 else out
    sc.render.filepath = o
    bpy.ops.render.render(write_still=True)
    paths.append(o)
if len(paths) > 1:
    from PIL import Image
    ims = [Image.open(q) for q in paths]
    W = sum(i.width for i in ims)
    sh = Image.new('RGB', (W, ims[0].height))
    x = 0
    for i in ims:
        sh.paste(i, (x, 0))
        x += i.width
    sh.save(out)
print('saved', out)
