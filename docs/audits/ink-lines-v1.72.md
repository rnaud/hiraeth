# Ink lines at every distance and resolution, v1.72 (2026-10-14)

<!-- audit-scores
overall: 4.67 / 5
label: the mean of 112 pictures (16 scenes at 7 resolutions; 4.70 at v1.66, the plant scenes on another view then)
date: 2026-10-14
-->

A rerun of the ink-lines audit (`.claude/skills/ink-lines/SKILL.md`) for issue #302, after [v1.66](ink-lines-v1.66.md):
the plant scenes pinned to v1.53's view, and the traveller's eyes from afar on his portrait head.
- This branch on main `259a283d` (v1.72); Mac M4 Pro, headless Chrome on the GPU (ANGLE Metal), muted, its own Vite
  (port 6301); a shared machine at load 50-110 (the pictures don't depend on it).
- v1.53's plant found by running v1.53's own capture (`8f115b3d`, exported, its `veg-far` at desk1080): a parasol
  5.9 m tall at (83.6, -16.6, -69.2), 355 px tall there (v1.53's report: 354).

## Findings and fixes

1. **The plant scenes are pinned** (`capture.mjs` `PLANT`). They looked at "the tallest plant under 6 m within 200 m of
   Viridel's start"; since Viridel's explorations that was a parasol 150 m off, another view of other flowers. The
   parasol of v1.53 is gone too (Viridel's flora changed round it; the nearest parasol now is 4 m tall, 6 m off), so the
   cameras are placed from its place and height as they were, whatever grows there now: `veg-far` at 1080p is v1.53's
   view again (the measure is all the flora in it, hidden with `flora.root`).
   On that view the far flowers are **under the far cap of 30 % at every resolution**: `veg-far` 23-26 % (v1.53 after
   its fix: 22-28 %), `veg-farthest` 13-29 %. Nothing far to fix. The near and mid scenes look at more flowers than in
   v1.53 (the meadow grew round that place: 569 px of flora at 5 m where v1.53 had the parasol alone), so they are not
   like for like; `veg-mid` on Handheld reads 34.8 % (the near cap 34 %), borderline, the rest under it.
2. **His eyes from 10 m** (`portrait-10`). The portrait head keeps its approved portrait's painted eyes, white and iris
   and lash line, and nothing faded them by size: on a 12 px face they were two grey-blue dots
   ([before ×8](ink-lines-v1.72/portrait-10-before-x8.webp)). Now (`PORTRAIT_EYES_FAR`, src/characters/portrait-head.js;
   faces.md "The portrait head from afar") as the face falls from 26 to 14 render px the eye's patch turns to one warm
   tone a little darker than the skin, and the brows half way to the skin ([after ×8](ink-lines-v1.72/portrait-10-after-x8.webp)):
   no dots, a soft mark. Faces of 26 px and up are drawn exactly as before (`portrait-1`, `portrait-4` at 1080p: 179
   and 31 px; the shader's fade is 0 there, `tests/portrait-head.test.js`).
   **The measure is not under ×2.5**: the eyes' share of the face at 1080p reads 2.2-4.5 × the 1 m portrait's from run
   to run before and after (his idle moves between runs). On a 12 px face the eye's box (1.4 × the opening and half a
   pixel) reaches the column of the hair's edge beside the left eye (luminance 30-64 against the cheek's 115), and the
   darkest pixel in it is the hair (0.12-0.16 of the cheek) whatever the eye is drawn as; turning the brows to the skin
   colour changed nothing measurable. What would make the number say what the eye looks like: the eye's box leaving
   out pixels the albedo calls hair, or the eye checks from 14 px of face up. A rubric change for the author.

## What is left

The eye measure on faces of 8-13 px (above); `veg-mid` on Handheld at the near cap. And new since v1.66, not from this
change: `portrait-1` at 1080p 5.00 → 3.75, its left eye's density 0.77 → 1.8-2.0 (over the 1.3 limit) in every run
here, with the far fade off as with it on (the fade is 0 on a 179 px face): something on main since v1.66 opens or
darkens his near eye (the talking face of #323, or the arrival's framing of #327, are the changes to his head since).
**Found since (#335): not his eye but the measure's aim.** Bisected to de4c7e58 (the B3 body): it wears the portrait
head by its own fit (`B3_HEAD_FIT`: scale 0.280, set 2.3 cm lower), and the capture had the v1 body's fit written
out, so its eye boxes sat 1.5 cm up, on the brow and the hair over it; the eye is drawn as before. The capture now
reads the head's fit off the mesh, and aims the portrait again at the instant of the picture (his idle turned his head
three-quarters in some runs): `portrait-1` at 1080p 5.00, the eyes' density 0.80 and 0.79 (0.80-1.0 over four runs).

## The measures

<!-- ink-lines:measured -->
Captured 2026-10-14 at 259a283d; 112 pictures, 154 s.

**Mean score** (of 5, every scene at every resolution): **4.67**

### Scores (of 5) by scene and resolution

| scene | desk1080 | desk1080x2 | p720 | handheld | handheld-low | deck | phone |
|---|---|---|---|---|---|---|---|
| portrait-1 | 3.75 | 4.00 | 4.00 | 4.50 | 4.50 | 4.00 | 4.50 |
| portrait-4 | 5.00 | 4.00 | 4.38 | 4.38 | 3.75 | 4.38 | 4.38 |
| portrait-10 | 3.75 | 5.00 | 3.75 | 3.75 | 4.38 | 3.75 | 4.38 |
| portrait-25 | 3.75 | 3.75 | 4.38 | 5.00 | 5.00 | 4.38 | 5.00 |
| town-far | 5.00 | 5.00 | 5.00 | 5.00 | 4.17 | 5.00 | 4.17 |
| canopy-mid | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| canopy-far | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| pack | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| temple-hall | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| uw-avenue | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| mf-floor | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| sc-bridges | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| veg-near | 4.38 | 4.38 | 4.38 | 4.38 | 4.38 | 4.38 | 4.38 |
| veg-mid | 4.38 | 4.38 | 4.38 | 3.75 | 4.38 | 4.38 | 5.00 |
| veg-far | 4.38 | 4.38 | 4.38 | 4.38 | 5.00 | 4.38 | 5.00 |
| veg-farthest | 4.38 | 4.38 | 4.38 | 4.38 | 5.00 | 4.38 | 5.00 |

### Plants: ink share / near-black share / line width (median, p90 px) / height on screen

| scene | res | ink | dark | width | height px |
|---|---|---|---|---|---|
| canopy-mid | desk1080 | 6.8 % | 2.7 % | 2/3 | 904 |
| canopy-mid | desk1080x2 | 6.8 % | 3.9 % | 3/6 | 1810 |
| canopy-mid | p720 | 7.7 % | 3.0 % | 1/3 | 603 |
| canopy-mid | handheld | 6.6 % | 1.9 % | 1/2 | 607 |
| canopy-mid | handheld-low | 7.9 % | 1.0 % | 2/3 | 611 |
| canopy-mid | deck | 9.8 % | 2.9 % | 2/3 | 670 |
| canopy-mid | phone | 7.7 % | 2.9 % | 4/6 | 1001 |
| canopy-far | desk1080 | 8.1 % | 2.6 % | 2/4 | 434 |
| canopy-far | desk1080x2 | 8.1 % | 4.0 % | 4/6 | 868 |
| canopy-far | p720 | 9.1 % | 1.9 % | 2/3 | 289 |
| canopy-far | handheld | 8.1 % | 0.7 % | 1/3 | 290 |
| canopy-far | handheld-low | 9.6 % | 0.7 % | 2/4 | 289 |
| canopy-far | deck | 10.6 % | 3.0 % | 2/4 | 321 |
| canopy-far | phone | 11.8 % | 1.3 % | 4/8 | 478 |
| veg-near | desk1080 | 23.0 % | 8.0 % | 3/6 | 569 |
| veg-near | desk1080x2 | 22.6 % | 4.2 % | 5/13 | 1139 |
| veg-near | p720 | 26.1 % | 9.3 % | 3/5 | 379 |
| veg-near | handheld | 33.0 % | 6.5 % | 3/6 | 380 |
| veg-near | handheld-low | 27.0 % | 0.1 % | 4/5 | 382 |
| veg-near | deck | 26.6 % | 9.7 % | 3/6 | 421 |
| veg-near | phone | 26.6 % | 0.1 % | 7/11 | 621 |
| veg-mid | desk1080 | 27.1 % | 8.9 % | 3/5 | 356 |
| veg-mid | desk1080x2 | 27.2 % | 4.7 % | 5/10 | 713 |
| veg-mid | p720 | 29.1 % | 9.6 % | 3/5 | 237 |
| veg-mid | handheld | 34.8 % | 6.7 % | 3/7 | 236 |
| veg-mid | handheld-low | 27.1 % | 0.1 % | 3/6 | 239 |
| veg-mid | deck | 29.8 % | 10.3 % | 3/5 | 262 |
| veg-mid | phone | 19.6 % | 0.1 % | 6/13 | 387 |
| veg-far | desk1080 | 25.0 % | 5.8 % | 2/8 | 604 |
| veg-far | desk1080x2 | 25.0 % | 3.6 % | 5/13 | 1209 |
| veg-far | p720 | 23.2 % | 3.4 % | 3/6 | 403 |
| veg-far | handheld | 25.2 % | 1.9 % | 3/6 | 403 |
| veg-far | handheld-low | 15.3 % | 0.3 % | 4/6 | 404 |
| veg-far | deck | 25.7 % | 5.3 % | 3/7 | 447 |
| veg-far | phone | 15.9 % | 0.1 % | 7/11 | 654 |
| veg-farthest | desk1080 | 28.0 % | 6.5 % | 3/7 | 517 |
| veg-farthest | desk1080x2 | 28.6 % | 3.8 % | 5/13 | 1033 |
| veg-farthest | p720 | 26.3 % | 5.7 % | 3/8 | 344 |
| veg-farthest | handheld | 29.4 % | 3.2 % | 4/9 | 318 |
| veg-farthest | handheld-low | 17.6 % | 0.0 % | 4/9 | 317 |
| veg-farthest | deck | 29.0 % | 7.5 % | 3/8 | 382 |
| veg-farthest | phone | 13.3 % | 0.0 % | 7/13 | 547 |

### The traveller: face height on screen (brow to chin), the eyes' dark as a share of the face against the 1 m portrait at desk1080 (× ref: 1 keeps its proportion), their density (dark over the opening), the darkest eye pixel against the cheek (0 black), his near-black share

| scene | res | face px | eyes × ref | eye density | darkest | dark share |
|---|---|---|---|---|---|---|
| portrait-1 | desk1080 | 179 | 1.0 | 1.42 | 0.00 | 11.4 % |
| portrait-1 | desk1080x2 | 340 | 1.0 | 1.39 | 0.00 | 8.2 % |
| portrait-1 | p720 | 115 | 1.0 | 1.32 | 0.01 | 11.0 % |
| portrait-1 | handheld | 118 | 0.9 | 1.26 | 0.04 | 10.7 % |
| portrait-1 | handheld-low | 123 | 0.8 | 1.20 | 0.07 | 10.5 % |
| portrait-1 | deck | 134 | 1.0 | 1.52 | 0.01 | 10.5 % |
| portrait-1 | phone | 194 | 0.7 | 0.93 | 0.11 | 10.4 % |
| portrait-4 | desk1080 | 31 | 1.4 | 1.90 | 0.10 | 4.5 % |
| portrait-4 | desk1080x2 | 63 | 1.1 | 1.48 | 0.10 | 2.9 % |
| portrait-4 | p720 | 20 | 1.8 | 2.47 | 0.12 | 3.2 % |
| portrait-4 | handheld | 21 | 2.0 | 2.74 | 0.13 | 3.7 % |
| portrait-4 | handheld-low | 21 | 3.1 | 4.37 | 0.13 | 2.7 % |
| portrait-4 | deck | 23 | 1.7 | 2.36 | 0.15 | 4.4 % |
| portrait-4 | phone | 34 | 1.7 | 2.33 | 0.24 | 4.1 % |
| portrait-10 | desk1080 | 12 | 3.8 | 5.33 | 0.12 | 8.7 % |
| portrait-10 | desk1080x2 | 23 | 1.2 | 1.31 | 0.22 | 3.2 % |
| portrait-10 | p720 | 8 | 6.4 | 6.23 | 0.15 | 5.9 % |
| portrait-10 | handheld | 8 | 4.7 | 4.91 | 0.18 | 2.8 % |
| portrait-10 | handheld-low | 8 | 4.6 | 4.72 | 0.24 | 2.8 % |
| portrait-10 | deck | 9 | 4.8 | 6.08 | 0.18 | 6.8 % |
| portrait-10 | phone | 14 | 2.2 | 3.64 | 0.50 | 2.6 % |
| portrait-25 | desk1080 | 5 | 8.6 | 3.14 | 0.13 | 8.5 % |
| portrait-25 | desk1080x2 | 10 | 3.7 | 4.84 | 0.19 | 3.3 % |
| portrait-25 | p720 | 3 | 11.5 | 1.75 | 0.34 | 6.6 % |
| portrait-25 | handheld | 3 | 12.9 | 2.13 | 0.41 | 1.9 % |
| portrait-25 | handheld-low | 3 | 6.9 | 1.14 | 0.61 | 2.8 % |
| portrait-25 | deck | 4 | 11.9 | 2.42 | 0.28 | 11.9 % |
| portrait-25 | phone | 5 | 2.7 | 0.96 | 0.80 | 2.6 % |

### The whole frame: ink share, line width (median px), shimmer (change / pops a half pixel over)

| scene | res | frame ink | width | shimmer |
|---|---|---|---|---|
| portrait-1 | desk1080 | 4.3 % | 2 | 0.08 / 0.00 |
| portrait-1 | desk1080x2 | 4.4 % | 4 | 0.04 / 0.00 |
| portrait-1 | p720 | 6.9 % | 2 | 0.08 / 0.00 |
| portrait-1 | handheld | 4.3 % | 3 | 0.10 / 0.00 |
| portrait-1 | handheld-low | 6.5 % | 3 | 0.10 / 0.00 |
| portrait-1 | deck | 6.1 % | 2 | 0.09 / 0.00 |
| portrait-1 | phone | 8.9 % | 9 | 0.07 / 0.00 |
| portrait-4 | desk1080 | 4.0 % | 2 | 0.10 / 0.01 |
| portrait-4 | desk1080x2 | 3.3 % | 4 | 0.09 / 0.00 |
| portrait-4 | p720 | 6.2 % | 2 | 0.12 / 0.01 |
| portrait-4 | handheld | 7.7 % | 3 | 0.12 / 0.00 |
| portrait-4 | handheld-low | 7.4 % | 4 | 0.13 / 0.00 |
| portrait-4 | deck | 5.4 % | 2 | 0.10 / 0.01 |
| portrait-4 | phone | 7.1 % | 8 | 0.10 / 0.00 |
| portrait-10 | desk1080 | 2.9 % | 2 | 0.11 / 0.01 |
| portrait-10 | desk1080x2 | 3.0 % | 5 | 0.11 / 0.00 |
| portrait-10 | p720 | 4.3 % | 3 | 0.13 / 0.01 |
| portrait-10 | handheld | 5.0 % | 3 | 0.14 / 0.00 |
| portrait-10 | handheld-low | 4.7 % | 4 | 0.16 / 0.00 |
| portrait-10 | deck | 4.0 % | 2 | 0.12 / 0.01 |
| portrait-10 | phone | 5.1 % | 7 | 0.16 / 0.00 |
| portrait-25 | desk1080 | 1.7 % | 3 | 0.14 / 0.01 |
| portrait-25 | desk1080x2 | 1.6 % | 6 | 0.10 / 0.00 |
| portrait-25 | p720 | 2.4 % | 3 | 0.16 / 0.01 |
| portrait-25 | handheld | 2.9 % | 3 | 0.16 / 0.00 |
| portrait-25 | handheld-low | 2.3 % | 3 | 0.17 / 0.00 |
| portrait-25 | deck | 2.2 % | 3 | 0.14 / 0.01 |
| portrait-25 | phone | 3.0 % | 7 | 0.20 / 0.00 |
| town-far | desk1080 | 1.7 % | 2 | 0.29 / 0.02 |
| town-far | desk1080x2 | 1.8 % | 4 | 0.26 / 0.02 |
| town-far | p720 | 2.3 % | 2 | 0.31 / 0.02 |
| town-far | handheld | 2.8 % | 3 | 0.35 / 0.03 |
| town-far | handheld-low | 2.7 % | 4 | 0.47 / 0.04 |
| town-far | deck | 2.2 % | 2 | 0.32 / 0.02 |
| town-far | phone | 2.8 % | 8 | 0.43 / 0.04 |
| canopy-mid | desk1080 | 3.1 % | 2 | 0.07 / 0.00 |
| canopy-mid | desk1080x2 | 3.1 % | 4 | 0.08 / 0.00 |
| canopy-mid | p720 | 3.6 % | 2 | 0.09 / 0.00 |
| canopy-mid | handheld | 3.4 % | 2 | 0.11 / 0.00 |
| canopy-mid | handheld-low | 4.0 % | 2 | 0.13 / 0.00 |
| canopy-mid | deck | 3.8 % | 2 | 0.08 / 0.00 |
| canopy-mid | phone | 4.1 % | 4 | 0.13 / 0.00 |
| canopy-far | desk1080 | 3.9 % | 2 | 0.09 / 0.00 |
| canopy-far | desk1080x2 | 4.0 % | 4 | 0.09 / 0.01 |
| canopy-far | p720 | 4.5 % | 2 | 0.10 / 0.00 |
| canopy-far | handheld | 3.8 % | 2 | 0.13 / 0.01 |
| canopy-far | handheld-low | 4.7 % | 2 | 0.16 / 0.02 |
| canopy-far | deck | 4.2 % | 2 | 0.09 / 0.00 |
| canopy-far | phone | 5.4 % | 5 | 0.12 / 0.01 |
| pack | desk1080 | 2.1 % | 2 | 0.05 / 0.00 |
| pack | desk1080x2 | 2.1 % | 4 | 0.05 / 0.01 |
| pack | p720 | 2.4 % | 2 | 0.06 / 0.00 |
| pack | handheld | 2.6 % | 2 | 0.07 / 0.00 |
| pack | handheld-low | 3.7 % | 2 | 0.08 / 0.00 |
| pack | deck | 2.7 % | 2 | 0.06 / 0.00 |
| pack | phone | 4.1 % | 4 | 0.07 / 0.00 |
| temple-hall | desk1080 | 2.0 % | 2 | 0.09 / 0.00 |
| temple-hall | desk1080x2 | 2.0 % | 4 | 0.10 / 0.01 |
| temple-hall | p720 | 2.3 % | 2 | 0.11 / 0.00 |
| temple-hall | handheld | 2.6 % | 2 | 0.13 / 0.00 |
| temple-hall | handheld-low | 3.5 % | 2 | 0.14 / 0.01 |
| temple-hall | deck | 2.5 % | 2 | 0.11 / 0.00 |
| temple-hall | phone | 3.7 % | 4 | 0.15 / 0.00 |
| uw-avenue | desk1080 | 4.8 % | 1 | 0.04 / 0.00 |
| uw-avenue | desk1080x2 | 4.9 % | 3 | 0.05 / 0.00 |
| uw-avenue | p720 | 5.3 % | 1 | 0.05 / 0.00 |
| uw-avenue | handheld | 5.2 % | 1 | 0.06 / 0.00 |
| uw-avenue | handheld-low | 5.9 % | 2 | 0.07 / 0.00 |
| uw-avenue | deck | 5.2 % | 1 | 0.05 / 0.00 |
| uw-avenue | phone | 6.9 % | 4 | 0.06 / 0.00 |
| mf-floor | desk1080 | 6.8 % | 2 | 0.17 / 0.00 |
| mf-floor | desk1080x2 | 6.7 % | 3 | 0.20 / 0.00 |
| mf-floor | p720 | 6.1 % | 2 | 0.20 / 0.00 |
| mf-floor | handheld | 6.0 % | 2 | 0.20 / 0.00 |
| mf-floor | handheld-low | 6.3 % | 3 | 0.22 / 0.00 |
| mf-floor | deck | 6.6 % | 2 | 0.19 / 0.00 |
| mf-floor | phone | 6.6 % | 6 | 0.23 / 0.00 |
| sc-bridges | desk1080 | 5.2 % | 2 | 0.20 / 0.01 |
| sc-bridges | desk1080x2 | 5.2 % | 4 | 0.21 / 0.01 |
| sc-bridges | p720 | 5.5 % | 2 | 0.24 / 0.01 |
| sc-bridges | handheld | 5.4 % | 2 | 0.25 / 0.00 |
| sc-bridges | handheld-low | 6.1 % | 2 | 0.26 / 0.01 |
| sc-bridges | deck | 5.6 % | 2 | 0.24 / 0.00 |
| sc-bridges | phone | 6.4 % | 4 | 0.29 / 0.01 |
| veg-near | desk1080 | 3.6 % | 2 | 0.11 / 0.00 |
| veg-near | desk1080x2 | 3.9 % | 4 | 0.07 / 0.00 |
| veg-near | p720 | 4.9 % | 2 | 0.11 / 0.00 |
| veg-near | handheld | 5.8 % | 3 | 0.08 / 0.00 |
| veg-near | handheld-low | 5.1 % | 3 | 0.09 / 0.00 |
| veg-near | deck | 4.2 % | 2 | 0.10 / 0.00 |
| veg-near | phone | 5.6 % | 7 | 0.08 / 0.00 |
| veg-mid | desk1080 | 3.0 % | 2 | 0.11 / 0.00 |
| veg-mid | desk1080x2 | 3.3 % | 4 | 0.07 / 0.00 |
| veg-mid | p720 | 4.1 % | 2 | 0.12 / 0.00 |
| veg-mid | handheld | 4.7 % | 3 | 0.08 / 0.00 |
| veg-mid | handheld-low | 3.8 % | 3 | 0.09 / 0.00 |
| veg-mid | deck | 3.5 % | 2 | 0.10 / 0.00 |
| veg-mid | phone | 4.1 % | 6 | 0.09 / 0.00 |
| veg-far | desk1080 | 2.7 % | 2 | 0.16 / 0.01 |
| veg-far | desk1080x2 | 3.0 % | 4 | 0.12 / 0.00 |
| veg-far | p720 | 3.5 % | 2 | 0.17 / 0.01 |
| veg-far | handheld | 3.9 % | 2 | 0.16 / 0.00 |
| veg-far | handheld-low | 3.0 % | 3 | 0.14 / 0.00 |
| veg-far | deck | 3.0 % | 2 | 0.16 / 0.01 |
| veg-far | phone | 3.4 % | 7 | 0.12 / 0.00 |
| veg-farthest | desk1080 | 3.3 % | 2 | 0.15 / 0.01 |
| veg-farthest | desk1080x2 | 3.5 % | 4 | 0.13 / 0.00 |
| veg-farthest | p720 | 4.0 % | 3 | 0.15 / 0.00 |
| veg-farthest | handheld | 4.7 % | 3 | 0.13 / 0.00 |
| veg-farthest | handheld-low | 3.4 % | 3 | 0.12 / 0.00 |
| veg-farthest | deck | 3.8 % | 3 | 0.15 / 0.00 |
| veg-farthest | phone | 3.7 % | 6 | 0.12 / 0.00 |

### The worst pictures (failing and borderline checks)

- portrait-1 @ desk1080: 3.75 — eyeDensity 1.419 ✗
- portrait-10 @ desk1080: 3.75 — eyeGrowth 3.844 ✗
- portrait-25 @ desk1080: 3.75 — eyeBlack 0.867 ✗
- portrait-25 @ desk1080x2: 3.75 — eyeBlack 0.808 ✗
- portrait-10 @ p720: 3.75 — eyeBlack 0.854 ✗
- portrait-10 @ handheld: 3.75 — eyeBlack 0.821 ✗
- portrait-4 @ handheld-low: 3.75 — eyeGrowth 3.075 ✗
- portrait-10 @ deck: 3.75 — eyeBlack 0.822 ✗
- veg-mid @ handheld: 3.75 — inkShare 0.348 ✗
- portrait-1 @ desk1080x2: 4.00 — eyeDensity 1.392 ✗
- portrait-4 @ desk1080x2: 4.00 — eyeDensity 1.479 ✗
- portrait-1 @ p720: 4.00 — eyeDensity 1.321 ✗
<!-- /ink-lines:measured -->
