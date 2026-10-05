#!/bin/sh
# The MakeHuman prototype's tools (docs/makehuman.md), user-level and git-ignored, in
# .local-tools/makehuman/ (or $MH_TOOLS): Blender 4.5 LTS (the official macOS build, not installed,
# just unpacked), MPFB 2.0.17 (the MakeHuman add-on, from extensions.blender.org) installed into
# Blender's own user folder there, and the CC0 asset packs MPFB reads (MakeHuman's system assets,
# faceunits01, visemes01). Then:
#   .local-tools/makehuman/blender.sh --python scripts/makehuman/build.py
set -e
cd "$(dirname "$0")/../.."
T="${MH_TOOLS:-$PWD/.local-tools/makehuman}"
mkdir -p "$T/dl" "$T/user"
cd "$T"
get() { [ -f "dl/$1" ] || curl -fL -o "dl/$1" "$2"; }
get blender-4.5.9-macos-arm64.dmg https://download.blender.org/release/Blender4.5/blender-4.5.9-macos-arm64.dmg
get mpfb-2.0.17.zip "https://extensions.blender.org/download/sha256:4f0a879d64a39bf646fbf5f53601ac678855da329d650617dca5737548239a87/add-on-mpfb-v2.0.17.zip?repository=%2Fapi%2Fv1%2Fextensions%2F&blender_version_min=4.2.0"
get makehuman_system_assets_cc0.zip https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
get faceunits01.zip https://files.makehumancommunity.org/functional/faceunits01.zip
get visemes01.zip https://files.makehumancommunity.org/functional/visemes01.zip
if [ ! -d Blender.app ]; then
  hdiutil attach -nobrowse -readonly -mountpoint "$T/mnt" dl/blender-4.5.9-macos-arm64.dmg
  ditto "$T/mnt/Blender.app" "$T/Blender.app"
  hdiutil detach "$T/mnt"
fi
cat > blender.sh <<EOF
#!/bin/sh
# Blender headless, with its user folder (and MPFB) here: no GUI, no sound
export BLENDER_USER_RESOURCES="$T/user"
exec "$T/Blender.app/Contents/MacOS/Blender" -b -noaudio "\$@"
EOF
chmod +x blender.sh
# MPFB into that user folder (enabled), then the asset packs into MPFB's user data
BLENDER_USER_RESOURCES="$T/user" "$T/Blender.app/Contents/MacOS/Blender" -b --factory-startup -noaudio --python-expr "
import bpy
bpy.ops.extensions.package_install_files(filepath='$T/dl/mpfb-2.0.17.zip', repo='user_default', enable_on_install=True)
bpy.ops.wm.save_userpref()"
D="$T/user/extensions/.user/user_default/mpfb/data"
mkdir -p "$D" "$T/unpack"
for z in makehuman_system_assets_cc0 faceunits01 visemes01; do unzip -q -o "dl/$z.zip" -d "$T/unpack/$z"; done
# (the eyes, the eyebrows and the ten CC0 hairstyles: "This asset was explicitly released as CC0 in september 2020")
cp -R "$T/unpack/makehuman_system_assets_cc0/eyes" "$T/unpack/makehuman_system_assets_cc0/eyebrows" "$T/unpack/makehuman_system_assets_cc0/hair" "$D/"
mkdir -p "$D/targets" "$D/packs"
cp -R "$T/unpack/faceunits01/targets/"* "$T/unpack/visemes01/targets/"* "$D/targets/"
cp "$T/unpack/faceunits01/packs/"*.json "$T/unpack/visemes01/packs/"*.json "$D/packs/"
echo "ready: scripts/makehuman/build.sh"
