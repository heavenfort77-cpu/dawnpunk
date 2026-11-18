# Side-by-side sheet of tools/peopleface.cjs close-ups: rows = tiers, columns = current face / scan face, each with a caption line.
# Usage: python3 tools/peopleface_join.py <out.jpg> <title> [cols:N] <img:caption> <img:caption> [<img:caption> <img:caption> ...]   (two per row, or N with cols:N)
# An <img> may be <file>@x0,y0,x1,y1 = that box of a bigger picture (e.g. a panel of an earlier sample sheet), scaled to the size of the other panels.
import sys
from PIL import Image, ImageDraw
# crop = box round the middle of the 640 x 480 picture (the camera looks at the head); cap = caption band height; gap between pictures
CFG = dict(crop=(150, 20, 490, 470), cap=34, gap=6, head=28, bg=(22, 24, 28), fg=(235, 228, 205))
outp, title = sys.argv[1], sys.argv[2]; rest = sys.argv[3:]; NCOL = 2
if rest and rest[0].startswith('cols:'): NCOL = int(rest[0][5:]); rest = rest[1:]
items = [a.split(':', 1) for a in rest]
def load(f):
    if '@' not in f: return Image.open(f).convert('RGB').crop(CFG['crop'])
    f, b = f.split('@'); x0, y0, x1, y1 = map(int, b.split(',')); w0, h0 = CFG['crop'][2] - CFG['crop'][0], CFG['crop'][3] - CFG['crop'][1]
    return Image.open(f).convert('RGB').crop((x0, y0, x1, y1)).resize((w0, h0), Image.LANCZOS)
ims = [(load(f), c) for f, c in items]; w, h = ims[0][0].size; rows = (len(ims) + NCOL - 1) // NCOL
sh = Image.new('RGB', (NCOL * w + (NCOL + 1) * CFG['gap'], CFG['head'] + rows * (h + CFG['cap'] + CFG['gap'])), CFG['bg']); dr = ImageDraw.Draw(sh); dr.text((8, 8), title, fill=CFG['fg'])
for k, (im, c) in enumerate(ims):
    x = CFG['gap'] + (k % NCOL) * (w + CFG['gap']); y = CFG['head'] + (k // NCOL) * (h + CFG['cap'] + CFG['gap']); sh.paste(im, (x, y))
    for j, line in enumerate(c.split('|')): dr.text((x + 4, y + h + 3 + 13 * j), line, fill=CFG['fg'])
sh.save(outp, quality=90); print('saved', outp, sh.size)
