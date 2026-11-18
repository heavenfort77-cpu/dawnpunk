# Night measurements for the interface fix pass (Nov 17). Usage: python3 -I tools/panelfixmeasure.py <shot prefix> <view> (reads <prefix>_<view>_scene.png and <prefix>_<view>.json)
# Prints: the scene's mean brightness (HUD hidden; mean sRGB value 0-255 and mean relative luminance 0-1), and for each machine in sight its box on screen,
# the brightest part (95th percentile luminance in its box: screen and lamps), the box median, the background (median of a ring round the box) and the WCAG contrast of each against the background.
import sys, json, math
from PIL import Image
pre, v = sys.argv[1], sys.argv[2]
im = Image.open(pre + '_' + v + '_scene.png').convert('RGB'); W, H = im.size; px = im.load()
lin = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
L = lambda p: 0.2126 * lin(p[0] / 255) + 0.7152 * lin(p[1] / 255) + 0.0722 * lin(p[2] / 255)
tot = 0; lum = 0; n = 0
for y in range(0, H, 2):
    for x in range(0, W, 2):
        p = px[x, y]; tot += (p[0] + p[1] + p[2]) / 3; lum += L(p); n += 1
print('%s %s scene mean brightness: %.1f / 255 (luminance %.4f)' % (pre.split('/')[-1], v, tot / n, lum / n))
R = lambda a, b: (max(a, b) + 0.05) / (min(a, b) + 0.05)
try:
    G = json.load(open(pre + '_' + v + '.json'))
except Exception:
    G = []
# the machines are measured on the HUD shot itself (the machine positions were read just before it; the scene shot comes ~35 s later and they have moved by then)
im = Image.open(pre + '_' + v + '.png').convert('RGB'); px = im.load()
for g in sorted(G, key=lambda q: q['d'])[:3]:
    fx, fy = g['foot']
    # the machine's top on screen: from the page when it had it, else 2.4 m tall seen with the game's 75 degree vertical field of view
    ty = g['top'][1] if g['top'] and g['top'][1] is not None else fy - 2.4 * (H / 2) / math.tan(math.radians(37.5)) / max(0.5, g['d'])
    h = max(8, fy - ty); w = h * 0.45
    x0, x1, y0, y1 = int(max(0, fx - w)), int(min(W - 1, fx + w)), int(max(0, ty)), int(min(H - 1, fy))
    if x1 - x0 < 4 or y1 - y0 < 4:
        continue
    inside = sorted(L(px[x, y]) for y in range(y0, y1) for x in range(x0, x1))
    rx0, rx1, ry0, ry1 = int(max(0, x0 - w * 0.6)), int(min(W - 1, x1 + w * 0.6)), int(max(0, y0 - h * 0.25)), int(min(H - 1, y1 + h * 0.1))
    ring = sorted(L(px[x, y]) for y in range(ry0, ry1) for x in range(rx0, rx1) if not (x0 <= x < x1 and y0 <= y < y1))
    if not ring:
        continue
    p95, med, bg = inside[int(len(inside) * 0.95)], inside[len(inside) // 2], ring[len(ring) // 2]
    print('  %s at %.1f m, box %dx%d px: screen/lamps (p95) %.4f, body median %.4f, background %.4f -> contrast lamps %.1f:1, body %.1f:1' % (g['kind'], g['d'], x1 - x0, y1 - y0, p95, med, bg, R(p95, bg), R(med, bg)))
