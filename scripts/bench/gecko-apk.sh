#!/bin/sh
# The GeckoView test app (docs/benchmark-web-vs-unity.md, "On the Retroid: GeckoView"):
#   scripts/bench/gecko-apk.sh               # builds $WORK/gecko-app.apk (default WORK: $TMPDIR/memento-gecko-apk)
#   DIST=path/to/dist scripts/bench/gecko-apk.sh   # the web build bundled in it (default: dist/)
#
# A small app of its own (scripts/bench/gecko-app/), not the Capacitor one: package com.rnaud.moebius.gecko,
# "Memento (Gecko)", beside the player's com.rnaud.moebius; GeckoView from Mozilla's Maven (release,
# arm64-v8a only); the page's bridge (Capacitor.nativePromise, the gamepad, pause / resume) through a
# built-in WebExtension's native port. It loads http://localhost:6253/ (the Mac, adb reverse) by default,
# or the game bundled in its assets (`--es url bundled:/`, served on http://127.0.0.1:6281/).
# GeckoView 157 needs the Android Gradle plugin 9.1 and compileSdk 37 (its androidx.core 1.19), so this
# builds with Gradle 9.3.1 and Unity's JDK 17, both from Unity's install (JAVA_HOME and GRADLE_HOME
# override them). Nothing is installed system-wide.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=${WORK:-${TMPDIR:-/tmp}/memento-gecko-apk}
DIST=${DIST:-$ROOT/dist}
UNITY_ANDROID=/Applications/Unity/Hub/Editor/6000.6.4f1/PlaybackEngines/AndroidPlayer
export JAVA_HOME=${JAVA_HOME:-$UNITY_ANDROID/OpenJDK}
GRADLE_HOME=${GRADLE_HOME:-$UNITY_ANDROID/Tools/gradle}
[ -f "$DIST/index.html" ] || { echo "no web build in $DIST: npx vite build" >&2; exit 1; }

mkdir -p "$WORK"
rsync -a --delete --exclude build --exclude .gradle --exclude app/src/main/assets/public "$ROOT/scripts/bench/gecko-app/" "$WORK/app-src/"
rsync -a --delete "$DIST/" "$WORK/app-src/app/src/main/assets/public/"
echo "sdk.dir=${ANDROID_HOME:-$HOME/Library/Android/sdk}" > "$WORK/app-src/local.properties"
(cd "$WORK/app-src" && "$JAVA_HOME/bin/java" -cp "$GRADLE_HOME/lib/gradle-gradle-cli-main-9.3.1.jar" org.gradle.launcher.GradleMain --no-daemon -q assembleDebug)
cp "$WORK/app-src/app/build/outputs/apk/debug/app-debug.apk" "$WORK/gecko-app.apk"
echo "built $WORK/gecko-app.apk ($(du -h "$WORK/gecko-app.apk" | cut -f1), com.rnaud.moebius.gecko)"
