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
  ordinary NPCs, `REFERENCE_PEOPLE` in content.js). Its camera is `{ eye, yaw, fov, horizon }`:
  `horizon` is where eye level crosses the frame (0 top, 1 bottom), the pitch follows from it.
- **The sun** is given as the panel shows it, `{ side, el }` (degrees right of the line of sight,
  and high): the view's hour is the morning hour of that elevation (`sunHour`) and its group is
  turned about the vertical so the sun of that hour stands on that side (`sunTurn`). Nothing in the
  renderer is special-cased: the views are scenery, colour scripts, hours and presets.
- **The views** lie on a square grid, 3.3 km apart (`VIEW_SPACING`); only the one you are in is drawn.
  `[` and `]` (L3 / R3 on a pad) fade to the previous / next view and hold the camera on its
  panel (the traveller hidden where the camera stands); walk or look and the camera is yours
  again. `?view=<n>` opens on view n. The frame keeps the panel's proportions: on a screen
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

### The City-Shaft's sheets, and three desert touches

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
  warm band and turns the print preset's cumulus bank and clouds off, as its plates.
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
  rust-brown tone keeping more of each colour); IMG_3774's views `INK_SHADOWS` (cast shadows 0.75).
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
- **Left, scene level**: the trench's pipe mass (IMG_3789 p1), the city's towers hanging in
  clusters, the drum's interior machinery and arcades, the oval tunnel's interior (IMG_3791 p4),
  the cave with the moon (IMG_3792 p3), the rock ledge of IMG_3792 p5 are all sketches.

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
- **Left, shader level**: the sheets draw the canopies' undersides as dense radiating branch lines
  over the dark green, and foliage as clusters of small inked leaf masses; ours are smooth lumps with
  the `leaves` pattern. The white stone's shade on the sheets is a flat pale blue with almost no
  strokes (ours keeps a few). Spheres print a crescent of pale blue on the sheets whatever the sun;
  ours follow the view's sun. The lakes' reflections (the world has them, the views don't).
- **Left, scene level**: the white hill's sculpted rock, the ruins' arcades, the robot statue, the
  hedges' fruit, the avenue's grasses, the plaza's paving pattern are sketches.

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
- **Left, shader level**: the sheets' reeds are pale lavender blades in light; ours are thin cones whose
  outlines dominate (an outline weight per material is missing, as for Vael II's clouds). The sheets'
  far wood is layers of pale mist between trunks (our fog by distance gives one flat tint). Their roots
  and bushes are dense hatched masses; ours are smooth tubes and lumps.
- **Left, scene level**: the nest of eggs in the great cap, the cave mouths' framing, the roots' tangle,
  the bushes on the banks and the lily pads are sketches.

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
- **Left, scene level**: the crowd (the sheets' hundreds of drawn people; ours are cylinders), the
  stalls' heaps of goods and signs, the aliens in the foreground, the cabs' shapes.

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
4. **Hatching that follows the form** (Vael II's and the Spheres' caps radiate, the Buried Machine's
   tanks wrap, rock runs down the face): strata now run down faces; radial and wrapping strokes need a
   per-vertex axis (a cap's centre, a cylinder's axis) in merged geometry.
5. **Cast shadows by world** (the desert's ink masses, Vael II's and Lorn II's near-absent ones): the
   spot tier's `uSpot.w` darkens them; a world knob to lighten or drop them (the sheets often omit a
   cast shadow on open ground) would let the plains read as the sheets do.
6. **Per-face colour variation** (the Market's and the City-Shaft's towers, the desert's domes): the
   sheets vary a wall's colour in big flat patches (a repaint, a sunlit plane); ours are one albedo per
   material (`color2`, `color3` only in strata).
