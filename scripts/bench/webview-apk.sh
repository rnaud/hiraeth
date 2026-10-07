#!/bin/sh
# A side-by-side debug build of the Android app for measuring the game in the device's system WebView
# (docs/benchmark-web-vs-unity.md, "On the Retroid: WebView 109 vs Chrome 154"):
#   scripts/bench/webview-apk.sh            # builds $WORK/perf-app.apk (default WORK: $TMPDIR/memento-perf-apk)
#
# It is the same app (android/: WebViewActivity, the gamepad bridge, the WebView settings) copied
# into $WORK and changed there only, never in android/:
#   - its own package id com.rnaud.moebius.perf and name "Hiraeth (perf)", so it installs beside the
#     player's com.rnaud.moebius and never touches it or its saves;
#   - WebView debugging on (a debug build), so DevTools reaches its page through
#     adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>;
#   - the page loaded from http://localhost:5253/ (the Mac's `vite preview`, through adb reverse), the
#     same build Chrome is given; no over-the-air bundles (a debug build doesn't take them) and no APK
#     updater (it would offer the player's release APK).
# Gradle runs on Unity's JDK 17 (JAVA_HOME overrides it). Nothing is installed system-wide.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
MAIN=$(cd "$(git -C "$ROOT" rev-parse --git-common-dir)/.." && pwd)   # the main checkout (node_modules, cap sync output)
WORK=${WORK:-${TMPDIR:-/tmp}/memento-perf-apk}
PKG=com.rnaud.moebius.perf
URL=${URL:-http://localhost:5253/}
case "$PKG" in com.rnaud.moebius) echo "refusing: that is the player's app" >&2; exit 1 ;; esac
export JAVA_HOME=${JAVA_HOME:-/Applications/Unity/Hub/Editor/6000.6.4f1/PlaybackEngines/AndroidPlayer/OpenJDK}
NODE_MODULES=$([ -d "$ROOT/node_modules/@capacitor/android" ] && echo "$ROOT/node_modules" || echo "$MAIN/node_modules")
PLUGINS=$([ -d "$ROOT/android/capacitor-cordova-android-plugins" ] && echo "$ROOT/android/capacitor-cordova-android-plugins" || echo "$MAIN/android/capacitor-cordova-android-plugins")
[ -d "$NODE_MODULES/@capacitor/android" ] || { echo "no @capacitor/android: npm install" >&2; exit 1; }
[ -d "$PLUGINS" ] || { echo "no capacitor-cordova-android-plugins: npx cap sync android (in the main checkout)" >&2; exit 1; }

rm -rf "$WORK/android"; mkdir -p "$WORK"
rsync -a --exclude build --exclude .gradle --exclude app/src/main/assets "$ROOT/android/" "$WORK/android/"
rsync -a "$PLUGINS/" "$WORK/android/capacitor-cordova-android-plugins/"
A=$WORK/android/app
sed -i '' "s/applicationId \"com.rnaud.moebius\"/applicationId \"$PKG\"/" "$A/build.gradle"
grep -q "applicationId \"$PKG\"" "$A/build.gradle" || { echo "could not set the package id" >&2; exit 1; }
sed -i '' 's#<string name="app_name">.*</string>#<string name="app_name">Hiraeth (perf)</string>#; s#<string name="title_activity_main">.*</string>#<string name="title_activity_main">Hiraeth (perf)</string>#' "$A/src/main/res/values/strings.xml"
J=$A/src/main/java/com/rnaud/moebius
for f in MainActivity WebViewActivity; do
  sed -i '' 's#^\( *\)new Updater(this, bundles).check();#\1// (perf build: no APK updater)#' "$J/$f.java"
  grep -q "new Updater" "$J/$f.java" && { echo "could not remove the updater from $f" >&2; exit 1; }
done
# always the WebView (the app's own engine is GeckoView since NATIVE_API 6: MainActivity sends this build to WebViewActivity)
sed -i '' 's#^\( *\)if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;#\1if (a != null) return false;   // (perf build: always the WebView)#' "$J/MainActivity.java"
grep -q "perf build: always the WebView" "$J/MainActivity.java" || { echo "could not keep the perf build in the WebView" >&2; exit 1; }
# plain http to the bench server (cap sync would set this from server.cleartext)
sed -i '' 's#<application#<application android:usesCleartextTraffic="true"#' "$A/src/main/AndroidManifest.xml"
mkdir -p "$A/src/main/assets/public"
cat > "$A/src/main/assets/capacitor.config.json" <<EOF
{ "appId": "$PKG", "appName": "Hiraeth (perf)", "webDir": "dist", "backgroundColor": "#f7ecd2",
  "server": { "url": "$URL", "cleartext": true },
  "android": { "backgroundColor": "#f7ecd2", "allowMixedContent": true, "captureInput": true, "webContentsDebuggingEnabled": true } }
EOF
echo '[]' > "$A/src/main/assets/capacitor.plugins.json"
echo '<!doctype html><title>Hiraeth (perf)</title><p>loads the game from the bench server</p>' > "$A/src/main/assets/public/index.html"
echo "sdk.dir=${ANDROID_HOME:-$HOME/Library/Android/sdk}" > "$WORK/android/local.properties"
# Capacitor 8 asks for Java 21; its Java builds as 17 as well, so the copy (and a copy of capacitor-android)
# compile at 17 on Unity's JDK, with no newer JDK needed
rsync -a --exclude build "$NODE_MODULES/@capacitor/android/capacitor/" "$WORK/capacitor-android/"
sed -i '' "s#new File('../node_modules/@capacitor/android/capacitor')#new File('../capacitor-android')#" "$WORK/android/capacitor.settings.gradle"
for f in "$A/capacitor.build.gradle" "$WORK/capacitor-android/build.gradle" "$WORK/android/capacitor-cordova-android-plugins/build.gradle"; do sed -i '' 's/VERSION_21/VERSION_17/g' "$f"; done
(cd "$WORK/android" && ./gradlew --no-daemon -q assembleDebug)
cp "$A/build/outputs/apk/debug/app-debug.apk" "$WORK/perf-app.apk"
echo "built $WORK/perf-app.apk ($PKG, loads $URL)"
