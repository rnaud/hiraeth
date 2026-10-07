# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

# Carried over

## The References level

Every reference sheet is rebuilt as views (`?level=references`, `[` / `]`, L3 / R3;
docs/systems/references.md): the desert (1–27), the City-Shaft (28–50), Vael II (51–81), the Buried
Machine (82–103), the Garden of Spheres (104–125), Lorn II (126–148) and the Signal Market (149–169);
Vael has no sheets. All six of the ranked recurring shader gaps are closed (docs/systems/references.md,
"Across the worlds"): pen detail at every scale, line weight and colour per material, haze in layers,
form-following hatching, cast shadows by world, colour variation across a wall, and the scene-level
modelling world by world (DONE.md). What is left is one shader limit:

- [ ] Shader limits left:
  - The print preset keeps its cumulus bank and clouds (the worlds' own; the views turn them off).

## MakeHuman bodies

Stages 1–3 are done (DONE.md, docs/makehuman.md): one parametric body, the Desert, then every world,
the Lab's faces gallery, the face keys in one texture for every body, the headwear.

- [ ] `scripts/unity-export` still reads the Quaternius bodies. **Reconciled:** the C# port's own game
  logic is retired (the JS bridge draws the live scene instead), so the export is only the bench
  scene's. The live question is the bridge's, below: it does not load MakeHuman bodies yet.

## Animation

- [ ] Evaluate learned motion matching only if it measures better than the conventional system
  (motion matching exists, `?mm=1`, but measures behind the loops: the data, not the method, is
  short). **Blocked on the author**: Mixamo's starts, stops and turns are pending their downloads
  (docs/mixamo-shopping-list.md).

## Dialogue

- [ ] The speaker's portrait circle shows empty on the Retroid (seen in the device's Chrome: a blank
  yellow disc — that is `person.color ?? '#d8a24a'`, the chip's background, with `img.hidden` left
  true or the image blank). **Not reproduced on the desktop**: a headless Chrome 154 (the device's
  version) at the Handheld preset and device pixel ratio 2 draws the person — 210 × 210, 265 distinct
  colours, the commonest only 29 % of the pixels. So the Handheld preset and the pixel ratio are
  ruled out. What is left to suspect is the device's GPU: `captureView` reads the WebGL canvas with
  `drawImage` and the renderer has no `preserveDrawingBuffer`, which comes back blank on some Android
  drivers. **To tell the two apart, one observation from the device would settle it**: do the
  sketchbook's keepsake pictures (the same capture path, JPEG, no isolate and no backdrop) also come
  out blank there? If they do it is the canvas read; if they do not it is something in the
  portrait-only path (`isolate`, the backdrop, `shrinkInto`).
  Meanwhile two things are in place for it: `node scripts/portrait-check.mjs [--preset …] [--dpr …]`
  measures the chip's image (a drawn person is hundreds of colours with no colour over about half;
  an empty capture is one or none), and `captureView` now refuses a blank portrait, so the panel
  falls back to the speaker's initial instead of showing an empty coloured disc. That fallback is
  also the answer to the question: **if the Retroid now shows the initial letter in the circle, the
  capture is coming back empty on the device** and the fault is the canvas read, not the framing.
  (Planned for the second Retroid round in the GeckoView test app, with the Sketchbook's captures, the game
  menu's item pictures and a cab ride; not reached: the device was taken back. The loading pen's fix is in,
  its device measurement too is still to do: docs/systems/performance.md, "The Retroid, second round".)

## Android

- [ ] Next time the Retroid is attached, in the GeckoView test app (never the player's app): measure the
  loading pen through a desert and a City-Shaft load (`adb shell screenrecord`, then
  `scripts/transition-perf/pen.mjs`'s `angles()`); check the City-Shaft's merged towers (`S_VMAT`, checked
  in Firefox / Chrome Metal / SwiftShader on the Mac) draw as unmerged; the speaker's portrait and the
  Sketchbook's captures; the game menu's item pictures; a self-driving cab ride; and re-measure the camps
  and the City-Shaft with the shirt on the GPU (expected ~0.3 ms instead of 2.4).

- [ ] On the Retroid: GeckoView with the real buttons, the upgrade over the installed app, the cave's
  FPS and the shader cost. **Blocked**: no Android device is attached. (The cave's FPS and the shader
  cost are measured, in the GeckoView test app: the cave 60 fps, GPU 41 %, docs/systems/performance.md
  "Every world on the Retroid, in GeckoView"; the game's 78 programs compile in 5.7 s one by one, 81 ms
  median, 208 worst, against 20.8 s and 367 ms in 07af71c's run. The real buttons and the upgrade over the
  installed app are still to do: the measuring never touches the player's app.)

## Steam Deck (waiting on the device: it was asleep, 2026-10-07)

- [ ] Measure every world on the Deck, before (High at 1.5×) and after (the new Steam Deck preset,
  fixed and dynamic), in Desktop Mode and under gamescope: `scripts/bench/deck-run.sh start desktop`,
  then `node scripts/bench/deck-worlds.mjs` (docs/systems/performance.md, "Steam Deck"). Write the
  before/after table.
- [ ] Decide the Retroid's `cpuBound` guard (0.85) for the Deck preset from those numbers (left on: the
  one reading so far, the desert at 17–22 fps with the renderer at 100 %+ of a core, points to CPU-bound).
- [ ] Compare ANGLE's GL and Vulkan backends under gamescope; check the loading pen turns smoothly in a
  Deck load; check the new Updates section on the Deck itself (runtime 830001 and later).

## The Unity bridge

(Verified running on 2026-10-06: `scripts/unity-js-setup.sh` then
`scripts/unity-js-run.sh <name> -level <id> -views scripts/bench/viewpoints.json -out <dir>` plays a
world in the Unity editor through Puerts and saves a PNG a viewpoint; the desert was ready in the VM
1.2 s after launch, the Garden of Spheres 0.8 s.)

The C# port's own game logic is retired in favour of the JS bridge (2026-10-06: Unity + Puerts chosen;
the game's JS runs in Unity, which only draws: docs/systems/engine-bridge.md). Its stages 1–4 are done
(DONE.md): the cheaper scene sync, the platform layer, sound, the tool, the drone, weather, life,
glows and lines, the crowd's GPU figures, the cave's rounded walls, and players for macOS, Linux (the
Deck's) and Android, and what differed from the web is drawn now (DONE.md; engine-bridge.md, "What
still differs"). What is left needs a device or a policy:

- [ ] Run the Unity APK on the Retroid once it builds through the bridge
  (`scripts/bench/android-run.sh`). **Blocked**: no Android device is attached. (2026-10-07: the bridge's
  APK builds, 73 MB, `BridgeBuild.Android`; `scripts/bench/android-bridge.sh desert -views
  scripts/bench/viewpoints.json -bench 8 -split` installs and runs it, muted, and pulls its results.
  The Linux player for the Deck builds too: engine-bridge.md, "The players again".)
- [ ] Connect an MCP client to the editor. **Blocked**: an organization policy blocks registering
  unknown MCP servers (the configured UnityMCP server also fails to connect). The editor is driven in
  batch mode instead (`scripts/unity-export/unity-batch.sh`).
