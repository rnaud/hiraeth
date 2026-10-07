#!/bin/sh
# The Unity testers' APK built on this Mac and published (docs/systems/unity.md, "Building in GitHub Actions"):
# for as long as the workflow (.github/workflows/unity-android.yml) has no Unity licence, or whenever a build is
# wanted now. The JS bridge's Android player as BridgeBuild.AndroidRelease makes it (com.rnaud.memento.unity,
# "Memento (Unity)", the game's icon, the newest changelog version, the commit count as its versionCode), signed
# with the local backup of the release key, uploaded to the GitHub release unity-android (the file replaced).
#   scripts/unity-android-release.sh               build and publish HEAD (push it first)
#   NO_UPLOAD=1 scripts/unity-android-release.sh   build only: unity/Memento/Builds/unity-android/memento-unity.apk
# KEYS another folder with moebius-release.p12 and password.txt (default .local-tools/android-signing/, here or in
# the main checkout); MIN_FREE_GB the free disk wanted before the build (10: the first build takes 4-6 GB);
# CLEAN=1 deletes Library/Bee (the IL2CPP build's cache, 2-3 GB) afterwards; UNITY another editor.
# Muted throughout: the editor runs in batch mode and the player is not started.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
PROJECT=$ROOT/unity/Memento
MAIN=$(cd "$(git rev-parse --path-format=absolute --git-common-dir)/.." && pwd)
UNITY_HOME=${UNITY_HOME:-/Applications/Unity/Hub/Editor/6000.6.4f1}

# the release key (never printed; passed to the editor in its environment, not on its command line)
if [ -z "${KEYS:-}" ]; then
  if [ -f "$ROOT/.local-tools/android-signing/moebius-release.p12" ]; then KEYS=$ROOT/.local-tools/android-signing; else KEYS=$MAIN/.local-tools/android-signing; fi
fi
[ -f "$KEYS/moebius-release.p12" ] && [ -f "$KEYS/password.txt" ] || { echo "no release key in $KEYS (docs/systems/android.md)" >&2; exit 1; }

FREE=$(df -k / | awk 'NR==2 { print int($4 / 1048576) }')
[ "$FREE" -ge "${MIN_FREE_GB:-10}" ] || { echo "only $FREE GB free on /: the build wants ${MIN_FREE_GB:-10} (MIN_FREE_GB)" >&2; exit 1; }

# Puerts (core and V8) into Packages/, from the cache here or the main checkout's
if [ ! -d "$PROJECT/Packages/com.tencent.puerts.core" ] || [ ! -d "$PROJECT/Packages/com.tencent.puerts.v8" ]; then
  if [ -z "${CACHE:-}" ] && [ -d "$MAIN/.local-tools/puerts" ]; then CACHE=$MAIN/.local-tools/puerts; export CACHE; fi
  scripts/unity-js-setup.sh
fi

# the game's JavaScript for Puerts' V8 (StreamingAssets/memento-js), as the local players take it
node scripts/engine-bundle.mjs unity

# Puerts' IL2CPP glue (Assets/Gen), once: C# too, so an editor run of its own before the build's
if [ ! -f "$PROJECT/Assets/Gen/Plugins/puerts_il2cpp/Puerts_il2cpp.cpp" ]; then
  scripts/unity-export/unity-batch.sh BridgeBuild.Il2cpp
fi

VERSION=$(node scripts/release-info.mjs version)
BUILD=$(node scripts/release-info.mjs build)
OUT=$PROJECT/Builds/unity-android/memento-unity.apk
SETTINGS=unity/Memento/ProjectSettings/ProjectSettings.asset
SETTINGS_CLEAN=0; git diff --quiet -- "$SETTINGS" && SETTINGS_CLEAN=1
rm -f "$OUT"
echo "Building $VERSION ($BUILD) from $(git rev-parse --short=12 HEAD)…"
STATUS=0
ANDROID_KEYSTORE_PATH=$KEYS/moebius-release.p12 ANDROID_KEYSTORE_PASSWORD=$(cat "$KEYS/password.txt") \
  scripts/unity-export/unity-batch.sh BridgeBuild.AndroidRelease -version "$VERSION" -code "$BUILD" -out "$OUT" || STATUS=$?
# (the editor writes the build's settings back, the key's path among them: the committed ones stay as they were)
[ "$SETTINGS_CLEAN" = 1 ] && git checkout -- "$SETTINGS"
[ "$STATUS" = 0 ] && [ -f "$OUT" ] || { echo "no APK: unity/Memento/Logs/batch-BridgeBuild.AndroidRelease.log" >&2; exit 1; }

# what was built: the package and version, and the release key's certificate
TOOLS=$(ls -d "$UNITY_HOME"/PlaybackEngines/AndroidPlayer/SDK/build-tools/* | tail -1)
JAVA_HOME=$UNITY_HOME/PlaybackEngines/AndroidPlayer/OpenJDK; export JAVA_HOME
"$TOOLS/aapt2" dump badging "$OUT" | grep -E "^package:|^application-label:|^launchable-activity:" | cut -c1-160
SIGNED=$("$TOOLS/apksigner" verify --print-certs "$OUT" | sed -n 's/.*certificate SHA-256 digest: //p' | head -1)
WANTED=$(openssl x509 -in "$KEYS/cert.pem" -noout -fingerprint -sha256 | sed 's/.*=//; s/://g' | tr 'A-F' 'a-f')
[ "$SIGNED" = "$WANTED" ] || { echo "the APK is not signed with the release key ($SIGNED)" >&2; exit 1; }
echo "signed with the release key; $(du -h "$OUT" | cut -f1 | tr -d ' ')"

[ "${CLEAN:-0}" = 1 ] && rm -rf "$PROJECT/Library/Bee"
[ "${NO_UPLOAD:-0}" = 1 ] && { echo "$OUT"; exit 0; }
git diff --quiet HEAD -- engine src unity/Memento/Assets scripts public || echo "(uncommitted changes in the build: the notes name HEAD)" >&2
scripts/unity-publish.sh android "$OUT" "a local build on $(hostname -s)"
