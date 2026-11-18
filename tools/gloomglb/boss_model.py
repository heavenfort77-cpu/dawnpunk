# THE BECKONER v2 (desktop): the final-night boss, built in Blender headless. Owner, Nov 17 18:51: the phone build (src/bosshi.js buildCode) is APPROVED;
# "just increase density on desktop": this model follows the approved phone shape exactly (a cat skull of plates with the CRT set into the face, two big ears (the left torn
# to its frame), a muzzle pushed forward, a seated pear body with the chest forward and an S-curved back, round haunches, a tail curling up behind, the coin behind shutters)
# with far more density on top: smaller layered plates with gaps onto a dark core, dense rivet rows, pistons and cable bundles at the neck, shoulders and hips, ribs and
# wiring where a plate is missing, vents, gauges, lamps. v1 (the first cat) is kept as tools/gloomglb/boss_model_v1.py and art/blender/boss_beckoner_hi_v1.glb.
# Modelled at QUARTER scale; the game scales it x4. The numbers below are the phone build's (model units). Usage: python3 tools/gloomglb/boss_model.py <out.blend>
# Nodes (src/bosshi.js poses them): base, body, head, jaw, bell, coin, coreDoorL, coreDoorR, beckonArm > beckonFore > beckonPaw > beckonCore,
#   slamArm > slamFore > slamS1..slamS4 > slamPaw > slamCore, plate0..plate9; the empty 'screen' carries the game's CRT face (0.42 x 0.24).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from bl_lib import *
from organic_lib import *
import grime_lib as G
from grime_lib import save_marks

random.seed(77)
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/boss.blend'
N = [0]

def nm(s):
    N[0] += 1
    return '%s_%03d' % (s, N[0])


def bolt(grp, p, n, r=0.009, cls='bolt'):
    M = T(*p) @ aim_y(n)
    return store(nm('bolt'), bm_lathe([(r, r * 0.2), (r, r * 0.75), (r * 0.65, r * 1.0), (0, r * 1.1)], 6, M, cap0=False, phase=random.random()), cls, grp, sharp=50, wn=False)


def hose(grp, pts, r, cls='rubber', sides=None):
    return store(nm('hose'), bm_sweep(pts, [r] * len(pts), sides or (6 if r < 0.012 else 9), 6, rib=(max(0.016, r * 2.2), 0.16)), cls, grp, sharp=80, wn=False)


def tube(grp, pts, r, cls='steel', sides=8, sub=4):
    return store(nm('tube'), bm_sweep(pts, [r] * len(pts) if not isinstance(r, list) else r, sides, sub), cls, grp, sharp=60, wn=False)


def lamp(grp, c, n, r=0.04, cls_h='dark'):
    M = T(*c) @ aim_y(n)
    store(nm('lamph'), bm_lathe([(r * 1.35, -0.03), (r * 1.4, -0.008), (r * 1.3, 0.004), (r * 1.0, 0.01), (r * 0.98, 0.002)], 18, M, cap0=True, cap1=False), cls_h, grp, bevel=0.002, seg=1)
    store(nm('lens'), bm_lathe([(r * 0.99, 0.002), (r * 0.8, 0.012), (r * 0.4, 0.017), (0, 0.018)], 18, M), 'lens', grp, sharp=60, wn=False)


def ram(grp, A, B, rc, ext=0.6):
    # a hydraulic ram whose both ends sit in ONE group (decoration that stays put): cylinder from A, chrome rod to B
    A, B = Vector(A), Vector(B)
    d = B - A
    L = d.length
    M = T(*A) @ aim_y(d)
    Lc = L * ext
    store(nm('ramc'), bm_lathe([(rc * 1.25, -0.012), (rc * 1.25, 0.012), (rc, 0.014), (rc, Lc - 0.012), (rc * 1.2, Lc - 0.01), (rc * 1.2, Lc), (rc * 0.5, Lc + 0.004)], 12, M), 'dark', grp, bevel=0.002, seg=1, sharp=40)
    store(nm('ramr'), bm_lathe([(rc * 0.45, Lc - 0.01), (rc * 0.45, L - 0.012), (rc * 0.9, L - 0.01), (rc * 0.9, L + 0.012)], 10, M), 'chrome', grp, sharp=50, wn=False)


def clevis(grp, c, w, r, axis='x'):
    # an exposed pin joint: two lugs and a pin with nuts (along x)
    x, y, z = c
    for s in (-1, 1):
        lx = x + s * (w / 2 + 0.012)
        store(nm('lug'), bm_sweep([(lx - 0.012, y, z), (lx + 0.012, y, z)], [r, r], 16, 2), 'dark', grp, bevel=0.003, seg=1, sharp=40)
        bolt(grp, (lx + s * 0.016, y, z), (s, 0, 0), r * 0.45)
    store(nm('pin'), bm_sweep([(x - w / 2 - 0.035, y, z), (x + w / 2 + 0.035, y, z)], [r * 0.38, r * 0.38], 10, 2), 'steel', grp, sharp=50)




# ---------------------------------------------------------------- pivots: the phone build's (src/bosshi.js PIV with its arm offsets)
BX, BY, BZ = 0.30, 1.05, -0.12
group('base', (0, 0, 0))
group('body', (0, 0.2, 0), 'base')
group('head', (0, 1.32, -0.05), 'body')
group('jaw', (0, 1.42, -0.44), 'head')
group('bell', (0, 1.26, -0.24), 'body')
group('coin', (0, 0.86, -0.3), 'body')
group('coreDoorL', (-0.17, 0.86, -0.35), 'body')
group('coreDoorR', (0.17, 0.86, -0.35), 'body')
group('beckonArm', (-BX, BY, BZ), 'body')
group('beckonFore', (-BX, BY - 0.3, BZ), 'beckonArm')
group('beckonPaw', (-BX, BY - 0.56, BZ), 'beckonFore')
group('beckonCore', (-BX, BY - 0.71, BZ - 0.065), 'beckonPaw')
group('slamArm', (BX, BY, BZ), 'body')
group('slamFore', (BX, BY - 0.22, BZ), 'slamArm')
for k in range(1, 5):
    group('slamS%d' % k, (BX, BY - 0.38 - 0.12 * (k - 1), BZ), 'slamFore' if k == 1 else 'slamS%d' % (k - 1))
group('slamPaw', (BX, BY - 0.86, BZ), 'slamS4')
group('slamCore', (BX, BY - 0.98, BZ - 0.16), 'slamPaw')
for name, p, g in (('plate0', (-0.33, 1.11, BZ), 'beckonArm'), ('plate1', (0.33, 1.11, BZ), 'slamArm'), ('plate2', (-BX, 0.9, -0.2), 'beckonArm'), ('plate3', (BX, 0.92, -0.2), 'slamArm'),
                   ('plate4', (-BX, 0.62, -0.19), 'beckonFore'), ('plate5', (BX, 0.74, -0.21), 'slamFore'), ('plate6', (-0.36, 1.62, -0.3), 'head'), ('plate7', (0.36, 1.62, -0.3), 'head'),
                   ('plate8', (-0.14, 0.47, -0.36), 'body'), ('plate9', (0.14, 0.47, -0.36), 'body')):
    group(name, p, g)
SW, SH, SY, SZ = 0.42, 0.24, 1.7, -0.43
empty('screen', (0, SY, SZ - 0.012), GROUPS['head'][0])


# ---------------------------------------------------------------- shapes (the phone build's, as functions): an ellipsoid in three.js sphere angles, the lathed body with its bend
def ell(c, r, th, ph, off=0.0):
    s = math.sin(th)
    return (c[0] - math.cos(ph) * s * (r[0] + off), c[1] + math.cos(th) * (r[1] + off), c[2] + math.sin(ph) * s * (r[2] + off))


def ell_n(c, r, p):
    v = Vector(((p[0] - c[0]) / r[0] ** 2, (p[1] - c[1]) / r[1] ** 2, (p[2] - c[2]) / r[2] ** 2))
    return tuple(v.normalized())


def ell_plate(grp, c, r, p0, p1, t0, t1, th=0.012, off=0.0, cls='paint', nv=3, na=4, rv=2):
    secs = []
    for j in range(nv + 1):
        t = t0 + (t1 - t0) * j / nv
        secs.append([ell(c, r, t, p0 + (p1 - p0) * k / na, off + th) for k in range(na + 1)] + [ell(c, r, t, p0 + (p1 - p0) * k / na, off) for k in range(na, -1, -1)])
    store(nm('pl'), bm_loft(secs), cls, grp, bevel=0.003, seg=1, sharp=40)
    for k in range(rv):
        ph = p0 + (p1 - p0) * (k + 0.5) / rv
        p = ell(c, r, t0 + 0.04, ph, off + th)
        bolt(grp, p, ell_n(c, r, p), 0.007)


def ell_shell(grp, c, r, bands, sectors, skip=None, cls=lambda k, b: 'paint', gap=0.035, th=0.012, core=True, layer=0.006, rv=2, phase=0.0):
    if core:
        store(nm('core'), bm_ellipsoid(c, r[0] * 0.93, r[1] * 0.93, r[2] * 0.93, 16, 10), 'core', grp, sharp=60)
    for b, (t0, t1) in enumerate(bands):
        for k in range(sectors):
            if skip and skip(k, b):
                continue
            p0 = phase + (k + (0.5 if b % 2 else 0.0)) / sectors * 2 * PI
            ell_plate(grp, c, r, p0 + gap, p0 + 2 * PI / sectors - gap, t0, t1, th, (layer if (k + b) % 2 else 0.0), cls(k, b), rv=rv)


PROF = [(0.36, 0.2), (0.4, 0.34), (0.39, 0.52), (0.35, 0.72), (0.3, 0.9), (0.24, 1.06), (0.18, 1.2), (0.14, 1.3)]


def prof_r(y):
    if y <= PROF[0][1]:
        return PROF[0][0]
    for (r0, y0), (r1, y1) in zip(PROF, PROF[1:]):
        if y <= y1:
            return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
    return PROF[-1][0]


def body_pt(y, ph, off=0.0):
    r = prof_r(y) + off
    x, z = r * math.sin(ph), r * math.cos(ph) * 0.9
    if z < 0:
        z -= 0.06 * max(0.0, math.sin(PI * (y - 0.45) / 0.85))
    else:
        z += 0.12 * max(0.0, math.sin(PI * min(1, max(0, (y - 0.22) / 0.8)))) - 0.07 * max(0.0, math.sin(PI * min(1, max(0, (y - 1.02) / 0.3))))
    return (x, y, z)


def body_n(y, ph):
    p0, pa, py = Vector(body_pt(y, ph)), Vector(body_pt(y, ph + 0.01)), Vector(body_pt(y + 0.005, ph))
    n = (pa - p0).cross(py - p0).normalized()
    if n.dot(Vector((p0.x, 0, p0.z))) < 0:
        n = -n
    return tuple(n)


def body_plate(grp, y0, y1, p0, p1, th=0.014, off=0.0, cls='paint', nv=3, na=4, rv=3):
    secs = []
    for j in range(nv + 1):
        y = y0 + (y1 - y0) * j / nv
        secs.append([body_pt(y, p0 + (p1 - p0) * k / na, off + th) for k in range(na + 1)] + [body_pt(y, p0 + (p1 - p0) * k / na, off) for k in range(na, -1, -1)])
    store(nm('bp'), bm_loft(secs), cls, grp, bevel=0.003, seg=1, sharp=40)
    for k in range(rv):
        ph = p0 + (p1 - p0) * (k + 0.5) / rv
        bolt(grp, body_pt(y1 - 0.016, ph, off + th), body_n(y1 - 0.016, ph), 0.0075)


def seg(grp, a, b, r, cls='steel', sides=8):
    return store(nm('rod'), bm_sweep([a, b], [r, r], sides, 2), cls, grp, sharp=50, wn=False)


# ---------------------------------------------------------------- BASE: plinth, haunches, hind feet, tail
store('plinth', bm_lathe([(0.6, 0.0), (0.6, 0.03), (0.58, 0.035), (0.58, 0.15), (0.6, 0.155), (0.6, 0.18), (0.57, 0.19), (0.0, 0.19)], 8, phase=PI / 8), 'paint2', 'base', bevel=0.004, seg=1, sharp=30)
store('plinthcore', bm_lathe([(0.52, -0.005), (0.52, 0.03)], 8, phase=PI / 8), 'dark', 'base', sharp=30)
for k in range(8):
    mid = Vector((0.58 * math.sin(2 * PI * k / 8 + PI / 8), 0, 0.58 * math.cos(2 * PI * k / 8 + PI / 8)))
    nxt = Vector((0.58 * math.sin(2 * PI * (k + 1) / 8 + PI / 8), 0, 0.58 * math.cos(2 * PI * (k + 1) / 8 + PI / 8)))
    nrm = mid.lerp(nxt, 0.5).normalized()
    for f in (0.15, 0.38, 0.62, 0.85):
        p = mid.lerp(nxt, f)
        for y in (0.045, 0.14):
            bolt('base', (p.x * 1.005, y, p.z * 1.005), tuple(nrm), 0.008)
for k in range(8):
    a = 2 * PI * k / 8 + 0.2
    c = (0.5 * math.sin(a), 0.035, 0.5 * math.cos(a))
    store(nm('roller'), bm_lathe([(0.0, -0.025), (0.034, -0.025), (0.04, -0.018), (0.04, 0.018), (0.034, 0.025), (0.0, 0.025)], 14, T(*c) @ R('Y', a) @ R('Z', PI / 2)), 'rubber', 'base', sharp=50)
store('plaque', bm_box(0.26, 0.07, 0.008, T(0, 0.095, -0.565)), 'brass', 'base', bevel=0.003, seg=1)
for s in (-1, 1):
    bolt('base', (s * 0.115, 0.095, -0.571), (0, 0, -1), 0.006)
for s in (-1, 1):
    hc, hr = (s * 0.3, 0.44, 0.04), (0.23, 0.27, 0.37)
    ell_shell('base', hc, hr, [(0.15, 0.95), (1.0, 1.75), (1.8, 2.6)], 10, cls=lambda k, b, s=s: 'paint2' if (s > 0 and k == 3 and b == 1) else 'paint', rv=2)
    store(nm('hdrum'), bm_lathe([(0.065, -0.06), (0.065, 0.06)], 14, T(s * 0.5, 0.42, 0.04) @ R('Z', PI / 2)), 'dark', 'base', sharp=40)
    store(nm('hrim'), bm_torus(0.068, 0.012, 14, 4, T(s * 0.54, 0.42, 0.04) @ R('Z', PI / 2)), 'steel', 'base', wn=False)
    ram('base', (s * 0.46, 0.62, 0.16), (s * 0.45, 0.3, -0.22), 0.02)
    ram('base', (s * 0.4, 0.66, -0.1), (s * 0.42, 0.3, 0.28), 0.016)
    hose('base', [(s * 0.36, 0.7, 0.2), (s * 0.48, 0.58, 0.3), (s * 0.5, 0.3, 0.32)], 0.014)
    # hind foot: a heel housing with three steel toes and claws at the plinth front
    fs = Shell([0.19, 0.24, 0.29], W=[0.17, 0.18, 0.12], D=[0.16, 0.17, 0.11], Zc=[-0.42, -0.42, -0.41], p=2.6, X=[s * 0.3] * 3)
    store(nm('heelc'), fs.solid(0.195, 0.285, 3, 14, off=-0.01), 'dark', 'base', sharp=50)
    store(nm('heel'), fs.panel(0.195, 0.285, PI / 2 - 0.3, 1.5 * PI + 0.3, 0.012, 0.0, 4, 10), 'paint', 'base', bevel=0.003, seg=1, sharp=40)
    for k in (-1, 0, 1):
        tx = s * 0.3 + k * 0.045
        store(nm('toe'), bm_sweep([(tx, 0.24, -0.47), (tx, 0.235, -0.51), (tx, 0.215, -0.54)], [0.022, 0.02, 0.015], 10, 3), 'steel', 'base', sharp=50)
        store(nm('claw'), bm_sweep([(tx, 0.22, -0.54), (tx, 0.205, -0.565), (tx, 0.19, -0.572)], [0.009, 0.006, 0.002], 6, 3), 'dark', 'base', sharp=50)
TP = [(0.0, 0.3, 0.4), (0.06, 0.24, 0.6), (0.14, 0.34, 0.78), (0.2, 0.62, 0.84), (0.22, 0.86, 0.74), (0.2, 0.94, 0.6), (0.17, 0.88, 0.52)]
store('tail', bm_sweep(TP, [0.058, 0.056, 0.054, 0.05, 0.046, 0.04, 0.032], 12, 10, rib=(0.04, 0.2)), 'dark', 'base', sharp=60)
Q, U = spline(TP, 10)
for k in range(1, 12):
    i = int(k / 12 * (len(Q) - 1))
    d = (Q[min(i + 1, len(Q) - 1)] - Q[max(i - 1, 0)]).normalized()
    r = 0.064 - 0.025 * k / 12
    store(nm('tring'), bm_lathe([(r, -0.012), (r * 1.06, -0.006), (r * 1.06, 0.006), (r, 0.012)], 14, T(*Q[i]) @ aim_y(d)), 'steel' if k % 2 else 'paint', 'base', sharp=40)
store('tailtip', bm_ellipsoid(tuple(Q[-1]), 0.036, 0.036, 0.036, 10, 6), 'paint2', 'base', sharp=50)

# ---------------------------------------------------------------- BODY: a dark lathed frame under 8 bands of small layered plates; the left side plates gone (ribs, wiring)
store('bcore', bm_loft([[body_pt(y, 2 * PI * k / 28, -0.03) for k in range(28)] for y in [0.2 + 1.1 * j / 12 for j in range(13)]]), 'core', 'body', sharp=60)
YB = [0.21, 0.35, 0.49, 0.63, 0.77, 0.91, 1.05, 1.17, 1.29]
SEC = 10
MISS = (3.75, 5.0)
for b in range(len(YB) - 1):
    y0, y1 = YB[b] + 0.006, YB[b + 1] - 0.006
    for k in range(SEC):
        p0 = (k + (0.5 if b % 2 else 0.0)) / SEC * 2 * PI + PI
        p1 = p0 + 2 * PI / SEC
        mid = (p0 + p1) / 2
        fr = abs(math.atan2(math.sin(mid - PI), math.cos(mid - PI)))
        if y1 < 0.66 and MISS[0] < (mid % (2 * PI)) < MISS[1]:
            continue
        if 0.66 < y0 < 1.04 and fr < 0.55:
            continue
        if b == 1 and fr < 0.6:
            continue
        cls = 'paint2' if (y0 > 1.0 and fr < 0.65) else ('paint2' if (b, k) in ((0, 6), (3, 2), (5, 8)) else 'paint')
        body_plate('body', y0, y1, p0 + 0.025, p1 - 0.025, 0.014, 0.008 if (k + b) % 2 else 0.0, cls)
# belly plates (breakable: plate8, plate9) in the front of band 1
for i, s in enumerate((-1, 1)):
    a0, a1 = (PI - 0.6, PI - 0.03) if s < 0 else (PI + 0.03, PI + 0.6)
    body_plate('plate%d' % (8 + i), YB[1] + 0.006, YB[2] - 0.006, a0, a1, 0.016, 0.004, 'paint', rv=3)
# the missing side plates: hoops, struts, wiring, a junction box
for y in (0.3, 0.42, 0.54):
    store(nm('rib'), bm_sweep([body_pt(y, MISS[0] + (MISS[1] - MISS[0]) * j / 8, -0.012) for j in range(9)], [0.011] * 9, 6, 2), 'steel', 'body', sharp=60, wn=False)
for a in (MISS[0] + 0.25, (MISS[0] + MISS[1]) / 2, MISS[1] - 0.25):
    seg('body', body_pt(0.22, a, -0.012), body_pt(0.62, a, -0.012), 0.01)
for j, (c_, a) in enumerate((('wire_r', MISS[0] + 0.35), ('wire_y', MISS[0] + 0.6), ('rubber', MISS[0] + 0.85), ('wire_r', MISS[1] - 0.3))):
    store(nm('wire'), bm_sweep([body_pt(0.6, a, -0.02), body_pt(0.42, a + 0.1, 0.01), body_pt(0.28, a - 0.06, 0.03), body_pt(0.18, a - 0.02, 0.06)], [0.011] * 4, 6, 6), c_, 'body', sharp=80, wn=False)
jb = body_pt(0.45, (MISS[0] + MISS[1]) / 2, -0.03)
store('jbox', bm_box(0.08, 0.1, 0.05, T(*jb) @ R('Y', (MISS[0] + MISS[1]) / 2)), 'dark', 'body', bevel=0.004, seg=1)
# straps
for y in (YB[2], YB[4], YB[6]):
    store(nm('strap'), bm_loft([[body_pt(y - 0.01, 2 * PI * k / 44, 0.024) for k in range(44)], [body_pt(y + 0.01, 2 * PI * k / 44, 0.024) for k in range(44)],
                                [body_pt(y + 0.01, 2 * PI * k / 44, 0.004) for k in range(44)], [body_pt(y - 0.01, 2 * PI * k / 44, 0.004) for k in range(44)]], closed=True), 'steel', 'body', sharp=40)
# vents and a grille low on the back, a gauge and two small lamps on the chest sides
for k in range(7):
    y = 0.36 + k * 0.03
    store(nm('vent'), bm_sweep([body_pt(y, 0.15 * PI - 0.32, 0.02), body_pt(y, 0.15 * PI + 0.32, 0.02)], [0.008, 0.008], 6, 4, ell=(1.0, 0.4)), 'dark', 'body', sharp=60, wn=False)
for k in range(5):
    a = 1.85 * PI - 0.2 + k * 0.1
    seg('body', body_pt(0.74, a, 0.02), body_pt(0.88, a, 0.02), 0.006, 'steel', 6)
gp = Vector(body_pt(0.8, PI + 0.95, 0.02)); gn = Vector(body_n(0.8, PI + 0.95))
store('gaugeb', bm_lathe([(0.0, -0.012), (0.045, -0.012), (0.048, 0.004), (0.04, 0.012)], 18, T(*gp) @ aim_y(gn)), 'brass', 'body', sharp=40)
store('gauged', bm_lathe([(0.0, 0.012), (0.036, 0.012)], 18, T(*gp) @ aim_y(gn)), 'dial', 'body', sharp=40)
lamp('body', body_pt(0.95, PI - 0.9, 0.02), body_n(0.95, PI - 0.9), 0.016)
lamp('body', body_pt(0.6, PI + 1.2, 0.02), body_n(0.6, PI + 1.2), 0.014)
# coin housing: a dark well with a copper rim; shutters; the coin-core
store('coinwell', bm_loft([[body_pt(y, PI - 0.55 + 1.1 * k / 10, -0.045) for k in range(11)] + [body_pt(y, PI + 0.55 - 1.1 * k / 10, -0.02) for k in range(11)] for y in (0.67, 0.86, 1.03)]), 'core', 'body', sharp=50)
for a in (PI - 0.57, PI + 0.57):
    store(nm('coinrim'), bm_sweep([body_pt(0.67, a, 0.012), body_pt(1.03, a, 0.012)], [0.015, 0.015], 8, 2), 'copper', 'body', sharp=50)
for y in (0.665, 1.035):
    store(nm('coinrim'), bm_sweep([body_pt(y, PI - 0.57 + 1.14 * j / 8, 0.012) for j in range(9)], [0.013] * 9, 8, 2), 'copper', 'body', sharp=50)
for s, gname in ((-1, 'coreDoorL'), (1, 'coreDoorR')):
    a0, a1 = (PI - 0.55, PI - 0.01) if s < 0 else (PI + 0.01, PI + 0.55)
    store(nm('shutter'), bm_loft([[body_pt(y, a0 + (a1 - a0) * k / 6, 0.012) for k in range(7)] + [body_pt(y, a0 + (a1 - a0) * k / 6, 0.026) for k in range(6, -1, -1)] for y in (0.68, 0.86, 1.02)]), 'paint2', gname, bevel=0.003, seg=1, sharp=40)
    for k in range(4):
        y = 0.71 + k * 0.08
        store(nm('slat'), bm_sweep([body_pt(y, a0 + 0.04, 0.03), body_pt(y, a1 - 0.04, 0.03)], [0.005, 0.005], 6, 3, ell=(1, 0.5)), 'steel', gname, sharp=60, wn=False)
CC = Vector((0.0, 0.86, -0.315))
store('coinrimc', bm_lathe([(0.0, -0.02), (0.145, -0.02), (0.16, -0.01), (0.16, 0.012), (0.145, 0.02), (0.12, 0.016), (0.0, 0.016)], 28, T(*CC) @ R('X', PI / 2) @ S(1, 1, 1.22)), 'copper', 'coin', bevel=0.002, seg=1, sharp=40)
for k in range(8):
    a = 2 * PI * k / 8 + PI / 8
    pts = [CC + Vector((math.sin(a) * 0.04, math.cos(a) * 0.049, -0.022)), CC + Vector((math.sin(a) * 0.09, math.cos(a) * 0.11, -0.024)), CC + Vector((math.sin(a) * 0.13, math.cos(a) * 0.159, -0.022))]
    store(nm('cell'), bm_sweep(pts, [0.008, 0.026, 0.006], 8, 3, ell=(1.0, 0.25), up=(0, 0, 1)), 'core', 'coin', sharp=60, wn=False)
store('coinheart', bm_ellipsoid((CC.x, CC.y, CC.z - 0.02), 0.036, 0.044, 0.02, 16, 8), 'lens', 'coin', sharp=60, wn=False)
# bib (dull red), collar with a buckle, the bell
for k in range(5):
    a0 = PI - 0.62 + k * 0.248
    body_plate('body', 1.06, 1.24, a0 + 0.012, a0 + 0.236, 0.012, 0.02, 'paint2', rv=2)
cy = 1.27
store('collar', bm_lathe([(0.17, -0.035), (0.205, -0.03), (0.21, 0.0), (0.205, 0.03), (0.17, 0.035)], 28, T(0, cy, -0.03) @ S(1, 1, 0.85), closed=True), 'paint2', 'body', bevel=0.003, seg=1, sharp=40)
for k in range(14):
    a = 2 * PI * k / 14
    bolt('body', (math.sin(a) * 0.212, cy, -0.03 + math.cos(a) * 0.18), (math.sin(a), 0, math.cos(a)), 0.007)
store('buckle', bm_box(0.06, 0.07, 0.02, T(0.2, cy, -0.05) @ R('Y', PI / 2)), 'brass', 'body', bevel=0.004, seg=1)
bc = Vector((0, 1.17, -0.265))
store('bellhang', bm_sweep([(0, 1.25, -0.2), (0, 1.235, -0.26), (0, 1.21, -0.265)], [0.012] * 3, 8, 3), 'steel', 'bell', sharp=60, wn=False)
store('bellbody', bm_lathe([(0.0, 0.055), (0.03, 0.05), (0.05, 0.03), (0.06, 0.0), (0.072, -0.035), (0.08, -0.05), (0.074, -0.056), (0.058, -0.04)], 20, T(*bc)), 'copper', 'bell', bevel=0.002, seg=1, sharp=40)
for k in range(5):
    a = 2 * PI * k / 5
    store(nm('bslot'), bm_box(0.008, 0.05, 0.03, T(bc.x + math.sin(a) * 0.066, bc.y - 0.02, bc.z + math.cos(a) * 0.066) @ R('Y', a)), 'core', 'bell', sharp=40)
store('bellbulb', bm_ellipsoid((bc.x, bc.y - 0.03, bc.z), 0.042, 0.03, 0.042, 16, 8), 'lens', 'bell', sharp=60, wn=False)
# shoulder joint drums with a gap, rams and hoses
for s in (-1, 1):
    store(nm('sdrum'), bm_lathe([(0.0, -0.06), (0.09, -0.06), (0.095, -0.05), (0.095, 0.05), (0.09, 0.06), (0.0, 0.06)], 18, T(s * 0.26, BY, BZ - 0.01) @ R('Z', PI / 2)), 'dark', 'body', bevel=0.002, seg=1, sharp=40)
    store(nm('srim'), bm_torus(0.095, 0.012, 18, 4, T(s * 0.3, BY, BZ - 0.01) @ R('Z', PI / 2)), 'steel', 'body', wn=False)
    for k in range(6):
        a = 2 * PI * k / 6
        bolt('body', (s * 0.325, BY + math.sin(a) * 0.07, BZ - 0.01 + math.cos(a) * 0.07), (s, 0, 0), 0.007)
    ram('body', (s * 0.22, 1.18, 0.06), (s * 0.28, 0.82, 0.14), 0.018)
    ram('body', (s * 0.16, 1.2, -0.12), (s * 0.24, 0.98, -0.2), 0.014)
    hose('body', [(s * 0.18, 1.15, 0.05), (s * 0.27, 0.98, 0.18), (s * 0.3, 0.75, 0.24)], 0.016)
    hose('body', [(s * 0.14, 1.16, 0.08), (s * 0.24, 1.0, 0.21), (s * 0.28, 0.8, 0.26)], 0.01, 'wire_r' if s < 0 else 'wire_y')

# ---------------------------------------------------------------- NECK: the gap under the head: a dark column, three pistons, a cable bundle
store('neckcol', bm_sweep([(0, 1.26, -0.04), (0, 1.33, -0.06), (0, 1.4, -0.08)], [0.08, 0.075, 0.07], 14, 4, rib=(0.025, 0.18)), 'rubber', 'body', sharp=60)
for a in (0.5, 2.6, 4.7):
    ram('body', (math.sin(a) * 0.12, 1.25, -0.04 + math.cos(a) * 0.1), (math.sin(a) * 0.1, 1.41, -0.08 + math.cos(a) * 0.08), 0.016)
for k, (c_, dx) in enumerate((('wire_r', -0.08), ('wire_y', 0.09), ('rubber', -0.03), ('wire_r', 0.04))):
    hose('body', [(dx, 1.26, 0.05), (dx * 1.5, 1.33, 0.02), (dx * 1.2, 1.41, -0.03)], 0.01, c_)

# ---------------------------------------------------------------- HEAD: a cat skull of small plates with gaps onto a dark core, cheeks, a muzzle pushed forward, the CRT set into the face
HC, HR = (0.0, 1.68, -0.1), (0.44, 0.31, 0.35)


def fr_ph(k, n, b, ph0=0.0):
    mid = ph0 + (k + (0.5 if b % 2 else 0.0) + 0.5) / n * 2 * PI
    return abs(math.atan2(math.sin(mid - 1.5 * PI), math.cos(mid - 1.5 * PI)))


ell_shell('head', HC, HR, [(0.08, 0.62), (0.66, 1.2), (1.24, 1.8), (1.84, 2.45)], 14,
          skip=lambda k, b: (b in (1, 2) and fr_ph(k, 14, b) < 0.9) or (b == 0 and k in (3, 4)),
          cls=lambda k, b: 'paint2' if (b == 1 and k == 10) else 'paint', rv=2)
# the missing crown plates: hoops and a wire
for f in (0.25, 0.5):
    store(nm('hrib'), bm_sweep([ell(HC, HR, 0.08 + 0.54 * f, 3 / 14 * 2 * PI + 2.0 / 14 * 2 * PI * j / 6, -0.015) for j in range(7)], [0.008] * 7, 6, 2), 'steel', 'head', sharp=60, wn=False)
tube('head', [ell(HC, HR, 0.3, 3.6 / 14 * 2 * PI, -0.01), ell(HC, HR, 0.5, 4.2 / 14 * 2 * PI, 0.02), ell(HC, HR, 0.7, 4.6 / 14 * 2 * PI, 0.0)], 0.007, 'wire_y', 6, 5)
for s in (-1, 1):
    ell_shell('head', (s * 0.25, 1.56, -0.22), (0.19, 0.15, 0.17), [(0.7, 1.4), (1.45, 2.2), (2.25, 2.9)], 8, core=True,
              skip=lambda k, b, s=s: (s < 0 and k in (6, 7)) or (s > 0 and k in (0, 1)), rv=1)
MC, MR = (0.0, 1.48, -0.47), (0.16, 0.1, 0.17)
ell_shell('head', MC, MR, [(0.5, 1.3), (1.35, 2.1), (2.15, 2.9)], 8, rv=1)
store('mseam', bm_box(0.008, 0.11, 0.15, T(0, 1.46, -0.57)), 'dark', 'head', sharp=40)
lamp('head', (0, 1.56, -0.615), (0, 0.4, -1), 0.024)
for s in (-1, 1):
    lamp('head', (s * 0.3, 1.6, -0.37), (s * 0.4, 0, -1), 0.02)
    wp = Vector((s * 0.15, 1.48, -0.56))
    store(nm('wpod'), bm_lathe([(0.0, -0.03), (0.04, -0.03), (0.045, 0.0), (0.035, 0.025), (0.0, 0.03)], 10, T(*wp) @ aim_y((s * 0.3, 0, -1))), 'dark', 'head', sharp=50)
    for k, dy in enumerate((0.025, 0.0, -0.025)):
        bend = -0.07 if (dy > 0 and s > 0) or (dy < 0 and s < 0) else 0.0
        a, b_ = Vector((s * 0.17, 1.48 + dy, -0.57)), Vector((s * 0.56, 1.48 + dy * 3.4 + bend, -0.6))
        store(nm('wmount'), bm_box(0.022, 0.014, 0.022, T(*a)), 'steel', 'head', sharp=40)
        tube('head', [tuple(a), tuple(a.lerp(b_, 0.5) + Vector((0, bend * 0.2, 0))), tuple(b_)], 0.0075, 'steel', 6, 3)
# the CRT face plate: a dark well, a steel bezel with rivets, a hood
store('crtwell', bm_box(SW + 0.02, SH + 0.02, 0.1, T(0, SY, SZ + 0.06)), 'core', 'head', sharp=40)
for (x, y, w, h) in ((0, SY + SH / 2 + 0.018, SW + 0.07, 0.035), (0, SY - SH / 2 - 0.018, SW + 0.07, 0.035), (-SW / 2 - 0.018, SY, 0.035, SH), (SW / 2 + 0.018, SY, 0.035, SH)):
    store(nm('bezel'), bm_box(w, h, 0.04, T(x, y, SZ + 0.005)), 'dark', 'head', bevel=0.004, seg=1, sharp=40)
for x in (-0.2, -0.1, 0.0, 0.1, 0.2):
    bolt('head', (x, SY + SH / 2 + 0.018, SZ - 0.016), (0, 0, -1), 0.0065)
    bolt('head', (x, SY - SH / 2 - 0.018, SZ - 0.016), (0, 0, -1), 0.0065)
store('hood', bm_box(SW + 0.12, 0.022, 0.1, T(0, SY + SH / 2 + 0.055, SZ - 0.01) @ R('X', 0.25)), 'paint', 'head', bevel=0.004, seg=1, sharp=40)
# cheek panels (breakable: plate6, plate7)
for s, pg in ((-1, 'plate6'), (1, 'plate7')):
    store(nm('cheekp'), bm_box(0.08, 0.2, 0.03, T(s * 0.36, 1.62, -0.3) @ R('Y', s * 0.7)), 'paint' if s < 0 else 'paint2', pg, bevel=0.004, seg=1, sharp=40)
    for dy in (-0.07, 0.07):
        bolt(pg, (s * 0.37 - s * 0.0, 1.62 + dy, -0.32), (s * 0.6, 0, -0.8), 0.007)
# the dropped jaw plate and its cables
store('jawplate', bm_box(0.22, 0.09, 0.02, T(0, 1.36, -0.53) @ R('X', -0.6)), 'paint', 'jaw', bevel=0.003, seg=1, sharp=40)
store('jawhinge', bm_sweep([(-0.12, 1.41, -0.5), (0.12, 1.41, -0.5)], [0.012, 0.012], 10, 2), 'steel', 'head', sharp=50)
tube('jaw', [(0.07, 1.4, -0.5), (0.09, 1.33, -0.56), (0.08, 1.24, -0.56)], 0.008, 'wire_r', 6, 5)
tube('jaw', [(-0.06, 1.4, -0.5), (-0.08, 1.32, -0.55), (-0.05, 1.26, -0.53)], 0.007, 'rubber', 6, 5)
# ears: the right a riveted 4-sided pyramid (0.38 tall) with a dull red inner plate; the left torn to its full triangular frame with a scrap of plate
tilt = -0.28
bc_ = Vector((0.26 - 0.19 * math.sin(-tilt), 2.05 - 0.19 * math.cos(tilt), -0.12))
tip = Vector((0.26 + 0.19 * math.sin(-tilt), 2.05 + 0.19 * math.cos(tilt), -0.12))
rx_ = Vector((math.cos(tilt), math.sin(tilt), 0)) * 0.17
corners = [bc_ + rx_, bc_ + Vector((0, 0, -0.071)), bc_ - rx_, bc_ + Vector((0, 0, 0.071))]
for i in range(4):
    a, b_ = corners[i], corners[(i + 1) % 4]
    nrm = (b_ - a).cross(tip - a).normalized()
    if nrm.dot((a + b_) / 2 - bc_) < 0:
        nrm = -nrm
    tri = [tuple(a), tuple(b_), tuple(tip)]
    store(nm('ear'), bm_loft([tri, [tuple(Vector(p) - nrm * 0.014) for p in tri]]), 'paint', 'head', bevel=0.003, seg=1, sharp=30)
    for f in (0.3, 0.6):
        p = a.lerp(tip, f)
        bolt('head', tuple(p + nrm * 0.002), tuple(nrm), 0.0065)
inner = [corners[0].lerp(tip, 0.15) + Vector((-0.03, 0.02, -0.03)), corners[2].lerp(tip, 0.15) + Vector((0.03, 0.02, -0.03)), tip.lerp(bc_, 0.25) + Vector((0, 0, -0.03))]
store('earin', bm_loft([[tuple(p) for p in inner], [tuple(p + Vector((0, 0, 0.006))) for p in inner]]), 'paint2', 'head', bevel=0.002, seg=1, sharp=30)
store('earbase', bm_ellipsoid(tuple(bc_ + Vector((0, -0.01, 0))), 0.15, 0.035, 0.08, 12, 6), 'dark', 'head', sharp=50)
b0, b1, tp = Vector((-0.1, 1.9, -0.11)), Vector((-0.42, 1.82, -0.13)), Vector((-0.33, 2.25, -0.14))
for a, b_ in ((b0, tp), (tp, b1), (b1, b0)):
    store(nm('earframe'), bm_sweep([tuple(a), tuple(b_)], [0.016, 0.014], 8, 2), 'steel', 'head', sharp=50)
scrap = [b0 + Vector((-0.02, 0.01, 0)), b0.lerp(b1, 0.55) + Vector((0, 0.01, 0)), b0.lerp(tp, 0.42) + Vector((-0.02, 0, -0.01))]
store('earscrap', bm_loft([[tuple(p) for p in scrap], [tuple(p + Vector((0, 0, 0.014))) for p in scrap]]), 'paint', 'head', bevel=0.003, seg=1, sharp=30)
tube('head', [tuple(b0.lerp(tp, 0.3)), tuple(b0.lerp(tp, 0.3) + Vector((0.03, -0.1, -0.05)))], 0.005, 'wire_y', 6, 3)
store('earbase2', bm_ellipsoid(tuple((b0 + b1) / 2 + Vector((0, -0.005, 0.01))), 0.15, 0.035, 0.08, 12, 6), 'dark', 'head', sharp=50)
# antenna with a red tip, a broken lamp box
tube('head', [(-0.05, 1.98, 0.02), (-0.07, 2.15, 0.05), (-0.09, 2.3, 0.08)], 0.006, 'steel', 6, 3)
store('anttip', bm_ellipsoid((-0.09, 2.31, 0.08), 0.016, 0.016, 0.016, 8, 5), 'lens', 'head', sharp=60, wn=False)
store('brokelamp', bm_box(0.06, 0.04, 0.06, T(0.12, 1.98, 0.04) @ R('X', 0.4) @ R('Z', 0.3)), 'dark', 'head', bevel=0.003, seg=1)


# ---------------------------------------------------------------- ARMS (the front legs)
def strut(grp, x, y0, y1, z, r, plate=None):
    store(nm('strut'), bm_sweep([(x, y0, z), (x, (y0 + y1) / 2, z), (x, y1, z)], [r, r * 0.9, r * 0.82], 10, 3, ell=(1.0, 0.8)), 'dark', grp, sharp=40)
    for fz in (-1, 1):
        store(nm('flange'), bm_sweep([(x, y0 - 0.01, z + fz * r * 0.85), (x, y1 + 0.01, z + fz * r * 0.7)], [0.012, 0.01], 4, 2, ell=(2.4, 0.5), up=(0, 0, 1)), 'steel', grp, sharp=40)
    ram(grp, (x + 0.04, y0 - 0.04, z + 0.06), (x + 0.035, y1 + 0.04, z + 0.055), 0.013)
    hose(grp, [(x - 0.045, y0 - 0.02, z + 0.03), (x - 0.06, (y0 + y1) / 2, z + 0.02), (x - 0.045, y1 + 0.03, z + 0.03)], 0.01)
    if plate:
        sh = Shell([y0 - 0.02, (y0 + y1) / 2, y1 + 0.03], W=[0.12, 0.14, 0.11], D=[0.12, 0.14, 0.11], Zc=[z] * 3, p=2.1, X=[x] * 3)
        store(nm('guard'), sh.panel(y0 - 0.02, y1 + 0.03, PI - 1.2, PI + 1.2, 0.012, 0.0, 6, 10, taper=0.45), 'paint', plate, bevel=0.003, seg=1, sharp=40)
        for k in range(3):
            y = y0 - 0.03 - (y0 - y1 - 0.06) * k / 2
            for a in (PI - 0.8, PI + 0.8):
                bolt(plate, sh.pt(y, a, 0.014), tuple(sh.normal(y, a)), 0.0065)


def cowl(grp, x, y, z, plate, cls):
    s = 1 if x > 0 else -1
    c, r = (x + s * 0.03, y + 0.06, z), (0.13, 0.11, 0.13)
    for k in range(4):
        ell_plate(plate, c, r, k * PI / 2 + 0.05, (k + 1) * PI / 2 - 0.05, 0.1, 1.4, 0.014, 0.0, cls, rv=2)


for s, side in ((-1, 'beckon'), (1, 'slam')):
    x = s * BX
    cowl(side + 'Arm', x, BY, BZ, 'plate0' if s < 0 else 'plate1', 'paint2' if s < 0 else 'paint')
    clevis(side + 'Arm', (x, BY, BZ), 0.07, 0.045)
# beckoning leg: upper strut, elbow drum, forearm, the wide paw (fingers down at the bind pose; palm faces -z), palm pad, iris, the core
strut('beckonArm', -BX, BY - 0.04, BY - 0.27, BZ, 0.05, 'plate2')
store('bedrum', bm_lathe([(0.0, -0.06), (0.058, -0.06), (0.062, -0.05), (0.062, 0.05), (0.058, 0.06), (0.0, 0.06)], 16, T(-BX, BY - 0.3, BZ) @ R('Z', PI / 2)), 'dark', 'beckonFore', bevel=0.002, seg=1, sharp=40)
strut('beckonFore', -BX, BY - 0.34, BY - 0.53, BZ, 0.045, 'plate4')
clevis('beckonPaw', (-BX, BY - 0.56, BZ), 0.06, 0.035)
WY = BY - 0.56
ps = Shell([WY - 0.02, WY - 0.12, WY - 0.24, WY - 0.3], W=[0.16, 0.27, 0.26, 0.2], D=[0.08, 0.1, 0.1, 0.08], Zc=[BZ] * 4, p=3.0, X=[-BX] * 4)
store('pcore', ps.solid(WY - 0.03, WY - 0.29, 5, 20, off=-0.01), 'dark', 'beckonPaw', sharp=50)
store(nm('pback'), ps.panel(WY - 0.03, WY - 0.29, -1.2, 1.2, 0.014, 0.0, 6, 12), 'paint', 'beckonPaw', bevel=0.004, seg=1, sharp=40)
for a0, a1 in ((1.25, 1.9), (-1.9, -1.25)):
    store(nm('pside'), ps.panel(WY - 0.05, WY - 0.27, a0, a1, 0.012, 0.0, 5, 5), 'paint', 'beckonPaw', bevel=0.003, seg=1, sharp=40)
for k in range(6):
    y = WY - 0.06 - k * 0.04
    for a in (-0.9, 0.9):
        bolt('beckonPaw', ps.pt(y, a, 0.016), tuple(ps.normal(y, a)), 0.006)
pz = BZ - 0.055
PCY = WY - 0.15
store('padring', bm_torus(0.095, 0.02, 24, 8, T(-BX, PCY, pz) @ R('X', PI / 2)), 'rubber', 'beckonPaw', sharp=60)
store('iris', bm_lathe([(0.084, 0.0), (0.084, 0.01), (0.058, 0.012)], 24, T(-BX, PCY, pz) @ R('X', -PI / 2)), 'steel', 'beckonPaw', sharp=50)
store('bcorelens', bm_ellipsoid((-BX, PCY, pz - 0.006), 0.072, 0.072, 0.02, 20, 8), 'lens', 'beckonCore', sharp=60, wn=False)
for k in range(4):
    fx = -BX - 0.09 + 0.06 * k
    fy0 = WY - 0.29
    pts = [(fx, fy0 + 0.02, BZ), (fx, fy0 - 0.06, BZ - 0.01), (fx, fy0 - 0.1, BZ - 0.05), (fx, fy0 - 0.11, BZ - 0.09)]
    store(nm('finger'), bm_sweep(pts, [0.026, 0.024, 0.021, 0.017], 10, 3), 'paint2' if k == 1 else 'paint', 'beckonPaw', sharp=50)
    Qf, Uf = spline(pts, 4)
    for f in (0.3, 0.65):
        i = int(f * (len(Qf) - 1))
        d = (Qf[i + 1] - Qf[i - 1]).normalized()
        store(nm('knuck'), bm_lathe([(0.028, -0.006), (0.03, 0.0), (0.028, 0.006)], 10, T(*Qf[i]) @ aim_y(d)), 'steel', 'beckonPaw', sharp=40)
    store(nm('claw'), bm_sweep([pts[-1], (fx, fy0 - 0.1, BZ - 0.115), (fx, fy0 - 0.085, BZ - 0.125)], [0.009, 0.006, 0.002], 6, 3), 'dark', 'beckonPaw', sharp=50)
store('thumb', bm_sweep([(-BX + 0.12, WY - 0.08, BZ - 0.02), (-BX + 0.16, WY - 0.14, BZ - 0.05), (-BX + 0.15, WY - 0.2, BZ - 0.08)], [0.026, 0.022, 0.017], 10, 3), 'paint', 'beckonPaw', sharp=50)
# slam leg: upper strut, the boom housing (covered: plate5), four telescoping sleeves, the stamp paw with the core on its front
strut('slamArm', BX, BY - 0.04, BY - 0.19, BZ, 0.055, 'plate3')
SY1 = BY - 0.22
clevis('slamFore', (BX, SY1, BZ), 0.08, 0.048)
hb = Shell([SY1 - 0.02, SY1 - 0.08, SY1 - 0.16], W=[0.15, 0.16, 0.15], D=[0.15, 0.16, 0.15], Zc=[BZ] * 3, p=3.2, X=[BX] * 3)
store('housing', hb.solid(SY1 - 0.02, SY1 - 0.165, 4, 20), 'dark', 'slamFore', bevel=0.004, seg=1, sharp=40)
store(nm('hcover'), hb.panel(SY1 - 0.03, SY1 - 0.155, PI - 1.0, PI + 1.0, 0.012, 0.004, 5, 10), 'paint', 'plate5', bevel=0.004, seg=1, sharp=40)
for y in (SY1 - 0.05, SY1 - 0.13):
    for a in (PI - 0.7, PI + 0.7):
        bolt('plate5', hb.pt(y, a, 0.016), tuple(hb.normal(y, a)), 0.007)
for k in range(3):
    store(nm('hrib2'), bm_lathe([(0.088, -0.007), (0.092, 0.0), (0.088, 0.007)], 20, T(BX, SY1 - 0.04 - k * 0.045, BZ)), 'steel', 'slamFore', sharp=40)
hose('slamFore', [(BX + 0.08, SY1 + 0.02, BZ + 0.03), (BX + 0.11, SY1 - 0.08, BZ + 0.05), (BX + 0.08, SY1 - 0.16, BZ + 0.05)], 0.013)
for k in range(1, 5):
    y0 = SY1 - 0.16 - 0.12 * (k - 1)
    r = 0.07 - 0.008 * k
    g = 'slamS%d' % k
    store(nm('sleeve'), bm_lathe([(r, 0.05), (r, -0.12 - 0.02), (r * 0.9, -0.12 - 0.025)], 16, T(BX, y0, BZ), cap0=False, cap1=True), 'steel' if k % 2 else 'chrome', g, sharp=40)
    store(nm('scollar'), bm_lathe([(r + 0.012, -0.02), (r + 0.016, -0.012), (r + 0.016, 0.012), (r + 0.012, 0.02), (r, 0.02), (r, -0.02)], 16, T(BX, y0 - 0.1, BZ)), 'dark', g, bevel=0.002, seg=1, sharp=40)
    for a in range(4):
        aa = PI / 4 + a * PI / 2
        bolt(g, (BX + math.sin(aa) * (r + 0.016), y0 - 0.1, BZ + math.cos(aa) * (r + 0.016)), (math.sin(aa), 0, math.cos(aa)), 0.006)
SPY = BY - 0.86
sp = Shell([SPY + 0.02, SPY - 0.08, SPY - 0.18, SPY - 0.22], W=[0.16, 0.3, 0.31, 0.3], D=[0.16, 0.28, 0.29, 0.28], Zc=[BZ] * 4, p=2.8, X=[BX] * 4)
store('spcore', sp.solid(SPY + 0.01, SPY - 0.21, 5, 20, off=-0.012), 'dark', 'slamPaw', sharp=50)
for a0, a1, cls in ((PI - 1.1 + 0.02, PI + 1.1 - 0.02, 'paint'), (PI + 1.1 + 0.02, 2 * PI - 0.02, 'paint'), (0.02, PI - 1.1 - 0.02, 'paint2')):
    store(nm('sppan'), sp.panel(SPY, SPY - 0.2, a0, a1, 0.016, 0.0, 6, 10), cls, 'slamPaw', bevel=0.004, seg=1, sharp=40)
for k in range(8):
    a = 2 * PI * k / 8
    bolt('slamPaw', sp.pt(SPY - 0.02, a, 0.018), tuple(sp.normal(SPY - 0.02, a)), 0.007)
store('spcap', bm_lathe([(0.0, 0.0), (0.12, 0.0), (0.14, -0.02), (0.15, -0.05), (0.0, -0.05)], 20, T(BX, SPY - 0.2, BZ)), 'rubber', 'slamPaw', bevel=0.004, seg=1, sharp=40)
for k in range(3):
    a = -0.6 + 0.6 * k
    store(nm('toepad'), bm_ellipsoid((BX + math.sin(a) * 0.1, SPY - 0.25, BZ - math.cos(a) * 0.1), 0.055, 0.035, 0.06, 12, 6), 'rubber', 'slamPaw', sharp=50)
    store(nm('sclaw'), bm_sweep([(BX + math.sin(a) * 0.13, SPY - 0.23, BZ - math.cos(a) * 0.13), (BX + math.sin(a) * 0.17, SPY - 0.26, BZ - math.cos(a) * 0.17), (BX + math.sin(a) * 0.19, SPY - 0.29, BZ - math.cos(a) * 0.18)], [0.014, 0.009, 0.003], 6, 3), 'dark', 'slamPaw', sharp=50)
spz = BZ - 0.155
store('spring', bm_torus(0.095, 0.02, 24, 8, T(BX, SPY - 0.12, spz) @ R('X', PI / 2)), 'steel', 'slamPaw', sharp=60)
store('spiris', bm_lathe([(0.085, 0.0), (0.085, 0.01), (0.06, 0.012)], 24, T(BX, SPY - 0.12, spz) @ R('X', -PI / 2)), 'dark', 'slamPaw', sharp=50)
store('scorelens', bm_ellipsoid((BX, SPY - 0.12, spz - 0.004), 0.075, 0.075, 0.022, 20, 8), 'lens', 'slamCore', sharp=60, wn=False)

# ---------------------------------------------------------------- WEAR AND GROWTH
random.seed(97)
mud = []
for k in range(40):
    a = 2 * PI * k / 40 + random.uniform(-0.05, 0.05)
    mud.append(((0.6 * math.sin(a), random.uniform(0.01, 0.05), 0.6 * math.cos(a)), random.uniform(0.02, 0.035), (math.sin(a), 0.2, math.cos(a))))
G.mud('base', mud)
G.leaves('base', [(0.55 * math.sin(a), 0.195, 0.55 * math.cos(a)) for a in [random.uniform(0, 2 * PI) for k in range(14)]], 0.07)
G.moss('base', [((0.5 * math.sin(a), 0.19, 0.5 * math.cos(a)), 0.04) for a in (0.4, 1.6, 2.9, 4.1, 5.3)])
G.tufts('base', [((0.56 * math.sin(a), 0.02, 0.56 * math.cos(a)), 6, 0.18, 0.06) for a in (0.9, 2.2, 3.6, 5.0)], dry=False)
G.moss('base', [((s * 0.3, 0.7, 0.05), 0.04) for s in (-1, 1)])
G.moss('body', [(body_pt(YB[2] + 0.01, a, 0.03), 0.035) for a in (0.4 * PI, 1.2 * PI, 1.7 * PI)])
G.tufts('body', [(body_pt(YB[4] + 0.012, 0.15 * PI, 0.03), 4, 0.12, 0.03)], dry=True)
G.leaves('body', [body_pt(1.0, random.uniform(0, 2 * PI), 0.04) for k in range(5)], 0.06)
G.moss('head', [((0.14, 1.98, -0.06), 0.035), ((-0.16, 1.96, 0.0), 0.03)])
G.leaves('head', [(random.uniform(-0.15, 0.15), 1.99, random.uniform(-0.15, 0.05)) for k in range(4)], 0.06)
G.dent(body_pt(0.56, 1.2 * PI), body_n(0.56, 1.2 * PI), 0.07, 0.012)
G.dent(body_pt(0.98, 0.6 * PI), body_n(0.98, 0.6 * PI), 0.06, 0.01)
G.dent(ell(HC, HR, 1.5, 0.3), ell_n(HC, HR, ell(HC, HR, 1.5, 0.3)), 0.06, 0.01)
for p in ((0.2, 1.24, -0.1), (-0.2, 1.24, -0.1), (0.0, 1.05, -0.3), (0.3, 0.95, 0.05), (-0.3, 0.6, 0.0), (0.0, 0.2, -0.55)):
    G.oil(p, 0.035, 0.45)
G.soot(body_pt(0.42, 0.15 * PI, 0.02), 0.08, 0.3)
G.soot((0.0, 1.99, -0.05), 0.04, 0.15)

apply_all()
tot = sum(tris(ob) for ob in OBJS)
print('objects', len(OBJS), 'triangles', tot)
bpy.context.scene['rams'] = repr([])
bpy.ops.wm.save_as_mainfile(filepath=out)
save_marks(out[:-6] + '_marks.json')
kinds = {}
for ob in OBJS:
    k = ob.name.split('_')[0]
    kinds[k] = kinds.get(k, 0) + tris(ob)
print(sorted(kinds.items(), key=lambda q: -q[1])[:18])
