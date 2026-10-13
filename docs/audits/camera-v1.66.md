# The follow camera, v1.66 (2026-10-13)

<!-- audit-scores
overall: none
headline: 13 of 15 scenarios green in the full run; run again, the Undertower's antechamber lock-on went red (the lens over his head, 448°/s), the Arena's lock-on rough both times, Qanat's shop red as at v1.40
date: 2026-10-13
-->

The camera QC (`.claude/skills/camera-qc/SKILL.md`) on main at v1.66, for issue #226: the 15 scripted scenarios in the
real game, the camera recorded every frame after `rig.update`. The first run kept as a report; the earlier numbers are
docs/systems/movement-and-camera.md, "The camera QC and what it fixed" (v1.40), "The lens past a door's jamb" (v1.50)
and "Small rooms" (v1.59).

## Setup

- main `0949c08a` (v1.66), Medium, muted headless Chrome on the GPU (ANGLE Metal, M4 Pro), 1280 × 720, seed 1, every
  scenario at 60 fps; the Mac shared (load 6-8 during the run).
- The node walks through the real collision (`scripts/camera-qc/sim-train.mjs`) and `tests/camera-qc.test.js`: green
  as held (the run's small pop at a door taken at speed is the test's allowance).

## Scenarios

| scenario | verdict | pops | jumps | look jumps | spins | spin p95 (°/s) | clip | hidden | out | rev/s | rough (cm) | arm (m) | foe hidden | framing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| train-walk | green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.53 | 1.72–4.8 | – | 31 % |
| train-run | green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0.22 | 0.82 | 1.11–4.8 | – | 30 % |
| train-turns | green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0.13 | 0.50 | 1.44–1.9 | – | – |
| train-sleeper | green | 0 | 0 | 0 | 0 | 27 | 0 % | 0 % | 0 % | 0.27 | 0.82 | 0.56–1.9 | – | – |
| train-jumps | green | 0 | 0 | 0 | 1 | 0 | 0 % | 0 % | 0 % | 0.13 | 1.29 | 1.65–1.9 | – | – |
| train-roof | green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.29 | 2.64–4.8 | – | 32 % |
| train-deck | green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0.10 | 0.62 | 2.62–6.13 | – | 34 % |
| desert-open | green | 0 | 0 | 0 | 0 | 0 | 0 % | 0.8 % | 0 % | 0 | 0.56 | 4.8 | – | 31 % |
| desert-shop | **red** | 0 | 2 | 3 | 0 | 6 | 0 % | 0 % | 0 % | 0.13 | 1.81 | 0.73–1.9 | – | – |
| bazaar-streets | green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.05 | 4.8 | – | 33 % |
| ante-lock | green | 0 | 0 | 0 | 0 | 135 | 0 % | 0 % | 0 % | 0.59 | 1.00 | 0.56–3.38 | 4.5 % | – |
| guardian-lock | green | 0 | 0 | 0 | 0 | 33 | 0 % | 0 % | 0 % | 0.19 | 0.57 | 1.87–2.6 | 0 % | – |
| arena-lock | **red** | 0 | 0 | 0 | 0 | 137 | 0 % | 0 % | 0 % | 0 | 1.70 | 4.8 | 1.4 % | 33 % |
| arena-lock-lizard | green | 0 | 0 | 0 | 0 | 28 | 0 % | 0 % | 0 % | 0 | 0.43 | 4.8 | 0 % | 33 % |
| incal-pillar | green | 0 | 1 | 0 | 0 | 20 | 0 % | 0 % | 0 % | 0 | 0.78 | 12.3–13.4 | – | 13 % |

Against v1.40-v1.59: the train's seven green in this run (train-run was green or one turn over in v1.40's runs, green
since v1.50); desert-open green (it was red at v1.50 for the arm cut behind a dune's crest; no pops now, the framing
31 %, inside Sable's 28-40 %); the lock-on scenarios of combat-v1.47 and v1.61 green but the Arena's in the full run. A second run of the three worst (`--only arena-lock,desert-shop,ante-lock`): desert-shop red again (2 look jumps, 2.1 cm), arena-lock red again (2.0 cm), ante-lock **red** (below).

## Findings

| # | severity | scenario | measure | picture | cause | fix |
|---|---|---|---|---|---|---|
| 1 | only when looking | desert-shop (Qanat's shop, 8 × 7 m, walked round its edges) | 2 jumps, 3 look jumps in 7.8 s, roughness 1.8 cm | [desert-shop](camera-v1.66/desert-shop.webp) | the look point's small kinks (≤ 18 cm) as it is pushed off the counter and the walls; the arm itself steady (no pops) | known since v1.40; the room-fit (v1.59) doesn't take it, the shop being shut in under 9.5 m but its counter inside the arm's reach. In issue #289 |
| 2 | only when looking | arena-lock (both runs: 1.7 and 2.0 cm) (circling an ink blot, stepping in and back) | roughness 1.7 cm (limit 1.5), spin p95 137°/s, the camera 9 cm off its path at the worst frames | [arena-lock](camera-v1.66/arena-lock.webp) | turning round the foe at a run, the locked camera's path kinks a few centimetres a frame as the lock's swing and the follow's spring disagree; no pop, nothing hidden (foe hidden 1.4 %) | new since combat-v1.61's green, confirmed by a second run ([run 2](camera-v1.66/arena-lock-run2.webp)). In issue #289 |
| 3 | noticeable | ante-lock (locked on to an ink blot in the Undertower's antechamber, 8.8 × 7.4 m) | green in the full run (foe hidden 4.5 %, arm to 0.56 m); **red run again**: 7 jumps and 6 look jumps in 10 s, out of frame 5.6 %, roughness 4.0 cm, one frame looking straight down on his head at 448°/s with the lens 0.53 m off | [run 1](camera-v1.66/ante-lock.webp), [run 2](camera-v1.66/ante-lock-run2.webp) | the blot is not where it was the first time (it moves on its own), so the step back puts him in the corner by the door: the look point is shoved 0.4-0.6 m off the wall and the short arm tips over the head (`SHORT_TILT`) | issue #289: two runs that differ this much are the bug as much as the red one |
| 4 | look | incal-pillar | framing 13 % | – | riding the air pillar the arm is 12-13 m (framing is judged on foot only) | by design |

## Not checked

The ship's interior and the temples' rooms (v1.59's probe, `sim.mjs`, not rerun), presets other than Medium, the Unity
port's rig (it lacks v1.50's eased shove), a controller's real stick (scripted hands only).
