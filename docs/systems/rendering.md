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
    through FXAA (SMAA on the Handheld preset: "Far lines that would alias") and is scaled to the display;
  - stroke sizes follow, so the lines just get cleaner;
  - the default is 1× on Retina screens, which are already dense.
- **Hatching that follows form:** on slopes the strokes become height
  contours, and on smooth objects the cross-hatch wraps round them as rings.
- **Crease shading:**
  - small screen-space ambient occlusion from the depth and normal buffers;
  - it darkens building bases, crevices and canopy undersides, and adds ink
    accents where geometry closes in;
  - smooth and still: its taps are the same for every 2 × 2 quad and averaged
    over it (post.js `CREASE`, `quadMean`; "Crease shading back, spot blacks
    gone", below).
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
- **A line from afar** (`makeMaterial({ lineFar: { line, lineTint, from, to } })`, the `LINE_FAR` define): an
  instance standing past its own distance between `from` and `to` (m; a hash of where it stands, so a field turns
  over plant by plant, never in a ring round the camera) packs that step instead of its own. The vertex shader decides
  it once an instance (a flat varying: a plant is never half one line, half the other). Viridel's small flowers
  (`flora.js FAR_LINE`: 0.45 / 0.67 past 25-40 m) are drawn in the world's ink close up and in a thin line of their
  own colour far off, where their outlines were a third of what they drew (#38).
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

(The spot blacks are gone since v1.73, issue #322: "Crease shading back, spot blacks gone", at the end. The cave seams'
fix below stands.)

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
- **People** (since replaced: "The visual probes' findings fixed", below): unchanged rules (a tap on a person looks past them, twice as far out along its surface offset, and
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

## Spot blacks only in pockets; the shadow QC's phantom casters (October 2026, v1.59)

(The spot blacks are gone since v1.73, issue #322; the shadow QC's fix below stands.)

The author: "botchy shadows and shadows that move while the camera is moving", "the issues started when I said I wanted
deeper darks", and of a near-black band at a Qanat house's foot, "it makes sense under the roof or at the top, but this
is at the bottom on the floor". Measured in headless Chrome (muted): the shadow QC in the Shadow Room, the motion check
on the desert's light term, and the visual probes over Qanat and the desert's caves (orbit and ghost checks).

- **Every wall's foot was a pocket** (post.js `enclosure`). A wall standing on open ground stands in front of the
  ground's face for half the taps, and the ground in front of the wall's foot: 0.4–0.5 of the taps closed, over the
  0.3 threshold. So every building's foot, every riser (the steps below it stand in front of it), every room's floor
  corner and the bones' feet on the giant's cave floor were filled with the near-black, and as a screen-space estimate
  those masses came and went as the camera turned (the cave's orbit probe: a mask step of 0.53 at the 95th percentile,
  flagged). Now (`SPOT_POCKET`, `spotShare`): what closes a point in must stand at its height or over it (a tap whose
  surface stands more than `below` under the point stops counting), but on a face turned down (an eave's underside, a
  ceiling, closed in by the wall below it); and on the ground a pocket must close in from opposite sides (tap i and
  tap i + n/2, the patterns being their own half turn), as an alley or a cave's floor does, never along one wall.
  Walls keep the share of their taps: the wall under a balcony, a recess between ribs, a vertical corner.
- **Measured** (`visual-audit/probes.mjs --worlds desert --presets high,handheld --auto 6`, the p95 step of the spot
  mask over a ±32° orbit, flagged over 0.3): the giant's cave 0.533 → 0.051 (High), 0.471 → 0.020 (Handheld); the
  Qanat tree's stairs (Handheld) 0.118 → 0.043; a Qanat wall (Handheld) 0.149 → 0.024; no orbit flagged after, and
  the Handheld ghost flag on the tree's stairs gone. The masses left: alleys, under balconies and eaves, between ribs.
- **Left**: with 4 taps (Handheld) the long taps lie along the world's x on level ground, so the floor of a narrow
  alley running along x is only seen across by the short taps (0.55 R) and keeps no spot black; a few flecks of the
  spot mask by the traveller's hands on a wall right behind him.
- **A dark copy of the traveller on the ground beside a wall's end** (the Shadow Room, the author's own view: High,
  the sun 35° from the east, he stood just past the west end of the house's north wall, the camera behind and above).
  A tap on him is replaced by what he hides (`spotBehind`), guessed from the planes seen round him; there the guess
  carried the wall's narrow end face on past where the wall stops, behind him, and the ground beside him read closed
  from both sides, the real wall's and the guessed one's: a person-shaped spot black by his head. On the ground a tap
  on a person now counts as open (a person never makes a pocket of open ground); walls keep the look past him.
- **And on the wall's narrow end face beside him** (the author's second view). The look past him took the planes seen
  round him (the house's north face, the roof's edge, seen just in front of or at the end face) and carried them on
  behind him in front of the end face: the face filled with spot black in his shape. A plane is now only taken if it
  was seen well in front of the point's own surface (`SPOT_PAST.front`, 0.75 × the pocket's radius: the room corner's
  other wall, seen in front, is still taken). Swept in the JS twin on the house at his window's size (2022 × 698 at
  render scale 1.5, where the pocket's radius is ~0.5 m, held by its 96 px): 37-52 dark samples at 0.05, 0 at 0.75,
  and the corners' pale notches back from 1.0 up. Tighter reaches for the looks 2× and 4× out and to the sides
  (`near.past`, `near.side`) cleared the last patch by his hand at the face's foot but brought the corners' pale notches
  back on 4 taps: left as they were, a small patch there remains. Each frame was rebuilt from the author's numbers
  (player, camera, window, preset, sun: `copy(JSON.stringify({ player: player.pos.toArray(), … }))` in the console).
- **A pale outline of the traveller in the dust band** at a weathered wall's foot (post.js 3b', the author: "still
  seeing my character's outline on the building, where the gray area at the bottom looks white"). The band finds the
  ground with one probe its height down the screen; where that landed on him, it took him for no ground and left the
  band out in his shape, shifted up the wall, sliding with him. A probe on a person now looks on past them
  (`DUST_PAST`: up to 8 more steps, each at least 4 % of the frame) to the ground at their feet, and never takes a
  person for the ground; the Unity port the same. `tests/occlusion-taps.test.js`.
- **The shadow QC's phantom casters** (`scripts/shadow-qc/probes.js` `casters`): since v1.45 the scene also holds the
  still meshes' view batches (static-batch.js, `BatchedMesh`), whose vertices are each mesh's own under an identity
  matrix. Taken as meshes, they put a copy of every batched prop, pole and post round the world's origin (the Shadow
  Room's spawn) into the truth: the props and poles read 82–100 % "leaks" on every preset, shade that nothing casts.
  Batches are left out now (the meshes they draw are still in the scene). `tests/shadow-qc.test.js`. With the truth
  right, the whole walk (High, Steam Deck, Handheld at 35° and 12°) reads as in October: at 35° every spot green on
  the Deck, every one but the poles' seams on High (10.4 %, the fine map's edge) and the arch's balcony on Handheld
  (23 % of its contacts, the 16 cm texel); the props' and poles' leaks 82–100 % → 0. At 12° the reds left are the ones
  listed in October (thin long shadows seen far off, the balcony, the stair's cascade pops, Handheld's spill).
- `tests/occlusion-taps.test.js`: a wall on open ground (its foot and the ground before it under 0.25 from every side),
  an alley's floor and the wall under a balcony kept, a balcony's underside as it was, a riser's foot steady from
  every side (as before) but no longer a mass, `spotShare` on its own, and the shader's and the Unity port's constants.
  The Unity port's Composite.shader takes the same rule.

## No spot-black halo round a thing standing before a surface (`SPOT_RANGE`; issue #301, v1.72)

(The spot blacks, and `SPOT_RANGE` with them, are gone since v1.73, issue #322: "Crease shading back, spot blacks gone",
at the end. The orbit probe's and the bench views' fixes below stand.)

The visual audit at v1.66 (findings 1-2, v1.21's finding 1 still open): a jagged halo of spot black round the Lorn
temple hall's crystal on its ring against the far wall (orbit p95 0.60 at High), round the rocks and the stone figure
by the Underwater City's ramp, along the glass column there, round the Moon Foundry's ramp rails (0.38). The taps
round a point on the far surface landed on the near thing and counted it as closing the surface in: a band as wide as
the taps' reach round its outline, sliding over the far surface as the camera turned (the outline moves across it, the
thing doesn't). The distance check the taps had (1.5-3 × R, the pocket's 3 m) let in anything a few metres off,
while the taps themselves (held to 96 px on the screen) reach under a metre at 6 m.

- **Now** a tap's surface counts only up to `SPOT_RANGE.gap[0]` (2.5) × the taps' radius (Rm, after its swell) in front
  of the tap's own place on the point's surface, along the same ray (its view depth less the seen surface's), fading
  out by `gap[1]` (4) ×. A pocket's sides rise from the surface within that reach (an alley's walls, a balcony over a
  wall, a riser's step); a thing standing farther out is open. The Unity port's Composite.shader the same.
- **The twin** (`tests/occlusion-taps.test.js`): the crystal 3 m before a wall, the probe's camera 6.5 m off orbiting
  ±32°, the wall's points round it: High's 8 taps flipped 58 times in 988 steps of 8° (one in 17), 10 now; the
  Handheld's 4 taps 24 → 15. Tighter reaches (1.5-3 ×) clear the crystal entirely but take a 2.2 m balcony's spot black
  under the 0.3 threshold (its front edge stands that far out): 2.5-4 keeps the balcony, the alley and the risers as
  they were.
- **Measured** (`probes.mjs --worlds perdide,underwater,buried,moonfoundry --presets handheld,high --spots
  inner-wall-3,stairs-0`, the spot mask's p95 step): Lorn's crystal 0.60 → 0 (High), 0.17 → 0.02 (Handheld); the Moon
  Foundry's ramp 0.38 → 0.22 (High), 0.24 → 0.24; the Underwater City's ramp 0.80 → not judged, the Buried Machine's
  0.62 → 0 (Handheld): there the probe had been measuring something else, below.
- **The probe's own miss** (`scripts/visual-probes/lib.mjs` `seenAt`): the orbit's points are found and followed with
  rays against what collides, and what collides isn't always what is drawn. At the Underwater City's ramp they lay on a
  collider 0.4 m before the camera that nothing draws, and the orbit read whatever showed through it (the stone
  figure's creases, its albedo near the floor's) as the floor's mask coming and going; at the Buried Machine's ramp
  four in five lay on the beam's collision box off its drawn faces. A point now counts in a frame only where the depth
  view (debug 4) puts it at its own view depth (within 15 % and a level's rounding). The halos round the rocks there are
  gone in the pictures (`docs/audits/visual-v1.66` before, this change's after); the ramp's spot itself has no drawn
  point left for the probe to follow.

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
  runs every displacement helper on domes, drums and mounds, and fails on a new helper it doesn't know (world.js
  `jitter`'s `vertical` noise too, since visual-v1.4: its foot ring only goes down).

## The visual probes' findings fixed (docs/audits/visual-v1.4.md; October 2026)

The first run of the probes (visual-v1.4) found five things in the pictures and a few in the probes themselves;
the after-run is [visual-v1.21](../audits/visual-v1.21.md).

- **A dark copy of the traveller on the wall beside him in room corners** (Handheld; post.js `enclosure`,
  `spotLoop`, `planeAlong`, `spotBehind`). A tap landing on a person looked past them, twice as far along its
  offset. In a corner that reached past the corner onto the other wall, which stands in front of the point: the
  tap closed it in where, without him, it saw its own wall. Leaving the tap out was no better: on Handheld's 4 taps
  a point with one tap of four closing (0.25, a hair under the desert's 0.3) became one of three. Now every tap is
  read first (pixel, normal and depth, person or not), and a tap on a person **stands for what the person hides**:
  the surfaces seen two and four times as far out along its offset and every other tap's surface are taken as
  planes and met along the hidden tap's own ray; the nearest one between the person and the point's own surface
  (its place on it, P + o) is what the tap sees, else the point's own surface goes on behind them (open). The
  corner's far wall only meets that ray behind the near wall, so it no longer counts; a recess, a stair's tread
  or the floor in a corner's foot still closes the point in. Every tap now counts (the share is over all of them).
  The probes' corner (the desert, a room inside a way in): the dark region beside him 6442 px → 0 at Handheld; the
  known spots stay clean. Twin: `tests/occlusion-taps.test.js` (a corner and a stair with a person in front, the
  rule before and now, and `spotBehind` itself). The Unity port's Composite.shader takes the same rule.
  **Where three planes meet** (visual-v1.21 findings 3 and 4, issue #28: a corner's foot, two walls and the floor) the
  planes seen two and four times as far out and the other taps' could all miss the one the person hides, and the tap
  read open: a small pale notch in the corner's dark band beside his legs (300-600 px at Handheld). Two more looks past
  him now, `SPOT_PAST.side` (1.5) × the tap's offset to either side of its place, along the other axis; and each plane
  is only taken where the hidden tap's ray meets it within `SPOT_PAST.near` × the pocket's radius of where it was seen
  (`planeNear`: 1 for the looks along its own way, 2 for the looks to the side, 1.5 for the other taps): a plane
  carried far past where it was seen closed the floor in where nothing stands. The probes (Handheld, the traveller
  and Marrow, before → after): the desert's corner pale 472 → 0 px, with Marrow 543 → 24 and his hem's dark 1240 →
  1247 (left: only a limit of 1 on the other taps took it, and that cut pale notches elsewhere); the Underwater corner
  pale 300 → 16; the Qanat stairs' pale 144 → 21 px (a person of 115 px, still flagged); ghost flags over five worlds
  6 → 3 (the Buried corner's 371 → 348 and the glass dunes' ramp stay). At High the desert's ghost flags 2 → 1 (the
  Qanat stairs, whose pale grew 28 → 212 px), Marrow's dark at the corner 837 → 615. The cost: two more reads of the
  normals and the flags for a hidden tap only (pixels next to people).
- **A hairline of sky at the Givers' Hearth's floor edge** (both presets, 44-73 px in the light term; src/desert-hearth.js
  `hallDome`, `HEARTH.floorOut`). Not the door cut: `rough` pushes the dome's foot ring out as well as down (17.4 to
  19.8 m from the centre, a few cm under the floor), and the floor ended at 18 m, so all round the hall a gap opened
  between the floor's edge and the wall's foot where a grazing look saw the sky under the wall. The floor now runs
  3.5 m past the hall, under the whole foot (the wall stands in it). The cave of the giant's heart had the same gap
  in four places (its foot out to 32.8 m, the floor to 32): its floor's lathe now runs to `ROOM + 4`. The seams probe:
  the Hearth's longest sky-white line 44-73 px → none (the 73 px it still reports at High is a glowing floor mark);
  `tests/cave-seams.test.js` (the floor reaches past each dome's foot).
- **A jagged spot-black halo round the makers' drones in the temple halls**, moving with them (incal, edena, spheres;
  both presets). A foe isn't a person, so the enclosure counted the taps landing on a hovering machine as standing in
  front of the wall behind it. Foes are now **movers**: gHatch.a + 64 (`uMover`; materials.js `MOVER`, `isMover`:
  every material keyed 'foe-...' in src/foes.js or 'arch....' in the roster's kit, or made with `{ mover: true }`; the
  scout drone is the player's, marked hero since v0.17, so a person already).
  The spot taps and the crease shading see past a mover as they see past a person (`notStanding`), unless the point
  is on a mover itself (`self`: a machine's own pockets keep their spot blacks). Every reader of gHatch.a takes the
  64 off first (the main decode, the line kernel's drift test; the others read it mod 16). The glow under a mover's
  flag is held to 1/16 steps by the half-float target (a foe's eye at 0.6 reads 0.5625-0.625: under the lights'
  0.62 threshold either way). The probe's machine in a City-Shaft temple hall (incal, High): the halo gone, the
  machine's own legs and plates still black (`tests/ground-ink.test.js`, `tests/occlusion-taps.test.js`).
  The temples' crystal pendulums (pieces.js `Swing`: the Hush-House's gallery and the three over the Mother Snapper)
  are movers too since v1.24 (visual audit v1.21, finding 1: the halo round the crystal on the hall's wall).
- **Small square steps in the spot mass at the temple halls' pillar feet** (Edena, High): checked, nothing to fix.
  The hall the audit saw was rebuilt since (the Builders' Greenhouse, v1.16); in the new one the orbit swing (±32° in
  8° steps, every frame saved: `probes.mjs --save-all`) over its four spots at High holds the masks still (p95 step 0
  at each, nothing flagged), and the square notches left at the foot of its planters and walls are the copies of the
  leaves and corners in front of them, tied to the surface: they stay put as the camera turns. A hard-edged mass is a
  union of such copies by design ("Wavy, not rectangular" above).
- **A spot-black blob in the traveller's own shadow on the sand by the ship** (both presets; the probes' `stairs-0`
  ghost view at the ramp; materials.js `keepHero`). `notPerson` on the taps round his feet was right: his body is
  flagged. But his gear is built after main.js tagged him (`markHero` once, at boot): the shield bracer on his wrist,
  the sword, its frog and grip, the tank's jets and lantern carried no hero flag, so the taps took the shield hanging
  by his hand for something standing over the sand, and the shield and sword took spot blacks of their own in the
  shade. `keepHero` tags his hierarchy and whatever is added under it later (Object3D 'childadded'), its fluid
  materials left as they are (inked like print: fluid-tool.js `TANK.inked`); a part moved between bones (the sword
  drawn) is not copied again. What is left in his shadow there is a clean stripe: the crease at the foot of the dune
  (its enclosure 0.25-0.4 on Handheld's 4 taps), which takes the spot black in any shade, the ship's too (with every
  tap on him counted open it stays: not a person's tap). `tests/scout.test.js`.

## How the visual probes' limits were set (`.claude/skills/visual-audit/probes.mjs`; October 2026)

Each probe's limit was set on the bug it is for, the build before the fix against the one after (an archive of the
old commit passed as `--root`, the same spots); the skill keeps the limits, this is where they came from.

- **Ghost** (bug 1, the pale person-shaped shadows; fixed in 620c4384, `occlusionShare`): the pale region beside him
  in mask 9 or 10 was 0.11 of his size on the Qanat tree's stairs at Handheld before and 0.003 after; the Givers'
  Hearth 703 px before, 0 after. Hence 5 % of him or 300 px for the pale region, 30 % for the dark halo.
- **Orbit** (bug 2, the dark masses that changed shape as the camera moved; fixed in c58cbcaa, taps anchored to the
  surface): the frame-to-frame step's 95th percentile on the stairs 0.60 before, 0.20-0.23 after; the Hearth 0.54 /
  0.25 before, 0.03-0.24 after. Hence 0.3. The swing narrows in a small room (`orbitScale`) because a full swing there
  changed the camera's distance and the whole view, and flagged that, not the masks (visual-v1.4).
- **Seams** (bug 3, the lit seam round the caves' floors; fixed in c58cbcaa): the Hearth's foot rays found 6 of 24
  directions open before, 0 after; its sky-white line in the light term was 62-149 px before. Hence a run of 60 px
  flagged, 30-60 px kept as a picture. The 0.3 m ray is there for furniture on legs (a bench in the Sealed Hangar, a
  world since dismissed): the metre-high ray meets it, the foot ray passes under, and that is not a gap.
- **Enemies off** (visual-v1.21 finding 6): a foe in the Undertower knocked the traveller out during the orbits, and
  a traveller down stays where he fell, so a Signal Market shop was read with the shadow maps 3 km below. The probes
  now run with foes off, get him up before each move and skip a probe he is not standing at.

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
solid black), 9 the crease shading's occlusion (the spot blacks' enclosure until v1.73), 10 the cast shadows'
darkening toward the spot tone (red; green was the spot mask), 11 lines by material, 12 cast
shadows lifted or inked, 13 the lines' noise (it must turn with the world, never sit on the screen), 14 the
lines as drawn (blue: after the fog, the haze and the grass's and lights' own fades; the ink-lines audit reads it).

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

**The frozen world holds its life too** (issue #301, v1.72; `scripts/motion-check/freeze.mjs`). Every frame of a path
puts the traveller behind the camera, and the flocks circle him (life.js `Flock`: their centre is his position), the
creatures wake, sleep and flee round him (wildlife.js), the foes and the reactive things answer him: with the clock
stopped they still moved with the camera. They are held now (the flocks keep the centre and eye they had, the rest are
updated as paused; `--live` leaves them). The visual audit at v1.66 put the rise of Viridel's pan (12.8 against 2.5
here) and the Garden's and Lorn's on them; held, the numbers barely move (Viridel 12.7 → 12.5, the Garden 20.8 → 20.9,
Lorn 6.5 → 6.5): the heat maps put the rest on the drawing of what those worlds grew since the table was made
(Viridel's new flower beds round its start and the road's dark outline at a grazing angle, the Garden's furrows).
The pans again (High, 1728 × 1117 at DPR 2, v1.72, the life held; the table's "after" first): the Desert 7.0 → 4.9,
the City-Shaft 15.2, the Signal Market 3.0 → 4.2, Vael 1.6 → 3.3 (its spawn moved with the merge, v1.39), Vael II 9.0 →
3.3 and Lorn II 5.8 → 6.5 (merged into Vael and Lorn: the same spawn now), Lorn 4.3 → 6.5, Viridel 2.5 → 12.5, the
Sealed Hangar 8.7 → 5.1, the Buried Machine 3.1, the Garden of Spheres 15.3 → 20.9, Home 5.9 → 10.4.

Viridel's pink flock over the ship, red in the pan's heat map (visual-v1.85 finding 3, issue #504), is held: it is
`flocks[0]` (life.js `Flock`), and stepped as the check steps it its birds move under a millimetre a frame. The pan
(High, 1728 × 1117 at DPR 2) reads 12.8 with the flocks held, 12.9 with their `update` stopped dead, 13.1 left live
(`--live`) and 12.1 with no birds drawn: the 0.8 left on them is their own small outlined wings stepping under a pixel
as the camera turns (the same as the Garden's tufts, below), not a mover the freeze misses.

**The Garden's grass tufts** (visual-v1.85 finding 3, issue #504): its 5 000 tufts of five single-triangle blades
(spheres.js, `grass tufts`) were outlined in the world's black ink and lit blade by blade, so they read as dark tufts and
each blade's outline (and the creases where a tuft's blades cross) came and went as the pan moved a third of a pixel a
frame. They don't sway (a plain material: nothing moves them in the frozen check); they alias. Their share, the tufts
left out: 21.2 → 6.0. Now they take a soft thing's line (`TUFT_LINE`: 0.45 in a dark shade of their own green, a
hairline past 20-35 m, as the clouds and reeds) and the ground's light (their normals up: no creases), and the Garden's
small flowers take Viridel's far line (flora.js `FAR_LINE`). The pan (High, 1728 × 1117 at DPR 2, the life held):
21.2 → 13.5 (the tufts' line 21.2 → 15.3, its far hairline and the flowers' far line → 14.3, the ground's light → 13.5).
Drawing the line still lighter (0.25 near) or blunting the blades' tips changed nothing measurable; what is left on the
tufts is their outline at all, which the world's own grass (flora-grass.js, soft ink) fades with distance and these
keep. In Unity the near line and the normals come through the bridge; the far hairline is `LINE_FAR`'s known gap (#264).

- **Cost** (M4 Pro, ANGLE Metal, the two builds in their own pages timed in turns: 16 `renderFrame()` closed by a
  `readPixels`, 12 rounds, the boot camera and one 25 m up; paired difference median, ms): High 1728 × 1117 at
  DPR 2, the Market +0.02 / +0.18, the Buried Machine −0.30 / +0.18, Lorn II −0.11 / −0.01, the desert −0.01 /
  −0.02; Handheld 0.00 / −0.01, −0.60 / −0.62, 0.00 / −0.31, −0.47 / −0.26. Nothing measurable: the detail's
  wider cross-fade evaluates a second scale on more of a wall's pixels, the rest is a divide, an `fwidth` and a
  few smoothsteps.
- `tests/motion-stable.test.js`: the grime's tone at its foot against the edge threshold and its width cut, no hard
  steps in the wear, the detail's blend, the terminator's fade and where it applies, the fog and haze by distance
  (a trunk turning to the side of the view keeps its veil), the composite's defines followed in place.


## Ink lines by size on screen (post.js 1a, `INK_SIZE`; October 2026)

"Lines are too big for some vegetation, and the character's eyes render almost like black eyes from afar."
The ink-lines audit (`.claude/skills/ink-lines`, `docs/audits/ink-lines-v1.34.md`) measures the lines against
what they draw, scene by scene from 1 m to 120 m and at every resolution the game is played at. A pen line of a
fixed width in CSS px ate whatever was a few pixels across: Edena's flowers at 55 m were 54-64 % ink and 30-39 %
near-black, every stem and petal drawn over; on a phone or at the Handheld's floor the lines were a far bigger
share of the picture than at 1080p. Three rules, all in the composite, none touching the near look at 1080p:

- **A sliver keeps its colour** (`onSliver`): `inkLines` also says whether this pixel differs from both its
  neighbours across (`gSliver`: nearer in depth than both, by `step` of its depth; or a crease or a colour edge on
  both sides). That is a feature a kernel or two wide: a stem, a far petal, a blade's tip. Its own line keeps off
  it (0.3 of it left); the line beside it, on the background, still draws its outline. No new tap.
- **A thin shape's outline is lighter** (`farSide`): on a depth edge's far side (the background beside a shape in
  front, `near.z` over 0), two taps past the shape, one and three kernels on: where the background shows again,
  the shape is that thin, and its line keeps 0.45 (half that past three kernels). Only on inked pixels.
- **The frame's size** (`frame`): a line's width is CSS px; on a frame under 900 CSS px tall it thins with the
  frame, down to 0.6 (720p 0.8, the Deck 0.89, a phone held sideways 0.6). A kernel that ends under a render pixel
  (the Handheld at its 0.5 floor) is still drawn a pixel wide, so it carries its coverage instead, down to
  `minAlpha` 0.7.

The people far away keep their own redraw (block 1, `figHit`), the traveller his own outline (`heroInk`), the grass
its soft ink. Debug view 14 shows the lines as drawn. Measured before → after and the cost: the audit.

What 1a left on the far flowers (34-41 % ink at 55 m, the rubric's far cap 30 %) is taken by their line from afar
(`lineFar`, "Lines by material" above): 40 → 27 % at 1080p (`docs/audits/ink-lines-v1.53.md`). The far town's
"shimmer" (0.45 of the frame's ink changing a half pixel over) was the audit's own reading: the nudge moves the camera
half a pixel at the distance it looks at, so the pole, the sign and the traveller 10 m off slid ~9 px. Read over what
slides under a pixel (`steadyMask`), the town changes 0.19 of its ink with 2 % pops, under the rubric's 0.35 / 12 %.

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
- **The City Floating in Space** (issue #171): the thin pipes and the cables hung under its islands (space-city-kit.js
  `island`, `HANG_PX` 2.5, the pipes' line 0.45, the cables' 0.7) and the moorers' winch cable. At the Handheld's 0.5
  floor and on a phone the ink-lines audit's bridges view changed 0.46 / 0.42 with the camera half a pixel over (the
  limit 0.35), nearly all of it these bars a pixel or two wide; after, 0.34 / 0.32 (1080p 0.34 → 0.25). Under 1.5 px
  it stayed over 0.35; at 2.5 with the full ink the frame's ink went over 9 %, the lighter lines bring it back to
  8.7-9.2 %. The far islands (detail under 0.5, in the haze) keep theirs as drawn (`steady`).

## Far lines that would alias (post.js 1c `INK_FAR`; SMAA on Handheld; issue #225, October 2026)

"On my Retroid Pocket Nova I see a lot of aliasing far in the distance, or shimmering" (#218). Measured with the motion
check at the Retroid's own frame (`record.mjs --preset handheld --res 730x410@2`: 730 × 410 CSS px at 2×, render scale
0.75, so 1095 × 615 render pixels) and its new **`--far 60`**: the flicker counted again over the pixels more than 60 m
off alone (a mask read once a path from debug view 4). The far parts flickered 2-4× as much as the frame: the desert's
camp town 110 m off 88 per 10 000 in a slow pan, the Signal Market's facades down the street 201 in a slow turn (the
whole frame 86, the most of any view measured on Handheld). Toggled in the page: **the ink lines were three quarters
of it** (all lines off: 202 → 51 in the Market, 90 → 32 in the desert); the hatching nothing (it already fades to its
tone under 4 → 2.2 px, `HATCH_AA`, and a stroke under a pixel wide keeps its coverage, the ±0.6 px ramp); FXAA off
*lowered* the count a little (90 → 72: it spreads a pixel's flip over its neighbours, it doesn't stop it).

**Why the lines**: a line is never under a render pixel wide (a kernel under one is drawn one wide: `max(w, 1.0)`), and
the G-buffer is point-sampled. Far off, where the worlds' finest drawn detail (a window's frame, a strut, a step: about
`INK_FAR.detail`, 0.25 m) is a pixel or two across, every edge of it gets a full-black line one pixel wide, a lattice
that the pixel centres hit differently each frame: whole pixels flipping from paper to black and back. The thin bars'
rule (`src/thin.js`: never thinner than 1.5 px) can't apply to a line, which is already a pixel; what is left is
contrast.

- **The rule (1c)**: on inked pixels (not the traveller's), the detail's size on screen at the line's nearest surface,
  `detail × P11 / 2 × render height / depth` render px; as it goes from `px` 3 to 1.2 the line fades to `interior`
  (0.35) of its ink, or `silhouette` (0.6) where it is a depth edge. Drawn lighter, a far line keeps its place and its
  shape but no longer flips a pixel from paper to black; it reads as distance, as the haze's lines do. By the size
  on screen, so it is a frame's own: on the Retroid lines start fading at ~50 m and reach their floor at ~120 m; at
  1080p Medium 86 → 215 m; on High at Retina size 270 → 670 m (the haze has most of that by then). No taps, a few
  multiply-adds; before the fog and the haze (they take their share of what is left). `inkFarKeep` mirrors it.
- **SMAA on Handheld** (`QUALITY_PRESETS.handheld.aa = 'smaa'`, `pipeline.js createSmaa`): three's `SMAAPass` (its
  edges and weights at the render size, 8-bit targets), its blend drawn straight to the canvas, sampling the
  linear-filtered frame, so it scales as it blends (no extra pass). It follows the edges it finds instead of
  softening every contrast: sharper ink than FXAA, and less flicker at the Retroid's frame (FXAA → SMAA, far: the
  desert 42 → 38 pan, 47 → 37 turn; the Market 31 → 27, 79 → 75; Lorn II 14 → 12). **The Deck keeps FXAA**: at its
  own 1280 × 800, a render pixel a CSS pixel, SMAA flickered more (the desert's far pan 50 → 78; FXAA's blur hides
  the flips there). Every other preset keeps FXAA (`aaOf`).
- **Results** (Handheld, 730 × 410 at 2×; flicker per 10 000 px over 60 m off, before → after; the whole frame in
  brackets):

| World | pan | turn |
|---|---|---|
| Desert (the camp town) | 87.8 → 38.0 (22.8 → 10.7) | 61.3 → 38.7 (22.3 → 12.5) |
| Signal Market | 43.2 → 26.6 (20.1 → 15.3) | 201.4 → 74.7 (86.3 → 39.0) |
| Lorn II | 27.6 → 12.1 (30.0 → 18.5) | 47.6 → 19.1 (23.1 → 12.6) |
| Sealed Hangar | 36.5 → 19.3 (21.3 → 12.8) | 36.5 → 19.4 (22.6 → 13.4) |

  What is left is the geometry itself under the pixels (lines off, the Market's turn still flickers 37 far off).
- **Cost** (M4 Pro, headless Chrome, Handheld at 1460 × 820 at 0.75, the Retroid's render size; `passes.mjs
  --toggles fxaa,smaa`, synced frame time, median of 7 in turns): SMAA over FXAA +0.18 ms at the desert's spawn, +0.05
  on the dunes, +0.09 at the camps; 1c within the noise (builds timed in turns: ±0.4 ms either way). The Retroid not
  measured (no device this round): at the ~3× the Mac measured for the machines (performance.md, round 5), 0.2-0.5 ms.
- **The look**: near, nothing changes (on the Retroid the fade starts 50 m off); far towns and facades are
  drawn in lighter lines, the haze's own direction. Pictures in the changelog (v1.59).
- **Unity** (issue #218, October 2026): the same rule in its own ink shader (Composite.shader 1c, after the line
  kernels, before the fog; `_NoInkFar` a test), the hatching's `HATCH_AA` in HiraethCommon.hlsl, and at Handheld SMAA
  (Hidden/Hiraeth/SMAA, URP's own, in HiraethFeature after the composite at the render size) in place of FXAA. On the
  Retroid the far flicker of a slow pan fell by a third to three quarters, nearly all of it the far lines' fade
  (performance.md, "Unity on the Retroid: the distant shimmer").
- `tests/distant-shimmer.test.js`: the fade's ends and floor, by size on screen (the Retroid fades at 150 m, Retina
  doesn't), 1c's place in the shader and no taps; SMAA on Handheld only (Auto on a handheld too), FXAA elsewhere;
  main.js's last pass by the preset.

## Half-transparent surfaces (materials.js `S_VEIL`, `src/veil.js`; October 2026)

Lorn II's sheets draw the giant mushrooms as pale glass: the trunks behind show through the caps and the stalks
(references/levels/Lorn II The Deep Wood/environment/IMG_3798, IMG_3800). The game's surfaces are opaque (one
G-buffer, the ink pass over it), and a dithered screen-door would put an ink line round every hole, so a see-through
surface is drawn in two parts:

- **Its rim, in the G-buffer** (`makeMaterial({ veil })`): where the surface faces the eye more squarely than the cut
  (|n·v| > `veil`: `VEIL.cap` 0.42, `VEIL.stalk` 0.5) the fragment is discarded, as the bubble helmet's glass is. What
  is left is a band round the silhouette, shaded, hatched and inked like any surface; the post pass draws its outline
  and a thin inner line where the band gives way to what is behind (the sheets' double contour of glass). Its line is
  0.7 in a shade of its own colour (`line`, `lineTint`). The shadow maps draw the whole shape (the wood is dark under
  the caps). Not one of `SURFACE_FEATURES`, and guarded by `uVeil > 0`: a shader made without `SURFACE_SPEC` never cuts.
  The roster's glass wears the cut alone, with no wash (a wash would be another program): the bellows toad's sac as it
  swells (`uVeil` from 0 at rest to 0.7, the glob inside it showing; src/enemies/plans/hopper.js) and the Garden's glass
  puppet (`GLASS_VEIL` 0.6, src/enemies/plans/strings.js). Each swaps its material's program for one with `S_VEIL`:
  the same number of programs in each world.
- **Its body, after the ink pass** (`Veils`, main.js `renderFrame` step 4, before the wind and the motes): the same
  geometry again (one wash mesh per veiled mesh, sharing its buffers), drawn over the finished picture at `alpha` a layer
  (0.3 a cap skin, 0.4 a stalk wall, 0.4 where it glows; a cap's two skins or a stalk's near and far wall make about
  half), lit flat between the world's shade and light tints by the sun (`uShadowTint`, `uLightTint`, `uNight`: the ink
  pass's own uniform objects), glowing where the cap glows, and hazed as the ink pass hazes the world (its layers by
  distance, the far fog, the low mist: `hazeAt`'s formulas, post.js 4 and 4b). Its depth is tested by hand against
  the G-buffer's (RT1.w, the motes' way): hidden by anything nearer, and not laid over its own rim (`depthEps`).
- **Where**: Lorn II's giants (the stalks, the gills, the caps). The relic mushroom's cap and its five stepping caps keep
  their tops solid, so you see where you land rather than the ground below; the small mushrooms, the eggs and the
  References views are as they were.
- **People**: a person behind a cap or a stalk shows through it under the wash (Tansy by the ship, among the small
  mushrooms and the reeds, reads as before); a person in front hides the wash.
- **Cost** (M4 Pro, ANGLE Metal, 1280 × 633, the view from the landing towards the relic, `renderFrame` timed with a
  pixel read-back, median of five runs of 40 frames, veils on / off in one page): High 3.37 → 3.46 ms, the Deck preset
  2.64 → 2.74 ms; draw calls 728 → 737 a frame (one per wash mesh in view, 12 in all). The wash alone 0.10 ms.
- `tests/veil.test.js`: the define and the fallback, one wash per mesh sharing its geometry, bound to the ink pass's
  uniforms, drawn only while its mesh shows.
- A level may turn a wash off for a while (`wash.userData.off`: the Glass Dunes' lenses beyond 170 m, worlds.md "Time in
  the glass"); its mesh's rim is still drawn.

## Shafts of light (`src/veil.js` `LightShaft`; v1.49, issue #116)

Every shaft of light, beam or god ray is drawn as the skull cave's (v1.45, issue #69): two open cones, an outer one and
a narrower inner one (0.55 of it), from where the light comes in to where it falls, brighter at the core where they
overlap, drawn only as washes over the finished picture (the veils above, one wash program). Their meshes are on layer
31 with an invisible material: no camera draws them into the G-buffer, so no ink round them, no shadow, nothing to
collide with, and the Unity export leaves them out (veils are not mirrored there). `new LightShaft(veils, parent,
{ color, alpha: [outer, inner], near })`; `set(top, rTop, bottom, rBottom, { topN, bottomN })` writes the two rings in
world metres each frame it moves (a ring's plane across the shaft, or the pool's surface for its foot), `fade(k)` its
alpha, `visible` hides it. A level without washes gets one from the first that needs it (`rt.veils`; the Buried
Machine's story at its setup, before main binds them; a wash added after the bind takes the ink pass's light then).

A chest's light as it opens (`src/boxes/light.js`, boxes.md "The light out of it", issue #285) uses the same washes
with their **rays** on (`uRays`, x > 0: soft where the cone is seen edge-on, fading to its far end, streaked into rays
round it and stepped into three flat bands), laid additively; every other wash has x = 0 and draws as before.
`Veils.remove(wash)` takes one out of the pass again (the chest's, at the end of its scene).

The shafts: the skull cave's cracks (`src/desert-city.js`, static cones of its own), the Builders' Greenhouse's nine
louvres (`Sunbeam` in `src/temples/pieces.js`: louvre to pool, swinging with it, fading with the slats; nine thin
glowing bars before), the Lamp-House's beam over the wood once its lamp burns (`src/temples/perdide2.js` `change`: a
solid inked cone before) and the Wick's light up the Buried Machine's oculus (`src/story/buried.js`: a solid glowing
tube before). Not shafts of light, left as they are: the quest and box beacons, the scout's and the trials' marker
beams, the sentinel's crown-vent plume (a target), the searchlights' attack cones. `tests/light-shafts.test.js`,
`tests/veil.test.js`.

## Ways through (`src/thresholds.js`; v1.70, issue #305)

"Leaving the skull cave it looks like it's blocked but it works. There should be a shader to show that I can go
through." Every way to another space in a level's `portals` (doorways, shops and rooms, the temples' doors and ways
out, the skull's mouth and the cave's way up, the Hearth, Viridel's hatch, the Avenue's lift and sea locks, the
sinkhole) wore, until issue #391's glow (below), a veil of light hanging in its opening, brightest at the sill and fading up, its rays
drifting across and stepped into flat bands (the chest light's washes with `uRays` on, additive), and a pale pool of it
across the sill. Two washes a way, only within `THRESHOLD.far` (48 m) of the eye; layer 31, nothing in the G-buffer.
A way whose `when` says no (the skull's mouth before the backpack, a sea lock before its suit) wears none and stays as
solid as it is drawn; it comes on over `fadeIn` once it opens.

Where it hangs: a portal's `door: { at (the sill's middle), yaw (the way through), w, h }`. `portalPair` gives both of a
room's (`buildRoom` returns its hole as `door`), the temples their door and ways out (the kit's axis), the desert its
caves, the Avenue its lift and locks; a size left out is fitted to the walls (`fitDoor`: rays across to the jambs, a
step or two along the way through if the point stands out of the doorway, and up to the lintel). A portal with no
`door` is measured blind (`measureDoor`: the nearest pair of opposite walls) and, in the open (the sinkhole, the
divers' cage), wears a soft round column of the same light. The black panel at the end of the skull cave's landing,
which read as a shut wall, is the daylight up there now.

**Its size is its opening's** (issue #391, "the shader for the door doesn't match the real size of the door?"): a temple's
door, 7 by 9 m, wore 2.2 by 4.2, the size `fitDoor` fell back to when its jambs stood more than 3.2 m off, and a 5 m
cap on the height cut every way out short; it stood in the dark like a cut-out. Now `fitDoor` looks for each jamb
within `THRESHOLD.fit.reach` (5.5 m) and takes openings up to 10 by 11 m; the width is the hole's, the narrowest slice
along the way through (a frame's pillars or a recess round the hole are wider), and the veil moves to it, except where
the portal gives its sill (`at`: in front of whatever shuts the way behind it, a temple's dark), where it stays and only
the width and middle are taken from the hole within 1 m. Its top is measured too (`top`: nine rays up across it, an
arch's point or a cave's rock) and the frame's depth (`depth`: [behind, in front], m; the looks below use it). A door
can give its shape: `arch` (a round top, radius w/2), `corner` (rounded corners), `round` (a round door: a disc w
across under h), `tilt` (leaning back from upright) — `openingAt` / `openingGeometry` draw it. At the source: the
shopfronts give their own doorway (`buildShopfront` and every `FRONTS` builder: `B.door()`, `opening`), the sea locks
their round doors a hand in front of them, the skull's mouth its tunnel's arch just inside the lip (the lip's face clips
it), the Crown's lift its booth door, Viridel's hull hatch its rounded, leaning hole inside the collar. Measured on the
twelve route worlds (issue #391's scratchpad doorlight-391, fit.md): 29 of 91 veils were off their openings by more
than 15 %, every temple door and way out among them.

**Its look: a glow** (issue #391, "it's not a very nice shader, can we do something nicer?"; of three looks tried, rays,
glow and paper, the author picked the glow; src/door-light.js). The opening filled with light, brightest round its frame
in four flat steps (`DOOR_LIGHT.edge`, 0.8 m in), the far side's colour faint in its middle (`room`, a room's lamp, on
the ways in; `sky`, the day, on the ways out), the middle fading as the eye comes from 4.5 to 1 m so you see into it;
its sides a thin rim back into the frame (`depth`, at least 0.6 m), a pale pool on the floor before it, out 1.5 m.
Additive, never a blur. One mesh and one draw a door, one program for them all, over the finished picture as the
veils are (layer 31, its depth tested by hand against the G-buffer's): `doorLightGeometry` builds the opening as a
grid (`openingGrid`: each point's distance to its edge) with the pool and the sides, each vertex's part in its colour
(r part / 4, g how far out, b its distance to the edge / 4), faced to the side the door is walked into from
(`approachSide`: a door's `side`, else the side with a floor and room before it). `uDoor` (x how strongly it shows:
its fade, breath and flare; y the eye's distance) moves each frame. A way in the open (a `column`) keeps the #305 veil.
**In Unity**: the material goes as `port: 'doorlight'` (engine/unity/port-format.js) to **Hiraeth/DoorLight**
(Transparent+30, `Blend SrcAlpha One`, the same depth test against `_GNormalTex.w`), its parts read from the mesh's
colours (the material's `vertexColors`), `uDoor` live as `_Door` (engine/mirror.js `LIVE_VECTORS`), its alpha brought
down for Unity's linear blend as the veil's is; in `Batch.RuntimeShaders`; `-no-veil` leaves it out with the washes.
`tests/door-light.test.js`, `tests/thresholds.test.js`.

Going through (main.js): the veil flares (`flare`: ×2.6, settling over 0.9 s), and `Passage.go({ lead })` puts the
doorway's light over the screen (`PassageCover.light`, a warm radial glow under the paper) for `THRESHOLD.lead`
(0.2 s), the traveller still walking into it, before the paper sweeps across as before; on the far side the way back
glows and settles (`arrive`). `tests/thresholds.test.js`.

A doorway that is no portal (a fight temple's gatehouse, whose door opens its game's page: issue #384) wears the same
glow: `Thresholds.addDoor({ at, yaw, w, h, depth, side, room })` builds it as a portal's (`glowOf`) and returns its entry
with `remove()`; `kit/marker.js` calls it for a sign whose model gives `userData.door`. A wash added after the veils are
bound takes their shared light and haze too (`Veils.addWash`).

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

## Z-fighting (scripts/zfight, `Z_GAP`; v1.44)

Two faces of different looks lying in one plane are drawn in an order the depth buffer can't decide: they stripe
and flicker as the camera moves (the author's issue #75, the Rose House's "ton of visual artifacts"). The
`zfight-qc` skill (`.claude/skills/zfight-qc/SKILL.md`) finds them by geometry in node: every visible static mesh's
triangles, bucketed by plane, each pair of looks (a material, and for the temples' vertex-coloured paint its colour)
within 4 mm, parallel and overlapping by more than 0.05 m² is a **site** (one per pair of looks per 3 m), kept only if
someone standing near could see it (a floor under him, no ceiling on his head, not inside a wall, a clear line to it on
its faces' side; inside a temple's box only in a room). `node scripts/zfight/audit.mjs` counts every world and its
temples; `node scripts/zfight/list-temple.mjs <id>` lists one temple's sites in its own frame.

**The kit's fix** (src/temples/kit.js, `Z_GAP` 2 cm), for every temple at once: a doorway's frame reaches 2 cm into the
opening over the wall's own reveal, and its lintel 2 cm under the wall over the hole; a sill stops 2 cm under the hole's
foot, under the floor laid through it; a hall's roof stops 2 cm inside its walls' outer faces (a taller hall beyond
sees that face); a wall's end at a side the hall leaves open stops 2 cm short of the far face of the wall that closes
it. The Rose House's layout started its corridors and gallery inside the walls they meet, not on their faces.

Visible sites, before → after (v1.44; `ZFIGHT_BASELINE` in `tests/zfight.test.js` holds each temple to its count, the
Rose House to none):

| world | the world (all) | its temples |
|---|---|---|
| desert | 105 → 18 | the Rose House 87 → **0** |
| incal | 4007 → 3971 | the Warden's Well 83 → 47 |
| arzach | 153 → 22 | the Founders' Belfry 84 → 11, the Aerie 66 → 8 |
| glassdunes | 60 → 4 | the Clock-House 59 → 3 |
| buried | 1778 → 1706 | the Engine-House 72 → 0 |
| edena | 43 → 4 | the Builders' Greenhouse 43 → 4 |
| spheres | 69 → 12 | the Footprint 59 → 2 |
| perdide | 143 → 19 | the Lamp-House 74 → 9, the Hush-House 69 → 10 |
| bazaar | 181 → 108 | the Undertower 85 → 12 |
| underwater | 189 → 47 | the Whale-House 161 → 19 |
| moonfoundry | 341 → 243 | the Casting-House 118 → 20 |
| spacecity | 420 → 352 | the Mooring-House 73 → 5 |

Left (the worlds outside their temples, not fixed here): the City-Shaft's city down the pit (most of its 3900, its
buildings' merged meshes against each other), the Buried Machine's two layers of the drawn city at 522 m (`city1` and
`city2`, perhaps two levels of detail, both counted), the Underwater City's floor and its paving at 4 cm, the Moon
Foundry's cells' solid surfaces against their drawn ones, Qanat's walls (25 m² on two of its houses), the cave of the
giant's heart's floor and the keepers' stair, the Givers' Hearth's floor. The Warden's Well's 47 are nearly all on its
tower's foot and crown outside, in the shaft.

**v1.66, 2026-10-13** (docs/audits/zfight-v1.66.md; main → the audit's fixes): desert 29 → 29, incal 4148 → 4070, arzach
16, glassdunes 12 → **2** (the city under the sand's walls 2 cm under its glass ceiling), buried 1707, edena 121 → **5**
(the split meteor was the finder's own miss: a shell and its inside on one geometry, front and back side, now read as
facing apart in `coplanarOverlaps`; the water stair's lips' ends 2 cm inside the walls, `LIP.gap`), spheres 34, perdide
16, bazaar 576 → **151** (the screen lanes' motifs 1 and 2 cm off their screens, `MOTIF`), underwater 72, moonfoundry 266,
spacecity 460: 7457 → 6828. Every temple at or under its baseline; six baselines lowered to the counts they had come
down to. Left: issue #286 (the City Floating in Space's merged parts, the nameless merged tiles, the market in the air,
the canyon street, the furrows).

**v1.68, 2026-10-13** (issue #286; main → the fixes): a merged mesh's sites name their pieces now
(`scripts/zfight/names.mjs`: in node, before the world loads, where each geometry is made and what each
`mergeGeometries` is made of; under each site `audit.mjs` prints the two pieces' lines in `src/` and the comment
over them, so "Mesh#144 × Mesh#146" reads `box levels/bazaar.js:89 < buildBazaar levels/bazaar.js:212 — the fascia…`).
The counts: spacecity 460 → **22** (the houses' windows, laid where the dice fall, one over another now stands `Z_GAP`
further out, `eclipse-kit.js` `house`; a roof's lip starts `Z_GAP` down in the roof, under the storey heaped on it;
under an island the first tier's top 1 cm under the pipes' ends, `TIER_DOWN` (both inside the slab), the pipes' collars `Z_GAP` past their
ends; what is laid onto a deck, a bridge's ends and the stairs' pads, runs `DECK_BURY` 5 cm under it, under the
paving plate and the slab's top; the bridges' parapets `Z_GAP` inside their sides), bazaar 151 → 98 (the market in the
air's treads `Z_GAP` inside the stringers, the mast's rungs inside its bands left out; the old market's stairs off its
floor and the street's paving), underwater 72 → 50 (the canyon street's bridge to the far terrace's edge, not a metre
onto it; its glass rails from inside the deck up into their brass; its stairs' last step not on over the deck),
spheres 34 → 10 (the furrows' banks `Z_GAP` over the beds; the hill's landings drawn `Z_GAP` under the terraces, walked
on their proxies; the craters' top steps `Z_GAP` under the terrace they reach), arzach 16 → 13 (Vael's loggias' dark
recess off the piers' feet). The rest as before: desert 29, incal 4070-4101 (it varies run to run), glassdunes 2,
buried 1707, edena 5, perdide 16, moonfoundry 266. `tests/zfight.test.js` now holds the City Floating in Space to its
count (`WORLD_ZFIGHT_BASELINE`) and the market in the air, the canyon street and the furrows to none of their own.
Left: the Signal Market's avenue (89: each stall's counter ends in the plane of its fascia's, `bazaar.js` line 212/214,
and the posters' light strips flush with their glow plates, `poster`; held back while the Market's tower and landing
are reworked, #278), the City Floating in Space's last 22 (house feet in the deck, 2-3 cm inside the slab: the finder's
own 5 cm tolerance; two chimneys; two greebles under the market; the Mooring-House's 3), the Garden of Spheres' paths on the ground (7) and one bank
meeting a rise of the ground.

**v1.85, 2026-10-18** (docs/audits/zfight-v1.85.md, issue #467): desert 29, incal 4064, arzach 6, glassdunes **268** (the
city under the sand rebuilt in #393/#426: `crowdedBlock`'s jutting rooms flush on each other, issue #498), buried 1708,
edena 7, spheres 8, perdide 11, bazaar 74, underwater 43, moonfoundry 238, spacecity 19: 6475 in all. The temples at or
under their baselines (the Warden's Well 8 of 39, the Belfry 3 of 10, the Undertower 3 of 8).

**v1.86, 2026-10-19** (issue #498): glassdunes 268 → **0**, the Clock-House 1 → 0. In the city under the sand,
`crowdedBlock` (src/glass-dunes-masses.js) sets the rooms of a storey `Z_GAP` over one another's feet (and the ground
storey's roof), gives each room of a face its own depth into the core (their buried ends all lay in one plane, which the
finder saw from inside the core, among the rooms' ends), sets the street face's windows `Z_GAP` off the door and each
other, and books every room's faces in a `planeBook` the street's blocks share: a face (or its ledge's, its window's)
landing within 6 mm of a booked plane of a piece it could meet is moved a few millimetres. Elsewhere: a winding stair's
last tread `Z_GAP` under its top and a bridge's deck `2 × Z_GAP` under its ends (they lay on terraces, blocks and each
other: architecture.js, civic-kit.js), the court's high walk 4 cm over the terrace it runs along, an opening's jambs
backed off its recess's back, the pearl city's tower windows leaning with their tapered walls and kept off the girdle,
the kiosk's posts 2 cm under its roof. The pale floors (`paleFloor`) stand on the highest ground a quarter cell round
each corner: laid on the sand at their corners alone they dipped 2 cm into it where the ground's 4 m triangles fold
under their 2 m cells (now 2.6-23 cm over it). **The finder** now measures two near-parallel faces where they overlap
(`coplanarOverlaps`: the shared part's corners against the other face's plane): 300 m from the origin, faces tilted a
hair apart have offsets (`n·p`) within 4 mm while lying centimetres apart, which counted the court's floor, 6 cm over
the sand, as three sites and the Clock-House's dial as one. With the old finder the Glass Dunes counts 4 after these
fixes, those four. `tests/zfight.test.js` holds the Glass Dunes to none (`WORLD_ZFIGHT_BASELINE`). Measured in the game
(muted headless Chrome, High, 1280 × 720, up the city's lane from its stair, the camera moved 2 mm between two
pictures): pixels changing by more than 24 levels 0.52 → 0.25 % (a striped wall of rooms gone; the rest is the lamps'
glow and the motes); the court's terrace and the ledges' view the same before and after (0.25 %, 0.13 %).

**v1.87, 2026-10-20** (docs/audits/zfight-v1.87.md, issue #556): desert 24, incal 4092, arzach 3, glassdunes 0, buried
1707, edena 5, spheres 0, perdide 5, bazaar 73, underwater 42, moonfoundry 238, spacecity 12, the ship 0: 6201 in all
(6475 → 6201). New: two crates in the Hush-House's fight court (`crate`, src/gadgets/yard-kit.js: the frame's bars along
x flush with the box's top and bottom). The temples at or under their baselines, six well under (the Warden's Well 6 of
39, the Belfry 1 of 10, the Undertower 3 of 8, the Lamp-House 1 of 3, the Greenhouse 1 of 2, the Whale-House 5 of 6).

**Issue #566** (the audit's small fixes): the crates' frame bars along x and z set 0.012 m proud of the box's top and
bottom as the uprights already were, so Lorn 5 → **3** (both crates gone); `ZFIGHT_BASELINE` lowered to what the temples
hold (incal 39 → 6, arzach2 10 → 1, bazaar 8 → 3, perdide2 3 → 1, edena 2 → 1, underwater 6 → 5) and the City Floating in
Space's `WORLD_ZFIGHT_BASELINE` 20 → 12, so a new site in any of them fails the test.

## The Shadow Room and the shadow QC (`?level=shadows`, `.claude/skills/shadow-qc`; October 2026)

Issue #67: a room for complex shadow situations, and a check of the shadows in motion with the traveller.

**The room** (`src/levels/shadow-room.js`, Debug menu → Test rooms): a pale flat yard with the hard cases one after
another along one walk (`SHADOW_ROOM.path`, a loop from the spawn): small props round the spawn, six poles from 20 cm
down to 6 mm, a grate of 3 cm bars overhead and a fence of 2 cm bars, a colonnade throwing stripes across the walk, a
pergola of two layers of leaf cut-outs (real holes: the depth pass has no alpha test), an arch and a balcony over a
wall, a stair of 17 steps up to a terrace with balusters and a ramp down, wedges at 25°, 30° and 33° and a mound the
sun grazes, a closed house with a door and a slit window (light to dark), things that move (a lift and a slider you
can stand on, a pendulum, a fan, a rolling ball) and an 82 m tower (shaft, balconies, a lattice crown, a spire) whose
shadow runs west across the yard through all three cascades. Each station is a mesh per material, so the shadow
culler judges them one by one as it does a world's buildings. Four boards by the spawn (interact) hold the sun lower
(35°, 20°, 12°, 6°, 62°), turn it round in 45° steps, give it back to the clock (then step the hour) and stop the
movers; `level.shadowRoom` does the same from code (`setSun`, `useClock`, `freeze`). Peaceful, nothing grows.

**The QC** (the skill's SKILL.md has the how): the traveller walks the path at a run, turning the camera after the way,
and stops at eleven places to turn it once round; every frame the game's own shadow lookup (`SHADOW_GLSL`, the
surfaces' code, compiled into a point shader with the frame's maps and uniforms) is evaluated at ~350 000 probes laid
on the room's surfaces and judged against rays to the sun through a BVH of the room; his body is rebuilt as a BVH every
frame (skinned as the GPU skins it) for the truth of his own shadow. Per spot: acne, leaks, peter-panning, casters off
screen, shimmer, cascade pops and seams, how much of his shadow is drawn, how much spills, how far from his planted
foot it starts.

- **The ground under the stations was missing** in this room after the load: passage.js `WarmDraw.compile` wore the
  shadows' depth material on each mesh of its list and on their children, and a mesh listed after its own parent (a
  terrain tile, perf.js `tileScene`) had the override taken for its own material and put back for good. Each mesh now
  wears it once. (`tests/passage.test.js`.)

**Found** (the Mac, headless Chrome, 1280 × 720, the whole walk; the spots merged):

| preset, sun | his shadow drawn | spill | gap from the foot (p90 by spot) | peter-pan | the balcony's wall (peter-pan) | leaks |
|---|---|---|---|---|---|---|
| High, 35° | 92 % → 92 % | 13 % → 13 % | 0–5 cm → 0–5 cm | 4.6 % → 0.4 % | 7.5 % → 0.6 % | 0 → 0 |
| High, 12° | 93 % → 93 % | 14 % → 14 % | 0–2 cm → 0–2 cm | 1.4 % → 0.6 % | 6.6 % → 6.0 % | 0.45 % → 0.41 % |
| Steam Deck, 35° | 65 % → 93 % | 41 % → 12 % | 9–27 cm → 0–3 cm (two spots 16, 22) | 4.8 % → 0 | 6.0 % → 0 | 0 → 0 |
| Steam Deck, 12° | 65 % → 89 % | 39 % → 15 % | 8–27 cm → 0–5 cm | 3.4 % → 0.7 % | 17 % → 0 | 0.13 % → 0.01 % |
| Handheld, 35° | 50 % → 92 % | 46 % → 15 % | 22–51 cm → 0–3 cm (the house 27) | 43 % → 16 % | 72 % → 25 % | 0.99 % → 0 |
| Handheld, 12° | 42 % → 88 % | 59 % → 18 % | 22–55 cm → 0–3 cm | 9.2 % → 4.0 % | 0 → 0 | 1.5 % → 0.26 % |

Acne stayed under 0.03 % everywhere at 35° and 12°; shimmer (0.003–0.03 % of the edge probes a frame) and the cascade
pops (High only: the fine map's edge) did not change.

- **His shadow on the presets with no fine map** (Steam Deck, Handheld) lived in the near map alone: a 6 cm (Deck)
  or 16 cm (Handheld) texel under a 12 cm leg, the 4-tap tent widened to the pixel, and a bias and offset of 2.3
  and 3.2 of those texels. Half of it drawn, a grey blur round it, starting a hand's width from his feet. **The hero
  map** (shadows.js `HERO_CASCADE`, `heroExtent`; main.js `heroPass`; perf.js `shadow.hero`): the fine cascade's map
  (1024 px) holds the traveller alone, in a window fitted round him and his shadow (3 m at noon, up to 8 m at a low
  sun: `fitShadowExtent`), drawn from his own meshes in a scene of their own; the surfaces take it with the near map
  by `min` (materials.js `uShadowHero`), and the near map leaves him out. High (the fine map holds everything) is
  unchanged.
- **Shadows come loose from their casters** (peter-panning: a lit band under the balcony on the wall, 40–50 cm tall
  on Handheld; the feet of walls and posts): the near map's bias and normal offset (shadows.js `NEAR_CASCADE`) from
  2.3 and 3.2 texels to 1 and 1.6. The normal offset keeps the grazing faces clean: at a 12° sun acne stays at
  0.18 % at worst (Handheld's stair, under the 0.2 % limit); at 6° the Handheld's terrace has 0.76 % (0.21 % before)
  in exchange for its leaks (6 % → 1.5 %) and the off-screen casters' shadows it lost (22 % → 6 %).

**Cost** (renderFrame, the Mac, the median of 4 × 40 frames, the hero map off and on, interleaved): the Signal
Market's start, Steam Deck 5.45 → 5.85 ms of CPU (+9 draws, +20 k triangles), Handheld 4.75 → 4.95 ms (+10, +14 k);
Edena's start, Deck 4.75 → 4.95, Handheld 4.45 → 4.70 (+9–10 draws). About 0.2–0.4 ms on the Mac's main thread,
so roughly 0.5–1 ms on the Deck's: the price of his shadow, every frame. The bias change costs nothing; High and the
Xbox preset don't draw the hero map.

**Left as they are** (the room shows them; none is a regression): on High the fine map's edge ~11 m from him still
pops thin shadows in and out (a 2 cm pole's shadow is the fine map's alone: seams 3–10 % of the fade band's probes);
at a low sun, thin long shadows seen from 30–40 m fade out as the lookup widens to the pixel (the boards' posts at
12°: the props spot's leaks on High); the Handheld's balcony keeps 25 % of its contact probes lit (a 16 cm texel);
the 2 cm fence and the 3 cm grate shimmer a little as the near window steps (sub-texel rasterisation, 0.04 % a frame).
`tests/shadow-room.test.js`, `tests/shadow-qc.test.js`, `tests/shadows.test.js` (the hero map, `NEAR_CASCADE`).

**v1.87, 2026-10-20** (main `3da6e2539`, the Mac M4 Pro, headless Chrome on the GPU, load 27–29; High, Steam Deck and
Handheld at 35° and 12°; docs/audits/shadow-v1.87.md): 52 of 60 spots green, the same eight reds at the same readings
within 1–2 points (the High props at 12° leak 9.5 %, the Handheld balcony 23.3 %); #492's near map every frame changed
none of them; his shadow drawn 86–100 %, spill 0–36 %, gap 0–3 cm.

**v1.85, 2026-10-18** (main `8f01feae5`, the Mac M4 Pro, headless Chrome on the GPU, load 23–27; High, Steam Deck and
Handheld at 35° and 12°; docs/audits/shadow-v1.85.md): 52 of 60 spots green, the same eight reds as v1.66 at the same
readings within 1–2 points (the High props at 12° leak 9.9 %, the Handheld balcony 24.7 %), his shadow drawn 86–100 %,
spill 1–36 %, gap 0–4.5 cm.

**v1.66, 2026-10-13** (main `0949c08a`, the Mac M4 Pro, headless Chrome on the GPU, a shared machine at load 6–70;
High, Steam Deck and Handheld at 35° and 12°; docs/audits/shadow-v1.66.md): 52 of 60 spots green, his shadow as above
on every preset (drawn 88–93 %, spill 12–17 %, gap 0–4 cm). The reds are the ones listed here: the poles' seams on
High at 35° (10.7 %), the far props, arch and stair pops on High at 12°, the far props on the Deck at 12° (with 2.8 %
of casters off screen, a quick turn by the boards), the balcony on Handheld at 35° (23 %), his spill by the poles and
1.2 % off screen on the stair on Handheld at 12°.

## The ship's rooms, shimmering (v1.71, issue #325)

The author: "I see a lot of textures shimmering in my ship." Two causes, both fixed where they start:

- **Hatching in a room that is always in shade.** The rooms are inside the hull's shadow, so every wall, the ceiling,
  the floor and the furniture carried the print preset's hatching, strokes 2-4 px apart close up (`uHatchSpacing` 3.6
  × 0.78 near the eye, then the powers of two of `strokes`): right at `HATCH_AA`'s edge, crawling and beating under the
  pixels as you walked. The rooms' materials (`src/ship/model.js` `INTERIOR`) already had a little self-light "to keep
  them from going to hatching"; it never did. Their shade was made a flat tone (`hatch: 0`); since v1.73 (issue #322's
  second look: that lost the shade the author found helpful) they keep their hatching with its strokes never closer
  than `SHIP_ROOM_HATCH_PX` (5 px, `makeMaterial({ hatchPx })`, materials.js `uHatchPx`): 5-10 px apart, clear of
  `HATCH_AA`'s band. The hull outside keeps the world's strokes.
- **Z-fighting aboard.** The ship is built by main.js, not by a level, so the z-fight audit never saw it:
  `node scripts/zfight/audit.mjs --ship` builds it alone. 12 sites, 7 m² → none: the bunk alcove's hood in the arched
  front's plane and between its cheeks (the white patches over the opening), the doorways' trims in their jambs, the
  console's kick band under its locker, the sofa's cushions in its arms, the cockpit bulkhead's underside in the
  ceiling. `tests/zfight.test.js` holds the ship at none.
- The crease shading's grain (issue #322, above) was the third, in every room.

Measured (muted headless Chrome, High, 1280 × 720, the camera pinned at six close views aboard, then moved 2 mm to the
side: the share of pixels changing by more than a step): the bunk's alcove 3.3 → 1.9 %, the cockpit bulkhead 3.8 →
2.4 %; the other views (the doorway, the console, the sofa, the main room) 1.4-1.9 % before and after, their ink lines'
own steps.

## The bird's wings, shimmering from the saddle (v1.85, issue #489)

The author: "In Vael, the bird shimmers when flying (when I'm riding it)." Her wings are rows of thin feathers
stacked a few millimetres apart (src/bird.js `buildBird`), and every third one was another tone (the primaries
`flight` / `featherWhite`, the secondaries `featherWhite` / `cover`, the secondaries all in one plane besides). Each
change of tone is a colour edge the ink pass draws (post.js `inkLines`' albedo boundary; Unity's Composite.shader the
same), so from the riding camera (13 m back, nearly level with the wings) each wing was a bundle of lines one or two
pixels apart, and as it beat they came and went frame to frame. Not the cause, each checked: the camera against the
bird (steady to half a pixel with the step wobbled 1/60-1/30 s), the bird's own cast shadow, the gaps in interior
lines anchored in the world, the feathers' spacing in depth.

The tones now go by row (primaries one, secondaries one, coverts one): no two feathers of different tones lie within
`WING_TONE_GAP` (1 cm) of each other, so only a few row boundaries are inked (`tests/bird-wing-tones.test.js`). The
tail's fan keeps its alternate tones: from the saddle it lies open, each feather several pixels wide. Measured (muted
headless Chrome, Medium, 1280 × 720, Vael, gliding ridden, the game stepped 1/60 s a frame, 30 frames): pixels inside
the bird that jump over 20 levels and straight back, 597 → 345 per 10 000 a frame (the wings held still: 23).

## Crease shading back, spot blacks gone (v1.73, issue #322)

The author, after #322 and #325: "I don't like what we did here, we removed the shadows which were helpful, but we kept
the botched dark patterns which I wanted to remove." His crops: irregular dark patches with torn, wobbly edges under the
ship's bunk arch and along the desert shop's wall-ceiling corner. Toggled in the running game at those views (muted
headless Chrome, High, 1280 × 720, the camera pinned): the patches went with the spot blacks' pocket term alone
(`uSpot.z` past any enclosure, cast-shadow darkening kept), and with nothing else. So:

- **The spot blacks are gone**, web and Unity (`enclosure`, `spotLoop`, `planeNear`, `SPOT_FRAME`, `SPOT_SWELL`,
  `SPOT_POCKET`, `SPOT_PAST` and their JS mirrors; Composite.shader's `enclosure`). A hard threshold of a screen-space
  enclosure drew a hard-edged mass wherever a pocket's estimate crossed it, and its edge followed the taps' copies of
  every edge nearby: torn and wobbly. What is left of the tier is the cast shadows' darkening toward the world's
  darkest tone (`uSpot.x` × `uSpot.w`, compiled in only where `w` > 0: `INK_SPOT`, `HIRAETH_INK_SPOT`); `uSpot.y` and
  `.z` are unused. Debug 9 now shows the crease shading's occlusion, 10 the cast darkening.
- **The crease shading is back** (`creaseAO`, `uAO`, the print's `uCrevice`, the Market's 0.4; `ao` in the graphics
  presets: on for Auto, High, Medium, the Deck and the Xbox, off on Low and Handheld), its grain fixed. Its eight taps
  were turned by a per-pixel random angle: a grey speckle along every wall's foot that crawled as the camera moved.
  Taps fixed on the screen instead (tried first: twelve on one spiral) drew a row of faint copies of every edge in front
  of a surface (a rail across the ship's ceiling, three or four parallel ghosts). Now (`CREASE`, `CREASE_TAPS`): one
  golden-angle spiral of 48 taps, shared out over the pixel's 2 × 2 quad (12 each, lane = x + 2y in the quad), each
  weighing 1 − 0.6 r² by how far out it lies, and the four lanes' results averaged over the quad from the derivatives
  (`quadMean`, taken at the top of `main` where the control flow is uniform). Every quad asks the same places, so the
  shading is a smooth function of where a pixel lies: a soft falloff from a corner or under a rail, no speckle, no
  crawl. The cost is the old one (12 taps a pixel against 8, the spot blacks' 8 and their looks past people gone).
  The Unity port's Composite.shader takes the same spiral, lanes, weights and quad mean (`ddx`, `ddy`).
- **The ship's rooms keep their hatching**, coarser (above, "The ship's rooms, shimmering"); the z-fight fixes stay.

Checked against the author's two crops and six more views (the ship's main room, the shop from the door, Qanat's
tree stairs, the desert's cave, the Buried Machine's crowd, the Signal Market's street): changelog v1.73.
`tests/occlusion-taps.test.js` holds the crease shading's taps stable and the spot blacks gone; `tests/zfight.test.js`
the rooms' strokes clear of `HATCH_AA`.

### Audit surface repairs (October 2026, #602)

The Aerie frames extend 8 cm into their terrace, and the Lamp-House apron ends 4 cm below the drum sill so each join has one visible owner. The City-Shaft spire cap ends inside the palace plinth. Buried city blocks and tower tiers omit upward triangles only where the entire triangle lies inside the enclosing slab; exposed edges, bottom faces and side walls remain. These geometry changes are shared by WebGL and Unity, without depth bias or a shader exception. The original audit used grazing diagnostic views; it did not establish how often high city caps occur on ordinary routes.

The focused repeat found zero coplanar sites in the Aerie and Lamp-House, down from their previous test ceilings of three and one. Other temples retain their own measured baselines.
