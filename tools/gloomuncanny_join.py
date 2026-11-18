# Join the uncanny Gloom motion sample frames (tools/gloomuncannyshot.cjs strip) into one picture: old motion on the top row, new on the bottom, 12 frames each, time under each frame,
# and a red mark naming the machines that were frozen (holding a pose) in that frame. Usage: python3 tools/gloomuncanny_join.py <frames dir> <out.jpg> [scale] [x0,y0,x1,y1 crop]
import sys, json, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
sc = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
# optional crop box x0,y0,x1,y1 in frame pixels (keeps the machines, drops sky and road)
box = [int(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
st = json.load(open(os.path.join(d, 'strip_state.json')))
rows = [('OLD motion', 'strip_old', st['old']), ('NEW motion (uncanny)', 'strip_new', st['new'])]
first = Image.open(os.path.join(d, 'strip_old_000.png'))
if box: first = first.crop(box)
w, h = int(first.width * sc), int(first.height * sc)
n = len(st['old'])
lab = 22
sheet = Image.new('RGB', (w * n, (h + lab) * 2), (16, 16, 16))
dr = ImageDraw.Draw(sheet)
for r, (name, pre, state) in enumerate(rows):
    y0 = r * (h + lab)
    dr.text((6, y0 + 5), name, fill=(255, 230, 120))
    for k in range(n):
        im = Image.open(os.path.join(d, '%s_%03d.png' % (pre, k))).convert('RGB')
        if box: im = im.crop(box)
        im = im.resize((w, h), Image.LANCZOS)
        sheet.paste(im, (k * w, y0 + lab))
        dr.text((k * w + 170 if k == 0 else k * w + 4, y0 + 5), 't=%.2fs' % (k / 6), fill=(200, 200, 200))
        fz = [st['kinds'][i] for i, f in enumerate(state[k]) if f]
        if fz:
            dr.rectangle([k * w, y0 + lab + h - 18, k * w + w - 1, y0 + lab + h - 1], fill=(150, 20, 20))
            dr.text((k * w + 4, y0 + lab + h - 15), 'frozen: ' + ', '.join(fz), fill=(255, 255, 255))
        dr.line([k * w, y0 + lab, k * w, y0 + lab + h], fill=(16, 16, 16), width=2)
sheet.save(out, quality=88)
print('wrote', out, sheet.size)
