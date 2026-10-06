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
   - **Paper.** Grain, fibre and a vignette.

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
  - acid steam rising in the city-shaft;
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
| RT0.a | the light term L (half-lambert × cast shadow, 0..1) | + 2 × line step (LINE: weight step + 4 × tint step, 0..15) | < 32 |
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
- **Room left** for a flag or two: RT0.a's sign bit (L and the steps are never negative: a flag
  stored as −(1 + L + 2 × step), read by its sign and |a| − 1; the top steps then keep 1/32),
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

## Debug views (`params.debug`)

0 final, 1 raw, 2 albedo, 3 normals, 4 depth, 5 light term (the line step taken off), 6 ink only, 7 hatch
strokes and 8 drawn detail (their packed steps taken off, so a shaded or spotted surface no longer reads as
solid black), 9 spot blacks' enclosure, 10 the spot tier's cast and spot masks, 11 lines by material, 12 cast
shadows lifted.

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
- **The screen-fixed parts are fixed on purpose**: the lines' wobble and the paper are baked once per frame size
  (identical in a still frame as the clock runs: nothing in the still path but what moves), so in motion the
  world slides under them, as under paper; and the vignette. The checks turn wobble and paper off where they
  warp frames (`--js` file).

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
  or flat facets (`FACET_EDGE`). The Buried Machine, orbiting its main pipe slowly: 9.3 → 1.5.
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
