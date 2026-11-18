# The Lurcher (inspection unit INSP-3) as a desktop model, built in Blender headless. NOT boxy (owner, Nov 16): a hunched bean-shaped body of curved panels,
# a rounded head pod with a round-cornered screen, tapered limbs under curved cowlings, reverse knees, bird-like three-toed feet, rake-hook hands, ribbed hoses.
# Usage: python3 tools/gloomglb/lurcher_model.py <out.blend>
# Same nodes and pivots as lurcher() in src/gloomhi.js, modelled at rest with the torso UPRIGHT (the game leans it: torso.rotation.x = -0.5, arms 0.6):
# pelvis (0, 0.92, 0), torso (0, 0.97, 0), neck (0, 1.57, -0.12), head (0, 1.91, -0.24), hip0/knee0 (x < 0) at (+-0.2, 0.92 / 0.50, 0),
# arm0/fore0 at (+-0.3, 1.47 / 0.97, 0). Rams ramc_* / ramr_* as in walker_model.py. Empty 'screen' at the display's centre (head z - 0.1).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from bl_lib import *
from organic_lib import *
import grime_lib as G
from grime_lib import save_marks

random.seed(23)
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lurcher.blend'

PEL, TOR = 0.92, 0.97
HIPX, KNEEY, ARMX, ARMY, ELBY, WRY = 0.2, 0.50, 0.3, 1.47, 0.97, 0.52
NK = (0, 1.57, -0.12)
HD = (0, 1.91, -0.24)
group('pelvis', (0, PEL, 0))
group('torso', (0, TOR, 0), 'pelvis')
group('neck', NK, 'torso')
group('head', HD, 'neck')
for i, sx in enumerate((-1, 1)):
    group('hip%d' % i, (sx * HIPX, PEL, 0), 'pelvis')
    group('knee%d' % i, (sx * HIPX, KNEEY, 0), 'hip%d' % i)
    group('arm%d' % i, (sx * ARMX, ARMY, 0), 'torso')
    group('fore%d' % i, (sx * ARMX, ELBY, 0), 'arm%d' % i)
SZ0 = HD[2] - 0.1
empty('screen', (0, HD[1], SZ0), GROUPS['head'][0])

N = [0]


def nm(s):
    N[0] += 1
    return '%s_%03d' % (s, N[0])


def bolt(grp, p, n, r=0.008, cls='bolt'):
    M = T(*p) @ aim_y(n)
    parts = [bm_lathe([(r, r * 0.2), (r, r * 0.7), (r * 0.6, r * 0.95), (0, r * 1.05)], 8, M, cap0=False, phase=random.random())]
    return store(nm('bolt'), bm_join(parts), cls, grp, sharp=50, wn=False)


def hose(grp, pts, r, cls='rubber', sides=None):
    # a ribbed hose: one rib every 2.2 radii
    return store(nm('hose'), bm_sweep(pts, [r] * len(pts), sides or (6 if r < 0.012 else 9), 6, rib=(max(0.016, r * 2.2), 0.16)), cls, grp, sharp=80, wn=False)


def pipe(grp, pts, r, cls='copper', sides=8):
    return store(nm('pipe'), bm_sweep(pts, [r] * len(pts), sides, 5), cls, grp, sharp=70, wn=False)


def ball(grp, c, r, cls='dark', seg=18, rings=10):
    return store(nm('ball'), bm_ellipsoid(c, r, r, r, seg, rings), cls, grp, sharp=80)


def lamp(grp, c, n, r=0.026):
    M = T(*c) @ aim_y(n)
    store(nm('lamph'), bm_lathe([(r * 1.35, -0.02), (r * 1.4, -0.006), (r * 1.3, 0.004), (r * 1.0, 0.008), (r * 0.98, 0.002)], 18, M, cap0=True, cap1=False), 'dark', grp, bevel=0.002, seg=1)
    store(nm('lens'), bm_lathe([(r * 0.99, 0.002), (r * 0.8, 0.009), (r * 0.4, 0.013), (0, 0.014)], 18, M), 'lens', grp, sharp=60, wn=False)


RAMS = []


def ram(tag, Pg, Cg, A, B, rc):
    A, B = Vector(A), Vector(B)
    d = (B - A)
    L = d.length
    Lc, Lr = round(L * 0.6, 3), round(L * 0.66, 3)
    FA = T(*A) @ aim_y(-d)
    cyl = bm_lathe([(rc * 1.0, -0.01), (rc * 1.0, -Lc * 0.92), (rc * 1.22, -Lc * 0.93), (rc * 1.22, -Lc), (rc * 0.55, -Lc - 0.004), (rc * 0.55, -Lc - 0.002)], 14, I4, cap0=False, cap1=True)
    cap = bm_lathe([(rc * 1.2, -0.03), (rc * 1.2, -0.012), (rc * 0.8, -0.004)], 14, I4)
    eye = bm_cyl(rc * 0.9, rc * 0.9, rc * 1.4, 10, R('Z', PI / 2))
    store('ramc_' + tag, bm_join([cyl, cap, eye]), 'dark', Pg, frame=FA, local=True)
    FB = T(*B) @ aim_y(d)
    rod = bm_lathe([(rc * 0.42, 0.0), (rc * 0.42, Lr)], 10, I4)
    eye2 = bm_cyl(rc * 0.8, rc * 0.8, rc * 1.3, 10, R('Z', PI / 2))
    store('ramr_' + tag, bm_join([rod, eye2]), 'chrome', Cg, frame=FB, local=True)
    RAMS.append((tag, Pg, Cg, tuple(A), tuple(B)))


# ---------------------------------------------------------------- BODY: a hunched bean of curved panels over a dark core
BY0, BY1 = TOR + 0.02, TOR + 0.66
ys = [BY0 + (BY1 - BY0) * t for t in (0, 0.12, 0.3, 0.5, 0.7, 0.86, 0.95, 1.0)]
body = Shell(ys, W=[0.26, 0.42, 0.5, 0.51, 0.48, 0.38, 0.25, 0.1], D=[0.22, 0.34, 0.4, 0.42, 0.42, 0.36, 0.26, 0.1], Zc=[0.0, 0.0, 0.02, 0.045, 0.07, 0.06, 0.03, 0.02], p=2.3)
core = store('core', body.solid(BY0 + 0.01, BY1 - 0.01, 12, 28, off=-0.03), 'core', 'torso', sharp=60)
GAPA = 0.025
yb = [BY0 + 0.005, BY0 + 0.2, BY0 + 0.21, BY0 + 0.47, BY0 + 0.48, BY1 - 0.005]
# lower band: the belly pan, front and back halves
for (a0, a1) in ((PI / 2 + GAPA, 1.5 * PI - GAPA), (-PI / 2 + GAPA, PI / 2 - GAPA)):
    store(nm('pan'), body.panel(yb[0], yb[1], a0, a1, 0.012, -0.012, 5, 14), 'paint', 'torso', bevel=0.004, seg=2, sharp=40)
# middle band: four curved plates (front, left, back, right); the right one is gone, showing ribs, wiring and a junction box
MID = {'front': (PI, 'paint'), 'left': (1.5 * PI, 'paint'), 'back': (0.0, 'paint')}
for k, (ac, cl_) in MID.items():
    store(nm('plate_' + k), body.panel(yb[2], yb[3], ac - PI / 4 + GAPA, ac + PI / 4 - GAPA, 0.013, -0.012, 6, 12), cl_, 'torso', bevel=0.004, seg=2, sharp=40)
# the gap: three frame hoops, a strut, wires, a box; a torn stub of the lost plate at its top edge
for f in (0.15, 0.5, 0.85):
    y = yb[2] + (yb[3] - yb[2]) * f
    store(nm('hoop'), bm_sweep([body.pt(y, PI / 4 + (PI / 2) * j / 8, -0.02) for j in range(9)], [0.006] * 9, 6, 2), 'steel', 'torso', sharp=60, wn=False)
store(nm('strut'), bm_sweep([body.pt(yb[2] - 0.01, PI / 2, -0.02), body.pt((yb[2] + yb[3]) / 2, PI / 2, -0.016), body.pt(yb[3] + 0.01, PI / 2, -0.02)], [0.008] * 3, 8, 3), 'steel', 'torso', sharp=60, wn=False)
for j, (c_, r_) in enumerate((('wire_r', 0.007), ('wire_y', 0.006), ('rubber', 0.008))):
    a = PI / 2 - 0.3 + 0.25 * j
    pts = [body.pt(yb[3] - 0.01, a, -0.02), body.pt(yb[2] + 0.13, a + 0.15, -0.0 + 0.004 * j), body.pt(yb[2] + 0.04, a - 0.1, -0.016)]
    store(nm('wire'), bm_sweep(pts, [r_] * 3, 6, 6), c_, 'torso', sharp=80, wn=False)
jb = body.pt(yb[2] + 0.12, PI / 2 + 0.25, -0.03)
store(nm('jbox'), bm_box(0.03, 0.07, 0.06, T(*jb)), 'dark', 'torso', bevel=0.005, seg=2)
store(nm('stub'), body.panel(yb[3] - 0.05, yb[3], PI / 4 + GAPA, PI / 2 - 0.05, 0.013, -0.012, 3, 6), 'paint', 'torso', bevel=0.003, seg=1, sharp=40)
# a loose wire hanging out of the gap
store(nm('wire'), bm_sweep([body.pt(yb[2] + 0.1, PI / 2, -0.01), body.pt(yb[2] + 0.02, PI / 2 + 0.05, 0.03), body.pt(yb[2] - 0.12, PI / 2 + 0.1, 0.045)], [0.006] * 3, 6, 6), 'wire_r', 'torso', sharp=80, wn=False)
# upper band: the shoulder cowling, one piece over the top (the neck comes out of its front), a replacement half in another council's paint
store('cowl_l', body.panel(yb[4], yb[5], PI + GAPA * 0.4, 2 * PI - GAPA * 0.4, 0.014, -0.012, 8, 16), 'paint', 'torso', bevel=0.004, seg=2, sharp=40)
store('cowl_r', body.panel(yb[4], yb[5], GAPA * 0.4, PI - GAPA * 0.4, 0.014, -0.012, 8, 16), 'paint2', 'torso', bevel=0.004, seg=2, sharp=40)
# rivets along every seam
for y in (yb[1] - 0.012, yb[2] + 0.012, yb[3] - 0.012, yb[4] + 0.012):
    for k in range(18):
        a = 2 * PI * k / 18 + 0.1
        if y < yb[3] and y > yb[2] and abs(a - PI / 2) < PI / 4:
            continue
        bolt('torso', body.pt(y, a, 0.002), tuple(body.normal(y, a)), 0.0055)
# a curved vent grille low on the front plate: oval dark well with curved louvres
for k in range(6):
    y = yb[2] + 0.05 + k * 0.022
    pts = [body.pt(y, PI - 0.42 + 0.84 * j / 8, 0.004) for j in range(9)]
    store(nm('louvre'), bm_sweep(pts, [0.0045] * 9, 6, 2, ell=(1, 2.2)), 'steel', 'torso', sharp=60, wn=False)
store(nm('ventwell'), body.panel(yb[2] + 0.035, yb[2] + 0.175, PI - 0.48, PI + 0.48, 0.003, 0.0, 4, 10), 'core', 'torso', sharp=50)
# a chest gauge (round, copper rim) high on the front plate, a pressure line to the gap
gp = Vector(body.pt(yb[3] - 0.07, PI + 0.42, 0.002))
gn = body.normal(yb[3] - 0.07, PI + 0.42)
GM = T(*gp) @ aim_y(gn)
store('gauge', bm_lathe([(0.034, 0), (0.034, 0.016), (0.038, 0.02), (0.03, 0.022)], 18, GM), 'copper', 'torso', bevel=0.002, seg=1)
store('dial', bm_lathe([(0.029, 0.015), (0, 0.016)], 18, GM), 'dial', 'torso', wn=False)
store('needle', bm_box(0.003, 0.002, 0.024, GM @ T(0.004, 0.018, 0.006) @ R('Y', 0.9)), 'wire_r', 'torso', wn=False)
# the dorsal fins: curved cooling fins down the back, one snapped off with its wires out
for k in range(6):
    y = yb[2] + 0.04 + k * 0.05
    a0, a1 = -0.55, 0.55
    p_out = 0.05 if k != 3 else 0.018
    secs = []
    for j in range(9):
        a = a0 + (a1 - a0) * j / 8
        o = Vector(body.pt(y, a, 0.0))
        nn = body.normal(y, a)
        h = p_out * math.sin(PI * j / 8) ** 0.6 + 0.004
        secs.append(o + nn * h)
    # a thin plate: the curve swept as a flat ribbon 6 mm thick
    sb = []
    for j in range(9):
        a = a0 + (a1 - a0) * j / 8
        o = Vector(body.pt(y, a, -0.005))
        sb.append(o)
    ring = [tuple(p + Vector((0, 0.003, 0))) for p in secs] + [tuple(p + Vector((0, 0.003, 0))) for p in reversed(sb)]
    ring2 = [tuple(p - Vector((0, 0.003, 0))) for p in secs] + [tuple(p - Vector((0, 0.003, 0))) for p in reversed(sb)]
    store(nm('fin'), bm_loft([ring2, ring]), 'steel' if k != 3 else 'dark', 'torso', bevel=0.0015, seg=1, sharp=40)
store(nm('wire'), bm_sweep([body.pt(yb[2] + 0.19, 0.1, 0.02), body.pt(yb[2] + 0.17, 0.25, 0.06), body.pt(yb[2] + 0.1, 0.3, 0.08)], [0.004] * 3, 6, 5), 'wire_y', 'torso', sharp=80, wn=False)
# the battery capsule on the lower back, two straps, a filler cap; ribbed hoses from it up to both shoulders
bc = (0, BY0 + 0.15, body.pt(BY0 + 0.15, 0.0)[2] + 0.07)
store('battery', bm_sweep([(-0.17, bc[1], bc[2]), (0, bc[1] + 0.01, bc[2] + 0.01), (0.17, bc[1], bc[2])], lambda u: 0.065 * (0.75 + 0.25 * math.sin(PI * u) ** 0.3), 18, 6), 'paint', 'torso', sharp=40, bevel=0.003, seg=1)
for sx in (-1, 1):
    store(nm('bcap'), bm_ellipsoid((sx * 0.172, bc[1], bc[2]), 0.012, 0.05, 0.05, 16, 6), 'dark', 'torso', sharp=60)
    store(nm('strap'), bm_sweep([(sx * 0.09, bc[1] + 0.07, bc[2] - 0.09), (sx * 0.09, bc[1] + 0.07, bc[2] + 0.03), (sx * 0.09, bc[1], bc[2] + 0.075), (sx * 0.09, bc[1] - 0.07, bc[2] + 0.03), (sx * 0.09, bc[1] - 0.07, bc[2] - 0.09)], [0.007] * 5, 6, 3, ell=(1, 2.5)), 'rubber', 'torso', sharp=60, wn=False)
    hose('torso', [(sx * 0.12, bc[1] + 0.05, bc[2] + 0.02), (sx * 0.2, bc[1] + 0.25, bc[2] + 0.02), (sx * 0.26, ARMY + 0.02, 0.17), (sx * 0.28, ARMY + 0.05, 0.08)], 0.014)
store('fcap', bm_lathe([(0.02, 0), (0.02, 0.012), (0.015, 0.018), (0.008, 0.022), (0, 0.024)], 12, T(0.05, bc[1] + 0.06, bc[2] + 0.02)), 'copper', 'torso', bevel=0.002, seg=1)
# shoulder sockets: domed cowls over the shoulder balls, copper pipes over the top to the neck collar
for i, sx in enumerate((-1, 1)):
    c = (sx * ARMX, ARMY, 0.0)
    store(nm('scowl'), bm_ellipsoid((sx * (ARMX - 0.02), ARMY + 0.02, 0.0), 0.085, 0.09, 0.1, 18, 8, y0=-0.15, y1=1.0), 'paint', 'torso', sharp=40, bevel=0.003, seg=1)
    pipe('torso', [(sx * 0.27, ARMY + 0.09, -0.05), (sx * 0.15, BY1 - 0.04, -0.06), (sx * 0.05, NK[1] + 0.02, NK[2] + 0.02)], 0.008)
# neck collar: a ring on the cowling where the neck comes out
store('collar', bm_torus(0.07, 0.014, 20, 8, T(*NK) @ R('X', -0.35)), 'dark', 'torso', sharp=60)

# ---------------------------------------------------------------- PELVIS: a rounded cross-capsule, a socket ball under the body
store('pel_bar', bm_sweep([(-0.27, PEL, 0), (0, PEL + 0.01, 0), (0.27, PEL, 0)], lambda u: 0.06 * (0.85 + 0.15 * math.sin(PI * u)), 18, 4), 'dark', 'pelvis', sharp=50)
ball('pelvis', (0, PEL + 0.04, 0), 0.085, 'dark', 20, 10)
store('pel_cowl', bm_ellipsoid((0, PEL + 0.02, -0.02), 0.2, 0.08, 0.12, 22, 8, y0=-0.2, y1=1.0), 'paint', 'pelvis', sharp=40, bevel=0.003, seg=1)
for sx in (-1, 1):
    hose('pelvis', [(sx * 0.06, PEL + 0.05, 0.08), (sx * 0.12, PEL + 0.02, 0.12), (sx * 0.18, PEL - 0.04, 0.09)], 0.011)

# ---------------------------------------------------------------- LEGS: reverse knees, tapered thighs under curved guards, slender shins, three-toed feet
for i, sx in enumerate((-1, 1)):
    hg, kg, x = 'hip%d' % i, 'knee%d' % i, sx * HIPX
    store(nm('hipcap'), bm_ellipsoid((x + sx * 0.05, PEL, 0), 0.03, 0.075, 0.075, 18, 8, y0=-1, y1=1), 'dark', hg, sharp=50)
    ball(hg, (x, PEL, 0), 0.07, 'dark')
    # thigh: an oval tube bulging like a muscle, then a guard shell over its front and outer side
    store(nm('thigh'), bm_sweep([(x, PEL - 0.02, 0), (x + sx * 0.012, PEL - 0.2, -0.01), (x, KNEEY + 0.04, 0)], [0.058, 0.066, 0.046], 14, 5, ell=(1.0, 1.15)), 'dark', hg, sharp=50)
    th = Shell([PEL - 0.04, PEL - 0.12, PEL - 0.24, KNEEY + 0.05], W=[0.15, 0.19, 0.17, 0.11], D=[0.16, 0.2, 0.18, 0.12], Zc=[0.0, -0.012, -0.012, 0.0], p=2.1, X=[x, x + sx * 0.014, x + sx * 0.01, x])
    store(nm('thighguard'), th.panel(PEL - 0.06, KNEEY + 0.07, (PI / 2 - 0.2) if sx > 0 else (PI - 0.9), (PI + 0.9) if sx > 0 else (1.5 * PI + 0.2), 0.011, 0.0, 8, 14, taper=0.55), 'paint2' if i == 0 else 'paint', hg, bevel=0.004, seg=2, sharp=40)
    for v in (0.3, 0.7):
        y = PEL - 0.06 + (KNEEY + 0.07 - PEL + 0.06) * v
        p = Vector(th.pt(y, PI, 0.011))
        bolt(hg, tuple(p), tuple(th.normal(y, PI)), 0.006)
    hose(hg, [(x + sx * 0.07, PEL - 0.03, 0.03), (x + sx * 0.085, PEL - 0.22, 0.04), (x + sx * 0.06, KNEEY + 0.04, 0.03)], 0.01)
    # knee: a ball in a domed cap at the back; shin: tapered, with a curved rear fairing and a hose down its front
    ball(kg, (x, KNEEY, 0), 0.058, 'dark')
    store(nm('kneecap'), bm_ellipsoid((x, KNEEY, 0.03), 0.064, 0.07, 0.06, 18, 8, y0=-1.0, y1=1.0), 'paint', kg, sharp=40, bevel=0.003, seg=1)
    store(nm('shin'), bm_sweep([(x, KNEEY - 0.02, 0), (x, KNEEY - 0.22, 0.012), (x, 0.1, 0)], [0.042, 0.038, 0.03], 14, 5), 'dark', kg, sharp=50)
    sh = Shell([KNEEY - 0.03, KNEEY - 0.13, KNEEY - 0.28, 0.12], W=[0.09, 0.115, 0.095, 0.07], D=[0.09, 0.12, 0.1, 0.07], Zc=[0.0, 0.016, 0.012, 0.0], p=2.1, X=[x, x, x, x])
    store(nm('shinfair'), sh.panel(KNEEY - 0.04, 0.13, -1.3, 1.3, 0.009, 0.0, 8, 12, taper=0.5), 'paint', kg, bevel=0.003, seg=1, sharp=40)
    hose(kg, [(x - sx * 0.03, KNEEY - 0.04, -0.045), (x - sx * 0.035, KNEEY - 0.22, -0.05), (x - sx * 0.025, 0.12, -0.04)], 0.008)
    ball(kg, (x, 0.085, 0), 0.04, 'steel', 14, 8)
    # foot: three forward toes (curved, tapering, flattened) with steel claw tips, a back spur, a rounded heel pad
    store(nm('heel'), bm_ellipsoid((x, 0.05, 0.02), 0.06, 0.045, 0.07, 16, 8, y0=-0.6, y1=1.0), 'dark', kg, sharp=50)
    for t, ang in enumerate((-0.42, 0.0, 0.42)):
        d = Vector((math.sin(ang) * 0.9, 0, -math.cos(ang)))
        p0 = Vector((x, 0.06, 0.0))
        pts = [p0, p0 + d * 0.08 + Vector((0, -0.01, 0)), p0 + d * 0.16 + Vector((0, -0.032, 0)), p0 + d * 0.22 + Vector((0, -0.04, 0))]
        store(nm('toe'), bm_sweep([tuple(q) for q in pts], [0.032, 0.03, 0.024, 0.014], 12, 4, ell=(1.25, 0.75), up=(0, 1, 0)), 'paint', kg, sharp=50)
        tip = [tuple(pts[-1] - d * 0.01), tuple(pts[-1] + d * 0.04 + Vector((0, -0.012, 0))), tuple(pts[-1] + d * 0.065 + Vector((0, -0.03, 0)))]
        store(nm('claw'), bm_sweep(tip, [0.015, 0.009, 0.002], 8, 4, ell=(1.2, 0.8), up=(0, 1, 0)), 'steel', kg, sharp=50)
        for v in (0.35, 0.7):
            q = pts[0].lerp(pts[-1], v)
            store(nm('toering'), bm_torus(0.028 - 0.008 * v, 0.004, 10, 4, T(*q) @ aim_y(d)), 'steel', kg, wn=False)
    spur = [(x, 0.06, 0.05), (x, 0.035, 0.11), (x, 0.012, 0.14)]
    store(nm('spur'), bm_sweep(spur, [0.024, 0.016, 0.006], 10, 4, ell=(1.1, 0.8), up=(0, 1, 0)), 'steel', kg, sharp=50)
    # rams in FRONT of the reverse joints (as the builder's lurcher, fwd = -1)
    ram('hip%d' % i, 'pelvis', hg, (x, PEL - 0.008, -0.12), (x, PEL - 0.2, -0.075), 0.024)
    ram('knee%d' % i, hg, kg, (x, PEL - 0.2, -0.08), (x, KNEEY - 0.16, -0.06), 0.02)

# ---------------------------------------------------------------- ARMS: shoulder ball, tapered upper arm, elbow ball, forearm under a curved guard, rake-hook hand
for i, sx in enumerate((-1, 1)):
    ag, fg, ax = 'arm%d' % i, 'fore%d' % i, sx * ARMX
    ball(ag, (ax, ARMY, 0), 0.06, 'dark')
    store(nm('uarm'), bm_sweep([(ax, ARMY - 0.03, 0), (ax + sx * 0.015, ARMY - 0.25, 0.01), (ax, ELBY + 0.04, 0)], [0.045, 0.05, 0.036], 14, 5, ell=(1, 1.1)), 'dark', ag, sharp=50)
    ua = Shell([ARMY - 0.05, ARMY - 0.17, ARMY - 0.3, ELBY + 0.08], W=[0.1, 0.135, 0.125, 0.09], D=[0.1, 0.135, 0.125, 0.09], Zc=[0.0, 0.01, 0.01, 0.0], p=2.1, X=[ax, ax + sx * 0.016, ax + sx * 0.012, ax])
    store(nm('uguard'), ua.panel(ARMY - 0.07, ELBY + 0.09, sx * PI / 2 - 1.3, sx * PI / 2 + 1.3, 0.009, 0.0, 8, 12, taper=0.6), 'paint', ag, bevel=0.003, seg=1, sharp=40)
    hose(ag, [(ax - sx * 0.02, ARMY - 0.05, 0.05), (ax - sx * 0.03, ARMY - 0.25, 0.06), (ax - sx * 0.02, ELBY + 0.05, 0.045)], 0.008)
    ball(fg, (ax, ELBY, 0), 0.048, 'dark')
    store(nm('farm'), bm_sweep([(ax, ELBY - 0.02, 0), (ax, ELBY - 0.2, -0.008), (ax, WRY + 0.03, 0)], [0.036, 0.04, 0.028], 14, 5), 'dark', fg, sharp=50)
    fa = Shell([ELBY - 0.03, ELBY - 0.13, ELBY - 0.26, WRY + 0.06], W=[0.085, 0.115, 0.105, 0.075], D=[0.085, 0.115, 0.105, 0.075], Zc=[0.0, -0.01, -0.008, 0.0], p=2.1, X=[ax, ax, ax, ax])
    store(nm('fguard'), fa.panel(ELBY - 0.04, WRY + 0.07, PI - 1.4, PI + 1.4, 0.008, 0.0, 8, 12, taper=0.6), 'paint', fg, bevel=0.003, seg=1, sharp=40)
    pipe(fg, [(ax + sx * 0.04, ELBY - 0.05, 0.02), (ax + sx * 0.05, ELBY - 0.25, 0.03), (ax + sx * 0.035, WRY + 0.04, 0.02)], 0.006)
    # wrist collar, a curved rake bar, four long tapering hooks curling forward
    store(nm('wrist'), bm_lathe([(0.04, WRY + 0.03), (0.044, WRY + 0.02), (0.044, WRY - 0.005), (0.036, WRY - 0.015)], 16, T(ax, 0, 0)), 'copper', fg, bevel=0.002, seg=1)
    store(nm('rake'), bm_sweep([(ax - 0.07, WRY - 0.02, -0.01), (ax, WRY - 0.035, -0.025), (ax + 0.07, WRY - 0.02, -0.01)], [0.012, 0.016, 0.012], 10, 4, ell=(1, 1.6)), 'steel', fg, sharp=50)
    for k in range(4):
        hx = ax - 0.06 + k * 0.04
        L = 0.17 + 0.03 * (1 - abs(k - 1.5) / 1.5)
        pts = [(hx, WRY - 0.03, -0.015), (hx, WRY - 0.03 - L * 0.5, -0.03), (hx, WRY - 0.03 - L * 0.85, -0.07), (hx, WRY - 0.03 - L * 0.9, -0.11)]
        store(nm('hook'), bm_sweep(pts, [0.009, 0.007, 0.005, 0.0015], 8, 4, ell=(0.8, 1.2)), 'steel', fg, sharp=50)
    ram('elbow%d' % i, ag, fg, (ax, ARMY - 0.13, 0.07), (ax, ELBY - 0.13, 0.055), 0.017)

# ---------------------------------------------------------------- NECK: a ribbed hose curving forward, two copper lines beside it
nk = [(0, NK[1] - 0.02, NK[2] + 0.01), (0, NK[1] + 0.1, NK[2] - 0.03), (0, HD[1] - 0.15, HD[2] + 0.02)]
store('neck_hose', bm_sweep(nk, [0.045, 0.042, 0.04], 16, 6, rib=(0.022, 0.12)), 'rubber', 'neck', sharp=80)
for sx in (-1, 1):
    pipe('neck', [(sx * 0.05, NK[1], NK[2] + 0.02), (sx * 0.06, NK[1] + 0.12, NK[2] - 0.02), (sx * 0.045, HD[1] - 0.14, HD[2] + 0.04)], 0.006)
store('neck_ring', bm_torus(0.05, 0.01, 18, 6, T(0, HD[1] - 0.14, HD[2] + 0.02)), 'copper', 'neck', wn=False)

# ---------------------------------------------------------------- HEAD: a rounded pod, the round-cornered screen deep in its front, a copper bezel, ear cans with lamps
hx0, hy0, hz0 = HD
Z0 = SZ0


def pod_ring(z, w, h, p=3.0, n=40):
    out_ = []
    for k in range(n):
        a = 2 * PI * k / n
        sx_, sy_ = superellipse(a, p)
        out_.append((hx0 + sx_ * w / 2, hy0 + sy_ * h / 2, z))
    return out_


rings = [pod_ring(Z0 + 0.03, 0.27, 0.2), pod_ring(Z0 - 0.002, 0.28, 0.21), pod_ring(Z0 - 0.022, 0.31, 0.24), pod_ring(Z0 - 0.026, 0.35, 0.275, 2.8), pod_ring(Z0 - 0.012, 0.38, 0.3, 2.7),
         pod_ring(Z0 + 0.06, 0.4, 0.31, 2.6), pod_ring(Z0 + 0.15, 0.38, 0.29, 2.5), pod_ring(Z0 + 0.22, 0.31, 0.24, 2.4), pod_ring(Z0 + 0.26, 0.18, 0.15, 2.3)]
store('pod', bm_loft(rings), 'paint', 'head', sharp=35, bevel=0.003, seg=1)
store('well', bm_box(0.3, 0.23, 0.006, T(hx0, hy0, Z0 + 0.028)), 'core', 'head')
# bezel: a copper rounded ring round the opening, screws in it
bz = pod_ring(Z0 - 0.024, 0.295, 0.225, 3.0, 40)
store('bezel', bm_sweep(bz + bz[:3], [0.008] * (len(bz) + 3), 8, 1), 'copper', 'head', sharp=60, wn=False)
for k in range(8):
    a = 2 * PI * k / 8 + PI / 8
    sx_, sy_ = superellipse(a, 3.0)
    bolt('head', (hx0 + sx_ * 0.17, hy0 + sy_ * 0.13, Z0 - 0.024), (0, 0, -1), 0.005)
# a visor lip over the top of the screen
store('visor', bm_sweep([(hx0 - 0.16, hy0 + 0.13, Z0 - 0.012), (hx0, hy0 + 0.148, Z0 - 0.035), (hx0 + 0.16, hy0 + 0.13, Z0 - 0.012)], [0.008, 0.013, 0.008], 10, 6, ell=(2.0, 0.65), up=(0, 1, 0)), 'paint', 'head', sharp=50)
# a seam round the pod where front and back shells meet
store('seam', bm_sweep(pod_ring(Z0 + 0.1, 0.402, 0.312, 2.55, 40) + pod_ring(Z0 + 0.1, 0.402, 0.312, 2.55, 40)[:3], [0.005] * 43, 6, 1), 'dark', 'head', sharp=60, wn=False)
for sx in (-1, 1):
    store(nm('ear'), bm_ellipsoid((hx0 + sx * 0.205, hy0 + 0.01, Z0 + 0.08), 0.03, 0.065, 0.065, 18, 8), 'dark', 'head', sharp=50)
    lamp('head', (hx0 + sx * 0.235, hy0 + 0.01, Z0 + 0.08), (sx, 0, 0), 0.03)
# a sensor whisker and a stub aerial; rear vent slots as raised curved ribs
store('aerial', bm_sweep([(hx0 - 0.1, hy0 + 0.15, Z0 + 0.14), (hx0 - 0.12, hy0 + 0.3, Z0 + 0.18), (hx0 - 0.15, hy0 + 0.42, Z0 + 0.26)], [0.005, 0.003, 0.002], 6, 5), 'steel', 'head', sharp=60, wn=False)
for k in range(5):
    z = Z0 + 0.17 + k * 0.016
    w = 0.33 - k * 0.03
    store(nm('rib'), bm_sweep([(hx0 - w / 2, hy0 - 0.05, z), (hx0, hy0 - 0.06, z + 0.01), (hx0 + w / 2, hy0 - 0.05, z)], [0.004] * 3, 6, 4), 'dark', 'head', sharp=60, wn=False)
store('hplate', bm_box(0.004, 0.04, 0.08, T(hx0 - 0.2, hy0 - 0.07, Z0 + 0.12)), 'brass', 'head', bevel=0.0015, seg=1)

# ---------------------------------------------------------------- WEAR AND GROWTH (owner: dense, layered, abandoned; same standard as Walker v2)
random.seed(91)
for i, sx in enumerate((-1, 1)):
    x, kg, hg = sx * HIPX, 'knee%d' % i, 'hip%d' % i
    sp = []
    for t, ang in enumerate((-0.42, 0.0, 0.42)):
        d = Vector((math.sin(ang) * 0.9, 0, -math.cos(ang)))
        for k in range(3):
            q = Vector((x, 0.035, 0.0)) + d * (0.06 + 0.06 * k) + Vector((random.uniform(-0.01, 0.01), 0, random.uniform(-0.01, 0.01)))
            sp.append((tuple(q), random.uniform(0.014, 0.024), (0, 1, 0)))
    for k in range(5):
        sp.append(((x + random.uniform(-0.05, 0.05), 0.04 + random.uniform(0, 0.03), 0.04 + random.uniform(-0.02, 0.04)), random.uniform(0.014, 0.022), (random.uniform(-1, 1), 0.5, 1)))
        sp.append(((x + random.uniform(-0.04, 0.04), random.uniform(0.12, 0.2), -0.03 + random.uniform(-0.01, 0.01)), random.uniform(0.008, 0.013), (0, 0, -1)))
    G.mud(kg, sp)
    G.leaves(kg, [(x + random.uniform(-0.12, 0.12), 0.06 + random.uniform(0, 0.01), random.uniform(-0.2, 0.05)) for k in range(5)], 0.055)
    G.moss(kg, [((x + sx * 0.05, KNEEY + 0.05, 0.03), 0.02), ((x, 0.12, 0.03), 0.016)])
    G.tufts(kg, [((x - sx * 0.03, KNEEY + 0.03, -0.04), 4, 0.1, 0.02), ((x, 0.07, 0.05), 5, 0.12, 0.04)], dry=(i == 1))
    G.moss(hg, [((x + sx * 0.06, PEL + 0.06, 0.02), 0.024)])
    G.tufts(hg, [((x + sx * 0.05, PEL + 0.04, 0.05), 4, 0.11, 0.02)], dry=(i == 0))
    ag, fg, ax = 'arm%d' % i, 'fore%d' % i, sx * ARMX
    G.moss(ag, [((ax, ARMY + 0.05, 0.02), 0.022)])
    G.tufts(ag, [((ax - sx * 0.03, ARMY + 0.04, 0.05), 3, 0.09, 0.02)], dry=True)
    G.moss(fg, [((ax, ELBY + 0.04, 0.0), 0.016)])
    G.oil((x, PEL - 0.06, 0.0), 0.024, 0.4)
    G.oil((x, KNEEY - 0.03, 0.03), 0.02, 0.35)
    G.oil((x, PEL - 0.2, -0.085), 0.016, 0.3)
    G.oil((ax, ARMY - 0.06, 0.0), 0.02, 0.35)
    G.oil((ax, ELBY - 0.04, 0.0), 0.016, 0.3)
    G.dent((x + sx * 0.04, PEL - 0.17, -0.09), (sx * 0.4, 0, -1), 0.045, 0.007, classes=('paint', 'paint2'))
# body: moss on the cowling's shoulders and in the open gap, weeds out of the seams, leaves caught on the battery and the pelvis cowl
G.moss('torso', [(body.pt(BY1 - 0.05, 1.3 * PI, 0.005), 0.03), (body.pt(BY1 - 0.08, 0.6 * PI, 0.005), 0.025), (body.pt(yb[3] - 0.02, PI / 2, -0.01), 0.022), (body.pt(yb[1] + 0.01, 1.2 * PI, 0.008), 0.02)])
G.tufts('torso', [(body.pt(yb[1] + 0.01, 1.35 * PI, 0.01), 5, 0.12, 0.03), (body.pt(yb[3] + 0.005, 1.65 * PI, 0.01), 4, 0.1, 0.02), (body.pt(yb[2] + 0.01, PI / 2, -0.015), 6, 0.13, 0.04)])
G.leaves('torso', [(random.uniform(-0.12, 0.12), bc[1] + 0.066, bc[2] + random.uniform(-0.02, 0.02)) for k in range(3)] + [tuple(Vector(body.pt(BY1 - 0.04, a, 0.008))) for a in (1.2 * PI, 1.7 * PI, 0.3 * PI)], 0.05)
G.leaves('pelvis', [(random.uniform(-0.15, 0.15), PEL + 0.1, random.uniform(-0.08, 0.04)) for k in range(3)], 0.045)
G.moss('head', [((hx0 + 0.08, hy0 + 0.15, Z0 + 0.12), 0.025)])
G.leaves('head', [(hx0 + random.uniform(-0.12, 0.12), hy0 + 0.152, Z0 + random.uniform(0.06, 0.18)) for k in range(3)], 0.05)
# dents: front plate, left plate, cowling, head pod's left cheek, battery
G.dent(body.pt(yb[2] + 0.14, PI - 0.2), tuple(body.normal(yb[2] + 0.14, PI - 0.2)), 0.06, 0.01)
G.dent(body.pt(yb[2] + 0.1, 1.5 * PI + 0.1), tuple(body.normal(yb[2] + 0.1, 1.5 * PI + 0.1)), 0.055, 0.009)
G.dent(body.pt(BY1 - 0.1, 1.15 * PI), tuple(body.normal(BY1 - 0.1, 1.15 * PI)), 0.05, 0.008, classes=('paint', 'paint2'))
G.dent((hx0 - 0.19, hy0 + 0.05, Z0 + 0.13), (-1, 0, 0), 0.05, 0.008)
# oil from the neck hose and the battery, soot from the snapped fin (it sparks) and the battery vents
G.oil((0, NK[1] - 0.01, NK[2] + 0.03), 0.03, 0.45)
G.oil((0.05, bc[1] + 0.06, bc[2] + 0.02), 0.025, 0.4)
G.soot(body.pt(yb[2] + 0.19, 0.0, 0.03), 0.05, 0.22)
G.soot((0, bc[1] - 0.02, bc[2] + 0.07), 0.05, 0.18)

apply_all()
tot = sum(tris(ob) for ob in OBJS)
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
    k = ob.name.split('_')[0]
    kinds[k] = kinds.get(k, 0) + tris(ob)
print(sorted(kinds.items(), key=lambda q: -q[1])[:20])
