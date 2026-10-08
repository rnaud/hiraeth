# The scout drone

The folding drone that leads the way to the objective (sending it: docs/systems/ui.md, "Nothing on the screen").

## The scout keeps pace (v0.39)

(Until v0.62 the scout guided all the time; since then it goes out only when sent, the ping:
docs/systems/ui.md, "Nothing on the screen", and "Up and down" below.) `fly(dest, max, up, dt, carry)`
still adds your velocity as a feed-forward, so out on a bike or a bird it keeps ahead instead of
trailing, and it lays a thin glowing `Trail` that dissolves once it is home. It gives up and flies home
when it is more than `FIND.near + FIND.out + 20` m (41 m) from you.

## Up and down (v0.89)

Until v0.89 the scout only ever went out sideways: `lookout()` started 3.2 m over your feet, took the
way to the goal, **dropped its vertical part** and went `FIND.out` m along what was left. A goal on a
tower's deck, a rooftop, the floor above or a cave below got the same spot as one across a plain, at your
own height; only the lens (and the body's `PITCH`) tilted at it. Straight under a goal it just hovered
over your head. Indoors that spot (3.2 m up, 7 m out) was often in the ceiling or behind a wall, so it
pressed against them.

`lookoutSpot()` (exported, pure, `tests/scout.test.js`) now picks the height too, over your feet along
the world's up (gravity wells included):

- **above**: 2.2 m over the goal's level, at most `FIND.climb` (6.5 m) over your feet, or up to
  `FIND.shaft` (20 m) when the goal is steeply overhead (twice as high as it is far, blending in from
  45°): up a shaft, through Incal's oculus, up the side of a tower you stand under;
- **below**: it sinks by how much deeper than `FIND.level` (4 m) the goal is, at most `FIND.dive` (6 m)
  under your feet (a few steps down is still your floor);
- **further out the more it climbs or sinks** (`FIND.spread`, 0.5 m per m), so it stays in the camera's
  view behind you: in the Desert, 7 m out and 9 m over your feet is off the top of the screen;
- **in the open**: three legs from your head (up to the higher of the two heights, out along the
  ground's plane, down to the goal's height), each cut 0.6 m short of the first thing a ray meets, so the
  spot is under the ceiling, short of the wall, over the floor; then lifted out of the heightfield (the
  rays only see meshes). The flight goes straight there when it can see it, else to the legs' corner it
  can see (the top of the climb, the edge), so it rises up the shaft before it goes out over the rim.
- A guardian's hint stays at `HINT.rise` by you, as before (the fight is all round).

The find's line says how far up or down when that is a good part of the way (`findText`, `target.rise`:
"The observation deck · 27 m, 10 m above" only once the height is more than 6 m and 30 % of the
distance), and a flare far below you rises 12 m past your feet (`Flare.drop(at, up, below)`).

Measured in headless Chrome (the hover's height over your feet, before → after): the Desert, Marrow on
the ridge 21 m up and 131 m off, 3.2 → 6.6 m; at the foot of the Antennas' observation deck (10 m up,
27 m off) 3.3 → 6.7 m; Incal's Jets' Chamber, the gallery 24 m overhead, about 3 → 19.4 m (under the
dome's ceiling); from the deck to the field 12 m below, +3.2 → −3.5 m; a 2.8 m room in the tests, from
pressed against the ceiling to 0.6 m under it. `scout.update` while it is out: about 0.1 ms a frame on the
Mac either way (it casts 4–6 more rays a frame, only while it is out).

Known limits: there is no path-finding. A goal far below the edge of the deck you stand on (the
Underside's tip deck from the upper deck) gets a spot over your own floor, its lens and the flare's
column pointing down; a goal upstairs from a room gets a spot under the ceiling, lens up.

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
