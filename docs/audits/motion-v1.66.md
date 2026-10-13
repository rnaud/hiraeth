# The traveller's motion, v1.66 (2026-10-13)

<!-- audit-scores
overall: none
headline: 4 of 15 node scenarios green in the default way, as at v1.46 (46 limits failed, the same); matching 1 of 15; in the game every world red as before, a held foot slipping 5.8 cm in the Signal Market's street
date: 2026-10-13
-->

The motion QC (`.claude/skills/motion-qc/SKILL.md`) on main at v1.66, for issue #226: the traveller driven by scripted
hands in node on the gait harness's course (15 scenarios) and in three worlds in muted headless Chrome, each in the
default way (`moves`: the loops with the captured starts, stops and turns) and with motion matching (`mm`, `?mm=1`). The
first run kept as a report; the tables before are docs/systems/animation.md, "The motion QC" (the v1.46 round, issue #57).

## Setup

- main `0949c08a` (v1.66), node 24 (Zed's) on the M4 Pro; the browser runs on the GPU (ANGLE Metal), 1280 × 720, a fresh
  boot per world and way, the camera held 3.6 m behind; the Mac shared (load 7-50: the node numbers don't depend on it,
  the browser's frame times do).
- `node scripts/motion-qc/run.mjs <dir> --ways moves,mm` and `node .claude/skills/motion-qc/run.mjs <dir> --ways moves,mm`
  (the desert's dunes, the Signal Market's street, the Arena's floor).

## Node, the default way (moves), v1.46 → v1.66

| scenario · way | verdict | slide p95 (cm) | slide max (cm) | held (cm) | pops /min | jolts /min | boundary (cm) |
|---|---|---|---|---|---|---|---|
| walk → run → 180° turn → stop | red → red | 7.1 → 7.1 | 7.3 → 7.3 | 1.6 → 1.6 | 13 → 13 | 11 → 11 | 11.7 → 11.7 |
| walk, 90° turn, stop | green → green | 4.3 → 4.3 | 4.3 → 4.3 | 0.7 → 0.7 | 0 → 0 | 0 → 0 | 1.3 → 1.3 |
| turn round on the spot | red → red | 8.5 → 9.4 | 8.5 → 9.4 | 1.0 → 1.0 | 3 → 3 | 2 → 2 | 6.3 → 6.3 |
| up the ramp, stand | red → red | 4.3 → 4.3 | 4.3 → 4.3 | 1.4 → 1.4 | 7 → 9 | 9 → 9 | 8.8 → 9.1 |
| stairs up, stand, down | red → red | 6.9 → 6.9 | 6.9 → 6.9 | 0.7 → 0.7 | 12 → 12 | 19 → 19 | 9.6 → 9.6 |
| slow walk (half stick), stop | red → red | 6.1 → 6.1 | 6.1 → 6.1 | 1.3 → 1.3 | 0 → 0 | 0 → 0 | 1.7 → 1.7 |
| jog, 45° and back, stop | green → green | 4.3 → 4.3 | 4.3 → 4.3 | 0.7 → 0.7 | 0 → 0 | 0 → 0 | 1.8 → 1.8 |
| stand still 6 s | green → green | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 | 0 → 0 | 0 → 0 | 0.0 → 0.0 |
| gaits: walk → jog → sprint → jog → walk → stop | red → red | 6.8 → 6.8 | 7.2 → 7.2 | 1.6 → 1.6 | 10 → 10 | 7 → 7 | 1.7 → 1.7 |
| starts and stops, walk and run | red → red | 9.7 → 9.7 | 15.3 → 15.3 | 1.7 → 1.7 | 15 → 15 | 5 → 5 | 8.4 → 8.4 |
| pivots standing: 90° each way, 180° | red → red | 14.0 → 14.0 | 14.0 → 14.0 | 2.7 → 2.7 | 5 → 5 | 4 → 4 | 6.2 → 6.2 |
| pivot 180° at a jog, and at a sprint | red → red | 8.5 → 8.5 | 13.7 → 13.7 | 2.3 → 2.3 | 21 → 21 | 16 → 16 | 8.5 → 7.9 |
| curve: the stick round a circle at a jog | green → green | 4.3 → 4.3 | 4.3 → 4.3 | 0.7 → 0.7 | 0 → 0 | 0 → 0 | 1.6 → 1.6 |
| down the ramp, stop on it | red → red | 7.0 → 7.0 | 7.0 → 7.0 | 0.6 → 0.6 | 13 → 13 | 9 → 9 | 6.3 → 6.3 |
| stairs at a run | red → red | 6.9 → 6.9 | 6.9 → 6.9 | 1.4 → 1.4 | 19 → 19 | 14 → 14 | 3.6 → 3.6 |

red runs 11 → 11 of 15; limits failed 46 → 46; mean slide p95 6.6 → 6.6 cm; mean pops 8.0 → 8.0 /min; mean jolts 6.4 →
6.4 /min; mean worst boundary 5.2 cm. Matching (`mm`): red 14 → 14 of 15, limits failed 76 → 75, slide p95 11.5 → 12.5
cm, pops 13.4 → 10.9 /min, jolts 14.6 → 11.7 /min; the matcher 95 µs a frame on average in node (search frames ~160).
(v1.46's "before" for the rows unchanged since v1.0 is that round's "after"; the rows match to the tenth but the turn
on the spot, whose slide moved 0.9 cm.)

## In the game

| world · way | verdict | slide p95 / max (cm) | held (cm) | pops /min | jolts /min | boundary (cm) | crossed | stop (s) | Animator µs |
|---|---|---|---|---|---|---|---|---|---|
| desert-dunes · moves | red | 8.8 / 9.6 | 2.4 | 38 | 23 | 12.5 | 6 % | 0.97 | 65 |
| desert-dunes · mm | red | 13.0 / 84.6 | 3.2 | 43 | 45 | 11.8 | 12 % | never | 106 |
| bazaar-street · moves | red | 7.1 / 22.2 | **5.8** | 22 | 18 | 10.5 | 12 % | never | 77 |
| bazaar-street · mm | red | 12.3 / 22.2 | 7.7 | 29 | 28 | 11.0 | 6 % | never | 110 |
| arena-floor · moves | red | 9.5 / 19.6 | 1.5 | 26 | 15 | 9.4 | 12 % | never | 86 |
| arena-floor · mm | red | 29.6 / 78.9 | 1.9 | 31 | 35 | 10.5 | 12 % | never | 140 |

Against v1.0's round (animation.md: pops 46, 32 and 29 a minute on the sand, the Market and the Arena; after v1.46 the
Arena 19 a minute, jolts 16, crossed 8 %): the sand 46 → 38, the Market 32 → 22, the Arena 19 → 26 pops a minute, crossed
8 → 12 %. One run each in a noisy browser: the Arena's rise is inside two runs' spread there, but worth a second look.

## Findings

| # | severity | where | measure | picture | cause | fix |
|---|---|---|---|---|---|---|
| 1 | noticeable | the Signal Market's street, the default way | a held foot moves 5.8 cm over its hold (limit 2), a foot slides 22 cm "over a step" | [bazaar-street](motion-v1.66/bazaar-street.moves.webp) | the street's kerbs and the market's people: strollers walk into him (the crowd pushes; feet.js holds the foot where the body no longer is) and a step's edge under a planted ball | issue #288 |
| 2 | only when looking | the Market and the Arena, both ways | the stop never settles (both feet held and still for 0.3 s) | – | idle's settling steps run on past the script's last second, or the stop's last step lands on the kerb; desert's stop settles in 0.97 s | issue #288 |
| 3 | only when looking | every sprint and pivot at speed (node and game) | the calf 23 rad/s off its neighbours at push-off; crossed feet 6-12 % of a pivot | [arena-floor](motion-v1.66/arena-floor.moves.webp) | the sprint loop's own push-off; the second foot stepping round (v1.46's "left red") | known; the captures of #47 |
| 4 | look | matching, everywhere | 14 of 15 red, slides to 85 cm in the game | – | no starts, stops or turns captured at the game's speeds | known: #47 |

## Not checked

The City-Shaft (left out since v1.0: the script runs into railings), `--cpu 4` (the cost under a handheld's CPU), a second
browser run per world, the Unity port's animator.
