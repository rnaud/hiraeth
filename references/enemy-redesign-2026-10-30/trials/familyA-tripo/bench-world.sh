#!/bin/sh
# Six of a kind in a real world against none, before (a commit) and after (this checkout), High and Handheld, two rounds
# alternating (the machine is shared): scripts/enemy-roster/bench.mjs, one JSON line a run, into <out.jsonl>.
#
#   PORT=5477 sh references/enemy-redesign-2026-10-30/trials/familyA-tripo/bench-world.sh <before-sha> <level> <kind@skin> <out.jsonl>
set -eu
BEFORE=$1; LEVEL=$2; FOE=$3; OUT=$4
SIX="$FOE,$FOE,$FOE,$FOE,$FOE,$FOE"
for round in 1 2; do
  for q in high handheld; do
    for who in before after; do
      for pack in none six; do
        P=$([ "$pack" = six ] && echo "$SIX" || echo "")
        C=$([ "$who" = before ] && echo "--commit $BEFORE" || echo "")
        while [ "$(uptime | sed 's/.*averages*: *//' | cut -d' ' -f1 | cut -d. -f1)" -gt 25 ]; do sleep 20; done
        # shellcheck disable=SC2086
        node scripts/enemy-roster/bench.mjs $C --quality "$q" --level "$LEVEL" --pack "$P" --seconds 8 \
          | sed "s/^{/{\"round\":$round,\"who\":\"$who\",\"pack\":\"$pack\",/" >> "$OUT"
      done
    done
  done
done
