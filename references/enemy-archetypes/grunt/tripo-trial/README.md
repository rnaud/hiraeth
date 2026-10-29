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
