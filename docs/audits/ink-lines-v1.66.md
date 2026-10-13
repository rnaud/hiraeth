# Ink lines at every distance and resolution, v1.66 (2026-10-13)

<!-- audit-scores
overall: 4.70 / 5
label: the mean of 112 pictures (16 scenes at 7 resolutions; 4.72 at v1.53)
date: 2026-10-13
-->

The ink-lines audit (`.claude/skills/ink-lines/SKILL.md`) on main at v1.66 for issue #226, the matrix of v1.53: 16 scenes
at 7 resolutions, 112 pictures, the same instant every run.
- main `0949c08a` (v1.66) with this branch's audit commits (`050ec0bc`: no change to the ink pass, the materials or the
  face ink); Mac M4 Pro, headless Chrome on the GPU (ANGLE Metal), muted, its own Vite (port 6001); a shared machine at
  load 45-70 (the pictures don't depend on it).
- No fix to the lines here, so no before/after capture and no cost run.

## Findings, worst first

1. **The capture couldn't see the traveller's face any more** (the tool; every portrait, every resolution). It looked for
   the head mesh `TravellerTripoHeadV2` and head-v2's fit; the traveller has worn the portrait head
   (`TravellerPortraitHead`, src/characters/portrait-head.js `PORTRAIT_HEAD`) since the face was inked from his approved
   portrait, so the 28 portrait pictures threw on a missing skeleton. **Fixed** in `capture.mjs`: the portrait head's
   name, its scale and offset, its own two eye positions (the portrait is not quite symmetric) and brow and chin for the
   face's height, and a wait for his drawn head before a world's scenes (it loads after the boot). The portraits were
   then captured again on their own (`--scenes portrait-1,portrait-4,portrait-10,portrait-25`) and merged into the
   matrix. Their numbers measure a different head from v1.53's: compare them with care.
2. **His eyes from 10 m are dark dots** (`portrait-10`; desk1080 3.75, deck and phone 3.75). The eyes' dark share of the
   face is ×4.4 the 1 m portrait's at 1080p (limit ×2.5), ×5.0 at 720p; the darkest eye pixel 0.14 of the cheek. On a
   12 px face the two marks read as dots rather than the drawn eye
   ([crop ×8](ink-lines-v1.66/portrait-10-face-x8.webp)). v1.53 (head-v2's face) had portrait-10 at 4.38-5.00. Likely
   the portrait head's face ink isn't faded by size as `HEAD_INK_FAR` faded head-v2's (faces.md "From afar"). #302.
3. **The far plants' scenes changed subject** (`veg-far`, `veg-farthest`: 4.38 → 3.75 at five resolutions). The scene
   takes the tallest plant under 6 m within 200 m of Viridel's start; since Viridel's explorations that is another
   plant, 439 px tall at 1080p (v1.53's: 354), and its ink share is 31-35 % against the far cap of 30 %
   ([the view](ink-lines-v1.66/veg-far-desk1080.webp)). The flowers in the view look as v1.53 left them; the drop is the
   new subject's, not a heavier line. Pin the plant: #302.
4. **The Moon Foundry's floor and the City Floating in Space's bridges** at the Handheld's floor and on a phone: 4.17 →
   5.00 (v1.53's borderline shimmer, 0.36-0.39, now 0.25-0.31).
5. **The far town at the Handheld's floor and on a phone**: 5.00 → 4.17 (`town-far`, a borderline check). Everything
   else as v1.53: the canopies, the pack, the temple hall, the three new worlds' views at 5.00.

## What is left

#302: the portrait head's eyes from afar, the plant scenes pinned. The far flowers (v1.53's fix) stand as they were on
v1.53's plant; this run can't say more until the scene is pinned.

## The measures

<!-- ink-lines:measured -->
Captured 2026-10-13 at 050ec0bc; 112 pictures (the 28 portraits captured again after the fix), 280 s + 75 s.

**Mean score** (of 5, every scene at every resolution): **4.70**

### Scores (of 5) by scene and resolution

| scene | desk1080 | desk1080x2 | p720 | handheld | handheld-low | deck | phone |
|---|---|---|---|---|---|---|---|
| town-far | 5.00 | 5.00 | 5.00 | 5.00 | 4.17 | 5.00 | 4.17 |
| veg-near | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| veg-mid | 4.38 | 4.38 | 4.38 | 4.38 | 4.38 | 4.38 | 4.38 |
| veg-far | 3.75 | 3.75 | 3.75 | 4.38 | 3.75 | 3.75 | 4.38 |
| veg-farthest | 3.75 | 3.75 | 3.75 | 4.38 | 3.75 | 3.75 | 4.38 |
| canopy-mid | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| canopy-far | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| pack | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| temple-hall | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| uw-avenue | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| mf-floor | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| sc-bridges | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| portrait-1 | 5.00 | 5.00 | 5.00 | 5.00 | 4.50 | 5.00 | 5.00 |
| portrait-4 | 5.00 | 5.00 | 4.38 | 4.38 | 3.75 | 4.38 | 4.38 |
| portrait-10 | 3.75 | 4.38 | 4.38 | 4.38 | 5.00 | 3.75 | 3.75 |
| portrait-25 | 4.38 | 4.38 | 4.38 | 5.00 | 5.00 | 4.38 | 5.00 |

### Plants: ink share / near-black share / line width (median, p90 px) / height on screen

| scene | res | ink | dark | width | height px |
|---|---|---|---|---|---|
| veg-near | desk1080 | 11.3 % | 4.6 % | 2/5 | 1080 |
| veg-near | desk1080x2 | 11.0 % | 5.8 % | 4/8 | 2160 |
| veg-near | p720 | 13.8 % | 5.3 % | 2/5 | 720 |
| veg-near | handheld | 12.2 % | 1.2 % | 2/4 | 720 |
| veg-near | handheld-low | 16.1 % | 2.2 % | 2/5 | 720 |
| veg-near | deck | 14.8 % | 6.1 % | 2/5 | 800 |
| veg-near | phone | 14.8 % | 2.1 % | 5/11 | 1170 |
| veg-mid | desk1080 | 24.1 % | 9.0 % | 3/6 | 607 |
| veg-mid | desk1080x2 | 24.0 % | 11.9 % | 4/10 | 1210 |
| veg-mid | p720 | 25.9 % | 9.0 % | 2/5 | 405 |
| veg-mid | handheld | 24.5 % | 2.9 % | 2/5 | 404 |
| veg-mid | handheld-low | 30.6 % | 5.2 % | 3/6 | 404 |
| veg-mid | deck | 27.3 % | 10.2 % | 3/6 | 450 |
| veg-mid | phone | 27.5 % | 4.2 % | 5/12 | 659 |
| veg-far | desk1080 | 32.3 % | 10.3 % | 2/6 | 439 |
| veg-far | desk1080x2 | 32.2 % | 14.0 % | 4/10 | 879 |
| veg-far | p720 | 31.8 % | 9.1 % | 2/7 | 293 |
| veg-far | handheld | 28.9 % | 2.8 % | 2/5 | 293 |
| veg-far | handheld-low | 33.4 % | 4.7 % | 3/7 | 293 |
| veg-far | deck | 34.8 % | 11.2 % | 3/7 | 326 |
| veg-far | phone | 26.4 % | 2.5 % | 6/14 | 477 |
| veg-farthest | desk1080 | 31.6 % | 9.0 % | 2/6 | 709 |
| veg-farthest | desk1080x2 | 31.2 % | 12.2 % | 4/10 | 1417 |
| veg-farthest | p720 | 31.1 % | 8.1 % | 2/6 | 473 |
| veg-farthest | handheld | 29.4 % | 2.4 % | 2/6 | 445 |
| veg-farthest | handheld-low | 34.5 % | 3.1 % | 3/6 | 445 |
| veg-farthest | deck | 33.0 % | 8.5 % | 2/6 | 525 |
| veg-farthest | phone | 27.1 % | 2.2 % | 5/12 | 723 |
| canopy-mid | desk1080 | 6.8 % | 2.7 % | 2/3 | 904 |
| canopy-mid | desk1080x2 | 6.8 % | 3.9 % | 3/6 | 1810 |
| canopy-mid | p720 | 7.7 % | 3.0 % | 1/3 | 603 |
| canopy-mid | handheld | 6.6 % | 1.9 % | 1/2 | 607 |
| canopy-mid | handheld-low | 7.9 % | 1.0 % | 2/3 | 611 |
| canopy-mid | deck | 9.7 % | 2.9 % | 2/3 | 670 |
| canopy-mid | phone | 7.7 % | 2.9 % | 4/6 | 1001 |
| canopy-far | desk1080 | 8.1 % | 2.7 % | 2/4 | 434 |
| canopy-far | desk1080x2 | 8.1 % | 4.0 % | 4/6 | 868 |
| canopy-far | p720 | 9.1 % | 2.0 % | 2/3 | 289 |
| canopy-far | handheld | 8.1 % | 0.7 % | 1/3 | 290 |
| canopy-far | handheld-low | 9.5 % | 0.7 % | 2/4 | 289 |
| canopy-far | deck | 10.6 % | 3.0 % | 2/4 | 321 |
| canopy-far | phone | 11.7 % | 1.3 % | 4/8 | 478 |

### The traveller: face height on screen (brow to chin), the eyes' dark as a share of the face against the 1 m portrait at desk1080 (× ref: 1 keeps its proportion), their density (dark over the opening), the darkest eye pixel against the cheek (0 black), his near-black share

| scene | res | face px | eyes × ref | eye density | darkest | dark share |
|---|---|---|---|---|---|---|
| portrait-1 | desk1080 | 178 | 1.0 | 0.77 | 0.01 | 9.1 % |
| portrait-1 | desk1080x2 | 362 | 1.2 | 0.88 | 0.00 | 7.9 % |
| portrait-1 | p720 | 115 | 1.0 | 0.78 | 0.01 | 8.6 % |
| portrait-1 | handheld | 117 | 0.8 | 0.65 | 0.09 | 8.1 % |
| portrait-1 | handheld-low | 122 | 1.4 | 0.91 | 0.08 | 7.5 % |
| portrait-1 | deck | 132 | 1.3 | 0.86 | 0.01 | 7.4 % |
| portrait-1 | phone | 194 | 0.9 | 0.68 | 0.17 | 9.0 % |
| portrait-4 | desk1080 | 31 | 1.4 | 1.07 | 0.36 | 4.1 % |
| portrait-4 | desk1080x2 | 62 | 1.1 | 0.88 | 0.24 | 2.9 % |
| portrait-4 | p720 | 20 | 1.8 | 1.60 | 0.21 | 2.8 % |
| portrait-4 | handheld | 21 | 2.0 | 1.63 | 0.28 | 3.1 % |
| portrait-4 | handheld-low | 21 | 3.0 | 1.97 | 0.30 | 3.2 % |
| portrait-4 | deck | 23 | 2.1 | 1.50 | 0.13 | 3.4 % |
| portrait-4 | phone | 33 | 1.6 | 1.24 | 0.49 | 3.8 % |
| portrait-10 | desk1080 | 12 | 4.4 | 3.37 | 0.14 | 7.4 % |
| portrait-10 | desk1080x2 | 25 | 1.6 | 1.20 | 0.51 | 3.0 % |
| portrait-10 | p720 | 8 | 9.4 | 4.53 | 0.23 | 5.8 % |
| portrait-10 | handheld | 8 | 5.9 | 2.87 | 0.26 | 6.8 % |
| portrait-10 | handheld-low | 8 | 5.8 | 2.96 | 0.41 | 2.0 % |
| portrait-10 | deck | 9 | 8.0 | 4.98 | 0.17 | 8.3 % |
| portrait-10 | phone | 13 | 3.4 | 2.59 | 0.41 | 5.0 % |
| portrait-25 | desk1080 | 5 | 12.6 | 2.26 | 0.23 | 8.0 % |
| portrait-25 | desk1080x2 | 10 | 4.8 | 3.25 | 0.38 | 8.5 % |
| portrait-25 | p720 | 3 | 40.1 | 3.05 | 0.30 | 7.9 % |
| portrait-25 | handheld | 3 | 18.4 | 1.48 | 0.57 | 1.6 % |
| portrait-25 | handheld-low | 3 | 14.0 | 1.12 | 0.70 | 1.5 % |
| portrait-25 | deck | 4 | 38.4 | 3.81 | 0.29 | 7.4 % |
| portrait-25 | phone | 5 | 2.4 | 0.51 | 0.77 | 3.1 % |

### The whole frame: ink share, line width (median px), shimmer (change / pops a half pixel over)

| scene | res | frame ink | width | shimmer |
|---|---|---|---|---|
| town-far | desk1080 | 1.7 % | 2 | 0.30 / 0.02 |
| town-far | desk1080x2 | 1.7 % | 4 | 0.25 / 0.02 |
| town-far | p720 | 2.3 % | 2 | 0.31 / 0.02 |
| town-far | handheld | 2.8 % | 3 | 0.35 / 0.03 |
| town-far | handheld-low | 2.7 % | 4 | 0.47 / 0.04 |
| town-far | deck | 2.2 % | 2 | 0.32 / 0.02 |
| town-far | phone | 2.8 % | 8 | 0.43 / 0.04 |
| veg-near | desk1080 | 4.0 % | 2 | 0.08 / 0.00 |
| veg-near | desk1080x2 | 4.3 % | 4 | 0.10 / 0.00 |
| veg-near | p720 | 5.0 % | 2 | 0.10 / 0.00 |
| veg-near | handheld | 4.2 % | 2 | 0.11 / 0.00 |
| veg-near | handheld-low | 4.9 % | 2 | 0.13 / 0.00 |
| veg-near | deck | 4.7 % | 2 | 0.08 / 0.00 |
| veg-near | phone | 6.0 % | 5 | 0.12 / 0.00 |
| veg-mid | desk1080 | 3.7 % | 2 | 0.06 / 0.00 |
| veg-mid | desk1080x2 | 4.1 % | 4 | 0.09 / 0.00 |
| veg-mid | p720 | 4.4 % | 2 | 0.08 / 0.00 |
| veg-mid | handheld | 4.0 % | 2 | 0.09 / 0.00 |
| veg-mid | handheld-low | 4.9 % | 2 | 0.10 / 0.00 |
| veg-mid | deck | 4.2 % | 2 | 0.07 / 0.00 |
| veg-mid | phone | 5.4 % | 5 | 0.10 / 0.00 |
| veg-far | desk1080 | 3.2 % | 2 | 0.07 / 0.00 |
| veg-far | desk1080x2 | 3.5 % | 4 | 0.08 / 0.01 |
| veg-far | p720 | 3.7 % | 2 | 0.10 / 0.00 |
| veg-far | handheld | 3.3 % | 2 | 0.12 / 0.00 |
| veg-far | handheld-low | 3.8 % | 2 | 0.12 / 0.00 |
| veg-far | deck | 3.6 % | 2 | 0.08 / 0.00 |
| veg-far | phone | 4.0 % | 4 | 0.11 / 0.00 |
| veg-farthest | desk1080 | 3.9 % | 2 | 0.11 / 0.00 |
| veg-farthest | desk1080x2 | 4.2 % | 4 | 0.11 / 0.01 |
| veg-farthest | p720 | 4.4 % | 2 | 0.14 / 0.00 |
| veg-farthest | handheld | 3.9 % | 2 | 0.14 / 0.00 |
| veg-farthest | handheld-low | 4.5 % | 2 | 0.13 / 0.00 |
| veg-farthest | deck | 3.9 % | 2 | 0.11 / 0.00 |
| veg-farthest | phone | 5.0 % | 5 | 0.12 / 0.01 |
| canopy-mid | desk1080 | 3.1 % | 2 | 0.07 / 0.00 |
| canopy-mid | desk1080x2 | 3.1 % | 4 | 0.08 / 0.00 |
| canopy-mid | p720 | 3.6 % | 2 | 0.08 / 0.00 |
| canopy-mid | handheld | 3.4 % | 2 | 0.11 / 0.00 |
| canopy-mid | handheld-low | 4.0 % | 2 | 0.13 / 0.00 |
| canopy-mid | deck | 3.7 % | 2 | 0.07 / 0.00 |
| canopy-mid | phone | 4.2 % | 4 | 0.13 / 0.00 |
| canopy-far | desk1080 | 3.9 % | 2 | 0.09 / 0.00 |
| canopy-far | desk1080x2 | 4.1 % | 4 | 0.09 / 0.01 |
| canopy-far | p720 | 4.6 % | 2 | 0.10 / 0.00 |
| canopy-far | handheld | 3.8 % | 2 | 0.14 / 0.01 |
| canopy-far | handheld-low | 4.6 % | 2 | 0.15 / 0.01 |
| canopy-far | deck | 4.2 % | 2 | 0.09 / 0.00 |
| canopy-far | phone | 5.4 % | 5 | 0.13 / 0.01 |
| pack | desk1080 | 2.1 % | 2 | 0.05 / 0.00 |
| pack | desk1080x2 | 2.2 % | 4 | 0.06 / 0.01 |
| pack | p720 | 2.4 % | 2 | 0.06 / 0.00 |
| pack | handheld | 2.6 % | 2 | 0.07 / 0.00 |
| pack | handheld-low | 3.8 % | 2 | 0.08 / 0.00 |
| pack | deck | 2.7 % | 2 | 0.06 / 0.00 |
| pack | phone | 4.1 % | 4 | 0.07 / 0.00 |
| temple-hall | desk1080 | 2.0 % | 2 | 0.09 / 0.00 |
| temple-hall | desk1080x2 | 2.0 % | 4 | 0.10 / 0.01 |
| temple-hall | p720 | 2.3 % | 2 | 0.11 / 0.00 |
| temple-hall | handheld | 2.7 % | 2 | 0.13 / 0.00 |
| temple-hall | handheld-low | 3.5 % | 2 | 0.14 / 0.01 |
| temple-hall | deck | 2.5 % | 2 | 0.11 / 0.00 |
| temple-hall | phone | 3.7 % | 4 | 0.15 / 0.00 |
| uw-avenue | desk1080 | 4.8 % | 2 | 0.04 / 0.00 |
| uw-avenue | desk1080x2 | 4.9 % | 3 | 0.06 / 0.00 |
| uw-avenue | p720 | 5.3 % | 1 | 0.06 / 0.00 |
| uw-avenue | handheld | 5.2 % | 1 | 0.06 / 0.00 |
| uw-avenue | handheld-low | 5.9 % | 2 | 0.07 / 0.00 |
| uw-avenue | deck | 5.2 % | 1 | 0.05 / 0.00 |
| uw-avenue | phone | 6.8 % | 4 | 0.05 / 0.00 |
| mf-floor | desk1080 | 6.7 % | 2 | 0.17 / 0.00 |
| mf-floor | desk1080x2 | 6.7 % | 3 | 0.20 / 0.00 |
| mf-floor | p720 | 6.1 % | 2 | 0.20 / 0.00 |
| mf-floor | handheld | 6.1 % | 2 | 0.20 / 0.00 |
| mf-floor | handheld-low | 6.3 % | 3 | 0.22 / 0.00 |
| mf-floor | deck | 6.6 % | 2 | 0.19 / 0.00 |
| mf-floor | phone | 6.6 % | 6 | 0.22 / 0.00 |
| sc-bridges | desk1080 | 5.1 % | 2 | 0.20 / 0.01 |
| sc-bridges | desk1080x2 | 5.1 % | 4 | 0.22 / 0.01 |
| sc-bridges | p720 | 5.4 % | 2 | 0.25 / 0.00 |
| sc-bridges | handheld | 5.3 % | 2 | 0.27 / 0.00 |
| sc-bridges | handheld-low | 6.0 % | 2 | 0.28 / 0.01 |
| sc-bridges | deck | 5.5 % | 2 | 0.25 / 0.00 |
| sc-bridges | phone | 6.3 % | 5 | 0.31 / 0.01 |
| portrait-1 | desk1080 | 4.2 % | 2 | 0.08 / 0.00 |
| portrait-1 | desk1080x2 | 4.3 % | 4 | 0.04 / 0.00 |
| portrait-1 | p720 | 7.7 % | 2 | 0.07 / 0.00 |
| portrait-1 | handheld | 3.8 % | 3 | 0.10 / 0.00 |
| portrait-1 | handheld-low | 5.9 % | 3 | 0.09 / 0.00 |
| portrait-1 | deck | 3.2 % | 2 | 0.11 / 0.00 |
| portrait-1 | phone | 8.3 % | 8 | 0.07 / 0.00 |
| portrait-4 | desk1080 | 4.0 % | 2 | 0.10 / 0.01 |
| portrait-4 | desk1080x2 | 2.9 % | 4 | 0.09 / 0.00 |
| portrait-4 | p720 | 6.1 % | 2 | 0.12 / 0.01 |
| portrait-4 | handheld | 7.6 % | 3 | 0.11 / 0.00 |
| portrait-4 | handheld-low | 7.3 % | 4 | 0.13 / 0.00 |
| portrait-4 | deck | 6.2 % | 2 | 0.10 / 0.01 |
| portrait-4 | phone | 6.9 % | 8 | 0.10 / 0.00 |
| portrait-10 | desk1080 | 2.9 % | 2 | 0.11 / 0.01 |
| portrait-10 | desk1080x2 | 2.9 % | 5 | 0.10 / 0.00 |
| portrait-10 | p720 | 4.3 % | 3 | 0.13 / 0.01 |
| portrait-10 | handheld | 5.1 % | 4 | 0.13 / 0.00 |
| portrait-10 | handheld-low | 4.6 % | 4 | 0.16 / 0.00 |
| portrait-10 | deck | 3.9 % | 3 | 0.12 / 0.01 |
| portrait-10 | phone | 4.3 % | 7 | 0.12 / 0.00 |
| portrait-25 | desk1080 | 2.2 % | 3 | 0.16 / 0.01 |
| portrait-25 | desk1080x2 | 1.6 % | 6 | 0.09 / 0.00 |
| portrait-25 | p720 | 2.4 % | 3 | 0.16 / 0.01 |
| portrait-25 | handheld | 2.8 % | 3 | 0.16 / 0.00 |
| portrait-25 | handheld-low | 2.5 % | 3 | 0.19 / 0.00 |
| portrait-25 | deck | 2.2 % | 2 | 0.14 / 0.01 |
| portrait-25 | phone | 2.1 % | 5 | 0.13 / 0.00 |

### The worst pictures (failing and borderline checks)

- veg-far @ desk1080: 3.75 — inkShare 0.323 ✗
- veg-farthest @ desk1080: 3.75 — inkShare 0.316 ✗
- veg-far @ desk1080x2: 3.75 — inkShare 0.322 ✗
- veg-farthest @ desk1080x2: 3.75 — inkShare 0.312 ✗
- veg-far @ p720: 3.75 — inkShare 0.318 ✗
- veg-farthest @ p720: 3.75 — inkShare 0.311 ✗
- veg-far @ handheld-low: 3.75 — inkShare 0.334 ✗
- veg-farthest @ handheld-low: 3.75 — inkShare 0.345 ✗
- veg-far @ deck: 3.75 — inkShare 0.348 ✗
- veg-farthest @ deck: 3.75 — inkShare 0.33 ✗
- portrait-10 @ desk1080: 3.75 — eyeGrowth 4.4 ✗
- portrait-4 @ handheld-low: 3.75 — eyeGrowth 3.006 ✗
<!-- /ink-lines:measured -->
