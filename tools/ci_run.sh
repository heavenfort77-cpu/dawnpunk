#!/usr/bin/env bash
# Sync the working tree to GitHub, start the checks workflow, wait for it, print the summary table.
# Usage: tools/ci_run.sh [all|logic|desktop|phone] [only]     (default all; only = comma list of check names from ci/checks.json, overrides the group; polls every 2 minutes; exit 0 only when every check is clean)
# Needs only git and gh (the session proxy authenticates the API); nothing heavy runs on this machine.
set -euo pipefail
GROUP=${1:-all}
ONLY=${2:-}
REPO=heavenfort77-cpu/dawnpunk
DIR=$(cd "$(dirname "$0")" && pwd)
case "$GROUP" in all|logic|desktop|phone) ;; *) echo "group must be all, logic, desktop or phone"; exit 2;; esac

bash "$DIR/ci_sync.sh" "Sync for checks run ($GROUP) $(date -u +%Y-%m-%dT%H:%MZ)" >/dev/null
SINCE=$(date -u -d '-90 sec' +%Y-%m-%dT%H:%M:%SZ)
gh api "repos/$REPO/actions/workflows/checks.yml/dispatches" -f ref=main -f "inputs[group]=$GROUP" -f "inputs[only]=$ONLY"
RID=
for _ in $(seq 1 30); do
  sleep 10
  RID=$(gh api "repos/$REPO/actions/workflows/checks.yml/runs?event=workflow_dispatch&per_page=10" \
    --jq "[.workflow_runs[] | select(.created_at >= \"$SINCE\")] | sort_by(.created_at) | last | .id // empty")
  [ -n "$RID" ] && break
done
[ -n "$RID" ] || { echo "run did not appear"; exit 1; }
echo "run $RID: https://github.com/$REPO/actions/runs/$RID  (group $GROUP${ONLY:+, only $ONLY})"

T0=$(date +%s)
while :; do
  ST=$(gh api "repos/$REPO/actions/runs/$RID" --jq '.status + " " + (.conclusion // "")')
  JOBS=$(gh api "repos/$REPO/actions/runs/$RID/jobs?per_page=100" --jq '[.jobs[] | .status] | group_by(.) | map("\(.[0]) \(length)") | join(", ")')
  echo "$(date +%H:%M) $(( ($(date +%s) - T0) / 60 )) min: $ST | jobs: $JOBS"
  case "$ST" in completed*) break;; esac
  sleep 120
done

# minutes the jobs took (sum of job run times, rounded up per job as GitHub bills private repos)
gh api "repos/$REPO/actions/runs/$RID/jobs?per_page=100" --jq '[.jobs[] | select(.started_at and .completed_at) | ((.completed_at | fromdate) - (.started_at | fromdate))] | "jobs: \(length), job minutes (rounded up each): \(map((. / 60) | ceil) | add)"'
gh api "repos/$REPO/actions/runs/$RID" --jq '"wall time: \((((.updated_at | fromdate) - (.run_started_at | fromdate)) / 60) | floor) min, conclusion: \(.conclusion)"'

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
AID=$(gh api "repos/$REPO/actions/runs/$RID/artifacts?per_page=100" --jq '.artifacts[] | select(.name == "summary") | .id' | head -1)
if [ -n "$AID" ] && gh api "repos/$REPO/actions/artifacts/$AID/zip" > "$TMP/s.zip" 2>/dev/null && unzip -q -o "$TMP/s.zip" -d "$TMP" 2>/dev/null; then
  echo; cat "$TMP/summary.txt"
  grep -q '^ALL .* CHECKS CLEAN' "$TMP/summary.txt"
else
  echo "no summary artifact; the summary job's log:"
  JID=$(gh api "repos/$REPO/actions/runs/$RID/jobs?per_page=100" --jq '.jobs[] | select(.name == "summary") | .id')
  [ -n "$JID" ] && gh api "repos/$REPO/actions/jobs/$JID/logs" | sed -n '/Summary table/,/upload-artifact/p' | cut -c30-
  exit 1
fi
