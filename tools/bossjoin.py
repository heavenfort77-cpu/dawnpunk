# Joins boss pictures into one labelled sheet. Usage: python3 tools/bossjoin.py <out.jpg> <columns> <cell_width> <label=image.png> [...]
# A label of '-' leaves the cell empty. Every picture is scaled to the cell width (same scale for pictures of the same size).
import sys
from PIL import Image, ImageDraw, ImageFont

out, cols, cw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
items = [a.split('=', 1) for a in sys.argv[4:]]
ims = []
for lab, path in items:
    im = Image.open(path).convert('RGB') if path != '-' else Image.new('RGB', (16, 9), (20, 20, 20))
    ims.append((lab, im.resize((cw, int(im.height * cw / im.width)))))
rows = [ims[i:i + cols] for i in range(0, len(ims), cols)]
LH = 30
H = sum(max(im.height for _, im in r) + LH for r in rows)
sheet = Image.new('RGB', (cols * cw, H), (16, 16, 18))
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception:
    f = ImageFont.load_default()
y = 0
for r in rows:
    h = max(im.height for _, im in r)
    for i, (lab, im) in enumerate(r):
        d.text((i * cw + 8, y + 5), lab, fill=(240, 236, 220), font=f)
        sheet.paste(im, (i * cw, y + LH))
    y += h + LH
sheet.save(out, quality=88)
print('saved', out, sheet.size)
