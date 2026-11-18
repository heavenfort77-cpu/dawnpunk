# Eye check on a face picture (68 landmarks): sclera brightness against the cheek, iris width against eye width, catchlight, upper-lid cover of the iris.
# Usage: python3 eyemeasure.py label=path ...   Values are averaged over both eyes.
import sys, numpy as np, cv2, dlib, face_recognition_models as m
P = dlib.shape_predictor(m.pose_predictor_model_location()); D = dlib.get_frontal_face_detector()
def one(path):
    im = cv2.imread(path); s = max(1, round(900 / im.shape[0])); im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(float)
    f = max(D(g.astype(np.uint8), 1), key=lambda r: r.width()); sh = P(g.astype(np.uint8), f); L = np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], float)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(float); out = []
    for a in (36, 42):
        poly = L[a:a + 6].astype(np.int32); mk = np.zeros(g.shape, np.uint8); cv2.fillPoly(mk, [poly], 1); inside = mk > 0
        ew = np.linalg.norm(L[a + 3] - L[a]); lum = g[inside]; thr = np.percentile(lum, 45)
        dark = inside & (g < thr); ys, xs = np.where(dark); cy = int(np.median(ys)) if len(ys) else int(L[a:a + 6, 1].mean())
        row = dark[max(0, cy - 1):cy + 2].any(0); iw = row.sum()
        scl = inside & (g >= np.percentile(lum, 70)); cx = L[a:a + 6, 0].mean(); cyy = L[a:a + 6, 1].mean()
        ck = g[int(cyy + 0.45 * ew):int(cyy + 0.75 * ew), int(cx - 0.3 * ew):int(cx + 0.3 * ew)]
        iris = dark; ip = g[iris]; cat = (ip > ip.max() * 0.85).sum() if len(ip) else 0
        top_lid = L[a + 1:a + 3, 1].mean(); iris_top = ys.min() if len(ys) else cy
        out.append((g[scl].mean() / max(ck.mean(), 1), iw / ew, int(g[inside].max() > 1.25 * np.percentile(lum, 90)), (iris_top - top_lid) / ew, hsv[..., 1][scl].mean()))
    return np.mean(out, 0)
rows = {a.split('=', 1)[0]: one(a.split('=', 1)[1]) for a in sys.argv[1:]}
print('%-12s' % '' + ''.join('%11s' % k[:10] for k in rows))
for i, k in enumerate(['sclera/cheek', 'iris/eye w', 'catchlight', 'lid gap', 'sclera sat']): print('%-12s' % k + ''.join('%11.2f' % rows[l][i] for l in rows))
