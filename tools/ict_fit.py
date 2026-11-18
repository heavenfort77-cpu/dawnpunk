# Track B (realism): fit the USC ICT-FaceKit head (MIT licence; 26,719 vertices, 100 scanned identity shapes, 53 scanned expressions on the same mesh) to Marla's current face.
# Similarity transform from the 68 landmarks, then identity weights by point-to-plane fitting to Marla's face surface (regularised), repeated.
# Output /home/claude/marla/ict_fit.npz: fitted neutral (builder coordinates), faces, expression deltas, landmark ids. Usage: python3 ict_fit.py
import json, numpy as np, os, sys
from scipy.spatial import cKDTree
CFG = dict(lam=0.02, iters=12, region=6706, far=0.006, id_n=100)
K = '/home/claude/ext/ICT-FaceKit/FaceXModel/'; IDD = '/home/claude/ext/ict_identity/'
def read_obj(p, faces=False):
    V, F = [], []
    for l in open(p):
        if l.startswith('v '): V.append(l.split()[1:4])
        elif faces and l.startswith('f '): F.append([int(t.split('/')[0]) - 1 for t in l.split()[1:]])
    V = np.array(V, float); V = np.c_[V[:, 0], -V[:, 2], V[:, 1]]
    return (V, F) if faces else V
V0, F0 = read_obj(K + 'generic_neutral_mesh.obj', True); VI = json.load(open(K + 'vertex_indices.json')); LMI = np.array(VI['idx_to_landmark_verts'])
IDS = np.stack([read_obj(IDD + 'identity%03d.obj' % i) - V0 for i in range(CFG['id_n'])])      # identity deltas, kit units
print('kit: %d vertices, %d faces; identity delta size (kit units) median %.3f' % (len(V0), len(F0), np.median(np.linalg.norm(IDS, axis=2).max(1))))
du = np.load('/home/claude/marla/out_shape5/face_dump.npz'); P, N = du['P'], du['N']; LM = np.load('/home/claude/marla/marla_landmarks3d_shape5.npy'); ok = ~np.isnan(LM).any(1)
KD = cKDTree(P)
def umeyama(A, B):      # B ~ s R A + t
    ma, mb = A.mean(0), B.mean(0); A0, B0 = A - ma, B - mb; U, S, Vt = np.linalg.svd(B0.T @ A0 / len(A)); D = np.eye(3); D[2, 2] = np.sign(np.linalg.det(U @ Vt)); R = U @ D @ Vt
    s = np.trace(np.diag(S) @ D) / (A0 ** 2).sum(1).mean(); return s, R, mb - s * R @ ma
w = np.zeros(CFG['id_n']); reg = np.arange(CFG['region'])
for it in range(CFG['iters']):
    X = V0 + np.tensordot(w, IDS, 1); s, R, t = umeyama(X[LMI[ok]], LM[ok]); Y = s * X @ R.T + t
    d, j = KD.query(Y[reg]); use = d < CFG['far'] * (3 if it < 3 else 1); r = reg[use]; n = N[j[use]]; p = P[j[use]]
    A = np.einsum('kvc,vc->vk', s * IDS[:, r] @ R.T, n); b = ((p - Y[r]) * n).sum(1)
    w = w + np.linalg.solve(A.T @ A + CFG['lam'] * len(r) * np.eye(len(w)) * 1e-6 + 1e-9 * np.eye(len(w)), A.T @ b - CFG['lam'] * len(r) * 1e-6 * w)
    Y = s * (V0 + np.tensordot(w, IDS, 1)) @ R.T + t; dd = np.abs(((Y[r] - p) * n).sum(1))
    print('round %2d: %d face points matched, distance to her face median %.2f mm, 95%% %.2f mm, landmarks %.2f mm, |w| %.2f' % (it + 1, len(r), 1000 * np.median(dd), 1000 * np.percentile(dd, 95), 1000 * np.linalg.norm(Y[LMI[ok]] - LM[ok], axis=1).mean(), np.linalg.norm(w)))
EX = {}
for f in sorted(os.listdir(K)):
    if f.endswith('.obj') and f != 'generic_neutral_mesh.obj': EX[f[:-4]] = s * (read_obj(K + f) - V0) @ R.T
np.savez('/home/claude/marla/ict_fit.npz', V=Y, F=np.array([q + [q[-1]] * (4 - len(q)) for q in F0], np.int32), w=w, s=s, R=R, t=t, lmi=LMI, **{'ex_' + k: v for k, v in EX.items()})
print('saved: fitted head, %d expressions, kit scale %.5f' % (len(EX), s))
