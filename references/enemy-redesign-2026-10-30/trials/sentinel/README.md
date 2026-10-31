# The sentinel (`sentinel`), #800 family G

The approved redesign, the cistern keeper (`../../sentinel/395884ff-9eec-4903-ba5c-e910310ff88d-0.png`: a squat heavy
ceramic robot, a pale pink barrel with one seam round it, a short cylinder head on its top front with a black visor slit and
one amber eye, purple-black ball joints, pink ceramic limbs, a dark slate pelvis band, slate-blue shins on broad pointed
feet, dark grey fists, a big oval shield on its left arm, a short blade in its right fist) is the sentinel's body since this
change: `src/enemies/plans/sentinel-tripo.js` on `src/enemies/plans/tripo-biped.js`, the asset `public/enemies/sentinel/`
(`body.glb` 510 KB, 269 KB gzipped; `skeleton.json`), loaded by `src/enemies/foe-assets.js`. The slim duelling droid stays
in `plans/sentinel.js` as `legacySentinelModel` (the stand-in while the asset loads). Web and Unity (`-fight humanoids`).

## The T-pose: picked by the agent

As the mummer king's (the author asleep: the agent picks, the author can override). Prompts
`docs/design/enemy-tpose-prompts-family-g.md#sentinel-tpose`, `#sentinel-tpose-side` and `#sentinel-tpose-side2`. Picks in
`../../sentinel/tpose/` with their reasons in `manifest.json`:

- **sheet-1.jpg** (OpenAI 1): a true T-pose with every part of the approved robot in its place, plain open grey hands; Gemini's
  first let the arms hang, its second and OpenAI's second cut the arms into more segments than the drawing has.
- **sheet-2.jpg** (OpenAI 1 of the second side run): the first side run drew the near arm pointing backwards (not a T-pose)
  and Gemini refused it (`PROHIBITED_CONTENT`); the second, with the picked front sheet as a second reference and the arm
  described end-on, has the shoulder ball and fist end-on, the head on the barrel's top front, the foot pointing ahead.
- Against the approved image the sheets drew slimmer limbs than its thick cylinders, and no elbow balls.

## Tripo

Multiview task `e57405cc-261b-456c-b831-5b2f1d6e0004` (28,562 triangles), rig check: riggable, biped; rig
`10734146-7d54-465b-a689-ff856146d442` (v1.0, Mixamo, 23 joints). **Credits: 55.** Exports and `task.json` in
`../../sentinel/tripo/`.

## Preparation and body

`../familyG-tripo/prepare.mjs sentinel`: 2.0 m to its head's top (the old droid's 2.01), 11,994 triangles, six flat colours
(ceramic `#e5c7b4` folding Tripo's grey shading in, joints `#524d5b`, fists `#3f4a48`, pelvis `#3f5753`, shins and feet
`#819696`, visor `#141414`), the visor slit measured (`landmarks.visor`). The body: Tripo's skeleton posed directly; the fists
carried whole on the hands, the feet under 12 cm whole on the ankles (`soles`: Tripo's blend bent them and a heel went 3 cm
into a slope); its legs the clips' own (a splay laid over them slid its planted feet: 0.04 → 0.003 m a metre walking).
The eye: one amber lens in the visor slit on the head bone (its light: `droidGlow`, the wind-up's flare, stunned blue,
overloaded red; its scorched tier's red). The shield: the drawing's big oval ceramic dish (0.72 × 1.1 m) on the left forearm,
kept facing out before it as before (square in its guard, drawn back for the bash, flung out when broken). The blade: a
brown leaf on a dark haft, the old blade's length and hold (`SENTINEL_HOLD`). Draws: 3 (the old droid's 6).

## Kept

id, kind, its Arena-only skin and its scorched tier (`DROID_TIER`'s ceramic and joints), def and attacks (thrust, cut, bash,
dash, riposte) and every window, the shield guard (`guard`: two stings snap it up, the third blow parried and answered with
the riposte; a charged cut breaks it), the turtle's bash, sounds (`ceramic` / `machine`, `sentinel` steps), the ragdoll.

## Checks (2026-10-31, muted)

- Tests: `tests/sentinel-tripo.test.js` (new) and the affected set (foe-slide: walk 0.003, strafe 0.011 m a metre).
- Arena warm-up: no new program, worst arrival frame 5.9 ms.
- Defend (`--near 2.5`): thrust blocks from 0.5 s, parries at 0.12 s; cut 0.5 s, 0.06–0.12 s; bash blocked at 0.5 s (before:
  thrust blocked to 0.3 s, cut and bash parried 0.06–0.12 s: one try a lead, so the parry cells differ by sample). Dodge: the
  back flip off its dash goes off, no flurry (the same before).
- Sound: on target. Bench, six: draws High 182 → 128 (+108 → +54), Deck 137 → 101 (+72 → +36); CPU 3.3 / 2.8 → 2.8 ms.
- Unity: the Tripo body logged and pictured (`-fight humanoids`).

## Still off

Its limbs are slimmer than the drawing's thick cylinders and it has no elbow balls (the sheets'); the darker patches on its
barrel in the stills are the game's light and hatching over Tripo's dents (its colours are one flat pink: test).
