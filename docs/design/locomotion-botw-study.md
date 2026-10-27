# Locomotion reference study: Breath of the Wild (issue #699)

2026-10-26. The author: motion matching cancelled for now, "focus on making our current locomotion system better", in Breath
of the Wild's direction (hand-keyed loops, a state machine, procedural touches; no matching). What Link's ground movement does,
measured from footage, against the traveller (the v2 body, drawn on B3's skeleton and clips: the motion is B3's), and what
changed. Design analysis only: no BotW asset, frame or animation is in the repository; the frames stayed in the study's
scratch folder.

## How the footage was studied (and its limits)

- **Frames, not memory.** Each video was opened muted in headless Chrome (`--mute-audio`, the player muted), as the combat study
  did (docs/design/combat-botw-study.md). Two ways: seeking to times (a coarse pass), and playing at half speed while screenshots
  are taken as fast as they come, each named by the video's own `currentTime` read just before it (about every 60 fps frame at
  half speed; ±1 frame). Frames were cropped round Link and tiled into contact sheets, and looked at.
- **YouTube in a headless player**: past ~45 s of playing it shows its error card, and another video's preview frames are now and
  then interleaved; those frames were found (a white strip at the bottom) and dropped, and passes were cut into 20-30 s pieces.
- **Timings** are video times at 60 fps (±1/60 s), on sources captured at 60 fps (said below). Durations are counted between
  poses, so ±2 frames. Nothing below claims a BotW timing that was not read off frames; what wasn't found is said so.

## Sources

| Source | What it shows | Studied | Times used |
|---|---|---|---|
| [Cinder — "Botw link running animation"](https://www.youtube.com/watch?v=_ff7Qg4hZjg) (1:41, 1152 × 720 at 60 fps; Cemu with its FPS counter) | Link in an open field from a free camera: standing, setting off, the run side on and from the front, the sprint from behind, stops | frames every 5 s; half-speed play of all of it; every 1/30 s over the events | 0:46.0-0:48.9 run, front; 0:50.2-0:52.4 sprint, behind; 1:02.8-1:04.3 setting off; 1:15.0-1:16.4 a stop; 1:28.5-1:29.7 the run cycle, side on |
| [Toad in the Hole — "Zelda Breath of the Wild 100% Walkthrough - Great Plateau [Switch 2] [4K]"](https://www.youtube.com/watch?v=CSIlpao6wsU) (1:40:20, 1920 × 1080 at 60 fps) | ordinary play at the game's own camera | frames every 100 s (5:00-25:00), every 2 s (4:40-6:38, 9:20-10:18), half-speed play 4:48-5:10, 9:20-9:46 | 4:51-4:55 up the cave's stone stairs at a run; 5:00-5:05 the run out to the cliff; 9:30.5-9:31.3 a crouched walk and a turn on the spot |
| [SirWade — "The Animation of Breath of the Wild"](https://www.youtube.com/watch?v=6BnuVkUqhtE) (9:04) | an animator's stream highlights | frames every 40 s | not used: the game is a small inset |

Rejected after a look: "When Link is too tired" (ioGBhlSu5nA: a fan cartoon, not the game) and "Link Running animation"
(thAAvuyJgRo: a fan's Blender rig).

## What Link does, measured

| Situation | Link (footage) | The traveller before (node, `scripts/motion-qc/feel.mjs`; the game) |
|---|---|---|
| **Setting off** from standing (1:03.10, side on) | first motion at 1:03.12 (the chest pitches forward and a knee lifts in the same frame); the first full stride by 1:03.29; a full run pose by 1:03.40: **~0.3 s** from standing to running, no walking steps between, the chest forward from the first frame | 50 % of the speed in 0.08 s, 90 % in **0.28 s**: as quick. The chest tipped forward with the acceleration, at most 9° (8.8° measured at a sprint) |
| **The run** (1:28.50-1:29.69 side on; 0:46.09-0:46.90 front) | one cycle **~0.83 s** (the same pose at 1:28.80 and 1:29.64; front 0.81 s): 2.4 steps a second; the chest pitched well forward the whole time (~15-20° by eye), heels kicked up behind, fists, elbows at ~90°, a long flight | the jog at 3.8 m/s: 1.2 cycles a second (0.83 s), the same cadence; but the jog loop runs nearly upright (gaits sheet) |
| **The sprint** (0:50.20-0:52.40, behind) | hunched forward, the arms flung out wide and back, an elbow up past the head, by turns; cycle ~0.8-0.9 s | the sprint loop at 8.2 m/s, 1.5 cycles a second, arms pumping close to the body |
| **Stopping** from a run (1:15.10, side on) | the last driving stride ends ~1:15.15; the chest comes **upright within ~0.1 s**; two braking strides, the front leg straight and planted ahead (1:15.3-1:15.7), the feet together at 1:15.8, standing still at 1:15.95: **~0.8 s** from letting go to standing, over two strides. No slide or skid in this stop | the speed gone in **0.32 s and 0.34 m** from a sprint (0.27 s, 0.16 m from a jog); the feet settle by 0.95 s (motion QC); the chest dips forward and back as the captured stop plays |
| **Stairs at a run** (4:51-4:55, behind) | the run goes on up the stone stairs at its own cadence, no visible change of stride | the stairs' line (`StairLine`): the body rides the flight's slope at a run |
| **Turning round at a run, the sprint skid, leaning into curves, slopes, landing into a run** | **not found** in the stretches studied (the player never reversed or sprinted round a bend in front of a side camera there) | not compared with BotW; ours measured only (below) |

Contact sheets (this study's scratch folder, not in the repository): `botw/ff7-start63.jpg` (the start every 1/30 s),
`botw/ff7-stop75.jpg` (the stop every 1/30 s), `botw/ff7-cycle.jpg` (the run cycle every 1/30 s), `botw/ff7-turn.jpg` (the run
from the front and the sprint from behind every 0.1 s), `botw/cliff-q.jpg` (the walkthrough's stairs and run-out every 1/3 s),
and side by side with ours: `evidence/start.jpg`, `stop.jpg`, `stop-jog.jpg`, `gaits.jpg`, `turn180.jpg`, `curve.jpg`.

## What fits Hiraeth, and what changed

1. **Setting off and stopping are already Link's speed.** Ours reaches 90 % of its speed in 0.28 s; Link runs in ~0.3 s. No
   acceleration ramp was added: it would only make the traveller slower to answer.
2. **The chest at a run** (pose only, `LOCO.leanRun`, `LOCO.leanCarry`, src/locomotion.js): setting off into a run the chest may
   tip to 14° (9° before; walking as before), and at a run it is carried 3.4° forward the whole time. Measured: 15.7° at most
   setting off at a sprint (8.8 before), 8.6° at a jog (7.9). Only the chest takes the extra: tipped from the hips too (they take
   0.3 of the lean), a sprint's planted feet slid 8-10 cm in the game. A bigger carriage (6°) slid the node course's starts 10 cm.
3. **The bank into a curve** (`LOCO.bankRun`): from a jog to a sprint the bank grows to 0.05 rad per (rad/s × speed) and 0.28 at
   most: 7.2° round a sprint's circle (5.0° before). Not at a walk: banked as much there, a pivot into a walk back popped the calf.
4. **The carried stop** (a switch in #699; **the default since issue #702**, the author's choice: "stop like Breath of the Wild";
   src/loco-moves.js `STOP_FEEL`, `braking`): stopped from 3.2 m/s or faster (a jog or more, not a tap of the stick), the speed falls by no more than 16 m/s²
   until the old rate is the gentler, so he carries on over a couple of braking strides and stops crisply: **1.9 m in 0.63 s**
   from a sprint (0.34 m, 0.32 s as it is), 0.39 m in 0.35 s from a jog (0.16 m, 0.27 s). The captured stop is played by the
   distance left at that rate. Slowing by a share of the speed instead (6/s) left a long creep at under a walk's pace, and the
   planted feet slid 15-35 cm. `?stop=snap` (or `carry`), the dev menu's Story tab ("Carried stop from a run" off: the old
   crisp stop), kept on this device under a new key (the #699 switch's stored value is not read). Crisp all the same at an
   edge or a step ahead, when the game takes the controls (talking at a run) and when a doorway's walk hands them back:
   docs/systems/animation.md, "Issue #699". Not changed: where you go, how fast you set off or turn.

**Not done** (for the author, or a capture): Link's run carriage is much more forward than ours and his sprint's arms are wide;
those are the loops' own poses (a new run and sprint loop, or a procedural arm layer). The sprint reversal and the sprint's
touchdown (below) are the motion QC's last reds.

## The motion QC before and after (issue #699)

Node (`node scripts/motion-qc/run.mjs`, the default way): 16 of 16 green before and after; mean slide p95 2.6 → 2.6 cm, pops
1.0 → 1.0 a minute, jolts 0.4 → 0.4, worst boundary 1.9 → 1.9 cm (the pose touches don't move the feet). The worlds' course at
the game's uneven frames (`node scripts/motion-qc/worlds-flat.mjs`, six seeds): red 2/6 before and after, worst boundary 4.0 cm.
In the game (muted headless Chrome, Medium, this Mac; three runs each, the before runs with the new constants switched off):

| world | slide max (cm) | pops /min | jolts /min | boundary (cm) |
|---|---|---|---|---|
| the desert's dunes | 6.4, 6.9, 7.0 → 6.7, 7.1, 6.9 | 4, 2, 4 → 3, 3, 2 | 6, 5, 6 → 5, 6, 6 | 5.7, 3.4, 5.6 → 5.6, 5.7, 3.4 |
| the Signal Market's street | 6.6, 6.8, 7.1 → 7.1, 6.8, 6.9 | 1, 1, 0 → 0, 1, 0 | 1, 2, 1 → 2, 2, 2 | 2.3, 6.5, 2.3 → 3.7, 3.8, 3.6 |
| the Arena's floor | 7.1, 6.6, 7.1 → 6.6, 6.9, 6.6 | 2, 1, 2 → 1, 1, 1 | 2, 3, 2 → 1, 2, 3 | 3.8, 2.1, 3.9 → 3.5, 3.7, 3.8 |

Within the runs' own spread. The carried stop (way `carry`): node 11 of 16 green; its reds are the stop's own length (the
"stop" limit, 1.1 s from letting go to both feet still, and scripts whose stops end before it settles) and stopping on the
course's stairs (4 pops a minute: carried onto the steps); in the game a held foot slips 3-5 cm in its braking strides (held
limit 2 cm). Frame cost: the Animator 63-85 µs a frame in the game before and after (the lean and bank are a few smoothsteps).

**Tried for the reds and left out** (each measured on the worlds' course, six seeds, and the node course):

- *A touchdown cushion* (a free foot's fall slowed near the ground): the sprint's foot meets the ground at 6 m/s and stops in a
  frame (a 4 cm jolt of the ball at a sprint step); cushioned, the slides fell (5.5 → 4.6 cm) but the pops rose (0.7 → 2.8 a minute):
  the hold then came down from higher.
- *The stride warp eased* through a running reversal: no change.
- *The loops' cadence held* through a reversal (the phase all but stops for five frames as the speed passes through nothing, the
  swinging foot frozen in mid-stride): the worlds' course's pops 0.7 → 0, slides 5.5 → 4.2 cm, but the node course's reversals
  went red (the 180° pivots' jolts 0 → 2 a minute).
- *A longer blend-in of the captured moves*: no change.

**Issue #702** (the carried stop made the default): the numbers, and what the new reds are, are in docs/systems/animation.md
("Issue #702").
