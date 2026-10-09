# Rendering: the passes, the print look, light and shadow

The frame (shadow maps, G-buffer, ink post pass), the Moebius print look, the beauty pass, time of day, shadow casters.

## How the look is built

Three passes per frame (`src/main.js`):

1. **Shadow maps.** There are two orthographic cascades that follow the
   player and snap to texels, so shadows don't shimmer:
   - a sharp 4096² map covering ±220 m;
   - a 2048² map covering ±1150 m, so mesas shadow distant dunes. It
     refreshes every third frame.

   The comparison is done by hand in `materials.js`, and the two maps blend
   at their borders.
2. **G-buffer (MRT).** Every object uses one surface shader
   (`src/materials.js`). It does no stylisation. It only writes:
   - `RT0.rgb` = flat albedo. This is a plain colour, procedural sand
     patches with rock on slopes, or horizontal **strata bands** for mesas.
   - `RT0.a` = light term: half-lambert × cast shadow. Cast shadows are
     clamped just below the toon threshold, so the post pass can tell
     "in shadow" apart from "facing away".
   - `RT1` = world normal + linear view depth (0 means sky).
   - `RT2` = hatch strokes (single and cross), drawn on the surface itself.
     The strokes come from a triplanar projection of the object-space
     position, scaled by the object's scale. That way they stay attached to
     objects as the camera, or the object, moves.
   - Stroke spacing is measured from screen-space derivatives and snapped to
     powers of two. Each coarser level keeps every other line of the finer
     one, so when you walk away, lines fade out instead of sliding across
     the surface.
   - Faceted rocks get their normals from `dFdx/dFdy`, so they need no
     special geometry.
   - Each stroke is an isoline of a single stroke coordinate:
     - terrain uses a top-down projection, continuous across dune crests;
     - smooth objects blend the three triplanar projections at the
       coordinate level, so the stroke angle turns gradually instead of two
       patterns overlapping;
     - faceted objects use one projection per facet.
   - The same surface frame drives the **stipple** mode (Sable's
     "occasional dotting"): jittered dots whose size and count grow with
     darkness.
   - Architecture can draw object-space **grid lines** (Sable's "gridded
     lines").
   - The terrain gets **Sable-style sand blobs**: small irregular spots at
     three scales that give a sense of scale. They stay below the
     colour-edge threshold so they don't get outlined, and fade out before
     they shimmer.
3. **Moebius composite** (`src/post.js`). All the style lives in one
   full-screen shader:
   - **Ink lines** come from four signals:
     - depth discontinuities, using the Laplacian of *1/z*, which is
       exactly 0 on any plane, so there are no false lines on ground at
       grazing angles;
     - normal creases;
     - albedo boundaries, which outline strata and sand patches the way an
       inker outlines flat colour areas;
     - cast-shadow boundaries.
   - **Line style.** Lines get thinner with distance. The sample positions
     are offset by a noise field for a hand-inked wobble. "Line boil"
     re-rolls that noise at 8 fps.
   - **Two-tone cel shading.** Lit areas show the pure albedo. Shadowed
     areas show albedo × a lavender shadow tint, a very Moebius choice;
     each surface lifts and warms it its own way (a half-tone on forms
     turned from the sun, the bounce under overhangs: "Shade and hatching
     by surface").
   - **Hatching** takes the surface-anchored strokes from `RT2`: pen strokes
     in the shade, and cross-hatching in the darkest areas. Hatching fades
     out with distance. The panel's "hatch anchoring" option switches back
     to the older screen-space strokes for comparison.
   - **Atmospheric perspective.** Fog blends towards the sky horizon colour,
     and lines and hatching fade with it, so distant mesas become pale flat
     silhouettes.
   - **Procedural sky** with a gradient, an inked sun disc with a halo ring,
     and flat inked clouds with hatched undersides.
   - **Nothing fixed to the screen**: no paper grain or vignette; the lines' wobble is on the view's
     direction ("Nothing fixed to the screen" below).

## The developer panel

The panel on the right exposes every shader parameter. It also has style
presets (Moebius / Sable / Animated ink) and debug views of each G-buffer channel.

## Time of day

The `Time of day` folder drives sun and moon positions plus a palette
(sky, fog, light tint, shadow tint) keyed through dawn, day, dusk and night
(`src/timeofday.js`). At night the moon becomes the shadow-casting light,
as in Sable, and stars appear. The sun and moon are drawn separately. Around
the moment the light switches from one to the other, the shadow tone
converges to the light tone, so shadows fade out and back in instead of
jumping. "Hours / minute" runs the cycle. Character
poses update at 12 fps ("stop-motion anim") while movement stays smooth.

## The print look (default preset "Moebius print")

Modelled on a classic Moebius desert plate:
- a flat cerulean sky printed with fine dots, and a bank of inked cream
  cumulus sitting on the horizon;
- pen-dotted sand with pebbles, ochre scrub bushes, and blue-grey hatched
  shadows;
- fine, broken ink lines, solid ink in the deepest crevices, and fold lines drawn down the cape;
- the wide-brimmed pointed hat;
- a saucer tower and a pale spired city on the horizon;
- an open plain around the desert start, with landmarks set back from it;
- stroke-textured scrub;
- a heavy-wool cape that falls in long vertical folds and barely moves in
  the wind; only your own motion swings it;
- a print palette for every world: a flat sky over a pale horizon, with
  blue-grey shadows.
- **Sky dots** are placed on the sky dome (azimuth and elevation, with a
  projected cap overhead) and sized through the mapping's screen Jacobian,
  so they stay put and round as the camera turns.

## Drawn textures, lines and depth

- **Drawn patterns** (`pattern` option in `makeMaterial`), all in surface
  coordinates so they stick to the object, and faded out where they'd shimmer:
  - `facade`: windows per storey, some with arched tops, with frames, sills,
    painted shutters, dark glass and a cornice line. Used on the city houses.
  - `tiles`: rows of roof tiles with staggered joints. Used on the terracotta roofs.
  - `leaves`: little scalloped leaf arcs. Used on the trees.
  - `cracks`: a broken Voronoi crack network. Used on the boulders.
- **City silhouettes:** arched doors, iron-railed balconies and chimneys on
  the houses, plus umbrella pines among the cypresses and olives.
- **Line quality:**
  - Interior lines break into short strokes. The gaps are anchored in the
    world, so they don't crawl.
  - The player gets a heavier outline so the figure reads against the page.
- **Aerial perspective:** mid-distance layers lose saturation and drift
  towards the sky colour before the fog takes them.
- **Detail by distance:** hatching and sand dots are finer close to the
  camera and coarser far away.
- **The rider's robe:** a short, front-open skirt of heavy cloth hangs from
  the waist under the cape. It's a second cloth simulation, kicked by the
  leg capsules.

## Beauty pass

Each of these can be toggled or tuned in the panel's **Beauty** folder.
- **Line weight like an inker:**
  - silhouettes are drawn about 1.6× heavier, while creases and colour
    boundaries are lighter;
  - a "pen pressure" noise swells and thins each line along its length.
- **Supersampled antialiasing:**
  - the whole pipeline can render at 1.5× or 2×; the final colour passes
    through FXAA and is scaled to the display;
  - stroke sizes follow, so the lines just get cleaner;
  - the default is 1× on Retina screens, which are already dense.
- **Hatching that follows form:** on slopes the strokes become height
  contours, and on smooth objects the cross-hatch wraps round them as rings.
- **Crease shading:**
  - small screen-space ambient occlusion from the depth and normal buffers;
  - it darkens building bases, crevices and canopy undersides, and adds ink
    accents where geometry closes in.
- **Skies:**
  - posterised gradient bands and sun rays at low sun;
  - per-level planets: toon-lit, cratered, hatched on the night side, with
    optional rings;
  - per-level colour scripts (`sky.script`): day, dusk and night palettes.
- **Layered haze:** distant terrain flattens into a few flat tones, like a
  printed background.
- **Shadows:** a third, very fine cascade (±12 m) around the player keeps the
  character's shadow crisp; it no longer crawls across coarse texels.
- **Local lights:** up to 8 glowing things near the player (crystals, eggs,
  portals, orbs, the jetpack flame) pool light on nearby surfaces, even in
  shadow.
- **Life** (`src/life.js`):
  - bird flocks with flapping wings;
  - drifting motes (dust, pollen, ash, blinking fireflies), drawn as
    depth-tested sprites so they don't turn into ink specks;
  - waving cloth banners;
  - mist rising off the water at the City-Shaft's bottom;
  - swaying flowers in Viridel;
  - footprints in sand.
- **The character:** a real human body (Quaternius' Universal Base
  Characters, CC0) dressed as the Vael rider: tunic, trousers, belt and
  boots, coloured by body region in a skinned version of the inked material.
  The red hood and a cloth cape go on top.
  - **Reshaped at load** (`reshape()` in `src/humanoid.js`) from the stock
    superhero into a gaunt Moebius figure:
    - every vertex is pulled toward the bones it's skinned to, weighted so
      the joints stay smooth;
    - the shoulders come in by moving the arm bones, then the mesh is
      re-bound;
    - the face gets narrower and longer, with a straighter nose, hollow
      cheeks and a firmer chin, and the brows are thinned.
  - **Face ink:** the shader draws fine lines in rest-pose face coordinates:
    the upper lids, light marks under the eyes, nose-to-mouth folds,
    cheekbones and the mouth.
  - **Motion:** mocap from Quaternius' Universal Animation Library (CC0).
    - Idle, walk, jog, sprint and jump clips play on a hidden copy of the
      library skeleton and are retargeted by limb direction onto our rig.
    - Locomotion blends by speed on one shared gait phase, with playback rate
      set from each clip's measured stride, so the feet don't skate.
    - Climbing, riding, gliding and jetpack keep their authored poses.
  - **The human skeleton** is aimed bone by bone along the rig every frame,
    keeping each bone's rest twist. The same body drives the NPCs, in male
    and female versions with varied skin tones.
  - **The cloak is real cloth** (`src/cape.js`): Verlet particles pinned at
    the collar.
    - Structural, shear and bend constraints keep its shape.
    - It feels gravity along the local "up" and drag from the air and wind,
      and it collides with the body and legs.
  - **Toggle:** "mocap animation" in the Time of day folder switches back to
    the procedural gait for comparison.
  - **Foot planting:** when the ball of a foot comes down in the clip, it is
    locked to the real ground where it lands and held there (no slip, no
    sinking).
    - A two-bone IK on the human legs reaches it, keeping the clip's heel
      roll, and the pelvis drops when needed.
    - Swinging feet follow the terrain, and footprints go where the foot
      landed.
    - Planted soles are tilted onto the local ground slope, and footprints
      lie along it.
  - **Climbing:** hands and feet are IK'd onto ray-cast holds on the actual
    wall, in a hand-over-hand cycle.
    - At a ledge, or where the wall leans back into a slope, an animated
      mantle hauls you over onto the top.
  - **Climbing:** keyframed hand-over-hand reaches with opposite high steps,
    plus a landing clip after real falls.
- **Villagers:** each one draws a hood, a wide hat, a head-wrap or bare hair
  (with a top-knot or ponytail), a cape length from none to floor, and
  tunic and trouser colours.
- **Hero landmarks:**
  - the desert: a colossal half-buried masked head;
  - Vael: a fallen stone colossus and a giant hand rising from the plain;
  - the city-shaft: the Lodestar and its dark twin above the palace;
  - the Hangar: a cathedral of turning gears and pistons;
  - Viridel: Odile and Talo's crashed ship;
  - Lorn: the Great Crystal and its stone ring.
- **Softer forms:** towers and trunks get organic bulges and pinches
  (`soften()` in `src/world.js`).
- **Photo mode** (**P**):
  - WASD with Q/E flies a free camera; the mouse looks around, Shift goes
    faster;
  - H toggles the panel, and Enter saves a PNG.

## Who casts a shadow, paint that sticks, sharp portraits
- **Casters** (`shadows.js`, main.js `renderFrame`): there are no `castShadow` flags; the shadow
  passes draw every visible mesh in one depth material, minus a level's `noShadow` list, people's
  tiny parts, self-lit things (`selfLitSkips`: glow ≥ 0.8, flames, lamps, glowing inscriptions; a
  glowing solid opts in with `userData.castShadow = true`, as Perdide's great crystal does, and any
  mesh opts out with `false`) and, in the far pass only, small props (`farPassSkips`). An audit of
  every world found the rest casting already; the gap was that last rule: it left out *every* tile
  of instanced props, so boulders up to 9 m across, the Spheres' globes and the like cast nothing
  past the near map (220 m, 160 on Handheld) while the buildings beside them did. Now a tile is left
  out only if all it holds is under two far texels (2.2 m) across (`largestInstance`, kept per tile).
  Cost, far pass (refreshed every 3rd frame, every 4th on Handheld), same page A/B, M4 Pro: desert
  +36–57 draws and +6–18 k triangles on High (+21–27 / +3–11 k Handheld), GPU time within the noise
  (0.35–0.43 ms either way); the Spheres +38–45 draws, +0.2 M triangles, +0.07 ms on High
  (Handheld +13–17 draws, +0.08–0.13 M, +0.03–0.27 ms); Arzach +8–10 draws, no change in time.
- **Fluid splats are decals on the drawn surface** (`splat-decal.js`, fluid-tool.js `Splats`): the
  glob still stops on the collision, but the splat is cut from the triangles drawn there: the
  scene's static meshes round the hit (`DrawnSurfaces`: not skinned, plants, water, lights or
  anything that has moved since it was found; hidden collision stand-ins left out, so a dome's or a
  trunk's coarser collider doesn't swallow it) and the terrain's own grid triangles
  (`heightfieldTriangles`); the collision BVH only where nothing is drawn. Each triangle is clipped
  to the splat's box (Sutherland-Hodgman, like three's DecalGeometry), cast halfway between the
  surface's normal and back along the shot (a step's riser facing you takes paint as well as its
  tread). A one-sided face turned away (a thin wall's far side) is left out by its winding;
  double-sided ones are tested for what hides them, piece by piece. Each corner keeps its spot in
  the splat's plane at its true distance from the hit, so the blob keeps its size over folds and
  curves instead of stretching to the box. The shape (blob, inner tone, drops) is drawn in the
  shader (`splatMaterial`: two patches of the surface shader, checked by the tests), grown and
  shrunk by age, so the geometry is built once a shot (0.5–2 ms here); every splat shares one
  mesh, rewritten only when one comes or goes. The faces lie exactly on the surface: polygon offset,
  not a lift, keeps them in front.
- **The conversation portrait** (main.js `captureView` with `css`, `story/portrait-bg.js`): it was the
  frame's middle shrunk in one step to 160 px and saved as a JPEG, so lines a pixel or two wide broke
  into jagged dots. Now it is drawn as if the frame were the circle's size (`portraitPixelRatio`: the
  ink, hatching and grain in its pixels, at half the world's ink weight), at full resolution, shrunk
  by halves (each a 2 × 2 average) to the circle's pixels on this screen (`portraitSize`), and kept
  as a PNG.

## The G-buffer's layout

Three half-float RGBA targets (`createGBuffer`, `src/pipeline.js`), written by the surface shader
(`src/materials.js`) and a few others (footprints and the jump shadow multiply into it; the ship's
approach, flames). A half float keeps 11 significant bits: 1/1024 of a value's power of two, so
1/64 between 16 and 32, 1/32 between 32 and 64. Flags and steps are packed as whole numbers over a
fraction in 0..1, and each reader takes them off (`floor`, `mod`) before using the fraction.

| Channel | Holds | Packed over it | Max |
|---|---|---|---|
| RT0.rgb | albedo | (none) | 1 |
| RT0.a | the light term L (half-lambert × cast shadow, 0..1) | + 2 × line step (LINE: weight step + 4 × tint step, 0..15); a white line (`lineWhite`): −(1 + all that) | −33 … 32 |
| RT1.xyz | world normal | its length: the water's mark (`WATER_MARK`: 1.012 + 0.05 × sparkle) | 1.07 |
| RT1.w | linear view depth (m; 0 = the sky) | (none) | 5000 |
| RT2.r | hatch strokes (0..1) | + 2 × hue step (SHADE: 0 the world's, 1 … 9 a hue, 10 … 15 a flat print) | < 32 |
| RT2.g | cross-hatch strokes (0..1) | + 2 × lift step (SHADE: 0 … 15) | < 32 |
| RT2.b | drawn detail (0..2: over 1 a face's pen line) | + 4 × spot step (SPOT: 0 the world's, 1 … 3) + 16 weathered | < 32 |
| RT2.a | glow (0..1; over 0.62 a light) | + 2 hero + 4 figure + 8 soft ink (grass, makers' box) + 16 face + 32 banked sand | < 64 |

- **Readers of the light term** decode it (`lightOf` in post.js; the water's sparkle in water.js):
  post.js's centre tap and its four shadow-edge taps, and the line owner's tap (1b). The other
  readers (the glow buffer, footprints) only read RT0.rgb or RT2.
- **A material with no line step** (every material by default, every other shader) writes the
  light term as before, at full precision; a stepped one keeps L to 1/64 at worst (the toon
  threshold's ±0.01 smoothstep is one step: the same hard edge). The jump shadow multiplies RT0.a by
  0 (shade): under it a material's line step is the world's.
- **Room left** for a flag or two (RT0.a's sign bit is taken: the white line, below):
  RT2.b's +32 (the detail at 1/32), RT2.a's +64 (the glow at 1/16: only for materials whose glow is
  0 or 1). A new flag belongs to whichever
  channel's readers can afford the precision; tests/ink-pass.test.js and tests/shade.test.js check
  the round trips through a half float.

## Lines by material (post.js 1b; `LINE` in materials.js)

The sheets draw soft things (clouds, reeds, foliage, glass, painted signs) in thin, lighter lines in
a dark shade of their own colour, and solid things in black; ours used one ink for everything, so
soft shapes read as hard.

- **A material's line**: `makeMaterial({ line, lineTint })`: `line` the weight (1 the world's ink,
  0.7, 0.45, 0.25 a hairline: `LINE.weights`), `lineTint` 0..1 (the ink → a dark shade of its own
  colour, in four steps). Glass defaults to 0.45 / 0.7, the `leaves` pattern to 0.7 / 0.67.
  Packed over the light term (RT0.a, above).
- **Whose line it is**: a depth edge's line straddles both surfaces. The signed Laplacian of 1/z
  that already finds it (`inkLines`, its `near.z`) is over 0 on the far side (the sky round a cloud,
  the wall behind a reed): there the line belongs to the nearest surface in the kernel (`near.xy`),
  elsewhere to the pixel's own. One tap of RT0 at the owner, only on inked pixels.
- **What a step does**: the weight is the line's opacity (`LINE.alpha`) and how much of it is drawn
  past its owner's edge (`LINE.far`: from 0.45 down, a line stays on its owner's side, half as wide).
  The tint mixes the ink toward the owner's albedo × the world's shadow tint × 0.62 (a cloud's line
  is its shade's blue-grey, a reed's a dark violet, a leaf's a dark green). Creases, colour edges and
  shadow edges inside the material take it too; the traveller and grass keep theirs.
- **Set on**: the clouds of Vael II, of the title screen and of the views (Vael II's, the Buried
  Machine's, the Spheres'), 0.45 / 1; Lorn II's reeds (the world's and the views'), 0.45 / 1, and the
  views' crystals; the Spheres' canopies, 0.7 / 0.67, and every `leaves` foliage by default; the
  Signal Market's billboard faces (the world's and the views'), 0.7 / 0.67; glass by default. (In the world the
  billboards' painted colours share one material by vertex colour, `signPaint`: a material per colour and part
  had cost about 130 more draw calls a frame; the dark rings and lit strips keep the walls' materials.)
- **White lines** (`makeMaterial({ lineWhite })`, the shade: src/shade.js): RT0.a stored as −(1 + L + 2 × step),
  read back by its sign and |a| − 1 (`lightOf`, the line block, the water's sparkle; `packLight` / `unpackLight`
  the JS twins). The owner's line is drawn in `INK_WHITE`, the paper's white, at its own weight: a negative of the
  ink, white round a black shape in any light. tests/shade-flame.test.js checks the round trip and the readers.
- **Debug**: `params.debug` 11: red where the pixel owns its line, green the owner's step, blue the ink.
- **Cost** (M4 Pro, ANGLE Metal, 1280 × 720 High, the composite pass alone by timer query, the build
  before and after in two pages of one browser, 16 interleaved pairs of 24 frames; the machine
  shared with other agents): view 52 3.80 / 3.82 ms. A branch only on inked pixels, one tap; no new
  GLSL features (WebView 109).

## Haze by depth and height (post.js 4b; `HAZE`)

The sheets separate near, middle and far by stepped pale bands of a warm or cool haze (Lorn II's mist
between trunks, the desert's far dunes, the Market's far towers), and the City-Shaft and the woods fade
with depth down or into them. Our fog was one exponential tint by distance (`uHaze` only gave it the
desert's colour).

- **Layers by distance** (`uHazeLayers`: first distance, each layer's distance over the last's, each
  layer's veil, how many; `uHazeTone`: their colour, and how much of it over the far haze's): past
  the first distance every layer k times farther veils a little more, `1 − (1 − a)^layers`, flat
  inside a layer with a soft ramp (`HAZE.edge`, a fifth of a layer) before each step. Things at
  different depths (trunks, towers, ridges) fall into separate pale planes; open ground shows soft
  bands that move with you, never a hard edge (no shimmer). Applied before the far fog, thinner at
  night; the ink lines take `HAZE.lineFade` of it (at the pixel's depth; on the sky, at the line's surface).
- **Fog by height** (`uHeightFog`: the height it thickens under, its scale height, density there, its
  most; `uHeightFogTone`): a density growing exponentially below a height, integrated along each ray
  (closed form: no loop), so a view down a shaft fades into it while a view across or up stays clear;
  over the far fog, the lines veiled too.
- **Set** (looks, so the views carry them): Lorn II `DEEP_WOOD_HAZE` (layers from 25 m × 1.7, a cool
  violet-blue, a low mist under 1.5 m) and its views; the desert `DUNE_HAZE` (from 250 m × 1.9, the far
  haze's warm colour; all 27 desert views' `DUNES`, from 120 m); the Signal Market `MARKET_HAZE` (from 90 m × 1.8,
  pale warm) and its views; Vael II `SKY_STONES_HAZE` (light, from 200 m) and its views; the City-Shaft
  `SHAFT_FOG` (thickening under the pit's middle, 0 m, scale 120 m, pale blue) and the shaft views'
  `SHAFT_VIEW_FOG` (under −40 m). Every preset lists them off (`hazeOff`).
- **Cost**: a log2 and a pow (the layers), three exps (the fog by height) once a pixel, compiled in only
  where a look sets them (`INK_LAYERS`, `INK_HFOG`: "Cost of the ink pass's three" below).
- **Shimmer**: none. The layers are a function of each pixel's distance from the eye with a soft ramp (`HAZE.edge`),
  so a band's edge slides smoothly over open ground as you walk and never flickers; the fog by height is smooth in
  distance. By distance, not the view depth (as the far fog too): by depth a band's edge was a plane facing the
  camera, which swept across the ground as the view turned ("Stable in motion").
- `tests/ink-pass.test.js`: the JS twins (`hazeLayers`, `heightFog`): stepped, monotonic, continuous,
  thicker looking down; every preset says them; the worlds and views set theirs.

## Cast shadows by world (post.js 2; `CAST`, `uCast`)

The sheets often leave a cast shadow out on open ground (Vael II's plain, Lorn II's paths and water) while
keeping the shade of every form; the desert's IMG_3774 inks them as near-black masses instead (the spot
tier's `uSpot.w`, "Spot blacks" in references.md). This is the other half of that knob.

- **Which shade is cast**: the G-buffer has no shadow flag, but it doesn't need one. A point facing the sun
  (n·l over `CAST.facing`, 0.02 → 0.08: Lorn II's 9° sun still counts) yet below the toon threshold is in a
  cast shadow (or a cloud's); form shade faces away and is never touched. The jump shadow writes a light
  term of 0 and is kept (`CAST.light`: a shadow's light term is at least 0.38).
- **How much**: `uCast` = [on open ground (n.y over `CAST.ground`, 0.55 → 0.8), everywhere else], 0 kept …
  1 dropped. The shadow's colour goes that far toward the lit one (`lit = max(lit, castLift)`), its hatch
  strokes fade with it, and so does its shadow-edge line (the edge's lit side too: by `castPot`, which
  doesn't need the pixel to be shaded). People, faces and the traveller keep theirs.
- **Set**: every preset says `[0, 0]` (`hazeOff`). Vael II `SKY_STONES_CAST` [0.7, 0] and its views
  `VAEL2_LOOK` [0.85, 0]; Lorn II `DEEP_WOOD_CAST` [0.6, 0.2] and its views `LORN_LOOK` [0.85, 0.2]; the
  Garden of Spheres `SPHERES_LOOK` [0.4, 0] (its views inherit it). Checked and left alone: the desert (its
  sheets' cast shadows are pale tan in IMG_3772–3773 as ours are, near-black in IMG_3774: `uSpot.w`), the
  City-Shaft (its blocks cast none already), the Buried Machine (dark masses, the spot tier), the Signal
  Market (its street keeps the towers' shadows).
- **Debug**: `params.debug` 12: red where a cast shadow would be lifted, green where one is.
- **Cost**: a dot and three smoothsteps per pixel, compiled in only where a look sets it (`INK_CAST`); no taps.
- `tests/ink-pass.test.js`: the JS twin (`castLift`): lifted on the ground and on walls by their amounts,
  the low sun counted, form shade, the terminator, the lit side and the jump shadow kept; the presets keep
  them; Vael II and Lorn II and their views lift them.

## Ink shadows (post.js 3d; `uInkShadow`, `inkMass`)

The other end of `uCast`. IMG_3774 prints the shadow of a dish or a cliff *on the sand* as one near-black
mass with a hard edge, while the domes it falls on keep their blue shade. `uInkShadow` = [on open ground,
everywhere else] (0 off … 1) lays one flat mass of the world's darkest tone (`uSpotTone`, the spot blacks')
over a cast shadow, over its hatching, its drawn detail and its crease shading; its strokes go with it.

- **Which shade**: the same test as the lift (facing the sun yet shaded, `CAST`), the same split by surface;
  never a person, a face, the traveller, grass, a light, or a material that says `spot: 0` (clouds, glass).
  Its edge is the shade's own antialiased edge (`1 - lit`), so the mass stops where the shade does.
- **Set**: only IMG_3774's seven views (`INK_SHADOWS` in reference-desert.js: [0.85, 0.3]; the spot tier's
  `uSpot.w` there is 0 now, the mass does it whole). Every preset says [0, 0] (`hazeOff`); the desert itself
  keeps its pale tan cast shadows (IMG_3772–3773).
- **Compiled in only where it is set** (`INK_SHADOW`, `inkFeatures`): a world that inks nothing compiles the
  shader it did before. Checked by screenshots, before (main) against after: Vael II, the Garden, the Market,
  the Buried Machine and the desert's other views are identical bar moving people and motes.
- **Debug**: `params.debug` 12 draws the inked share in blue (red could lift, green lifted).
- **Cost** (M4 Pro, headless Chrome, Handheld at 1280 × 720 scale 0.75, view 22, the two builds timed in
  turns, 10 pairs): main 28.5 → 28.0 ms, in-page off/on +0.4 ms; within the noise of a loaded machine.
- `tests/ink-pass.test.js`: the JS twin (`inkMass`), the shader's order and the define, the seven views.

**Flat shadows, and a material's own.** The City-Shaft's world now prints its shade flat in the shaft's blue
as its sheets do (`uShadowFlat` 0.8, as `SHAFT_LOOK` already did): a pink wall's turned side goes blue. Its
cypresses and olives say their own print (`shadeFlat: 0`) and keep their green; people (figures and the
traveller) never take the world's print, only a material's own, so a coat in shade is a darker coat, not grey.

## Facets edge-on to the sun (materials.js `FACET_EDGE`)

A flat-shaded (`flat: true`) wall lying in line with the sun has n·l ≈ 0, a light term on the toon
threshold, and the last bits of its derivative normal (and the shadow map's grazing taps) broke it into a
field of fine lit specks (the Signal Market's view 155, a brown wall full of white specks: half its pixels
50 % lit). A facet within `FACET_EDGE` (0.03) of edge-on now goes to shade, whole; smooth surfaces keep
their terminator's antialiasing. The drawn detail (pen marks, seams) is inked a little darker in shade
(0.6 → 0.86 of the ink), so it reads on flat-printed and deep shade as on the lit side.

## Smooth cast-shadow edges (materials.js `sampleShadow`, `SHADOW_CUT`; shadows.js `tentTaps`)

The author's feedback (2026-10-06): the darkened shadows looked blocky and seemed to shift as the camera
moved. Measured first (a probe that runs the shadow passes from one camera or traveller position and draws
the view from another, fixed one; and the motion check): moving or turning **only the camera** changes no
shadow map at all (the cascades follow the traveller, snapped to texels; the caster culling drops nothing
the camera sees). What was wrong was the edge itself:

- **Texel steps.** Each lookup was a box of bilinear comparison taps (3 × 3 at one-texel spacing, or 2 × 2
  at half a texel on Handheld). That lit fraction has a kink at every texel border, and the toon threshold
  turns it into a hard edge, so the texel grid (11 cm in the near map, 16 cm on Handheld: a dozen to twenty
  pixels close up) was drawn into every cast shadow's outline as steps, then inked by the shadow-edge line.
  Now the taps carry the weights of a tent that slides with the point inside its texel (Castaño's filter,
  The Witness): 5 × 5 texels in the same 9 taps, 3 × 3 in the same 4 on Handheld. The lit fraction changes
  continuously and evenly across texel borders, and the edge is a smooth curve. Where a texel is under the
  pixel the taps spread about the point on the map's own grid (`spread`), so a cascade moved by whole texels
  still reads exactly the same (a grid scaled with `spread` did not: the stationary shadows changed as you
  walked).
- **Shadows eaten by the filter.** A cast shadow shades as `mix(min(lambert, 0.38), lambert, sh)` and the
  toon threshold is 0.5, so a sunny face cut the filtered `sh` at 0.24: a shadow shrank by most of the
  filter's width (thin petals and ribs vanished, small shadows went blobby) and grew on a face turned half
  away. `getShadow` now steepens `sh` about its half (`SHADOW_CUT` = 3, clamped), so the cut lands within
  0.4–0.56 of the filter whatever the facing: shadows keep their true size, and the wider tent costs no shape.
- **The darkening's hard step.** The spot tier's cast-shadow darkening (`uSpot.w`, the desert's and the
  Buried Machine's deep shadows) switched on at `lit < 0.5`, an unfiltered step inside the shade's
  antialiased edge: a staircase on the darkened shadows that crawled with every camera move. It now runs
  over the edge band (`lit < 0.99`) weighted by `1 - lit`.

What still changes with the traveller (not the camera): shadow edges move by about a pixel as the near map's
window steps along (sub-texel rasterisation), and on High the fine map's ±12 m edge hands over to the near one.

**Cost**: the same taps as before plus a few multiply-adds per lookup. Desert, `scripts/bench/passes.mjs`
whole frame (synced), before → after, two runs each: Retina High (1728 × 1117 at scale 2) spawn 10.0/11.6 →
10.0/10.6 ms, dunes 11.8/12.0 → 11.9/12.2 ms; Handheld (1280 × 720 at 0.75) spawn 2.61/2.60 → 2.58/2.56 ms,
dunes 1.27/1.25 → 1.34/1.27 ms: within the noise. `tests/shadow-edges.test.js`: the tent's weights, the
lit fraction continuous and monotone across texel borders, the same for a window moved by whole texels (any
spread), the cut near the half for every facing, and the spot tier's weighting.

## Shadows close up, on climbers and after a quick turn (October 2026)

The author's report: weird shadows on the people in conversations, round the traveller climbing, and many as
the camera pans in the City-Shaft. Reproduced in headless Chrome (an A/B of the commit before and this one,
the same placed views; the light term, `params.debug` 5, and the spot masks, 10, beside each). Three causes:

- **Lit blotches on a person in the shade** (materials.js, `TERMINATOR_REACH`). The terminator fade ("Stable
  in motion": a big curved surface's own shadow map let go within n·l 0 … `TERMINATOR` of edge-on, where its
  grazing taps cut teeth) let go of the map *whole*, so every fold of a coat, a neck or a cheek near edge-on
  dropped the shadow of a building too. Seen close (the conversation camera is about 1 m from a face, where
  the whole body counts as a big form), a person standing in the shade was covered in lit blotches. Near the
  terminator the map is now asked again with its depth bias `TERMINATOR_REACH` (12) times as deep: past the
  form's own body (0.5 m in the fine map, 3 m in the near one), never past a wall or a tower standing well
  toward the sun. One more lookup, for those pixels only. The Buried Machine's slow orbit (the teeth's test)
  is unchanged: flicker 7.4–8.3 before and after, run to run.
- **A dark ragged halo round the climber** (post.js `notPerson`). The spot blacks' enclosure and the crease
  shading are screen-space: a person in front of a wall or the ground counted as the wall's pocket, so the
  climber's wall got a near-black, spiky mass round his outline, and people walking in the shade dragged
  blobs round their feet that slid as the view turned. A tap that lands on a person (gHatch.a's hero or figure
  flag) now closes nothing in; the flags are read only for a tap that would count, as the grass's were.
- **A pale ghost of a person in the dark masses** (post.js `enclosure`, `creaseAO`, `occlusionShare`; playtest
  2026-10-08: "Marrow casts a white shadow towards the ship", "the character casts a white shadow on the
  stairs to the big tree, shadows move with the camera"). The fix above made a person's tap count as *open*:
  where a person stood in front of a spot-black mass (the hull beside Marrow, the stair risers behind the
  traveller) the share fell and the mass got a pale hole in the person's shape, once per tap offset, sliding
  with the view (debug 9 shows the copies). A tap on a person now looks past them, twice as far along its
  direction, and if that lands on a person too it is left out of the share altogether (the share is of the
  taps that saw what stands behind; none left: open). Crease shading leaves person taps out the same way,
  reading the flags for a tap that would close something in or that stands nearer than the point (a person
  hiding what is behind them is nearer), so most taps still skip the read. The Unity port's Composite.shader
  had no person test; it takes the same rule. The shadow maps were checked and are not involved (they follow
  the player, snapped to texels). What remained (blocks on stepped geometry that moved with the camera) is the next section.
- **Shadows popping in after a turn** (shadows.js `VIEW_SLACK`, `viewOf`, `viewLeft`). The caster culling
  drops what can't shade the view, for the view of the frame a map is drawn in; the far map is drawn every
  3rd frame (4th on Handheld) and the near map every 2nd on the handheld presets, and looked at from the next
  views too. After a quick turn the casters whose shadows had been off screen were missing until the next
  draw: at the City-Shaft's rim, the first frame after a 100° turn changed 35 148 px of 921 600 (Handheld;
  whole towers across the pit lit, then shaded), and the same after every conversation cut. A kept map now
  keeps the casters of every view within 0.1 rad and 4 m of its own (each end of a caster's shadow sweep,
  by its own distance from the eye), and is drawn again as soon as the camera leaves that: 0 px. Cost,
  average draws a frame over 12 frames (the City-Shaft, three views, headless Chrome on the Mac): High 1409 → 1435, 983 → 1015,
  1455 → 1467; Handheld 952 → 1012, 571 → 622, 969 → 989 (triangles +1–9 %); a turn faster than 0.1 rad
  between two draws draws the kept map early.

Tried and dropped: a ring of spot taps fixed to the world (in the surface's plane, or across the ray) instead
of the screen. It held the masses still over a single 30° turn (the motion check's `swing30` on a City-Shaft
terrace: 472 → 334 per 10 000) but not in a continuous turn (`swing`, 20 px a frame: no better) and it
shimmered more in a slow pan (the Buried Machine: 26.7 → 30.8).

`tests/shadows.test.js` (the slack keeps a tower 4° off screen and still drops one 30° off; when a map is
redrawn), `tests/motion-stable.test.js` (the deep lookup near the terminator), `tests/occlusion-taps.test.js`
(people close nothing in, for every flag they may carry).

## Torn shadows in the creatures' gallery (`uShadowTexel`, `fitShadowExtent`; October 2026)

The author's report on `enemies.html` (the dune skitter): "look at the shadows in motion, there is something really
wrong". The creature's shadow on the paper was torn: ragged, streaky edges, pale gaps, specks that crawled as it
breathed and as the view turned. **The gallery only**: the same creatures in the Arena (the skitter, the old kinds, the
Keeper in its ring) were clean, and so are the studio, the items' gallery and the title.

- **Cause.** `materials.js shadowLit` spreads each cascade's tent by `px / uShadowTexel` (where a texel is smaller than
  the pixel, "Smooth cast-shadow edges"). The gallery (`src/enemies/page.js`) inherits the items' viewer and
  reconfigured its fine map from 1024 px over ±3 m to 2048 px over ±16 m, but `uShadowTexel.x` still said the old
  5.9 mm texel against the real 15.6 mm: the taps spread up to 2.5 times their grid about the point, off the tent's
  weights, and the bilinear comparison taps broke the edge into noise. Its window was also the whole ±16 m round the
  frame's centre (which moves to hold an attack's marked area), so a small creature had a coarse map.
- **Fix.** A `Cascade` given `uniforms.texel: [SU.uShadowTexel, slot]` writes its texel there on every `configure()`;
  every cascade in `src/` passes its slot (the game, the title, the studio, the motion check, the trailer, the
  galleries), so reconfiguring a map can no longer leave the shader behind. The gallery's window is now the game's own
  fine map (`FINE_CASCADE`: 2048 px over ±12 m, bias 3.4 and normal offset 2.6 texels; main.js builds its fine cascade
  from it), wider only for a creature whose shadow wouldn't fit (`fitShadowExtent(r, height, sinEl)`: its radius and the
  shadow of its top at the sun's height, a flyer's hover counted; all 100 fit under the page's 57° sun), and centred on
  the creature's foot (`ItemViewer.shadowCentre`), not on the frame. Tried and dropped: a finer map fitted to each
  creature (±4-5 m, 4 mm texels): its bias in texels was too thin in metres, acne on the shells' shoulders; holding the
  bias in metres still left specks. The game's map is clean and draws the shadow as the game does.
- **Seen**: 8 frames over 2 s of its idle and the orbit (±32° in 8° steps) before and after; the edges are smooth and
  hold still, and thin parts that the coarse map lost (the storm-ray's tail) cast again.
- `tests/shadow-setup.test.js`: a cascade keeps its uShadowTexel slot in step through reconfigurations; every
  `new Cascade` in `src/` passes a slot, with bias (1.5-4 texels) and normal offset (2-3.5) in range, the galleries'
  fine map the game's; the fitted window holds a subject's foot, top and shadow inside the map's unfaded part for
  several sun heights; the gallery fits its window and centres it on the creature.

## Spot blacks anchored to the surface; cave seams (October 2026)

The playtest: on the tree's stairs and the terraces the spot blacks came in blocks that shifted as the camera
moved, worst on Handheld's 4 taps; and "shadow artifacts in caves and interiors". Looked at in headless Chrome
(the light term, debug 5; the spot masks, debug 10) in the desert's two caves, the ship's deck, the City-Shaft's
villas, temple halls (the Signal Market's, the Buried Machine's) and the Machine's oculus drum.

- **A lit seam round the caves' floors** (desert-city.js, desert-hearth.js `rough`). Both caves are rough domes
  on a flat floor; the roughening moved every vertex up or down too, so the dome's foot ring rose up to 0.6 m in
  places and the sun shone in through the slit: a bright line all round the floor in the dome's shade. The foot
  ring (y = 0) now only goes down, into the floor. `tests/cave-seams.test.js`.
- **Blocks that slid with the view** (post.js `enclosure`). The enclosure is the share of a point's neighbours
  standing in front of its face; the neighbours were read at fixed offsets on the screen. Each tap draws a copy
  of every edge near it (a rib, a jamb, a riser's foot), offset by the tap; a hard threshold of their sum is a
  union of such copies, so rectangles and staircases, and since the offsets were screen directions they landed
  on different places of the surface at every camera angle. A riser at 4 taps had one tap or two below its foot
  depending on the view: 0.25 to 0.50 over an 80° swing round it, across the 0.3 threshold, so the risers' masses
  came and went. Now the taps lie **on the surface**, in its tangent plane, along axes tied to the world
  (`SPOT_FRAME`: level along the surface's contour and straight up it; on level ground, where a contour has no
  direction, the world's x laid on it, blended in under 6° of slope), each projected to the screen (the view ray
  is affine in uv, so a view-space point S is at `uv = (S.xy / -S.z - rB) / rA`) where the depth buffer says what
  stands there; the test of each neighbour is the same as before. A point then asks the same places whatever the
  view, and every wall and riser has as many taps below as above (the patterns are their own half turn, so an
  axis's sign doesn't matter): the riser reads 0.40-0.50 from every side, on 4 taps as on 8. The radius is still
  R metres held between 4 and 96 pixels.
- **Wavy, not rectangular** (`SPOT_SWELL`). The tap radius swells 0.6-1.4× with two slow sine waves across the
  world (0.8 R long): the same at a point whatever the view, continuous over a surface, so the copies of an edge
  wave and the masses on a cave's ribbed dome or round a room's cabinet come out as brushed shapes rather than
  stacked blocks. (Turning the pattern instead bent them more but cost the risers their taps below.)
- **People**: unchanged rules (a tap on a person looks past them, twice as far out along its surface offset, and
  is left out if that lands on one too).
- **Checked** against the desert's sheets in the References (bones, tower, sails, wreck, bridges, 3774 ribs, dish
  city, slot canyon; High and Handheld): the same masses, a little less speckle on the sails.
- **Cost**: per tap one more division (the projection) and a few multiply-adds; per pixel the frame and two
  sines. Whole frame (synced), `scripts/bench/passes.mjs`, Handheld preset at 2.5× render scale (3200 × 1800,
  GPU-bound) on the Mac (M4 Pro), old → new build alternated: cave room 6.65 → 6.62 / 7.01 ms, Qanat tree 7.89 →
  7.51 / 7.85 ms; at the preset's own scale 1.04-1.15 → 1.29-1.37 ms (cave room), 2.46-2.80 → 2.48-2.59 ms (tree),
  1.16-1.27 → 1.15-1.17 ms (cave passage): within the Mac's noise. Not measured on the Retroid.
- `tests/occlusion-taps.test.js`: the frame (on the surface, level and up a wall, x on level ground, continuous
  outside the near-level blend), the patterns' half-turn symmetry and taps below, the swell, the Unity port's
  constants, and a twin of both estimates on a raycast staircase (the riser steady and above the threshold).
  The Unity port's Composite.shader takes the same estimate (and the look past a person it lacked).

## The rule for screen-space passes (October 2026)

The three bugs above (a pale ghost of a person in the spot blacks, blocks that slid with the view, a lit seam that
only showed in the light term) were each missed by still frames from fixed cameras. So:

- **Every screen-space pass says how it treats people.** Anything that reads neighbouring pixels' depth, normals or
  G-buffer (occlusion, spot blacks, crease shading, outlines, bloom, screen-space shadows) states whether a tap on a
  person (gHatch.a's hero and figure flags) closes something in, counts as open, or is left out. A person in front of a
  dark area must leave it as dark as without them (`occlusionShare`: left out).
- **And how it behaves under camera motion**: taps and noise tied to the surface or the world, not the screen; a turn
  of a few degrees must not move a mass across the same surface (`SPOT_FRAME`, `LINE_NOISE`).
- **A test twin** comes with it, as `tests/occlusion-taps.test.js`: the estimate rebuilt in JS on a raycast scene, a
  person in front and a camera swinging round a riser.
- **The visual audit's probes** (`.claude/skills/visual-audit/probes.mjs`, `scripts/visual-probes/lib.mjs`) are run on
  the known spots at Handheld and High before it merges: the ghost check (debug 9, 10 and 2 with the traveller and
  without), the orbit (the same surface points in debug 10 and 9 over ±32°), the seams (foot rays and debug 5 inside
  caves and rooms). Their thresholds were set on the builds before 620c4384 and c58cbcaa (docs/audits/visual-v1.4.md).
- **The water's contact foam** (water.md, "Contact foam") reads the scene's depth behind each water pixel, one tap at
  its own reprojected point, no neighbours: a person standing in the water counts as something the water meets
  (foam round their legs), one in front of the water hides it; its noise is on the water's world position, and it
  reads the last frame's depth reprojected, so a turn moves nothing across the surface (orbit probe at three water
  spots, nothing flagged).
- **A shell standing on a floor** keeps its foot ring at or under it, whatever roughens it: `tests/shell-seams.test.js`
  runs every displacement helper on domes, drums and mounds, and fails on a new helper it doesn't know.

## Shimmer on the desert's old city (materials.js `WEATHER.grime`, `HATCH_AA`)

(Since v0.89 the walls' grime streaks and chips are gone, replaced by sparse hairline cracks: materials.md,
"Weathered walls: hairline cracks". What follows is how they were held still.)

The author's feedback (2026-10-06): "I still see some shimmering on some structures". The motion check
(`scripts/motion-check/`, a pan a third of a pixel a frame, the world frozen) at Qanat's gate, 40 m from the
walls, Medium (scale 1) at 1280 × 720: 22.8 flickering pixels per 10 000 a frame, the worst of any view
measured (the desert's spawn 33, but that is its shrubs swaying: the plants' wind is not frozen by the check).
Feature toggles and builds with one mark turned off each: the walls' **grime streaks** −7, their chips −2,
cracks −0.5, the colour-edge lines −10 (the same thing: the streaks' outlines), the hatching −1.5.

- **Grime streaks a few pixels wide were outlined**, and the outline of a shape 3–8 px wide jumps a pixel
  either side as it slides under the pixels. A streak whose head is under `crisp` (6 → 14 CSS px) is now a faint
  soft tone: its sides ramp over `soft` (2) px and its step is held under post.js's colour edge (`faint`, 0.065
  in RGB: the edge starts at 0.08), so nothing outlines it; past 14 px it is drawn whole, dark and inked, as
  before. Its size on screen is what decides, so a pan never changes it (walking up to a wall fades the outline
  in over the 6 → 14 px of its head).
- **Chips' fills** ramp over two pixels instead of one: no colour edge of their own (their pen line marks them).
- **Hatch strokes too fine to draw** (`HATCH_AA`: closer than 4 → 2.2 px, `strokesLevel`, `formLevel`) fade to
  their mean tone instead of aliasing; the same darkness, no pattern to crawl.
- **Results** (flicker per 10 000 px, before → after): Qanat's gate pan, Medium 22.8 → 15.8, Handheld 28.1 → 19.2,
  drift on Handheld 13.3 → 8.4; the Signal Market's pan 17.8 → 14.3; the Buried Machine 23.1 → 23.0 and the
  desert's spawn 33.3 → 32.9 (their own: pipes and swaying shrubs). The hatch fade alone 17.2 → 15.8 at Qanat.
- **Left**: silhouette and crease lines are still a step per pixel (the merlons' and the towers' edges are what
  is left at Qanat); crease shading's sample rotation is a per-pixel hash of the screen position (its share of the
  flicker measured nothing).
- `tests/motion-stable.test.js`: a small streak's step under the edge on any wall, the size by its head in CSS px,
  the chips' ramp, the hatch fade in both stroke functions.

## Nothing fixed to the screen (post.js `LINE_NOISE`)

The author's feedback (2026-10-06): "a filter over the overall image, moving with the camera". Measured at
Qanat's gate (a frozen clock, the camera turned 0.03 rad between two frames, each effect toggled in the page):
three things sat on the screen while the world slid under them.

- **The paper** (`uGrain`'s fibre, `uPaper`'s tooth and pits, baked once per frame size): a mottle of ±2 levels
  with darker pits, over the whole frame, worst on the flat sky. Its difference image before and after the turn
  correlated 0.94 at the same pixels: it stayed put. **Removed**, with its knobs (`uGrain`, `uPaper`, the
  panel's "paper grain"): the sky's own dots are on the dome, the sand's on the sand.
- **The vignette**: the corners 19 % darker, the edges 7 %. **Removed** (a printed page has none).
- **The lines' wobble, pressure and inner weight**: a value-noise field in screen pixels (`tScreenA`, baked), so
  a silhouette swelled and wobbled in place as it slid across the frame, a pane of rippled glass in front of the
  camera. Now read on the **view's direction** in the world (`lineNoise(rd)`): a small tiling texture of random
  texels (`LINE_NOISE.size`² RGBA, four noises in one tap, smooth-stepped between texel centres), three planar
  taps on the direction weighted to its facing axis (`LINE_NOISE.sharp`) with the contrast the blend takes away
  put back, at `LINE_NOISE.cells` (the old 0.06) cells a CSS pixel at the frame's middle, whatever the field
  of view. As the camera turns the field turns with the world (debug view 13: the turned frame matches the
  first shifted by the turn's 21 px at r = 0.996, 0.1 at the same pixels); as it moves it stays on the far
  world, like the sky. Boiling lines re-roll it by an offset.
- **Kept**: the weather's rain and blown-sand streaks (they race across the frame on purpose); the sky's dots
  and every surface's strokes were already anchored.
- **Cost**: the bake and its two half-float frame-size textures (77 MB at Retina size) are gone; three filtered
  taps of a 64 KB texture instead of two `texelFetch`. Desert, synced frames, the two builds timed in turns:
  Handheld 1280 × 720 at 0.75 +0.06 ms (2.44 ms, noise), High 3456 × 2234 −0.35 ms.
- `tests/screen-noise.test.js`: no screen-position noise, paper or vignette in the composite or the presets,
  the lines' noise on the direction at the old size, the texture tiling and deterministic.

## Debug views (`params.debug`)

0 final, 1 raw, 2 albedo, 3 normals, 4 depth, 5 light term (the line step taken off), 6 ink only, 7 hatch
strokes and 8 drawn detail (their packed steps taken off, so a shaded or spotted surface no longer reads as
solid black), 9 spot blacks' enclosure, 10 the spot tier's cast and spot masks, 11 lines by material, 12 cast
shadows lifted or inked, 13 the lines' noise (it must turn with the world, never sit on the screen).

## Cost of the ink pass's three (lines by material, haze, cast shadows)

- **Compiled in only where they are used** (`inkFeatures` in post.js): the haze layers, the fog by height and
  the cast shadows are `#ifdef`s (`INK_LAYERS`, `INK_HFOG`, `INK_HAZE` either, `INK_CAST`) set from the
  uniforms the look sets: through the uniforms' value setters (so the load's shader warm-up compiles the
  right program) and checked again before each draw. three.js keeps each program; a References view of
  another set compiles once, in its fade. Behind uniform switches alone, merely carrying the code cost the
  Retina desert +1.0 ms a frame (a bigger shader runs slower on Apple's GPUs even where the code is
  skipped), as the spot blacks once did (docs/systems/performance.md).
- **The haze once a pixel**: one `hazeAt` (the pixel's own depth; on the sky, the line's surface), used
  for the colour and the lines.
- **Lines by material** are always in (any world has leaves or glass): one more tap of RT0, only on inked
  pixels, and the light term's decoding. About 0.1-0.15 ms at Retina size.
- **Measured** (M4 Pro, ANGLE Metal, synced frame time: each `renderFrame()` of 16 closed by a
  `readPixels`, median of 20-24, the two builds in their own pages timed in turns, the others held; the
  boot camera and one 25 m up; main 14b75c1 against this branch; in-page toggles that recompile without a
  part give its share):

| ms, start / wide | High, 1728 × 1117 at DPR 2 (3456 × 2234) | Handheld (scale 0.65, same window) |
|---|---|---|
| the desert (layers) | 11.97 → 12.34 / 11.21 → 11.52 | 4.90 → 5.03 / 4.66 → 4.79 |
| Vael II (layers, cast) | 12.33 → 12.95 / 11.93 → 12.49 | 4.94 → 5.13 / 4.76 → 4.94 |
| Lorn II (layers, fog by height, cast) | 16.14 → 16.48 / 15.46 → 16.06 | 6.54 → 6.79 / 6.29 → 6.49 |
| the Signal Market (layers) | 13.07 → 13.57 / 14.28 → 14.72 | 5.24 → 5.39 / 5.54 → 5.74 |

  The haze's share 0.1-0.25 ms at Retina size, the cast shadows' under 0.1, the lines by material's about
  0.15 (a build without block 1b); the rest the light term's decoding and the drawn detail's darker ink in
  shade. On the handheld preset 0.13-0.25 ms (3-4 %). Not done: Retina frames over 16.7 ms (Lorn II's) were
  so before.

## Stable in motion

The ink pass's recent work (pen detail at every scale, form hatching, colour patches, worn walls, spot blacks, lines
by material, haze layers and fog by height, cast shadows by world, `FACET_EDGE`, the baked screen noise) had been
checked on still frames. A moving camera shows what stills miss: shimmer, a pattern swapping scale, bands sliding.

- **The check** (`scripts/motion-check/`): a build in headless Chrome (muted, the game's volume 0), the game's own
  clock taken over once booted (`performance.now` and `requestAnimationFrame`: each frame is stepped by hand, the
  same on every run), the camera carried along a path frame by frame, each frame read back. With the world frozen
  (people, water and motes held) the camera moves a third of a pixel a frame: an antialiased drawing changes a few
  levels a frame and in one direction; **flicker** counts the pixels that jumped over 20 levels and came straight back
  (per 10 000 px). The **zoom** (straight at a wall along its normal) and the **swing** (a 30° level turn) are
  measured against the last frame warped to match (exact at every depth), counting a pixel only where its value
  is outside the 3 × 3 it came from. Each path has a heat map; a slow path is run again with a feature off
  (`--toggles`) for its share. Paths: still (the clock running), pan, drift, walk to a wall, zoom, orbit and slow
  orbit round a form-hatched part, fast (30 m/s), haze (walking, looking far), swing, descend (the City-Shaft).
  `survey.sh` runs all twelve worlds; WebM clips (half size, and the hottest part 1:1) and the numbers as JSON.
- **Nothing is fixed to the screen** any more (below): the lines' wobble turns with the world, the paper and the
  vignette are gone. The checks turn the wobble off where they warp frames (`--js` file).

What it found, and what holds it still now:

- **Worn walls seen at a slant** (the Signal Market, Qanat, home): the grime streaks were tapered in tone to their
  foot, so along each streak the colour step crossed post.js's colour-edge threshold (0.08–0.14): its outline was
  drawn on one frame and not the next, and on a face seen edge-on every streak was a dash 1–3 px wide, outlined.
  The streaks now keep their tone (`WEATHER.grime.taper` 0.2), have pixel-wide antialiased sides and ends, and a
  streak whose head is under 2.25 CSS px wide is left out whole; chips' fills, their lip shadows and the cracks'
  shadow slivers lost their hard steps (materials.md, "Weathered walls"). The Market from its spawn, a slow pan
  across two walls at a slant: flicker 6.3 → 2.9 (the weathering's own share 5.1 → 1.7); from the survey's view 3.8 → 3.0.
- **Big curved forms' terminators** (the Buried Machine's pipes and tanks, trunks): within a few degrees of edge-on
  to the sun the surface's own shadow map cut the light/shade line into teeth (shadow texels at grazing), and the
  shadow-edge line followed them in a crawling zig-zag. A smooth surface's shadow map is now faded in over
  n·l 0 … `TERMINATOR` (0.08), the line there the light's own, only where the form is big on screen (its normal
  turns under `TERMINATOR_TURN`, 0.02–0.06, per pixel: a stalk or a rib keeps the map's shade, which holds it still;
  letting it go made the desert's shrubs and ribs flicker more), never the ground (a low sun's cast shadows stay)
  or flat facets (`FACET_EDGE`). The Buried Machine, orbiting its main pipe slowly: 9.3 → 1.5. (Another's
  cast shadow still falls there: "Shadows close up, on climbers and after a quick turn".)
- **Haze and fog turning with the view**: the far fog, its posterised bands, the haze layers and the line fade were
  functions of the view depth, a plane facing the camera, so as the view turned a band's edge swept across the
  ground and a trunk moved from the middle of the view to its side stepped a layer nearer. They are by distance
  from the eye now (`toRange` in post.js; the fog by height already was). Over a 30° turn in Lorn II the pixels
  changed by the fog and haze went from 563 to 242 per 10 000 (what is left: the vignette's darkening on paler
  pixels); the look straight ahead is the same, the sides a little hazier (the corners 1.4 × as far).
- **Pen detail handing over its scales**: each scale is its own pattern, and the next was cross-faded in over the
  last fifth of a level, a swap in a few frames riding or flying past. It is over the last half now
  (`DETAIL.blend`): a long zoom at a Market wall on Handheld (160 → 20 m, where the scales change at Retina's
  2 ×) left half the residual (879 → 492 summed, worst frame 136 → 68). At Retina High the scales change at
  60 / 120 / 240 m only, so walking toward a wall never crosses one.
- **The composite's defines** (`inkFeatures`): a second `onBeforeRender` had replaced the check before each draw,
  so a haze or cast value changed in place kept the program without it; both run now.
- **Checked and steady**: form hatching (Vael II's tables, Lorn II's mushrooms, the Buried Machine's tanks: its
  toggle changes nothing in slow orbits), colour patches (their edges ramp: nothing), lines by material, cast shadows
  by world, the spot blacks, `FACET_EDGE`, and the still frames of every world (only people, water, birds, motes
  and banners change).
- **Left** (older than this work, measured, not changed): the hatching's dense cross-hatch on facets turned away
  and seen at a slant breaks into a speckle that shimmers (the Sealed Hangar's towers: half its pan's flicker, the
  hatch toggle 8.7 → 4.5; the desert's 7.4 → 6.6); grass tufts with a pen line in the Garden of Spheres; the
  shadow edge where the fine cascade (±12 m) takes over from the near one moves a few pixels at once as you walk
  up to a wall (a 1.4 m blend at the map's border); shadow-edge lines are a step per pixel (FXAA smooths them).

Per world (High, 1728 × 1117 at DPR 2; flicker per 10 000 px before → after; zoom and swing: the warped residual):

| World | Found | High: before → after | Handheld: before → after |
|---|---|---|---|
| Desert | nothing new; the hatching on the far mesas the most of a pan; fog bands sliding as you turn | pan 7.4 → 7.0, drift 1.3 → 1.0, swing 3449 → 3322 | pan 6.9 → 6.2 |
| City-Shaft | its fog by height steady going down; fog turning with the view | swing 3726 → 3235, descend 88.6 → 88.7 | swing 3773 → 3303 |
| Signal Market | grime and its outlines shimmering on walls at a slant (fixed) | pan 3.8 → 3.0 (from its spawn 6.3 → 2.9) | pan 6.0 → 5.2 |
| Vael | nothing new | pan 1.6 → 1.6 | pan 3.2 → 3.0 |
| Vael II | the tables' form hatching steady in a slow orbit | pan 9.4 → 9.0, orbit 7.1 → 7.1 | pan 7.3 → 7.0 |
| Lorn | nothing new | pan 4.3 → 4.3 | pan 5.2 → 5.3 |
| Lorn II | haze layers turning with the view (fixed); mushrooms' fans steady | pan 6.1 → 5.8, swing 1662 → 1312 | swing 1752 → 1413 |
| Viridel | nothing new | pan 2.4 → 2.5 | pan 2.8 → 3.1 |
| Sealed Hangar | the towers' dense cross-hatch speckle (left) | pan 8.8 → 8.7 | pan 10.2 → 10.2 |
| Buried Machine | teeth crawling along the pipes' and tanks' terminators (fixed) | slow orbit 9.3 → 1.5, zoom 4.5 → 4.0 | slow orbit 1.6 → 1.6 |
| Garden of Spheres | grass tufts' pen lines (left) | pan 15.1 → 15.3, slow orbit 12.1 → 11.7 | pan 23.9 → 23.9 |
| Home | nothing new | pan 5.9 → 5.9 | pan 5.7 → 5.6 |

(The still path is left out: with the clock running it measures who walks by; every world's showed only moving
things. On Handheld the Buried Machine's pipe is small enough on screen that the shadow map holds its line.)

- **Cost** (M4 Pro, ANGLE Metal, the two builds in their own pages timed in turns: 16 `renderFrame()` closed by a
  `readPixels`, 12 rounds, the boot camera and one 25 m up; paired difference median, ms): High 1728 × 1117 at
  DPR 2, the Market +0.02 / +0.18, the Buried Machine −0.30 / +0.18, Lorn II −0.11 / −0.01, the desert −0.01 /
  −0.02; Handheld 0.00 / −0.01, −0.60 / −0.62, 0.00 / −0.31, −0.47 / −0.26. Nothing measurable: the detail's
  wider cross-fade evaluates a second scale on more of a wall's pixels, the rest is a divide, an `fwidth` and a
  few smoothsteps.
- `tests/motion-stable.test.js`: the grime's tone at its foot against the edge threshold and its width cut, no hard
  steps in the wear, the detail's blend, the terminator's fade and where it applies, the fog and haze by distance
  (a trunk turning to the side of the view keeps its veil), the composite's defines followed in place.


## Thin bars at any distance (materials.js `S_THIN`, `src/thin.js`, October 2026)

The Forest of Antennas is masts by the thousand: lattice struts 0.12-0.2 m thick, wires 0.1 m, vines, far poles.
Past 60-100 m on the handheld (a pixel is ~0.002 × its distance there) such a bar is under a pixel wide, and a bar
under a pixel is drawn on one frame and missed on the next as it slides under them: the motion check's pan from the
ship flickered 62 pixels in 10 000 a frame on Handheld (the busiest world measured so far is the Garden at ~24).

- **The bar keeps a least width**: each vertex of a bar carries the point of its axis it stands round (`aThin`: xyz,
  w 1 on a bar; `thinBar` for a straight bar, `thinTube` for a tube along a curve, `thinRing` for a torus,
  `thinPole` for the instanced far poles). In the vertex shader, where the bar would be thinner on screen than
  `makeMaterial({ thin })` pixels (1.5), the vertex is pushed out from that point to that width: a pixel there is
  `2 d / (P[1][1] × uViewH)` m (d the axis point's distance, `uViewH` the frame's height as drawn, main.js
  `resize`). Only for a perspective camera (`P[2][3] = -1`): a shadow map draws the bar as it is. Near, nothing
  changes; far off, the bar is a steady line 1.5 px wide that the haze fades into the sky, as the sheets' far masts.
- **Carried through the builds**: a bar's axes move with it (`keepThin` chains `applyMatrix4`, so translate, rotate
  and `aimAt` move them), RoomKit's `mergeable` keeps `aThin`, and `padThin` gives the rest of a bucket an empty one
  (w 0: drawn as it is). Not one of `SURFACE_FEATURES` (as `S_VMAT`): a shader made without `SURFACE_SPEC` never
  expects the attribute. The collision is baked from the drawn geometry on the CPU, unchanged.
- **Results** (scripts/motion-check, 1280 × 720, the world frozen; flicker per 10 000 px, before → after, the before
  the same build with every bar at its own thickness): Handheld pan 62.1 → 20.0, drift 8.9 → 7.6, haze 34.3 → 31.5;
  High pan 59.0 → 39.0. What is left is the leaves on the vines and cables, the bushes' blades and the grass.
  Drawing the far masts thicker on the CPU (`FAR_MIN_R`) and in a line of their own colour alone changed nothing
  measurable (62.3 → 62.1): the near and middle lattices and the wires were the crawl.
- **Cost**: a few multiply-adds a vertex of a thin material; nothing measurable at Handheld.
- `tests/antennas.test.js`: the views' sheet projection; `tests/surface-spec.test.js` and `vertex-material.test.js`
  unchanged.

## The eclipse (post.js `drawEclipse`, `uEclipse`; src/eclipse.js; October 2026)

The City During the Eclipse's sky: the sun covered by the moon at midday, drawn as the pictures draw it.

- **The disc and its corona** (post.js, in the sky): `uEclipse` (x how far the moon covers the sun, y the discs'
  angular radius, z the corona's reach × the radius, w its style: 0 fine rays … 1 a stipple), `uCorona` (its colour;
  a: stars shown in totality), `uEclipseGlow` (the band of rose light low all round the horizon: rgb, its height),
  `uEclipseDir` (where the eclipse stands, when not at the sun's own place: the References' views). The moon is a
  black disc slid off the sun as the cover falls (only its bite out of the sun shows out of totality); in totality
  its limb gets a thin bright ring, the corona prints as fine pen rays of their own lengths and/or dots thinning
  outward, a halo of two flat lighter bands, all measured on the sky round the sun (they never swim) and sized in
  pixels from one pixel's angle. Off (`uEclipse.y` 0) in every preset; a world's look or src/eclipse.js turns it on.
- **The hour** (src/eclipse.js, `applyEclipse`, called after `applyTimeOfDay` by main.js's `updateSky` when the
  level says `sky.eclipse`): the sun on the world's own path (its height and azimuth at noon), the moon over it
  round `mid` (`eclipsePhase`: partial, then total), the light leaning up toward the zenith in totality (the whole
  sky's glow lights the tops), `uNight` held at `night` in totality (the windows lit, the glows' halos wider), the
  stars. Its colours are the level's own script (`eclipseScript`: day, the dimming partial phase, totality, dusk,
  night), handed over with `atmo().script`.
- **Lamplight in its own colour** (`makeMaterial({ lampTint })`, the LAMP_TINT define): the local lights' pools
  turn the albedo toward the lamps' amber, so a cold-lit world's lamps throw warm light (the eclipse's city; the
  White Mangrove's notes asked for it); `uLampsOn` (shared, 1 unless a world dims it: src/eclipse.js keeps it for
  the eclipse and the night). Opt-in per material; the other worlds compile without it.
- **Cost**: one branch on a uniform in the sky (nothing for the other worlds); in an eclipse sky a few hashes a sky
  pixel near the sun; nothing measurable at Handheld.
- `tests/eclipse.test.js`: the phase by the hour, the sun's path, the script's keys, `applyEclipse`'s uniforms and
  light, every preset turning it off, `lampTint`'s define.

## Space (post.js `drawSpace`, `uSpace`; October 2026)

The City Floating in Space's sky: the black of space all round, below the city as well as above it, the way the
pictures print it (references/levels/The City Floating in Space/).

- **The sky**: the world's colour script keeps the sky top and horizon a near-black with a trace of teal at every
  hour, and its look prints it flat (`uSkyFlat` 1, no bands, no dots, no clouds, no cumulus, no sun rays: `uRays`
  0); with `uSpace.x` on, the sun's glow on the horizon and the halo ring round its disc go too.
- **The stars and the nebula** (`drawSpace`, before the planets so they hide what is behind them): two
  stereographic caps, one per hemisphere, meeting at the horizon (the lower one's cells offset so the stars below
  are not the mirror of those above; the cell width taken from the caps' own mapping, so no seam), one star or
  none a cell: `uSpace.y` the density, `uSpace.z` the share of teal ones, a few larger with a short fine cross
  (`uSpaceTone.a` their size). The nebula is a slow noise on the caps plus a band across the sky, printed in two
  flat steps of `uSpaceTone.rgb` (`uSpace.w` how much). The night's own stars (`uNight`) are left off in space.
- **The planet** is one of the level's `sky.planets` (drawPlanet: a flat lit disc, its night side hatched, an ink
  ring round it), made great (20–50° across) and plain (`craters: false`). `uSpaceSun` (xyz, w 1) lights the planets
  from a direction of their own instead of the sun's, so a view can have a crescent while its city is lit from
  elsewhere; `uSpaceNight` (rgb, a) prints their dark side in a colour of its own (the mauve of picture 3, or the
  sky's black for picture 2's crescent). The world itself leaves `uSpaceSun` off: its planet is lit by its own sun,
  full at noon and a crescent at night.
- Off (`uSpace` 0, `uSpaceSun.w` 0, `uSpaceNight.a` 0) in every preset (`hazeOff`); the world's look or a view's
  turns it on. Cost: one branch on a uniform in the sky; in space a handful of hashes and a five-octave noise per
  sky pixel (the nebula), nothing measurable at Handheld.
- `tests/spacecity.test.js`: every preset turns it off; the city's look turns it on, flat and black.
