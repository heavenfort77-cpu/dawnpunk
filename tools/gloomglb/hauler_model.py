# The Hauler (freight loader FRT-02) as a desktop model, built in Blender headless. NOT boxy, but heavy industrial (v2): a barrel body of curved plates at different
# offsets, two bolted straps round it, vertical ribs, a big bolted access hatch with hinges and a handle, the belly plate torn off (ribs, wiring, a leaking pump)
# above a LOW bumper; exposed clevis pin joints, tapered struts with flanges, bolted guard plates, big rams and ribbed hoses on arms and legs; heavy flat tread pads
# with steel toe plates; curved fork tines (one bent); a domed roof deck, a curved cargo rail, an exhaust stack, a rounded head pod with a wide screen and a beacon.
# Usage: python3 tools/gloomglb/hauler_model.py <out.blend>
# Nodes as hauler() in src/gloomhi.js (pivots 0.12 m higher, see below): pelvis (0, 0.84, 0), torso (0, 0.89, 0), head (0, 2.14, -0.05) on the torso (no neck node),
# hip0/knee0 (x < 0) at (+-0.36, 0.84 / 0.44, 0), arm0/fore0 at (+-0.6, 1.79 / 1.29, 0); the game turns the arms forward 0.15 at rest.
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

# v2 (coordinator, Nov 17: 'reads toy-like'): legs 17% longer, so every pivot above the knees sits 0.12 m higher than the builder's (the game's haulerGlb uses PEL 0.84)
PEL, TOR = 0.84, 0.89
HIPX, KNEEY, ARMX, ARMY, ELBY = 0.36, 0.44, 0.6, 1.79, 1.29
HD = (0, 2.14, -0.05)
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




def clevis(pg, cg, c, w, r, lug_len=0.12, down=True):
    # an exposed pin joint along x at c: two flat lugs with rounded ends on the parent side (pg) straddling a tongue on the child side (cg), a pin with nuts
    x, y, z = c
    s = 1 if down else -1
    for sx in (-1, 1):
        lx = x + sx * (w / 2 + 0.012)
        sec = [(lx - 0.012, y + s * lug_len, z - r * 0.9), (lx + 0.012, y + s * lug_len, z - r * 0.9), (lx + 0.012, y + s * lug_len, z + r * 0.9), (lx - 0.012, y + s * lug_len, z + r * 0.9)]
        sec2 = [(lx - 0.012, y, z - r), (lx + 0.012, y, z - r), (lx + 0.012, y, z + r), (lx - 0.012, y, z + r)]
        store(nm('lug'), bm_join([bm_loft([sec, sec2]), bm_sweep([(lx - 0.012, y, z), (lx + 0.012, y, z)], [r, r], 16, 2)]), 'dark', pg, bevel=0.003, seg=1, sharp=40)
    store(nm('tongue'), bm_join([bm_sweep([(x - w / 2, y, z), (x + w / 2, y, z)], [r * 0.92, r * 0.92], 16, 2),
                                bm_loft([[(x - w / 2, y - s * 0.02, z - r * 0.8), (x + w / 2, y - s * 0.02, z - r * 0.8), (x + w / 2, y - s * 0.02, z + r * 0.8), (x - w / 2, y - s * 0.02, z + r * 0.8)],
                                         [(x - w / 2, y - s * lug_len, z - r * 0.7), (x + w / 2, y - s * lug_len, z - r * 0.7), (x + w / 2, y - s * lug_len, z + r * 0.7), (x - w / 2, y - s * lug_len, z + r * 0.7)]])]), 'dark', cg, bevel=0.003, seg=1, sharp=40)
    store(nm('pin'), bm_sweep([(x - w / 2 - 0.04, y, z), (x + w / 2 + 0.04, y, z)], [r * 0.38, r * 0.38], 10, 2), 'steel', pg, sharp=50)
    for sx in (-1, 1):
        bolt(pg, (x + sx * (w / 2 + 0.042), y, z), (sx, 0, 0), r * 0.5)


def strut(grp, top, bot, r0, r1, cls='dark', front=-1):
    # a tapered structural strut: a flattened box-like section (rounded corners) with flanges front and back
    pts = [top, tuple((Vector(top) + Vector(bot)) / 2), bot]
    store(nm('strut'), bm_sweep(pts, [r0, (r0 + r1) / 2, r1], 8, 3, ell=(1.0, 0.75), up=(0, 0, 1)), cls, grp, sharp=40)
    for fz in (-1, 1):
        fl = [(p[0], p[1], p[2] + fz * r0 * 0.8 * (1 - 0.3 * k / 2)) for k, p in enumerate(pts)]
        store(nm('flange'), bm_sweep(fl, [r0 * 0.25, r0 * 0.22, r1 * 0.22], 4, 3, ell=(2.6, 0.5), up=(0, 0, 1)), 'steel', grp, sharp=40)


def guard(grp, top, bot, w, zf, th=0.012, bolts=3, cls='paint'):
    # a bolted guard plate in front of a strut: gently curved, flat ends, bolts down both edges
    x = top[0]
    secs = []
    for j in range(6):
        t = j / 5
        y = top[1] + (bot[1] - top[1]) * t
        ww = w * (1 - 0.25 * t)
        row = []
        for k in range(7):
            u = (k / 6 - 0.5)
            row.append((x + u * ww, y, zf + 0.03 * (u * 2) ** 2))
        back = [(p[0], p[1], p[2] + th) for p in reversed(row)]
        secs.append(row + back)
    store(nm('guard'), bm_loft(secs), cls, grp, bevel=0.003, seg=1, sharp=40)
    for k in range(bolts):
        t = (k + 0.5) / bolts
        y = top[1] + (bot[1] - top[1]) * t
        ww = w * (1 - 0.25 * t)
        for sx in (-1, 1):
            bolt(grp, (x + sx * ww * 0.4, y, zf + 0.03 * 0.64 - 0.004), (0, 0, -1), 0.008)


# ---------------------------------------------------------------- BODY: a heavy barrel of curved plates (offset, strapped, ribbed), a big bolted hatch, the belly plate torn away
BY0, BY1 = TOR + 0.1, TOR + 1.0
ys = [BY0 + (BY1 - BY0) * t for t in (0, 0.1, 0.3, 0.55, 0.8, 0.93, 1.0)]
body = Shell(ys, W=[0.78, 0.93, 1.0, 1.01, 0.98, 0.9, 0.78], D=[0.56, 0.66, 0.7, 0.71, 0.69, 0.62, 0.52], Zc=[0.0, 0.0, 0.0, 0.0, 0.01, 0.02, 0.02], p=2.6)
store('core', body.solid(BY0 + 0.01, BY1 - 0.01, 10, 32, off=-0.04), 'core', 'torso', sharp=60)
GA = 0.02
yb = [BY0 + 0.005, BY0 + 0.3, BY0 + 0.315, BY0 + 0.62, BY0 + 0.635, BY1 - 0.005]
# lower band: the front belly plate is gone (wide), sides and back stay, each plate a different thickness (offsets)
HOLE = (PI - 0.62, PI + 0.62)
for (a0, a1, th) in ((HOLE[1] + GA, 1.75 * PI - GA, 0.016), (1.75 * PI + GA, 2.25 * PI - GA, 0.03), (0.25 * PI + GA, HOLE[0] - GA, 0.022)):
    store(nm('belly'), body.panel(yb[0], yb[1], a0, a1, th, -0.014, 5, 10), 'paint', 'torso', bevel=0.004, seg=1, sharp=40)
store(nm('bstub'), body.panel(yb[1] - 0.06, yb[1], HOLE[0] + GA, HOLE[1] - GA, 0.016, -0.014, 2, 10), 'paint', 'torso', bevel=0.003, seg=1, sharp=40)
for f in (0.2, 0.5, 0.8):
    y = yb[0] + (yb[1] - yb[0]) * f
    store(nm('rib'), bm_sweep([body.pt(y, HOLE[0] + (HOLE[1] - HOLE[0]) * j / 8, -0.012) for j in range(9)], [0.012] * 9, 6, 2), 'steel', 'torso', sharp=60, wn=False)
for a_ in (HOLE[0] + 0.25, PI, HOLE[1] - 0.25):
    store(nm('vrib'), bm_sweep([body.pt(yb[0], a_, -0.012), body.pt(yb[1], a_, -0.012)], [0.01, 0.01], 6, 2), 'steel', 'torso', sharp=60, wn=False)
store('pump', bm_sweep([body.pt(yb[0] + 0.13, PI - 0.25, -0.03), body.pt(yb[0] + 0.13, PI + 0.25, -0.03)], [0.07, 0.07], 16, 2), 'brass', 'torso', sharp=50)
for sx in (-1, 1):
    store(nm('pcap'), bm_ellipsoid(body.pt(yb[0] + 0.13, PI + sx * 0.27, -0.03), 0.02, 0.075, 0.075, 14, 6), 'dark', 'torso', sharp=50)
store('ppipe', bm_sweep([body.pt(yb[0] + 0.13, PI + 0.1, 0.03), body.pt(yb[0] + 0.24, PI + 0.15, 0.0), body.pt(yb[1] - 0.02, PI + 0.3, -0.02)], [0.016] * 3, 8, 5), 'copper', 'torso', sharp=60, wn=False)
for j, (c_, a_) in enumerate((('wire_r', PI - 0.45), ('wire_y', PI - 0.15), ('wire_r', PI + 0.2), ('wire_y', PI + 0.45))):
    store(nm('wire'), bm_sweep([body.pt(yb[1] - 0.01, a_, -0.02), body.pt(yb[0] + 0.17, a_ + 0.1, 0.01), body.pt(yb[0] + 0.03, a_ - 0.05, -0.02)], [0.011] * 3, 6, 6), c_, 'torso', sharp=80, wn=False)
for k in range(3):
    store(nm('wire'), bm_sweep([body.pt(yb[0] + 0.08, PI - 0.2 + k * 0.2, 0.0), body.pt(yb[0] - 0.02, PI - 0.18 + k * 0.2, 0.05), body.pt(yb[0] - 0.14 - 0.04 * k, PI - 0.15 + k * 0.2, 0.07)], [0.009] * 3, 6, 6), ('rubber', 'wire_r', 'wire_y')[k], 'torso', sharp=80, wn=False)
# middle band: four plates of different thickness; the front one carries a big bolted access hatch with hinges and a handle
for k, (ac, th) in enumerate(((PI, 0.018), (1.5 * PI, 0.03), (0.0, 0.022), (0.5 * PI, 0.026))):
    store(nm('plate'), body.panel(yb[2], yb[3], ac - PI / 4 + GA, ac + PI / 4 - GA, th, -0.014, 6, 12), 'paint2' if k == 3 else 'paint', 'torso', bevel=0.004, seg=1, sharp=40)
HY0, HY1, HA = yb[2] + 0.05, yb[3] - 0.05, 0.5
store('hatch', body.panel(HY0, HY1, PI - HA, PI + HA, 0.016, 0.012, 5, 10), 'paint', 'torso', bevel=0.005, seg=1, sharp=40)
for k in range(10):
    t = k / 9
    for y in (HY0 + 0.018, HY1 - 0.018):
        a = PI - HA + 0.05 + (2 * HA - 0.1) * t
        bolt('torso', body.pt(y, a, 0.03), tuple(body.normal(y, a)), 0.008)
    if 0 < k < 9 and k % 3 == 0:
        for a in (PI - HA + 0.04, PI + HA - 0.04):
            y = HY0 + (HY1 - HY0) * t
            bolt('torso', body.pt(y, a, 0.03), tuple(body.normal(y, a)), 0.008)
for y in (HY0 + 0.05, HY1 - 0.05):
    store(nm('hinge'), bm_sweep([body.pt(y - 0.035, PI + HA + 0.03, 0.03), body.pt(y + 0.035, PI + HA + 0.03, 0.03)], [0.016, 0.016], 10, 2), 'steel', 'torso', sharp=50)
store('hhandle', bm_sweep([body.pt(HY0 + 0.08, PI - HA + 0.12, 0.03), body.pt((HY0 + HY1) / 2, PI - HA + 0.12, 0.07), body.pt(HY1 - 0.08, PI - HA + 0.12, 0.03)], [0.011] * 3, 8, 5), 'steel', 'torso', sharp=60, wn=False)
for (a0, a1) in ((GA * 0.5, PI - GA * 0.5), (PI + GA * 0.5, 2 * PI - GA * 0.5)):
    store(nm('upper'), body.panel(yb[4], yb[5], a0, a1, 0.02, -0.014, 6, 16), 'paint', 'torso', bevel=0.004, seg=1, sharp=40)
# reinforcing straps round the barrel at the band joints, bolted every 20 degrees; vertical ribs on the flank plates
for y in (yb[1] + 0.008, yb[3] + 0.008):
    loop = [body.pt(y, 2 * PI * k / 36, 0.03) for k in range(37)]
    store(nm('strap'), bm_sweep(loop, [0.022] * 37, 6, 1, ell=(0.45, 1.0)), 'steel', 'torso', sharp=40, wn=False)
    for k in range(18):
        a = 2 * PI * k / 18 + 0.1
        bolt('torso', body.pt(y, a, 0.04), tuple(body.normal(y, a)), 0.009)
for sx in (-1, 1):
    ac = PI / 2 if sx > 0 else 1.5 * PI
    for k in range(4):
        a = ac - 0.4 + k * 0.27
        store(nm('frib'), bm_sweep([body.pt(yb[2] + 0.03 + (yb[3] - yb[2] - 0.06) * j / 4, a, 0.03) for j in range(5)], [0.012] * 5, 4, 2, ell=(0.7, 1.4)), 'steel', 'torso', sharp=40)
# a curved vent on the back, two headlamps in the front plate, a curved bumper bar LOW (the belly opening shows above it)
for k in range(5):
    y = yb[2] + 0.09 + k * 0.03
    store(nm('louvre'), bm_sweep([body.pt(y, -0.5 + j / 8.0, 0.025) for j in range(9)], [0.005] * 9, 4, 2, ell=(1, 2.0)), 'steel', 'torso', sharp=60, wn=False)
for sx in (-1, 1):
    a = PI + sx * 0.66
    lamp('torso', body.pt(yb[2] + 0.06, a, 0.025), tuple(body.normal(yb[2] + 0.06, a)), 0.042)
bb = [(sx_ * 0.53, TOR + 0.03, -0.36 + 0.06 * (abs(sx_) / 0.53) ** 2) for sx_ in (-0.53, -0.3, 0.0, 0.3, 0.53)]
store('bumper', bm_sweep(bb, [0.028] * 5, 12, 5, ell=(1.0, 1.3)), 'steel', 'torso', sharp=60)
for sx in (-1, 1):
    store(nm('bbrk'), bm_sweep([(sx * 0.4, TOR + 0.03, -0.345), (sx * 0.38, TOR + 0.06, -0.29), (sx * 0.36, TOR + 0.1, -0.24)], [0.022, 0.02, 0.022], 8, 3, ell=(0.7, 1.4)), 'dark', 'torso', sharp=50)
# roof deck, cargo rail on posts, exhaust stack with rain cap
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
# shoulder housings: bolted bearing drums (no soft cowls)
for sx in (-1, 1):
    hub = bm_lathe([(0.11, -0.07), (0.125, -0.06), (0.125, 0.05), (0.1, 0.07), (0.05, 0.075), (0, 0.075)], 20, T(sx * (ARMX - 0.11), ARMY, 0.0) @ R('Z', -sx * PI / 2))
    store(nm('shub'), hub, 'paint', 'torso', sharp=40, bevel=0.003, seg=1)
    for k in range(8):
        a = k * PI / 4
        bolt('torso', (sx * (ARMX - 0.04), ARMY + math.sin(a) * 0.09, math.cos(a) * 0.09), (sx, 0, 0), 0.008)
for k in range(3):
    hose('torso', [(-0.3 + k * 0.3, BY1 - 0.08, 0.32), (-0.42 + k * 0.42, BY1 - 0.26, 0.42), (-0.5 + k * 0.5, BY0 + 0.5, 0.39)], 0.016, 'wire_r' if k == 1 else 'rubber')

# ---------------------------------------------------------------- PELVIS: a cross-beam with hip clevis lugs, a gearbox housing
store('pel_bar', bm_sweep([(-0.5, PEL, 0), (0, PEL + 0.02, 0), (0.5, PEL, 0)], [0.07, 0.075, 0.07], 8, 4, ell=(1.3, 1.0), up=(0, 0, 1)), 'dark', 'pelvis', sharp=40)
store('gear', bm_lathe([(0.17, -0.06), (0.19, -0.05), (0.19, 0.05), (0.15, 0.08), (0.08, 0.09), (0, 0.09)], 20, T(0, PEL + 0.05, 0.0)), 'paint', 'pelvis', sharp=40, bevel=0.003, seg=1)
for k in range(8):
    a = k * PI / 4
    bolt('pelvis', (math.sin(a) * 0.16, PEL + 0.12, math.cos(a) * 0.16), (0, 1, 0), 0.008)

# ---------------------------------------------------------------- LEGS: hip clevis, tapered strut thigh with a bolted guard and a big ram, knee clevis, strut shin with a guard, ankle pin, heavy flat tread pad with toe plates
for i, sx in enumerate((-1, 1)):
    hg, kg, x = 'hip%d' % i, 'knee%d' % i, sx * HIPX
    clevis('pelvis', hg, (x, PEL, 0), 0.1, 0.075, 0.1, down=False)
    strut(hg, (x, PEL - 0.08, 0), (x, KNEEY + 0.1, 0), 0.075, 0.06)
    guard(hg, (x, PEL - 0.1, 0), (x, KNEEY + 0.12, 0), 0.17, -0.085, bolts=3, cls='paint2' if i == 0 else 'paint')
    hose(hg, [(x + sx * 0.09, PEL - 0.06, 0.05), (x + sx * 0.1, PEL - 0.22, 0.06), (x + sx * 0.08, KNEEY + 0.08, 0.05)], 0.013)
    clevis(hg, kg, (x, KNEEY, 0), 0.09, 0.065, 0.1, down=True)
    strut(kg, (x, KNEEY - 0.08, 0), (x, 0.13, 0), 0.065, 0.055)
    guard(kg, (x, KNEEY - 0.09, 0), (x, 0.15, 0), 0.15, -0.075, bolts=3)
    hose(kg, [(x - sx * 0.08, KNEEY - 0.06, 0.06), (x - sx * 0.09, KNEEY - 0.22, 0.07), (x - sx * 0.07, 0.15, 0.06)], 0.011)
    store(nm('ankle'), bm_sweep([(x - 0.07, 0.1, 0.0), (x + 0.07, 0.1, 0.0)], [0.04, 0.04], 14, 2), 'steel', kg, sharp=50)
    for sx2 in (-1, 1):
        store(nm('alug'), bm_loft([[(x + sx2 * 0.055 - 0.01, 0.06, -0.05), (x + sx2 * 0.055 + 0.01, 0.06, -0.05), (x + sx2 * 0.055 + 0.01, 0.06, 0.05), (x + sx2 * 0.055 - 0.01, 0.06, 0.05)],
                                    [(x + sx2 * 0.055 - 0.01, 0.13, -0.035), (x + sx2 * 0.055 + 0.01, 0.13, -0.035), (x + sx2 * 0.055 + 0.01, 0.13, 0.035), (x + sx2 * 0.055 - 0.01, 0.13, 0.035)]]), 'dark', kg, bevel=0.003, seg=1, sharp=40)
    # the tread pad: a heavy flat slab with rounded corners, rubber tread bars under it, three steel toe plates curving down in front, a heel block
    pad = [[(x + px, y_, z - 0.04) for (px, z) in rrect(0.3, 0.46, 0.06, 3)] for y_ in (0.025, 0.065)]
    store(nm('pad'), bm_loft(pad), 'paint', kg, bevel=0.006, seg=1, sharp=40)
    store(nm('tread'), bm_join([bm_box(0.29, 0.022, 0.035, T(x, 0.012, -0.24 + k * 0.06)) for k in range(8)]), 'rubber', kg, sharp=40, wn=False)
    for t, tx in enumerate((-0.09, 0.0, 0.09)):
        store(nm('toe'), bm_sweep([(x + tx, 0.065, -0.2), (x + tx, 0.06, -0.27), (x + tx, 0.03, -0.31)], [0.04, 0.036, 0.03], 6, 3, ell=(1.0, 0.35), up=(0, 1, 0)), 'steel', kg, sharp=40)
        bolt(kg, (x + tx, 0.075, -0.21), (0, 1, 0), 0.008)
    store(nm('heel'), bm_box(0.22, 0.05, 0.06, T(x, 0.06, 0.16)), 'dark', kg, bevel=0.008, seg=1)
    ram('hip%d' % i, 'pelvis', hg, (x + sx * 0.0, PEL + 0.02, 0.16), (x, PEL - 0.24, 0.12), 0.04)
    ram('knee%d' % i, hg, kg, (x, PEL - 0.12, 0.13), (x, KNEEY - 0.16, 0.12), 0.034)

# ---------------------------------------------------------------- ARMS: shoulder pin, tapered strut with a bolted guard and a big ram, elbow clevis, forearm strut with a guard, fork hand (one tine bent)
for i, sx in enumerate((-1, 1)):
    ag, fg, ax = 'arm%d' % i, 'fore%d' % i, sx * ARMX
    store(nm('spin'), bm_sweep([(ax - 0.08, ARMY, 0), (ax + 0.08, ARMY, 0)], [0.07, 0.07], 16, 2), 'dark', ag, sharp=50)
    strut(ag, (ax, ARMY - 0.06, 0), (ax, ELBY + 0.1, 0), 0.07, 0.055)
    guard(ag, (ax + sx * 0.0, ARMY - 0.08, 0), (ax, ELBY + 0.12, 0), 0.15, -0.08, bolts=3)
    hose(ag, [(ax - sx * 0.07, ARMY - 0.06, 0.06), (ax - sx * 0.08, ARMY - 0.25, 0.08), (ax - sx * 0.06, ELBY + 0.06, 0.06)], 0.012)
    clevis(ag, fg, (ax, ELBY, 0), 0.085, 0.06, 0.1, down=True)
    strut(fg, (ax, ELBY - 0.08, 0), (ax, ELBY - 0.38, 0), 0.06, 0.05)
    guard(fg, (ax, ELBY - 0.09, 0), (ax, ELBY - 0.36, 0), 0.13, -0.07, bolts=2, cls='paint2' if i == 1 else 'paint')
    hy = ELBY - 0.44
    store(nm('wrist'), bm_lathe([(0.06, hy + 0.07), (0.066, hy + 0.055), (0.066, hy + 0.03), (0.055, hy + 0.02)], 12, T(ax, 0, 0)), 'steel', fg, bevel=0.002, seg=1)
    bp = [(ax - 0.11, hy + 0.03, 0.04), (ax, hy + 0.035, 0.06), (ax + 0.11, hy + 0.03, 0.04)]
    store(nm('back'), bm_sweep(bp, [0.035, 0.04, 0.035], 8, 4, ell=(0.5, 2.0)), 'steel', fg, sharp=50)
    for t_, tx in enumerate((-0.06, 0.06)):
        bent = (i == 0 and t_ == (1 if sx < 0 else 0))
        pts = [(ax + tx, hy, 0.03), (ax + tx, hy - 0.01, -0.1), (ax + tx, hy - (0.07 if bent else 0.0), -0.25), (ax + tx * (1.4 if bent else 1.0), hy - (0.15 if bent else 0.005), -0.36)]
        store(nm('tine'), bm_sweep(pts, [0.03, 0.027, 0.02, 0.006], 8, 4, ell=(1.2, 0.55), up=(0, 1, 0)), 'steel', fg, sharp=50)
    for sx2 in (-0.08, 0.08):
        bolt(fg, (ax + sx2, hy + 0.06, -0.005), (0, 0, -1), 0.012)
    ram('elbow%d' % i, ag, fg, (ax, ARMY - 0.12, 0.11), (ax, ELBY - 0.15, 0.1), 0.03)

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
    G.dent((x + sx * 0.03, PEL - 0.22, -0.086), (0, 0, -1), 0.05, 0.008, classes=("paint", "paint2"))
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
