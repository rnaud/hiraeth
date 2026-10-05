#!/bin/sh
# The benchmark on the handheld (the Retroid Pocket Nova, or any Android device with USB debugging),
# both sides in one session: the Unity APK's benchmark mode, then the web game in the device's Chrome,
# over the same viewpoints and paths as the Mac run (viewpoints.json).
#   scripts/bench/android-run.sh                      # both sides, Handheld and High presets
#   PRESETS=handheld SIDES=unity scripts/bench/android-run.sh
# ANDROID_SERIAL picks the device, APK the package to install (default: BenchBuild.Android's), OUT the
# folder for the results (default scripts/bench/results/android-<date>).
#
# It installs (or updates) com.rnaud.memento.unity only. It never installs, uninstalls, stops or
# clears com.rnaud.moebius (the web game's app): the web side runs in Chrome, in its own tab and
# storage (localhost:5219), not in the app.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SDK=${ANDROID_HOME:-$HOME/Library/Android/sdk}
ADB=${ADB:-$SDK/platform-tools/adb}
[ -x "$ADB" ] || ADB=/Applications/Unity/Hub/Editor/6000.6.4f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb
export ADB
PKG=com.rnaud.memento.unity
case "$PKG" in com.rnaud.moebius*) echo "refusing: $PKG is the web app" >&2; exit 1 ;; esac
APK=${APK:-$ROOT/unity/Memento/Builds/Android/memento-unity.apk}
OUT=${OUT:-$ROOT/scripts/bench/results/android-$(date +%Y%m%d-%H%M)}
PRESETS=${PRESETS:-"handheld high"}
SIDES=${SIDES:-"unity web"}
PORT=5219
mkdir -p "$OUT"

"$ADB" get-state > /dev/null 2>&1 || { echo "no device: plug it in and allow USB debugging" >&2; exit 1; }
echo "device: $("$ADB" shell getprop ro.product.model | tr -d '\r') (Android $("$ADB" shell getprop ro.build.version.release | tr -d '\r')), battery $("$ADB" shell dumpsys battery | grep level | tr -d ' \r')"
"$ADB" shell dumpsys thermalservice | grep "Thermal Status" | head -1

case " $SIDES " in *" unity "*)
  [ -f "$APK" ] || { echo "no APK at $APK: scripts/unity-export/unity-batch.sh BenchBuild.Android" >&2; exit 1; }
  echo "installing $PKG ($(du -h "$APK" | cut -f1))"
  "$ADB" install -r "$APK"
  for P in $PRESETS; do
    node "$ROOT/scripts/bench/android-unity.mjs" --preset "$P" --out "$OUT/unity-$P.json"
    sleep 20   # (the device cools a little between runs)
  done
  "$ADB" shell am force-stop "$PKG"
;; esac

case " $SIDES " in *" web "*)
  # the game built and served from this Mac, reached by the device through adb reverse
  [ -f "$ROOT/dist/index.html" ] || (cd "$ROOT" && npx vite build)
  node "$ROOT/scripts/bench/serve.mjs" --port $PORT &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null; "$ADB" reverse --remove tcp:'$PORT' 2>/dev/null; "$ADB" forward --remove tcp:9339 2>/dev/null' EXIT
  sleep 1
  "$ADB" reverse tcp:$PORT tcp:$PORT
  "$ADB" forward tcp:9339 localabstract:chrome_devtools_remote
  "$ADB" shell am start -a android.intent.action.VIEW -d "http://localhost:$PORT/manifest.webmanifest" com.android.chrome > /dev/null
  sleep 4
  for P in $PRESETS; do
    PERF_PORT=$PORT node "$ROOT/scripts/bench/android-web.mjs" --preset "$P" --out "$OUT/web-$P.json"
    sleep 20
  done
;; esac

echo "results in $OUT"
node "$ROOT/scripts/bench/android-summary.mjs" "$OUT" || true
