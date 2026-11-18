# Step 2 targets: Marla's resting face reshaped to the user's neutral front reference (front proportions) and to young-women profile norms (depth: only the chin needed moving).
# Writes /home/claude/marla/shape_targets.npz in the same form as profile_targets.npz (src, dst, anchors, ids) for build.py flag shape3.
# Heights of nose, mouth, chin and brows come from the reference (eye-centre distance = 1, below the eye line); widths stay Marla's except the cheeks (CONFIG cheek); chin front forward by CONFIG chin_fwd.
import json, numpy as np
CONFIG = dict(eye_hold=0.019, cheek=None, chin_fwd=0.0010, weight=1.0, gain=0.8, cheek_band=(-0.065, -0.028), cheek_from=0.048)      # cheek points kept below and outside the eyes (a band reaching the outer eye corners squeezed the eyes shut)      # cheek None = take the reference's cheek width; weight 1 = all the way to the reference heights
LM = np.load('/home/claude/marla/marla_landmarks3d_oldface.npy'); du = np.load('/home/claude/marla/out/face_dump.npz'); P = du['P']; ex, ey, ez = du['eye']
T = json.load(open('/home/claude/marla/target/target_front.json')); Qr = np.array(T['points'])
eR, eL = LM[36:42].mean(0), LM[42:48].mean(0); io = float(np.linalg.norm(eL - eR)); ezm = (eR[2] + eL[2]) / 2; print('Marla eye-centre distance %.1f mm' % (io * 1000))
ids = [i for i in list(range(29, 36)) + list(range(48, 68)) + [8] if not np.isnan(LM[i]).any()]
src = [LM[i].copy() for i in ids]; dst = []
xm = (eR[0] + eL[0]) / 2
for i, s in zip(ids, src):
    zt = ezm - Qr[i][1] * io; xt = xm + Qr[i][0] * io if i in (31, 32, 34, 35) else s[0]      # nose wings: width from the reference too
    dst.append(np.array((xt, s[1], s[2] + CONFIG['weight'] * (zt - s[2]))))
# correction from a render of the last attempt: each point's height error (measured on the render against the reference) is added to its target
import sys, os
if len(sys.argv) > 1 and os.path.exists('/home/claude/marla/shape_targets.npz'):
    sys.path.insert(0, '/home/claude/marla/scripts'); import facetarget as FT
    Qm = FT.points(sys.argv[1])[0]; old = np.load('/home/claude/marla/shape_targets.npz'); oids = list(old['ids'])
    for k, i in enumerate(ids):
        if i in oids: dst[k] = old['dst'][oids.index(i)].copy(); dst[k][2] += (Qm[i][1] - Qr[i][1]) * io * CONFIG['gain']
        if i in oids and i in (31, 35): dst[k][0] -= (Qm[i][0] - Qr[i][0]) * io * CONFIG['gain']      # nose wings: width corrected too
    print('corrected from', sys.argv[1])
# chin front: most forward midline point of the chin, moved forward and up with the chin bottom
m = P[(np.abs(P[:, 0]) < 0.002) & (P[:, 2] < LM[57, 2] - 0.006) & (P[:, 2] > LM[8, 2]) & (P[:, 1] < ey + 0.02)]; pg = m[np.argmin(m[:, 1])]
k8 = ids.index(8); up8 = dst[k8][2] - src[k8][2]; src.append(pg.copy()); dst.append(pg + np.array((0, -CONFIG['chin_fwd'], up8 * 0.8))); ids.append(-1)
dst[k8] = dst[k8] + np.array((0, -CONFIG['chin_fwd'] * 0.6, 0))
# cheeks: the widest face points at cheek level pulled in toward the reference width
f = CONFIG['cheek'] or T['values']['cheek_w'] / 2.121      # the reference's width over Marla's, both measured on the face outline in a front picture
band = P[(P[:, 2] > ezm + CONFIG['cheek_band'][0]) & (P[:, 2] < ezm + CONFIG['cheek_band'][1]) & (np.abs(P[:, 0]) > CONFIG['cheek_from']) & (P[:, 1] < ey + 0.02)][::3]
for q in band: src.append(q.copy()); dst.append(np.array((q[0] * f, q[1], q[2]))); ids.append(-2)
print('cheeks: %d side points pulled in by %.1f%%' % (len(band), 100 * (1 - f)))
anch = [LM[i] for i in range(36, 48)] + [LM[27], LM[28]]
for c_ in (eR, eL):      # hold the whole eye area still (lids, corners, socket): with only the 12 eye-outline points held, the lids between them were dragged and the eyes narrowed by a quarter
    near_ = P[(np.linalg.norm(P[:, [0, 2]] - c_[[0, 2]], axis=1) < CONFIG['eye_hold']) & (P[:, 1] < ey + 0.02)][::2]; anch += list(near_)
print('held still: %d eye-area points' % (len(anch) - 14))
for nm, i in (('nose base', 33), ('upper lip', 51), ('stomion', 62), ('lower lip', 57), ('chin bottom', 8)):
    k = ids.index(i); print('%-11s up %+5.1f mm, forward %+4.1f mm' % (nm, 1000 * (dst[k][2] - src[k][2]), -1000 * (dst[k][1] - src[k][1])))
np.savez('/home/claude/marla/shape_targets.npz', src=np.array(src), dst=np.array(dst), anchors=np.array(anch), ids=np.array(ids)); print('saved', len(src), 'targets,', len(anch), 'fixed eye points')
