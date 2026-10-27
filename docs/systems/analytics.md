# Gameplay analytics

Hiraeth uses GameAnalytics, with separate projects in Cetras Games for web
(`Hiraeth`, 358354), Android (`Hiraeth Android`, 358356) and Linux
(`Hiraeth Linux`, 358358). Tracking is on by default, as requested by the author.
**Share gameplay statistics** in Settings persists an opt-out on the device.
The setting is shared by the browser and Unity menus. It does not change saves.

## Events and boundaries

`src/analytics/events.js` defines a small vocabulary without importing worlds,
registries, the game state singleton or SDKs. The platform entry points subscribe
through `trackSession`; gameplay modules never import a vendor SDK.

| Event | Meaning | Value |
| --- | --- | --- |
| Progression World / world ID | Start when a world begins loading; Complete when its authored completion flag becomes true | none |
| Progression Quest / quest ID | Start on the first stage, Complete/Fail on the terminal stage | none |
| Progression Minigame / game ID | Start on each attempt; Complete/Fail when the attempt finishes | result rounded to an integer, when available |
| Design Loading:World:world ID | World construction time after entry-point setup | milliseconds |

These use built-in progression and design reports, not paid raw-event exports.
World starts are visits, not unique first visits; a revisit can start without a
second world-completion event. Opting out can leave an attempt without an ending.
Quest and minigame events carry authored identifiers only. Save contents, dialogue,
player-entered text, screenshots, exact coordinates and account identifiers are
not forwarded. SDK session/device/platform metadata is still collected; this is
pseudonymous telemetry, not a claim of complete anonymity. Unity uses a random
installation ID rather than an advertising ID. The SDK may infer location from IP.

Web tracking requires a production build on one of the two published origins.
Development servers, debug saves, review/capture/test query modes and automated
tests never initialize an SDK. Unity additionally requires a non-development
release player, enabled release content updates, ordinary play and a real save
slot; Editor and batch sessions are excluded. The queue before SDK availability
is bounded to 64 events. A blocked/failed SDK cannot prevent gameplay. Opt-out
during download discards queued events before initialization. Turning collection
off stops new events; it does not delete data already delivered.

## Release configuration

The browser uses pinned npm `gameanalytics` 5.0.0. Unity uses official OpenUPM
`com.gameanalytics.sdk` 8.3.1. Only the browser entry imports its SDK; Unity calls
an optional host capability and needs a new native installer to collect events.
Older players remain playable and simply omit analytics.

GitHub Actions secrets:

- `GAMEANALYTICS_WEB_GAME_KEY` and `GAMEANALYTICS_WEB_SECRET_KEY`
- `GAMEANALYTICS_ANDROID_GAME_KEY` and `GAMEANALYTICS_ANDROID_SECRET_KEY`
- `GAMEANALYTICS_LINUX_GAME_KEY` and `GAMEANALYTICS_LINUX_SECRET_KEY`

The web deploys expose their ingestion pair only to the Vite build. Unity's
workflow writes an ignored `.gameanalytics-build.json` with the native pairs;
`BridgeAnalyticsBuild` creates an ignored GameAnalytics Settings asset before the
player build. The same environment variables work for local native releases.
Missing configuration disables collection. No administrative API token is used.
As required by client SDKs, ingestion credentials are present in distributed
JavaScript/native artifacts; storing them in Actions secrets keeps them out of
source history, not hidden from a determined player. Never log their values.

## Validation

`tests/analytics.test.js` exercises event filtering, default-on policy, exclusions,
bounded queues, preference changes, asynchronous opt-out races and the optional
Unity bridge with inert transports. SDK adapters are checked separately so their
dependencies do not spread into gameplay unit tests. Before enabling production,
verify a controlled release-like run in GameAnalytics Realtime for each platform
and confirm that turning the setting off stops new traffic. Native compilation
alone is not proof of received events or a working installer.
