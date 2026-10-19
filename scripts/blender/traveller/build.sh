#!/bin/bash
# The Blender traveller from scratch, in one command (issue #493; docs/systems/characters.md, "The
# traveller in Blender"): the donor from the game's own data, the model (data/characters/traveller-v2:
# traveller.blend, traveller.glb, manifest.json), and with --previews its preview sheets (previews/).
#
#   scripts/blender/traveller/build.sh [--previews]
#
# BLENDER names Blender 5.2's binary (default: the macOS app). Sheets are joined in Blender and made JPEG
# with sips (macOS).
set -euo pipefail
cd "$(dirname "$0")/../../.."
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
OUT=data/characters/traveller-v2
HERE=scripts/blender/traveller
WORK=$(mktemp -d "${TMPDIR:-/tmp}/traveller-v2.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

node $HERE/export-donor.mjs "$WORK/donor.json"
"$BLENDER" --background --factory-startup --python $HERE/build_b3.py -- --donor "$WORK/donor.json" --out $OUT \
  > "$WORK/build.log" 2>&1 || { tail -40 "$WORK/build.log"; exit 1; }
grep -E '^(TRAVELLER|POKES|atlas:|paint)' "$WORK/build.log"

[ "${1:-}" = "--previews" ] || exit 0
R="$WORK/renders"
mkdir -p "$R"
"$BLENDER" --background --factory-startup --python $HERE/previews.py -- --blend "$PWD/$OUT/traveller.blend" --out "$R" \
  --only dressed,parts,wire,faces,posed,seams,compare,pieces,clips > "$WORK/previews.log" 2>&1 \
  || { tail -40 "$WORK/previews.log"; exit 1; }
sheet() {   # sheet <name> <columns> <png>...
  local name=$1 cols=$2; shift 2
  local files=()
  for f in "$@"; do files+=("$R/$f.png"); done
  "$BLENDER" --background --factory-startup --python $HERE/sheet.py -- "$R/$name.png" "$cols" "${files[@]}" > /dev/null 2>&1
  sips -s format jpeg -s formatOptions 82 "$R/$name.png" --out "$OUT/previews/$name.jpg" > /dev/null
}
sheet dressed-turnaround 4 dressed-front dressed-three-quarter dressed-side dressed-back
sheet body-turnaround 3 body-front body-side body-back
sheet head 3 head-front head-three-quarter head-side
sheet posed 3 posed-front posed-three-quarter posed-side
sheet seams 5 seam-sleeve seam-front seam-hem-boot seam-scarf seam-back-hem
sheet shoulder 3 shoulder-front shoulder-side shoulder-back
sheet clips 4 clip-idle clip-jog-a clip-jog-b clip-sprint
sheet clips-shoulder 4 clip-idle-shoulder clip-jog-a-shoulder clip-jog-b-shoulder clip-sprint-shoulder
sheet pieces 3 piece-shirt-front piece-shirt-back piece-shirt-below piece-tee-front piece-tee-back piece-tee-below \
  piece-trousers-front piece-trousers-back piece-trousers-below
sheet pieces-small 3 piece-scarf-front piece-scarf-back piece-scarf-below piece-boots-front piece-boots-back piece-boots-below
sheet face-keys 7 $(cd "$R" && ls face-*.png | sort | sed 's/\.png$//')
for f in compare-front compare-three-quarter compare-side compare-back exploded-front exploded-three-quarter \
  wire-body-front wire-head-front; do
  sips -s format jpeg -s formatOptions 82 "$R/$f.png" --out "$OUT/previews/$f.jpg" > /dev/null
done
ls -la $OUT/previews
