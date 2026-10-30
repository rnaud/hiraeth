---
name: camera-qc
description: Check that Hiraeth's follow camera behaves — no pops, jumps, spins, clipping into walls, the traveller hidden or out of frame, or jitter against small or moving geometry — by driving the game headless with scripted walks, runs, turns, jumps, lock-on and tight spaces in several worlds, recording the camera every frame, and reporting per scenario with numbers against thresholds and a contact sheet of the worst frames. Use when the camera "jumps around", after any change to CameraRig (src/player.js) or to a level's tight spaces (corridors, doors, carriages, rooms), or before a release.
---

# The camera QC

The follow camera (`CameraRig` in `src/player.js`, docs/systems/movement-and-camera.md) is judged on what the player
sees frame to frame, not on how it is written. Every scenario is a scripted pair of hands (the stick, Shift, Space, Tab
and the camera stick) in the real game; the camera is recorded right after `rig.update` every frame and measured. The
numbers say where to look; the contact sheet shows it.

Read first: docs/systems/movement-and-camera.md ("The follow camera", "The camera QC and what it fixed").

Lock-on: this skill covers the lock-on camera's motion (the `arena-lock` scenarios: pops, spins, the foe hidden behind
the traveller); lock-on as a combat tool (reach, switching, whether it helps a fight) is combat-review's.

## 1. Run it

```sh
node .claude/skills/camera-qc/run.mjs <scratch>/camera [--only train-walk,desert-shop] [--worlds overnighttrain] [--preset medium] [--seed 1]
```

Node 22.12 or newer on PATH (the global `WebSocket` and Vite's floor; CI uses 24; Zed's bundled node works).
PORT (default 5361; **never 5173**, the author's own server); Chrome picks its own debugging port (port 0, read from
the profile's `DevToolsActivePort`). `--seed` (default 1) seeds the `wander` turns, so a run repeats.
**The game steps 1/60 s a frame** during the run (main.js `window.__stepDt`), not by the browser's clock, settles by
frames, and a scenario's setup may hand its foes a seeded chance (`foes.rng = window.__cqRand`): a run repeats frame for
frame however loaded the Mac is (issue #289: on the clock, two runs of ante-lock a millisecond apart a frame ended metres
apart, one green and one red). A scenario's `runs` (ante-lock, arena-lock: 3), or `--runs N` for all, runs it again with
the step wobbled ±`--jitter` (0.05), seeded by the run: written `<name>#2`, `#3`, each judged, and a scenario is only as
green as its worst run. `--clock` runs on the browser's frame times, as before v1.68. VITE_CACHE a dependency cache inside the
checkout when the temporary one can't resolve the packages (a worktree whose node_modules is a link). One muted headless Chrome
(`--mute-audio`, the game's volumes at 0) and one Vite server with its own dependency cache, both closed at the end;
worlds one after another with a rest between. A full run (15 scenarios, 19 runs, 5 worlds) takes about 9 minutes.

It writes `camera.json` (every scenario's measures, events and verdict), `camera.md` (the table), `<scenario>.png` (the
worst frames, captioned with what happened and how much: the arm's change, the move off the camera's path, the look
point's, the turn nobody asked for, the lens's room) and `<scenario>.json` (the raw samples). It exits 1 if a scenario
is red.
`SHOT_AT=13.97[,…]` (seconds into each scenario) keeps a picture of those frames too, whatever happened there: the
same moment before and after a fix, for the changelog; each is also written whole at the frame's own size, `<scenario>-at-<t>.png`.
`SHOT_IN=3,9.5[,…]` does the same at seconds from each scenario's first recorded frame (`<scenario>-in-<t>.png`): the
same moment of every scenario in one run. `SHOTS=1` keeps one halfway through every segment marked `shot` (its name:
the `frame-<kind>` lock scenarios' stands at 2, 5 and 9 m, `<scenario>-in-2m.png`).

**Without a browser** (seconds, for trying a fix): `node scripts/camera-qc/sim-lock.mjs [runs] [jitter]` walks ante-lock
(the market's collision, the blot held, the lock camera as main.js turns it: `lockFollow`, src/foes.js; `RUN=k DUMP=t0-t1`
prints run k's frames, `EVENTS=n` the worst), `node scripts/camera-qc/sim-shop.mjs` desert-shop, and
`node scripts/camera-qc/sim-train.mjs [train-walk,train-run]` walks
the Overnight Train's carriages with the real `CameraRig` through the real collision in node (`scripts/camera-qc/sim.mjs`:
a traveller moved along waypoints, the camera turned after the way as a thumb would). `EVENTS=10` lists the worst events
with where they happened. `node scripts/camera-qc/sim-guardians.mjs [temple …] [--circle] [--before]` locks on to every
temple's guardian in its own arena from points round it and says whether he, his feet, the floor and it are on the
screen (issue #359; `--before`: the rig given no box). `tests/camera-qc.test.js`, `tests/camera-qc-lock.test.js` and
`tests/camera-qc-guardians.test.js` hold the walks to the limits. Confirm in the browser afterwards:
the real player's physics, frame times and crowd differ.

## 2. The scenarios (`scripts/camera-qc/scenarios.mjs`)

| scenario | world | what the hands do |
|---|---|---|
| train-walk | overnighttrain | deck → library → both sleepers' corridors → dining car → lounge → balcony, turning the camera after the way |
| train-run | overnighttrain | the same at a run |
| train-turns | overnighttrain | in the dining car's aisle: full turns each way, a look up and down, walking while turning |
| train-sleeper | overnighttrain | the sleeping car's corridor, a three-quarter turn standing in it, and back |
| train-jumps | overnighttrain | hopping along the dining car and across a porch |
| train-roof | overnighttrain | the roof walk forward over the plank bridges, under the sky lounge's canopy |
| train-deck | overnighttrain | round the ship on the landing wagon |
| desert-open | desert | running across the sand: turns, jumps, a fast spin of the camera |
| desert-shop | desert | inside Qanat's shop: wandering against its walls and counter |
| ship-walk | desert | aboard the parked ship (`SHIP_WAY`, ship-local): round the main room, the cockpit, past the bunk, through the cabin to the hold and back, then the stick alone toward the camera into the walls (issue #324) |
| bazaar-streets | bazaar | wandering the market's street with the camera after the way |
| ante-lock | bazaar | in the Undertower's antechamber (8 × 6.9 m), locked on to an ink blot held in its middle, by points (`ANTE_WAY`): half round it each way, twice backed into the corner by the passage to the hall on purpose; three runs |
| guardian-lock | bazaar | in the First Sign's Hall, locked on to the guardian awake (its blows held): circling it, backing to the wall, running round it |
| snapper-lock | perdide | in the Hush-House, locked on to the Mother Snapper awake (its blows held): circling it, backing off, running round it (issue #359: he whole, it and the floor framed) |
| arena-lock | arena | from the spawn, locked on to an ink blot (its chance seeded): circling, stepping in and back; three runs |
| arena-lock-lizard | arena | locked on to a horn lizard: standing, stepping back, circling it |
| `frame-<kind>` | arena | each of the 32 built kinds held in the Arena's middle (its update running, its blows dropped): locked on 2 m off, round it, back to 5 m, round it, 9 m, round it; `SHOTS=1` keeps the page (reticle and HUD) at each distance (issues #752, #755). `node scripts/camera-qc/sim-foes.mjs [kind …] [--before] [--circle]` is the same in node; `node scripts/camera-qc/sim-close.mjs [kind …] [--room] [--d 1.5,2,3]` locks on 1.5–3 m off a foe fighting (its wind-ups raising its arms and weapon) in the Arena or the Undertower's antechamber and gives the share of its bounds off the screen and the camera's motion (issue #795) |
| incal-pillar | incal | riding the City-Shaft's halfway air pillar on the wings (`hold`: jump held): straight up past the terraces, the camera turned while rising, then steered out |

A segment: `{ for, path: [[x, z]…] | stick: [x, y] | wander, pace (a path's stick tilt), near (m: a path point reached), run, jumpEvery, hold (jump held), turn / pitch (°/s), steer (°/s), lock }`;
a scenario: `{ name, world, at, yaw, setup (page code), flags, settle, framing, runs, segs }`. Add one for any new tight space.
Locked on, walk by `path`, not a held `stick`: the stick reads from the camera's own turn there, so a held stick's way forks
with every camera decision and the place you meant to test is reached one run in two (the hands read a path from the lock's
line, as the game does).

## 3. What is measured (`scripts/camera-qc/lib.mjs`, tested by `tests/camera-qc.test.js`)

| measure | what | limit (green) |
|---|---|---|
| **pops** | the arm (camera to look point) shorter or longer by > 0.25 m in one frame: collision pops | ≤ 2 a minute |
| **jumps** | a kink in the camera's path: this frame's move differs from the last by > 0.12 m and 2.5× its neighbours' (the swing the script's own turn asked for taken out) | ≤ 2 a minute |
| **look jumps** | the same kink in the look point's path (> 0.1 m): a shoulder snapping across, the look point pushed off a wall | ≤ 2 a minute |
| **spins** | the view turning > 90°/s more than the hands asked, in one frame, 3× its neighbours | ≤ 2 a minute |
| **clip** | the lens nearer a surface than its near plane (0.3 m: rays round it and ahead) | ≤ 1 % of frames |
| **hidden** | the head behind collision from the lens | ≤ 3 % |
| **out** | the head or the chest off the screen (not while he is left out of the view, `cut`) | ≤ 1 % |
| **in body** | the lens nearer his axis (feet + 0.2-1.75 m) than 0.5 m while he is drawn: the camera through the traveller (left out, `cut`, he isn't drawn: not counted) | ≤ 1 % |
| **reversals** | the arm going in and out (moves > 1 cm changing direction): jitter against small or moving geometry | ≤ 1.5 a second |
| **roughness** | the kinks' root mean square, every frame | ≤ 1.5 cm |
| **foe hidden** | locked on: the frames where the traveller's body covers half the locked foe's screen box or more (`cover`; combat-v1.47, a small foe lined up behind him) | ≤ 10 % of the locked frames |
| **framed** (report) | locked on: the share of frames with the foe's drawn body whole, his whole, his feet and the ground at its feet on the screen (within `FRAME_EDGE` 0.95) and his body over at most `FRAME_COVER` 35 % of it, by distance band (2, 5, 9 m: `lockFraming`); the reticle's ring size is recorded as `ret` | reported, not judged |
| **framing** | a scenario with `framing` (desert-open): the traveller's median height on the screen (feet to 1.75 m), on foot in the open (not riding, gliding, climbing or swimming; tight < 0.1): Sable's third of the frame (v1.49) | 0.28–0.40 |

"A minute" is rounded up for a short run (a 30-second scenario may have one). A teleport (> 3 m in a frame) is not
judged. The in-page picture is kept for the ten worst frames by a quick severity; node's judgement is the one reported.

## 4. Reading it, and the usual causes

- **Pops at doors and porches**: the arm behind is cut as the traveller goes through a narrow opening off the arm's
  line. The rig holds the camera's last spot and turns to follow (`holdSpot`), looks ahead along a walk or a turn so it
  starts in early on its spring, and centres the shoulder before a door (`sideArm`). A pop left is usually a geometric
  cut nothing can see coming: widen the opening if the level allows (the train's doors went 1.3 → 1.6 m).
- **Jitter (reversals) in a corridor**: rays slipping between a row of thin things (window mullions, compartment door
  frames, chair backs). The rig sweeps a ball (`physics.sweepSphere`) where it used rays; if it comes back, look for a
  new ray in the rig.
- **Spins at a very short arm**: any shove of the lens near the look point turns the view a lot. Look for what cut the
  arm to its floor (0.45 m) and why the hold or the swing didn't find room.
- **The camera outside the room** (a hull, a flat colour filling the frame): an opening it slipped through (glaze it:
  the train's windows have invisible glass) or a look point pressed into a wall.
- **A person filling the frame**: crowd walkers pass through the camera (they are not collision). Keep strollers out of
  narrow aisles (the train's crowd walks only where the aisle is wide).
- **Out of frame in a narrow corridor turned across**: the arm can't be longer than the corridor is wide; the rig tips
  the camera down over the head when the arm is short (`SHORT_ARM`, `SHORT_TILT`).

## 5. After a fix

Run the node walks, the camera tests (`tests/camera*.test.js`, `tests/ship-camera.test.js`), then the browser run for the
worlds you touched and one open world (nothing should change in the open). Put the before/after numbers in the
changelog's media (`src/changelog-media.js`) and a line in docs/systems/movement-and-camera.md.
