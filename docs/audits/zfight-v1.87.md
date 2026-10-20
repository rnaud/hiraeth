# Z-fighting, v1.87 (2026-10-20)

<!-- audit-scores
overall: none
headline: 14 of 14 temples at or under their baselines, six of them well under; the worlds 6475 (v1.85) → 6201 sites; the Glass Dunes 268 → 0 (#498), the Garden 8 → 0, Lorn 11 → 5, the Floating City 19 → 12; nothing new but two crates in the Hush-House's court
date: 2026-10-20
-->

The zfight-qc skill (`.claude/skills/zfight-qc/SKILL.md`) on main at v1.87, for issue #556: every route world built as
the game builds it, in node (`node scripts/zfight/audit.mjs --worst 5 --out …`), its temples counted apart, and the ship
(`--ship`). Against [v1.85](zfight-v1.85.md); the seven side worlds are discarded (#503) and left out.

## Setup

- main `3da6e2539` (v1.87), node 24, the finder's defaults (planes within 4 mm, 0.05 m² shared, one site per pair of looks
  per 3 m, only what someone standing near could see; since v1.86 two faces must also lie within 4 mm of each other where
  they overlap, issue #498), the pieces named (`names.mjs`).
- The City-Shaft took 260 s, the rest 8-46 s each. A shared Mac (load 22-28); the counts don't depend on it.
- Each world's sites grouped by the two pieces that made them (`names.mjs`' parts) and compared with v1.85's run, group
  by group, to name what came and went.

## The counts, world by world

Visible sites (the world's, with its temples in it):

| world | v1.85 | v1.87 | its temples (v1.87; baseline) | what changed |
|---|---|---|---|---|
| desert | 29 | **24** | the Rose House 0 (0) | Qanat's lathe and a stain (2), a carved frame, the wheels' spokes and a lamp-stone in the Hearth's jambs gone; left: Qanat's houses' walls, the Hearth's arch and walls (known) |
| incal | 4064 | 4092 | the Warden's Well 6 (39) | the city down the pit's houses and towers merged against each other: +28 in their merges, −20 in the quarters; it moves run to run (v1.68: 4070-4101) |
| arzach | 6 | **3** | the Belfry 1 (10), the Aerie 2 (3) | the rotundas' portholes in their banded course (2) and a makers' mark gone |
| glassdunes | 268 | **0** | the Clock-House 0 (0) | the city under the sand's rooms set apart (#498, v1.86) |
| buried | 1708 | 1707 | the Engine-House 0 (0) | the drawn city's two layers (known) |
| edena | 7 | **5** | the Greenhouse 1 (2) | the ground's steps against the nursery's mark and the greenhouse's water gone |
| spheres | 8 | **0** | the Footprint 0 (0) | the paths on the ground's steps gone |
| perdide | 11 | **5** | the Lamp-House 1 (3), the Hush-House 2 (2) | the keepers' stakes (8) gone; **new: two crates in the Hush-House's court** (0.25 m² each, below) |
| bazaar | 74 | 73 | the Undertower 3 (8) | the avenue's stalls' counters and the posters' strips (v1.68's "left") |
| underwater | 43 | 42 | the Whale-House 5 (6) | a porthole; the big dome against the café dome (known) |
| moonfoundry | 238 | 238 | the Casting-House 0 (0) | the bowl's cells, the night pour, the street's sectors (known) |
| spacecity | 19 | **12** | the Mooring-House 0 (0) | four chimneys and three windows gone (its held count 20) |
| the ship | 0 | 0 | – | – |

All in all 6475 → 6201 (−274; the Glass Dunes' 268 most of it). Every temple at or under its baseline in
`tests/zfight.test.js`; six well under it: the Warden's Well 6 of 39, the Belfry 1 of 10, the Undertower 3 of 8, the
Lamp-House 1 of 3, the Greenhouse 1 of 2, the Whale-House 5 of 6; the City Floating in Space 12 of its held 20.

## Findings

| # | severity | where | sites | cause | fix |
|---|---|---|---|---|---|
| 1 | only when looking | Lorn, the Hush-House's fight court (by 82, 3.5, 11) | 2 (0.25 m² each) | `crate` (src/gadgets/yard-kit.js:145): the frame's bars along x are moved out by 0.012 on z but not on y, so their top and bottom faces lie in the box's own top and bottom faces (the dark frame over the wood). New since v1.86's courts (#518) | add `ay * 0.012` to their y, as the other bars have: #566 |
| 2 | look | the temples' baselines | – | six temples (and the Floating City's held count) sit well under what `tests/zfight.test.js` allows, so a new site in them would pass unseen | lower them to the counts above once the test's own builds agree: #566 |
| 3 | only when looking | the Signal Market's avenue | 73 | each stall's counter ends in its fascia's plane, the posters' strips flush with their plates | v1.68's "left": no new issue |
| 4 | only when looking | the Underwater City, the big dome and the café dome | 26 | the café domes' feet in the big dome's plane | known since v1.68; no new issue |
| 5 | look | the City-Shaft's pit, the Buried Machine's two cities, the Moon Foundry's cells, Qanat's houses, the Hearth | – | known since v1.44 (rendering.md "Left") | – |

## The v1.85 findings, one by one

| v1.85 | now | evidence |
|---|---|---|
| 1. the Glass Dunes' city under the sand, 268 sites (#498) | **fixed** | 268 → 0; held at none by `WORLD_ZFIGHT_BASELINE` (v1.86) |
| 2. the Signal Market's avenue, 69 | not fixed (left on purpose) | 69 → 73 in the avenue's groups (the count of the whole world 74 → 73) |
| 3. the Underwater City's domes, 26 | not fixed (left) | 26 → 26 |
| 4. the known clusters (the City-Shaft, the Buried Machine, the Moon Foundry, Qanat, the Hearth) | not fixed (left) | 4064 → 4092, 1708 → 1707, 238 → 238, 29 → 24 |
| (the five temples under their baselines: lower them) | not done | the same temples, now six, still under |

## In the game

Not looked at in the game this time (the counts are geometry). The Hush-House court's two crates are 0.25 m² of dark frame
over light wood, seen from above on the crates' tops: a few pixels' stripe at a grazing angle.

## What was not checked

The moving pieces while they move, instanced props, LOD copies drawn one at a time (v1.87's levels of detail for the big
still meshes on the Retroid, #404, are Unity's: the web's meshes are counted once), the side worlds and detours, the Unity
port (it has no `polygonOffset` but in its footprints' shader; nothing new uses it since v1.85).
