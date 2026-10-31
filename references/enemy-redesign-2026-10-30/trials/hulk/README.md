# The hulk (`hulk`), #800 family G

The approved redesign, the root crusher (`../../hulk/69ae4d9f-9bdb-4eab-998a-08bdf543617d-2.png`: an enormous hunched teal
brute, a massive rounded back, a small head low at the front with two short black slit eyes and a dark mouth, a cream chest
and belly, huge arms on rust-red knuckled fists, short thick legs on terracotta-toed feet) is the hulk's body since this
change: `src/enemies/plans/hulk-tripo.js` on `src/enemies/plans/tripo-biped.js`, the asset `public/enemies/hulk/`
(`body.glb` 481 KB, 284 KB gzipped; `skeleton.json`), loaded by `src/enemies/foe-assets.js`. The slate-blue horned hulk stays
in `plans/monster.js` as `legacyHulkModel` (the stand-in while the asset loads). The grunt it throws is not part of this
work. Web and Unity (`-fight humanoids`).

## The T-pose: picked by the agent

As the mummer king's. Prompts `docs/design/enemy-tpose-prompts-family-g.md#hulk-tpose` and `#hulk-tpose-side`; picks in
`../../hulk/tpose/` with their reasons in `manifest.json`:

- **sheet-1.jpg** (OpenAI 1): a true T-pose, the approved brute held (the shoulders, the low head with its slits and mouth,
  the cream belly, the rust hands, the terracotta toes), hands closed and empty; the Gemini sheets drop the arms below level.
- **sheet-2.jpg** (OpenAI 1): the near arm end-on (the knuckles toward the viewer), the head low and forward as in the front
  view, flat colours (the other OpenAI side baked a dark shade down the leg); Gemini's both drew open fingers.

## Tripo

Multiview task `c5f67b39-f93c-4113-9d4e-f987d5f6e0ed` (29,972 triangles); rig check: riggable, biped. **Its v1.0 biped rig
(`3bd03b97-…`, kept as `rigged-1.glb`) put the joints wrong**: the left arm's root right of the middle and its forearm out
left (the arms crossed), the feet behind the legs. Rigged again on Tripo's v2.5 model (`e9f65356-56a9-49e8-af90-70b18c4d43d3`,
the generic `tripo` skeleton, 33 joints, sound): its joints named as the Mixamo ones by where each is (`foes.mjs`
`rename`: the arm chains by the side they are on, v2.5 named the arms' sides the other way round; the clavicles' hubs, the
pelvis's extra bones and the hand tips folded onto the torso and the hands). **Credits: 80** (30 + 25 + 25). Exports and
`task.json` (`rigTries`: the first rig and why) in `../../hulk/tripo/`.

## Preparation and body

`../familyG-tripo/prepare.mjs hulk`: 2.6 m to its hump, 12,000 triangles, six flat colours (skin `#799689`, belly `#d6cea3`,
fists `#ae775b`, toes `#ad7b60`, mouth `#141414`; the painted eye specks painted out), the eyes measured. The body: Tripo's
v2.5 skeleton posed directly; its pelvis at the legs' roots (the v2.5 spine starts 14 cm over them, and the ragdoll's knees
came up into the pelvis's sphere and flung the body 5 m); its head's joint brought 10 cm forward toward the
middle of its low head (the ragdoll's head ball trembled on its long lever and never slept); its chest drawn back 0.15 rad
over the clips (the mesh is hunched already; the clips' lean on top put its face 0.75 m before its hips); its fists whole on
its hands. The eyes: two short black slits on the head bone (Tripo painted two specks). The club: the old banded club,
shorter (1.3 m: a club slanting off its low hanging fist ran 66 cm into a slope), carried with its forearm brought forward,
both fists on it for the smash and the sweep (the other fist's place brought in with the club). No kilt: the drawing has
none. Draws: 3 (the old hulk's 10).

## Kept

id, kind, its Arena-only skin and its banded tier, def and attacks (smash, sweep, the stomp a jump clears, the thrown grunt)
with every window, stout and heavy, the masher's answer (three light cuts in a row: the stomp), sounds (`flesh` /
`monster`), the ragdoll. The stomp's leg swung higher than the old hulk's (its thigh a quarter shorter): the great foot
raised over its knee is the tell.

## Checks (2026-10-31, muted)

- Tests: `tests/hulk-tripo.test.js` (new); `monster-shapes` (the old hulk's sheet checks now on `legacyHulkModel`, its clips'
  phase pinned: `nextDriverSeed`), `wield`, `wield-grips`, `foe-ragdoll`, `foe-hit-defeat` and the affected set.
- Arena warm-up: no new program, worst arrival frame 6.1 ms.
- Defend (`--near 2.5`, 70 s): smash, sweep and stomp block from 0.5 s and parry 0.06–0.12 s (before: the same windows); two
  early evades (0.35, 0.25 s) into the smash hit in the after run, as one into the sweep did before. Dodge: the back flip
  off its sweep starts a flurry (before: the same).
- Sound: on target. Bench, six: draws High 236 → 128 (+162 → +54), Deck 173 → 101 (+108 → +36); CPU 3.0 / 3.2 → 2.7 / 2.4 ms.
- Unity: the Tripo body logged and pictured (`-fight humanoids`).

## Still off

The approved image draws bare fists; the club is kept because the smash and the sweep are a club's swings. Its stomp's
standing foot slides 0.3 m in about half of the clips' phases (the old hulk's too: the stance's blend from a walk that left
it mid-step); `tests/monster-shapes.test.js` pins the phase. Its belly's edge reads a little ragged up close (vertex
colours at 12k triangles).
