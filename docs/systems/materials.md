# Materials, shade and ink on surfaces

`makeMaterial` and the surface shader: shade and hatching by surface, weathering, metals, ground ink, shader compile cost.

## Shade and hatching by surface (after the references)

The review of IMG_3775's six panels against their rebuilt views found what the shaders couldn't do;
all of it is in the game's own materials and post pass (every world uses it), not in the level.

- **Each surface its own shade** (`SHADE`, `shadeOf` in `src/materials.js`): post.js used to shade
  everything as albedo × the world's one shadow tint, so the desert's blue-grey turned bone and sand
  blue. Now a shaded pixel carries a *lift* (how far toward its lit colour) and a *hue* (how much
  of its own colour it keeps: the tint's darkness, a little warm). The material gives its own
  (`makeMaterial({ shade, shadeHue })`; metal and sand keep more of their hue by default), and the
  light's geometry adds two: a **half-tone** on a form turned from the sun under no cast shadow
  (`uHalftone`, less on its far side past `SHADE.band`), and the **ground's bounce** on faces turned
  down (`uBounce`: a cap's underside is a soft half-tone, the ground under it the full shadow). The
  presets set them with `uShadeKeep`, the hue where a material doesn't say (only Moebius print has
  them; every preset lists them, so switching zones never keeps the last one's). They travel packed
  over the hatch strokes: `gHatch.r += 2 × (1 + hue step)`, `gHatch.g += 2 × lift step` (15 and 8
  steps; the strokes stay 0..1, the half-float buffer holds it under 32), and a pixel with nothing
  packed (other shaders, grass) takes the defaults. A face keeps its own warm shade (`FACE_SHADE`).
- **Hatching by surface**: `hatch` (0..1) scales a material's shadow strokes (metal 0.35 and sand
  0.55 by default, the references' bones and sails fewer); a lifted shade gets fewer strokes and no
  cross-hatching (a whole wall in half-tone is no longer a field of crossed lines); strata rock
  (`strataHatch`, on by default) keeps runs of strokes along its beds in the light.
- **Calmer ground** (`GROUND` in `src/ground-ink.js`): rarer ripple patches, fewer long wind lines,
  the print look's coarse dots only in patches (`GROUND.dots`), and bare rock ground (terrain with
  `pattern: 'cracks'`) draws long fissures and a finer broken net close by (`rockFissures`) instead of
  dots.
- **Lines**: the print preset's ink is thinner and more broken (`uLineWidth` 1.0, `uLineVary`
  0.55), soft dune crests are left uninked unless the slope breaks (`uNormalThresh` 0.3), and the
  deepest crevices (between ribs, into a hull's machinery) are filled solid (`uCrevice`, from the
  crease shading).
- **Sky and paper**: the flat printed sky keeps its tint down to a narrow band on the horizon; its
  dots are a grain (anywhere in their cell, several sizes and weights, thicker and thinner in
  drifts) rather than a screen; the paper has a tooth (`uPaper`: a fine mottle and pits, on the light
  colours).
- **Plating** (`makeMaterial({ grid, plates: true })`, `S_PLATES`): the grid drawn as rows of plates
  of uneven widths, staggered joints, the odd joint or seam left out, each plate a shade apart (under
  the colour-edge threshold). On the desert's hulls, its station domes, the ship's hull, the
  reference wreck.
- **Water** (`WATER_INK`, `src/water-shader.js`): the wave crests only in the patches the wind
  ruffles (drifting downwind), the rest flat, and gone far off; the lake view's bed makes broad pale
  shallows, which post.js inks round.
- `tests/shade.test.js`: the packing round trip, the materials' defaults, every preset's tones, the
  ground marks, weathering's rules; `tests/surface-spec.test.js` the new defines.
- **Cost** (M4 Pro, ANGLE Metal, 1280 × 720, the camera pinned at spawn and turned, three runs each
  alternating with the build before; throughput: six frames back to back to a one-pixel read):
  desert High 6.3 → 6.0 ms and 6.7 → 5.6 ms, City-Shaft High 8.7 → 9.3 and 5.2 → 6.5, desert
  Handheld 3.2 → 3.3 and 3.1 → 2.9, City-Shaft Handheld 8.6 → 7.8 and 5.9 → 6.8 (the machine's
  run-to-run spread is ±30 %). The new work is behind defines (weathering, plating) or cheap
  branches (crevices, paper, the strata strokes only lit and near); the handheld's paper is one tap.

## Weathered walls: worn by time

The reference cities look old and lived in. `makeMaterial({ weathered })` (0..1, `S_WEATHER`,
`weatherInk` in `src/materials.js`; `WEATHER`, `weatheredOf`), on upright faces, in a frame of the
wall taken from the world axes (x on walls facing z, z on walls facing x, blended between: stable on
round walls, where the tangent of the interpolated normal had swept a column's marks into specks):

- **Grime**: a streak in most cells (1.3 × 2.4 m) running down from its top at an uneven height (a
  storey's top, a sill), flat darker tone, narrowing as it goes, its edge a little ragged.
- **Chips**: patches where the plaster has broken away, the layer under it darker and warmer, the
  edge a continuous pen line, and the lip's cast shadow inside the chip on the sun's side (a step the
  sun's direction on the wall decides, not paint).
- **Cracks**: from a storey's top down or from its foot up, jagged, thinning, branching now and then,
  with a shadow sliver on the side away from the sun; a crack from the corner of the odd window
  (house fronts, `pattern: 'facade'`).
- **Dust at the foot** (post.js): a weathered pixel is flagged in `gHatch.b` (+16); a probe the band's
  height below it on screen that lands on the ground (facing up) less than 0.62 m under it in the
  world puts it in a flat darker band, its top a little ragged. One tap, within 220 m.
- **Each building its own**: an amount (0.6–1.4 × `weathered`) and a pattern seed from where it stands
  (9 m cells).
- **By distance**: the pen marks fade out at 0.03–0.075 m a pixel, the tone marks (grime, the chips'
  fill) at 0.1–0.28; the handheld (`uWearLite`, low detail or the light ink pass) keeps the grime and
  the chips' tone and edge, no cracks or lip shadows.
- **On**: house fronts by default, the desert city's walls and terraces, the desert's adobe domes,
  the Signal Market's shops and blocks, home's dome house, the references' huts and houses; never on
  metal, glass, lights or the makers' work (their inscriptions).
- **Cost** (M4 Pro, 1280 × 720, frames back to back, wear off / on interleaved, 40 pairs): desert
  High 10.3 / 10.1 and 8.5 / 8.5 ms, Signal Market High 8.3 / 8.6 and 5.0 / 5.0, desert Handheld
  4.1 / 4.1 and 3.6 / 3.6, Market Handheld 8.6 / 8.4 and 7.1 / 7.2: within the run-to-run spread.

## Pen detail at every scale

The reference sheets draw fine pen marks inside every surface, dense near and thinning with distance,
so a big face never reads as plain. `makeMaterial({ detail, detailDensity })` (`S_DETAIL`,
`builtDetail` / `grainDetail` / `detailLod` in `src/materials.js`; `DETAIL`, `detailOf`), on faces up
to 40° from upright, in the walls' world-anchored frame (the weathering's: world x or z along, y up):

- **Built** (`'built'`; on by default wherever a material is weathered: house fronts, Qanat, the
  Market, home, the references' huts and towers; asked for on the Buried Machine's rust and teal):
  panel seams in rows of uneven height, broken now and then, staggered joints with some left out,
  small rectangles in the odd panel (a vent with its slats, a hatch, a plate), and near, bolts at
  the joints and small plates in finer cells.
- **Organic** (`'organic'`: the Garden of Spheres' and Edena's trunks, the Deep Wood's trunks, roots
  and mushroom stalks, the references' trunks and stalks): short grain strokes along the fall of the
  surface, tapering, leaning a little, wavering, in a coarse and a fine level.
- **By distance** (`detailLod`): the marks are drawn at 1, 2, 4 or 8 × their size so they keep about
  their size on screen (cells never under ~80 px built, ~8 px between grain strokes), each level its
  own pattern, the two nearest cross-faded, gone past the fourth; the fine level (bolts, small plates)
  only at the nearest. No moiré: nothing is drawn finer than its cell can hold.
- **Each building its own** pattern (a seed from its 9 m cell), `detailDensity` 0..2.
- **Ink**: drawn as detail (gHatch.b) at 1.35, which post.js draws as a darker pen line (under 2: the
  spot and weathering flags above it are untouched). Never on figures, faces, glass, lights, ground
  or water; `detail: 0` turns it off.
- **Handheld** (`uWearLite`, low detail or the light ink pass): the coarse level only (no bolts,
  plates or fine grain).
- **Cost** (M4 Pro, frames back to back, detail off / on interleaved, 40 pairs, ms; 1280 × 720 and
  1728 × 1117 at DPR 2): High desert 11.3 / 11.2 and 20.3 / 20.1, Market 6.7 / 6.9 and 16.5 / 16.6,
  Buried 15.8 / 15.7, Deep Wood 19.1 / 19.2 and 23.2 / 24.0 (turned 34.1 / 34.9); Handheld desert
  3.5 / 3.5 and 17.1 / 17.4, Market 8.7 / 8.6 and 15.5 / 15.8, Buried 3.7 / 3.7 and 8.1 / 8.1, Deep
  Wood 2.5 / 2.5. Up to +0.8 ms at the Retina size (the Deep Wood's trunks, organic everywhere),
  otherwise within the spread.

## Faceted normals near the camera

Flat-shaded materials take their normal from the screen derivatives of the position. Taken of
`vWorldPos`, kilometres from the origin (the References' views, a far city), the derivatives lost
their low bits: a facet's normal wobbled by a percent from pixel to pixel, and a facet turned edge-on
to the sun (the light term at the toon threshold) broke into lit and shaded specks, each one inked by
post.js's shadow edges: the "fuzzy dots" on view 2's dish column and the "dotted texture on grazing
lit faces". They now come from `vWorldRel`, the world position measured from the camera (small
numbers, as `vObjRel` already was for the strokes).

## Ground ink by distance, steady façades, fine lines on distant people
- **Ground ink** (`src/ground-ink.js`, used by `MODE_TERRAIN` in `src/materials.js`): every
  mark on the ground has a real width in metres. Close up it is a crisp pen line (1 to
  ~1.7 px, anti-aliased from its screen-space gradient, so it holds at grazing angles);
  once it is thinner than a pixel it is drawn lighter instead of thinner, so a patch of
  ground holds the same ink at every distance; once a pattern is too dense to draw it
  hands over to exactly that average tone. Nothing switches on with distance any more
  (the old pixel-width fade made ripples and cracks pop in a band ahead of you).
  Sand: grains near → wind ripples (1.6 m) → long wind lines over the dunes (9 m) → tone;
  in the dotted print style, world-sized dots replace the old pixel-sized stipple on sand.
  Salt flats: small crust cracks near → the big dried-mud polygons → tone; the Voronoi
  search returns the border normal, so crack width comes from the true screen gradient.
  `penLine` / `lineField` have JS twins that `tests/ground-ink.test.js` checks.
- **Flat walls far from the origin** (`vObjRel` in `materials.js`): facet normals came from
  screen derivatives of positions hundreds of metres out (a merged city), whose low bits
  are rounding noise; times those coordinates, the hatching on Qanat's walls turned into
  speckle that changed every frame. The derivative now uses the position measured from
  the camera, and a facet takes a single stroke projection.
- **Façades** (`facade`, `strata`, `gridLines`, `roofTiles`): window glass and shutters are
  anti-aliased and fade into the wall's average tint once windows are a few pixels; the
  wall direction comes from the vertex normal (no jitter); strata bands, window grids and
  roof rows hand over to their average colour or tone before they get dense enough to
  shimmer. Hard tone edges stay hard on purpose: post.js inks them as one solid line.
- **People far away** (`uFigure`, packed as +4 in `gHatch.a`; `post.js`): character
  materials (humanoids, costumes, the crowd) are flagged. Where an inked pixel's kernel
  touches a person, the lines are redrawn by the figure's height on screen: a narrower
  kernel and a lighter outline that stays on the background side once small, and the
  inner lines, drawn detail and hatching fading first. Distant figures keep their
  colours with a fine outline; only pixels that already have ink pay the extra taps. The
  player keeps its own mask (`uHero`).

## Materials: metal, light, the makers' inscriptions and grass blades
- **Metal** (`makeMaterial({ metal })`, `METALS` in `src/materials.js`; the `METAL` block): `painted`,
  `steel`, `chrome`, `brass`, `copper` and `iron`, plus `brushed: true` (with `brushAxis`). The
  view reflected off the surface looks at the sky, the bright horizon or the ground, and each is
  one flat tone, a little wavy (chrome also gets the dark band just under the horizon); brass and
  copper tint every tone with their own colour. The sun's highlight is one crisp near-white shape
  with a paler ring round it; post.js inks its edge like any colour edge. Brushed metal gets fine
  streaks along its axis (in object space, so they ride with it), a few hairlines in the drawn
  detail, and its highlight stretched across them. The sky is the post pass's own (`uSkyTop`,
  `uSkyHorizon` and `uNight` are shared uniforms now); the ground is the level's terrain colour
  (`setEnvGround`, main.js). Used on the ship, the vehicles (`paintMaterial({ metal })`), the
  backpack's tank and bracer, the boxes' items, the gear and trinkets, the Hangar's machines,
  pipes, gears, crown and pistons, the listening stones' brass, the Buried Machine's steel and
  rusted iron, the City-Shaft's railings and gilded palace, the market's brass and painted steel,
  the bell, the observatory, the desert's hulls, dishes and masts.
- **Light** (`createBloom` in `src/post.js`, run between the G-buffer and the composite): the
  glowing surfaces (glow over 0.62 in `gHatch.a`: crystals, lamps, signal lamps, portals, the
  makers' mark; the local lights' pools stay under it) are gathered at a quarter of the
  resolution (4×4 texels each, so a small lamp isn't lost) and blurred, then again at an eighth
  for a wider halo. The composite draws a light as a bright flat core whose inner ink lines go
  and whose outline thins, then two flat rings of its colour round it (a printed glow, over the
  ink) and a soft wash of that colour on what is near; stronger at night. Seven small passes,
  about 1/16 of the pixels. Façades (`pattern: 'facade'`) light some windows at dusk, one after
  another, and those glow too.
- **The makers' inscriptions** (`makeMaterial({ glyphs })`, `src/glyphs.js`): the makers marked
  everything they made (LORE.md, "The glyph"). On upright faces, each row of the wall's grid
  (`glyphs`: a cell in metres, or the grid's) carries a frieze between two incised border lines:
  a row of their signs (the ∩ under three dots opening every sixth, rings, the two moons, the pale
  star, a staff under an arc, three over a line, a door, a sun on a staff); on the odd rows a
  cell now and then holds a seal, a framed panel with the mark. They are carved: each stroke is
  a groove whose part under the rim on the light's side drops into the shadow tone (post.js inks
  that edge like a cast shadow), with a fine outline round the cut; they fade once a groove is
  under ~1.5 px. Only the makers' work carries them: Qanat's gate lintel and the giant's door,
  the masked head's chamber and its doorway, the standing stones, the observatory, the
  Builders' ruins in Viridel (the City-Shaft's billboards and the artist's page lost theirs).
  The layout is integer arithmetic, mirrored in JS for `tests/materials-pass.test.js`.
- **Grass blades** (`src/flora-grass.js`, `src/grass-shader.js`; `makeMaterial({ grass })`): on
  the grounds drawn with grass ticks (Viridel, the Garden of Spheres, home, Lorn's mosses, their
  Lab rooms, the Lab's meadow), a fixed set of tufts (three wide tapered blades each, 9 triangles)
  covers a square patch round the camera. Each tuft has its offset in the patch; as the camera
  moves the ones falling off one side reappear a patch further on (`wrapPatch`), so blades stay
  put in the world and only those that wrapped are placed again (the height, the slope, the
  paths, the water, and a 1 m mask of where something is built: one ray down per cell, cached).
  The vertex shader bends them with the wind (the plants' gust front) and parts them round the
  traveller's feet (the brush, below), and fades them out with distance (next item). Lit like the ground, each tuft
  a shade darker or lighter than it. **Soft ink**: the blades write +8 in `gHatch.a`, and post.js
  draws their outline in a darker shade of the green instead of black, only on the blade's own
  side (half as wide), with no crease, colour-edge or shadow-edge lines and no hatching on them
  (and the crease shading ignores them, which had greyed the ground between them); one tuft in
  eight keeps a real pen line, for the hand-drawn feel. No shadows.
- **Grass into the distance, without a line** (`grassLod`, `tuftScale` in `src/grass-shader.js`):
  the blades used to thin by a step (a whole tuft gone at once) and the patch ended about 35 m out,
  its centre jumping with every turn of the camera. Now each tuft has a rank; the share kept falls
  with the distance from the camera and a tuft shrinks to nothing over a metre or more as the share
  passes its rank. Further out the blades get shorter and thinner, take the ground's own tone under
  them (its patches, as the terrain draws them) and lose their outline: the blades write their pen
  line's share in `gHatch.r` and the outline's fade in `gHatch.g` (post.js reads them on soft-ink
  pixels and on the ground beside them, then clears them before the hatching). Past the near patch
  a **far layer** takes over (`quality.far`, `FAR_TUFT`): sparse two-blade tufts in a patch about
  2.5 times as wide, growing in where the near one thins (to the far layer's density, so the field's
  density only ever falls) and with the same look by distance, so the two meet without a seam; it
  fades into the ground by its own edge. The patch's lead on the camera follows its look over about
  a third of a second (`FOLLOW`): turning round slides the fade across. Two draw calls; the far layer
  shares the near one's built-on mask. `GRASS_QUALITY` (tufts, triangles, reach ahead of the
  camera), before → now: High 12.1 k tufts, 109 k triangles, 35 m → 8.6 k + 4.1 k far, 102 k, 78 m;
  Medium 7.7 k, 70 k, 30 m → 5.8 k + 2.4 k, 66 k, 65 m; Low 3.0 k, 27 k, 20 m → 2.5 k + 0.7 k,
  27 k, 41 m; Handheld 2.0 k, 18 k, 18 m → 1.6 k + 0.4 k, 17 k, 35 m. `tests/grass-fade.test.js`.
- **The Lab** shows them all: the materials row has steel, brushed, chrome, brass, copper, iron,
  painted, the carved inscriptions and a lamp beside the glow, and a meadow past the water pool.

## Faster surfaces, and no compile on first sight
Found in the Lab, where some materials looked slow; all of it applies to every world.
- **One surface shader, compiled per material** (`surfaceDefines`, `SURFACE_FEATURES`, `materials.js`):
  every material used to compile the whole G-buffer shader (the faces' ink and eyes, the desert's
  ground, façades, cracks, inscriptions, cloth folds) and skip what it didn't use by uniform
  branches. A branch never taken still costs: the GPU reserves registers for the heaviest path, so
  a plain wall paid for the faces. Each `S_*` define now guards one feature's code and a material
  compiles only the ones its options turn on; inside, its uniform still decides, as before. These
  options are never changed after `makeMaterial` (their uniforms are only read). Without
  `SURFACE_SPEC` (a shader made some other way) everything is compiled, as it always was.
  Brushed metal's streaks are their own define (`METAL_BRUSHED`): the other metals multiplied five
  noise taps a pixel by zero. `tests/surface-spec.test.js` preprocesses the shader per material.
- **Local lights**: the loop over the eight slots stops at `uLightCount` (main.js packs the lit
  ones first); the empty slots contributed nothing.
- **Rock cracks and the water's caustics** (`voronoiBorder(x, reach)`): the first pass also finds the
  second nearest point, and no border is nearer than half the gap between the two; where even that
  is past the line's reach, the 25-cell second pass is skipped. Cracks also skip the search in
  their gaps and once too far to draw. The same lines, exactly.
- **Warm-up** (main.js `warmShaders`): the loading screen compiled every program for the canvas,
  but the scene is drawn into the G-buffer, whose programs differ (the output colour space is part
  of a program's key): none of the warm-up was used, the first frame compiled the view and anything
  else compiled when first seen, 20–200 ms walking into a Lab room or turning to something new. It
  now compiles with the G-buffer bound, and the shadow passes' programs (every mesh wearing the
  depth material for a moment) and the water's sparkle pass too.
- **Grass blades** (`flora-grass.js`): a tuft's place was compared with the stored one in 64-bit
  floats, so away from the origin every tuft was placed again every frame (about 2 ms on High
  standing still in Viridel, the Garden, Lorn, their Lab rooms); compared as stored now. After a
  jump (a door, a portal) the new patch is placed over the next frames, `PLACE_MS` at a time,
  behind the fade (it had been a 60 ms frame).
- **The Lab's hidden rooms** skip the frame's matrix update (each is brought up to date as it hides).
