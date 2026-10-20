# Shadows in motion, v1.87 (2026-10-20)

<!-- audit-scores
overall: none
headline: 52 of 60 spots green, the same eight reds as v1.85 and v1.66 at the same readings (within 1-2 points); the near map drawn every frame since #492 changes none of them; his own shadow as before on every preset
date: 2026-10-20
-->

The shadow QC (`.claude/skills/shadow-qc/SKILL.md`) on main at v1.87, for issue #556, against [v1.85](shadow-v1.85.md)
(and the tables in docs/systems/rendering.md, "The Shadow Room and the shadow QC").

## Setup

- main `3da6e2539` (v1.87), the Shadow Room (`?level=shadows`), the whole walk at a run with a turn of the camera at each
  look point (5 s), foes off, muted headless Chrome on the GPU (ANGLE Metal, M4 Pro), 1280 × 720.
- Presets High, Steam Deck and Handheld; suns 35° and 12° from the east (`--suns 35/90,12/90`): six runs, 413-920 frames
  a spot.
- Changed since v1.85 in the shadows: #492 (v1.86), the near shadow map drawn every frame on every preset, web and Unity
  (it was every other frame on the handhelds).
- A shared Mac (load 27-29 over the run; the QC's measures are per frame: the load slows it, it does not change them).

## Per run, against v1.85

| run | spots green | his shadow drawn | spill | gap from the foot (p90 by spot) | worst leak | worst peter-pan | worst acne |
|---|---|---|---|---|---|---|---|
| High, 35° | 9 → 9 of 10 | 92-96 → 92-99 % | 5-21 → 5-19 % | 0-1.5 → 0-1.5 cm | 0 % | 1.1 → 1.2 % (the arch) | 0 % |
| High, 12° | 7 → 7 of 10 | 89-93 → 89-99 % | 1-12 → 0-13 % | 0 → 0-1.5 cm | 9.9 → 9.5 % (the props, far posts) | 13.2 → 12.0 % (the props) | 0 % |
| Steam Deck, 35° | 10 → 10 of 10 | 93-98 → 93-96 % | 5-27 → 6-22 % | 0-1.5 → 0-1.5 cm | 0 % | 0 % | 0 % |
| Steam Deck, 12° | 9 → 9 of 10 | 86-100 → 86-100 % | 4-19 → 3-18 % | 0-4.5 → 0-3 cm | 3.95 → 3.89 % (the props) | 1.0 → 1.0 % | 0.10 → 0.10 % |
| Handheld, 35° | 9 → 9 of 10 | 92-96 → 92-94 % | 5-33 → 5-33 % | 0-4.5 → 0-1.5 cm | 0 % | 24.7 → 23.3 % (the balcony) | 0 % |
| Handheld, 12° | 8 → 8 of 10 | 86-90 → 86-99 % | 1-36 → 2-36 % | 0-3 → 0-3 cm | 0.7 → 0.9 % | 4.2 → 4.2 % | 0.18 → 0.20 % (the stair, at the limit) |

Acne at or under the 0.2 % limit everywhere (the Handheld's stair at a 12° sun reads 0.20 %, v1.85 0.18 %: the run's own
spread), shimmer under 0.21 % of the edge probes a frame (limit 0.4 %), no gap from his foot over 3 cm (limit 6).

## The reds (the same eight as v1.85)

| # | severity | run · spot | measure (v1.85 → v1.87) | picture | cause | v1.85's verdict → now |
|---|---|---|---|---|---|---|
| 1 | only when looking | High 35° · poles | seams 10.7 → 10.2 % (limit 8 %) | – | the fine map's edge ~11 m from him: a 2 cm pole's shadow is the fine map's alone and pops at the hand-over | known → not fixed (left) |
| 2 | only when looking | High 12° · props | leak 9.9 → 9.5 %, peter-pan 13.2 → 12.0 % | [props](shadow-v1.87/high.sun12-90.props.webp) | the boards' thin posts 30-40 m off at a grazing sun: their long thin shadows fade as the lookup widens to the pixel | known → not fixed (left) |
| 3 | only when looking | High 12° · arch | leak 4.95 → 4.73 %, peter-pan 6.75 → 6.55 % | – | the balcony and the eave far off at a grazing sun, the same widening | known → not fixed (left) |
| 4 | look | High 12° · stairs | pops 0.21 → 0.22 % (limit 0.2 %) | – | the fine map's edge passing over the 17 steps' edges | known → not fixed (left) |
| 5 | only when looking | Deck 12° · props | leak 3.95 → 3.89 %, off screen 2.76 → 2.56 % | – | the far posts as 2; a caster behind the camera culled in a quick turn by the boards | known → not fixed (left) |
| 6 | noticeable | Handheld 35° · arch | peter-pan 24.7 → 23.3 %, off screen 4.6 → 4.3 % | [arch](shadow-v1.87/handheld.sun35-90.arch.webp) | the balcony's shadow on its wall: the near map's 16 cm texel under a 40 cm overhang (a lit line under the overhang, orange in the picture) | known → not fixed (left) |
| 7 | look | Handheld 12° · poles | his spill 36 → 36 % (limit 35 %) | – | his shadow's blur beside the poles on the 16 cm texel | known → not fixed (left) |
| 8 | look | Handheld 12° · stairs | off screen 1.36 → 1.20 % (limit 1 %) | – | the terrace's balusters behind the camera on the stair | at the line → at the line |

Nothing moved beyond a run's own spread, and #492's every-frame near map left every reading where it was (the QC reads
the frame's maps whenever they were drawn: a map held a frame looked the same to it). No issue filed: every red is one
rendering.md keeps as left. The Handheld balcony (6) is the one a player could see: a pale line under an overhang on the
Retroid's and a phone's preset, worth a look the next time the Handheld's cascades are touched.

## What was not checked

The shadows in the real worlds by eye (the visual audit's probes: visual-v1.87), the Xbox preset, the devices, and the
Unity port's shadows (HiraethShadows draws its own cascades: the QC reads the web's lookup only; Unity's shadows are in
the visual check's pictures, visual-v1.87).
