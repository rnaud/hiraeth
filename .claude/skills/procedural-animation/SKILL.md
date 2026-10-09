---
name: procedural-animation
description: Building or reviewing how Hiraeth's creatures, enemies, guardians and machines move — legs, gaits, foot planting, bodies that respond to their feet, springs and secondary motion (tails, cloaks, wings, tentacles), mechanical motion, and wind-up/strike/recover poses that act as attack telegraphs. Use when adding or changing a foe's or guardian's model or its animate()/anim(), when a body plan joins the roster, when someone says a creature looks stiff, slides, floats or reads poorly, or before a release; measures walk cycles in node and scores motion with a rubric.
---

# Procedural animation: building and reviewing creature motion

Read first: `docs/systems/procedural-animation.md`. It has the research with sources, the audit of October 2026
(why the foes looked stiff), the locomotion kit's architecture (`src/motion/`, once built), the ~20 body plans
with the techniques each needs, and the phased plan. For the traveller's and people's feet, see
`docs/systems/animation.md`, "Locomotion". In-game prior art to copy from:

- `StiltMotor` (src/aliens/alien.js): a planted wave gait with two-bone knees;
- `kneeOf` (src/aliens/bodies.js): two-bone IK on plain points;
- `plantFeet` / `legIK` (src/feet.js): planting and IK on skinned bones;
- the hands' spring lag (src/hands.js);
- the ragdoll's position-based dynamics (src/ragdoll.js).

## Principles

1. **Feet are planted, not swung.** A foot on the ground stays where it landed until it steps. Never drive legs
   with `sin(t)` on a clock: drive the phase by distance walked (`phase += speed·dt / stride`), or better, use
   a gait planner with rest targets and step triggers.
2. **Joints bend.** Every leg has at least two segments solved by two-bone IK with a stable pole: knees out and
   up for arthropods, forward for birds and humanoids, hocks back for beasts. A bend under ~20° doesn't read
   in ink.
3. **Gait groups, not sides.**
   - Six legs: a tripod (L1 R2 L3 against R1 L2 R3).
   - Eight legs: an alternating tetrapod (L1 R2 L3 R4 against R1 L2 R3 L4).
   - Four legs: diagonals (trot) or one at a time (walk).
   - Two legs: alternating.
   - Three legs: a wave.

   A group lifts only when the others are down. Per-foe phase offsets stop a pack stepping in unison.
4. **The body rides on its feet.** Height from the planted feet, pitch and roll from their plane, a dip as
   each group lifts, a lean into acceleration and turns, a settle when it stops. Everything goes through
   springs, never snapped.
5. **Secondary motion lags.**
   - Heads, tails, antennae, cloaks and cables follow the body through second-order springs (t3ssel8r's
     f/ζ/r) or short chains: follow-the-leader for spines, verlet for loose parts, travelling waves with a
     phase accumulator for fins and wings.
   - Heads stabilise against the body's bob.
6. **Machines are not creatures.**
   - Machines get hard curves: exponential servo easing, underdamped overshoot (ζ 0.3–0.5), quantised or
     deadbanded joints, pistons between pivots, wheels and tracks locked to distance, overlap only on truly
     loose parts.
   - Possessed machines break this on purpose: organic lag or a twitch past a stop is the spirit showing.
7. **Poses tell the attack.** Each attack has its own wind-up pose.
   - **Wind-up:** feet plant wide and stepping locks; the body moves against the strike first (anticipation:
     a spring with `r < 0`, or a counter-pose); hold it long enough to read (≥ 0.25 s plus the defence's
     start-up).
   - **Strike:** snap through, with overshoot.
   - **Recover:** slump, and let the secondaries settle.

   The body is the telegraph (TODO.md, "Combat telegraphs"), so a motion review is also a telegraph review.
8. **Timing contrast reads; constant motion doesn't.** Hold, then burst. Optionally step the pose output at
   12–15 fps per foe (phase-offset) for the ink look; simulate every frame regardless.
9. **Cheap by distance.** Near: everything, every frame. Mid: IK every 2nd frame, chains as waves. Far: a
   canned cycle driven by distance walked. Hold tier changes for 30 frames. Keep the kit under 1 ms on the
   Retroid with 10 foes near.

## Measuring

```
node scripts/motion-audit/run.mjs                      # old kinds, a sample of world enemies, legged guardians
node scripts/motion-audit/run.mjs <id|kind|guardian>…  # just these (e.g. desert/dune-skitter crab keeper)
node scripts/motion-audit/run.mjs --pace=0.5           # at half speed: does the gait follow the speed?
node scripts/motion-audit/run.mjs --all --json         # everything, full per-leg reports
```

Each subject walks 4 s in a straight line through the game's own model and `Foes.look` (or a guardian's
`animate`). A foot is the lowest vertex under each leg pivot. The pure measures are in
`scripts/motion-audit/metrics.mjs`, tested by `tests/motion-metrics.test.js`:

- **slide/m:** horizontal travel of a foot while touching the ground (within 3 cm of its lowest), per metre
  walked, averaged per leg.
- **worst:** the longest single contact's slide.
- **reach span:** the change in hip-to-foot distance. 0 means a rigid stick; a bending knee changes it.
- **lift:** the lowest foot's lift.
- **steps/s:** cadence. Compare it at `--pace=0.5`: identical means the rhythm runs on a clock.
- **bob:** the drawn body's height range.
- **groups:** legs whose feet swing fore and aft together (correlation > 0.9).

A new model adds its legs to the `OLD` or `GUARDIANS` table in `run.mjs`, or exposes
`limbs: [{ o, role: 'leg' }]` as the world enemies do. Then look at it: capture a side-view motion strip of
one cycle (8 frames) from `enemies.html` on a dev server (port 5352, never 5173; one headless Chrome with
`--mute-audio --remote-debugging-port=0`). Compare a three-quarter view from above too, the game's camera.

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
- [ ] `run.mjs` subject added; rubric 1–3 measured at full and half speed.
- [ ] Motion strip of a cycle and of each attack's wind-up, side and three-quarter views.
- [ ] Unit test for any new pure logic (planner rule, chain, pose blend).
- [ ] `docs/systems/procedural-animation.md` updated (the plan's row, any new technique).
