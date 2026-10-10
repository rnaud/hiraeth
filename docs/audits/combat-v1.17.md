# Combat review, v1.17 (2026-10-09): the enemy roster, batch 5 (the late spirits and the roller)

<!-- audit-scores
overall: 4.50 / 5
label: the mean of the 3 batch-5 archetypes' totals (the shade, the pearl roller, the marionette), by eye
date: 2026-10-09
-->

A partial run of the combat-review skill (`.claude/skills/combat-review/SKILL.md`) over the last three archetypes of the
enemy roster (docs/design/enemy-roster.md, "Build plan", step 7; docs/systems/foes.md, "The enemy roster"): the shade
reworked onto its own body (a cloak worn by nothing, plan 9), the pearl roller (plan 16) and the marionette (plan 21).
With them every archetype is built: no stand-in is left. Batches 1–4 stand as in [v1.8](combat-v1.8.md),
[v1.9](combat-v1.9.md), [v1.13](combat-v1.13.md) and [v1.16](combat-v1.16.md); the guardians were not changed.

## Setup

- The batch's branch (commits cec851c3 and db0f1154 on main bed64a68, and the roller's tuning after this run), headless
  Chrome (muted, ANGLE Metal), the Arena, 1280 × 720, Enemies "normal"; `--kinds shade,roller,marionette --watch 24
  --version 1.17 --guardians no`, then the roller again after its tuning (`--kinds roller`).
- Each kind watched 24 s against a still traveller in its own skin (`HOME_SKIN`: Lorn II's hollow woodsman, the
  Hangar's ball-bearing snail, the Garden's glass puppet), then each move's blows through `Foes.hurt`, as in v1.8. The
  marionette was watched with its escort (`def.escort`: a crab), as a support is: its strings drive the crab, so its
  health a minute includes the driven crab's blows.
- Not played by hand: parry timing against the shade's feint (a guard raised for the cut it never makes is too early
  for the thrust's parry), the roller bounced off walls in a real world (the Arena is open), cutting the marionette's
  strings with the boomerang and the air cut, the yank's lift.

![Each kind at the height of its wind-up, in the Arena (nothing is marked on the ground: none of them throws)](combat-v1.17/telegraphs.webp)

## The scores

| kind | read | counter | space | fair | identity | combines | total | wind seen (s) | attacks/min | health/min | ttk combo | ttk charge | ttk air | ttk riposte | ttk shoot | ttk fire |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shade | 5 | 4 ✎5 | 4 | 5 ✎4 | 4 | 4 | 4.3 | 1.28 | 15 | 2.92 | 4.77 | 2.4 | 3.75 | 4.72 | 3.07 | 3.84 |
| pearl roller | 5 | 5 | 3 ✎4 | 5 ✎4 | 4 | 4 | 4.3 | 0.99 | 12.5 | 2.5 | 3.58 | 2.4 | 2.5 | 5.52 | 2.45 | 5.12 |
| marionette (with a crab) | 5 | 4 ✎5 | 4 ✎5 | 5 ✎4 | 4 ✎5 | 4 ✎5 | 4.8 | 1.20 | 10 | 2.92 | 3.58 | 2.4 | 2.5 | 6.73 | 2.45 | 2.56 |

Changed by eye (✎):

- **The shade's counterplay, 4 → 5:** the parry and riposte on its cut (its main lesson), an evade sideways from the
  feint's thrust, an ember that lights it solid (it can't step through its shadow, and the fire burns it double), a
  turn and a guard when its pool slides round beside you; the script counts its shot and ember only. **Fairness,
  5 → 4:** fifteen moves a minute and 2.92 bars on a still traveller is the duelist pressing you, and the feint is
  meant to bait an early guard; every move still has a body tell of 0.9–1.3 s (the sword back over the shoulder; the
  cut stopped halfway and the sword dropped to the hip; the cloak sinking into a pool).
- **The roller's space, 3 → 4:** its bowl runs 9 m along a lane and bounces off a wall back at you once (the ricochet
  twice), the next wall stalls it open, and its last roll ends in a ring to jump: it makes you use the walls and step
  off its line. **Fairness, 5 → 4:** a guard always answers its roll (it bounces off stunned), but rolling it takes no
  harm at all, and the shatter's ring follows the roll at once.
- **The marionette's counterplay, 4 → 5:** cut its strings (the blade's air cut, the boomerang, an ember) and the
  creature drops free and goes back to grazing; a guard cuts the yank's line; its dance leaves it hanging slack and
  open; the wings and the jets reach its body. **Space, 4 → 5:** it hangs over the fight a metre off the ground, keeps
  5 m off, lifts you off your feet. **Fairness, 5 → 4:** with a crab to drive, the crab's blows come quicker (its
  wind-ups four fifths as long) and light cuts don't stagger it: 2.92 bars a minute, answerable by cutting the strings
  first. **Identity, 4 → 5:** a puppet on four strings rising into a knot of smoke reads from anywhere, unlike anything
  else. **Combines, 4 → 5:** it is the roster's combination-maker: it turns the wildlife round it (even a grazing crab)
  against you, so a pack round a marionette is fought strings first.

## Motion (the procedural-animation skill; `node scripts/motion-audit/run.mjs shade shade@eclipse --pack`, `--pace=0.5`)

| subject | legs | slide/m, worst | reach span, lift (% of the leg) | steps/s full → half speed | groups | unison of two |
|---|---|---|---|---|---|---|
| shade | 2 | 0.01, 0.02 m | 19 %, 13 % | 2.50 → 1.50 | one boot at a time | −0.32 |
| shade (the Eclipse's) | 2 | 0.01, 0.01 m | 19 %, 13 % | 2.50 | one boot at a time | −0.32 |

The pearl roller has no feet: rolled up, its spin is locked to the distance it covers (angle × radius = the distance,
to 10⁻⁶ m: tests/archetypes-batch5.test.js), unrolled a ripple runs back along its foot by the distance glided. The
marionette never touches the ground: it hangs from its knot as a pendulum (src/motion-kit/machines.js Pendulum: it swings
behind as it sets off), each limb on its own loose spring, tugged up in turns as it moves.

Rubric (0–3): joints 3 (the shade's knees forward inside its empty boots, the puppet's ball joints at every bend), feet
3 (the boots planted, touching down late and lifting early; the roller's roll never slips), gait 3 (the boots one at a
time, the cadence following the speed; the roller's foot ripple by distance), weight 2 (the shade floats by design: its
body rides soft springs, the cloak lags it; the puppet hangs, no weight on anything), secondary 3 (the cloak swinging
back and round on springs, the ribbons on verlet chains rippling, the smoke breathing; the roller's stalks lagging; the
puppet's limbs on loose springs and its swing), anticipation 3 (each move its own pose: the sword back over the
shoulder with the hood turning to keep you in sight; the cut stopped halfway, the hood tilting, the sword dropped to the
hip; the cloak collapsing into a pool; the shell rocking three times with the stalks sinking; spinning in place,
glowing; both arms up with the fingers curling and the strings unspooling; one arm rising; the legs jerked up together),
ink 2 (the puppet's limbs are thin from 30 m: its strings and knot carry it), cost 3 (below).

## Cost (`node scripts/enemy-roster/bench.mjs`, the Arena, headless Chrome on the GPU, 1280 × 720)

| pack in view | quality | draw calls before → after | CPU ms before → after | GPU ms before → after |
|---|---|---|---|---|
| four shades (before: the old body, the skinned person with its flame) | High | 227 → 272 (312 on the first build) | 3.1–3.2 → 3.3–3.7 | 6.6–6.8 → 7.3–7.9 |
| the same | Steam Deck | 188–232 → 277 | 2.7–2.9 → 3.0–3.1 | 2.1–6.1 → 6.3–6.5 |
| six of batch 5 (two shades, two rollers, two marionettes; nothing before) | High | → 292 | → 4.0 | → 6.9 |
| the same | Steam Deck | → 296 | → 3.6 | → 6.7 |

A shade is 8 meshes (each material one skinned mesh on the kit's joints, the boots, their brass and the thighs one, the
eyes, the smoke, the face and the ribbons casting no shadow), a roller 7, a marionette 6 (its four strings one mesh
skinned between the knot and what they hold). The old shade was one skinned person and a flame card: the new body
costs about ten draw calls more a shade.

## The best and the weakest

- **The marionette (4.8)** changes every fight it is in: the creatures round it become the threat, and the answer is to
  cut its strings first, with the air cut, the boomerang or an ember.
- **The shade and the pearl roller (4.3):** the shade is the duelist the review asked for (v1.4: 3.0, "one sword cut,
  no answer but the blade"): a cut to parry, a feint that punishes an early guard, a step through its shadow that an
  ember stops. The roller is the simplest of the three by design, a charger answered by a guard or a wall; its threat on
  a still traveller rose from 0.63 to 2.5 bars a minute once it moved at 2.4 m/s (it was too slow to come back for a
  second roll).

## Recommendations (in TODO.md)

1. Play the shade's feint with a pad: is the thrust's parry window found after the false cut, or does every early
   guard simply block it? If the feint never pays, let a guard held through the false cut be broken by the thrust
   (a guard break: staggered, not hurt).
2. The roller in a world with walls (the Hangar's corridors, the Garden's terraces): does the bounce aim fairly at you,
   and does a wall stall read as an opening? Its sound is the shell family's two generic sets: give it a rolling rumble
   and a glassy shatter (batch 6, the sound families).
3. The marionette's strings as targets: playtest cutting them with the air cut from the ground and with the boomerang;
   if the air cut can't reach, lower the cut point (a third of the way down from its hands) or widen it.
4. The combat-review script: drive the marionette with a host and measure the time to free it (strings cut) as well as
   to kill; read the roller's glance while rolling (its shot and ember time to kill assume it unrolled).
5. Batch 5 against its sheets (docs/design/enemy-roster.md "Status"): the shade's cloak is a stiff flared cone with
   painted folds, not the sheet's drape; the roller's spiral is on both sides and the sheet-2 rocking runners are left
   out; the marionette's glass is opaque (no see-through surface) and its knot is round puffs, not billowing ink.

## Against the last report

v1.8's batch 1 scored 3.7–4.5 (mean 4.22), v1.9's batch 2 4.3–4.7 (mean 4.50), v1.13's batch 3 4.3–4.8 (mean 4.54),
v1.16's batch 4 4.7–4.8 (mean 4.78); batch 5 scores 4.3–4.8 by eye (3.8–4.3 by the script, the roller 4.3 after its
tuning; mean 4.50). Against what it replaces (v1.4): the shade 3.0 → 4.3 (two new moves, the feint and the step, and a
non-blade answer, the ember). The pearl roller and the marionette are new.
