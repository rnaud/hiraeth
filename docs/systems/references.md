# The References: the reference sheets rebuilt

The `?level=references` level: each sheet's views rebuilt in the game.

## The References: the reference pages rebuilt (v0.57)

`?level=references` (`src/levels/references.js`, a `dev` level like the Lab: in the worlds list,
never on the route or the star map) rebuilds the scenes of the reference pages in `references/`
with the game's own materials, sky, light and ink, each seen from a fixed camera framed like its
panel, so the shaders can be checked against the look they are after. It starts with the six
panels of `references/The Desert/environement/IMG_3775.JPG` (`REFERENCE_VIEWS` in
`src/levels/reference-views.js`): the bones in the dunes, the fluted tower and its dishes, the
rope bridges over the gorge, the sail tents, the turquoise lake under the violet cliffs, the
buried hull. Then the desert's three other environment sheets, panel by panel
(`src/levels/reference-desert.js`, `DESERT_VIEWS`): IMG_3772 (six: the ribs on the dune crest,
the blue saucers over the spired city, the rope bridge over the ochre gorge, the petal station,
the salt lake under the violet table, the station of domes and masts), IMG_3773 (eight: the
ribcage between the dunes, the pink umbrella city, the bridge over the shaded canyon, the poles
on the pink plain, the fallen pod, the lagoons under the violet mesas, the stream in the red
canyon, the two buried helmets) and IMG_3774 (seven: the ribcage in the dune's hollow, the pink
dishes over the blue domes, the bridge over the dunes, the dish station, the slot canyon, the
turquoise pool in the violet cliffs, the buried blue heads): 27 views, `[ ]` cycling through them
sheet after sheet. The shapes the sheets draw again and again (ribcages, dishes on stems, gorge
walls, bridges, domes, petals, machine heads, table cliffs) are builders in
`src/levels/reference-kit.js`. The views lie on a square grid 3.3 km apart (`VIEW_SPACING`), so
neighbours stay over 3 km apart.

- **A view** is a panel: its crop of the sheet, its ground (a height function drawn as rings round
  the camera, fine underfoot and coarse at the horizon), what stands on it (built with the Lab's
  `RoomKit`), its colours (the colour script's five, read off the panel: sky, shadow tint, light,
  the same at every hour), its ink touches (`look`) and its people (small violet figures:
  ordinary NPCs, `referencePeople()` in content.js: the built world's). Its camera is `{ eye, yaw, fov, horizon }`:
  `horizon` is where eye level crosses the frame (0 top, 1 bottom), the pitch follows from it.
- **The sun** is given as the panel shows it, `{ side, el }` (degrees right of the line of sight,
  and high): the view's hour is the morning hour of that elevation (`sunHour`) and its group is
  turned about the vertical so the sun of that hour stands on that side (`sunTurn`). Nothing in the
  renderer is special-cased: the views are scenery, colour scripts, hours and presets.
- **The views** lie on a square grid, 3.3 km apart (`VIEW_SPACING`); only the one you are in is drawn.
  `[` and `]` (L3 / R3 on a pad) fade to the previous / next view and hold the camera on its
  panel (the traveller hidden where the camera stands); walk or look and the camera is yours
  again. `?view=<n>` opens on view n (`&world=<id>&view=<n>`: see "One world at a time"). The frame keeps the panel's proportions: on a screen
  narrower than the panel the field of view widens so its width still fits (`frameBox`).
- **Comparing:** `\` (View on a pad) cycles off → the panel in a corner → the panel over the frame,
  half seen through → the panel over the left half of the frame (a wipe). A label names the view,
  its sheet and its panel. The sheet is bundled by Vite (`new URL(…, import.meta.url)`) and
  cropped with CSS (`cropStyle`).
- `?look=desert` draws every view in the desert's own palette and plain Moebius print preset
  (blue-grey shadow tint, cumulus bank, clouds), to see what the shaders do unaided.
- `tests/references.test.js`: the level registers as a dev level, the four sheets have their 6, 6, 8 and 7 views (in order, not overlapping), whose
  cameras put the horizon where the panel has it, each sun comes from its side, `[ ]` and `\` work.

### The quick menu of views (v0.68)

`src/levels/reference-picker.js` (`ReferencePicker`, carried by the level as `level.quickMenu`): every
view at a glance, grouped by world and then by sheet (`pickerGroups`: the world is a view's `world`, its
sheet's, or the start of its sheet's name, "The Desert / IMG_3775.JPG"), each entry a tiny picture of its
panel, its number (as the label and `?view=n` count) and its title; the view you are in is marked
"here". Choosing one calls `level.goTo`, which fades there.

- **Open / close:** Tab; D-pad ↓ on a pad (the mount's button, free in this level: no mount, no taxi); the small "views"
  button at the top left (touch, mouse; hidden while a pad is in use); B / ○, Esc or a click beside
  the card closes it.
- **Moving:** mouse; arrows and Enter; d-pad or left stick and A / ×. Left / right step through the
  views in order, up / down go to the nearest entry in the row above / below; the focused entry is
  scrolled into view. `main.js` treats `level.quickMenu` as one of its menus: `busy()`, the pad's
  menu root, back and navigation (any level could carry one).
- **Thumbnails:** no image files. The list is built on the first opening, from `REFERENCE_VIEWS` and
  `REFERENCE_SHEETS` as they are then (new views show up by themselves); each sheet image is loaded
  once (the current view's first) and its views' crops drawn on their canvases as it arrives
  (`drawThumb`, `thumbSize`: the crop fitted into 132 × 84).
- `tests/reference-picker.test.js`: one entry per view, under its world and sheet, numbered as the
  level counts, its thumbnail drawn from exactly the view's crop of its own sheet.

### One world at a time (October 2026)

The level holds every world's views (169 over seven worlds when this landed) but loads and builds only
the world you go to. Building all of them made it the slowest load in the game (12–15 s to the first
view in headless Chrome on this Mac's GPU); one world is 2.0–4.4 s.

- **The registry**, `src/levels/reference-worlds.js` (`REFERENCE_WORLDS`): one entry per world,
  `{ id, name, count, load: () => import('./reference-<world>.js') }`, in the order the views are
  numbered. Each world's module exports `SHEETS` (its sheets by key) and `VIEWS` (its views, in order;
  the fields are described in `reference-views.js`). The level imports the registry only; a world's
  module is a dynamic import, a chunk of its own in the build.
- **Building:** `buildReferences` yields the world's import (the async runner waits for it,
  `src/load-steps.js`), then builds its views one step each. `createReferences` (sync, the tests)
  needs the world loaded first: `await loadWorld(k)`.
- **Going to another world** is another load of the page, at
  `?level=references&world=<id>&view=<n>` (`level.address`, after a fade): the world you leave goes
  with the page, and the new one gets everything a world gets on its load (its collisions, its
  water's bed maps, its people). `[ ]` past a world's end goes on into the next (or previous) world;
  `{ }` (shift + `[ ]`) jumps to the previous / next world's first view.
- **Numbers and places stay put:** views are numbered across the worlds (the label's "REFERENCE n /
  169", `?view=n`, `level.goTo(i)`), each world's first being 1 + the counts before it. View n stands
  in grid cell n − 1, its seeds as before; the grid stays 14 × 14 (past 196 views the cells go round
  again: one world is built at a time and no world has that many views). I compared 18 views (two or
  three per world) before and after, 1280 × 720. 11 were pixel-identical, and two more differed in under 0.01 % of their pixels. In
  the others, at most 0.4 % of the pixels differ once settled, and every difference I traced was
  something that moves: the panels' small figures (their idle pose, which
  varies between two runs of the same build) and a lake's moving ripple strokes. With a 5 s wait,
  that lake (view 140) also looked unfinished in the old build: there all seven worlds' waters
  queue to bake their bed maps, so its map wasn't ready yet. With a 40 s wait it matches.
- **The address:** `world=<id>&view=<n>` is the n-th view of that world (no `view`: its first);
  `view=<n>` alone the n-th across the worlds; `view=<a view's id>` that view, whichever world.
  Scripts that open a view (`scripts/changelog-shots.mjs`, `icons.mjs`, `steam-art.mjs`) open it by
  its id or number and find it in `level.views` (this world's) by `v.i`, its number.
- **The people** (`content.js`, `CONTENT.references.npcs`) are the built world's (`referencePeople`).
- **The quick menu** loads every world's module on its first opening (their code only: nothing is
  built), lists all their views, and draws the thumbnails of your world first and the others as
  their part of the list scrolls near. The worlds' names along its top, Page Up / Page Down and
  LB / RB jump between worlds; choosing another world's view loads the page there.
- **Everything at once:** `reference-views.js` still exports `REFERENCE_VIEWS` and
  `REFERENCE_SHEETS`, every world's, loaded through the registry (a top-level await): for the tests,
  the trailer's scenes and tools. The game never imports it.
- `tests/reference-worlds.test.js`: each entry's count matches its module, every sheet named for its
  world, the numbering and the address round trip, no world module imported statically by the game,
  a world built in steps only after its import.

### Adding a world

One new file and one registry line (the views keep their numbers: a new world goes at the end):

1. Write `src/levels/reference-<world>.js` (copy `reference-market.js`'s head): its sheets, named
   `'<World name> / <file>.JPG'` with the sheet's size and its bundled URL
   (`new URL('../../references/<folder>/<file>.JPG', import.meta.url).href`), and its views; end with
   `export { MY_SHEETS as SHEETS, MY_VIEWS as VIEWS };`. Build with `reference-kit.js`'s pieces and
   the world's own kit; give every view a unique `id`.
2. Add its entry at the end of `REFERENCE_WORLDS` in `src/levels/reference-worlds.js`:
   `{ id: '<world>', name: '<World name>', count: <its views>, load: () => import('./reference-<world>.js') }`.
   `name` must be the start of its sheets' names (the quick menu groups by it).
3. Open `?level=references&world=<world>` (`&view=<n>` for its n-th view). `node --test
   tests/reference-worlds.test.js tests/references.test.js` checks the count, the sheets and the
   build; add the world's own checks there.

Adding views to a world: add them to its module and raise its `count` (the test fails until it is).
Views added to a world before the last renumber the later worlds' views (`world=<id>&view=<n>`
addresses keep working).

### The City-Shaft's sheets, and three desert touches

- **Since October 2026** the blocks carry their small work (`blockWork`, its own random numbers so the
  views' layouts stay as framed): pipes down the faces with collars, a balcony with side rails and washing
  hung along it, and under an overhanging slab the plating (brackets back to the wall, boxes, a pipe along
  it). `blimp`: a teardrop envelope with four fins and a gondola (IMG_3780 p1 and p4, IMG_3782 p6); the
  cabs are the game's own (`cabModel`). On the world: see worlds.md (pink and cream walls, drainpipes,
  washing, plating under the terraces, blimps, turquoise water).

- **The views** (`src/levels/reference-shaft.js`, `SHAFT_VIEWS`): IMG_3778 (one plate) and IMG_3779
  to 3782 (5, 5, 5 and 7 panels), 23 views after the desert's 27, grouped by world (the label names
  the world, the sheet and the panel). One scene builder (`shaftScene`) does them all: walls of
  stacked houses jutting out by their own amounts, free stacks with houses clinging to their faces,
  overhanging slabs, awnings, walkways, cables, flying cabs, the shaft's water. Many look steeply up
  or down: a view's camera may give `pitch` and `roll` (deg) instead of a horizon. The blocks cast
  no shadow and a wall turned from the sun casts none of its slabs, so a street stays in the sun as
  on the sheets. The views lie on a grid now (`VIEW_SPACING`), and `?view=n` opens on that view's
  own hour.
- **Flat printed shadows** (`uShadowFlat`, post.js): 0 is albedo × the shadow tint; 1 is the tint
  itself at the surface's value, the way the sheets print the shaft's shade in one blue whatever
  the wall's colour. Off in every preset; the views' `SHAFT_LOOK` uses it. (Tried on the City-Shaft
  world: its trees turn grey-blue, so it stays off there until it can be set per material.)
- **Windows** (`makeMaterial({ windows })`): the share of a façade's cells with a window (0.78 as
  before); the sheets' houses and the City-Shaft's have fewer.
- **Far haze** (`uHaze`: rgb, amount): the colour distant ground fades to, instead of the sky's
  horizon. The desert's look (`DESERT_LOOK` in `desert-sites.js`, also `?look=desert`) sets a pale
  warm band and turns the print preset's cumulus bank and clouds off, as its plates. The desert
  world itself (`DESERT_WORLD_LOOK`, since v0.73) keeps the bank off but lets a few of the flat
  inked clouds back (`uClouds` `DESERT_CLOUDS` = 0.25, the print's 0.45), and with them the cloud
  shadows drifting over the dunes; the views and `?look=desert` keep the plates' clear sky.
- **The gorge in its rim's shadow** (October 2026): IMG_3775 p3's sun stands low on the right (`{ side: 95, el: 22 }`),
  so the right rim's cast shadow covers the gorge and climbs the left wall, the pink pillar further down lit over
  it, as the panel has it (the walls were form-shaded under a high sun ahead). No new shading: the shadow maps.
- **Slip faces**: sand's few shadow strokes (`hatch` 0.55) go back to full on steep slopes
  (`SHADE.slip`), so a shaded slip face is hatched and flat sand isn't.
- A zone's touches (`zone.look`) now start from the preset each time, so one view's never carry
  into the next.

- **Colours against the sheets (October 2026, v0.95)**, seen across the high terrace, down the shaft and up under a
  terrace: (1) the shade a grey-lavender (`#93a6cf` printed flat at 0.8) where IMG_3778–3782 print one saturated
  steel-cerulean; (2) cast shadows a step too dark (the print's spot tier); (3) the haze down the shaft a grey veil;
  (4) the walls' coral and cream and the sky already close. Changed: `SHAFT_DAY` (incal.js) the shade `#68a0be`;
  the world's look `uSpot` w 0.1 (the print's 0.2); `SHAFT_FOG` its most 0.62 (0.7) in a bluer tone. Still off: the
  trees' saturated green (the sheets draw few), the sheets' dense small work on every face.
  (the triptych before / after / reference: `changelog-media/0.95/shaft-colours-after.webp`; `tests/colour-pass.test.js`)

### The Desert's colours against its sheets (October 2026, v0.95)

Compared at the start, Qanat's camps, the rose canyon, the lagoons and the ribcage, against IMG_3772–3775. Gaps
found: (1) the golden dunes a pale cream (`#efd29b`) where every plate prints an ochre-orange; (2) a dune in shade a
khaki grey-olive (the ochre times the blue-grey tint `#93a6cf`, the print keeping 0.3 of the hue), where the plates
shade a deeper orange; (3) the shadows' own colour a grey-blue rather than the plates' violet-blue; (4) the mesas'
bands busier than the plates' flat lavender tables; (5) the sky, the haze and the line weight already close.

- **Changed** (desert only): `BIOMES.dunes.ground` `#eec07c` / `#f4d6a2` / `#d9955e` (biome.js: only the desert's
  terrain and its crash site use the biomes); `DESERT_DAY` (desert.js) the shade `#9b9bd2`; `DESERT_WORLD_LOOK`
  `uShadeKeep` 0.5 (`DESERT_SHADE_KEEP`). The References' `?look=desert` keeps `DESERT_LOOK` and its own sky.
- **Still off**: the mesas' strata; the canyons in the rim's shadow print darker than IMG_3775 p3's olive.
  (the triptych before / after / reference: `changelog-media/0.95/desert-colours-after.webp`; `tests/colour-pass.test.js`)

### Vael II's sheets (the Sky Stones)

`references/Vael/` is empty; Vael II's six sheets are the Sky Stones' (and draw Vael's lone tower
and bird too).

- **The views** (`src/levels/reference-vael2.js`, `VAEL2_VIEWS`): IMG_3783 to 3788 (5, 5, 5, 6, 6
  and 4 panels), views 51–81 after the City-Shaft's. One scene builder (`vaelScene`) with
  Sky-Stones-kit pieces (`table`, `needle`, `boulder` from `sky-stones-kit.js`, the aqueduct
  `bridge` from `arzach2.js`): needle clusters, mushroom tables (a cap `squash`ed into an overhang
  wider than deep), balanced and floating eggs, discs, floating islands, monasteries (`tower`,
  `chapel`, `palace`, `church`), aqueducts and natural arches, a sea of cloud in front of the camera
  (cauliflower puffs on a deck), the lone tower, the bird (`buildBird`, folded or spread, a rider).
  The framing was measured with a projector (sheet u, v at a distance → the view's local point).
  The views draw in `VAEL2_LOOK` (flat printed shade, no bounce, a clean sky).
- **A material's own flat print** (`makeMaterial({ shadeFlat })`, `SHADE.flats`): `uShadowFlat` was
  the world's, so the City-Shaft's trees went grey-blue with its walls. A material may now say its
  own: packed in the hue's steps past the hues (`gHatch.r`: 0 the world's, 1 … 9 a hue kept, 10 … 15
  the print in fifths; under 32), post.js reads it before the world's. Vael II prints its terrain,
  rock and buildings at 0.85 (`SKY_STONES_FLAT`); its people, bird and flowers keep their shade.
- **Rock hatched down its faces**: strata rock's strokes run down an upright face (8° off), not on
  the diagonal, as the sheets (and the desert's canyons) draw cliffs and needles; its projections
  blend more sharply (`pow` 8), and the cross-hatched rings round smooth forms are only drawn on
  upright faces, so a cap's or an overhang's underside no longer curls into wood grain.
- **On the world** (`arzach2.js`): `SKY_STONES_LOOK` (no cumulus bank or flat clouds, no bounce,
  little half-tone), a grey-teal shadow (`#93a6ac`, `SKY_STONES_DAY`), the needles with few shade
  strokes and no beds (`hatch` 0.4, `strataHatch` 0). `?look=vael2` draws the views in it
  (`WORLD_LOOKS`, with `?look=desert`).
- **One clean terminator down the needles and stalks** (October 2026, round 3; `needle`, `table` in
  sky-stones-kit.js): a needle's and a cap table's shading normals are a twin's, the same rings without the
  flutes, the fine noise and the underside's ribs, welded and smooth; the flutes stay in the outline. The needles
  draw in their own material without flat facets (`M.needle` in arzach2.js, `boneNeedle` / `pinkNeedle` in the
  views), so the shade runs down a needle as one band where the facets used to break into lit islands. View 52's
  column takes the same, lit from the left as its panel.
- **The crevasses' walls lit red-brown and hatched** (round 3; `CREVASSE` in arzach2.js, materials.js S_TERRAIN):
  the plain's steep faces take a red-brown (the terrain's third tone), never a spot black, and in light keep runs of
  strokes falling straight down them (a terrain material's `strataHatch`: the ground's strokes are laid from above,
  so on a wall they run down it). The world's fissures and the views' plains; view 65's crevasses widened to the
  panel's.
- **The cloud printed flat** (round 3; `CLOUD_PRINT` in arzach2.js): the world's puffs were pre-shaded in three
  fixed vertex tones, lit from one side whatever the hour, and self-lit; they now take the real sun with the print's
  flat shade (`shadeFlat` 1, lifted 0.55): a warm white in light, one pale grey-blue in shade, no strokes, no spot
  black. The views' clouds share it.
- **The shadow's grey-teal at every hour** (round 3; `SKY_STONES_DUSK`, `SKY_STONES_NIGHT` in arzach2.js): dusk's and
  night's colour scripts kept the print preset's old violet-blue shadow (`#8f88b8`, `#383650`); they now take the
  day's grey-teal, a touch warmer at dusk (`#9a9fae`) and deeper at night (`#3a4752`).
- **No planets in the views**: the References level's zones carry `planets: []` (references.js), so the views hang
  none, as the sheets draw none; the world keeps its two. (Checked in round 3: nothing to change; a test holds it.)
- **Cost** (M4 Pro, 1280 × 720, Vael II at spawn and turned, GPU median): High 11.4 → 8.6 and 9.5 →
  6.8 ms (the flat clouds gone), Handheld 2.1 → 2.0 and 1.6 → 1.5; the shader changes are a few
  selects, no new taps.
- **The colour pass (v0.95)**: the gaps were (1) the caps' stalks and undersides a near-black grey where the sheets
  shade them a light blue-grey under dense blue strokes (the cast shadow kept whole and its spot black grey), (2) the
  shade a greyer teal than the sheets' blue-grey, (3) the plain a little brighter and more orange than the sheets'
  muted coral, (4) no haze where the far plain meets the sky. Changed: the shade `#8ea6b8` (`TINT` in the views,
  `SKY_STONES_DAY` in the world), the light `#fbf4ec` / `#f8f0e6` instead of white; `SKY_STONES_CAST` and
  `VAEL2_LOOK` lift the cast shadows off the open ground a third (`uCast.y` 0.3) with a deep blue spot tone; the haze
  layers a pale lilac-blue. **Still off**: the horizon band is faint beside the sheets', and their stalks carry far
  more strokes.

## Spot blacks: a third tier of value (post.js `uSpot`, `uSpotTone`)

The sheets shade in three values, not two: the lit colour, the shadow (about ×0.55–0.7 of it) and
spot blacks, near-black masses (dark brown, olive or indigo, never pure black) with a hard edge,
filling the enclosed pockets: between ribs and pipes, into a hull or a machine's interior, the
recesses of the hanging city, and the cast shadow of a big mass (IMG_3774, IMG_3789–3792). Ours
stopped at the shadow tint (lifted further by the half-tone and the flat print); `uCrevice` only inks
the narrowest creases.

- **How enclosed** (`enclosure()` in post.js): from the G-buffer's depth and normals, the share of
  neighbours a pocket's radius away (`uSpot.y`, m) that stand in front of the point's face, from 8
  fixed directions (4 on the handheld preset, `uPostLite`). No jitter: the estimate is smooth from
  pixel to pixel, so a hard threshold of it (`uSpot.z`) is a clean-edged mass, not a speckle.
- **Where**: only in shade (`lit < 0.5`), less where the shade is lifted (half-tone, bounce, a
  material's `shade`), fading out by 600 m; never on a face, a person, the traveller, grass, a light
  or glass. A point facing the sun but in shade is in a cast shadow: it darkens toward the spot
  tone by `uSpot.w` (the world's knob for how dark big cast masses go), keeping its strokes.
- **The tone** (`uSpotTone`): rgb, and a how much of the surface's own colour it keeps (rust stays a
  dark rust, teal a dark teal).
- **Per world**: the presets (all of them say it; Moebius print `[1, 3, 0.3, 0.2]`), a world's
  `defaults.look` and a view's `look`. The Buried Machine `BURIED_SPOTS` (`[1, 3.5, 0.27, 0.45]`, a
  rust-brown tone keeping more of each colour); IMG_3774's views `INK_SHADOWS` (their cast shadows inked whole by `uInkShadow` instead, rendering.md "Ink shadows").
- **Per material** (`makeMaterial({ spot })`, `SPOT`): packed over the drawn detail in `gHatch.b`
  (+4 × (1 + step); the detail stays under 2); a self-lit or glass surface says 0, so do the
  references' clouds. Unsaid: the world's.
- **Debug**: `params.debug` 9 shows how enclosed each pixel is, 10 the cast (red) and spot (green)
  masks.
- **Cost** (M4 Pro, 1280 × 720, frames back to back, the tier off and on interleaved in the same
  page, 40 pairs): High desert 7.25 / 7.18 and 6.9 / 7.0 ms, Buried 12.8 / 12.7 and 7.1 / 7.3,
  City-Shaft 12.7 / 12.8 and 8.9 / 8.4, Vael II 9.7 / 11.4 and 8.4 / 8.5; Handheld desert 5.6 / 5.5,
  Buried 3.9 / 4.1 and 3.3 / 3.4, City-Shaft 7.0 / 6.9, Vael II 3.8 / 3.9. Within the run-to-run
  spread except Vael II's spawn on High (+1.7 ms, its many shaded overhangs pay the taps): the taps
  are only paid by shaded pixels within 600 m. No new GLSL features (WebView 109).
- `tests/shade.test.js`: every preset sets it, the packing, the shader's exclusions and the handheld
  taps.

## The Buried Machine's sheets (IMG_3789–3792)

- **The views** (`src/levels/reference-buried.js`, `BURIED_VIEWS`): IMG_3789 (5 panels), IMG_3790
  (6), IMG_3791 (6), IMG_3792 (5), views 82–103 after Vael II's. One scene builder (`machineScene`):
  domed huts half sunk in the dunes, pipe elbows with flanges, banks of pipes in a trench, walls
  pierced by ovals (an oval reaching the floor cut as a doorway), tanks, machinery against a wall,
  the teal drum open to the sky, the hanging city, the ring of arches with its town, derricks and
  hanging capsules, the sea of cloud (`cloudSea` from reference-vael2.js). The look `BURIED_LOOK`:
  shade the surface's own colour darkened (no flat print), a clean sky, the world's spot blacks.
- **On the world** (`buried.js`): `BURIED_SPOTS` in its `defaults.look` (the deep machinery and the
  canyon's cast shadows darker, a rust-brown spot tone); `?look=buried` draws the views in it.
- **Left, shader level**: the sheets' interiors are a dense mass of small inked machinery (pipes,
  boxes, hatches) at every scale; the spot blacks fill our pockets but our scenes have few of them,
  so most views show big plain faces where the sheets show texture. The sheets' clouds are soft
  cream masses with a few thin lines (ours are inked lumps, as Vael II). The hanging city's
  recesses are mostly lit on the sheets; ours shade as one mass. The canyon floor's dense
  stippling and the dunes' long shaded slopes (IMG_3790 p5: a slope in shade a flat sage band)
  aren't drawn.
- **Scene level, rebuilt (October 2026)**: `pipeMass` fills IMG_3789 p1's trench (long runs at several
  levels, inverted U-bends rising from a dark floor along it and across it, flanged risers, elbows over the
  lip; `bent` rounds each corner within 1.6 r), its camera raised to look down into it. `hangingCity` hangs
  its towers in clusters: a great one (`hangingTower`: tiers narrowing a little, bands, boxes on the shafts,
  an onion bulb, a short spike, now and then a cable) with three to six lesser ones packed round it, cables
  slung from cluster to cluster. `drum({ inside, roof, off, vault, ribs })`: tiers of arcades round the
  inner wall (dark round-headed bays, a few lit, pilasters, a cornice per tier) and machinery standing in
  from it; a vaulted roof with a central oculus, or (`off`) a flat ceiling with machinery hung from it and
  its oculus toward the far wall, as IMG_3791 p6 sees it from inside. `ovalTunnel` (IMG_3791 p4: a pale
  lit oval tube, ribs, rounded machine forms and pipes along it), `archPortal` (IMG_3792 p3: six recessed
  stone rings with their voussoir joints, a vault over them; the drum beyond is tall and pale, the moon a
  great disc with craters in its far wall), `rockLedge` (IMG_3792 p5: bevelled slabs stepping down and out,
  strata rock with cracks). IMG_3789 p5 now looks into the drum through the wall's oval (opened toward it,
  its vault casting no shadow, as drawn).
- **Left, scene level**: the ring's town and the far canyons; IMG_3792 p3 reads as a moon in a drum
  (the sheet's disc may be the sky through the shaft's top), and its vault's stone stays lighter than drawn.

- **Colours against the sheets (October 2026, v0.95)**, at the start, in the canyon, under the hanging city and over
  the dunes: (1) the sand a cool cream (`#f3ead2`), the sheets' a warmer one (`#fee5bb` read off IMG_3790 p1);
  (2) the dunes' shade a cold grey-brown (blue-grey tint), the sheets' a flat sage (IMG_3790 p1, p5); (3) the hanging
  city a teal-grey, IMG_3789 p2's a slate blue; (4) the canyon's rust and the sky's sage already close. Changed:
  `BURIED_DAY` the shade `#9cb0aa` and the sky `#b4c1a3`; the terrain `#f6e5c0` / `#efdcb4` / `#e0c79c`; the city's
  slate `#4d6680` / `#3b536c`. Still off: the clouds' undersides now carry the sage too (the sheets' are a pale
  blue-white); the interiors' dense small machinery.
  (the triptych before / after / reference: `changelog-media/0.95/buried-colours-after.webp`; `tests/colour-pass.test.js`)
## The Garden of Spheres' sheets (IMG_3793–3796)

- **The views** (`src/levels/reference-spheres.js`, `GARDEN_VIEWS`): IMG_3793 (4 panels), IMG_3794
  (6), IMG_3795 (6), IMG_3796 (6), views 104–125 after the Buried Machine's. One scene builder
  (`gardenScene`): umbrella trees (a lime canopy over a deep green underside, 44 thin branches fanned
  under it: the recess the spot blacks fill), stepped and smooth white pyramids, giant spheres and
  sphere-arches, the white hill's terraces with boulders, cave doors and shrubs, white ruins and the
  robot statue, olives, cypresses, round trees, the ringed plaza, lakes, paths, pink clouds. Foliage
  is welded before its normals (three's polyhedra are unindexed: they shaded faceted). The views draw
  in the world's own look (`GARDEN_LOOK` = `SPHERES_LOOK` and a clean sky); `?look=spheres`.
- **On the world** (`spheres.js` `SPHERES_LOOK`): no bounce lifting the canopies' undersides and the
  thickets, no warm grey kept in the white stone's shade (the sheets' pale blue), the spot blacks in a
  deep green (`uSpotTone`). Uniforms only: no cost. The real umbrella trees already carry branches under
  their canopies, so no greebles were added there.
- **Shapes from the sheets, October 2026** (`src/levels/garden-kit.js`, shared by the world and the views):
  - *Foliage in leaf masses* (`leafCrown`): a crown is a core and a few smaller balls bulging from it, each
    welded and smooth, so the ink draws each mass's own outline, as the sheets' olives, shrubs and woods. The
    world's shrubs are a core and three lobes (320 faces, the old lump's 180: there are 1 800 of them), its olive
    crowns are layered (`layeredCrown`: a broad tier, a narrower one over it a little to one side, a small cap,
    each its own leaf masses), round and about as tall as wide as the sheets' olives (800 faces, the four lumps'
    720); the views' have more and smaller masses.
  - *Spheres printed whatever the sun* (`crescentSphere`): two flat tones, the line between them one ring of
    vertices (the poles along the light), self-lit (`glow` 0.6), so the pale blue crescent stays where the panel
    has it. The world's spheres already were (`CRESCENT`); the views now are too, each sphere with its `lit`
    side (the view's sun by default), the sphere-arches painted the same way.
  - *The white hill's sculpted rock* (`pillowRock`): rounded pillows of stone, flattened on top, ring each
    terrace's wall (clear of the stairs, the canopy step and the cave doors), a few smaller ones stacked on
    them. In the world they collide as drawn (the contact audit): with the robot and the arcades the static
    collision is ~200 k triangles (179 k before; tests/spheres.test.js budget 215 k).
  - *Arcades* (`arcade`): a wall pierced by round arches, its top broken bay by bay; three in the android
    wood (solid as drawn), and in views 106, 110, 112 and 117 (the vaulted gallery is a great arcade now).
  - *The robot statue* (`robotParts`): feet, shins, knees, thighs, hips, a chest with its plate and vents,
    shoulder pads, arms to the hands, a domed head with its visor and an antenna; the world's and view 110's.
  - *The hedges' fruit* (`hedge`): clipped hedges of leaf masses with their fruit on the top and the long
    faces; the world's ring round the plaza (instanced: walk-through, as the shrubs were) and view 119's
    foreground rows, with the orange trees behind its plaza.
  - *The plaza's paving* (`paintPaving`): each ring's slabs a hair apart in tone, so the joints read; the world's
    plaza and the views'. Seen at a person's height across the rings, joints drawn as full ink lines crowded into
    dark bands (the plaza looked as though it lay in shade, round 2): the slabs are now 4.5 m (world) and 5 m (views,
    `PAVE`) wide and their tones only just apart, a light joint or a change of tone, and the sheets' pale plaza holds.
    Views 107 and 113 also take a higher sun from the side (el 50–55), so the avenue's shadows fall short of it.
- **Shading, October 2026**:
  - *The white stone's shade* (`WHITE_SHADE` in spheres.js: `shadeFlat` 1, `hatch` 0.08): printed flat in the
    day's pale blue with almost no strokes, on the world's and the views' white stone, rock, pillars, stairs.
  - *The canopies' undersides as branches* (`FORM.veins`, materials.js `veinLines`): the veins are a cap's
    radiating strokes drawn lighter, and now a vein that carries on to the coarser levels (toward the trunk) is
    drawn thicker, a bough the finer ones fork from, every vein wandering along its length. The world's
    umbrellas draw their underside in a veined material of its own (`M.under`) instead of painted stripes.
  - The views' compositions were checked against their panels: the grove's trunk (104), the lakes brought to
    the foreground (106, 112, 118), the ruins' wood behind the robot (110), the trees framing the lake temple
    (118), the monolith over a lower wood (124).
- **Cost** (desktop, M4 Pro, Chrome on Metal, the Handheld preset at render scale 0.75 without dynamic resolution,
  a tight loop of frames, five rounds alternating with the build before, median ms): spawn 4.27 → 4.75, under an
  umbrella 3.44 → 3.63, before the hill 4.13 → 4.32, the avenue 3.37 → 3.27, the plaza 3.01 → 3.07, the android
  wood 3.29 → 3.16 (the world's triangles 1.28 → 1.59 M, most of it the shrubs' leaf masses).
- **The lakes' printed reflections in the views** (`mirror` in reference-spheres.js, October 2026): what stands
  beyond a view's lake is mirrored in the water plane and projected back onto it along the line of sight from the
  view's camera (the world's mirror lake, spheres.js, does the same from the south shore), laid on the water as
  flat `waterPrint` shapes in each thing's own colour 38 % toward the water's, the nearer printed over the farther.
  Plain geometry built once: no reflection pass. Views 106, 112, 118, 123 (and 111's pool).
- **Left**: the avenue's grasses; the views' far woods are round trees, the
  sheets' dense tall trunks.

## Lorn II's sheets (IMG_3797–3800)

- **The views** (`src/levels/reference-lorn.js`, `LORN_VIEWS`): IMG_3797 (6 panels), IMG_3798 (6),
  IMG_3799 (5), IMG_3800 (6), views 126–148 after the Garden of Spheres'; the sheets are named
  "Lorn II / IMG_….JPG" for the quick menu. One scene builder (`woodScene`): cathedral trunks, giant
  pale mushrooms (perdide2.js's profile, gills under the caps), glowing egg heaps and coral pools, violet
  reeds and crystal spires, moss domes with lit doors, root arches with hanging roots, root caves glowing
  coral, the saucer, the skiff (perdide2.js `buildSkiff`) and its riders, the swamp's water and banks.
  The sun is low ahead in the coral gaps (backlit), and the wood's masses cast no shadow (the sheets'
  dusk light throws none). `?look=lorn2`.
- **Lights**: the References level now hands each view's local lights (`kit.light`: eggs, pools, doors,
  cave glows) to the shader, turned with the view; before, a view's lights were never used.
- **On the world** (`perdide2.js`): the giant mushrooms are pale in their own shade too (`shade` 0.6,
  the gills 0.4, fewer strokes), as the sheets draw them; `DEEP_WOOD_LOOK`, `DEEP_WOOD_DAY` exported.
- **Shapes from the sheets, October 2026** (`src/levels/wood-kit.js`, shared by the world and the views):
  - *The roots' tangle* (`braid`): a root is a bundle of strands twisting round its course, splaying where it
    meets the ground. The views' root arches are a core with six strands round it; the world's six great arches
    keep their solid core and wear four strands hugging it, solid as drawn as every root is.
  - *The caves' framing* (`caveFrame`): a cave mouth is a dark half-tunnel (its faces looking in) in the face
    of a root mass, arches of tangled roots over and round it, the outer ones larger and further back, roots
    crawling down its sides, feet crawling out along the ground toward you, roots hanging in the mouth, coral at
    its back when it glows. The views' caves (131, 137, 142, 147, 148) are built from it; the world's root cave
    keeps its tunnel and gains five arches and four feet over its mouth (solid as drawn: the static collision
    stays under its budget, ~190 k with the arches' strands and the nest) and 22 roots hanging in it (walk-through).
  - *The banks' bushes* (`bankBush`): a low mass of small leaf clumps; the world's 1 600 are four clumps of
    20 faces (100, the old ball's 80), the views' seven. A fringe of thin two-sided blades (`frondTuft`: ten in the
    world, 20 faces; thirty in the views) springs from their tops, so the silhouette stays ragged and leafy from
    afar instead of a smooth lump, and the ink draws each blade.
  - *The nest in the great cap* (`nest`): a woven bowl of root strands heaped with glowing eggs under a ribbed
    glass dome; on the great cap of view 128, and in the world on the flat cap of a giant in sight of the path
    north-west of the spawn (its bowl solid as drawn, the eggs and ribs not).
  - The views' framing was checked panel by panel: the reeds round the domes (126), the bushes on the banks
    brought into their panels (129, 130, 136, 140, 141, 146), the root arches lowered under the frame's top (129).
- **Shading: roots and bushes as dense hatched masses** (`ROOT_INK`, `BUSH_INK` in perdide2.js; materials.js
  `HATCH_DENSE`): a material's `hatch` over 1 is a hatched mass: its strokes up to 1.3 × closer, but never under
  4.5 px apart (`minPx`: closer, as they were at a distance where the hatch's own spacing tightens, they only read as
  a tone, and the bushes went smooth) and its shade drawn heavier (cross-hatched sooner), and a half-tone no
  longer thins them away. Roots 1.8, bushes 2.2, their shade lifted a little (0.45, 0.55) and never a spot black,
  so the strokes show over it; the cracks pattern and the flat facets are off the roots.
- **Cost** (desktop, M4 Pro, Chrome on Metal, Handheld at render scale 0.75 without dynamic resolution, a tight
  loop of frames, rounds alternating with the build before, median ms): spawn 4.46 → 4.18, under the arch 3.72 →
  4.10, the bank 3.56 → 3.83, the cave mouth 2.67 → 2.79, the nest 2.63 → 2.83.
- **Left, shader level**: the sheets' reeds are pale lavender blades in light; ours are thin cones whose
  outlines dominate. The sheets' far wood is layers of pale mist between trunks. Their hatched masses are drawn
  stroke by stroke along each root's fibres; ours follow the screen's hatch directions.
- **Left, scene level**: the lily pads; the views' egg heaps are fewer and larger than the sheets'.

- **Colours against the sheets (October 2026, v0.95)**, at the start and turned about it at 17:42: (1) the floor a
  dark slate (`#46686e`), the sheets' swamp a greener teal; (2) the crystal reeds near white (self-lit 0.5), the
  sheets' a lavender; (3) the near trunks a navy-grey where the sheets' are a deep teal; (4) the coral horizon and
  the violet mist already close. Changed: the terrain `#4d786e` / `#588276`, the reeds' tones a step deeper and
  self-lit 0.3. Still off: the trunks (their tone is in the instanced trunks' vertex colours, left as they are).
  (the triptych before / after / reference: `changelog-media/0.95/lorn2-colours-after.webp`; `tests/colour-pass.test.js`)
## The Signal Market's sheets (IMG_3801–3808)

- **The views** (`src/levels/reference-market.js`, `MARKET_VIEWS`): IMG_3801–3804 (one plate each),
  IMG_3805 (6 panels), IMG_3806 (3), IMG_3807 (4), IMG_3808 (4), views 149–169 after Lorn II's. One
  scene builder (`marketScene`): a street between two rows of towers (boxes and drums of pink, teal,
  cream and lilac, set-back bands and crowns, pipes running up their faces and machinery boxes clinging
  to them: greebles for the spot blacks), painted billboards, skybridges with their trusses, railings,
  pipes and walkers, market stalls with awnings and goods, flying cabs, cables, a crowd, the traveller
  seen from behind, a far spire on the axis. The views draw in `MARKET_VIEW_LOOK` (the world's look,
  a clean sky, the shade printed flat). `?look=bazaar`.
- **On the world** (`bazaar.js`): the walls, shops and blocks print their shade flat in the street's
  teal (`shadeFlat`, `MARKET_FLAT` 0.85): a pink wall's turned side goes blue-grey, as on the sheets,
  instead of dark brown; people, metal and lamps keep theirs. `MARKET_LOOK` and `MARKET_DAY` exported.
- **Left, shader level**: the sheets' walls are dense with fine line detail (panel seams, vents, signs
  in a hand's lettering) at every scale; ours are plain faces with a grid. The billboards are painted
  illustrations; ours are a few flat shapes. Far towers fade to a pale warm haze on the sheets.
- **Scene level, rebuilt (October 2026)**: `person` (two legs a stride apart, a coat flaring to its hem,
  shoulders, arms, a head, and a hood, a wide hat, a wrap or a bubble helmet, now and then a bundle)
  makes the crowd, denser near the camera, on the skybridges too and clear of the counters; `quiet` the
  pale lilac folk with broad heads (bazaar.js's), a few in the crowd and in the foreground of IMG_3801,
  IMG_3805 p6 and IMG_3807 p4. `stall`: a counter painted with round pictures, heaped bowls and jars, shelves
  of crates and pots, four posts, a slanted awning with a scalloped edge, strings of goods, a sign with
  strokes, a lamp, the seller behind. The cabs are the game's own (`cabModel` in taxi.js: the
  self-driving, round-bellied cab with its striped canopy and a rider).
- **Left, scene level**: the sheets' stalls are a dense heap of goods and signs; ours are tidy rows.

## The White Mangrove's pictures (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-mangrove.js`, world `mangrove`: `?level=references&world=mangrove&view=<1…4>`):
  four single compositions (1456 × 816), one view each: the landing stage before the lit roots and the long
  walk (1), the colonnade of root arches under the canopy (2), the stair between the two great trees down to
  the boat (3), the pale causeway and the tree towers in the rose haze (4). One scene builder
  (`mangroveScene`): the black lake (the water look, its bed 3 m down), the great white trees, root arches
  between them, houses on decks, plank walks with lanterns, stairs, flat boats and their boatmen, the lake's
  glowing creatures, the wood behind, the dark bushes at the frame's edges, the traveller with the
  luminous pack on the landing stage. `?look=mangrove`.
- **The shapes** (`src/levels/mangrove-kit.js`, shared with the world): `whiteTree` (a trunk rising out of a
  flared skirt closed underneath, a dozen great prop roots growing out of it, the upper ones falling over the
  skirt, each splitting into fingers at the bed, thinner feet between them, limbs sweeping out of a knot at the
  fork, a branch off each, puffs of pale leaves at their ends when asked, and the forks where a house sits),
  `rootArch`, `podHouse` (a lathed egg-dome with round windows and a lit arched door, a deck with a railing,
  struts and a fringe of sticks, a lantern), `walkway` (planks across, rails, stilts, lanterns on alternate
  sides; `sag` for a bridge), `stairs`, `punt`, `glowSpots`, `farTree`, `lantern`. Every root and limb is a
  `limb`: a tapered tube whose shade strokes wrap round its own course (each ring carries the curve's point
  and tangent as its form axis, src/form.js) and whose normals point straight out of the course (the tube's
  seam no longer inks a crease along every root).
- **The look** (`MANGROVE_LOOK`, `MANGROVE_DAY`, `MANGROVE_TONES` in the kit): no clouds, a violet sky, the
  light pink (the sky's light slot), the shade lavender-blue, stepped haze of a deep blue over the wood
  behind (view 4: a rose haze), a low mist on the water, cast shadows nearly lifted, few spot blacks.
- **On the world** (`src/levels/mangrove.js`, worlds.md "The White Mangrove"): the same kit at `detail` 0.72, the
  decked trees with no roots springing over their decks, the leaves round on the near trees and solid.
- **The scale, from the sheets**: the traveller is ~8–17 m from a 3–5 m high eye; the trees stand 25–60 m
  off, 2–4.5 m in radius, their roots springing 6–12 m up and reaching 8–15 m; the houses 2.5–5 m round.
- **Left, shader level**: the sheets' twilight comes from below and inside (the lanterns throw warm orange
  on the white roots); our local lights only lift the shade toward the lit tone, with no colour of their
  own, so the trees are evenly pink-white. The sheets' stars shine over a lit scene; ours need the night
  (`uNight`), so the views' sky is plain. The creatures glow with a soft bloom on the sheets; ours are
  flat lit spots.
- **Left, scene level**: the sheets' houses are a dense village (twenty or thirty in a view, on every limb),
  ours six to eight; their decks are ragged with sticks and ladders; the boats carry crates and lamps.
## The Glass Dunes' plates (references/The Glass Dunes/reference-1 … 4)

- **The views** (`src/levels/reference-glassdunes.js`, world `glassdunes`, `?level=references&world=glassdunes&view=n`):
  the four plates, one view each, after the Signal Market's. One scene builder (`dunesScene`) with the Glass Dunes'
  kit (`src/levels/glass-dunes-kit.js`, shared with the world, worlds.md "The Glass Dunes"): ridges of glass
  (`glassRidge`: a profile swept along a path, folded into leaning lobes), archways (`glassArch`), the glassworkers'
  camp (`awningCamp`), dark stones (`boulders`), ramps of sand against the walls, low glass flows over the sand.
- **The framing was measured off the plates**: the traveller's height in pixels and his feet below the horizon give
  his distance and the eye's height (9, 11, 7 and 1.35 m), and from them the camps' and the walls' distances. The
  scenes are smaller than they look: the walls 45–75 m off and 35–70 m high in plates 1–3, 300 m in plate 4.
- **The look** (`GLASS_VIEW_LOOK`): a clean sky, the far sand in stepped warm bands, the shade printed flat
  (`uShadowFlat` 0.85) in a teal-green shadow tint, so the glass's turned faces and the sand in its shade read as
  one luminous teal, as the plates print the light come through the glass. The glass draws a hairline in its own
  green (`line` 0.25, `lineTint` 1), never a spot black, a little self-light.
- **On the world**: the Glass Dunes (`?level=glassdunes`, worlds.md "The Glass Dunes") are built from the same kit:
  the giants' cliffs, the billows, a frozen wave and the breaking wave round a valley of sand, the two camps.
- **Off-frame casters**: plate 1's foreground shadow and plate 3's streaks of low sun across the sand are cast by
  glass mounds just outside the frame (the plates' light comes through dunes we don't see).
- **The glass shader** (October 2026, materials.md "Dune glass"): the views use the world's: the light through
  the thin glass and the grazing edges in mint and lime bands, the silhouettes cut hard inside, a deeper shade
  in the lobes, light pooled on the sand at the walls' feet (`glassPools` on the view's ground, turned by the
  view's own turn so the pools fall away from the sun). Plate 4's wave is rebuilt as the plate's tall arch: the
  curl profile rising steep at its left end (`ends` 16, `taper` 1.75 → 0) to ~130 m and sweeping down to the
  sand on the right, the camp under it, the walls behind pushed back and casting no shadow on the plain.
- **Left**: the glass is opaque (no parallax of what it holds); the plates' lit glass is a deeper emerald with
  blue in its tops, ours a paler mint; plate 2's billows still want rounder lobes; the plates' sand carries
  painted bands of light and shade more than our cast shadows do (plate 4's dark foreground band).
- **Colours against the plates (October 2026, v0.95)**, at the start, toward the west camp and the north wave at
  16:30: (1) the sand a flat salmon (`#f2c99c` under the amber light), the plates' a pale peach-cream (`#fee9a0`
  in light); (2) the glass a pale mint, the plates' a deeper emerald with bluer tops; (3) the far walls washed to a
  grey-green by the haze and fog, the plates' keep their green; (4) the print's flat sky, where the plates run from a
  warm peach at the horizon to a grey-teal; (5) the shade on the sand a dark teal, as plate 1's foreground. Changed:
  `SAND` `#f6dfb0` / `#f2d5a5` / `#e6bf8e`; `GLASS` mid `#5fca8f`, top `#3f9d8f` (kit: the world and its views);
  `GLASS_WORLD_LOOK` `uSkyFlat` 0, `uHaze` 0.32 (0.5), the haze bands' veil 0.07 (0.12), `uFogDensity` 0.0006;
  `GLASS_DAY` / `GLASS_DUSK` the shade a step lighter (`#5ea79f`, `#4caa92`). Still off: the plates' painted streaks
  of low sun across the sand; the glass's inner depth.
  (the triptych before / after / reference: `changelog-media/0.95/glassdunes-colours-after.webp`; `tests/colour-pass.test.js`)
## The City Behind the Waterfall's sheets (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-waterfall.js`, world `waterfall`: `?level=references&world=waterfall&view=n`):
  four 16:9 plates (1456 × 816, one view each), after the White Mangrove's. One scene builder (`fallScene`)
  with the world's own kit (`src/levels/waterfall-kit.js`, shared with the world, worlds.md): waterfalls
  (`waterfall`: a sheet in the falling-water shader, `src/waterfall-shader.js`, and a mist bank at its foot),
  lumpy faceted rock masses for the cavern's roof and walls (`rockMass`, casting their shade over the city),
  quarters of rounded houses climbing the back wall (`quarter`, built in their own frame through `framed`:
  terraces with their retaining walls and parapets, pods, vaults and rounded blocks with arched doors and
  round windows, a share lit amber, awnings, pots, lamps, stairs, copper pipes up the risers, residents),
  arched stone bridges, the sunlit valley far below seen past the falls (a terrain-mode plain). The look
  `WATERFALL_LOOK`: the shade printed flat in the cavern's teal, almost no hatching or half-tone, no bounce,
  a teal haze in stepped bands, a clean sky.
- **The falling water** (`makeMaterial({ fall })`, the FALL define): columns of four flat tones fixed across
  the sheet, their breaks streaming down at the fall's speed (long streaks, ~20:1), pen streaks falling a little
  faster in their own lanes (gone once a lane is under ~3 px), see-through slits where a column runs thin
  (discarded: the city or the valley shows through), a glassy lip under the top edge, a billowing pale mist band
  at the foot. Its own light (L = 1, no spot black), a thin line in its own colour, a soft halo (glow 0.72). The
  uv is in metres (`fallSheet`). Five value-noise taps a pixel, no texture.
- **Choices**: the sheets' falls are luminous: the sheet is self-lit rather than shaded by the sun; the roof
  casts its shadow, so most of the city sits in the teal shade with its lamps and lit doors, the sun slipping
  under the lip onto the front of the terraces (views 1, 2); views 3 and 4 light the street from the falls' side.
- **Left**: the sheets' houses are a dense heap of small volumes, balconies, plants and goods at every scale; ours
  are tidy rows of pods on terraces whose retaining walls still show too plain. The sheets' roof is a mass of
  blocky overhangs with deep pockets; ours a few lumpy slabs. View 3's and 4's cities stand a little far and low.

## The Salt Harbour's pictures (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-saltharbour.js`, world `saltharbour`:
  `?level=references&world=saltharbour&view=<1…4>`): four single compositions (1456 × 816), one view each: the
  street between the hulls, the market in the cleft, the gangway and the terracotta hull's ropes (1); the canyon of
  hulls with two gangways overhead and the ropes meeting in the street (2); the curtains hung from the high gangway,
  the arcade at the hull's foot, the ship at the street's end (3); the hulls' terracotta feet, the upright ships, the
  open salt beyond (4). One scene builder (`harbourScene`): ships (each a hull with portholes, house stacks on its
  flanks, shops and doors at its foot, herbs on ledges, upper works, mooring ropes from its flank to stakes in the
  salt), free house stacks against a plastered wall, sailcloths, curtains, gangways with people on them, ropes,
  shops, residents, the traveller with the luminous pack. The ground is the salt (`salt(mounds)`: barely rolling,
  mounds banked where asked, the crust's cracks and the sand's sparse ink, drifts banked against the hulls by
  `SandDrifts`). A ship behind the camera casts view 1's foreground shadow. `?look=saltharbour`.
- **The shapes** (`src/levels/salt-harbour-kit.js`, shared with the world): `hull` (a lofted hull on its keel:
  sections of a superellipse, the keel rising at the ends, `tumble` drawing the side in again over its widest as
  the pictures' round-shouldered hulls; painted white over a terracotta bottom `band` and/or under a terracotta
  `top`, each band its own geometry at a level line; `upright` stands it on its stern; `at(t, y)` finds a point of
  its side and the normal there, for everything built onto it), `portholes`, `archDoor`, `herbs`, `houseStack`
  (storeys of cabins out from a wall: balconies with rails and struts, doors and windows, shutters, washing, herbs;
  it reports its balconies' decks), `superstructure`, `cloth` (between four corners, sagging and folded),
  `curtain` (from a sagging top edge, in folds, its hem gently scalloped), `gangway` (planks, rails, a truss under
  it), `rope` and `stake`, `stall`, `figure`.
- **The look** (`SALT_LOOK`, `SALT_DAY`, `SALT_TONES` in the kit): a clean deep blue sky over a blinding salt, the
  shade printed flat in one blue-grey (`uShadowFlat` 0.85, as the pictures print every shadow on the salt and the
  hulls alike), little hatching, a warm pale haze in bands down the long streets, cast shadows kept whole. The hulls
  are plated (`plates`: rows of plates, staggered joints, each a shade apart), no weathering pen detail (its small
  rectangles read as stuck-on marks at this scale).
- **On the world** (`src/levels/salt-harbour.js`, worlds.md "The Salt Harbour"): the same kit at `detail` 0.7, the
  hull's `at()` on its facets (what is put on the plating sits on what collides), the street's ships solid.
- **The scale, from the pictures**: the traveller ~10–12 m from a 2.1–2.4 m eye; the near hulls 40–75 m high,
  40–60 m in the beam, 100–160 m long, 15–40 m off; the gangways 22–50 m up; the streets 25–40 m wide.
- **Left**: the pictures' hulls carry dense small work (rivets, hatches, vents, stains running down from the
  portholes) that our plating only hints at; their houses are many more and finer (a village on every flank), their
  sails layered three or four deep; the pictures' near ropes are a fan of hairlines, ours thicker strokes. Our
  views' compositions follow the pictures' masses (which hull where, lit or in shade), not every hull's exact turn.

## The Forest of Antennas' pictures (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-antennas.js`, world `antennas`: `?level=references&world=antennas&view=<1…4>`):
  four single compositions (1456 × 816), one view each: the path to the workshops under the immense navy receiver,
  backlit (1); under the great nest saucer, the workshops on their decks, the pink dish on its lattice, the
  maintenance bridge (2); the vine-grown masts and their nests, the pink receiver on its block over the domes (3);
  the great saucer over the egg and the domes, the stair to the observation platform (4). One scene builder
  (`antennaScene`): lattice masts with nest saucers and birds, dishes on lattice legs, a pedestal or a block,
  great saucers on their masts, the domes and the egg, vine-grown cables and plain wires, metal stairs and decks,
  the path, dark bushes, grass strokes, and the forest beyond. `?look=antennas`.
- **Placed off the sheets' pixels** (`sheetAt(cam, px, py, d)`, `sheetGround(cam, px, py)`, `sheetSpan`): a point
  drawn at pixel (px, py) and standing d m down the line of sight is put where the view's camera (its fov and
  horizon, so its pitch) sees it there; a mast is given by its foot and its saucer's rim in pixels (`mastAt`), a
  dish by its centre and half-width. A pixel above the horizon never meets the ground (`sheetGround` behind the
  eye): such a foot is placed with `sheetAt` at a distance instead. `tests/antennas.test.js` projects them back.
- **The sheets' flattened perspective**: their high saucers are drawn nearly edge-on (a thin rim, little of the
  underside) though they stand 25-40° up from the eye, which no camera does; the saucers are tipped toward the eye
  by a share of that angle (`tipEye`: 0.4 a mast's, 0.85 a great one's), the birds on their rims with them.
- **The shapes** (`src/levels/antennas-kit.js`, shared with the world): `latticeTower` (three or four tapering legs,
  X-braced bays, one diagonal under detail 0.6, vines climbing the legs with leaf clumps on them, strands hanging
  from the struts), `dish` (a paraboloid with its back shell to colour apart, the rim, a tripod, quad or boom feed
  at the focus, ribs on its back; `aimAt` turns it to a direction about its vertex), `saucer` (the flat nest dish:
  a shallow bowl on a conical underside, vines off the rim), `column`, `dome` (a workshop: round lit windows in
  dark frames, an arched lit door under its hood, a vent and a little dish on top), `egg`, `vineCable`, `cable`,
  `trussStair`, `deck` (railed, gaps where a stair meets it), `bird`, and unit far masts (`unitPole`, `unitSaucer`,
  `unitDish`). Caps and bowls hatch radially (`form` 'cap'), columns and the egg wrap.
- **The forest beyond** (`farForest`): 700-1100 masts from 70-140 m to 1.1 km, each a pole and a cap (a nest
  saucer, a tilted dish, a flower dish on a stalk), four instanced draws, each mast its own tone from a mid lilac to
  the haze's cream with distance. **No shimmer at distance**: a pole is never drawn thinner than `FAR_MIN_R` × its
  distance (1.6 mm a metre: ~1.5 px on the handheld's frame), and the far masts and the dishes' frames draw a thin
  line in a dark shade of their own colour (`line`, `lineTint`), not the world's black ink, so a mast a pixel or two
  wide is a pale stroke, not a crawling black one; the lattices further off are a lighter rust with a thinner line
  (`ironMid`).
- **The look** (`ANTENNAS_LOOK`, `ANTENNAS_DAY`, `ANTENNAS_TONES` in the kit): no clouds, a flat pale yellow sky,
  lavender shade, thin lines and light hatching, stepped haze in a pale cream from 90 m out, cast shadows lifted on
  the grass. Per view: the sky's five colours read off the sheet (view 4 an amber sky), the grass's three tones.
- **On the world** (`src/levels/antennas.js`, worlds.md "The Forest of Antennas"): the same kit at `detail` 0.6-0.85,
  the masts' bottom bay left open (`open`), their legs' stand-ins, every bar kept 1.5 px wide (`thin`).
- **Left, shader level**: the sheets' grass is a dense field of fine strokes, ours a few thousand instanced tufts
  and the ground's ticks; their far forest dissolves into a glowing horizon haze, ours steps into it.
- **Left, scene level**: the sheets' workshops are dense with machinery, decks and ladders, ours plain domes;
  their mid-distance lattices are fine pen work at every bay, ours a few struts; view 2's stacked domes reach up
  to the saucer's collar, ours stop lower.
## The Underwater City's sheets (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-underwater.js`, world `underwater`: `?level=references&world=underwater&view=n`):
  four 16:9 plates (1456 × 816), one view each, after the City Behind the Waterfall's: the two cafés under their
  domes, the bridge and the towers of pods (1); the white bridge into the city, the spires beyond (2); the street of
  pods down the canyon, the café shell on the left (3); the great café on the terrace and the lamps along the drop,
  the open sea (4). One scene builder (`seaScene`) with the world's kit (`src/levels/underwater-kit.js`, shared with
  the world, worlds.md "The Underwater City"). `?look=underwater` is not needed: the views use the world's own look.
- **The shapes** (the kit): `tower` (a pale salmon shaft, a solid ring every storey, round windows flush with the
  wall, some lit, a dome, spire or flat top, and pods round it: `podRing`), `pod` (a saucer underside, a band of
  lit amber glass with its mullions, a pale rim; open (a deck with plants) or domed (a roof of amber panes on
  ribs); on a stalk), `glassColumns` (tubes of luminous water, the bubbles one InstancedMesh of discs on the glass
  rising, moved by one mover), `cafeDome` (a glass dome on ribs, or a shell (`'teal'`, `'pink'`) with glass windows
  cut into it and a porthole, a door left open, its warm inside: the floor, tables and chairs, a counter and a
  dresser of bottles, pendant lamps, people at the tables; its `air` test), `walkway` (decks on piers with globe
  lamps), `lampPost`, `bush`, `kelp` (swaying), `rock`, `manta` (body and two wings beating, gliding round a loop or
  held), `fishSchool`, `swimmer`, `farCity` (plain towers far off, for the haze). `seaSurface` lays the sea's
  surface overhead (`userData.sea`: water.md "A sea").
- **The look** (`UNDERWATER_LOOK`, `UNDERWATER_DAY` in the kit): no clouds, the sky the far water's blue (top lighter
  toward the surface), the shade printed flat in the water's teal but the towers keep half their salmon in it,
  no aerial greying (it turned the salmon grey), haze layers from 70 m (× 1.5, 0.22 each): the near city keeps its
  colour, the far city goes to the water's blue. The sea's own pass (water.md) adds the banded tint from 25 m, the
  shafts and the caustics.
- **Light from within**: the pods' amber glass, the lit windows and the cafés' insides are self-lit just under the
  bloom's threshold (glow 0.5–0.58: no halo, no lift to white) with their shade lifted to their own colour; a shell
  casts no shadow on its inside, and is lined (a warm back-faced copy) so its windows show a warm room.
- **The light** comes from behind the camera in all four (as the plates light the towers' faces toward you), 44–52°
  high; the shafts lean away from it.
- **Left**: the plates' cities are denser (pods on every storey, balconies, plants in every pod, figures inside the
  amber glass); ours are tidy rings of pods. View 2's white bridge is a flat walkway, not the plate's arched span;
  view 3's canyon is a street, not the plate's dark water with walkways over it; the domes' glass draws only its
  rim (S_GLASS), where the plates draw reflections across it; the columns' swimmers are not there.

## The Fallen Ring's pictures (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-fallenring.js`, world `fallenring`: `?level=references&world=fallenring&view=<1…4>`):
  four single compositions (1456 × 816), one view each: the long tube in the grass with its village, the arch's leg
  rising behind it, the tilted segment on its crushed vermilion foot (1); the tubes broken open end-on over the vault
  and its village, the great arch overhead and a far one on the horizon (2); the arch swooping over to its broken
  vermilion end, the slanted segment over the village (3); the low segment lying round the village on its posts, the
  great arch rising out of it and down behind (4). One scene builder (`ringScene`): segments of the ring, villages
  along their feet, service stairs, trees from the hull, the grazing beasts, the cumulus, the path, grass tufts and
  the traveller. `?look=fallenring`.
- **Placed off the sheets' pixels**, as the Forest of Antennas' views (`sheetAt`, `sheetGround`, `sheetSpan`, copied
  in the module): a segment is given by three points of its centre line seen at three pixels and distances
  (`arcThrough(A, M, B)`: the circle through them and its frame), run on past its ends (`ext`) into the ground. A ring
  lying down (`lie`) has its frame turned so its section's z is up; it then runs from B to A, and `segment` mirrors
  what was given from A (its ends, bands, openings, trees).
- **The shapes** (`src/levels/fallen-ring-kit.js`, shared with the world): `ringSegment` (a superellipse section swept
  along an arc: the skin by rows and columns, its outward faces by winding; painted `bands`; `open` regions where the
  skin is cut away on the inside wall, the wall's thickness round the cut and ribs across it; broken `ends` ragged
  column by column, the inside shown `deep` m in and closed by a bulkhead; collars between its segments (`joints`);
  inside, floors across the section (`'r'`, the habitat's, concentric; `'z'`, level, for a tube lying down) or decks
  across the tube (`mode: 'x'`, an upright leg's storeys), houses and gardens on them; `at(t, s, off)` a point of the
  skin and its normal), `arcThrough`, `ringPose`, `tree` (an umbrella tree, its trunk forking under a layered
  crown), `village` (a row of cabins against a wall: lit windows, upper storeys, railed roofs, awnings, stalls,
  lanterns, crates), `serviceStair` (the antennas' truss stair), `grazer` (a woolly beast, head down), `puff` and
  `cloudBank` (the great cumulus: welded lumpy puffs in clusters with towers on top). The skin wraps its hatching
  round the tube (`aFormC` / `aFormA` per vertex: the centre line's point and tangent, kind wrap).
- **The look** (`RING_LOOK`, `RING_DAY`, `RING_TONES`): a teal-blue sky, a blue-green shade (the pictures' ivory in
  shade is a grey-teal), little hatching, the cumulus as geometry (no horizon bank, no flat clouds), a light haze in
  bands from 220 m and a thin fog, the aerial perspective's greying cut to 0.35 (with the Moebius print's, the cumulus
  at 500–700 m came out grey; now white with a pale blue shade).
- **On the world** (`src/levels/fallen-ring.js`, worlds.md "The Fallen Ring"): the same kit, `ringThrough` placing
  each piece by three points of its centre line, the hulls and what is inside them solid as drawn.
- **The scale**: the pictures' tubes 20–45 m round 50–200 m off, the arches' legs 50–75 m thick, their circles 250–900
  m round; the beasts 20–40 m off.
- **Left**: the pictures' interiors are dense little cities (terraces, hanging gardens, lit windows by the hundred);
  ours are a few decks of houses and gardens behind ribs. Their hulls carry fine panel work and stains; ours the
  built pen detail and collars. Their beasts are woolly; ours plain lumps. The tilted segment of view 1 bends at its
  crushed foot; ours is one arc.
- **The colour pass (v0.95)**: the gaps were (1) a duller, greyer sky (the pictures' cerulean deepens to the top),
  (2) the cumulus grey lumps in a black outline, where the pictures draw them white with a blue-grey shade and a
  soft line, (3) the hulls lit nearly all over (their undersides in the pictures a grey-green shade), (4) a crisp
  horizon over the plain, (5) too few darks. Changed: `RING_DAY` and the views' `SKY` deeper at the top, paler at the
  horizon, the light a cooler ivory; the cloud material lifts its shade less (0.4–0.45), its line thinner and in its
  own colour (`line` 0.45, `lineTint` 0.8), a little brighter (`glow`); `RING_LOOK` `uShadowFlat` 0.35, `uBounce` 0.12,
  `uSpot` [1, 3, 0.3, 0.35], a thinner line (0.85); `RING_HAZE` veils a little more from 200 m. **Still off**: the
  pictures' grass carries cloud shadows and a yellower light at mid distance; ours is one even green.

## The Moon Foundry's sheets (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-moonfoundry.js`, world `moonfoundry`: `?level=references&world=moonfoundry&view=n`):
  four 16:9 pictures (1456 × 816), one view each: the hung moon, the moon broken open round its courtyard, the bowl
  in its cradle (1); the great hung moon, the cutaway shell on its platform, the cratered moon in its cradle (2); two
  moons in their claws, the far moon between the pillars, the bridge across (3); the shells open on their gardens,
  the moon on its pillar, the long bridge (4). One scene builder (`foundryScene`), everything placed off the sheet's
  pixels (`sheetAt(cam, px, py, d)`: a moon is its centre and radius in pixels at a distance, a pillar its column at a
  distance). The kit is `src/levels/moon-foundry-kit.js`, shared with the world (worlds.md "The Moon Foundry").
- **A shifted lens** (`camera.shift`, references.js `lensShift`): these sheets put eye level low (0.81-0.935 down the
  frame) under monumental things, and keep every vertical upright. Pitching the camera up to put the horizon there
  made the pillars and cranes lean in like a fisheye. With `shift` the camera looks level and the screen is a window
  of a taller frame centred on eye level (`camera.setViewOffset`, as the title vista's tall screens use): eye level
  crosses the panel's box at its `horizon`, verticals stay vertical. Released with the held camera (the offset
  cleared); views without `shift` are unchanged. tests/references.test.js applies it when it checks the horizon.
- **The shapes** (the kit): `moon` (an ivory sphere; craters are shallow rimmed dents laid on it, each vertex on the
  sphere, so their inner wall shades as the sheets' crescents; `cut` breaks it open: a ragged hole, the shell's
  thickness, its inside in its own tone), `courtyard` (a floor across a broken moon just over the hole's lip, so the
  lip hides its front edge and the houses fill the opening; houses up to four floors under the shell's curve, a
  terrace on the back wall with its stair and a house, machinery on the inner wall, mint trees), `bowl` (a lower
  half-shell, plated, its row of ports, a deck with houses and trees), `cradle` (a drum and claw arms gripping a moon
  below its middle, knuckles, pistons, hoses, greebles round the drum), `hangRig` (the clamp ring on a moon's crown,
  its claws, the yoke, the hook block, cables to the trolley), `pillar` (banded, pipes, a cage ladder, a platform
  ring, greebles at its foot), `roof` (girder trusses both ways, a dark ceiling drawn as a grid, hanging cables),
  `gantry` (a railed truss walkway on legs), `house`, `tree` (garden-kit's `leafCrown` in mint), `jibCrane` (the
  antennas' lattice, no vines). The thin parts (trusses, rails, cables, ladders) are `thin` bars (src/thin.js).
- **The look** (`MF_LOOK`, `MF_DAY` in the kit): no clouds, a pale blue-mint sky to cream, a cool grey shade, haze
  layers from 130 m. Per view the sky's five colours read off the sheet (view 4 greener, its shells' insides mint).
  **The roof casts no shadow** in the views: the sheets light everything under it.
- **Molten metal**: the sheets show none (the foundry is abandoned); the world has one still-warm furnace of its own.
- **Left**: the sheets' machinery is dense pen work everywhere (the cradles' claws, the pillars' fittings, the
  stacked houses inside the shells); ours is cleaner and plainer. View 3's globes have their outer shell peeled off in
  continents over a darker machine layer, ours a ragged hole; the far moons are paler than the sheets' crisp ivory;
  the floor is plain where view 3 has grass and bushes along it.
- **The colour pass (v0.95)** (median value: the sheets 84–100, ours 137–156): the gaps were (1) everything
  lifted toward the light (the materials' `shade` 0.35–0.5), so a moon showed no terminator and the rust no dark
  side, (2) a saturated cyan sky where the sheets' is a greyer pale blue or mint, (3) a cool lavender-grey shade
  where theirs is a warm grey and dark rust, (4) a pale floor, (5) too little haze between the near and the far.
  Changed: the shade lifts lowered (`IVORY` 0.24, `METAL` 0.18 in the world; the views' shell, crater, rust, wall,
  steel and floor alike), `MF_LOOK` keeps a surface's hue in shade (`uShadeKeep` 0.6), lifts it less (`uHalftone`,
  `uBounce` 0.15) and lays more spot black (`uSpot.w` 0.35, a warm dark tone); `MF_DAY` and the views' `SKY` greyer
  tops and a darker warm shade; the floor a darker stone; `MF_HAZE` from 80 m, a heavier veil. Medians now 107–118. **Still off**: the
  sheets' raking light leaves half of each moon and much of the floor in shade (the roof's own shadow); ours stays
  mostly lit, and the sheets' machinery is far denser.
- **The views were stretched tall** after any resize (fixed in v0.95): a resize sets the camera's aspect back to the
  screen's, but `lensShift` kept its view offset, so the window of the taller frame was drawn squeezed. It now sets
  the offset again whenever the aspect is not the taller frame's (tests/moonfoundry.test.js).

## The Underside's pictures (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-underside.js`, world `underside`: `?level=references&world=underside&view=n`):
  four 16:9 pictures (1456 × 816), one view each: from a stair in the cliff's shade, the shelf's town near on the
  right, its tip far on the left, banners and baskets over the cloud (1); up the lit stair, the shelf's nose on the
  left, the tall silo houses along its face, a far rock with its tower (2); the nests under the shelf, the town's
  timber mass in its shade, baskets on long ropes from its underside near the tip, the cloud to the edge (3); at
  dusk, the fluted face lit rose, the white masses along it, the flat cloud to the horizon (4). One scene builder
  (`undersideScene`): the shelf (`shelfAt`), its town (the kit's `town`, in the face's frame), cliffs, the stair,
  the sea of cloud, the traveller with his great pale pack.
- **Placed off the pictures' pixels**: `sheetAt(cam, px, py, d)` (the point drawn at that pixel, d m deep) and
  `sheetPlane(cam, px, py, y)` (where that pixel's ray meets the level y, above or below the eye; the antennas'
  `sheetGround` for any level). A shelf is given by two points of its top front edge (`R` its root side, `P` its
  tip) on its top's level; its slab is laid behind that line, away from the eye, its root running on past R. Its
  free end is pinched on its back only (`slab({ pinch })`): pinched on both sides, the tip drew back 40 m from where
  the picture has it. A cliff is given by its near corner (`corner`: the edge the eye sees), its side toward the
  middle of the frame turned edge-on to the eye, so only its face shows. `tests/underside.test.js` projects pixels
  back through a camera.
- **The shapes** (`src/levels/underside-kit.js`, shared with the world): `slab` (a rounded block: its top flat, its
  sides cut in ledges with their own depths, cracked down, bulging in `pillow`s with creased valleys, lumpy, its
  underside hanging in lobes), `pod` (white plaster houses, round as swallows' nests: `dome` with a cupola, `egg`,
  `drop` (its crown buried in the underside, its foot on a deck), `bulb` (hung free); windows in deep frames, some
  lit; an arched door), `deck` (planks, beams, a rail, rods up to the rock only where the rock is overhead, struts
  back to a wall), `ladder`, `banner` (a long cloth from a bar, salt-harbour-kit's `curtain`), `basket`, `lamp` (on
  a cord), `stoneStair` (steps, the rock under the flight, a parapet), `shrubs`, `cloudPuffs` and `puffGeo` (the
  cloud's cauliflowers), `traveller`, `resident`; and `town(fk, M, rng, o)`: a town hung along a face in its own
  frame (x along the face, z out from it): decks in runs at each level from under the shelf out past its face,
  rows of shacks on them (salt-harbour-kit's `houseStack`) with a walk kept along the rail, a back wall of houses
  hung from the underside down to the lowest deck (so the eye under the shelf meets lit windows, not the sky beyond
  its far side), pods on the face's ledges and hung under it, banners from the outer edges, baskets on arms, lamps,
  herbs, people; `fill(x)` thins it toward the tip.
- **The look** (`UNDER_LOOK`, `UNDER_DAY` in the kit): no clouds drawn in the sky (the cloud is below), the shade
  printed nearly flat in a cool blue-grey, light hatching, deep spot blacks in the scaffolds' gaps, a warm pale haze
  in bands over the cloud. The rock is strata rock (`MODE_STRATA`, as Vael II's), not weathered: weathering's built
  pen detail drew panel seams and small rectangles on it. The cloud's shade is a visible pale blue (`CLOUD_PRINT`
  lifted 0.12, printed 0.6 flat), its puffs gently lumped (0.09): Vael II's sharper lumps read as ice floes from
  above. The foreground stair stands in the shade of a rock behind the eye (`shade`), as the pictures put it.
  `?look=underside`.
- **On the world** (`src/levels/underside.js`, worlds.md "The Underside"): the same kit at `detail` 0.6-0.8, the decks,
  houses and rails solid, the shelf's underside split off in a deeper stone (`splitFaces`), the cloud instanced.
- **Left**: the pictures' town is a far denser, warmer mass (balconies crowded with people and pots, timber lit by
  the low sun, every gap filled); ours reads as decks and rods with houses on them. The pictures' face bulges in
  big pillows of rock with dark creases, ours more gently; their white houses are lumpier and clumped like nests;
  picture 1's town is closer and larger than ours; their cloud heaps are softer, shaded in gradients.
- **The colour pass (v0.95)** (median value: the pictures 104–149, ours 157–208): the gaps were (1) the town's
  timber too light (the pictures' is a dark warm brown with amber windows), (2) the banners a hot orange (theirs a
  deeper red, half in shade), (3) the rock's shade a lavender where theirs is a warm grey, (4) view 3's sky too deep
  a blue, the horizons too cold, (5) few dark pockets in the scaffolds. Changed: `UNDER_TONES` wood, plank and banners
  darker; `UNDER_DAY` and the views' `SKY` a greyer, warmer shade and warmer horizons, view 3's sky softer;
  `UNDER_LOOK` `uSpot` [0.9, 3, 0.28, 0.3] in a warm dark brown. Medians now 125–208 (views 2 and 4 are mostly cloud, and barely moved). **Still off**: the pictures' town
  is a dense mass of decks, people and lamps; ours reads as rods and decks with the cloud showing through.

## Small machinery at every scale (`src/levels/greeble-kit.js`, October 2026)

The sheets' interiors and undersides are dense small machinery, and their black masses sit in its gaps; ours had
large plain faces, so the spot blacks (post.js `uSpot`) had no pockets to fill. `greebles(seed).patch(o, u, v, n, w,
h, { density, scale, depth, hang, kinds })` dresses a rectangle of a face with pipe runs (bundles of one to three on
brackets, flanges, now and then a valve), conduits up it, cable bundles along it, casings and louvred plates, and
under a ceiling (`hang`) pipes dropped on rods; `kinds: 'rock'` lays knobs and ribs instead. `merged()` gives one
geometry per role (metal, dark, pale, rock) for a world's buckets or a kit's. Pieces are 8–36 faces (`GREEBLE.faces`),
about 10 faces a square metre at density 1; a left-handed frame is turned round so nothing is drawn inside out.

- **The Buried Machine** (buried.js): the drum's inside wall between the tall windows, below the balcony and above it
  (solid as drawn: it is a jetpack world and you climb it), pipes hung under the balcony (drawn only), and clusters on
  the trench's leaning walls, one band over the banked sand, two quads in five, laid quad by quad on the drawn wall
  (solid). ~68 k triangles; the static collision ~195 k → ~257 k (bake +5 ms, ground rays +15 %; tests/buried.test.js
  budget 270 k); Handheld (desktop, scale 0.75, 7 rounds, median ms): the drum 3.13 → 3.05 and 2.52 → 2.99, the
  trench 3.51 → 3.76 and 4.48 → 4.47. The views: the drums' inside walls (`drumInside`), the machinery against the
  walls (`machinery`, its `fine` density) and the oval walls' feet (`ovalWall`, columns stopping under the ovals).
- **The City-Shaft** (incal.js): the terraces' undersides, between the ribs (a ceiling patch per 26 m of each sector,
  `hang`), large and sparse (scale 2.4, density 0.35: the shaft is the game's heaviest world), in its iron and a steel
  for the pipes; solid as drawn (you fly under them). ~140 k triangles, collision 973 k → 1 114 k (bake and rays
  within noise); Handheld: under a terrace 2.53 → 2.55, across the shaft 4.23 → 4.22, down it 6.33 → 6.39. The
  City-Shaft's views are refsB's (their houses' modelling), left to it.
- **Vael II** (arzach2.js, reference-vael2.js): the cap tables' undersides grow knobs and ribs of rock (`rockKnobs`,
  placed by `table().underAt(u, a)`, the underside as drawn), R × 3 of them, shaded with the underside's own normal
  (one dark tone; the ink draws their outlines and the crease shading their pockets); drawn only, with the drips.
  Handheld and High at the spawn, the needles, the cloud and the plain within noise (High spawn 7.75 → 7.88 ms).
- **View 52's grey-hatched disc top**: the eye stood 22 m under the disc, so its shaded underside filled the disc's
  place; the panel sees the disc nearly edge-on. The eye now stands a few metres under it (its pale top, a thin dark
  underside), the egg resting on it.
- **The Signal Market's back alleys** (bazaar.js): the towers' side walls into the alleys between them, the 14 m
  nearest the street, 22 m up, dense with pipe runs, conduits, casings and cables, in the street's ink, dark paint and
  cream; solid as drawn (you climb them). Collision ~27 k → ~52 k (tests/bazaar.test.js budget 56 k; bake +8 ms,
  ground rays +15 %); Handheld (against the same build without it): the street 3.98 → 4.08, looking up 3.68 → 3.82,
  in an alley 2.67 → 2.13 (noise). The Market's views are refsB's this round, left to it.

## Across the worlds: the shader gaps that recur

Ranked by how much they would close the gap to the sheets, across every world rebuilt:

1. **Detail lines at every scale** (all eight worlds): the sheets carry fine pen detail inside every
   surface (panel seams, vents, cracks, bark, rock grain, leaf clusters), denser near and thinning with
   distance, so a plain face never reads as plain. Ours draw outlines, creases and a few patterns.
   A per-material "detail density" of procedural pen marks (seams and small rectangles on built
   surfaces, grain strokes on organic ones), faded by screen size as the weathering is.
2. **Outline weight and colour per material** (Vael II's clouds, Lorn II's reeds, the Spheres' foliage,
   the Market's billboards): the sheets draw soft things (cloud, reeds, foliage, glass) in thin,
   lighter, coloured lines and solid things in black. Ours use one ink for everything, so soft shapes
   read as hard. A per-material line weight and tint packed into the G-buffer (as the shade is).
   **Done** (`makeMaterial({ line, lineTint })`, docs/systems/rendering.md, "Lines by material"): the clouds,
   Lorn II's reeds and crystals, foliage (`leaves`) and the Spheres' canopies, glass and the Market's
   billboards draw a thin or lighter line in a dark shade of their own colour.
3. **Aerial layers by depth** (Lorn II's mist, the City-Shaft's shaft, the desert's far dunes, the
   Market's far towers): the sheets separate planes by stepped pale bands of a warm or cool haze; our
   fog is one exponential tint (`uHaze` helps the desert). Stepped haze layers with their own colour per
   world, and a fog by height for shafts and woods.
   **Done** (post.js 4b, docs/systems/rendering.md, "Haze by depth and height"): stepped haze layers per world
   (Lorn II's violet mist, the desert's and the Market's warm bands, Vael II lightly) and a fog by height down the
   City-Shaft's pit and low in Lorn II's wood.
4. **Hatching that follows the form** (Vael II's and the Spheres' caps radiate, the Buried Machine's
   tanks wrap, rock runs down the face): strata now run down faces; radial and wrapping strokes need a
   per-vertex axis (a cap's centre, a cylinder's axis) in merged geometry. **Done** (`form`, `src/form.js`,
   docs/systems/materials.md "Hatching that follows the form"): caps radiate from the stalk, cylinders wrap,
   the Garden's dark undersides carry lighter veins.
5. **Cast shadows by world** (the desert's ink masses, Vael II's and Lorn II's near-absent ones): the
   spot tier's `uSpot.w` darkens them; a world knob to lighten or drop them (the sheets often omit a
   cast shadow on open ground) would let the plains read as the sheets do.
   **Done** (post.js `uCast`, docs/systems/rendering.md, "Cast shadows by world"): a cast shadow (facing the sun,
   yet shaded) lifted toward the light on open ground and elsewhere by the world's amounts, its strokes and edge
   line with it; Vael II's and Lorn II's plains and paths all but drop theirs, the Garden's lawns lighten.
6. **Per-face colour variation** (the Market's and the City-Shaft's towers, the desert's domes): the
   sheets vary a wall's colour in big flat patches (a repaint, a sunlit plane); ours are one albedo per
   material (`color2`, `color3` only in strata). **Done** (`patches`, docs/systems/materials.md "Colour
   across a wall"): each building's faces their own tone, repaints over one to three storeys, the odd
   storey in another render, world-anchored, a clean edge with no line, on every wall with built pen detail.

## The City During the Eclipse's pictures (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-eclipse.js`, world `eclipse`: `?level=references&world=eclipse&view=n`): four
  16:9 pictures (1456 × 816), one view each, after the Underwater City's: the square under the eclipse, the tables
  along the walls, the stair, the round tower (1); from the top of the steps, the stair down and the far city to the
  rose horizon, the terraces climbing on the left (2); the bowl of terraces round the square, the stars out at midday
  (3); down the street of steps, the washing, the city falling away to the horizon (4). One scene builder
  (`cityScene`) with the world's kit (`src/levels/eclipse-kit.js`, shared with the world, worlds.md): houses
  (`house`: rounded blocks, drums, towers, flat or domed, arched doors, windows some lit, flower
  boxes, antennas), terraces of big masonry blocks, broad stairs with cheek walls, tables with their cloths,
  lanterns and diners, lamps (globes, posts, hung, the big paper lanterns), awnings, the rooftops' poles and
  sheets, washing, the pale figures (`paleFigure`: leaning out from a wall, hung over a parapet, standing), the far
  city (`farQuarter`), the traveller with his glowing lantern pack.
- **The eclipse where the picture has it**: each view's `eclipse` ({ side, el } from the line of sight, its disc's
  size, the corona's reach, style and colour, the stars) becomes its look's eclipse uniforms (`eclipseUniforms`),
  the direction through `eclipseAt` (references.js's sunTurn, so the disc lands where it should whatever the view's
  sun); the view's `sun` stays high and lights the city from the sky (the pictures' faces toward the eclipse are
  lit, not black). Picture 1's corona is a short ring of fine white rays under a plain blue sky; 2's a peach stipple;
  3's a white stipple among stars; 4's long fine peach rays (rendering.md "The eclipse").
- **The look** (`ECLIPSE_LOOK`, `ECLIPSE_TOTAL` in the kit): a flat sky, the limewash lit a cold lavender and its
  shade printed flat in a deep violet (read off the pictures: lit walls #9589e6 … #5c4e99, shade #3c3a68), little
  hatching, few spot blacks, cast shadows lifted on open ground, a rose-lavender haze in bands; the lamps' pools
  amber on the walls (`lampTint`). `?look=eclipse`.
- **Left**: the pictures' city is far denser (stairs everywhere, ledges, plants, crowds at every table); our walls
  are plain masonry faces where the pictures carry deep detail; the pale figures are simpler; picture 3's pink
  cloud streaks are left out; the compositions follow the pictures' masses, not every house.
- **The colour pass (v0.95)**, each view beside its picture (median value, the pictures' 88–145 against ours'
  130–173 before): the gaps were (1) the whole city a step too light, (2) a pale pink-violet where the pictures are
  a blue lavender, (3) a shade not deep enough (ours #45436d, theirs #2c2f61), (4) almost no shadow masses or spot
  blacks, (5) view 4's horizon band a hot pink where the picture is a pale lavender. Changed: the light tints a step
  darker and bluer and the shade a deeper indigo in `ECLIPSE_TOTAL` and the views' `SKY` (blue, deep, night,
  steel); the paving, stone and masonry a little darker (`ECL_TONES`); `ECLIPSE_LOOK` lifts the shade less
  (`uHalftone` 0.2, `uBounce` 0.15), keeps more of the cast shadows (`uCast` [0.35, 0.15]) and lays more spot black
  (`uSpot` [0.9, 3, 0.3, 0.3]); view 2's sun from the left (`side` −60), so its left houses stand in shade as
  drawn; view 4’s eclipse glow lavender. Medians now 108–153. **Still off**: the pictures' dense small detail (stairs,
  ledges, plants, crowds) gives them their many small darks; our walls stay broad and even.

## The City Floating in Space's pictures (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-spacecity.js`, world `spacecity`: `?level=references&world=spacecity&view=n`):
  four 16:9 pictures (1456 × 816), one view each, after the Fallen Ring's: from the balcony, the arched bridge over
  the void to the heaped quarter, the planet's edge filling the upper right (1); under the crescent, the broad market
  bridge crowded between two heaps, the far arches (2); the two arches one over the other from the towers to the
  middle stack, the city running on under the great planet, its dark side mauve (3); the market island and the
  bridges round it, the full planet behind the big houses (4). One scene builder (`spaceScene`) with the world's kit
  (`src/levels/space-city-kit.js`, shared with the world): islands, heaps, bridges, the balcony's railing or parapet,
  pipe stacks, walkers on the decks, the traveller with his glowing bottle.
- **Over the void**: a view's ground is the balcony's floor near the camera and 900 m down everywhere else, and is not
  drawn (`ground.hidden`, one line in references.js); the stars go on below the islands (rendering.md "Space").
- **Placed off the pictures' pixels** (`sheetAt`, `sheetGround`, `sheetDir`, as the Forest of Antennas' views): the
  balcony's line, the traveller's feet, a bridge's ends are pixels of the picture at a distance or on a deck's level.
  **The planet** is given as its disc on the picture (centre and radius in pixels, fitted to the limb's pixels) and
  lit from where its sun is in the picture's terms (`light: [right, up, toward us]`): `planetOf` turns it into the
  view's planet (azimuth, height, angular radius: the mean of the angles to its limb on four sides, since the
  projection stretches a disc off the axis) and its `uSpaceSun`, `uSpaceNight`. references.js carries a view's
  `planets` into its zone (one word: they were always none).
- **The shapes** (`space-city-kit.js`): `island` (a slab of a rounded outline, its deck a paving plate, a parapet
  round it open at its gaps, under it the machinery: stepped masses of its outline shrinking, tanks and pipes hung
  from them, greebles under the slab, cables straight down or sagging in loops, teal and amber lamps), `heap` (houses
  over the deck heaped into a mound: each house carries more storeys the nearer it stands to the mound's top, each
  a little smaller and set back; optional terraces), `quarter` (the houses: eclipse-kit.js's `house` with the city's
  materials, `spaceMats` having eclipse-kit's keys; on the roofs dark round trees, chimneys, antennas, clutter,
  awnings and washing), `bridge` (a side profile of a deck over an arch, extruded across and stood from one end to
  the other, its parapets along it), `railing` (posts and rails or a solid parapet), `pipeStack`, `spaceTraveller`.
- **The look** (`SPACE_LOOK`, `SPACE_DAY`, `SPACE_TONES`): space all round (`SPACE_SKY`), the walls cream, salmon and
  coral (read off the pictures: lit #fae1bb #efa992 #dc8b69 #fc8b63), their shade a rose (#c28070 over #fae1bb), the
  machinery dark slate and teal (#393e53, #295960), the balcony a dark teal (#24485a); little hatching, the shade
  printed flat, spot blacks in the machinery, a rose haze in steps so far islands go paler, not darker. Each view
  has its own light (picture 2 greyer, 4 more orange). `?look=spacecity`.
- **Left**: the pictures' every wall carries small detail (pipes, vents, signs, plants, washing by the dozen, crowds
  on every deck); ours are plain rounded blocks and a few walkers. Their houses step down the islands' sides below
  the decks; ours stand on the decks. Picture 2's crowd fills its bridge; ours is a line of figures.
- **The colour pass (v0.95)**: the gaps were (1) the walls cream and orange-brown where the pictures are salmon
  and pink (hue ~18° against ~7°), (2) a muddy brown shade (picture 1's is a rose), (3) a dense field of stars
  where the pictures show a few, (4) the far islands' undersides washed pale by the haze, where the pictures keep
  their machinery dark. Changed: `SPACE_TONES` walls, stone, paving, masonry and bridge pinker; `SPACE_DAY` a rose
  shade (#b87078) and a pink light (#ffccc4); `uShadeKeep` 0.5 (a wall keeps its colour in shade); the stars' density
  halved and more (`uSpace.y` 0.12–0.16, the views' too); `SPACE_HAZE` lighter (veil 0.08, far haze 0.6). **Still
  off**: the pictures' every wall carries pipes, washing and crowds; picture 2's teal accents are fewer in ours.

## The Signal Market at night (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-marketnight.js`, world `marketnight`: `?level=references&world=marketnight&view=n`):
  four 16:9 pictures (1456 × 816), four variations of one composition, one view each: the market's screen lane
  after midnight, its walls stacked with second-hand screens, the great violet screen with a pale alien face high on
  the left, a scarlet portrait on a bulky CRT and an acid-green terminal at its foot, a lemon fruit advert, the round
  monitor's planet, a wide orange desert and a white screen of black glyphs on the right, pink and emerald screens
  cracked across down the lane. (1) the lane at midnight with its awning; (2) the violet face tilted, a hung tarp, the
  orange pool down the middle; (3) under the diagonal awning, the great scarlet portrait; (4) the repairer crouched by
  the cracked screens, the sepia stacks, the desert. One scene builder (`laneScene`): the sheet's own screens placed
  off its pixels (`sheetAt`, as the Moon Foundry's), the rest of each wall filled with screens of the sheets' colours
  (columns stacked from the ground up, CRTs low, flat panels higher, a round monitor now and then, about one in six
  switched off, kept clear of the sheet's own), the walls standing back behind the sheet's screens so none sinks into
  them, the dark masses above with their skyline clutter, cloth awnings and tarps, vendors at the walls' feet bent
  over their screens, cables over the paving and slung overhead, a few walkers far down the lane.
- **The kit** (`src/levels/market-night-kit.js`, shared with the market's own night, worlds.md "The Signal Market
  at night"): `SCREEN` (the sheets' lit colours), `picture(kind, w, h)` (face, portrait, terminal, food, planet,
  desert, glyphs, cracked, bars, sepia: flat painted shapes laid a hair apart in front of the screen), `crt` (a deep
  casing, its tapered back, the bezel's lip, a grille and knobs on a big one, vents), `panel`, `roundScreen`,
  `tarp`, `vendor`, `groundCables`, `nightPaint` (the market's billboards' night colours).
- **One draw for every lit screen**: the screens and their pictures are one vertex-coloured material that glows
  (`glow` 0.6: lit flat in their own saturated colour, under the lights' pale core) with a line in a dark shade of
  their own colour, as the sheets ink them; the casings, walls and paving are dark matte.
- **Held at night** (`night: 1`, references.js): the views' hour is still picked by their sun (the tests want a
  morning sun), so the level raises `uNight` after the sky is set each frame while you are in a night view: the
  screens' halos widen, the stars come out, the haze thins. The sun stands behind the camera (`side: 180`), out of the
  frame. The pools of screen light on the paving, the cloth and the people are the local lights (`kit.light` by the
  big screens) in one colour per view (`lampTint`: violet-pink, orange, pink, pale lilac).
- **Left**: the sheets draw every screen's picture in fine pen work (the alien face, the portrait, the fruit, the
  desert); ours are a few flat shapes. Their walls carry dense machinery in the dark; ours are plain masses. Their
  pools of light take each screen's own colour; ours one colour a view (the shader's lights have no colour). The
  lane's far end glows warmer and busier on reference-2.
## The Overnight Train's pictures (reference-1 … 4, October 2026)

- **The views** (`src/levels/reference-overnighttrain.js`, world `overnighttrain`: `?level=references&world=overnighttrain&view=n`):
  four 16:9 pictures (1456 × 816), one view each: the train across the plain under the two moons, its balcony full,
  the dust trailing rose (1); under the great nose, its lit lounge and pennants, the pink billows behind (2); coming
  on at dusk, the round window lit, the moons low on the right, a bank of cloud on the left (3); along the track, the
  plum carriages, the dust rolling at the wheels (4). One scene builder (`trainScene`) with the world's kit
  (`src/levels/overnight-train-kit.js`, worlds.md "The Overnight Train"): the train (`train()`: a list of carriages,
  the lead's observation lounge furnished), the track bed and rails to the horizon, the dust, the plain and its
  streaks, the moons, a cloud bank, stones.
- **Placed off the pictures' pixels from two points**: the pictures look from under a metre up, so where the horizon
  cuts the train decides everything. `camAt(cam, under, over)` takes the pixel where the wheels meet the plain under
  the nose and the roof's crown straight over it; the two give how far off the nose stands and the eye's height. The
  train's length runs to the picture's vanishing point (`vp`). The level wants every eye a metre over its ground, so
  the hidden ground lies 1.2 m under the plain the scene lays (solid: walked on).
- **The streaks** (the plain's long ink lines toward the horizon) are thin dark strips laid round the eye, each made
  as wide as it must be to stand one to three pixels wide where the view's own camera sees it (projected through a
  `PerspectiveCamera` of the view): a fixed width vanishes at such grazing angles or merges into a dark field.
- **The moons** are glowing balls 2.8 km off where the picture has them (`moonGeo`); in the world they replace the
  sky's own moon (`level.sky.moon: false`), which the game draws as a crescent.
- **The look** (`TRAIN_LOOK`, `TRAIN_NIGHT` in the kit): no clouds in the sky (the dust is the cloud), a grain on it,
  the shade printed flat in a deep blue-violet, light hatching, deep spot blacks under the carriages, a rose-lavender
  haze in steps, **no pen dots on the plain** (`uDots: 0`: in the world they would stand still while the plain runs
  past). `?look=overnighttrain`.
- **On the world** (`src/levels/overnight-train.js`, worlds.md "The Overnight Train"): the same kit, its carriages
  furnished and solid, the train standing still while the land runs past it in bands.
- **Left**: the pictures' nose is a bulbous rounded prow with a round window, ours an open-fronted lounge under a hood;
  their train is a dense mass of pen detail (rivets, flutes, machinery under every carriage), ours plain plates;
  picture 2's dust is a towering pink cumulus, ours a rolling bank; their horizon glows in a broad rose band, our
  sky's is narrow; picture 1 is backlit (its flank dark against the glow), ours lit from the side.

- **Colours against the pictures (October 2026, v0.95)**, on the rear deck at 22:00, turned and at dusk: (1) the sky
  the print's flat blue-violet with a thin pale line on the horizon (`#77669c` read there), where the pictures glow
  in a broad rose band (`#d07b95`–`#ef7763`) fading up into the blue; (2) the far plain went lavender, the pictures'
  rose (the haze takes the horizon's colour, so (1) fixes it too); (3) the plain, the train's plum and the deep
  shade already close. Changed: `TRAIN_LOOK` `uSkyFlat` 0.3 (mostly the gradient), `TRAIN_NIGHT`'s horizon
  `#e88a90`. Still off: the pictures' top of the sky is a stronger blue than our gradient reaches in a level view.
  (the triptych before / after / reference: `changelog-media/0.95/train-colours-after.webp`; `tests/colour-pass.test.js`)

## The Sealed Hangar's colours (October 2026, v0.95)

`references/The Sealed Hangar/` holds only its people's sheets (`characters/preview.jpg`: Ottla, Ambroise, Lune,
Clemence, Major Brask), drawn in dusty tones on cream paper: a faded blue, mustard, lilac, coral, olive. Compared at
the start and turned: (1) the world's paint a toy-box's pure hues (`PALETTE`: `#62c3c9`, `#f2c54b`, `#e6875f`…);
(2) the plateau a lime (`#cfe0a8`); (3) the sky a saturated cerulean (`#6aaed0`); (4) the shade a grey-blue. Changed
(garage.js): every `PALETTE` tone a step greyer and warmer, kept in its place (`#d48e94`, `#86b0b2`, `#d8aa50`,
`#a9a0c8`, `#d27b5e`, `#a8b48c`, `#c9603e`), the same hexes where the file wrote them out; the plateau `#d8d4a8`; the
day's sky `#8db1c3` and shade `#9c9ccb`. The Lab's hangar room shares the palette. Still off: the temples' interiors
and the story's props keep the old tones (src/temples, src/story); no environment sheet to compare against.
(the triptych before / after / reference: `changelog-media/0.95/hangar-colours-after.webp`; `tests/colour-pass.test.js`)

## Lorn's colours (October 2026, v0.95)

`references/Lorn/` holds only its people's sheets (`characters/preview.jpg`: Wendel, Sedge, Saba, Corm, Ysse): muted
olive, straw, violet and navy on cream. Compared at the start at 18:24 (its opening hour), turned, and at 11:00:
(1) the long evening cast shadows near-black stripes over the moss (the olive times the violet tint is a grey, deepened
by the spot tier); (2) the moss an acid green under the teal evening light (`#c8f2e4`); (3) the sky a saturated
royal blue; (4) the crystals' mint and lilac fine. Changed (perdide.js): `LORN_LOOK` (new, the world's look):
`uShadowFlat` 0.65 (the shade printed most of the way in the violet tint), `uCast` [0.3, 0.15], `uSpot` w 0.08;
`LORN_DUSK` the shade `#8a7cce`, the light `#dcecdc`, the sky top `#5874b2`; the moss `#748660` / `#8a9a6c`. Still
off: the ship and the tulip trees take the flat violet shade too; no environment sheet to compare against.
(the triptych before / after / reference: `changelog-media/0.95/lorn-colours-after.webp`; `tests/colour-pass.test.js`)
## Vael and Viridel: their people's sheets (v0.95)

`references/Vael/` and `references/Viridel/` hold only character sheets (flat pastel colour on a cream paper);
Vael's tower and bird are drawn on Vael II's sheets. Compared with those and with Vael II's tower panels:

- **Vael** (`arzach.js`): its dunes carried heavy rose-brown cast shadows; the sheets' shade (the watchers' white
  robes, the Sky Stones' plain) is a pale cool grey and they leave cast shadows pale. The day's shadow is now a
  lilac-grey (`#aca2b6`, was `#b98f9a`) and the cast shadows on open sand are lifted (`look.uCast` [0.45, 0.1]).
- **Viridel** (`edena.js`): the light was a cold white and the shade a saturated blue; now a cream paper's light
  (`#fff8e8`) and a softer grey-blue shade (`#98a6c6`).
- **Still off**: the people themselves. The sheets dress Mira in a mint coat and a straw hat, Vey in a pink robe,
  Oro in a long cream robe and a cone hat, Rue in blue overalls; the game's outfits are other shapes and colours
  (a follow-up for the people, not the light).
