#!/bin/sh
# Puerts for the Unity side of the JS bridge (docs/systems/engine-bridge.md): its core and V8 packages
# from the GitHub release, embedded in unity/Memento/Packages/ (git-ignored). Without them the
# project opens and the C# port runs as before; the bridge's scene says Puerts is missing.
#   scripts/unity-js-setup.sh            (PUERTS=3.0.3 another release)
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
V=${PUERTS:-3.0.3}
CACHE=${CACHE:-$ROOT/.local-tools/puerts}
mkdir -p "$CACHE"
for p in Core V8; do
  [ -f "$CACHE/PuerTS_${p}_$V.tar.gz" ] || gh release download "Unity_v$V" -R Tencent/puerts -p "PuerTS_${p}_$V.tar.gz" -D "$CACHE"
done
TMP=$(mktemp -d)
tar xzf "$CACHE/PuerTS_Core_$V.tar.gz" -C "$TMP"
tar xzf "$CACHE/PuerTS_V8_$V.tar.gz" -C "$TMP"
rm -rf "$ROOT/unity/Memento/Packages/com.tencent.puerts.core" "$ROOT/unity/Memento/Packages/com.tencent.puerts.v8"
mv "$TMP/core" "$ROOT/unity/Memento/Packages/com.tencent.puerts.core"
mv "$TMP/v8" "$ROOT/unity/Memento/Packages/com.tencent.puerts.v8"
rm -rf "$TMP"
echo "Puerts $V in unity/Memento/Packages/"
