# Step 1 target sheet: front proportions of the user's neutral reference, as ratios (eye-centre distance = 1), and a pass/fail check of a render against them.
# Usage: python3 facetarget.py make <reference image>            -> /home/claude/marla/target/target_front.json
#        python3 facetarget.py check <render of Marla's rest face>  -> pass/fail per feature
# Face points: dlib 68-point model. The face is levelled by the eye line first. Tolerances: measured noise (one pixel at the reference's size) plus a margin per feature.
import sys, json, math, numpy as np, cv2, dlib, face_recognition_models as m
P = dlib.shape_predictor(m.pose_predictor_model_location()); D = dlib.get_frontal_face_detector()
UNMEASURABLE = {'cheek_w': 'hair covers the sides of the face at cheek level in the reference and in the renders'}
TOL = dict(eye_w=0.06, eye_h=0.10, iris_w=0.08, nose_w=0.06, nose_len=0.07, mouth_w=0.06, upper_lip=0.12, lower_lip=0.12, lip_to_nose=0.10, nose_to_chin=0.06, brow_to_eye=0.12, cheek_w=0.05, jaw_taper=0.06, mouth_corner_drop=0.02)      # mouth_corner_drop is near zero, so its tolerance is absolute (eye distances), not a share
SKIP_IN_REF = []      # filled per reference when a feature is hidden
def points(path):
    im = cv2.imread(path); s = max(1, round(900 / im.shape[0])); im2 = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(im2, cv2.COLOR_BGR2GRAY)
    f = max(D(g, 1), key=lambda r: r.width()); sh = P(g, f); L = np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], float)
    eR, eL = L[36:42].mean(0), L[42:48].mean(0); io = np.linalg.norm(eL - eR); a = -math.atan2(eL[1] - eR[1], eL[0] - eR[0]); c, s_ = math.cos(a), math.sin(a)
    Q = (L - (eR + eL) / 2) @ np.array([[c, -s_], [s_, c]]).T / io; return Q, im2, L, io
def iris_width(im, L, io):
    out = []
    for a in (36, 42):
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(float); mk = np.zeros(g.shape, np.uint8); cv2.fillPoly(mk, [L[a:a + 6].astype(np.int32)], 1); ins = mk > 0
        dark = ins & (g < np.percentile(g[ins], 45)); ys, xs = np.where(dark); cy = int(np.median(ys)); out.append(dark[cy - 1:cy + 2].any(0).sum() / io)
    return float(np.mean(out))
def measure(path):
    Q, im, L, io = points(path); d = lambda a, b: float(np.linalg.norm(Q[a] - Q[b]))
    return dict(eye_w=(d(36, 39) + d(42, 45)) / 2, eye_h=float((Q[[40, 41, 46, 47], 1].mean() - Q[[37, 38, 43, 44], 1].mean())), iris_w=iris_width(im, L, io), nose_w=d(31, 35), nose_len=float(Q[33, 1] - Q[27, 1]),
                mouth_w=d(48, 54), upper_lip=float(Q[62, 1] - Q[51, 1]), lower_lip=float(Q[57, 1] - Q[66, 1]), lip_to_nose=float(Q[51, 1] - Q[33, 1]), nose_to_chin=float(Q[8, 1] - Q[33, 1]),
                brow_to_eye=float(Q[[37, 38, 43, 44], 1].mean() - Q[17:27, 1].mean()), cheek_w=d(1, 15), jaw_taper=d(4, 12) / d(1, 15), mouth_corner_drop=float((Q[48, 1] + Q[54, 1]) / 2 - Q[62, 1]))
if __name__ == '__main__' and sys.argv[1] == 'make':
    t = measure(sys.argv[2]); Qr = points(sys.argv[2])[0]; json.dump(dict(source=sys.argv[2], points=Qr.tolist(), values=t, tol=TOL, note='front only; depth from published norms; forehead hidden by fringe; jaw sides partly under hair'), open('/home/claude/marla/target/target_front.json', 'w'), indent=1)
    for k, v in t.items(): print('%-18s %.3f' % (k, v))
elif __name__ == '__main__':
    T = json.load(open('/home/claude/marla/target/target_front.json')); mv = measure(sys.argv[2]); fails = 0
    print('%-18s %7s %7s %7s  %s' % ('feature', 'target', 'Marla', 'off', 'result'))
    for k, tv in T['values'].items():
        if k in UNMEASURABLE: print('%-18s %7.3f %7.3f %7s  %s' % (k, tv, mv[k], '', 'NOT MEASURED (' + UNMEASURABLE[k] + ')')); continue
        ab = k == 'mouth_corner_drop'; off = (mv[k] - tv) if ab else (mv[k] - tv) / abs(tv); ok = abs(off) <= T['tol'][k]; fails += not ok
        print('%-18s %7.3f %7.3f %7s  %s' % (k, tv, mv[k], ('%+.3f' % off) if ab else ('%+.0f%%' % (100 * off)), 'PASS' if ok else 'FAIL'))
    print('%d of %d features outside tolerance' % (fails, len(T['values']) - len(UNMEASURABLE)))
