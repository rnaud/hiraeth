# The pearl roller (`roller`), #800 family D

Reference: `../../keep-roller/f586ce93-9d9c-4203-a22c-2731075f1065-1.png` (approved: "snail plus pearl: a smooth round shell
and broad muscular foot; retracts to roll. Favour fewer shell lines"). Straight to the Tripo route (no direct body); it
replaces the roller's steel snail in the game, which stays as `legacyRollerModel` (src/enemies/plans/roller.js).

- **Generation:** Tripo task `bac43175-5270-46f9-a047-cdb348ab423d`, image to model, H3.1, texture v3.5 with Remove
  Lighting, PBR off, 30k face target: 29,268 triangles, 2048²; **30 credits** (balance 1,275 → 1,245). Untouched in
  `../../keep-roller/tripo/` with `task.json`. It read as its reference (the pale coiled shell, the wrinkled olive foot, the
  terracotta face, two eyes on stalks) but faced its own -z and modelled the drawing's shadow as a flat puddle round its foot.
- **Prepare** (`../roller-tripo/prepare.mjs`, `facing: '-z'` and `drop` in `../machine-tripo/prep.mjs`): turned onto +z; the
  puddle left out (the sheet under 3.5 % of its height outside the foot's outline measured just above the ground, a
  triangle with any corner on it dropped); scaled so the shell's fitted radius is the roller plan's 0.7 m (1.37 m tall:
  its roll still locked to the ground at angle = distance / 0.7); 12,000 triangles by the geometry alone; parts by geometry:
  the eyeballs (spheres fitted to their cream), the head (a sphere fitted to the terracotta under them; the shell's rim over
  it kept off by which sphere a face faces out of), the stalks, the shell (on its fitted sphere over the foot), the foot in
  three lengths (planes across it, blended 10 cm). Repainted flat in the reference's sampled colours (shell `#dbe6cc`, its
  lines `#465646`, foot `#a5ab82`, folds `#57694a`, head `#d68c6a`, eyes `#ece1b1`). `public/enemies/roller/body.glb`
  and `landmarks.json`.
- **Rig and motion** (`src/enemies/plans/roller-tripo.js` on `plans/tripo-rigid.js`, the kit's `roller` plan): the shell
  spins locked to the ground; the foot ripples back along its three lengths by the distance glided; the stalks lag, sway
  and sink for a wind-up; rolled up, the soft parts' bones shrink into the shell's middle. Each eyeball turns on its stalk's
  tip to look at you (tested both sides), its pupil its own part. The spiral is its own fine line on the side the shell
  coils (glowing for the pearl, the ricochet and the last roll).
- **Kept:** id, def, bowl, ricochet and last roll with every window, the bounce off a guard, the walls, the last roll's
  ring, the bubble, the glistening trail, every skin (the Garden's pearl glow, wind-up key and rocking runners), the
  sounds (its plan's and the shell voice, unchanged), death (its shell recipe, unchanged), the Arena warm-up.
- **Checks:** Arena arrivals: typical 16.8 ms, one 33.3 ms first arrival (the Mangrove's), no new programs. Defend with
  `--near 4`: see the commit; dodge: the back flip off its bowl starts a flurry. Bench (six pearl rollers, the Garden of
  Spheres): draws 397 → 366 (High), 294 → 268 (Deck); CPU 6.0 → 5.3 ms (High) and 5.1 → 4.7 ms (Deck), the medians of two
  runs; triangles +5.5 %. Tests: `tests/roller-tripo.test.js`, archetypes-batch5 (its roll locked to the ground).
- **Still off:** the shell's lower edge meets the foot in a ragged line of Tripo's folds; the stalks are short (Tripo's),
  the eyes sit close to the face.
