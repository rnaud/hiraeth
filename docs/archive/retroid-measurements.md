# Measured on the Retroid Pocket Nova

Measurements from October 2026 (builds `1cecfda` and `07af71c`): the WebView against Chrome, frame times per world, and how to repeat them. Since then the app runs in GeckoView (docs/systems/android.md, "The engine: GeckoView").

The handheld itself: Snapdragon QCS8550, Adreno 740 (up to 680 MHz), a 1280×960
60 Hz screen at 2× (640×480 CSS px). Measured in the device's Chrome 154 (ANGLE on
OpenGL ES), Handheld preset, with the game served from a Mac over USB. Note: the app
itself runs in the system WebView, which on this unit is stuck at version 109; see below
for how much slower that is.

**The app's engine: WebView 109 against Chrome 154** (2026-10-05, build `07af71c`; the full
tables in `docs/benchmark-web-vs-unity.md`, "On the Retroid: WebView 109 vs Chrome 154").
Measured with a side-by-side debug build of the app (`com.rnaud.moebius.perf`,
`scripts/bench/webview-apk.sh`) and a Chrome tab, the same build and desert viewpoints, 3 rounds:
- At the same pixels (0.75) the WebView misses 24–50 % of the 60 Hz refreshes at the spawn, in
  Qanat, at the camps and riding or walking (30–45 fps); Chrome holds 60 with none missed. Only the
  cave (GPU-bound on both) stutters in both.
- The cause is the main thread: the game's frame is 21–32 ms of JS in the WebView, 12–13 ms in
  Chrome (plain JS 2.1× faster; V8 10.9 against 15.4). The WebView's renderer is also kept off the
  fastest cores (allowed 0–2, 5–6; Chrome's uses the prime core a third of the time), a smaller part
  of the gap. The GPU is less busy in the WebView, waiting.
- So dynamic resolution, as shipped, drops the WebView to 0.5–0.65 and it still misses 39–49 %;
  Chrome stays at 0.7–0.85, smooth.
- GC pauses are more frequent in the WebView (4–11 ms a second, full collections of 19–27 ms in the
  busy places) but not what costs the frames. Shader compiles cost the same in both (the driver:
  ~0.4 s a program, no `KHR_parallel_shader_compile`); load is 21 s against 14 s, the difference
  being JS. Memory is about the same; 109 lacks WebGPU and a dozen WebGL extensions the game doesn't use.
- An up-to-date engine would give a steady 60 at 0.75 nearly everywhere and ~7 s off the load. The
  firmware won't take a newer WebView, so that means Chrome (a Trusted Web Activity) or a bundled
  engine; without one, the busy places need their JS per frame roughly halved.

Before this pass (build `1cecfda`), 20 s each, walking forward while the camera sweeps
left and right; load is navigation to first frame:

| Where | Load | Median ms | 95th % | 99th % | fps | Draws | Triangles | Scale | GPU busy |
|---|---|---|---|---|---|---|---|---|---|
| Title screen (3D view) | 0.1 s | its 30 fps cap, 1.2 ms CPU a frame | | | | | | 834×598 px | 26 % |
| Ship interior (prologue) | 5.7 s | 16.7 | 18.1 | 18.8 | 60 | 214 | 0.40 M | 0.9 | 77 % |
| Desert, open dunes | 5.5 s | 16.8 | 18.3 | 19.6 | 60 | 540 | 0.74 M | 0.85–0.9 | 69 % |
| Desert, Qanat streets | 5.8 s | 16.8 | 19.7 | 34.3 | 59 | 349 | 0.81 M | 0.8–0.9 | 90–99 % |
| City-Shaft rim | 6.4 s | 16.4 | 22.4 | 37.3 | 57 | 1057 | 3.3 M | 0.75 | 99 % |
| City-Shaft, bottom terrace | 6.5 s | 16.5 | 33.9 | 37.5 | 57 | 902 | 2.6 M | 0.7 | 99 % |
| Vael | 4.3 s | 16.5 | 19.0 | 19.7 | 60 | 423 | 0.54 M | 0.75 | 67 % |
| Vael II | 4.5 s | 16.7 | 19.1 | 35.8 | 58 | 439 | 0.86 M | 0.8–0.85 | 99 % |
| Hangar | 4.1 s | 16.6 | 18.3 | 19.3 | 60 | 581 | 0.56 M | 0.75 | 65 % |
| Buried Machine | 4.3 s | 16.6 | 18.4 | 19.5 | 60 | 402 | 0.84 M | 0.8–0.85 | 75 % |
| Viridel | 4.1 s | 16.6 | 18.5 | 19.2 | 60 | 503 | 0.67 M | 0.75 | 70 % |
| Spheres | 4.9 s | 16.6 | 19.1 | 20.4 | 60 | 507 | 1.0 M | 0.8–0.85 | 81 % |
| Lorn | 4.7 s | 16.6 | 19.1 | 20.0 | 60 | 472 | 0.64 M | 0.8–0.9 | 76 % |
| Lorn II | 5.2 s | 16.8 | 35.0 | 36.3 | 54 | 491 | 1.5 M | 0.75 | 99 % |
| Bazaar | 4.4 s | 16.6 | 18.5 | 19.7 | 60 | 481 | 0.79 M | 0.75–0.8 | 78 % |

No world throttled in these runs (thermal status 0 throughout; the GPU reached 72–74 °C and
held 680 MHz). Where the 95th percentile sits at ~34 ms, every few frames missed the 60 Hz
refresh while the average stayed over 54 fps, so dynamic resolution kept the scale (or even
raised it): a steady stutter.

What costs what (`bench.mjs`: the frame timed in a tight loop at a fixed 0.75 scale; relative
numbers): on the bottom terrace the near shadow map was 7 of 29 ms (about 550 draws and
1.6 M triangles, every frame) and the far map (every 4th frame) 1–2 ms; the ink pass, flora, crowd, NPCs
and the ground ink were each within the noise (≤ 1 ms); 0.5× instead of 0.75× saved 5 ms.
In Qanat: near shadows 4 of 31 ms, the ink pass ~1.7 ms, resolution 0.5× −7 ms (fill rate).

Changed for the Handheld preset:
- **Dynamic resolution counts missed refreshes** (`adaptScale` in `perf.js`, `steady` / `hold`
  in the preset): three or more frames in half a second over 1.5× the quickest is "too slow"
  however high the average; it climbs only through windows with none, and after such a drop
  waits 20 s before trying higher. Bottom terrace: 95th percentile 33.9 → 20.3 ms (settling at 0.65).
- **The near shadow map refreshes every other frame** (`nearEvery: 2`, as Low already did;
  never on the far map's frame): half its cost on average.
- **The City-Shaft's trees** (all presets) were one mesh per terrace and kind, each a full ring
  round the shaft, so no pass could leave any out; they are now split into eighths of the ring
  (same trees: placements, sizes and colours unchanged, `tests/incal-trees.test.js`), still drawn
  right across the shaft (`userData.drawFar`). At the bottom terrace: 0.13 M fewer triangles in
  the view and 0.18 M fewer in the near shadow pass.

To repeat (`scripts/handheld-perf/`): enable USB debugging on the device, then
`adb reverse tcp:5219 tcp:5219`, `adb forward tcp:9339 localabstract:chrome_devtools_remote`,
`npx vite build && npx vite preview --port 5219 --strictPort --host`, open
`http://localhost:5219/` in the device's Chrome (`adb shell am start -a android.intent.action.VIEW
-d http://localhost:5219/ com.android.chrome`), and run
`node scripts/handheld-perf/measure.mjs <label> [desert,qanat,...] [seconds]` (one JSON line per
place) or `node scripts/handheld-perf/bench.mjs <place> [base,noNear,...]`. `ANDROID_SERIAL`
picks the device. The tab keeps its own storage (not the app's saves). Afterwards
`adb reverse --remove-all` and `adb forward --remove-all`.

The WebView-against-Chrome comparison (`scripts/bench/android-engines.mjs`): `scripts/bench/webview-apk.sh`
builds the perf app from a copy of `android/` (its own package id and name, WebView debugging on, the
game loaded from `http://localhost:5253/`, no APK updater; Gradle on Unity's JDK 17), `adb install` it,
`node scripts/bench/serve.mjs --port 5253`, then `ANDROID_SERIAL=… node scripts/bench/android-engines.mjs`
(3 rounds of both engines, fixed 0.75 and dynamic; it keeps and then removes only its own port rules
5253 / 9333, opens and closes its own Chrome tab, stops the perf app between runs, and never touches
`com.rnaud.moebius`) and `node scripts/bench/android-engines-summary.mjs <raw dir>`. Afterwards
`adb uninstall com.rnaud.moebius.perf`.
