# Fresh-player fixes sheet (owner Nov 18). Usage: python3 -I tools/freshfixsheet.py <shot dir> <out.jpg>
# Row 1, desktop: waking view, Marla's day-1 first talk. Row 2, desktop: the drill's shoot step, the pause menu. Row 3, phone: waking view, the drill.
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
W = 900
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
except Exception:
    font = ImageFont.load_default()
grid = [[('D_wake', 'Desktop: waking, "Click to start · E to talk", Marla in the doorway'), ('D_dialog', "Desktop: Marla's day-1 first talk (pickers behind Set up the run)")],
        [('D_drill', 'Desktop: night-1 drill, shoot step: ringed machine, full bar, plain 2nd line'), ('D_pause', 'Desktop: pause menu with Keys, Journal, Map; music top right')],
        [('P_wake', 'Phone: waking, the USE button pulses'), ('P_drill', 'Phone: night-1 drill, ringed machine, full bar and switch tab')]]
rows = []
for row in grid:
    ims = []
    for name, cap in row:
        f = os.path.join(d, name + '.png')
        im = Image.open(f).convert('RGB') if os.path.exists(f) else Image.new('RGB', (1280, 720), (40, 0, 0))
        ims.append((im.resize((W, round(im.height * W / im.width)), Image.LANCZOS), cap if os.path.exists(f) else cap + ' (MISSING)'))
    h = max(i.height for i, _ in ims) + 34
    r = Image.new('RGB', (2 * W + 30, h), (24, 24, 24)); dr = ImageDraw.Draw(r)
    for k, (i, t) in enumerate(ims):
        dr.text((10 + k * (W + 10), 6), t, fill=(255, 225, 170), font=font); r.paste(i, (10 + k * (W + 10), 32))
    rows.append(r)
sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows) + 10 * len(rows)), (10, 10, 10)); y = 0
for r in rows:
    sheet.paste(r, (0, y)); y += r.height + 10
sheet.save(out, quality=86); print('wrote', out, sheet.size)
