# Pipeline decisions and observed failures

## Reference preparation and hosted generation

The original experiment used Tripo and reference sheets with a coral overshirt, cream trousers, dark hair and several optional accessories. The user chose no backpack for that iteration. Preserve identity before optimizing topology. Compare eye spacing, nose/profile, jaw/chin, hair mass, shoulder width, torso/leg ratios and garment length; a good texture can conceal poor shape.

Use Midjourney to normalize references, unless the user explicitly chooses another image service. Retain one identity reference and a verified T-pose for humanoid game assets. Ask for orthographic-like views, consistent camera height and scale, even diffuse light, and unobstructed open empty hands. Visually verify the outputs: prompts do not guarantee these properties. Use modest/clothed base layers when a bare under-body is unnecessary. Reference normalization is optional only if the selected image already meets the T-pose and lighting requirements. Generate held accessories separately rather than fusing them into the hand.

### Father prototype lesson (2026-10-09)

Tripo H3.1 job `40ed419a-3512-417b-8647-370734310bff` used the selected father reference with one hand in a pocket and the other holding a cap. It produced a 49,036-triangle posed visual prototype, not an animation-ready character. This input should have been converted to a verified T-pose before spending the 50 credits. Importing a posed mesh is possible, but restoring hidden hand anatomy and separating contact regions may require reconstruction; auto-rigging is not a substitute for suitable input.

Remove Lighting was enabled, with 4K textures and PBR disabled. Dark coat/cap regions remain visible in the service preview; without an exported unlit review, their contribution from texture versus preview shading is unverified. Do not describe this prototype as free of baked shadows. GLB export attempts did not produce a confirmed local file in this session.

Keep untouched source GLBs, job identifiers and versioned derived files. The baseline export contained a fused mesh, texture and no usable skin/animation. A segmentation result with ten parts still grouped inner shirt/scarf with outer torso. Neither proved an independent overshirt existed. Do not reuse these historical service details as current feature claims.

## Rest fit, deformation and fingers

### Father motion and budget corrections (2026-10-09)

The first father fit passed normalized-weight and bind-pose checks but failed motion:
loose coat slices put the shoulders too low and asymmetrically forward; painted
colour thresholds produced discontinuous coat weights. Measured joint centres and
a continuous anatomical weight field fixed the shoulder/lapel tearing. Broader
elbow blending avoids a narrow hinge in the sleeve. The first speech landmark
(1.646 m) was near the nose; the actual mouth is approximately 1.613 m. Isolated
face guides exposed this error. Speech displacement is now restricted below the
nose, with a regression that checks the upper face stays unchanged.

The original full rig also cost 4.56 MB, 49,118 triangles and a 4K texture (~89.5 MB
decoded RGBA8 with mipmaps). `scripts/tripo/slim-father.mjs` keeps the full source
rebuildable but ships a recording-only bust: 25,220 triangles, 14,931 vertices,
1.50 MB, one draw call and a 2K texture (~22.4 MB with mipmaps). It removes geometry
entirely below 0.90 m and unused payload without decimating face or fingers. Do not
use this cropped derivative for a walking NPC. These budgets are asset-specific;
no mobile FPS gain has been measured. Source crease detail remains in both the
colour atlas and geometry. Check clay alongside unlit to distinguish those causes.

`tools/father-review.html` provides pause, face guides, isolated mouth states and
elbow focus. `tests/father-v1.test.js` samples actual idle/talk/idle cycles and
surface edge stretch. These supplement visual inspection; they do not certify
natural deformation or acceptable art style by themselves.

The first gaze repair stopped procedural torso rotation but still failed visually:
`char.head` retargeted both `neck_01` and `Head`, dragging neck-weighted scarf and
lapels while torso-bone invariance tests passed. Father gaze now applies at the
actual skull joint after retargeting. The skull weight blend ends below the jaw;
outer raised collars are excluded from the anatomical neck core. The regression
compares actual skinned chest/scarf-base/shoulder vertices and neck transforms at
matching clip times, and checks rigid jaw attachment. Paused left/right controls
now update gaze immediately without advancing the performance. Do not infer
visible isolation from control names or unchanged torso bones alone.

The next profile review found the chin near y=1.575, below the earlier 1.596
test boundary. A sloping skull boundary and a pivot fitted inside the neck avoid
shearing the chin. Linear skinning still compressed the short transition during
combined yaw/pitch. The shared runtime now corrects 328 transition vertices with
interpolated gaze rotation plus pinned edge/bend constraints, welding UV duplicates
for the solve. Skull and clothing boundaries stay fixed; this is a local deformation
correction, not cloth. Sixteen iterations pass the full gaze-range compression and
stretch gate. Check actual corrected positions, not the original attribute values,
when measuring posed geometry. Rest reset and translated/rotated spawn tests guard
against cumulative edits and space errors. The review reports animation CPU time
separately from renderer submission; neither is a mobile GPU benchmark.

Rebasing onto the newer shared hand driver exposed another interaction: its
generic rest-straightening pass distorted the father's already fitted, forward-palm
digits. The full-cycle surface regression caught it. A per-template
`preserveFingerRest` option keeps this asset's measured rest while retaining the
upstream correction for other characters. Recheck fitted assets when shared
rest-pose correction changes; do not disable a global fix to accommodate one rig.

Nearest-surface barycentric weights preserve the source shape, but transfer poorly when donor anatomy is misplaced. Fit before transferring, including individual digits. Merely translating the donor hand left its longer, bent fingertips outside this generated flat hand. All ten distal finger bones initially had zero meaningful influence despite normalized weights and a correct bind-pose roundtrip. This was a real wiring defect, not just subtle animation. A second defect was in the
hand driver: it skipped terminal phalanges when no extra fingertip leaf existed.
Check all 30 digit joints are actually driven, not only that they exist in the skeleton.
For leafless chains, the incoming segment can provide a fallback curl direction.

Audit per joint: influence counts above a meaningful threshold, summed weights, joint position versus influenced mesh bounds, and visible displacement under a controlled curl. Look for adjacent fingers influencing each other. Guided digit fitting must not snap a short pinky to a longer ring fingertip. Sparse or ambiguous input should remain flagged instead of manufacturing a confident fit.

The preview initially reset the skeleton to bind pose but never called the game's hand system again. Correct frame order is source clip/rig pose, body retargeting, wrist/arm correction or contact IK, finger update, world matrices, skin/cloth, then rendering. Check finger updates in paused/stepped poses too. A neutral T-pose should remain neutral unless a diagnostic pose is explicitly selected.

Reducing curl can avoid an obviously crushed thumb while investigating, but cannot repair misplaced joints or absent weights. Restore useful curl only after fitting and visual deformation checks. Open/relaxed/fist diagnostic controls make the result inspectable; don't disguise failures by keeping fingers nearly straight.

The shipped jog clip itself spreads arms widely; compare source motion with retargeted motion before blaming the skeleton. Rotating a whole arm inward preserves elbow bend; wrist world orientation needs the corresponding correction. Retain garment clearance and validate across the entire clip, not one pose.

The option labelled Seated originally played Driving_Loop: its hands reached for a steering wheel. For resting hands, use a suitable sitting clip or explicit lap contact IK. Align palm and forearm roll together rather than forcing the wrist alone. Contact targets should follow the posed thighs and character orientation.

## Cloth, opaque layers and topology

The generated mesh had no complete trousers or inner shirt behind the coat. As the coat moved, absent surfaces looked transparent. Inspect topology and backfaces before changing opacity.

Overlapping cylinder repairs and a separate fly patch caused rings, crotch seams and clipping. The improved upper trousers loft exact lower-leg cut boundaries into a shared crotch seam and waist. Check connected topology, boundary loops, shared skin fields and normals. Interpolated positions alone do not ensure the seam stays closed during animation. Hidden surfaces can use simpler detail, but report the loss of original folds.

The lower coat uses a regular simulation cage driving its original detailed textured surface. Keep attachment seams pinned/blended, use stable fixed steps, and provide a plain inner lining. Texture preservation alone does not imply a physically valid garment: fused hems, bad boundaries and holes still require reconstruction.

Oversized capsules centered on rearward donor hip joints inflated the back into a bell. Collision axes need offsets to match the visible trouser volume; retain those offsets in bone-local frames. Shrinking radii alone can trade inflation for clipping. Validate static rear silhouette as well as moving clearance.

Nearest-point projection between overlapping legs can push a front panel into the crotch. The experiment projects outward along panel directions. This helps that failure but is not general self-collision or full body contact. The seated hem still stretches unnaturally; collider clearance does not certify acceptable drape. Cloth sleeves, hand collision, self-collision and environment contact require their own implementation and tests.

Color-based separation is fragile: brown trouser shadows can resemble coral cloth. Restrict by spatial/anatomical region and verify classifications in dark folds. Use consistent clipping/interpolation at garment boundaries. Avoid hard-coded classifier thresholds for unrelated outfits.

## Materials and preview fidelity

Generated metallic/roughness/normal maps made skin and cloth glossy. Matte material settings improved this asset, but cannot remove highlights or shadows baked into base color. Inspect each material rather than stripping maps universally.

For every generated game character, review base color with an unlit material (no lighting, shadows, AO, normal map or post-processing). Inspect face, under chin, armpits, coat folds, crotch and boots for directional darkening or highlights painted into the texture. Then use a neutral lit material and move the key light between opposing directions while keeping camera/exposure fixed. Geometry shadows should respond to light; painted lighting remains fixed. Save both views and record whether the texture passes. Keep intentional graphic outlines, but remove broad illumination gradients and contact-shadow stains from albedo. If cleanup is needed, retain the original export and make a versioned texture correction or regeneration; follow the repository's Midjourney rule for AI image edits unless explicitly overridden. Recheck identity, palette and UV seams after correction. If clean albedo cannot be verified, label the asset a prototype and leave game integration pending.

A standard Three.js material cannot be sent directly through this game's multi-target G-buffer. Adapt it to the shared game material shader, retaining vertex colors, texture, lining and repair blends. The game uses printed RGB shader colors; the normal review uses linear color management. Convert deliberately and avoid double conversion when toggling.

Use the actual Moebius print preset, shared ink/hatching/paper composite, character shadow cascade and FXAA. Standard/stylized mode should preserve animation time, camera framing and cloth state, and restore materials after the render pass. Hide or separately render helpers that do not write the G-buffer. Fixed preview daylight is not a promise of identical appearance in every level.

## Acceptance evidence and limits

Review front/side/back/three-quarter in bind pose, idle, walk, jog, seated and any required climb/contact animations. Use repeatable stepped phases as well as continuous playback. Close-ups should cover face, each hand, waist, crotch, lower-leg joins and rear hem. A flattering front view is insufficient.

Separate: file validity, normalized weights, bind roundtrip, meaningful digit influence, collision-proxy clearance, and actual visual quality. Never report one as proof of another. The prototype download originally contained only a rig; cloth, reconstructed surfaces and styled rendering ran in the viewer. Label exports accurately and re-check their contents after changes.


## Integration into the live game

The first world-space integration left the lower coat behind even though it worked
at the preview origin. Detached CPU skinning proxies must copy the visible mesh's
current inverse world bind before applying bone transforms. Build the repair and
collision rest data in the export's origin frame, restore the spawn transform, and
check arbitrary translation and rotation. `tests/traveller-v1.test.js` covers this
failure alongside binding, equipment anchors and material consistency.

Share the fitting, cloth and material implementation between the review and game.
The game disables global Three.js colour management; explicitly linearize repair
colours before converting them to printed RGB in the shader. Check both global
colour modes. Share the material adapter, but let the live renderer own world
lighting, hero tags and post-processing.

Keep contextual gameplay contacts authoritative. Blend arm styling with locomotion
weights and apply the matching wrist correction; bypass it for climbing, aiming,
vehicle controls and story poses. A seated preview's lap targets do not belong on a
steering wheel. Preserve equipment attachment points while hiding replaced legacy
wearables. Keep cloth state across blended locomotion clips, and ship matching mesh,
rig report and colour samples under the game's public asset path instead of loading
ignored experimental output at runtime.
