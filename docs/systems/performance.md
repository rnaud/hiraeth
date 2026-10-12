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
  bridge installs the same cache: `tests/pose-exact-web.test.js` and `tests/pose-exact.test.js` check every bone).
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

The poses are the same to the float: tests/pose-exact.test.js runs two copies of the game in lockstep (the Unity
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
of the script on both Unity targets: ~12.5 ms at the Xbox's desert spawn, ~15 ms in the Deck's City-Shaft crowd. The
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
  right after Humanoid.update. The City-Shaft's crowd 6 040 objects visited a frame → 3 520. `__POSE_WALKS__` walks as
  before; tests/pose-walks.test.js: every world matrix and every frame's command stream to Unity bit for bit.
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
| desert spawn | 12.2 → **11.4** | 1-2 % → 0-1 % | 59.5 → 59.6 |
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
| desert spawn | 59.5 → 59.5 | 0-1 % → 0.5 % | 11.4 → 11.4 | – → 8.8 | – → 12.5 |

The rim's main thread (1973, ms a frame): the scripts' part 6.5 (the ops 1.7), URP before its first context 0.7, its
contexts 4.9, after them 10.3; the main thread's wait on the script 1.7, FrameTimingManager's present wait 9.7, the
render thread 3.4. The desert's: 4.1 (0.7), 1.0, 3.1, 8.5; wait 0.7, present 8.0, render thread 2.1.

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
| desert spawn | 59.5 (1973) → 59.6 | 0.5 % → 1 % | 12.5 → 11.6 | 11.4 → 10.7 | 8.8 → 8.8 |

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
