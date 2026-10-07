# Steam Deck

The Steam Deck build packages the web game with Electron for Linux x86-64.
Chromium renders the existing Three.js game; all assets are bundled for offline
play. It runs natively on Linux without Proton, root access, FUSE, or changes to
SteamOS's read-only system. It is distributed as a non-Steam game, not through
Steamworks or the Steam Store.

## Install

In Desktop Mode, sign in to Steam at least once. Open Konsole and run:

```sh
curl --fail --location --output /tmp/install-moebius.py https://github.com/rnaud/moebius/releases/download/steam-deck/install-moebius.py && python3 /tmp/install-moebius.py
```

(The repository is private now: this download needs a GitHub login, see "Install by hand" below.)
The installer downloads the latest package. When it asks, choose **Steam → Exit**
and leave the installer open. It waits up to five minutes, then adds Moebius to
each existing local Steam account. Reopen Steam or return to Gaming Mode and
find **Moebius** under **Non-Steam**. Re-running the installer is safe.

The stable shortcut points to `~/.local/share/moebius-deck/launch`. Existing
shortcuts and custom fields are preserved. Changed shortcut files get timestamped
`shortcuts.vdf.moebius-*.bak` backups. Files with unsupported data are left alone.
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
  `MOEBIUS_READY` once its page has loaded; no window within 30 s counts as a hang.
- **Fallbacks.** A hang, a crash, or two GPU-process crashes (`main.mjs` exits 75) start it again
  the next way (`MOEBIUS_GPU`): `gl` (ANGLE on OpenGL, the default), `vulkan` (ANGLE on Vulkan;
  fine on X11 under gamescope, fails on Plasma's Wayland), `software` (SwiftShader). The way that
  worked is remembered per runtime build and session kind (`gpu.json`); when none works the
  launcher exits 1 and Steam returns to its library.
- **A clean exit.** Steam's Exit Game signals the launcher (SIGINT/SIGTERM); it passes the signal
  on, kills whatever is left after 5 s, and after any exit kills Electron's leftover helpers (a
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

## Install by hand

Once the repository is private, its release files need a GitHub login. Download the
package where `gh` is signed in (then copy the folder to the Deck, or run this on the Deck):

```sh
D=~/Downloads/memento
gh release download steam-deck -R rnaud/moebius -D $D -p steam-deck.json -p install-moebius.py --clobber
BUILD=$(python3 -c "import json, sys; print(json.load(open(sys.argv[1]))['build'])" $D/steam-deck.json)
gh release download steam-deck -R rnaud/moebius -D $D -p "moebius-steam-deck-$BUILD.tar.gz" --clobber
python3 $D/install-moebius.py --from $D
```

`--from` installs the package next to `steam-deck.json` (checked against its SHA-256),
then registers the Steam shortcut as usual. The game inside then keeps itself up to date
from the game's site.

## Updates and saves

Each launch starts a background update check, of two things separately (one failing never
holds back the other; see `update.log`):

- **The game** (content): the same web bundle as the Android app's, from the game's site,
  https://memento.alexandria-rnaud.workers.dev/updates/web.json (published by
  `cloudflare.yml`, see `docs/cloudflare.md`). A build newer than the one the runtime
  carries (`resources/app/content.json`) is downloaded, SHA-256 verified, unpacked to
  `web/<build>/` and used from the next launch: `deck.py --launch` pins it and passes it to
  Electron (`MOEBIUS_GAME`), and `desktop/main.mjs` serves it at the same `moebius://game`
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

The running game keeps using what it started with; the next launch uses the update. Network
failures never prevent an installed game from starting. The checksums detect
incomplete/corrupted downloads; they are not independent signatures and trust the
publisher and HTTPS.

Runtimes from before content updates update themselves to one that has them (from GitHub,
while the repository is public): launch the game twice before the repository goes private.
`build.json` stays exactly `{build, version}`, as those updaters check.

- Game files: `~/.local/share/moebius-deck/`
- Save data and settings: `~/.config/moebius/` (separate from browser/Android saves)
- Downloaded game updates: `~/.local/share/moebius-deck/web/<build>/`
- Update and launch diagnostics: `~/.local/share/moebius-deck/update.log`, `launch.log`
- Desktop launcher: `~/.local/share/applications/moebius.desktop`

For a manual update or to retry Steam registration, rerun the installation command.
For registration without downloading, run:

```sh
python3 ~/.local/share/moebius-deck/current/resources/app/deck.py --register-steam
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

If Moebius does not appear, exit Steam completely and retry registration. A Deck
with multiple Steam accounts gets one shortcut in each existing account.
If an update fails, inspect `update.log`; the installed build keeps working.
Do not add `--no-sandbox` to the installed shortcut. That flag is used only in CI.

Remove the shortcut through Steam's **Manage → Remove non-Steam game from your
library**. With the game closed, delete `~/.local/share/moebius-deck` and
`~/.local/share/applications/moebius.desktop` to uninstall. Keep
`~/.config/moebius` to preserve progress.
