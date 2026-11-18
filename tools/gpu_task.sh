#!/usr/bin/env bash
# Real-GPU frame rates (Nov 19): start .github/workflows/perfgpu.yml (tools/perfcheck.cjs with GPU=1 on macOS runners, one job per commit x tier x spot in parallel),
# wait, print every job's measurement lines and a short summary (FPS per job; the owner's rule: on the default tier the night house and boss must not be slower than the hub).
# Usage: [BRK=1] [PROF=1] tools/gpu_task.sh <refs> <tiers> [spots] [tag]   refs: comma list of full commit SHAs or branches (a regression hunt: every commit in between)
#        tools/gpu_task.sh --wait <run id>                                   re-attach to a run
# Syncs nothing itself: run tools/ci_sync.sh first when the working tree changed. Waits at most MAXWAIT seconds (default 540), then prints the --wait line (exit 3).
# Output: ci_out/perfgpu/<run id>.txt (all jobs' lines).
set -euo pipefail
REPO=heavenfort77-cpu/dawnpunk; MAXWAIT=${MAXWAIT:-540}
if [ "${1:-}" = "--wait" ]; then RID=$2; else
  REFS=${1:?refs}; TIERS=${2:?tiers}; SPOTS=${3:-hub,street,house,boss}; TAG=${4:-}
  BEFORE=$(gh api "repos/$REPO/actions/workflows/perfgpu.yml/runs?per_page=30" --jq '[.workflow_runs[].id] | map(tostring) | join(",")' 2>/dev/null || true)
  for t in 1 2 3 4 5 6; do gh api -X POST "repos/$REPO/actions/workflows/perfgpu.yml/dispatches" -f ref=main -f "inputs[refs]=$REFS" -f "inputs[tiers]=$TIERS" -f "inputs[spots]=$SPOTS" -f "inputs[tag]=$TAG" -f "inputs[brk]=${BRK:-}" -f "inputs[prof]=${PROF:-}" && break; [ "$t" = 6 ] && { echo "dispatch failed"; exit 1; }; sleep 10; done
  RID=; for _ in $(seq 1 30); do sleep 5; RID=$(gh api "repos/$REPO/actions/workflows/perfgpu.yml/runs?per_page=10" --jq "[.workflow_runs[] | select((.id | tostring) as \$i | (\"$BEFORE\" | split(\",\") | index(\$i)) | not)] | sort_by(.created_at) | last | .id // empty"); [ -n "$RID" ] && break; done
  [ -n "$RID" ] || { echo "run did not appear"; exit 1; }
fi
echo "perfgpu run $RID: https://github.com/$REPO/actions/runs/$RID"
T0=$(date +%s)
while :; do ST=$(gh api "repos/$REPO/actions/runs/$RID" --jq '.status + " " + (.conclusion // "")'); case "$ST" in completed*) break;; esac
  if [ $(( $(date +%s) - T0 + 30 )) -gt "$MAXWAIT" ]; then echo "still running ($ST); re-attach with: tools/gpu_task.sh --wait $RID"; exit 3; fi; sleep 30; done
echo "$ST"; mkdir -p /home/claude/solard-g/ci_out/perfgpu; OUTF=/home/claude/solard-g/ci_out/perfgpu/$RID.txt; : > "$OUTF"
for JID in $(gh api "repos/$REPO/actions/runs/$RID/jobs?per_page=100" --jq '.jobs[] | select(.name != "plan") | .id'); do
  gh api "repos/$REPO/actions/jobs/$JID/logs" 2>/dev/null | sed -E 's/^[0-9T:.-]+Z //' | grep -E "^JOB|RENDERER|^PERF|^FPS|^PASS|^FAIL|^INFO|^BREAK|^PROFILE|^  |^ BY" >> "$OUTF" || true; done
echo "--- summary"; grep -E "^JOB|^FPS|^PERF" "$OUTF" | sed -E 's/, downloaded.*//' | cut -c1-170
python3 - "$OUTF" <<'PY'
import re,sys
fps={}; ref='?'
for l in open(sys.argv[1]):
    j=re.match(r'JOB ref=(\S+)',l)
    if j: ref=j.group(1)[:8]
    m=re.match(r'FPS (\w+) (\w+): ([\d.]+) fps',l)
    if m: fps[(ref,m.group(1),m.group(2))]=float(m.group(3))
for (r,t) in sorted({k[:2] for k in fps}):
    h=fps.get((r,t,'hub'))
    for sp in ('house','boss','combat','bosscombat'):
        if h and (r,t,sp) in fps: print(('PASS' if fps[(r,t,sp)]>=h else 'FAIL')+f' {r} {t} {sp} {fps[(r,t,sp)]} fps vs hub {h} fps (night must not be slower)')
PY
