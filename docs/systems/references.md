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

- **Open / close:** Tab; X / □ on a pad (free in this level: no mount, no taxi); the small "views"
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
- **Left**: the glass is opaque and lit as a surface; the plates' glow from within (light pooling lime at a wall's
  foot, the luminous rims) is only its colours. Plate 4's breaking wave reads as a hood but not yet as the plate's
  tall arch; plate 2's billows want deeper, rounder shading under each lobe. The plates' sand carries painted
  bands of light and shade more than our cast shadows do.
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
- **The scale**: the pictures' tubes 20–45 m round 50–200 m off, the arches' legs 50–75 m thick, their circles 250–900
  m round; the beasts 20–40 m off.
- **Left**: the pictures' interiors are dense little cities (terraces, hanging gardens, lit windows by the hundred);
  ours are a few decks of houses and gardens behind ribs. Their hulls carry fine panel work and stains; ours the
  built pen detail and collars. Their beasts are woolly; ours plain lumps. The tilted segment of view 1 bends at its
  crushed foot; ours is one arc.

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
