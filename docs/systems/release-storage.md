# Large release files in R2

Cloudflare R2 bucket `hiraeth-assets` stores large release files independently of
Worker static assets. `RELEASE_ASSETS` binds it to the `hiraeth` Worker. The bucket
stays private: no public development URL, custom domain or bucket listing is
needed. The Worker exposes only `/updates/steam-deck.json` and the numbered
`/updates/steam-deck-<build>.tar.gz.<nnn>` parts. Other objects remain private until
an explicit serving route is added.

Existing Deck installations keep their current URLs and multipart format. The
Worker streams R2 bodies, supports HEAD and single byte ranges, and gives the
manifest `no-cache` while immutable numbered parts can be cached for a year.
Conditional reads prevent inconsistent headers if a manifest changes mid-request.
This hosting change does not alter Unity or the native launcher.

## Provision and migrate before deploying

1. Enable R2 in the Cloudflare account that owns `hiraeth`. Select Standard storage.
2. Authenticate Wrangler to that account and create `hiraeth-assets`:
   `npx wrangler r2 bucket create hiraeth-assets`.
3. The Actions deployment token needs **Workers R2 Storage Bucket Item Read**
   and **Write**, restricted to `hiraeth-assets`, in addition to its existing
   Worker permissions. Bucket creation is a separate account setup action.
   Keep the token value in the existing `CLOUDFLARE_API_TOKEN` Actions secret.
   Set the non-secret token ID as the `CLOUDFLARE_API_TOKEN_ID` Actions variable.
   The uploader uses S3 and derives its secret in memory from the token value;
   bucket-only permissions do not work with Wrangler's REST object commands.
   See [R2 authentication](https://developers.cloudflare.com/r2/api/tokens/).
4. Dispatch **Deploy to Cloudflare Workers** with `migrate_deck_runtime=true`.
   This migration-only job can run on the migration branch before it reaches main.
   It runs `node scripts/r2-deck.mjs --migrate` on GitHub's runner, downloads the
   currently published runtime, verifies its size and SHA-256,
   uploads immutable parts, reads them back, and publishes the manifest last.
   It never builds or deploys the site, even if dispatched on main. A failed
   migration must be repaired before deploying the R2 binding/routes.
5. Deploy through the normal exact-commit Tests gate. Verify the public
   manifest and download all its parts, checking the full size and SHA-256.
   Also check HEAD and a byte range. Only then is the migration complete.

## Later publications

Automatic web deployments do not read, copy, upload or require the Deck runtime.
An explicit Cloudflare workflow dispatch with `build_deck_runtime=true` packages
a runtime, runs `node scripts/r2-deck.mjs --from dist/updates`, then removes those
files from the static deployment. The existing `cloudflare-production` concurrency
group serializes these publications. Do not run a local publisher concurrently.
The separate Steam Deck workflow continues to publish GitHub installer releases.

The publisher rejects a lower build number, conflicting bytes at an immutable
part name, and failed upload readbacks. It verifies the complete source archive
before writing anything. Old runtime builds remain in R2 so downloads already
in progress can finish. There is no automatic deletion or retention policy yet;
review usage before adding many large releases. The old runtime is preserved
until every part of a replacement is readable.

R2 is the destination for future large release assets too, but web/Unity content
updates, music and reference pictures currently retain their existing storage.
The bucket itself needs no redeployment when a new object is uploaded.

References: [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/).
