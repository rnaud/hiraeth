---
name: game-audit
description: Audit Hiraeth as a game (not its code) against the twelve themes of docs/what-makes-a-great-game.md, score it, compare it with the last audit, and say where to invest next. Use when asked to "audit the game", "rerun the audit", "review the game against what makes a great game", or "where should we invest".
---

# The game audit

An audit of what a player experiences, against the research in `docs/what-makes-a-great-game.md`. It is
not a code review and not a bug hunt: bugs count only where a player meets them. Each audit is one file,
`docs/audits/game-v<version>.md`, compared with the one before it.

## 1. Read before looking

- `docs/what-makes-a-great-game.md`: the twelve themes, their principles and their audit questions.
- The latest game audit in `docs/audits/` (`game-v*.md`): its scores, findings and "Where I would invest" list.
- The changelog since that audit's version (`src/changelog.js`, newest first), `TODO.md` and `DONE.md`.
- The design: `docs/game-brief.md`, `docs/world-principles.md`, `docs/fun-and-story-review.md`.

The version being audited is `CHANGELOG[0].v`. If a file for it already exists, the audit replaces it,
having said so in its intro.

## 2. Gather evidence (parallel, read-only)

Send two or three Explore agents at once, each given **the previous audit's findings for its themes to
recheck one by one** (fixed, partly, not, or worse), with file:line evidence:

1. **Story, progression, pacing:** themes 1, 4, 5 and 6. This covers the route and ending rules, quests,
   choices, moments, collectibles, the detour worlds, and the time to the first fluid moment.
2. **Feel, UX, senses, quality:** themes 2, 3 and 7–12. This covers onboarding, wayfinding, the HUD and
   menus, audio, combat, settings and accessibility, localisation, performance numbers, tests, and
   sharing and discovery.

Tell every agent: read-only, report under 1,500 words, and never run the game unmuted.

Meanwhile, look at the game yourself:

```sh
node .claude/skills/game-audit/capture.mjs <scratchpad>/audit-shots
```

The script captures the default plan: a first-time player's title, a new game idling for about 70 s,
settings, six worlds, Home, the finale and the Arena. Add a plan file for anything new since the last
audit. Read every picture, and read `report.json` for page errors and boot times.

**Rules for any run:** always muted (the script uses `--mute-audio` and the game's own mute), never
port 5173 (the author's dev server; the script uses `PORT`, default 5490), and never play audio aloud.
Judge sound by its code and docs, never by listening.

## 3. Score

- Score each theme from 1 to 5 against its audit questions. **Every score needs evidence:** a file and
  line, a capture, a measured number. If you can't point at it, don't claim it.
- **Weighted score:** themes 3–8 count double, then divide by 18. Show it next to the previous audit's
  score.
- **For each item on the last audit's "Where I would invest" list:** done, partly done, or not done,
  with what changed.
- **Name what nobody has verified.** For example, anything only tested in node, never played, never
  heard, or never run on a device. A playtest with real players outranks every other finding. Say if
  there has been none since the last audit.

## 4. Write `docs/audits/game-v<version>.md`

Use the same shape as the earlier audits:

- **An intro:** the version, the date, where the evidence came from, and what wasn't verified.
- **The score table:** each theme's score, the previous score, and a one-line verdict.
- **The weighted total.**
- **What changed since the last audit:** its investment list, item by item.
- **One section per theme:** what's strong, what's weak, and the evidence.
- **"Where I would invest", ranked by value per hour of work.** Give each item a cost, and say why.
  End with what not to invest in.

Write in the repository's plain style (`docs/`): short sentences and British spelling. Leave earlier
audits as they were written. Add the new file to `docs/audits/` in the `docs/README.md` index line.

An audit is documentation only: no changelog line, no code changes. Commit it if asked, after
`node --test tests/*.test.js` and `npx vite build` pass, as for any commit (CLAUDE.md).

## 5. Tell the user

- the weighted score, against the last audit's;
- the biggest movements up and down;
- the top three investments;
- what was not verified.

Then offer the investments as work to do; don't start them unasked.

## Refreshing the research

The framework itself (`docs/what-makes-a-great-game.md`) changes rarely. Refresh it, with web research
and dated sources, only when asked, or when it is more than a year old.
