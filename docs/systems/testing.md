# Testing: the unit tests and the play-through

`node --test tests/*.test.js` runs every test (about 2400, two minutes on this Mac); `npx vite build`
must pass too. `.githooks/pre-commit` runs the tests a commit's changes reach before every commit that
touches code: `scripts/affected-tests.mjs` follows each test's relative imports (and the files it reads
by a literal path, or names) and keeps those that reach a changed file; a change to `package.json`, the
lock, a test helper or the hook, or more than 40 files, runs them all (`FULL_TESTS=1` too; `npm install`
sets `core.hooksPath`; `SKIP_TESTS=1` or `--no-verify` skips them in an emergency). The whole suite runs on
GitHub, once per push to main (`.github/workflows/tests.yml`), and no deploy starts until it passes ("Once
per push, then the deploys" below). (Until 2026-10-08 the hook ran every test and
GitHub none: with several agents committing at once on this Mac each commit waited 20+ minutes.) Each world's story has its own test (`tests/story-*.test.js`, `tests/desert-story.test.js`),
which plays that world alone from a new game. The play-through plays them all, one after the other.

## Once per push, then the deploys

`tests.yml` (named `Tests`) runs on every push to main, on pull requests and by hand. The four deploys
(deploy.yml for Pages, cloudflare.yml, android.yml, steam-deck.yml) don't run on push: each is triggered
by `workflow_run` of `Tests` (completed, on main), and its first job goes on only when that run succeeded
and was a push to main in this repository (`github.event.workflow_run`: `conclusion`, `event`,
`head_branch`, `head_repository`), so a failed or cancelled suite, a pull request (even a fork's from a
branch named main) or a `Tests` run by hand deploys nothing. Until 2026-10-09 each deploy called
`tests.yml` itself, so every push ran the suite four times (twelve shard jobs).

- **The tested commit.** In a `workflow_run` run `github.sha` / `GITHUB_SHA` is main's newest commit when
  the run started, not the tested one: every checkout names `github.event.workflow_run.head_sha || github.sha`
  (with `fetch-depth: 0` where the build number counts commits, `release-info.mjs build`, which reads
  HEAD), and android.yml and steam-deck.yml set it as `SHA`, the target of a new release.
- **In push order.** Pushes to main run `Tests` one at a time and never cancel one that started (its
  concurrency group), so the runs finish in push order and each deploy's own group (Pages cancels the
  running deploy; the others never cancel and keep the newest waiting) never ships an older commit after
  a newer one. A push whose waiting run was replaced by a newer one is cancelled and deploys nothing: the
  newer one covers it. Only a deploy run that will build takes its group (`<group>-skipped-<run id>`
  otherwise), so a failed suite can't replace a waiting deploy or cancel the running Pages deploy.
- **By hand.** Each deploy keeps `workflow_dispatch`: it builds the chosen ref at once, without waiting
  for the suite (cloudflare.yml only from main). A flaky shard on main: "Re-run failed jobs" on the
  `Tests` run; when it passes, the deploys follow. (Re-running an older push's `Tests` would deploy that
  older commit again.)
- **Xbox, Unity.** xbox.yml keeps its own triggers (its paths, nightly, by hand) and still calls
  `tests.yml` first (`workflow_call`; `github.workflow` in its concurrency group is the caller's name, so
  those calls never queue with the push runs). unity-android.yml builds testers' builds and runs no suite.
- `tests/pre-commit.test.js` checks all of this, evaluating each workflow's `if` and concurrency group
  against the events above.

## The shards

On GitHub the suite runs as three jobs at once (`.github/workflows/tests.yml`, a matrix `shard: [1, 2, 3]`;
the run, and so the deploys, succeed only when all three pass). Each runs `node --test $(node scripts/test-shards.mjs N/3)`:
the script deals the test files out by their times in `tests/shard-timings.json` (file → seconds, committed),
longest first, each to the shard with the least time so far; a file not in the table yet (a new test) goes
round-robin after them, and one in the table that is gone is ignored. Every shard works the plan out alone,
the same way, so together they run every file once (`tests/test-shards.test.js`).

    node scripts/test-shards.mjs --plan 3              each shard's files and expected seconds
    node scripts/test-shards.mjs --update [--jobs 6]   time every file on its own and rewrite the table

Regenerate the table when a file's time changes a lot or many new files came in (the test fails once a fifth
of the files are missing from it). A runner has 4 cores, `node --test` runs about 2.4 files at a time there,
so a shard takes about its seconds / 2.4, or its longest file if that is longer: keep files under a minute.

## Heavy tests

Most of the suite's time is building worlds (about 30%: a level and its collision, 0.1 to 2.5 s each), long
simulations of the traveller, and the play-through. Each test file runs in a process of its own, so a world
can be shared only between the tests of one file. The rules for a test that is slow:

- **Share what is built.** Tests of one file that need the same world, unchanged, take it from
  `tests/built-worlds.js` (`builtWorld(id)`: built once per process, with the three.js warnings its build
  printed); a check of every world goes in the file that already builds them all (the push's rings and the
  build's warnings live in `tests/contact-audit.test.js` for that), not in a file that builds them again. A
  test that plays a world's story, or needs a save's flags set before the build, builds its own.
- **Sample, and say why.** Where a check walks every person, frame or world and the property is the same for
  each of a kind, take one of each kind and write in a comment what it still covers. One simulation can serve
  several checks (`tests/idle-legs.test.js`: one 49 s standing for the legs, the head and talking).
- **No real waits.** The story times some things with `setTimeout`; tick node:test's mock clock
  (`t.mock.timers`) instead of sleeping (`tests/desert-story.test.js`). (The play-through still waits in real
  time: its agent's waits let the story's timers fire, and shortening them soft-locks it.)
- **Raycast through a BVH** (three-mesh-bvh, `indirect: true` so the geometry is left alone) when a test
  casts thousands of rays at drawn meshes: the same hits.
- **Measure** before and after: `node --test --test-reporter=spec tests/x.test.js` prints each test's time.

A bare V8 context (`engine/vm-run.mjs`, the engine bundles' tests) hands the bundle the context's built-ins as
locals: a free name in a context made from an object is looked up through its interceptor on every read, and
that made a world's build 15-20 times slower there than in Node (`tests/pose-exact.test.js` took 75 s, now 15).

## The load's smoke test (`scripts/load-smoke.mjs`)

A guard for loads that hang (the Steam Deck's "mixing the inks…", 53ac1e80: fences the driver never
signalled). It serves the built game (`dist/`, or `--build`) and loads worlds in a headless, muted Chrome on
SwiftShader with a page script that breaks the driver: `fences` (WebGL2 fences never signal) or `noraf`
(`requestAnimationFrame` never fires). Each load must log `load: total` (its first frame) within `--limit`
seconds (default 120), and with the fences broken the GPU pacer must have given up having waited at most 4 s.
No Chrome found (`$CHROME`, the usual paths) is a failure, not a pass. Run it by hand after touching the load
(`main.js`'s stages, `src/load-steps.js`): it is not on GitHub, where it held every release back ~5 minutes
(removed 2026-10-09); `tests/load-awaits.test.js` is the guard that runs there.

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
