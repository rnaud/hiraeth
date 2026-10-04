# Memento: notes for Claude

A three.js exploration game called Memento (the repository and internal ids still say
`moebius`), drawn in the style of Moebius, played in the browser
(GitHub Pages) and as an Android app (`android/`, Capacitor). Design lives in
`docs/game-brief.md` and `docs/story-bible.md`; architecture, version by
version, in `README.md`.

## The changelog: update it with every user-visible change

- **Every commit that changes what a player sees or hears adds a line** to the
  newest entry of `src/changelog.js`. That file is the source: the game shows it
  (press N), and the Android release notes are built from its newest entry.
  Write it for players: plain words about what changed for them, no file names.
- **Then regenerate `changelog.md`** with `node scripts/changelog-md.mjs`, and
  commit both files together. `tests/changelog.test.js` fails if they differ.
- **A new version starts a new release.** Adding a new entry at the top
  (`{ v: '0.38', date: 'YYYY-MM-DD', items: [...] }`) makes the next push create
  a new GitHub release `v0.38`. Smaller follow-ups go into the current entry, and
  each push rebuilds that release (APK and web bundle) with a higher build number.
- Earlier entries are history: leave them as they were released.

## Working rules

- Run `node --test tests/*.test.js` and `npx vite build` before committing; both
  must pass. Add tests for new systems and for bug fixes.
- Check visual changes in the running game (headless Chrome screenshots against
  a dev server). Never touch port 5173: that is the user's own dev server.
- Document new systems in a short README section.
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
