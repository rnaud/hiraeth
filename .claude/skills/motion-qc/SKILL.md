---
name: motion-qc
description: Check that Hiraeth's traveller moves well — feet that plant without sliding, no pops (a bone flicking in a frame), no jolts at blend boundaries (a matcher jump, a captured move or matching easing in or out, a change of gait), a pose that answers the stick quickly, clean pivots — by driving him with scripted hands through starts, stops, every gait, turns, pivots, ramps and stairs, in node on the gait harness's course and in two or three real worlds in headless Chrome, reporting per scenario with numbers against thresholds, a contact sheet of the worst frames, and what the matcher costs a frame. Use after any change to src/feet.js, src/locomotion.js, src/animator.js, src/motion-match.js, src/loco-moves.js or the clip libraries, when someone says the walk slides, pops or twitches, when working on motion matching, or before a release.
---

# The motion QC

The traveller's locomotion (docs/systems/animation.md: "Locomotion", "Motion capture", "The motion QC") is judged
on what the eye sees frame to frame: where his feet are against the ground, how his bones turn, how his joints move.
Every scenario is a scripted pair of hands (the stick, Shift); every frame is recorded right after he moved and was
posed, and measured. The numbers say where to look; the contact sheet shows it.

Three ways of moving him are compared (`--ways`):

| way | what | in the game |
|---|---|---|
| `moves` | the loops with the captured starts, stops and turns laid over them (src/loco-moves.js) | the default |
| `mm` | motion matching (src/motion-match.js): the database's captures and the game's own loops | `?mm=1`, the dev menu |
| `loops` | the clips' loops alone | `?moves=0` |
| `snap` | `moves` with the old crisp stop from a run (every other way stops carried, the game's since issue #702: src/loco-moves.js `STOP_FEEL`) | `?stop=snap` |

## 1. Run it

```sh
node scripts/motion-qc/run.mjs <scratch>/motion [--ways moves,mm] [--only stairs,pivot]    # node, ~40 s
node .claude/skills/motion-qc/run.mjs <scratch>/motion-world [--worlds desert,bazaar] [--ways moves,mm] [--cpu 4]   # browser, ~1 min a run
node scripts/motion-qc/diff.mjs <before>/motion.json <after>/motion.json [--way moves]   # two node runs side by side
node scripts/motion-qc/worlds-flat.mjs [--seeds 1,2,3] [--verbose]   # the worlds' course on node's flat at the game's uneven frames
node scripts/motion-qc/feel.mjs [--snap]   # the controller's feel: starts, stops, the reversal, the lean and the bank
```

Both runs take `TUNE='{"feet.js":{"FEET":{"dropKeep":false}}}'` (assigned into `src/<module>`'s exported objects; in the
browser into the page's own modules): a before / after of a change that has a switch, without a second checkout.

A browser run whose frames came unevenly (over 2 % of them longer than 22 ms: a busy machine) is printed UNSTEADY and
marked `unsteady` in `motion-world.json`: run it again; its pops and jolts measure the machine. To play the game's frame
times in node, `runScenario(WORLDS_FLAT, 'moves', { frames: unevenFrames(seed) })` (scripts/motion-qc/scenarios.mjs): the
worlds' course on the flat at 15-19 ms frames, seeded; the jolts' cubic is read at the frames' own times.

Node 22.12 or newer on PATH (the global `WebSocket` and Vite's floor; CI uses 24; Zed's bundled node works).

- **Node** (`scripts/motion-qc/run.mjs`): the real Player, Animator, feet and matcher on the gait harness's course (flat
  ground, a 12° ramp, 18 cm stairs: src/gait-course.js), the game's coral-shirt traveller. Seconds a scenario: the
  loop to try a fix in. Writes `motion.json`, `motion.md` and `<scenario>.<way>.svg` (the worst frames drawn from the
  side and from above, the feet's trails, held feet filled; drawn by `scripts/motion-qc/sheet.mjs`, `sheetSVG`: the
  pose from the body's right with ghosts of the frames ±4 and ±8 either side, the ground, the balls' trails over
  ±0.25 s from above, captioned). Exits 1 if a `moves` run is red.
- **Browser** (the skill's `run.mjs`): the same hands in the real game, one world after another (the desert's open
  sand, the Signal Market's street, the Arena's floor), each way on a fresh boot. PORT (default 5363; **never
  5173**, the author's own server); Chrome picks its own debugging port (port 0, read from the profile's
  `DevToolsActivePort`; `CDP_PORT` fixes one); `VITE_CACHE=<checkout>/.vite-cache` in a worktree whose
  node_modules is a link. One muted headless Chrome (`--mute-audio`, the game's volumes at 0) and one Vite server,
  both closed at the end. `--cpu 4` throttles Chrome's CPU fourfold for the cost columns (a handheld's main thread,
  roughly). Writes `motion-world.json`, `motion-world.md`, `<scenario>.<way>.png` (pictures of the game at the worst
  frames, captioned) and `<scenario>.<way>.json` (the samples).
- **Diff** (`scripts/motion-qc/diff.mjs`): two node runs' `motion.json`, before → after, as a markdown table per
  scenario and way (`--way moves` keeps one way): the verdict, slide p95 and max, held, pops and jolts a minute, the
  worst jolt and the worst boundary; then a summary line (red runs, limits failed, the means). The table the docs and
  the changelog's numbers take.

## 2. The scenarios (`scripts/motion-qc/scenarios.mjs`)

Course (node): the gait harness's eight runs (walk → run → 180° → stop, a 90° turn, turning on the spot, the ramp,
the stairs, a slow walk, a jog's 45° veer, standing), and: every gait in turn (walk → jog → sprint → jog → walk →
stop), starts and stops over and over at each gait, pivots standing (90° each way, 180°), a 180° pivot at a jog and
at a sprint, a curve (the stick round a circle), down the ramp stopping on it, the stairs at a run. A script is
`[seconds, input, tag]` steps (input `{ KeyW, KeyS, KeyA, KeyD, ShiftLeft }` or `{ stick: { x, y } }`).

Worlds (browser): `{ name, world, at?, yaw?, dist?, setup?, segs: [{ for, stick: [x, y], run, tag }] }`, the stick
camera-relative, the camera held where it starts (3.6 m behind him: `dist`).

## 3. What is measured (`scripts/motion-qc/lib.mjs`, tested by `tests/motion-qc.test.js`)

| measure | what | limit (green) |
|---|---|---|
| **slide** | each planted step (the ball within 3 cm of the ground for 4+ frames, coming to rest at least once): how far it moved over the ground, cm; touchdown and lift-off included | 95 % under 6 cm, the worst under 12 |
| **held** | how far a foot feet.js holds (locked, fully blended in) moves over its hold | under 2 cm |
| **sink** | the deepest a sole goes under the ground | under 3 cm |
| **pops** | a body bone's angular velocity off the mean of its neighbours' (two frames each side) by over 14 rad/s: a flick in a frame | ≤ 3 a minute |
| **jolts** | a joint (relative to the body) off the cubic through its places two frames either side by over 3 cm: a pose that jumps | ≤ 3 a minute |
| **boundary** | the worst jolt within two frames of a blend boundary: a matcher jump, matching or a captured move crossing half its share, the leading loop changing, a pivot starting or ending | under 3 cm |
| **start** | from the stick pushed (standing) to a foot 3 cm off the ground | ≤ 0.22 s |
| **stop** | from the stick let go (moving) to both feet held and still for 0.3 s | ≤ 1.1 s, and a carried stop the time its carry takes over the crisp one's from that speed (0.31 s from a sprint, 0.08 from a jog: the sample's `carried`) |
| **turn** | from the stick turned by over 60° to the chest half way round | ≤ 0.3 s |
| **pivot** | through each pivot (src/locomotion.js) and a second after: the pivoting foot's slip while held, the share of frames with the feet crossed | slip under 5 cm, crossed ≤ 3 % |
| **cost** | µs a frame in `Animator.match` and the whole `Animator.update` (this machine; `--cpu 4` in the browser) | reported |

A short run counts as a minute (a 15 s scenario may have its three). Skims (a swinging foot within 3 cm of the ground
that never comes to rest) are counted, not judged. Why these limits: a held foot moving 2 cm reads as a slip at the
camera's distance; 14 rad/s off its neighbours is a bone turning 13° more in one frame than either side of it, which
reads as a flick; a joint 3 cm off its own smooth path in one frame is visible on a 1080p screen at 4 m.

## 4. Reading it, and the usual causes

- **Pops on the calf at lift-off**: the leg pulled to full length while the foot is still held (the knee locks
  straight), then let go at once. Soft IK (`FEET.soft`) and the release eased from rest (`FEET.releaseRate`).
- **Pops on the foot at touchdown, or a ball jolt**: the foot planted a few centimetres up and its hold taken at once
  (a 9 cm drop in a frame), or the loops' foot slapping flat in a frame at the game's cadence. `dropIn` (it comes down
  at its own falling speed) and `FEET.footRate` (turned about the ball, so a held one stays put).
- **A 10–20 cm jolt in a pivot**: the pivot flickering off for a frame lets a held foot go; planted again at the
  clip's place it jumps. Pivot hysteresis (`LOCO.pivotKeep`, `pivotHold`) and a relock where the foot is shown.
- **Sprint pops**: the sprint loop itself snaps the knee straight at push-off (76° to 0 in 40 ms; run it with feet.js
  off to see the loop's own share). The loop is smoothed (`SMOOTH_LOOPS`) and the soft IK widened with speed
  (`FEET.softFast`); what is left (~10 a minute) is the loop's.
- **Pops and jolts on stairs while a foot swings**: the floor's height under it stepping at an edge (`FEET.rideRate`) or
  a clearance ray lifting it at once (`clearAhead`, `clearRise`).
- **Feet crossed in a pivot**: a step's place across the held foot (`FEET.stepGap`).
- **Under matching, boundary jolts at `jump to …`**: a jump changes the contacts, and feet.js plants or lets go
  between two frames; a capture's stance doesn't fit the game's speeds. **`matching out`**: the loops take over at
  their own phase.
- Look at the contact sheet before believing a number: a skim mistaken for a step, a stair edge under a ball.

## 5. Where it stands

docs/systems/animation.md, "The motion QC", holds the results: the node tables before and after each round of fixes
(the default way and matching), the game's numbers per world, what the matcher costs and what is left red. Read it
there, not here. The browser runs are noisier than node's (the frame time varies): compare a world with itself, before
and after, on the same machine.

When you change the motion: run node before and after (`diff.mjs`), put the table in that section, and the before/after
numbers in the changelog's media (docs/systems/changelog.md).
