#!/usr/bin/env bash
# Run one command on a GitHub runner (4-core, free) and bring its outputs back here. Workflow: .github/workflows/task.yml.
# Usage:
#   tools/ci_task.sh <name> <timeout min> "<cmd>" "<out globs>" [--no-sync]
#       name: short id (letters, digits, . _ -); cmd: shell line run from the repo root after npm ci, node build.mjs and the
#       Playwright install (dist/ is built; the page is $PWD/dist/index.html or index_single.html); out: comma list of paths or globs to keep
#       (** allowed). --no-sync: run on what is already pushed to main instead of syncing the working tree first.
#   tools/ci_task.sh --wait <run id> <name>     re-attach to a task run (after a time-out of this script or a restart)
# Example: tools/ci_task.sh splash 15 'mkdir -p shots && node tools/splashshot.cjs "$PWD/dist/index.html" shots/s_ readyP' 'shots/*'
# Waits in the foreground, a progress line every 60 s, for at most MAXWAIT seconds (default 540, under the 9-minute command rule); if the run is
# still going it prints the --wait line to re-attach with and exits 3. When done: the outputs, the command's log (last 2,000 lines) and files.txt
# are copied from branch ci-out (out/<name>/<run id>/) into /home/claude/solard-g/ci_out/<name>/<run id>/. Exit = the command's exit code
# (0 = ok; 1 if the run failed before the command; 3 still running).
# Concurrent callers each get their own run: sync + push + dispatch + finding the run id happen under the lock that tools/ci_run.sh uses.
set -euo pipefail
REPO=heavenfort77-cpu/dawnpunk
DST=${DST:-/home/claude/dawnpunk}
DIR=$(cd "$(dirname "$0")" && pwd)
LOCAL=${CI_OUT_DIR:-/home/claude/solard-g/ci_out}
MAXWAIT=${MAXWAIT:-540}

if [ "${1:-}" = "--wait" ]; then
  RID=${2:?usage: tools/ci_task.sh --wait <run id> <name>}; NAME=${3:?usage: tools/ci_task.sh --wait <run id> <name>}
else
  NAME=${1:?usage: tools/ci_task.sh <name> <timeout min> "<cmd>" "<out globs>" [--no-sync]}
  TMIN=${2:?timeout in minutes}
  CMD=${3:?command line}
  OUT=${4:-}
  SYNC=1; [ "${5:-}" = "--no-sync" ] && SYNC=
  [[ "$NAME" =~ ^[A-Za-z0-9._-]{1,60}$ ]] || { echo "name: letters, digits, . _ - only"; exit 2; }
  [[ "$TMIN" =~ ^[0-9]{1,3}$ ]] || { echo "timeout: whole minutes"; exit 2; }
  exec 9>"$DST/.git/ci_run.lock"
  flock -w 900 9 || { echo "could not get the CI lock in 15 minutes"; exit 1; }
  [ -n "$SYNC" ] && CI_LOCK_HELD=1 bash "$DIR/ci_sync.sh" "Sync for task $NAME $(date -u +%Y-%m-%dT%H:%MZ)" >/dev/null
  BEFORE=$(gh api "repos/$REPO/actions/workflows/task.yml/runs?per_page=30" --jq '[.workflow_runs[].id] | map(tostring) | join(",")')
  gh api "repos/$REPO/actions/workflows/task.yml/dispatches" -f ref=main -f "inputs[name]=$NAME" -f "inputs[cmd]=$CMD" -f "inputs[out]=$OUT" -f "inputs[timeout]=$TMIN"
  RID=
  for _ in $(seq 1 30); do
    sleep 5
    RID=$(gh api "repos/$REPO/actions/workflows/task.yml/runs?per_page=10" \
      --jq "[.workflow_runs[] | select((.id | tostring) as \$i | (\"$BEFORE\" | split(\",\") | index(\$i)) | not)] | sort_by(.created_at) | last | .id // empty")
    [ -n "$RID" ] && break
  done
  flock -u 9; exec 9>&-
  [ -n "$RID" ] || { echo "the task run did not appear"; exit 1; }
fi
echo "task $NAME, run $RID: https://github.com/$REPO/actions/runs/$RID"

T0=$(date +%s)
while :; do
  ST=$(gh api "repos/$REPO/actions/runs/$RID" --jq '.status + " " + (.conclusion // "")' 2>/dev/null || echo "unknown")
  STEP=$(gh api "repos/$REPO/actions/runs/$RID/jobs" --jq '[.jobs[0].steps[]? | select(.status == "in_progress") | .name][0] // ""' 2>/dev/null || true)
  echo "$(date +%H:%M:%S) $(( $(date +%s) - T0 )) s: $ST${STEP:+ | step: $STEP}"
  case "$ST" in completed*) break;; esac
  if [ $(( $(date +%s) - T0 + 60 )) -gt "$MAXWAIT" ]; then echo "still running; re-attach with: tools/ci_task.sh --wait $RID $NAME"; exit 3; fi
  sleep 60
done

# fetch only this task's folder from ci-out (a partial, shallow fetch into a small cache repo; the game repo copy is not touched)
CACHE="$DST/.git/ci-out-cache"
if [ ! -d "$CACHE" ]; then git init -q --bare "$CACHE"; git -C "$CACHE" remote add origin "https://github.com/$REPO"; git -C "$CACHE" config remote.origin.promisor true; git -C "$CACHE" config remote.origin.partialclonefilter blob:none; fi
git -C "$CACHE" fetch -q --depth 1 --filter=blob:none origin "+refs/heads/ci-out:refs/heads/ci-out" || { echo "could not fetch branch ci-out (did the commit step run? see the run page)"; exit 1; }
DEST="$LOCAL/$NAME/$RID"; rm -rf "$DEST"; mkdir -p "$LOCAL/$NAME"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
if git -C "$CACHE" archive ci-out "out/$NAME/$RID" 2>/dev/null | tar -x -C "$TMP" 2>/dev/null && [ -d "$TMP/out/$NAME/$RID" ]; then
  mv "$TMP/out/$NAME/$RID" "$DEST"
else
  echo "no out/$NAME/$RID on branch ci-out (the run may have failed before its commit step)"; exit 1
fi
echo "--- log (last 40 lines of $DEST/task.log)"; tail -n 40 "$DEST/task.log"
echo "--- files ($DEST)"; (cd "$DEST" && find . -type f ! -name task.log ! -name files.txt | sed 's|^\./||' | sort | sed "s|^|$DEST/|")
RC=$(grep -oE '^exit code [0-9]+' "$DEST/task.log" | tail -1 | grep -oE '[0-9]+$' || echo 1)
exit "$RC"
