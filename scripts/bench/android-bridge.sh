#!/bin/sh
# The JS bridge's Android player (docs/systems/engine-bridge.md, "Players") on a handheld, one run: install
# (or update) com.rnaud.memento.bridge, push the views, start it muted with a plan (BridgeArgs: the same
# arguments as the editor's batch run), wait for it to exit, pull its pictures and bench.json.
#   scripts/unity-export/unity-batch.sh BridgeBuild.Android            (the APK first)
#   scripts/bench/android-bridge.sh desert -views scripts/bench/viewpoints.json -bench 8 -split
#   scripts/bench/android-bridge.sh bazaar -views scripts/bench/viewpoints-worlds.json
# ANDROID_SERIAL picks the device, APK another build, OUT the folder for the results
# (default output/engine-bridge/android-<level>). It installs com.rnaud.memento.bridge only: it never touches
# com.rnaud.moebius (the web game's app) nor com.rnaud.memento.unity (the C# port's).
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SDK=${ANDROID_HOME:-$HOME/Library/Android/sdk}
ADB=${ADB:-$SDK/platform-tools/adb}
[ -x "$ADB" ] || ADB=/Applications/Unity/Hub/Editor/6000.6.4f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb
PKG=com.rnaud.memento.bridge
APK=${APK:-$ROOT/unity/Memento/Builds/bridge-android/memento-js.apk}
LEVEL=${1:?a level: desert, bazaar, incal…}; shift
OUT=${OUT:-$ROOT/output/engine-bridge/android-$LEVEL}
DEV=/sdcard/Android/data/$PKG/files
mkdir -p "$OUT"
"$ADB" install -r "$APK" > /dev/null
"$ADB" shell mkdir -p "$DEV/out"
# the plan's files go to the app's own folder; a -views file is pushed and named by its place there
ARGS="-level $LEVEL -mute -out $DEV/out"
while [ $# -gt 0 ]; do
  case "$1" in
    -views) "$ADB" push "$2" "$DEV/views.json" > /dev/null; ARGS="$ARGS -views $DEV/views.json"; shift 2 ;;
    -out) shift 2 ;;   # (always the app's own folder, pulled after)
    *) ARGS="$ARGS $1"; shift ;;
  esac
done
ACT=$("$ADB" shell cmd package resolve-activity --brief "$PKG" | tail -1 | tr -d '\r')
"$ADB" logcat -c
"$ADB" shell am start -W -n "$ACT" -e unity "$ARGS" > /dev/null
# (it exits itself when its plan is done: BridgeRunner.Exit; at most LIMIT seconds)
LIMIT=${LIMIT:-600}; t=0
while [ $t -lt "$LIMIT" ] && "$ADB" shell pidof "$PKG" > /dev/null 2>&1; do sleep 5; t=$((t + 5)); done
"$ADB" shell am force-stop "$PKG"
"$ADB" logcat -d -s Unity | grep "\[unity\]\|\[bench\]\|\[game\]\|Exception\|Memento bridge:" | cut -c1-400 | tee "$OUT/log.txt" | tail -30
"$ADB" pull "$DEV/out/." "$OUT" > /dev/null
echo "$OUT"
