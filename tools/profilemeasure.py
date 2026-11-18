# Profile depths, measured from a vertical line through the base of the nose (subnasale), forward = +, mm. Usage: python3 profilemeasure.py <face_dump.npz> <landmarks3d.npy> [...]
# Points: the face's own 3D landmarks (ict_transfer.py: front-most surface point under each detected point) for nose tip (30), subnasale (33), upper lip (51), lower lip (57);
# chin front (soft pogonion) = most forward midline surface point between 6 mm under the lower lip and the chin bottom (8).
# Norms, young women: nose tip +13.9 (SD 1.6), upper lip +1.3 (1.8), lower lip -1.0 (2.8) [29 Brazilian women 18 to 30, Angle Orthodontist 78(1):58]; chin front -2.6 (2.5) [Arnett, US patent 6200278].
import sys, numpy as np
NORM = dict(nose_tip=(13.9, 1.6), upper_lip=(1.3, 1.8), lower_lip=(-1.0, 2.8), chin=(-2.6, 2.5))
def prof(path, lmpath):
    du = np.load(path); P = du['P']; ex, ey, ez = du['eye']; LM = np.load(lmpath); fw = lambda p: -p[1]
    m = P[(np.abs(P[:, 0]) < 0.002) & (P[:, 2] < LM[57, 2] - 0.006) & (P[:, 2] > LM[8, 2]) & (P[:, 1] < ey + 0.02)]; pg = m[np.argmin(m[:, 1])]
    b = fw(LM[33]); return dict(nose_tip=1000 * (fw(LM[30]) - b), upper_lip=1000 * (fw(LM[51]) - b), lower_lip=1000 * (fw(LM[57]) - b), chin=1000 * (fw(pg) - b))
for p, lp in zip(sys.argv[1::2], sys.argv[2::2]):
    r = prof(p, lp); print(p.split('/')[-2])
    for k, (n, sd) in NORM.items(): print('  %-10s %+6.1f mm   norm %+5.1f (SD %.1f)   off %+5.1f  %s' % (k, r[k], n, sd, r[k] - n, 'PASS' if abs(r[k] - n) <= sd else 'FAIL'))
