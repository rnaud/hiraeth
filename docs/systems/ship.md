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
| Height | 4.6 m hull (belly 1.25 m under the deck, roof 3.35 m over it): 1 m of structure over the ceiling |
| Deck over the ground | 2.3 m parked (`LIFT`): the belly 1.05 m off the ground on the legs |
| Hatch | port side, 1.3 x 2.25 m, sill on the deck; the door pops out and slides aft along the hull |
| Ramp | from the sill to the ground at 27 deg at most: about 5 m, telescoping (the existing ramp), treads drawn on it |
| Legs | four short splayed struts with pads, at z -4.8 and +8.6, feet 3.55 m out from the centre line |
| Pods | two, on short pylons at the roof's aft corners, 4.4 m long, raked 50 deg up and back |
| Footprint | 22.2 x 7.6 m with the legs; nothing of it is more than 12.6 m (`R`) from the ship's origin |

The old ball needed a 16 m radius (13 m hull, legs to 16 m), so every world's landing spot, which
was found for the ball, has room for the new hull (`tests/ship-hull.test.js` checks each one).

### Cross-section (main body)

Seven points a side, from the belly up (x, y): belly (1.8, -1.25), lower chamfer (3.2, -0.75),
chine (3.6, 0), stripe bottom (3.6, 1.25), stripe top (3.6, 1.55), shoulder (3.6, 2.75), roof edge
(2.9, 3.35). The side wall is one vertical plane from the chine to the shoulder, so the door, the slot
window, the galley window and the portholes are holes cut in a flat panel, and the stripe is a band
of the loft. The bow and the stern are the same seven points at fewer stations, narrowing and dropping.
