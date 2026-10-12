---
name: procedural-animation
description: Building or reviewing how Hiraeth's creatures, foes, guardians and machines move (not the traveller or the people: that is motion-qc) — legs, gaits, foot planting, bodies that respond to their feet, springs and secondary motion (tails, cloaks, wings, tentacles), mechanical motion, and wind-up/strike/recover poses. Use when adding or changing a foe's or guardian's model or its animate()/anim(), when a body plan joins the roster (enemy-rework calls it for its motion step), when someone says a creature looks stiff, slides, floats or reads poorly, or before a release; measures walk cycles in node and scores motion with a rubric. Telegraph timing and fairness are combat-review's.
---

# Procedural animation: building and reviewing creature motion

Read first: `docs/systems/procedural-animation.md`. §1 is the research with sources (the principles below in full),
§2 the audit of October 2026 (why the foes looked stiff), §4 the ~20 body plans with the techniques each needs, §6
"What was built" the kit and the plans on it. For the traveller's and people's feet, see `docs/systems/animation.md`,
"Locomotion", and the motion-qc skill.

The kit, `src/motion-kit/`: `ik.js` (two-bone IK, FABRIK, aim), `gait.js` (the gait planner: homes, groups, step
triggers, arcs), `body.js` (the body from its feet), `spring.js` (SecondOrder, deadband, quantise), `chain.js` and
`wave-legs.js` (tails, cables, metachronal legs), `pose.js` (key poses by state), `machines.js`, `plans.js` (a table per
body plan), `rig.js` (one rig per foe, its LOD tiers), `view.js` (what the camera sees, for the tiers).

In-game prior art: `StiltMotor` (src/aliens/alien.js), `kneeOf` (src/aliens/bodies.js), `plantFeet` / `legIK`
(src/feet.js), the hands' spring lag (src/hands.js), the ragdoll's position-based dynamics (src/ragdoll.js).

## Principles (doc §1 has the why and the sources)

1. **Feet are planted, not swung**: phase by distance walked or a gait planner, never `sin(t)` on a clock.
2. **Joints bend**: two-bone IK with a stable pole (knees out and up for arthropods, forward for birds and humanoids,
   hocks back for beasts); a bend under ~20° doesn't read in ink.
3. **Gait groups, not sides**: a tripod on six, an alternating tetrapod on eight, diagonals or one at a time on four,
   a wave on three; a group lifts only when the others are down; per-foe phase offsets.
4. **The body rides on its feet**: height and tilt from the planted feet, a lean into acceleration and turns, a settle
   on stopping, all through springs.
5. **Secondary motion lags**: second-order springs (f/ζ/r), follow-the-leader or verlet chains, waves; heads stabilise.
6. **Machines are not creatures**: servo easing, underdamped overshoot (ζ 0.3–0.5), quantised joints, pistons; a
   possessed machine breaks this on purpose.
7. **Poses tell the attack**: its own wind-up pose (feet planted, the body against the strike, held ≥ 0.25 s plus
   the defence's start-up), a snap through, a slumped recovery. The body is the telegraph (src/telegraph.js; DONE.md,
   "Combat telegraphs"); whether the timing is fair is combat-review's.
8. **Timing contrast reads**: hold, then burst; optionally step the output at 12–15 fps per foe.
9. **Cheap by distance**: tiers held 30 frames; the kit under 1 ms on the Retroid with 10 foes near.

## Measuring

```
node scripts/motion-audit/run.mjs                         # the archetypes on the kit, the old kinds, the guardians, the dog
node scripts/motion-audit/run.mjs lizard@bazaar crab keeper   # just these: kinds, kind@skin, guardians
node scripts/motion-audit/run.mjs --skins                 # every built archetype in each of its skins
node scripts/motion-audit/run.mjs --pace=0.5              # at half speed: does the gait follow the speed?
node scripts/motion-audit/run.mjs --pack                  # a second of each kind beside it: unison (1 is in step)
node scripts/motion-audit/run.mjs --cost                  # the kit's time a frame per foe and per leg
node scripts/motion-audit/run.mjs --json                  # the full per-leg reports
```

With no ids it walks `ARCHETYPE_SUBJECTS`, then `OLD`, `GUARDIANS` and `DOGS` (all in `scripts/motion-audit/walk.mjs`).
Each subject walks 4 s in a straight line through the game's own model and `Foes.look` (or a guardian's `animate`).
A foot is the lowest vertex under each leg pivot. The pure measures are in `scripts/motion-audit/metrics.mjs`, tested
by `tests/motion-metrics.test.js`:

- **slide/m:** horizontal travel of a foot while touching the ground (within 3 cm of its lowest), per metre
  walked, averaged per leg.
- **worst:** the longest single contact's slide.
- **reach span:** the change in hip-to-foot distance. 0 means a rigid stick; a bending knee changes it.
- **lift:** the lowest foot's lift.
- **steps/s:** cadence. Compare it at `--pace=0.5`: identical means the rhythm runs on a clock.
- **bob:** the drawn body's height range.
- **groups:** legs whose feet swing fore and aft together (correlation > 0.9).

Where the legs come from: `legsFor(id)` in walk.mjs, the `OLD` table's own function for an old kind, else `kitLegs`
(the kit's `rig.legs` roots) for an archetype. A new archetype on the kit joins `ARCHETYPE_SUBJECTS`; a model off the
kit adds its legs to `OLD`, a guardian to `GUARDIANS`.

Then look at it: `node scripts/motion-audit/strips.mjs --out <scratch>/strips [--tag after] id…` draws 8 frames over
2 s from `enemies.html` (its own Vite and muted headless Chrome; never port 5173), three-quarters from above as the
game's camera; `--yaw 1.5708 --pitch 0.1` for the side view. `--root <tree>` serves another checkout for the "before".

## Review rubric (score each 0–3; ship at ≥ 2 everywhere, aim for 3 on 1–3)

| # | Criterion | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| 1 | **Joint articulation** | rigid sticks (reach span ≈ 0) | knee moves but < 20°, or pops | two-segment IK, visible bend from the game camera | bends read in silhouette; poles stable; the plan's own knee direction |
| 2 | **Foot planting** | slide/m > 0.3 or feet skate in contact | 0.1–0.3 | < 0.1, worst contact < 0.1 m | < 0.03; feet land on uneven ground (one ray per step); turning on the spot steps round |
| 3 | **Gait** | rhythm on a clock, sides in phase, pack in unison | phase by distance, wrong groups | right groups for the leg count; cadence follows speed | duty factor and step height by plan and speed; per-foe offsets; settling step on stop |
| 4 | **Weight and body response** | body fixed or bobbing on a sine | bob tied to steps only | height and tilt from the feet, lean into acceleration and turns | springs give weight: heavy brutes dip and overshoot; light skitterers twitch |
| 5 | **Secondary motion** | everything welded | one loose part on a sine | heads stabilise; tails, antennae, cloaks lag on springs or chains | overlapping action throughout; machines only on loose parts; possessed tells |
| 6 | **Anticipation and telegraph** | the attack starts from the walk pose | a single-axis wind-up | its own coil pose per attack, feet planted, held ≥ reaction time | counter-move, hold, snap, overshoot, settle; each attack reads apart from the body alone |
| 7 | **Readability in ink** | shimmering thin parts, constant jitter | legible up close only | clear silhouettes at 15 m; contact marks (dust, prints) | timing contrast (holds and bursts); stepped output if the plan uses it; reads at 30 m |
| 8 | **Cost** | unbounded (rays per foot per frame) | fine for one foe | LOD tiers; ≤ 1 µs per leg near on the Mac | measured on the Retroid within budget with a full pack |

Record scores and the measures in the change's notes (and the changelog's before/after strips when players will
see it). A regression in slide/m, reach span or groups on a plan that already passed is a bug: add a test.

## Checklist when adding a body plan

- [ ] Plan table entry: legs (hip offsets, lengths, pole, group, phase), gait per speed band, body springs,
      chains, key poses (rest, coil per attack, strike, recover, hurt, stagger), style (organic / machine /
      possessed).
- [ ] Model exposes joints by role (leg chains, spine, neck, tail, wings, arms) instead of rigid legs.
- [ ] Subject added in `scripts/motion-audit/walk.mjs`; rubric 1–3 measured at full and half speed.
- [ ] Motion strip of a cycle (`strips.mjs`) and of each attack's wind-up, side and three-quarter views.
- [ ] Unit test for any new pure logic (planner rule, chain, pose blend).
- [ ] `docs/systems/procedural-animation.md` updated (the plan's row, any new technique).
