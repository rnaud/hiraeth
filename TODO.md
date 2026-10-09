# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

# Visuals and controller menus (October 2026)

- [ ] Redo the character's face to match the references more closely and feel less cartoony / anime.
  Pay particular attention to the eyes as a possible cause of the style mismatch.
- [ ] Fix shadow artifacts in caves and interiors.
- [ ] Make the debug menu easier to navigate with a controller: use a grid layout and smaller level cards.
- [ ] Put button prompts inside the actual buttons in all menus, instead of in hints below them.
- [ ] Show button prompts that match the connected controller.
- [ ] Greatly reduce text in the item debug menu. In fullscreen on the Retroid, keep the text from
  taking over the screen and hiding the item; the item should remain clearly visible.

# Playtest notes (2026-10-08)

## Prologue and the crash landing

- [ ] The intro from Dad is boring.
- [ ] A character's speech bubble shows up while the ship is still crashing.
- [ ] A character stands too close to the ship as it crash-lands.
- [ ] Leaving the ship for the first time shows a prompt to go back into it.
- [ ] The humming the game talks about is never heard. Make it part of the prologue and bring it back
  regularly.

## Dialogue

- [ ] During dialogue, when the camera points at the player's character, the character moves around.
- [ ] The character looks around too much during dialogue.
- [ ] Choosing a dialogue option just plays the chosen line back.
- [ ] When Nour says to stand in the water, the answers offered don't match the context.
- [ ] Talking to Ama, the flame is in the way.
- [ ] Not every character should have a bubble over their head.

## Characters and animation

- [ ] Characters' waving looks wrong; something is off in the animation.
- [ ] The main character has an animation where his mouth opens wide and his neck moves strangely.
- [ ] Brushing past people feels odd: they just shift in place.
- [ ] When told to look into the well, the character looks the other way.

## Shadows and visuals

- [ ] Marrow casts a white shadow towards the ship during dialogue.
- [ ] On the stairs to the big tree, shadows move with the camera and the character casts a white shadow.
- [ ] The Golden Dunes entrance looks stuck, though it works.
- [ ] The transition between worlds looks wrong on a white background when heading to space.
- [ ] Do a visual audit at different screen resolutions.


## Gameplay

- [ ] No invisible enemies.
- [ ] The knuckles riddle (which to shoot first) is unclear: how is the player meant to solve it?

## Menus and settings

- [ ] The galactic map lists the WIP levels that were never vetted or finished.
- [ ] Dropdown values in Settings can't be changed with a controller.
- [ ] The language switched to French and the debug menu disappeared.

# Fun and story (docs/fun-and-story-review.md, October 2026)

Ranked; each says why in the review. Playtest with two or three new players before building the big ones.

- [x] **The story's peak before the ending.** Six worlds now bring a *first homecoming* (the stone, the
  light over the hill, no end card); the final chapter opens after the Signal Market and the true ending
  (the oldest recording, the end card, the credits) comes after it (src/story/ending.js, docs/systems/story.md).
- [x] **Answer the singing light, tied to Ilen**: it was her answer to the father's broadcast, sent from the
  makers' lantern with their sign ("we heard you"); it struck the ship trying to reach his voice on the reel.
  The last stretch goes to find her at the Lantern (src/levels/lantern.js, src/story/lantern-data.js).
- [ ] **A fellow traveller who recurs**, three or four meetings along the route, each changed by the last.
- [x] **Two or three real choices** with consequences at the stone (Viridel's loss stays, as one of them):
  Dov's lift token (keep it, or give it back so he goes home), Hollin's promise (it costs the coming back),
  Esk's hill. The stone and Ilen both remember them (src/story/ending.js choicesMade).
  - [ ] Later: more of the route's people could hear about Ilen (Sel at the market, Hollin's other lines);
    old saves that kept Dov's token before the choice existed show no line for it.
- [ ] **The desert's first hour shorter:** the three talk stages in a row, the empty Hearth ride.
- [ ] **Optional mastery challenges in the open world**, from the temple kit and the vehicles, one a world.
- [x] **Each world's climax staged as a moment** (every route world: `src/story/<world>-moments.js`,
  docs/systems/cinematics.md).
- [x] **One trace of the singing light or of Ilen in each detour world** (and the Sightings page that
  keeps them: docs/systems/story.md, docs/systems/ui.md).
- [ ] The gameplay loop: the fluid blade and the foes are in (v0.87, docs/systems/foes.md; try them in the
  Arena). Next: captured sword swings for the blade (the Sword and Shield and Great Sword packs from
  Mixamo), a better machine, foes that use the world's height and the temple kit.

# Carried over

## The References level

Every reference sheet is rebuilt as views (`?level=references`, `[` / `]`, L3 / R3;
docs/systems/references.md): the desert (1–27), the City-Shaft (28–50), Vael II (51–81), the Buried
Machine (82–103), the Garden of Spheres (104–125), Lorn II (126–148) and the Signal Market (149–169);
Vael has no sheets. All six of the ranked recurring shader gaps are closed (docs/systems/references.md,
"Across the worlds"): pen detail at every scale, line weight and colour per material, haze in layers,
form-following hatching, cast shadows by world, colour variation across a wall, and the scene-level
modelling world by world, and the shader limits (DONE.md). Nothing is left open here.

## Animation

- [x] Evaluate learned motion matching only if it measures better than the conventional system:
  measured again with Mixamo's 25 starts, stops and turns in its database (2026-10-07): it still
  slides two to five times as far as the loops (the game walks at 3.8 m/s, faster than any captured
  walking start), so the loops stay the default (`?mm=1` keeps the matcher) and the new clips play
  over them as captured starts, stops and turns (src/loco-moves.js; docs/systems/animation.md). Next:
  starts, stops and turns at the game's speeds would let the legs follow the capture too.

## Dialogue

- [x] (2026-10-07, the Retroid in the GeckoView test app: the portrait draws the person in all four
  conversations tried, 210 × 210, 280–440 colours; the Sketchbook's relic sketches and the game menu's 23 item
  pictures draw too. So in the app's engine the canvas read works and the capture path stays as it is; the blank
  disc was the device's Chrome, not measured this round. docs/systems/performance.md, "The Retroid, round 4".)
  The speaker's portrait circle shows empty on the Retroid (seen in the device's Chrome: a blank
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

- [x] (2026-10-07, docs/systems/performance.md "The Retroid, round 4": the pen never stopped over 50 ms in seven
  loads, before 6b10cc0 and after; the merged towers draw as unmerged on the Adreno; portraits, the Sketchbook and
  the item pictures draw, the pictures cost one 15–29 ms frame each for 23 frames as the Items panel opens; cab
  rides at 59–60 fps, the route planned in 0.2–0.4 ms; every world again: the traveller's update 2.7–3.6 → 1.0–1.4
  ms, the camps 45 → 56 fps, Qanat 49 → 57, the City-Shaft's rim 50 → 59. Found and fixed: dynamic resolution
  held 0.75 looking down the City-Shaft, GPU-bound at 44 fps; it probes a step down now, 53.5 fps at 0.55.)
  Next time the Retroid is attached, in the GeckoView test app (never the player's app): measure the
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
  before/after table. Done so far (2026-10-07): the Deck preset, fixed and dynamic, in the desert and the
  City-Shaft under headless gamescope (Gaming Mode's X11); the Deck slept at the Market. Left: the other ten
  worlds, High at 1.5×, Desktop Mode. Needs the Deck plugged in (or Desktop Mode): on battery in Gaming
  Mode it sleeps ~15 min after the last input.
- [x] Decide the Retroid's `cpuBound` guard (0.85) for the Deck preset from those numbers: kept on. On the
  Deck (Gaming Mode's X11, the desert and the City-Shaft) JS 19–28 ms a frame against GPU 6–15; dynamic held
  scale 1 at the fixed run's frame rate (performance.md, "The Steam Deck").
- [ ] Compare ANGLE's GL and Vulkan backends under gamescope (`GPU=vulkan scripts/bench/deck-run.sh ...`);
  check the loading pen turns smoothly in a Deck load (`scripts/bench/deck-pen.mjs`); check the new Updates
  section on the Deck itself (the Deck has runtime 830001 and web 969 now, and the site 970001: Check,
  Download and Restart now should take it to 970001).

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
  The Linux player for the Deck builds too: engine-bridge.md, "The players again".) (2026-10-07, on the Retroid:
  it starts, the world ready in 3.5 s, but it never ran its plan: the `unity` extra did not reach it, so neither
  did `-mute` (it played the desert with its sound for ten minutes before the script's limit stopped it). Fixed,
  not yet seen on the device: the script quotes the extra, `BridgeArgs.CommandLine` reads the activity's intent
  on Android, and the script stops a player that has not logged its plan within 20 s, and refuses a locked
  handheld (the second run met the lock screen: the device had locked itself; engine-bridge.md, "On the
  Retroid".) Next: unlock, `android-bridge.sh desert -views scripts/bench/viewpoints.json -bench 8 -split`.)
- [x] The Unity player at the camps and the Market's crowd: 0.7–1.5 ms a frame behind the web (2026-10-07,
  engine-bridge.md "Speed"; level at the dunes, ahead at the City-Shaft). The script's thread is the frame
  there; next: the sound's synthesis off it, the people's bone matrices. (2026-10-07: the capes' cloth in Burst
  jobs and the sound on its own thread: the camps 6.4 ms against the web's 7.3–7.5, the crowd 3.5 against 4.2,
  every view at or under the web; engine-bridge.md "The script's frame against the web's".)
- [ ] The Android player's script thread and sound thread (BridgeRunner runs the script, and the sound's renderer,
  on threads of their own since 2026-10-07; checked on macOS only, no device): run it there once a device is free
  (`-js-main`, `-audio-js` if they fail). (2026-10-07, the Retroid: both started on their own threads and the game ran, "the script on its
  own thread", "the sound on its own thread (24000 Hz)", the audio replay's node counts steady over 6 minutes;
  their frame times wait for the bench run above.)
- [ ] Connect an MCP client to the editor. **Blocked**: an organization policy blocks registering
  unknown MCP servers (the configured UnityMCP server also fails to connect). The editor is driven in
  batch mode instead (`scripts/unity-export/unity-batch.sh`).
