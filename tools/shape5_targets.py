# Step 2 finishing correction on top of the solved sliders (shape4): from a render's residuals against the user's reference, the nose base, the mouth and the chin each move up or down as whole pieces
# (no point-by-point lip moves: those made the lips wavy), and the jaw outline is pulled in to the reference's widths. Eyes and brows held still. Writes /home/claude/marla/shape5_targets.npz (build.py flag shape5).
# Usage: python3 shape5_targets.py <check render of the shape4 face>
import sys, json, numpy as np
args = sys.argv[1:]; sys.argv = ['x']; sys.path.insert(0, '/home/claude/marla/scripts'); import facetarget as FT
CONFIG = dict(gain=1.0, eye_hold=0.019, jaw_gain=1.0)
du0 = np.load('/home/claude/marla/out_shape4/face_dump.npz'); du = np.load('/home/claude/marla/out_step3/face_dump.npz'); B = du['B']; HV = du['head_v']; ex, ey, ez = du['eye']; LM0 = np.load('/home/claude/marla/marla_landmarks3d_shape4.npy')
from scipy.spatial import cKDTree
kd_ = cKDTree(du0['B'][du0['head_v']]); LM = np.array([B[HV[kd_.query(p_)[1]]] if not np.isnan(p_).any() else p_ for p_ in LM0])
print('landmarks carried to the current face, largest shift %.1f mm' % (1000 * np.nanmax(np.linalg.norm(LM - LM0, axis=1))))
T = json.load(open('/home/claude/marla/target/target_front.json')); Qr = np.array(T['points']); Qm = FT.points(args[0])[0]
eR, eL = LM[36:42].mean(0), LM[42:48].mean(0); io = float(np.linalg.norm(eL - eR)); print('eye gap %.1f mm' % (io * 1000))
dz = lambda i: (Qm[i][1] - Qr[i][1]) * io * CONFIG['gain']      # + = Marla's point is lower than the reference's: move it up
src, dst, ids = [], [], []
for grp, key in ((range(30, 36), 33), (range(48, 68), None), ([8], 8)):
    mv = dz(key) if key else float(np.mean([dz(i) for i in (51, 57, 62, 66, 48, 54)]))
    for i in grp:
        if not np.isnan(LM[i]).any(): src.append(LM[i].copy()); dst.append(LM[i] + np.array((0, 0, mv))); ids.append(i)
    print('%-6s up %+.1f mm' % ('nose' if key == 33 else ('chin' if key == 8 else 'mouth'), mv * 1000))
# jaw outline: the widest head points at the heights of the outline points 4/12, 5/11, 6/10 (front of the ear), pulled in to the reference widths
H = B[HV]; yref = lambda a, b: (Qm[a][1] + Qm[b][1]) / 2
for a, b in ((4, 12), (5, 11), (6, 10)):
    f = float(np.linalg.norm(Qr[a] - Qr[b]) / np.linalg.norm(Qm[a] - Qm[b])); f = 1 + (f - 1) * CONFIG['jaw_gain']
    zl = (eR[2] + eL[2]) / 2 - yref(a, b) * io; band = H[(np.abs(H[:, 2] - zl) < 0.003) & (H[:, 1] < ey + 0.035)]
    for sg in (1, -1):
        side = band[band[:, 0] * sg > 0]
        if len(side): q = side[np.argmax(side[:, 0] * sg)]; src.append(q.copy()); dst.append(np.array((q[0] * f, q[1], q[2]))); ids.append(-3)
    print('outline %d/%d at %.0f mm below the eyes: width x %.3f' % (a, b, 1000 * ((eR[2] + eL[2]) / 2 - zl), f))
P = du['P']; anch = [LM[i] for i in range(17, 30)] + [LM[i] for i in range(36, 48)]
for c_ in (eR, eL): anch += list(P[(np.linalg.norm(P[:, [0, 2]] - c_[[0, 2]], axis=1) < CONFIG['eye_hold']) & (P[:, 1] < ey + 0.02)][::2])
np.savez('/home/claude/marla/shape5_targets.npz', src=np.array(src), dst=np.array(dst), anchors=np.array(anch), ids=np.array(ids)); print('saved', len(src), 'targets,', len(anch), 'held points')
