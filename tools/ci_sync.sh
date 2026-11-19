#!/usr/bin/env bash
# Copies ONLY what the build and the checks need from the working tree into the GitHub repo copy, then commits and pushes.
# Usage: tools/ci_sync.sh ["commit message"]     (SRC / DST / NOPUSH=1 can be set in the environment)
# Managed paths are wiped and copied fresh each time, so deletions in the working tree reach the repo too.
set -euo pipefail
SRC=${SRC:-/home/claude/solard-g}
DST=${DST:-/home/claude/dawnpunk}
MSG=${1:-"Sync from working tree $(date -u +%Y-%m-%dT%H:%MZ)"}
cd "$DST"
# one sync at a time (tools/ci_run.sh holds the same lock around sync + dispatch and sets CI_LOCK_HELD)
if [ -z "${CI_LOCK_HELD:-}" ]; then exec 9>"$DST/.git/ci_run.lock"; flock -w 900 9 || { echo "could not get the CI lock"; exit 1; }; fi

# commit identity: the owner's GitHub noreply address only (public repo)
git config user.name vendatta77
git config user.email heavenfort77-cpu@users.noreply.github.com

# 1. wipe what this script manages (never .git)
rm -rf src tools art ci docs .github licenses build.mjs index.template.html package.json package-lock.json test.js \
  .gitignore README.md LICENSE ASSETS-LICENSE.md

# 2. code: src/ and tools/ without backups, samples, caches or pictures
tar -C "$SRC" -cf - \
  --exclude='*_before_*' --exclude='*_batch*' --exclude='*_backup*' --exclude='*_sample[0-9]*' \
  --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='*.png' --exclude='*.jpg' --exclude='*.jpeg' --exclude='*.gif' --exclude='*.mp4' --exclude='*.webm' --exclude='*.wav' \
  --exclude='*.npz' --exclude='*.blend' --exclude='*.blend1' --exclude='*.log' \
  src tools | tar -xf -

# 3. art the build reads (build.mjs: art/music, art/texhi, art/models_hi, art/models (the light character models, files since the lag fix Nov 19), art/voice/mp3)
tar -C "$SRC" -cf - --exclude='*_before_*' --exclude='*_batch*' --exclude='*_backup*' \
  art/models art/models_hi art/music art/texhi art/voice/mp3 | tar -xf -

# 4. single files: build, tests, and the two text docs test.js reads
mkdir -p docs
for f in build.mjs index.template.html package.json package-lock.json test.js docs/marla_journal.md docs/lore_notes.md; do cp "$SRC/$f" "$f"; done

# 5. CI and repo files (sources kept in the working tree under ci/ and .github/)
mkdir -p ci .github/workflows licenses
cp "$SRC/ci/checks.json" "$SRC/ci/ci.mjs" "$SRC/ci/gpu_preload.cjs" ci/
cp "$SRC"/.github/workflows/*.yml .github/workflows/
cp "$SRC/ci/repo/gitignore" .gitignore
cp "$SRC/ci/repo/README.md" "$SRC/ci/repo/LICENSE" "$SRC/ci/repo/ASSETS-LICENSE.md" .
cp "$SRC"/ci/repo/licenses/* licenses/

# 6. guards: size, big files, secrets, the owner's own address
git add -A
big=$(git ls-files -z | xargs -0 du -b 2>/dev/null | awk '$1 > 95*1024*1024 {print $2}')
[ -z "$big" ] || { echo "ABORT: file over 95 MB: $big"; exit 1; }
total=$(git ls-files -z | xargs -0 du -cb 2>/dev/null | tail -1 | cut -f1)
echo "repo files: $(git ls-files | wc -l), $((total / 1024 / 1024)) MB"
[ "$total" -lt $((120 * 1024 * 1024)) ] || { echo "ABORT: repo over 120 MB"; exit 1; }
if git grep -I -n -E 'github_pat_|gh[pousr]_[A-Za-z0-9]{30,}|@gmail|/root/\.config|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}' -- . ':!tools/ci_sync.sh' >/dev/null; then
  echo "ABORT: secret-like text found:"; git grep -I -n -E 'github_pat_|gh[pousr]_[A-Za-z0-9]{30,}|@gmail|/root/\.config|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}' -- . ':!tools/ci_sync.sh' | cut -c1-160; exit 1
fi

# 7. commit and push (nothing to commit = nothing pushed)
if git diff --cached --quiet; then echo "no changes"; else
  git commit -q -F - <<EOF
$MSG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015w2gCDznStxNTccUCge5DW
EOF
  echo "committed $(git rev-parse --short HEAD)"
fi
[ -n "${NOPUSH:-}" ] || git -c push.negotiate=true push -q -u origin main
git rev-parse HEAD
