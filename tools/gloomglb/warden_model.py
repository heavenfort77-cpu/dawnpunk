# The Warden (security unit SEC-1) as a desktop model, built in Blender headless. NOT boxy, industrial arms (v2): a rounded hull on two tracks (a continuous belt with grouser bars
# round a stadium path, road wheels, sprockets, curved mudguards), a wide boiler-like torso of riveted curved plates over a dark core (one plate gone),
# a curved ram frame in front, a rounded generator with fins and an exhaust stack behind, curved shoulder armour, a creeper up the front,
# a wide rounded head with two round-cornered screens (the right one dead), a light bar, aerials and a camera dome; thick tapered arms with guards, rams and hoses,
# curved pusher-plate hands.
# Usage: python3 tools/gloomglb/warden_model.py <out.blend>
# Nodes and pivots as warden() in src/gloomhi.js: base (0, 0, 0) (the tracks, which do not move), torso (0, 0.7, 0), head (0, 2.25, -0.02) on the torso,
# g1 / g2 at head +- 0.21 x (the live and the dead screen), arm0 / fore0 at (-0.68, 1.8 / 1.2, 0), arm1 / fore1 at (0.68, ...).
# Empties 'screen' (in g1) and 'screen2' (in g2) at z - 0.25 from them (display 0.34 x 0.27).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from bl_lib import *
from organic_lib import *
import grime_lib as G
from grime_lib import save_marks

random.seed(71)
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/warden.blend'

TOR = 0.7
HD = (0, TOR + 1.55, -0.02)
ARMX, ARMY, ELBY = 0.68, TOR + 1.1, TOR + 0.5
group('base', (0, 0, 0))
group('torso', (0, TOR, 0), 'base')
group('head', HD, 'torso')
group('g1', (HD[0] - 0.21, HD[1], HD[2]), 'head')
group('g2', (HD[0] + 0.21, HD[1], HD[2]), 'head')
for i, sx in enumerate((-1, 1)):
    group('arm%d' % i, (sx * ARMX, ARMY, 0), 'torso')
    group('fore%d' % i, (sx * ARMX, ELBY, 0), 'arm%d' % i)
Z0 = HD[2] - 0.25
empty('screen', (HD[0] - 0.21, HD[1], Z0), GROUPS['g1'][0])
empty('screen2', (HD[0] + 0.21, HD[1], Z0), GROUPS['g2'][0])
N = [0]


def nm(s):
    N[0] += 1
    return '%s_%03d' % (s, N[0])


def bolt(grp, p, n, r=0.009, cls='bolt'):
    M = T(*p) @ aim_y(n)
    return store(nm('bolt'), bm_lathe([(r, r * 0.2), (r, r * 0.75), (r * 0.65, r * 1.0), (0, r * 1.1)], 6, M, cap0=False, phase=random.random()), cls, grp, sharp=50, wn=False)


def hose(grp, pts, r, cls='rubber', sides=None):
    return store(nm('hose'), bm_sweep(pts, [r] * len(pts), sides or (6 if r < 0.012 else 9), 6, rib=(max(0.016, r * 2.2), 0.16)), cls, grp, sharp=80, wn=False)


def ball(grp, c, r, cls='dark', seg=18, rings=8):
    return store(nm('ball'), bm_ellipsoid(c, r, r, r, seg, rings), cls, grp, sharp=80)


def lamp(grp, c, n, r=0.05):
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




# ---------------------------------------------------------------- TRACKS (base): a belt round a stadium path, grouser bars, road wheels, sprockets, curved mudguards
Rt, Lt, cy = 0.21, 0.44, 0.24


def stad(s):
    # point and outward normal (y, z) at arc length s round the track path
    per = 4 * Lt + 2 * PI * Rt
    s = s % per
    if s < 2 * Lt:
        return (cy - Rt, -Lt + s), (-1, 0)
    s -= 2 * Lt
    if s < PI * Rt:
        a = s / Rt
        return (cy - Rt * math.cos(a), Lt + Rt * math.sin(a)), (-math.cos(a), math.sin(a))
    s -= PI * Rt
    if s < 2 * Lt:
        return (cy + Rt, Lt - s), (1, 0)
    a = (s - 2 * Lt) / Rt
    return (cy + Rt * math.cos(a), -Lt - Rt * math.sin(a)), (math.cos(a), -math.sin(a))


PER = 4 * Lt + 2 * PI * Rt
for sx in (-1, 1):
    x = sx * 0.55
    # the belt: a flat loop, 0.34 wide, 2.2 cm thick
    secs = []
    for k in range(64):
        (py, pz), (ny, nz) = stad(PER * k / 64)
        secs.append([(x - 0.17, py, pz), (x + 0.17, py, pz), (x + 0.17, py - ny * 0.022, pz - nz * 0.022), (x - 0.17, py - ny * 0.022, pz - nz * 0.022)])
    store(nm('belt'), bm_loft(secs, closed=True), 'rubber', 'base', sharp=40)
    gb = []
    for k in range(36):
        (py, pz), (ny, nz) = stad(PER * k / 36)
        rx = math.atan2(nz, ny)
        gb.append(bm_box(0.34, 0.016, 0.03, T(x, py + ny * 0.006, pz + nz * 0.006) @ R('X', rx)))
    store(nm('grouser'), bm_join(gb), 'steel', 'base', sharp=40, wn=False)
    for k in range(4):
        wz = -0.45 + k * 0.3
        M = T(x, cy, wz) @ R('Z', PI / 2)
        store(nm('wheel'), bm_lathe([(0.12, -0.15), (0.17, -0.14), (0.176, -0.12), (0.176, -0.03), (0.17, -0.02), (0.12, -0.01), (0.12, 0.01), (0.17, 0.02), (0.176, 0.03), (0.176, 0.12), (0.17, 0.14), (0.12, 0.15)], 18, M, closed=False), 'rubber', 'base', sharp=40)
        store(nm('rim'), bm_lathe([(0.12, -0.16), (0.12, 0.16), (0.06, 0.17), (0.045, 0.18), (0, 0.18)], 14, M), 'dark', 'base', sharp=50)
        if k in (0, 3):
            teeth = []
            for j in range(12):
                a = j * PI / 6
                teeth.append(bm_box(0.03, 0.03, 0.03, T(x + sx * 0.14, cy + math.cos(a) * 0.185, wz + math.sin(a) * 0.185) @ R('X', a)))
            store(nm('teeth'), bm_join(teeth), 'steel', 'base', sharp=40, wn=False)
    # curved mudguard over the track top with a rounded nose at each end, a side skirt below it
    mg = []
    for k in range(13):
        t = k / 12
        z = -0.72 + 1.44 * t
        y = 0.5 - 0.05 * (abs(z) / 0.72) ** 4
        mg.append((x, y, z))
    store(nm('guard'), bm_sweep(mg, [0.02] * 13, 8, 2, ell=(9.0, 0.55), up=(1, 0, 0)), 'paint', 'base', sharp=40)
    sk = Shell([0.34, 0.42, 0.48], W=[0.02, 0.02, 0.02], D=[1.24, 1.3, 1.3], Zc=[0.0, 0.0, 0.0], p=6.0, X=[sx * 0.735] * 3)
    store(nm('skirt'), bm_sweep([(sx * 0.737, 0.41, -0.62), (sx * 0.745, 0.41, 0.0), (sx * 0.737, 0.41, 0.62)], [0.07, 0.07, 0.07], 8, 4, ell=(0.12, 1.0), up=(1, 0, 0)), 'paint', 'base', sharp=40)
    for k in range(6):
        bolt('base', (sx * 0.752, 0.44, -0.5 + k * 0.2), (sx, 0, 0), 0.009)
# hull: a rounded tub between the tracks, two headlamps, a tow hook
hull = Shell([0.34, 0.42, 0.56, 0.66], W=[0.66, 0.74, 0.76, 0.7], D=[1.0, 1.1, 1.12, 1.04], Zc=[0.0] * 4, p=3.0)
store('hull_f', hull.panel(0.35, 0.655, PI / 2 + 0.02, 1.5 * PI - 0.02, 0.014, -0.012, 5, 14), 'paint', 'base', bevel=0.004, seg=1, sharp=40)
store('hull_b', hull.panel(0.35, 0.655, -PI / 2 + 0.02, PI / 2 - 0.02, 0.014, -0.012, 5, 14), 'paint', 'base', bevel=0.004, seg=1, sharp=40)
store('hull_top', bm_ellipsoid((0, 0.655, 0), 0.36, 0.03, 0.54, 22, 4, y0=-0.2, y1=1.0), 'dark', 'base', sharp=40)
for sx in (-0.25, 0.25):
    lamp('base', hull.pt(0.56, PI + sx * 2.4, 0.006), tuple(hull.normal(0.56, PI + sx * 2.4)), 0.04)

# ---------------------------------------------------------------- TORSO: a wide boiler of riveted curved plates over a dark core (front-left lower plate gone)
BY0, BY1 = TOR + 0.02, TOR + 1.22
ys = [BY0 + (BY1 - BY0) * t for t in (0, 0.1, 0.35, 0.65, 0.88, 0.97, 1.0)]
body = Shell(ys, W=[1.0, 1.12, 1.16, 1.16, 1.12, 1.0, 0.9], D=[0.66, 0.76, 0.8, 0.8, 0.76, 0.64, 0.56], Zc=[0.0] * 7, p=2.9)
store('core', body.solid(BY0 + 0.01, BY1 - 0.01, 10, 32, off=-0.03), 'core', 'torso', sharp=60)
GA = 0.018
yb = [BY0 + 0.005, BY0 + 0.4, BY0 + 0.415, BY0 + 0.82, BY0 + 0.835, BY1 - 0.005]
for band in range(3):
    y0, y1 = yb[band * 2], yb[band * 2 + 1]
    for k in range(6):
        a0, a1 = 2 * PI * k / 6 + GA, 2 * PI * (k + 1) / 6 - GA
        if band == 0 and k == 3:
            continue
        cls_ = 'paint2' if (band == 1 and k == 1) else 'paint'
        store(nm('plate'), body.panel(y0, y1, a0, a1, 0.016, -0.014, 6, 10), cls_, 'torso', bevel=0.004, seg=1, sharp=40)
# inside the gap (front-left low): frame ribs, wiring, a cracked boiler drum leaking (its glow comes from the game's light), a junction box
for f in (0.25, 0.7):
    y = yb[0] + (yb[1] - yb[0]) * f
    store(nm('rib'), bm_sweep([body.pt(y, PI + (PI / 3) * j / 6, -0.03) for j in range(7)], [0.01] * 7, 6, 2), 'steel', 'torso', sharp=60, wn=False)
for j, (c_, a_) in enumerate((('wire_r', PI + 0.3), ('wire_y', PI + 0.55), ('rubber', PI + 0.8))):
    store(nm('wire'), bm_sweep([body.pt(yb[1] - 0.01, a_, -0.03), body.pt(yb[0] + 0.2, a_ + 0.1, -0.005), body.pt(yb[0] + 0.03, a_ - 0.05, -0.03)], [0.008] * 3, 6, 6), c_, 'torso', sharp=80, wn=False)
store('jbox', bm_box(0.08, 0.12, 0.06, T(*body.pt(yb[0] + 0.2, PI + 0.55, -0.06))), 'dark', 'torso', bevel=0.006, seg=1)
for y in (yb[1] - 0.018, yb[2] + 0.018, yb[3] - 0.018, yb[4] + 0.018):
    for k in range(24):
        a = 2 * PI * k / 24 + 0.05
        if y < yb[1] and PI < a < PI + PI / 3:
            continue
        bolt('torso', body.pt(y, a, 0.003), tuple(body.normal(y, a)), 0.009)
# pressed ribs on the flanks and back
for k, ac in enumerate((0.5 * PI, 1.5 * PI, 0.0)):
    for j in range(3):
        a = ac - 0.3 + j * 0.3
        store(nm('frib'), bm_sweep([body.pt(yb[2] + 0.05 + (yb[3] - yb[2] - 0.1) * q / 4, a, 0.005) for q in range(5)], [0.012] * 5, 6, 2, ell=(1, 0.5)), 'paint', 'torso', sharp=50)
# the ram frame: three curved bars across the front on three curved uprights
for k in range(3):
    y = TOR + 0.12 + k * 0.16
    store(nm('rbar'), bm_sweep([(-0.6, y, -0.46), (-0.3, y, -0.53), (0.0, y, -0.55), (0.3, y, -0.53), (0.6, y, -0.46)], [0.028] * 5, 10, 4), 'steel', 'torso', sharp=50)
for sx in (-0.45, 0.0, 0.45):
    zz = -0.55 + 0.09 * (abs(sx) / 0.6) ** 2
    store(nm('rpost'), bm_sweep([(sx, TOR + 0.05, zz + 0.02), (sx, TOR + 0.28, zz - 0.01), (sx, TOR + 0.5, zz + 0.02)], [0.024] * 3, 8, 4, ell=(0.8, 1.2)), 'steel', 'torso', sharp=50)
    store(nm('rstay'), bm_sweep([(sx, TOR + 0.2, zz), (sx * 0.95, TOR + 0.2, zz + 0.12)], [0.02, 0.02], 8, 2), 'dark', 'torso', sharp=50)
# generator on the back: a rounded drum with cooling fins, an exhaust stack with a cap
gc = (0, TOR + 0.5, 0.46)
store('gen', bm_sweep([(-0.28, gc[1], gc[2]), (0, gc[1], gc[2] + 0.02), (0.28, gc[1], gc[2])], lambda u: 0.17 * (0.8 + 0.2 * math.sin(PI * u) ** 0.3), 20, 6), 'dark', 'torso', sharp=40)
for k in range(9):
    store(nm('gfin'), bm_torus(0.175, 0.006, 22, 4, T(-0.2 + k * 0.05, gc[1], gc[2] + 0.02) @ R('Z', PI / 2)), 'steel', 'torso', wn=False)
store('stack', bm_sweep([(0.42, TOR + 0.65, 0.46), (0.43, TOR + 1.0, 0.47), (0.42, TOR + 1.35, 0.46)], [0.045, 0.044, 0.042], 14, 4), 'dark', 'torso', sharp=50)
store('scap', bm_ellipsoid((0.42, TOR + 1.39, 0.46), 0.07, 0.025, 0.07, 16, 6, y0=-0.3, y1=1.0), 'steel', 'torso', sharp=50)
# shoulder armour: curved plates over the arm sockets
for sx in (-1, 1):
    store(nm('pauldron'), bm_ellipsoid((sx * (ARMX - 0.08), ARMY + 0.14, 0.0), 0.2, 0.08, 0.3, 22, 8, y0=-0.2, y1=1.0), 'paint', 'torso', sharp=40, bevel=0.004, seg=1)
    hose('torso', [(sx * 0.3, TOR + 1.0, 0.41), (sx * 0.5, TOR + 1.08, 0.3), (sx * 0.6, TOR + 1.12, 0.12)], 0.02)
    hose('torso', [(sx * 0.25, TOR + 0.95, 0.42), (sx * 0.45, TOR + 1.0, 0.36), (sx * 0.58, TOR + 1.05, 0.16)], 0.014, 'wire_r' if sx > 0 else 'rubber')
# a creeper climbing the front left plates, with leaves
vine = [body.pt(BY0 + 0.05 + 1.05 * t, PI + 0.6 - 0.5 * t + 0.08 * math.sin(t * 9), 0.02) for t in [k / 10 for k in range(11)]]
store('vine', bm_sweep(vine, [0.008] * 11, 5, 3), 'plant', 'torso', sharp=80, wn=False)
lv = []
for k in range(14):
    t = k / 13
    p = Vector(body.pt(BY0 + 0.05 + 1.05 * t, PI + 0.6 - 0.5 * t + 0.08 * math.sin(t * 9), 0.03))
    lv.append(bm_box(0.05, 0.002, 0.03, T(*p) @ R('Y', random.random() * 6.28) @ R('X', 0.8 + random.random() * 0.6)))
store('vleaves', bm_join(lv), 'plant', 'torso', sharp=80, wn=False)

# ---------------------------------------------------------------- HEAD: a wide rounded pod, two round-cornered screens in their wells, a light bar, aerials, a camera dome
hx0, hy0, hz0 = HD


def ring(z, w, h, p=2.8, n=40):
    return [(hx0 + superellipse(2 * PI * k / n, p)[0] * w / 2, hy0 + superellipse(2 * PI * k / n, p)[1] * h / 2, z) for k in range(n)]


rings = [ring(Z0 + 0.034, 0.86, 0.38, 3.2), ring(Z0 + 0.045, 0.9, 0.41, 3.0), ring(Z0 + 0.1, 0.92, 0.43, 2.8), ring(Z0 + 0.3, 0.88, 0.4, 2.7), ring(Z0 + 0.45, 0.74, 0.32, 2.5), ring(Z0 + 0.5, 0.5, 0.2, 2.3)]
store('pod', bm_loft(rings), 'paint', 'head', sharp=35, bevel=0.003, seg=1)
for gname, gx in (('g1', -0.21), ('g2', 0.21)):
    def sring(z, w, h, p=3.0, n=32):
        return [(gx + superellipse(2 * PI * k / n, p)[0] * w / 2, hy0 + superellipse(2 * PI * k / n, p)[1] * h / 2, z) for k in range(n)]
    store(nm('wellr'), bm_loft([sring(Z0 + 0.03, 0.35, 0.28), sring(Z0 - 0.002, 0.36, 0.29), sring(Z0 - 0.018, 0.38, 0.31), sring(Z0 - 0.024, 0.41, 0.34)], cap0=False, cap1=False), 'dark', gname, sharp=40)
    store(nm('well'), bm_box(0.36, 0.29, 0.006, T(gx, hy0, Z0 + 0.03)), 'core', gname)
    bz = sring(Z0 - 0.022, 0.375, 0.305, 3.0, 32)
    store(nm('bezel'), bm_sweep(bz + bz[:3], [0.008] * 35, 6, 1), 'steel', gname, sharp=60, wn=False)
store('lightbar', bm_sweep([(hx0 - 0.4, hy0 + 0.245, hz0 - 0.2), (hx0, hy0 + 0.25, hz0 - 0.22), (hx0 + 0.4, hy0 + 0.245, hz0 - 0.2)], [0.04, 0.042, 0.04], 12, 4, ell=(1.0, 0.9)), 'dark', 'head', sharp=50)
for k in range(5):
    store(nm('blens'), bm_ellipsoid((hx0 - 0.3 + k * 0.15, hy0 + 0.245, hz0 - 0.245), 0.06, 0.026, 0.016, 14, 6), 'lens', 'head', sharp=60, wn=False)
for sx in (-0.38, 0.38):
    store(nm('aer'), bm_sweep([(hx0 + sx, hy0 + 0.22, hz0 + 0.18), (hx0 + sx * 1.1, hy0 + 0.45, hz0 + 0.2), (hx0 + sx * 1.3, hy0 + 0.7, hz0 + 0.18)], [0.006, 0.004, 0.0025], 6, 5), 'steel', 'head', sharp=60, wn=False)
    store(nm('aerb'), bm_ellipsoid((hx0 + sx, hy0 + 0.215, hz0 + 0.18), 0.02, 0.016, 0.02, 12, 6, y0=-0.2, y1=1.0), 'dark', 'head', sharp=60)
store('cam', bm_ellipsoid((hx0, hy0 - 0.22, hz0 - 0.16), 0.06, 0.048, 0.06, 16, 8, y0=-1.0, y1=0.2), 'core', 'head', sharp=60)
store('camring', bm_torus(0.062, 0.008, 16, 4, T(hx0, hy0 - 0.21, hz0 - 0.16)), 'steel', 'head', wn=False)
store('neck', bm_sweep([(0, TOR + 1.2, -0.02), (0, hy0 - 0.19, -0.02)], [0.14, 0.12], 16, 4, rib=(0.03, 0.12)), 'rubber', 'torso', sharp=80)
for k in range(5):
    z = Z0 + 0.3 + k * 0.035
    store(nm('hrib'), bm_sweep([(hx0 - 0.36, hy0 - 0.17, z), (hx0, hy0 - 0.2, z + 0.01), (hx0 + 0.36, hy0 - 0.17, z)], [0.005] * 3, 6, 4), 'dark', 'head', sharp=60, wn=False)
store('hplate', bm_box(0.004, 0.05, 0.1, T(hx0 - 0.462, hy0 - 0.05, hz0 + 0.05)), 'brass', 'head', bevel=0.0015, seg=1)

# ---------------------------------------------------------------- ARMS (v2, industrial): a bolted shoulder bearing drum and pin, a tapered strut with flanges, a bolted guard and a big ram,
# an elbow clevis, a forearm strut with a guard, a curved pusher plate
for i, sx in enumerate((-1, 1)):
    ag, fg, ax = 'arm%d' % i, 'fore%d' % i, sx * ARMX
    store(nm('sdrum'), bm_lathe([(0.13, -0.08), (0.15, -0.07), (0.15, 0.06), (0.12, 0.08), (0.06, 0.085), (0, 0.085)], 20, T(sx * (ARMX - 0.12), ARMY, 0.0) @ R('Z', -sx * PI / 2)), 'paint', 'torso', sharp=40, bevel=0.003, seg=1)
    for k in range(8):
        a = k * PI / 4
        bolt('torso', (sx * (ARMX - 0.035), ARMY + math.sin(a) * 0.11, math.cos(a) * 0.11), (sx, 0, 0), 0.01)
    store(nm('spin'), bm_sweep([(ax - 0.09, ARMY, 0), (ax + 0.09, ARMY, 0)], [0.085, 0.085], 16, 2), 'dark', ag, sharp=50)
    strut(ag, (ax, ARMY - 0.07, 0), (ax, ELBY + 0.11, 0), 0.09, 0.072)
    guard(ag, (ax, ARMY - 0.09, 0), (ax, ELBY + 0.13, 0), 0.2, -0.1, bolts=3)
    hose(ag, [(ax - sx * 0.08, ARMY - 0.08, 0.08), (ax - sx * 0.09, ARMY - 0.3, 0.1), (ax - sx * 0.08, ELBY + 0.06, 0.08)], 0.015)
    clevis(ag, fg, (ax, ELBY, 0), 0.11, 0.08, 0.12, down=True)
    strut(fg, (ax, ELBY - 0.09, 0), (ax, ELBY - 0.5, 0), 0.08, 0.065)
    guard(fg, (ax, ELBY - 0.1, 0), (ax, ELBY - 0.48, 0), 0.18, -0.09, bolts=3, cls='paint2' if i == 1 else 'paint')
    hy = ELBY - 0.57
    store(nm('wrist'), bm_lathe([(0.075, hy + 0.08), (0.085, hy + 0.06), (0.085, hy + 0.03), (0.07, hy + 0.02)], 14, T(ax, 0, 0)), 'steel', fg, bevel=0.002, seg=1)
    store(nm('pusher'), bm_loft([[(ax + px, hy - 0.06 + 0.02 * (abs(pz) / 0.18) ** 2, pz - 0.05) for (px, pz) in rrect(0.32, 0.36, 0.05, 3)], [(ax + px, hy - 0.01 + 0.02 * (abs(pz) / 0.18) ** 2, pz - 0.05) for (px, pz) in rrect(0.3, 0.34, 0.05, 3)]]), 'steel', fg, bevel=0.005, seg=1, sharp=40)
    for k in range(5):
        store(nm('prib'), bm_box(0.3, 0.02, 0.022, T(ax, hy - 0.07, -0.19 + k * 0.07)), 'dark', fg, bevel=0.003, seg=1)
    for bx in (-1, 1):
        for bz2 in (-1, 1):
            bolt(fg, (ax + bx * 0.11, hy - 0.005, -0.05 + bz2 * 0.13), (0, 1, 0), 0.012)
    ram('elbow%d' % i, ag, fg, (ax, ARMY - 0.18, 0.15), (ax, ELBY - 0.19, 0.13), 0.04)


# ---------------------------------------------------------------- WEAR AND GROWTH (Walker v2 standard)
random.seed(103)
sp = []
for sx in (-1, 1):
    for k in range(18):
        (py, pz), (ny, nz) = stad(PER * random.random())
        sp.append(((sx * 0.55 + random.uniform(-0.15, 0.15), py + ny * 0.01, pz + nz * 0.01), random.uniform(0.016, 0.028), (0, ny, nz)))
    for k in range(6):
        sp.append(((sx * 0.75, random.uniform(0.36, 0.46), random.uniform(-0.6, 0.6)), random.uniform(0.012, 0.02), (sx, 0, 0)))
G.mud('base', sp)
G.leaves('base', [(sx * 0.55 + random.uniform(-0.12, 0.12), 0.53, random.uniform(-0.6, 0.6)) for sx in (-1, 1) for k in range(5)], 0.06)
G.moss('base', [((0.5, 0.52, 0.3), 0.04), ((-0.55, 0.52, -0.4), 0.035), ((0.0, 0.67, 0.4), 0.03)])
G.tufts('base', [((0.55, 0.05, 0.5), 6, 0.18, 0.06), ((-0.55, 0.05, -0.5), 5, 0.16, 0.06), ((0.0, 0.36, -0.5), 5, 0.14, 0.05)])
G.tufts('base', [((-0.55, 0.5, 0.2), 4, 0.12, 0.04)], dry=True)
G.moss('torso', [(body.pt(BY1 - 0.06, a, 0.01), 0.04) for a in (0.2 * PI, 0.8 * PI, 1.3 * PI, 1.8 * PI)])
G.tufts('torso', [(body.pt(yb[1] + 0.005, 1.7 * PI, 0.015), 5, 0.14, 0.03), (body.pt(yb[3] + 0.005, 0.3 * PI, 0.015), 5, 0.14, 0.03), (body.pt(yb[0] + 0.05, PI + 0.5, -0.02), 6, 0.16, 0.06)])
G.leaves('torso', [(random.uniform(-0.4, 0.4), BY1 + 0.0, random.uniform(-0.25, 0.25)) for k in range(6)] + [(random.uniform(-0.2, 0.2), gc[1] + 0.17, gc[2] + random.uniform(-0.05, 0.05)) for k in range(2)], 0.06)
G.moss('head', [((hx0 + 0.25, hy0 + 0.21, hz0 + 0.1), 0.035)])
G.leaves('head', [(hx0 + random.uniform(-0.3, 0.3), hy0 + 0.21, hz0 + random.uniform(-0.05, 0.25)) for k in range(4)], 0.055)
for i, sx in enumerate((-1, 1)):
    ag, fg, ax = 'arm%d' % i, 'fore%d' % i, sx * ARMX
    G.moss(ag, [((ax, ARMY + 0.12, 0.05), 0.03)])
    G.moss(fg, [((ax, ELBY + 0.09, 0.0), 0.025)])
    G.tufts(ag, [((ax - sx * 0.08, ARMY + 0.1, 0.08), 4, 0.12, 0.03)], dry=True)
    G.oil((ax, ARMY - 0.1, 0.06), 0.03, 0.45)
    G.oil((ax, ELBY - 0.08, 0.05), 0.028, 0.4)
    G.dent((ax + sx * 0.03, ARMY - 0.3, -0.1), (0, 0, -1), 0.055, 0.009)
    G.oil((sx * 0.55, cy, -0.45), 0.05, 0.2)
    G.oil((sx * 0.55, cy, 0.45), 0.05, 0.2)
G.dent(body.pt(yb[2] + 0.2, PI + 0.3), tuple(body.normal(yb[2] + 0.2, PI + 0.3)), 0.09, 0.014)
G.dent(body.pt(yb[2] + 0.15, 0.5 * PI + 0.2), tuple(body.normal(yb[2] + 0.15, 0.5 * PI + 0.2)), 0.08, 0.012)
G.dent(body.pt(yb[4] + 0.15, 0.2 * PI), tuple(body.normal(yb[4] + 0.15, 0.2 * PI)), 0.07, 0.011)
G.dent((hx0 + 0.44, hy0 + 0.03, hz0 + 0.03), (1, 0, 0), 0.06, 0.009)
G.dent(hull.pt(0.5, 0.5 * PI + 0.35), tuple(hull.normal(0.5, 0.5 * PI + 0.35)), 0.06, 0.01)
G.oil(body.pt(yb[0] + 0.15, PI + 0.55, -0.04), 0.07, 0.6)
G.oil((0, TOR + 1.18, 0.0), 0.05, 0.6)
G.soot((0.42, TOR + 1.38, 0.46), 0.07, 0.25)
G.soot((0.0, gc[1], gc[2] + 0.15), 0.12, 0.35)
G.soot(body.pt(yb[2] + 0.2, 0.0, 0.01), 0.1, 0.3)

apply_all()
tot = sum(tris(ob) for ob in OBJS)
print('objects', len(OBJS), 'triangles', tot)
bpy.context.scene['rams'] = repr(RAMS)
bpy.ops.wm.save_as_mainfile(filepath=out)
save_marks(out[:-6] + '_marks.json')
kinds = {}
for ob in OBJS:
    kk = ob.name.split('_')[0]
    kinds[kk] = kinds.get(kk, 0) + tris(ob)
print(sorted(kinds.items(), key=lambda q: -q[1])[:18])
