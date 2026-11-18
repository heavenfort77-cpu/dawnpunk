# The Walker (municipal service machine SVC-07) as a desktop model, built in Blender headless.
# Usage: python3 tools/gloomglb/walker_model.py <out.blend>
# Same silhouette, sizes and pivots as the desktop builder in src/gloomhi.js (CONFIG.desolate.walker.shape); the game turns the nodes
# pelvis, torso, neck, head, hip0/knee0 (left leg, x < 0), hip1/knee1, arm0/fore0 (left arm), arm1/fore1. Rams are separate nodes
# ramc_* (cylinder, on the upper part, points along -y) and ramr_* (rod, on the lower part, points along +y): the game aims them every frame.
# Empty 'screen' in the head marks where the game puts the display. Classes (custom property cls) say how each part is textured.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from bl_lib import *

random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/walker.blend'

# shape numbers (CONFIG.desolate.walker.shape)
HIP, HIPW, THIGH, SHIN, CH, TORSO, ARM, HEADUP = 0.98, 0.2, 0.46, 0.44, 0.36, 0.5, 0.36, 0.3
HW, HH, HD = 0.46, 0.36, 0.3
TY = HIP + 0.08                 # torso pivot
YOKE = TY + 0.14 + TORSO        # 1.70
NECKY = YOKE + 0.06             # 1.76
HEADY = NECKY + HEADUP          # 2.06

group('pelvis', (0, HIP, 0))
group('torso', (0, TY, 0), 'pelvis')
group('neck', (0, NECKY, 0), 'torso')
group('head', (0, HEADY, 0), 'neck')
for i, sx in enumerate((-1, 1)):
    group('hip%d' % i, (sx * HIPW, HIP, 0), 'pelvis')
    group('knee%d' % i, (sx * HIPW, HIP - THIGH, 0), 'hip%d' % i)
    group('arm%d' % i, (sx * 0.46, YOKE - 0.04, 0), 'torso')
    group('fore%d' % i, (sx * 0.46, YOKE - 0.04 - ARM, 0), 'arm%d' % i)
scr = empty('screen', (0, HEADY, 0.02 - HD / 2), GROUPS['head'][0])

N = [0]


def nm(s):
    N[0] += 1
    return '%s_%03d' % (s, N[0])


# ---------------------------------------------------------------- small fittings
def bolt(grp, p, n, r=0.009, cls='bolt'):
    # a hex bolt head (on a washer when it is a big one) at p, facing n (game axes); no hidden faces
    M = T(*p) @ aim_y(n)
    parts = [bm_lathe([(r, r * 0.2), (r, r * 0.85), (r * 0.72, r * 1.05)], 6, M, cap0=False, phase=random.random())]
    if r >= 0.0075:
        parts.append(bm_lathe([(r * 1.45, 0), (r * 1.45, r * 0.25)], 8, M, cap0=False))
    return store(nm('bolt'), bm_join(parts), cls, grp, sharp=40, wn=False)


def rivet(grp, p, n, r=0.006):
    M = T(*p) @ aim_y(n)
    return store(nm('riv'), bm_lathe([(r, 0), (r * 0.8, r * 0.5), (0, r * 0.75)], 6, M, cap0=False), 'bolt', grp, sharp=60, wn=False)


def tube(grp, pts, r, cls='rubber', sides=6, sub=4):
    return store(nm('cab'), bm_tube(pts, r, sides, sub), cls, grp, sharp=80, wn=False)


def boxo(grp, w, h, d, M, cls='paint', bev=0.006, seg=2, name='box'):
    return store(nm(name), bm_box(w, h, d, M), cls, grp, bevel=bev, seg=seg)


def hub_x(grp, x0, x1, r, y, z, cls='dark', seg=16, cap_r=None):
    # a round bearing housing along x from x0 to x1, with a raised cap ring at the outer end
    sgn = 1 if x1 > x0 else -1
    L = abs(x1 - x0)
    M = T((x0 + x1) / 2, y, z) @ R('Z', -sgn * PI / 2)
    prof = [(r * 0.92, -L / 2), (r, -L / 2 + 0.006), (r, L / 2 - 0.01), (r * 0.94, L / 2 - 0.004), (r * 0.7, L / 2), (r * 0.6, L / 2 + 0.008), (r * 0.25, L / 2 + 0.012)]
    store(nm('hub'), bm_lathe(prof, seg, M), cls, grp, sharp=35)
    # bolt circle on the cap
    for k in range(6):
        a = k * PI / 3 + 0.3
        q = M @ Vector((math.sin(a) * r * 0.8, L / 2 - 0.004, math.cos(a) * r * 0.8))
        bolt(grp, tuple(q), (sgn, 0, 0), r=0.007)


def lamp_x(grp, x, y, z, sgn, r=0.032):
    # a round lamp on a side face: housing, rim, lens (class lens: the game makes it glow)
    M = T(x, y, z) @ R('Z', -sgn * PI / 2)
    store(nm('lamph'), bm_lathe([(r * 1.25, 0), (r * 1.3, 0.004), (r * 1.15, 0.03), (r * 1.25, 0.034), (r * 0.98, 0.036), (r * 0.98, 0.026)], 18, M, cap0=True, cap1=False), 'dark', grp, bevel=0.002, seg=1)
    store(nm('lens'), bm_lathe([(r * 0.99, 0.026), (r * 0.8, 0.034), (r * 0.4, 0.038), (0, 0.039)], 18, M), 'lens', grp, sharp=60, wn=False)
    for k in range(3):
        a = k * 2.094 + 0.5
        q = M @ Vector((math.sin(a) * r * 1.12, 0.035, math.cos(a) * r * 1.12))
        bolt(grp, tuple(q), (sgn, 0, 0), r=0.004)


# ---------------------------------------------------------------- HEAD: a CRT-style monitor housing, tapered at the back, the screen in a deep recess under a hood
hz0 = 0.02 - HD / 2          # front face (z)
hc = HEADY


def ring_xy(w, h, r, z, y=hc, n=3):
    return [(x, y + yy, z) for (x, yy) in rrect(w, h, r, n)]


shell = store('head_shell', bm_loft([ring_xy(HW, HH, 0.035, hz0), ring_xy(HW, HH, 0.035, hz0 + 0.095), ring_xy(HW - 0.012, HH - 0.012, 0.035, hz0 + 0.11), ring_xy(0.38, 0.29, 0.04, hz0 + HD)]), 'paint', 'head', bevel=0.007, seg=2)
cuts = [bm_box(0.372, 0.282, 0.06, T(0, hc, hz0 + 0.008))]
# a seam all round where the bezel meets the back shell
cuts.append(bm_loft([ring_xy(HW + 0.03, HH + 0.03, 0.04, hz0 + 0.092), ring_xy(HW + 0.03, HH + 0.03, 0.04, hz0 + 0.098), ring_xy(HW - 0.008, HH - 0.008, 0.03, hz0 + 0.098), ring_xy(HW - 0.008, HH - 0.008, 0.03, hz0 + 0.092)], closed=True))
# rear vent slots
for k in range(5):
    cuts.append(bm_box(0.2, 0.011, 0.05, T(0, hc - 0.07 + k * 0.03, hz0 + HD) @ R('X', -0.21)))
boolean(shell, cuts)
# the screen's back wall and a dark lip round the opening
store('head_well', bm_box(0.37, 0.28, 0.01, T(0, hc, hz0 + 0.04)), 'core', 'head')
store('head_bezel', bm_loft([ring_xy(0.415, 0.325, 0.025, hz0 - 0.012), ring_xy(0.415, 0.325, 0.025, hz0 + 0.004), ring_xy(0.372, 0.282, 0.01, hz0 + 0.004), ring_xy(0.372, 0.282, 0.01, hz0 - 0.012)], closed=True), 'dark', 'head', bevel=0.003, seg=2)
# the hood over the screen, with cheeks
boxo('head', HW - 0.01, 0.012, 0.085, T(0, hc + HH / 2 - 0.012, hz0 - 0.035) @ R('X', 0.22), 'paint', 0.004)
for sx in (-1, 1):
    store(nm('cheek'), bm_loft([[(sx * (HW / 2 - 0.012), hc + HH / 2 - 0.004, hz0), (sx * (HW / 2 - 0.012), hc + HH / 2 - 0.004, hz0 - 0.075), (sx * (HW / 2 - 0.012), hc + 0.07, hz0)],
                                [(sx * (HW / 2 - 0.002), hc + HH / 2 - 0.004, hz0), (sx * (HW / 2 - 0.002), hc + HH / 2 - 0.004, hz0 - 0.075), (sx * (HW / 2 - 0.002), hc + 0.07, hz0)]]), 'paint', 'head', bevel=0.003, seg=1)
for bu in (-1, 1):
    for bv in (-1, 1):
        bolt('head', (bu * 0.205, hc + bv * 0.158, hz0 - 0.012), (0, 0, -1), r=0.0065)
# side lamps, a carry handle and an aerial on top, screws along the seam
for sx in (-1, 1):
    lamp_x('head', sx * (HW / 2 + 0.001), hc + 0.03, hz0 + 0.05, sx)
    for v in (-0.12, 0.12):
        bolt('head', (sx * (HW / 2 - 0.003), hc + v, hz0 + 0.075), (sx, 0, 0), r=0.006)
    boxo('head', 0.03, 0.02, 0.05, T(sx * 0.1, hc + HH / 2 - 0.02, hz0 + 0.17), 'dark', 0.004)
tube('head', [(-0.1, hc + 0.152, hz0 + 0.17), (-0.1, hc + 0.205, hz0 + 0.17), (-0.06, hc + 0.225, hz0 + 0.17), (0.06, hc + 0.225, hz0 + 0.17), (0.1, hc + 0.205, hz0 + 0.17), (0.1, hc + 0.152, hz0 + 0.17)], 0.009, 'steel', 8, 4)
store('aerial', bm_join([bm_cyl(0.0055, 0.0035, 0.3, 6, T(0.155, hc + 0.12 + 0.15, hz0 + 0.24) @ R('Z', -0.15) @ T(0, 0, 0)),
                         bm_lathe([(0.016, 0), (0.016, 0.012), (0.008, 0.02)], 8, T(0.15, hc + 0.122, hz0 + 0.24))]), 'steel', 'head', sharp=50, wn=False)
store('aerial_tip', bm_lathe([(0, -0.008), (0.008, -0.004), (0.008, 0.004), (0, 0.008)], 8, T(0.155 + 0.15 * math.sin(0.15), hc + 0.12 + 0.3 * math.cos(0.15) + 0.0, hz0 + 0.24)), 'rubber', 'head', wn=False)
# the maker's plate on the left side and a mount plate under the head
boxo('head', 0.004, 0.05, 0.1, T(-(HW / 2 - 0.004) - 0.003, hc - 0.09, hz0 + 0.06), 'brass', 0.0015, 1)
boxo('head', 0.2, 0.02, 0.16, T(0, hc - HH / 2 - 0.002, 0.02), 'dark', 0.004)

# ---------------------------------------------------------------- NECK: rubber boot, steel column, two struts
prof = []
for k in range(9):
    prof.append((0.088 if k % 2 else 0.07, NECKY - 0.005 + k * 0.012))
store('neck_boot', bm_lathe(prof, 20, I4), 'rubber', 'neck', sharp=70)
store('neck_col', bm_lathe([(0.046, NECKY + 0.08), (0.046, HEADY - HH / 2 - 0.01), (0.075, HEADY - HH / 2 - 0.01), (0.075, HEADY - HH / 2 - 0.0)], 16, I4), 'steel', 'neck', bevel=0.002, seg=1)
for sx in (-1, 1):
    store(nm('nstrut'), bm_cyl(0.009, 0.009, 0.15, 8, T(sx * 0.075, NECKY + 0.07, 0.035) @ R('Z', sx * 0.2)), 'chrome', 'neck', wn=False)
tube('neck', [(0.03, NECKY + 0.02, 0.08), (0.05, NECKY + 0.07, 0.11), (0.06, HEADY - HH / 2 - 0.01, 0.1)], 0.008, 'wire_r')

# ---------------------------------------------------------------- TORSO
# waist casing
wc = store('waist', bm_box(0.62, 0.18, 0.46, T(0, TY + 0.05, 0)), 'paint', 'torso', bevel=0.014, seg=3)
cuts = []
for x in (-0.1, 0.1):
    cuts.append(bm_box(0.006, 0.2, 0.012, T(x, TY + 0.05, -0.23)))
for z in (-0.08, 0.08):
    for sx in (-1, 1):
        cuts.append(bm_box(0.012, 0.2, 0.006, T(sx * 0.31, TY + 0.05, z)))
boolean(wc, cuts)
for x in (-0.27, -0.13, 0.13, 0.27):
    for y in (TY - 0.015, TY + 0.115):
        bolt('torso', (x, y, -0.232), (0, 0, -1), r=0.007)

# the barrel chest: a thick shell of eight plates (seams cut in), one plate gone
BY0, BY1 = TY + 0.14, TY + 0.14 + TORSO - 0.0
ZS = 0.78


def rdrum(y):
    t = (y - BY0) / (BY1 - BY0)
    return CH * 1.1 + (CH * 0.98 - CH * 1.1) * t + 0.018 * math.sin(PI * t)


outer = [(rdrum(BY0 + (BY1 - BY0) * k / 6), BY0 + (BY1 - BY0) * k / 6) for k in range(7)]
inner = [(r - 0.014, y) for (r, y) in reversed(outer)]
drum = store('drum', bm_lathe(outer + inner, 48, S(1, 1, ZS), closed=True), 'paint', 'torso', bevel=0.004, seg=2, sharp=30)
GONE = 3                       # plate index (centre angle k*45 deg from +z); 3 = 135 deg = front right
cuts = []
for k in range(8):
    a = k * PI / 4 + PI / 8
    rr = rdrum((BY0 + BY1) / 2)
    cuts.append(bm_box(0.007, BY1 - BY0 + 0.1, 0.03, S(1, 1, ZS) @ R('Y', a) @ T(0, (BY0 + BY1) / 2, rr + 0.01)))
a = GONE * PI / 4
cuts.append(bm_box(2 * 0.42 * math.sin(PI / 8) - 0.012, 0.42, 0.2, S(1, 1, ZS) @ R('Y', a) @ T(0, (BY0 + BY1) / 2 - 0.01, 0.42)))
boolean(drum, cuts)
# inside the gap: the dark core, frame hoops, a strut, wiring, a junction box
store('core', bm_lathe([(CH * 0.86, BY0 + 0.01), (CH * 0.82, BY1 - 0.01)], 28, S(1, 1, ZS)), 'core', 'torso', sharp=40)
for f in (0.15, 0.5, 0.85):
    y = BY0 + f * (BY1 - BY0)
    store(nm('hoop'), bm_arcplate(rdrum(y) - 0.04, rdrum(y) - 0.014, y - 0.012, y + 0.012, a - 0.5, a + 0.5, 10, ZS), 'steel', 'torso', bevel=0.002, seg=1)
for da in (-0.36, 0.36):
    store(nm('strut'), bm_arcplate(rdrum(BY0) - 0.045, rdrum(BY0) - 0.016, BY0 + 0.01, BY1 - 0.01, a + da - 0.03, a + da + 0.03, 1, ZS), 'steel', 'torso', bevel=0.002, seg=1)
rm = CH * 0.88
for j, cls in enumerate(('wire_r', 'wire_y', 'rubber', 'rubber')):
    a0 = a - 0.25 + j * 0.15
    pts = [(math.sin(a0) * rm, BY1 - 0.02, math.cos(a0) * rm * ZS), (math.sin(a0 + 0.1) * (rm + 0.02), BY1 - 0.18, math.cos(a0 + 0.1) * (rm + 0.02) * ZS), (math.sin(a0 + 0.05) * (rm + 0.03), BY0 + 0.15 - 0.02 * j, math.cos(a0 + 0.05) * (rm + 0.03) * ZS), (math.sin(a0) * rm, BY0 + 0.02, math.cos(a0) * rm * ZS)]
    tube('torso', pts, 0.0065 if j < 2 else 0.009, cls)
jb = (math.sin(a) * (rm + 0.01), BY0 + 0.3, math.cos(a) * (rm + 0.01) * ZS)
boxo('torso', 0.09, 0.11, 0.05, T(*jb) @ R('Y', a), 'dark', 0.005)
# a loose wire hanging out of the gap
tube('torso', [(math.sin(a + 0.1) * rm, BY0 + 0.25, math.cos(a + 0.1) * rm * ZS), (math.sin(a + 0.1) * (rm + 0.08), BY0 + 0.18, math.cos(a + 0.1) * (rm + 0.08) * ZS), (math.sin(a + 0.12) * (rm + 0.1), BY0 + 0.02, math.cos(a + 0.12) * (rm + 0.1) * ZS), (math.sin(a + 0.14) * (rm + 0.1), BY0 - 0.06, math.cos(a + 0.14) * (rm + 0.1) * ZS)], 0.006, 'wire_r')
# two bolted hoops round the drum, rivet rows beside each seam
for yb in (TY + 0.33, TY + 0.56):
    r0 = rdrum(yb)
    store(nm('band'), bm_lathe([(r0 - 0.002, yb - 0.018), (r0 + 0.011, yb - 0.018), (r0 + 0.011, yb + 0.018), (r0 - 0.002, yb + 0.018)], 48, S(1, 1, ZS), closed=True), 'dark', 'torso', bevel=0.003, seg=1, sharp=30)
    for k in range(12):
        aa = k / 12 * 2 * PI + 0.1
        nrm = Vector((math.sin(aa) * ZS, 0, math.cos(aa))).normalized()
        bolt('torso', (math.sin(aa) * (r0 + 0.011), yb, math.cos(aa) * (r0 + 0.011) * ZS), tuple(nrm), r=0.007)
for k in range(8):
    for side in (-1, 1):
        aa = k * PI / 4 + PI / 8 + side * 0.07
        if k * PI / 4 + PI / 8 + side * PI / 8 * 0.5 > GONE * PI / 4 - PI / 8 and k * PI / 4 + PI / 8 + side * PI / 8 * 0.5 < GONE * PI / 4 + PI / 8:
            continue
        for y in (TY + 0.2, TY + 0.44, TY + 0.62):
            r0 = rdrum(y)
            nrm = Vector((math.sin(aa) * ZS, 0, math.cos(aa))).normalized()
            rivet('torso', (math.sin(aa) * r0, y, math.cos(aa) * r0 * ZS), tuple(nrm))
# front stencil plate (curved), and a vent grille low on the front left
store('stencilplate', bm_arcplate(0, 0.008, TY + 0.36, TY + 0.53, PI - 0.36, PI + 0.36, 14, ZS, rfun=rdrum), 'paint', 'torso', bevel=0.002, seg=1)
for k, aa in enumerate((PI - 0.33, PI + 0.33)):
    for y in (TY + 0.375, TY + 0.515):
        r0 = rdrum(y) + 0.008
        bolt('torso', (math.sin(aa) * r0, y, math.cos(aa) * r0 * ZS), tuple(Vector((math.sin(aa) * ZS, 0, math.cos(aa))).normalized()), r=0.006)
gr = store('grille', bm_arcplate(0, 0.012, TY + 0.2, TY + 0.31, PI + 0.42, PI + 0.95, 10, ZS, rfun=rdrum), 'dark', 'torso', bevel=0.003, seg=1)
boolean(gr, [bm_box(0.17, 0.012, 0.08, R('Y', PI + 0.68) @ T(0, TY + 0.218 + k * 0.022, 0.35)) for k in range(4)])

# the shoulder yoke: a sloped-top casing, lifting eyes, a neck collar, sockets for the arms, handles
ys = []
for (w, d, y) in ((0.78, 0.4, YOKE - 0.06), (0.78, 0.4, YOKE + 0.02), (0.7, 0.34, YOKE + 0.06)):
    ys.append([(x, y, z) for (x, z) in rrect(w, d, 0.05, 3)])
yk = store('yoke', bm_loft(ys), 'paint', 'torso', bevel=0.01, seg=3)
boolean(yk, [bm_box(0.006, 0.2, 0.5, T(x, YOKE, 0)) for x in (-0.2, 0.2)])
for sx in (-1, 1):
    store(nm('eye'), bm_torus(0.028, 0.008, 16, 6, T(sx * 0.27, YOKE + 0.1, 0) @ R('X', PI / 2)), 'steel', 'torso', wn=False)
    boxo('torso', 0.05, 0.03, 0.04, T(sx * 0.27, YOKE + 0.07, 0), 'dark', 0.005)
    hub_x('torso', sx * 0.34, sx * 0.4, 0.08, YOKE - 0.04, 0, 'dark')
    tube('torso', [(sx * 0.392, YOKE - 0.01, -0.06), (sx * 0.405, YOKE + 0.03, -0.06), (sx * 0.405, YOKE + 0.03, 0.06), (sx * 0.392, YOKE - 0.01, 0.06)], 0.009, 'steel', 8, 4)
    # cables from the yoke front to the shoulder
    for j, cls in enumerate(('rubber', 'wire_r', 'wire_y')):
        o = j * 0.022
        tube('torso', [(sx * 0.17, YOKE + 0.02 - o * 0.5, -0.2), (sx * 0.3, YOKE - 0.05 - o, -0.215), (sx * 0.4, YOKE - 0.07 - o * 0.5, -0.12)], 0.008, cls)
store('collar', bm_lathe([(0.1, YOKE + 0.06), (0.1, YOKE + 0.075), (0.085, YOKE + 0.085), (0.06, YOKE + 0.085)], 20, I4), 'dark', 'torso', bevel=0.002, seg=1)
for k in range(6):
    aa = k * PI / 3
    bolt('torso', (math.sin(aa) * 0.092, YOKE + 0.077, math.cos(aa) * 0.092), (0, 1, 0), r=0.006)
# the power pack on the back: fins, a filler cap, straps, hoses to the shoulders, a brass plate
PZ = CH * ZS + 0.05
pk = store('pack', bm_box(0.38, 0.34, 0.14, T(0, TY + 0.42, PZ)), 'paint', 'torso', bevel=0.012, seg=3)
boolean(pk, [bm_box(0.3, 0.008, 0.02, T(0, TY + 0.3 + k * 0.03, PZ + 0.07)) for k in range(6)])
for x in (-0.12, 0.12):
    boxo('torso', 0.04, 0.37, 0.155, T(x, TY + 0.42, PZ + 0.004), 'dark', 0.004)
    for y in (TY + 0.27, TY + 0.57):
        bolt('torso', (x, y, PZ + 0.082), (0, 0, 1), r=0.007)
store('cap', bm_lathe([(0.032, TY + 0.59), (0.032, TY + 0.615), (0.026, TY + 0.625), (0.012, TY + 0.632), (0.012, TY + 0.645), (0, TY + 0.645)], 14, T(0.11, 0, PZ)), 'steel', 'torso', bevel=0.002, seg=1)
boxo('torso', 0.004, 0.07, 0.1, T(0.192, TY + 0.42, PZ), 'brass', 0.0015, 1)
for sx in (-1, 1):
    tube('torso', [(sx * 0.12, TY + 0.59, PZ + 0.03), (sx * 0.2, YOKE + 0.04, PZ - 0.02), (sx * 0.3, YOKE + 0.05, 0.12), (sx * 0.37, YOKE - 0.02, 0.07)], 0.015, 'rubber', 8)

# ---------------------------------------------------------------- PELVIS
boxo('pelvis', 0.64, 0.09, 0.15, T(0, HIP, 0), 'dark', 0.012, 3)
boxo('pelvis', 0.62, 0.06, 0.065, T(0, HIP + 0.02, 0.2), 'dark', 0.01, 2)
boxo('pelvis', 0.12, 0.06, 0.16, T(0, HIP + 0.02, 0.11), 'dark', 0.01, 2)
store('groin', bm_box(0.3, 0.13, 0.022, T(0, HIP - 0.06, -0.1) @ R('X', 0.25)), 'paint', 'pelvis', bevel=0.008, seg=2)
for sx in (-1, 1):
    bolt('pelvis', (sx * 0.11, HIP - 0.02, -0.113), (0, 0.25, -1), r=0.007)
    for cx in (sx * 0.08, sx * 0.32):
        boxo('pelvis', 0.022, 0.2, 0.2, T(cx, HIP - 0.03, 0), 'dark', 0.008)
        bolt('pelvis', (cx + sx * 0.012 * (1 if abs(cx) > 0.2 else -1), HIP - 0.06, 0.05), (sx if abs(cx) > 0.2 else -sx, 0, 0), r=0.007)
    boxo('pelvis', 0.06, 0.08, 0.05, T(sx * HIPW, HIP - 0.015, 0.2), 'dark', 0.006)

# ---------------------------------------------------------------- RAMS: a cylinder from A (on the upper part) and a rod from B (on the lower part), each pointing at the other
RAMS = []


def ram(tag, Pg, Cg, A, B, rc):
    A, B = Vector(A), Vector(B)
    d = (B - A)
    L = d.length
    Lc, Lr = round(L * 0.6, 3), round(L * 0.66, 3)
    rot = aim_y(-d)          # cylinder runs along its own -y toward B
    FA = T(*A) @ rot
    prof = [(0, 0.0), (rc * 1.25, 0.0)]
    cyl = bm_lathe([(rc * 1.0, -0.01), (rc * 1.0, -Lc * 0.92), (rc * 1.22, -Lc * 0.93), (rc * 1.22, -Lc), (rc * 0.55, -Lc - 0.004), (rc * 0.55, -Lc - 0.002)], 14, I4, cap0=False, cap1=True)
    cap = bm_lathe([(rc * 1.2, -0.03), (rc * 1.2, -0.012), (rc * 0.8, -0.004)], 14, I4)
    eye = bm_cyl(rc * 0.9, rc * 0.9, rc * 1.4, 10, R('Z', PI / 2))
    fit = bm_cyl(rc * 0.35, rc * 0.35, rc * 1.2, 6, T(0, -Lc * 0.85, rc * 1.15) @ R('X', PI / 2))
    store('ramc_' + tag, bm_join([cyl, cap, eye, fit]), 'dark', Pg, frame=FA, local=True)
    FB = T(*B) @ aim_y(d)
    rod = bm_lathe([(rc * 0.42, 0.0), (rc * 0.42, Lr)], 10, I4)
    eye2 = bm_cyl(rc * 0.8, rc * 0.8, rc * 1.3, 10, R('Z', PI / 2))
    store('ramr_' + tag, bm_join([rod, eye2]), 'chrome', Cg, frame=FB, local=True)
    RAMS.append((tag, Pg, Cg, tuple(A), tuple(B)))


# ---------------------------------------------------------------- LEGS
for i, sx in enumerate((-1, 1)):
    hg, kg, x = 'hip%d' % i, 'knee%d' % i, sx * HIPW
    hub_x(hg, x - sx * 0.07, x + sx * 0.1, 0.115, HIP, 0, 'dark')
    hub_x(hg, x + sx * 0.07, x - sx * 0.1, 0.1, HIP, 0, 'dark', cap_r=0)
    # thigh housing: a tapered chamfered box, an armour plate in front, a seam round it
    th = store(nm('thigh'), bm_loft([[(x + px, HIP - 0.06, z) for (px, z) in rrect(0.22, 0.21, 0.045, 3)], [(x + px, HIP - THIGH + 0.08, z) for (px, z) in rrect(0.19, 0.18, 0.04, 3)]]), 'dark', hg, bevel=0.006, seg=2)
    boolean(th, [bm_loft([[(x + px, HIP - 0.235, z) for (px, z) in rrect(0.26, 0.25, 0.05, 3)], [(x + px, HIP - 0.229, z) for (px, z) in rrect(0.26, 0.25, 0.05, 3)], [(x + px, HIP - 0.229, z) for (px, z) in rrect(0.195, 0.185, 0.04, 3)], [(x + px, HIP - 0.235, z) for (px, z) in rrect(0.195, 0.185, 0.04, 3)]], closed=True)])
    store(nm('thighplate'), bm_box(0.17, 0.26, 0.016, T(x, HIP - 0.2, -0.107) @ R('X', -0.055)), 'paint2' if i == 1 else 'paint', hg, bevel=0.006, seg=2)
    for bu in (-1, 1):
        for bv in (-1, 1):
            bolt(hg, (x + bu * 0.068, HIP - 0.2 + bv * 0.105, -0.115 - bv * 0.006), (0, 0, -1), r=0.007)
    boxo(hg, 0.05, 0.07, 0.05, T(x, HIP - 0.23, 0.11), 'dark', 0.006)
    boxo(hg, 0.05, 0.06, 0.05, T(x, HIP - 0.161, 0.125), 'dark', 0.006)
    tube(hg, [(x + sx * 0.1, HIP - 0.08, 0.06), (x + sx * 0.115, HIP - 0.25, 0.07), (x + sx * 0.1, HIP - THIGH + 0.09, 0.05)], 0.01, 'rubber')
    tube(hg, [(x + sx * 0.1, HIP - 0.08, 0.03), (x + sx * 0.12, HIP - 0.25, 0.035), (x + sx * 0.1, HIP - THIGH + 0.09, 0.025)], 0.007, 'wire_r')
    # knee: bearing, a cap plate; shin: a tube with collars and a guard plate; ankle and foot
    ky = HIP - THIGH
    hub_x(kg, x - sx * 0.09, x + sx * 0.09, 0.1, ky, 0, 'dark')
    store(nm('kneecap'), bm_box(0.15, 0.11, 0.022, T(x, ky + 0.01, -0.108) @ R('X', 0.15)), 'paint2' if i == 0 else 'paint', kg, bevel=0.008, seg=2)
    for bu in (-1, 1):
        bolt(kg, (x + bu * 0.055, ky + 0.01, -0.12), (0, 0.15, -1), r=0.006)
    store(nm('shin'), bm_lathe([(0.072, ky - 0.04), (0.088, ky - 0.055), (0.088, ky - 0.075), (0.083, ky - 0.08), (0.095, ky - 0.36), (0.106, ky - 0.365), (0.106, ky - 0.385), (0.09, ky - 0.39)], 18, T(x, 0, 0)), 'dark', kg, bevel=0.003, seg=1)
    store(nm('shinguard'), bm_arcplate(0.104, 0.118, ky - 0.33, ky - 0.08, PI - 0.85, PI + 0.85, 10, 1.0, T(x, 0, -0.008), rfun=lambda y: 0.012 * (ky - 0.08 - y) / 0.25), 'paint', kg, bevel=0.005, seg=2)
    for bu in (-1, 1):
        for bv in (-1, 1):
            yb = ky - 0.2 + bv * 0.095
            rr = 0.118 + 0.012 * (ky - 0.08 - yb) / 0.25
            bolt(kg, (x + math.sin(bu * 0.6) * rr, yb, -0.008 - math.cos(bu * 0.6) * rr), (math.sin(bu * 0.6), 0, -math.cos(bu * 0.6)), r=0.0065)
    tube(kg, [(x - sx * 0.07, ky - 0.06, 0.06), (x - sx * 0.09, ky - 0.2, 0.07), (x - sx * 0.08, ky - 0.36, 0.06)], 0.009, 'rubber')
    boxo(kg, 0.05, 0.06, 0.05, T(x, ky - 0.154, 0.115), 'dark', 0.006)
    store(nm('ankle'), bm_cyl(0.05, 0.05, 0.2, 14, T(x, 0.105, -0.01) @ R('Z', PI / 2)), 'steel', kg, bevel=0.003, seg=1)
    boxo(kg, 0.11, 0.07, 0.1, T(x, 0.125, -0.01), 'dark', 0.01)
    ft = store(nm('foot'), bm_loft([[(x + px, 0.03, z) for (px, z) in rrect(0.26, 0.42, 0.05, 3)], [(x + px, 0.088, z + 0.015) for (px, z) in rrect(0.25, 0.39, 0.06, 3)]], T(0, 0, -0.055)), 'paint', kg, bevel=0.008, seg=2)
    store(nm('toe'), bm_loft([[(x - 0.125, 0.03, -0.27), (x + 0.125, 0.03, -0.27), (x + 0.125, 0.03, -0.17), (x - 0.125, 0.03, -0.17)], [(x - 0.12, 0.08, -0.24), (x + 0.12, 0.08, -0.24), (x + 0.12, 0.1, -0.17), (x - 0.12, 0.1, -0.17)]]), 'steel', kg, bevel=0.007, seg=2)
    store(nm('heel'), bm_box(0.2, 0.06, 0.05, T(x, 0.06, 0.15)), 'dark', kg, bevel=0.008, seg=2)
    sole = store(nm('sole'), bm_box(0.255, 0.03, 0.43, T(x, 0.015, -0.06)), 'rubber', kg, bevel=0.006, seg=1)
    boolean(sole, [bm_box(0.3, 0.012, 0.016, T(x, 0.0, -0.25 + k * 0.05)) for k in range(9)])
    for bu in (-1, 1):
        for bv in (-1, 1):
            bolt(kg, (x + bu * 0.09, 0.09, -0.055 + bv * 0.12), (0, 1, 0), r=0.008)
    ram('hip%d' % i, 'pelvis', hg, (x, HIP - 0.011, 0.198), (x, HIP - 0.23, 0.132), 0.033)
    ram('knee%d' % i, hg, kg, (x, HIP - 0.161, 0.1485), (x, ky - 0.154, 0.1375), 0.0286)

# ---------------------------------------------------------------- ARMS
for i, sx in enumerate((-1, 1)):
    ag, fg = 'arm%d' % i, 'fore%d' % i
    ax, ay = sx * 0.46, YOKE - 0.04
    hub_x(ag, ax - sx * 0.06, ax + sx * 0.05, 0.085, ay, 0, 'dark')
    store(nm('uarm'), bm_lathe([(0.06, ay - 0.03), (0.078, ay - 0.045), (0.078, ay - 0.07), (0.068, ay - 0.075), (0.062, ay - 0.3), (0.072, ay - 0.305), (0.072, ay - 0.325), (0.058, ay - 0.33)], 16, T(ax, 0, 0)), 'dark', ag, bevel=0.003, seg=1)
    store(nm('uplate'), bm_arcplate(0.07, 0.082, ay - 0.27, ay - 0.1, sx * PI / 2 - 0.7, sx * PI / 2 + 0.7, 8, 1.0, T(ax, 0, 0)), 'paint', ag, bevel=0.004, seg=2)
    for v in (ay - 0.12, ay - 0.25):
        bolt(ag, (ax + sx * 0.082, v, 0), (sx, 0, 0), r=0.006)
    tube(ag, [(ax, ay - 0.05, 0.07), (ax - sx * 0.01, ay - 0.18, 0.08), (ax, ay - 0.31, 0.07)], 0.008, 'rubber')
    boxo(ag, 0.04, 0.05, 0.04, T(ax, ay - 0.126, 0.085), 'dark', 0.005)
    fy = ay - ARM
    hub_x(fg, ax - 0.065, ax + 0.065, 0.07, fy, 0, 'dark')
    store(nm('farm'), bm_lathe([(0.05, fy - 0.03), (0.06, fy - 0.045), (0.056, fy - 0.3), (0.064, fy - 0.305), (0.064, fy - 0.32), (0.05, fy - 0.325)], 16, T(ax, 0, 0)), 'paint', fg, bevel=0.003, seg=1)
    boxo(fg, 0.035, 0.045, 0.035, T(ax, fy - 0.126, 0.07), 'dark', 0.005)
    tube(fg, [(ax + sx * 0.04, fy - 0.05, 0.04), (ax + sx * 0.055, fy - 0.18, 0.05), (ax + sx * 0.04, fy - 0.31, 0.04)], 0.007, 'wire_y')
    # the claw: wrist, palm, three two-part fingers
    wy = fy - 0.34
    store(nm('wrist'), bm_lathe([(0.052, wy + 0.02), (0.052, wy - 0.015), (0.04, wy - 0.03)], 14, T(ax, 0, 0)), 'steel', fg, bevel=0.002, seg=1)
    for k in range(3):
        aa = k * 2.094 + (0.5 if sx > 0 else 0.5 + PI)
        base = Vector((ax + math.sin(aa) * 0.035, wy - 0.03, math.cos(aa) * 0.035))
        out_ = Vector((math.sin(aa), 0, math.cos(aa)))
        side = Vector((0, 1, 0)).cross(out_)
        F1 = T(*base) @ Matrix.Rotation(-0.35, 4, side) @ T(0, -0.045, 0) @ R('Y', aa)
        store(nm('fing'), bm_box(0.026, 0.09, 0.03, F1), 'steel', fg, bevel=0.005, seg=2)
        kn = F1 @ Vector((0, -0.05, 0))
        store(nm('knuck'), bm_cyl(0.015, 0.015, 0.036, 10, T(*kn) @ R('Y', aa) @ R('Z', PI / 2)), 'dark', fg, bevel=0.002, seg=1)
        F2 = T(*kn) @ Matrix.Rotation(0.45, 4, side) @ T(0, -0.05, 0) @ R('Y', aa)
        store(nm('tip'), bm_lathe([(0.004, -0.05), (0.013, 0.0), (0.014, 0.045)], 6, F2 @ S(1, 1, 0.8)), 'steel', fg, bevel=0.002, seg=1, sharp=50)
    ram('elbow%d' % i, ag, fg, (ax, ay - 0.126, 0.098), (ax, fy - 0.126, 0.078), 0.0196)

# ---------------------------------------------------------------- DENSITY (owner, Nov 16: "this sort of density"): fittings, labels' carriers, replacement plates, and the growth a machine
# collects standing dormant outdoors by day: weeds caught in the feet and joints, moss on every ledge, a creeper up the left side
def blade(grp, base, h, lean, turn, w=0.006):
    # one grass or weed blade: a thin three-sided stalk in three bends, tapering to a point
    secs = []
    for k in range(4):
        t = k / 3
        c = Vector(base) + Vector((math.sin(turn) * lean * t * t * h, h * t, math.cos(turn) * lean * t * t * h))
        ww = w * (1 - t * 0.92)
        # a flat blade, folded a little along its middle (a shallow V), facing across its lean
        ax = Vector((math.cos(turn), 0, -math.sin(turn)))
        fw = Vector((math.sin(turn), 0, math.cos(turn)))
        secs.append([tuple(c + ax * ww), tuple(c - fw * ww * 0.3), tuple(c - ax * ww)])
    return bm_loft(secs)


def tuft(grp, c, n, h, spread, dry=False):
    bms = [blade(grp, (c[0] + (random.random() - 0.5) * spread, c[1], c[2] + (random.random() - 0.5) * spread), h * (0.55 + 0.6 * random.random()), 0.25 + 0.5 * random.random(), random.random() * 6.28, 0.007 + 0.006 * random.random()) for k in range(n)]
    return store(nm('weed'), bm_join(bms), 'grassdry' if dry else 'plant', grp, sharp=80, wn=False)


def moss(grp, c, r, n=3, flat=0.4):
    r *= 1.35
    n += 1
    bms = []
    for k in range(n):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        for v in bm.verts:
            v.co *= 0.8 + 0.4 * random.random()
        s_ = r * (0.5 + 0.6 * random.random())
        bmesh.ops.transform(bm, matrix=T(c[0] + (random.random() - 0.5) * r * 1.8, c[1] + s_ * flat * 0.3, c[2] + (random.random() - 0.5) * r * 1.8) @ S(s_, s_ * flat, s_), verts=bm.verts)
        bms.append(bm)
    return store(nm('moss'), bm_join(bms), 'moss', grp, sharp=80, wn=False)


for i, sx in enumerate((-1, 1)):
    kg, hg, x, ky = 'knee%d' % i, 'hip%d' % i, sx * HIPW, HIP - THIGH
    tuft(kg, (x - sx * 0.1, 0.03, -0.02), 7, 0.2, 0.07)
    tuft(kg, (x + sx * 0.11, 0.03, 0.1), 5, 0.15, 0.05, dry=True)
    tuft(kg, (x, 0.09, 0.06), 4, 0.1, 0.04)
    tuft(kg, (x + sx * 0.09, ky - 0.08, 0.0), 3, 0.08, 0.02, dry=True)
    moss(kg, (x + sx * 0.05, 0.09, -0.16), 0.03, 2)
    moss(kg, (x - sx * 0.07, 0.095, 0.08), 0.025, 2)
    # a louvred vent box on the outer side of each thigh
    vx = x + sx * 0.112
    boxo(hg, 0.012, 0.12, 0.1, T(vx, HIP - 0.17, 0), 'dark', 0.003)
    for k in range(4):
        boxo(hg, 0.01, 0.006, 0.09, T(vx + sx * 0.007, HIP - 0.215 + k * 0.03, 0) @ R('Z', sx * 0.5), 'steel', 0.0015, 1)
for i, sx in enumerate((-1, 1)):
    kg, ky = 'knee%d' % i, HIP - THIGH
    for yy in (ky - 0.15, ky - 0.28):
        store(nm('band'), bm_torus(0.094 + (ky - 0.08 - yy) * 0.03, 0.006, 20, 4, T(sx * HIPW, yy, 0)), 'steel', kg, wn=False)
    # louvred vents on the waist sides
    for z0 in (-0.1, 0.1):
        boxo('torso', 0.01, 0.1, 0.12, T(sx * 0.315, TY + 0.05, z0), 'dark', 0.003)
        for k in range(4):
            boxo('torso', 0.008, 0.006, 0.11, T(sx * 0.322, TY + 0.012 + k * 0.025, z0) @ R('Z', sx * 0.5), 'steel', 0.0015, 1)
tuft('pelvis', (-0.32, HIP + 0.075, 0.02), 5, 0.12, 0.03, dry=True)
tuft('pelvis', (0.0, HIP - 0.12, -0.12), 4, 0.1, 0.05)
# ledges of the waist casing outside the drum, the yoke top, the head top, the pack top: moss and weeds
for (cx, cz) in ((-0.27, -0.19), (0.27, -0.19), (-0.27, 0.19), (0.26, 0.17)):
    moss('torso', (cx, TY + 0.14, cz), 0.035, 3)
tuft('torso', (-0.28, TY + 0.14, -0.18), 6, 0.14, 0.03)
tuft('torso', (0.27, TY + 0.14, 0.18), 4, 0.12, 0.03, dry=True)
moss('torso', (-0.3, YOKE + 0.06, 0.1), 0.04, 3)
moss('torso', (0.2, YOKE + 0.06, -0.12), 0.03, 2)
tuft('torso', (-0.31, YOKE + 0.06, 0.11), 5, 0.12, 0.03)
moss('torso', (-0.08, TY + 0.59, PZ + 0.02), 0.035, 3)
moss('head', (-0.12, hc + HH / 2 - 0.004, hz0 + 0.06), 0.035, 3, 0.35)
tuft('head', (-0.14, hc + HH / 2 - 0.004, hz0 + 0.07), 4, 0.1, 0.02, dry=True)
# a creeper up the left side of the drum, over the band and onto the yoke, with leaves
pts = []
for k in range(9):
    t = k / 8
    y = BY0 + 0.02 + (BY1 - BY0 - 0.02) * t
    aa = PI + 0.95 + 0.35 * t + 0.08 * math.sin(t * 9)
    rr = rdrum(y) + 0.02
    pts.append((math.sin(aa) * rr, y, math.cos(aa) * rr * ZS))
pts.append((-0.33, YOKE + 0.08, 0.05))
pts.append((-0.27, YOKE + 0.085, -0.05))
store('vine', bm_tube(pts, 0.006, 5, 4), 'plant', 'torso', sharp=80, wn=False)
leaves = []
for k in range(26):
    t = (k + 0.5) / 26
    q = int(t * (len(pts) - 1))
    p0, p1 = Vector(pts[q]), Vector(pts[min(q + 1, len(pts) - 1)])
    c = p0.lerp(p1, (t * (len(pts) - 1)) % 1)
    out_ = Vector((c.x, 0, c.z / ZS)).normalized() if c.y < YOKE else Vector((0, 1, 0))
    side = (1 if k % 2 else -1)
    M = T(*(c + out_ * 0.008)) @ aim_y(out_) @ R('Y', random.random() * 6.28) @ T(side * 0.025, 0, 0) @ R('Z', side * 0.3)
    leaves.append(bm_box(0.04 + 0.015 * random.random(), 0.002, 0.026, M))
store('leaves', bm_join(leaves), 'plant', 'torso', sharp=80, wn=False)
# a pressure gauge on the chest, two conduit pipes with clamps up the back left, a hatch on the waist, an amber beacon and an inspection tag on the yoke
ga = PI + 0.55
gy = TY + 0.47
gr = rdrum(gy) + 0.004
gn = Vector((math.sin(ga) * ZS, 0, math.cos(ga))).normalized()
GM = T(math.sin(ga) * gr, gy, math.cos(ga) * gr * ZS) @ aim_y(gn)
store('gauge', bm_lathe([(0.04, 0), (0.04, 0.02), (0.044, 0.024), (0.036, 0.026)], 16, GM), 'steel', 'torso', bevel=0.002, seg=1)
store('dial', bm_lathe([(0.035, 0.018), (0, 0.019)], 16, GM), 'dial', 'torso', wn=False)
store('needle', bm_box(0.003, 0.002, 0.028, GM @ T(0.004, 0.021, 0.008) @ R('Y', 0.6)), 'wire_r', 'torso', wn=False)
tube('torso', [(math.sin(ga) * (gr + 0.01), gy - 0.035, math.cos(ga) * (gr + 0.01) * ZS), (math.sin(ga - 0.1) * (gr + 0.03), gy - 0.12, math.cos(ga - 0.1) * (gr + 0.03) * ZS), (math.sin(ga - 0.15) * (gr + 0.01), BY0 + 0.03, math.cos(ga - 0.15) * (gr + 0.01) * ZS)], 0.005, 'steel', 6, 4)
for j, pa in enumerate((1.5 * PI + 0.25, 1.5 * PI + 0.38)):
    pp = []
    for k in range(5):
        y = BY0 + 0.01 + (BY1 - BY0 - 0.02) * k / 4
        rr = rdrum(y) + 0.028
        pp.append((math.sin(pa) * rr, y, math.cos(pa) * rr * ZS))
    tube('torso', pp, 0.011 - 0.003 * j, 'steel' if j else 'dark', 8, 3)
    for k in (1, 3):
        y = BY0 + 0.01 + (BY1 - BY0 - 0.02) * k / 4
        rr = rdrum(y) + 0.028
        nn = Vector((math.sin(pa) * ZS, 0, math.cos(pa))).normalized()
        boxo('torso', 0.03, 0.018, 0.03, T(math.sin(pa) * rr, y, math.cos(pa) * rr * ZS) @ R('Y', pa), 'steel', 0.002, 1)
boxo('torso', 0.15, 0.1, 0.01, T(0.19, TY + 0.05, -0.234), 'paint', 0.003)
for yy in (TY + 0.02, TY + 0.08):
    store(nm('hinge'), bm_cyl(0.006, 0.006, 0.025, 8, T(0.268, yy, -0.236)), 'steel', 'torso', wn=False)
tube('torso', [(0.13, TY + 0.03, -0.24), (0.13, TY + 0.03, -0.255), (0.13, TY + 0.07, -0.255), (0.13, TY + 0.07, -0.24)], 0.004, 'steel', 6, 3)
store('beacon_base', bm_lathe([(0.03, YOKE + 0.06), (0.03, YOKE + 0.075), (0.024, YOKE + 0.08)], 12, T(0.3, 0, 0.1)), 'dark', 'torso', bevel=0.002, seg=1)
store('beacon', bm_lathe([(0.022, YOKE + 0.08), (0.022, YOKE + 0.105), (0.016, YOKE + 0.118), (0, YOKE + 0.122)], 12, T(0.3, 0, 0.1)), 'amber', 'torso', wn=False)
for k in range(3):
    store(nm('cage'), bm_torus(0.024, 0.0018, 12, 4, T(0.3, YOKE + 0.087 + k * 0.012, 0.1)), 'steel', 'torso', wn=False)
tube('torso', [(0.27, YOKE + 0.1, 0.0), (0.275, YOKE + 0.06, -0.012), (0.28, YOKE + 0.0, -0.02)], 0.0012, 'steel', 4, 3)
boxo('torso', 0.045, 0.065, 0.002, T(0.282, YOKE - 0.035, -0.022) @ R('Z', 0.1), 'tag', 0.0, 1)

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'walker_v2.py')).read())
apply_all()
tot = 0
for ob in OBJS:
    tot += tris(ob)
print('objects', len(OBJS), 'triangles', tot)
by = {}
for ob in OBJS:
    by[ob['grp']] = by.get(ob['grp'], 0) + tris(ob)
print(sorted(by.items()))
bpy.context.scene['rams'] = repr(RAMS)
bpy.ops.wm.save_as_mainfile(filepath=out)
save_marks(out[:-6] + '_marks.json')
kinds = {}
for ob in OBJS:
    k = ob.name.split('_')[0] if ob.name.count('_') else ob.name
    kinds[k] = kinds.get(k, 0) + tris(ob)
print(sorted(kinds.items(), key=lambda q: -q[1])[:20])
