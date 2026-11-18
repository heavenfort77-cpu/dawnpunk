# Control sheet of a base person's scan face (owner's facial-rig test, Nov 16): the rest face and each main face control alone at full strength,
# rendered by build_people.py <who> expr fast ctrlsheet ...; each tile is captioned with the control and its face check line (FACECHECK in the build log).
# Usage: python3 tools/people_ctrlsheet.py <render dir> <build log> <out.jpg> [title]
import sys, re
from PIL import Image, ImageDraw
# crop = box of each 520 x 640 face render kept (face only); cols = tiles per row; cap = caption band height (px); bg / ok / bad = colours
CFG = dict(crop=(90, 150, 430, 560), cols=6, cap=30, gap=4, head=26, bg=(22, 24, 28), ok=(225, 222, 205), bad=(255, 110, 90))
d, logp, outp = sys.argv[1], sys.argv[2], sys.argv[3]; title = sys.argv[4] if len(sys.argv) > 4 else 'face controls, each alone at full strength'
chk = {}
for line in open(logp, errors='replace'):
    m = re.match(r'FACECHECK (PASS|FAIL) ([^\s:]+)(.*)', line.strip())
    if m: chk[m.group(2)] = (m.group(1), m.group(3).lstrip(': '))
names = ['neutral'] + sorted(k for k in chk if k != 'neutral' and k.startswith('c_'))
w, h = CFG['crop'][2] - CFG['crop'][0], CFG['crop'][3] - CFG['crop'][1]; rows = (len(names) + CFG['cols'] - 1) // CFG['cols']
sh = Image.new('RGB', (CFG['cols'] * (w + CFG['gap']) + CFG['gap'], CFG['head'] + rows * (h + CFG['cap'] + CFG['gap'])), CFG['bg']); dr = ImageDraw.Draw(sh)
npass = sum(1 for v in chk.values() if v[0] == 'PASS'); dr.text((6, 7), '%s   face check: %d of %d PASS (no lid point inside the eyeball, no lip point behind the teeth front)' % (title, npass, len(chk)), fill=CFG['ok'])
for k, n in enumerate(names):
    x = CFG['gap'] + (k % CFG['cols']) * (w + CFG['gap']); y = CFG['head'] + (k // CFG['cols']) * (h + CFG['cap'] + CFG['gap'])
    try: sh.paste(Image.open('%s/e_%s_face.png' % (d, n)).convert('RGB').crop(CFG['crop']), (x, y))
    except FileNotFoundError: dr.text((x + 6, y + 6), 'no render', fill=CFG['bad'])
    st, why = chk.get(n, ('?', '')); dr.text((x + 4, y + h + 2), '%s  %s' % (n.replace('c_', ''), st), fill=CFG['ok'] if st == 'PASS' else CFG['bad'])
    if why: dr.text((x + 4, y + h + 15), why[:52], fill=CFG['bad'])
sh.save(outp, quality=88); print('saved', outp, sh.size, '%d of %d PASS' % (npass, len(chk)))
