# The fragments of the singing light, the scientist and his upgrades (v1.55, issue #196)

Where the singing light passed it shed small splinters of its song. They settled in the out-of-the-way places of every
world on the route: up on ledges and high places, tucked behind things, at the ends of side paths; never on the way
anyone sends you. Eight hide in each of the twelve route worlds, 96 in all.

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
- **Seeing and hearing them.** A pale splinter (an elongated octahedron, glowing) with three motes going round it (the
  light's signature beats in threes), bobbing; a small light of its own on the ground round it (`level.lights`, radius
  ~3 m). Within `FRAGMENT.sing` (26 m) it sings faintly from where it is every `singEvery` (3.4 s): three soft notes of the
  light's theme an octave up (`Sound.fragmentSong`, placed with `Sound.spot`, louder nearer). Muted with the game.
- **Taking one.** Walk within `FRAGMENT.take` (1.5 m): it is yours. The toast: *A fragment of the singing light · 12 of 96 ·
  3 left in Lorn*; the theme's rise (`Sound.fragmentTaken`); `game.emit('fragment', { world, i, found, total, left })`.
- **The save.** `frag.<world>.<i>` for each found; `frag.met` once the scientist is met; `frag.finder.off` when the
  finder is switched off. `src/save-migrate.js` step 22 starts an older save at zero (any `frag.*` goes).
  `fragmentCounts(flags)` gives the count all told and per world (found, total, left).

## The scientist: Orrin Thrum (`src/story/scientist.js`, `scientist-data.js`)

A thin man in a patched pale coat with too many pockets, goggles pushed up on his brow, a tool belt, grey curls. He
studies light, and has been on the lookout for the fragments since the night the light went over.

- **The meeting.** The first fragment you take brings him: he comes up a few steps from you (`meetSpot`: ground near
  yours, room over him, nothing between) and the talk opens at once (or as soon as nothing else has the screen). Four
  lines and one answer: he has been on the lookout for them, who he is, what they are, five and he'll have something;
  then he asks to come aboard (`frag.met`). That figure stays until you are 40 m off or aboard.
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

## Where the count shows

- **The game menu's Worlds page**: over the cards, *Fragments of the singing light: 12 of 96*; on each world's card
  *✧ 3 left* or *✧ all 8* (once the first is found).
- **The Start menu** (Menu / Start): under where you are, *✧ 12 of 96 fragments of the singing light · 3 left here* (`fragmentsLine` in main.js).
- **On the ship**: Orrin's count when you talk to him, and his jar.

## Tests

- `tests/fragments.test.js`: the data and the milestones, the counts, a fragment taken (saved, gone, its light out), its
  song only near, the finder's beeps by distance and its switch, the meeting, his count and his offers in order, the
  upgrades' numbers, the menu, the migration, the people book, his place aboard the real ship and the first meeting.
- `tests/contact-audit.test.js` ("every fragment of the singing light…"): in every world each stands on solid ground that
  is drawn there (the contact audit's drawn surfaces, or the terrain), with room over it, out of harm, eight at least
  15 m apart, and the walker's flood reaches each from the world's spawn.
