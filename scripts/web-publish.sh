#!/bin/sh
# Record the verified web/content release without replacing the native updater's latest release.
# Called only after the exact commit's Tests and public deployment verification pass.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
SHA=$(git rev-parse "${1:?exact tested commit}^{commit}")
[ "$SHA" = "$(git rev-parse HEAD)" ] || { echo 'web release checkout differs from tested commit' >&2; exit 1; }
REPO=${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}
VERSION=$(node scripts/release-info.mjs version-at "$SHA")
TAG="v$VERSION"
TMP=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/hiraeth-web-release.XXXXXX")
. scripts/retry.sh
publish() {
  if gh release view "$TAG" -R "$REPO" --json assets > "$TMP/release.json"; then
    node scripts/release-info.mjs web-notes "$TMP/release.json" "$SHA" > "$TMP/notes.md" || return 1
    # Preserve attached APKs/Unity assets and the native updater's latest-release designation.
    gh release edit "$TAG" -R "$REPO" --notes-file "$TMP/notes.md" || return 1
  else
    printf '%s\n' '{"assets":[]}' > "$TMP/release.json"
    node scripts/release-info.mjs web-notes "$TMP/release.json" "$SHA" > "$TMP/notes.md" || return 1
    gh release create "$TAG" -R "$REPO" --target "$SHA" --title "Hiraeth v$VERSION" --notes-file "$TMP/notes.md" --latest=false || return 1
  fi
}
retry publish
