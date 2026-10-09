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
- **Walkways**: at least 1.6 m between furniture fronts, 1.9 m or more round the holo table
  (its use radius `TABLE_R` 1.6 m must be standable all round).
- **Furniture**: counter tops 0.92 m deep 0.65 m; the bed 1.6 x 2.1 m; seats 0.45 m; the dash
  0.95 m high, 0.75 m deep. Low furniture gets an invisible block 1.1 m tall (`BLOCK_H`) over its
  footprint so walking the deck never lifts you onto it (as on the old deck).

### Rooms, from bow to stern (ship-local metres)

Frame: x to starboard, y up, z aft; the origin is on the deck, on the centre line, at the middle of
the hatch (so `polar(r, HATCH_A, DECK)` is still "r metres out through the hatch", `HATCH_A = -PI/2`,
the port side). The bow is at -z, as the old cockpit was.

| Room | z from .. to | Clear width | What is in it |
|---|---|---|---|
| Cockpit | -9.0 .. -6.1 | 4.3 m at the nose wall, 6.4 m at the frame | the dash under the windshield, the pilot's seat (left of centre), the voicemail button and the recordings' projector on the dash, the round call screen, a jump seat, the father's cap and a child's drawing |
| Main room (galley, living, entry) | -6.1 .. 2.55 | 6.4 m | the holo table (front middle), the galley along the starboard wall (counter, stove, sink, kettle, cupboards, a window), the hatch and the entry bench and lockers along the port wall, a sofa aft of the hatch under the slot window, a small table with three mismatched seats (starboard aft) |
| Sleeping cabin | 2.55 .. 6.75 | 6.4 m | the built-in bed in an alcove (port), a desk and a chest of drawers, clothes on hooks, books under straps, photographs, a round porthole each side |
| Hold (storage) | 6.75 .. 9.95 | 6.0 m | lockers both walls, crates strapped down, a tool board, spare parts, the engine room's hatch in the aft wall (shut) |
| Engine bay | 9.95 .. 12.2 | (closed) | no rooms: machinery behind the aft wall, the pods' roots |

Doorways: the cockpit frame at z -6.1 is open 3.2 m wide (the cockpit is part of the main room, as
in the Main Interior reference); the cabin and the hold open through 1.6 m doorways on the centre line.

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
  open, the bulkhead over it follows the cockpit's roof), the cabin's and the hold's doorways (1.6 x 2.28 m),
  the hold's aft wall with the engine room's shut hatch. Low furniture gets an invisible block `BLOCK_H` tall.
  The small things are one vertex-coloured mesh (`Paint`); everything else is merged by material (`Batch`).
  The atmosphere is the three interior references: cream enamel, faded teal fittings, coral textiles and a
  coral rug, warm wood, brass switches, the father's cap and a child's drawing on the dash, the kettle and
  two cups in the galley, the rust-red blanket, books under straps, patched clothes on hooks.

### The interaction points (`interior.points`, ship-local)

| Point | Where | Used by |
|---|---|---|
| `cockpit` (heading PI) | (0.25, 0, -6.95), at the dash | the voicemail (`atConsole`, `CONSOLE_R` 1.5 m), the recordings |
| `projector`, `voicemail` | on the dash, (0, 1.07, -8.25) and (0.8, 1.14, -8.2) | the hologram, the blinking button |
| `seat` | the pilot's seat, left of centre | |
| `table`, `tableFoot` | the holo table at (0, -2.6) | the galactic map (`atTable`, `TABLE_R` 1.6 m), the course-set shot |
| `hatchIn`, `threshold`, `aboard` | 0.9 m in from the hatch; in the doorway; a few steps in | stepping out (E), the step-out scenes, boarding (E at the ramp's foot) |
| `bunkStand`, `wakeEye`, `wakeLook`, `wakeRoom` | beside the bed; on the pillow; up at the hood; the doorway | the prologue's waking |

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
  hull's extents (`shipOut.hull`); the Unity port's own C# still places its cameras for the ball (TODO.md).
- **The child's drawing** on the dash and in the cabin is the angular ship; the lines that called it "the
  round ship" now say the striped ship.

## Performance

Measured on the model (`buildShipModel`, a parked ship with its ramp; node): outside, 29 meshes, 7,600
triangles (the ball: 23, 32,700); with the rooms shown (within 48 m), 62 meshes, 15,800 triangles (the
ball: 61, 59,900). The rooms are drawn only within 48 m, measured once the frame's camera is placed (a scene's
shot inside the ship while the traveller stood far off drew no walls). Past 130 m (`DETAIL_FAR`) the small outside things (seams, the scorch, the running
lights, the trim's teal) are hidden: 22 meshes far off.

## Compared with the references

`docs/systems/ship-reference/`: the selected exterior beside the game from the same front-left three-quarter
(`exterior-three-quarter.jpg`), the other angles derived from the one hull (`angles.jpg`: the port side, behind
and above, the bow, from above), the three interior references beside the same rooms in the game (`main-room.jpg`,
`cockpit.jpg`, `cabin.jpg`) and a walk through the rooms with the game's own tight camera (`walk.jpg`). What still
differs from the painting: its bow wedge is a little longer and its windshield panes larger (the cockpit's sill
height and the projector's headroom set ours), and its door stands under the stripe (ours, 2.25 m for the
traveller's capsule, crosses it, and the stripe breaks round the door's frame).

