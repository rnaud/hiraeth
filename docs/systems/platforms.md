# iPhone and the Steam Deck

Installing on iPhone as a web app; the Steam Deck package (full guide: docs/steam-deck.md).

## Install on iPhone

Open [the game](https://rnaud.github.io/moebius/) in Safari, tap **Share → Add
to Home Screen**, leave **Open as Web App** enabled if shown, and tap **Add**.
Launch the **Moebius** icon to play without Safari's address and bottom bars.
The game fills the screen; controls account for the notch and home indicator
in portrait and landscape. An internet connection is needed to load the game.

`public/manifest.webmanifest` uses relative URLs so installation works under
GitHub Pages' `/moebius/` path and at a site root. iOS metadata and a 180 px
Apple touch icon are included. Regenerate the icons with
`python3 scripts/generate-icons.py`.

## Steam Deck

A Linux package with automatic updates and Steam library integration is built by
[the Steam Deck workflow](../../.github/workflows/steam-deck.yml). See the
[installation and release guide](../steam-deck.md). The game inside it updates from the
game's site, like the Android app's (`deck.py` downloads the web bundle, `desktop/main.mjs`
serves it); the runtime package itself stays on the `steam-deck` GitHub release.
