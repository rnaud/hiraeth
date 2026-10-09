# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

# Visuals and controller menus (October 2026)

- [ ] Redo the character's face to match the references more closely and feel less cartoony / anime.
  Pay particular attention to the eyes as a possible cause of the style mismatch.

# Selected characters, currency, ship and sword (2026-10-09)

User-approved Midjourney originals and provenance are indexed in
`references/batches/2026-10-09-selected-family-currency-ship-sword.json`.
Use the selected single-view designs as the source of truth; derive further views from them
rather than mixing the earlier inconsistent exploration sheets.

- [ ] Extend the generated father beyond the recording bust for full-body walking and clothing motion; the procedural family is integrated (see DONE.md).
- [ ] **The angular ship in the Unity port**: the web game's ship is the angular hull (DONE.md, docs/systems/ship.md)
  and the export writes its mesh, its new interaction points (`threshold`, `aboard`, `tableFoot`, `wakeRoom`) and its
  extents (`shipOut.hull`), but `unity/Memento/Assets/Runtime/ShipScene.cs` and `ShipTravel.cs` still place their
  cameras, the step-out point and the smoke for the ball (`Polar(9.0, HATCH_A, DECK)`, `R * 0.6`, the call camera at
  `(-1.3, DECK + 1.95, -4.8)`, three thrusters in `WorldsTests.cs`). Re-derive them from the exported points (as
  `src/ship/cinematics.js` `cockpitFrame` does) and regenerate the export.
- [ ] **Ilen's house is "the top half of her own round ship"** (`src/levels/lantern.js`, the Lantern): the family's
  ship is angular now. Is hers still a round ship of her own (her line "I know that hull… paint the stripe" still
  reads), or should her house be a piece of an angular hull? Author's call.

# Singing light soundtrack follow-up

- [ ] **Generate the singing light theme with Suno** using the brief in
  `docs/systems/audio.md` ("The singing light's theme") and install the selected recording
  in the existing `singing-light` cue slot. The synthesised motif, restaged opening,
  voicemail, Qanat repayment, signature search and rumble are implemented (DONE.md).

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

# Enemy roster (approved 2026-10-09: 21 archetypes; framework and batch 1 built, v1.8)

docs/design/enemy-roster.md ("Status": each archetype's), docs/systems/foes.md "The enemy roster". Done: the
framework (src/enemies/archetypes.js, skins.js, plans/; src/foe-worlds.js WORLDS wired into packs, guards, the
Arena and the gallery; the 100 world enemies and the glass splinter retired) and batch 1 (the shellback crab, the horn
lizard, the antler hound, the lamp tripod, the ink blot), scored in docs/audits/combat-v1.8.md.

- [ ] **Fresh reference sheets**: run the 21 Midjourney prompts in docs/design/enemy-roster-prompts.md (one
  main sheet per archetype in its first world's skin, plus one alternate skin), save each to
  `references/enemy-archetypes/<id>/sheet-N.jpg` with a `manifest.json`, pick by silhouette first, then rebuild the
  contact sheet.
- [ ] **Art match pending its sheet** (batch 1, once each sheet is picked): the shellback crab, the horn lizard, the
  antler hound, the lamp tripod, the ink blot were built from the doc's descriptions and the old references; match
  each body and its skins to its own sheet, then set `art` in src/enemies/archetypes.js.
- [ ] **Batch 2** (kit phase 4, chains): the mound worm, the sky ray, the signal moth, the ring centipede, the lantern
  jelly; the Desert, Vael and Vael II then run fully on the new roster.
- [ ] **Batch 3**: the bellows toad, the stilt heron (`StiltMotor` generalised), the skitter swarm (mid tier), the root
  knot (FABRIK arms); Lorn, Lorn II and Viridel follow.
- [ ] **Batch 4** (the doc's step 6): the ring drone, the crucible cart (tracks), the furnace brute, the bell walker,
  each with its possession effect.
- [ ] **Batch 5** (the doc's step 7): the shade rework (feint, shadow step), the pearl roller, the marionette (strings,
  a host's `possessed` state).
- [ ] **Batch 6** (the doc's step 8): balance and sound: the pack budgets per world played through, the hurt/burst
  sound families (`sound` per archetype), re-scored with the combat-review skill; retire each old kind as its
  archetype lands (src/foe-kinds.js says which stands in for which).
- [ ] The placed ones (`placed` in src/foe-worlds.js): the Desert's cistern pump (a lamp tripod by the deep cistern),
  Lorn II's wood cutter (a furnace brute), the Garden's glass puppet (a marionette): a spot each in their worlds.
- [ ] Play the horn lizards' pair with a pad (combat-v1.8 rec. 1): the flanker's circle and its hiss read before the
  bite? The blare's shove toward the partner fair? The antler hound's threat on a still player is the highest (4.6
  bars a minute, rec. 2): lengthen its `cool` if the playtest agrees.

# Combat review (docs/audits/combat-v1.4.md, 2026-10-09)

- [ ] The full charged cut kills 11 of the 15 kinds fastest of any move: give the light combo, the air cut and the
  dash cut a reason (a staggering third swing, heavy foes resisting an uncharged release, a longer full charge).
- [ ] A hurt and a burst sound per kind: src/audio.js `foeHurt` / `foeBurst` have two sets (the machine's and the
  ink's) for the whole roster; glass, shell, paper, roots, slag and shadow each want their own.
- [ ] The route's difficulty falls at the end: the Garden of Spheres and the Signal Market field the softest kinds (the
  sign moth: 1.0 bar a minute, one blow). Bring a late kind or a mixed lead to them.
- [ ] The shade (one cut, 3.75 bars a minute on a still player in v1.6, only the blade answers it) wants a second
  attack and another answer. (The hound's pounce is 0.8 s now: v1.6.)
- [ ] A shot that does nothing (machine, ray, golem, drone, crab, hound) should say so: a glance spark and the armour's
  thunk.
- [ ] The combat-review script: frame each kind side-on for the contact sheet; drive guard, parry and evade timing
  against each attack; batch and group the report when the larger roster lands.

# Combat review (docs/audits/combat-v1.6.md, 2026-10-09)

- [ ] Play the eleven guardians' new fights in their temples with a pad and tune by hand: the combo starters' 1.0 s,
  the miss-openings' lengths, the shock rings' 9 m/s against the jump.
- [ ] The hearts (v1.5) made every kind about a third more dangerous to a still player (an ordinary blow is a sixth
  of a fresh bar): the swarm's, the splinter's and the crab's fairness fell a point; look at them or at `DAMAGE.blow`.
- [ ] A miss-opening for the Lampless, the Elder and the Cloud-Mother (a dive that misses could wedge them as the
  Keeper's stamp does), and a shock ring for the Lampless's dust (its space scores 3).


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

- [x] **1. Kit core** (1 session): `spring.js` (second-order f/ζ/r with the stability clamp, expDamp,
  quantise), `ik.js` (two-bone with a stable pole, replacing `kneeOf`; FABRIK for 3+ joints), `gait.js`
  (rest targets, groups that lift only when the others are down, distance/time/turn triggers, smootherstep +
  sine arc, one ground ray per step, touchdown events for dust / sound / rumble). Tests: IK clamp and pole
  through a straight leg, springs stable at 10–240 fps, a planted foot never moves, tripod and tetrapod form.
- [x] **2. Body and poses** (1 session): `body.js` (ride height over planted feet, pitch/roll from the foot
  plane, bob per lift, lean into acceleration and turns), `pose.js` (a plan's key poses blended by the mind's
  state; wind-up locks stepping, plants wide, counter-moves via r < 0; strike snaps with overshoot; recover
  settles). Ties into the body telegraphs.
- [x] **3. First three plans end to end** (1–2 sessions): multi-legged walker, quadruped beast, piston-legged
  machine in the enemies viewer and the Arena; targets slide/m < 0.05, reach span > 15 % of leg length, lift
  ≥ 6 %, right groups, cadence following speed; before/after motion strips for the changelog. Done
  (procedural-animation.md §6): the salt crab and the six-legged world enemies, the shadow hound and the newts,
  the makers' machine and the possessed machines; every target met (tests/motion-plans.test.js).
- [ ] **4. Chains** (1 session): `chain.js` (follow-the-leader with angle limits, short verlet with a pinned
  root, travelling waves on a phase accumulator) for serpents, centipedes, jellies, flyers, gliders, and
  tails / cloaks / cables on the plans above.
- [ ] **5. The rest of the roster** (2–3 sessions, with the new archetypes: docs/design/enemy-roster.md, awaiting approval): each body plan a table entry and
  its poses, scored with the rubric (≥ 2 on every row).
- [ ] **6. Guardians** (1–2 sessions): keeper, gardener, foreman, sentinel, First Sign onto the kit (IK legs,
  bodies from feet); whale, moth, Elder, echo onto waves with lag; the Snapper's neck on FABRIK; key poses for
  each fight's new attacks.
- [ ] **7. LOD and style** (1 session): the tiers (held 30 frames) and the stepped clock are built in
  `src/motion-kit/rig.js`; left: on-screen as well as distance, a far tier that skips drawing the legs, the
  stepped clock (12–15 fps per foe) turned on per plan; measure on the Retroid (≤ 1 ms with 10 foes near, 30 far); re-run
  the motion check for ink shimmer.

# Level design (audit) (docs/audits/level-design-v1.5.md, 2026-10-09)

Ranked worst first; each re-runs `node scripts/level-design/audit.mjs --worlds <id>` (skill: level-design-qc).

- [ ] **Every way home passes something new** (10 of 11 worlds walk back to the ship past nothing new): bring the
  last stage nearer the ship, or another way back past an optional place, or the temple's change as the reason.
  Loops +1-2.
- [ ] **A weenie on every main-quest leg** (6 worlds guide under half their long legs; the drone does it): a tall,
  unique, lit silhouette in sight from each leg's start, or a leading line. Wayfinding +1-2.
- [ ] **Desert: the Hearth ride** (1.55 km, nothing within 40 m, (71, −12) → (1568, −417)): a camp with a person,
  a salt-bloom field, a wreck; and a different way back by the canyon or the observatory. Density 2→4, loops 1→3.
- [ ] **Desert: landing → Qanat is blind** (391 m): smoke over the camps or the dark tree's crown in the landing's
  sightline; the dry channel as a leading line to the Givers' House; Oum nearer the path. Wayfinding 2→3.
- [ ] **Vael: frame the quest by the tower** (legs 20 % guided): Oïa's stone on the landing–tower line, menhirs to
  the Aerie; the trial, the hand or the remote box on the 445 m plain. Wayfinding 1→3, density 3→4.
- [ ] **City-Shaft: a stop on each 470-560 m drop**, a "go"/"do" between the three talks in a row, lamps down
  each terrace's stair. Density 2→3, pacing +1.
- [ ] **Sky Stones: Ondine onto the clapper's return arc** (490 m from anything), a lit marker at the clapper.
  Loops 2→4.
- [ ] **Lorn II: lamp-lit stakes** to the light across the water and Hollin's cave; a place by the landing.
  Wayfinding 2→4.
- [ ] **Pull the remote loners into 30-150 m of the path**: Oum, Ondine, Vael's box, Perrine, Wren, Gaspard, the
  pyramid seed, Emrys. Optional pull +1.
- [ ] **One high place per flat world** (Lorn 8 m, Lorn II 17 m, Spheres 25 m of height): a climbable viewpoint
  with a box. Verticality +1-2.
- [ ] Smaller: the Signal Market's tower seen down two more avenues and a second way back from Madame Sel's; Lorn's
  Crystal ↔ Saba ping-pong merged; a weenie in each of the Hangar's far zones; answering spheres along the Garden's
  572 m blind leg; a pipe leading to the Buried Machine's wheel. See the report.

# Temple design (audit) (docs/audits/temple-design-v1.5.md, 2026-10-09; docs/audits/temple-design-v1.8.md: the three worst reworked)

All eleven are one chain with every key beside its lock (mean obviousness 4.25-5 of 5, no step combines the gadget
with an older verb). Ranked; each re-runs `node scripts/temple-design/audit.mjs` and keeps tests/temples.test.js
passing (skill: temple-design-qc). The fights themselves: done in v1.6 (DONE.md, "Combat telegraphs").

- [ ] **A twist room in every temple** after the gadget's test: the gadget plus the temple's pre-gadget verb in one
  lock (keys of two kinds). Combination 1→3, teach→test→twist 3→4.
- [ ] **One key per temple out of its lock's room**, in sight from it but reached from elsewhere (a shortcut that
  opens from the far side, a disc mid-ride). Decoupling 1→3, structure 1→2.
- [ ] **No gadget door beside the chest**: the chest room's way out teaches the gadget somewhere failure is cheap;
  its next use a room later. Non-obvious +1.
- [ ] **Break the shared opening** (push the ball, ride the disc in 7-9 of 11; the Belfry = the Undertower and the
  Garage = the Engine-House, 100 %): each first room from its world's own idea. Identity → 3-4.
- [x] **Founders' Belfry (1.44 → 4.00, v1.8)**: held bells (the Bell Chamber's door, the Hall of Echoes' stones
  only while it rings), the ball rolled across the held stones holds them (bell + push), the Hall of Stones a hub
  with `d1`'s balls in two stores, a high door whose eye is under the landing. Left: its opening (balls and a
  disc); the Cloud-Mother's falling stone (a guardian change, with the foes batch).
- [x] **Hush-House (1.67 → 3.44, v1.8)**: the first crystal in the Threshold; the root-wall's door and its eye seen
  from the disc; the far door wants the pendulums stilled in turn (stilling + order). Left: a shortcut or a
  reversible state; `d2`'s jaws stilled from the passing disc; the Mother stilled through the order.
- [x] **Lamp-House (1.67 → 3.11, v1.8)**: the third pool on a loft hidden by its edge; the pool-orb, lit by the
  lantern and rolled into the niche (lantern + push). Left: a lock before the chest (the chest at 25 %); `s4` on
  the near side; the Lampless lured to pools lit earlier.
- [ ] **Undertower (1.67)**: `br1` stands only while the high note is held, so the one-note rule bites twice (a
  catch, then a second high stone); teach the stones before the shell.
- [ ] **First Garage (1.78)**: `k2`'s six eyes in the clock's order from the hour it stopped (the clue over the
  outside door); the ball pushed twice in a breath onto the swinging disc.
- [ ] **Greenhouse (1.89)**: `seed1` on the far side, seen after a vine grows; `seed2` a seed-ball rolled into the
  light before it blooms; the Gardener's back reached by a vine grown mid-fight.
- [ ] **Aerie, Warden's Well, Engine-House, Footprint, Givers' House (1.89-2.11)**: shots carried by gusts; a ball
  that switches the updraft on; jets against a gust in the Lamp Gallery; `s1` seen only mid-ride; `k2` on pistons
  in turn; false lens stones with the clue a room back; a burning tar ball pushed into `b3`; `b2` a room back. See
  the report for each.
- [ ] **The guardian's last phase asks for the twist**: the staged fights are in (v1.6: three phases, body tells,
  docs/systems/foes.md "The guardians' staged fights"); the last phase still asks for the temple's one verb, not the
  twist room's combination. Guardian exam 2→3-4.

# Fun and story (docs/fun-and-story-review.md, October 2026)

Ranked; each says why in the review. Playtest with two or three new players before building the big ones.

- [ ] **A fellow traveller who recurs**, three or four meetings along the route, each changed by the last.
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

- [ ] **The water's contact foam in Unity** (docs/systems/water.md, "Contact foam"): the web's water draws a band
  of little waves round whatever stands in it from the scene's depth behind it (`contactFoam` in
  `src/water-shader.js`, the passes in `Waters.renderGBuffer`). The Unity twin of the water look
  (`unity/Memento/Assets/Memento/Shaders/Surface.shader` `waterLook`) has the shore foam from the bed map only:
  mirror it with `_CameraDepthTexture` (the water drawn after the opaques, writing no depth), the same `CONTACT`
  numbers, and the band's distance as there (the run through the water over its `fwidth`, clamped).

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
