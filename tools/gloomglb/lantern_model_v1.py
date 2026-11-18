# The Lantern (public-address lighting unit PA-9) as a desktop model, built in Blender headless. NOT boxy: a round hub pod of curved panels on three splayed,
# tapered legs, a tall mast with collars, climbing pegs and a wound cable, a flared loudspeaker horn, a curved boom, a hanging chain, and a lantern-shaped head
# pod (round-cornered screen, pointed roof with a finial, a lamp socket and wire cage underneath where the game hangs its glowing globe).
# Usage: python3 tools/gloomglb/lantern_model.py <out.blend>
# Nodes and pivots as lantern() in src/gloomhi.js, modelled at rest with the leg mounts UNrotated (the game sets mount<k>.rotation.y = a, .x = 0.35 like the builder):
# hub (0, 1.0, 0); mount0..2 at hub + (sin a * 0.2, 0, cos a * 0.2), a = k * 2.094 + 0.5; hip0..2 = the mounts' legs (at the mount), knee0..2 at hip + (0, -0.5, 0);
# arm0 (the boom) at hub + (0, 1.32, 0); pend at arm0 + (0, 0, -0.58); head at pend + (0, -0.42, 0); empty 'screen' at head + (0, 0, -0.15) (display 0.3 x 0.22).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from bl_lib import *
from organic_lib import *
import grime_lib as G
from grime_lib import save_marks

random.seed(61)
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lantern.blend'

HY = 1.0
group('hub', (0, HY, 0))
MNT = []
for k in range(3):
    a = k * 2.094 + 0.5
    m = (math.sin(a) * 0.2, HY, math.cos(a) * 0.2)
    MNT.append(m)
    group('mount%d' % k, m, 'hub')
    group('hip%d' % k, m, 'mount%d' % k)
    group('knee%d' % k, (m[0], HY - 0.5, m[2]), 'hip%d' % k)
group('arm0', (0, HY + 1.32, 0), 'hub')
group('pend', (0, HY + 1.32, -0.58), 'arm0')
HD = (0, HY + 0.9, -0.58)
group('head', HD, 'pend')
Z0 = HD[2] - 0.15
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


# ---------------------------------------------------------------- HUB: a round pod of curved panels over a dark core (one side hatch gone), three leg sockets under it
ys = [HY - 0.02, HY + 0.02, HY + 0.1, HY + 0.18, HY + 0.24, HY + 0.27]
body = Shell(ys, W=[0.22, 0.36, 0.43, 0.42, 0.32, 0.14], D=[0.22, 0.36, 0.43, 0.42, 0.32, 0.14], Zc=[0.0] * 6, p=2.2)
store('core', body.solid(HY - 0.01, HY + 0.26, 8, 24, off=-0.022), 'core', 'hub', sharp=60)
GA = 0.025
store('pan', body.panel(HY - 0.015, HY + 0.07, 0.0, 2 * PI, 0.011, -0.01, 4, 30), 'paint', 'hub', bevel=0.003, seg=1, sharp=40)
for k, ac in enumerate((PI, 1.5 * PI, 0.0)):
    store(nm('plate'), body.panel(HY + 0.08, HY + 0.2, ac - PI / 4 + GA, ac + PI / 4 - GA, 0.012, -0.01, 5, 10), 'paint2' if k == 2 else 'paint', 'hub', bevel=0.003, seg=1, sharp=40)
store('cap', body.panel(HY + 0.21, HY + 0.268, 0.0, 2 * PI, 0.012, -0.01, 4, 30), 'paint', 'hub', bevel=0.003, seg=1, sharp=40)
for f in (0.3, 0.7):
    y = HY + 0.08 + 0.12 * f
    store(nm('hoop'), bm_sweep([body.pt(y, PI / 4 + (PI / 2) * j / 6, -0.016) for j in range(7)], [0.005] * 7, 6, 2), 'steel', 'hub', sharp=60, wn=False)
for j, (c_, a_) in enumerate((('wire_r', 0.35 * PI), ('wire_y', 0.5 * PI), ('rubber', 0.62 * PI))):
    store(nm('wire'), bm_sweep([body.pt(HY + 0.2, a_, -0.016), body.pt(HY + 0.13, a_ + 0.08, 0.0), body.pt(HY + 0.08, a_ - 0.05, -0.016)], [0.005] * 3, 6, 5), c_, 'hub', sharp=80, wn=False)
store(nm('wire'), bm_sweep([body.pt(HY + 0.12, 0.5 * PI, 0.0), body.pt(HY + 0.05, 0.52 * PI, 0.04), body.pt(HY - 0.1, 0.55 * PI, 0.06)], [0.005] * 3, 6, 5), 'wire_r', 'hub', sharp=80, wn=False)
for y in (HY + 0.075, HY + 0.205):
    for k in range(12):
        a = 2 * PI * k / 12 + 0.1
        if abs(a - 0.5 * PI) < PI / 4 and y < HY + 0.2:
            continue
        bolt('hub', body.pt(y, a, 0.002), tuple(body.normal(y, a)), 0.005)
for k in range(4):
    y = HY + 0.1 + k * 0.022
    store(nm('louvre'), bm_sweep([body.pt(y, PI - 0.4 + 0.8 * j / 6, 0.004) for j in range(7)], [0.0035] * 7, 4, 2, ell=(1, 2.0)), 'steel', 'hub', sharp=60, wn=False)
for k, m in enumerate(MNT):
    store(nm('socket'), bm_ellipsoid((m[0] * 0.9, HY - 0.01, m[2] * 0.9), 0.06, 0.05, 0.06, 14, 6), 'dark', 'hub', sharp=50)

# ---------------------------------------------------------------- MAST: a tapered pole with three collars, climbing pegs, a wound cable; the loudspeaker horn on a bracket
store('mast', bm_lathe([(0.06, HY + 0.25), (0.058, HY + 0.6), (0.054, HY + 1.0), (0.05, HY + 1.35)], 16, I4), 'paint', 'hub', sharp=50)
for yy in (0.3, 0.7, 1.1):
    store(nm('collar'), bm_lathe([(0.064 - (yy - 0.3) * 0.008, HY + yy - 0.02), (0.074 - (yy - 0.3) * 0.008, HY + yy - 0.012), (0.074 - (yy - 0.3) * 0.008, HY + yy + 0.012), (0.064 - (yy - 0.3) * 0.008, HY + yy + 0.02)], 16, I4), 'steel', 'hub', sharp=50)
for k in range(6):
    a = k * 1.2
    y = HY + 0.42 + k * 0.13
    store(nm('peg'), bm_sweep([(math.sin(a) * 0.05, y, math.cos(a) * 0.05), (math.sin(a) * 0.12, y + 0.01, math.cos(a) * 0.12), (math.sin(a) * 0.13, y + 0.04, math.cos(a) * 0.13)], [0.008, 0.007, 0.006], 6, 3), 'steel', 'hub', sharp=60, wn=False)
helix = [(math.sin(k * 1.1) * 0.066, HY + 0.28 + k * 0.062, math.cos(k * 1.1) * 0.066) for k in range(17)]
store('wound', bm_sweep(helix, [0.007] * 17, 6, 3), 'rubber', 'hub', sharp=80, wn=False)
HM = T(0, HY + 1.3, -0.12) @ R('X', -PI / 2 + 0.2)
store('horn', bm_lathe([(0.03, -0.15), (0.036, -0.08), (0.06, 0.02), (0.105, 0.1), (0.16, 0.15), (0.168, 0.15), (0.112, 0.094), (0.066, 0.016), (0.042, -0.08), (0.036, -0.15)], 22, HM, closed=True), 'paint', 'hub', sharp=40)
store('hornrim', bm_torus(0.164, 0.008, 22, 5, HM @ T(0, 0.15, 0)), 'copper', 'hub', wn=False)
store('hornback', bm_sweep([tuple(HM @ Vector((0, -0.2, 0))), tuple(HM @ Vector((0, -0.12, 0)))], [0.045, 0.045], 14, 2), 'dark', 'hub', sharp=50)
store('hornbrk', bm_sweep([(0, HY + 1.3, -0.05), (0, HY + 1.28, 0.0)], [0.02, 0.025], 8, 2, ell=(0.6, 1.8)), 'steel', 'hub', sharp=50)

# ---------------------------------------------------------------- BOOM (arm0): a curved tapered arm from the mast top, a stay cable under it, a hinge at its end
by = HY + 1.32
store('boom', bm_sweep([(0, by, 0.02), (0, by + 0.05, -0.22), (0, by + 0.03, -0.45), (0, by, -0.58)], [0.035, 0.032, 0.026, 0.022], 12, 5, ell=(0.85, 1.15)), 'paint', 'arm0', sharp=50)
store('stay', bm_sweep([(0, by - 0.32, -0.05), (0, by - 0.16, -0.3), (0, by - 0.03, -0.52)], [0.008] * 3, 6, 5), 'steel', 'arm0', sharp=70, wn=False)
store('bcable', bm_sweep([(0.03, by + 0.02, 0), (0.04, by + 0.06, -0.3), (0.02, by + 0.01, -0.58)], [0.006] * 3, 6, 6), 'rubber', 'arm0', sharp=80, wn=False)
store('hinge', bm_sweep([(-0.03, by, -0.58), (0.03, by, -0.58)], [0.022, 0.022], 12, 2), 'steel', 'arm0', sharp=50)
store('topcap', bm_ellipsoid((0, by + 0.02, 0.0), 0.07, 0.05, 0.07, 14, 6, y0=-0.3, y1=1.0), 'dark', 'arm0', sharp=50)

# ---------------------------------------------------------------- CHAIN (pend): six links and a cable down to the head
px, py, pz = 0, by, -0.58
for k in range(6):
    store(nm('link'), bm_torus(0.02, 0.005, 12, 4, T(px, py - 0.02 - k * 0.036, pz) @ (R('Y', PI / 2) if k % 2 else I4) @ R('X', PI / 2) @ S(1, 1.5, 1)), 'steel', 'pend', wn=False)
store('pcable', bm_sweep([(0.02, py, pz), (0.05, py - 0.12, pz + 0.01), (0.03, py - 0.24, pz)], [0.005] * 3, 6, 5), 'rubber', 'pend', sharp=80, wn=False)

# ---------------------------------------------------------------- HEAD: a lantern pod (rounded sides, round-cornered screen), a pointed roof with a finial ring, a lamp socket and wire cage below
hx0, hy0, hz0 = HD


def pod_ring(z, w, h, p=2.8, n=36):
    return [(hx0 + superellipse(2 * PI * k / n, p)[0] * w / 2, hy0 + superellipse(2 * PI * k / n, p)[1] * h / 2, z) for k in range(n)]


rings = [pod_ring(Z0 + 0.03, 0.31, 0.23), pod_ring(Z0 - 0.002, 0.32, 0.24), pod_ring(Z0 - 0.016, 0.34, 0.26), pod_ring(Z0 - 0.02, 0.37, 0.32, 2.6),
         pod_ring(Z0 - 0.008, 0.39, 0.35, 2.5), pod_ring(Z0 + 0.1, 0.4, 0.36, 2.4), pod_ring(Z0 + 0.22, 0.38, 0.34, 2.4), pod_ring(Z0 + 0.28, 0.3, 0.27, 2.3), pod_ring(Z0 + 0.3, 0.12, 0.1, 2.2)]
store('pod', bm_loft(rings), 'paint', 'head', sharp=35, bevel=0.002, seg=1)
store('well', bm_box(0.32, 0.24, 0.005, T(hx0, hy0, Z0 + 0.028)), 'core', 'head')
bz = pod_ring(Z0 - 0.018, 0.325, 0.245, 2.8, 36)
store('bezel', bm_sweep(bz + bz[:3], [0.0065] * 39, 6, 1), 'copper', 'head', sharp=60, wn=False)
for k in range(6):
    a = 2 * PI * k / 6 + PI / 6
    q = superellipse(a, 2.8)
    bolt('head', (hx0 + q[0] * 0.18, hy0 + q[1] * 0.135, Z0 - 0.018), (0, 0, -1), 0.0045)
# roof: a curved four-sided cap swept up to a finial ring (the chain hangs from it)
HM2 = T(hx0, hy0 + 0.17, hz0)
store('roof', bm_lathe([(0.0, 0.0), (0.27, 0.0), (0.24, 0.025), (0.15, 0.07), (0.06, 0.11), (0.025, 0.14), (0.0, 0.145)], 4, HM2 @ R('Y', PI / 4) @ S(1, 1, 0.82), cap0=True, phase=0.0), 'paint', 'head', sharp=30, bevel=0.003, seg=1)
store('roofrim', bm_sweep([(hx0 + 0.19 * math.cos(t), hy0 + 0.168, hz0 + 0.155 * math.sin(t)) for t in [2 * PI * j / 16 for j in range(17)]], [0.007] * 17, 6, 1), 'copper', 'head', sharp=60, wn=False)
store('finial', bm_torus(0.022, 0.006, 12, 4, T(hx0, hy0 + 0.335, hz0) @ R('X', PI / 2)), 'copper', 'head', wn=False)
# under the pod: the lamp socket, a wire cage (four half hoops and a ring) round where the globe hangs
store('socket', bm_lathe([(0.05, -0.175), (0.06, -0.19), (0.06, -0.205), (0.045, -0.215)], 16, T(hx0, hy0, hz0)), 'dark', 'head', sharp=50)
for k in range(4):
    store(nm('cage'), bm_torus(0.085, 0.004, 16, 4, T(hx0, hy0 - 0.25, hz0) @ R('Y', k * PI / 4) @ R('X', PI / 2)), 'steel', 'head', wn=False)
store('cagering', bm_torus(0.086, 0.005, 18, 4, T(hx0, hy0 - 0.25, hz0)), 'steel', 'head', wn=False)
for k in range(4):
    z = Z0 + 0.15 + k * 0.03
    store(nm('hrib'), bm_sweep([(hx0 - 0.17, hy0 - 0.15, z), (hx0, hy0 - 0.17, z + 0.01), (hx0 + 0.17, hy0 - 0.15, z)], [0.004] * 3, 6, 4), 'dark', 'head', sharp=60, wn=False)
store('hplate', bm_box(0.004, 0.04, 0.08, T(hx0 - 0.2, hy0 - 0.06, hz0 + 0.0)), 'brass', 'head', bevel=0.0015, seg=1)

# ---------------------------------------------------------------- LEGS (three, modelled straight down in their mounts' frames): hip ball, tapered thigh with a leaf guard, knee ball and cap, shin with a guard, a clawed pad foot
for k, m in enumerate(MNT):
    hg, kg, mg = 'hip%d' % k, 'knee%d' % k, 'mount%d' % k
    x, z = m[0], m[2]
    ky = HY - 0.5
    ball(hg, (x, HY, z), 0.055, 'dark')
    store(nm('thigh'), bm_sweep([(x, HY - 0.03, z), (x, HY - 0.25, z - 0.006), (x, ky + 0.04, z)], [0.045, 0.047, 0.035], 12, 4), 'dark', hg, sharp=50)
    th = Shell([HY - 0.05, HY - 0.18, HY - 0.36, ky + 0.06], W=[0.09, 0.12, 0.11, 0.08], D=[0.09, 0.12, 0.11, 0.08], Zc=[z, z - 0.008, z - 0.006, z], p=2.1, X=[x, x, x, x])
    store(nm('tguard'), th.panel(HY - 0.06, ky + 0.07, PI - 1.2, PI + 1.2, 0.008, 0.0, 7, 10, taper=0.5), 'paint2' if k == 1 else 'paint', hg, bevel=0.002, seg=1, sharp=40)
    bolt(hg, th.pt(HY - 0.25, PI, 0.008), tuple(th.normal(HY - 0.25, PI)), 0.005)
    hose(hg, [(x + 0.04, HY - 0.04, z + 0.03), (x + 0.05, HY - 0.25, z + 0.04), (x + 0.04, ky + 0.05, z + 0.03)], 0.008)
    ball(kg, (x, ky, z), 0.045, 'dark')
    store(nm('kcap'), bm_ellipsoid((x, ky + 0.005, z - 0.03), 0.048, 0.055, 0.032, 14, 6, y0=-0.6, y1=1.0), 'paint', kg, sharp=40, bevel=0.002, seg=1)
    store(nm('shin'), bm_sweep([(x, ky - 0.03, z), (x, ky - 0.25, z - 0.006), (x, ky - 0.5, z)], [0.038, 0.036, 0.028], 12, 4), 'dark', kg, sharp=50)
    sh = Shell([ky - 0.05, ky - 0.18, ky - 0.36, ky - 0.47], W=[0.08, 0.1, 0.095, 0.07], D=[0.08, 0.1, 0.095, 0.07], Zc=[z, z - 0.008, z - 0.006, z], p=2.1, X=[x, x, x, x])
    store(nm('sguard'), sh.panel(ky - 0.06, ky - 0.46, PI - 1.2, PI + 1.2, 0.007, 0.0, 7, 10, taper=0.45), 'paint', kg, bevel=0.002, seg=1, sharp=40)
    hose(kg, [(x - 0.035, ky - 0.05, z + 0.03), (x - 0.04, ky - 0.25, z + 0.035), (x - 0.03, ky - 0.47, z + 0.03)], 0.007)
    for yy in (ky - 0.15, ky - 0.35):
        store(nm('band'), bm_torus(0.04, 0.005, 12, 4, T(x, yy, z)), 'steel', kg, wn=False)
    fy = ky - 0.535
    store(nm('pad'), bm_ellipsoid((x, fy + 0.02, z - 0.03), 0.06, 0.035, 0.09, 16, 6, y0=-0.5, y1=1.0), 'paint', kg, sharp=40, bevel=0.002, seg=1)
    store(nm('psole'), bm_ellipsoid((x, fy + 0.005, z - 0.03), 0.062, 0.012, 0.092, 16, 3, y0=-1.0, y1=0.2), 'rubber', kg, sharp=50)
    for t, ang in enumerate((-0.4, 0.0, 0.4)):
        d = Vector((math.sin(ang), 0, -math.cos(ang)))
        p0 = Vector((x, fy + 0.02, z - 0.08))
        store(nm('claw'), bm_sweep([tuple(p0), tuple(p0 + d * 0.05 + Vector((0, -0.01, 0))), tuple(p0 + d * 0.08 + Vector((0, -0.03, 0)))], [0.012, 0.008, 0.002], 6, 3, ell=(1.2, 0.8), up=(0, 1, 0)), 'steel', kg, sharp=50)
    store(nm('ankle'), bm_ellipsoid((x, fy + 0.05, z), 0.03, 0.03, 0.03, 12, 6), 'steel', kg, sharp=60)
    ram('hip%d' % k, mg, hg, (x, HY - 0.006, z + 0.108), (x, HY - 0.25, z + 0.072), 0.018)
    ram('knee%d' % k, hg, kg, (x, HY - 0.2, z + 0.081), (x, ky - 0.18, z + 0.075), 0.0156)

# ---------------------------------------------------------------- WEAR AND GROWTH (Walker v2 standard): soot over everything near the lamp, mud on the feet, moss on the hub and roof
random.seed(101)
for k, m in enumerate(MNT):
    x, z = m[0], m[2]
    kg, hg = 'knee%d' % k, 'hip%d' % k
    ky = HY - 0.5
    fy = ky - 0.535
    sp = [((x + random.uniform(-0.06, 0.06), fy + random.uniform(0.0, 0.03), z - 0.03 + random.uniform(-0.09, 0.09)), random.uniform(0.012, 0.02), (random.uniform(-1, 1), 0.5, random.uniform(-1, 1))) for j in range(9)]
    sp += [((x + random.uniform(-0.02, 0.02), random.uniform(fy + 0.07, fy + 0.25), z - 0.032), random.uniform(0.008, 0.012), (0, 0, -1)) for j in range(5)]
    G.mud(kg, sp)
    G.leaves(kg, [(x + random.uniform(-0.04, 0.04), fy + 0.055, z + random.uniform(-0.08, 0.02))], 0.045)
    G.moss(kg, [((x + 0.03, ky + 0.04, z), 0.016)])
    G.tufts(kg, [((x, fy + 0.03, z + 0.05), 4, 0.12, 0.04)], dry=(k == 1))
    G.oil((x, HY - 0.05, z + 0.03), 0.02, 0.4)
    G.oil((x, ky - 0.03, z + 0.03), 0.018, 0.35)
G.moss('hub', [(body.pt(HY + 0.22, a, 0.008), 0.024) for a in (0.2 * PI, 1.0 * PI, 1.6 * PI)] + [(body.pt(HY + 0.15, 0.5 * PI, -0.012), 0.018)])
G.tufts('hub', [(body.pt(HY + 0.075, 1.3 * PI, 0.01), 4, 0.1, 0.02), (body.pt(HY + 0.205, 0.2 * PI, 0.01), 4, 0.09, 0.02), (body.pt(HY + 0.09, 0.5 * PI, -0.015), 5, 0.11, 0.03)])
G.tufts('hub', [((0.0, HY + 0.27, 0.0), 6, 0.14, 0.08)], dry=True)
G.leaves('hub', [tuple(Vector(body.pt(HY + 0.24, a, 0.006))) for a in (0.4 * PI, 1.2 * PI, 1.8 * PI)], 0.05)
G.moss('head', [((hx0 + 0.05, hy0 + 0.25, hz0 + 0.02), 0.025)])
G.leaves('head', [(hx0 - 0.1, hy0 + 0.2, hz0 + 0.06), (hx0 + 0.08, hy0 + 0.21, hz0 - 0.05)], 0.05)
G.moss('arm0', [((0.0, by + 0.06, -0.2), 0.02)])
G.dent(body.pt(HY + 0.14, 1.5 * PI + 0.15), tuple(body.normal(HY + 0.14, 1.5 * PI + 0.15)), 0.045, 0.008)
G.dent((hx0 + 0.195, hy0 + 0.05, Z0 + 0.12), (1, 0, 0), 0.05, 0.008)
G.dent(tuple(HM @ Vector((0.13, 0.12, 0.0))), (1, 0.2, 0), 0.04, 0.006)
G.soot((hx0, hy0 - 0.2, hz0), 0.12, 0.45)
G.soot((hx0, hy0 + 0.1, Z0 + 0.25), 0.06, 0.2)
G.soot(body.pt(HY + 0.13, PI, 0.01), 0.05, 0.2)
G.oil((0, by - 0.02, -0.58), 0.02, 0.3)
G.oil((0, HY + 1.3, -0.05), 0.02, 0.4)

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
