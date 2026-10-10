# Retry a GitHub call that failed on a transient error (docs/systems/android.md, "When a release fails"):
#   . scripts/retry.sh
#   retry gh release upload "$TAG" "$FILE" --clobber
#   retry publish            (a shell function: chain its commands with || return 1, as `set -e` is off inside it)
# Runs the command up to four times, waiting RETRY_DELAYS seconds between attempts (default "10 30 60"), and gives
# up at once on an error that won't go away by waiting: HTTP 400, 401, 404 or 422 (a bad request, bad credentials,
# nothing there, "already exists"). Everything else is retried: GitHub's 403 "Resource not accessible by
# integration" came and went on a release that the same workflow made fine minutes later (run 38046378533,
# v1.35), and 429 / 5xx are rate limits and outages. Its stderr is passed through; returns the last exit code.
retry() {
  _retry_log=$(mktemp)
  _retry_n=0
  _retry_code=0
  for _retry_wait in ${RETRY_DELAYS-10 30 60} last; do
    _retry_n=$((_retry_n + 1))
    if "$@" 2>"$_retry_log"; then
      cat "$_retry_log" >&2; rm -f "$_retry_log"; return 0
    else
      _retry_code=$?
    fi
    cat "$_retry_log" >&2
    if grep -qE 'HTTP (400|401|404|422)' "$_retry_log"; then
      echo "retry: $1 failed (attempt $_retry_n) with an error that waiting won't fix" >&2; break
    fi
    [ "$_retry_wait" = last ] && break
    echo "retry: $1 failed (attempt $_retry_n, exit $_retry_code): again in ${_retry_wait}s" >&2
    sleep "$_retry_wait"
  done
  rm -f "$_retry_log"
  return "$_retry_code"
}
