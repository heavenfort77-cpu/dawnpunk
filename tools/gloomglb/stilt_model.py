# The Stilt (streetlight maintenance unit LMP-5) as a desktop model, built in Blender headless. NOT boxy, industrial (v2: clevis joints, strut limbs, bolted guards, rams, straps): an egg-shaped torso of curved panels over a dark core,
# a teardrop head pod with a round-cornered screen and a bent aerial, very long tapered legs under leaf-shaped guards with rams and hoses, heron-like three-toed feet,
# a cable drum on its back, a long working arm (tapered sleeve, telescoping forearm, needle-pincer tool with a work light) and a torn-off stump with hanging wires.
# Usage: python3 tools/gloomglb/stilt_model.py <out.blend>
# Nodes and pivots as stilt() in src/gloomhi.js: pelvis (0, 2.2, 0), torso (0, 2.25, 0), head (0, 3.07, 0) on the torso (no neck node),
# hip0/knee0 (x < 0) at (+-0.16, 2.2 / 1.1, 0); arm0 = the working arm 'up' at (0.24, 2.75, 0) with fore0 at (0.24, 2.05, 0); arm1 = the stump 'off' at (-0.24, 2.75, 0), no forearm.
# Empty 'screen' at head + (0, 0, -0.13) (display 0.3 x 0.21).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from bl_lib import *
from organic_lib import *
import grime_lib as G
from grime_lib import save_marks

random.seed(53)
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/stilt.blend'

PEL, TOR = 2.2, 2.25
HIPX, KNEEY = 0.16, 1.1
HD = (0, 3.07, 0)
UP, UPF, OFF = (0.24, 2.75, 0), (0.24, 2.05, 0), (-0.24, 2.75, 0)
group('pelvis', (0, PEL, 0))
group('torso', (0, TOR, 0), 'pelvis')
group('head', HD, 'torso')
for i, sx in enumerate((-1, 1)):
    group('hip%d' % i, (sx * HIPX, PEL, 0), 'pelvis')
    group('knee%d' % i, (sx * HIPX, KNEEY, 0), 'hip%d' % i)
group('arm0', UP, 'torso')
group('fore0', UPF, 'arm0')
group('arm1', OFF, 'torso')
Z0 = HD[2] - 0.13
empty('screen', (0, HD[1], Z0), GROUPS['head'][0])
N = [0]


def nm(s):
    N[0] += 1
    return '%s_%03d' % (s, N[0])


def bolt(grp, p, n, r=0.006, cls='bolt'):
    M = T(*p) @ aim_y(n)
    return store(nm('bolt'), bm_lathe([(r, r * 0.2), (r, r * 0.75), (r * 0.65, r * 1.0), (0, r * 1.1)], 6, M, cap0=False, phase=random.random()), cls, grp, sharp=50, wn=False)


def hose(grp, pts, r, cls='rubber', sides=None):
    return store(nm('hose'), bm_sweep(pts, [r] * len(pts), sides or (6 if r < 0.012 else 9), 6, rib=(max(0.016, r * 2.2), 0.16)), cls, grp, sharp=80, wn=False)


def ball(grp, c, r, cls='dark', seg=16, rings=8):
    return store(nm('ball'), bm_ellipsoid(c, r, r, r, seg, rings), cls, grp, sharp=80)


def lamp(grp, c, n, r=0.03):
    M = T(*c) @ aim_y(n)
    store(nm('lamph'), bm_lathe([(r * 1.35, -0.025), (r * 1.4, -0.006), (r * 1.3, 0.004), (r * 1.0, 0.009), (r * 0.98, 0.002)], 16, M, cap0=True, cap1=False), 'dark', grp, bevel=0.002, seg=1)
    store(nm('lens'), bm_lathe([(r * 0.99, 0.002), (r * 0.8, 0.01), (r * 0.4, 0.014), (0, 0.015)], 16, M), 'lens', grp, sharp=60, wn=False)


RAMS = []


def ram(tag, Pg, Cg, A, B, rc):
    A, B = Vector(A), Vector(B)
    d = (B - A)
    L = d.length
    Lc, Lr = round(L * 0.6, 3), round(L * 0.66, 3)
    FA = T(*A) @ aim_y(-d)
    cyl = bm_lathe([(rc * 1.0, -0.01), (rc * 1.0, -Lc * 0.92), (rc * 1.22, -Lc * 0.93), (rc * 1.22, -Lc), (rc * 0.55, -Lc - 0.004), (rc * 0.55, -Lc - 0.002)], 12, I4, cap0=False, cap1=True)
    cap = bm_lathe([(rc * 1.2, -0.03), (rc * 1.2, -0.012), (rc * 0.8, -0.004)], 12, I4)
    eye = bm_cyl(rc * 0.9, rc * 0.9, rc * 1.4, 10, R('Z', PI / 2))
    store('ramc_' + tag, bm_join([cyl, cap, eye]), 'dark', Pg, frame=FA, local=True)
    FB = T(*B) @ aim_y(d)
    rod = bm_lathe([(rc * 0.42, 0.0), (rc * 0.42, Lr)], 10, I4)
    eye2 = bm_cyl(rc * 0.8, rc * 0.8, rc * 1.3, 10, R('Z', PI / 2))
    store('ramr_' + tag, bm_join([rod, eye2]), 'chrome', Cg, frame=FB, local=True)
    RAMS.append((tag, Pg, Cg, tuple(A), tuple(B)))


# ---------------------------------------------------------------- TORSO: an egg of curved panels over a dark core, the front-right plate gone
BY0, BY1 = TOR + 0.02, TOR + 0.62
ys = [BY0 + (BY1 - BY0) * t for t in (0, 0.12, 0.35, 0.6, 0.82, 0.95, 1.0)]
body = Shell(ys, W=[0.26, 0.38, 0.45, 0.45, 0.38, 0.24, 0.1], D=[0.22, 0.3, 0.35, 0.35, 0.3, 0.2, 0.09], Zc=[0.0, 0.0, 0.01, 0.02, 0.025, 0.02, 0.01], p=2.3)
store('core', body.solid(BY0 + 0.01, BY1 - 0.01, 10, 28, off=-0.025), 'core', 'torso', sharp=60)
GA = 0.025
yb = [BY0 + 0.005, BY0 + 0.17, BY0 + 0.185, BY0 + 0.43, BY0 + 0.445, BY1 - 0.005]
for (a0, a1) in ((PI / 2 + GA, 1.5 * PI - GA), (-PI / 2 + GA, PI / 2 - GA)):
    store(nm('pan'), body.panel(yb[0], yb[1], a0, a1, 0.011, -0.01, 4, 14), 'paint', 'torso', bevel=0.003, seg=1, sharp=40)
for k, ac in enumerate((1.5 * PI, 0.0, 0.5 * PI)):
    store(nm('plate'), body.panel(yb[2], yb[3], ac - PI / 4 + GA, ac + PI / 4 - GA, 0.012, -0.01, 6, 10), 'paint2' if k == 2 else 'paint', 'torso', bevel=0.003, seg=1, sharp=40)
# the front plate is split: its left half stays, the right half is gone (frame, wires, a relay box show)
store(nm('plate'), body.panel(yb[2], yb[3], PI + GA * 0.5, 1.25 * PI - GA, 0.012, -0.01, 6, 6), 'paint', 'torso', bevel=0.003, seg=1, sharp=40)
for f in (0.2, 0.55, 0.85):
    y = yb[2] + (yb[3] - yb[2]) * f
    store(nm('hoop'), bm_sweep([body.pt(y, 0.75 * PI + (PI / 4) * j / 5, -0.016) for j in range(6)], [0.005] * 6, 6, 2), 'steel', 'torso', sharp=60, wn=False)
for j, (c_, a_) in enumerate((('wire_r', 0.8 * PI), ('wire_y', 0.88 * PI), ('rubber', 0.95 * PI))):
    store(nm('wire'), bm_sweep([body.pt(yb[3] - 0.01, a_, -0.016), body.pt(yb[2] + 0.12, a_ + 0.06, 0.0), body.pt(yb[2] + 0.02, a_ - 0.03, -0.016)], [0.005] * 3, 6, 5), c_, 'torso', sharp=80, wn=False)
store('relay', bm_box(0.05, 0.06, 0.03, T(*body.pt(yb[2] + 0.1, 0.87 * PI, -0.03))), 'dark', 'torso', bevel=0.004, seg=1)
store(nm('wire'), bm_sweep([body.pt(yb[2] + 0.06, 0.85 * PI, 0.0), body.pt(yb[2] - 0.02, 0.86 * PI, 0.03), body.pt(yb[2] - 0.16, 0.88 * PI, 0.05)], [0.005] * 3, 6, 5), 'wire_r', 'torso', sharp=80, wn=False)
store('cowl', body.panel(yb[4], yb[5], 0.0, 2 * PI, 0.012, -0.01, 6, 28), 'paint', 'torso', bevel=0.003, seg=1, sharp=40)
for y in (yb[1] - 0.012, yb[3] - 0.012, yb[4] + 0.012):
    for k in range(14):
        a = 2 * PI * k / 14 + 0.1
        if yb[2] < y < yb[3] and 0.75 * PI < a < 1.0 * PI:
            continue
        bolt('torso', body.pt(y, a, 0.002), tuple(body.normal(y, a)), 0.005)
# the cable drum on the back: a spool along x with rims, rubber cable wound on it, a crank; a curved vent on the left flank; a tool rack on the right
dz = body.pt(TOR + 0.3, 0.0)[2] + 0.08
store('drum', bm_lathe([(0.11, -0.07), (0.13, -0.065), (0.13, -0.055), (0.07, -0.05), (0.07, 0.05), (0.13, 0.055), (0.13, 0.065), (0.11, 0.07)], 20, T(0, TOR + 0.3, dz) @ R('Z', PI / 2)), 'paint', 'torso', sharp=40)
store('drumhub', bm_sweep([(-0.085, TOR + 0.3, dz), (0.085, TOR + 0.3, dz)], [0.025, 0.025], 12, 2), 'steel', 'torso', sharp=50)
for k in range(5):
    store(nm('coil'), bm_torus(0.085, 0.011, 18, 6, T(-0.04 + k * 0.02, TOR + 0.3, dz) @ R('Z', PI / 2)), 'rubber', 'torso', wn=False)
store('cable', bm_sweep([(0.04, TOR + 0.3 - 0.09, dz), (0.06, TOR + 0.1, dz + 0.02), (0.1, TOR - 0.15, dz - 0.02), (0.14, TOR - 0.35, dz - 0.05)], [0.01] * 4, 6, 6), 'rubber', 'torso', sharp=80, wn=False)
for sx in (-1, 1):
    store(nm('dbrk'), bm_sweep([(sx * 0.08, TOR + 0.3, dz), (sx * 0.08, TOR + 0.3, dz - 0.08)], [0.012, 0.016], 8, 2, ell=(0.6, 1.5)), 'dark', 'torso', sharp=50)
for k in range(4):
    y = yb[2] + 0.06 + k * 0.03
    store(nm('louvre'), bm_sweep([body.pt(y, 1.5 * PI - 0.35 + 0.7 * j / 6, 0.004) for j in range(7)], [0.004] * 7, 4, 2, ell=(1, 2.0)), 'steel', 'torso', sharp=60, wn=False)
for k in range(3):
    p0 = Vector(body.pt(yb[2] + 0.18, 0.5 * PI - 0.25 + k * 0.25, 0.03))
    store(nm('tool'), bm_sweep([tuple(p0 + Vector((0, 0.12, 0))), tuple(p0 - Vector((0, 0.14, 0)))], [0.011, 0.008], 8, 2), 'chrome' if k == 1 else 'steel', 'torso', sharp=50)
store('rack', bm_sweep([body.pt(yb[2] + 0.07, 0.5 * PI - 0.35, 0.03), body.pt(yb[2] + 0.07, 0.5 * PI, 0.035), body.pt(yb[2] + 0.07, 0.5 * PI + 0.35, 0.03)], [0.008] * 3, 6, 4, ell=(1, 2.2)), 'steel', 'torso', sharp=50)
# neck: a ribbed bellows from the cowling to the head, a copper line beside it
store('bellows', bm_sweep([(0, BY1 - 0.04, 0.0), (0, BY1 + 0.08, -0.01), (0, HD[1] - 0.12, 0.0)], [0.055, 0.05, 0.05], 14, 6, rib=(0.02, 0.14)), 'rubber', 'head', sharp=80)
store('nline', bm_sweep([(0.05, BY1 - 0.03, 0.03), (0.06, BY1 + 0.1, 0.02), (0.045, HD[1] - 0.12, 0.04)], [0.006] * 3, 6, 5), 'copper', 'head', sharp=70, wn=False)

# ---------------------------------------------------------------- PELVIS: a slim rounded cross-beam with a socket dome
store('pel_bar', bm_sweep([(-0.24, PEL, 0), (0, PEL + 0.01, 0), (0.24, PEL, 0)], lambda u: 0.045 * (0.85 + 0.15 * math.sin(PI * u)), 14, 4, ell=(1, 1.3)), 'dark', 'pelvis', sharp=50)
store('pel_cowl', bm_ellipsoid((0, PEL + 0.02, -0.01), 0.12, 0.06, 0.1, 18, 6, y0=-0.4, y1=1.0), 'paint', 'pelvis', sharp=40, bevel=0.003, seg=1)


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



# ---------------------------------------------------------------- LEGS (v2, industrial): very long; hip clevis, tapered strut thigh with flanges, two bolted guard plates, a ram and hoses,
# knee clevis, strut shin with two guards and a ram, ankle pin and lugs, heron feet
for i, sx in enumerate((-1, 1)):
    hg, kg, x = 'hip%d' % i, 'knee%d' % i, sx * HIPX
    clevis('pelvis', hg, (x, PEL, 0), 0.07, 0.05, 0.08, down=False)
    strut(hg, (x, PEL - 0.06, 0), (x, KNEEY + 0.08, 0), 0.045, 0.036)
    guard(hg, (x, PEL - 0.08, 0), (x, PEL - 0.5, 0), 0.1, -0.052, bolts=2)
    guard(hg, (x, PEL - 0.54, 0), (x, KNEEY + 0.1, 0), 0.09, -0.05, bolts=2, cls='paint2' if i == 0 else 'paint')
    hose(hg, [(x + sx * 0.05, PEL - 0.05, 0.03), (x + sx * 0.06, PEL - 0.55, 0.035), (x + sx * 0.045, KNEEY + 0.06, 0.03)], 0.008)
    store(nm('wire'), bm_sweep([(x - sx * 0.04, PEL - 0.05, 0.035), (x - sx * 0.05, PEL - 0.55, 0.045), (x - sx * 0.04, KNEEY + 0.06, 0.035)], [0.005] * 3, 6, 6), 'wire_r', hg, sharp=80, wn=False)
    for yy in (PEL - 0.25, PEL - 0.75):
        store(nm('band'), bm_sweep([(x - 0.055, yy, 0.0), (x, yy, 0.05), (x + 0.055, yy, 0.0)], [0.006] * 3, 6, 3), 'steel', hg, sharp=60, wn=False)
    clevis(hg, kg, (x, KNEEY, 0), 0.065, 0.045, 0.08, down=True)
    strut(kg, (x, KNEEY - 0.06, 0), (x, 0.12, 0), 0.04, 0.032)
    guard(kg, (x, KNEEY - 0.07, 0), (x, KNEEY - 0.48, 0), 0.085, -0.046, bolts=2)
    guard(kg, (x, KNEEY - 0.52, 0), (x, 0.16, 0), 0.075, -0.044, bolts=2)
    hose(kg, [(x + sx * 0.04, KNEEY - 0.05, 0.03), (x + sx * 0.045, KNEEY - 0.5, 0.035), (x + sx * 0.035, 0.12, 0.03)], 0.007)
    store(nm('ankle'), bm_sweep([(x - 0.045, 0.075, 0.0), (x + 0.045, 0.075, 0.0)], [0.026, 0.026], 12, 2), 'steel', kg, sharp=50)
    for sx2 in (-1, 1):
        store(nm('alug'), bm_loft([[(x + sx2 * 0.035 - 0.007, 0.05, -0.03), (x + sx2 * 0.035 + 0.007, 0.05, -0.03), (x + sx2 * 0.035 + 0.007, 0.05, 0.03), (x + sx2 * 0.035 - 0.007, 0.05, 0.03)],
                                    [(x + sx2 * 0.035 - 0.007, 0.125, -0.022), (x + sx2 * 0.035 + 0.007, 0.125, -0.022), (x + sx2 * 0.035 + 0.007, 0.125, 0.022), (x + sx2 * 0.035 - 0.007, 0.125, 0.022)]]), 'dark', kg, bevel=0.002, seg=1, sharp=40)
    for t, ang in enumerate((-0.45, 0.0, 0.45)):
        d = Vector((math.sin(ang), 0, -math.cos(ang)))
        p0 = Vector((x, 0.055, 0.0))
        pts = [tuple(p0), tuple(p0 + d * 0.09 + Vector((0, -0.022, 0))), tuple(p0 + d * 0.17 + Vector((0, -0.042, 0)))]
        store(nm('toe'), bm_sweep(pts, [0.022, 0.018, 0.01], 6, 4, ell=(1.3, 0.6), up=(0, 1, 0)), 'steel', kg, sharp=40)
        tip = [tuple(Vector(pts[-1]) - d * 0.005), tuple(Vector(pts[-1]) + d * 0.04 + Vector((0, -0.012, 0)))]
        store(nm('claw'), bm_sweep(tip, [0.01, 0.002], 6, 3, ell=(1.2, 0.8), up=(0, 1, 0)), 'dark', kg, sharp=50)
    store(nm('spur'), bm_sweep([(x, 0.06, 0.03), (x, 0.03, 0.09), (x, 0.012, 0.12)], [0.016, 0.012, 0.004], 6, 4, ell=(1.1, 0.7), up=(0, 1, 0)), 'steel', kg, sharp=50)
    ram('hip%d' % i, 'pelvis', hg, (x, PEL - 0.0065, 0.1), (x, PEL - 0.34, 0.075), 0.022)
    ram('knee%d' % i, hg, kg, (x, PEL - 0.72, 0.085), (x, KNEEY - 0.24, 0.078), 0.019)

# ---------------------------------------------------------------- ARM 0 ('up'): shoulder pin hub, strut with a bolted guard and a ram, elbow clevis, telescoping forearm, needle pincers, work light
ax, ay = UP[0], UP[1]
fy = UPF[1]
hub0 = bm_lathe([(0.07, -0.05), (0.08, -0.04), (0.08, 0.04), (0.06, 0.05), (0, 0.05)], 16, T(ax - 0.06, ay, 0.0) @ R('Z', -PI / 2))
store('shub0', hub0, 'paint', 'torso', sharp=40, bevel=0.002, seg=1)
for k in range(6):
    a = k * PI / 3
    bolt('torso', (ax - 0.008, ay + math.sin(a) * 0.06, math.cos(a) * 0.06), (1, 0, 0), 0.006)
store('spin0', bm_sweep([(ax - 0.02, ay, 0), (ax + 0.05, ay, 0)], [0.05, 0.05], 14, 2), 'dark', 'arm0', sharp=50)
strut('arm0', (ax, ay - 0.05, 0), (ax, fy + 0.08, 0), 0.042, 0.034)
guard('arm0', (ax, ay - 0.07, 0), (ax, fy + 0.1, 0), 0.09, -0.05, bolts=3)
hose('arm0', [(ax - 0.03, ay - 0.06, 0.05), (ax - 0.04, ay - 0.35, 0.06), (ax - 0.03, fy + 0.06, 0.05)], 0.008)
clevis('arm0', 'fore0', (ax, fy, 0), 0.06, 0.04, 0.07, down=True)
store('ftube', bm_sweep([(ax, fy - 0.06, 0), (ax, fy - 0.4, 0)], [0.034, 0.032], 12, 2), 'paint', 'fore0', sharp=50)
store('fcollar', bm_lathe([(0.036, fy - 0.42), (0.044, fy - 0.41), (0.044, fy - 0.385), (0.036, fy - 0.375)], 12, T(ax, 0, 0)), 'steel', 'fore0', sharp=50)
store('ftele', bm_sweep([(ax, fy - 0.4, 0), (ax, fy - 0.74, 0)], [0.024, 0.024], 12, 2), 'chrome', 'fore0', sharp=50)
store('fcable', bm_sweep([(ax + 0.03, fy - 0.02, 0.04), (ax + 0.06, fy - 0.4, 0.07), (ax + 0.03, fy - 0.72, 0.05)], [0.006] * 3, 6, 6), 'rubber', 'fore0', sharp=80, wn=False)
gy = fy - 0.78
store('grip', bm_sweep([(ax - 0.045, gy + 0.02, 0.0), (ax + 0.045, gy + 0.02, 0.0)], [0.045, 0.045], 12, 2, ell=(1.0, 1.3)), 'dark', 'fore0', sharp=50)
for s2 in (-1, 1):
    store(nm('jaw'), bm_sweep([(ax + s2 * 0.03, gy - 0.01, -0.01), (ax + s2 * 0.045, gy - 0.08, -0.02), (ax + s2 * 0.02, gy - 0.16, -0.03), (ax + s2 * 0.004, gy - 0.2, -0.03)], [0.012, 0.01, 0.006, 0.0015], 6, 4, ell=(0.7, 1.3)), 'steel', 'fore0', sharp=50)
lamp('fore0', (ax, gy + 0.02, -0.06), (0, 0, -1), 0.022)
ram('elbow0', 'arm0', 'fore0', (ax, ay - 0.16, 0.06), (ax, fy - 0.16, 0.05), 0.02)

# ---------------------------------------------------------------- ARM 1 ('off'): a shoulder pin hub, a short strut stump ending in a torn flange, wires hanging out
ox, oy = OFF[0], OFF[1]
hub1 = bm_lathe([(0.065, -0.05), (0.075, -0.04), (0.075, 0.04), (0.055, 0.05), (0, 0.05)], 16, T(ox + 0.06, oy, 0.0) @ R('Z', PI / 2))
store('shub1', hub1, 'paint', 'torso', sharp=40, bevel=0.002, seg=1)
store('spin1', bm_sweep([(ox - 0.05, oy, 0), (ox + 0.02, oy, 0)], [0.048, 0.048], 14, 2), 'dark', 'arm1', sharp=50)
strut('arm1', (ox, oy - 0.04, 0), (ox, oy - 0.48, 0), 0.04, 0.034, cls='paint')
store('storn', bm_lathe([(0.036, oy - 0.5), (0.046, oy - 0.505), (0.04, oy - 0.52), (0.022, oy - 0.51)], 12, T(ox, 0, 0)), 'dark', 'arm1', sharp=50)
for k, c_ in enumerate(('wire_r', 'wire_y', 'rubber')):
    L = 0.12 + 0.05 * k
    store(nm('dangle'), bm_sweep([(ox - 0.012 + k * 0.012, oy - 0.5, 0.0), (ox - 0.02 + k * 0.02, oy - 0.5 - L * 0.6, 0.01 * k), (ox - 0.015 + k * 0.016, oy - 0.5 - L, 0.012)], [0.005] * 3, 6, 5), c_, 'arm1', sharp=80, wn=False)
# torso v2: two bolted straps round the egg, a bolted hatch on the front-left plate with hinges
for y in (yb[1] + 0.007, yb[3] + 0.007):
    loop = [body.pt(y, 2 * PI * k / 30, 0.02) for k in range(31)]
    store(nm('strap'), bm_sweep(loop, [0.016] * 31, 6, 1, ell=(0.45, 1.0)), 'steel', 'torso', sharp=40, wn=False)
    for k in range(12):
        a = 2 * PI * k / 12 + 0.1
        bolt('torso', body.pt(y, a, 0.027), tuple(body.normal(y, a)), 0.006)
store('hatch', body.panel(yb[2] + 0.05, yb[3] - 0.05, 1.28 * PI, 1.45 * PI, 0.012, 0.01, 4, 6), 'paint', 'torso', bevel=0.003, seg=1, sharp=40)
for t in (0.15, 0.85):
    y = yb[2] + 0.05 + (yb[3] - yb[2] - 0.1) * t
    for a in (1.29 * PI, 1.44 * PI):
        bolt('torso', body.pt(y, a, 0.024), tuple(body.normal(y, a)), 0.006)

# ---------------------------------------------------------------- HEAD: a teardrop pod (round front, tapering to a point behind), round-cornered screen, steel bezel, side lamp, a bent aerial
hx0, hy0, hz0 = HD


def pod_ring(z, w, h, p=2.9, n=36, dy=0.0):
    return [(hx0 + superellipse(2 * PI * k / n, p)[0] * w / 2, hy0 + dy + superellipse(2 * PI * k / n, p)[1] * h / 2, z) for k in range(n)]


rings = [pod_ring(Z0 + 0.03, 0.31, 0.22), pod_ring(Z0 - 0.002, 0.32, 0.23), pod_ring(Z0 - 0.016, 0.34, 0.25), pod_ring(Z0 - 0.02, 0.38, 0.29, 2.7),
         pod_ring(Z0 - 0.008, 0.4, 0.31, 2.5), pod_ring(Z0 + 0.08, 0.4, 0.31, 2.3), pod_ring(Z0 + 0.19, 0.32, 0.25, 2.2, dy=0.01), pod_ring(Z0 + 0.29, 0.19, 0.15, 2.1, dy=0.02),
         pod_ring(Z0 + 0.36, 0.08, 0.07, 2.0, dy=0.03), pod_ring(Z0 + 0.39, 0.02, 0.02, 2.0, dy=0.035)]
store('pod', bm_loft(rings), 'paint', 'head', sharp=35, bevel=0.002, seg=1)
store('well', bm_box(0.32, 0.23, 0.005, T(hx0, hy0, Z0 + 0.028)), 'core', 'head')
bz = pod_ring(Z0 - 0.018, 0.325, 0.235, 2.9, 36)
store('bezel', bm_sweep(bz + bz[:3], [0.0065] * 39, 6, 1), 'steel', 'head', sharp=60, wn=False)
for k in range(6):
    a = 2 * PI * k / 6 + PI / 6
    q = superellipse(a, 2.9)
    bolt('head', (hx0 + q[0] * 0.18, hy0 + q[1] * 0.132, Z0 - 0.018), (0, 0, -1), 0.0045)
lamp('head', (hx0 + 0.2, hy0 + 0.04, Z0 + 0.06), (1, 0, 0), 0.03)
store('aerial', bm_sweep([(hx0 - 0.12, hy0 + 0.14, Z0 + 0.15), (hx0 - 0.13, hy0 + 0.28, Z0 + 0.17), (hx0 - 0.11, hy0 + 0.33, Z0 + 0.16), (hx0 + 0.02, hy0 + 0.42, Z0 + 0.12)], [0.005, 0.004, 0.003, 0.0015], 6, 5), 'steel', 'head', sharp=60, wn=False)
store('abase', bm_ellipsoid((hx0 - 0.12, hy0 + 0.14, Z0 + 0.15), 0.018, 0.014, 0.018, 12, 6, y0=-0.2, y1=1.0), 'dark', 'head', sharp=60)
for k in range(4):
    z = Z0 + 0.14 + k * 0.035
    w = 0.34 - k * 0.04
    store(nm('hrib'), bm_sweep([(hx0 - w / 2, hy0 - 0.1 + k * 0.004, z), (hx0, hy0 - 0.12 + k * 0.004, z + 0.01), (hx0 + w / 2, hy0 - 0.1 + k * 0.004, z)], [0.004] * 3, 6, 4), 'dark', 'head', sharp=60, wn=False)
store('hplate', bm_box(0.004, 0.04, 0.08, T(hx0 - 0.2, hy0 - 0.05, Z0 + 0.1)), 'brass', 'head', bevel=0.0015, seg=1)

# ---------------------------------------------------------------- WEAR AND GROWTH (Walker v2 standard)
random.seed(99)
for i, sx in enumerate((-1, 1)):
    x, kg, hg = sx * HIPX, 'knee%d' % i, 'hip%d' % i
    sp = []
    for t, ang in enumerate((-0.45, 0.0, 0.45)):
        d = Vector((math.sin(ang), 0, -math.cos(ang)))
        for k in range(3):
            q = Vector((x, 0.03, 0.0)) + d * (0.05 + 0.05 * k)
            sp.append((tuple(q), random.uniform(0.012, 0.02), (0, 1, 0)))
    for k in range(8):
        sp.append(((x + random.uniform(-0.03, 0.03), random.uniform(0.1, 0.35), -0.035), random.uniform(0.008, 0.013), (0, 0, -1)))
    G.mud(kg, sp)
    G.leaves(kg, [(x + random.uniform(-0.08, 0.08), 0.05, random.uniform(-0.15, 0.05)) for k in range(3)], 0.05)
    G.moss(kg, [((x + sx * 0.04, KNEEY + 0.04, 0.02), 0.018)])
    G.tufts(kg, [((x - sx * 0.03, KNEEY + 0.03, 0.03), 3, 0.1, 0.02), ((x, 0.06, 0.05), 5, 0.16, 0.05)], dry=(i == 1))
    G.moss(hg, [((x + sx * 0.04, PEL + 0.05, 0.02), 0.02)])
    G.oil((x, PEL - 0.05, 0.03), 0.02, 0.6)
    G.oil((x, KNEEY - 0.03, 0.03), 0.02, 0.6)
    G.oil((x, PEL - 0.3, 0.08), 0.015, 0.4)
    G.oil((x, KNEEY - 0.2, 0.08), 0.015, 0.4)
G.dent((-HIPX - 0.03, KNEEY - 0.35, -0.05), (-0.5, 0, -1), 0.05, 0.009, classes=('paint', 'paint2'))
G.dent((HIPX + 0.04, PEL - 0.45, -0.05), (0.5, 0, -1), 0.045, 0.007)
G.moss('torso', [(body.pt(yb[4] + 0.06, a, 0.008), 0.026) for a in (0.3 * PI, 1.1 * PI, 1.7 * PI)] + [(body.pt(yb[3] - 0.01, 0.85 * PI, -0.01), 0.02)])
G.tufts('torso', [(body.pt(yb[1] + 0.004, 1.3 * PI, 0.01), 4, 0.1, 0.02), (body.pt(yb[3] + 0.004, 0.2 * PI, 0.01), 4, 0.1, 0.02), (body.pt(yb[2] + 0.01, 0.88 * PI, -0.015), 5, 0.12, 0.03)])
G.leaves('torso', [tuple(Vector(body.pt(BY1 - 0.04, a, 0.008))) for a in (0.2 * PI, 0.7 * PI, 1.4 * PI)] + [(random.uniform(-0.06, 0.06), TOR + 0.3 + 0.13, dz + random.uniform(-0.02, 0.02)) for k in range(2)], 0.05)
G.leaves('pelvis', [(random.uniform(-0.1, 0.1), PEL + 0.07, random.uniform(-0.05, 0.05)) for k in range(2)], 0.045)
G.moss('head', [((hx0 - 0.05, hy0 + 0.15, Z0 + 0.12), 0.022)])
G.leaves('head', [(hx0 + random.uniform(-0.1, 0.1), hy0 + 0.155, Z0 + random.uniform(0.05, 0.15)) for k in range(2)], 0.045)
G.moss('arm0', [((ax, ay + 0.06, 0.0), 0.02)])
G.moss('arm1', [((ox, oy + 0.05, 0.0), 0.02)])
G.dent(body.pt(yb[2] + 0.12, 1.5 * PI + 0.2), tuple(body.normal(yb[2] + 0.12, 1.5 * PI + 0.2)), 0.05, 0.009)
G.dent(body.pt(yb[4] + 0.07, 0.3 * PI), tuple(body.normal(yb[4] + 0.07, 0.3 * PI)), 0.045, 0.008)
G.dent((hx0 - 0.19, hy0 + 0.02, Z0 + 0.1), (-1, 0, 0), 0.045, 0.007)
G.oil((ax, ay - 0.06, 0.03), 0.02, 0.4)
G.oil((ax, fy - 0.4, 0.0), 0.02, 0.35)
G.oil((ox, oy - 0.5, 0.0), 0.025, 0.25)
G.oil((0, BY1 - 0.02, 0.04), 0.03, 0.5)
G.soot(body.pt(yb[2] + 0.1, 1.5 * PI, 0.01), 0.05, 0.2)
G.soot((0, HD[1] - 0.05, Z0 + 0.25), 0.04, 0.15)

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
