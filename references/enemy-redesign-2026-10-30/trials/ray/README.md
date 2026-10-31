# Storm ray (`ray`), #800 family B

The game's ray since v2.39: Tripo's body from the approved image
[`../../storm-ray/4fc2da68-aa8c-4a93-bc00-5f1795b5e039-0.png`](../../storm-ray/4fc2da68-aa8c-4a93-bc00-5f1795b5e039-0.png),
landed straight from the skill's recipe. The sky ray it replaced is kept as `src/enemies/plans/sky-ray-legacy.js` (the
stand-in where the body is not loaded). Loaded by `src/enemies/foe-assets.js` (`FOE_ASSETS.ray`).

- **Generation**: task `e9077ebe-b1ce-4d64-afcb-be364d3d44e0`, image to model, H3.1, texture v3.5 with Remove Lighting,
  PBR off, 30k faces; 30 credits (balance 1,565 → 1,535). Record: `../../storm-ray/tripo/task.json`. Tripo drew the
  reference's ground shadow as a loose disc under it: dropped (`keep`: the biggest shell only).
- **Prepared** (`../ray-tripo/prepare.mjs`): 2.3 m nose to tail, 12,260 triangles; the tail cut across its root (its own
  mesh, its own bands); the wings left whole and bent in the skin; four flat colours (teal, cream, red-brown tips,
  dark); the painted eyes found on the head's sides (2.7 × 5 cm) and painted out. Shipped by
  `scripts/tripo/ship-flyer.mjs ray`: `public/enemies/storm-ray/body.glb` (364 KB) and `landmarks.json`, no picture.
- **Rig**: one skinned mesh for the body and wings, each wing on a joint where it leaves the body's back and another half
  way out, weighted by geometry over the root (a wing bent alone moves none of the body:
  `tests/storm-ray-tripo.test.js`); the tail on two joints. The reference's raised V is the downdraft's pose; gliding,
  the wings are let down 0.72 rad and beat on the glider's wave.
- **Kept**: skim (swept back, stilled; a perfect parry grounds it), lash (the tail lifted and cracked down), downdraft
  (Vael, Vael II: raised high, beaten down), banking and pitching, sounds, death, every skin's dress.

| measure | sky ray (before) | storm ray (after) |
|---|---|---|
| meshes a body (node build) | 60 | 3 |
| draws, six in Vael, High / Handheld | +828 / +576 | +54 / +36 |
| draws, six in the Sealed Hangar, High / Handheld | +882 / +611 | +54 / +36 |
| triangles, six in Vael, High | +36.7k | +225.7k |
| script time, six in Vael, High / the Hangar, High | +1.0 / +3.3 ms | +0.3 / +1.7 ms |
| Arena arrival, worst frame, every skin (High) | – | 16.8 ms, no program compiled |
| defend run (skim): guard holds from / through | 0.5 s / 3 | 0.5 s / 3 |
| dodge run: back flip into the flurry | yes | yes |

Pictures: `pairs.webp`, `skins-after.webp`, `cuts.webp` (the body red, the tail blue), the strips `ray-tripo-*.webp`,
`unity.webp`.

Still off: in still pictures a ray mid-turn shows one wing high and one low (its bank, as the sky ray's); the porcelain
ray's ribbons read as thin lines; the root of each wing creases a little when let right down on the ground.
