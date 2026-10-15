# The temples redesigned: rooms like shrines (issue #336)

The author, on issue #336: *"We should redesign the temples with a few things in mind. The rooms should be much bigger,
higher ceilings, larger doors, larger rooms. Think shrines in Breath of the Wild. Puzzles should never go through doors
but be more centered in the rooms. Enemies should also be centered in rooms. Rooms should either be about puzzles or about
combat but not both. Major gadgets like the grappling hook should be found in temples and should be put to use to solve
puzzles as part of it."*

This page turns that into numbers a script can check (`scripts/temple-design/rules.mjs`, run by the temple design audit
and by `tests/temple-rules.test.js`), says how the first house was redone to them (the Rose House, v1.77), and ranks the
other thirteen for the rounds after it.

## What a shrine room is

A Breath of the Wild shrine room is one idea in one space you can take in from its door: 25 to 45 m across, 12 to 25 m to
the ceiling, the device standing in the middle of the floor where you walk round it and read it from every side, the way
on across the room from the way in. A fight there is a room of its own (the Test of Strength shrines are a guardian on an
empty floor). The traveller is 1.8 m tall and jumps about 6 m (the double jump 13): a room is big against him, the props
in it (balls, bowls, plates, the weight, chests, eyes) stay at his scale.

## The rules

| Rule | The number | Checked as |
|---|---|---|
| **Room size** | a puzzle, fight or guardian room at least **28 m** on its floor's short side and **900 m²** (a round hall 28 m across); a chest room at least **20 m** | the kit's hall or round hall the room's mark stands in (`TempleKit.hall`, `rotunda`; `vestibule` and `corridor` are passages) |
| **Ceiling** | **16 m** over the floor you stand on in a puzzle, fight or guardian room; **14 m** in a chest room; **8 m** in a passage | the hall's top less the mark's floor |
| **Doors** | between two rooms **6 to 10 m wide, 8 to 12 m high** (they were 4.4 to 5 by 6) | every `Door` on a link |
| **Centred** | every piece of a puzzle (a ball's groove at both ends, a plate, an eye, a bowl, thorns, a bank's eyes, a sentry) in the **middle 60 %** of its room each way: 20 % of the span from every wall; in a round hall within **0.6 r** of its middle | the piece's options against its room's hall; the guardian's own arena pieces are its fight's, not checked |
| **Not through doors** | nothing of a puzzle rolled, carried or threaded through a doorway: a ball and its plate (or bowl), a weight and its plate, in one room; no groove running through a door; no ball's `gap` on a door | `drum` / `weight` and their plates' rooms; the groove against every link's door |
| **One kind a room** | each room is a **puzzle**, a **combat** room, the **chest**'s, a **passage** or the **guardian**'s; never a puzzle and a fight. `LOGIC.rooms[r].kind` tags it, and the tag must be true | a room is combat if it holds an `arena`, the house's `encounter`, or a machine: `src/foes.js` puts one by every mark past the first (away from the guardian) in a room not tagged otherwise |
| **Foes centred** | a fight's foes stand round the middle of its room | the mark's `foes` spot (or the mark) in the middle 60 % |
| **The gadget** | found inside, not in the first room, and used in **every puzzle room after it** (at least **two**): the gadget or the house's second find | an element or link of the room that `needs` it, or a door that opens for it in hand |

How the machines change: a house whose rooms are tagged gets machines only in its `combat` rooms, round the mark's
`foes` spot (`src/temples/pieces.js` Mark, `src/foes.js` placeMachinesIn). A house not tagged keeps the old way (one by
every mark) until it is redone, and the rules count each such machine in a puzzle room as a room that is both.

## The model: the Rose House (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | 22 × 38 to 26 × 40 m, the chest's round hall 20 m across | every hall **36 m** across (the Hall of Channels 36 × 75), the chest's **26 m** |
| ceilings | 10 to 20 m (13 in the chest's hall, 14 in the Hall of the Flame) | **18 to 24 m** (16 in the chest's, 22 in the cistern) |
| doors | 4 to 5 m by 6 to 6.6 | **7 by 9** |
| fights | a machine by every mark (the Hall of the Flame, the Dry Channel, the Sword Chamber with its encounter, the Hall of Fires, the Hall of Channels, the antechamber) | **the Machines' Hall only**, an arena past the chamber's north door, its machines round its middle |
| threaded through doors | the Sword Chamber's ball rolled through the north door to the Hall of Fires' bowl; the Hall of Channels' ball through the east doorway to the far landing's bowl | each ball, its fire, its thorns and its bowl in the middle of one hall |
| the rules broken | **43** | **0** |
| the temple design audit (`temple-design-qc`) | 4.11: structure 5, teach/test/twist 5, combination 4, non-obvious 4, decoupling 4, item 5, guardian 4, identity 3, curve 3 | 4.11: non-obvious **3** (its mean 3.25 → 3.44: the chamber's door is in sight from the pier now), decoupling **5** (the bowls by their balls, out of sight of the doors they open); its skeleton gains the arena (`XTBCRAXBGXK`) and is 46 % like the next (55 %) |

The rooms, in order: the Threshold (a passage); the Hall of the Flame (puzzle: the tar ball's groove down the middle, the
pilot flame on it, the bowl at its end); the Dry Channel (puzzle: the pier in the middle of the pit, its plate and the
Givers' weight, issue #337); the Sword Chamber (the chest: the blade, nothing else); the **Machines' Hall** (combat: an
arena, four columns to fight round); the Hall of Fires (puzzle: the thorns and the ball cut through its fire to the bowl
on the chasm's lip, the bridge); the **Watcher's Hall** past the bridge's archway (puzzle: the guard, and the watcher in
the middle of the floor); the Hall of Channels (puzzle: the long groove down its middle, the relay under its lid, the eye
on an obelisk beside the groove, the keepers' door back); the antechamber; the Cistern (the Keeper, as it was). The blade
is found half-way and asked for in every puzzle room after it (the thorns, the cut ball, the eye), the guard in the
Watcher's Hall and the Keeper's fight. What stayed: the Keeper and its fight, the story's lines, the weight (#337), the
pits' dark (#312), the jumps (9 m of air either side of the pier), every ball's timing (the grooves are as long as they
were), the shortcut back, the way out. A save that stood in the old rooms is taken to its last mark; one past the old
chamber's fight has the Machines' Hall won (`src/temples/migrate.js` `LAYOUTS.desert` v4). No small keys in this house:
the key chests (#274) are the other houses'.

## The second: the Warden's Well (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | the Turning Floors 24 × 33, the Climb 18 m across, the wings 16 × 14, the drum 28 m, the Flue 11 m | the Turning Floors **30 × 33**, the Climb **34 m**, the wings **30 × 30**, the drum **36 m**, the Flue **35 m**; the Bellows Chamber 20 m (a chest's) |
| ceilings | the wings 10 and 12 m, the crown 10 (the gallery and the loft 15 and 9 under their irises) | the wings **18**, the gallery and the loft **17** each, the crown **18**, the Climb 28 |
| doors | 5 by 6 | **7 by 9** |
| fights | a machine by every mark (the Turning Floors, the Climb, the Vane Room, the Bellows Chamber, the gallery, the loft, the crown, the Flue, the high door's stone), and the Ash Store's arena | **the Ash Store only**, its machines round its middle among four columns |
| against the walls | the Turning Floors' vane over the far door, the Vane Room's on its far wall, the two lidded eyes on the drum's wall, the loft's ball on a shelf on the east wall, the Flue's vane on its south wall | each in the middle of its room: on a pillar out of the drop, on a post in the chasm, on pillars in the drum's floors (a shelf under each eye), on a raised walk on two piers, on a post beside the draught |
| the rules broken | **41** (both 7, size 9, ceiling 3, door 4, centred 10, foes 8) | **0** |
| the temple design audit | 4.56: structure 5, teach/test/twist 5, combination 5, non-obvious 4 (mean 3.17), decoupling 5, item 5, guardian 4, identity 3, curve 5 | 4.56, the same scores (mean obviousness 3.11: the high door's eye's great vane is out of its sight now, below the high ledge) |

What it took beyond the sizes: the drum's three floors stand 17 m over each other, so its three rooms are 17 to 18 m high
for real (the rules measure the drum to its top); the Climb's block is a chord 6 m north of the well's middle
(`CLIMB.face`), so the vane at its foot stays within 20 m of the door it opens; the crown's little vane hangs on an arm
off a post at the first iris's rim, out under the second iris on the high door's side, where it is seen from the high
ledge (the drum wider, the door 4 m further out); the Flue, 35 m across, has a pier for its great key and a landing under
the crown's doorway (too far to glide to from its middle). What stayed: the warden and its fight (and what the bellows
reveal there), the story's lines, the two ways up from the gallery (the irises' and the Flue's), the two small keys and
the great one, the pits, every vane's timing and every jump. A save that stood in the old rooms is taken to its last
mark (`LAYOUTS.incal` v4; `runtime.js` does it for every house now).

## The Founders' Belfry (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | 11 × 12 (the stores) to 22 × 34 m, the Stone Stair and the Bell Chamber round halls 18 and 20 m across | the stores **30 × 36**, the porch 36 × 28, the Hall of Echoes 36 × 50, the stair and the chamber **34 m** across, her hall 42 |
| ceilings | 8 (the stores) to 15 m | **18 m** or more (the stair 28) |
| doors | 4 to 5 m by 5.5 to 6.6 | **7 by 9** |
| fights | a machine by every mark (the hub, the stair, the chamber, the porch, the Hall of Echoes, the antechamber, the walk) and the west store's arena | **the west store only**, its keepers round its middle |
| threaded through doors | the Hall of Echoes' ball rolled onto a plate in the next room (`p3` the far side's) | the plate on the far lip, in the ball's room |
| the rules broken | **40** | **0** |
| the temple design audit | 4.22: structure 5, teach/test/twist 5, combination 4, non-obvious 4 (mean 2.75), decoupling 5, item 5, guardian 4, identity 2, curve 4; the great key's cage at 1.0 | 4.22: `LXBCRGGXXLK` (the chamber's north door for the whistle in hand, `dP`: 64 % like the Casting-House, 70 % before); non-obvious mean 2.94: the cage **1.5**, the founders' bell straight below the key's ledge, in sight and under 20 m |

What it took beyond the Rose House's way: the upper house came down from 16 m to 8 (`UP`), so the walk's ledge is 16 m
over the stair's floor (the key within 20 m of the bell it waits on) and still 8 over the landing; the Bell Porch and the
antechamber became rooms of their own; her hall is measured by her hanging stones (`HallStones` carries her element's
id: the rules measure a room by its mark or its element's pieces, and a guardian's hall has no mark).

## The Builders' Greenhouse (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | the Potting Hall 22 × 31, the wings and the Seed Vault 16 × 14, the Bud Passage 12 × 12, the Vine Gulf 22 × 44, the Glass Stair and the Seed Chamber round halls 20 and 19 m across | the Potting Hall **36 × 41**, the wings, the vault and the Bud Passage **30 × 30**, the Vine Gulf **36 × 60**, the stair and the chamber **34 m** across; the Glasshouse 40 as it was |
| ceilings | 10 (the wings) to 13 m (the chamber 13, the Potting Hall 12) | **18 m** or more (the vault 20, the gulf 20 over its lips, the stair 30) |
| doors | 4.8 to 5 m by 6 to 6.4 | **7 by 9** (the buds too) |
| fights | a machine by every mark (the Potting Hall, the Glass Stair, the landing, the Seed Chamber, the Vine Gulf both sides, the Seed Vault, the antechamber) and the Shade House's arena | **the Shade House only**, its keepers round its middle among four columns |
| against the walls | the Potting Hall's eye on its east wall, the Cold Frame's eyes on its end walls and its groove by the east wall, the Glass Stair's eye high on its wall, the Seed Vault's seeds along its east wall, the gulf's balls and seeds at its lips by the walls | each in the middle of its room: on a pillar behind the benches, on posts behind the seed trays, on the face of the landing, before a wall of glass out in the room, on lips 16 m out from the gulf's walls |
| the rules broken | **58** (both 7, size 10, ceiling 6, door 7, centred 20, foes 8) | **0** |
| the temple design audit | 4.11: structure 5, teach/test/twist 5, combination 5, non-obvious 3 (mean 3.38), decoupling 4, item 5, guardian 4, identity 3, curve 3 | 4.11, the same scores: `XALBXCRXXXXLK` (the chamber's north door for the bloom in hand, `dS`: 62 % like the Warden's Well, 67 % like the Casting-House before); mean obviousness 3.44 (the Bud Passage's ball over 20 m from its bud) |

What it took beyond the sizes: the Bud Passage became a room of its own past the chamber's north door, which sinks for
the bloom in hand (`bud`, `dS`: the chamber with the chest and its try `seed0`, the passage with its ball, its plate and
its bud); the Glass Stair's landing is a block from the root-wall's back
up to the north door, its eye on its face where the disc passes it; the Seed Vault's glass is the face of a ledge 9 m deep
out in the room, so its seeds and its groove stand in the middle; the gulf is 60 m deep, its lips 16 m out from its walls.
What stayed: the Gardener and its fight, the story's lines, the two small keys and the great one, the loop back through
the Seed Vault's keepers' door, the pits, every groove's length and every climb. A save that stood in the old rooms is
taken to its last mark (`LAYOUTS.edena` v5).

## The Aerie (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | the Hall of Winds 16 × 39, the Wind Well 24 m across, the Moult 14 × 14, the Eyrie 20 × 16, the Gulf 22 × 90; the Wing Chamber's round hall 17 m | the Hall of Winds **30 × 66**, the Wind Well **36 m** (50 high), the Moult and the Eyrie **30 × 30**, the **Vent Hall** 30 × 30 (new), the Gulf **30 × 90**; the Wing Chamber 26 m (a chest's) |
| ceilings | the Hall of Winds 12, the Moult 10, the Eyrie 14 over its ledge, the high balcony 14 under the well's top, the Wing Chamber 12 | the Hall of Winds **18**, the Moult **18**, the Eyrie **18**, the Vent Hall **18**, the Wing Chamber 16 |
| doors | 5 by 6 to 6.4 | **7 by 9** |
| fights | a machine by every mark (the Hall of Winds, the well, the Wing Chamber, the high balcony, the Eyrie, both lips of the Gulf, the perch), and the Moult's arena | **the Moult only**, its keepers round its middle among four columns |
| against the walls | the Hall of Winds' groove running into the corridor's mouth, the well floor's second vent, the Eyrie's stone along its ledge by the wall, the gulf vent's stone on the balcony against the well's wall | each in the middle of its room: the groove down the hall's middle to a grate, the Eyrie's on a ledge that reaches out to the hall's middle, the gulf vent's in the middle of the Vent Hall past the balcony |
| the rules broken | **35** (both 5, size 8, ceiling 4, unmeasured 1, door 4, centred 7, foes 6) | **0** |
| the temple design audit | 4.33: structure 5, teach/test/twist 5, combination 5, non-obvious 4 (mean 3.08), decoupling 5, item 4, guardian 4, identity 3, curve 4 | 4.33, the same scores (mean obviousness 3.08) |

What it took beyond the sizes: the stone's groove in the Hall of Winds is as long as it was, so the hall is 66 m long to
hold it in its middle 60 % (a sixth row of screens for the walk past the vent to the well); the gulf vent's stone needed
a room of its own, since the well's middle 60 % is 11 m round its column, and the high balcony now reaches out to two
metres from the column's edge; the Eyrie's ledge reaches out to keep the gap as wide as it was; the perch stands against
the west wall on a buttress (on a pillar in the middle of the gap a glide to it overshot, and one short of it landed on
its corbel). What stayed: the Elder and her fight, the story's lines, the circuit round the stack, the keys, every vent's
wind and every crossing. A save that stood in the old rooms is taken to its last mark (`LAYOUTS.arzach` v4).
## The Undertower (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | 16 × 16 (the wings) to 22 × 37 m, the Cable Well 20 m across, the Choir 16 × 28, the Listening Passage 12 m | every hall **30 to 36 m** across (the Hall of Dishes 36 × 52, the Choir 32 × 46, the gallery 36 × 56), the Cable Well **34 m**, the Shell Chamber 28 (a chest's), the Listening Passage a hall of its own **30 × 30** |
| ceilings | 10 (the wings) to 14 m | **18 m** or more (the Cable Well 28) |
| doors | 5 by 6.4 | **7 by 9** (the great lock 6 by 9, for the camera in the antechamber) |
| fights | a machine by every mark (the Hall of Dishes, the well, the Tuning Room, the chamber, the gallery, the far landing, the Choir) and the Cable Store's arena | **the Cable Store only**, its keepers round its middle among two columns |
| threaded through doors | the Tuning Room's ball rolled in from the well onto its footstone | the groove down the middle of the Tuning Room |
| against the walls | the dishes on the walls, the Tuning Room's and the passage's grooves along walls, the far door's horn over its lintel, the Choir's horns at its ends | the dishes on stands, the grooves down the middle, the far door's horn and dish on a pier in the middle of the far landing |
| the rules broken | **55** (both 7, size 9, ceiling 8, unmeasured 1, door 7, centred 16, through doors 1, foes 6) | **0** |
| the temple design audit | 4.44: structure 5, teach/test/twist 5, combination 5, non-obvious 4 (mean 3.13), decoupling 5, item 5, guardian 4, identity 3, curve 4 | 4.44: non-obvious **3** (mean 3.39: the Tuning Room's ball in its own room, the well's horn seen from the disc, the chamber's door for the shell), curve **5**; skeleton `XXBLCRXTGXLK`, 58 % like the Rose House (64 % like the Casting-House before) |

What it took beyond the sizes: the Cable Store can no longer stand under the Choir (its 18 m ceiling against the Choir's
floor at 12), so it lies west at the end of a 37 m cable tunnel under the Choir's floor, the Choir's gate over its way in
as before. The Listening Passage became a room of its own behind a door that sinks for the shell in hand (`dL`): every
room after the chest must ask for the shell (`tests/temples.test.js`). The guardian's hall is measured by `SignFoot`, a
piece with the First Sign's element id. A drum of cable between the Tuning Room's key and its stones keeps the far
horn's stone out of the key's sight (decoupling 5). What stayed: the First Sign and its fight, the story's lines, the
two small keys, the great key and the loop through the Choir, the pits, every disc's and pillar's timing and every
groove's length. A save that stood in the old rooms is taken to its last mark (`LAYOUTS.bazaar` v5).

## The Mooring-House (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | the Capstan Hall 28 m across, the Winch Room 15, the Lamp Shaft 14, the Cord Loft 19, the Drift 40 × 22, the Balance 22 × 22, the Rope Store 12 × 15 | the Capstan Hall **36 m**, the Winch Room, the Lamp Shaft and the Cord Loft **34 m**, the Drift **48 × 30**, the Balance **32 × 36**, the Rope Store **30 × 30** |
| ceilings | 9 (the store) to 14 m (the far landing), the balcony 11 m under the hall's roof | **16.6 m** or more (the Capstan Hall 28, so the balcony has 17 over it) |
| doors | 5 to 5.6 m by 6 to 6.4 | **7 by 9** |
| fights | a machine by every mark (the hall, the winch, the shaft, the loft, the Drift and its far landing, the Balance, the Gallery) and the Rope Store's arena | **the Rope Store only**, its keepers round its middle among four drums of cable |
| against the walls | the counterweight's groove from the far wall through the Winch Room's door, the lamp-eye in a niche on the shaft's wall, the loft's try and the passage's ring on walls (the ring over its door), the Drift's and the Balance's rails at their halls' edges, the Gallery's ring on its west wall, the balcony's cable-rail round the hall's wall, the moorers' weight on a cleat in the wall | each in the middle of its room: the groove down the Winch Room's floor, the eye on top of a pier beside the draught, the try on a post by the chest and the ring hung over the loft's floor, the rails out from the middle of wider landings, the ring on a davit over the Gallery, the cable-rail out from the balcony's lip, the weight on a mast |
| the rules broken | **54** (both 7, size 10, ceiling 6, unmeasured 2, door 8, centred 13, foes 8) | **0** |
| the temple design audit | 4.22: structure 5, teach/test/twist 5, combination 4, non-obvious 3 (mean 3.38), decoupling 4, item 5, guardian 4, identity 3, curve 5 | 4.22, the same scores (mean obviousness **3.31**: the ring that opens the Drift is off its door now) |

What it took beyond the sizes: the Mooring Passage (a hall of its own before, but the loft's room in the logic) is
folded into the Cord Loft, its ring hung over the floor on a chain to the door into the Drift; the lamp-eye stands on the
top of a pier whose lip is as far from the draught as the balcony's was, the eye 3 m in from every edge so the top hides it
from the floor; the Drift's near landing is wider (15 m) so its cable-rail starts in the hall's middle, the gap to the far
landing as it was (17.6 m, 6 m up); the Gallery's ring hangs from a davit over the landing, still 14 m from the north lip;
the balcony's cable-rail runs out from its lip toward the capstan, as long as it was round the wall. The guardian's hall
is measured by its two doors (`d6`, `d7` carry `room: 'arena'`). What stayed: the Anchor-Warden, its floor and its fight, the
story's lines, the small key and the great one, every groove's length, the pan, the updrafts and every jump. A save that
stood in the old rooms is taken to its last mark (`LAYOUTS.spacecity` v3).

## The Whale-House (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | the Sounding Hall 36 × 32, the wings 21 × 20, the Horn Chamber a round hall 17 m across, the Tank Hall 33 × 24, the Gallery of Horns 16 × 20, the Horn Store 10 × 12, the landing a 5 m passage | the Sounding Hall **48 × 36**, the wings and the Horn Store **30 × 30**, the Horn Chamber **34 m**, the Tank Hall **40 × 30**, the keepers' landing **30 × 30** (the gallery's room) |
| ceilings | the Pool Room 12, the Shell Room 14, the Horn Chamber 13, the gallery and the Horn Store 9, the Listener's Hall 12 | **18 m** or more (the hall and the landing 20, the tank 22, the Listener's Hall 18), the antechamber a passage 9.6 |
| doors | 3.2 to 5 m by 5 to 6.4 | **7 by 9** |
| fights | a machine by every mark (the hall, both wings, the Horn Chamber, the tank, the gallery) and the Horn Store's arena | **the Horn Store only**, its keepers round its middle among four columns |
| against the walls | the west door's cradle by its wall, the pool's eye on the far wall, the shell's eye on its end wall, the passage horn in the Song Passage, the tank's ball by the west wall, the shelf's ear by the east wall, the landing's eye, ball and dish along a 5 m passage, the Listener's ear over its door | each in the middle of its room: the west door's eye on a pillar over the cradle, the pool's on a pillar out in the water, the shell's on a pillar before the great shell, the passage horn in the Horn Chamber by its north door, the glass, the tank and the shelf down the Tank Hall's middle, the landing's horn, ball and dish out on its floor, the Listener's ear on a column of its own before its door |
| threaded through doors | the Pool Room's ball rolled out through its door and across the hall to the east door's cradle (`b2`) | its cradle by the glass in the Pool Room, which opens the east door across the hall |
| the rules broken | **52** (both 6, size 6, ceiling 6, unmeasured 1, door 9, centred 17, through doors 2, foes 5) | **0** |
| the temple design audit | 4.44: structure 5, teach/test/twist 5, combination 5, non-obvious 4 (mean 2.86), decoupling 5, item 5, guardian 4, identity 3, curve 4 | 4.44, the same scores: `XBXCLGXXK` (the west door's eye and its ball one step, the east door the Pool Room's ball; the landing's horn the gadget alone: 60 % like the Engine-House, 55 % like the Aerie before); mean obviousness 2.71 |

What it took beyond the sizes: the two wings' doors changed keys, so neither is threaded (the west door's eye on a pillar
waits on the hall's ball at its foot, a shot and a push in one room; the east door on the Pool Room's ball, a room away and
out of sight); the passage horn moved into the Horn Chamber, the Song Passage a passage (the run to its door as long as
it was); the Listener's ear stands on a column in the hall before its door, the hall's own puzzle (its room the hall's),
so the landing, a puzzle room after the chest, asks for the horn itself (its eye a horn); the landing's ball is under 20
m from the Listener's Door (its step 2.0, not 1.5); the Listener's Hall is 18 m high, 24 m under the house, under the
rooms over it. The dishes and horns standing on the floor are solid as drawn, and the whorls all their chambers. What
stayed: the Listener and its fight, the story's lines, the small key and its arena, every horn's hold, the glass's rungs,
the loop back through the keepers' door. A save that stood in the old rooms is taken to its last mark (`LAYOUTS.underwater`
v3).

## The Casting-House (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | the Pouring Floor 28 m across, the Mould Room 22 × 18, the Sand Room 12 × 12, the Tong Chamber 19 m across with the Pincer Passage 11 × 12 beside it, the furnace 32 × 26, the Weighing Hall 24 × 37 | the Pouring Floor **36 m**, the Mould Room **34 × 34**, the Sand Room **30 × 30**, the Tong Chamber **34 m** (the passage folded into it), the furnace **46 × 36**, the Weighing Hall **34 × 42**; the Last Casting 40 m as it was |
| ceilings | the Sand Room 9 m, the Tong Chamber 13, the Mould Room 14 | **18 m** or more (the Pouring Floor and the Weighing Hall 22) |
| doors | 5 by 6 to 6.4 | **7 by 9** |
| fights | a machine by every mark (the Pouring Floor, the Mould Room, the Crucible Stair, the Tong Chamber, both lips of the furnace, the Weighing Hall, the cold passage) and the Sand Room's arena | **the Sand Room only**, its keepers round its middle among the bins |
| threaded through doors | the Pouring Floor's stone moon rolled through the west doorway into the Mould Room's mould (`m1`); the hot moon rolled from the Pincer Passage under its door into the furnace's mould (`mH` through `dP`) | each moon, its flame and its mould in one room |
| against the walls | the seam-eye on the Mould Room's west wall, the hoist's pan on a shelf on its north wall, the test scale and the great cradle at the Pouring Floor's edge, the Tong Chamber's try and the Pincer Passage's cradle by their walls, the Weighing Hall's pan on its gallery and its eye over the keepers' door | each in the middle of its room: the eye on a post beside the mould, the pan on a dais, the cradle before the Founders' Door, the passage's cradle out on the chamber's floor, the pan at the end of a pier over the hall, the eye on an iron post |
| the gadget after the chest | one puzzle room asked for the tongs (the Weighing Hall: the furnace's moon was the Tong Chamber's) | two: the furnace (its moon on its own lip) and the Weighing Hall |
| the rules broken | **51** (both 5, size 8, ceiling 3, unmeasured 1, door 7, centred 15, through doors 3, foes 7, gadget 2) | **0** |
| the temple design audit | 4.44: structure 5, teach/test/twist 5, combination 5, non-obvious 4 (mean 2.58), decoupling 5, item 5, guardian 4, identity 3, curve 4 | 4.44, the same scores (`XBCXXXLK`, 70 % like the Engine-House; mean obviousness 2.58) |

What it took beyond the sizes: the upper floor came up from 9 m to 11 (`UP`), so the cold passage under the furnace's
near lip is as tall as the Founders' Door and the Last Casting's (it was 6.4 high under a 9 m floor); the Pincer Passage,
a room on from the chest whose door held the hot moon's rail, folded into the Tong Chamber, its cradle chained across the
floor to the east door, and the hot moon's rail moved onto the furnace's near lip along the channel, its flame and its
hooded mould as far along it as they were (12.8 and 18.4 m), so the moon is as hot for as long; the Weighing Hall's iron
moon starts on a pier out from the gallery (it was rolled in from the furnace's far landing) and its eye stands on a post
in the hall. What stayed: the Last Founder and its fight, the story's lines, the Sand Room's small key for the Founders'
Door, the hoist and its pan (you in it, the stone moon for you), the founders' moon's and the hot moon's rails as long as they were, the press over
the bridge, the keepers' door back. A save that stood in the old rooms is taken to its last mark (`LAYOUTS.moonfoundry` v3).

## The Lamp-House (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | the Hall of Dark Pools 22 × 31, the Root Stair a round hall 20 m across, the Kennel 16 × 14, the Dark Gallery 22 × 34, the Wick Room 16 × 34, the Lantern Chamber 19 m round | the Hall of Dark Pools **36 × 40**, the Root Stair **37 × 46**, the Kennel **30 × 30**, the Dark Gallery **36 × 56**, the Wick Room **30 × 40**, the Lantern Chamber **34 m** round (the chest, its try and the Lamp Passage’s lamp on posts beside it) |
| ceilings | 10 (the Kennel) to 13 m; the loft’s pool 3.9 m under the hall’s roof | **16 m** or more over every floor (the Root Stair 28, the loft’s pool 17) |
| doors | 5 by 6 to 6.4, the Wick Room's grille 2.4 by 3 | **7 by 9**, the grille too |
| fights | a machine by every mark (the Hall of Dark Pools, the Root Stair, the Lantern Chamber, the gallery, the Wick Room), and the Kennel's arena | **the Kennel only**, its keepers round its middle among four columns |
| against the walls | the loft's pool by the west wall, the hidden eye on the gallery's south wall, the far door's niche in the west wall, the Wick Room's two niches in its east wall, the lamps by the doors | each in the middle of its room: the loft a block out from the wall, the eye on a post over the near floor, the niche on the far floor, the niches in the **wick-house** in the middle of the Wick Room, the lamps on posts |
| threaded through doors | the pool-orb `orb5` rolled from the Hall of Dark Pools through `d1` to the Root Stair's socket | the orb, its small pool and the socket on the Root Stair's near floor |
| the rules broken | **51** (both 5, size 8, ceiling 6, unmeasured 1, door 7, centred 17, door_thread 2, foes 5) | **0** |
| the temple design audit | 4.22: structure 5, teach/test/twist 5, combination 4, non-obvious 4 (mean 2.83), decoupling 5, item 5, guardian 4, identity 3, curve 3 | **4.33**: decoupling **4** (the orb's step in its own room: 3 of 6 keys out of the lock's room or sight), curve **5** (complexity 3 → 4.25 across the house); mean obviousness 3.08; skeleton `BXCGRLLK` as it was |

What it took beyond the sizes: the loft's pool stands 4.3 m back from the loft's edge, so nowhere on the bigger floor sees
it (the hall's far corners are 35 m off); the Root Stair and the Hall of Dark Pools are as wide as each other, so the
stair is half a metre wider each side (`ROOMS.roots`), or their side walls lay one in the other through the wall between
them (two z-fights); the Wick Room's grille, a door on a link, is 7 by 9 too, so the key's alcove is a block of its own,
the wick-house, with a niche either side; the ledge of roots to the keepers' door runs along the Root Stair's east wall
over the pool, 9 m up, out of any jump's reach from the floor. The Lamp Passage's lamp moved into the Lantern Chamber
(a puzzle room now, 34 m round): made a room of its own past a door for the lantern in hand, as the Belfry's porch, the
house gained a step and its design score fell to 4.0 (the chest at 29 % of the steps, the skeleton 67 % like the
Footprint's). The Lamp-Room is measured by its lure pools (`LurePools`
carries the guardian's id). What stayed: the Lampless and its fight, the story's lines, the small key and the great one,
the loop back up through the keepers' door, the pits, every groove's length, every orb's glow and every climb. A save
that stood in the old rooms is taken to its last mark (`LAYOUTS.perdide2` v4).

## The Clock-House (v1.77)

| | before | after |
|---|---|---|
| rooms (puzzle / fight) | the Escapement and its far landing 22 × 35, the Winding Well 20 m across, the Pendulum Hall and the Striking Room 16 × 16, the Mainspring Room 12 × 10, the Clock Gallery 22 × 34; the Coil Chamber 19 m round | the Escapement and its landing **32 × 59**, the Winding Well **36 m**, the Pendulum Hall, the Striking Room, the Mainspring Room and the **Winding Passage** (a room of its own) **30 × 30**, the Clock Gallery **36 × 34**; the Coil Chamber 26 m (a chest's) |
| ceilings | 12 to 14 m (the far landing 9 over its cupboard's eyes, the Cupboard 7) | **18 m** or more (the Escapement 22, the well 26; the Cupboard, a passage, 10) |
| doors | 3.6 to 5 m by 5 to 6.4 | **7 by 9** |
| fights | a machine by every mark (the Escapement, the well, the Coil Chamber, the gallery, the Striking Room, the Mainspring Room) and the Pendulum Hall's arena | **the Pendulum Hall only**, its keepers round its middle among four columns |
| threaded through doors | the counterweight rolled from the far landing through the well's doorway to its socket | the groove and its socket on the landing, a room from the door it opens |
| against the walls | the escapement's dial and eyes over the far door, the Cupboard's clock over its door, the hour track and its eye on the east wall, the mainspring on the east wall, the passage's six eyes round its door, the gallery's clock on the far wall | each in the middle of its room: the dial on a tower in the pit beside the disc's way, the Clockmaker's clock a tall case on the landing, the track down the middle and the eye on an obelisk, the spring on a stele, six eyes round an escape wheel on a stele, the great clock hung over the bridge's far end |
| the rules broken | **49** (both 6, size 8, ceiling 7, unmeasured 1, door 7, centred 14, through doors 1, foes 4, gadget 1) | **0** |
| the temple design audit | 4.22: structure 5, teach/test/twist 5, combination 4, non-obvious 4 (mean 3.08), decoupling 4, item 5, guardian 4, identity 3, curve 4 | 4.22: decoupling **5** (5 of 7 steps: the counterweight a room from its door), curve **3** (the new north door, the simplest step, comes mid-way: trend 0.31 → 0.20); mean obviousness 3.07; skeleton `BAXLCRGXXLK`, 64 % like the Founders' Belfry |

What it took beyond the sizes: the gadget was used in only one puzzle room after the chest (the passage's eyes were the
Coil Chamber's), so the Winding Passage became a room of its own behind a north door that sinks for the coil in hand
(`dP`, as the Undertower's `dL`): every room after the chest asks for it. The upper house is a metre higher (`UP`, 10 m),
so the Pendulum Hall's way out, 7 by 9, clears its way in under it; the climb is 10 m. The counterweight could not stay in
the well (its groove ran through the doorway) nor come into it (in the well's middle, in sight of the door at the climb's
top, the step was plain): its groove runs up the landing's east side instead, 16 m as it was 21. The Foreman's Workshop is
measured by its two doors (`d4`, `d5` carry `room: 'hall'`). What stayed: the Foreman and its fight, the story's lines, the
two small keys and the great one, the loop back over the ledge, the disc's ride, the pits, every eye's order and breath,
the gallery's chasm and its pendulum's beat. A save that stood in the old rooms is taken to its last mark
(`LAYOUTS.garage` v3).

## The other houses

From `node --test tests/temple-rules.test.js` (its report, the rules each house breaks today; `PENDING` there holds the
counts, and a house may not get worse). Ranked worst first:

| House | Broken | both | size | ceiling | door | centred | through doors | foes | other |
|---|---|---|---|---|---|---|---|---|---|
| Builders' Greenhouse (edena) | 58 → **0** (v1.77, above) | 7 | 10 | 6 | 7 | 20 | 0 | 8 | |
| Undertower (bazaar) | 55 → **0** (v1.77, above) | 7 | 9 | 8 | 7 | 16 | 1 | 6 | 1 unmeasured |
| Mooring-House (spacecity) | 54 | 7 | 10 | 6 | 8 | 13 | 0 | 8 | 2 unmeasured |

| Mooring-House (spacecity) | 54 → **0** (v1.77, above) | 7 | 10 | 6 | 8 | 13 | 0 | 8 | 2 unmeasured |
| Whale-House (underwater) | 52 | 6 | 6 | 6 | 9 | 17 | 2 | 5 | 1 unmeasured |
| Lamp-House (perdide2) | 51 | 5 | 8 | 6 | 7 | 17 | 2 | 5 | 1 unmeasured |
| Casting-House (moonfoundry) | 51 → **0** (v1.77, above) | 5 | 8 | 3 | 7 | 15 | 3 | 7 | 1 unmeasured, 2 gadget |

| Lamp-House (perdide2) | 51 → **0** (v1.77, above) | 5 | 8 | 6 | 7 | 17 | 2 | 5 | 1 unmeasured |
| Casting-House (moonfoundry) | 51 | 5 | 8 | 3 | 7 | 15 | 3 | 7 | 1 unmeasured, 2 gadget |
| Clock-House (garage) | 49 | 6 | 8 | 7 | 7 | 14 | 1 | 4 | 1 unmeasured, 1 gadget |

| Clock-House (garage) | 49 → **0** (v1.77, above) | 6 | 8 | 7 | 7 | 14 | 1 | 4 | 1 unmeasured, 1 gadget |
| Engine-House (buried) | 41 | 5 | 6 | 4 | 6 | 14 | 1 | 5 | |
| Founders' Belfry (arzach2) | 40 → **0** (v1.77, above) | 3 | 7 | 6 | 6 | 11 | 1 | 4 | 2 unmeasured |
| Hush-House (perdide) | 36 | 5 | 8 | 5 | 7 | 3 | 1 | 6 | 1 unmeasured |
| Footprint (spheres) | 36 | 3 | 5 | 4 | 5 | 12 | 0 | 3 | 2 unmeasured, 2 gadget |

What repeats, and how the Rose House answered each:

- **Every house is small.** Rooms 14 to 26 m across, round halls 19 to 20 m, ceilings 10 to 14 m, doors 5 by 6. Scale the
  halls to 36 m and the ceilings to 18 to 24, keep the props and the jumps; doors 7 by 9.
- **A machine in every room** ("both", "foes"): the marks' machines. Tag the rooms; give the fights rooms of their own
  (most houses have an arena already: it becomes the house's fight, with the machines round its middle).
- **Puzzles against the walls** ("centred"): eyes set high on end walls, grooves along a side wall, plates in corners.
  Bring the groove down the middle, the eye onto an obelisk or a pillar in the floor.
- **Through doors** (16 in nine houses): the Lamp-House's orb (`orb5`) rolled through the Hall of Dark Pools' door into
  the Root Stair, the Whale-House's ball (`b2`) through its pools' door (v1.77: its cradle in the Pool Room now), the Casting-House's moulds (`m1`, `mH` through
  `dP`), the Hush-House's orb (`oB` through `dJ`), and a ball rolled into the next room's plate in the Undertower
  (`ballT` into the tuning room), the Clock-House (`ball1` into the well), the Engine-House (`ballJ`) and the Belfry
  (`ball3`, onto the far side of its hall). Put the ball, its plate and what it lights in one room.
- **Unmeasured** rooms (eleven, mostly the guardians' halls and antechambers built wall by wall rather than with the
  kit's halls): build them with `hall` or `rotunda` so the rules can read them.
- **The gadget unused after the chest** (the Casting-House's furnace and its tongs, the Footprint's Hall of the Unseen
  and its lens, the Clock-House's coil): a puzzle room after the chest that asks only for older verbs, or only one room
  that asks for it. Each wants a step with the gadget in it.

The next houses to redo, by how much the player meets them and how much they break: the Warden's Well was the second
(above), then the Founders' Belfry, the Builders' Greenhouse and the Aerie (above), then the Undertower, the Mooring-House and the Whale-House (above), then the **Lamp-House** (most
broken).
