# DENSITY pass picture sheets: rows of NOW (density off) and AFTER (density on) pairs, each labelled, with the owner's quality reference as a small labelled panel at the top.
# Usage: python3 tools/densitysheet.py <out.jpg> <title> <label> <now.png> <after.png> [<label> <now.png> <after.png> ...]
import sys
from PIL import Image, ImageDraw, ImageFont
out, title, args = sys.argv[1], sys.argv[2], sys.argv[3:]
rows = [args[i:i + 3] for i in range(0, len(args), 3)]
W = 760
try:
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    ft = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception:
    f = ft = ImageFont.load_default()
def tag(d, x, y, t, font):
    w = d.textlength(t, font=font); d.rectangle((x - 6, y - 3, x + w + 6, y + font.size + 6), fill=(0, 0, 0)); d.text((x, y), t, fill=(255, 255, 255), font=font)
ims = []
ref = Image.open(__file__.rsplit('/', 2)[0] + '/docs/ref/bg_standard_crop.jpg').convert('RGB'); rh = 150; ref = ref.resize((int(ref.width * rh / ref.height), rh))
head = Image.new('RGB', (2 * W + 6, rh + 12), (16, 16, 16)); head.paste(ref, (2 * W + 6 - ref.width - 6, 6)); d = ImageDraw.Draw(head)
tag(d, 2 * W + 6 - ref.width, 10, 'quality reference, another game', f); tag(d, 12, 14, title, ft); tag(d, 12, 56, 'left: NOW (density off)   right: AFTER (density on)', f); tag(d, 12, 92, 'desktop tier, day, seed 777, software renderer', f)
ims.append(head)
for label, lo, hi in rows:
    a, b = Image.open(lo).convert('RGB'), Image.open(hi).convert('RGB'); h = int(a.height * W / a.width); a, b = a.resize((W, h)), b.resize((W, h))
    r = Image.new('RGB', (2 * W + 6, h), (16, 16, 16)); r.paste(a, (0, 0)); r.paste(b, (W + 6, 0)); d = ImageDraw.Draw(r)
    tag(d, 10, 10, 'NOW  ' + label, f); tag(d, W + 16, 10, 'AFTER  ' + label, f)
    ims.append(r)
o = Image.new('RGB', (2 * W + 6, sum(i.height for i in ims) + 6 * (len(ims) - 1)), (16, 16, 16)); y = 0
for i in ims:
    o.paste(i, (0, y)); y += i.height + 6
o.save(out, quality=86)
print(out, o.size)
