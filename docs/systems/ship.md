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

## The blockout: the traveller is the unit

- **The traveller**: 1.82 m (eyes at 1.70 m, `FACE` in `src/humanoid.js`). His collision capsule
  (`src/player.js` `CAPSULE`) is 0.45 m in radius and 2.2 m tall; he steps up 0.6 m.
- **Ceiling**: 2.35 m clear over the deck (the brief's ~2.3 m, with room for the capsule).
- **Doors**: 2.25 m high (over the capsule); the hatch 1.3 m wide, the doorways between rooms
  1.6 m wide: the camera's tight over-the-shoulder arm (`CameraRig.indoor`) passes through
  behind him without the lens touching a jamb.
- **Walkways**: at least 1.3 m between furniture fronts in the main room (the capsule is 0.9 m across):
  1.4 m between the galley and the curved console, 1.3 m between the holo table and the bunk's alcove,
  2 m between the console's tail and the lockers; the holo table is used from its open (starboard) half,
  inside its use radius `TABLE_R` 1.6 m.
- **Furniture**: counter tops 0.92 m deep 0.65 m; the console 0.95 m high, 0.4 m deep; the bunk
  0.98 x 2.15 m, its mattress 0.56 m up, 1.5 m of headroom sitting up under the alcove's 2.05 m hood;
  seats 0.45 m; the dash
  0.95 m high, 0.75 m deep. Low furniture gets an invisible block 1.1 m tall (`BLOCK_H`) over its
  footprint so walking the deck never lifts you onto it (as on the old deck).

### Rooms, from bow to stern (ship-local metres)

Frame: x to starboard, y up, z aft; the origin is on the deck, on the centre line, at the middle of
the hatch (so `polar(r, HATCH_A, DECK)` is still "r metres out through the hatch", `HATCH_A = -PI/2`,
the port side). The bow is at -z, as the old cockpit was.

| Room | z from .. to | Clear width | What is in it |
|---|---|---|---|
| Cockpit | -9.0 .. -6.1 | 4.3 m at the nose wall, 6.4 m at the frame | the dash under the windshield (a scope and two screens in its middle), two seats side by side, the overhead panel between them, the father's cap and a child's drawing |
| Main room (the picked layout) | -6.1 .. 2.55 | 6.4 m | the holo table in the middle (0.2, -3.1) in the crook of the curved console, the console's tail running aft with the voicemail button, the projector and the little screen on its end; port: the galley forward of the hatch (an L round the frame's corner, stove and kettle, sink, tool board, cupboards), coats and packs on hooks aft of the hatch; starboard: a chest of drawers by the frame, the bunk in its arched alcove under the window, kit on hooks, the lockers; two skylights, pipes along the ceiling |
| Back room | 2.55 .. 6.75 | 6.4 m | a sofa under the port porthole, a small table with three mismatched seats, a desk and a chest of drawers, clothes on hooks, books under straps, photographs |
| Hold (storage) | 6.75 .. 9.95 | 6.0 m | lockers both walls, crates strapped down, a tool board, spare parts, the engine room's hatch in the aft wall (shut) |
| Engine bay | 9.95 .. 12.2 | (closed) | no rooms: machinery behind the aft wall, the pods' roots |

Doorways: the cockpit frame at z -6.1 is open 3.2 m wide (the cockpit is part of the main room, as
in the Main Interior reference and the picked sheet); the back room and the hold open through 1.6 m doorways
on the centre line.

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
| Length | 22.2 m (nose z -10.0, stern z +12.2): the rooms need 18.95 m, the nose 1 m, the engine bay 2.25 m |
| Width | 7.2 m over the side walls (rooms 6.4 m + 0.4 m walls); the bow narrows to 2.8 m at the nose |
| Height | 5.45 m hull (belly 1.6 m under the deck, roof 3.85 m over it): 1.5 m of structure over the ceiling. First drawn 4.6 m tall; compared with the reference from its own three-quarter view it read long and flat, so the roof and the belly were taken out, the rooms unchanged |
| Deck over the ground | 2.6 m parked (`LIFT`): the belly 1.0 m off the ground on the legs |
| Hatch | port side, 1.3 x 2.25 m, sill on the deck; the door pops out and slides aft along the hull |
| Ramp | from the sill to the ground at 27 deg at most: about 5 m, telescoping (the existing ramp), treads drawn on it |
| Legs | four short splayed struts with pads, at z -4.8 and +8.6, feet 3.55 m out from the centre line |
| Pods | two, on short pylons at the roof's aft corners, 4.4 m long, raked 50 deg up and back |
| Footprint | 22.2 x 7.6 m with the legs; nothing of it is more than 12.6 m (`R`) from the ship's origin |

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
  hull (`Ship.setDoor`, `doorPhases`). **The ramp** is the old telescoping one (`poseRamp`), 1.25 m wide
  with treads and rails, mirrored to run out through the port hatch (`ramp.userData.axis`).
- **The rooms** (`buildInterior`): the floor is one flat plane, an invisible slab under the drawn boards;
  the cockpit's floor narrows with the bow. The rooms' walls are flat panels at x = ±3.2 round the same
  openings; the cockpit's skin is an inner loft under the windshield. Partitions: the cockpit frame (3.2 m
  open, the bulkhead over it follows the cockpit's roof), the back room's and the hold's doorways (1.6 x 2.28 m),
  the hold's aft wall with the engine room's shut hatch. Low furniture gets an invisible block `BLOCK_H` tall.
  The small things are one vertex-coloured mesh (`Paint`); everything else is merged by material (`Batch`).
  The atmosphere is the three interior references: cream enamel, faded teal fittings, coral textiles and a
  coral rug, warm wood, brass switches, the father's cap and a child's drawing on the dash, the kettle and
  two cups in the galley, the coral blanket, books under straps, patched clothes on hooks. The curved console is
  a ring sector extruded up (`ring`), the alcove's arched front a wall panel with a rounded opening cut through it
  (`archPanel`).

### The interaction points (`interior.points`, ship-local)

| Point | Where | Used by |
|---|---|---|
| `cockpit` (heading PI) | (0.28, 0, 0.15) (`VOICE_STAND`), behind the console's tail, facing forward (the name is the old one) | the voicemail (`atConsole`, `CONSOLE_R` 1.5 m), the recordings (`cockpitFrame`) |
| `projector`, `voicemail` | on the console's tail, (0.28, 1.02, -1.1) and (0.4, 1.09, -0.8) | the hologram, the blinking button |
| `seat` | the pilot's seat (the left of the two) | |
| `table`, `tableFoot` | the holo table at (0.2, -3.1) | the galactic map (`atTable`, `TABLE_R` 1.6 m), the course-set shot |
| `hatchIn`, `threshold`, `aboard` | 0.9 m in from the hatch; in the doorway; a few steps in (-1.4, 0.45), out of the voicemail's reach | stepping out (E), the step-out scenes, boarding (walking into the ramp: issue #87) |
| `bunkStand`, `wakeEye`, `wakeLook`, `wakeSit`, `wakeRoom` | out of the alcove at the pillow's end (out of the table's reach); on the pillow; up at the arch; sitting up, still in the alcove; across the room to the table and the galley | the prologue's waking |

`tests/ship.test.js` walks to the console and the table and uses them, `tests/ship-deck.test.js` checks
the deck is one plane and walks across it at one height, `tests/ship-camera.test.js` turns the tight
camera round in every room (the lens never in a wall) and walks into the walls, `tests/cutscenes.test.js`
checks the door, the ramp and the jets, and `tests/contact-audit.test.js` lands the ship in every world.

## Where the ship is used

- **Parked in every world** (`Ship.place`): the site search (`src/ship/sites.js`) is unchanged and still
  uses the old ball's envelope (13 m reach, 13.5 m lift), which holds the new hull, so no world's ship
  moved; the hatch faces the site's heading (`yaw = heading - HATCH_A`); the belly is kept 0.45 m over the
  terrain (the terrain's own height where the level has one: a prop under the hull no longer lifts it on
  stilts); each foot finds the ground. `tests/contact-audit.test.js` builds it in every world and checks
  nothing of the world is inside the hull (roof to belly; on the desert crash, roof to the deck), open sky
  over it, the four feet on the ground and the legs not stretched, the ramp at 29° at most with nothing across it.
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

