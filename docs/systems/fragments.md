# The fragments of the singing light, the scientist and his upgrades (v1.55, issue #196; re-placed v1.60, #228, #229)

Where the singing light passed it shed small splinters of its song. They settled in the out-of-the-way places of every
world on the route: up on ledges and high places, tucked behind things, at the ends of side paths; never on the way
anyone sends you. Eight hide in each of the twelve route worlds, 96 in all. What they are in the story, and why they
hide: `docs/story-bible.md`, "The fragments of the singing light".

## The fragments (`src/fragments.js`, `src/fragments-data.js`)

- **Where.** `FRAGMENTS` in `src/fragments-data.js`: eight `[x, y, z]` ground spots a world, in the world's own frame (a
  merged world's parts in its frame). The fragment floats `FRAGMENT.lift` (0.9 m) over its spot.
- **How they were placed.** `node scripts/fragment-spots.mjs [world …]` floods the ground the walker reaches from the
  world's spawn and its parts' spawns (`tests/fragments-reach.js flood`: 2 m cells, a step up at most a double jump high,
  4.8 m, onto ground you can stand on, a fall at most 6 m, deep water swum, the rooms behind doorways left out), keeps the
  spots on solid, drawn ground with room to stand, away from the spawn, the people, the chests, the relics and the
  story's goal, scores each for being out of the way (a drop under it, walls round it, height over the world's middle,
  how far the walk is) and picks eight well apart. The picks were then looked at in the running game, one contact sheet a
  world; the script is a starting point, the data file the source.
- **Re-placed over the new country (v1.60, #228).** The first picks came before six worlds were rebuilt (v1.55–v1.57),
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
  28 of the 96 moved, each in its slot (marked `(v1.60, #228)` in the data, with its place):

  | World | Moved (slots) | In the new country (the test's count) and where | Nearest to the route, before → after |
  |---|---|---|---|
  | Vael | 3 (1, 3, 4) | 3: a slab tipped up at the broken edge, a crack by the sundial, under a slab past the riders' gate | 2.1 → 33.9 m |
  | Lorn | 3 (2, 4, 5) | 2: a canopy deck 70 m up, the egg isle in the drowned wood; and halfway up the keepers' stair, 33 m | 111.5 → 29.7 m |
  | Viridel | 3 (2, 3, 6) | 3: the old pyramid's terraces 36 m up, the round ship's hill, the builders' machine's flank | 32.0 → 45.1 m |
  | The Underwater City | 5 (0, 2, 4, 5, 6) | 3: the far café over the canyon, the canyon bridge, a pod tower's ring down the wall; and two out on the seabed | 2.6 → 34.2 m |
  | The Buried Machine | 1 (0) | (none rebuilt): a ledge by the great pipes | 22.7 → 47.2 m |
  | The Moon Foundry | 4 (1, 3, 4, 5) | 3: the stair street at 37 m, a gantry, one kept by the cracked mould; and a house on the street at 30 m | 13.1 → 34.2 m |
  | The Garden of Spheres | 1 (1) | 1: down in the cracked sphere's crater | 58.1 → 34.0 m |
  | The City Floating in Space | 5 (0, 2, 3, 6, 7) | 2: the stack's top at 79 m, its stair at 50 m | 7.3 → 34.0 m |
  | The Signal Market | 3 (0, 1, 5) | 2: the far end of Kip’s skybridge at 25 m, past the screen lanes; and a ledge 8 m over the square | 8.7 → 34.4 m |

  The Desert, the City-Shaft and the Glass Dunes kept theirs (52, 41 and 111 m from the route at the nearest). The
  Market's and the Floating city's new country is mostly the route itself now (the galleries, the old market, the lanes,
  the stack's lower tiers, the catwalk under the Towers): the fragments sit at the ends off it. A moving platform is no
  place for one (a hover-stall's roof the flood once stood on: the contact audit's built world has it elsewhere).
- **Seeing and hearing them.** A pale splinter (an elongated octahedron, glowing) with three motes going round it (the
  light's signature beats in threes), bobbing; a small light of its own on the ground round it (`level.lights`, radius
  ~3 m). Within `FRAGMENT.sing` (26 m) it sings faintly from where it is every `singEvery` (3.4 s): three soft notes of the
  light's theme an octave up (`Sound.fragmentSong`, placed with `Sound.spot`, louder nearer). Muted with the game.
- **Taking one.** Walk within `FRAGMENT.take` (1.5 m): it is yours. The toast: *A fragment of the singing light · 12 of 96 ·
  3 left in Lorn*; the theme's rise (`Sound.fragmentTaken`); `game.emit('fragment', { world, i, found, total, left })`.
- **The save.** `frag.<world>.<i>` for each found; `frag.met` once the scientist is met; `frag.finder.off` when the
  finder is switched off. `src/save-migrate.js` step 22 starts an older save at zero (any `frag.*` goes). Step 23
  (v1.60, `FRAGMENTS_MOVED_228`): a save keeps its count world by world; a found flag on a slot that moved goes to an
  unmoved slot still to find, so the new places show (an old spot not yet reached counts instead); where none is free
  it stays. (`tests/fragments.test.js` checks the table against the data's marks.)
  `fragmentCounts(flags)` gives the count all told and per world (found, total, left).

## The scientist: Anselm Thrum (`src/story/scientist.js`, `scientist-data.js`)

A thin man in a patched pale coat with too many pockets, goggles pushed up on his brow, a tool belt, grey curls. He
studies light, and has been on the lookout for the fragments since the night the light went over.

- **The meeting.** The first fragment you take brings him: he comes up a few steps from you (`meetSpot`: ground near
  yours, room over him, nothing between) and the talk opens at once (or as soon as nothing else has the screen). Four
  lines and one answer: "Don't drop it!", he has been on the lookout for them, what they are, five and he'll have
  something; then he asks to come aboard (`frag.met`). (Until v1.60 he was Orrin and introduced himself, name and
  trade; the panel names him, and `tests/dialogue-voices.test.js` reads his meeting, `THRUM_MEETING`.) That figure stays until you are 40 m off or aboard.
- **Aboard.** From then on he is in the ship's hold, in front of the starboard crate facing the doorway (`ABOARD`,
  ship-local; `tests/fragments.test.js` checks he stands on the deck inside the rooms and is walked to from the
  hatch), in every world. On the crate beside him is his jar: a glowing splinter for each fragment found (up to 24).
- **His talk** is built from the save each time it opens (`thrumTalk`): an upgrade waiting, else his count (*Twelve of
  96. Three more and I'll have something for you.*, how many still hide in this world, the three worlds with most left)
  and, asked, where they hide (*Up high. Behind things. At the ends of paths.*). His balloon shows while an upgrade waits.
- **The People page** lists him under the Desert (where the ship came down), his story growing with each upgrade.

## The milestones and the upgrades (`src/items.js` `fragments`)

At each milestone (`MILESTONES`, from the items' `fragments`) he offers to fit one, a line and *Fit it* / *Not now*
(it keeps). One a talk; an upgrade whose gear you don't have yet (the blade, the wings, the guard) waits until you do.

| Count | Item | What changes |
|---|---|---|
| 5 | Light-stitched heart (`lightheart`) | hearts at the start 3 → 4 (`src/resources.js HEART_ITEMS`; filled at once) |
| 10 | Fragment finder (`finder`) | beeps as a fragment comes within 60 m, every 1.8 s there down to every 0.14 s on top of it, higher as it nears (`finderInterval`, `finderPitch`, `Sound.finderBeep`); switched off and on from the items page (A / × on it: `toggle`) |
| 15 | Light-tempered edge (`lightedge`) | every cut of the blade ×1.5 (`BLADE.edge`): the combo 1, 1, 3 → 1.5, 1.5, 4.5 |
| 25 | Light chamber (`lightcell`) | the magic bar +1 unit (3 → 4; with the fourth chamber 4 → 5; `MAGIC_ITEMS`) |
| 50 | Light-veined wings (`lightwing`) | the glide's speed ×1.2 (15 → 18 m/s, 30 → 36 diving), its sink ×0.75 (2.4 → 1.8 m/s; on top of the scarf's) (`LIGHT` in `src/boxes/effects.js`, `player.glideK`) |
| 75 | Light-soled boots (`lightstep`) | running costs ×0.7 the stamina, resting refills ×1.5 (on top of the pearl's and the bellows') |
| 96 | Light-rimmed guard (`lightguard`) | a blocked blow costs 0.5 units of magic instead of 1 (`MAGIC_COST.shield`) |

The table values live in `src/trials/upgrades.js FRAGMENT_TUNES` (the blade, the guard), `src/resources.js` (the heart, the
chamber) and `src/boxes/effects.js LIGHT` (the wings, the boots).

## At the Lantern (v1.60, #229)

When Ilen owns up to the light (`src/story/lantern-data.js`, the `light` node), one line answers the fragments by how
many you picked up (`SPLINTERS`: none, some, every one; conditions over `fragmentCounts`): *Nobody stops for them* /
*I can hear them from here, in your hold* / *Then it's whole again.*

## Where the count shows

- **The game menu's Worlds page**: over the cards, *Fragments of the singing light: 12 of 96*; on each world's card
  *✧ 3 left* or *✧ all 8* (once the first is found).
- **The Start menu** (Menu / Start): under where you are, *✧ 12 of 96 fragments of the singing light · 3 left here* (`fragmentsLine` in main.js).
- **On the ship**: Anselm's count when you talk to him, and his jar.

## Tests

- `tests/fragments.test.js`: the data and the milestones, the counts, a fragment taken (saved, gone, its light out), its
  song only near, the finder's beeps by distance and its switch, the meeting, his count and his offers in order, the
  upgrades' numbers, the menu, the migration, the people book, his place aboard the real ship and the first meeting.
- `tests/contact-audit.test.js` ("every fragment of the singing light…"): in every world each stands on solid ground that
  is drawn there (the contact audit's drawn surfaces, or the terrain), with room over it, out of harm, eight at least
  15 m apart, and the walker's flood reaches each from the world's spawn (at the world's `REACH_CELL`); in the
  Underwater City under glass or within 35 m of air.
- `tests/fragments-route.test.js` (v1.60): every fragment 25 m or more from the route's line; the six rebuilt worlds
  (Lorn, Viridel, the Underwater City, the Moon Foundry, the Floating city, the Signal Market) two at least in their new
  country, one of them high (15 m over the landing, or a 10 m drop beside it).
- `tests/people-names.test.js` (v1.60): one name, one person (the people book and every world's people), and nobody you
  meet named like someone the story only tells of (Odile and Talo, the Orrins).
