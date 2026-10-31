# Lamp moth (`moth`), #800 family B

The game's moth since v2.39: Tripo's body from the approved image
[`../../lamp-moth/5b88e9ea-3cc5-4ea8-ab97-4431bfb5584b-1.png`](../../lamp-moth/5b88e9ea-3cc5-4ea8-ab97-4431bfb5584b-1.png),
landed straight from the skill's recipe. The signal moth it replaced is kept as `src/enemies/plans/signal-moth-legacy.js`
(the stand-in where the body is not loaded).

- **Generation**: task `3c2ccaf8-7fc1-4638-8195-e03c424d3a9e`, image to model, H3.1, texture v3.5 with Remove Lighting,
  PBR off, 30k faces; 30 credits (balance 1,595 → 1,565). Record: `../../lamp-moth/tripo/task.json`. One shell, no rig.
- **Prepared** (`../moth-tripo/prepare.mjs`): 1.85 m wing tip to wing tip, 13,572 triangles; cut by geometry into the
  body (in front of the wings' sheet, within its silhouette's half-width a height; its feet and shoulder nubs), the head
  and antennae (over the neck's plane), the wings, and each eye-spot (an ellipse in the wing's plane round its cream,
  through both faces); six flat colours; the painted eyes found on the head (3.3 × 3.7 cm) and painted out. Shipped by
  `scripts/tripo/ship-flyer.mjs moth`: `public/enemies/lamp-moth/body.glb`, 430 KB; since the storm ray landed it loads through `src/enemies/foe-assets.js` (no picture: every skin draws its vertex colours, `landmarks.json` beside it).
- **Rig**: the body one mesh on the frame; the wings one skinned mesh, each on a hinge at the body's side and an outer
  joint half way out, the root held from the egg's half-width (the body's back never moves: `tests/lamp-moth-tripo.test.js`);
  the eye-spots their own skinned mesh on the same joints (they blaze for the flash); the head skinned on its neck (the
  gaze turns it, yaw only) and two antenna joints that trail its motion.
- **Kept**: flash (open flat, spots white), dart (folded back, nose down), dust (the lamp moth and the Antennas' moth),
  in threes, light and flinchy, sounds, death (the wings fold back as it spirals down), every skin's dress.

| measure | signal moth (before) | lamp moth (after) |
|---|---|---|
| meshes a body (node build) | 126 | 5 |
| draws, six in Lorn II, High / Handheld | +630 / +421 | +90 / +61 |
| draws, six in the Signal Market, High (2nd round) / Handheld | +540 / +349 | +82 / +56 |
| triangles, six in Lorn II, High | +88.3k | +249.3k |
| script time, six in Lorn II, High / Handheld | +2.4 / +2.7 ms | +1.6 / +0.3 ms |
| Arena arrival, worst frame, every skin (High) | – | 16.8 ms, no program compiled |
| defend run: flash guard holds from / parry at / through | 0.5 s / 0.06–0.2 s / 2 | 0.5 s / 0.06–0.12 s / 1 |
| dodge run: back flip into the flurry | yes | yes |

The bench ran with the machine busy (load 20–40); the Signal Market's first High after-run caught the world still loading
(its triangles a third short) and is left out.

Pictures: `pairs.webp`, `skins-after.webp`, `cuts.webp` (the parts by eye: body red, head blue, wings green, spots
yellow), the strips `moth-tripo-*.webp`, `unity.webp`.

Still off: the wing roots crease where they leave the body's back (the reference hides them behind it); seen side on, the
egg is flat at its back where Tripo set the wings against it; the glass wasp's spots show as faint outlines.
