# Ink lines at every distance and resolution, v1.34 (2026-10-10)

<!-- audit-scores
overall: 4.48 / 5
label: the mean of 91 pictures (13 scenes at 7 resolutions; 4.20 before the fixes)
date: 2026-10-10
-->

The first run of the ink-lines audit (`.claude/skills/ink-lines/SKILL.md`), October 2026, after the author's note:
"Lines are too big for some vegetation, and the character's eyes now render almost like black eyes when looking at him
from afar … it should look good at all distances (the biggest problem we have), and at lower resolutions."

13 scenes (plants near to 120 m, Spheres canopies, the traveller's face at 1, 4, 10 and 25 m, a pack in the Arena, the
desert temple's hall, Qanat up the valley) at 7 resolutions (1080p Medium, 1080p at DPR 2 High, 720p, Handheld at 0.75
and at its 0.5 floor, Steam Deck, a phone held sideways at DPR 3): 91 pictures a run, the same instant every run.
Before: b954c1da. After: this branch. Mac M4 Pro, headless Chrome on the GPU (ANGLE Metal), shared with other agents.

## Findings, worst first

1. **Far plants were black masses** (all resolutions). Edena's flowers at 40-60 m (tulips, clover, ribbon lilies,
   daisy mats; 5-15 px tall) were 50-57 % ink and 23-41 % near-black: every stem and petal was a kernel or two wide,
   and the silhouette line (the ground far behind them makes a depth edge) and the creases on them covered all of it.
   Picture: `changelog-media/1.34/ink-plants-far-before.webp`, `ink-plants-handheld-before.webp`.
   Cause: post.js block 1, a pen line of fixed CSS width drawn on both sides of every edge, whatever the size of the
   thing it outlines. Mid distance (18 m) 31-43 % ink.
2. **The traveller's eyes were black dots from 4 m on** (all resolutions). At 4 m (face 22 px) his eyes laid 2.6× the
   share of his face they lay at 1 m, their darkest pixel 0.13 of his cheek's light; at 10 m (9 px) 3.7×, an eye one
   black pixel, the mouth a black blot. `ink-traveller-far-before.webp`.
   Cause: head-ink.js, every stroke's least width drawn in full ink (the lid never under 0.85 px, the iris never under
   1.2 px), and the opening's far colour a dark brown: once the opening was a pixel or two tall it was one black mark.
3. **Lines heavier on small frames** (phone, Deck, 720p, the Handheld's floor). A line's width is CSS px, so on a frame
   390 CSS px tall it is 2.8× the share of the picture it is at 1080; at the Handheld's 0.5 floor a kernel of 0.85
   render px was drawn a pixel wide, 2 CSS px a side. Frame ink: the portrait at handheld-low 9.4 % (desk1080 2.7 %),
   the town 6.0 %, a phone 6.4-6.9 %. `ink-low-res-before.webp`.
4. **Shimmer on the far town** (every resolution, before and after): Qanat at 150 m changes 0.44 of its ink a half
   pixel over (12-14 % pops). Not this audit's fix: the haze layers and the wobble's noise on thin far shapes; left for
   the motion check (TODO).
5. **The pack's blacks** (42-49 % near-black): the ink blots are ink by design. The rubric no longer judges foes by
   their blacks (their line width on small foes is still checked).

## Fixes

- **Lines by the size of what they draw** (post.js 1a, `INK_SIZE`; `docs/systems/rendering.md`, "Ink lines by size on
  screen"): on a sliver (a pixel that differs from both its neighbours across, in depth, crease or colour: a feature a
  kernel or two wide) the line keeps off and the colour shows (0.3 of the line left); beside a depth edge, where the
  shape in front is no thicker than one or three kernels (two taps past it), its outline keeps 0.45; under 900 CSS px
  tall the lines thin with the frame (to 0.6); a kernel under a render pixel carries its coverage (to 0.7).
- **The face from afar** (head-ink.js `HEAD_INK_FAR`; `docs/systems/faces.md`, "From afar"): a stroke drawn wider than
  itself carries its coverage (lifted by 0.35 so it still reads; as before on a face over ~110 px), and once the
  opening is ~6 px tall it turns to one warm shade of the skin, reaching it at ~2.7 px.

| before → after | desk1080 | handheld | handheld-low | phone |
|---|---|---|---|---|
| plants at 55 m: ink | 54.0 → 40.0 % | 52.8 → 34.3 % | 56.4 → 40.9 % | 49.4 → 31.4 % |
| plants at 55 m: near-black | 36.4 → 11.9 % | 30.9 → 4.4 % | 26.9 → 5.3 % | 29.3 → 4.6 % |
| plants at 55 m: line width, median / p90 px | 6/14 → 3/7 | 5/16 → 2/6 | 6/18 → 4/8 | 14/38 → 7/19 |
| plants at 18 m: near-black | 19.4 → 10.2 % | 17.9 → 4.0 % | 13.1 → 4.7 % | 24.0 → 6.2 % |
| the traveller at 4 m: eyes' share of the face × 1 m | 2.6 → 2.1 | 3.6 → 2.6 | 2.8 → 2.7 | 1.8 → 1.3 |
| at 4 m: darkest eye pixel / cheek (0 black) | 0.13 → 0.31 | 0.24 → 0.47 | 0.33 → 0.38 | 0.51 → 0.62 |
| at 10 m: darkest eye pixel / cheek | 0.21 → 0.36 | 0.54 → 0.55 | 0.75 → 0.72 | 0.63 → 0.70 |
| frame ink, the town far off | 2.8 → 2.6 % | 4.5 → 4.0 % | 6.0 → 3.9 % | 6.4 → 4.2 % |
| frame ink, the 1 m portrait | 2.7 → 2.4 % | 6.1 → 5.5 % | 9.4 → 6.3 % | 6.9 → 4.8 % |

Mean score over the 91 pictures 4.20 → 4.48 of 5 (the rubric of SKILL.md). Pictures: `changelog-media/1.34/`
(`ink-plants-far`, `ink-plants-handheld`, `ink-traveller-far`: 4, 10 and 25 m at desk1080, `ink-low-res`).

**The approved look at play distance, 1080p** (desk1080, the same instant before and after, pixels changed by more
than 24 of 255): the meadow from 5 m 0.41 % (the far flowers in it), from 18 m 0.35 %, the Spheres' canopies 0.74 % and
0.09 %, the pack 0.65 %, the temple hall 0.15 %, the town 1.43 % (its flag and smoke move on the CPU between runs); the
1 m portrait's eyes 1.0 → 1.0 × themselves (the pose differs run to run: his idle).

## Cost

The ink pass alone by timer query (`cost.mjs`, median of 9 × 16 frames, the builds in turns, four turns each):
High, 1920 × 1080 at DPR 2 (3840 × 2160): the town 7.02 → 7.24 ms, the meadow 7.81 → 8.10 ms in the quiet turns
(+0.2-0.3 ms, 3-4 %, with the sliver worked out in every pixel); after moving it under the inked-pixel branch
(`gSliver` only stores the neighbours' differences) the machine was busy with other agents' GPU work and the High
numbers were within the noise (13.5-14.3 ms either build). Handheld (960 × 540): the town 3.80 → 3.85 ms, the meadow
2.60 → 2.66 ms (+0.05 ms). The frame times moved within the noise on both. The face: a multiply a stroke.

## Left

- The plants at 55 m are still 34-41 % ink (the far cap is 30 %): the flower heads' outlines, which read as drawn.
  A material line weight for the meadow's flowers (lighter, in their own colour, as the `leaves` foliage) would take
  the rest, but changes them close up: for the author.
- Shimmer on the far town (finding 4).
- The rubric's eye share on faces of 4-10 px is a pixel's rounding: the darkest-pixel check carries them.

<!-- ink-lines:measured -->
Captured 2026-10-10: before at b954c1da, after with the fixes on the same tree; 91 pictures a run, 160 s.

**Mean score** (of 5, every scene at every resolution): 4.20 → **4.48**

### Scores (of 5) by scene and resolution

| scene | desk1080 | desk1080x2 | p720 | handheld | handheld-low | deck | phone |
|---|---|---|---|---|---|---|---|
| portrait-1 | 4.38 → 4.38 | 5.00 → 5.00 | 5.00 → 5.00 | 4.50 → 4.50 | 4.50 → 4.50 | 4.50 → 4.50 | 4.00 → 4.50 |
| portrait-4 | 3.75 → 4.38 | 4.00 → 4.50 | 3.75 → 4.38 | 3.75 → 3.75 | 3.75 → 3.75 | 3.75 → 3.75 | 4.38 → 5.00 |
| portrait-10 | 4.38 → 4.38 | 3.75 → 4.38 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 4.38 → 4.38 | 5.00 → 5.00 |
| portrait-25 | 3.13 → 3.75 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 4.38 → 5.00 |
| town-far | 3.33 → 3.33 | 4.17 → 4.17 | 4.17 → 4.17 | 4.17 → 4.17 | 3.33 → 4.17 | 3.33 → 3.33 | 4.17 → 4.17 |
| veg-near | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| veg-mid | 3.75 → 4.38 | 3.75 → 4.38 | 3.13 → 4.38 | 3.13 → 4.38 | 3.75 → 4.38 | 3.13 → 4.38 | 3.13 → 4.38 |
| veg-far | 2.50 → 3.75 | 2.50 → 3.13 | 2.50 → 3.75 | 2.50 → 3.75 | 3.13 → 3.75 | 2.50 → 3.75 | 3.13 → 3.75 |
| veg-farthest | 2.50 → 3.75 | 2.50 → 3.75 | 2.50 → 3.75 | 3.13 → 3.75 | 3.13 → 3.75 | 2.50 → 3.75 | 3.13 → 4.38 |
| canopy-mid | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 4.38 | 5.00 → 4.38 | 5.00 → 5.00 | 5.00 → 4.38 |
| canopy-far | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 3.75 → 3.75 |
| pack | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| temple-hall | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |

### Plants: ink share / near-black share / line width (median, p90 px) / height on screen

| scene | res | ink | dark | width | height px |
|---|---|---|---|---|---|
| veg-near | desk1080 | 7.2 % → 6.5 % | 4.2 % → 2.8 % | 3/10 → 2/6 | 1080 |
| veg-near | desk1080x2 | 7.0 % → 6.3 % | 4.7 % → 3.5 % | 4/16 → 4/10 | 2160 |
| veg-near | p720 | 9.4 % → 7.8 % | 5.5 % → 3.2 % | 3/9 → 2/5 | 720 |
| veg-near | handheld | 9.5 % → 6.6 % | 4.6 % → 1.1 % | 3/9 → 2/6 | 720 |
| veg-near | handheld-low | 9.8 % → 8.6 % | 3.1 % → 1.1 % | 3/10 → 2/6 | 720 |
| veg-near | deck | 8.6 % → 7.7 % | 5.1 % → 3.2 % | 3/10 → 2/5 | 800 |
| veg-near | phone | 14.8 % → 10.0 % | 7.5 % → 2.1 % | 8/19 → 4/12 | 1170 |
| veg-mid | desk1080 | 31.3 % → 26.5 % | 19.4 % → 10.2 % | 3/9 → 2/5 | 374 |
| veg-mid | desk1080x2 | 31.7 % → 26.7 % | 22.5 % → 13.8 % | 7/17 → 4/8 | 747 |
| veg-mid | p720 | 36.9 % → 28.1 % | 22.3 % → 9.5 % | 3/7 → 2/4 | 250 |
| veg-mid | handheld | 35.1 % → 23.9 % | 17.9 % → 4.0 % | 3/7 → 2/5 | 249 |
| veg-mid | handheld-low | 38.2 % → 31.9 % | 13.1 % → 4.7 % | 4/8 → 3/5 | 250 |
| veg-mid | deck | 35.5 % → 29.9 % | 21.5 % → 11.1 % | 3/8 → 2/5 | 275 |
| veg-mid | phone | 43.3 % → 29.1 % | 24.0 % → 6.2 % | 9/19 → 5/11 | 405 |
| veg-far | desk1080 | 54.0 % → 40.0 % | 36.4 % → 11.9 % | 6/14 → 3/7 | 354 |
| veg-far | desk1080x2 | 54.6 % → 40.3 % | 40.8 % → 16.9 % | 10/25 → 4/11 | 708 |
| veg-far | p720 | 54.7 % → 36.8 % | 36.2 % → 9.5 % | 5/13 → 3/7 | 237 |
| veg-far | handheld | 52.8 % → 34.3 % | 30.9 % → 4.4 % | 5/16 → 2/6 | 237 |
| veg-far | handheld-low | 56.4 % → 40.9 % | 26.9 % → 5.3 % | 6/18 → 4/8 | 237 |
| veg-far | deck | 56.0 % → 41.4 % | 38.5 % → 13.2 % | 5/14 → 3/7 | 263 |
| veg-far | phone | 49.4 % → 31.4 % | 29.3 % → 4.6 % | 14/38 → 7/19 | 385 |
| veg-farthest | desk1080 | 53.2 % → 40.3 % | 34.3 % → 11.2 % | 6/12 → 3/7 | 473 |
| veg-farthest | desk1080x2 | 54.5 % → 41.0 % | 38.5 % → 15.8 % | 11/23 → 4/11 | 944 |
| veg-farthest | p720 | 51.2 % → 35.9 % | 32.4 % → 9.0 % | 5/10 → 3/6 | 315 |
| veg-farthest | handheld | 49.9 % → 32.3 % | 26.9 % → 3.7 % | 6/10 → 3/6 | 287 |
| veg-farthest | handheld-low | 53.5 % → 38.7 % | 23.0 % → 3.3 % | 6/11 → 3/8 | 286 |
| veg-farthest | deck | 52.2 % → 38.0 % | 33.7 % → 9.1 % | 6/10 → 3/6 | 349 |
| veg-farthest | phone | 45.2 % → 28.6 % | 23.7 % → 3.4 % | 13/24 → 7/16 | 465 |
| canopy-mid | desk1080 | 8.4 % → 8.3 % | 3.1 % → 3.1 % | 1/3 → 1/3 | 670 |
| canopy-mid | desk1080x2 | 8.5 % → 8.4 % | 4.4 % → 4.3 % | 3/5 → 3/5 | 1339 |
| canopy-mid | p720 | 11.8 % → 10.5 % | 2.7 % → 2.4 % | 1/3 → 1/3 | 447 |
| canopy-mid | handheld | 11.4 % → 7.6 % | 1.0 % → 0.4 % | 2/3 → 1/2 | 447 |
| canopy-mid | handheld-low | 11.2 % → 11.1 % | 0.4 % → 0.4 % | 2/4 → 2/3 | 447 |
| canopy-mid | deck | 11.1 % → 10.9 % | 2.9 % → 2.9 % | 1/3 → 1/3 | 496 |
| canopy-mid | phone | 18.1 % → 12.3 % | 1.7 % → 0.6 % | 5/13 → 4/9 | 727 |
| canopy-far | desk1080 | 21.8 % → 20.6 % | 5.8 % → 4.3 % | 2/7 → 2/5 | 243 |
| canopy-far | desk1080x2 | 22.0 % → 20.8 % | 7.4 % → 5.9 % | 4/12 → 3/8 | 486 |
| canopy-far | p720 | 28.9 % → 22.2 % | 7.4 % → 3.9 % | 2/9 → 2/5 | 161 |
| canopy-far | handheld | 24.7 % → 20.4 % | 5.6 % → 2.4 % | 2/9 → 2/5 | 162 |
| canopy-far | handheld-low | 29.3 % → 26.4 % | 6.8 % → 3.1 % | 3/12 → 2/6 | 163 |
| canopy-far | deck | 26.8 % → 23.8 % | 6.8 % → 4.4 % | 2/9 → 2/5 | 180 |
| canopy-far | phone | 35.2 % → 27.9 % | 8.9 % → 2.8 % | 10/33 → 5/13 | 262 |

### The traveller: face height on screen (brow to chin), the eyes' dark as a share of the face against the 1 m portrait at desk1080 (× ref: 1 keeps its proportion), their density (dark over the opening), the darkest eye pixel against the cheek (0 black), his near-black share

| scene | res | face px | eyes × ref | eye density | darkest | dark share |
|---|---|---|---|---|---|---|
| portrait-1 | desk1080 | 124 | 1.0 → 1.0 | 0.91 → 0.92 | 0.06 → 0.06 | 9.0 % → 8.9 % |
| portrait-1 | desk1080x2 | 249 | 0.5 → 0.5 | 0.56 → 0.58 | 0.07 → 0.07 | 9.6 % → 9.9 % |
| portrait-1 | p720 | 81 | 1.0 → 0.9 | 0.90 → 0.82 | 0.07 → 0.07 | 8.8 % → 8.7 % |
| portrait-1 | handheld | 80 | 1.3 → 1.2 | 1.19 → 1.08 | 0.07 → 0.18 | 7.7 % → 7.6 % |
| portrait-1 | handheld-low | 83 | 1.4 → 1.3 | 1.29 → 1.17 | 0.11 → 0.24 | 7.8 % → 7.6 % |
| portrait-1 | deck | 92 | 1.2 → 1.2 | 1.11 → 1.07 | 0.06 → 0.06 | 8.7 % → 8.7 % |
| portrait-1 | phone | 134 | 1.5 → 1.3 | 1.41 → 1.23 | 0.11 → 0.27 | 8.2 % → 7.9 % |
| portrait-4 | desk1080 | 22 | 2.6 → 2.1 | 2.31 → 1.90 | 0.13 → 0.31 | 3.8 % → 3.7 % |
| portrait-4 | desk1080x2 | 43 | 1.4 → 1.1 | 1.61 → 1.29 | 0.16 → 0.32 | 3.6 % → 3.5 % |
| portrait-4 | p720 | 14 | 2.8 → 2.1 | 2.46 → 1.84 | 0.18 → 0.41 | 4.8 % → 4.3 % |
| portrait-4 | handheld | 14 | 3.6 → 2.6 | 3.25 → 2.39 | 0.24 → 0.47 | 2.2 % → 2.0 % |
| portrait-4 | handheld-low | 14 | 2.8 → 2.5 | 2.54 → 2.29 | 0.33 → 0.47 | 4.0 % → 2.4 % |
| portrait-4 | deck | 16 | 3.2 → 2.6 | 2.89 → 2.34 | 0.14 → 0.36 | 3.9 % → 3.6 % |
| portrait-4 | phone | 23 | 1.8 → 1.3 | 1.65 → 1.20 | 0.51 → 0.62 | 2.8 % → 2.4 % |
| portrait-10 | desk1080 | 9 | 3.7 → 3.1 | 3.28 → 2.81 | 0.21 → 0.36 | 3.8 % → 3.6 % |
| portrait-10 | desk1080x2 | 17 | 3.0 → 2.4 | 2.69 → 2.16 | 0.33 → 0.46 | 4.2 % → 3.6 % |
| portrait-10 | p720 | 6 | 2.1 → 1.7 | 1.32 → 1.05 | 0.61 → 0.63 | 9.0 % → 5.8 % |
| portrait-10 | handheld | 6 | 3.0 → 2.6 | 2.00 → 1.74 | 0.54 → 0.55 | 2.4 % → 2.6 % |
| portrait-10 | handheld-low | 6 | 1.1 → 1.7 | 0.77 → 1.15 | 0.75 → 0.71 | 1.7 % → 1.4 % |
| portrait-10 | deck | 6 | 4.1 → 4.1 | 3.43 → 3.46 | 0.30 → 0.31 | 3.8 % → 3.2 % |
| portrait-10 | phone | 9 | 2.5 → 1.6 | 2.17 → 1.42 | 0.63 → 0.70 | 2.1 % → 1.3 % |
| portrait-25 | desk1080 | 3 | 12.0 → 9.5 | 2.86 → 2.29 | 0.35 → 0.36 | 12.5 % → 6.3 % |
| portrait-25 | desk1080x2 | 7 | 3.7 → 2.8 | 3.26 → 2.55 | 0.48 → 0.48 | 2.5 % → 2.0 % |
| portrait-25 | p720 | 2 | 22.9 → 15.6 | 2.32 → 1.60 | 0.46 → 0.47 | 14.0 % → 6.4 % |
| portrait-25 | handheld | 2 | 4.2 → 3.6 | 0.45 → 0.38 | 0.79 → 0.79 | 6.2 % → 3.0 % |
| portrait-25 | handheld-low | 2 | 22.0 → 21.4 | 2.37 → 2.33 | 0.50 → 0.52 | 7.2 % → 0.7 % |
| portrait-25 | deck | 3 | 9.4 → 5.4 | 1.24 → 0.72 | 0.52 → 0.73 | 3.2 % → 5.3 % |
| portrait-25 | phone | 4 | 0.8 → 0.9 | 0.22 → 0.26 | 0.88 → 0.88 | 18.1 % → 0.1 % |

### The whole frame: ink share, line width (median px), shimmer (change / pops a half pixel over)

| scene | res | frame ink | width | shimmer |
|---|---|---|---|---|
| portrait-1 | desk1080 | 2.7 % → 2.4 % | 2 → 2 | 0.06 → 0.07 / 0.00 → 0.00 |
| portrait-1 | desk1080x2 | 2.0 % → 1.9 % | 4 → 4 | 0.04 → 0.04 / 0.00 → 0.00 |
| portrait-1 | p720 | 5.3 % → 4.8 % | 2 → 2 | 0.05 → 0.05 / 0.00 → 0.00 |
| portrait-1 | handheld | 6.1 % → 5.5 % | 3 → 3 | 0.05 → 0.05 / 0.00 → 0.00 |
| portrait-1 | handheld-low | 9.4 % → 6.3 % | 5 → 3 | 0.05 → 0.07 / 0.00 → 0.00 |
| portrait-1 | deck | 3.4 % → 3.1 % | 2 → 2 | 0.07 → 0.08 / 0.00 → 0.00 |
| portrait-1 | phone | 6.9 % → 4.8 % | 9 → 7 | 0.06 → 0.08 / 0.00 → 0.00 |
| portrait-4 | desk1080 | 3.0 % → 2.8 % | 2 → 2 | 0.06 → 0.07 / 0.00 → 0.00 |
| portrait-4 | desk1080x2 | 3.1 % → 2.7 % | 5 → 4 | 0.03 → 0.04 / 0.00 → 0.00 |
| portrait-4 | p720 | 4.3 % → 3.9 % | 3 → 2 | 0.04 → 0.05 / 0.00 → 0.00 |
| portrait-4 | handheld | 5.3 % → 4.6 % | 3 → 3 | 0.04 → 0.06 / 0.00 → 0.00 |
| portrait-4 | handheld-low | 7.1 % → 4.6 % | 6 → 3 | 0.05 → 0.08 / 0.00 → 0.00 |
| portrait-4 | deck | 3.7 % → 3.3 % | 2 → 2 | 0.06 → 0.07 / 0.00 → 0.00 |
| portrait-4 | phone | 8.3 % → 5.6 % | 12 → 6 | 0.04 → 0.06 / 0.00 → 0.00 |
| portrait-10 | desk1080 | 2.7 % → 2.5 % | 2 → 2 | 0.06 → 0.07 / 0.00 → 0.00 |
| portrait-10 | desk1080x2 | 3.0 % → 2.7 % | 6 → 5 | 0.04 → 0.05 / 0.00 → 0.00 |
| portrait-10 | p720 | 4.3 % → 3.8 % | 3 → 2 | 0.04 → 0.06 / 0.00 → 0.00 |
| portrait-10 | handheld | 4.9 % → 4.3 % | 3 → 3 | 0.04 → 0.06 / 0.00 → 0.00 |
| portrait-10 | handheld-low | 7.2 % → 4.3 % | 6 → 3 | 0.05 → 0.09 / 0.00 → 0.00 |
| portrait-10 | deck | 3.5 % → 3.1 % | 3 → 2 | 0.06 → 0.07 / 0.00 → 0.00 |
| portrait-10 | phone | 7.4 % → 4.7 % | 12 → 6 | 0.04 → 0.06 / 0.00 → 0.00 |
| portrait-25 | desk1080 | 3.2 % → 2.9 % | 2 → 2 | 0.44 → 0.34 / 0.21 → 0.12 |
| portrait-25 | desk1080x2 | 2.8 % → 2.6 % | 6 → 5 | 0.06 → 0.07 / 0.00 → 0.00 |
| portrait-25 | p720 | 4.1 % → 3.5 % | 3 → 2 | 0.10 → 0.12 / 0.01 → 0.01 |
| portrait-25 | handheld | 4.7 % → 4.1 % | 3 → 3 | 0.10 → 0.12 / 0.01 → 0.00 |
| portrait-25 | handheld-low | 5.4 % → 3.2 % | 6 → 3 | 0.10 → 0.14 / 0.01 → 0.00 |
| portrait-25 | deck | 3.6 % → 3.1 % | 4 → 2 | 0.08 → 0.12 / 0.01 → 0.00 |
| portrait-25 | phone | 7.5 % → 5.5 % | 11 → 6 | 0.27 → 0.28 / 0.07 → 0.01 |
| town-far | desk1080 | 2.8 % → 2.6 % | 2 → 2 | 0.44 → 0.46 / 0.14 → 0.13 |
| town-far | desk1080x2 | 2.5 % → 2.3 % | 5 → 4 | 0.43 → 0.45 / 0.10 → 0.10 |
| town-far | p720 | 3.9 % → 3.6 % | 2 → 2 | 0.42 → 0.44 / 0.12 → 0.11 |
| town-far | handheld | 4.5 % → 4.0 % | 3 → 3 | 0.43 → 0.45 / 0.10 → 0.09 |
| town-far | handheld-low | 6.0 % → 3.9 % | 7 → 4 | 0.44 → 0.50 / 0.13 → 0.07 |
| town-far | deck | 3.7 % → 3.4 % | 2 → 2 | 0.45 → 0.47 / 0.14 → 0.13 |
| town-far | phone | 6.4 % → 4.2 % | 14 → 7 | 0.40 → 0.45 / 0.11 → 0.05 |
| veg-near | desk1080 | 3.5 % → 3.2 % | 2 → 2 | 0.07 → 0.07 / 0.00 → 0.00 |
| veg-near | desk1080x2 | 4.0 % → 3.6 % | 4 → 4 | 0.08 → 0.09 / 0.00 → 0.00 |
| veg-near | p720 | 5.0 % → 3.9 % | 2 → 2 | 0.07 → 0.08 / 0.00 → 0.00 |
| veg-near | handheld | 4.4 % → 3.5 % | 2 → 2 | 0.10 → 0.10 / 0.00 → 0.00 |
| veg-near | handheld-low | 4.8 % → 4.5 % | 2 → 2 | 0.10 → 0.11 / 0.00 → 0.00 |
| veg-near | deck | 4.1 % → 3.6 % | 2 → 2 | 0.08 → 0.09 / 0.00 → 0.00 |
| veg-near | phone | 6.3 % → 5.1 % | 6 → 4 | 0.11 → 0.11 / 0.00 → 0.00 |
| veg-mid | desk1080 | 3.0 % → 2.8 % | 2 → 2 | 0.13 → 0.12 / 0.00 → 0.00 |
| veg-mid | desk1080x2 | 3.4 % → 3.2 % | 4 → 4 | 0.19 → 0.19 / 0.01 → 0.01 |
| veg-mid | p720 | 4.4 % → 3.4 % | 2 → 2 | 0.12 → 0.13 / 0.00 → 0.00 |
| veg-mid | handheld | 3.8 % → 3.1 % | 2 → 2 | 0.13 → 0.11 / 0.00 → 0.00 |
| veg-mid | handheld-low | 4.2 % → 3.9 % | 2 → 2 | 0.12 → 0.12 / 0.00 → 0.00 |
| veg-mid | deck | 3.5 % → 3.1 % | 2 → 2 | 0.13 → 0.13 / 0.00 → 0.00 |
| veg-mid | phone | 5.6 % → 4.6 % | 6 → 4 | 0.13 → 0.12 / 0.00 → 0.00 |
| veg-far | desk1080 | 2.9 % → 2.7 % | 2 → 2 | 0.15 → 0.16 / 0.01 → 0.00 |
| veg-far | desk1080x2 | 3.3 % → 3.0 % | 4 → 4 | 0.22 → 0.23 / 0.01 → 0.01 |
| veg-far | p720 | 4.4 % → 3.4 % | 2 → 2 | 0.15 → 0.17 / 0.01 → 0.00 |
| veg-far | handheld | 3.7 % → 3.2 % | 2 → 2 | 0.13 → 0.14 / 0.00 → 0.00 |
| veg-far | handheld-low | 4.2 % → 3.9 % | 2 → 2 | 0.12 → 0.14 / 0.00 → 0.01 |
| veg-far | deck | 3.5 % → 3.0 % | 2 → 2 | 0.13 → 0.14 / 0.00 → 0.00 |
| veg-far | phone | 5.4 % → 4.5 % | 6 → 4 | 0.13 → 0.13 / 0.01 → 0.00 |
| veg-farthest | desk1080 | 4.0 % → 3.7 % | 2 → 2 | 0.14 → 0.16 / 0.02 → 0.02 |
| veg-farthest | desk1080x2 | 4.3 % → 4.0 % | 4 → 4 | 0.17 → 0.20 / 0.04 → 0.04 |
| veg-farthest | p720 | 5.7 % → 4.6 % | 3 → 2 | 0.14 → 0.18 / 0.02 → 0.02 |
| veg-farthest | handheld | 5.2 % → 4.3 % | 3 → 2 | 0.18 → 0.21 / 0.03 → 0.02 |
| veg-farthest | handheld-low | 6.0 % → 5.4 % | 3 → 2 | 0.19 → 0.21 / 0.04 → 0.03 |
| veg-farthest | deck | 5.1 % → 4.5 % | 3 → 2 | 0.14 → 0.18 / 0.02 → 0.02 |
| veg-farthest | phone | 7.4 % → 6.2 % | 7 → 4 | 0.16 → 0.19 / 0.02 → 0.02 |
| canopy-mid | desk1080 | 1.7 % → 1.7 % | 2 → 2 | 0.18 → 0.19 / 0.02 → 0.02 |
| canopy-mid | desk1080x2 | 1.7 % → 1.7 % | 4 → 4 | 0.20 → 0.20 / 0.05 → 0.05 |
| canopy-mid | p720 | 2.4 % → 2.1 % | 2 → 2 | 0.19 → 0.22 / 0.02 → 0.02 |
| canopy-mid | handheld | 2.4 % → 1.6 % | 2 → 1 | 0.25 → 0.39 / 0.03 → 0.01 |
| canopy-mid | handheld-low | 2.4 % → 2.3 % | 2 → 2 | 0.29 → 0.40 / 0.02 → 0.02 |
| canopy-mid | deck | 2.4 % → 2.3 % | 2 → 2 | 0.19 → 0.33 / 0.02 → 0.02 |
| canopy-mid | phone | 3.5 % → 2.4 % | 6 → 4 | 0.26 → 0.41 / 0.03 → 0.02 |
| canopy-far | desk1080 | 1.3 % → 1.3 % | 2 → 2 | 0.24 → 0.25 / 0.07 → 0.07 |
| canopy-far | desk1080x2 | 1.3 % → 1.3 % | 4 → 4 | 0.23 → 0.25 / 0.09 → 0.09 |
| canopy-far | p720 | 1.8 % → 1.5 % | 2 → 2 | 0.23 → 0.27 / 0.07 → 0.07 |
| canopy-far | handheld | 1.7 % → 1.3 % | 2 → 2 | 0.28 → 0.31 / 0.08 → 0.04 |
| canopy-far | handheld-low | 1.9 % → 1.8 % | 2 → 2 | 0.27 → 0.30 / 0.04 → 0.04 |
| canopy-far | deck | 1.8 % → 1.7 % | 2 → 2 | 0.21 → 0.25 / 0.06 → 0.06 |
| canopy-far | phone | 2.5 % → 1.9 % | 6 → 4 | 0.34 → 0.36 / 0.12 → 0.07 |
| pack | desk1080 | 2.1 % → 2.0 % | 2 → 2 | 0.11 → 0.12 / 0.00 → 0.00 |
| pack | desk1080x2 | 2.1 % → 2.0 % | 4 → 4 | 0.12 → 0.13 / 0.02 → 0.02 |
| pack | p720 | 2.9 % → 2.3 % | 2 → 2 | 0.11 → 0.14 / 0.00 → 0.01 |
| pack | handheld | 3.0 % → 2.3 % | 2 → 2 | 0.14 → 0.18 / 0.01 → 0.01 |
| pack | handheld-low | 3.5 % → 3.2 % | 2 → 2 | 0.19 → 0.22 / 0.02 → 0.02 |
| pack | deck | 3.0 % → 2.5 % | 2 → 2 | 0.12 → 0.15 / 0.00 → 0.00 |
| pack | phone | 4.4 % → 3.0 % | 7 → 4 | 0.19 → 0.24 / 0.03 → 0.03 |
| temple-hall | desk1080 | 2.1 % → 2.0 % | 2 → 2 | 0.22 → 0.23 / 0.04 → 0.04 |
| temple-hall | desk1080x2 | 2.1 % → 2.0 % | 4 → 4 | 0.24 → 0.25 / 0.08 → 0.08 |
| temple-hall | p720 | 3.0 % → 2.3 % | 2 → 2 | 0.22 → 0.27 / 0.03 → 0.03 |
| temple-hall | handheld | 3.3 % → 2.4 % | 2 → 2 | 0.23 → 0.28 / 0.04 → 0.03 |
| temple-hall | handheld-low | 3.2 % → 3.1 % | 2 → 2 | 0.29 → 0.30 / 0.07 → 0.06 |
| temple-hall | deck | 2.9 % → 2.5 % | 2 → 2 | 0.23 → 0.25 / 0.04 → 0.04 |
| temple-hall | phone | 4.8 % → 3.3 % | 6 → 4 | 0.23 → 0.30 / 0.04 → 0.04 |

### The worst pictures (failing and borderline checks)

- veg-far @ desk1080x2: 3.13 — inkShare 0.403 ✗, darkShare 0.169 ~
- town-far @ desk1080: 3.33 — shimmer 0.463 ~, pops 0.126 ~
- town-far @ deck: 3.33 — shimmer 0.466 ~, pops 0.125 ~
- portrait-25 @ desk1080: 3.75 — eyeBlack 0.64 ~, pops 0.121 ~
- portrait-4 @ handheld: 3.75 — eyeGrowth 2.633 ✗
- portrait-4 @ handheld-low: 3.75 — eyeGrowth 2.507 ✗
- portrait-4 @ deck: 3.75 — eyeGrowth 2.561 ✗
- veg-far @ desk1080: 3.75 — inkShare 0.4 ✗
- veg-farthest @ desk1080: 3.75 — inkShare 0.403 ✗
- veg-farthest @ desk1080x2: 3.75 — inkShare 0.41 ✗
- veg-far @ p720: 3.75 — inkShare 0.368 ✗
- veg-farthest @ p720: 3.75 — inkShare 0.359 ✗
<!-- /ink-lines:measured -->
