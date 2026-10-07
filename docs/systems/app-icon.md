# The app icon

One picture from the game itself, every size made from it by `scripts/icons.mjs`.

## A capture of a reference view (October 2026)

The icon is the dish city of the desert's sheet IMG_3774 (`3774-dish-city`, view 22 of the
References level, docs/systems/references.md): the big pink dish on its stem over the blue domes,
the white saucer on the left, the sand in front, under the plain blue sky. It was chosen among
five views for how it reads at 48 px and in a 16 px browser tab: one big shape, strong colours
against the sky. The others are kept in `docs/icon/candidates/` (the floating island and its
monastery, the pink needles on peach, the bird over the palace cliff, the City-Shaft's tower in the
sea), and `docs/icon/candidates.png` shows all five at launcher and tab sizes.

- **Capture** (`node scripts/icons.mjs capture`): starts its own Vite (`PORT`, default 5853), opens
  `?level=references&view=<n>` in headless Chrome on the GPU (muted, the game's volumes at 0),
  hides the page's HTML (no HUD, no comparison overlay), the view's people and their capes, widens
  the held view's field of view (`zoom`) and can lower its camera (`lift`), renders a 1600 px square
  frame at 2x and cuts the icon's canvas out of it (`box`). The choice is `ICON` at the top of the
  script; `--view`, `--zoom`, `--lift`, `--box`, `--out` override it. The result is
  `docs/icon/capture.png`, committed: building doesn't need the game.
- **The canvas** is the adaptive icon's 108 units: the launcher shows the middle 72 through its
  mask and keeps the round 66-unit safe zone; the maskable web icon shows the middle 84 (the safe
  circle inside its 80% circle); the favicon the middle 64 (the dish larger in a tab).
- **Layers**: the sky is keyed out by a flood from the canvas's edges over pixels close to their
  neighbour and to the top row's colour (on a blurred copy, so the paper grain doesn't stop it; the
  ink outlines do). What is left is the adaptive foreground; the background is the sky alone, each
  row's colour; the monochrome layer (themed icons, Android 13+) is the foreground's silhouette:
  `mono: 'skyline'` (the dish city's) keeps what stands above the ground and a strip of the ground,
  `'inner'` only the shapes that don't touch the canvas's edge (for a floating subject, the island),
  `'all'` everything.
- **Build** (`node scripts/icons.mjs build`, or `all` for both steps): every size is drawn from the
  capture on a canvas in headless Chrome, halving down to the size:
  - Android `mipmap-*/ic_launcher.png` (legacy, a rounded square 1 dp in), `ic_launcher_round.png`,
    `ic_launcher_{foreground,background,monochrome}.png` (108 dp at each density),
    `mipmap-anydpi-v26/ic_launcher{,_round}.xml` (the three layers), `drawable*/splash.png` (the
    splash before Android 12: the icon on the paper colour, a third of the short side; Android 12
    and later show the adaptive icon).
  - the web: `public/favicon.ico` (16, 32, 48), `public/icons/icon-{180,192,512}.png` (the
    apple-touch icon, the manifest's "any" icons, the Play-style 512; the Steam Deck's shortcut and
    Electron's window use `icon-512.png` too) and `maskable-{192,512}.png` (the manifest's maskable
    icons). `index.html` links the favicon, the apple-touch icon and the 192.
- `tests/icons.test.js`: every file the Android build, the manifest and `index.html` name exists at
  its size, the adaptive icon has its three layers, the favicon holds its three sizes, and the view
  the icon is cut from is a References view.

The icon before (v0.16 to v0.63) was a small drawn observatory from `scripts/generate-icons.py`,
which this replaces.

## Steam's library artwork (the Deck)

The Steam Deck shortcut's capsules, hero and logo come the same way: `scripts/steam-art.mjs`
captures References views at Steam's sizes (`capture`, its own Vite and headless Chrome on the GPU,
muted; `docs/steam/capture-<art>.png`, committed) and `build` composes them with the title screen's
own lettering (`LOGO` in `src/title.js`, cream with an ink hairline, on the sky) into
`desktop/steam/`: the portrait capsule (600×900, `3786-island`, the floating island and its
monastery under the title), the wide capsule (920×430, `3784-cliff-monastery`), the hero
(1920×620, `3772-saucers`, no text) and the logo (1280×320, transparent, the same lettering inked,
since Steam lays it over the hero's sand). The icon is this app icon (`icon-512.png`).
`survey --views a,b --size WxH --out dir` captures candidates to choose from. They ship in the Deck
package only (not the web game); `deck.py` puts them in Steam's `grid/` (docs/steam-deck.md).
