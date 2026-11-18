#!/bin/bash
# The whole desktop Walker: model -> bake (waits until no headless browser runs) -> paint -> GLB in art/models_hi. Run from the project folder: bash tools/gloomglb/make_walker.sh
set -e
B=art/blender
python3 tools/gloomglb/walker_model.py $B/gloom_walker_model.blend | grep -E "objects|Error"
until [ "$(pgrep -c -f chrome-headless)" = "0" ]; do sleep 5; done
python3 -u tools/gloomglb/bake_data.py $B/gloom_walker_model.blend $B/gloom_walker_bake 2048 48 | grep -E "unwrapped|baked|coverage|Error"
python3 tools/gloomglb/paint_tex.py $B/gloom_walker_bake $B/gloom_walker_tex walker
python3 tools/gloomglb/export_glb.py $B/gloom_walker_bake/uv.blend $B/gloom_walker_raw.glb | grep -E "triangles|Error"
python3 tools/gloomglb/pack_glb.py $B/gloom_walker_raw.glb $B/gloom_walker_tex art/models_hi/gloom_walker_hi.glb 2048
