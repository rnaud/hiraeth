#!/bin/bash
# An outfit for the Blender traveller, from scratch (issue #540; docs/systems/characters.md, "Outfits"): its
# pieces built on the base (data/characters/traveller-v2/traveller.blend, made by build.sh), its GLB, atlas and
# manifest in data/characters/traveller-v2/outfits/<id>/, and with --previews its sheets beside the default's.
#
#   scripts/blender/traveller/outfit.sh glider-pilot [--previews]
set -euo pipefail
cd "$(dirname "$0")/../../.."
ID=${1:?outfit id}
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
OUT=data/characters/traveller-v2/outfits/$ID
HERE=scripts/blender/traveller
WORK=$(mktemp -d "${TMPDIR:-/tmp}/traveller-outfit.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

"$BLENDER" --background --factory-startup --python $HERE/outfit.py -- --outfit "$ID" --out "$OUT" --blend "$WORK/outfit.blend" \
  > "$WORK/build.log" 2>&1 || { tail -40 "$WORK/build.log"; exit 1; }
grep -E '^(piece|skin cut|OUTFIT|POKES)' "$WORK/build.log"
grep -q '^OUTFIT' "$WORK/build.log" || { tail -40 "$WORK/build.log"; exit 1; }   # (Blender exits 0 on a Python error)

[ "${2:-}" = "--previews" ] || exit 0
R="$WORK/renders"
mkdir -p "$R" "$OUT/previews"
"$BLENDER" --background --factory-startup --python $HERE/outfit_previews.py -- --blend "$WORK/outfit.blend" --outfit "$ID" \
  --out "$R" --only turn,posed,clips,close,pieces > "$WORK/previews.log" 2>&1 || { tail -40 "$WORK/previews.log"; exit 1; }
sheet() {   # sheet <name> <columns> <png>...
  local name=$1 cols=$2; shift 2
  local files=()
  for f in "$@"; do files+=("$R/$f.png"); done
  "$BLENDER" --background --factory-startup --python $HERE/sheet.py -- "$R/$name.png" "$cols" "${files[@]}" > /dev/null 2>&1
  sips -s format jpeg -s formatOptions 80 "$R/$name.png" --out "$OUT/previews/$name.jpg" > /dev/null
}
both() { for v in "$@"; do echo "$v-default"; done; for v in "$@"; do echo "$v-$ID"; done; }
sheet turnaround 4 $(both turn-front turn-three-quarter turn-side turn-back)
sheet posed 3 $(both posed-front posed-three-quarter posed-side)
sheet clips 4 $(both clip-idle clip-jog-a clip-jog-b clip-sprint)
sheet close 5 close-sleeve close-collar close-crotch close-seat close-knee
sheet pieces 3 $(cd "$R" && ls piece-*.png | sort | sed 's/\.png$//')
ls -la "$OUT/previews"
