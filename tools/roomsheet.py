# A sheet of labelled pictures in two columns (each picture scaled to the same width), saved as a JPEG.
# Usage: python3 tools/roomsheet.py <out.jpg> <title> <picture> <label> [<picture> <label> ...]   (a picture named '-' leaves its cell empty)
import sys
from PIL import Image, ImageDraw, ImageFont

out, title, rest = sys.argv[1], sys.argv[2], sys.argv[3:]
cells = [(rest[i], rest[i + 1]) for i in range(0, len(rest), 2)]
W = 960
def font(sz):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        try:
            return ImageFont.truetype(f, sz)
        except OSError:
            pass
    return ImageFont.load_default()
F, FT = font(22), font(26)
ims = []
for path, lab in cells:
    if path == '-':
        ims.append((None, lab))
        continue
    im = Image.open(path).convert('RGB')
    im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    ims.append((im, lab))
rows = [ims[i:i + 2] for i in range(0, len(ims), 2)]
LH, TH = 34, 44
heights = [max((im.height if im else 0) for im, _ in r) + LH for r in rows]
sheet = Image.new('RGB', (2 * W + 12, TH + sum(heights) + 6 * len(rows)), (24, 28, 26))
d = ImageDraw.Draw(sheet)
d.text((10, 8), title, fill=(255, 236, 190), font=FT)
y = TH
for r, h in zip(rows, heights):
    for k, (im, lab) in enumerate(r):
        x = k * (W + 12)
        d.text((x + 8, y + 4), lab, fill=(235, 235, 225), font=F)
        if im:
            sheet.paste(im, (x, y + LH))
    y += h + 6
sheet.save(out, quality=88)
print('wrote', out, sheet.size)
