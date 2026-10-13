# Z-fighting, v1.66 (2026-10-13)

<!-- audit-scores
overall: none
headline: 14 of 14 temples at or under their baselines' new lows (the Rose House none); the worlds 7457 → 6828 sites, Viridel 121 → 5, the Glass Dunes 12 → 2, the Signal Market 576 → 151; the finder's own miss fixed
date: 2026-10-13
-->

The zfight-qc skill (`.claude/skills/zfight-qc/SKILL.md`) on main at v1.66, for issue #226: every route world built as
the game builds it, in node (`node scripts/zfight/audit.mjs`), its temples counted as `tests/zfight.test.js` counts them.
The last full count was v1.44's table in docs/systems/rendering.md, "Z-fighting"; the worlds have grown since (Viridel's
and the Glass Dunes' explorations, the Signal Market's screen lanes, v1.50-v1.62).

## Setup

- main `0949c08a` (v1.66), node 24 (Zed's), the finder's defaults (planes within 4 mm, 0.05 m² shared, one site per pair
  of looks per 3 m, only what someone standing near could see).
- Before: this run on main; after: this branch's fixes (below). The City-Shaft took 4-6 minutes, the rest 5-40 s each.

## The counts, world by world

Visible sites (the world's, with its temples in it), v1.44 → v1.66 on main → this branch:

| world | v1.44 | v1.66 | after the fixes | its temples (v1.66; baseline) | what most of it is |
|---|---|---|---|---|---|
| desert | 18 | 29 | 29 | the Rose House 0 (0) | Qanat's two houses' walls (57 m²), the Givers' Hearth's floor, the giant's cave's floor (all known) |
| incal | 3971 | 4148 | 4070 | the Warden's Well 34-39 (47 → 39) | the city down the pit, its buildings' merged meshes against each other (known) |
| arzach | 22 | 16 | 16 | the Belfry 10 (11 → 10), the Aerie 3 (8 → 3) | the Belfry's painted bands on its walls |
| glassdunes | 4 | 12 | **2** | the Clock-House 1 (1) | the city under the sand: its walls' tops flush with the glass ceiling (164 m², fixed) |
| buried | 1706 | 1707 | 1707 | the Engine-House 0 (0) | the drawn city's two layers at 522 m (known) |
| edena | 4 | 121 | **5** | the Greenhouse 2 (2) | the split meteor (82: the finder's miss, fixed) and the water stair's lips (34, fixed) |
| spheres | 12 | 34 | 34 | the Footprint 2 (2) | merged tiles' meshes at a terrace (22, 55 m²), the furrows' banks on their beds (8) |
| perdide | 19 | 16 | 16 | the Lamp-House 3 (9 → 3), the Hush-House 9 (10 → 9) | the keepers' stakes, the Hush-House's paint |
| bazaar | 108 | 576 | **151** | the Undertower 8 (8) | the screen lanes' motifs 4 mm off their screens (425, fixed); merged tiles (90), the market in the air (50) |
| underwater | 47 | 72 | 72 | the Whale-House 19 (19) | the city's floor and its paving at 4 cm (836 m², known), the canyon street (22) |
| moonfoundry | 243 | 266 | 266 | the Casting-House 20 (20) | the cells' solid surfaces against their drawn ones (known) |
| spacecity | 352 | 460 | 460 | the Mooring-House 3 (5 → 3) | the far islands (228), the market (64), the gate (47), the stacks (73): merged meshes' own faces |

All in all 7457 → 6828 (v1.44: 6502). The temples are all at or under their baselines; six had come down since v1.48,
and their baselines are lowered to hold them there (`ZFIGHT_BASELINE`: incal 47 → 39, arzach2 11 → 10, perdide2 9 → 3,
perdide 10 → 9, arzach 8 → 3, spacecity 5 → 3).

## Findings

| # | severity | where | sites | cause | fix |
|---|---|---|---|---|---|
| 1 | look | Viridel, the split meteor (82 sites, 543 m²) | the finder's own | its rock and its violet inside are one geometry drawn front side and back side: never on one pixel. The finder took `flip` from the winding alone | **fixed** in `scripts/zfight/lib.mjs`: a BackSide material's faces count as facing the other way (`tests/zfight.test.js`: a shell and its inside, then double-sided) |
| 2 | noticeable | the Signal Market's screen lanes | 425 | each screen's motifs (bars, a planet, a head, glyphs) 4-8 mm in front of it: the depth buffer can't hold that apart far off | **fixed**: the motifs 1 cm out, their second layer 2 cm (`MOTIF`, `MOTIF2` in src/market-lanes.js), the passed picture 3.5 cm |
| 3 | noticeable | the Glass Dunes, the city under the sand | 10 (164 m²) | the four walls round it 15 m tall, their tops in the glass ceiling's plane all round | **fixed**: 2 cm under the glass (src/glass-dunes-city.js) |
| 4 | only when looking | Viridel, the water stair | 34 | each lip's round end flush with the bed wall's side and back faces | **fixed**: the lips' ends 2 cm inside (`LIP.gap`, src/viridel-stair.js) |
| 5 | only when looking | the City Floating in Space | 460 | the far islands, the market, the gate and the stacks: each built as merged meshes whose own parts lie face to face in two colours | issue (#286) |
| 6 | only when looking | the Signal Market's merged tiles (90) and the market in the air (50); the Garden of Spheres' tiles (22) and furrows (8); the Underwater City's canyon street (22) | 192 | parts merged into one tile mesh (perf.js `tileScene`: their names lost) lying flush; the furrows' banks on their beds | issue (#286) |
| 7 | look | Qanat's houses, the Hearth's floor, the giant's cave, the City-Shaft's pit, the Buried Machine's two cities, the Underwater City's floor, the Moon Foundry's cells | – | known since v1.44 (rendering.md "Left") | – |

The finder's list for a merged tile names only "Mesh": `node scripts/zfight/audit.mjs --worlds bazaar --within …` and the
tile's parts in `src/` are the way in; the issue asks for the tiles to keep their parts' names for the finder.

## What was not checked

The moving pieces while they move, instanced props (grass, rocks), LOD copies drawn one at a time, the side worlds and
detours (not in the route), the Unity port. No site was looked at in the game this time (the fixes are geometry the
tests rebuild).
