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

The installer downloads the latest package. When it asks, choose **Steam → Exit**
and leave the installer open. It waits up to five minutes, then adds Moebius to
each existing local Steam account. Reopen Steam or return to Gaming Mode and
find **Moebius** under **Non-Steam**. Re-running the installer is safe.

The stable shortcut points to `~/.local/share/moebius-deck/launch`. Existing
shortcuts and custom fields are preserved. Changed shortcut files get timestamped
`shortcuts.vdf.moebius-*.bak` backups. Files with unsupported data are left alone.
Steam must be closed because it rewrites its shortcuts from memory on exit.

Use the **Gamepad with Joystick Trackpad** Steam Input template. Do not force a
Steam Play compatibility tool. The game starts fullscreen at a 1280×800 window
size and uses its existing controller controls. Exit through Steam's **Exit Game**
command, or Alt+F4 in Desktop Mode.

## Updates and saves

Each launch starts a background update check. A new build is downloaded into a
temporary directory, SHA-256 verified, and unpacked before the `current` symlink
is atomically changed. The running game keeps using its original build; the next
launch uses the update. Network failures never prevent an installed game from
starting. Updates include both the runtime and updater. The newest two builds
and any build still running are retained; older unused builds are removed.

The feed is the `steam-deck.json` asset on the dedicated `steam-deck` GitHub release.
Its build number advances even when the in-game version has not changed.
The checksum detects incomplete/corrupted downloads; it is not an independent
signature and trusts the GitHub release publisher and HTTPS.

- Game files: `~/.local/share/moebius-deck/`
- Save data and settings: `~/.config/moebius/` (separate from browser/Android saves)
- Update diagnostics: `~/.local/share/moebius-deck/update.log`
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
update manifest. The separate prerelease channel does not replace Android's
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
