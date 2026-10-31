# Family A on Tripo bodies (#800): the toad, the centipede, the skitter

The ground creatures on legs, rebuilt one at a time by the skill's recipe (`.claude/skills/enemy-rework/references/
tripo-rebuild.md`), each from its approved image, each landed in the game replacing its archetype's body. The replaced
builder stays in the repository under a `-legacy` name, standing in where the new body is not loaded, so its look can
come back as a foe of its own.

## The scripts

| Script | What |
|---|---|
| `generate.mjs <toad\|centipede\|skitter> [--dry]` | the Tripo generation (H3.1, texture v3.5, Remove Lighting, 30k faces): the untouched export and `task.json` (credits, the balance before and after) into the concept folder's `tripo/`; refuses to run again, or under the 400-credit floor |
| `slices.mjs <glb> [axis from to step cell]` | the export's vertices in slabs, their clusters: where each leg's column stands, the spine's middle (for the landmarks) |
| `prep-kit.mjs` | the shared prepare steps: the game's frame, decimation by geometry, `splitAlong` (a part's edge cut exactly on a surface), the texture repainted by part, the gaps filled |
| `prepare-<foe>.mjs` | one foe's asset: `<foe>-lod.glb`, `<foe>-landmarks.json`, `<foe>-texture.png` (the trial's; the game ships no picture) |
| `../../../../scripts/tripo/ship-body.mjs <foe>` | the game's file, `public/enemies/<concept>/body.glb`: 16-bit indices, the triangles grouped by part, COLOR_0, the landmarks in its extras |
| `splat.mjs <glb> <prefix> [--clay]` | the prepared body rasterised in its colours (front, side, top, three-quarter, back), before it is rigged |
| `inventory.mjs <kind>` | every skin built in node: the body it wears, its meshes and triangles |
| `diag.mjs <kind@skin> [frames state attack]` | a foe in node: how far its skin is from its bind, per bone; its legs' joints |
| `probe-toad.mjs` | the toad's lob wind-up frame by frame: the bellows, the bubble's veil |
| `warm-check.mjs <kind>` | the Arena's warm-up: each skin brought in after the load, the programs compiled at its arrival and its frames |
| `bench-world.sh <before> <level> <kind@skin> <out>` | six of a kind in a real world against none, before and after, High and Handheld, two rounds |
| `pair-shots.mjs <before> <version> <name>=<kind@skin>[:pose[:at[:yaw]]] …` | the changelog's before / after pictures through the gallery's `foe` view |

## The bellows toad (`toad`)

Reference: `../../bellows-toad/c5a76758-e908-4034-acc5-7b88452dcb71-0.png` (approved). Task `6183568d-…`, 30 credits
(balance 1,625 before, 1,565 after: other agents generating at the same time). Home skin `perdide` (Lorn's spore toad).

- **What it is**: Tripo's 28k-triangle body at the legacy toad's 2.2 m, cut to 13,234 triangles (12,000 decimated, the
  parts' cuts adding the rest), its three parts by geometry: the belly's edge a smooth curve round the body (its angle from
  the front per height, the export's ragged orange share's best split, smoothed), the webbed feet under a plane at
  0.17 m; one flat colour a part (the reference's sage, orange and paler orange). The painted eyes (a lid line and an
  orange iris on the bumps) painted out.
- **The rig** (many-legged: a custom skin on the game's legs): the hopper plan's four legs (arms, hind legs) on SkinLegs
  bones fitted to the measured hip, knee, ankle and foot; the webbed toes on their foot bone, eased onto the shin over the
  ankle; the torso's head (its top over 1.6 m eased onto it) turning to the traveller (0.32 rad) with two heavy-lidded
  eyes sliding on; the belly the bellows, its own bone eased out over an ellipsoid on its front, breathing as it sits and
  swelling (×1.3 forward) and glowing in a lob's wind-up, the legacy see-through throat bubble and glob above it. The kit's
  first stance is squared (its stagger of a stride stretched the fused legs 0.35 m).
- **Fixes on the way**: the belly's edge by colour ran ragged (cut by geometry instead); COLOR_0 sampled from the texture
  mixed parts at the islands' edges (set by part, exactly); the kit planted the toes' spot, not the ankle's (the leg
  stretched); the belly's own material is per toad (it glows), smooth-shaded.
- **Measured**: walk audit (hops: feet planted) slide 0.3 mm a metre, worst 1 mm, at full and half pace (the legacy: 0);
  bind round trip < 0.1 mm; sitting, every vertex within 6 cm of its bind (2.6 cm the most); the head turns ±0.3 rad to
  him and the eyes go his way. Six toads in Lorn: draws +486 → +90 (High), +324 → +60 (Handheld); triangles +122k →
  +250k (High); the script's time a frame not separable from the noise at load 15–22. Arena warm-up: the run's two skins
  (perdide, incal) compile nothing at arrival, first frame 2.9 / 1.8 ms; the Waterfall and Home skins, never in the run,
  compile one program when brought in by hand (as the legacy toad's). The dodge run: a back flip into the flurry; the
  defend run: the lob guarded from 0.5 s, parried at 0.06–0.12 s, evaded at 0.08–0.15 s (the flop not drawn in the time
  given; the volley is not the home skin's). Sound unchanged: `bellows` and `hopper` steps on target (0.1 dB at most).
- **Still off**: the belly's broad smooth front takes the hatch's contour rings on its shadowed side (the game's light: the
  clay view has them too); the eyes are small at play distance; the throat bubble is the legacy toad's, not of the mesh.
