# Plan: Unity as the default on the portable devices

The author's decision (October 2026): the Unity player (the engine bridge: the game's own `src/` in Puerts' V8, drawn by
Unity, docs/systems/engine-bridge.md) becomes what the portable devices start by default. The Steam Deck first: its
Linux player holds about 60 fps where the web runtime does 40–55 (docs/systems/performance.md, "The Steam Deck, round
6"). The Xbox's Unity package (`rnaud.HiraethUnity`) is already the one being worked on. The Retroid comes later.

This plan was written from the code at a003e033 (v1.78), read only, with no device and no Unity build. It covers what
has to be true before the Deck's **Hiraeth** shortcut starts the Unity player instead of Electron, and then before the
Retroid's app does. The checklists are at the end. Sizes: **S** is under a day of an agent's work, **M** one to three
days, **L** a week or more. Risk is the chance of losing a player's save, leaving a black screen, or shipping a game
that can't be finished.

## Where each device stands

| | the web runtime (default today) | the Unity player | saves | updates |
|---|---|---|---|---|
| **Deck** | Electron (`desktop/main.mjs`), started by `deck.py --launch`, the game at `hiraeth://game` | second shortcut **Hiraeth (Unity)** (`deck.py --launch-unity`), the `unity-linux` release, IL2CPP + Vulkan | web: Electron's profile `~/.config/hiraeth` (localStorage, LevelDB). Unity: PlayerPrefs under `~/.local/share/hiraeth-deck/unity-data/unity3d/…` (`XDG_CONFIG_HOME`, `unity_env`) | web: the runtime package and the game's bundle from the site (`web.json`, `steam-deck.json`). Unity: the whole player (~300 MB) from GitHub's API, compared by digest (`get_unity_manifest`) |
| **Retroid** | the APK `com.rnaud.hiraeth`, GeckoView, served at `http://127.0.0.1:41730` | the APK `com.rnaud.hiraeth.unity`, "Hiraeth (Unity)", installed by hand from the `unity-android` release | web: GeckoView's storage for that origin. Unity: the Unity app's own SharedPreferences (PlayerPrefs) | web: OTA bundles (`web.json`, `minNative`), APK offers (`latest.json`, `NATIVE_API` 9). Unity: none (install the APK again) |
| **Xbox** | `rnaud.Hiraeth`, WebView2 at `https://hiraeth.example/` | `rnaud.HiraethUnity`, installed through the Device Portal (`scripts/xbox-unity.mjs install`) | web: WebView2's profile in its `LocalState\EBWebView`. Unity: its own package's PlayerPrefs | web: OTA bundles (`minXbox`, `XboxApi` 1). Unity: none (reinstall the `.msix`) |

## 1. Saves and settings

**What is the same.** Every save and setting is a localStorage string, on every device and in both runtimes. The
Unity host maps `localStorage` onto PlayerPrefs (`engine/unity/host.js` → `BridgeHost.StorageGet/Set/Remove`, each key
stored as `hiraeth.js.<key>`). So the *format* is shared: the three slots (`hiraeth.s<n>.game.v1`, `.journal.v1`,
`.save.v1`, `.encounters.v1`), the slot index and meta (`hiraeth.slot`, `hiraeth.meta.v1`), the settings
(`hiraeth.settings.v1`, `hiraeth.input.v1` with the pad's rebinding), `hiraeth.muted`, `hiraeth.padFamily.v1`,
`hiraeth.changelog.seen`, and the world's per-slot memory. The same `src/save-slots.js` reads them in both. A key
copied from one store into the other just works.

**What is not shared.** Nothing is shared between the two today, on any device. Each runtime starts with an empty
store:

- **Deck**: `deck.py unity_env` deliberately points the player's `XDG_CONFIG_HOME` at `unity-data/` ("never the web
  game's profile"). The web's saves sit in Chromium's LevelDB under `~/.config/hiraeth/Local Storage/`. That is
  snappy-compressed, and deck.py's Python cannot read it safely.
- **Retroid**: two packages, two sandboxes. `com.rnaud.hiraeth.unity` cannot read `com.rnaud.hiraeth`'s GeckoView
  profile.
- **Xbox**: two packages, two `LocalState`s.
- **Only web**: the recorded themes downloaded into IndexedDB (`src/music-store.js`). Unity has its own copies (D15:
  the Deck's player carries them all, the APK and the Xbox's download them into `persistentDataPath`). Also the Notes page's drafts, and the web-only keys (`hiraeth.dev`, `refLabMode`, the cinematics QC). None
  of these needs to move.
- **Settings that differ**: Unity's Graphics choice lists `handheld | low | medium | high` (`engine/menus.js`) but
  starts the Linux player on `deck` (`BridgeArgs.Quality`). An imported `quality: 'deck'` is honoured at start
  (`SavedQuality`), but the menu has no `deck` or `auto` to return to once it is changed. `language` is ignored on
  purpose. `pad` (the rebinding) carries over as it is. The keyboard's rebinding (`hiraeth.input.v1`'s keys) is
  stored but unused.

**Migration needed (one design, three devices):**

1. **Store the Unity side in a file, not PlayerPrefs** (`BridgeHost`): one JSON file in `persistentDataPath`, written
   atomically and debounced, with the old PlayerPrefs keys moved into it once. Today every `localStorage.setItem` is
   `PlayerPrefs.SetString` followed by `PlayerPrefs.Save()`, which rewrites the whole prefs file, and a save is written
   every 10 s. On UWP, PlayerPrefs live in `ApplicationData.LocalSettings`, which is limited to 8 KB a value (to check
   against a late-game `hiraeth.s1.game.v1`). A file makes import, export and backup a copy.
2. **An importer on the Unity side**: at start, before the bundle runs, if `hiraeth.imported.v1` isn't set and an
   import file is there (`-import <file>`, or a fixed name next to the store), merge it. The merge goes **per slot,
   newest `meta.lastPlayed` wins**. The losing slot's keys go to `storage.before-import-<time>.json`, never deleted.
   Global keys (settings, pad) come from the import unless already set. Then set the mark. This is Android's
   `SaveImport` (NATIVE_API 6) turned the other way.
3. **An exporter on the web side, per device:**
   - **Deck**: Electron in an export mode. `deck.py` runs `electron --export <file>` hidden (`HIRAETH_HIDDEN=1`). It
     opens `hiraeth://game/__export`, a tiny page at the game's origin that posts every `hiraeth.*` key to
     `__app/export`, and quits. `deck.py` then passes `-import <file>` to the player. This needs a new runtime (a
     `main.mjs` change: `DESKTOP_API` 2), so it reaches Decks through the runtime feed first.
   - **Retroid**: the page can't write a file. The app has to do it. Either the next native level (`NATIVE_API` 10)
     adds `AppShell.mirrorSaves(json)`, called by `save-slots.js` on every save and on pause, writing
     `files/saves.json`. Or the Unity APK, under the same package id, finds that file at its first start (see the
     Retroid list, R2).
   - **Xbox** (the author's console only): the WebView2 app writes `LocalState\web\saves.json` on a page message, and
     `scripts/xbox-unity.mjs saves` copies it into the Unity package's LocalState through the Device Portal's file API.
     Then the player imports it at its next start.
4. **The way back**: the web fallback must keep working with the saves made in Unity. The importer's mirror image, a
   Unity → web export (the store file → localStorage at the web's next start, the same merge), covers going back.
   Until it exists, a fallback to the web plays the save as it was at the switch.

## 2. Updates

**The Deck today.** Each launch starts `deck.py`'s background update outside the game (`systemd-run --user`). It
updates three things on their own:
- **The game** (`web.json` from the site): a bundle into `web/<build>/`, pinned by the next launch, with `minDesktop`
  checked against `DESKTOP_API`.
- **The runtime** (Electron, `main.mjs`, `deck.py` and a packaged game): from the site's `steam-deck.json` (20 MiB
  parts), with the GitHub release as a second feed.
- **The Unity player** (`install_unity`): the `unity-linux` release from **GitHub's API only**, the whole ~300 MB tar
  whenever its digest moves, into `unity/<sha12>/` with a `current` link. It is never part of the settings' Download
  (`--update --progress` leaves it out). The repository is public today. The docs say it is going private, and then
  this check fails while the runtime's (on the site) keeps working.

The player is built by `unity-android.yml` on Unity-side pushes, and nightly when the game moved. So the Unity game
trails the web by up to a day. It is published with no smoke test of the player and without waiting for
`tests.yml`.

**The Retroid today.** The web app updates its game over the air (`WebBundles.java`: `web.json`, `minNative`, a
30 s boot watchdog, then back to the APK's game) and is offered new APKs when `latest.json`'s `native` is above
`NATIVE_API` (9). The Unity APK has no updater: it is installed by hand from `unity-android` or the version's
release.

**The Xbox today.** The WebView2 app updates its game from `web.json` (`minXbox`, `XboxApi` 1, `good.txt` /
`bad.txt`). The Unity package is reinstalled through the Device Portal; `-bundle <file>` already makes it run a
script bundle placed in LocalState (a test switch).

**What changes when Unity is the default:**

- **One shortcut.** `launch` (the shortcut Steam knows: its app id, playtime and artwork stay) starts the Unity player.
  The Electron game becomes the fallback, plus a second shortcut **Hiraeth (web)** for the transition (the old
  `launch-unity` entry renamed, its art badged WEB instead of UNITY). `deck.py --launch` picks the engine from
  `engine.json` (`unity` | `web`, set by the installer or a setting), with a remote override in `web.json`
  (`deckEngine: 'web'`, a kill switch if a player build goes bad).
- **A watched start, like Electron's.** The player touches a ready file after its first frame (`-ready <file>`).
  No frame within N s, or a crash before `PLAYED_SECONDS`, marks that player build failed. The previous player gets
  one try, then Electron. The result is remembered per player sha (as `gpu.json` is per runtime).
- **The player is required, not optional.** The installer installs it before it registers the shortcut, and the
  settings' Download includes it.
- **Its feed moves to the site**, in parts like the runtime's (`scripts/deck-runtime.mjs`: a `unity-linux.json` and
  20 MiB parts), with GitHub as the second feed. To check: the Worker's asset count and size for ~300 MB a build, and
  keeping the previous build for half-done downloads, as `web-update.mjs` does.
- **Script updates over the air (strongly advised before the switch).** The player carries `hiraeth.cjs`,
  `audio.cjs` and StreamingAssets data (pictures, title shots, map marks). A `unity-<build>.zip` of those on the site,
  with `minUnity` checked against a `UNITY_API` level in `BridgeHost` (bumped when the C# side, a shader or the
  command format changes), would let a 300 MB player change only when Unity's side does. The game would then follow
  every push, as the web does. `BridgeRunner` already reads another bundle (`-bundle`). What's missing is
  `persistentDataPath/bundle/<build>/` with a boot watchdog (`.failed`), the feed, and the StreamingAssets lookups
  reading there first. The same zip serves the Xbox and Android players.
- **Build gating.** A Linux player that becomes the default must pass `tests.yml` on its commit and a smoke run
  before it replaces the release: the player under Xvfb with lavapipe (software Vulkan), `-no-title`, exit 0 after
  "world settled". Today a red nightly would reach every Deck.
- **The settings' Updates section.** Unity's menus have none. Add it to the Start menu's Settings, as on the web
  (`src/update-panel.js`, `src/updates.js`): `BridgeHost` runs `deck.py --status`, `--status-local` and
  `--update --progress <file>` (what `desktop/deck-updates.mjs` does for Electron). Restart exits 76, which deck.py's
  launcher already turns into a new launch (`RESTART_EXIT`).

## 3. Parity: what the Unity player lacks or does differently

Read from `engine/game.js`, `engine/unity/game.js`, `engine/menus.js` and the C# runtime, against `src/main.js`.
Where it says "not wired", `main.js` makes or calls the system and the engine doesn't. Not yet seen in play.

**Done in Unity** (seen on the Xbox 1.73 / v1.78, issue #264): the title with its painted shot and logo, Saves (three
slots, delete, the folded Debug row), the Start menu (Resume, Items, Quests, Map, Settings, Controls, Photo mode,
What's new, Quit), Settings (volumes, mute, camera, Reduce motion, shake, pad faces, rumble, hints, Graphics, text
size, plain speech background, Show FPS), the pad's rebinding (Run and Guard held or toggled), What's new (the newest
4 versions), the game menu's five panels (the Map with its ground, cursor and zoom; Items with pictures; the wallet;
gadgets), conversations (tones, portraits, three answers), quests and the journal, the charge, makers' boxes and
their card, the shops (Anselm's and the keepers'), the gadgets and their HUD, the ship (aboard, voicemail, the holo
table → Worlds, Travel here, the arrival), the prologue, photo mode (stills to `persistentDataPath/photos`), talk
gestures (`gestures.glb`), the pad's printed letters (Retroid, Xbox, Deck), rumble, the key counter in temples, the
carry, the see-through surfaces, weather, wind, wildlife, fire, the scout's ping; the fight and the guardians, the
Arena's list of foes (its FOES page in BridgeMenu, D-pad ↓ or K), and what the web paints on canvases (the ship's console
screen and wall pictures, the signs and boards: engine/raster.js, sent as textures).

**In progress now** (parallel agents, issue #264): What's new, photo mode, the prologue and the rebinding; the ship's
interior; talk gestures.

**Missing, blocking a player from finishing the route:**

| what | in the code | notes |
|---|---|---|
| **Doorways and portals**: interiors, cave mouths, temple doors and exits, Viridel's hatch, the Lab's doors | `level.portals` and `src/passage.js` are walked only by `main.js`; engine/game.js passes `passage: null` and never reads `portals` | Temples (`src/temples/runtime.js` pushes their doors as portals) and every interior can't be entered. Needs the hand-over (warm draw, the paper cover as the screen's state, `carryAcross`), and thresholds' light (`src/thresholds.js`). |
| **Foes and combat** | `src/foes.js` not in the engine ("No foes in the engines yet", engine/game.js) | The ink blots and machines, lock-on and its camera (`lock-aim.js`, `lock-frame.js`), the blade's combat and hops, flurry, hitboxes, potion drops, chimes from foes, the low-health cue, `chemistry.js`'s foes catching fire. Gadgets get `foes: null`. |
| **Guardians** (each temple's last room) and their hints | `src/guardian-help/`, `src/fight-temples/` | Every route world's climax. Depends on foes and portals. |
| **Fragments** | `createFragments` (`src/fragments.js`) not wired | The finder switch shows; the fragments themselves aren't placed, and Anselm's shop sells for them. |
| ~~**Trials and challenges**~~ **done** (engine/trials.js, tests/engine-trials.test.js) | the world's challenges, the games' signs and their hosts made as main.js does; the runner's card is engine/menus.js's `card` (BridgeMenu.cs), its HUD the screen's `minigame` (BridgeHud.cs) | Each world's trial and the makers' runs. The Sunken Hall's waves wait for the foes (D2). |
| **Hazards** | `updateHazards` not called | Hazards registered by levels (the foundry's pour, the desert city, flora) never act. |
| **The ending and homecomings** | reached through `ship.js` → `ship/homecoming.js`, `story/ending.js`; `?ending=` / `viaShip` decided in `main.js` | To check in play: the arrival home by ship playing the right homecoming. |

**Missing, not blocking but noticed:**

| what | notes |
|---|---|
| ~~**The recorded music**~~ | **Done (D15, 2026-10-15)**: Unity decodes the MP3s (`BridgeMusic.cs`), the game's graph sets their place and gain (`engine/webaudio.js` `NativeAudioBuffer`); the title's recording, the world themes, the cues, Music plays (Moments / Always) in the settings. The Deck's player carries every theme; the APK and the Xbox's download the rest into `persistentDataPath`. engine-bridge.md, "The recorded music". |
| **Body foley** (`src/foley.js`) | Not wired: no footsteps or body sounds. |
| **Minigames** (`src/minigames/`), the Arena (its list of foes done, issue #264), Ink tide, the shooting gallery, Chime pirates (`src/ambush.js`, the first flight to a new world) | The games' own pages are wired (`createGame({ game, from })`, engine/trials.js: the Sunken Hall, the races, fishing… from their hosts). Not drawn yet: what a game draws on the page of its own (the speed lines, the drum circle's ring, the sketch hunt's frames, the gallery's balloons). Not wired: the Arena's waves, Chime pirates on the first flight. |
| **Onboarding and help** | `first-steps.js`, `companion.js` (Plumb's hints), `scout-hint.js`, `temples/hints.js`: not wired. |
| **The observatory quest** (`ObservatoryQuest`, the desert) | Not wired. |
| **The eclipse's sky** (`applyEclipse`), the Lantern's sky | `main.js` applies them each frame; the engine doesn't. |
| **The take-off's warp**, the galactic map's own page | The engine restarts at the climb's end; the holo table opens the Worlds page instead of `StarMap`. |
| **Benches, carriers, birds, `interact.js`** | Not wired (small life). |
| **The distant detail queue** (`deferred.js`, `lod.js`) | The engine builds everything at load. Load time on the Deck to measure (issue #364). |
| **Pause when away** | No `OnApplicationFocus` / `OnApplicationPause` in the bridge: the Steam button, the overlay or a suspend doesn't pause the game or silence it (the web does through `hiraeth:pause` and `src/audio-guard.js`). Screen dimming during play to check on the Deck (Electron holds `powerSaveBlocker`). |
| **The Updates section** | See 2. |
| **Graphics' `deck` / `auto`** | See 1. |
| **The keyboard's rebinding** | Web only. Not needed on a handheld. |
| **The language setting** | Left out on purpose (no other language for now). |
| **Pages**: the interactive changelog, lore, items, music, notes, references and the Lab, cinematics review | Not needed. What's new in the Start menu stands in for the changelog page. The Notes page (testers' notes to GitHub) is the one a tester on a Deck might miss. |
| **Achievements** | None in the web game either. |

## 4. The visual check: every world, web against Unity

Tools that exist: `scripts/unity-export/web-shots.mjs` (web shots from a views file) and `views-worlds.mjs` (views
for the C# port's worlds). `scripts/design-qc/capture.mjs` shoots worlds one by one in a muted headless Chrome and
cleans up after itself. `scripts/bench/viewpoints-worlds.json` has 14 worlds' bench views. The bridge's players take
`-level <id> -views <file> -out <dir>` (`BridgeArgs`: a list of views each with its world, or the worlds file).
`deck-worlds.mjs --shots` and `android-worlds.mjs` shoot the web on the devices, and `deck-unity.sh` /
`android-bridge.sh` shoot the players. There is no `unity-compare` script yet.

Proposed, `scripts/unity-compare/`:

1. **One views file for every world** (`views.mjs`, built from the game's data as `views-worlds.mjs` does, but from
   the levels themselves rather than the C# port's exports): the worlds of `ORDER`, `SIDE`, home and the Lantern.
   For each world: the foot of the ramp; the first person the main quest names, in conversation; a wide view; the
   first room of each temple (`view.temple`, which engine/unity/game.js already places); one interior (once portals
   work). Each view at a fixed hour (noon) and a dusk or night one, with the weather pinned. Then a handful of
   non-world views: the title, the Start menu, the game menu's Map and Items, a box's card, aboard the ship.
2. **The web side**: `design-qc/capture.mjs` with that file, High at 1280 × 720, a dev server on its own port (never
   5173), the HUD hidden.
3. **The Unity side**: the macOS player (`scripts/unity-js-player.sh`, `-mute -no-title -quality high`), world by
   world, the same views. No device is needed. On the Deck, a second pass at its preset, 1280 × 800 (`deck-unity.sh
   -views`), against `deck-worlds.mjs --shots`.
4. **Pairing and scoring** (`pair.mjs`, sharp): for each view, a side-by-side, a blink GIF, and numbers that
   find the ones worth looking at. Ink coverage (the share of dark pixels), edge-map overlap, colour distance in Lab
   by region, and SSIM at 256 px. Then an HTML contact sheet sorted worst first, written to
   `output/unity-compare/<sha>/` (not committed).
5. **Eyes on it.** The agent looks at every pair above the thresholds itself and files each difference against the
   part that draws it (the composite, a material port, a missing system from 3). The picked pairs go into the
   changelog's media as the fixes land. Run it again on every Unity release before the Deck's default moves to it.

## 5. Checklists

### The Deck's switch (in order)

| # | item | owner (code) | size | risk |
|---|---|---|---|---|
| D1 | **Doorways and portals in the engine**: `level.portals`, `passage.js`'s hand-over with its cover as screen state (BridgeHud), thresholds' light | `engine/game.js`, `src/passage.js`, `src/platform.js` screen, `BridgeHud.cs` | L | high (temples and interiors unreachable without it) |
| D2 | **Foes, combat and guardians in the engine**: `Foes`, lock-on and its camera, hitboxes, drops, low health, the guardians' fights and hints; gadgets given `foes` | `engine/game.js`, `src/foes.js`, `src/guardian-help/`, `BridgeHud.cs` (health, lock mark) | L | high (the route can't be finished) |
| D3 | Fragments, trials (**done**: engine/trials.js), hazards, the ending checked in play | `engine/game.js` | M | medium |
| D4 | **The store as a file**, PlayerPrefs moved into it once | `BridgeHost.cs` (`StorageGet/Set/Remove`), `BridgeArgs.SavedQuality` | S | medium |
| D5 | **The importer** (merge per slot by `lastPlayed`, backup of what lost, `hiraeth.imported.v1`) and the Unity → web export back | `BridgeHost.cs`, `src/save-slots.js` (the merge rules shared and tested in node) | M | high (saves) |
| D6 | **Electron's export mode** (`--export`, `__app/export`), `DESKTOP_API` 2, shipped through the runtime feed before D9 | `desktop/main.mjs`, `scripts/steam-deck/deck.py`, `tests/test_steam_deck.py` | M | high (saves) |
| D7 | Graphics' `deck` and `auto` in Unity's menu; the settings' keys checked one by one after an import | `engine/menus.js`, `BridgeArgs.cs` | S | low |
| D8 | **Pause when away**: focus and pause handlers, sound silenced, the screen kept awake; checked on the Deck (Steam button, overlay, suspend) | `BridgeRunner.cs`, `BridgeAudio.cs` | S | medium |
| D9 | [x] **The launcher picks the engine**: `engine.json`, the `web.json` kill switch, the player's ready file and watchdog, fallback to the previous player and then Electron, remembered per player sha. **Done, off by default** (`DEFAULT_ENGINE = 'web'`; `--engine unity` per Deck; the kill switch in `scripts/steam-deck/engine-switch.json`; tried on the Deck in a copy of the install: docs/steam-deck.md, "The engine") | `scripts/steam-deck/deck.py` (`launch_once`, `launch_unity`), `BridgeRunner.cs` (`-ready`) | M | high (black screen) |
| D10 | [x] **One shortcut**: **Hiraeth** runs `launch` (now Unity), **Hiraeth (web)** the fallback (renamed from the Unity entry, WEB badge), art and app ids kept; the player installed before registering, included in the settings' Download. **Done, follows the engine** (the preview's entry swaps its Exe to `launch-web` and back, its id kept; `desktop/steam/web/`) | `deck.py` (`add_shortcut`, `write_launchers`, `install_art`, `update_all`), `scripts/steam-art.mjs` | M | medium |
| D11 | **The player's feed on the site** in parts, GitHub second; the previous build kept for half-done downloads | `scripts/deck-runtime.mjs` or a sibling, `.github/workflows/cloudflare.yml`, `deck.py` (`get_unity_manifest`) | M | medium (Worker limits) |
| D12 | **Build gating**: the Linux player published only after `tests.yml` passes on its commit and a smoke run (Xvfb + lavapipe) | `.github/workflows/unity-android.yml`, `scripts/unity-publish.sh` | M | medium |
| D13 | **The Updates section in Unity's settings** (status, check, download with progress, restart → exit 76) | `engine/menus.js`, `BridgeMenu.cs`, `BridgeHost.cs`, reusing `src/updates.js` | M | low |
| D14 | **Script updates over the air** (`UNITY_API`, `minUnity`, `unity-<build>.zip`, `persistentDataPath/bundle/`, boot watchdog) | `BridgeRunner.cs`, `scripts/web-update.mjs`, `scripts/release-info.mjs`, `deck.py` | L | medium (advised before the switch, required before the Retroid) |
| D15 | ~~**The recorded music** decoded by Unity, the themes downloaded and kept~~ **Done** (2026-10-15: `BridgeMusic.cs`, `engine/unity/music.js`) | `src/soundtracks.js` (an engine path), `engine/webaudio.js`, `BridgeAudio.cs` | M | low |
| D16 | Foley, minigames, onboarding hints (Plumb, first steps, temple hints), the observatory, the eclipse's and Lantern's skies | `engine/game.js` | M | low |
| D17 | **The visual check** (section 4), every world, fixed differences | `scripts/unity-compare/` (new) | M | low |
| D18 | **Every world measured on the Deck**: Unity at or above the web in each (not just the three bench views), load times (#364) | `scripts/bench/deck-unity.sh`, `deck-worlds.mjs` | M | medium |
| D19 | The switch: the installer and the next update set `engine.json` to `unity`. A changelog line ("the Steam Deck now starts the Unity version"), and steam-deck.md rewritten | `deck.py`, `src/changelog.js`, `docs/steam-deck.md` | S | medium |

D1–D3 decide whether the Deck can switch without taking the game's second half away. D4–D6 and D9 decide whether it
can switch without losing a save or a launch. The rest can follow the switch, with the web shortcut still there.

### Then the Retroid

| # | item | owner (code) | size | risk |
|---|---|---|---|---|
| R1 | **Speed first** (#262): the Unity APK is GPU-bound (1 165–1 291 draws where GeckoView's web draws 100–450, 18–28 ms of GPU), behind GeckoView's 50–60 fps in open views. It has to match GeckoView in every world before anything below is worth shipping | `BridgeRenderer.cs`, URP settings, the mirror's batching | L | high |
| R2 | **The package**: the Unity APK takes over `com.rnaud.hiraeth` (same key, a versionCode above the web APK's, so the existing `Updater.java` offers it through `latest.json`'s `native`, and the app's data folder stays). Or it stays beside it and imports. Taking over means one icon and the update path for free, but no way back except an uninstall (which deletes the save). Decide with the author | `BridgeBuild.AndroidRelease`, `scripts/release-info.mjs` (versionCode scheme: Unity and web built from one commit can't share one), `android.yml` | M | high |
| R3 | **The web app mirrors its saves** to `files/saves.json` (`AppShell.mirrorSaves`, `NATIVE_API` 10), shipped and spread before R2's APK. The Unity app imports it (D5) | `android/…/AppShell.java`, `WebBundles.java`, `src/native-app.js`, `src/save-slots.js` | M | high (saves) |
| R4 | **Updates inside the Unity app**: the script bundle over the air (D14) and the APK offer (download, FileProvider, the install intent) | `BridgeHost.cs` or an Android plugin in the Unity project, `Plugins/Android` | M | medium |
| R5 | **Silent while away**, as NATIVE_API 7: pause and sound on `OnApplicationPause`, screen off | `BridgeRunner.cs` (shares D8) | S | low |
| R6 | Every HUD part and menu on 4:3 (Items and the Map are done) and the visual check's pass on the device | `BridgeMenu.cs`, `BridgeHud.cs` | S | low |
| R7 | The switch, its changelog line, android.md rewritten | `src/changelog.js`, `docs/systems/android.md` | S | medium |

### The Xbox (Unity already the one worked on)

| # | item | owner | size | risk |
|---|---|---|---|---|
| X1 | The store as a file (D4): PlayerPrefs on UWP are limited to 8 KB a value | `BridgeHost.cs` | S | medium |
| X2 | The web app's saves into the Unity package (the web writes `saves.json`, `xbox-unity.mjs saves` copies it, D5 imports) | `xbox/Hiraeth/MainPage.xaml.cs`, `scripts/xbox-unity.mjs` | S | low (one console) |
| X3 | The script bundle over the air into `LocalState` (D14). The package itself still comes through the portal | `BridgeRunner.cs` | S once D14 exists | low |

## Open questions for the author

- The Deck: switch once D1–D6 and D9–D10 land (the game finishable, saves carried over, a safe launch), or wait for the
  music and the minigames too?
- The Retroid: should the Unity APK take over `com.rnaud.hiraeth` (one app, no way back without losing the save), or
  stay a second app that imports once?
- Keep **Hiraeth (web)** on the Deck for good, or remove it after a release or two with no fallback in `launch.log`?
