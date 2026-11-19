#!/usr/bin/env bash
# Proof for every status report to the owner (rule 22): run this first, and quote only what it prints.
# Prints the latest lag-log lines, the last commits pushed and the latest GitHub runs with their results.
cd /home/claude/solard-g || exit 1
echo "== lag log (last 12 timed lines)"
grep -nE '^- [0-9]{2}:[0-9]{2}' docs/lag_fix_log.md | tail -12 | cut -c1-260
echo "== commits pushed"
git -C /home/claude/dawnpunk log --oneline -5
echo "== runs"
gh api 'repos/heavenfort77-cpu/dawnpunk/actions/runs?per_page=8' --jq '.workflow_runs[]|"\(.id) \(.name) \(.head_sha[0:7]) \(.status) \(.conclusion) \(.created_at[11:16])Z"'
