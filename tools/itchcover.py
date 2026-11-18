# itch.io cover and contact sheet (owner Nov 18). The game pictures are copied untouched; the only addition is the title on the cover, taken from the game's own
# title card as the page draws it (tools/itchshot.cjs title: #stitle on a transparent page, 3x): the DAWNPUNK wordmark with its flourish, and its tagline.
# Usage: python3 tools/itchcover.py cover <keyart.png> <title_alpha.png> <crop x0> <crop y0> <crop h> <title cy share> <out.png>
#        python3 tools/itchcover.py sheet <out.jpg> <label=png> ...
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def rows(a):
    """split the title picture into its bands (wordmark+flourish, tagline) by empty alpha rows"""
    al = a.split()[3]; w, h = a.size; px = al.load(); filled = [any(px[x, y] > 40 for x in range(0, w, 2)) for y in range(h)]
    bands, y = [], 0
    while y < h:
        if filled[y]:
            y0 = y
            while y < h and filled[y]: y += 1
            bands.append((y0, y))
        else: y += 1
    return bands

def trim(im):
    bb = im.split()[3].point(lambda v: 255 if v > 6 else 0).getbbox(); return im.crop(bb)

def cover(src, title, x0, y0, ch, cy, out):
    W, H = 630, 500
    k = Image.open(src).convert('RGB'); cw = round(ch * W / H); art = k.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.LANCZOS)
    t = Image.open(title).convert('RGBA'); b = rows(t); print('title bands', b)
    # the wordmark and flourish are the bands down to the last gap before the tagline; the tagline is the last band
    word = trim(t.crop((0, b[0][0], t.width, b[-2][1] if len(b) > 1 else b[0][1]))); tag = trim(t.crop((0, b[-1][0], t.width, b[-1][1]))) if len(b) > 1 else None
    ww = 560; word = word.resize((ww, round(word.height * ww / word.width)), Image.LANCZOS)
    o = art.convert('RGBA'); top = round(H * cy - word.height / 2)
    o.alpha_composite(word, ((W - ww) // 2, top))
    if tag is not None:
        tw = 330; tag = tag.resize((tw, round(tag.height * tw / tag.width)), Image.LANCZOS)
        # the tagline gets a dark halo round its letters (part of the title text, not the picture) so it reads on the art
        a = tag.split()[3].filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3)); halo = Image.new('RGBA', tag.size, (0, 0, 0, 0)); halo.putalpha(a.point(lambda v: min(255, int(v * 1.1))))
        ty = top + word.height + 6; o.alpha_composite(halo, ((W - tw) // 2, ty)); o.alpha_composite(tag, ((W - tw) // 2, ty))
    o = o.convert('RGB'); o.save(out, optimize=True); o.resize((315, 250), Image.LANCZOS).save(out.replace('.png', '_315x250.png'), optimize=True); print('wrote', out)

def sheet(out, items):
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); cw, chh, pad, lab = 960, 540, 12, 34
    cols = 2; n = len(items); r = (n + cols - 1) // cols; S = Image.new('RGB', (cols * cw + (cols + 1) * pad, r * (chh + lab) + (r + 1) * pad), (22, 22, 22)); d = ImageDraw.Draw(S)
    for i, (l, p) in enumerate(items):
        im = Image.open(p).convert('RGB'); x = pad + (i % cols) * (cw + pad); y = pad + (i // cols) * (chh + lab + pad)
        sc = min(cw / im.width, chh / im.height); im2 = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
        d.text((x, y + 4), l + '  (' + str(im.width) + 'x' + str(im.height) + ')', fill=(255, 226, 150), font=f); S.paste(im2, (x + (cw - im2.width) // 2, y + lab))
    S.save(out, quality=90); print('wrote', out, S.size)

if sys.argv[1] == 'cover':
    a = sys.argv; cover(a[2], a[3], int(a[4]), int(a[5]), int(a[6]), float(a[7]), a[8])
else:
    sheet(sys.argv[2], [tuple(s.split('=', 1)) for s in sys.argv[3:]])
