# Step 4 shading check: how the light falls on the face, from the 68 landmarks, in linear light. Ratios only, so exposure cancels.
# cheekR/L = her right cheek over her left (image left over image right); chin/cheek; nose shadow = skin beside the nose wing in the shadow side over the lit side;
# under-nose = philtrum over upper cheek (light from above darkens it); contrast = 90th over 10th percentile of skin brightness inside the face outline; colour = blue/green and red/green of the lit cheek.
# Usage: python3 lightmeasure.py name=<picture> ...
import sys, numpy as np, cv2, dlib, face_recognition_models as m
P = dlib.shape_predictor(m.pose_predictor_model_location()); D = dlib.get_frontal_face_detector()
def one(path):
    im = cv2.imread(path); s = max(1, round(900 / im.shape[0])); im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    f = max(D(g, 1), key=lambda r: r.width()); sh = P(g, f); L = np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], float); io = np.linalg.norm(L[36:42].mean(0) - L[42:48].mean(0))
    rgb = cv2.GaussianBlur(im, (0, 0), 0.03 * io)[:, :, ::-1].astype(float) / 255.0; rgb = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4); lum = rgb @ [0.2126, 0.7152, 0.0722]
    at = lambda p: lum[int(round(p[1])), int(round(p[0]))]; col = lambda p: rgb[int(round(p[1])), int(round(p[0]))]
    cR = (L[2] + L[31] + L[40]) / 3 + (0, 0.1 * io); cL = (L[14] + L[35] + L[47]) / 3 + (0, 0.1 * io)
    nR = (L[31] + L[49]) / 2 + (-0.08 * io, -0.05 * io); nL = (L[35] + L[53]) / 2 + (0.08 * io, -0.05 * io); ph = (L[33] + L[51]) / 2; ch = (L[57] + L[8]) / 2; up = (cR + cL) / 2 - (0, 0.15 * io)
    poly = np.r_[L[2:15], L[[26, 17]] + (0, 0.05 * io)].astype(np.int32); mk = np.zeros(g.shape, np.uint8); cv2.fillPoly(mk, [poly], 1)
    for a, b in ((36, 42), (42, 48), (48, 60)): cv2.fillPoly(mk, [cv2.convexHull(L[a:b].astype(np.int32))], 0)
    v = lum[mk > 0]; lit = cR if at(cR) > at(cL) else cL; c = col(lit)
    return dict(cheekR_L=at(cR) / at(cL), chin_cheek=at(ch) / ((at(cR) + at(cL)) / 2), nose_shadow=min(at(nR), at(nL)) / max(at(nR), at(nL)), under_nose=at(ph) / at(up),
                contrast=np.percentile(v, 90) / np.percentile(v, 10), blue_green=c[2] / c[1], red_green=c[0] / c[1])
R = {a.split('=', 1)[0]: one(a.split('=', 1)[1]) for a in sys.argv[1:]}
ks = list(next(iter(R.values()))); print('%-12s' % '' + ''.join('%12s' % n[:11] for n in R))
for k in ks: print('%-12s' % k + ''.join('%12.2f' % R[n][k] for n in R))
