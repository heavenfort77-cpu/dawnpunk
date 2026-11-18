# Joins a baked Gloom model into one mesh per moving part and exports a GLB (geometry, nodes, two plain materials).
# Usage: python3 tools/gloomglb/export_glb.py <uv.blend> <out_raw.glb>
# Materials: gloom_body (every textured part; tools/gloomglb/pack_glb.py puts the painted atlas on it) and gloom_lens (lamp glass; the game makes it glow).
# The ram nodes (ramc_*, ramr_*) stay separate meshes: the game turns them every frame so the rod slides in the cylinder.
import sys
import bpy

src, out = sys.argv[1], sys.argv[2]
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.get('cutter'):
        bpy.data.objects.remove(o)


def mat(name, col, rough, metal, emit=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = col
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = emit
        p.inputs['Emission Strength'].default_value = 1.0
    return m


body = mat('gloom_body', (1, 1, 1, 1), 1, 1)
lens = mat('gloom_lens', (0.9, 0.88, 0.78, 1), 0.1, 0.0, (0.25, 0.22, 0.15, 1))
groups = [o for o in sc.objects if o.type == 'EMPTY' and o.name != 'screen']
for g in groups:
    kids = [o for o in g.children if o.type == 'MESH' and not o.name.startswith('ram')]
    if not kids:
        continue
    for o in kids:
        o.data.materials.clear()
        o.data.materials.append(lens if o.get('cls') == 'lens' else body)
    bpy.ops.object.select_all(action='DESELECT')
    for o in kids:
        o.select_set(True)
    bpy.context.view_layer.objects.active = kids[0]
    if len(kids) > 1:
        bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = g.name + '_m'
    j.data.name = g.name + '_m'
for o in sc.objects:
    if o.type == 'MESH' and o.name.startswith('ram'):
        o.data.materials.clear()
        o.data.materials.append(body)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sc.objects if o.type == 'MESH')
print('meshes', len([o for o in sc.objects if o.type == 'MESH']), 'triangles', tris)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True, export_texcoords=True, export_normals=True, export_tangents=False,
                          export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False, export_skins=False, export_morph=False, use_selection=False)
print('exported', out)
