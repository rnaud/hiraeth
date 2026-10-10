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
  Since the rooms were laid out as the picked reference-lab sheet (docs/systems/ship.md, "The picked layout"),
  `shipOut.points` moved: `cockpit` (where he stands for the voicemail) is now behind the console's tail amidships
  at (0.28, 0, 0.15), still facing forward; `projector` and `voicemail` are on the console (z -1.1 / -0.8), not the
  dash; `table`/`tableFoot` at (0.2, -3.1); the bunk is in the main room's starboard alcove (`bunkStand`, `wakeEye`,
  `wakeLook`, `wakeRoom`) and there is a new `wakeSit` (sitting up, inside the alcove); `aboard` is (-1.4, 0, 0.45);
  `seat` is the left of two seats. The Unity scene's call camera and wake-up need re-deriving from these.
# Singing light soundtrack follow-up

- [ ] **Generate the singing light theme with Suno** using the brief in
  `docs/systems/audio.md` ("The singing light's theme") and install the selected recording
  in the existing `singing-light` cue slot. The synthesised motif, restaged opening,
  voicemail, Qanat repayment, signature search and rumble are implemented (DONE.md).

# Visual probes (docs/audits/visual-v1.4.md, 2026-10-09)

- [ ] world.js `jitter`'s `vertical` noise lifts a foot ring as well as lowers it (no world uses it yet:
  tests/shell-seams.test.js fails the day one does): keep y = 0 going down only, as `rough` does, before using it.

# Enemy roster (approved 2026-10-09: 21 archetypes; framework and batches 1 (v1.8), 2 (v1.9), 3 (v1.13) and 4 (v1.16) built)

docs/design/enemy-roster.md ("Status": each archetype's), docs/systems/foes.md "The enemy roster". Done: the
framework, batch 1 (the shellback crab, the horn lizard, the antler hound, the lamp tripod, the ink blot; scored in
docs/audits/combat-v1.8.md), batch 2 (the mound worm, the sky ray, the signal moth, the ring centipede, the lantern
jelly, on the kit's chains; scored in docs/audits/combat-v1.9.md), batch 3 (the bellows toad, the stilt heron, the
skitter swarm, the root knot, drawn to both their sheets; scored in docs/audits/combat-v1.13.md) and batch 4 (the
furnace brute, the ring drone, the crucible cart, the bell walker, drawn to both their sheets; scored in
docs/audits/combat-v1.16.md) and batch 5 (the shade reworked, the pearl roller, the marionette, drawn to both their
sheets; scored in docs/audits/combat-v1.18.md). All 21 are built: no stand-in is left and every world runs wholly on
the new roster.

- [ ] Rebuild the roster's contact sheet (`node scripts/enemy-roster/sheet.cjs`) from the 21 picked sheets
  (`references/enemy-archetypes/<id>/sheet-1.jpg`) instead of the old reference crops.
- [ ] **Art match pending its sheet** (batch 1): the shellback crab, the horn lizard, the antler hound, the lamp tripod,
  the ink blot were built from the doc's descriptions and the old references; match each body and its skins to its own
  sheet, then set `art: 'sheet-1'` in src/enemies/archetypes.js. Batch 2 is drawn to its sheets; the alternate skins
  (`sheet-2.jpg`) are not used yet by either batch.
- [ ] Play batch 3 with a pad (combat-v1.13 recs. 1 and 4): the heron's 0.9 s spear from 4 m up and 5 m away (1.0 s if
  it reads late); wading through the toad's spores on Lorn's slopes.
- [ ] Batch 3 against its sheets (docs/design/enemy-roster.md "Status"): the jug's ochre marks between its bands; the
  skitters' curved bony legs; the heron flying off when you run at it (it strides away now).
- [ ] Play the ring centipede's ring with a pad in the Buried Machine (combat-v1.9 rec. 1): is the gap readable before
  it closes, does a plain jump clear its back (`RING.over` 0.9 m in src/foes.js), is the 2.3 s wind-up right?
- [ ] A cut on a lantern jelly's thread of light breaks its ward (the doc's counter; combat-v1.9 rec. 2): now only a
  shot, the boomerang or killing the jelly break it. A blade swing crossing the segment from the lantern to the foe.
- [ ] Play the bell walker with a pad (combat-v1.16 rec. 1): is the drop's 2.5 s opening long enough to strike the
  clapper without the whistle, and is a guarded drop found? If the fight drags, open it longer or let a stilling glob
  tip it over.
- [ ] The crucible cart on a still traveller costs 6.26 bars a minute, the most of the roster (combat-v1.16 rec. 2): play
  its pour at close range and its dripped trail in the Hangar's corridors; shorten the slag near it or the trail if it
  reads unfair.
- [ ] Measure the machines' CPU on the Retroid and the Deck (combat-v1.16 rec. 3: +0.25 ms a machine in headless Chrome,
  a pack of six 2.5 → 4.0 ms): the cart's ground rays every other frame and its wheels' instance upload first (a far cart
  could skip both).
- [ ] The combat-review script: a clapper-only foe needs its opening to measure the time to kill (drive the whistle or
  wait for the drop's opening before the blows: combat-v1.16 rec. 4).
- [ ] Batch 4 against its sheets (docs/design/enemy-roster.md "Status"): the cart's canvas sagging in folds over the
  tracks, a toothed sprocket, a billowing smoke column; the brute's crack net lighter, its fingers in plates, its fists
  meeting over its head for the slam; the bell's yoke a flat riveted band, its spirit seen from above; the drone's
  cloud spreading in wisps at its sides.
- [ ] **Batch 6** (the doc's step 8): balance and sound: the pack budgets per world played through, the hurt/burst
  sound families (`sound` per archetype: the roller's rolling rumble and glassy shatter, the marionette's paper and
  strings), re-scored with the combat-review skill. (Every old kind is retired since batch 5.)
- [ ] The placed ones (`PLACED` in src/foe-worlds.js: Lorn II's wood cutter by the lit path, v1.16; the Garden's glass
  puppet by the white archway in the android wood, v1.18): the Desert's cistern pump (a lamp tripod by the deep cistern).
- [ ] Play the shade's feint with a pad (combat-v1.18 rec. 1): is the thrust's parry found after the false cut, or does
  every early guard simply block it? If the feint never pays, a guard held through the false cut is broken by the thrust
  (staggered, not hurt).
- [ ] The pearl roller in a world with walls (combat-v1.18 rec. 2): the Hangar's corridors, the Garden's terraces; does
  the bounce aim fairly at you, does a wall stall read as an opening?
- [ ] The marionette's strings as targets (combat-v1.18 rec. 3): cut them with the air cut from the ground and with the
  boomerang; if the air cut can't reach, lower the cut point or widen it.
- [ ] The combat-review script (combat-v1.18 rec. 4): drive the marionette with a host and time freeing it (strings cut)
  as well as killing it; the roller's shot and ember times assume it unrolled (rolling, they glance).
- [ ] Batch 5 against its sheets (docs/design/enemy-roster.md "Status"): the shade's cloak a soft drape with folds, not a
  flared cone with painted ones, its smoke in flame-like curls; the roller's spiral on one side only and sheet-2's
  rocking runners in its wind-up, a glistening trail where it grazes; the marionette's glass see-through and its knot
  billowing ink, not heaped puffs.
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

- [ ] The Golden Dunes entrance looks stuck, though it works. (v1.9: one more candidate fixed, the doorway in the sand
  before the masked head, south of the landing: its flat dark panel in a stone frame read as a shut door; it is a short
  passage into the dark now, src/interiors.js doorwayPortals. Check whether that was the one.) (Unclear which entrance: no door or gate in
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
- [x] **4. Chains** (1 session): `chain.js` (`PathTrail`, `FollowChain`, `Wave`; `wave-legs.js` for metachronal
  legs) with the roster's batch 2 on them (procedural-animation.md, "Phase 4, the chains"). Left for later: the
  serpent (the Mother Snapper, phase 6) and cloaks / cables on the older plans.
- [ ] **5. The rest of the roster** (2–3 sessions, with the new archetypes: docs/design/enemy-roster.md): each body plan a table entry and
  its poses, scored with the rubric (≥ 2 on every row). Done for batch 3 (procedural-animation.md, "Phase 5": the
  hopper, the stilt, the skitterers, the tentacled; a third segment on FABRIK, a tier floor) and batch 4 ("Phase 5, the
  machines": the brute, the siege machine, tracks, the hovering machine; skinned on the kit's joints) and batch 5 ("Phase
  5, the late spirits and the roller": the humanoid spirit, the roller, the strings): every archetype is on the kit.
- [ ] **6. Guardians** (1–2 sessions): keeper, gardener, foreman, sentinel, First Sign onto the kit (IK legs,
  bodies from feet); whale, moth, Elder, echo onto waves with lag; the Snapper's neck on FABRIK; key poses for
  each fight's new attacks.
- [ ] **7. LOD and style** (1 session): the tiers (held 30 frames) and the stepped clock are built in
  `src/motion-kit/rig.js`; left: on-screen as well as distance, a far tier that skips drawing the legs, the
  stepped clock (12–15 fps per foe) turned on per plan; measure on the Retroid (≤ 1 ms with 10 foes near, 30 far); re-run
  the motion check for ink shimmer.

# Level design (audit) (docs/audits/level-design-v1.5.md, v1.9, v1.15, v1.17, v1.20: 2026-10-09)

Ranked worst first; each re-runs `node scripts/level-design/audit.mjs --worlds <id>` (skill: level-design-qc).

- [x] **Every way home passes something new** (v1.20, docs/audits/level-design-v1.20.md): the Sky Stones' fallen-up
  tiles and lantern stones, Lorn's egg-lamps, Lorn II's water-way, Viridel's runnel, the Hangar's telescope, the Buried
  Machine's Tooth Day posts, the Signal Market's listeners' lane; the audit reads a stage's `home` and `stands`. Loops 5 in
  ten of eleven worlds. Left: the City-Shaft's Tobin → Lio hop.
- [x] **A weenie on every main-quest leg** (v1.20): the bell tower and the island church (the Sky Stones), the cave's
  crown (Lorn), the saucer's beam and the lit path (Lorn II), the Major's mast (the Hangar), the Garden's white paths;
  the average 4.04 → 4.25. Left, blind by the numbers: Lorn's Saba → the cave (a crystal grove in every bearing), the
  Buried Machine's oculus → the wheel (inside the drum), the desert's three, Vael's window → the tower's foot.
- [x] **Desert: the Hearth ride** (v1.9, docs/audits/level-design-v1.9.md): Yara's shade and a skiff's wreck on the
  straight ride out, home along the marked stones past the bowl and the camp. Longest gap 1,552 → 518 m, density 2→4,
  loops 1→2. Left: the wreck → Hearth stretch (518 m); the walk from the tree back to the ship.
- [x] **Desert: landing → Qanat is blind** (v1.9): the camps' smoke over the dune while the tree is cold, the Givers'
  dry channel, Oum on a dune in sight of the way in. Wayfinding 2→3, the desert 2.56 → 3.11.
- [x] **Vael: the plain** (v1.9): Senn and the hush-cloth's box on the capped spire halfway to the tower, standing
  stones up to the Aerie. Vael 2.89 → 3.56. Left: both walks back are still the way you came (Oïa or the last
  stage off the landing–tower line, or the bird's first flight home past the colossus); Oïa from the Aerie's door.
- [x] **City-Shaft** (v1.15, docs/audits/level-design-v1.15.md): the lamplighters' drops (a lamp-post and ring on every
  terrace, a `down` stage between Nima and Ossa), Perrine's stall and relic on the middle landing, the lamplighters'
  locker, a pad and the relay lamp on the climb, Tobin's view pad on the way back down, Wren's marker at its stop.
  Longest gap 564 → 178 m, the City-Shaft 3.56 → 3.89. Left: Fausta's shop by the middle cab stop is now a remote
  loner (a person waiting for a cab, or the drops passing it); the relay lamp alone on the climb; Nima/Lio/Tobin.
- [x] **The audit** (v1.15): leading lines (`level.lines`, a stage's `via`, `auto: false`) guide legs and carry the walk
  along them; the loner rule scales with the travel speed (18 s from anything).
- [x] **A second way home in the desert and Vael** (v1.15): the pilgrims' road of lamp-lit cairns from Qanat's gate to
  the ship, the tusk gate on the Hearth ride; the bird's tracks from the Aerie to Oïa past the mounting stone, the rider's
  roost on the way home from the tower. The desert 3.33 → 3.56, Vael 3.78 → 4.33.
- [x] **Desert: the ride's Yara → wreck stretch and the cave's walk back** (v1.17, docs/audits/level-design-v1.17.md):
  the skiff's anchor between Yara and the wreck; the keepers' stair from the cave up to a hatch in the back lane (an `up`
  stage, a "go" in the ten "do" stops). The desert 3.56 → 3.89 (density 4→5, loops 4→5, pacing 3→4).
- [x] **City-Shaft: the shop by the cab stop, the relay lamp, Nima/Lio/Tobin, the Well → Nima** (v1.17): Basile at the
  cab stop, a second pad past the relay lamp, Tobin pays as you walk up, the lamplighters' rim posts from the Well's door
  to the red stair. The City-Shaft 3.89 → 4.44.
- [x] **Vael: onboarding** (v1.17): the riders' mast over the slope where Oïa points; the route starts with her beside
  the landing. Vael 4.33 → 4.56.
- [ ] **Left from v1.17:** the City-Shaft's Tobin → Lio hop (83 m, nothing new: loops 4); the desert's blind legs (Ama's
  fire to the giant's mouth, the well to Marrow, Marrow's hollow to the Hearth: wayfinding 3) and its first goal 391 m
  off (onboarding 3); both worlds' longest stretches sit at the density band's edge (20 s).
- [x] **Sky Stones: the clapper's return arc** (v1.20: along the fallen-up tiles over the great table; the island
  church's tower as a beacon). Loops 2→5. Left: Ondine, 490 m from anything.
- [x] **Lorn II: lamp-lit stakes** (v1.20: the lit path declared, the saucer's beam a beacon, the water-way home).
  Wayfinding 1→5.
- [ ] **The Signal Market's listeners' lane** (v1.20) has two long empty halves (149 m): a listener sitting under the
  dishes, or a second thing to stop for. Density stays 5; the walk is long.
- [ ] **Pull the remote loners into 30-150 m of the path**: Ondine, Gaspard, the
  pyramid seed, Emrys. Optional pull +1.
- [ ] **One high place per flat world** (Lorn 8 m, Lorn II 17 m, Spheres 25 m of height): a climbable viewpoint
  with a box. Verticality +1-2.
- [ ] Smaller: the Signal Market's tower seen down two more avenues and a second way back from Madame Sel's; Lorn's
  Crystal ↔ Saba ping-pong merged; a weenie in each of the Hangar's far zones; answering spheres along the Garden's
  572 m blind leg; a pipe leading to the Buried Machine's wheel. See the report.

# Temple design (audit) (docs/audits/temple-design-v1.5.md, 2026-10-09; v1.8, v1.12, v1.16, v1.19: the worst reworked, two or three at a time)

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
  disc). (The Cloud-Mother's falling stone: done in v1.15.)
- [x] **Hush-House (1.67 → 3.44, v1.8)**: the first crystal in the Threshold; the root-wall's door and its eye seen
  from the disc; the far door wants the pendulums stilled in turn (stilling + order). Left: a shortcut or a
  reversible state; `d2`'s jaws stilled from the passing disc. (The Mother stilled through the order: v1.15.)
- [x] **Lamp-House (1.67 → 3.11, v1.8)**: the third pool on a loft hidden by its edge; the pool-orb, lit by the
  lantern and rolled into the niche (lantern + push). Left: a lock before the chest (the chest at 25 %); `s4` on
  the near side. (The Lampless lured to pools lit earlier: v1.15.)
- [ ] **Undertower (1.67)**: `br1` stands only while the high note is held, so the one-note rule bites twice (a
  catch, then a second high stone); teach the stones before the shell.
- [ ] **First Garage (1.78)**: `k2`'s six eyes in the clock's order from the hour it stopped (the clue over the
  outside door); the ball pushed twice in a breath onto the swinging disc.
- [x] **Builders' Greenhouse (1.89 → 3.78, v1.16)**: nothing grows in the shade. Louvres a ball's plate turns; the
  eye in the shade (`s1` `when`), one ball and two plates on the Glass Stair (the eye, then the disc), the bud in a
  sunbeam, the seed at the lip lit by the sun-ball's louvre, the seed-ball rolled into the beam at the glass's foot,
  its vine into the bud; the Gardener bloomed only in the sun of its quarter's footstone (docs/audits/temple-design-v1.16.md).
  Left: a loop (structure 2), `d2`'s eye a room back at 1.5 (watch players), a decoy at the chest's bud (`d3` at 5).
- [x] **Aerie (1.89 → 3.78, v1.16)**: one wind, out wherever no stone stops it. The hall's stone pushed through the
  gusts into its vent (the hall calms, the Wind Well's column and raft rise), the column with the wings, the Gulf in
  two legs (a tailwind from the balcony's throat, a column from the perch's), the Elder flown with only in the wind
  of the vent she hangs over. Left: the column step alone (`wings>top`, 5), a loop.
- [ ] **Play the Greenhouse's and the Aerie's new rooms and last phases with a pad** (v1.16): the escort up the Hall of
  Winds (a push or two a calm), the tailwind's leap (as a gust comes), the perch's landing (fold the wings over it),
  the Gardener's footstones in its 6.2 s kneel, the Elder's stone rolled in her 6.6 s hang.
- [x] **Warden's Well (2.00 → 3.89, v1.19)**: the tower breathes through its vanes. The discs on the far door's vane,
  the Climb's slot on the well's vane, the gallery's lidded eye on the great vane (hover on the jets), the loft's ball
  pushed over the gap from the air, the crown's eye on two vanes at once; the warden's hatch opens only to a turning
  vane's draught (docs/audits/temple-design-v1.19.md). Left: a hub off the gallery, the opening at 4.5.
- [x] **Engine-House (2.11 → 4.00, v1.19)**: a ball in the teeth stops the engine there. The ball rolled out of the
  pistons' crank, the gantry's ball into the hammer's, one crank holding the chamber's four piston-eyes up, two of the
  Furnace's four jammed and the other two caught in turn; the Tooth-Warden on its jammed gear. Left: a shortcut back,
  the gadget a third time.
- [ ] **Footprint, Givers' House (2.22, 2.11)**: false lens stones with the clue a room back; a burning tar ball pushed
  into `b3`; `b2` a room back. See the report for each (docs/audits/temple-design-v1.19.md, ranked).
- [ ] **Play the Warden's Well's and the Engine-House's new rooms and last phases with a pad** (v1.19): the Turning
  Floors' one splash (15 s), the hover-and-aim over a great vane, the shelf's ball pushed from the air, the crown's two
  vanes (12 s), the warden's 7 s hatch; the hammer's stroke, the Furnace's piston tops (1.2 s each, 2 s apart), the
  Tooth-Warden's gear rolled in its last phase.
- [ ] **Play the five reworked guardians' last phases with a pad** (v1.15, docs/systems/foes.md "The guardians' last
  phases"): is ringing as the Cloud-Mother rises to dive (78 % of her wind-up at most) readable, is the Lampless's
  "stand back" (5 m) fair under its scales, are the Mother Snapper's crystals easy enough to tell apart by size from
  the floor, can the First Sign's low dishes be reached in its 4.4 s opening (or is waiting by one the read), do six
  numerals from four fit the Foreman's 5.6 s opening with the coil. The other six guardians' last phases still ask
  only for their temple's one verb.

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
