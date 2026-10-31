# The mummer king (`mummerking`), #800 family G

The approved redesign (`../../keep-mummerking/71c2e792-5ceb-40f7-966d-19b12c1b10a6-1.png`: a big teal pear that is head and
body at once, three ochre crown rods, a cream oval mask with two black eyes, a terracotta belly patch and knee pads, huge
cream gauntlets, cream boots with terracotta cuffs, a paddle club) is the mummer king's body in the game since this change:
`src/enemies/plans/mummer-king-tripo.js` on the family's shared biped rig `src/enemies/plans/tripo-biped.js`, the asset
`public/enemies/mummerking/` (`body.glb` 482 KB, 266 KB gzipped, no picture; `skeleton.json`), loaded by
`src/enemies/foe-assets.js`. The junk king it replaces stays in `plans/mummer.js` as `legacyMummerKingModel` (the stand-in
while the asset loads). Web and Unity (`-fight humanoids`).

## The T-pose: picked by the agent

The author asleep ("keep going with your own recommendations"; for the dune mummer: "you can do the t-pose yourself"), so
the agent made the sheets in the reference lab and picked them; the author can override. Prompts:
`docs/design/enemy-tpose-prompts-family-g.md#mummerking-tpose` and `#mummerking-tpose-side`, the approved image as `--refs`,
Gemini and OpenAI, two each ($0.15 a run). Picks in `../../keep-mummerking/tpose/` (`manifest.json` holds each pick's
prompt, refs, provider, cost, sha256 and why):

- **sheet-1.jpg** (OpenAI 1): a true T-pose (arms level, palms down), the design held (the pear, three crown rods, the cream
  mask and its two eyes, the belly and knee patches, the cream boots), blocky closed cream gauntlets with nothing in them.
  The other OpenAI sheet drew open fingered hands; both Gemini sheets let the arms hang (no T-pose).
- **sheet-2.jpg** (OpenAI 2): the near arm end-on (the gauntlet seen as a fist), the stout deep pear, the crown rods bunched
  as they are in profile (the other OpenAI side spread them front to back, against the front view).
- What the sheets got wrong against the approved image: slimmer arms and smaller gauntlets (the mesh's gauntlets came out
  as big as the approved ones anyway: no widening), longer legs (the pear's bottom 0.95 m against the drawing's 0.73).

## Tripo

Multiview task `43a873a0-8912-4193-8616-422ba02369ad` (front and back from sheet-1, the left side from sheet-2, each on a
square of its sheet's ground at the same body height; H3.1, texture v3.5 with `delight`, PBR off, 30k faces): 29,356
triangles, 2048² JPEG. Rig check (free): riggable, biped. Rig `8dbd9159-8c2a-404a-a865-51eebf44b222` (v1.0, Mixamo names,
23 joints, no fingers). **Credits: 55** (30 + 25; the three family G generations ran at once, balance 915 → 825 → 750).
Untouched exports and the record in `../../keep-mummerking/tripo/` (`task.json`).

## Preparation (`../familyG-tripo/prepare.mjs mummerking`, its numbers in `foes.mjs`)

The game's frame, 2.7 m to the crown's top (the junk king drew 2.68), centred on its hips; 12,000 triangles by geometry
alone (meshoptimizer, LockBorder), Tripo's weights on every kept vertex; ten k-means clusters given roles by looking (the
probe), each texel repainted in the approved image's flat colour for its part (body `#728b7e`, shin `#4a6a5e`, mask
`#dfd6a7`, crown `#c38337`, glove `#dfd7a7`, boot `#dfd6a8`, cuff `#a26a54`; measured 7 × 7 medians at lit points); the
mask drawn as the drawing's clean oval by geometry (Tripo's was ragged), its two painted eyes painted out and measured
(`landmarks.eyes`); COLOR_0 from the repaint.

## The body (`plans/mummer-king-tripo.js`)

- Rig: Tripo's skeleton posed directly (`tripoBiped`): the humanoid rig's joints where Tripo put them (each limb the two
  sides' mean length), its weights folded onto them, bound in the T-pose, let down to the rig's rest. The gauntlets are
  carried whole on the hands (Tripo blended them across the wrist: their cuff lay 3 cm in a slope as it died).
- The look: the head bone (the gaze node) carries the pear's top, the mask, the crown and the eyes; ±0.6 rad.
- The eyes: two black ovals a little proud of the mask on the head bone, glowing in the wind-up's colour.
- The belly patch and knee pads: clean discs laid on the mesh (vertex colours at 12k triangles drew them blurred).
- The paddle club (the approved image's) in the right gauntlet's centre, held as the door beam was (`KING_HOLD` `beam`:
  its length, reach and swings); the horn slung on its back (no horn in the drawing: the horn call is kept), brought round
  to its mask for the call (`hornDeep`: its pear stands 0.35 m before its spine, so the hands reach further forward).
- Draws: 3 (the body, the rigid parts in one skinned mesh, the eyes); the junk king 11.

## Kept (baseline section 1)

id, kind, its one skin (and its banded tier, the reference's colours dimmed), def and attacks (smash, royal swing, horn,
throw) with every window, the thrown mummer landing dazed, heavy and stout, its Desert site, the sit by the fire, sounds
(`junk` / `mummerking`, unchanged keys and levels), DEATHS (`humanoid`) and the ragdoll on the rig's joints.

## Checks (2026-10-31, this Mac, muted)

- Tests: `tests/mummer-king-tripo.test.js` (new); `mummers`, `humanoid-rig`, `foe-ragdoll`, `foe-hit-defeat`, `part-batch`,
  `foe-heights`, `foe-slide`, `foe-slope` and the affected set.
- Ragdoll, flat and slope: 0.4 / 1.0 cm worst under the ground (`ragdoll-probe.mjs`; the old lay turned its hand to keep
  the paddle's box out of the ground and put the gauntlet 20 cm in: `layApart`).
- Arena warm-up: no new program at its arrival, worst frame 7.4 ms (High).
- Defend (`--near 2.5`): smash and swing block from 0.5 s, parry 0.06–0.12 s (before: the same windows); dodge: the back
  flip off its swing starts a flurry (before: the same).
- Sound levels: on their targets (`foe-levels.mjs --check`, unchanged keys).
- Bench, six in the Arena (`bench-g.mjs`, two rounds, alternating): draws High 272 → 128 (the empty Arena 74: +198 → +54),
  Deck 197 → 101 (+132 → +36); CPU 3.7 / 3.0 → 3.0 / 3.2 ms (noise at load 17–29); triangles +404k → +528k.
- Unity (`-fight humanoids`, editor batch, muted): the Tripo body logged and pictured.

## Still off

The legs are longer and thinner than the drawing's stubby ones (Tripo's reading of the sheets); the mask's middle shades
grey in side light (its own geometry); the horn, kept for the horn call, is not in the drawing.
