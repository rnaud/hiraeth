# Carrying small things (v1.76, issue #337)

The author: "I should be able to pick up and put down small objects, that should be put to use for puzzles. Like grab a
box from afar with the grappling hook, then put it down on a switch so I can go through a door."

## The rules (`src/carry.js`)

- **What**: any loose thing shaped as the gadgets' `Prop` (`src/gadgets/world.js`: `object`, `pos` its middle, `r`, `h`,
  `vel`, `held`, `name`, `mass`, `metal`) registered with `registerCarryable(thing)`. `canCarry`: `r` at most
  `CARRY.maxR` (0.6 m), `mass` at most 1.5, not metal, not `carry: false`. The Gadget Yard's and the makers' courts'
  crates register themselves (`GadgetWorld.addProp`); the metal crates stay the magnet's. The temples' weights
  (`pieces.js` `Weight`) are the other kind.
- **Picked up**: the use button (X / □, E) within `CARRY.reach` (1.9 m to its side along the ground, `rise` 1.6 m up or
  down), on the ground: "pick up the crate". It rises into his arms over `lift` 0.3 s and is held in front of his chest
  (`fwd` 0.38 m + its radius, `up` 1.02 m), square to him; its collider is set aside while carried
  (`physics.removeCollider`, `restoreCollider` when it is let go) and its `held` is `IN_HANDS` (no gravity, no other
  gadget takes it, it weighs nothing on a plate).
- **The pose**: `Player.finishFrame` lays `Humanoid.handOff(point, k, up, width)` over the clip (the backpack hand-off's
  two-handed grip, `width` the thing's half width): the hands on its sides, the elbows out and down, the chest turned a
  little to it; the fingers grip (`src/hands.js` `handoff`).
- **Carrying**: a walk at `speed` 0.62 of the walk, no sprint, a hop for a jump (`jump` 0.5 of its speed), no double
  jump, no wings, no jets, no climbing; the gun, the blade, the guard, the evade and the gadget in hand wait
  (`src/fluid-tool.js`, `src/gadgets/index.js`).
- **Put down**: the use button again ("put it down"): `putSpot` in front of his feet (`put` 0.7 m + its radius) on the
  floor there (not off a drop of more than 1.1 m, not into a wall: nearer him, or nowhere); near a snap
  (`registerSnap`: a plate, within its rim + `snap` 0.9 m) on its middle, on its top ("set it on the plate"). With no room
  anywhere the press lets it down where it is.
- **Thrown**: the blade's button (RB / R1, F) once it is in his arms: `throw` 6.5 m/s ahead and 4.2 up (and half his own
  speed), a few metres; the press is no swing (the blade waits for the button to be let go).
- **Let go**: a climb or a mantle, the water, a mount or a vehicle, the wings or the jets, a knock-down (`mustDrop`).
- **The hook**: fired at a carryable (`src/gadgets/hook.js`: its aim takes `carryables()` too, `hookable: false` aside),
  it drags it in as a light crate, and once it is `dragTo` away it lands in his hands (`pickUp(…, { from: 'hook' })`) if
  his hands are free and he stands; too big or metal, it is let go at his feet as before.
- **The first time** (`carry.taught`): "Carried in both hands: X / □ puts it down, RB / R1 throws it." (`carryHooks.notice`,
  main.js and engine/game.js toasts). carry.js imports i18n's `t` as `tr`: `pickUp(p, t)`'s own `t` hid it, and the
  first pick-up of a save threw out of the frame loop and froze the game (issue #374; `tests/i18n-shadow.test.js` scans
  every file for a local `t` called in i18n's place).

## In the temples (`Weight`, logic `weight`)

A **weight** is a block of the house's stone (`pieces.js` `Weight`, `WEIGHT.size` 0.8 m: the stone, two trim bands, the
glyph on its top and two sides, glowing brighter while it sits on its plate). Its element `{ type: 'weight', room,
plate, needs?, optional? }`: set on its plate (put down by it: the plate is a snap; thrown, come to rest on its disc) it
holds the plate down while it sits there (`logic.pressed` counts it, as a drum's); picked up, the plate lets go at once.
So a door with `opens: { pressed: plate }` and no latch is open only while something weighs its plate down. Saved:
`temple.<id>.weight.<id>` is the plate it sits on; put down elsewhere, `weight.<id>.at` is where (the kit's frame). In a
pit, more than `fall` m under where it lay (3), or come to rest outside its `zone` (its room), it is back where it lay
(`back` says so). Stood on its plate and stepped off with the weight elsewhere, `hint` is said once. The solver
(`logic.js solve`) carries a weight onto its plate in its room (`carry w onto p`), `next()` points at one a shut door
waits for (not an `optional` one: a reward's), and the condition `{ weightOn: [weight, plate] }` asks for that one weight.

- **The Rose House's Dry Channel** (the house's first carry): the pier is 8.6 m long east to west (`PIER`, it was 4.6;
  its gaps to the ledges as they were, 9 m each, the double jump's), the plate at its east end, the Givers' weight at its
  west end. The plate holds the chamber's door at the top of the gallery open only while weighed down (it latched for
  good when stood on): stand on it and the door opens, step off and it shuts ("Something heavier must hold it down");
  carry the weight onto it and the door stays open, the way on and the way back. A save past that door (it latched open,
  or anything after) finds the weight on the plate (`migrate.js` desert v3; `save-migrate.js` `GIVERS_DONE.weight`).
- **The Mooring-House's Capstan Hall** (the hook's pull, then the place): on the hall's east side a coffer caged by the
  wall (`Coffer` `cage`: brass bars that sink while its `when` holds, and rise when it doesn't, until it is opened), a
  plate before it 6 m away (`CLEAT`), and the moorers' weight high on a cleat where a slack cable meets the wall, 8.6 m up:
  out of any jump. The grappling hook pulls it down into your hands; set on the plate, the cage sinks; opened, the coffer
  is the moorers' chimes. A reward: `optional`, the marker leaves it alone, nothing waits on it.

## In the engines

The pose and the thing carried are the scene's (the traveller's bones, the thing's object): the scene mirror takes them
to Unity and Godot as any other. `screen.carry` (`src/platform.js`) is `{ name, how }` while something is carried, `how`
'hand' or 'hook'; the prompt ("put it down") is `screen.prompt` as every interact's.

## Tests

`tests/carry.test.js`: what may be carried; picked up, held at the chest, put down on a plate's middle and solid again;
no room in a wall or over a drop; thrown a few metres; let go by a climb, the water, a mount, the wings, a knock-down;
the laden walk and the hop; a plate holds its door only while weighed down, saved, the marker and the solver; the two
houses solve and the Rose House's old save; in the real Mooring-House the hook's reticle catches the weight on its cleat,
pulls it into his hands, it is set on the plate, the cage sinks and rises, the coffer opens. `tests/temples.test.js` (the
Rose House on foot: the plate stood on and stepped off, the weight carried and put on it), `tests/temple-playthrough.test.js`
(every weight on the way picked up with the use button, carried and put on its plate for real), `tests/gadgets.test.js`
(the hook drags a crate into your hands, a big one to your feet).
