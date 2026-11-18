# Moves the sculpted expression shapes of the USC ICT-FaceKit head (MIT licence) onto Marla's own face mesh.
# 1. finds 68 landmarks on Marla's front render and places them on her mesh; 2. warps the kit's neutral head onto them; 3. for every Marla face vertex takes the motion of the nearest matching kit surface (position and facing).
# Usage: python3 ict_transfer.py <front render of the rest face>   -> /home/claude/marla/ict_units.npz
import sys, json, os, math, numpy as np, cv2, dlib, face_recognition_models as m
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree
CFG_SM = dict(amount=0.7, iters=8, r0=0.016, r1=0.024, mouth=0.6, mr0=0.010, mr1=0.022)      # smoothing round the eyes: full inside r0 (m) of an eye centre, fading out by r1
CFG = dict(SC=None, normal_w=0.006, k=4, far=0.008, lens=85.0, sensor=36.0, cam=(0.0, -0.95, -0.02), tgt=(0.0, -0.05, -0.035), smooth=1e-7)
D = '/home/claude/ext/ICT-FaceKit/FaceXModel/'; du = np.load(os.environ.get('DUMP', '/home/claude/marla/out/face_dump.npz')); P, N, fid = du['P'], du['N'], du['fid']; ex, ey, ez = du['eye']
def load(name, sc):
    V = np.array([[float(x) for x in l.split()[1:4]] for l in open(D + name + '.obj') if l.startswith('v ')]); return np.c_[V[:, 0], -V[:, 2], V[:, 1]] * sc
raw = load('generic_neutral_mesh', 1.0); e = raw[21451:22221]; SC = 0.024 / float((e.max(0) - e.min(0)).max()); V0 = raw * SC
F = [[int(q.split('/')[0]) - 1 for q in l.split()[1:]] for l in open(D + 'generic_neutral_mesh.obj') if l.startswith('f ')]
J = json.load(open(D + 'vertex_indices.json')); LI_idx = np.array(J['idx_to_landmark_verts'])
# ---- Marla's landmarks: 2D on the render, then the front-most mesh vertex under each
im = cv2.imread(sys.argv[1]); H, W = im.shape[:2]; g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY); pr = dlib.shape_predictor(m.pose_predictor_model_location()); f = max(dlib.get_frontal_face_detector()(g, 1), key=lambda r: r.width()); sh = pr(g, f)
L2 = np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], float)
C = np.array(CFG['cam']) + (0, 0, ez); T = np.array(CFG['tgt']) + (0, 0, ez); fw = (T - C) / np.linalg.norm(T - C); rt = np.cross(fw, (0, 0, 1)); rt /= np.linalg.norm(rt); up = np.cross(rt, fw); fpx = CFG['lens'] / CFG['sensor'] * max(W, H)
d = P - C; dep = d @ fw; px = W / 2 + fpx * (d @ rt) / dep; py = H / 2 - fpx * (d @ up) / dep; front = N @ fw < 0.2
use = [i for i in range(68) if i >= 17 or i == 8]; LM = []
for i in use:
    r = np.hypot(px - L2[i, 0], py - L2[i, 1]); cand = np.where((r < max(3.0, np.sort(r[front])[3])) & front)[0]; LM.append(P[cand[np.argmin(dep[cand])]])
LM = np.array(LM); LI = V0[LI_idx[use]]
LMfull = np.full((68, 3), np.nan); LMfull[use] = LM; np.save('/home/claude/marla/marla_landmarks3d.npy', LMfull)
# ---- kit head warped onto Marla: affine fit, then a smooth residual warp
X = np.c_[LI, np.ones(len(LI))]; A = np.linalg.lstsq(X, LM, rcond=None)[0]; lin = A[:3].T
aff = lambda Q: np.c_[Q, np.ones(len(Q))] @ A
res = RBFInterpolator(aff(LI), LM - aff(LI), kernel='thin_plate_spline', smoothing=CFG['smooth'])
NF = 11248; Wv = aff(V0[:NF]); Wv = Wv + res(Wv)
print('scale of the kit to metres %.5f; affine stretch x %.2f y %.2f z %.2f; landmark error before warp %.1f mm' % (SC, *np.linalg.norm(lin, axis=0), 1000 * np.linalg.norm(aff(LI) - LM, axis=1).mean()))
nrm = np.zeros((NF, 3))
for q in F:
    if max(q) >= NF: continue
    a, b, c = Wv[q[0]], Wv[q[1]], Wv[q[2]]; n = np.cross(b - a, c - a)
    for v in q: nrm[v] += n
nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
if (nrm[LI_idx[30]] @ np.array([0, -1, 0])) < 0: nrm = -nrm
nw = CFG['normal_w']; tree = cKDTree(np.c_[Wv, nw * nrm]); dist, idx = tree.query(np.c_[P, nw * N], k=CFG['k']); wgt = 1 / np.maximum(dist, 1e-6) ** 2; wgt /= wgt.sum(1, keepdims=True)
pd = np.linalg.norm(Wv[idx[:, 0]] - P, axis=1); fade = np.clip(1 - (pd - CFG['far'] / 2) / (CFG['far'] / 2), 0, 1)
ff = (np.abs(P[:, 0]) < 0.065) & (P[:, 2] > ez - 0.105) & (P[:, 2] < ez + 0.045) & (P[:, 1] < ey + 0.045)      # the front of the face
print('match distance on the front of the face (%d vertices): median %.2f mm, 95%% %.2f mm, faded out %d' % (int(ff.sum()), 1000 * np.median(pd[ff]), 1000 * np.percentile(pd[ff], 95), int((fade[ff] < 0.5).sum())))
print('landmarks: eye corner L %s kit %s | mouth corner %s kit %s | chin %s kit %s' % (np.round(LM[use.index(45)] * 1000), np.round(aff(LI)[use.index(45)] * 1000), np.round(LM[use.index(54)] * 1000), np.round(aff(LI)[use.index(54)] * 1000), np.round(LM[use.index(8)] * 1000), np.round(aff(LI)[use.index(8)] * 1000)))
out = {}
for fn in sorted(os.listdir(D)):
    if not fn.endswith('.obj') or fn.startswith(('generic', 'identity')): continue
    dl = (load(fn[:-4], SC)[:NF] - V0[:NF]) @ lin.T; out[fn[:-4]] = ((dl[idx] * wgt[:, :, None]).sum(1) * fade[:, None]).astype(np.float32)
# smooth the moved shapes around the eyes: nearest-surface copying leaves small kinks where the two heads' lids differ (a pale fold showed at the inner eye corner in the smile)
pos_ = {int(v): k for k, v in enumerate(fid)}; nb_ = [[] for _ in fid]
for a_, b_ in du['edges']:
    if int(a_) in pos_ and int(b_) in pos_: nb_[pos_[int(a_)]].append(pos_[int(b_)]); nb_[pos_[int(b_)]].append(pos_[int(a_)])
near_ = np.minimum(np.linalg.norm(P - (ex, ey, ez), axis=1), np.linalg.norm(P - (-ex, ey, ez), axis=1)); wsm_ = CFG_SM['amount'] * np.clip(1 - (near_ - CFG_SM['r0']) / (CFG_SM['r1'] - CFG_SM['r0']), 0, 1)
mc_ = [LMfull[48], LMfull[54]]      # and round the mouth corners, where the cheek fold meets the lips (a crease was cut into the cheek in the smile)
nearm_ = np.minimum(np.linalg.norm(P - mc_[0], axis=1), np.linalg.norm(P - mc_[1], axis=1)); wsm_ = np.maximum(wsm_, CFG_SM['mouth'] * np.clip(1 - (nearm_ - CFG_SM['mr0']) / (CFG_SM['mr1'] - CFG_SM['mr0']), 0, 1))
for k_ in out:
    d_ = out[k_].astype(np.float64)
    for it_ in range(CFG_SM['iters']):
        av_ = np.array([d_[n].mean(0) if n else d_[i] for i, n in enumerate(nb_)]); d_ = d_ * (1 - wsm_[:, None]) + av_ * wsm_[:, None]
    out[k_] = d_.astype(np.float32)
print('smoothed around the eyes: %d vertices, %d passes' % (int((wsm_ > 0).sum()), CFG_SM['iters']))
# ---- the kit's teeth, gums and tongue, placed in Marla's mouth as one rigid piece (rotation and even scale from the fit, so tooth shapes are not stretched), anchored at the upper front teeth
U_, S_, Vt_ = np.linalg.svd(lin); Rm_ = U_ @ Vt_; sm_ = float(np.prod(S_) ** (1 / 3)); M_ = sm_ * Rm_
mv0_, mv1_ = 14062, 21451; MV = V0[mv0_:mv1_]; isT = np.arange(mv0_, mv1_) >= 17039
up_ = isT & (MV[:, 2] > np.median(MV[isT, 2])); fr_ = np.where(up_)[0][np.argsort(MV[up_, 1])[:30]]; anc_ = MV[fr_].mean(0)
anc_[0] = 0.0; tgt_ = aff(anc_[None]); tgt_ = (tgt_ + res(tgt_))[0]; tgt_[0] = 0.0; MVm = (MV - anc_) @ M_.T + tgt_
MF = [[v - mv0_ for v in q] for q in F if all(mv0_ <= v < mv1_ for v in q)]
mouth = dict(mouth_V=MVm.astype(np.float32), mouth_F=np.array([q + [q[-1]] * (4 - len(q)) for q in MF], np.int32), mouth_isT=isT, mouth_scale=sm_)
for fn in sorted(os.listdir(D)):
    if fn.endswith('.obj') and not fn.startswith(('generic', 'identity')): dm_ = (load(fn[:-4], SC)[mv0_:mv1_] - MV) @ M_.T; mouth['mouthd_' + fn[:-4]] = dm_.astype(np.float32)
np.savez(os.environ.get('MOUTH', '/home/claude/marla/ict_mouth.npz'), **mouth); print('mouth: %d vertices, %d faces, scale %.2f, upper front teeth at %s mm' % (len(MVm), len(MF), sm_, np.round(tgt_ * 1000, 1)))
np.savez(os.environ.get('UNITS', '/home/claude/marla/ict_units.npz'), fid=fid, **out); print('saved', len(out), 'shapes; largest move mouthSmile_L %.1f mm' % (1000 * np.linalg.norm(out['mouthSmile_L'], axis=1).max()))
