# THE BECKONER: the final-night boss (owner, Nov 17 16:39), a giant ruined beckoning-cat machine, the old Grid Co. shopfront mascot. Built in Blender headless.
# Modelled at QUARTER scale (2.4 m tall here); the game scales it x4 (about 9.6 m seated). Quarter scale keeps the painter's bolts, runs and chips at the sizes the other
# Gloom kinds were tuned at, which reads right from the 20-30 m the player sees it from.
# Look: OWNER (Nov 17 16:48, 'i want it to be cat like'): the classic seated beckoning-cat silhouette, a big round head on a rounded body, upright ears (one torn to its
# frame), a muzzle with whisker rods, a curled tail, front paws with toe pads, collar, bell and bib; all of it real mechanical parts (advisor review: a hanging jaw plate, a Gloom screen face (drawn in the game on the 'screen' empty), a bell collar with a glowing bell, a coin-core behind two shutters in the chest.
# The slam arm is a TELESCOPING boom (four sleeves) so its reach to the house is believable. Faded cream paint, dull oxide red trim (paint2), no bright red, gold or white.
# Usage: python3 tools/gloomglb/boss_model.py <out.blend>
# Nodes (the game, src/bosshi.js, poses them): base, body, head, jaw, eyeL, eyeR, bell, coin, coreDoorL, coreDoorR,
#   beckonArm (shoulder) > beckonFore (elbow) > beckonPaw (wrist) > beckonCore;  slamArm (shoulder) > slamFore (boom root) > slamS1 > slamS2 > slamS3 > slamS4 > slamPaw > slamCore;
#   plate0..plate9 (breakable plates). Bind pose: both arms hang straight down, palms facing -z. Empty 'screen' at the face (display 0.38 x 0.26 here).
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

# ---------------------------------------------------------------- pivots (quarter scale, game axes, front = -z)
SEAT = 0.2
ARMX, ARMY, ARMZ = 0.38, 1.15, -0.06
L1B, L2B = 0.3, 0.26      # beckon arm: upper arm, forearm
L1S = 0.22                # slam arm: upper arm (the boom does the reaching)
HD = (0.0, 1.32, -0.05)   # neck pivot (head node)
group('base', (0, 0, 0))
group('body', (0, SEAT, 0), 'base')
group('head', HD, 'body')
group('jaw', (0, 1.42, -0.44), 'head')
group('bell', (0, 1.26, -0.24), 'body')
group('coin', (0, 0.86, -0.28), 'body')
group('coreDoorL', (-0.17, 0.86, -0.28), 'body')
group('coreDoorR', (0.17, 0.86, -0.28), 'body')
sx = -1
group('beckonArm', (sx * ARMX, ARMY, ARMZ), 'body')
group('beckonFore', (sx * ARMX, ARMY - L1B, ARMZ), 'beckonArm')
group('beckonPaw', (sx * ARMX, ARMY - L1B - L2B, ARMZ), 'beckonFore')
group('beckonCore', (sx * ARMX, ARMY - L1B - L2B - 0.15, ARMZ - 0.065), 'beckonPaw')
sx = 1
SY1 = ARMY - L1S
group('slamArm', (sx * ARMX, ARMY, ARMZ), 'body')
group('slamFore', (sx * ARMX, SY1, ARMZ), 'slamArm')
SL = 0.12  # each sleeve's visible length when collapsed
for k in range(1, 5):
    group('slamS%d' % k, (sx * ARMX, SY1 - 0.16 - SL * (k - 1), ARMZ), 'slamFore' if k == 1 else 'slamS%d' % (k - 1))
PWY = SY1 - 0.16 - SL * 4
group('slamPaw', (sx * ARMX, PWY, ARMZ), 'slamS4')
group('slamCore', (sx * ARMX, PWY - 0.12, ARMZ - 0.16), 'slamPaw')
SZ0 = -0.425
empty('screen', (0, 1.69, SZ0 + 0.012), GROUPS['head'][0])
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


def rivets(grp, shell, y, a0, a1, n, off, r=0.008):
    for k in range(n):
        a = a0 + (a1 - a0) * (k + 0.5) / n
        bolt(grp, shell.pt(y, a, off), tuple(shell.normal(y, a)), r)


# ---------------------------------------------------------------- BASE: the old shopfront plinth on rusted rollers, folded haunches, front feet, a segmented tail
store('plinth', bm_lathe([(0.6, 0.0), (0.6, 0.03), (0.58, 0.035), (0.58, 0.15), (0.6, 0.155), (0.6, 0.18), (0.57, 0.2), (0.0, 0.2)], 8, phase=PI / 8), 'paint2', 'base', bevel=0.004, seg=1, sharp=30)
store('plinthcore', bm_lathe([(0.52, -0.005), (0.52, 0.03)], 8, phase=PI / 8), 'dark', 'base', sharp=30)
for k in range(8):
    a = PI / 8 + 2 * PI * k / 8
    for t in (-0.32, 0.32):
        c = (0.6 * math.cos(PI / 8) * math.sin(a + t * PI / 8 * 0.0) , 0, 0)
    # fascia bolts along each face, top and bottom
    for f in (-0.35, 0.0, 0.35):
        aa = 2 * PI * k / 8 + PI / 8 + PI / 8
        mid = Vector((0.58 * math.sin(2 * PI * k / 8 + PI / 8), 0, 0.58 * math.cos(2 * PI * k / 8 + PI / 8)))
        nxt = Vector((0.58 * math.sin(2 * PI * (k + 1) / 8 + PI / 8), 0, 0.58 * math.cos(2 * PI * (k + 1) / 8 + PI / 8)))
        p = mid.lerp(nxt, 0.5 + f)
        nrm = (mid.lerp(nxt, 0.5)).normalized()
        for y in (0.045, 0.14):
            bolt('base', (p.x * 1.005, y, p.z * 1.005), tuple(nrm), 0.008)
# rollers peeping out under the skirt
for k in range(6):
    a = 2 * PI * k / 6 + 0.3
    c = (0.5 * math.sin(a), 0.035, 0.5 * math.cos(a))
    M = T(*c) @ R('Y', a) @ R('Z', PI / 2)
    store(nm('roller'), bm_lathe([(0.0, -0.025), (0.034, -0.025), (0.04, -0.018), (0.04, 0.018), (0.034, 0.025), (0.0, 0.025)], 14, M), 'rubber', 'base', sharp=50)
# brass name plaque on the front face (the painter writes GRID CO. on it)
store('plaque', bm_box(0.26, 0.07, 0.008, T(0, 0.095, -0.565)), 'brass', 'base', bevel=0.003, seg=1)
for s in (-1, 1):
    bolt('base', (s * 0.115, 0.095, -0.571), (0, 0, -1), 0.006)
# haunches: folded hind legs, curved plates over a dark frame with a knee clevis
for s in (-1, 1):
    hx = s * 0.3
    hs = Shell([SEAT + 0.005, SEAT + 0.12, SEAT + 0.26, SEAT + 0.36], W=[0.26, 0.3, 0.26, 0.14], D=[0.5, 0.56, 0.5, 0.3], Zc=[-0.02, -0.04, -0.03, 0.0], p=2.3, X=[hx] * 4)
    store(nm('hcore'), hs.solid(SEAT + 0.01, SEAT + 0.34, 6, 18, off=-0.025), 'core', 'base', sharp=60)
    for (a0, a1, cls) in ((s * 0.2, s * (PI / 2 + 0.2), 'paint'), (s * (PI / 2 + 0.26), s * (PI - 0.25), 'paint' if s < 0 else 'paint2'), (s * (PI + 0.3), s * (1.5 * PI), 'paint')):
        lo, hi = (a0, a1) if a0 < a1 else (a1, a0)
        store(nm('haunch'), hs.panel(SEAT + 0.015, SEAT + 0.33, lo, hi, 0.014, -0.012, 6, 10, taper=0.25), cls, 'base', bevel=0.004, seg=1, sharp=40)
    rivets('base', hs, SEAT + 0.2, s * 0.3 if s > 0 else -PI / 2, s * PI / 2 if s > 0 else -0.3, 5, 0.004)
    clevis('base', (hx + s * 0.11, SEAT + 0.16, 0.1), 0.06, 0.035)
    ram('base', (hx + s * 0.13, SEAT + 0.32, 0.12), (hx + s * 0.13, SEAT + 0.06, -0.12), 0.018)
    # front foot on the plinth: a heel housing and three steel toes with claws
    fx = s * 0.17
    store(nm('ankle'), bm_sweep([(fx, SEAT + 0.4, -0.2), (fx, SEAT + 0.2, -0.3), (fx, SEAT + 0.06, -0.36)], [0.05, 0.045, 0.05], 12, 4), 'dark', 'base', sharp=50)
    fs = Shell([SEAT + 0.005, SEAT + 0.05, SEAT + 0.1], W=[0.17, 0.18, 0.12], D=[0.18, 0.19, 0.12], Zc=[-0.44, -0.44, -0.42], p=2.2, X=[fx] * 3)
    store(nm('foot'), fs.panel(SEAT + 0.005, SEAT + 0.1, PI / 2 - 0.2, 1.5 * PI + 0.2, 0.012, 0.0, 5, 12), 'paint', 'base', bevel=0.004, seg=1, sharp=40)
    for k in (-1, 0, 1):
        tx = fx + k * 0.05
        store(nm('toe'), bm_sweep([(tx, SEAT + 0.04, -0.47), (tx, SEAT + 0.035, -0.53), (tx, SEAT + 0.012, -0.56)], [0.024, 0.022, 0.016], 10, 3), 'steel', 'base', sharp=50)
        store(nm('claw'), bm_sweep([(tx, SEAT + 0.03, -0.56), (tx, SEAT + 0.012, -0.585), (tx, SEAT - 0.004, -0.592)], [0.01, 0.007, 0.002], 6, 3), 'dark', 'base', sharp=50)
# the tail: a segmented conduit that curls up behind the body on the right
tp = [(0.05, SEAT + 0.1, 0.3), (0.3, SEAT + 0.05, 0.38), (0.5, SEAT + 0.12, 0.22), (0.52, SEAT + 0.38, 0.22), (0.42, SEAT + 0.56, 0.34), (0.3, SEAT + 0.6, 0.44)]
store('tail', bm_sweep(tp, [0.07, 0.065, 0.06, 0.055, 0.05, 0.04], 12, 8, rib=(0.045, 0.22)), 'dark', 'base', sharp=60)
for k, f in enumerate((0.15, 0.35, 0.55, 0.75)):
    Q, U = spline(tp, 8)
    i = int(f * (len(Q) - 1))
    d = (Q[min(i + 1, len(Q) - 1)] - Q[max(i - 1, 0)]).normalized()
    r = 0.062 - 0.03 * f
    store(nm('tring'), bm_lathe([(r, -0.012), (r * 1.08, -0.006), (r * 1.08, 0.006), (r, 0.012)], 14, T(*Q[i]) @ aim_y(d)), 'paint' if k % 2 else 'steel', 'base', sharp=40)

# ---------------------------------------------------------------- BODY: a tall, narrow, hunched torso of curved plates; one back panel gone (ribs, wiring); collar, bib
ys = [SEAT, 0.36, 0.58, 0.82, 1.04, 1.22, 1.33]
body = Shell(ys, W=[0.66, 0.74, 0.74, 0.68, 0.58, 0.46, 0.36], D=[0.58, 0.64, 0.62, 0.56, 0.48, 0.38, 0.28], Zc=[0.02, 0.02, 0.0, -0.02, -0.04, -0.05, -0.05], p=2.3)
store('bcore', body.solid(SEAT + 0.01, 1.32, 12, 32, off=-0.04), 'core', 'body', sharp=60)
GA = 0.022
yb = [SEAT + 0.005, 0.46, 0.475, 0.70, 0.715, 1.0, 1.015, 1.32]
HOLE = (0.25 * PI, 0.62 * PI)     # the missing plate (machine's left back) in the second band
COIN = (PI - 0.62, PI + 0.62)     # the coin housing in the chest (third band, y yb[4]..yb[5])
BELLY = (PI - 0.5, PI + 0.5)      # the two breakable belly plates (second band)
bands = [(yb[0], yb[1], [(0, 0.5 * PI, 'paint', 0.016), (0.5 * PI, PI, 'paint', 0.022), (PI, 1.5 * PI, 'paint', 0.018), (1.5 * PI, 2 * PI, 'paint2', 0.02)]),
         (yb[2], yb[3], [(BELLY[1], 1.5 * PI, 'paint', 0.02), (1.5 * PI, 2.25 * PI, 'paint', 0.016), (HOLE[1], BELLY[0], 'paint', 0.018)]),
         (yb[4], yb[5], [(COIN[1], 1.5 * PI, 'paint', 0.02), (1.5 * PI, 2 * PI, 'paint', 0.024), (0, 0.5 * PI, 'paint', 0.02), (0.5 * PI, COIN[0], 'paint', 0.016)]),
         (yb[6], yb[7], [(0, PI, 'paint', 0.018), (PI, 2 * PI, 'paint', 0.016)])]
for (y0, y1, segs) in bands:
    for (a0, a1, cls, th) in segs:
        store(nm('bpan'), body.panel(y0, y1, a0 + GA, a1 - GA, th, -0.014, 6, 12), cls, 'body', bevel=0.004, seg=1, sharp=40)
        for y in (y0 + 0.02, y1 - 0.02):
            rivets('body', body, y, a0 + GA, a1 - GA, max(3, int((a1 - a0) * 4)), th - 0.006)
# belly plates (breakable: plate8, plate9)
for i, s in enumerate((-1, 1)):
    a0, a1 = (BELLY[0] + GA, PI - GA) if s < 0 else (PI + GA, BELLY[1] - GA)
    pg = 'plate%d' % (8 + i)
    c = body.pt((yb[2] + yb[3]) / 2, (a0 + a1) / 2, 0.02)
    group(pg, c, 'body')
    store(nm('chest'), body.panel(yb[2] + 0.01, yb[3] - 0.01, a0, a1, 0.018, -0.008, 6, 8), 'paint', pg, bevel=0.004, seg=1, sharp=40)
    for y in (yb[2] + 0.04, yb[3] - 0.04):
        rivets(pg, body, y, a0 + 0.04, a1 - 0.04, 3, 0.012)
# the missing back plate: hoops, struts, wiring and a junction box show
for f in (0.2, 0.5, 0.8):
    y = yb[2] + (yb[3] - yb[2]) * f
    store(nm('rib'), bm_sweep([body.pt(y, HOLE[0] + (HOLE[1] - HOLE[0]) * j / 8, -0.012) for j in range(9)], [0.012] * 9, 6, 2), 'steel', 'body', sharp=60, wn=False)
for a_ in (HOLE[0] + 0.2, (HOLE[0] + HOLE[1]) / 2, HOLE[1] - 0.2):
    store(nm('vrib'), bm_sweep([body.pt(yb[2], a_, -0.012), body.pt(yb[3], a_, -0.012)], [0.01, 0.01], 6, 2), 'steel', 'body', sharp=60, wn=False)
for j, (c_, a_) in enumerate((('wire_r', HOLE[0] + 0.3), ('wire_y', HOLE[0] + 0.55), ('rubber', HOLE[0] + 0.8), ('wire_r', HOLE[1] - 0.25))):
    store(nm('wire'), bm_sweep([body.pt(yb[3] - 0.01, a_, -0.02), body.pt((yb[2] + yb[3]) / 2, a_ + 0.12, 0.01), body.pt(yb[2] + 0.04, a_ - 0.06, 0.03), body.pt(yb[2] - 0.06, a_ - 0.02, 0.05)], [0.011] * 4, 6, 6), c_, 'body', sharp=80, wn=False)
jb = body.pt((yb[2] + yb[3]) / 2 + 0.06, (HOLE[0] + HOLE[1]) / 2, -0.03)
store('jbox', bm_box(0.09, 0.11, 0.05, T(*jb) @ aim_y((0, 1, 0)) @ R('Y', (HOLE[0] + HOLE[1]) / 2)), 'dark', 'body', bevel=0.004, seg=1)
store('stub', body.panel(yb[3] - 0.05, yb[3], HOLE[0] + GA, HOLE[0] + 0.45, 0.02, -0.014, 3, 6), 'paint', 'body', bevel=0.003, seg=1, sharp=40)
# bands of steel straps round the body
for y in (yb[1] + 0.008, yb[3] + 0.008, yb[5] + 0.008):
    store(nm('strap'), bm_loft([[body.pt(y - 0.012, 2 * PI * k / 40, 0.016) for k in range(40)], [body.pt(y + 0.012, 2 * PI * k / 40, 0.016) for k in range(40)],
                                [body.pt(y + 0.012, 2 * PI * k / 40, 0.0) for k in range(40)], [body.pt(y - 0.012, 2 * PI * k / 40, 0.0) for k in range(40)]], closed=True), 'steel', 'body', sharp=40)
# vent grille low on the back right
for k in range(6):
    y = yb[0] + 0.12 + k * 0.035
    store(nm('vent'), bm_sweep([body.pt(y, 1.75 * PI - 0.25, 0.02), body.pt(y, 1.75 * PI + 0.25, 0.02)], [0.008, 0.008], 6, 4, ell=(1.0, 0.4)), 'dark', 'body', sharp=60, wn=False)
# the coin housing: a dark well with a copper rim; two curved shutters (coreDoorL / coreDoorR) close over it
cw = Shell([yb[4], yb[5] + 0.06], W=[0.5, 0.48], D=[0.52, 0.46], Zc=[0.01, -0.02], p=2.35)
store('coinwell', body.panel(yb[4] + 0.02, yb[5] + 0.04, COIN[0], COIN[1], 0.006, -0.05, 6, 12), 'core', 'body', sharp=50)
for (a, k) in ((COIN[0] - 0.02, 0), (COIN[1] + 0.02, 1)):
    store(nm('coinrim'), bm_sweep([body.pt(yb[4] + 0.01, a, 0.012), body.pt(yb[5] + 0.05, a, 0.012)], [0.016, 0.016], 8, 2), 'copper', 'body', sharp=50)
for y in (yb[4] + 0.01, yb[5] + 0.05):
    store(nm('coinrim'), bm_sweep([body.pt(y, COIN[0] + (COIN[1] - COIN[0]) * j / 8, 0.012) for j in range(9)], [0.014] * 9, 8, 2), 'copper', 'body', sharp=50)
for i, s in enumerate((-1, 1)):
    a0, a1 = (COIN[0] + 0.01, PI - 0.01) if s < 0 else (PI + 0.01, COIN[1] - 0.01)
    gname = 'coreDoorL' if s < 0 else 'coreDoorR'
    store(nm('shutter'), body.panel(yb[4] + 0.025, yb[5] + 0.035, a0, a1, 0.014, 0.004, 6, 8), 'paint2', gname, bevel=0.004, seg=1, sharp=40)
    for k in range(4):
        y = yb[4] + 0.06 + k * 0.07
        store(nm('slat'), bm_sweep([body.pt(y, a0 + 0.04, 0.02), body.pt(y, a1 - 0.04, 0.02)], [0.006, 0.006], 6, 3, ell=(1, 0.5)), 'steel', gname, sharp=60, wn=False)
    store(nm('dhinge'), bm_sweep([body.pt(yb[4] + 0.06, COIN[0] - 0.03 if s < 0 else COIN[1] + 0.03, 0.022), body.pt(yb[5], COIN[0] - 0.03 if s < 0 else COIN[1] + 0.03, 0.022)], [0.013, 0.013], 10, 2), 'steel', gname, sharp=50)
# the coin-core: an oval bloom-tech solar coin, copper rim, eight petal cells round a glowing heart
CC = Vector((0.0, 0.86, -0.27))
store('coinrimc', bm_lathe([(0.0, -0.02), (0.145, -0.02), (0.16, -0.01), (0.16, 0.012), (0.145, 0.02), (0.12, 0.016), (0.0, 0.016)], 28, T(*CC) @ R('X', PI / 2) @ S(1, 1, 1.22)), 'copper', 'coin', bevel=0.002, seg=1, sharp=40)
for k in range(8):
    a = 2 * PI * k / 8 + PI / 8
    pts = [CC + Vector((math.sin(a) * 0.04, math.cos(a) * 0.04 * 1.22, -0.022)), CC + Vector((math.sin(a) * 0.09, math.cos(a) * 0.09 * 1.22, -0.024)), CC + Vector((math.sin(a) * 0.13, math.cos(a) * 0.13 * 1.22, -0.022))]
    store(nm('cell'), bm_sweep(pts, [0.008, 0.026, 0.006], 8, 3, ell=(1.0, 0.25), up=(0, 0, 1)), 'core', 'coin', sharp=60, wn=False)
store('coinheart', bm_ellipsoid((CC.x, CC.y, CC.z - 0.02), 0.036, 0.044, 0.02, 16, 8), 'lens', 'coin', sharp=60, wn=False)
# collar: a dull red band round the neck base with a buckle; the bell hangs from it (glows in the game)
cy = 1.27
store('collar', bm_loft([[body.pt(cy - 0.035, 2 * PI * k / 36, 0.02) for k in range(36)], [body.pt(cy + 0.035, 2 * PI * k / 36, 0.02) for k in range(36)],
                        [body.pt(cy + 0.035, 2 * PI * k / 36, -0.004) for k in range(36)], [body.pt(cy - 0.035, 2 * PI * k / 36, -0.004) for k in range(36)]], closed=True), 'paint2', 'body', bevel=0.003, seg=1, sharp=40)
rivets('body', body, cy, 0, 2 * PI, 14, 0.024, 0.007)
store('buckle', bm_box(0.06, 0.08, 0.02, T(*body.pt(cy, 0.5 * PI, 0.03)) @ R('Y', PI / 2)), 'brass', 'body', bevel=0.004, seg=1)
bc = Vector((0, 1.17, -0.265))
store('bellhang', bm_sweep([(0, 1.26, -0.235), (0, 1.235, -0.26), (0, 1.21, -0.265)], [0.012, 0.012, 0.012], 8, 3), 'steel', 'bell', sharp=60, wn=False)
store('bellbody', bm_lathe([(0.0, 0.055), (0.03, 0.05), (0.05, 0.03), (0.06, 0.0), (0.072, -0.035), (0.08, -0.05), (0.074, -0.056), (0.058, -0.04)], 20, T(*bc)), 'copper', 'bell', bevel=0.002, seg=1, sharp=40)
for k in range(5):
    a = 2 * PI * k / 5
    store(nm('bslot'), bm_box(0.008, 0.05, 0.03, T(bc.x + math.sin(a) * 0.066, bc.y - 0.02, bc.z + math.cos(a) * 0.066) @ R('Y', a)), 'core', 'bell', sharp=40)
store('bellbulb', bm_ellipsoid((bc.x, bc.y - 0.03, bc.z), 0.042, 0.03, 0.042, 16, 8), 'lens', 'bell', sharp=60, wn=False)
# bib: a dull red apron plate under the collar, scalloped hem
store('bib', body.panel(1.03, 1.24, PI - 0.6, PI + 0.6, 0.012, 0.006, 5, 14, taper=0.35), 'paint2', 'body', bevel=0.004, seg=1, sharp=40)
rivets('body', body, 1.21, PI - 0.5, PI + 0.5, 6, 0.016, 0.007)
# shoulder sockets with rams down to the waist (both ends in the body)
for s in (-1, 1):
    store(nm('socket'), bm_lathe([(0.0, -0.06), (0.08, -0.06), (0.095, -0.04), (0.095, 0.03), (0.07, 0.06)], 16, T(s * (ARMX - 0.07), ARMY, ARMZ) @ R('Z', -s * PI / 2)), 'dark', 'body', bevel=0.003, seg=1, sharp=40)
    ram('body', (s * 0.27, 1.1, 0.04), (s * 0.33, 0.72, 0.08), 0.02)
    hose('body', [(s * 0.22, 1.18, 0.12), (s * 0.3, 1.0, 0.2), (s * 0.33, 0.8, 0.22)], 0.014)

# ---------------------------------------------------------------- NECK: exposed hydraulics: a central column, two rams, cables
store('neckcol', bm_sweep([(0, 1.25, -0.02), (0, 1.3, -0.04), (0, 1.37, -0.06)], [0.11, 0.1, 0.1], 14, 4, rib=(0.03, 0.18)), 'rubber', 'body', sharp=60)
for s in (-1, 1):
    ram('body', (s * 0.14, 1.24, 0.02), (s * 0.16, 1.38, -0.04), 0.018)
    hose('body', [(s * 0.1, 1.25, 0.06), (s * 0.13, 1.31, 0.04), (s * 0.12, 1.38, 0.0)], 0.012, 'wire_r' if s < 0 else 'wire_y')

# ---------------------------------------------------------------- HEAD: big and round (the cat read), panelled; screen face; muzzle with whisker rods; ears (one torn); hanging jaw plate
hs_ = Shell([1.3, 1.36, 1.5, 1.66, 1.82, 1.92, 1.965], W=[0.4, 0.64, 0.8, 0.84, 0.76, 0.56, 0.3], D=[0.36, 0.52, 0.62, 0.64, 0.58, 0.42, 0.22], Zc=[-0.06, -0.07, -0.08, -0.08, -0.07, -0.06, -0.05], p=2.4)
store('hcore', hs_.solid(1.31, 1.955, 10, 32, off=-0.03), 'core', 'head', sharp=60)
FACE = (PI - 0.78, PI + 0.78)
for (y0, y1, a0, a1, cls) in ((1.31, 1.96, FACE[1], FACE[1] + 0.85, 'paint'), (1.31, 1.96, FACE[1] + 0.85, 2 * PI - 0.1, 'paint'), (1.31, 1.96, -0.1, 0.75, 'paint2'),
                             (1.31, 1.96, 0.75, FACE[0], 'paint'), (1.84, 1.96, FACE[0], FACE[1], 'paint'), (1.31, 1.4, FACE[0], FACE[1], 'paint')):
    store(nm('hpan'), hs_.panel(y0, y1, a0 + 0.02, a1 - 0.02, 0.016, -0.01, 8, 12), cls, 'head', bevel=0.004, seg=1, sharp=40)
    rivets('head', hs_, y0 + 0.03, a0 + 0.04, a1 - 0.04, 5, 0.01)
    if y1 - y0 > 0.3:
        rivets('head', hs_, y1 - 0.06, a0 + 0.04, a1 - 0.04, 4, 0.01)
for y in (1.5, 1.82):
    store(nm('hstrap'), bm_sweep([hs_.pt(y, FACE[1] + 0.05 + (2 * PI - 2 * 0.05 - (FACE[1] - FACE[0])) * j / 16, 0.012) for j in range(17)], [0.012] * 17, 6, 2, ell=(1.0, 0.5)), 'steel', 'head', sharp=60, wn=False)
# cheek panels beside the screen (breakable: plate6, plate7)
for i, s in enumerate((-1, 1)):
    a0, a1 = (FACE[0] + 0.02, FACE[0] + 0.3) if s < 0 else (FACE[1] - 0.3, FACE[1] - 0.02)
    pg = 'plate%d' % (6 + i)
    group(pg, hs_.pt(1.66, (a0 + a1) / 2, 0.02), 'head')
    store(nm('cheek'), hs_.panel(1.42, 1.84, a0, a1, 0.018, 0.006, 7, 6), 'paint' if s < 0 else 'paint2', pg, bevel=0.004, seg=1, sharp=40)
    for y in (1.46, 1.8):
        bolt(pg, hs_.pt(y, (a0 + a1) / 2, 0.026), tuple(hs_.normal(y, (a0 + a1) / 2)), 0.008)
# the screen housing: a deep CRT-style bezel; the screen itself is drawn by the game on the 'screen' empty
SW, SH_, SC = 0.46, 0.28, Vector((0, 1.69, 0))
ob_, of_, if_, ib_ = rrect(SW + 0.07, SH_ + 0.07, 0.1, 4), rrect(SW + 0.05, SH_ + 0.05, 0.095, 4), rrect(SW, SH_, 0.085, 4), rrect(SW - 0.01, SH_ - 0.01, 0.08, 4)
store('bezel', bm_loft([[(x, SC.y + y, -0.33) for x, y in ob_], [(x, SC.y + y, -0.425) for x, y in of_], [(x, SC.y + y, -0.43) for x, y in if_], [(x, SC.y + y, SZ0 + 0.03) for x, y in ib_]], cap0=False, cap1=True), 'dark', 'head', bevel=0.003, seg=1, sharp=35)
# lamp eyes (advisor round 2): two deep lamp housings set into the top of the screen; the game lights the right one and leaves the left one dead
for s, gname in ((-1, 'eyeL'), (1, 'eyeR')):
    ec = (s * 0.115, 1.745, SZ0 - 0.005)
    group(gname, ec, 'head')
    M = T(*ec) @ aim_y((0, 0, -1))
    store(nm('eyeh'), bm_lathe([(0.075, -0.05), (0.078, -0.01), (0.074, 0.012), (0.06, 0.018), (0.056, 0.004)], 22, M, cap0=True, cap1=False), 'dark', 'head', bevel=0.002, seg=1)
    store(nm('eyerim'), bm_torus(0.064, 0.008, 22, 6, M), 'steel', 'head', wn=False)
    store(nm('eyelens'), bm_lathe([(0.056, 0.002), (0.045, 0.012), (0.022, 0.017), (0, 0.018)], 22, M), 'lens', gname, sharp=60, wn=False)
    for k in range(3):
        a_ = 2 * PI * k / 3 + 0.4
        bolt('head', (ec[0] + math.cos(a_) * 0.072, ec[1] + math.sin(a_) * 0.072, ec[2] - 0.016), (0, 0, -1), 0.006)
store('hood', hs_.panel(1.83, 1.87, PI - 0.6, PI + 0.6, 0.02, 0.03, 3, 12), 'paint', 'head', bevel=0.004, seg=1, sharp=40)
for x in (-0.2, -0.07, 0.07, 0.2):
    bolt('head', (x, 1.862, -0.445), (0, 0.4, -1), 0.008)
# muzzle: a rounded snout housing of two riveted plates under the screen, a nose lamp, whisker pods either side with three long rods each (two bent)
mz = Shell([1.41, 1.45, 1.52, 1.565], W=[0.22, 0.36, 0.34, 0.2], D=[0.14, 0.22, 0.2, 0.1], Zc=[-0.4, -0.42, -0.42, -0.41], p=2.2)
store('mcore', mz.solid(1.415, 1.56, 4, 20, off=-0.01), 'dark', 'head', sharp=60)
for (a0, a1, cls) in ((PI / 2, PI - 0.03, 'paint'), (PI + 0.03, 1.5 * PI, 'paint')):
    store(nm('muz'), mz.panel(1.415, 1.56, a0, a1, 0.014, 0.0, 5, 8), cls, 'head', bevel=0.004, seg=1, sharp=40)
    rivets('head', mz, 1.44, a0 + 0.1, a1 - 0.1, 3, 0.012, 0.007)
lamp('head', (0, 1.555, -0.52), (0, 0.3, -1), 0.022, 'dark')
for s in (-1, 1):
    wp = Vector((s * 0.17, 1.49, -0.47))
    store(nm('wpod'), bm_ellipsoid(tuple(wp), 0.05, 0.04, 0.04, 12, 6), 'dark', 'head', sharp=50)
    for k, dy in enumerate((0.025, 0.0, -0.025)):
        bend = -0.06 if (k == 0 and s > 0) or (k == 2 and s < 0) else 0.0
        tube('head', [tuple(wp), (wp.x + s * 0.16, wp.y + dy * 1.6, wp.z - 0.04), (wp.x + s * 0.36, wp.y + dy * 3.4 + bend, wp.z - 0.02 + abs(bend))], 0.0055, 'steel', 6, 4)
    lamp('head', (s * 0.3, 1.58, -0.4), (s * 0.5, -0.1, -1), 0.024)
# hanging jaw plate under the muzzle, dropped open on its hinge, with a loose cable
store('jawplate', bm_loft([[(-0.15, 1.415, -0.445), (0.15, 1.415, -0.445), (0.15, 1.42, -0.46), (-0.15, 1.42, -0.46)],
                          [(-0.13, 1.33, -0.5), (0.13, 1.33, -0.5), (0.13, 1.335, -0.515), (-0.13, 1.335, -0.515)]]), 'paint', 'jaw', bevel=0.003, seg=1, sharp=40)
for s in (-1, 1):
    bolt('jaw', (s * 0.1, 1.36, -0.512), (0, -0.4, -1), 0.007)
store('jawhinge', bm_sweep([(-0.16, 1.42, -0.44), (0.16, 1.42, -0.44)], [0.013, 0.013], 10, 2), 'steel', 'head', sharp=50)
tube('jaw', [(0.09, 1.415, -0.45), (0.11, 1.37, -0.49), (0.1, 1.32, -0.5)], 0.006, 'wire_r', 6, 5)
# ears: upright pointed frames, an outer plate and a dull red inner plate; the left ear is torn down to its bent frame with a scrap of plate
for s in (-1, 1):
    b0 = Vector((s * 0.1, 1.88, -0.1))
    b1 = Vector((s * 0.36, 1.78, -0.12))
    tip = Vector((s * 0.3, 2.17, -0.14))
    if s > 0:
        th = 0.02
        store(nm('ear'), bm_loft([[tuple(b0), tuple(b1), tuple(tip)], [tuple(b0 + Vector((0, 0, th * 2))), tuple(b1 + Vector((0, 0, th * 2))), tuple(tip + Vector((0, 0, th)))]]), 'paint', 'head', bevel=0.004, seg=1, sharp=30)
        inner = [b0.lerp(tip, 0.12) + Vector((s * 0.04, 0.03, -0.004)), b1.lerp(tip, 0.12) + Vector((-s * 0.03, 0.03, -0.004)), tip.lerp((b0 + b1) / 2, 0.22) + Vector((0, 0, -0.004))]
        store(nm('earin'), bm_loft([[tuple(p) for p in inner], [tuple(p + Vector((0, 0, 0.006))) for p in inner]]), 'paint2', 'head', bevel=0.002, seg=1, sharp=30)
        for k in range(3):
            bolt('head', tuple(b0.lerp(b1, 0.2 + 0.3 * k) + Vector((0, 0.012, -0.006))), (0, 0, -1), 0.007)
            bolt('head', tuple(b1.lerp(tip, 0.2 + 0.3 * k) + Vector((-0.012, 0, -0.006))), (0, 0, -1), 0.007)
    tube('head', [tuple(b0), tuple(tip if s > 0 else tip + Vector((0.04, -0.08, 0.02))), tuple(b1)], 0.01, 'steel', 6, 3)
    if s < 0:
        bent = tip + Vector((0.1, -0.04, -0.06))
        tube('head', [tuple(b0.lerp(tip, 0.5)), tuple(bent)], 0.009, 'steel', 6, 2)
        scrap = [b0 + Vector((0, 0.01, 0)), b0.lerp(b1, 0.65) + Vector((0, 0.01, 0)), b0.lerp(tip, 0.42) + Vector((0.02, 0, -0.01))]
        store(nm('earscrap'), bm_loft([[tuple(p) for p in scrap], [tuple(p + Vector((0, 0, 0.014))) for p in scrap]]), 'paint', 'head', bevel=0.003, seg=1, sharp=30)
        tube('head', [tuple(b0.lerp(tip, 0.3)), tuple(b0.lerp(tip, 0.3) + Vector((0.03, -0.1, -0.04)))], 0.005, 'wire_y', 6, 3)
    store(nm('earbase'), bm_ellipsoid(tuple((b0 + b1) / 2 + Vector((0, -0.005, 0.01))), 0.12, 0.035, 0.07, 12, 6), 'dark', 'head', sharp=50)
# a beacon on the crown and an aerial
lamp('head', (0.0, 1.97, -0.05), (0, 1, 0), 0.03)
tube('head', [(-0.06, 1.95, 0.02), (-0.07, 2.12, 0.04), (-0.1, 2.24, 0.08)], 0.006, 'steel', 6, 3)


# ---------------------------------------------------------------- ARMS
def arm_upper(grp, x, y0, y1, z, plate):
    # a tapered strut with flanges, a bolted guard plate in front (breakable plate group), a ram along the back, a hose
    store(nm('ustrut'), bm_sweep([(x, y0, z), (x, (y0 + y1) / 2, z), (x, y1, z)], [0.055, 0.045, 0.04], 10, 3, ell=(1.0, 0.8)), 'dark', grp, sharp=40)
    for fz in (-1, 1):
        store(nm('flange'), bm_sweep([(x, y0 - 0.02, z + fz * 0.045), (x, y1 + 0.02, z + fz * 0.035)], [0.014, 0.012], 4, 2, ell=(2.4, 0.5), up=(0, 0, 1)), 'steel', grp, sharp=40)
    ram(grp, (x - 0.02 * (1 if x > 0 else -1), y0 - 0.06, z + 0.07), (x, y1 + 0.06, z + 0.06), 0.016)
    hose(grp, [(x + 0.04 * (1 if x > 0 else -1), y0 - 0.02, z + 0.03), (x + 0.07 * (1 if x > 0 else -1), (y0 + y1) / 2, z + 0.02), (x + 0.04 * (1 if x > 0 else -1), y1 + 0.03, z + 0.03)], 0.011)
    sh = Shell([y0 - 0.03, (y0 + y1) / 2, y1 + 0.04], W=[0.13, 0.15, 0.12], D=[0.13, 0.15, 0.12], Zc=[z, z, z], p=2.1, X=[x, x, x])
    group(plate, sh.pt((y0 + y1) / 2, PI, 0.02), grp)
    store(nm('uguard'), sh.panel(y0 - 0.02, y1 + 0.03, PI - 1.2, PI + 1.2, 0.012, 0.0, 8, 12, taper=0.5), 'paint', plate, bevel=0.003, seg=1, sharp=40)
    for k in range(3):
        y = y0 - 0.04 - (y0 - y1 - 0.08) * k / 2
        for a in (PI - 0.8, PI + 0.8):
            bolt(plate, sh.pt(y, a, 0.014), tuple(sh.normal(y, a)), 0.007)


def shoulder_cowl(grp, x, y, z, plate, cls='paint'):
    s = 1 if x > 0 else -1
    group(plate, (x + s * 0.03, y + 0.06, z), grp)
    sc = Shell([y - 0.08, y + 0.02, y + 0.1], W=[0.22, 0.24, 0.14], D=[0.22, 0.24, 0.14], Zc=[z, z, z], p=2.2, X=[x + s * 0.02] * 3)
    store(nm('cowl'), sc.panel(y - 0.06, y + 0.1, s * 0.0 if s > 0 else -PI, s * PI if s > 0 else 0.0, 0.016, 0.0, 6, 12, taper=0.2), cls, plate, bevel=0.004, seg=1, sharp=40)
    for k in range(4):
        a = (k + 0.5) / 4 * PI * s
        bolt(plate, sc.pt(y - 0.03, a, 0.018), tuple(sc.normal(y - 0.03, a)), 0.008)


# beckon arm (x < 0): long thin limbs, a wide paw with four curled fingers; the core sits in the palm pad (beckonCore)
bx_ = -ARMX
shoulder_cowl('beckonArm', bx_, ARMY, ARMZ, 'plate0', 'paint2')
clevis('beckonArm', (bx_, ARMY, ARMZ), 0.08, 0.05)
arm_upper('beckonArm', bx_, ARMY - 0.06, ARMY - L1B + 0.05, ARMZ, 'plate2')
clevis('beckonFore', (bx_, ARMY - L1B, ARMZ), 0.06, 0.042)
EY, WY = ARMY - L1B, ARMY - L1B - L2B
store(nm('fstrut'), bm_sweep([(bx_, EY - 0.04, ARMZ), (bx_, (EY + WY) / 2, ARMZ), (bx_, WY + 0.03, ARMZ)], [0.042, 0.036, 0.034], 10, 3), 'dark', 'beckonFore', sharp=40)
ram('beckonFore', (bx_ + 0.03, EY - 0.05, ARMZ + 0.05), (bx_ + 0.02, WY + 0.05, ARMZ + 0.045), 0.013)
fa = Shell([EY - 0.03, (EY + WY) / 2, WY + 0.05], W=[0.11, 0.12, 0.1], D=[0.11, 0.12, 0.1], Zc=[ARMZ] * 3, p=2.1, X=[bx_] * 3)
group('plate4', fa.pt((EY + WY) / 2, PI, 0.02), 'beckonFore')
store(nm('fguard'), fa.panel(EY - 0.04, WY + 0.06, PI - 1.1, PI + 1.1, 0.011, 0.0, 8, 10, taper=0.45), 'paint', 'plate4', bevel=0.003, seg=1, sharp=40)
for y in (EY - 0.08, WY + 0.09):
    bolt('plate4', fa.pt(y, PI, 0.013), tuple(fa.normal(y, PI)), 0.007)
clevis('beckonPaw', (bx_, WY, ARMZ), 0.06, 0.036)
# the paw: palm block (the pad faces -z), back plates, four curled fingers, a thumb
PC = Vector((bx_, WY - 0.15, ARMZ))
ps = Shell([WY - 0.02, WY - 0.12, WY - 0.24, WY - 0.3], W=[0.16, 0.28, 0.27, 0.2], D=[0.1, 0.13, 0.12, 0.09], Zc=[ARMZ + 0.01] * 4, p=2.6, X=[bx_] * 4)
store('pcore', ps.solid(WY - 0.03, WY - 0.29, 5, 20, off=-0.012), 'dark', 'beckonPaw', sharp=50)
store(nm('pback'), ps.panel(WY - 0.03, WY - 0.29, -1.2, 1.2, 0.014, 0.0, 6, 12), 'paint', 'beckonPaw', bevel=0.004, seg=1, sharp=40)
store(nm('pside'), ps.panel(WY - 0.05, WY - 0.27, 1.25, 1.9, 0.012, 0.0, 5, 5), 'paint', 'beckonPaw', bevel=0.003, seg=1, sharp=40)
store(nm('pside'), ps.panel(WY - 0.05, WY - 0.27, -1.9, -1.25, 0.012, 0.0, 5, 5), 'paint', 'beckonPaw', bevel=0.003, seg=1, sharp=40)
# palm pad ring (rubber) round the core opening, an iris shutter ring (steel)
pz = ARMZ - 0.065
store('padring', bm_torus(0.1, 0.022, 24, 8, T(PC.x, PC.y, pz) @ R('X', PI / 2)), 'rubber', 'beckonPaw', sharp=60)
store('iris', bm_lathe([(0.088, 0.0), (0.088, 0.01), (0.06, 0.012)], 24, T(PC.x, PC.y, pz) @ R('X', -PI / 2)), 'steel', 'beckonPaw', sharp=50)
store('bcorelens', bm_ellipsoid((PC.x, PC.y, pz + 0.004), 0.075, 0.075, 0.022, 20, 8), 'lens', 'beckonCore', sharp=60, wn=False)
for k in range(4):
    fx = bx_ + (-0.09 + 0.06 * k)
    fy0 = WY - 0.29
    store(nm('finger'), bm_sweep([(fx, fy0 + 0.02, ARMZ), (fx, fy0 - 0.06, ARMZ - 0.01), (fx, fy0 - 0.11, ARMZ - 0.05), (fx, fy0 - 0.12, ARMZ - 0.1)], [0.024, 0.022, 0.02, 0.016], 10, 3), 'paint' if k != 1 else 'paint2', 'beckonPaw', sharp=50)
    for f in (0.35, 0.7):
        Q, U = spline([(fx, fy0 + 0.02, ARMZ), (fx, fy0 - 0.06, ARMZ - 0.01), (fx, fy0 - 0.11, ARMZ - 0.05), (fx, fy0 - 0.12, ARMZ - 0.1)], 4)
        i = int(f * (len(Q) - 1))
        d = (Q[i + 1] - Q[i - 1]).normalized()
        store(nm('knuck'), bm_lathe([(0.026, -0.006), (0.028, 0.0), (0.026, 0.006)], 10, T(*Q[i]) @ aim_y(d)), 'steel', 'beckonPaw', sharp=40)
    store(nm('claw'), bm_sweep([(fx, fy0 - 0.12, ARMZ - 0.1), (fx, fy0 - 0.11, ARMZ - 0.125), (fx, fy0 - 0.095, ARMZ - 0.135)], [0.009, 0.006, 0.002], 6, 3), 'dark', 'beckonPaw', sharp=50)
store('thumb', bm_sweep([(bx_ + 0.12, WY - 0.08, ARMZ - 0.02), (bx_ + 0.17, WY - 0.14, ARMZ - 0.05), (bx_ + 0.16, WY - 0.2, ARMZ - 0.08)], [0.026, 0.022, 0.017], 10, 3), 'paint', 'beckonPaw', sharp=50)

# slam arm (x > 0): a heavy short upper arm, then a TELESCOPING boom (housing + four sleeves) and a stamp-like paw with the core on its front face
sx_ = ARMX
shoulder_cowl('slamArm', sx_, ARMY, ARMZ, 'plate1')
clevis('slamArm', (sx_, ARMY, ARMZ), 0.09, 0.055)
arm_upper('slamArm', sx_, ARMY - 0.05, SY1 + 0.04, ARMZ, 'plate3')
clevis('slamFore', (sx_, SY1, ARMZ), 0.08, 0.05)
# boom housing: a ribbed square-ish tube with a cover (plate5), hydraulic feed hoses
hb = Shell([SY1 - 0.03, SY1 - 0.12, SY1 - 0.17], W=[0.15, 0.16, 0.15], D=[0.15, 0.16, 0.15], Zc=[ARMZ] * 3, p=3.2, X=[sx_] * 3)
store('housing', hb.solid(SY1 - 0.03, SY1 - 0.175, 4, 20), 'dark', 'slamFore', bevel=0.004, seg=1, sharp=40)
group('plate5', hb.pt(SY1 - 0.09, PI, 0.02), 'slamFore')
store(nm('hcover'), hb.panel(SY1 - 0.04, SY1 - 0.16, PI - 1.0, PI + 1.0, 0.012, 0.004, 5, 10), 'paint', 'plate5', bevel=0.004, seg=1, sharp=40)
for y in (SY1 - 0.05, SY1 - 0.13):
    for a in (PI - 0.7, PI + 0.7):
        bolt('plate5', hb.pt(y, a, 0.016), tuple(hb.normal(y, a)), 0.008)
for k in range(3):
    y = SY1 - 0.04 - k * 0.045
    store(nm('hrib'), bm_lathe([(0.09, -0.008), (0.094, 0.0), (0.09, 0.008)], 20, T(sx_, y, ARMZ)), 'steel', 'slamFore', sharp=40)
hose('slamFore', [(sx_ + 0.08, SY1 + 0.02, ARMZ + 0.03), (sx_ + 0.11, SY1 - 0.1, ARMZ + 0.05), (sx_ + 0.08, SY1 - 0.17, ARMZ + 0.05)], 0.013)
hose('slamFore', [(sx_ + 0.06, SY1 + 0.02, ARMZ + 0.07), (sx_ + 0.09, SY1 - 0.12, ARMZ + 0.09), (sx_ + 0.05, SY1 - 0.17, ARMZ + 0.08)], 0.01, 'wire_y')
# sleeves: each a chrome-and-steel tube with a collar, grease and a bolted stop ring; each nests into the one above
for k in range(1, 5):
    y0 = SY1 - 0.16 - SL * (k - 1)
    r = 0.07 - 0.008 * k
    g = 'slamS%d' % k
    store(nm('sleeve'), bm_lathe([(r, 0.06), (r, -SL - 0.02), (r * 0.9, -SL - 0.025)], 16, T(sx_, y0, ARMZ), cap0=False, cap1=True), 'steel' if k % 2 else 'chrome', g, sharp=40)
    store(nm('scollar'), bm_lathe([(r + 0.012, -0.02), (r + 0.016, -0.012), (r + 0.016, 0.012), (r + 0.012, 0.02), (r, 0.02), (r, -0.02)], 16, T(sx_, y0 - SL + 0.02, ARMZ)), 'dark', g, bevel=0.002, seg=1, sharp=40)
    for a in range(4):
        aa = PI / 4 + a * PI / 2
        bolt(g, (sx_ + math.sin(aa) * (r + 0.016), y0 - SL + 0.02, ARMZ + math.cos(aa) * (r + 0.016)), (math.sin(aa), 0, math.cos(aa)), 0.006)
# the stamp paw: a heavy rounded housing, three thick toe pads under it, a core on its front face (-z) behind an iris
SPY = PWY
sp = Shell([SPY + 0.02, SPY - 0.08, SPY - 0.18, SPY - 0.24], W=[0.16, 0.3, 0.32, 0.3], D=[0.16, 0.28, 0.3, 0.28], Zc=[ARMZ] * 4, p=2.8, X=[sx_] * 4)
store('spcore', sp.solid(SPY + 0.01, SPY - 0.23, 5, 20, off=-0.012), 'dark', 'slamPaw', sharp=50)
for (a0, a1, cls) in ((PI - 1.1 + 0.02, PI + 1.1 - 0.02, 'paint'), (PI + 1.1 + 0.02, 2 * PI - 0.02, 'paint'), (0.02, PI - 1.1 - 0.02, 'paint2')):
    store(nm('sppan'), sp.panel(SPY - 0.0, SPY - 0.22, a0, a1, 0.016, 0.0, 6, 10), cls, 'slamPaw', bevel=0.004, seg=1, sharp=40)
store('spcap', bm_lathe([(0.0, 0.0), (0.12, 0.0), (0.14, -0.02), (0.15, -0.05), (0.0, -0.05)], 20, T(sx_, SPY - 0.22, ARMZ) @ S(1.05, 1, 1.0)), 'rubber', 'slamPaw', bevel=0.004, seg=1, sharp=40)
for k in range(3):
    a = -0.6 + 0.6 * k
    store(nm('toepad'), bm_ellipsoid((sx_ + math.sin(a) * 0.1, SPY - 0.27, ARMZ - math.cos(a) * 0.1), 0.055, 0.035, 0.06, 12, 6), 'rubber', 'slamPaw', sharp=50)
    store(nm('sclaw'), bm_sweep([(sx_ + math.sin(a) * 0.13, SPY - 0.25, ARMZ - math.cos(a) * 0.13), (sx_ + math.sin(a) * 0.17, SPY - 0.28, ARMZ - math.cos(a) * 0.17), (sx_ + math.sin(a) * 0.19, SPY - 0.31, ARMZ - math.cos(a) * 0.18)], [0.014, 0.009, 0.003], 6, 3), 'dark', 'slamPaw', sharp=50)
spz = ARMZ - 0.16
store('spring', bm_torus(0.095, 0.02, 24, 8, T(sx_, SPY - 0.12, spz) @ R('X', PI / 2)), 'steel', 'slamPaw', sharp=60)
store('spiris', bm_lathe([(0.085, 0.0), (0.085, 0.01), (0.06, 0.012)], 24, T(sx_, SPY - 0.12, spz) @ R('X', -PI / 2)), 'dark', 'slamPaw', sharp=50)
store('scorelens', bm_ellipsoid((sx_, SPY - 0.12, spz - 0.004), 0.075, 0.075, 0.022, 20, 8), 'lens', 'slamCore', sharp=60, wn=False)
for k in range(6):
    a = 2 * PI * k / 6
    bolt('slamPaw', (sx_ + math.sin(a) * 0.125, SPY - 0.12 + math.cos(a) * 0.125, spz + 0.012), (0, 0, -1), 0.008)

# ---------------------------------------------------------------- WEAR AND GROWTH (the approved Gloom standard)
random.seed(97)
mud = []
for k in range(36):
    a = 2 * PI * k / 36 + random.uniform(-0.05, 0.05)
    mud.append(((0.6 * math.sin(a), random.uniform(0.01, 0.05), 0.6 * math.cos(a)), random.uniform(0.02, 0.035), (math.sin(a), 0.2, math.cos(a))))
G.mud('base', mud)
G.leaves('base', [(0.55 * math.sin(a), 0.205, 0.55 * math.cos(a)) for a in [random.uniform(0, 2 * PI) for k in range(14)]], 0.07)
G.moss('base', [((0.5 * math.sin(a), 0.2, 0.5 * math.cos(a)), 0.04) for a in (0.4, 1.6, 2.9, 4.1, 5.3)])
G.tufts('base', [((0.56 * math.sin(a), 0.02, 0.56 * math.cos(a)), 6, 0.18, 0.06) for a in (0.9, 2.2, 3.6, 5.0)], dry=False)
G.tufts('base', [((0.4 * math.sin(a), 0.2, 0.4 * math.cos(a)), 5, 0.14, 0.04) for a in (1.2, 3.1, 4.6)], dry=True)
G.moss('body', [(body.pt(yb[1] + 0.01, a, 0.016), 0.04) for a in (0.4 * PI, 1.2 * PI, 1.7 * PI)] + [(body.pt(yb[3] + 0.01, a, 0.016), 0.032) for a in (0.1 * PI, 1.5 * PI)])
G.tufts('body', [(body.pt(yb[1] + 0.012, 1.3 * PI, 0.018), 5, 0.13, 0.03), (body.pt(yb[3] + 0.012, 0.15 * PI, 0.018), 4, 0.12, 0.03)], dry=True)
G.leaves('body', [body.pt(1.0, random.uniform(0, 2 * PI), 0.03) for k in range(6)], 0.06)
G.moss('head', [((0.14, 1.95, -0.08), 0.04), ((-0.16, 1.93, 0.0), 0.035)])
G.leaves('head', [(random.uniform(-0.15, 0.15), 1.965, random.uniform(-0.12, 0.05)) for k in range(4)], 0.06)
G.tufts('head', [((0.2, 1.92, 0.02), 4, 0.1, 0.02)], dry=True)
for g, p in (('beckonArm', (-ARMX - 0.03, ARMY + 0.1, ARMZ)), ('slamArm', (ARMX + 0.03, ARMY + 0.1, ARMZ))):
    G.moss(g, [(p, 0.035)])
    G.leaves(g, [p], 0.05)
for s in (-1, 1):
    G.dent((s * 0.33, SEAT + 0.22, -0.2), (s, 0, -0.5), 0.07, 0.012, classes=('paint', 'paint2'))
G.dent(body.pt(0.66, 1.2 * PI), tuple(body.normal(0.66, 1.2 * PI)), 0.09, 0.014)
G.dent(body.pt(1.05, 0.6 * PI), tuple(body.normal(1.05, 0.6 * PI)), 0.08, 0.012)
G.dent(body.pt(1.3, 1.6 * PI), tuple(body.normal(1.3, 1.6 * PI)), 0.07, 0.012)
G.dent(hs_.pt(1.75, 1.7 * PI), tuple(hs_.normal(1.75, 1.7 * PI)), 0.07, 0.012)
G.dent((ARMX, PWY - 0.12, ARMZ + 0.15), (0, 0, 1), 0.06, 0.01)
for p in ((0.2, 1.24, -0.1), (-0.2, 1.24, -0.1), (0.0, 1.05, -0.3), (0.3, 0.95, 0.05), (-0.3, 0.6, 0.0), (0.0, SEAT + 0.02, -0.55)):
    G.oil(p, 0.035, 0.45)
G.oil((ARMX, SY1 - 0.17, ARMZ), 0.03, 0.4)
G.oil((-ARMX, ARMY - 0.1, ARMZ), 0.03, 0.4)
G.soot(body.pt(yb[0] + 0.2, 1.75 * PI, 0.02), 0.08, 0.3)
G.soot((0.0, 1.98, -0.05), 0.04, 0.15)

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
