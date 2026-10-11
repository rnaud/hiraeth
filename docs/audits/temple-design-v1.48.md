# Temple design audit, v1.48 (2026-10-11)

<!-- audit-scores
overall: 4.03 / 5
label: the average of the fourteen temples' means (3.95 before this batch)
date: 2026-10-11
-->

This report re-runs the `temple-design-qc` skill (`.claude/skills/temple-design-qc/SKILL.md`) for issue #23: "redo the
temples with less linear paths: several rooms with puzzles, keys found in one room that open others, rooms that close
behind you and hold a small arena challenge to reopen. A temple you explore, not a corridor of rooms in order." The kit
gained keys, locks, arenas and coffers (docs/systems/temples.md, "Hubs, keys and arenas"), and the four temples whose
structure scored 2 or less, lowest first, were reworked round a hub: the Clock-House, the Builders' Greenhouse, the
Undertower and the Warden's Well. Every temple keeps its guardian and its puzzles; the wings are added rooms.

## The setup

- `node scripts/temple-design/audit.mjs` before the batch (at `2687b4bd`) and after it (`18df135a`), all fourteen temples,
  each solved with what the route has given by then (the backpack, the gun, the double jump and the earlier temples'
  gadgets). Every temple is solved, both before and after.
- **The audit learned the new pieces** (`scripts/temple-design/lib.mjs`, `tests/temple-design.test.js`): a key's cage (a
  `key` element's `when`) is a step of its own in the key's room; a lock a key alone opens (the great lock) and an arena's
  way out are not puzzles; a key carried to its lock adds no obscurity or complexity to that lock (a lock says plainly what
  it wants), only a fetch; keys fetched across rooms count toward the structure (`fetched`, half a point each, two at most);
  the skeleton writes `L` for a key lock and `A` for an arena. The other ten temples score as they did.
- Not checked: climbs, how readable a lamp or a glyph is, and the fights (the arenas were played with stand-in keepers in
  the node tests, and with the house's own machines in the game for the pictures; the guardians are untouched).

## The scores

| Temple | Structure | Teach→test→twist | Combination | Non-obvious | Decoupling | Dungeon item | Guardian exam | Identity | Curve | **Mean** |
|---|---|---|---|---|---|---|---|---|---|---|
| Clock-House (garage) | 2 → 5 | 5 | 3 → 4 | 3 → 4 | 3 → 4 | 3 → 5 | 3 | 2 | 2 | **2.89 → 3.78** |
| Builders' Greenhouse (edena) | 2 → 4 | 5 | 5 | 3 | 4 → 5 | 5 | 3 | 3 | 3 → 1 | **3.67 → 3.78** |
| Undertower (bazaar) | 2 → 5 | 5 | 4 | 3 | 5 | 5 | 3 | 2 | 5 → 3 | **3.78 → 3.89** |
| Warden's Well (incal) | 2 → 5 | 5 | 5 | 4 | 5 | 5 | 4 | 3 → 2 | 5 | **4.22 → 4.44** |
| Engine-House (buried) | 2 | 5 | 5 | 4 | 5 | 4 | 4 | 3 | 4 | **4** |
| Mooring-House (spacecity) | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 3 → 2 | 5 | **4.33 → 4.22** |
| Givers' House (desert) | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 3 | 3 | **4.11** |
| Aerie (arzach) | 3 | 5 | 4 | 3 | 4 | 4 | 4 | 3 | 4 | **3.78** |
| Founders' Belfry (arzach2) | 4 | 5 | 4 | 4 | 5 | 5 | 4 | 2 | 3 | **4** |
| Hush-House (perdide) | 5 | 5 | 3 | 3 | 4 | 5 | 3 | 3 | 2 | **3.67** |
| Lamp-House (perdide2) | 3 | 5 | 4 | 4 | 5 | 5 | 4 | 2 | 1 | **3.67** |
| Whale-House (underwater) | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 2 | 4 | **4.33** |
| Casting-House (moonfoundry) | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 3 | 4 | **4.56** |
| Footprint (spheres) | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 2 | 3 | **4.22** |

No score was moved by eye.

## What changed, per temple

- **The Clock-House** (`BBCGXK` → `BAXBLCGXXLK`: one loop, three hubs, three keys fetched). The Winding Well is the hub:
  west the Pendulum Hall (an arena; won, its key's cage sinks and a door over the way in opens onto a balcony beside the
  ledge over the climb: the loop), east the Striking Room (the hour track: a ball and three plates at two, four and six;
  on four, the house's hour, which the well's clock shows a room back, the striking eye's lids open). The door over the
  climb takes both keys and the counterweight. After the chest, the Mainspring Room off the Clock Gallery's near landing
  (a ball rolled in from the landing, then six eyes in a breath: the coil with an older verb) holds the great key for the
  Foreman's door, which you meet locked across the bridge first. The optional Clockmaker's Cupboard off the Escapement (its
  little clock has lost its hand: four, eight, twelve) previews the gallery's twist and holds a coffer of chimes.
- **The Builders' Greenhouse** (`XBXCGXXK` → `XLBXCGXXK`). The Potting Hall is the hub: the Shade House (an arena in the
  dark) and the Cold Frame (one louvre, one ball, two eyes: a woken eye stays awake, so the ball serves both in turn,
  the Glass Stair's lesson taught a room early). The Glass Stair's door takes both keys and the eye in the sun.
- **The Undertower** (`XBCGGXK` → `XXBLCGGXK`). The Cable Well is the hub: the Cable Store (an arena) and the Tuning Room (a
  dish across the room, deaf until a ball rolled in from the well is on its footstone; a low and a high stone by its mouth;
  the far horn wants the high one, its ring the high one's colour, as the well's own horn is told). A door in the passage
  from the landing into the Shell Chamber takes both keys.
- **The Warden's Well** (`BXCTXXXK` → `BBLCTXXXK`). The Climb is the hub: the Ash Store (an arena) and the Vane Room (a chasm
  whose stones stand only while the small vane on its far wall turns: splash it, cross before it slows; stranded, splash it
  again). The door at the balcony's end takes both keys and the ball on its plate.

## Across the temples

- **Structure** rose from 2 to 4 or 5 in all four. The Clock-House alone has a loop and the great key; the other three have a
  hub with two wings and a door of two keyholes.
- **Identity fell** a point in the Warden's Well and the Mooring-House: the four reworked houses now share a template (two
  wings off a round hub, a small key each, one door of two keyholes on to the chest), the Ocarina trap the skill's first
  principle warns of. Each wing is its world's own idea, but the shape repeats.
- **The curve fell** in the Greenhouse (3 → 1) and the Undertower (5 → 3): the wings put two mid-sized steps before the
  gadget, so the gadget's first lock (the Bud Passage, the Listening Passage), cheap on purpose, reads as a drop.
- The guardians are untouched (the "Combat telegraphs" batch has them), so the guardian exam stays at 3 to 4.

## The ranked edits (what is left of issue #23)

1. **The Engine-House** (structure 2): the last temple at 2. Its Crank Hall or the Fourth Chamber's anteroom as a hub,
   wings that jam the engine's cranks in turn (the house's own idea), one an arena.
2. **Break the shared hub template**: give the next rework a different shape: a loop instead of wings (the Aerie, 3), keys
   found after the gadget for locks back in the first half (the Lamp-House, 3: return to the Hall of Dark Pools with the
   lantern), or a great key in a wing rather than past the chest.
3. **A great key in the three later reworks**: the guardian's door of the Greenhouse, the Undertower and the Warden's Well is
   still opened by its puzzle, not a key; a post-gadget wing with the great key (as the Clock-House's Mainspring Room) would
   bring their late steps up and their curve back.
4. **The curve**: the gadget's first lock beside a wing reads as a dip; give its passage a second verb, or move one wing after
   the chest.
5. **The other temples with structure 3** (the Aerie, the Lamp-House): a loop each.

## Against the last report

The [v1.27 report](temple-design-v1.27.md) measured eleven temples (3.90); the three v1.40 houses joined since, and this
batch's starting point was 3.95 over fourteen. The four reworked temples' structure is now 4 or 5; the Clock-House moved from
the lowest (2.89) to the middle (3.78). The mean is 4.03.
