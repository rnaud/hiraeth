#!/bin/zsh
# Every world through the motion check's paths (clips saved), a few features toggled on the slow paths.
#   BUILD=main TAG=before PRESET=high OUT=<dir> scripts/motion-check/survey.sh      (serve.mjs running)
cd "${0:A:h}/../.."
BUILD=${BUILD:-main}; TAG=${TAG:-$BUILD}; PRESET=${PRESET:-high}; OUT=${OUT:-${TMPDIR:-/tmp}/memento-motion/$PRESET}
WORLDS=(${=WORLDS:-desert incal bazaar arzach arzach2 perdide perdide2 edena garage buried spheres home})
TG=${TG:-detail,wear,form,allfog}
PATHS=${PATHS:-still,pan,drift,walk,zoom,orbit,orbitslow,fast,haze,swing30}
mkdir -p $OUT
for L in $WORLDS; do
  P=$PATHS; [[ $L == incal ]] && P=$P,descend
  node scripts/motion-check/record.mjs --level $L --build $BUILD --preset $PRESET --paths $P --tag $TAG --out $OUT --save 1 --toggles $TG 2>&1 | grep -v "NaN\|^luma\|^  clip"
done
