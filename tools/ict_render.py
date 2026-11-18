# Track B first look: render the fitted scan-kit head (ict_fit.npz) bald, neutral and with expressions, same camera as Marla's front shot. Parts coloured by the kit's vertex ranges.
# Usage: python3 -I ict_render.py <out_prefix> [name=weights ...]   e.g. smile=mouthSmile_L:0.9,mouthSmile_R:0.9
import bpy, sys, numpy as np, math
from mathutils import Vector
CFG = dict(samples=96, res=(520, 640), skin=(0.80, 0.62, 0.55), sss=(1.0, 0.56, 0.36), sss_scale=0.0018, iris=(0.30, 0.40, 0.40), lens=85)
FZ = np.load('/home/claude/marla/ict_fit.npz'); V0 = FZ['V']; F = FZ['F']; du = np.load('/home/claude/marla/out_shape5/face_dump.npz'); ex, ey, ez = du['eye']
PARTS = [('skin', 0, 11248), ('mouth', 11248, 13294), ('socket', 13294, 14062), ('gums', 14062, 17039), ('teeth', 17039, 21451), ('eye', 21451, 24591), ('hide', 24591, 25351), ('lash', 25351, 26719)]
def part_of(v):
    for n, a, b in PARTS:
        if a <= v < b: return n
def mat(name, col, rough=0.5, sss=0.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = tuple(col) + (1,); b.inputs['Roughness'].default_value = rough
    if sss: b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Subsurface Radius'].default_value = CFG['sss']; b.inputs['Subsurface Scale'].default_value = CFG['sss_scale']
    return m
scn = bpy.context.scene
for o in list(scn.objects): bpy.data.objects.remove(o)
M = {'skin': mat('skin', CFG['skin'], 0.45, 1.0), 'mouth': mat('mouth', (0.25, 0.06, 0.06), 0.6), 'socket': mat('socket', (0.5, 0.35, 0.33), 0.5), 'gums': mat('gums', (0.75, 0.32, 0.33), 0.35, 0.5), 'teeth': mat('teeth', (0.88, 0.85, 0.78), 0.25, 0.3), 'eye': mat('eye', (0.9, 0.9, 0.88), 0.08), 'lash': mat('lash', (0.05, 0.04, 0.035), 0.6)}
fp = [[int(v) for v in dict.fromkeys(q)] for q in F]; keep = [q for q in fp if part_of(q[0]) != 'hide']
me = bpy.data.meshes.new('ict'); me.from_pydata(V0.tolist(), [], keep); me.update(); ob = bpy.data.objects.new('ict', me); scn.collection.objects.link(ob)
names = ['skin', 'mouth', 'socket', 'gums', 'teeth', 'eye', 'lash']
for n in names: me.materials.append(M[n])
for p in me.polygons: p.use_smooth = True; p.material_index = names.index(part_of(p.vertices[0]))
# iris and pupil painted on the eyeballs by direction from the eyeball centre (vertex colours mixed into the eye material)
col = me.color_attributes.new('c', 'FLOAT_COLOR', 'POINT'); C4 = np.ones((len(V0), 4))
for a, b in ((21451, 23021), (23021, 24591)):
    E = V0[a:b]; c = E.mean(0); R = np.abs(E - c).max(); d = (E - c) / np.linalg.norm(E - c, axis=1, keepdims=True); ang = np.degrees(np.arccos(np.clip(-d[:, 1], -1, 1)))
    C4[a:b, :3] = np.where((ang < 17)[:, None], np.where((ang < 6.5)[:, None], 0.02, np.array(CFG['iris'])), np.array((0.92, 0.9, 0.88)))
col.data.foreach_set('color', C4.ravel()); vc = M['eye'].node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'c'; M['eye'].node_tree.links.new(vc.outputs[0], M['eye'].node_tree.nodes['Principled BSDF'].inputs['Base Color'])
ob.shape_key_add(name='Basis')
for arg in sys.argv[2:]:
    nm, ws = arg.split('=', 1); k = ob.shape_key_add(name=nm); D = sum(float(w_) * FZ['ex_' + e_] for e_, w_ in (p_.split(':') for p_ in ws.split(','))); k.data.foreach_set('co', (V0 + D).ravel())
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); scn.collection.objects.link(co); scn.camera = co; cam.lens = CFG['lens']
co.location = (0, -0.95, ez - 0.02); co.rotation_euler = (Vector((0, -0.05, ez - 0.035)) - Vector(co.location)).to_track_quat('-Z', 'Y').to_euler()
def light(n, loc, p, c, size):
    L = bpy.data.lights.new(n, 'AREA'); L.energy = p; L.color = c; L.size = size; o = bpy.data.objects.new(n, L); scn.collection.objects.link(o); o.location = loc; o.rotation_euler = (Vector((0, 0, ez)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
light('key', (0.7, -1.8, ez + 0.6), 48, (0.78, 0.87, 1.0), 1.2); light('fill', (-1.6, -1.6, ez), 10, (1, 1, 1), 2.0); light('rim', (-1.2, 1.7, ez + 0.4), 140, (1.0, 0.75, 0.55), 0.8)
w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.06, 0.08, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
scn.render.engine = 'CYCLES'; scn.cycles.samples = CFG['samples']; scn.cycles.use_denoising = True; scn.render.resolution_x, scn.render.resolution_y = CFG['res']; scn.view_settings.view_transform = 'Standard'
sd = ob.modifiers.new('sd', 'SUBSURF'); sd.levels = 0; sd.render_levels = 1
shots = ['neutral'] + [a.split('=')[0] for a in sys.argv[2:]]
for i, nm in enumerate(shots):
    for k in ob.data.shape_keys.key_blocks[1:]: k.value = 1.0 if k.name == nm else 0.0
    scn.render.filepath = sys.argv[1] + '_' + nm + '.png'; bpy.ops.render.render(write_still=True); print('RENDERED', nm)
