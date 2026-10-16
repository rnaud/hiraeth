#!/bin/sh
# Wait for the unit suite (.github/workflows/tests.yml, "Tests") on a pushed commit, before a build of it is published
# (the Unity-default plan's D12: the Linux player, .github/workflows/unity-android.yml).
#   scripts/wait-tests.sh <sha> [minutes, 90]      exit 0: it passed; 1: it failed, was cancelled (a newer push
#                                                  covers it) or didn't finish in time
# GH_TOKEN and GITHUB_REPOSITORY (or gh's own repository) as in Actions.
set -eu
SHA=${1:?the commit}; MINUTES=${2:-90}
REPO=${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}
deadline=$(($(date +%s) + MINUTES * 60))
while :; do
  # (the newest run of the push of that commit: a re-run of failed jobs is the same run, its conclusion updated)
  line=$(gh api "repos/$REPO/actions/workflows/tests.yml/runs?head_sha=$SHA&event=push&per_page=5" \
    --jq '.workflow_runs | sort_by(.run_number) | last | if . == null then "none" else "\(.status) \(.conclusion) \(.html_url)" end' 2>/dev/null || echo "unknown")
  set -- $line
  case "${1:-unknown} ${2:-}" in
    "completed success") echo "Tests passed on $SHA ($3)"; exit 0 ;;
    completed*) echo "::error::Tests ended '${2:-?}' on $SHA (${3:-}): not published"; exit 1 ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then echo "::error::Tests on $SHA not done after $MINUTES min (${line}): not published"; exit 1; fi
  echo "Tests on $SHA: ${line}; waiting"
  sleep 60
done
