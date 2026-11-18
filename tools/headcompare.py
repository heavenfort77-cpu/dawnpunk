# Marla's face against the ICT-FaceKit scan average (real people), both scaled to the same distance between the eye centres. Depth = front-to-back (mm, + = further forward than the outer eye corners).
import json, numpy as np
D = '/home/claude/ext/ICT-FaceKit/FaceXModel/'; du = np.load('/home/claude/marla/out/face_dump.npz'); P = du['P']; ex, ey, ez = du['eye']
raw = np.array([[float(x) for x in l.split()[1:4]] for l in open(D + 'generic_neutral_mesh.obj') if l.startswith('v ')]); V = np.c_[raw[:, 0], -raw[:, 2], raw[:, 1]]
J = json.load(open(D + 'vertex_indices.json')); LI = V[np.array(J['idx_to_landmark_verts'])]
import subprocess, re
LM = np.load('/home/claude/marla/marla_landmarks3d.npy')
def stats(L, tag):
    eyeR, eyeL = L[36:42].mean(0), L[42:48].mean(0); io = np.linalg.norm(eyeL - eyeR); s = 62.0 / io      # scale so eye centres are 62 mm apart
    Q = (L - (eyeR + eyeL) / 2) * s; ref_y = (Q[36, 1] + Q[45, 1]) / 2
    f = lambda i: -(Q[i, 1] - ref_y)
    return dict(nose_tip_fwd=f(30), upper_lip_fwd=f(51), lower_lip_fwd=f(57), chin_fwd=f(8), nose_len=Q[27, 2] - Q[33, 2], nose_to_chin=Q[33, 2] - Q[8, 2], mouth_w=np.linalg.norm(Q[54] - Q[48]), nose_w=np.linalg.norm(Q[35] - Q[31]), brow_to_nose=Q[21, 2] - Q[33, 2])
a, b = stats(LM, 'marla'), stats(LI, 'scan')
print('%-14s %8s %8s %8s' % ('mm (eyes 62 apart)', 'Marla', 'scan avg', 'diff'))
for k in a: print('%-18s %8.1f %8.1f %+8.1f' % (k, a[k], b[k], a[k] - b[k]))
