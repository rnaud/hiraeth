# The traveller's ship: the angular hull (October 2026)

The ship was a 26 m ball with one round deck. It is now the angular exploration vessel the
author selected on 2026-10-09: `references/The Travellers Ship/Angular Exterior - Selected/reference-4.jpeg`
(provenance: `references/batches/2026-10-09-selected-family-currency-ship-sword.json`). That
picture is one view, painted, not measured: the prompt behind it asked for "24 metres long,
8 metres wide", but nothing in the image fixes a scale except the one person beside the ramp,
and Midjourney draws doors and people at whatever size reads well. So the dimensions below come
from a blockout at human scale first, with the traveller as the unit, and the hull was then drawn
round the rooms, keeping the picture's silhouette, panelling and colours.

## What the reference fixes (and what it does not)

Read off the picture, in the order you notice it:

- **Silhouette**: a long faceted box, low and broad, on short legs. A wedge bow: the nose is a
  small flat plate at sill height, the windshield slopes up and back from it to the roof, the chin
  slopes down and back from it to the belly, and in plan the bow narrows to the nose (a trapezoid).
  The stern tapers a little and ends in a flat plate.
- **Panelling**: big flat panels with inked seams; the upper hull cream, the aft half's upper hull
  muted lavender panels (from about the middle back), a darker khaki lower hull in two chamfers
  down to a dark belly.
- **One coral stripe** along the cream part at the windows' sill, from the nose to where the
  lavender starts, broken by the door frame and the slot window.
- **Windows**: two big windshield panes either side of a central frame on the front slope, a side
  pane behind them; a tall narrow slot window just aft of the door. Nothing else on the visible side.
- **Engines**: "two slender aft propulsion pods on short pylons": in the picture two tapering cream
  pods rise up and back from the stern's top corners like fins.
- **Landing gear**: short splayed struts with round pads, along the lower hull; **a side door** in
  the lower cabin with **a steep stair-ramp** with rails down to the ground.
- **Not fixed by the picture**: the far side, the stern face, the belly, the roof, the door's real
  size (it is drawn about a person's height, under the stripe), where the deck lies. Those are
  derived below, consistent with the visible side, and mirrored where nothing says otherwise. The door
  is on the ship's port side in the picture (bow to the left, the door facing the viewer), so it is
  on the port side here too.

## Twice the size (issue #338)

The author: "My space ship and its interior should be 100% bigger. So it's more spacious inside when I'm walking around
and feels less cramped." The ship is built `SHIP_SCALE` (2) times the blockout below: `src/ship/hull.js` keeps the
blockout's numbers as its design (`D`) and builds the hull from them, every piece scaled on its way into the batch; what
it exports (`HALF_W`, `CEIL`, `STATIONS`, `OPENINGS`, `LEGS`, `sectionAt`, `undersideAt`…) is in built metres. So every
length of the hull, its rooms and its openings doubled: the rooms 15.2 m across, 5.8 m under the ceiling, the main room
20 m long, the doorways 4.2 x 3.6 m, the hatch 3.2 x 3.6 m (the doorways and the hatch kept lower than twice: at 5.2 m
they were a hangar's), the hull 52 m long, 16.8 m wide, 12 m tall, the deck 4 m up on its legs (the belly 0.8 m off
the ground). **The furniture keeps the traveller's size**: `src/ship/interior.js` draws each block where it stood in the
blockout's room and moves it whole (`at(dz, fn)`, `at(grown(x, z), fn)`): along a wall with its wall, by the cockpit frame
with the frame (`BY_FRAME`), free-standing ones (the holo table, the small table, the crates) where their spot is in
the grown room; the console, the voicemail, the projector and where he stands to play the recordings follow the table
(`TABLE.z + …`), the seats the dash (`SEATS`).

- **What the room gained**: a table to eat at with two benches by the galley (`DINING_Z`), a reading corner on the
  starboard side (an open bookcase, an armchair, a floor lamp, a round rug: `READING_Z`), a workbench with a vice and a
  stool aft of the coats (`BENCH_Z`), a runner down the middle; in the back room a big round rug, a trunk and a tall
  bookcase with a ladder on the forward wall; in the hold, stacks of crates and shelves of spare parts over the lockers.
- **The bow**: built twice the size, the windshield's sill (the stripe, 1.55 design) stood 3.1 m over the deck and the
  seated pilot saw the sky alone over the dash; the nose plate and the windshield's foot came down (the stripe sweeping
  down to the nose), the panes from about 1.5 m: the painted reference's long wedge and big panes.
- **The bunk's alcove** stands round the hull's starboard window, its arch 4.25 m high; the bed is a bed long.
- **The landings**: the site search (`src/ship/sites.js`) measures the hull's own plan where it would stand (`probeSite`,
  `fromPlan`), not a disc of its reach round its origin (31 m now, twice the ground it covers); the worlds whose ship the
  search placed (Arzach, Perdide, Edena) keep the spots players know (`SITE_OVERRIDES`; the Buried City's 22 m west,
  its longer bow lay across the furnace steps' course), and the
  Underwater City's ship stood 5.4 m east on the Dock's dome, its legs even about the crown (since issue #572 it stands on
  the sea port's deck over the water, `src/underwater-port.js` PORT_SHIP: on the dome it was outside the glass, and its
  ramp let you out into the sea with no way in).
  `tests/contact-audit.test.js` lands it in every world over its whole plan (hull, sky, feet, ramp). The arrival views
  were picked again (`scripts/arrival-views.mjs`). The take-off hovers 22 m up (15 before). Marrow waits clear of the
  hull's plan (`landing.js planGap`); a spawn under the plan moves to the foot of the ramp (`Ship.covers`).
- **The shots** written in the blockout's cockpit (the prologue's, the homecoming's, Unity's `ShipScene.cs`) go through
  `cockpitZ` (the seats moved 9.8 m forward with it); the prologue's outside shots are as far off as the ship is big.
  The Unity export carries `hull.scale` and `hull.cockpitShift`. Anselm stands in the hold by the crates at (1.55, 19.75).
- `tests/ship-grown.test.js`: the sizes, the furniture at his size, every place you use reached on foot from the hatch
  (the voicemail, the table, the pilot's seat, the bunk, Anselm's spot), the lamps and the room light.

## The rooms' light (issue #338)

"Also the lighting in the ship feels a bit flat? Do we have no light in there?" There was: six lamps under the ceiling,
each a local light (main.js `updateLights`, the shader's `uLights`), and a self-light of 0.18 on every room material. But
the local lights' rule (light anything within reach, a third of it even facing away, then push it most of the way to
full light) washed out whatever stood near a lamp in a pale blot on the ceiling and the walls, and everything else sat in
one flat shade with the same hatching; and the sun's shadow map, cast by the hull's thin skin, let the sun through onto
whatever inside faced it, so which walls were lit depended on the hour and the ship's heading.

Now each room material is made with `makeMaterial({ room })` (`materials.js ROOM_LIGHT`, `interior.js roomLook`):

- **A key light in place of the sun**: from the windshield ahead, a little from the hatch's side and above
  (`ROOM_KEY.dir`, in the ship's own frame: the shader reads the object's normal, so the light turns with the ship and
  nothing is updated). What faces it is lit (`lit` 0.74), what faces away is in the shade (`shade` 0.28) the hatching
  draws, across n·key `edge`; the key-lit faces take a little of the sky's colour; at night it falls to `night` of
  itself and the lamps carry the rooms; in orbit it is weaker (`ROOM_KEY.space`).
- **Twelve warm lamps** (`LAMPS`): pendants on cords 3.5 m up, a teal shade with a cream lining and a warm bulb, over the
  cockpit, the holo table, the galley, the table to eat at, the bunk, the hatch, the lockers, two in the back room and two
  in the hold, and the reading corner's floor lamp. In shades, they light what is under them and faces them (`cone`,
  `face`), a pool of light on the floor round the furniture, warm (`lampTint`, `LAMP_COLOR`), not the ceiling over them.
  They are drawn only, never collided with. The voicemail's light is unchanged.
- **Engine-neutral**: the lamps are the level's local lights, so both Unity pipelines get them; the key crosses as each
  material's `room` (the bridge's `port-format.js`, the C# exporter's `materialOf`; `WorldLoader.cs` sets `_Room`), and
  `Surface.shader` lights a room with the same numbers (`tests/ship-grown.test.js` reads them). The export also writes
  `ship.roomLight` (the key, its strengths, the lamps). Not yet seen in a Unity editor run from here.

## The blockout: the traveller is the unit

(The blockout's numbers, the design `D` in `hull.js`; the ship is built twice this size since issue #338, above.)

- **The traveller**: 1.82 m (eyes at 1.70 m, `FACE` in `src/humanoid.js`). His collision capsule
  (`src/player.js` `CAPSULE`) is 0.45 m in radius and 2.2 m tall; he steps up 0.6 m.
- **Ceiling**: 2.9 m clear over the deck (2.35 m until issue #195, below: "the ship and its interior are too small").
- **Doors**: the hatch 1.6 x 2.6 m, the doorways between rooms 2.1 m wide and 2.6 m high (1.3, 1.6 and 2.25-2.28 m
  before): the camera's tight over-the-shoulder arm (`CameraRig.indoor`) passes through behind him without the lens
  touching a jamb.
- **Walkways**: at least 1.3 m between furniture fronts in the main room (the capsule is 0.9 m across):
  1.7 m between the galley and the curved console, 2.1 m between the holo table and the bunk's alcove,
  2 m between the console's tail and the lockers; the holo table is used from its open (starboard) half,
  inside its use radius `TABLE_R` 1.6 m.
- **Furniture**: counter tops 0.92 m deep 0.65 m; the console 0.95 m high, 0.4 m deep; the bunk
  1.1 x 2.5 m, its mattress 0.56 m up, 1.8 m of headroom sitting up under the alcove's 2.35 m hood;
  seats 0.45 m; the dash
  0.95 m high, 0.75 m deep. Low furniture gets an invisible block 1.1 m tall (`BLOCK_H`) over its
  footprint so walking the deck never lifts you onto it (as on the old deck).

### Rooms, from bow to stern (ship-local metres)

Frame: x to starboard, y up, z aft; the origin is on the deck, on the centre line, at the middle of
the hatch (so `polar(r, HATCH_A, DECK)` is still "r metres out through the hatch", `HATCH_A = -PI/2`,
the port side). The bow is at -z, as the old cockpit was.

| Room | z from .. to | Clear width | What is in it |
|---|---|---|---|
| Cockpit | -9.8 .. -6.9 | 4.9 m at the nose wall, 7.6 m at the frame | the dash under the windshield (a scope and two screens in its middle), two seats side by side, the overhead panel between them, the father's cap and a child's drawing |
| Main room (the picked layout) | -6.9 .. 3.15 | 7.6 m | the holo table in the middle (-0.1, -3.1) in the crook of the curved console, the console's tail running aft with the voicemail button, the projector and the little screen on its end; port: the galley forward of the hatch (an L round the frame's corner, stove and kettle, sink, tool board, cupboards), coats and packs on hooks aft of the hatch; starboard: a chest of drawers by the frame, the bunk in its arched alcove under the window, kit on hooks, the lockers; two skylights, pipes along the ceiling |
| Back room | 3.15 .. 7.95 | 7.6 m | a sofa under the port porthole, a small table with three mismatched seats, a desk and a chest of drawers, clothes on hooks, books under straps, photographs |
| Hold (storage) | 7.95 .. 12.95 | 7.0 m | lockers both walls, crates strapped down (Anselm Thrum stands by them, `src/story/scientist.js` ABOARD), a tool board, spare parts, the engine room's hatch in the aft wall (shut) |
| Engine bay | 12.95 .. 15.2 | (closed) | no rooms: machinery behind the aft wall, the pods' roots |

Doorways: the cockpit frame at z -6.9 is open 3.8 m wide (the cockpit is part of the main room, as
in the Main Interior reference and the picked sheet); the back room and the hold open through 2.1 m doorways
on the centre line.

**Grown for the camera (issue #195).** The author: "Most of the temple rooms are too small and so is the ship and its
interior. I want rooms to feel bigger so the camera doesn't move and shake every time we are in a cramped space." The
rooms are 1.2 m wider (6.4 → 7.6 m), the ceiling 0.55 m higher (2.35 → 2.9 m), the cockpit and the main room 0.8 m
longer at the bow, the back room 0.6 m and the hold 1.8 m longer; the bunk's alcove deeper and higher (1.2 m, hood
2.35 m). The furniture keeps its size: the blocks along a wall moved with it (`at(dz, fn)` in `buildInterior` moves
what a block adds; the galley, the chest of drawers, the sofa, the desk, the small table and the hold's crates), and
the hull grew round the rooms (25.2 → 26.0 m long with the hold, 8.4 m wide, 6.0 m tall). Every interaction point,
the cinematics' points (`cockpitFrame`, `wakeSit`, `tableShot`…) and the export's points follow from the interior; the
cockpit shots written in ship metres (cinematics.js, homecoming.js and the C# `ShipScene.cs`) moved 0.8 m forward with
the cockpit. The probe (the close camera turning round in each room): docs/systems/movement-and-camera.md, "Small
rooms". `tests/room-size.test.js` holds the sizes. The cockpit, the spot by the hatch and the spot by the bunk were still tight for a camera turning round (issue #234): aboard it climbs over his shoulder there instead (movement-and-camera.md, "Small rooms", `CLIMB`), and the hatch's and the bunk's points stand further into the room (below).

### The picked layout (`references/The Travellers Ship/Interior - Lab/sheet-1.jpg`)

On 2026-10-09 the author picked this reference-lab sheet for its layout ("I love the ship layout but the art
style is not Moebius enough"), so the main room follows where things stand in it and keeps the game's own look
(the materials, ink and palette above). The sheet is one wide view from the room's aft end toward the cockpit.
What differed from the first blockout, and what changed:

| In the sheet | Before | Now |
|---|---|---|
| One long room opening straight onto the cockpit, two seats side by side under a wide windscreen, an overhead panel | the frame and windshield as now, one pilot's seat left of centre and a jump seat | two seats at x ±0.95, the overhead panel; the windshield stays the hull's (its panes are set by the bow's slope and the sill) |
| A curved console wrapped round a round holo table in the middle of the room, its near end coming toward you with the voicemail screen on it | the holo table free-standing at the front of the room; the voicemail button, the projector and the round screen on the cockpit's dash | the table in the middle, the console round its port half (a J), its tail aft with the button, the projector and a boxy little screen; he stands behind the tail facing forward, so the recordings play with the room and the windshield beyond the busts |
| The galley along the left (port) wall between the door and the cockpit, an L at its forward end, a tool board and cupboards over it | the galley along the starboard wall under its window | the galley along the port wall forward of the hatch, the L along the frame's wall, a pegboard of tools and a shelf of jars over it |
| The door at the near left with a porthole in it, coats and packs on hooks beside it | entry lockers and a bench forward of the hatch, a sofa aft of it | coats and packs on hooks aft of the hatch, a pack on the floor, boots; the door's window is a round porthole |
| A sleeping bunk in an arched alcove in the right (starboard) wall, books, photographs, jackets on a hook | the bed in the separate sleeping cabin aft | the bunk in an arched alcove at z -4.55 .. -2.0, under the hull's starboard window; the wake-up is in the main room |
| A wooden chest by the cockpit on the right; lockers and hanging kit near you on the right | the galley, a small table with three seats | the chest of drawers by the frame, a net bag and a coil of rope on hooks, five lockers aft |
| Pipes and skylights in the ceiling | conduits at the walls | two fat pipes along the middle, two skylights |

Kept from before: the hull, the hatch and every opening in it, the ceiling height and the doorways; the sofa
and the small table moved into the back room (once the sleeping cabin), with the desk, books and clothes.

### The hull round the rooms

| | |
|---|---|
| Length | 26.0 m (nose z -10.8, stern z +15.2; 22.2 m until issue #195): the rooms need 22.75 m, the nose 1 m, the engine bay 2.25 m |
| Width | 8.4 m over the side walls (rooms 7.6 m + 0.4 m walls); the bow narrows to 3.2 m at the nose |
| Height | 6.0 m hull (belly 1.6 m under the deck, roof 4.4 m over it): 1.5 m of structure over the ceiling. First drawn 4.6 m tall; compared with the reference from its own three-quarter view it read long and flat, so the roof and the belly were taken out, the rooms unchanged |
| Deck over the ground | 2.6 m parked (`LIFT`): the belly 1.0 m off the ground on the legs |
| Hatch | port side, 1.6 x 2.6 m, sill on the deck; the door pops out and slides forward along the hull |
| Ramp | from the sill to the ground at 27 deg at most: about 5 m, telescoping (the existing ramp), treads drawn on it |
| Legs | four short splayed struts with pads, at z -5.6 and +11.0, feet 4.15 m out from the centre line |
| Pods | two, on short pylons at the roof's aft corners, 4.4 m long, raked 50 deg up and back |
| Footprint | 26.0 x 8.8 m with the legs; nothing of it is more than 15.6 m (`R`) from the ship's origin |

The old ball needed a 16 m radius (13 m hull, legs to 16 m), so every world's landing spot, which
was found for the ball, has room for the new hull (`tests/contact-audit.test.js` checks each one).

### Cross-section (main body)

Seven points a side, from the belly up (x, y): belly (1.8, -1.6), lower chamfer (3.25, -0.95),
chine (3.6, 0), stripe bottom (3.6, 1.25), stripe top (3.6, 1.55), shoulder (3.6, 3.05), roof edge
(2.9, 3.85). The side wall is one vertical plane from the chine to the shoulder, so the door, the slot
window, the galley window and the portholes are holes cut in a flat panel, and the stripe is a band
of the loft. The bow and the stern are the same seven points at fewer stations, narrowing and dropping.

## How it is built (`src/ship/hull.js`, `interior.js`, `model.js`)

- **The hull** is a loft: `STATIONS` gives the seven points of each side at eight stations along the ship
  (the nose plate at z -10, the windshield's foot at -9.3, its head at -7.3, the main body from -6.1 to 7.9
  with a station where the lavender starts, the stern's taper at 10.6 and its plate at 12.2). Each band
  between two stations is one flat quad (the faceted look, and the ink draws its edges): the belly and the
  two khaki chamfers, the side, the coral stripe, the shoulder, the roof. Over the main body the side walls
  are left out of the loft and built as a grid of flat panels round `OPENINGS` (the hatch, the slot window,
  the galley window, two portholes), each with its reveal through the 0.4 m of hull to the rooms' wall, a
  dark frame and dark glass recessed in it. The windshield's two panes and the side panes behind them are
  holes in their bands (`holedPatch`), with the same reveals inside. Glass faces outward only: from inside
  you see through it, from outside it is dark blue; it is solid (you can't walk out of a window).
- **Details**: two pods raked 50° up and back on short pylons at the stern's top corners (a coral band each,
  a red and a teal running light at their tips), a mast and a small dish on the roof, a roof hatch and vents,
  four lift jets under the belly (`BELLS`, the landings' jets come out of them: `src/ship/exhaust.js`), a
  keel strake, four legs (a hip housing on the lower chamfer, a strut, a knee, a leg to a round pad that
  finds the ground: `footY(leg)`), stowed housings when the legs are up, the scorch of the singing light on
  the port flank forward of the hatch (three dots over an arc), inked seams on the flat walls.
- **Helpers** for the rest of the game: `sectionAt(z)`, `halfWidthAt(z, y)` (the hull's half width at a
  height), `undersideAt(x, z)` (the belly's height: `Ship.floorAt` and the parking height use it),
  `reachAt(a, y)` (how far the side is from the middle of the plan along a heading: the crash site's sand
  heaps hug it), `inRooms(l)` (in `interior.js`: whether a ship-local point is aboard; `Ship.isInside`).
- **The door** is a panel just outside the wall: it pops out 14 cm, then slides 1.5 m forward along the
  hull (`Ship.setDoor`, `doorPhases`; the hatch's width and a quarter metre). **The ramp** is the old telescoping one (`poseRamp`), 1.55 m wide
  with treads and rails, mirrored to run out through the port hatch (`ramp.userData.axis`).
- **The rooms** (`buildInterior`): the floor is one flat plane, an invisible slab under the drawn boards;
  the cockpit's floor narrows with the bow. The rooms' walls are flat panels at x = ±3.8 round the same
  openings; the cockpit's skin is an inner loft under the windshield. Partitions: the cockpit frame (3.8 m
  open, the bulkhead over it follows the cockpit's roof), the back room's and the hold's doorways (2.1 x 2.6 m),
  the hold's aft wall with the engine room's shut hatch. Low furniture gets an invisible block `BLOCK_H` tall.
  The small things are one vertex-coloured mesh (`Paint`); everything else is merged by material (`Batch`).
  The atmosphere is the three interior references: cream enamel, faded teal fittings, coral textiles and a
  coral rug, warm wood, brass switches, the father's cap and a child's drawing on the dash, the kettle and
  two cups in the galley, the coral blanket, books under straps, patched clothes on hooks. The curved console is
  a ring sector extruded up (`ring`), the alcove's arched front a wall panel with a rounded opening cut through it
  (`archPanel`).

### The interaction points (`interior.points`, ship-local)

(Where they were in the blockout; built, the points follow the furniture: the console's and the table's points twice as
far from the origin, the bunk's with its alcove, `aboard` at (-4.4, 0.9): `tests/ship-grown.test.js` walks to each.)

| Point | Where | Used by |
|---|---|---|
| `cockpit` (heading PI) | (0.28, 0, 0.15) (`VOICE_STAND`), behind the console's tail, facing forward (the name is the old one) | the voicemail (`atConsole`, `CONSOLE_R` 1.5 m), the recordings (`cockpitFrame`) |
| `projector`, `voicemail` | on the console's tail, (0.28, 1.02, -1.1) and (0.4, 1.09, -0.8) | the hologram, the blinking button |
| `seat` | the pilot's seat (the left of the two) | |
| `table`, `tableFoot` | the holo table at (0.2, -3.1) | the galactic map (`atTable`, `TABLE_R` 1.6 m), the course-set shot |
| `hatchIn`, `threshold`, `aboard` | 1.4 m in from the hatch's wall (0.9 until issue #234, the camera had no room behind him; you can step out within 1.7 m of it); in the doorway; a few steps in (-1.4, 0.45), out of the voicemail's reach | stepping out (E), the step-out scenes, boarding (walking into the ramp: issue #87) |
| `bunkStand`, `wakeEye`, `wakeLook`, `wakeSit`, `wakeRoom` | a step out from the alcove at the pillow's end, 1.3 m from its front (0.62 until issue #234; out of the table's and the console's reach); on the pillow; up at the arch; sitting up, still in the alcove; across the room to the table and the galley | the prologue's waking |

`tests/ship.test.js` walks to the console and the table and uses them, `tests/ship-deck.test.js` checks
the deck is one plane and walks across it at one height, `tests/ship-camera.test.js` turns the tight
camera round in every room (the lens never in a wall) and walks into the walls, `tests/cutscenes.test.js`
checks the door, the ramp and the jets, and `tests/contact-audit.test.js` lands the ship in every world.

## Where the ship is used

- **Parked in every world** (`Ship.place`): the site search (`src/ship/sites.js`) measures the hull's plan where it
  would stand (since issue #338, above; the old ball's disc before), and the worlds it placed keep their spots; the hatch faces the site's heading (`yaw = heading - HATCH_A`); the belly is kept 0.45 m over the
  terrain (the terrain's own height where the level has one: a prop under the hull no longer lifts it on
  stilts); each foot finds the ground. `tests/contact-audit.test.js` builds it in every world and checks
  nothing of the world is inside the hull (roof to belly; on the desert crash, roof to the deck), open sky
  over it, the four feet on the ground and the legs not stretched, the ramp at 29° at most with nothing across it.
- **A start it covers** (`Ship.clearSpawn`, issue #254): a level's spawn inside the ship, or with its hull
  or ramp less than 3 m over it (`covers`, `SPAWN_HEADROOM`), moves to the foot of the ramp
  (`arrivalSpot`), facing out, the camera behind. The desert's (8 m off the hatch) was under the ramp once
  the hull grew to 26 m (#195): a direct `?level=desert` or a debug save started him boxed in.
  `tests/route-spawn.test.js` builds every route world and checks its direct start and its arrival by
  ship: out from under the ship, a walk of 5 m some way, the camera's arm out behind him. The spot it moved
  from is kept (`level.coveredSpawn`) for the Unity bridge's `-hull-spawn`, which starts a bench plan there to
  compare with the numbers taken before (issue #265); tests/bench-start.test.js checks the engines' plans start at
  the ramp's foot, tests/route-spawn.test.js every bench view and path clear of the ship.
- **The desert crash**: the same site, dug in (the deck kept clear of the sand), its berm heaped against
  the hull's real outline, cream, coral and lavender plates along the furrow, one torn-off leg.
- **The cinematics** (`src/ship/cinematics.js`, `homecoming.js`): the recordings' four angles are placed
  from where he stands and the projector (`cockpitFrame`), not hard-coded; the prologue's light passes
  close by the cockpit's left (the hatch's side, where it leaves its mark), the pass and drain shots are
  re-aimed, the glide comes in nose first and slews round in the sand as it stops; arrivals fly nose first
  along the way the bow will face; the homecoming's look out of the windshield is re-aimed.
- **The trailer's reference scenes** build the same model; **the Unity export** writes the new points and the
  hull's extents (`shipOut.hull`: length, half width, middle, lift, belly). The Unity C# port's scenes
  (`ShipScene.cs`, `ShipTravel.cs`) read them: the recordings' cameras from `cockpitFrame` (where he stands and
  the projector; `callShot` and the pause's three angles), the wake-up from `wakeEye` / `wakeSit` / `wakeLook` /
  `wakeRoom`, the walk ending at the console's reach (1.5 m: the bunk stands 2.3 m from it), the step-out from
  `threshold`, boarding to `aboard`, the map at the holo table (`tableFoot`, `tableShot` for the course), the
  glide's vapour off the hull's length and its jets under the belly; the prologue's new stages (pause, pass, drain,
  glide, land; an older export's names play as these), the arrival nose first along the bow and down on four bells.
  The web's sides mirrored into Unity's frame (`SideOf`). `tests/unity-ship-points.test.js` checks every point the
  C# names is the interior's. Not yet seen running (no editor run here, TODO.md).
- **The child's drawing** on the dash and in the cabin is the angular ship; the lines that called it "the
  round ship" now say the striped ship.

## Performance

Measured on the model (`buildShipModel`, a parked ship with its ramp; node): outside, 29 meshes, 7,600
triangles (the ball: 23, 32,700); with the rooms shown (within 48 m), 62 meshes, 15,800 triangles (the
ball: 61, 59,900). With the picked layout (v1.11: the curved console, the arched alcove, the second seat, the
CRT, the door's porthole) the same count is 31 meshes, 9,300 triangles outside (the console's dark top and teal
strips share the hull's materials, so they are counted outside although they are indoors) and 65 meshes, 21,600
triangles with the rooms shown. The rooms are drawn only within 48 m, measured once the frame's camera is placed (a scene's
shot inside the ship while the traveller stood far off drew no walls). Past 130 m (`DETAIL_FAR`) the small outside things (seams, the scorch, the running
lights, the trim's teal) are hidden: 22 meshes far off.

Twice the size (issue #338, the same count in node: every mesh of the parked ship with its ramp): 68 meshes, 25,100
triangles before, 71 meshes, 30,900 after (the furniture the grown rooms gained, the lamps' shades and the hold's crates;
the hull's triangles are the same, only bigger). The room light adds no draw call: a branch in the room materials'
shader, the same eight local lights as before (twelve lamps; main.js packs the eight nearest the traveller).

## Compared with the references

The picked layout beside the game's room from the same end: `changelog-media/1.11/ship-layout-sheet-after.webp` (and
the before / after pairs of the main room, its two sides and the cockpit in the same folder, `ship-layout-*`).

`docs/systems/ship-reference/`: the selected exterior beside the game from the same front-left three-quarter
(`exterior-three-quarter.jpg`), the other angles derived from the one hull (`angles.jpg`: the port side, behind
and above, the bow, from above), the three interior references beside the same rooms in the game (`main-room.jpg`,
`cockpit.jpg`, `cabin.jpg`) and a walk through the rooms with the game's own tight camera (`walk.jpg`). What still
differs from the painting: its bow wedge is a little longer and its windshield panes larger (the cockpit's sill
height and the projector's headroom set ours), and its door stands under the stripe (ours, 2.25 m for the
traveller's capsule, crosses it, and the stripe breaks round the door's frame).



## Caravan exterior study (issues #579, #592, #595)

`caravan-review.html` is a separate shipped review page for the selected caravan reference
(`references/The Travellers Ship/redesign/rounded-caravan-a/approved-reference.png`, accepted source
and SHA-256 provenance beside it). It provides a reference camera, orbit, front, side, rear and bottom
views, a 1.75 m scale person, Arrive/Depart controls and a turntable. The reference opens full size
by click or keyboard. The page has no audio system and does not load or change game saves.

The Blender rebuild (#595) replaces the generic capsule study with separately shaped forecabin,
inhabited middle, tapered aft body and four rear boosters in a two-by-two arrangement (#596).
The upper and lower port/starboard assemblies remain separately named beneath `engines`; their
mirrored placement is checked against the actual exported model. The Bottom camera reveals the
underside without moving hidden parts into view. Shape review compares the actual game
render with the selected drawing before detailing: the upper cockpit glazing, deep chin, cabin
length and porch placement matter more than surface decoration. The model remains approximately
40 m long, with bow along -X, up along +Y and porch on +Z in game coordinates. These are authoring
proportions, not collision or walkable interior data.

### Rebuilding the source

`scripts/blender/ship/build_caravan.py` is the reproducible Blender source. From the repository
root, run Blender in background mode:

```sh
blender --background --factory-startup --threads 2 --python scripts/blender/ship/build_caravan.py -- --out data/ships/caravan-a
```

The script saves the editable Blender project at
`references/The Travellers Ship/redesign/rounded-caravan-a/caravan-a.blend` beside the approved
reference, and exports the retained 40 m study to `data/ships/caravan-a/caravan.glb`. This
source/test fixture is no longer shipped from `public/`: the live review uses the full playable
assembly. Both the editable source and study model remain in the repository. The GLB contains neutral material colours and geometry,
without lights or cameras; the checked-in build script regenerates the source and export.

`src/ship/caravan-prototype.js` loads the full-scale GLB asynchronously through a base-path-aware
URL. Asset failure shows an error and does not mark the study ready. Imported materials are
converted to shared game `makeMaterial` shader materials. The page uses the actual game pipeline:
three-attachment G-buffer, cascaded sunlight shadows, Moebius print postprocessing, Desert
daylight colour script and FXAA (`tools/caravan-renderer.js`). Lighting is not baked into the
asset. No production ship module imports this authoring model.

### Authored deployment hierarchy

Moving parts keep their open poses, pivots and parent-child hierarchy in Blender. GLB node extras
expose `caravanMechanism`, read as `node.userData.caravanMechanism` by
`bindCaravanMechanisms` in `src/ship/caravan-prototype.js`. Its `stage` names one of `deck`,
`supports`, `ramp`, `rails`, `canopy`, `props`, `laundry`, `solar` or `gear`. Optional
`closedOffset`, `closedRotation` (radians) and `closedScale` define the closed pose relative to
the authored local pivot; `hideClosed` hides a fully stowed part. An optional `range: [start, end]`
uses the raw camp fraction, allowing a storage shutter to open and close in its own interval.

`CaravanDeployment` (`src/ship/caravan-deployment.js`, issues #583/#585) exposes `depart()`,
`arrive()`, `landingComplete()` and `update(dt)`, plus `phase`, `camp` and `altitude`.
`caravanStowPose(camp)` supplies the staged fractions. Departure secures loose camp equipment
before the deck closes and lift-off begins. Arrival keeps the camp secured during descent and
opens it only after touchdown. Landing gear follows altitude. The controller consumes phase
boundaries even for large time steps; regression tests check sequencing and shared lighting.
Production integration would call `landingComplete()` from its landing event and gate lift-off
on the `taking-off` phase. Review altitude is a demonstration, not flight physics.

This is a silent, web-only authoring study. Unity integration, production ship replacement,
walkable interiors and physically simulated actuators are separate work. Visual review covers
matched reference views and the open, partly stowed, closed and airborne states; passing the
study's checks does not establish gameplay collision or device performance.


## Playable rounded caravan (#599, v1.91)

The playable variant is generated by `scripts/blender/ship/build_caravan.py --playable`
from the same authored design as the review study. It writes
`public/models/ships/caravan-a/playable.glb` and the editable
`references/The Travellers Ship/redesign/rounded-caravan-a/playable-caravan.blend`.
The review page displays the actual playable assembly; the original 40 m study asset is retained. The playable hull uses a uniform 1.3 scale
(52 m nose to booster tail), preserving its approved silhouette while making room
for the furnished home. Furniture is constructed in metres, not enlarged with the hull.

`caravan-layout.js` defines the adapted frame: bow −Z, port entry −X, deck Y=0.
The author's final export offset of −0.8 m is included: authored porch Y=3.6 and
booster rows Y=10.6/4.8. Exported `playableContract` extras record the entry and
outer porch edge. The terrain ramp starts at that edge rather than at the hull wall.
The main room has 3.3 m headroom, a separate cabin and hold aft, and a 30-riser
stairwell to the cockpit's 5.2 m upper deck. The stairwell has enclosed walls and a high ceiling above the stairs;
its headroom is checked against actual walking collision.

The former painted study door is replaced by an opening and sliding panel. Camp
contents remain rigid: outside the hull they first rise, then retract above the
living room into a partitioned overhead garage. They move outside before lowering
on arrival. The real flight sequence closes the camp before lift-off and only opens
it after touchdown. Each moving assembly has its own collision transform; the
terrain ramp uses separate rigid section colliders. Existing progression and save
flag names remain unchanged.

Both web and Unity await `loadPlayableCaravan` before constructing the world and Ship.
The optional builder context carries the same asset into Pirates, whose packed hull,
four flames and four trails use the authored booster mouths. The static trailer
horizon uses that asset too. Anselm and his jar use the new hold anchor (including
after flight), with the old anchor retained only for legacy model fixtures. One parsed
template is cached for subsequent worlds and orbit copies; each live copy owns its
geometry, while immutable game-ink paint remains shared through the material cache.
Removing an orbit copy disposes only its owned geometry, never cached paint or the
parsed template. A load has a 60-second deadline; failure is explicit and cannot
silently leave a playable interior without its hull. A failed or timed-out request
can be retried without a late response replacing a successful cached retry.
The engine bundle and native build carry the same GLB. Unity API/minimum script
level 2 prevents an older player without this required resource from accepting the
new script over the air. This production integration is not web-only.

Validation uses the actual exported GLB: entry clearance, all 30 stair floors and
standing headroom, normal Player walking both ways over the stairs and terrain ramp,
rigid storage clearance, four terrain-adjusted feet, and cockpit visibility. Director
tests assert full stow before lift-off and restored entry after skipping arrival.
The engine's existing playable-ship test exercises prologue, console, map and arrival
with the production asset; native update tests cover the API2 compatibility gate.

Muted browser review covered every room, normal E interactions, full departure and
arrival, a real desert-to-Vael page transition and reload. Unity editor comparison
uses the same eight exterior/interior poses and exact production GLB. Evidence lives
in the release's ignored `playable-caravan-599` validation folder. Device performance
is not inferred from editor pictures; the Retroid was unavailable for this change.

The new GLB is 3,710,232 bytes, 154,440 triangles across 65 material primitives.
Including all furnishings and hidden/stowed pieces, the old procedural model contains
60 draws / 29,696 triangles / 2.95 MB geometry buffers; the playable caravan contains
89 draws / 159,489 triangles / 4.34 MB. These are model budgets, not frame timings:
actual visible scene costs depend on culling, room visibility and the world. Device
performance remains a separate measurement. The recorded opening covers all 22 beats through the crash, drone, hatch and
step-out. Homecoming reaches its cargo panel; that capture does not claim a
complete interactive ending.

### Lower grounded stance (#601)

The parked deck stands 2.8 m above level terrain (formerly 4.68 m). The authored
interior offset remains 4.68 m: changing stance does not shift the rooms, seated
eye, exhaust mouths or collision frame. The exported fixed hull reaches -2.204 m
below the deck, leaving 0.596 m clearance on flat ground; the conservative
parking envelope is -2.21 m and still raises the ship where terrain needs it.
The existing 27-degree ramp solver produces a shorter walkable ramp naturally.

The editable playable Blender source has shortened open legs and independent
porch supports. All six have sole/mount metadata; runtime adaptation keeps each
mount fixed while fitting its foot to local ground. Default model construction
uses the same flat-ground stance as the review page. Porch supports retain their
parent deployment mechanism, so they stow before lift-off and return after landing.

The wider aft pods use a caravan-only 5 m eastward site offset on Space City's
pier, preserving the bridge-facing hatch and avoiding its raised parapet.
Desert retains its established Qanat-facing site: the dune falls away under the
porch, so its adaptive ramp remains longer than the flat-ground review. A bounded
30–80 m natural-site search did not find a short ramp with the same first-look
direction; no terrain was flattened and the story's landing direction is unchanged.
