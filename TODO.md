# TODO

**The shared tracker is GitHub Issues** (https://github.com/rnaud/hiraeth/issues; the Notes page writes there too). Every open item below was ported on 2026-10-10 and links its issue; new work goes in an issue, and closing the issue closes the item: it moves to DONE.md, ticked, with how the issue closed (`tests/todo-done.test.js` fails while an open item here links an issue DONE.md lists as done, or one closed on GitHub: `node scripts/closed-issues.mjs` refreshes the offline list it reads, `tests/closed-issues.json`, and names the stale items). This file stays as the long-form context.

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

Playtests are not listed here: the author plays all the time.

# The author's list (2026-10-10), before the full game audit

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

From docs/audits/level-design-v1.53.md (twelve route worlds, 4.51, the four worlds' explorations measured), worst first:

- [ ] [#178](https://github.com/rnaud/hiraeth/issues/178) **The Garden of Spheres: the Footprint on the route** crosses 680 m with
  nothing near (83 s) from the humming pole, and the walk home from its door (336 m) is blind and empty. A line and a
  place or two on the way, a way out nearer the ship: density 2 → 4, loops 3 → 5, the Garden 4 → 4.44 or more.
- [ ] [#179](https://github.com/rnaud/hiraeth/issues/179) **Lorn: the Hush-House's door is off the keepers' stakes**: the cave → the door (61 m)
  and the door → Hollin (586 m) are blind. A first stake by its steps: wayfinding 4 → 5, Lorn 4.44 → 4.56.
- [ ] [#180](https://github.com/rnaud/hiraeth/issues/180) **The Moon Foundry: the walk home from the Casting-House** (277 m) passes nothing new.
  A way out elsewhere, or home past the quarter: loops 4 → 5, 4.56 → 4.67.
- [ ] [#181](https://github.com/rnaud/hiraeth/issues/181) **The Desert is still flat**: 1 of 64 places raised. A stop on the giant's arm over the
  wash, a lookout on a sandfall mesa: verticality 3 → 4, 4.11 → 4.22.
- [ ] [#182](https://github.com/rnaud/hiraeth/issues/182) **The City-Shaft: the light-down's first mirror is a loner** (164 m from anything), and
  the crown → Nima (287 m) is still blind. No score change by the numbers.

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

# Singing light soundtrack follow-up

- [ ] [#27](https://github.com/rnaud/hiraeth/issues/27) **Generate the singing light theme with Suno** using the brief in
  `docs/systems/audio.md` ("The singing light's theme") and install the selected recording
  in the existing `singing-light` cue slot. The synthesised motif, restaged opening,
  voicemail, Qanat repayment, signature search and rumble are implemented (DONE.md).

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

Round 3 (v1.53, docs/audits/temple-design-v1.53.md) gave the Hush-House its middle (3.67 → 4.22), an arena to every house,
the Mooring-House and the Clock-House their own shapes, the Clock-House its curve, and put three great keys back in the
first half (mean 4.19 → 4.28). Left:

- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) Play the new rooms by hand: the Hush-House's thawing jaws (10 s), the
  Mooring-House's cable-rail under the tether, the Clock-House's stopped cupboard, and every arena with real keepers (the
  node tests use stand-in keepers).
- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) Identity 2 in the Undertower (70 % like the Casting-House) and the
  Lamp-House (67 % like the Whale-House): another shape for each.
- [ ] [#23](https://github.com/rnaud/hiraeth/issues/23) Three houses still keep the great key off their last puzzle hall
  (the Greenhouse, the Undertower, the Lamp-House): a loop back to the first half, as the Hush-House, the Mooring-House and
  the Clock-House now have.

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
