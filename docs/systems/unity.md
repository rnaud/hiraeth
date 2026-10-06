# The Unity port and the benchmark

The desert in Unity (a proof of concept) and the web-against-Unity benchmark. (The other way to
Unity, the web game's own JavaScript run in Unity by Puerts and drawn through this port's look:
docs/systems/engine-bridge.md, `unity/Memento/Assets/MementoJS/`.)

## The desert in Unity (a proof of concept)
`unity/Memento` is a Unity 6 (URP) port of the desert, built from this game rather than
beside it (the details, how to run it and what is missing: `unity/README.md`).
- **Export** (`scripts/unity-export/export-desert.mjs`): the desert is built headlessly as
  `main.js` builds it (the level, the ship, the story's people, the boxes, the bike, the
  flora; `build-world.mjs`, with the tests' DOM stub) and written out: static surfaces merged
  by material and 256 m tile, the `makeMaterial` options read back from each shader's
  uniforms, the terrain heightfield, the collision `physics.js` bakes, the moving things, the
  time-of-day palette and the "Moebius print" preset, the story's places, portals, people,
  crowd and procession, and `desert-data.js` as `story.json`. Unity's frame mirrors x; the
  shaders mirror it back before every pattern, so the page lands where it does here.
- **The look**: a URP renderer feature draws the same G-buffer (albedo + light, normal +
  depth, hatching + flags) and one ink composite, `materials.js`, `ground-ink.js`,
  `biome.js` and `post.js` ported to HLSL; side-by-side shots match the web closely.
- **The play**: the traveller (glTFast, his own clips), walk / run / jump / climb / mantle,
  the camera rig, the people and the procession (Quaternius bodies in their palettes, UAL
  clips), conversations with tones and at most three answers, quests and the journal, the
  father's charge, the makers' chest on the ledge, the rib, the pool and the jar, the
  hoverbike under the tarp, the burning tree's fire and its burn, falls and knock-downs.
  `scripts/unity-export/unity-batch.sh Play` plays the opening quest end to end in batch mode.
- The project carries the Unity side of MCP for Unity (CoplayDev) so an MCP client can drive
  the editor; see `unity/README.md`.

### Web or Unity: the benchmark (`scripts/bench/`)
The same desert measured on three sides, to decide on numbers: this game in Chrome, the Unity port
as a macOS player, and the port's WebGL (WebGPU) build. Results and the reading of them:
`docs/benchmark-web-vs-unity.md`.
- **Viewpoints, once for all sides** (`viewpoints.mjs` → `viewpoints.json`, built from the desert
  itself): the spawn, Qanat by the tree, the camps, the dune vista, the cave, and two paths (riding
  through the gate into Qanat, walking round the camps), each with the traveller's place, the eye,
  the target and the fov; the hour and the weather fixed.
- **The web side** (`web-bench.mjs`, `web-page.mjs`, `browser.mjs`): real Chrome on the GPU (ANGLE
  Metal, checked), no vsync or frame-rate limit; requestAnimationFrame is wrapped to time each
  frame, its JavaScript and (EXT_disjoint_timer_query) its GPU commands; the camera pinned through
  `updateMatrixWorld`, the HUD hidden; nothing in `src/` changes. **The Unity side**: the players'
  benchmark mode (`unity/Memento/Assets/Memento/Runtime/Bench.cs`).
- **Fair conditions**: the same pixels (device scale 1; High at render scale 1.0, Handheld at 0.75
  without dynamic resolution, URP the same), the presets mapped (the table in the report), the
  quiet-machine gate before and during every run (no Unity editor or job, no other automated
  browser or build, low load, AC power), runs alternating over three rounds, the paths again at
  60 Hz for the stutter.
- `mac-run.sh` runs it all and rewrites the report; `android-run.sh` does the handheld (the APK
  `com.rnaud.memento.unity` and the game in the device's Chrome, never the app `com.rnaud.moebius`).
