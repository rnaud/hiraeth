# The fragments of the singing light, the scientist and his shop (v1.55, issue #196; re-placed v1.61, #228, #229; a currency v1.62, #185; into the places of interest v1.66, #250; three times as many v1.70, #317)

Where the singing light passed it shed small splinters of its song. They settled in the out-of-the-way places of every
world on the route: up on ledges and high places, tucked behind things, at the ends of side paths; never on the way
anyone sends you. Twenty-four hide in each of the twelve route worlds, 288 in all (eight, 96, until v1.70). What they are in the story, and why they
hide: `docs/story-bible.md`, "The fragments of the singing light".

## The fragments (`src/fragments.js`, `src/fragments-data.js`)

- **Where.** `FRAGMENTS` in `src/fragments-data.js`: `FRAGMENTS_PER_WORLD` (24) `[x, y, z]` ground spots a world, in the world's own frame (a
  merged world's parts in its frame). The fragment floats `FRAGMENT.lift` (0.9 m) over its spot.
- **How they were placed.** `node scripts/fragment-spots.mjs [world …]` floods the ground the walker reaches from the
  world's spawn and its parts' spawns (`tests/fragments-reach.js flood`: 2 m cells, a step up at most a double jump high,
  4.8 m, onto ground you can stand on, a fall at most 6 m, deep water swum, the rooms behind doorways left out), keeps the
  spots on solid, drawn ground with room to stand, away from the spawn, the people, the chests, the relics and the
  story's goal, scores each for being out of the way (a drop under it, walls round it, height over the world's middle,
  how far the walk is) and picks eight well apart. The picks were then looked at in the running game, one contact sheet a
  world; the script is a starting point, the data file the source.
- **Re-placed over the new country (v1.61, #228).** The first picks came before six worlds were rebuilt (v1.55–v1.57),
  so none were in their explorations and nine lay within 20 m of the route. The script now also:
  - measures each spot against the **route**: the level design audit's critical path (`scripts/level-design/path.mjs`
    `criticalPath`, shared with `scripts/level-design/audit.mjs`: the landing, the route's quests stage by stage from
    `tests/playthrough-worlds.js`, back to the ship; its straight legs in 3D, `pathSegments`, `distanceToPath`). Nothing
    under `--route` m (30) is picked, and the farther the better (up to 120 m);
  - scores the **new country**: spots near the sights of a world's explorations (`tests/fragments-reach.js
    NEW_COUNTRY`: the sights' names, a radius, height counting half again), their height in full (to 80 m), and picks
    at least `--new` (3) there;
  - keeps slots: `--keep 0,2,6` leaves those spots as they are (a save's found flags point at their indices) and fills
    the others; `--above y` keeps picks out of shallow water; `--list n` prints the n best of the new country to choose
    from by hand (`LIST_ALL=1`: of everywhere);
  - floods at 1 m where the way up is a narrow stair a 2 m grid steps off (`REACH_CELL`: the floating city's stack, the
    broken moon's street), and lets the flood out through a lock or a lift (only a temple's doorway or a room far
    overhead counts as inside), so the Underwater City's seabed and canyon are reached; out in the sea a spot must be
    within 35 m of air (`seaWhyNot`, `AIR_NEAR`: a bell, a café, a lock), where the helmet takes you and back.
  29 of the 96 moved, each in its slot (marked `(v1.61, #228)` in the data, with its place):

  | World | Moved (slots) | In the new country (the test's count) and where | Nearest to the route, before → after |
  |---|---|---|---|
  | Vael | 3 (1, 3, 4) | 3: a slab tipped up at the broken edge, a crack by the sundial, under a slab past the riders' gate | 2.1 → 33.9 m |
  | Lorn | 3 (2, 4, 5) | 2: a canopy deck 70 m up, the egg isle in the drowned wood; and halfway up the keepers' stair, 33 m | 111.5 → 29.7 m |
  | Viridel | 3 (2, 3, 6) | 3: the old pyramid's terraces 36 m up, the round ship's hill, the builders' machine's flank | 32.0 → 45.1 m |
  | The Underwater City | 5 (0, 2, 4, 5, 6) | 3: the far café over the canyon, the canyon bridge, a pod tower's ring down the wall; and two out on the seabed | 2.6 → 34.2 m |
  | The Buried Machine | 1 (0) | (none rebuilt): a ledge by the great pipes | 22.7 → 47.2 m |
  | The Moon Foundry | 4 (1, 3, 4, 5) | 3: the stair street at 37 m, a gantry, one kept by the cracked mould; and a house on the street at 30 m | 13.1 → 34.2 m |
  | The Garden of Spheres | 1 (1) | 1: down in the cracked sphere's crater | 58.1 → 34.0 m |
  | The City Floating in Space | 6 (0, 2, 3, 5, 6, 7) | 2: the stack's top at 79 m, its stair at 50 m; and a rooftop 17 m up (two moved off the way to the anchor #233 re-laid, one off a new detour, the sapling) | 7.3 → 30.1 m |
  | The Signal Market | 3 (0, 1, 5) | 2: the far end of Kip’s skybridge at 25 m, past the screen lanes; and a ledge 8 m over the square | 8.7 → 34.4 m |

  The Desert, the City-Shaft and the Glass Dunes kept theirs (52, 41 and 111 m from the route at the nearest). The
  Market's and the Floating city's new country is mostly the route itself now (the galleries, the old market, the lanes,
  the stack's lower tiers, the catwalk under the Towers): the fragments sit at the ends off it. A moving platform is no
  place for one (a hover-stall's roof the flood once stood on: the contact audit's built world has it elsewhere).
- **The first two, easy (#247).** The author: "in the desert level there should be a quest to find the first
  light fragment. Or make the first few ones easy to find around my ship." The Desert's slots 5 and 6 (they were 609 m
  out in the far south and 252 m out on the western ridge) moved to the open sand round the landing: one 40 m from the
  ramp, ahead and to the right as you step out, the other up the low rise 60 m behind the ship. Both keep #228's rule
  (32 and 42 m off the route's line: the way to Qanat leaves the ramp the other way), so they are there to be found, not
  stepped on. You hear the nearer one sing from the ramp (26 m) as you walk out. And Marrow, at your ship, has one line
  for it (*"Something the light dropped when it passed, I'd say. It sings on the sand forty paces from your ramp. I
  don't pick up things that sing."*: he hedges, as a witness does, in the desert's word, issue #282), asked at the
  ship (his first talk, beside the way to Qanat and the mark, and his hello; issue #279): it starts the errand
  **Something Singing** (`desert.splinter`, `SPLINTER` in `src/story/desert-data.js`), one step whose goal is the
  fragment itself (`frag.desert.5`): taking it ends it, and brings Anselm as the first one always does. Found first, the
  question isn't there. A save that found either old slot keeps its count (the flag stays on its slot, so the new place
  shows as found); nothing to migrate. `tests/desert-story.test.js` ("#247").
- **In and on the places of interest (v1.66, #250).** The author: "Fragments of the singing light should often be within
  points of interest or at the top of structures hard to climb. Like at the top of the big temples in the sphere levels,
  or within the skeletons in the desert level." `tests/fragments-reach.js pointsOfInterest` gathers a world's places
  (`scripts/fragment-spots.mjs` scores them, +10 a spot, `--poi n` picks at least n there, default 4; `--list n --by-poi`
  lists the best three of each place to pick from by hand). A spot is in or on one when it is
  - by a **sight** of the level (`level.sights`, the level design audit's places to stop for): within 12 m, 8 m of its height;
  - up a **beacon** (`level.beacons`): within 8 m of it, in the top two fifths of its height;
  - inside a **named thing's** bounds, its box in the world, top included (`POI_THINGS`, the scene's object names world by
    world: the desert's ribcages, the giants' bones, the crashed hull, the Rose House's walls; Lorn's canopy and stalks;
    the Glass Dunes' glass that holds a stopped minute and its cairns; the Buried Machine's gangway and posts; the
    Floating city's stack) or of one of the level's **big pieces** (`POI_PIECES`: the Garden's pyramids, its lake temple
    and its great spheres' upper halves; the Underwater City's towers of pods, `level.podTowers` and the canyon's; the
    Moon Foundry's moons, the bowl, the pillar moon and the hoist tower; the Signal Market's street towers 4 m up and
    more, `level.streetTowers`);
  - or on a **summit**: the topmost ground there, 15 m and more over the ground 12 and 24 m off in six directions of eight.

  31 moved, each in its slot (marked `(v1.66, #250)` in the data with its place; a slot moved in v1.61 too keeps its
  `#228`), and 56 of the 96 now lie in or on one (22 before):

  | World | Moved (slots) | Onto | In or on a place |
  |---|---|---|---|
  | The Desert | 2 (0, 7) | under the old ribcage's ribs; between the vertebrae of a ribcage in the west dunes | 6 |
  | Vael | 2 (0, 3) | by Ondine's tally on an island's edge; the hour stone toward the riders' gate on the sundial | 5 |
  | Lorn | 1 (3) | among the keepers' stalks | 4 |
  | Viridel | 3 (0, 5, 7) | a cap of the pyramid nursery 16 m up; inside the split meteor; the dish pond | 6 |
  | The Underwater City | 1 (3) | among the whale bones on the canyon's floor, 64 m down | 5 |
  | The City-Shaft | 4 (2, 4, 5, 6) | under the cab-wrights' crane; by the great mirror on the rim's top; by Tobin's telescopes on the rim; in a stall of the balcony market | 4 |
  | The Glass Dunes | 4 (2, 4, 6, 7) | the breaker's cairn 91 m up on the breaking wave; the wave's cairn on the frozen wave's crest; on the glass that holds the carriers; on the glass that holds the moment in the wave | 4 |
  | The Buried Machine | 4 (0, 3, 6, 7) | behind the oil fall at the canyon's foot; a summit of the keepers' way over the machine; the keepers' gangway; on a cap of the Tooth Day posts | 4 |
  | The Moon Foundry | 2 (2, 7) | the bowl's deck among its garden; against the cracked mould | 5 |
  | The Garden of Spheres | 5 (0, 2, 4, 5, 7) | the white hill's pyramid's top by its temple, 55 m up; the empty arcade in the android wood; the terraces round the sphere west of the arch; the ring of stones at the white monolith; the cairn at the yellow sphere's furrow | 5 |
  | The City Floating in Space | 1 (6) | the telescope at the Pier's end | 4 |
  | The Signal Market | 2 (6, 7) | a tower's service balcony over Signal Square; the radio-mender's table in the listeners' lane | 4 |

  Everything else stands: eight a world, #228's rule (25 m and more from the route; the nearest of the new spots 34 m off it), the
  Desert's two easy ones by the ship (#247), the shop and the Lantern's line. One sits nearer a relic than the
  script's 14 m: the white hill's pyramid's top holds the Garden's Pyramid key, and the fragment is on the far corner of
  the platform from it, 12 m off. Places the walker can't reach on foot were
  left: the lone tower in Vael and the rider's roost (the bird's), the Garden's belvedere and the pillar forest's tops
  and its great spheres' crowns (climbed), the meadow's pyramid (Ivo sits on its top), the Foundry's hung moons, its
  cradle moon and the hoist tower's galleries (climbed), the Signal Market's antenna mast and silent tower; the desert's
  jaw and spine and the sunken leviathan lie past the flood's 700 m, and Qanat's skull is on the way to the cave.
  Step 25 of the save (`FRAGMENTS_MOVED_250`) keeps a save's count as step 23 did (below).
- **Three times as many (v1.70, #317).** The author: "There should be many more fragments of light per world to make
  them easier to find. Keep the professor prices the same." 8 → 24 a world, 96 → 288; Anselm's prices stay as they were
  (3 to 30, 96 for all seven: a third of what there is now). Why 24: the ground the walker reaches (the flood's cells)
  is 1.2 to 2.9 km² in the big worlds, so 24 leave about 0.05 to 0.12 km² of ground to each, a square 220 to 350 m
  across: about a minute's walk (3.8 m/s) or half a minute's run (8.2 m/s) to cross, where eight left one every two
  minutes' walk and more. The compact worlds (the Underwater City 0.35 km², the Moon Foundry 0.43, the Floating city's
  islands) come closer (one every 15 to 35 s); nowhere fewer, so a world's count is one number on every card (✧ all 24).
  - **The first eight kept** in their slots and places (a save's flags point at them: no save step; a save from before
    keeps its count and finds sixteen new ones a world). Slots 8–23 are new, marked `(v1.70, #317)` with their place.
  - **Placed** by `node scripts/fragment-spots.mjs <world> --keep all --count 24 --poi 12 --per-poi 2` (`--per-poi 3
    --busy 8 --route 27` for the four poorest in places, `--apart 16` in the Floating city, `--avoid -32.5,-26.5` in the Signal Market: its galleries; `--above -0.5` in Lorn, out of its deeper shallows): the same rules (the walker
    reaches it, he stands on it as written down to the centimetre, drawn ground, out of harm, 25 m off the route, 14 m off
    the people, chests and relics, 8 in the four), at least 25 m apart (16 in the Floating city; the test's floor is 15),
    a place of interest holding two (three) at most, each new pick the best score plus a bonus for its distance from
    those already picked, so they spread over the world. The worlds are built for it before the play-through's gadgets
    are registered, as the tests build them (a spot good in one build was a few centimetres off in the other).
    `WHY_POI=1` prints, place by place, how many of the spots reached in it each rule turned down.
  - **In or on a place of interest**: 149 of the 288 (half and more), every world 12 at least but the four whose places
    off the route run out (Lorn 7: the rest of its sights stand in deep water, and none lies so low in its shallows that the fragment floats under the water, `--above -0.5`; the Buried Machine 9; the Floating city
    11; the Signal Market 8: its galleries are the market in the air's way, kept clear by its own test), `tests/fragments-poi.test.js` `POI_MIN`; and no fragment has more than four others within 40 m of it (six in the Floating city), `tests/fragments.test.js`.

  | World | Ground reached | In or on a place | Nearest other, median (min) | Most within 40 m of one |
  |---|---|---|---|---|
  | The Desert | 1.48 km² | 14 | 137 m (42) | 0 |
  | Vael | 2.92 km² | 14 | 115 m (52) | 0 |
  | Lorn | 2.16 km² | 7 | 235 m (21) | 1 |
  | Viridel | 1.51 km² | 13 | 97 m (26) | 2 |
  | The Underwater City | 0.35 km² | 21 | 44 m (26) | 2 |
  | The City-Shaft | 1.38 km² | 14 | 104 m (45) | 0 |
  | The Glass Dunes | 1.18 km² | 14 | 56 m (25) | 2 |
  | The Buried Machine | 1.54 km² | 9 | 233 m (21) | 2 |
  | The Moon Foundry | 0.43 km² | 12 | 34 m (25) | 4 |
  | The Garden of Spheres | 1.55 km² | 12 | 173 m (28) | 2 |
  | The City Floating in Space | 0.02 km² a layer (230 × 340 m of islands and tiers) | 11 | 21 m (16) | 6 |
  | The Signal Market | 1.45 km² | 8 | 88 m (21) | 3 |

  - **Drawn near only** (`FRAGMENT.drawTo`, 220 m): three times as many would be four draws each for every one in view
    across a world; past 220 m (a few pixels) a fragment is hidden and not turned. Its song and the finder are as before.
- **Seeing and hearing them.** A pale splinter (an elongated octahedron, glowing) with three motes going round it (the
  light's signature beats in threes), bobbing; a small light of its own on the ground round it (`level.lights`, radius
  ~3 m). Within `FRAGMENT.sing` (26 m) it sings faintly from where it is every `singEvery` (3.4 s): three soft notes of the
  light's theme an octave up (`Sound.fragmentSong`, placed with `Sound.spot`, louder nearer). Muted with the game.
- **Taking one.** Walk within `FRAGMENT.take` (1.5 m): it is yours. The toast: *A fragment of the singing light · 12 of 288 ·
  3 left in Lorn*; the theme's rise (`Sound.fragmentTaken`); `game.emit('fragment', { world, i, found, total, left })`.
- **The save.** `frag.<world>.<i>` for each found; `frag.met` once the scientist is met; `frag.finder.off` when the
  finder is switched off. `src/save-migrate.js` step 22 starts an older save at zero (any `frag.*` goes). Step 23
  (v1.61, `FRAGMENTS_MOVED_228`): a save keeps its count world by world; a found flag on a slot that moved goes to an
  unmoved slot still to find, so the new places show (an old spot not yet reached counts instead); where none is free
  it stays. (`tests/fragments.test.js` checks the table against the data's marks.) Step 25 (v1.66, `FRAGMENTS_MOVED_250`,
  `moveFoundOff`): the same for the slots moved into the places of interest, never onto the Desert's slot 5 (Marrow's
  errand's goal: it would end it unasked).
  `fragmentCounts(flags)` gives the count all told and per world (found, total, left): the fragments **found**, which
  never go down. What you **hold** to spend is `fragmentPurse` (src/fragment-shop.js, v1.62): found less the prices of
  the upgrades you have. Nothing new is saved for it, so a save from the milestones keeps its upgrades and holds found
  less their prices, never less than none (10 found with the heart and the finder: 2 held; 96 with all seven: none).

## The scientist: Anselm Thrum (`src/story/scientist.js`, `scientist-data.js`)

A thin man in a patched pale coat with too many pockets, goggles pushed up on his brow, a tool belt, grey curls. He
studies light, and has been on the lookout for the fragments since the night the light went over.

- **The meeting.** The first fragment you take brings him: he comes up a few steps from you (`meetSpot`: ground near
  yours, room over him, nothing between) and the talk opens at once (or as soon as nothing else has the screen). Four
  lines and one answer: "Don't drop it!", he has been on the lookout for them, what he thinks they are (a guess:
  "Bits of its song, I'd say", v1.68, #282; only Ilen says what the light is), five and he'll have
  something (since v1.62: "Bring me more. I'll work them into your gear, at a price."); then he asks to come aboard
  (`frag.met`). Once that talk has opened he is met however it ends (v1.62: B out of it before the last answer used to
  leave him unmet, on the spot, and in no ship after). (Until v1.61 he was Orrin and introduced himself, name and
  trade; the panel names him, and `tests/dialogue-voices.test.js` reads his meeting, `THRUM_MEETING`.) That figure stays until you are 40 m off or aboard.
- **Aboard, always** (v1.62, #185: "I want him to be in my ship at all times after I meet him for the first time").
  From then on he is in the ship's hold, in front of the starboard crate facing the doorway (`ABOARD`, ship-local), in
  every world: `setupScientist` runs in every world's story (src/story/index.js) and boards him on the parked ship
  as the world is set up, so he is there on every arrival and after every scene. While the ship flies (an arrival's
  descent, a take-off: its hull moved off where it is parked, src/ship/cinematics.js) he is out of sight in the shut
  hull (`away`), and back on his spot the moment it is down; before, his figure stood in the air where the hold would
  be. `tests/thrum-aboard.test.js` builds each of the twelve route worlds, home and the Lantern with its ship, the
  save as a debug save has it there and Anselm met, and finds him in the hold, on its deck, inside the rooms, with room
  over his head (the desert's crashed ship too); `tests/fragments.test.js` that he is walked to from the hatch. (The
  homecoming's opening in space plays in the ship's space copy, `ship.spaceCopy`, which has no hold scene: he is in
  the parked ship it lands as.) On the crate beside him is his jar: a glowing splinter for each fragment found (up to 24).
- **E to him aboard** (issue #352, v1.75: "Talking to Anselm in my ship does nothing. I see the prompt but it does
  nothing"). The ship took every press of E aboard (`Ship.input`), so his talk prompt showed in the hold and E went to
  the ship, which had nothing there. E is the ship's now only where it has something to use (`Ship.hasUse`: the
  voicemail button, the holo table, the hatch; held, it stays the ship's as you walk off); in the hold it is yours,
  and his talk opens, his shop with it. The web game and the engines share the ship (engine/game.js filters E
  through `ship.input` too). `tests/ship.test.js` (E in the hold passes through; by the table it opens the map).
- **His talk** is built from the save each time it opens (`thrumTalk`): his count, found and held (*Twelve of 288. Four
  to spend.*), how many still hide in this world, the three worlds with most left; then *Show me what you have* (his
  shop, below) or, asked, where they hide (*Up high. Behind things. At the ends of paths.*). His balloon shows while
  you hold enough for one you can have (`affordable`).
- **The People page** lists him under the Desert (where the ship came down), his story growing with each upgrade.

## His shop: the upgrades for fragments (v1.62, issue #185; `src/fragment-shop.js`, `src/items.js` `fragments`)

The author: "I just want Anselm to sell me upgrades." The fragments are a currency. *Show me what you have* opens his
shop in the keepers' shop panel (src/shop-panel.js, docs/systems/ui.md "The shop": `kind: 'fragments'`): the
fragments you hold as the wallet, his seven upgrades as cards with their price in fragments, A / × asks, A / × again
buys (B / ○ backs out). Bought, the price comes off what you hold (`fragmentPurse`); the found total stays. One you
have says *Fitted*; one whose gear you don't have yet can't be bought and says what it needs in one line (*Needs the
blade first*: the blade, the tank, the wings, the guard: `needs`); one too dear *Not enough fragments*. He says a line
for each (`THRUM_SHOP_LINES`), and one as he fits each upgrade. `FragmentShop` is the panel's logic (`view()`, `buy(id)`,
`game.emit('thrum:bought')`). Until v1.62 he fitted them free at milestones of the count, one a talk (5, 10, 15, 25,
50, 75, 96).

The prices add up to 96, every fragment there was until v1.70 (a third of the 288 since: the prices kept, issue #317),
the cheapest first, so bought in that order each comes no later than its milestone did (the n-th after 3, 8, 15, 25, 43, 66 and 96 found, against 5, 10, 15, 25, 50, 75, 96):

| Price | Item | What changes |
|---|---|---|
| 3 | Fragment finder (`finder`) | beeps as a fragment comes within 60 m, every 1.8 s there down to every 0.14 s on top of it, higher as it nears (`finderInterval`, `finderPitch`, `Sound.finderBeep`); switched off and on from the items page (A / × on it: `toggle`) |
| 5 | Light-stitched heart (`lightheart`) | hearts at the start 3 → 4 (`src/resources.js HEART_ITEMS`; filled at once) |
| 7 | Light-tempered edge (`lightedge`, needs the blade) | every cut of the blade ×1.5 (`BLADE.edge`): the combo 1, 1, 3 → 1.5, 1.5, 4.5 |
| 10 | Light chamber (`lightcell`, needs the tank) | the magic bar +1 unit (3 → 4; with the fourth chamber 4 → 5; `MAGIC_ITEMS`) |
| 18 | Light-veined wings (`lightwing`, needs the wings) | the glide's speed ×1.2 (15 → 18 m/s, 30 → 36 diving), its sink ×0.75 (2.4 → 1.8 m/s; on top of the scarf's) (`LIGHT` in `src/boxes/effects.js`, `player.glideK`) |
| 23 | Light-soled boots (`lightstep`) | running costs ×0.7 the stamina, resting refills ×1.5 (on top of the pearl's and the bellows') |
| 30 | Light-rimmed guard (`lightguard`, needs the guard) | a blocked blow costs 0.5 units of magic instead of 1 (`MAGIC_COST.shield`) |

A debug save (src/debug-save.js) buys them the cheapest first while the worlds before's fragments last, where the gear
is held.

The table values live in `src/trials/upgrades.js FRAGMENT_TUNES` (the blade, the guard), `src/resources.js` (the heart, the
chamber) and `src/boxes/effects.js LIGHT` (the wings, the boots).

## At the Lantern (v1.61, #229)

When Ilen owns up to the light (`src/story/lantern-data.js`, the `light` node), one line answers the fragments by how
many you picked up (`SPLINTERS`: none, some, every one; conditions over `fragmentCounts`): *Nobody stops for them* /
*I can hear them from here, in your hold* / *Then it's whole again.*

## Where the count shows

- **The game menu's Worlds page**: over the cards, *Fragments of the singing light: 12 of 288*; on each world's card
  *✧ 3 left* or *✧ all 24* (once the first is found).
- **The Start menu** (Menu / Start): under where you are, *✧ 12 of 288 fragments of the singing light · 4 to spend · 3 left here* (`fragmentsLine` in main.js; *to spend* once Anselm is met).
- **On the ship**: Anselm's count when you talk to him (found and held), his shop's wallet (held), and his jar (found).

## Tests

- `tests/fragments.test.js`: the data and the prices (288 all told, 24 a world; the prices as they were, 96 for all seven, never later than the milestones), his count read from the total (and in words to thirty), the counts, a
  fragment taken (saved, gone, its light out), its song only near, the finder's beeps by distance and its switch, the
  meeting, his count and his shop (held against found, buying, the gear an upgrade needs, the panel with his lines),
  an old save's upgrades and what it holds, the upgrades' numbers, the menu, the migration, the people book, his place
  aboard the real ship and the first meeting.
- `tests/thrum-aboard.test.js` (v1.62): Anselm aboard in every world once met (above), out of sight while the ship
  flies, met however the first talk ends.
- `tests/contact-audit.test.js` ("every fragment of the singing light…"): in every world each stands on solid ground that
  is drawn there (the contact audit's drawn surfaces, or the terrain), with room over it, out of harm, 24 at least
  15 m apart, and the walker's flood reaches each from the world's spawn (at the world's `REACH_CELL`); in the
  Underwater City under glass or within 35 m of air.
- `tests/route-worlds.test.js` (v1.61): every fragment 25 m or more from the route's line; the six rebuilt worlds
  (Lorn, Viridel, the Underwater City, the Moon Foundry, the Floating city, the Signal Market) two at least in their new
  country, one of them high (15 m over the landing, or a 10 m drop beside it).
- `tests/fragments-poi.test.js` (v1.66, #250; v1.70, #317): in every world 12 of the 24 at least in or on a place of
  interest (`POI_MIN` for the four poorer: Lorn 7, the Buried Machine 9, the Floating city 11, the Signal Market 8), 144
  of the 288 at least (149 now), spread over three places at least in each world; and the named places still found in their worlds (a
  rename would drop them silently).
- `tests/people-names.test.js` (v1.61): one name, one person (the people book and every world's people), and nobody you
  meet named like someone the story only tells of (Odile and Talo, the Orrins).
