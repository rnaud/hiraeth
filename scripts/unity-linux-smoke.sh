#!/bin/sh
# The Linux player's smoke run before it is published (the Unity-default plan's D12; .github/workflows/unity-android.yml):
# on a machine with no GPU, under Xvfb and Mesa's software Vulkan (lavapipe), the player starts, loads the desert,
# draws the spawn's view (scripts/bench/viewpoints.json "spawn") and exits 0. Fails when it doesn't exit in time, exits
# otherwise, or its picture is missing or flat (one colour: nothing drawn).
#   scripts/unity-linux-smoke.sh <player folder> <out dir>      (apt: xvfb mesa-vulkan-drivers libvulkan1)
# Its own profile (XDG_CONFIG_HOME, TMPDIR): nothing of a player's saves, and no update over the air (-no-updates).
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR=${1:?the player folder (Builds/bridge-linux)}; OUT=${2:?an out dir}
PLAYER=$DIR/hiraeth-js.x86_64
[ -x "$PLAYER" ] || { echo "no player at $PLAYER" >&2; exit 1; }
mkdir -p "$OUT/profile" "$OUT/tmp"
OUT=$(cd "$OUT" && pwd)
# (lavapipe, Mesa's Vulkan on the CPU: the runner has no GPU)
ICD=$(ls /usr/share/vulkan/icd.d/lvp_icd*.json 2>/dev/null | head -1 || true)
[ -n "$ICD" ] || { echo "no lavapipe (apt install mesa-vulkan-drivers)" >&2; exit 1; }
export VK_ICD_FILENAMES="$ICD" VK_DRIVER_FILES="$ICD" XDG_CONFIG_HOME="$OUT/profile" TMPDIR="$OUT/tmp"
t0=$(date +%s)
status=0
timeout -k 30 ${SMOKE_SECONDS:-1200} xvfb-run -a -s "-screen 0 1280x800x24" "$PLAYER" -screen-fullscreen 0 -screen-width 1280 -screen-height 800 \
  -logFile "$OUT/player.log" -mute -no-updates -level desert -views "$ROOT/scripts/bench/viewpoints.json" -only spawn \
  -out "$OUT" -limit ${SMOKE_LIMIT:-1100} || status=$?
echo "the player exited $status after $(($(date +%s) - t0)) s"
grep -E "Hiraeth bridge: (the bundle loaded|ready|exit|the script's engine made)|Exception|error CS" "$OUT/player.log" | head -20 || true
if [ "$status" -ne 0 ]; then echo "::error::the Linux player's smoke run failed: exit $status (its log: $OUT/player.log)"; tail -60 "$OUT/player.log" || true; exit 1; fi
SHOT="$OUT/unity-spawn.png"
[ -s "$SHOT" ] || { echo "::error::the smoke run drew no picture ($SHOT)"; exit 1; }
# (a picture of the world, not one colour: the channels' spread)
cd "$ROOT" && node --input-type=module -e "
import sharp from 'sharp';
const s = await sharp(process.argv[1]).stats();
const spread = Math.max(...s.channels.slice(0, 3).map((c) => c.stdev));
console.log('the spawn drawn: ' + s.channels.length + ' channels, spread ' + spread.toFixed(1));
if (spread < 8) { console.log('::error::the smoke run\'s picture is flat (spread ' + spread.toFixed(1) + '): nothing drawn'); process.exit(1); }
" "$SHOT"
echo "the Linux player started, loaded the desert, drew it and exited 0"
