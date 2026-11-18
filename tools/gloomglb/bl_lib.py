# Geometry helpers for the desktop Gloom models (Blender 5 as the Python module bpy, headless).
# Everything is modelled in the GAME's axes (three.js: x right, y up, front of a machine is -z) and converted to Blender's axes
# (z up) when a mesh is stored, so the numbers here read like the ones in src/gloomhi.js. C converts a game point to Blender.
import bpy, bmesh, math
from mathutils import Vector, Matrix

PI = math.pi
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
CI = C.inverted()
I4 = Matrix.Identity(4)


def T(x=0, y=0, z=0):
    return Matrix.Translation((x, y, z))


def R(ax, a):
    return Matrix.Rotation(a, 4, ax)


def S(x, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    m = Matrix.Identity(4)
    m[0][0], m[1][1], m[2][2] = x, y, z
    return m


def aim_y(d):
    # rotation that turns +y onto direction d (game axes)
    d = Vector(d).normalized()
    return Vector((0, 1, 0)).rotation_difference(d).to_matrix().to_4x4()


# ---------------------------------------------------------------- bmesh builders (game axes)
def bm_box(w, h, d, M=I4):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=M @ S(w, h, d), verts=bm.verts)
    return bm


def bm_lathe(prof, seg, M=I4, cap0=True, cap1=True, closed=False, phase=0.0, arc=None):
    # prof: [(radius, y)] from bottom to top; revolved about the y axis; arc = (start, length) for an open part of a turn
    bm = bmesh.new()
    rings = []
    n = seg + 1 if arc else seg
    for (r, y) in prof:
        ring = []
        for i in range(n):
            a = (arc[0] + arc[1] * i / seg) if arc else phase + 2 * PI * i / seg
            ring.append(bm.verts.new((r * math.sin(a), y, r * math.cos(a))))
        rings.append(ring)
    nr = len(rings)
    rng = range(nr) if closed else range(nr - 1)
    for j in rng:
        A, B = rings[j], rings[(j + 1) % nr]
        for i in range(seg):
            i2 = i + 1 if arc else (i + 1) % seg
            try:
                bm.faces.new((A[i], A[i2], B[i2], B[i]))
            except ValueError:
                pass
    if not closed and not arc:
        if cap0 and prof[0][0] > 1e-5:
            bm.faces.new(list(reversed(rings[0])))
        if cap1 and prof[-1][0] > 1e-5:
            bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def bm_cyl(r0, r1, h, seg, M=I4, caps=True):
    # along y, from -h/2 (radius r0) to +h/2 (radius r1)
    return bm_lathe([(r0, -h / 2), (r1, h / 2)], seg, M, caps, caps)


def bm_torus(R0, r, seg, sides, M=I4):
    prof = [(R0 + r * math.cos(2 * PI * k / sides), r * math.sin(2 * PI * k / sides)) for k in range(sides)]
    return bm_lathe(prof, seg, M, closed=True)


def bm_loft(sections, M=I4, cap0=True, cap1=True, closed=False):
    # sections: lists of (x, y, z) points with the same count, joined in order (a closed ring each); closed: the last section joins the first (a ring-shaped solid)
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in s] for s in sections]
    n = len(sections[0])
    if closed:
        rings.append(rings[0])
        cap0 = cap1 = False
    for j in range(len(rings) - 1):
        A, B = rings[j], rings[j + 1]
        for i in range(n):
            bm.faces.new((A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]))
    if cap0:
        bm.faces.new(list(reversed(rings[0])))
    if cap1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def rrect(w, h, r, n=3):
    # a rounded rectangle in the x/y plane, corner radius r with n steps per corner
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, PI / 2), (-w / 2 + r, -h / 2 + r, PI), (w / 2 - r, -h / 2 + r, 1.5 * PI)):
        for k in range(n + 1):
            a = a0 + (PI / 2) * k / n
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def bm_tube(pts, r, sides=6, sub=6, M=I4, caps=True):
    # a cable or hose through points (Catmull-Rom), parallel-transport frames
    P = [Vector(p) for p in pts]
    if len(P) == 2:
        P = [P[0], P[0].lerp(P[1], 0.5), P[1]]
    Q = []
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(sub):
            t = k / sub
            t2, t3 = t * t, t * t * t
            Q.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    Q.append(P[-1])
    tans = []
    for i in range(len(Q)):
        a, b = Q[max(0, i - 1)], Q[min(len(Q) - 1, i + 1)]
        tans.append((b - a).normalized())
    up = Vector((0, 1, 0)) if abs(tans[0].y) < 0.9 else Vector((1, 0, 0))
    nrm = tans[0].cross(up).normalized()
    sections = []
    for i, q in enumerate(Q):
        if i:
            rot = tans[i - 1].rotation_difference(tans[i])
            nrm = (rot @ nrm).normalized()
        bn = tans[i].cross(nrm).normalized()
        sections.append([tuple(q + (nrm * math.cos(2 * PI * k / sides) + bn * math.sin(2 * PI * k / sides)) * r) for k in range(sides)])
    return bm_loft(sections, M, caps, caps)


def bm_arcplate(r0, r1, y0, y1, a0, a1, seg, zs=1.0, M=I4, rfun=None):
    # a curved slab round the y axis: radii r0 (inner) to r1 (outer), heights y0..y1, angles a0..a1 (0 = +z, PI/2 = +x), squashed by zs in z;
    # rfun(y) optionally adds to both radii (to follow a bulging drum)
    bm = bmesh.new()
    g = {}
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        for j, y in enumerate((y0, y1)):
            dr = rfun(y) if rfun else 0
            for k, r in enumerate((r0, r1)):
                g[i, j, k] = bm.verts.new(((r + dr) * math.sin(a), y, (r + dr) * math.cos(a) * zs))
    for i in range(seg):
        bm.faces.new((g[i, 0, 1], g[i + 1, 0, 1], g[i + 1, 1, 1], g[i, 1, 1]))
        bm.faces.new((g[i, 1, 0], g[i + 1, 1, 0], g[i + 1, 0, 0], g[i, 0, 0]))
        bm.faces.new((g[i, 1, 1], g[i + 1, 1, 1], g[i + 1, 1, 0], g[i, 1, 0]))
        bm.faces.new((g[i, 0, 0], g[i + 1, 0, 0], g[i + 1, 0, 1], g[i, 0, 1]))
    for i in (0, seg):
        bm.faces.new((g[i, 0, 0], g[i, 0, 1], g[i, 1, 1], g[i, 1, 0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def bm_join(bms):
    out = bmesh.new()
    me = bpy.data.meshes.new('tmp')
    for b in bms:
        b.to_mesh(me)
        out.from_mesh(me)
        b.free()
    bpy.data.meshes.remove(me)
    return out


def mark_sharp(bm, deg=32):
    lim = math.radians(deg)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) != 2 or e.calc_face_angle(0) > lim:
            e.smooth = False


# ---------------------------------------------------------------- objects
OBJS = []
GROUPS = {}


def group(name, pos, parent=None):
    # a pivot the game turns (a node in the GLB); pos in the game's world axes at rest
    e = empty(name, pos, GROUPS[parent][0] if parent else None)
    GROUPS[name] = (e, Vector(pos))
    return e


def _local(bm, grp, frame):
    # world (game axes) -> the object's own frame -> Blender axes
    F = frame if frame is not None else T(*GROUPS[grp][1])
    bmesh.ops.transform(bm, matrix=C @ F.inverted(), verts=bm.verts)
    return F


def store(name, bm, cls, grp, bevel=None, seg=2, sharp=32, wn=True, frame=None, local=False):
    # bm in the game's world axes at rest (or, with local=True, already in the frame's own axes)
    mark_sharp(bm, sharp)
    if local:
        bmesh.ops.transform(bm, matrix=C, verts=bm.verts)
        F = frame
    else:
        F = _local(bm, grp, frame)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob['cls'] = cls
    ob['grp'] = grp
    ob.parent = GROUPS[grp][0]
    ob.matrix_world = C @ F @ CI
    if bevel:
        m = ob.modifiers.new('bev', 'BEVEL')
        m.width = bevel
        m.segments = seg
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(30)
        m.harden_normals = True
        m.use_clamp_overlap = True
        m.miter_outer = 'MITER_ARC'
    if wn:
        w = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
        w.keep_sharp = True
        w.weight = 50
    OBJS.append(ob)
    return ob


def boolean(ob, cutters, solver='MANIFOLD'):
    # cutters in the game's world axes; the cut runs before the bevel, so cut edges are chamfered too
    bm = bm_join(cutters)
    bmesh.ops.transform(bm, matrix=C, verts=bm.verts)
    me = bpy.data.meshes.new(ob.name + '_cut')
    bm.to_mesh(me)
    bm.free()
    cut = bpy.data.objects.new(ob.name + '_cut', me)
    bpy.context.scene.collection.objects.link(cut)
    cut.hide_render = True
    cut.hide_viewport = True
    cut['cutter'] = 1
    m = ob.modifiers.new('cut', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = cut
    try:
        m.solver = solver
    except TypeError:
        m.solver = 'EXACT'
    ob.modifiers.move(len(ob.modifiers) - 1, 0)
    return cut


def empty(name, pos, parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.empty_display_size = 0.05
    if parent is not None:
        e.parent = parent
    e.matrix_world = C @ T(*pos) @ CI
    return e


def place(ob, parent, frame):
    # frame: the object's frame in the game's world axes (4x4)
    ob.parent = parent
    ob.matrix_world = C @ frame @ CI


def apply_all():
    # bake every modifier into the meshes and delete the cutters
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in list(OBJS):
        if not ob.modifiers:
            continue
        ev = ob.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        old = ob.data
        ob.modifiers.clear()
        ob.data = me
        bpy.data.meshes.remove(old)
    for o in list(bpy.data.objects):
        if o.get('cutter'):
            bpy.data.objects.remove(o)


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)
