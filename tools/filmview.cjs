// Film as the player sees it (owner Nov 22 18:06, on the film's frame-time gate: "check the way it should be in game. i want no black screen, no long delay and
// no bright screen if someone skip it"). Used by tools/perfcheck.cjs around the film (Mac, real GPU). The opening is a video file now, so the page itself draws
// nothing while it plays and its frame rate is the runner's idle pacing; what the player sees is judged instead:
//  - the screen itself, frame by frame (the browser's own screencast, 160x90): no black screen (a run of near-black screens over BLACK_MS while the film's own
//    picture at that moment is not dark), no bright flash after Skip (a screen brighter than both the film's last picture and the settled base by FLASH)
//  - delays: the film's first picture after the click, the base on screen after Skip
//  - the video itself: pictures presented a second, the longest wait between two, frames dropped
// setup(p) before the click; finish(p, browser, tier) after Skip; returns [label, ok] lines and an INFO object.
const BLACK = 6, BLACK_MS = 100, FLASH = 30, START_MS = 1000, SKIP_MS = 1500, FPS_MIN = 28, GAP_MS = 100, DROP_MAX = 0.02;
const lumOf = (d) => { let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
async function setup(p) {
  const cdp = await p.context().newCDPSession(p), shots = [];
  cdp.on('Page.screencastFrame', (f) => { shots.push([Math.round(f.metadata.timestamp * 1000), f.data]); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 160, maxHeight: 90, everyNthFrame: 1 });
  await p.evaluate(() => { const F = window.__fv = { click: null, skip: null, baseAt: null, frames: [], q: null };
    const mark = () => { if (F.click === null) F.click = Date.now(); }; document.addEventListener('pointerdown', mark, true); document.addEventListener('click', mark, true);
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 9; const cx = cv.getContext('2d', { willReadFrequently: true });
    const hook = (v) => { if (v.__fv || !v.requestVideoFrameCallback) return; v.__fv = 1; const cb = (now, md) => { let lum = null; try { cx.drawImage(v, 0, 0, 16, 9); const d = cx.getImageData(0, 0, 16, 9).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; lum = s / (d.length / 4); } catch (e) { /* none */ }
      // the film's own designed darkness at this moment: the eyelids (cineLidT closed when not moved away) and the black fade (cineFade opacity)
      let des = 0; try { const lt = document.getElementById('cineLidT'), fd = document.getElementById('cineFade'); if (lt) { const m = /translateY\((-?[\d.]+)%\)/.exec(lt.style.transform || ''); if (m) des = Math.max(des, 1 - Math.min(1, Math.abs(+m[1]) / 115)); } if (fd) des = Math.max(des, +getComputedStyle(fd).opacity || 0); } catch (e) { /* none */ }
      F.frames.push([Date.now(), md.mediaTime, md.presentedFrames, lum, des]); if (v.isConnected) v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb); };
    const look = () => { for (const v of document.querySelectorAll('video')) hook(v); }; look(); new MutationObserver(look).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('click', (e) => { if (e.target && e.target.id === 'cineSkip' && F.skip === null) { F.skip = Date.now(); const v = document.querySelector('#cine video'); if (v && v.getVideoPlaybackQuality) { const q = v.getVideoPlaybackQuality(); F.q = [q.totalVideoFrames, q.droppedVideoFrames]; }
      const w = () => { const g = window.__game, cine = document.getElementById('cine'), cs = cine && getComputedStyle(cine), off = !cine || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05; F.dbg = { card: g && g.cardOn(), cine: cs ? [cs.display, cs.visibility, cs.opacity] : null, t: Date.now() - F.skip };
        if (g && !g.cardOn() && off) { F.baseAt = Date.now(); return; } if (Date.now() - F.skip < 10000) requestAnimationFrame(w); }; requestAnimationFrame(w); } }, true); });
  return { cdp, shots };
}
async function finish(p, browser, tier, S) {
  await p.waitForTimeout(3000); try { await S.cdp.send('Page.stopScreencast'); } catch (e) { /* none */ }
  const F = await p.evaluate(() => window.__fv), out = [], T = tier + ' film (as the player sees it): ';
  if (!F || !F.frames.length) return { lines: [], info: { video: false, shots: S.shots.length } };
  // the screen pictures' brightness, decoded in a blank page
  const dp = await browser.newPage(); const lum = [];
  for (let i = 0; i < S.shots.length; i += 40) { const part = S.shots.slice(i, i + 40); lum.push(...await dp.evaluate(async (L) => { const c = document.createElement('canvas'); c.width = 160; c.height = 90; const x = c.getContext('2d'); const r = [];
    for (const b of L) { const im = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b)).blob()); x.drawImage(im, 0, 0, 160, 90); const d = x.getImageData(0, 0, 160, 90).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; r.push(s / (d.length / 4)); } return r; }, part.map((q) => q[1]))); }
  await dp.close(); const scr = S.shots.map((q, k) => [q[0], lum[k]]).sort((a, b) => a[0] - b[0]);
  const fr = F.frames, first = fr[0][0], endT = (F.baseAt || F.skip || fr[fr.length - 1][0]) + 2000;
  // 1 the film's first picture after the click
  const d0 = F.click !== null ? first - F.click : null; out.push([T + 'the film\'s first picture ' + d0 + ' ms after the click (target <= ' + START_MS + ')', d0 !== null && d0 <= START_MS]);
  // 2 the video: pictures a second, longest wait, dropped
  const until = F.skip || fr[fr.length - 1][0], seen = fr.filter((q) => q[0] <= until); let gap = 0, gapAt = 0; for (let k = 1; k < seen.length; k++) { const g = seen[k][0] - seen[k - 1][0]; if (g > gap) { gap = g; gapAt = (seen[k][0] - first) / 1000; } }
  const rate = seen.length > 1 ? (seen.length - 1) / ((seen[seen.length - 1][0] - seen[0][0]) / 1000) : 0; out.push([T + 'the video shows ' + rate.toFixed(1) + ' pictures a second (target >= ' + FPS_MIN + ', the file has 30)', rate >= FPS_MIN]);
  out.push([T + 'longest wait between two video pictures ' + gap + ' ms at ' + gapAt.toFixed(1) + ' s (target <= ' + GAP_MS + ')', gap <= GAP_MS]);
  if (F.q) { const dr = F.q[1] / Math.max(1, F.q[0]); out.push([T + F.q[1] + ' of ' + F.q[0] + ' video frames dropped (' + (100 * dr).toFixed(1) + ' %, target <= ' + 100 * DROP_MAX + ' %)', dr <= DROP_MAX]); }
  // 3 black screens: near-black screen pictures (from the click to 2 s after the base) while the film's own picture at that moment was not dark
  const filmLumAt = (t) => { let best = null; for (const q of fr) { if (q[0] > t) break; best = q; } return best && best[0] > (F.skip || Infinity) ? null : best; };
  let run = 0, runAt = 0, worst = 0, worstAt = 0; for (let k = 0; k < scr.length; k++) { const [t, l] = scr[k]; if (F.click === null || t < F.click || t > endT) continue; const dur = (k + 1 < scr.length ? scr[k + 1][0] : endT) - t;
    const f = filmLumAt(t), excused = f && (!F.skip || t < F.skip) && ((f[3] !== null && f[3] < BLACK * 2) || f[4] >= 0.85); if (l < BLACK && !excused) { if (!run) runAt = t; run += dur; if (run > worst) { worst = run; worstAt = runAt; } } else run = 0; }
  out.push([T + 'longest black screen ' + Math.round(worst) + ' ms' + (worst ? ' at ' + ((worstAt - F.click) / 1000).toFixed(2) + ' s after the click' : '') + ' (target <= ' + BLACK_MS + '; the film\'s own dark pictures, closed eyelids and black fades do not count)', worst <= BLACK_MS]);
  if (F.skip) {
    // 4 Skip: the base on screen soon, and no picture brighter than both the film's last picture and the settled base
    const ds = F.baseAt ? F.baseAt - F.skip : null; out.push([T + 'the base on screen ' + ds + ' ms after Skip (target <= ' + SKIP_MS + ')', ds !== null && ds <= SKIP_MS]);
    const lastFilm = fr.filter((q) => q[0] <= F.skip && q[3] !== null).slice(-1)[0], settled = scr.filter((q) => q[0] > endT - 700 && q[0] <= endT).map((q) => q[1]), base = settled.length ? settled.sort((a, b) => a - b)[settled.length >> 1] : null;
    const ref = Math.max(lastFilm ? lastFilm[3] : 0, base === null ? 0 : base), after = scr.filter((q) => q[0] >= F.skip && q[0] <= endT); let hi = 0, hiAt = 0; for (const [t, l] of after) if (l > hi) { hi = l; hiAt = t; }
    out.push([T + 'brightest screen after Skip ' + hi.toFixed(0) + ' at ' + ((hiAt - F.skip) / 1000).toFixed(2) + ' s (film\'s last picture ' + (lastFilm ? lastFilm[3].toFixed(0) : '-') + ', settled base ' + (base === null ? '-' : base.toFixed(0)) + '; target <= ' + (ref + FLASH).toFixed(0) + ', no flash)', hi <= ref + FLASH]);
  }
  return { lines: out, info: { video: true, shots: scr.length, filmPictures: fr.length, click: F.click, first: first - (F.click || first), skip: F.skip && F.skip - (F.click || 0), baseAt: F.baseAt && F.baseAt - (F.skip || 0), dbg: F.dbg } };
}
module.exports = { setup, finish };
