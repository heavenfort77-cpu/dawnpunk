# Packs the painted textures in art/tex into src/texdata.js (data URIs), so the game stays one HTML file.
# Opaque textures become JPEG, textures with see-through parts stay PNG. Usage: python3 tools/maketex.py
import base64, io, os, sys
from PIL import Image
D = os.path.join(os.path.dirname(__file__), '..', 'art', 'tex'); out = []; total = 0
BIG = 512  # the hard surfaces are packed at 512 px (was 128 to 256) so fine detail survives on a wall
SIZE = dict(plaster=BIG, interior=BIG, brick=BIG, wood=BIG, roof=BIG, asphalt=BIG, grass=256, rust=256, bark=128, leaves=128, tuft=128, vine=256, debris=128, canopy=256, ring=128, fabric=128, gloom=128, metal=256, siding=BIG, block=BIG, tiles=BIG, flowers=128, paint=256, glaze=256, cell=128, scorch=128, stain=128, render=BIG, shade=64, pool=128, worn=BIG, hole=256, crack=256, grime=256, cobweb=256, leak=256, edge=256, dust=256,
            ivy=256, moss=256, streaks=256, litter=256, meadow=256, chalk=BIG, footgrime=512, roadcrack=512, carrust=512, catcalico_b=256, catcalico_h=256, catkuro_b=256, catkuro_h=256, catkutani_b=256, catkutani_h=256)   # desolate sample (2026-11-15); footgrime, roadcrack and carrust are wide strips, packed at this width and their own shape
FOLIAGE = dict(leaves=(0.7, 0.9), tuft=(0.7, 0.9), vine=(0.7, 0.9), canopy=(0.7, 0.9), flowers=(0.85, 0.95))  # (colour kept, brightness)
RELIEF = dict(plaster=1.6, interior=1.4, brick=2.4, wood=3.4, roof=2.6, asphalt=2.2, siding=2.4, block=2.4, tiles=2.6, render=1.0, worn=1.8, paint=1.4, metal=1.4, rust=2.0, glaze=0.6, grass=1.6, bark=2.4, chalk=1.2)  # surface relief worked out from each texture's light and dark (klad does not make relief maps); the number is its strength
for name, size in SIZE.items():
    p = os.path.join(D, name + '.png'); im = Image.open(p).convert('RGBA'); im = im.resize((size, round(size * im.height / im.width)), Image.LANCZOS); b = io.BytesIO()
    if name in FOLIAGE:   # realistic pass: plant cards lose some colour and brightness so they sit with the quiet surfaces
        import numpy as np
        q = np.asarray(im).astype(float); g = q[..., :3].mean(axis=2, keepdims=True); q[..., :3] = np.clip((g + (q[..., :3] - g) * FOLIAGE[name][0]) * FOLIAGE[name][1], 0, 255); im = Image.fromarray(q.astype('uint8'), 'RGBA')
    if im.getextrema()[3][0] < 250: im.save(b, 'PNG', optimize=True); mime = 'image/png'
    else: im.convert('RGB').save(b, 'JPEG', quality=86); mime = 'image/jpeg'
    total += len(b.getvalue()); out.append("  %s: 'data:%s;base64,%s'" % (name, mime, base64.b64encode(b.getvalue()).decode()))
    if name in RELIEF:
        import numpy as np
        from PIL import ImageFilter
        n = 256; g = np.asarray(Image.open(p).convert('L').resize((n, n), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255
        dx = (np.roll(g, -1, 1) - np.roll(g, 1, 1)) * RELIEF[name] * 4; dy = (np.roll(g, -1, 0) - np.roll(g, 1, 0)) * RELIEF[name] * 4; nz = np.ones_like(g); ln = np.sqrt(dx * dx + dy * dy + nz * nz)
        nm = np.stack([(-dx / ln) * 0.5 + 0.5, (dy / ln) * 0.5 + 0.5, (nz / ln) * 0.5 + 0.5], 2); b2 = io.BytesIO(); Image.fromarray((nm * 255).astype('uint8')).save(b2, 'JPEG', quality=86)
        total += len(b2.getvalue()); out.append("  %s_n: 'data:image/jpeg;base64,%s'" % (name, base64.b64encode(b2.getvalue()).decode()))
# HIGH TIER (2026-11-15, desktops and laptops): sharper copies written as files to art/texhi (build.mjs copies them to dist/tex/ beside index.html) and listed in src/texhi.js.
# Hard surfaces come from art/tex_hi (the same strokes repainted on a 1024 canvas: PAINT_SCALE=2 python3 art/paint_textures.py ...); decals and plant cards from the 512 px paintings in art/tex.
# Relief maps are made at the texture's own size; their strength is scaled so that, averaged back down to 256 px, each one tilts exactly as much as the phone set's map (same relief, finer detail on top).
import numpy as np
from PIL import ImageFilter
HI = dict(plaster=1024, interior=1024, render=1024, block=1024, brick=1024, siding=1024, wood=1024, roof=1024, tiles=1024, asphalt=1024, worn=1024, metal=1024, rust=1024, glaze=1024, grass=1024, bark=512,
          tuft=512, vine=512, canopy=512, leaves=512, flowers=512, debris=512, fabric=512, cell=512, scorch=512, stain=512, hole=512, crack=512, grime=512, cobweb=512, leak=512, edge=512, dust=512, pool=256,
          ivy=512, moss=512, streaks=512, litter=512, meadow=512, chalk=1024, footgrime=1024, roadcrack=1024, carrust=1024, catcalico_b=512, catcalico_h=512, catkuro_b=512, catkuro_h=512, catkutani_b=512, catkutani_h=512)
HD = os.path.join(os.path.dirname(__file__), '..', 'art', 'texhi'); os.makedirs(HD, exist_ok=True); hi = []; htotal = 0
def nmap(src, n, k, blur, mult):
    g = np.asarray(Image.open(src).convert('L').resize((n, n), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))).astype(float) / 255
    dx = (np.roll(g, -1, 1) - np.roll(g, 1, 1)) * k * mult; dy = (np.roll(g, -1, 0) - np.roll(g, 1, 0)) * k * mult; ln = np.sqrt(dx * dx + dy * dy + 1); return np.stack([-dx / ln, dy / ln, 1 / ln], 2)
def tilt256(N):
    f = N.shape[0] // 256; d = np.stack([N[..., c].reshape(256, f, 256, f).mean(axis=(1, 3)) for c in range(3)], 2); d /= np.linalg.norm(d, axis=2, keepdims=True); return np.degrees(np.arccos(np.clip(d[..., 2], 0, 1))).mean()
for name, size in HI.items():
    src = os.path.join(D, '..', 'tex_hi', name + '.png'); src = src if os.path.exists(src) else os.path.join(D, name + '.png')
    im = Image.open(src).convert('RGBA'); im = im.resize((size, round(size * im.height / im.width)), Image.LANCZOS)
    if name in FOLIAGE:
        q = np.asarray(im).astype(float); g = q[..., :3].mean(axis=2, keepdims=True); q[..., :3] = np.clip((g + (q[..., :3] - g) * FOLIAGE[name][0]) * FOLIAGE[name][1], 0, 255); im = Image.fromarray(q.astype('uint8'), 'RGBA')
    if im.getextrema()[3][0] < 250: fn = name + '.png'; im.save(os.path.join(HD, fn), 'PNG', optimize=True)
    else: fn = name + '.jpg'; im.convert('RGB').save(os.path.join(HD, fn), 'JPEG', quality=86)
    htotal += os.path.getsize(os.path.join(HD, fn)); hi.append("  %s: 'tex/%s'" % (name, fn))
    if name in RELIEF and size >= 512:
        k = RELIEF[name]; ref = nmap(os.path.join(D, name + '.png'), 256, k, 0.8, 4); t0 = np.degrees(np.arccos(np.clip(ref[..., 2], 0, 1))).mean()
        N = nmap(src, size, k, 1.2 * size / 1024, 10 * size / 1024); N = nmap(src, size, k, 1.2 * size / 1024, 10 * size / 1024 * t0 / max(0.01, tilt256(N)))
        Image.fromarray(((N * 0.5 + 0.5) * 255).astype('uint8')).save(os.path.join(HD, name + '_n.jpg'), 'JPEG', quality=86)
        htotal += os.path.getsize(os.path.join(HD, name + '_n.jpg')); hi.append("  %s_n: 'tex/%s_n.jpg'" % (name, name))
open(os.path.join(os.path.dirname(__file__), '..', 'src', 'texhi.js'), 'w').write('// generated by tools/maketex.py: the high-tier textures, as files in dist/tex/ beside index.html (desktops and laptops; see CONFIG.quality)\nexport const TEXHI = {\n' + ',\n'.join(hi) + '\n};\n')
print('texhi.js', len(hi), 'files', round(htotal / 1024), 'KB in art/texhi')
open(os.path.join(os.path.dirname(__file__), '..', 'src', 'texdata.js'), 'w').write('// generated by tools/maketex.py from art/tex/*.png (painted with klad)\nexport const TEX = {\n' + ',\n'.join(out) + '\n};\n')
print('texdata.js', len(out), 'textures', round(total / 1024), 'KB')
