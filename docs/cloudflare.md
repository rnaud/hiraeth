# Cloudflare Workers deployment

The browser game is served by a Cloudflare Worker named `hiraeth`, at
https://hiraeth.alexandria-rnaud.workers.dev/. It publishes the Vite `dist/` build; a small Worker streams large update archives, while normal game files use static asset serving.
The private analytics dataset uses a SQLite Durable Object; no Cloudflare Vite plugin is needed. The game, character
studio, Motion page, models, and other assets ship together. Only `dist/` is uploaded,
not the repository or its history.

Next to the game the same deploy publishes the game's **content updates**, read by the
Android app and the Steam Deck updater:

| URL | What |
| --- | --- |
| `/updates/web.json` | the manifest: `version`, `build`, `sha256`, `zip`, `size`, `notes`, `minNative` (the Android bridge the game needs, `WebBundles.WEB_MIN_NATIVE`), `minDesktop` (the Deck runtime it needs, `DESKTOP_API` in `desktop/main.mjs`) |
| `/updates/web-<build>.zip` | this build's `dist/` (without `updates/`), deterministic: the same build gives the same bytes |
| `/updates/web-<previous>.zip` | the previous build's zip, fetched from the live site before deploying and checked against the live `web.json`, so a device that read the old manifest a moment ago can finish its download |
| `/updates/steam-deck.json` | the Steam Deck runtime (Electron, `main.mjs`, `deck.py`, a packaged game): `build`, `version`, `sha256`, `size`, `key`, `parts` (`scripts/deck-runtime.mjs`, read by `deck.py`) |
| `/updates/steam-deck-<build>.tar.gz.<nnn>` | its package in 20 MiB parts, stored in R2 independently of the web deploy. A manual dispatch with `build_deck_runtime=true` packages and verifies a new runtime |

`scripts/web-update.mjs` writes the content updates into `dist/updates/` after the build.
The Deck runtime lives in the private R2 bucket `hiraeth-assets`, exposed by the Worker
at its existing URLs. Ordinary deploys never copy it. See [release storage](systems/release-storage.md)
for provisioning, migration and publication. The build number
is `node scripts/release-info.mjs build`, the commit count up to HEAD, the same in every
workflow: the APK's versionCode and the Deck package's game get the same number from the same
commit, so a device compares a downloaded bundle with the one it carries. It needs the whole
history (`fetch-depth: 0`) and refuses a shallow clone.

**One deploy owns the site.** A Workers deploy replaces every asset, so only
`cloudflare.yml` deploys the Worker; the Android and Steam Deck workflows publish to GitHub
releases only. The workflow is never cancelled once started. Its concurrency group waits for
the run before it. After verifying the public deployment, it records the exact web source/build in
the version’s GitHub release notes. Existing installer assets remain intact; a new web-only release
does not replace the native updater’s latest APK release (`scripts/web-publish.sh`).

**Limits** (Workers static assets, [limits](https://developers.cloudflare.com/workers/platform/limits/)):
25 MiB per file and 20,000 files per version on the free plan. `web-update.mjs` checks the whole
site against them before deploying. With recorded soundtracks the content zip exceeds this limit. Archives above 20 MiB
are stored as `web-<build>.zip.<nnn>` parts plus a `.zip.json` index.
`worker/update-download.js` streams those parts at the unchanged `.zip` URL, with
HEAD and single byte-range support for download resumption. It never buffers the entire
archive. Whole parts are piped natively into a `FixedLengthStream`, never copied chunk by chunk
in JS: that ran out of the free plan's Worker CPU and silently cut downloads short (without a
fixed length Cloudflare also drops `Content-Length`, so the cut looked like a complete file).
Only the first and last parts of a byte range are sliced in JS. Both current and previous archives use this format; small archives stay static.
The manifest still describes the full zip, including its original size and SHA-256.

**The recorded themes** (`music/*.mp3` but the desert's, 99 MB) are not in the content zip: the games on
devices download them from the site once and keep them (`docs/systems/audio.md`, "The themes on a device").
They are another origin's requests, so `public/_headers` gives `/music/*` an `Access-Control-Allow-Origin: *`
(Workers static assets read `_headers`; the devices never carry it). `OTA_MUSIC=1 node scripts/web-update.mjs`
puts the themes back in the zip for one hand-over update (`docs/systems/android.md`, "The music, downloaded once").
A deploy only uploads files whose contents changed, so the previous zip costs nothing.

**The site's own files** (never in the zip, the APK, the Deck or the Xbox package: `scripts/site-only.mjs`): the
changelog's pictures (`changelog-media/`, copied in after the content update), the audits page's data
(`audits/`) and the references page's index, thumbnails and web-size copies (`references/`, ≈ 70 MB, 1,111 files:
`node scripts/references-site.mjs dist`, from `.cache/references-site/` kept by `actions/cache`;
`docs/systems/references.md` "On the site"). `npm run check:deployment` fetches every file eight at a time.

**The rename (issue #130, v1.54).** The Worker was named `memento` until v1.54
(https://memento.alexandria-rnaud.workers.dev/). `wrangler deploy` makes the `hiraeth` Worker on its first run
(its Durable Object and rate limits with it); the old one is left as it was and no longer updated, so the apps
and Deck installs that read their updates from it keep their last build. The Notes page's secrets don't move
with a Worker: they go up with the deploy from the repository's secrets (`HIRAETH_ISSUES_TOKEN`,
`HIRAETH_NOTES_PASSWORD`, [notes.md](systems/notes.md)), or are set on the new Worker by hand. The old Worker
can be deleted in the dashboard once nothing needs it.

## One-time account setup

The private [Notes page](systems/notes.md) uses this same Worker for `/api/notes/*`, backed by GitHub
Issues. Its GitHub token and notebook password are separate Worker secrets; see that page for setup.
They are not needed to serve the game or its updates. Without them the notebook stays closed.
Its screenshot drafts live in a SQLite Durable Object (`NotesDrafts`, binding `NOTES_DRAFTS` in `wrangler.jsonc`),
created by `wrangler deploy` from the migration there; nothing to set up by hand.

1. In Cloudflare, select the account that should own `hiraeth`. Check that the
   name is not already used by another application in that account.
2. Create an API token for GitHub Actions, scoped to that account, with
   **Account → Workers Scripts → Edit**, plus **Workers R2 Storage Bucket Item Read/Write**
   restricted to the `hiraeth-assets` bucket. Cloudflare's **Edit Cloudflare Workers**
   template can be used as a starting point; DNS/zone permissions are unnecessary
   for the default `workers.dev` address. Do not use a Global API Key.
3. In this repository's **Settings → Secrets and variables → Actions**, add
   `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as repository secrets.
   The token belongs only in the secret store, never source or release notes.
4. Push the workflow to `main`, or run **Deploy to Cloudflare Workers** manually
   on `main`. The deployment output reports the `workers.dev` URL. A manual run
   on another branch is skipped to protect the production deployment.

The workflow installs the lockfile's Wrangler version, builds the game
and its content update, deploys, and checks every published file (the update included)
against the build. An absent secret causes a clear failure instead of a silently skipped
deploy. A browser dashboard login alone does not authenticate GitHub Actions.

## Local commands

```sh
npm ci
npm run check:cloudflare                 # build + update + deployment dry run; no upload
npm run dev:cloudflare                   # build + update + local Worker at localhost:8787
npm run check:deployment -- http://localhost:8787/
```

For a manual live deployment, run `npx wrangler login` and then
`npm run deploy:cloudflare` (it builds, adds `updates/` with the previous zip, and deploys:
never `wrangler deploy` on a bare build, which would take the updates off the site). If you
have multiple Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID` in your shell to select the
intended account. Do not use the interactive login's credentials as a CI token.

After deploying, run `npm run check:deployment -- https://YOUR-WORKER-URL/`
against the same build. This checks every built file against the served bytes,
the root document, and a missing asset's 404 response. The three HTML entry
points use Cloudflare's normal canonical redirects (`studio.html` to `studio`,
for example). There is deliberately no SPA catch-all: a missing GLB or JavaScript
file must not return `index.html` with a misleading success status.

`wrangler.jsonc` is the deployment configuration. Change its `name` only when
intending to deploy a different Worker. A custom domain can be attached later;
no domain or DNS record is changed by this target. If the Worker name or account
changes, the update address changes too: it is built into the Android app
(`WebBundles.MANIFEST`), the Deck updater (`deck.py` `CONTENT_URL`) and
`web-update.mjs` (`SITE`), so keep the old address serving until devices have an
app that reads the new one. The compatibility date is pinned to a date supported
by the checked-in Wrangler version.

## Making the repository private

**Done on 2026-10-07**: the repository is private, the steps below were followed and the workflow
clean-up under "After the flip" is in. Kept as a record. The repository went public again on
2026-10-08 and `deploy.yml` publishes the site to GitHub Pages once more (the site only: the
updates stay on the Worker).

The Worker serves uploaded assets without fetching anything from GitHub at request
time. GitHub Actions can still check out a private repository and publish with its
Actions secrets: keep Actions enabled and check the account's private-repository
Actions minutes. Never put a GitHub token in a game client.

What stays on GitHub releases, and is then only for the author (logged in): the APK
(`latest.json` and `hiraeth-v<version>.apk`) and the Steam Deck runtime package
(`steam-deck` release). Browser saves are per origin: the Cloudflare address does not
inherit saves from `rnaud.github.io`, and GitHub Pages stops serving a private repository
on a free plan.

### Before the flip: what must have reached the devices

1. **Merge and push this change.** `cloudflare.yml` publishes `/updates/web.json` (check
   it: `curl https://hiraeth.alexandria-rnaud.workers.dev/updates/web.json`). The Android
   workflow publishes the NATIVE_API 5 APK (versionCode now the commit count, above 117)
   with `latest.json` `native: 5`, and still a GitHub `web.json` for older apps. The Steam
   Deck workflow publishes a runtime whose `deck.py` reads the site.
2. **Every Android device: install the NATIVE_API 5 APK.** Apps from before offer it at
   launch (the dialog), or *Get the new app* in the settings, or install the APK by hand.
   Afterwards the settings' *Details* log shows `checking: launch` and the build found on
   the site. An app left at NATIVE_API 4 stops getting updates at the flip; it keeps
   playing the game it has.
3. **Every Steam Deck: launch the game twice.** The first launch downloads the new runtime
   in the background (from GitHub, by today's updater), the second runs it; from then on
   `~/.local/share/hiraeth-deck/update.log` shows `game: …` lines and `web/<build>/`
   appears after the next push. A Deck that misses this keeps playing its game; it can be
   updated by hand later (`deck.py --from`, `docs/steam-deck.md`).
4. **Browser players**: tell them the address changes to
   https://hiraeth.alexandria-rnaud.workers.dev/ and that browser saves don't move.

### After the flip: remove from the workflows

- `.github/workflows/android.yml`: the step **Web bundle for older apps** (marked
  `TRANSITION`) and, in **Publish the release**, the web zip and `web.json` from the
  uploads and the `gh release create` call, and the `web-zips` cleanup loop
  (`tests/android-ota.test.js` "the workflow publishes the web zip…" checks those lines:
  update it with them). Keep the APK and `latest.json`.
- `.github/workflows/deploy.yml` (GitHub Pages): delete it; Pages can't serve a private
  repository on a free plan. Update the README's *Play it* line.
- Nothing to change in the apps: they already read the site; the APK check fails quietly.
- Optional, later: once no device below NATIVE_API 5 is left, `WEB_MIN_NATIVE` may follow
  `NATIVE_API` again when the web side relies on a bridge change.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/),
[GitHub Actions deployment](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/),
[HTML routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/),
[limits](https://developers.cloudflare.com/workers/platform/limits/).

## Gameplay analytics

The same Worker receives `/api/analytics/events` from web, Android and Linux.
Its additive SQLite migration creates one combined dataset; `/analytics` uses
the existing notebook login for private reports. No vendor SDK keys or new
account are needed. See [analytics.md](systems/analytics.md) for retention,
budgets, metric definitions and native-installer requirements.
