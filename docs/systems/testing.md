# Testing: the unit tests and the play-through

`node --test --test-concurrency=2 tests/*.test.js` runs the complete gameplay suite;
`npx vite build` must pass too. Normal commits use `.githooks/pre-commit` and the same
`scripts/affected-tests.mjs` dependency selector as GitHub. `FULL_TESTS=1` requests the full suite.
Never disable hooks or bypass a failed test to ship.

## Affected tests locally and on GitHub

The selector follows executable imports transitively, distinguishes source/data reads from execution,
and includes referenced assets. It compares both the old and new dependency graphs so removing an
import, deleting a file or renaming it cannot hide affected tests. Opaque loaders or unproved ownership
expand coverage conservatively; package/lockfile, test infrastructure and workflow changes require
full coverage. A daily full run is a backstop, not a reason to ignore an uncertain dependency.
A shared registry importing every world can still select much of the suite. Smaller selections need
real isolation of those modules/tests, not a smaller arbitrary path filter.

Locally the range is HEAD to the staged index, including deletions and both rename paths. The hook
retains Git’s repository/index environment for selection, then removes inherited `GIT_*` variables
from the test runner. Disposable Git fixtures must also sanitize their subprocess environments so
`git init`, configuration writes, and fixture commits cannot touch the repository being committed.

CI uses:

- Push: the complete range since a proven successful main test run, also covering the event's before
  commit. Canceled or failed intermediate pushes are included. Missing baseline/API evidence runs full.
- Pull request: merge base through the checked-out merge result.
- Manual feature branch: merge base with main through the selected commit. Manual main, explicit
  `full=true`, and the daily run execute the full gameplay suite.

`scripts/ci-test-plan.mjs` records exact head/base, baseline evidence and selected files in the
`test-selection` artifact. All five `unit (shard N/5)` checks must pass. Empty shards explicitly
succeed without invoking Node's automatic test discovery. Invalid selections or source refs fail visibly.

## Fewer and faster tests per commit (October 2026)

The author: "We are testing too much and tests are too long on each commit." What was measured,
what changed and what it bought; the selection stays sound (nothing below marks a test independent
of code it runs, and no test was removed or weakened).

### Long end-to-end files on push

The hook leaves the files in `tests/hook-deferred.json` to GitHub, which runs every selected file,
those included, for each push before any deploy, and to the daily full suite. `RUN_DEFERRED=1`
(or `FULL_TESTS=1`) runs them in the hook; a missing or malformed list defers nothing, and the hook
names what it left. The list holds only files over 100 s on a runner (`tests/shard-timings.json`)
that play or sweep whole houses, worlds or the engines' game: door-bypass-1/2, wings-reach-1/2,
sequences-opening/-moments/-play, engine-finishable, playthrough, temple-playthrough,
temple-trial-flow, temple-finale, guardian-twists, guardian-completable, camera-qc-guardians,
contact-audit, ball-room and zfight (2,525 of the suite's 8,489 runner seconds). Left in the hook on
purpose: `motion-qc` (the traveller's own check, not a world sweep) and `desert-spark` (one errand).
`tests/hook-deferred.test.js` holds the list to that bar and checks that the CI plan, the shard runner
and the workflows never read it; `tests/pre-commit.test.js` runs the real hook in a fixture repository.
The risk taken: a commit that breaks one of these is caught on its push (before it can deploy), not
at the commit.

**The bar lowered to 60 s (round 2, item 4: a commit of its own, for the author to keep or drop).**
The list now holds every file over 60 runner seconds, 38 files: the 18 above, and motion-qc,
desert-spark, engine-trials, temples, guardian-reach, boots-reach, wings-reach-3, takeoff-nan,
key-chests, playthrough-saves, traveller-b3, sequences-play-outdoors, temple-climb, plant-ground,
engine-ship, engine-sound, arrival-view, map-chest-saves, engine-combat and serendipity-map. Those are
also the files a gameplay commit selects most (the engines' game for 92 of the last 100 commits on
main), so the hook stops checking the engines' whole game at the commit: a break there is caught on
the push, before any deploy, or by the daily suite. Measured over the same 30 commits as below, the
hook runs 453 / 516 / 940 files a commit (mean / median / max) instead of 467 / 534 / 960, and
3,371 / 4,131 / 5,049 runner seconds instead of 4,492 / 5,527 / 6,661 (see "Measured, round 2"). The
hook's own comment still says 100 s: an edit to `.githooks/` selects the whole suite.
Dropping the commit puts the bar back at 100 s.

### The selector's syntax cache

Parsing every source took ~20 s a run on a loaded Mac. The command line now keeps the parser's output
in `.cache/affected-tests/` (git-ignored): each entry is `dependenciesOf` for one exact path, mode and
source bytes (the key hashes all three), in a file named by a hash of the analyzer's own bytes, the
bindings module, the parser's entry and package and Node's version. Contracts, ownership and the closure
are recomputed from each snapshot every run; a corrupt, malformed or foreign file is a cold start;
`AFFECTED_TESTS_CACHE=0` turns it off. A warm run takes ~2 s; a cold one ~12 s (the AST child walk is a
plain loop now, the same nodes in the same order). `dependenciesOf`'s output was byte-identical to the
previous analyzer's for all 2,451 tracked sources in both modes, and CLI selections with the cache off,
cold and warm were identical (`tests/affected-tests.test.js` has the cache's own case).
The four selector tests that analyse the real repository on every commit (test-selection-boundaries,
test-loader-contract, audio-test-runtime, pre-commit's real-repository case) read the same store
(`repositorySyntax()`, read-only): the hook has just analysed the same bytes, so they took 15 s instead
of 68 s here. CI has no cache and runs them cold, as before.

Positional mode (`node scripts/affected-tests.mjs <file>`, for sizing a change) now passes the
working tree's inventory and treats a tracked regular file with an unchanged executable bit as an
edit, exactly as the hook's staged range does. Before, it left executable globs unresolved and counted
existence queries, reporting e.g. 466 tests for `src/changelog-media.js` where the hook selects 144.

### Narrower inputs

- `src/version.js` is a literal written by `node scripts/changelog-md.mjs` with `changelog.md`
  (`tests/changelog.test.js` fails if it differs from the newest entry). The title, settings, update
  panel and world picker no longer have the 1 MB changelog in their graph. Changelog text still reaches
  every whole-game test, genuinely: `engine/menus.js` renders the newest versions' lines in the native
  What's new, and `engine/game.js` (and Unity's game) import it.
- `tests/locomotion-botw.test.js` imports `scripts/motion-qc/feel-core.mjs`; `feel.mjs` keeps the
  command, its TUNE imports (environment-chosen, so opaque) and the table, and re-exports the core.
- Boundary cases in `tests/test-selection-boundaries.test.js` for both (a virtual-consumer helper,
  `reach(path, module)`, checks any module): unrelated edits excluded, the real inputs kept.

### Round 2: the compiled game kept, Node's compile cache, catalogues, workflows

- **The compiled game between processes.** Each whole-game test file (43 files, 51 compile calls)
  compiled `engine/game.js` with rolldown again: ~3.1 s a call here (0.54 s when measured again
  for item 2 below). `engine/game-test-runtime.mjs` keeps
  the bundle in `.cache/game-bundles/` (git-ignored) and uses it only while everything its compile read
  is as it was: the compiler and `package-lock.json` (the key), every module rolldown put in the
  bundle byte for byte (from the build's own module list), the names of every file under `src/` and
  `engine/` (a new file a glob would take in), and the kept bytes against their hash; otherwise it
  compiles afresh (`GAME_BUNDLE_CACHE=0` turns it off). A kept bundle loads in ~0.3-0.4 s. The loader
  contract's fingerprints were updated by hand after review; `tests/bounded-engine-runtime.test.js`
  checks a kept bundle equals a fresh compile and is refused after an edit, a new file, tampering or an
  unreadable module.
- **Node's compile cache.** The hook sets `NODE_COMPILE_CACHE` to `.cache/node-compile` for its test
  processes (V8 checks every entry against its source). Six cheap files took 7.1 CPU seconds without
  it and 3.2 with it warm; cheap files are most of a commit's count.
- **Literal catalogues for source scans.** `node scripts/test-catalogs.mjs` writes `tests/catalogs/*.js`
  (src/story, src/temples, src/levels, src/gadgets, src/** and engine/**, each file a literal import
  or read); `tests/test-catalogs.test.js` lists each directory by its literal path and fails when a
  catalogue isn't exactly what `scripts/test-catalogs-core.mjs` renders, so a new file can't be missed
  (run the command after adding, removing or renaming a file there). 30 tests that listed a directory
  now read a catalogue (`tests/src-tree.js` for whole-src scans) and run when those directories change:
  the always-run set (tests selected for five unrelated probe edits) went from 143 files (238 runner
  seconds) to 113 (214).
- **Data-named reads.** A helper called only with literals is followed (`parse('ual.glb')`, not
  `['ual.glb', ...].map(parse)`); a file named by a data table is read through a catalogue. Four more
  catalogues: `src/fight-temples` (imports), the Unity shaders (text), `public/sfx` and `references/audio`
  (`kind: 'bytes'`, the file as it is); `tests/game-text.js` reads `src/`, `engine/` or `index.html` by a
  table's path and refuses any other. 18 more files left the always-run set (113 to 95 for a doc edit):
  the five clip readers (mocap, monsters, mummers, monster-shapes, prowler-warlord), makehuman, route,
  webaudio, unity-gat, unity-pretransform, fight-temple-harm, hud-look, sound-qc, shade, unity-decals,
  sfx, selected-world-audio and next-action-audio (`test-selection-boundaries`: unrelated edits
  excluded, each real input kept, a new file in each new directory selects the catalogue check).
- **Deploy-only workflows.** A workflow edit selects everything only when the workflow runs the unit
  suite (Tests, the daily run, one that calls Tests, runs `node --test`, the selector, the plan, the
  shard runner or the hook); otherwise its readers are selected, and an unread or unreadable one still
  selects everything. Today android, deploy, steam-deck, unity-android and unity-xbox are deploy-only;
  tests, nightly-tests, xbox (calls Tests) and cloudflare (runs `node --test`) are not.
- **Not done:** the remaining always-run files (95 for a doc edit) spawn processes, compile bundles,
  use vm or `new Function`, or read through the release and packaging scripts (`release-info`,
  `traveller-v2-ship`, `engine-bundle-core`, `web-update`: 19, 17, 14 and 9 files behind each), which
  read files named by their callers or by JSON; a few read manifest-named files from `data/` (the
  traveller-v2 GLB readers). Narrowing those needs bounded contracts like the game loader's, not done.

### The slowest files the hook still runs most (round 2, item 2)

Ranked by runner seconds times how often the last 100 commits on main selected them: the engines'
whole-game files lead (engine-trials, takeoff-nan, sequences-play-outdoors, engine-ship, engine-sound,
engine-combat: 92 of 100 commits each, `engine/game.js` reaching every module), then the web sweeps
(desert-spark, temples, guardian-reach, boots-reach, wings-reach-3: about 64 of 100). Timed here on
2026-10-29 (two at a time, load 7 to 8), the top 25 took 871 s against 1,749 in the table: on the Mac the
whole-game files take 0.3 to 0.5 of their runner seconds, sequences-play-outdoors, route-spawn and
sequences-fights about 1.0 (key-chests' 77 s in the table is 8 s now: the table is stale for some files).

Where their time goes (CPU profiles of engine-ship, takeoff-nan, sequences-play-outdoors and
route-spawn): the traveller's cloth (`simulate`, `src/characters/tripo-cloth-sim.js`) is the largest
single cost, 26 % of engine-ship, 13 % of sequences-play-outdoors, 9 % of a take-off; then the physics
bake (three-mesh-bvh's tree, 0.7 s a world), the world builders (the desert 3.4 s, spread over its
relief, drifts, city and temple layouts) and the frame's matrices and raycasts. None of it is the
tests' own waste: they build the worlds and play the frames they check. Not changed: a faster cloth
means changing the game's own solver (its results, and the Unity build that runs the same code);
sharing a built world between files is not possible across processes; and `runSequence`'s 5 ms yields
(about 5 % of a sequence file) keep the VM's timers landing as the recorded web streams expect.
Measured too: the kept game bundle saves less than its commit said here (rolldown compiled
`engine/game.js` in 0.54 s cold and 0.11 s kept, against ~3.1 s then); ten whole-game files took 98 and
104 s with both caches off, 106 and 107 s on, within the noise of a shared machine.

### What was not narrowed, and why

The hubs (`src/enemies/archetypes.js` 596 files, `src/player.js` 581, `src/foes.js` 543) reach their
tests genuinely: every world spawns foes, `src/npc.js` builds its people with the traveller's
`buildCharacter`, the story imports `CAPSULE`, and every whole-game test compiles `engine/game.js`.
Every selected file over 15 runner seconds was checked by its shortest chain; none was incidental. The
cheap files that ran for every change (144 after round 1, 95 after round 2) are opaque: they spawn
processes, compile bundles, or read through the release scripts; round 2's catalogues and literal
calls took the directory-listing and data-named ones out.

### Measured, before and after

Method: the last 30 first-parent commits on main up to 01d743e06 (2026-10-29). For each, the paths it
changed were selected against one fixed tree, with the hook's file inventory and an edit's semantics:
the tree before this work (01d743e06) and after it (this branch), so the two columns differ only by
the changes above. (`--base <parent> --head <commit>` on those commits reads their own old trees, so it
cannot show a change made later.) Time is the sum of the selected files' runner seconds in
`tests/shard-timings.json`: workload, not wall time; on the Mac a file takes about 1/1.9 of that, two at
a time.

| per commit (30 commits) | files: mean / median / max | runner seconds: mean / median / max |
|---|---|---|
| before | 482 / 608 / 972 | 5,657 / 7,712 / 8,489 |
| after, selected (what GitHub runs) | 478 / 604 / 973 | 5,635 / 7,694 / 8,489 |
| after, run by the hook | 465 / 586 / 955 | 3,863 / 5,169 / 5,964 |

On top of that, each commit's selector run went from ~19 s to ~2 s, and the four selector tests above
from 68 s to 15 s on the Mac. Estimated hook time for the median commit, two files at a time on the
Mac: ~34 min before, ~23 min after.

One changed file each, hook-mode selection (positional mode now gives the same numbers):

| changed file | before: files / runner s | after, selected: files / runner s | after, run by the hook |
|---|---|---|---|
| src/enemies/archetypes.js | 597 / 7,823 | 596 / 7,807 | 578 / 5,282 |
| src/player.js | 581 / 7,978 | 581 / 7,978 | 563 / 5,453 |
| src/foes.js | 544 / 7,619 | 543 / 7,603 | 525 / 5,078 |
| src/changelog.js | 222 / 2,485 | 206 / 2,365 | 202 / 1,751 |
| src/ship/ship.js | 227 / 3,051 | 226 / 3,035 | 219 / 2,069 |
| src/changelog-media.js | 145 / 254 | 144 / 238 | 144 / 238 |

The earlier positional counts (602, 588, 550, 480, 469, 466) were inflated by that mode, not the hook's.

### Measured, round 2

The same method and the same 30 commits (up to 01d743e06), against three fixed trees: before both
rounds (01d743e06), after round 1 (677d67ee8, main when round 2 was rebased) and after round 2 (this
branch's 80bb80232), all with today's `tests/shard-timings.json` (files it lacks count as its mean, so
these differ from the table above). Each tree was extracted whole and its own `affectedTests` called
with its inventory and the commit's paths, as the hook calls it.

| per commit (30 commits) | files: mean / median / max | runner s: mean / median / max | run by the hook: files | run by the hook: runner s |
|---|---|---|---|---|
| before both rounds | 497 / 563 / 972 | 6,382 / 8,027 / 9,129 | 497 / 563 / 972 | 6,382 / 8,027 / 9,129 |
| after round 1 | 496 / 562 / 977 | 6,393 / 8,057 / 9,176 | 483 / 544 / 959 | 4,514 / 5,533 / 6,651 |
| after round 2 | 480 / 552 / 978 | 6,371 / 8,052 / 9,185 | 467 / 534 / 960 | 4,492 / 5,527 / 6,661 |

A gameplay commit still selects 500-odd files: round 2 changes the count of the cheap commits, not
the hubs'. The hook's set for one unrelated edit, before both rounds / after round 1 / after round 2:

| edited | files |
|---|---|
| docs/README.md | 144 / 143 / 95 |
| src/changelog-media.js | 145 / 144 / 113 |
| scripts/playthrough-browser.mjs | 151 / 150 / 102 |
| src/hud.js | 149 / 148 / 118 |
| public/manifest.webmanifest | 196 / 192 / 144 |

Wall time here, two at a time, for a doc edit's set (load 6 to 14, so ±15 s): round 1's 143 files
without the caches 71 and 83 s; round 2's 95 files with them 58 and 71 s (84 s without them).
`tests/sword-sheath-seat.test.js` (untouched here) failed in two of those four runs, once each way:
"salt-pilgrim: the dodge roll: -2.6 cm (into him)", a flaky check under load.

## Automatic web, separately built installers

`tests.yml` (`Tests`) runs on pushes to main, pull requests and manual requests. Only `deploy.yml`
(Pages) and `cloudflare.yml` automatically listen for successful same-repository main **push** Tests
runs. PR, nightly, reusable and manual test runs never trigger automatic deployment. Each web deploy
checks out the tested SHA, not whichever main commit happens to be latest when it starts. Manual web
deployments also require the chosen commit's push test gate.

Native installers do not build on each push. Android, Steam Deck and Xbox workflows are manual;
Unity Android/Linux additionally has a daily changed-input check. That check compares relevant inputs
against the last fully successful native build, so failed or skipped builds do not conceal pending work.
Unity publication still requires the exact source commit's test gate. Compatible game content continues
through the web deployment's OTA bundles; native compatibility guards remain in place.

Push tests and Cloudflare releases remain serialized; a replaced pending run deploys nothing and the
next selection includes its unverified changes. Tests for selection, events and publication live in
`tests/ci-test-plan.test.js`, `tests/pre-commit.test.js`, and `tests/release-workflows.test.js`.

## The shards

On GitHub the suite runs as five jobs at once (`.github/workflows/tests.yml`, a matrix `shard: [1, 2, 3, 4, 5]`;
the run, and so the deploys, succeed only when all five pass). Each runs its explicitly selected list through `scripts/run-test-shard.mjs`:
the script deals the test files out by their times in `tests/shard-timings.json` (file → the seconds a GitHub
runner takes over it, committed), longest first, each to the shard with the least time so far; a file not in the
table yet (a new test) counts as the table's mean file (about 10 s), and one in the table that is gone is ignored.
The fifth shard restores headroom after the growing full-suite plan exceeded the unchanged 12-minute budget.
Every shard works the plan out alone, the same way, so together they run every file once (`tests/test-shards.test.js`).

    node scripts/test-shards.mjs --plan 5                 each shard's files, seconds and minutes
    node scripts/test-shards.mjs --ci <run id> [<id>...]  each file's time from green runs of Tests: the update
    node scripts/test-shards.mjs --update --missing       the fallback: time here the files the table lacks

Beside spec, every shard runs a reporter of its own (`scripts/test-file-times.mjs`): at its end it prints one line,
`test-file-times {...}`, each file's time from its process's start to its end, which `--ci` reads back from the
run's log (`gh run view --log`; several runs: the mean). It also leaves a warning on the run's page for a file over
240 s (split it) and for one over 60 s the table lacks (update the table). Update the table after a batch of new
tests, from a green run of main or two. `--update` times the files on this Mac instead (`--jobs 2`, while `uptime`
stays under 25), times 1.9: a runner's seconds for a file here.

A runner has 4 cores and `node --test` runs 3 files at once there, so a shard takes about its seconds / 3. The
runners vary: on 2026-10-17 two green runs of the same suite took 0.8 and 1.2 times the table (a fast and a slow
runner), so the jobs' time differs by half from run to run. `tests/test-shards.test.js` holds the plan to 12
minutes a shard (15 on a slow runner, with the job's half minute of setup, under the 20-minute timeout) and no
file in the table over 240 s: a file that long holds its shard's tail alone; deal its tests out over files
(`tests/wings-reach.js`, `tests/door-bypass.js`: `-1`, `-2`... test files of a few lines each). When the plan
passes 12 minutes, add a shard (the matrix in `tests.yml` and `SHARDS` in the script) or lighten the heaviest files.

Why the three shards ran 8 to 15 minutes in October 2026 when the plan said 5.5 (#445): the table was in the Mac's
seconds, timed one file alone; on a runner, three at once, a file takes about 1.9 times that (each file's process
also takes 1.4 to 1.8 s to start), and a slow runner 1.2 times more again. And 96 of the 691 files were not in
the table (2,350 runner seconds, a third of the suite, dealt round-robin with no weight). The "2.4 files at once"
was about right (2.3 to 2.9 measured from the logs). The table was then rebuilt from the logs of two green runs
(the tests' durations in the spec output, by file, plus each process's start), the 340 s door-bypass test split in
two, and a fourth shard added: 9.5 minutes each planned (8 on a fast runner, 11.5 on a slow one), against 12.7
for three.

## Nightly (`tests/nightly/`)

At 04:17 UTC daily, `.github/workflows/nightly-tests.yml` calls `tests.yml` with `full=true`
for all top-level gameplay tests and separately runs `node --test tests/nightly/*.test.js` for
slower developer-tool tests plus the Python installer/updater suite (`tests/test_*.py`). It can also be dispatched manually. Neither job publishes a release.
The gameplay hook/shards exclude the nightly tool folder; the nightly workflow covers both suites.
There now: the art-reference gallery (`tests/nightly/references.test.js`, every reference world built).
A tool check that builds every world on ordinary pushes samples instead (`tests/world-debug-worlds.test.js`:
two worlds, `WORLD_DEBUG_ALL=1` for all).

## Heavy tests

Most of the suite's time is building worlds (about 30%: a level and its collision, 0.1 to 2.5 s each), long
simulations of the traveller, and the play-through. Each test file runs in a process of its own, so a world
can be shared only between the tests of one file. The rules for a test that is slow:

- **Share what is built.** Tests of one file that need the same world, unchanged, take it from
  `tests/built-worlds.js` (`builtWorld(id)`: built once per process, with the three.js warnings its build
  printed); a check of every world goes in the file that already builds them all (the push's rings and the
  build's warnings live in `tests/contact-audit.test.js` for that), not in a file that builds them again. A
  test that plays a world's story, or needs a save's flags set before the build, builds its own. The same goes for
  the play-through's worlds (`tests/playthrough-agent.js` loadWorld): the shops' walk and the fragments' route
  check share one load of each route world in `tests/route-worlds.test.js` (65 s -> 31 s for the two). There each
  world is measured and walked before the next one loads, because loadWorld resets the game's registries
  (interactables, targets, listeners). The places of interest stay on the gadget-less `builtWorld`
  (`tests/fragments-poi.test.js`): the play-through's gadgets change a world's beacons.
- **Sample, and say why.** Where a check walks every person, frame or world and the property is the same for
  each of a kind, take one of each kind and write in a comment what it still covers. One simulation can serve
  several checks (`tests/idle-legs.test.js`: one 49 s standing for the legs, the head and talking).
- **No real waits.** The story times some things with `setTimeout`; tick node:test's mock clock
  (`t.mock.timers`) instead of sleeping (`tests/desert-story.test.js`). (The play-through still waits in real
  time: its agent's waits let the story's timers fire, and shortening them soft-locks it.)
- **Raycast through a BVH** (three-mesh-bvh, `indirect: true` so the geometry is left alone) when a test
  casts thousands of rays at drawn meshes: the same hits.
- **An audit samples in the suite, densely by hand.** A check of all content at a fine step (the B3 body's 209
  clips: `tests/traveller-b3.test.js`, 9 phases a clip, `B3_AUDIT_FULL=1` for 33 and its report) keeps a margin
  under its bound at the coarse step and writes its report only when asked.
- **Rays a cheaper test can answer, answered first.** The z-fight finder (`scripts/zfight/lib.mjs` visibleSites) makes
  its ray-free checks before any ray, and `audit.mjs` rayOver answers straight-up and -down misses from a grid of the
  triangles' boxes before the BVH (`tests/zfight.test.js` 75 -> 50 s, the same sites byte for byte). A check of every
  temple that needs no story goes where every temple is built already (`tests/temples.test.js`: the chests' floors,
  moved from `tests/key-chests.test.js`, 24 -> 1.6 s).
- **Search toward what you look for.** A reachability check with targets goes to the nearest one first and floods
  wave by wave only when one is left, for the same verdict (`tests/fragments-reach.js` flood: 155 s -> 14 s).
- **Don't run it twice.** Read what a later test needs while an earlier one has the world built
  (`tests/temple-climb.test.js` climbWhy, `tests/ball-room.test.js` measured).
- **An A/B check of a refactor goes when the refactor has shipped.** Keeping the old code behind a flag to compare
  against costs every run and keeps dead code alive (the `__POSE_EXACT__` / `__POSE_WALKS__` lockstep tests, 95 s on
  CI, went: the matrix cache's own check against three, `tests/pose-exact-web.test.js`, stays).
- **Measure** before and after: `node --test --test-reporter=spec tests/x.test.js` prints each test's time.

A bare V8 context (`engine/vm-run.mjs`, the engine bundles' tests) hands the bundle the context's built-ins as
locals: a free name in a context made from an object is looked up through its interceptor on every read, and
that made a world's build 15-20 times slower there than in Node (the old `tests/pose-exact.test.js` took 75 s, then 15).

## TODO.md against the closed issues (`tests/todo-done.test.js`)

TODO.md is open work only: an item whose GitHub issue closed moves to DONE.md, ticked, with how it closed. The tests
run offline, so the closed issues' numbers live in `tests/closed-issues.json`; `node scripts/closed-issues.mjs`
rewrites it from `gh` and names any open TODO.md item that links one (`--check` only names them). Run it when issues
close; the test then fails until those items move (issue #175).

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

**In node** (`tests/playthrough.test.js`, about a minute). A new game, then the route in its order (desert,
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
slot 1), the jets gone for the Warden's bellows; the voicemail plays the waiting message; the holo table
opens the map with the new route; travel asks, the ship takes off, the chime-pirates meet it (their page
opens; the pass marks the fight won, as winning it does, and flies on), the next page is Vael and the arrival
is a landing; the drone finds Oïa; the bird is nowhere. Save and load: back to the title, Continue, Vael again
as it was. **The ending** (v1.47, issue #104): the debug save of the Signal Market (`?level=bazaar&debugsave=1`),
the market and the first homecoming marked done, the flight to the Lantern: the sand bar, Ilen indoors, the
island, the light's song answered with V by each lamp, Ilen out on the step; her talk's end (`finale.met`, set as
the talk's last node sets it), the flight home: the true ending (`HomecomingDirector`, final), a line of the
stone's own in the subtitles and Ilen's among them, the end card, the credits with the Lantern in them, and no
page error (`Runtime.exceptionThrown`) on the way. Screenshots go to `--out`; it exits 1 if a check fails.
It passed 40 of 40 on October 11, 2026 (the desert's opening still finds Marrow by the ship).

**What it does not do.** It teleports between objectives once it has found a walk (or a declared way),
so it does not run the traveller's own movement except where a way is tried for real; the Hangar's
turned gravity is not walked. It plays the route's quests, not every side quest. Every temple is played to its
guardian (since issue #670: the route's own, then the rest of the world's temples after its route), through the
temple's logic rather than by real hits. Its choices in a conversation are a search over the data, not a player's.

**Found so far** (October 2026): arriving with the last world's errand still under way and tracked, Vael
II, Lorn, Viridel, the Hangar, the Garden and the market had no objective until their first talk:
`quests.tracked()` returned a quest that world doesn't have (fixed; `tests/dialogue.test.js`).
Lou, at home, starts her talk herself when she runs to meet you (`KNOWN`: intentional, the author's decision). The
City-Shaft's first find was only reachable on wings or by climbing: the red stair now leads down to it.

## Completion coverage (issue #670)

Can the game be finished from a new game? Yes, and the daily run proves it again each night. This section says
what "finished" means, what plays it, and what is real, shortcut or not tested.

**What finishing takes, derived from the game's data** (`tests/completion-spec.js`; print it with
`node scripts/completion-spec.mjs`, or `--json`). Nothing in it is copied by hand. It reads the route (`ORDER`)
and when each world is charted (`knownWorlds`, run as is). It reads every world's temples, each temple's gadget
and guardian, and the items its rooms ask for (the logic's `needs`), with the world where each item is first had
(`PLACEMENTS`). It reads the ship's core gadgets (`leave-gate.js CORE`) and the ending's chain (`ending.js`:
home charted after `ENDING_WORLDS` worlds and the "come home" call, the first homecoming `ending.done`, the
Lantern charted once the Signal Market is heard, `finale.met`, the true ending `ending.final`). It also works out
the fewest worlds the true ending needs: 11 of 12, because the market is charted only once ten worlds are done
(`AHEAD` 2). `tests/completion.test.js` (cheap, on every commit it reaches) fails if the data asks for an item
before its world gives it, if an item no box holds is asked for, if a world is never charted, if a core gadget
is outside its world, or if the ending chain breaks. It also checks that the play-through route covers every
world in order and that the daily job below keeps running.

**Who plays it**

| Requirement | Test | Real | Shortcut or separate |
|---|---|---|---|
| Every world's main quest, in route order, from a new game | `tests/playthrough.test.js` | levels, collision, people, story runtime, conversations, boxes, ship's voicemail and map | he is placed at each objective once a walk or declared way is found; the pirates' fight is marked won |
| Every temple to its guardian, with items earned on the route | `tests/playthrough.test.js` (route steps, then any temple of the world not done) | the temple's own logic and runtime in its world; doors, keys, chests and weights picked up | latches, balls and plates set through the logic where he stands; arena foes counted beaten; guardian resolved |
| Every temple physically, piece by piece | `tests/temple-playthrough.test.js` | balls rolled by real hits, timers, weights carried, plates stood on | items injected per house (`CARRY`); some vanes, songs and one-breath sequences done through logic and counted |
| Every guardian fight | `tests/guardian-completable.test.js` | scripted fights at 60 and 30 fps from three stances | isolated arena, items injected |
| Save and load across every world and both homecomings | `tests/playthrough.test.js` | the save is written through the game's storage (`src/save-slots.js`, memory `localStorage`), read back with `game.reload` and `migrateSave`, and play continues from that copy | the quest journal is the agent's memory journal |
| Old saves resume and finish their world | `tests/playthrough-saves.test.js` | real migrations | as above |
| Ending: first homecoming, Lantern, true ending | `tests/playthrough.test.js` (`HomecomingDirector` to the credits) and the browser pass | directors and flags | browser: from the market's debug save (route before it injected) |
| Page-only parts: title, prologue, Continue, map, takeoff, arrival, save and load, ending, no page error | `scripts/playthrough-browser.mjs` | the built page in headless Chrome, muted | teleports to objectives; Ilen's talk end set as its node sets it; the pirates' win set |

The completion test in `tests/playthrough.test.js` checks the spec against what was played: every
`world.<id>.done`, every `temple.<id>.done`, every core gadget, `ending.done`, `finale.met` and `ending.final`.

**Evidence and diagnosis.** `tests/playthrough.test.js` always writes `playthrough-evidence.json` to
`$PLAYTHROUGH_OUT` (default `<tmp>/hiraeth-playthrough`). Per world it records what was played, which step
first set `world.<id>.done`, each temple's state and the save round trip (size, same or not). It also records
the ending's stages, the completion check, the revision, and a `methods` block that names the shortcuts. Every
issue carries its step and a full state dump: every flag, the items carried and the keepsakes. A failing
report prints the file's path and the step of each issue. The browser pass writes `results.json` to its
`--out` folder: every check, page errors, and the page's level, cinematic and flags where it stopped. Its
screenshots go there too. It also checks by shape what the built game's minified class names hide.

**Daily** (`.github/workflows/nightly-tests.yml`, job `completion`, about 5 minutes). It runs
`tests/completion.test.js` and `tests/playthrough.test.js` with their evidence, builds the game, and runs the
browser pass against `vite preview`. It uploads `completion-evidence/` (node and browser) as an artifact, pass
or fail. The node tests also run in the full gameplay suite and whenever a commit reaches them. The browser pass
runs only daily or by hand.

**Platforms.** Node runs the game's own modules: the same code the web page runs and the Unity port bundles
through `engine/`. Chrome runs the built web game headless (SwiftShader WebGL, desktop window). Not covered by a
completion run: the Unity build (only temple endings are checked in its V8 bundle, `tests/engine-temple-finale.test.js`),
Android/Capacitor, the Steam Deck and Xbox builds, real GPUs, game pads and touch, and audio. A device or Unity
completion pass is still manual.

**Findings.** Played through this way (2026-10-25), no progression bug turned up. Every temple, the Aerie and the
Warden's Well included, reaches its guardian with what the route has earned. The route needs those two only to
their chests. In four worlds the world is done only once its temple is: the Underwater City, the Glass Dunes, the
Moon Foundry and the City Floating in Space (`doneAfter` in the evidence). The agent had no spot for the Warden's
Well's crown ring, which hangs 8 m up and is hooked from the floor. It now stands where the ring's `from` says.
The save read back after the first world differed only by the migration marks a page sets when it boots, so the
run now boots its new game the same way. (#628's question, "can every temple be played to completion?": yes, in
node, by its logic with earned items, and piece by piece with injected items. The guardians are fought
separately. Neither of these is a device or Unity walkthrough.)

## The walkthrough (issue #777)

How to finish the game, as a page on the site: `walkthrough.html` (Debug → Pages → Walkthrough, linked from the Notes
page and the lore page; `src/walkthrough-page/`). It goes from a new game to the true ending: each world on the route in
its order, its main quest, every temple step by step, then home, the Lantern and home again, in a player's words with the
buttons in Xbox / PlayStation form. Each step names the test that proves it and how that test does it.

**One list, played every day.** The steps are data, `src/walkthrough-page/steps.js` (`WALKTHROUGH`: a part per world,
home, the Lantern and the ending; each step `[id, how, words, note?]`). The page is drawn from it, and the play-through
(`tests/playthrough.test.js`) is held to it. While it plays, its agent records every step it takes
(`tests/playthrough-agent.js` `TRACE`):

- `<quest>:<stage>` as each stage of a quest comes up, and `<quest>:opener` for the talk that starts it;
- `temple:<temple>:door`, then each thing done in the temple, `temple:<temple>:<element>`, with `@<stop>` for a ball
  rolled to one of several stops;
- `act:<name>` for the route's own steps between quests, and `ship:<world>` for each flight;
- `home:first` and `home:final` for the two homecomings, and one scripted step of the Desert's,
  `desert.power:stone.cage` (the spring, the weight and the stone after the Keeper).

Each record carries `how`: `talk`, `on foot` (a path on foot was found over the real ground, then he was set down),
`climb`, `way` (a declared way: the wings, the bird, an air pillar, a shot), `scripted` (the world's own moves in
`tests/playthrough-worlds.js`), `ship`, `cinematic`, and inside a temple `prompt`, `chest`, `key`, `unlock`, `carry`,
`logic`, `arena` and `guardian`. At the end of each part's test, `tests/walkthrough.js` `checkPart` holds what was played
against that part of the list: the same ids in the same order with the same `how`, and the part's `test` naming the test
that played it. A part that differs fails its own test with the first step that broke ("the walkthrough's part "desert"
(The Desert) broke at its step 12: the guide says …, the play-through did …"). Neither side can change without the other.

**When the route or a temple changes**, the play-through fails at the step that moved. Run it with
`WALKTHROUGH_RECORD=<file>` to write what was played, part by part, then write the new or moved steps in `steps.js` in
players' words. `PLAYTHROUGH_UNTIL=<world>` plays the route only as far as that world (the rest skipped), one world at a
time while working on it. `tests/walkthrough-page.test.js` (cheap, every commit it reaches) checks the list's shape:
every world, home, the Lantern and the ending in order with their tests' names; every step a traced id, a known `how`
and a sentence with Xbox / PlayStation buttons; every temple under its own heading, named as its temple and guardian
tests name it, ending with its guardian. It also checks the check itself, the page with and without a daily result, the
links, the build input and the packaging.

**What is real and what is shortened** is written on every step (the `how` and, where the test's way differs from a
player's, a note). The order and everything the story, quests, conversations, chests, keys and temple logic do are the
game's own. Between places he is set down once a path on foot (or the declared way) is found, not walked frame by frame;
inside a temple the balls, eyes and plates are done through the temple's logic. Each temple's heading names the two
tests that do the rest for real: `tests/temple-playthrough.test.js` rolls every ball by real hits and stands on every
plate (its order is the route's in eight of the fourteen houses; in the others it differs in places: what a
ball lights by itself is not a step of its own there, a house's state is set again, or it does a piece the route's order
does not need, as it carries other things in), and `tests/guardian-completable.test.js` fights every guardian from three stances at 60
and 30 frames a second. A path check between the things inside a temple was tried for this issue and dropped: done
through the logic, the bridges and balls the next walk needs have not moved (122 of 325 legs failed for that reason
alone), and it doubled the run's time.

**Daily.** The steps are checked wherever `tests/playthrough.test.js` runs: every push that reaches it (it is one of the
long files the commit hook leaves to the push, `tests/hook-deferred.json`), the daily full suite, and the daily
`completion` job (`.github/workflows/nightly-tests.yml`), which writes `walkthrough-status.json` (every part and step,
passed or not, the revision and the run's link) beside its evidence and uploads it with `completion-evidence/`. The
temple and guardian tests run in the daily full suite. **On the site**, each deploy (`deploy.yml`, `cloudflare.yml`) runs
`scripts/walkthrough-status.sh dist`, which fetches the newest finished daily run's `walkthrough-status.json` into
`dist/walkthrough/status.json` (best effort: without it the page shows its steps unmarked). The page reads it and marks
each step ✓ or ✗, with the run's date and revision. It is the site's alone (`scripts/content-policy.mjs`
`WALKTHROUGH_FILE`); `walkthrough.html` itself is small and ships with the game, like the lore page.

### Recorded sound decoder on test hosts (#622)

The Node audio harness decodes the actual packaged effects before game startup. Its WAV reader is built in; compressed MP3 takes require macOS `afconvert` or `ffmpeg` on PATH. The Ubuntu Tests workflow installs FFmpeg explicitly when it is absent. Its setup has a four-minute bound and uses an explicit task-local Ubuntu source list, package indexes and cache. This excludes the runner’s indirect Azure mirror list while retaining Ubuntu’s signed-package verification and archive keyring. Download retries and connection timeouts are bounded, leaving the existing twenty-minute job limit for the actual tests. Local Linux test hosts need FFmpeg too. The `sound-qc-decoder` regression uses a fresh OS-temporary cache and checks every packaged MP3 produces finite, non-silent PCM, so a warm developer cache cannot hide a missing decoder. Test caches use `os.tmpdir()` rather than a macOS-specific `/private/tmp` directory. This changes test prerequisites only; game readiness and production decoders are unchanged.

### Smaller test dependencies

Release-note formatting and update decisions live in `scripts/release-metadata.mjs`.
Pure consumers import that module directly; `release-info.mjs` retains its public exports and CLI,
including Git and file reads. This keeps formatting tests independent of unrelated release I/O.

World builders import their own temple definitions through `src/temples/attachment.js`.
The all-temple registry in `src/temples/index.js` remains the story/integration entry point,
with compatibility exports for attachment helpers. Tests needing only runtime lookup or
attachment import the smaller module; tests covering the registry still use the registry.

Single-world fixtures import that world's real constructor directly; `tests/house-walk.js`
requires it explicitly. The shared registry identity test protects moved/merged world mappings,
and tests intentionally iterating every world retain the full registry. Scene construction and
behavioral assertions are unchanged.
## Keep semantic helpers separate from styling

`src/quest-mark.js` owns the existing quest/errand category symbol. The shared platform imports that
leaf directly; `src/hint-look.js` re-exports the same function for compatibility. Changing panel
colours or spacing therefore does not create a runtime dependency in storage, input or world code
merely because those modules use the platform. Category changes still reach both renderers.
`tests/quest-mark.test.js` preserves function identity and actual toast metadata; existing HUD and
cinema integration tests continue to cover presentation. This is a source dependency separation,
not a test-selection exemption.

Reference-world sheets use explicit authored asset URLs, retaining labels, sizes and view identity. Native UI source contracts live in `tests/native-ui-source.test.js`; real VM loading and menu-navigation assertions remain in their integration tests. The Node gadget helper uses ordered literal imports with a directory completeness regression, preserving automatic registration coverage without an opaque discovery dependency in every world test.


Build-page declarations live in `scripts/build-input.mjs`; page contracts import those declarations
without importing the development servers and packaging plugins. Vite uses the same object, with a
compatibility re-export and a wiring regression. Procedural motion audits similarly import
`walk-procedural.mjs`; actual generated-skin loading remains in `walk-generated.mjs`, with the
original public facade, shared guardian registry and generated-model integration coverage retained.

The selector's optional `--explain` reports the actual traversal reasons, including opaque reads,
resource ownership and import chains. Unknown dependencies still select their consumers;
unowned changed files fall back to the full suite. Directory resources own their descendants,
with path boundaries preserved. Renames and deletions use ownership from both Git revisions.
Changing a shared test helper follows its actual consumers rather than automatically selecting
every test; changes to the selector, hooks and other global test infrastructure still run all tests.

The sequence, temple-finale and bridge-material audits are partitioned to fit the existing
per-file timing limit. Sequence partition contracts retain every discovered case and complete
stream-diff groups. Material partitions audit every active world, prologue and discovered minigame;
explicit material-key witnesses are assigned exactly once and must be observed by that partition,
retaining global stale-key detection. New or moved keys require an explicit witnessed assignment.
No integration cases were deferred to the daily suite to obtain these reductions.

The timing table was refreshed from actual GitHub run40190711316. New and changed partition files
use measured local durations scaled by the existing `RUNNER_PER_MAC` factor; these are planning
estimates, not measurements of GitHub elapsed time. The unchanged timing-budget regression must pass.

### Bounded whole-game test loading

Whole-game tests that compile exactly `engine/game.js` use
`engine/game-test-runtime.mjs`. Compilation is shared with production through
`engine-bundle-core.mjs`; packaging and release helpers stay outside that compiler.
The adapter executes only the bytes it compiled in this process and limits its
standard asset reader to `public/` and `data/`, rejecting traversal and symlink
escapes. Generic VM/bundler callers retain conservative dependency selection.
Sequence parity contracts live in `engine/bridge-stream-gaps.js`, separate from
source-audit paths; the original `bridge-gaps.js` re-exports them for compatibility.
Sequence helpers accept the file returned by `buildBundle()` in the same process;
use `engine/vm-run.mjs` for arbitrary prebuilt bundles.

The selector reads `scripts/test-loader-contract.json` from the same commit/index
snapshot as the code. Exact fingerprints cover the adapter, compiler, VM and two
host asset shims. It still traverses every real import from `engine/game.js`,
including executable globs, and retains the whole two asset directories. Unknown
or missing game imports, a missing/malformed contract, or a changed fingerprint
fail closed. The contract is not an exclusion list and does not make all HUD edits
cosmetic: shared HUD behavior in `hud-state.js` still reaches gameplay tests.
Browser markup and icons in `hud-view.js` do not. `hud.js` remains the compatible
browser facade, while the engine and shared game host import state directly.

When one of the fingerprinted helpers changes, review its executable inputs and
runtime file-reading bounds before deliberately updating the fingerprint. Never
refresh fingerprints automatically in the hook or CI. Contract/analyzer edits run
the full suite. Regressions verify compiled-byte equivalence, runtime read bounds,
positive/negative selection, stale helper fallback, and committed/index snapshots
independent of working files. Syntax caching is keyed by path, explanation mode
and exact source bytes; contract validity is recalculated for each snapshot.

### Keeping the edit loop narrow

Dependency selection is a maintained architecture contract, not a list of tests to skip.
Use `node scripts/affected-tests.mjs --staged --explain` (or `--base SHA --head SHA
--explain`) to inspect each selected test's import/resource chain and opaque root.
Classify the cause before changing selection: a real dependency needs its test; an
unresolved finite input needs better analysis; an unrelated launcher or registry needs
an import boundary. Do not replace unknown paths with guessed directory wildcards.

The analyzer resolves identifiers by lexical binding, including private unescaped helper
arguments and finite `for…of` arrays. Unrelated callbacks reusing names do not taint one
another. Writes, exported/escaped helpers, mutable or escaped arrays, unknown inputs and
more than 64 alternatives remain conservative. Path helpers are matched to their actual
imports, with namespace mutations and escapes rejected. Conditional paths retain both alternatives unless a finite string and strict comparison
prove which branch applies; correlated branches never invent nonexistent module paths. `test-dependency-bindings.mjs` is global selector infrastructure: editing it
requires the full gate, just like editing `affected-tests.mjs`.

Keep importable libraries separate from CLI launchers with environment-driven discovery,
output directories or tuning imports. Motion QC tests import `motion-qc/runner.mjs`;
`run.mjs` remains the compatible CLI and re-exports the runner. No motion assertions were
removed. `tests/test-selection-boundaries.test.js` checks both directions against real
repository imports: HUD edits must not select motion QC, while player, physics, animation
and motion-harness edits must select it. Similar contracts cover finite source audits.
Add a boundary pair when fixing another accidental dependency so it cannot silently return.
The existing daily full suite also runs these contracts; uncertainty is never deferred
merely to obtain a smaller local selection.

Compare selected files and their measured duration weights for the same revision and
change set. A sum of per-file durations is workload, not parallel wall time. Keep unresolved
roots visible in the timing dashboard and prioritize roots that broaden many unrelated
consumers. A full game/VM integration test that actually loads the HUD can legitimately run
for HUD behavior changes, even after motion-only tests have been separated.


This applies across the repository, not only to HUD edits. Generated guardian audit
readers enforce their supported model paths at runtime. Keeper-only audits import their
own reader, so Elder asset edits do not select Keeper-only tests. Minigame and story audits use
literal lazy import catalogs, checked against the original directory discovery sets;
new modules cannot silently disappear from coverage. Z-fighting geometry tests load the
geometry implementation without optional source-name filesystem instrumentation. Source
name coverage still runs in its own test. The completion test gets its evidence revision
with one exact shell-free Git metadata query; arbitrary subprocesses remain opaque.

Normal selection builds the reachable import graph once and propagates changed inputs
back to their consumers. Explanation mode preserves per-test chains; regression tests
compare its results with normal selection. Old/new Git snapshots share syntax analysis
only when file path, complete source bytes and diagnostic mode match. Missing files,
changed source and changed modes cannot reuse stale analysis. This in-process cache lives
for one invocation; it does not rely on mtimes or a previous successful run. Between
invocations the command line keeps a content-addressed syntax store ("The selector's
syntax cache" under "Fewer and faster tests per commit").

A URL passed directly to the builtin `existsSync` stays an existence dependency.
Unknown reference-image names still select their checks for additions, deletions and mode
changes; constructing the URL alone does not turn unrelated regular content edits into
content reads. Unbound lookalike functions and URLs escaping to other consumers remain opaque.


Elder-only audits likewise use their own bounded model reader. Fight-only checks use a
literal lazy catalog whose contents are checked against both original discovery patterns;
other minigames cannot broaden those checks. Temple gameplay assertions import
`temple-design/measure.mjs` directly. The CLI calls that same measurement function and
owns arguments, report files and process exit; a separate CLI smoke test checks its
artifact contract. This retains the sight-line, puzzle and design assertions while
removing subprocess opacity from their game dependencies. Boundary regressions check
both unrelated edits being excluded and actual model, fight and temple inputs being kept.

The reference-path guard enumerates the documentation tree from its explicit root and
intersects it with the same repository inventory. It asserts that no inventoried document
was lost, including nested files. This gives documentation edits a real owning check
without marking arbitrary unknown inputs safe or excluding other opaque consumers.


### Keep tool wrappers out of measurement tests

Tests of an algorithm import its core, while a small compatibility test exercises the public
wrapper and the real command. `score-features-core.mjs`, the Tripo GLB `*-core.mjs` modules,
and `level-design/measure.mjs` retain the same calculations; the original command paths still
handle arguments, files and output. The level core returns its report, views and maps so tests
can inspect the same artifacts without launching a subprocess. `tool-core-contracts.test.js`
checks re-export identity, audio PCM parity and real score/level CLI behavior.

The sound-QC renderer follows the same boundary: `render-core.mjs` accepts explicit decoded
sample/theme providers; `render.mjs` supplies the filesystem decoder. Procedural sound tests
use the core and keep their original acoustic assertions. Disk-decoding tests still exercise
real packaged audio and remain conservative. Pure PCM measures, synthesis and source wiring
are separate test files so unrelated edits do not inherit the synthesis cost.

Guardian and costume audits use literal lazy catalogues (`tests/temple-modules.js` and
`scripts/costume-people.mjs`). `audit-module-inputs.test.js` compares these against the original
directory discovery rules, including every source scanned for guardian notices. Adding a
matching file without registering it fails that contract; it cannot silently disappear from
the audit. Positive and negative assertions in `test-selection-boundaries.test.js` protect
both exclusion of unrelated HUD/docs edits and inclusion of each real input.


Audit consumers reuse completeness-checked story and minigame catalogues instead of rediscovering modules through opaque dynamic paths. The traveller's Blender-source pose check and its runtime clip/skin simulations are separate tests: parsing a Blender expression must not pull animation simulation into unrelated UI edits. Source-only menu and enemy-plan checks name their actual files, with coverage checks for each built enemy surface.

The minigame catalogue is a composition boundary: `kit/registry.js` holds definition validation, collection, lookup, and link formatting; `index.js` supplies discovered games. Likewise, `kit/marker-core.js` constructs markers for an explicit game list while `kit/marker.js` supplies the application's default catalogue. Tests of one game import those shared implementations directly; the facade contract verifies default lookup and marker composition remain intact.


Known changed paths use graph reachability regardless of their count. The old 40-file cutoff could force a full suite merely because a feature branch and concurrent main changes accumulated 46 paths; the graph now analyzes that same range without a size-based exemption or fallback. Unowned paths, unavailable history, outside-repository inputs, opaque consumers, selector/hook changes, and shared build configuration retain their existing conservative behavior. Large-range regressions cover both selector modes and multi-commit Git ranges, including deleted dependencies.

Focused quest and people checks use literal lazy module readers; the catalogue contract compares supplementary people files with the directory inventory so additions cannot silently escape coverage. Fixed-scope minigame and quest checks name their own module loaders. Dialogue byte-preservation checks assert that their explicit source readers cover every ledger entry. Packaging filename rules and device exclusions live in `scripts/content-policy.mjs`, shared by the publisher and stripping tool, so policy-only consumers need not load either tool. Selection boundary tests check both unrelated HUD exclusion and actual-input inclusion. Whole-game engine integration tests still run when their HUD dependency changes.


### Keep expensive fixtures out of presentation checks

Map-chest persistence runs in `tests/map-chest-saves.test.js`: it still builds all nine
real attached worlds twice, but HUD edits no longer run that reload audit. The
key-opening/counter integration remains in `tests/key-chests.test.js`. Cab cue
formatting and real ship floating prompts have focused `cab-hud` and `ship-hud`
tests; city rides and hull/flight checks keep their own dependencies. The selection
boundary tests assert both exclusion of unrelated HUD edits and inclusion of the
actual world, chest and vehicle inputs. Assertions are moved intact, not discarded.

The browser completion harness holds Escape continuously until the production
prologue reports completion, with a bounded timeout and key release on success or
failure. Fixed wall-clock presses are insufficient on software rendering because
the game clamps each frame's simulation step; repeated releases reset hold-to-skip.
The harness does not set completion flags or invoke the skip implementation directly.


### Material audits and browser journey waits

Material runtime sweeps import `scripts/bridge-materials.mjs`, the pure comparison
in `scripts/bridge-gap-compare.mjs`, and `engine/bridge-material-gaps.js`. The
original bridge audit keeps compatible exports, while DOM/source inventory scans
stay outside runtime-only consumers. All active worlds, the prologue, all bundled
minigames, and every assigned stale-material witness remain checked. The generic
VM seed fixture lives separately from the expensive gameplay sequence file.

With `CI=true`, the browser harness defaults to a 640×360 viewport to limit
software-GPU raster cost; locally it defaults to 1280×720. Both accept
`--viewport WIDTHxHEIGHT`. Both use normal
game rendering and simulation. The browser completion harness uses elapsed wall time for polling and finite CDP
requests. It saves `progress.json` after each assertion so a job cancellation
retains its last result. Its route/save checks use ordinary held Escape input to
finish travel cinematics on software-rendered CI; they still assert the arrival
type, route, quest state, save, and ending. NPC arrival waits observe the actual
position instead of assuming six wall-clock seconds are enough. Natural arrival and takeoff playback
remain covered by the sequence suite. Timeout and connection failures fail the
check; they never mark a scene complete or force a progression flag.

Whole-game graphics, walking and door cases live in `engine-game-flow.test.js`;
generic platform/VM fixtures stay in `engine-bridge.test.js`. The two ordinary
Whale input cases use the fixed game entry in `engine-whale-input.test.js`, while
the custom completed-save entry stays in `engine-whale-tide.test.js`. Their test
bodies are unchanged; shared recorder/backends contain no loader imports. This
separates expensive gameplay execution from conservatively selected generic VM
fixtures without removing the actual gameplay dependencies.

Key-counter presentation has its own `key-counter-hud.test.js`; whole-world chest
opening and sound checks use shared HUD state directly. Native-build relevance is
a pure `unity-release-inputs.mjs` predicate, so its consumers do not import GitHub
history and CLI IO. Compatibility exports and actual input-selection checks remain.
The ending subtitle has a bounded three-minute wall-time observation window: slow
software frames can leave prior speech queued beyond a minute. The assertion still
requires an actual authored stone line in the rendered subtitle.

### Packaged audio tests have their own input boundary

`scripts/sound-qc/test-runtime.mjs` keeps the real packaged-audio decoder while
restricting reads to `public/sfx` and `public/music`. Names must be single audio
filenames; asset and cache symlinks cannot escape their roots, and caches must be
outside the repository under the temporary directory. The generic QC tools keep
`render.mjs` and its conservative dependency analysis.

`scripts/test-audio-contract.json` fingerprints both the guarded wrapper and the
actual decoder. The selector still follows their source imports (audio code,
sound manifests, synthesis helpers), includes both asset directories, and fails
closed on stale/missing fingerprints or any newly unresolved source dependency.
Review these bounds before updating a fingerprint; never refresh hashes in hooks
or CI. Contract changes run the full gate.

The engine-sound scenarios use `drive-test.mjs`, a fixed game loader plus the real
decoder; the CLI and tests share the unchanged scenario body in `drive-core.mjs`.
This avoids pulling generic bundle/VM tools into the tests. HUD markup and unrelated
world edits no longer select standalone audio playback tests; gameplay edits still
select the engine-sound scenarios. No sound checks were dropped or made nightly-only.

### Browser style inputs

`src/boot.js` registers the pure `src/hud-styles/` strings before starting the
browser game. Components look up these strings through `ui-style-registry.js`
and install them at their original lazy creation points. Gameplay and native
HUD-state consumers do not import the browser theme. The same presentation
assertions read the extracted styles; the registry check covers bootstrap
registration, and selection regressions retain cinema behavior coverage while
excluding CSS-only edits from sequence and completion simulations. Native HUD
rendering remains in its existing bridge; no native palette or state changed.

### Remaining model and audio consumers

Native picture tests read an explicit public-GLB catalogue. Its independent recursive discovery test fails when any model is added or removed, including a new folder. Existing texture loading and desert integration assertions remain unchanged. Approved PCM mix tests read real packaged bytes through the existing confined audio adapter; unknown asset names or escaping paths remain rejected.

Repository-graph regression tests reuse source bytes, existence answers and exact-text AST analysis within one immutable test process. Stale-contract and changed-source tests still supply explicit overlays, and temporary Git repositories are read independently. This avoids repeated filesystem work without caching results across edits or dropping selection assertions.
