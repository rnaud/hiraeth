# Red grunt: OpenAI → Tripo mesh → three rigging trials

Separate model-and-rig experiment for [issue #768](https://github.com/rnaud/hiraeth/issues/768), made 2026-10-29 against game revision `699d01bdabc470f8532748ce75ba22647fb3729b`. Nothing in this folder is loaded by the game or included in its normal build. No enemy replacement, game animation retargeting, Unity integration, or production acceptance is implied.

## Result

The generated shape retains the selected grunt's face, large belly, ears and short legs. The geometry has separated fingers and toes. Tripo's lighting removal produces broadly flat base colors, but much of the original ink detail is lost. This is a usable visual prototype.

The corrected Meshy export is a valid skinned GLB with 24 joints. Basic shoulder and elbow exercises look usable. A knee lift stretches the belly and fused loincloth noticeably; weight painting around the pelvis needs work. **There are no finger bones**, so the hand meshes remain rigid and cannot grip a club. The `neck` joint has negligible direct influence. The one exported 0.033-second clip is a rest-pose placeholder, not a walk animation. No facial rig or independent cloth was requested or produced.

## Three-way rig comparison

**Tripo native auto-rig is the preferred starting point from this trial.** It substantially reduces the belly deformation and provides individual finger joints. The custom rig proves that the abdomen can be kept independent of the legs without splitting or regenerating the mesh, but is a body-only prototype with less refined shoulder/hip transitions and some stretched loincloth faces. Neither is production-approved.

| Same left knee lift | Meshy | Tripo native | Custom authored |
|---|---:|---:|---:|
| Bones | 24 | 54 | 21 |
| Finger articulation | No | Yes, curl reviewed | No |
| Mean belly displacement | 47.61 mm | 1.57 mm | 0.00 mm |
| Maximum belly displacement | 172.28 mm | 24.72 mm | 0.00 mm |
| Belly sample vertices | 219 | 219 | 215 |

The test rotates the left thigh −0.8 radians about world X and the lower leg +1.2 radians. Each model is normalized to 1.3 m tall and grounded, then measured from its actual skinned rest pose. The sample is the central front band at 40–58% of height, within ±12% of height horizontally. It measures unwanted belly motion, not overall rig quality. Different vertex ordering/splits and tiny normalization differences mean the sample sets are not identical. Numbers are saved in `knee-metrics.json`.

Native Tripo used the same `source-z-forward.glb`, Humanoid / Mixamo settings, original UVs and 2k GLB export with skeleton enabled. The import orientation dialog was set to Y=90° to show the front; the exported rig is +Z-forward in the viewer with no extra rotation. It has 54 bones, including three joints per finger, and no animation clips. No regeneration, retopology or segmentation was performed.

`custom-rig.py` independently authors anatomical landmarks and smooth regional weights on the original mesh; it does not reuse Meshy or Tripo rig bones/weights. Source geometry, normals, UVs and encoded texture bytes are exactly preserved. Arms, torso, head and legs have separate influence regions; the belly gets no leg influence. The fused loincloth stays mostly on the pelvis, which prevents belly dragging but can stretch or collide with the raised thigh. No finger, cloth simulation, facial or production animation rig is claimed.

Reviewed all three side by side in T-pose, arms-down, elbow-bend and knee-lift; Tripo finger curl; cycling knee motion from the rear in clay. Actual captures are `review/compare-*.png`. All three retain the same 31,213 triangles. Tripo is 3,000,368 bytes / 33,495 vertices; custom is 2,791,476 bytes / 33,494 vertices. Their normalized weights and rest binding pass `validate-trial.mjs`; structural validity alone does not imply good deformation.

## Files

- `tpose-openai.png`: approved reference generated with the built-in OpenAI image generator from `../sheet-1.jpg`. User explicitly chose OpenAI over Midjourney and approved this result.
- `source.glb`: untouched Tripo P2 export, facing +X.
- `source-z-forward.glb`: same mesh, UVs and texture; a −90° Y rotation is baked into positions and normals so it faces +Z. All object transforms remain identity.
- `rigged.glb`: corrected Meshy rig from the +Z input; retained comparison baseline.
- `tripo-rigged.glb`: native Tripo Studio humanoid/Mixamo rig.
- `custom-rigged.glb`, `custom-rig.py`: independently authored body rig and reproducible generator.
- `compare.html`: synchronized three-way comparison, with per-rig belly measurements.
- `tripo-audit.json`, `custom-audit.json`, `validate-trial.mjs`: inventories and invariant checks.
- `rigged-v1-orientation-failed.glb`: preserved first rig, unsuitable. Directly feeding Tripo's +X export to Meshy placed the humanoid skeleton at 90° to the mesh. Elbow bends dragged the face. This is why the intermediate orientation step is necessary.
- `manifest.json`: provenance, job identifiers, settings and quoted costs.
- `source-audit.json`, `rig-v1-audit.json`, `rig-v2-audit.json`: measured file and skin inventories.
- `review/`: actual browser captures of these models, after-only, standard Three.js preview with fixed lights, no game renderer. The source concept is not implementation evidence.

## Review

From this worktree, start Vite on an unused port in 5400–5499, for example `npm run dev -- --host 127.0.0.1 --port 5448 --strictPort`, then open `/references/enemy-archetypes/grunt/tripo-trial/compare.html`. Individual inspection is available at `review.html` or through each comparison panel.

Choose **Meshy rigged · corrected**. Front, Side, Back and ¾ view reset the camera; drag to orbit and scroll to zoom. Textured, Unlit, Clay and Wireframe preserve the pose. Reverse light switches the key light side; no AO is applied. Skeleton exposes joint placement. Arms down, Elbows bent and Knee lift are simple diagnostic joint poses, not production animations. Exercise rig cycles the selected pose; Reset stops and restores the T-pose. Finger curl is available only on the Tripo native rig. The comparison page leaves the other two hands rigid. The viewer creates no audio context, audio source or media element.

Reviewed front, side, back and three-quarter at rest; lowered arms, elbow bends and knee lift; clay and unlit surfaces; a cycling knee exercise from front-quarter and rear; opposing light directions. These checks do not certify full gait, combat clips, cloth collision, grip or mobile performance. The later Arena extension below compares this model with the procedural grunt in the actual game renderer.

## Measurements

| Export | Bytes | Triangles | Vertices | Materials / draws |
|---|---:|---:|---:|---:|
| Tripo source | 1,983,596 | 31,213 | 33,494 | 1 / 1 |
| Corrected Meshy rig | 3,277,324 | 31,213 | 33,608 | 1 / 1 |

The source has one 2048² JPEG base-color atlas (723,005 encoded bytes), approximately 21.33 MiB decoded RGBA8 including mipmaps. The 30,000-face request is a target; the export has 31,213 triangles. No mobile benchmark or asset reduction was done; the later desktop Arena measurements are below.

The corrected rig has finite nonnegative weights, valid joint indices, maximum weight-sum error `1.45e-7`, and maximum bind-matrix error `3.97e-8`. These numerical checks pass despite the visible pelvis/cloth limitations.

Recheck with `node references/enemy-archetypes/grunt/tripo-trial/audit.mjs references/enemy-archetypes/grunt/tripo-trial/rigged.glb`. The audit assumes ordinary non-sparse GLB accessors and reports inverse binding in mesh space and consistency across joints. The validation uses consistency of the joint × inverse-bind matrices, allowing exporter-specific common rest transforms (Meshy and Tripo differ here); rest shape is also checked visually. Run `node references/enemy-archetypes/grunt/tripo-trial/validate-trial.mjs` to verify all three rigs and exact preservation of the custom source geometry/texture.

## Generation and cost

Tripo P2 through Higgsfield: one image, textures on, PBR off, standard texture quality, texture model `v3.5-20260815`, `delight: true`, 30,000 target faces, triangles. Quote: 34 Higgsfield credits.

Meshy `3d_rigging` through Higgsfield: 1.3 m height, animation generation off. Quote: 5 credits per run, two runs including the preserved orientation failure. Total quoted generation cost: **44 Higgsfield credits**. The tools supplied quotes and successful job statuses, not a final billing ledger.

Tripo native rigging: **20 Tripo Studio credits**, observed balance 2025 → 2005. These are separate from Higgsfield credits. Custom rigging uses the local authored script, with no additional generation service charge.

Reference prompt: faithfully preserve the original red grunt sheet's face, broad snout, tusks, ears, belly, short bandy legs, three-toed feet, tan loincloth and diagonal strap; one frontal full-body T-pose, straight horizontal arms and wrists, open empty palms toward the viewer with all five digits separated, feet apart; flat local color, fine ink contours, plain white background, neutral light, no cast shadows, club, human, extra views or lettering.

## Arena trial and performance (2026-10-29)

Open `arena.html` through the same Vite server. This is the actual Arena, enemy AI, combat timing, animation library, G-buffer, ink, shadow and post-processing pipeline. It is loaded through a dedicated entry under this trial directory; the normal game entry and roster are unchanged. Saves/settings are page-local memory, the review mute is applied in the Sound constructor even with audible initial settings, and the player is invulnerable for inspection. Web-only experiment; no Unity or Android device acceptance.

The model selector switches the same pack between the current procedural grunt and the native Tripo rig. Controls include normal AI, a repeatable walk, the real club-attack clip, close/fixed/player cameras, pause, and a 0/1/6/12-enemy benchmark. Keyboard: WASD move, F blade, Ctrl guard, Alt dodge, Tab lock. Reset pack starts again. The `Hit nearest` control is an additional diagnostic, not a replacement for testing actual blade contact.

Reviewed Arena captures: `review/arena-tripo-idle.png`, `review/arena-tripo-attack.png`, and `review/arena-current-attack.png`. Captured from the running isolated web trial on base revision `699d01bdabc470f8532748ce75ba22647fb3729b` plus uncommitted trial files, 2026-10-29. These are after-only implementation views; the attack pair illustrates the respective poses but does not certify exact pose matching.

### Observed behavior

Reviewed walking, full club-attack cycles, normal pursuit/lunge/overhead AI, real F-key blade combos and the defeat/cleanup transition. The first light cut is shrugged off as in the existing grunt rules; a subsequent combo killed the enemy. The player was also knocked out in the first live trial before invulnerability was enabled. The native rig follows the original controller through a temporary retargeting adapter. Source geometry/texture remain unchanged.

**Visual limitations:** overhead poses reveal shoulder/upper-arm folding; the club grip is provisional, the two-hand reach is not solved, and the fused loincloth still stretches. The generated material does not yet reproduce the procedural enemy's eye warning/flash behavior. A simple two-mesh club is used. Spear/bow/disarm pickup and broad ragdoll quality have not been accepted. Do not promote this adapter as a finished replacement.

The original hidden procedural skeleton continues to drive the existing animation, reactions and ragdoll. Generated-body hit boxes are derived per bone from its weights. The adapter adds CPU work, and both old and new mesh data remain loaded in this comparison page. Timings therefore include that conservative prototype overhead. Asset memory below describes each model's buffers, not total browser memory.

### Asset comparison

| Metric | Current grunt | Native Tripo export |
|---|---:|---:|
| Triangles | 10,234 | 31,213 body; 31,401 with trial club |
| Vertices | 30,060 | 33,495 body |
| Main-pass draws | 8 | 1 body + 2 trial club |
| Bones | 27 | 54, including fingers |
| Geometry buffer bytes | 2,034,624 | 2,250,276 body |
| Standalone download | Procedural, part of shared game JS; no separate GLB | 3,000,368 bytes (3.00 MB / 2.86 MiB) |
| Base-color texture | No per-grunt atlas | 2048² JPEG, 723,005 bytes encoded |
| Estimated atlas GPU memory | None | 22,369,621 bytes / 21.33 MiB with RGBA8 mipmaps |

The current builder is 9 meshes before its two eyes are batched; the game draws 8. Triangle counts include the current builder's weapon variants, collapsed to tiny scales when inactive. The current procedural geometry is largely expanded, so the generated mesh's roughly 3.05× triangle count is only 1.11× its vertex count and 1.11× its geometry-buffer bytes. Both templates share geometry across clones. The Tripo texture is also shared across the pack. Different character atlases would add memory separately. Shadow maps and other shared world textures are excluded from the per-character inventory.

A gzip test of the native GLB is 1,496,123 bytes, but that is an encoding experiment, not measured network transfer or a guaranteed host configuration.

### Measured Arena cost

Mac Apple M3 Pro, Chrome 156 in the internal browser, ANGLE Metal, High preset, 1280×720 CSS viewport / 2560×1440 drawing buffer, render scale 1. Fixed camera and 1/60 animation step, repeatable walk motion; AI excluded from the matched benchmark but exercised separately above. Two rounds with reversed model order, 1.8 s warm-up and 4 s recorded per case. GPU timer queries returned valid samples. `arena-performance.json` preserves every run, including frame p95 and empty-scene controls. Values below are arithmetic means of each round's median, not pooled medians.

| Enemies | CPU ms current → Tripo | GPU ms current → Tripo | Scene draws current → Tripo |
|---:|---:|---:|---:|
| 1 | 4.50 → 4.70 | 13.87 → 14.65 | 99 → 84 |
| 6 | 5.45 → 5.60 | 16.40 → 15.97 | 219 → 129 |
| 12 | 6.65 → 6.75 | 15.96 → 16.54 | 363 → 183 |

At 12 enemies, submitted scene triangles rise from 611,025 to 1,373,037 across rendering passes, while draw calls nearly halve. GPU time increases about 0.58 ms and CPU about 0.10 ms in the two-run summary. Six-enemy GPU results overlap and reverse ordering across rounds. Frame interval medians vary around 17–23 ms and p95 around 35–43 ms, even for the empty-scene controls: browser/compositor pacing and shared-machine load make these unsuitable for a precise FPS claim. The result is evidence against a catastrophic desktop cost, not proof of handheld headroom. No uncapped, native Unity, Android or Steam Deck benchmark was run.

### Budget decision

These generated meshes are reasonable candidates; the full export does not show a large extra cost in this desktop comparison. Do not ship every raw export by default. First test a 512–1024² atlas (1.33–5.33 MiB with RGBA8 mipmaps instead of 21.33 MiB), since most of this asset is flat color. Preserve eyes, teeth and strap/cloth boundaries. Then target roughly 10–15k triangles for the normal enemy LOD, retaining the 31k source for close views if visibly useful; compare silhouettes, fingers and deformation before accepting reduction. These are proposed starting budgets, not measured optimized outputs. A reduced asset has not been generated in this trial.

Use one shared atlas/material per enemy type and measure the intended simultaneous count on the actual handheld. Texture compression could further reduce GPU memory, but no compressed texture variant is part of this trial. At 20 distinct 2K atlases, the simple RGBA8+mipmap estimate alone is about 427 MiB; repeated instances of one atlas do not multiply that number. Drastic geometry simplification is not supported by the desktop evidence; texture/LOD work and better rig fitting are the immediate priorities.

## Side by side (2026-10-29, resumed)

The Arena trial's model selector has a third choice, **Side by side · current | Tripo**: two grunts 1.6 m apart, the left
keeping the procedural body, the right wearing the native Tripo mesh, both driven by the same humanoid clip rig
(`src/enemies/humanoid-rig.js`, issue #724) on one clock, so they play the same clip at the same moment. **Pair view**
frames them square on. The page exposes `window.__gruntTrial` (spawn, a fixed clock, `runTo(t)`, `turn(yaw)` to turn
both in place) for `side-by-side-capture.mjs`, which drives headless Chrome (`--mute-audio`, the page's review mute
checked before any capture), and `side-by-side-sheet.mjs`, which builds the labelled sheets:

```sh
npx vite --host 127.0.0.1 --port 5448 --strictPort      # never 5173
node references/enemy-archetypes/grunt/tripo-trial/side-by-side-capture.mjs <scratch folder>
node references/enemy-archetypes/grunt/tripo-trial/side-by-side-sheet.mjs <scratch folder>
```

- `review/side-by-side-poses.jpg`: idle, two walk frames, the club's wind-up (90 %), strike (60 %) and recover (30 %), front.
- `review/side-by-side-turnaround.jpg`: idle, wind-up and strike at front, three-quarter, side and back.

Captured from the running web Arena (High, Apple M3 Pro, ANGLE Metal, headless Chrome, 1280×720) on this branch
(base `677d67ee8` plus this trial). Both grunts are the real game's foe with its AI frozen to the trial's scripted
modes; the Tripo one is the retargeting adapter above, so its limits show: the club's grip is provisional (in the
recover the club leaves the open hands), the head sits lower and further forward than the procedural one, and its
eyes do not flash. After-only pictures of the two models; neither is a before/after of a game change.

Per foe, measured by the page (`inventory`, main pass): procedural 10,234 triangles, 30,060 vertices, 8 draws,
27 bones, no texture; Tripo 31,213 triangles, 33,495 vertices, 1 draw (+2 for the trial club), 54 bones, one 2048²
atlas (≈21.3 MiB RGBA8 with mips). The Arena crowd numbers are in "Measured Arena cost" above.

**Reading the pictures.** The Tripo body is closer to the picked sheet in silhouette: the head sunk into the
shoulders, the hanging belly in profile, bandy legs and three-toed feet, the ragged loincloth. The procedural grunt
reads more clearly at play distance: a clean snout and round yellow eyes, flat colour fields and few lines, which
is what the house ink pass is built for; the Tripo texture carries its own baked hatching and noise, so it prints
busier and darker than everything round it, and its face is muddier from the front. Worth pursuing only with a
cleaner flat-colour texture (512–1024², no baked lines) and a fitted grip; not a drop-in replacement.

## Flat Tripo: the atlas dropped (2026-10-29)

The author asked whether the texture could be simplified enough to remove the hatching, so that the Tripo grunt is surfaced like the
procedural one. This is done offline and reproducibly by `flatten-tripo.mjs` (input `tripo-rigged.glb`, output `tripo-flat.glb`;
`--preview <folder>` writes software renders of the sampled colour beside the zones):

- **No texture at all.** Each triangle is sampled once from the atlas (5 px median filter, then the median of seven points
  inside it). The sample is snapped in Lab space to seeds, taken from the atlas's own colours, for the procedural grunt's zones:
  skin, cloth, leather, iron, bone, ink and eye. Where colour alone is ambiguous, the body's layout decides. Tripo paints the
  loincloth, tusks and claws the same tan, so tan on the hips is cloth and tan elsewhere is bone; eyes are allowed only in the
  face. Four passes of majority smoothing and an island cleanup remove the hatching's flecks. The eyes are made round: every
  front-facing triangle within 3.4 cm of each detected pupil becomes eye, and within 1.5 cm becomes ink (the procedural
  grunt's sizes). Snout and belly triangles that Tripo painted paler keep a slight skin2 tint in the vertex colour.
- **The game's own materials.** There is one primitive per zone, all sharing one vertex set and one index buffer. At run time
  `arena-model.js` gives each zone the procedural grunt's own material (found by its palette colour). That makes its surface
  patterns, gloss, shading and ink lines the same, and the eyes use the procedural grunt's own flashing material (orange in
  the wind-up, blue when stunned). The skeleton and mesh are scaled to metres (1.3 m) in the file, so the bind-space patterns
  print at the procedural scale. Normals are softened by three passes of neighbour averaging, so the house shading forms
  broader shapes; `SMOOTH=0` keeps Tripo's normals. Zones: 25,314 skin, 2,818 cloth, 1,241 leather, 522 iron, 613 bone,
  160 ink and 545 eye triangles.

The Arena trial's selector has two new choices: **Tripo flat · procedural materials** and **Side by side · current | Tripo | flat**.
With `MODE=side3`, the capture and sheet scripts produce the trio and two closer face shots. With `BENCH=1`, the capture
script runs the page's matched benchmark headless instead:

```sh
MODE=side3 PORT=5448 node references/enemy-archetypes/grunt/tripo-trial/side-by-side-capture.mjs <scratch folder>
MODE=side3 node references/enemy-archetypes/grunt/tripo-trial/side-by-side-sheet.mjs <scratch folder>
BENCH=1 PORT=5448 node references/enemy-archetypes/grunt/tripo-trial/side-by-side-capture.mjs <scratch folder>
```

The sheets are `review/trio-poses.jpg`, `review/trio-turnaround.jpg` and `review/trio-faces.jpg`. They were captured on
040d584c8 plus this change in headless Chrome (muted, review mute checked), High preset, 1280×720, Apple M4 Pro / ANGLE Metal.
These are after-only pictures of three trial models, not a game change.

| Per foe (page inventory, main pass) | Procedural | Tripo textured | Tripo flat |
|---|---:|---:|---:|
| Triangles | 10,234 | 31,213 | 31,213 |
| Vertices | 30,060 | 33,495 | 33,495 |
| Body draws | 8 | 1 | 7 (+2 trial club for both Tripo) |
| Bones | 27 | 54 | 54 (one shared skeleton) |
| Geometry bytes | 2,034,624 | 2,250,276 | 2,384,256 |
| Texture GPU memory | none | 2048² ≈ 21.33 MiB | **none** |
| GLB | procedural | 3,000,368 B | 2,412,340 B |

Headless benchmark (`arena-performance-flat.json`, two rounds in reversed order, means of each round's median). Frames
were vsync-bound at 16.7 ms throughout, so frame time says nothing here:

| Foes | CPU ms cur / Tripo / flat | GPU ms cur / Tripo / flat | Scene draws cur / Tripo / flat |
|---:|---:|---:|---:|
| 1 | 2.30 / 2.25 / 2.25 | 7.55 / 7.27 / 7.11 | 99 / 84 / 102 |
| 6 | 2.85 / 2.85 / 3.20 | 7.21 / 7.18 / 7.99 | 219 / 129 / 237 |
| 12 | 3.50 / 4.00 / 4.55 | 7.88 / 7.69 / 7.34 | 363 / 183 / 399 |

GPU times swing by about ±2 ms between rounds (8.4–10.2 ms in round one, 4.6–6.9 ms in round two, for every model). That is
more than any difference between models, so read them as "no measurable GPU change". The flat body costs per-zone draws:
about 3 more per foe than the procedural grunt across all passes, and about 1 ms more CPU at 12 foes. It frees the atlas's
21 MiB.

**Reading the pictures.** The flat Tripo grunt now prints in the procedural grunt's colours and weight: the same tomato
red, khaki loincloth, brown strap, ivory tusks and claws, and round yellow eyes that flash in the wind-up like the
procedural one's. The textured version's baked hatching, specks and dark mottling are gone. What remains busier than the
procedural grunt is the geometry, not the texture. The scan-like scalp bumps, brow and folds break the house shading into
more small shadow shapes and creases than the procedural spheres do, and the snout has no inked nostrils. The procedural
face still reads more clearly at play distance (big snout, black nostrils, bigger eyes); the flat Tripo is closer to the
sheet's silhouette. The rig limits above (overhead shoulders, club grip) are unchanged.

## Round 3: the LOD, the scalp, the nostrils, a fitted grip (2026-10-30)

The author: "tripo grunt: keep going". `lod-tripo.mjs` turns `tripo-flat.glb` into `tripo-lod.glb` (reproducible byte for byte,
checked by `validate-trial.mjs`):

- **12,159 triangles** (from 31,213), 18,171 vertices, 1.24 MB. meshoptimizer's attribute-aware simplifier (three's bundled
  WASM build) only collapses edges onto existing vertices, so every vertex keeps Tripo's own joints and weights: the rig is
  unchanged (54 bones). Each zone has its own copy of the vertices on its edge, so zone borders are seams the simplifier
  keeps; the eyes and the ink are locked. The silhouette survives: head sunk into the shoulders, the belly, bandy legs,
  ears and loincloth tatters (`review/lod-turnaround.jpg`).
- **The scalp** gets a shrink-free (Taubin) smoothing of the cranium's positions (Head-weighted, above the brow and behind
  the eyes, ears and face left alone, faded at the edges), and the normals are rebuilt from the simplified surface. The small
  dark flecks the scan-like bumps cast under the house shading are gone (`review/lod-faces-level.jpg`, flat vs LOD).
  These flecks were not shadows. Turning the grunt's shadow casting off left them unchanged, and the pale-skin vertex
  tint is not on the scalp.
- **Inked nostrils**: two black flattened ellipsoids (1.6 cm, the procedural grunt's shape) pressed into the snout's front
  2 cm under its tip, bound wholly to the Head, drawn with the ink zone (no extra draw). At the tip's own height they sat
  level with the eyes and read as a second pair of eyes. Tripo's mouth is modelled, so it has no grin line.
- **The fitted grip** (`arena-model.js` `fitArms`, used for the LOD export): the clavicles lift with an upper arm raised
  past level (45 % of the rise past 0.15 rad), so overhead poses no longer fold the shoulder into the neck. A two-bone IK
  puts the right palm where the procedural grip is (measured from each one's own shoulder, scaled by arm length, the elbow
  toward the procedural elbow). The club sits in that palm on the procedural grip's turn, with the fingers closed into a
  fist. When the procedural left hand is on the haft, the Tripo left palm goes to the same place on the Tripo club,
  eased in by distance. The club stays in the fist through wind-up, strike and recover (`review/lod-grip.jpg`: seven
  moments of the club cycle, front and side). The overhead recover still raises both arms straight up, as the clip does.
  The club is still the trial's plain two-mesh stick, not the procedural knobbed club.

Selector: **Tripo LOD · 12k, fitted grip** and **Side by side · current | flat 31k | LOD 12k** (`MODE=side3l` for the
capture/sheet scripts, which also capture the club's whole cycle for `lod-grip.jpg`). Sheets (headless Chrome, muted,
review mute checked, High, 1280×720, Apple M4 Pro / ANGLE Metal, on 47d2279d3 plus this change): `review/lod-poses.jpg`,
`review/lod-turnaround.jpg`, `review/lod-faces.jpg`, `review/lod-grip.jpg` (same views as the `trio-*` sheets: middle is
round 2's flat 31k, right this LOD), and `review/lod-faces-level.jpg` (front and three-quarter at face height:
procedural | flat | LOD). Normal-AI fights with six LOD grunts, blade hits and two defeats ran with no page errors.

| Per foe (page inventory, main pass) | Procedural | Tripo flat | Tripo LOD |
|---|---:|---:|---:|
| Triangles | 10,234 | 31,213 | **12,159** |
| Vertices | 30,060 | 33,495 | 18,171 |
| Body draws | 8 | 7 | 7 (+2 trial club) |
| Geometry bytes | 2,034,624 | 2,384,256 | 1,236,168 |
| Texture | none | none | none |

**Handheld preset benchmark** (`arena-performance-lod-handheld.json`): `BENCH=1 QUALITY=handheld BENCH_MODELS=current,flat,lod
BENCH_COUNTS=0,1,6,12,24`. Mac Apple M4 Pro, headless Chrome / ANGLE Metal, Handheld preset (render scale 0.75, dynamic
resolution off), 1280×720, walk loop, fixed camera. Two rounds in reversed order, each value the mean of the two rounds'
medians. Frames were vsync-bound at 16.7 ms (p95 ≤ 16.8 ms) for every model and count, so the frame time does not tell
them apart. The CPU and GPU timers do:

| Foes | CPU ms cur / flat / LOD | GPU ms cur / flat / LOD | Scene draws cur / flat / LOD | Submitted tris cur / flat / LOD |
|---:|---:|---:|---:|---:|
| 1 | 1.65 / 2.10 / 1.90 | 3.67 / 3.93 / 3.90 | 83 / 85 / 85 | 134k / 177k / 138k |
| 6 | 2.35 / 2.55 / 2.50 | 4.32 / 4.67 / 4.24 | 163 / 175 / 175 | 237k / 491k / 262k |
| 12 | 2.95 / 3.35 / 3.50 | 4.95 / 5.32 / 4.77 | 259 / 283 / 283 | 359k / 867k / 410k |
| 24 | 3.70 / 4.85 / 5.25 | 3.58 / 5.32 / 4.67 | 451 / 499 / 499 | 605k / 1,621k / 706k |

GPU: the LOD is level with the procedural grunt up to 12 foes (round-to-round spread ±0.4 ms). At 24 it is about 1 ms
more, and the procedural 24 reads below its own 12. Submitted triangles: +14 % over the procedural grunt, against +141 %
for the flat 31k. Draws: +2 a foe across all passes, from the 7 zones and the trial club. CPU: +0.55 ms at 12 and
+1.55 ms at 24. That is the trial adapter, not the mesh. The page still poses the hidden procedural skeleton, then
retargets 25 bones, lifts the clavicles, runs two IKs and updates matrices bone by bone. A production version would pose
the Tripo skeleton directly. No Retroid was connected (only another Android handheld, not used), so this is the Mac
running the Handheld preset, not a device measurement.

**Reading it against the sheet.** The LOD keeps what made Tripo closer to `sheet-1.jpg`: the sunk head, round belly,
bandy three-toed legs and ragged cloth. It drops two thirds of the triangles with no visible loss at play distance. The
scalp now takes broad shading like the sheet's, and the snout has its nostrils. The club stays in the hand. Still behind
the procedural grunt: the eyes are smaller and set under the brow, so from a raised camera the face reads less boldly than
the procedural one's big snout and grin. The mouth has no ink line. The trial club is plain. The adapter is a trial
retarget, not a production rig. Web only: nothing the game or Unity loads.
