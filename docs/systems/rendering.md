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
  Signal Market's billboard faces (the world's and the views'), 0.7 / 0.67; glass by default.
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

- **Layers by depth** (`uHazeLayers`: first distance, each layer's distance over the last's, each
  layer's veil, how many; `uHazeTone`: their colour, and how much of it over the far haze's): past
  the first distance every layer k times farther veils a little more, `1 − (1 − a)^layers`, flat
  inside a layer with a soft ramp (`HAZE.edge`, a fifth of a layer) before each step. Things at
  different depths (trunks, towers, ridges) fall into separate pale planes; open ground shows soft
  bands that move with you, never a hard edge (no shimmer). Applied before the far fog, thinner at
  night; the ink lines take `HAZE.lineFade` of it at their nearest surface.
- **Fog by height** (`uHeightFog`: the height it thickens under, its scale height, density there, its
  most; `uHeightFogTone`): a density growing exponentially below a height, integrated along each ray
  (closed form: no loop), so a view down a shaft fades into it while a view across or up stays clear;
  over the far fog, the lines veiled too.
- **Set** (looks, so the views carry them): Lorn II `DEEP_WOOD_HAZE` (layers from 25 m × 1.7, a cool
  violet-blue, a low mist under 1.5 m) and its views; the desert `DUNE_HAZE` (from 250 m × 1.9, the far
  haze's warm colour; the desert views' from 120 m); the Signal Market `MARKET_HAZE` (from 90 m × 1.8,
  pale warm) and its views; Vael II `SKY_STONES_HAZE` (light, from 200 m) and its views; the City-Shaft
  `SHAFT_FOG` (thickening under the pit's middle, 0 m, scale 120 m, pale blue) and the shaft views'
  `SHAFT_VIEW_FOG` (under −40 m). Every preset lists them off (`hazeOff`).
- **Cost**: a log2, a pow and three exps per pixel, behind uniform switches (none where a world sets
  none); measured with the rest below ("Cost of the ink pass's three").
- `tests/ink-pass.test.js`: the JS twins (`hazeLayers`, `heightFog`): stepped, monotonic, continuous,
  thicker looking down; every preset says them; the worlds and views set theirs.
