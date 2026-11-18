# One Tick (a street-sweeping unit; the game shows three of them per Gloom at their own scales) as a desktop model, built in Blender headless.
# NOT boxy (owner, Nov 16): a rounded pebble shell of curved panels over a dark core, a curved rubber bumper, rounded wheel arches, a bristle skirt,
# curved side brushes, a rounded screen pod on a hinge, a curved carry handle; dirty to the Walker v2 standard.
# Usage: python3 tools/gloomglb/ticks_model.py <out.blend>
# Nodes as in ticks() in src/gloomhi.js, for ONE unit at scale 1 (the game copies it three times and scales each):
# body (0, 0.16, 0) and sg (the screen group, body + (0, 0.2, -0.17), modelled UNtilted: the game sets sg.rotation.x = -0.35).
# Empty 'screen' at sg + (0, 0, -0.02), where the game puts the display (0.2 x 0.13, round corners).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from bl_lib import *
from organic_lib import *
import grime_lib as G
from grime_lib import save_marks

random.seed(31)
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ticks.blend'

BY = 0.16
SG = (0, BY + 0.2, -0.17)
group('body', (0, BY, 0))
group('sg', SG, 'body')
Z0 = SG[2] - 0.02
empty('screen', (0, SG[1], Z0), GROUPS['sg'][0])
N = [0]


def nm(s):
    N[0] += 1
    return '%s_%03d' % (s, N[0])


def bolt(grp, p, n, r=0.006, cls='bolt'):
    M = T(*p) @ aim_y(n)
    return store(nm('bolt'), bm_lathe([(r, r * 0.2), (r, r * 0.7), (r * 0.6, r * 0.95), (0, r * 1.05)], 8, M, cap0=False, phase=random.random()), cls, grp, sharp=50, wn=False)


def lamp(grp, c, n, r=0.02):
    M = T(*c) @ aim_y(n)
    store(nm('lamph'), bm_lathe([(r * 1.4, -0.016), (r * 1.45, -0.004), (r * 1.3, 0.004), (r * 1.0, 0.008), (r * 0.98, 0.002)], 16, M, cap0=True, cap1=False), 'dark', grp, bevel=0.0015, seg=1)
    store(nm('lens'), bm_lathe([(r * 0.99, 0.002), (r * 0.8, 0.008), (r * 0.4, 0.011), (0, 0.012)], 16, M), 'lens', grp, sharp=60, wn=False)


# ---------------------------------------------------------------- SHELL: a rounded pebble of curved panels over a dark core
ys = [0.115, 0.15, 0.2, 0.26, 0.31, 0.35, 0.385, 0.405, 0.418]
shell = Shell(ys, W=[0.43, 0.455, 0.465, 0.455, 0.42, 0.37, 0.29, 0.19, 0.06], D=[0.49, 0.515, 0.525, 0.51, 0.47, 0.41, 0.32, 0.21, 0.07],
              Zc=[0.0, 0.0, 0.0, 0.005, 0.012, 0.02, 0.03, 0.035, 0.035], p=2.7)
store('core', shell.solid(0.12, 0.41, 10, 28, off=-0.022), 'core', 'body', sharp=60)
GAP = 0.02
# lower band: front and back halves; upper dome: left and right halves meeting at a raised centre seam; a rear hatch on the dome is gone
store('band_f', shell.panel(0.12, 0.205, PI / 2 + GAP, 1.5 * PI - GAP, 0.011, -0.01, 4, 16), 'paint', 'body', bevel=0.003, seg=1, sharp=40)
store('band_b', shell.panel(0.12, 0.205, -PI / 2 + GAP, PI / 2 - GAP, 0.011, -0.01, 4, 16), 'paint', 'body', bevel=0.003, seg=1, sharp=40)
HA0, HA1 = -0.55, 0.55
store('dome_l', shell.panel(0.212, 0.414, PI + GAP * 0.5, 2 * PI + HA0 - GAP, 0.012, -0.01, 9, 14), 'paint', 'body', bevel=0.003, seg=1, sharp=40)
store('dome_r', shell.panel(0.212, 0.414, HA1 + GAP, PI - GAP * 0.5, 0.012, -0.01, 9, 14), 'paint2', 'body', bevel=0.003, seg=1, sharp=40)
store('dome_lo', shell.panel(0.212, 0.29, HA0, HA1, 0.012, -0.01, 4, 8), 'paint', 'body', bevel=0.003, seg=2, sharp=40)
store('dome_tip', shell.panel(0.375, 0.414, HA0, HA1, 0.012, -0.01, 3, 8), 'paint', 'body', bevel=0.002, seg=1, sharp=40)
# inside the missing hatch: two ribs, wires, a small board
for y in (0.31, 0.345):
    store(nm('rib'), bm_sweep([shell.pt(y, HA0 + (HA1 - HA0) * j / 6, -0.016) for j in range(7)], [0.005] * 7, 6, 2), 'steel', 'body', sharp=60, wn=False)
for j, (c_, a_) in enumerate((('wire_r', -0.25), ('wire_y', 0.05), ('rubber', 0.3))):
    store(nm('wire'), bm_sweep([shell.pt(0.36, a_, -0.018), shell.pt(0.33, a_ + 0.12, -0.004 + 0.004 * j), shell.pt(0.3, a_ - 0.05, -0.018)], [0.005] * 3, 6, 5), c_, 'body', sharp=80, wn=False)
store('board', bm_box(0.07, 0.004, 0.05, T(*shell.pt(0.32, 0.0, -0.02)) @ R('X', 0.6)), 'tag', 'body')
store(nm('wire'), bm_sweep([shell.pt(0.3, 0.2, -0.01), shell.pt(0.27, 0.35, 0.03), shell.pt(0.2, 0.42, 0.05)], [0.004] * 3, 6, 5), 'wire_r', 'body', sharp=80, wn=False)
# rivets along the band joint
for k in range(14):
    a = 2 * PI * k / 14 + 0.08
    bolt('body', shell.pt(0.196, a, 0.002), tuple(shell.normal(0.196, a)), 0.0048)
# curved rubber bumper round the front half, curved louvres on the rear dome, two charging strips, lamps
store('bumper', shell.panel(0.122, 0.172, PI - 1.45, PI + 1.45, 0.02, 0.002, 3, 18), 'rubber', 'body', bevel=0.006, seg=2, sharp=40)
for k in range(4):
    y = 0.228 + k * 0.019
    store(nm('louvre'), bm_sweep([shell.pt(y, -0.5 + j / 8.0, 0.003) for j in range(9)], [0.0035] * 9, 4, 2, ell=(1, 2.0)), 'steel', 'body', sharp=60, wn=False)
for sx in (-0.05, 0.05):
    store(nm('strip'), bm_box(0.026, 0.045, 0.004, T(*shell.pt(0.16, -sx * 2.0, 0.003))), 'chrome', 'body', bevel=0.001, seg=1)
for sx in (-1, 1):
    a = PI + sx * 0.42
    lamp('body', shell.pt(0.235, a, 0.004), tuple(shell.normal(0.235, a)), 0.02)

# ---------------------------------------------------------------- UNDERSIDE: base pan, bristle skirt, four wheels under rounded arches, side brushes
store('pan', bm_lathe([(0.23, 0.06), (0.25, 0.08), (0.25, 0.115), (0.2, 0.12)], 28, I4), 'dark', 'body', sharp=50)
bri = []
for k in range(20):
    a = 2 * PI * k / 20
    c = Vector((math.sin(a) * 0.235, 0.075, math.cos(a) * 0.255))
    for j in range(3):
        d = Vector((math.sin(a + (j - 1) * 0.12) * 0.5, -1.0, math.cos(a + (j - 1) * 0.12) * 0.5)).normalized()
        bri.append(bm_lathe([(0.006, 0.0), (0.0015, 0.065)], 4, T(*c) @ aim_y(d)))
store('bristles', bm_join(bri), 'core', 'body', sharp=80, wn=False)
for (wx, wz) in ((-0.2, -0.18), (0.2, -0.18), (-0.2, 0.18), (0.2, 0.18)):
    sx = 1 if wx > 0 else -1
    M = T(wx, 0.075, wz) @ R('Z', -sx * PI / 2)
    store(nm('tyre'), bm_lathe([(0.038, -0.025), (0.055, -0.024), (0.062, -0.015), (0.063, 0.0), (0.062, 0.015), (0.055, 0.024), (0.038, 0.025)], 18, M, closed=False), 'rubber', 'body', sharp=50)
    store(nm('hub'), bm_lathe([(0.036, -0.022), (0.036, 0.022), (0.026, 0.028), (0.012, 0.031), (0, 0.032)], 14, M), 'steel', 'body', sharp=50)
    # a rounded arch over the top of the wheel
    arch = [(wx + sx * 0.005, 0.075 + math.cos(t) * 0.078, wz + math.sin(t) * 0.078) for t in [(-1.3 + 2.6 * j / 8) for j in range(9)]]
    store(nm('arch'), bm_sweep(arch, [0.012] * 9, 6, 2, ell=(0.7, 2.6), up=(1, 0, 0)), 'paint', 'body', sharp=50)
for sx in (-1, 1):
    c = Vector((sx * 0.21, 0.035, -0.24))
    store(nm('bhub'), bm_lathe([(0.03, 0.0), (0.03, 0.014), (0.02, 0.022), (0, 0.024)], 14, T(*c)), 'dark', 'body', sharp=50)
    arms = []
    for k in range(8):
        a = k * PI / 4 + 0.2
        p0 = c + Vector((math.sin(a) * 0.025, 0.004, math.cos(a) * 0.025))
        p1 = c + Vector((math.sin(a + 0.25) * 0.065, -0.012, math.cos(a + 0.25) * 0.065))
        p2 = c + Vector((math.sin(a + 0.5) * 0.095, -0.03, math.cos(a + 0.5) * 0.095))
        arms.append(bm_sweep([tuple(p0), tuple(p1), tuple(p2)], [0.004, 0.003, 0.0012], 4, 3))
    store(nm('brush'), bm_join(arms), 'wire_y', 'body', sharp=80, wn=False)

# ---------------------------------------------------------------- TOP: a curved carry handle on rubber feet, a whisker antenna, a vent cap
hp = [(-0.085, shell.pt(0.385, 0.0)[1], 0.06), (-0.07, 0.445, 0.065), (0.0, 0.462, 0.07), (0.07, 0.445, 0.065), (0.085, shell.pt(0.385, 0.0)[1], 0.06)]
store('handle', bm_sweep(hp, [0.009] * 5, 10, 5), 'steel', 'body', sharp=60)
store('grip', bm_sweep([(-0.045, 0.457, 0.068), (0.0, 0.466, 0.07), (0.045, 0.457, 0.068)], [0.013, 0.014, 0.013], 10, 4, rib=(0.012, 0.18)), 'rubber', 'body', sharp=80)
for sx in (-1, 1):
    store(nm('foot'), bm_ellipsoid((sx * 0.085, 0.395, 0.06), 0.02, 0.012, 0.02, 12, 6, y0=-0.3, y1=1.0), 'rubber', 'body', sharp=60)
store('whisker', bm_sweep([(0.13, 0.37, 0.12), (0.15, 0.48, 0.16), (0.19, 0.58, 0.22)], [0.004, 0.0028, 0.0015], 6, 6), 'steel', 'body', sharp=60, wn=False)
store('wbase', bm_ellipsoid((0.13, 0.372, 0.12), 0.016, 0.012, 0.016, 12, 6, y0=-0.2, y1=1.0), 'dark', 'body', sharp=60)

# ---------------------------------------------------------------- SCREEN POD (group sg): rounded housing, the round-cornered screen in its well, bezel, brow, hinge
sx0, sy0 = SG[0], SG[1]


def pod_ring(z, w, h, p=3.2, n=36):
    return [(sx0 + superellipse(2 * PI * k / n, p)[0] * w / 2, sy0 + superellipse(2 * PI * k / n, p)[1] * h / 2, z) for k in range(n)]


rings = [pod_ring(Z0 + 0.028, 0.205, 0.135), pod_ring(Z0 - 0.002, 0.212, 0.142), pod_ring(Z0 - 0.016, 0.232, 0.162), pod_ring(Z0 - 0.019, 0.262, 0.19, 2.9),
         pod_ring(Z0 - 0.008, 0.28, 0.205, 2.8), pod_ring(Z0 + 0.03, 0.285, 0.21, 2.7), pod_ring(Z0 + 0.065, 0.25, 0.18, 2.5), pod_ring(Z0 + 0.08, 0.14, 0.1, 2.3)]
store('pod', bm_loft(rings), 'paint', 'sg', sharp=35, bevel=0.002, seg=1)
store('well', bm_box(0.215, 0.145, 0.004, T(sx0, sy0, Z0 + 0.026)), 'core', 'sg')
bz = pod_ring(Z0 - 0.017, 0.222, 0.152, 3.2, 36)
store('bezel', bm_sweep(bz + bz[:3], [0.0055] * 39, 6, 1), 'steel', 'sg', sharp=60, wn=False)
for k in range(4):
    a = PI / 4 + k * PI / 2
    q = superellipse(a, 3.2)
    bolt('sg', (sx0 + q[0] * 0.128, sy0 + q[1] * 0.093, Z0 - 0.017), (0, 0, -1), 0.0042)
store('brow', bm_sweep([(sx0 - 0.12, sy0 + 0.098, Z0 - 0.008), (sx0, sy0 + 0.11, Z0 - 0.026), (sx0 + 0.12, sy0 + 0.098, Z0 - 0.008)], [0.006, 0.01, 0.006], 10, 6, ell=(2.0, 0.6), up=(0, 1, 0)), 'paint', 'sg', sharp=50)
store('hinge', bm_sweep([(sx0 - 0.09, sy0 - 0.095, Z0 + 0.04), (sx0 + 0.09, sy0 - 0.095, Z0 + 0.04)], [0.016, 0.016], 12, 2), 'dark', 'sg', sharp=50)
for sx in (-1, 1):
    store(nm('hcap'), bm_ellipsoid((sx0 + sx * 0.095, sy0 - 0.095, Z0 + 0.04), 0.008, 0.02, 0.02, 12, 6), 'steel', 'sg', sharp=60)
store('mount', bm_ellipsoid((0, SG[1] - 0.02, SG[2] + 0.05), 0.11, 0.035, 0.07, 16, 6, y0=-1.0, y1=0.4), 'dark', 'body', sharp=50)

# ---------------------------------------------------------------- WEAR AND GROWTH (Walker v2 standard): mud on the wheels, bumper and skirt, dead leaves and moss on the dome,
# weeds caught in the bristles and wheel arches, dents in the dome and band, oil from the wheel hubs, soot over the rear vent
random.seed(95)
sp = []
for k in range(26):
    a = 2 * PI * k / 26 + random.uniform(-0.1, 0.1)
    p = shell.pt(random.uniform(0.118, 0.15), a, 0.004)
    sp.append((p, random.uniform(0.012, 0.022), tuple(shell.normal(0.13, a))))
for (wx, wz) in ((-0.2, -0.18), (0.2, -0.18), (-0.2, 0.18), (0.2, 0.18)):
    sx = 1 if wx > 0 else -1
    for k in range(3):
        t = random.uniform(-1.2, 1.2)
        sp.append(((wx + sx * 0.03, 0.075 + math.cos(t) * 0.062, wz + math.sin(t) * 0.062), random.uniform(0.01, 0.016), (sx, 0.2, 0)))
G.mud('body', sp)
G.leaves('body', [tuple(Vector(shell.pt(random.uniform(0.33, 0.405), random.uniform(0, 2 * PI), 0.004))) for k in range(6)] + [(random.uniform(-0.1, 0.1), 0.21, random.uniform(-0.25, -0.22)) for k in range(2)], 0.05)
G.moss('body', [(shell.pt(0.37, 1.2 * PI, 0.006), 0.022), (shell.pt(0.2, 0.7 * PI, 0.008), 0.016), (shell.pt(0.2, 1.6 * PI, 0.008), 0.016), (shell.pt(0.395, 0.6 * PI, 0.004), 0.018)])
G.tufts('body', [((0.22, 0.04, 0.05), 4, 0.09, 0.03), ((-0.2, 0.03, -0.06), 5, 0.1, 0.03), ((0.0, 0.05, 0.25), 4, 0.08, 0.04)], dry=False)
G.tufts('body', [((-0.21, 0.13, 0.18), 3, 0.08, 0.02), ((0.05, 0.06, -0.25), 3, 0.07, 0.03)], dry=True)
G.moss('sg', [((sx0 + 0.06, sy0 + 0.105, Z0 + 0.03), 0.016)])
G.leaves('sg', [(sx0 - 0.05, sy0 + 0.108, Z0 + 0.04)], 0.045)
G.dent(shell.pt(0.33, 1.3 * PI), tuple(shell.normal(0.33, 1.3 * PI)), 0.05, 0.008)
G.dent(shell.pt(0.3, 0.75 * PI), tuple(shell.normal(0.3, 0.75 * PI)), 0.045, 0.007, classes=('paint', 'paint2'))
G.dent(shell.pt(0.165, 0.3), tuple(shell.normal(0.165, 0.3)), 0.04, 0.006)
G.dent((sx0 + 0.11, sy0 + 0.04, Z0 + 0.035), (1, 0, 0), 0.035, 0.005)
for (wx, wz) in ((-0.2, -0.18), (0.2, -0.18), (-0.2, 0.18), (0.2, 0.18)):
    G.oil((wx * 0.88, 0.1, wz), 0.02, 0.15)
G.oil(shell.pt(0.37, 0.0, 0.0), 0.02, 0.3)
G.soot(shell.pt(0.25, 0.0, 0.01), 0.05, 0.16)
G.soot(shell.pt(0.31, 0.0, 0.0), 0.04, 0.12)

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
print(sorted(kinds.items(), key=lambda q: -q[1])[:16])
