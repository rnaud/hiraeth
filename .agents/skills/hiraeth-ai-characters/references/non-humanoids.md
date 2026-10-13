# Non-humanoid creatures and guardians

## Start from the game's motion contract

Read the selected factory in `src/temples/guardians.js`, its temple definition,
and `src/temples/boss.js` before generating. The existing guardians are animated
hierarchies of rigid pieces, not MakeHuman skins. Their controller calls
`animate(dt, t, { state, attack, k, speed, meter, phase, kit })` after placing the
root in world space. Preserve this interface, or explicitly adapt it to the
new rig. Keep controller movement authoritative rather than adding clip root
motion on top of it.

Inventory independent moving parts and gameplay anchors. `mouth` is a world-space
target used for fluid hits and the final touch interaction; a visually opening
jaw with a stale target is broken gameplay. Radius, height, body target and
hover values are gameplay measurements, not automatic mesh bounds. Fit them
deliberately and check reachability in the actual arena.

The Cistern-Keeper currently has six hip/knee chains stepping in alternating
tripods, a five-part neck, head, jaw, body rise/tilt/sink and calm-dependent
shell glow. `desert.js` defines stamp, sweep/sweepBack/stampEnd, charge, burrow and spit.
The current Keeper uses `GuardianLegs` for planted feet; preserve its terrain,
turning and attack-lift behavior, `tellRig`, `part()` anchors and phase marks. Other guardians need
their own inventory (fins, wings, rings, vents, roots, dishes); this is not a
universal skeleton.

## Generate for that anatomy

Specify limb count, attachment locations, separated appendages, mouth seam,
and a neutral rest pose appropriate to the animal. A human T-pose is not the
default. Inspect the reference before spending on 3D generation: missing or
merged legs are structural defects. Multiple views must agree in anatomy and
proportions; a single coherent view is preferable to contradictory turnarounds.

Inspect the service's current rigging support before choosing an automatic rig.
An available humanoid/quadruped preset is not evidence that six legs, articulated
necks or jaws are supported. Preserve the untouched export and provenance.
Inventory the downloaded geometry, skin, weights, materials and clips; a service
preview does not prove those are exported.

Choose between separately pivoted rigid parts, a custom skinned skeleton, or a
hybrid according to the actual mesh. Reuse the existing state driver where it
fits. A fused organic mesh needs weighted deformation or carefully reconstructed
part boundaries; parenting the entire mesh to the body does not animate limbs.
Do not inherit traveller-specific fitting, color segmentation, cloth, or facial
repair coefficients.

## Prove wiring and deformation separately

Exercise sleep, wake, moving fight, each attack's wind-up/strike/recovery,
open, weary, resolved and reset through the real controller. Check the mouth
opening and fluid hit, final touch reach, floor contact, turns, calm feedback,
and attack timing. Burrowing intentionally crosses the floor; distinguish it
from unintended foot penetration.

For a skin, audit bind roundtrip, normalized weights, meaningful influence for
every required chain, and actual vertex displacement under isolated joint motion.
For rigid parts, audit pivot positions, hierarchy, inherited transforms and
visible displacement for each part. Check translated and rotated roots, not only
the origin. Verify anchors after pose and world-matrix updates.

Use the real material/G-buffer and render pipeline; inspect front, side, back
and three-quarter views at reproducible motion phases. Check full cycles for
sliding feet, collapsing necks, split seams and fused jaws. Controller unit tests
and procedural placeholder motion are useful baselines, but neither proves a
generated mesh is correctly wired or visually acceptable.

Keep the previous guardian available until the replacement has passed asset,
deformation, rendering and gameplay review. Promote one guardian at a time and
record which motions are exported clips versus runtime procedural animation.
Record unverified stages explicitly; this reference describes the existing
contract and acceptance process, not a completed generated-guardian pipeline.

## Keeper auto-rig evidence (2026-10-12)

The approved six-legged Keeper generated a useful mesh, but Tripo's **Other**
rig was not usable. Its GLB omitted node rest transforms and effectively assigned
all vertices to one root; FBX preserved more rig data but left 29 of 53 bones
without influence and deformed unrelated legs during one isolated joint rotation.
Check an alternate export before attributing a failure solely to the rigger.
Neither the hosted skeleton overlay nor normalized weight sums establish usable
articulation. Reject that rig and build or repair the anatomy-specific skeleton
and weight fields rather than spending repeated blind auto-rig credits.

## Reusing locomotion on a generated skin

Keep the existing gait planner and controller, and fit a skin adapter to the
actual source mesh. Give the motion kit measured segment lengths rather than
assuming its procedural model's limb proportions. When feet are planned in world
space, copy the solved segment frames into independent limb bones outside the
body's telegraph frame; putting them under that frame applies body motion twice.
Keep attached neck/head/jaw chains under the body. Test bind roundtrips and actual
vertex displacement, then translated/rotated walking with planted foot targets.
A successful isolated review does not establish temple combat or final-touch
acceptance. Label runtime procedural motion separately from exported clips.

For an open-mouthed source, validate the hinge and both lips in a profile close-up
before increasing the closing angle. A weight-isolation test can pass while the
wrong anatomical region is weighted: independently identify fixed upper-muzzle
vertices and moving lower-lip vertices. Compare jaw open/closed at a matched base
pose, then inspect the combined neck/jaw motion. For perceived choppiness, separate
render cadence from discontinuous targets, abrupt loop resets and near-straight
IK knees. Independent feet still need support constraints; avoid random uncoordinated
steps. Keep gait changes opt-in so another creature's accepted motion is preserved.

## Wiring a generated guardian into its temple (Keeper, issue #267)

- Copying the kit's rigid segment frames into skin bones is not enough: `aim()` uses the shortest
  turn from +Y, which flips half a turn about the segment for a leg pointing nearly straight down.
  Frame skin bones in the leg's bend plane with a rest offset (`src/characters/creature-legs.js`)
  and measure the largest per-frame bone rotation, not only joint positions.
- Never nest the creature's group inside another: the kit converts world foot targets through the
  group's local matrix. Swap bodies by replacing the group in its parent
  (`src/temples/guardian-generated.js`), keeping pos, heading, mouth and gameplay sizes on the
  wrapper so the fight's closures and hit spots survive the swap.
- Check in the real temple, not only at the origin: temples sit 2400 m up, which exposed the far
  tier's stale swing heights and the nested-group foot targets that node tests at y = 0 hid.
- A gait reviewed at a slow walk may not keep up at the fight's speed; audit at the controller's
  own speed (an insect-like walker can switch to tripods there: the planner's `fast` gait).
- For long-toed feet, measure contact on the pad near the foot bone; the lowest toe tip changes.
