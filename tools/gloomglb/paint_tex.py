# Paints the texture atlas of a desktop Gloom model from the data baked by bake_data.py (numpy; no Blender needed, a few seconds a pass).
# Usage: python3 tools/gloomglb/paint_tex.py <data_dir> <out_dir> <kind> [size]
# Writes base.png (sRGB colour with layered wear), orm.png (R = paint mask for per-machine tint, G = roughness, B = metalness), nrm.png (tangent-space normal, OpenGL, from a painted height),
# and look.png (the four maps side by side, small) for a quick check. All layers are driven by world position (3D noise, no seams), the bake's edge and occlusion data and the part class.
# Layers, bottom to top: bare steel, red-oxide primer, service paint (sun-faded on top faces), chipped and worn at convex edges and in scattered chips;
# rust bloom where steel shows and in crevices, rust runs below on upright faces; grime in crevices and occluded areas; mud splashed up from the ground; moss on top faces in crevices;
# stencils and plates (decals projected along a face's normal).
import sys, os, math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ddir, odir, kind = sys.argv[1], sys.argv[2], sys.argv[3]
OUT = int(sys.argv[4]) if len(sys.argv) > 4 else None
os.makedirs(odir, exist_ok=True)
D = np.load(os.path.join(ddir, 'data.npz'))
pos, nrm, cls, cov = D['pos'], D['nrm'], D['cls'].astype(np.int32), D['cov']
edge, cav, ao = D['edge'], D['cav'], D['ao']
N = pos.shape[0]
CLASSES = ['paint', 'dark', 'steel', 'chrome', 'rubber', 'wire_r', 'wire_y', 'brass', 'core', 'paint2', 'plant', 'grassdry', 'moss', 'dial', 'amber', 'tag', 'bolt', 'leafdry', 'mud', 'crack', 'copper']
KIND = {
    # service paint (sRGB), primer, how worn (0..1), stencil text, unit number
    'walker': dict(paint=(196, 162, 62), primer=(128, 60, 40), wear=1.3, unit='SVC-07', num='07', dim=0.66),
    'lurcher': dict(paint=(108, 124, 136), primer=(120, 58, 40), wear=1.3, unit='INSP-3', num='3', dim=0.72),
    # from the Ticks on (owner's notes on the approved pair): rust breaks up at 3 m: smaller, rarer blooms (bloom = noise frequencies, thresholds), longer and stronger runs (runs = drip length, strength)
    # Hauler v2: faded olive drab (coordinator: the orange paint and the rust read as one brown)
    'hauler': dict(paint=(122, 126, 80), primer=(120, 58, 40), wear=1.3, film=0.0, unit='FRT-02', num='02', dim=0.7, bloom=(16.0, 34.0, 0.73, 0.78), runs=(0.28, 1.3), follow=True, edgerust=0.3, seamgrime=0.3, under=0.45, dustk=0.75),
    # Stilt v2: chipped off-white enamel (the study's colour; brick red and rust read as one brown)
    'stilt': dict(paint=(206, 200, 182), primer=(120, 58, 40), wear=1.3, film=0.0, unit='LMP-5', num='5', dim=0.74, bloom=(16.0, 34.0, 0.75, 0.8), runs=(0.25, 1.1), follow=True, edgerust=0.2, seamgrime=0.3, under=0.45, dustk=0.75),
    # Lantern v2: a cleaner, brighter teal and fewer blooms (teal and rust read as one brown)
    'lantern': dict(paint=(92, 152, 144), primer=(120, 58, 40), wear=1.3, film=0.0, unit='PA-9', num='9', dim=0.78, bloom=(16.0, 34.0, 0.74, 0.79), runs=(0.34, 1.6), follow=True, edgerust=0.45, seamgrime=0.3, under=0.45, dustk=0.75),
    # Warden v2: less rust so the off-white enamel reads (it read rust-brown all over)
    'warden': dict(paint=(207, 204, 192), primer=(120, 58, 40), wear=1.3, film=0.0, unit='SEC-1', num='1', dim=0.72, bloom=(16.0, 34.0, 0.75, 0.8), runs=(0.26, 1.15), follow=True, edgerust=0.2, seamgrime=0.3, under=0.45, dustk=0.75),
    # THE BECKONER (final-night boss, Nov 17): faded cream enamel, dull oxide-red trim (paint2: collar, bib, inner ear, shutters, plinth), heavy wear (under 15% clean paint)
    # (first paint: 5% clean paint and mud up to the head: hscale keeps mud and low grime on the plinth and haunches, lighter wear)
    # v2 (owner 18:51: match the approved phone build's dark enamel and oxide red)
    # (v2 rusty paint, kept as art/blender/gloom_boss_tex_v2rust): see the line below for v3
    # v3 (owner 20:44 'closer to white'): aged ivory enamel, about 55% clean; rust only at seams, edges, rivets and drips; paint2 is gunmetal (no red trim: the hidden lucky cat is the white cat with the red collar)
    # (ivory 2, coordinator 22:15: red-brown spatter on the ivory read as blood: ochre and orange-brown rust in vertical runs only, no round blooms, grey primer)
    'boss': dict(paint=(214, 207, 189), paint2=(74, 76, 72), primer=(112, 106, 96), wear=0.4, film=0.0, unit='GC-01', num='01', dim=0.95, bloom=(16.0, 34.0, 0.995, 0.999), runs=(0.08, 0.8), hscale=0.22, follow=True, edgerust=0.22, seamgrime=0.12, under=0.22, dustk=0.5, grimek=0.3, rustc=(138, 90, 43), runc=(168, 111, 53), rustdeep=(90, 58, 30)),
    # 'boss': dict(paint=(136, 120, 92), paint2=(108, 52, 36), primer=(120, 58, 40), wear=1.05, film=0.0, unit='GC-01', num='01', dim=0.8, bloom=(16.0, 34.0, 0.75, 0.8), runs=(0.24, 1.2), hscale=0.3, follow=True, edgerust=0.25, seamgrime=0.25, under=0.35, dustk=0.75),
    'ticks': dict(paint=(140, 138, 106), primer=(120, 58, 40), wear=1.15, unit='CITY SWEEP', num='14', dim=0.74, bloom=(16.0, 34.0, 0.72, 0.77), runs=(0.3, 1.3), hscale=0.3, follow=True, edgerust=0.4, seamgrime=0.3, under=0.45, dustk=0.75),
}[kind]
BLOOM = KIND.get('bloom', (7.5, 17.0, 0.63, 0.7))
RUNS = KIND.get('runs', (0.18, 1.1))
# the marks the model script wrote (dents, oil leaks, soot vents, screen crack), in the game's axes
MK = os.path.join(os.path.dirname(os.path.abspath(ddir)), 'gloom_%s_model_marks.json' % kind)
MARKS = json.load(open(MK)) if os.path.exists(MK) else {'dents': [], 'oil': [], 'soot': [], 'crack': []}
g2b = lambda q: np.array([q[0], -q[2], q[1]], np.float32)
cl = lambda k: cls == CLASSES.index(k)


# ---------------------------------------------------------------- 3D value noise (hash lattice, smooth interpolation), fractal sums
def _hash(ix, iy, iz, seed):
    h = (ix.astype(np.uint32) * np.uint32(374761393) + iy.astype(np.uint32) * np.uint32(668265263) + iz.astype(np.uint32) * np.uint32(2147483647) + np.uint32(seed * 974711)) & np.uint32(0xffffffff)
    h = (h ^ (h >> np.uint32(13))) * np.uint32(1274126177)
    h = h ^ (h >> np.uint32(16))
    return (h & np.uint32(0xffff)).astype(np.float32) / 65535.0


def vnoise(p, seed=0):
    f = np.floor(p)
    t = p - f
    t = t * t * (3 - 2 * t)
    i = f.astype(np.int64)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[..., 0] if dx else 1 - t[..., 0]) * (t[..., 1] if dy else 1 - t[..., 1]) * (t[..., 2] if dz else 1 - t[..., 2])
                out = out + w * _hash(i[..., 0] + dx, i[..., 1] + dy, i[..., 2] + dz, seed)
    return out


def fbm(p, freq, oct=4, seed=0, gain=0.5, stretch=(1, 1, 1)):
    q = p * np.array(stretch, np.float32) * freq
    a, s, tot = 1.0, 0.0, 0.0
    for o in range(oct):
        s = s + a * vnoise(q * (2.03 ** o) + o * 17.1, seed + o)
        tot += a
        a *= gain
    return s / tot


sm = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
C = lambda rgb: np.array(rgb, np.float32) / 255.0
P = pos.astype(np.float32)
nz = nrm[..., 2]
up = sm(0.45, 0.85, nz)
side = 1 - np.abs(nz)

# ---------------------------------------------------------------- masks
e = np.clip(edge * 9.0, 0, 1)
convex = e * sm(0.55, 0.9, cav)
crev = 1 - cav
occl = 1 - ao
on = cov > 0.5
n_lo = fbm(P, 2.2, 3, 1)
n_mid = fbm(P, 9.0, 4, 2)
n_hi = fbm(P, 38.0, 3, 3)
n_chip = fbm(P, 16.0, 4, 4)
zmin = float(P[..., 2][on].min()) if on.any() else 0.0
# height above the feet, scaled to the kind's size (hscale < 1 for small kinds, so mud and low grime reach as far up the machine in proportion)
H_ = (P[..., 2] - zmin) / KIND.get('hscale', 1.0)
# paint wear: convex edges break first, then scattered chips on flats, more low on the body (kicks, scrapes)
lowz = sm(0.9, 0.1, H_)
wear = convex * (0.8 + 0.7 * n_mid) + (n_chip - 0.5) * 0.95 + lowz * 0.16 + (n_lo - 0.5) * 0.3
wear = wear * KIND['wear']
steel_show = sm(0.62, 0.69, wear)
primer_show = sm(0.46, 0.53, wear) * (1 - steel_show)
# scratches and scuffs: long thin vertical ones, shorter horizontal scrapes low down, a few diagonal gouges; mostly upright faces
scr = fbm(P, 60.0, 2, 5, stretch=(1, 1, 0.06))
scr2 = fbm(P, 70.0, 2, 41, stretch=(0.08, 1, 1))
scr3 = fbm(P @ np.array([[0.7, 0, 0.7], [0, 1, 0], [-0.7, 0, 0.7]], np.float32), 55.0, 2, 42, stretch=(1, 1, 0.07))
scratch = np.clip(sm(0.72, 0.77, scr) * sm(0.3, 0.6, n_lo) + sm(0.74, 0.78, scr2) * (0.4 + 0.6 * lowz) + sm(0.76, 0.8, scr3) * 0.8, 0, 1) * (0.4 + 0.6 * side)
steel_show = np.maximum(steel_show, scratch * 0.85)
# water runs (dirt carried down upright faces), patches where the paint flaked off down to the primer
water = sm(0.5, 0.8, fbm(P, 14.0, 3, 23, stretch=(1, 1, 0.07))) * side * (0.5 + 0.5 * sm(0.3, 0.6, fbm(P, 2.5, 2, 24)))
primer_patch = sm(0.66, 0.73, fbm(P, 7.0, 4, 25)) * 0.95
# rust bloom: blotches at three sizes where the paint failed, with a ring of blistered paint round each
bloom_n = np.maximum(fbm(P, BLOOM[0], 4, 6), fbm(P, BLOOM[1], 3, 43) * 0.98)
bloom = sm(BLOOM[2], BLOOM[3], bloom_n)
blister = sm(BLOOM[2] - 0.06, BLOOM[2], bloom_n) * (1 - bloom)
rust = np.clip(steel_show * (0.3 + 0.9 * sm(0.35, 0.65, n_mid)) + sm(0.25, 0.7, crev) * (0.45 + 0.8 * n_mid) * 0.85 + bloom * 0.95, 0, 1)
streak = fbm(P, 22.0, 3, 7, stretch=(1, 1, 0.08))
runs = sm(0.58, 0.75, streak) * side * sm(0.4, 0.65, fbm(P, 3.0, 3, 8)) * 0.85
rust = np.clip(np.maximum(rust, runs), 0, 1)
rust_hi = rust * (0.7 + 0.6 * n_hi)


# ---------------------------------------------------------------- drips: rust from bolts and seams, oil from bearings run DOWN the surfaces; soot from vents rises UP
# Done in a world-space voxel grid (8 mm): a source is splatted in, carried down (or up) column by column, fading with distance and dying where no surface is
# (one voxel of slack so it follows gently sloped faces), then read back at each texel (max over the 3x3 columns round it).
VOX = 0.008
idx_on = np.nonzero(on)
Pon = P[idx_on]
LO = Pon.min(0) - VOX * 2
GI = ((Pon - LO) / VOX).astype(np.int32)
GS = tuple(GI.max(0) + 3)
OCC = np.zeros(GS, bool)
OCC[GI[:, 0], GI[:, 1], GI[:, 2]] = True
OCCD = OCC.copy()
for dx in (-1, 0, 1):
    for dy in (-1, 0, 1):
        OCCD |= np.roll(np.roll(OCC, dx, 0), dy, 1)
gx_, gy_ = np.meshgrid(np.arange(GS[0]) * VOX, np.arange(GS[1]) * VOX, indexing='ij')
COLP = np.stack([gx_, gy_, np.zeros_like(gx_)], -1).astype(np.float32)


def max3(a):
    o = a.copy()
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx or dy:
                o = np.maximum(o, np.roll(np.roll(a, dx, 0), dy, 1))
    return o


def drip(src, length, up=False, seed=50, widen=0, follow=False):
    # src: per-texel 0..1; length: typical run in metres; returns per-texel 0..1
    # follow: where the surface steps sideways from one voxel row to the next (a curved shell), the run steps with it instead of falling off
    G = np.zeros(GS, np.float32)
    np.maximum.at(G, (GI[:, 0], GI[:, 1], GI[:, 2]), src[idx_on].astype(np.float32))
    flow = sm(0.3, 0.75, vnoise(COLP * np.array([90, 90, 1], np.float32), seed))
    dec = np.exp(-VOX / (length * (0.35 + 1.1 * flow)))
    rng = range(1, GS[2]) if up else range(GS[2] - 2, -1, -1)
    for z in rng:
        prev = G[:, :, z - 1] if up else G[:, :, z + 1]
        if widen and z % widen == 0:
            prev = max3(prev) * 0.97
        c = prev * dec * np.where(OCCD[:, :, z], 1.0, 0.35)
        if follow:
            stepped = OCC[:, :, z] & ~(OCC[:, :, z - 1] if up else OCC[:, :, z + 1])
            c = np.maximum(c, max3(prev) * dec * stepped)
        G[:, :, z] = np.maximum(G[:, :, z], c)
    out = np.zeros((N, N), np.float32)
    out[idx_on] = max3(G)[GI[:, 0], GI[:, 1], GI[:, 2]]
    return out


def sphere_src(pts):
    s_ = np.zeros((N, N), np.float32)
    for (q, r, L) in pts:
        d = np.linalg.norm(P - g2b(q)[None, None, :], axis=-1)
        s_ = np.maximum(s_, np.clip(1.2 - d / r, 0, 1))
    return s_


pm_all = (cls == CLASSES.index('paint')) | (cls == CLASSES.index('paint2')) | (cls == CLASSES.index('dark'))
bolt_m = cls == CLASSES.index('bolt')
# edgerust (KIND): rust also starts on the plates' convex edges (panel rims), broken up by noise
src_rust = np.clip(bolt_m * 0.95 + sm(0.4, 0.8, crev) * pm_all * sm(0.45, 0.7, fbm(P, 6.0, 3, 44)) + bloom * 0.6 * sm(0.5, 0.8, n_mid) + KIND.get('edgerust', 0.0) * convex * pm_all * sm(0.4, 0.65, fbm(P, 20.0, 3, 54)), 0, 1)
rdrip = drip(src_rust, RUNS[0], seed=51, follow=KIND.get('follow', False))
striae = 0.55 + 0.45 * sm(0.35, 0.7, fbm(P, 45.0, 2, 45, stretch=(1, 1, 0.05)))
rust_run = np.clip(rdrip * striae * (0.25 + 0.75 * side) - src_rust * 0.3, 0, 1)
oil_len = max([L for (_, _, L) in MARKS['oil']] + [0.3])
oil_src = sphere_src(MARKS['oil'])
oil_run = np.clip(drip(oil_src, oil_len * 0.45, seed=52) * (0.5 + 0.5 * striae) * (0.35 + 0.65 * side), 0, 1)
oil = np.clip(np.maximum(oil_src * 0.95, oil_run), 0, 1)
soot_src = sphere_src(MARKS['soot'])
soot = np.clip(np.maximum(soot_src * 0.85, drip(soot_src, 0.12, up=True, seed=53, widen=3)) * (0.55 + 0.45 * sm(0.3, 0.7, fbm(P, 18.0, 3, 46))), 0, 1)
# dents: the paint is crushed and cracked in the bowl (primer and bare steel scraped through at the centre), grime gathers in it
dentm = np.zeros((N, N), np.float32)
for (q, n_, r, dp) in MARKS['dents']:
    d = np.linalg.norm(P - g2b(q)[None, None, :], axis=-1)
    dentm = np.maximum(dentm, np.clip(1 - d / (r * 1.1), 0, 1))
dent_core = sm(0.55, 0.8, dentm) * sm(0.35, 0.6, fbm(P, 30.0, 3, 47))
steel_show = np.maximum(steel_show, dent_core * 0.9)
primer_show = np.maximum(primer_show, sm(0.3, 0.5, dentm) * sm(0.4, 0.6, fbm(P, 24.0, 3, 48)) * (1 - steel_show))
# grime: crevices, occluded areas and low parts, a general film over everything; mud splashed up from the ground (a band and a spray of dots above it);
# moss on top faces in crevices; dust settled on top faces and thickest in their corners
# seamgrime (KIND): more dirt packed into seams; under (KIND): grime on faces that look down (under bumpers, lips and ledges)
grime = np.clip(sm(0.1, 0.65, occl) * 1.0 + sm(0.15, 0.7, crev) * 0.95 + (n_mid - 0.5) * 0.35 + sm(1.0, 0.0, H_) * 0.35 + dentm * 0.35 + KIND.get('seamgrime', 0.0) * sm(0.25, 0.6, crev) + KIND.get('under', 0.0) * sm(-0.15, -0.6, nz), 0, 1)
mud_band = sm(0.6, 0.06, H_) * sm(0.32, 0.62, fbm(P, 7.0, 4, 9) + 0.25 * (1 - up))
mud_dots = sm(0.95, 0.2, H_) * sm(0.8, 0.84, fbm(P, 55.0, 2, 49)) * (0.5 + 0.5 * side)
mud = np.clip(mud_band * (0.65 + 0.35 * side) + mud_dots, 0, 1)
moss = up * sm(0.15, 0.55, crev + occl * 0.9) * sm(0.42, 0.58, fbm(P, 11.0, 4, 10)) * 0.95
dust = up * np.clip(0.45 + 0.45 * n_mid + 0.4 * crev, 0, 1)

# ---------------------------------------------------------------- per class base layers: colour, roughness, metalness, paint (0..1)
col = np.zeros((N, N, 3), np.float32)
rough = np.full((N, N), 0.6, np.float32)
metal = np.zeros((N, N), np.float32)
paint = np.zeros((N, N), np.float32)
STEEL, STEEL_R = C((168, 166, 160)), 0.38
lerp = lambda a, b, t: a + (b - a) * t[..., None] if np.ndim(t) == 2 else a + (b - a) * t


def painted(mask, pcol, prough, fade=True, wearmul=1.0):
    # a painted metal part: paint over primer over steel
    pc = C(pcol)[None, None, :] * (0.84 + 0.3 * n_lo)[..., None] * (0.92 + 0.16 * n_mid)[..., None]
    g = pc.mean(-1, keepdims=True)
    # weathered paint: a little greyer everywhere, faded in broad blotches, sun-bleached on top faces, dark water runs down upright faces
    pc = lerp(pc, g, 0.06 + 0.18 * sm(0.45, 0.75, fbm(P, 4.0, 3, 21)))
    if fade:
        pc = lerp(pc, g * 1.1 + 0.04, up * 0.25 + 0.12 * sm(0.55, 0.8, fbm(P, 3.0, 3, 22)))
    # an old dirt film: the in-game light is bright and even, so the paint is kept well below its new colour (measured against the builder's machines in the game)
    pc = pc * KIND['dim'] * (1 - 0.35 * water)[..., None] * (1 - 0.22 * lowz)[..., None]
    ss = np.clip(steel_show * wearmul, 0, 1)
    ps = np.clip(primer_show * wearmul + primer_patch, 0, 1) * (1 - ss)
    c = lerp(lerp(pc, C(KIND['primer'])[None, None, :] * (0.85 + 0.3 * n_hi)[..., None], ps), STEEL[None, None, :] * (0.8 + 0.3 * n_hi)[..., None], ss)
    r = prough + 0.1 * (n_mid - 0.5) + up * 0.08
    r = r * (1 - ps) + 0.8 * ps
    r = r * (1 - ss) + STEEL_R * ss
    m = ss
    col[mask] = c[mask]
    rough[mask] = r[mask]
    metal[mask] = m[mask]
    paint[mask] = (1 - ss - ps)[mask]


painted(cl('paint'), KIND['paint'], 0.62)
# machinery parts: dark olive-grey enamel, less worn (they sit inside the casing lines), oilier
painted(cl('dark'), (62, 62, 54), 0.55, fade=False, wearmul=0.75)
m = cl('steel') | cl('bolt')
col[m] = (STEEL[None, None, :] * (0.72 + 0.35 * n_hi)[..., None] * (0.85 + 0.2 * n_lo)[..., None])[m]
rough[m] = (0.36 + 0.15 * n_mid)[m]
metal[m] = 1.0
m = cl('chrome')
col[m] = (C((205, 205, 200))[None, None, :] * (0.9 + 0.12 * n_hi)[..., None])[m]
rough[m] = (0.14 + 0.1 * n_mid)[m]
metal[m] = 1.0
m = cl('brass')
col[m] = (C((176, 136, 70))[None, None, :] * (0.85 + 0.25 * n_mid)[..., None])[m]
rough[m] = (0.34 + 0.15 * n_mid)[m]
metal[m] = 1.0
# copper trims and pipes under verdigris: green-blue crust in crevices and on top faces, brown copper showing on worn edges
m = cl('copper')
verd = sm(0.35, 0.7, crev * 0.9 + up * 0.35 + (fbm(P, 14.0, 4, 61) - 0.5) * 0.9 + 0.15) * (1 - convex * 0.7)
cu = lerp(C((150, 92, 58))[None, None, :] * (0.8 + 0.35 * n_hi)[..., None], C((92, 148, 124))[None, None, :] * (0.8 + 0.3 * n_mid)[..., None], verd)
col[m] = cu[m]
rough[m] = (0.4 + 0.45 * verd)[m]
metal[m] = (0.9 * (1 - verd))[m]
# replacement plates in another council's paint (faded teal-green), not tinted with the machine's shade
painted(cl('paint2'), KIND.get('paint2', (92, 122, 104)), 0.62)
paint[cl('paint2')] = 0
for k, rgb, r0 in (('dial', (214, 204, 176), 0.5), ('amber', (196, 108, 26), 0.22), ('tag', (186, 168, 122), 0.9), ('rubber', (30, 29, 26), 0.82), ('wire_r', (112, 30, 22), 0.55), ('wire_y', (150, 118, 34), 0.55), ('core', (24, 24, 22), 0.75)):
    m = cl(k)
    col[m] = (C(rgb)[None, None, :] * (0.85 + 0.3 * n_mid)[..., None])[m]
    rough[m] = (r0 + 0.1 * (n_hi - 0.5))[m]
    metal[m] = 0.35 if k == 'core' else 0.0

# ---------------------------------------------------------------- decals: stencils on the paint, text on the brass plates (projected along the face normal, Blender axes)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'


def stencil_img(lines, w, h, hazard=False, bridges=False):
    im = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(im)
    y = 0
    for (txt, frac) in lines:
        f = ImageFont.truetype(FONT, int(h * frac))
        bb = d.textbbox((0, 0), txt, font=f)
        d.text(((w - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1]), txt, fill=255, font=f)
        y += int(h * frac * 1.15)
    # stencil bridges: thin gaps cut through the letters
    for x in range(0, w if bridges else 0, max(3, w // 23)):
        d.rectangle([x, 0, x + max(1, w // 160), h], fill=0) if (x // max(3, w // 23)) % 3 == 1 else None
    return np.asarray(im, np.float32) / 255.0


def project(mask, img, center, u_ax, v_ax, n_ax, size):
    # img (rows top-down) placed on the plane through center, u to the right, v up, facing n; size (w, h) in metres. Returns coverage 0..1
    c = np.array(center, np.float32)
    d = P - c
    u = (d @ np.array(u_ax, np.float32)) / size[0] + 0.5
    v = (d @ np.array(v_ax, np.float32)) / size[1] + 0.5
    face = (nrm @ np.array(n_ax, np.float32)) > 0.55
    ok = mask & face & (u >= 0) & (u < 1) & (v >= 0) & (v < 1)
    out = np.zeros((N, N), np.float32)
    h, w = img.shape[:2]
    xi = np.clip((u[ok] * w).astype(np.int32), 0, w - 1)
    yi = np.clip(((1 - v[ok]) * h).astype(np.int32), 0, h - 1)
    out[ok] = img[yi, xi]
    return out


def apply_stencil(a, rgb, alpha=0.9):
    # stencil paint wears with the paint under it
    a = a * alpha * np.clip(1 - steel_show - primer_show * 0.7, 0, 1) * (0.75 + 0.35 * n_hi)
    col[:] = lerp(col, C(rgb)[None, None, :], a)
    rough[:] = rough * (1 - a) + 0.7 * a


pm = cl('paint')
if kind == 'walker':
    TY = 1.06
    # chest plate: unit number over a hazard band with KEEP CLEAR (front = Blender +y)
    a = project(pm, stencil_img([(KIND['unit'], 0.62)], 600, 200, bridges=True), (0, 0.33, TY + 0.478), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.27, 0.09))
    apply_stencil(a, (32, 30, 26))
    hz = np.zeros((60, 600), np.float32)
    for x0 in range(-60, 600, 44):
        for yy in range(60):
            hz[yy, max(0, x0 + yy // 2):max(0, x0 + yy // 2 + 22)] = 1
    a = project(pm, hz, (0, 0.33, TY + 0.395), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.3, 0.03))
    apply_stencil(a, (34, 32, 28), 0.85)
    a = project(pm, stencil_img([('KEEP CLEAR', 0.8)], 600, 80), (0, 0.33, TY + 0.43), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.24, 0.032))
    apply_stencil(a, (34, 32, 28), 0.8)
    # yoke front: hazard stripes at both ends; unit number on the power pack's lid; L / R on the thigh plates
    for sx in (-1, 1):
        a = project(pm, hz, (sx * 0.3, 0.2, 1.665), (1, 0, 0), (0, 0, 1), (0, 1, 0), (0.15, 0.05))
        apply_stencil(a, (30, 28, 24), 0.85)
        a = project(pm, stencil_img([('L' if sx < 0 else 'R', 0.9)], 100, 100), (sx * 0.2, 0.12, 0.83), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.06, 0.06))
        apply_stencil(a, (30, 28, 24), 0.75)
    a = project(pm, stencil_img([(KIND['num'], 0.9)], 200, 120), (0, -0.4, 1.355), (1, 0, 0), (0, 0, 1), (0, -1, 0), (0.12, 0.07))
    apply_stencil(a, (30, 28, 24), 0.8)
    a = project(pm, stencil_img([(KIND['num'], 0.9)], 200, 120), (-0.08, 0.0, 2.24), (-1, 0, 0), (0, -1, 0), (0, 0, 1), (0.1, 0.06))
    apply_stencil(a, (30, 28, 24), 0.7)
    # maker's plates: embossed lines of text
    bm = cl('brass')
    plate = stencil_img([('MUNICIPAL', 0.22), ('SERVICE UNIT', 0.22), ('MOD W-2  1987', 0.2)], 300, 150)
    for (c0, u_ax, n_ax) in (((-0.236, -0.01, 1.97), (0, -1, 0), (-1, 0, 0)), ((0.194, -0.33, 1.48), (0, 1, 0), (1, 0, 0))):
        a = project(bm, plate, c0, u_ax, (0, 0, 1), n_ax, (0.095, 0.048))
        col[:] = lerp(col, C((60, 46, 24))[None, None, :], a * 0.8)
    # more stencils: DANGER 400 V on the pack, NO STEP on the yoke top, a big 07 on the left of the drum, 07 on the shins, hazard stripes on the steel toe caps
    a = project(pm, stencil_img([('DANGER', 0.45), ('400 V', 0.45)], 300, 120), (0, -0.405, 1.6), (1, 0, 0), (0, 0, 1), (0, -1, 0), (0.17, 0.068))
    apply_stencil(a, (30, 28, 24), 0.85)
    for sx in (-1, 1):
        a = project(pm, stencil_img([('NO STEP', 0.8)], 300, 90), (sx * 0.17, 0.03, 1.766), (-1, 0, 0), (0, -1, 0), (0, 0, 1), (0.13, 0.04))
        apply_stencil(a, (30, 28, 24), 0.8)
        a = project(pm, stencil_img([(KIND['num'], 0.9)], 160, 110), (sx * 0.2, 0.12, 0.34), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.06, 0.04))
        apply_stencil(a, (30, 28, 24), 0.75)
        a = project(cl('steel'), hz, (sx * 0.2, 0.26, 0.055), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.25, 0.05))
        apply_stencil(a, (196, 152, 40), 0.9)
    a = project(pm, stencil_img([(KIND['num'], 0.95)], 200, 150, bridges=True), (-0.4, 0.0, 1.46), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.17, 0.13))
    apply_stencil(a, (30, 28, 24), 0.8)

    # paper stickers: an inspection label on the head's right side, one on the waist hatch, a barcode on the left thigh
    def sticker(lines, center, u_ax, v_ax, n_ax, size, barcode=False):
        w, h = 240, int(240 * size[1] / size[0])
        al = Image.new('L', (w, h), 0)
        ImageDraw.Draw(al).rectangle([3, 3, w - 4, h - 4], fill=255)
        rng = np.random.default_rng(int(center[2] * 1000))
        A = np.asarray(al, np.float32) / 255.0
        A[: int(h * 0.35), int(w * (0.55 + 0.3 * rng.random())):] *= (rng.random((int(h * 0.35), 1)) > 0.5)
        ink = Image.new('L', (w, h), 0)
        d = ImageDraw.Draw(ink)
        if barcode:
            x0 = 12
            while x0 < w - 14:
                bw = int(1 + 3 * rng.random())
                d.rectangle([x0, 10, x0 + bw, h - 22], fill=255)
                x0 += bw + int(2 + 3 * rng.random())
        y = 8
        for (txt, fr) in lines:
            f = ImageFont.truetype(FONT, max(8, int(h * fr)))
            d.text((10, y if not barcode else h - 20), txt, fill=255, font=f)
            y += int(h * fr * 1.25)
        I = np.asarray(ink, np.float32) / 255.0
        pa = project(cls >= 0, A, center, u_ax, v_ax, n_ax, size)
        ia = project(cls >= 0, I, center, u_ax, v_ax, n_ax, size)
        pa = pa * (0.85 + 0.15 * n_hi) * (1 - 0.6 * sm(0.6, 0.8, n_chip))
        col[:] = lerp(col, C((214, 206, 182))[None, None, :] * (0.8 + 0.25 * n_mid)[..., None], pa)
        col[:] = lerp(col, C((40, 38, 48))[None, None, :], ia * pa * 0.85)
        rough[:] = rough * (1 - pa) + 0.85 * pa
        metal[:] = metal * (1 - pa)
        paint[:] = paint * (1 - pa)

    sticker([('INSPECTED', 0.2), ('DEPT. OF WORKS', 0.14), ('NEXT: 03/91', 0.14)], (0.232, 0.05, 1.99), (0, 1, 0), (0, 0, 1), (1, 0, 0), (0.075, 0.05))
    sticker([('SERVICE LOG', 0.2), ('OIL 500 h', 0.16)], (0.19, 0.236, 1.11), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.07, 0.045))
    sticker([('W2-0071987', 0.16)], (-0.2, 0.115, 0.69), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.07, 0.04), barcode=True)

if kind == 'lurcher':
    # unit name on the front plate over the vent, a hazard band round the belly pan, a big 3 on the left plate, the maker's plate on the head
    a = project(pm, stencil_img([(KIND['unit'], 0.62)], 600, 200, bridges=True), (0.03, 0.126, 1.435), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.17, 0.056))
    apply_stencil(a, (30, 30, 34))
    hz = np.zeros((60, 600), np.float32)
    for x0 in range(-60, 600, 44):
        for yy in range(60):
            hz[yy, max(0, x0 + yy // 2):max(0, x0 + yy // 2 + 22)] = 1
    for (c0, u_ax, n_ax) in (((0, 0.172, 1.13), (-1, 0, 0), (0, 1, 0)), ((0.0, -0.2, 1.12), (1, 0, 0), (0, -1, 0))):
        a = project(pm, hz, c0, u_ax, (0, 0, 1), n_ax, (0.34, 0.035))
        apply_stencil(a, (196, 150, 40), 0.85)
    a = project(pm, stencil_img([(KIND['num'], 0.95)], 150, 160, bridges=True), (-0.246, -0.06, 1.33), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.11, 0.12))
    apply_stencil(a, (232, 226, 210), 0.85)
    a = project(pm, stencil_img([(KIND['num'], 0.95)], 150, 160), (0.12, -0.02, 1.56), (0, 1, 0), (0, 0, 1), (1, 0, 0), (0.07, 0.075))
    apply_stencil(a, (30, 30, 34), 0.8)
    bm = cl('brass')
    plate = stencil_img([('CIVIC WORKS', 0.22), ('INSPECTION', 0.22), ('MOD L-3  1989', 0.2)], 300, 150)
    a = project(bm, plate, (-0.204, 0.22, 1.84), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.075, 0.038))
    col[:] = lerp(col, C((60, 46, 24))[None, None, :], a * 0.8)

    def sticker(lines, center, u_ax, v_ax, n_ax, size):
        w, h = 240, int(240 * size[1] / size[0])
        al = Image.new('L', (w, h), 0)
        ImageDraw.Draw(al).rectangle([3, 3, w - 4, h - 4], fill=255)
        rng = np.random.default_rng(int(center[2] * 1000))
        A = np.asarray(al, np.float32) / 255.0
        A[: int(h * 0.4), int(w * (0.5 + 0.3 * rng.random())):] *= (rng.random((int(h * 0.4), 1)) > 0.5)
        ink = Image.new('L', (w, h), 0)
        d = ImageDraw.Draw(ink)
        y = 8
        for (txt, fr) in lines:
            d.text((10, y), txt, fill=255, font=ImageFont.truetype(FONT, max(8, int(h * fr))))
            y += int(h * fr * 1.25)
        I = np.asarray(ink, np.float32) / 255.0
        pa = project(cls >= 0, A, center, u_ax, v_ax, n_ax, size) * (0.85 + 0.15 * n_hi) * (1 - 0.6 * sm(0.6, 0.8, n_chip))
        ia = project(cls >= 0, I, center, u_ax, v_ax, n_ax, size)
        col[:] = lerp(col, C((214, 206, 182))[None, None, :] * (0.8 + 0.25 * n_mid)[..., None], pa)
        col[:] = lerp(col, C((40, 38, 48))[None, None, :], ia * pa * 0.85)
        rough[:] = rough * (1 - pa) + 0.85 * pa
        metal[:] = metal * (1 - pa)
        paint[:] = paint * (1 - pa)

    sticker([('REPLACE CELL', 0.2), ('DUE 02/92', 0.16)], (0.08, -0.305, 1.15), (1, 0, 0), (0, 0, 1), (0, -1, 0), (0.07, 0.045))
    sticker([('INSPECTED', 0.2), ('DEPT. OF WORKS', 0.14)], (0.2, 0.17, 1.88), (0, 1, 0), (0, 0, 1), (1, 0, 0), (0.06, 0.04))
    sticker([('DO NOT', 0.22), ('OBSTRUCT', 0.22)], (-0.16, 0.132, 1.28), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.06, 0.04))

if kind == 'ticks':
    # CITY SWEEP over the bumper, a big 14 on the left of the dome, a hazard band round the back, a paper sticker on the screen pod
    a = project(pm, stencil_img([(KIND['unit'], 0.7)], 600, 120, bridges=True), (0, 0.252, 0.262), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.15, 0.03))
    apply_stencil(a, (34, 32, 28))
    a = project(pm, stencil_img([(KIND['num'], 0.95)], 200, 150, bridges=True), (-0.218, -0.01, 0.29), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.1, 0.075))
    apply_stencil(a, (34, 32, 28), 0.85)
    hz = np.zeros((60, 600), np.float32)
    for x0 in range(-60, 600, 44):
        for yy in range(60):
            hz[yy, max(0, x0 + yy // 2):max(0, x0 + yy // 2 + 22)] = 1
    a = project(pm, hz, (0, -0.262, 0.17), (1, 0, 0), (0, 0, 1), (0, -1, 0), (0.3, 0.03))
    apply_stencil(a, (196, 150, 40), 0.85)
    w_, h_ = 240, 144
    al = Image.new('L', (w_, h_), 0)
    ImageDraw.Draw(al).rectangle([3, 3, w_ - 4, h_ - 4], fill=255)
    ink = Image.new('L', (w_, h_), 0)
    dr = ImageDraw.Draw(ink)
    dr.text((10, 10), 'SERVICED', fill=255, font=ImageFont.truetype(FONT, 30))
    dr.text((10, 52), 'DEPOT 4  08/90', fill=255, font=ImageFont.truetype(FONT, 22))
    A = np.asarray(al, np.float32) / 255.0
    A[:50, 150:] *= 0
    pa = project(cls >= 0, A, (0.143, 0.17, 0.36), (0, 1, 0), (0, 0, 1), (1, 0, 0), (0.05, 0.03)) * (1 - 0.6 * sm(0.6, 0.8, n_chip))
    ia = project(cls >= 0, np.asarray(ink, np.float32) / 255.0, (0.143, 0.17, 0.36), (0, 1, 0), (0, 0, 1), (1, 0, 0), (0.05, 0.03))
    col[:] = lerp(col, C((214, 206, 182))[None, None, :] * (0.8 + 0.25 * n_mid)[..., None], pa)
    col[:] = lerp(col, C((40, 38, 48))[None, None, :], ia * pa * 0.85)
    rough[:] = rough * (1 - pa) + 0.85 * pa
    metal[:] = metal * (1 - pa)
    paint[:] = paint * (1 - pa)

if kind == 'hauler':
    # FRT-02 on the front plate, MAX LOAD on the left plate, a big 02 on the right flank, hazard bands on the bumper bar and the fork backs, maker's plate on the head
    a = project(pm, stencil_img([(KIND['unit'], 0.7)], 600, 160, bridges=True), (0.12, 0.37, 1.33), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.24, 0.065))
    apply_stencil(a, (34, 30, 26))
    a = project(pm, stencil_img([('MAX LOAD', 0.42), ('800 kg', 0.42)], 400, 160), (-0.505, -0.02, 1.25), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.2, 0.08))
    apply_stencil(a, (34, 30, 26), 0.85)
    a = project(cl('paint2') | pm, stencil_img([(KIND['num'], 0.95)], 220, 160, bridges=True), (0.505, 0.0, 1.45), (0, 1, 0), (0, 0, 1), (1, 0, 0), (0.24, 0.17))
    apply_stencil(a, (232, 224, 206), 0.85)
    hz = np.zeros((60, 600), np.float32)
    for x0 in range(-60, 600, 44):
        for yy in range(60):
            hz[yy, max(0, x0 + yy // 2):max(0, x0 + yy // 2 + 22)] = 1
    a = project(cl('steel'), hz, (0, 0.37, 0.93), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (1.0, 0.05))
    apply_stencil(a, (200, 156, 40), 0.9)
    bm = cl('brass')
    plate = stencil_img([('CIVIC WORKS', 0.22), ('FREIGHT LOADER', 0.22), ('MOD H-2  1984', 0.2)], 300, 150)
    a = project(bm, plate, (-0.284, 0.05, 1.96), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.095, 0.048))
    col[:] = lerp(col, C((60, 46, 24))[None, None, :], a * 0.8)

if kind == 'stilt':
    # LMP-5 on the front plate's left half, a big 5 on the left plate, HIGH VOLTAGE under the cable drum, the maker's plate on the head
    a = project(pm, stencil_img([(KIND['unit'], 0.7)], 500, 160, bridges=True), (-0.09, 0.17, 2.58), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.12, 0.04))
    apply_stencil(a, (34, 32, 28), 0.85)
    a = project(pm, stencil_img([(KIND['num'], 0.95)], 150, 160, bridges=True), (-0.225, -0.015, 2.5), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.1, 0.11))
    apply_stencil(a, (34, 32, 28), 0.85)
    a = project(pm, stencil_img([('HIGH', 0.42), ('VOLTAGE', 0.42)], 400, 160), (0.0, -0.19, 2.36), (1, 0, 0), (0, 0, 1), (0, -1, 0), (0.14, 0.055))
    apply_stencil(a, (30, 28, 24), 0.85)
    bm = cl('brass')
    plate = stencil_img([('CIVIC WORKS', 0.22), ('LIGHTING DEPT', 0.22), ('MOD S-5  1986', 0.2)], 300, 150)
    a = project(bm, plate, (-0.204, 0.03, 3.02), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.075, 0.038))
    col[:] = lerp(col, C((60, 46, 24))[None, None, :], a * 0.8)

if kind == 'lantern':
    # PA-9 on the hub's front plate, a big 9 on the head pod's right side, a hazard band round the hub's base, the maker's plate on the head
    a = project(pm, stencil_img([(KIND['unit'], 0.7)], 400, 160, bridges=True), (0.0, 0.215, 1.15), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.12, 0.045))
    apply_stencil(a, (232, 224, 206), 0.85)
    a = project(pm, stencil_img([(KIND['num'], 0.95)], 150, 160, bridges=True), (0.2, 0.58, 1.92), (0, 1, 0), (0, 0, 1), (1, 0, 0), (0.12, 0.13))
    apply_stencil(a, (232, 224, 206), 0.85)
    bm = cl('brass')
    plate = stencil_img([('CIVIC WORKS', 0.22), ('PUBLIC ADDRESS', 0.22), ('MOD P-9  1983', 0.2)], 300, 150)
    a = project(bm, plate, (-0.204, 0.58, 1.84), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.075, 0.038))
    col[:] = lerp(col, C((60, 46, 24))[None, None, :], a * 0.8)

if kind == 'warden':
    # SEC-1 on the front plate, a big 1 on the left flank, hazard stripes across the ram frame, the maker's plate on the head
    a = project(pm, stencil_img([(KIND['unit'], 0.7)], 500, 160, bridges=True), (0.25, 0.39, 1.45), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.22, 0.07))
    apply_stencil(a, (34, 32, 28))
    a = project(pm, stencil_img([(KIND['num'], 0.95)], 150, 160, bridges=True), (-0.58, 0.0, 1.3), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.2, 0.22))
    apply_stencil(a, (34, 32, 28), 0.85)
    hz = np.zeros((120, 600), np.float32)
    for x0 in range(-120, 600, 60):
        for yy in range(120):
            hz[yy, max(0, x0 + yy // 2):max(0, x0 + yy // 2 + 30)] = 1
    a = project(cl('steel'), hz, (0, 0.55, 0.98), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (1.3, 0.4))
    apply_stencil(a, (200, 156, 40), 0.9)
    bm = cl('brass')
    plate = stencil_img([('CIVIC WORKS', 0.22), ('SECURITY UNIT', 0.22), ('MOD W-1  1982', 0.2)], 300, 150)
    a = project(bm, plate, (-0.466, -0.03, 2.2), (0, -1, 0), (0, 0, 1), (-1, 0, 0), (0.095, 0.048))
    col[:] = lerp(col, C((60, 46, 24))[None, None, :], a * 0.8)

if kind == 'boss':
    # GC-01 across the back, 01 on the slam boom cover, PAY HERE on the bib, the Grid Co. name plaque on the plinth front
    a = project(pm, stencil_img([(KIND['unit'], 0.7)], 500, 160, bridges=True), (0.0, -0.45, 0.62), (1, 0, 0), (0, 0, 1), (0, -1, 0), (0.36, 0.11))
    apply_stencil(a, (34, 32, 28))
    a = project(pm, stencil_img([(KIND['num'], 0.95)], 160, 140, bridges=True), (0.30, 0.22, 0.74), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.09, 0.07))
    apply_stencil(a, (34, 32, 28), 0.85)
    a = project(cl('paint2'), stencil_img([('PAY HERE', 0.7)], 500, 120, bridges=True), (0.0, 0.235, 1.14), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.26, 0.06))
    apply_stencil(a, (196, 186, 160), 0.8)
    bm = cl('brass')
    plate = stencil_img([('GRID CO.', 0.42), ('PAY YOUR POWER HERE', 0.2)], 520, 140)
    a = project(bm, plate, (0.0, 0.57, 0.095), (-1, 0, 0), (0, 0, 1), (0, 1, 0), (0.25, 0.066))
    col[:] = lerp(col, C((60, 46, 24))[None, None, :], a * 0.85)

# ---------------------------------------------------------------- weathering over everything (bottom to top: blistered paint, rust, rust runs, grime, soot, oil, dust, mud, moss)
def layer(a, rgb, r_, m_=0.0, pkeep=0.0, var=None):
    a = np.clip(a, 0, 1)
    c = C(rgb)[None, None, :] * (var if var is not None else (0.85 + 0.3 * n_hi))[..., None]
    col[:] = lerp(col, c, a)
    rough[:] = rough * (1 - a) + r_ * a
    metal[:] = metal * (1 - a) + m_ * a
    paint[:] = paint * (1 - a * (1 - pkeep))


nonglass = np.ones((N, N), bool)
dirtable = ~np.isin(cls, [CLASSES.index(k) for k in ('plant', 'grassdry', 'moss', 'leafdry', 'mud', 'crack')])
rustable = dirtable & ~np.isin(cls, [CLASSES.index(k) for k in ('rubber', 'wire_r', 'wire_y', 'dial', 'amber', 'tag')])
paintish = np.isin(cls, [CLASSES.index(k) for k in ('paint', 'paint2', 'dark')])
# blistered paint round the blooms: paler, rough
bl = blister * paintish * 0.55
col[:] = lerp(col, col * 1.12 + 0.05, bl)
rough[:] = rough * (1 - bl) + 0.85 * bl
# rust: bloom cores orange-brown with a dark centre, bare-steel rust, crevices; bolts rusted through
# rustc / runc / rustdeep (KIND): rust colours (default the dark red-brown of the other kinds; the ivory boss uses orange-brown and ochre so rust never reads as blood)
R_COL = C(KIND.get('rustc', (96, 52, 28)))[None, None, :] * (0.65 + 0.55 * n_hi)[..., None] * (0.85 + 0.3 * n_mid)[..., None]
ra = np.clip(rust_hi + bolt_m * 0.75, 0, 1) * rustable * np.where(cl('chrome'), 0.25, 1.0) * np.where(cl('brass'), 0.25, 1.0)
col[:] = lerp(col, R_COL, ra * 0.92)
col[:] = lerp(col, C(KIND.get('rustdeep', (58, 30, 18)))[None, None, :], sm(0.75, 0.95, rust_hi) * bloom * 0.6)
rough[:] = rough * (1 - ra) + 0.88 * ra
metal[:] = metal * (1 - ra * 0.85)
paint[:] = paint * (1 - ra)
# rust runs from bolts and seams: orange-brown, strongest just under the source
layer(np.clip(rust_run * RUNS[1], 0, 1) * 0.9 * rustable, KIND.get('runc', (118, 60, 26)), 0.8, 0.0, 0.0, 0.65 + 0.5 * n_hi)
# grime: dark brown-black in crevices and low parts, a thinner film everywhere
# film: an extra blotchy dirt film over everything (KIND film, 0 = none), streaked down upright faces by the water runs
ga = np.clip(grime * 0.9 + 0.14 * lowz + 0.1 + KIND.get('film', 0.0) * (0.4 + 0.8 * sm(0.35, 0.7, n_mid) + 0.6 * water), 0, 1) * (~np.isin(cls, [CLASSES.index(k) for k in ('plant', 'grassdry', 'moss', 'leafdry', 'crack')]))
# grimek (KIND, default 1): how much of that grime lies on the machine (the boss v3, owner 20:44: aged ivory, about half of it clean)
layer(ga * KIND.get('grimek', 1.0), (34, 29, 22), 0.9, 0.0, 0.2, 0.8 + 0.4 * n_mid)
# soot over the vents (rises), oil weeping from bearings and rams (runs down, dark and glossy, dust stuck round its edges)
layer(soot * 0.9 * dirtable, (22, 21, 20), 0.95, 0.0, 0.0, 0.8 + 0.3 * n_hi)
oil_edge = sm(0.05, 0.3, oil) * (1 - sm(0.3, 0.6, oil))
layer(oil_edge * 0.5 * dirtable, (70, 56, 40), 0.9)
layer(sm(0.15, 0.6, oil) * 0.92 * dirtable, (16, 13, 9), 0.2, 0.1, 0.0, 0.8 + 0.4 * n_hi)
# dust on top faces: pale grey-brown, thickest in corners; less where oil is
da = dust * KIND.get('dustk', 0.5) * (1 - sm(0.2, 0.5, oil)) * dirtable
layer(da, (132, 122, 102), 0.95, 0.0, 0.3, 0.85 + 0.25 * n_mid)
# mud: dried, pale at the top of the band, darker and thicker low
mudc = lerp(C((112, 96, 72))[None, None, :], C((70, 56, 40))[None, None, :], sm(0.35, 0.0, H_)) * (0.8 + 0.4 * n_hi)[..., None]
ma = mud * 0.9 * dirtable
col[:] = lerp(col, mudc, ma)
rough[:] = rough * (1 - ma) + 0.95 * ma
metal[:] = metal * (1 - ma)
paint[:] = paint * (1 - ma)
mo = moss * rustable
layer(mo, (66, 86, 32), 1.0, 0.0, 0.0, 0.7 + 0.6 * n_hi)
# growth: grass and weeds (green, some yellowed), dry stalks, moss, dead leaves (browns to rust-orange), dried mud lumps, the screen crack
for k, c0, c1 in (('plant', (70, 112, 36), (138, 150, 52)), ('grassdry', (140, 122, 64), (182, 160, 92)), ('moss', (72, 100, 34), (128, 142, 50)), ('leafdry', (92, 56, 26), (168, 108, 44)), ('mud', (84, 70, 52), (128, 112, 86))):
    m = cl(k)
    t = sm(0.3, 0.7, fbm(P, 9.0 if k != 'leafdry' else 3.0, 3, 31))
    cc = lerp(C(c0)[None, None, :], C(c1)[None, None, :], t) * (0.8 + 0.35 * n_hi)[..., None]
    if k == 'leafdry':
        cc = cc * (0.75 + 0.35 * sm(0.3, 0.7, fbm(P, 60.0, 2, 32)))[..., None]
    col[m] = cc[m]
    rough[m] = 0.9
    metal[m] = 0
    paint[m] = 0
m = cl('crack')
col[m] = C((10, 10, 9))
rough[m] = 0.3
metal[m] = 0
paint[m] = 0
# baked occlusion into the colour (the game's lights are few; this is what gives the parts their depth)
occ = (0.45 + 0.55 * ao) * (0.6 + 0.4 * cav)
grow = cl('plant') | cl('grassdry') | cl('moss') | cl('leafdry') | cl('mud') | cl('crack')
occ[grow] = (0.7 + 0.3 * ao)[grow]
col[:] = col * occ[..., None]

# ---------------------------------------------------------------- height -> tangent-space normal (UV space: +x = +u, +y = +v; Blender rows go up in v)
h = (paint * 0.35 + primer_show * 0.15) * 1.0 + ra * (n_hi - 0.5) * 1.6 + bl * fbm(P, 90.0, 2, 13) * 1.2 + rust_run * 0.15 + ma * fbm(P, 70.0, 2, 14) * 0.6 + (n_mid - 0.5) * 0.25 * pm + mud * fbm(P, 60.0, 2, 11) * 1.2 - scratch * 0.4 + mo * fbm(P, 80.0, 2, 12) * 1.5
h = h.astype(np.float32)
gy, gx = np.gradient(h)
k = 1.6 * N / 2048.0
nx, ny = -gx * k, -gy * k
nl = np.sqrt(nx * nx + ny * ny + 1)
nmap = np.stack([nx / nl, ny / nl, 1 / nl], -1)
# rows bottom-up in Blender -> image rows top-down
flip = lambda a: a[::-1]
to8 = lambda a: (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
srgb = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0.0031308, None), 1 / 2.4) - 0.055)
# col was mixed in sRGB-ish values (colours above are sRGB); store as is
ims = {
    'base': Image.fromarray(to8(flip(col))),
    'orm': Image.fromarray(to8(flip(np.stack([np.clip(paint, 0, 1) * (cls == 0), rough, metal], -1)))),
    'nrm': Image.fromarray(to8(flip(nmap * 0.5 + 0.5))),
}
for k2, im in ims.items():
    if OUT and OUT != N:
        im = im.resize((OUT, OUT), Image.LANCZOS)
    im.save(os.path.join(odir, k2 + '.png'))
sm_ = [im.resize((512, 512), Image.LANCZOS) for im in ims.values()]
lk = Image.new('RGB', (512 * 3, 512))
for i, im in enumerate(sm_):
    lk.paste(im.convert('RGB'), (512 * i, 0))
lk.save(os.path.join(odir, 'look.png'))
pc_ = cl('paint') & on
print('painted', N, 'clean paint (paint mask > 0.5) on the painted parts', round(float((paint[pc_] > 0.5).mean()), 3), 'mean brightness', round(float(col[on].mean()), 3),
      'texels under rust runs / oil / soot / mud (> 0.3)', [round(float((x[on] > 0.3).mean()), 3) for x in (rust_run, oil, soot, mud)])
