# Visual audit, v1.85: the route's stills, the probes, the motion check, Unity against the web (2026-10-18)

<!-- audit-scores
overall: none
headline: 0 breaks the picture, 1 noticeable (Unity's temples' first rooms darker than the web's), 2 only when looking, 6 look; the probes clean at every known spot, no seam; Vael's crowd bench view looks into a dune
date: 2026-10-18
-->

The visual-audit skill (`.claude/skills/visual-audit/SKILL.md`) for issue #467: the stills (section 1), the motion check
(2), the probes (3-5) on every route world at Handheld and High, and the Unity visual check (docs/systems/engine-bridge.md,
"The visual check"), against [v1.66](visual-v1.66.md). The seven side worlds were discarded by the author during this
audit (#503): their stills were shot but are left out here.

## Setup

- main `8f01feae5` (v1.85). Headless Chrome, muted, on the GPU (ANGLE Metal, M4 Pro), the HUD hidden, foes off.
- **Stills** (`views.mjs`): the 12 route worlds, Home and the Lantern at 7:00, 12:00, 18:30 and 22:00, High, 1280 × 720, up to
  6 interiors a world at noon: 226 pictures, all looked at on contact sheets, the flagged ones full size.
- **Probes** (`probes.mjs --people marrow --auto 2 --interiors 2`): the 12 route worlds at Handheld and High, 9:30, the known
  spots and 2 more a world (v1.66 took 4: a shorter run, the network having cut this one twice).
- **Motion check** (`scripts/motion-check/record.mjs`, pan and zoom, High, 1728 × 1117 at DPR 2, the world frozen: flocks,
  creatures and foes held since #301): 11 route worlds.
- **Unity** (`scripts/unity-compare/run.mjs`): 79 views of the 12 route worlds and Home, both engines at High, 1280 × 720,
  Unity in the editor's batch run (muted, `-fresh -no-hud`, under the Unity build lock).
- **Clipping** (`window.clipAudit`, per world in the stills). The contact report was not rerun.
- A shared Mac at load 6-55 (the pictures don't depend on it).

## Findings

| # | severity | where | picture | likely cause | suggested fix |
|---|---|---|---|---|---|
| 1 | noticeable | **Unity**: every temple's first room (the 12 route worlds' temple0 views): darker and greyer than the web, the pool of light round him smaller or gone, the ways' beams grey; ΔE 7-17 mean (outside views 0.2-6) | [web / Unity](visual-v1.85/unity-temples-web-unity.webp) | after the first sweep of 2026-10-16 (mean ΔE 1.8 then): Unity's surface rounds, the lamp tint, the prepass (the suspects #469 listed; measured before #469's fix, 45a08e9e7, which may change it: rerun first) | #502 |
| 2 | only when looking | **Unity**: Lorn's lake from the wide view without the web's lighter band of shallows along the shores (ΔE 5.6, SSIM 0.77) | [web / Unity](visual-v1.85/unity-worlds-web-unity.webp) (top row) | the water's shallows term not ported or lost | #502 |
| 3 | only when looking | the Garden of Spheres' pan: 21 flickering px per 10 000 with the world frozen (v1.66: 20.8, put on the flocks then), Viridel's 12.9 | [heat](visual-v1.85/spheres-pan-heat.webp) | the dark grass tufts and the flowers flicker as the camera moves a third of a pixel a frame (thin dark cards, sub-pixel); in Viridel a flock of birds over the ship still moves though the check holds flocks | #504 |
| 4 | look | **Vael's `crowd` bench view**: the camera low over a dune, no traveller and no crowd in the frame, at every hour | [crowd](visual-v1.85/vael-crowd.webp) | a drawn dune between the camera and him that the collision `tests/route-spawn.test.js` casts against doesn't have (the test passes); the perf, Deck and Retroid benches measure a hillside there | #504 |
| 5 | look | the Signal Market, the probes' `inside-1` (both presets): a thin lit vertical line down a wall in the light term (debug 5), 73 px of lit floor edge flagged beside it | – | a slit between two wall pieces, or a lit edge facet: not checked by eye | #504 (to look at) |
| 6 | look | the Undertower's antechamber (`inside-0`, both presets): a lit line 62-78 px along the floor at the hall's threshold | – | the room's glowing floor line (the probe passes glowing marks only under 60 px) | none |
| 7 | look | Lorn, `inside-1` (both presets): a sky-white line of 79 px | – | an open-sided pavilion (a roof on posts), the sky between the far trunks: the probe counts a roof as enclosed | none |
| 8 | look | the desert, the Qanat tree's stairs at High: ghost flagged on 1 pale px with him 9 px in view (Handheld: 221 px, clean) | – | the probe's camera has him behind the tree at High | none |
| 9 | look | 16 "mostly one colour" flags (Vael: its start at every hour, a big sunlit slope, its crowd and crowd2 views on the dunes; the Glass Dunes', the Buried Machine's and the Garden's `crowd2` at 7:00; Home's `wide` straight down) | – | the stills' check: sand and grass | none |

## The probes, world by world

Orbit flagged (p95 step), ghost flagged, seams flagged (lit line px); v1.66 → v1.85:

| world | preset | spots | orbit flagged | ghost flagged | seams flagged |
|---|---|---|---|---|---|
| desert | handheld | 9 → 7 | - | - | - |
| desert | high | 9 → 7 | - | corner-1@marrow (626 px) → qanat-tree-stairs (1 px, him hidden: finding 8) | - |
| arzach | handheld | 4 → 2 | - | - | - |
| arzach | high | 4 → 2 | - | - | - |
| perdide | handheld | 5 → 3 | - | - | - → inside-1 (79: finding 7) |
| perdide | high | 5 → 3 | inside-wall-3 (0.60) → - | tree-in-water (the foam) → - | - → inside-1 (79: finding 7) |
| edena | handheld | 4 → 2 | - | - | - |
| edena | high | 4 → 2 | - | - | - |
| underwater | handheld | 4 → 2 | stairs-0 (0.80) → - | - | - |
| underwater | high | 4 → 2 | stairs-0 (0.80) → - | - | - |
| incal | handheld | 4 → 2 | - | - | - |
| incal | high | 4 → 2 | - | - | - |
| glassdunes | handheld | 4 → 2 | - | - | - |
| glassdunes | high | 4 → 2 | - | - | - |
| buried | handheld | 4 → 2 | stairs-0 (0.62) → - | - | - |
| buried | high | 4 → 2 | - | - | - |
| moonfoundry | handheld | 4 → 2 | - | - | - |
| moonfoundry | high | 4 → 2 | stairs-0 (0.38) → - | - | - |
| spheres | handheld | 4 → 2 | - | - | - |
| spheres | high | 4 → 2 | - | - | - |
| spacecity | handheld | 4 → 2 | - | - | - |
| spacecity | high | 4 → 2 | - | - | - |
| bazaar | handheld | 4 → 2 | - | - | - → inside-0 (62), inside-1 (69): findings 5, 6 |
| bazaar | high | 4 → 2 | - | - | - → inside-0 (78), inside-1 (73): findings 5, 6 |

The known spots (the Qanat tree's stairs, the giant's cave, the Givers' Hearth, his shadow by the ramp, Lorn's tree in the
water, Marrow there) are clean at both presets but the one probe miss of finding 8. v1.66's halo findings (the Lorn
crystal, the ramps' rocks) are gone where the probe reached them (#301's `SPOT_RANGE`); with 2 spots a world instead of 4
the ramps' `stairs-0` spots were not all taken again, so "gone" is for the Underwater City's and the Buried Machine's ramps
only where they were probed.

## What was fixed since v1.66, and what is new

Fixed since (#301): the spot-black halos round near objects (v1.66 findings 1, 2, 4), the bench views against a column
(6), the motion check's flocks (9, but Viridel's birds: finding 3), the Playwright path (11: `importPlaywright` now asks
for it; this run pointed `PLAYWRIGHT` at an installed copy). New: Unity's temple rooms (1) and Lorn's shallows (2), the
Garden's tufts named as the flicker (3), Vael's crowd view in a dune (4), the probes' lit lines in the Signal Market (5).

## Unity against the web (the visual check)

79 pairs, mean SSIM 0.89, mean ΔE 3.0 (the first sweep's after: 0.886 and 1.8 over 117 views, with the side worlds).
The worst twelve are the temples' first rooms (finding 1, ΔE 7-17); then Lorn's wide views (5.6-5.7: finding 2), the
Underwater City's wide view at dusk (4.0: its bright streak, open since the first sweep), Home at dusk (2-3: the dog and
the family walking: what moves). Every outside view of the other worlds is within ΔE 0.2-3.

## The stills

226 pictures of the route, Home and the Lantern: no NaN, no blown whites, no crushed blacks; 16 "mostly one colour" flags
(finding 9). By hour the worlds hold their palettes; the interiors read lit from their own lamps; the Signal Market's
`inside-4` still has a passer-by's head filling the frame (v1.66 finding 7). The Glass Dunes' city under the sand (its
`inside-5`) shows the crowded blocks whose rooms the z-fighting audit counts (zfight-v1.85, #498).

## Clipping, against v1.66

| World | Clipping flags (v1.66 → v1.85) |
|---|---|
| desert | thing 2, prop 6 → thing 2, prop 6 |
| arzach | npc 1, box 1, prop 107 → npc 1, prop 96 |
| perdide | prop 17 → prop 18 |
| edena | thing 1, prop 25 → thing 1, prop 25 |
| underwater | relic 5, box 1, prop 29 → relic 3, box 2, prop 29 |
| incal | relic 1, prop 13 → prop 12 |
| glassdunes | prop 2 → prop 2 |
| buried | thing 1, prop 2 → thing 1, prop 2 |
| moonfoundry | npc 1, relic 1, prop 1 → the same |
| spheres | prop 10 → prop 10 |
| spacecity | relic 1, prop 1 → the same |
| bazaar | prop 2 → prop 2 |
| home, lantern | 0 → 0 |

## The motion check (High, flicker per 10 000 px; the zoom's warped residual), v1.66 → v1.85

| world | pan | zoom residual |
|---|---|---|
| the Garden of Spheres | 20.8 → 21.2 | 2.5 → 2.5 |
| the Moon Foundry | 17.8 → 16.1 | 8.8 → 8.8 |
| the City-Shaft | 15.0 → 8.5 | 2.5 → 1.1 |
| Viridel | 12.8 → 12.9 | 7.0 → 6.7 |
| the City Floating in Space | 7.0 → 6.6 | 6.6 → 6.3 |
| Lorn | 6.5 → 3.6 | 1.3 → 2.1 |
| the Desert | 4.9 → 6.3 | 10.8 → 4.0 |
| the Signal Market | 4.1 → 4.3 | 6.6 → 6.6 |
| the Buried Machine | 3.1 → 1.6 | 3.0 → 1.4 |
| Vael | 3.0 → 3.3 | 4.9 → 4.9 |
| the Underwater City | 0.1 → 0.1 | 2.8 → 1.1 |

## What was not checked

The devices; the Deck and Xbox presets; the probes' 3rd and 4th auto spots a world (2 this time); the motion check's other
paths and Handheld, the Glass Dunes in it; the contact report; the references level against the sheets; the galleries'
shadows in motion; the traveller's face close up (the studio); Unity's own motion (the check compares stills).
