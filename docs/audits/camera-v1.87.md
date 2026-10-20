# The follow camera, v1.87 (2026-10-20)

<!-- audit-scores
overall: none
headline: 17 of 17 scenarios green in all 21 runs, as at v1.85, every measure within a run's spread; the antechamber's lock-on still hides the blot behind him 9.5-10 % of the locked frames, at the 10 % line; every temple's guardian framed from every point
date: 2026-10-20
-->

The camera QC (`.claude/skills/camera-qc/SKILL.md`) on main at v1.87, for issue #556: the 17 scripted scenarios in the real
game, the camera recorded every frame after `rig.update`, the game stepped 1/60 s a frame, ante-lock and arena-lock three
runs each with the step wobbled ±5 %; and the node walk of the temples' guardians (`sim-guardians.mjs`, not run at v1.85).
Against [v1.85](camera-v1.85.md).

## Setup

- main `3da6e2539` (v1.87), Medium, muted headless Chrome on the GPU (ANGLE Metal, M4 Pro), 1280 × 720, seed 1; the Mac
  shared (load 28-34 during the run: the stepped clock makes it repeat whatever the load).
- Changed since v1.85 near the camera: #534 (v1.86, the fight temples' iso camera: not one of these scenarios), #514
  (Lorn's skiff), #523 (the wings glide further). Nothing in `CameraRig` (src/player.js).

## Scenarios (v1.85 → v1.87)

| scenario | verdict | pops | jumps | look jumps | spins | spin p95 (°/s) | clip | hidden | out | rev/s | rough (cm) | arm (m) | foe hidden | framing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| train-walk | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.53 → 0.52 | 1.73–4.8 | – | 32 % |
| train-run | green → green | 0 | 0 | 0 | 0 | 0 → 1 | 0 % | 0 % | 0 % | 0.22 | 0.84 → 0.80 | 0.96–4.8 | – | 30 % |
| train-turns | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.58 → 0.58 | 1.43–1.9 | – | – |
| train-sleeper | green → green | 0 | 0 | 0 | 0 | 24 → 26 | 0 % | 0 % | 0 % | 0.27 | 0.60 → 0.65 | 0.57–1.9 | – | – |
| train-jumps | green → green | 0 | 0 | 0 | 1 | 0 | 0 % | 0 % | 0 % | 0.25 → 0.38 | 1.33 → 1.33 | 1.27–1.9 | – | – |
| train-roof | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.26 → 0.26 | 2.64–4.8 | – | 32 % |
| train-deck | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0.12 | 0.74 → 0.74 | 1.91–4.8 | – | 34 % |
| desert-open | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.58 → 0.56 | 4.8 | – | 31 % |
| desert-shop | green → green | 0 | 0 | 0 | 0 | 4 | 0 % | 0 % | 0 % | 0.13 | 0.69 → 0.79 | 0.69–1.9 | – | – |
| ship-walk | green → green | 0 | 0 | 0 | 0 | 48 → 37 | 0 % | 0 % | 0.5 % | 0.14 → 0.19 | 0.59 → 0.60 | 0.04–1.91 | – | – |
| bazaar-streets | green → green | 0 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 | 0.03 → 0.04 | 4.8 | – | 33 % |
| ante-lock (3 runs) | green ×3 → green ×3 | 0 | 0 | 0 | 0 | 148-157 → 148-155 | 0-0.1 → 0 % | 0 % | 0 % | 0.58-0.81 → 0.58-0.70 | 1.13-1.21 → 1.13-1.25 | 0.58–4.43 | 9.5-10.0 → 9.5-10.0 % | – |
| guardian-lock | green → green | 0 | 0 | 0 | 1 | 34 | 0 % | 0 % | 0 % | 0.28 | 0.52 → 0.51 | 1.5–11.77 | 0 % | – |
| snapper-lock | green → green | 0 | 0 | 0 | 0 | 40 | 0 % | 0 % | 0 % | 0.09 | 0.50 → 0.60 | 2.6–9.54 | 0 % | – |
| arena-lock (3 runs) | green ×3 → green ×3 | 0 | 0 | 0 | 0 | 174-181 → 173-181 | 0 % | 0 % | 0 % | 0 | 0.77-1.26 → 0.77-1.23 | 4.8 | 1.9-6.8 → 2.1-2.4 % | 32 % |
| arena-lock-lizard | green → green | 0 | 0 | 0 | 0 | 111 → 110 | 0 % | 0 % | 0 % | 0 | 0.36 → 0.36 | 4.8 | 1.1 → 1.1 % | 32 % |
| incal-pillar | green → green | 0 | 1 | 0 | 0 | 20 | 0 % | 0 % | 0 % | 0 | 0.76 → 0.76 | 12.69–13.4 | – | 13 % |

## The guardians locked on (`node scripts/camera-qc/sim-guardians.mjs`, the rig in node in each temple's arena)

All fourteen framed from every point round them (5-12 points each): him, his feet, the floor and the guardian 100 % on
the screen at the worst point; the guardian's top out of frame from some points for the tall ones (the warden, the Elder,
the Cloud-Mother, the Listener, the Echo, the First Sign: top 0 % at their worst point), as at #359. The node walk loads
the old procedural bodies for the Cistern-Keeper and the Aerie's Elder (it can't fetch the generated GLBs: "the generated
body did not load"), so their boxes are the old bodies' (finding 2).

## The v1.85 findings, one by one

| v1.85 | now | evidence |
|---|---|---|
| 1. ante-lock: the blot hidden behind him 9.5-10 % of the locked frames (limit 10) | not fixed (unchanged) | 10.0 / 9.5 / 9.8 %, the same three runs to the tenth |
| 2. arena-lock: the lock's swing faster than v1.66 (spin p95 174-181 °/s) | not fixed (no spin counted) | 173-181 °/s |
| 3. ship-walk: the arm down to 0.04 m, out of frame 0.5 % (by design) | as designed | 0.04 m, 0.5 % |
| 4. incal-pillar: framing 13 % (riding the pillar, by design) | as designed | 13 % |

## Findings

| # | severity | scenario | measure | cause | fix |
|---|---|---|---|---|---|
| 1 | look | ante-lock | foe hidden 9.5-10.0 % (limit 10 %) | the scripted way backs him into the corner by the passage twice; the arm short there (0.58 m) lines the blot up behind him | none: at the line, unchanged since v1.85 |
| 2 | look | sim-guardians (the tool) | the Keeper's and the Aerie's Elder's generated bodies not loaded in node | the walk fetches `/guardians/<id>/model.glb` by URL; node has no page to fetch from (motion-audit's `loadSkin` reads the file instead) | read the GLB from `public/` as walk.mjs does: #566 |
| 3 | look | the fight temples' iso camera (#534) | not in the QC | new since v1.85: a fixed iso camera, judged by #534's own checks and the combat review | add a scenario when it next changes |

## Unity

The follow camera is the same code in both engines (`CameraRig`, run in the engines' VM through src/host/game-host.js
`cameraFollow`), so these numbers stand for the rig's logic in Unity; what Unity adds is its own collision mirror and
frame times. Not run in Unity (the QC drives the page).

## Not checked

Presets other than Medium, a controller's real stick (scripted hands only), the Unity player's own frame pacing, the fight
temples' iso camera.
