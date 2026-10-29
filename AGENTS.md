# Hiraeth project instructions

A three.js exploration game called Hiraeth, drawn in the style of Moebius, played in the browser
(GitHub Pages) and as an Android app (`android/`, Capacitor). Design lives in
`docs/game-brief.md` and `docs/story-bible.md`; how each system works in
`docs/systems/<topic>.md` (indexed in `docs/README.md`; superseded notes and old
measurements in `docs/archive/`). `README.md` stays short: what the game is,
running, testing, shipping.

These are the canonical project rules for Codex and other coding agents. Read the applicable local handoff and `.local-tools/handoff/agent-rules.md` when resuming delegated work. The user’s current instructions take precedence over older handoff notes.

## The changelog: update it with every user-visible change

- **Every commit that changes what a player sees or hears adds a line** to the
  newest entry of `src/changelog.js`. That file is the source: the game shows it
  (press N), and the Android release notes are built from its newest entry.
  Write it for players: plain words about what changed for them, no file names.
- **Then regenerate `changelog.md`** (and `src/version.js`) with `node scripts/changelog-md.mjs`, and
  commit them together. `tests/changelog.test.js` fails if they differ.
- **Visual changes need actual pictures.** For a change to a model, outfit, room, world,
  lighting, camera framing or screen layout, attach reviewed screenshots from the running
  game to its changelog line. A “how to see it” note alone does not satisfy this requirement.
  Use comparable before/after views where available; otherwise mark an honest after-only
  view. Never use a concept reference as evidence of the implemented result or invent a
  before picture. Keep the capture source, game revision and limitations in `from`/`view`.
- Put the pictures in `changelog-media/` and register them in `src/changelog-media.js`.
  Keep the existing size limits and site-only packaging. Performance lines need measured
  numbers with device and preset; sound or behavior that a still picture cannot demonstrate
  needs a clear “how to see it” note (plus a useful picture when available).
  See `docs/systems/changelog.md`. Check the interactive page and inspect every new image
  before committing; a successful asset-generation command is not visual review.
- **A new version starts a new release.** Adding a new entry at the top
  (`{ v: '0.38', date: 'YYYY-MM-DD', items: [...] }`) makes the next push create
  a new GitHub release `v0.38`. Smaller follow-ups go into the current entry, and
  each push updates its web/content release with a higher build number. Native installers are built on request; Unity Android/Linux also builds daily when relevant inputs changed.
- **Bump the version often.** Start a new entry after every few significant
  features (a new system, a reworked world, a new screen), roughly every
  10–15 changelog lines, or whenever a batch of work lands. Never let one
  version collect dozens of changes: each version should read as one release
  a player can take in. Group the lines of a version by theme.
- Earlier entries are history: leave them as they were released.

## Working rules

- Visual references always use **Midjourney in the visible internal Codex browser**. Generate options
  there for the user to heart/favourite; wait for their selections before downloading, saving into the
  repository or integrating. Do not substitute another image generator unless explicitly requested.
- Before every commit that touches code, `.githooks/pre-commit` runs the unit tests
  the change reaches (`scripts/affected-tests.mjs`; `FULL_TESTS=1` runs them all;
  enabled by `npm install`, or `git config core.hooksPath .githooks`), except the few long
  end-to-end files in `tests/hook-deferred.json`, which it leaves to GitHub (`RUN_DEFERRED=1`
  runs them locally). GitHub runs every selected file, those included, using
  the same dependency selector on the complete unverified change range; unknown dependencies
  fail closed. The full gameplay and tool suites run daily and can be run manually.
  Automatic web deploys wait for the exact commit’s selected test gate; never bypass a failure. Run `npx vite build` too before committing;
  both must pass. Add tests for new systems and for bug fixes.
- Check visual changes in the running game using the browser tools available in the session.
  Never touch port 5173: that is the user’s own dev server. Use a separate port in 5400–5499.
  Follow the silent-review rules below before any playback.
- Document new systems in a short section of the right `docs/systems/<topic>.md`
  (or a new file there, added to the index in `docs/README.md`); keep `README.md`
  short.
- Releases: only web and compatible game-content bundles publish automatically after tests.
  Android, Steam Deck and Xbox native installers are manual workflows; Unity Android/Linux
  also builds daily if relevant inputs changed since its last successful build. Existing
  apps update game content over the air (`web.json` / `unity.json`); native bridge changes
  require a separately requested compatible installer. Bump `NATIVE_API` in
  `android/app/src/main/java/com/rnaud/hiraeth/WebBundles.java` whenever the
  Java bridge changes, so older apps are offered the new APK first. Keep the
  signing key backup in `.local-tools/android-signing/` (git-ignored); losing it
  means users must reinstall and lose their saves.
- Keep the Unity version (`unity/`, the same game code through `engine/`) at parity: a change to
  what the game does or shows also works in Unity, checked there (`docs/systems/engine-bridge.md`),
  or says "web only" and why in its commit message.
- Prompts are written in Xbox / PlayStation form (`A / ×`, `RT / R2`, `View`,
  `Menu`); `src/native-pad.js` rewrites them to Android handheld names, so keep
  that form when writing new prompts.
- Every dialogue line carries a tone (`'~sad~ …'` or `{ text, tone }`, see
  `src/story/tone.js`); `tests/tone.test.js` checks all of them.

## Download hygiene

- Use task-specific temporary folders for downloads and intermediate exports. If a browser
  saves into `~/Downloads`, immediately move the task’s identified files into its temporary
  folder. Preserve accepted source assets in the project. Do not remove unrelated user files.

## Silent browser review

- Keep cinematics and game previews muted when opening, replaying or testing them in the
  internal browser. Verify music, effects and dialogue are muted before playback; a “Sound
  off” label alone is insufficient. Only unmute when the user explicitly asks to hear a preview.
- Apply review mute when constructing the audio system, before world loading can start
  playback. Verify reloads with an audible saved gameplay preference; a later playback hook
  or temporary progress store cannot prevent startup sound.

## Reference review

- Keep Midjourney in the visible internal Codex browser, never the user’s external Chrome
  windows. Leave the tab open for the user to review and heart/favourite options.
- Wait for their selections before downloading or saving reference images into the repository
  or integrating them into the game. An explicit request to use another generator overrides
  the default Midjourney choice, but does not imply approval of unselected references.

## Coordination and handoff

- Use an isolated worktree for implementation. Preserve the author’s changes in the shared
  main checkout; never switch or pull it as part of delegated work.
- Delegated agents commit on their branches and report the commits, checks and picture paths;
  the coordinating agent handles integration and publishing within the user’s authorization.
- Keep test concurrency at 2 while sharing this machine and wait when load exceeds 25.
  Serialize Unity builds using the handoff’s build lock. Clean up only your own preview
  servers, temporary browser profiles and intermediate files.
- Once a branch's work is on main, delete its worktree (`git worktree remove`, after checking it
  has no uncommitted or unpushed work and no process still has files open in it). Keep the branch;
  move anything git-ignored but unique (downloaded sources, keys) somewhere safe first.
- Before committing, run `node scripts/bridge-gaps.mjs` and
  `node --test tests/reference-paths.test.js` as well as the normal hook and build.
- Do not disable hooks or bypass failed tests to ship. Do not type or print secrets from `.env`.
- Follow the current handoff’s device restrictions. Waking/unlocking a locked Retroid is
  manual: ask the user. Do not change device settings, saves or volume for a review.
