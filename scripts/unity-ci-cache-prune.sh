#!/bin/sh
# Keep one Actions cache entry per Unity cache (docs/systems/unity.md, "Building in GitHub Actions", the caches):
#   scripts/unity-ci-cache-prune.sh PREFIX KEEP_KEY
# deletes every entry whose key starts with PREFIX except KEEP_KEY, once KEEP_KEY is saved (never all of them:
# when the save failed, the older entries stay). The repository's caches are limited to 10 GB, and Unity's
# Library (1.4 GB for Android, 0.8 for Linux) and Gradle's downloads (0.9) would otherwise pile up and push
# each other out. Needs gh signed in with the actions: write permission (GH_TOKEN: the workflow's token).
# Only the entries of the run's own branch (GITHUB_REF: a test build from a branch never deletes main's), and only
# those older than KEEP_KEY (two runs saving at once each keep their own; the newer goes at the next prune).
set -eu
PREFIX=${1:?the key prefix}; KEEP=${2:?the key to keep}
REPO=${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}
case $KEEP in "$PREFIX"*) ;; *) echo "$KEEP does not start with $PREFIX" >&2; exit 1 ;; esac
keys=$(gh cache list -R "$REPO" --key "$PREFIX" ${GITHUB_REF:+--ref "$GITHUB_REF"} --limit 100 --json id,key,createdAt --jq '.[] | "\(.id) \(.createdAt) \(.key)"')
if ! printf '%s\n' "$keys" | cut -d" " -f3- | grep -qxF "$KEEP"; then
  echo "$KEEP is not saved: the older $PREFIX* entries are kept"; exit 0
fi
kept=$(printf '%s\n' "$keys" | awk -v k="$KEEP" '$3 == k { print $2 }' | sort | tail -1)
printf '%s\n' "$keys" | awk -v k="$KEEP" -v t="$kept" '$1 != "" && $3 != k && $2 < t { print $1, $3 }' | while read -r id key; do
  echo "deleting $key"
  gh cache delete "$id" -R "$REPO" || echo "::warning::could not delete the cache $key"
done
