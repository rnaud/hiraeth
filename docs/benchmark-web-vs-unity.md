# Memento on the Mac: the web game (three.js) against the Unity port

The same desert, the same viewpoints and paths, the same hour and weather, the same number of pixels, measured on
three sides: the web game in Chrome, the Unity port as a macOS player, and the Unity port built for the browser
(WebGL build, WebGPU). Scripts in `scripts/bench/` (`mac-run.sh` runs it all and rewrites this page); the
handheld side (the Retroid Pocket Nova) is prepared but not measured yet: see the end.

**No results yet.** Run `scripts/bench/mac-run.sh` on a quiet machine (no Unity editor or batch job, no other
browser automation or builds); it writes `scripts/bench/results/mac.json` and this page.

## How it is measured

- **Viewpoints** (`scripts/bench/viewpoints.json`, made by `viewpoints.mjs` from the desert itself): **spawn** (the foot of the ship's ramp, looking out over the dunes); **qanat-tree** (Qanat: the plinth's stair under the burning tree); **camps** (the camps: the fires and the crowd round them); **dunes** (the open dunes from a crest: the widest view); **cave** (the cave under the skull, towards the pool). The traveller stands where the view says, the camera is pinned to its eye and target.
- **Paths**: **ride-city** (riding from the hoverbike's hollow past the camps, through the gate into Qanat; 12 m/s for 20 s); **walk-camps** (walking round the camps, among the people; 3.8 m/s for 20 s). The camera and the traveller are carried along the path by the clock (both sides interpolate the same points), so the world streams past as it does when riding or walking; the bike itself isn't simulated.
- **Conditions**: hour 10, weather clear, sound muted, the HUD hidden (the web's DOM over the canvas, Unity's canvases), the prologue done and the backpack on. 3 s of warm-up, then 10 s per view (the paths: their own length), the first view 2 s more.
- **Uncapped frames**: Chrome runs with `--disable-gpu-vsync --disable-frame-rate-limit` (requestAnimationFrame comes as soon as a frame is done); the Unity player with `vSyncCount 0` and `targetFrameRate -1`. Both in a window (1280 wide), device scale 1 / Retina off, so a 1280 × 720 page is 1280 × 720 pixels.
- **Frame time** is the interval between frames (Chrome: between animation frames, from the page; Unity: `unscaledDeltaTime`). **fps** is frames over the recorded time (1000 / the mean). With no cap the median can sit well under the mean: the CPU runs ahead until the GPU or the compositor holds it back for a frame, so **the mean (fps) is the throughput, p95 / p99 the stutter**; "hitches" counts frames over twice the median.
- **CPU**: web, the JavaScript time of each animation frame (the game's whole `frame()`: simulation and the render calls); Unity, `FrameTimingManager` `cpuFrameTime` (main thread). **GPU**: web, `EXT_disjoint_timer_query_webgl2` around each frame's commands; Unity, `FrameTimingManager` `gpuFrameTime`. On Apple's tile-based GPU both are spans (first command to last), which overlap from one frame to the next: they read higher than the frame interval and are not a busy time. Compare them side to side only loosely.
- **Draw calls, triangles**: web, `renderer.info` over all the frame's passes (shadow maps, G-buffer, ink, overlays); Unity, the render counters (the sum of the draw-call counters by kind, `Triangles Count`), also over every pass.
- **Memory**: the processes' footprint (macOS `footprint`, sampled every 2–3 s: the peak; for Chrome all its processes, browser, GPU and renderer) and its graphics share; JS heap (`performance.memory`) against the Unity player's managed heap; a GPU estimate (web: every geometry and instance buffer in the scene; Unity: `Used Buffers Bytes` + `Render Textures Bytes`).
- **Load**: from launch (Unity) or navigation (web) to the first frame of the desert. The web game is served from this Mac (`scripts/bench/serve.mjs`, uncompressed); the gzipped size of what it fetches is given apart.
- **The quiet gate** (`lib.mjs` `quietCheck`): before each run, and every 5 s while it records, no Unity process (editor, batch job, import worker, another player), no other automated browser, no build or busy dev server, the user's Chrome idle, nothing else over 25 % of a core, load average under 4, on AC power, no thermal warning. A run that fails it is kept and marked invalid.
- Runs alternate (web, Unity, WebGL, then starting one further each round); the spread in brackets is the lowest and highest of the rounds.

### The presets, mapped

| | web High | Unity "high" | web Handheld | Unity "handheld" |
|---|---|---|---|---|
| render scale | 1.0 (the game's High is 1.5×: fixed at 1.0 here, so both sides draw the same pixels) | URP 1.0 | 0.75, dynamic resolution off | URP 0.75 |
| sun shadows | 3 cascades: fine 2048² (24 m), near 4096² (±220 m), far 2048² (2.3 km, every 3rd frame); 9-tap PCF | the same three cascades, sizes and schedule (`MementoShadows`, ported from `shadows.js`; URP's own shadow maps off), 9 taps | near 2048² (±160 m, every 2nd frame), far 2048² (every 4th); 4 taps | the same (no fine cascade, near every 2nd frame, far every 4th, 4 taps) |
| ink pass | full | full (the same composite, ported) | lighter (one line pass) | full (no lighter variant) |
| cloud shadows, crease shading | on | on | off | cloud shadows off |
| distant detail | levels of detail (`lod.js`, lodPx 1), flora and props culled by size and distance | the same: the web's draw units with their levels baked by the exporter (`statics.mjs`, `lod-core.js`), picked by the same rule (lodPx 1), props culled past 520 m and under 1 px, the flora by cell and species distance, the bodies' skinned levels, the crowd's tiers | coarser levels (lodPx 2), flora at 55 % density, shorter crowd and prop ranges | the same rules at lodPx 2, propFar 320 m, propPx 2, flora to 65 % of its distance, crowd to 220 m, 55 % of each cell's small plants |
| scripting | JavaScript (V8) | IL2CPP (the Mac player; the WebGL build and the APK too) | | |
| antialiasing | FXAA | FXAA | FXAA | FXAA |

What to keep in mind reading them (seen while building the harness, true whatever the run):

- **The port draws what the web draws.** Since the first smoke runs (5–8 M triangles a frame against the web's
  0.5–1.1 M, every shadow cascade every frame, ~55 ms of capes at the camps) the port has the web's own passes:
  its draw units and levels of detail, the size and distance culling, the flora by cell, the bodies' skinned
  levels and the crowd's tiers, and the web's three shadow cascades on its schedule (`unity/README.md`, "Drawing
  it cheaply"). The rules are ported, not re-tuned: what differs is the engine. Two things still differ: the port
  gives full bodies to the crowd out to 55 m (the web: the nearest four within 12.5 m, instanced figures beyond),
  so the camps draw more triangles in the port; and on the handheld the web plants 55 % of the small plants where
  it places them at load, the port keeps a fixed 55 % of each cell's (the same count, other plants).
- **The capes** are one Burst job a frame now (the bodies read once, only the capes near and in view, every other
  frame past 12 m); the per-system cost is in each view's `systems` (Unity) next to the frame time. `--off Cape`
  still switches them off for a check.
- **What the systems cost** (Unity: `systems` per view, ms a frame of main-thread time, stopwatch-timed so release
  players report it too: the capes, the levels and culling, the shadows' planning, the crowd; `counts`: capes
  simulated, units drawn coarser, culled, shadow casters, cascades drawn). `--extra "-benchDetail full"` draws
  everything at full detail with nothing culled, `-benchShadows off` without the sun's shadows: the references.
- **IL2CPP on the Mac.** The macOS player is IL2CPP (ARM64, release configuration, speed-optimised C++), as the
  WebGL build and the APK; `BenchBuild.Mac -mono` builds the Mono player for a comparison.
- **GPU times are spans** on both sides (see above): use the uncapped frame time to compare throughput.
- **A window, not a display.** The Unity player, uncapped in a window, runs a few frames ahead and is then held back for one (the 15–30 ms frames in its p95 / p99 on the fastest views, where the median is 3–5 ms); Chrome's uncapped frames don't do that. That is pacing, not work: the stutter a player would see is in the 60 Hz table, and on the handheld (vsync-paced) in the share of frames over 20 ms.

## Running it

```sh
scripts/bench/mac-run.sh                    # builds what is missing, waits for a quiet machine, 3 rounds, rewrites this page
scripts/bench/mac-run.sh --rounds 1 --configs high@1280x720 --secs 4     # a quick check of the harness
node scripts/bench/web-bench.mjs --preset handheld --res 1280x960 --shots /tmp/shots   # one side alone (needs serve.mjs)
node scripts/bench/unity-bench.mjs --preset high --off Cape                         # the Unity player without its capes
scripts/bench/android-run.sh                # on the handheld (USB debugging): the Unity APK and the web game in Chrome
```

The Android build (`BenchBuild.Android`): `com.rnaud.memento.unity` (never the web app's `com.rnaud.moebius`), debug-signed, IL2CPP ARM64, Vulkan then GLES3. The desert's export is 142 MB as it is read (the levels of detail included; the flora as instances) and the shared store 210 MB; in the APK they travel gzipped (23 and 48 MB) with the characters and sounds, and the first launch copies them out to the app's files (`DataFiles.cs`, a few seconds), so the same full desert runs on both sides.
