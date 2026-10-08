---
name: ship-release
description: Commit and push Hiraeth to main the way CLAUDE.md asks — changelog line in players' words (and when to start a new version), changelog.md regenerated, pictures/numbers/notes for each line, NATIVE_API when the Java bridge changes, tests and build, main merged first, then push and one look at the release jobs. Use whenever asked to "commit", "push", "ship", "release" or "merge and push".
---

# Shipping a change

A push to `main` builds and publishes a release: a signed APK, the web bundle and the Deck package
for the newest changelog version. Installed apps update over the air. So a push is something players
receive. These steps keep it correct.

## 1. What goes in

- `git status --short` and `git diff --stat`. Know every file in the commit.
- **Stage by name, never with `git add -A`,** when other work shares the checkout: an agent's pictures,
  a half-done change. Then check `git diff --cached --name-only` before committing. A file staged
  earlier rides along with any commit. That has already happened once: an audit move went out inside
  a pictures commit.
- **Scratch never goes in:** screenshots, `.scratch/`, raw benchmark JSON, downloaded assets that
  aren't the shipped ones.

## 2. The changelog (CLAUDE.md, "The changelog")

**Does a player see or hear the change?** If yes, add a line at the end of the newest entry of
`src/changelog.js`:
- in plain words for players;
- no file names;
- no spoilers: the story's late beats are described, never named.

Docs, tests and tools get no line.

**A new version?** Start a new entry at the top (`{ v, date, items }`) after a batch of significant
features, or after about 10–15 lines. Group a version's lines by theme, with `//` comments. Earlier
entries are history: never edit them. Versions compare by number (`src/updates.js`), so `1.0` follows
`0.99`.

**Show each line** in the interactive changelog (`docs/systems/changelog.md`):
- a before/after pair, taken with `scripts/changelog-shots.mjs` at the line's commit and its parent;
- numbers for performance or size (before, after, device, source);
- or a `see` note saying where to see it.

Spoiler beats get a note, never a picture. Pictures stay site-only: at most 150 KB each, 260 KB a
pair, 60 MB for the folder.

Then:
```sh
node scripts/changelog-md.mjs
node --test tests/changelog.test.js tests/changelog-media.test.js
```

## 3. Platform rules

- **The Java bridge changed** (`android/app/src/main/java/**`)? Bump `NATIVE_API` in `WebBundles.java`,
  so older apps are offered the new APK first.
- **New big assets:** decide where they live. The devices carry only what they need.
  `scripts/site-only.mjs` lists what the site alone serves (the reference sheets, the changelog
  pictures). The over-the-air zip, the APK and the Deck package all respect it.
- **Prompts** are written in Xbox / PlayStation form. A line that teaches a control uses `{key:verb}`,
  never a button name in prose (`tests/key-placeholder.test.js`).
- **Every dialogue line keeps its `~tone~`.**

## 4. Test, merge, test

1. **Run** `node --test tests/*.test.js` and `npx vite build`. Both must pass.
   - The pre-commit hook runs the tests too. Skipping it (`-c core.hooksPath=/dev/null`) is only for
     a commit already tested, or for docs only.
   - When other uncommitted work shares the checkout, test a clean copy of the commit instead:
     ```sh
     git archive HEAD | tar -x -C <scratch>/clean
     ln -s "$PWD/node_modules" <scratch>/clean/node_modules
     ```
     Then run the tests there.
2. **Fetch:** `git fetch origin`. If `origin/main` has moved, merge it (in an app-made worktree, the
   `sync_with_base_branch` tool where it's allowed; otherwise `git merge origin/main`). Resolve any
   conflicts, regenerate `changelog.md`, and run the tests again, or at least the ones the merged
   files touch.
3. **Commit:** a message saying what changed for players, then the attribution line the session gives.

## 5. Push and look once

```sh
git push origin HEAD:main
```

If the push is refused, fetch, merge and test again. Never force-push `main`.

**Look once:** `gh run list --branch main --limit 4`. It should show the Cloudflare deploy, the Android
release and the Steam Deck release started for the commit. Don't poll: report that they started, and
check later only if asked. The APK's size is on the release: `gh release view v<version>`.

## 6. Tell the user

- the commit or commits, and what they hold;
- the version they ship as;
- the test result;
- what wasn't verified (played, heard, on a device);
- how to revert: `git revert -m 1 <merge>` for a merge, `git revert <sha>` otherwise.

Never push what the user hasn't asked to ship.
