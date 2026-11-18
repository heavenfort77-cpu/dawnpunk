# Labelled panels side by side (one row per --row), each scaled to the same height, with optional measured numbers under each.
# Usage: python3 tools/scenesheet.py <out.jpg> <height> <label>=<image>[@x0,y0,x1,y1] ... [--row <label>=<image> ...]
# The @box crops the image first (pixels). Under each panel: mean saturation, mean value and the share of plant-green pixels (hue 0.15-0.45, saturation > 0.25).
import sys, colorsys
from PIL import Image, ImageDraw, ImageFont
import numpy as np
out, H = sys.argv[1], int(sys.argv[2]); rows, cur = [], []
for a in sys.argv[3:]:
    if a == '--row': rows.append(cur); cur = []; continue
    cur.append(a)
rows.append(cur)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20); f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except Exception: f = f2 = ImageFont.load_default()
def measure(im):
    a = np.asarray(im.convert('RGB').resize((160, int(160 * im.height / im.width)))).reshape(-1, 3) / 255.0
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in a]); veg = ((hsv[:, 0] > 0.15) & (hsv[:, 0] < 0.45) & (hsv[:, 1] > 0.25)).mean()
    return 'sat %.2f  val %.2f  plant-green %d%%' % (hsv[:, 1].mean(), hsv[:, 2].mean(), round(veg * 100))
ims = []
for row in rows:
    panels = []
    for item in row:
        label, path = item.split('=', 1); box = None
        if '@' in path: path, b = path.split('@'); box = tuple(int(v) for v in b.split(','))
        im = Image.open(path).convert('RGB')
        if box: im = im.crop(box)
        im = im.resize((int(im.width * H / im.height), H)); m = measure(im)
        p = Image.new('RGB', (im.width, H + 30), (16, 16, 16)); p.paste(im, (0, 0)); d = ImageDraw.Draw(p)
        w = d.textlength(label, font=f); d.rectangle((4, 4, w + 16, 34), fill=(0, 0, 0)); d.text((10, 8), label, fill=(255, 255, 255), font=f); d.text((8, H + 6), m, fill=(220, 220, 220), font=f2)
        panels.append(p)
    r = Image.new('RGB', (sum(p.width for p in panels) + 6 * (len(panels) - 1), H + 30), (16, 16, 16)); x = 0
    for p in panels: r.paste(p, (x, 0)); x += p.width + 6
    ims.append(r)
W = max(i.width for i in ims); o = Image.new('RGB', (W, sum(i.height for i in ims) + 6 * (len(ims) - 1)), (16, 16, 16)); y = 0
for i in ims: o.paste(i, (0, y)); y += i.height + 6
o.save(out, quality=88); print('wrote', out, o.size)
