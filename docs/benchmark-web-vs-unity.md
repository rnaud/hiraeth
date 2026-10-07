# Hiraeth on the Mac: the web game (three.js) against the Unity port

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
scripts/bench/webview-apk.sh && node scripts/bench/android-engines.mjs   # on the handheld: the web game in the system WebView and in Chrome (below)
```

The Android build (`BenchBuild.Android`): `com.rnaud.memento.unity` (never the web app's `com.rnaud.moebius`), debug-signed, IL2CPP ARM64, Vulkan then GLES3. The desert's export is 142 MB as it is read (the levels of detail included; the flora as instances) and the shared store 210 MB; in the APK they travel gzipped (23 and 48 MB) with the characters and sounds, and the first launch copies them out to the app's files (`DataFiles.cs`, a few seconds), so the same full desert runs on both sides.

## On the Retroid: WebView 109 vs Chrome 154

The installed app runs the game in the system WebView, which on the Retroid Pocket Nova's firmware is stuck
at Chromium 109 (`com.android.webview` 109.0.5414.123, V8 10.9; no other provider is accepted). Chrome on the
same device is 154 (V8 15.4). Same game build (`07af71c`), same desert viewpoints and paths, Handheld preset,
measured in both on 2026-10-05 (`scripts/bench/results/android-webview-vs-chrome.json`).

- **WebView side:** a side-by-side debug build of the app itself (`scripts/bench/webview-apk.sh`:
  `com.rnaud.moebius.perf`, "Hiraeth (perf)", the same `MainActivity`, gamepad bridge and WebView settings,
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

## On the Retroid: GeckoView

Since the system WebView can't be updated on this firmware, the other way out is an engine inside the APK:
GeckoView, Mozilla's embeddable Gecko (`org.mozilla.geckoview:geckoview-arm64-v8a` 157.0.20260924084938,
the release channel, arm64 only). Same build (`07af71c`), viewpoints, paths, Handheld preset, modes and
cooling rule as the WebView/Chrome run above, measured on 2026-10-05
(`scripts/bench/results/android-gecko.json`).

- **GeckoView side:** a test app of its own (`scripts/bench/gecko-apk.sh` builds `scripts/bench/gecko-app/`:
  `com.rnaud.moebius.gecko`, "Hiraeth (Gecko)", 108 MB as a debug APK), the page's bridge as the shipped app
  would have it (a built-in WebExtension with a native port: `window.Capacitor`, the gamepad, pause / resume).
  It loaded the game from the Mac like the other two (`http://localhost:6253/`, 9.6 MB over USB), and in a
  fourth run from its own APK (`gecko-apk`: the game in the APK's assets, served by the app on
  `http://127.0.0.1:6281/`).
- **The WebView again, alongside:** the WebView 109 perf app (`webview-apk.sh`) was measured in the same
  session, rounds alternating with GeckoView, so the two columns are directly comparable. Its numbers match
  the earlier session within a point or two. Chrome 154 is the earlier session's (same build, same day).
- **Driving it:** GeckoView's remote debugging speaks Firefox's protocol, not DevTools', so the page drives
  itself: every page the bench server gives a Gecko engine starts with a script (`scripts/bench/gecko-bridge.mjs`)
  that runs the bench's instrumentation first (as `Page.addScriptToEvaluateOnNewDocument` does) and long-polls
  the Mac for the expressions to evaluate, posting their values back. The same page logic (`web-page.mjs`,
  the shader test, the JS loop) runs in all three engines; `android-engines.mjs --engines gecko --serve <dist>`.
- **Measured the same way:** frame intervals and missed refreshes, the JS time of the animation-frame
  callbacks, draws and triangles, the load to the first frame, the shader test, the JS loop, the GPU's busy
  share and clock (kgsl), temperatures, the CPU and PSS of the processes (Gecko: its content process
  "Isolated Web Content", its GPU process, where WebGL runs remoted, and the app's own parent process),
  where the page's main thread ran.
- **Not measured, or not the same:** GC pauses (a V8 trace; nothing comparable in GeckoView without its
  profiler), the JS heap (`performance.memory` is Chromium's). Gecko rounds `performance.now()` and frame
  times by default; the test app turns that off (`privacy.reduceTimerPrecision`), so its times are as
  precise as the other two. Its WebGL renderer string is generalised ("Adreno (TM) 650, or similar"): the
  GPU is the same Adreno 740. Starts at 36–44 °C, ends at 59–61 °C (GeckoView) and 49–53 °C (WebView), thermal
  status 0 throughout, the GPU at 615–680 MHz on both.

### Equal pixels (render scale 0.75)

| Where | GeckoView 157: median / p95 / p99 ms | missed | JS ms | WebView 109: median / p95 / p99 ms | missed | JS ms | Chrome 154 (earlier): median / p95 / p99 ms | missed | JS ms | GPU busy G / W / C |
|---|---|---|---|---|---|---|---|---|---|---|
| spawn | 16.7 / 16.7 / 33.3 | 1 % | 13.7 | 16.7 / 33.4 / 33.4 | 23 % | 20.9 | 16.7 / 16.8 / 16.8 | 0 % | 12.0 | 86 / 71 / 89 % |
| qanat-tree | 16.7 / 33.3 / 33.4 | 9 % | 18.2 | 33.3 / 33.4 / 33.4 | 42 % | 28.9 | 16.7 / 16.8 / 16.8 | 0 % | 12.3 | 71 / 44 / 78 % |
| camps | 16.7 / 16.7 / 33.3 | 2 % | 16.6 | 33.3 / 33.4 / 33.4 | 43 % | 28.2 | 16.7 / 16.8 / 16.8 | 0 % | 12.2 | 80 / 51 / 85 % |
| dunes | 16.7 / 16.7 / 16.7 | 0 % | 11.4 | 16.7 / 16.7 / 16.7 | 0 % | 12.2 | 16.7 / 16.8 / 16.8 | 0 % | 7.3 | 82 / 80 / 81 % |
| cave | 16.7 / 33.3 / 33.4 | 14 % | 12.4 | 16.7 / 33.3 / 33.4 | 12 % | 13.6 | 16.7 / 33.2 / 33.4 | 13 % | 7.9 | 96 / 99 / 99 % |
| ride-city | 16.7 / 33.3 / 33.4 | 8 % | 15.3 | 33.1 / 33.4 / 50.0 | 39 % | 23.9 | 16.7 / 16.8 / 16.8 | 0 % | 12.7 | 78 / 60 / 81 % |
| walk-camps | 16.7 / 33.3 / 33.4 | 15 % | 19.2 | 33.3 / 49.8 / 50.0 | 50 % | 31.3 | 16.7 / 16.8 / 16.8 | 0 % | 12.2 | 68 / 40 / 77 % |

Medians of 3 rounds; the rounds agreed within 1–4 points of missed refreshes. GeckoView's frame rate there:
59, 55, 59, 60, 52, 56 and 51 fps. The game bundled in the APK plays the same (1 round: 2, 9, 4, 0, 14, 8,
15 % missed; 13.8, 18.3, 16.4, 11.2, 12.6, 15.3, 19.0 ms of JS).

### As shipped (dynamic resolution)

| Where | GeckoView: scale | median / p95 ms | missed | WebView: scale | median / p95 ms | missed | Chrome (earlier): scale | median / p95 ms | missed |
|---|---|---|---|---|---|---|---|---|---|
| spawn | 0.75 | 16.7 / 16.7 | 1 % | 0.70 | 16.7 / 33.4 | 23 % | 0.75 | 16.7 / 16.8 | 0 % |
| qanat-tree | 0.75 | 16.7 / 33.3 | 9 % | 0.65 | 33.3 / 33.4 | 42 % | 0.75 | 16.7 / 16.8 | 0 % |
| camps | 0.75 | 16.7 / 16.7 | 2 % | 0.50 | 33.3 / 33.4 | 42 % | 0.75 | 16.7 / 16.8 | 0 % |
| dunes | 0.80 (0.75–0.85) | 16.7 / 16.7 | 0 % | 0.55 (0.50–0.55) | 16.7 / 16.7 | 0 % | 0.85 (0.80–0.90) | 16.7 / 16.8 | 0 % |
| cave | 0.65 (0.60–0.80) | 16.7 / 33.1 | 5 % | 0.55 | 16.7 / 16.7 | 0 % | 0.70 (0.70–0.75) | 16.7 / 33.1 | 7 % |
| ride-city | 0.60 (0.55–0.60) | 16.7 / 33.3 | 7 % | 0.55 (0.50–0.55) | 33.1 / 33.4 | 39 % | 0.70 | 16.7 / 16.8 | 0 % |
| walk-camps | 0.55 | 16.7 / 33.3 | 16 % | 0.50 | 33.3 / 33.4 | 48 % | 0.70 | 16.7 / 16.8 | 0 % |

### Load, shaders, JS, memory

| | GeckoView 157 | WebView 109 | Chrome 154 (earlier) |
|---|---|---|---|
| load, navigation to the first frame (9.6 MB over USB) | 15.6 s (14.2–16.2) | 21.3 s (19.3–22.4) | 14.0 s (10.4–15.9) |
| load, the game from the APK (as it would ship) | 12.3 s (1 round) | | |
| shader test: the game's 75 programs made unique, compiled and linked one by one | 20.8 s (median 367 ms a program, worst 503 ms) | 22.5 s (median 396 ms, worst 545 ms) | 21.5 s (median 378 ms, worst 523 ms) |
| the same sources again | 19.7 s | 21.3 s | 20.2 s |
| the game's own sources, as loaded | 13.7 s | 16.1 s | 14.4 s |
| `KHR_parallel_shader_compile` | no | no | no |
| plain JS (a three.js matrix loop), k iterations per ms | 14.5 | 17.1 | 35.7 |
| JS heap used | – | 177 MB | 188 MB |
| page process (PSS): GeckoView's content process, the renderers | 561 MB | 470 MB | 400 MB |
| the GPU's host process (PSS): GeckoView's GPU process, the WebView app, Chrome's GPU process | 279 MB | 368 MB | 346 MB |
| GeckoView's parent process (the app itself) | 188 MB | (in the line above) | |
| page process CPU, cores busy (median over the views) | 0.97 | 1.48 | 0.91 |
| cores the page process may run on | 0–7 | 0–2, 5–6 | 0–7 |
| where the page's main thread ran | cpu7 (the 3.2 GHz prime core) 73–75 %, cpu3–6 the rest | cpu5 and cpu6, half each | cpu3–6 67 %, cpu7 33 % |
| APK (release, unsigned) | 102 MB (Gecko's libraries compressed in it) | 9.5 MB | |

### What it means

- **GeckoView clearly beats the WebView here, but doesn't reach Chrome.** At equal pixels the game's JS per
  frame drops by 34–41 % in the busy places (spawn 20.9 → 13.7 ms, Qanat 28.9 → 18.2, the camps 28.2 → 16.6,
  the ride 23.9 → 15.3, the walk 31.3 → 19.2), and the missed refreshes from 23–50 % to 1–15 %: the median
  frame is 16.7 ms everywhere (the WebView's is 33 ms in four of the seven places). Chrome still does the
  same frames in 12–13 ms with nothing missed; GeckoView sits in between, closer to Chrome in the spawn and
  the camps, further in Qanat and the walk (18–19 ms: about 1 frame in 7 missed). The cave is the GPU's, the
  same for all three.
- **As shipped**, the dynamic resolution keeps 0.75 in the spawn, Qanat and the camps (the WebView falls to
  0.5–0.65 there and still misses 42 %), and drops to 0.55–0.6 on the ride and the walk, where it still misses
  7–16 %. Smooth almost everywhere, a little softer than Chrome on the move.
- **Why:** not the raw JS speed. SpiderMonkey runs the plain three.js loop slower than V8 10.9 (14.5 against
  17.1 k iterations a ms; Chrome 35.7). Two other things count: GeckoView's content process may use every core
  and its main thread lives on the prime core (cpu7, 3.2 GHz) three quarters of the time, where the
  WebView's renderer is kept on cpu5–6; and WebGL runs in Gecko's GPU process (the content process only
  queues the commands), which takes driver time off the page's thread. The WebView's GPU waits for frames
  (40–71 % busy in the busy places); GeckoView's is busier (68–86 %), like Chrome's.
- **Load: 5.7 s faster from the Mac, 9 s faster from the APK.** 15.6 s against 21.3 s over USB, and 12.3 s
  with the game read from the APK, which is how the app ships. Shader compiles cost the same in all three (the
  Adreno driver), so most of what remains is the 75 programs.
- **Costs:** about 190 MB more memory than the WebView (1.03 GB over three processes against 0.84 GB), the
  device running hotter (ends at ~60 °C against ~51 °C: it renders more frames), and the APK growing from
  9.5 MB to ~100 MB (arm64 only; the libraries unpack at install to about 180 MB more).
- **What works:** WebGL 2 and every shader of the game (no errors, the frames identical to the eye), the
  page's bridge (`Capacitor.nativePromise`, `__nativePad`, pause / resume) through the extension port, touch
  (pointer events), audio (an `AudioContext` starts without a tap once autoplay is allowed; the game's
  sound was at 0 throughout), localStorage and a secure context on the loopback origin. GeckoView 157 adds
  `EXT_depth_clamp`, `OES_draw_buffers_indexed`, `OVR_multiview2` and the modern JS the WebView lacks
  (`scheduler.yield`, `Object.groupBy`, `toSorted`, `Set` methods, iterator helpers, `Promise.withResolvers`,
  view transitions, popover), and lacks `EXT_color_buffer_half_float`, `EXT_texture_norm16` and
  `WEBGL_multi_draw` (the game uses none of them). No WebGPU either.
- **What needs care:** GeckoView stops a script that runs longer than ~10 s by default (`onSlowScript`
  returning nothing means STOP), which left the page dead in the first test (the bench's 20-s shader loop): the
  app answers CONTINUE and turns the watchdog off. Gecko's own Gamepad API didn't see injected (virtual) pad
  events; the app's own bridge (`GamepadBridge`) does, as in the WebView. Pages from `resource://android/`
  load and run the game but get no content scripts (no bridge), so the shipped app serves the game on a
  loopback origin instead. The built-in controllers themselves (real buttons) were not pressed in these runs:
  only injected events.

Raw runs in `scripts/bench/results/raw/android-gecko-main/` and `android-gecko-apk/` (not in git). To repeat:
`DIST=<dist> scripts/bench/gecko-apk.sh` builds the test app (Gradle 9.3.1 and JDK 17 from Unity's install),
`webview-apk.sh` the WebView one (`URL=http://localhost:6253/`), `adb install` both, then
`node scripts/bench/android-engines.mjs --engines gecko,webview --port 6253 --serve <dist> --raw <dir>` (it serves
the game and the page bridge itself, stops both apps between runs and after a stall, and removes its port rules;
`--resume` goes on where it stopped), `--engines gecko-apk` for the bundled run, then
`node scripts/bench/android-gecko-summary.mjs <dir> --apk <apk dir>`; afterwards uninstall both test apps.
