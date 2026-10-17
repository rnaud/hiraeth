# Performance

Quality presets, culling, levels of detail, phone rendering, hand-overs and loads without a hitch. Older handheld measurements: docs/archive/retroid-measurements.md.

## Phone rendering

The old mobile Auto setting could fall to 0.5× of the capped device pixel
ratio: on a 3× phone that meant just one rendered pixel per CSS pixel. Ink
edges were then drawn from a nearest-filtered G-buffer without final
antialiasing. Mobile Auto now starts at 1×, uses a 0.75× floor and targets
roughly 30 fps. All quality levels composite at their own resolution and use
FXAA on the final colour before scaling to the display (the Handheld preset SMAA: docs/systems/rendering.md, "Far
lines that would alias"; +0.05-0.18 ms on the Mac at the Retroid's render size). Sky dots are spaced
farther apart and fade at low pixel density. High remains available in
Settings for a fixed full-resolution image on HiDPI phones.

## Performance

- **Background collision:** the collision BVH is built in a web worker.
  The game code itself takes about 0.5 s to load a world.
- **City grouping:** the city's merged town is grouped per terrace level, so
  whole levels can be culled.
- **Distance detail:** trees and roofs far above or below the camera are
  hidden, and trees stay out of the far shadow pass. That cut about 20–40%
  of the triangles per frame.

- **Auto quality** (the default on touch devices): if the frame rate stays
  under 28 fps on touch devices (40 fps on desktop) for about 3 s, the
  resolution drops in steps, down to 0.75× on touch or 0.5× on desktop;
  it climbs back when there's headroom. The current scale shows next to the
  fps counter.
- **Low detail** (Low, or Auto on touch or once it has had to drop): no
  crease shading, no cloud shadows, the near shadow cascade at half rate, and
  villagers' capes simulated only up close.

`src/perf.js` splits the terrain and the big scattered-prop sets into
260 m tiles. Each pass (the view and the three shadow cascades) then draws
only what it can see, and small props are skipped in the far cascade. That
cut the desert from about 13 M to 1 M triangles a frame.

## Steady shadows, view culling and the Handheld preset (v0.38)
- **Shadows** (`src/shadows.js`): each cascade is a `Cascade` whose centre snaps to its
  shadow-map texel grid in light space, with a fixed size and a quantised sun direction,
  so shadows no longer swim as the camera moves. The maps are depth textures with
  hardware comparison (`sampler2DShadow`), and the filter widens to the pixel's footprint.
  Bias and normal offset are set in texels per cascade.
- **Culling** (`src/perf.js`, `shadows.js`): `fitBounds` gives instanced meshes real bounds
  so they cull (not the rewritten-every-frame ones, `userData.dynamic` or dynamic usage, nor a
  pool with nothing placed yet); `ShadowCuller` skips casters whose shadows can't reach the view;
  `SmallCuller` drops props by projected size; `RoomCuller` hides off-map rooms (ship,
  caves) unless the camera is near. Draw calls fall 10–36% across the worlds.
- **Graphics presets** (`QUALITY_PRESETS`, `resolveQuality`, `detectHandheld` in
  `perf.js`): Handheld (75% resolution with dynamic scaling, no fine cascade, 4-tap shadows,
  no crease shading or cloud shadows, shorter crowd and prop ranges, a lighter ink pass)
  is chosen by Auto on Android and mobile GPUs. The F readout shows ms (CPU and GPU where
  the browser allows), render scale, draw calls and triangles.
- Known: on desktop Metal (ANGLE), Lorn II and the Buried Machine run about 1 ms slower
  per frame than before despite fewer draws (still over 200 fps here); the desert and the
  City-Shaft are about 1 ms faster.

## Rooms off the map draw only themselves (`InteriorCuller`, `src/perf.js`)
The desert's cave was the one place the Retroid stuttered in every engine (GPU 96–99 % busy, a small
room). The cause: the rooms reached through portals are built a kilometre or more over the map, and from
in there the camera's frustum (5 km deep, looking level or a little down) takes in the desert below.
Behind the cave's walls the game still drew it: in the passage 344 draws and 0.37 M triangles of terrain,
city and flora, more than the open dunes draw in all (0.27 M). The 110 terrain tiles came first (their
material sorts before the cave's), ~2 km away at under a quarter of a pixel a metre: 0.27 M triangles
smaller than a pixel, each set up and shaded (in 2 × 2 quads) before the cave covered them. An Apple GPU
hides most of that (hidden-surface removal); the handheld's Adreno doesn't.

- **The fix** (all worlds): while the camera is inside a room off the map (`offMapRooms` in `main.js`:
  portal destinations 200 m over the ground), `InteriorCuller` hides every mesh, point cloud and line whose
  bounds don't reach the room, in every pass of that frame, then shows them again. A room's extent is found
  once: the static meshes within 60 m of its door that stand 150 m clear of the ground, grown by 30 m at a
  time (a temple's rooms in a row). The traveller, the drone and whoever is in the room stay; people, mounts
  and anything left outside are hidden. Rooms only open onto the sky (oculi, door veils, windows over a
  kilometre of air), so the picture is unchanged (screenshots of every room, both ways, with and without).
- **What is left unculled** (`frustumCulled = false`: drawn wherever it is, its bounds not kept) is
  never judged by its cached bounds. The fluid's rings, spray and glow are instanced meshes, empty at load,
  so their cached bounds were empty and the first version hid them in every room: the push's shock front
  (and every splash's ring) was gone in the temples, the cave and the Hearth. Now an unculled instanced
  mesh is measured where its instances are that frame (a set over 512 instances, every 16th frame; an empty
  one draws nothing anyway), and anything else unculled (the hose, the splats, flames) always stays.
  (`tests/interior-cull.test.js`)
- **In the cave**: 425 → 87 draws and 0.47 → 0.09 M triangles (Handheld; High 577 → 118, 0.57 → 0.13 M).
  The passage's walls now go first into the cave's batches, so they hide the dome's far side instead of
  being painted over it (fragments shaded in the G-buffer: 1.84 → 1.18 a pixel in the passage, 1.60 → 1.25
  in the room, against 0.92 on the dunes). The fluid's lava (the pool, the stream, the tank) sums its blobs
  tone by tone instead of into a local array indexed at run time (slow scratch memory on mobile GPUs; the
  same picture, bit for bit), and the sun's sparkle pass no longer runs full-screen for the magic pool,
  which has no glints to draw.
- **Elsewhere** (`rooms.mjs`, Handheld, draws and triangles a frame, looking in from the door / back out
  through it): every temple and chamber off the map gains, most where the world below fills the view. The
  Hearth's hall 91 → 73 / 321 → 59 draws (445 → 63 k triangles looking out); the masked head's chamber
  99 → 65 / 80 → 63; Edena's room 134 → 76 / 95 → 66; the temples 3–25 % fewer draws and 1–45 % fewer
  triangles (the Rose House 212 → 195 / 82 → 65 draws, 202 → 134 / 153 → 86 k triangles; the Aerie
  252 → 203 / 107 → 63; the Hush-House 226 → 216 / 93 → 66). The ship parked on the dunes and the houses at
  home stand on the map, with windows and an open hatch: what's outside is really seen there, so they keep
  drawing it.
- **On the Mac** (M4 Pro, Metal, 1280 × 720, `web-bench.mjs`): Handheld, the cave 3.0 → 2.1 ms a frame
  (GPU 1.70 → 1.06 ms) against the dunes' 2.5–2.8 (GPU 1.4–1.5); High, 3.4 → 2.3 ms (GPU 4.6 → 3.2) against
  3.3–3.6. With the GPU the bottleneck and its hidden-surface removal defeated (`passes.mjs --scale 3
  --nohsr 1`, culling on and off in turns): the passage 14.9 → 11.6 ms, the room with the pool full
  14.2 → 11.0, against the dunes' 16–17.

To measure: `node scripts/bench/passes.mjs --url http://localhost:<port>/ --preset handheld --only
cave,cave-room,cave-pool,dunes [--wet 1] [--scale 3 --nohsr 1] [--toggles base,noInterior,noShadow,…]
[--eval snippet.js]` (each `renderer.render()` timed with the GPU timer, which on Metal mostly measures its
own overhead, then the A/B toggles in turns; `--nohsr` adds a never-taken `discard` to every surface shader
so an Apple GPU shades in draw order like the Adreno); `node scripts/bench/rooms.mjs --url … --shots dir`
for every world's rooms off the map, culled and not. Tests: `tests/interior-cull.test.js`.

## Levels of detail far away (`src/lod.js`, `src/lod-core.js`)
A distant building, rock or plant is drawn with a coarser copy of itself, never coarser than the
Graphics preset allows on screen (`lodPx` in `QUALITY_PRESETS`: 1 px for Auto, Medium and High,
1.5 for Low, 2 for Handheld; High's 1.5× resolution makes it finer, dynamic resolution coarser).
- **The copies** (`simplify`; the clustering itself, on plain arrays, in `lod-core.js`): vertex
  clustering on a grid. Every vertex in a cell moves to one point, where it best fits the planes
  of the triangles round it (a quadric: corners and edges stay put); a triangle left with two
  corners in one cell goes. So that nothing shows: nothing merges across separate pieces (a
  decal stays on the ground, a bench's legs under its seat); normals (26 directions), colours
  and the shaders' own attributes are never blended; a point where two colours meet keeps its
  place (colour edges are inked); a face that would turn over keeps its corners; long thin parts
  (poles, cables, antennas, limbs) only thin out along their length, by cell and by eighths round
  their own centre, both ends kept; the tiles of one mesh (`tileScene`) keep their shared border.
  The error stays under a cell, so a level whose cell is under `lodPx` pixels looks the same,
  outline included.
- **Choosing** (`LodManager`, `pickLevel`): every static mesh worth it (merged blocks and kits,
  rocks, instanced props; never the terrain, which is dug into, nor people, vehicles or anything
  that moves) has levels whose cells double, 2^j of its own units. Each frame, before the passes,
  its distance (to its bounding sphere) gives the cell that fits and the mesh swaps its geometry
  for the coarsest ready level under it: no extra objects or draw calls; instances, materials,
  visibility and bounds untouched. A level holds until the distance is ~10 % past its band either
  way (no flicker on the edge). It is built the first time it is wanted, in a web worker
  (`lod-worker.js`, 7 kB), two at a time; until then the finer one draws. A level that would keep
  more than 80 % of the triangles isn't kept.
- **Shadows**: in the far cascade's pass each mesh goes at least down to the map's texel (1.1 m):
  what the map can't resolve it doesn't need (`shadowPass` / `viewPass`).
- **Sets that sort their own instances**: flora draws its far cells from a second mesh with a
  coarser copy of the plant (`farLevel`, at most 55 % of the triangles); the crowd's far figures,
  past the same rule, become a distant figure simplified to 0.1 m (cape and robe, which the
  shader shapes, as they are); the desert's smoke column swaps its puffs for 80-face ones once
  their facets are under `lodPx` (`sphereError`). The ship's smoke, flame and dust pools (490
  balls of 180 triangles, drawn in every world) are hidden while none is alive.
- **Collision is untouched**: the physics was baked from the full meshes at load, and a level
  points back at its source (`userData.lodSource`), which `physics.js` bakes instead.

Measured in headless Chrome (Metal, 1600×900 at render scale 1) from four fixed views per world:
at the spawn, 12 m up looking back, 120 m up over the widest vista, 400 m up looking down on the
world. Millions of triangles summed over the four views, before (build `4d23384`) and after:

| World | Medium, all passes | Medium, the view | Handheld, all passes | Handheld, the view | Handheld, the view from 400 m up | Draw calls, Handheld |
|---|---|---|---|---|---|---|
| Desert | 4.07 → 3.75 (−8 %) | 2.50 → 2.23 (−11 %) | 3.00 → 2.66 (−11 %) | 2.38 → 2.09 (−12 %) | 0.44 → 0.37 (−17 %) | 1780 → 1772 |
| City-Shaft | 9.61 → 8.66 (−10 %) | 5.03 → 4.39 (−13 %) | 5.69 → 4.73 (−17 %) | 3.99 → 3.31 (−17 %) | 1.83 → 1.51 (−18 %) | 3104 → 3093 |
| Hangar | 2.43 → 1.92 (−21 %) | 1.18 → 0.78 (−34 %) | 1.60 → 1.10 (−31 %) | 1.15 → 0.73 (−36 %) | 0.35 → 0.21 (−40 %) | 1375 → 1365 |
| Vael | 2.46 → 2.06 (−16 %) | 1.39 → 1.02 (−26 %) | 1.73 → 1.33 (−23 %) | 1.33 → 0.96 (−28 %) | 0.30 → 0.20 (−34 %) | 1350 → 1338 |
| Vael II | 3.87 → 3.42 (−12 %) | 2.14 → 1.75 (−18 %) | 2.47 → 1.99 (−19 %) | 1.88 → 1.44 (−23 %) | 0.44 → 0.32 (−28 %) | 1318 → 1306 |
| Viridel | 3.24 → 2.81 (−13 %) | 1.68 → 1.31 (−22 %) | 2.19 → 1.77 (−19 %) | 1.63 → 1.25 (−23 %) | 0.38 → 0.27 (−29 %) | 1565 → 1553 |
| Lorn | 2.92 → 2.50 (−15 %) | 1.47 → 1.09 (−26 %) | 1.98 → 1.56 (−21 %) | 1.43 → 1.04 (−27 %) | 0.32 → 0.20 (−36 %) | 1624 → 1613 |
| Lorn II | 7.38 → 6.93 (−6 %) | 2.39 → 2.02 (−16 %) | 3.57 → 3.13 (−12 %) | 2.04 → 1.66 (−19 %) | 0.48 → 0.37 (−23 %) | 1220 → 1201 |
| Buried Machine | 3.76 → 3.30 (−12 %) | 2.09 → 1.70 (−18 %) | 2.70 → 2.25 (−17 %) | 2.06 → 1.66 (−19 %) | 0.54 → 0.41 (−23 %) | 1348 → 1336 |
| Spheres | 5.17 → 4.71 (−9 %) | 2.53 → 2.15 (−15 %) | 2.92 → 2.48 (−15 %) | 2.04 → 1.65 (−19 %) | 0.41 → 0.31 (−25 %) | 1505 → 1488 |
| Bazaar | 3.83 → 3.13 (−18 %) | 2.35 → 1.81 (−23 %) | 2.28 → 1.63 (−28 %) | 1.78 → 1.24 (−30 %) | 0.49 → 0.32 (−36 %) | 1303 → 1284 |
| All | 48.72 → 43.18 (−11 %) | 24.75 → 20.27 (−18 %) | 30.11 → 24.64 (−18 %) | 21.72 → 17.04 (−22 %) | | |

Of that, the idle puff pools are about 0.35 M per world (88 k in every view); the levels
themselves, measured in one page with `lodPx` off and on, take 4 % (Medium) to 6 % (Handheld) of
all triangles, 7 to 10 % in the widest views, up to 17 % in the Bazaar and 11 % in the Hangar and
City-Shaft. Most of what's left far away is already as plain as it can be at a pixel or two
(boxes, long extruded rings, the people's 12.5 k-triangle skinned bodies, which are not touched).
Draw calls don't change (the puffs: three fewer).

Frame time on this Mac doesn't move (the same-page A/B is within ±0.5 ms): it is bound by draw
calls and fill, not triangles. Where vertices do cost it shows: in SwiftShader (software
rendering, so vertex work is CPU time; 480×360, Handheld) the City-Shaft from 400 m up went from
467–496 to 347–373 ms a frame, the Hangar from 110–129 to 66–72, the Bazaar from 99–132 to 71–81,
the desert vista from 119–135 to 109–115 (two runs each; nearer views gain 5–20 %). The handheld's
GPU sits between the two (the near shadow map was 7 of 29 ms on the City-Shaft's bottom terrace,
1.6 M triangles), so the Retroid should gain on the wide views; not yet measured there.
Screenshots of every view with the levels off and on differ in at most 0.10 % of the pixels on
Handheld and 0.07 % on Medium: single pixels of distant people and thin lines; no holes, no
popping (the tests check bounds, outline rays, closed shapes staying closed, no turned faces,
rods and seams, hysteresis, and that the collision is the same).

Tried and left out, for not paying:
- **Merged shadow casters** (every static caster of a 96 m region drawn as one mesh in the near
  and far passes): the City-Shaft's high view went from 767 to 564 draw calls in the near pass and
  412 to 222 in the far one, but the frame time didn't move (shadow draws share one material and
  are cheap), and at ground level the regions drew more triangles than the culled members did.
- **Cheaper far shading**: switching every material's drawn detail off (glyphs, grids, patterns,
  creases, folds, scrub, ripples) everywhere saved 0–0.3 ms, within the noise; far objects cover
  few pixels, so far-only would save less still.
- **Impostors** for the farthest landmarks: what's left far away is draw calls and the ink pass,
  which a card wouldn't remove, and a card can't keep the ink outline steady as the view turns.

## Hand-overs and loads without a hitch (October 2026)

From the author's notes (TODO.md, "Transitions and moments"). Measured with `scripts/transition-perf/`
(headless Chrome on ANGLE Metal, muted, the game's sound at 0; see the scripts' headers).
Tests: `tests/passage.test.js`, `tests/load-steps.test.js`.

**Doors, caves and portals** (`src/passage.js`). Every way into another space goes through one
hand-over: the doorways, cave mouths, temple doors and Viridel's hatch (`level.portals`, main.js),
the Lab's doors and the Hangar's portals (their levels call `ctx.passage.go`). It used to be a hard
cut: the traveller landed at a dead stop (`teleport` zeroes the velocity), the heading jumped (the
locomotion layer read it as a turn: a bank and a pivot), the feet let go, and the camera was snapped
in to 2 m and eased back out over a second (`rig._curDist = 2`). Now:
- **ahead of time**, the destination is drawn once, unseen (`WarmDraw`): every mesh round each way
  through (and the ship's cabins, and what the first frame sees) into 4 × 4 targets of the real
  passes' formats (the G-buffer's, a shadow map's), so its geometry and textures are on the GPU and
  the driver has built its pipelines (a mobile GLES driver compiles a shader for real only at its
  first draw). A batch is drawn as the children of a scene of its own (shared, not moved), so a
  draw costs the batch, not a walk over the world. At load for every destination (what the first
  frame sees first, then round the traveller, the ship, the destinations; at most `PASSAGE.loadBudget`,
  8 s: the Xbox as an App spent 159 s on 2472 meshes, docs/systems/xbox.md "The slow load"); as you come
  within `PASSAGE.near` of a way through, anything new there, a slice a frame. Every program's first
  use (three's `getUniforms`: a wait on the GPU process, 100-250 ms behind a busy GPU) is done at
  load too.
- **the cover** (`PassageCover`): a sheet of paper with a ragged inked edge sweeps across the screen
  (0.22 s), a CSS transform transition, so the compositor keeps it moving through a long frame;
  the page sound plays with it.
- **the move**, behind it (`carryAcross`): one rigid transform from where you stand, facing the way
  you face, to the arrival, facing its way (`passageTransform`; a portal into another gravity turns
  up too). The velocity turns with you (or the portal's own speed), the animation's memory of the
  heading (`_lastHeading`, `loco.lastHeading`), the steering and the gear's last velocity turn too,
  `onGround` is kept, the planted feet, a step under way and the hands' swing are carried, and the
  camera keeps its place behind you, its look, its lag and its angle off your back; it finds the new
  walls on its next frame, still covered.
- **a few frames held** (at least `PASSAGE.holdMin`, at most `holdMax`) while the new place settles:
  its grass's new patch placed (`Grass.placing`) and two frames in a row back to pace (`calmDt`: the
  first frames there, its levels of detail switching, are the slow ones, and stay under the paper);
  then the sheet sweeps on, off the far side.
- Stepping into the ship or a house (no move: the rooms are real), the camera's indoor framing used
  to set the pitch level in one frame; it eases there now (`CameraRig._levelTo`).

| worst frame, ms (frames over 33 ms) | High | after | Handheld, CPU ×4 | after | High, no vsync | after |
|---|---|---|---|---|---|---|
| Desert: the carved doorway, in | 17 | 17 | 50 (13 > 33) | 33 (0 > 33) | 8 | 9 |
| Desert: the doorway, out | 17 | 17 | 83 (17 > 33) | 33 (1 > 33) | 31 | 12 |
| Desert: the giant's mouth (cave), in | 33 | 33 | 67 (29 > 33) | 34 (10 > 33) | 9 | 12 |
| Desert: the cave, out | 17 | 17 | 67 (19 > 33) | 33 (1 > 33) | 112 | 17 |
| Desert: the Givers' Hearth, in | 17 | 17 | 34 (14 > 33) | 33 (9 > 33) | 8 | 12 |
| Desert: the Hearth, out | 33 | 17 | 50 (29 > 33) | 33 (27 > 33) | 9 | 12 |
| Desert: the Rose House (temple), in | 17 | 17 | 33 (7 > 33) | 33 (10 > 33) | 7 | 10 |
| Desert: the temple, out | 17 | 17 | 50 (9 > 33) | 33 (24 > 33) | 32 | 33 |
| Desert: boarding the ship | 33 | 83 | 67 (21 > 33) | 83 (44 > 33) | 11 | 14 |
| Desert: leaving the ship | 33 | 50 | 67 (77 > 33) | 67 (91 > 33) | 10 | 12 |
| City-Shaft: the makers' tower, in | 17 | 67 | 67 (17 > 33) | 50 (10 > 33) | 10 | 11 |
| City-Shaft: the tower, out | 34 | 33 | 67 (18 > 33) | 100 (36 > 33) | 153 | 43 |
| Viridel: the crashed ship's hatch, in | 33 | 17 | 50 (11 > 33) | 50 (2 > 33) | 9 | 10 |
| Viridel: the hatch, out | 33 | 17 | 50 (6 > 33) | 50 (10 > 33) | 175 | 15 |
| Lab: a door to a room | 83 | 17 | 250 (11 > 33) | 117 (3 > 33) | 104 | 19 |
| Lab: back to the hub | 17 | 33 | 83 (14 > 33) | 67 (13 > 33) | 121 | 26 |
| Lab: another room | 17 | 17 | 150 (16 > 33) | 67 (8 > 33) | 40 | 14 |
| Home: into the small house | 17 | 17 | 50 (14 > 33) | 50 (6 > 33) | 10 | 28 |
| Home: out of it | 17 | 33 | 50 (1 > 33) | 83 (19 > 33) | 23 | 28 |
| Hangar: a portal into the upside-down | 17 | 17 | 17 (0 > 33) | 17 (0 > 33) | 10 | 10 |
| Lorn: the Hush-House, in | 17 | 33 | 33 (3 > 33) | 33 (2 > 33) | 76 | 13 |
| Lorn: the Hush-House, out | 17 | 33 | 33 (0 > 33) | 33 (2 > 33) | 90 | 15 |

Paced (vsync on, as in a player's browser), High on this Mac had little to win on frame time: a
single 33-83 ms frame here and there in either column came from other work on the machine (runs
repeated quietly give 16.8 ms throughout, before and after). The stalls show with no vsync, where a
wait on the GPU process waits for every queued frame (the first use of a program: 100-175 ms) and on
the handheld recipe with the CPU slowed four times; the slowest frame after is the move itself, under
the paper.

The traveller now lands still walking: 3.8 m/s before the door and 3.8 after it (0 before), the
camera 3.5-4 m behind (it was snapped to 2.8 m and drawn back out over a second).

**Loading** (`src/load-steps.js`). A world's build was one long task after another: in the desert (on High, the
shipped bundle) the people 1.0 s, the terrain and city 840 ms, the modules' own start 820 ms; in the
City-Shaft the check for trees inside houses 5.8 s; the shader warm-up and the first frame a few
hundred ms more, and two to four times all that on the handheld recipe. The loading screen's pen turns on the compositor (a CSS transform animation: checked
through a 900 ms task with a screencast, `loading.mjs --pen`), but nothing else could happen. Now
a build is a generator: `yield` between its parts and in its long loops, `runSteps` straight
through (tests, the studio), `runStepsAsync(gen, slicer())` a slice at a time in the game: the
main thread is given back once `LOAD_BUDGET` (24 ms) has run, by a `MessageChannel` message (no
`setTimeout` clamping, no `scheduler.yield`: the Android WebView 109 lacks it).
- every level's `create` is `stepped(build)`: the build yields at its sections and once per pass of
  its top-level loops (`LEVELS[i].build`); `Terrain.make` and the dune relief yield by rows;
- `Physics.create(scene, base, slice)` bakes the collision a mesh a step and copies the triangles
  into one buffer by hand (`concatPositions`: what `mergeGeometries` made); the BVH is still built
  in its worker;
- `level.initSteps` (the City-Shaft's trees in houses, `dropBuriedInstancesSteps`), the buried
  flora, the crowd's placement (`buildPeopleSteps`) and its pool, the people (`spawnNPCsSteps`), the
  flora (`buildFloraSteps`, `Flora.make`: its far copies are simplifications), the responsive world
  (`ReactiveWorld.make`) and the scene's tiling (`tileSceneSteps`) go a piece at a time;
- the shader warm-up compiles one object per kind of program (its material and what of the mesh is
  in a program's key) between yields, against an empty scene for the key (no lights, fog or
  environment, as the world's own), then polls the driver (src/warm-shaders.js, shared with the title's
  world since v1.37, which had compiled and drawn its first frame in one task); the first frame's uploads (`WarmDraw`),
  the grass's first patch, the room culler and the levels of detail are done behind the loading
  screen, so the first frame is an ordinary one;
- the Lab's people (`labPeople()`) are worked out only when the Lab asks for them: every world paid
  ~70 ms for them as the modules loaded (the desert room's dune relief).

| longest task, ms (tasks over 50 ms), first frame at | High | after | Handheld, CPU ×4 | after |
|---|---|---|---|---|
| desert | 1003 (7 > 50), 19.2 s | 112 (9 > 50), 3.2 s | 1978 (8 > 50), 7.3 s | 486 (25 > 50), 10.5 s |
| incal | 5798 (6 > 50), 11.9 s | 96 (13 > 50), 9.6 s | 16060 (8 > 50), 22.7 s | 334 (43 > 50), 25.5 s |
| arzach | 305 (6 > 50), 3.0 s | 71 (6 > 50), 1.8 s | 633 (7 > 50), 3.2 s | 307 (12 > 50), 3.9 s |
| garage | 395 (6 > 50), 2.7 s | 87 (4 > 50), 1.7 s | 751 (9 > 50), 3.5 s | 234 (10 > 50), 3.3 s |
| edena | 426 (6 > 50), 2.7 s | 87 (7 > 50), 2.3 s | 977 (7 > 50), 4.9 s | 258 (15 > 50), 4.2 s |
| perdide | 353 (6 > 50), 2.8 s | 100 (7 > 50), 2.2 s | 729 (7 > 50), 3.2 s | 234 (14 > 50), 3.9 s |
| home | 190 (5 > 50), 1.5 s | 126 (5 > 50), 1.8 s | 644 (7 > 50), 2.8 s | 297 (14 > 50), 3.6 s |
| spheres | 309 (5 > 50), 1.5 s | 115 (8 > 50), 3.9 s | 1765 (9 > 50), 6.4 s | 311 (19 > 50), 6.2 s |
| buried | 444 (5 > 50), 1.5 s | 97 (6 > 50), 3.4 s | 1322 (7 > 50), 3.6 s | 306 (16 > 50), 6.7 s |
| lab | 489 (5 > 50), 2.8 s | 114 (5 > 50), 3.3 s | 1681 (8 > 50), 4.9 s | 319 (17 > 50), 6.6 s |

(The shipped bundle, `vite preview`; the first-frame times move by a second or more from run to run
with what else the machine is doing: repeated quietly, the Garden of Spheres 1.1-1.7 s before and
1.2-1.4 s after, the Buried Machine 1.1-1.4 s and 1.0-1.3 s.)

## The desert at Retina size: spot blacks and crease shading without branches (October 2026)

"Did we hurt performance? The desert at 40 fps on my Mac." A Mac's default is High, which on a
HiDPI screen renders at the display's own pixels: a full-screen 16" MacBook Pro window (1728 × 1117
CSS px) is 3456 × 2234, 7.7 M pixels through the G-buffer and the ink composite, 8.4× a 1280 × 720
frame. There a frame cost about 14-16 ms in Qanat's streets and the camps (just inside a 60 Hz
refresh, or 8 of 120 Hz ProMotion's), and the third feedback round's merges pushed it to 16-17 ms:
over the line, so the browser showed every frame for 25 ms instead of 16.7, the 40 fps the author
saw. At 1280 × 720 the same cost is under a millisecond, inside the noise, which is why each merge
measured "no change".

- **The culprit:** the spot blacks' enclosure (3330a4d, `post.js`), +1.0-2.3 ms at Retina size in
  the streets, camps and under the tree (a build with only that block compiled out came back to
  the baseline). Then the worn-by-time walls (755f51e, `materials.js` weatherInk and the composite's
  dust band) another +0.4-1.0 ms on walls. Nothing else between ce8b8c4 and 755f51e moved a view by
  more than the noise (the capes, the jump shadow, the boxes, the aliens: CPU time a frame the same,
  measured at 640 × 400).
- **Not the taps:** 4 taps cost what 8 did, an unrolled loop and a separate full-resolution or
  half-resolution pass (its own full-screen pass costs more than it saves at this size) didn't help.
  What did: no branch inside the loops (a tap on the sky, or on a grass blade for crease shading,
  weighs 0 instead of a `continue`: divergent skips inside a loop are slow on Apple's GPUs), the
  spot taps' directions as constants (no cos and sin per tap), the spot taps placed with the view
  ray (affine in uv for a perspective camera) instead of the inverse projection, and crease
  shading's spiral turned by one rotation per pixel instead of a cos and a sin per tap. The same
  estimates, the same picture: screenshots of the four views, the people and the wind held still,
  differ from main's only where flags, smoke and crowds move (as two runs of main differ).
- **Tests:** `tests/occlusion-taps.test.js` (the constant taps are the old formula's, no branch,
  cos or sin in the loops, the affine ray for off-centre cameras too, the rotation).

Synced frame time (each `renderFrame()` of 16, closed by a `readPixels`; median of 20, other agents'
Chrome and node jobs on the machine), High, 1728 × 1117 at DPR 2:

| ms | ce8b8c4 (before) | 63b130d (spot blacks) | 755f51e (+ worn walls) | this fix |
|---|---|---|---|---|
| arrival (by the ship) | 12.9 | 13.1 | 13.4 | 12.7 |
| Qanat's street, gate to tree | 14.4 | 16.1 | 17.1 | 15.6 |
| the camps | 13.9 | 14.9 | 15.3 | 14.2 |
| the dunes (quickest of 20) | 13.3 | 13.4 | 13.5 | 12.8 |
| under the tree (quickest of 20) | 12.1 | 13.0 | 13.6 | 12.8 |

At 1280 × 720 (High: 1.5×, 1920 × 1080) the street 7.7 → 8.9 → 8.2 ms and the camps 8.5 → 9.1 → 8.4.
The rest of the street's gap is the worn walls (a G-buffer cost on every wall pixel).

To measure: two or more builds side by side, each its own page, the idle ones held (their
`requestAnimationFrame` deferred) and the views timed in turns, so the machine's noise falls on all
of them alike: the A/B scripts of this pass (`pair.mjs`, `compare.mjs`) live in the agent's
scratchpad; the same approach as `scripts/bench/passes.mjs`' toggles, across builds.

## Every world at Retina size: baked screen noise, uniform arrays sent once (October 2026)

A pass over all twelve worlds and the ship, at each world's start, its two densest knots of people
and a wide view, on High and Handheld, at 1280 × 720 and at 1728 × 1117 CSS px with DPR 2. What a
Retina frame costs (in-page toggles, each timed between two base runs): the ink composite 5-9 ms of
13-17 (crease shading alone 1.6-3.4 ms in every world, the screen-fixed noise 1-2 ms, the paper,
the two ink kernels, the spot blacks, the sky about 0.5-1.5 ms each), the G-buffer 3-5 ms, FXAA
about 1 ms, the shadow maps under 1 ms of GPU; crowds, people and plants a few tenths. At 1280 × 720
the GPU and the CPU are about even (5-10 ms each), and the CPU is mostly three.js's draw loop.

- **The screen-fixed noise, baked** (since replaced: the paper is gone and the lines' noise is read on the
  view's direction from a small tiling texture, rendering.md "Nothing fixed to the screen"; what follows is
  the history) (`post.js` `SCREEN_NOISE`, `createPost().bakeNoise`): the ink
  lines' wobble (two value-noise lookups), their pressure and inner weight (two) and the paper's
  fibre, tooth and pits (six) depend only on the pixel and the frame's size, yet were worked out for
  every pixel of every frame. They are drawn once per size into two half-float textures (the lines',
  RGBA; the paper's, RG) and read back with a `texelFetch` each. Where the bake doesn't match the
  frame (`noiseKey`: size, pixel ratio, the handheld's lighter paper; a portrait drawn at another
  pixel ratio, a page that doesn't bake: the studio) or the lines boil (`uBoil`), the composite works
  them out as before. 1.0-1.9 ms less a frame at Retina size, 0.3-0.4 ms at 1080p; the picture the
  same but for ~0.01 % of pixels (single pixels where a paper pit or a wobble lands the other way:
  the hash behind the noise is chaotic, and two programs computing it round differently). Costs
  12 bytes a pixel of GPU memory (77 MB at 3456 × 2234, 14 MB on the Retroid).
- **Crease shading's grass test** only for a tap that would close something in (`creaseAO`):
  0.5-0.8 ms at Retina size, the same picture (max 1/255 off).
- **Uniform arrays sent once** (`perf.js` `cacheUniformArrays`): three.js keeps a single uniform's
  value per program but not an array's, so every material switch sent the light list (`uLights`)
  and the material's palette (`uPalette`) again, unchanged: 220-290 redundant GL calls a frame in
  busy worlds, each a round through Chrome's GPU process and ANGLE. The context's array uploads now
  skip values a location already has. The frame's CPU time (natural loop, small render scale) in
  the Garden of Spheres' crowd 13-15 → 8-11 ms, at Home 12.7 → 11.3 ms; the same picture.
- **The sand drifts' height** (`sand-drifts.js` `polyEdges`, `edgeDistance`): asked hundreds of
  times a frame (the wind's wisps follow the ground), its distance to each footprint now from edges
  worked out once (no `Math.hypot` and divisions per edge, the corner test squared): 0.68 → 0.34 ms
  of CPU a frame in Qanat's streets, the same field.
- **Tried, no gain:** crease shading's taps placed with the affine view ray (the same cost), its
  depth from a separate one-channel copy (the copy costs more than the taps save). Crease shading's
  cost is its random rotation per pixel: with one fixed rotation it costs a millisecond less (the
  taps hit the texture cache), but that is its pattern, so it stays.
- **Tests:** `tests/screen-noise.test.js` (baked once per size, ratio and mode, the target put back;
  read only when it matches; no screen noise left in `main()`; the bake and the composite share the
  noise code), `tests/uniform-arrays.test.js`, `tests/sand-drifts.test.js` (the fast distance and
  drift equal the old ones).

Before (main, a3663e8) → after, synced frame time in ms (each `renderFrame()` of 10, closed by a
`readPixels`; the two builds side by side, each view timed in turns, median of 6). The machine was
shared with other agents' GPU work all along (load average 12-75), so the absolute values run 1.2-1.8×
what an idle Mac gives; the pairs are what to read. Means over all views: High at Retina size 22.6 →
19.6 ms (-13 %), High at 1280 × 720 10.6 → 9.8 ms (-7 %), Handheld at Retina size 8.8 → 8.2 ms
(-8 %), Handheld at 1280 × 720 5.2 → 5.2 ms (bound by neither change on this Mac).

High, 1728 × 1117 at DPR 2 (3456 × 2234):

| world | start | busiest knot | second knot | wide | others |
|---|---|---|---|---|---|
| Desert | 19.0 → 16.4 | 21.3 → 19.5 | 25.2 → 21.1 | 19.5 → 16.1 | Qanat's street 27.5 → 24.5, in the ship 20.0 → 16.7 |
| City-Shaft | 27.3 → 24.4 | 23.6 → 20.9 | 20.5 → 18.3 | 23.6 → 22.1 |  |
| Signal Market | 27.1 → 22.4 | 42.0 → 32.3 | 24.4 → 19.8 | 22.5 → 19.7 |  |
| Vael | 24.4 → 19.8 | 20.4 → 19.7 | 21.9 → 19.8 | 21.5 → 18.6 |  |
| Vael II | 16.8 → 15.1 | 16.1 → 15.8 | 15.2 → 13.6 | 15.1 → 13.7 |  |
| Lorn | 26.4 → 22.6 | 20.8 → 18.6 | 22.1 → 19.8 | 20.1 → 18.9 |  |
| Lorn II | 34.5 → 29.3 | 28.4 → 25.6 | 28.8 → 23.9 | 28.5 → 25.5 |  |
| Viridel | 23.8 → 21.2 | 24.7 → 19.5 | 23.1 → 19.3 | 21.4 → 17.8 |  |
| Sealed Hangar | 24.0 → 21.1 | 21.5 → 19.8 | 13.6 → 11.9 | 14.2 → 13.2 |  |
| Buried Machine | 23.0 → 16.2 | 23.9 → 20.7 | 22.7 → 19.7 | 22.4 → 19.4 |  |
| Garden of Spheres | 22.0 → 18.4 | 20.8 → 19.1 | 20.5 → 18.4 | 21.3 → 17.9 |  |
| Home | 20.4 → 18.3 | 19.8 → 17.7 | – | 19.9 → 18.2 |  |

High, 1280 × 720 (1920 × 1080):

| world | start | busiest knot | second knot | wide | others |
|---|---|---|---|---|---|
| Desert | 8.3 → 7.3 | 8.3 → 7.6 | 7.5 → 7.9 | 6.4 → 5.8 | Qanat's street 8.8 → 8.0, in the ship 7.8 → 7.2 |
| City-Shaft | 11.7 → 11.4 | 13.3 → 13.0 | 11.8 → 10.3 | 14.9 → 13.9 |  |
| Signal Market | 10.9 → 10.5 | 11.5 → 10.4 | 5.5 → 5.8 | 4.9 → 4.9 |  |
| Vael | 11.5 → 10.7 | 11.8 → 10.3 | 12.5 → 11.2 | 13.4 → 11.7 |  |
| Vael II | 12.0 → 11.4 | 12.3 → 11.2 | 12.9 → 11.8 | 13.3 → 12.0 |  |
| Lorn | 10.7 → 10.3 | 11.1 → 10.2 | 12.3 → 11.3 | 10.6 → 10.6 |  |
| Lorn II | 14.3 → 13.3 | 13.5 → 12.7 | 6.4 → 5.9 | 6.7 → 6.4 |  |
| Viridel | 11.3 → 10.8 | 10.9 → 10.2 | 10.4 → 9.4 | 9.6 → 9.2 |  |
| Sealed Hangar | 10.9 → 9.8 | 10.3 → 9.3 | 9.5 → 8.5 | 10.1 → 9.3 |  |
| Buried Machine | 5.8 → 5.5 | 6.0 → 5.9 | 6.8 → 6.8 | 8.6 → 7.9 |  |
| Garden of Spheres | 10.5 → 10.0 | 6.3 → 5.9 | 6.5 → 5.9 | 6.6 → 6.6 |  |
| Home | 9.1 → 8.8 | 7.2 → 7.0 | – | 11.0 → 9.4 |  |

The steadier measure, in one page with the world held: the final build against itself with the bake,
the uniform cache and the crease test undone in the page (the screen noise worked out per pixel,
every array sent, every crease tap's flags read), at every view above on High at Retina size: 1.4-3.5
ms a frame (median 2.2) in every world, the pictures differing on 0.001-0.017 % of pixels.

(Home has one knot of people; the ship is the desert's, from its hatch toward the cockpit.) On
Handheld the rows move by under a millisecond either way at 1280 × 720 (960 × 540 is quick on an M4
Pro whatever is drawn) and gain 0.3-1.4 ms at Retina size; the Retroid itself wasn't measured (the
bake takes about seven value-noise lookups a pixel off its lighter paper). The scripts behind these
numbers (`ab.mjs`: in-page experiments as page snippets and shader patches, picture diffs with the
world held; `world.mjs`: builds side by side; `cpuprof.mjs`: the V8 profile of the game loop) live
in the agent's scratchpad, after `scripts/bench/passes.mjs`.

## Every world on the Retroid, in GeckoView (October 2026)

"Worried about performance on the device": every world measured in the app's own engine, GeckoView 157,
on the Retroid Pocket Nova (Handheld preset, render scale held at 0.75, the 60 Hz screen), with the
GeckoView test app (`com.rnaud.hiraeth.gecko`, `scripts/bench/gecko-apk.sh`) and a new driver,
`scripts/bench/android-worlds.mjs`: each world loaded in a fresh app, then each of its views
(`viewpoints-worlds.json`, picked on the device: the boot camera, the two densest knots of people, a
wide look up over them, a 40 m walk; the desert's are `viewpoints.json`'s) held 3 s and recorded 10 s,
with the main thread's time by system (`--profile 1`: the world's updates and the passes of
`renderFrame`), the GPU's busy share (kgsl), temperatures and the memory of the app's three processes.
The game's frame readout (F) stays on; its sound is at 0.

**What was slow: the traveller's new overshirt, in every world.** The coral-shirt traveller (v0.72) drives
his shirt with a cloth cage (`src/characters/tripo-cloth.js`): 495 particles, 18 passes of 2 732 edges and
five leg capsules at 90 Hz, then the 10.8 k vertices of the dense garment moved with it and their normals
worked out, every frame. On the handheld that was 33–43 ms of JS a frame (the player's update: 35 of
47 ms at the spawn), more the slower the frame (a slow frame owes the cloth more 90 Hz steps), so every
world ran at 17–25 fps with 60–72 % of the refreshes missed and the GPU 14–40 % busy, waiting. Within it:
a 57 k-vertex copy of the whole body rewritten, uploaded and its normals summed every frame though the
shirt uses a sixth of it; three.js's per-vertex skinning (`applyBoneTransform`, a spread and two matrix
products a bone); a closure and a vector made for every capsule test (100 000 a frame).
- **The cage off the main thread** (`tripo-cloth-sim.js`, `tripo-cloth-worker.js`): the same steps on flat
  arrays, run in a worker; each frame sends the targets and capsules with the steps due and uses the
  newest positions back. The shirt's swing is a frame old, the body under it this frame's (the garment
  follows `positions − the targets they were simulated against`). Without workers (tests) it steps here.
  The arrays take exactly the steps the vectors took (bitwise; `tests/tripo-cloth-sim.test.js`).
- **The garment only its own vertices** (`compactGeometry`: 57 282 → 10 771), its normals on the arrays
  (`vertexNormals`, three's sums in three's order), the skinning from the bones' matrices once a frame
  with the bind inverse folded in and each vertex's bind-space rest place worked out once, a vertex the
  cloth moves by itself not skinned at all, capsules rejected by their box (the same positions to
  3e-7 m). The shirt's main-thread cost: 33–43 ms → 1.8 ms.
- **The wind's wisps** (`wind.js` `GroundCache`): in Qanat they asked the ground's height 2 600 times a
  frame, each the sand banked against a dozen walls (124 k polygon edges, about 4 ms). They read exact
  heights 0.5 m apart now, filled as they go and kept while the ground stays as it is (`Terrain.setHeights`
  bumps a version): 99 % within a centimetre. The drift field itself gained exact quick outs and 8 m cells
  (`sand-drifts.js`; the same heights, `tests/sand-drifts.test.js`).
- **One renderer frame a game frame** (`perf.js` `pinRenderFrame`): three updates a skeleton and uploads its
  bone texture once per `render()` call; the shadow maps and the G-buffer each counted, so the camps
  uploaded 45 bone textures a frame for 28 skeletons (28 now): 0.2–0.3 ms.

Before (5ded1fd) → after (a592cb9; the desert and the City-Shaft again on the merged main with the frame
pin: within a frame or two of these), every view of every world (ranges over the views):

| World (views) | fps | p95 ms | missed refreshes % | JS ms a frame | GPU busy % | draws | load s | memory MB |
|---|---|---|---|---|---|---|---|---|
| Desert (spawn, Qanat, camps, dunes, cave, ride, walk) | 17–25 → 44–60 | 50–67 → 17–33 | 59–72 → 0–27 | 42–58 → 13–22 | 17–27 → 41–77 | 68–465 | 8.0 → 8.0 | 1231 → 1225 |
| City-Shaft (start, crowd, crowd2, wide, walk) | 18–20 → 44–60 | 67 → 17–33 | 67–70 → 1–26 | 50–57 → 13–22 | 19–39 → 61–88 | 352–1482 | 14.0 → 14.2 | 1268 → 1353 |
| Signal Market | 18–24 → 59–60 | 50–67 → 17 | 59–70 → 0–2 | 42–57 → 13–14 | 20–36 → 64–82 | 316–572 | 5.1 → 5.4 | 1124 → 1128 |
| Vael | 18–24 → 59–60 | 50–67 → 17 | 60–71 → 0–1 | 42–57 → 12–14 | 14–19 → 39–52 | 198–393 | 4.5 → 4.9 | 1020 → 1095 |
| Vael II | 18–23 → 57–60 | 50–67 → 17–33 | 61–71 → 0–5 | 44–58 → 12–14 | 23–36 → 79–84 | 282–499 | 6.1 → 6.0 | 1263 → 1350 |
| Sealed Hangar | 20–23 → 60 | 50 → 17 | 61–66 → 0–1 | 43–48 → 12–14 | 19–21 → 51–57 | 186–551 | 3.6 → 4.2 | 989 → 1004 |
| Buried Machine | 21–22 → 59–60 | 50 → 17 | 63–66 → 0–2 | 44–47 → 12–14 | 21–24 → 54–67 | 242–479 | 7.8 → 7.1 | 1138 → 1218 |
| Viridel | 21–23 → 60 | 50 → 17 | 62–65 → 0–1 | 43–46 → 12–13 | 14–21 → 38–57 | 190–459 | 5.4 → 5.3 | 1060 → 994 |
| Garden of Spheres | 22–24 → 59–60 | 50 → 17 | 59–63 → 0–2 | 42–45 → 12–14 | 21–26 → 54–67 | 257–479 | 5.8 → 6.0 | 1235 → 1422 |
| Lorn | 18–23 → 60 | 50–67 → 17 | 61–70 → 0–1 | 43–56 → 12–13 | 17–22 → 54–64 | 303–390 | 4.4 → 4.0 | 1030 → 964 |
| Lorn II | 22–25 → 59–60 | 50 → 17 | 59–64 → 0–2 | 41–45 → 12–14 | 30–42 → 73–93 | 175–465 | 6.5 → 6.2 | 1129 → 1160 |
| Home | 17–22 → 59–60 | 50–67 → 17 | 63–71 → 0–2 | 43–57 → 12 | 14–22 → 41–61 | 441–614 | 4.0 → 4.0 | 939 → 978 |

(Load: navigation to the first frame, the game served from the Mac over USB; from the APK, as it ships, the
same: the desert 8.5 s (12.3 s in 07af71c's run), the City-Shaft 14.2, the Signal Market 5.1. Memory: the
three processes' PSS after load, content + GPU + parent; it moves by ±100 MB with the collector's timing.
As shipped, with dynamic resolution, the same frame rates and the scale held at 0.75 (see below).
Every view and both builds: `scripts/bench/results/android-worlds.json`, `android-worlds-summary.mjs`.)

The shader test (`android-engines.mjs --engines gecko`: every program the desert links compiled again, made
unique, one by one): 78 programs in 5.7 s, 81 ms median, 208 ms the worst, against 75 in 20.8 s and 367 ms
in 07af71c's run; still no `KHR_parallel_shader_compile`.

**Against the last GeckoView run** (07af71c, `android-gecko.json`, the desert only): the cave 52 → 60 fps
(GPU 96 → 41 %: rooms off the map draw only themselves), the spawn and the dunes as then; Qanat 55 → 50,
the camps 59 → 46, the walk through them 51 → 44: their JS 18–19 → 19–22 ms. The difference is the people
(4.8–5.5 ms a frame in Qanat and the camps: 18 on MakeHuman bodies in view, posing, robes and capes) and
the shirt's 1.8 ms. Memory is about 200 MB more than then (1.03 → 1.23 GB in the desert: the traveller's
model and its copies, the MakeHuman bodies).

**What is left** (the places under 55 fps; all CPU-bound, the GPU 48–88 % busy):
- *Qanat, the camps, the ride and the walk through them* (44–51 fps): of 19–22 ms, the people 5, three.js's
  G-buffer draw loop 4–5.5 (300–470 draws: in GeckoView every GL call is queued to its GPU process), the
  shirt 1.8, the shadow maps 1.5–2.2, the rest (the loop, the HUD, hands and faces) about 3.
- *The City-Shaft's rim and wide views* (43–52 fps): 1 000–1 500 draws, the G-buffer's CPU 6.7–8.5 ms and
  the shadows' 2.6–4; the GPU 70–88 %. Fewer, bigger draws (static geometry merged by region) would be
  the lever there.
- *Dynamic resolution never sees the missed refreshes in GeckoView*: it counts a frame over 1.5x the
  window's quickest (`missedFrames`, timed at the frame's start), but GeckoView starts a late frame's
  callback late and evenly (19–22 ms apart at the camps while the screen shows 17 / 33 ms: the
  requestAnimationFrame timestamps do say it), so only the fps test (under 34) can lower the scale. Left as
  it is: the places that miss refreshes are CPU-bound, where a softer image wouldn't buy a frame. Counting
  from the timestamps would make it drop there.
- Tried and left out: world matrices only where they moved (a compare and a copy per object cost more
  than three's multiply: 0.16 → 0.35 ms in a 5 000-object scene); the people's posing tiers brought nearer
  on the smaller frame (no measurable gain at the camps, 19.2 against 19.3 ms).

To repeat: `npx vite build && WORK=… scripts/bench/gecko-apk.sh`, `adb install` the test app, then
`ANDROID_SERIAL=… node scripts/bench/android-worlds.mjs --serve dist [--worlds desert,incal] [--modes
fixed,dynamic] [--profile 1] [--toggles base,noShadow,postAlbedo,scale05] [--apk 1] --raw <dir>` (it
serves the game with the page bridge on 6253, starts and stops only the test app, removes its port
rule), and `node scripts/bench/android-worlds-summary.mjs <before dir> <after dir>`.

## The Retroid, second round: what is left in Qanat and the City-Shaft, dynamic resolution, the loading pen (October 2026)

Measured on the device in the GeckoView test app as above; small changes A/B'd *in the page* (the same world
and view, the variants in turns, 2.5 s each, six rounds: `ab-gen.js`-style snippets), since two runs of
the same build differ by 2–3 fps.

**What the camps' 19–20 ms of JS are** (in-page, each thing switched off in turns): the people's updates
4.6 ms (posing 1.1, the body following the rig 0.8, capes 0.8, feet 0.25, the rest their own logic and
the crowd's near tier), the traveller's shirt 2.4 ms, the shadow passes 1.1 ms, the G-buffer's draw loop
~5 ms (270 draws: three.js's work per draw, ~10 µs in GeckoView; few share a material: 145 switches for
272 draws, so merging equal materials would save ten). Without the people's updates the camps ran at 59 fps,
without the shirt at 60.
- **Still people on twos** (`npc.js` `NPC_DETAIL.still`): someone standing or sitting still (no steps, no
  wave, not talking) beyond 8 m is posed every other frame, half of them on each frame: 0.7 ms at the camps
  (19.6 against 20.2 ms, in-page). Their idle breathing and shifting moves at 30 Hz.
- Tried, no gain on the device: the animator's and the body's per-bone `getWorldPosition` /
  `getWorldQuaternion` (each updating its ancestors) replaced by matrices updated once, bit for bit the same
  (0.14 ms: SpiderMonkey's cost is elsewhere); the people's posing distances brought nearer on the small
  frame (19.2 against 19.3 ms). Not done: the shirt (another agent's), merging people's meshes.

**The City-Shaft** (1 000–1 500 draws): 700 of a wide view's draws are meshes straight under the scene with
285 materials, mostly the towers, each with its own random palette (merging needs per-vertex material values:
a shader change), and 161 were the terrace railings, a mesh and a material a segment. Those are now one mesh
for each terrace's eighth of the ring (`incal.js`, the same segments and iron): the wide view 1 492 → 1 326
draws, 42–43 → 45 fps, the rim 1 025 → 960.

**Dynamic resolution** counts the missed refreshes from the animation frame's timestamp now (`main.js`
`frame(ts)`): GeckoView starts a late frame's callback late and evenly, which hid them. Counted that way, the
Handheld scale fell to its floor, 0.5, in Qanat, the camps and the City-Shaft, for +1–3 fps (GPU busy 15–20
points lower): those frames are the main thread's. So `cpuBound` (Handheld and the Deck, 0.85): with the main
thread's time a frame over that share of the refresh, the scale isn't lowered, for missed refreshes or a low
frame rate (`adaptScale`; `tests/quality.test.js`). There the scale holds 0.75 (it had drifted to 0.6–0.7
on the frame-rate test alone). Where the GPU is behind and the CPU isn't, it drops as before.

| (device, fixed 0.75 unless said) | before | after |
|---|---|---|
| City-Shaft wide: fps / draws | 42–43 / 1 492 | 45 / 1 326 |
| City-Shaft rim: fps / draws | 50–51 / 1 025 | 52 / 960 |
| camps, JS a frame (in-page A/B: still people on twos) | 20.2 ms | 19.6 ms |
| dynamic resolution, missed refreshes counted from the timestamps: scale in Qanat, camps, City-Shaft | 0.6–0.75 (callback starts) | 0.5 at +1–3 fps without `cpuBound`; 0.75 with it |

**The loading pen** (the author sees it stutter). Its spin is a CSS transform animation, the compositor's,
but the compositor shares the GPU process with WebGL, and the load queues its compiles and uploads faster than
the GPU process works through them. `scripts/transition-perf/pen.mjs` reads the pen's angle in every frame of
a screencast (from its red nib) through a load (headless Chrome, Handheld, the CPU ×4): on a loaded Mac the pen
stopped 100–240 ms at a time during the shader and passage warm-ups (the desert: 11–17 gaps over 100 ms, the
longest 195–346 ms), on a quiet one often not at all (none over 60 ms), whatever the build: the Mac is too
fast and too shared to settle it. Done, at no measured cost in load time:
- `gpuPacer` (`load-steps.js`): a fence after each compile and each warm-draw batch (8 meshes, was 24); the
  load waits only while a fence older than 40 ms is still unsignaled (the GPU that far behind). Waiting on
  every fence instead took the gaps away here but doubled the load (a fence's status is seen a frame late).
  **It gives up** for the rest of the load (one `console.warn`, "gpu pacer: …") after 3 waits in a row that
  ran the whole 250 ms, or 3 s of waiting in all: a driver whose fences never signal (suspected on the Steam
  Deck, ANGLE under gamescope, 2026-10-08) made every piece wait the full 250 ms, and the desert's 741
  surface kinds plus its warm-draw batches hung on "mixing the inks…" for minutes (reproduced in headless
  Chrome with `getSyncParameter` forced to UNSIGNALED: 185 s, 3.8 s with the give-up; 3.0 s normally).
- A loading stage waits for a frame so the screen paints, or 250 ms if none comes (`nextFrame`): a window
  the compositor doesn't show may run no frame callbacks, and the load used to wait for one forever.
- `loadWatchdog`: a stage (and its step: surfaces, post, water, shadows, passage) still running after 15 s
  is named once in the console, so a stalled load says where.
- The pen spins on an HTML box of its own (`will-change: transform`; a transform on an SVG root isn't run
  off the main thread by every engine); the drawing is the same.
- The WebGL canvas is hidden under the loading screen until the first frame.
- On ANGLE over OpenGL (the Steam Deck) the shader warm-up asks for one program at a time (`oneAtATime`,
  `warm-shaders.js`): see "The loading pen on the Deck: one program at a time" (issue #52).
- **Guards** (so it can't come back unseen): `tests/gpu-pacer.test.js` (the pacer alone),
  `tests/load-awaits.test.js` (every `await` between the first stage and `'ready'` in `main.js` must be one
  of a known list of waits that end: a slice, the pacer, a stage's frame-or-250 ms, a race with a timer, the
  `pending()` poll with its 2 s cap, the asset loads with their failure caught…; a new one fails until it is
  bounded and listed), and `scripts/load-smoke.mjs`, run by hand (not on GitHub: it held each release back ~5 minutes):
  the built game in headless Chrome on SwiftShader, the desert, the garage and the Lantern
  loaded with fences that never signal and with no animation frames at all, each to its first frame within
  180 s, and the pacer giving up after at most 4 s of waiting. On a Mac (SwiftShader, the low preset) the
  desert took 55–60 s with the fences broken (the pacer gave up after ~0.75 s of waiting) and 48 s without
  frames, the small worlds 30–38 s: nearly all of it SwiftShader compiling shaders in "mixing the inks…". With
  the give-up taken out the Lantern still loaded (46 s, it has few surfaces) but the pacer check failed it.
Still to measure on the Retroid (it was taken back mid-run): an `adb shell screenrecord` of a desert and a
City-Shaft load, decoded in Chrome and read with `pen.mjs`'s `angles()`. Also left for the device: the
speaker's portrait circle (TODO, Dialogue), the game menu's item pictures and the self-driving cab ride.

## The traveller's overshirt on the GPU (October 2026)

After the worker took the cage (above), the shirt still cost 2.4 ms of main-thread JS a frame on the
Retroid. The cost came from three steps, each frame: every one of the garment's 10.8 k vertices was
moved (eased between its skinned place and its place on the attachment bone, then offset by its cell
of the cage and pushed off the legs), its normals were summed, and 260 kB of positions and normals
were uploaded.

- **The garment's vertex shader does it now** (`tripo-cloth.js` `garmentShader`, `GARMENT_GLSL`;
  `gpu`, the game's path). The garment is a `SkinnedMesh`, so three's skinning chunk gives the skinned
  place from the bone texture. `uGarmentRigid` gives the rest shape on the attachment bone. The
  particles and the targets they were simulated against are two 495-texel float textures, 16 kB a
  frame, read with `texelFetch`. Five leg capsules are uniforms. The static attributes `aCage` (the
  cell, where the vertex sits in it, its freedom) and `aOutward` carry the rest. The normal is the rest
  normal turned like the vertex: rigid or skinned, then by the cage's turn in its cell (its normal over
  the targets to over the particles), and away from a leg's axis where the leg pressed the cloth. The
  main-thread path stays for tests and pages without WebGL. `tests/tripo-cloth-gpu.test.js` runs the
  shader's sums in JS against it, frame after frame with the hips swinging: every vertex lands within
  0.2 mm.
- **Its shadow is the same shape**: the shadow passes' single plain material would skin the garment
  but not move it with the cage, and the misplaced shadow shaded the hem in patches. So the garment is
  left out of those passes (`Humanoid.noShadow`), and a proxy with a depth-only version of the shader
  (`garmentDepthMaterial`) is drawn into each cascade after the scene (`main.js shadowPass`, the
  character's `shadowCasters`).
- The worker's step messages hand their arrays over instead of copying them.

Measured in headless Chrome on the Mac at the Handheld preset with the CPU throttled ×4 (the Retroid
was not attached), timing `updateCloth` in the page: **3.5 ms → 0.5 ms** a frame (median 0.2–0.5).
That figure does not include the old per-frame upload of positions and normals, which ran inside
`render()` and is now 16 kB of texture. The frame's own CPU readout varied between 23 and 50 ms
across runs of the same build on the Mac, so it can't show a 2–3 ms difference. The look is checked
side by side (still and walking, front, sides and back).
On the device the 2.4 ms should fall in the same ratio, to roughly 0.3–0.4 ms. Not yet measured there.

## The Steam Deck (October 2026)

**What it ran.** The Deck's app had no preset of its own: the settings' default there was High (no
Android app, and a mouse-like pointer), which renders at 1.5× (1920 × 1200 for its 1280 × 800 screen)
with the full recipe (every crowd figure, props out to 520 m, all plants, the fine 2 k cascade). Measured
once on the runtime of v0.73 (Steam Deck OLED, SteamOS 3.8.28, Mesa 26.1, ANGLE on radeonsi): the
title screen at 90 fps (Desktop Mode, the 90 Hz panel) and 60 (nested gamescope's cap), the desert's
spawn at 17–22 fps with the renderer process at 100 %+ of a core, so the main thread was the limit.

**The Steam Deck preset** (`QUALITY_PRESETS.deck`, v0.76): between Handheld and Medium. The Deck's own
resolution (scale 1, adapting down to 0.6 with the Handheld's missed-refresh rule and its `cpuBound`
guard), crease shading and both ink passes as on Medium; the Handheld's lighter CPU side where the Deck
pays for it: crowd figures out to 260 m (full figures 45 m), props out to 380 m and over 1.5 px, plants at
0.75 of their range and 0.65 of their density, LOD at 1.5 px, a 1 k fine cascade, the near and far maps
every 2nd and 4th frame, 4 PCF taps, no cloud shadows. The grass was Low's; since v0.80 a wider patch
("What the Handheld and the Deck lose next to High", below). Auto picks it on the Deck
(`detectDeck`: the page at `hiraeth:`, or a Van Gogh GPU, `AMD Custom GPU 0405` / `0932`), and a Deck
whose settings were saved on High or Medium moves to Auto once (`deckV`); a lighter choice is kept.

**Measuring.** `scripts/bench/deck-run.sh start [desktop|gamescope] [game dir on the Deck]` starts the
game over ssh (muted, remote debugging on 9222, a tunnel to the Mac's 5310; only its own unit,
`hiraeth-bench`), and `node scripts/bench/deck-worlds.mjs --quality deck|high --modes fixed,dynamic
[--scale 1.5] [--profile 1]` runs every world's views as the Retroid run does (`viewpoints-worlds.json`,
the desert's `viewpoints.json`): fps, p95, missed refreshes, the JS and GPU time a frame, draws, the
scale the game chose, and with `--profile` the main thread by system. Checked on the Mac (Electron 44,
the fake install of `docs/steam-deck.md`): the desert's spawn on the Steam Deck preset 575 draws, 12 ms
of JS (the G-buffer 3.2, the player 2.2, the shadows 1.8, people 1.1).

**Measured on the Deck, 7 October 2026 (the first part).** The Deck was in Gaming Mode, so there was no
Plasma to nest gamescope in: `deck-run.sh start headless` runs the game in gamescope's headless backend
(Gaming Mode's X11 stack, nothing on the screen; `REFRESH=90`, the OLED panel's rate in Gaming Mode).
Runtime 830001 with the game of web build 969 (v0.80, the posing's gains in), ANGLE on radeonsi GL 4.6,
1280 × 800, the Steam Deck preset, `deck-worlds.mjs --secs 6 --warmup 2 --profile 1`. Each cell: fps, and
the JS and GPU ms a frame (medians); dynamic: the render scale the game chose.

| view | Deck, fixed (scale 1) | Deck, dynamic |
|---|---|---|
| desert spawn | 48; 20.5 / 11.1 | 47; 20.9 / 11.1; ×1.00 |
| desert qanat-tree | 39; 25.4 / 10.0 | 42; 23.3 / 9.9; ×1.00 |
| desert camps | 38; 25.6 / 11.4 | 40; 24.4 / 11.4; ×1.00 |
| desert dunes | 81; 11.9 / 10.0 | 79; 12.2 / 10.0; ×1.00 |
| desert cave | 85; 11.1 / 6.0 | 86; 11.1 / 6.1; ×1.00 |
| desert ride-city (path) | 40; 22.5 / 10.8 | 41; 23.1 / 10.9; ×1.00 |
| desert walk-camps (path) | 35; 28.2 / 10.0 | 37; 26.2 / 10.0; ×1.00 |
| City-Shaft start | 42; 23.5 / 11.5 | 42; 23.4 / 11.5; ×1.00 |
| City-Shaft crowd | 48; 20.3 / 9.3 | 48; 20.3 / 9.3; ×1.00 |
| City-Shaft crowd2 | 51; 19.0 / 9.5 | 52; 19.0 / 9.5; ×1.00 |
| City-Shaft wide | 40; 25.2 / 15.4 | 40; 24.9 / 15.4; ×1.00 |
| City-Shaft walk (path) | 42; 23.0 / 12.7 | 41; 23.2 / 12.7; ×1.00 |

(The spawn's "missed" share, 80–89 %, is frames alternating 11 and 22 ms at 90 Hz, not a stutter.)

- **The main thread is the limit everywhere measured**: 19–28 ms of JS a frame against 6–15 ms of GPU. The
  desert's spawn went from 17–22 fps on High at 1.5× (v0.73, Desktop Mode) to 48 on the Steam Deck preset.
- **Where the JS goes** (`--profile`, the desert): three's G-buffer pass 5.5–6.7 ms (traversal and GL
  calls), the people 3.7–6.6 where there are any, the shadow passes 3.2–4.3, the player 1.1–1.4, the wind
  0.5–1.0, the shadow culling 0.6–0.7; and 4–5.5 ms not in any wrapped system, even in the cave, which is
  why the emptiest views stop at 81–86 fps.
- **The `cpuBound` guard (0.85) stays on for the Deck preset**: with it, dynamic resolution held scale 1 at
  every view, at the same frame rate as fixed. Dropping resolution would only have cost sharpness: at the
  heaviest GPU view (the City-Shaft's wide, 15.4 ms) the JS is still 25 ms.

**Still to measure** (the Deck went to sleep 16 minutes into the run, at the Signal Market's load: in
Gaming Mode on battery, Steam's idle sleep only waits for a game Steam launched, and the bench's isn't one;
the run stops cleanly now when that happens): the other ten worlds, High at 1.5× the same way (the
"before" column), Desktop Mode (Plasma), ANGLE's Vulkan backend against GL (`GPU=vulkan`), and the loading
pen during a Deck load (`scripts/bench/deck-pen.mjs`, written for it, not yet run). On a Deck plugged in
(or in Desktop Mode) the whole set runs from:

```sh
PORT=5420 REFRESH=90 scripts/bench/deck-run.sh start headless ~/.local/share/hiraeth-deck/web/<build>
node scripts/bench/deck-worlds.mjs --port 5420 --quality deck --modes fixed,dynamic --raw <dir>
node scripts/bench/deck-worlds.mjs --port 5420 --quality high --scale 1.5 --raw <dir2>
node scripts/bench/deck-pen.mjs --port 5420 --only desert,incal
node scripts/bench/deck-summary.mjs "High 1.5×=<dir2>/deck-worlds.json:fixed" "Deck=<dir>/deck-worlds.json:fixed" "Deck dyn=<dir>/deck-worlds.json:dynamic"
scripts/bench/deck-run.sh stop
```

## The Steam Deck, round 2: every world, the main thread's costs, GL against Vulkan (October 2026)

**How it was measured.** 10 October, Steam Deck OLED in Gaming Mode on battery, runtime 1668001 with web
build 1668 (v1.37), `PORT=5420 REFRESH=90 scripts/bench/deck-run.sh start headless <game>`, then
`deck-worlds.mjs --quality deck --modes fixed --secs 6 --warmup 2 --profile 1` (1280 × 800, the Steam Deck
preset at scale 1, ANGLE on radeonsi GL). **The player's own game was open on the title screen the whole
time** (Steam had launched it, which keeps the Deck awake; it can't be paused from a script): its renderer
and GPU process took ~1.1 and ~0.5 of a core and a share of the GPU, so every number here is somewhat
pessimistic against a Deck running the game alone (the desert's spawn was 48 fps on 7 October with v0.80
and nothing else running, 33 here). Before and after ran under the same load.

The bench now runs in a profile of its own (`XDG_CONFIG_HOME=~/.local/share/hiraeth-bench`): before, Electron's
single-instance lock made it quit while the player's game was open, and `deck-worlds.mjs` wrote its settings and
an empty save over the player's own. It prints each load's "gpu pacer" / "load:" warnings, and `--cpuprofile 1`
saves V8's profile of each view (`<raw>/<world>-<view>.cpuprofile`) with its heaviest functions.

**The loading hang is gone.** Every world loaded (13–32 s); each load logged "gpu pacer: 3 waits in a row ran
out (250 ms each): fences not signalled", 751–1544 ms waited: the driver's fences really never signal under
ANGLE's GL backend, the cause found on 8 October. The pacer now remembers that per GPU (localStorage
`hiraeth.pacerOff.<renderer>`, `gpuPacer({ memory })`), so only a Deck's first load spends that second
finding out. On ANGLE's Vulkan backend the fences do signal (no warning, the desert loaded in 12.9 s).

**Before** (each cell: fps, the median of the world's views (the slowest view); that view's frame time
p50 / p95; the JS / GPU ms a frame, medians of the views):

| world | Steam Deck preset, before |
|---|---|
| desert | 29 (26 walk-camps); 33.4/55.5 ms; 31.3/11.7 |
| incal | 26 (26 start); 33.5/44.5 ms; 36.7/13.3 |
| bazaar | 46 (39 start); 22.3/33.4 ms; 21.3/10.0 |
| arzach | 53 (43 start); 22.2/33.3 ms; 18.2/8.4 |
| arzach2 | 48 (42 start); 22.2/33.4 ms; 20.7/11.9 |
| garage | 53 (45 start); 22.2/33.3 ms; 18.1/7.9 |
| buried | 52 (50 walk); 22.2/22.4 ms; 18.7/9.3 |
| edena | 51 (43 start); 22.2/33.4 ms; 18.8/7.7 |
| spheres | 56 (48 start); 22.2/22.5 ms; 17.1/8.3 |
| perdide | 54 (52 start); 22.2/22.3 ms; 18.0/8.3 |
| perdide2 | 50 (47 start); 22.2/33.2 ms; 18.8/12.8 |
| home | 57 (55 crowd); 22.2/22.3 ms; 16.8/7.6 |

The refresh is 90 Hz, so frames come in steps of 11.1 ms: 22.2 ms is 45 fps, 33.3 ms 30.

**Where the time goes.** The main thread is the limit at every view: 15–38 ms of JS a frame against 7–18 ms of GPU,
and dynamic resolution rightly holds scale 1 (the `cpuBound` guard). V8's profile at the desert's camps (inclusive,
per frame, inflated ~1.5× by the profiler): rendering 31 ms, of which the G-buffer pass 12, the shadow passes 9
(three walks the whole scene for each pass: `projectObject`, 4 ms of self time over a frame's passes),
`updateMatrixWorld` 8.7 (a frame visits 8 000–12 000 objects: the whole scene once, the traveller's rig four
more times, each cab, each posed person; only ~400–750 of them had moved); the people 7.8, of which their capes'
cloth 3–5 (3.5 cape updates a frame at ~1 ms each on the Deck, 0.23 ms on an M4: five cloaks within 30 m at
Qanat); the traveller 3–5. The City-Shaft's start draws 1 200–1 300 times a frame (650 in the G-buffer, 570 in the
shadow maps on average), mostly its terraces' and towers' merged meshes: none of the small-prop, flora or LOD knobs
moved its draws or its JS (tried at the view: 1 195 → 1 194 draws).

**ANGLE's Vulkan backend is much slower here**: the same views at 19 / 18 / 33 fps (spawn, camps, cave) against 33 /
28 / 61 on GL, the GPU time 30 ms against 12.5; the JS the same. The Deck stays on GL (deck.py's first choice).

**What changed** (each measured at the desert's camps by toggling it in the running game three times, medians of the
main thread's time a frame):

- **No fine shadow cascade on the Deck preset** (`shadow.fine: 0`), a near map of 4096 over a 120 m square
  instead of 2048 over 180 m (its texel 6 cm, the fine map's was 2.3 cm, the old near map's 18 cm): a whole pass of
  the scene a frame less. 32.7 → 30.4 ms of JS, the GPU 12.05 → 12.6 ms. The traveller's and the plants' shadows
  at the spawn look the same in a side-by-side (the Mac, the same moment).
- **Capes simulated within 14 m on the Deck** (`clothFar`, npc.js `updateCape`; Handheld keeps 30 m, the others 70):
  further off a cloak hangs on the body as its drape. At Qanat 5 cloaks were simulated, 2 now.
- **Matrices recomposed only where something moved** (`src/matrix-cache.js`, installed on `Object3D.prototype`
  in main.js): each object keeps the ten numbers its local matrix was composed from and recomposes, and multiplies
  its world matrix, only when they changed, it was flagged, or its parent's world matrix changed; the matrices are
  the same as three's (`tests/matrix-cache.test.js` checks them against three's walk over frames of changes).
  `updateMatrix()` refreshes the remembered numbers (a rig posed for a moment by `updateRig` and put back), a
  walk entered below the scene's root and an object given another parent are forced (issue #105; the Unity
  bridge installs the same cache: `tests/pose-exact-web.test.js` checks every bone).
  33.6 → 32.3 ms. (At the City-Shaft's start it saved nothing measurable: 97 groups there move or are flagged every
  frame, so most of the walk's multiplies are real.)
- **Shadow maps drawn unsorted** (`Cascade.render`: a depth map needs no draw order): 32.4 → 31.7 ms.
- **The cape's constraint loop on flat arrays** (`Cape._consFlat`: the points' offsets as integers, the weights
  worked out once): the same results, ~5 % of a cape's update on the Mac.

**After**: not measured yet across the worlds. The Deck went to sleep (battery, Gaming Mode) during the Vulkan run, right after the changes were measured one by one above, and did not wake again while this was written. Added up at the camps the changes take ~5 ms off a ~33 ms frame of the main thread (more where cloaks are near): about a 30 → 36–40 fps step where the JS sits around 25–33 ms, nothing where a view already makes 45 (its next step, 60, needs 16.7 ms). To measure: build, copy `dist/` to the Deck, and run the commands of "The Steam Deck" above with the game dir.

**What is still slow, and why.** The desert (its camps and Qanat: people, capes, the traveller, 400–650 draws)
and the City-Shaft (1 200+ draws, 570 of them shadows) stay under 40 fps on the Deck: the main thread's cost is
three.js's per-draw work (traversal, uniforms, state) times the draws, and the game's own per-frame systems,
not anything the preset still trades. The next steps that would move it: fewer draws in the City-Shaft (merging
its terraces' meshes further, or one shadow draw per merged mesh), the shadow passes culling from a list instead of
walking the scene each time, and the people's posing and cloth on a cheaper path (or a worker).

## Round 3, on the Mac: the City-Shaft's towers in one draw, the people's costs, the load's warnings (October 2026)

The Retroid gone, measured in headless Chrome (Handheld, the CPU slowed ×4) on a Mac shared with other agents'
jobs (load average 25-63 all along: two runs of one build differ by more than most of what follows, so the
numbers are work counted and pictures compared, timings only where the gap is large).

- **The towers** (`src/vertex-material.js`, `materials.js` `S_VMAT`, `makeMaterial({ perVertex: true })`): the
  City-Shaft's towers were a mesh and a material each (random pastels, bands, grid, facets), about 200 draws
  across the shaft and their shadow draws. They are one mesh for each terrace's eighth of the ring now, every
  tower in it carrying its own material values per vertex: the colours, the band size, the grid and flat shading
  (flat varyings; the fragment shader's names for those uniforms `#define`d to them), and the object-space point
  and normal and its place and turn, so the grid, the strata strokes, the hatching and the facet normals stay
  anchored to each tower as before. Towers share a draw only when every other uniform agrees (`restKey`).
  Close views of towers, the two builds side by side with the world held (`pair.mjs`, in the agent's scratchpad):
  0.001-0.16 % of the pixels apart (moving things), draws 313 → 141, 328 → 110, 547 → 115 there; the rim and the
  wide view ~200 draws fewer. JS a frame (CPU ×4, in turns): the rim 35.6 → 31.3 ms, the wide view 39.8 → 37.3.
  Tests: `tests/vertex-material.test.js`.
- **The people near the camera** at the camps (CPU ×4, in-page, the self time of each method a frame): the
  capes 2.4 ms (2.5 simulations a frame: most of the near ones are the crowd's people, already simulated every
  other frame within 5 m), the body following the rig 1.3, the animation's retargeting 1.5 and its mixer 1.0
  (8 posed), the feet 0.45, the crowd 0.85. The capes' every-frame radius brought from 12 to 5 m on the handheld
  changed nothing there (still 2.5 simulations: the one at 8 m is a crowd person), so it was left out; the
  cloth's arithmetic is already flat arrays. The bodies are skinned on the GPU already; what is left is the
  retargeting from the rig to the MakeHuman skeleton and its matrices, a few tenths of a millisecond a person.
- **The load's `toNonIndexed()` warnings** (three.js: "already non-indexed"): six places called it on icosahedra
  and octahedra, which have no index (the desert's errand props, the City-Shaft's olives and pines, Vael's
  pedestals, Viridel's crystals, Lorn's snapper's crown): they take them as they are now. None left in the worlds
  that had them.
- **The Garden of Spheres' triangles**: at its start 1.03 M a frame on Handheld, of which the round leaf masses
  (instanced, 320 triangles each, 29-126 a set) about 130 k in the view and 90 k in the shadows, not simplified far
  off. The Retroid held 60 fps there (GPU 54-67 %), so they are as they were.

## The City-Shaft's terraces round the ring (October 2026)

The terraces' sectors were built on top of each other (docs/systems/worlds.md): fixed, each level's town goes
round the whole ring, so more of it is in view and in the per-eighth meshes (the trees by terrace, kind and
eighth, the towers by terrace and eighth: 820 → 982 meshes). Two things keep the cost down:

- **the railings**, one mesh for each terrace's eighth, are in the terrace's iron bucket now (the same material as
  the plating under it: no draws of their own), 64 meshes fewer (918 in all);
- **the terraces' people**: the crowd used to keep one of each spot drawn two or three times over (1 373 people);
  spread round the ring the same candidates gave 2 470, so the terraces' stalls, circles, strollers and people at
  the edge are about half as dense along the promenade (`crowdSpots`): 1 505 people.

Headless Chrome on the Mac, Handheld, render scale 0.75, the two builds side by side (`pair.mjs` in the agent's
scratchpad), draws averaged over 12 frames, JS a frame at CPU ×4 in six alternating runs (load average 4-7):

| view | draws: before → fixed → railings merged | JS a frame (CPU ×4), two runs |
|---|---|---|
| the rim, where you arrive | 841 → 1 005 → 950 | 23.2 → 25.2, 22.7 → 24.3 ms |
| the wide view down the shaft | 1 113 → 1 290 → 1 201 | 25.4 → 27.3, 27.0 → 28.8 ms |

(Fixed alone, before the railings and the people: 25.4 → 28.1 and 26.7 → 30.0 ms.) What is left is the trees
(the rim's instanced trees and their shadow draws 99 → 190) and the towers (22 → 42): the town that was missing.
Not measured on a device.

## What the Handheld and the Deck lose next to High (October 2026)

Compared at the bench viewpoints (`viewpoints-worlds.json`: the desert, the City-Shaft, the Market, the
Buried Machine, the Garden of Spheres; High, Handheld and Deck side by side, then the Handheld with one
of High's features put back at a time), the presets look very close. Two losses show:

- **The grass** (v0.80, restored). The Handheld's patch (11.5 m) reached barely past the traveller from
  the camera, so the Garden's meadows read as bare ground a few steps ahead; the Deck's (Low's, 13.5 m)
  little better. Now `GRASS_QUALITY.handheld` is 14 m at the same density with its far layer out to 36 m
  (was 26), the Deck's 16 m and 40 m (was 30) at Low's densities. To pay for it, a patch whose centre has
  not moved 2 cm since its last scan, with nothing left to place, skips the scan of every tuft
  (`Grass.scanAt`): standing still the grass costs nothing on any preset. Measured A/B in the Garden
  (Chrome at CPU ×4, the M4): standing, the Handheld's CPU and GPU time unchanged within 0.2 ms
  (without the skip the wider patch alone cost 0.3–2 ms of CPU); walking its bench path, 11.6 → 11.5 ms
  of CPU and 7.3 → 7.3 ms of GPU; the Deck standing within the noise of its dynamic resolution, walking
  +0.6 to +1.2 ms of CPU at ×4 (the grass's own update while walking, measured alone, goes from 14 to
  22 µs a frame on the Mac, so most of that is noise). About 1 % more triangles a frame.
- **The far small props** (`propFar`, `propPx`): they are the CPU side (culling, the instance lists), and
  the Handheld is CPU-bound, so they stay.

Crease shading, the second ink pass and full weathering show barely visible differences at these views;
their Handheld GPU cost is noisy, up to ~1 ms on the M4, and the Retroid's GPU is several times slower,
so they stay off there.

## The people posed without recomputing what was current (October 2026)

Each person's posing (animator.js `apply`, humanoid.js `update`, the cloth's colliders) asked three for world
positions and turns with `getWorldPosition` / `getWorldQuaternion` / `localToWorld` / `worldToLocal`, each of which
recomputes every parent's matrix up to the scene first (and inverts the root's matrix again), right after a pass
that had just updated them; and `updateMatrixWorld(true)` on the character's root went through the body's ~70 bones
too, which Humanoid.update makes again from the rig straight after. Now (src/world-read.js):

- `worldPos` / `worldQuat` read the matrix as it is where it is known to be current: the library skeleton's after
  `Animator.update`, the rig's after its root's update and each joint's own, the bones' after `Humanoid.update`.
- `updateRig` updates the root and everything under it but the body (`userData.poseSkip`), in Animator.apply and
  Humanoid.update; the root's inverse is worked out once a pose, not once a bone.
- feet.js (the feet planted, the legs' IK) reads the same way: npc.js `plant` updates the person's matrices first,
  and each bone it turns updates its own.
- Humanoid.update keeps a record a bone (its rest, what drives it, its parent's record, its turn) instead of five
  map lookups and a new quaternion a bone a frame.

The poses were the same to the float (since then the `__POSE_EXACT__` path and its test are gone): tests/pose-exact.test.js ran two copies of the game in lockstep (the Unity
bundle in two bare V8 contexts, the same clock and random numbers) through the camps (people walking, seated round
the fires, carrying their staffs and instruments, their capes' colliders), a conversation and a walk, one with
`__POSE_EXACT__` (every read recomputed as three does), and compares every bone's world matrix every frame; once
checked against the bundle of the code before the change too (`POSE_REF`): no difference at all.

| | before | after |
|---|---|---|
| the web, Handheld preset, Chrome's CPU ×4: the camps (frame; the people's update) | 25.7 ms; 6.1 | 22.8; 4.9 |
| the same, the Signal Market's crowd | 14.0; 3.6 | 13.2; 2.9 |
| the Unity player (macOS): the people's update at the camps, at the crowd | 1.69, 1.02 | 1.08, 0.70 |

## The Retroid, round 4: every world again, the loading pen, the merged towers, the captures, a cab ride (October 2026)

The Retroid Pocket Nova back on the Mac, in the GeckoView test app (`com.rnaud.hiraeth.gecko`, built from main at
81f0311; the player's app untouched), Handheld preset, the frame readout on, the game's sound at 0.

**Every world** (`android-worlds.mjs --profile 1`, render scale held at 0.75; round 1's "after", a592cb9, against
this round, with v0.77–0.80 in: the shirt on the GPU, the towers merged, the people posed without recomputing,
still people on twos, the wider handheld grass; every view in `scripts/bench/results/android-worlds-round4.json`):

| World (views) | fps | p95 ms | missed % | JS ms a frame | GPU busy % | draws | load s | memory MB |
|---|---|---|---|---|---|---|---|---|
| Desert (spawn, Qanat, camps, dunes, cave, ride, walk) | 44–60 → 51–60 | 17–33 → 17–33 | 0–27 → 0–15 | 13–22 → 11–19 | 41–77 → 43–82 | 68–465 → 66–472 | 8.0 → 9.4 | 1225 → 1250 |
| City-Shaft (start, crowd, crowd2, wide, walk) | 44–60 → 43–60 | 17–33 → 17–33 | 1–26 → 1–28 | 13–22 → 12–17 | 61–88 → 65–93 | 352–1482 → 356–1140 | 14.2 → 15.8 | 1353 → 1399 |
| Signal Market | 59–60 → 59–60 | 17 → 17 | 0–2 → 0–2 | 13–14 → 11–14 | 64–82 → 67–86 | 316–572 → 329–594 | 5.4 → 6.2 | 1128 → 1070 |
| Vael | 59–60 → 60 | 17 → 17 | 0–1 → 0–1 | 12–14 → 12–13 | 39–52 → 42–54 | 198–393 → 207–393 | 4.9 → 6.1 | 1095 → 1075 |
| Vael II | 57–60 → 56–60 | 17–33 → 17–33 | 0–5 → 0–6 | 12–14 → 11–14 | 79–84 → 83–92 | 282–499 → 307–592 | 6.0 → 7.2 | 1350 → 1604 |
| Sealed Hangar | 60 → 60 | 17 → 17 | 0–1 → 0 | 12–14 → 10–13 | 51–57 → 52–58 | 186–551 → 177–551 | 4.2 → 4.3 | 1004 → 1057 |
| Buried Machine | 59–60 → 60 | 17 → 17 | 0–2 → 0 | 12–14 → 11–13 | 54–67 → 60–74 | 242–479 → 246–487 | 7.1 → 9.9 | 1218 → 1226 |
| Viridel | 60 → 60 | 17 → 17 | 0–1 → 0–1 | 12–13 → 10–13 | 38–57 → 40–59 | 190–459 → 198–461 | 5.3 → 5.8 | 994 → 1153 |
| Garden of Spheres | 59–60 → 60 | 17 → 17 | 0–2 → 0–1 | 12–14 → 11–14 | 54–67 → 59–71 | 257–479 → 257–515 | 6.0 → 7.0 | 1422 → 1343 |
| Lorn | 60 → 60 | 17 → 17 | 0–1 → 0–1 | 12–13 → 12–13 | 54–64 → 56–67 | 303–390 → 303–395 | 4.0 → 5.1 | 964 → 991 |
| Lorn II | 59–60 → 57–60 | 17 → 17–33 | 0–2 → 0–5 | 12–14 → 10–13 | 73–93 → 75–96 | 175–465 → 172–520 | 6.2 → 7.5 | 1160 → 1212 |
| Home | 59–60 → 59–60 | 17 → 17 | 0–2 → 0–1 | 12 → 12–14 | 41–61 → 43–63 | 441–614 → 443–617 | 4.0 → 4.3 | 978 → 988 |

The places that were slow, view by view (JS: the animation frame's callback; the parts from `--profile`):

| view | fps | missed % | JS ms | traveller ms | people ms | G-buffer ms | shadows ms | GPU % |
|---|---|---|---|---|---|---|---|---|
| Qanat | 49 → 57 | 19 → 5 | 19.8 → 16.6 | 2.9 → 1.1 | 4.8 → 3.9 | 4.0 → 3.9 | 1.5 → 1.2 | 60 → 75 |
| the camps | 45 → 56 | 25 → 8 | 21.3 → 17.2 | 2.8 → 1.0 | 5.3 → 3.9 | 5.0 → 4.7 | 2.2 → 1.9 | 61 → 78 |
| the walk through the camps | 44 → 51 | 27 → 15 | 22.4 → 18.7 | 2.7 → 1.0 | 5.6 → 4.0 | 5.6 → 5.2 | 1.5 → 1.3 | 48 → 59 |
| the ride to the city | 51 → 56 | 15 → 7 | 18.2 → 15.2 | 2.9 → 1.1 | 5.6 → 4.5 | 4.3 → 4.2 | 1.6 → 1.3 | 68 → 76 |
| City-Shaft, the rim (start) | 50 → 59 | 17 → 2 | 19.3 → 14.2 | 2.9 → 1.1 | 1.5 → 1.3 | 6.7 → 4.7 | 2.6 → 2.3 | 69 → 84 |
| City-Shaft, wide | 44 → 43 | 26 → 28 | 21.6 → 16.7 | 3.0 → 1.1 | 1.5 → 1.3 | 8.5 → 5.9 | 4.0 → 3.4 | 88 → 93 |
| City-Shaft, the walk | 49 → 53 | 18 → 11 | 19.5 → 15.2 | 3.2 → 1.3 | 1.3 → 1.1 | 5.6 → 4.0 | 2.4 → 1.9 | 79 → 90 |

- **The shirt on the GPU** is as predicted: the traveller's whole update (the shirt, the cage's messages, the
  posing) 2.7–3.6 → 1.0–1.4 ms in every world. **The people** at the camps and Qanat 4.8–5.6 → 3.9–4.5 ms (the
  posing, still people on twos). **The merged towers**: the City-Shaft's G-buffer loop 6.7–8.5 → 4.0–5.9 ms, its
  draws 1 326 → 1 140 (wide) and 960 → 868 (the rim). Every other world was at 60 already and stays there, the GPU
  a few points busier (the wider grass, the References' modelling).
- **What is left at 60 fps's edge**: the camps and the walk through them (51–56 fps) are still the main thread's:
  17–19 ms of JS, the people 4, the G-buffer's draw loop 4.7–5.2 (410–470 draws). **The City-Shaft looking down the
  shaft** is the GPU's now (93 %, 3.1 M triangles with the shadows): the synced loop (`--toggles`) takes 30–33 ms
  a frame at 0.75 and 21–23 at half the scale, while the JS stays 16–17.6 ms at any scale (the main thread waits
  on GeckoView's GPU process). The live frame rate there: 43–44 fps at 0.75, 51 at 0.6, 55 at 0.5.
- **So `cpuBound` was wrong there**: the main thread over 0.85 of the refresh read as CPU-bound and held the
  scale at 0.75 at 44 fps. Now a slow window that `cpuBound` would leave alone **probes** (`adaptScale`,
  `D.probe`: Handheld and Deck): three such windows try one step of 0.1 down, judged over the next four windows
  (the first after the resize left out) against the three before: 3 fps more, or 2 missed refreshes fewer a
  window, and it stays (holding as after a stutter); else back, and no probe for 240 windows (2 minutes). On the
  device, from 0.75 with dynamic resolution as shipped: **the wide view 0.75 → 0.65 → 0.55 (0.5 tried, no gain,
  back): 44.1 → 53.5 fps, 26.7 → 10.9 % missed**; its walk holds 0.55 at 52.6; the rim stays 0.75 (59 fps); the
  camps try 0.65 once and go back to 0.75; Qanat climbs to 0.85 as before (`tests/quality.test.js`).
- **Loads** are 0.1–2.8 s longer than round 1's (Buried Machine 7.1 → 9.9, Vael 4.9 → 6.1, the City-Shaft 14.2 →
  15.8): the worlds have more in them (the References' modelling). Not the GPU pacer: loaded in turns with it and
  without (`?nopace`, a scratch build), the Buried Machine 9.4–10.6 s against 9.2–13.6, the City-Shaft 14.2–15.7
  against 14.0–15.6, the desert 7.9–9.2 against 8.6–9.2; it waited ≤ 7 ms in the first two, 370–500 ms in the
  desert. Vael II's memory after load is 250 MB more than round 1's (1 350 → 1 604 MB), the content process's.

**The loading pen** (`scripts/transition-perf/pen-android.mjs`: `adb shell screenrecord` through the load, read
frame by frame with `pen-read.swift`, AVFoundation with each frame's own time, since headless Chrome draws the
device's H.264 blank into a canvas; the measures are `pen-stops.mjs`'s): it turned smoothly through every load,
150° a second, the gap between frames where it had turned 17 ms at the median and the 95th percentile.

| load (the game from the Mac unless said) | longest stop ms | stops over 50 ms |
|---|---|---|
| desert, ac7e4d1 (before the pen's own layer and the GPU pacer) | 33 | 0 |
| desert, main (two runs; and from the APK) | 49, 49; 33 | 0 |
| City-Shaft, ac7e4d1 | 32 | 0 |
| City-Shaft, main; from the APK | 32; 18 | 0 |

So on the device the pen never stalled, before the change or after: GeckoView runs the CSS spin on its
compositor through the shader compiles. What the author saw stutter was not reproduced in seven loads.

**The City-Shaft's merged towers on the Adreno** draw as unmerged: five views (the rim, the wide view, two views
of towers across the shaft, the crowd), main against a scratch build with the merge loop putting each tower back
as its own mesh and material, device screenshots with the hour and weather held: 0.13–1.1 % of the pixels apart
(3.6 % at the crowd), every one of them a cab, a person or the airship that moved; the towers themselves
identical. Draws there, unmerged → merged: 1 331 → 1 129 (wide), 781 → 679 and 713 → 613 (the towers' views).

**The speaker's portrait and the Sketchbook** draw on the device in GeckoView: four conversations in the desert
(the traveller, Ysa, Ennor, Marrow), each chip a 210 × 210 picture of the person, 280–440 colours, the commonest
38–58 %; two relics found the game's way (the traveller set at each), their sketches 240 × 170 JPEGs of 1 283–1 603
colours, in the Sketchbook panel. The blank yellow disc of the TODO was seen in the device's Chrome, which this
round does not use (only the test app runs); in the app's engine the canvas read works, so the capture path is
left as it is (with its refusal of a blank portrait).

**The game menu's item pictures** draw too: all 23 of a full kit, 256 × 256, 150–514 colours each. Their cost:
opening the Items panel draws one a frame for 23 frames (14.9 ms of JS at the 95th percentile, the worst frame
29 ms of JS and one 66 ms frame), the rest of the frames at 16.7 ms; held open, 0.1 ms a frame (the menu covers
the canvas, nothing is drawn).

**A self-driving cab ride**: boarded beside the cab, the stop chosen as the dash's answer does (`Taxi.goTo`), the
route planned in 0.2 ms (the Signal Market, 196 m) and 0.4 ms (the City-Shaft, 232 m); the ride recorded 15 s to the
stop: the Market 59.6 fps, p95 16.7 ms, no frame over 33 ms, JS 12.5 ms (p95 14.8); the City-Shaft 59.1 fps, two
frames over 33 ms (the worst 50), JS 12.5 (p95 17.8).

## The traveller's model (October 2026, v1.0)

The traveller's `model.glb` was the biggest file in the build (9.7 MB) and is a cost in the game too:
two 4096² textures (179 MB of GPU memory, 350–430 ms of main-thread upload during the load on the M3
Pro) and 223 k triangles a frame at Handheld (431 k at High) whatever the distance, 31–40 % of a
view's triangles. Now: the files 13.3 → 6.9 MB (unused maps out, the textures at 2048², geometry
unchanged), his textures 45 MB and 90–100 ms, and levels of detail outside 3 m that bring him to
64 k triangles a frame behind him at Handheld (220 k at High). The numbers, the method and the
pictures' comparison: characters.md, "What the traveller costs"; the bench: `scripts/bench/traveller.mjs`.
Not measured: the Retroid and the Deck, and the frame-time gain (under the Mac's noise).

## The title's world on a slow shader compiler (October 2026)

(Since v1.49, issue #110, the title builds no world at all: its shot is a vector drawing painted at once, and the
game loads behind the menu instead; docs/systems/ui.md, "The title's drawing and the game behind it". What follows
is the history, and the game's own loads.) The title opened on a still of its shot (the world's own pixels, made by
`node scripts/title-shots.mjs --stills`, ~140 kB each, now `docs/title-shots/stills/`, what the drawings are traced
from) and the live world faded in over it. Where making the world cost too much the still stayed: on the Xbox
always, and on any GPU whose last build ran past 25 s. Measured on the Xbox (docs/systems/xbox.md, "The 100-second title"): 38 programs,
~1 s each for the surfaces and 22-28 s for the ink pass, 100-131 s to the world cold and 20-46 s warm, the
menu frozen up to 22.6 s at a time.

Two changes help every platform's loads (the title and the game's loading screen):
- **No blocking first use.** `firstUse` (`src/warm-shaders.js`) waits, polling `isReady()`
  (KHR_parallel_shader_compile), before asking for a program's uniforms, and runs before the warm draws;
  `WarmDraw.compile` (`src/passage.js`) compiles a batch's programs with each pass's target and override, and
  the loads `settle` on them before drawing. A query on a program not yet linked blocks the page till it is.
  With a simulated 1.5 s link (serialised, queries blocking, as the console), the title's longest task went from
  the whole queue to 6 s (the first frame's small bloom and blit programs, a few ms each on real hardware).
- **The ink pass compiles less.** Its debug views (`DEBUG_VIEW(n)`, `INK_DEBUG`) and the handheld's lite path
  (`POST_LITE`, `INK_LITE`) are defines (`inkFeatures`, recompiled when `uDebug` or `uPostLite` change), not
  branches on a uniform: on the Xbox's D3D compiler 28.0 → 16.5 s. `#pragma optimize(off)` and `textureLod` in
  its loops made no difference there (17.7 and 24.8 s).

## A body's repeated parts in one draw, and the worlds' props in fewer (October 2026, v1.39)

The roster's bodies (`src/enemies/plans/`) are built of many small meshes on the motion kit's joints: a leg's
segments, a jelly's tentacle beads, a centipede's legs. The 21 archetypes are about 1 100 meshes, each one a
draw in the G-buffer and in every shadow map, so a full pack in the Arena was 2 750 draws a frame at High. The
performance audit (`docs/audits/perf-v1.40.md`) found it the largest regression of v1.8–v1.36.

**`src/part-batch.js`** (`batchParts(root, { min, cell })`, `PartBatch`). Parts with the same shape (equal
vertex arrays: each part builds its own geometry, so they are compared, not looked up) and the same material
are drawn by one `InstancedMesh`. Its instances are the parts' own world matrices, so `modelMatrix ×
instanceMatrix` is each part's `matrixWorld` and the surface shader sees exactly what it saw (`vObjPos`, the
facet normals, the hatching). The parts stay in place, moved by the kit as before; their layers are off.
- **When it reads them:** when the scene's matrices update (`renderFrame`'s `scene.updateMatrixWorld()`). The
  batch is its root's last child, so the parts are this frame's by then. This composes with the matrix cache
  (`src/matrix-cache.js`): a part that did not move keeps its matrix, the comparison finds nothing to write,
  and the batch uploads nothing.
- **What it draws:** only the shown parts (it and its parents up to the root visible). A batch with none shown
  is hidden. A batch whose whole body is hidden is skipped. A part taken out of the body (a machine's pieces
  flying apart) draws itself again.
- **Shadows:** `ShadowCuller` judges a batch by the size of one part (`partRadius`), so a batch of small parts
  still stays out of a coarse shadow map, as each part did.
- **Left out:** skinned meshes (already one draw), self-lit parts (`shadows.js selfLitSkips`: they stay out of
  the shadow passes by their own rule), see-through parts (their draw order is kept), multi-material meshes.
- **For measuring:** `batch.enabled = false` gives the parts their own draws back. The numbers below are the
  batches switched off and on in turns in the same page, six times each.

Where it is used:
- every foe's body (`foes.add`, every part, one alone in its shape too: a body then compiles only the instanced
  programs, not both kinds, the first time it is met, a hitch on the handheld);
- the City-Shaft's ~80 cabs (one group);
- the responsive world's shared stone, brass and stems, by 64 m cells, so a batch is culled with what is
  round it;
- the makers' runs' pieces, the wind columns' rings and Vael's wind rings.

Merged outright (each piece already in its parent's frame, so the merged mesh is drawn as before):
- the City-Shaft's 26 cables;
- the dismissed Hangar's gear teeth.

Merged per vertex (`vertex-material.js`, as the towers):
- the City-Shaft's 40 billboards;
- every shop front's colour buckets. `buckets().build(group, { merge: true })` uses
  `mergeWithMaterials(items, { local: true })`: the geometry stays in the front's frame, and its place and turn
  are written for the facet normals. Every front is at most 10 meshes; the Buried Machine's dome went from 38 to
  12 draws.

Headless Chrome on the M4 Pro (ANGLE Metal), each view's frames' medians, measured while the Mac was shared
(load average 5–25: differences under ~0.4 ms are noise):

| view | preset | main thread, ms: off → on | draws: off → on |
|---|---|---|---|
| the Arena, all 21 archetypes | High | 7.0 → 5.7 | 2 775 → 1 463 |
| | Steam Deck | 5.6 → 4.8 | 2 065 → 1 075 |
| | Handheld (two builds, one run each) | 6.3 → 5.0 | 1 795 → 1 017 |
| the City-Shaft, wide (cabs, stones, runs) | High / Deck / Handheld | 11.7 → 11.3 / 9.0 → 9.3 / 8.4 → 7.9 | 1 560 → 1 340 / 1 293 → 1 120 / 1 384 → 1 186 |
| Vael's start (stones, runs, winds) | High / Deck / Handheld | 7.0 → 7.0 / 5.8 → 5.9 / 5.2 → 5.3 | 1 037 → 999 / 867 → 812 / 812 → 785 |
| the Market's start | High / Deck / Handheld | 7.3 → 7.4 / 4.6 → 4.6 / 4.4 → 4.4 | 817 → 783 / 675 → 632 / 686 → 642 |

**Where it pays, and where it doesn't.** The gain is in fights: a dense pack saves about 1 ms a frame on the Mac.
In a quiet view, the world's props save 30–200 draws, but the main thread hardly moves on the Mac: reading the
parts costs about 0.1 ms a frame for 600 parts, and most of the parts it saves were frustum-culled anyway. On
the handhelds, where a draw costs the main thread more, the saving should be larger (not yet measured on the
devices: TODO).

**Tried and dropped:**
- batching every part, a batch of one included: no draw saved, and an upload and a read a frame for each moving
  part;
- foes at min 2 (a part alone in its shape drawing itself): 0.2 ms more saved in the Arena, but each foe's
  materials then compiled twice (the Arena 106 → 116 programs), a hitch the first time a kind is met;
- the responsive world's parts in each node's own colour. Each node has its own material, because the node's
  colour and glow change as it wakes, so they would need a per-instance glow in the surface shader.

## Where a load goes, and fewer programs for the Xbox (October 2026)

**Tools.** `scripts/load-breakdown.mjs` loads worlds from a build and reports:
- the loading screen's stages, and since then each stage's steps (main.js prints a `load steps:` line: surfaces,
  post, water, shadows, first use, passage);
- the programs linked and the size of their sources;
- the time spent inside the WebGL calls that compile, that block on a program (its status, log and uniforms) and that
  upload.

It runs on the Mac (headless Chrome, ANGLE on Metal). `--dump` keeps every program's final GLSL;
`scripts/xbox-shaders.mjs` then compiles and links each one on the console (in the game's page, through the Device
Portal's DevTools relay, each salted with a define of its own so the cache can't answer) and can return the HLSL ANGLE
made of it (`--log`). `--xbox https://hiraeth.example/perf-new.html` loads a build on the console itself, every shader
salted: a first launch. The app opens only its own origin, so the build is put beside the console's bundle. Its index
goes in as `perf-new.html`, with the assets the console lacks, through the portal's file API
(`POST /api/filesystem/apps/file`, with the CSRF token as for `POST /api/taskmanager/app`, which launches the app).

**What a program costs on the Xbox** (desert, web build 1698, measured one at a time):
- A surface program is 0.65 s plain and 1-4 s with heavy features (weathering + pen detail + patches 3.7 s, the fluid
  2.5 s, the blade 3.4 s, the inscriptions +1 s). The ink pass is 10.7 s. Depth and small programs are 10-200 ms.
- Translating GLSL to HLSL takes 30-50 ms a program; the rest is D3D's compiler at link. ANGLE already leaves out
  `#if`'d-out code and uncalled functions, so stripping the über-shader's source at build time would save next to
  nothing. The variants are what cost.
- Restructuring one program's shadow taps (a loop of two, `textureLod`) made it slower (650 → 810 ms). D3D's compile
  time doesn't follow the source's size.

## Fewer surface programs (materials.js `surfaceDefines`; scripts/three-program-keys.mjs)

The desert compiled 64 surface programs, most of them the plain über-shader split by a cheap option or by three.js's own
keys. Now:
- **Shared features: tried, then taken out again.** Cheap uniform-gated features were first compiled into more
  materials than used them (`SURFACE_SHARED`, `SURFACE_LIGHT`, 00f8a642): the desert's surface programs went 64 → 24
  and the console's link time 81 → 42 s. But the first draws on the Xbox compile every drawn program a second time,
  with all its outputs (below, "The first draws on the Xbox"), and there the shared features cost far more than at
  link. For a plain surface, drawn once into the G-buffer:
  - with none of them: 1.07 s;
  - with all of them: 3.75 s;
  - strata alone: +1.55 s; plates and grid: +0.94 s; glass and ribbon: +0.7 s; map, folds, veil, lamp tint and thin
    bars together: +0.7 s;
  - the ground's own (ripples, biomes, ticks, sand ink): 0 outside the ground, but the merged ground took 15.2 s
    against 7.2 s for its biggest variant.

  The programs the desert's spawn view draws, linked and then drawn once, one after another on the console:

  | Build | Programs | Link | First draws | Total |
  |---|---|---|---|---|
  | Before | 39 | 34.0 s | 69.9 s | 104 s |
  | Features shared | 22 | 26.2 s | 82.9 s | 109 s |
  | Not shared, the rest kept | 32 | 28.4 s | 60.5 s | 89 s |

  In each build 3-4 skinned programs aren't counted: the bench can't draw them.

  So a material again compiles only its own features. Desert programs: 71 (46 surface), against 89 (64) before.
- **One order.** The defines are added in one sorted order. three.js keys a program on the order its defines were
  added, so the same set in another order had compiled again.
- **three's own keys.** A Vite plugin patches three's module (`threeProgramKeys`, which throws if three changes):
  for a material whose `userData.sharesProgram` is set, DOUBLE_SIDED, FLIP_SIDED, HAS_NORMAL and USE_COLOR are left
  out of the key. The shader reads none of the first three; it turns a back face's normal itself. The colour
  attribute is read by `uVertexColors`, which follows `material.vertexColors`. Crowds, grass, merged meshes, sway and
  night paint keep their own keys: a colour attribute added to them went past D3D's 16 vertex attributes ("Too many
  attributes").
- **Smaller fixes.** Face keys compile at least `FACE_KEY_SLOTS` (12), so the brows' 6 keys and another head's 9 share
  one program. The warm-up skips a mesh whose geometry is still empty (a telegraph's mark): its program, keyed without
  a position, was never drawn with.
- **The ink pass's sky and spot blacks by look** (post.js `INK_STICKY`). The eclipse, space, the planets (a size *and*
  a direction: THREE.Vector4's default (0, 0, 0, 1) is none), sky dots, cumulus and spot blacks are compiled in only
  where the look uses them. Each was already decided by its uniform, so leaving it out changes nothing. Once drawn
  with, a part stays (a zone or preset switching it off doesn't recompile). A look's values passed through while
  loading don't count; `post.sync()` runs before the warm-up, for planets set in place. On the console: 10.8 s →
  6.2 s without the eclipse, space and planets; the spot blacks' enclosure is another 2 s.

**Results.** Program counts:

| | before | after |
|---|---|---|
| Surface programs per world (ten worlds) | 52-66 | 22-30 |
| Programs linked, desert | 89 | 49 |

Xbox compile time, programs one after another (cold):

| | before | after |
|---|---|---|
| Desert | 81.2 s | 41.9 s |
| City-Shaft | 76.6 s | 53.1 s |
| Lorn | 78.1 s | 46.3 s |
| Buried Machine | 67.1 s | 48.5 s |
| Signal Market | not measured | 39.5 s |

A whole cold desert load on the console (`--xbox`, salted):

| | before | after |
|---|---|---|
| First frame | 172.7 s | 150.7 s |
| "mixing the inks" | 129 s | 91 s |

On the Mac (median of 3, High), "mixing the inks" stayed 0.6-0.9 s and the first frame was the same or up to 0.5 s
sooner. Screenshots of the desert, the market and Lorn differ from the old build no more than two runs of the old build
differ from each other (moving people and plants).

**What is left.** On the console the new build's "mixing the inks" breaks down as:

| Step | Time |
|---|---|
| surfaces | 17.4 s |
| post | 7.1 s |
| water | 2.0 s |
| shadows | 2.0 s |
| first use | 9.7 s |
| passage warm-up | 52.6 s, against its 8 s budget |

The first frame then came about 51 s after "ready". In those two, single uploads and info-log queries block for 16-36 s:
the first draws, not the compiles, are now the biggest part.

## The first draws on the Xbox (ANGLE's second compile, October 2026)

Traced on the console (DevTools `Tracing` with the `gpu.angle` category, a cold desert load). At link, ANGLE on D3D11
compiles a program's pixel shader for one output only: `GetDefaultOutputLayoutFromShader` takes the first output
variable's location. It does that on worker threads. The first draw into the G-buffer (three targets) needs a shader
with all three outputs. ANGLE compiles it with `D3DCompile` on the GPU process's main thread (`CrGpuMain`), and every GL
call waits behind it.

The size of it:
- About 30 such compiles of 1.2-15 s each came one after another from the passage warm-up through the first frame:
  about 110 s of a 150 s load. A plain surface took 4.1 s; the merged ground took 15 s.
- The 16-36 s blocking `texSubImage2D` and `getProgramInfoLog` calls were calls queued behind them.
- Chrome caches a program's binary once, at link, so the draw-time shaders are compiled again on every load, warm ones
  too.

What doesn't help, tested in a bare repro (`--draw` below):
- No ANGLE feature or flag changes this: `--use-angle=d3d11on12` goes through the same path.
- Neither does an output array (`out vec4 o[3]`), nor having the three-target framebuffer bound at link.

Drawing each program once as soon as it links does help. Six heavy programs:

| | Total |
|---|---|
| Link all, then draw each | 9.6 s |
| Draw each as it links | 7.7 s |

The draw-time compiles stay one at a time on CrGpuMain, but overlap the other programs' links. The single-target
G-buffer that would remove it is a bigger change, put to the author.

`scripts/xbox-shaders.mjs --draw 1` times both halves on the console for dumped programs: the link, then one draw into a
4 × 4 three-target half-float framebuffer (each sampler on its own unit, the shadow samplers on comparing depth
textures). `scripts/load-breakdown.mjs` now also logs each program's first draw into each kind of target, and how many
programs the spawn's view draws against those compiled. For the desert:

| Build | Programs the view draws | Used by the scene | Compiled |
|---|---|---|---|
| Before | 39 | 75 | 89 |
| Now | 32 | 57 | 71 |

**Cold, warm and after a relaunch.** Desert loads on the console (`load-breakdown.mjs --xbox`, October 2026). `--salt`
fixes the salt, so a second run loads the same sources warm; `--warm` doesn't salt at all.

Build 1715, which compiles only each material's own features again:

| Load | First frame | Steps |
|---|---|---|
| Cold, the first load in a fresh app session | 139.7 s | surfaces 45.8 s, first use 5.4 s, passage 49.3 s against its 8 s budget; the first frame ~28 s after ready |
| The same again, in the same session | 29.0 s | surfaces 2.3 s, passage 10.1 s |
| After the app is relaunched | 51.0 s | surfaces 16.1 s, the ink pass 2.0 s again, passage 10.4 s |

So the GPU process's cache keeps most programs within a session, but only part of them across a relaunch.

Tried and not kept (step (a)): compiling only the start view's kinds (the view, plus 60 m round the traveller), each
drawn once as it links, and the rest after the first frame. A cold load was the same, 135.7 s: the draw-time compiles
run one at a time on CrGpuMain whenever they happen (start surfaces 113 s, then passage 2.1 s, the first frame 4.7 s
after ready). A warm one was 4 s slower, and the deferred kinds would each stall the GPU 1-15 s during play.

**The passage warm-up's budget, kept** (main.js, after the trace). The first view's meshes are always drawn, as the
first frame would draw them anyway. Past them, within `PASSAGE.loadBudget`, a mesh of a kind not drawn yet is drawn
only if its first draw still fits. Its cost is taken as the average first draw of the view's new kinds so far.
- On the Mac that average is a few ms, and everything round the traveller, the ship and the ways through is drawn as
  before (desert: 2685 meshes in 254 ms).
- On the Xbox it is seconds, so the ahead part keeps to kinds already drawn. The 8 s budget had become 48 s.

## The load by kind of work, the first playable frame, memory and traversal (October 2026, issue #16)

`scripts/load-breakdown.mjs` now splits a load by the kind of work, as the author's list asks (TODO.md, "Loading
follow-up"), and reads what comes after the first frame:
- **Steps everywhere.** main.js names a step (`setStep`) through every stage, not only "mixing the inks": the world's
  build and the wall openings; the collision's bake (the BVH built in its worker included), the level's own init, the
  water, the buried flora, the ship, the responsive world and the tiling; the player, the wait for the models' files,
  the traveller, the sound and tool, the people, the crowd and its pool, the story, the flora, the grass, the wildlife
  and the foes; the still meshes' batches. Each stage's steps go to `window.__loadLog` too (and `window.__loadT0`, when
  main.js began), so a harness that can't read the console (GeckoView's bridge, the console's relay) gets them.
- **`phases`** (`phasesOf`, tested): modules (the page and its scripts up to main.js), assets (waiting for the models),
  world creation, collision, characters, shaders (compile, link, first use), GPU warm-up (the passage's draws and the
  first frame's uploads), the rest (sound, story, the loading screen's frames), and from "ready" to the first frame.
- **The first playable frame**: the first of ten frames in a row under 50 ms apart once the world shows.
- **Memory**: the JS heap, what the scene holds for the GPU (its geometries' and textures' bytes, each counted once,
  and three's counts), and the resident memory of Chrome's renderer and GPU processes.
- **`--traverse s`**: a quick full turn of the camera, then the traveller carried at `--speed` (40 m/s: past the
  hoverbike) along the view and back at 70 % of the world's limit, every frame on the ground: the frame intervals'
  p50, p95, p99 and worst, and the frames over 50 and 100 ms.
- `--cpu n` slows the page's main thread (with `--preset handheld`, the handheld recipe), `--query k=v` adds to the
  page's address for an A/B in one build (`defer=0`, `batch=0`); the levels of detail's and the distant detail's queue
  are read at the first frame and after the traversal.

Measured on the Mac (M4 Pro, headless Chrome on ANGLE Metal, High, 1280 × 720, no vsync, one run each, the machine
shared with other agents' test runs), ms:

| World | modules | assets | world | collision | characters | shaders | GPU warm-up | rest | first frame | first playable | heap MB | geometry MB | GPU process MB | traversal p50 / p95 / p99 / worst, ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Desert | 234 | 20 | 1690 | 171 | 424 | 367 | 245 | 491 | 3.64 s | 3.64 s | 129 | 156 | 582 | 7.3 / 9.7 / 12.9 / 83 |
| City-Shaft | 248 | 18 | 1116 | 3418 | 1444 | 389 | 244 | 444 | 7.32 s | 7.32 s | 166 | 206 | 665 | 10.2 / 12.4 / 17.9 / 355 |
| Vael | 230 | 21 | 2253 | 232 | 426 | 330 | 274 | 420 | 4.19 s | 4.19 s | 105 | 261 | 734 | 8.1 / 9.5 / 12.0 / 61 |
| Buried Machine | 272 | 25 | 2518 | 131 | 426 | 403 | 236 | 412 | 4.42 s | 4.43 s | 102 | 165 | 616 | 5.5 / 6.7 / 7.8 / 14 |
| Lorn | 186 | 23 | 1818 | 628 | 477 | 419 | 342 | 469 | 4.36 s | 4.37 s | 96 | 173 | 641 | 6.8 / 8.6 / 9.9 / 17 |
| Garden of Spheres | 255 | 24 | 1403 | 240 | 462 | 392 | 240 | 396 | 3.41 s | 3.42 s | 98 | 167 | 608 | 5.5 / 6.9 / 8.4 / 25 |
| Signal Market | 221 | 21 | 492 | 68 | 507 | 455 | 504 | 381 | 2.65 s | 2.65 s | 117 | 89 | 484 | 6.6 / 9.6 / 13.0 / 29 |

What it says:
- On this Mac the load is the CPU's: shaders and the GPU warm-up are 0.6-1 s of every world; world creation (the
  terrain, the sand drifts' field, the buildings) is 0.5-2.5 s, and the City-Shaft's collision 3.4 s, nearly all of it
  its check for trees a clump had put inside a house (2.5 s: thousands of rays through the BVH), and its crowd's routes
  (0.9 s: every 1.5 m of every route walked with rays). The traveller is ~0.3 s in every world.
- The first playable frame is the first frame here: no frame after it is 50 ms apart. The worst frame of a traversal
  is a few hitches; the City-Shaft's 300-350 ms one is in every build.
- Not measured this round: the Retroid (asleep and locked all night; it is measured only when awake and unlocked) and
  the Xbox (in use for the Unity port). The Xbox's own split is above ("The first draws on the Xbox": there the
  shaders' draw-time compiles are most of the load, which no deferral of the CPU's work changes).

## Distant detail after the first frame (`src/deferred.js`, October 2026, issue #14)

The City-Shaft's load spent 2.5 s of its 6.8 s (on this Mac, High) checking every one of its trees against the
houses: a clump planted by the generator may stand a tree inside a house or push a crown through a wall, and each tree
is a dozen rays through the collision (`dropBuriedInstancesSteps`, at three heights on its axis and round it). That
check decides how a far tree looks and nothing else: the trees are walk-through, their trunk colliders stay, no route,
quest or person depends on them. So it, and the generic buried-flora check every world runs, are now queued as
**distant detail** (`DeferredWork`), a job at each tree's place:
- **Before the first frame**, every job within `DEFER.near` (140 m) of where the first frame looks from (the spawn, a
  saved place, an arrival by ship), of the ship's ramp and of every way through's far side ("near detail", a load
  step, sliced like the rest).
- **After it**, `DEFER.budget` (2 ms) a frame, the nearest first: the jobs sit in 32 m cells, and the queue walks rings
  of cells out from the traveller's (no sorting; a move to another cell starts the walk again round it), so a teleport,
  a passage or a fast ride is followed.
- **Within `DEFER.guard`** (70 m) of the traveller a job is done in that frame whatever the budget, and a passage
  finishes everything within 140 m of its far side under the paper (`need`), so nothing near is ever seen unfinished.
- An instanced mesh already cut into tiles (perf.js `tileSceneSteps`) draws from copies of its instances: the tiling
  records each instance's copy (`INSTANCE_COPIES`) and a late drop (`dropInstance`) drops both, sending only that
  instance's 16 floats again (`addUpdateRange`; dropping a few trees a frame had re-sent whole buffers).
- `?defer=0` checks everything at load as before (for A/B runs, `load-breakdown.mjs --query defer=0`).

What is kept as it was: collision (baked from everything at load), the routes and the crowd's places, the quests, the
landmarks, every silhouette. A buried tree far away can be seen for a few seconds after the first frame before its
job drops it; the near ones are gone before the world shows. The same trees end up dropped: every static instanced
mesh's dropped instances compared after the queue drained, with and without the deferral, are identical (the
City-Shaft's 285 of 8745, Vael's 91, the desert's 71). Tests: `tests/deferred.test.js`.

Measured on the Mac (M4 Pro, headless Chrome, ANGLE Metal, the machine loaded by other agents' test runs; the two
builds' runs interleaved, three each, medians; `load-breakdown.mjs --query defer=0|1`):

| World, preset | first frame before | after | collision before | after |
|---|---|---|---|---|
| City-Shaft, High | 7.76 s | 5.28 s | 3398 ms | 500 ms (and 350 ms of near detail) |
| City-Shaft, Handheld, CPU ×4 (the handheld recipe; two runs each) | 31.9 s | 19.0 s | 15.4-15.8 s | 0.77-0.79 s (and ~2 s of near detail) |
| Desert, High | 4.21 s | 4.17 s | 134 ms | 146 ms |
| Buried Machine, High | 4.51 s | 4.47 s | 136 ms | 128 ms |
| Lorn, High | 4.34 s | 4.38 s | 543 ms | 527 ms |

Elsewhere the flora checks were already quick (5,000-7,000 jobs done in 8-25 ms in all): the gain is the City-Shaft's.
After the first frame the queue drains in about 15 s of play on this Mac (17,378 jobs, 3.2 s of work). While it does,
a fast traversal there (40 m/s, `--traverse 15`) pays the budget: p50 / p95 / p99 9.1 / 11.1 / 15.5 ms before,
10.8 / 13.7 / 18.4 after (no frame over 50 ms more; the 300 ms frame is in both builds). The guard never had to
force a job on that run (the nearest-first walk stays ahead at 40 m/s); a teleport to the far end of the queue forced
176 jobs in one frame.

Tried and not kept:
- **One point for a tree in the open.** If no surface crosses the box round a tree's test points, they are all on one
  side of everything, so one point could stand for all. It is not exact: the City-Shaft's open meshes answer differently
  from points a metre apart, and 24 buried trees stayed (285 → 261). Testing only the axis in such a box: 263.
- **SAH for the City-Shaft's BVH** (`collision: { strategy: 'SAH' }`, as Lorn II's): the same trees dropped and the
  queries quicker (the trees' check 2.5 → 1.36 s, the crowd's routes 0.9 → 0.48 s), but the worker's build 0.4 → 1.6 s,
  and that is waited for: 6.7 → 6.2 s. With the trees deferred, the build's cost would outweigh the crowd's gain.
  (Since issue #300 the City-Shaft gets it without the wait: built behind the load and swapped in, see the last section.)

### The drifts' collision and the crowd's strollers, later too (October 2026, v1.49)

Two more kinds of work go through the queue, with the same three promises (done before the first frame within 140 m
of where it looks from, the ship and the ways through; done in the frame the traveller comes within 70 m; the same
result once drained, whatever the order). `DeferredWork.add` takes a job's **reach** (r: a job is near when its edge
is, not its middle), and a job run by the guard or a passage sees **`urgent`** (a job that is one part of something
bigger finishes the whole of it there and then).

**The drifts' collision** (`src/late-collision.js`). Where a skirt of banked sand is drawn over the ground's height, its
triangles collide as drawn (`SandDrifts.misfits`: 53 k triangles in the Buried Machine, 11 k in the desert, 5 k in Vael,
each tested at seven points against the height). In the game (`DRIFT_FITS.later`, set by main.js round the world's
build; off for tests, tools and the studio) `raise` instead cuts the skirts' triangles into 8 m squares
(`lateFitPieces`: copied, the height they are tested against already the world's), and main.js queues each square as
a piece once the collision exists. Exactness:
- **No query misses a piece.** Every waiting piece is listed in the 8 m squares its box covers; every ray, capsule and
  box through the collision (`compositeBVH`) first makes the pieces in the squares it crosses (a grid walk along a
  ray, the squares under a box). So the load's own queries (the temples' and the flora's footing, the ship's site,
  the wildlife's spots, the responsive world's rays) see the sand as before: ~100 of the Buried Machine's 650 pieces
  are made that way at load, ~80 more as near detail, the rest after the first frame.
- **A piece is made once**, by whoever asks first; what it makes is its triangles that pass the same test.
- **Few colliders**: the parts are merged as they come like a binary counter (a new part, then two of about the same
  size into one; merges over 6 000 triangles built in a worker, the parts answering till it is done), so there are
  never more than a dozen, and one once all is made. They are their own list (`late.extras`, after `physics.extras`):
  a query with the extras swapped (`Physics.asWas`, gadgets/world.js) still has the world's own sand. A hit on them is
  the ground for the footsteps (`ground: true`), as the baked mesh's was.
Checked in headless Chrome (Buried Machine, desert, Vael; `?defer=0` against the default, the queue then flushed):
the same fit triangles (53 343), the same answers to 60 000 rays over the map, the same ship site, the same static
instanced meshes (flora dropped and placed). Tests: `tests/late-collision.test.js`.

**The crowd's strollers** (`src/crowd.js buildPeopleSteps`). The City-Shaft spent 0.9-1.0 s at load testing its 32 walks
(every 1.5 m of 12 km, some twenty rays a sample). The walks were bound to each other: one random stream for all the
crowd in order, each walk tested against the lanes of the walks before it, and the people standing about kept clear of
the lanes as the routes came out. Now each walk stands alone: its own random streams (by its place in the list), its
route tested against what the level keeps clear and the ship's calm (not the other walks), its people ids of their own
(`WALK_ID0 + walk × 4096 + n`), and the lanes kept clear of those standing about are the walk's samples as drawn (every
second one, the same radius). Then a walk can be worked out at any time and comes out the same: with `defer` every walk
but a procession (the desert's, which the story steers by its id at load) is queued, its samples a chunk of 12 at a
time, the walk's people added to the crowd once its last chunk is done (`Crowd.addPeople`: the figures' buffers grow,
the people and routes kept in their id order), the whole walk at once when anything forces one of its chunks. A walk
worked out later tests the collision as it was at the crowd's step (`Physics.freeze`/`asWas`: the colliders added and
the moving ones' places then; the Signal Market's walks came out differently without it). What the story sets on
everyone is set on those who come later (`crowd.persist`: the City-Shaft's lit-lamp lines, the market's broadcast
lines); the flora no longer keeps clear of a stroller's starting place (nowhere in particular). In both modes the crowd
is a little different from v1.48's (other strollers, routes no longer cut where they cross); with and without the
deferral it is the same, person for person (ids, places, looks, routes): checked in the City-Shaft, the Signal
Market, the desert, the Glass Dunes, the Floating City and the Moon Foundry. Tests: `tests/crowd-later.test.js`.

Measured on the Mac (M4 Pro, headless Chrome, High, the machine shared with other agents; the two builds' runs
interleaved, three each, medians; `load-breakdown.mjs`):

| World | first frame before | after | the step it was in, before → after |
|---|---|---|---|
| Buried Machine | 5.04 s | 4.27 s | world creation 2558 → 1965 ms (and 60 ms more near detail) |
| City-Shaft | 5.52 s | 4.72 s | the crowd 974 → 149 ms (near detail 416 → 595: the walks by the rim) |
| City-Shaft, Handheld, CPU ×4 (two runs each) | 19.4 s | 16.1 s | the crowd 5.3 → 1.4 s |
| Desert, Glass Dunes, Signal Market, Vael | within noise (4.16/4.15, 2.62/2.61, 3.27/3.03, 4.50/4.60 s) | | the desert's pieces are mostly near its spawn |

A fast traversal while the queue drains (40 m/s, 15 s, two runs each), p50 / p95 / p99 / worst: City-Shaft
15.1 / 18.9 / 26.0 / 529 ms before, 16.1 / 19.5 / 28.4 / 541 after (the 0.5 s frame is in both); Buried Machine
7.0 / 9.4 / 11.6 / 21 before, 7.0 / 9.9 / 14.1 / 32 after.

### The same in the engines (October 2026, issue #385)

The Unity version (engine/game.js) had deferred only the trees' check (through `level.initSteps`): it made the drifts'
collision and worked out every stroller's walk before its first frame. It now does what main.js does, with the same
promises and the same `-js-off defer` to turn it all off:
- `DRIFT_FITS.later` round the world's build, the pieces queued once the collision exists (`queueLateCollision`). There is
  no worker in the engines' VMs, so a merge is built in the frame: `mergeMax: WORKER_TRIS` keeps the parts under 6 000
  triangles (the Buried Machine's last merges were 70-170 ms jobs in node), a dozen or so colliders at the end, not one.
  And a dense square is cut into pieces of at most 100 triangles to test (`DRIFT_FITS.most`, engine/game.js
  `DRIFT_PIECE`): a whole one was up to 50 ms to make in node; main.js keeps whole squares.
- The flora's burial checks in a queue of their own (`game.floraLater`), done near the first view before it like the rest,
  and after it only by the guard until the drifts' pieces are all made: a check's long rays (embedded's 400 m, buried's
  1000 m) make every piece of sand they cross, which on the Deck was a 200 ms frame in the Buried Machine's first seconds.
- The crowd built with `defer` and the ship's calm (`shipCalmZones`, which the engines also lacked).
- Found on the way, missing in the engines and added: the flora's burial check (`dropBuriedFloraSteps`, deferred as
  above: the engines never left out a shrub buried in a rock), the large plants' collider (`flora.collider`), `noClimbZones` and
  `ladders`. Still different: the engines build every world's BVH with CENTER (`level.collision`'s SAH is not read), and
  the wildlife has no `keepOff` round the ship.

Checked in node (`tests/engine-defer.test.js`, the engines' bundle in a bare V8, each mode in a VM of its own): at the
first frame no job is left within `DEFER.near` of the spawn, the footing and the walls round it answer as if everything
were made, a frame far off leaves nothing within the guard; drained, the drifts' triangles, the ground over 1.6 km, the
plants left out and the crowd, person for person, are the load's. In node the City-Shaft's build went 7.2 → 3.5 s with
everything deferred (most of it the trees, already deferred before); the walks' jobs are at most 13 ms each, the trees' 12.

Measured, launch to the world's first frame, the bundle before and after in the same player, interleaved, three runs
each, muted, `-level <w> -walk 15 -metrics`; "longest frame" is the longest from the first mirrored object over the
walk's 15 s (BridgeMetrics' first frames and its 5 s windows), the most of the three runs.

Steam Deck OLED: the v1.81 Linux player (`unity-linux`) with each bundle, gamescope headless 1280 × 800, a profile of its
own (no save, settings or volume touched); every run within ±0.15 s:

| World | first frame before | after | the load in the VM (near detail done) | longest frame, before → after |
|---|---|---|---|---|
| The Buried Machine | 12.31 s | **11.04 s (−1.27)** | 7.03 → 5.84 s | 36 → 49 ms |
| The City-Shaft (no bake) | 15.09 s | **14.01 s (−1.08)** | 9.87 → 8.79 s | 65 → 66 ms |
| The Desert | 11.76 s | 11.66 s (−0.10) | 6.53 → 6.41 s | 80 → 78 ms |
| Vael | 11.87 s | 11.87 s | 6.64 → 6.61 s | 42 → 49 ms |
| Lorn | 11.36 s | 11.41 s (+0.05: the flora's near checks, new) | 6.14 → 6.18 s | 65 → 72 ms |
| The Signal Market | 9.67 s | 9.67 s | 4.45 → 4.47 s | 84 → 89 ms |

Before the flora's own queue and the cut squares, the Buried Machine's first seconds had a 202-207 ms frame on the Deck
(a check's rays making the sand along them), and its load was the same. Mac (M4 Pro, the IL2CPP macOS player launched in
the background, the machine shared with other agents at load 12-50, medians of three): the Buried Machine 6.74 → 5.55 s,
the City-Shaft 8.63 → 7.82 s, the others within the noise (±0.5-0.7 s run to run). With the City-Shaft's bake (issue #385's
`src/world-bake.js`) its walks and trees are answered from the bake and nothing of the crowd is deferred: what this saves
there is the bake-less load's, and the other worlds'.

**Remote interiors: measured, not deferred.** The rooms far over the map (each world's temple, its shop, the desert's
chambers and the giant's cave) cost the load their build (the temples 66-154 ms with their outside in node profiles of
six worlds, the shops 20-46 ms with their fronts), their share of the collision's bake (7-22 % of a world's triangles)
and their warm-up draws. Deferring them would take every temple's runtime apart (its rooms, solids, doors, puzzles and
story are built together), and the warm-up moved to "as you come near a door" is a 1-15 s stall on the Xbox (above, "The
first draws on the Xbox"). At 0.1-0.2 s a world on this Mac, left as they are.

## The levels of detail against the load: an audit, and coarse-first generation (October 2026, issue #15)

What the levels of detail cost a load, and what they could take off it (the author's list: evaluate coarse-first
procedural generation and spatial activation together with the LOD; keep everything procedural).

**What exists, and what it costs at load.** Measured with `load-breakdown.mjs` (its levels of detail's state at the
first frame and after a 15 s traversal at 40 m/s, High, this Mac):

| World | meshes with levels | built by the first frame (packing on the main thread) | built after the traversal | still waiting |
|---|---|---|---|---|
| Desert | 394 | 38-42 (10 ms) | 115 (38-40 ms) | 0 |
| City-Shaft | 607 | 47-49 (4-10 ms) | 226-227 (58-70 ms) | 0 |
| Vael | 746 | 46-47 (13-19 ms) | 207 (100-109 ms) | 0 |
| Buried Machine | 208 | 59-65 (24 ms) | 106 (53 ms) | 0 |
| Lorn | 304 | 55-66 (17-20 ms) | 159-160 (52-61 ms) | 0 |
| Garden of Spheres | 505 | 42-59 (23-30 ms) | 168 (79-86 ms) | 0 |
| Signal Market | 312 | 118-123 (10-11 ms) | 330 (45 ms) | 0 |

- `src/lod.js` (static meshes) collects at load and builds a level the first time it is wanted, in its worker, two
  at a time: the load pays only the packing of the few the first view wants (4-30 ms). It is already spatial and lazy:
  a level far off that nobody looks at is never built. After 15 s of fast travel nothing is waiting.
- `src/skinned-lod.js` (the traveller's and the people's bodies) builds in a worker too, after the body exists; the
  crowd (`src/crowd.js`) draws its hundreds as GPU-animated figures and builds full bodies only for its pool
  (`CROWD_BUDGET.pool`: 6-31 ms of the load) and the nearest few promoted.
- So the levels of detail help the frame (the triangle tables above) and cost the load next to nothing; they cannot make
  it shorter, since each starts from geometry generated whole.

**Where generation goes** (the load's `phases`, above, and CPU profiles of the unminified build):
- World creation 0.5-2.5 s a world: the terrain and its relief by rows, the buildings, and in the sandy worlds the
  drifts' field (`src/sand-drifts.js`): in the Buried Machine 1.17 s of its 1.75 s build is `fieldAt` (the skirts' own
  points 0.48 s, the triangles that collide where the skirt stands over the height, `misfits`, 0.79 s); 0.27 s of the
  desert's 1.0 s.
- The City-Shaft's collision stage: the trees' check (2.5 s, now distant detail: above) and the crowd's routes (0.9 s).
- The still meshes' batches 60-560 ms (Vael's 564), the traveller ~0.3 s, the sound and tool ~0.12 s, in every world.

**Coarse-first generation, case by case.**
- *The terrain*: drawn tiled (`tileSceneSteps`) and with levels already; its collision is the exact `heightAt`, not the
  mesh. A coarse terrain first would be built twice (coarse, then fine) for the near tiles a first frame shows, and its
  far tiles are a few hundred ms in all. Not worth it.
- *The drifts' collision (`misfits`)*: collision, so it must be there before anyone walks on it, but only near: the far
  chunks could be queued as distant detail and each added as a collider (`physics.addCollider`) before the traveller
  comes within the guard. About 0.6 s of the Buried Machine's load on this Mac. Done in v1.49 (above, "The drifts'
  collision and the crowd's strollers, later too"), its pieces merged into a few colliders as they come.
- *The drifts' skirts* (0.48 s in the Buried Machine): they are the silhouette where sand meets a wall, seen from far;
  deferring the far ones would show sand banks appearing in the distance. Kept.
- *The people*: already coarse-first (GPU figures far, full bodies near). The content NPCs' bodies (36-92 ms) are near.
- *Remote interiors* (the desert's chambers and the giant's cave, ~1 km up): built with the world because the
  collision is baked once and the passage warms their draws ahead; deferring them means their collision added later
  (as above) and the warm-up moved to "as you come near a door" (`PASSAGE.near`), which the Xbox's draw-time compiles
  make a 1-15 s stall (`The first draws on the Xbox`). Not done.

**Spatial activation**: `DeferredWork` (src/deferred.js) is it: jobs in 32 m cells, walked out from the traveller,
the near ones before the first frame, a guard round him, a passage's far side finished under the paper. Anything that
decides only how a far thing looks can go through it; the trees and flora checks do.

**Grouped distant geometry**: the draw-call measurements justified it, and it is done for every still mesh, near and
far (`src/static-batch.js`, v1.45: the Xbox's desert spawn 937 → 399 draws). Impostors and merged far shadow casters
were measured before and did not pay (above, "Levels of detail far away").

## The Retroid, round 5: the Xbox's settings, the camps and the City-Shaft again, the machines, the merged worlds (October 2026)

The Retroid Pocket Nova (Adreno 650, pixel ratio 2), the GeckoView test app (`com.rnaud.hiraeth.gecko`) with the game
served from the Mac, built from 1606a596; the player's app untouched. The frame readout on. The game's sound at 0, read
back from the page before every run (`android-worlds.mjs` stops if music, effects or voices are above 0).
`android-worlds.mjs` has three new flags for this round. `--quality` runs a Graphics setting other than Handheld
(`auto`: what the game picks on the device). `--scale preset` keeps the scale the game chose. `--spawn 1` holds the
world's boot camera, then walks 40 m on from it. A fourth, `--foes`, stands a pack in front of the traveller (below).

**The Xbox's settings on the Retroid.** The Xbox runs the desert's spawn at 17–21 fps, with 46–56 ms of main thread a
frame. On the Retroid, the same spawn: held still 10 s ("start"), then walked ("walk"):

| preset | scale | view | fps | frame p50 / p95 ms | missed % | JS ms | draws | triangles | GPU busy % |
|---|---|---|---|---|---|---|---|---|---|
| Auto (it picks Handheld), dynamic | 0.65 (its own: 0.75 at first, 0.65 after the load) | start | 58.6 | 16.7 / 16.7 | 2.5 | 14.8 | 423 | 499 k | 54 |
| | | walk | 58.5 | 16.7 / 16.7 | 2.7 | 14.4 | 399 | 492 k | 53 |
| High, fixed | 1 (a pixel ratio of 2 is HiDPI: no 1.5×) | start | 42.9 | 16.7 / 33.4 | 28.6 | 18.0 | 511 | 807 k | 94 |
| | | walk | 44.0 | 16.7 / 33.4 | 26.8 | 17.5 | 492 | 803 k | 94 |
| Xbox, dynamic (as on the console) | 0.8, then 0.6 | start | 55.7 | 16.7 / 33.3 | 7.3 | 17.2 | 509 | 722 k | 67 |
| | | walk | 57.6 | 16.7 / 16.7 | 4.2 | 16.5 | 487 | 714 k | 66 |
| Xbox, held at 1 | 1 | start | 50.2 | 16.7 / 33.3 | 16.4 | 17.4 | 508 | 727 k | 92 |
| | | walk | 51.4 | 16.7 / 33.3 | 14.4 | 16.9 | 487 | 802 k | 92 |

- The Retroid drops too when given the full recipe, but on the GPU (92–94 % busy). Its main thread stays at 17–18 ms
  on High and on the Xbox preset, against 15 on Handheld. On High, of 19.0 ms: the G-buffer's draw loop 5.2, the
  shadow passes 3.45 (1.5 on Handheld), the traveller 1.4, the people 0.95. So the Xbox's 46–56 ms are not the
  preset's: the same preset's work costs the Adreno's phone CPU 17 ms. What is left is the console's own platform:
  WebView2's GL calls through ANGLE, or its JS.

**The camps and the City-Shaft again (#49).** These views are slower than in round 4. An A/B in one sitting, round
4's build (81f0311) against this one, at the fixed 0.75, settles that it is the build and not the device's heat:

| view | fps | missed % | JS ms | draws | triangles | load s | memory after load (tab) MB |
|---|---|---|---|---|---|---|---|
| City-Shaft, the rim (start) | 58.6 → 45.6 | 2.5 → 24.1 | 14.2 → 21.9 | 868 → 1011 | 2.7 M → 3.3 M | 17.1 → 23.2 | 858 → 1080 |
| City-Shaft, wide | 43.5 → 39.5 | 27.6 → 34.2 | 17.1 → 23.4 | 1152 → 1196 | 3.1 M → 3.4 M | | |
| the camps | 55.5 → 50.9 | 7.6 → 15.2 | 17.0 → 18.6 | 409 → 446 | 738 k → 560 k | 9.8 → 14.7 | 744 → 840 |
| the walk through the camps | 49.8 → 46.6 | 17.1 → 22.5 | 18.9 → 20.3 | 478 → 520 | 729 k → 560 k | | |

At the City-Shaft's rim, by system (`--profile`), 14.6 → 21.9 ms:
- the G-buffer's draw loop 4.7 → 6.8;
- the shadow passes 2.2 → 2.9;
- the level's own update 0.5 → 1.3;
- the room culler (`r.interior`) 1.0, not there in round 4;
- the rest 2.0 → 3.4.

At the camps the people are 3.8 → 2.8 ms, cheaper, but the G-buffer is 4.9 → 5.7. The shirt (the traveller's update)
is 1.0–1.4 ms in both builds, not the ~0.3 hoped for. The commits between 81f0311 and 1606a596 that add draws and
work to the City-Shaft are the place to look: a bisect on the rim's view is the next step.

The rest of the desert and the City-Shaft (this build, fixed 0.75): Qanat 52 fps (JS 18.6), the ride to the city 51
(18.2), the City-Shaft's crowd 49 (20.2), crowd2 53 (18.8), its walk 44 (21.0). The cave holds 59.4 fps (GPU 44 %,
fixed and dynamic alike, #50).

**The machines' CPU (#30).** The Arena at its boot camera, Handheld at 0.75, a pack of six stood 7–11 m ahead (each
posed every frame, still, as `scripts/enemy-roster/bench.mjs` does; their AI, so the cart's ground rays, not run):

| pack | fps | JS ms | G-buffer ms | shadows ms | draws | triangles |
|---|---|---|---|---|---|---|
| none | 60 | 7.5 | 2.6 | 0.7 | 134 | 170 k |
| six blots | 60 | 9.9 | 3.6 | 1.4 | 362 | 190 k |
| two brutes, two drones, two carts | 60 | 12.0 | 5.5 | 1.4 | 247 | 325 k |
| six carts | 60 | 12.5 | 5.7 | 1.7 | 302 | 308 k |

So a machine costs the handheld ~0.75–0.8 ms, a blot ~0.4. Most of it is three.js drawing their skinned parts in the
G-buffer (+2.9 ms for six machines), not their posing. Headless on the Mac it was 0.25 ms a machine: the Retroid
is about 3× the Mac. Six in view still leave the Arena at 60 fps, with 4–5 ms to spare.

**The merged worlds (#19).** Handheld, fixed at 0.75 → dynamic. Vael and Lorn are measured at the views picked before
they were merged, the Glass Dunes at views picked this round (`--pick 1`):

| world | fps | JS ms | draws | GPU % | load s | memory after load (tab) MB |
|---|---|---|---|---|---|---|
| Vael (start, crowd, crowd2, wide, walk) | 57.6–59.9 → 58.1–59.9 | 12.2–16.5 | 249–772 | 71–80 → 60–79 | 14.0 | 1398 |
| Lorn | 58.9–60.1 → 59.1–59.9 | 12.1–15.6 | 347–695 | 61–81 → 67–84 | 15.6 | 854 |
| The Glass Dunes | 59.6–60 → 59.5–60 | 12.1–14.0 | 216–477 | 54–63 → 64–77 | 11.7 | 663 |

The bigger terrains hold 60 on the handheld. The heaviest is Vael's start and its walk: 740–770 draws, JS 15–16.5
ms, 58–59 fps. Dynamic resolution there sits at 0.65–0.8.

**The speaker's portrait in the device's Chrome (#48).** `scripts/portrait-check.mjs --android 1` (new: the device's
Chrome over `adb forward … chrome_devtools_remote`, in a tab the script's intent opened and that it closes) in Chrome
154 (it reports "Adreno (TM) 740"). Four conversations in the desert, Handheld and High at the device's 2×, every
portrait drawn: 210 × 210, 223–441 colours, the commonest 38–61 %. The item card's picture drew too. The blank disc
does not reproduce in Chrome either.

**The buttons in GeckoView (#50).** `scripts/bench/android-pad.mjs` sends each control as a gamepad key, held
(`input gamepad keyevent --longpress`). A plain tap's press and release land within PadBridge's 8 ms batch and
reach the page as nothing. It then reads what the page received. Every control reached the page's Standard Gamepad
at its own index except the d-pad's up. Up never reached it, alone or in the sequence, while down, left and right
did. B (the bottom button on the Retroid) made the traveller jump, 2.5 m. Start opened the menu and Select closed it.
The injected device is "Virtual", so the Retroid's name-based layout guess is not tested this way. A real press of
up, and the layout, still need hands on the device. The upgrade over the installed app was not tried: the only app to
upgrade over is the player's own.

## The Steam Deck, round 3: every world after the Deck's pass, GL against Vulkan (October 2026)

**How it was measured.** The Steam Deck OLED in Gaming Mode, plugged in, on 11 October. Runtime 1668001 served the
game of 1606a596 (`dist/` copied to `~/.local/share/hiraeth-bench-games/`):
`PORT=5420 REFRESH=90 scripts/bench/deck-run.sh start headless <dir>`, then
`deck-worlds.mjs --secs 6 --warmup 2`. The settings were the Steam Deck preset, fixed and dynamic, then High at 1.5×.
1280 × 800, ANGLE on radeonsi GL. Only the bench ran this time; in round 2 the player's game was open on its title,
so round 2's "before" was a little pessimistic.

**Every world** (each cell: the views' median fps (the slowest view's), then the JS / GPU ms a frame (medians of the
views); dynamic: the lowest view's median scale):

| world | High 1.5× | Steam Deck, fixed | Steam Deck, dynamic | Steam Deck in round 2 |
|---|---|---|---|---|
| desert | 32 (28); 30.1 / 25.5 | 39 (36); 24.7 / 10.6 | 47 (40); 21.1 / 6.4; ×0.70 | 29 (26) |
| City-Shaft (incal) | 26 (19); 37.0 / 33.2 | 33 (33); 29.4 / 14.1 | 35 (35); 28.0 / 13.7; ×1.00 | 26 (26) |
| Signal Market | 42 (40); 22.8 / 21.2 | 56 (48); 17.6 / 10.7 | 56 (48); 17.6 / 8.7; ×0.90 | 46 (39) |
| Vael | 40 (33); 22.3 / 24.3 | 58 (39); 17.0 / 14.5 | 58 (41); 17.2 / 11.1; ×1.00 | 53 (43) |
| Vael II (arzach2) | 42 (30); 22.6 / 18.9 | 50 (42); 19.7 / 9.4 | 52 (40); 19.0 / 8.9; ×0.90 | 48 (42) |
| Sealed Hangar | 54 (51); 16.9 / 18.0 | 74 (64); 13.1 / 9.4 | 72 (65); 13.6 / 7.5; ×0.90 | 53 (45) |
| Buried Machine | 48 (47); 19.2 / 19.8 | 65 (59); 15.1 / 10.3 | 63 (61); 15.5 / 8.9; ×0.90 | 52 (50) |
| Viridel | 56 (45); 16.8 / 16.5 | 61 (52); 16.3 / 8.0 | 65 (56); 15.1 / 6.9; ×0.90 | 51 (43) |
| Garden of Spheres | 53 (48); 17.5 / 18.3 | 65 (55); 15.2 / 9.8 | 70 (60); 14.2 / 8.2; ×0.90 | 56 (48) |
| Lorn | 41 (38); 23.1 / 22.4 | 48 (43); 20.6 / 11.9 | 49 (45); 20.2 / 11.7; ×1.00 | 54 (52) |
| Lorn II (perdide2) | 41 (39); 23.0 / 22.5 | 51 (45); 19.5 / 12.0 | 50 (45); 19.9 / 9.0; ×0.80 | 50 (47) |
| Home | 60 (56); 15.5 / 16.1 | 71 (67); 14.0 / 8.4 | 73 (70); 13.7 / 8.3; ×1.00 | 57 (55) |

The desert's views, High 1.5× → Deck fixed → Deck dynamic, in fps:
- the spawn 34 → 39 → 43;
- Qanat 32 → 40 → 48;
- the camps 31 → 38 → 47;
- the dunes 49 → 58 → 62;
- the cave 65 → 74 → 81;
- the ride 30 → 37 → 44;
- the walk through the camps 28 → 36 → 40.

The City-Shaft's rim: 19 → 33 → 35.

- **The Steam Deck preset is 7–20 fps ahead of High at 1.5× in every world.** Its JS is 2–8 ms lower, and its GPU
  time about half of High's.
- **Against round 2** (v1.37, its Deck preset before the round's changes): ahead by 5–21 fps in ten worlds. The run
  conditions differ (above), so part of that is the player's game no longer running. Lorn is 6 fps slower
  (54 → 48), its JS 18.0 → 20.6 ms: Lorn grew with its merge (#19).
- **Dynamic resolution helps now in the desert.** The probe (`D.probe`) steps the desert down to 0.7, and its views
  run 4–9 fps faster: the JS also falls, 24.7 → 21.1 ms, since the main thread waits less on the GPU. Elsewhere it
  holds 0.9–1.0 at the same frame rate as fixed.
- **The City-Shaft is still the slowest**, at 33–35 fps (29 ms of JS, 870–1110 draws). It was 42 on 7 October (v0.80).
  It is the same slowdown as on the Retroid (round 5 above: the rim's JS 14 → 22 ms since round 4).
- Loads: 11–37 s. The first load was 36.7 s, since it spends ~1 s learning the GPU pacer's fences never signal on GL;
  the next loads skip that. The Buried Machine's dynamic load once sat on "mixing the inks… / passage" past 16 s
  (35 s in all).

**ANGLE's GL against Vulkan (#52)**, the same build, the Steam Deck preset fixed at 1 (`GPU=vulkan deck-run.sh …`;
the GL column from the run above). Each cell: fps; JS / GPU ms:

| view | GL | Vulkan |
|---|---|---|
| desert spawn | 39; 24.7 / 12.1 | 20.6; 27.6 / 26.6 |
| desert camps | 38; 25.8 / 11.2 | 21.1; 27.6 / 26.1 |
| desert dunes | 58; 16.2 / 10.6 | 27.7; 17.1 / 20.4 |
| desert cave | 74; 12.9 / 6.7 | 34.4; 14.6 / 12.5 |
| City-Shaft start | 33; 30.7 / 13.2 | 17.4; 31.9 / 36.7 |
| City-Shaft wide | 33; 30.4 / 20.1 | 16.3; 32.6 / 41.9 |
| Signal Market start | 48; 20.4 / 10.7 | 23.5; 23.3 / 24.9 |
| Signal Market crowd | 58; 16.8 / 8.3 | 28.4; 18.9 / 19.4 |

Vulkan halves the frame rate everywhere: the GPU's time is 2–3× GL's, and the JS is about the same. This agrees
with round 2 (19 against 33 fps at the spawn). On Vulkan the fences do signal: the desert loaded in 12 s with no
pacer warning. The Deck stays on GL.

## The Steam Deck, round 4: its own resolution, and what keeps it from 60 (issue #111, October 2026)

The issue: "it doesn't hit 60 fps and looks low resolution". Native is 1280 × 800 at render scale 1.

**Why it looked low resolution.** The Steam Deck preset adapted its scale (0.6–1) by the missed-refresh rule and its
probe (`D.probe`), and in round 3 the probe took the desert down to 0.7. It ran 4–9 fps faster there, but the picture
was 70 % of the screen's. The preset now has no dynamic resolution (`dynamic: null`): it is always 1280 × 800 at
scale 1. That gives back those fps in the desert (round 3: 47 → 39 at the views' median). Elsewhere the scale held
0.9–1.0 anyway.

**Measured on the Mac, not the Deck.** The Deck was asleep through this work. The proxy is
`scripts/bench/deck-mac.mjs`: the built game in a muted headless Chrome at 1280 × 800 on the M4 Pro's GPU. It is driven by
`deck-worlds.mjs --origin http://127.0.0.1:<port>/index.html --slow 3 --size 1280x800 --profile 1`, the Deck's own
run with the CPU slowed ×3 (`Emulation.setCPUThrottlingRate`). The GPU isn't slowed, so its ms say nothing about the
Deck's. Against round 3's Deck numbers, ×3 is close to the Deck's main thread or a little kinder: the desert 20–23 ms
of JS here against 24.7 there, the City-Shaft 25 against 29, the Market 13–17 against 17.6. `--profile` now also
counts each pass's draws (`draws.gbuffer`, `draws.shadow`). The Mac was shared with other agents' jobs (load average
7–35), so two runs of one build differ by up to 10 ms of JS. The draws are exact; the timings are only a guide.

**Where a busy frame goes** (the City-Shaft's start, ×3; V8's profile at ×4 for the shares):
- the G-buffer pass, 6–7 ms: 350 draws, three's walk of the scene (`projectObject`, ~5 000 objects a pass) and its
  per-draw work. The far-detail knobs (props, plants, crowd, levels of detail) don't move it (1 draw in 480). What is
  drawn: the trees (113 draws: 3 kinds × the terraces × 8 sectors), 70 banners in their own materials (each a different
  glyph size), people (55), the rust drones (25), cabs (25), the still batches (39);
- the matrices, ~4 ms: 9 700 visits a frame. The scene's walk is ~5 000; the traveller's rig (373 objects) is walked
  six or seven more times (`standUnder`, the arms, the cloth twice, the body), and the cabs 80 times;
- the shadow passes, ~2 ms; the traveller, the people and the crowd, ~5 ms;
- the distant detail checked after arrival (`src/deferred.js`), 2 ms a frame until it is done: about 3 s of work on
  the Mac, so a minute or two after arriving on the Deck.

**What changed** (draws a frame over all passes, from the passes' own counts; ×3 JS before → after, one run each):
- **The far map every 8th frame** on the Deck preset (`farEvery: 8`, was 4). It is most of the shadow draws (195 a
  pass in the City-Shaft against the near map's 140). What it shows is over 120 m off, and nothing there moves enough
  to see the difference at 1280 × 800. It is still drawn again at once when the sun turns or the view leaves what it
  was culled for. Shadow draws a frame: the City-Shaft's start 137 → 112, its wide view 165 → 136, the Market's start
  109 → 87, the desert's spawn 91 → 74, the camps 76 → 60.
- **Banners wave only within 160 m and in view** (`waveBanners`, `src/life.js`: the City-Shaft's 70 and the desert's
  two poles; the desert city's own did already). The City-Shaft's level update: 1.8 → 1.1 ms.
- **The matrix cache multiplies only what changed** (`src/matrix-cache.js`). A forced walk (`updateMatrixWorld(true)`,
  or one entered below the scene's root) used to multiply every object under its entry. Now it multiplies the entry,
  and goes on into a child only when the child's world matrix really changed. Objects whose matrix their owner writes
  (`matrixAutoUpdate` false) are still multiplied in a forced walk. The matrices are the same as three's
  (`tests/matrix-cache.test.js`, `tests/pose-exact-web.test.js`). It saves the multiplies, ~9 900 → ~8 000 a frame in
  the City-Shaft, but not the visits: the rig's bones really move between its walks.
  **Three's `updateWorldMatrix` goes through the cache too** (v1.57, issue #184). Three's own (what `getWorldPosition`,
  `getWorldQuaternion`, `attach` and `lookAt` call) multiplies the object's parents again without flagging their other
  children, so the next walk found those parents unchanged and left the children where the parent had been: the tank's
  socket, read while the hoverbike was ridden, left every mesh of the bike at the spot it was boarded. The cache's
  `updateWorldMatrixCached` makes the way down with `updateChain` (the children off the way flagged where a matrix
  changed), so the web game and the Unity bridge (which installs the same cache) keep them. `tests/bike-visible.test.js`.

**Tried and left out.** The City-Shaft's trees in quarters instead of eighths: draws 521 → 473 at the start and 613 → 551
at the wide view, but 2.2 → 2.5 M triangles at the crowd, and the near map's triangles were why the eighths were made.
Not without the Deck's GPU numbers.

**60 at native is not reached in the busy places.** The JS a frame (×3) is still ~20 ms in the desert's spawn and
camps, ~24 in the City-Shaft and 13–16 in the Market, against the 16.7 ms that 60 needs. The Market's crowd and wide
views make 60 on the proxy; its start is at 57. Halving the desert's and the City-Shaft's main thread would take
structural work, not the preset's knobs:
- fewer draws: the trees in one multi-draw (`BatchedMesh`) instead of 113 instanced meshes, and the banners in one
  merged mesh with their values per vertex (`S_VMAT`, which needs the glyph size per vertex);
- the shadow passes culled from a list instead of walking the scene;
- the rig walked once a frame instead of six or seven times.

**Gaming Mode on the OLED runs at 90 Hz.** Frames come in steps of 11.1 ms, so a 14 ms frame is shown at 45 fps, not
70. At 60 Hz (Steam's quick-access Performance menu, *Refresh rate*, a per-game setting the player picks), every frame
under 16.7 ms is a 60.

**To measure on the Deck** (as in "The Steam Deck" above): copy `dist/` there and run
`deck-run.sh start headless <dir>` with `REFRESH=60`, as well as the usual 90, then `deck-worlds.mjs --quality deck
--modes fixed --profile 1`.

## The Steam Deck, round 5: measured on the Deck, and the levers (issue #111, October 2026)

**How it was measured.** The Steam Deck OLED (Galileo) in Gaming Mode, plugged in, 11 October, runtime 1819001.
Each build was copied to `~/.local/share/hiraeth-bench-games/` and run in gamescope's headless backend
(`PORT=5420 REFRESH=90 deck-run.sh start headless <dir>`, the OLED's 90 Hz; `REFRESH=60` for the 60 Hz rows), muted,
in the bench's own profile. `deck-worlds.mjs --settle 1 --profile 1 --draws 1 --shots 1`: 1280 × 800, the Steam Deck
preset at scale 1, ANGLE on radeonsi GL, 6 s a view after 2 s of warm-up. New in the script:
- `--settle` waits for the distant detail queued at the load (`src/deferred.js`) before the views. In the City-Shaft that is
  18 000 jobs, ~9 s of work at 2 ms a frame: **86 s after arriving on the Deck**, during which every frame carries 2 ms more.
  The first runs of this round, without it, measured the City-Shaft 2 ms slower than it settles.
- `--draws` counts each pass's draws by what they draw (`scripts/bench/draw-census.js`).
- `--shots` saves each view as the Deck shows it.

V8's profile on the Deck (`--cpuprofile 1` on an unminified build) said where the frame goes; the levers below were picked
by it and each was measured on the Deck against the build before it, in the same sitting. Two runs of one build differ by
up to ~1 ms of JS.

**Before → after** (90 Hz; frames come in steps of 11.1 ms, so a 24 ms frame shows as 22 or 33):

| view | fps | frame ms (median) | frame ms (p95) | JS ms | GPU ms | draws (G-buffer + shadows) |
|---|---|---|---|---|---|---|
| desert spawn | 40.4 → 40.9 | 22.2 → 22.2 | 33.4 → 33.4 | 24.4 → 24.1 | 10.7 → 10.7 | 237 + 68 → 226 + 69 |
| desert camps | 36 → 35.8 | 33.2 → 33.2 | 33.4 → 33.4 | 27.4 → 27.4 | 11.5 → 11.6 | 211 + 50 → 204 + 54 |
| City-Shaft rim (start) | 35.5 → 40.9 | 33.2 → 22.2 | 33.4 → 33.4 | 28 → 24 | 17.4 → 14.3 | 337 + 103 → 257 + 102 |
| City-Shaft crowd | 34.6 → 38.3 | 33.3 → 22.3 | 33.4 → 33.4 | 28.5 → 25.8 | 12.5 → 14.4 | 200 + 75 → 190 + 76 |
| City-Shaft wide | 34.8 → 39 | 33.3 → 22.3 | 33.4 → 33.4 | 28.6 → 24.7 | 20 → 21.7 | 381 + 125 → 261 + 128 |
| Signal Market start | 47.7 → 47.7 | 22.2 → 22.2 | 22.3 → 22.3 | 20.3 → 20.4 | 11.6 → 11.6 | 176 + 79 → 177 + 78 |
| Signal Market crowd | 52.6 → 52 | 22.2 → 22.2 | 22.3 → 22.3 | 18.4 → 18.6 | 8.3 → 9.5 | 91 + 56 → 85 + 53 |
| Signal Market wide | 59.8 → 57.3 | 22.1 → 22.1 | 22.3 → 22.3 | 16.3 → 16.9 | 12 → 12.1 | 167 + 63 → 164 + 61 |

(GPU ms is the timer queries' median; the City-Shaft's GPU numbers wander by 2–3 ms between runs of one build.)

At 60 Hz (`REFRESH=60`) the old build measured the same as at 90: the desert's spawn 41.4 fps (JS 23.7), the camps 37.6
(26.4), the City-Shaft 34.7–35.7 (27.7–28.6), every view's p95 33.4 ms. The Deck left the network before the new build's
60 Hz run, so that row is still to take; with 24–27 ms of JS a frame it can't be under 16.7 at 60 Hz either.

**Kept** (City-Shaft JS before → after each, the views' range):
- **The City-Shaft's 70 banners are one mesh** (`src/life.js BannerSet`). Each was a draw and a material of its own (its
  colour, its glyphs' size). Now their colours and grid go per vertex (S_VMAT), the glyphs' cells with the grid
  (`S_VGLYPH`), and each is still waved on the main thread by its own Banner (in view, within 160 m), which writes its new
  shape into the merged mesh's ranges. The same picture: 470–533 draws from 501–585, JS −1.3 to −1.6 ms.
- **The merged towers share batches** (`src/static-batch.js restKey`). The still meshes' batches kept every merged
  (S_VMAT) material apart, so each merged group of towers was a draw; now those whose other uniforms agree share one. The
  City-Shaft −45 to −60 draws, JS −1 to −1.5 ms; nothing elsewhere changed.
- **The room culler keeps its bounds** (`perf.js InteriorCuller.boundsAt`). The rim is a room's height over the map, and
  its room is the whole city, so the culler took ~3 000 spheres into the world every frame. Now a sphere is taken again
  only when its matrix or its own sphere changed: 1.5 → 0.7 ms.
- **A cab updates its own matrix only** (`src/taxi.js`): `updateWorldMatrix(false, false)` for its seat and its
  collision, its ~30 parts left to the frame's walk (the one you ride walks them all). The forced walks were 0.7 ms; the
  frame's walk took 0.4 of it back.
- **A machine's bounds once a frame** (`src/enemies/plans/kit.js`, `src/render-frame.js`): three reads a skinned
  machine's `boundingSphere` in every pass to sort it, and the getter walked every joint's box up to the root each time
  (the City-Shaft's 25 rust-drone parts, ~1 ms). It now works it out once per frame while the passes draw (`RENDER_FRAME`,
  kept by `pinRenderFrame`), exactly outside them. G-buffer pass 6.9 → 6.5 ms.
- **The shield's disc is three meshes, not nine** (`src/shield.js`): its rim and the six folded ribs merged (one
  material, never moved apart). −6 draws in every view where it is worn.

**Tried and left out**:
- **The City-Shaft's trees in quarters** (round 4's idea): draws 473 → 422 at the rim, 533 → 467 down the shaft, but the
  JS the same (25.9 → 26.9, 26.6 → 26.6) and the GPU no better (14.4 → 17.7, 21.7 → 21.8). The tree draws share one
  material, so three hardly pays for them; the eighths stay. A multi-draw (`BatchedMesh`) of the trees would need the
  surface shader to read an instance from `gl_DrawID`, and three's per-instance culling of 8 700 trees in every pass
  would cost about what it saves.
- **The desert's mesas in one batch** (each mesa's colours and band size per vertex, one material for all): −14 draws at
  the spawn, the JS the same (23.6 → 23.6).
- **The traveller's rig walked once** and **the shadow passes from a list**: measured first, not done. Since round 4's
  matrix cache the rig's extra walks are ~0.7 ms in all; the shadow passes' walk of the scene is ~1 ms of their ~2.5.
  Neither moves a view across a step of the refresh.

**Where a frame goes now** (City-Shaft rim, V8's profile, which adds ~15 %): the G-buffer pass 9.3 ms (three's walk of
the scene 3.4: ~5 000 objects; the draws 5.8: uniforms, program and vertex-array binding for ~260 draws), the matrix walk
3.5 (the whole scene, 5 000 objects, 38 % of them under something hidden), the shadow passes 2.7, the still batches'
checks 1.3, the shadow culling 0.8, the hero map 0.7, the small-prop and room cullers 1.3; the traveller 2.2, the
crowd's walkers 2.2, the people 1.0, the level 1.3. In the desert, the temples' update runs 1 ms a frame far from
any temple (`src/temples/runtime.js`: pieces that are solid or burn update outside too), and the wind's field 0.7.

**60 at native is still not reached** in the desert or the City-Shaft: 24–27 ms of JS a frame against 16.7. The Signal
Market's wide view is at the edge (16–17 ms). What would take the next third off is structural: a scene walk that skips
what has not changed (most of the 5 000 objects never move, but three and the matrix cache visit every one each frame),
and fewer distinct materials in the G-buffer (the uniforms and bindings, not the draws as such).

## The Steam Deck, round 6: the Unity bridge's Linux player (issue #111, October 2026)

**What ran.** The bridge (docs/systems/engine-bridge.md: the same `src/` in Puerts' V8, drawn by the C# port's ink
look) as a native Linux player, not through Proton: IL2CPP x86_64, Vulkan on RADV (Mesa 26.2.0-devel), the Steam Deck
OLED in Gaming Mode, plugged in. `scripts/bench/deck-unity.sh` copies a player to `~/.local/share/hiraeth-bench-games/`
and runs it in gamescope's headless backend at 1280 × 800 and 90 Hz (`REFRESH=60` for 60), muted (`-mute`), with its
data in a profile of its own (`XDG_CONFIG_HOME`), at the bench's views (`-views`, the web run's: viewpoints.json's
desert, viewpoints-worlds.json's City-Shaft and Signal Market), 6 s a view, `-metrics` (BridgeMetrics: unity.log).
Each view is measured a second time after a first pass (the numbers below), frames uncapped unless said. The web build
was measured in the same sitting, from the same commit (`deck-worlds.mjs --settle 1 --shots 1`, the Deck preset, 90 Hz).

**Before anything else.** The published Mono player (`unity-linux`, `ba91e960`) never started on the Deck: Puerts threw
`csType.GetNestedTypes is not a function` (its reflection over System.Type, stripped under Mono most likely), after
c53ec0a5's shadow NullReferenceException. The Linux player is IL2CPP now (`BridgeBuild.Linux` without `-mono`; on a
Mac with Unity's Linux sysroot packages, docs/systems/unity.md), as the Mac, the APK and the Xbox are.

**The results** (fps; median and 95th-percentile frame ms; the script's thread ms a frame; GPU ms). The script runs on
its own thread, so the frame is the longer of the script and Unity's own frame (the GPU, here), not their sum as on the
web's main thread:

| view | web (Deck preset, vsync 90) | Unity, first run (High; its fps from the median) | Unity now (the Deck's preset, lean variant) |
|---|---|---|---|
| desert spawn | 40.9 · 22.3 / 33.4 · JS 23.9 · GPU 10.7 | 56 · 17.8 / 21.5 · 15.2 · 17.2 | **64.2** · 15.3 / 19.5 · 14.1 · 14.8 |
| desert camps | 36.7 · 22.3 / 33.4 · 26.7 · 11.6 | 48 · 20.8 / 24.7 · 19.4 · 18.7 | **56.5** · 17.6 / 20.1 · 16.2 · 16.1 |
| City-Shaft rim | 40.7 · 22.2 / 33.4 · 24.1 · 17.2 | 32 · 31.4 / 36.4 · 22.3 · 31.2 | **45.7** · 21.5 / 26.5 · 20.1 · 19.0 |
| City-Shaft crowd | 38.2 · 22.3 / 33.4 · 25.7 · 14.2 | 41 · 24.1 / 27.5 · 22.7 · 22.4 | **47.3** · 20.6 / 24.5 · 19.2 · 17.9 |
| City-Shaft wide | 39.6 · 22.3 / 33.4 · 24.6 · 21.6 | 27 · 36.6 / 41.3 · 22.7 · 36.3 | **41.5** · 23.3 / 29.1 · 21.3 · 23.9 |
| Signal Market start | 49.1 · 22.2 / 22.3 · 19.8 · 11.6 | 54 · 18.6 / 23.9 · 17.6 · 17.3 | **66.3** · 15.0 / 17.0 · 14.0 · 13.3 |
| Signal Market crowd | 54.1 · 22.2 / 22.3 · 17.9 · 9.4 | 58 · 17.3 / 19.7 · 16.4 · 15.5 | **71.7** · 13.9 / 15.4 · 13.1 · 11.7 |
| Signal Market wide | 60.2 · 11.2 / 22.3 · 16.2 · 11.7 | 58 · 17.3 / 18.3 · 13.6 · 17.0 | **72.7** · 13.4 / 16.9 · 12.4 · 13.0 |

At 60 Hz with vsync (`-vsync 1`, before the lean variant): the desert 61 / 54, the Signal Market 60 in every view (its
p95 18 ms), the City-Shaft 43 / 47 / 36. At 90 Hz `-vsync 1` measured as uncapped: gamescope does not hold the
player's frames to the refresh there. The load (a second launch): the world settled 10-20 s after launch, its longest
frame under 0.1 s.

**Kept:**
- **The Deck's preset** (`-quality deck`, the Linux player's default; `Quality.Set("deck")` and engine/game.js's `Q`):
  the shadow maps as the web's Deck (no fine map, near 4096 over 120 m every 2nd frame, far every 8th, 4 taps), and the
  script's detail as main.js applies it: flora at 0.65 and to 0.75 of its distance, the Deck's grass patch, the crowd's
  ranges and distant figures, props under 1.5 px hidden from the mirror, the people's low detail, lighter weathering, no
  cloud shadows. Before it the bridge drew everything as the bench's High. City-Shaft rim GPU 31 → 23.7 ms, the wide view
  36 → 31.
- **The Surface shader's lean variant** (`HIRAETH_LEAN`, `BridgeRenderer.Lean`; `-no-lean` off, `-lean` elsewhere): the
  G-buffer pass is one shader with every material's paths, ~25 000 instructions and 168 VGPRs on RADV (6 waves a SIMD;
  `RADV_DEBUG=shaderstats`), and every pixel paid its registers. A material with no water, terrain, glass, fluid, makers'
  box, scrub, veins, drawn face or dissolve draws a variant without them (about 13 000 instructions, 128 VGPRs, 8 waves):
  1 551 of the City-Shaft's 1 634 materials. The rim's GPU 26.4 → 19.0 ms, the wide view 27.7 → 23.9; the same picture
  (the shots differ only where people and motes moved).
- **The GPU Resident Drawer off** on the Linux player, as on the Xbox (`-grd` keeps it): 0.3-0.7 ms.

**Tried and left out** (the City-Shaft, against the run before): the shadow maps as renderer lists (the same), uniform
vertex layouts (the same), no shadows at all (GPU −6 ms: the shadows are not what is slow), URP's own shadow pass off
(nothing: it draws none), bloom or FXAA off (−0.5 ms each), the water's contact foam off (the same), no HUD (the same),
the web's levels of detail for distant meshes in the bridge (`LodManager`: the GPU −1 ms in the wide view, the same
elsewhere, and a 130 ms hitch while it builds them), render scale 0.5 (31 → 19 ms GPU: the pixels are half of it; not
kept: native resolution).

**The load's stall on Vulkan.** A first launch with no caches stalls 4 s on one frame (the pipelines made at first
draw). After it, Mesa's own disk cache (`~/.cache/mesa_shader_cache`, persistent) takes the stall to under 0.1 s
on its own; Unity's pipeline cache (`vulkan_pso_cache.bin`) is the same help when Mesa's is off, and the bridge's
prewarm (BridgePrewarm) does nothing on Vulkan (a 3.8 s first frame with it, no caches). Unity keeps its pipeline
cache in `temporaryCachePath`, `/tmp/rnaud/Hiraeth JS/`, which SteamOS clears at boot: a launcher should set `TMPDIR` to a
persistent folder (it moves there: tried). GraphicsStateCollection would do what Mesa's cache already does here.

**What keeps the City-Shaft from 60.** Two things of about 20 ms each: the script's own thread (the game's update 10 ms,
the mirror 10) and the GPU (the G-buffer's pixels, ~12 ms of the 19-24). The desert and the Signal Market are over 55,
and the Market over 60 at 60 Hz.

**How players get it** (done, issue #146). The Unity player is not the whole game yet: no menus, conversations or
pages, and its saves are its own (PlayerPrefs, not the Electron profile's). So not *instead of* the web build but
*beside* it: a second Steam shortcut, "Hiraeth (Unity preview)", launched by deck.py with `TMPDIR` set and its own data
folder. Not in the package (it would triple it): deck.py installs and updates the `unity-linux` player as its own
component, by the release asset's digest (docs/steam-deck.md, "The Unity preview").

## The Steam Deck, round 7: toward 60 through the Unity bridge (issue #111, October 2026)

The same rig as round 6 (the Linux player, IL2CPP, Vulkan on RADV, the Deck's preset, lean variant, the OLED at 90 Hz
uncapped, the second pass of each view; `scripts/bench/deck-unity.sh`, which now refuses to start while another bench
runs on the Deck). A change to the script alone is measured without a Unity build: the player reads its bundle from
`hiraeth-js_Data/StreamingAssets/hiraeth-js/hiraeth.cjs`, copied over a copy of the player. V8's own profile of the
script's thread (`-jsinspect 9229`: the inspector listens on the Deck's network, a DevTools-protocol client takes a
`.cpuprofile`) is what found the levers.

**The baseline** (origin/main e3d0e207, with the UnityPerMaterial fix: Vulkan's GPU times the same as round 6):
desert 63.3 / 54.0, City-Shaft 45.1 / 45.6 / 41.3 (script 20.4-21.4 ms, GPU 18.0-23.9), Signal Market 62.9 / 68.3 /
71.2. The City-Shaft's mirror, 10 ms: the walk 3.7, the scene's matrices 3.1, the bones 2.4, Unity's apply 1.4.

**Kept:**
- **The bones' matrices by the mirror itself** (engine/mirror.js `skeletonUpdate`): three's Skeleton.update, the
  same products in the same order (tests/engine-bridge.test.js: bit for bit), from each skeleton's bone and inverse
  element arrays kept on it (looked up again every 32 frames or when its bones change). 1 400 bones a frame took
  2.4 ms through `bones[i].matrixWorld` (the bones' shapes many: each load a megamorphic one in V8), 0.24 ms so. The
  City-Shaft's mirror 10 → 8 ms, the Market's 6.5 → 4.8; fps 45.1 / 45.6 / 41.0 → 47.0 / 49.2 / 41.0 (the wide view
  is the GPU's), the Market 70.5 / 74.9 / 76.5.
- **The scene's matrices from a flat list** (engine/scene-matrices.js, the Unity backend's `listMatrices`): the
  mirror's `scene.updateMatrixWorld()` (matrix-cache.js's walk, ~3 900 objects) read a dozen properties off each object,
  megamorphic loads all. The scene is listed depth first once, with each object's position, quaternion, scale, the
  numbers its matrix was composed from and its matrix and world matrix's elements in arrays of one kind; a frame runs
  down the list (three reads off the object itself), and the list is made again, by the walk itself that frame,
  whenever add, remove or attach ran anywhere (in the City-Shaft 1-2 frames in 300). An object with its own
  updateMatrixWorld (cameras, skinned meshes, the part batches) is called as the walk would. The same matrices bit for
  bit (tests/scene-matrices.test.js). City-Shaft matrices 3.2 → 2.4 ms, mirror 8 → 7; fps 47.7 / 50.8 / 41.0, the
  desert 66.1 / 57.1, the Market 73.3 / 78.0 / 77.3.
- **A depth prepass on the Linux player** (HiraethFeature `Settings.prepass`, the Surface shader's `HIRAETH_PREPASS`;
  `-no-prepass` off, `-prepass` elsewhere): the opaques' depth drawn alone first by the same G-buffer pass, its
  vertex the pass's own position and no fragment work (the glass and the dissolve, which discard, write no depth
  there), then the G-buffer pass shades each pixel once. The City-Shaft's GPU 20.3 / 16.1 / 24.1 → 16.8 / 17.2 / 19.8
  ms (the crowd view the same: little overdraw there), the desert's ~1 ms more (open ground: the prepass's vertices
  for little), the Market the same. City-Shaft 46.8 / 50.9 / 40.1 → 58.3 / 55.6 / 50.6 fps. The pictures the same
  (the pixels that differ are those that differ between two runs without it: people walking, the far city's boil).
- Measured and left out: the albedo target in 8 bits a channel (the same GPU time), no shadows with the prepass
  (−0.5 to −1 ms). With the prepass, the composite (its creases' and pockets' taps) is ~4-6 ms of the City-Shaft's GPU
  (`-debug-view 2` returns before them), and render scale 0.5 leaves 11-15 ms: most of what is left does not scale with
  the pixels (the draws' vertices, the shadow maps, and the GPU waiting on the main thread's submission).
- **The City-Shaft's air pillars' pieces written straight into their instance arrays** (src/shaft-pillars.js `set`,
  for the web build too): three's own arithmetic (setFromAxisAngle, compose, setMatrixAt) without the temporaries,
  the same numbers (tests/shaft-pillars.test.js). ~2 000 pieces a frame: the update 8.9 / 10.3 / 8.5 → 7.6 / 9.3 / 7.7 ms.
- Tried and left out: the people's rigs, walked from their roots several times a frame, from lists as the scene is
  (the same time: their cost is not the walk's reads).
- **The composite's pockets read tap by tap** (Composite.shader `enclosure`): its eight taps were read into arrays
  kept for a second loop, ~56 registers live across the pass: the composite ran at 168 VGPRs (6 waves a SIMD,
  `RADV_DEBUG=shaderstats` with `MESA_SHADER_CACHE_DISABLE=true`, the stats in the player's log). Each tap is read
  where it is used now (a tap on a person reads the others again, a rare path; the same reads and numbers): 96 VGPRs,
  10 waves, the City-Shaft's GPU 0.3-0.5 ms less, the Market's wide view 83 → 88 fps.
- **Each pass's GPU time in a development player**: HiraethFeature's render graph passes carry profiling samplers, so a
  `-development` Linux player's `-split` (BridgeGpuSplit) names them. The City-Shaft with the prepass, a frame on
  average (start / crowd / wide): G-buffer 5.8 / 5.6 / 7.9 ms, the composite 3.6 / 4.2 / 3.3, the near shadow map 3.3 /
  2.8 / 3.6 (drawn every 2nd frame: ~6.5 ms on those), the prepass 3.1 / 2.4 / 3.4, the far map 0.3-0.4, glow and FXAA
  0.2 each. Casters under 2 texels left out of the near map (`-shadow-min 2`, as the Xbox): −0.5 ms; the web's levels
  of detail in the bridge (lod.js, 225 000 triangles fewer in the City-Shaft): −0.1 to −0.4 ms, not kept.
- **The mirror walks the scene's list** (engine/mirror.js sync with `listMatrices`; engine/scene-matrices.js
  `sceneList`): the same depth-first order as its walk down the scene, what each object is (a drawable, a bone with
  nothing on it) kept beside it, a hidden object's subtree stepped over; a drawable's work is the same method either
  way (`_see`, its kind read off its node, not the object). The same calls to the backend in the same order
  (tests/mirror-list.test.js). The mirror 6.3 → 5.7 ms in the City-Shaft, 6.1 → 5.4 at the desert's spawn.
- **The prepass draws the occluders only** (BridgeRenderer `Occluder`: plain meshes of at least 1 m radius in
  HiraethFeature's `OccluderLayer`; `-prepass-min R`, 0 every opaque): most of the prepass's 3 ms was the small
  meshes, which hide little. The prepass 3.0 / 2.4 / 3.4 → 1.5 / 0.7 / 1.8 ms, the G-buffer 0.2-1 ms more; the
  City-Shaft 60.8 / 59.8 / 52.9 → 63.6 / 60.3 / 57.1 fps, the desert's spawn 69 → 75.
- **The near shadow map's schedule.** Drawn every 2nd frame it costs ~5.5-6 ms on those frames (4096², the City-Shaft):
  about 2.4 ms its casters' vertices and 3 its texels (2048²: 3.1-3.3 ms). Drawn every frame at 2048 (an even cost,
  `-shadow-near-every 1 -shadow-near-size 2048`) the 60 Hz vsync run's p95 is no better (21-25 ms either way: the
  frames' spread comes from the whole frame being close to 16.7 ms, not from the map's alternation), and the shadows'
  texels are twice as big: not kept. Spread over two frames into a second map would give the same average with a frame
  more of the traveller's shadow lagging him (his shadow is the near map's on the Deck's preset, no fine map).

**Where round 7 ends** (origin/main 0f4bbd39, with the Xbox's lean terrain and water variants; 90 Hz uncapped, then
60 Hz with vsync: frames shown a second and p95 ms):

| view | before (e3d0e207) | now, 90 Hz · script · GPU | now, 60 Hz vsync |
|---|---|---|---|
| desert spawn | 63.3 | **76.7** · 11.9 · 13.1 | 59.3 · 18.6 |
| desert camps | 54.0 | **62.7** · 14.6 · 14.7 | 59.3 · 19.1 |
| City-Shaft rim | 45.1 | **63.9** · 14.3 · 15.2 | 58.5 · 20.8 |
| City-Shaft crowd | 45.6 | **60.1** · 15.1 · 16.6 | 58.2 · 20.0 |
| City-Shaft wide | 41.3 | **56.4** · 13.9 · 18.6 | 55.0 · 23.2 |
| Signal Market start / crowd / wide | 62.9 / 68.3 / 71.2 | **79.5 / 87.9 / 88.2** | 59.2-59.3 · 18.0-18.3 |

The desert and the Market hold 60 at 60 Hz (about 1 refresh in 100 missed); the City-Shaft's rim and crowd are
within a few frames of it, its wide view 5 short. **What is left** is the City-Shaft's geometry: at render scale 0.25
(a development player's `-split`) the G-buffer still takes 4.4-5.3 ms and the near shadow map 3.4-3.9, so most of
both is their vertices (the shaft's ~3.4 million triangles a frame, the G-buffer's vertex shader ~2 000 instructions
in its heavier variants), not their pixels. The levers there: a lighter G-buffer vertex stage (what it works out per
vertex for the ink's patterns), levels of detail that pay for their switching (lod.js gave 0.1-0.4 ms), and caching
the near map's still casters between the frames the window does not move. On the script's side, the people's rigs
walked from their roots several times a frame (posing, cloth, hands: ~2 ms in the crowd view) are the largest part
left. V8's tiers are as Puerts builds them (13.6, Sparkplug and Maglev on; its API takes no flags) and its garbage
collector is under 1 % of the script's thread.

## The game's update on the Unity targets (issue #111, October 2026)

With the mirror cut (round 7), the game's own update (engine/game.js `frame`, before `mirror.sync`) was the longest part
of the script on both Unity targets: ~12.5 ms at the Xbox's desert spawn (taken under the ship's ramp: see #265), ~15 ms in the Deck's City-Shaft crowd. The
same JS runs in Node: the Unity bundle in a bare V8 context against a stand-in host (as tests/engine-unity.test.js), at
the bench's views, `--cpu-prof`, gives the update's profile without a device; two bundles in one process, a frame of
each in turn on the script thread's CPU clock (`process.threadCpuUsage`), compare a change with the Mac's load at 40-90.

**Where it went** (City-Shaft crowd, Mac, self time of the update): the crowd 21 %, the rigs' walks (matrix-cache.js)
19 %, three's maths 19 % (most of it called by the posing), the level 7 %; at the desert's spawn the story's fires
(story/flames.js, the temples' pilot flames and bowls) 12 % and the wind's wisps 6 %.

**Kept:**
- **The rigs walked once** (src/matrix-cache.js `updateChain(o, top)`: the way from a walk's first object down to what a
  read needs, made as `top.updateMatrixWorld(true)` would make it; where a world matrix changed, the children off the
  way are flagged, so the next walk makes them). The traveller's standing pose (`standUnder`, his 363 objects walked to
  read his feet), his scarf, his arms' walk styling, his wrists, Animator.apply (each joint's subtree walked after it
  turned: the legs three times, the arms four; now each joint's parents for its read and the rig walked once at the
  end), the pelvis's parent's subtree in Humanoid.update (300 bones multiplied for nothing), and the people's walks
  right after Humanoid.update. The City-Shaft's crowd 6 040 objects visited a frame → 3 520. `__POSE_WALKS__` walked as
  before for tests/pose-walks.test.js (every world matrix and every frame's command stream to Unity bit for bit); both
  went once the change had shipped.
- **Fires and air pillars out of view held** (Flames.update, ShaftPillars.lay; src/motion-kit/view.js `sphereInView`):
  tongues out of the camera's last view (a margin round their sway) are left as they are and moved the frame they are
  seen, as the clock puts them; a pillar out of view lays no pieces. engine/game.js now sets the view after the mirror's
  frame, as main.js does after drawing (so the motion kit's view tiers run on Unity too). Desert spawn: the story's part
  0.48 → 0.15 ms on the Mac.
- **The crowd in one shape** (src/crowd.js): every field the update sets on a person later is in the literal that makes
  them, so the update's reads of 1 500 people are a shape's, not megamorphic over dozens; and past 120 m, not drawn,
  nothing about them minding the traveller, a person's head, talk and turn towards him are left as they were (where they
  stand, walk and face: the same arithmetic, tests/crowd.test.js). The crowd 0.97 → 0.54 ms (Mac).
- The drone's trail, docked, written once (src/trail.js); the crowd's going-home share kept on each person.
- Tried and left out: the far crowd moved every 24th frame out of view (4 % of the crowd: the cost was not its maths).

**Measured.** The Xbox (Series X, Direct3D 12, 1440p, `-vsync 1`, the last 30 s of a 170 s run; build 1937, origin/main
before, against build 1969 = 4af906a1, the rigs, fires, pillars and trail; the crowd's change not in it):

| view | script ms | frames at 33 ms | fps |
|---|---|---|---|
| desert spawn (taken under the ship's ramp: see #265) | 12.2 → **11.4** | 1-2 % → 0-1 % | 59.5 → 59.6 |
| City-Shaft rim | 15.7 → 15.9 | 36 % → 40 % | 44.6 → 44.5 |

The City-Shaft's script is the crowd and the people there (the rigs' change is small there: its time is not the walks'
visits but their megamorphic reads); the crowd's change (above) is after build 1969. The web build on the Deck's
preset (headless Chrome, CPU ×3, the build before and after side by side, twice): the crowd 1.50 → 0.86 ms at the
City-Shaft's rim, 1.44 → 0.70 in its crowd, 0.97 → 0.50 in the Market's; the story at the desert's spawn 1.22 → 0.78;
the traveller 1.8-1.9 → 1.5-1.7.

### The crowd's change on the Xbox: build 1973 (issue #113, 2026-10-12)

Build 1973 (`rnaud.HiraethUnity_1.54.1973.0`, 91054d07: the crowd in one shape, above) against build 1969, the same
way: Series X, Direct3D 12, 1440p, `-vsync 1`, from the spawn with nothing pressed, the mean of the 5 s `frames:` lines
over the last 30 s of a 170 s run (`-level incal` for the rim; 1973 also `-mute`, 1969 was not).

| view | fps | frames at 33 ms | script ms | cpu main ms | GPU ms |
|---|---|---|---|---|---|
| City-Shaft rim (spawn) | 44.5 → 44.7 | 40.7 % → 36.8 % | 15.9 → 14.5 | 13.2 → 12.7 | 15.9 → 15.8 |
| desert spawn (taken under the ship's ramp: see #265) | 59.5 → 59.5 | 0-1 % → 0.5 % | 11.4 → 11.4 | – → 8.8 | – → 12.5 |

The rim's main thread (1973, ms a frame): the scripts' part 6.5 (the ops 1.7), URP before its first context 0.7, its
contexts 4.9, after them 10.3; the main thread's wait on the script 1.7, FrameTimingManager's present wait 9.7, the
render thread 3.4. The desert's (taken under the ship's ramp: see #265): 4.1 (0.7), 1.0, 3.1, 8.5; wait 0.7, present 8.0, render thread 2.1.

At the bench's views (`-views`, viewpoints-worlds.json, `-bench 6`; mean frame, p95, script, GPU):

| view | frame ms | p95 | script | GPU | drawn |
|---|---|---|---|---|---|
| City-Shaft start | 18.9 | 33.1 | 16.1 | 17.3 | 1 550 |
| City-Shaft crowd | 19.6 | 30.9 | 18.1 | 16.2 | 1 590 |
| City-Shaft wide | 18.0 | 33.5 | 15.1 | 19.5 | 1 556 |
| desert spawn | 16.7 | 17.1 | 12.3 | 10.5 | 1 338 |

The pictures (the console's at each view against the web build in muted headless Chrome at the same camera) match:
every surface, person and tower drawn, nothing see-through; the web's extra pieces at the rim are the City-Shaft's
later content (db9d6e99, dddb6159), not yet in the Unity build.

**What holds the rim under 60.** The crowd's change took ~1.4 ms off the script and ~4 points off the 33 ms frames, not
more: at 60 Hz with vsync a frame misses as soon as either the GPU or the script passes 16.7 ms, and at the rim both sit
at the edge. The GPU is 15.8-19.5 ms there (the desert's 10.5-12.5); the script 14.5-18 ms (the crowd view over the
budget). The GPU is the first to cut: 3 ms at the wide view (the shaft's geometry and shadows, ~1 550 drawn), or a
render scale under 1 there; then the script's crowd and rigs at the crowd view.

### The City-Shaft's rim on the Xbox: the shadow maps culled, V8's flags (issue #113, 2026-10-12)

Build 2027 (the branch `xbox-rim60`), the same rig as build 1973 (Series X, Direct3D 12, 1440p, `-vsync 1`, muted, the
last 30 s of a 170 s run; the views `-bench 6`). "Before" is the same build with every change turned off by its flag
(`-no-shadow-sweep -shadow-camera -no-shadow-instances -no-shadow-chunks -v8 none`), so both include origin/main's script
as it stood (the rim's script 15.3 ms before against build 1981's 14.5: the hoverbike's matrix-cache change, 5a0395e2, and
the newer content).

| | fps | frames at 33 ms | GPU ms | script ms | cpu main ms |
|---|---|---|---|---|---|
| City-Shaft rim (spawn) | 44.5 → **57.4** | 38.2 % → **4.7 %** | 15.8 → 13.8 | 15.3 → 14.4 | 13.0 → 12.9 |
| desert spawn (taken under the ship's ramp: see #265) | 59.5 (1973) → 59.6 | 0.5 % → 1 % | 12.5 → 11.6 | 11.4 → 10.7 | 8.8 → 8.8 |

| view (`-bench 6`) | GPU ms | script ms | frame ms |
|---|---|---|---|
| City-Shaft start | 17.1 → 14.4 | 16.4 → 15.6 | 19.5 → 17.9 |
| City-Shaft crowd | 15.5 → 12.5 | 18.7 → 17.1 | 20.6 → 18.8 |
| City-Shaft wide | 19.2 → 17.2 | 15.6 → 14.3 | 17.9 → 17.5 |

**Where the rim's GPU went** (a development build's `-split`, before): the G-buffer 4.9-9.7 ms, the composite 3.1-4.2,
the near shadow map 2.8, the fine one 2.0, glow 0.6, far 0.35. Render scale 0.5 left the shadow maps as they were: their
vertices, not their texels. `-shadow-census` (new: each cascade's casters, their vertices, the largest) showed why: the
fine map's 24 m window drew ~1.5 million vertices, the City-Shaft's merged rings (~360 m across, ~100 000 vertices each)
whole and the instanced parts (188 sets, the cabs' parts, the flora, the pillars' pieces) whole, in every cascade.

**Kept** (the Xbox's renderer-list path only: `HiraethShadows.UseRendererLists`; the Deck's draws' path is untouched):
- **Each cascade's list culled by the view swept away from the sun** (`HiraethShadows.SweepCull`, as `Sees` does for the
  draws' path and the web's ShadowCuller): the window's four sides and the camera's six planes, its far one at the
  cascade's reach, each moved out by how far a shadow can fall across it (the cascade's depth, or from the highest caster
  down to the lowest ground): ten planes. GPU −2.1 / −2.6 / −1.5 ms (start, crowd, wide). With it the cascades are placed
  round the traveller (the brush op's `_Brush`), as the web places them, not round the camera (`-shadow-camera` as before).
- **The instanced casters culled instance by instance** (`InstMats.CullAll`, each instance's place and reach against the
  same planes, the set's bounds first) and **the big still meshes cast by pieces** (`BridgeShadowChunks`: a mesh of 40 m
  radius and 4 000 vertices and up cut by 128 m cells, its vertex layout byte for byte, on layer 30, which the camera's
  culling mask leaves out, in every cascade): the fine map 1.5 M → 0.5 M vertices; GPU another −0.9 to −1.6 ms. 48 m cells
  saved a little more GPU but the rim fell to 46.6 fps (the main thread's culling of ~500 more renderers); 128 m: 57.5.
- **V8's flags** (`-v8 "<flags>"`, through two exports added to the relinked `PapiV8.dll`, `scripts/unity-uwp-v8-stubs.cpp`,
  set before Puerts makes its first engine; `-v8 none` for Puerts' own): `--min-semi-space-size=16
  --max-semi-space-size=64 --max-inlined-bytecode-size-cumulative=2000 --invocation-count-for-turbofan=500` by default,
  the script −0.8 to −1.3 ms at the views (two alternated rounds).

**Measured and left out**: the depth prepass (`-prepass`: the same GPU on the Xbox), the pieces drawn by the camera too
(more draws than the vertices saved), `--no-concurrent-recompilation` (no change: V8's JIT tiers up normally on the console,
a microbenchmark bundle (`-bundle`, new: a bundle from LocalState) ran a matrix product at 63 ns as on the Mac), the frame's
last ops applied after the next script frame is let go (45.1 against 46.2 fps), the composed-from numbers of the scene list
in one array (−0.05 ms). `-no-shadows` gives 58.4 fps (and URP's own shadow pass appears: `HiraethShadows.On` false leaves the
sun's shadows on).

**What is left for 60.** The rim is 57.4 with 4.7 % of frames at 33 ms: the script at 14.4 ms (16-18 at the crowd view)
and the main thread at 12.9 ms (of which ~2 ms waiting on the script and ~3 ms on the overshirt's Burst job in LateUpdate,
`clothWait`) are now what misses a refresh; the wide view's GPU is 17.2 ms (its G-buffer ~9.7). The script is memory-bound
on the console, not compute-bound: the same bundle runs ~10× faster on the Mac's caches while a compute kernel runs the same
speed, and a pointer chase costs 196 ns a hop against the Mac's 110; its time is spread over the people's rigs, the
traveller, the crowd and the mirror's walk of ~3 600 objects. Next: the overshirt's job split over workers (IJobParallelFor
for its vertices), fewer objects visited a frame by the mirror and the scene list, and a lighter G-buffer vertex stage.

### The City-Shaft's rim on the Xbox, round two: the script's chain and the main thread (issue #113, 2026-10-12)

Build 2067 (the branch `xbox-rim60b`, rebased on v1.61), the same rig as round one (Series X, Direct3D 12, 1440p,
`-vsync 1`, muted, the mean of the last 30 s of a 170 s run; the views `-bench 6`), two alternated rounds at the rim.
"Before" is the same build with `-js-off still,hidden,people,shape -cloth-single -no-job-kick`; the per-frame garbage
cuts below have no switch, so they are in both (and v1.60-v1.61's content made the before slower than round one's after).

| | fps | frames at 33 ms | GPU ms | script ms | cpu main ms |
|---|---|---|---|---|---|
| City-Shaft rim (spawn) | 55.9 / 55.4 → **58.7 / 58.7** | 8.5 / 9.5 % → **3.3 / 2.5 %** | 14.0 → 14.1 | 14.9 → 13.2 | 13.5 → 10.0 |
| desert spawn (taken under the ship's ramp: see #265) | 59.4 → 59.6 | 1.0 % → 0.7 % | 11.2 → 11.2 | 10.8 → 10.7 | 8.8 → 7.8 |

| view (`-bench 6`) | frame ms (median) | script ms | mirror ms | the main thread's wait on the overshirt, ms | GPU ms |
|---|---|---|---|---|---|
| City-Shaft start | 17.8 → **16.7** | 15.4 → 14.1 | 7.2 → 6.0 | 3.0 → 1.0 | 15.0 → 14.8 |
| City-Shaft crowd | 19.0 → 18.1 | 17.4 → 16.6 | 6.8 → 6.2 | 2.7 → 1.4 | 13.3 → 13.4 |
| City-Shaft wide | 17.5 → 17.2 | 14.1 → 13.0 | 7.3 → 6.0 | 3.2 → 1.7 | 17.8 → 17.7 |

The frames line now says how many frames of two refreshes or more waited on the script and how many on the rest; at the
rim, before: 7-17 a 5 s window late on the script, 6-21 on the rest; after: 0-5 and 2-7.

**Kept** (the Unity bridge everywhere, so the Steam Deck's Linux player gets them too; the web's game is unchanged: the
shared code's new paths are switched on only by the Unity backend):
- **The overshirt's job in three, started at once** (`BridgeCloth`): a scheduled job waited for the next flush, which was
  the main thread's own `Complete` in LateUpdate, so the main thread ran it itself (~3 ms). Now `JobHandle.ScheduleBatchedJobs`
  starts it as the packet arrives, and after the cage's steps (one job: each constraint reads the last one's result) the
  garment's 10 771 vertices and their normals run over the workers (each vertex writes its own, `outIx` checked one-to-one;
  each normal sums its triangles' face normals in the triangles' order, as the single loop added them: the same numbers).
  The capes' jobs are kicked off the same way. The main thread's wait on it 3.0 → 1.0-1.7 ms. Alone (build 2040) it gave
  the main thread ~0.5 ms and cost the script about as much: the workers' burst slows the script's memory-bound thread.
- **The mirror's still matrices** (engine/mirror.js `stillMatrices`): a drawable's world matrix is compared with the one last
  sent only when the scene's list changed it this frame, a walk outside the list did (src/matrix-cache.js `WORLD_STAMP`, a
  stamp on its mirror node, off on the web), or every 8th frame; objects whose matrices their owners write
  (`matrixAutoUpdate` or `matrixWorldAutoUpdate` off) are compared as ever. The same calls to the backend
  (tests/mirror-still.test.js); the walk −0.2 to −0.3 ms.
- **Hidden subtrees stepped over** by the scene's list (engine/scene-matrices.js `skipHidden`): 1 750 of the City-Shaft's
  4 330 objects are under something hidden. Their matrices are left as they were unless the subtree has an
  `updateMatrixWorld` of its own (called as ever); a hidden object whose parent moved is flagged, so a read through three
  (getWorldPosition, updateWorldMatrix) or the frame it is shown makes it as the walk would
  (tests/scene-matrices.test.js). Only a direct read of a hidden object's `.matrixWorld` sees it as it was. With the still
  matrices: the mirror −0.6 to −0.95 ms at the views, the script −0.8 to −1.0.
- **People out of view moved a quarter of the frames** (src/npc.js `offView`, set by engine/game.js only): a person past
  30 m outside the last frame's view (padded by 3 × their height + 6 m for their shadow and the camera's turn) is moved as
  one past 110 m is, a quarter of the frames with the time summed, and takes the time missed at once on coming into view.
  At the rim's spawn the five people between 30 and 110 m are all behind the camera; "people" 0.4 → 0.2 ms on the Mac's VM.
- **The banners by their points again** (engine/mirror.js, the backend's `shapeAttrs`): the City-Shaft's merged banners
  move their object frames (`aObjP`, `aObjN`) with their shape, which only a vertex-material variant draws, so every frame
  they went whole (96 kB packed, a new Unity mesh made and the last destroyed). Now they go by `vertices()` unless a `:v`
  variant was sent. Main −0.8 ms, script −0.4.
- **The frame's garbage** (no switch; 767 → 550 kB a frame in the VM at the start view): the mirror's walk over its nodes
  by `forEach` (a destructured entry was an array a node), a geometry's variants found by their gid (each rewrite copied
  and searched every variant sent), the crowd's instances packed without a closure and a literal a person.

**Measured and left out** (flags kept for tests): `-ops-after` (the frame's last ops applied after the next script frame
is let go: 58.3 against 58.6 fps), `-job-workers 5` / `4` (main −0.5 ms, the same fps), V8's young generation 32-128 MB
(script +0.9 ms, 54.8-56 fps) and 8-32 MB (script +0.8, 53-55 fps) against 16-64, `--single-threaded-gc` (a 190 ms pause
every ~27 s), `--no-parallel-scavenge` (the same), `-gc-step 1` (the managed collector by hand: 52 fps), `-gc-slice 1`
(the same), `-no-uniform-layout` (the GPU the same: the vertex fetch is not what the wide view waits on), `-render-scale 0.85`
at the rim (the GPU 14.4 → 12.5 ms, the same fps: the rim's late frames are not the GPU's). New: `-dyn-res` (the render
scale adapted to the GPU's frame, as the web's Xbox preset does, down to 0.75 = the web's 1080p; off: a choice of picture),
`-slow-ms N` (each frame from N ms with its engine steps, the wait on the script, the managed collections and its timing).

**What is left for 60.** The rim is 58.7 with ~3 % of frames at 33 ms. Most of what is left is **a stall every 2.9-3.4 s
at the City-Shaft** (not in the Desert): one frame of 40-70 ms, the main thread in `WaitForLastPresentationAndUpdateTime`
or `FinishFrameRendering` (the render thread, the GPU's present) and sometimes the script late with it. Its period follows
how much a frame does (2.95 s, 3.2 s with the banners' fix, 3.4 s with the cabs held) but not V8's young generation (the
same period at 16-64 and 32-128 MB, with and without parallel scavenges), the managed collector (`GCs 0` in most of them),
the shadow maps (`-no-shadows`), the HUD or the local lights. The next step is a development build's profiler capture
around one of them (Unity's frame debugger on the console: what the render thread waits on), and the 330 kB the script's
command buffer is each frame (Puerts copies it into a new byte[] a frame: the air pillars' and the crowd's instances as
16-float matrices are half of it). The wide view's GPU is 17.7 ms and pixel-bound (render scale 0.5: 17.6 → 9.2 ms;
about 11 ms scales with the pixels, so a scale of 0.85 would bring it near 14.5): `-dyn-res` (not yet measured on the console) is there if the scale should adapt there as the web's does; the
crowd view's script is 16.6 ms (its four near people are full rigs in view).

### The City-Shaft's rim on the Xbox, round three: the stall every ~3 s was V8's full collection (issue #113, 2026-10-13)

Build 2086 (the branch `xbox-rim-stall`, on v1.63), the same rig as round two (Series X, Direct3D 12, 1440p, `-vsync 1`,
muted, the mean of the last 30 s of a 170 s run, the rim twice alternated; the views `-bench 6`). "Before" is the same
build with `-js-off copy`; both ran with `-slow-ms 38 -v8-gcs`.

**What the stall was.** Round two left one frame of 40-70 ms every ~3.2 s at the rim, the main thread waiting wherever
it happened to wait (the present, the render thread, the overshirt's job, the script). Its period was a count of frames,
not of seconds: 187-189 frames at 58.7 fps and at 52 fps alike (round two's `-gc-step 1` run, 3.6 s), and the managed
collector ran every frame in that run without moving it. Round two's `--single-threaded-gc` run had in fact lost it (one
190 ms pause every 27 s instead). `-v8-gcs` (new: engine/unity/gc-watch.js, a weakly held object a frame, read 8 frames
later: only a full collection lets it go) put **one of V8's full collections at every stall**, 187-191 frames apart.
What filled V8's heap every 188 frames: the frame's command buffer, ~353 kB, handed to C# as a fresh ArrayBuffer
(`CommandWriter.take`: `buf.slice`). In an IL2CPP player the buffer goes boxed (`{ b }`, typed `object`), and Puerts makes
the box a ScriptObject holding a persistent handle on it until the managed collector lets the ScriptObject go and Puerts'
Tick frees the handle: each frame's buffer outlived the young generation, was promoted, and ~64 MB of them later V8 ran a
mark-compact, whose parallel phases take the console's cores from the render thread and the job workers for 30-60 ms.
In a bare V8 (Node, the same bundle) no full collection runs in 2 400 frames; with each buffer held 120 frames, as Puerts
holds them, one every ~70. The Desert does the same every 171 frames (its buffer ~380 kB), but its heap is smaller and
the collection rarely costs a refresh there.

**The fix** (engine/unity/pack.js `takeView`, backend.js `frame`): the frame's commands go as a Uint32Array view of the
writer's own buffer, no new ArrayBuffer a frame (Puerts reads a view's bytes, copied into C#'s byte[] at the call, as
before). The audio thread's PCM goes as the renderer's own view too (its `slice()` was a fresh buffer each batch).
`-js-off copy` puts the copy back. tests/unity-frame-view.test.js.

| | fps | frames at 33 ms | frames from 38 ms (130 s) | V8 full collections | GPU ms | script ms | cpu main ms |
|---|---|---|---|---|---|---|---|
| City-Shaft rim (spawn) | 58.5 / 58.7 → **59.8 / 59.7** | 3.0 / 2.3 % → **1.2 / 0.7 %** | 36 / 38 → **1 / 3** | every 188 frames → one in ~6 300 | 14.4 → 14.1 | 13.3 → 12.9 | 10.2 → 9.7 |
| desert spawn (at the foot of the ramp, clear of the ship since v1.62: not the spot of the rows before, #265) | 59.5 → 59.9 | 1.0 % → 0.2 % | 2 → 0 | every 171 frames → one in ~6 500 | 10.6 → 10.4 | 10.7 → 10.5 | 7.7 → 7.6 |

| view (`-bench 6`) | frame ms (median) | frame p95 ms | mirror ms | GPU ms |
|---|---|---|---|---|
| City-Shaft start | 16.73 → 16.69 | 28.5 → 21.7 | 6.1 → 5.7 | 14.8 → 14.8 |
| City-Shaft crowd | 18.0 → 17.8 | 24.7 → 25.1 | 6.1 → 5.9 | 13.7 → 13.8 |
| City-Shaft wide | 17.4 → 17.2 | 33.4 → 33.4 | 6.1 → 5.8 | 17.7 → 17.6 |

The stalls before: 38-73 ms (mean ~49), one every 3.17-3.22 s. After, what is left at the rim is V8's full collection
of the old generation's own growth, one every ~105 s, a frame or two of 45-53 ms. The pictures at the three views are
the same before and after apart from moving people (0.5-0.9 % of pixels over 8/255, all on people); against the web they
match round two's comparison.

**The Steam Deck's Unity player** is IL2CPP with Puerts' V8 too, so it hands the same boxed buffers over and gets the same
fix from the bundle (no C# change there): one full collection of its V8 every ~190 frames less. Not measured on the Deck.

**What is left for 60.** The rim is now 59.7-59.8 fps with ~1 % of frames at 33 ms, scattered single misses: the wide
view's GPU at 17.6 ms (pixel-bound; `-dyn-res` not yet measured), the crowd view's script at 16.4 ms (its four near
people full rigs in view), and the old generation's collection every ~105 s (fewer long-lived objects a frame: Puerts'
boxes still each hold a handle until the managed collector runs).

### 4K on the Xbox (issue #113, 2026-10-15)

The question of #113: can the Unity build run at the TV's native 4K (3840 × 2160) and 60 fps? Measured on build
1.73.2236 (Series X, Direct3D 12, `-vsync 1`, muted, the TV at 2160p 120 Hz) with the build's own switches
(`-resolution 3840x2160`, `-render-scale`, `-upscale`, `-dyn-res`, `-prepass`, `-no-shadows`, `-no-bloom -no-fxaa`),
so every row is the same build. Spawns: `-idle 90` (`-idle 150` for the new defaults), the mean of the last 30 s of
the frames lines; views: `-bench 6` (15 with the dynamic resolution) at the City-Shaft's start, crowd and wide views
and the desert's spawn view.

**Native 4K at 60: yes in the desert, no in the City-Shaft.** The CPU side doesn't move with the resolution (the
script 12-13 ms on its own thread, the main thread 7-10 ms); the GPU does:

| GPU ms (`-bench 6`) | City-Shaft start | crowd | wide | desert spawn |
|---|---|---|---|---|
| 1440p (until now) | 12.2 | 9.3 | 15.2 | 7.4 |
| native 4K | **21.1** | **17.7** | **26.8** | 13.7 |
| native 4K, depth prepass (`-prepass`) | 18.7 | 16.1 | 24.0 | 13.6 |
| native 4K, no shadow maps (a test) | 19.4 | 16.2 | 23.5 | |
| native 4K, no glow and no FXAA (a test) | 18.1 | 14.6 | 23.4 | |
| 4K screen, render scale 2/3 (1440p drawn) | 12.2 | 9.4 | 15.3 | |
| the same, FSR 1 to the screen | 12.4 | 9.5 | 15.3 | |
| 4K screen, render scale 1/2 | 9.2 | 6.8 | 11.8 | |
| 1440p, depth prepass | 12.4 | 9.6 | 15.5 | 7.5 |

| spawn (`-idle`) | fps | frames on time | GPU ms |
|---|---|---|---|
| City-Shaft rim, 1440p | 59.7 | 98.2 % | 11.4 |
| City-Shaft rim, native 4K | **45.0** | 65.8 % | 20.0 |
| desert spawn, 1440p | 59.9 | 99.5 % | 7.8 |
| desert spawn, native 4K | **59.9** | 99.3 % | 15.2 |

The City-Shaft's GPU is about a fixed 5-6 ms (the shadow maps, the vertices, the far map) plus ~1.9 ms (start) to
~2.5 ms (wide) a million pixels: the G-buffer and the composite (the ink's taps), pixel-bound. Native 4K is 8.3 million
pixels against 1440p's 3.7, so the wide view's 26.8 ms would have to lose ~12 (44 %) to fit a 60 Hz frame with its
margin. What can go without changing the picture doesn't reach it: the depth prepass (−2.4 to −2.8 ms at 4K, nothing at
1440p); FSR costs 0.1 ms. Even the prepass, no shadow maps and no glow or FXAA together (a different picture) leave
the wide view at ~17 ms. **What native 4K60 in the City-Shaft would take**: about half the pixel cost of the G-buffer
and the composite (the packed single-target G-buffer of xbox.md's design note, the composite's crease and pocket taps
at a lower resolution), work of its own that would need its own pictures checked against the web's.

**What ships (BridgeRunner `Experiments`, `Uhd`, `DynamicResolution`).** On a TV whose HDMI mode is 2160 high
(BridgeMetrics `HdmiHeight`), the swap chain is 4K and the world is drawn from render scale 2/3 (1440p, the picture
the console scaled up before) up to 1 (native 4K) by the GPU's time: `-dyn-res`'s controller (steps of 0.05, down
over 15 ms of GPU averaged over half a second, up while the next step would stay under 14.3, at most a step every
1.5 s), on by default there with its floor at 2/3 (`-no-dyn-res` holds the scale, `-1440` keeps the old 1440p swap
chain). URP's FSR 1 takes it to the screen (a little sharper than the bilinear filter and the console's scaler, which
looked the same as each other). The look's pixel ratio follows the scale (`HiraethLook.PixelRatio` = the render
height over 1440, the shaders' `_PixelRatio`), so the ink lines and the hatching keep their 1440p weight at every
scale, as the web's lines follow its render scale (main.js `resize`: `uPixelRatio` = devicePixelRatio × renderScale):
the console's screenshots at native 4K with a pixel ratio of 1 drew the lines and the hatching two thirds as thick (the
City-Shaft's rail a pair of hairlines). Another TV keeps 1440p. The depth prepass stays off: no gain at the scales the
City-Shaft settles at (rim 12.8 ms without, 13.3 with).

| the new defaults, as flags on 1.73.2236 | fps | frames on time | render scale it settles at | GPU ms |
|---|---|---|---|---|
| City-Shaft rim (`-idle 150`) | 59.8 (1440p 59.7) | 98.8 % (98.2) | 0.72: 2752 × 1548 | 13.7 |
| desert spawn (`-idle 150`) | 59.8 (59.9) | 99.3 % (99.5) | 0.92: 3520 × 1980 | 13.2 |

The bench's views, frame median (p99): start 16.64 (22.4), crowd 16.67 (30.5), wide 16.75 (33.3): its cuts from
one view to the next are where the controller lags (the wide view after the crowd: three steps down, 0.82 → 0.67, in
3 s, frames missed meanwhile); in play the scene changes gradually. A change of scale costs a frame or two (URP makes
its targets again), so the climb from 2/3 at a world's start shows as a few late frames, none once it settles.

**Checked on the console with the defaults (build 1.78.2373, no flags but `-mute`).** The log says `the screen
3840x2160 … upscaling FSR, 4K: dynamic resolution from 0.667, line weight 1`, and `the picture` line once settled
says a 3840 × 2160 swap chain. The console's screenshots at the desert spawn (settled at 0.87, a pixel ratio of 1.3)
and the City-Shaft rim (0.67) against `-1440` ones: the outlines, the creases and the hatching's spacing the same
weight (the share of ink-dark pixels 91 % and 89 % of the 1440p frame's, against 35 % for native 4K with a pixel
ratio of 1 on 1.73.2236). `-idle 150`:

| 1.78.2373, `-idle 150` | fps | frames on time | scale it settles at | GPU ms |
|---|---|---|---|---|
| desert spawn | 59.8 | 99.3 % | 0.87 (0.67 → 0.87 in 5 s) | 13.3 |
| City-Shaft rim, two runs | 58.6 / 59.6 | 95.8 / 97.8 % | 0.72 | 14.6 / 14.1 |
| City-Shaft rim, `-1440` | 59.9 | 98.7 % | (1440p) | 13.3 |

The rim's late frames are mostly the script's (its thread at 15 ms there on this build, 13 on 1.73.2236), and at 0.72
its GPU sits at 14.1–14.6 ms, close to the 15 ms step down: a point or two of frames on time below 1440p. Where the
desert settles (0.87 or 0.92) depends on whether its GPU at 0.87 is just under or over 12.8 ms. The log's screen size
was read before `Screen.SetResolution` takes effect (at the frame's end), so it showed the last launch's size (2560 ×
1440 after a `-1440` run): it now says the size asked for.
Left: the controller's raise rule assumes a GPU frame all pixels (×scale²), which stops the desert at 0.87–0.92 where
native 4K holds 15.2 ms; a model with the fixed part (≈5 ms) would let it reach 1 and the rim ~0.78.

## The Retroid, round 6: the real buttons, cold and warm loads, the distant shimmer (2026-10-12, issues #50, #16, #225)

The Retroid Pocket Nova in the GeckoView test app (`com.rnaud.hiraeth.gecko`, built from e7c21f7d, the game bundled in
it as it ships unless said), Handheld preset, the frame readout on, the game's sound at 0 (checked). The player's app
was never installed over, cleared, stopped or started; it was open in front the whole time and went behind the test app
while it ran. The device sat at 52–70 °C GPU through the runs (the cool-down to 52 °C often timed out at six minutes).

**The harnesses' sound.** Every harness saved music, effects and voices at 0 without `soundV: 1`, which
`migrateSettings` (src/ui.js, #112) reads as the old Deck bench's footprint and puts back to the defaults: the games
the harnesses drove played at 0.8 / 1 / 0.8 (`android-pad.mjs` caught it: "sound not at 0"). All 28 scripts now save
`soundV: 1` with the zeroed volumes; `tests/bench.test.js` fails on any that doesn't.

**The real buttons (#50).** `android-pad.mjs --real 1` writes each control into the handheld's own controller node
(`sendevent` on `/dev/input/event7`, "Retroid Pocket Controller", vendor 2022 product 3001: the shell user is in the
input group), so a press goes kernel → the system's key layout (`Generic.kl`, the only one it has) → the activity as a
hardware press does, under the controller's real name; each write first checks the test app holds the focus. Run in
the Arena (the desert's `?level=` spawn boxes the traveller in under a roof, the camera 0.7 m over his head: no walk;
not a GeckoView matter, the same in Chrome on the Mac):
- Through PadBridge (the shipped app's GamepadBridge, the same code): **every control reaches its Standard Gamepad
  index**: the four faces, L1/R1, L2/R2 as buttons and as the analog brake/gas axes, L3/R3, the d-pad as the hat (up
  too: round 5's missing up was the injected "Virtual" device's), both sticks (−1 / +1 on their axes), Start (the menu
  opens) and Select (it closes). The left stick walks the traveller 4.5 m in 1.2 s; BTN_EAST (Android's BUTTON_B) jumps
  2.5 m: the name-based guess (`padFaces`: "Retroid…" → Nintendo letters, by label) holds for the real device name.
- Through Gecko's own Gamepad API (`--gecko 1`: no PadBridge), the same: id "Retroid Pocket Controller", mapping
  "standard", every index as above; only the very first input is lost (Gecko shows a pad from its first event on).
- The node also has BTN_DPAD_UP…RIGHT keys, which `Generic.kl` doesn't map: no app gets them, so a d-pad sending them
  would be dead in every app; the Retroid's must use the hat. Not changed in the bridge: nothing to fix.
- Still for hands: which code each physical button sends (the firmware's own choice; `getevent -l` and one press of
  each settles it). The upgrade over the installed app is not tried: the only installed app is the player's.

**Cold and warm loads (#16).** `load-breakdown.mjs --gecko cold,warm,session --apk` (new, `scripts/bench/gecko-load.mjs`:
cold = the test app's data cleared, a first install; warm = stopped and started again; session = the same app, the page
loaded again), the same phases as on the Mac, `--traverse 20`. ms; memory is PSS (tab · GPU process · parent):

| World | load | modules | world | collision | characters | shaders | GPU warm-up | first frame s | first playable s | memory MB | traversal p50 / p95 / p99 / worst ms, > 50 / > 100 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Desert | cold | 424 | 3686 | 247 | 923 | 8421 | 750 | 15.4 | 16.7 | 1058 · 432 · 183 | 17.7 / 32.1 / 40.6 / 57, 2 / 0 |
| | warm | 414 | 3714 | 263 | 1005 | 8008 | 755 | 15.2 | 15.9 | 1055 · 439 · 207 | 17.6 / 30.0 / 36.5 / 42, 0 / 0 |
| | session | 401 | 3644 | 277 | 1045 | 7838 | 753 | 14.9 | 16.0 | 1118 · 529 · 204 | 17.8 / 29.8 / 34.2 / 64, 2 / 0 |
| City-Shaft | cold | 428 | 4505 | 902 | 1455 | 9422 | 860 | 18.3 | 19.1 | 1296 · 505 · 189 | 25.0 / 34.6 / 50.1 / 903, 8 / 1 |
| | warm | 402 | 4511 | 903 | 1515 | 8947 | 851 | 17.9 | 18.8 | 1360 · 575 · 206 | 23.6 / 30.8 / 48.4 / 899, 7 / 2 |
| | session | 438 | 4383 | 887 | 1423 | 8894 | 848 | 17.6 | 18.2 | 1455 · 592 · 206 | 23.6 / 29.2 / 40.4 / 919, 6 / 3 |
| Vael | cold | 411 | 5404 | 349 | 985 | 8144 | 694 | 16.9 | 17.6 | 1360 · 559 · 186 | 19.9 / 28.8 / 38.0 / 186, 3 / 1 |
| | warm | 417 | 5364 | 343 | 1001 | 7575 | 690 | 16.3 | 17.0 | 1313 · 570 · 205 | 20.7 / 28.4 / 37.8 / 178, 2 / 1 |
| | session | 383 | 5240 | 369 | 931 | 7180 | 679 | 15.6 | 16.3 | 1479 · 651 · 206 | 20.2 / 27.8 / 37.2 / 144, 2 / 1 |
| City Floating in Space | cold | 409 | 2079 | 518 | 1344 | 7736 | 609 | 13.3 | 13.6 | 938 · 432 · 214 | 17.0 / 22.6 / 32.7 / 59, 2 / 0 |
| | warm | 424 | 2092 | 478 | 1360 | 6742 | 758 | 12.4 | 12.7 | 954 · 426 · 205 | 17.0 / 23.0 / 35.4 / 97, 3 / 0 |
| | session | 391 | 2026 | 460 | 1244 | 6990 | 658 | 12.4 | 12.5 | 923 · 457 · 201 | 16.9 / 22.0 / 31.8 / 143, 2 / 1 |

(Assets 39–48 ms everywhere, the rest 200–600, ready → first frame 310–390.)

- **Cold is warm on the handheld**: a first install loads 0.2–0.9 s slower than a relaunch, all of it in the shaders.
  The driver keeps no useful cache for Gecko's GPU process: the compile calls get cheaper (the desert 5.3 → 4.5 s,
  the City-Shaft 7.0 → 0.7) but the surfaces' step, which waits each program out (the GPU pacer), is 6–9.4 s every
  time. **Shaders are half of every load** (6.7–9.4 s of 12.4–18.3), then world creation (2–5.4 s); a second world in
  the same sitting gains nothing either.
- **The first playable frame** comes 0.1–1.3 s after the first (the desert's and the City-Shaft's first frames after
  the world shows are the distant detail and the levels of detail catching up).
- **Memory**: 1.6–2.3 GB across the three processes after a load, the tab 0.9–1.5 GB. Loaded again in the same app it
  is up to 250 MB more (the old page's not yet collected; the floating city none).
- **Traversal at 40 m/s**: p95 22–35 ms, p99 32–50; the City-Shaft has a 0.9 s stall in every run (the Mac has its
  0.3–0.5 s one too, "The load by kind of work": the same place, worth finding), Vael 0.15–0.19 s.
- **The Mac at the same preset** (headless Chrome, Handheld, 1280 × 720, cold profile; the machine at a load of 20–40
  from other agents, so only the shape is worth reading): the desert 14.0 s (modules 3.1, world 3.2, shaders 3.6), the
  City-Shaft 7.2 (world 2.1, shaders 1.1), Vael 8.2 (world 2.6, shaders 1.3, GPU warm-up 2.2); traversal p95 14.2 /
  18.3 / 11.5 ms. Against it the Retroid's world creation is 1.2–2.1× the Mac's and its shaders 2.3–8.7×. (The floating
  city's Mac run is left out: at a load of 100+ its first frame took 105 s; on the Retroid it is the quickest world.)

**The distant shimmer on the device (#225).** `motion-check/record.mjs --gecko dist` (new: the motion check in the
test app at the device's own 1280 × 960, the clock stepped, every frame read back) in the desert, Handheld (scale
0.65), `--far 60`; flicker per 10 000 px, what is over 60 m off alone in brackets:

| path | as shipped (SMAA, far lines faded) | FXAA instead | far lines' fade off |
|---|---|---|---|
| pan across Qanat's wall, 145 m | 15.1 (far 33.1) | 15.9 (33.2) | 26.0 (64.9) |
| slow turn looking far | 1.5 (far 13.9) | 3.7 (33.7) | 1.6 (25.3) |

So on the device the far lines' fade halves the far shimmer on both paths, and SMAA over FXAA takes the turn's far
flicker from 33.7 to 13.9 (the pan the same). (The motion check's "no AA" toggle swaps only the FXAA blit, so with
SMAA it measures nothing: left out.)

**SMAA's cost on the device** (`android-worlds.mjs --toggles base,fxaa`: each renderFrame of a synced loop, at 0.75,
FXAA in place of the preset's SMAA between two base runs, the median of four rounds): SMAA is the cheaper one here.
FXAA costs 0.65–2.2 ms more a frame in the desert (7 views, base 14.9–19.4 ms), 1.0–3.5 ms in the City-Shaft (5 views,
22.4–35.3) and 0.1–2.4 ms in the Signal Market (5 views, 16.8–24.6): FXAA reads every canvas pixel at the screen's
size, SMAA works at the render size and scales as it blends. Live with SMAA at a held 0.75: the desert 49.5–60 fps,
the City-Shaft 35–49, the Signal Market 55–60 (the device hot, 61–70 °C).

To repeat: `npx vite build && scripts/bench/gecko-apk.sh`, `adb install` the test app, then
`node scripts/bench/android-pad.mjs --serve dist --real 1 [--gecko 1]`,
`node scripts/load-breakdown.mjs --gecko cold,warm,session --apk --preset handheld --worlds desert,incal,arzach,spacecity --traverse 20`,
`node scripts/motion-check/record.mjs --gecko "$PWD/dist" --level desert --preset handheld --paths pan,turn --far 60 --toggles fxaa,inkFar --alltoggles 1`,
`node scripts/bench/android-worlds.mjs --serve dist --apk 1 --worlds desert,incal,bazaar --toggles base,fxaa`.

## The City-Shaft's traversal stall: the cab's top by its triangles (2026-10-12, issue #255)

The 0.3 s frame on the Mac and the 0.9 s one on the Retroid in every City-Shaft traversal ("The load by kind of work",
"The Retroid, round 6") was one frame, ~3.6 s into `--traverse` (the turn done, the traveller carried past the rim's
traffic): no program linked, no first draw, no new geometry or texture in it. A CPU profile of the traversal (a marker
function at its start to place the frame; a build with `--minify false`) put 290 of its 313 ms in
`Player.moveStep → Taxi.topAt → topLocal → cabTop`: the cab's top grid (src/taxi.js, what you stand on, a cab), built
lazily the first time a character asked for a cab's top, by 5 429 rays straight down three's `Raycaster` through
the cab's 1 700 triangles with no BVH. Not a shader, a stream or a collision rebuild; nothing to do with the Xbox's
periodic stall at the rim (one frame every ~3 s, "The City-Shaft's rim on the Xbox, round two"): this was once a
load, the first cab near you (the Signal Market and Wren's cab paid it too).

**The fix.** `cabTopGrid` lays each triangle over the grid points under it and keeps the highest height within the
ray's reach, taking a one-sided face only from its front as the raycaster does (a mirrored matrix flips which side
is the front; an edge-on face is never hit): the same grid to 1e-15 m at every one of the 5 429 points, in 2 ms in
node instead of 200. And `Taxi.warmTop()` makes it as a world's first cab is built (a cab with no physics, the
trailer's, leaves it), so the load pays the 2 ms and no frame does. Tests (tests/taxi.test.js): the grid by triangles
equals the grid by rays (`cabTopCast`, kept for it), under 60 ms, and made by a world's cab's construction.

Measured with load-breakdown.mjs's traversal (`--worlds incal --preset handheld --traverse 20`), the tree before
(2e818342) and this branch; ms:

| | worst frame | p95 | p99 | frames > 100 ms |
|---|---|---|---|---|
| Mac (M4 Pro, headless Chrome, Handheld, 1280 × 720, no vsync; median of three) | 300.5 → **43.5** | 12.6 → 11.3 | 16.3 → 13.7 | 1 → 0 |
| Retroid, GeckoView test app, warm launch (game served from the Mac) | 865.9 → **75.2** | 36.3 → 34.3 | 55.6 → 47.9 | 1 → 0 |
| Retroid, a second load in the same app | 866.7 → **89.5** | 35.7 → 33.8 | 74.3 → 48.8 | 4 → 0 |

The load is unchanged (Mac first frame 4.57 → 4.51 s; the Retroid's 18.0-18.3 → 17.6-17.9 s). What is left on the
Retroid is 6-7 frames a run over 50 ms (the worst 75-90 ms), spread over the traversal.

## The Steam Deck, round 8: the web build's main thread at native resolution (issue #111, 2026-10-12)

**How it was measured.** The Steam Deck OLED in Desktop Mode (no game of the author's running), plugged in, the
runtime the new installer put there (1982001, Electron 44, ANGLE on radeonsi GL), each build copied to
`~/.local/share/hiraeth-bench-games/` and run by `deck-run.sh start headless <dir>` at `REFRESH=90` (the OLED's
Gaming Mode rate), muted, in the bench's own profile; `deck-worlds.mjs --settle 1 --profile 1 --draws 1 --shots 1`:
1280 × 800, the Steam Deck preset at scale 1 (it has no dynamic resolution: the scale read 1 in every view, every
250 ms), 6 s a view after 2 s of warm-up. The builds: origin/main e7c21f7d (before) and the same tree with this
round's changes (after), one sitting each. `steamdeck.local` stopped resolving from the Mac mid-run (`DECK=deck@<ip>`
works), and the Deck suspends after about a quarter of an hour without input on mains (Plasma's default): a bench
does not hold that off, so a run only lasts while someone has used the Deck recently. The Deck slept through most of
the evening: the Signal Market, the Underwater City and the Floating city, the 60 Hz rows, the Unity player and the
loading pen are still to take on it.

**Where a frame went** (V8's profile of an unminified build on the Mac proxy, `deck-mac.mjs`, CPU ×3; self time a
frame): `updateMatrixWorldCached` 5.7 ms at the City-Shaft's start and 6.9 at the desert's camps (the frame's walk of
the scene, 5 500-6 800 objects, about 80 % of it: the rest is the rigs' own walks), three's `Skeleton.update` 1.4 +
its `toArray` 2.9 at the camps (52 skeletons, 2 700 bones, each bone's `matrixWorld` a megamorphic load),
`projectObject` 2.4-3.3, the draws' own work (`renderBufferDirect`, `setProgram`, `bindVertexArray`) 3-5, the still
batches' checks 1.2, the room culler 0.6-1.

**Kept:**
- **Three's `Skeleton.update` from the bones' element arrays** (src/skeleton-update.js `installSkeletonUpdate`, main.js):
  the Unity mirror's `skeletonUpdate` (round 7), moved to src/ and put on Skeleton's prototype for the web game: the
  same products in the same order into the same Float32Array (three multiplies into a Matrix4 and copies it in: one
  rounding to 32 bits either way), the arrays looked up again every 32 frames or when the bones change
  (tests/skeleton-update.test.js, tests/engine-bridge.test.js: bit for bit). Every skeleton in the scene, Mac ×3:
  5.1 → 0.4 ms at the desert's spawn, 3.1 → 0.2 in the City-Shaft, 4.4 → 0.3 in the Signal Market.
- **The frame's matrices from the scene's list** (main.js renderFrame: engine/scene-matrices.js `updateSceneMatrices`,
  the Unity mirror's, without `skipHidden`): the walk's matrices bit for bit (tests/scene-matrices.test.js), three
  reads a frame off each object instead of a dozen. A frame with nothing moved, Mac ×3: 4.5 → 2.3 ms at the desert's
  spawn, 3.7 → 2.1 in the City-Shaft, 3.2 → 1.7 in the Market. The web game edits the scene less than the Unity side
  thought likely (no add, remove or attach in 300 frames at the desert's spawn or the City-Shaft's start), but a burst
  of edits (things spawned frame after frame) would have made the list again every frame: it now waits until they
  stop (`churn`, halved each frame; one edit after a calm stretch still makes it at once), the walk meanwhile.
- **The room culler's verdict kept** (perf.js `InteriorCuller.hide`): a sphere that did not move is not judged against
  the same room again (the City-Shaft's rim: ~3 000 renderables, most still).
- **The still batches' matrices read off the entry** (static-batch.js `update`: the mesh's world matrix's elements kept
  on its entry, not read through the mesh, whose shape is one of hundreds).
- **A still batch never grows during a pass** (static-batch.js `geometryFor(it, later)`, `addLater`): on the Deck the
  City-Shaft's load logged `GL_INVALID_OPERATION: glMultiDrawElementsANGLE: Insufficient buffer size`. A pass's batch
  build runs in three's onBeforeRender, after three has taken the batch's geometry and uploaded its buffers: a level of
  detail copied in then was drawn from buffers that did not hold it yet, and one that outgrew the room
  (setGeometrySize: a new geometry, the old disposed) drew the new ranges from the old buffers, the batch lost for
  that pass. Now a new level is copied in at the frame's update, before the passes, and the mesh draws its old level
  that one frame (tests/static-batch.test.js).

**Before → after on the Deck** (90 Hz; fps; frame ms median / p95 / p99; JS ms a frame (the animation-frame
callbacks' median); GPU ms (timer queries' median); draws a frame, all passes):

| view | before (e7c21f7d) | after |
|---|---|---|
| desert spawn | 46.1 · 22.2 / 22.4 / 33.4 · JS 21.1 · GPU 11.1 · 348 | **51.9** · 22.2 / 22.3 / 22.4 · JS 18.8 · GPU 11.2 · 345 |
| desert camps | 42.0 · 22.2 / 33.4 / 33.4 · JS 23.2 · GPU 12.1 · 293 | **46.3** · 22.2 / 22.3 / 33.3 · JS 20.9 · GPU 12.0 · 289 |
| City-Shaft rim (start) | 46.5-47.1 · 22.2 / 22.3 / 33.3 · JS 20.7-21.1 · GPU 17.8 · 394 | **50.2** · 22.2 / 22.3 / 22.4 · JS 19.5 · GPU 14.7 · 392 |
| City-Shaft crowd | (round 5, an older build: 38.3 · JS 25.8) | **47.1** · 22.2 / 22.4 / 33.4 · JS 20.8 · GPU 13.8 · 303 |
| City-Shaft wide | (round 5: 39.0 · JS 24.7) | **47.4** · 22.2 / 22.3 / 33.3 · JS 20.6 · GPU 19.0 · 434 |

By system (the profile's wrappers, ms a frame, before → after): the G-buffer pass 7.0 → 6.5 at the spawn, 7.6 → 6.6 at
the camps, 6.0 → 5.8 at the rim (the skeletons are updated in it); the shadow passes 1.8-2.0 → 1.4-1.5; the camps'
people 2.3 → 2.0; what no wrapper names (the frame's matrices, the cullers, the batches' checks) 5.8 → 5.0, 6.3 → 5.1.
The pictures are the same (`--shots`: before and after differ where people, cabs and motes moved, 4.7-5.2 % of the
pixels by more than 24 levels; the Mac's own before and after 0.1-4.4 %), and so are the Deck's and the Mac's at one
view (the Mac draws a few more distant details while its own settle runs; nothing else).

**What keeps it from 60 at native.** The main thread: 19-21 ms of JS a frame in the desert and the City-Shaft against
16.7, so at 90 Hz a frame still shows for two refreshes (22.2 ms) and now and then one (the fps over 45). The GPU has
room in the desert (11-12 ms) but not at the City-Shaft's wide view (19 ms). What is left of the JS is three's own
per-pass work (the scene's walk in each pass, the draws' uniforms and bindings: ~9 ms with the passes' sort), the
people and the traveller (~3), the frame's matrices from the list (~1.5) and the rigs' walks (~1.5).

**60 Hz against 90 Hz.** Not measured on this build (the Deck slept before its run). Round 5's 60 Hz rows (an older
build, 24-28 ms of JS) came within 2 fps of its 90 Hz ones, every view's p95 33.4 ms at both. A frame longer than a
refresh is shown for whole refreshes: at 90 Hz that is 22.2 ms (45 fps) with the quicker frames at 11.1, at 60 Hz 33.3
ms. So while the main thread is over 16.7 ms, 90 Hz uncapped is the better rate; 60 Hz pays off once frames are under
16.7, where 90 Hz would show 60 as 11.1 and 22.2 alternating. The preset stays uncapped (the author's call, #159).

**The worlds rebuilt today** (the Underwater City, the City Floating in Space): their views picked
(`deck-worlds.mjs --pick 1`, as android-worlds.mjs picks them: the boot camera, the two densest knots of people, a wide
look; viewpoints-worlds.json) and measured on the Mac only so far: their JS a frame is 6-11 ms there at full speed, the
desert's and the City-Shaft's 9-11, so they are no heavier than the City-Shaft on the main thread.

### Round 9: the rest of round 8 on the Deck, 60 Hz, the Unity player, the loading pen (issue #111, #52, 2026-10-14)

The same rig and the same two builds as round 8 (before e7c21f7d, after = round 8's changes, which landed as
2b11298e), the Deck in Desktop Mode and awake this time (no game of the author's running; `DECK=deck@steamdeck.local`
again). fps; frame ms p95 / p99; JS ms; GPU ms:

| view | 90 Hz before | 90 Hz after | 60 Hz before | 60 Hz after |
|---|---|---|---|---|
| desert spawn | (round 8: 46.1) | (round 8: 51.9) | 48.2 · 33.4/33.5 · JS 20.2 | **52.1** · 33.4/33.4 · JS 18.7 |
| desert camps | (42.0) | (46.3) | 41.4 · 33.5/33.5 · 23.9 | **46.4** · 33.5/33.5 · 21.4 |
| City-Shaft rim | (46.8) | (50.2) | 47.2 · 33.5/33.5 · 20.7 · GPU 17.7 | **50.9** · 33.3/33.4 · 19.3 · 17.6 |
| City-Shaft crowd | | (47.1) | 43.2 · 33.5/33.5 · 22.5 | **49.2** · 33.4/33.5 · 20.1 |
| City-Shaft wide | | (47.4) | 45.8 · 33.4/33.5 · 21.6 · GPU 20.1 | **51.4** · 33.3/33.4 · 19.2 · 18.1 |
| Signal Market start | 57.6 · 22.3/22.3 · 16.7 · GPU 12.7 | **62.9** · 22.3/22.3 · 15.3 · 12.7 | 53.5 · 33.3/33.4 · 18.2 | **59.3** · 16.8/33.3 · 15.8 |
| Signal Market crowd | 63.8 · JS 15.1 · GPU 10.4 | **71.2** · 13.3 · 10.3 | 59.8 · 16.8/16.8 · 15.5 | **59.9** · 16.8/16.8 · 14.5 |
| Signal Market wide | 71.4 · 13.6 · 12.2 | **74.4** · 12.7 · 11.6 | 59.9 · 16.8/16.8 · 14.3 | **60.0** · 16.8/16.8 · 14.3 |
| Underwater City start | 65.5 · 14.5 · 13.2 | **70.4** · 13.6 · 12.4 | | **60.0** · 16.8/16.8 · 14.5 · 14.8 |
| Underwater City crowd | 55.3 · 17.7 · 15.8 | **60.2** · 15.8 · 14.3 | | **59.9** · 16.8/16.8 · 15.2 · 15.0 |
| Underwater City wide | 69.9 · 13.8 · 12.5 | **74.3** · 13.0 · 11.7 | | **60.0** · 16.8/16.8 · 14.3 · 14.4 |
| Floating city start | 69.7 · 13.7 · 9.8 | **80.4** · 11.9 · 9.7 | | **60.0** · 16.8/16.8 · 14.4 · 9.9 |
| Floating city crowd | 60.4 · 15.9 · 11.8 | **70.9** · 13.7 · 11.7 | | **60.0** · 16.8/16.8 · 14.7 · 11.7 |
| Floating city wide | 76.1 · 12.5 · 8.9 | **84.5** · 11.3 · 8.8 | | **60.0** · 16.8/16.8 · 14.0 · 9.0 |

(At 90 Hz the p95 is 22.3 ms in every view, frames showing for one or two refreshes; the scale read 1 everywhere.)

**60 Hz against 90 Hz, measured.** Where the JS is under 16.7 ms (the Market, the Underwater City, the Floating
city, after round 8) 60 Hz holds an even 60: p95 = p99 = 16.8 ms, under 0.5 % of the frames late. 90 Hz uncapped gives
those views 60-85 fps on paper, but uneven: frames of 11.1 and 22.2 ms mixed (p95 22.3). Where the JS is 19-21 ms (the
desert, the City-Shaft) the two rates give the same fps within a frame or two, 46-52, with p95 33 ms at 60 Hz and 22 at
90: at 90 a late frame costs 11 ms, at 60 it costs 17. So 90 Hz uncapped is still the better choice in the desert and
the City-Shaft and 60 Hz in the lighter worlds. The preset stays uncapped (#159); a player who wants the even 60 in
the lighter worlds can set the refresh rate to 60 in Steam's quick-access Performance menu.

**The Unity player** (the newest unity-linux publish, built from 5c942135: Xbox rounds 2 and 3, the GC stall fix
fe9f21e1; not yet the Unity menus of c2e00d87), `deck-unity.sh` in the same sitting, the Deck preset, lean variant,
prepass. fps from the mean frame; p95 / p99 ms; the script's ms; GPU ms. Round 7's end (0f4bbd39) for the change:

| view | 90 Hz uncapped (round 7 → now) | now: p95/p99 · script · GPU | 60 Hz vsync: fps · p95/p99 |
|---|---|---|---|
| desert spawn | 76.7 → **84.0** | 14.8/17.0 · 11.0 · 11.1 | 60.2 · 18.9/20.3 |
| desert camps | 62.7 → **70.7** | 16.0/17.3 · 13.1 · 12.9 | 60.0 · 19.0/20.4 |
| City-Shaft rim | 63.9 → **70.9** | 17.3/19.2 · 12.4 · 13.2 | 62.2 · 20.6/24.0 |
| City-Shaft crowd | 60.1 → **71.6** | 16.2/17.2 · 12.8 · 12.7 | 61.5 · 19.6/21.2 |
| City-Shaft wide | 56.4 → **62.0** | 18.6/20.0 · 11.5 · 16.0 | 62.7 · 20.2/22.8 |
| Signal Market start / crowd / wide | 79.5 / 87.9 / 88.2 → **92.1 / 101.5 / 103.3** | 11.3-13.3 / 12.4-15.1 · 8.8-10.1 · 8.2-10.3 | 59.5-60.1 · 18.0-18.5 |
| Underwater City start / crowd / wide | (new) **97.9 / 86.4 / 97.6** | 12.8-13.4 / 14.5-15.2 · 9.3-10.7 · 9.7-10.4 | 59.9-60.2 · 17.5-18.1 |
| Floating city start / crowd / wide | (new) **112.9 / 101.3 / 124.1** | 10.0-13.0 / 11.6-14.8 · 7.3-9.0 · 7.6-9.6 | 59.7-60.0 · 18.1-18.2 |

What Xbox rounds 2 and 3 bought on the Deck: the City-Shaft's script 14.3-15.1 → 11.5-12.8 ms and its GPU 15.2-18.6 →
12.7-16.0. That is the rim +7 fps, the crowd +11.5 and the wide view +5.6 uncapped. At 60 Hz with vsync every busy
place now shows 60 (its mean frame 16.0-16.8 ms). The City-Shaft's p95 is 20-21 ms there: about one frame in twenty
still misses its refresh. The Unity player holds 60 at native everywhere measured; the web build holds it in the
lighter worlds only.

**The loading pen** (#52, `deck-pen.mjs`, the installed runtime 2191001; the decoder now finds the nib by its hue,
the darker red it has had since the HUD's restyle, not by r > 150; `scripts/transition-perf/pen.mjs` the same): the pen
turns at 81-85 frames a second through a load, its median step 11 ms (the 90 Hz refresh), p95 15-22 ms, the worst gap
134-198 ms, 3-10 gaps over 50 ms a load, the longest stall 91 ms (desert), 93 (City-Shaft), 183 (Market: one).

**The Updates section** (#52, read-only: `deck.py --status-local` and `--status`, what Check runs): runtime 2191001
(1.68), the game the next launch serves 2191; the site has game 2237 (1.73) and runtime 2237001, so Check shows an
update. Download and Restart were not pressed (they update the author's install).

### The loading pen on the Deck: one program at a time (issue #52, 2026-10-15)

The pen measured again (`deck-pen.mjs`, a build of 0733d8a6f copied to `hiraeth-bench-games/`, headless gamescope at
90 Hz, the bench's own profile, muted; the Deck on battery in Desktop Mode): 79-87 frames a second through a load,
the median step 11 ms, p95 14-17 ms, but in most loads **one stop of 0.2-0.7 s** (up to 1.1 s on the first load
of a new build), always about a second into "mixing the inks…". The screencast had no frame at all in those gaps,
not only no turn: the compositor itself had stopped, not the page. A trace of the GL calls (`linkProgram` and the
rest timed in the page) put them right after the first slices of `warmShadersSliced`: one slice had asked for a
dozen or more of the world's programs (each ~265 KB of GLSL) within 40 ms. ANGLE on OpenGL builds them on the GPU
process's main thread, where the page is composited too, so the pen waited for the whole batch. The GPU pacer
doesn't help here: it gives up on the Deck within a second of that burst (three 250 ms waits) and is remembered off
(`hiraeth.pacerOff.<gpu>`; its fences do signal, 45 ms late at idle, but not within 250 ms behind that backlog).
A CSS or compositor-only animation can't help either: the pen already is one.

**Done:** on ANGLE over OpenGL (`oneAtATime` in `warm-shaders.js`: the GPU string says "OpenGL"; `?serial=<ms>` to
measure, 0 off) each new program is flushed and waited for (`isReady`, at most 300 ms) before the next is asked for,
in the game's load and the title's. Elsewhere nothing changes (the Xbox builds two at a time in parallel: waiting
on each would double its load). The same build, `?serial=0` against the default, in turns: 12 loads each way (the
desert, the City-Shaft and the Signal Market, twice with the shader cache warm and twice with it off,
`--disable-gpu-shader-disk-cache`), and 6 more each way of the desert and the City-Shaft for the load times:

| | one at a time off | on |
|---|---|---|
| the pen's longest stop mid-load (the first 0.45 s, the old page going, and the reveal left out) | 65-725 ms, median 254; over 100 ms in 9 loads of 12 | 0-91 ms, median 60; never over 100 |
| frames a second, median step, p95 | 82-87, 11 ms, 14-19 ms | 84-88, 11 ms, 15-18 ms |
| load, mean of 18 | 19.4 s | 16.0 s |

The loads are no slower, and often quicker: the backlog had held up the post and water passes' `compileAsync` too,
each to its 2 s timeout (`post 2006 · water 3962` in the desert's steps), and left programs unfinished for the
first frames. One at a time, those passes take 12-50 ms. When the driver really is slow (a cold cache), the time goes
into "surfaces" (9.8-13.3 s in 2 of 6 loads) where it went into post, water, shadows and first use before. Test:
`tests/warm-shaders.test.js`.

**The Updates section** on the Deck, the same day (the installed runtime, run in the bench's profile with
`HIRAETH_ROOT` on the install, so its Check runs `deck.py --status`; Download and Restart not pressed): it says
"Playing v1.68 · build 2191 (built in) · runtime 2191001" and "v1.78 · build 2372 is available (27.4 MB)" with
Download and restart, Check again, Details and the first four of v1.78's lines. `deck.py --status-local` / `--status`
agree: runtime 2191001, the site's game 2370 then 2372 (1.78) and runtime 2370001.

## Unity on the Retroid (2026-10-12)

The Unity build (`com.rnaud.hiraeth.unity`: the web game's own script in Puerts' V8, drawn by the C# port's ink look)
on the Retroid Pocket Nova (Adreno 740 under Vulkan, 1280 × 960 at 60 Hz), against the web game in the GeckoView test
app (`com.rnaud.hiraeth.gecko`, this branch's `dist`, Handheld held at 0.75: `android-worlds.mjs --modes fixed --scale
0.75`) at the same bench views (scripts/bench/viewpoints.json, viewpoints-worlds.json), in one sitting. The Unity runs:
the bridge's plan (`-views … -bench 6`, BridgeArgs), started with `-mute -metrics` (the frame readout on the screen;
the mute read back from the intent's log line each time). The player's app was never touched.

**What the installed build did** (v1.62, build 2066): with no `-quality` the Android player ran **High at the full
1280 × 960** (BridgeArgs.Quality's default off the Deck), and every frame took at least 33 ms: Android's
`Application.targetFrameRate = -1` is 30 frames a second, so the bridge (vsync 0, -1, as on the desktops) was capped
at 30 even on the title with 3 ms of GPU. And it drew the full Surface shader (the lean variants are the Deck's and
the Xbox's): at High the GPU took 34-55 ms in the desert and 85-146 ms in the City-Shaft and the Signal Market.
A/B'd on that build at the desert's spawn and camps, Handheld at 0.65 (GPU ms): base 35.9 / 33.6; `-lean` 24.7 / 22.3;
`-lean -shadow-lists -no-grd -uniform-layout` 24.2 / 20.8; `-no-shadows` 35.4 / 36.4 (the shadows cost nothing on the
GPU here); `-no-bloom -no-fxaa` 35.5 / 33.8; `-prepass` 31.0 / 31.8, with `-lean` no better than `-lean` alone. Lean +
prepass by scale: 1 → 33.3 / 33.6, 0.65 → 23.0 / 24.6, 0.5 → 19.0 / 19.5: about 14 ms that does not scale with the
pixels (to find: issue filed).

**Now on Android** (BridgeArgs, BridgeRunner, BridgeRenderer): Handheld by default (the web app's own default; the
Graphics setting in the menus is read at the next start), the lean surfaces, 0.75 of the screen at Handheld, and the
display's rate (`targetFrameRate` 60; `-fps N` another). Frames a second (frame p50 / p95 / p99 ms):

| place | Unity as installed (High, 1, 30 cap) | Unity now (Handheld, lean, 0.75, 60) | GPU ms now | GeckoView (Handheld, 0.75) |
|---|---|---|---|---|
| Desert, spawn | 18.2 (55.0 / 58.8 / 59.4) | 39.9 (25.1 / 29.2 / 41.6) | 25.9 | 56.0 (16.7 / 33.3 / 33.4) |
| Desert, Qanat's tree | 29.7 | **60.0** (16.7 / 17.3 / 17.7) | 16.9 | 50.5 |
| Desert, the camps | 19.2 (52.2 / 56.0 / 56.6) | 43.7 (22.9 / 25.3 / 25.9) | 23.2 | 48.9 (16.7 / 33.4 / 33.4) |
| Desert, the dunes | 24.0 | 49.0 | 20.8 | 59.6 |
| Desert, the cave | 22.3 | **60.1** | 16.4 | 59.7 |
| Desert, the Rose House's first room (a temple) | | **60.1** (16.7 / 17.2 / 21.9) | 15.0 | |
| City-Shaft, the rim | 9.0 (110.7 / 117.0 / 128.7) | 37.0 (27.0 / 32.0 / 32.8) | 27.7 | 43.9 (16.7 / 33.4 / 49.8) |
| City-Shaft, the crowd | 15.7 | 44.5 (22.5 / 27.3 / 28.5) | 23.1 | 46.8 |
| City-Shaft, crowd 2 | 18.2 | 47.9 | 21.7 | 49.4 |
| City-Shaft, wide | 6.7 | 23.1 (43.4 / 49.6 / 50.7) | 44.1 | 34.1 |
| Signal Market, the gate | 11.7 | 38.6 (25.9 / 29.3 / 30.8) | 26.1 | 56.0 |
| Signal Market, the crowd | 17.1 | 54.2 (18.5 / 20.5 / 21.3) | 18.8 | 59.2 |
| Signal Market, crowd 2 | 12.9 | 39.2 | 26.2 | 58.4 |
| Signal Market, wide | 10.9 | 38.0 | 27.0 | 59.4 |
| Floating city, start / crowd / crowd 2 / wide | 13.8 (its spawn) | 40.4 / 43.8 / 46.1 / 42.8 | 21.8-25.0 | |

- **Which is better where.** GeckoView is still ahead wherever the GPU is the frame: the Unity build's surfaces cost
  the Adreno 18-28 ms at 0.75 (GeckoView's frames there are mostly a single 16.7 ms refresh, its JavaScript 12-22 ms of them), so it holds 37-49 fps in the desert's open
  views, the City-Shaft and the Signal Market against GeckoView's 44-60. It is level or ahead where little is in view
  (Qanat's tree 60 against 50, the cave 60 / 60, a temple's room 60) and its frames are steadier: its p99 sits within
  a few ms of its median (the bridge's script runs a frame ahead on its own thread: 6-13 ms of it), where GeckoView's
  late frames are whole missed refreshes (p95 33.3, the City-Shaft's p99 50).
- **The load**: from launch to the world settled 8.4 s in the desert, 14.9 in the City-Shaft, 6.8 in the Signal Market
  and the Floating city (the script ready in 2.9-9.8 s of it, then the first frames' meshes), against GeckoView's
  first frame at 16.3 / 18.1 / 13.0 s. **Memory** (PSS, the one process): 1.1-1.6 GB, against 1.5-2.2 GB across
  GeckoView's three.
- **What it would take to reach GeckoView**: the fixed ~14 ms of GPU (above), then the surfaces themselves; `-dyn-res`
  aims at 15 ms of GPU and would only sink to its floor here.

To repeat: the APK from `gh workflow run unity-android.yml --ref <branch>` (a branch run publishes nothing, its APK is
the run's artifact), `adb install -r`, then start it with `am start -n com.rnaud.hiraeth.unity/<activity> -e unity
"'-mute -metrics -level incal -views <file on the device> -bench 6 -out <dir>'"` (scripts/bench/android-bridge.sh does
the same for the bench's own player) and pull `unity-bench.json`; GeckoView:
`node scripts/bench/android-worlds.mjs --serve dist --worlds desert,incal,bazaar --modes fixed --scale 0.75`.

### Unity on the Retroid: the GPU's frame, taken apart (2026-10-13, issue #262)

No GPU profiler reaches the device (no Android GPU Inspector or Snapdragon Profiler on the Mac, no `gpu.renderstages`
producer in perfetto without a system property), so the frame was taken apart with the bridge's own switches, the GPU
time from Unity's frame timing and the GPU's busy share and clock from kgsl (`/sys/class/kgsl/kgsl-3d0`: 99 % busy at
680 MHz in every slow view, so the frame is the GPU's, not its clock). New test switches: `-hide` kinds (skinned, mesh,
inst, grass, crowd, puffs, points), `-census` (what is drawn, by kind, every 300 frames; the instanced sets every 900),
`-surface-skip N` (parts of the Surface shader left out by bit: 1 patterns, 2 weathering, 4 pen detail, 8 colour patches,
16 hatching, 32 the sun's shadow, 64 the local lights, 128 the ground's marks, 256 the shade's tone), `-surface-debug 12`,
`-skin-cull`, `-shadow-depth 16|24`, `-no-view-instances`, `-view-instance-sets`.

**What the "fixed ~14 ms" was.** Not a pass that ignores the render scale: with nothing drawn (`-hide` every kind) the
whole frame takes **0.6 ms** of GPU (the passes, clears, blits, the final upscale and the HUD together). It is geometry
and the shadow maps. At the desert's spawn with the surfaces' fragment work gone (`-surface-debug 9 -debug-view 2`) at
render scale 0.25 the GPU still took 8.7 ms: the plain meshes 4.0 (780 k vertices on screen), the GPU instances 1.9
(4 243 of them, 0.94 M vertices, **every one drawn every frame wherever the camera looked**: InstMats drew its sets with
a 10 km box), the skinned people 1.8 (58 skinned every frame, 38 seen), the crowd 0.6, the grass 0.2; and of those 8.7,
**3.8 ms were the sun's shadow maps** (`-no-shadows -no-urp-shadows`; the earlier "`-no-shadows` changes nothing" was
URP's own 4-cascade maps taking over when the port's are off: `-no-urp-shadows` stops both). The rest of the frame scales
with the pixels, and most of it is the Surface shader's fragment work: 12 ms of the spawn's 26 (`-surface-debug 9`),
**26.6 of the City-Shaft wide view's 44**, the ink composite 3.3 (`-debug-view 2`), bloom and FXAA 0.5. GeckoView draws
the spawn in 458 draws and 562 k triangles at 80 % busy (615 MHz); the Unity build drew 1 151 draws.

**What changed** (all in the shared C# and shaders unless said):
- **The GPU instances drawn only where the view holds them** (InstMats.Draw with the camera's planes, BridgeRenderer):
  a set wholly out of view draws nothing, one partly in view only its instances inside, by their reach round their places,
  as the shadow maps' cull does; the shadows are drawn as before. At the spawn 943 of 4 249 instances drawn (254 k
  vertices of 956 k): 1.4 ms of GPU (`-no-view-instances` 23.9 against 22.5).
- **The depth prepass of every opaque, on Android** (BridgeRunner: `-prepass-min 0`, Android only): the City-Shaft's wide
  view 44 → 37 ms, its start 27.8 → 26.5, the Signal Market 1.5-3 ms less, the desert within 0.5 ms (its views have little
  overdraw). The Deck's default (the big occluders only, 1 m) was 2 ms *worse* here than no prepass (46 ms wide).
- **The surfaces' marks worked out only where they are drawn**, as the web compiles them under their own defines: strata
  rock's coordinates and colour bands (two noises and a derivative a pixel), the ground's ripples, scuffs, grass ticks and
  mud cracks and its colour blobs (each now in its material's uniform branch), the hatching's three pens and its stipple
  (in the branch that draws each; strokes() and stipple() take no derivatives), the grid's and glyphs' coordinates; the
  local lights' loop stops at the first empty light; `posWS` no longer a varying (toThree(worldPos) in the fragment, the
  same numbers). The picture is the same (compared shot by shot at every view), but at the desert's spawn: two tall
  spiky plants on the right that the old build drew are gone with the view's cull; the web game (GeckoView at the same
  view) has none there, and the census puts their set (`desert.star`) behind the camera, so they were drawn where they
  do not stand (why is not found: the same instances' data are what the GPU reads). The desert's dunes 20.8 → 16.2 ms, the spawn ~2 ms.
- **The shadow maps, the composite's and FXAA's targets not loaded before they are overwritten** (HiraethFeature:
  `AccessFlags.WriteAll`; each cascade is cleared first), and the shadow caster's fragment writes no colour. Within the
  noise on the frame; `-shadow-depth 16` or `24` changed nothing measurable (left at D32).
- Measured and left: `-skin-cull` (skinning only the seen people: 0.4-0.7 ms, but their bounds round bone 0 are a guess);
  the shadows' renderer lists (`-shadow-lists`, 0.3-1.1 ms, kept to the Xbox); the composite (3.3 ms, the web's own work).

**Before → after** (frames a second, p50 / p95 / p99 ms; GPU ms), Handheld at 0.75, muted, the same sitting; before:
origin/main's build (run 38393212994), after: this branch (run 38426479335); GeckoView today at the same views and scale:

| place | before | GPU | after | GPU | GeckoView |
|---|---|---|---|---|---|
| Desert, spawn | 39.6 (25.2 / 28.5 / 29.7) | 25.9 | **45.4** (22.0 / 25.4 / 26.5) | 22.6 | 56.9 |
| Desert, Qanat's tree | 60.1 | 17.1 | 60.1 | 15.9 | 51.1 |
| Desert, the camps | 43.9 (22.8 / 25.4 / 26.5) | 23.1 | **46.0** (21.8 / 25.2 / 25.7) | 22.5 | 51.5 |
| Desert, the dunes | 48.9 | 20.8 | **60.1** (16.6 / 17.3 / 18.5) | 16.2 | 59.9 |
| Desert, the cave | 60.1 | 16.6 | 60.1 | 14.4 | 59.7 |
| City-Shaft, start | 37.0 (27.0 / 32.6 / 33.7) | 27.8 | **40.8** (24.5 / 30.4 / 31.2) | 25.2 | 43.9 |
| City-Shaft, crowd | 43.6 | 23.3 | **47.1** | 22.1 | 46.1 |
| City-Shaft, crowd 2 | 48.2 | 21.8 | **52.1** | 20.0 | 48.4 |
| City-Shaft, wide | 23.1 (43.3 / 49.2 / 50.4) | 44.1 | **28.4** (35.2 / 40.8 / 42.6) | 35.8 | 34.4 |
| Signal Market, start | 38.7 | 25.9 | **41.1** | 24.0 | 55.5 |
| Signal Market, crowd | 53.9 | 18.9 | **60.1** | 14.7 | 59.0 |
| Signal Market, crowd 2 | 39.1 | 26.0 | **45.0** | 22.0 | 58.6 |
| Signal Market, wide | 38.1 | 26.9 | **41.3** | 24.0 | 58.9 |

Unity is now level with or ahead of GeckoView in the cave, at Qanat's tree, the dunes, the City-Shaft's crowds and the
Signal Market's crowd, and behind at the desert's spawn and camps, the City-Shaft's start and wide view and three of the
Signal Market's views. Its late frames stay close to its median (GeckoView's p95 there is a missed refresh, 33 ms).

**What is left** (the GPU is still the frame wherever Unity is behind): the Surface shader's fragment work, 8.7 ms of the
spawn's 22.6 and 15.6 of the City-Shaft wide view's 35.8 (`-surface-debug 9`), of which the parts `-surface-skip` can
leave out are only 4.5 and 6.2 together (no one part over 2 ms: the sun's shadow taps, the local lights, the hatching,
the ground's marks each 1-2): the rest is the shader's common work and its size (the lean variant is still one shader for
every material, where the web compiles a program per set of features); then the shadow maps (3.8 ms at the spawn) and
the meshes' vertices. **The Xbox and the Deck** get the shared parts (the instances' view cull, the surfaces' sunk work,
one varying fewer, the overwritten targets not loaded), not the Android prepass default; not measured on them here.

### Unity on the Retroid: the distant shimmer (2026-10-14, issue #218)

"I see a lot of aliasing far in the distance or shimmering" (the author, on the Retroid). The web game had its fix in
round 6 (#225: the far lines' fade, SMAA at Handheld; rendering.md "Far lines that would alias"); the Unity build had
neither, nor the hatching's fade to its tone (`HATCH_AA`).

**Measured on the device** (the testers' APK of this branch, build 2265, Handheld at 0.75 of 1280 × 960, muted, the frame
readout on): the bridge's new `-pan N [-pan-step deg]` (engine/unity/pan.js) pins each bench view, then turns it 0.025° a
frame (a third of a render pixel) and saves every frame (BridgeRunner.Shot: the camera's own pipeline at the render scale,
upscaled to the screen; the first frame's depth too, debug view 4). `scripts/bench/unity-shimmer.mjs` counts, as the web's
motion check does, the pixels whose luma goes one way by over 20 and straight back, per 10 000 px, over the whole frame and
over what is more than 60 m off. "Before" is the same build with the old pipeline (`-aa fxaa -no-ink-far -no-hatch-aa`);
"still" the view not turned (`-pan-step 0`: the world's own motion, people, smoke, traffic). Far flicker, 41 frames:

| view (far share of the frame) | before | after | still | FXAA instead of SMAA | far lines' fade off | hatching's fade off |
|---|---|---|---|---|---|---|
| Desert, the dunes (52 %) | 60.5 | **15.4** | 0.9 | 13.6 | 40.2 | 15.7 |
| Desert, the camps (20 %) | 105.0 | **62.9** | 31.3 | 61.2 | 87.7 | 62.4 |
| Desert, the ramp's foot (19 %) | 94.7 | **60.0** | 12.0 | 52.9 | 97.1 | 45.3 |
| City-Shaft, wide (55 %) | 106.9 | **36.9** | 31.7 | 38.6 | 97.1 | 36.6 |
| Signal Market, wide (68 %) | 90.4 | **40.7** | 8.3 | 39.5 | 93.1 | 41.3 |

- **The source: the ink lines on far detail**, as on the web: every line is at least a render pixel, so where a window's
  frame or a strut is a pixel or two across its lines are a lattice of black pixels the pan resamples each frame (the
  heat maps: the City-Shaft's far facades and rings and its tall shaft, the Market's far towers and bridges, Qanat's
  roofs). The far lines' fade (Composite.shader 1c, `post.js` INK_FAR's numbers, `_NoInkFar` its test switch) takes out
  most of what the turn adds (City-Shaft 75 → 5 over its still floor, the dunes 60 → 15). Not the sources here: the
  hatching (its fade, `HATCH_AA` in HiraethCommon.hlsl strokesLevel, ported for parity, changes nothing measurable), the
  textures (the world's surfaces are procedural: no mipmaps to miss), FXAA's place (already after the composite, at the
  render size, before URP's upscale). What is left is the geometry itself under the pixels (a train's windows, Qanat's
  finials, the City-Shaft's shaft) and the world's own motion.
- **SMAA at Handheld** (Hidden/Hiraeth/SMAA: URP's own SMAA, Medium, its three passes in HiraethFeature after the
  composite at the render size, in place of FXAA; never straight into a back buffer, FXAA there; `-aa fxaa|smaa|none`):
  the far flicker the same as FXAA's (within run-to-run noise), but the near ink is cleaner (FXAA's stair-steps and
  smear on the traveller's outline gone), as the web found.
- **Cost** (`-views -bench 6`, the same sitting, fps / GPU ms): the desert's ramp foot 47.5 / 21.7 → 46.6 / 22.1, the camps
  48.1 → 48.3, the dunes 60.1 → 60.1, the City-Shaft start 41.3 → 41.2 and wide 28.5 / 35.8 → 28.2 / 36.2, the Signal Market
  start 42.6 → 42.1 and wide 42.8 → 42.5. With FXAA instead the GPU is 0.1–0.4 ms lower: that is SMAA's whole cost; the
  fade and the hatching's rule cost nothing measurable.
- **GeckoView** (the web game on the Retroid) already has all three since v1.59 (round 6 above).

To repeat: `gh workflow run unity-android.yml --ref <branch>`, `adb install -r` the run's APK, start it with
`-e unity "'-mute -metrics -level bazaar -views <file> -only wide -pan 40 -out <dir>'"` (add `-aa fxaa -no-ink-far
-no-hatch-aa` for the old pipeline, `-pan-step 0` for the floor, `-pan-live` to watch it turn), pull the folder and
`node scripts/bench/unity-shimmer.mjs <dir>`.

### Unity on the Retroid: what each pixel carries (2026-10-15, issue #262)

The third pass at the Unity build's GPU frame on the Retroid Pocket Nova (Adreno 740, Vulkan, Handheld at 0.75 of
1280 × 960, muted, the frame readout on). Before: the testers' APK of main (v1.77, build 2350); after: this change,
built on the Mac (`scripts/unity-android-release.sh` with `NO_UPLOAD=1`); the bridge's bench (`-views -bench 6`) in one
sitting, the device's GPU at 680 MHz throughout (kgsl). GeckoView the same day, at the same views and scale
(`android-worlds.mjs --modes fixed --scale 0.75`).

**Where the frame goes now.** A development build's GPU recorders (`-split`) give the passes outside the G-buffer: at the
desert's spawn (22 ms) the ink composite 3.3, the depth prepass 2.5, the shadow maps 1.1 + 0.6 a frame (the near one
every other frame, the far one every fourth: 2.1 and 2.3 ms on the frames that draw them), the glow 0.4, SMAA 0.2; the
rest, ~13 ms, is the G-buffer pass (a tiled GPU does its drawing at the end of the pass, so its own recorder reads 0.5).
At a render scale of 0.375 (a quarter of the pixels) the spawn takes 13.3 ms and the City-Shaft's wide view 24.1, so about
10 and 20 ms are fixed (the passes, the shadow maps, the prepass and the G-buffer's vertices) and 12 and 16 scale with
the pixels; with the surfaces' fragment work gone (`-surface-debug 9`) 14.2 and 19.5 remain. The fragment work is the
lever: 8-17 ms.

**What a pixel paid for without running it.** The surfaces' code that a pixel never takes still costs it: compiled out
(a test keyword, not kept) the same parts cost 1.2 / 4.8 / 2.1 ms (spawn / City-Shaft wide / Signal Market gate) more
than when skipped at run time (`-surface-skip 79`), the Adreno allocating registers (and so fewer waves in flight to hide
the shadow taps) for the heaviest path in the program. By part, compiled out: the local lights 1.3 / 2.5 / 1.4, the
weathering and pen detail 1.3 / 2.9 / 2.0, the patterns 0.7 / 1.2 / 0.3, the colour patches 0.3 / 0.6 / 0.4.

**What changed** (all the same picture: the bench's shots before and after differ only where the world moves, the
people, the smoke, a boat, the wind's streaks and the lines' boil, as two runs of one build do):
- **Each part's coordinates and derivatives next to it** (Surface.shader frag): the hatching's stroke coordinates and
  footprints, the form's derivatives, the strata's strokes, the grid's and glyphs' coordinates, the folds', the face's
  pixel and the weathering's seeds were all worked out at the top "in uniform control flow" and held through the colour,
  the patterns, the shadow's taps and the lights. Each is now worked out where it is drawn, still in uniform control flow
  (top level, or a branch on a material's values). 0.8 / 2.7 / 1.4 ms.
- **The plain variant** (`HIRAETH_PLAIN`, a fragment-only keyword; BridgeRenderer.Lean): a lean material with no
  pattern, weathering, pen detail or colour patches (the ground, the people, the props, the rocks) is drawn on a variant
  without their code. 1.1 / 1.4 / 0.7 ms. On Android by default (`-plain` elsewhere, `-no-plain` off): it doubles the
  G-buffer pass's fragment variants, and the Xbox's load counts its pipelines.
- **The local lights out of view not sent** (HiraethLook.CullLightsToView, the bridge's players; `-no-light-cull`): the
  eight nearest the traveller are chosen as before (main.js updateLights), then those whose reach (widened by 2 m and a
  sixth of the distance: the view is a frame old there) is outside the camera's view are left out. Every pixel measured
  its distance to each of the eight. 0 / 2.2 / 1.4 ms.
- **The lean depth prepass without a discard** (its fragment's glass, dissolve and veil test only on the full variant,
  which those materials take), and **the crowd's trim and the grass's look as varyings of their own variants** (seven
  floats a vertex fewer elsewhere): 0.3-0.9 ms together.
- Tried and left: the weathering's two walls as one call in a loop of two (2-3 ms *slower*: the Adreno's compiler does
  worse with the real loop than with the two inlined calls), the lights' loop kept a loop (`[loop]`, no change), the
  shadow's nine taps in a loop (within the noise, and High's path), a variant without a person's paths and metals
  (`HIRAETH_BARE`: 0-0.5 ms, not worth its variants).

**Before → after** (frames a second, the GPU's ms a frame in brackets; GeckoView's frames a second today):

| place | before | after | GeckoView |
|---|---|---|---|
| Desert, spawn | 46.3 (22.3) | **52.4** (19.8) | 54.6 |
| Desert, Qanat's tree | 60.2 (14.8) | 60.0 (13.9) | 54.0 |
| Desert, the camps | 47.7 (21.7) | **53.5** (19.4) | 55.5 |
| Desert, the dunes | 60.1 (16.3) | 60.1 (14.3) | 59.9 |
| Desert, the cave | 60.1 (14.1) | 60.1 (13.7) | 59.7 |
| City-Shaft, start | 36.8 (28.1) | **41.9** (24.9) | 49.0 |
| City-Shaft, crowd | 57.2 (18.0) | **60.0** (16.0) | 53.4 |
| City-Shaft, crowd 2 | 48.9 (22.1) | **54.9** (19.0) | 58.3 |
| City-Shaft, wide | 27.9 (36.4) | **34.6** (29.9) | 36.9 |
| Signal Market, start | 43.3 (22.8) | **51.2** (19.0) | 59.4 |
| Signal Market, crowd | 60.2 (12.6) | 60.1 (11.7) | 59.9 |
| Signal Market, crowd 2 | 47.6 (21.4) | **55.0** (17.9) | 59.8 |
| Signal Market, wide | 43.0 (23.1) | **53.3** (18.4) | 59.4 |

**The gap to GeckoView that is left** (2-3 fps in the desert and the City-Shaft's wide view, 6-8 at the City-Shaft's
start and in the Signal Market): the GPU is still the frame wherever Unity is behind (18-25 ms; GeckoView's Adreno is
75-94 % busy at 615-680 MHz for its 16.7 ms frames, so 12-16 ms of work). In numbers, of the Signal Market gate's 19 ms:
- **the depth prepass, ~2 ms the web does not draw**: off, the desert gains 0.7-1 ms but the City-Shaft's wide view loses
  6 (42 against 36 ms: the overdraw it saves), so it stays on;
- **the code still compiled in that a wall's pixel does not run**: the walls (most of the City-Shaft's and the Signal
  Market's pixels) keep the lean variant with every wall mark and the lights' loop, 3-7 ms by the parts' compiled-out costs
  above. The web compiles a program per set of features (materials.js defines); here that would be a variant per pattern,
  weathering, pen detail and patch, sixteen times the G-buffer's fragment programs (build time, and the pipelines each
  load makes: the Xbox's first-draw stall), not done;
- **the shadow maps, 1.7 ms a frame** (the web draws the same maps on the same schedule);
- the composite (3.3 ms), the glow and SMAA are the web's own passes, at the same size.

To repeat: `NO_UPLOAD=1 scripts/unity-android-release.sh`, `adb install -r -d` the APK, then each world's bench as in
"Unity on the Retroid" above; `-split` needs a development build (`-development` on BridgeBuild.AndroidRelease).

### Unity on the Retroid: every world, what the web leaves out far away, the shadows' draws (2026-10-16, issue #262)

The fourth pass, and the first over **all sixteen worlds** (the bench's 69 views: viewpoints.json's desert,
viewpoints-worlds.json's others), the Unity build against GeckoView on the Retroid Pocket Nova (Handheld at 0.75 of
1280 × 960, muted, the frame readout on, one sitting). Before: this branch's base (e1c00a29d) built on the Mac; after:
this change; GeckoView: the same commit's `dist` (`android-worlds.mjs --modes fixed --scale 0.75`). The bench now reads
what Unity drew (`res.rs`: the Render profiler's SetPass calls, triangles and vertices over every pass, mean a frame;
a release player counts no draw calls).

**What was tried and measured first** (the City-Shaft's start / wide view, GPU ms, before 25.2 / 29.8):
- **Fewer vertices do not buy GPU time.** The big still meshes drawn by pieces in the view too (BridgeShadowChunks' cut,
  the web's tileScene for meshes): 8.9 → 4.9 M vertices and 4.8 → 3.8 M triangles a frame, the GPU 24.8 → 24.5 and
  29.7 → **31.3** (more draws, and the main thread 3 ms longer). Each still mesh's points in a vertex stream of their own
  (what a tiled GPU's binning pass reads), and their normals and colours as half floats: within the noise (±0.3). The
  web's levels of detail run in the engine (lod.js, its levels built on the script's thread): 0.15 M triangles fewer,
  0.4 ms, and the first view's 1 % low 26 → 18 fps while they were built. None kept.
- **The draws' order** after the prepass (by shader and material instead of front to back): 1 ms at the start view,
  nothing wide; not kept. URP's own shadow maps are not drawn (`-no-urp-shadows` changes nothing).
- **Where it does go**: the render scale at 0.375 (a quarter of the pixels) takes the start 22.3 → 15.7 ms and the wide
  view 27.9 → 18.7: 13-16 ms that does not scale with the pixels and is not the meshes' vertices. The GPU instances
  (InstMats: rocks, plants, kits, the bodies' repeated parts) are the largest part of it found: `-hide inst` takes
  4.3-4.6 ms off (1.2 M triangles, 290 SetPass calls); the shadow maps 2-3.5 (`-no-shadows -no-urp-shadows`); the plain
  meshes 3.5 with their pixels (`-hide mesh`); the skinned people, the crowd: under 0.6 each.

**What changed:**
- **The small props past the preset's propFar left out, as the web does.** main.js cuts the big instanced sets into
  110 m tiles and hides each frame the tiles of small props past `propFar` (320 m at Handheld), with the level's small
  props and the flora's (perf.js tileScene, cullFar); the engine ran neither, so Unity drew all of them to the horizon.
  Now engine/game.js culls the level's and the flora's small props each frame with the same cullFar, and gives each set
  main.js would tile (perf.js `tilesInstances`, the same rule) its distance, `userData.instancesFar` = its `drawFar` or
  propFar, plus a tile's reach (77.8 m: main.js keeps a tile whose centre is within propFar of its radius); the mirror
  sends it (`far`) and InstMats leaves out, in the view and in each cascade, the instances whose reach is wholly past it
  (InstMats.far, by the eye, `ViewEye`). Tiling the sets in the engine instead (as main.js) left the triangles where
  they were and made a draw of every tile: the per-instance cut is the same rule without the draws. `-js-off far` as
  before.
- **The shadow maps' casters as renderer lists on Android**, as on the Xbox since round 2 there (HiraethShadows: the
  movers culled by the engine per cascade, the big still meshes cast by pieces, the instances culled one by one):
  the SetPass calls a frame halve (the City-Shaft's start 910 → 494, the desert's spawn 359 → 217, Lorn's 548 → 234),
  1-3 ms of GPU where the shadows had many casters (the City-Shaft, the desert, Lorn), none in the Signal Market.
  `-shadow-draws` as before. In Lorn it also matches the web's picture better: the draws drew some caster the lists'
  sweep leaves out, which put the start's and the wide view's whole ground in shade where the web's is lit.
- **A crash it brought out**: with renderer lists, another camera's frame (a portrait, a page's sketch) reused the
  last main camera's culling results, and Home's first seconds crashed the player (SIGSEGV in
  PrepareDrawRenderersCommand, symbolised with Unity's libunity.sym.so). HiraethShadows now marks a plan culled only by
  CullFor, draws another camera's movers one by one, and has the main camera prepare its own plans again after one.
  The Xbox ran the same code: the fix is shared.

**Every world** (fps: the mean over each view's 6 s, the median of the world's views and its worst view; 1 % low: the
mean rate of the slowest 1 % of frames, the median of the views; GPU: Unity's GPU ms a frame, the median of the views):

| world (views) | Unity before: fps, worst, 1 % low, GPU | Unity after: fps, worst, 1 % low, GPU | GeckoView: fps, worst, 1 % low | after − GeckoView, worst view |
|---|---|---|---|---|
| Desert (5) | 60.1, 51.1, 53.5, 14.4 | 60.1, 54.0, 46.8, 14.3 | 59.3, 55.5, 30.0 | −1.5 |
| City-Shaft (4) | 50.7, 33.5, 34.8, 25.3 | 56.7, 35.8, 44.9, 22.4 | 52.1, 37.0, 30.0 | −1.2 |
| Signal Market (4) | 55.1, 51.7, 47.5, 18.4 | 55.5, 52.0, 48.7, 18.1 | 59.6, 59.4, 32.8 | −7.4 |
| Vael (4) | 60.1, 52.4, 48.5, 16.6 | 60.1, 59.8, 49.7, 15.8 | 59.2, 58.9, 30.0 | +0.9 |
| Vael II (4) | 60.1, 47.6, 54.8, 15.6 | 60.1, 51.5, 55.9, 14.7 | 59.6, 52.1, 32.7 | −0.6 |
| Hangar (4) | 60.1, 60.1, 53.0, 13.6 | 60.1, 60.1, 54.7, 13.2 | 59.6, 59.3, 32.8 | +0.8 |
| Buried Machine (6) | 60.1, 55.7, 54.8, 15.8 | 60.1, 56.3, 54.0, 15.8 | 59.4, 56.4, 30.0 | −0.1 |
| Viridel (4) | 60.1, 60.1, 53.7, 13.6 | 60.1, 59.8, 53.2, 13.6 | 59.7, 58.8, 36.1 | +1.0 |
| Garden of Spheres (4) | 60.1, 58.2, 53.2, 16.7 | 60.1, 59.8, 53.8, 15.7 | 59.5, 59.4, 30.1 | +0.4 |
| Lorn (4) | 60.1, 44.2, 50.6, 20.2 | 60.1, 46.8, 55.0, 19.4 | 59.6, 57.2, 32.8 | −10.4 |
| Lorn II (4) | 49.8, 46.4, 42.3, 20.9 | 52.2, 49.2, 42.8, 19.4 | 57.2, 52.8, 30.0 | −3.6 |
| Home (3) | 60.1, 59.9, 54.4, 12.3 | 60.1, 59.9, 52.4, 12.3 | 59.7, 59.6, 36.1 | +0.3 |
| Glass Dunes (7) | 60.1, 60.1, 54.0, 14.1 | 60.1, 60.1, 54.6, 13.9 | 59.7, 58.8, 36.1 | +1.3 |
| Underwater (4) | 56.7, 49.7, 45.3, 17.6 | 56.7, 50.0, 44.3, 17.5 | 59.4, 58.8, 30.0 | −8.8 |
| Floating city (4) | 60.1, 50.8, 50.7, 18.0 | 60.1, 51.0, 53.0, 18.1 | 59.9, 58.9, 45.0 | −7.9 |
| Moon Foundry (4) | 60.1, 57.8, 53.8, 16.2 | 60.1, 58.6, 55.0, 16.1 | 59.7, 59.1, 36.0 | −0.5 |

The GPU 0.7 ms less a view on average (69 views), up to 3 ms (the City-Shaft's crowds, 15.8 → 13.1 and 19.9 → 16.8;
its start 25.2 → 22.4, 40 → 44 fps). Unity's 1 % lows stay above GeckoView's (the views' medians 45-56 against 30-45:
GeckoView's late frames are whole missed refreshes), but a few views dip lower than before (the desert's
spawn and camps 35-39 → 30-31, Lorn's start 32 → 27; the City-Shaft's better: not explained yet, most are a world's first view, the one
measured soonest after its load), and it is level with or ahead of GeckoView in nine worlds (Vael, the Hangar,
Viridel, the Garden of Spheres, Home, the Glass Dunes, the Moon Foundry, the Buried Machine and Vael II within a frame).
The picture: the bench's shots before and after differ where the world moves (smoke, fire, people, cabs), and in Lorn
(the shadows, above).

**What is left** (behind in the worst view by 7-10 fps in the Signal Market, Lorn, Underwater and the Floating city,
1-4 in the desert's spawn, the City-Shaft and Lorn II; the GPU 18-22 ms there): the 13-16 ms that do not scale with the
pixels, of which the GPU instances are the largest part found (each set its own procedural draw in every pass, with its
own material and buffer: the bodies' repeated parts are sets of 3-10); then the Surface shader's fragment work (round 3)
and the depth prepass the web does not draw. SetPass calls are not it: the Signal Market's halved with no GPU time saved.

To repeat: build as above, then for each world `-mute -metrics -level <world> -views <its views> -bench 6 -out <dir>`
(the plan in the intent's `unity` extra: `am start -n com.rnaud.hiraeth.unity/com.unity3d.player.UnityPlayerGameActivity
-e unity '<plan>'`, the plan read back from the log before anything is measured), pull `unity-bench.json` (its `rs`)
and the views' shots; `-js-off far -shadow-draws` gives the old behaviour on the same build.

### Unity on the Retroid, round 5: the instances, the prepass, static batches, the first view's stutter (2026-10-16, issue #262)

The worlds Unity trails GeckoView in (the Signal Market, Lorn, Underwater, the Floating city) and the City-Shaft, the same
bench and device as round 4; before: origin/main at 18233e6ad (round 4 landed), after: this change. Each lever was tried
on one build with its switch, at the views each world is worst in.

**Where the trailing worlds' GPU goes** (GPU ms at the Signal Market's start / Lorn's start / Underwater's wide view /
the Floating city's start; base 19.1 / 21.2 / 19.9 / 19.5): the plain meshes `-hide mesh` 9.3 / 8.4 / 5.9 / 7.1 (so 10-14
ms of it with their pixels, 7.4 / 9.2 still at a quarter of the pixels); the people and the crowd 1-3; the shadow maps
0.5-1.4; the GPU instances 0.3-0.6 there (5.8 ms in the City-Shaft's start, 5.5 wide); the Surface shader's fragment
work (`-surface-debug 9`) 4.5-7.9; its vertex stage (`-surface-debug 12` against 9, a quarter of the pixels) 1.6-2.6.
Unity's frame draws 2-4 × GeckoView's triangles over its passes (Lorn's start 3.3 M against 0.9 M), but fewer triangles
alone buy nothing: Lorn's ground (one mesh 4.5 km across, 361 000 vertices) drawn by 128 m pieces in the view too, as
the web tiles it, took 3.3 → 2.2 M triangles and the GPU 21.2 → **23.1** ms (the City-Shaft's big meshes in round 4: the
same). The GPU is 99 % busy at 680 MHz throughout (kgsl).

**Tried and kept as switches, off:**
- **The GPU instances' sets merged** by mesh and material (BridgeRenderer.mergeInstances, `-merge-instances`; the bodies'
  parts by their geometry's bytes): the City-Shaft has 175 sets, 112 of them one tree in one material. One draw for
  them: the start 22.4 → 21.0-21.3 ms and the second crowd 16.8 → 16.2-16.4, but the wide view 27.0 → 29.2 (the
  same triangles, 40 % fewer SetPass calls). By size (`-merge-min`, `-merge-max`): the parts' sets merged alone cost the
  wide view 4 ms, the trees alone 2.5. A set that keeps moving leaves its group (it was made again every frame).
  The other worlds: within 0.6 ms.
- **The engine's levels of detail** (lod.js as main.js, `-js-on lod`): the Signal Market, Lorn and the Floating city
  0.5-0.9 ms less, 5-13 % fewer triangles, but the start views' 1 % low 37-47 → 24-28 fps while their levels are built
  on the script's thread.
- **The depth prepass** is needed on Android: without it every one of these views is 0.5-5 ms slower (`-no-prepass`).

**What changed:**
- **The still meshes in Unity's static batches** (BridgeRenderer.StaticBatch, on Android; `-no-static-batch` off), as
  the web draws its still meshes in batches (static-batch.js): once the script has made nothing for 3 s, every plain
  opaque mesh that has not moved for 2 s (not skinned, instanced, in shadow pieces or with shape keys) is combined by
  StaticBatchingUtility (500-1 100 a world in 9-23 ms); again after each later burst of new nodes. A batched node that
  moves, takes another geometry, has its instances baked again or its points moved is drawn on its own again
  (Unbatch: a renderer of its own on a child; the City-Shaft unbatched 6 in its bench, its doors and the like).
  0.4-1.1 ms of GPU in the City-Shaft, the Signal Market and the Floating city, none in Lorn and Underwater; 36 MB
  more memory in Lorn (PSS 1.13 → 1.17 GB). The same picture (the shots differ where the world moves).
- **The first view's stutter**: the frame readout's load report (BridgeMetrics, with `-metrics`) listed the scene's
  shader variants and vertex layouts 2 s after the world settled: every renderer, material and mesh looked at, 43 ms
  of the main thread, inside the bench's first view (the desert's spawn 1 % low 30 fps, Lorn's start 26). Now only with
  `-variants`: the spawn's 1 % low 42, Lorn's 37.

| world (views) | Unity before: fps, worst view, 1 % low, GPU | Unity after: fps, worst view, 1 % low, GPU | GeckoView (round 4): fps, worst, 1 % low | after − GeckoView, worst view |
|---|---|---|---|---|
| City-Shaft (4) | 56.7, 35.8, 44.8, 22.3 | 57.4, 36.8, 36.1, 21.8 | 52.1, 37.0, 30.0 | −0.2 |
| Signal Market (4) | 55.5, 51.7, 48.4, 18.0 | 57.3, 52.6, 51.4, 17.4 | 59.6, 59.4, 32.8 | −6.8 |
| Lorn (4) | 60.1, 46.5, 50.7, 19.6 | 60.1, 47.1, 51.4, 19.3 | 59.6, 57.2, 32.8 | −10.1 |
| Underwater (4) | 56.8, 50.0, 45.6, 17.5 | 56.9, 49.5, 50.4, 17.6 | 59.4, 58.8, 30.0 | −9.3 |
| Floating city (4) | 60.0, 50.9, 50.5, 18.1 | 60.1, 52.5, 53.3, 17.1 | 59.9, 58.9, 45.0 | −6.4 |
| Desert (5) | 60.1, 54.0, 51.8, 14.4 | 60.1, 54.8, 53.4, 14.4 | 59.3, 55.5, 30.0 | −0.7 |

(The batches are made during each world's first view, so its numbers hold them for part of its 6 s.) The City-Shaft's
crowd2 1 % low (44.8 → 36.1, three slow frames) is not explained yet.

**What is left**: the plain meshes' cost that neither fewer triangles nor fewer SetPass calls touch; drawn into the
G-buffer's three half-float targets (28 bytes a pixel, likely ~7 of the Adreno's bins at 960 × 720) a draw is likely paid in every
bin it touches, and Unity draws each mesh in the prepass and the G-buffer where the web draws it once: a G-buffer of fewer
bytes a pixel (the web's is the same), the Surface shader's vertex outputs (28-40 floats a vertex) and its fragment work.

**A note on rounds 4 and 5** (found in round 6): the player's own app (`com.rnaud.hiraeth`, the web game) had been open
on the Retroid since 20:24 on 15 October, 2.3 GB of memory, the top activity whenever the bench's app exited. Every
measurement of rounds 4 and 5 (and round 6's first, discarded) was taken with it alive in the background: their
before-and-after pairs share it, but a Unity run was killed once for memory (the Floating city) and their GeckoView
numbers ran beside it too. Round 6's are taken with nothing else running.

### Unity on the Retroid, round 6: the G-buffer's bytes, the vertex outputs (2026-10-16, issue #262)

The levers round 5 named, tried at the trailing worlds' worst views (the same bench, device and preset; base: origin/main
at ec27ca253, round 5 landed), then the trailing worlds, the City-Shaft and the desert against GeckoView **in one sitting
with nothing else on the device**.

**The tile cost, measured** (`-gbuffer-test N`, a test switch in HiraethFeature: the targets in 8 bits, the picture
wrong; GPU ms at the Signal Market's start / Lorn's start / Underwater's wide view / the Floating city's start, base
18.5 / 21.0 / 19.9 / 18.7): all three targets in 8 bits (16 bytes a pixel against 28) 17.8 / 20.0 / 18.5 / 17.6, the
hatch target alone (24) 17.6 / 20.7 / 18.6 / 18.4, the albedo alone (24) 18.0 / 20.8 / 19.0 / 18.7, the depth in 16 bits
nothing. So the G-buffer's bytes cost what a tiler's bins say, but **about 1 ms for 12 bytes a pixel**, not most of the
gap. None of the targets is lossless in 8 bits (the hatch target packs flags and levels above 1 into each channel, the
albedo's alpha the light and the line's step up to 3): a smaller G-buffer would change the picture. Left as the switch.

**The vertex outputs**: the Surface shader's vertices pass on 28 floats; the bind pose (3), the folds (2) and the form's
point (4) are read only by the people (outfits, eyes, creases, folds, faces), a picture's uv, the form's hatching, the
fluid and the drawn face. A test build without the three (picture wrong for those) took 1.0 / 1.1 / 0.6 / 1.2 ms; then
**slim lean variants** (`HIRAETH_LEAN_SLIM`, `HIRAETH_LEAN_TERRAIN_SLIM`, for the lean materials that read none of them;
the picture the same, shot by shot): 0.4-1.3 ms in every view of the six worlds (the Floating city's wide view 57.9 → 60.1
fps, the Signal Market's start 53.1 → 55.8, the City-Shaft's wide 36.9 → 38.2). **Not shipped**: with them a world's
second view stalls once for up to a second (the desert's camps, the Floating city's crowd, the City-Shaft's second crowd:
1 % lows 3-10 fps, every launch, with and without `-census`): the first draw of a variant combination the prewarm list
does not hold, on the Adreno's compiler, and 128 more Surface variants (384 against 256) for every platform's build.
`Shader.WarmupAllShaders` ran for over 20 minutes on the device. What it needs first: warming the pipelines on Android as
the Xbox and the Deck do (BridgePso: a GraphicsStateCollection traced in a development player); then the slim variants
(the change as tried, not kept in the tree: every `i.bind`, `o.bind` and the others through macros, the three fields under `#if !defined(SLIMV)`,
the two keywords mapped onto the lean ones, and BridgeRenderer.Lean choosing them by the rule above) are worth their ~1 ms.

**The fragment work** (4.5-7.9 ms): the web's Handheld already has its 4 shadow taps, light weathering (`_WearLite`)
and one ink pass (`_PostLite`), and the bridge passes all three; no lever found in this round.

**Where it stands** (nothing else running, one sitting; Unity: the slim test build with `-no-slim`, which draws what this commit does; GeckoView: the same commit's `dist`):

| world (views) | Unity: fps, worst view, 1 % low, GPU ms | GeckoView: fps, worst view, 1 % low | Unity − GeckoView, worst view |
|---|---|---|---|
| City-Shaft (4) | 57.4, 36.9, 31.6, 22.1 | 52.9, 37.3, 30.0 | −0.4 |
| Signal Market (4) | 59.4, 53.1, 52.5, 17.3 | 59.7, 58.3, 36.0 | −5.2 |
| Lorn (4) | 60.1, 46.9, 53.4, 19.4 | 59.9, 56.6, 44.9 | −9.7 |
| Underwater (4) | 56.9, 49.6, 42.7, 17.6 | 59.3, 59.0, 30.0 | −9.4 |
| Floating city (4) | 60.1, 52.5, 53.0, 17.2 | 59.7, 59.1, 36.0 | −6.6 |
| Desert (5) | 60.1, 55.2, 50.4, 14.3 | 57.2, 54.2, 30.0 | +1.0 |

(Against round 5's table, taken beside the 2.3 GB app: the Signal Market's median 55.5 → 59.4 and its worst 51.7 → 53.1,
the others within a frame; GeckoView's within a frame too.) GeckoView draws 0.4-0.9 M triangles a frame there over
230-650 draws; Unity 1.1-3.3 M.

### Unity on the Retroid, round 7: Android's pipeline list, the slim variants' stall found (2026-10-16, issue #262)

The same device, preset and bench as round 6 (Handheld at 0.75 of 1280 × 960, muted, the frame readout on); base:
origin/main at 30fdb799f (round 6 landed). The player's own app was not touched; it sat in the background as a cached
process of ~85 MB throughout, not the 2.3 GB of rounds 4 and 5.

**Android's pipeline list.** As the Deck's (round 14): a development APK (`BUILD_ARGS=-development NO_UPLOAD=1
scripts/unity-android-release.sh`) run with `-pso-trace` by `scripts/bench/android-pso-trace.mjs` over all 16 worlds'
views and walks, the first temple's first room with the ship's rooms, and a fight with the guardian woken (48 launches,
none retried). It ships as `StreamingAssets/hiraeth-pso/Android/Vulkan.graphicsstate`: 177 states of 63 variants,
0.6 MB, 140 of them the Surface shader's (the Deck's has 82: Android's plain and slim variants are its own). The first
world gave 88-100 states, the views of all 16 about 170.
- **Where BridgePso finds it.** The file was named by the graphics API alone, and the APK is Vulkan as the Deck is: it
  now looks in `hiraeth-pso/Android/` on Android. StreamingAssets is a `jar:` URL inside the APK there, which
  `File.Exists` cannot see, so BridgePso reads the list through UnityWebRequest into the cache folder first (3 ms),
  then loads it. The Deck's list in the APK, and Android's in the Linux player, are left by the platform check as before.
- **When it warms**: as on the Deck, on the job system's workers once the script's engine is made (~0.9 s after the
  start), and the main thread waits for it there too. **On Android it is now off by default** (`-pso` warms it,
  `-pso-file` too), for what follows.

**Measured** (each world's views once and its walk, `-slow-ms 50`; **cold**: Unity's own Vulkan pipeline cache,
`cache/vulkan_pso_cache.bin`, deleted first; **warm**: the next launch). The final APK, the list warmed against
`-no-pso` (the drawn prewarm instead, as before). Its shaders were new to the device, which is the case after an APK
update that changes them:

| world | cold: first frame s | cold: frozen load frames (over 1 s, summed, and the longest) | warm: first frame s | stalls after the world settled |
|---|---|---|---|---|
| Desert | 16.9 → 17.6 | 10.2 (3.5) → 10.6 (8.4) s | 9.0 → 8.9 | none either way |
| City-Shaft | 19.0 → 19.9 | 10.0 (3.5) → 9.8 (7.5) | 11.5 → 11.5 | 2-4 frames of 67-83 ms either way |
| Signal Market | 12.8 → 15.8 | 7.7 (2.8) → 9.7 (8.6) | 7.0 → 7.0 | none |
| Lorn | 15.6 → 17.5 | 9.4 (3.4) → 10.1 (9.0) | 8.5 → 8.5 | none (one of 50 ms without, warm) |
| Underwater | 13.9 → 15.2 | 9.5 (4.5) → 9.8 (8.6) | 6.5 → 6.5 | none |
| Floating city | 13.9 → 17.3 | 8.8 (3.9) → 11.2 (10.1) | 7.1 → 7.0 | none |

- **No first-use stall to remove on Android.** Unlike the Deck, no world froze mid-play without the list, cold or
  warm. The Adreno makes these pipelines fast enough, and Unity's own pipeline cache keeps them between launches.
- **A cold load gains nothing.** Without the list it holds still for 8-10 s over a few frames of 1-4.5 s (the drawn
  prewarm, then the first frame's pipelines). With it, the warm-up (8.4-10.9 s on the workers) holds the main thread in
  **one frame of 7.5-10 s**, and the first frame comes 0.7-3.4 s later. A frame that long is past Android's 5 s for an
  unanswered touch, which is reason enough to leave it off.
- **Warm launches are the same either way** (the first frame 6.5-11.5 s; with the list the warm-up takes 30-50 ms).
- An earlier pass, with the list traced before the slim variants (`-no-slim`, `-pso-file`), had seemed to halve the
  cold load's frozen time (8-12 s → 2.5-5.8 s). Its warm-up finished in 0.2 s on a "cold" Unity cache, so the driver had
  already seen those pipelines, from its trace. The Adreno driver seems to keep a cache of its own, which cannot be
  emptied without touching the device. So the list helps a cold launch only if the driver has those pipelines already:
  a reinstall of the same build, not an update.
- What could still use it: warming it a few states a frame (`WarmUpProgressively`), so the loading screen keeps
  moving. Not tried.

**The slim variants' stall was not a pipeline's first use.** Round 6's slim lean variants (built again here,
`HIRAETH_LEAN_SLIM`, BridgeRenderer.Lean) stalled the frame for **~330 ms again and again**, in the desert's camps and
the walk (12 times a launch), the City-Shaft's start, the Signal Market's walk, Underwater's crowd and the Floating city's
crowd. That happened on warm launches too, and with the list warmed (189 states with the slim ones) as much as without it. The
Floating city's frames then went into **GPU faults**: the Adreno driver's `log_gpu_snapshot` 405-413 times a launch,
a 3 s frame, and the GPU drawing nothing until the run was stopped (three of four launches never ended). With
`-no-slim`, no snapshot and no such frame. Bisected on the Floating city with test switches (`-slim-not`,
`-slim-copies`, `-slim-on-plain`):
- the **faults** come from the slim variant on the **copies** made for the GPU instances, the grass and the crowds
  (CopyOf: with HIRAETH_INSTMAT, HIRAETH_GRASS…); left off them, no snapshot;
- the **~330 ms stalls** come from the slim variant **together with HIRAETH_PLAIN** (a fragment-only keyword); with
  either alone, none. The picture is the same either way, so the draw is not lost. More likely the driver makes that
  pipeline again at each use and fails each time, but this was not proven.

So the slim variant now goes only to the lean materials that keep a wall's marks (no HIRAETH_PLAIN), never to a
copy, and only under Vulkan on Android. The ground is always plain, so the terrain's slim variant
(`HIRAETH_LEAN_TERRAIN_SLIM`) was never drawn and is gone; the list was traced again with this rule.

**The build's size.** All of round 6's 128 slim variants cost the APK **8.5 MB** (119.4 → 127.8 MB) for Vulkan and
OpenGL ES 3 together. They are now stripped from every other platform's build and from OpenGL ES 3's
(BridgeShaderStrip, an IPreprocessShaders; `-strip-slim` or `-keep-slim` at the build to try it). That left the APK
at 124.7 MB with the terrain's slim variant still in. As shipped (Vulkan, `HIRAETH_LEAN_SLIM` alone) it is **122.4 MB
against 120.0 MB without them: 2.4 MB, 2 %**. That is worth the frames below. The other platforms carry none of them,
so their size is unchanged (the stripper's OpenGL ES 3 half is what took 127.8 to 124.7).

**Where it stands, in one sitting** (GeckoView first, this branch's `dist`; then the final APK with the slim variant
and with `-no-slim`, interleaved world by world; warm launches, views only; nothing else running but the cached app):

| world (views) | Unity `-no-slim`: fps, worst view, 1 % low, GPU ms | Unity (slim, as shipped): fps, worst view, 1 % low, GPU ms | GeckoView: fps, worst view, 1 % low | Unity − GeckoView, worst view |
|---|---|---|---|---|
| City-Shaft (4) | 57.5, 36.9, 45.8, 22.0 | 58.4, 37.5, 36.7, 21.9 | 52.1, 37.0, 27.7 | +0.5 |
| Signal Market (4) | 57.7, 52.7, 49.2, 17.6 | 58.4, 54.1, 51.4, 17.2 | 59.8, 59.3, 42.0 | −5.2 |
| Lorn (4) | 60.1, 46.7, 54.7, 19.6 | 60.1, 46.9, 52.8, 19.5 | 59.6, 56.9, 32.8 | −10.0 |
| Underwater (4) | 56.5, 49.4, 48.7, 17.6 | 57.2, 50.1, 45.4, 17.5 | 59.4, 58.8, 30.0 | −8.7 |
| Floating city (4) | 60.1, 51.9, 40.0, 17.3 | 60.1, 54.5, 54.9, 16.3 | 59.4, 59.1, 30.0 | −4.6 |
| Desert (5) | 60.1, 54.8, 53.3, 14.6 | 60.1, 55.1, 48.9, 14.3 | 55.0, 54.1, 30.0 | +1.0 |

- **The slim variant as shipped**: up to 1 ms of GPU where the walls with marks fill the view (the Floating city's start
  18.9 → 18.1 ms, its wide view 17.3 → 16.3 and 57.4 → 60.1 fps; the Signal Market's 0.3-0.6 ms, its start 52.7 →
  54.1 fps), 0.1-0.5 ms elsewhere. That is less than round 6's 0.4-1.3, which also gave it to the plain materials and the
  copies. An earlier run of the same rule gave the same numbers within 0.3 fps.
- **No stall**: no frame over 67 ms after the world settled, either way. The 1 % lows move both ways between the two,
  by up to 15 fps, on one or two slow frames of 50-67 ms each. That is the noise of one 6 s view.
- **Against GeckoView**: level or ahead in the City-Shaft and the desert. Behind in the worst view by 4.6 in the
  Floating city (6.6 in round 6), 5.2 in the Signal Market, 8.7 Underwater and 10.0 in Lorn. Unity's 1 % lows are
  above GeckoView's in every view but Underwater's crowd (27.0 against 30.0).

To repeat: build both APKs as above, `node scripts/bench/android-pso-trace.mjs --out <dir> --apk <dev apk> --fresh 1`
(it copies the list into StreamingAssets), build the release APK, then each world's views (and walk) with `-mute -metrics
-views … -bench 6 -slow-ms 50` cold (the app's `cache/vulkan_pso_cache.bin` deleted) and warm, with and without
`-pso` (Android's default is now without) and `-no-slim`; the first frame, the frozen load frames and the late frames are in the app's `unity.log`.

### Unity on the AYN Thor: its render scale (2026-10-16, issue #395)

The author: 40 fps only in the Unity build on the AYN Thor. The Thor has the Retroid Pocket Nova's chip (QCS8550,
Adreno 740; its GPU clock here at most 680 MHz, kgsl) and a 1920 × 1080 main screen at 60 Hz (120 offered, unused), thermal
status 0. Its second, bottom screen (1080 × 1240) shows the launcher: the game draws nothing there (no `Display.displays`
in the bridge). **What the build picked**: Handheld (the Android default; the author's saved setting too), the lean
surfaces, a frame target of 60, and **0.75 of the screen**, the Retroid's rule: 1440 × 810, 1.7 times the Retroid's
960 × 720 pixels on the same GPU. So the frame was the GPU's: 20-34 ms. 40 is no vsync divisor (that would be 30).

**Measured** (the Unity testers' APK, v1.82 build 2490, as installed; `-render-scale` for each scale, so the same build
throughout; the bench's views as on the Retroid, muted, the frame readout on, one sitting; GeckoView: this commit's
`dist` in the test app, `android-worlds.mjs --modes fixed --scale 0.75`). Per world: fps (the mean over each view's 6 s,
the median of the world's views), the worst view, the 1 % low (median of the views) and the GPU's ms (median):

| world (views) | 0.75 (1440 × 810, as shipped) | 0.667 (1280 × 720) | 0.577 (the Retroid's pixels) | **0.5 (960 × 540, now)** | `-dyn-res` 0.667 → 0.5 | GeckoView, Handheld at 0.75 |
|---|---|---|---|---|---|---|
| Desert (5) | 46.9, 39.1, 38.3, 20.1 | 52.9, 43.3, 38.8, 17.4 | 59.5, 47.8, 51.7, 14.3 | 59.5, 55.0, 46.2, 13.4 | 59.5, 50.5, 48.6, 13.5 | 51.1, 49.7, 29.2 |
| City-Shaft (4) | 39.3, 28.2, 29.6, 24.0 | 43.5, 30.9, 32.2, 21.4 | 47.3, 34.3, 33.6, 19.0 | 51.8, 37.0, 33.9, 17.2 | 51.4, 37.0, 35.1, 17.7 | 46.7, 32.6, 23.7 |
| Signal Market (4) | 40.8, 39.7, 35.0, 23.5 | 46.7, 42.6, 38.6, 20.1 | 52.2, 48.7, 38.4, 17.5 | 59.5, 58.6, 51.4, 15.0 | 56.8, 52.8, 45.1, 15.6 | 57.3, 52.7, 29.5 |
| Lorn (4) | 44.1, 33.9, 33.4, 22.3 | 49.6, 38.3, 42.6, 19.5 | 52.0, 44.2, 44.2, 17.5 | 54.4, 47.6, 41.0, 15.1 | 54.5, 44.9, 40.3, 15.8 | 54.2, 47.5, 29.5 |
| Underwater (4) | 39.3, 34.7, 33.1, 24.4 | 44.7, 38.7, 36.4, 21.2 | 50.1, 44.6, 38.4, 18.4 | 57.1, 51.2, 38.9, 16.2 | 55.8, 51.2, 38.5, 16.3 | 53.0, 51.5, 28.3 |
| Floating city (4) | 43.1, 38.8, 37.4, 22.3 | 47.0, 43.3, 39.5, 20.1 | 52.3, 48.8, 38.3, 17.4 | 59.5, 53.9, 49.1, 15.2 | 59.5, 50.9, 51.8, 15.2 | 59.2, 57.6, 32.4 |

The 0.5 column is the new build's own default (no `-render-scale`, its log: render scale 0.5), within 0.5 fps of the
same scale asked of the old build. GeckoView's "0.75" draws 1248 × 702: the web caps the pixel ratio at 2 (a canvas of
1664 × 936 at 0.75); with its own dynamic scale (the web app's default) it settles at 0.65 (0.5-0.55 in Lorn) and makes
53.8 / 48.4 / 58.6 / 58.5 / 58.7 / 59.1 fps in these six worlds.

- **At the Retroid's pixels the Thor is a Retroid**: at 0.577 its GPU times are the Retroid's (the desert's median
  14.3 ms on both) and its views miss 60 where the Retroid's do. Most of the open views needed fewer pixels still: at
  0.5, 15 of the 25 views hold 58-60 (8 at 0.577, 1 at 0.75), and every world's median is level with or ahead of
  GeckoView's; three views stay behind it: the Floating city's start (53.9 against 57.6), Lorn's start (47.6 / 49.1) and
  Underwater's wide view (51.2 / 52.3).
- **Below 0.5 there is little left**: the ~14 ms of GPU that does not scale with the pixels (above, "Unity on the Retroid") is most of
  the frame there: the City-Shaft's wide view is 25.3 ms of GPU at 0.5 (37 fps), 27.5 at 0.577, 33.7 at 0.75.
- **`-dyn-res` is no better than 0.5 held**: it starts at the scale given, steps 0.05 every 1.5 s toward a GPU of 15 ms,
  URP making its targets again at each step; held at 0.5 is level or ahead in every world. Not made the default.

**Now** (BridgeRunner `HandheldScale`): Handheld on Android draws 0.75 of a screen up to the Retroid's 1280 × 960 (the
Retroid unchanged), and on a larger screen as many pixels as 960 × 540 at most: the Thor's 1080p at 0.5, an exact half.
`-render-scale` still overrides it. The picture: softer, the ink a little heavier (it is drawn in the render's pixels,
`HiraethLook.PixelRatio` 1 off the Xbox); the menus and the HUD stay at the screen's own size. With the upscalers of
issue #392 (FSR 1 / SGSR 1 in HiraethFeature) the Thor is the device that gains most: a 2× upscale (the Retroid's is
1.33×), so it would take the sharpest of them by default once they land.

To repeat: the Retroid's scripts with the Thor's serial (`a78d67fe`): for Unity, the plan `-mute -metrics -level <world>
-views <file> -bench 6 -slow-ms 50 [-render-scale s]` per world through the intent (as in round 4 above); GeckoView,
`ANDROID_SERIAL=a78d67fe node scripts/bench/android-worlds.mjs --serve dist --worlds … --modes fixed,dynamic --scale 0.75
--port <yours>`. **Back up the Unity app's `files/store.json` first and put it back after**: the bench's runs play in
save slot 1 and write its flags and encounters (they did here; restored).

## The bench's desert start, under the ship's ramp from 10 to 12 October (issue #265)

The Unity bridge's plans without fixed views (`-idle`, `-tour`, `-walk`, `-play`, and a launch with no plan before the
menus) start the traveller at the level's spawn. In the desert that spot, 8 m off the hatch, was **under the ship's
ramp** from 9f55e63f (the landing moved closer to Qanat, 2026-10-10 evening; the ramp's underside 0.56 m over the sand
there) until 88221816 (v1.62, issue #254: `Ship.clearSpawn` moves a spawn the ship covers to the foot of its ramp, as
the web's `?level=desert` now starts). Through those two days the traveller stood boxed in under the ramp with the
camera pressed over his head, its view the ramp's underside and the ship's floor close up. Since v1.62 every plan
starts where the web game does (tests/bench-start.test.js: the bundle in a bare V8 context starts the desert at the
foot of the ramp; every world's start, and every view and path of the benches, clear of the ship,
tests/route-spawn.test.js). `-hull-spawn` puts a plan back
on the old spot (`level.coveredSpawn`), to compare a new number with one taken there.

**Marked in place above** ("taken under the ship's ramp: see #265"): the Xbox's desert spawn rows from `-idle` on
builds 1937, 1969, 1973 (and its main-thread split), 2027 (round one) and 2067 (round two, on v1.61). Round three's
build 2086 (on v1.63) already starts at the foot of the ramp, so its desert row is not the same spot as the rows before
it. Also from that window and that start, in other pages: docs/systems/xbox.md's Unity numbers at "the 1440p desert
spawn" (Direct3D 12 against 11, the lean variants' 13.1 against 17.9 ms of GPU) and docs/benchmark-web-vs-unity.md's
Xbox table (builds 1743 and 1751, most likely); the Retroid's cold and warm desert loads of round 6 (`?level=desert`,
e7c21f7d), though a load's phases hardly depend on where the first frame looks.

**Not affected**: every run at fixed views (`-views`, the web benches' `viewpoints.json` and `viewpoints-worlds.json`,
which place the traveller themselves): the Steam Deck's desert spawn rows (rounds 6-8, web and Unity), the Retroid's
Unity and GeckoView desert spawn (its installed-build column included), the Xbox's `-views -bench 6` tables. Their
"spawn" view is the foot of the ramp as the ship stood before the landing moved (`viewpoints.mjs`), 60 m from where it
stands now, never under it. And the City-Shaft's "rim (spawn)": its spawn is not near its ship.

**Which way it leaned** (not measured again: the devices were busy). Under the ramp the frame is mostly the ramp's and
the hull's undersides a metre from the lens: the same objects are sent (culling is by the frustum, not by what hides
what), but far fewer pixels of sand, grass, Qanat and its people are shaded, and the composite's edges are few. So the
GPU's ms were most likely lower than at the foot of the ramp, looking out at Qanat, and the script's about the same
(the world runs the same whatever the camera sees). The Xbox's fps there sat at the 60 Hz cap (59.4-59.9), so the
frames a second hardly move; the GPU and frame-time columns are the ones to read as optimistic.

## The City-Shaft's 13 ms, and what ships that no page loads (issue #300, 2026-10-13)

The perf audit of v1.66 (`docs/audits/perf-v1.66.md`) read the City-Shaft's main thread at 13.3 ms a frame at High,
twice the next world's, its load at 8-11 s, and found the Elder's first prototype body in every device's package.
Measured on the Mac (M4 Pro, headless Chrome, ANGLE Metal, muted, 1280 × 720, High, hour 10, clear; the machine
shared, so the load average goes with each number; before and after built from archived copies and run in turn).

**What the 13 ms are.** A V8 profile of 5 s at the `crowd` view (`Profiler` over CDP, an unminified build), the queue
of distant detail drained first: drawing is 56 % of the main thread (`renderFrame`: the G-buffer 21 %, the shadow
cascades 17 %, three's object walk and draw calls), the people 12 % (`npc.update`: their puppets, poses and capes,
about 1.7 ms a frame), the matrices' walk and the batches' ranges 6 %, the traveller 5 %, the crowd 3 %, collision
queries 2-3 %. `scripts/bench/passes.mjs --level incal` (new: any world, at its views in `viewpoints-worlds.json`)
times `renderFrame` alone at 7.3-12.6 ms (load 13-22), 1.8-5.1 ms of it the shadow maps (`noShadow`). The steady
frame, the queue drained (`fps.mjs --warmup 25`, load 6-10): 8.0-12.1 ms of script, the same in both builds.

The rest of the audit's 13 ms was **the queue of distant detail** ("Distant detail after the first frame", above):
when the first view is recorded 13,600-14,200 jobs still wait, 12,600 of them the trees' check against the houses
(fifteen points a tree: three heights, on its axis and round it), and the queue takes its 2 ms of every frame for
18-22 s (4.4-4.8 s of rays in all). The audit's first two views were recorded inside that window.

**The fix: the SAH BVH, built behind the load.** The City-Shaft's 1.15 million collision triangles build into a CENTER
BVH in 0.4 s and an SAH one in 2.1 s, whose rays are 2.6 times quicker (in the page: 22,000 axis rays from the trees'
points, 336 → 127 ms, the same 20,624 hits). SAH was tried before and left out because the load waited for it. Now
`collision: { later: 'SAH' }` (`Physics.create` o.later, `Physics.refine`) builds both at once, each in a worker of its
own (the second from a copy of the triangles, made before the first worker takes the buffers): the load goes on with
the quick one, and the SAH one replaces it when ready, about 2 s after the bake and before the load's own near detail.
The same triangles, so the same answers: the trees dropped once the queue has drained are the same 1,295, by index, in
both builds. Without a Worker (node, the Unity bridge) nothing changes. Tests: `tests/physics-refine.test.js`.

| City-Shaft, High, `crowd` view, two runs each (load 10-13) | before | after |
|---|---|---|
| distant detail left when the view is reached | 14,161 / 13,638 jobs | 11,630 / 11,549 |
| the queue drained after | 21.9 / 17.5 s | 9.7 / 9.2 s |
| its work in all | 4.8 / 4.4 s | 2.4 / 2.5 s |
| the load (navigation to booted) | 5.6 / 5.1 s | 4.9 / 4.5 s |

`fps.mjs` loads: 4.3-5.6 s before, 4.3-4.7 s after (load 6-13), under the 6 s budget either way on a quieter machine
than the audit's (load 8-68). Named and left: the shadow cascades and the people's puppets are the biggest steady costs.

**What ships that no page loads.** `public/` is copied whole into `dist/`, so into the APK, the Deck package and the
over-the-air zip. Two bodies there were read only by tools and tests: the Elder's first prototype (`guardians/elder-v1`,
3.08 MB; the Aerie wears `elder-v3`) and the traveller's second head (`characters/traveller-v1/head-v2`, 2.0 MB and its
0.48 MB of colours; head-v3 replaced it). Both now live in `data/` (`data/guardians/elder-v1/`,
`data/characters/traveller-v1/head-v2/`), where the tests, the motion audit and the rig scripts read them.
`tests/shipped-assets.test.js` keeps it so: every file of `public/` must be named by the code the built pages reach
(vite.config.js `BUILD_INPUT`, its imports followed: static, dynamic, workers, `import.meta.glob`), by its path, or by
its folder and its name (or stem: `item-pictures/${id}.webp`, `sfx/${name}-${i}.mp3`), unless the site keeps it
(`scripts/site-only.mjs`) or it is in the test's `ALLOWED` with its reason (the licences, the provenance notes, the
coral-shirt traveller the Unity bridge build still copies, 5.8 MB no web page loads). `size.mjs`: to the devices
153.14 → 147.81 MB, in the APK and the Deck package 53.96 → 48.63 MB (−5.33 MB).

## The Elder's cost (2026-10-14, issue #237)

`node scripts/bench/elder.mjs --url http://127.0.0.1:6237/ --out <dir> --preset handheld` (the build served by
`scripts/bench/serve.mjs`; muted headless Chrome on the GPU, CDP 6239): the game at `?level=arzach&guardianReview=elder`,
held still at three views round her, the whole frame with her shown, hidden and drawn whole (her levels off), on the GPU
(`EXT_disjoint_timer_query_webgl2`) and the wall, with her own draws and triangles in every pass; her CPU a frame; then
the fight running, a picture of each of her moves.

She is one skinned mesh, 47,784 triangles, 28,724 vertices, 23 bones, one draw a pass, a 2048² JPEG colour map
(21.3 MiB on the GPU with mipmaps), a 2.7 MB file. On the Mac (M4 Pro), 1280 × 720:

| view | Handheld 0.75: her level, triangles a frame (all passes) | High: her level, triangles |
| --- | --- | --- |
| 12 m (the fight) | whole, 83.6k (1.8 draws) | whole, 159.3k (3.3 draws: the fine cascade too) |
| 35 m | 1/8 m, 32.2k (whole: 83.6k) | whole, 159.3k |
| 90 m | 1/4 m, 11.9k | 1/16 m, 108.4k |

Her GPU time is within the Mac's noise (shown against hidden: 0.0–0.3 ms of a 1.7–2.3 ms frame); her fight and pose
0.02 ms of CPU a frame (the kit's two legs, 23 bones; the skinning is the GPU's). Her levels come with the people's rule
(`lodPx`: Handheld 2 px, so on the Retroid at half the distance of High's). Not yet measured on the Retroid itself (the
device runs its own measuring sessions). Proposed next, if its GPU shows her near: a 1024² map on Handheld (5.3 MiB,
built at load from the 2K or shipped as a second file); Handheld already has no fine cascade, so she is drawn twice a
frame there (the G-buffer, the hero shadow).

## Loads and frames since v1.60 (2026-10-15, issue #364)

The author: "Loading levels seems slow, also did we have regressions on fps on the Retroid Pocket Nova and Steam Deck?"
Every build measured as it ships (`npx vite build`; a tag from `git archive`, built the same way), muted, one sitting
per device, against main at 46a9c59 (v1.77) and the same tree with this round's change ("after").

**How.** The Mac (M4 Pro): `scripts/load-breakdown.mjs --runs 3` (the median), High, 1280 × 720, headless Chrome on ANGLE
Metal, the builds served statically, a quiet machine (load 3-10). The Retroid: `scripts/bench/android-worlds.mjs`
(GeckoView test app, Handheld at 0.75, every world's views of `viewpoints-worlds.json`, the app started afresh for each
world; its load is navigation to the first frame) and `load-breakdown.mjs --gecko session --runs 2` for the phases. The
Deck: `deck-worlds.mjs --secs 6 --warmup 2` (the Steam Deck preset at scale 1, `deck-run.sh start headless` at 90 Hz,
the bench's own profile), and its phases by load-breakdown's `measure()` on the Deck's page.

**Loads, s** (to the first frame; the Mac's median of three, the Retroid's one load in a fresh app):

| world | Mac v1.60 | Mac main | Mac after | Retroid v1.60 | Retroid main | Retroid after |
|---|---|---|---|---|---|---|
| Desert | 3.34 | 3.60 | 3.47 | 15.8 | 18.2 | 17.2 |
| Vael | 3.73 | 3.94 | 3.79 | 16.4 | 18.9 | 17.6 |
| Lorn | 4.06 | 4.09 | 4.00 | 18.1 | 20.7 | 19.4 |
| Viridel | 2.49 | 2.50 | 2.44 | 13.4 | 14.7 | 13.7 |
| Underwater City | 2.29 | 2.54 | 2.18 | 12.1 | 14.1 | 13.0 |
| City-Shaft | 4.09 | 4.30 | 4.03 | 18.3 | 20.8 | 20.0 |
| Glass Dunes | 2.22 | 2.34 | 2.16 | 12.1 | 13.9 | 13.1 |
| Buried Machine | 3.27 | 3.41 | 3.27 | 16.9 | 18.8 | 17.9 |
| Moon Foundry | 2.69 | 2.70 | 2.50 | | | |
| Garden of Spheres | 3.01 | 3.00 | 2.93 | 15.1 | 17.0 | 16.0 |
| City Floating in Space | 2.66 | 2.71 | 2.69 | 12.4 | 14.8 | 13.5 |
| Signal Market | 2.71 | 2.54 | 2.42 | 13.9 | 14.9 | 13.9 |
| Home | 1.75 | 1.77 | 1.66 | 7.3 | 8.7 | 7.9 |
| the Lantern | 1.58 | 1.64 | 1.53 | | | |

(v1.70 on the Mac, in the same sitting: within 0.1-0.7 s of v1.60, no trend. The Moon Foundry has no bench views yet, so
the device runs leave it out.)

Where main's load goes, ms (modules: the fetch and parse of the page's scripts; assets: the wait for the models' files,
fetched and decoded in parallel with the build; collision: the bake and its BVH, built in a worker; shaders: compiles and
links; GPU warm-up: the passage's draws and uploads). The Mac: the Desert modules 226 · assets 21 · world 1564 ·
collision 158 · characters 299 · shaders 387 · GPU warm-up 320 · rest 450 · first frame 181; the City-Shaft 204 · 21 ·
1978 · 574 · 460 · 382 · 235 · 286 · 179; Home 209 · 23 · 329 · 36 · 192 · 417 · 147 · 319 · 127. The Retroid (session
loads): the Desert modules 441 · world 3778 · collision 310 · characters 749 · shaders 10 619 · GPU warm-up 914; the
City-Shaft 451 · 5266 · 1152 · 1372 · 10 973 · 798; Home 472 · 672 · 131 · 406 · 6025 · 371.

- **The Mac did not regress** (every world within 0.3 s of v1.60, under the 6 s budget). **The Retroid did, 1.0-2.5 s a
  world since v1.60, and it is the shaders**: a program costs the Retroid ~0.1 s (the shaders phase follows the count:
  the Desert's 93 programs 8.6 s, 112 programs 10.6 s), and every world had gained 17-20 programs. Bisected on the
  program count (exact, so the Mac finds it in a minute a commit):
  - **+8 to +9 in every world, v1.71 → v1.72: 9547bfea7** (#324, the camera pressed into the traveller): his surfaces
    compiled with a define of their own, `S_HERO_CUT`, so markHero's copies no longer shared the programs of the
    materials they were copied from. **Fixed**: the cut is a uniform now, `uCutMe` (1 on his copies and his gear's fluid)
    times the shared `uHeroCut`, in the vertex shader (every vertex past the clip volume: nothing of him drawn, his shadow
    the override's as before; no program carries a discard, so the early depth test stays everywhere). The desert's
    spawn with the cut off and on looks as before (him gone, his shadow kept). tests/scout.test.js.
  - **+3 in every world, v1.76 → v1.77: de712627e** (#338, real light in the ship's rooms): the rooms' materials with
    `ROOM_LIGHT`, five variants of their own (plain, grid, metal, brushed, grid and metal). Since 2026-10-15 the brushed
    and the gridded metal are folded into the plain metal (src/ship/model.js ROOM_LIGHTS_FOLDED), two won back: the
    author couldn't tell them apart. `?level=desert&aboard=hold&roomlights=full` shows the look before; the pairs in
    references/compare/ship-room-lights/.
  - **+2 in the Desert after v1.77**: the Rose House's futuristic skin (#342), shaders of its own; the other houses' skins
    likewise in their worlds. A feature.
  - The City-Shaft's world creation and near detail on the Retroid are +0.5 s each against v1.60 (4.8 → 5.3 s, 1.15 →
    1.6 s); on the Mac the same steps moved 40 ms, so it may be the device's spread. Not chased.
- **After:** 8-9 programs fewer in every world, the Retroid's loads 0.8-1.3 s quicker (its shaders phase: the Desert
  10.6 → 9.6 s, the City-Shaft 11.0 → 10.1, Home 6.0 → 5.0): about half of what v1.60 → main had added.
- **A temple's entry** (`scripts/transition-perf/transitions.mjs`, temple-in in the Desert, the City-Shaft and Lorn, High):
  no hitch in v1.60, main or after, the worst frame 16.8 ms (one 50-67 ms frame in a single run of two of them, not
  repeated). The temples are built with their world (TempleRuntime ~90 ms of the Desert's world creation on the Mac) and
  their rooms drawn ahead by the passage warm-up, so walking in costs nothing.
- **"BVH worker failed, building on the main thread" in the tests** was node's: it has no `Worker`, so every test that
  built a world tried one, failed and baked the world's triangles a second time. Physics.create now builds the BVH at once
  on the triangles it baked when there is no Worker (tests/physics-refine.test.js). No browser load logged it.
- **What the web build fetches before the first frame** (resource timing, the Desert): 26.7 MB in 281 files, v1.60 24.6 MB:
  the Keeper's model (2.9 MB, asked for half-way through the load), the gestures' clips, the B3 traveller (2.7 MB, 2 MB
  lighter than the v1 body) and the head v3. On a first visit over a slow line that is the load; locally it is not.

**The Steam Deck's loads: the shader cache, not a regression.** On the Deck the load is the GPU process compiling. Alone,
one of the game's surface programs compiles and links in 50-70 ms (salted: no cache) and 17-22 ms when ANGLE's cache has
it; in a load, a hundred of them queued, the GPU process gets through about one every 150-170 ms (it composites the
loading screen meanwhile), and post, water and shadows each sit out their 2 s cap for programs still in the queue.
Chromium keeps the compiled programs (`GPUCache` in the profile), so a world loads in half the time once its programs
are in it: the Desert 27 s cold, 12-13 s warm; Home 11-14 → 5-6; the City-Shaft 26-27 → 13-17. Any change to the shaders'
source (most releases touch materials.js) makes every world cold again, so after an update each world's first visit is
the slow one. A larger cache (`--gpu-program-cache-size-kb=524288`, through `deck-run.sh`'s new `ARGS`) was no better;
flushing the GL while polling the programs' status (so their links leave the page sooner) was no better on the Deck or
the Retroid, and was not kept. With the cache's state the Deck's loads move ±5-10 s, and v1.60, v1.63, main and after
measure alike (20-36 s cold, 5-17 s warm).

**Frames: no regression on either device.** The Retroid, every world's views (fps median (the worst view) · main thread
ms a frame):

| world | v1.60 | main | after |
|---|---|---|---|
| Desert | 52.7 (48.9) · 17.6 | 53.0 (48.1) · 17.7 | 52.8 (47.6) · 17.9 |
| Vael | 58.7 (58.5) · 14.7 | 59.1 (58.7) · 14.5 | 59.1 (58.7) · 14.4 |
| Lorn | 56.2 (55.2) · 14.8 | 57.6 (56.8) · 14.7 | 58.2 (57.5) · 14.7 |
| Viridel | 60.0 (58.9) · 12.8 | 59.9 (59.4) · 12.7 | 60.0 (59.3) · 12.6 |
| Underwater City | 58.2 (54.7) · 13.1 | 59.2 (59.0) · 12.7 | 59.4 (59.1) · 12.7 |
| City-Shaft | 43.6 (34.7) · 21.1 | 47.8 (37.4) · 18.8 | 47.0 (37.4) · 19.0 |
| Glass Dunes | 59.8 (58.5) · 12.7 | 59.8 (59.1) · 13.2 | 59.8 (58.7) · 12.6 |
| Buried Machine | 58.6 (51.4) · 12.8 | 59.8 (56.2) · 12.9 | 59.5 (56.4) · 12.7 |
| Garden of Spheres | 59.7 (59.7) · 12.8 | 59.8 (59.2) · 12.7 | 59.9 (59.5) · 12.4 |
| City Floating in Space | 58.5 (58.1) · 14.1 | 59.6 (57.5) · 13.1 | 59.2 (57.7) · 13.1 |
| Signal Market | 58.1 (55.2) · 13.4 | 59.0 (58.5) · 14.1 | 59.4 (58.5) · 13.7 |
| Home | 59.8 (59.0) · 13.4 | 59.9 (59.9) · 13.0 | 59.9 (59.6) · 12.4 |

Under the budget still, as in v1.60: the Desert (median 53, under 55) and the City-Shaft (median 47.8, its wide view 37.4:
under 55 and 40); both no worse than v1.60 (the City-Shaft +4 fps, its JS 21.1 → 18.8 ms).

The Deck (90 Hz, fps median of a world's views). One sitting, every world, v1.60 then main: main 5-15 fps ahead everywhere
(the Desert 37.4 → 44.2, the City-Shaft 33.7 → 41.8, Vael 43.8 → 55.0, the Market 53.1 → 60.1, the Underwater City
56.3 → 65.9, the Floating city 54.0 → 67.7, Home 79.9 → 84.5): round 8's skeletons and matrices (v1.63) and the Xbox
rounds since. Against v1.63, the distant detail settled first (`--settle 1`), v1.63 · main · after: the Desert 40.5 ·
41.3 · 41.3, the City-Shaft 40.8 · 43.2 · 40.9, Vael 47.4 · 48.5 · 50.2, the Market 60.3 · 59.3 · 55.5, the Underwater
City 60.2 · 54.5 · 62.4, the Floating city 59.8 · 58.6 · 59.6. The Deck drifts a few fps between runs as it warms, so the
two that looked worse were measured again interleaved (v1.63, main, v1.63, main): the Underwater City 59.5 · 59.8 · 60.3 ·
57.5, the City-Shaft 41.7 · 41.0 · 43.1 · 43.8, the same. Today's Deck numbers are 5-8 fps under rounds 8 and 9's for the
same builds (v1.63's desert spawn 43.4 now, 51.9 then): the Deck's conditions (Gaming Mode with Steam running behind the
bench now, Desktop Mode then), not the game.

To repeat: the scripts above, with load-breakdown's `PORT` away from the Deck's tunnel (its Chrome takes `PORT + 1` for
DevTools: with the tunnel on that port it drove the Deck's page instead). Not measured: the Xbox; the Moon Foundry on the
devices (no views yet: `--pick 1`); a temple's entry on the devices.

## The Steam Deck, round 10: the main thread, world by world (issue #111, 2026-10-15)

After #364 the Deck was still CPU-bound at native resolution (the Steam Deck preset, scale 1, 1280 × 800): 12-25 ms of
JS a frame against 7-12 ms of GPU. **How it was measured**: the Deck in Gaming Mode, `deck-run.sh start headless <dir>`
at `REFRESH=90` with each build copied to `~/.local/share/hiraeth-bench-games/` (the bench's own profile, muted, tunnel
on port 6495), `deck-worlds.mjs --secs 6 --warmup 2 --settle 1`, every world's views; base (main at c2f4ed6d) and after
interleaved world by world, each in a freshly started bench, so the Deck's drift falls on both alike. The profiles:
`--cpuprofile 1` on an unminified build (`npx vite build --minify false`), and the frame's stages timed by a build with
`performance.now()` marks in renderFrame (not kept). The Mac proxy (`deck-mac.mjs`, `--slow 4`) gave the same JS a
frame as the Deck (24.7 against 22-24 ms at the desert's spawn) and was used to iterate. Note: `--profile 1`'s wrappers
stay on the page for the `--cpuprofile` that follows and take the systems' self time; take the two in separate runs.

**Where a frame goes on the Deck** (ms, the desert's spawn / the City-Shaft's start, the after build): the G-buffer pass
7.8 / 6.5 (three's walk of the scene 0.8, the rest the draws: ~140 material changes of ~48 uniforms each, ~300 draws,
~2 400 GL calls a frame), the shadow passes 2.5 / 2.5, the scene's matrices 2.5 / 2.1 (memory-bound: 6 900 / 5 400
objects, each read for its position, rotation and scale), the still batches' checks 0.9 / 1.0, the cullers 0.4 / 1.4
(the City-Shaft's rim counts as a room: InteriorCuller over ~3 000 renderables), the shadow culler 0.7 / 0.5, the
levels of detail 0.3; outside renderFrame ~6.5 ms in ~25 systems (the traveller 2.1, the story and temples 1.2, the
wind 1.4, people 1-2, the level 0.8, the fluid's gear 0.8).

**Kept** (each the same picture and the same game):
- **Instanced meshes holding no instance are left out of the frame's passes** (src/empty-instances.js, main.js
  renderFrame, hidden with frameHidden after the levels of detail): the pools of gadgets' effects, the fluid's
  splashes, the chimes, a world's responsive bits were 12-17 draws of nothing in each G-buffer pass, most in materials
  of their own. Left alone: a mesh with an onBeforeRender (the crowd's count their own) or children.
- **The shadow override, one copy per program three compiles for it** (shadows.js `shadowVariants`): the instanced with
  and without their own colours, and the traveller's face with its morphs, had three look up a program 10-13 times a
  frame (getParameters, the cache key) in the shadow passes.
- **The toasts' hold by id** (ship/cinema.js `holdsToasts`): `dark()` ran `document.querySelector(HOLD_TOASTS)` every
  frame a toast waited (0.6 ms on the Deck); now the six ids, and the games' HUDs only while a game's screens are up.
- **The wind's wisps out of the view are not built** (wind.js update): each wisp's sphere against the view's frustum
  (with 3 m of room); its strip left clear and made again the frame it is in view. Half the wisps blow behind the camera.
- **Megamorphic reads out of the per-frame loops**: ShadowCuller.begin works out each caster's sphere from the world
  matrix's elements kept on its item (Vector3.applyMatrix4 and getMaxScaleOnAxis, the same numbers); SmallCuller and
  InteriorCuller.boundsAt likewise keep the elements and the kind; the opaque sort keeps each render item's material
  sort id while it holds that material; the still batches' material watch compares without making two closures a call.

**Tried, not kept**: the shared uniforms (materials.js sharedUniforms) sent to a program once a render() call instead of
at every change of material (a patch of three's WebGLUniforms.upload): in the profiles the upload was 2.7 ms, but an A/B
in the same page (`renderer.sharedOnce` on and off, three times each) moved the G-buffer pass by nothing (6.9-7.1 ms
either way): the check costs what the call did. The City-Shaft's 112 tree draws (one material) hidden for a test: the
G-buffer pass only 0.4-0.6 ms quicker: draws of one material cost ~10 µs each, a change of material ~25-30.

**Before → after on the Deck** (90 Hz uncapped; fps the median of a world's views, the worst view in brackets; JS the
median view's animation-frame time):

| world | fps before → after | JS ms |
|---|---|---|
| Desert | 42.1 (37.0) → **44.6** (40.1) | 23.4 → 22.1 |
| City-Shaft | 44.3 (41.3) → **46.2** (43.2) | 22.2 → 21.2 |
| Vael | 49.1 (44.3) → **53.1** (48.7) | 20.1 → 18.4 |
| Signal Market | 58.1 (51.8) → **61.4** (54.0) | 16.9 → 15.7 |
| Lorn | 51.3 (47.8) → **55.0** (50.9) | 19.1 → 17.9 |
| Viridel | 59.6 (48.2) → **65.4** (52.7) | 16.4 → 14.8 |
| Underwater City | 59.8 (53.0) → **62.9** (55.0) | 16.1 → 15.3 |
| Glass Dunes | 65.3 (57.0) → **71.8** (63.2) | 15.1 → 13.8 |
| Buried Machine | 68.4 (65.0) → **73.7** (69.0) | 13.8 → 12.7 |
| Garden of Spheres | 71.9 (64.2) → **74.1** (68.8) | 13.7 → 13.1 |
| City Floating in Space | 58.3 (57.7) → **62.9** (61.2) | 16.3 → 15.4 |
| Home | 82.2 (80.9) → **87.4** (86.9) | 11.3 → 10.4 |

The Retroid (GeckoView test app, Handheld at 0.75, the same two builds; median view fps · JS ms): the Desert 52.4 · 18.6
→ 53.3 · 18.0, the City-Shaft 45.3 · 19.7 → 48.2 · 18.6, Vael 59.4 · 15.3 → 59.4 · 13.9, the Market 58.7 ·
13.9 → 59.6 · 13.3: no view slower (the City-Shaft's wide view is the GPU's, 37 either way).

**Still not 60 at native**: the Desert, the City-Shaft, Vael and Lorn (JS 18-22 ms; about 16 ms gives 60 here). What
is left is three's per-draw work for ~140 materials a pass and the matrices of a 5 000-7 000-object scene, then two
dozen systems of 0.3-2 ms. Levers not taken because they change what is seen or done: the people off the view at a
quarter of the frames past 30 m (src/npc.js `offView`, the Unity bridge's peopleLod), matrices skipped under hidden
subtrees (scene-matrices `skipHidden`: a body's face shown by its level of detail after the matrices would draw a
frame where it was), the near shadow map less often.

## Cold and warm loads, Mac and Xbox (issue #16, 2026-10-15)

What #16 still asked after "The load by kind of work" and the Retroid's round 6: cold first-install loads apart from warm
repeats, on the Mac and the Xbox, for the same worlds; the load split by kind of work; the first playable frame, memory
and traversal p95/p99; the Xbox's resource allocation; and whether the "230-second Xbox load" is still true.

**How.**
- **The Mac** (M4 Pro, headless Chrome on ANGLE Metal, High, 1280 × 720, no vsync): main at 8ca3618f, `npx vite build`,
  served statically. `scripts/load-breakdown.mjs --profile dir --salt word --runs 3 --traverse 60` (new: `--profile`):
  - each world gets a Chrome profile of its own, kept between runs, with Chrome's GPU program cache on and the build
    served as GitHub Pages serves it (`max-age=600`);
  - run 1 is **cold**: a new profile, and every shader salted with a `#define`, so neither ANGLE's cache nor macOS's
    Metal cache outside the profile can answer;
  - runs 2 and 3 are **warm**: Chrome relaunched on the same profile, the same salt;
  - traversal is the harness's own: the traveller carried at 40 m/s along the view and back for 60 s.
  Other agents' builds loaded the Mac (load 12 at the start, 36 at the end), so read these numbers for shape. Home's
  warm runs came last and are the noisiest.
- **The Xbox** (Series X, the Unity port `rnaud.HiraethUnity` 1.78.2373, Direct3D 12, a 4K TV with dynamic resolution,
  muted): a launch through the Device Portal with `-level <world> -walk 60 -slow-ms 100` in `LocalState\args.txt`, read
  from `unity.log`. The portal's `systemperf` and `processes` were sampled every 2 s. The scripts are in the session's
  scratchpad (`loads16/xrun.mjs`; its `--cold` backs up and then removes the app's own caches).
  - **Cold**: the app's caches removed first. That means the D3D12 shader cache in its `AC\*.dxcache*` and the bridge's
    `LocalState\prewarm.txt`, the state a first launch after install starts from. A reinstall was not used: it can
    reset the app type, and changing that is a console setting.
  - **Warm**: launched again right after.
  - **Walk**: W held for 60 s from the spawn, at walking speed. That is a different route and speed from the Mac's
    40 m/s carry.
- **The Retroid** was not connected (it is busy with #262). Its numbers are #364's and round 6's.

**Loads**, s. First frame / first playable is the first of ten frames in a row under 50 ms apart. On the Xbox the first
playable comes 0.3 s after the first frame (one 217 ms frame follows it). Memory: the Mac's JS heap and Chrome's GPU
process; the Xbox's private working set and commit (the app's own process); the Retroid's tab PSS. Traversal is
p95 / p99 / worst, ms.

| world | device | cold first frame / playable | warm first frame / playable | memory | traversal cold · warm |
|---|---|---|---|---|---|
| Desert | Mac | 4.92 / 5.03 | 4.92 / 4.93 (one run 9.31) | heap 188 MB · GPU process 594 MB | 8.8 / 11.5 / 28 · 9.0 / 12.7 / 29 |
| Desert | Xbox | 35.9 / 36.2 | 35.1 / 35.4 | 2.6 GB private · 2.9 GB commit | 21.2 / 26.3 / 217 · 21.0 / 27.1 / 217 |
| Desert | Retroid (round 6, #364) | 15.4 / 16.7 | 15.2 / 15.9 (v1.77 main: 18.2; after #364: 17.2) | tab 1058 MB | 30-32 / 34-41 / 42-64 |
| City-Shaft | Mac | 7.53 / 7.53 | 5.60-5.90 | heap 216-225 MB · GPU process 603-665 MB | 12.5 / 14.2 / 36 · 13.1 / 14.4 / 39 |
| City-Shaft | Xbox | 41.4 / 41.4 | 40.9 / 40.9 | 2.75 GB private · 3.2 GB commit | 32.9 / 34.7 / 67 · 33.1 / 34.8 / 74 |
| City-Shaft | Retroid (round 6, #364) | 18.3 / 19.1 | 17.9 / 18.8 (main: 20.8; after: 20.0) | tab 1296 MB | 29-35 / 40-50 / ~900 (later #255) |
| Home | Mac | 2.60 / 2.61 | 3.34, 4.40 (load above 30) | heap 90 MB · GPU process 347 MB | 6.9 / 8.4 / 156 · 7.7 / 10.8 / 156 |
| Home | Retroid (#364) | | 8.7 (after: 7.9) | | |

**The load by kind of work**, s:
- the Mac's are the cold run's phases;
- the Xbox's come from its log: the bridge's boot (the player, the script's engine, the bundle), then
  `Hiraeth.start`'s own marks in V8 (level; physics; ship, gestures, traveller, people), the mirror into Unity (to
  the first node), and the main thread held up by the GPU pipelines (the frames before the world's first frame, less
  the work above).

| world | device | boot / modules | world | collision | characters | shaders, pipelines | GPU warm-up | mirror and rest |
|---|---|---|---|---|---|---|---|---|
| Desert | Mac cold | 0.53 | 1.77 | 0.22 | 0.32 | 0.44 | 0.82 | 0.80 |
| Desert | Xbox cold | 3.3 | 3.05 | 0.25 | 2.25 (+0.7 life) | **~24** (1.8 at the start, ~22 at the first draws) | in the line before | 1.2 |
| Desert | Xbox warm | 3.3 | 3.09 | 0.25 | 2.27 (+0.7) | **23.9** (15.3 prewarm at the start, 8.6 at the first draw) | in the line before | 1.5 |
| City-Shaft | Mac cold | 0.39 | 2.31 | 0.67 | 0.48 | 0.96 | 2.18 | 0.51 |
| City-Shaft | Xbox cold | 3.3 | 2.83 | **7.63** | 3.70 (+0.9) | **21.2** (1.8 + 19.4) | in the line before | 1.7 |
| City-Shaft | Xbox warm | 3.3 | 2.89 | 7.71 | 3.74 (+0.9) | **20.4** (11.8 prewarm + 8.6) | in the line before | 1.8 |

What it says:
- **"230 seconds" is not today's Xbox number.** That was build 1660 of the WebView2 app (the web game through ANGLE):
  its shader cache was cleared at every launch and the passage warm-up drew everything ("The slow load", xbox.md; fixed
  then). Its last measure was 139.7 s cold and 51 s after a relaunch. **Today the Xbox's Unity build loads the Desert in
  35-36 s and the City-Shaft in 41 s, cold or warm alike.** The WebView2 app (`rnaud.Hiraeth`) was left alone.
- **On the Xbox, cold and warm differ by under 1 s, and more than half of every load is the GPU's pipelines.** That
  holds with the D3D12 shader cache removed or kept, and with or without the prewarm. A warm launch with `-no-prewarm`
  and the cache kept reached the first frame at 35.0 s, the cold one at 35.9 s. While the main thread waits, the
  portal shows the app at 12.5 % CPU (exactly one of the 8 cores) and the GPU's 3D engine at 0 %. Each of the 8-11
  (vertex layout, material state) pairs costs ~1.5-2.5 s of one core, every launch, and the console's cache does not
  shorten it. **So no shader cache explains or fixes the Xbox's load.**
  - The world itself is ~10 s of script: the bundle 0.7 s, `Hiraeth.start` 6.3 s in the Desert and 15.3 s in the
    City-Shaft.
  - The City-Shaft's collision is 7.6 s on the console against 0.6-0.7 s on the Mac. The bridge has no `Worker`, so the
    BVH is built on the script's thread (src/physics.js), and the trees-in-houses and crowd-route ray checks run in V8
    at about a fifth of the M4's speed.
- **The prewarm buys nothing today, because it runs before the script.** BridgePrewarm draws the last launch's pairs
  in the first frame, meant to overlap the script's world build. But the script's engine is made through the main
  thread (`new JsRuntime(BridgeHost.OnMainThread, …)`), which sits in that 12-15 s frame. The engine came at 17.9 s in
  the warm Desert against 4.4 s cold, so the prewarm's time is added, not hidden. The likely fix: begin the prewarm's
  draws once the engine is made (`scriptEnvMade`), so they run beside `Hiraeth.start`. The expected result is ~28 s for
  the Desert and ~29 s for the City-Shaft, whose 15 s script would hide the 12 s prewarm. It is not made here: it needs
  a Unity build and a check on the console. After it, the floor is the pipelines' ~2 s each. The next things to look at
  are Unity 6's own pipeline warm-up (`GraphicsStateCollection`) and fewer pairs.
- **On the Mac, a warm load is no faster than a cold one.** The cold Desert loaded in 4.9 s and the warm one in 4.9 s.
  The City-Shaft's 7.5 s cold against 5.6-5.9 s warm is the GPU warm-up's uploads (2.2 s against 0.3 s), which moved in
  one run only. On Metal a salted, uncached program links fast (the surfaces step: 0.34 s cold). With Chrome's program
  cache on, the warm surfaces step took 0.83-2.2 s, because reading programs back from the cache is no quicker than
  compiling them here. The world's creation (1.8-2.3 s) and its uploads are the Mac's load. As on the Retroid (round 6:
  cold only 0.2-0.9 s slower than warm), a first install is not the slow case on either web target.
- **Memory.** The Mac's JS heap is 90-230 MB and its GPU process 300-670 MB. The Xbox's app peaks at 2.4-2.8 GB
  private and 2.8-3.2 GB committed: 55-62 % of its 5 GB, so memory is not what limits it.
- **Traversal.** The Mac's p95 is 7-13 ms and p99 8-16 ms, with no frame over 50 ms in the Desert or the City-Shaft.
  Home has one 155 ms frame on every run (and a 406 ms one in a loaded run): left for a follow-up, it was not looked at
  here. On the Xbox's walk, the Desert's p95 / p99 is 21 / 26-27 ms at 54-60 fps. Its frames over 50 ms are one
  217 ms frame right after the first frame (a managed GC and script frame 4) and a 100 ms one, plus windows peaking at
  67-83 ms. At the City-Shaft's spawn, the walk runs at 46-51 fps with p95 33 ms: vsync halves the frames that miss
  (issue #113's rim). No stall of over 100 ms was found on either Xbox route after the first frame.

**The Xbox's resource allocation (Developer Mode), confirmed:**
- **App type Game.** The app reads its own memory limit as 5120 MB (`MemoryManager.AppMemoryUsageLimit`, logged as
  "app type Game"). An App gets ~1 GB.
- **D3D12 device.** "SraKmd_arden", feature level 11.0, 4096 MB of video memory, an app VRAM budget of 4147 MB, unified
  memory.
- **CPU.** 8 logical processors (Unity's job system takes 7 workers). Note the app CPU reading: during a pipeline wait
  it is 12.5 %, one core.
- **GPU share.** The 3D engine is 83-88 % busy at the 4K spawn, far above the 45 % an App gets: the game has the whole
  GPU.
- **What not to read from the portal.** Its own adapter figures (512 MB dedicated, 832 MB shared) are the system OS's
  view, not the game's budget: while the game runs, "shared used" reads 1.1 GB. Engine 5 sits at 100 % from the first
  sample (the display's, not the game's).

To repeat: `load-breakdown.mjs --worlds … --profile <new dir> --salt <new word> --runs 3 --traverse 60` with `PORT` away
from 5173. For the Xbox, the steps above, each run ending with the app stopped and `args.txt` removed
(`node scripts/xbox-unity.mjs args ""`).

## The Xbox's load, round two: the City-Shaft's collision after the first frame, the pipelines on the workers (issue #16, 2026-10-15)

The round above left two things to fix on the Xbox: the City-Shaft's 7.6 s collision step on the script's thread, and the
GPU's pipelines, ~20-24 s of every launch made on one core.

**The collision step was the trees, not the BVH.** In node on the Mac (a script in the session's scratchpad, `xbox-load/phys.mjs`), the City-Shaft's
bake and BVH of 1.16 million triangles take 0.37 s and `level.init` 3.06 s. Almost all of that is the check for trees a
clump put inside a house: a dozen rays through the collision for each of ~8,400 trees. The web has finished that check
after the first frame since issue #14 (`src/deferred.js`); the engines still did it all before. Now engine/game.js does
as main.js does. It passes a `DeferredWork` to `level.initSteps`, does the jobs within `DEFER.near` (140 m) of the
traveller, the ship's ramp and the ways through before the first frame (291 jobs here), and runs the rest
`DEFER.budget` (2 ms) a frame after it, nearest first. A passage's far side is finished before it is shown. A bench's
fixed views (`view`) do it all first, as before, and so does `-js-off defer`.

Measured on the Xbox (Series X, `rnaud.HiraethUnity` 1.78.2399, Direct3D 12, a 4K TV, muted). The same script bundle, put in
LocalState (`-bundle`), with and without `-js-off defer`; `-level incal -walk 60 -slow-ms 100`. Cold: the app's D3D12
caches and `prewarm.txt` removed first. Times are seconds after launch.

| City-Shaft | collision step | `Hiraeth.start` | first node | first frame of the world | walk p50 / p95 / p99 ms, hitches |
|---|---|---|---|---|---|
| cold, before | 7.61 | 15.3 | 22.2 | **44.6** | 17.4 / 33.2 / 34.9, 40 |
| cold, after | 1.01 (+0.96 near) | 9.6 | 16.5 | **38.8** | 19.1 / 28.6 / 31.2, 6 |
| warm, before | 7.62 | 15.4 | 32.7 | **44.4** | 17.4 / 33.2 / 35.0, 37 |
| warm, after | 1.02 (+0.97 near) | 9.8 | 26.8 | **38.2** | 19.2 / 28.6 / 31.3, 7 |

- **The City-Shaft's first frame is 5.8-6.2 s sooner,** cold or warm.
- **The rest is done on the frames that follow.** The near jobs cost 0.96 s before the first frame. The other ~8,100 jobs
  take 2 ms of each frame while you walk, for a few minutes on the console. The walk's median frame goes from 17.4 to
  19.1 ms. Its p95 and p99 are lower, at 28.6 / 31.2 ms against 33.2 / 34.9, and it has 6-7 hitches against 37-40. At the
  spawn the walk holds 49-50 fps, as before.
- The Desert has no such check (its collision step is 0.25 s): its first frame came at 39.5 s cold and 38.4 s warm on this
  build, the same with or without.
- Build 2399 is slower to its first frame than 2373 (round one: 35.9 / 35.1 s in the Desert, 41.4 / 40.9 s in the City-Shaft).
  The script is the same, and the world's first frame waits longer on the pipelines: 11.3-11.7 s warm, 20-22 s cold.

**The pipelines: BridgePso (built, not yet measured on the console).** Unity 6's `GraphicsStateCollection` holds the states
a run traced (shader variant, vertex layout, render state, targets). `WarmUp` makes them as jobs on the job system's
seven workers, where today's first draws make them one after another on the render thread. `BridgePso.Begin` (BridgeRunner's
start, before anything is drawn) loads `StreamingAssets/hiraeth-pso/<graphics API>.graphicsstate` and warms it, while the
script builds the world and the loading screen draws. The log says when it is done (`pso: n of m states warmed, … ms after
the start`). With a collection, the drawn prewarm (BridgePrewarm) is left out (`-draw-prewarm` keeps both). Without one,
the drawn prewarm now waits for the script's engine before it draws, because the engine is made through the main thread
that the prewarm's first frame held for 12-15 s.
- Unity traces only in a development player. `-pso-trace` in one (the workflow's `development` input) traces each launch
  into `LocalState\pso-trace.graphicsstate`, reading it first, so launches in other worlds add to the same file. It saves
  20 s after the world settles. Fetch the file into `unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Direct3D12.graphicsstate`
  (unity/.gitignore lets that folder in) and commit it. `-no-pso` turns the warm-up off for an A/B.
- **Measured in round three** (below): the list made the load 39-47 s longer and was not shipped.
- **Not done yet (then):** the console run. It needs a build of the branch by the Xbox workflow, which only a push can start: a
  development build to trace the Desert, the City-Shaft and the worlds a save may start in, then a release build carrying
  the collection, to measure cold and warm against the numbers above. The C# compiles in the editor (6000.6.4f1, batch
  mode). Expected: the 11-22 s wait at the first frame drops toward the slowest single pipeline (~2.5 s), if the
  console's driver makes pipelines in parallel. If it does not, the fallback is still the drawn prewarm, now overlapping
  the script (about 7 s sooner).
## The Xbox's load, round three: the pipeline list measured and dropped, the drawn prewarm off (issue #16, 2026-10-17)

Round two built BridgePso but did not measure it on the console. Here the list was traced over every world and measured
against the first draws. The list made the load much longer, so it was not shipped. The drawn prewarm made every warm
launch 9 s longer, so it is now off on the Xbox.

**The trace.** A development player (1.80.2452, `-pso-trace`) ran every world's views and walk, its first temple and the
ship's rooms, and a fight. That gave 158 states of 42 variants (511 KB). The title adds nothing: the trace saves 20 s after
a world settles, and the title has no world.

**Measured** on the Xbox (Series X, `rnaud.HiraethUnity`, release build, Direct3D 12, a 4K TV, muted) with
`-mute -level <world> -walk 60 -slow-ms 100`. Cold means the app's D3D12 caches and `prewarm.txt` were removed first. The
times are seconds after launch to the world's first frame.

| build 1.83.2528 | Desert cold | Desert warm | City-Shaft cold | City-Shaft warm |
|---|---|---|---|---|
| `-no-pso` (the drawn prewarm, as shipped until now) | 45.0 | 52.9 | 42.7 | 50.2 |
| the list warmed (BridgePso) | **83.9** | **92.9** | **89.5** | **90.3** |
| `-no-pso`, no `prewarm.txt` | | 43.6 | | 41.9 |

- **The list is 39-47 s slower.** `WarmUp` took 78-87 s for 158 states. The pipelines were made in parallel: the app used
  ~75 % of the CPU for over a minute while the GPU sat idle. But each state cost ~3 core-seconds, far more than the same
  pipelines made at the first draws: the Desert's first frame waits 27-28 s for them on a cold driver cache. The script's
  `Hiraeth.start` waited behind the workers (76-85 s, against 6.5-9 s without). A warm launch was no quicker, because the
  driver's cache did not shorten the warm-up. **The Xbox ships no list.** `-pso-file` still warms one for a test; the
  traced file is kept outside the repository.
- **The drawn prewarm cost 9 s on every warm launch.** It draws last launch's 9 (layout, state) pairs in one frame, while
  the script builds the world. On Direct3D 12 that frame held the main thread for ~25-30 s. The script's start waited on
  it (`Hiraeth.start` 29.6-32.1 s against 6.6-9.0 s). The world's first frame then still waited ~13.5 s on its other
  pipelines. Now BridgeRunner leaves it out on the Xbox (`RuntimePlatform.WSAPlayerX64`), and `-draw-prewarm` draws it.
- **The driver's cache barely helps.** Cold or warm, the world's first frame waits ~25-28 s on its pipelines. That wait
  is most of the load and is still the next thing to cut.

Build 1.83.2546 (the change), the same runs. Before is `-draw-prewarm` with a `prewarm.txt` from the run before it:

| build 1.83.2546 | Desert | City-Shaft |
|---|---|---|
| cold | 44.1 | 42.7 |
| warm | **44.1** | **41.9** |
| warm, `-draw-prewarm` (before) | 53.1 | 50.9 |

**A warm launch reaches the world 9.0 s sooner in both worlds**, the same as a cold one. The walk is unchanged:
54.8-55.2 fps in the Desert and 47.4-48.8 fps in the City-Shaft.

The round's starting points (35.9 / 35.1 s Desert, 38.8 / 38.2 s City-Shaft) were on builds 2373 and 2399. Build 2528 is
slower to its first frame with the drawn prewarm on: 45.0 / 52.9 s Desert, 42.7 / 50.2 s City-Shaft, with more to build
and more pipelines. With this change it is 44.1 / 44.1 s and 42.7 / 41.9 s.

## The Steam Deck, round 11: three levers that change what is simulated (issue #111, 2026-10-15)

After round 10 four worlds were still under 60 at native resolution, CPU-bound (JS 18-22 ms). The author approved three
levers that change what is simulated or how often something is drawn, taken on the **Steam Deck preset only** (perf.js
`deck`; Handheld is unchanged: the Retroid was in use by the player's own app, so it could not be measured):

- **People out of view, past 30 m, a quarter of the frames** (`peopleLod`; main.js sets each person's `offView` from the
  last frame's view, src/motion-kit/view.js inView, with 3 × their scale + 6 m of room round them for their shadow and a
  turn of the camera; src/npc.js then moves them as past 110 m, and takes the time missed at once back in view). The
  Unity bridge's rule (engine/game.js), now on the web too.
- **Hidden subtrees' matrices stepped over** (`skipHidden`, engine/scene-matrices.js). The side effect named in round
  10, a thing shown after the matrices (a distant body's face by skinned-lod.js, anything a culler or level of detail
  shows again) drawn a frame where it was when it was hidden, is closed by `catchUpShown(scene)`: the list keeps the
  subtrees it stepped over this frame, and once the cullers, the levels of detail and the empty instances have run
  (renderFrame), each of them shown now is made as the walk makes it, before the still batches copy their matrices
  (statics.update moved after it) and before the first pass. Reads through three (getWorldPosition, the physics'
  movers' updateWorldMatrix) get the walk's matrices anyway; only a direct read of a hidden object's `.matrixWorld`
  sees it where it was hidden.
- **The near shadow map every 4th frame** (`nearEvery` 2 → 4; the rule in shadows.js `nearDue` / `farDue`). It was
  already kept over two frames on the Deck, drawn again at once when the camera turns 0.1 rad or moves 4 m from the view
  it was culled for (VIEW_SLACK), so a fast turn or a cut never shows the lag; between, it is looked up where it was
  drawn. What lags is another caster's own movement: a walker's shadow up to 3 frames, ~8 cm at 50 fps, about 1.4 of
  the map's 5.9 cm texels under the 4-tap filter. **In a fight** (foes.js `fighting`: a foe chasing or striking
  within 28 m, or a lock-on) the count is `nearFight` 2, as before (`nearEveryNow`), the foes' shadows kept to their
  feet. The far map stays every 8th frame, one frame after the near map's (never both in one frame, either count).

**How it was measured**: one build, the levers set off and on in the same page view by view (`deck-worlds.mjs --sets
'off={…};a={…};…'`, the preset's keys assigned at run time; `android-worlds.mjs` takes `--sets` too), the Deck as in
round 10 (Gaming Mode, `deck-run.sh start headless` at `REFRESH=90`, the build in `~/.local/share/hiraeth-bench-games/`,
`--secs 6 --warmup 2 --settle 1`, every view and walk). **The first set measured after a view is placed reads 1-3 fps
high** (run 1, levers off first, made every lever look larger; run 2 in the opposite order made "off" look better), so
two runs of opposite order, and the mean of their medians.

| world | off | people (a) | hidden (b) | near ÷4 (c) | near ÷3 | all, ÷3 | **all, ÷4** | JS ms off → all |
|---|---|---|---|---|---|---|---|---|
| Desert | 44.3 | 46.1 | 45.7 | 46.2 | 46.4 | 47.7 | **48.4** | 22.3 → 19.9 |
| City-Shaft | 45.0 | 46.8 | 48.0 | 46.3 | 46.4 | 48.3 | **48.4** | 21.9 → 19.3 |
| Vael | 51.9 | 52.3 | 53.0 | 54.2 | 53.2 | 53.7 | **55.0** | 19.0 → 17.3 |
| Lorn | 54.1 | 54.0 | 54.7 | 55.8 | 55.8 | 56.8 | **57.0** | 18.0 → 16.6 |

(fps the median of a world's views and walks.) The levers alone are 0.5-2 ms of JS each; the near map's also takes
the GPU's share of the near pass (the City-Shaft's GPU ms 16.9 → 11.3, its draws a frame ~380 → ~300 on average).
Every 3rd frame measured the same as every 4th alone and ~0.6 fps under it with the other two, and would have needed
the far map moved (3 and 8 share frames), so 4 was taken.

**Standing still nothing changes**: headless muted Chrome on the Mac at 1280 × 800 on the Deck preset
(`deck-mac.mjs`, `deck-worlds.mjs --shots 1 --sets`), the desert's camps and the City-Shaft's square, levers off then
on in the same page: 5.3 % / 2.3 % of pixels differ, against 4.8 % / 1.8 % between two shots with the levers off, all
of it smoke, walkers, snails and the traveller's breath (changelog v1.78). tests/deck-levers.test.js (the people's rate
off view and back, the wiring, the refresh rule and the fight's count), tests/scene-matrices.test.js (the catch-up:
without it a shown subtree is drawn where it was hidden; with it every shown matrix is the walk's).

**Still not 60**: the desert and the City-Shaft (~48, JS ~19-20 ms), Vael 55, Lorn 57. Draw calls (the G-buffer's
material changes) are the next lever, taken separately.

## The Steam Deck, round 12: every world, Unity against the web (D18, issues #111 / #264, 2026-10-15)

The plan's D18 (docs/plans/unity-default-portables.md): every world on the route and Home, in both engines, on the
Deck, before the switch.

**What ran.**
- **Device**: the Steam Deck OLED in Gaming Mode, plugged in; gamescope's headless backend at 1280 × 800 and 90 Hz;
  muted; in the bench's own profiles.
- **The two builds, both from origin/main db5a37fc** (063efdfb's code: db5a37fc only touched CLAUDE.md):
  - the web: `npx vite build`, served to the installed runtime (Electron 44, ANGLE on GL, radeonsi);
  - the Unity player: the `unity-linux` release (IL2CPP, Vulkan on RADV, built from 063efdfb by run 187, digest
    fb5023aa…). Its bundle was swapped for the same commit's bundle plus this round's bench code (the walks and every
    frame's interval in its results; nothing the game runs).
- **Settings**: the Steam Deck preset in both, at native resolution with no dynamic scale. The web is held to the
  90 Hz refresh by its vsync; the player runs uncapped, as in rounds 6-7.
- **The script**: `node scripts/bench/deck-engines.mjs --web <dir on the Deck> --unity <player> --out <dir> --lock <dir>`,
  then `deck-engines-summary.mjs <dir>`. The results are in scripts/bench/results/deck-engines-d18.json. Per world and
  engine it makes:
  - **a cold launch**: a new profile and empty shader caches of the bench's own. That is Electron's profile with
    `MESA_SHADER_CACHE_DIR`; for the player, its `XDG_CONFIG_HOME`, its `TMPDIR` (Unity's pipeline cache) and Mesa's
    cache. Only the start view is measured;
  - **a warm launch** on those same caches, where every view and walk is measured: viewpoints.json's desert,
    viewpoints-worlds.json's others (the Moon Foundry's views were picked in this run).
- **How each engine measures**:
  - the web: `deck-worlds.mjs --settle 1 --secs 6 --warmup 2`;
  - the player: each view measured on a second pass, then the walk (`deck-unity.sh`, `-bench 6 -split`).
- **What the numbers mean**:
  - fps is the median of a world's views and walks;
  - the 1 % low is 1000 / the 99th-percentile frame, over all the world's frames;
  - frames under 60 is the share of frames over 16.7 ms;
  - load is from the navigation to the first frame (web) or from launch to "world settled" (Unity, unity.log);
  - memory is the peak during the warm run: the processes' PSS (gamescope left out), and VRAM + GTT over what was in
    use before the launch.

| world | fps, web → Unity (worst view) | 1 % low | p95 / p99 ms | frames under 60 % | over 50 ms (longest ms) | load cold / warm s | PSS / GPU MB |
|---|---|---|---|---|---|---|---|
| Desert | 52.1 (47.1) → **77.6** (69.9) | 29.9 → 51.3 | 22.3 / 33.4 → 16.3 / 19.5 | 58.1 → 3.8 | 9 (77.9) → 4 (116.6) | 61.6 / 46.4 → 22.1 / 13.8 | 1317 / 672 → 1805 / 537 |
| Vael | 63 (57.1) → **82.5** (76.5) | 44.6 → 55.9 | 22.3 / 22.4 → 15.8 / 17.9 | 44.7 → 2.2 | 0 (33.4) → 0 (22.6) | 63.8 / 57.1 → 18.7 / 14.4 | 1337 / 809 → 1668 / 486 |
| Lorn | 63.3 (57.5) → **72** (70.9) | 44.8 → 57.5 | 22.3 / 22.3 → 15.7 / 17.4 | 36.8 → 1.9 | 0 (44.4) → 0 (44.3) | 73.9 / 61.7 → 12.5 / 14.6 | 1261 / 729 → 1630 / 510 |
| Viridel | 78.7 (63.2) → **101.9** (97.8) | 44.8 → 72.3 | 22.3 / 22.3 → 12 / 13.8 | 17.3 → 0.1 | 0 (22.6) → 0 (31.4) | 56.4 / 50 → 10.1 / 12.1 | 976 / 557 → 1417 / 447 |
| Underwater City | 73.2 (64.1) → **84.4** (79.4) | 44.6 → 55.9 | 22.3 / 22.4 → 15.1 / 17.9 | 23.8 → 2 | 2 (188.9) → 0 (22.7) | 55.4 / 44.2 → 9.9 / 9.6 | 1097 / 595 → 1294 / 465 |
| City-Shaft | 54 (50.1) → **66** (61.4) | 44.4 → 47.2 | 22.3 / 22.5 → 18.8 / 21.2 | 65.5 → 16.7 | 1 (77.7) → 2 (71.3) | 60.5 / 53.8 → 23.1 / 24.2 | 1453 / 726 → 1797 / 533 |
| Glass Dunes | 88.7 (78) → **102.9** (87.3) | 44.8 → 70.4 | 11.2 / 22.3 → 12.4 / 14.2 | 3.3 → 0.1 | 0 (33.3) → 1 (1231.5) | 54.9 / 43.7 → 9.9 / 10.2 | 1006 / 548 → 1275 / 425 |
| Buried Machine | 85.7 (79.9) → **93.6** (88.7) | 44.8 → 66.3 | 22.2 / 22.3 → 12.9 / 15.1 | 6.6 → 0.4 | 0 (22.8) → 0 (22.6) | 61.9 / 51.2 → 13.0 / 13.8 | 1076 / 655 → 1464 / 463 |
| Moon Foundry | 87.3 (83.7) → **105.1** (101.6) | 44.8 → 70.5 | 11.2 / 22.3 → 12.2 / 14.2 | 3.9 → 0.2 | 0 (33.3) → 0 (20.9) | 62.1 / 53.6 → 10.0 / 9.6 | 1023 / 578 → 1254 / 453 |
| Garden of Spheres | 88.8 (82) → **92.1** (90.1) | 44.8 → 69.1 | 11.2 / 22.3 → 12.8 / 14.5 | 3.2 → 0.3 | 0 (23.1) → 0 (22.7) | 67.1 / 64.5 → 10.5 / 12.1 | 1105 / 640 → 1393 / 456 |
| City Floating in Space | 74.4 (69.2) → **97.4** (91.4) | 44.8 → 67.5 | 22.3 / 22.3 → 12.7 / 14.8 | 21 → 0.4 | 2 (200.2) → 1 (82.3) | 51.9 / 46.5 → 10.6 / 13.1 | 1103 / 623 → 1368 / 470 |
| Signal Market | 72.7 (61.8) → **91.7** (82.3) | 44.6 → 60 | 22.3 / 22.4 → 14 / 16.7 | 29.1 → 1 | 2 (77.8) → 2 (92.2) | 55.9 / 49.7 → 15.6 / 11.1 | 1075 / 587 → 1482 / 454 |
| Home | 90 (89.8) → **107.6** (104.5) | 88.5 → 71.2 | 11.2 / 11.3 → 11.9 / 14.1 | 0.1 → 0.3 | 0 (24.2) → 0 (18.2) | 37 / 18.2 → 13.8 / 8.8 | 870 / 492 → 1092 / 407 |

**What it says.**
- **Unity is ahead in every world**: its median fps is higher in all 13, by 3-26 fps; its worst view is higher in all
  13; and its share of frames under 60 is lower everywhere but Home (0.3 % against 0.1 %).
  - The City-Shaft is Unity's weakest world: 66 fps, 16.7 % of frames under 60, the wide view 61. Its frame is
    balanced there: script 12-13.5 ms, main thread 14-16, GPU 12-16 (most of the GPU is the shaft's geometry,
    round 7).
  - Next weakest are Lorn (72) and the desert (78). Everywhere else Unity is at 82-108.
  - The web's 1 % lows sit at 44.8 (22.3 ms). That is vsync halving its missed frames to 45, so its lows read lower
    than the time it actually missed.
- **The one place the web reads better: frame pacing at the top.** Where the web holds the 90 Hz refresh, Unity's
  slowest 5 % of frames are 12-14 ms (70-80 fps) against the web's 11.2: Home, the Glass Dunes, the Moon Foundry and
  the Garden of Spheres (Home's 1 % low 71 against 88).
  - This is the uncapped player's spread, not a slow world: those worlds run at 92-108 fps.
  - Neither engine misses 60 there.
  - With vsync at 90 the player would miss a refresh on a few frames in a hundred where the web misses none.
  - **Not fixed here.** It needs gamescope to hold the player to 90 (round 6: at 90 Hz `-vsync 1` it does not), or
    a frame-rate cap in the player measured against vsync.
- **Stalls.** Frames over 50 ms in the measured views and walks:
  - the web had 16: nine on the desert's walks (55-78 ms), and a 189 ms and a 200 ms frame in the Underwater City and the
    City Floating in Space;
  - the player had 10, most on the walks (the desert 117 ms, the Market 92, the City Floating in Space 82, the
    City-Shaft 71), plus **one 1.23 s frame** in the Glass Dunes (its frozen view, second pass).
  - That frame is `PreLateUpdate.EndGraphicsJobsAfterScriptUpdate` 1 228 ms in unity.log's slow-frame line, with no
    script time and the GPU idle: the main thread waiting on the render thread.
  - The same ~1.2 s wait shows **once in 6 of the 13 warm launches** (the Desert, Vael, Lorn, the Buried Machine, the
    Glass Dunes, Home). It comes at 17-106 s, mostly between the measured views, so it is missing from the table.
    A third Glass Dunes launch on the same caches had none: no frame over 30 ms, the frozen view at 108 fps.
  - **The likely cause** is a Vulkan pipeline made the first time a variant is drawn: the cold run filled the caches
    from the start view only, and one pipeline of the Surface shader's size takes about this long on RADV (the cold
    loads' first draw is a 4-9 s stall of the same kind). Mesa keeps it on disk, so a player would pay each variant
    once.
  - **Not fixed here.** BridgePrewarm does nothing on Vulkan (round 6). The lever is Unity 6's
    GraphicsStateCollection, or prewarming every variant a world uses at its load.
- **Loads.**
  - The player loads a world in **10-24 s cold and 9-24 s warm**. The cold first-draw stall is 4-9 s, then gone on
    warm.
  - The web takes **52-74 s cold and 18-65 s warm** on the Deck. Most of that is "mixing the inks… / surfaces": the
    shader warm-up, one program at a time on ANGLE-GL (`oneAtATime`), and it has not gone with the caches warm.
  - The City-Shaft is the player's slowest load (23-24 s): its collision and BVH are built on the script's thread
    (as on the Xbox, "Cold and warm loads, Mac and Xbox").
- **Memory.** The player uses **200-490 MB more** of the processes' memory (PSS 1.1-1.8 GB against 0.9-1.45 GB) and
  **85-320 MB less** of the GPU's (VRAM + GTT 0.4-0.54 GB against 0.49-0.81 GB). Together that is 30-260 MB more than
  the web: on a 16 GB Deck it limits nothing.
- **A crash at launch**: 1 of the 31 player launches of this session (the desert's first warm launch) died with SIGSEGV right
  after `InitializeOrResetSwapChain`, before the script started. The retry, and the 29 launches after it, started
  normally. D9's watchdog falls back to the web on such a launch. Worth catching, with symbols, if it happens again.

**Verdict for D18**: Unity is at or above the web in every world on fps, worst view, frames under 60 and loads. Two
things are left open, neither a blocker for the switch:
- the uncapped player's spread above 80 fps (above);
- the one-off ~1.2 s first-use pipeline stalls (above).

## The Steam Deck, round 13: the Unity player held to 90 Hz (issue #111, 2026-10-15)

Round 12's first open point. Where the web holds the OLED's 90 Hz (p95 11.2 ms), the uncapped player ran at 92-108 fps
with its frames 9-14 ms apart.

**How it was measured.** The same rig as round 12 (`deck-engines.mjs --engines unity --loads warm`, the Steam Deck
preset, 90 Hz, warm caches), with a Linux player built from origin/main f7024ce5 plus this change
(`BridgeBuild.Linux` on the Mac). Three ways were measured, world by world, in the same session:
- uncapped (`-vsync 0`), run twice;
- held to the refresh by Unity's frame limiter (`Application.targetFrameRate` 90);
- vsync (`-vsync 1`), with and without the near shadow map drawn every frame (2048², `-shadow-near-every 1`).

fps is the median of the views and walks (in brackets the worst one). p95 and the 1 % low are the script thread's
frame intervals.

| world | uncapped (two runs) | `targetFrameRate` 90 | **vsync** (kept) |
|---|---|---|---|
| Home | 107.1 / 107.0 (p95 12.0) | 89.1 (87.5), p95 13.9, 1 % low 64.5 | **90.0** (90.0), p95 13.6 |
| Glass Dunes | 103.1 / 104.8 | 89.5 (89.0) | **90.0** (90.0) |
| Moon Foundry | 105.3 / 104.7 | 89.2 (89.1) | **90.0** (90.0) |
| Garden of Spheres | 92.2 / 91.0 | 89.2 (88.5) | **89.6** (88.0) |
| Desert | 78.0 / 78.6, 4.0 % under 60 | 76.0, 4.4 % | **76.1** (70.3), 4.6 % |

- **vsync works under gamescope at 90 Hz now.** Round 6 found it did not hold the player. Here every view of Home,
  the Glass Dunes and the Moon Foundry ran at 90.0: a new frame at every refresh. The thread intervals still spread to
  12-14 ms at p95, because they are the CPU side's, and Unity's two queued frames absorb them (a missed refresh would
  take the view under 90). Frame times on the screen itself can't be read in the headless backend; the fps can.
- **The frame limiter is worse**: 89.1-89.5 rather than 90, and Home's 1 % low fell to 64.5. Unity's limiter sleeps
  to its target and drifts against the display's refresh.
- **The cost where Unity is under 90**: the Desert 78.3 → 76.1 with vsync, and the same with the limiter.
  - With a frame cap the GPU's clocks drop: its time a frame went from 8.1 to 9.4-10 ms in the capped worlds (on
    the main thread's 5 s windows).
  - In the Desert a frame that misses a refresh waits for the next one.
  - That is 2-3 %, against a frame at every refresh where the world can hold 90.
- **The near shadow map every frame at 2048**: Home's 1 % low 74.6 against 68.9, but the Garden of Spheres 87.8 and
  the Desert 74.8. Not kept.
- **Kept: vsync on by default on the Linux player** (`BridgeRunner`, `QualitySettings.vSyncCount = 1` as on the Xbox;
  `-vsync 0` uncapped). `deck-unity.sh` passes `-vsync 0` unless `VSYNC=1` or `-hz Nv`, so its numbers stay
  comparable with the rounds before.

**Round 12's second open point, the ~1.2 s first-use stall: written up, not fixed.**
- **What it is.** The main thread waits ~1.2 s on the render thread (`PreLateUpdate.EndGraphicsJobsAfterScriptUpdate`),
  once, mid-session, the first time a (layout, material variant) pair is drawn on a Deck whose Mesa cache has never
  seen it. A third launch on the same caches had none.
- **Why the existing prewarm can't help.** BridgePrewarm draws the pairs the last launch saw (`prewarm.txt`, saved once
  the world has settled, the last world only). Those are the pairs Mesa's disk cache already holds, so on Vulkan it
  buys nothing (round 6).
- **What would help:**
  - a list of every pair the worlds use, gathered by a bench pass over every world and view (BridgePrewarm's
    `Note`, saved again at exit and merged), shipped in StreamingAssets with the player, and drawn during the load of
    the first launch of each player build;
  - or Unity 6's GraphicsStateCollection, recorded the same way and warmed at the load.
- **What it would cost.** Either is a few seconds once per build, in place of a 1.2 s stall per new variant in play.
  The size of the list, how long its warm-up takes on the Deck, and whether the specs stay stable between builds all
  need a session of their own. Not done in this round.

## The Steam Deck, round 14: the first-use stall gone, a shipped pipeline list (issue #111, 2026-10-16)

Round 13's open point. The first time a shader variant is drawn on a Deck whose Mesa cache has never seen it, the main
thread waits on the render thread while RADV makes the pipeline. BridgePrewarm's list was the last launch's only, so it
could not help.

**What was built** (BridgePso; how to refresh it: docs/steam-deck.md, "The pipeline list").
- **The list.** A Unity 6 GraphicsStateCollection, traced on the Deck by a development player (`-pso-trace`) over
  every bench world: 16 worlds, their views and walks, their first temple's first room, the ship's rooms, and a fight
  with the guardian woken. It ships as `StreamingAssets/hiraeth-pso/Vulkan.graphicsstate`: 125 states of 44 variants,
  0.5 MB of JSON.
  - 82 of the 125 states are the Surface shader's.
  - It converged fast: the first world gave 38 states, the views of all 16 gave 113, and temples, ship and fights 12 more.
  - The last six worlds added 0-2 states each.
  - `scripts/bench/deck-pso-trace.mjs` traces it again.
- **The warm-up.** `WarmUp` on the job system's workers, once the script's engine is made.
  - The main thread's next frame waits for the whole warm-up on the Deck. Unity's jobs do not keep it drawing.
  - Warmed first thing at the start (`-pso-at start`, how it was first measured), the engine was made only after the
    warm-up. Nothing was drawn until ~14 s.
  - Warmed after the engine, the loading screen is up at ~3 s, then holds still for the warm-up. The first frame of the
    world comes at the same time either way (the Glass Dunes 20.5 s against 19.8, the desert 23.4 against 23.3).
  - On an empty Mesa cache it takes 12.7-13.7 s; on a warm one, 1.0-1.1 s.
  - The drawn prewarm is left out when the list warms (as on the Xbox).
- A list traced on another platform is left: the APK is Vulkan too, but its layouts are its own.
- `-pso-file <path>` warms another list without a build. `-no-pso` is the before.

**How it was measured.** A release Linux player of this branch on the Deck OLED: gamescope headless, 1280 × 800,
90 Hz, the Steam Deck preset, uncapped, muted. Every world got two launches, each condition in a profile of its own:
- **cold**: the bench's own Mesa cache, TMPDIR (Unity's pipeline cache) and config made empty first;
- **warm**: the same caches again.

Each launch ran every view once and the walk, with `-slow-ms 50`. The before is the same player with `-no-pso`, as
the game was until now.

- **First frame** is the launch to the world's first frame (unity.log's first node plus its frame 1).
- **Longest load frame** is the longest frame from the first node to the world settling.
- **Stalls** are the frames over 50 ms after the world settled where the main thread was not waiting on the script.
  These are the render thread's: pipelines. The script's own frames over 50 ms (100-200 ms, at the bench's view
  changes) were 3-11 a world, the same in both.

The after is the final player with the 125-state list. Home's after is from the same code warmed at the start, with
113 states (the Deck left the network before Home's final launches).

| world | cold: first frame s | cold: longest load frame | cold: stalls (longest) | warm: first frame s | warm: stalls |
|---|---|---|---|---|---|
| Desert | 22.3 → 23.7 | 9 010 → 60 ms | 1 (1 208 ms) → **0** | 14.8 → **13.2** | 0 → 0 |
| Vael | 19.6 → 24.1 | 6 065 → 90 | 1 (1 166) → **0** | 17.2 → **12.9** | 0 → 0 |
| Lorn | 19.3 → 23.2 | 6 692 → 79 | 1 (1 155) → **0** | 14.1 → **12.4** | 0 → 0 |
| Viridel | 15.8 → 21.5 | 5 721 → 93 | 1 (1 878) → **0** | 10.4 → **9.8** | 1 (51) → 0 |
| Underwater City | 18.7 → 21.2 | 8 697 → 27 | 0 → 0 | 11.5 → **9.6** | 0 → 0 |
| City-Shaft | 23.8 → 27.7 | 7 088 → 50 | 0 → 0 | 18.1 → **16.7** | 0 → 0 |
| Glass Dunes | 16.8 → 21.0 | 7 015 → 36 | 0 → 0 | 11.5 → **9.5** | 0 → 0 |
| Buried Machine | 18.0 → 24.5 | 4 743 → 78 | 0 → 0 | 14.7 → **12.8** | 0 → 0 |
| Moon Foundry | 15.8 → 20.8 | 5 860 → 31 | 1 (1 095) → **0** | 13.9 → **9.7** | 0 → 0 |
| Garden of Spheres | 19.8 → 21.4 | 9 173 → 85 | 0 → 0 | 13.9 → **10.4** | 0 → 0 |
| City Floating in Space | 14.4 → 21.9 | 3 819 → 33 | 0 → 0 | 14.5 → **10.5** | 0 → 0 |
| Signal Market | 15.9 → 21.8 | 5 189 → 81 | 0 → 0 | 12.1 → **10.3** | 0 → 0 |
| Home | 14.3 → 18.0 | 6 038 → 72 | 1 (1 007) → **0** | 8.2 → **8.0** | 0 → 0 |

**What it says.**
- **The first-use stall is gone.**
  - Before, on a cold cache, 6 of the 13 worlds froze once mid-play, for 1.0-1.9 s: round 12's stall, now caught on
    the measured views.
  - After, no world had a render-side frame over 50 ms, cold or warm.
  - The cold load's frozen first frame, 3.8-9.2 s, is gone too: the longest frame of the load is now 27-93 ms.
- **What it costs: once, 1.4-7.5 s more to the first frame on an empty cache.** The 12.7-13.7 s warm-up is done for
  all 16 worlds' pipelines; one world needs about 22 of them. The loading screen holds still meanwhile, where it
  froze for 4-9 s at the end before.
- **Warm launches are faster in every world**, by 0.2-4.3 s to the first frame (the Moon Foundry 13.9 → 9.7 s, Vael
  17.2 → 12.9). The warm-up hits Mesa's cache in ~1 s, and BridgePrewarm's drawn triangles, which it replaces, cost
  more.
- **The list stays good between builds.**
  - A player whose Surface shader was changed still warmed all 113 states of the first list. Its cold first frames were
    14 ms (the Glass Dunes and the desert), with no stalls.
  - Unity matches by names, GUIDs, keywords and state hashes, not by the compiled code
    (`tests/unity-pso.test.js` checks the names, GUIDs and keywords against the project).
  - A list without the Surface shader's lean variants brought a 1.75 s first frame back. That shows the matching works,
    and also what a stale list costs.
  - Unity's own miss tracing (`WarmUp(…, traceCacheMisses: true)`) recorded nothing in a release player, so it is not
    used.
- Left: the warm-up holds the main thread on the Deck, so the cold launch's loading screen stands still for ~13 s. If
  that matters, it could be warmed per world (its ~22 states) or progressively (`WarmUpProgressively`, a few a frame).
  Not tried.

### Unity on the Retroid, round 8: spatial upscalers, FSR 1 against Snapdragon GSR 1 (issue #392, 2026-10-16)

The same device, preset and bench as round 7 (Handheld, 1280 × 960, muted, the frame readout on; warm launches, views
only, conditions interleaved world by world; nothing else running but the player's app, cached). The APK is this branch's
release build (2491). GeckoView ran after it in the same sitting (this branch's `dist`, Handheld held at 0.75).

**What was there before.** The bridge's camera has no post-processing, so URP's final blit was always **bilinear**,
whatever its upscaling filter said. That includes the Xbox's 4K "FSR" default. URP's FSR never ran in this game.

**What was added** (none of it is a default): `-upscale fsr|sgsr|linear|off` replaces URP's final blit with our own
pass (HiraethFeature.UpscalePass, `Hidden/Hiraeth/Upscale`). FSR 1 runs EASU then RCAS (`-sharpness`, 0.92 by
default). Snapdragon GSR 1 is one pass, its source under its BSD-3 notice. The HUD's canvases are drawn after the
upscale, at the screen's size. `-ink-full` is the other placement (a): the G-buffer, its light and the glow at the
render scale, and the ink composite and everything after it at the screen's.

**The six worlds at 0.75** (median of the views' fps, the worst view, the 1 % low, the GPU's ms):

| world (views) | off (bilinear) | FSR 1 | SGSR 1 | GeckoView: fps, worst, 1 % low |
|---|---|---|---|---|
| City-Shaft (4) | 51.6, 37.6, 38.7, 18.9 | 49.9, 36.8, 33.9, 19.6 | 51.1, 37.4, 35.6, 19.1 | 50.7, 37.0, 25.4 |
| Signal Market (4) | 58.6, 53.9, 45.4, 16.9 | 56.6, 52.2, 50.2, 17.5 | 58.1, 53.6, 51.1, 17.0 | 59.3, 58.6, 30.0 |
| Lorn (4) | 55.4, 46.8, 45.0, 16.3 | 54.7, 45.6, 46.4, 17.0 | 55.3, 46.6, 46.2, 16.5 | 58.8, 57.3, 35.0 |
| Underwater (4) | 56.6, 49.8, 43.9, 17.5 | 54.8, 48.4, 46.4, 18.1 | 56.2, 49.4, 47.7, 17.6 | 59.0, 58.7, 30.0 |
| Floating city (4) | 59.1, 53.6, 53.9, 16.6 | 57.7, 51.9, 45.4, 17.3 | 58.8, 53.2, 53.4, 16.7 | 59.0, 58.5, 30.0 |
| Desert (5) | 60.1, 54.4, 53.0, 14.2 | 60.1, 52.8, 53.2, 14.1 | 60.1, 54.2, 51.3, 14.7 | 56.7, 54.0, 30.0 |

- **What each upscaler costs at 0.75 → 1280 × 960:** FSR 1 adds **0.5-0.7 ms** of GPU (two full-screen passes) and
  1-2 fps in a view under 60. SGSR 1 adds **0.1-0.2 ms**, within the noise in fps.
- **What they buy is a lower render scale at a similar picture.** SGSR 1 is the cheaper of the two, so it was measured
  again at 0.67 (857 × 643), with plain bilinear at 0.67 beside it:

| world (views) | SGSR 1 at 0.67 | off at 0.67 | worst view against GeckoView's (SGSR 0.67) |
|---|---|---|---|
| City-Shaft (4) | 53.9, 39.6, 42.5, 17.7 | 53.9, 39.7, 41.9, 17.6 | +2.6 |
| Signal Market (4) | 60.1, 60.0, 53.7, 15.1 | 60.1, 60.1, 54.0, 15.0 | +1.4 |
| Lorn (4) | 58.4, 51.8, 48.3, 14.5 | 58.6, 52.1, 46.8, 14.4 | −5.5 |
| Underwater (4) | 60.0, 56.1, 52.9, 15.6 | 60.0, 56.5, 51.3, 15.6 | −2.6 |
| Floating city (4) | 60.1, 58.6, 53.8, 15.2 | 60.1, 58.8, 53.5, 15.0 | +0.1 |
| Desert (5) | 60.1, 59.9, 51.7, 13.3 | 60.1, 60.1, 51.4, 13.1 | +5.9 |

- 0.75 → 0.67 takes **1.1-1.9 ms** of GPU off every world. That closes the gap behind GeckoView everywhere but Lorn
  (−5.5 in its worst view, the start, against −10.5 at 0.75) and Underwater (−2.6, against −8.9). Unity's 1 % lows stay
  well above GeckoView's (42-54 against 25-35).
- Unity's own medians today are under round 7's at the same settings in the City-Shaft (51.6 against 57.5) and Lorn
  (55.4 against 60.1), and level elsewhere (main moved on, and the device was warm). GeckoView's are within 1.7 fps of
  round 7's.
- **Placement (a), `-ink-full`, costs more than it saves:** City-Shaft 46.0, 34.9, 36.4, **21.3 ms** and the Floating
  city 52.2, 47.6, 37.9, **19.1 ms**. That is 2.4-2.5 ms over the whole picture at 0.75, because the ink composite, the
  AA and the transparent passes stay at full size. Its wisps, motes, veil and pit shaders don't follow its scale
  either. **Placement (b)** (the whole picture at the render scale, then the upscaler) is the one measured above.

**The pictures** (the Retroid's own screen, adb screencap mid-view; contact sheets with 200 % crops of the busiest
ink, and an 8 s screenrecord of a slow pan (`-pan 700 -pan-live -pan-step 0.05`) for shimmer, in
`.local-tools/handoff/upscale-392/sheets/`). They are for the author to judge. From the crops: FSR's lines are the
crispest, with RCAS bringing out the paper's grain in flat skies. SGSR's ink lines come out **stair-stepped and
stippled** along diagonals (Lorn's crystals, the City-Shaft's floor grid), softer than bilinear in places. That may be
SGSR 1's own look on thin dark lines, or a fault in this port (its gathers were checked against the original's
coordinates, but no reference picture). At 0.67 it is the same, a little blockier.

**The author's pick: FSR 1 at 0.67, the Retroid's default** (BridgeRunner.HandheldScale 0.67, HandheldUpscale "fsr"
on a screen up to 1280 × 960, HandheldSharpness 0.6; `-upscale off` and `-render-scale` still override). The same
sitting's FSR at 0.67, first at URP's 0.92 sharpness and then as shipped (build 2503, no arguments: the log says
"upscale Fsr 857x643 -> 1280x960, RCAS sharpness 0.6"):

| world (views) | 0.75 bilinear (the old default) | FSR 1 at 0.67, RCAS 0.92 | FSR 1 at 0.67, RCAS 0.6 (default) | off at 0.67 |
|---|---|---|---|---|
| City-Shaft (4) | 51.6, 37.6, 38.7, 18.9 | 53.4, 38.8, 40.2, 18.3 | 53.4, 38.8, 40.3, 18.1 | 53.9, 39.7, 41.9, 17.6 |
| Signal Market (4) | 58.6, 53.9, 45.4, 16.9 | 60.1, 58.8, 52.2, 15.6 | 60.1, 59.1, 52.7, 15.6 | 60.1, 60.1, 54.0, 15.0 |
| Lorn (4) | 55.4, 46.8, 45.0, 16.3 | 57.6, 50.6, 49.5, 15.0 | 57.7, 50.7, 46.6, 14.9 | 58.6, 52.1, 46.8, 14.4 |
| Underwater (4) | 56.6, 49.8, 43.9, 17.5 | 59.9, 54.7, 51.8, 16.1 | 60.0, 54.7, 52.2, 16.0 | 60.0, 56.5, 51.3, 15.6 |
| Floating city (4) | 59.1, 53.6, 53.9, 16.6 | 60.1, 56.9, 52.9, 15.6 | 60.1, 57.3, 52.6, 15.6 | 60.1, 58.8, 53.5, 15.0 |
| Desert (5) | 60.1, 54.4, 53.0, 14.2 | 60.1, 58.1, 52.1, 13.6 | 60.1, 59.1, 52.1, 13.7 | 60.1, 60.1, 51.4, 13.1 |

- Against the old default every world's worst view is **1.2-5.2 fps higher** and the 1 % lows hold or rise (40-53
  against 39-54; the desert's and the Floating city's about 1 fps lower, within the noise). FSR costs 0.5-0.7 ms over bilinear at 0.67. GeckoView's worst views (37.0 / 58.6 / 57.3 / 58.7 /
  58.5 / 54.0) are now behind it in the City-Shaft, the Signal Market and the desert, about level in the Floating city,
  and ahead in Lorn (−6.6) and Underwater (−4.0).
- **RCAS at 0.6, not URP's 0.92.** At 0.92 the paper's specks in flat skies come out as dark dots, much stronger than
  the web draws them. At 0.6 they are as light as bilinear's while the ink lines stay as crisp (desert spawn's sky and
  the City-Shaft's floor grid, 0.92 / 0.6 / 0.3, `sheets/sharpness/`). It costs the same.

**SGSR 1 fixed.** The stippled, stair-stepped lines were not a port fault. A line-for-line CPU run of Qualcomm's
`sgsr1_mobile.h` (`sgsr-ref.mjs`, float and fp16, on a 960 × 720 frame from the device) gives the **same dashes** as the
device. They come from its default configuration: twice the filtered luma, clamped to the nearest four texels, snaps a
one-texel ink line to those texels one output pixel at a time. Qualcomm's optional `UseEdgeDirection` stretches the
kernel along the edge: in the CPU run and on the device the lines stay whole. It is now on (SGSR1.hlsl), at no
measurable cost (SGSR at 0.67: 13.1-17.8 ms, the same as before within 0.1). Its column in the sheets (`sheets/s2/`) is
re-shot. It is softer than FSR and has no RCAS, so FSR stays the default.

**The AYN Thor** (1920 × 1080, Handheld at 0.5 since #395; the City-Shaft and the desert, the same build):

| world (views) | bilinear (default) | FSR 1, RCAS 0.6 | SGSR 1 (edge direction) |
|---|---|---|---|
| City-Shaft (4) | 51.9, 37.1, 34.0, 17.2 | 49.7, 35.9, 34.7, 18.1 | 51.4, 36.7, 34.2, 17.3 |
| Desert (5) | 59.5, 56.0, 49.2, 13.3 | 59.5, 52.3, 48.3, 13.4 | 59.5, 55.2, 46.0, 13.5 |

- FSR's two passes at 1080p cost ~0.9 ms and **2-4 fps in the views under 60** (the desert's spawn 55 → 52, the camps
  57 → 53), so the Thor keeps the bilinear blit (HandheldUpscale gives it none). SGSR costs 0.1-0.2 ms and under 1 fps
  there. It is the candidate for the Thor if the author likes its look.

To repeat (scripts in `.local-tools/handoff/upscale-392/`): `ab.mjs <tag> --worlds … --conds "off=|fsr=-upscale
fsr|sgsr=-upscale sgsr"`, `table.mjs <tag> off,fsr,sgsr <gecko raw dir>`, `caps.mjs`/`sheet.mjs` for the pictures;
GeckoView with `ANDROID_SERIAL=ea2c972a node scripts/bench/android-worlds.mjs --serve <dist> --modes fixed --scale
0.75` (the serial is needed when another device is on adb).

### Unity on the Retroid, round 9: the fixed cost, taken apart (issue #404, 2026-10-17)

The same device, preset and bench as round 8 (Handheld, FSR 1 at 0.67 of 1280 × 960, muted, the frame readout on; warm
launches; nothing else running but the player's cached app). Round 8's APK (2503, as installed) measured again first, then
development and release builds of this branch.

**No GPU capture.** Android GPU Inspector and RenderDoc both work by installing a capture app of their own on the device
and turning on Android's GPU debug layers (`settings put global enable_gpu_debug_layers` / `gpu_debug_app`), which the
device rules here forbid (only the two Hiraeth test apps, no system settings), and neither is on the Mac. Perfetto on the
Retroid has no `gpu.renderstages` or `gpu.counters` data source (it would take `debug.graphics.gpu.profiler.perfetto`, a
system property). Unity's Frame Debugger lists draws but times none. So the frame was taken apart with switches, the GPU's
time from Unity's frame timing (kgsl: 99 % busy at 680 MHz in the slow views, so the GPU is the frame) and a development
build's pass recorders (`-split`), which on a tiler time a pass's submission more than its work: the G-buffer pass reads
1-3 ms, the prepass 2-3, the ink composite 2.5-3, the glow 0.8, FSR 0.65, SMAA 0.1-0.2, the shadow maps 0.6-2.3.

**What does not scale with the pixels** (GPU ms at a render scale of 0.375, a third of the pixels of 0.67; switches on top):

| view | 0.375 | the GPU instances hidden | the plain meshes hidden | no shadow maps | no prepass | the skinned people hidden | grass, crowd, puffs, motes hidden | everything hidden, no shadows |
|---|---|---|---|---|---|---|---|---|
| City-Shaft, start | 15.6 | 11.6 | 12.2 | 13.6 | 14.5 | 15.0 | 15.1 | 2.4 |
| City-Shaft, wide | 18.3 | 13.1 | 12.3 | 15.1 | 20.8 | 20.5 | 17.6 | 2.2 |
| Lorn, start | 14.0 | 13.7 | 5.0 | 13.3 | 14.4 | 13.8 | 13.8 | 2.9 |
| Desert, spawn | 12.8 | 11.2 | 6.5 | 12.0 | 12.2 | 10.1 | 12.1 | 2.5 |

- **The empty frame is 2.2-2.9 ms** (the ink composite 0.9, FSR's two passes 0.7, the glow 0.2, the HUD, clears): the
  passes themselves are not the fixed cost. It is what is drawn: the GPU instances (4-5 ms in the City-Shaft, ~1 M
  vertices of ~2 900 instances in the view, drawn in the prepass and the G-buffer), the plain meshes (3.4-9 ms), the
  shadow maps (2-3 ms in the City-Shaft), the skinned people (2.7 ms at the desert's spawn). The City-Shaft's instances past
  300 m (a test build's cap, not kept: it changes the picture, the web draws them) are 4-5 ms of it: its start 21.5 → 16.7
  ms, its wide view 25.5 → 21.6; past 150 m 16.5 and 21.1.
- **What a draw and a vertex cost** (`-draw-tax N`, `-vert-tax K`: extra draws in the G-buffer pass with a lean material,
  each a point too small for a pixel): a draw 0.6-2 µs; a million triangles of three unshared vertices **~5 ms** (desert
  and Lorn 5.0-5.1, the City-Shaft 2-5), **the same behind the eye** (`-tax-at -40`, every triangle clipped) as in front.
- **But fewer vertices of the world's own meshes buy nothing.** The big still meshes drawn by their 128 m pieces in the view
  too (as round 4 tried, and as the web's tileScene does; `BridgeShadowChunks` with the camera's layer) took the frame's
  vertices 8.0 → 4.8 M in the City-Shaft's wide view and 4.5 → 2.1 M at Lorn's start, and the GPU went **up** (25.5 → 28.4
  and 20.6 → 23.7 ms; at 256 m pieces 26.5 and 21.0). Not kept. The vertices the Adreno skips (out of the view, in a bin
  they miss) are not where its time goes; the tax's cost is its own (a draw of 3 M unshared vertices).
- **The far meshes' cost is their pixels and what they are.** `-hide-far D` (the plain meshes past D m not drawn): the
  City-Shaft's wide view 25.4 → 25.4 / 22.5 / 19.9 ms past 600 / 300 / 150 m (the rings and terraces fill the view), Lorn's
  start 20.3 → 19.4 / 16.1 / 14.5 (the drowned forest's trunks fill its sky). Underwater, the meshes past 30 m that cast no
  shadow (`-hide-nocast`) are 2.3-3.6 ms (the dome's glass and ribs: the glass draws on the full Surface variant, ~25 000
  instructions, the lean ones being without its path).
- **Not the lever:** batched GPU skinning (the player setting `gpuSkinning: 2`, the same frames), skinning only the seen
  people (`-skin-cull`, within 0.4 ms), the engine's levels of detail (`-js-on lod`, 0.5-1.1 ms with round 5's stalls),
  merging into fewer draws (round 5).

**The prepass, a trap measured.** Leaving the meshes past 30 m out of the depth prepass (by their rendering layer) seemed to
win 2-5 ms everywhere, every view of five worlds at 60. The bench's shots showed why: a mesh that casts no shadow, or a big
one cast by its pieces, is in Unity's default rendering layer alone, so taken out of it, it was drawn by nothing at all
(Lorn's forest gone from the sky, Underwater's dome glass; 10-22 % of the pixels changed where two runs of one build change
0.1-1 %). With the far meshes put in a layer of their own instead (the same picture, 0.2-2.7 %), the gain was gone (Lorn's
start 20.5 → 21.3 ms, Underwater the same). Not kept. Instances out of the prepass (all, or past 30-100 m) cost the
City-Shaft's wide view 3-5 ms: its terraces' houses are the occluders there.

**Dynamic resolution** (#404 step 2): not on top of FSR. The City-Shaft's wide view at 0.6 / 0.55 / 0.5 makes 50 / 53 / 56
fps and its start 59-60: even at 0.5 the wide view misses 60, and `-dyn-res` (0.05 a step toward 15 ms of GPU) climbed to
0.75 at the start and settled no better than 0.67 held (41 fps wide). The fixed cost below it is the content above.

**Where it stands** (round 8's APK today, the six worlds' views: fps, the worst view, the 1 % low, the GPU's ms; medians):

| world (views) | round 8 (2503) | this branch (the same frame: only test switches added) |
|---|---|---|
| City-Shaft (4) | 53.2, 38.7, 41.4, 18.2 | 52.5, 37.9, 38.4, 18.7 |
| Signal Market (4) | 60.1, 59.1, 53.4, 15.5 | 60.1, 57.8, 53.7, 15.9 |
| Lorn (4) | 57.9, 50.9, 46.8, 14.9 | 56.2, 48.0, 43.8, 15.7 |
| Underwater (4) | 60.0, 54.7, 50.9, 16.1 | 58.5, 52.3, 46.5, 16.9 |
| Floating city (4) | 60.1, 57.5, 53.2, 15.6 | 59.0, 53.4, 53.0, 16.7 |
| Desert (5) | 60.1, 59.1, 51.4, 13.6 | 60.1, 56.9, 51.3, 13.9 |

(The second column is this branch with every new switch off, two hours later and warmer: 0.3-1.1 ms of GPU over the
first, within what a warm Retroid drifts.) The worst views stay the City-Shaft's wide view (38 fps, 25 ms) and start
(46, 21), Lorn's start and crowd (48-56), Underwater's wide view (52-55) and the Floating city's start (53-57).

**What would move them, in order of what was measured:** the City-Shaft's GPU instances (4-5 ms: levels of detail for the
terraces' houses, ~130-1 000 triangles each and ~2 900 in the view, built off the script's thread, as the web's lod.js
builds the instanced props'); Underwater's glass on a lean variant of its own (`HIRAETH_LEAN_GLASS`, as the ground's and the
water's: up to 3.6 ms, at the cost of more Surface variants for every platform); the shadow maps (2-3 ms in the
City-Shaft); then Lorn's far forest (3-5 ms of its pixels: the ink on the trunks).

New test switches (BridgeRunner, all off unless asked): `-draw-tax N`, `-vert-tax K`, `-tax-at D`, `-hide-far D`,
`-hide-big N`, `-hide-nocast`, `-hide-match s` (only meshes whose description has s; each hidden one is logged); `-census` now logs the triangles in the view by distance with the largest contributors, each mesh by its own geometry
rather than its static batch's. To repeat: the scripts in `.local-tools/handoff/gpu-404/` (`ab.mjs` as round 8's,
`sum.mjs <tag> [--split]` per view with the SetPass calls, triangles, vertices and the passes, `diff.mjs <tag> <a> <b> <out>` the shots' differing
pixels and a sheet a | b | the difference; `ANDROID_SERIAL=ea2c972a`).

### Unity on the Retroid, round 10: levels of detail for the GPU instances (issue #404, 2026-10-17)

The same device, preset and bench as round 9 (Handheld, FSR 1 at 0.67 of 1280 × 960, muted, the frame readout on; warm
launches). Round 9's lever was the City-Shaft's GPU instances. Its census (`-census`) shows what they are: not the houses
(those are merged meshes) but **the trees**, cypresses, olives and umbrella pines in 112 sets (a terrace, a kind and an
eighth of the ring each), ~2 400 of the ~2 900 instances in the start and wide views, 120-160 triangles each, most of them
250-550 m off; the rest the bells and the cabs' parts.

**What it does** (`InstLod.cs`, `InstMats` in `Wildlife.cs`): every instanced mesh of 40-4 000 triangles gets up to three
coarser levels at about 1/2, 1/4 and 1/8 of its triangles: half-edge collapses ordered by quadric error (Garland and
Heckbert, unweighted planes, the open edges held), over the positions welded, so each level is an index list over the
full mesh's own vertices and every attribute comes from it. Each level knows how far it strays from the full mesh (the
farthest a sample of either surface lies from the other: vertices, edges' middles, triangles' middles). They are made on a
worker thread the first time a set of the mesh is drawn (all of the City-Shaft's 87 in ~0.5 s after the world appears; until
then a set draws whole, as before). Each frame an instance draws on the coarsest level whose stray, times its scale,
projects to under **half a pixel** at its distance (the camera's pixels at the render scale: 618 a radian on the Retroid):
the picture does not change. The cypress's 126 triangles become 54 / 26 / 12 (stray 0.24 / 0.42 / 0.70 m: from 290 m, 520 m
and 870 m at its usual scale); the olive's and the pine's lobes are icosahedra already, their first level strays 0.76-1.1 m
and starts past 900-1 400 m (never, in the shaft). The shadow maps take the level the view gives each instance (it made no
measurable difference: 0.1 ms).

**A level is a draw.** Drawn apart, every set's levels were a draw more each in the prepass and the G-buffer (~350 more):
the start view gained 3 ms but the second crowd lost 0.7 ms (59.3 → 57.8 fps) and the wide view gained nothing. A level whose
instances save fewer triangles than `MinSave` joins the finer one (600: the crowd still lost 0.5 ms; **2 000** kept: every
view gains; 5 000 merges nearly all and the gain is gone).

| City-Shaft view | off: fps (1 % low, GPU ms) | off again | on (0.5 px, 2 000) |
|---|---|---|---|
| start | 45.2 (25.2, 21.6) | 45.3 (27.3, 21.5) | **51.3** (34.1, 18.3) |
| crowd | 60.1 (50.4, 13.2) | 60.1 (51.1, 13.4) | 60.1 (49.2, 13.3) |
| crowd2 | 59.3 (46.9, 16.0) | 59.4 (35.5, 15.9) | **60.1** (53.9, 15.4) |
| wide | 37.8 (31.9, 25.5) | 37.8 (32.5, 25.6) | 38.4 (32.1, 25.0) |

The other worlds, the same sitting (fps, worst view, 1 % low, GPU ms; medians of their views): the Signal Market 60.1, 57.9,
52.5, 15.9 against 60.1, 58.0, 54.0, 15.9 off; Lorn 56.3, 48.0, 48.1, 15.8 against 56.5, 48.5, 47.8, 15.7; Underwater 58.6,
52.4, 45.9, 16.9 against 58.4, 52.1, 48.5, 16.9; the Floating city 58.7, 53.0, 47.9, 16.9 against 58.6, 53.0, 52.0, 16.8; the
desert 59.9, 56.6, 44.8, 13.9 against 60.1, 57.1, 51.7, 13.9. No GPU time moves: their instances are few or near. The
desert's 1 % low, run twice more off / on: 49.1 / 47.3 and 47.2 / 52.1 (noise).

**The pictures** (the bench's shots, `diff.mjs`: pixels differing by more than 24): two runs of the same build differ by
0.02-3.6 % of the pixels per view, the levels on by 0.03-3.6 %, view by view within that spread (the City-Shaft's start
0.37 % against 0.02-0.36 %: the glass pillar's dots and the people, and a faint line along the far trees under the ×4
difference). Enlarged crops of the far trees in the start and wide views show no difference. At 1 px the start view is the
same (49.9 fps) and the far trees still look the same; at 2 px (51.9 fps) their ink comes out lighter, so 0.5 it is.

**Where it stands:** the City-Shaft's start view 45 → 51 fps; its wide view 38 fps stays the worst (25 ms): there the
trees are 150-450 m below the eye and their cost is their pixels, not their triangles (hiding every instance takes 5 ms;
the levels take 0.6). Unity only: the web has its own levels of detail (src/lod.js, a whole set's geometry swapped by its
distance), which the bridge leaves off (`-js-on lod`, round 9).

Switches (BridgeRunner): `-inst-lod-px P` the pixels (0: off), `-inst-lod-save N` the triangles a level must save,
`-inst-lod-shadow 0` the full mesh in the shadow maps; `-census` logs the instances drawn at each level. To repeat: round
9's scripts with `--conds "off=-inst-lod-px 0|on="`.

### Unity on the Retroid, round 11: the scrub's and the glass's lean variants (issue #404, 2026-10-17)

The same device, preset and bench as round 10 (Handheld, FSR 1 at 0.67 of 1280 × 960, muted, the frame readout on; warm
launches, conditions interleaved world by world, one APK with a switch: `off` is `-no-lean-rare`).

**What was looked at first** (round 10's build, the City-Shaft's start / wide view, GPU ms against 18.2 / 24.9): the parts of the
shader one by one (`-surface-skip`): the hatching 17.6 / 23.8, the shadow lookups 17.5 / 23.5, the patterns 18.3 / 24.8, the
shade's tone 18.1 / 24.7; the shadow maps' schedule and size: the far map every 8th frame 18.0 / 24.7, the near map at 1 024
17.7 / 24.1, the instances out of the maps 18.4 / 25.1 (and `-no-shadows` 22.1 / 27.3: the big meshes then drawn whole, not by
their pieces). Each is at most ~1.4 ms and every one would change the picture. What does not show in those: **what the
trees are drawn with.** The City-Shaft's cypresses, olives and pines are one material with the scrub's strokes (`scrub`,
`pattern: 'leaves'`), and BridgeRenderer.Lean gave any scrub material the **full Surface variant** (~25 000 instructions, round
6): each tree pixel paid for every rare path, and its prepass draw carried the glass's, the dissolve's and the veil's discard,
so the Adreno could not know its depth before the fragment ran. Underwater's dome and tube glass is the same case with
`_Glass` (round 9's 2.3-3.6 ms).

**What it does** (Surface.shader, BridgeRenderer.Lean): two lean variants with one rare path kept, `HIRAETH_LEAN_SCRUB`
(the scrub's strokes) and `HIRAETH_LEAN_GLASS` (the glass's cut), for a material whose only rare path is that one, on no
ground or water (`RareCount`, mode not 1 or 3). Everything else is the lean variant's, so the picture is the same; the
scrub's prepass has no discard at all. Like the slim variants they are in Android's Vulkan builds only (BridgeShaderStrip;
`BridgeRenderer.leanRare`), so the Deck's, the Xbox's and the editor's shader sets do not grow. Switches: `-no-lean-rare`,
`-no-lean-scrub`, `-no-lean-glass`, `-lean-rare` elsewhere (a build with `-keep-slim`).

| view | off: fps (1 % low, GPU ms) | off again | on | on again |
|---|---|---|---|---|
| City-Shaft start | 51.3 (32.7, 18.3) | 51.2 (34.9, 18.3) | **54.5** (32.0, 17.1) | 54.5 (33.1, 17.1) |
| City-Shaft crowd | 60.1 (46.6, 13.1) | 60.1 (49.7, 13.1) | 60.1 (50.5, 13.2) | 60.1 (48.2, 13.1) |
| City-Shaft crowd2 | 60.1 (55.4, 15.4) | 60.1 (53.7, 15.1) | 60.1 (56.4, 14.8) | 60.1 (55.5, 15.1) |
| City-Shaft wide | 38.5 (32.0, 24.9) | 38.5 (33.4, 24.9) | **42.5** (34.3, 22.4) | 42.5 (35.4, 22.4) |
| Underwater start | 57.8 (47.7, 17.1) | 57.8 (39.1, 17.2) | **60.0** (43.7, 16.5) | 60.0 (36.3, 16.5) |
| Underwater crowd | 58.7 (28.4, 16.8) | 58.8 (24.8, 16.8) | 59.8 (27.0, 16.4) | 59.6 (28.2, 16.4) |
| Underwater wide | 52.1 (40.9, 19.1) | 52.1 (47.6, 19.1) | **54.3** (50.1, 18.4) | 54.3 (50.7, 18.3) |

- **The City-Shaft's wide view, the worst of the six worlds, 38.5 → 42.5 fps (2.5 ms of GPU)**, its start 51 → 54.5;
  Underwater's start reaches 60 and its wide view 52 → 54. The desert (its scrub bushes are few and near the ground) is
  unchanged, 13.8-14.0 ms against 13.7-13.9; the Signal Market, Lorn and the Floating city, with neither material, within
  0.2 ms (15.8 / 15.7, 15.7 / 15.9, 16.9 / 16.9).
- **The pictures** (`diff.mjs`, pixels differing by more than 24): two runs off differ by 0.04-3.2 % per view, off against on
  by 0.05-3.7 %, view by view within that spread (the moving people, birds, motes and the pillars' dots). Enlarged crops of the
  City-Shaft's trees in the wide view and of Underwater's dome glass are the same.
- **Where it stands:** the worst views are now the City-Shaft's wide view (42.5 fps, 22.4 ms), Lorn's start (48, 20.5 ms:
  its far forest of trunks, 3-5 ms of pixels) and crowd (52), the Floating city's start (53) and Underwater's wide view (54).
  Next by what was measured: Lorn's trunks (their ink and pixels), then the hatching and the shadow lookups (~1-1.4 ms each in
  the City-Shaft, a far-pixel branch would have to leave the picture as it is).

To repeat: round 9's scripts with `--conds "off=-no-lean-rare|on="`.
## CPU per frame (#446)

**The question** (the author, 2026-10-17): the game scales badly on weak CPUs. Is too much done on the CPU, and what
takes a frame's CPU time?

**The short answer.** No single game system dominates. On the web, **three.js's render submission is the largest
part: 25–37 % of a frame's main thread** (the per-draw work for ~370–550 draws a frame, plus its walk of the
scene). The browser's own native work behind those draws is another 10–17 %. **The scene's matrices** take 11–14 %,
and **culling, levels of detail and shadow-caster prep** take 5–12 %. Every gameplay system (people, the traveller,
physics, foes, the world's animation, story, audio) is between 0 and 13 % alone, and together they make 25–35 %.
**GC is not a factor**: under 1 %. So the CPU cost grows with **how many objects and draws a frame has**. Game logic
matters less. Under Unity (the same JS under V8 on the Steam Deck) the script thread is the limit in 4 of 5
worlds: 8.6–12.4 ms of a 9.5–13.9 ms frame. About half of that is the game's update and the other half is the
bridge's mirror (matrices, scene walk, bones).

### How it was measured

- **Web.** A production build without minification and with source maps (`npx vite build --minify false
  --sourcemap`: the same code as the release, with function names and a map to each file:line). It was served on
  port 5446, and each world ran in a fresh headless muted Chrome (ANGLE on Metal: the M4 Pro's GPU, not software
  GL) at 1280 × 633. The game ran on the **Handheld preset** (scale 0.75, no dynamic resolution), at 10:00, with
  clear weather. After a 12 s warm-up, at **CPU throttle ×4 and ×6** (`Emulation.setCPUThrottlingRate`), each
  world got 10 s of V8 sampling profile (`Profiler`, 200 µs) standing still and 10 s running (W + Shift for 5 s,
  then S + Shift: 26–80 m covered). At ×4 the sampling heap profiler also ran (every allocation, including those
  a minor GC collects). The frame count and each frame's callback time came from a wrapper on
  `requestAnimationFrame`.
- **How samples are assigned.** Each stack was mapped through the source maps. A sample under three's
  `WebGLRenderer.render` went to "render": either to three itself or to the game file it calls back into
  (static-batch.js's `build`, skeleton-update.js). Any other sample went to the nearest of the game's own files up
  the stack, so three's maths called by the crowd counts as the crowd. `(program)` is native work outside JS
  (mostly the browser's GL command path behind the draws). The files were then grouped by system (the table's
  rows). Milliseconds are per frame, **at the throttle**: divide by 4 (or 6) for the Mac's real time. The profiler
  adds ~10–20 % ("profiled frame" against the plain rAF time).
- **Worlds.** The Desert (the spawn, looking at the city), the City-Shaft (start), the Signal Market (start), Lorn,
  the Underwater City, a temple fight (`?level=desert&guardianReview=keeper`: the Rose House's cistern with the
  Keeper awake, calm, not striking) and the City-Shaft's densest crowd (`crowd`, at viewpoints-worlds.json's crowd
  view: 1 529 crowd people).
- **Caveats.** The Mac's load was 16–21 throughout (other agents), so totals vary ±10 % between runs. Splits within
  one profile are more reliable than totals across runs. In the City-Shaft's runs and the crowd's run the
  traveller ran off a ledge and was **knocked down** (his ragdoll is the "physics" jump in those rows). A vite dev
  server (same worlds, ×4) was no slower than the production build (27.5 against 32.4 ms in the desert, within this
  load's noise), so dev mode's extra JS cost is not measurable here.
- Scripts and raw traces (`.cpuprofile` / `.heapprofile` per world, rate and mode, `summary.json`, `results.json`):
  the session's scratchpad, `cpu-446/` (`profile.mjs` records, `analyze.mjs` assigns and groups the samples,
  `callers.mjs` shows who calls a function, `heapleaf.mjs` shows allocations by function, `ab.mjs` gives a toggle's
  A/B under throttle, `deck/` holds the Unity runs).

### Web, ×4 throttle: ms per frame by system (share of the profiled frame), standing / running

| system | Desert | City-Shaft | Signal Market | Lorn | Underwater | temple fight | crowd |
|---|---|---|---|---|---|---|---|
| three.js render submission | 13.2 (35%) / 12.3 (31%) | 12.3 (29%) / 12.8 (28%) | 10.7 (33%) / 11.0 (31%) | 12.8 (37%) / 12.8 (36%) | 10.6 (35%) / 10.9 (31%) | 7.4 (25%) / 6.9 (24%) | 12.2 (27%) / 12.7 (25%) |
| browser native (GL calls, compositing; not JS) | 5.7 (15%) / 4.0 (10%) | 6.9 (17%) / 4.5 (10%) | 5.0 (15%) / 3.5 (10%) | 5.0 (14%) / 3.4 (10%) | 4.4 (14%) / 3.3 (9%) | 5.2 (17%) / 3.7 (13%) | 7.7 (17%) / 5.2 (10%) |
| matrices (scene list + rig walks) | 4.6 (12%) / 5.3 (14%) | 4.6 (11%) / 5.1 (11%) | 3.9 (12%) / 4.5 (12%) | 3.8 (11%) / 3.9 (11%) | 2.9 (10%) / 3.8 (11%) | 3.5 (12%) / 3.5 (12%) | 5.0 (11%) / 5.5 (11%) |
| culling, LOD, shadow-caster prep | 3.0 (8%) / 4.2 (11%) | 3.9 (9%) / 5.4 (12%) | 1.9 (6%) / 3.1 (9%) | 2.4 (7%) / 2.9 (8%) | 1.4 (5%) / 2.4 (7%) | 2.9 (10%) / 2.9 (10%) | 4.0 (9%) / 5.7 (11%) |
| still batches + skeletons inside the passes | 1.3 (3%) / 1.4 (4%) | 1.5 (4%) / 1.9 (4%) | 1.3 (4%) / 1.4 (4%) | 1.1 (3%) / 1.2 (3%) | 1.0 (3%) / 1.3 (4%) | 0.6 (2%) / 0.7 (2%) | 1.9 (4%) / 2.4 (5%) |
| main.js frame() / renderFrame() own code | 1.7 (4%) / 2.2 (6%) | 2.2 (5%) / 2.9 (6%) | 1.3 (4%) / 1.9 (5%) | 1.8 (5%) / 2.1 (6%) | 1.2 (4%) / 1.8 (5%) | 2.0 (7%) / 2.3 (8%) | 2.2 (5%) / 2.9 (6%) |
| people + crowd (pose, cloth, faces) | 1.6 (4%) / 2.5 (6%) | 3.4 (8%) / 4.5 (10%) | 3.3 (10%) / 4.5 (13%) | 1.6 (5%) / 1.9 (5%) | 1.9 (6%) / 2.8 (8%) | 1.1 (4%) / 1.2 (4%) | 4.2 (9%) / 4.9 (10%) |
| traveller (player, feet, gear, cloth) | 1.7 (4%) / 2.0 (5%) | 1.9 (4%) / 2.0 (4%) | 2.0 (6%) / 2.1 (6%) | 2.0 (6%) / 2.0 (6%) | 1.8 (6%) / 2.5 (7%) | 2.2 (7%) / 2.3 (8%) | 2.2 (5%) / 2.2 (4%) |
| physics + collision (BVH rays) | 0.6 (2%) / 0.6 (1%) | 0.8 (2%) / 1.9 (4%)* | 0.7 (2%) / 0.8 (2%) | 0.7 (2%) / 0.9 (3%) | 1.2 (4%) / 1.9 (5%) | 0.9 (3%) / 1.2 (4%) | 0.9 (2%) / 4.3 (8%)* |
| world animation (level, flames, banners, wind, water) | 2.5 (6%) / 2.8 (7%) | 2.1 (5%) / 2.2 (5%) | 0.8 (2%) / 0.9 (3%) | 1.2 (3%) / 1.3 (4%) | 2.0 (7%) / 2.5 (7%) | 1.9 (6%) / 2.1 (7%) | 1.7 (4%) / 2.2 (4%) |
| story, quests, UI, HUD | 1.0 (3%) / 1.1 (3%) | 1.0 (2%) / 1.2 (3%) | 0.9 (3%) / 0.9 (3%) | 1.3 (4%) / 1.3 (4%) | 0.9 (3%) / 1.1 (3%) | 1.1 (4%) / 1.2 (4%) | 0.9 (2%) / 1.5 (3%) |
| foes + wildlife | 0.3 / 0.4 | 0.4 / 0.4 | 0.3 / 0.4 | 0.4 / 0.6 | 0.1 / 0.2 | 0.3 / 0.2 | 0.5 / 0.4 |
| audio | 0.1 / 0.1 | 0.1 / 0.2 | 0.1 / 0.1 | 0.2 / 0.1 | 0.1 / 0.2 | 0.2 / 0.2 | 0.2 / 0.2 |
| GC (main thread) | 0.1 / 0.1 | 0.1 / 0.2 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.3 |
| **profiled frame, ms** | 38.0 / 39.6 | 41.7 / 45.8 | 32.9 / 36.0 | 34.9 / 35.2 | 30.1 / 35.6 | 30.0 / 29.0 | 44.3 / 51.1 |
| frame's rAF time without the profiler share, ms | 32.4 / 35.7 | 34.8 / 41.3 | 27.9 / 32.5 | 30.0 / 32.1 | 25.7 / 32.2 | 24.7 / 25.1 | 36.7 / 46.0 |
| fps at ×4 | 29.7 / 26.3 | 27.6 / 22.9 | 34.2 / 28.7 | 32.1 / 29.4 | 37.1 / 28.9 | 38.1 / 36.1 | 26.2 / 20.5 |
| draws a frame (all passes) | 414 / 549 | 454 / 510 | 411 / 387 | 422 / 432 | 362 / 392 | 201 / 173 | 453 / 517 |
| allocation, MB/s · kB/frame | 15.6 · 537 / 27.1 · 1 057 | 15.8 · 585 / 24.8 · 1 109 | 15.5 · 465 / 21.6 · 770 | 16.7 · 533 / 20.5 · 714 | 22.7 · 628 / 29.5 · 1 043 | 19.4 · 520 / 20.8 · 589 | 15.7 · 614 / 25.9 · 1 292 |

\* the traveller knocked down: his ragdoll's ground rays (ragdoll.js `step`, below).

At **×6** the shares stay the same within 2–3 points: three.js submission 24–38 %, matrices 11–14 %, culling prep
5–11 %, native 11–17 %. The frames take 34–65 ms (16.9–27.3 fps). Running costs more than standing in every world
except the temple, by 0.5–9 ms at ×4. The extra goes to culling and levels of detail (new tiles each frame), the
people near him (newly met people's capes baked, cape.js `bake`) and physics.

**Inside three.js's submission** (×4, the desert standing): `renderObjects` (per draw: `renderBufferDirect`,
`setProgram`, uniform uploads, `bindVertexArray`) takes 9.8–11.8 ms. `projectObject` (the walk of the scene for
each scene render: the frustum test, the screen depth for sorting, the render list) takes 4.2–5.4 ms. A frame on
Handheld renders the whole scene **twice or three times**: the G-buffer (255–260 draws, ~2 ms of the M4's
unthrottled frame), one shadow cascade (near and far take turns: 111–117 draws, 0.6 ms) and the hero map (the
traveller only). The ~5 400 visible objects of the desert are walked in each pass. Per draw that is ~27 µs at ×4
(~7 µs on the Mac's own CPU), so the draw count is what scales the CPU cost.

### Unity (the same JS under V8): Steam Deck, the bridge's Linux player

`scripts/bench/deck-unity.sh run u-5c94 <world> <views>`: the player already on the Deck (built 2026-10-14 from
5c9421355). It ran in gamescope's headless backend at 1280 × 800, uncapped (`-vsync 0`), muted, with
`-bench 6 -split -metrics`. **The per-system script time already has a switch**: `-split` makes engine/game.js lap
its update by part (`game.sections()`, `lap?.('crowd')` …) and the mirror report its own profile. It is off by
default, so no new switch was needed. ms per frame (medians of the view):

| world, view | frame | GPU | script thread | = game update | + mirror (matrices · walk · bones) | main thread waits on script | update's largest parts |
|---|---|---|---|---|---|---|---|
| Desert, spawn | 11.4 | 10.7 | 10.4 | 5.5 | 4.7 (1.4 · 2.2 · 0.5) | 6.2 | traveller 1.2, life 0.9, story 0.9, wind 0.8, people 0.7 |
| Desert, camps | 13.7 | 12.5 | 12.4 | 7.4 | 5.0 (1.5 · 2.2 · 0.5) | 8.7 | people 2.9, traveller 1.0, story 0.9, wind 0.7, life 0.6 |
| City-Shaft, start | 13.6 | 13.1 | 12.0 | 6.2 | 5.5 (1.8 · 2.6 · 0.3) | 6.1 | traveller 1.4, life 1.2, crowd 1.1, story 0.7, level 0.7 |
| City-Shaft, crowd | 13.4 | 12.3 | 12.1 | 6.8 | 5.1 (1.8 · 2.4 · 0.3) | 7.4 | people 2.1, crowd 1.1, traveller 1.1, life 0.9 |
| Signal Market, start | 10.5 | 9.9 | 9.6 | 6.1 | 3.1 (1.0 · 1.4 · 0.3) | 6.1 | people 2.4, traveller 1.2, life 0.7, story 0.6, crowd 0.6 |
| Signal Market, crowd | 9.5 | 7.8 | 8.6 | 5.1 | 3.3 (1.0 · 1.5 · 0.3) | 5.5 | people 1.8, traveller 1.1, life 0.6, crowd 0.6 |
| Lorn, start | 13.6 | 15.2 | 9.6 | 6.1 | 3.2 (0.9 · 1.6 · 0.2) | 1.1 | people 1.8, traveller 1.4, life 1.1, story 1.0 |
| Lorn, crowd | 13.9 | 13.7 | 9.3 | 5.7 | 3.4 (1.0 · 1.6 · 0.2) | 1.0 | people 1.8, traveller 1.3, life 1.1, story 0.9 |
| Underwater, start | 9.8 | 9.5 | 9.0 | 5.9 | 2.6 (0.8 · 1.2 · 0.3) | 5.7 | level 1.5, traveller 1.4, people 1.3, life 0.7 |
| Underwater, crowd | 10.9 | 10.0 | 9.9 | 7.0 | 2.6 (0.8 · 1.2 · 0.3) | 7.0 | people 2.2, level 1.9, traveller 1.2, life 0.6 |

The script thread is the limit everywhere except Lorn, where the GPU is. The game's update ("traveller", "people",
"crowd", "life", "story") is 5–7.4 ms, and the bridge's mirror is another 2.6–5.5 ms. Its scene walk and matrices
are the same work as three's walk and `updateSceneMatrices` on the web. The order matches the web's: the work that
scales with objects (matrices, walks) is as big as any gameplay system. **The Retroid** (the weakest CPU) was
offered by the coordinator but was locked behind its secure lock screen. It needs the author to unlock it, so the
same `-split` runs were not made there. To repeat them: the #404 round 11 `tools/ab.mjs` with `--conds "split=-split"`.

### Ranked: what to change, by expected gain

Gains are estimated from the profiles at ×4 (divide by 4 for the Mac's real time; a Retroid-class CPU is roughly ×4–6).

1. **Fewer draws, or cheaper ones** (three.js `renderObjects`: `renderBufferDirect`, `setProgram`, the uniform
   setters `setValueV1f`/`V3fArray`/`V4fArray`, `bindVertexArray`; three.module.js ~17270–18450). This is 25–37 %
   of the frame plus most of the 10–17 % native work. Each draw costs ~27 µs at ×4. The G-buffer pass alone has
   ~260 draws on Handheld (an earlier Deck round counted ~140 materials a pass). Cutting 100 draws from the G-buffer saves ~3 ms
   at ×4. The ways to do it: more still meshes into static-batch.js's batches (one material key each), the people's
   parts in part-batch.js, fewer distinct surface materials (materials.js `surfaceDefines`), and instancing the
   repeated props. Big work, and the largest gain.
2. **One walk of the scene a frame, not one per pass** (three's `projectObject`: 2.4 ms self on average, 4.2–5.4 ms
   inclusive). The G-buffer, the shadow cascade and the hero map each walk ~5 000 visible objects, computing each
   one's frustum test and screen depth. A list built once a frame (the visible meshes with their world spheres:
   engine/scene-matrices.js already has the flat list), with each pass culling from it, would save ~2–3 ms at ×4.
   This was already named in "The Steam Deck, round 2" ("the shadow passes culling from a list instead of walking
   the scene each time"). Medium work (a custom render list).
3. **Matrices only for what can move** (engine/scene-matrices.js `SceneList.update`, line ~86: 1.6 ms self + 0.5 in
   `updateSceneMatrices`; src/matrix-cache.js `updateMatrixWorldCached` 1.4 ms in the rigs' walks). 7 249 of the
   desert's 7 303 objects have `matrixAutoUpdate` on, so every frame each one's ten numbers are compared. Buildings,
   rocks and props never move. Keeping the still subtrees out of the per-frame list (flagged when edited) would save
   most of the 2 ms. **The Handheld preset also lacks `skipHidden`**, which the Deck has (round 11, the author
   approved it for the Deck only). An A/B on the Mac at ×4 (`ab.mjs`, Handheld ± `skipHidden` + `peopleLod`) was
   within the load's noise (+0.3 ms desert, −0.8 ms City-Shaft, ±3 ms between rounds): to be measured on the
   Retroid before it is turned on there. Medium work.
4. **The cullers and levels of detail every frame** (renderFrame's prep, 1.4–5.7 ms: static-batch.js `build` (~265,
   0.66 ms self, called per view batch per pass, a frustum and a `shownUnder` parent walk per entry) and `update`
   (~519, 0.43 ms, 16 numbers compared per still mesh); perf.js `hide` (smallCull, ~201 and ~356: 0.3 + 0.2 ms) and
   `cullFar`; shadows.js `begin`/`hide` (0.3 + 0.15 ms); lod.js). Each runs over every candidate every frame, even
   when the camera has not moved. The shadow maps already keep their culling while the view stays within
   VIEW_SLACK. The same "view moved enough?" test for the small-prop, room and LOD culls, and the still batches'
   lists kept between frames while the camera is still, would save ~1–3 ms at ×4 (more when standing). Small to
   medium work.
5. **The people** (1.1–4.9 ms; Unity "people" 0.5–2.9 ms, "crowd" 0.6–1.1 ms): animator.js `update` (~547),
   humanoid.js `update` (~1320, its walk), crowd.js `simulate` (~946), npc.js `pose`/`move`, hands.js, cape.js. On
   Handheld, people out of view are posed every frame (`peopleLod` is the Deck's only). Turning on `peopleLod` for
   Handheld (to be approved and measured on the Retroid) and posing the people past ~30 m at half rate are the
   levers. ~1–2 ms at ×4 in the Market and the City-Shaft.
6. **The ragdoll's rays** (ragdoll.js `step`, line ~166: for each of its points, each sub-step (up to 6 a frame),
   `physics.heightAbove` and `groundNormalAt`, two BVH rays). While the traveller is knocked down, physics goes
   from 0.9 to 4.3 ms at ×4 (the crowd row). One ray per point per frame, with the normal from the same hit, would
   save ~2–3 ms during a knock-down. This is per event, not steady, but it is a hitch in a fight. Small work.
7. **ShadowCuller.collect** (shadows.js ~274) runs a full `scene.traverse` and builds ~2 500–4 000 item objects
   whenever `scene.children.length` changes. Running through the Market it ran 6 times in 10 s, at 0.4–0.6 ms each on
   the M4 (2–3 ms at ×4): a hitch, not a steady cost. Collect on the scene-matrices epoch instead, or add and remove
   only the subtree that changed. Small work.
8. **Per frame, where per change would do**: the traveller's bracer strap re-wrapped and its normals recomputed every
   frame (shield.js `wrapStrap` ~394 from `attach` ~371: 0.3–0.4 ms at ×4 in every world, 23–33 kB a frame
   allocated, the shield folded or open); the desert's banners' `computeVertexNormals` (life.js `update` ~184, in
   view only); the frame's hidden list that `cullFar` and the culls fill, made anew each frame (perf.js ~134, ~20 kB a frame). Each is
   ≤ 0.4 ms at ×4, which is why they were not changed here: under this machine's load an A/B cannot resolve them.
9. **GC needs no work.** Allocation is 15–30 MB/s (0.5–1.3 MB a frame at ×4), but the main thread's GC is 0.1–0.3
   ms a frame at ×4 (under 1 %): V8's young-generation collections are cheap and mostly parallel. The largest
   allocators are three's uniform setters (boxed numbers in their caches), the newly met people's cape bakes and
   body builds (deferred work, cape.js `bake`, makehuman/people.js), wind.js `update`, the strap above and the
   shadow and prop culls' arrays.

**Not slow** (each under 2 % at ×4 in every world): audio (0.1–0.2 ms), foes and wildlife (0.1–0.6), story and
quests and HUD (0.9–1.5, mostly the ship's and the temples' per-frame checks), the camera (0.03). The JSON, string
and timer culprits the brief listed did not show up in any profile.

**Nothing was changed in the code for #446.** Each fix that is small and safe saves under ~0.4 ms at ×4, which is
under this Mac's run-to-run noise (load 16–21). The larger ones (1–4 above) change how the frame is drawn and want
their own issue with a device to measure on: the Retroid when it is unlocked, or the Deck.

## CPU round 1 (#448)

The fixes ranked 2–4 and 7–8 in "CPU per frame (#446)" above, each tried and measured. One of them pays and is in:
**one walk of the scene a frame** (`src/flat-pass.js`). The others were measured and left out, for the reasons below.

### One walk of the scene a frame (src/flat-pass.js)

`renderer.render(scene, camera)` walks the whole scene for each pass (three's `projectObject`). A Handheld frame has
two or three such passes (a shadow cascade, the G-buffer; the hero map draws its own little scene). Now each pass of
`renderFrame` hands three a stand-in for the scene (`Object.create(scene)`: the scene's background, override material
and hooks are the scene's) whose children are what of the scene's flat list (engine/scene-matrices.js, made for the
frame's matrices) could be drawn in that pass, in the walk's order:

- a hidden container steps over its subtree, as the walk does; a container with nothing drawable under it (a rig's
  bones: 1 260 of the desert's 7 303 objects) is stepped over without a look;
- a mesh is handed over only if it is shown, its layers meet the camera's, and its world sphere (three's own: the
  object's or its geometry's, carried into the world once a frame, when first reached) is not certainly outside the
  frustum. A margin (1 mm, and as much again per km) leaves anything near a plane to three, which tests again what it
  is handed: the pass draws exactly what the walk drew;
- a mesh cut into tiles (perf.js `tileSceneSteps`: the source draws nothing, its tiles are its children) is not handed
  over; its tiles are, one by one. Its own draw was an empty one (a draw range of 0). Otherwise a mesh with children,
  an unculled one, one with a hook of its own, a line, a sprite or a group with a render order is handed over whole,
  and three walks it as ever;
- a frame whose list is stale (the scene edited since its matrices: `sceneList()` null) walks as before.

What is read once a frame is what nothing changes between a frame's passes: the world matrices are made before them,
and a level of detail swapped in for a shadow pass carries its source's bounds (lod.js `unpack`). A first version that
read every mesh's flags each frame, hidden or not, and took the tiles' children off them for the pass, was no faster
than the walk: the cost is in touching the objects (cold cache lines, megamorphic reads), so a hidden mesh is now passed
by on its `visible` alone, as three does, and a mesh outside the frustum on the numbers kept in the pass's arrays.

**Checked.** The render lists of every pass (object, material, group order, render order, screen depth) the same as
the walk's over 12 frames, the flat pass off and on in turn, in the Desert, the City-Shaft, the Signal Market, Lorn,
the Underwater City and the Rose House's fight. The final frame's pixels read back after `renderFrame()` with the
flat pass off and on, in the same frozen frame: identical (0 pixels differ) in all seven #446 worlds on Handheld and
in the Desert on High. `tests/flat-pass.test.js` runs a copy of three's walk over the scene and the stand-in through
hides (between passes too), layers, moves, cameras, swapped geometries, a render order, instances and tiles; it fails
when the margin is made negative or a hidden mesh is left stamped. The full test suite and the sequence tests pass.
**Web only**: the Unity bridge has no three renderer, and its mirror walks the flat list already. The Unity script
bundle (`hiraeth.cjs`) is byte-for-byte the same before and after this round.

**Measured** (MacBook Pro M4 Pro, headless muted Chrome on ANGLE Metal, Handheld, 1280 × 633, 10:00, clear, standing at
each world's start; the Mac's load 20–40 from other agents). The time a frame of three's renders of the scene (the
passes' walk and their draws), the same build with the flat pass off and on in turn, six rounds of 2 s each, medians:

| world | CPU ×4: off → on, ms | gain | CPU ×1: off → on, ms | gain |
|---|---|---|---|---|
| the Desert | 13.34 → 12.05 | 1.29 | 1.85 → 1.68 | 0.17 |
| the City-Shaft | 10.81 → 10.24 | 0.57 | 2.22 → 2.02 | 0.20 |
| the Signal Market | 11.01 → 9.68 | 1.33 | 1.90 → 1.69 | 0.21 |
| Lorn | 13.27 → 11.61 | 1.66 | 2.33 → 2.11 | 0.22 |
| the Underwater City | 10.24 → 9.19 | 1.05 | 2.01 → 1.86 | 0.15 |
| the Rose House's fight | 6.88 → 5.92 | 0.96 | 1.09 → 0.99 | 0.10 |

So 0.6–1.7 ms of a ×4-throttled frame, not the 2–3 ms #446 estimated: the walk's own reads are what is left to pay,
and three's frustum test, render list and sort stay as they were for what it is handed. The #446 profiles
(`profile.mjs`, ×4, standing and running, two runs of each build interleaved) agree in the walk's share (three's
`projectObject` plus the flat pass: Desert 4.7 → 4.5 standing and 5.7 → 4.4 running, City-Shaft 4.3 → 3.5, Market
3.3 → 2.7 and 4.4 → 3.1, Underwater 3.4 → 2.3, the crowd 3.8 → 3.3 and 3.8 → 2.4 ms; the temple 1.7 → 2.6 before the
hidden-first order above, which the pass timings since put at 6.88 → 5.92), but their totals moved ±8 ms between runs
of one build under this load, so they cannot show a 1 ms gain.

### Measured and left out

- **Matrices only for what can move.** The scene list's compare of each object's ten numbers is ~95 µs a frame of its
  ~150 µs in the desert (×1). What is still by construction is the tiles (perf.js `tileSceneSteps`: 1 668 in the
  desert, 11 in the City-Shaft); marked `matrixAutoUpdate = false`, the list took 15–20 µs (×1) less in the desert and
  nothing elsewhere. The rest of the world (buildings, props, the temples) is moved now and then by its levels and
  systems (doors, the reactive world, the still batches that follow a mesh that moves), so it cannot be marked without a
  write barrier on position, quaternion and scale. And the Unity mirror treats an object with its own matrix as one that
  may change at any time (engine/mirror-freeze.js never freezes it; mirror.js compares its matrix every frame), so the
  tiles marked would cost the Deck and the Retroid more than the web gains. The rig walks (matrix-cache.js, 1.2 ms at ×4
  in the desert) are the poses' own reads of their joints (humanoid.js `update`, animator.js, feet.js, cloth), needed.
- **Cullers and levels of detail only when the view moves.** Their results depend on more than the view: lod.js picks
  the coarsest level built so far (the worker finishes levels between frames), the small-prop and room culls hide only
  what is shown and other systems change that, the still batches follow meshes that move. A gate on the view with a
  periodic refresh would draw a level, a prop or a room a few frames late: a picture change, which this round rules out.
- **Per change, not per frame.** The bracer strap's inputs (the forearm's skin points and the bracer's matrix) were
  compared bit for bit each frame: different in 421 of 421 frames standing and 386 of 386 walking (the idle pose
  breathes), so a per-change wrap saves nothing without a tolerance, which would change the picture. The desert's
  banners wave every frame. The frame's two hidden lists are now kept from frame to frame (main.js `_frameHidden`,
  `_shadowHidden`): ~20 kB a frame less to allocate, too small to measure.
- **ShadowCuller.collect** walks the whole scene when the scene's top-level count changes. Collecting only the
  top-level children that changed would miss what was added deeper inside the others since the last collect (the full
  walk catches it at that moment); doing it exactly needs a per-subtree edit count in engine/scene-matrices.js, shared
  with Unity: left for a round with a device to measure the hitch on.

### Unity on the Retroid: the script thread (-split), next to the Deck's

The development player of this round's base (675f05cb4, `BUILD_ARGS=-development`; its `hiraeth.cjs` the same as after
this round) on the Retroid Pocket 5, Handheld (FSR 1, 857 × 643 → 1280 × 960), muted, the frame readout on, the #446
Deck views (`cpu-446/deck/views-*.json`), `-bench 6 -split -metrics`, two launches each (they agreed within 0.5 ms),
means. ms a frame; the last column is the Deck's frame and script thread from #446:

| world, view | frame | GPU | script thread | = game update | + mirror (matrices · walk · bones) | main thread waits on script | update's largest parts | Deck: frame / script |
|---|---|---|---|---|---|---|---|---|
| Desert, spawn | 17.7 | 17.6 | 9.7 | 5.5 | 3.9 (1.2 · 2.1 · 0.3) | 0.9 | people 1.4, traveller 1.3, story 0.9, wind 0.6, life 0.5 | 11.4 / 10.4 |
| Desert, camps | 17.2 | 17.4 | 13.0 | 7.7 | 4.7 (1.3 · 2.5 · 0.4) | 1.6 | people 3.2, traveller 1.1, story 0.9, wind 0.6, level 0.6 | 13.7 / 12.4 |
| City-Shaft, start | 18.6 | 17.4 | 13.5 | 7.9 | 5.3 (1.6 · 2.8 · 0.2) | 1.8 | people 3.3, traveller 1.3, crowd 0.8, life 0.7, story 0.6 | 13.6 / 12.0 |
| City-Shaft, crowd | 16.6 | 12.4 | 13.0 | 7.8 | 4.8 (1.6 · 2.4 · 0.2) | 1.1 | people 4.3, traveller 1.1, life 0.6, story 0.6, crowd 0.5 | 13.4 / 12.1 |
| Signal Market, start | 17.5 | 17.3 | 8.8 | 5.8 | 2.7 (0.8 · 1.3 · 0.2) | 0.7 | people 2.1, traveller 1.3, story 0.7, crowd 0.6, life 0.5 | 10.5 / 9.6 |
| Signal Market, crowd | 16.7 | 11.2 | 9.5 | 6.0 | 3.2 (0.9 · 1.5 · 0.2) | 0.6 | people 2.3, traveller 1.3, story 0.7, crowd 0.5, life 0.4 | 9.5 / 8.6 |
| Lorn, start | 20.9 | 20.5 | 8.6 | 5.5 | 2.9 (0.8 · 1.6 · 0.1) | 0.6 | people 1.6, traveller 1.3, story 1.0, life 0.7 | 13.6 / 9.6 |
| Lorn, crowd | 19.1 | 18.9 | 7.9 | 4.8 | 2.8 (0.8 · 1.5 · 0.1) | 0.6 | people 1.5, traveller 1.2, story 0.9, life 0.6 | 13.9 / 9.3 |
| Underwater, start | 16.8 | 16.8 | 7.9 | 5.1 | 2.5 (0.7 · 1.3 · 0.2) | 0.7 | traveller 1.4, people 1.1, level 1.0, story 0.7, life 0.3 | 9.8 / 9.0 |
| Underwater, crowd | 16.7 | 16.7 | 10.0 | 6.7 | 2.8 (0.8 · 1.5 · 0.3) | 1.0 | people 2.2, level 1.6, traveller 1.3, story 0.6 | 10.9 / 9.9 |

On the Retroid the **GPU is the frame** in every view (16.6–20.9 ms, the frame held near 60 Hz in four), and the
script thread (7.9–13.5 ms) runs beside it: the main thread waits on it only 0.6–1.8 ms. Its split is the Deck's,
slightly slower: the people (1.1–4.3 ms, the largest part wherever a crowd is near), the traveller (1.1–1.4) and the
mirror (2.5–5.3, its scene walk half of it). This round changes nothing there (the same script, byte for byte), so the
"after" is these numbers. For the Retroid the CPU levers are the people (#446's item 5) and the mirror's walk.
Raw: the session's scratchpad, `cpu-448/` (`ab/base/split/<world>-r0|r1/unity-bench.json`, `tools/split.py`,
`passall*.txt`, `pix*.txt`, `check-*.txt`, `shots/`).
