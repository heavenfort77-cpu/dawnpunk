// Makes the HUD2 pictures once (2026-11-16): device pictures -> src/deviceicons.js, the title machines -> src/titleart.js.
// Usage: node tools/hud2art.cjs [icons|title|both] (default both). One headless browser, software renderer. Numbers: CONFIG.hud2.art.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const esbuild = require('esbuild');
(async () => {
  const what = process.argv[2] || 'both', root = path.join(__dirname, '..'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hud2art-'));
  const r = await esbuild.build({ entryPoints: [path.join(__dirname, 'hud2art_entry.js')], bundle: true, format: 'iife', write: false, target: 'es2019', absWorkingDir: root, nodePaths: [path.join(root, 'node_modules')] });
  fs.writeFileSync(path.join(tmp, 'art.html'), '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><script>' + r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }), p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + path.join(tmp, 'art.html') + '?quality=high'); await p.waitForFunction(() => window.__art, null, { timeout: 60000 });
  if (what !== 'title') { const ic = await p.evaluate(() => window.__art.icons()); let kb = 0; for (const k in ic) kb += ic[k].length;
    fs.writeFileSync(path.join(root, 'src/deviceicons.js'), '// Device pictures for the HUD slots and phone buttons: each device drawn once by its own builder (desktop tier), made by tools/hud2art.cjs (CONFIG.hud2.art). Do not edit by hand.\nexport const DEVICE_ICONS = ' + JSON.stringify(ic) + ';\n');
    for (const k in ic) fs.writeFileSync(path.join(tmp, 'icon_' + k + '.webp'), Buffer.from(ic[k].split(',')[1], 'base64'));
    console.log('icons', Object.keys(ic).length, (kb / 1024).toFixed(0) + ' KB', tmp); }
  if (what !== 'icons') { const t = await p.evaluate(() => window.__art.titleBand());
    fs.writeFileSync(path.join(root, 'src/titleart.js'), '// The title screen machines: the seven Gloom kinds, dormant, drawn once as dark shapes with lit "power saver" screens by tools/hud2art.cjs (CONFIG.hud2.art). Do not edit by hand.\nexport const TITLE_GLOOM = ' + JSON.stringify(t) + ';\n');
    fs.writeFileSync(path.join(tmp, 'title_band.png'), Buffer.from(t.img.split(',')[1], 'base64')); console.log('title band', t.w + 'x' + t.h, (t.img.length / 1024).toFixed(0) + ' KB', 'crop', t.crop.join(','), tmp); }
  console.log('screens', JSON.stringify(await p.evaluate(() => window.__scr || []))); console.log(errs.length ? 'PAGE ERRORS ' + errs.slice(0, 3).join(' | ') : 'NO ERRORS'); await b.close();
})();
