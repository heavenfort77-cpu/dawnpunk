# Cheek colour of a face picture: mean RGB of a small patch on each cheek, and the red/green and blue/green ratios. Usage: python3 tools/cheekmeasure.py <image> <x1,y1> <x2,y2> [half size, default 8]
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); h = int(sys.argv[4]) if len(sys.argv) > 4 else 8; tot = [0, 0, 0]; n = 0
for a in sys.argv[2:4]:
    x, y = map(int, a.split(','))
    for yy in range(y - h, y + h):
        for xx in range(x - h, x + h):
            p = im.getpixel((xx, yy)); tot = [tot[i] + p[i] for i in range(3)]; n += 1
r, g, b = [t / n for t in tot]
print('%s mean RGB %.0f %.0f %.0f  red/green %.2f  blue/green %.2f' % (sys.argv[1].split('/')[-1], r, g, b, r / g, b / g))
