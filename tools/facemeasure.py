# Face shape by 68 landmarks, lengths divided by the distance between the eye centres, face levelled by the eye line. Usage: python3 facemeasure.py label=path ...
import sys, math, numpy as np, cv2, dlib, face_recognition_models as m
P = dlib.shape_predictor(m.pose_predictor_model_location()); D = dlib.get_frontal_face_detector()
KEYS = ['cheek width', 'jaw width', 'chin width', 'jaw / cheek', 'chin / cheek', 'face length', 'length / cheek', 'lower face', 'nose length', 'nose width', 'eye width', 'eye gap', 'brow to eye', 'nose off-centre', 'roll deg']
def measure(path):
    im = cv2.imread(path); s = max(1, round(900 / im.shape[0])); im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    f = max(D(g, 1), key=lambda r: r.width()); sh = P(g, f); L = np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], float)
    eR, eL = L[36:42].mean(0), L[42:48].mean(0); io = np.linalg.norm(eL - eR); roll = math.atan2(eL[1] - eR[1], eL[0] - eR[0]); c, s_ = math.cos(-roll), math.sin(-roll)
    Q = (L - eR) @ np.array([[c, -s_], [s_, c]]).T / io; d = lambda a, b: np.linalg.norm(Q[a] - Q[b]); ck, jw, ch = d(1, 15), d(4, 12), d(6, 10); fl = Q[8][1] - Q[27][1]
    return {'cheek width': ck, 'jaw width': jw, 'chin width': ch, 'jaw / cheek': jw / ck, 'chin / cheek': ch / ck, 'face length': fl, 'length / cheek': fl / ck, 'lower face': Q[8][1] - Q[33][1], 'nose length': Q[33][1] - Q[27][1],
            'nose width': d(31, 35), 'eye width': (d(36, 39) + d(42, 45)) / 2, 'eye gap': d(39, 42), 'brow to eye': ((Q[36:42].mean(0)[1] - Q[17:22].mean(0)[1]) + (Q[42:48].mean(0)[1] - Q[22:27].mean(0)[1])) / 2, 'nose off-centre': Q[30][0] - 0.5, 'roll deg': math.degrees(roll)}
rows = {a.split('=')[0]: measure(a.split('=')[1]) for a in sys.argv[1:]}
print('%-16s' % '' + ''.join('%12s' % k for k in rows))
for k in KEYS: print('%-16s' % k + ''.join('%12.3f' % rows[l][k] for l in rows))
