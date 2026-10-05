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
scripts/bench/webview-apk.sh && node scripts/bench/android-engines.mjs   # on the handheld: the web game in the system WebView and in Chrome (below)
```

The Android build (`BenchBuild.Android`): `com.rnaud.memento.unity` (never the web app's `com.rnaud.moebius`), debug-signed, IL2CPP ARM64, Vulkan then GLES3. The desert's export is 439 MB as it is read; in the APK `world.bin` and `world.json` travel gzipped (439 → 65 MB) with the characters and sounds, and the first launch copies them out to the app's files (`DataFiles.cs`, a few seconds), so the same full desert runs on both sides.

## On the Retroid: WebView 109 vs Chrome 154

The installed app runs the game in the system WebView, which on the Retroid Pocket Nova's firmware is stuck
at Chromium 109 (`com.android.webview` 109.0.5414.123, V8 10.9; no other provider is accepted). Chrome on the
same device is 154 (V8 15.4). Same game build (`07af71c`), same desert viewpoints and paths, Handheld preset,
measured in both on 2026-10-05 (`scripts/bench/results/android-webview-vs-chrome.json`).

- **WebView side:** a side-by-side debug build of the app itself (`scripts/bench/webview-apk.sh`:
  `com.rnaud.moebius.perf`, "Memento (perf)", the same `MainActivity`, gamepad bridge and WebView settings,
  WebView debugging on, the APK updater off), loading the game from the Mac, driven over DevTools
  (`webview_devtools_remote_<pid>`). The player's `com.rnaud.moebius` was never touched.
- **Chrome side:** a tab of its own in the device's Chrome, same URL (`http://localhost:5253/`, the Mac's
  `serve.mjs` through `adb reverse`, uncompressed, no cache).
- **Method** (`scripts/bench/android-engines.mjs`): the page logic of the Mac run (`web-page.mjs`), 3 s
  warm-up and 10 s per view, the paths their own 20 s; 3 rounds, alternating which engine goes first, each run
  after the GPU cooled to ~52 °C (45–51 °C at the start of every run, 53–65 °C at the end, thermal status 0
  throughout, the GPU at 615–680 MHz on both). Two modes: **fixed** (dynamic resolution off, render scale
  0.75 on both: the same pixels) and **dynamic** (the Handheld preset as shipped, 0.5–0.9, starting at 0.75).
  The desert's intro page is closed (a busy game doesn't adapt its resolution) and the game's frame readout is
  on. "Missed" is the share of 60 Hz refreshes missed (a 33 ms frame is one refresh shown twice); "JS" is
  the median time of the animation-frame callbacks (the game's whole frame on the main thread); GC is V8's
  pauses on the page's main thread (trace category `disabled-by-default-v8.gc`). Medians of the 3 rounds; the
  rounds agreed to within a point or two (the JSON has the ranges).

### Equal pixels (render scale 0.75 on both)

| Where | WebView 109: median / p95 / p99 ms | missed | JS ms | Chrome 154: median / p95 / p99 ms | missed | JS ms | GPU busy W / C | GC ms per s (longest) W / C |
|---|---|---|---|---|---|---|---|---|
| spawn | 16.7 / 33.4 / 33.4 | 24 % | 21.3 | 16.7 / 16.8 / 16.8 | 0 % | 12.0 | 71 / 89 % | 5.1 (2.3) / 1.3 (1.6) |
| qanat-tree | 33.3 / 33.4 / 49.8 | 43 % | 28.8 | 16.7 / 16.8 / 16.8 | 0 % | 12.3 | 44 / 78 % | 8.7 (22.7) / 1.4 (1.4) |
| camps | 33.3 / 33.4 / 49.8 | 44 % | 29.4 | 16.7 / 16.8 / 16.8 | 0 % | 12.2 | 50 / 85 % | 6.9 (6.9) / 1.1 (1.4) |
| dunes | 16.7 / 16.7 / 16.7 | 0 % | 12.2 | 16.7 / 16.8 / 16.8 | 0 % | 7.3 | 80 / 81 % | 5.6 (2.5) / 0.7 (1.5) |
| cave | 16.7 / 33.3 / 33.4 | 11 % | 13.8 | 16.7 / 33.2 / 33.4 | 13 % | 7.9 | 99 / 99 % | 4.1 (2.3) / 0.6 (1.3) |
| ride-city | 33.2 / 33.4 / 50.0 | 41 % | 24.2 | 16.7 / 16.8 / 16.8 | 0 % | 12.7 | 60 / 81 % | 11.2 (26.9) / 7.3 (24.6) |
| walk-camps | 33.3 / 49.8 / 50.0 | 50 % | 31.7 | 16.7 / 16.8 / 16.8 | 0 % | 12.2 | 38 / 77 % | 8.2 (18.6) / 2.8 (1.5) |

Draw calls and triangles are the same on both (200–480 draws, 0.29–0.57 M triangles).

### As shipped (dynamic resolution)

| Where | WebView: scale chosen | median / p95 ms | missed | Chrome: scale chosen | median / p95 ms | missed |
|---|---|---|---|---|---|---|
| spawn | 0.75 | 16.7 / 33.4 | 24 % | 0.75 | 16.7 / 16.8 | 0 % |
| qanat-tree | 0.65 | 33.3 / 33.4 | 42 % | 0.75 | 16.7 / 16.8 | 0 % |
| camps | 0.50 | 33.3 / 33.4 | 43 % | 0.75 | 16.7 / 16.8 | 0 % |
| dunes | 0.55 | 16.7 / 16.7 | 0 % | 0.85 (0.80–0.90) | 16.7 / 16.8 | 0 % |
| cave | 0.55 | 16.7 / 16.7 | 1 % | 0.70 | 16.7 / 33.1 | 7 % |
| ride-city | 0.55 | 33.1 / 33.4 | 39 % | 0.70 | 16.7 / 16.8 | 0 % |
| walk-camps | 0.50 | 33.3 / 49.8 | 49 % | 0.70 | 16.7 / 16.8 | 0 % |

(Views run in this order in one session, so the scale carries over from one to the next, as it would in play.)

### Load, shaders, JS, memory

| | WebView 109 | Chrome 154 |
|---|---|---|
| load, navigation to the first frame (9.6 MB over USB) | 21.1 s (19.5–22.5) | 14.0 s (10.4–15.9) |
| shader test: the game's 75 programs (6.5 MB of GLSL) made unique, compiled and linked one by one in a fresh context | 22.4 s (median 396 ms a program, worst 545 ms) | 21.5 s (median 378 ms, worst 523 ms) |
| the same sources again | 21.1 s | 20.2 s |
| the game's own sources, as loaded | 15.9 s | 14.4 s |
| `KHR_parallel_shader_compile` | no | no |
| plain JS (a three.js matrix loop), k iterations per ms | 17.1 | 35.7 |
| JS heap used | 177 MB | 188 MB |
| renderer process (PSS) | 452 MB | 400 MB |
| the GPU's host process (PSS; WebView: the app's own process, Chrome: its GPU process) | 368 MB | 346 MB |
| renderer CPU, cores busy (camps) | 1.5 | 0.9 |
| cores the renderer may run on | 0–2, 5–6 | 0–7 |
| where the page's main thread ran (a fourth, sampling run) | cpu5 50 %, cpu6 50 % (2.8 GHz) | cpu3–6 67 % (2.8 GHz), cpu7 33 % (the 3.2 GHz prime core) |

### What it means

- **On this handheld the WebView is CPU-bound on the main thread, Chrome is not.** At the same pixels the
  game's frame costs 21–32 ms of JS in the WebView where it costs 12–13 ms in Chrome (7–8 ms on the plain
  views). So everywhere with people or a city in view (the spawn, Qanat, the camps, the ride, the walk) the
  WebView misses a quarter to half of the refreshes and plays at 30–45 fps, while Chrome holds 60 with no
  missed refresh at all. The GPU isn't the difference: the same draws and triangles, the same clock, and the
  WebView's GPU is *less* busy (38–71 % against 77–89 %), waiting for frames. The only place both stutter is
  the cave (GPU 99 % busy on both: a GPU cost the engine doesn't change).
- **Dynamic resolution can't help a CPU-bound frame.** As shipped, the WebView's Handheld preset drops to its
  floor (0.5–0.65) in the busy places and still misses 39–49 % of the refreshes: blurrier and no smoother.
  Chrome keeps 0.7–0.85 and stays smooth.
- **Why: mostly the engine, partly the cores it is given.** Plain JS runs 2.1× faster in Chrome 154 (V8 15.4,
  with Maglev, against 10.9). And the WebView's renderer is kept off the device's three fastest cores (allowed
  0–2 and 5–6: its main thread lives on 5 and 6, never on the 3.2 GHz prime core 7, which Chrome's main
  thread uses a third of the time). Where Chrome's main thread barely touched core 7 (the spawn: 1 sample in
  28) its frame was still 1.8× cheaper (11.8 against 21.7 ms), so most of the gap is the engine itself. Who
  sets the affinity (the vendor or the old WebView) wasn't determined; a newer WebView on this firmware isn't
  possible to test.
- **GC: worse in the WebView, but not the bottleneck.** The old V8 collects the young generation 3–4 times a
  second where Chrome does it 0.6–1.5 times (6 on the ride, where the world streams in), and spends 4–11 ms of
  every second on it (Chrome 0.6–2.8, 7 on the ride). Its full collections land as 19–27 ms pauses in Qanat,
  the ride and the walk (a frame or two dropped each); Chrome has those only on the ride (25 ms). That is under
  1 % of the time: the JS speed is what costs the frames.
- **Shader compiles: not a WebView problem.** Compiling the game's programs costs the same in both (the
  Adreno driver does the work: ~0.4 s a program made unique, 15–22 s for all 75), neither engine offers
  `KHR_parallel_shader_compile` here, and neither makes a program seen before free (the same sources again:
  barely faster; the game's own, which both had compiled at load: still 14–16 s). Load is 21 s against
  14 s because the world is built in JS; Chrome's 14 s sits close to the shader floor. The lever for load on
  this device is on the game's side either way: 75 programs and 6.5 MB of GLSL (about 90 kB a program).
- **Missing features in 109:** no WebGPU; no `scheduler.yield`, `Object.groupBy`, `Array.prototype.toSorted`,
  `Set` methods, iterator helpers, `Promise.withResolvers`, popover, view transitions; 12 WebGL 2 extensions
  fewer (`EXT_clip_control`, `EXT_depth_clamp`, `EXT_polygon_offset_clamp`, `WEBGL_clip_cull_distance`,
  `OES_draw_buffers_indexed`, `WEBGL_blend_func_extended`, `WEBGL_stencil_texturing`,
  `WEBGL_render_shared_exponent`, …). The game uses none of them today (no errors in either engine); they
  would matter for a WebGPU renderer, reversed depth (`EXT_clip_control`) or modern JS in new code.
- **What an up-to-date engine would buy:** on this device, a steady 60 fps at 0.75 (or 0.7–0.85 with dynamic
  resolution) in every place measured but the cave, where today the app plays at 30–45 fps at 0.5–0.65; and
  about 7 s off the load. Memory is about the same. The system WebView can't be updated on this firmware, so
  that would mean running the game in Chrome itself (a Trusted Web Activity or the web version: the app's
  native bridge, gamepad and updater would have to be redone or dropped), or shipping an engine in the APK.
  Without an engine change, the WebView needs the game's JS per frame roughly halved (to ~14 ms) in the busy
  places to hold 60.

Raw runs (per-frame lists, every sample) stay in `scripts/bench/results/raw/` (not in git). To repeat:
`scripts/bench/webview-apk.sh` builds the perf app (JDK 17: Unity's), `adb install` it, run
`node scripts/bench/serve.mjs --port 5253` and `node scripts/bench/android-engines.mjs` (it sets up and removes
its own `adb reverse tcp:5253` and `adb forward tcp:9333`, opens and closes its own Chrome tab, and stops the
perf app between runs), then `node scripts/bench/android-engines-summary.mjs <raw dir> --placement <raw dir>`;
afterwards `adb uninstall com.rnaud.moebius.perf`.
