#!/bin/sh
# The JS bridge's macOS player (docs/systems/engine-bridge.md, "Players"), muted, one run: its plan from the
# arguments (as BridgeBatch.Run's), its log in output/engine-bridge/player-<name>.log, the lines that say
# what happened printed. Build it first: scripts/unity-export/unity-batch.sh BridgeBuild.Mac
#   scripts/unity-js-player.sh <name> [-views file -only a,b -bench 6 -split -out dir …]
#   scripts/unity-js-player.sh bench -views scripts/bench/viewpoints.json -bench 6 -out $PWD/output/engine-bridge/player-mac
# APP overrides the player (default unity/Memento/Builds/bridge-macOS/Memento JS.app).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
NAME=$1; shift
APP=${APP:-$ROOT/unity/Memento/Builds/bridge-macOS/Memento JS.app}
LOG="$ROOT/output/engine-bridge/player-$NAME.log"
mkdir -p "$ROOT/output/engine-bridge"
cd "$ROOT"
"$APP/Contents/MacOS/Memento JS" -mute -screen-width 1280 -screen-height 720 -screen-fullscreen 0 -limit "${LIMIT:-400}" -logFile "$LOG" "$@" || true
grep -h "\[unity\]\|\[bench\]\|\[game\]\|Exception\|Memento bridge:" "$LOG" | grep -v "the bundle loaded" | cut -c1-${WIDTH:-400} | head -${TAIL:-30}
