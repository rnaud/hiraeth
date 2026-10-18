# Shadows in motion, v1.85 (2026-10-18)

<!-- audit-scores
overall: none
headline: 52 of 60 spots green, the same eight reds as v1.66 at the same readings (within 1-2 points); his own shadow as before on every preset; nothing new
date: 2026-10-18
-->

The shadow QC (`.claude/skills/shadow-qc/SKILL.md`) on main at v1.85, for issue #467, against [v1.66](shadow-v1.66.md)
(and October's tables in docs/systems/rendering.md, "The Shadow Room and the shadow QC").

## Setup

- main `8f01feae5` (v1.85), the Shadow Room (`?level=shadows`), the whole walk at a run with a turn of the camera at each
  look point (5 s), foes off, muted headless Chrome on the GPU (ANGLE Metal, M4 Pro), 1280 × 720.
- Presets High, Steam Deck and Handheld; suns 35° and 12° from the east (`--suns 35/90,12/90`): six runs, 393-942 frames
  a spot, ~350 000 probes on the room's surfaces.
- A shared Mac (load 23-27 over the run; the QC's measures are per frame: the load slows it, it does not change them).

## Per run, against v1.66

| run | spots green | his shadow drawn | spill | gap from the foot (p90 by spot) | worst leak | worst peter-pan | worst acne |
|---|---|---|---|---|---|---|---|
| High, 35° | 9 → 9 of 10 | 93 % → 92-96 % | 13 % → 5-21 % | 0-3 → 0-1.5 cm | 0 % | 1.1 % → 1.1 % (the arch) | 0 % |
| High, 12° | 7 → 7 of 10 | 93 % → 89-93 % | 13 % → 1-12 % | 0-4 → 0 cm | 11.1 % → 9.9 % (the props, far posts) | 16 % → 13 % (the props) | 0 % |
| Steam Deck, 35° | 10 → 10 of 10 | 93 % → 93-98 % | 12 % → 5-27 % | 0-3 → 0-1.5 cm | 0 % | 0 % | 0 % |
| Steam Deck, 12° | 9 → 9 of 10 | 89 % → 86-100 % | 14 % → 4-19 % | 0-3 → 0-4.5 cm | 4.2 % → 4.0 % (the props) | 0.8 % → 1.0 % | 0.10 % → 0.10 % |
| Handheld, 35° | 9 → 9 of 10 | 92 % → 92-96 % | 14 % → 5-33 % | 0-2 → 0-4.5 cm | 0 % | 23 % → 25 % (the balcony) | 0 % |
| Handheld, 12° | 8 → 8 of 10 | 88 % → 86-90 % | 17 % → 1-36 % | 0-3 → 0-3 cm | 0.7 % → 0.7 % | 4.2 % → 4.2 % | 0.19 % → 0.18 % |

(v1.66 gave one number a run for his shadow and spill; this run's are the range over the spots.) Acne stays under the
0.2 % limit everywhere, shimmer under 0.2 % of the edge probes a frame (limit 0.4 %); no gap from his foot over 4.5 cm
(limit 6).

## The reds (the same eight as v1.66)

| # | severity | run · spot | measure (v1.66 → v1.85) | picture | cause | known? |
|---|---|---|---|---|---|---|
| 1 | only when looking | High 35° · poles | seams 10.7 % → 10.7 % (limit 8 %) | [poles](shadow-v1.85/high.sun35-90.poles.webp) | the fine map's edge ~11 m from him: a 2 cm pole's shadow is the fine map's alone and pops at the hand-over | yes (v1.59) |
| 2 | only when looking | High 12° · props | leak 11.1 → 9.9 %, peter-pan 16 → 13.2 % | [props](shadow-v1.85/high.sun12-90.props.webp) | the boards' thin posts 30-40 m off at a grazing sun: their long thin shadows fade as the lookup widens to the pixel | yes ("Left as they are") |
| 3 | only when looking | High 12° · arch | leak 5 → 4.95 %, peter-pan 7 → 6.75 % | – | the balcony and the eave far off at a grazing sun, the same widening | yes |
| 4 | look | High 12° · stairs | pops 0.21 → 0.21 % (limit 0.2 %) | – | the fine map's edge passing over the 17 steps' edges | yes |
| 5 | only when looking | Deck 12° · props | leak 4.2 → 3.95 %, off screen 2.8 → 2.76 % | [props](shadow-v1.85/deck.sun12-90.props.webp) | the far posts as 2; a caster behind the camera culled in a quick turn by the boards | yes (v1.66) |
| 6 | noticeable | Handheld 35° · arch | peter-pan 23 → 24.7 %, off screen 4 → 4.6 % | [arch](shadow-v1.85/handheld.sun35-90.arch.webp) | the balcony's shadow on its wall: the near map's 16 cm texel under a 40 cm overhang (a lit line under the overhang) | yes (October: 25 %) |
| 7 | look | Handheld 12° · poles | his spill 39 → 36 % (limit 35 %) | – | his shadow's blur beside the poles on the 16 cm texel | yes |
| 8 | look | Handheld 12° · stairs | off screen 1.17 → 1.36 % (limit 1 %) | – | the terrace's balusters behind the camera on the stair | at the line |

Nothing moved since v1.66 beyond a run's own spread. No issue filed: every red is one rendering.md keeps as left.

## What was not checked

The shadows in the real worlds by eye (the visual audit's probes: visual-v1.85), the Xbox preset, the devices, and the
**Unity port's shadows** (HiraethShadows draws its own cascades: the QC reads the web's lookup only; Unity's shadows were
compared picture against picture in the visual check, visual-v1.85).
