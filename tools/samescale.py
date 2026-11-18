# Same-scale comparison: the reference scaled and turned so its eye centres sit on Marla's; Marla | reference | overlay with face outlines (green Marla, red reference) | close-up of the eye area side by side.
# Usage: python3 samescale.py <Marla render> <out.png>
import sys, numpy as np, cv2
args = sys.argv[1:]; sys.argv = ['x']; sys.path.insert(0, '/home/claude/marla/scripts'); import facetarget as FT
def pts(p):
    im = cv2.imread(p); s = max(1, round(900 / im.shape[0])); im2 = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(im2, cv2.COLOR_BGR2GRAY)
    f = max(FT.D(g, 1), key=lambda r: r.width()); sh = FT.P(g, f); return im2, np.array([(sh.part(i).x, sh.part(i).y) for i in range(68)], np.float32)
mi, ml = pts(args[0]); ri, rl = pts('/home/claude/marla/target/ref_neutral_front.jpg')
src = np.float32([rl[36:42].mean(0), rl[42:48].mean(0)]); dst = np.float32([ml[36:42].mean(0), ml[42:48].mean(0)])
v1, v2 = src[1] - src[0], dst[1] - dst[0]; sc = np.linalg.norm(v2) / np.linalg.norm(v1); an = np.arctan2(v2[1], v2[0]) - np.arctan2(v1[1], v1[0]); c, s_ = np.cos(an) * sc, np.sin(an) * sc
M = np.float32([[c, -s_, 0], [s_, c, 0]]); M[:, 2] = dst[0] - M[:, :2] @ src[0]; rw = cv2.warpAffine(ri, M, (mi.shape[1], mi.shape[0])); rlw = (rl @ M[:, :2].T) + M[:, 2]
over = cv2.addWeighted(mi, 0.5, rw, 0.5, 0)
for L, col in ((ml, (0, 255, 0)), (rlw, (0, 0, 255))):
    for a, b in ((0, 17), (17, 22), (22, 27), (27, 31), (31, 36), (36, 42), (42, 48), (48, 60), (60, 68)): cv2.polylines(over, [L[a:b].astype(np.int32)], (a, b) in ((36, 42), (42, 48), (48, 60), (60, 68)), col, 2)
y0, y1 = int(min(ml[:, 1].min(), rlw[:, 1].min()) - 120), int(max(ml[:, 1].max(), rlw[:, 1].max()) + 60); x0, x1 = int(ml[:, 0].min() - 120), int(ml[:, 0].max() + 120)
crop = lambda im: im[max(0, y0):y1, max(0, x0):x1]; row = np.hstack([crop(mi), crop(rw), crop(over)])
ey0, ey1 = int(ml[17:27, 1].min() - 40), int(ml[36:48, 1].max() + 60); ex0, ex1 = int(ml[17, 0] - 40), int(ml[26, 0] + 40)
eyes = np.hstack([mi[ey0:ey1, ex0:ex1], rw[ey0:ey1, ex0:ex1]]); eyes = cv2.resize(eyes, (row.shape[1], int(eyes.shape[0] * row.shape[1] / eyes.shape[1])))
cv2.imwrite(args[1], np.vstack([row, eyes])); print('reference scaled x%.2f, turned %.1f deg' % (sc, np.degrees(an)))
