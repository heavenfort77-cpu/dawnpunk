# Phone look sheet and numbers for tools/phonelookvs.cjs pictures. Usage: python3 tools/phonelooksheet.py <dir> <W>x<H> <out.jpg> [hud.jsonl]
# Per view and build: sharpness (mean gradient magnitude, Sobel, on 0-255 grey; and variance of the Laplacian), mean brightness (0-255 grey), contrast (standard deviation of grey),
# and the HUD's share of the screen (from the JSON lines phonelookvs.cjs printed). Sheet: Nov 14 build (left) | phone today (right), both at the same size, the numbers under each.
import sys, json, numpy as np, cv2
D, size, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
hud = {}
if len(sys.argv) > 4:
    for ln in open(sys.argv[4]):
        ln = ln.strip()
        if ln.startswith('{'):
            q = json.loads(ln)
            hud[(q['build'], q['size'].split('@')[0], q['view'])] = q['hud']
VIEWS = ['base', 'street', 'night', 'gloom', 'play']
def metrics(im):
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    return dict(grad=float(np.mean(np.hypot(gx, gy))), lap=float(cv2.Laplacian(g, cv2.CV_32F).var()), mean=float(g.mean()), std=float(g.std()))
rows, table = [], []
for v in VIEWS:
    cells = []
    for b in ['old', 'new']:
        im = cv2.imread('%s/%s_%s_%s.png' % (D, b, size, v))
        if im is None:
            cells.append(None); continue
        m = metrics(im); h = hud.get((b, size, v))
        table.append((v, b, im.shape[1], im.shape[0], m, h))
        sc = 900 / im.shape[1]; small = cv2.resize(im, (900, int(im.shape[0] * sc)), interpolation=cv2.INTER_AREA)
        lab = np.full((54, 900, 3), 24, np.uint8)
        cv2.putText(lab, '%s  %s  (%s, %dx%d px)' % (v, 'Nov 14 build (batch39)' if b == 'old' else 'phone today (low)', size, im.shape[1], im.shape[0]), (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (235, 235, 235), 1, cv2.LINE_AA)
        cv2.putText(lab, 'sharpness %.1f (lap var %.0f)  brightness %.0f  contrast %.0f  HUD %s' % (m['grad'], m['lap'], m['mean'], m['std'], ('%.0f%%' % (100 * h)) if h is not None else '-'), (8, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 230, 255), 1, cv2.LINE_AA)
        cells.append(np.vstack([small, lab]))
    hh = max(c.shape[0] for c in cells if c is not None)
    cells = [c if c is not None else np.zeros((hh, 900, 3), np.uint8) for c in cells]
    cells = [np.vstack([c, np.zeros((hh - c.shape[0], 900, 3), np.uint8)]) for c in cells]
    rows.append(np.hstack([cells[0], np.full((hh, 8, 3), 255, np.uint8), cells[1]]))
sheet = np.vstack([np.vstack([r, np.full((8, r.shape[1], 3), 255, np.uint8)]) for r in rows])
cv2.imwrite(OUT, sheet, [cv2.IMWRITE_JPEG_QUALITY, 86])
print('view    build  px          sharp   lapvar  bright  contrast  hud')
for v, b, w, h, m, hu in table:
    print('%-7s %-5s  %4dx%-4d  %6.2f  %7.0f  %6.1f  %7.1f  %s' % (v, b, w, h, m['grad'], m['lap'], m['mean'], m['std'], ('%.1f%%' % (100 * hu)) if hu is not None else '-'))
print('sheet', OUT, sheet.shape[1], 'x', sheet.shape[0])
