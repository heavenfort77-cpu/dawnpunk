# Step 4 skin colour check: colour of face regions relative to a base patch (lower cheek), so the light's colour and strength mostly cancel. Regions found from the 68 landmarks.
# Per region: brightness (relative to base), red-green and blue-green balance minus the base's (positive = redder / bluer than the base skin).
# Usage: python3 skincolour.py name=<picture> name=<picture> ...
import sys, numpy as np, cv2, dlib, face_recognition_models as m
P = dlib.shape_predictor(m.pose_predictor_model_location()); D = dlib.get_frontal_face_detector()
def regions(L, io):
    c = lambda *ix: L[list(ix)].mean(0); u = lambda a, b: (b - a) / np.linalg.norm(b - a)
    R = {}
    for s, (o, i0, i1, lid, lo, ch, lc) in dict(R=(36, 36, 39, (37, 38), (40, 41), 2, 4), L=(45, 42, 45, (43, 44), (46, 47), 14, 12)).items():
        R['lash line ' + s] = [c(*lid) - (0, 0.035 * io)]; R['crease ' + s] = [c(*lid) - (0, 0.11 * io)]; R['lower rim ' + s] = [c(*lo) + (0, 0.03 * io)]
        R['under eye ' + s] = [c(*lo) + (0, 0.17 * io)]; R['cheek ' + s] = [(c(ch, 31 if s == 'R' else 35) + c(*lo)) / 2 + (0, 0.25 * io)]; R['base ' + s] = [(c(lc) + c(48 if s == 'R' else 54)) / 2]
    R['nose tip'] = [c(30) + (0, 0.04 * io)]; R['upper lip'] = [c(50, 52, 61, 63)]; R['lower lip'] = [c(56, 58, 65, 67)]; R['chin'] = [(c(57) + c(8)) / 2]
    return R
def one(path):
    im = cv2.imread(path); s = max(1, round(900 / im.shape[0])); im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    f = max(D(g, 1), key=lambda r: r.width()); sh = P(g, f); L = np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], float); io = np.linalg.norm(L[36:42].mean(0) - L[42:48].mean(0))
    rgb = cv2.GaussianBlur(im, (0, 0), max(1, 0.012 * io))[:, :, ::-1].astype(float) / 255.0; rgb = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)      # linear light
    out = {}
    for k, pts in regions(L, io).items():
        x, y = np.round(pts[0]).astype(int); out[k] = rgb[y, x]
    merge = lambda a: (out[a + ' R'] + out[a + ' L']) / 2
    res = {k: merge(k) for k in ('base', 'cheek', 'under eye', 'lash line', 'crease', 'lower rim')}; res.update({k: out[k] for k in ('nose tip', 'upper lip', 'lower lip', 'chin')}); return res
def desc(v, b): lum = lambda p: p @ [0.2126, 0.7152, 0.0722]; return lum(v) / lum(b), np.log(v[0] / v[1]) - np.log(b[0] / b[1]), np.log(v[2] / v[1]) - np.log(b[2] / b[1])
rows = {a.split('=', 1)[0]: one(a.split('=', 1)[1]) for a in sys.argv[1:]}
names = list(rows); print('%-11s' % 'region' + ''.join('%26s' % ('%s: bright red blue' % n[:9]) for n in names))
for k in rows[names[0]]:
    print('%-11s' % k + ''.join('%26s' % ('%5.2f %+5.2f %+5.2f' % desc(rows[n][k], rows[n]['base'])) for n in names))
b = rows[names[0]]['base']; print('base colour (linear) ' + '  '.join('%s %s' % (n[:9], np.round(rows[n]['base'], 3)) for n in names))
