# The scout drone

The folding drone that leads the way to the objective (sending it: docs/systems/ui.md, "Nothing on the screen").

## The scout keeps pace (v0.39)

While guiding, the scout (`src/scout.js`) leads `guideLead(speed)` metres
towards the goal from where you are (6 m standing, up to 15 m flat out), and
`fly(dest, max, up, dt, carry)` adds your velocity as a feed-forward, so it
stays ahead on a bike or a bird instead of trailing. It faces the goal itself
(`aim`, pitch included) with a lit cone off the lens, and lays a thin glowing
`Trail` that dissolves once it is home. It only gives up and flies back when
it is more than 27 m from you.

## The scout drone folds (v0.46)

The scout is a folding drone (`src/drone.js`), built like a seed pod: an
ivory lower hull with a blue rim, a rubber foot and one big brass-rimmed lens,
and an upper half of four blue shell petals hinged on the rim, with a small
rotor on the inner face of each and a whip antenna in the middle. Folded, the
petals close into a dome over the rotors (blades parked along the petals), the
antenna is drawn in to its brass bead, and the lens squints to a slit: a 21 cm
egg. Unfolded, the petals swing out and down into vanes (`PETAL_OPEN`, so the
rotors stand upright), the rotors spin up with a pale blur ring, the antenna
springs up and sways with the drone's accelerations, and the lens lights.

- **One draw call** for the drone: the painted parts (`vehicle-kit.js` paint)
  merged into one `SkinnedMesh` on 15 bones (hull, petals, rotors, blur rings,
  antenna rod and bead), bound folded; the glowing lens is its own small mesh.
- **`DroneFold`** is the state machine (`folded`, `unfolding`, `open`,
  `folding`): the eye opens, then the petals bloom, then the rotors spin up
  once the vanes are out; closing, the rotors spin down and park with their
  blades along the petals before the petals shut, and the eye closes last. It
  can reverse at any point; `snap()` jumps (teleports, recalls).
- **Launch and landing** (`DOCKING` in `scout.js`): it hops off the dock still
  folded, eye open, straight out along the dock's line (`out`: away from the
  surface and back from you), blooms once clear, then flies. Coming home it
  folds on the way in, lines up at the end of that line, and glides down it
  onto the dock in the dock's frame (so it keeps up as you move), turning to
  sit flush. If the dock itself jumps on the body (the radio pack giving way to
  the tank), it glides over, folded.
- **Flying**, the body stays near level (pitch at most `PITCH`) and leans into
  its speed (the lit beak that pointed at the goal is gone, October 2026: the
  drone's heading is the only pointer).
- **Docks** (`DOCK_ON_TOP`, `DOCK_ON_SIDE`): on the rucksack's lid (the radio pack's flat top until October 2026), foot
  down, lens looking back at the camera (`kit.dock` is where the foot rests,
  `gear.js` adds `DRONE_BELLY`); once the tank is found, on top of the flask's
  left upright beside its neck (docs/systems/traveller-kit.md), above the lantern
  (`SCOUT_DOCK_*` in `fluid-tool.js`). The dock is a child of the tank's group,
  so it rides into a vehicle's socket with it, but not the tank's growing in
  when found. While the fluid wings are open the rail is in their way, so it
  hops up onto the cap between their roots and back (`scoutDockPose`).
- `tests/drone.test.js` checks the fold's order, the folded shape (rotors
  inside the shell) and the open one (rotors upright), the docked shape inside
  a clearance volume over the pack and beside the tank (on the rail, off the
  glass, clear of the bracket, the lantern and the antenna), no arm, hand or
  the helmet through it in every clip (idle, walk, jog, sprint, jumps, drive,
  climbing, the ledge) on the pack, the rail and the cap, the cap clear of the
  open wings, and the launch and landing paths.
