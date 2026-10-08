---
name: playtest
description: Prepare and digest a playtest of Hiraeth with real people — a session kit (how to get the build, a facilitator script, an observation sheet for the first hour, questions to ask after), then turn the notes into findings beside the audits; plus the automated stand-in (the browser play-through). Use when asked to playtest, "watch people play", prepare a test session, or read playtest notes.
---

# The playtest

Every audit so far ranks the same thing first: nobody but the author has played the game. A
playtest answers what no reading of the code can:
- where people stop;
- what they skip;
- what they don't understand;
- whether they want to go on.

This skill prepares the session and digests it. The watching is done by the author. Write the kit to
`docs/playtests/<YYYY-MM-DD>-kit.md`, and the findings to `docs/playtests/<YYYY-MM-DD>.md`.

## 1. The kit

Read first: the newest `docs/audits/game-v*.md` (its open questions), the newest changelog entries
(what changed since the last playtest), and `docs/playtests/` (what the last one found).

Write the kit with these parts.

- **Who:** two or three people who have never seen the game, at least one of them not a gamer.
  Ideally one plays on a phone or handheld and one on a computer with a controller.
- **The build:**
  - the site's URL (from `docs/cloudflare.md`);
  - or the release's APK (`gh release view v<version>`);
  - a fresh profile: a private window, or a new install, so they meet the real first-time player path.
- **The facilitator's script, to read aloud:**
  > Play as you would at home. Think out loud: say what you're looking at, what you expect, what
  > surprises you. I can't help — if you're stuck, say so, and keep trying. Stop whenever you like.

  Don't touch the controller. Don't explain the story. Note the time when they ask for help.
- **The observation sheet:** one row per beat of the first hour, with columns for the time reached,
  what they did, and a quote. Take the beats from the current story (`src/story/desert-data.js`
  stages, the ship's prologue), for example:
  1. the title, then New game;
  2. control in the ship, and the first input;
  3. the nudge, if they idle;
  4. the voicemail;
  5. the crash, then stepping out;
  6. finding the first person;
  7. the city, then the chest (the backpack, the first shot);
  8. each errand;
  9. down the giant, the channel, the tank's fill;
  10. the bike, then the Hearth ride;
  11. the spark;
  12. back to the ship, then the galactic map.

  Add a row for every moment they stall more than 30 s, are confused, or laugh.
- **After, five questions:**
  1. What was the game about, in a sentence?
  2. When did you most want to keep going? And least?
  3. What did you not understand?
  4. Who do you remember, and why?
  5. Would you play the next world tonight?
- **Consent and privacy:** don't record faces or voices without asking. Keep only first names or
  initials in the notes. Delete the recordings after the findings are written.

## 2. The automated stand-in (not a substitute)

```sh
node scripts/playthrough-browser.mjs --out <scratch>/play
```

This is the new game, the prologue, the desert's landing, an old save resumed, and saving and
loading, in a muted headless Chrome. It also starts its own Vite server, never on 5173. It proves the
path works. It says nothing about whether people want to walk it.

If telemetry exists (opt-in, local-first progress events), summarise it the same way: where sessions
end, and the time to each beat.

## 3. The findings

From the filled sheets, write:
- **The headline:** did they reach the end of the first hour? Where did each one stop or slow down?
- **A table:** each beat, with each tester's time, stalls and quotes.
- **The problems:** each one with the moment, how many testers hit it, the likely cause (file or
  system) and a suggested fix. Rank by how many hit it and how early it is.
- **Surprises:** what they loved, what they ignored, and what they did that nobody planned for.
- **What it changes in the audits' rankings:** confirm or overturn the guesses in
  `docs/audits/game-v*.md`.

Add the folder to `docs/README.md` the first time. Offer the fixes as work; don't start them unasked.

## Rules

Every automated run is muted and never on port 5173. Never ship telemetry that isn't opt-in and
local-first, and say in the game what it collects.
