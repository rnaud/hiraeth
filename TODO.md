# TODO

**The shared tracker is GitHub Issues** (https://github.com/rnaud/hiraeth/issues; the Notes page writes there too). Every open item below was ported on 2026-10-10 and links its issue; new work goes in an issue, and closing the issue closes the item: it moves to DONE.md, ticked, with how the issue closed (`tests/todo-done.test.js` fails while an open item here links an issue DONE.md lists as done). This file stays as the long-form context.

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

Playtests are not listed here: the author plays all the time.

# The author's list (2026-10-10), before the full game audit

## Combat, controls and world feedback (2026-10-10)

Author feedback; investigate reported artifacts and stutters rather than treating their causes as confirmed. (The
combat and controls items were done in v1.41: DONE.md.)

- [ ] [#9](https://github.com/rnaud/hiraeth/issues/9) **Run a flora and fauna reference pass across every world.** Follow the project's reference workflow.

## Loading follow-up: procedural worlds, no baking (2026-10-10)

Author decision: **do not bake geometry or worlds into shipped assets**. Keep procedural generation and
focus on faster first-install/cold loads as well as repeat loads. This supersedes the baking portion of
any earlier faster-loading plan. Codex stopped its overlapping implementation; continue in Claude's
existing loading/performance worktrees rather than starting another competing shader implementation.

- [ ] [#16](https://github.com/rnaud/hiraeth/issues/16) **Measure the result.** Compare matching builds, levels and quality on Mac, Nova and Xbox, separating
  genuinely cold first-install loads from warm repeats. Split loading into module/assets, world creation,
  collision, characters, shader compile/link/first use and GPU warm-up. Record first playable frame,
  memory, and traversal p95/p99 stalls. Shader caching alone is not an acceptable explanation or solution
  for the reported 3-second Nova versus 230-second Xbox load. Confirm the Xbox resource allocation.

## Worlds

Never delete a temple or a character: a dismissed world moves whole to a dismissed-levels folder
(`src/levels/dismissed/`), out of the route and the Debug menu's worlds, so its pieces can be reused elsewhere.

## Level design (audit)

From docs/audits/level-design-v1.49.md (twelve route worlds, 4.35), worst first by (gain × players) / cost:

- [ ] [#137](https://github.com/rnaud/hiraeth/issues/137) **The new worlds' route quests still hand you from one person to another**
  (the Moon Foundry's hook and count, the City Floating in Space's notes, the Underwater City's cutting and lamps): each
  completes at its goal. Pacing 4 → 5 in the Moon Foundry.
- [ ] [#131](https://github.com/rnaud/hiraeth/issues/131) **Viridel's Greenhouse**: blind from Mira's (281 m) and home (324 m), and the walk home
  passes nothing. Wayfinding 3 → 4, loops 3 → 5 (Viridel 4 → 4.33).
- [ ] [#132](https://github.com/rnaud/hiraeth/issues/132) **The walks home from the temple** in the Underwater City (310 m), the City Floating in
  Space (296 m), the Buried Machine (106 m) and the City-Shaft from Tobin (119 m): loops 3–4 → 5 in each.
- [ ] [#133](https://github.com/rnaud/hiraeth/issues/133) **Vael's plain** (483 m empty, 59 s) and its blind legs to the monastery (966 m) and the
  Belfry (279 m): density 3 → 4, wayfinding 4 → 5.
- [ ] [#136](https://github.com/rnaud/hiraeth/issues/136) **The Buried Machine's landmarks** (57 % of the path sees one) and its blind canyon and
  Engine-House legs: landmarks 3 → 4, wayfinding 4 → 5.
- [ ] [#134](https://github.com/rnaud/hiraeth/issues/134) **The belvedere and the breaker's cairn** don't pull (154 m and 368 m off the path): the
  Garden's loner gone, the Glass Dunes' optional pull 3 → 4.
- [ ] [#135](https://github.com/rnaud/hiraeth/issues/135) **Lorn's blind legs**: Wendel → the Great Crystal (188 m), the crystal cave → Hollin (631 m).
  Wayfinding 4 → 5.
- [ ] [#138](https://github.com/rnaud/hiraeth/issues/138) **The audit's "raised" measure** reads a place on a tower as 0 m up; measure it over the
  terrain.

## Temples

- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) **Redo the temples with less linear paths** (2026-10-10): several rooms with puzzles of different complexity,
  keys found in one room that open others, rooms that close behind you and hold a small arena challenge to reopen,
  and so on: a temple you explore, not a corridor of rooms in order. Keep every temple and guardian (reuse their
  rooms and kits); use the temple-design-qc skill to score the result.

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

# Procedural animation (2026-10-09; phases 1–3 done: the kit is `src/motion-kit/`)

The foes walk like toys on sticks: rigid legs swung by a shared clock, feet sliding 0.3–1.4 m per metre walked,
six-legged crabs waddling all-left / all-right, bodies that ignore their feet (measured:
docs/systems/procedural-animation.md, "The audit"). Build a small locomotion kit (`src/motion-kit/`) and move the
new ~20 body plans and the guardians onto it. Review every step with the `procedural-animation` skill
(`node scripts/motion-audit/run.mjs`, the rubric). Sessions are rough estimates.

# Temple design (audit) (docs/audits/temple-design-v1.5.md, 2026-10-09; v1.8, v1.12, v1.16, v1.19, v1.24: the worst reworked, two or three at a time; v1.27: the four rules)

All eleven were one chain with every key beside its lock (mean obviousness 4.25-5 of 5, no step combines the gadget
with an older verb); since v1.24 every one has its own idea (average 1.84 → 3.87). Ranked; each re-runs
`node scripts/temple-design/audit.mjs` and keeps tests/temples.test.js passing (skill: temple-design-qc). The fights
themselves: done in v1.6 (DONE.md, "Combat telegraphs"). The four rules, checked across the eleven in v1.24 and done in v1.27 but
three openings (docs/audits/temple-design-v1.27.md, "The four rules"):

Issue #23, temples to explore (docs/audits/temple-design-v1.48.md, v1.49.md): the kit has keys, locks, arenas and coffers;
round 1 (v1.48) reworked the Clock-House, the Greenhouse, the Undertower and the Warden's Well round a hub, round 2 (v1.49)
the Engine-House (a hub past its chest), the Aerie (a stack), the Lamp-House and the Belfry, and brought the Greenhouse's
and the Undertower's curves back with a late room for the great key. Structure is 5 in all fourteen (mean 3.95 → 4.21). Left:

- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) The Hush-House (3.67, the lowest): its middle steps are cheap (the
  eye from the disc, the jaws, the ledge's gate, the pendulums' crossing); jaws stilled in the Choir's order, and a wing
  with the great key past the gallery. (An arena off the Choir alone made it worse: tried and dropped.)
- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) An arena in each house that has none: the Hush-House, the
  Whale-House, the Casting-House, the Footprint, the Mooring-House (a wing of its hub, its key for a door that wants
  another wing too).
- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) Identity 2 in the Belfry, the Clock-House, the Warden's Well, the
  Mooring-House and the Undertower (the Warden's Well and the Mooring-House 78 % alike): another shape for one of them.
- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) The Clock-House's curve (2): its hardest steps come first.
- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) Four houses now keep the great key in a room off their last puzzle
  hall (the Clock-House, the Greenhouse, the Undertower, the Lamp-House): the next reworks should put it elsewhere.
- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) Play the new arenas by hand (the node tests use stand-in keepers).

# Carried over

## Animation

- [ ] [#47](https://github.com/rnaud/hiraeth/issues/47) Capture starts, stops and turns at the game's actual speeds so feet follow the motion.
  The completed motion-matching evaluation is recorded in DONE.md. The matcher is ready for them (the game's loops in
  its database, the hand-in, the sprint, the stops: docs/systems/animation.md, "The motion QC"); run the `motion-qc`
  skill before and after, and make it the default only if it is green where the default is.

## Android

- [ ] [#50](https://github.com/rnaud/hiraeth/issues/50) On the Retroid: GeckoView with the real buttons, the upgrade over the installed app, the cave's
  FPS and the shader cost. **Blocked**: no Android device is attached. (The cave's FPS and the shader
  cost are measured, in the GeckoView test app: the cave 60 fps, GPU 41 %, docs/systems/performance.md
  "Every world on the Retroid, in GeckoView"; the game's 78 programs compile in 5.7 s one by one, 81 ms
  median, 208 worst, against 20.8 s and 367 ms in 07af71c's run. The real buttons and the upgrade over the
  installed app are still to do: the measuring never touches the player's app.)

## Steam Deck (waiting on the device: it was asleep, 2026-10-07)

- [ ] [#52](https://github.com/rnaud/hiraeth/issues/52) Compare ANGLE's GL and Vulkan backends under gamescope (`GPU=vulkan scripts/bench/deck-run.sh ...`)
  (2026-10-10: done, Vulkan far slower: 19 vs 33 fps at the desert's spawn, GPU 30 vs 12.5 ms; GL stays);
  check the loading pen turns smoothly in a Deck load (`scripts/bench/deck-pen.mjs`); check the new Updates
  section on the Deck itself (the Deck has runtime 830001 and web 969 now, and the site 970001: Check,
  Download and Restart now should take it to 970001).
