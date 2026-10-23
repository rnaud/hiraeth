# Movement and camera (October 2026, third feedback round; the jets reworked in v0.89)

## The follow camera: Ocarina in the open, Uncharted close in (v0.82, `CameraRig` in `src/player.js`)

The author: "the default camera is a bit too far away; closer, like Ocarina of Time, and closer as well in
closed spaces, like Uncharted." Measured in the running game (1280 × 720 and the Retroid's 730 × 410, the
camera put behind the traveller, FOV 55°):

| | arm | camera height | look down | traveller's height in frame |
|---|---|---|---|---|
| open, before | 9.5 m | 3.9 m | 12.6° | 0.17 (head at the centre) |
| open, v0.82 | 6.4 m (`OPEN_DIST`; 4.8 m since v1.49, below) | 3.0 m | 7.4° (`OPEN_PITCH`) | 0.26, head at 0.55, feet at 0.81 |
| close in, before | 2.6 m, right shoulder | 2.1 m | | 0.59 |
| close in, now | 1.9 m (`TIGHT_DIST`), the shoulder with room | 1.75 m | | 0.68–0.84 (head to the thighs) |

- **The open framing** looks at `OPEN_LOOK` (2.15 m, over the head), so the traveller stands in the lower
  middle of the frame and the world ahead fills the rest; the look down a world starts with is `OPEN_PITCH`
  (0.13 rad). The wheel and LB + the right stick still
  zoom (`rig.zoom`, `ZOOM` 3–60 m), round the new default.
- **Close in** (what was already found: the probes' `tightness`, the ship's and the houses' `indoor`, the
  interiors' rooms; blended by `tightK` with its hysteresis, in quickly and out after a second of open) the
  arm comes to `TIGHT_DIST` behind a look point at the shoulders (`TIGHT_LOOK`, 1.5 m), `TIGHT_SIDE`
  (0.7 m) off a shoulder. In a **hall** (`hallness`: a ceiling over ~6–14 m and walls far apart every way
  across: the giant's chest, a temple's big hall) it stands back to `HALL_DIST` (2.6 m, the old close arm),
  eased (`hallK`), so it is never further than before.
- **Which shoulder** (`pickShoulder`): the camera goes over the shoulder with room beside it (rays along
  the camera's right from the look point and from part way back along the arm), so the traveller stands
  toward the wall and the way ahead shows beside him. Coming in from the open (hardly offset yet) it picks
  freely, the right unless the left has `SHOULDER.margin` more room; once over a shoulder it swaps only
  when that side is cramped, the other has `SHOULDER.gain` more room, for `SHOULDER.hold` s, and not within
  `SHOULDER.rest` s of the last swap. The offset is signed and eased, so a swap slides across behind the
  head (`SHOULDER.rate`); a teleport or a hand-over (the paper sweep: `rig._lastP = null`) picks at once and
  snaps the follow point to where you are. Aiming is always over the right shoulder, the arm `AIM_DIST`
  (3.4 m in the open, 2.4 m close in).
- **Walls beside the look point** (`sideRoom`): also sampled 0.7 and 1.4 m ahead, counted as more room the
  further ahead, so the end of a pillar row or a door's jamb eases the offset in before you reach it; one
  closing in is eased in quickly and pulled in at once only as far as keeps the look point off it (it used
  to snap all the way in: a jump in the view).
- **Wider arms** (`follow(…, wide)`, main.js): gliding +7 m, the jets +3.5 m, climbing +1.5 m, swimming
  +0.8 m, eased and held 1.2 s after they drop (a tap of the jets doesn't pump the view); a ride's own
  `shot.boost` otherwise (the bike +7 m, a cab +3.6 m: the ~10 m view it had).

Tests: `tests/camera-framing.test.js` (the framing in the open, hallness, the shoulder in a corridor and its
stability, a swap past a wall without a jump, the blend in and out without a snap, a hall, aiming and the
wider arms); `tests/camera.test.js` and `tests/ship-camera.test.js` as before.

## Sable's framing on foot (v1.49, `OPEN_DIST`, `OPEN_LOOK`, `OPEN_PITCH`, `ROOF_TILT`, `RIDE_ARM`, `WIDE`, `BIKE_SHOT`)

The author, with five frames of Sable: "this is the camera angle in sable, it's closer to the character I believe than
what we have? the hover bike is further out though." Sable on foot: the character about a third of the frame's height a
little below its middle, the camera just over the head a few metres back looking gently down; indoors higher and
steeper; on the bike well back and lower, the rider small. Measured in the running game (headless Chrome, High,
1280 × 720, FOV 55°, the camera put behind the traveller; the traveller's feet to 1.75 m over them):

| | arm | camera height | look down | traveller's height in frame |
|---|---|---|---|---|
| open, v0.82 | 6.4 m | 2.98 m | 7.4° | 0.25, head at 0.56, feet at 0.81 |
| open, now | 4.8 m (`OPEN_DIST`), look point 1.7 m (`OPEN_LOOK`) | 2.47 m | 9.2° (`OPEN_PITCH` 0.16) | 0.33, head at 0.49, feet at 0.82 |
| under a roof (the Undertower's hall, 3 s in, `roofK` 0.5), now | 4.8 m | 2.93 m | 14.9° (up to 20.6°: + `ROOF_TILT` 0.2) | 0.31 |
| the bike, before / now | 13.4 m at 7.4° / 14 m at 5.7° (`BIKE_SHOT`) | 3.9 / 3.1 m | | 0.12 / 0.12, the road ahead lower in the frame |

- **Under a roof** (`roofness`: the probes' ceiling within 26 m and the slanting rays stopped; a tree's canopy lets them
  through) the open framing tips down `ROOF_TILT` more, eased over a second or two (`roofK`), so the camera stands
  higher over the traveller as Sable's does indoors. It is the framing's own tilt: the stick's pitch is left as it was,
  and close in (`tightK`), aiming or knocked down it is off (the shoulder view of the rooms and corridors is unchanged).
- **What rides, glides or flies keeps its arm** in metres, whatever the on-foot arm: gliding 13.4 m and the jets 9.9 m
  (+0.12 m per m/s) as before (`WIDE`, main.js), a ride 13.4 m (`RIDE_ARM`: the skiff, the bird), a cab 10 m
  (`shot.arm`), and the bike 14 m and a little lower (`BIKE_SHOT`), so speed and the road read. Climbing (+1.5 m) and
  swimming (+0.8 m) stay over the on-foot arm.
- **The lock camera** (#107, `lockViewAngle`) takes the arm it is given (`rig._curDist`): with the shorter arm the swing
  off the line that clears a small foe of the traveller's body is a little wider, and the camera QC's `foe hidden` holds
  (arena-lock 4.3 % before, 3.6 % now; the lizard 0 %). Stepping into a locked foe (within `LOCK_NEAR`, 1.2–2.8 m,
  main.js) the camera turns after it less, and not at all within 1.2 m: the line to a foe at your feet swings about,
  and the closer camera showed it (arena-lock's jumps; it is green now, red on roughness before).
- **The lock camera's turn, eased** (issue #236, from the v1.59 game audit: arena-lock red on roughness 1.79 cm, the
  blot hidden 7.5 %). Two causes, both in the lock, none in #195's or #234's close camera (the Arena is open: its arm is
  4.8 m throughout). Walking into a blot and past it, the line to it flips behind him in a third of a second and the
  camera eased straight at the line (6/s), so its turn started and stopped at once: up to 17 cm a frame at the 4.8 m
  arm. Now the turn's speed is eased (`LOCK_TURN`, `lockTurn` in src/foes.js: it changes by at most 9 rad/s a second,
  is at most 3.2 rad/s and brakes to stop on the line; circling, it trails the line by the same 1/6 s as before). And a
  blot chasing him 2.5–3 m off as he backs away stood behind his body: the swing off the line (`LOCK_VIEW`) was capped
  at 0.5 rad and faded out from 3 m, where clearing it takes about 0.65. Now `max` 0.7 and `near` 1.2–2.6 m (the
  camera QC judges the foe hidden from 2.5 m). The full camera QC (Medium), before → after:

  | scenario | roughness (cm) | foe hidden | jumps |
  |---|---|---|---|
  | arena-lock | 1.62 → 1.24 (red → green) | 6.0 → 1.4 % | 0 → 1 |
  | arena-lock-lizard | 0.53 → 0.30 | 0 → 0 % | 1 → 0 |
  | ante-lock (new) | 1.54 → 1.29 | 9.9 → 3.4 % | 2 → 1 |
  | guardian-lock (new) | 0.48 → 0.35 | 1.0 → 0 % | 0 → 0 |

  Every other scenario as before (the train, the market's street and the City-Shaft's pillar green; desert-open and
  desert-shop red as before). The two new scenarios lock on in the Undertower (the Signal Market's temple): an ink blot
  held still in the middle of its antechamber, and the First Sign awake in its hall, its blows held. Both stay red on
  **out** (the traveller off the screen 45 % and 23 % of the time): locked on with his back to a wall, the lock holds the
  yaw (the stick's sideways push switches the lock instead of turning the camera), so the arm is crushed to 0.1–0.4 m
  behind him and the short arm's tip leaves him out of the frame. Fixed in v1.63 (#256): "The lock camera with his back
  to a wall" below.
- The camera QC (browser, Medium) after the change: the train, the Signal Market, the City-Shaft's pillar and the two
  locks green, the open framing 30–33 % wherever it is judged; train-run 2 one-frame spins at a sleeping car's door at a
  run (the node walk finds the same door spots before and after: 11 events before, 9 now); desert-open and desert-shop
  red as before (the dunes' pops, smaller now: 3.9 m at most against 5.7; the shop's look jumps unchanged).
- Nothing new moves the view: no bob, no roll; the roof's tilt and every arm are eased.
- The Unity bridge draws the game's own rig (engine/mirror.js `camera`), so it follows; the C# port's own rig
  (`unity/Hiraeth/.../CameraRig.cs`) had kept the 9.5 m arm and now has the same numbers (4.8 m, 1.7 m, 9.2°).
- Tests: `tests/camera-framing.test.js` (the open framing's share, the roof's tilt in and out, the rides' arms);
  the camera QC judges the framing in `desert-open` (`framing`: the median share on foot in the open within 0.28–0.40).

## The lock camera with his back to a wall (v1.63, issue #256; `LOCK_ROOM`, `CameraRig.lockRoom`)

From the combat review v1.61: locked on in the Undertower's antechamber and the First Sign's Hall the traveller was off
the screen 43 % and 23 % of the camera QC's runs. The lock turns the camera onto the line from the foe through him (main.js,
`lockTurn`), so with his back to a wall the arm on that line was crushed to 0.1 m: the lens against the back of his head,
the short arm's tip (`SHORT_TILT`) looking down past him. #236 had tried letting the ship's climb run (39 % instead of 45 %).

- **The line yields** (`lockRoom`, every 0.05 s; main.js adds its eased answer to the line it turns the camera to). Where the
  arm on the line has less than `arm` (1.7 m) of room, it looks at turns off the line (`steps`, to 1.8 rad), all on the side
  it is already off before the other (the way across goes through the line, where the arm is crushed): the least with the
  whole arm and the foe's centre within `frame` of the view's centre; else the least with `min` (1.1 m, enough to keep him in
  the frame) with the foe on the screen; else further round; on its own side `low` (0.75 m) will do before it crosses. It is
  judged where he is, where the line is turning to, and where he is going (`ahead`, 0.6 s, stopped short of the wall he will
  meet), and a step past the first that has the room (the camera's turn trails its goal, and by a flat wall the room comes all
  at once). Back toward the line only for `back` m more; eased at `rate`.
- **The two framed together.** Turned off the line, the view also turns part way toward the foe (`lockAt`, its chest):
  enough to bring it within `two` of the centre, never past halfway and never more than `him` (`himUp` up and down) off him,
  him first. A far guardian along a hall's wall may stand at the frame's edge; a blot 2.6 m off is in it.
- **What else gives way while it yields:** the shoulder offset shrinks with the two-shot (`shoulder`; turning near a wall it
  swung the look point into it); the arm lets out sooner and quicker (`outHold`, `out`); `holdSpot` and the swap of shoulders
  are off while locked (holding the old spot turned the view 0.3 rad in a frame against the lock; a swap past a doorway's
  jamb cut the look point across by half a metre). Where no turn has the room, or the way to it crosses the line, the camera
  also climbs over his shoulder (`CLIMB`, as aboard), latched only once the arm is short too.
- **The stick reads from the line** (main.js passes `rig.yaw - rig.lockOff` to the player): with the camera turned off for
  room, pushing sideways still circles the foe and forward still goes at it.

The camera QC (Medium), before → after (the tree before, 2e818342):

| scenario | out | arm (m) | foe hidden | roughness (cm) |
|---|---|---|---|---|
| ante-lock | 43.4 → 0 % (red → green) | 0.12–1.62 → 0.55–3.48 | 4.1 → 2.9 % | 1.34 → 0.73 |
| guardian-lock | 23.0 → 0 % (red → green) | 0.1–2.6 → 1.83–2.6 | 0 → 0 % | 0.39 → 0.56 |
| arena-lock, arena-lock-lizard | 0 → 0 % | 4.8 | 2.2 → 1.7 %, 0 → 0 % | 0.7–2.1 run to run, before and after |

Runs of ante-lock since: green in 8 of 10 (the two red, out 3–5 %, on a machine loaded 40–70, one where he walked into the
antechamber's open side's corner); it is the scenario that wanders most (the stick strafes, the
blot is held, he may walk out through the antechamber's open side into the hall). Tests: `tests/lock-room.test.js` (his back
flat to a wall with a blot or a guardian before him, strafing into a small room's wall: on the screen, the arm out).

**In the open, thin things are looked past** (issue #259, `THIN_PAST`). desert-open's 36 % out was its start under the ship's
ramp (fixed by #254 in v1.62: 35.7 % on the tree before it, 0 % after). What was left red was one pop: turning the
camera at a run past a cactus, the open arm (one ray) was cut 4.8 → 1.5 m in a frame and let out again (roughness 11.6 cm).
Now, in the open, a thing between him and the lens that ends within `THIN_PAST` (1.5 m) along the arm, the lens's own spot
having its room, is looked past: the trunk may hide him for a moment (hidden 0.1 → 0.8 %, the limit 3 %) instead of the
view snapping in. A wall, a rock or a dune's body is thicker and still brings the arm in. desert-open: red → green (pops
1 → 0, jumps 2 → 0, roughness 11.64 → 0.57 cm); `tests/lock-room.test.js` (a trunk passed, a wall not) and
`tests/route-spawn.test.js` (the desert-open run from the start, in node: on the screen).

## A guardian's fight: the boss framing and the steady lock (v1.71, issues #320, #321; `BOSS_CAM`, `GuardianLock.steady`)

The author on the Keeper: "the camera angle is too close when fighting him making it hard to read the scene … I like
the Zelda Ocarina of Time bosses"; "the camera moves around too much. We should still have the lock on on his head but
the camera should stay more stable". The cistern is a closed rotunda, so the rig came in close over the shoulder
(1.9–2.6 m, the traveller and a slice of the Keeper's leg in the frame).

- **The boss framing** (`src/player.js` `BOSS_CAM`, `CameraRig.boss` / `bossK`): main.js sets `rig.boss` to the
  guardian fight he stands in (`Foes.bossFight`: awake, not weary, him inside its arena) when its def asks for it
  (`def.camera`, `{}` for the defaults; the Keeper's). Eased in at `rate` /s: the close-in framing gives way (the tight
  blend × (1 − bossK)), the open arm `arm` m longer (8.6 m at the default zoom), `pitch` rad steeper and the look point
  `look` m higher, so both he and it read; its long arm is swept and comes in on the spring like a close one (a low
  thing between, the cistern's spout, cut it 8.6 → 2 m in a frame).
- **The steady lock** (`src/foes.js` `GuardianLock.steady(dt)`, `STEADY`): the lock camera (`lockFollow`), the aiming
  camera (`lockAim`), the two-shot (`rig.lockAt`) and the strafe's line (`player.lockOn.dir` / `at`) follow a stand-in
  whose middle, chest and weak point are critically damped springs after the guardian's own (`body` 3.2 /s, `aim` 1.8
  /s; a jump past `jump` m, a reset, taken at once). A lunge of 3 m moves it 0.1 m in a frame. The gun's locked aim,
  the reticle and the blade keep the real mouth and middle.
- **Calmer after a guardian** (`lockFollow`, `STEADY.turn`, `STEADY_TURN`): the stand-in turns the lock camera at half
  its ease and within `STEADY_TURN` (4.5 rad/s², 2 rad/s; a small foe's `LOCK_TURN` 9 and 3.2): it is big and stays in
  the frame.

Measured in the real game (headless Chrome, High, the Rose House's cistern by `?guardianReview=keeper`, locked on, a
fake Xbox pad and the keyboard strafing 4 s each way, and 50 s strafing round it awake): see the v1.71 changelog's
numbers; tests in `tests/keeper-second-pass.test.js`.

## Locked on a guardian: both of you framed (v1.77, issue #359; `LOCK_FRAME`, `CameraRig.fitFrame`)

The author: "During guardian encounters when locked in I should be able to always see the guardian, myself in full body
and the floor. Right now with the mother snapper I cut off after the torso." Only the Keeper had the boss framing
(`def.camera`); every other arena read as a closed room, so the lock camera came in over the shoulder at 2.6 m.

- **The two boxes** (`src/lock-frame.js`): main.js gives the rig the locked guardian's box (`rig.frameWith`,
  `guardianBox`: its model's bounds every 0.25 s round its steady stand-in, kept within 4 × its size). `framePoints`
  turns it and his own box into the points to keep: his eight corners, the guardian as the round body it is (its foot,
  middle and top either side across the line, its foot's near side) and the floor halfway between you.
- **The solve** (`solveFrame`, every 0.1 s): of six camera heights (0.24–0.76 rad) the lowest whose shortest fitting arm
  (4.5–16 m) is under 11 m, else the shortest; each height's arm no longer than the room behind it (a swept ball, read
  ±0.5 rad round and where the lock's turn takes it 0.7 s on) less 1 m. The arm and height follow on springs (out 2.2 /s,
  in 8 /s); the close-in framing gives way (`tightK × (1 − fitK)`), the look point rises 0.6 m (over plinths and spouts),
  and the lens is still shoved off walls.
- **The view** (`frameAim`): turned to the middle of the points' spread from where the camera is (refined twice on the
  picture itself), eased at 8 /s; too tall for the frame, the lowest points (his feet, the floor) are kept and the top is
  lost. Where no arm the room allows fits it all (his back near the arena's wall) the lens widens, up to 68°, and the
  lock's turn off the line for room (`lockRoom`) looks for up to 7.5 m (`LOCK_ROOM.fit`); crushed under 2.4–3.6 m the
  view goes back to the look at him.
- Not while aiming (`aimK`); eased in and out at 1.8 /s.

Measured in node over all 14 guardians in their own arenas (`scripts/camera-qc/sim-guardians.mjs`: 148 points round
them, his back at least 4 m from the wall): he whole on the screen 52 → 148, its middle 100 → 148, he whole with the
floor and its foot and middle 42 → 148, everything including its top 7 → 122; circling each, he is never off the screen.
The browser QC's new `snapper-lock` (the Hush-House) and `guardian-lock` (the First Sign) are green. Tests:
`tests/camera-qc-guardians.test.js`.
The Cistern-Keeper and the Aerie's Elder are framed by the generated bodies the game swaps in (issue #566: node can't
fetch `/guardians/<id>/model.glb`, so sim-guardians reads the GLBs from `public/` as the motion audit's `loadSkin` does;
before, their old procedural bodies' boxes: the Keeper's 10.2 × 8.2 × 11.6 m, now 3.3 × 7.3 × 7.8; the Elder's 12 × 9.9
× 12, now 6.3 × 6.6 × 4.9, its top on the screen at every point instead of none).

## Aiming locked on: centred, then nudged (v1.77, issue #362; `src/lock-aim.js`)

The author: "When pressing L2 to aim we should always center to the center of the lock on and I should be able to use the
right stick to slightly shift the aim like it's done in Metroid Prime games." The aim used to ease toward the lock's point
at 14 /s (6° off 0.15 s in) after the guardian's steady stand-in, and the stick's flick switched the lock.

- Aiming (LT / L2, R, the right mouse button) with a lock, the camera comes onto the lock's own point as the aim rises
  (`AIM_NUDGE.ramp`, over the tool's `camK` 0.2 → 0.7) and holds it exactly from then (`lockAimStep`).
- **The nudge** (`AimNudge`): the right stick's tilt shifts the aim off the point within a 0.12 rad cone (about 7°),
  following it at 14 /s; let go, it eases back at 5 /s. A mouse or a touch drag moves it too, held while it moves.
  Nudged past 15 % of the cone the crosshair is the player's own (`FluidTool.nudged`: no snap onto the point).
- While aiming locked the look no longer switches the lock. Without a lock, aiming is unchanged.

Tests: `tests/lock-aim.test.js` (the cone, the return, the real rig on the point and shifted off it).

## The camera QC and what it fixed (v1.40, `.claude/skills/camera-qc`)

The author: "in the train when I'm walking it keeps jumping around." The camera QC drives the game headless with
scripted hands (walks, runs, turns, jumps, lock-on, tight spaces; `scripts/camera-qc/scenarios.mjs`) and records the
camera every frame right after `rig.update`; `scripts/camera-qc/lib.mjs` measures pops (the arm cut or let out by
> 0.25 m in a frame), jumps and look jumps (kinks in the camera's and the look point's paths), spins (turns nobody asked
for), clipping, the traveller hidden or out of frame, the arm's reversals (jitter) and the path's roughness, against the
limits in the skill. The same walks run in node through the real collision (`scripts/camera-qc/sim.mjs`,
`sim-train.mjs`), which is where the fixes were tried; `tests/camera-qc.test.js` holds them.

What it found on the Overnight Train (browser, Medium, the walk from the deck to the balcony, 42 s): 14 pops of up to
1.6 m, 37 jumps (kinks in its path), 21 spins (up to 6700°/s), the traveller out of frame 6 % of the time. The causes and the fixes:

- **Rays slipping between thin things.** The arm was found by a ray (a cone of five rays close in) and the shoulder's
  room by a ray: along the sleeping car's corridor the open compartment doors and their frames, along the dining car the
  chair backs, along every carriage the window mullions were hit on one frame and missed on the next, and the arm pumped
  in and out by a metre. Close in the arm is now a ball the lens's size swept back from the look point
  (`physics.sweepSphere`, `roomAt`), which sees a row of uprights as the band it is and leaves the lens its room (the
  rays that shoved the lens off walls afterwards are gone close in); the shoulder's room is a thin ball swept sideways.
- **The shoulder toward the wrong side.** A corridor with open doors along one side has "room" beside the shoulder
  through every door, so the look point went there and the arm behind caught on each frame. `sideArm` (every 0.12 s,
  held 0.8 s) centres the look point when the arm from beside either shoulder is cut and the arm from behind the head is
  not, here and where the traveller will be in half a second (a door ahead is centred for before he is in it).
- **Doors and vestibules off the arm's line.** Stepping out of a corridor into a vestibule, or through an end door, cut
  the arm behind by a metre at once. Now a cut of more than 0.45 m, when you are not turning the camera, is held:
  the camera stays where it was if it still has room and sees the head, and turns to follow (`holdSpot`). Otherwise
  the arm comes in on a critically damped spring (`ARM_IN`, at most 12 m/s) as long as the lens keeps 0.16 m of room on
  the way, and lets out on a slower one after a pause (`ARM_HOLD`, `ARM_OUT`); a walk, a run or a hand turning the
  camera looks a moment ahead (`ARM_AHEAD`: where the look point and the arm will be) so it starts in before an edge
  arrives. The swing round to the side with room (`swingClear`) works close in anywhere now, not only in the ship.
- **The lens leaving the carriage.** A look point pressed to a curved wall, or the arm out through a window behind,
  put the camera outside looking at the hull (a flat purple frame). The look point keeps 0.3 m off walls (`LOOK_R`) and
  stays under whatever is overhead (eased); the arm is never longer than the swept ball found room for, even under its
  0.45 m floor; the train's windows have invisible glass (`glass()` in overnight-train-kit.js: in the collision, never
  drawn), which also keeps the traveller from stepping out of one.
- **Hops in a low carriage.** Close in, the view rises and falls with a jump more softly (`AIR_FOLLOW`, main.js sets
  `rig.air`), so the arm no longer knocks against the ceiling at the top of every hop.
- **A very short arm** (turning round in a 1.5 m corridor) tips the camera down over the head (`SHORT_ARM`, `SHORT_TILT`)
  so the traveller stays in the frame.
- **The level**: the sleeping cars' vestibules are 3.6 m deep (`VESTIBULE`, were 2.1: the turn from the corridor to the
  end door pinned the camera to the last compartment's wall), the end doors 1.6 m wide (`TR.door`, were 1.3), and the
  crowd strolls only where the aisle is wide (walkers in the dining car's aisle and the corridors walked through the
  camera, a cloak filling the frame).

- **The shoulder at a very short arm**: the look point's offset shrinks with the arm (at 0.55 m a 70 cm offset put the
  head off the edge of the frame), and a wall right beside the look point eases it in over a few frames (`SIDE_IN`)
  rather than at once.

After (browser, same scenarios; the train's turns and roof scenarios were changed to keep the walker off the furniture,
so they compare with the node walks rather than the old browser runs):

| scenario | pops before → after | jumps | turns nobody asked for | out of frame |
|---|---|---|---|---|
| train-walk (42 s) | 14 → 0 | 37 → 1 | 21 → 0 | 6.1 % → 0 |
| train-run | 15 → 0 | 37 → 1 | 33 → 1–2 | 2.6 % → 0 |
| train-sleeper | 7 → 0 | 19 → 0 | 18 → 1 | 21 % → 0 |
| train-jumps | 2 → 0 | 2 → 0 | 1 → 1 | 10.6 % → 0 |
| train-deck, desert-open, bazaar-streets, arena-lock | 0 → 0 | | | 0 → 0 |

Six of the seven train scenarios are green in every run; the run is green or one turn over its limit (a quick turn into
the sleeping car's corridor at a run, the lens shoved 9 cm off a jamb). The open worlds (the desert's run, the market's street, the Arena's lock-on) were
green before and stay green. Left: Qanat's shop (an 8 × 7 m room, walked round its edges) is red on small kinks of the
look point (18 cm, 3 in 8 s) and its roughness; a door taken at a run while turning can still come in by ~0.2 m in a
frame; crowd strollers still walk through the camera in other worlds' narrow streets (only the train's keep out of the
aisles).

**The lens past a door's jamb (v1.50).** Sable's closer arm (v1.49, #148) made that last turn at the sleeping car's
door worse: the lens, coming in on its spring past the jamb, was shoved 14 cm sideways off it in one frame
(`pushCapsule` after the arm was placed), the view turning 170°/s nobody asked for, and train-run went red on two of
them in some runs. Close in, that shove is now eased (`SHOVE_RATE` 14/s, never more than `SHOVE_LAG` 8 cm short of
what the walls ask: the lens keeps most of its room), and where the spring would put the lens in a wall on the way
(less than `ARM_IN_ROOM`) it comes in along the arm only as far as it has its room again (bisection), not jumped to the
arm's end. The worst unasked turn at that door: 169–174°/s → 70–82°/s in the browser (under the spin's 90), 363 → 196
in the node walk at a run; train-run green in every run since. desert-open and desert-shop stay red for causes of
their own: in the open the ground behind a jump or a dune cuts the arm by 3–4 m at once (the ground limit's
bisection, snapped in where close in it eases), and the shop's are the look point's small kinks above. The C# port's
rig (unity/) does not have the eased shove yet.

**v1.66** (docs/audits/camera-v1.66.md, 2026-10-13): 13 of 15 green, the train's seven and the open desert among them;
Qanat's shop red as above; the Arena's lock-on rough (1.7-2.0 cm, two runs); the Undertower's antechamber lock-on green
in one run and red in the next (the lens tipped over his head in the corner by the door; issue #289).

### Run to run (v1.68, issue #289)

**Why two runs differed.** The QC ran on the browser's own frame times (16.7 ms ± 1–2 ms a frame on a loaded Mac), and
locked on the stick reads from the camera's own turn (`rig.yaw - rig.lockOff`: the lock's lag and its stand-off swing in
it). So a millisecond's difference in a frame turned the camera a hair differently, the held stick took him a hair
elsewhere, and every room decision after it (`lockRoom` every 0.05 s, the stand-off's side, the shoulder) could go the
other way: two runs of the same script were 2 mm apart at 1.5 s, 17 cm at 2 s and 2.5 m at 5 s. One fork in two walked him
into the north-west corner by the passage to the hall, where three faults showed: (1) the shoulder's look ahead along his
strafe (`SIDE_AHEAD`) started its ball against the wall, read no room for a frame and cut the offset 0.5 m (a look jump);
(2) the arm, 4.4 m out through the open side into the hall (the room there reads part open, `tightK` 0.13), was cut at once
by the jamb as the lock turned (the spring that eases it in was only for `tightK` over 0.5); (3) in the corner the lock's
room goal flipped across the line (-1.8 → +1.65 rad), the camera swung through his back, the arm was crushed to 0.2 m and
the climb and the short arm's tip looked straight down on his head (the 448°/s frame). The blot was not moving: the
scenario held it already (`f.update`); the audit's guess was wrong.

**The QC now repeats.** The game steps by `window.__stepDt()` when a measuring run sets it (main.js; the clock otherwise):
the camera QC steps 1/60 s a frame, settles by frames, and gives a scenario's foes a seeded chance (`foes.rng =
window.__cqRand`), so a run repeats frame for frame on a busy machine (two runs: the same to the millimetre). A scenario's
`runs` (or `--runs N`) runs it again with the step wobbled ±5 % (`--jitter`): green only if green every time. ante-lock and
arena-lock run three times. ante-lock walks by points now (`ANTE_WAY`: half round the blot each way, twice backed into that
corner on purpose, `pace` the stick's tilt; locked on, the hands read the way from the lock's line as the game does), so the
corner is in every run; arena-lock starts at the spawn. `--clock` runs on the browser's frame times as before.

**The fixes:** the shoulder's look ahead stops a ball's room short of the wall he is going toward and is skipped from a point
without room round it; only the room beside the look point itself pulls the offset in at once (`_sideHere`), the looks
ahead bring it in on a critically damped spring (`SIDE_SPRING` 12/s: an easing's first step was Qanat's shop's kink); and
locked on, a big cut of the arm comes in on the spring wherever the room is at all close (`tightK` over 0.05).

**Without a browser:** `node scripts/camera-qc/sim-lock.mjs [runs] [jitter]` walks ante-lock in node (the market's
collision, the real rig, the lock camera as main.js turns it: `lockFollow` in src/foes.js, which main.js calls now);
`node scripts/camera-qc/sim-shop.mjs` walks desert-shop. `tests/camera-qc-lock.test.js` holds both: four runs of ante-lock
(the step even and ±25 %) green, never steeper than 50° down, in the corner each time and ending within 10 cm of each
other; the old stick walk into the corner with no look jumps; the shop with none.

The camera QC (Medium, M4 Pro, the Mac shared: load 20–110 during the runs), before → after:

| scenario | before (main, the clock) | after (the step, three runs) |
|---|---|---|
| ante-lock | red, red, red: 2/6/7 jumps, out 0/5.1/6.1 %, 1.38/2.99/3.97 cm | green ×3: no jumps, out 0 %, 0.78/0.93/0.93 cm, foe hidden 4.3–5.1 % |
| arena-lock | 1.05 (1 jump), 1.64 cm (red); the audit 1.70, 2.00 | green ×3: 0.58/0.90/0.81 cm, no jumps, foe hidden 1.6–4.9 % |
| desert-shop | red ×2: 2 jumps, 3 look jumps, 1.82/1.83 cm | green: none, 0.69 cm |

The whole QC after: 19 of 19 runs green (the train's seven, the desert's two, the market's four with ante-lock's three, the
City-Shaft's pillar, the Arena's lock-on three times and the lizard). The old ante-lock's stick walk in node, 12 runs (the step even, then ±25 %): green
in 3 → 8, look jumps 27 → 0; the four still red strafe along the passage beside the jamb, the arm cut against it (a pop,
or him off the screen 1.5–3.5 % of the run), one of them with the across flip of (3) (a doorway walked sideways locked on:
the geometry's, left for now; the scripted way no longer goes there by chance).

## Small rooms: room to stand back, and a camera that settles (v1.59, issue #195; `ROOM_FIT`, `roomFit`, `ARM_OUT_GAP`)

The author: "Most of the temple rooms are too small and so is the ship and it's interior. I want rooms to feel bigger so
the camera doesn't move and shake every time we are in a cramped space." Both sides were fixed: the rooms (the temples'
antechambers, docs/systems/temples.md "Room for the camera"; the ship, docs/systems/ship.md "Grown for the camera") and
the close camera in them.

**The probe** (a scratch script beside the camera QC's node walk, `scripts/camera-qc/sim.mjs`): every temple's every
checkpoint stone and seven spots aboard the ship; at each, the room measured (16 chest-height rays: the narrowest and widest
width across, the ceiling), then the real `CameraRig` through the real collision for a full turn by hand (60°/s, 6 s) and
four walks out and back (stopping 2.6 m short of a wall, never through something the body would bump). Per room: the
shortest arms (p10), the pull-in (the arm it wants less the arm it got, p90), the roughness, pops and clipping. A room is
cramped when the arm is under 1 m a tenth of the time, or it pops, clips or is rough (over 2 cm). 30 of 137 were, 18 after:

| room | across (m) | ceiling (m) | arm p10 (m) | pull-in p90 (m) |
|---|---|---|---|---|
| the eight antechambers (Belfry, Footprint, Engine-House, Lamp-House, Hush-House, Clock-House, Greenhouse, Undertower) | 5.1 → 7.6 | 7.0 → 8.5 | 0.55–0.88 → 1.60–1.70 | 1.09–1.54 → 0.27–1.15 |
| the Mooring-House's ante | 5.0 → 7.6 | 6.4 → 7.6 | 0.53 → 1.82 | 1.37 → 0.08 |
| the Rose House's Dry Channel and Sword Chamber (their stones moved off the wall) | | | 0.31, 0.45 → 1.49, 1.99 | 1.72, 1.45 → 0.72, 0.23 |
| the ship: by the holo table, the main room's aft end, the hold | 3.8–4.8 → 4.0–5.5 | 2.3 → 2.9 | 0.48–0.97 → 1.12–1.76 | 0.93–1.42 → 0.14–0.78 |
| the ship: the cockpit, by the hatch, by the bunk | 3.1–5.0 → 3.9–5.7 | 2.3–2.4 → 2.7–2.9 | 0.46–0.78 → 0.42–0.83 | 1.12–1.44 → 1.06–1.24 |

Still under the line: the ship's cockpit, hatch and bunk spots (over it since issue #234: the climb below) and a few temple stones that stand by a wall in rooms 10 m
and more across (the Footprint's pool, the Lamp-House's roots, the Hush-House's well, the Greenhouse's vault and landing,
the Undertower's well): a full turn with your back a metre from a wall brings any camera in. The pops left are the open
framing's in great open halls (the Aerie's well and gulf, the Greenhouse's stair, the Mooring-House's moorings), where the
ray-cut open arm snaps as it always has (the camera QC's desert-open), and a column's top 1 x 2 m in the Aerie.

**The camera in a small room**:

- **Fitted to the room** (`roomFit`, `ROOM_FIT`): from the same probes the tight framing uses (eight chest-height rays every
  0.12 s), a room shut in every way within 9.5 m (its widest width across under `small`; aboard the ship, `indoor`, any
  room) gets a close arm no longer than its third nearest wall less 0.6 m, at least 1.1 m. Its goal moves only by more than
  0.18 m (it never flips between two lengths) and the arm eases to it (`rate` 1.4/s): turning round in a cabin the camera
  stays at one distance instead of pumping in at every wall and out at every gap. By one wall of a big hall nothing
  changes (the hall is wide), nor in a corridor (its length is the room behind him: the train's shoulder view stays).
- **Lets out only for a real gain** (`ARM_OUT_GAP` 0.12 m) and after a longer pause close in (`ARM_HOLD_TIGHT` 0.5 s; 0.7
  showed the traveller out of frame in the sleeping car's corridor): an arm cut by a wall no longer creeps back out by a
  few centimetres and in again.
- **The short arm's tip** (`SHORT_TILT`) is judged by the room behind him at the untipped pitch, not by the arm the tip
  left: tipped over the head, the camera could meet whatever hangs over a room's edge, the arm stayed short, so the tip
  stayed.

- **Aboard, it climbs over the shoulder** (`CLIMB`, `CameraRig.climb`; issue #234, from the v1.59 game audit): the
  ship's cockpit, the spot by the hatch and the spot by the bunk still had under 1 m of arm a tenth of the time, because
  a full turn a metre from a wall or a seat back brings any camera behind him in to the wall. Aboard (`indoor`), where
  the arm straight behind him would be short, the camera stands steeper instead: of a few pitches over the one you hold
  (0 to 1.05 rad more, never past 1.2), the least steep whose swept arm has 1.2 m of room (or the whole arm, if
  shorter), else the one with the most. It climbs up under the ceiling over his shoulder and looks down into the room,
  never crushed against the wall behind him nor looking into it; turned back to the room it comes level again (down
  only once the lower pitch has 0.15 m more room: no flipping), eased (`rate` 4/s), looked for every 0.05 s and 0.6 s
  ahead along a turn by hand, as the arm looks ahead. Aboard it replaces the short arm's tip (`SHORT_TILT`, which stays
  for the temples', the train's and the rest of the world's tight spots). The two points the scenes put him at moved
  into the room too: the bunk's (`bunkStand`, the prologue's waking) 1.3 m out from the alcove (0.62), the hatch's
  (`hatchIn`) 1.4 m in from the wall (0.9; the step-out's reach shortened to keep the same reach into the room).

  The probe (`tests/room-size.test.js`, "the ship's cockpit, hatch and bunk": the real rig through the built ship, a
  full turn by hand at 60°/s and four walks out and back, kept aboard):

  | spot | arm p10 (m) | pull-in p90 (m) | pops |
  |---|---|---|---|
  | the cockpit, between the seats (0, -8.1) | 0.76 → 1.27 | 1.04 → 0.56 | 0 → 0 |
  | by the hatch (`hatchIn`) | 0.88 → 1.14 | 1.02 → 0.61 | 0 → 0 |
  | by the bunk (`bunkStand`) | 0.67 → 1.35 | 0.88 → 0.55 | 0 → 0 |

  In the prologue the traveller no longer fills the right third of the frame by the alcove: the camera stands 1.5–1.9 m
  behind him, the room and the cockpit beyond him.

In a 4.2 x 5 m cabin (a turn by hand, walks to each wall and back, another turn: `tests/room-size.test.js`) the arm's
in and out summed over the walk went from 3.7 m to 0.7 m, its reversals from 0.17/s to 0, its flips in and out within a
third of a second from 8 to 0. The camera QC's train walks in node are as they were (train-walk, train-sleeper,
train-dining-turns and train-roof green; the free walk and the run red in node before and after, as noted above).

## Aboard, behind him and never through him (v1.71, issue #324; `BODY_CLEAR`, `bodyGap`, `heroCut`, `SHORT_LOOK`)

The author: "Walking in my ship the camera keeps tilting up and clipping through my character." The camera QC's new
`ship-walk` (the parked ship in the desert: round the main room, the cockpit, past the bunk, through the cabin to the
hold and back, then the stick alone toward the camera into the walls) found both: with a wall a metre behind him the
climb over the shoulder (`CLIMB`, #234) took the steepest of its steps, because each steeper one had a little more room
up toward the ceiling than the last, and the camera stood over his head looking straight down (the view pitched 1.2-1.4
rad, a fifth of the run), its arm cut to 0.15 m by the ceiling: in his head. The lens was in his body 21 % of the frames.

- **The climb counts only room that keeps the lens out of him**: a step whose lens (its arm as long as it has room for,
  up to `CLIMB.arm`) would be nearer his axis (his feet + `BODY_AXIS`, 0.2-1.75 m) than `BODY_CLEAR` (0.6 m, where the
  0.3 m near plane meets his shoulders) counts for none. And it never stands steeper than `CLIMB.max` 0.95 rad (1.2
  before): over his shoulder at a sensible height, not up under the ceiling over his head.
- **Where the lens must be in him** (his back to the wall, the camera between: no camera behind him has room), he is
  left out of the view: `heroCut` (`BODY_CUT`: in under 0.5 m from his axis, out past 0.58) sets `uHeroCut`, and his
  surfaces (`uCutMe` 1: markHero's copies and his gear's fluid materials, only his) put every vertex outside the view in
  the vertex shader; his shadow, drawn by the override, stays. A uniform, not a define (until v1.77 `S_HERO_CUT` and a
  discard): his copies share their programs with the materials they were copied from, 8-17 programs fewer a world, and
  no program carries a discard, so the world keeps its early depth test (issue #364).
  Not in a scene, photo mode or a game that takes the camera; `captureView` draws him whatever.
- **An arm cut very short looks along itself**: under `SHORT_LOOK` (0.3-0.7 m from the look point) the view turns to the
  arm's own direction (the yaw and pitch) instead of at the look point, where a shove of a few cm off the wall turned it
  by tens of degrees in a frame (2000°/s).

`ship-walk`, before → after: the lens in his body and drawn 21.1 → 0.2 % of the frames, him out of the frame 1.6 → 0.2 %,
the view steeper than 0.9 rad 23 → 0.9 %, the lens over his head 4.3 → 0 % (red → green; the camera QC's "in body"
measure, `LIMITS.body`, frames he is left out of not counted). `tests/room-size.test.js` ("a wall a metre behind him")
and `tests/camera-qc.test.js` hold it.

## The jets fly like a plane (v0.89, `src/player.js`: `JET`, `startJets`, `flyJets`, `jetSteer`, `jetStep`)

The author, after the Superman jets: "R2 should make me go high fast. Joystick should be for
direction, I should be able to fly in all directions, up, down, left, right. It should be like a
plane." The camera no longer steers the flight; the nose does.

**Controls.**

| | pad | keyboard and mouse | touch |
|---|---|---|---|
| thrust (the throttle) | RT / R2, analog: the harder, the faster | left click (not aiming), or SPACE held in the air: full | ⤒ held in the air: full |
| nose down / up | left stick forward / back | W / S | drag up / down on the left |
| bank and turn | left stick left / right | A / D | drag left / right |
| faster | L3 (run) | SHIFT | run toggle |
| hold still to shoot | LT / L2 in flight | right click (or R) in flight | ◎ |

- **Lift-off** (`startJets(true)`): RT on the ground (not aiming) lifts you off at `JET.lift` up,
  nose straight up (`JET.takeoff`), so holding it climbs fast and straight: about 9 m in the first
  second, 45–58 m in three (full throttle). That is also what the Warden's Well asks for (straight up
  through the oculus). Fired in the air (SPACE held after a jump, RT while falling) the nose is up too,
  unless you are moving across faster than `JET.carry` (6 m/s): then you keep your way, the nose along
  it and never below level.
- **The nose** (`jetSteer`, a pure function): the stick forward tips the nose down at `JET.pitchRate`,
  back pulls it up, between straight down and straight up (`JET.maxPitch`, no loops). That is a plane's
  and the bird's convention (forward dives); **Settings → "Invert the jets' pitch"** (`invertFlight`,
  `player.invertFlight`) makes forward climb. Left / right bank (`JET.bank`, eased at `JET.bankRate`),
  and the bank turns you (`JET.turnRate` at full bank), so a turn rolls in and out smoothly.
- **Thrust** (`jetStep`, pure): the speed along the nose eases (`JET.accel`, momentum) to
  `jetSpeed(T, …)`: `JET.speed` (22 m/s) times the throttle, `JET.boost` with L3 / Shift, up to
  `JET.dive` more nose down. A slip across the nose dies away at `JET.grip`, so a turn swings the speed
  round rather than losing it. Under thrust the jets hold you up (no sink). A light squeeze flies
  slowly: the nearest thing to a hover under your own hand.
- **Let go: a glide.** Unpowered, gravity along the nose slows a climb and speeds a dive, drag
  (`JET.drag`) slows you, and the faster you go the more of gravity's pull across the nose is held up
  (`JET.glideLift` at `JET.liftSpeed`). The nose droops into the fall (`jetDroop`, slowly while fast):
  from level flight at full speed a glide carries on about 3 m forward for every metre down. Too slow
  (`JET.stall`) and the flight ends: you fall, as off any ledge (and the wings open on a held jump if you
  have them). A pad's jump pressed while unpowered also ends it (a boost, then the wings); with the
  throttle on it does nothing (no charge spent).
- **Aim in flight: the jets hold you** (`player.jetHold`): LT / L2 (right click, R, ◎) while flying
  turns RT back into the shot. The jets bleed your speed away and hold you, sinking at `JET.hold.sink`
  (1.2 m/s), the arm up, for as long as you aim and there is fluid (`JET.hold.burn` of the burn). Let go
  of the aim and you fly on along the nose. That is how the bosses' "from above" phases are played.
- **The ground** (after the collision sub-steps): under thrust, nose level or up, touching the ground
  skims it (the nose lifts to 0.08 rad, off you go); nose down past `JET.land` or gliding, you land,
  and a landing on the jets counts as `JET.cushion` of its speed (a steep dive comes down on your feet).
  The trigger held through a landing lifts off again only on a fresh squeeze (`_jetLock`). Walls and
  ceilings slide you along them as before (the swept sub-steps); in flight the stick is not "into the
  wall", so you never grab a wall to climb at speed.
- **Fuel**: the burn is `JET.idle` + the rest times the throttle (a light squeeze burns 35–50 %),
  `JET.hold.burn` aiming; the tank's fluid as before (`FLUID.jet.drain` charges a second at full
  throttle). Dry, you glide.

**The camera** (`rig.follow`, main.js): while flying it comes round behind the nose like a ride's chase
(`jetCameraPitch`: looking up with a climb, down a dive; the right stick or the mouse take it for 1.5 s),
the arm `3.5 m + 0.12 s` wider with speed `s`, and it keeps the close-in framing where there is a ceiling
(`shot.keepTight`). When the chase ends (a landing, or the water, the wings, a wall or a ride taking over)
the pitch eases back to the on-foot framing (`rig.settlePitch`, `PITCH_SETTLE`: ~95 % in 0.75 s, done in
1 s): nothing on foot levelled it, so a dive left you looking at your feet. Turning the camera yourself
(the right stick, the mouse) before or after landing gives it up: the chase must actually
apply a pitch again after the 1.5 s manual grace before it can own another automatic return.
A new authored placement (`snapTight`, for example ship wake-up) also clears the old flight
return; yaw-only recentering leaves the chosen pitch alone. The same ownership applies to the pitched hoverbike chase on dismount. Shared web/Unity host transitions
at 30/60 Hz are covered in `tests/camera-handoff.test.js`, alongside `tests/jets.test.js`.

**The pose** (`jetPose(speed, pitch)`): the body leans along the nose about the hips (`JET_PIVOT`),
the more the faster: upright slow or climbing straight up (a rocket), flat out level, head first in a
dive; the bank rolls it about the spine (`rotation.y`, blended into a side tilt while upright).
`player.onJets` is the flying pose (the clips stand aside, the hands open: `hands.js` mode `jet`).

**Flames and sound**: `player.jetPower` (0..1, the burn) sizes the nozzles' fluid flames
(`FluidJets.update` `power`), the jet's light on nearby walls and the jet roar (`audio.js`).

Tests: `tests/jets.test.js` (the pure model: nose, steer, invert, speed, step, glide, droop, pose and
camera; the traveller lifting off and climbing, every way through the air, turning both ways and banking,
diving and pulling up, the glide and the stall, the wings, the aim hold, landing softly and the fresh
squeeze, skimming a slope, a ceiling and a wall, the burn, the keyboard and touch);
`tests/temples.test.js` flies up through the Warden's Well's oculus with them.

## Rising air: straight up (v1.42, `src/updraft.js`)

Every column of rising air shares one ride (`rideColumn`): the temples' `Updraft` (src/temples/pieces.js), Vael's wind
up the lone tower (src/story/arzach.js `windLift`), the trials' wind columns (src/trials/winds.js) and the City-Shaft's
air pillars (src/shaft-pillars.js). From the author (2026-10-10): "when in an air shaft I should go just up, not keep
going forward." A column runs after the traveller each frame: it eases his vertical speed toward its lift (`liftAt`:
full low down, nothing over its top `ease` m, so he hangs just under its top) and marks him (`P.updraft`, fresh for
`UPDRAFT.fresh` s). While the mark is fresh the glide (`Player.update`, the wings' branch) drops its forward run:
its flat velocity is `columnDrift`, the stick (camera-relative) at `UPDRAFT.steer` m/s plus, with the stick let go,
a pull onto the column's axis (`UPDRAFT.centre` 1/s); pushing the stick lets go of the pull, so he always gets out.
He turns to face the way he steers, and leaves at `UPDRAFT.exit` m/s, the glide taking up from there. Vael's tower
column keeps its crest: over its top quarter it lets go of the mark (`hold: false`) and turns him to the balcony.
Columns no longer move the traveller's position themselves (it went through collision): the pull is a velocity.
Tests: `tests/updraft.test.js` (the lift, the drift, no forward run once in, held at the top, steered out). Rising
air also holds the wings still enough to aim (`Player.hovering`: the gun's arm may come up, `FluidTool.bodyFree`
`{ hover }`, not the blade). The camera QC rides the City-Shaft's halfway pillar (`incal-pillar`, 18 m/s straight up,
the camera turned while rising, then steered out): green, no pops, one small kink (0.21 m) as the wings open, 0.8 cm rough.
Under a makers' roof the wings glide heavier, except in moving air (issue #436: docs/systems/gadgets.md, "The wings in the
makers' houses"); a column holds them `AIR_LEAD` m round it as well, so they open into it at full speed.

## Aiming straight up (`CameraRig.pitchUpLimit`, `PITCH_UP_AIM`)

Close in (tight spaces: most temple rooms, the ship), the look up is limited to
`PITCH_UP_TIGHT` (~36°), because a steep look up there only fills the view with the
ceiling. While aiming, the limit eases with `rig.aimK` to `PITCH_UP_AIM` (-1.5 rad, ~86°),
anywhere. The shot follows the reticle, so you can hit a switch or a guardian overhead.
The arm drops under the shoulder there, held off the floor by the rig's ground bisection.
Once you let go of the aim, the look eases back down to what fits, with the aim's own
easing.

## Ragdolls end on the ground (`src/ragdoll.js`: `Ragdoll.grounded`, `takeLanding`, `KNOCK.maxAir`)

The fall used to end after `KNOCK.maxFall` (3.5 s), wherever the body was. On a long drop
it then froze in mid-air and got up there. Now the fall ends only when the body is
`settled`, or after `maxFall` if it is `grounded` (a particle touched something in the
last `RAG.air` s), with `KNOCK.maxAir` (30 s) as the last resort. A landing after
`RAG.air` s of free fall is recorded (`takeLanding()`, m/s). The player hurts for it like
any hard landing (`Player.fallHurt`), so a fatal drop is fatal even when you tumble off
the ledge first. The camera keeps up with a body falling away from it: `rig.down`'s softer
follow is only for a body that stays close.

In the air the body keeps its momentum (issue #541). The joint limits (the knee's bend, the
head over the neck) move one particle at a time, and their pushes don't cancel out: over a
long tumble they used to swim the body sideways, up to 59 m off a 300 m drop and 15 m back
toward the ledge (where the test's ledge double caught it and it died mid-air, a CI flake).
Now a sub-step where nothing touched anything takes the change in the body's mass-weighted
velocity back out of every particle, so the whole falls as a thrown body would (the drag
alone slows it). `tests/ragdoll.test.js` checks it at 60 and 20 fps.

## The jump's shadow (`src/jump-shadow.js`)

When you're off the ground (jumping, falling, gliding, the jets; not riding, swimming,
climbing or knocked down: `wantsJumpShadow`), a patch of shade lies on the surface right
under the traveller. One downward ray a frame finds it (`physics.heightAbove` along the
player's up), and the patch tips to the surface's slope. It's drawn as this game draws a
shadow: a G-buffer decal multiplies the light term by 0, so the post pass shades, hatches
and inks it. The colour is darkened by `JUMP_SHADOW.dark` too, so it still reads on ground
already in shade. `jumpShadowRadius(h)` grows the patch in just off the ground, shrinks it
with height and removes it by `JUMP_SHADOW.far` (40 m). Standing, the real shadow does the
job. The mesh stays out of the shadow passes (`level.noShadow`).

## Ragdolls follow the ground's slope (`src/ragdoll.js` `Ragdoll.step`, `groundNormalAt`, `RAG.wall`; issue #214)

The author: "Ragdoll should follow physics. Right now it can ragdoll up a cliff?" It could: each particle was
pushed straight up out of the ground and kept that push as speed, and kept its speed along the ground, so a body
knocked into a terrain cliff slid up its face (20 m in 3 s from a 9 m/s knockdown in Vael). Now the ground under each
particle is a plane, the point under it and the ground's normal there (`physics.groundNormal` on level worlds, the
face a ray meets under any other up; found once a sub-step, only near the ground), and a particle in it is pushed out
of the plane: along the normal, or level off a face steeper than 60° (`RAG.wall`), never up it. What the ground and
the walls push is not speed: the velocity is the particle's own motion less those pushes, with what goes into the
ground or the wall taken away (a hard landing gives `RAG.bounce` back) and friction along the ground. The trunk's
capsule against walls works the same way (it used to keep a fifth of its push as speed). Tests:
`tests/ragdoll-cliff.test.js` (a ragdoll knocked into 50°, 72° and sheer faces at 3-9 m/s, with the heightfield's
blended normal too, ends no higher than it started, never climbs the face, settles; one into a wall stays this side
of it), `tests/ragdoll.test.js`.

### Refused browser mouse capture (#602)

The canvas click request handles both promise rejection and synchronous refusal from `requestPointerLock`, including embedded Chromium's `UnknownError`. It reports one console warning per camera rig and leaves the existing mouse-down/drag/mouse-up fallback intact. Browsers returning no promise and browsers without the API remain supported. No camera or input mode is forced on refusal.


## Aerie flight framing (#617, v1.96)

The Aerie authors a `glideCamera` shot on its temple definition: a 6.4 m arm at default zoom, with room-clearance probes retained. Shared `cameraFollow` applies it only while gliding inside that runtime’s bounds. The previous generic glide selected the 13.4 m outdoor chase and disabled those probes; the Wind Well’s broad interior left enough clearance for the full pullback. The existing distance easing and landing recovery remain, as do manual zoom, vehicle shots, jets and outdoor gliding. Both the browser and Unity use this shared camera path.

Validation uses real held glider input in both hosts. In the web comparison, identical 90-frame flights end airborne at the same position: camera arm 9.718 m before and 5.715 m after while easing toward the target. A separate four-second native flight measures 13.386 m before and 6.429 m after. Outside, both settle near 13.4 m. Web and native starts use their respective debug-progress fixtures, so these demonstrate the shared framing behavior rather than identical puzzle state or pixel alignment. The changelog pair is the matched web capture. The focused regressions cover authored-bound selection, other temples, landing, manual zoom, vehicles, and ascent through the real Wind Well geometry; raw pictures, per-frame traces, mute proof and native restoration hashes are retained in `.local-tools/validation/v1.96/aerie-camera-617/`.
