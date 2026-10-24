# iPhone and the Steam Deck

(The Xbox, a package for consoles in Developer Mode: [xbox.md](xbox.md).)

Installing on iPhone as a web app; the Steam Deck package (full guide: docs/steam-deck.md).

## Install on iPhone

Open [the game](https://hiraeth.alexandria-rnaud.workers.dev/) in Safari, tap **Share → Add
to Home Screen**, leave **Open as Web App** enabled if shown, and tap **Add**.
Launch the **Hiraeth** icon to play without Safari's address and bottom bars.
The game fills the screen; controls account for the notch and home indicator
in portrait and landscape. An internet connection is needed to load the game.

`public/manifest.webmanifest` uses relative URLs so installation works under
GitHub Pages' `/hiraeth/` path and at a site root. iOS metadata and a 180 px
Apple touch icon are included. The icons are made from a capture of the game
(docs/systems/app-icon.md): `node scripts/icons.mjs all`.

## Steam Deck

A Linux package with automatic updates and Steam library integration is built by
[the Steam Deck workflow](../../.github/workflows/steam-deck.yml). See the
[installation and release guide](../steam-deck.md). The game inside it updates from the
game's site, like the Android app's (`deck.py` downloads the web bundle, `desktop/main.mjs`
serves it); each new runtime package has its own `steam-deck-<build>` GitHub prerelease. The advancing stable feed remains the game site’s multipart manifest; the old `steam-deck` release is an untouched fallback.

### Build-scoped Steam Deck packages (#618)

The permanent GitHub channel reached its 1,000-asset limit. The publisher now creates a draft prerelease for each runtime build, uploads its archive, installer and manifest, then downloads each through the authenticated asset API and checks exact bytes before publishing with `latest=false`. Retries verify existing bytes and resume a draft; mismatches stop publication rather than overwriting an immutable asset. No legacy assets or releases are deleted. The publisher verifies that the legacy installer and feed still exist, but never modifies them.

Cloudflare independently packages and verifies the runtime’s multipart feed and deploys the site atomically. Existing launchers already accept that exact site URL pattern and choose the newest valid site/legacy runtime, so they can receive the updated launcher without accepting a new host. If the site is unavailable, the untouched legacy feed and installed game remain available; the GitHub package publisher never advances the site feed. Changing deck.py and the packager changes the runtime key, forcing a fresh site runtime. New launchers additionally allow only the exact repository, per-build tag and matching archive filename; arbitrary hosts, tags and query suffixes remain rejected. Hosted packaging/download verification is required for release acceptance; local fake-API tests alone do not prove a GitHub upload.

This fix is web-only publication/Steam Deck launcher infrastructure. Unity gameplay, Android/native APIs, device settings and save formats are unchanged; no new gameplay or Unity rendering claim is made.
