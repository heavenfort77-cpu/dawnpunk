# Unwraps a Gloom model into one texture atlas and bakes the data the texture painter needs (Cycles CPU).
# Usage: python3 tools/gloomglb/bake_data.py <model.blend> <out_dir> [size] [ao_samples]
# Writes <out_dir>/data.npz with, per texel: pos (world, Blender axes), nrm (world), cls (class index), ao (ambient occlusion over 0.3 m),
# edge (how sharp the surface turns near the texel, from Cycles' bevel shader), cav (occlusion over 2.5 cm: crevices), cov (texel is on the model);
# and <out_dir>/uv.blend, the model with its atlas UVs (tools/gloomglb/export_glb.py reads it).
import sys, os, math, time
import bpy
import numpy as np

src, odir = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
AOS = int(sys.argv[4]) if len(sys.argv) > 4 else 48
os.makedirs(odir, exist_ok=True)
t0 = time.time()
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene
CLASSES = ['paint', 'dark', 'steel', 'chrome', 'rubber', 'wire_r', 'wire_y', 'brass', 'core', 'paint2', 'plant', 'grassdry', 'moss', 'dial', 'amber', 'tag', 'bolt', 'leafdry', 'mud', 'crack', 'copper']
obs = [o for o in sc.objects if o.type == 'MESH' and o.get('cls') in CLASSES]
other = [o for o in sc.objects if o.type == 'MESH' and o.get('cls') not in CLASSES]

# ---- one atlas for every textured part
for o in sc.objects:
    o.select_set(False)
for o in obs:
    o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin_method='FRACTION', margin=0.002, shape_method='CONCAVE')
bpy.ops.object.mode_set(mode='OBJECT')
print('unwrapped', round(time.time() - t0, 1), 's')

sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.use_denoising = False
sc.render.bake.margin = 24
sc.render.bake.margin_type = 'EXTEND'
w = bpy.data.worlds.new('w')
sc.world = w
w.light_settings.distance = 0.3
for o in other:
    o.hide_render = True


def img(name):
    im = bpy.data.images.new(name, N, N, alpha=True, float_buffer=True)
    im.colorspace_settings.name = 'Non-Color'
    return im


# one material per class; every part is copied and the copies joined into one object for the bake (Cycles sets up a bake per object, so 300 parts would take ages)
CM = {}
for c in CLASSES:
    m = bpy.data.materials.new('b_' + c)
    CM[c] = m
for o in obs:
    o.data.materials.clear()
    o.data.materials.append(CM[o['cls']])
dg = bpy.context.evaluated_depsgraph_get()
copies = []
for o in obs:
    c = o.copy()
    c.data = o.data.copy()
    c.parent = None
    c.matrix_world = o.matrix_world.copy()
    sc.collection.objects.link(c)
    copies.append(c)
for o in sc.objects:
    o.select_set(False)
for c in copies:
    c.select_set(True)
bpy.context.view_layer.objects.active = copies[0]
bpy.ops.object.join()
BK = bpy.context.view_layer.objects.active
BK.name = 'bake_all'
for o in obs:
    o.hide_render = True


def setup(make):
    # make(nt, cls) -> the output socket to bake as emission
    target = img('bake')
    for c, m in CM.items():
        nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        outn = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(em.outputs[0], outn.inputs['Surface'])
        s = make(nt, c)
        if s is not None:
            nt.links.new(s, em.inputs['Color'])
        ti = nt.nodes.new('ShaderNodeTexImage')
        ti.image = target
        nt.nodes.active = ti
    return target


def run(kind, samples):
    t = time.time()
    sc.cycles.samples = samples
    for o in sc.objects:
        o.select_set(False)
    BK.select_set(True)
    bpy.context.view_layer.objects.active = BK
    bpy.ops.object.bake(type=kind, margin=sc.render.bake.margin, use_clear=True)
    print('baked', kind, samples, round(time.time() - t, 1), 's')


def grab(im, ch):
    a = np.empty(N * N * 4, np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(N, N, 4)[:, :, :ch].copy()


D = {}
# coverage: 1 on the model, 0 between islands (no margin)
sc.render.bake.margin = 0
t = setup(lambda nt, c: None)
for m in CM.values():
    m.node_tree.nodes['Emission'].inputs['Color'].default_value = (1, 1, 1, 1)
run('EMIT', 1)
D['cov'] = grab(t, 1)[:, :, 0]
sc.render.bake.margin = 24


def geo(out):
    def f(nt, c):
        return nt.nodes.new('ShaderNodeNewGeometry').outputs[out]
    return f


t = setup(geo('Position'))
run('EMIT', 1)
D['pos'] = grab(t, 3)
t = setup(geo('Normal'))
run('EMIT', 1)
D['nrm'] = grab(t, 3)


def clsv(nt, c):
    v = nt.nodes.new('ShaderNodeValue')
    v.outputs[0].default_value = (CLASSES.index(c) + 0.5) / 32
    return v.outputs[0]


t = setup(clsv)
run('EMIT', 1)
D['cls'] = np.floor(grab(t, 1)[:, :, 0] * 32).astype(np.int8)


def edge(nt, c):
    # R: 1 - dot(bevelled normal, true normal), scaled; G: occlusion within 2.5 cm (crevices, seams)
    bv = nt.nodes.new('ShaderNodeBevel')
    bv.samples = 8
    bv.inputs['Radius'].default_value = 0.008
    g = nt.nodes.new('ShaderNodeNewGeometry')
    dp = nt.nodes.new('ShaderNodeVectorMath')
    dp.operation = 'DOT_PRODUCT'
    nt.links.new(bv.outputs[0], dp.inputs[0])
    nt.links.new(g.outputs['Normal'], dp.inputs[1])
    inv = nt.nodes.new('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    nt.links.new(dp.outputs['Value'], inv.inputs[1])
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
    ao.samples = 12
    ao.inputs['Distance'].default_value = 0.025
    cmb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(inv.outputs[0], cmb.inputs[0])
    nt.links.new(ao.outputs['AO'], cmb.inputs[1])
    return cmb.outputs[0]


t = setup(edge)
run('EMIT', 12)
e = grab(t, 2)
D['edge'], D['cav'] = e[:, :, 0], e[:, :, 1]
t = setup(lambda nt, c: None)
run('AO', AOS)
D['ao'] = grab(t, 1)[:, :, 0]
np.savez_compressed(os.path.join(odir, 'data.npz'), **D)
# keep the UVs; drop the bake copy and materials
bpy.data.objects.remove(BK)
for o in obs:
    o.data.materials.clear()
    o.hide_render = False
for m in list(bpy.data.materials):
    if m.name.startswith('b_'):
        bpy.data.materials.remove(m)
for o in other:
    o.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(odir, 'uv.blend'))
cov = D['cov'].mean()
print('coverage', round(float(cov), 3), 'total', round(time.time() - t0, 1), 's')
