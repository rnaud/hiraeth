# Z-fighting, v1.85 (2026-10-18)

<!-- audit-scores
overall: none
headline: 14 of 14 temples at or under their baselines, five of them well under; the worlds 6828 (v1.66) → 6475 sites; one new cluster: the Glass Dunes 2 → 268, the city under the sand rebuilt (#393/#426) with its jutting rooms flush on each other
date: 2026-10-18
-->

The zfight-qc skill (`.claude/skills/zfight-qc/SKILL.md`) on main at v1.85, for issue #467: every route world built as
the game builds it, in node (`node scripts/zfight/audit.mjs --worst 5 --out …`), its temples counted apart. Against
[v1.66](zfight-v1.66.md) and the v1.68 counts in docs/systems/rendering.md, "Z-fighting" (issue #286's fixes).

## Setup

- main `8f01feae5` (v1.85), node 24, the finder's defaults (planes within 4 mm, 0.05 m² shared, one site per pair of looks
  per 3 m, only what someone standing near could see), the pieces named (`names.mjs`).
- The City-Shaft took 254 s, the rest 7-27 s each. A shared Mac (load 23-47); the counts don't depend on it.

## The counts, world by world

Visible sites (the world's, with its temples in it):

| world | v1.66 (after its fixes) | v1.68 | v1.85 | its temples (v1.85; baseline) | what most of it is |
|---|---|---|---|---|---|
| desert | 29 | 29 | 29 | the Rose House 0 (0) | Qanat's houses' walls, the Givers' Hearth's arch and walls (known) |
| incal | 4070 | 4070-4101 | 4064 | the Warden's Well 8 (39) | the city down the pit: its houses' details and towers merged against each other (known) |
| arzach | 16 | 13 | **6** | the Belfry 3 (10), the Aerie 3 (3) | a portal's band on a landmark's terrace, a porthole in a banded course |
| glassdunes | 2 | 2 | **268** | the Clock-House 1 (1) | **new**: the city under the sand, `crowdedBlock` (197 of them: its jutting rooms against each other, src/glass-dunes-masses.js:160), its openings (8), a courtyard's pale floor on the ground's steps (7) |
| buried | 1707 | 1707 | 1708 | the Engine-House 0 (0) | the drawn city's two layers (known) |
| edena | 5 | 5 | 7 | the Greenhouse 1 (2) | the ground's steps against the temple's stairs and the greenhouse's water (2+1), the water stair's beds (2) |
| spheres | 34 | 10 | **8** | the Footprint 0 (0) | the paths on the ground's steps (known, v1.68) |
| perdide | 16 | 16 | **11** | the Lamp-House 1 (3), the Hush-House 2 (2) | the keepers' stakes (8, known) |
| bazaar | 151 | 98 | **74** | the Undertower 3 (8) | the avenue's stalls' counters in their fascias' plane (52) and the posters' strips (17): v1.68's "left" |
| underwater | 72 | 50 | **43** | the Whale-House 6 (6) | the big dome against the café dome (26), the berth's lock (6) |
| moonfoundry | 266 | 266 | **238** | the Casting-House 0 (0) | the bowl's own faces (200: the cells, known), the night pour (13), the street's sectors (12) |
| spacecity | 460 | 22 | **19** | the Mooring-House 0 (0) | rounded blocks, chimneys (v1.68's "left") |

All in all 6828 → 6475 (v1.68: about 6300; the Glass Dunes' 266 new sites are most of the difference). Every temple is at
or under its baseline in `tests/zfight.test.js`; five have come down well under it since v1.66 (the Warden's Well 39 → 8,
the Belfry 10 → 3, the Undertower 8 → 3, the Lamp-House 3 → 1, the Greenhouse 2 → 1): their baselines can be lowered to
hold them (after the test's own count agrees: it builds the temples alone).

## Findings

| # | severity | where | sites | cause | fix |
|---|---|---|---|---|---|
| 1 | noticeable | the Glass Dunes, the city under the sand (the buried streets, round 596, 2620-2655, -590..-650) | 268 (1 642 m²; the worst 56 m² in one plane) | rebuilt in 7be14e38a (#393, #426): `crowdedBlock` (src/glass-dunes-masses.js) piles rooms out of each face of a block, three in ten in the trim's material, with no gap between neighbours: their side and top faces lie flush with the next room's or the core's, two looks in one plane; its openings (`hole`) flush with each other | #498: set each room off its neighbours by `Z_GAP` (or the trim's rooms 2 cm proud), and a held count for the city (`WORLD_ZFIGHT_BASELINE`, as the City Floating in Space) |
| 2 | only when looking | the Signal Market's avenue | 69 | each stall's counter ends in its fascia's plane (`bazaar.js` 220/222), the posters' light strips flush with their plates (`poster`) | v1.68's "left", held back for the Market's rework (#278, closed): no new issue |
| 3 | only when looking | the Underwater City, the big dome and the café dome | 26 | the café domes' feet in the big dome's plane | known since v1.68's table (the city's floor and paving); no new issue |
| 4 | look | the City-Shaft's pit, the Buried Machine's two cities, the Moon Foundry's cells, Qanat's houses, the Hearth | – | known since v1.44 (rendering.md "Left") | – |

## In the game

Not looked at in the game this time (the counts are geometry); the Glass Dunes' city should be checked from a street
under the glass with `scripts/design-qc/capture.mjs`, grazing, before and after its fix.

## What was not checked

The moving pieces while they move, instanced props, LOD copies drawn one at a time, the side worlds and detours (not in
the route), the ship (`--ship`), the Unity port (it has no `polygonOffset` but in its footprints' shader, so a decal set
off that way is flush there: nothing new uses it since v1.66).
