# Measures a smile on a face picture with 68 face landmarks, so a render can be compared with a reference by numbers.
# Usage: python3 smilemeasure.py label=path[@x0,y0,x1,y1] ...   (optional crop box). Writes overlays to ../smile_ref/overlay_<label>.png
import sys, math, numpy as np, cv2, dlib, face_recognition_models as m
P = dlib.shape_predictor(m.pose_predictor_model_location()); D = dlib.get_frontal_face_detector()
KEYS = ['mouth width', 'mouth gap', 'upper lip', 'lower lip', 'corner lift', 'corner uneven', 'eye open', 'brow height', 'nose width', 'lip to nose', 'teeth share', 'head roll deg', 'face length']
def measure(label, path, box):
    im = cv2.imread(path)
    if box: im = im[box[1]:box[3], box[0]:box[2]]
    s = max(1, round(900 / im.shape[0])); im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    fs = D(g, 1)
    if not fs: return None
    f = max(fs, key=lambda r: r.width()); sh = P(g, f); L = np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], float)
    eR, eL = L[36:42].mean(0), L[42:48].mean(0); io = np.linalg.norm(eL - eR); roll = math.atan2(eL[1] - eR[1], eL[0] - eR[0])
    c, s_ = math.cos(-roll), math.sin(-roll); R = np.array([[c, -s_], [s_, c]]); Q = (L - eR) @ R.T / io
    eye = lambda a: (np.linalg.norm(Q[a + 1] - Q[a + 5]) + np.linalg.norm(Q[a + 2] - Q[a + 4])) / 2 / np.linalg.norm(Q[a] - Q[a + 3])
    mask = np.zeros(g.shape, np.uint8); cv2.fillPoly(mask, [L[60:68].astype(np.int32)], 255); inner = mask > 0
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); teeth = inner & (hsv[..., 2] > 150) & (hsv[..., 1] < 90)
    out = {
        'mouth width': np.linalg.norm(Q[54] - Q[48]), 'mouth gap': Q[66][1] - Q[62][1], 'upper lip': Q[62][1] - Q[51][1], 'lower lip': Q[57][1] - Q[66][1],
        'corner lift': Q[62][1] - (Q[48][1] + Q[54][1]) / 2, 'corner uneven': abs(Q[48][1] - Q[54][1]), 'eye open': (eye(36) + eye(42)) / 2,
        'brow height': ((Q[36:42].mean(0)[1] - Q[17:22].mean(0)[1]) + (Q[42:48].mean(0)[1] - Q[22:27].mean(0)[1])) / 2, 'nose width': np.linalg.norm(Q[35] - Q[31]),
        'lip to nose': Q[51][1] - Q[33][1], 'teeth share': teeth.sum() / max(1, inner.sum()), 'head roll deg': math.degrees(roll), 'face length': Q[8][1] - Q[27][1]}
    ov = im.copy()
    for i, (x, y) in enumerate(L.astype(int)): cv2.circle(ov, (x, y), 3, (0, 255, 0) if i < 48 else (0, 200, 255), -1)
    cv2.imwrite('../smile_ref/overlay_%s.png' % label, ov)
    return out
rows = {}
for a in sys.argv[1:]:
    label, rest = a.split('=', 1); path, _, b = rest.partition('@'); box = [int(v) for v in b.split(',')] if b else None
    rows[label] = measure(label, path, box)
print('%-14s' % '' + ''.join('%14s' % k[:13] for k in rows))
for k in KEYS: print('%-14s' % k + ''.join('%14s' % ('none' if rows[l] is None else '%.3f' % rows[l][k]) for l in rows))
