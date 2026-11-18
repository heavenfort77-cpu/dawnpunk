# Joins the frame strips of tools/peoplestrip.cjs into one before/after picture.
# Usage: python3 tools/peoplestrip_join.py <dir> <out.jpg> <title> <prefix:label> [<prefix:label> ...]
# Each prefix gives two rows (turn, walk); frames are cropped round the middle of the picture (where the camera looks) and labelled with their time.
import sys, os, glob
from PIL import Image, ImageDraw
# crop boxes in the 640 x 360 frame: turn = Bram at 3 m in the middle; walk = the walker crossing the middle at 4.5 m; scale = size of each cropped frame in the sheet
CFG = dict(turn=(120, 0, 420, 360), walk=(150, 60, 490, 360), scale=0.8, gap=4, head=26, label=150, bg=(22, 24, 28), fg=(235, 228, 205))
d, outp, title = sys.argv[1], sys.argv[2], sys.argv[3]; sets = [a.split(':', 1) for a in sys.argv[4:]]
rows = []
for kind in ('turn', 'walk'):
    for pre, lab in sets:
        fs = sorted(glob.glob(os.path.join(d, '%s_%s_*.png' % (pre, kind))), key=lambda f: int(f.rsplit('_', 1)[1][:-4]))
        if fs: rows.append(('%s %s' % (lab, kind), [Image.open(f).convert('RGB').crop(CFG[kind]) for f in fs]))
W = max(CFG['label'] + sum(int(im.width * CFG['scale']) + CFG['gap'] for im in r) for _, r in rows); H = CFG['head'] + sum(int(r[0].height * CFG['scale']) + CFG['gap'] for _, r in rows)
sh = Image.new('RGB', (W, H), CFG['bg']); dr = ImageDraw.Draw(sh); dr.text((8, 6), title, fill=CFG['fg']); y = CFG['head']
for lab, r in rows:
    dr.text((8, y + 8), lab, fill=CFG['fg']); x = CFG['label']
    for k, im in enumerate(r):
        im = im.resize((int(im.width * CFG['scale']), int(im.height * CFG['scale'])), Image.LANCZOS); sh.paste(im, (x, y)); dr.text((x + 3, y + 3), '%d' % k, fill=(255, 255, 120)); x += im.width + CFG['gap']
    y += int(r[0].height * CFG['scale']) + CFG['gap']
sh.save(outp, quality=88); print('saved', outp, sh.size)
