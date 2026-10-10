# Water and swimming

The one water look and swimming in every world.

Every body of water in every world is drawn by one water look and can be swum in.

**The look** (`src/water-shader.js`, compiled into the surface shader for every
`MODE_WATER` material: the `WATER` define, hooked into `materials.js` in four places).
Like the rest it only writes the G-buffer; post.js prints it:
- **Depth bands**: three flat tones by the water column under each point (pale
  shallows `color2`, the water `color`, a deeper saturated tone), inked by post.js
  like contour lines. In the shallowest band the bed shows through (`o.bed`, by
  default the shallows' tone gone sandy), with a faint wobbling caustic net close up.
- **The shoreline**: a pale foam band about 30 cm wide wherever the water meets
  anything (its width is measured in metres from the depth's slope, so it is as
  crisp on a beach as on a wall), and a broken lapping line a metre out that
  breathes in and out.
- **Ripples**: short pen dashes along wave crests across the wind (`uWind`),
  drifting downwind, at two scales; and rings spreading round whatever touches the
  water (`uWaterRings`, a ring buffer of 12).
- **The sky**: at grazing angles the sky's horizon and zenith colours (post.js's
  `uSkyHorizon` / `uSkyTop`) in two flat steps.
- **Sparkle**: horizontal dashes of sun toward the sun, twinkling, only where the
  water is lit. They are not drawn in the G-buffer (post.js would ink round each
  one: black specks): the shader marks them in the length of the normal it writes
  (`WATER_MARK`: water's normals are 1.012 long, plus 0.05 at a glint; post.js only
  uses directions), and `Waters.renderOver` paints them white over the finished page.
- **From below** the surface is a pale bright ceiling with its ripples (water is
  drawn from both sides).
- `waterPrint: true` (the Garden's mirrored shore) is a flat printed shape lying on
  the water: its own colour with the ripples, no depth, not swimmable.
- **Contact foam** (below): little waves lapping round whatever stands in the water, from the scene's
  depth behind it.
- The handheld's low detail (`uWaterLite`, main.js `applyDetail`) keeps one scale
  of waves and drops the caustics and the sparkle.

**The bodies** (`src/water.js`, `Waters`, one per level, main.js). At load it finds
every `MODE_WATER` mesh (and any mesh with `userData.water = true`: the desert
cave's magic pool, which keeps its fluid look; `userData.waterMoves` refreshes its
box as it rises). Each gets its own copy of the material, drawn from both sides.
- `surfaceAt(x, z, y)`: the water there for something at height y (the lowest
  surface above y - 0.6, else the highest one under it): `{ y, body }` or null.
  Streams slope: it raycasts the water mesh itself. `floorAt(x, y, z)`: the highest
  surface under y; hoverbikes and skiffs skim on it (`bike.js` `surface`).
- **Bed maps**: the depth bands and the foam come from a half-float map of the bed
  under each body, baked from the collision world (`physics.groundAt` from 1.5 m
  over the surface, so rocks and walls standing in the water count and bridges
  overhead don't), a few rows a frame (`BED.budget` ms), nearest body first,
  from the middle rows outward. Texels down to 0.3 m on small pools, 256 a side at
  most. Bodies wider than `BED.huge` (Lorn's swamp) get a 300 m map round the player,
  baked again once you are 70 m off its centre. A 256² map is ~25 ms of rays in all.
- **Rings and splashes**: the player wading (each step: a ring, a few drops, a slosh,
  no footprint) and swimming, the strokes, going in and out (bigger the faster you
  fall), vehicles skimming, creatures standing in water, the fluid tool's globs
  going in. White drops are instanced and inked like everything else.
- **Under water**: the camera is kept 22 cm off the surface (never a half-and-half
  lens: `keepCamera`, after the rig); under it, `renderOver` sinks the page into
  the water's colour in three flat bands with distance, with slow light shafts
  looking up, and the sound goes through a low-pass (`audio.js underwater`).

**Swimming** (`src/swim.js`, `swimFrame` called by `player.update` before walking;
`SWIM` holds the numbers):
- Water over the feet slows the walk (to half at the chest). Where it is 1.3 m deep
  you float: the feet hang `SWIM.ride` under the surface, the head above it.
- Swim camera-relative (2.5 m/s, slow to start and stop); Shift / L3 sprints on
  stamina in a front crawl (4.6 m/s). Treading water when still, a breaststroke
  when moving: procedural poses on the rig (`swimPose`; the clip library has no
  swim), the body lifted so its back breaks the opaque surface.
- **Diving**: hold Z or Ctrl, or swim forward looking down (a pad has no button
  spare); under water you swim where you look, Space / A rises, letting go floats
  you back up.
- **Breath** (`player.breath`, bubbles under the health bar): 22 s of air under
  water, back in ~2 s at the surface. Out of air you are pushed up and can't dive
  again until you have breathed, and every 1.2 s a small hurt (`player.hurt`,
  'drown') that never takes the last 10 % of the bar.
- **Climbing out**: push into a ledge at the surface and the mantle pulls you out
  (`tryMantle`, up to ~1.5 m over the water); a higher wall, you climb it. Space at
  the surface: up onto a ledge in front, else a kick up out of the water (then the
  jets and the wings work again; never in the water). The fluid tool works at the
  surface.
- Where the bed rises to 1.1 m under the surface you stand up and wade out.
- **Falls**: water 1.6 m deep or more breaks any fall (`player.cushioned`): no
  tumble, no hurt. The levels' old "unsafe" deep water (Lorn, the Garden) no
  longer sends you back to dry ground while you are in water.
- Getting off a vehicle over deep water drops you in: you swim.
- **Deep in a sea** (swim.js `SEA`, `deepSea`: more than 2.5 m under a body with `userData.sea`, the Underwater
  City): you walk its bed (0.8 of the walk); the jump kicks you off it swimming (3.6 m/s up); Space rises (3 m/s);
  letting go sinks you (1.5 m/s), upright, and you stand again where you touch ground; you climb out onto a ledge
  in front even under water (the mantle), but walls are swum up, not climbed; the pack gives air (no breath used,
  no breath meter). Near its surface it is ordinary water.
- The Lab's water sample at the end of the materials row is a swimming pool: a ramp
  up to the rim, a beach, 3.8 m at the deep end, a rock through the surface and one
  just under it, a low wall to climb out over and a high one, and a 10 m tower to
  jump from. `tests/swim.test.js` covers the states, the breath, climbing out,
  falls, the bed maps and the bike.

## A sea (October 2026: the Underwater City)

A body of water whose mesh carries `userData.sea` (`seaSurface` in `src/levels/underwater-kit.js`) is a sea: a
whole world under it, drawn the Moebius way rather than as the generic murk. Without it, nothing changes.

- **Its look under water** (`SEA_LOOK` in `src/water.js`, the over-the-page pass while the camera is under it):
  - a flat tinted haze in layers: its own `tint` and `deep` colours, clear for `start` m, then `density`, stepped
    into `bands`, between `min` and `max` (the world's own haze layers, post.js 4b, do the far city);
  - **shafts** of light from the surface as flat pale bands: slanted cylinders down from the surface on a lattice
    of `cell` m round the camera (5 × 5 cells, each cell's shaft world-anchored by a hash: `seaShafts`, so nothing
    moves as you walk), `width`, leaning away from the sun (`lean`), gone by `reach` m down; the brightest one a ray
    crosses before what it meets, in two printed steps (each ray's nearest approach to each axis, closed form: 25
    taps of a few dot products, no texture);
  - **caustics** as printed lines on what faces up: a wandering cell net (F2 − F1 of nine cells) in drifting
    patches, near only, stronger in the light, gone once finer than a few pixels;
  - over it all the motes (life.js) stay crisp: they are drawn after the pass.
- **Its underside**: the water look's `below: [colour, k]` (water-shader.js `uWaterBelow`; the generic water's is a
  pale white 0.45) sets the ceiling's tone, so a sea's surface reads as a mid blue with its ripples far overhead.
- **Air pockets**: `sea.air(x, y, z)` true inside them (the cafés' domes): `surfaceAt` and `floorAt` pass the sea by
  there, so inside you are dry (an ordinary walk, no tint, no muffled sound) and the camera too.
- **Deep under** (`DEEP_UNDER`, 2.5 m): nothing splashes at the surface for what happens down there (a step, a
  stroke, going in): only bubbles in the sound. A sea body bakes no bed map (it is seen from below).

## Contact foam (October 2026: little waves round what stands in the water)

The author: "when there is a structure in water like a building or a rock there should be a little visual thing
around it to show that little waves are hitting it". The bed map's shore foam only knows the collision world, and
only as a flat band; what has no collider (the traveller wading or swimming, people, boats, the ship, roots and
props) had nothing. Now wherever anything meets the water (`contactFoam` in `src/water-shader.js`, `CONTACT`):

- **The look**: a pale band hugging the object, `band` (0.3 m) wide close up, never under `minPx` (6) device px
  times the pixel ratio on screen (so its outer contour never sits on the object's own outline as a doubled line),
  at most `maxBand`; it **breathes** out and back by `breathe` of itself, each stretch of it in its own time; its
  outer part broken by small **gaps** drifting with the wind (only where the band is 9+ px thick: a gap in a thinner
  one is a speck post.js would ink); two broken **inked wavelets** off it, swelling out after it and back; a few
  **flecks** of foam just off it (world-fixed cells, each coming and going), drawn only while 2.5+ px across.
  The detail goes by `detail` (0.03 → 0.07 m per px), the band itself by `far` (0.1 → 0.2): far off the object's
  outline marks the waterline alone. The band's foam is lit like the shore's (`W.lit`), its wavelets ink.
- **The technique**: the depth difference. The view ray's run through the water to what is behind it (the scene's
  view depth there less the water fragment's, over the ray's share of it), over how fast that run grows across the
  water (`fwidth`, clamped to `slope` 0.4 … 1): the distance to the contact in metres, ~equal to the run beside a
  face standing in the water, large over a flat shallow bed (25 cm of water over sand is not a contact; the bed
  map's shore foam still draws beaches). All its noise is on `p.xz`: anchored in the world.
- **The passes** (`Waters.renderGBuffer`, called by main.js and title-world.js for the G-buffer): with water in
  view, (1) the water bodies' depth alone, sunk `CONTACT_SINK` (2 m: deeper than the band reaches where it is
  drawn), so what lies deeper under the water stays hidden early, as when the water was drawn among the rest;
  (2) the scene without the water; (3) the water, writing no depth of its own, reading the scene's (`uSceneDepth`).
  At the end of the pass the depth buffer holds the scene's alone; it is **blitted** (the water's rectangle on
  screen, `screenRect`, with a margin) into a depth texture for the **next frame**, which reads it reprojected
  (`uScenePrevVP`, `uScenePrevEye`; a point something stood in front of then gives no contact, not a flash of
  foam). Reading this frame's would end the G-buffer pass in the middle and store and reload all three targets:
  0.7–1.9 ms at High on the M4 Pro (a tiled GPU, as the handheld's are). When the camera has jumped (`CONTACT_REUSE`:
  1.5 m, 0.12 rad, or the water's rectangle outside the copied one: a cut, a portrait, `captureView`) it is
  copied in the middle of the pass, this frame's. The G-buffer has a depth texture for it
  (`createGBuffer({ depthTexture: true })`: 24 bits, millimetres at 50 m; RT1.w's half float, 1/32 m from 32 m on,
  made the band's edge follow its steps); any other target falls back to a shader copy of RT1.w.
- **Quality**: the preset's `waterContact` (`waterContactOn`, perf.js): on everywhere but Handheld, where one
  plain pass is kept (the depth store and blit on the Retroid's tiled GPU, unmeasured there). Off, under water, or
  no water in view: one plain pass, as before.
- **Cost** (M4 Pro, Chrome, each `renderFrame()` of 16 closed by a `readPixels`, medians of 24, the foam off and on
  in turns in one page): High (1728 × 1117 at scale 1.5, 2592 × 1676): Viridel's lake 9.92 → 10.18 ms, Lorn II's
  tree 9.78 → 10.26, the waterfall city's basin 7.51 → 7.98, the Mangrove's roots 8.74 → 8.70 (noise), the Lab's
  pool 9.83 → 10.49. Handheld if it were on (1280 × 720 at 0.75): +0.04 – 0.10 ms. The first version, copying this
  frame's depth in the middle of the pass, cost +0.7 – 4.4 ms (the store and reload, and every bed under the water
  shaded before the sunk depth).
- **Stable in motion**: the visual audit's orbit probe at three water spots (`KNOWN`: Lorn II's tree, the waterfall
  basin's ledge, the Mangrove's roots, High): nothing flagged, the spot and enclosure masks' p95 step 0 – 0.06. A foam
  orbit (world points on the water round the contact, the clock frozen, the camera turning 1° a frame so the water
  reads the last frame's depth, the pale state compared every 4°): Lorn II's tree 0.49 % of points change a step
  with the foam on (0.24 % with the shore foam alone; the band's edge moves smoothly with the view, as the ray's run
  does), the Lab's pool 0.24 % (0.22 %); the reprojected frame against this frame's depth at the same view: 0 –
  0.05 % of points differ.
- **Left**: a jump shadow or other multiply decal lying on a water surface that is in the collision world is
  drawn before the water now and lost under it (where water is not solid it lies on the bed, as before). Walkways
  whose sides stop at the surface (Lorn's) have nothing under the water for the ray to meet: their edge keeps the
  bed map's foam.
- **In Unity** (the C# port and the JS bridge's player, which draw through the same look; off unless
  `-waterContact`, below): `contactFoam` in
  `unity/…/Shaders/Surface.shader`, the same numbers, called from `waterLook`. The water's materials
  (`WorldLoader.MakeMaterial`) go in their own queue (`MementoFeature.WaterQueue`, past the opaque range) and write
  no depth (`_ZWrite` 0); `MementoFeature`'s G-buffer draws everything else, copies its depth as a view depth in
  metres (`Bloom.shader`'s third pass, `_MementoSceneDepth`, the sky 0), then draws the water over it reading the
  copy at its own pixel (this frame's: no reprojection). The ray's run is the scene's view depth less the water's
  over the ray's share of it, as here. With the foam off (`MementoFeature.Settings.waterContact`: off on mobile
  players and in the bench's handheld preset, as the web's Handheld; or no water material made yet) the water is
  drawn at the end of the one G-buffer pass, without it. **Built but off by default** until it has been seen
  running: only `-waterContact` on the player's or editor's command line turns it on (read before the world's
  materials are made); without it the water's materials and the G-buffer pass are exactly as before, in both the
  C# port and the bridge's players. Checked so far by compiling the C# against the project's assemblies and the
  HLSL with glslang (2026-10-10; no editor run, TODO.md).
- Tests: `tests/water-contact.test.js` (the band by distance, the fades, the presets, `screenRect`, the passes in
  order with a mock renderer, the blit and the reuse, the shader's intersection term behind its gate, no screen
  position in it); `tests/unity-water-contact.test.js` (the Unity shader's CONTACT numbers, the water's queue and
  depth writes, the passes' order).
