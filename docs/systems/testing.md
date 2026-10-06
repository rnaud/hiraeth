# Testing: the unit tests and the play-through

`node --test tests/*.test.js` runs every test (about a thousand, under a minute); `npx vite build`
must pass too. Each world's story has its own test (`tests/story-*.test.js`, `tests/desert-story.test.js`),
which plays that world alone from a new game. The play-through plays them all, one after the other.

## The play-through (`tests/playthrough*.js`, `scripts/playthrough-browser.mjs`)

Why: the worlds' own tests all passed while nothing played the game from start to finish, across a week
of reordering (the route, the opening conversations, the wings before the jets, the cab pass, Vael's bird
behind her call, the boxes silent before the first). It found the bug below on its first run.

**In node** (`tests/playthrough.test.js`, about 40 s). A new game, then the route in its order (desert,
Vael, Vael II, Lorn, Lorn II, Viridel, City-Shaft, Sealed Hangar, Buried Machine, Garden of Spheres,
Signal Market), then home. One game state is carried from world to world, as the save is. Each world is
built as `main.js` builds it, minus the drawing: the level and its temple, real collision, its people, the
story runtime, the boxes, a real `Player`. Between worlds the agent goes aboard: it plays every waiting
message on the voicemail and opens the holo table, whose map must be powered and must chart the next world.
At home the homecoming (`HomecomingDirector`) plays to the stone.

The agent (`tests/playthrough-agent.js`) teleports rather than walks. At every step of a quest it checks:

- there is an objective, and the drone's FIND (`scout.js nextObjective`) points at the same one;
- its person is there: spawned, shown when you are near, talkable; a world's opening quest waits for its
  first talk, and the one who opens it is the first step's person (the desert: Marrow, its hint-giver);
- there is ground to stand on at it, and it can be reached: walkable from the open ground round it (steps
  no higher than a stair, `walkable`), through a doorway, a climb where the world allows climbing, or a
  declared way (`WAYS`: the wind on wings, the boost-jumps, the jets, the bird) whose needs he has now;
  the wind up Vael's tower and the steps to the flute are tried for real, by a `Player` in the physics;
- nothing early: nobody arrives anywhere with the wings before Vael, the jets before the City-Shaft, the
  bird's promise before Vael II, a cab pass before Lio; no fallback box by the ship; a step that names a
  way of getting about ("open your wings", "ride the bird", "the jets", "a cab") comes when he has it;
- what each world must hold (`CHECKS`): the bird hidden and deaf until the flute, then come; the
  spark-stone in the pack; a cab refusing without the pass (and the refusal starting Lio's errand), taking
  you with it; Vael II's bird awake;
- nobody starts a talk by themselves, and no box quest starts before the first box is found.

Then it does what a player would: talks (choosing the answers whose effects move the quest on, read from
the conversation's own data, `converse`), uses what E offers there, walks into a doorway, shoots or pushes
the targets there, waits for what takes time, and where a step is a puzzle runs the world's solver
(`tests/playthrough-worlds.js SOLVERS`). A temple is played to its chest through its own logic
(`templeTo`), each next thing to do stood beside and done. A step that moves nothing twice is a soft-lock.

Every problem is an issue (`world`, `kind`, `text`); the last test fails on any not in `KNOWN` (which
says why each one waits). `PLAYTHROUGH_VERBOSE=1 node --test tests/playthrough.test.js` prints every
step, where it was and how it was reached.

**Old saves** (`tests/playthrough-saves.test.js`). Saves from before the reorder, in the old format,
loaded as a page boots them (`loadSave`: `src/save-migrate.js`, then `migrateSave`; each world's own
migration when its story sets up), then played on: the jets and the City-Shaft done (on to Vael); stuck on
Vael's old "ride her" step, with the jets and without; mid-desert with the water running; two from the
first desert (the channel open: the spark-stone errand skipped; a jar and the Speaker next: back to Nour).
Each must chart the right worlds, need no fallback box, resume at the migrated step, play its world to the
end and chart the next.

**In Chrome** (`node scripts/playthrough-browser.mjs [--port 6101] [--url …] [--out dir]`, about two
minutes). What only the page has, headless and muted (`--mute-audio`, the game's volumes at 0), over the
DevTools protocol, against its own dev server (or `--url`: in CI, `npx vite preview` after the build).
A new game: the title, the prologue skipped by holding Esc, no quest on landing, the drone on Marrow. An
old save from before the save slots and the reorder: Continue resumes it in the City-Shaft (moved into
slot 1); the voicemail plays the waiting message; the holo table opens the map with the new route;
travel asks, the ship takes off, the next page is Vael and the arrival is a landing; the drone finds
Oïa; the bird is nowhere. Save and load: back to the title, Continue, Vael again as it was. Screenshots
go to `--out`; it exits 1 if a check fails.

**What it does not do.** It does not walk between objectives: reachability is local (45 m round each
spot), plus the declared ways. It plays the route's quests, not every side quest, and the temples only as
far as the route needs (the wings, the jets). Its choices in a conversation are a search over the data,
not a player's.

**Found so far** (October 2026): arriving with the last world's errand still under way and tracked, Vael
II, Lorn, Viridel, the Hangar, the Garden and the market had no objective until their first talk:
`quests.tracked()` returned a quest that world doesn't have (fixed; `tests/dialogue.test.js`).
Lou, at home, starts her talk herself when she runs to meet you (`KNOWN`: a design choice).
