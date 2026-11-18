# Joins the pictures from tools/gloomglbshot.cjs into one sheet and one walking strip.
# Usage: python3 tools/gloomglbjoin.py <shot dir> <sheet.jpg> <strip.jpg> [old label] [new label] [old dir]
# old dir: take the left pictures from <old dir>/<view>_new.png instead (e.g. an earlier model shot with the same tool), so a sheet can compare model versions.
import sys, json, os
from PIL import Image, ImageDraw, ImageFont

d, sheet, strip = sys.argv[1], sys.argv[2], sys.argv[3]
LO = sys.argv[4] if len(sys.argv) > 4 else 'CURRENT desktop builder'
LN = sys.argv[5] if len(sys.argv) > 5 else 'NEW Blender model'
OD = sys.argv[6] if len(sys.argv) > 6 else None
info = json.load(open(os.path.join(d, 'info.json')))
info_o = json.load(open(os.path.join(OD, 'info.json'))) if OD else info
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)


def lab(im, txt):
    dr = ImageDraw.Draw(im)
    bb = dr.textbbox((0, 0), txt, font=F)
    dr.rectangle([4, 4, bb[2] + 16, bb[3] + 14], fill=(12, 12, 12))
    dr.text((10, 8), txt, font=F, fill=(255, 255, 255))
    return im


rows = []
for v, name in (('day', 'by day, 3 m'), ('night', 'night, from inside a house window'), ('head', 'head close-up'), ('leg', 'leg close-up')):
    if not os.path.exists(os.path.join(OD, v + '_new.png') if OD else os.path.join(d, v + '_old.png')):
        continue
    pair = []
    for k, who in (('old', LO), ('new', LN)):
        src = os.path.join(OD, f'{v}_new.png') if (OD and k == 'old') else os.path.join(d, f'{v}_{k}.png')
        im = Image.open(src).convert('RGB')
        t = (info_o.get(f'{v}_new', [0]) if (OD and k == 'old') else info.get(f'{v}_{k}', [0]))[0]
        pair.append(lab(im, f'{who} - {name} ({t:,} tris)'))
    w = pair[0].width + pair[1].width + 6
    row = Image.new('RGB', (w, pair[0].height), (40, 40, 40))
    row.paste(pair[0], (0, 0))
    row.paste(pair[1], (pair[0].width + 6, 0))
    rows.append(row)
# head and leg side by side on one row if both exist, scaled to the row width
W = max(r.width for r in rows)
H = sum(r.height for r in rows) + 6 * (len(rows) - 1)
out = Image.new('RGB', (W, H), (40, 40, 40))
y = 0
for r in rows:
    out.paste(r, (0, y))
    y += r.height + 6
out = out.resize((out.width * 2 // 3, out.height * 2 // 3), Image.LANCZOS)
out.save(sheet, quality=88)
fr = sorted(f for f in os.listdir(d) if f.startswith('walk_'))
if fr:
    ims = [Image.open(os.path.join(d, f)).convert('RGB') for f in fr]
    cw, ch = 300, int(300 * ims[0].height / ims[0].width)
    ims = [i.crop((i.width // 6, 0, i.width * 5 // 6, i.height)).resize((cw * 2 // 3 * 3 // 2, ch), Image.LANCZOS) for i in ims]
    cols = 6
    st = Image.new('RGB', (ims[0].width * cols + 4 * (cols - 1), (ch + 4) * ((len(ims) + cols - 1) // cols)), (40, 40, 40))
    for k, i in enumerate(ims):
        i = lab(i, f'{k * 0.25:.2f} s ' + ('FROZEN' if info.get('walk%d' % k) == 'frozen' else ''))
        st.paste(i, ((k % cols) * (i.width + 4), (k // cols) * (ch + 4)))
    st.save(strip, quality=88)
print('saved', sheet, strip)
