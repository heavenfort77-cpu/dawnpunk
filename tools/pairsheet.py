# Phone (left) and desktop (right) pairs stacked in rows, each labelled. Usage: python3 tools/pairsheet.py <out.jpg> <label> <low.png> <high.png> [<label> <low.png> <high.png> ...]
import sys
from PIL import Image, ImageDraw, ImageFont
out, args = sys.argv[1], sys.argv[2:]
rows = [args[i:i + 3] for i in range(0, len(args), 3)]
W = 800
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception: f = ImageFont.load_default()
ims = []
for label, lo, hi in rows:
    a, b = Image.open(lo).convert('RGB'), Image.open(hi).convert('RGB'); h = int(a.height * W / a.width); a, b = a.resize((W, h)), b.resize((W, h))
    r = Image.new('RGB', (2 * W + 6, h), (16, 16, 16)); r.paste(a, (0, 0)); r.paste(b, (W + 6, 0)); d = ImageDraw.Draw(r)
    for x, t in ((10, 'PHONE  ' + label), (W + 16, 'DESKTOP  ' + label)):
        w = d.textlength(t, font=f); d.rectangle((x - 6, 6, x + w + 6, 38), fill=(0, 0, 0)); d.text((x, 9), t, fill=(255, 255, 255), font=f)
    ims.append(r)
o = Image.new('RGB', (2 * W + 6, sum(i.height for i in ims) + 6 * (len(ims) - 1)), (16, 16, 16)); y = 0
for i in ims: o.paste(i, (0, y)); y += i.height + 6
o.save(out, quality=88)
