#!/bin/bash
# One desktop Gloom kind from its Blender script: model -> bake (waits until no headless browser and no other bake runs) -> paint -> GLB in art/models_hi.
# Run from the project folder: bash tools/gloomglb/make_kind.sh <kind> [skipmodel]   (kind: walker, lurcher; tools/gloomglb/<kind>_model.py builds it)
# Times each step (the owner plans the other kinds from them).
set -e
K=$1
B=art/blender
t0=$(date +%s)
if [ "$2" != "skipmodel" ]; then nice -n 10 python3 tools/gloomglb/${K}_model.py $B/gloom_${K}_model.blend | grep -E "^objects|Error|dent:"; fi
t1=$(date +%s)
until [ "$(pgrep -c -f chrome-headless)" = "0" ] && [ "$(pgrep -c -f bake_data.py)" = "0" ]; do sleep 0.3; done
t2=$(date +%s)
nice -n 10 python3 -u tools/gloomglb/bake_data.py $B/gloom_${K}_model.blend $B/gloom_${K}_bake 2048 48 | grep -E "unwrapped|baked|coverage|Error"
t3=$(date +%s)
nice -n 10 python3 tools/gloomglb/paint_tex.py $B/gloom_${K}_bake $B/gloom_${K}_tex $K
t4=$(date +%s)
nice -n 10 python3 tools/gloomglb/export_glb.py $B/gloom_${K}_bake/uv.blend $B/gloom_${K}_raw.glb | grep -E "triangles|Error"
python3 tools/gloomglb/pack_glb.py $B/gloom_${K}_raw.glb $B/gloom_${K}_tex art/models_hi/gloom_${K}_hi.glb 2048
t5=$(date +%s)
echo "TIMES $K: model $((t1-t0)) s, waited $((t2-t1)) s, bake $((t3-t2)) s, paint $((t4-t3)) s, export+pack $((t5-t4)) s"
