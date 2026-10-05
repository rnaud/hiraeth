# Cloudflare Workers deployment

The browser game can be served independently of GitHub Pages by an assets-only
Cloudflare Worker named `memento`, at
https://memento.alexandria-rnaud.workers.dev/. It publishes the same Vite `dist/` build as
Pages; no application server, database, or Cloudflare Vite plugin is needed.
The game, character studio, Motion page, models, and other assets ship together.
Only `dist/` is uploaded, not the repository or its history.

## One-time account setup

1. In Cloudflare, select the account that should own `memento`. Check that the
   name is not already used by another application in that account.
2. Create an API token for GitHub Actions, scoped to that account, with
   **Account → Workers Scripts → Edit**. Cloudflare's **Edit Cloudflare Workers**
   template can be used as a starting point; DNS/zone permissions are unnecessary
   for the default `workers.dev` address. Do not use a Global API Key.
3. In this repository's **Settings → Secrets and variables → Actions**, add
   `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as repository secrets.
   The token belongs only in the secret store, never source or release notes.
4. Push the workflow to `main`, or run **Deploy to Cloudflare Workers** manually
   on `main`. The deployment output reports the `workers.dev` URL. A manual run
   on another branch is skipped to protect the production deployment.

The workflow installs the lockfile's Wrangler version, runs the test suite,
builds the game, deploys, and checks every published file against the build. Cloudflare uses its own deployment concurrency
group; Pages and the Android/Steam Deck release workflows continue independently.
An absent secret causes a clear failure instead of a silently skipped deploy.
A browser dashboard login alone does not authenticate GitHub Actions.

## Local commands

```sh
npm ci
npm run check:cloudflare                 # build + deployment dry run; no upload
npm run dev:cloudflare                   # build + local Worker at localhost:8787
npm run check:deployment -- http://localhost:8787/
```

For a manual live deployment, run `npx wrangler login` and then
`npm run deploy:cloudflare`. If you have multiple Cloudflare accounts, set
`CLOUDFLARE_ACCOUNT_ID` in your shell to select the intended account.
Do not use the interactive login's credentials as a CI token.

After deploying, run `npm run check:deployment -- https://YOUR-WORKER-URL/`
against the same build. This checks every built file against the served bytes,
the root document, and a missing asset's 404 response. The three HTML entry
points use Cloudflare's normal canonical redirects (`studio.html` to `studio`,
for example). There is deliberately no SPA catch-all: a missing GLB or JavaScript
file must not return `index.html` with a misleading success status.

`wrangler.jsonc` is the deployment configuration. Change its `name` only when
intending to deploy a different Worker. A custom domain can be attached later;
no domain or DNS record is changed by this target. If the Worker name or
account changes, update the verification URL in the workflow as well. The compatibility date is
pinned to a date supported by the checked-in Wrangler version.

## Before making GitHub private

The public Worker serves uploaded assets without fetching anything from GitHub
at request time. GitHub Actions can still check out this private repository and
publish using the repository's Actions secrets. Keep Actions enabled and ensure
the account has the required private-repository Actions allowance.

This target moves **browser hosting** only. The Android updater still reads
GitHub release manifests and APK/web bundles; the Steam Deck installer and
updater also use GitHub Releases. Those URLs will no longer be anonymously
accessible after the repository becomes private. Move the release files and
feeds to public storage (for example R2) and ship clients with the new URLs
before changing visibility. Never put a private GitHub token in a game client.

Saves are stored per browser origin. The Cloudflare address does not inherit
saves from `rnaud.github.io`. There is no save-transfer UI today; keep the old
address available for existing players until a separate migration is provided.
The repository's visibility and existing Pages target are unchanged here.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/),
[GitHub Actions deployment](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/),
[HTML routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).
