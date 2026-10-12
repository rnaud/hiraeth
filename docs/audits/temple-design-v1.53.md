# Temple design audit, v1.53 (2026-10-12)

<!-- audit-scores
overall: 4.28 / 5
label: the average of the fourteen temples' means (4.19 before this batch)
date: 2026-10-12
-->

Round 3 of issue #23 ("a temple you explore, not a corridor of rooms in order"), done with the `temple-design-qc` skill
(`.claude/skills/temple-design-qc/SKILL.md`). The [v1.49 report](temple-design-v1.49.md) left five things: the
Hush-House's cheap middle (3.67, the lowest); no arena in five houses (the Hush-House, the Whale-House, the
Casting-House, the Footprint, the Mooring-House); identity 2 in five (the Warden's Well and the Mooring-House 78 % alike);
the Clock-House's curve (2); and four houses keeping the great key in a room off their last puzzle hall. This batch
covers all five.

## The setup

- `node scripts/temple-design/audit.mjs` was run before the batch (at `4056d2ee`) and after it, on all fourteen temples.
  Every temple is solved before and after. Since the v1.49 report two guardian scores moved without any change here: the
  Belfry and the Lamp-House went from 4 to 3, because their guardians' ground telegraphs passed the audit's limit. The
  "before" column is the re-run at `4056d2ee`, not the v1.49 table.
- **The kit learned four things** (`src/temples/pieces.js`, `logic.js`):
  - A `Jaw` stilled out of turn (`after`) rings flat and says so.
  - A `Jaw` whose element has `hold` thaws: it warns, then snaps shut again.
  - A `Ball` can run through a mouth of jaws (`jaws`): shut, the jaws spit the ball back.
  - A `Switch` says what its `when` waits on (`unmet`), and a `Bank` says what it started (`woke`).
  - `solve` now also prefers a ball's stop that brings a lock within reach of a key in hand. No other temple's solve or
    score changed.
- **Tests.** Every changed house has an on-foot test of its new rooms in `tests/temples.test.js`. Each also has a logic
  test that solves it both ways round and with the new wing left out (`forbid`), and an old-save test (`migrate.js
  LAYOUTS`: perdide, spacecity, underwater, moonfoundry and spheres at v2). The Clock-House needed no layout step: its
  great key moved, but no lock was added. The playthrough now also plays the Hush-House and the Footprint to their
  guardians (`tests/playthrough-worlds.js`); the zfight and climb tests hold at their baselines.
- **Not checked:** climbs beyond the climb test's probes, how readable the new clues are (the lidded cupboard, the
  crowns' sizes), and the fights. The arenas were played with stand-in keepers in node and with the house's own machines
  in the pictures; the guardians are untouched. Nobody has played these rooms by hand yet.

## The scores

| Temple | Structure | Teach→test→twist | Combination | Non-obvious | Decoupling | Dungeon item | Guardian exam | Identity | Curve | **Mean** |
|---|---|---|---|---|---|---|---|---|---|---|
| Hush-House (perdide) | 5 | 5 | 3 → 4 | 3 → 4 | 4 → 5 | 5 | 3 | 3 | 2 → 4 | **3.67 → 4.22** |
| Mooring-House (spacecity) | 5 | 5 | 4 → 5 | 4 | 4 → 5 | 5 → 4 | 4 | 2 → 3 | 5 | **4.22 → 4.44** |
| Clock-House (garage) | 5 | 5 | 4 | 4 | 4 | 5 | 3 | 2 → 3 | 2 → 4 | **3.78 → 4.11** |
| Whale-House (underwater) | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 3 | 4 | **4.44** |
| Casting-House (moonfoundry) | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 3 | 4 | **4.56** |
| Footprint (spheres) | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 3 | 3 | **4.33** |
| Warden's Well (incal) | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 2 → 3 | 5 | **4.44 → 4.56** |
| Founders' Belfry (arzach2) | 5 | 5 | 4 | 4 | 5 | 5 | 3 | 2 → 3 | 3 | **4 → 4.11** |
| Lamp-House (perdide2) | 5 | 5 | 4 | 4 | 5 | 5 | 3 | 3 → 2 | 3 | **4.11 → 4** |
| Givers' House (desert) | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 3 | 3 | **4.11** |
| Aerie (arzach) | 5 | 5 | 5 | 3 | 4 | 4 | 4 | 3 | 5 | **4.22** |
| Builders' Greenhouse (edena) | 5 | 5 | 5 | 4 | 5 | 5 | 3 | 3 | 3 | **4.22** |
| Engine-House (buried) | 5 | 5 | 5 | 3 | 5 | 5 | 4 | 3 | 4 | **4.33** |
| Undertower (bazaar) | 5 | 5 | 5 | 4 | 5 | 5 | 3 | 2 | 4 | **4.22** |

No score was moved by eye. Five houses kept the same scores but changed shape: the Warden's Well, the Belfry and the
Lamp-House moved only because the houses most like them changed. The Lamp-House is now 67 % like the Whale-House.

## What changed, per temple

- **The Hush-House** (`BBCGBTXK` → `BBCXATLXLK`).
  - The Snapping Passage has two more mouths of jaws in its walls, each crowned with a crystal: small, middling, and
    the gate's the biggest. They still only in the Choir's order, so the gate, the obvious first shot, rings flat. The
    smallest mouth keeps a coffer.
  - West off the Pendulum Gallery's far landing, the **Nursery** is an arena. Winning it opens the keeper's gate along
    the gallery (its footstone was a step of nothing) and gives a small key.
  - The key opens a little door on top of the Bog Well's root-wall. A **ledge** runs from there round the well's west
    wall at 9 m and through the walls onto a **balcony** over the Choir, where you began.
  - On the balcony the great key sits behind a wall, beside the parapet, and is seen from the Choir's floor. A ball in
    a groove runs through a snapper's mouth in that wall to the cage's footstone. Shut, the mouth spits the ball back.
    Stilled, it opens, but here the frost **thaws**: roll the ball through before it snaps shut, then still it again to
    walk through yourself. This breaks the assumption the passage taught ("they forget to close").
  - The far door takes the great key. The previous report's warning held: an arena off the Choir alone made the house
    worse, and the one placed after the gallery made it better.
- **The Mooring-House** (`BBCGXXXK` → `BBCGXXLXXLK`).
  - South off the Moorers' Gallery, the **Rope Store** is an arena. Its small key opens the moorers' gate, which the
    Gallery's ring used to open.
  - Inside the gate, on the Capstan Hall's balcony over the hub the house began in, the great key's cage waits. A ball
    out along a cable-rail round the hall's wall is tethered home onto the cage's footstone (the Drift's lesson). The
    cage needs the Gallery's ring as well (its chain), and the Capstan Floor's door takes the great key.
  - The house is now 64 % like the Aerie, down from 78 % like the Warden's Well, so both houses' identity rose.
  - The chest now sits at 29 % of the steps, just under the dungeon-item band (4); this is left as it is.
- **The Clock-House** (curve 2 → 4).
  - Wound, the Mainspring Room's spring starts the house's little clocks again; it no longer holds the great key.
  - The Clockmaker's Cupboard, back by the Escapement, has lidded eyes until the spring runs ("whatever drives the
    house's clocks hangs slack"). The great key is in the cupboard now, beside its coffer.
  - The way back is the Pendulum Hall's stair. This gives the house a state every room reads, and puts the hardest step
    last.
- **The Whale-House, the Casting-House, the Footprint**: an arena each, each with a small key for a later door that keeps
  its own condition.
  - The Whale-House's **Horn Store** is off the Sounding Hall, a wing of the hub. Its key opens the Song Passage's door,
    past the horn.
  - The Casting-House's **Sand Room** is off the Mould Room, before the chest. Its key is carried all the way to the
    Founders' Door.
  - The Footprint's **Keepers' Lodge** is off the Keepers' Gallery. Its key opens the far door over the Hall of the
    Unseen.
  - These three scores held, and none fell. The Whale-House's key first went to the Listener's Door, which gave it a
    second step at 1.5 or under; it was moved to the passage door.

## Across the temples

- **An arena in every house**: all fourteen have one now (the Givers' House has its own fight room).
- **The great key, its place**: the Hush-House, the Mooring-House and the Clock-House now keep it in the first half,
  reached by a loop back past the chest in a changed state (a wing on the root-wall's top, the hub's balcony, the
  cupboard by the Escapement). Three houses still keep it in a room off their last puzzle hall: the Greenhouse, the
  Undertower and the Lamp-House.
- **Identity**: 2 is left in two houses, the Undertower (70 % like the Casting-House) and the Lamp-House (67 % like the
  Whale-House, since the Whale-House's arena). The most-alike pairs are now the Greenhouse and the Casting-House at 73 %,
  and the Engine-House, the Undertower and the Casting-House at 70 %. A run of `X` steps after the chest is still
  what they share.
- **The curve**: no house is at 2 now; the lowest are 3 (the Givers' House, the Belfry, the Lamp-House, the
  Greenhouse, the Footprint).
- **The guardians**: untouched (3-4). The Hush-House's, the Clock-House's, the Undertower's, the Greenhouse's, the
  Lamp-House's and the Belfry's are 3: they ask for the gadget with one verb, and three or more of their tells are drawn
  on the ground.

## The ranked edits (what is left of issue #23)

1. **Play the new rooms by hand**: the thawing jaws' timing (10 s), the Mooring-House's tether range down the cable-rail,
   the cupboard's clue, and the six arenas with real keepers.
2. **Identity 2**: the Undertower and the Lamp-House. For the Undertower, a different second half, for example its
   great key in the first half like the three above. For the Lamp-House, a wing that is not one more `X` after the
   chest.
3. **The last three great keys off the last hall** (the Greenhouse, the Undertower, the Lamp-House): a loop back to the
   first half would vary them, as it now does in three houses.
4. **The guardian exam** (3 in six houses): the guardians ask for the gadget with one verb. A second verb in a phase is
   the "Combat telegraphs" batch's work, in `TODO.md`.

## The pictures

The before/after pictures of every new room are in the interactive changelog (`changelog-media/1.53/`, `src/changelog-media.js`):
`hush-passage`, `hush-balcony`, `hush-ledge`, `hush-mouth`, `hush-nursery`; `moor-gallery`, `moor-store`, `moor-perch`;
`clock-cupboard`, `clock-key`; `whale-storedoor`, `whale-store`, `foundry-sanddoor`, `foundry-sand`,
`footprint-lodgedoor`, `footprint-lodge`.

## Against the last report

The [v1.49 report](temple-design-v1.49.md) ended at 4.21 over fourteen; re-run at this batch's start, with the guardian
moves above, it was 4.19, and it is 4.28 now. Every house has structure 5 and an arena; the means run from 4.0 (the
Lamp-House) to 4.56 (the Warden's Well and the Casting-House).
