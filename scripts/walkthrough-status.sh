#!/usr/bin/env bash
# The walkthrough's last daily result on the site (issue #777; docs/systems/testing.md "The walkthrough"): the newest
# finished run of the daily tests (.github/workflows/nightly-tests.yml, job `completion`) uploads completion-evidence/,
# whose node/walkthrough-status.json says, part by part and step by step, what the play-through passed. This copies it to
# <dist>/walkthrough/status.json, where walkthrough.html reads it to mark each step. Site-only (scripts/content-policy.mjs
# WALKTHROUGH_FILE). Best effort: no run, no artifact (kept 14 days) or no gh, and the page simply shows no marks.
# Usage: scripts/walkthrough-status.sh <dist>   (GH_TOKEN with actions: read; GITHUB_REPOSITORY, or the repository's own)
set -u
dist=${1:?usage: walkthrough-status.sh <dist>}
repo=${GITHUB_REPOSITORY:-rnaud/hiraeth}
command -v gh >/dev/null || { echo "walkthrough status: no gh"; exit 0; }
id=$(gh run list -R "$repo" --workflow nightly-tests.yml --limit 10 --json databaseId,status \
  --jq '[.[] | select(.status == "completed")][0].databaseId' 2>/dev/null)
[ -n "$id" ] && [ "$id" != "null" ] || { echo "walkthrough status: no finished daily run"; exit 0; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
gh run download "$id" -R "$repo" -n completion-evidence -D "$tmp" >/dev/null 2>&1 || { echo "walkthrough status: run $id has no evidence"; exit 0; }
[ -f "$tmp/node/walkthrough-status.json" ] || { echo "walkthrough status: run $id wrote no walkthrough-status.json"; exit 0; }
mkdir -p "$dist/walkthrough"
cp "$tmp/node/walkthrough-status.json" "$dist/walkthrough/status.json"
echo "walkthrough status: from daily run $id"
