# Procedural character and enemy quality

## Find the real roster and canonical art

Story names are not always spawn IDs: Jot is `buried/pim`, Emrys is `spheres/ivo`, and Lorn II has separately namespaced people. Inventory story exports, older `LOCALS`, street vendors and late `NPC.identify` assignments, not only the newest quest constants. Reference files can include lore-only people who are never spawned. Record these separately instead of inventing an NPC to satisfy an image count.

Pick a specific figure from a specific sheet. Compare silhouette, proportions, face visibility, garment length, palette and defining equipment before tiny decoration. In this audit Wendel's existing reed head obscured his face where the reference showed a straw hat; Robin had acquired a mushroom cap absent from the chosen drawing; Nima's robe stopped too high. A shared biome motif is not a substitute for an individual's reference. Similar names across worlds must remain separate.

New enemy concepts are design targets, not proof that existing models match them. Record whether an entry is concept-only, implemented, rendered, visually reviewed, or still needs work. For the current enemy brief, each playable world's four slots are two local creatures, one old machine poisoned by a bad spirit and one dark humanoid shadow spirit. Keep peaceful-world concepts separate from encounter activation. Revisit this split if the user changes the brief.

## Build connected moving parts

- Model a hinge at the physical attachment, and translate the mesh outward from that hinge. A flyer wing centred on its span detaches during flapping even when its neutral silhouette overlaps the body.
- Build structural beams from explicit endpoints. The sentinel and First Sign had upper struts rotated upward past the tops of their shins. Use the same knee endpoint for both pieces and a socket that overlaps them. Do not estimate a rotation and hope two independently translated primitives meet.
- Follow the actual garment surface for seams. Padded torso rings used a constant guessed radius around a changing lathe profile and floated off it. Interpolate the shell profile at each seam height before adding a small surface offset.
- Rotate and scale around a part's local origin, then translate it to its attachment. Rotating a previously translated pack ornament swings its anchor around the character.
- Trace each hanging object's load path: pole/crossbar → hanger → loop → cap → lamp. A correctly placed lantern can still float because its connecting stem or chain is absent. Inspect stacks from the side too; each stone's lower face should meet the previous upper face.
- Preserve body-family distinctions: MakeHuman supplies skinned beards, while Quaternius needs the procedural beard. Replacing headwear must not silently delete masks or duplicate existing skinned hair.
- Mutable appearance belongs to the individual. `makeMaterial` caches by options; shared eye materials made different enemies flash together. Give per-enemy warning materials unique ownership and release them on removal. Verify both colour isolation and stable material counts across spawn/despawn cycles.

- Preserve quaternion orientation when layering recoil or gestures. Setting a single Euler roll after quaternion yaw can invert a body beyond 90 degrees because the equivalent Euler representation includes a PI pitch and roll. Compose local rotations and test full turns, not only heading zero. This audit caught the shade flipping upside down.

## Capture real states, then inspect

Run `node scripts/character-quality-shots.mjs` for the story casts and `node scripts/enemy-quality-shots.mjs` for enemy families and guardians. They use temporary muted Chrome profiles and ports 5488/5489, never the user's 5173 server. Outputs live in ignored `output/character-local/quality-pass/`. The scripts need desktop Chrome, the repo dependencies and write access to their output/cache directories.

Story-character captures cover idle front, walking side, seated rear and talking three-quarter. The traveller uses idle, walk and run: the Studio’s seated story pose only applies to NPCs, so selecting it for the traveller does not validate sitting. Crowd captures screen four seeded bodies per playable world. This is a screening set, not exhaustive pose acceptance: recapture suspect characters alone, with hands/feet and waist/hem close-ups, and multiple motion phases. The studio's full-body sheet fits the current skinned bounds including hats/tools. Bounds must be refreshed after posing. A fixed head-centred crop can hide long tools and tall headwear.

Enemy capture uses the real material/G-buffer renderer. Establish runtime state before judging: shades initially have `melt=1` and need to finish emerging; floating guardians need their controller's `hover` offset. Otherwise an isolated screenshot falsely shows a missing shade or a whale cut in half by the floor. Intentional shadow dissolution, unsupported floating magic and opaque structural joints need different acceptance criteria. Inspect attack wind-up, strike, recovery and locomotion, not only idle. Guardian-specific attacks need their actual IDs and progress ranges; a generic sweep capture does not exercise every attack. The enemy capture script records one representative attack at k=.95 and k=1.15, plus the open state, for each guardian builder. Inspect the saved enemy-coverage.json before making broader claims.

Check attachment continuity from front, side and rear, especially machine knees, wing roots, neck chains, shoulder sockets, cuffs, worn packs and hand grips. A rear seated cast sheet omits stools and can look unsupported; use a single-person seated preview to judge actual support and lap/hem contact. Geometry bounds and normalized skin weights cannot detect all clipping, wrong silhouettes or missing fingers.

Use numerical regression tests for a demonstrated invariant (wing-root overlap throughout flap, independent warning colours, material release). They supplement visual inspection. Keep the review matrix explicit about untested costumes, fallback bodies, crowds and motion phases; never label every character artifact-free because screenshots were generated successfully.


## World-enemy implementation lessons

- Use the same committed spatial zones for ground warnings and damage. Test each contact once, wall occlusion, dodge escape and parry interruption of multi-hit attacks. Keep machine anatomy separate from temple-only encounter rules.
- Batch static meshes by material within each animated joint, never across pivots. Preserve smoke, rotors and independently posed fittings. Dead-machine fragments may outlive their owner: defer material disposal until the debris expires.
- Inspect wings from the front as well as above; a connected horizontal panel can become an unreadable edge. Follow shell curvature with seams rather than laying a flat decorative arc above it.
- Use a small numerical tolerance for ground contact; terrain interpolation produced a harmless 8.88e-16 offset in the fan test. Keep the tolerance far below visible movement.
- Use `scripts/world-enemy-shots.mjs` for 100 roster models, four states each, and `scripts/world-enemy-smoke.mjs` for Arena integration and gallery interaction. Record which sheets were actually inspected; captures alone are not acceptance. Procedural interpretations share rigs and attack patterns, so do not describe 100 roster entries as 100 uniquely sculpted bodies or 200 unique attack mechanics.
