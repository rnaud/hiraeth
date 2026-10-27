# Gameplay analytics

Hiraeth owns its analytics: web, Unity Android and Unity Linux send the same
versioned event envelope to `/api/analytics/events` on the existing Cloudflare
Worker. One SQLite Durable Object (`ANALYTICS`, instance `hiraeth-v1`) holds the
combined dataset. There are no GameAnalytics SDKs or ingestion keys. No new
Google/Firebase project or paid subscription is required by this implementation.

Sharing is on by default at the author's request. **Share gameplay statistics**
in Settings persists an opt-out on the device, including Unity. Turning it off
aborts outstanding client requests and clears unsent events. It cannot retract
requests already received. Turning it off does not delete historical data.

## Events and boundaries

The pure `src/analytics/events.js` vocabulary and `protocol.js` wire validation
import no game registries. Gameplay systems publish through their existing bus;
platform adapters subscribe with `trackSession`.

| Event | Meaning | Value |
| --- | --- | --- |
| Progression World | Start at world entry; Complete when its authored completion flag becomes true | none |
| Progression Quest | Start at first stage; Complete/Fail at terminal stage | none |
| Progression Minigame | Start per attempt; Complete/Fail on result | rounded score when available |
| Story progress | Snapshot of the active save at play/resume and main-story milestones | model 1, completed route-world count, four milestone bits; server-derived percent |
| Loading World | Entry-point setup to world-ready, before waiting on title selection | milliseconds |

Only authored short identifiers, finite numeric results, game build, platform,
random installation/session/event IDs and event times are accepted. Extra fields
are stripped on the client and server. No saves, dialogue, screenshots, player
text, exact coordinates, accounts, advertising IDs, IP addresses or user-agent
strings are stored in the analytics database. Network infrastructure still
processes IP addresses; these are pseudonymous statistics, not anonymity.

Installation means one browser profile or native installation, not a person.
Web origins have separate browser storage. We do not join identities across
platforms. Sessions expire after 30 minutes without a recorded gameplay event;
they are activity sessions, not measured playtime. No heartbeat is collected.
The same person playing web and Linux therefore counts as two installations in
combined reports. World starts include revisits, whereas completion flags may
fire only once. Start/completion totals must not be presented as matched funnels.

Only production web builds on the two approved game origins collect. Local,
review, capture, benchmark and debug sessions are excluded. Unity requires an
ordinary real save, a release player, enabled content updates, Android/Linux,
and neither Editor nor batch mode. The optional native bridge needs an updated
installer; existing players safely omit analytics. No new native API minimum is
required because collection is optional. No native installer is released by this
web change; use the existing daily/manual native workflow.

## Delivery, storage and limits

Both clients have a 64-event memory queue, batches of at most 20, an eight-second
request timeout and at most three attempts. Retries reuse event IDs; the SQL
primary key prevents duplicates, including ambiguous responses. There is no
persistent offline event backlog. Full queues, exhausted retries, process exit,
opt-out or collection limits may lose events; gameplay never waits for analytics.
Browser page exit attempts a keepalive flush; native shutdown delivery is not
guaranteed. No analytics errors or identifiers are printed in game logs.

The server validates streamed body size (16 KB), timestamps (at most one day old,
five minutes ahead), event vocabulary and bounded identifiers. Browser origins
are allowlisted; native requests have no Origin. This is a public ingestion
endpoint, not authenticated proof of genuine play. A client-held key would not
provide that proof. IP rate limiting (60 batches/minute per edge location), a
1,000-event daily installation limit and a global **10,000-event daily budget**
bound writes. A full daily budget returns 429; the dashboard shows usage. These
are initial small-game safeguards, not a promise of unlimited ingestion or zero
cost. They share the existing Cloudflare account quotas; revisit before growth.

SQL stores at most 90 days of events. A daily Durable Object alarm prunes old
events, first-observed records and budgets, even with no new arrivals. Reporting
uses only the selected time window. Provider recovery snapshots may retain
historical deleted bytes according to Cloudflare's recovery policy. Do not
restore an old dataset without considering expired/deleted data.

## Reporting and access

Open `/analytics` on the Cloudflare game site. The dashboard reuses the existing
private notebook's signed HttpOnly, Secure, SameSite cookie and password login.
Reports fail closed without the notebook secrets and limiters; no credential is
sent to clients. GitHub Pages links to Cloudflare for reports. The report API
returns aggregates only, never installation or session identifiers.

Filters: last 7/30/90 UTC calendar days, platform and build. Metrics: distinct
installations, sessions, event counts, daily activity, platform mix, progression
starts/completions/failures and mean/P95 world loading. P95 uses the nearest-rank
sample. D1 retention is return on the next UTC calendar day, among first-observed
cohorts whose entire following day has finished. Build/platform filters restrict
activity on both days. First-observed history is limited to retention; this is
not lifetime acquisition reporting. Empty cohorts display an em dash.

`analytics.html#demo` explicitly displays illustrative fixture data. It makes no
API requests, disables filters and never seeds production. Local review should
also check actual API-backed empty/filtered states, not just this demonstration.

## Deployment and verification

The existing Cloudflare deployment creates the SQLite binding through the
additive `analytics-v1` migration in `wrangler.jsonc`. It preserves NotesDrafts.
There are no new secrets: the existing notebook credentials protect reporting.
Do not deploy a bare assets build over production: follow `docs/cloudflare.md`
so update archives and native manifests remain intact.

Tests cover the shared schema, browser retries/opt-out, real SQLite aggregate
queries, deduplication, retention, quotas, all platform labels, private report
authentication, streamed limits and CORS. Native compilation is a separate check;
it does not prove player event delivery. Before calling native tracking verified,
run an actual release player and confirm a received event and persisted opt-out.
No production fixture data should be sent just to make the dashboard look populated.


## Admin hub and domain

Open `https://hiraeth.my/admin/`. This is a real `admin/index.html` so GitHub Pages
serves `/admin` without a custom router or hosting migration. Use the existing
private notebook password. The hub links analytics, changelog, world-debug tools,
and the existing notebook (which keeps its own secure cookie login).

`POST /api/admin/session` on the existing Cloudflare Worker verifies the password
server-side, shares the notebook's five-attempt/minute edge login budget, bounds
streamed input, and issues a one-hour HMAC session. Its key derives from both
server-only credentials with an admin-specific purpose. Tokens are signed for
one trusted frontend origin. Only the two published hosts and `hiraeth.my` get
CORS; local same-origin previews are supported. No wildcard credentialed CORS.
The browser keeps the token in sessionStorage for this tab, never in a link or
localStorage, and sends it explicitly as Authorization with cookies omitted.
Reports verify the token server-side; changing either server credential invalidates
sessions. Sign out removes this tab's token; an already copied token expires in
one hour. Reuse in an XSS-compromised same-origin page remains a bearer-token risk.
No secret or password is bundled in the public site.

The hub and private reports require authentication. Changelog and debug game
assets remain public static assets: moving their entrypoints is not a security
boundary around code already delivered to every game client. Fresh production
profiles have developer mode off; deliberate `?dev=1` links and local development
continue to work. The web title has only play, saves, settings and fullscreen;
Unity's title already has this structure (plus native updates).

Collection accepts the primary `hiraeth.my` origin too. Events expire after 90 days;
first-observed dates survive for still-active installation IDs to avoid counting
returning players as newly acquired when the oldest event is pruned. Inactive IDs
are removed with retention cleanup.


## Per-player story completion

The private Player journeys table shows a random report-only alias for each
installation, best observed main-story percentage, latest reported world,
first/last recorded activity, session count and distinct active UTC days.
Two or more active days in the selection is labelled returned. Last seen is
an event timestamp, not a claim that somebody is online or has abandoned the game.
The same person on different devices still has separate rows; no identity linking.

Model 1 is a milestone estimate, not percent of playtime. It counts up to 11
completed route worlds (ORDER length minus AHEAD plus one, checked against the
completion specification), plus the prologue, first homecoming, Ilen found and
true ending: 15 milestones. Until `ending.final`, floor(completed milestones /
15 * 100) stays below 100. `ending.final` alone makes it 100, including alternative
routes. `ending.done` is only the first homecoming. Extra worlds, collectibles,
outfits and optional challenges are not required for 100%. The model is versioned;
changing its meaning requires an explicit migration rather than mixing scores.

A snapshot reads the current save's numeric progress, including legacy journal
world completion; it never sends save contents or text. Existing players report
their current progress on resuming. No snapshot or activity is sent just because
the web title preloads a world. Opt-out and debug exclusions still apply. The
native sender forwards the bounded counters through its updated event schema;
older compatible analytics installers omit these new snapshots until updated.

Report filters select the player cohort and visits. Completion is the maximum
single-save snapshot over the retained 90 days for those players, across builds;
latest world comes from the newest snapshot. Resetting/replaying another save
cannot sum into that high-water mark. No snapshot means “Not reported”, not 0%.
Pagination is 50 players, sorted by recent activity, highest completion or oldest
last-seen time, with a stable alias tie-breaker. Report aliases are generated in
the database separately from ingestion IDs; raw installation and session IDs
are never returned. Aliases and inactive first-seen rows are pruned when their
90-day event history expires. There is no permanent lifetime progress archive.
