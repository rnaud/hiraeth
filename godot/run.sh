#!/bin/sh
# Run the Godot side (docs/systems/engine-bridge.md): rebuild the bundles, then Godot on this
# project, muted, its log to output/engine-bridge/godot.log. Arguments after the script go to the
# game (after Godot's `--`), e.g.
#   godot/run.sh --entry=spike --shot=$PWD/output/engine-bridge/spike.png
#   GODOT_FLAGS=--headless godot/run.sh --entry=spike     (no window, no pictures: the dummy renderer)
# GODOT: the GodotJS editor binary (default: the one under .local-tools/godot).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)
MAIN=$(cd "$ROOT" && git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's#/.git$##')
GODOT=${GODOT:-$MAIN/.local-tools/godot/macos-editor-app-4.6.1-v8/Godot.app/Contents/MacOS/Godot}
[ -x "$GODOT" ] || GODOT=$ROOT/.local-tools/godot/macos-editor-app-4.6.1-v8/Godot.app/Contents/MacOS/Godot
mkdir -p "$ROOT/output/engine-bridge"
LOG=${LOG:-$ROOT/output/engine-bridge/godot.log}
(cd "$ROOT" && node scripts/engine-bundle.mjs ${BUNDLES:-}) >/dev/null
"$GODOT" --audio-driver Dummy --resolution ${RES:-1280x720} --quit-after ${FRAMES:-900} ${GODOT_FLAGS:-} --path "$HERE" -- "$@" >"$LOG" 2>&1 || true
grep -v '^$' "$LOG" | grep -v 'JSDebugger' | tail -n ${TAIL:-40}
