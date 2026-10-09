Play Hiraeth offline on Steam Deck, with automatic updates and a non-Steam library shortcut.

In **Desktop Mode**, open Konsole and run:

```sh
curl --fail --location --output /tmp/install-moebius.py https://github.com/rnaud/hiraeth/releases/download/steam-deck/install-moebius.py && python3 /tmp/install-moebius.py
```

When prompted, use **Steam → Exit**. The installer adds Hiraeth to the existing
Steam accounts on the Deck, then you can reopen Steam or return to Gaming Mode.
No root password, Proton, or changes to SteamOS are needed.

Updates download in the background while you play and apply on the next launch.
The game itself updates from its own site (https://memento.alexandria-rnaud.workers.dev/);
the runtime package from this release, or by hand with `--from` (see the guide).
The installed game remains playable offline. Downloads are checked against the
release's SHA-256 checksum before activation; interrupted or failed downloads
leave the installed version intact. Progress stays in `~/.config/moebius`.

Use Steam Input's **Gamepad with Joystick Trackpad** template. Leave **Force the
use of a specific Steam Play compatibility tool** unchecked. Steam → Exit Game
closes the game in Gaming Mode; Alt+F4 works in Desktop Mode.

See [the Steam Deck guide](https://github.com/rnaud/hiraeth/blob/main/docs/steam-deck.md)
for details and troubleshooting. This is a non-Steam build, not a Steam Store release.
