# Testing: the unit tests and the play-through

`node --test tests/*.test.js` runs every test (about a thousand, under a minute); `npx vite build`
must pass too. `.githooks/pre-commit` runs the tests a commit's changes reach before every commit that
touches code: `scripts/affected-tests.mjs` follows each test's relative imports (and the files it reads
by a literal path, or names) and keeps those that reach a changed file; a change to `package.json`, the
lock, a test helper or the hook, or more than 40 files, runs them all (`FULL_TESTS=1` too; `npm install`
sets `core.hooksPath`; `SKIP_TESTS=1` or `--no-verify` skips them in an emergency). The whole suite runs on
GitHub (`.github/workflows/tests.yml`, called first by deploy.yml, cloudflare.yml, android.yml and
steam-deck.yml), and no deploy starts until it passes. (Until 2026-10-08 the hook ran every test and
GitHub none: with several agents committing at once on this Mac each commit waited 20+ minutes.) Each world's story has its own test (`tests/story-*.test.js`, `tests/desert-story.test.js`),
which plays that world alone from a new game. The play-through plays them all, one after the other.

## The load's smoke test (`scripts/load-smoke.mjs`)

A guard for loads that hang (the Steam Deck's "mixing the inks…", 53ac1e80: fences the driver never
signalled). It serves the built game (`dist/`, or `--build`) and loads worlds in a headless, muted Chrome on
SwiftShader with a page script that breaks the driver: `fences` (WebGL2 fences never signal) or `noraf`
(`requestAnimationFrame` never fires). Each load must log `load: total` (its first frame) within `--limit`
seconds (default 120), and with the fences broken the GPU pacer must have given up having waited at most 4 s.
No Chrome found (`$CHROME`, the usual paths) is a failure, not a pass. GitHub runs it before every deploy
(`tests.yml`, job `load-smoke`: desert ×2, garage, Lantern, about 3 minutes of loads plus the build).

    node scripts/load-smoke.mjs [--build] [--port 6201] [--limit 120] [--runs desert:fences,garage:noraf] [--verbose]

`tests/load-awaits.test.js` checks the same statically: every `await` of `main.js`'s load is one known to end.

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
At home the first homecoming (`HomecomingDirector`) plays to the stone and the light over the hill; then the
ship's log sends him to the Lantern (the map must chart it), where the agent plays the meeting with Ilen, and
home again the true ending plays to the credits (`ending.final`). `tests/finale.test.js` has the rules and the
old-save migration.

The agent (`tests/playthrough-agent.js`) teleports rather than walks. At every step of a quest it checks:

- there is an objective, and the drone's FIND (`scout.js nextObjective`) points at the same one;
- its person is there: spawned, shown when you are near, talkable; a world's opening quest waits for its
  first talk, and the one who opens it is the first step's person (the desert: Marrow, its hint-giver);
- there is ground to stand on at it, and it can be reached: a walk over the ground from where he stands
  (`walkTo`: 2 m steps, up no more than a hop, down no more than a safe drop, through the doorways,
  floors over floors told apart), the last of it a climb where the world allows climbing, or a declared
  way (`WAYS`: the wind on wings, the boost-jumps, the jets, the bird) whose needs he has now. The one who
  opens a world's quest must be reached so from the ship. The wind up Vael's tower and the steps to the
  flute are tried for real, by a `Player` in the physics. The City-Shaft's first find (Nima, 50 m under
  the rim) is a walk from the ship, down the red stair (`tests/incal-stair.test.js` walks it with a real
  `Player`, down and back up, and glides it too);
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

**In Chrome** (`node scripts/playthrough-browser.mjs [--port 6101] [--url …] [--out dir]`, about one
minute). What only the page has, headless and muted (`--mute-audio`, the game's volumes at 0), over the
DevTools protocol, against its own dev server (or `--url`: in CI, `npx vite preview` after the build).
A new game: the title, the prologue skipped by holding Esc, no quest on landing, the drone on Marrow. An
old save from before the save slots and the reorder: Continue resumes it in the City-Shaft (moved into
slot 1); the voicemail plays the waiting message; the holo table opens the map with the new route;
travel asks, the ship takes off, the next page is Vael and the arrival is a landing; the drone finds
Oïa; the bird is nowhere. Save and load: back to the title, Continue, Vael again as it was. Screenshots
go to `--out`; it exits 1 if a check fails.

**What it does not do.** It teleports between objectives once it has found a walk (or a declared way),
so it does not run the traveller's own movement except where a way is tried for real; the Hangar's
turned gravity is not walked. It plays the route's quests, not every side quest, and the temples only as
far as the route needs (the wings, the jets). Its choices in a conversation are a search over the data,
not a player's.

**Found so far** (October 2026): arriving with the last world's errand still under way and tracked, Vael
II, Lorn, Viridel, the Hangar, the Garden and the market had no objective until their first talk:
`quests.tracked()` returned a quest that world doesn't have (fixed; `tests/dialogue.test.js`).
Lou, at home, starts her talk herself when she runs to meet you (`KNOWN`: intentional, the author's decision). The
City-Shaft's first find was only reachable on wings or by climbing: the red stair now leads down to it.
