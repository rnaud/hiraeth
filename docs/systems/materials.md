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
- **A hatched mass** (`hatch` over 1, `HATCH_DENSE`, October 2026): strokes up to 1.3 × closer (no finer: past
  ~4 px apart strokes only read as a tone), the shade drawn heavier (cross-hatched sooner), and a half-tone no longer
  thins them; Lorn II's roots (1.8) and bushes (2.2), references.md "Lorn II's sheets". Under 1 it is the amount, as before.
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
  drifts) rather than a screen. (The paper's tooth, `uPaper`, is gone: fixed to the screen, it read as a
  filter the world slid under; rendering.md, "Nothing fixed to the screen".)
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

## Weathered walls: hairline cracks (October 2026)

The reference cities look old and lived in. `makeMaterial({ weathered })` (0..1, `S_WEATHER`,
`weatherInk` in `src/materials.js`; `WEATHER`, `weatheredOf`), on upright faces, in a frame of the
wall taken from the world axes (x on walls facing z, z on walls facing x, blended between: stable on
round walls, where the tangent of the interpolated normal had swept a column's marks into specks).
Until v0.89 the wear was dirt: grime streaks down the walls and chipped patches of plaster, laid without
regard to the windows (they ran over them). The author: "the patches of dirt on the buildings are wrong:
they should look like subtle cracks, and they shouldn't overlap with windows". Now it is only:

- **The odd hairline crack**: one in a share of the wall's cells (3.7 × 3.1 m, `WEATHER.cracks` × the
  building's amount), each inside its cell, 0.9–2.3 m long, up or down the wall with a small lean; two
  polylines over the lean (kinks every 0.19 and 0.75 m) make it jagged, not wavy, and give its slope exactly,
  so its width is measured across the line (`|f| / |∇f|` in px), not along the wall. A pen line about a CSS
  pixel wide thinning to 0.4 at its end (`WEATHER.width`), at 0.8 of the drawn-detail ink (faint), with a
  branch now and then (60 %, a second 30 %) leaning off to one side. On a lit wall a sliver of shade on its
  side away from the sun and a lit sliver toward it, each a step on the wall's colour capped at
  `lip.edge / |albedo|` (under post.js's colour-edge threshold: no outline of their own to flicker).
- **Not every wall**: a building's 9 m cell gives its amount (0.6–1.4 × `weathered`) and its pattern, and
  one in five has none (`WEATHER.walls`).
- **Never over an opening** (`src/wall-openings.js`): windows, doors, shutters and signs are
  meshes of their own, so the shader cannot see them. As a world is built, every small piece that is not
  itself weathered (≤ 6 m a side, ≤ 40 m³: not a wall, floor or roof) is handed in: by the kits as they lay
  it (`desert-city.js` and `desert-landmarks.js` `Kit.add`, `RoomKit.finish` in the world once its group
  stands where it goes, the Signal Market's `add`), and the scene's small meshes of their own once it is up
  (`collectScene` in main.js: home's round windows and doors). Each box, grown by 0.25 m, marks the 0.5 m
  voxels it covers in a hashed bit table (2^23 bits, a 512² RGBA8 texture, `uOpenings`; Qanat ~960 pieces,
  the Market ~2400, the Eclipse ~2700, about 1 % of the bits set: a false hit only leaves a crack out). A
  crack is drawn whole or not at all: `weatherInk` looks up its five points along it, its branches' ends and
  the pixel (`wallOpenAt`) and draws nothing if any lands in a marked voxel; a façade's own drawn windows
  (pattern `'facade'`: the window, its shutters and sill, from facade()'s cells) count as openings too. The
  crack that used to run out from a façade window's corner is gone. The lookups are paid only by a pixel
  within a few px of a crack's line.
- **Dust at the foot** (post.js): a weathered pixel is flagged in `gHatch.b` (+16); a probe the band's
  height below it on screen that lands on the ground (facing up) less than 0.62 m under it in the
  world puts it in a flat darker band, its top a little ragged. One tap, within 220 m.
  Where sand banks against the wall (sand-drifts.js) the band would be buried, so it is drawn on the bank's top
  edge instead (October 2026): a drift pixel whose probe ~0.37 m up the screen (ragged by a noise) lands on a
  weathered wall just behind it (within 0.5 m before, 3 m behind) takes the same dust tone. Drift pixels only,
  two taps, within 220 m.
- **By distance**: the cracks fade out at 0.03–0.075 m a pixel (nothing paid further: most of a far city's
  walls); the handheld (`uWearLite`, low detail or the light ink pass) draws them without their lips.
- **Cost**: one hash a pixel decides its cell (most have no crack); a cracked cell's pixels run its polylines
  (hashes, no noise), and only those near a line pay the up to eight table lookups. The grime and chips it
  replaced cost four value-noise taps a pixel on every weathered wall within 0.28 m a pixel, so this is less.
- **On**: house fronts by default, the desert city's walls and terraces, the desert's adobe domes,
  the Signal Market's shops and blocks, home's dome house, the references' huts and houses; never on
  metal, glass, lights or the makers' work (their inscriptions).
- `tests/wall-openings.test.js`: a crack near a window left out, one clear by the margin kept, only the small
  unweathered pieces counted, the kits' pieces where they stand in the world, the JS and GLSL hash and bit
  layout the same, every opening check before any ink; `tests/motion-stable.test.js` the lips under the edge.

### The half-tone and another's cast shadow (October 2026)

A face turned from the sun is lifted toward its lit colour (`uHalftone`, the half-tone of a form under no cast
shadow), but a back wall standing in the shade of the building across was lifted too, where the sheets keep it
in full shadow. The shadow map is not read on a turned face (its own body shades it), so `castBeyond` tests the
middle cascade once at a point `HALFTONE_REACH` (16 m) toward the sun: still in shadow there means something
stands beyond the form's own body, and the half-tone is not given. Built walls only (not strata rock, not the
ground, not faces turned up or down: a cliff or a tower deeper than the reach along the light would read its own
body as another's), only in a look with `uHalftone`. One shadow tap on turned shaded wall pixels: Handheld, the
Market and the City-Shaft within the run-to-run spread. `tests/halftone-cast.test.js`.

### No stains round the doors (removed in v0.89)

v0.88 laid a darker smudge round the doors of Qanat, home, the Signal Market, Vael II and the Eclipse
(`src/door-stain.js`); it went in v0.89 with the wall dirt. Where it drew from a shared random stream, its
draws are still made so nothing else moves: the Eclipse kit's `house` and `doorway` (`skip(rng, STAIN_DRAWS)`,
five) and the Signal Market's goods (`gr`, six a shop). Qanat's, home's and Vael II's had numbers of their own.

## Cracks down a cliff's face (`cracks`)

The desert's canyon sheets (IMG_3772 p3, IMG_3773 p3, IMG_3774 p5) draw their walls with many near-vertical
cracks and strokes down the face; strata rock drew horizontal beds and a fissure every 9 m. A strata
material's `cracks` (0..1, `uCracks`; 0 by default, the old look) adds `faceCracks` in materials.js: two
families of lines, long ones 6 → 2 m apart and short strokes 3 → 1.1 m apart as `cracks` rises, each line
its own length (its run of a value noise along the height), wandering, thinning at its ends, fading out by
the pixel's size on the face. They are written over 1 in the drawn detail, so post.js draws them as pen lines
(`drawnK`), on upright faces only. On: the References' `strataMat` (0.8), the desert's rose gorge and violet
cliffs (`desert-landmarks.js`, `desert-vistas.js`). Two noise taps per family, only where `uCracks` > 0 on a
strata face: Handheld, M4 Pro, the rose gorge within 0.2 ms GPU.

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
  surface, tapering, leaning a little, wavering (one level, drawn coarser with distance).
- **By distance** (`detailLod`): the marks are drawn at 1, 2, 4 or 8 × their size so they keep about
  their size on screen (cells never under ~80 px built, ~8 px between grain strokes), each level its
  own pattern, the next level cross-faded in over the last half of a level (`DETAIL.blend`; over a fifth the
  pattern swapped in a few frames riding past, "Stable in motion" in rendering.md), gone past the fourth;
  the fine level (bolts, small plates) only at the nearest. None past 260 m (grain 130 m), faded from
  0.7 of it, so far pixels pay nothing. No moiré: nothing is drawn finer than its cell can hold.
- **One projection**: the wall's dominant axis (world x or z), not a blend of two: a round wall's
  pattern changes at its 45° lines (a seam is a pen line anyway), and no pixel evaluates twice.
- **Each building its own** pattern (a seed from its 9 m cell), `detailDensity` 0..2.
- **Ink**: drawn as detail (gHatch.b) at 1.35, which post.js draws as a darker pen line (under 2: the
  spot and weathering flags above it are untouched). Never on figures, faces, glass, lights, ground
  or water; `detail: 0` turns it off. On a wall in deep shade the marks read faintly (one ink colour
  for everything: the post side's line colour per material would lift them).
- **Handheld** (`uWearLite`, low detail or the light ink pass): no bolts or small plates, every other
  grain stroke.
- **Cost** (M4 Pro, frames back to back, detail off / on interleaved, 40 pairs, ms; 1280 × 720 and
  1728 × 1117 at DPR 2): High desert 11.3 / 11.2 and 22.0 / 22.5, Market 6.7 / 6.9 and 19.8 / 20.2,
  Buried 15.8 / 15.7, Deep Wood 19.1 / 19.2 and 20.4 / 20.8 (turned 18.2 / 18.6); Handheld desert
  3.5 / 3.5 and 17.1 / 17.4, Market 8.7 / 8.6 and 15.5 / 15.8, Buried 3.7 / 3.7 and 8.1 / 8.1, Deep
  Wood 2.5 / 2.5 and 14.7 / 15.1. About +0.3–0.5 ms at the Retina size on High, +0.3 on Handheld
  (this machine's run-to-run spread is ±30 %).

## Hatching that follows the form

The sheets fan the shade's strokes out from the stalk under a cap (Vael II's tables, the Garden's umbrella
trees, Lorn II's mushrooms) and wrap them round a cylinder (the Buried Machine's tanks, drums and towers,
trunks). Merged geometry has no axis, so the builders give each part one (`src/form.js`) and the material
asks for it (`makeMaterial({ form: true })`, `S_FORM`, `FORM` and `formHatch` in `src/materials.js`):

- **The axis per vertex**: `formAxis(geo, 'cap' | 'wrap', { centre, axis })` writes `aFormC` (a point on
  the axis, w the kind) and `aFormA` (its direction) in the part's own frame (the y axis through the
  origin, as lathes and cylinders are made). The part's own `applyMatrix4` carries them, so `translate`,
  `rotate*`, `applyQuaternion`, `scale` and the kits' `put` / `place` move the axis with it; a copy
  (`toNonIndexed`, `mergeVertices`) does once `keepForm` is called (the kits' `mergeable` does). Parts with
  and without an axis merge after `padForm` (the others kind 0: plain hatching); `RoomKit.finish`, the
  Garden's, Vael II's and the Buried Machine's batches pad. A material without an axis on its geometry
  reads kind 0 (`defaultAttributeValues`).
- **The strokes** (`formLines`): the vertex shader writes the point about the axis (`vForm`: across it x,
  y; along it z; affine in the position, so exact across a triangle); the fragment takes the angle
  (`atan`, a turn `FORM.turn` = 1024 units, so every power-of-two spacing closes on itself: no seam) and
  its derivatives analytically (atan's jump has none). A **cap**'s strokes are isolines of the angle: they
  radiate from the stalk under the cap and run down the stalk; the cross-hatch is more of them, between
  (dense, not a web). A **cylinder**'s are rings (isolines of the height along it), the cross-hatch along
  it; on a face across its axis (a drum's lid, a slab's top) the rings would be degenerate, so it radiates
  as a cap (the share by the two coordinates' screen gradients). The spacing comes from the screen as the
  hatch's does (powers of two, the next level cross-faded, every other stroke fading out as they converge
  on the stalk; none once there would be under two a turn). Each stroke has its own pressure and offset
  from where it lies, and wavers along its length near (faded out from 68 to 90 m; none on the handheld).
- **Under a lifted shade** a cap keeps more of its strokes (`FORM.cap.keep`): Lorn II's pale mushrooms
  keep their gills' fan.
- **Veins** (`makeMaterial({ form: true, veins })`): on a dark cap's underside ink would vanish, so the
  references' Garden umbrellas draw their veins lighter, radiating from the trunk, lit or not (albedo, a
  line a shade lighter).
- **On**: Vael II's tables, cliffs and discs (`bone`, `cap`, `rose`), the Garden's umbrella trees (trunk,
  canopy, branches), Lorn II's trunks and giant mushrooms, the Buried Machine's tanks, pillars, drums,
  chimney stacks and every `cylBetween` (rust, rust grid, teal, steel); the references' Vael II
  mushrooms, Garden umbrellas, Lorn II trunks and mushrooms, Buried Machine tanks, drums, machines and
  towers. `uFormHatch` 0 turns it off (the dev menu's "hatching follows form").
- `tests/form-hatch.test.js`: the define and its exclusions, the axis carried through moves and merges,
  the angle's seam, the builders.
- **Cost** (M4 Pro, 1728 × 1117 at DPR 2 (3456 × 2234), frames back to back, S_FORM recompiled off and on
  in the same page, the difference paired, median [quartiles], ms): High Vael II spawn +0.28 [0.1..0.96],
  the great table +0.09 [-0.33..0.6], the Garden under an umbrella (its underside filling the frame)
  +0.47 [0.23..0.63], the Buried Machine spawn -0.05, its chimney stack +0.27; Handheld Vael II spawn
  +0.28, the great table +0.4 (before the far waver went). Only shaded pixels of parts with an axis pay
  (an `atan` and a stroke family as the hatch's own).

## Colour across a wall: big flat patches

The sheets break a building's colour into a few big flat patches with a clean edge: a repaint, a sunlit
plane, one storey rendered differently. `makeMaterial({ patches })` (0..1.5, `S_PATCH`, `PATCH`,
`patchesOf`, `wallPatch` in `src/materials.js`), on by default wherever a material has built pen detail
(the weathered walls: house fronts, Qanat, the desert's domes, the Signal Market, home, the City-Shaft's
references; the Buried Machine's rust and teal), never metal, glass, lights, the makers' work, people,
ground or water:

- **Three layers**, each constant over boxes of the world (no wall frame: a round wall has no seam where a
  projection would switch): a building (a 17.3 m box of the coarse lattice) gives each of its faces (+x,
  -x, +z, -z) its own tone, blended by the normal so a curve turns smoothly (a sunlit or repainted plane)
  and now and then one storey all round it another render (a band, warmer and paler or deeper); the fine
  lattice's boxes (6.4 m, a storey high) carry repaints, a run of one to three storeys, lighter, darker,
  warmer or cooler. Few and big: a fifth of the boxes, a band in eleven storeys.
- **A few percent**: the colour moves by up to `PATCH.tone` (13 %), its change capped at `PATCH.edge`
  (0.15 in linear RGB).
- **A clean edge, no line**: post.js inks a colour step over 0.08 between pixels about its interior line
  width apart. Within `PATCH.ramp` (1.8 px × the pixel ratio) of the nearest face of either lattice the
  colour ramps linearly to the mean of both sides, so the steepest step stays under it (crisp at Retina,
  never inked); only there is the neighbour looked up, and only its layer (a repaint's edge: two hashes).
- **By distance**: none past 380 m (faded from 260), so far pixels pay nothing.
- `tests/wall-patch.test.js`: the defaults and exclusions, world boxes, the edge under the threshold, the
  far cut.
- **Cost** (M4 Pro, 1728 × 1117 at DPR 2 (3456 × 2234), S_PATCH recompiled off and on in the same page, the
  difference paired, median [quartiles], ms; the machine was loaded by other jobs, load average ~29):
  High Signal Market spawn +0.63 [-0.48..1.18], over its street +0.39 [-0.36..1.85], Qanat's street
  +0.43, the desert's spawn within the spread; Handheld Qanat +0.22, the Market +0.13 and +0.17. Every
  pixel of a built wall within 380 m pays a handful of hashes, no loop, no texture.

## Paving: flagstones in courses (issue #669, `paving`)

The plazas and streets were one colour and a ruled grid (`S_GRID`): 46–82 % of the measured surface in four cities
(docs/audits/surfaces-v2.27.md). `makeMaterial({ paving })` (`true`, a course's depth in metres, or `{ size, wear,
tone, turn }`; `S_PAVING`, `uPaving`, `src/paving-shader.js`) draws the picked sheet's flagstones
(`references/surfaces/paving/sheet-1.jpg`) on a material's upward faces (n.y over 0.7; its sides keep their grid, the
top's grid gives way):

- **Courses and stones** (`paveStone`): courses along x (or turned by `turn`) of uneven depth (each seam moved by
  ±20 % of a course), each course its own stone length (1.1–2 courses) and offset, each joint moved by ±25 % of a stone:
  staggered, short and long. In world metres, so neighbouring meshes of one floor meet.
- **The outline**: a box with worn round corners (6 % of a course), its distance in px across the nearer edge (each
  axis its own metres per px: the follow camera sees the floor at a slant), a 1 px joint.
- **Each stone its tone**: ±3.5 % in value, a sixth a little rosier, a seventh sandier, now and then (`wear`) a patch
  of a greyer stone with denser pits. Under post.js's colour-edge threshold.
- **Wear**: a crack across one stone in seven (× `wear`), from an edge, jagged on two scales, thinning to its end
  inside the stone; grit gathered in the joints; small pits; a brass survey disc on one stone in fifty.
- **By distance, as the sheet's strip**: grit and pits only within a few metres (gone by 1 cm a px, and on the
  Handheld preset), cracks to ~2.5 cm a px, the joints across a course fade when a stone is under 16 px long, the seams
  between courses when a course is under 14 px deep, the tones when a stone is under 20 px: flat colour far, never a
  grey ruled field. Past every fade the function returns before looking anything up.
- Where: the City-Shaft's rim plaza (1.8 m), the Signal Market's floor (2 m) and its pavements (1.2 m), the Moon
  Foundry's yard (3 m slabs, half the wear, less tone), the City Floating in Space's piers (1.5 m) and bridges (0.8 m),
  the Underwater City's streets (1.4 m), the Garden of Spheres' paths (0.9 m).
- **Unity**: `scripts/unity-export/paving-hlsl.mjs` turns `PAVING_GLSL` into `Shaders/Paving.hlsl`; Surface.shader
  calls it in a uniform branch on `_Paving` (port-format.js `paving`, WorldLoader.cs), never on the plain variant
  (BridgeRenderer.Lean). `tests/paving.test.js`: the option, the define, the layout's JavaScript twin (`stoneAt`:
  every point in one stone, course depths, staggered joints) and the port's copy being current.
- **Cost**: M4 Pro, 1280 × 720, the shipped bundle, scripts/bench/passes.mjs's `noPaving` toggle (the uniform's course 0) paired
  with the paving on in the same page at the worlds' benchmark views, whole frame, median of 5 reps, ms (on minus off): the
  Signal Market High −0.2..+0.4, Handheld +0.2..+0.8 (its wide view the most); the Moon Foundry High −0.2..0, Handheld ±0.05;
  the City-Shaft Handheld −0.9..+0.1. Within the spread of a shared machine (load average 10–16 from other agents' jobs;
  the City-Shaft's paired High runs were too contended to read). Whole builds back to back in a quieter moment (load 4–7,
  .claude/skills/perf-audit/fps.mjs, High, base d51d8549f against this change): the City-Shaft's plaza views' median frame
  +0.7..+1.3 ms (8.9 → 9.8 at its start), its shop (no paving) +0.3 (the drift between the runs); the temples' views
  (the machined finish) +0.1..+0.4. A few dozen hashes a near pixel, none past the fades.

## Interiors, sheet metal, timber and the ground's middle distance (issue #669, `src/surface-marks.js`)

The rest of the surface audit's materials (docs/audits/surfaces-v2.27.md), each after its picked sheet in
`references/surfaces/`, each its own define so a material without it pays nothing, the GLSL shared with Unity
(`scripts/unity-export/marks-hlsl.mjs` writes `Shaders/SurfaceMarks.hlsl`; Surface.shader calls each in a uniform branch;
port-format.js and WorldLoader.cs carry the uniforms; BridgeRenderer.Lean keeps them off the plain variant).

- **Interiors** (`interior`, `S_INTERIOR`, `uInterior`, `uInteriorDado`, `uInteriorSkirt`; on every room of
  `src/interiors.js buildRoom`, so every world's shop and the rooms): in the room's own frame (floor at y = 0). The floor
  hand-laid tiles (0.6 m), each grout line moved a few millimetres its own way, a tone a tile and one in eleven a mint or
  pale blue one; the walls painted plaster with soft repainted patches (a few percent, soft: never a colour edge) over a
  dado band (to 1.2 m, the wall's colour × 0.74 unless a room names one) and a tiled skirting (to 0.32 m, the wall's colour
  toward cream, a joint every 0.42 m), their edges inked. The walls' strata bands and ruled grid are gone (the audit's
  "ruled tiles, flat plaster"). `o.room` is the ship's rooms' key light (ROOM_LIGHT): this one is `interior`.
- **Sheet-metal walls** (`sheet`, `S_SHEET`, `uSheet`; the Moon Foundry's machinery and block houses, in place of their
  built pen detail): panels in courses (1.6 × 1.25 m, each course its own widths, staggered), rivets in rows along every
  seam, a panel and its neighbour now and then repainted bluer, rustier or creamier (≤ 7.5 %), a rust streak run down from
  a rivet under the top seam of three panels in ten. Rivets and streaks go first with distance, then the seams; the
  repaints stay to the far strip, as the sheet's.
- **Worked timber** (`timber`, `S_TIMBER`, `uTimber`; the desert's wells, dunes and landmarks' wood, the City-Shaft
  quarters', the Moon Foundry's planks, the Underwater City's posts, Lorn's canopy planks and beams): in the object's frame,
  planks across the grain (0.24 m, each its tone, one in ten painted a faded teal and flaking), grain strokes in long
  runs and knots near, nail holes; sun-bleached tops, darker undersides; a post (`post`) shows its end grain darker, a
  board's face across the grain takes it along x or z.
- **The ground's middle distance** (`groundMid`, terrain only, `S_GROUNDMID`, `uGroundMid`; Vael, the Glass Dunes, the
  Buried Machine, home): what `ground-ink.js` hands over to past ~15 m: broad soft drifts of a paler, ochre tone, long pen
  lines along the fall of rolling slopes (the height's 3 m contours, in long runs, only on gentle slopes), and stones with
  their shadows (`pebbleField`, 4.5 m cells) that still read out to ~200 m.
- Viridel's terraces (the white builders' steps under the tea terraces, `src/story/terraces.js`) are paved
  (`paving`, clean: little wear, little tone).
- `tests/surface-marks.test.js`: the options, the defines, the port's records and the HLSL being current.
- **Cost**: M4 Pro, 1280 × 720, the shipped bundle, .claude/skills/perf-audit/fps.mjs back to back (base 5600ee196 against
  this change; load average 3–4, a quiet machine), median frame ms: Handheld within ±0.2 everywhere (the Moon Foundry,
  the Glass Dunes, Vael, Lorn, the City Floating in Space; their shops 2.1–3.2 → 2.1–3.2); High the Moon Foundry ±0.1,
  the Glass Dunes 0..+0.3, Vael's slopes +0.1..+0.6 (the ground's middle distance), the shops +0.1..+0.5, Lorn +0.1..+0.6
  (the walkways' timber, and a drift: its temple, unchanged, +0.2). Draw calls unchanged.

## Sea walls, pale stone, the buried city, panelled domes and water channels (issue #677, `src/surface-marks.js`)

Part 2 of the surface work: five more materials after the author's picks in `references/surfaces/`, the same way as
#669's (each its own define, so a material without it pays nothing; the GLSL in `SurfaceMarks.hlsl` for Unity through
`scripts/unity-export/marks-hlsl.mjs`; port-format.js and WorldLoader.cs carry the uniforms; BridgeRenderer.Lean keeps
them off the plain variant). Every mark fades by its size on screen, the finest first.

- **Sea walls** (`seaWall`, `S_SEAWALL`, `uSeaWall`: tide spacing, the foot's world height, salt, growth; the Underwater
  City's towers, domes, rims, benches and pods' undersides, `underwater-kit.js uwMats`): in the world's frame, so a dome
  has no seam. Up to four tide lines over the foot (1.15 m apart, each its own height, in long runs, a shade darker, a
  fine line on top near), white salt bloom at the foot and under ledges (gone far), green growth stains and barnacle
  dots in the shaded foot (the face turned from the sun), and repaired patches of a fresher pink with a fine outline
  along the wall's dominant axis, faded where it turns (no seam round a dome). The towers' weathering is halved.
- **Pale stone** (`paleStone`, `S_PALESTONE`, `uPaleStone`: course, block, foot, wear; `landmark-materials.js
  paleStone()`, Lorn's Hush-House terrace, drum and columns and the Lamp-House, in place of their cut stone): large
  soft-edged blocks in courses (each course its own block length), each its tone, one in fourteen a warmer stone, a worn
  upper arris catching the light, fine rain streaks hanging from a course's top, a darker damp band at the foot (its
  top wavering), hairline cracks and pits near; tops laid as flagstones of the same blocks. Never inside the temples
  (their machined finish).
- **The buried city** (`buriedCity`, `S_BURIED`, `uBuried`: band, foot, the sand line over it, scour; the Glass Dunes'
  city under the sand and what each window in the sand shows, `glass-dunes-city.js`): soft wind bands (0.55 m, each its
  tone, wavering), broken lines between them, lighter scoured runs, wind-worn tops, a few sand-blasted blocks, and in the
  city a wavering sand line at the walls' foot (sand-coloured below, a faint stain over it). The windows' glimpses have
  no sand line (each lies at its own depth).
- **Panelled domes** (`domes`, `S_DOMES`, `uDomes`, `uDomesBand`; the Desert's far dome city, `world.js domeCity`, in
  place of its 4 m grid): in the object's frame (the dome's foot at the origin): rings by the angle up the dome (five a
  hemisphere, the top a cap), panels round each ring as many as fit its circle, a light line over each seam (raised),
  a few panels of another tone, now and then a ring painted the band colour (white domes in teal or orange, the coloured
  ones in white), small round vents near, a sand-scour band at the ground; the rings stay furthest, the joints go first.
  The towers (`domes: { tower: true }`) take rings every 4 m. Not on the spired city on the horizon (one merged mesh:
  no dome has its own frame there).
- **Water channels** (`channel`, `S_CHANNEL`, `uChannel`: half width, axis, flow; Viridel's terraces' runnels,
  `story/terraces.js`, each length's middle at its object's x = 0): calm flow lines carried down the current, a pale line
  of light along each edge, a darker wet lip. (The audit's "teal channels ×252" are the great trees' canopy discs,
  `edena.js canopy`; the runnels are Viridel's only channels.)
- **The ground's middle distance, stronger** (the author: "the ground in Vael is fully a flat color"): `groundMidTone`
  now lays patches of a paler sandy ochre (mixed toward it, not multiplied: on Vael's salmon a factor went orange) and a
  few rosier ones, each soft over at least four pixels (never a colour edge post.js would ink), with a broken pen line
  along the pale patches' edge near and in the middle distance; `groundMid` adds short wind dashes near, small pebbles
  with their shadows near where the ground has no print pebbles of its own (`uDots` 0: Vael, home), and the 4.5 m stones
  from the foot of the view, not only past 15 m. Vael, the Glass Dunes, the Buried Machine and home. Vael's "pale paving"
  in the audit is the fallen colossus's and the tower's strata stone (`arzach.js`): no paving there, left as it is.
- Two of #669's leftovers: the Moon Foundry's polishing drum (the round tank) is drawn with its metal's pen detail
  (the riveted panels broke up on its curve), and the Buried Machine's canyon floor (`rustFloor`, terrain) takes the
  ground's middle distance.
- `tests/surface-marks.test.js`: the options, the defines, the port's records, the Unity wiring and the HLSL being current.
- **Cost**: M4 Pro, 1280 × 720, the shipped bundle, .claude/skills/perf-audit/fps.mjs with `--root` (base 93a03bb04 against this
  change), the worlds' benchmark views, median frame ms. The five materials, Handheld (load average 4–5): −0.2..+0.4 everywhere
  (the Underwater City's start +0.4, Lorn +0.2..+0.3). High was not read cleanly: in one pair the change's run shared the
  machine with a test run (Viridel, unchanged in its views, +0.4..+0.8; the Underwater City +0.6..+1.0), in the other the
  base's run did (load 8–12). The stronger ground (Vael, the Glass Dunes, home), High, two alternating pairs at load 8–12:
  −0.7..+1.8, mostly +0.1..+1.1 (the patches' fields and their edge are paid on every pixel of ground). Draw calls unchanged;
  the Underwater City compiles four programs more. To re-measure on a quiet machine.

## The sky stones' walked tops (issue #685, `rockTop`, `src/surface-marks.js`)

The author: "for Vael I also meant the bridges and islands that I traverse". #677 strengthened the plain's ground; the
sky stones (`src/levels/arzach2.js buildSkyStones`, part of Vael) were still one flat cream, rose or strata band where
you walk. The survey (a downward ray at each walked place, the material it meets): the start plateau, the needle
plateau, the floating island, the rock arch and the stepping stones by the great table were the bone rock (strata,
`flat`), the great table and the hoodoos the smooth cap (strata), the rose cliff the rose rock (strata), the aqueducts
`aq` (strata bands 2.6 m, flat on the deck), the monastery's, the island church's and the hermitage's walls flat white
(`facade` windows, or plain). There are no timber bridges: every bridge is masonry (the aqueducts) or rock (the arches).

- **A rock's walked top** (`rockTop`, `S_ROCKTOP`, `uRockTop`: crack cell, pebbles, amount; `ROCK_TOP`): on a material's
  upward faces only (n.y over ~0.8; its sides keep their strata, which read well on the cliffs), the open-ground sheet's
  marks in their rock version: broad soft patches of a warmer, sandier tone and a cooler grey one (multiplied, soft over
  four pixels: never a colour edge), a crackled crust of small Voronoi cells (1.4 m) in parts of the warm patches with a
  broken pen line along their edge, long jagged fissures in runs, and pebbles and stones with their shadows
  (`pebbleField`, 1.1 m and 4 m cells; a top is in the sun, so their cast is always drawn). The crust goes when its cells
  are under ~10 px, the patches' edge past 3–8 cm a px, the fissures past 5–14 cm a px; the tones stay, broad and calm,
  as the sheet's far strip. On the bone rock, the cap and the rose rock (`arzach2.js ROCK`: every plateau, table, the
  island, the arches, the stepping stones), and the lantern stones (`sky-stones-ways.js`). Not the needles (no walked
  top), never on the terrain (its own ground marks) and never in the Founders' Belfry.
- **The aqueducts** (`AQ_STONE`): pale stone (`paleStone`, course 1.1 m, block 2.3 m, no damp foot: their piers go down
  into the cloud) in place of their strata bands, so their decks are laid in flagstones of the same stone and their
  parapets are blocks; Ondine's tally stone on the long aqueduct the same. **The monastery's walls** (and the island
  church's and the hermitage's: one material each) are pale stone in Lorn's blocks, a little less worn (`WALL_STONE`),
  their drawn windows over them.
- **Unity**: `rockTop` in `SurfaceMarks.hlsl` (generated), called in Surface.shader in a uniform branch on `_RockTop.w`,
  carried by port-format.js and WorldLoader.cs, kept off the plain variant (BridgeRenderer.Lean). Compiled in batch
  mode on Metal (default, SKIN, LEAN, LEAN_SLIM, LEAN_TERRAIN, LEAN_WATER, VMAT, LEAN+PLAIN): 0 errors. No Unity pictures.
- `tests/surface-marks.test.js`: the option, the define, the upward-faces test, the port's record and the Unity wiring.
- **Cost**: M4 Pro, 1280 × 720, the shipped bundle, .claude/skills/perf-audit/fps.mjs `--worlds arzach2,arzach --root`
  (base 280a6d97c against this change), two pairs a preset back to back, median frame ms. The sky stones' start view
  (the plateau's top fills the screen): High 8.9 → 9.5 and 8.4 → 10.0, Handheld 6.5 → 6.1 and 8.8 → 9.5; their other
  views and Vael's plain within the noise (load average 6–9 in the first pair, 7–16 in the second). Draw calls unchanged,
  four programs more.
## Lorn's crystals, faceted (issue #686, `src/surface-marks.js`)

Part 3, after the author's pick (`references/surfaces/crystals/sheet-1.jpg`), the same way as #669's and #677's: its own
define (`S_CRYSTAL`), the GLSL in `SurfaceMarks.hlsl` for Unity, `port-format.js` and `WorldLoader.cs` carrying the
uniform, BridgeRenderer keeping it off the plain and the slim variants.

- **`crystalFacets`** (`S_CRYSTAL`, `uFacetMarks`: rim, the root's glow, near marks, 1; `CRYSTAL_FACETS` its tuning). Unlike
  the walls' marks it is allowed on lights (the crystals glow); never on glass, people, ground or water. On Lorn's grove
  crystals (four colours, still one static batch: the uniform is the same on all), the Great Crystal, the cave's crystals
  with the cave's crown and Wendel's lookout (one material, `caveMat`), the ringing groves (`lorn-veins.js`, their spikes
  merged with their uv now, not through `Bucket`) and the Deep Wood's crystal clusters (instanced).
- **The facets' frame is the geometry's uv** (issue #693: `src/crystal-forms.js`). Each face is drawn as a fan round its
  middle: u is 0 on the face's edges and 1 in its middle, so u / fwidth(u) is how many pixels a point lies from the
  nearest edge (the rim and the chips go by it, on every edge: the long ones, the shoulder, the chips' own), and 2 /
  fwidth(u) about how wide the face is on screen; v runs up the crystal from its root (0) to where its point is (1, even
  when the tip is broken). The buried foot, and `facetUV(geo)` (Wendel's columns), get v = −1: their tone only.
  Unity reads the uv in the form's slot (`O_FORM = float4(v.uv, 0, 0)`), which the slim variants do not have.
- **What it draws**, by size on screen as the sheet's strip: each facet one flat tone (×(1 + 0.26 n.y + 0.18 n·sun + 0.3
  of its own), a seed from its flat normal; deeper and cooler in shade), always, so a crystal reads as a light, a mid and a
  deep face at play distance; a warm pale glow over the lower 38 % toward the root, in three flat steps (a smooth ramp there
  is printed as a grain), the glow term +0.06; a pale rim inside each long edge, soft over 2.5–7 px (the crease is the
  line), once a facet is over ~10 px wide; chips bitten out along the edges here and there (up to 0.24 m, their own
  noise in the facet's plane, soft across the bite), drawn as light through the glow term once over ~3–8 px (as a paler
  albedo they were printed as a dark grain: issue #693); near (under ~1–3 cm a pixel, not on the handheld) sparse fractures and tiny
  inclusions in the facet's own plane, drawn as light through the glow term (a paler albedo there broke into specks).
- **Ceilings**: an albedo channel over ~0.9 is printed by `post.js` as a grain of specks, not a flat light, so each tone
  is scaled down whole (its hue kept) under 0.72 after the facets' tones and under 0.88 after the glow and rim: the
  crystals are a step deeper and more saturated than their flat colour was, the glow and rims the light over them.
  (A per-channel clamp went grey-white on the lavender ones.)
- **Cost**: M4 Pro, 1280 × 720, the shipped bundle, `.claude/skills/perf-audit/fps.mjs --worlds perdide --root` (base
  280a6d97c against this change), Lorn's four benchmark views, median frame ms. Handheld (load 19–23): 7.1 → 7.1, 6.8 → 6.6,
  5.3 → 5.5, 5.1 → 5.2. High, two alternating pairs (load 20–34, contended): within ±0.3 ms of each other in every view
  (e.g. 9.5/9.6/8.4/8.5 base against 9.8/9.9/8.2/8.6). Draw calls unchanged (the views' own ±3), three programs more
  (the crystals' variants). To re-measure on a quiet machine.

## Painted relief (issue #696, `src/relief.js`)

The surface marks are flat: colour and ink, no normals. The painted relief makes them read raised or engraved the way a
pen-and-wash drawing does: beside a mark's ink line, a thin lighter band on the side that faces the sun and a thin darker
one on the side turned from it, oriented by the sun's way **across the face** (`uSunDir` projected into the pattern's own
frame), so they agree with the cast shadows. Still flat colour: the darker band is a tone of the surface's own colour
(−16 % and at most 0.065 a channel), never ink; the lighter one the same under a 0.9 ceiling (a brighter channel prints as specks).

- **One switch**: the shared `uRelief` (materials.js `sharedUniforms`), **on by default** since the author picked it
  from the review page (v2.31). `?relief=0` turns it off for the session (a before/after); the dev panel's Beauty ›
  "painted relief (review)" flips it live. Off, `reliefTone` adds exactly nothing and every pattern skips its relief
  branch: the flat marks as they were. The Unity port reads the same shared value
  (`_Relief`, HiraethLook.cs from the look's `shared`).
- **The helper** (`RELIEF_GLSL`, included before every pattern): `reliefEdge(dpx, g, sun2, inkW)` the signed band beside
  an edge (px from it; `g` the way the nearest slope faces: out of a raised thing, back toward an engraved groove; the
  band starts past the ink line's half and has soft ramps of 2 device px, so no step from one pixel to the next crosses
  post.js's colour-edge threshold and inks the band as a line of its own); `reliefTone(alb, r)`; `reliefFrameSun(...)`
  the sun across a face in an object's own frame, from the two frames' screen derivatives (rooms).
- **Where**: paving's stones (raised), sheet metal's panels and rivets (raised: a lit and a shaded crescent beside each
  dot), pale stone's blocks (raised), the buried city's wind bands (grooves),
  the sea walls' repaired patches (raised), a rock top's fissures (engraved, at half strength: the field
  is steep across a fissure, its band narrow, and a full one was inked as a second line; the field's direction from its
  screen derivatives), the interiors' floor tiles (raised), the makers' machined finish (`mkFinish`: the inlaid border and the
  sockets engraved; the set-back panels' shadow along the edge toward the sun instead of the fixed top-left one). A wall
  panel's frame in `mkFinish` takes the sun's height only (its run along the wall is each skin's own, not known there).
- Each band fades with the mark's size on screen, as the mark's own ink does; a face turned from the sun has none.
- **Not on timber**: tried, and lost in Lorn's dark planks, their grain and hatching (the review page's verdict).
- **Review**: `tools/relief-review.html` (open on any dev server), its pictures and frame times made by
  `node tools/relief-shots.mjs` (fixed views in `tools/relief-review/views.json`; `--preset medium --out <dir>` shoots
  them at render scale 1, as the Unity port and the web's Medium, Deck, Xbox and handheld presets draw).
- **Inked beside a joint at render scale 1** (issue #700, open): across a joint the lit band (+) and the shaded one (−)
  sit on either side, so post.js's colour-edge test, whose kernel reaches `inW × uPixelRatio` px (about 1.5–2) and
  straddles the joint, sees both at once (up to 2 × 0.065 a channel, ≈ 0.2 in RGB length on Lorn's purple stone)
  and inks a dashed line just past the joint's own; the 2 px ramps only keep *neighbouring* pixels under its
  threshold. Web High draws at render scale 1.5 and averages it down to faint dashes; every preset at scale 1 (web
  Medium, Deck, Xbox; the Unity port, which never supersamples) shows them crisp. The Unity port is not at fault: at
  the same render scale its albedo and final picture match the web's within a level or two of 255 (shop floor, Lorn's
  stone, the Glass Dunes drum, the City-Shaft paving, the Foundry walls). A fix belongs in `src/relief.js` (both
  renderers): a smaller cap, bands that start past the kernel's reach, or the relief kept out of what the colour-edge
  test reads.
## The census's code-only list applied (issue #691)

docs/audits/surfaces-v2.30.md's "code only" list: every item an existing pick covers, as options on materials (no new
pattern, nothing in `src/surface-marks.js`), biggest walked share first. The census's walked table before and after is
in the audit ("After #691").

- **The City-Shaft** (`levels/incal.js`): the tiers' slabs, the spire's rings, the bridges and the palace landing
  `paving` (`TIER_PAVING`, 1.6 m courses; their sides keep the steel grid); the red stairs (`incal.stair`, also
  `shaft-ways.js`) paving treads (0.7 m) and `sheet` sides; the rim's and the palace's cream parapets `paleStone` (dry: its
  foot far under the world, no damp band).
- **Viridel**: the water stair's kerbs and stepping stones `paleStone` (`viridel-stair.js`, dry); the Builders'
  Greenhouse's walls and floors in the makers' machined finish (below).
- **The Garden of Spheres** (`levels/spheres.js`): the white stone (`white`, `pole`) `paleStone`, its tops its
  flagstones; the plaza's painted rings `paving` (2.2 m, little tone: their joints stay few). The Footprint's wall panels
  call `mkFinish` too (`skins/footprint.js` plaster body).
- **The Signal Market**: a `deck` material (paving 0.9 m, sheet sides) for the market in the air's galleries and treads
  and the square's approach; the awnings, crates and trims keep the plain cream (paving on their tilted tops would lay
  flagstones on cloth). **The Underwater City**: `streetPale` paved as `street` (1.4 m).
- **The Moon Foundry**: the shed roof's deck `plates` (S_PLATES: staggered plating with its tones; `sheet` draws on walls
  only); the cast moons' ivory `rockTop` (every ivory tone, so they still merge into one draw).
- **Vael**: the plain's great column and the riders' road's worn steps `paleStone`; the road's red walls keep their
  ledged bands with `weathered` (rock, not masonry); the salmon slabs `rockTop`.
- **The Desert**: Qanat's kit paints weathered (`Kit.weathered`, desert-city.js; the camps and the giant keep theirs),
  its square `paving` 1.1 m; the Givers' dry channel's bed `rockTop` (it curves: `channel` follows an object's straight
  axis only) and its bank stones `paleStone`.
- **The Glass Dunes**: the buried city's floors `interior` tiles (0.9 m, no dado or skirting); posts and poles `timber`
  posts. **Every port** (`levels/port-pad.js`): the pad's paint its own mesh, a `deck` material with `paving` 1.2 m (the
  pieces keep the matte; one draw more a port).
- **Home**: the landing ring `paving`; the tomb's and the stepping stones' stone `paleStone`.
- **Posts and stakes**: the Glass Dunes' poles, the Buried Machine's Tooth Day posts, Lorn's water-way and the keepers'
  stalks' wood `timber: { post: true }`.
- Left: Lorn's crystals and the Glass Dunes' prism crossings (#686, S_CRYSTAL), the ship's hull, Vael's cloud banks, the sand drifts in the buried city.

- **Cost**: M4 Pro, 1280 × 720, High, the shipped bundle, .claude/skills/perf-audit/fps.mjs with `--root` (base 3473729a0 against this change), the City-Shaft, Viridel, the Signal Market, the Garden and the Desert with their temples and shops. Not read cleanly: the machine was shared (load average 22 → 57 → 38 over the pair, 13 → 35 over two more City-Shaft pairs), and the same views moved by ±5 ms between runs of one build. Draw calls +0..+5 a view (the ports' pads one mesh more), programs +2..+6. To re-measure on a quiet machine.

### The machined finish outside the skins (`skins/machined-plates.js`)

`machinedMaterial(options, { plate, panel, obj, origin })`: a surface material spliced with the `machined` skin
pattern (skin-shader.js, last in `SKIN_ORDER`, so the Unity port draws it from `SkinPatterns.hlsl` like every skin's):
upward faces square plates (`plate` m) and the rest panels in courses (`panel` [w, h] m) along the face's dominant
axis, each handed to `mkFinish` (its tone, inlaid border, sockets, machining marks), the joints inked fine, in the
object's frame (`obj`, the default) or the world's from `origin`. Used for the makers' courts' pads (`finds/courts.js`,
1.9 m plates) and their blocks and chests' plinths (`gadgets/yard-kit.js` stone, 1.2 m, also the Gadget Yard), and by
`machinedHouseSkin()`, the Greenhouse's `def.skin`: its kit's wall and floor swapped for machined ones in its own
colours before the layout and put back after (its exterior keeps its look).

### Garden beds (`beds`, `S_BEDS`, `src/garden-beds-shader.js`) and the Rose House in red stone

After the author's two picks of the census (`references/surfaces/garden-beds/sheet-1.jpg`, `rose-house/sheet-1.jpg`):

- **Garden beds** (`makeMaterial({ beds })`: true, a row in m, or `{ row, turn, plants }`; `uBeds`: row, turn, plants,
  on): on a material's upward faces, in the world's frame turned by `turn`: earth raked in straight furrows (a ridge lit,
  a furrow shaded, a fine pen line along its bottom near), rows of seedlings and small rounded bushes along the ridges of
  a share of the rows (`plants`; each a soft rosette lit on the sun's side with its shadow beside it), drier paler
  patches (nothing planted there), pebbles with their shadows near. By size on screen: pebbles and pen lines first,
  then the plants, the rows last; flat colour far. On Viridel's water stair beds (turned across the stair, the soil now
  umber `#86694a`), the long seed row (a few rows sprouting), the tea terraces' earth, and home's raised beds (their own
  mesh, `garden: beds’ earth`, no plants: their crops are modelled). Unity: `scripts/unity-export/beds-hlsl.mjs` writes
  `Shaders/GardenBeds.hlsl`; Surface.shader calls it in a uniform branch on `_Beds.w`; port-format.js `beds`,
  WorldLoader.cs `_Beds`; BridgeRenderer.Lean keeps it off the plain variant. `tests/garden-beds.test.js`.
- **The Rose House** (`skins/rose-house.js`): its slate recoloured to the pick's red stone (walls `#a85a56`, floors
  `#cf8676`, its trims, fittings and dressing to match), every slab and floor plate handed to `mkFinish` (machined.js:
  its tone, an inlaid border, sockets, machining marks), and amber light inlaid along a share of the floor's 4.2 m
  joints in long runs (`ROSE_SKIN.joints`: 40 % of the joint lines, 75 % of a lit line's plates), emissive and breathing
  as its circuits, which are amber now. Never organic. The engraved bands of the pick are the friezes the house already
  has. It ports as every skin's pattern (`SkinPatterns.hlsl`, regenerated).
### Their shapes (issue #693, `src/crystal-forms.js`)

After the author's second look at the sheet ("the crystals in the references have a bit rougher edges, like they have
been chipped over time"; no roots: those were the reference's, not the crystals'):

- **`crystalPrism({ r, h, sides, tip, taper, chips, broken, base }, rand)`**: a six-sided prism (its cross-section a
  little irregular, `CRYSTAL_FORM.wobble`), narrowing by `taper` to its shoulder, a pointed tip 1.1–1.7 × r long with its
  point a little off the axis. Worn by convex cuts (`clipSolid`: a plane through the solid, its cut a new face): a
  shoulder's corner chipped off, an edge bevelled from part way up to the shoulder, the point blunted, and with
  `CRYSTAL_FORM.broken` (18 %) the tip broken off at a slant. A cut that would reach past its anchor's neighbourhood is
  left out, so a crystal never loses more than a corner; it stays closed and every face flat. About 60 triangles.
- **`crystalCluster({ r, h, companions }, rand)`**: the main crystal and one to three smaller ones (0.3–0.68 of its
  height) leaning out round its foot, sunk so their feet stay under the ground.
- **Their own dice** (`crystalRand(x, z, k)`, a seed from the place): the world's `rng` is drawn exactly as before, so
  nothing else in Lorn moves.
- **Where**: the groves (each crystal a cluster, the main as tall as the old cone, its girth max(0.55 r, h / 13); the
  companions take another of the palette's colours 40 % of the time, still one static batch a colour a grove), the Great
  Crystal (nine spires at 0.62 of the old cone's radius, their splash points as wide as the spire there, and a ring of
  seven smaller ones leaning out round its foot), the cave's (each a small cluster out of the vault), the cave's crown
  and Wendel's lookout (unbroken: their tops are landmarks), the ringing groves and the Deep Wood's (one chipped prism,
  instanced).
- **Colour**: the sheet's soft lavenders and aqua-mints, paler and greyer than the cyan and purple before
  (`CRYSTAL` in `src/levels/perdide.js`: three lavenders, two aqua-mints; the Great Crystal `#a79cd0`, the cave
  `#93c9c0`). The story's song brightens each from the colour its level gave it, not a constant.
- **Collision**: the drawn crystals are fans round each face's middle (for the facet frame), twice the triangles a solid
  needs, so a grove's meshes are `noCollide` and an invisible collider (`crystalCollider`: each face once as a plain fan,
  the buried feet left out) stands in for them: the same solid. The other crystals collide as drawn (few).
- **Cost** (M4 Pro, 1280 × 720, the shipped bundle, base 26b565197): draw calls unchanged; triangles a frame +2–17 %
  by view (High: start 1707k → 1737k, crowd2 671k → 785k); frame times within the noise (Handheld on a quiet machine
  6.4/5.9/4.8/4.7 → 5.6/5.2/4.3/4.2 ms; High three contended pairs overlapping); the load's collision bake 604–612 →
  761–928 ms, the first playable frame +0.2–0.5 s (`scripts/load-breakdown.mjs`).

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
- **Pebbles and stones on the sand** (`PEBBLES`, `pebbleField` in `src/ground-ink.js`; the print look, `uDots`, on
  rippled sand). The author's feedback (2026-10-06): the sand's spots read as spots, where in Moebius they are the
  shadows of pebbles and rocks seen from afar. The grains' dots and the coarse pen dots are gone from rippled sand
  in the print look; in their place, at most one pebble a cell at three scales (grit 0.32 m cells near, pebbles
  0.9 m in patches, stones 6 m that still read far off): a flattened disc whose side away from the light is inked
  and whose lit side keeps the sand's colour inside a fine rim (once its radius is 3-6 px), and the shadow it casts
  on the sand running away from the light (`uSunDir`), `cast` radii over the sun's tangent (0.6-3 radii: long
  dashes at dawn and dusk, stubs at noon), only where the sand is lit (a cast shadow from a building swallows it).
  Each pebble and its shadow fit inside its cell (one lookup a pixel). Under a 1 px radius it is drawn that wide
  and lighter (the ink it holds kept, `tests/ground-ink.test.js`); a few px a cell, its average tone. Seen from
  far, a field of them is a scatter of short dark dashes all pointing the same way. Motion check (Medium, the
  desert's spawn): drift 7.3 → 7.4, walking through the haze 38.1 → 34.8 flickering px per 10 000; Handheld
  cost +0.03 ms (noise).
  **A high sun lays more of them** (`PEBBLES.noon`, `pebbleNoon`; the author, 2026-10-07: "at noon the sand looks
  much emptier"). As the sun climbs the shadows shrink to stubs (0.6 radii), so from the sun's sine 0.78 to 0.88
  (the desert's 10 h to noon) up to 35 % more pebbles a cell, 10 % bigger, at all three scales (the far tone
  follows: it is computed from the same density and radii). Below that, mid-morning, the afternoon, dawn and dusk
  are drawn exactly as before (the same pixels at 7, 8, 9, 15 and 18 h). Measured on open sand, four headings
  (ink: px well darker than the 21 × 21 round them, per 10 000; cloud shadows and the wind's streaks off): noon
  near 30 → 46, looking down 23 → 35, about mid-morning's (8 h: 44, 34); 10 h 33 → 35. Motion check at 12.5 h
  (Medium, 1280 × 720, two runs each, the streaks and cloud shadows off): still 2.4 → 2.1, pan 31.7 → 31.8, drift
  6.7 → 6.9, haze 34.0 → 34.5 flickering px per 10 000 (noise). (Found on the way: a cloud's shadow over the spot
  made noon read a third emptier than it was; the measure turns cloud shadows off.)
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
  backpack's tank, the boxes' items, the gear and trinkets, the Hangar's machines,
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
- **The fluid sword's living blade** (`src/blade-shader.js`, v1.11; `makeMaterial({ fluid: 'blade' })` adds the
  `BLADE_FLUID` define on top of `FLUID` kind 6): injected the way the chimes' crystal is (`BLADE_VERT_PARS`,
  `BLADE_VERT` after the crystal's vertex code, `BLADE_FLUID_GLSL` in place of the old `bladeFluid`, `BLADE_DISCARD`
  with the other fluids' discards, `bladeLight(albedo, L, emit, n)` after the crystal's light, `BLADE_INK` at the end):
  currents, ripple lines, motes, a wobbling meniscus edge, the swing's bow and the ripple ring, a breathing glow that
  blooms after dark, soft ink with a pen share (outline only). Its uniforms (`uBlade`, `uBladeB`, `uBladeC`) are the
  sword's alone; the other fluids compile the plain currents. Details: `docs/systems/foes.md`, "Alive".
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
  Sharing cheap features again was tried in October 2026 and taken out: on the Xbox each feature made the first draw's
  second compile slower than the merged programs saved (docs/systems/performance.md "Fewer surface programs").
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

## Painted by night (`nightPaint`, October 2026)

`makeMaterial({ nightPaint: true })` compiles NIGHT_PAINT: the geometry carries `aNight` (vec4 per vertex: rgb its
colour by night, a how far it glows then); the fragment mixes its vertex colour toward the night colour and its glow
up by `uNight`, so one material is a painted billboard by day and a lit screen by night with nothing to switch. Used
by the Signal Market's signs (worlds.md "The Signal Market at night"). A material without it compiles as before.

## Moving parts on the GPU (`breathe`, v1.51)

`makeMaterial({ breathe: true })` compiles BREATHE (src/breathe-shader.js) for an instanced mesh whose geometry carries
`aBreathe` per instance (phase s, period s, stroke m, kind): kind 0 slides the instance out along its own +y and back
(`slideOut`: out, held, back, rested), 1 turns it about its own y (a gear; the period's sign its way round), 2 is a puff
that swells, travels along +y and thins away (`puffAt`). All of them read one uniform object, `BREATHE_CLOCK` (the
clock, the distance past which an instance holds still, the clock it holds at, the gears' own clock), so moving every
one costs four numbers a frame. The depth pass draws the rest pose, so these meshes cast no shadow. Used by the Buried
Machine's vents, great pistons and gear door (worlds.md "The Buried Machine breathes").

## Dune glass (`duneGlass`, `dunePool`, October 2026)

The Glass Dunes' glass (`src/dune-glass-shader.js`, compiled into the G-buffer surface shader for a material
made with `duneGlass`, the DUNE_GLASS define) and the sand that takes its light (`dunePool`, DUNE_POOL). A
print, not refraction: like the rest it writes a flat albedo, a light term and a glow for post.js. Both read
one vertex attribute, `aGlass` (vec4), written by the kit (`src/levels/glass-dunes-kit.js`):

- **The glass** (`glassRidge`: x the silhouettes' signed distance in m, y how thin the glass is, z the lobe,
  w the height up the ridge; 2 marks a passage's vault). The **silhouettes** held inside (giants, heads,
  trees: unions of ellipses, `silhouetteDistance`) are cut at the distance's zero over a pixel: one flat dark
  shape with a hard, slightly wavering edge whatever the mesh's spacing (they were soft vertex-colour
  smudges). The **light through**: thin glass (the foot, the ridge's sinking ends, a wave's lip, the crest,
  the low flows) and grazing edges (1 − |n·v|, a lobe turning from the eye) let the sun through, more as you
  look toward it and more in shade, printed as two flat bands, a mint glow and a lime core, lifted out of the
  shade (never hatched) and glowing a little; at night a faint mint band at the thinnest parts. The **deep
  shade**: a face turned well from the sun or a lobe's crease prints a step darker (the billows, plate 2);
  a pale streak runs up each lobe's belly.
- **The sand** (`glassPools`: x how near a wall's foot, 0..1, within 10 m plus 0.35 × the wall's height; yz
  the way to it, in the world's frame, so a turned References view passes its turn): the light come
  through the glass pools beyond it, on the side away from the sun (the glass between the point and the
  sun), a low sun's further; two bands, mint then lime, the lime lifted out of the wall's shadow; a faint
  mint all round a foot. A grid of 16 m cells holds the feet near it, so the load stays a few ms.
- **Meshes**: the room kit's merge keeps only position, normal and colour, so the ridges are merged by the
  kit's own `glassBatch` into meshes of their own (per material, solid, shadow; indexed ridges apart from
  non-indexed vaults). A geometry without the attribute reads `GLASS_DEFAULT` (no silhouette, thick).
- **Cost**: a handful of ALU and one `fwidth` per band a pixel, no texture, no pass. Handheld preset at
  render scale 0.75 (worlds.md "The Glass Dunes"): within a few hundredths of a ms of before.
- The world's own colours went with it: the glass prints its shade less flat than the sand (`shadeFlat`
  0.45, its mint foot and teal top kept in shade), the world keeps none of the print's warm grey in shade
  (`uShadeKeep` 0: teal lifted toward a warm light turned grey), and its dusk shadow is an emerald.

## The surface census (issue #690, `scripts/surface-census/`)

What is still flat, measured: `node scripts/surface-census/census.mjs <out-dir> [--worlds incal,home] [--shots 4]`
(`PORT`, `CDP`: the dev server's and Chrome's ports; muted headless Chrome, `?batch=0`). Every visible mesh in the
surface shader, grouped by material and classed by its options and compiled defines (`lib.mjs classify`: treated, skin,
skin-bare, grid, bands, plain, pending; a new `S_*` pattern goes in `TREATMENTS`), weighted by world area and by the
walk: `walk.mjs` lays each world's critical path (the level design audit's) and its places in node, and the page
(`page.js`) casts a ray down and a fan from the eye at each point. It writes `report.json`, `report.md` (the tables)
and a contact sheet per world (the view, and the same with each material in magenta). Reports:
`docs/audits/surfaces-v2.30.md`. `tests/surface-census.test.js` checks the classes.
