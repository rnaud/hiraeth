# Visual audit, v1.66: every world's stills, the probes of the route, the motion check (2026-10-13)

<!-- audit-scores
overall: none
headline: 0 breaks the picture, 2 noticeable, 2 only when looking, 7 look; Vael's views had shown a cliff since v1.39 (fixed), no seam anywhere, the Lorn crystal's halo still open
date: 2026-10-13
-->

The visual-audit skill (`.claude/skills/visual-audit/SKILL.md`) in full at v1.66 for issue #226: the stills (section 1),
the motion check (2) and the probes (3-5) on every route world, against [v1.21](visual-v1.21.md) (the probes' last run)
and [v1.0](visual-v1.0.md) (the last stills and the clipping and contact counts).

## Setup

- main `0949c08a` (v1.66). Headless Chrome, muted, on the GPU (ANGLE Metal, M4 Pro), the HUD hidden, foes off.
- **Stills** (`views.mjs`): 21 worlds (the route, the side worlds, Home, the Lantern) at 7:00, 12:00, 18:30 and 22:00,
  High, 1280 × 720, up to 6 interiors a world at noon: 285 pictures, every one looked at on contact sheets, the
  flagged and a sample full size.
- **Probes** (`probes.mjs --people marrow`): the 12 route worlds at Handheld and High, 9:30, the known spots and up to 4
  more a world (stairs, a room corner, walls, ways in).
- **Motion check** (`scripts/motion-check/record.mjs`, the paths pan and zoom, High, 1728 × 1117 at DPR 2, the build of
  main served by `serve.mjs`): 13 worlds.
- **Clipping** (`window.clipAudit`, per world in the stills) and **contact** (`node scripts/contact-report.mjs`, node).
- A shared Mac at load 10-70 (the pictures don't depend on it).

## Findings

| # | severity | where | picture | likely cause | suggested fix |
|---|---|---|---|---|---|
| 1 | noticeable | the Lorn temple hall (perdide, `inner-wall-3`, High): a jagged spot-black halo round the crystal on its ring against the far wall; orbit p95 0.60 (v1.21: 0.70-0.80) | [orbit](visual-v1.66/lorn-crystal-orbit-first.webp) | v1.21's finding 1, still open. The crystal is static (src/temples/pieces.js `Switch`, `o.crystal`), so `mover` is not the cause: the taps landing on it count it as closing in the wall far behind it | a range check on a tap's depth against the point's in post.js `enclosure` / the spot taps: #301 |
| 2 | noticeable | by the ship's ramp in the Underwater City (`stairs-0`, both presets, orbit p95 **0.80**), the Buried Machine (Handheld 0.62), the Moon Foundry (High 0.38): halos round the rocks and a streaked mask on the glass column, changing shape over the orbit | [first](visual-v1.66/underwater-ramp-orbit-first.webp), [last](visual-v1.66/underwater-ramp-orbit-last.webp) | as 1: near objects against a far floor; v1.21 had the ramps at 0.35-0.47 in the side worlds | as 1: #301 |
| 3 | only when looking | the desert room corner with Marrow (High): a pale notch beside him, 626 px (0.03 of him) | – | v1.21's finding 4: three planes meeting; the planes seen round a hidden tap don't always include the one that hides it | as v1.21 (a third look-past, or accept) |
| 4 | only when looking | the Buried Machine's ramp at Handheld (`stairs-0`, 0.62) | – | v1.21's finding 5 (0.74 then) | with 2 |
| 5 | look | **Vael's bench views** (start, crowd, crowd2, wide and its walk): since v1.39 Vael stands at its part offset (-190, 38, -1080) and its views stayed in its own frame: the traveller 60-110 m over a ravine, every camera on a cliff face. The perf audit, the Deck's and the Retroid's benches and this audit had measured a rock wall there | [start](visual-v1.66/vael-start-before.webp), [crowd](visual-v1.66/vael-crowd-before.webp) | `scripts/bench/viewpoints-worlds.json` never shifted with `PART_OFFSET` (src/levels/names.js) | **fixed**: the views shifted by the offset; `tests/route-spawn.test.js` holds every view's traveller within 10 m of the ground |
| 6 | look | the Underwater City's `crowd2` view: a flat cyan surface over half the frame, the traveller cut off at the bottom; Viridel's and the City-Shaft's `crowd2` through a trunk and big leaves | [underwater](visual-v1.66/underwater-crowd2.webp) | the views were picked before the worlds grew round them; the camera stands against a column | re-pick them: #301 |
| 7 | look | the Signal Market's `inside-4`: a passer-by's head fills half the frame | [picture](visual-v1.66/bazaar-inside4-passerby.webp) | crowd strollers walk through the camera (the camera QC's "Left", v1.40) | – |
| 8 | look | Lorn's tree in the water (High): the ghost check flags the contact foam round him (by design: water.md "Contact foam"), and his guard's bracer stayed visible where he had stood with him hidden | [without him](visual-v1.66/tree-in-water-without.webp) | the probe's: the bracer rides his hand bone but is shown by the guard's update, which a stepped probe never runs | **fixed** in `probes.mjs` (`hide` takes the bracer too) |
| 9 | look | Viridel's pan in the motion check: 12.8 flickering px per 10 000 (rendering.md's table: 2.5); the Garden of Spheres 15.3 → 20.8, Lorn 4.3 → 6.5 | [heat](visual-v1.66/viridel-pan-heat.webp) | the flock of birds and the walking creatures, which the check's frozen world doesn't stop; the road's dark outline at a grazing angle is the only static part | the check's freeze to cover flocks and creatures: #301 |
| 10 | look | 11 "mostly one colour" flags (the Glass Dunes', the Buried Machine's and the Garden's crowd2, Home's wide) | – | the stills' check: sand, grass and a view straight down on Home's ground | none |
| 11 | look | the tools: `scripts/contact-report.mjs` stopped at the merged worlds' old ids; `scripts/bench/browser.mjs` points `PLAYWRIGHT` at another session's scratch folder | – | the worlds were merged in v1.39; a hand-set default | contact report **fixed** (the route, the side worlds and Home from src/levels/names.js); Playwright in #301 |

## The probes, world by world

Orbit flagged (p95 step), ghost flagged (biggest pale px / share of the person, the biggest dark), people too close to
judge, seams: enclosed of checked / slits / longest lit line px.

| world | preset | spots | orbit flagged (p95 step) | ghost flagged (biggest pale px / share of him) | close | seams: enclosed / slits / longest lit line px |
|---|---|---|---|---|---|---|
| desert | handheld | 9 | - | - | 0 | 6/6 / 0 / 0 |
| desert | high | 9 | - | corner-1@marrow (626 / 0.03) | 0 | 6/6 / 0 / 0 |
| arzach | handheld | 4 | - | - | 0 | 2/4 / 0 / 0 |
| arzach | high | 4 | - | - | 0 | 2/4 / 0 / 0 |
| perdide | handheld | 5 | - | - | 1 | 2/4 / 0 / 0 |
| perdide | high | 5 | inner-wall-3 (0.60: finding 1) | tree-in-water (the foam; dark 894: finding 8) | 1 | 2/4 / 0 / 0 |
| edena | handheld | 4 | - | - | 0 | 2/4 / 0 / 0 |
| edena | high | 4 | - | - | 0 | 2/4 / 0 / 0 |
| underwater | handheld | 4 | stairs-0 (0.80: finding 2) | - | 0 | 4/4 / 0 / 0 |
| underwater | high | 4 | stairs-0 (0.80: finding 2) | - | 0 | 4/4 / 0 / 30 |
| incal | handheld | 4 | - | - | 0 | 2/4 / 0 / 0 |
| incal | high | 4 | - | - | 0 | 2/4 / 0 / 32 |
| glassdunes | handheld | 4 (1 swing narrowed) | - | - | 0 | 2/4 / 0 / 0 |
| glassdunes | high | 4 (1 swing narrowed) | - | - | 0 | 2/4 / 0 / 0 |
| buried | handheld | 4 | stairs-0 (0.62: finding 4) | - | 0 | 4/4 / 0 / 42 |
| buried | high | 4 | - | - | 0 | 4/4 / 0 / 43 |
| moonfoundry | handheld | 4 | - | - | 0 | 2/4 / 0 / 0 |
| moonfoundry | high | 4 | stairs-0 (0.38: finding 2) | - | 0 | 2/4 / 0 / 0 |
| spheres | handheld | 4 | - | - | 0 | 3/4 / 1 / 0 |
| spheres | high | 4 | - | - | 0 | 3/4 / 1 / 36 |
| spacecity | handheld | 4 | - | - | 0 | 2/4 / 0 / 0 |
| spacecity | high | 4 | - | - | 0 | 2/4 / 0 / 0 |
| bazaar | handheld | 4 | - | - | 0 | 2/4 / 0 / 0 |
| bazaar | high | 4 | - | - | 0 | 2/4 / 0 / 0 |

Against v1.21: the known spots (the Qanat tree's stairs, the giant's cave, the Givers' Hearth, his shadow by the ramp,
Marrow there) are clean at both presets; the desert corner's dark copy of him (v1.21 finding 3) gone at Handheld; no
seam flagged anywhere (the lit lines of 30-43 px are under a ceiling only in the Buried Machine's domes, under the 60 px
limit; the Garden's one slit is no gap under a ceiling). The three worlds that joined the route since v1.21 (the Underwater
City, the Moon Foundry, the City Floating in Space) were probed at both presets for the first time: two ramp flags.
The Hearth's dark triangles across its passage (v1.21 finding 2) were not looked for this time.

## What was fixed since v1.21, and what is new

Fixed since: v1.21's findings 3 (the corner's notch at Handheld: not flagged) and 6-7 (the probe's own). Fixed here:
Vael's views (5), the probe's bracer (8), the contact report's list (11). New: the ramps' halos in the new route worlds
(2), the bench views against a column (6), the motion check's moving flocks (9).

## The stills

285 pictures: no NaN, no blown whites, one "crushed blacks" (the City Floating in Space's `inside-4`: the space sky, by
design). By hour the worlds hold their sheets' palettes; dusk at 18:30 is already night in the desert and the Garden
(the clock's, not a fault). The interiors in the sample looked at full size (the shops, the temples' doors, the desert's caves' mouths) read lit
from their own lamps, with no outside light leaking in.

## Clipping and contact, against v1.0

| World | Clipping flags (v1.0 → v1.66) | Contact flags (sample hits, v1.66) |
|---|---|---|
| desert | box 1, thing 1, prop 6 → thing 2, prop 6 | unseen floor 3, feet sink 9, feet hover 2, climbs inside 25, climbs off 8, walks through 70, carrier hovers 84, carrier sinks 33 |
| arzach (with arzach2) | prop 52 (+ npc 1, box 1, prop 40) → npc 1, box 1, prop 107 | unseen floor 4, feet sink 3, climbs inside 4, climbs off 2, walks through 3, carrier hovers 133, carrier sinks 5 |
| perdide (with perdide2) | box 1 (+ box 1, prop 12) → prop 17 | feet sink 12, climbs inside 3, climbs off 5, walks through 15, carrier sinks 20, carrier hovers 67 |
| edena | thing 1, prop 7 → thing 1, prop 25 | feet sink 6, climbs inside 13, climbs off 16, walks through 36, carrier hovers 109 |
| underwater | prop 3 → relic 5, box 1, prop 29 | feet sink 155, climbs inside 190, climbs off 47, walks through 247, carrier hovers 84, carrier sinks 4 |
| incal | relic 1, prop 6 → relic 1, prop 13 | unseen floor 2, feet sink 1, climbs inside 5, climbs off 1, carrier sinks 12, carrier hovers 32 |
| glassdunes | 0 → prop 2 | feet sink 9, unseen floor 19, climbs inside 38, climbs off 21, walks through 6, carrier hovers 48, carrier sinks 1 |
| buried | box 1, thing 1, prop 2 → thing 1, prop 2 | feet sink 45, climbs inside 40, climbs off 18, walks through 7, carrier sinks 21, carrier hovers 92 |
| moonfoundry | npc 1 → npc 1, relic 1, prop 1 | feet sink 53, climbs inside 14, climbs off 25, walks through 29, carrier hovers 132, carrier sinks 4 |
| spheres | box 1, prop 10 → prop 10 | feet sink 60, feet hover 28, unseen floor 5, climbs inside 30, climbs off 34, walks through 269, carrier hovers 45, carrier sinks 4 |
| spacecity | 0 → relic 1, prop 1 | feet sink 28, climbs inside 95, climbs off 48, walks through 4, carrier hovers 61 |
| bazaar | crowd 2, prop 3 → prop 2 | feet sink 12, climbs inside 7, climbs off 5, walks through 14, carrier hovers 83, carrier sinks 5 |
| the side worlds | mangrove, waterfall, saltharbour, eclipse, underside 0; antennas prop 3; fallenring npc 2 (as v1.0) | 1-24 a world |
| home, lantern | 0 | home: climbs inside 3, walks through 13 |

The counts are candidates, as in v1.0. The rises follow the worlds that grew: Vael's 107 props (the sky stones and the
riders' road), Viridel's 25 and the Underwater City's 29 props and 247 walk-through samples (its new avenues and
paving), the Garden's 269 walk-throughs (its furrows). Not looked at one by one this time.

## The motion check's worst views (High, flicker per 10 000 px; the zoom's warped residual)

| world | pan | zoom residual | rendering.md's table |
|---|---|---|---|
| the Garden of Spheres | 20.8 | 2.5 | pan 15.3 |
| the Moon Foundry | 17.8 | 8.8 | – |
| the City-Shaft | 15.0 | 2.5 | – |
| Viridel | 12.8 | 7.0 | pan 2.5 |
| the City Floating in Space | 7.0 | 6.6 | – |
| Lorn | 6.5 | 1.3 | pan 4.3 |
| the Desert | 4.9 | 10.8 | pan 7.0 |
| the Signal Market | 4.1 | 6.6 | pan 3.0 |
| the Buried Machine | 3.1 | 3.0 | zoom 4.0 |
| Vael | 3.0 | 4.9 | pan 1.6 (another spawn) |
| the Underwater City | 0.1 | 2.8 | – |

The rises are moving things (finding 9); the desert's pan fell 7.0 → 4.9.

## What was not checked

The devices; the Deck and Xbox presets; the side worlds' probes (v1.21 ran them at Handheld); the motion check's other
paths (drift, walk, orbit, swing) and Handheld; the references level against the sheets; the galleries' (`enemies.html`)
shadows in motion; the traveller's face close up (the studio); the Glass Dunes in the motion check.
