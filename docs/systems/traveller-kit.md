# The traveller's kit: rucksack, flask and their hooks

The traveller wears clothes built on the people's own body (`src/traveller.js`
`travellerKit`, skinned to its bones) and, on his back, an ordinary canvas
rucksack. The fluid tank (`src/fluid-tool.js`) is a slim glass flask that sits in
the rucksack's outer face. The look and its reasons:
`lore/characters/traveller-design.md`.

- **The chest frame** (`Humanoid.chestAnchor`): y 0 at the hips, the collar at
  0.76, +z forward. The rucksack (`RUCKSACK`: back face, depth, width, bottom,
  top), the flask (`TANK.at`, `TANK.scale`), the lantern (`LANTERN_AT`) and the
  makers' star (`TRAVELLER_STAR`) are all placed in it.
- **The rucksack** is rigid on `spine_03`: body, lid, lid straps and buckles,
  side pocket, bedroll, plus an outer pocket marked `pack: true`. Those pieces
  are `Humanoid.packPocket`; `FluidTool.updateWorn` hides them while the flask is
  on the back (`where === 'back'`) and shows them again when it is not found
  yet or sits in a vehicle's socket. The rucksack itself never hides.
- **The flask** is the old lathe glass flattened (`TANK.squash` across,
  `TANK.depth` front to back). The fluid shader works in the glass's own object
  space, so the flattening does not change its bands or level. `TANK.straps` are
  the leather bands' heights, kept below the fluid and at its brim so the three
  charge bands always show from behind (the HUD relies on that).
- **The scout's dock**: without the flask, on the rucksack's lid (`kit.dock`,
  `Gear.packDock`); with it, clamped to the top of the flask's left upright
  (`TANK_RAIL`, `SCOUT_DOCK_*`), high enough that the arms don't swing into
  it in any clip. While the wings are open it hops onto the cap
  (`scoutDockPose`). The dock rides the flask into a vehicle's socket.
- **Hair** (`travellerHair`): a scalp shell plus deterministic clumps
  (`clump`): broad, flat, leaf-shaped sheets laid along the skull egg, tapering
  to a point, with a wave and a lift at the end. Each has vertex colours for its
  lighter strand lines, which the outfit material multiplies into the hair colour.
- **Boots** (`F.boot`): lofted round the body's own foot points (sections heel to
  toe, a rounded box each), a shaft fitted to the ankle, a thin sole; the toes
  are skinned to the ball bone, the shaft to the shin. Nothing of traveller.glb
  is drawn any more (it only keys `travellerKit`'s cache).

- **The fluid glove** (`fluidGlove`, `GLOVE`; `Humanoid.wearGlove`): the glove the fluid comes out
  of, on the right hand, after the coral-shirt sheets. Its leather is the skin's own hand (every
  triangle from `GLOVE.cuff` up the forearm to the fingertips) pushed out along the welded normals,
  with the skin's weights, so it bends with every finger; a pale band round the cuff, a brass fitting
  where the hose comes in, a plate on the back of the hand and three knuckle studs. Both travellers
  wear it: the people's body (`wearOutfit`) and the coral-shirt one (`createTravellerV1`, on his own
  mesh). `fluid-tool.js` shows it with the tank and only then (`glove.show`: while it is on, the
  skin's triangles under the leather are left out of its index, else they show between the
  fingers). The knuckles light for the charges left, the plate in the mode's tone; the shot, the push
  and a dry press leave from `glove.muzzle`, just in front of the knuckles (the aiming fist's front),
  and the hose ends at `glove.inlet` on the cuff. It replaces the old wrist bracer, whose brass
  barrel and lens lay along the back of the hand and read as a phone held in it; the old hero's
  handheld screen (`Gear`) is gone too: nothing is held in the hand.

Tests: `tests/glove.test.js` (worn with the tank only, the skin under it, the mouth at the knuckles
in every aim, the lights), `tests/traveller.test.js` (fit, rucksack, flask size and visibility, hair,
face), `tests/drone.test.js` (docks and clearance in every clip),
`tests/abilities.test.js` (the pocket while the flask comes and goes).
