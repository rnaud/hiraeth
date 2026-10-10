# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

Playtests are not listed here: the author plays all the time.

# The author's list (2026-10-10), before the full game audit

## Worlds

Never delete a temple or a character: a dismissed world moves whole to a dismissed-levels folder
(`src/levels/dismissed/`), out of the route and the Debug menu's worlds, so its pieces can be reused elsewhere.

- [ ] **Promote the Moon Foundry** to a world on the route.
- [ ] **Promote the city in space and the city underwater**; redesign the underwater one so you are never outside swimming.
- [ ] **The train level moves**: a moving train, not a station, and a sub-level reached by a quest from another world.
- [ ] **References for a fire-and-ice world** (both at once), in the reference lab.
- [ ] **A Star Fox-style space level**: the ship fights space pirates ("They are after your chimes!"); it plays as the
  passage the first time you fly from the ship to a new destination.

- [ ] **The merged worlds' follow-ups** (v1.39 level-design audit: Vael 4.56 → 3.89, Lorn 4.44 → 3.89, Glass Dunes 3.22):
  the long empty walks back (Vael's 760 m from the monastery to the clapper), a weenie and a reason to cross each join;
  the Glass Dunes' spread of places and height. Can the sky stones be reached on foot from Vael's plain? Frame rate of
  the bigger terrains on Android.
- [ ] **Story loose ends from the merge**: the Buried Machine's lines about the Major and the Hangar; Fen's "the skiff
  is his" (you use your own now); Vael II's and Lorn II's stories no longer close a journal page; recordings 10 and 11
  never play (the reel words bell, lamp, why unused); the ending's world data covers 6 of the 9 places.

## Traversal and gadgets

- [ ] **The City-Shaft's air pillars**: columns of rising air to carry you back up with the wings; inside an air shaft
  you only rise, no forward drift.
  (Until they land, the Warden's Well's chest holds the Warden's harness, jets that fire in the City-Shaft only, v1.38:
  with the pillars in, the harness can go and the shaft's way up be the wings.)
- [ ] **The jets' trials outside the City-Shaft** (the Glass Dunes' Glass slalom, the Buried Machine's Canyon dive, the
  Signal Market's Avenue run): since the jets became a debug item (v1.38) they want the debug jets, so their rewards
  (the strong lodestone, the fourth pouch, the racer's ribbon) can't be won in play. Give each another mode. (The
  Hangar's Pillar slalom is out of play with the Hangar, dismissed in v1.39; its lodestone went to the Glass slalom.)

## Look

- [ ] **Redesign the chests** from new references: they are boring.
- [ ] **Most world characters a little less colourful**, so the quest and main characters stand out.
- [ ] **The title screen**: it hangs on load and ignores the buttons. Make it very light, then a quality pass against its
  references.

## Combat, more like Breath of the Wild

- [ ] **A subtler, more elegant lock-on reticle.**
- [ ] **Locked on: back + jump does a back flip**; timed right against an attack it slows time for a few free hits.
- [ ] **Locked on: left or right + jump does a side hop.**
- [ ] **A defeated foe vanishes in a little puff of smoke** a second or so after its defeat animation.

## Temples

- [ ] **Redo the temples with less linear paths** (2026-10-10): several rooms with puzzles of different complexity,
  keys found in one room that open others, rooms that close behind you and hold a small arena challenge to reopen,
  and so on: a temple you explore, not a corridor of rooms in order. Keep every temple and guardian (reuse their
  rooms and kits); use the temple-design-qc skill to score the result.

## Camera and animation

- [ ] **A camera skill** (`.claude/skills/`) that checks the camera behaves: e.g. on the train, walking makes it jump about.
- [ ] **Finish motion matching**, with a quality-control pass.

## Tools and releases

- [ ] **A Midjourney CLI that uses the author's session cookies** (kept in `.env`, never printed or committed), for the
  reference lab.
- [ ] **Failed releases visible on the commit**: the v1.35 Android release failed (HTTP 403 creating the release, run
  38046378533; no v1.35 release exists, v1.36 and v1.37 went out) and the Unity testers' release failed in its cache
  prune step (run 38042662102). Retry the release creation, fix the prune, and mark the tested commit red when a release
  fails.

# Selected characters, currency, ship and sword (2026-10-09)

User-approved Midjourney originals and provenance are indexed in
`references/batches/2026-10-09-selected-family-currency-ship-sword.json`.
Use the selected single-view designs as the source of truth; derive further views from them
rather than mixing the earlier inconsistent exploration sheets.

- [ ] Extend the generated father beyond the recording bust for full-body walking and clothing motion; the procedural family is integrated (see DONE.md).
# Singing light soundtrack follow-up

- [ ] **Generate the singing light theme with Suno** using the brief in
  `docs/systems/audio.md` ("The singing light's theme") and install the selected recording
  in the existing `singing-light` cue slot. The synthesised motif, restaged opening,
  voicemail, Qanat repayment, signature search and rumble are implemented (DONE.md).

# Visual probes (docs/audits/visual-v1.21.md, 2026-10-10; v1.4's done: DONE.md)

- [ ] Small pale notches still left at a corner's foot beside a person (300-600 px, Handheld) and Marrow's wide hem
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

- [ ] Batch 3 against its sheets (docs/design/enemy-roster.md "Status"; the jug's ochre marks done in v1.26): the
  skitters' curved bony legs (the kit's leg segments are straight cylinders: a bowed shin needs the segment's own bend
  plane); the heron flying off when you run at it (it strides away now); the toad's swollen sac see-through, the glob
  inside it (no see-through surface yet).
- [ ] Measure the machines' CPU on the Retroid and the Deck (combat-v1.16 rec. 3: +0.25 ms a machine in headless Chrome,
  a pack of six 2.5 → 4.0 ms): the cart's ground rays every other frame and its wheels' instance upload first (a far cart
  could skip both).
- [ ] Batch 4 against its sheets (docs/design/enemy-roster.md "Status"; v1.26 draped the cart's canvas, toothed its
  sprockets and wound its smoke, plated the brute's fingers and met its fists over its head, banded the bell's yoke):
  the brute's crack net lighter; the bell's spirit seen from above, its legs' plating; the drone's cloud spreading in
  wisps at its sides.
- [ ] The combat-review script (combat-v1.18 rec. 4): drive the marionette with a host and time freeing it (strings cut)
  as well as killing it; the roller's shot and ember times assume it unrolled (rolling, they glance).
- [ ] Batch 5 against its sheets (docs/design/enemy-roster.md "Status"; v1.26 hung the shade's cloak as a drape in
  folds and poured the marionette's knot down in a funnel): the shade's smoke in flame-like curls (tried as curling
  tubes in v1.26: they read as a white-lined fence, kept the wisps); the roller's spiral on one side only and sheet-2's
  rocking runners in its wind-up, a glistening trail where it grazes; the marionette's glass see-through.
- [ ] The still traveller's measure under-reads a big pack (combat-v1.22): two or three strikers at a time, and off the
  screen one waits while another strikes, so a pack of five presses about as hard as two. Drive the review's still
  player with the lock-on camera turning to each striker, or time a scripted player clearing the pack, before tuning the
  late worlds further by numbers.

# Combat review (docs/audits/combat-v1.4.md, 2026-10-09)

- [ ] The dash cut is the best answer nowhere (combat-v1.22: 1.5 s a blow by its cooldown; the air cut, the combo and the
  charged cut now each lead somewhere): a dash cut through a foe's back could land double, or its cooldown shorten.
- [ ] The combat-review script: drive guard, parry and evade timing against each attack; batch and group the report
  when the larger roster lands (each kind is framed side-on for the contact sheet since v1.26).

# Playtest notes (2026-10-08)

## Shadows and visuals

- [ ] The Golden Dunes entrance looks stuck, though it works. (v1.9: one more candidate fixed, the doorway in the sand
  before the masked head, south of the landing: its flat dark panel in a stone frame read as a shut door; it is a short
  passage into the dark now, src/interiors.js doorwayPortals. Check whether that was the one.) (Unclear which entrance: no door or gate in
  the golden dunes animates. Candidates looked at on 9 October: the Givers' House doorway (a flat dark
  panel with two darker leaves, reads as a shut door; it is in the Rose Canyons though), the ship's ramp,
  the giant's mouth, the region-name caption. Say which one, or what "stuck" looked like.)
- [ ] **Ink lines, what the v1.33 audit left** (docs/audits/ink-lines-v1.33.md, `.claude/skills/ink-lines`): Edena's
  flowers 55 m off are still 34-41 % ink (their heads' outlines; the rubric's far cap is 30 %): a lighter line in their
  own colour for the meadow flowers (`line` / `lineTint`, as the `leaves` foliage) would take the rest but changes them
  close up — for the author to say. The far town shimmers half a pixel over (Qanat at 150 m, 0.44 of its ink, 12-14 %
  pops, before and after): check it in motion (scripts/motion-check, the zoom path) and look at the haze layers and
  the wobble on thin far shapes.

# Xbox (queued 2026-10-09)

- [ ] **An Xbox Dev Mode package** — built, waiting for the console (docs/systems/xbox.md). Done: the UWP app
  (`xbox/`: WebView2 at https://hiraeth.example, the packaged game as the fallback, the site's web bundles over the
  air with `minXbox`, the boot watch, Back kept, pause when away, no mouse mode, the update section), the game side
  (`src/xbox.js`: the Xbox prompts, the Xbox preset, the TV's safe area, XBOX and a JIT probe on the frame readout),
  the workflow (`xbox.yml` → the prerelease `xbox`), `scripts/xbox-cert.sh`. Needs: the first Windows run (the runner's
  UWP tools), the signing secrets (`scripts/xbox-cert.sh`), then on the console: Dev Mode, deploy, set to Game, and the
  first-run checklist (frame readout, JIT, GPU share App vs Game, controller, memory). The decision, kept:
  (decided 2026-10-09: the packaged web game, not the Unity build): the web
  game in a UWP app with WebView2 (like the Android app's wrapper: the same web bundle and over-the-air
  updates), x64, set to the **Game** app type after deploying (Dev Home / Device Portal: ~5 GB and the full
  GPU instead of an App's 1 GB and 45 %), built on GitHub (a Windows runner) and published to a prerelease;
  the author deploys it through Device Portal (Dev Mode: a Partner Center individual account, the green
  "Xbox Dev Mode" app). First measure on the console with the frame readout: JavaScript's JIT on inside
  WebView2, the Game-mode GPU share reaching the WebView, the controller (WebView2's gamepad bug is
  desktop-only by reports: WebView2Feedback#4366). Why not Unity: Puerts has no UWP/Xbox V8 (it would need a
  V8 port or QuickJS without a JIT, several times slower on a frame the script limits), for at most ~0.9 ms
  of gain measured on the Mac (docs/systems/engine-bridge.md).

# Procedural animation (2026-10-09; phases 1–3 done: the kit is `src/motion-kit/`)

The foes walk like toys on sticks: rigid legs swung by a shared clock, feet sliding 0.3–1.4 m per metre walked,
six-legged crabs waddling all-left / all-right, bodies that ignore their feet (measured:
docs/systems/procedural-animation.md, "The audit"). Build a small locomotion kit (`src/motion-kit/`) and move the
new ~20 body plans and the guardians onto it. Review every step with the `procedural-animation` skill
(`node scripts/motion-audit/run.mjs`, the rubric). Sessions are rough estimates.

# Level design (audit) (docs/audits/level-design-v1.5.md, v1.9, v1.15, v1.17, v1.20, v1.23: 2026-10-10)

Ranked worst first; each re-runs `node scripts/level-design/audit.mjs --worlds <id>` (skill: level-design-qc).

Left from v1.23 (docs/audits/level-design-v1.23.md, "The ranked edits that remain"), worst first:
- [ ] **The desert's two long blind legs**: the well → Marrow (441 m) and Marrow's hollow → the Hearth (1.6 km), and its
  first goal 391 m off the landing. Wayfinding 4 → 5, onboarding 3 → 4.
- [ ] **Verticality 2 in Lorn, the Hangar and the Garden**: a stage or a box up high, or a path that climbs. +1 each.
- [ ] **A weenie in each of the Hangar's far zones** (the ring, the upside-down quarter): landmarks 3 → 4.
- [ ] **The Buried Machine's oculus → the wheel** (351 m, blind): an oil pipe from the valve would run beside the Tooth
  Day posts, and the world sits at the contact audit's line (climbs inside 42 of 43); or the audit counts a canyon.
- [ ] **Overhead goals as seen, in the audit**: Vael's window → the tower's foot, the City-Shaft's palace legs.
- [ ] Smaller: Lorn's Great Crystal ↔ Saba ping-pong merged (saves at each stage must still work); the Signal Market's
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

- [ ] A second makers' run in a world, from what is left of its temple's kit (docs/systems/challenges.md, "Next"):
  Viridel's greenhouse glass (a vine up an unclimbable pane: `noClimb` colliders in the stand-in), the Hangar's
  eye banks on pistons in turn, the Lamp-House's pool-orb rolled to a lamp.
- [ ] The gameplay loop: the fluid blade and the foes are in (v0.87, docs/systems/foes.md; try them in the
  Arena), and the blade's attacks are all captured swings (the combo, the guard, the whirl, the lunge, and in
  v1.3 the charged cut and the air cut from the Great Sword pack, in v1.4 the riposte after a perfect parry and
  the dash cut out of an evade from the Sword and Shield pack, on their clips' own swing frames: DONE.md).
  In v1.4 foes use the world's height (they climb, hop down and hold off; the spitter takes the high ground;
  knocked off a ledge they lie dazed; a stilled temple crystal's frost holds them, and knocked into deep water
  they are swept away: DONE.md). Next: a better machine.

# Carried over

## Animation

- [ ] Capture starts, stops and turns at the game's actual speeds so feet follow the motion.
  The completed motion-matching evaluation is recorded in DONE.md.

## Dialogue

- [ ] Recheck the blank portrait reported in the Retroid's Chrome (not reproduced in GeckoView).
  Compare portraits, Sketchbook captures and item pictures on the device; use
  `scripts/portrait-check.mjs` and the existing initial-letter fallback to distinguish blank GPU
  captures from framing problems. GeckoView verification and diagnostic history are in DONE.md.

## Android

- [ ] On the next Retroid session, re-measure the camps and City-Shaft with the shirt on the GPU
  (expected ~0.3 ms instead of 2.4); use the GeckoView test app, not the player's installed app.
  Completed load, rendering, portrait and cab checks are recorded in DONE.md.

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

- [ ] **See the Unity port's angular ship and the water's contact foam run** (both written 2026-10-10 and checked only
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
- [ ] The Android player's script thread and sound thread (BridgeRunner runs the script, and the sound's renderer,
  on threads of their own since 2026-10-07; checked on macOS only, no device): run it there once a device is free
  (`-js-main`, `-audio-js` if they fail). (2026-10-07, the Retroid: both started on their own threads and the game ran, "the script on its
  own thread", "the sound on its own thread (24000 Hz)", the audio replay's node counts steady over 6 minutes;
  their frame times wait for the bench run above.)
- [ ] Connect an MCP client to the editor. **Blocked**: an organization policy blocks registering
  unknown MCP servers (the configured UnityMCP server also fails to connect). The editor is driven in
  batch mode instead (`scripts/unity-export/unity-batch.sh`).
