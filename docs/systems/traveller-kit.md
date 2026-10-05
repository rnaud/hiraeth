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
- **Hair** (`travellerHair`): a scalp plus deterministic tousled locks
  (`lock`), each with a vertex colour that lightens its edges, which the outfit
  material multiplies into the hair colour.

Tests: `tests/traveller.test.js` (fit, rucksack, flask size and visibility, hair,
face), `tests/drone.test.js` (docks and clearance in every clip),
`tests/abilities.test.js` (the pocket while the flask comes and goes).
