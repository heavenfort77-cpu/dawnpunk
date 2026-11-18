# The Hauler (freight loader FRT-02) as a desktop model, built in Blender headless. NOT boxy: a heavy barrel body of curved plates over a dark core,
# a domed roof deck with a curved cargo rail, curved shoulder cowls, a rounded head pod with a wide round-cornered screen and an amber beacon dome,
# thick tapered arms under curved guards with rams and ribbed hoses, two curved fork tines (one bent), short heavy legs with guards and rams,
# rounded pad feet with toe plates; a curved exhaust stack with a rain cap, a curved bumper bar, the belly plate torn off (leak stains under it).
# Usage: python3 tools/gloomglb/hauler_model.py <out.blend>
# Nodes and pivots as hauler() in src/gloomhi.js: pelvis (0, 0.72, 0), torso (0, 0.77, 0), head (0, 2.02, -0.05) on the torso (no neck node),
# hip0/knee0 (x < 0) at (+-0.36, 0.72 / 0.38, 0), arm0/fore0 at (+-0.6, 1.67 / 1.17, 0); the game turns the arms forward 0.15 at rest.
# Empty 'screen' at head + (0, 0, -0.16) (display 0.42 x 0.28).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from bl_lib import *
from organic_lib import *
import grime_lib as G
from grime_lib import save_marks

random.seed(41)
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hauler.blend'

PEL, TOR = 0.72, 0.77
HIPX, KNEEY, ARMX, ARMY, ELBY = 0.36, 0.38, 0.6, 1.67, 1.17
HD = (0, 2.02, -0.05)
group('pelvis', (0, PEL, 0))
group('torso', (0, TOR, 0), 'pelvis')
group('head', HD, 'torso')
for i, sx in enumerate((-1, 1)):
    group('hip%d' % i, (sx * HIPX, PEL, 0), 'pelvis')
    group('knee%d' % i, (sx * HIPX, KNEEY, 0), 'hip%d' % i)
    group('arm%d' % i, (sx * ARMX, ARMY, 0), 'torso')
    group('fore%d' % i, (sx * ARMX, ELBY, 0), 'arm%d' % i)
Z0 = HD[2] - 0.16
empty('screen', (0, HD[1], Z0), GROUPS['head'][0])
N = [0]


def nm(s):
    N[0] += 1
    return '%s_%03d' % (s, N[0])


def bolt(grp, p, n, r=0.009, cls='bolt'):
    M = T(*p) @ aim_y(n)
    return store(nm('bolt'), bm_lathe([(r, r * 0.2), (r, r * 0.75), (r * 0.65, r * 1.0), (0, r * 1.1)], 6, M, cap0=False, phase=random.random()), cls, grp, sharp=50, wn=False)


def hose(grp, pts, r, cls='rubber', sides=None):
    return store(nm('hose'), bm_sweep(pts, [r] * len(pts), sides or (6 if r < 0.012 else 9), 6, rib=(max(0.016, r * 2.2), 0.16)), cls, grp, sharp=80, wn=False)


def ball(grp, c, r, cls='dark', seg=18, rings=10):
    return store(nm('ball'), bm_ellipsoid(c, r, r, r, seg, rings), cls, grp, sharp=80)


def lamp(grp, c, n, r=0.04):
    M = T(*c) @ aim_y(n)
    store(nm('lamph'), bm_lathe([(r * 1.35, -0.03), (r * 1.4, -0.008), (r * 1.3, 0.004), (r * 1.0, 0.01), (r * 0.98, 0.002)], 18, M, cap0=True, cap1=False), 'dark', grp, bevel=0.002, seg=1)
    store(nm('lens'), bm_lathe([(r * 0.99, 0.002), (r * 0.8, 0.012), (r * 0.4, 0.017), (0, 0.018)], 18, M), 'lens', grp, sharp=60, wn=False)


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


# ---------------------------------------------------------------- BODY: a heavy barrel of curved plates, belly plate torn away
BY0, BY1 = TOR + 0.1, TOR + 1.0
ys = [BY0 + (BY1 - BY0) * t for t in (0, 0.1, 0.3, 0.55, 0.8, 0.93, 1.0)]
body = Shell(ys, W=[0.78, 0.93, 1.0, 1.01, 0.98, 0.9, 0.78], D=[0.56, 0.66, 0.7, 0.71, 0.69, 0.62, 0.52], Zc=[0.0, 0.0, 0.0, 0.0, 0.01, 0.02, 0.02], p=2.5)
store('core', body.solid(BY0 + 0.01, BY1 - 0.01, 10, 32, off=-0.035), 'core', 'torso', sharp=60)
GA = 0.02
yb = [BY0 + 0.005, BY0 + 0.3, BY0 + 0.315, BY0 + 0.62, BY0 + 0.635, BY1 - 0.005]
# lower band: the front belly plate is gone (ribs, wiring, a leaking pump); sides and back stay; middle band of four curved plates; upper band of two
for (a0, a1) in ((PI * 0.25 + GA, PI * 0.75 - GA), (-PI * 0.25 + GA, PI * 0.25 - GA), (PI * 1.25 + GA, PI * 1.75 - GA)):
    store(nm('belly'), body.panel(yb[0], yb[1], a0, a1, 0.016, -0.014, 5, 10), 'paint', 'torso', bevel=0.004, seg=1, sharp=40)
store(nm('bstub'), body.panel(yb[1] - 0.07, yb[1], PI * 0.75 + GA, PI * 1.25 - GA, 0.016, -0.014, 2, 10), 'paint', 'torso', bevel=0.003, seg=1, sharp=40)
for f in (0.25, 0.65):
    y = yb[0] + (yb[1] - yb[0]) * f
    store(nm('rib'), bm_sweep([body.pt(y, PI * 0.75 + (PI / 2) * j / 8, -0.03) for j in range(9)], [0.009] * 9, 6, 2), 'steel', 'torso', sharp=60, wn=False)
store('pump', bm_sweep([body.pt(yb[0] + 0.12, PI - 0.15, -0.06), body.pt(yb[0] + 0.12, PI + 0.15, -0.06)], [0.05, 0.05], 14, 2), 'dark', 'torso', sharp=50)
for j, (c_, a_) in enumerate((('wire_r', PI - 0.3), ('wire_y', PI - 0.05), ('rubber', PI + 0.25))):
    store(nm('wire'), bm_sweep([body.pt(yb[1] - 0.01, a_, -0.03), body.pt(yb[0] + 0.15, a_ + 0.1, -0.005), body.pt(yb[0] + 0.03, a_ - 0.05, -0.03)], [0.007] * 3, 6, 6), c_, 'torso', sharp=80, wn=False)
store(nm('wire'), bm_sweep([body.pt(yb[0] + 0.1, PI + 0.1, -0.01), body.pt(yb[0] + 0.02, PI + 0.15, 0.04), body.pt(yb[0] - 0.12, PI + 0.2, 0.06)], [0.008] * 3, 6, 6), 'rubber', 'torso', sharp=80, wn=False)
for k, ac in enumerate((PI, 1.5 * PI, 0.0, 0.5 * PI)):
    store(nm('plate'), body.panel(yb[2], yb[3], ac - PI / 4 + GA, ac + PI / 4 - GA, 0.018, -0.014, 6, 12), 'paint2' if k == 3 else 'paint', 'torso', bevel=0.004, seg=1, sharp=40)
for (a0, a1) in ((GA * 0.5, PI - GA * 0.5), (PI + GA * 0.5, 2 * PI - GA * 0.5)):
    store(nm('upper'), body.panel(yb[4], yb[5], a0, a1, 0.018, -0.014, 6, 16), 'paint', 'torso', bevel=0.004, seg=1, sharp=40)
# pressed ribs on the flank plates (the builder's ribbed sides), rivet rows along the seams
for sx in (-1, 1):
    ac = PI / 2 if sx > 0 else 1.5 * PI
    for k in range(4):
        a = ac - 0.4 + k * 0.27
        store(nm('frib'), bm_sweep([body.pt(yb[2] + 0.04 + (yb[3] - yb[2] - 0.08) * j / 4, a, 0.004) for j in range(5)], [0.009] * 5, 6, 2, ell=(1, 0.5)), 'paint2' if sx > 0 else 'paint', 'torso', sharp=50)
for y in (yb[1] - 0.016, yb[2] + 0.016, yb[3] - 0.016, yb[4] + 0.016):
    for k in range(16):
        a = 2 * PI * k / 16 + 0.1
        if y < yb[1] and abs(((a - PI) + PI) % (2 * PI) - PI) < PI / 4:
            continue
        bolt('torso', body.pt(y, a, 0.003), tuple(body.normal(y, a)), 0.008)
# a curved vent on the back, two headlamps in the front plate, a curved bumper bar on two brackets, the stencil plate area
for k in range(5):
    y = yb[2] + 0.09 + k * 0.03
    store(nm('louvre'), bm_sweep([body.pt(y, -0.5 + j / 8.0, 0.005) for j in range(9)], [0.005] * 9, 4, 2, ell=(1, 2.0)), 'steel', 'torso', sharp=60, wn=False)
for sx in (-1, 1):
    a = PI + sx * 0.55
    lamp('torso', body.pt(yb[2] + 0.06, a, 0.006), tuple(body.normal(yb[2] + 0.06, a)), 0.042)
bb = [(sx_ * 0.53, TOR + 0.16, -0.36 + 0.06 * (abs(sx_) / 0.53) ** 2) for sx_ in (-0.53, -0.3, 0.0, 0.3, 0.53)]
store('bumper', bm_sweep(bb, [0.028] * 5, 12, 5), 'steel', 'torso', sharp=60)
for sx in (-1, 1):
    store(nm('bbrk'), bm_sweep([(sx * 0.4, TOR + 0.16, -0.345), (sx * 0.38, TOR + 0.18, -0.29), (sx * 0.36, TOR + 0.2, -0.25)], [0.022, 0.02, 0.022], 10, 3, ell=(0.7, 1.4)), 'dark', 'torso', sharp=50)
# roof deck: a domed cap, a curved cargo rail on four posts, a curved exhaust stack with a rain cap
store('deck', bm_ellipsoid((0, BY1 - 0.01, 0.02), 0.39, 0.06, 0.26, 24, 6, y0=0.0, y1=1.0), 'dark', 'torso', sharp=40)
rail = []
for k in range(25):
    a = 2 * PI * k / 24
    q = superellipse(a, 3.0)
    rail.append((q[0] * 0.42, BY1 + 0.12, 0.02 + q[1] * 0.28))
store('rail', bm_sweep(rail, [0.012] * 25, 8, 2), 'steel', 'torso', sharp=60, wn=False)
for (px, pz) in ((-0.38, -0.2), (0.38, -0.2), (-0.38, 0.24), (0.38, 0.24)):
    store(nm('post'), bm_sweep([(px * 0.97, BY1 - 0.03, pz * 0.95), (px * 1.0, BY1 + 0.05, pz), (px * 1.0, BY1 + 0.12, pz)], [0.012] * 3, 8, 3), 'steel', 'torso', sharp=60, wn=False)
ex = [(0.36, BY1 - 0.02, 0.3), (0.4, BY1 + 0.1, 0.33), (0.42, BY1 + 0.3, 0.34), (0.42, BY1 + 0.5, 0.33)]
store('stack', bm_sweep(ex, [0.042, 0.04, 0.038, 0.038], 14, 5), 'dark', 'torso', sharp=50)
store('raincap', bm_ellipsoid((0.42, BY1 + 0.54, 0.33), 0.065, 0.025, 0.065, 16, 6, y0=-0.3, y1=1.0), 'steel', 'torso', sharp=50)
for k in range(3):
    store(nm('sband'), bm_torus(0.043, 0.006, 16, 4, T(0.4 + 0.01 * k, BY1 + 0.1 + k * 0.12, 0.33)), 'steel', 'torso', wn=False)
# shoulder cowls: domed shells over the arm bearings
for sx in (-1, 1):
    store(nm('scowl'), bm_ellipsoid((sx * (ARMX - 0.04), ARMY + 0.03, 0.0), 0.12, 0.12, 0.15, 20, 8, y0=-0.2, y1=1.0), 'paint', 'torso', sharp=40, bevel=0.003, seg=1)
# hoses: three heavy ribbed hoses from the back to the shoulders and the stack
for k in range(3):
    hose('torso', [(-0.3 + k * 0.3, BY1 - 0.08, 0.3), (-0.42 + k * 0.42, BY1 - 0.26, 0.4), (-0.5 + k * 0.5, BY0 + 0.5, 0.37)], 0.016, 'wire_r' if k == 1 else 'rubber')

# ---------------------------------------------------------------- PELVIS: a rounded cross-beam under the barrel, a gearbox dome
store('pel_bar', bm_sweep([(-0.5, PEL, 0), (0, PEL + 0.02, 0), (0.5, PEL, 0)], lambda u: 0.075 * (0.85 + 0.15 * math.sin(PI * u)), 18, 4, ell=(1, 1.3)), 'dark', 'pelvis', sharp=50)
store('gear', bm_ellipsoid((0, PEL + 0.04, 0.0), 0.2, 0.1, 0.17, 22, 8, y0=-0.5, y1=1.0), 'paint', 'pelvis', sharp=40, bevel=0.003, seg=1)

# ---------------------------------------------------------------- LEGS: short and heavy: hip ball, tapered thigh under a curved guard, knee ball and cap, shin with a leaf guard, rounded pad foot
for i, sx in enumerate((-1, 1)):
    hg, kg, x = 'hip%d' % i, 'knee%d' % i, sx * HIPX
    ball(hg, (x, PEL, 0), 0.11, 'dark')
    store(nm('hipcap'), bm_ellipsoid((x + sx * 0.09, PEL, 0), 0.04, 0.1, 0.1, 18, 8), 'steel', hg, sharp=50)
    store(nm('thigh'), bm_sweep([(x, PEL - 0.03, 0), (x + sx * 0.01, PEL - 0.17, -0.01), (x, KNEEY + 0.05, 0)], [0.1, 0.11, 0.085], 14, 4), 'dark', hg, sharp=50)
    th = Shell([PEL - 0.03, PEL - 0.13, PEL - 0.24, KNEEY + 0.05], W=[0.24, 0.29, 0.27, 0.2], D=[0.24, 0.29, 0.27, 0.2], Zc=[0.0, -0.01, -0.01, 0.0], p=2.2, X=[x, x + sx * 0.01, x + sx * 0.008, x])
    store(nm('tguard'), th.panel(PEL - 0.05, KNEEY + 0.06, (PI / 2 - 0.2) if sx > 0 else (PI - 0.9), (PI + 0.9) if sx > 0 else (1.5 * PI + 0.2), 0.014, 0.0, 7, 14, taper=0.45), 'paint', hg, bevel=0.004, seg=1, sharp=40)
    for v in (0.3, 0.7):
        y = PEL - 0.05 + (KNEEY + 0.06 - PEL + 0.05) * v
        bolt(hg, th.pt(y, PI, 0.014), tuple(th.normal(y, PI)), 0.008)
    hose(hg, [(x + sx * 0.11, PEL - 0.04, 0.05), (x + sx * 0.13, PEL - 0.18, 0.06), (x + sx * 0.1, KNEEY + 0.04, 0.05)], 0.013)
    ball(kg, (x, KNEEY, 0), 0.095, 'dark')
    store(nm('kcap'), bm_ellipsoid((x, KNEEY + 0.01, -0.06), 0.1, 0.09, 0.06, 18, 8, y0=-0.6, y1=1.0), 'paint2' if i == 0 else 'paint', kg, sharp=40, bevel=0.003, seg=1)
    store(nm('shin'), bm_sweep([(x, KNEEY - 0.03, 0), (x, KNEEY - 0.17, -0.01), (x, 0.12, 0)], [0.085, 0.08, 0.07], 14, 4), 'dark', kg, sharp=50)
    sh = Shell([KNEEY - 0.04, KNEEY - 0.15, 0.13], W=[0.21, 0.23, 0.19], D=[0.21, 0.23, 0.19], Zc=[0.0, -0.012, 0.0], p=2.2, X=[x, x, x])
    store(nm('sguard'), sh.panel(KNEEY - 0.05, 0.14, PI - 1.3, PI + 1.3, 0.012, 0.0, 6, 12, taper=0.4), 'paint', kg, bevel=0.003, seg=1, sharp=40)
    for bu in (-1, 1):
        bolt(kg, sh.pt(KNEEY - 0.12, PI + bu * 0.7, 0.012), tuple(sh.normal(KNEEY - 0.12, PI + bu * 0.7)), 0.007)
    hose(kg, [(x - sx * 0.07, KNEEY - 0.05, 0.07), (x - sx * 0.085, KNEEY - 0.18, 0.08), (x - sx * 0.07, 0.13, 0.07)], 0.011)
    # foot: a rounded pad (squashed dome) with three curved toe plates and a heel pad; rubber sole
    store(nm('pad'), bm_ellipsoid((x, 0.06, -0.04), 0.15, 0.07, 0.22, 22, 8, y0=-0.55, y1=1.0), 'paint', kg, sharp=40, bevel=0.003, seg=1)
    store(nm('sole'), bm_ellipsoid((x, 0.025, -0.04), 0.155, 0.025, 0.225, 22, 4, y0=-1.0, y1=0.2), 'rubber', kg, sharp=50)
    for t, ang in enumerate((-0.35, 0.0, 0.35)):
        d = Vector((math.sin(ang), 0, -math.cos(ang)))
        p0 = Vector((x, 0.07, -0.12)) + d * 0.04
        pts = [tuple(p0), tuple(p0 + d * 0.09 + Vector((0, -0.02, 0))), tuple(p0 + d * 0.15 + Vector((0, -0.05, 0)))]
        store(nm('toe'), bm_sweep(pts, [0.04, 0.034, 0.018], 10, 4, ell=(1.3, 0.6), up=(0, 1, 0)), 'steel', kg, sharp=50)
    store(nm('ankle'), bm_sweep([(x - 0.08, 0.12, 0.0), (x + 0.08, 0.12, 0.0)], [0.045, 0.045], 14, 2), 'steel', kg, sharp=50)
    ram('hip%d' % i, 'pelvis', hg, (x, PEL - 0.012, 0.216), (x, PEL - 0.17, 0.144), 0.036)
    ram('knee%d' % i, hg, kg, (x, PEL - 0.119, 0.162), (x, KNEEY - 0.126, 0.15), 0.031)

# ---------------------------------------------------------------- ARMS: shoulder ball, thick tapered upper arm under a guard, elbow ball, forearm with a guard, fork hand (one tine bent)
for i, sx in enumerate((-1, 1)):
    ag, fg, ax = 'arm%d' % i, 'fore%d' % i, sx * ARMX
    ball(ag, (ax, ARMY, 0), 0.1, 'dark')
    store(nm('uarm'), bm_sweep([(ax, ARMY - 0.04, 0), (ax + sx * 0.015, ARMY - 0.25, 0.01), (ax, ELBY + 0.05, 0)], [0.075, 0.082, 0.065], 14, 4, ell=(1, 1.1)), 'dark', ag, sharp=50)
    ua = Shell([ARMY - 0.06, ARMY - 0.2, ARMY - 0.36, ELBY + 0.08], W=[0.16, 0.2, 0.19, 0.14], D=[0.16, 0.2, 0.19, 0.14], Zc=[0.0, 0.01, 0.01, 0.0], p=2.1, X=[ax, ax + sx * 0.016, ax + sx * 0.012, ax])
    store(nm('uguard'), ua.panel(ARMY - 0.08, ELBY + 0.09, sx * PI / 2 - 1.3, sx * PI / 2 + 1.3, 0.012, 0.0, 7, 12, taper=0.55), 'paint', ag, bevel=0.003, seg=1, sharp=40)
    hose(ag, [(ax - sx * 0.04, ARMY - 0.06, 0.08), (ax - sx * 0.05, ARMY - 0.25, 0.1), (ax - sx * 0.04, ELBY + 0.06, 0.08)], 0.012)
    ball(fg, (ax, ELBY, 0), 0.08, 'dark')
    store(nm('farm'), bm_sweep([(ax, ELBY - 0.03, 0), (ax, ELBY - 0.2, -0.01), (ax, ELBY - 0.38, 0)], [0.065, 0.07, 0.055], 14, 4), 'dark', fg, sharp=50)
    fa = Shell([ELBY - 0.04, ELBY - 0.15, ELBY - 0.28, ELBY - 0.38], W=[0.14, 0.175, 0.165, 0.12], D=[0.14, 0.175, 0.165, 0.12], Zc=[0.0, -0.012, -0.01, 0.0], p=2.1, X=[ax, ax, ax, ax])
    store(nm('fguard'), fa.panel(ELBY - 0.05, ELBY - 0.37, PI - 1.4, PI + 1.4, 0.011, 0.0, 7, 12, taper=0.5), 'paint', fg, bevel=0.003, seg=1, sharp=40)
    # fork: a curved backplate, two curved tapered tines pointing forward; on the left arm the inner tine is bent down
    hy = ELBY - 0.44
    store(nm('wrist'), bm_lathe([(0.06, hy + 0.07), (0.066, hy + 0.055), (0.066, hy + 0.03), (0.055, hy + 0.02)], 16, T(ax, 0, 0)), 'steel', fg, bevel=0.002, seg=1)
    bp = [(ax - 0.11, hy + 0.03, 0.04), (ax, hy + 0.035, 0.06), (ax + 0.11, hy + 0.03, 0.04)]
    store(nm('back'), bm_sweep(bp, [0.035, 0.04, 0.035], 10, 4, ell=(0.5, 2.0)), 'steel', fg, sharp=50)
    for t_, tx in enumerate((-0.06, 0.06)):
        bent = (i == 0 and t_ == (1 if sx < 0 else 0))
        dz = -0.36
        pts = [(ax + tx, hy, 0.03), (ax + tx, hy - 0.01, -0.1), (ax + tx, hy - (0.07 if bent else 0.0), -0.25), (ax + tx * (1.4 if bent else 1.0), hy - (0.15 if bent else 0.005), dz)]
        store(nm('tine'), bm_sweep(pts, [0.03, 0.027, 0.02, 0.006], 8, 4, ell=(1.2, 0.55), up=(0, 1, 0)), 'steel', fg, sharp=50)
    for sx2 in (-0.08, 0.08):
        bolt(fg, (ax + sx2, hy + 0.06, -0.005), (0, 0, -1), 0.012)
    ram('elbow%d' % i, ag, fg, (ax, ARMY - 0.175, 0.126), (ax, ELBY - 0.147, 0.104), 0.025)

# ---------------------------------------------------------------- HEAD: a rounded pod with a wide round-cornered screen, a steel bezel, an amber beacon dome, a rear vent
hx0, hy0, hz0 = HD


def pod_ring(z, w, h, p=3.0, n=40):
    return [(hx0 + superellipse(2 * PI * k / n, p)[0] * w / 2, hy0 + superellipse(2 * PI * k / n, p)[1] * h / 2, z) for k in range(n)]


rings = [pod_ring(Z0 + 0.03, 0.43, 0.29), pod_ring(Z0 - 0.002, 0.44, 0.3), pod_ring(Z0 - 0.02, 0.47, 0.33), pod_ring(Z0 - 0.024, 0.52, 0.37, 2.8),
         pod_ring(Z0 - 0.01, 0.55, 0.39, 2.7), pod_ring(Z0 + 0.1, 0.56, 0.4, 2.6), pod_ring(Z0 + 0.24, 0.52, 0.36, 2.5), pod_ring(Z0 + 0.31, 0.4, 0.27, 2.4), pod_ring(Z0 + 0.34, 0.22, 0.16, 2.3)]
store('pod', bm_loft(rings), 'paint', 'head', sharp=35, bevel=0.003, seg=1)
store('well', bm_box(0.45, 0.31, 0.006, T(hx0, hy0, Z0 + 0.028)), 'core', 'head')
bz = pod_ring(Z0 - 0.022, 0.455, 0.315, 3.0, 40)
store('bezel', bm_sweep(bz + bz[:3], [0.009] * 43, 8, 1), 'steel', 'head', sharp=60, wn=False)
for k in range(8):
    a = 2 * PI * k / 8 + PI / 8
    q = superellipse(a, 3.0)
    bolt('head', (hx0 + q[0] * 0.25, hy0 + q[1] * 0.177, Z0 - 0.022), (0, 0, -1), 0.007)
store('brow', bm_sweep([(hx0 - 0.25, hy0 + 0.19, Z0 - 0.01), (hx0, hy0 + 0.205, Z0 - 0.04), (hx0 + 0.25, hy0 + 0.19, Z0 - 0.01)], [0.01, 0.016, 0.01], 10, 6, ell=(2.2, 0.6), up=(0, 1, 0)), 'paint', 'head', sharp=50)
store('bbase', bm_lathe([(0.05, 0.0), (0.05, 0.015), (0.04, 0.025)], 16, T(hx0 + 0.15, hy0 + 0.195, hz0 + 0.05)), 'dark', 'head', bevel=0.002, seg=1)
store('beacon', bm_ellipsoid((hx0 + 0.15, hy0 + 0.22, hz0 + 0.05), 0.036, 0.045, 0.036, 16, 8, y0=0.0, y1=1.0), 'lens', 'head', sharp=60, wn=False)
for k in range(3):
    store(nm('bcage'), bm_torus(0.038, 0.003, 14, 4, T(hx0 + 0.15, hy0 + 0.23 + k * 0.013, hz0 + 0.05)), 'steel', 'head', wn=False)
for k in range(4):
    z = Z0 + 0.2 + k * 0.03
    store(nm('hrib'), bm_sweep([(hx0 - 0.2, hy0 - 0.12, z), (hx0, hy0 - 0.14, z + 0.01), (hx0 + 0.2, hy0 - 0.12, z)], [0.005] * 3, 6, 4), 'dark', 'head', sharp=60, wn=False)
store('neckring', bm_torus(0.11, 0.025, 20, 8, T(hx0, hy0 - 0.21, hz0 + 0.04)), 'rubber', 'torso', sharp=60)
store('hplate', bm_box(0.004, 0.05, 0.1, T(hx0 - 0.28, hy0 - 0.06, hz0 + 0.0)), 'brass', 'head', bevel=0.0015, seg=1)

# ---------------------------------------------------------------- WEAR AND GROWTH (Walker v2 standard)
random.seed(97)
for i, sx in enumerate((-1, 1)):
    x, kg, hg = sx * HIPX, 'knee%d' % i, 'hip%d' % i
    sp = []
    for k in range(14):
        a = 2 * PI * k / 14 + random.uniform(-0.1, 0.1)
        sp.append(((x + math.sin(a) * 0.15, random.uniform(0.02, 0.06), -0.04 + math.cos(a) * 0.22), random.uniform(0.016, 0.026), (math.sin(a), 0.3, math.cos(a))))
    for k in range(5):
        sp.append(((x + random.uniform(-0.06, 0.06), random.uniform(0.13, 0.22), -0.09), random.uniform(0.01, 0.016), (0, 0, -1)))
    G.mud(kg, sp)
    G.leaves(kg, [(x + random.uniform(-0.1, 0.1), 0.115, random.uniform(-0.2, 0.08)) for k in range(5)], 0.06)
    G.moss(kg, [((x + sx * 0.08, KNEEY + 0.08, 0.04), 0.026)])
    G.tufts(kg, [((x - sx * 0.08, KNEEY + 0.05, 0.06), 4, 0.12, 0.03), ((x + sx * 0.12, 0.05, 0.1), 5, 0.14, 0.05)], dry=(i == 1))
    G.moss(hg, [((x + sx * 0.08, PEL + 0.09, 0.03), 0.03)])
    G.tufts(hg, [((x - sx * 0.07, PEL + 0.07, 0.06), 4, 0.12, 0.02)], dry=(i == 0))
    ag, fg, ax = 'arm%d' % i, 'fore%d' % i, sx * ARMX
    G.moss(ag, [((ax - sx * 0.02, ARMY + 0.13, 0.02), 0.03)])
    G.tufts(ag, [((ax - sx * 0.06, ARMY + 0.1, 0.05), 4, 0.12, 0.03)], dry=True)
    G.moss(fg, [((ax, ELBY + 0.07, 0.0), 0.022)])
    G.oil((x, PEL - 0.08, 0.05), 0.03, 0.4)
    G.oil((x, KNEEY - 0.05, 0.05), 0.028, 0.35)
    G.oil((x, PEL - 0.15, 0.17), 0.02, 0.3)
    G.oil((ax, ARMY - 0.08, 0.04), 0.025, 0.4)
    G.oil((ax, ELBY - 0.06, 0.03), 0.022, 0.3)
    G.dent((x + sx * 0.06, PEL - 0.16, -0.12), (sx * 0.4, 0, -1), 0.05, 0.009)
    G.dent((ax + sx * 0.08, ARMY - 0.2, 0.0), (sx, 0, 0), 0.045, 0.008)
G.moss('torso', [(body.pt(BY1 - 0.05, a, 0.01), 0.035) for a in (0.3 * PI, 0.9 * PI, 1.5 * PI)] + [(body.pt(yb[1] + 0.01, 1.3 * PI, 0.01), 0.025)])
G.tufts('torso', [(body.pt(yb[3] + 0.005, 1.7 * PI, 0.012), 5, 0.13, 0.03), (body.pt(yb[1] + 0.005, 0.4 * PI, 0.012), 4, 0.12, 0.03), (body.pt(yb[0] + 0.02, PI + 0.2, -0.02), 6, 0.15, 0.06)])
G.tufts('torso', [((0.0, BY1 + 0.03, 0.05), 6, 0.16, 0.12)], dry=True)
G.leaves('torso', [(random.uniform(-0.3, 0.3), BY1 + 0.04, random.uniform(-0.18, 0.2)) for k in range(7)], 0.06)
G.leaves('pelvis', [(random.uniform(-0.15, 0.15), PEL + 0.14, random.uniform(-0.1, 0.1)) for k in range(3)], 0.05)
G.moss('head', [((hx0 - 0.1, hy0 + 0.2, Z0 + 0.15), 0.03)])
G.leaves('head', [(hx0 + random.uniform(-0.15, 0.1), hy0 + 0.2, Z0 + random.uniform(0.08, 0.25)) for k in range(3)], 0.055)
G.dent(body.pt(yb[2] + 0.2, PI - 0.3), tuple(body.normal(yb[2] + 0.2, PI - 0.3)), 0.075, 0.012)
G.dent(body.pt(yb[2] + 0.12, 1.5 * PI + 0.2), tuple(body.normal(yb[2] + 0.12, 1.5 * PI + 0.2)), 0.07, 0.011)
G.dent(body.pt(yb[4] + 0.12, 0.3 * PI), tuple(body.normal(yb[4] + 0.12, 0.3 * PI)), 0.065, 0.01)
G.dent((hx0 + 0.27, hy0 + 0.04, Z0 + 0.15), (1, 0, 0), 0.05, 0.008)
G.oil(body.pt(yb[0] + 0.12, PI, -0.04), 0.06, 0.6)
G.oil(body.pt(yb[3] - 0.05, 0.0, 0.0), 0.03, 0.4)
G.soot((0.42, BY1 + 0.5, 0.33), 0.06, 0.2)
G.soot((0.38, BY1 + 0.05, 0.31), 0.05, 0.25)
G.soot(body.pt(yb[2] + 0.15, 0.0, 0.01), 0.07, 0.25)

apply_all()
tot = sum(tris(ob) for ob in OBJS)
print('objects', len(OBJS), 'triangles', tot)
bpy.context.scene['rams'] = repr(RAMS)
bpy.ops.wm.save_as_mainfile(filepath=out)
save_marks(out[:-6] + '_marks.json')
kinds = {}
for ob in OBJS:
    k = ob.name.split('_')[0]
    kinds[k] = kinds.get(k, 0) + tris(ob)
print(sorted(kinds.items(), key=lambda q: -q[1])[:18])
