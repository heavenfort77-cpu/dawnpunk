# Contact sheet for tools/humanmotioncheck.cjs: one row per person (same label), up to 4 frames per tier, desktop (high) on the left, phone (low) on the right.
# Usage: python3 -I tools/humanmotionsheet.py <out.jpg> [--low <frames dir>] [--high <frames dir or a CI job log with IMG / IMGD lines>]
# Each frame is cut to the middle of the picture (a person stands in the middle) and scaled to one height.
import sys, os, json, re, base64, io
from PIL import Image, ImageDraw, ImageFont

def from_dir(d, tier):
    lab = json.load(open(os.path.join(d, tier + '_labels.json')))
    return [(lab[i], Image.open(os.path.join(d, '%s_%03d.jpg' % (tier, i))).convert('RGB')) for i in range(len(lab))]

def from_log(f):
    meta, data = {}, {}
    for line in open(f, errors='replace'):
        line = re.sub(r'^\S*Z ', '', line.rstrip('\n'))
        m = re.match(r'^IMG (\d+) (\w+) (.*)$', line)
        if m: meta[int(m.group(1))] = m.group(3); data.setdefault(int(m.group(1)), []); continue
        m = re.match(r'^IMGD (\d+) (\S+)$', line)
        if m: data.setdefault(int(m.group(1)), []).append(m.group(2))
    return [(meta[i], Image.open(io.BytesIO(base64.b64decode(''.join(data[i])))).convert('RGB')) for i in sorted(meta)]

def load(src, tier):
    if not src: return []
    return from_dir(src, tier) if os.path.isdir(src) else from_log(src)

def cut(im, h):
    w0, h0 = im.size; cw = int(h0 * 0.8)
    if cw < w0: x = (w0 - cw) // 2; im = im.crop((x, 0, x + cw, h0))
    return im.resize((int(im.size[0] * h / im.size[1]), h), Image.LANCZOS)

def key(label):
    return re.sub(r'\s*\((film|street)\)', r' \1', label)

def main():
    a = sys.argv[1:]; out = a[0]
    get = lambda k: a[a.index(k) + 1] if k in a else None
    tiers = [('desktop (high)', load(get('--high'), 'high')), ('phone (low)', load(get('--low'), 'low'))]
    tiers = [t for t in tiers if t[1]]
    rows = []
    for _, fr in tiers:
        for lab, _ in fr:
            if lab not in rows: rows.append(lab)
    H, PER, LW, PAD = 200, 4, 190, 6
    cells = {}
    for ti, (_, fr) in enumerate(tiers):
        for lab, im in fr:
            cells.setdefault((ti, lab), [])
            if len(cells[(ti, lab)]) < PER: cells[(ti, lab)].append(cut(im, H))
    cw = max([c.size[0] for v in cells.values() for c in v] + [160])
    W = LW + len(tiers) * (PER * (cw + PAD) + 14)
    sheet = Image.new('RGB', (W, 34 + len(rows) * (H + PAD) + 8), (24, 26, 30))
    dr = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    except Exception: font = ImageFont.load_default()
    for ti, (name, _) in enumerate(tiers):
        dr.text((LW + ti * (PER * (cw + PAD) + 14), 8), name + '  (frames left to right, in time order)', fill=(240, 230, 200), font=font)
    for r, lab in enumerate(rows):
        y = 34 + r * (H + PAD)
        words, line, ly = lab.split(' '), '', y + 6
        for w_ in words:
            if dr.textlength(line + ' ' + w_, font=font) > LW - 10 and line: dr.text((6, ly), line, fill=(230, 230, 230), font=font); ly += 19; line = w_
            else: line = (line + ' ' + w_).strip()
        dr.text((6, ly), line, fill=(230, 230, 230), font=font)
        for ti in range(len(tiers)):
            for k, im in enumerate(cells.get((ti, lab), [])):
                sheet.paste(im, (LW + ti * (PER * (cw + PAD) + 14) + k * (cw + PAD), y))
    sheet.save(out, quality=85)
    print('wrote', out, sheet.size, 'rows', len(rows))

main()
