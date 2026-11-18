# Step 2, second method: solve the base model's own shape sliders (MakeHuman CC0 targets) so Marla's resting face matches the user's front reference and the young-women profile norms.
# The face is predicted straight from the mesh (no render): slider moves are added to the dumped head, landmark vertices are projected through the same camera as the renders,
# and the same features as facetarget.py are measured. Slider values are found by damped least squares; result -> /home/claude/marla/target/shape4_weights.json (build.py flag shape4).
# Usage: python3 shape_solve.py
import json, gzip, math, sys, numpy as np
sys_argv0 = list(sys.argv)
CONFIG = dict(
    sliders=[('chin/chin-height', 'incr', 'decr'), ('chin/chin-width', 'incr', 'decr'), ('chin/chin-prominent', 'incr', 'decr'), ('chin/chin-jaw-drop', 'incr', 'decr'),
             ('mouth/mouth-trans', 'up', 'down'), ('mouth/mouth-upperlip-height', 'incr', 'decr'), ('mouth/mouth-lowerlip-height', 'incr', 'decr'), ('mouth/mouth-scale-horiz', 'incr', 'decr'),
             ('nose/nose-scale-vert', 'incr', 'decr'), ('nose/nose-trans', 'up', 'down'), ('nose/nose-scale-horiz', 'incr', 'decr'), ('head/head-fat', 'incr', 'decr'), ('nose/nose-base', 'up', 'down'), ('mouth/mouth-scale-vert', 'incr', 'decr'), ('head/head-scale-vert', 'incr', 'decr'), ('cheek/LR-cheek-volume', 'incr', 'decr')],
    limit=1.0, damp=0.15, iters=8,
    # feature weights: front features in eye-distance units (1 / tolerance), depth features in mm (1 / SD of the norm)
    front=('eye_h', 'brow_to_eye', 'nose_w', 'nose_len', 'mouth_w', 'upper_lip', 'lower_lip', 'lip_to_nose', 'nose_to_chin', 'jaw', 'lowjaw', 'chin_w', 'mouth_corner_drop'),
    depth=dict(nose_tip=(13.9, 1.6), upper_lip_d=(1.3, 1.8), lower_lip_d=(-1.0, 2.8), chin_d=(-2.6, 2.5)),
    cam=(0.0, -0.95, -0.02), tgt=(0.0, -0.05, -0.035), lens=85.0, sensor=36.0, W=1040, H=1280)
D = '/home/claude/ref/mpfb2/src/mpfb/data/targets/'; du = np.load('/home/claude/marla/out/face_dump.npz'); B0 = du['B']; HV = du['head_v']; ex, ey, ez = du['eye']
LM = np.load('/home/claude/marla/marla_landmarks3d_oldface.npy'); T = json.load(open('/home/claude/marla/target/target_front.json')); Qr = np.array(T['points']); TV = T['values']; TOL = T['tol']
H0 = B0[HV]; from scipy.spatial import cKDTree
LMV = {i: int(HV[cKDTree(H0).query(LM[i])[1]]) for i in range(68) if not np.isnan(LM[i]).any()}      # the head vertex under each detected point
def tdelta(name):
    d = np.zeros_like(B0)
    for l in gzip.open(D + name + '.target.gz', 'rt'):
        t = l.split()
        if len(t) == 4 and not l.startswith('#'): i = int(t[0]); d[i] += np.array([float(t[1]), -float(t[3]), float(t[2])]) * 0.1
    return d
SL = []
for base, pos, neg in CONFIG['sliders']:
    if 'LR' in base: dp = tdelta(base.replace('LR', 'l').replace('-cheek', '-cheek') + '-' + pos) + tdelta(base.replace('LR', 'r') + '-' + pos); dn = tdelta(base.replace('LR', 'l') + '-' + neg) + tdelta(base.replace('LR', 'r') + '-' + neg)
    else: dp = tdelta(base + '-' + pos); dn = tdelta(base + '-' + neg)
    SL.append((base, pos, neg, dp, dn))
C_ = np.array(CONFIG['cam']) + (0, 0, ez); T_ = np.array(CONFIG['tgt']) + (0, 0, ez); fw_ = (T_ - C_) / np.linalg.norm(T_ - C_); rt_ = np.cross(fw_, (0, 0, 1)); rt_ /= np.linalg.norm(rt_); up_ = np.cross(rt_, fw_); fpx = CONFIG['lens'] / CONFIG['sensor'] * max(CONFIG['W'], CONFIG['H'])
def proj(P): d = P - C_; dep = d @ fw_; return np.c_[fpx * (d @ rt_) / dep, -fpx * (d @ up_) / dep]      # image x right, y down
def shape(w):
    B = B0.copy()
    for wi, (_, _, _, dp, dn) in zip(w, SL): B += (wi * dp) if wi > 0 else (-wi * dn)
    return B
def features(B):
    Q = {i: proj(B[v][None])[0] for i, v in LMV.items()}; eR = np.mean([Q[i] for i in range(36, 42)], 0); eL = np.mean([Q[i] for i in range(42, 48)], 0); io = np.linalg.norm(eL - eR); o = (eR + eL) / 2
    n = {i: (q - o) / io for i, q in Q.items()}; d = lambda a, b: float(np.linalg.norm(n[a] - n[b]))
    H2 = (proj(B[HV]) - o) / io                                              # silhouette widths of the lower face at the heights where the outline points sit on the reference
    ym = (n[48][1] + n[54][1]) / 2; yc = n[8][1]; fr = lambda a: (Qr[a][1] - (Qr[48][1] + Qr[54][1]) / 2) / (Qr[8][1] - (Qr[48][1] + Qr[54][1]) / 2)
    def width(f_):
        yy = ym + f_ * (yc - ym); band = H2[np.abs(H2[:, 1] - yy) < 0.02]; return float(band[:, 0].max() - band[:, 0].min()) if len(band) else np.nan
    F = dict(eye_h=float(np.mean([n[i][1] for i in (40, 41, 46, 47)]) - np.mean([n[i][1] for i in (37, 38, 43, 44)])), brow_to_eye=float(np.mean([n[i][1] for i in (37, 38, 43, 44)]) - np.mean([n[i][1] for i in range(17, 27)])), nose_w=d(31, 35), nose_len=n[33][1] - n[27][1], mouth_w=d(48, 54), upper_lip=n[62][1] - n[51][1], lower_lip=n[57][1] - n[66][1], lip_to_nose=n[51][1] - n[33][1], nose_to_chin=n[8][1] - n[33][1],
             jaw=width(fr(4)), lowjaw=width(fr(5)), chin_w=width(fr(6)), mouth_corner_drop=(n[48][1] + n[54][1]) / 2 - n[62][1])
    fwd = lambda v: -B[v][1]; sn = fwd(LMV[33]); mid = B[HV][(np.abs(B[HV][:, 0]) < 0.002) & (B[HV][:, 2] < B[LMV[57]][2] - 0.006) & (B[HV][:, 2] > B[LMV[8]][2])]
    F.update(eye_gap_mm=1000 * float(np.linalg.norm(B[LMV[36]:LMV[36] + 1].mean(0) * 0 + np.mean([B[LMV[i]] for i in range(36, 42)], 0) - np.mean([B[LMV[i]] for i in range(42, 48)], 0))), nose_tip=1000 * (fwd(LMV[30]) - sn), upper_lip_d=1000 * (fwd(LMV[51]) - sn), lower_lip_d=1000 * (fwd(LMV[57]) - sn), chin_d=1000 * (-mid[:, 1].min() - sn))
    return F
def target_and_scale():
    t = {}; s = {}
    for k in CONFIG['front']:
        if k in ('jaw', 'lowjaw', 'chin_w'):
            a, b = {'jaw': (4, 12), 'lowjaw': (5, 11), 'chin_w': (6, 10)}[k]; t[k] = float(np.linalg.norm(Qr[a] - Qr[b])); s[k] = 0.05 * t[k]
        elif k == 'mouth_corner_drop': t[k] = TV[k]; s[k] = TOL[k]
        else: t[k] = TV[k]; s[k] = TOL[k] * abs(TV[k])
    for k, (m, sd) in CONFIG['depth'].items(): t[k] = m; s[k] = sd
    t['eye_gap_mm'] = None; s['eye_gap_mm'] = 0.5      # the eyes must stay where they are: every front length is measured in eye distances, so moving the eyes apart fakes a shorter face (the first solve widened the head and put the eyes 68 mm apart)
    return t, s
TG, SC = target_and_scale(); KEYS = list(TG); TG['eye_gap_mm'] = features(B0)['eye_gap_mm']
# calibration: the mesh point under a detected point is not exactly where the detector puts it on a picture, so aim each front feature at the CHANGE the render needs (reference minus the original render), not at the reference value
import sys; sys.argv = ['x']; sys.path.insert(0, '/home/claude/marla/scripts'); import facetarget as FT
REFINE = len(sys_argv0) > 1 and sys_argv0[1] == 'refine'      # refine: calibrate at the last solution (its render) instead of the original face, and start from it
W0 = np.zeros(len(SL))
if REFINE:
    old = {nm: w_ for nm, w_ in json.load(open('/home/claude/marla/target/shape4_weights.json'))['targets']}
    for j, (base, pos, neg, _, _) in enumerate(SL):
        key = base.replace('LR', 'l'); W0[j] = old.get(key + '-' + pos, 0) - old.get(key + '-' + neg, 0)
RP = '/home/claude/marla/out_shape4/e_neutral_check.png' if REFINE else '/home/claude/marla/out/e_neutral_check.png'
Qo = FT.points(RP)[0]; RO = FT.measure(RP); F0m = features(shape(W0))
RO.update(jaw=float(np.linalg.norm(Qo[4] - Qo[12])), lowjaw=float(np.linalg.norm(Qo[5] - Qo[11])), chin_w=float(np.linalg.norm(Qo[6] - Qo[10])))
for k in CONFIG['front']: TG[k] = F0m[k] + (TG[k] - RO[k])
def resid(w): F = features(shape(w)); return np.array([(F[k] - TG[k]) / SC[k] for k in KEYS]), F
w = W0.copy(); r, F0 = resid(w); print('start: sum of squared misses %.1f' % (r @ r)); best = (r @ r, w.copy(), r, F0)
for it in range(CONFIG['iters']):
    J = np.zeros((len(KEYS), len(SL)))
    for j in range(len(SL)):
        e = np.zeros(len(SL)); e[j] = 0.05; J[:, j] = (resid(np.clip(w + e, -1, 1))[0] - resid(np.clip(w - e, -1, 1))[0]) / 0.1
    step = np.linalg.solve(J.T @ J + CONFIG['damp'] * np.eye(len(SL)), -J.T @ r); w = np.clip(w + step, -CONFIG['limit'], CONFIG['limit']); r, F = resid(w)
    print('round %d: sum of squared misses %.2f' % (it + 1, r @ r))
    if r @ r < best[0]: best = (r @ r, w.copy(), r, F)
_, w, r, F = best; print('kept the best round: %.2f' % best[0])
print('%-18s %8s %8s %8s %8s' % ('feature', 'target', 'before', 'after', 'misses')); bad = 0
for k, rr in zip(KEYS, r):
    print('%-18s %8.3f %8.3f %8.3f %8.1f %s' % (k, TG[k], F0[k], F[k], rr, '' if abs(rr) <= 1 else '<- outside tolerance')); bad += abs(rr) > 1
print('%d of %d outside tolerance (predicted from the mesh)' % (bad, len(KEYS)))
out = []
for wi, (base, pos, neg, _, _) in zip(w, SL):
    if abs(wi) < 0.02: continue
    nm = base + '-' + (pos if wi > 0 else neg)
    if 'LR' in base: out += [(nm.replace('LR', 'l'), round(abs(float(wi)), 3)), (nm.replace('LR', 'r'), round(abs(float(wi)), 3))]
    else: out.append((nm, round(abs(float(wi)), 3)))
    print('  slider %-34s %+.3f' % (base, wi))
json.dump(dict(targets=out, note='added on top of Marla targets; solved by shape_solve.py'), open('/home/claude/marla/target/shape4_weights.json', 'w'), indent=1)
