# Cloud jelly (`jelly`), #800 family B

The game's jelly since v2.39: Tripo's body from the approved image
[`../../cloud-jelly/0cdfba00-da12-409f-8fd5-03de262f50ca-1.png`](../../cloud-jelly/0cdfba00-da12-409f-8fd5-03de262f50ca-1.png),
landed straight from the skill's recipe (the author picked Tripo for all four trial foes; no direct body was made). The
lantern jelly it replaced is kept as `src/enemies/plans/lantern-jelly-legacy.js` (the stand-in where the body is not loaded).

- **Generation**: task `b9a1a819-c283-435b-b7e1-9181a3f2770c`, image to model, H3.1, texture v3.5 with Remove Lighting,
  PBR off, 30k faces; 30 credits (balance 1,655 → 1,595 as read: another agent's generation ran in the same minutes).
  Record: `../../cloud-jelly/tripo/task.json`. One shell, no rig (a floater: its own joints).
- **Prepared** (`../jelly-tripo/prepare.mjs`, the shared steps in `../flyer-tripo/prep-lib.mjs`): 2.6 m tall, 13,210
  triangles; the cap cut along its lip (the lowest cream round it, a Fourier curve) and round the two arms; each bulb
  cut across its neck; four flat colours (cap cream, sage, salmon, dark); the painted eyes found by their dark texels on
  the cap's front lobe (3.8 × 9.2 cm each) and painted out. Shipped by `scripts/tripo/ship-flyer.mjs jelly`:
  `public/enemies/cloud-jelly/body.glb`, 402 KB (300 KB gzipped), the texture 512².
- **Rig**: the cap on the bell's joint; one skinned mesh (skirt, stems, arms) on the bell, two arms and three lanterns,
  two influences, normalised, bind round trip < 0.1 mm, each joint moving only its own vertices
  (`tests/cloud-jelly-tripo.test.js`); each bulb its own mesh on its lantern's joint.
- **Kept**: ward (a lantern swells and glows; its thread of light), mend, curtain (the threads show only while they
  fall), the lanterns' pop, its support role, sounds, death (it deflates onto its bulbs), every skin's dress.

| measure | lantern jelly (before) | cloud jelly (after) |
|---|---|---|
| meshes a body (node build) | 134 | 6 (7 with a halo or core) |
| draws, six in Vael II, High / Handheld | +324 / +216 | +108 / +72 |
| draws, six in the Garden of Spheres, High / Handheld | +324 / +216 | +128 / +84 |
| triangles, six in Vael II, High | +97.0k | +242.8k |
| script time, six in Vael II, High / Handheld | +1.8 / +1.6 ms | +1.8 / +1.2 ms |
| Arena arrival, worst frame, every skin (High) | – | 16.8 ms, no program compiled |
| defend run (curtain): guard holds from / parry at / through | 0.5 s / 0.06–0.2 s / 0 | 0.5 s / 0.06–0.12 s / 0 |
| dodge run (curtain): back flip into the flurry | yes | yes |

Pictures: `pairs.webp` (before and after, every skin and the ward), `skins-after.webp`, `moves.webp` (the clench, the
curtain's threads, the side), the strips `jelly-tripo-*.webp` (the Arena, the traveller beside it). Bench rows:
`bench.jsonl`; combat: `defend-*.md`, `dodge-*.json`.

Still off: the cap's lobes take the game's hard self-shadow in lilac patches where the reference is flat cream; the
prism lanterns hang a little apart from their stems; the clench pulls the bulbs up into the arms.
