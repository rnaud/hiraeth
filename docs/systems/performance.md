# Performance

Quality presets, culling, levels of detail, phone rendering, hand-overs and loads without a hitch. Older handheld measurements: docs/archive/retroid-measurements.md.

## Phone rendering

The old mobile Auto setting could fall to 0.5× of the capped device pixel
ratio: on a 3× phone that meant just one rendered pixel per CSS pixel. Ink
edges were then drawn from a nearest-filtered G-buffer without final
antialiasing. Mobile Auto now starts at 1×, uses a 0.75× floor and targets
roughly 30 fps. All quality levels composite at their own resolution and use
FXAA on the final colour before scaling to the display. Sky dots are spaced
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
  triangles (the Givers' House 212 → 195 / 82 → 65 draws, 202 → 134 / 153 → 86 k triangles; the Aerie
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
  draw costs the batch, not a walk over the world. At load for every destination; as you come
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
| Desert: the Givers' House (temple), in | 17 | 17 | 33 (7 > 33) | 33 (10 > 33) | 7 | 10 |
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
  environment, as the world's own), then polls the driver; the first frame's uploads (`WarmDraw`),
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

- **The screen-fixed noise, baked** (`post.js` `SCREEN_NOISE`, `createPost().bakeNoise`): the ink
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
