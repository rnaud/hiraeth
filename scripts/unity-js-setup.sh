#!/bin/sh
# Puerts for the Unity side of the JS bridge (docs/systems/engine-bridge.md): its core and a backend's packages
# from the GitHub release, embedded in unity/Memento/Packages/ (git-ignored). Without them the
# project opens and the C# port runs as before; the bridge's scene says Puerts is missing.
#   scripts/unity-js-setup.sh                          (PUERTS=3.0.3 another release)
#   PUERTS_BACKENDS=Quickjs scripts/unity-js-setup.sh  QuickJS instead of V8 (the Xbox's UWP build:
#                                                       scripts/unity-uwp-natives.ps1 then builds its DLLs)
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
V=${PUERTS:-3.0.3}
BACKENDS=${PUERTS_BACKENDS:-V8}
CACHE=${CACHE:-$ROOT/.local-tools/puerts}
mkdir -p "$CACHE"
for p in Core $BACKENDS; do
  [ -f "$CACHE/PuerTS_${p}_$V.tar.gz" ] || gh release download "Unity_v$V" -R Tencent/puerts -p "PuerTS_${p}_$V.tar.gz" -D "$CACHE"
done
TMP=$(mktemp -d)
rm -rf "$ROOT/unity/Memento/Packages/com.tencent.puerts."*
for p in Core $BACKENDS; do
  tar xzf "$CACHE/PuerTS_${p}_$V.tar.gz" -C "$TMP"
  d=$(echo "$p" | tr 'A-Z' 'a-z')
  mv "$TMP/$d" "$ROOT/unity/Memento/Packages/com.tencent.puerts.$d"
done
rm -rf "$TMP"
echo "Puerts $V (core, $BACKENDS) in unity/Memento/Packages/"
