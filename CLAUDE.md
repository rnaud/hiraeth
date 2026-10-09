# Hiraeth: notes for Claude

A three.js exploration game called Hiraeth (the internal ids still say `moebius`), drawn in the style of Moebius, played in the browser
(GitHub Pages) and as an Android app (`android/`, Capacitor). Design lives in
`docs/game-brief.md` and `docs/story-bible.md`; how each system works in
`docs/systems/<topic>.md` (indexed in `docs/README.md`; superseded notes and old
measurements in `docs/archive/`). `README.md` stays short: what the game is,
running, testing, shipping.

## The changelog: update it with every user-visible change

- **Every commit that changes what a player sees or hears adds a line** to the
  newest entry of `src/changelog.js`. That file is the source: the game shows it
  (press N), and the Android release notes are built from its newest entry.
  Write it for players: plain words about what changed for them, no file names.
- **Then regenerate `changelog.md`** with `node scripts/changelog-md.mjs`, and
  commit both files together. `tests/changelog.test.js` fails if they differ.
- **Show what changed.** The interactive changelog (`changelog.html`, opened
  from What's new) shows each line's before/after pictures, numbers or a "how
  to see it" note. Give every new line one of them: a before/after pair from
  `scripts/changelog-shots.mjs` (or your own screenshots of the same view),
  before/after numbers for performance lines (device, preset), or a short note,
  in `src/changelog-media.js` with the files in `changelog-media/`. How, and the
  size limits: `docs/systems/changelog.md`.
- **A new version starts a new release.** Adding a new entry at the top
  (`{ v: '0.38', date: 'YYYY-MM-DD', items: [...] }`) makes the next push create
  a new GitHub release `v0.38`. Smaller follow-ups go into the current entry, and
  each push rebuilds that release (APK and web bundle) with a higher build number.
- **Bump the version often.** Start a new entry after every few significant
  features (a new system, a reworked world, a new screen), roughly every
  10–15 changelog lines, or whenever a batch of work lands. Never let one
  version collect dozens of changes: each version should read as one release
  a player can take in. Group the lines of a version by theme.
- Earlier entries are history: leave them as they were released.

## Working rules

- Before every commit that touches code, `.githooks/pre-commit` runs the unit tests
  the change reaches (`scripts/affected-tests.mjs`; `FULL_TESTS=1` runs them all;
  enabled by `npm install`, or `git config core.hooksPath .githooks`). The whole suite
  runs on GitHub (`.github/workflows/tests.yml`) and every deploy waits for it, so a
  red test on `main` stops the release. Run `npx vite build` too before committing;
  both must pass. Add tests for new systems and for bug fixes.
- Check visual changes in the running game (headless Chrome screenshots against
  a dev server). Never touch port 5173: that is the user's own dev server.
- Document new systems in a short section of the right `docs/systems/<topic>.md`
  (or a new file there, added to the index in `docs/README.md`); keep `README.md`
  short.
- Android: every push to `main` builds a signed APK and a web bundle and
  publishes them to the release for the newest changelog version. Installed apps
  update the game over the air (`web.json`). Bump `NATIVE_API` in
  `android/app/src/main/java/com/rnaud/moebius/WebBundles.java` whenever the
  Java bridge changes, so older apps are offered the new APK first. Keep the
  signing key backup in `.local-tools/android-signing/` (git-ignored); losing it
  means users must reinstall and lose their saves.
- Prompts are written in Xbox / PlayStation form (`A / ×`, `RT / R2`, `View`,
  `Menu`); `src/native-pad.js` rewrites them to Android handheld names, so keep
  that form when writing new prompts.
- Every dialogue line carries a tone (`'~sad~ …'` or `{ text, tone }`, see
  `src/story/tone.js`); `tests/tone.test.js` checks all of them.
