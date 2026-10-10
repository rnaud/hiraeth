#!/bin/sh
# Show a release's or deploy's outcome on the commit it built (docs/systems/android.md, "When a release fails"):
#   scripts/commit-status.sh STATE CONTEXT
# STATE: pending, success, failure, error, or the job's own status (${{ job.status }}: success, failure,
# cancelled → error). CONTEXT names the line on the commit, e.g. "release: android". SHA: the commit built
# (in a workflow_run run, github.event.workflow_run.head_sha: that run's own check doesn't land on the tested
# commit, so a failed release didn't show where the author looked).
# Needs gh signed in with the statuses: write permission (GH_TOKEN). Never fails the job: a status that can't be
# written is a warning.
. "$(dirname "$0")/retry.sh"
case ${1:?the state} in
  pending) STATE=pending; DESC="building" ;;
  success) STATE=success; DESC="published" ;;
  cancelled|error) STATE=error; DESC="cancelled before it finished" ;;
  *) STATE=failure; DESC="failed: open the run for the log" ;;
esac
CONTEXT=${2:?the context}
SHA=${SHA:?the commit built}
REPO=${GITHUB_REPOSITORY:?the repository}
URL="${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/${GITHUB_RUN_ID:?the run}"
if retry gh api "repos/$REPO/statuses/$SHA" -f state="$STATE" -f context="$CONTEXT" -f target_url="$URL" -f description="$DESC" > /dev/null; then
  echo "$CONTEXT: $STATE on $SHA"
else
  echo "::warning::couldn't set the commit status $CONTEXT=$STATE on $SHA"
fi
exit 0
