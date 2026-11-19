#!/usr/bin/env bash
# Measured step times for any time estimate to the owner (rule: estimates only from measured step times). Run it first; quote only what it prints.
# Prints the real duration of the last runs per workflow (Mac perfgpu, Linux checks that completed, task runs, release), from the GitHub API.
REPO=heavenfort77-cpu/dawnpunk
for wf in perfgpu.yml checks.yml task.yml release.yml; do
  echo "== $wf (last completed, not cancelled)"
  gh api "repos/$REPO/actions/workflows/$wf/runs?per_page=30" --jq '.workflow_runs[] | select(.status=="completed" and .conclusion!="cancelled") | "\(.id) \(.conclusion) \(((.updated_at|fromdate)-(.run_started_at|fromdate))/60|floor) min  \(.display_title[0:60])"' | head -5
done
echo "== running now"
gh api "repos/$REPO/actions/runs?status=in_progress&per_page=10" --jq '.workflow_runs[] | "\(.id) \(.name) running \(((now)-(.run_started_at|fromdate))/60|floor) min"'
