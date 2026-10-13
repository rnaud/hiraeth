# Tripo character experiment

The accepted no-backpack v1 is now the default playable traveller. This directory
keeps the reproducible generation and review workflow for further iteration.
Source Tripo model: https://studio.tripo3d.ai/workspace/generate/734ea223-13c2-4406-a081-ef34a5612b5d

## Accepted portrait head-v3 (12 October 2026; integrated)

The user selected Midjourney turnaround option 3 from job
`45195791-bc77-4833-8cb3-ee565eb6da5e`. Its profiles/back and the original hearted
portrait (`0e2c1f43-d155-46f9-99c7-9b17585bd585`, index 0) were cropped into four
aligned 1024² images. The exact inputs and mechanical crop recipe are in
`data/characters/traveller-v1/head-v3/reference/`; no face pixels were redrawn.

Tripo job `3bdf5bce-cf91-4737-9dc9-be8b06c813c0` used the fixed four-view UI,
H3.1, Ultra Mesh, 50k triangle target, 4K texture, Remove Lighting on, PBR and
Generate in Parts off. It used 50 credits (2,825 → 2,775). `head-v3/model.glb`
is the untouched 3.62 MB export: 49,583 triangles, 32,852 vertices, one material,
one 4K JPEG, no skeleton or morphs. `inventory.json` records the source budget
and hash; do not ship this full-resolution source by default.

Open `/tools/tripo-head-v3-review.html` on the task's local Vite server (5198).
Compare unlit, clay, opposing neutral lights and game ink with the original
portrait and selected profiles. This page creates no audio. The old procedural
face overlay is absent. Eyes/brows/fringe are closer, but hair ink was mostly
lost, nose/mouth ink weakened, jaw/profile still differ, and game compositing
overdraws the remaining painted contours. The fixed chin ink patch also needs
review before texture acceptance. See `docs/systems/characters.md` for findings.
That page preserves the untouched source for comparison. The user accepted the
mesh and requested cleanup, integration and the reference's hair highlights.

Run `node scripts/tripo/bake-face-ink.mjs` to rebuild the face's pen-line mask
(`head-v3/face-ink.png`) from the approved front reference.
Run `node scripts/tripo/prepare-portrait-head.mjs` to rebuild the shipped GLB,
sampled colours and R8 hair mask in `public/characters/traveller-v1/head-v3/`.
Positions, triangles and UVs are unchanged; skin normals are smoothed and the
base colour atlas is 2048². The 1024² grey-stroke mask is projected from the four
approved reference crops. GLB: 2,325,756 bytes; colour plus hair mask: 22.67 MiB
decoded including mipmaps (source colour alone: 85.33 MiB). No extra draw call.

`src/characters/portrait-head.js` fits the accepted skull uniformly, extends the
neck under the scarf, binds to Head/neck_01 and adds six measured runtime face
morphs. It retains the painted eyes/brows, suppresses fixed chin hatching and
routes nose/lip strokes through the real ink channel. The old procedural face
overlay is not applied. Humanoid/TalkFace drive expressions; the mouth is a drawn
opening rather than a cavity. These runtime operations are not baked into the GLB.

The shared traveller loader serves game, studio and motion review. Open
`studio.html?view=bust&blink=false&gaze=fixed&yaw=0&bg=flat&paused=true&wind=0`.
Face view provides close inspection; turn through both profiles and the back.
Run `node --test tests/portrait-head.test.js tests/traveller-v1.test.js tests/traveller-lod.test.js`
and `npx vite build --configLoader runner`. The changelog contains bust, Lula and
hair-mask before/after views. Native VMs skip browser-decoded masks and use sampled
vertex colours; matching their separate shaders remains future work. Device GPU
timings are unverified. The accepted shape is closer, not a pixel-exact match.

## Previous Tripo head-v2 replacement (8 October 2026)

The user rejected the code-sculpted eye shape as still too slanted and requested
Tripo image-to-3D again. The new, separate head is Tripo H3.1 job
`931197c2-0e35-40a7-82d6-051783349826`. Its original export is preserved at
`output/character-tripo/head-v2/source/model.glb` (48,423 triangles, 33,374 vertices,
one textured primitive, embedded 4K JPEG, no skeleton or facial morphs).

Tripo Studio's Nano Banana prepared the neutral front head from
`references/main character/new3.JPG` and `Facial Expressions/expression-sheet-1.jpeg`.
Image job: `d4f82370-ad5c-466e-9c7f-77e60d278623`. The prompt specifically requested
nearly level inner/outer eye corners, small adult eyes, no eyeliner wings, a long
lean face, straight nose and soft short wavy hair, isolated with a full neck on
white. Tripo's Multi-view Image then supplied front, left, right and back inputs.
The image used the account's included allowance; the 3D run used 50 existing
credits (3,145 → 3,095), requesting 50k triangles, 4K texture, lighting removal on,
PBR off. Generate in Parts was off: enabling it disabled texture generation.

Review `/tools/tripo-head-review.html` on the local server. It uses the real game
ink pipeline and provides front/profile/back/three-quarter plus matte and clay
views. The original downloaded texture is retained; the previous drawn-eye
shader and local head sculpt are deliberately absent from this new-asset study.
Screenshots and provenance are alongside the source under `head-v2/`.

The user approved this head and requested integration. Its byte-identical GLB is
tracked at `data/characters/traveller-v1/head-v2/model.glb` (with `reference.png`);
the game ships `public/characters/traveller-v1/head-v2/model.glb`, made from it by
`node scripts/tripo/slim-traveller.mjs` (the same geometry, the texture at 2048²),
beside its provenance.
Its sampled `colors.json` supplies native engine VMs that cannot decode the JPEG.
Reproduce it from the source (a copy of `data/characters/traveller-v1/head-v2/model.glb`
in a folder of its own) with `python3 scripts/tripo/sample-colors.py <that folder> --output colors.json`.
`loadTravellerV1` loads it for the game, studio, trailer and motion viewer.
`src/characters/tripo-head.js` fits and binds a clone to the existing Head/neck_01
bones, trims the hidden foot, widens only a throat cylinder inside the lower neck to meet the scarf and
removes the original head after the clothing split. Do not use a height-only neck
flare: the low chin falls in that band too. Keep the jaw outside the flare and
fully weighted to Head; the regression test compares it to the unchanged source. It creates six facial shape
keys and their normal deltas at runtime; Humanoid and TalkFace drive blinking,
expressions and speech. The mouth opening is shaded surface ink,
not an anatomical interior. Neither the fit nor the face keys are baked into the
preserved original GLB. Native engine facial shader parity is not yet validated.

Reproduce the integration by loading the tracked assets in Character Studio:
`studio.html?view=bust&blink=false&gaze=fixed&yaw=0&bg=flat`.
Use face/front/side/back views, expression presets, Talking and the walk/jog/sit
animation controls. Run `node --test tests/traveller-v1.test.js tests/tripo-*.test.js`
and `npx vite build`. Do not reuse the old `TRIPO_FACE` eye coordinates: the new
head's face is drawn over its paint in its own rest coordinates (`src/characters/head-ink.js`,
`HEAD_INK`, measured off a front orthographic render of this texture), and the gaze moves only the
drawn iris.

## Original full-body experiment

Put the downloaded original at `output/character-tripo/baseline/model.glb`, then run:

```sh
python3 scripts/tripo/sample-colors.py
node scripts/tripo/rig-baseline.mjs
node scripts/tripo/verify-rig.mjs
npm run dev -- --port 5174
```

Open `/tools/tripo-review.html`. Pillow is required for reading the embedded JPEG.
All generated models and color samples stay in the git-ignored `output/character-tripo/` directory.
The original source GLB remains untouched. The rigged GLB preserves its textures and uniformly
scales its shape, then adds the repo's MakeHuman skeleton and transferred weights. Barycentric
weights come from the closest donor-body triangle. Coral lower shirt vertices receive torso
weights instead of thigh weights. This is a heuristic, not a full anatomical fit.

The current review page uses the existing Animator and Humanoid retargeting with walk, jog,
climb and seated clips. `tools/tripo-fit.js` moves arm joints onto cross-section centers of the
generated surface, deforms the donor used for weight transfer, and recalculates inverse binds.
The same fitting is applied in the viewer, avoiding rebinding to the original unfitted donor.
Torso and concealed ankle placements are proportional estimates requiring visual review.

Materials in both the GLB and viewer use roughness 1, metalness 0, without the generated
metallic-roughness or normal maps. Base color remains unchanged; baked lighting in that image
is not removed by these material settings.

The lower overshirt is separated into its original textured render surface and a regular
simulation cage (`tools/tripo-cloth.js`). The 495-point cage uses fixed 90 Hz Verlet steps,
stretch/shear/bending constraints, a rest-shape tether, and outward collision against four
leg capsules plus a hip bridge. Their rest centers follow the reconstructed trouser
volume, with offsets stored in bone-local coordinates; centering oversized capsules on the
rearward donor joints inflated the back of the coat. The dense garment follows interpolated cage displacement;
its attachment blends into the original skin deformation, and the interior has plain fabric
shading. The coral classifier distinguishes red cloth from brown trouser shadows.

The fused source has no complete trousers behind the shirt. `tools/tripo-garment-geometry.js`
reconstructs one connected pair of upper trousers: two leg sections loft from the exact
source cut boundary into a shared crotch seam and a single waist opening. Boundary normals
match the original lower legs. Original and reconstructed trousers share a continuous
hip/thigh weight field. The former hem's baked shadow fades into neutral fabric.
This eliminates the old rigid cylinder patches but simplifies the upper trousers' detail.
An opaque skinned inner-shirt backing fills the missing sides above the waistband; the
original textured center folds remain in front. The lower legs, boots, face, hair, sleeves,
and shirt texture remain from the generated model.

**This remains a character-specific preview.** There is no cloth self-collision, hand collision,
or environment collision; sleeves remain skinned. Seated poses remain a stress test, with
excessive stretch. Cloth and Trouser repairs toggles expose the separate systems; Next pose
advances one eighth of the current clip and settles the cloth for repeatable visual checks.
The downloadable GLB is still the rig-only prototype; runtime cloth is not baked into it.
The live traveller and production build are unchanged.

Known limitations:

- The generated face has no facial morphs, articulated eyes, or mouth interior.
- Arm fitting measures the visible surface; it does not infer exact anatomy under clothing.
- Hands, torso, knees, ankles and extreme poses still require landmark and deformation review.
- Tripo Balanced segmentation produced 10 parts but grouped inner shirt/scarf with the outer
  torso. It did not produce an independent usable overshirt or hidden body.
- The Game style toggle uses the shared game ink pipeline under fixed preview lighting;
  world-specific lighting and look overrides are not loaded. The live traveller is unchanged.

Validation: `node scripts/tripo/verify-rig.mjs` checks weights and bind-pose roundtrip. It does
not establish anatomical correctness. `node --test tests/tripo-fit.test.js` checks a synthetic
known arm displacement, hierarchy preservation and donor skin binding. Review real front,
side and moving poses before accepting this character.

For a production garment, generate a body-only reconstruction and an independent overshirt,
fit both to the same rest-pose landmarks, then replace the heuristic garment boundary with
an open, consistently meshed garment and retain/transfer MakeHuman facial targets.

### Walk, jog and seated arms

`node scripts/tripo/audit-walk.mjs` samples 60 phases of the shipped walk on both the unmodified MakeHuman body and fitted rig. Both reproduce the source upper-arm directions within 0.000002 degrees; the source itself has 8.6–23.5 degrees of lateral arm spread. The review’s **Relaxed walk/jog arms** option rotates each complete arm inward by up to 8 degrees, retaining at least 7 degrees of spread and preserving elbow bend. This is preview-only character styling, not a new exported animation or a cloth collision solver. Jogging uses a stronger inward correction (up to 40 degrees, retaining 12 degrees of spread);
`node scripts/tripo/audit-walk.mjs jog` measures about 12–17 degrees after correction, versus
28–57 degrees in the source. Idle, climbing and the bind pose are unchanged.

The source `drive` clip is a steering-wheel pose. The preview's Seated option keeps its body
and leg motion but uses two-bone arm IK to place the wrists over the thighs. Palm-down wrist
and forearm orientation replaces the driving hand roll. This is a preview pose adjustment,
not a new exported seated animation; the seated cloth stress-test limitation remains.

### Cloth validation

Run `node --test tests/tripo-cloth.test.js` for overlapping-leg outward projection, clean attachment-plane clipping,
coral-vs-brown classification, and connected trouser topology (three boundary loops, no non-manifold edges), plus normalized weights. Run `node scripts/tripo/audit-cloth.mjs walk` (or `jog`, `drive`)
against the downloaded local asset for four seconds of actual animation. The audit checks
finite positions and clearance of free particles and triangle centroids against the collision
capsules, and reports maximum stretch. It does not prove triangle-triangle separation from
all original trouser geometry or acceptable appearance. Walk and jog are checked for positive
minimum sampled face clearance; the seated clip has excessive stretch despite clearance.
Visual checks covered front, side, and rear walking poses plus raised-knee jogging poses.
The reconstructed upper trousers still have simpler shading/folds than the source. The jog
hem can stretch into an unnatural flap; collision clearance alone is not visual acceptance.

### Preview controls and hands

Drag to orbit, scroll to zoom, and right-drag to pan. View presets and Reset view restore a
framing; Focus offers whole-body, face, leg and tracked left-hand close-ups. The canvas fills
the remaining viewport, with implementation details collapsed beneath the toolbar.

`tools/tripo-hands.js` now updates the game’s context-aware hand poses every animated frame.
Guided digit fitting shortens the donor palm and locates each phalanx before weight transfer.
All 30 digit joints now have meaningful mesh influence, including all ten distal joints.
The hand driver also supports rigs without fingertip leaves; previously it skipped the
last phalanx. The preview uses 80% finger curl and 45% thumb rotation while full grips remain
under review. Hands offers Automatic/Open/Relaxed/Fist test for visual comparison.
`node scripts/tripo/audit-hands.mjs` checks influence and actual displacement per digit joint;
it does not certify anatomical correspondence or clean contact grips.
Run `node --test tests/hands.test.js tests/tripo-*.test.js` for the hand system and preview regressions.

### Game-style rendering

The **Game style** checkbox switches between the existing matte review and the game's
`makeMaterial` G-buffer, `createPost` Moebius print composite, fine character shadow cascade,
and FXAA (`tools/tripo-render.js`). Materials are swapped for the render pass only, so toggling
preserves animation, cloth state, camera and the standard materials. The adapter retains
textured cloth lining, vertex-colour trousers and the source trouser repair blend. Imported
linear colours are converted to the printed RGB convention used by the game's shaders.
The grid is hidden in ink mode; the skeleton remains available as a debug overlay. This uses
fixed daylight and a neutral backdrop, without a specific world's atmosphere or look overrides.


## Updating the shipped v1

The October 8 head revision adds `head-v2/model.glb` and its provenance beside
the three original body files. Keep all of them available; loading the new head
is part of the normal traveller loader. The original body export stays unchanged,
and its old head is removed from the rendered clone at runtime. See the accepted
head section above and `docs/systems/characters.md` for the fitting contract.

The runtime implementation is in `src/characters/`; the matching `tools/tripo-*.js`
files re-export it for these experiments. After regenerating and accepting an asset,
promote the three matching files together:

```sh
cp output/character-tripo/rig-prototype.glb data/characters/traveller-v1/model.glb
cp output/character-tripo/rig-prototype.glb.json public/characters/traveller-v1/rig.json
cp output/character-tripo/baseline/vertex-colors.json public/characters/traveller-v1/colors.json
node scripts/tripo/slim-traveller.mjs     # the shipped model.glb: unused maps out, texture at 2048²
node --test tests/traveller-v1.test.js tests/traveller-lod.test.js tests/tripo-*.test.js
```

`data/characters/traveller-v1/` keeps the untouched exports (the body's and the head's, with
their 4096² textures and Tripo's unused normal and roughness maps); `public/` ships what
`slim-traveller.mjs` makes of them, geometry byte for byte the same.

Keep the original source export unchanged. Verify the actual game, not only the
origin-centred viewer: the CPU skinning proxies must follow the character's inverse
world bind, and colour repairs must agree with the game's disabled global colour
management. Do not import the review renderer into the game; only share its material
adapter, leaving world lighting, hero tags and the existing render passes in charge.
The bare GLB still does not contain the reconstructed clothing or cloth simulation;
those run in both the game and the review through the shared code.

## Father v1 — recording asset

Source and approved T-pose: `data/characters/father-v1/`; provenance records the
Tripo job, 50-credit generation and Remove Lighting setting. The earlier posed
prototype is not used. Rebuild the runtime GLB from the untouched source:

```sh
mkdir -p output/character-tripo/father-v1
node scripts/tripo/rig-baseline.mjs data/characters/father-v1/source.glb output/character-tripo/father-v1/full-before.glb --father
node scripts/tripo/slim-father.mjs output/character-tripo/father-v1/full-before.glb public/characters/father-v1/model.glb
node scripts/tripo/verify-rig.mjs public/characters/father-v1/model.glb
node --test tests/father-v1.test.js tests/hands.test.js tests/ship.test.js
```

The checked-in `data/characters/father-v1/colors.json` samples source UVs in vertex
order. To resample after replacing the source, sample the full source UV order (never the compacted runtime bust) and rebuild. Rig-specific finger coordinates must be remeasured for a new source.
The lower body is held to the pelvis for stationary holograms; walking and cloth
are not supported. Runtime face keys are supplied by `src/characters/father-v1.js`.
Use `tools/father-review.html` for unlit/opposing-light checks and the game’s
`cinematics.html#call.1` for integration review. Use temporary folders for downloads.

## Elder guardian animation review (12 October 2026)

Approved reference: `references/guardians/elder/reference-v1-4.png`, Midjourney
job `185dc8fc-4482-40d1-800c-2fcf5132e844`, candidate 3 (fourth image).
Tripo H3.1 job `83a6d028-cc00-49a9-bae6-3f5b04b438c6` used 50 credits with
Remove Lighting on. The untouched 5,277,500-byte export is retained locally at
`output/character-tripo/elder-v1/source.glb`; recover it from the recorded Tripo
job when rebuilding on another checkout. Its SHA-256 is checked by the builder.

Run `node scripts/tripo/rig-elder.mjs` to rebuild the 23-joint skin and its report
under `public/guardians/elder-v1/`. Landmarks and weights are measured in
`src/characters/elder-fit.js`; they are specific to this source. The shipped
review derivative is 3,084,068 bytes, 48,176 triangles, 28,379 vertices, one draw
call/material, and a 2K JPEG (~21.3 MiB decoded RGBA8 including mipmaps). Geometry
is unchanged; the original 4K texture is preserved in the source export. No LOD
or device-performance acceptance has been established.

Open `/tools/elder-review.html` on port 5174. Walking and turning use the shared
GuardianLegs planner with measured lengths and smooth foot arcs. Wing chains,
neck, head, lower beak and tail are driven by `createElderCreature`; all motion
is procedural at runtime, with no baked clips. Encounter controller uses the
real Guardian/ELDER definitions. Phase selects ground, airborne and final combat;
Show rig includes the independently driven leg chains. Time/Go resets and steps
the same state to a fixed pose. All previews are silent.

Run `node --test tests/elder-creature.test.js tests/keeper-creature.test.js
 tests/materials-pass.test.js tests/motion-guardians.test.js
 tests/guardian-twists.test.js` (as one command) and `npm run build`.
The checks cover actual vertex displacement, bind roundtrips, normalized and
meaningful weights, planted feet under translation/rotation, lower-beak isolation,
full-cycle edge stretching, continuous attack transitions and all encounter phases.
Visual inspection includes game ink, clay and unlit from front, side and rear.

This is an isolated animation review; the live temple still uses its existing
model. The vent/wind puzzle, final touch and effects need full-arena acceptance
before promotion. Painted dark creases remain despite Remove Lighting; the lighter
per-mesh ink treatment does not claim to remove baked lighting. Review captures
and the complete source inventory remain in `output/character-tripo/elder-v1/`;
settings, provenance and acceptance limits are tracked under
`references/guardians/elder/`. The interactive changelog records the animated review.


**Checkpoint status: unfinished prototype; visual acceptance failed.** User review
on 12 October identified a persistently turned face, wobbling leg joints, and
rigid extended legs during hover instead of an avian tuck. The source head is
already turned; zero runtime head yaw preserves that geometry rather than
straightening it. The IK instability still needs diagnosis, and flight needs
articulated leg folding with takeoff/landing contact transitions. Further full-cycle
motion and deformation work is required. Existing numerical tests establish
limited invariants, not natural motion or visual readiness. Track repairs and
full temple acceptance in [GitHub issue #237](https://github.com/rnaud/hiraeth/issues/237).

## Traveller ink study (#198)

Rebuild the authored shirt/scarf mask with `node scripts/tripo/bake-cloth-ink.mjs`.
Its measured surface paths are in `data/characters/traveller-v1/ink/cloth-strokes.json`;
the original model/colour texture are unchanged. Runtime loads one shared R8 mask
for the body and GPU overshirt. See `docs/systems/characters.md`, “Traveller face and
cloth ink study”, for the approved references, budget, captures and remaining limits.
