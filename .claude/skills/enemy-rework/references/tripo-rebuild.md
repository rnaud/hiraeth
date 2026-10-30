# Rebuilding a foe from its approved reference with Tripo (#800)

What the four trials taught (shellback, hound, wood cutter, dune mummer; the author picked Tripo for all four, each
after fixes, 2026-10-30). The trials' own record, with every number and picture, is
`references/enemy-redesign-2026-10-30/trials/README.md`; the scripts named below are there. Copy the closest trial's
folder for a new foe and change its constants: they are deterministic, one file a step.

Read first: the issue (#800) and its comments, `docs/handoffs/enemy-rebuild-2026-10-30.md` (scope, art contract) and
`-baseline.md` (section 1: what each archetype keeps), `tools/enemy-review-references.js` (the approved image per
concept, zero-based index), `.agents/skills/hiraeth-ai-characters/` (the character pipeline's general rules).

## 0. Inputs and gates

- The approved original: `references/enemy-redesign-2026-10-30/<concept>/<job>-<index>.png`, unchanged. Never an
  unselected variant; two liked alternatives (the grunt, the dew gatherer) wait for the author's choice.
- **Humanoids need a picked T-pose first** (no credits before). Write the prompts in a `docs/design/…-prompts.md`
  with a `Target folder: \`references/enemy-redesign-2026-10-30/<concept>/tpose/\`` line (template:
  `docs/design/enemy-tpose-prompts.md`: front and back side by side 16:9, a left profile 1:1, strict T-pose, empty
  open hands, flat even light, no props, plain cream ground). It is derived work, so pass the approved image:
  `node scripts/gen-reference.mjs --from docs/design/<doc>.md#<id> --refs references/enemy-redesign-2026-10-30/<concept>/<approved>.png`.
  The author picks in the reference lab; commit the picks as `tpose/sheet-1.jpg`, `sheet-2.jpg` with the lab's
  `manifest.json` (prompt, refs, provider, cost). Note what the sheets got wrong against the approved image (the
  mummer's sheets drew narrower hands: the approved broad mittens were kept, by widening in prepare).
- Non-humanoids and machines: the approved image alone, if it shows the whole body (every leg, the tool arm). If it
  hides one, a neutral standing rest view from the lab the same way, picked by the author.
- **Credits:** about 30 a generation, 25 a Tripo rig (the rig check is free); 30–55 a foe. Stop and report at the
  credit floor the current brief gives (~400 on 2026-10-30). Fixes reuse the export: no new generation.

## 1. Generation (`<foe>-tripo/generate.mjs`)

Copy `shellback-tripo/generate.mjs` (one image) or `mummer-tripo/generate.mjs` (multiview, then the rig). Through
`scripts/reference-lab/providers/tripo.mjs` (`balance`, `upload`, `runTask`, `fetchOutput`); the key
`TRIPO_3D_API_KEY` read from the main checkout's `.env` (`HIRAETH_ENV` to point elsewhere), **never printed**.

```js
const BODY = { model: 'v3.1-20260211', texture: true, pbr: false, texture_quality: 'standard',
  texture_version: 'v3.5-20260815', delight: true,          // delight = Remove Lighting (read by texture v3.5 only)
  texture_alignment: 'original_image', face_limit: 30000, export_uv: true };
```

- One image: `POST /generation/image-to-model` `{ input: token, ...BODY }`.
- Humanoid: `POST /generation/multiview-to-model` `{ inputs: [{ front }, { back }, { left }], ...BODY }`, each view cut
  from its picked sheet to the body box, centred on a square of the sheet's own cream, the body 72 % of its height,
  1024²; the views as sent saved beside the export (`view-*.png`).
- Rig, when the family uses Tripo's (section 3): `/animations/rig-check` (free; read `riggable`, `rig_type`), then
  `/animations/rig` with `{ input: <generation task>, model: 'v1.0-20240301', rig_type: 'biped', spec: 'mixamo' }`
  (humanoid) or `{ model: 'v2.5-20260210', rig_type: 'quadruped', spec: 'tripo' }`, `out_format: 'glb'`.
- The untouched exports (`model.glb`, `rigged.glb`, `preview.*`) and **`task.json`** go to
  `references/enemy-redesign-2026-10-30/<concept>/tripo/`. task.json records the source path and sha256, endpoint,
  request, task id, start and finish, `creditsConsumed`, `balanceBefore` / `balanceAfter`, each file's bytes and
  sha256; the rig's the same under `rig` (and `rigCheck`). The script refuses to run again once task.json exists.
- `--dry` first (prints the balance, writes the views). Inspect the export (`shellback-tripo/inspect.mjs`) before
  rigging: a missing or merged leg, a fused tool, a wrong face is the input's fault: fix the input, not the mesh.

## 2. Preparing the mesh (`<foe>-tripo/prepare.mjs`)

Writes `tripo-lod.glb`, `flat-texture.png` and `landmarks.json` (or `skeleton.json`) beside it; deterministic.

1. **Into the game's frame:** Tripo's +x ahead → the game's +z (rigged exports are already +z), feet on y = 0, scaled
   to the intended height (the direct body's constant, or the author's size), centred between the feet when a tool
   sticks out (Tripo centres the box).
2. **Cut parts by geometry, never by colour.** A colour border is not a seam: the shellback's dome cut by colour ran
   ragged half down the dome. Cut where the shape says: the dome's outermost point per azimuth smoothed into a curve
   (a low Fourier series), a fitted sphere for a head, a plane across each limb at each joint (normal to the bisector
   of its two segments); split every triangle across the cut exactly on it; write the triangles grouped by part
   (`landmarks.parts: [first, count]`). Drop what the model rebuilds (Tripo's muddy saw hand, its tiny horns: welded
   onto the nearest skull vertices round the root, so no hole).
3. **Repaint by part in the reference's flat colours.** Median filter, then each texel's *role* (by hue and
   lightness, a 7 × 7 majority over crease specks; or k-means clusters each given a role), painted in the
   reference's own colour for that part (the direct body's home palette, or measured off the approved image): one
   flat colour a role. Fold Tripo's shades (a second ochre, an olive band, a dark border) into their role; paint out
   thin painted folds and **the painted eyes** (they become their own parts). **Fill the texels between UV islands
   from the nearest island** (breadth first), or other colours bleed in at the small mips. Keep a swatch of each
   added part's colour where no triangle draws (`landmarks.swatches`) so added parts share the texture.
4. **Baked shading out:** Remove Lighting is not proof. Look at the texture unlit (the trial page's clay toggle) and
   lit from both sides; what darkens one side in the clay view too is the game's light, not the texture.
5. **A 10–15k triangle LOD** (12,000 in all four) with meshoptimizer `simplifyWithAttributes(…, ['LockBorder'])`,
   **by geometry alone**: weighting colour borders kept the creases' noise as saw-toothed folds that shaded dark (the
   wood cutter). UV seams kept; skin weights ride on the kept vertices; regenerate indexed data after.
6. **COLOR_0** sampled from the repainted texture: the engines' VMs decode no PNG/JPEG, so Unity draws the vertex
   colours.
7. **Texture 512–1024².** Flat colours need no more: the shipped crab is 512² (1.33 MB with mips against 5.33 at 1024²).
8. **Landmarks measured from the mesh** (or the rig's inverse binds), never guessed from the direct body: hips, knees,
   ankles, feet; claws' knuckles; eye recesses; the dome's lip; the head's sphere; each cut's ring; a tool's hub.

## 3. Rigs by family (`<foe>-tripo/model.js`)

| Family | Rig | Trial |
|---|---|---|
| Many-legged | **A custom skin on the game's leg system**: the kit's walker legs fitted to the measured landmarks, thigh, shin and foot bones framed in each leg's bend plane (`SkinLegs`, `src/characters/creature-legs.js`, the Keeper's route), every vertex weighted to its nearest part, blended over ~5 cm at the joints. No Tripo rig, no humanoid skeleton. | shellback |
| Four-legged | **Tripo's quadruped rig for its weights only**: gather each Tripo joint onto the game bone along the same stretch (body, neck, head, tail joints, each leg's thigh, shin, foot), sum, keep the four largest, normalise. Do not trust its skeleton (54 joints, a leg twice, stray tail branches). The kit's quadruped legs on bend-plane bones fitted to the rig's joints. | hound |
| Machine | **Rigid parts cut at the joints**, each vertex 1 on its part's joint, **blended across each cut** (~9 cm either side, the same weights for the corners either part has there) so a bent joint stays closed; a dark ball inside each joint; the head turning about its fitted sphere's centre (no gap at the collar). As it dies the blends let go: it comes apart into clean parts (`src/enemies/debris.js`). | wood cutter |
| Two-legged | **Tripo's biped rig posed directly by the clips**: `humanoidSkeleton`'s joints stood where Tripo put its joints, the mesh skinned to them with Tripo's own weights (its spine, hips, clavicles folded onto the torso, neck and head onto the head, toes onto the feet), bound in the T-pose then let down to the rig's rest; `HumanoidDriver` and the archetype's MOVES/HOLD pose those very bones. **Never a hidden copy** retargeted over (#768's adapter). | dune mummer |

Floating, rolling or other plans: take the nearest family (rigid parts for anything that does not bend) and say why
in the foe's README. Check every skin: weights normalised, bind round trip < 0.1 mm, a joint bent alone moving only
its own vertices, widest seam at a bent joint < 0.1 mm.

## 4. Must-haves on every rebuilt body

- **Gaze (the author's rule):** the eyes or the head their own parts, turned toward the traveller by
  `src/enemies/gaze.js` (`gazePart(root, obj, { mode: 'turn' | 'lean' | 'slide', yaw, up, down })`): a face or head
  bone that turns, eyes that slide the rest of the way. Slit eyes of the painted ones' measured size, a little proud of
  the surface (or plugs filling Tripo's recesses), on that bone. Test both sides.
- **Moving parts on their own bones:** a claw's blade and inner finger hinged at the knuckle (the jaw opens and shuts
  in the snap), a jaw, a tail. Test open > 1.3× rest, shut < 0.6× open.
- **Tools separate from the hand:** cut Tripo's fused tool off at the wrist and build each world's own on it
  (`WOODCUTTER_TOOLS`), in the same skinned mesh where it can be (no extra draw), a spinning disc on its own joint.
- **Sockets and grips held through every clip:** a weapon through the hand's measured centre (`Wielder` `at`),
  sampled every 0.1 s through idle, walk, run, each attack and the hurt, under 0.35 of the hand's radius (test).
- **Skin props per world:** each skin's palette over the part roles (vertex colours), its dress fitted to this mesh
  (hung from a measured vertex, skinned on that vertex's own weights so it moves with it), every skin in pictures.

## 5. The keep checklist (baseline section 1)

- [ ] id, `kind`, every skin id in `SKINS[id]`, DEATHS entry, GROUP/COSTS/FROM (`foe-worlds.js`), chimes, gallery
      (`enemies.html`), bestiary names.
- [ ] Size (#741): GROWN scales, radius/height/hover; `tests/foe-heights.test.js`; reach still past the body.
- [ ] Fight core: attack ids, wind-ups (`WIND_MIN`), windows, `tell(attackId)` on the striking part, cues; only lobs
      mark the ground; guards, tiers, weak points, immunities, parry effects. Hit shapes refitted to the new anatomy;
      reach rescaled when the size changes, windows untouched (`woodcutterDef` via `trialDef`).
- [ ] Sounds (#771): calls, efforts and blows by `attackSort`, steps timed to the real foot contacts, mix caps, trims.
- [ ] Death and bodies: the DEATHS recipe, ragdoll on the rig's joints fitted to the hull, the lying footprint,
      debris for machines (materials disposed).
- [ ] Arena warm-up (#797): every skin warmable at load, no lazy program variant at the blow; `Foes.buildAhead`.
- [ ] Model contract `{ group, body, rig, parts, eyeMat, size, tones, tell, anim, dispose }`; draws batched within a
      joint, never across.
- [ ] Surfaces and skins: `SURFACES[id]` and each skin's palette and props.
- [ ] Unity parity: vertex colours (COLOR_0), the body copied for the player, a picture against the web.

## 6. The trial harness and the evidence each foe needs

`PORT=54xx node references/enemy-redesign-2026-10-30/trials/serve.mjs`, then
`/references/enemy-redesign-2026-10-30/trials/arena.html?foe=<kind>&variant=current|direct|tripo|side&mode=…&cam=…`
(never 5173; muted before the Sound is built; `side` puts the variants 3 m apart on one clock; the clay toggle).
Add the foe to `variants.js` (`TRIALS`, `BUILD`: `use(kind, variant)` stands it in through `TRIAL_BUILDERS`, empty in
the game). Evidence, all re-shot after any fix, each picture looked at:

- **Strips and stills:** `baseline/baseline-shots.mjs --variant <v> --extra` (idle, walk, turn, attack, hurt, death;
  3q, front, flank, rear, clay); `sheet.mjs` beside the approved reference.
- **Gaze shots:** `gaze-shot.mjs` / `gaze-one.mjs` (the traveller off to one side, each body's yaw toward him).
- **Close-ups** of what moves or holds (`<foe>-tripo/closeups.mjs`: the jaw in the snap, the mittens, the mask).
- **Walk audit:** `motion-audit.mjs <kind>@<skin>`: slide m/m and worst at full and half pace, reach, lift, cadence;
  the pounce (planted-foot slip, bracing steps, crouch, rise) for a leaper; humanoids the clips' foot slide.
- **Bench:** `bench-trial.mjs <out.jsonl> <kind>@<skin>` then `bench-table.mjs`: 1 and 6 bodies over the empty Arena,
  High and Handheld, two rounds reversed, each run started under load 25. No GPU claim where it is not separable.
- **Tests:** `tests/<foe>-trial.test.js` like the four: the game's own body by default; every skin builds and keeps
  the contract; size, attacks, death, lying body in the fight; 10–15k triangles, normalised weights, exact bind,
  isolated joints; the cut, the flat colours, the gaze, the moving parts, the grip.
- **The foe's README** (`trials/<foe>/README.md`, see pitfalls): reference, task ids, what it is, the fixes, the
  comparison table (fidelity, readability at 14 m, baked light, meshes, triangles, materials, texture memory, bytes,
  draws and CPU for 1 and 6, walk, deformation, gaze, kept, agent time, credits), what is still off.

## 7. Wiring a picked body into the game

The author picks from the trial page; then land **one foe at a time**, each its own commit.

- **Replacing an archetype** (the crab, the hound): move `model.js` into `src/enemies/plans/<name>-tripo.js`, set it
  in `BUILDERS` (`src/enemies/plans/index.js`); ship the asset from the trial's with a `scripts/tripo/ship-<name>.mjs`
  into `public/enemies/<concept>/body.glb` (16-bit indices, the texture at 512², the landmarks in its extras, read
  without three's loader); `main.js` and the gallery await its load before the foes are made
  (`tests/load-awaits.test.js`); a fallback body (the direct one, or today's) where it is not loaded.
- **Adding one when the author keeps the old** (the brute and the wood cutter, the mummer and the dune mummer): a new
  id (`woodcutterArchetype`, `duneMummerEntry()`): `ARCHETYPES`, `SKINS`, `BUILDERS`, `SURFACES`, its sounds
  (FOE_CALLS / FOE_MOVES or the old one's keys), DEATHS, `foe-worlds.js`, the gallery; placed in worlds by its look
  and role within the difficulty curve (#796), the old archetype's id, def and skins untouched (test).
- **Arena warm-up:** every skin warmed at load, the worst arrival frame measured (the crab: 16.8 ms, every skin).
- **Unity:** BridgeBuild copies the body into StreamingAssets; a `-fight <name>` plan in `engine/unity/game.js`
  pictures it in batch (muted), checked picture against the web; `node scripts/bridge-gaps.mjs`.
- **Bench in real worlds** (six bodies, High and Handheld) before and after.
- **Changelog:** a line in players' words with before/after pairs per skin worth showing and the approved reference
  as its own picture (SKILL.md section 9), the Unity picture, the measured numbers; `node scripts/changelog-md.mjs`.
- Regenerate the catalogues after rebasing (`node scripts/test-catalogs.mjs`); `tests/public-model-inputs.js` names
  the new public asset. Update `docs/systems/foes.md`, `docs/design/enemy-roster.md` "Status", the trials README's
  index row and the issue.

## 8. Pitfalls hit in the trials

- **sRGB against linear:** COLOR_0 holds the texture's bytes (sRGB). Classify roles against the hex as it is, not
  through `THREE.Color` (linear), or every role matches the wrong part.
- **Painted eyes left in the texture:** paint them out and give real eyes; measure them first. An eye finder by
  pale texels picked the hound's horn roots (the eyes sat on its temples). Tripo cuts slit recesses: fill each from
  its bottom (the mummer), or eyes float beside dark holes.
- **Fused fingers and mittens:** Tripo's biped rig has no fingers and the hands come fused. Do not promise closing
  fingers; hold by the measured hand centre; widen by hand weights when the T-pose drew them narrower than the approved.
- **Squashed bodies under the shadow pool:** skinned meshes hung on the root kept drawing, squashed, while the hound
  was a pool, and inflated the bench. Hide them with the body, then re-bench.
- **The per-foe README conflicts:** four agents appending to one trials README collided on every landing. Keep each
  foe's write-up in its own `trials/<foe>/README.md`; the shared README gets one index row.
- Colour-weighted decimation keeps crease noise (above); a fused tool forces the same tool on every skin; Tripo
  shrinks small features (the hound's horns, legs a little short: lengthen by weights, `--legs`), check proportions
  against the traveller; the shadow map's jagged edge on a flank is the shadows', not the mesh's (check the clay view).
