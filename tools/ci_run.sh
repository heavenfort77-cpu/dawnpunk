#!/usr/bin/env bash
# Run the Dawnpunk checks on GitHub Actions: sync the working tree to the repo, start the "checks" workflow, wait, print the summary table.
# Usage:
#   tools/ci_run.sh                          every check (group all)
#   tools/ci_run.sh desktop                  one group: all | logic | desktop | phone
#   tools/ci_run.sh all gloomhitcheck_desktop,stairgapcheck
#                                            only these checks (names from ci/checks.json; the group is then ignored)
#   tools/ci_run.sh --wait <run id>          no sync or new run: wait for that run and print its summary (e.g. after a restart)
# Prints the run's link at once, a progress line every 2 minutes, then the table. Exit 0 only when every check that ran is clean.
# Safe for two callers close together: sync + push + dispatch + finding the new run happen under one lock (flock on .git/ci_run.lock in the repo copy),
# so each caller pushes its own sync and gets its own run id. The waiting part runs outside the lock.
# Needs only git and gh (the session proxy authenticates the API); nothing heavy runs on this machine.
set -euo pipefail
REPO=heavenfort77-cpu/dawnpunk
DST=${DST:-/home/claude/dawnpunk}
DIR=$(cd "$(dirname "$0")" && pwd)
if [ "${1:-}" = "--wait" ]; then
  RID=${2:?usage: tools/ci_run.sh --wait <run id>}; GROUP='(existing run)'; ONLY=
else
  GROUP=${1:-all}
  ONLY=${2:-}
  case "$GROUP" in all|logic|desktop|phone) ;; *) echo "group must be all, logic, desktop or phone (see the usage lines at the top of tools/ci_run.sh)"; exit 2;; esac
  exec 9>"$DST/.git/ci_run.lock"
  echo "$(date +%H:%M:%S) waiting for the CI lock (another caller may be syncing)..."
  flock -w 900 9 || { echo "could not get the CI lock in 15 minutes"; exit 1; }
  CI_LOCK_HELD=1 bash "$DIR/ci_sync.sh" "Sync for checks run ($GROUP${ONLY:+, only $ONLY}) $(date -u +%Y-%m-%dT%H:%MZ)" >/dev/null
  # the runs that exist before this dispatch; the new run is the one that is not among them
  BEFORE=$(gh api "repos/$REPO/actions/workflows/checks.yml/runs?event=workflow_dispatch&per_page=30" --jq '[.workflow_runs[].id] | map(tostring) | join(",")')
  gh api "repos/$REPO/actions/workflows/checks.yml/dispatches" -f ref=main -f "inputs[group]=$GROUP" -f "inputs[only]=$ONLY"
  RID=
  for _ in $(seq 1 30); do
    sleep 10
    RID=$(gh api "repos/$REPO/actions/workflows/checks.yml/runs?event=workflow_dispatch&per_page=10" \
      --jq "[.workflow_runs[] | select((.id | tostring) as \$i | (\"$BEFORE\" | split(\",\") | index(\$i)) | not)] | sort_by(.created_at) | last | .id // empty")
    [ -n "$RID" ] && break
  done
  flock -u 9; exec 9>&-
  [ -n "$RID" ] || { echo "run did not appear"; exit 1; }
fi
echo "run $RID: https://github.com/$REPO/actions/runs/$RID  (group $GROUP${ONLY:+, only $ONLY})"

T0=$(date +%s)
while :; do
  ST=$(gh api "repos/$REPO/actions/runs/$RID" --jq '.status + " " + (.conclusion // "")')
  JOBS=$(gh api "repos/$REPO/actions/runs/$RID/jobs?per_page=100" --jq '[.jobs[] | .status] | group_by(.) | map("\(.[0]) \(length)") | join(", ")')
  echo "$(date +%H:%M) $(( ($(date +%s) - T0) / 60 )) min: $ST | jobs: $JOBS"
  case "$ST" in completed*) break;; esac
  sleep 120
done

# minutes the jobs took (sum of job run times, rounded up per job; free on the public repo, kept as a cost readout)
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
