# Temple design audit, v1.49 (2026-10-11)

<!-- audit-scores
overall: 4.21 / 5
label: the average of the fourteen temples' means (4.03 before this batch)
date: 2026-10-11
-->

The second round of issue #23 ("a temple you explore, not a corridor of rooms in order"), re-run with the
`temple-design-qc` skill (`.claude/skills/temple-design-qc/SKILL.md`). The [v1.48 report](temple-design-v1.48.md) left the
Engine-House at structure 2, the Aerie and the Lamp-House at 3, and found that its four reworks shared one template (two
wings off a round hub before the chest, a small key each, one door of two keyholes), so identity fell in the Warden's
Well and the Mooring-House, and that the curve fell in the Greenhouse (3 → 1) and the Undertower (5 → 3). This batch took
the Engine-House, then the remaining houses lowest structure first (the Aerie, the Lamp-House, the Belfry), gave each its
own shape, and brought the Greenhouse's and the Undertower's curves back up with a late step that carries the great key.

## The setup

- `node scripts/temple-design/audit.mjs` before the batch (at `92ded544`, the v1.48 report's end) and after it, all
  fourteen temples, each solved with what the route has given by then. Every temple is solved, before and after.
- **The audit learned three things** (`scripts/temple-design/lib.mjs`): a lock that wants one ball at two of its stops
  (one after the other, through a woken eye or a grown seed) has an order to find (`sequence`); a lock whose keys want the
  gadget is met after the chest wherever its room is (`index`, `afterGadget`); a door that opens with another (`{ open }`)
  is no step of its own. No other temple's score moved by these.
- The on-foot tests walk both wings of every reworked house and its new great-key room (`tests/temples.test.js`), the
  logic tests solve each either way round and each wing alone, and each has an old-save test (`migrate.js LAYOUTS`). The
  playthrough (`tests/playthrough.test.js`) now plays the Engine-House, the Greenhouse, the Undertower, the Lamp-House and
  the Belfry to their guardians (before, only to their chests or not at all), and reports a temple it walks eighty steps
  in without getting anywhere.
- Not checked: climbs, how readable a lamp or a glyph is, the fights (the arenas were played with stand-in keepers in the
  node tests and with the house's own machines in the game for the pictures; the guardians are untouched).

## The scores

| Temple | Structure | Teach→test→twist | Combination | Non-obvious | Decoupling | Dungeon item | Guardian exam | Identity | Curve | **Mean** |
|---|---|---|---|---|---|---|---|---|---|---|
| Engine-House (buried) | 2 → 5 | 5 | 5 | 4 → 3 | 5 | 4 → 5 | 4 | 3 | 4 | **4 → 4.33** |
| Aerie (arzach) | 3 → 5 | 5 | 4 → 5 | 3 | 4 | 4 | 4 | 3 | 4 → 5 | **3.78 → 4.22** |
| Lamp-House (perdide2) | 3 → 5 | 5 | 4 | 4 | 5 | 5 | 4 | 2 → 3 | 1 → 3 | **3.67 → 4.22** |
| Founders' Belfry (arzach2) | 4 → 5 | 5 | 4 | 4 | 5 | 5 | 4 | 2 | 3 | **4 → 4.11** |
| Builders' Greenhouse (edena) | 4 → 5 | 5 | 5 | 3 → 4 | 5 | 5 | 3 | 3 | 1 → 3 | **3.78 → 4.22** |
| Undertower (bazaar) | 5 | 5 | 4 → 5 | 3 → 4 | 5 | 5 | 3 | 2 | 3 → 4 | **3.89 → 4.22** |
| Clock-House (garage) | 5 | 5 | 4 | 4 | 4 | 5 | 3 | 2 | 2 | **3.78** |
| Warden's Well (incal) | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 2 | 5 | **4.44** |
| Mooring-House (spacecity) | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 2 | 5 | **4.22** |
| Givers' House (desert) | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 3 | 3 | **4.11** |
| Hush-House (perdide) | 5 | 5 | 3 | 3 | 4 | 5 | 3 | 3 | 2 | **3.67** |
| Whale-House (underwater) | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 2 → 3 | 4 | **4.33 → 4.44** |
| Casting-House (moonfoundry) | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 3 | 4 | **4.56** |
| Footprint (spheres) | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 2 → 3 | 3 | **4.22 → 4.33** |

No score was moved by eye. The Whale-House and the Footprint changed nothing: their identity rose because the houses they
were most like (the Belfry, the Lamp-House) changed shape.

## What changed, per temple

- **The Engine-House**, a hub *past* its chest (`XBCXXK` → `XBACGXLXLK`; one loop, two hubs, two keys fetched). The
  Fourth Chamber's four still eyes, once a try that opened nothing, sit two by each of two shutters (one element, two
  doors) and roll them up: the fourth chamber's first lock. West the **Boiler Room**, an arena whose flue opens on into
  the Crank Passage beside its door (the loop); east the **Governor Room**: the great key caged on an anvil under a
  hammer, one ball between the hammer's crank and the one under four eyes on pistons. Rolled to the pistons', they stand
  for four in a breath but the hammer runs down on the cage; rolled back, the eyes stay awake and the cage sinks. The Crank
  Passage's door takes the small key, the Tooth-Warden's the great one.
- **The Aerie**, a vertical stack (`BCTXXK` → `BCTLXXXLK`). Rooms off the Wind Well at its foot and up its height: the
  **Moult** west off the floor (an arena, the small key, for the way north off the high balcony) and, along a ledge round
  the well's wall from the high balcony, the **Eyrie**: two vents and one stone, both throats on its ledge. As the stone
  starts the wind comes out of the ledge's own vent (a column to a coffer's shelf); in the other throat, out of the gap's
  foot, a column past the great key's perch six metres up (the Roost's two vents and one stone, taught a house early).
  The Roost's door takes the great key.
- **The Lamp-House** (`BXCGRXK` → `BXCLRXLK`): the **Kennel** east off the Hall of Dark Pools (an arena in the dark, the
  small key for the Lamp Passage's door) and, east off the Dark Gallery's far side, the **Wick Room**: two niches, two
  pool-orbs, the great key behind a grille that lifts only while both niches burn; a niche burns only while its orb
  glows, so the second has to be lit and rolled home inside the first's glow (two lights carried at once). The gallery's
  far door takes the great key.
- **The Founders' Belfry** (`BXBCGXXK` → `LXBCGXXK`): its hub of two stone stores keeps its shape; the west store is an
  arena now, the east store's ball stays, and the Hall of Stones' door takes the key and the ball's weight (standing on
  the plate yourself no longer latches it).
- **The Builders' Greenhouse**, its curve (1 → 3): the bud into the Vine Gulf is in the shade until the passage's ball turns
  its louvre (the bloom with the push, where it was the bloom alone), and past the gulf the **Seed Vault**: one louvre, one
  ball, two seeds at the foot of a glass wall; the vine climbs it only from both, so the sun goes to one, then the other.
  Its great key opens a door past the bud into the Glasshouse.
- **The Undertower**, its curve (3 → 4): the Listening Passage's horn is deaf until a ball is on its footstone, and past the
  Gallery of Voices the **Choir**: the far horn hears only the low stone's own song through a pair of dishes, the near one
  the high note played back from the shell (and the shell keeps the low stone's song too, so the order matters a little).
  Its great key opens the gallery's far door.
- **Fixed on the way**: the marker went back and forth between a ball's two plates in the Greenhouse's Cold Frame and on
  its Glass Stair (round 1's Cold Frame, and the Glass Stair since v1.16): the eyes now come before their balls in
  `LOGIC`. In the Aerie's Gulf it pointed nowhere while the vent's stone sat in its throat (`logic.next` now points at a
  ball whose stop holds a door shut). A key's plinth stands (it was walked through).

## Across the temples

- **Structure** is 5 in every temple now (it was 2-4 in four of them).
- **The shapes differ**: a hub past the chest with a loop out of its arena (the Engine-House), a stack up one shaft (the
  Aerie), a key in the first hall's arena for a door past the chest and a great key past the gallery (the Lamp-House), the
  Belfry's own two stores. But a pattern repeats in the late steps: four houses (the Greenhouse, the Undertower, the
  Lamp-House, and the Clock-House before them) now keep the great key in a room off the last puzzle hall, for the door
  into the guardian. It is what brings their curves up (the last third is the hardest step), and each room's puzzle is
  its house's own (the sun, a note carried, a light carried), but the place repeats.
- **Identity** rose in the Lamp-House, the Whale-House and the Footprint, and is still 2 in the Belfry, the Clock-House, the
  Warden's Well, the Mooring-House and the Undertower: the skeletons still mostly share an opening (`B`/`X` steps before the
  chest) and a run of `X` steps to the guardian.
- **The curve** rose in the Greenhouse (1 → 3), the Undertower (3 → 4), the Lamp-House (1 → 3) and the Aerie (4 → 5). The
  Hush-House (2) and the Clock-House (2) are the lowest now: both have cheap steps in the middle (the Hush-House's eye from
  the disc, its jaws, its ledge's gate and the pendulums' crossing).
- **The guardians** are untouched (the guardian exam is 3-4); the arenas' keepers are the house's own machines.

## The ranked edits (what is left of issue #23)

1. **The Hush-House** (3.67, the lowest with the Clock-House): its middle is cheap (the eye seen from the disc 1.25, the
   Snapping Passage's jaws 1.0, the ledge's gate 1.0, the pendulums' crossing 1.25). An arena off the Choir alone made it
   worse (a key before the chest in a house whose first door is already its hardest step: tried and dropped); give the
   jaws a second verb (stilled in the order the Choir taught) and put a wing with the great key past the gallery.
2. **An arena in the six houses that have none** (the Givers' House has its own fight room; the Hush-House, the Whale-House,
   the Casting-House, the Footprint and the Mooring-House none): each a wing of its hub, its key for a door that wants
   another wing too.
3. **Identity 2** (the Belfry, the Clock-House, the Warden's Well, the Mooring-House, the Undertower): the Warden's Well and
   the Mooring-House are 78 % alike; a different shape for one of them (the Mooring-House's Capstan Hall as a ring of
   moorings, or the Warden's Well's great key in a wing past the chest).
4. **The Clock-House's curve** (2): its Escapement and Winding Well steps come first and are its hardest; move the
   Mainspring Room's six-in-a-breath after the gallery's bridge, or give the Escapement's opening a cheaper first lesson.
5. **Don't repeat the late great-key room**: the next reworks should keep the great key somewhere else (a wing before the
   chest, as the Hush-House's could, or a loop back to the first half).

## Against the last report

The [v1.48 report](temple-design-v1.48.md) ended at 4.03 over fourteen; this batch took the four lowest structures (2-4)
to 5 and two curves back up, and the mean is 4.21. Every temple's structure is 5; the means run from 3.67 (the
Hush-House) to 4.56 (the Casting-House).
