#!/bin/sh
# Publish a Unity testers' build to its GitHub release (docs/systems/unity.md, "Building in GitHub Actions"):
#   scripts/unity-publish.sh android path/to/build.apk [by]     → release unity-android, asset memento-unity.apk
#   scripts/unity-publish.sh linux path/to/build.tar.gz [by]    → release unity-linux, asset memento-unity-linux.tar.gz
# The release is a prerelease and never the latest (the app's updater and the players read the vX.Y ones), its
# tag moves to the commit built, its file is replaced, its notes say what it was built from (release-info.mjs
# unity-notes). SHA the commit built (default HEAD; it has to be on GitHub); gh signed in (GH_TOKEN in CI).
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
PLATFORM=${1:?android or linux}; FILE=${2:?the build}; BY=${3:-$(hostname -s)}
[ -f "$FILE" ] || { echo "no build at $FILE" >&2; exit 1; }
SHA=$(git rev-parse "${SHA:-HEAD}^{commit}")   # (the whole hash: the tag's move takes no short one)
REPO=${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}
TAG=unity-$PLATFORM
NAME=$(node --input-type=module -e "import { UNITY_RELEASES as R } from './scripts/release-info.mjs'; console.log(R[process.argv[1]].file)" "$PLATFORM")
case $PLATFORM in android) TITLE="Hiraeth (Unity) for Android: testers' build" ;; *) TITLE="Hiraeth (Unity) for Linux / Steam Deck: testers' build" ;; esac
gh api "repos/$REPO/commits/$SHA" --jq .sha > /dev/null 2>&1 || { echo "commit $SHA is not on GitHub: push it first" >&2; exit 1; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp "$FILE" "$TMP/$NAME"
node scripts/release-info.mjs unity-notes "$PLATFORM" "$SHA" "$BY" > "$TMP/notes.md"
# (each call retried on a transient error: scripts/retry.sh)
. scripts/retry.sh
if gh release view "$TAG" -R "$REPO" > /dev/null 2>&1; then
  retry gh release upload "$TAG" "$TMP/$NAME" -R "$REPO" --clobber
  # (the tag follows the build; Actions' token may not move it over commits that touch .github/workflows: the notes name the commit anyway)
  gh api -X PATCH "repos/$REPO/git/refs/tags/$TAG" -f sha="$SHA" -F force=true > /dev/null 2>&1 \
    || echo "::warning::the tag $TAG stays where it was (moving it to $SHA was refused); the notes name the commit"
  retry gh release edit "$TAG" -R "$REPO" --title "$TITLE" --notes-file "$TMP/notes.md" --prerelease --latest=false > /dev/null
else
  # (made once, by hand or by the local script: Actions' token was refused creating it, 403, on a commit that adds a workflow)
  retry gh release create "$TAG" "$TMP/$NAME" -R "$REPO" --target "$SHA" --title "$TITLE" --notes-file "$TMP/notes.md" --prerelease --latest=false > /dev/null
fi
echo "https://github.com/$REPO/releases/tag/$TAG ($NAME, $(du -h "$FILE" | cut -f1 | tr -d ' '), $(git rev-parse --short=12 "$SHA"))"
