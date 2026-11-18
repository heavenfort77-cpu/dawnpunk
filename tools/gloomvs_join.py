# Phone (left) and desktop (right) pictures of one thing, labelled. Usage: python3 tools/gloomvs_join.py <low.png> <high.png> <out.jpg> [label]
import sys
from PIL import Image, ImageDraw, ImageFont
a, b = Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB')
label = sys.argv[4] if len(sys.argv) > 4 else ''
out = Image.new('RGB', (a.width + b.width + 6, max(a.height, b.height)), (16, 16, 16)); out.paste(a, (0, 0)); out.paste(b, (a.width + 6, 0))
d = ImageDraw.Draw(out)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: f = ImageFont.load_default()
for x, t in ((12, 'PHONE ' + label), (a.width + 18, 'DESKTOP ' + label)):
    w = d.textlength(t, font=f); d.rectangle((x - 6, 8, x + w + 6, 44), fill=(0, 0, 0)); d.text((x, 11), t, fill=(255, 255, 255), font=f)
out.save(sys.argv[3], quality=90)
