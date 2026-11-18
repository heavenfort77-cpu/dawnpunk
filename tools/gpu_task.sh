#!/usr/bin/env bash
# Real-GPU frame rates (Nov 19): start .github/workflows/perfgpu.yml (tools/perfcheck.cjs with GPU=1 on a macOS runner), wait, print its measurement lines.
# Usage: [BRK=1] tools/gpu_task.sh <ref> <tiers> [spots] [tag]       ref: commit to build (main = what tools/ci_sync.sh last pushed); tiers: e.g. medium or high,low
#        tools/gpu_task.sh --wait <run id>                     re-attach to a run
# Syncs nothing itself: run tools/ci_sync.sh first when the working tree changed. Waits at most MAXWAIT seconds (default 540), then prints the --wait line (exit 3).
set -euo pipefail
REPO=heavenfort77-cpu/dawnpunk; MAXWAIT=${MAXWAIT:-540}
if [ "${1:-}" = "--wait" ]; then RID=$2; else
  REF=${1:?ref}; TIERS=${2:?tiers}; SPOTS=${3:-hub,street,house,boss}; TAG=${4:-}
  BEFORE=$(gh api "repos/$REPO/actions/workflows/perfgpu.yml/runs?per_page=30" --jq '[.workflow_runs[].id] | map(tostring) | join(",")' 2>/dev/null || true)
  for t in 1 2 3 4 5 6; do gh api -X POST "repos/$REPO/actions/workflows/perfgpu.yml/dispatches" -f ref=main -f "inputs[ref]=$REF" -f "inputs[tiers]=$TIERS" -f "inputs[spots]=$SPOTS" -f "inputs[tag]=$TAG" -f "inputs[brk]=${BRK:-}" && break; [ "$t" = 6 ] && { echo "dispatch failed"; exit 1; }; sleep 10; done
  RID=; for _ in $(seq 1 30); do sleep 5; RID=$(gh api "repos/$REPO/actions/workflows/perfgpu.yml/runs?per_page=10" --jq "[.workflow_runs[] | select((.id | tostring) as \$i | (\"$BEFORE\" | split(\",\") | index(\$i)) | not)] | sort_by(.created_at) | last | .id // empty"); [ -n "$RID" ] && break; done
  [ -n "$RID" ] || { echo "run did not appear"; exit 1; }
fi
echo "perfgpu run $RID: https://github.com/$REPO/actions/runs/$RID"
T0=$(date +%s)
while :; do ST=$(gh api "repos/$REPO/actions/runs/$RID" --jq '.status + " " + (.conclusion // "")'); case "$ST" in completed*) break;; esac
  if [ $(( $(date +%s) - T0 + 30 )) -gt "$MAXWAIT" ]; then echo "still running ($ST); re-attach with: tools/gpu_task.sh --wait $RID"; exit 3; fi; sleep 30; done
echo "$ST"; JID=$(gh api "repos/$REPO/actions/runs/$RID/jobs" --jq '.jobs[0].id')
mkdir -p /home/claude/solard-g/ci_out/perfgpu; gh api "repos/$REPO/actions/jobs/$JID/logs" | sed -E 's/^[0-9T:.-]+Z //' | grep -E "RENDERER|^PERF|^FPS|^PASS|^FAIL|^INFO|^BREAK|^  " | tee "/home/claude/solard-g/ci_out/perfgpu/$RID.txt"
