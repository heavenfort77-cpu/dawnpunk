# Before / after sheet for the interface fix pass (Nov 17). Usage: python3 -I tools/panelfixsheet.py <shot dir> <out.jpg> [views]
# Each row: a label, the "before" picture left and the "after" picture right, both scaled to the same width (same scale per row).
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
views = (sys.argv[3] if len(sys.argv) > 3 else 'dayD,nightD,dayP,nightP,base,near,panelD,panelP').split(',')
names = {'dayD': 'Street by day, desktop 1280x720', 'nightD': 'Night fight, desktop 1280x720', 'dayP': 'Phone by day (Pixel 7 sideways)', 'nightP': 'Phone at night (Pixel 7 sideways)',
         'base': 'Base with floating labels, 14 m from the hatchery, desktop', 'near': 'Base, 5 m from the HATCHERY sign (label hides within 8 m), desktop', 'panelD': 'Hatchery panel, desktop', 'panelP': "Oko's panel, phone 844x390"}
W = 900
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception:
    font = ImageFont.load_default()
rows = []
for v in views:
    a, b = os.path.join(d, 'before_' + v + '.png'), os.path.join(d, 'after_' + v + '.png')
    if not (os.path.exists(a) and os.path.exists(b)):
        print('skip', v); continue
    ia, ib = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    s = W / max(ia.width, ib.width)
    ia, ib = ia.resize((round(ia.width * s), round(ia.height * s)), Image.LANCZOS), ib.resize((round(ib.width * s), round(ib.height * s)), Image.LANCZOS)
    h = max(ia.height, ib.height) + 40
    r = Image.new('RGB', (2 * W + 30, h), (24, 24, 24)); dr = ImageDraw.Draw(r)
    dr.text((10, 8), names.get(v, v) + ': BEFORE', fill=(255, 220, 160), font=font); dr.text((W + 20, 8), 'AFTER', fill=(160, 255, 190), font=font)
    r.paste(ia, (10, 38)); r.paste(ib, (W + 20, 38)); rows.append(r)
sheet = Image.new('RGB', (2 * W + 30, sum(r.height for r in rows) + 10 * len(rows)), (10, 10, 10)); y = 0
for r in rows:
    sheet.paste(r, (0, y)); y += r.height + 10
sheet.save(out, quality=88); print('wrote', out, sheet.size)
