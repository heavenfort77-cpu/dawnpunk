#!/usr/bin/env bash
# Film encode (owner Nov 22, video opening): joins the parts rendered by tools/filmrender.cjs (seg_<s>.mp4, near-lossless, 1920x1080, 30 fps) and makes the
# three files the game plays (CONFIG.opening.video): art/film/opening_hi_av1.mp4 (medium tier where the browser plays AV1: desktop, laptop),
# art/film/opening_hi.mp4 (medium tier, H.264, where AV1 does not play) and art/film/opening_lo.mp4 (low tier: phone, H.264).
# Settings measured Nov 22 on the 1080p render (size, PSNR vs the render): AV1 1280 crf 38 10.2 MB 40.2 dB; H.264 1280 crf 28 12.9 MB 38.0 dB;
# H.264 854 crf 29 5.0 MB 36.9 dB (H.264 1280 crf 22 was 100 MB: the dawn shot's moving foliage). +faststart (plays while it downloads), no sound track.
# Usage: tools/filmencode.sh <dir with seg_*.mp4>   prints each file's size and its PSNR against the joined parts
set -euo pipefail
D=${1:?dir}
T=$(mktemp -d); ls "$D"/seg_*.mp4 | sort | sed "s/^/file '/;s/$/'/" > "$T/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$T/list.txt" -c copy "$T/joined.mp4"
mkdir -p art/film
enc() { ffmpeg -v error -y -i "$T/joined.mp4" -vf "scale=$1:-2:flags=lanczos" -c:v libx264 -preset slow -crf "$2" -profile:v high -level 4.0 -pix_fmt yuv420p -an -movflags +faststart "$3"; }
ffmpeg -v error -y -i "$T/joined.mp4" -vf "scale=1280:-2:flags=lanczos" -c:v libsvtav1 -preset 6 -crf 38 -pix_fmt yuv420p -an -movflags +faststart art/film/opening_hi_av1.mp4
enc 1280 28 art/film/opening_hi.mp4
enc 854 29 art/film/opening_lo.mp4
for f in art/film/opening_hi_av1.mp4 art/film/opening_hi.mp4 art/film/opening_lo.mp4; do
  W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,nb_frames,duration -of csv=p=0 "$f")
  P=$(ffmpeg -i "$f" -i "$T/joined.mp4" -lavfi "[1:v][0:v]scale2ref=flags=lanczos[ref][d];[d][ref]psnr" -f null - 2>&1 | grep -o "average:[0-9.inf]*" | tail -1)
  echo "FILMENCODE $f $(du -k "$f" | cut -f1) KB, $W (w,h,frames,s), PSNR vs the render $P"
done
rm -rf "$T"
