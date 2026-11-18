// The same five views at both graphics tiers, side by side at the same scale: street by day, base, a car up close, a machine up close, inside a house at night.
// Usage: node tools/tiershot.cjs <docs/sample_graphics_tiers> [desktop|phone|both]. dist/ is served over local http so the high tier's texture files load; Math.random is seeded so both tiers build the same street.
// Writes <prefix>_desktop.png, <prefix>_phone.png (whole views, each pair at the same scale) and <prefix>_closeups_<size>.png (the middle of each view at 1:1 screen pixels). Software renderer.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const OUT = process.argv[2] || 'docs/sample_graphics_tiers', WHICH = process.argv[3] || 'both', DIST = path.join(__dirname, '..', 'dist'), TMP = path.join(require('os').tmpdir(), 'tiershot'); fs.mkdirSync(TMP, { recursive: true });
const SIZES = { desktop: { width: 1280, height: 720, scale: 2 }, phone: { width: 844, height: 390, scale: 2 } };
const VIEWS = ['street by day', 'base', 'car up close', 'machine up close', 'inside a house at night'];
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const SEED = () => { let s = 1; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; window.__reseed = (n) => { s = n; }; };
async function shoot(b, url, size, tier) {
  const ctx = await b.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.scale }); await ctx.addInitScript(SEED); const p = await ctx.newPage(); p.setDefaultTimeout(300000); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(url + '?quality=' + tier); await p.waitForFunction(() => window.__game && window.__game.quality);
  const frames = (n) => p.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = async (i) => { await frames(3); await p.screenshot({ path: path.join(TMP, tier + '_' + i + '.png'), timeout: 300000 }); };
  const hide = () => p.evaluate(() => { window.__noHands = true; document.getElementById('hud').style.visibility = 'hidden'; });
  await p.evaluate(() => { window.__reseed(99); window.__game.enterBase(); }); await hide(); await p.waitForTimeout(1500);
  for (let k = 0; k < 60; k++) { const h = await p.evaluate(() => window.__game.quality().hi); if (h.ok + h.failed >= h.asked) break; await p.waitForTimeout(500); }
  await p.evaluate(() => { window.__game.setBase(-6, 6); window.__game.setYaw(0.75); }); await shot(1);
  await p.evaluate(() => { window.__reseed(4242); document.getElementById('selRing').value = '2'; window.__game.startRun(0); }); await hide(); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__game.setTown(-30, 1.2); window.__game.setYaw(-1.45); window.__game.setPitch(0); }); await shot(0);
  const c = await p.evaluate(() => { const r = window.__game.run, P = { x: -30, z: 1 }; return r.cars.slice().sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; });
  { const a = c.yaw + 0.9, x = c.x + Math.sin(a) * 3.4, z = c.z + Math.cos(a) * 3.4; await p.evaluate(([x, z, yaw]) => { window.__game.setTown(x, z); window.__game.setYaw(yaw); window.__game.setPitch(-0.2); }, [x, z, Math.atan2(-(c.x - x), -(c.z - z))]); await shot(2); }
  await p.evaluate(() => { const g = window.__game; g.setTown(-20, 0.8); g.setYaw(-Math.PI / 2); g.setPitch(0.02); g.gloomSample('walker', -18.1, -0.35, Math.PI / 2 + 0.35, 3, false); g.gloomSample('hauler', -17.3, 1.9, Math.PI / 2 - 0.4, 3, false); }); await shot(3);
  const info = await p.evaluate(() => { const r = window.__game.run; for (const h of r.houses) for (const q of h.sim.breaches) if (q.type === 'gap' && q.floor === 0) return { i: h.i, x: q.x, z: q.z, nx: q.nx, nz: q.nz }; });
  await p.evaluate(([i, x, z, yaw]) => { window.__reseed(777); window.__game.enterHouse(i); const s = window.__game.sim; s.player.x = x; s.player.z = z; window.__game.setYaw(yaw); window.__game.setPitch(0); }, [info.i, info.x + info.nx * 4.5 + info.nz * 1.5, info.z + info.nz * 4.5 - info.nx * 1.5, Math.atan2(info.nx, info.nz) + 0.3]); await hide(); await p.waitForTimeout(800);
  await p.evaluate(() => window.__game.nightfall()); await hide(); await p.waitForTimeout(2500); await p.evaluate(() => { const s = window.__game.sim; if (s) { s.player.hp = 100; } }); await shot(4);
  const q = await p.evaluate(() => window.__game.quality()); await ctx.close(); return { q, errs };
}
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const url = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const name of WHICH === 'both' ? ['desktop', 'phone'] : [WHICH]) {
    const size = SIZES[name], lo = await shoot(b, url, size, 'low'), hi = await shoot(b, url, size, 'high');
    console.log(name + ': low ' + JSON.stringify({ px: lo.q.pixelRatio, tex: lo.q.wallTex, shadow: lo.q.shadow }) + ' | high ' + JSON.stringify({ px: hi.q.pixelRatio, tex: hi.q.wallTex, shadow: hi.q.shadow, files: hi.q.hi.ok + '/' + hi.q.hi.asked }) + ' | ' + ([...lo.errs, ...hi.errs].join(' | ') || 'NO ERRORS'));
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
tmp, out, name, views = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split('|')
def lab(d, x, y, t): d.rectangle([x, y, x + 9 * len(t) + 16, y + 24], fill=(0, 0, 0)); d.text((x + 8, y + 6), t, fill=(255, 255, 255))
W = 1100 if name == 'desktop' else 1000; rows = []
for i, v in enumerate(views):
    a = Image.open('%s/low_%d.png' % (tmp, i)).convert('RGB'); b = Image.open('%s/high_%d.png' % (tmp, i)).convert('RGB'); h = round(a.height * W / a.width)
    r = Image.new('RGB', (2 * W + 12, h + 30), (24, 24, 24)); r.paste(a.resize((W, h), Image.LANCZOS), (0, 30)); r.paste(b.resize((W, h), Image.LANCZOS), (W + 12, 30)); d = ImageDraw.Draw(r)
    lab(d, 0, 3, v + ' - LOW (phone set)'); lab(d, W + 12, 3, v + ' - HIGH (desktop and laptop)'); rows.append(r)
o = Image.new('RGB', (rows[0].width, sum(r.height for r in rows) + 8 * len(rows)), (24, 24, 24)); y = 0
for r in rows: o.paste(r, (0, y)); y += r.height + 8
o.save('%s_%s.png' % (out, name), optimize=True)
cw, ch = 560, 300; rows = []
for i, v in enumerate(views):
    a = Image.open('%s/low_%d.png' % (tmp, i)).convert('RGB'); b = Image.open('%s/high_%d.png' % (tmp, i)).convert('RGB'); box = ((a.width - cw) // 2, (a.height - ch) // 2, (a.width + cw) // 2, (a.height + ch) // 2)
    r = Image.new('RGB', (2 * cw + 12, ch + 30), (24, 24, 24)); r.paste(a.crop(box), (0, 30)); r.paste(b.crop(box), (cw + 12, 30)); d = ImageDraw.Draw(r); lab(d, 0, 3, v + ' - LOW, 1:1'); lab(d, cw + 12, 3, v + ' - HIGH, 1:1'); rows.append(r)
o = Image.new('RGB', (rows[0].width, sum(r.height for r in rows) + 8 * len(rows)), (24, 24, 24)); y = 0
for r in rows: o.paste(r, (0, y)); y += r.height + 8
o.save('%s_closeups_%s.png' % (out, name), optimize=True)
for i in range(len(views)):
    import shutil; shutil.copy('%s/low_%d.png' % (tmp, i), '%s/%s_low_%d.png' % (tmp, name, i)); shutil.copy('%s/high_%d.png' % (tmp, i), '%s/%s_high_%d.png' % (tmp, name, i))
`, TMP, OUT, name, VIEWS.join('|')]);
    console.log('wrote ' + OUT + '_' + name + '.png and ' + OUT + '_closeups_' + name + '.png');
  }
  await b.close(); srv.close();
})();
