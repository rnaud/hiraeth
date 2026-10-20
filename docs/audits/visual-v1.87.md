# Visual audit, v1.87: the route's stills, the probes, the motion check, Unity against the web (2026-10-20)

<!-- audit-scores
overall: none
headline: 0 breaks the picture, 1 noticeable, 3 only when looking, 5 look; the noticeable one Unity's bright streak down the Underwater City's wide views (#565); Unity's temple rooms now match the web (ΔE 12.2 → 1.6); the probes clean at every known spot
date: 2026-10-20
-->

The visual-audit skill (`.claude/skills/visual-audit/SKILL.md`) for issue #556: the stills (section 1), the motion check
(2), the probes (3-5) on every route world at Handheld and High, and the Unity visual check (docs/systems/engine-bridge.md,
"The visual check"), against [v1.85](visual-v1.85.md). The seven side worlds are discarded (#503) and left out.

## Setup

- main `3da6e2539` (v1.87). Headless Chrome, muted, on the GPU (ANGLE Metal, M4 Pro), the HUD hidden, foes off.
- **Stills** (`views.mjs`): the 12 route worlds, Home and the Lantern at 7:00, 12:00, 18:30 and 22:00, High, 1280 × 720, up
  to 6 interiors a world at noon: 226 pictures, all looked at on contact sheets, the flagged ones full size.
- **Probes** (`probes.mjs --people marrow --auto 2 --interiors 2`, as v1.85): the 12 route worlds at Handheld and High,
  9:30, the known spots and 2 more a world.
- **Motion check** (`scripts/motion-check/record.mjs`, pan and zoom, High, 1728 × 1117 at DPR 2, the world frozen): the
  12 route worlds (the Glass Dunes for the first time).
- **Unity** (`scripts/unity-compare/run.mjs`): 87 views (the 12 route worlds, Home, the Lantern and the night train), both
  engines at High, 1280 × 720, Unity in the editor's batch run (muted, `-fresh -no-hud`, under the Unity build lock). The
  means below are over v1.85's 79 (the route and Home).
- **Clipping** (`window.clipAudit`, per world in the stills). A shared Mac at load 14-45 (the pictures don't depend on it).

## Findings

| # | severity | where | picture | likely cause | suggested fix |
|---|---|---|---|---|---|
| 1 | noticeable | **Unity**: the Underwater City's wide views: a bright white vertical streak down the middle, from the top of the screen to the dome (ΔE 4.1 mean, 17.8 in its worst cell at dusk; 2.9 / 11.1 at noon) | [web / Unity / ΔE](visual-v1.87/underwater--wide-dusk.webp) | open since the first sweep (engine-bridge.md: "on that line the VM has only a points cloud 3 m from the eye"); never filed. Now the worst pair left | #565 |
| 2 | only when looking | the Garden of Spheres' pan: 13.7 flickering px per 10 000 with the world frozen (v1.85 21.2), still the route's highest | [heat](visual-v1.87/spheres-high-pan-main-heat.webp) | the grass tufts' outline at all (#504 gave them a soft line: 21.2 → 13.5, as measured there); each tuft a red dot in the heat map | none new: #504's "what is left" |
| 3 | only when looking | **Unity**: the Aerie's first room (`arzach--temple0`) a paler, bluer haze over the floor than the web's (ΔE 4.6, SSIM 0.82): the worst temple pair now | [web / Unity](visual-v1.87/arzach--temple0.webp) | the room's fog or the ways' light after #502's fix (every other temple 0.1-2.7) | none filed: below the noticeable line; look again with the next parity round |
| 4 | only when looking | **Unity**: the Glass Dunes' wide view: the start's glowing pool sits on a smaller dark ring than the web's (ΔE 0.9, SSIM 0.78, the heat on the ring and on the moving spiral) | [web / Unity](visual-v1.87/glassdunes--wide.webp) | the pool's rim (#475's west rework landed after the last parity round) | none filed |
| 5 | look | the Whale-House's first room (the Underwater City's `inside-0`, High): a lit line of 140 px along the far wall's foot in the light term | – | the room's glowing floor line (a makers' circuit), not a slit: the probe passes glowing marks only under 60 px | none |
| 6 | look | the Signal Market `inside-0` (High, 78 px) and `inside-1` (both presets, 69-73 px): the lit lines v1.85 found | – | the Undertower door's trim, by design (#504) | none |
| 7 | look | Lorn `inside-1` (both presets): a sky-white line of 79 px | – | the open-sided pavilion (v1.85 finding 7) | none |
| 8 | look | 18 "mostly one colour" flags (Vael's start at every hour on its sunlit slope and its crowd views, the Buried Machine's `crowd2` and night start, the Garden's and the Glass Dunes' `crowd2` at 7:00, Home's `wide` straight down) | – | the stills' check: sand and grass | none |
| 9 | look | the visual check's two Lorn temple views black on both engines (dark share 100 %) | – | the views stand outside the houses, which are built on the way in (engine-bridge.md: walk in with `-through`) | none |

## The v1.85 findings, one by one

| v1.85 | now | evidence |
|---|---|---|
| 1. Unity: every temple's first room darker (ΔE 7-17) (#502) | **fixed** | the 14 temple views ΔE 12.2 → 1.6 mean, SSIM 0.88 → 0.95 ([the Engine-House](visual-v1.87/buried--temple0.webp): 13.3 → 1.2); the worst the Aerie's 4.6 (finding 3) |
| 2. Unity: Lorn's lake without its shallows (#502) | **fixed** | Lorn's wide view ΔE 5.6 → 0.8, SSIM 0.77 → 0.87 |
| 3. the Garden's tufts flicker in a pan; Viridel's birds (#504) | **partly fixed** | the Garden 21.2 → 13.7; Viridel 12.9 → 12.8 (its birds were held all along: their outlined wings under a pixel, rendering.md) |
| 4. Vael's crowd bench view in a dune (#504) | **fixed** | the view now looks at him and a stilt-walker, at every hour |
| 5. the Signal Market's lit line (#504, to look at) | not a fault | the Undertower door's trim, by design; still flagged (finding 6) |
| 6. the Undertower antechamber's floor line | as before (by design) | 62-78 px |
| 7. Lorn's pavilion sky line | as before | 79 px |
| 8. the Qanat tree's stairs ghost (the probe's miss) | **gone** | no ghost flagged anywhere |
| 9. 16 "mostly one colour" flags | 18 | Vael's views re-picked (#504) on a sunlit slope |

## The probes, world by world

Orbit flagged (p95 step), ghost flagged, seams flagged (lit line px); v1.85 → v1.87, 2 auto spots a world both times:

| world | preset | spots | orbit flagged | ghost flagged | seams flagged |
|---|---|---|---|---|---|
| desert | handheld | 7 → 7 | - | - | - |
| desert | high | 7 → 7 | - | qanat-tree-stairs (1 px) → - | - |
| arzach | handheld | 2 → 2 | - | - | - |
| arzach | high | 2 → 2 | - | - | - |
| perdide | handheld | 3 → 3 | - | - | inside-1 (79) → inside-1 (79) |
| perdide | high | 3 → 3 | - | - | inside-1 (79) → inside-1 (79) |
| edena | handheld | 2 → 2 | - | - | - |
| edena | high | 2 → 2 | - | - | - |
| underwater | handheld | 2 → 2 | - | - | - |
| underwater | high | 2 → 2 | - | - | - → inside-0 (140: finding 5) |
| incal | handheld | 2 → 2 | - | - | - |
| incal | high | 2 → 2 | - | - | - |
| glassdunes | handheld | 2 → 2 | - | - | - |
| glassdunes | high | 2 → 2 | - | - | - |
| buried | handheld | 2 → 2 | - | - | - |
| buried | high | 2 → 2 | - | - | - |
| moonfoundry | handheld | 2 → 2 | - | - | - |
| moonfoundry | high | 2 → 2 | - | - | - |
| spheres | handheld | 2 → 2 | - | - | - |
| spheres | high | 2 → 2 | - | - | - |
| spacecity | handheld | 2 → 2 | - | - | - |
| spacecity | high | 2 → 2 | - | - | - |
| bazaar | handheld | 2 → 2 | - | - | inside-0 (62), inside-1 (69) → inside-1 (69) |
| bazaar | high | 2 → 2 | - | - | inside-0 (78), inside-1 (73) → inside-0 (78), inside-1 (73) |

The known spots (the Qanat tree's stairs, the giant's cave, the Givers' Hearth, his shadow by the ramp, Lorn's tree in the
water, Marrow there) are clean at both presets; no orbit flagged anywhere; no slit under a wall's foot.

## Unity against the web (the visual check)

The route and Home, 79 pairs: mean SSIM 0.895 → **0.913**, mean ΔE 2.99 → **1.05**; the temples' first rooms ΔE 12.2 →
1.6, the outside views 1.0 → 0.9. Worst first: the Underwater City's wide views (finding 1), the Aerie's first room (3),
Home at dusk (ΔE 2.2-2.9: the family and the dog walking), the night train's start views (1.8-2.0, its passengers),
the Glass Dunes' wide view (4), the Buried Machine's wide views (SSIM 0.82, ΔE 0.8-1.4). Every
other outside view is within ΔE 0.2-1.7. The Lantern's four 0.1-0.7.

## The stills

226 pictures of the route, Home and the Lantern: no NaN, no blown whites, no crushed blacks; 18 "mostly one colour" flags
(finding 8). By hour the worlds hold their palettes; the interiors read lit from their own lamps; the Signal Market's
`inside-4` still has a passer-by's head filling the frame (v1.66 finding 7); Vael's views show him and his crowd now; the
Glass Dunes' city under the sand reads clean (its 268 z-fighting sites gone, zfight-v1.87).

## Clipping, against v1.85

| World | Clipping flags (v1.85 → v1.87) |
|---|---|
| desert | thing 2, prop 6 → the same |
| arzach | npc 1, prop 96 → npc 1, prop 97 |
| perdide | prop 18 → prop 16 |
| edena | thing 1, prop 25 → the same |
| underwater | relic 3, box 2, prop 29 → relic 3, box 2, prop 24 |
| incal | prop 12 → prop 12 |
| glassdunes | prop 2 → prop 2 |
| buried | thing 1, prop 2 → the same |
| moonfoundry | npc 1, relic 1, prop 1 → the same |
| spheres | prop 10 → prop 10 |
| spacecity | relic 1, prop 1 → the same |
| bazaar | prop 2 → prop 2 |
| home, lantern | 0 → 0 |

## The motion check (High, flicker per 10 000 px; the zoom's warped residual), v1.85 → v1.87

| world | pan | zoom residual |
|---|---|---|
| the Moon Foundry | 16.1 → 16.1 | 8.8 → 8.7 |
| the Garden of Spheres | 21.2 → **13.7** | 2.5 → 2.4 |
| Viridel | 12.9 → 12.8 | 6.7 → 6.7 |
| the City-Shaft | 8.5 → 8.5 | 1.1 → 1.1 |
| the Desert | 6.3 → 6.4 | 4.0 → 4.0 |
| the City Floating in Space | 6.6 → 6.3 | 6.3 → 6.3 |
| the Signal Market | 4.3 → 4.5 | 6.6 → 6.6 |
| Lorn | 3.6 → 3.7 | 2.1 → 2.1 |
| Vael | 3.3 → 3.3 | 4.9 → 4.9 |
| the Buried Machine | 1.6 → 1.5 | 1.4 → 1.5 |
| the Glass Dunes (first run) | – → 1.4 | – → 0.2 |
| the Underwater City | 0.1 → 0.1 | 1.1 → 1.1 |

## What was not checked

The devices (held by #536), the Deck and Xbox presets; the probes' 3rd and 4th auto spots a world; the motion check's
other paths and Handheld; the contact report; the references level against the sheets; the galleries' shadows in motion;
the traveller's face close up (the studio; the Blender traveller is #493's); Unity's own motion (the check compares
stills).
