# Skin check on a face picture (68 landmarks; area = cheeks, nose and forehead inside the face outline, eyes and mouth left out).
# warm shadow: how much redder the half-lit band (35 to 65% of the face's bright level) is than the lit skin; real skin shows red where light fades because light travels under it.
# softness: how wide the lit-to-dark change is across the cheek (in eye widths); evenness: spread of colour in the lit skin.
import sys, numpy as np, cv2, dlib, face_recognition_models as m
P = dlib.shape_predictor(m.pose_predictor_model_location()); D = dlib.get_frontal_face_detector()
def one(path):
    im = cv2.imread(path); s = max(1, round(900 / im.shape[0])); im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    f = max(D(g, 1), key=lambda r: r.width()); sh = P(g, f); L = np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], np.int32)
    hull = np.concatenate([L[0:17], L[26:16:-1] - [0, int(0.25 * abs(L[8, 1] - L[27, 1]))]]); mk = np.zeros(g.shape, np.uint8); cv2.fillPoly(mk, [hull], 1)
    for a, b in ((36, 42), (42, 48), (48, 60)): cv2.fillPoly(mk, [cv2.convexHull(L[a:b])], 0)
    cv2.fillPoly(mk, [cv2.convexHull(L[17:27])], 0); px = im[mk > 0].astype(float)[:, ::-1]; lum = px @ [0.2126, 0.7152, 0.0722]; hi = np.percentile(lum, 95)
    red = (px[:, 0] - px[:, 1]) / np.maximum(px.sum(1), 1); lit = lum > 0.8 * hi; mid = (lum > 0.35 * hi) & (lum < 0.65 * hi)
    ew = np.linalg.norm(L[39] - L[36]); row = int(L[29, 1]); xs = np.arange(L[1, 0], L[15, 0]); prof = cv2.GaussianBlur(g.astype(float), (0, 0), 2)[row, xs]
    lo, hi2 = np.percentile(prof, 10), np.percentile(prof, 90); band = ((prof > lo + 0.2 * (hi2 - lo)) & (prof < lo + 0.8 * (hi2 - lo))).sum() / ew
    return (red[mid].mean() - red[lit].mean()) / max(abs(red[lit].mean()), 1e-3) if mid.sum() > 50 else float('nan'), band, np.std(px[lit] / px[lit].sum(1, keepdims=True), 0).mean() * 100, mid.mean() * 100
rows = {a.split('=', 1)[0]: one(a.split('=', 1)[1]) for a in sys.argv[1:]}
print('%-14s' % '' + ''.join('%11s' % k[:10] for k in rows))
for i, k in enumerate(['warm shadow', 'softness', 'evenness', 'half-lit %']): print('%-14s' % k + ''.join('%11.2f' % rows[l][i] for l in rows))
