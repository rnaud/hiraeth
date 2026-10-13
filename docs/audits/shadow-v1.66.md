# Shadows in motion, v1.66 (2026-10-13)

<!-- audit-scores
overall: none
headline: 52 of 60 spots green (10 spots, 3 presets, 2 suns); nothing new since October: the reds are the ones rendering.md lists as left
date: 2026-10-13
-->

The shadow QC (`.claude/skills/shadow-qc/SKILL.md`) on main at v1.66, for issue #226 (the skills were updated; the
first run kept as a report: the earlier runs' tables live in docs/systems/rendering.md, "The Shadow Room and the shadow
QC", October 2026, and v1.59's "the shadow QC's phantom casters").

## Setup

- main `0949c08a` (v1.66), the Shadow Room (`?level=shadows`), the whole walk at a run with a turn of the camera at
  each look point (5 s), foes off, muted headless Chrome on the GPU (ANGLE Metal, M4 Pro), 1280 × 720.
- Presets High, Steam Deck and Handheld; suns 35° and 12° from the east (`--suns 35/90,12/90`): six runs, 2 070–2 260
  frames each, ~350 000 probes on the room's surfaces.
- A shared Mac (load 70 → 6 over the run; the QC's measures are per frame, so the load slows it, it does not change
  them).

## Per run, against October's "after" (rendering.md)

| run | spots green | his shadow drawn | spill | gap from the foot (p90 by spot) | worst leak | worst peter-pan | worst acne |
|---|---|---|---|---|---|---|---|
| High, 35° | 9 of 10 | 92 % → 93 % | 13 % → 13 % | 0–5 → 0–3 cm | 0 % | 1.1 % (the arch) | 0 % |
| High, 12° | 7 of 10 | 93 % → 93 % | 14 % → 13 % | 0–2 → 0–4 cm | 11.1 % (the props, far posts) | 16 % (the props) | 0 % |
| Steam Deck, 35° | 10 of 10 | 93 % → 93 % | 12 % → 12 % | 0–3 → 0–3 cm | 0 % | 0 % | 0 % |
| Steam Deck, 12° | 9 of 10 | 89 % → 89 % | 15 % → 14 % | 0–5 → 0–3 cm | 4.2 % (the props) | 0.8 % | 0.10 % |
| Handheld, 35° | 9 of 10 | 92 % → 92 % | 15 % → 14 % | 0–3 → 0–2 cm | 0 % | 23 % (the balcony) | 0 % |
| Handheld, 12° | 8 of 10 | 88 % → 88 % | 18 % → 17 % | 0–3 → 0–3 cm | 0.7 % | 4.2 % | 0.19 % |

His own shadow is where October left it on every preset (drawn 88–93 %, spill 12–17 %, starting within 4 cm of the
foot). Acne stays under the 0.2 % limit everywhere, shimmer under 0.22 % of the edge probes a frame (limit 0.4 %).

## The reds

| # | severity | run · spot | measure | picture | cause | known? |
|---|---|---|---|---|---|---|
| 1 | only when looking | High 35° · poles | seams 10.7 % (limit 8 %) | [poles](shadow-v1.66/high.sun35-90.poles.webp) | the fine map's edge ~11 m from him: a 2 cm pole's shadow is the fine map's alone and pops at the hand-over | yes (v1.59: 10.4 %) |
| 2 | only when looking | High 12° · props | leak 11 %, peter-pan 16 % | [props](shadow-v1.66/high.sun12-90.props.webp) | the boards' thin posts 30–40 m off at a grazing sun: their long thin shadows fade as the lookup widens to the pixel | yes (rendering.md "Left as they are") |
| 3 | only when looking | High 12° · arch | leak 5 %, peter-pan 7 % | – | the balcony and the eave seen far off at a grazing sun, the same widening | yes |
| 4 | look | High 12° · stairs | pops 0.21 % (limit 0.2 %) | – | the fine map's edge passing over the 17 steps' edges | yes ("the stair's cascade pops") |
| 5 | only when looking | Deck 12° · props | leak 4.2 %, off screen 2.8 % | [props](shadow-v1.66/deck.sun12-90.props.webp) | the far posts as 2; off screen: a caster behind the camera culled (ShadowCuller) in a quick turn by the boards | leak yes; off screen at the line, not in October's table |
| 6 | noticeable | Handheld 35° · arch | peter-pan 23 %, off screen 4 % | [arch](shadow-v1.66/handheld.sun35-90.arch.webp) | the balcony's shadow on its wall: the near map's 16 cm texel under a 40 cm overhang (October: 25 %) | yes |
| 7 | look | Handheld 12° · poles | his spill 39 % (limit 35 %) | – | his shadow's blur beside the poles on the 16 cm texel at a long low shadow | yes (Handheld's spill) |
| 8 | look | Handheld 12° · stairs | off screen 1.17 % (limit 1 %) | – | the terrace's balusters behind the camera on the stair | at the line |

Nothing new breaks the picture. Off screen at 2.8 % on the Deck and 1.2 % on Handheld at 12° is the only reading
October's table did not have; both are short (a quick turn by the boards and on the stair) and under the 3 % that a
player would notice as a shadow vanishing.

## Issues and fixes

None filed: every red is one rendering.md already keeps as left, and the three things that would move them (a
wider fade band on High, a finer near map on Handheld, the culler keeping casters a turn behind the camera) are trade-offs
it weighed then. Not checked: the shadows in two real worlds by eye (the visual audit's probes did: visual-v1.66), the
Xbox preset, devices.
