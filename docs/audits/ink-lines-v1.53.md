# Ink lines at every distance and resolution, v1.53 (2026-10-12)

<!-- audit-scores
overall: 4.72 / 5
label: the mean of 112 pictures (16 scenes at 7 resolutions; 4.63 before the fix)
date: 2026-10-12
-->

The second run of the ink-lines audit (`.claude/skills/ink-lines/SKILL.md`), for what `docs/audits/ink-lines-v1.34.md`
left (#38):
- Viridel's flowers 55 m off were still 34-41 % ink. The rubric's far cap is 30 %.
- The far town shimmered: Qanat at 150 m changed 0.44 of its ink a half pixel over, with 12-14 % pops.

16 scenes at 7 resolutions: the v1.34 matrix, plus the Underwater City's avenue, the Moon Foundry's floor and the City
Floating in Space's bridges, which joined after v1.34. That is 112 pictures a run, the same instant every run.
- Before: `29b04302`, with `src/flora.js` and `src/materials.js` as they were and the new shimmer reading (below).
- After: this branch.
- Mac M4 Pro, headless Chrome on the GPU (ANGLE Metal), muted, on its own Vite (port 5743).

## Findings, worst first

1. **The far flowers' outlines were still a third of them** (every resolution). Viridel's tulips, clover and daisy
   mats at 40-60 m were 34-42 % ink (`veg-far`, `veg-farthest`). Their heads are 5-15 px tall, and their outline in
   the world's black ink covered a third of what it drew. v1.34 took the slivers and the thin shapes' outlines;
   what was left was the line itself. Picture: `changelog-media/1.53/ink-flowers-far-before.webp`.
2. **The far town's shimmer was the audit's own reading, not the town** (every resolution). The nudge moves the camera
   sideways half a render pixel at the distance it looks at (~180 m, Qanat). A thing nearer slides more: the pole,
   its sign, the traveller and the box 8-12 m off slide ~9 px. All their lines are in a new place, and the shimmer was
   read over the whole frame. Split, at 1080p:
   - Qanat itself changes 0.28 of its ink with 5 % pops;
   - everything in front of it changes 0.54 with 17 % pops.

   v1.34's checks found the same thing from the other side: the wobble was faded with distance and the shimmer didn't
   move (0.452 → 0.454). The near rows of the view change 0.9 of their ink, the town's 0.2-0.5.
3. **New: the City Floating in Space's bridges shimmer on small frames** (`sc-bridges`). Read over what slides under a
   pixel, the bridges change 0.36-0.39 at the Handheld's 0.5 floor and on a phone, with 4-5 % pops (0.20 at 1080p).
   This is the rubric's borderline. Thin rails far off are a render pixel or less there.

## Fixes

- **The meadow's flowers from afar** (`src/flora.js` `FAR_LINE`, `makeMaterial({ lineFar })`, the `LINE_FAR` define;
  `docs/systems/rendering.md`, "Lines by material"). Past 25-40 m, Viridel's small plants are drawn in a lighter line:
  - the line is 0.45 of the ink, in a dark shade of their own colour (0.67), like the `leaves` foliage;
  - each plant turns over at its own distance in that band (a hash of where it stands), so the meadow never shows a
    ring round the camera;
  - the vertex shader decides once a plant (a flat varying), so a plant is never half one line and half the other;
  - up close they keep the world's black ink. The large plants and the other worlds' flora are unchanged.

  The weight came from trying two: 0.7 (the `leaves` weight, the one tried on the issue) left the flowers at 32-34 %,
  and 0.45 takes them under 30 %.
- **The shimmer read over what slides under a pixel** (`scripts/ink-lines/lib.mjs` `steadyMask`, `depthOf`;
  `capture.mjs`; `tests/ink-lines.test.js`). From debug 4's depth, a pixel counts when it stands far enough to slide
  under 0.75 px (at least 2/3 of the distance looked at), and so does everything within 3 px of it. That leaves out
  the far side of a near thing's outline too. The whole frame's reading is kept beside it (`shimmerFrame`). No change
  to the renderer: the town's own shimmer passes.

| before → after | desk1080 | handheld | handheld-low | deck | phone |
|---|---|---|---|---|---|
| flowers at 55 m: ink | 40.0 → 26.5 % | 34.3 → 23.3 % | 40.9 → 27.9 % | 41.8 → 28.2 % | 31.5 → 22.1 % |
| flowers at 55 m: near-black | 11.8 → 6.1 % | 4.4 → 2.6 % | 5.2 → 2.8 % | 13.5 → 7.5 % | 4.6 → 2.6 % |
| flowers at 120 m: ink | 40.3 → 29.8 % | 32.2 → 24.7 % | 38.7 → 29.5 % | 38.2 → 28.9 % | 28.6 → 23.0 % |
| plants at 18 m: ink | 26.4 → 23.3 % | 23.8 → 21.3 % | 31.8 → 29.2 % | 29.7 → 26.7 % | 29.0 → 25.9 % |
| plants at 5 m: ink | 6.5 → 6.1 % | 6.5 → 6.2 % | 8.5 → 8.2 % | 7.6 → 7.2 % | 9.9 → 9.5 % |

At 1920 × 1080 at DPR 2 the flowers at 120 m are 30.5 %, the cap's edge (41.1 % before).

| the far town, change / pops a half pixel over | desk1080 | desk1080x2 | handheld | handheld-low | phone |
|---|---|---|---|---|---|
| the whole frame (v1.34's reading) | 0.45 / 13 % | 0.45 / 10 % | 0.47 / 9 % | 0.51 / 7 % | 0.46 / 5 % |
| what slides under a pixel (this run's) | 0.20 / 2 % | 0.17 / 1 % | 0.24 / 2 % | 0.29 / 2 % | 0.25 / 1 % |

Mean score over the 112 pictures 4.63 → 4.72 of 5. The flowers' scenes go from 3.13-3.75 to 4.38 at most
resolutions. Pictures: `changelog-media/1.53/ink-flowers-far` (1080p, cropped ×2) and `ink-flowers-handheld`
(960 × 540, cropped ×3).

**The approved look at play distance, 1080p** (desk1080, the same instant before and after, pixels changed by more than
24 of 255):
- the meadow from 5 m 0.15 % and from 18 m 0.17 %: the far flowers in them;
- the Spheres' canopies 0.78 %, the pack 0.53 %, the town 1.93 % (flags, smoke and the traveller's idle move on the CPU
  between runs);
- the temple hall's two runs differ (35 %): in the before run the traveller hadn't come in and the lamps hadn't woken
  when it was shot. Nothing in the hall uses the far line.

The portraits' scores move by a check either way between the two runs (portrait-10 at 1080p 5.00 → 4.38, portrait-25
3.75 → 5.00): his idle pose differs run to run, and nothing in the change reaches him.

## Cost

One more uniform, a hash and a distance a vertex, on the flowers' materials only. Every other material compiles the
shader it compiled before (`LINE_FAR` is a define). Nothing in the ink pass changed.

## Left

- The City Floating in Space's bridges on small frames (finding 3): 0.36-0.39 change at the Handheld's floor and on a
  phone. A least width for its rails (`makeMaterial({ thin })`, as the Forest of Antennas' masts) is the likely fix.
- The rubric's eye share on faces of 4-10 px is a pixel's rounding, as in v1.34: the darkest-pixel check carries them.

<!-- ink-lines:measured -->
Captured 2026-10-12 on 29b04302: before with src/flora.js and src/materials.js as they were, after with this branch's; 112 pictures, 197 s.

**Mean score** (of 5, every scene at every resolution): 4.63 → **4.72**

### Scores (of 5) by scene and resolution

| scene | desk1080 | desk1080x2 | p720 | handheld | handheld-low | deck | phone |
|---|---|---|---|---|---|---|---|
| portrait-1 | 4.38 → 4.38 | 5.00 → 5.00 | 5.00 → 5.00 | 4.50 → 4.50 | 4.50 → 4.50 | 4.50 → 4.50 | 4.50 → 4.50 |
| portrait-4 | 4.38 → 4.38 | 4.00 → 4.50 | 4.38 → 4.38 | 3.75 → 3.75 | 3.75 → 4.38 | 3.75 → 4.38 | 5.00 → 5.00 |
| portrait-10 | 5.00 → 4.38 | 4.38 → 4.38 | 5.00 → 4.38 | 5.00 → 5.00 | 5.00 → 5.00 | 4.38 → 4.38 | 5.00 → 5.00 |
| portrait-25 | 3.75 → 5.00 | 4.38 → 4.38 | 4.38 → 4.38 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| town-far | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| veg-near | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| veg-mid | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 5.00 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 |
| veg-far | 3.75 → 4.38 | 3.13 → 4.38 | 3.75 → 4.38 | 3.75 → 4.38 | 3.75 → 4.38 | 3.75 → 4.38 | 3.75 → 4.38 |
| veg-farthest | 3.75 → 4.38 | 3.75 → 3.75 | 3.75 → 4.38 | 3.75 → 4.38 | 3.75 → 4.38 | 3.75 → 4.38 | 4.38 → 4.38 |
| canopy-mid | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| canopy-far | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 | 4.38 → 4.38 |
| pack | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| temple-hall | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| uw-avenue | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 |
| mf-floor | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 4.17 → 4.17 | 5.00 → 5.00 | 4.17 → 4.17 |
| sc-bridges | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 4.17 → 4.17 | 5.00 → 5.00 | 4.17 → 4.17 |

### Plants: ink share / near-black share / line width (median, p90 px) / height on screen

| scene | res | ink | dark | width | height px |
|---|---|---|---|---|---|
| veg-near | desk1080 | 6.5 % → 6.1 % | 2.7 % → 2.5 % | 2/6 → 2/6 | 1080 |
| veg-near | desk1080x2 | 6.3 % → 5.9 % | 3.5 % → 3.2 % | 4/10 → 4/9 | 2160 |
| veg-near | p720 | 7.9 % → 7.4 % | 3.2 % → 3.0 % | 2/5 → 2/4 | 720 |
| veg-near | handheld | 6.5 % → 6.2 % | 1.1 % → 1.1 % | 2/6 → 2/6 | 720 |
| veg-near | handheld-low | 8.5 % → 8.2 % | 1.1 % → 1.0 % | 2/6 → 2/5 | 720 |
| veg-near | deck | 7.6 % → 7.2 % | 3.2 % → 3.0 % | 2/5 → 2/5 | 800 |
| veg-near | phone | 9.9 % → 9.5 % | 2.1 % → 2.0 % | 4/11 → 4/10 | 1170 |
| veg-mid | desk1080 | 26.4 % → 23.3 % | 10.3 % → 8.9 % | 2/5 → 2/4 | 374 |
| veg-mid | desk1080x2 | 26.6 % → 23.5 % | 13.8 % → 12.0 % | 4/8 → 4/7 | 747 |
| veg-mid | p720 | 28.1 % → 25.2 % | 9.6 % → 8.9 % | 2/4 → 2/4 | 250 |
| veg-mid | handheld | 23.8 % → 21.3 % | 3.9 % → 3.5 % | 2/5 → 2/4 | 249 |
| veg-mid | handheld-low | 31.8 % → 29.2 % | 4.6 % → 4.3 % | 3/5 → 2/5 | 250 |
| veg-mid | deck | 29.7 % → 26.7 % | 11.1 % → 10.2 % | 2/5 → 2/4 | 275 |
| veg-mid | phone | 29.0 % → 25.9 % | 6.2 % → 5.8 % | 5/11 → 5/10 | 405 |
| veg-far | desk1080 | 40.0 % → 26.5 % | 11.8 % → 6.1 % | 3/7 → 2/5 | 354 |
| veg-far | desk1080x2 | 40.2 % → 26.7 % | 16.8 % → 8.7 % | 4/11 → 4/8 | 708 |
| veg-far | p720 | 37.0 % → 24.5 % | 9.5 % → 4.6 % | 3/7 → 2/4 | 237 |
| veg-far | handheld | 34.3 % → 23.3 % | 4.4 % → 2.6 % | 2/6 → 2/4 | 237 |
| veg-far | handheld-low | 40.9 % → 27.9 % | 5.2 % → 2.8 % | 4/8 → 3/6 | 237 |
| veg-far | deck | 41.8 % → 28.2 % | 13.5 % → 7.5 % | 3/7 → 2/5 | 263 |
| veg-far | phone | 31.5 % → 22.1 % | 4.6 % → 2.6 % | 7/18 → 6/13 | 385 |
| veg-farthest | desk1080 | 40.3 % → 29.8 % | 11.1 % → 4.0 % | 3/7 → 2/5 | 473 |
| veg-farthest | desk1080x2 | 41.1 % → 30.5 % | 15.7 % → 6.6 % | 4/11 → 4/9 | 944 |
| veg-farthest | p720 | 35.9 % → 26.3 % | 8.7 % → 3.4 % | 3/6 → 2/4 | 315 |
| veg-farthest | handheld | 32.2 % → 24.7 % | 3.7 % → 1.4 % | 3/6 → 2/5 | 287 |
| veg-farthest | handheld-low | 38.7 % → 29.5 % | 3.2 % → 1.2 % | 3/8 → 2/6 | 286 |
| veg-farthest | deck | 38.2 % → 28.9 % | 9.2 % → 3.9 % | 3/6 → 2/4 | 349 |
| veg-farthest | phone | 28.6 % → 23.0 % | 3.4 % → 1.9 % | 6/16 → 6/15 | 465 |
| canopy-mid | desk1080 | 8.3 % → 8.3 % | 3.0 % → 3.1 % | 1/3 → 1/3 | 670 |
| canopy-mid | desk1080x2 | 8.3 % → 8.4 % | 4.3 % → 4.3 % | 3/5 → 3/5 | 1339 |
| canopy-mid | p720 | 10.4 % → 10.4 % | 2.4 % → 2.4 % | 1/3 → 1/3 | 447 |
| canopy-mid | handheld | 7.6 % → 7.6 % | 0.4 % → 0.4 % | 1/2 → 1/3 | 447 |
| canopy-mid | handheld-low | 11.1 % → 11.1 % | 0.4 % → 0.4 % | 2/3 → 2/3 | 447 |
| canopy-mid | deck | 11.0 % → 11.0 % | 2.9 % → 2.9 % | 1/3 → 1/3 | 496 |
| canopy-mid | phone | 12.2 % → 12.2 % | 0.6 % → 0.6 % | 4/9 → 4/8 | 727 |
| canopy-far | desk1080 | 20.7 % → 20.7 % | 4.4 % → 4.3 % | 2/5 → 2/4 | 243 |
| canopy-far | desk1080x2 | 20.9 % → 20.9 % | 6.0 % → 6.0 % | 3/8 → 3/7 | 485 |
| canopy-far | p720 | 22.2 % → 22.3 % | 3.9 % → 3.9 % | 2/5 → 2/5 | 161 |
| canopy-far | handheld | 20.3 % → 20.3 % | 2.4 % → 2.4 % | 2/5 → 2/6 | 161 |
| canopy-far | handheld-low | 26.3 % → 26.3 % | 3.1 % → 3.0 % | 2/6 → 2/6 | 163 |
| canopy-far | deck | 24.0 % → 23.9 % | 4.3 % → 4.3 % | 2/6 → 2/5 | 180 |
| canopy-far | phone | 28.0 % → 28.0 % | 2.8 % → 2.8 % | 5/13 → 5/13 | 264 |

### The traveller: face height on screen (brow to chin), the eyes' dark as a share of the face against the 1 m portrait at desk1080 (× ref: 1 keeps its proportion), their density (dark over the opening), the darkest eye pixel against the cheek (0 black), his near-black share

| scene | res | face px | eyes × ref | eye density | darkest | dark share |
|---|---|---|---|---|---|---|
| portrait-1 | desk1080 | 123 | 1.0 → 1.0 | 0.92 → 1.13 | 0.06 → 0.06 | 9.5 % → 11.3 % |
| portrait-1 | desk1080x2 | 242 | 0.6 → 0.7 | 0.59 → 0.69 | 0.07 → 0.06 | 9.3 % → 7.5 % |
| portrait-1 | p720 | 80 | 0.9 → 0.9 | 0.84 → 0.81 | 0.08 → 0.07 | 9.2 % → 9.2 % |
| portrait-1 | handheld | 82 | 1.2 → 1.0 | 1.09 → 0.94 | 0.19 → 0.20 | 8.2 % → 9.1 % |
| portrait-1 | handheld-low | 83 | 1.3 → 1.3 | 1.22 → 1.17 | 0.23 → 0.21 | 9.2 % → 9.0 % |
| portrait-1 | deck | 92 | 1.2 → 1.2 | 1.10 → 1.08 | 0.06 → 0.06 | 9.3 % → 9.0 % |
| portrait-1 | phone | 133 | 1.3 → 1.2 | 1.27 → 1.13 | 0.23 → 0.26 | 9.1 % → 8.9 % |
| portrait-4 | desk1080 | 22 | 2.0 → 1.9 | 1.78 → 1.77 | 0.31 → 0.31 | 4.8 % → 4.8 % |
| portrait-4 | desk1080x2 | 43 | 1.2 → 1.2 | 1.34 → 1.17 | 0.35 → 0.33 | 6.1 % → 4.9 % |
| portrait-4 | p720 | 14 | 2.1 → 1.8 | 1.86 → 1.59 | 0.44 → 0.39 | 5.3 % → 6.5 % |
| portrait-4 | handheld | 14 | 2.6 → 3.0 | 2.39 → 2.75 | 0.47 → 0.42 | 5.1 % → 5.8 % |
| portrait-4 | handheld-low | 14 | 2.5 → 2.4 | 2.31 → 2.12 | 0.51 → 0.47 | 4.0 % → 4.6 % |
| portrait-4 | deck | 16 | 2.5 → 2.5 | 2.29 → 2.25 | 0.37 → 0.33 | 5.0 % → 5.0 % |
| portrait-4 | phone | 23 | 1.4 → 1.5 | 1.32 → 1.37 | 0.49 → 0.51 | 7.7 % → 3.3 % |
| portrait-10 | desk1080 | 9 | 3.1 → 2.8 | 2.81 → 2.56 | 0.50 → 0.39 | 7.4 % → 9.1 % |
| portrait-10 | desk1080x2 | 17 | 2.1 → 1.5 | 1.90 → 1.75 | 0.47 → 0.57 | 13.5 % → 7.5 % |
| portrait-10 | p720 | 6 | 3.0 → 3.3 | 2.01 → 2.16 | 0.46 → 0.35 | 13.7 % → 12.4 % |
| portrait-10 | handheld | 6 | 3.7 → 3.9 | 2.48 → 2.60 | 0.41 → 0.45 | 13.9 % → 13.7 % |
| portrait-10 | handheld-low | 6 | 1.5 → 3.3 | 1.03 → 2.20 | 0.65 → 0.61 | 17.7 % → 10.9 % |
| portrait-10 | deck | 6 | 3.5 → 4.2 | 2.91 → 3.52 | 0.37 → 0.31 | 7.6 % → 7.1 % |
| portrait-10 | phone | 9 | 1.7 → 1.9 | 1.54 → 1.77 | 0.60 → 0.56 | 7.0 % → 9.8 % |
| portrait-25 | desk1080 | 3 | 10.9 → 7.9 | 2.58 → 1.93 | 0.27 → 0.50 | 19.2 % → 7.6 % |
| portrait-25 | desk1080x2 | 7 | 3.0 → 1.7 | 2.73 → 1.55 | 0.46 → 0.61 | 19.0 % → 18.9 % |
| portrait-25 | p720 | 2 | 16.0 → 17.9 | 1.71 → 1.89 | 0.65 → 0.55 | 19.3 % → 18.8 % |
| portrait-25 | handheld | 2 | 5.5 → 6.9 | 0.59 → 0.75 | 0.73 → 0.79 | 15.7 % → 12.7 % |
| portrait-25 | handheld-low | 2 | 21.3 → 11.1 | 2.32 → 1.21 | 0.53 → 0.74 | 1.5 % → 16.0 % |
| portrait-25 | deck | 3 | 15.0 → 9.2 | 2.01 → 1.23 | 0.47 → 0.68 | 11.3 % → 11.0 % |
| portrait-25 | phone | 4 | 1.8 → 0.8 | 0.50 → 0.20 | 0.90 → 0.90 | 2.0 % → 2.2 % |

### The whole frame: ink share, line width (median px), shimmer (change / pops a half pixel over)

| scene | res | frame ink | width | shimmer |
|---|---|---|---|---|
| portrait-1 | desk1080 | 4.1 % → 4.1 % | 2 → 2 | 0.11 → 0.11 / 0.00 → 0.01 |
| portrait-1 | desk1080x2 | 2.1 % → 3.9 % | 4 → 4 | 0.06 → 0.07 / 0.00 → 0.00 |
| portrait-1 | p720 | 4.1 % → 5.7 % | 2 → 2 | 0.11 → 0.09 / 0.00 → 0.00 |
| portrait-1 | handheld | 5.0 % → 4.8 % | 3 → 3 | 0.11 → 0.12 / 0.00 → 0.00 |
| portrait-1 | handheld-low | 6.2 % → 5.8 % | 3 → 3 | 0.11 → 0.12 / 0.00 → 0.00 |
| portrait-1 | deck | 5.5 % → 5.5 % | 2 → 2 | 0.12 → 0.12 / 0.00 → 0.00 |
| portrait-1 | phone | 8.7 % → 8.3 % | 7 → 6 | 0.11 → 0.11 / 0.00 → 0.00 |
| portrait-4 | desk1080 | 4.5 % → 4.5 % | 2 → 2 | 0.14 → 0.14 / 0.02 → 0.02 |
| portrait-4 | desk1080x2 | 4.0 % → 4.7 % | 5 → 4 | 0.11 → 0.11 / 0.00 → 0.00 |
| portrait-4 | p720 | 6.7 % → 6.6 % | 2 → 2 | 0.17 → 0.16 / 0.02 → 0.03 |
| portrait-4 | handheld | 7.7 % → 7.8 % | 3 → 3 | 0.17 → 0.17 / 0.01 → 0.01 |
| portrait-4 | handheld-low | 7.9 % → 7.7 % | 4 → 4 | 0.18 → 0.19 / 0.00 → 0.00 |
| portrait-4 | deck | 6.0 % → 6.0 % | 2 → 2 | 0.14 → 0.14 / 0.02 → 0.02 |
| portrait-4 | phone | 9.1 % → 8.2 % | 8 → 8 | 0.16 → 0.14 / 0.00 → 0.00 |
| portrait-10 | desk1080 | 3.4 % → 3.4 % | 2 → 2 | 0.15 → 0.14 / 0.02 → 0.02 |
| portrait-10 | desk1080x2 | 3.0 % → 3.3 % | 4 → 5 | 0.12 → 0.12 / 0.00 → 0.00 |
| portrait-10 | p720 | 5.0 % → 4.9 % | 2 → 2 | 0.15 → 0.15 / 0.01 → 0.01 |
| portrait-10 | handheld | 5.6 % → 5.5 % | 4 → 3 | 0.16 → 0.16 / 0.01 → 0.01 |
| portrait-10 | handheld-low | 5.0 % → 5.3 % | 4 → 4 | 0.17 → 0.19 / 0.00 → 0.00 |
| portrait-10 | deck | 4.7 % → 4.7 % | 2 → 2 | 0.14 → 0.14 / 0.01 → 0.01 |
| portrait-10 | phone | 5.5 % → 5.6 % | 7 → 7 | 0.17 → 0.16 / 0.00 → 0.00 |
| portrait-25 | desk1080 | 2.5 % → 2.0 % | 2 → 3 | 0.14 → 0.12 / 0.01 → 0.01 |
| portrait-25 | desk1080x2 | 1.8 % → 1.8 % | 6 → 6 | 0.09 → 0.09 / 0.00 → 0.00 |
| portrait-25 | p720 | 2.8 % → 2.9 % | 2 → 2 | 0.13 → 0.13 / 0.01 → 0.01 |
| portrait-25 | handheld | 3.1 % → 3.2 % | 3 → 3 | 0.15 → 0.15 / 0.00 → 0.00 |
| portrait-25 | handheld-low | 2.6 % → 2.6 % | 3 → 3 | 0.17 → 0.16 / 0.00 → 0.00 |
| portrait-25 | deck | 2.4 % → 2.5 % | 3 → 3 | 0.14 → 0.13 / 0.01 → 0.01 |
| portrait-25 | phone | 3.5 % → 3.5 % | 7 → 7 | 0.15 → 0.12 / 0.00 → 0.00 |
| town-far | desk1080 | 2.6 % → 2.6 % | 2 → 2 | 0.19 → 0.20 / 0.02 → 0.02 |
| town-far | desk1080x2 | 2.2 % → 2.3 % | 4 → 4 | 0.17 → 0.17 / 0.01 → 0.01 |
| town-far | p720 | 3.5 % → 3.5 % | 2 → 2 | 0.21 → 0.20 / 0.01 → 0.01 |
| town-far | handheld | 4.0 % → 4.0 % | 3 → 3 | 0.24 → 0.24 / 0.01 → 0.01 |
| town-far | handheld-low | 3.8 % → 3.8 % | 4 → 4 | 0.28 → 0.29 / 0.01 → 0.01 |
| town-far | deck | 3.3 % → 3.3 % | 2 → 2 | 0.21 → 0.21 / 0.02 → 0.02 |
| town-far | phone | 4.1 % → 4.2 % | 7 → 7 | 0.26 → 0.25 / 0.01 → 0.01 |
| veg-near | desk1080 | 3.2 % → 3.2 % | 2 → 2 | 0.07 → 0.07 / 0.00 → 0.00 |
| veg-near | desk1080x2 | 3.7 % → 3.6 % | 4 → 4 | 0.09 → 0.09 / 0.00 → 0.00 |
| veg-near | p720 | 3.9 % → 3.9 % | 2 → 2 | 0.08 → 0.08 / 0.00 → 0.00 |
| veg-near | handheld | 3.5 % → 3.4 % | 2 → 2 | 0.07 → 0.07 / 0.00 → 0.00 |
| veg-near | handheld-low | 4.5 % → 4.4 % | 2 → 2 | 0.08 → 0.08 / 0.00 → 0.00 |
| veg-near | deck | 3.6 % → 3.5 % | 2 → 2 | 0.06 → 0.07 / 0.00 → 0.00 |
| veg-near | phone | 5.1 % → 5.0 % | 4 → 4 | 0.08 → 0.08 / 0.00 → 0.00 |
| veg-mid | desk1080 | 2.8 % → 2.7 % | 2 → 2 | 0.04 → 0.04 / 0.00 → 0.00 |
| veg-mid | desk1080x2 | 3.2 % → 3.1 % | 4 → 4 | 0.07 → 0.07 / 0.00 → 0.00 |
| veg-mid | p720 | 3.5 % → 3.4 % | 2 → 2 | 0.05 → 0.05 / 0.00 → 0.00 |
| veg-mid | handheld | 3.1 % → 3.0 % | 2 → 2 | 0.06 → 0.06 / 0.00 → 0.00 |
| veg-mid | handheld-low | 3.9 % → 3.9 % | 2 → 2 | 0.06 → 0.05 / 0.00 → 0.00 |
| veg-mid | deck | 3.1 % → 3.0 % | 2 → 2 | 0.04 → 0.04 / 0.00 → 0.00 |
| veg-mid | phone | 4.6 % → 4.5 % | 4 → 4 | 0.06 → 0.05 / 0.00 → 0.00 |
| veg-far | desk1080 | 2.7 % → 2.6 % | 2 → 2 | 0.07 → 0.07 / 0.00 → 0.00 |
| veg-far | desk1080x2 | 3.0 % → 2.9 % | 4 → 4 | 0.08 → 0.07 / 0.01 → 0.01 |
| veg-far | p720 | 3.4 % → 3.2 % | 2 → 2 | 0.09 → 0.09 / 0.00 → 0.00 |
| veg-far | handheld | 3.1 % → 3.1 % | 2 → 2 | 0.11 → 0.11 / 0.00 → 0.00 |
| veg-far | handheld-low | 3.9 % → 3.8 % | 2 → 2 | 0.10 → 0.10 / 0.00 → 0.01 |
| veg-far | deck | 3.0 % → 2.9 % | 2 → 2 | 0.08 → 0.08 / 0.00 → 0.00 |
| veg-far | phone | 4.5 % → 4.4 % | 4 → 4 | 0.10 → 0.10 / 0.00 → 0.00 |
| veg-farthest | desk1080 | 3.7 % → 3.6 % | 2 → 2 | 0.08 → 0.08 / 0.00 → 0.00 |
| veg-farthest | desk1080x2 | 4.0 % → 3.9 % | 4 → 4 | 0.09 → 0.08 / 0.01 → 0.01 |
| veg-farthest | p720 | 4.6 % → 4.4 % | 2 → 2 | 0.09 → 0.09 / 0.00 → 0.00 |
| veg-farthest | handheld | 4.3 % → 4.2 % | 2 → 2 | 0.11 → 0.11 / 0.00 → 0.00 |
| veg-farthest | handheld-low | 5.4 % → 5.3 % | 2 → 2 | 0.11 → 0.11 / 0.00 → 0.00 |
| veg-farthest | deck | 4.5 % → 4.4 % | 2 → 2 | 0.09 → 0.09 / 0.00 → 0.00 |
| veg-farthest | phone | 6.2 % → 6.1 % | 4 → 4 | 0.12 → 0.12 / 0.01 → 0.01 |
| canopy-mid | desk1080 | 1.7 % → 1.6 % | 2 → 2 | 0.12 → 0.12 / 0.00 → 0.00 |
| canopy-mid | desk1080x2 | 1.6 % → 1.7 % | 4 → 4 | 0.13 → 0.13 / 0.00 → 0.00 |
| canopy-mid | p720 | 2.1 % → 2.1 % | 2 → 2 | 0.14 → 0.14 / 0.00 → 0.00 |
| canopy-mid | handheld | 1.6 % → 1.6 % | 1 → 1 | 0.20 → 0.20 / 0.00 → 0.00 |
| canopy-mid | handheld-low | 2.3 % → 2.3 % | 2 → 2 | 0.20 → 0.21 / 0.00 → 0.01 |
| canopy-mid | deck | 2.3 % → 2.3 % | 2 → 2 | 0.13 → 0.13 / 0.00 → 0.00 |
| canopy-mid | phone | 2.4 % → 2.4 % | 4 → 4 | 0.21 → 0.21 / 0.00 → 0.00 |
| canopy-far | desk1080 | 1.3 % → 1.3 % | 2 → 2 | 0.14 → 0.14 / 0.00 → 0.00 |
| canopy-far | desk1080x2 | 1.3 % → 1.3 % | 4 → 4 | 0.15 → 0.15 / 0.01 → 0.01 |
| canopy-far | p720 | 1.5 % → 1.5 % | 2 → 2 | 0.16 → 0.15 / 0.00 → 0.00 |
| canopy-far | handheld | 1.3 % → 1.3 % | 2 → 2 | 0.20 → 0.20 / 0.01 → 0.00 |
| canopy-far | handheld-low | 1.8 % → 1.8 % | 2 → 2 | 0.21 → 0.21 / 0.01 → 0.01 |
| canopy-far | deck | 1.7 % → 1.7 % | 2 → 2 | 0.14 → 0.14 / 0.00 → 0.00 |
| canopy-far | phone | 1.8 % → 1.9 % | 4 → 4 | 0.21 → 0.21 / 0.00 → 0.00 |
| pack | desk1080 | 2.2 % → 2.2 % | 2 → 2 | 0.05 → 0.05 / 0.00 → 0.00 |
| pack | desk1080x2 | 2.2 % → 2.2 % | 4 → 4 | 0.05 → 0.06 / 0.01 → 0.01 |
| pack | p720 | 2.5 % → 2.5 % | 2 → 2 | 0.05 → 0.05 / 0.00 → 0.00 |
| pack | handheld | 2.4 % → 2.4 % | 2 → 2 | 0.07 → 0.07 / 0.00 → 0.00 |
| pack | handheld-low | 3.5 % → 3.5 % | 2 → 2 | 0.08 → 0.08 / 0.00 → 0.00 |
| pack | deck | 2.8 % → 2.8 % | 2 → 2 | 0.06 → 0.06 / 0.00 → 0.00 |
| pack | phone | 3.7 % → 3.7 % | 4 → 4 | 0.07 → 0.07 / 0.00 → 0.00 |
| temple-hall | desk1080 | 1.5 % → 2.0 % | 2 → 2 | 0.10 → 0.09 / 0.00 → 0.00 |
| temple-hall | desk1080x2 | 2.0 % → 2.0 % | 4 → 4 | 0.10 → 0.10 / 0.01 → 0.01 |
| temple-hall | p720 | 2.4 % → 2.3 % | 2 → 2 | 0.11 → 0.11 / 0.00 → 0.00 |
| temple-hall | handheld | 2.4 % → 2.4 % | 2 → 2 | 0.14 → 0.14 / 0.00 → 0.00 |
| temple-hall | handheld-low | 3.2 % → 3.2 % | 2 → 2 | 0.14 → 0.14 / 0.01 → 0.01 |
| temple-hall | deck | 2.5 % → 2.5 % | 2 → 2 | 0.11 → 0.11 / 0.00 → 0.00 |
| temple-hall | phone | 3.4 % → 3.4 % | 4 → 4 | 0.16 → 0.16 / 0.01 → 0.01 |
| uw-avenue | desk1080 | 4.8 % → 4.9 % | 2 → 1 | 0.04 → 0.05 / 0.00 → 0.00 |
| uw-avenue | desk1080x2 | 4.9 % → 4.9 % | 3 → 3 | 0.05 → 0.05 / 0.00 → 0.00 |
| uw-avenue | p720 | 5.3 % → 5.3 % | 1 → 1 | 0.05 → 0.05 / 0.00 → 0.00 |
| uw-avenue | handheld | 5.1 % → 5.2 % | 1 → 1 | 0.06 → 0.06 / 0.00 → 0.00 |
| uw-avenue | handheld-low | 5.9 % → 5.9 % | 2 → 2 | 0.09 → 0.08 / 0.00 → 0.00 |
| uw-avenue | deck | 5.2 % → 5.4 % | 1 → 1 | 0.05 → 0.05 / 0.00 → 0.00 |
| uw-avenue | phone | 6.9 % → 6.9 % | 4 → 4 | 0.07 → 0.06 / 0.00 → 0.00 |
| mf-floor | desk1080 | 6.7 % → 6.7 % | 2 → 2 | 0.16 → 0.16 / 0.00 → 0.00 |
| mf-floor | desk1080x2 | 6.6 % → 6.6 % | 3 → 3 | 0.19 → 0.19 / 0.00 → 0.00 |
| mf-floor | p720 | 7.5 % → 7.5 % | 2 → 2 | 0.18 → 0.18 / 0.00 → 0.00 |
| mf-floor | handheld | 8.4 % → 8.4 % | 2 → 2 | 0.19 → 0.19 / 0.00 → 0.00 |
| mf-floor | handheld-low | 10.2 % → 10.2 % | 2 → 2 | 0.22 → 0.22 / 0.00 → 0.00 |
| mf-floor | deck | 7.7 % → 7.7 % | 2 → 2 | 0.17 → 0.17 / 0.00 → 0.00 |
| mf-floor | phone | 10.3 % → 10.2 % | 4 → 4 | 0.21 → 0.21 / 0.00 → 0.00 |
| sc-bridges | desk1080 | 5.5 % → 5.3 % | 2 → 2 | 0.19 → 0.20 / 0.01 → 0.01 |
| sc-bridges | desk1080x2 | 5.5 % → 5.5 % | 4 → 4 | 0.22 → 0.22 / 0.04 → 0.04 |
| sc-bridges | p720 | 6.2 % → 6.2 % | 2 → 2 | 0.25 → 0.24 / 0.01 → 0.01 |
| sc-bridges | handheld | 6.0 % → 6.0 % | 2 → 2 | 0.32 → 0.32 / 0.01 → 0.01 |
| sc-bridges | handheld-low | 7.3 % → 7.3 % | 2 → 2 | 0.36 → 0.36 / 0.05 → 0.05 |
| sc-bridges | deck | 6.2 % → 6.2 % | 2 → 2 | 0.23 → 0.23 / 0.01 → 0.01 |
| sc-bridges | phone | 7.9 % → 7.9 % | 5 → 5 | 0.39 → 0.39 / 0.04 → 0.04 |

### The worst pictures (failing and borderline checks)

- portrait-4 @ handheld: 3.75 — eyeGrowth 3.014 ✗
- veg-farthest @ desk1080x2: 3.75 — inkShare 0.305 ✗
- mf-floor @ handheld-low: 4.17 — frameInk 0.102 ~
- mf-floor @ phone: 4.17 — frameInk 0.102 ~
- sc-bridges @ handheld-low: 4.17 — shimmer 0.358 ~
- sc-bridges @ phone: 4.17 — shimmer 0.388 ~
- portrait-1 @ desk1080: 4.38 — eyeDensity 1.135 ~
- portrait-4 @ desk1080: 4.38 — eyeGrowth 1.946 ~
- portrait-10 @ desk1080: 4.38 — eyeBlack 0.613 ~
- portrait-10 @ desk1080x2: 4.38 — eyeGrowth 1.515 ~
- portrait-25 @ desk1080x2: 4.38 — darkShare 0.189 ~
- portrait-4 @ p720: 4.38 — eyeGrowth 1.769 ~
<!-- /ink-lines:measured -->
