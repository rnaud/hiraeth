# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

# Visuals and controller menus (October 2026)

- [ ] Redo the character's face to match the references more closely and feel less cartoony / anime.
  Pay particular attention to the eyes as a possible cause of the style mismatch.

# Visual probes (docs/audits/visual-v1.4.md, 2026-10-09)

- [ ] A dark copy of the traveller on the wall behind him in room corners (Handheld): post.js `enclosure`'s look past
  a person (twice as far) lands on the other wall of the corner, nearer than the point. Stop the look at the person's
  depth, or leave the tap out; a test twin with a corner in tests/occlusion-taps.test.js.
- [ ] A hairline of sky still shows at the Givers' Hearth's floor edge (44-73 px, debug 5, both presets): find it with
  foot rays from more points than the centre (the door cut is the first suspect) and close it with a skirt ring.
- [ ] Hovering makers' drones in the temple halls draw a jagged spot-black halo on the wall behind them, moving with
  them: give them (and other moving props near walls) the figure flag, or leave them out of the enclosure as people are.
- [ ] Small square steps in the spot mass at the temple halls' pillar feet (Edena, High): check with the motion check's
  swing on a hall.
- [ ] A spot-black blob in the traveller's own cast shadow on open sand by the ship: check `notPerson` for the taps
  round his feet.
- [ ] The probes: an orbit amplitude that shrinks when the eye has to be pulled in front of a wall (small rooms flag
  on the camera's distance changing, not the masks); a ghost check that takes several noise frames, or freezes the
  world's movers, so drones and passers-by don't flag; foot rays that ignore furniture (a ray at 0.3 m too); place
  other people (Marrow) in front of dark areas, not only the traveller; run the side worlds.
- [ ] world.js `jitter`'s `vertical` noise lifts a foot ring as well as lowers it (no world uses it yet:
  tests/shell-seams.test.js fails the day one does): keep y = 0 going down only, as `rough` does, before using it.

# Combat review (docs/audits/combat-v1.4.md, 2026-10-09)

- [ ] The full charged cut kills 11 of the 15 kinds fastest of any move: give the light combo, the air cut and the
  dash cut a reason (a staggering third swing, heavy foes resisting an uncharged release, a longer full charge).
- [ ] A hurt and a burst sound per kind: src/audio.js `foeHurt` / `foeBurst` have two sets (the machine's and the
  ink's) for the whole roster; glass, shell, paper, roots, slag and shadow each want their own.
- [ ] The route's difficulty falls at the end: the Garden of Spheres and the Signal Market field the softest kinds (the
  sign moth: 1.0 bar a minute, one blow). Bring a late kind or a mixed lead to them.
- [ ] The shadow hound's pounce (0.60 s wind-up, the highest threat: 3.35 bars a minute on a still player) wants a
  floor telegraph or ~0.75 s; the shade (one cut, 3.0 a minute, only the blade answers it) wants a second attack and
  another answer.
- [ ] The eleven guardians share one template (three attacks, two phases, 1.4-1.7 s telegraphs): vary it down the
  route (a third phase or a combined attack later on, telegraphs tightening toward the Signal Market).
- [ ] A shot that does nothing (machine, ray, golem, drone, crab, hound) should say so: a glance spark and the armour's
  thunk.
- [ ] The combat-review script: frame each kind side-on for the contact sheet; drive guard, parry and evade timing
  against each attack; batch and group the report when the larger roster lands.

# Cinematics (QC pass, 2026-10-09: docs/systems/cinematics-qc.md)

- [ ] The prologue and the homecomings run 2–3 minutes with choices inside: review them by hand on the
  review page (the script confirms the cargo check but can't judge the walk-through parts).

# Playtest notes (2026-10-08)

## Shadows and visuals

- [ ] The Golden Dunes entrance looks stuck, though it works. (Unclear which entrance: no door or gate in
  the golden dunes animates. Candidates looked at on 9 October: the Givers' House doorway (a flat dark
  panel with two darker leaves, reads as a shut door; it is in the Rose Canyons though), the ship's ramp,
  the giant's mouth, the region-name caption. Say which one, or what "stuck" looked like.)


# Xbox (queued 2026-10-09)

- [ ] **An Xbox Dev Mode package** (decided 2026-10-09: the packaged web game, not the Unity build): the web
  game in a UWP app with WebView2 (like the Android app's wrapper: the same web bundle and over-the-air
  updates), x64, set to the **Game** app type after deploying (Dev Home / Device Portal: ~5 GB and the full
  GPU instead of an App's 1 GB and 45 %), built on GitHub (a Windows runner) and published to a prerelease;
  the author deploys it through Device Portal (Dev Mode: a Partner Center individual account, the green
  "Xbox Dev Mode" app). First measure on the console with the frame readout: JavaScript's JIT on inside
  WebView2, the Game-mode GPU share reaching the WebView, the controller (WebView2's gamepad bug is
  desktop-only by reports: WebView2Feedback#4366). Why not Unity: Puerts has no UWP/Xbox V8 (it would need a
  V8 port or QuickJS without a JIT, several times slower on a frame the script limits), for at most ~0.9 ms
  of gain measured on the Mac (docs/systems/engine-bridge.md).

# Combat telegraphs (queued 2026-10-09)

- [ ] **No attack drawn on the ground.** Every foe's and guardian's attack is telegraphed by the body itself
  (wind-up pose, a coil, a glow building on the striking part, a sound), never by discs, fans or lanes filled
  on the floor (src/temples/boss.js "telegraphed on the floor first"; the foes' warning zones; the 100 world
  enemies' ground zones). The guardians get richer, staged fights: more attacks than the shared three, combos
  and phase changes that change the moves, openings read from the body. Keep fairness: wind-ups long enough
  to read, the off-screen warning marker for foes behind you. Re-score with the combat-review skill.

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
- [ ] **Optional mastery challenges in the open world**, from the temple kit and the vehicles, one a world.
  The vehicles' side is done (a trial in every route world, v0.98) and so is the system for the temple kit's
  side with nine runs: the desert's Wind hall, Lorn's Hush walk, Vael's Feather leap, the Buried Machine's
  Furnace steps, the Garden of Spheres' Sphere court, the City-Shaft's Long look (v1.3), the Signal Market's
  Echo relay, Viridel's Vine walk and the Sky Stones' Bell crossing (v1.4, docs/systems/challenges.md; the
  stand-in runtime now has the ball rolled onto its plate, the echo stones and horns, the seeds with their vine
  bridges and the flower-door, the bell-tuned bridges of fallen-up stones and the bell-tuned door).
  Next: a makers' run in the other two route worlds, each from its own temple's pieces; both want a new piece
  in the stand-in runtime: Lorn's deep wood (LightEar: the lantern charm's lamps), the Hangar (eye banks with
  riding discs: `level.dynamic`, which the runs now feed).
- [x] **Each world's climax staged as a moment** (every route world: `src/story/<world>-moments.js`,
  docs/systems/cinematics.md).
- [x] **One trace of the singing light or of Ilen in each detour world** (and the Sightings page that
  keeps them: docs/systems/story.md, docs/systems/ui.md).
- [ ] The gameplay loop: the fluid blade and the foes are in (v0.87, docs/systems/foes.md; try them in the
  Arena), and the blade's attacks are all captured swings (the combo, the guard, the whirl, the lunge, and in
  v1.3 the charged cut and the air cut from the Great Sword pack, in v1.4 the riposte after a perfect parry and
  the dash cut out of an evade from the Sword and Shield pack, on their clips' own swing frames: DONE.md).
  In v1.4 foes use the world's height (they climb, hop down and hold off; the spitter takes the high ground;
  knocked off a ledge they lie dazed; a stilled temple crystal's frost holds them, and knocked into deep water
  they are swept away: DONE.md). Next: a better machine.

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

- [ ] **Performance pass on the Steam Deck** (2026-10-09, once the Deck is plugged in so it doesn't sleep):
  every world in Gaming Mode on the installed build, the FPS and frame times against the targets, the worst
  views profiled (GPU vs JS), fixes for the biggest costs, before/after numbers in the changelog. First confirm
  the "mixing the inks…" hang (below) is gone.
- [ ] Every level hangs on "mixing the inks…" on the Deck (2026-10-08, runtime 1294001, its packaged game,
  gamescope GL): no error in the console, the first shader warm-up never logs. Suspect: the load's GPU pacer
  (src/load-steps.js gpuPacer) waiting its full 250 ms on fences the driver never signals, every piece.
  Check on the device with `PORT=5312 scripts/bench/deck-run.sh start headless` and the console over CDP.
  Found and fixed (2026-10-08, not yet confirmed on the Deck): with fences forced never to signal, headless
  Chrome's desert load took 185 s (the first warm-up alone 97 s: 741 surface kinds × up to 250 ms), the
  Deck's exact symptom; a page with no frame callbacks hung at the very first stage instead (not the
  Deck's). Now the pacer gives up after 3 full waits in a row or 3 s in all (one "gpu pacer: …" warning),
  a stage waits for a frame or 250 ms, and a stage over 15 s names its step ("load: still on …"): 3.8 s
  with silent fences. On the Deck, look for the "gpu pacer" warning to confirm the cause.
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
