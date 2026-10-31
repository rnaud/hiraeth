#!/bin/sh
# Publish a Unity testers' build to its GitHub release (docs/systems/unity.md, "Building in GitHub Actions"):
#   scripts/unity-publish.sh android path/to/build.apk [by]     → release unity-android, asset hiraeth-unity.apk
#   scripts/unity-publish.sh linux path/to/build.tar.gz [by]    → release unity-linux, asset hiraeth-unity-linux.tar.gz
#   scripts/unity-publish.sh xbox path/to/build.zip [by]        → release unity-xbox, asset hiraeth-unity-xbox.zip (.github/workflows/unity-xbox.yml)
# The release is a prerelease and never the latest (the app's updater and the players read the vX.Y ones), its
# tag moves to the commit built, its file is replaced, its notes say what it was built from (release-info.mjs
# unity-notes). Then the same file onto the built version's release (vX.Y), labelled with its commit (below).
# SHA the commit built (default HEAD; it has to be on GitHub); gh signed in (GH_TOKEN in CI).
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
PLATFORM=${1:?android, linux or xbox}; FILE=${2:?the build}; BY=${3:-$(hostname -s)}
[ -f "$FILE" ] || { echo "no build at $FILE" >&2; exit 1; }
SHA=$(git rev-parse "${SHA:-HEAD}^{commit}")   # (the whole hash: the tag's move takes no short one)
REPO=${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}
TAG=unity-$PLATFORM
NAME=$(node --input-type=module -e "import { UNITY_RELEASES as R } from './scripts/release-info.mjs'; console.log(R[process.argv[1]].file)" "$PLATFORM")
case $PLATFORM in
  android) TITLE="Hiraeth (Unity) for Android: testers' build" ;;
  xbox) TITLE="Hiraeth (Unity) for Xbox (Developer Mode): measuring build" ;;
  *) TITLE="Hiraeth (Unity) for Linux / Steam Deck: testers' build" ;;
esac
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

# The newest player's record beside it (issue #805): player.json, its build (the commit count, as the player's own
# bundle.json), version, commit, size and sha256 (release-info.mjs player-json), uploaded only now that the build is up,
# so it never names a file that isn't there. The Cloudflare deploy reads it into unity.json's players (checking the file
# is there at that size: scripts/web-update.mjs newestPlayers), and an older player offers this one.
GITHUB_REPOSITORY="$REPO" node scripts/release-info.mjs player-json "$PLATFORM" "$SHA" "$FILE" > "$TMP/player.json"
retry gh release upload "$TAG" "$TMP/player.json" -R "$REPO" --clobber

# The same file onto the built version's release too (vX.Y, the players' page; docs/systems/android.md, "The Unity
# builds on a version's release"), replacing the one there, labelled with what it is and the commit built: the notes'
# Unity section is redone from the labels (release-info.mjs unity-body), as the Android release keeps it (notes).
# The prerelease above stays what the Deck's installer and the Xbox helper read. Failure to attach the version
# fails the job, preserving the rolling build. VERSION_TAG picks a test release; NO_VERSION_RELEASE=1 skips it.
[ "${NO_VERSION_RELEASE:-}" = 1 ] && exit 0
version_release() {
  if [ -n "${VERSION_TAG:-}" ]; then VTAG=$VERSION_TAG
  else
    VTAG="v$(node scripts/release-info.mjs version-at "$SHA")" || return 1
  fi
  # The Android release may still be creating this version. Wait up to ten minutes;
  # never send an older build to a newer release that happens to finish first.
  attempt=1
  until gh release view "$VTAG" -R "$REPO" > /dev/null 2>&1; do
    if [ "$attempt" -ge "${VERSION_RELEASE_ATTEMPTS:-60}" ]; then
      echo "release $VTAG is unavailable after $attempt checks" >&2; return 1
    fi
    sleep "${VERSION_RELEASE_DELAY:-10}"
    attempt=$((attempt + 1))
  done
  SIZE=$(wc -c < "$FILE" | tr -d ' ')
  MAX=$(node --input-type=module -e "import { MAX_RELEASE_ASSET as M } from './scripts/release-info.mjs'; console.log(M)")
  if [ "$SIZE" -gt "$MAX" ]; then echo "::warning::$NAME is $SIZE bytes, over GitHub's 2 GiB per file: on $TAG only, not on $VTAG"; return 0; fi
  LABEL=$(node scripts/release-info.mjs unity-label "$PLATFORM" "$SHA") || return 1
  # (on the Windows runner Git Bash turns a /tmp/… argument into a Windows path for gh.exe, but not one with a
  # #label after it, which gh then can't open: give it the Windows path itself)
  ASSET="$TMP/$NAME"; command -v cygpath > /dev/null 2>&1 && ASSET=$(cygpath -w "$ASSET")
  retry gh release upload "$VTAG" "$ASSET#$LABEL" -R "$REPO" --clobber || return 1
  retry gh release view "$VTAG" -R "$REPO" --json body,assets > "$TMP/release.json" || return 1
  node scripts/release-info.mjs unity-body "$TMP/release.json" > "$TMP/version-notes.md" || return 1
  retry gh release edit "$VTAG" -R "$REPO" --notes-file "$TMP/version-notes.md" > /dev/null || return 1
  echo "https://github.com/$REPO/releases/tag/$VTAG ($NAME as \"$LABEL\")"
}
version_release || {
  echo "::error::$NAME is on $TAG but could not be put on the built version's release${VTAG:+ $VTAG}"
  exit 1
}
