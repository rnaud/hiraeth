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
| sun shadows | 3 cascades: fine 2048² (24 m), near 4096² (±220 m), far 2048² (2.3 km, every 3rd frame); 9-tap PCF | 4 cascades of 2048² (14 / 56 / 210 / 700 m), every frame; URP soft shadows, low | near 2048² (±160 m, every 2nd frame), far 2048² (every 4th); 4 taps | 2 cascades of 2048² (160 / 700 m), every frame |
| ink pass | full | full (the same composite, ported) | lighter (one line pass) | full (no lighter variant) |
| cloud shadows, crease shading | on | on | off | cloud shadows off |
| distant detail | levels of detail (`lod.js`), flora and props culled by size and distance | none: every static tile and plant drawn at full detail when in view | coarser levels, flora at 55 % density, shorter crowd and prop ranges | as "high" |
| antialiasing | FXAA | FXAA | FXAA | FXAA |

What to keep in mind reading them (seen while building the harness, true whatever the run):

- **The port is not tuned, the web game is.** The web side has had passes for this desert (levels of detail, culling by size, shadow caster culling, cascades refreshed every few frames, the handheld preset); the Unity side draws every static tile and plant at full detail (5–8 M triangles a frame where the web draws 0.5–1.1 M) and refreshes every shadow cascade every frame. What the GPU does here is what each codebase asks for, not what each engine could do: the port would need the same passes (LOD groups or the web's own levels exported, size culling, cascade scheduling) before the GPU columns say much about the engines.
- **The capes.** Where many robed people sit near the camera (the camps, the walk round them) the Unity player spends ~55 ms a frame in `Cape.LateUpdate` (the cloth's collision reads `Transform.position` and `lossyScale` inside its innermost loops): switched off (`node scripts/bench/unity-bench.mjs --off Cape --only camps`), the camps go from ~60 ms to ~6 ms a frame. That is a port bug (read the capsule ends once per step, or move the cloth to Burst jobs), not the engine; the web game has the same capes, and its whole frame there costs a fraction of that (its CPU column).
- **Mono on the Mac.** The macOS player is Mono (the Mac IL2CPP module isn't installed); the WebGL build and the APK are IL2CPP. In the runs made while building the harness the WebGL build (IL2CPP to WebAssembly) was faster than the Mono player wherever the capes dominate.
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

The Android build (`BenchBuild.Android`): `com.rnaud.memento.unity` (never the web app's `com.rnaud.moebius`), debug-signed, IL2CPP ARM64, Vulkan then GLES3. The desert's export is 439 MB as it is read; in the APK `world.bin` and `world.json` travel gzipped (439 → 65 MB) with the characters and sounds, and the first launch copies them out to the app's files (`DataFiles.cs`, a few seconds), so the same full desert runs on both sides.
