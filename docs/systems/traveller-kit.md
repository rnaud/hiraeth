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
- **The flask** (2026-10-08, selected Ivory and Jade study) is a flat rounded rectangular
  glass reservoir on the upper back, about 26 cm wide and 29 cm high before its fittings.
  Ivory enamel rims with thin brass piping frame both faces; a sage pad sits against the
  body. Leather shoulder tabs and a brass stopper; no hose leaves it (below, "No hose").
  `buildFlask` shares the same model between the worn kit and the inventory picture.
  The fluid face stays clear, with three little etched charge marks at each edge.
  The upright rails, scout dock, lantern, wing clearance and vehicle handoff retain their
  existing attachment frames. Source: `references/Core Objects/Backpack Colour Explorations/03 Ivory and Jade/`.
- **Its fluid** (`materials.js flaskFluid`, kind 0) is jade green and alive. `uFluidBase` is
  `TANK.base`, or a gun mode's first tone: stilling's blue, ember's orange, bloom's leaf green.
  The blend's tones turn through it in slow, domain-warped streams with a core of the next tone,
  and pen-width dark veins mark where they meet the green. It stands at the magic bar's level (a unit, a third of
  the glass each, a short etched mark at each third) under a pale glass edge and a highlight,
  over a thick green glass foot. The lava bands of the old tank are gone (`fluidLava` still draws
  the globs and the wings). `TANK.straps` is empty: no leather band crosses the fluid.
- **Where it sits**: `Humanoid.tankAt` overrides `TANK.at`. The coral-shirt traveller
  (`traveller-v1.js TRAVELLER_V1_TANK_AT`) has no rucksack, so the reservoir sits right on his back.
  The old body keeps `TANK.at`, half sunk into its rucksack. A vehicle's socket and the hand-off
  keep `TANK.scale` either way.
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
  with the skin's weights, so it bends with every finger; a pale band round the cuff, a capped brass
  fitting on the back of the wrist (`GLOVE.fitting` up the forearm) holding a small glass **vial** of the
  tank's fluid, a plate on the back of the hand and three knuckle studs. Both travellers
  wear it: the people's body (`wearOutfit`) and the coral-shirt one (`createTravellerV1`, on his own
  mesh). `fluid-tool.js` shows it with the tank and only then (`glove.show`: while it is on, the
  skin's triangles under the leather are left out of its index, else they show between the
  fingers). The knuckles light for the whole units of magic left, the plate in the mode's tone, the vial
  (`glove.vial`) in the fluid's second tone, brighter as the glass fills and flashing as it fires; the shot,
  the push and a dry press leave from `glove.muzzle`, just in front of the knuckles (the aiming fist's front). It replaces the old wrist bracer, whose brass
  barrel and lens lay along the back of the hand and read as a phone held in it; the old hero's
  handheld screen (`Gear`) is gone too: nothing is held in the hand.

- **No hose** (October 2026, the author's call): the ribbed hose from the flask's collar over the right
  shoulder and down the arm into the cuff (`Hose` in `fluid-tool.js`, re-laid every frame along a curve
  through the shoulder, elbow and the glove's `inlet` anchor, and from the cap into a vehicle's engine port
  while the tank sat in its socket) is gone, with the flask's brass elbow and pipe (`TANK.outlet`), the
  glove's `inlet` anchor and the shader's hose branch (fluid kind 1, its running pulse). It was true to the
  references but stiff in play: it bent poorly round the shoulder and through the aiming poses. The tank and
  the glove read as one kit through the glove's own fitting and its vial lit with the same fluid, the
  knuckles and plate in its tones. The story's lines that had the water "climb your hose" now pour it into
  the tank.

Tests: `tests/glove.test.js` (worn with the tank only, the skin under it, the mouth at the knuckles
in every aim, the lights, the vial lit by the fluid, no hose anywhere), `tests/traveller.test.js` (fit, rucksack, flask size and visibility, hair,
face), `tests/drone.test.js` (docks and clearance in every clip),
`tests/abilities.test.js` (the pocket while the flask comes and goes).

The scout now uses ivory outer petals, sage lower hull, pale green inner petals and aged
brass rims to match the selected kit. Its four-petal deployment, rotor parking, lens wake
and two-draw-call construction are unchanged. Reference: Folding Scout - States v2.

The ship and skull references are recorded in `references/REFERENCE-SELECTION.txt`.
The skull's lower jaw slopes into the sand at its front; the approach goes around
its solid side bones. The ship's overhead storage is decoration outside the walking
area, so it does not push the traveller onto the galley counter.
