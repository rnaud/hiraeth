#!/bin/sh
# The MakeHuman parametric body (docs/makehuman.md): the reference person (decimation, face keys,
# the hair), the samples of MakeHuman's macro space in parallel, then the pack:
# public/anim/mh/body.bin. Blender headless (scripts/makehuman/fetch.sh sets it up).
#   scripts/makehuman/build.sh [workers]
set -e
cd "$(dirname "$0")/../.."
T="${MH_TOOLS:-$PWD/.local-tools/makehuman}"
N="${1:-6}"
B="$T/blender.sh --python scripts/makehuman/build.py --"
$B --reference
i=0
while [ $i -lt "$N" ]; do $B --samples "$i/$N" > "$T/samples-$i.log" 2>&1 & i=$((i + 1)); done
wait
$B --pack
