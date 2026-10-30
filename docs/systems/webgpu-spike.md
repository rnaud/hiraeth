# WebGPU spike: three's WebGPURenderer and TSL (issue #802)

A spike, measured 2026-10-30 on three 0.186. **Recommendation: no-go for now** (see the end). The slice
code stays behind a URL flag and nothing in the game's default path changes. It is web only: Unity draws with its own
renderer.

- `?renderer=webgpu` draws the frame with `THREE.WebGPURenderer` on WebGPU; `?renderer=webgpu-gl` draws it with the
  same renderer on its WebGL 2 back end. Any world works. The Arena is the slice, and the Desert landing is the
  stress case.
- Code: `src/webgpu-spike/` (`slice.js`, `surface-tsl.js`, `ink-tsl.js`). The hook in `src/main.js` is a dynamic import
  started after the world's `ready` (not waited for: the WebGL frame draws until the slice is made), plus one `if` at
  the top of `renderFrame`'s passes. three's WebGPU build (698 kB) is its
  own chunk, so the game never loads it without the flag.
- Pictures: `docs/webgpu-spike/` (side by side: the game, the slice on WebGPU, the slice on WebGL 2).

## 1. Where WebGPU works

| platform | `navigator.gpu` | an adapter | how we know |
|---|---|---|---|
| **GeckoView 157, Android** (the app's engine) | **no** by default | **no**, even with both prefs | source and device, below |
| Chrome 156, Android (Odin 3, Adreno 830) | yes | yes: `qualcomm` / `adreno-8xx`, with `timestamp-query`, `shader-f16` and `subgroups` | probe page on the device |
| Chrome 156, macOS (M4 Pro) | yes | yes | the spike's bench |
| Safari 26 (macOS, iOS) | yes, on by default | yes | gpuweb implementation-status wiki (not run here) |
| Steam Deck (Electron 44, Linux, AMD) | behind a flag | not shipped for AMD on Linux, which needs `--enable-unsafe-webgpu` plus Vulkan through ANGLE | gpuweb wiki. The Deck's Electron runs ANGLE on GL by default because Vulkan was unstable under gamescope (docs/steam-deck.md). Unity is the Deck's default anyway. |
| Retroid, WebView 109 | no | no | docs/benchmark-web-vs-unity.md ("Missing features in 109") |
| Xbox, WebView2 150 | no | no | docs/systems/xbox.md ("5. WebGPU") |

**GeckoView 157 in detail.** In Firefox's source (tag `FIREFOX_157_0_RELEASE`, still the same on 159/160/161):

- `modules/libpref/init/StaticPrefList.yaml`: `dom.webgpu.enabled` is `true` only on Windows and on Apple Silicon
  macOS. Elsewhere it is `@IS_EARLY_BETA_OR_EARLIER@`, which is false on release builds, so Android is off.
- `widget/android/GfxInfo.cpp`: `FEATURE_WEBGPU` is `FEATURE_BLOCKED_DEVICE` ("FEATURE_FAILURE_WEBGPU_ANDROID", "until
  it is better tested") on every Android device.
- `gfx/thebes/gfxPlatform.cpp` `InitWebGPUConfig`: `gfx.webgpu.ignore-blocklist` can override that blocklist.

**On the Odin 3.** The probe was a debug copy of the bench's GeckoView app with its own id,
`com.rnaud.hiraeth.webgpuprobe`, GeckoView `157.0.20260924084938`, with sound scaled to 0. It loaded a probe page
through `adb reverse`, and the prefs were written to its GeckoView config file:

| prefs | `navigator.gpu` | `requestAdapter()` | what Gecko says |
|---|---|---|---|
| none (as the app ships) | absent | n/a | none |
| `dom.webgpu.enabled: true` | present | `null` | "WebGPU is disabled by blocklist." |
| + `gfx.webgpu.ignore-blocklist: true` (+ `dom.webgpu.wgpu-backend: vulkan`) | present | `null` with every option (high-performance, low-power, fallback, core) | no warning. The GPU process does create a Vulkan instance (logcat: AdrenoVK "Application Name: wgpu", driver 0800.72), but wgpu returns no adapter, and its own log never reached logcat or `MOZ_LOG` files. |

So the app could set the prefs (`MainActivity.writeConfig` already writes a config file), but even then there is no
adapter on this device. On Android, WebGPU in GeckoView is not usable today. Mozilla's own notes say Android work is
expected in 2026. In every mode, three's `WebGPURenderer` fell back to its WebGL 2 back end by itself ("WebGPU is not
available, running under WebGL2 backend") and drew correctly. The probe app and its data were uninstalled afterwards;
the probe tabs in Chrome were closed and their origin's data cleared.

**WebGPURenderer's WebGL 2 back end on the Retroid's WebView 109.** This was not run, because the Retroid was not
connected. `three.webgpu.js` r186 uses no JavaScript newer than what the game already runs on 109: none of
`toSorted`, `Object.groupBy`, `Promise.withResolvers`, `structuredClone` or `findLast` appear, and three's core is
shared with the build the game uses today. Its WebGL needs (WebGL 2, half-float colour targets) are the ones the game's
own G-buffer already uses there. So it is expected to run, but this is unverified.

## 2. Inventory: what would be ported

About **0.6 MB of GLSL source**, in about 65 files. That counts the tagged and untagged GLSL template strings in
`src/` (`/* glsl */` literals alone: 565 kB in 49 files). The issue's "250 kB" is an older figure. In use, one world
compiles 75–140 programs (desert 92, Arena 138 on the Mac). On the Retroid, the desert's programs came to 6.5 MB of
expanded GLSL (docs/benchmark-web-vs-unity.md).

| part | where | size | what it is | in TSL |
|---|---|---|---|---|
| **The surface shader** | `materials.js` `makeMaterial`: one `ShaderMaterial` | vertex ~23 kB (with `SHADOW_GLSL`), fragment ~120 kB, 208 `#if`s | about 40 `S_*` features plus METAL, GRASS, FLUID, WATER, MIRROR, CROWD, FACE_KEYS, BREATHE, SWAY, ROOM_LIGHT…; three's skinning, instancing and batching chunks; writes the 3 G-buffer targets | `#ifdef`s become JS branches while the node graph is built (the slice does this). The `out` parameters (`sampleShadow`, `renderSky`, …) become `Fn`s returning structs. The three targets become `mrt()` plus the material's `mrtNode` (shown in the slice). |
| Its included chunks | surface-marks 40 kB, crowd-shader 20, water-shader 18, foe-surface 17, face-ink 14, blade-shader 14, ground-ink 9.5, paving 7, crystal 5.8, glyphs 4.3, garden-beds 3.6, dune-glass 3.6, creases 3.3, grass-shader 3, waterfall 2.5, relief 1.8, breathe 1.8, biome, brush, wall-openings | ~170 kB | patterns and looks spliced into the surface shader by name | `Fn` per chunk, the same mechanical work |
| **Temple skins** | `temples/skins/*.js` (15) | ~170 kB | GLSL bodies that `spliceSkin` substitutes for lines of the surface shader by string replace; HLSL is generated from the same data (`scripts/skin-hlsl.mjs`) | no string splicing in TSL: each body becomes an `Fn`, or a generator writes TSL from the skins' data as skin-hlsl.mjs does for HLSL |
| **SHADOW_GLSL** | `materials.js` | 6 kB | 3 cascades (fine/near/far) plus the hero map, `sampler2DShadow`, tent filter (4 or 9 taps), normal offset, `castBeyond` | `texture(depth).compare(z)`; the 4-tap tent is ported in the slice (`surface-tsl.js shadowLit`). The JS (`shadows.js` Cascade, ShadowCuller, snapping) stays; only `WebGLRenderTarget` becomes `RenderTarget` with a `DepthTexture`. |
| **The ink composite** | `post.js createPost` | ~78 kB fragment, 21 `#if`s | ink lines (wobble, size, far, weights, tints), cel shading, hatching, creases, spot blacks, haze, height fog, sky (sun, clouds, planets), bloom halos, weather, the lens | one `Fn` graph on `RenderPipeline`; the slice has cel, hatching, 4-neighbour ink and a flat sky |
| Bloom | `post.js createBloom` | 4 targets, extract + blur | quarter- and eighth-resolution glow | three's own TSL `bloom()` or a port (small) |
| G-buffer and targets | `pipeline.js` | 3 × RGBA16F + depth texture; compose target; FXAA / SMAA (three's addons) | | `pass()` + `mrt()`; `fxaa()` and `smaa()` exist as TSL display nodes |
| `onBeforeCompile` patches | `face.js`, `characters/tripo-cloth.js`, `traveller-b3.js`, `tripo-garment-geometry.js` | ~6 kB | string patches of three's GLSL chunks (`#include <map_fragment>`…) | **no equivalent**: node materials have no chunks; these must be rewritten as `colorNode` / `positionNode` / `outputNode` |
| Other `ShaderMaterial`s (26) | water.js (3), flames (2), hologram (3), approach (2), life (2), static-batch (2), crowd, wind, veil, pit-void, door-light, chimes, splat-decal, jump-shadow, pipeline | ~50 kB | effects and overlays | each a small NodeMaterial |
| Characters' GLSL | portrait-head 8.8 kB, tripo-face 8.2, head-ink 7.9, tripo-cloth 4, tripo-head, tripo-material | ~31 kB | faces and cloth | `Fn`s |
| Ship | starmap 13.6 kB, hologram 11.2, approach 5.2 | ~30 kB | | `Fn`s |
| `flat-pass.js` | | JS | hands three a stand-in scene of the frame's flat list | WebGPURenderer walks the scene its own way (`Renderer._projectObject`): to be re-checked. The spike walks its own stand-in scene. |
| `static-batch.js` | | JS + 2 shaders | still meshes in `BatchedMesh` multi-draws reading a matrix texture | WebGPURenderer has `BatchedMesh` (`batch` node). WebGPU has no multi-draw: three loops the draws inside one pass. Render bundles are the WebGPU tool for this. |
| `warm-shaders.js` | | JS | programs compiled a slice at a time, and the first use | `compileAsync()`; WebGPU compiles pipelines asynchronously and three skips drawing anything whose pipeline isn't ready (a pop-in, not a stall) |

**What has no TSL equivalent, or needs care:**

- three's GLSL chunk patching (`onBeforeCompile`) and the skins' string splicing. Both have to become node graphs.
- `glslFn` works only on the WebGL 2 back end and `wgslFn` only on WebGPU, so raw GLSL cannot be reused on both.
- **three's GLSL→TSL transpiler** (`examples/jsm/transpiler`) was tried on the game's shaders. It took the composite
  (78 kB → 82 kB of TSL in 34 ms), but it **drops the 21 preprocessor branches**. It failed on the surface shader
  ("Unknown accessor expression token `out`": out parameters, and three's `#include`s) and on `SHADOW_GLSL`
  (`sampler2DShadow` and out parameters). It helps with the noise, hatch and other function bodies, not with whole
  shaders.
- WebGPU limits that WebGL doesn't impose:
  - **8 vertex buffers** a pipeline (`maxVertexBuffers`). The merged meshes' surface (`S_VMAT`: position, normal,
    colour, `aMatC1-3`, `aMatS`, `aObjP`, `aObjN`, `aObjM`) has 10 separate attributes, so they would have to be
    interleaved.
  - 64 kB uniform buffers.
  - `maxColorAttachmentBytesPerSample` 32 on many adapters (the G-buffer's 3 × RGBA16F is 24).

## 3. The vertical slice

At the end of the game's `renderFrame` culling prelude (the cullers, levels of detail and flora run as usual), the
frame is drawn by `slice.js` on its own canvas:

1. **The sun's near cascade.** This is the game's near-map placement (`shadowDirection`, `snapLightSpace`, the preset's
   `shadow.near` size and `nearExtent`, the near cascade's bias and offset). It is a depth-only `RenderTarget`.
2. **The G-buffer.** Every mesh in the surface material gets a stand-in. The stand-in shares its source's geometry,
   **the same `matrixWorld` object**, its skeleton (bound) or its instance matrix. Its visibility comes from the source
   and all its parents, read once a frame. The stand-ins are drawn with a TSL copy of the surface (`surface-tsl.js`):
   - the colour, the painted map, and the printed colour zones (vertex colours snapped to `uPalette`);
   - terrain tones, strata bands, flat facets and glow;
   - the toon light term with the cast shadow (a 4-tap tent of hardware-compared taps, `SHADOW_CUT`).

   It writes two targets: albedo + light, normal + view depth.
3. **The composite** (`ink-tsl.js`): two-tone cel shading in the world's tints, the shade's two-direction pen
   hatching (post.js `hatch()`), ink lines from depth, normal, colour and light edges against 4 neighbours, and a flat
   two-tone sky.

What the slice leaves out:

- the other ~40 surface features (surface strokes, marks, faces, metal, glass, water, local lights, the hatch target);
- the fine, far and hero cascades;
- clouds, haze, bloom and AA;
- everything not in the surface material: the traveller's v2 clothes (`onBeforeCompile`), flames, flora and grass
  blades, overlays.

A figure near the Arena's centre in the slice is a stand-in the game keeps off its view's layers; the slice honours
visibility but not layers. Foes that arrive later are picked up every 60 frames. That rescan is timed separately and is
not counted in the numbers.

### Pictures

Each row: the game (WebGL), the slice on WebGPU, the slice on WebGL 2. Same view and hour; the world is held still
(`__stepDt = 0`), with `Math.random` seeded on the Mac. All of them were looked at.

- `docs/webgpu-spike/mac-arena-handheld.jpg`, `mac-arena-high.jpg`: the Arena from the south gate.
- `docs/webgpu-spike/mac-desert-handheld.jpg`, `mac-desert-high.jpg`: the Desert landing (the bench's `spawn` view).
- `docs/webgpu-spike/odin-geckoview-handheld.jpg`: the Odin 3 in GeckoView 157, the game against the slice on WebGL 2.

What they show:

- **The two back ends of the slice are identical to each other.** TSL's one source gave the same picture in WGSL and
  GLSL.
- Against the game, the slice is flatter. The stands' shade is a full dark hatch where the game lifts the turned side
  (its half-tone). Clouds, haze, the surface strokes, the traveller and the flora are missing. The floor's rings, the
  banners, the sun's shadows and the ink lines are there.

### Numbers

All runs are muted: Chrome `--mute-audio`, `hiraeth.muted` set, the settings at 0, and the sound bus checked at 0 in
every run. Each is the median of 10 s after a 4 s warm-up.

Columns:

- **draw CPU**: the main thread's time drawing the frame. For the game, the sum of its `renderer.render()` calls a
  frame. For the slice, `slice.render()` without the rescan.
- **frame** and **main thread**: the animation-frame interval and its callback's time.
- **GPU**: timer queries (WebGL `EXT_disjoint_timer_query_webgl2`) or WebGPU timestamp queries.
- `webgl-nb`: the game with its still-mesh batches off (`statics.enabled = false`), so it draws one mesh a call as the
  slice does.

**Mac, M4 Pro, Chrome 156 (headless, ANGLE Metal / Dawn Metal), 1280 × 720, Handheld 0.75 and High 1.0:**

| world | CPU | preset | path | frame median / p95 ms | main thread ms | draw CPU median / p95 ms | GPU ms | draws | µs a draw | shaders at load |
|---|---|---|---|---|---|---|---|---|---|---|
| arena | M4 Pro | handheld | game WebGL | 2.00 / 3.10 | 1.80 | 0.60 / 1.80 | 2.36 | 71 | 8.5 | 138 programs, 527 ms |
| arena | M4 Pro | handheld | game WebGL, no batches | 1.80 / 3.20 | 1.70 | 0.50 / 2.30 | 2.11 | 111 | 4.5 | 138 programs, 536 ms |
| arena | M4 Pro | handheld | slice WebGPU | 2.20 / 2.90 | 2.00 | 0.90 / 1.20 | 1.45 | 251 | 3.6 | 0.3 s, 108 pipelines |
| arena | M4 Pro | handheld | slice WebGL 2 | 2.30 / 2.90 | 2.10 | 1.00 / 1.30 | 1.08 | 251 | 4.0 | 0.5 s, 89 pipelines |
| arena | M4 Pro | high | game WebGL | 2.80 / 3.80 | 2.60 | 0.90 / 2.20 | 4.20 | 84 | 10.7 | 138 programs, 605 ms |
| arena | M4 Pro | high | slice WebGPU | 2.40 / 3.00 | 2.20 | 0.90 / 1.30 | 2.23 | 255 | 3.5 | 0.3 s |
| arena | M4 Pro | high | slice WebGL 2 | 2.90 / 3.60 | 2.70 | 1.20 / 1.60 | 1.69 | 255 | 4.7 | 0.5 s |
| arena | 4× slower | handheld | game WebGL | 10.30 / 12.20 | 9.50 | 3.20 / 4.50 | 3.12 | 71 | 45 | |
| arena | 4× slower | handheld | game WebGL, no batches | 6.40 / 8.60 | 5.80 | 2.10 / 3.10 | 3.20 | 111 | 19 | |
| arena | 4× slower | handheld | slice WebGPU | 12.90 / 15.50 | 11.90 | 5.30 / 7.10 | 1.47 | 251 | 21 | |
| arena | 4× slower | handheld | slice WebGL 2 | 12.90 / 15.00 | 12.10 | 6.20 / 7.70 | 1.42 | 251 | 25 | |
| desert | M4 Pro | handheld | game WebGL | 7.20 / 8.10 | 7.00 | 3.00 / 3.50 | 4.68 | 332 | 9.0 | 92 programs, 410 ms |
| desert | M4 Pro | handheld | game WebGL, no batches | 5.60 / 6.50 | 5.40 | 2.70 / 3.40 | 4.44 | 704 | 3.8 | |
| desert | M4 Pro | handheld | slice WebGPU | 8.80 / 10.10 | 8.60 | 4.80 / 5.70 | 2.65 | 875 | 5.5 | **2.1 s, 1 011 pipelines** |
| desert | M4 Pro | handheld | slice WebGL 2 | 8.00 / 9.20 | 7.80 | 4.70 / 5.50 | 2.65 | 875 | 5.4 | **34.3 s cold** (first frame 38 s), 968 programs |
| desert | M4 Pro | high | game WebGL | 6.80 / 8.70 | 6.60 | 2.80 / 3.70 | 4.96 | 405 | 6.9 | 367 ms |
| desert | M4 Pro | high | slice WebGPU | 8.20 / 9.40 | 8.00 | 4.80 / 5.70 | 3.63 | 1 037 | 4.6 | 1.6 s |
| desert | M4 Pro | high | slice WebGL 2 | 10.20 / 11.40 | 9.90 | 6.50 / 7.40 | 4.72 | 1 037 | 6.3 | 2.3 s (warm) |
| desert | 4× slower | handheld | game WebGL | 30.10 / 35.20 | 29.50 | 12.80 / 15.80 | 7.90 | 332 | 39 | |
| desert | 4× slower | handheld | game WebGL, no batches | 31.80 / 50.90 | 31.60 | 16.00 / 21.10 | 5.92 | 704 | 23 | |
| desert | 4× slower | handheld | slice WebGPU | 42.60 / 49.60 | 41.50 | **24.60 / 28.40** | 3.05 | 875 | **28** | |
| desert | 4× slower | handheld | slice WebGL 2 | 41.20 / 44.70 | 40.10 | 25.20 / 27.30 | 3.41 | 875 | 29 | |

Notes on the Mac runs:

- "4× slower" is Chrome's CPU throttling (`Emulation.setCPUThrottlingRate` 4), a stand-in for a handheld's CPU.
- The slice's GPU times are lower because it does much less: two targets, one cascade, a small composite. They are
  not a like-for-like GPU comparison.
- The game's "shaders at load" numbers are on Metal's warm shader cache. The first run of the session was 2.3 s for
  the Arena.
- The slice splits into stand-in upkeep, shadow pass and G-buffer + composite. Desert, Handheld, 4× slower:
  2.3 + 9.5 + 12.7 ms.

**Odin 3 (Snapdragon 8 Elite, Adreno 830), the Arena, 60 Hz** (every path holds 16.7 ms, so the draw CPU is what
differs):

| engine | preset | path | canvas | frame median / p95 ms | draw CPU median / p95 ms | GPU ms | draws | µs a draw | shaders |
|---|---|---|---|---|---|---|---|---|---|
| GeckoView 157 | handheld | game WebGL | 1960×1102 | 16.66 / 16.76 | 1.64 / 1.84 | n/a | 112 | 15 | |
| GeckoView 157 | handheld | game WebGL (repeat) | | 16.66 / 16.76 | 1.56 / 1.72 | | 112 | 14 | |
| GeckoView 157 | handheld | slice, WebGL 2 back end | | 16.66 / 16.76 | 3.06 / 3.26 | n/a | 253 | 12 | 1.1 s, first frame 1.4 s |
| GeckoView 157 | handheld | slice, WebGL 2 back end (repeat) | | 16.66 / 16.76 | 3.12 / 3.32 | | 253 | 12 | 1.2 s |
| GeckoView 157 | high | game WebGL | | 16.66 / 16.76 | 1.68 / 1.84 | | 155 | 11 | |
| GeckoView 157 | high | slice, WebGL 2 back end | | 16.66 / 16.78 | 3.08 / 3.26 | | 261 | 12 | 1.1 s |
| Chrome 156 (Android) | handheld | game WebGL | 1960×1046 | 16.60 / 16.70 | 1.10 / 1.30 | n/a | 111 | 10 | |
| Chrome 156 (Android) | handheld | slice WebGPU | | 16.70 / 16.80 | 1.80 / 1.90 | 1.90 | 251 | 7 | 1.4 s, first frame 0.2 s |
| Chrome 156 (Android) | high | game WebGL | | 16.60 / 16.70 | 1.10 / 1.30 | | 132 | 8 | |
| Chrome 156 (Android) | high | slice WebGPU | | 16.70 / 16.80 | 1.80 / 2.00 | 3.47 | 259 | 7 | 1.4 s |

How the Odin runs were done:

- GeckoView ran in the probe app (no WebGPU there, so WebGPURenderer's WebGL 2 back end). Chrome is the one already
  on the device; our tabs were closed afterwards.
- The game ran from the worktree's `vite build`, in a frame of a harness page, served from the Mac through
  `adb reverse` (the scratch folder's `spike-bench.html`).
- GeckoView has no timer queries, so it has no GPU column.

**What the numbers say:**

- **Draw-call cost.** WebGPU's per-draw cost is lower than the game's WebGL path in every row (3.5–7 µs against 8–15 on
  full-speed CPUs, 21–28 against 23–45 throttled). But three's WebGPURenderer itself costs most of that, and the
  difference is not large: against the game with its batches off (one draw a mesh, as the slice draws), the desert
  throttled is 28 µs a draw on WebGPU against 23 on WebGL. The game's statics batching (704 → 332 draws) saves more
  than the API does. For the same scene, the slice spends **1.5–2× the game's draw CPU**, while doing less work. The
  saving the Xbox notes hoped for (WebView2's per-call validation) does not show where WebGPU actually runs. It would
  need render bundles, which three r186 offers only as `BundleGroup`, plus the batching rebuilt on top.
- **The WebGL 2 back end costs as much as the WebGPU one, or more**, and is slower than the game's own WebGLRenderer:
  3.1 ms against 1.6 on the Odin's GeckoView. A fallback path would be a regression for the Android app as it is.
- **Shader compile.** WebGPU builds pipelines asynchronously: the desert took 1.6–2.1 s of `compileAsync`, and three
  skips anything not ready. On the WebGL 2 back end the same 968 programs took **34 s cold**, against the game's 92
  programs in 0.4 s warm (2.3 s cold).
- **Shader variants explode.** 975 vertex programs in the desert against 42 fragment programs. three r186 sizes an
  `InstancedMesh`'s matrices as a uniform array of its instance count (`array<mat4x4<f32>, 140>`), so each instance
  count is a new shader. That would have to be fixed (storage-buffer instancing, or rounding counts up to buckets)
  before any port.

## 4. Estimate of a full port (days of one agent, with picture parity checked world by world)

This is calibrated on the Unity port's HLSL, which is the same look ported once already: `Surface.shader` 142 kB,
`Composite.shader` 60 kB, `SkinPatterns.hlsl` 248 kB. Its shader work took ~2.5 weeks of commits (2026-10-12 → 10-28)
with several agents.

| subsystem | days |
|---|---|
| Renderer swap: canvas, targets (`RenderTarget`), MRT G-buffer, `RenderPipeline`, resize, render scale, readbacks (photo, portraits, map captures, `captureView`) | 4–6 |
| The surface shader: ~40 features and its chunks (~300 kB GLSL), as TSL graphs, variant control | 12–18 |
| Temple skins (15): a generator from the skin data, as for HLSL | 4–6 |
| Shadows: 3 cascades + hero, tent 4/9, culler wiring | 2–3 |
| Ink composite (post.js, 78 kB): lines, cel, hatching, creases, spots, haze, fog, sky, weather, lens | 6–9 |
| Bloom, FXAA / SMAA, overlays (wind, motes, veils, hologram, hitboxes) | 3–4 |
| The other 25 ShaderMaterials (water ×3, flames, ship, life, decals…) | 5–7 |
| `onBeforeCompile` characters (face, cloth, garments, traveller) and faces / eyes | 4–6 |
| Performance: static batching on BatchedMesh or render bundles, instancing variants, flat-pass, warm-up, attribute interleaving (8 buffers) | 5–8 |
| The bridge: Unity reads makeMaterial's uniforms and defines (`surfacePatches`, `skinPatternSpec`, `portMaterial`), so the material description must stay renderer-neutral; plus tests | 3–5 |
| Picture parity in every world, the QC skills (visual-audit, ink-lines, shadow-qc), device runs | 8–12 |
| **Total** | **≈ 56–84 days** (11–17 weeks for one agent; 4–6 weeks with 3 in parallel) |

## 5. Risks

- **Look parity.** The look is about 0.6 MB of hand-tuned GLSL with years of fixes: grazing taps, terminators, ink
  weights, packing in the G-buffer's channels. Every feature has to be ported and checked picture against picture in
  every world, and TSL turns the code into JS-built graphs that are harder to diff against the GLSL.
- **Device coverage.** WebGPU is absent where the game's performance problems are: GeckoView on Android (blocked, and
  no adapter even unblocked), the Retroid's WebView 109, the Xbox's WebView2, and the Deck's Linux Electron. It exists
  in desktop Chrome, Safari 26 and Android Chrome, where the game is already fast. A port would therefore run mostly on
  the WebGL 2 back end in the places that matter, and that back end is slower than today's renderer.
- **Compile stalls.** Variants from instance-count arrays and per-mesh attribute sets (1 011 pipelines for the
  desert). WebGL 2 back-end compiles are synchronous: 34 s cold in the slice's desert. WebGPU's asynchronous compile
  turns stalls into pop-in.
- **Android fallback.** The app's engine (GeckoView) would use the WebGL 2 back end, 2× the draw CPU on the Odin.
  Keeping both renderers, so the old one stays the fallback, doubles every look change.
- **three's maturity.** In r186 the slice hit three things:
  - the WebGL 2 back end left the G-buffer's colour targets uncleared where nothing was drawn (old frames in the
    sky; the slice reads sky from the depth buffer instead);
  - a `select()` between two normal nodes came out NaN in a material's MRT output on WebGPU (a `mix()` works);
  - `If(cond, () => x.assign(y))`, without braces, compiles as a `return`.

  The npm rule also pins us to 0.186 until 2026-11-06, and r187+ renames and moves things often.
- **Unity parity.** No effect on Unity's picture, but the bridge reads the GLSL material's uniforms and defines. A port
  must keep that description stable, or `engine/unity/port-format.js` breaks.

## 6. Recommendation: no-go

The spike proves the path is technically possible. One TSL source drew the slice identically on WebGPU and WebGL 2,
with the colour zones, the sun's cascade, the ink lines and the hatching, in both worlds, on the Mac and on the Odin.
It does not prove a gain:

1. Where WebGPU exists, three's WebGPURenderer spends 1.5–2× the game's draw CPU for less work. The game's own batching
   saves more than the API does.
2. Where the game needs speed (GeckoView on Android, the Retroid, the Xbox, the Deck), there is no WebGPU, and the
   WebGL 2 back end is slower than today's WebGLRenderer.
3. The port is 2–4 months of one agent, with real look-parity and compile-stall risks.

**Revisit when** GeckoView ships WebGPU on Android (watch `widget/android/GfxInfo.cpp`'s `FEATURE_WEBGPU` and
`dom.webgpu.enabled`) and three's WebGPURenderer gets cheaper per draw (render bundles for still scenery). Re-run this
spike's bench then: it takes any world with `?renderer=webgpu` / `webgpu-gl`. Cheaper wins in the meantime stay on
WebGL: the batching and the draw-call work in docs/systems/xbox.md and performance.md.

## How to re-run

```
npx vite --port 54xx                       # (never 5173)
# headless Chrome on the Mac (the scratch scripts of the spike: slice-bench.mjs, run on scripts/bench/browser.mjs)
node slice-bench.mjs --headless 1 --level arena --preset handheld --mode webgl|webgl-nb|webgpu|webgpu-gl [--throttle 4]
```

`window.__slice` holds the slice's timings, `__slice.probe(x, y)` reads its G-buffer at a pixel, and
`__slice.renderer` is three's renderer. Device probe: a copy of `scripts/bench/gecko-app` with its own application id
and a `webgpu` intent extra writing the prefs (0 none, 1 `dom.webgpu.enabled`, 2 + `gfx.webgpu.ignore-blocklist`).
