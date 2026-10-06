#!/bin/sh
# The JS bridge in Unity, one batch run (docs/systems/engine-bridge.md): rebuild the bundle, play the
# bridge's scene in the editor (muted), the log in output/engine-bridge/unity-<name>.log, its lines
# that say what happened printed.
#   scripts/unity-js-run.sh <name> [BridgeBatch.Run arguments…]
#   scripts/unity-js-run.sh camps -views scripts/bench/viewpoints.json -only camps -out $PWD/output/engine-bridge/unity
#   scripts/unity-js-run.sh incal -level incal -views views-worlds.json -out …
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
NAME=$1; shift
mkdir -p "$ROOT/output/engine-bridge"
(cd "$ROOT" && node scripts/engine-bundle.mjs unity) >/dev/null
LOG="$ROOT/output/engine-bridge/unity-$NAME.log" "$ROOT/scripts/unity-export/unity-batch.sh" BridgeBatch.Run -limit ${LIMIT:-400} "$@" >/dev/null || true
grep -h "\[unity\]\|\[bench\]\|\[game\]\|C# Exception\|error CS\|Memento bridge:" "$ROOT/output/engine-bridge/unity-$NAME.log" | grep -v "the bundle loaded" | cut -c1-${WIDTH:-400} | head -${TAIL:-30}
