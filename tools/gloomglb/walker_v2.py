# Walker v2 (owner, Nov 16: "walker look too clean"): years standing dormant outdoors. Run inside walker_model.py (exec, before apply_all), so its names
# (HIP, HIPW, THIGH, TY, YOKE, NECKY, HEADY, HW, HH, HD, hz0, hc, PZ, ...) are in scope. Adds: dents in plates, a cracked screen corner, dried mud lumps and
# dead leaves on the feet, moss and weeds caught in every joint, more leaves on the ledges; and writes the marks (oil leaks, soot vents, dents) paint_tex.py uses.
import grime_lib as G
from grime_lib import save_marks

random.seed(71)
ky = HIP - THIGH
for i, sx in enumerate((-1, 1)):
    x, kg, hg = sx * HIPW, 'knee%d' % i, 'hip%d' % i
    # dried mud: a crust along both sole edges, over the toe cap and the heel, splashes up the ankle block
    sp = []
    for s2 in (-1, 1):
        for k in range(7):
            z = -0.25 + k * 0.062 + random.uniform(-0.015, 0.015)
            sp.append(((x + s2 * 0.13, 0.025 + random.uniform(0, 0.03), z), random.uniform(0.014, 0.026), (s2, 0.3, 0)))
    for k in range(6):
        sp.append(((x + random.uniform(-0.11, 0.11), random.uniform(0.03, 0.07), -0.272), random.uniform(0.014, 0.024), (0, 0.2, -1)))
        sp.append(((x + random.uniform(-0.1, 0.1), 0.098 - random.uniform(0, 0.01), random.uniform(-0.24, -0.18)), random.uniform(0.01, 0.018), (0, 1, -0.3)))
    for k in range(4):
        sp.append(((x + random.uniform(-0.09, 0.09), random.uniform(0.03, 0.07), 0.177), random.uniform(0.012, 0.02), (0, 0.2, 1)))
        sp.append(((x + random.uniform(-0.055, 0.055), random.uniform(0.1, 0.15), -0.06), random.uniform(0.008, 0.014), (0, 0, -1)))
    G.mud(kg, sp)
    # dead leaves on the foot top, the toe and round the ankle; one stuck flat on the shin guard
    G.leaves(kg, [(x + random.uniform(-0.1, 0.1), 0.093, random.uniform(-0.15, 0.12)) for k in range(7)] + [(x + random.uniform(-0.09, 0.09), 0.1, -0.2) for k in range(2)], 0.055)
    G.leaves(kg, [(x + sx * 0.06, 0.16, -0.06), (x - sx * 0.05, 0.13, 0.05)], 0.045)
    # moss and weeds in the knee and the hip: in the hub's gaps, on top of the bearing, behind the joint
    G.moss(kg, [((x + sx * 0.085, ky + 0.085, 0.03), 0.022), ((x - sx * 0.085, ky + 0.08, -0.03), 0.018), ((x, ky + 0.1, 0.07), 0.02)])
    G.tufts(kg, [((x - sx * 0.08, ky + 0.04, 0.06), 4, 0.09, 0.02)], dry=(i == 0))
    G.moss(hg, [((x + sx * 0.1, HIP + 0.1, 0.03), 0.026), ((x - sx * 0.06, HIP + 0.105, -0.04), 0.02)])
    G.tufts(hg, [((x + sx * 0.11, HIP + 0.08, 0.06), 5, 0.12, 0.02)], dry=(i == 1))
    # shoulders and elbows: moss on the bearing tops, a dry tuft in the shoulder
    ag, fg, ax, ay = 'arm%d' % i, 'fore%d' % i, sx * 0.46, YOKE - 0.04
    G.moss(ag, [((ax, ay + 0.075, 0.03), 0.024), ((ax + sx * 0.04, ay + 0.06, -0.04), 0.016)])
    G.tufts(ag, [((ax - sx * 0.03, ay + 0.06, 0.05), 4, 0.1, 0.02)], dry=True)
    G.moss(fg, [((ax, ay - ARM + 0.065, 0.02), 0.018)])
    # dents: thigh plate, shin guard, toe of the foot
    G.dent((x - sx * 0.03, HIP - 0.16, -0.116), (0, 0, -1), 0.055, 0.009)
    G.dent((x + sx * 0.04, 0.072, -0.16), (0, 1, 0), 0.05, 0.008)
    # oil weeping from the hip and knee bearings and both rams of each leg
    G.oil((x + sx * 0.1, HIP - 0.08, 0.02), 0.025, 0.45)
    G.oil((x - sx * 0.09, ky - 0.07, 0.0), 0.022, 0.4)
    G.oil((x, HIP - 0.23, 0.14), 0.018, 0.3)
    G.oil((x, ky - 0.154, 0.14), 0.018, 0.35)
    G.oil((ax, ay - 0.08, 0.0), 0.02, 0.3)
    # soot from the vents on the thighs and the waist sides
    G.soot((x + sx * 0.12, HIP - 0.13, 0), 0.04, 0.12)
    G.soot((sx * 0.32, TY + 0.1, -0.1), 0.04, 0.18)
    G.soot((sx * 0.32, TY + 0.1, 0.1), 0.04, 0.18)
# neck: moss in the bellows, weeds out of its folds
G.moss('neck', [((-0.07, NECKY + 0.1, 0.02), 0.02), ((0.06, NECKY + 0.1, -0.05), 0.018)])
G.tufts('neck', [((-0.06, NECKY + 0.09, 0.05), 5, 0.1, 0.02)])
G.oil((0.0, NECKY + 0.05, 0.07), 0.03, 0.4)
# waist ledges, yoke top, head top: more dead leaves, with a few weeds
G.leaves('torso', [(random.uniform(-0.3, 0.3), TY + 0.142, random.choice((-0.2, 0.2)) + random.uniform(-0.02, 0.02)) for k in range(6)] + [(random.uniform(-0.35, 0.35), YOKE + 0.062, random.uniform(-0.12, 0.12)) for k in range(5)], 0.05)
G.leaves('head', [(random.uniform(-0.18, 0.18), hc + HH / 2 + 0.002, hz0 + random.uniform(0.05, 0.2)) for k in range(4)], 0.05)
G.leaves('pelvis', [(random.uniform(-0.28, 0.28), HIP + 0.052, random.uniform(-0.05, 0.05)) for k in range(4)], 0.045)
# dents: drum front left, head shell's left flank, yoke front, power pack lid, waist front
G.dent((-0.24, TY + 0.36, -0.24), (-0.7, 0, -0.7), 0.06, 0.01)
G.dent((-HW / 2, hc + 0.08, hz0 + 0.16), (-1, 0, 0), 0.05, 0.008)
G.dent((0.12, YOKE - 0.01, -0.2), (0, 0, -1), 0.05, 0.008)
G.dent((-0.08, TY + 0.47, PZ + 0.07), (0, 0, 1), 0.06, 0.01)
G.dent((0.22, TY + 0.06, -0.232), (0, 0, -1), 0.045, 0.008)
# the screen: cracked in the lower corner on the machine's right (the viewer's left)
G.crack('head', (0.12, hc - 0.085), hz0 + 0.0008, 0.18, 0.135, 0.0, hc)
# soot: the power pack's back vents, the head's rear vents, the pack's filler cap
G.soot((0, TY + 0.37, PZ + 0.075), 0.08, 0.3)
G.soot((0, hc - 0.01, hz0 + HD), 0.06, 0.2)
G.oil((0.11, TY + 0.62, PZ), 0.025, 0.5)
