# Family H on Tripo bodies (#800): the two-legged foes

The roster's two-legged foes rebuilt one at a time by the skill's recipe (`.claude/skills/enemy-rework/references/
tripo-rebuild.md`, the dune mummer's route: T-pose sheets from the reference lab, multiview, Tripo's biped rig posed
directly by the clips, never a hidden copy), each landed in the game replacing its archetype's body. The replaced builder
stays in the repository under a legacy name, standing in while the new body loads, so its look can come back as a foe of
its own.

## The scripts

| Script | What |
|---|---|
| `generate.mjs <prowler\|warlord> [--dry]` | the Tripo multiview generation from the picked T-pose sheets (front and back cut from `tpose/sheet-1.jpg`, the left side from `sheet-2.jpg`, each on a square of its own cream at one body height; a view drawn facing the other way sent mirrored), H3.1, texture v3.5, Remove Lighting, 30k faces; then the free rig check and Tripo's biped rig (Mixamo names). The untouched exports, the views as sent and `task.json` (credits, the balance before and after) into the concept folder's `tripo/` |
| `prep-biped.mjs` | the shared prepare: the game's frame **centred on the hips** (the rig stands its torso over its origin, the ragdoll lays the body under its pelvis), decimated by geometry alone, k-means of the texture with each cluster's part, **the parts' borders cut exactly on their lines** (`cutAlong`: a field of the place, or a role's own border smoothed through Tripo's ragged edge; the vertices on a cut made twice, so a flat vertex colour stops on the line), the texture repainted by part, the painted eyes and marks measured and painted out, COLOR_0, the joints, the hands' centres; writes the trial's `<foe>-lod.glb` / `<foe>-texture.png` and the game's `public/enemies/<id>/body.glb` (16-bit indices, no picture, no UVs) and `skeleton.json` |
| `prepare-<foe>.mjs` | one foe's own: its height, colours, cuts, eyes, marks, and (the prowler) its tail's joints |
| `../../../../src/enemies/plans/biped-tripo.js` | the shared rig: humanoidSkeleton's joints stood on Tripo's, its weights folded onto them (a body's own joints onto the bones it gives), bound in the T-pose, let down to the rig's rest |

## The prowler (`prowler`): the pod stalker

Reference: `../../prowler/5d011893-58f1-4c33-a34d-ac8df1a99842-2.png` (approved; "Selected prowler: low ambush stance and
broad limbs"). Its one skin is the Arena's (`desert`).

**The T-pose (picked by the agent: the author, "you can do the t-pose yourself"; he may pick again).** Prompts in
`docs/design/enemy-tpose-prowler-prompts.md` (front and back 16:9, the left profile 1:1, the approved image as the
reference), the lab's default providers, two each. Picked: GPT Image 2 for both (`../../prowler/tpose/sheet-1.jpg`,
`sheet-2.jpg`, `manifest.json` with every candidate's id): a strict T-pose (both arms level, open hands with straight
fingers, nothing held), legs straight, the design held (the cream muzzle and its mouth line, the dot eyes, the sage belly,
the padded three-toed feet, the wrinkled wrists and ankles) and the tail straight back along the ground in all three
views, one model so the views agree. Gemini's two drew heavier bodies, nearer the approved mass, but with the arms
sloping down and the tail swung off to one side in front (Tripo would have built a crooked tail). The side view faces
right; it was sent mirrored as the left view (the body is symmetric). Against the approved image the sheets drew it
upright (its hunch is the clips': `PROWLER_STANCE` leans it forward) and a little slimmer.

**Tripo:** multiview task `283212a4-4ece-4891-8f99-2a1682b2b69f` (30 credits; 29,664 triangles, 17,281 vertices), rig
check (free): riggable, biped; rig task `97ca2b8c-6833-462e-938c-4f2d88444a97` (25 credits): 23 joints, Mixamo names, no
fingers, no tail (its tail hangs on the hips). **55 credits** (the balance 725 → 615 over both family H foes' runs, other
agents generating at the same time). The untouched exports in `../../prowler/tripo/`.

**Prepared** (`prepare-prowler.mjs`): 1.9 m to its crown in the T-pose (it stands about 1.8 m in its stance, the legacy
lizard's 1.85 m), centred on its hips (Tripo centred the box, the long tail behind put the hips 34 cm ahead of the
origin: the ragdoll laid the body 34 cm off its particles and it lay 8 cm in the ground), 12,644 triangles (12,000
decimated, the cuts adding the rest). Four flat colours, the approved image's own: the dusky mauve skin `#926456`, the
cream muzzle `#dcc99b`, the sage belly `#767957` (throat to between the legs and under the tail), the ink `#1a1210`;
Tripo's three skin clusters and its darker folds and specks (the k-means' ink off the face) folded into the skin; the
muzzle's and the belly's borders cut clean (their own borders smoothed five times). The painted eyes (two black dots high
on the head) and the mouth line painted out and measured: the game draws its own (two ink-black eyes that flare in a
wind-up, an ink line on the head). **The tail:** Tripo rigs none, so its centreline is measured from the mesh (the
slabs behind the hips: each one's middle, from the root at the back of its rump to the tip on the ground), resampled
into five segments of 0.236 m; five joints are added after Tripo's 23 (`Tail0`…`Tail4`), and every vertex behind the
root under the hips' height (led by the hips) is weighted to them by where it lies along the line, blended a quarter
segment either side of each joint and into the hips at the root; its girth at each joint kept (`tail.radius`).

**In the game** (`src/enemies/plans/prowler-tripo.js` `tripoProwlerModel` on `biped-tripo.js`; the legacy lizard is
`monster.js` `legacyProwlerModel`): Tripo's joints posed by the clips with the legacy's moves (`PROWLER_MOVES`), stance and
holds; the curved blade (its slash and its dart: what it wields, kept; ×1.25 for Tripo's broad hands) through the right
hand's measured centre (Wielder `at`); the tail on its five bones sprung (`TailSpring`: lashing in a wind-up, straight
out at knee height in the tail sweep, curled in the back-flip, its rest the measured line with the stance's lean taken
back at the root, kept its own drawn girth off the ground and, lying, out of the walls round it: `keepOut`); the look on
Tripo's head bone (0.55 rad), the dot eyes sliding the rest of the way; the spit lobbed from its mouth. Its broad pads:
with the clips the traveller's narrow foot, tipped by the knees' bend and its own roll, put a pad's edge 5.6 cm in the
ground standing, so the feet are counter-turned for the stance's knee bend, held flat while planted (`J.flatFeet` 0.8)
and the ball never under the ground (`J.ballOnGround`; both `src/enemies/humanoid-rig.js`, opt-in), the pads stiff under
8 cm (`soles`) and the whole body raised by its deepest sole corner under the ground (`biped-tripo.js` `soleUp`, at most
6 cm: on a 14° slope a pad's heel went 3 cm in): standing −0.8 cm, walking at worst −1.3 cm (−5 before; the legacy
grunt's −4). The blade's reach is scaled with it and its curve kept off the ground (`head` 0.12 m: its point went 5 cm
into a slope). Three meshes: the body, the blade and the mouth line, the
eyes. Tests: `tests/prowler-tripo.test.js`.

**Kept:** the id, the `desert` skin (its palette the approved colours now; the legacy lizard, standing in, wears them
too, its old leaf-green written in `skins.js`), the def (hp 5, slash, dart, tail sweep on the ground, spit lob, circling at
3.4 m, the back-flip out of a combo, the rage), the windows, its sounds (`scale`, `monster` steps), the ragdoll
(#750/#794), the Arena's waves and foe list. The legacy's steel shoulder guard and its strap are gone (not in the approved
design; never armour).

**Checked** (31 October 2026, this Mac, Apple M4 Pro, Chrome on Metal headless and muted; the machine shared):

- *The Arena's warm-up* (`../familyE-tripo/warm-check.mjs prowler`): no new GPU program at its arrival, the worst frame
  4.9 ms.
- *Defend* (`.claude/skills/combat-review/defend.mjs --kinds prowler --near 2`): the guard holds from 0.5 s on the slash,
  the dart and the tail sweep; the parry at 0.06–0.12 s (dart) and 0.12 s (tail sweep); an evade at 0.35 or 0.25 s before
  the dart lands is caught by its lunge (the def's, unchanged). *Dodge* (`dodge.mjs`, back flip and `--side`): both
  start a flurry off its blows.
- *Sound* (`scripts/sound-qc/foe-levels.mjs --check`): its voice (`scale`) and steps (`monster`) on their targets
  (alert −7, cry −8, bark −10, idle −15, death −6, step −21 dB); its sound keys unchanged.
- *Bench* (six prowlers in the Arena against the empty Arena, two rounds each, before at 013023daa and after
  alternating, load 3.8–13.4): draws added High 126 → 54, Steam Deck 84 → 34; script time High 1.05 → 0.70 ms, Deck
  1.00 → 0.95 ms; triangles every pass High 155.5k → 248.1k, Deck 103.6k → 164.2k; the frame 16.7 ms throughout; the
  GPU's time not separable at this load. The body is a 539 KB download (16-bit indices, no picture).
- *Tests:* `tests/prowler-tripo.test.js` (new), `tests/prowler-warlord.test.js`, `tests/monster-shapes.test.js` (the
  legacy lizard's head measured on `legacyProwlerModel`), `tests/foe-ragdoll.test.js` (all, unchanged thresholds),
  `tests/foe-hit-defeat.test.js`, `tests/foe-heights.test.js`, `tests/part-batch.test.js`.

**Still off:** its body is a little slimmer than the approved mass (the sheets drew it so); Tripo's sage flap between its
legs (the tail seen through the front sheet's legs) is kept, on the tail's root. The Unity picture was taken just before
`soleUp` (it raises the body by at most a few centimetres on slopes); the web pairs after it.

## The warlord (`warlord`): the resonator chief

Reference: `../../warlord/b7d9aa56-69bf-44a7-becc-6a2e9737b4bf-2.png` (approved; "Selected warlord: compact throat chamber
calls the pack; no cape"). Its one skin is the Arena's (`desert`); its band of grunts (the Arena's wave
`['warlord', 'grunt', 'grunt']`, the warlord-hold site's camp) is as it was.

**The T-pose (picked by the agent).** Prompts in `docs/design/enemy-tpose-warlord-prompts.md`, the lab's default
providers, two each, and a second side batch. Picked: GPT Image 2 for both (`../../warlord/tpose/`, `manifest.json`):
the front and back a strict T-pose, flat open cream hands, nothing held, legs straight, the design held (the egg that is
head and torso, the ear knobs, the heavy-lidded slit eyes, the cream throat chamber, the salmon belly, the plum shoes);
Gemini's fronts sloped the arms down. Every side view drew the near hand end-on as a fist; the retry asking for a flat
open hand turned the arms forward instead, so the side picked is the first batch's cleanest T-pose (straight-legged,
facing left) and the open hands of the front and back lead (Tripo made mittens either way). Against the approved image:
the staff left out (Tripo models empty hands; the game builds it); the belly's salmon patch, on the sheets, was lost in
Tripo's texture and is painted back by place.

**Tripo:** multiview task `3216cc93-6b2d-44f7-8801-4b402b85455d` (30 credits; 29,090 triangles), rig check (free):
riggable, biped; rig task `7a282536-4587-4df4-91f2-d265dfb2f3d7` (25 credits): 23 joints, Mixamo names. **55 credits.**
The untouched exports in `../../warlord/tripo/`.

**Prepared** (`prepare-warlord.mjs`): 2.5 m to the egg's top in the T-pose (its def's height), centred on its hips,
12,956 triangles. Four flat colours: the brick red-orange `#c75c3f` (Tripo's four oranges folded in), the cream throat
chamber and hands `#e4c89b`, the plum shoes `#51304a`, the salmon belly `#dc7a54` on an oval on the egg's front (its
edge a field the mesh is cut exactly on, `cutAlong`); the cream's and the shoes' borders cut on their own smoothed lines.
The painted slit eyes painted out and measured (8–10 × 2.5–3 cm). Each limb's girth measured (`limbs`), for its plates.

**In the game** (`src/enemies/plans/warlord-tripo.js` `tripoWarlordModel` on `biped-tripo.js`; the legacy crimson lion is
`monster.js` `legacyWarlordModel`): the legacy's moves (`WARLORD_MOVES`: sweep, overhead, charge, roar, whirl), stance
and holds (`WARLORD_HOLD`); **what it wields is the approved picture's**: the forked iron staff (the resonator, a
tuning fork's two prongs on a crossbar, 2.4 m, the glaive's length and hold) through the right hand's measured centre;
its four bronze plates (`ARMOUR.warlord`, in their order: the right shoulder, the left, the right greave, the left)
fitted to the upper arms' and shins' measured girth, each its own mesh so it can be knocked off; the look on Tripo's head
bone (0.6 rad), its two slit eyes on it sliding the rest of the way; its arms a little out from its round flanks; the
broad shoes on the ground (`flatFeet` 0.8, stiff `soles` under 10 cm, `soleUp`; not the prowler's `ballOnGround`: the
ball held up out of the clip's height dragged its long shoes 0.14 m through a strafe, over `tests/foe-slide.test.js`'s
0.12). A planted foot flattened by `flatFeet` now turns about its ball, not its ankle (`humanoid-rig.js`): turned about
the ankle the ball slid, the warlord's run 0.022 m a metre against the test's 0.02; now walk 0.010, run 0.003, strafe
0.014, turn 0.047 a radian (the prowler's walk 0.009, run 0.007). The roar's tell its head
(the arms flung wide, the head thrown back). In play its weapon is called the staff now (its moves, tells and note;
the horns and the mane are gone from its tells). Seven meshes (the body, the staff, the eyes, four plates; the legacy
lion's twelve). Tests: `tests/warlord-tripo.test.js`.

**Kept:** the id, the `desert` skin (its palette the approved colours; the legacy lion, standing in, wears them too),
the def (hp 12, the attacks and windows, the roar that wakes every one within 25 m, the last stand below a share of its
health, its plates), its sounds (`hide`, `monster` steps), the ragdoll (#750/#794), its band.

**Checked** (31 October 2026, this Mac, as the prowler):

- *The Arena's warm-up*: no new GPU program at its arrival, the worst frame 5.9 ms.
- *Defend* (`--kinds warlord --near 3`): the guard holds from 0.5 s on the sweep and the overhead, the parry at
  0.06–0.12 s (sweep) and 0.12 s (overhead); the charge and the whirl did not come within the run's time. *Dodge*
  (back flip and `--side`): both start a flurry off its charge.
- *Sound*: its voice (`hide`) and steps (`monster`) on their targets; its keys unchanged.
- *Bench* (six warlords in the Arena against the empty Arena, two rounds, before at the prowler's commit 6bbffafbc and
  after alternating, load 7.5–13.5): draws added High 216 → 126, Steam Deck 144 → 82; script time High 1.10 → 0.95 ms,
  Deck 1.10 → 0.75 ms; triangles every pass High 237.3k → 269.8k, Deck 158.6k → 178.2k; the frame 16.7 ms throughout.
  The body is a 536 KB download.
- *Unity* (`scripts/unity-js-run.sh familyH-warlord -mute -level arena -fight warlord`, the build lock held): the Tripo
  body, its four plates, the staff; the overhead's wind-up pictured; against the web's, the same (taken just before its
  feet settings were last changed: the web pairs after).
- *Tests:* `tests/warlord-tripo.test.js` (new), `tests/prowler-warlord.test.js` (the warlord's head at its eyes),
  `tests/monster-shapes.test.js` (the lion's horns on `legacyWarlordModel`), the ragdoll, defeat, slope, heights and
  batch tests unchanged.

**Still off:** walking, a shoe's toe dips up to 12 cm into the ground for a frame or two at a toe-off (standing
−1.8 cm): turning a swinging shoe back toward flat lifted it out but made its feet slide past the test's 0.06 a radian
turning on the spot, so it was left out; the salmon belly's oval reads a little patchy under the game's light in some views (the egg's own
shading over it); the pauldrons sit high on the egg's shoulders, close to the throat chamber in a three-quarter view;
the throat chamber does not swell for the roar (its weights straddle the head and the body: the roar's tell is its
head thrown back, as before).
