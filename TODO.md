# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

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

- [ ] Play batch 3 with a pad (combat-v1.13 recs. 1 and 4): the heron's 0.9 s spear from 4 m up and 5 m away (1.0 s if
  it reads late); wading through the toad's spores on Lorn's slopes.
- [ ] Batch 3 against its sheets (docs/design/enemy-roster.md "Status"; the jug's ochre marks done in v1.26): the
  skitters' curved bony legs (the kit's leg segments are straight cylinders: a bowed shin needs the segment's own bend
  plane); the heron flying off when you run at it (it strides away now); the toad's swollen sac see-through, the glob
  inside it (no see-through surface yet).
- [ ] Play the ring centipede's ring with a pad in the Buried Machine (combat-v1.9 rec. 1): is the gap readable before
  it closes, does a plain jump clear its back (`RING.over` 0.9 m in src/foes.js), is the 2.3 s wind-up right?
- [ ] Play the bell walker with a pad (combat-v1.16 rec. 1): is the drop's 2.5 s opening long enough to strike the
  clapper without the whistle, and is a guarded drop found? If the fight drags, open it longer or let a stilling glob
  tip it over.
- [ ] Play the crucible cart's pour at close range and its dripped trail in the Hangar's corridors with a pad (combat-v1.16
  rec. 2; tuned by numbers in v1.22: the slag burns every 1.1 s, was 0.7; the pour's slag stays 4 s, was 6; the trail 3.5
  s, was 4.5; 7.1 → 4.4–5.2 bars a minute on a still traveller, combat-v1.22). Still the roster's hardest on a still
  traveller with the hound (4.6): shorten the trail further if it reads unfair.
- [ ] Measure the machines' CPU on the Retroid and the Deck (combat-v1.16 rec. 3: +0.25 ms a machine in headless Chrome,
  a pack of six 2.5 → 4.0 ms): the cart's ground rays every other frame and its wheels' instance upload first (a far cart
  could skip both).
- [ ] Batch 4 against its sheets (docs/design/enemy-roster.md "Status"; v1.26 draped the cart's canvas, toothed its
  sprockets and wound its smoke, plated the brute's fingers and met its fists over its head, banded the bell's yoke):
  the brute's crack net lighter; the bell's spirit seen from above, its legs' plating; the drone's cloud spreading in
  wisps at its sides.
- [ ] Play the shade's feint with a pad (combat-v1.18 rec. 1): is the thrust's parry found after the false cut, or does
  every early guard simply block it? If the feint never pays, a guard held through the false cut is broken by the thrust
  (staggered, not hurt).
- [ ] The pearl roller in a world with walls (combat-v1.18 rec. 2): the Hangar's corridors, the Garden's terraces; does
  the bounce aim fairly at you, does a wall stall read as an opening?
- [ ] The marionette's strings as targets (combat-v1.18 rec. 3): cut them with the air cut from the ground and with the
  boomerang; if the air cut can't reach, lower the cut point or widen it.
- [ ] The combat-review script (combat-v1.18 rec. 4): drive the marionette with a host and time freeing it (strings cut)
  as well as killing it; the roller's shot and ember times assume it unrolled (rolling, they glance).
- [ ] Batch 5 against its sheets (docs/design/enemy-roster.md "Status"; v1.26 hung the shade's cloak as a drape in
  folds and poured the marionette's knot down in a funnel): the shade's smoke in flame-like curls (tried as curling
  tubes in v1.26: they read as a white-lined fence, kept the wisps); the roller's spiral on one side only and sheet-2's
  rocking runners in its wind-up, a glistening trail where it grazes; the marionette's glass see-through.
- [ ] Play batch 6's balance with a pad (combat-v1.22 recs. 1–3): the full charged cut at 0.85 s (was 0.6): does it still
  feel worth holding? The light combo's third swing at 3 (was 2) and the air cut double on a flyer: do they now get
  used? Three strikers at once, three quarters of the wait between strikes and the heavier blows (a heavy blow a heart;
  the Market's ordinary blows ¾) in the Buried Machine, the Garden and the Market (`TURNS.late`, `HARM_BY_STAGE`): fair
  with a pad, or a pile-on? If a pile-on, keep the heavier blows and drop the quicker waits first.
- [ ] The still traveller's measure under-reads a big pack (combat-v1.22): two or three strikers at a time, and off the
  screen one waits while another strikes, so a pack of five presses about as hard as two. Drive the review's still
  player with the lock-on camera turning to each striker, or time a scripted player clearing the pack, before tuning the
  late worlds further by numbers.
- [ ] Hear the foes' voices (v1.22, src/foe-voices.js) on the speakers and the Retroid: each archetype's hurt and burst
  were checked only in memory (distinct by loudness over time and brightness, under the old sets' level); tune by ear.
- [ ] Play the horn lizards' pair with a pad (combat-v1.8 rec. 1): the flanker's circle and its hiss read before the
  bite? The blare's shove toward the partner fair? The antler hound's threat on a still player is the highest (4.6
  bars a minute, rec. 2): lengthen its `cool` if the playtest agrees.

# Combat review (docs/audits/combat-v1.4.md, 2026-10-09)

- [ ] The dash cut is the best answer nowhere (combat-v1.22: 1.5 s a blow by its cooldown; the air cut, the combo and the
  charged cut now each lead somewhere): a dash cut through a foe's back could land double, or its cooldown shorten.
- [ ] The combat-review script: drive guard, parry and evade timing against each attack; batch and group the report
  when the larger roster lands (each kind is framed side-on for the contact sheet since v1.26).

# Combat review (docs/audits/combat-v1.6.md, 2026-10-09)

- [ ] Play the eleven guardians' new fights in their temples with a pad and tune by hand: the combo starters' 1.0 s,
  the miss-openings' lengths, the shock rings' 9 m/s against the jump.


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
- [x] **6. Guardians** (1–2 sessions): keeper, gardener, foreman, sentinel, First Sign onto the kit (IK legs,
  bodies from feet); whale, moth, Elder, echo onto waves with lag; the Snapper's neck on FABRIK; key poses for
  each fight's new attacks. Done (procedural-animation.md, "Phase 6, the guardians"): the six walkers on jointed planted
  legs (slide 0.00 m/m, reach 21–33 %, lift 12–17 %, knees 60–96°, the right groups), the body in its own tell rig over
  planted feet, the wind-up's brace and lock, the fliers on travelling waves, the Snapper's neck a FABRIK chain; every
  fight's timing unchanged. Left: the guardians' own coil pose per move (they keep their hand-made ones on top of the kit's).
- [x] **7. LOD and style** (1 session): the tiers (held 30 frames) and the stepped clock are built in
  `src/motion-kit/rig.js`; left: on-screen as well as distance, a far tier that skips drawing the legs, the
  stepped clock (12–15 fps per foe) turned on per plan; measure on the Retroid (≤ 1 ms with 10 foes near, 30 far); re-run
  the motion check for ink shimmer. Done (procedural-animation.md, "Phase 7, LOD and style"): out of view nothing solved,
  far IK one frame in four, the machines on twos; the kit 0.24 → 0.13 ms a frame on High and 1.03 → 0.52 on the Deck
  preset at CPU ×4 with a guardian and 28 foes; shimmer round a walking tripod 515 → 6–26 per 10 000 px. Measured in headless
  Chrome (no Retroid now).

# Level design (audit) (docs/audits/level-design-v1.5.md, v1.9, v1.15, v1.17, v1.20, v1.23: 2026-10-10)

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
- [x] **Left from v1.17** (v1.23, docs/audits/level-design-v1.23.md): the City-Shaft's Tobin → Lio hop (Tobin's
  telescopes round the outer rim: loops 5); the desert's Ama's fire → the giant's mouth (the giant's breath over the
  back gate: wayfinding 3 → 4). Left: the desert's well → Marrow and hollow → Hearth, its first goal 391 m off.
- [x] **Sky Stones: the clapper's return arc** (v1.20: along the fallen-up tiles over the great table; the island
  church's tower as a beacon). Loops 2→5. Ondine (v1.23): out on the aqueduct under the island, by her tally; the
  clapper's lantern over the porch.
- [x] **Lorn II: lamp-lit stakes** (v1.20: the lit path declared, the saucer's beam a beacon, the water-way home).
  Wayfinding 1→5.
- [x] **The Signal Market's listeners' lane** (v1.23): Wynn, the last listener, under the dishes halfway (149 → 90 m);
  the silent tower's aerial a beacon (landmarks 3 → 4, wayfinding 4 → 5). A second way back from Sel's: v1.20's lane.
- [x] **Pull the remote loners into 30-150 m of the path** (v1.23): Ondine (Sky Stones), Gaspard (Hangar), the pyramid
  seed (Viridel), Emrys (Garden, onto the meadow pyramid). Optional pull +1 in the Sky Stones and the Hangar.
- [x] **One high place per flat world** (v1.23, src/lookouts.js): Wendel's lookout with the box (Lorn, 8 → 38 m), the
  keepers' stalks (Lorn II, 17 → 32 m), Emrys on the meadow pyramid (Garden, 25 → 30 m). Verticality +1 each. The
  Garden's meadow path home and the answering spheres in the avenue (density 4 → 5); Lorn's crown seen from Saba's stone
  through a notch in the grove (wayfinding 4 → 5). The average 4.25 → 4.38.
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

- [x] **A twist room in every temple** after the gadget's test: the gadget plus the temple's pre-gadget verb in one
  lock (keys of two kinds). All eleven (v1.24).
- [x] **One key per temple out of its lock's room**, in sight from it but reached from elsewhere (a shortcut that
  opens from the far side, a disc mid-ride). All eleven (v1.27): the Warden's Well's little vane stands on a post in the
  loft, seen from the crown down through the second iris, splashed and then flown up to the great one inside its 15 s.
- [x] **No gadget door beside the chest**: the chest room's way out teaches the gadget somewhere failure is cheap;
  its next use a room later. All eleven (v1.27): the Belfry, the Engine-House, the Undertower, the Greenhouse, the
  Hush-House, the Lamp-House and the First Garage each have a passage a room on with the old door at its far end, and a
  try that locks nothing in five of the chest rooms (docs/audits/temple-design-v1.27.md); the Aerie's and the Warden's
  Well's are traversals (a miss drops you back), left as they are.
- [ ] **Break the shared opening** (push the ball, ride the disc in 7-9 of 11; the Belfry = the Undertower and the
  Garage = the Engine-House, 100 %): each first room from its world's own idea. Done: the Givers' House (the pilot flame),
  the Engine-House, the Greenhouse, the Hush-House, the Footprint (v1.27: the sphere on the walker's print, you on its
  print by the wall; 86 % → 71 % the Lamp-House's), the Belfry (v1.27: the founders' bell struck by a ball, the great
  stone that falls up), the Undertower (v1.27: the dish-carried note raises the pillars) and the Lamp-House (v1.27: the
  orb's lamp raises moss-stones). Left: the Warden's Well, the Aerie and the First Garage (a disc or a raft after their
  own first step).
- [ ] **Play the v1.27 changes with a pad**: the Belfry's great stone (12 s, falling up with you), the Warden's Well's
  little vane from the loft to the crown (15 s), the Footprint's carved prints read from the hall's door, the seven
  passages.
- [x] **Givers' House (2.11 → 4.22, v1.24)**: the Givers carried their fire. A tar ball rolled through the pilot flame
  into the hooded bowl by the door (taught before the gadget), back through the flame first in the Dry Channel (its disc
  gone), the chest's ball burning through the corridor's thorns to the bridge's bowl, the Hall of Channels' long groove
  and its relay brazier (which wakes the keepers' door back: a loop); the Keeper panting only by a fire rolled to it.
  Left: the curve (3), `d3` at 1.5 (watch players).
- [x] **Footprint (2.22 → 4.33, v1.24)**: the lens shows where the walker set things down. The floating sphere and the
  stilling stone (the disc gone), the mural (the clue), the stones only the lens shows where the walker's prints hold,
  the walker's plate among plain prints and the eye across the chasm, the keepers' gallery back (a loop); the Echo
  answered by the print. Its opening and its shape: done in v1.27 (the walker's
  prints; 71 %).
- [ ] **Play the Givers' House's and the Footprint's new rooms and last phases with a pad** (v1.24): the tar balls'
  14 s and their pushes, the Hall of Channels' 4.6 s burn and the relay, the stilling stone and the floating sphere, the
  stones' 0.35 s crumble, the Keeper's 3.4 s pant by a fire, the Echo's print read across its hall.
- [x] **Founders' Belfry (1.44 → 4.00, v1.8)**: held bells (the Bell Chamber's door, the Hall of Echoes' stones
  only while it rings), the ball rolled across the held stones holds them (bell + push), the Hall of Stones a hub
  with `d1`'s balls in two stores, a high door whose eye is under the landing. Its opening: done in v1.27 (the founders' bell
  and the great stone). (The Cloud-Mother's falling stone: done in v1.15.)
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
- [ ] **Play the Warden's Well's and the Engine-House's new rooms and last phases with a pad** (v1.19): the Turning
  Floors' one splash (15 s), the hover-and-aim over a great vane, the shelf's ball pushed from the air, the crown's two
  vanes (12 s), the warden's 7 s hatch; the hammer's stroke, the Furnace's piston tops (1.2 s each, 2 s apart), the
  Tooth-Warden's gear rolled in its last phase.
- [ ] **Play the five reworked guardians' last phases with a pad** (v1.15, docs/systems/foes.md "The guardians' last
  phases"): is ringing as the Cloud-Mother rises to dive (78 % of her wind-up at most) readable, is the Lampless's
  "stand back" (5 m) fair under its scales, are the Mother Snapper's crystals easy enough to tell apart by size from
  the floor, can the First Sign's low dishes be reached in its 4.4 s opening (or is waiting by one the read), do six
  numerals from four fit the Foreman's 5.6 s opening with the coil. (Since v1.24 all eleven guardians' last phases ask
  for their temple's idea.)

# Fun and story (docs/fun-and-story-review.md, October 2026)

Ranked; each says why in the review. Playtest with two or three new players before building the big ones.

- [ ] Playtest the fellow traveller (Tansy, v1.28: DONE.md, docs/systems/story.md) with two or three new players:
  do they notice her by the ship, and does the last meeting land? If her stops feel too far apart, a fifth stop
  (Viridel or the Garden of Spheres) would bring the payoff before the first homecoming for more players.
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
