// Diagnoses the lost page in the night stage: same random events as fuzz.cjs, night stage only, with crash, close and disconnect reported, and resize events optional.
const { chromium } = require('playwright');
(async () => {
  const N = +process.argv[2] || 70, RESIZE = process.argv[3] !== 'noresize', w = 844, h = 390;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  b.on('disconnected', () => console.log('EVENT browser disconnected'));
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  p.on('crash', () => console.log('EVENT page crashed'));
  p.on('close', () => console.log('EVENT page closed'));
  p.on('pageerror', (e) => console.log('EVENT page error ' + String(e).slice(0, 200)));
  await p.goto('file://' + __dirname + '/../dist/index.html');
  await p.waitForFunction(() => window.__game && window.__game.startRun);
  let q = 12345 + w;
  const r = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296);
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ', 'KeyE', 'KeyL', 'KeyN', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyP', 'Escape', 'Enter', 'Tab', 'KeyM'];
  await p.evaluate(() => { const g = window.__game; g.enterBase(); document.getElementById('selRing').value = '1'; g.startRun(0); g.enterHouse(0); g.nightfall(); });
  await p.waitForTimeout(900);
  let last = '';
  try {
    for (let i = 0; i < N; i++) {
      const a = r(), x = Math.floor(r() * w), y = Math.floor(r() * h);
      if (a < 0.3) { last = 'tap ' + x + ',' + y; await p.touchscreen.tap(x, y); }
      else if (a < 0.5) { last = 'drag'; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(Math.floor(r() * w), Math.floor(r() * h), { steps: 3 }); if (r() < 0.8) await p.mouse.up(); }
      else if (a < 0.8) { const k = keys[Math.floor(r() * keys.length)]; last = 'key ' + k; if (r() < 0.5) await p.keyboard.press(k); else { await p.keyboard.down(k); if (r() < 0.7) await p.keyboard.up(k); } }
      else if (a < 0.86) { last = 'blur'; await p.evaluate(() => { window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange')); }); }
      else if (a < 0.92) { const W = 300 + Math.floor(r() * 1400), H = 200 + Math.floor(r() * 700); last = 'resize ' + W + 'x' + H; if (RESIZE) await p.setViewportSize({ width: W, height: H }); }
      else { last = 'wait'; await p.waitForTimeout(60); }
      if (i % 10 === 9) console.log('step ' + (i + 1) + ' ok, last ' + last);
    }
    console.log('PASS night stage, ' + N + ' events, resize ' + RESIZE);
  } catch (e) { console.log('FAIL after "' + last + '": ' + String(e).slice(0, 160)); }
  await b.close().catch(() => {});
  console.log('done');
})();
