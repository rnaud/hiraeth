# Steam Deck

Since the switch (v1.79, docs/plans/unity-default-portables.md D19) the **Hiraeth** shortcut starts the
Unity bridge's Linux player ("The engine", below): the same game's JavaScript drawn by Unity, faster in
every world (docs/systems/performance.md, "The Steam Deck, round 12"). The web build stays beside it for
good, as **Hiraeth (web)**, and is what the player falls back to.

The web build packages the web game with Electron for Linux x86-64.
Chromium renders the existing Three.js game; all assets are bundled for offline
play. It runs natively on Linux without Proton, root access, FUSE, or changes to
SteamOS's read-only system. It is distributed as a non-Steam game, not through
Steamworks or the Steam Store.

## Install

In Desktop Mode, sign in to Steam at least once. Open Konsole and run:

```sh
curl --fail --location --output /tmp/install-hiraeth.py https://github.com/rnaud/hiraeth/releases/download/steam-deck/install-hiraeth.py && python3 /tmp/install-hiraeth.py
```

(The repository is private now: this download needs a GitHub login, see "Install by hand" below.)
The installer downloads the latest package. When it asks, choose **Steam → Exit**
and leave the installer open. It waits up to five minutes, then adds Hiraeth to
each existing local Steam account. Reopen Steam or return to Gaming Mode and
find **Hiraeth** under **Non-Steam**. Re-running the installer is safe.

The stable shortcut points to `~/.local/share/hiraeth-deck/launch`. Existing
shortcuts and custom fields are preserved. Changed shortcut files get timestamped
`shortcuts.vdf.hiraeth-*.bak` backups. Files with unsupported data are left alone.
Steam must be closed because it rewrites its shortcuts from memory on exit.

In Gaming Mode the game runs on X11 under gamescope; in Desktop Mode on Plasma's own Wayland
(`ozonePlatform` in `desktop/main.mjs`): on SteamOS 3.8 with Mesa 26.1, X11 through Desktop Mode's
Xwayland crashed Chromium's GPU process and no window showed. The game also keeps the screen from
dimming or sleeping while it runs (`powerSaveBlocker`).

## Launching (`deck.py --launch`)

Steam starts `launch`, which execs `deck.py --launch`, which runs Electron and watches it
(`run_game`). Gaming Mode must never be left on a black screen:

- **No Steam overlay in Chromium.** Steam preloads `gameoverlayrenderer.so` (`LD_PRELOAD`) into
  every game; on SteamOS 3.8 it segfaults Chromium's zygote as it starts, and the browser then
  either aborts or waits for ever with no window (Gaming Mode's black screen up to runtime
  184001). `game_env` drops it; gamescope draws Steam's overlay itself.
- **A watched start.** Electron runs in its own process group. `desktop/main.mjs` touches
  `HIRAETH_READY` once its page has loaded; no window within 30 s counts as a hang.
- **Fallbacks.** A hang, a crash, or two GPU-process crashes (`main.mjs` exits 75) start it again
  the next way (`HIRAETH_GPU`): `gl` (ANGLE on OpenGL, the default), `vulkan` (ANGLE on Vulkan;
  fine on X11 under gamescope, fails on Plasma's Wayland), `software` (SwiftShader). The way that
  worked is remembered per runtime build and session kind (`gpu.json`); when none works the
  launcher exits 1 and Steam returns to its library. A crash or kill once the window has been up a
  minute (`PLAYED_SECONDS`) is not the way to draw failing: the launcher exits 1 and keeps that way
  (a game killed after 9 h of Gaming Mode once came back on Vulkan, and `gpu.json` kept it).
- **A clean exit.** Steam's Exit Game signals the launcher (SIGINT/SIGTERM); it sends SIGINT to
  the browser (which closes its helpers at once), kills whatever is left after 5 s, and after any exit kills Electron's leftover helpers (a
  zygote outliving its browser kept the game "running").
- **The update check runs outside the game** (`systemd-run --user`, its own unit), so Steam doesn't
  count the game running while a download finishes; without systemd-run it is a detached child.

Each launch writes `launch.log` (what ran, which way, how it ended) next to `update.log`.
Measured on a Steam Deck OLED (SteamOS 3.8.28, Mesa 26.1), title screen: Desktop Mode Wayland, ANGLE
on radeonsi GLES, 90 fps; nested gamescope X11, ANGLE on radeonsi GL 4.6, 60 fps (nested gamescope's
cap); `vulkan` on RADV and `software` on SwiftShader both draw under gamescope.

Use the **Gamepad with Joystick Trackpad** Steam Input template. Do not force a
Steam Play compatibility tool. The game starts fullscreen at a 1280×800 window
size and uses its existing controller controls. Exit through Steam's **Exit Game**
command, or Alt+F4 in Desktop Mode.

## Library artwork

The shortcut has its own artwork in Steam's library, from captures of the game and the title's
lettering (`scripts/steam-art.mjs`, sources in `docs/steam/`, images in `desktop/steam/`, packaged
as `resources/app/steam/`; see `docs/systems/app-icon.md`). `deck.py` (`install_art`) copies them
into each account's `config/grid/` under the shortcut's app id (read from `shortcuts.vdf`, the id
`add_shortcut` derives): `<id>p.png` the portrait capsule (600×900), `<id>.png` the wide capsule
(920×430), `<id>_hero.png` (1920×620), `<id>_logo.png` (transparent, laid over the hero) and
`<id>_icon.png` (the app icon; the shortcut's own `icon` field points at `icon.png` next to
`launch`). It runs at install, at `--register-steam` and in every background update. Only files
change, never `shortcuts.vdf`, so it is safe while Steam runs; Steam shows new artwork after it
restarts (Steam → Exit, or a reboot to Gaming Mode). Artwork the player picks in Steam (a grid
file we didn't write, `steam-art.json` keeps what we did) is never replaced. Re-running the
installer for an account that has the shortcut as it should be no longer waits for Steam to close.

A shortcut without a name or an icon is named
`Hiraeth` and given `icon.png` (`add_shortcut`, `shortcut_stale`), keeping its app id, playtime and
the player's own name if they changed it. That edits `shortcuts.vdf`, so only while Steam is closed
(Steam rewrites it from memory as it exits): at install, `--register-steam`, or a background update
that finds Steam closed (`steam_entry`). The grid files use the shortcut's `appid` from
`shortcuts.vdf`, unsigned (2165417005 on the author’s Deck before the ids were renamed; its 64-bit game id, in Steam's logs, is
`appid << 32 | 0x02000000`).

## The Unity preview (issue #146)

(How the Unity player came to the Deck, before the switch. Its download, its folders and its launch below are
still how the player is installed and run; what changed at the switch is which shortcut starts it: "The engine".)

A second shortcut, **Hiraeth (Unity)** ("Hiraeth (Unity preview)" until 1.73), starts the Unity bridge's Linux player (IL2CPP,
Vulkan; `docs/systems/unity.md`, measured in `docs/systems/performance.md`, "The Steam Deck, round
6") beside the game. It is for testers: no menus, conversations or pages yet, its own saves. The web
build stays the main shortcut, unchanged.

- **Its own component, not in the package.** The player (`hiraeth-unity-linux.tar.gz`, ~300 MB,
  built by `unity-android.yml` at its own pace) would triple the runtime package. `deck.py` reads the
  `unity-linux` release from GitHub's API (`get_unity_manifest`: the asset's `size`, its URL and its
  `digest`, `sha256:…`) and, when the digest differs from the installed one (`install_unity`),
  downloads it, checks size and SHA-256, unpacks it as the runtime is unpacked (no absolute paths, no
  `..`, no links; the build's `*_BackUpThisFolder_ButDontShipItWithYourGame` and
  `*_BurstDebugInformation_DoNotShip` folders left out; the player at the top or in one folder, as the
  workflow's `bridge-linux/`) to `unity/<first 12 of sha256>/`, and switches the `unity/current`
  symlink. The one before is kept; older ones are removed unless a preview still runs them (its
  `.in-use` lock).
- **When.** The installer installs it after the runtime and the game (a failure never fails the
  install, and **Hiraeth** starts the web until the player is there); the background update checks it too, reported as `unity` in `update.log` (never the
  exit code). The settings' Download (`--update --progress`) leaves it out. `--status-local` says
  which player is here (`unity`, its sha's first 12; the panel ignores it).
- **Launch.** `launch-unity` (written by `write_launchers` next to `launch`, with
  `~/.local/share/applications/hiraeth-unity.desktop`) runs `deck.py --launch-unity`: no player yet,
  it downloads one first (logged; none and no network: exit 1 and a line in `unity-launch.log`);
  starts the background update; pins `unity/current` and execs `hiraeth-js.x86_64 -screen-fullscreen
  1 -screen-width 1280 -screen-height 800 -logFile unity-data/player.log`, sound on, with `TMPDIR` set
  to `unity-cache/` (Unity's Vulkan pipeline cache lives in `temporaryCachePath`, under `TMPDIR`,
  which SteamOS clears at boot) and `XDG_CONFIG_HOME` to `unity-data/` (its `persistentDataPath` and
  PlayerPrefs; never `~/.config/hiraeth`).
- **Steam.** Each shortcut is known by its own Exe (`launch`, `launch-unity`). The preview's appid is
  Steam's scheme from its own Exe and name (`unity_appid`); the game's stays as it was. Its icon and
  library artwork are the game's with a UNITY badge (`scripts/steam-art.mjs unity` →
  `desktop/steam/unity/`, the runtime's `steam/unity/`; deck.py `UNITY_ART`, and `icon-unity.png` next
  to `icon.png` for the shortcut and `hiraeth-unity.desktop`), so the two read apart in the library and
  the menu. A preview shortcut still under its old name (or none) or the game's icon (or none) is
  renamed and given its own at the next install, `--register-steam` or update that finds Steam closed
  (`shortcut_stale`), keeping its app id; a name or icon the player chose stays. Accounts that have the game's shortcut get the preview's at
  install or `--register-steam`, or from a background update that finds Steam closed (`steam_entry`),
  with the same backup first; the update offers it once per account (`unity-shortcut.json`), so a
  preview the player removed stays removed until the installer runs again. As Steam runs whenever a
  game launches from it, an existing install gets the preview by rerunning the installer.

## The engine: web or Unity (one shortcut, a watched start)

**Unity since v1.79** (docs/plans/unity-default-portables.md, D9, D10 and D19: `DEFAULT_ENGINE = 'unity'` in
`deck.py`). Every Deck without an `engine.json`, a new install or one from before, starts the Unity player
from the launch after its runtime update, and its second shortcut becomes **Hiraeth (web)** the next time
the update finds Steam closed. The web runtime stays: **Hiraeth (web)** always starts it, the watched start
falls back to it, and one Deck can stay on it (or come back to Unity):

```sh
python3 ~/.local/share/hiraeth-deck/current/resources/app/deck.py --engine unity   # or web
```

- **The setting.** `engine.json` (`{"engine": "web" | "unity"}`, written by `--engine`; none: `DEFAULT_ENGINE`,
  `unity`).
- **The frame rate.** The player runs with vsync, held to the display's refresh (90 Hz on the OLED, 60 on the LCD;
  `BridgeRunner`, `QualitySettings.vSyncCount = 1`; `-vsync 0` uncapped). Uncapped, the worlds that run above 90
  showed their frames 9-14 ms apart; with vsync they show a new one at every refresh (performance.md, round 13). `--status-local` reports `engine` (what the next launch starts) and `engineSetting`.
- **The kill switch.** web.json's `deckEngine: 'web'` turns the Unity player off on every Deck, for a player
  build gone bad. It is set in the repository: `scripts/steam-deck/engine-switch.json` (`{"deckEngine": "web"}`,
  `null` to lift it), which `web-update.mjs` puts into the site's web.json at the next deploy
  (`release-info.mjs deckEngineSwitch`). The background update records what it read (`engine-remote.json`) and the
  launch reads that file, never the network: the switch takes effect at the launch after a Deck's next update
  check, and lifting it the same way. It only ever turns Unity off; it never puts a web Deck on Unity.
- **A watched start** (`launch_unity_watched`). With the engine `unity`, `launch` runs the installed player as
  `run_game` runs Electron: its own process group, Steam's Exit Game passed on as SIGTERM (10 s, then killed), no
  helper left behind. Ready is the file the player touches after its first frame (`-ready <file>`,
  `BridgeRunner.MarkReady`, which also logs `Hiraeth bridge: ready`), or, for players built before it, the line
  `Hiraeth bridge: script frame 1 took` in its log (`unity_ready` reads `unity-data/player.log` as it grows). No
  first frame within 120 s (`UNITY_READY_SECONDS`), or a crash before a minute of play, marks that player build
  `failed` in `unity-health.json` (by its sha's first 12; a player that drew is `ok`). Then the player before it
  (`unity/`, `prune_unity` keeps two) gets one try, then Electron, in the same launch and the same `launch.log`.
  A failed build is never started by `launch` again; a new player build gets its own chance. No player installed
  yet (the background update downloads it, ~300 MB) is the web at once. Closing before the first frame is not a
  failure. Exit 76 (a future Updates section's Restart now) launches again, as Electron's does.
- **Its own data.** The player's saves and settings stay in `unity-data/` (`XDG_CONFIG_HOME`, PlayerPrefs; the
  previous run's log kept as `player-prev.log`), the web's in `~/.config/hiraeth`. No migration between the two
  (the author's choice for now; the importer is D5): after the switch **Hiraeth** starts a new journey in the
  Unity player, the journey played on the web is where it was under **Hiraeth (web)**, and a fallback to the web
  plays the web's save.
- **One shortcut.** **Hiraeth** (Exe `launch`: its app id, playtime and artwork) starts the engine. The second
  shortcut is the other engine: **Hiraeth (Unity)** (`launch-unity`, the preview, unwatched) while the engine is
  web, **Hiraeth (web)** (`launch-web`, `deck.py --launch-web`: Electron whatever the setting) once it is unity.
  When the setting changes, the same Steam entry swaps its Exe (`second_shortcut`, `add_shortcut`): its app id,
  playtime and place stay, a name or icon we gave it follows (`Hiraeth (web)`, `icon-web.png`, the WEB-badged art,
  `scripts/steam-art.mjs` → `desktop/steam/web/`, `WEB_ART`), one the player chose stays. That edits
  `shortcuts.vdf`, so it happens with Steam closed: `--engine` itself, the installer, `--register-steam`, or a
  background update that finds Steam closed (`steam_entry`); until then the old entry still works (all three
  launchers are always written). An account that had removed the preview is offered the web shortcut once
  (`web-shortcut.json`). The desktop entries follow (`hiraeth-web.desktop` replaces `hiraeth-unity.desktop`).
- **Downloads.** With the engine `unity`, the settings' Download (`--update --progress`) takes the player too
  (its bar, `desktop/deck-updates.mjs`, still sums the runtime and the game only: it sits full while the player
  downloads; the Updates section in Unity, D13, is where that belongs).
- **A test copy.** `HIRAETH_NO_UPDATE=1` starts no background update; an install given with `--root` updates and
  relaunches itself there, never the usual folder.

Tried on the Deck (OLED, SteamOS 3.8, 15 October) in a copy of the install: hard links of runtime 2191001 and the
two installed players (`c50c16affbbf`, `cd1f87cbe8a9`) in a folder of its own, this deck.py, `--root`,
`HIRAETH_NO_UPDATE=1`, an `XDG_CONFIG_HOME` of its own for Electron, muted (`-mute --mute-audio`), in gamescope's
headless backend; Exit Game played by a SIGTERM to the launcher. The player's install, saves, settings and Steam
were left as they were.

- engine `unity`: the player `c50c16affbbf` up in 5 s (its log's first script frame: that player predates
  `-ready`), closed on the signal in 1–4 s, exit 0, marked `ok`.
- two players that never draw (a script that waits): each killed at 120 s and marked `failed`, then Electron up
  in 1.0 s, in the one launch.
- one that never draws, the real one before it: killed at 120 s, then `c50c16affbbf` up in 5.3 s.
- engine `unity` with `engine-remote.json` saying `web`: Electron straight away ("switched off for now").

### The install from before the rename

Decks set up before the game was renamed may still have `~/.local/share/moebius-deck`: its own two
shortcuts ("Hiraeth", "Hiraeth (Unity preview)"), `moebius.desktop` and `moebius-unity.desktop`, the
same names and icon as the current install's. Its updater reads the old site's feeds, which are gone,
so it stays at its last build (1.50 on the author's Deck). With Steam closed,

```sh
python3 ~/.local/share/hiraeth-deck/current/resources/app/deck.py --remove-old-install
```

takes it away (`remove_old_install`): the two shortcuts whose Exe is the old install's `launch` /
`launch-unity` leave `shortcuts.vdf`, and their library artwork, the two desktop entries and the
folder are moved into `~/.local/share/hiraeth-deck/removed-moebius-deck-<time>/`, with the
`shortcuts.vdf` as it was (per account) and `removed.json` listing what went. Nothing is deleted, and
nothing else is touched (the current install, the saves in `~/.config/hiraeth`, other shortcuts). It
refuses while Steam runs. Never part of an update.

## Install by hand

Once the repository is private, its release files need a GitHub login. Download the
package where `gh` is signed in (then copy the folder to the Deck, or run this on the Deck):

```sh
D=~/Downloads/hiraeth
gh release download steam-deck -R rnaud/hiraeth -D $D -p steam-deck.json -p install-hiraeth.py --clobber
BUILD=$(python3 -c "import json, sys; print(json.load(open(sys.argv[1]))['build'])" $D/steam-deck.json)
gh release download steam-deck -R rnaud/hiraeth -D $D -p "hiraeth-steam-deck-$BUILD.tar.gz" --clobber
python3 $D/install-hiraeth.py --from $D
```

`--from` installs the package next to `steam-deck.json` (checked against its SHA-256),
then registers the Steam shortcut as usual. The game inside then keeps itself up to date
from the game's site.

## Updates and saves

Each launch starts a background update check, of two things separately (one failing never
holds back the other; see `update.log`):

- **The game** (content): the same web bundle as the Android app's, from the game's site,
  https://hiraeth.alexandria-rnaud.workers.dev/updates/web.json (published by
  `cloudflare.yml`, see `docs/cloudflare.md`). A build newer than the one the runtime
  carries (`resources/app/content.json`) is downloaded, SHA-256 verified, unpacked to
  `web/<build>/` and used from the next launch: `deck.py --launch` pins it and passes it to
  Electron (`HIRAETH_GAME`), and `desktop/main.mjs` serves it at the same `hiraeth://game`
  origin, so the saves are the same. A game that doesn't reach its first frame within 60 s
  (or crashes first) is marked `.failed`, the packaged game takes over, and that build is
  never taken again. A build that needs a newer runtime (`minDesktop` above the runtime's
  `DESKTOP_API`) waits for one. The newest two and any one running are kept.
- **The runtime** (Electron, `main.mjs`, this updater and a packaged copy of the game): the
  newer of two feeds, the game's site (`/updates/steam-deck.json`, the package in 20 MiB
  parts, put there by the Cloudflare deploy: `scripts/deck-runtime.mjs`, see
  `docs/cloudflare.md`) and the dedicated `steam-deck` GitHub release (private now: that
  check fails quietly, a line in `update.log`). A new build is downloaded into a temporary
  directory, size and SHA-256 verified, and unpacked before the `current` symlink is
  atomically changed. The newest two builds and any build still running are retained. A
  runtime's build number is its commit's (`release-info.mjs build` × 1000 + attempt, the same
  in both feeds; run-numbered up to 189001 before). The site's runtime only changes when what
  it runs does (`main.mjs`, `deck.py`, the packaging, Electron's lockfile: its `key`); the game
  inside updates through the content feed meanwhile. Runtimes up to 189001 only know GitHub:
  install the first site-aware one by hand (above).
- **The music**: neither the runtime's packaged game nor a content update carries the recorded
  themes but the desert's (`scripts/site-only.mjs` `leftOff`; the key includes that file). The
  game downloads the others from the site in the background from the first launch, one at a
  time, and keeps them in the `hiraeth://game` origin's IndexedDB, in the Electron profile
  (`~/.config/hiraeth`, with the saves): a new runtime or content build never downloads them
  again. Settings > Updates shows "Music: 18 of 25 downloaded" meanwhile. How it works:
  `docs/systems/audio.md`, "The themes on a device".

The running game keeps using what it started with; the next launch uses the update. A game left
running doesn't update: on 7 October the author's Deck had run one launch for 9 hours (03:29 to 12:38)
and was still on runtime 814001 while the site had 830001; its own updater, run as a launch runs it,
installed 830001 and the newer game (`web/969`) in 15 s. (Runtimes from 830001 on also check from the
settings' Updates section.) Network
failures never prevent an installed game from starting. The checksums detect
incomplete/corrupted downloads; they are not independent signatures and trust the
publisher and HTTPS.

### The settings' Updates section

The same panel as the Android app's (`src/update-panel.js`, `src/updates.js`, controller-navigable,
in the title's settings and the Start menu): what runs, Check for updates, what the new version
brings, Download and restart with its progress bar, Restart now, Details (`update.log` and
`launch.log`). The page reaches the runtime at `hiraeth://game/__app/<method>` (`src/native-app.js`
picks that when the page is at `hiraeth:`; `desktop/main.mjs` answers `info`, `check`, `download`,
`restart`; anything else, or a runtime launched without deck.py, is a 404 and the section stays
hidden). `desktop/deck-updates.mjs` turns deck.py into Android's `AppShell.info` fields
(`platform: 'deck'`, `app` the runtime build, `web` the game running):

- **check** runs `deck.py --status` (what is here: `local_state`, the game the next launch would
  serve; the newest game on the site and the newest runtime on the feeds). One runs by itself 20 s
  after the start, so the section knows without a press.
- **download** runs `deck.py --update --progress <file>`, the same update as at launch (runtime,
  game, artwork); `progress()` writes `{step, got, total}` and the bar covers the runtime and then
  the game. A game that needs a newer runtime than exists waits, said quietly.
- **ready** is what the next launch runs differing from what runs (`deck.py --status-local`, read
  every 5 s while the settings are open, so a background update that finished shows too).
- **restart** writes `.restart` (the update it is for) and exits 76 (`RESTART_EXIT`): deck.py's
  launcher, still Steam's process, execs the current runtime's `deck.py --launch` again, which pins
  the new runtime and game. `HIRAETH_RESTARTED_FOR` keeps a restart that didn't bring that update
  from being offered again (no loop). The game opens at the title, the saves at the same origin.
  As on Android, a downloaded update also starts by itself the next time the title screen opens.

Tested on a Mac with a fake install (`--status`, `--status-local` and `--update` run anywhere with
an explicit `--root`, and `HIRAETH_HIDDEN=1` keeps the window off the screen): check, available,
download, ready, restart (exit 76, `.restart`), then the downloaded game served with nothing ready.

Runtimes from before content updates update themselves to one that has them (from GitHub,
while the repository is public): launch the game twice before the repository goes private.
`build.json` stays exactly `{build, version}`, as those updaters check.

- Game files: `~/.local/share/hiraeth-deck/`
- Save data and settings: `~/.config/hiraeth/` (separate from browser/Android saves)
- Downloaded game updates: `~/.local/share/hiraeth-deck/web/<build>/`
- Update and launch diagnostics: `~/.local/share/hiraeth-deck/update.log`, `launch.log`
- The Unity preview: its player in `~/.local/share/hiraeth-deck/unity/`, its saves and logs in
  `unity-data/`, its pipeline cache in `unity-cache/`, `unity-launch.log`
- The engine: `engine.json` (the setting), `engine-remote.json` (web.json's kill switch as last read),
  `unity-health.json` (each player build's watched start)
- Desktop launchers: `~/.local/share/applications/hiraeth.desktop`, `hiraeth-unity.desktop` (`hiraeth-web.desktop`
  in its place once the engine is unity)

For a manual update or to retry Steam registration, rerun the installation command.
For registration without downloading, run:

```sh
python3 ~/.local/share/hiraeth-deck/current/resources/app/deck.py --register-steam
```

## Build and release

`.github/workflows/steam-deck.yml` runs on pushes to `main` and supports manual
dispatch. It tests the installer, builds the web game, packages pinned Electron
for Linux x86-64, and opens the packaged game under Xvfb with software rendering.
Only after the game finishes loading does it publish the archive and then the
update manifest. The packaged game's build number (`WEB_BUILD`, `release-info.mjs build`) is
on the content updates' scale, so it checks out the whole history. The separate prerelease channel does not replace Android's
latest release. Only GitHub's built-in workflow token is needed.

Build locally with Node 24 and Python 3.10 or newer:

```sh
npm ci
npm --prefix desktop ci --ignore-scripts
npm run build
node scripts/package-steam-deck.mjs
python3 -m unittest discover -s tests -p 'test_steam_deck.py' -v
```

Output is in `output/steam-deck/`. Local builds use build number zero and are not
published to the updater. Cross-packaging on macOS is supported, but executing
the Linux game requires Linux. CI's software-rendering smoke test does not prove
frame rate, controller mapping, suspend/resume, or graphics-driver behavior on a
physical Steam Deck; those still need a device check.

## Troubleshooting and removal

If Hiraeth does not appear, exit Steam completely and retry registration. A Deck
with multiple Steam accounts gets one shortcut in each existing account.
If an update fails, inspect `update.log`; the installed build keeps working.
Do not add `--no-sandbox` to the installed shortcut. That flag is used only in CI.

Remove the shortcut through Steam's **Manage → Remove non-Steam game from your
library**. With the game closed, delete `~/.local/share/hiraeth-deck` and
`~/.local/share/applications/hiraeth.desktop` (and `hiraeth-unity.desktop`) to uninstall. Keep
`~/.config/hiraeth` to preserve progress.
