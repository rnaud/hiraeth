# The Android app and its updates

The APK, signing, GeckoView, and the game updates over the air.

## Android (offline APK)
The game is also packaged as an Android app, for handhelds such as the Retroid
Pocket. Their built-in controls work through the Gamepad API. Since NATIVE_API 6 the app runs
the game in its own engine, GeckoView, and in the system WebView only where that can't run
(see "The engine: GeckoView").
- **Release workflow** (`.github/workflows/android.yml`): every push to `main` once its Tests run passes (back since 2026-10-30, after a stretch as manual-only), or a manual dispatch on `main` after its exact test gate,
  builds the web game, wraps it with Capacitor (`capacitor.config.json`,
  `android/`) and builds a signed release APK. The APK is published to the
  GitHub release for the newest version in `src/changelog.js` (`v0.34` and so
  on, via `scripts/release-info.mjs`). Builds within one version replace that
  release's APK; adding a changelog entry starts a new release. Next to the APK the release gets `latest.json` (APK URL, versionCode,
  native level) and, for apps up to NATIVE_API 4 only, `web-<build>.zip` + `web.json`, all from
  `scripts/release-info.mjs`. Newer apps take the game's updates from the site (see "Game updates
  from the site"). Download
  `hiraeth-v<version>.apk` from the repository's Releases page and open it on
  the device to install. Allow installing from your browser or file manager
  the first time.
- **Signing:** one fixed release key, so new builds install over old ones and
  keep your progress. The key is in the repository secrets
  `ANDROID_KEYSTORE_BASE64` (a PKCS#12 keystore, alias `moebius`, its original name: the key keeps it) and
  `ANDROID_KEYSTORE_PASSWORD`. A local backup is in `.local-tools/android-signing/`,
  which is git-ignored. Keep it: losing the key means the next APK has to
  replace the app with an uninstall, which deletes your saves.
- **The app id** is `com.rnaud.hiraeth` since v1.54 (issue #130; up to v1.53 `com.rnaud.moebius`, its
  updates from the old Worker). Another id is another app: the new one installs beside the old one (the same
  key, so its own updates install over it), starts with a fresh save, and the old app gets no more game
  updates. Its APK offer still works (`latest.json`'s `native` 9 is above its 8), so the old app offers the
  new one; after installing it, uninstall the old app.
- **The app** runs fullscreen and immersive in landscape, keeps the screen on,
  and plays sound without an extra tap. `versionName` is the game version and
  `versionCode` is the build number (`release-info.mjs build`: the commit count; up to 117 it was
  the workflow run number).
- **Local build** (needs JDK 21 and the Android SDK with the API 37.0 platform, for GeckoView):
  ```
  npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug)
  ```

### Automatic web releases and manual installers

The successful automatic Cloudflare deployment publishes the newest changelog version's release notes
with `scripts/web-publish.sh`, including the exact web commit and build number. It preserves existing
assets and their source labels. New web-only releases use `--latest=false`: GitHub's latest release
continues to expose the last explicitly published Android `latest.json`, so the native updater is not
pointed at a release without an APK. Each Android build, automatic or requested, can make its release latest as before.
Compatible content arrives through `web.json` / `unity.json`; native minimum-version guards remain.
A bridge change requires a separately requested installer before older clients can accept that content.
Automatic site publication reuses and verifies the currently published Steam Deck runtime even if
native inputs changed. To rebuild it, manually dispatch Cloudflare with `build_deck_runtime=true`.
A missing or corrupt published runtime fails the deployment instead of silently starting a native build.

### The Unity builds on a version's release (issue #186, v1.59)
A version's release (`vX.Y`) also holds the Unity port's testers' builds, beside the APK:
`hiraeth-unity-xbox.zip` (Xbox, Developer Mode), `hiraeth-unity-linux.tar.gz` (Linux / Steam Deck) and
`hiraeth-unity.apk` (Android). They are built apart (`unity-xbox.yml`, `unity-android.yml`; docs/systems/unity.md,
"Building in GitHub Actions"), later than the APK and often from an earlier commit, so each is put there when
it finishes:
- **`scripts/unity-publish.sh`** publishes to its prerelease (`unity-xbox`, `unity-linux`, `unity-android`) as
  before, which the Deck's installer and `scripts/xbox-unity.mjs` read; then uploads the same file (`--clobber`)
  onto the built commit's version (`release-info.mjs version-at <sha>`). It waits up to ten minutes for
  that release to exist; a newer release appearing meanwhile never changes the destination.
- **The label says what it is and its commit** (`release-info.mjs unity-label`: "Hiraeth (Unity) for Xbox
  (Developer Mode), testers' build (commit 2fa97260eee4)"); GitHub shows it in place of the file's name. The
  APK's label is "Hiraeth vX.Y for Android (the game)". The notes end with a Unity section
  (`<!-- unity builds -->`, `unitySection`) read back from those labels: each build and the commit it came
  from, or, for one not built since the release was made, a link to its prerelease. `unity-publish.sh` redoes
  it (`unity-body`), `android.yml` writes installer notes, and `web-publish.sh` writes web notes, so a rewrite
  of the notes never loses a commit: it travels with the file.
- **Only what is needed:** one copy per build on its matching release (about 60 MB, 310 MB and 90 MB; GitHub's
  limit is 2 GiB a file, and a bigger build would stay on its prerelease with a warning). A new version's
  release starts without them until a requested or changed-input daily Unity build finishes. Changelog changes do not trigger per-push native builds; nothing is copied from older versions. Older versions keep the Unity builds they had.
- A failed version attachment fails the job; its rolling prerelease remains available for recovery. `VERSION_TAG=<tag>` points the
  step at another release (a test one), `NO_VERSION_RELEASE=1` skips it. `tests/unity-version-release.test.js`
  runs the script against a fake `gh`.
- **The Unity APK's script updates itself** (issue #264, R4's script half; docs/systems/unity-updates.md): from the
  site's `unity.json` beside `web.json`, into the app's `files/bundle/`, played from the next start (or at once from
  the Updates page), with the web's 30 s boot watchdog. Its saves are `files/store.json`. A newer testers' APK is
  offered through `unity.json`'s `players` (`player.json` beside the APK: "A newer app or player is available" below).
- **Both Android and Linux players wait for the suite**: `unity-android.yml` publishes each only after tests.yml passed on its exact commit
  (Linux D12, now also applied to Android); the separate Xbox workflow is unchanged.
- The prereleases still hold the builds from before the rename (issue #130): `memento-unity-linux.tar.gz` is
  kept, as installs on a Deck from before the rename (`moebius-deck`, which can't update to the renamed
  package) still read that name; nothing reads `memento-unity.apk` or `memento-unity-xbox.zip` any more.

### When a release fails (October 2026)
v1.35 never got a release: run 38046378533 built its APK, then GitHub answered `gh release create` with
`HTTP 403: Resource not accessible by integration`, and v1.36 and v1.37 were made minutes later by the same
workflow and token. The failure didn't show where the author looked: a `workflow_run` run's check doesn't
land on the commit it built.
- **Retries.** Every release and upload call goes through `retry` (`scripts/retry.sh`, sourced): up to four
  attempts, 10, 30 and 60 seconds apart, giving up at once only on HTTP 400, 401, 404 and 422 (a bad request,
  bad credentials, nothing there, "already exists"); 403, 429 and 5xx are retried. In `android.yml` the whole
  publish (view, then upload or create) is one function retried as a whole, so a release an earlier attempt
  made is updated, not made twice. The same in `steam-deck.yml` (each call), `scripts/unity-publish.sh`
  (`unity-android.yml`), `cloudflare.yml` (`wrangler deploy`) and, in PowerShell, `xbox.yml`.
- **The outcome on the commit.** The `workflow_run` deploys write a commit status on the tested commit
  (`github.event.workflow_run.head_sha`) with `scripts/commit-status.sh`: `pending` once checked out, then
  the job's status at the end (`if: always()`: success, failure, or error when cancelled), linking to the
  run. The contexts: `release: android`, `release: steam deck`, `release: web (cloudflare)`. They need
  `statuses: write` in the workflow's permissions; a status that can't be written is only a warning.
  (`unity-android.yml` and `xbox.yml` run on the push itself, so their checks are already on the commit;
  GitHub Pages, `deploy.yml`, is a mirror whose runs cancel each other, and has none.)
  `tests/release-workflows.test.js` checks both.
- **A missed version** is not made again afterwards: a later release exists, and an old tag made now would
  become "Latest". The next push publishes the newest version as usual.

### Over-the-air updates and the handheld pass (v0.37)
- **Game updates without an APK** (`android/.../WebBundles.java`, `src/native-app.js`):
  - On launch, when online, the app reads `web.json` from the newest release in
    the background.
  - It downloads a newer build that this app can run, checks it against its
    sha256 and unpacks it to the app's files (`web/<build>/`).
  - The new build is used from the next launch, or right away with *restart now*
    in the settings. The settings also show what's running (`web build 14 · app 12`).
  - Capacitor serves it at the same `https://localhost` origin, so saves are shared.
  - A build that doesn't reach its first frame (`window.__hiraethBooted`) within
    30 s falls back to the game in the APK and is never tried again.
  - Old builds are deleted.
- **APK updates** (`Updater.java`) were offered only when the native side changed,
  that is when `latest.json`'s `native` is above the app's `WebBundles.NATIVE_API`. Since
  NATIVE_API 10 any newer APK is offered (below, "A newer app or player is available").
  - Bump `NATIVE_API` whenever the Java bridge changes. From then on, web builds
    need that APK (`minNative`), and the APK offer comes first.
  - Apps older than this one still get the APK offer once.
- **Swap A/B (confirm/back)** in the settings: B confirms and jumps, A goes back and
  pushes, and the prompts follow. (Replaced by the positional layout and the "Controller buttons"
  setting, see "Controller" in [controls.md](controls.md).)
- **Pause and resume:** leaving the app (home, recents, power) releases the
  controls, stops the sound and pauses the page. Coming back restores fullscreen
  and the sound. On a handheld the sound starts with the first controller input.
  (How it stays silent since NATIVE_API 7: "Silent while away" below.)
- **Testing a debug build:** `adb shell am start -n com.rnaud.hiraeth/.MainActivity
  --es webManifest <url>`. Debug builds otherwise skip over-the-air updates.

### A newer app or player is available (NATIVE_API 10, issue #805)
The Odin 3's Unity player (v2.33, build 2957) never offered a newer APK, so it missed C# changes (the enamel menus,
the new foes' bodies): an installer was offered only when the newest game *needed* it (`minUnity`, `NATIVE_API`).
Now each app also offers its newest installer whenever its own build is older, without ever being in the way.
- **What is newest, published where the apps look.** The GeckoView app: `latest.json` (`code` = the APK's
  versionCode, as before; `releases/latest` stays the last Android release, built after each tested push to main). The Unity players:
  `scripts/unity-publish.sh` uploads `player.json` beside each build on its prerelease, after the build itself
  (`release-info.mjs player-json`: `{ platform, build, version, commit, url, size, sha256 }`, the build being the
  commit count, as the player's own `bundle.json`); the Cloudflare deploy reads the three (`web-update.mjs
  newestPlayers`) into `unity.json`'s `players`, each only if its file answers a HEAD at that size, so the feed never
  names a missing or half-replaced file (`--no-players` leaves them out). A Unity build finished after the last deploy
  is advertised from the next one.
- **The GeckoView app** (`Updater`, `UpdateRules.apkOffer`): `latest.json`'s build above the app's versionCode →
  the launch dialog asks once a build (*Later* keeps that build in prefs, `apkDismissed`; one with a newer native bridge
  asks every launch as before; a debug build never asks). *Update* downloads it into the cache (streamed, its length
  checked, with a progress dialog) and opens Android's installer through the FileProvider; the first time it opens
  *Install unknown apps* for Hiraeth (REQUEST_INSTALL_PACKAGES is in the manifest). The settings' Updates section says
  *A new app is available: v2.40 · build 3012* with **Install the new app** (`AppShell` `installApk`, NATIVE_API 10;
  info's `apkBuild`, `apkState`, `apkGot`, `apkTotal`, `apkError`; `src/updates.js appOffer`), its progress in the bar.
  Apps before 10 get *Get the new app* (the release page) and, through `latest.json`'s `native` 10, the old dialog once.
- **The Unity players**: docs/systems/unity.md, "A newer player is available".
- **The first APK with this offer is installed by hand once** on each device that has an older one (the GeckoView app
  is offered it by its old dialog; a Unity player from before has no `players` in its info, so nothing tells it).
- Tests: `tests/installer-offer.test.js` (publishing, the decisions, the words, the title and page, the C# and Java
  shape), `tests/android-ota.test.js` (Updater's rule and download), `UpdateRulesTest.apkOffer…`,
  `tests/unity-version-release.test.js` (player.json after the build).

### Game updates from the site (NATIVE_API 5)
The repository is going private, and GitHub's release files go with it, so the game's own
updates now come from the Cloudflare site that serves the web game:
- **The feed:** `cloudflare.yml` builds the game, then `scripts/web-update.mjs` adds
  `dist/updates/web-<build>.zip` (the same `dist/` the APK carries, zipped deterministically) and
  `dist/updates/web.json` (`release-info.mjs webJson`: version, build, sha256, URL, size, notes,
  `minNative`, `minDesktop`), and one `wrangler deploy` publishes the site and the update
  together. It owns the Worker: no other workflow deploys it, since a deploy replaces every asset.
  The previous build's zip is fetched from the live site (checked against the live `web.json`)
  and deployed again, so a device that read the old manifest can finish its download.
- **One build number everywhere:** `release-info.mjs build` is the commit count up to HEAD
  (workflows check out with `fetch-depth: 0`). The APK's versionCode (the build the app carries),
  the site's web bundle and the Deck package's game all get it from their commit, so an app
  compares a downloaded bundle with its own. It started above the last run-numbered APK (117).
- **The app** (`WebBundles.MANIFEST`) reads `https://hiraeth.alexandria-rnaud.workers.dev/updates/web.json`.
  `NATIVE_API` is 5; the web game still needs only 4 (`WEB_MIN_NATIVE`, the bundle's
  `minNative`), so apps from before keep their updates from GitHub until the repository is
  private, while `latest.json`'s `native` 5 offers them the new APK at launch.
- **APKs stay on GitHub releases**, for the author to install by hand once the repository is
  private. The launch's APK check then fails, quietly: the settings add *Couldn't check for a new
  app* (`apkCheck` in `AppShell.info`), and *Check for updates* goes on working for the game.
- **The Steam Deck** takes the same `web.json` (`deck.py`'s `CONTENT_MANIFEST_URL`, see
  `docs/steam-deck.md`), and so does **the Xbox app** (`minXbox`, docs/systems/xbox.md).
- Tests: `tests/web-update.test.js`, `tests/android-ota.test.js`, `tests/updates.test.js`,
  `UpdateRulesTest.java`, `tests/test_steam_deck.py`. The flip itself: `docs/cloudflare.md`.

### The engine: GeckoView (NATIVE_API 6)
The app ships its own browser engine now: GeckoView (Mozilla's, `org.mozilla.geckoview`, release
channel, arm64), instead of the system WebView. On handhelds whose firmware pins an old WebView
(the Retroid Pocket Nova: Chromium 109) the game missed 23–50 % of the refreshes in busy places
(30–45 fps); in GeckoView 157 the same build misses 1–15 % (51–60 fps, a third less JS per frame) and
loads in 12 s instead of 21 (docs/benchmark-web-vs-unity.md, "On the Retroid: GeckoView"). Chrome 154
does better still, but the app can't use it.
- **Two activities.** `MainActivity` (the launcher, so home-screen icons keep working) runs the game
  in GeckoView. Where GeckoView can't run (not arm64, Android before 8, or GeckoView failed to start
  here once: `MainActivity.usable`) it hands over to `WebViewActivity`, the Capacitor app as before.
  `--ez webview true` forces the WebView (debug and bench builds).
- **The page's origin** is `http://127.0.0.1:41730` (`MainActivity.ORIGIN`), served by the app's
  loopback server (`AssetServer`): GeckoView can't intercept requests the way Capacitor serves
  `https://localhost`, and pages from `resource://android/` get no content scripts. The port is
  fixed for good (the saves are stored under the origin); if another app holds it, that launch runs
  in the WebView. The server serves the APK's `assets/public/` or a downloaded bundle
  (`WebBundles.Host.serve`), revalidated by ETags made of the build served.
- **The bridge.** GeckoView has no `addJavascriptInterface` / `evaluateJavascript`: a built-in
  WebExtension (`assets/hiraeth-ext/`, a content script at `document_start` with a native port)
  gives the page `window.Capacitor` (`isNativePlatform`, `nativePromise` → `AppShell.java`, shared
  with `AppShellPlugin`), the controls (`GamepadBridge` → `window.__nativePad`), the app's events
  (`hiraeth:pause` / `resume` / `webupdate`) and answers WebBundles' boot heartbeat. The page side
  (`src/native-app.js`, `src/native-pad.js`) is unchanged.
- **Saves, once** (`SaveImport`): on the first launch in GeckoView a hidden WebView opens a page of
  Capacitor's origin that hands its localStorage to the app, and the game's next page starts with a
  script that writes those keys into GeckoView's storage (keys already there are kept) and marks it
  done (`hiraeth.imported.v1`). The WebView's storage is only read: the WebView fallback still has
  the saves as they were.
- **Gecko settings** (its config file, `writeConfig`): autoplay allowed (sound without a tap), no
  slow-script stop (`dom.max_script_run_time` 0, and `onSlowScript` → CONTINUE: GeckoView's default
  stops a script after ~10 s, which left the page dead), no pinch zoom, full-precision timers. Links
  elsewhere open in the system browser.
- **The build:** `geckoviewVersion` in `android/variables.gradle`; GeckoView 157 compiles against
  API 37 (`compileSdkVersion` 37, `android.suppressUnsupportedCompileSdk=37` for the Android Gradle
  plugin 8.13) and its androidx.core 1.19 would need the plugin 9.1, so the app forces the 1.17 it
  had. Gecko's libraries are compressed in the APK (`useLegacyPackaging`): 9.5 → ~100 MB to download.
  CI keeps the AAR in setup-java's Gradle cache and the API 37 platform in an `actions/cache`.
- **Testing on a device:** a debug build takes `--es url http://localhost:6253/…` (the bench's
  server) and has GeckoView's remote debugging on (Firefox's protocol, not DevTools). The bench's
  harness drives the page itself instead (`scripts/bench/gecko-bridge.mjs`).
- Tests: `tests/android-gecko.test.js`, `tests/native-app.test.js`, `tests/android-ota.test.js`.

### Silent while away (NATIVE_API 7)
The bug: on the Retroid the music went on with the screen off. GeckoView deliberately keeps a page
that plays Web Audio running in the background (Gecko's `BrowsingContext::InactiveForSuspend`: a
running AudioContext is an "awake request", and `dom.suspend_inactive.enabled`, on by default on
Android, then leaves the page alone). So only the page could stop it, and it did so only in a world
that had finished loading (`installAppShell`, near the end of `main.js`): the title screen's sound,
a world still loading (12 s and more on the handheld) and the bell's own AudioContext in Vael II
were never suspended. And the session was deactivated before `hiraeth:pause` was even sent.
- **The page** (`src/audio-guard.js`, installed first in `src/boot.js` and by every `Sound`): one
  guard per page. Away = `hiraeth:pause` until `hiraeth:resume` (`window.__hiraethAway` for a page
  that starts while away), or the page hidden or frozen (in a browser too: a hidden tab is silent).
  It wraps the page's `AudioContext`, so every context is registered; going away suspends them all,
  `resume()` does nothing while away (it resumes on return instead), a context made while away is
  suspended at once. `Sound.start()` (a press, `nativepadconnected` from the pad's reset or a
  reconnect, the frame loop) is deferred until return, and the master gain goes to 0 as well. Once
  every context is suspended, Gecko suspends the page itself (timers stop too).
- **GeckoView** (`MainActivity.goAway` / `comeBack`): `onPause`, `onStop` and the screen-off
  broadcast all go away, once. The tab is muted by the engine (`MediaSession.muteAudio`, with a
  media-session delegate set so GeckoView's media control runs: nothing is heard whatever the page
  does), the page is sent `hiraeth:pause` with an id, and the session goes unfocused and inactive
  when the content script answers (it answers right after the page's handlers ran) or after
  `PAUSE_WAIT_MS` (400 ms). `onResume`, or the screen coming on over a resumed app, undoes it.
- **The WebView** (`WebViewActivity`): the same three triggers; `hiraeth:pause` first, then
  `onPause()` and `pauseTimers()` when the script has run; `resumeTimers()` on return; a page that
  loads while away is told again (`onPageLoaded`).
- **Not used:** muting a stream with `AudioManager.adjustStreamVolume` changes the device's media
  volume for every app (and it is a setting); audio focus only quiets other apps.
- **Older apps** (NATIVE_API 6) get the page's guard over the air (the web game still needs only 4);
  `latest.json`'s native 7 offers them the new APK for the rest.
- Tests: `tests/audio-guard.test.js`, `tests/android-gecko.test.js` (the order of the native calls).

### Updates that arrive, and the update section in the settings (NATIVE_API 4)
Why updates used to arrive at random, and what changed:
- **Checked only on a cold start.** The app looked for `web.json` in `onCreate` only; a handheld
  that sleeps resumes the same activity for days. Now `WebBundles.onResume` checks on the launch
  and on every return to the front, at most every 15 min (1 min after a failure), and a failed
  automatic check retries after 30 s, 2 min and 10 min while the app stays in front
  (`UpdateRules`: `dueOnResume`, `retryDelay`).
- **One launch behind.** A download found at launch N waited for launch N+1. Now a ready update
  also starts the next time the title screen opens (`applyReadyUpdate` in `src/boot.js`: nothing
  is running there yet; once per build per session, so it can't loop), or at once with
  *Restart now*.
- **A slow world could undo an update.** The boot watchdog ran on every page (each world is a
  page) and dropped a build, for good, when one world took over 30 s to load. Now a build is
  watched only until it has booted once (`good`).
- **Half-published releases.** `cancel-in-progress` cancelled runs while they published: run 90
  created v0.52 (marked latest) and was cancelled a second later, before `web.json` went up; and
  `--clobber` replaced `web.zip` before `web.json`, so a download in between failed its sha256.
  Now runs are never cancelled, a new release is created with every file in one call (gh keeps it
  a draft until they are up), each zip has its build in its name (`web-<build>.zip`, so a
  `web.json` always points at its own zip) and only the newest two zips stay
  (`release-info.mjs web-zips`).
- **Smaller things:** the manifests are fetched past every cache (`?t=…`, `no-cache`, no
  `HttpURLConnection` cache; GitHub's redirects are `no-cache` and replaced assets get new CDN
  URLs, so this is a guard, not the cause); a broken-off download resumes with a `Range` request
  and is downloaded once more from scratch on a sha256 mismatch; offline (no DNS, no route,
  timeouts) and errors (HTTP 404/503, a damaged zip) are told apart; one check or download runs
  at a time for the whole process (a `recreate()` after the page's process died used to start a
  second one into the same files); when the APK dialog was offered the settings showed nothing.

The update section (`src/update-panel.js`, its words in `src/updates.js`, the app side in
`AppShellPlugin`: `info`, `check`, `download`, `restart`, `openApk`):
- At the top of the settings, on the title screen and in the Start menu, in the app only (a
  browser always loads the newest game). It shows the version, build and app build running, and
  the state: *You have the newest game* (checked when), *v0.56 · build 110 is available (4.6 MB)*
  with its first changelog lines (`web.json`'s `notes`, `size`), *Downloading…* with a progress
  bar, *downloaded: Restart now*, *You're offline*, *didn't come through* (with the reason), or
  *needs a new version of the app* with *Get the new app* (opens the release page).
- *Check for updates* checks now; a check from the settings waits for *Download and restart*,
  automatic ones download by themselves. *Download and restart* saves the position and time
  played (`onBeforeRestart`), and restarts at the title in the new build. Saves live in the
  page's storage at `https://localhost`, which every build shares; nothing in the update path
  touches it (`tests/android-ota.test.js`).
- *Details* shows the app's update log (the last 40 steps, also in logcat as `HiraethOTA`).
- Apps from before NATIVE_API 4 only get the old line and *Restart now*; new web builds need
  NATIVE_API 4, so those apps are offered the new APK first.
- Tests: `tests/updates.test.js` (the states, versions, the title-screen switch),
  `tests/android-ota.test.js`, and the Java rules in `android/app/src/test/.../UpdateRulesTest.java`
  (`cd android && ./gradlew testDebugUnitTest`, JDK 21).

**On the device** (after installing the first NATIVE_API 4 APK over the old one):
1. Settings → the section says *You have the newest game*; *Details* lists `checking: launch`.
2. Push a change; once the release is up, leave the app with Home and come back after 15 min (or
   press *Check for updates*): it finds the new build; *Download and restart* shows the progress
   and lands on the title in the new build, with every save there and Continue where you were.
3. Let an update download in the background while playing, then *Quit to title*: the title
   reloads once into the new build.
4. Airplane mode → *Check for updates*: *You're offline*. Back online, *Check again* works.
5. Turn Wi-Fi off halfway through a download, then on: *Try the download again* goes on from
   where it stopped (`Details`).
6. Load the heaviest world after an update: the build stays (no "didn't start" toast).
7. An old app (NATIVE_API 3) offered the new APK at launch: install it over; saves stay.

## What the site keeps to itself (October 2026)

Two kinds of file are built into `dist/` for the site but never carried by a device: the reference sheets
(the References level's photographs, about 39 MB: `SHEET_FILE` in `scripts/web-update.mjs`) and the
changelog's pictures (`MEDIA_FILE`). The over-the-air zip skips both; the Android workflow runs
`node scripts/site-only.mjs dist` before `npx cap sync android`, and `scripts/package-steam-deck.mjs` filters
them with the same `siteOnly()`. A bundled game reads a sheet from the site (`sheetSrc`,
`src/levels/reference-sheets.js`), so the References level still works on a device when it is online.
Before this the APK carried the sheets (268 MB at v1.0, about 39 MB of it the sheets). Tests:
`tests/site-only.test.js`.

## The music, downloaded once (October 2026)

The recorded themes but the desert's (`desert-bayati.mp3` since issue #207; 96 MB of `music/*.mp3`: `onDemand` in `scripts/web-update.mjs`)
are also left out of the APK, the Deck package and the over-the-air zip (`leftOff()` in
`scripts/site-only.mjs` is the site's own files plus these). A device needs them, though: from the first
open the game downloads every theme it hasn't got from the site, in the background, and keeps it in
IndexedDB for good (`src/music-store.js`; how it works: `docs/systems/audio.md`, "The themes on a device").
No Java change: the page does it all, through the loopback origin's own storage. The site sends
`Access-Control-Allow-Origin: *` on `/music/*` (`public/_headers`, itself site-only), since the game's
origin (127.0.0.1:41730, hiraeth://game) is another one; `scripts/check-deployment.mjs` checks it.

Installs from before kept every theme inside their bundle (the APK's assets, or a downloaded
`filesDir/web/<build>/`), and `WebBundles.cleanup()` deletes the old bundle when the next one starts, so
the themes go with it. A game that finds a theme in its own bundle keeps a copy first (it never
downloads those). For an install from before to keep its soundtrack without downloading it again, its
first update with this code has to still carry the themes: publish that one update with `OTA_MUSIC=1`
(`node scripts/web-update.mjs`, in `cloudflare.yml`), then drop it. Without it, such an install
downloads the themes again (once), like a new one. The APK came down from about 229 MB to about 130 MB.
