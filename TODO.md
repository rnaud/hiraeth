# TODO

**The shared tracker is GitHub Issues** (https://github.com/rnaud/hiraeth/issues; the Notes page writes there too). Every open item below was ported on 2026-10-10 and links its issue; new work goes in an issue, and closing the issue closes the item. This file stays as the long-form context.

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

Playtests are not listed here: the author plays all the time.

# The author's list (2026-10-10), before the full game audit

## Desert progression and screenshot issue drafts (2026-10-10)

- [ ] [#6](https://github.com/rnaud/hiraeth/issues/6) **Investigate the skull cave entrance being blocked.** The author cannot enter and feels stuck
  against an invisible wall. Reproduce and check the entrance collision and progression gates; do not
  assume the cause is confirmed.
- [ ] [#7](https://github.com/rnaud/hiraeth/issues/7) **Earn the sword in a desert mini-dungeon instead of starting with it.** The player should begin
  without the sword and find it in another part of the desert. Picking it up spawns enemies and locks the
  mini-dungeon exit until they are cleared. Make the encounter and exit state survive saving/reloading
  without trapping the player; account for existing saves.
- [ ] [#8](https://github.com/rnaud/hiraeth/issues/8) **Save a screenshot as an issue draft from the Retroid Pocket debug menu.** In the L3 + R3 menu,
  add an action that captures the current gameplay view and saves it as a draft accessible from the
  Hiraeth Notes page on the author's phone. The author can add text to that screenshot later and submit
  the issue. Keep unfinished drafts distinct from published GitHub issues; this needs cross-device
  screenshot/draft storage, not just the existing device-local text draft.

## Combat, controls and world feedback (2026-10-10)

Author feedback; investigate reported artifacts and stutters rather than treating their causes as confirmed. (The
combat and controls items were done in v1.41: DONE.md.)

- [ ] [#9](https://github.com/rnaud/hiraeth/issues/9) **Run a flora and fauna reference pass across every world.** Follow the project's reference workflow.
- [ ] [#10](https://github.com/rnaud/hiraeth/issues/10) **Warm the foes' programs before they are met** (from the v1.41 stutter investigation): call
  `foes.warmModels(foes.rosterKinds())` from the loading work's warm pass (`warmRest`) so the first of each kind no longer
  compiles 1–5 programs on the frame it appears (50–183 ms on the Mac, seconds on a console). docs/systems/foes.md,
  "The stutter when a new foe comes in".

## Xbox: resume the Unity comparison after the Game-default change (2026-10-10)

- [ ] [#11](https://github.com/rnaud/hiraeth/issues/11) **Reinstall/update Hiraeth (Unity), verify Game allocation, and resume Xbox testing.** The author
  authorized enabling `DefaultUWPContentTypeToGame` at `https://192.168.68.64:11443` and restarting the
  console to apply it. The default is now saved as `true`; verify it after reboot and confirm the installed
  Unity package actually receives Game resources before measuring (the new default may not reclassify an
  existing installation). Install the latest successful Unity Xbox package over the existing one; preserve
  the WebView app and saves. Resume Claude's existing Unity worktree, not a parallel implementation.
  Record cold launch, relaunch, world-generation time, shader warm-up, first playable frame, memory limit/peak,
  and sustained desert-spawn FPS with script/GPU frame times. Compare against WebView at matching settings,
  verifying its Game allocation too. Keep the previous 215.6-second QuickJS world build and first-frame
  termination explicitly labelled **App-mode results**, not Game-mode measurements. Report back with actual
  results and blockers. **No geometry baking.**

## Loading follow-up: procedural worlds, no baking (2026-10-10)

Author decision: **do not bake geometry or worlds into shipped assets**. Keep procedural generation and
focus on faster first-install/cold loads as well as repeat loads. This supersedes the baking portion of
any earlier faster-loading plan. Codex stopped its overlapping implementation; continue in Claude's
existing loading/performance worktrees rather than starting another competing shader implementation.

- [ ] [#12](https://github.com/rnaud/hiraeth/issues/12) **Prepare the starting view and nearby area first.** Compile only the surface/shadow variants needed
  for the initial view and its safety margin; prepare upcoming variants incrementally before they are
  seen. Include off-screen shadow casters, a quick camera turn, saved spawn positions, flight, portals
  and cutscene cameras. Do not simply defer the same blocking work to the first movement or doorway.
- [ ] [#13](https://github.com/rnaud/hiraeth/issues/13) **Finish shader consolidation and inspect the expensive algorithms.** Reuse the current shader
  work, profile individual programs on Xbox, and investigate whether the ink pass's nested sampling and
  large surface feature combinations need restructuring. Keep rare expensive features separate, share
  cheap uniform-controlled features where measured worthwhile, and preserve the look with before/after
  images. Moving shader strings to separate files alone does not reduce driver compilation cost.
- [ ] [#14](https://github.com/rnaud/hiraeth/issues/14) **Defer distant procedural detail.** Generate nearby detail before it becomes visible; delay remote
  interiors, decorative geometry and full crowd bodies where safe. Keep collision, quest state, routes,
  landmarks and silhouettes available when required. Bound main-thread work and GPU preparation per frame,
  handle cancellation and newly attached objects, and verify entrances, teleports and fast traversal.
- [ ] [#15](https://github.com/rnaud/hiraeth/issues/15) **Audit and extend the existing LOD rather than replacing it blindly.** `src/lod.js` already provides
  screen-size-based static simplification, a worker, hysteresis and shadow LOD; `src/skinned-lod.js` and
  `src/crowd.js` cover character geometry, animation rates and crowd tiers. They generally start from
  already-created full geometry: that helps frame rate but does not remove upfront generation. Evaluate
  procedural coarse-first generation and spatial activation together with LOD; consider grouped distant
  geometry only if draw-call measurements justify it. Keep everything procedural; no baked exports.
- [ ] [#16](https://github.com/rnaud/hiraeth/issues/16) **Measure the result.** Compare matching builds, levels and quality on Mac, Nova and Xbox, separating
  genuinely cold first-install loads from warm repeats. Split loading into module/assets, world creation,
  collision, characters, shader compile/link/first use and GPU warm-up. Record first playable frame,
  memory, and traversal p95/p99 stalls. Shader caching alone is not an acceptable explanation or solution
  for the reported 3-second Nova versus 230-second Xbox load. Confirm the Xbox resource allocation.

## Worlds

Never delete a temple or a character: a dismissed world moves whole to a dismissed-levels folder
(`src/levels/dismissed/`), out of the route and the Debug menu's worlds, so its pieces can be reused elsewhere.

- [ ] [#17](https://github.com/rnaud/hiraeth/issues/17) **References for a fire-and-ice world** (both at once), in the reference lab.
- [ ] [#18](https://github.com/rnaud/hiraeth/issues/18) **A Star Fox-style space level**: the ship fights space pirates ("They are after your chimes!"); it plays as the
  passage the first time you fly from the ship to a new destination.

- [ ] [#19](https://github.com/rnaud/hiraeth/issues/19) **The merged worlds' follow-ups** (v1.39 level-design audit: Vael 4.56 → 3.89, Lorn 4.44 → 3.89, Glass Dunes 3.22):
  the long empty walks back (Vael's 760 m from the monastery to the clapper), a weenie and a reason to cross each join;
  the Glass Dunes' spread of places and height. Can the sky stones be reached on foot from Vael's plain? Frame rate of
  the bigger terrains on Android.
- [ ] [#20](https://github.com/rnaud/hiraeth/issues/20) **Story loose ends from the merge**: the Buried Machine's lines about the Major and the Hangar; Fen's "the skiff
  is his" (you use your own now); Vael II's and Lorn II's stories no longer close a journal page; recordings 10 and 11
  never play (the reel words bell, lamp, why unused); the ending's world data covers 6 of the 9 places.

## Traversal and gadgets

- [ ] [#21](https://github.com/rnaud/hiraeth/issues/21) **The jets' trials outside the City-Shaft** (the Glass Dunes' Glass slalom, the Buried Machine's Canyon dive, the
  Signal Market's Avenue run): since the jets became a debug item (v1.38) they want the debug jets, so their rewards
  (the strong lodestone, the fourth pouch, the racer's ribbon) can't be won in play. Give each another mode. (The
  Hangar's Pillar slalom is out of play with the Hangar, dismissed in v1.39; its lodestone went to the Glass slalom.)

## Look

- [ ] [#22](https://github.com/rnaud/hiraeth/issues/22) **Redesign the chests** from new references: they are boring.

## Combat, more like Breath of the Wild


## Temples

- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) **Redo the temples with less linear paths** (2026-10-10): several rooms with puzzles of different complexity,
  keys found in one room that open others, rooms that close behind you and hold a small arena challenge to reopen,
  and so on: a temple you explore, not a corridor of rooms in order. Keep every temple and guardian (reuse their
  rooms and kits); use the temple-design-qc skill to score the result.

## Camera and animation


## Tools and releases

- [ ] [#25](https://github.com/rnaud/hiraeth/issues/25) **A Midjourney CLI that uses the author's session cookies** (kept in `.env`, never printed or committed), for the
  reference lab.

# Selected characters, currency, ship and sword (2026-10-09)

User-approved Midjourney originals and provenance are indexed in
`references/batches/2026-10-09-selected-family-currency-ship-sword.json`.
Use the selected single-view designs as the source of truth; derive further views from them
rather than mixing the earlier inconsistent exploration sheets.

- [ ] [#26](https://github.com/rnaud/hiraeth/issues/26) Extend the generated father beyond the recording bust for full-body walking and clothing motion; the procedural family is integrated (see DONE.md).
# Singing light soundtrack follow-up

- [ ] [#27](https://github.com/rnaud/hiraeth/issues/27) **Generate the singing light theme with Suno** using the brief in
  `docs/systems/audio.md` ("The singing light's theme") and install the selected recording
  in the existing `singing-light` cue slot. The synthesised motif, restaged opening,
  voicemail, Qanat repayment, signature search and rumble are implemented (DONE.md).

# Visual probes (docs/audits/visual-v1.21.md, 2026-10-10; v1.4's done: DONE.md)

- [ ] [#28](https://github.com/rnaud/hiraeth/issues/28) Small pale notches still left at a corner's foot beside a person (300-600 px, Handheld) and Marrow's wide hem
  darkening the floor a little: where three planes meet, the planes round a hidden tap can miss the one hiding it
  (a third look-past along the other axis?). The buried world's stairs-0 orbit (Handheld, 0.74) not looked at by eye.

# Enemy roster (approved 2026-10-09: 21 archetypes; framework and batches 1 (v1.8), 2 (v1.9), 3 (v1.13) and 4 (v1.16) built)

docs/design/enemy-roster.md ("Status": each archetype's), docs/systems/foes.md "The enemy roster". Done: the
framework, batch 1 (the shellback crab, the horn lizard, the antler hound, the lamp tripod, the ink blot; scored in
docs/audits/combat-v1.8.md), batch 2 (the mound worm, the sky ray, the signal moth, the ring centipede, the lantern
jelly, on the kit's chains; scored in docs/audits/combat-v1.9.md), batch 3 (the bellows toad, the stilt heron, the
skitter swarm, the root knot, drawn to both their sheets; scored in docs/audits/combat-v1.13.md) and batch 4 (the
furnace brute, the ring drone, the crucible cart, the bell walker, drawn to both their sheets; scored in
docs/audits/combat-v1.16.md) and batch 5 (the shade reworked, the pearl roller, the marionette, drawn to both their
sheets; scored in docs/audits/combat-v1.18.md). All 21 are built: no stand-in is left and every world runs wholly on
the new roster. v1.26: the contact sheet rebuilt from the picked sheets, the biggest gaps against them closed, the
Desert's cistern pump placed (DONE.md, "Enemy roster: the art against the sheets").

- [ ] [#29](https://github.com/rnaud/hiraeth/issues/29) Batch 3 against its sheets (docs/design/enemy-roster.md "Status"; the jug's ochre marks done in v1.26): the
  skitters' curved bony legs (the kit's leg segments are straight cylinders: a bowed shin needs the segment's own bend
  plane); the heron flying off when you run at it (it strides away now); the toad's swollen sac see-through, the glob
  inside it (no see-through surface yet).
- [ ] [#30](https://github.com/rnaud/hiraeth/issues/30) Measure the machines' CPU on the Retroid and the Deck (combat-v1.16 rec. 3: +0.25 ms a machine in headless Chrome,
  a pack of six 2.5 → 4.0 ms): the cart's ground rays every other frame and its wheels' instance upload first (a far cart
  could skip both).
- [ ] [#31](https://github.com/rnaud/hiraeth/issues/31) Batch 4 against its sheets (docs/design/enemy-roster.md "Status"; v1.26 draped the cart's canvas, toothed its
  sprockets and wound its smoke, plated the brute's fingers and met its fists over its head, banded the bell's yoke):
  the brute's crack net lighter; the bell's spirit seen from above, its legs' plating; the drone's cloud spreading in
  wisps at its sides.
- [ ] [#32](https://github.com/rnaud/hiraeth/issues/32) The combat-review script (combat-v1.18 rec. 4): drive the marionette with a host and time freeing it (strings cut)
  as well as killing it; the roller's shot and ember times assume it unrolled (rolling, they glance).
- [ ] [#33](https://github.com/rnaud/hiraeth/issues/33) Batch 5 against its sheets (docs/design/enemy-roster.md "Status"; v1.26 hung the shade's cloak as a drape in
  folds and poured the marionette's knot down in a funnel): the shade's smoke in flame-like curls (tried as curling
  tubes in v1.26: they read as a white-lined fence, kept the wisps); the roller's spiral on one side only and sheet-2's
  rocking runners in its wind-up, a glistening trail where it grazes; the marionette's glass see-through.
- [ ] [#34](https://github.com/rnaud/hiraeth/issues/34) The still traveller's measure under-reads a big pack (combat-v1.22): two or three strikers at a time, and off the
  screen one waits while another strikes, so a pack of five presses about as hard as two. Drive the review's still
  player with the lock-on camera turning to each striker, or time a scripted player clearing the pack, before tuning the
  late worlds further by numbers.

# Combat review (docs/audits/combat-v1.4.md, 2026-10-09)

- [ ] [#35](https://github.com/rnaud/hiraeth/issues/35) The dash cut is the best answer nowhere (combat-v1.22: 1.5 s a blow by its cooldown; the air cut, the combo and the
  charged cut now each lead somewhere): a dash cut through a foe's back could land double, or its cooldown shorten.
- [ ] [#36](https://github.com/rnaud/hiraeth/issues/36) The combat-review script: drive guard, parry and evade timing against each attack; batch and group the report
  when the larger roster lands (each kind is framed side-on for the contact sheet since v1.26).

# Playtest notes (2026-10-08)

## Shadows and visuals

- [ ] [#37](https://github.com/rnaud/hiraeth/issues/37) The Golden Dunes entrance looks stuck, though it works. (v1.9: one more candidate fixed, the doorway in the sand
  before the masked head, south of the landing: its flat dark panel in a stone frame read as a shut door; it is a short
  passage into the dark now, src/interiors.js doorwayPortals. Check whether that was the one.) (Unclear which entrance: no door or gate in
  the golden dunes animates. Candidates looked at on 9 October: the Givers' House doorway (a flat dark
  panel with two darker leaves, reads as a shut door; it is in the Rose Canyons though), the ship's ramp,
  the giant's mouth, the region-name caption. Say which one, or what "stuck" looked like.)
- [ ] [#38](https://github.com/rnaud/hiraeth/issues/38) **Ink lines, what the v1.33 audit left** (docs/audits/ink-lines-v1.33.md, `.claude/skills/ink-lines`): Edena's
  flowers 55 m off are still 34-41 % ink (their heads' outlines; the rubric's far cap is 30 %): a lighter line in their
  own colour for the meadow flowers (`line` / `lineTint`, as the `leaves` foliage) would take the rest but changes them
  close up — for the author to say. The far town shimmers half a pixel over (Qanat at 150 m, 0.44 of its ink, 12-14 %
  pops, before and after): check it in motion (scripts/motion-check, the zoom path) and look at the haze layers and
  the wobble on thin far shapes.

# Xbox (queued 2026-10-09)


# Procedural animation (2026-10-09; phases 1–3 done: the kit is `src/motion-kit/`)

The foes walk like toys on sticks: rigid legs swung by a shared clock, feet sliding 0.3–1.4 m per metre walked,
six-legged crabs waddling all-left / all-right, bodies that ignore their feet (measured:
docs/systems/procedural-animation.md, "The audit"). Build a small locomotion kit (`src/motion-kit/`) and move the
new ~20 body plans and the guardians onto it. Review every step with the `procedural-animation` skill
(`node scripts/motion-audit/run.mjs`, the rubric). Sessions are rough estimates.

# Level design (audit) (docs/audits/level-design-v1.5.md, v1.9, v1.15, v1.17, v1.20, v1.23: 2026-10-10)

Ranked worst first; each re-runs `node scripts/level-design/audit.mjs --worlds <id>` (skill: level-design-qc).

Left from v1.23 (docs/audits/level-design-v1.23.md, "The ranked edits that remain"), worst first:
- [ ] [#39](https://github.com/rnaud/hiraeth/issues/39) **The desert's two long blind legs**: the well → Marrow (441 m) and Marrow's hollow → the Hearth (1.6 km), and its
  first goal 391 m off the landing. Wayfinding 4 → 5, onboarding 3 → 4.
- [ ] [#40](https://github.com/rnaud/hiraeth/issues/40) **Verticality 2 in Lorn, the Hangar and the Garden**: a stage or a box up high, or a path that climbs. +1 each.
- [ ] [#41](https://github.com/rnaud/hiraeth/issues/41) **A weenie in each of the Hangar's far zones** (the ring, the upside-down quarter): landmarks 3 → 4.
- [ ] [#42](https://github.com/rnaud/hiraeth/issues/42) **The Buried Machine's oculus → the wheel** (351 m, blind): an oil pipe from the valve would run beside the Tooth
  Day posts, and the world sits at the contact audit's line (climbs inside 42 of 43); or the audit counts a canyon.
- [ ] [#43](https://github.com/rnaud/hiraeth/issues/43) **Overhead goals as seen, in the audit**: Vael's window → the tower's foot, the City-Shaft's palace legs.
- [ ] [#44](https://github.com/rnaud/hiraeth/issues/44) Smaller: Lorn's Great Crystal ↔ Saba ping-pong merged (saves at each stage must still work); the Signal Market's
  tower down two more avenues (the west towers stand at every bearing from the back lane); Sel and the Sky Stones'
  monastery over 300 m from their landings (onboarding 3).

# Temple design (audit) (docs/audits/temple-design-v1.5.md, 2026-10-09; v1.8, v1.12, v1.16, v1.19, v1.24: the worst reworked, two or three at a time; v1.27: the four rules)

All eleven were one chain with every key beside its lock (mean obviousness 4.25-5 of 5, no step combines the gadget
with an older verb); since v1.24 every one has its own idea (average 1.84 → 3.87). Ranked; each re-runs
`node scripts/temple-design/audit.mjs` and keeps tests/temples.test.js passing (skill: temple-design-qc). The fights
themselves: done in v1.6 (DONE.md, "Combat telegraphs"). The four rules, checked across the eleven in v1.24 and done in v1.27 but
three openings (docs/audits/temple-design-v1.27.md, "The four rules"):

# Fun and story (docs/fun-and-story-review.md, October 2026)

Ranked; each says why in the review. Playtest with two or three new players before building the big ones.

- [ ] [#45](https://github.com/rnaud/hiraeth/issues/45) A second makers' run in a world, from what is left of its temple's kit (docs/systems/challenges.md, "Next"):
  Viridel's greenhouse glass (a vine up an unclimbable pane: `noClimb` colliders in the stand-in), the Hangar's
  eye banks on pistons in turn, the Lamp-House's pool-orb rolled to a lamp.
- [ ] [#46](https://github.com/rnaud/hiraeth/issues/46) The gameplay loop: the fluid blade and the foes are in (v0.87, docs/systems/foes.md; try them in the
  Arena), and the blade's attacks are all captured swings (the combo, the guard, the whirl, the lunge, and in
  v1.3 the charged cut and the air cut from the Great Sword pack, in v1.4 the riposte after a perfect parry and
  the dash cut out of an evade from the Sword and Shield pack, on their clips' own swing frames: DONE.md).
  In v1.4 foes use the world's height (they climb, hop down and hold off; the spitter takes the high ground;
  knocked off a ledge they lie dazed; a stilled temple crystal's frost holds them, and knocked into deep water
  they are swept away: DONE.md). Next: a better machine.

# Carried over

## Animation

- [ ] [#47](https://github.com/rnaud/hiraeth/issues/47) Capture starts, stops and turns at the game's actual speeds so feet follow the motion.
  The completed motion-matching evaluation is recorded in DONE.md. The matcher is ready for them (the game's loops in
  its database, the hand-in, the sprint, the stops: docs/systems/animation.md, "The motion QC"); run the `motion-qc`
  skill before and after, and make it the default only if it is green where the default is.
- [ ] [#57](https://github.com/rnaud/hiraeth/issues/57) The motion QC's reds in the default walk (`node scripts/motion-qc/run.mjs`): pops at every sprint step (the
  sprint loop's stance outlasts the leg's reach at 7–8 m/s), the stairs, the feet crossing for a few frames in a pivot,
  the last step of a stop from a run (29 cm).

## Dialogue

- [ ] [#48](https://github.com/rnaud/hiraeth/issues/48) Recheck the blank portrait reported in the Retroid's Chrome (not reproduced in GeckoView).
  Compare portraits, Sketchbook captures and item pictures on the device; use
  `scripts/portrait-check.mjs` and the existing initial-letter fallback to distinguish blank GPU
  captures from framing problems. GeckoView verification and diagnostic history are in DONE.md.

## Android

- [ ] [#49](https://github.com/rnaud/hiraeth/issues/49) On the next Retroid session, re-measure the camps and City-Shaft with the shirt on the GPU
  (expected ~0.3 ms instead of 2.4); use the GeckoView test app, not the player's installed app.
  Completed load, rendering, portrait and cab checks are recorded in DONE.md.

- [ ] [#50](https://github.com/rnaud/hiraeth/issues/50) On the Retroid: GeckoView with the real buttons, the upgrade over the installed app, the cave's
  FPS and the shader cost. **Blocked**: no Android device is attached. (The cave's FPS and the shader
  cost are measured, in the GeckoView test app: the cave 60 fps, GPU 41 %, docs/systems/performance.md
  "Every world on the Retroid, in GeckoView"; the game's 78 programs compile in 5.7 s one by one, 81 ms
  median, 208 worst, against 20.8 s and 367 ms in 07af71c's run. The real buttons and the upgrade over the
  installed app are still to do: the measuring never touches the player's app.)

## Steam Deck (waiting on the device: it was asleep, 2026-10-07)

- [ ] [#51](https://github.com/rnaud/hiraeth/issues/51) Measure every world on the Deck, before (High at 1.5×) and after (the new Steam Deck preset,
  fixed and dynamic), in Desktop Mode and under gamescope: `scripts/bench/deck-run.sh start desktop`,
  then `node scripts/bench/deck-worlds.mjs` (docs/systems/performance.md, "Steam Deck"). Write the
  before/after table. Done so far (2026-10-07): the Deck preset, fixed and dynamic, in the desert and the
  City-Shaft under headless gamescope (Gaming Mode's X11); the Deck slept at the Market. Left: the other ten
  worlds, High at 1.5×, Desktop Mode. Needs the Deck plugged in (or Desktop Mode): on battery in Gaming
  Mode it sleeps ~15 min after the last input.
- [ ] [#52](https://github.com/rnaud/hiraeth/issues/52) Compare ANGLE's GL and Vulkan backends under gamescope (`GPU=vulkan scripts/bench/deck-run.sh ...`)
  (2026-10-10: done, Vulkan far slower: 19 vs 33 fps at the desert's spawn, GPU 30 vs 12.5 ms; GL stays);
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

- [ ] [#53](https://github.com/rnaud/hiraeth/issues/53) **See the Unity port's angular ship and the water's contact foam run** (both written 2026-10-10 and checked only
  by compiling: the C# against the project's assemblies, the HLSL with glslang; no editor run was possible here: an
  editor needs its own `Library`, and the disk and the shared checkout ruled out a second one). In the main checkout,
  regenerate the exports (`node scripts/unity-export/export-all.mjs`: the ones there are from 2026-10-05, the ball),
  then `scripts/unity-export/unity-batch.sh Play -out /tmp/play` (the prologue's shots: `prologue_the_pause`,
  `_the_light`, `_the_drain`, `_the_glide`, `_the_landing`, the arrival's), the EditMode tests (`WorldsTests` expects
  the four bells, the hull and its points), and shots of water round something standing in it (Viridel's lake,
  Lorn II's tree) with `-waterContact` added to the batch command (the foam is off without it) and without, to see
  the band and that the water is still drawn (docs/systems/water.md, "In Unity"; docs/systems/ship.md). Once it
  works, turn it on by default (`MementoFeature.Settings.waterContact`, off on mobile as the web's Handheld) and add
  the changelog line for the Unity test build.

- [ ] [#54](https://github.com/rnaud/hiraeth/issues/54) Run the Unity APK on the Retroid once it builds through the bridge
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
- [ ] [#55](https://github.com/rnaud/hiraeth/issues/55) The Android player's script thread and sound thread (BridgeRunner runs the script, and the sound's renderer,
  on threads of their own since 2026-10-07; checked on macOS only, no device): run it there once a device is free
  (`-js-main`, `-audio-js` if they fail). (2026-10-07, the Retroid: both started on their own threads and the game ran, "the script on its
  own thread", "the sound on its own thread (24000 Hz)", the audio replay's node counts steady over 6 minutes;
  their frame times wait for the bench run above.)
- [ ] [#56](https://github.com/rnaud/hiraeth/issues/56) Connect an MCP client to the editor. **Blocked**: an organization policy blocks registering
  unknown MCP servers (the configured UnityMCP server also fails to connect). The editor is driven in
  batch mode instead (`scripts/unity-export/unity-batch.sh`).
