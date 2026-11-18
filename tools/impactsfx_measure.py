# Measures the rendered impact sounds (tools/impactsfx_render.cjs output) against Marla's voice clips (at her game gain 0.9) and the music (at CONFIG.music.volume 0.35).
# Usage: python3 tools/impactsfx_measure.py <out dir>   (needs numpy, scipy, ffmpeg); prints the tables and writes <out dir>/measure.json
import sys, json, glob, os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
D = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else 'impact_out'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
import subprocess
os.makedirs(D + '/marla', exist_ok=True); os.makedirs(D + '/music', exist_ok=True)
for f in ['day_another_awake', 'day_leave_it', 'drill_eat_again', 'inbound_2_behind', 'hint_h_2', 'low_2']: subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', ROOT + '/art/voice/mp3/' + f + '.mp3', '-ac', '1', '-ar', '44100', D + '/marla/' + f + '.wav'], check=True)
for f in ['ivy_on_the_glass', 'the_green_perimeter', 'where_the_roots_breathe']: subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', ROOT + '/art/music/' + f + '.mp3', '-ar', '44100', D + '/music/' + f + '.wav'], check=True)
SR = 44100
bp = butter(4, [300, 3400], btype='bandpass', fs=SR, output='sos')
hp = butter(4, 250, btype='highpass', fs=SR, output='sos')
def db(x): return 20 * np.log10(max(x, 1e-9))
def load(p, k=1.0):
    sr, x = wavfile.read(p); x = x.astype(np.float64) / 32768.0
    if x.ndim == 1: x = np.stack([x, x], 1)
    return x * k
def win_rms(x, w):
    n = len(x) // w
    if n == 0: return np.array([np.sqrt(np.mean(x ** 2))])
    return np.sqrt(np.mean(x[:n * w].reshape(n, w) ** 2, 1))
def stats(x):
    ch = x[:, 0] if np.abs(x[:, 0]).max() >= np.abs(x[:, 1]).max() else x[:, 1]
    a = np.abs(ch); pk = a.max()
    idx = np.where(a > pk * 10 ** (-40 / 20))[0]; s, e = idx[0], idx[-1] + 1
    seg = ch[s:e]; w = int(0.05 * SR)
    r = win_rms(seg, w); vb = win_rms(sosfilt(bp, seg), w)
    f = np.abs(np.fft.rfft(ch[s:s + int(0.4 * SR)], 1 << 15)) ** 2; fr = np.fft.rfftfreq(1 << 15, 1 / SR); tot = f.sum()
    band = lambda lo, hi: 100 * f[(fr >= lo) & (fr < hi)].sum() / tot
    rr = win_rms(ch[s:], int(0.01 * SR)); ring = (np.where(rr > rr.max() * 10 ** (-30 / 20))[0][-1] + 1) * 0.01
    return dict(peak=db(pk), rms=db(np.sqrt(np.mean(seg ** 2))), max50=db(r.max()), vband50=db(vb.max()), dur=(e - s) / SR, low=band(0, 300), mid=band(300, 3400), hi=band(3400, 22050), hi2k=band(2000, 22050), ring=ring, small50=db(win_rms(sosfilt(hp, seg), w).max()), cent=(f * fr).sum() / tot)
def speech(x):
    ch = x[:, 0]; w = int(0.05 * SR); r = win_rms(ch, w); act = r[r > 10 ** (-40 / 20)]
    vb = win_rms(sosfilt(bp, ch), w); vact = vb[r > 10 ** (-40 / 20)]
    return dict(peak=db(np.abs(ch).max()), rms=db(np.sqrt(np.mean(act ** 2))), med50=db(np.median(act)), max50=db(r.max()), vband_med50=db(np.median(vact)), vband50=db(vb.max()), dur=len(ch) / SR)
rows = {}
for p in sorted(glob.glob(D + '/solo/*.wav')): rows[os.path.basename(p)[:-4]] = stats(load(p))
mar = {}
for p in sorted(glob.glob(D + '/marla/*.wav')): mar[os.path.basename(p)[:-4]] = speech(load(p, 0.9))
print('%-24s %7s %7s %7s %8s %6s %5s %5s %5s %6s %6s %5s' % ('sound', 'peak', 'rms', 'max50', 'vband50', 'ring', 'low%', 'mid%', 'hi%', 'centHz', 'hp250', '>2k%'))
for k, v in rows.items(): print('%-24s %7.1f %7.1f %7.1f %8.1f %6.2f %5.0f %5.0f %5.0f %6.0f %6.1f %5.0f' % (k, v['peak'], v['rms'], v['max50'], v['vband50'], v['ring'], v['low'], v['mid'], v['hi'], v['cent'], v['small50'], v['hi2k']))
print('%-24s %7s %7s %7s %7s %8s %8s' % ('marla x0.9', 'peak', 'rms', 'med50', 'max50', 'vbmed50', 'vband50'))
for k, v in mar.items(): print('%-24s %7.1f %7.1f %7.1f %7.1f %8.1f %8.1f' % (k, v['peak'], v['rms'], v['med50'], v['max50'], v['vband_med50'], v['vband50']))

mus = {}
for p in sorted(glob.glob(D + '/music/*.wav')):
    x = load(p, 0.35); c = x[:, 0]; w = int(0.05 * SR); r = 20 * np.log10(win_rms(c, w) + 1e-9); v = 20 * np.log10(win_rms(sosfilt(bp, c), w) + 1e-9); h = 20 * np.log10(win_rms(sosfilt(hp, c), w) + 1e-9)
    f = np.abs(np.fft.rfft(c[:SR * 60])) ** 2; fr = np.fft.rfftfreq(SR * 60, 1 / SR)
    print('music x0.35 %-24s peak %.1f  50ms p50 %.1f p95 %.1f max %.1f | vband p50 %.1f p95 %.1f | hp250 p50 %.1f p95 %.1f | >2k %.0f%% low<300 %.0f%%' % (os.path.basename(p)[:-4], db(np.abs(x).max()), np.median(r), np.percentile(r, 95), r.max(), np.median(v), np.percentile(v, 95), np.median(h), np.percentile(h, 95), 100 * f[fr >= 2000].sum() / f.sum(), 100 * f[fr < 300].sum() / f.sum()))
    mus[os.path.basename(p)[:-4]] = dict(peak=db(np.abs(x).max()), p50=float(np.median(r)), p95=float(np.percentile(r, 95)), max50=float(r.max()), vb50=float(np.median(v)), vb95=float(np.percentile(v, 95)), hp50=float(np.median(h)), hp95=float(np.percentile(h, 95)), hi2k=float(100 * f[fr >= 2000].sum() / f.sum()), low=float(100 * f[fr < 300].sum() / f.sum()))
json.dump({'solo': rows, 'marla': mar, 'music': mus}, open(D + '/measure.json', 'w'), indent=1, default=float)
