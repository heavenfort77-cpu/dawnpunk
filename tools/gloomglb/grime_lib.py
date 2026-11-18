# Wear and growth geometry shared by the desktop Gloom models (Walker v2 and later kinds): dried leaves, mud lumps, moss clumps, weed tufts,
# dents pushed into finished plates, a cracked screen corner, and the marks file (dents, oil leaks, soot vents) that paint_tex.py reads.
# Everything is in the GAME's axes (x right, y up, front = -z), like bl_lib.py. Import after bl_lib (uses OBJS, store, C).
import math, random, json
import bmesh
from mathutils import Vector, Matrix
from bl_lib import *

MARKS = {'dents': [], 'oil': [], 'soot': [], 'crack': []}
_N = [0]


def _nm(s):
    _N[0] += 1
    return '%s_g%03d' % (s, _N[0])


def leaf_bm(c, L, yaw, tilt=0.2, curl=0.35, crumple=0.25):
    # one dried leaf: pointed oval blade, edges curled up, crumpled; two skins 1 mm apart (seen from both sides)
    bm = bmesh.new()
    rows = 3
    top, bot = [], []
    for j in range(rows + 1):
        t = j / rows
        w = L * 0.3 * math.sin(PI * t) ** 0.75 * (0.85 + 0.3 * random.random())
        zz = (t - 0.5) * L
        r = []
        for s in (-1, 0, 1):
            x = s * w
            y = curl * (abs(x) / max(1e-4, L * 0.3)) ** 2 * L * 0.25 + (random.random() - 0.5) * crumple * L * 0.12 + 0.12 * L * (t - 0.5) ** 2
            r.append(Vector((x, y, zz)))
        top.append([bm.verts.new(v) for v in r])
        bot.append([bm.verts.new(v - Vector((0, 0.0012, 0))) for v in r])
    for j in range(rows):
        for k in range(2):
            bm.faces.new((top[j][k], top[j][k + 1], top[j + 1][k + 1], top[j + 1][k]))
            bm.faces.new((bot[j + 1][k], bot[j + 1][k + 1], bot[j][k + 1], bot[j][k]))
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces][:rows * 2])
    M = T(*c) @ R('Y', yaw) @ R('X', tilt) @ R('Z', (random.random() - 0.5) * 0.4)
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def leaves(grp, spots, L=0.05):
    # spots: list of (x, y, z) resting points (game axes); one leaf at each, random turn
    bms = [leaf_bm(p, L * (0.7 + 0.6 * random.random()), random.random() * 6.28, (random.random() - 0.5) * 0.5) for p in spots]
    if bms:
        store(_nm('leafdry'), bm_join(bms), 'leafdry', grp, sharp=80, wn=False)


def lump_bm(c, r, n_ax=(0, 1, 0), flat=0.45):
    # a dried mud lump: a lumpy flattened ball pressed against a surface whose normal is n_ax
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    for v in bm.verts:
        v.co *= 0.75 + 0.5 * random.random()
    M = T(*c) @ aim_y(n_ax) @ S(r * (0.8 + 0.4 * random.random()), r * flat, r * (0.8 + 0.4 * random.random()))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def mud(grp, spots):
    # spots: list of (centre, radius, normal)
    bms = [lump_bm(c, r, n) for (c, r, n) in spots]
    if bms:
        store(_nm('mud'), bm_join(bms), 'mud', grp, sharp=80, wn=False)


def moss_bm(c, r, n=2, flat=0.45):
    bms = []
    for k in range(n):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        for v in bm.verts:
            v.co *= 0.8 + 0.4 * random.random()
        s_ = r * (0.5 + 0.6 * random.random())
        bmesh.ops.transform(bm, matrix=T(c[0] + (random.random() - 0.5) * r * 1.8, c[1] + s_ * flat * 0.3, c[2] + (random.random() - 0.5) * r * 1.8) @ S(s_, s_ * flat, s_), verts=bm.verts)
        bms.append(bm)
    return bm_join(bms)


def moss(grp, spots):
    # spots: list of (centre, radius)
    bms = [moss_bm(c, r) for (c, r) in spots]
    if bms:
        store(_nm('moss'), bm_join(bms), 'moss', grp, sharp=80, wn=False)


def blade_bm(base, h, lean, turn, w=0.006):
    secs = []
    for k in range(4):
        t = k / 3
        c = Vector(base) + Vector((math.sin(turn) * lean * t * t * h, h * t, math.cos(turn) * lean * t * t * h))
        ww = w * (1 - t * 0.92)
        ax = Vector((math.cos(turn), 0, -math.sin(turn)))
        fw = Vector((math.sin(turn), 0, math.cos(turn)))
        secs.append([tuple(c + ax * ww), tuple(c - fw * ww * 0.3), tuple(c - ax * ww)])
    return bm_loft(secs)


def tufts(grp, spots, dry=False):
    # spots: list of (centre, blades, height, spread); weeds caught in a joint or a seam
    bms = []
    for (c, n, h, sp) in spots:
        for k in range(n):
            bms.append(blade_bm((c[0] + (random.random() - 0.5) * sp, c[1], c[2] + (random.random() - 0.5) * sp), h * (0.55 + 0.6 * random.random()), 0.3 + 0.6 * random.random(), random.random() * 6.28, 0.006 + 0.005 * random.random()))
    if bms:
        store(_nm('weed'), bm_join(bms), 'grassdry' if dry else 'plant', grp, sharp=80, wn=False)


def crack(grp, impact, z, half_w, half_h, cx=0.0, cy=0.0, rays=8, seed=3):
    # a cracked screen corner: jagged lines radiating from the impact point and two broken rings, a dark bleed blot at the impact;
    # thin strips just in front of the screen glass (z, facing -z), clipped to the screen (centre cx, cy, half sizes half_w, half_h)
    rnd = random.Random(seed)
    bms = []
    ix, iy = impact

    def inside(p):
        return abs(p[0] - cx) < half_w - 0.002 and abs(p[1] - cy) < half_h - 0.002

    def strip(a, b, w):
        d = Vector((b[0] - a[0], b[1] - a[1], 0))
        if d.length < 1e-5:
            return None
        nrm = Vector((-d.y, d.x, 0)).normalized() * w / 2
        bm = bmesh.new()
        vs = [bm.verts.new((a[0] + nrm.x, a[1] + nrm.y, z)), bm.verts.new((b[0] + nrm.x, b[1] + nrm.y, z)), bm.verts.new((b[0] - nrm.x, b[1] - nrm.y, z)), bm.verts.new((a[0] - nrm.x, a[1] - nrm.y, z))]
        f = bm.faces.new(vs)
        bm.normal_update()
        if f.normal.z > 0:
            bmesh.ops.reverse_faces(bm, faces=[f])
        return bm

    ends = []
    for k in range(rays):
        a = 2 * PI * k / rays + rnd.uniform(-0.3, 0.3)
        L = rnd.uniform(0.05, 0.17)
        p = (ix, iy)
        pts = [p]
        for s in range(6):
            a += rnd.uniform(-0.35, 0.35)
            q = (p[0] + math.cos(a) * L / 6, p[1] + math.sin(a) * L / 6)
            if not inside(q):
                break
            pts.append(q)
            p = q
        ends.append(pts)
        for s in range(len(pts) - 1):
            w = 0.0036 * (1 - 0.55 * s / 6)
            bm = strip(pts[s], pts[s + 1], w)
            if bm:
                bms.append(bm)
    for rr in (0.022, 0.05):
        for k in range(rays):
            if rnd.random() < 0.35:
                continue
            a0, a1 = 2 * PI * k / rays, 2 * PI * (k + 1) / rays
            p0 = (ix + math.cos(a0) * rr * rnd.uniform(0.85, 1.15), iy + math.sin(a0) * rr * rnd.uniform(0.85, 1.15))
            p1 = (ix + math.cos(a1) * rr * rnd.uniform(0.85, 1.15), iy + math.sin(a1) * rr * rnd.uniform(0.85, 1.15))
            if inside(p0) and inside(p1):
                bm = strip(p0, p1, 0.0024)
                if bm:
                    bms.append(bm)
    # bleed blot: an irregular dark patch round the impact
    bm = bmesh.new()
    ring = []
    for k in range(10):
        a = 2 * PI * k / 10
        rr = 0.014 * rnd.uniform(0.6, 1.4)
        q = (ix + math.cos(a) * rr, iy + math.sin(a) * rr)
        q = (max(cx - half_w + 0.003, min(cx + half_w - 0.003, q[0])), max(cy - half_h + 0.003, min(cy + half_h - 0.003, q[1])))
        ring.append(bm.verts.new((q[0], q[1], z + 0.0002)))
    f = bm.faces.new(ring)
    bm.normal_update()
    if f.normal.z > 0:
        bmesh.ops.reverse_faces(bm, faces=[f])
    bms.append(bm)
    MARKS['crack'].append([ix, iy, z])
    store(_nm('crack'), bm_join(bms), 'crack', grp, sharp=80, wn=False)


def dent(p, n, r, depth, classes=('paint', 'paint2', 'dark')):
    # pushes a smooth dent (radius r, depth) into whichever finished part has its surface at p (game axes), facing n; call before apply_all
    pb = C @ Vector(p)
    nb = (C.to_3x3() @ Vector(n)).normalized()
    best, bd = None, 0.02
    for ob in OBJS:
        if ob.get('cls') not in classes:
            continue
        Mi = ob.matrix_world.inverted()
        ok, loc, nrm, idx = ob.closest_point_on_mesh(Mi @ pb)
        if not ok:
            continue
        d = (ob.matrix_world @ loc - pb).length
        if d < bd:
            best, bd = ob, d
    if best is None:
        print('dent: no part at', p)
        return None
    ob = best
    Mi = ob.matrix_world.inverted()
    pl = Mi @ pb
    nl = (Mi.to_3x3() @ nb).normalized()
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    sel = []
    for f in bm.faces:
        if f.normal.dot(nl) < 0.5:
            continue
        lo = Vector((min(v.co.x for v in f.verts), min(v.co.y for v in f.verts), min(v.co.z for v in f.verts))) - Vector((r, r, r))
        hi = Vector((max(v.co.x for v in f.verts), max(v.co.y for v in f.verts), max(v.co.z for v in f.verts))) + Vector((r, r, r))
        if all(lo[i] <= pl[i] <= hi[i] for i in range(3)):
            sel.append(f)
    if not sel:
        bm.free()
        print('dent: no face at', p, ob.name)
        return None
    # a local grid: five cut lines each way through the dent (bisecting only the faces under it), so the rest of the plate keeps its few faces
    t1 = nl.cross(Vector((0, 0, 1)) if abs(nl.z) < 0.9 else Vector((1, 0, 0))).normalized()
    t2 = nl.cross(t1).normalized()
    for ax in (t1, t2):
        for k in range(-2, 3):
            geom = list({e for f in sel if f.is_valid for e in f.edges}) + [f for f in sel if f.is_valid] + list({v for f in sel if f.is_valid for v in f.verts})
            res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=pl + ax * (k * r / 2.4), plane_no=ax)
            sel = list({f for f in bm.faces if f.normal.dot(nl) >= 0.5 and any(((v.co - pl) - nl * (v.co - pl).dot(nl)).length < r * 1.3 for v in f.verts)})
            bm.normal_update()
    sc = ob.matrix_world.to_3x3().median_scale if hasattr(ob.matrix_world.to_3x3(), 'median_scale') else 1.0
    for v in bm.verts:
        d = (v.co - pl)
        dd = (d - nl * d.dot(nl)).length
        if dd < r and abs(d.dot(nl)) < min(r * 0.5, 0.02):
            f_ = (1 - (dd / r) ** 2) ** 2
            v.co -= nl * depth * f_ * (0.85 + 0.3 * random.random())
    bm.to_mesh(ob.data)
    bm.free()
    MARKS['dents'].append([list(p), list(n), r, depth])
    return ob


def oil(p, r=0.03, length=0.35):
    MARKS['oil'].append([list(p), r, length])


def soot(p, r=0.05, length=0.25):
    MARKS['soot'].append([list(p), r, length])


def save_marks(path):
    json.dump(MARKS, open(path, 'w'), indent=1)
