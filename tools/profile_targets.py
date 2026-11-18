# Targets for the profile fix: the scan average's lower face (nose, mouth, chin) placed on Marla by fitting the two upper faces (brows, eyes, nose bridge) with rotation, even scale and shift,
# so a head tilt in either is not counted as flatness. Moves are depth (front-to-back) and height only; widths stay Marla's.
# Writes /home/claude/marla/profile_targets.npz (source points, target points) for build.py flag profile2.
import json, numpy as np
D = '/home/claude/ext/ICT-FaceKit/FaceXModel/'; LM = np.load('/home/claude/marla/marla_landmarks3d_oldface.npy'); du = np.load('/home/claude/marla/out/face_dump.npz'); P = du['P']
raw = np.array([[float(x) for x in l.split()[1:4]] for l in open(D + 'generic_neutral_mesh.obj') if l.startswith('v ')]); V = np.c_[raw[:, 0], -raw[:, 2], raw[:, 1]]
J = json.load(open(D + 'vertex_indices.json')); LI = V[np.array(J['idx_to_landmark_verts'])]
upper = [i for i in list(range(17, 31)) + list(range(36, 48)) if not np.isnan(LM[i]).any()]
def umeyama(src, dst):
    ms, md = src.mean(0), dst.mean(0); a, b = src - ms, dst - md; U, S, Vt = np.linalg.svd(b.T @ a / len(src)); d = np.sign(np.linalg.det(U @ Vt)); Dg = np.diag([1, 1, d])
    R = U @ Dg @ Vt; s = np.trace(np.diag(S) @ Dg) / (a ** 2).sum(1).mean(); return s, R, md - s * R @ ms
s, R, t = umeyama(LI[upper], LM[upper]); A = (s * (R @ LI.T)).T + t
pitch = np.degrees(np.arctan2(R[2, 1], R[1, 1])); print('upper-face fit: scale %.4f, scan tilted %.1f deg relative to Marla, fit error %.1f mm' % (s, pitch, 1000 * np.linalg.norm(A[upper] - LM[upper], axis=1).mean()))
lower = [i for i in [8] + list(range(30, 36)) + list(range(48, 68)) if not np.isnan(LM[i]).any()]
# chin: use the most forward midline point of the chin on both heads (the outline landmark is not the same point on the two)
def chin_front(Q, zlo, zhi): m = Q[(np.abs(Q[:, 0]) < 0.002) & (Q[:, 2] > zlo) & (Q[:, 2] < zhi)]; return m[np.argmin(m[:, 1])]
Am = (s * (R @ V[:9409].T)).T + t; cM = chin_front(P, LM[8, 2], LM[57, 2]); cS = chin_front(Am, A[8, 2], A[57, 2])
src = [LM[i] for i in lower] + [cM]; dst_full = [A[i] for i in lower] + [cS]
dst = [np.array((p[0], q[1], q[2])) for p, q in zip(src, dst_full)]      # keep Marla's width, take depth and height from the scan
# each part moves up or down as a whole, so Marla keeps her own mouth shape from the front (moving every point to the scan's heights turned her mouth corners down)
for grp_ in (range(30, 36), range(48, 68)):
    ks_ = [k for k, i in enumerate(lower) if i in grp_]; mv_ = np.mean([dst[k] - src[k] for k in ks_], 0)
    for k in ks_: dst[k] = np.array((src[k][0], dst[k][1], src[k][2] + mv_[2]))      # height: the whole part moves together (keeps her mouth corners where they are relative to the middle); depth: point by point, so the lips curve forward like the real average
inner_ = [] and [k for k, i in enumerate(lower) if 60 <= i <= 67]      # the inner lip line keeps the lips sealed: all its points move up by the same amount
if inner_:
    dz_ = float(np.mean([dst[k][2] - src[k][2] for k in inner_]))
    for k in inner_: dst[k][2] = src[k][2] + dz_
    for k, i in enumerate(lower):
        if i in (50, 51, 52) or i in (56, 57, 58): dst[k][2] = src[k][2] + (dst[k][2] - src[k][2] + dz_) / 2      # outer lip middle: halfway between its own move and the seal's
for nm, i in (('nose tip', 30), ('upper lip', 51), ('lower lip', 57)): k = lower.index(i); print('%-10s forward %+5.1f mm, up %+5.1f mm' % (nm, -1000 * (dst[k][1] - src[k][1]), 1000 * (dst[k][2] - src[k][2])))
print('chin front forward %+5.1f mm, up %+5.1f mm; chin bottom up %+5.1f mm' % (-1000 * (dst[-1][1] - src[-1][1]), 1000 * (dst[-1][2] - src[-1][2]), 1000 * (dst[0][2] - src[0][2])))
anch = [LM[i] for i in upper]
np.savez('/home/claude/marla/profile_targets.npz', src=np.array(src), dst=np.array(dst), anchors=np.array(anch), ids=np.array(lower + [-1])); print('saved', len(src), 'targets,', len(anch), 'fixed upper-face points')
