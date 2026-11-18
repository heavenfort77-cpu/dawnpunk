# Drill and small-screen sheet (owner Nov 17 18:28). Usage: python3 -I tools/drillsheet.py <shot dir> <out.jpg>
# Rows: desktop, phone. Columns: the night screen before (the build of 14:29, same layout as the owner's shot), night 1 with the drill, night 2 (clean screen).
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
W = 760
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
except Exception:
    font = ImageFont.load_default()
rows = []
for lab, cols in [('Desktop 1280x720', ['before_nightD', 'after_drillD', 'after_n2D']), ('Phone, Pixel 7 sideways', ['before_nightP', 'after_drillP', 'after_n2P'])]:
    ims = []
    for c in cols:
        f = os.path.join(d, c + '.png')
        ims.append(Image.open(f).convert('RGB') if os.path.exists(f) else Image.new('RGB', (1280, 720), (40, 0, 0)))
    ims = [i.resize((W, round(i.height * W / i.width)), Image.LANCZOS) for i in ims]
    h = max(i.height for i in ims) + 34
    r = Image.new('RGB', (3 * W + 40, h), (24, 24, 24)); dr = ImageDraw.Draw(r)
    for k, (i, t) in enumerate(zip(ims, ['BEFORE (night)', 'NIGHT 1: drill', 'NIGHT 2: clean screen'])):
        dr.text((10 + k * (W + 10), 6), lab + ': ' + t, fill=(255, 225, 170), font=font); r.paste(i, (10 + k * (W + 10), 32))
    rows.append(r)
ims = [Image.open(os.path.join(d, c + '.png')).convert('RGB') for c in ['after_mapD', 'after_mapP'] if os.path.exists(os.path.join(d, c + '.png'))]
if ims:
    ims = [i.resize((W, round(i.height * W / i.width)), Image.LANCZOS) for i in ims]; r = Image.new('RGB', (3 * W + 40, max(i.height for i in ims) + 34), (24, 24, 24)); dr = ImageDraw.Draw(r)
    for k, (i, t) in enumerate(zip(ims, ['Base by day, desktop: the Marla map', 'Base by day, phone: the Marla map'])):
        dr.text((10 + k * (W + 10), 6), t, fill=(255, 225, 170), font=font); r.paste(i, (10 + k * (W + 10), 32))
    rows.append(r)
sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows) + 10), (10, 10, 10)); y = 0
for r in rows:
    sheet.paste(r, (0, y)); y += r.height + 10
sheet.save(out, quality=88); print('wrote', out, sheet.size)
