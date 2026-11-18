# Curved, sculpted shapes for the desktop Gloom models that must NOT be boxy (owner, Nov 16): swept tubes with taper and oval sections, ribbed hoses,
# superellipse shells cut into curved panels, ellipsoids, domed caps. Game axes like bl_lib.py (x right, y up, front = -z).
import math
import bmesh
from mathutils import Vector, Matrix
from bl_lib import *


def spline(pts, sub):
    # Catmull-Rom through pts, sub samples per span; returns points and their parameter 0..1 along the control points
    P = [Vector(p) for p in pts]
    if len(P) == 2:
        P = [P[0], P[0].lerp(P[1], 0.5), P[1]]
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    Q, U = [], []
    n = len(P) - 1
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(sub):
            t = k / sub
            t2, t3 = t * t, t * t * t
            Q.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            U.append((i - 1 + t) / n)
    Q.append(P[-1])
    U.append(1.0)
    return Q, U


def bm_sweep(pts, radii, sides=12, sub=4, ell=(1.0, 1.0), caps=True, up=None, rib=None, M=I4):
    # a tube through pts whose radius goes through radii (one per point, or a function of u 0..1); ell squashes the section (x along the frame's side, y along its up);
    # rib = (pitch, depth): rings pressed into the surface every pitch metres (a ribbed hose); up: the direction the section's y axis leans to
    Q, U = spline(pts, sub)
    if rib:
        # resample finely so the ribs show
        L = sum((Q[i + 1] - Q[i]).length for i in range(len(Q) - 1))
        n = max(len(Q), int(L / rib[0] * 3))
        acc = [0.0]
        for i in range(len(Q) - 1):
            acc.append(acc[-1] + (Q[i + 1] - Q[i]).length)
        Q2, U2 = [], []
        for k in range(n + 1):
            s = L * k / n
            j = max(0, min(len(Q) - 2, next((i for i in range(len(acc) - 1) if acc[i + 1] >= s), len(Q) - 2)))
            f = (s - acc[j]) / max(1e-9, acc[j + 1] - acc[j])
            Q2.append(Q[j].lerp(Q[j + 1], f))
            U2.append(U[j] + (U[j + 1] - U[j]) * f)
        Q, U = Q2, U2
        acc = [0.0]
        for i in range(len(Q) - 1):
            acc.append(acc[-1] + (Q[i + 1] - Q[i]).length)
    rf = radii if callable(radii) else (lambda u: _interp(radii, u))
    tans = []
    for i in range(len(Q)):
        a, b = Q[max(0, i - 1)], Q[min(len(Q) - 1, i + 1)]
        tans.append((b - a).normalized())
    upv = Vector(up) if up else (Vector((0, 0, -1)) if abs(tans[0].z) < 0.9 else Vector((0, 1, 0)))
    nrm = tans[0].cross(upv).normalized()
    secs = []
    for i, q in enumerate(Q):
        if i:
            nrm = (tans[i - 1].rotation_difference(tans[i]).to_matrix() @ nrm).normalized()
        bn = tans[i].cross(nrm).normalized()
        r = rf(U[i])
        if rib:
            ph = (acc[i] / rib[0]) % 1.0
            r *= 1.0 - rib[1] * (0.5 + 0.5 * math.cos(2 * PI * ph))
        secs.append([tuple(q + (nrm * math.cos(2 * PI * k / sides) * ell[0] + bn * math.sin(2 * PI * k / sides) * ell[1]) * r) for k in range(sides)])
    return bm_loft(secs, M, caps, caps)


def _interp(vals, u):
    n = len(vals) - 1
    x = max(0.0, min(1.0, u)) * n
    i = min(n - 1, int(x))
    f = x - i
    f = f * f * (3 - 2 * f)
    return vals[i] + (vals[i + 1] - vals[i]) * f


def bm_ellipsoid(c, rx, ry, rz, seg=20, rings=12, M=I4, y0=-1.0, y1=1.0):
    # an ellipsoid (or a slice of one between y0 and y1 in -1..1, e.g. 0..1 = upper dome) centred at c
    prof = []
    a0, a1 = math.asin(max(-1, min(1, y0))), math.asin(max(-1, min(1, y1)))
    for k in range(rings + 1):
        a = a0 + (a1 - a0) * k / rings
        prof.append((max(1e-4 if 0 < k < rings else 0.0, math.cos(a)), math.sin(a)))
    prof = [(max(r, 0.0), y) for (r, y) in prof]
    bm = bm_lathe(prof, seg, I4, cap0=y0 > -0.999, cap1=y1 < 0.999)
    bmesh.ops.transform(bm, matrix=M @ T(*c) @ S(rx, ry, rz), verts=bm.verts)
    return bm


def superellipse(a, p=2.4):
    # point on a unit superellipse at angle a (0 = +z, PI/2 = +x), exponent p (2 = ellipse, bigger = squarer)
    s, c = math.sin(a), math.cos(a)
    return (math.copysign(abs(s) ** (2.0 / p), s), math.copysign(abs(c) ** (2.0 / p), c))


class Shell:
    # a body of revolution-like shape along y: at height y its section is a superellipse of width W(y), depth D(y), centred at (X(y), Zc(y)).
    # panel() cuts a curved plate out of it between two heights and two angles, thickness th, standing off the surface by gap.
    def __init__(self, ys, W, D, Zc, p=2.4, X=None):
        self.ys, self.W, self.D, self.Zc, self.p = ys, W, D, Zc, p
        self.X = X or [0.0] * len(ys)

    def at(self, y):
        ys = self.ys
        t = (y - ys[0]) / (ys[-1] - ys[0]) * (len(ys) - 1)
        i = max(0, min(len(ys) - 2, int(t)))
        f = max(0.0, min(1.0, t - i))
        f = f * f * (3 - 2 * f)
        g = lambda L: L[i] + (L[i + 1] - L[i]) * f
        return g(self.W), g(self.D), g(self.Zc), g(self.X)

    def pt(self, y, a, off=0.0):
        W, D, Zc, X = self.at(y)
        sx, sz = superellipse(a, self.p)
        return (X + sx * (W / 2 + off), y, Zc + sz * (D / 2 + off))

    def solid(self, y0, y1, nv=10, na=32, off=0.0, close=True):
        secs = []
        for j in range(nv + 1):
            y = y0 + (y1 - y0) * j / nv
            secs.append([self.pt(y, 2 * PI * k / na, off) for k in range(na)])
        return bm_loft(secs, I4, close, close)

    def panel(self, y0, y1, a0, a1, th=0.012, off=0.0, nv=6, na=10, taper=0.0):
        # a curved plate: outer skin at off + th, inner at off, from y0 to y1 and angle a0 to a1 (one closed solid);
        # taper > 0 narrows the plate toward both ends (a leaf-shaped outline instead of a rectangle: 1 = down to a point)
        secs = []
        am = (a0 + a1) / 2
        for j in range(nv + 1):
            t = j / nv
            y = y0 + (y1 - y0) * t
            f = 1.0 - taper * (1.0 - math.sin(PI * (0.08 + 0.84 * t)) ** 0.6)
            b0, b1 = am + (a0 - am) * f, am + (a1 - am) * f
            outer = [self.pt(y, b0 + (b1 - b0) * k / na, off + th) for k in range(na + 1)]
            inner = [self.pt(y, b0 + (b1 - b0) * k / na, off) for k in range(na, -1, -1)]
            secs.append(outer + inner)
        return bm_loft(secs, I4, True, True)

    def normal(self, y, a):
        p0 = Vector(self.pt(y, a))
        pa = Vector(self.pt(y, a + 0.01))
        py = Vector(self.pt(y + 0.005, a))
        n = (py - p0).cross(pa - p0).normalized()
        c = Vector((self.at(y)[3], y, self.at(y)[2]))
        if n.dot(p0 - c) < 0:
            n = -n
        return n
