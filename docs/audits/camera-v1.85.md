# The follow camera, v1.85 (2026-10-18)

<!-- audit-scores
overall: none
headline: 17 of 17 scenarios green in all 21 runs (v1.66: 13 of 15; v1.68: 19 of 19 runs); the antechamber's lock-on hides the blot behind him 9.5-10 % of the locked frames, at the 10 % line
date: 2026-10-18
-->

The camera QC (`.claude/skills/camera-qc/SKILL.md`) on main at v1.85, for issue #467: the 17 scripted scenarios in the
real game (two more than [v1.66](camera-v1.66.md): ship-walk, issue #324, and snapper-lock, issue #359), the camera
recorded every frame after `rig.update`, the game stepped 1/60 s a frame (v1.68, issue #289), ante-lock and arena-lock
three runs each with the step wobbled ±5 %.

## Setup

- main `8f01feae5` (v1.85), Medium, muted headless Chrome on the GPU (ANGLE Metal, M4 Pro), 1280 × 720, seed 1; the Mac
  shared (load 20-30 during the run: the stepped clock makes it repeat whatever the load).

## Scenarios (v1.66 → v1.85)

| scenario | verdict | pops | jumps | look jumps | spins | spin p95 (°/s) | clip | hidden | out | rev/s | rough (cm) | arm (m) | foe hidden | framing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| train-walk | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.53 → 0.53 | 1.71–4.8 | – | 31 → 32 % |
| train-run | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0.22 | 0.82 → 0.84 | 0.99–4.8 | – | 30 % |
| train-turns | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.50 → 0.58 | 1.43–1.9 | – | – |
| train-sleeper | green → green | 0 | 0 | 0 | 0 | 27 → 24 | 0 % | 0 % | 0 % | 0.27 | 0.82 → 0.60 | 0.56–1.9 | – | – |
| train-jumps | green → green | 0 | 0 | 0 | 1 | 0 | 0 % | 0 % | 0 % | 0.13 → 0.25 | 1.29 → 1.33 | 1.67–1.9 | – | – |
| train-roof | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.29 → 0.26 | 2.64–4.8 | – | 32 % |
| train-deck | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0.10 → 0.12 | 0.62 → 0.74 | 1.91–4.8 | – | 34 % |
| desert-open | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0.8 → 0 % | 0 % | 0 | 0.56 → 0.58 | 4.8 | – | 31 % |
| desert-shop | **red** → green | 0 | 2 → 0 | 3 → 0 | 0 | 6 → 4 | 0 % | 0 % | 0 % | 0.13 | 1.81 → 0.69 | 0.69–1.9 | – | – |
| ship-walk (new) | – → green | 0 | 0 | 0 | 0 | 48 | 0 % | 0 % | 0.5 % | 0.14 | 0.59 | 0.04–1.91 | – | – |
| bazaar-streets | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.05 → 0.03 | 4.8 | – | 33 % |
| ante-lock (3 runs) | green, then red → green ×3 | 0 | 0 | 0 | 0 | 135 → 148-157 | 0-0.1 % | 0 % | 0 % | 0.59 → 0.58-0.81 | 1.00 → 1.13-1.21 | 0.58–4.43 | 4.5 → **9.5-10.0 %** | – |
| guardian-lock | green → green | 0 | 0 | 0 | 0 → 1 | 33 → 34 | 0 % | 0 % | 0 % | 0.19 → 0.28 | 0.57 → 0.52 | 1.5–11.22 | 0 % | – |
| snapper-lock (new) | – → green | 0 | 0 | 0 | 0 | 40 | 0 % | 0 % | 0 % | 0.09 | 0.50 | 2.6–9.6 | 0 % | – |
| arena-lock (3 runs) | **red** → green ×3 | 0 | 0 | 0 | 0 | 137 → 174-181 | 0 % | 0 % | 0 % | 0 | 1.70 → 0.77-1.26 | 4.8 | 1.4 → 1.9-6.8 % | 33 → 32 % |
| arena-lock-lizard | green → green | 0 | 0 | 0 | 0 | 28 → 111 | 0 % | 0 % | 0 % | 0 | 0.43 → 0.36 | 4.8 | 0 → 1.1 % | 33 → 32 % |
| incal-pillar | green → green | 0 | 1 | 0 | 0 | 20 | 0 % | 0 % | 0 % | 0 | 0.78 → 0.76 | 12.67–13.4 | – | 13 % |

v1.66's two reds were fixed by #289 (v1.68: the stepped clock, the shoulder's look ahead, the arm's spring locked on), and
they hold: desert-shop's look jumps 3 → 0, arena-lock's roughness 1.70 → 0.77-1.26 cm, ante-lock green in every run.

## Findings

| # | severity | scenario | measure | cause | fix |
|---|---|---|---|---|---|
| 1 | look | ante-lock (the Undertower's antechamber, locked on to a blot, three runs) | foe hidden 10.0 / 9.5 / 9.8 % of the locked frames (limit 10 %; v1.66 4.5 %, v1.68 4.3-5.1 %) | the scripted way backs him into the corner by the passage twice (`ANTE_WAY`, v1.68); with the arm short there (0.58 m) the blot lines up behind him. Doubled since v1.68 with no camera change named; the lock's room (`LOCK_ROOM`) or the boss framing (v1.71-v1.77) are where to look | none filed: at the line, not over; rerun after any lock-camera change |
| 2 | look | arena-lock, arena-lock-lizard | spin p95 137 → 174-181 °/s, 28 → 111 °/s (no spin counted) | the lock's swing round the foe turning faster than at v1.66; not traced to a commit. No frame turns more than the hands asked by the spin's measure | none: under the limits (combat-review owns the lock's feel) |
| 3 | look | ship-walk | arm down to 0.04 m, out of frame 0.5 % | the stick toward the camera into the cabin's walls on purpose (issue #324): the lens leaves him out of the view (`heroCut`) | by design, under the limits |
| 4 | look | incal-pillar | framing 13 % | riding the air pillar, the arm 12.7-13.4 m (framing is judged on foot only) | by design |

## Unity

The follow camera is the same code in both engines (`CameraRig`, src/player.js, run in the engines' VM through
src/host/game-host.js `cameraFollow`), so these numbers stand for the rig's logic in Unity; what Unity adds is its own
collision mirror and frame times. Not run in Unity (the QC drives the page); the node walks (`sim-lock.mjs`,
`sim-shop.mjs`, `sim-train.mjs`, `sim-guardians.mjs`) exercise the rig without a page and are held by the camera tests.

## Not checked

The temples' rooms other than the antechamber and the Hush-House (`sim-guardians.mjs` not rerun), presets other than
Medium, a controller's real stick (scripted hands only), the Unity player's own frame pacing.
