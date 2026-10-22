# The Unity players: the saves' file and the script over the air

The Unity players (the Steam Deck's Linux player, the Xbox's `rnaud.HiraethUnity`, the Retroid's `com.rnaud.hiraeth.unity`,
the Mac's) run the web game's own JavaScript (docs/systems/engine-bridge.md). Two things they keep of their own: the
script's `localStorage` (the saves, the settings), and, since issue #264 (the Unity-default plan's D4, D12–D14, X1, X3,
R4's script half), a newer script downloaded from the game's site. The player itself still comes through its own
channel: the Deck's runtime feed (deck.py), the Xbox's Device Portal, the APK.

## The store as a file (`BridgeStore.cs`)

`localStorage` (engine/unity/host.js → `BridgeHost.StorageGet/Set/Remove`) is one JSON file in `persistentDataPath`:

| file | what |
|---|---|
| `store.json` | `{"v":1,"items":{key: value}}`, written whole |
| `store.json.tmp` | the next one, flushed to the disk and read back before it takes `store.json`'s place |
| `store.json.bak` | the last good file (the one `store.json` replaced): read when `store.json` is missing or doesn't parse, then written back as `store.json` |
| `store.json.bad` | a `store.json` that didn't read, kept to look at |

Writes are coalesced on a thread of their own (a save's burst of keys is one write, ~30 ms later) and flushed at the
exit, when the player goes away (the Steam button, a suspend) and before an update's restart. Nothing is written to
PlayerPrefs any more: UWP keeps them in `LocalSettings`, 8 KB a value, and a save outgrows that (X1).

**From PlayerPrefs.** PlayerPrefs can't be listed, so each key (`hiraeth.js.<key>`) moves into the file the first time
the script reads it and the file doesn't have it; PlayerPrefs is left as it was, a fallback read for a key the file never
had. Removing a key removes it from both, so an old value can't come back. The Graphics setting the player reads at its
start (`BridgeArgs.SavedQuality`) comes from the same store.

`-store <file>` puts the store elsewhere (a test). The editor's tests: `Editor/Tests/BridgeStoreTests.cs` (below).

## The script over the air (`BridgeUpdates.cs`)

**Published** by the Cloudflare deploy beside the web bundle (cloudflare.yml: `web-update.mjs --unity <dir>`, which
makes the folder with `engine-bundle.mjs`'s `unityOta`):

- `updates/unity-<build>.zip`: the player's `StreamingAssets/hiraeth-js` without its `public/` folder (`hiraeth.cjs`,
  `audio.cjs`, `bundle.json`, the menus' pictures), ~6 MB; parted and streamed by the Worker like web's when large.
- `updates/unity.json`: `{ version, build, sha256, zip, minUnity, size, notes }` (release-info.mjs `unityJson`); the
  previous build's zip is kept for a player that read the last manifest a moment ago.

Every bundle carries `bundle.json` (`{ build, version, minUnity, updates }`, engine-bundle.mjs `unityBundleJson`): the
player compares a download with the script it was built with by it. `updates` is on in the published players (made in
GitHub Actions, or with `UNITY_OTA=1`: scripts/unity-android-release.sh) and off in a local build, which keeps the script
it was built with; `-updates <manifest url>` turns them on anyway (pointed at a test manifest), `-no-updates` off.

**The levels.** `BridgeUpdates.UnityApi` is the C# bridge's level: bump it whenever the player changes in a way the
script relies on (a `BridgeHost` call it can't do without, the command buffer's format, a shader or a material's field
it sends), as `NATIVE_API` for the Android app. `ScriptMinUnity` is the oldest
player the script runs on (`unity.json`'s `minUnity`): raise it to `UnityApi` when the script starts relying on the
change. A script whose `minUnity` is above the player's `UnityApi` is never downloaded: the Updates page says the
player's own update brings it. (The script calls new host functions as `host.X?.()` where it can do without them.)

**Checked** when the title first shows in play (`engine/unity/updates.js` `auto()`; never in a planned run: views,
benches), at most every 6 h the player stays up, and from the Updates page. The rules (`UpdateRules`, the same table as
release-info.mjs `unityDecision`):

- `skip`: not one of ours (no build, no sha256), not newer than every build on the device (the built-in script, the
  one playing, one downloaded), or one that failed to start before;
- `player`: needs a newer player (`minUnity`);
- `stage`: downloaded (an automatic check does it by itself; the page waits for *Download and restart*) into
  `persistentDataPath/bundle/unity-<build>.zip`, checked against its sha256, unpacked into `bundle/<build>/` (no path
  out of the folder; its `bundle.json` has to be that build) and kept as pending in `bundle/state.json`.

**Played** from the next launch: at each start of the bridge (`BridgeRunner.Start`) the pending build becomes the active
one if it is still usable (newer than the player's own script, made for this player, not failed, unpacked); a reboot
(Travel, Quit to title) keeps the script it has. *Restart now*: on the Deck's launcher (`-ready`) the player exits 76 and
deck.py starts it again (`RESTART_EXIT`); elsewhere the bridge starts again in the same process at the title
(`BridgeRunner.Reboot`). The script saves first. A player updated past a downloaded script plays its own.

**Safety**, as the Android app's `WebBundles`: a downloaded script has to play its first frame (`MarkReady`) within
30 s of its start (60 on the Xbox), or the bridge marks it bad and starts again on the built-in script; one that throws in
its start does the same at once; one that crashes the player before its first frame two launches in a row (the try is
counted before each start) is dropped. A build that has played once is trusted. `-bundle <file>` (a script given by
hand) turns the updates off for that run.

The log says each step (`Hiraeth bridge: updates: …`; the last lines in the Updates page's info). In LocalState on the
Xbox (X3): `bundle/` sits beside `store.json`; the package itself still comes through the portal.

## The Updates page (`engine/unity/updates.js`)

In the Start menu before Quit to title, and under Settings on the title, in a player that has `BridgeHost.UpdateInfo`.
Its words are the web's (src/updates.js `updateView`, platform `unity`: "player <build>" in place of "app"; *needs a
newer version of the player* in place of the APK offer): the build playing, *Check for updates*, what the newest brings,
*Download and restart* with its progress bar, *Restart now*. It follows the player's state while it shows (every 0.4 s
while something happens, 4 s otherwise).

## The Linux player's gates (D12)

The Linux player (the Deck's since v1.79) is published to `unity-linux` (and the version's release) only after, in the
same job of `.github/workflows/unity-android.yml`:

- **The unit suite on its commit** (`scripts/wait-tests.sh`): tests.yml's run for the push of that commit, waited for
   (up to 90 min); failed or cancelled (a newer push covers it), nothing is published.
- (A smoke run of the player under Xvfb and Mesa's software Vulkan, lavapipe, was removed on 2026-10-16: Unity's player
  refuses it on the runner, "Vulkan detection: 0 / No supported renderers found", run 38901932713. The Deck's
  launcher already falls back to the web when a build doesn't reach its first frame.)

## Checking it

- Node: `tests/unity-ota.test.js` (the manifest and zip, the Worker, the deploy, the page and its words, the C#'s shape,
  the gates), `tests/updates.test.js`, `tests/engine-menus.test.js`.
- The editor: `Unity -batchmode -projectPath unity/Hiraeth -runTests -testPlatform EditMode -testFilter
  "Hiraeth.Tests.BridgeStoreTests;Hiraeth.Tests.BridgeUpdatesTests" -testResults <xml>` (the store's migration, its
  atomic write and backup, a damaged or missing file; the launch's choice, the tries, the manifest's table, the zip's
  check and unpacking).
- A player: serve a folder with `unity.json` and a zip (`writeUnityUpdate` in scripts/web-update.mjs over a folder from
  `node scripts/engine-bundle.mjs ota <dir>`, its bundle.json's build raised; any static server, never port 5173) and
  start it with `-updates http://127.0.0.1:<port>/updates/unity.json`, `-updates-dir <dir>` (the downloads elsewhere than
  `persistentDataPath/bundle`) and `-store <file>`. `-updates-page -out <dir>` is a plan that opens the Start menu's
  Updates page, presses Check for updates and Download and restart, waits each out and photographs it
  (`unity-updates-<build>-open|checked|downloading|ready.png`); its restart starts the plan again on the download.
- Checked on the Mac's IL2CPP player, 2026-10-16: a key moved from PlayerPrefs at its first read (PlayerPrefs left);
  a newer build downloaded at the title and played from the next start; one that throws at its start, back to the
  built-in script at once and marked bad; one that never returns, back after 30 s (its stuck engine left, the process
  ended at the exit with `_exit`); the page's check, download and Restart now (the bridge started again in the same
  process on the download). Not yet on Linux, Android or the Xbox: exit 76 into deck.py's relaunch is covered by
  deck.py's own tests of `RESTART_EXIT`.


## Optional Steam Deck player update (#620, v1.99)

The native player advertises API 4 for the optional player-update methods. The script
minimum remains API 3: each new call is capability-gated, so existing compatible
players can still receive scripts. API 3 players show relaunch/installer guidance;
API 1/2 players must first obtain a compatible native player through the existing
launcher background download. No old player is promised a host method it lacks.

In a managed Deck install, Updates can check the player separately and offer
**Update player and restart**. The new Linux player bundles the canonical
`scripts/steam-deck/deck.py` as its player-only helper. This avoids depending on an
update to the older launcher/runtime package, without changing that feed or its
release assets. The existing launcher still owns startup, exit 76, pins, and failed
startup fallback. Standalone and other-platform players get installation guidance.

The helper validates the watched launch's ready path, canonical install/player
layout and held player pin before operating. It downloads only the fixed
`unity-linux` asset, checking its exact size and SHA-256. Before activation it checks
native `player.json` against bundled `bundle.json`: build identity, no older build,
and enough native API for both the running player and pending script. The canonical
helper must match its packaged SHA-256 and supported protocol. A missing or
incompatible feed fails explicitly. Another updater's lock reports busy, never a
false success. No aggregate runtime/content-update result is used as proof.

The page shows checking, bytes downloaded, verification, preparation, ready and
concrete errors. Restart performs a fresh native check of the activated player,
then requires the save store to flush successfully before exit 76. Saves/settings
remain in their existing data directory. The prior player remains available and
existing launcher health/watchdog rollback is retained. A previously failed player
is not offered repeatedly as a new ready update.

Validation uses isolated launcher filesystem fixtures and muted editor/UI fixtures;
it does not update a user's installation. See the release evidence for the actual
platform coverage and limitations.

Activation reads hold the launcher's shared state lock across resolved directory,
archive identity, helper and compatibility checks. The restart's native recheck
repeats this snapshot. With an older launcher, there is still a handoff interval
after that helper exits: a concurrent background updater can activate another
release before exit 76 is relaunched. The old launcher then chooses its current
player under its own state lock and startup-health rules, retaining the previous
working player as fallback. We do not claim an exact staged digest is pinned across
that old-launcher handoff; eliminating that interval requires a newer launcher
protocol, rather than pretending new native methods can control the old launcher.


### API 4 sound-bank delivery contract (#622)

The selected script bundle can own a compact `public/sfx` set. For `sfx/` reads only,
including `manifest.json` and native PCM decoding, that selected root is authoritative:
a missing member fails rather than falling back to the installed or repository file
of the same name. Music, models and all other public roots keep their existing order.
A selected bundle with `minUnity >= 4` requires that bank even when its directory is
missing; an older API-3 script-only bundle without `public/sfx` keeps installed lookup.
The host root cache is cleared at startup, bundle selection and reboot, and rollback
selects the previous bundle's bank together with its script. The subsequent strict
audio release owns compact OTA packaging and raises its script minimum to 4; this
native support release itself remains compatible with script minimum 3.

Release validation: 82 Python launcher tests include a real helper subprocess with
held player pins and unchanged save bytes; 30 focused JS update tests cover optional
host calls, duplicate actions and failed saves. Ten native EditMode tests cover fresh
restart rejection and authoritative roots. A muted editor transaction uses actual
`Choose → Failed → Choose` selection to decode distinct same-name WAVs and their
manifest, checks missing API-4 directories, and verifies packaged helper bytes.
Eight actual native menu renders and browser renderer states are isolated fixtures,
not a physical Deck download or restart. The warm project was restored byte-for-byte.
Evidence: `.local-tools/validation/v1.99/player-update-620/` (ignored).
