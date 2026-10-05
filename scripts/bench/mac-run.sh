#!/bin/sh
# The whole Mac comparison in one command: the web game (three.js, in Chrome), the Unity player and
# Unity's WebGL build, over the same desert viewpoints and paths, alternating, 3 rounds, each run behind
# the quiet-machine gate; then docs/benchmark-web-vs-unity.md is rewritten from the results.
#   scripts/bench/mac-run.sh                         # (about 40 minutes with the WebGL build)
#   scripts/bench/mac-run.sh --rounds 1 --configs high@1280x720 --secs 4 --warmup 1    # a quick check
#   scripts/bench/mac-run.sh --configs high@1280x720,high@1280x960,handheld@1280x720,handheld@1280x960
#   scripts/bench/mac-run.sh --strict                # stop if the machine doesn't get quiet
# What it needs, built if missing: the desert's export (unity-export/export-desert.mjs), the web build
# (dist/), the Unity player (BenchBuild.Mac); the WebGL build (BenchBuild.WebGL) is used when there.
# REBUILD=1 rebuilds the web game and the Unity player first. PLAYWRIGHT points at playwright-core.
# Close the Unity editor and stop other agents' jobs first: the gate waits (up to --wait seconds,
# default 1800) and marks a run invalid if the machine stays busy.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
[ -f unity/Memento/Assets/StreamingAssets/desert/world.bin ] || node scripts/unity-export/export-desert.mjs
if [ "${REBUILD:-0}" = 1 ] || [ ! -f dist/index.html ]; then npx vite build; fi
if [ "${REBUILD:-0}" = 1 ] || [ ! -x unity/Memento/Builds/macOS-bench/Memento.app/Contents/MacOS/Memento ]; then
  scripts/unity-export/unity-batch.sh BenchBuild.Mac -out "$ROOT/unity/Memento/Builds/macOS-bench/Memento.app"
fi
node scripts/bench/run-all.mjs "$@"
node scripts/bench/report.mjs
echo "docs/benchmark-web-vs-unity.md rewritten; the summary is scripts/bench/results/mac.json"
