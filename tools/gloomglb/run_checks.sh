#!/bin/bash
# Runs the checks one at a time, each only when no other headless browser runs (this machine has 2 CPUs and little memory). Run from the project folder.
# Usage: bash tools/gloomglb/run_checks.sh [check ...]   default: the six the Gloom work must pass, then tools/gloomglbcheck.cjs
C=("$@")
[ ${#C[@]} -eq 0 ] && C=("node test.js" "node tools/_low_gloomcheck.cjs" "node tools/_high_gloomcheck.cjs" "node tools/gloommotioncheck.cjs low" "node tools/gloommotioncheck.cjs high" "node tools/keycheck.cjs" "node tools/gloomglbcheck.cjs")
for c in "${C[@]}"; do
  until [ "$(pgrep -c -f chrome-headless)" = "0" ]; do sleep 0.3; done
  echo "=== $c"
  timeout 1500 $c 2>&1 | grep -E "PASS|FAIL|ERROR|rror" | tail -25
done
