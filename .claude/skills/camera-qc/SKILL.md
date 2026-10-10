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

## 1. Run it

```sh
export PATH="/Users/anf/Library/Application Support/Zed/node/node-v24.11.0-darwin-arm64/bin:$PATH"
node .claude/skills/camera-qc/run.mjs <scratch>/camera [--only train-walk,desert-shop] [--worlds overnighttrain] [--preset medium]
```

PORT (default 5361; **never 5173**, the author's own server) and CDP (default 5362). One muted headless Chrome
(`--mute-audio`, the game's volumes at 0) and one Vite server with its own dependency cache, both closed at the end;
worlds one after another with a rest between. A full run (11 scenarios, 5 worlds) takes about 8 minutes.

It writes `camera.json` (every scenario's measures, events and verdict), `camera.md` (the table), `<scenario>.png` (the
worst frames, captioned with what happened and how much: the arm's change, the move off the camera's path, the look
point's, the turn nobody asked for, the lens's room) and `<scenario>.json` (the raw samples). It exits 1 if a scenario
is red.

**Without a browser** (seconds, for trying a fix): `node scripts/camera-qc/sim-train.mjs [train-walk,train-run]` walks
the Overnight Train's carriages with the real `CameraRig` through the real collision in node (`scripts/camera-qc/sim.mjs`:
a traveller moved along waypoints, the camera turned after the way as a thumb would). `EVENTS=10` lists the worst events
with where they happened. `tests/camera-qc.test.js` holds the walks to the limits. Confirm in the browser afterwards:
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
| bazaar-streets | bazaar | wandering the market's street with the camera after the way |
| arena-lock | arena | locked on to an ink blot: circling, stepping in and back |

A segment: `{ for, path: [[x, z]…] | stick: [x, y] | wander, run, jumpEvery, turn / pitch (°/s), steer (°/s), lock }`;
a scenario: `{ name, world, at, yaw, setup (page code), flags, settle, segs }`. Add one for any new tight space.

## 3. What is measured (`scripts/camera-qc/lib.mjs`, tested by `tests/camera-qc.test.js`)

| measure | what | limit (green) |
|---|---|---|
| **pops** | the arm (camera to look point) shorter or longer by > 0.25 m in one frame: collision pops | ≤ 2 a minute |
| **jumps** | a kink in the camera's path: this frame's move differs from the last by > 0.12 m and 2.5× its neighbours' (the swing the script's own turn asked for taken out) | ≤ 2 a minute |
| **look jumps** | the same kink in the look point's path (> 0.1 m): a shoulder snapping across, the look point pushed off a wall | ≤ 2 a minute |
| **spins** | the view turning > 90°/s more than the hands asked, in one frame, 3× its neighbours | ≤ 2 a minute |
| **clip** | the lens nearer a surface than its near plane (0.3 m: rays round it and ahead) | ≤ 1 % of frames |
| **hidden** | the head behind collision from the lens | ≤ 3 % |
| **out** | the head or the chest off the screen | ≤ 1 % |
| **reversals** | the arm going in and out (moves > 1 cm changing direction): jitter against small or moving geometry | ≤ 1.5 a second |
| **roughness** | the kinks' root mean square, every frame | ≤ 1.5 cm |

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
