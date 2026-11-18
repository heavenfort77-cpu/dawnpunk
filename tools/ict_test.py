# Test of the USC ICT-FaceKit head (MIT licence): load the neutral head and its sculpted expression shapes, render a rest face, a smile and a crying face.
# Usage: python3 -I ict_test.py   -> /home/claude/marla/out_ict/*.png
import bpy, math, os, numpy as np
from mathutils import Vector
SC = 0.007261      # the kit's units to metres, set so the eyeball is 24 mm
D = '/home/claude/ext/ICT-FaceKit/FaceXModel/'; OUT = '/home/claude/marla/out_ict/'
CFG = dict(
    samples=64, res=(520, 640), skin=(0.76, 0.50, 0.42), sss=1.0, sss_radius=(1.0, 0.35, 0.2), sss_scale=0.003, skin_rough=0.42,
    iris=(0.30, 0.45, 0.50), teeth=(0.88, 0.85, 0.78), gum=(0.62, 0.30, 0.32), lash=(0.05, 0.04, 0.03),
    key=(16, (1.0, 0.96, 0.9)), fill=(3, (0.8, 0.88, 1.0)), rim=(60, (1.0, 0.75, 0.5)),
    exprs={
        'rest': {},
        'smile_open': {'mouthSmile': 0.85, 'cheekSquint': 0.8, 'cheekRaiser': 0.7, 'eyeSquint': 0.55, 'mouthUpperUp': 0.35, 'mouthLowerDown': 0.3, 'jawOpen': 0.12, 'mouthDimple': 0.2, 'noseSneer': 0.12, 'browDown': 0.1},
        '_skip_smile_closed': {'mouthSmile': 0.6, 'cheekSquint': 0.5, 'cheekRaiser': 0.45, 'eyeSquint': 0.3, 'mouthDimple': 0.25},
        'crying': {'browInnerUp': 0.9, 'browDown': 0.45, 'mouthFrown': 0.7, 'mouthShrugLower': 0.6, 'mouthPress': 0.4, 'mouthStretch': 0.25, 'eyeSquint': 0.5, 'cheekSquint': 0.35, 'noseSneer': 0.2, 'eyeLookDown': 0.25},
    })
def load(name):
    V = []; F = []; UV = []; FU = []
    for l in open(D + name + '.obj'):
        if l.startswith('v '): p = l.split(); V.append((float(p[1]) * SC, -float(p[3]) * SC, float(p[2]) * SC))
        elif l.startswith('vt '): p = l.split(); UV.append((float(p[1]), float(p[2])))
        elif l.startswith('f '):
            t = [q.split('/') for q in l.split()[1:]]; F.append([int(q[0]) - 1 for q in t]); FU.append([int(q[1]) - 1 for q in t])
    return np.array(V), F, UV, FU
V0, F, UV, FU = load('generic_neutral_mesh')
F = F[:24692] + F[25304:]      # leave out the tear line and the eye blend and occlusion shells (they need shaders and textures the kit does not ship)
me = bpy.data.meshes.new('ict'); me.from_pydata(V0.tolist(), [], F); me.update()
for p in me.polygons: p.use_smooth = True
ob = bpy.data.objects.new('ict', me); bpy.context.scene.collection.objects.link(ob)
ob.shape_key_add(name='Basis')
names = sorted(set(f[:-4] for f in os.listdir(D) if f.endswith('.obj') and f != 'generic_neutral_mesh.obj'))
for n in names:
    Vn = load(n)[0]; sk = ob.shape_key_add(name=n); sk.data.foreach_set('co', Vn.ravel()); sk.value = 0
def mat(name, color, rough=0.5, sss=0.0, alpha=1.0, spec=0.5, trans=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Alpha'].default_value = alpha
    if sss: b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Subsurface Radius'].default_value = CFG['sss_radius']; b.inputs['Subsurface Scale'].default_value = CFG['sss_scale']
    if trans: b.inputs['Transmission Weight'].default_value = trans
    b.inputs['Specular IOR Level'].default_value = spec; return m
# polygon ranges from the kit's README
R = [('skin', 0, 11143), ('mouth', 11144, 13225), ('socket', 13226, 14033), ('gum', 14034, 17005), ('teeth', 17006, 21495), ('sclera', 21496, 22295), ('iris', 22296, 23093), ('sclera', 23094, 23893), ('iris', 23894, 24691),
     ('lash', 24692, 25771)]
M = {'skin': mat('skin', CFG['skin'], CFG['skin_rough'], CFG['sss']), 'mouth': mat('mouth', (0.25, 0.07, 0.07), 0.5), 'socket': mat('socket', (0.3, 0.12, 0.1), 0.6), 'gum': mat('gum', CFG['gum'], 0.3, 0.5),
     'teeth': mat('teeth', CFG['teeth'], 0.2, 0.4), 'sclera': mat('sclera', (0.86, 0.84, 0.82), 0.12, 0.3), 'iris': mat('iris', CFG['iris'], 0.1), 'fluid': mat('fluid', (1, 1, 1), 0.02, 0, 1.0, 0.5, 1.0),
     'hide': mat('hide', (1, 1, 1), 0.5, 0, 0.0), 'lash': mat('lash', CFG['lash'], 0.6)}
order = list(M); [me.materials.append(M[k]) for k in order]
for k, a, b in R:
    for i in range(a, b + 1): me.polygons[i].material_index = order.index(k)
# iris: dark pupil and dark rim from the distance to each iris centre
it = M['iris'].node_tree; vc = me.color_attributes.new('irisc', 'FLOAT_COLOR', 'POINT')
col = np.ones((len(V0), 4)); col[:, :3] = CFG['iris']
for a, b in ((22221, 23020), (23791, 24590)):
    P = V0[a:b + 1]; c = P[np.argmin(P[:, 1])]; front = P[P[:, 1] < c[1] + 0.004]; cen = front.mean(0); r = np.linalg.norm(P[:, [0, 2]] - cen[[0, 2]], axis=1); rm = np.percentile(r, 97)
    t = r / rm; k = np.where(t < 0.30, 0.02, np.where(t > 0.88, 0.35, 1.0 - 0.35 * np.abs(t - 0.6)))
    col[a:b + 1, :3] = np.array(CFG['iris'])[None] * k[:, None]
vc.data.foreach_set('color', col.ravel())
n = it.nodes.new('ShaderNodeVertexColor'); n.layer_name = 'irisc'; it.links.new(n.outputs['Color'], it.nodes['Principled BSDF'].inputs['Base Color'])
# hide the eye blend and occlusion shells (they need textures the kit does not ship)
scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = CFG['samples']; scn.cycles.use_denoising = True; scn.view_settings.view_transform = 'AgX'
for o in list(bpy.data.objects):
    if o.name in ('Cube', 'Light', 'Camera'): bpy.data.objects.remove(o)
w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.06, 0.08, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.15
ez = float(V0[21451:23021, 2].mean()); print('eye height', ez)
def light(name, loc, power, color, size):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = power; l.color = color; l.size = size; o = bpy.data.objects.new(name, l); scn.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, ez - 0.03)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
light('key', (0.35, -0.7, ez + 0.3), *CFG['key'], 0.5); light('fill', (-0.6, -0.6, ez), *CFG['fill'], 1.0); light('rim', (-0.5, 0.6, ez + 0.3), *CFG['rim'], 0.4)
cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); scn.collection.objects.link(co); scn.camera = co; cam.lens = 85
scn.render.resolution_x, scn.render.resolution_y = CFG['res']
fz0, fz1 = float(V0[:9409, 2].min()), float(V0[:9409, 2].max()); fc = (fz0 + fz1) / 2; dist = 1.3 * (fz1 - fz0) / 2 / math.tan(math.radians(11.95)); print('face height', fz1 - fz0, 'camera distance', dist)
def shot(name, loc):
    loc = (loc[0] * dist / 0.95, loc[1] * dist / 0.95, fc)
    co.location = loc; co.rotation_euler = (Vector((0, 0, fc)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); scn.render.filepath = OUT + name + '.png'; bpy.ops.render.render(write_still=True)
kb = ob.data.shape_keys.key_blocks
for en, rec in CFG['exprs'].items():
    if en.startswith('_'): continue
    for k in kb[1:]: k.value = 0
    for u, wv in rec.items():
        hit = [k for k in kb if k.name == u or k.name in (u + '_L', u + '_R')]
        assert hit, u
        for k in hit: k.value = wv
    shot(en + '_front', (0.0, -0.95, ez - 0.02))
    if en in ('smile_open',): shot(en + '_34', (0.55, -0.78, ez - 0.02))
print('DONE')
