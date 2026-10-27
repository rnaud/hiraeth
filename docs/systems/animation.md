# Animation: climbing, locomotion, motion capture, hands and ragdolls

How characters move: the clip library, climbing IK, feet on the ground, motion matching, the Motion page, hands, ragdolls.

## Climbing and mantling

The mocap climb loops play by the direction you push: up, down, left or
right, with a hanging idle otherwise. The climber hugs the wall (hips about
0.27 m off it), and each hand and foot from the clip is ray-cast onto the
real wall surface, with two-bone IK pressing it there. Mantling plays the
ledge-climb clip timed to the pull-up, with the hands on the edge.

## Character animation review

With `npm run dev` running, open `/tools/rig-review.html`. Choose Walk, Jog,
Run, or Climb and step through the 120 samples with the slider or frame buttons.
Front, side and back views show the flat-coloured model with joint overlays;
**12-frame sheet** creates a downloadable contact sheet. This uses the game's
actual `Animator` and `Humanoid` classes, before terrain foot placement.
`tests/traveller.test.js` compares every gait phase to the source animation,
including hand direction, palm twist, limb lengths, boot pitch and loop seams.

The review also has **Face close-up** and **Face views** for head turnarounds.
To rebuild the face, run Blender with `scripts/refine-traveller-face.py --
input.glb output-directory`, then run `python3 scripts/merge-traveller-face.py
input.glb output-directory/character.glb public/anim/traveller.glb`. The second
step copies only the new facial meshes and preserves the shipped rig data.

The v0.27 equipment pass uses `scripts/refine-traveller-equipment.py --
input.glb output-directory`, followed by `python3 scripts/merge-traveller-equipment.py
input.glb output-directory/character.glb public/anim/traveller.glb`. Use the same
input for both commands. It rebuilds gloves, boots and the radio pack, smooths
local elbow/knee/hip weights, and preserves the original skeleton and animation
buffers. New parts are batched into nine meshes by material. Fingers have a
fixed relaxed pose; they do not have separate animation joints.

Desert materials opt into `sandInk`: broad flat color, sparse curved strokes
anchored to the surface, and existing slope/shadow hatching. Dot stippling and
round albedo flecks are disabled for these surfaces. Strokes fade when too small
to resolve, rather than growing into distant dots. Other terrain styles retain
their own settings.

## Ragdolls (`src/ragdoll.js`)

A ragdoll for the people's skeleton (`humanoid.js`), cheap enough for the
handheld: fifteen joint particles (pelvis, chest, head, hips, knees, ankles,
shoulders, elbows, wrists) moved by position-based dynamics in sub-steps of at
most 1/90 s. The trunk is held rigid, the limbs by their bone lengths, with a
few limits (knees bend forward only, thighs don't swing far behind the hips,
the head stays on the neck, elbows and knees never fold flat). Each particle
lands on the ground under it (a ray down from where it was, so nothing overhead
counts as ground, along any "up"), with friction that lets it come to rest on
slopes up to ~20°; the trunk is pushed out of walls as a capsule once a frame.
**One ray a particle a frame** (issue #450): `physics.groundHit` gives the
height and the ground's slope from the same hit (it was `heightAbove` and then
`groundNormal`, two rays along the same line), and on the frame's later
sub-steps a particle that has moved less than `RAG.reuse` (3 cm) across and up
since its ray reads the same ground: the hit's plane under where it is now (the
very height on level ground), or on a heightfield its own height and slope
(`physics.baseHit`, no ray); a wall-steep hit is cast again. A fall in the
desert, the City-Shaft and the Market is the same, frame by frame, as with two
rays a sub-step (under 0.01 mm apart, the same settling frame: the in-page
comparison in the issue), with 15–17 rays a frame instead of 59 (at 60 fps) or
89 (at 30); `RAG.reuse = 0` casts every sub-step again. `apply(humanoid)` turns the whole body with the trunk
and aims neck, legs and arms along their segments; `snapshot` / `blend` blend
any two poses.

`Knockdown` is the whole of being knocked over, for the traveller and for
people: the limp fall (blended in from the pose they had over 0.12 s), lying
a moment once still (`KNOCK.lie`), and the get-up (`KNOCK.rise`: a blend from
lying there into `Humanoid.kneel` that rises to standing, facing the way the
body lay). `toppleVelocities` starts it: everything carries on along the way it
was going and the top tips over that way, with a random little twist.

People: the fluid tool's push knocks a full NPC right over when it is close and
hard (`KNOCKOVER.strength`, the push's strength 1 point-blank .. 0 at the
cone's reach; at most `KNOCKOVER.most` bodies down at once); from further off
they stumble as before. Crowd people with a body of their own (the near tier)
go over too: `crowd.holdShove` keeps the person's place on the body while it
lies there, and once it is up they walk back to their spot. The instanced crowd
further off keeps its cheap stumble. Nobody seated or in conversation is
knocked over.

## Hands (`src/hands.js`)

The bodies have three bones a finger and a thumb (Quaternius' human, all skinned), but the clips
carry no finger tracks, so every hand used to hang in the T-pose's flat, straight shape. Now:

- **A pose** is 16 angles: each finger's three joints (knuckle, middle, tip), the fan of the fingers
  at the knuckles, and the thumb's roll (about the hand's long axis), in (toward the fingers) and bend
  (across the palm). `HAND_POSES`: `relaxed` (the arc at rest, each finger more curled than the last
  from the index to the little finger, the thumb in by the index), `open`, `splay`, `grip`, `fist`,
  `reins`, `hook`, `cup`, `flat`, `limp`, and the gestures `talk`, `point`, `pinch`, `claw`,
  `together`, `hold`. The axes come from each bone's rest frame (the palm's facing, the line of the
  knuckles), so both hands and both bodies take the same numbers. A rig whose finger joints are bent
  back at rest (the coral-shirt traveller's fitted hand) is straightened first (`J.zero`), so the
  numbers are each joint's bend from a straight finger; `fingerFlex(h, side)` reads each joint's bend
  back (+ toward the palm). See [characters.md](characters.md), *His fingers curl toward his palms*.
- **The context picks them** (`handTargets(ctx)`, pure): walking relaxed, opening as you run
  (`HANDS.runFrom`–`runTo`), gliding and the jets open, falling (after `airAfter` s off the ground)
  splayed, climbing a grip, the mantle flat, the hoverbike / skiff / taxi a grip, the bird the reins,
  swimming cupped, down limp, seated limp; on top, aiming the glove (the right fist, the left cupped
  under it), the hand-off (a grip), a held prop in the right hand (`PROP_GRIPS`: a staff gripped, a
  lantern or basket hung from the fingers, a flower held), a fright (splayed), and while someone speaks
  a gesture in the line's tone (`TONE_GESTURES`, the right hand leading, beating with the syllables;
  pointing and pinching are one-handed).
- **Blended**: each hand eases toward its mix (`easePose`, frame-rate independent; grabbing is quicker
  than letting go). **Secondary motion**: the fingers drift a little (less in a grip), and lag behind
  the wrist: a light damped spring driven by the wrist's acceleration across the palm.
- **Hooks**: `Humanoid` makes `this.hands = new Hands(this)` (the relaxed pose at once, so nobody's
  hands are flat even when not driven); `updateHands(dt, { player, npcs, camera })` once a frame in
  `main.js`, after the talking faces: the traveller (`playerHands`, his state read only), and the
  people within `HANDS.near` m of the camera (`nearLow` on the Handheld preset; `npcHands`), their tone
  from their talking face (`talkOf`). Further off the hands keep their last pose. The studio drives
  them from its own state; the title, the Motion page (`playerHands`, as the game) and the trailer
  (a pose by what the traveller does, the same at any seek) drive the traveller's.
- **The wrists** (`Humanoid.update`, `Humanoid.turnHand`): the retarget poses each hand at its rest
  turn on the forearm every frame (`wristOf`); a clip then sets the wrist (`poseHands`), aiming turns it
  along the line of fire, and the glide's spread arms (`Player.spreadArms`) turn it with `turnHand`:
  fingers on along the forearm, palms down, the thumb's edge a little up, blended in and out with the
  wings. The hand bone used to keep its local turn from the last frame, and the arms' IK (which keeps
  a hand's world turn) fed the forearm's change back into it: gliding, the hands spun about 10° a
  frame.
- **The forearms bend at the elbow** (`Humanoid.update`, `hingeElbows`; the coral-shirt traveller,
  October 2026, v1.6): each limb bone was swung from its T-pose direction on its own, so a forearm took a
  roll of its own, unrelated to the upper arm's: with the arm hanging and the forearm raised (the idle's
  gestures, a walk's swing) up to 75–90° off it, and the elbow, the forearm (his rolled sleeve) and the
  wrist wrung round like a sweet wrapper while the clip's wrist (`poseHands`) sat 60–90° off it, the hand
  turned on a pinched wrist. With `hingeElbows` the forearm swings from where the upper arm has carried
  it (the hinge's own axis), and `shareWristRoll` gives the forearm half of the clip's wrist roll (the
  radius rolls along the forearm; the hand's turn in the world is kept). Only for a body whose hands take
  the clip's turn (the traveller): the people's hands follow their forearms, and what they hold
  (`PROP_GRIPS`, Sefa's oud) was set on the old roll. `tests/hands-sleeves.test.js` measures it on the
  shipped body through the idle and its gestures, a walk, a run, a conversation and the title's stance:
  the hand to the sleeve's cuff (within 2.5 cm of rest: the rolled sleeve slides up to 2 cm as the elbow
  bends), the cuff on the forearm, the wrist's thickness (over 0.85 of rest; it was 0.77), the forearm's
  roll on the upper arm (under 40°; it was 83–93°), the wrist's (under 45°) and the wrist by the thigh
  (over 17 cm out from the hips' middle; the belt hook drew it to 13, below).
- **No belt hook for the traveller** (`Player.idleLayer`, `character.beltHook`): standing, the weight on
  one leg, a hand used to hook the belt; his belt is under the open overshirt, and the hook drew the hand
  across the front of the coat at the hip, the wrist bent in. The people and the old suited traveller keep it.
- `tests/hands.test.js`: the bones and the relaxed arc on a real body, the fist and the thumb, every
  pose / tone / prop covered, the pose per context, the blend, the easing, the drift and the lag, the
  game's contexts and who is driven, and the glide's hands holding still, palms down, through a turn.

## Locomotion: feet on the ground, starts, stops and turns (`src/feet.js`, `src/locomotion.js`)

The clip library's loops (walk, jog, sprint) blend by speed on one shared gait phase; everything
below is laid over them procedurally, so no new motion data was needed (see TODO.md).

- **The loops' own feet** (`analyseGait` in `src/animator.js`, once per library: `lib.gait`): for
  each loop and foot, a contact curve over the phase (on the ground: within 3 cm of its lowest and
  going back under the pelvis), how far each phase is from the next touchdown, and the loop's true
  stance speed (the planted ball relative to the pelvis; the old `lib.native`, the ankle's lowest
  30 %, read the jog and the sprint at half their speed and is kept only for the blend
  thresholds). `Animator.bindBody(humanoid)` scales them by the body's leg length.
- **Cadence and stride**: the loops sweep a planted foot back much faster than the game moves the
  body (the jog's stance is short, with a long flight). Each loop covers `STRIDE_K` of its own
  stride a step (walk 0.8, jog 0.55, sprint 0.75): ~1.2 cycles a second jogging at 3.8 m/s, ~1.5
  running at 7.2 (it was 2.4, a blur); `Animator.footSpeed` is the sweep at that cadence, and
  feet.js warps every foot's reach ahead of / behind the hips by body speed over sweep, so the
  clip's foot and the planted one move alike.
- **Planting** (`plantFeet`, by `Animator.contact`): the phase says when a foot is down, with
  hysteresis (on above 0.6, off under 0.35, and never while the contact is still rising), so a
  foot never flickers between held and free as poses blend. A foot coming down plants as it meets
  the real ground (a frame or two before the clip would), stops there at once, and in its last
  moments before touchdown is held back over the ground (by ≤ 14 cm: the loops' feet skim in); a
  held foot keeps its place and its way (yaw) and lies along the slope, the ball on the ground and
  the heel not in it; it lets go when the gait lifts it, when the body has left it out of the
  leg's reach, or 60 cm from the clip's foot. Letting go far from the clip's foot, it travels in a
  low arc. A free foot over a stair or kerb clears what is under its ball and heel (two short rays).
  The legs are solved from their rest pose (`legIK`: thigh and shin aimed as `Humanoid.update`
  aims them), so a held leg never picks up a sudden twist; the hips come down (≤ 26 cm) to reach a
  low foot.
- **Standing**: once the gait is under a quarter of the pose, a foot left too far from where the
  standing pose wants it (13 cm) or twisted too far (0.6 rad) takes a settling step there, one foot
  at a time (0.3 s, 7 cm up): the step after a stop mid-stride, the stepping round of a turn on the
  spot. A fast turn at low speed is a **pivot** (`Locomotion.pivot`: over 3.2 rad/s under 2.6 m/s):
  both feet stay down whatever the phase says, the more settled one turns on its ball and the other
  steps round quickly (0.17 s). A standing foot left out of reach of its place (a 180° pivot) steps
  there once the other is down, instead of jumping there in a frame; a settling step up onto a stair
  rises first and then goes over, so the toe doesn't drag up the riser.
- **The foot's way** (`footWay`): the foot bone's own turn applied to its rest way (the rest ankle →
  ball, laid flat), not the ankle → ball line itself. The coral-shirt traveller's ankle sits high
  over the ball, so that line is steep: a little roll of the foot swung its flat part through tens of
  degrees and its flatness hovered at the 0.6 threshold, the way flipping between the foot's (47°
  out) and the body's from frame to frame. The held foot snapped round (50 rad/s in a frame) and took
  a settling step every second or so: the "twitching leg" at idle.
- **The idle layer's weight shift** (`Player.idleLayer`): the hips go over the standing leg (they
  went over the free one, so the free knee bent to 60° and the support leg ran out of reach) and the
  free thigh comes forward as its knee bends, so its foot stays where it is planted (it swung back
  25 cm and stepped there and back every 8 s). `tests/idle-legs.test.js` stands the shipped
  traveller still for 20 s: no leg bone turning over 2 rad/s, no settling step, the balls within 3 mm.
- **The stance** (`Player.standUnder`, in the idle layer): the idle clip stands split and wide (the
  left foot 13 cm ahead of its hip, the right 26 cm behind, both well out), which side on reads as a
  stride; the drawings stand the traveller upright, feet under the hips. Each thigh swings its ankle
  in (`IDLE_STANCE`: 30 % of the fore-aft offset kept, 40 % of the outward one) and the body rises by
  what the legs gained, so the knees keep the clip's bend. A body that starts standing starts in this
  stance (no settling step at the spawn); stopping, the feet settle into it with a step. The head is lifted over the clip's (`IDLE_HEAD`, 0.2 rad): the idle
  clip looks 15° down, at the ground; he now looks a few degrees down on average, ahead as drawn.
- **The head on the neck** (`char.headNod`, `Animator.apply`, `HEAD_NOD`): the rig's head joint takes the
  library neck's line (and `neck_01` with it), and a child of it the clip's own head turn, which the
  `Head` bone follows. With the neck's line alone the face followed the neck: the jog and the sprint
  lean the neck 35–50° forward while the captured head stays up (about 20° down), so he ran looking at
  his feet (35° down jogging, 48° sprinting; now 21 and 23); the look-around's head turn came through
  only as the neck's. On foot only (idle, walk, jog, sprint, talk, look-around, by the actions'
  weights): on a ledge, climbing, in the air and seated the neck's line is kept, as the tipped-back
  head would meet the pack behind it. Only the traveller's rig has it.
- **The body** (`Locomotion`, after `Animator.apply`): the chest tips forward as the body speeds
  up and back (the hips dipping) as it brakes, banks into a curve by turn rate × speed, and the
  head and then the chest turn toward where you steer before the hips get there.
- **Stairs**: the drawn body follows a sudden change of floor height over ~0.1 s (`StepLag`, the
  rise between frames along the local up, so turning gravity doesn't trigger it); the feet stay
  planted on their steps.
- **Responsiveness**: none of this changes where you go or how fast you turn: velocity and
  heading are as before (facing back after a sharp turn at a run: 0.30 s, as before).

**The people** (`src/npc.js`): each has a gait style (`gaitStyle`, seeded by who they are, from
their build, kind and size): stride (heavy shorter, slim longer, now and then an older walker's
shorter, slower, bent one), the hips' bob and roll, the chest's lean, the chin, the pace, a slow
drift of the cadence, and where in the cycle their loops start (`Animator.offsetLoops`), so
people side by side neither step nor breathe in time. Within 22 m (`NPC_DETAIL`) their feet are
planted and the body leans, banks and looks into its turns; standing, they turn no faster than
2.6 rad/s and step round as they do. The crowd's near tier gets the same.

**By distance**: a person is posed every frame within 30 m, every 2nd frame to 60 m, every 3rd to
110 m (they move every frame), past that the whole update a quarter of the time (as before); and
their body draws a simpler mesh (`src/skinned-lod.js`): the static levels' clustering
(`lod-core.js`) with each cell's bone weights merged (`mergeSkin`: summed per bone, the four
strongest kept), so a level is still skinned on the same skeleton and bends with it. Levels are
picked by the preset's `lodPx` rule (cells of 1/64 to 1/8 m), built in the levels' worker, shared
per geometry (the builds' shapes are shared); past 1/16 m cells (an eye under half a pixel) the
eyes and brows are hidden. Anything that reshapes a body (a build, a face, a costume) first puts
the full meshes back (`Humanoid.lod.reset()`). The body: 12 566 triangles, 8 137 at 1/64 m, 4 500
at 1/32, 1 437 at 1/16, 513 at 1/8; a dressed bazaar person 13 422 → 8 992 at 30 m, 5 050 at 60 m,
1 929 at 120 m, which look the same at those distances.

**Measured** (`tests/gait-sim.js` drives a headless traveller through scripted input on a course
of flat ground, a 12° ramp and 18 cm stairs; `tests/locomotion.test.js`). Before (build `7aafb48`)
→ after; slide = how far a foot moves over the ground while within 3 cm of it (touchdown and
lift-off included), held = how far a planted foot moves over its hold, sink = deepest sole under
the ground, jerk = the head's world jerk (RMS):

| Run | slide max / mean (m) | held (m) | sink (m) | head jerk (km/s³) |
|---|---|---|---|---|
| walk → run → 180° turn → stop | 1.96 / 0.49 → 0.16 / 0.05 | 0.009 → 0.003 | 0.10 → 0 | 4.6 → 2.6 |
| walk, 90° turn, stop | 0.84 / 0.38 → 0.23 / 0.04 | 0.003 → 0.008 | 0.06 → 0.01 | 1.3 → 1.3 |
| turn round on the spot | 1.16 / 0.47 → 0.07 / 0.02 | 0.004 → 0 | 0.10 → 0 | 3.3 → 1.6 |
| up the ramp, stand | 0.46 / 0.34 → 0.08 / 0.03 | 0.019 → 0.008 | 0.03 → 0.01 | 1.3 → 1.4 |
| stairs up, stand, down | 0.62 / 0.39 → 0.11 / 0.03 | 0.031 → 0.004 | 0.14 → 0 | 18.8 → 2.5 |

The biggest bone turn from one frame to the next stays under a radian (0.8 rad at a sprint, as
before).

The people's animation CPU, in Node (12 walkers from 4 to 150 m, 900 frames, two runs each):
0.67–0.74 → 0.62 ms a frame; a person within 22 m costs ~85 µs instead of ~65 (the feet, the lean),
at 40–55 m ~34 instead of ~64, at 70–90 m ~23, past 110 m ~6 instead of ~16. In headless Chrome
(Metal, 1600 × 900, High, at the spawn, two runs each, alternating builds): the Bazaar (seven people
shown, six within 60 m, four of them the crowd's near tier) 6.5 / 6.6 → 6.4 / 6.6 ms a frame, the
people's update 1.0–1.4 → 1.2–1.5 ms (the planted feet of the six near ones; within the run-to-run
noise of the page); the City-Shaft (two people near, the rest far) 12.9 / 13.4 → 10.0 / 13.2 ms, the
people's update 0.32 / 0.33 → 0.16 / 0.16 ms, and their bodies 53.9 k → 14.7 k triangles (four of
eleven on a level). On this Mac the frame is bound by draw calls and fill, so the triangles don't
show in the frame time; the handheld is still to measure.

**What a world costs to open** (`node scripts/bench/web-load.mjs`, the companion to `web-bench.mjs`,
which measures the frame): the production build in headless Chrome on the real GPU (ANGLE on Metal,
an M4 Pro), 1280 × 720, the High preset, no vsync and no frame-rate limit, three runs a world, the
JS heap read after a forced collection. 19.0 MB goes over the wire whatever the world: the worlds are
built in the page, so what is downloaded is the bundle, the bodies and the clips.

| world | people (story + crowd) | world ready | JS heap | geometries / textures / programs | frame |
|---|---|---|---|---|---|
| the Signal Market | 586 (15 + 571) | 1.19–1.32 s | 140–147 MB | 1 310 / 70 / 63 | 11.4–11.6 ms |
| the desert | 159 (27 + 132) | 2.26–2.35 s | 209–210 MB | 1 701 / 106 / 77 | 12.2–12.3 ms |
| the City-Shaft | 1 390 (12 + 1 378) | 5.24–5.45 s | 299–300 MB | 1 411 / 59 / 65 | 14.0–14.5 ms |

The crowd is what the load and the heap follow: the City-Shaft's 1 378 crowd people take it to 5.3 s
and 300 MB. The desert loads fewer people but holds more than the Market: its terrain, its landmarks
and its collision (230 k triangles in the BVH since the contact audit's second pass,
docs/systems/movement.md) are the heaviest of the three. The first frame is on the screen in 15–49 ms
either way: the title and the sky draw before the world is built.

The same measurements on the handheld are still to take: `scripts/bench/android-run.sh` wants a
device over USB, and none has been attached since this was written.

## Foes' legs: the locomotion kit (`src/motion-kit/`, v1.7)

The traveller's and the people's feet are planted by `plantFeet` (above); the foes' by the locomotion kit, the
same idea for any number of legs: a gait planner (homes, step triggers, gait groups, one ground ray per step),
two-bone IK with a body-fixed pole, the body riding on its feet through second-order springs, key poses blended
by the foe's state, and detail tiers by distance. The crabs, the hounds, the newts and the machines are on it;
how it works, the body plans and the measurements are in docs/systems/procedural-animation.md, §6.

## Vael's bird: standing, folding, flying (`src/bird.js`)

She stands tall on long wading legs (drumstick, hock, tarsus, three toes and a back one), as the Sky Stones'
sheets draw her: `FOOT` is the middle toe's base on the leg, `STAND` the height her body rides over the
ground (the legs' reach and a toe's thickness), used wherever she is put down, landed or held over the ground.
Her wings' pose is one function, `poseWings(wings, fold, flap, amp, flare, flapPower)`, shared with the
reference views: spread (fold 0) they beat; folded (fold 1, `FOLD`) each arm rolls about its own length,
sweeps back along her flank, its feathers drawn in to half their depth and the hand to a third of its size,
so the folded wing lies against her side and ends at her tail (the shoulder turns in YXZ order for that:
roll first, then sweep). Vael's bow (`src/story/arzach.js`) opens the fold the same way. `tests/birds.test.js`
holds a standing bird's wings within a hand of her side and her feet on the ground; `tests/nightly/references.test.js`
holds every Vael II view's bird either on its feet (standing) or well clear of the ground (flying), never a
flying pose hovering just over it.

## Motion capture: the people's own walks, and motion matching (`scripts/mocap/`, `src/motion-match.js`)

Motion-captured takes from the CMU database (and, once downloaded, Mixamo's: docs/mixamo-shopping-list.md),
turned into clips of the same skeleton as the library's so the same Animator, retargeting and feet
play them. Sources, take ids and terms: docs/motion-data.md.

**The pipeline** (Node; re-runnable, same input same bytes):

```
node scripts/mocap/fetch-cmu.mjs           # the takes in cmu-takes.json -> data/mocap/raw/cmu/ (git-ignored)
node scripts/mocap/build-library.mjs       # -> public/anim/walks.glb, public/anim/locomotion.glb
node scripts/mocap/build-library.mjs --stats   # what each take became, nothing written
node scripts/mocap/compare.mjs             # the traveller, matching off / on (tests/gait-sim.js)
node scripts/mocap/compare-people.mjs      # a person on each captured walk
```

- **Reading** (`asf-amc.js`, `bvh.js`, `fbx.js` → a *take*, `take.js`): CMU's own ASF/AMC (forward
  kinematics: rotations about x, y, z in the bone's axes, lengths × 2.54/100/0.45 m), any BVH
  (three's BVHLoader; the cgspeed CMU names and Mixamo's are mapped, `maps.js`), Mixamo's FBX
  (three's FBXLoader in Node, with the world exporter's DOM stub, `scripts/unity-export/shim.mjs`;
  the `mixamorig:` prefixes dropped). Every bone's world rotation relative to its rest pose and
  every joint's place, turned upright facing +z.
- **Retargeting** (`retarget.js`) onto the UAL skeleton: each bone takes its source's rotation
  relative to rest (the twist), then is swung to point exactly where the source's does (the
  Animator reads directions); scaled by leg length; the floor set by the ankles and each foot
  pitched by the difference between the two skeletons' flat feet (a captured ankle sits ~5 cm over
  its sole, ours ~10: matched as they were, our heels sank 4 cm); the head and shoulders, which
  the game never reads, stay at rest and aren't stored. The motion splits into a root (under the
  hips, facing their way, smoothed; standing takes far more, so a weight shift doesn't slide the
  feet) and an in-place pose.
- **Cleaning and tags** (`process.js`): resampled to 30 fps; split where the capture glitches;
  long still ends trimmed; foot contacts labelled (the ball within ~2.5 cm of its floor and still,
  with hysteresis, short blips removed); a steady walk's best cycle found (touchdown to touchdown
  of a foot, where pose and speed agree), its end blended into its start; speed, turn per clip.
  Mirroring (left and right swapped, x flipped) is done when the game loads them.
- **The files** (`glb.js`, glTF 2.0): rotations as normalised 16-bit integers (three dequantises
  them), one long animation per kind with `extras.segments` saying where each clip starts (many
  short animations made the JSON 440 KB), contacts as base64 bytes. `walks.glb` (12 walks, 81 KB)
  and `moves.glb` (the traveller's own moves, 11 Mixamo clips, 349 KB) load with the game;
  `locomotion.glb` (the matching database, 108 clips, 267 s, 1.39 MB) only when matching is on, and
  in the character studio, which lists every clip (`mm:` and `walk:`).
- **Mixamo's FBX** (the first batch, 2026-10-07: 36 clips; `mixamo-clips.json` is the table): what
  it took to bring them in. The take is stood up by the file's rest pose (its T-pose), not by its
  first frame: a run's first frame leans 25° into the stride, so its travel went up into the air
  and its feet never touched the floor it was measured against (every run had no contacts), and a
  get-up's first frame lies down. Sampling holds the clip at its end (`LoopOnce`): a repeating
  action at t = duration wraps round to frame 0, which put the first pose on the last frame (a 10 m/s
  jump back at every clip's end, a stop that ended back where it started). Their clips are single
  moves, many under a second (a run cycle 0.6 s, a turn on the spot 1 s): kept down to 0.5 s; a
  turn on the spot is motion, not a still end to trim (`cleanClip turnMoves`); a loop is the whole
  clip less its last frame (`wholeLoop`). A clip of its own (`use: clip`) holds its root still
  (`root: 'fixed'`, or `'end'` for a get-up: where it stands up), so the hips' sway and a get-up's
  rise stay in the pose instead of sliding the feet, and it keeps the head's own turn (`Head`), which
  the database leaves out. Two uses at once: `mm+clip`. A row's `until` ships only its first so many seconds
  (the blade's jump attack: 1.5 of its 2.2 s; the rest is never played).
- **The blade's attacks** (v1.3, docs/systems/foes.md): the Great Sword pack's slash (`gs_slash_1`, the charged
  cut, 1.1 s) and jump attack (`gs_jump_attack`, the air cut) joined the Sword and Shield pack's cuts in
  `moves.glb` (`node scripts/mocap/unpack-packs.mjs && node scripts/mocap/build-library.mjs --add
  gs_slash_1,gs_jump_attack`): 597 424 → 621 644 bytes (+24 KB, 4 %; gzip 400 686 → 414 522). Their times
  were read off the traveller in the game (the blade tip's speed through each clip), not off the studio.
  `Animator.playCombat` takes a `blend` (s, default 0.09) for a move's way in (the charge's draw: 0.2) and
  `ground` (the air cut); `blendCombat` now holds every joint of the library's skeleton (plain nodes, not
  Bones: it had held none, so nothing blended).
- **The heavy third swing** (v1.39, docs/systems/foes.md): the Sword and Shield pack's slash 5 (`ss_slash_5`, `--add ss_slash_5`):
  645 908 → 657 668 bytes. Attack 1 stays in the library (the shade's strike). The tip peaks at 37 m/s at 0.56 s.
- **The blade's counters** (v1.4, docs/systems/foes.md): the Sword and Shield pack's slash 4 (`ss_slash_4`, the
  riposte, `until` 1.8 of its 2.4 s) and attack 2 (`ss_attack_2`, the dash cut, `until` 1.05 of 1.3 s), with
  `--add ss_slash_4,ss_attack_2`: 621 644 → 645 908 bytes (+24 KB, 3.9 %; gzip 412 874 → 427 094). The blade tip
  peaks at 33 m/s at 1.39 s (riposte) and 43 at 0.56 (dash cut). Slash 4's chop lands 75° to the body's right,
  so the riposte turns him into it (`RIPOSTE.turn`; `Player.faceAim` skips its walking lead for an aim with
  `lead: false`). The pack's kick moves no blade; its slash 2, 5 and attack 3, 4 were measured and left as refs.

**The traveller's moves** (`Animator.play(name, t, w, { full, ground, head })`, `moves.glb`): a
clip laid over the whole blend for a frame, by its weight; `full` (lying, kneeling, getting up) has
the body follow the clip's hips all the way and turn about them (the walk takes 0.6 of their sway
and half their turn, about the feet: a body lying down went a metre to the side, into the floor),
`ground` leaves the clip's own rise off the floor out (in the air the controller flies the body),
`head` turns the head on the neck as captured. The feet take the move's own contacts. The Motion
page's **Moves** mode plays each on the traveller and on a MakeHuman person, with a scrubber, and
`motionPage.sheet()` makes a frame strip of it (or of a scripted run in the other modes).

**The traveller's captured moves** (2026-10-07, `moves.glb`; with the starts, stops and turns,
switched off by `?moves=0` and the dev menu, which leaves the loops, the kneel and the jump's own
layers as they were). Strips of each are made on the Motion page (`motionPage.sheet`, with `setup` /
`at` hooks for a knockdown, a jump or a gesture on the way):

- **Getting up** (`src/ragdoll.js`: `GET_UP`, `lyingOn`, `Knockdown.chooseGetUp`, `getUpPlacement`):
  face up (the trunk's front, left hip x chest, toward the sky) the get-up from the back, else from
  the stomach; the part of each from its first stir to standing (back 2.65–5.55 s, stomach
  1.35–5.45 s: past that the clip's fists come up into a guard) at twice its pace: 1.45 s and 2.05 s
  (the kneel was 1.25 s). Before it starts the clip's first frame is posed on the Animator and turned
  and placed so its hips-to-head lies along the ragdoll's pelvis-to-chest, its hips over the
  ragdoll's pelvis (the root moves to there, pushed out of walls as before); the ragdoll's pose is
  blended into it over 0.3 s, and once up its last frame eases out over 0.35 s. People
  (`NPC.updateDown`) get up the same way. `tests/getup.test.js`.
- **In the air** (`src/air-moves.js`, `AirMoves`, Player.animateClips), each played by the flight
  (the share of it done) with its own rise off the floor left out (`Animator.play` `ground`), the
  jump's procedural layer kept at 40 %: a jump over 1.5 m/s the running jump (take-off to touchdown,
  then its landing at 1.2x); a standing jump its landing only, from touchdown (the game's jump goes
  2.6 m up, four times the capture's straight-legged reach, which held through the flight read as
  floating); a drop of over 0.22 s in the air under 3 m/s the 4-foot drop's landing, from 0.25 s
  before touchdown; kicking off a wall (`_wallKick` from `updateClimb`) the wall jump's push and
  flight at 1.5x; landing over 15 m/s down at over 2.6 m/s (and under the knockdown's 32) the
  stumble, above the legs. `tests/air-gestures.test.js` (with the path unchanged).
- **Idle variants** (`Animator.idleMoves`, `IDLE_VARIANTS`): standing 7 s, Mixamo's looking about,
  then its breathing idle, then the library's look-around, 10 s apart, above the legs (`legs:
  false`), the head's own turn kept and the idle layer's glances eased off meanwhile;
  `tests/idle-legs.test.js` stands him 36 s with them: no twitch, no step, the balls within 3 mm.
  The head's own turn is held within a neck's reach (`HEAD_TURN`, `limitHeadTurn`: 60° about the
  neck, 34° off its line, eased in past 60 % of each): the clip's head is read in the world, so it carries
  the chest's and the neck's twist, which our chest and neck (following only the spine's and neck's
  lines) don't take; in the looking about the whole of it landed on the skull, 105° round on the neck
  (the jaw into the shoulder, the face stretched: "his mouth opens wide and his neck moves strangely"),
  and 30° down on a neck already bent 46°. `tests/idle-legs.test.js` plays all three idles: the face
  stays under 80° from the chest.
- **Gestures** (`Player.gesture(kind)`; `src/interact.js` `gestureOf`): using something whose prompt
  picks up or takes something under 1.1 m over the feet kneels (Mixamo's kneeling inspection, the
  feet let go to follow it, `play` `free`), *pet* kneels and lays the petting's reaching arm over it
  (`Animator.playUpper`: a second move above the legs); in over 0.45 s, held 1.1 s (petting 1.8),
  out over 0.5 s, walking off ends it; an interactable may name its own (`gesture`). Mixamo's
  petting is of a tall animal (the arm out at shoulder height): kneeling brings the hand to a dog's
  head.

**What it costs**: nothing measurable. In headless Chrome at CPU x4 (the Handheld preset, the desert,
walking, stopping, turning and jumping for 15 s; `?moves=1` against `?moves=0`, two runs each) the
player's whole update was 1.43 / 1.71 ms a frame with the moves against 1.64 / 1.76 without, the
Animator 0.21–0.25 against 0.22–0.26 ms; in Node (the gait harness, the coral-shirt traveller, three
runs each) 2.26–2.34 against 2.27–2.35 ms. `moves.glb` is 446 KB, loaded after the game starts (607 KB with the blade's attacks, v1.3).

**The people's walks** (`Animator.useWalk`, `locomotion.js walkFor`): a nearby person may walk one
of twelve captured walks instead of the library's: picked (seeded, like the rest of their gait) among
those whose own pace is within 0.8–1.25 of theirs, an older walker's, a heavy build's, a woman's or a
child's when one suits them; the cycle's feet are measured as the library's (`gaitOf`) with the
contacts labelled on the capture, its stride taken as captured, and its phase shifted so its feet
come down when the library's loops' do (it blends with the jog). Captured feet swing low, a
centimetre or two over the floor as people's do; while one leads they are lifted to clear 4.5 cm
(feet.js `minClear`). In the Bazaar 5 of the 12 people walk captured walks. A person walking straight
at their pace (`compare-people.mjs`; slide = a contact's travel over the ground, as below):

| Walk | slide max / mean (m) | held (m) | sink (m) |
|---|---|---|---|
| the library's | 0.005 / 0.001 | 0.004 | 0.001 |
| CMU normal walks (136_20, 91_29, 82_10, 137_29) | 0.03–0.05 / 0.03–0.04 | 0.004–0.03 | 0.001 |
| strong man, teen, relaxed, childish, heavyset, confident | 0.06–0.11 / 0.03–0.06 | ≤ 0.006 | ≤ 0.002 |
| elderly man (only for slow walkers) | 0.15 / 0.07 | 0 | 0.001 |

**Motion matching for the traveller** (`src/motion-match.js`; off by default: the dev menu's
*Motion matching* switch, or `?mm=1`). Every frame of the database and its mirror image (12 118
frames) has a feature vector: both ankles' places and velocities and the hips' velocity in the body's
frame, and the body's place and facing 1/3, 2/3 and 1 s on (normalised per group; weights 0.75,
1, 1, 1, 1.5). The query takes the pose half from the frame playing and the future from the
stick, through the same spring the controller moves by; every 0.1 s, or at once when the stick turns
past 0.6 rad, a scan (16-frame blocks skipped by their bounds; ~0.01–0.03 ms a frame on average)
finds the closest frame, and the jump there is inertialised (the pose's and velocities' difference
decays over a 0.09 s half-life). It keeps playing unless a frame is clearly better, never jumps a
step back in the same take or flicks to its mirror, and frames in a clip's last second cost more.
Playback is speed-warped (×0.75–1.6) so the clip's feet sweep at the body's speed, and the feet
plant on the real ground as before (feet.js, with the clip's contacts). It never moves the body, so
the controls answer as before. Where the database has nothing close (a sprint faster than any
capture, a start quicker than anyone sets off, the air, climbing, talking) the loops take over.

After releasing movement, matched stops have 0.35 s below 0.15 m/s with no steering or wanted
motion before their weight fades back to the standing loops (#597). Without this hand-back,
speed warping could freeze a moving capture at playback rate zero while its pose features and
search hysteresis kept it selected at full weight, hiding an otherwise complete idle blend.
The existing exponential blend preserves the stop transition; re-entering matching starts from
the displayed loop pose. Actor planar speed and movement intent prevent a held input against a
wall or continuing movement from counting as settled rest. `tests/motion-matching.test.js`
checks repeated short walks at 30/60/120 fps, actual leg/arm bone hand-back, restart and intent
exclusions. The shared Animator path is used by web and Unity.


Measured with the harness above (`compare.mjs`, slide max / mean, held, sink, head jerk km/s³):

| Run | loops (the default) | motion matching |
|---|---|---|
| walk → run → 180° turn → stop | 0.16 / 0.051, 0.003, 0, 2.6 | 0.27 / 0.086, 0.012, 0.001, 3.2 |
| walk, 90° turn, stop | 0.23 / 0.029, 0.002, 0, 1.3 | 0.61 / 0.118, 0.012, 0.001, 2.2 |
| turn round on the spot | 0.07 / 0.019, 0, 0, 1.6 | 0.05 / 0.020, 0.002, 0, 1.5 |
| up the ramp, stand | 0.08 / 0.032, 0.008, 0.011, 1.3 | 0.27 / 0.072, 0.012, 0.006, 2.0 |
| stairs up, stand, down | 0.11 / 0.031, 0.004, 0.005, 2.4 | 0.34 / 0.104, 0.012, 0.18, 3.2 |
| slow walk, stop | 0.11 / 0.036, 0.019, 0, 1.2 | 0.71 / 0.097, 0.015, 0.002, 1.5 |
| jog, 45° and back, stop | 0.08 / 0.019, 0.005, 0, 1.3 | 0.27 / 0.106, 0.024, 0.001, 2.2 |
| stand still 6 s | 0.01 / 0.007, 0, 0, 0.03 | 0.05 / 0.020, 0, 0, 0.6 (a captured idle sways) |

By phase, the matcher ties the loops on a steady run (0.16 / 0.07 against 0.16 / 0.08) and through
the 180° turn at a run, matches them turning on the spot (fewer bone flicks: 0.46 rad against 0.58
a frame), and stops from a slow walk with less slide (0.05 / 0.02 against 0.11 / 0.05); it loses at
every start (the controller reaches 3.5 m/s in 0.3 s, no captured start does: 0.27 against 0.08),
on 90° turns while walking (no capture turns that tight), and on stairs (a captured stride puts a
foot under the next step's riser, and a heel kick flips a shin: 2.9 rad in a frame). The turn
response is the same (0.30 / 0.33 s). So the loops stay the default; the matcher is there to look
at, and for Mixamo's starts, stops and turns (the shopping list) to fill its gaps.

**With Mixamo's starts, stops and turns** (2026-10-07: the database 75 → 108 clips, 202 → 267 s),
measured again, on the game's coral-shirt traveller this time (`BODY=v1 node scripts/mocap/compare.mjs`;
slide max / mean m, head jerk km/s³, the biggest bone turn rad a frame, and how fast the pose answers:
*step*, s from pushing the stick while standing to a foot off the ground; *settled*, s from letting go
to both feet held):

| Run | loops | loops + captured moves (the default) | motion matching |
|---|---|---|---|
| walk → run → 180° turn → stop | 0.11 / 0.051, jerk 3.51, bone 0.84, step 0.13, settled 0.95 | 0.11 / 0.051, 3.35, 0.84, 0.13, 0.95 | 0.25 / 0.083, 3.94, 0.84, –, 0.88 |
| walk, 90° turn, stop | 0.08 / 0.016, 1.31, 0.41, 0.13, 0.90 | 0.08 / 0.016, 1.36, 0.41, 0.13, 0.90 | 0.34 / 0.101, 2.18, 0.70, –, 1.10 |
| turn round on the spot | 0.09 / 0.025, 1.38, 0.61, 0.07, 0.50 | 0.09 / 0.025, 1.28, 0.61, 0.07, 0.50 | 0.15 / 0.065, 2.21, 0.44, 0.08, 0.32 |
| up the ramp, stand | 0.06 / 0.022, 1.32, 0.80, 0.13, 0.90 | 0.06 / 0.022, 1.42, 0.80, 0.13, 0.90 | 0.25 / 0.059, 2.17, 0.71, –, 1.10 |
| stairs up, stand, down | 0.07 / 0.022, 2.41, 0.76 | 0.07 / 0.022, 2.48, 0.76 | 0.26 / 0.085, 3.31, 2.57 (sink 0.18) |
| slow walk, stop | 0.05 / 0.024, 0.97, 0.51, 0.17, 0.87 | 0.05 / 0.024, 1.25, 0.51, 0.17, 0.87 | 0.23 / 0.054, 1.53, 0.52 |
| jog, 45° and back, stop | 0.07 / 0.019, 1.36, 0.53, 0.13, 0.90 | 0.07 / 0.019, 1.41, 0.53, 0.13, 0.90 | 0.60 / 0.097, 2.22, 0.57, –, 0.58 |

(The matcher's *step* is none: its captured idle sways a foot over 3 cm all the time.) The matcher
still slides two to five times as far: the game's walk is 3.8 m/s, a jog, and its run 7.2, faster
than any of Mixamo's walking starts and stops (about 1 m/s) and runs (4–5.4 m/s), and the controller
reaches its speed in 0.3 s. So the loops stay the default (`?mm=1` and the dev menu still switch the
matcher on), and the new clips go into the conventional system instead, as below.

**Captured starts, stops and turns over the loops** (`src/loco-moves.js`, `LocoMoves`; on by default,
`?moves=0` or the dev menu's *Captured starts, stops and turns* for the loops alone; the Motion page's
*Starts, stops, turns*). At the moments the loops can't show, a Mixamo clip (in `moves.glb` as well as
the database: `mm+clip`) is laid over them, played *by* the body's own motion rather than the clock,
each frame's time held within a range of real time so it never stalls or races, eased in over 0.1 s
and out over 0.2 s:

- setting off from standing at a walk, the stick part way (`start_walking`, every other one mirrored):
  by the distance walked (at the full stick the game's walk is a 3.8 m/s jog, too fast for it);
- letting go of the stick over 0.9 m/s (`stop_walking`, `run_to_stop` from 2.8 m/s): by the distance
  left (the speed over the controller's braking, 16/s), on whichever version has the foot down that
  the loops have down;
- turning on the spot by over 43° (`left_turn_45`, `_90`, `_180`, mirrored for the right): by the
  share of the turn done;
- turning back at a run over 4.2 m/s (`running_turn_180`, mirrored for the left): likewise.

Laid on whole (its legs and contacts driving the feet), each of them measured worse than the loops:
a start at the game's walking speed ran its clip at three times its pace and the feet slid 0.72 m
(the loops: 0.08), a stop re-stepped into the clip's braking stance (0.54 m), a turn on the spot took
twice as long to settle with twice the slide. So each is laid on *above the legs* (`Animator.play`
`legs: false`, `overlayMove`: the spine, arms and head turned toward the clip's by its weight after
the mixer; the pelvis, the legs, the contacts and the gait phase stay the loops'): the lean and the
arms of setting off, the braking arms and the twist of a stop, the turn of the head and shoulders
into a turn and the pivot's look over the shoulder, with the feet exactly as before. The numbers
above: the same slide, the same answer to the stick, the same settling, the head's jerk within a few
per cent (a little more on a stop, a little less on a turn). `tests/loco-moves.test.js`: which
moment picks which clip and side, the start played by distance within its rate, the path, slide and
bone turns unchanged, and none with the moves off, under matching, or off the ground. What would let
the legs follow the capture too: starts, stops and turns at the game's speeds (a jog start, a run
start, a run stop, a 90° turn at a jog; docs/mixamo-shopping-list.md).

### Matching boundary repair (2026-10-07)

A search in the last half-frame of a loop could round the pose-feature index into the
next unrelated take in the packed database. It now stays inside the current segment.
`tests/motion-matching.test.js` reproduces the boundary and checks all 15 pose features.
This is a narrow correctness repair, not a replacement of the default locomotion system.

Repeating `BODY=v1 WAYS=moves,mm node scripts/mocap/compare.mjs` before the repair and
`BODY=v1 WAYS=mm node scripts/mocap/compare.mjs` after it gives mean foot slide in metres:

| Course | Matching before | Matching after | Default captured-move blend |
|---|---:|---:|---:|
| Walk, run, reverse, stop | 0.083 | 0.083 | 0.051 |
| Walk, 90° turn, stop | 0.101 | 0.094 | 0.016 |
| Turn on the spot | 0.065 | 0.065 | 0.025 |
| Ramp | 0.059 | 0.060 | 0.022 |
| Stairs | 0.085 | 0.093 | 0.022 |
| Slow walk | 0.054 | 0.054 | 0.024 |
| Jog, 45° turns, stop | 0.097 | 0.097 | 0.019 |
| Standing | 0.024 | 0.024 | 0.000 |

Maximum slide is unchanged to two decimals across all eight courses. The 90° course
uses 18 jumps rather than 21, with mean slide down about 7%; stairs still lose to the
default and mean slide increases slightly, though held-foot drift falls from 0.013 to
0.006 m. Matching coverage remains 55–100% across these courses (including captured
idles); the repair does not improve numbers by disabling the matcher. Its 0.18 m stair
penetration and the capture/controller speed mismatch remain unresolved. The matcher
therefore stays opt-in. Experimental changes to warped prediction, fallback state, and
transition gating were measured and discarded because they caused other regressions.

Smooth animation blending is already part of the default animator. Motion matching is
a separate frame-selection algorithm, with inertialized transitions, and is not needed
to enable ordinary smooth blends or the new combat transitions.

### Where motion matching stands (9 October 2026)

"It seems like motion matching still doesn't work?" It runs: on the Motion page (and with `?mm=1` or
the dev menu in the game) the database loads (108 clips, 15 998 frames with the mirrors), the matcher
searches every 0.1 s, jumps and leads the pose (55–100 % of each test run), and the page draws its
trajectories and its clip. It is **not the game's**: the loops, with the captured starts, stops and
turns over them, measure better on every run (the table above), and the game sets off at 3.8 m/s,
quicker than any captured start, so a start finds nothing like it. The page now says so at the top.

What looked broken on the page, and what was:

- **Setting off from standing it played a stop**: a jog's or a run's stop, leaning back, the face 35°
  up off the chest. A fresh match (the first frame, or coming back from the loops) has no clip's pose to
  build its query from and took the database's average for all of it, velocities too (1.1 m/s ahead):
  a body standing still was matched as one on the move, and every search after went on from that stop.
  Now the feet's and the hips' velocities are the body's own (`MotionMatcher.update`); standing it picks
  a standing frame. Mean slide, `BODY=v1 WAYS=mm node scripts/mocap/compare.mjs` before → after:
  0.083 → 0.074 (walk → run → 180°), 0.094 → 0.065 (90° turn), 0.065 → 0.035 (on the spot), 0.060 →
  0.032 (ramp), 0.093 → 0.054 (stairs; the sole's sink 0.18 → 0.078), 0.054 → 0.041 (slow), 0.097 →
  0.093 (jog 45°), 0.024 → 0.003 (standing). Worse: the first run's worst slide 0.25 → 0.38 m and the 90°
  turn's held foot 0.006 → 0.060 m, and in `tests/mocap.test.js`'s walk → run → 180° the worst contact
  0.40 → 0.55 m (mean 0.107 → 0.096): a foot down through the hand-over to the loops as the run outpaces
  the clips. Still two to four times the loops' (0.000–0.051): matching stays off.
  `tests/motion-matching.test.js` checks a fresh match standing and walking.
- **A script's input was dropped**: `motionPage.input()` was read for one frame and the next frame's keys
  replaced it; now it is held (over the keys and the pad) until set again.
- **The moves opened paused showed an empty floor** (`?mode=moves&paused=true`): nothing posed them
  until a step; now the paused moves are posed where the scrub is.
- Tried and left out: holding the head and the shoulders at rest under a match (the database leaves
  them out). The face's tilt under a matched stop is the take's own (its neck leans back); holding the
  head at rest raised it a few degrees more.

## The motion QC (`scripts/motion-qc/`, skill `motion-qc`, October 2026)

**On B3 since 2026-10-14.** The node runs (`scripts/motion-qc/run.mjs`, `body`) drive the game's traveller, B3; until
then they drove the coral-shirt v1, whose files went that day, and the numbers below (issue #47's among them) are v1's.
On B3 four of the runs green on v1 are not yet: the slow walk pops 5 a minute, up the ramp 6, every gait 7 (the limit
3), and the standing pivots' worst jolt is 5.2 cm (5); `tests/motion-qc.test.js` holds them as a todo test. Every one of
those pops is a calf: his knee straightening at the leg's reach at a step's lift-off or touchdown, 14-19 rad/s against
the limit's 14 (one of 45 at the gaits' stop), issue #47's fault on v1's legs, now on B3's proportions.

"Finish the work on motion matching with quality control." The traveller is driven by scripted hands (the stick,
Shift) through starts, stops, every gait, turns, pivots, the ramp and the stairs, recorded every frame right after he
moved and was posed, and judged: how far each planted step slides, how far a held foot moves, pops (a body bone's
angular velocity off its neighbours' by over 14 rad/s), jolts (a joint off the smooth curve through its places either
side by over 3 cm), the worst jolt at each blend boundary (a matcher jump, matching or a captured move crossing half,
the leading loop changing, a pivot), the pose's answer to the stick (start, stop, turn), pivots (the pivoting foot's
slip, crossed feet) and the matcher's time a frame. In node on the gait harness's course (`node scripts/motion-qc/run.mjs`,
15 scenarios, ~40 s, SVG contact sheets) and in the game (`node .claude/skills/motion-qc/run.mjs`: the desert's sand,
the Signal Market's street, the Arena's floor; muted headless Chrome, pictures of the worst frames). The limits and
why: `.claude/skills/motion-qc/SKILL.md`; `node scripts/motion-qc/diff.mjs` puts two runs side by side.
`tests/motion-qc.test.js` holds the judgement on made-up tracks and the runs that are green.

**What it found in the default walk, and what was fixed** (src/feet.js, src/locomotion.js):

- **The knee snapped at every lift-off** (calf 25 rad/s): a held foot stayed down until the leg was at full length, the
  knee locked straight for two frames, then the foot let go at 24/s at once and the knee folded. Soft IK
  (`FEET.soft`: the last 2 % of the leg's reach eases toward straight) and the hold let go as a critically damped
  spring from rest (`FEET.releaseRate`), so the foot leaves with no step in its speed.
- **A landing foot dropped 9 cm in a frame** (foot 20 rad/s): planting a few centimetres up took 0.65 of the hold at
  once. Now it stops where it meets the ground and comes down onto it at the speed it was falling (`dropIn`).
- **The feet slapped flat** at the game's cadence (the loops' foot turns 0.3 rad in a frame at contact): a foot turns no
  faster than 12 rad/s against the body (`FEET.footRate`), about its ball, so a held one stays put.
- **Turning on the spot threw a foot 20 cm**: the pivot flickered off for a frame as the speed crossed 2.6 m/s, the held
  foot let go and was planted again at the clip's place, half a metre off. The pivot has hysteresis now
  (`LOCO.pivotKeep`, `pivotHold`, `pivotFast`), and a foot planted again while still partly on its old hold is held
  where it is shown.

Node, the coral-shirt traveller, before → after (the game's default way: the loops with the captured moves):

| scenario · way | verdict | slide p95 (cm) | slide max (cm) | held (cm) | pops /min | jolts /min | worst jolt (cm) | boundary (cm) |
|---|---|---|---|---|---|---|---|---|
| walk → run → 180° turn → stop · moves | red → red | 10.1 → 8.1 | 10.7 → 10.6 | 0.9 → 0.8 | 35 → 24 | 27 → 19 | 9.4 → 11.0 | 9.4 → 11.0 |
| walk, 90° turn, stop · moves | red → green | 7.8 → 4.3 | 7.8 → 4.3 | 0.5 → 0.7 | 11 → 0 | 7 → 0 | 5.3 → 0.0 | 3.6 → 1.3 |
| turn round on the spot · moves | red → red | 8.5 → 8.5 | 8.5 → 8.5 | 1.3 → 1.0 | 3 → 3 | 3 → 2 | 6.3 → 6.3 | 6.3 → 6.3 |
| up the ramp, stand · moves | red → red | 5.5 → 4.3 | 5.5 → 4.3 | 0.7 → 1.4 | 12 → 7 | 13 → 9 | 10.0 → 8.8 | 10.0 → 8.8 |
| stairs up, stand, down · moves | red → red | 6.6 → 6.9 | 6.6 → 6.9 | 0.5 → 0.7 | 25 → 18 | 23 → 18 | 18.1 → 18.1 | 10.2 → 9.6 |
| slow walk (half stick), stop · moves | red → red | 5.4 → 6.1 | 5.4 → 6.1 | 1.2 → 1.3 | 7 → 0 | 9 → 0 | 4.2 → 0.0 | 2.1 → 1.7 |
| jog, 45° and back, stop · moves | red → green | 6.6 → 4.3 | 6.6 → 4.3 | 0.5 → 0.7 | 14 → 0 | 10 → 0 | 4.1 → 0.0 | 3.9 → 1.8 |
| stand still 6 s · moves | green → green | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 0.0 → 0.0 |
| gaits: walk → jog → sprint → jog → walk → stop · moves | red → red | 7.0 → 8.0 | 7.9 → 8.9 | 1.5 → 1.5 | 34 → 14 | 25 → 13 | 7.4 → 6.1 | 2.2 → 2.2 |
| starts and stops, walk and run · moves | red → red | 17.7 → 9.7 | 21.9 → 29.4 | 1.8 → 1.7 | 41 → 20 | 34 → 15 | 10.4 → 8.3 | 10.1 → 8.3 |
| pivots standing: 90° each way, 180° · moves | red → red | 27.8 → 12.1 | 27.8 → 12.1 | 1.2 → 2.7 | 9 → 5 | 7 → 4 | 20.1 → 6.2 | 20.1 → 6.2 |
| pivot 180° at a jog, and at a sprint · moves | red → red | 19.0 → 13.6 | 30.4 → 16.1 | 0.8 → 2.3 | 39 → 25 | 32 → 24 | 8.1 → 8.2 | 8.1 → 8.2 |
| curve: the stick round a circle at a jog · moves | red → green | 3.3 → 4.3 | 3.3 → 4.3 | 0.5 → 0.7 | 16 → 0 | 9 → 0 | 5.7 → 0.0 | 3.6 → 1.6 |
| down the ramp, stop on it · moves | red → red | 5.8 → 7.0 | 5.8 → 7.0 | 1.3 → 0.6 | 14 → 13 | 10 → 9 | 8.7 → 6.3 | 6.8 → 6.3 |
| stairs at a run · moves | red → red | 14.2 → 8.0 | 14.2 → 8.0 | 1.0 → 1.2 | 27 → 24 | 23 → 21 | 52.8 → 52.8 | 6.8 → 4.2 |

red runs 14 → 11 of 15; limits failed 55 → 47; mean slide p95 9.7 → 7.0 cm; mean pops 19.1 → 10.2 /min; mean jolts 15.5 → 8.9 /min; mean worst boundary 6.9 → 5.2 cm

In the game (two runs each world, before → after, the same scripted course): pops 53 → 46 a minute on the desert's
sand, 53 → 32 in the Signal Market, 53 → 29 on the Arena's floor; jolts 35 → 28, 41 → 26, 43 → 26. The game's frame
times vary (the comparison is noisier there) and the sand's slopes add their own.

**The sprint, the stairs, the pivots and the stop from a run** (issue #57, v1.46; src/animator.js, src/feet.js):

- **The sprint loop was played key to key**: keyed at 30 a second, linear, so a bone's speed stepped at every key, and
  the loop straightens the knee from 76° to 0 in 40 ms at push-off and stops it there. The sprint loop is resampled at
  120 keys a second through a cyclic Catmull-Rom curve and blurred by 20 ms (`smoothLoop`, `SMOOTH_LOOPS`). (The walk's
  and the jog's were tried too: their keys are thinned, and the curve through them did worse.) Two things that looked
  likely did not help: a soft floor on the knee's bend in the rig (the speed into the stop is the pop, not the stop)
  and rolling a held foot onto its ball at the end of a stance (it pops when it lets go instead).
- **The soft IK widens with speed** (`FEET.softFast`, 2 % → 5 % of the leg from 4 to 7 m/s): at a sprint the hips go
  14 cm a frame, through the whole of a 2 % zone in one. Standing, a wide zone keeps the legs off their rest length and
  they twitch (tests/idle-legs.test.js), so it stays 2 % there.
- **A free foot rides the floor under it eased** (`FEET.rideRate`, down only; up it follows at once, else it skims):
  the floor's height under the ball steps by a riser as it passes an edge, and the foot went 18 cm in a frame. The
  clearance rays look 60 ms ahead along the ground (`clearAhead`) and are cast where the foot is drawn (blended with the
  hold it is leaving: a foot let go on a stair's edge went through the edge on its way to the next), and their lift is
  eased (`clearRise`, `clearFall`; no more than `clearSink` under).
- **A step keeps to its own side** (`FEET.stepGap`, `ownSide`): turning on the spot, the clip's place for the stepping
  foot could lie across the held one. **A pivot sets an airborne foot down where it is shown** (the relock), not at the
  clip's place 16 cm off.

Node, before → after (the default way):

| scenario · way | verdict | slide p95 (cm) | slide max (cm) | held (cm) | pops /min | jolts /min | worst jolt (cm) | boundary (cm) |
|---|---|---|---|---|---|---|---|---|
| walk → run → 180° turn → stop | red → red | 8.1 → 7.1 | 10.6 → 7.3 | 0.8 → 1.6 | 24 → 13 | 19 → 11 | 11.0 → 11.7 | 11.0 → 11.7 |
| stairs up, stand, down | red → red | 6.9 → 6.9 | 6.9 → 6.9 | 0.7 → 0.7 | 18 → 12 | 18 → 19 | 18.1 → 13.6 | 9.6 → 9.6 |
| gaits: walk → jog → sprint → jog → walk → stop | red → red | 8.0 → 6.8 | 8.9 → 7.2 | 1.5 → 1.6 | 14 → 10 | 13 → 7 | 6.1 → 4.1 | 2.2 → 1.7 |
| starts and stops, walk and run | red → red | 9.7 → 9.7 | 29.4 → 15.3 | 1.7 → 1.7 | 20 → 15 | 15 → 5 | 8.3 → 8.4 | 8.3 → 8.4 |
| pivots standing: 90° each way, 180° (crossed 17 → 6 %) | red → red | 12.1 → 14.0 | 12.1 → 14.0 | 2.7 → 2.7 | 5 → 5 | 4 → 4 | 6.2 → 6.2 | 6.2 → 6.2 |
| pivot 180° at a jog, and at a sprint (crossed 0 → 8 %) | red → red | 13.6 → 8.5 | 16.1 → 13.7 | 2.3 → 2.3 | 25 → 21 | 24 → 16 | 8.2 → 8.5 | 8.2 → 8.5 |
| stairs at a run | red → red | 8.0 → 6.9 | 8.0 → 6.9 | 1.2 → 1.4 | 24 → 19 | 21 → 14 | 52.8 → 40.4 | 4.2 → 3.6 |

(the other eight unchanged within a tenth.) Limits failed 47 → 46; mean slide p95 7.0 → 6.6 cm; mean pops 10.2 → 8.0
/min; mean jolts 8.9 → 6.4 /min. In the game, the Arena's floor: pops 27 → 19 a minute, jolts 24 → 16, crossed 11 → 8 %.
Still red: the sprint (10 pops a minute: the loop's own push-off; a new sprint capture, or a sprint matched from the
database, is the next step), the stairs (the settling steps on two steps outlast the second the script stands for), and
the standing pivots' slides (the quick steps round skim the ground).

**Motion matching** (src/motion-match.js; still off by default, `?mm=1`): what kept it from the game's speeds was data
(no capture walks at 3.8 m/s or runs at 7.2), and where it had nothing close it handed the pose back to the loops at
their own phase, which the QC saw as jolts and slides at every hand-over. Done:

- **The game's own loops in the database** (`gameLoops`, `GAME_LOOPS`): the idle, the walk, the jog, the sprint and
  three blends between them, each a cycle at the shared gait phase as the Animator blends them; their root moves at
  STRIDE_K of their stride (the loops' cadence) and their planted feet sweep at the loop's own speed (`sweepOf`; the
  Animator's foot speed and feet.js's stride warp take it), and their features shorten the feet's reach by the same
  ratio, so a planted foot stays put in the features as a captured one does. 255 frames; the database 15 998 → 16 253.
- **Matching takes over on the loops' own copy** (`Animator.gameLoopFrame`): coming in, it starts on the database frame
  of what the loops show, at their phase: no seam. On a game loop the loops' phase is kept with it (`syncPhase`, only
  while the loops are hidden), so a hand-back goes on in step.
- **The sprint is matched**: the trajectory is asked for at no more than the database's fastest (`capK`), the playback's
  warp does the rest; before, the best sprint cost 10 and the loops took every sprint.
- **Slowing to a stop**, a moving clip slows with the body down to a standstill instead of walking on at its own pace.
- **The feet's contacts are a feature** (`weights.contact`), so a jump keeps the feet down that are down; a capture costs
  a little more than a game loop (`captureBias` 0.5); the stride's sweep is eased across a jump (a capture to a game
  loop changed it by half and moved a swinging foot 40 cm in a frame).

Node, before → after (`?mm=1`):

| scenario · way | verdict | slide p95 (cm) | slide max (cm) | held (cm) | pops /min | jolts /min | worst jolt (cm) | boundary (cm) |
|---|---|---|---|---|---|---|---|---|
| walk → run → 180° turn → stop · mm | red → red | 19.4 → 7.9 | 38.5 → 15.2 | 0.9 → 0.8 | 36 → 21 | 35 → 21 | 9.1 → 10.1 | 9.1 → 10.1 |
| walk, 90° turn, stop · mm | red → red | 20.1 → 8.4 | 20.1 → 8.4 | 5.9 → 0.7 | 14 → 3 | 18 → 6 | 10.2 → 9.3 | 9.0 → 9.3 |
| turn round on the spot · mm | red → red | 5.6 → 9.7 | 5.6 → 9.7 | 2.4 → 0.9 | 3 → 4 | 3 → 1 | 7.7 → 6.4 | 7.7 → 6.4 |
| up the ramp, stand · mm | red → red | 8.8 → 9.6 | 8.8 → 9.6 | 1.4 → 1.5 | 28 → 12 | 24 → 15 | 11.2 → 10.6 | 11.2 → 10.6 |
| stairs up, stand, down · mm | red → red | 10.7 → 13.0 | 18.1 → 13.0 | 0.9 → 0.8 | 23 → 21 | 35 → 26 | 29.4 → 26.8 | 20.1 → 26.8 |
| slow walk (half stick), stop · mm | red → red | 12.1 → 7.5 | 12.1 → 7.5 | 0.6 → 0.8 | 21 → 4 | 20 → 4 | 7.2 → 3.5 | 7.2 → 3.3 |
| jog, 45° and back, stop · mm | red → red | 35.0 → 17.6 | 47.8 → 17.6 | 0.9 → 1.7 | 17 → 2 | 21 → 8 | 8.8 → 6.3 | 8.8 → 6.1 |
| stand still 6 s · mm | green → green | 0.5 → 0.0 | 0.5 → 0.0 | 0.0 → 0.0 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 0.1 → 0.0 |
| gaits: walk → jog → sprint → jog → walk → stop · mm | red → red | 12.1 → 8.2 | 19.2 → 19.9 | 1.5 → 0.9 | 46 → 22 | 42 → 24 | 7.7 → 9.5 | 6.1 → 9.5 |
| starts and stops, walk and run · mm | red → red | 18.2 → 10.6 | 48.3 → 31.5 | 1.2 → 1.0 | 52 → 28 | 52 → 28 | 13.6 → 11.5 | 11.7 → 11.5 |
| pivots standing: 90° each way, 180° · mm | red → red | 40.7 → 22.3 | 40.7 → 22.3 | 2.6 → 3.3 | 15 → 7 | 13 → 6 | 24.6 → 6.6 | 24.6 → 6.6 |
| pivot 180° at a jog, and at a sprint · mm | red → red | 25.8 → 9.7 | 30.4 → 14.8 | 2.2 → 1.3 | 45 → 31 | 43 → 30 | 12.3 → 9.9 | 12.3 → 9.9 |
| curve: the stick round a circle at a jog · mm | red → red | 4.3 → 20.4 | 8.2 → 74.0 | 0.6 → 0.7 | 18 → 6 | 11 → 15 | 5.7 → 6.1 | 4.0 → 6.1 |
| down the ramp, stop on it · mm | red → red | 90.3 → 16.7 | 90.3 → 16.7 | 1.2 → 0.3 | 21 → 16 | 20 → 15 | 10.9 → 8.9 | 10.9 → 8.9 |
| stairs at a run · mm | red → red | 19.0 → 11.0 | 19.0 → 11.0 | 1.1 → 1.3 | 28 → 24 | 25 → 20 | 44.8 → 53.0 | 8.4 → 23.6 |

red runs 14 → 14 of 15; limits failed 81 → 76; mean slide p95 21.5 → 11.5 cm; mean pops 24.5 → 13.4 /min; mean jolts 24.1 → 14.6 /min; mean worst boundary 10.1 → 9.9 cm

In the game: slide (95th percentile) 28 → 24 cm on the sand, 38 → 12 in the Market, 25 → 12 on the Arena's floor; pops
64 → 54, 57 → 39, 67 → 35 a minute.

**Where it stands**: matching is better than it was on every average and still worse than the default on every one
(its slide 11.5 against 7.0 cm, its pops 13 against 10 a minute), and red everywhere but standing: its captured
starts, stops and turns are slower than the controller, so where it plays them the feet slide two to three times as
far, and on the stairs a captured stride puts a foot under the riser. It stays a dev-menu switch. What would finish
it: starts, stops and 90° / 180° turns captured at the game's speeds (3.8 m/s walking, 7.2 running: TODO.md, "Carried
over"), and then the same QC; the matcher's machinery (the hand-in, the sprint, the stops, the contacts) is ready for
them.

**What it costs**: the matcher's search and playback, in node on this Mac, 20 µs a frame on average (50 before: fewer
fresh searches now that it seldom hands over), 122 µs at the 95th percentile (a search frame). In headless Chrome with
the CPU throttled fourfold (`--cpu 4`, a handheld's main thread, roughly), the desert's run: 0.20 ms a frame on average
and up to 0.9 ms on a search frame; the whole Animator 0.43 ms with matching against 0.23 without. The default way
spends nothing on the matcher; the feet's new work (the soft reach, the springs, the foot's turn) is a few quaternions a
foot a frame.

**Left red in the default way**: the sprint (pops at every step: the sprint loop's stance outlasts the leg's reach at
7–8 m/s; letting the foot go earlier made the starts and stops slide, measured and left out), the stairs (a foot
lifted over a riser), the pivots (the feet cross for a few frames as the second foot steps round: 17 % of a standing
pivot's frames) and the starts and stops at a run (29 cm, the stop's last step).

**v1.66** (docs/audits/motion-v1.66.md, 2026-10-13): the node course exactly as above (11 of 15 red, 46 limits failed,
slide p95 6.6 cm, pops 8.0 and jolts 6.4 a minute); matching 75 limits (76). In the game a held foot slips 5.8 cm in the
Signal Market's street and the stop never settles there or in the Arena (issue #288).

**Issue #288: a pivot that turns into a start** (2026-10-13). Not the street's kerbs nor its strollers: he stands on
flat paving there and nobody touches him (the body's speed and its travel agree every frame). The camera starts behind
him and he faces it, so the course's first push is a 180° start: a pivot (src/locomotion.js), which feet.js treats as
standing, while the body runs off at 2.4 m/s. A standing foot was never let go for being out of reach, so the held one
was dragged 6 cm with the leg at full length and the ball lifting, and the steps round touched down sliding with a
place that ran on with the body (22 cm "steps"). In feet.js now: in a pivot a held foot steps (quickly) as soon as its
leg comes into the soft end of its reach, once the other is coming down (`pivotOverlap`) and not twice running, and not
when the body is already near the pivot's end speed (`pivotStepSpeed`: the stride takes it); a step lands where its
place will be, led by the body's travel over what is left of it (`stepLead`) and following its place less and less over
its second half; a pivot's step cut short by the pivot ending in a start lands from where it is if it is coming down
(`pivotLand`, the foot meeting the ground's ease, `dropIn`) and otherwise goes with the stride from the air, never set
down in mid-air; the hips come down faster in a pivot. The "never settles" was the script: the last stop stood 1.2 s,
and a stop counts once both feet are still for 0.3 s, so one that settled in 0.93 s ran out of samples; it stands 1.8 s.
In the Arena the waves also came whatever the Enemies setting, and one came up out of the floor beside him and shoved
him as he stood: the scenario holds them off (`foes.setPractice('')`). A node scenario reproduces the start ("setting
off the other way", tests/motion-qc.test.js).

Node, the default way (before → after): the start the other way slide max 19.5 → 8.9 cm, held 3.6 → 0.9; pivots
standing 14.0 → 5.4, held 2.7 → 0.1; turning round on the spot 9.4 → 4.0; down the ramp 7.0 → 4.7; the 180° pivots at a
jog and a sprint held 2.3 → 1.8; limits failed 53 → 45, mean slide p95 7.1 → 5.8 cm, pops and jolts as they were;
matching unchanged. In the game (Medium, this Mac; before: two runs, after: five, the range):

| world | held (cm) | slide max (cm) | stop (s) | pops /min |
|---|---|---|---|---|
| the Signal Market's street | 6.2, 6.2 → 1.1-3.2 (median 1.7) | 21.8, 21.4 → 8.8-10.9 | never → 0.95-0.98 | 28-30 → 23-28 |
| the Arena's floor | 1.5, 2.0 → 1.3-1.6 | 12.3, 10.2 → 9.7-10.8 | 1.05, 0.95 → 0.95-0.97 | 26-27 → 24-26 |
| the desert's dunes | 1.5, 1.6 → 1.1-2.2 | 10.5, 10.8 → 8.5-14.3 | 0.95-1.07 → 0.95-0.97 | 30 → 28-32 |

Left: a held foot drifts up to 2-3 cm at the hand-over from a pivot to a jog (the course's 90° jog start: the loops'
contact dips for a frame and the foot is let go, skims, and is planted again; 2.0-2.1 cm before too) and once in five
runs the desert's settling step after a tapped pivot slid 14 cm (9.5-10.8 before).

**Issue #47: starts, stops and turns at the game's speeds** (2026-10-14). Capturing new moves needs a person; what we
have (the Mixamo moves of #197, the loops, feet.js) was made to follow the body at the speeds the controller really
moves at. What the QC's frames showed, and what changed:

- **A foot set down onto a slope from under it** (up the ramp, 9 pops a minute): the drawn foot rides the floor under
  it (`gRide`), so going uphill it is still its swing's height over the slope when the clip's foot, under that floor,
  meets the ground; planted from the clip's clearance it dropped 10-13 cm in a frame at every step. It now comes down
  (`dropIn`) from where it is drawn: the clip's clearance plus the ride (downhill: less, so it no longer lifts 3 cm).
- **The sprint's push-off** (10 pops a minute): the held foot stayed down until the leg was out of reach, the knee went
  straight 30° a frame and stopped there for two frames while the release eased in. From 4.5 to 7 m/s a held foot lets
  go once the hips, 50 ms on at the body's speed, would have its leg within 5 % of full length (`FEET.pushOff`), after
  two frames held at least. Let go, a foot leaves its hold along the ground more slowly than it rises (`toeOff`, w^0.7)
  and in a higher arc (`releaseArc`), so the toe isn't drawn along the floor. Rolling the held foot onto its ball instead
  (the heel rising, the ball kept) was tried again: it pops where it lets go, as before; left out.
- **Setting off at a jog or a run** from standing: the loops' phase ran on from the last stop, so a start often set off
  on the foot behind, held down out of reach, dragged and planted again 19 cm on. A start the way he faces (within
  70°) aligns the loops so the foot ahead is down and the one behind lifts first (`START_STEP`, src/player.js; a walk's
  start keeps its captured move's own foot).
- **The facing spun up in a frame**: following the way he moves at once, a turn from standing went from still to 34
  rad/s in one frame (180° in eight) and every bone jumped with it, the hands 6 cm off their path: the boundary at every
  pivot and turn move. Its speed now rises no faster than 600 rad/s² (`FACE.accel`, `faceStep`); slowing is as before
  (400 was smoother still, but a standing turn then stepped with both feet in the air for a few frames).
- **A pivot planted a foot in mid-air**: reversing a sprint, the speed passes under the pivot's 2.6 m/s for a frame and
  the pivot set down a foot swinging 15 cm up where it was; it was pulled to the ground as the pivot ended (a 12.5 cm
  jolt). A pivot plants at once only a foot within 5 cm of the ground or down by the gait (`pivotPlant`).
- **The pivoting foot turned on its ball at once** (calf 30 rad/s): it turns no faster than 14 rad/s (`pivotYawRate`).
  A step's foot turns round about up (it was a lerp of two vectors, which through a half turn passed near nothing and
  flipped the foot 97 rad/s), and a settling step cut short by setting off comes down onto the ground (`dropIn`)
  instead of 6 cm in a frame.
- **A swinging foot rose a whole stair in a frame**: it also rises toward the floor 0.1 s ahead along its way
  (`rideAhead`, `rideAheadRate`), so it is mostly up by the time it passes the riser (stairs: pops 12 → 8 a minute).
- **The running turn's arms** (src/loco-moves.js): played by angle, the running 180° turn sat at its least rate while
  the body braked and jumped to its most as the facing came round; its playback speed is eased (`rateEase`) and its
  most is 1.8 (2.4): the arm turned 0.6 rad in a frame.

Node, the default way (`node scripts/motion-qc/diff.mjs`, before on e8a03689):

| scenario · way | verdict | slide p95 (cm) | slide max (cm) | held (cm) | pops /min | jolts /min | worst jolt (cm) | boundary (cm) |
|---|---|---|---|---|---|---|---|---|
| walk → run → 180° turn → stop | red → red | 7.1 → 8.3 | 7.3 → 10.4 | 1.6 → 0.3 | 13 → 3 | 11 → 7 | 12.3 → 4.6 | 12.3 → 4.6 |
| walk, 90° turn, stop | green → green | 4.3 → 1.8 | 4.3 → 1.8 | 0.7 → 0.3 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.3 → 1.4 |
| turn round on the spot | red → green | 4.0 → 4.0 | 4.0 → 4.0 | 0.2 → 0.2 | 3 → 0 | 1 → 0 | 6.3 → 0.0 | 6.3 → 1.7 |
| up the ramp, stand | red → red | 4.3 → 2.1 | 4.3 → 2.1 | 1.4 → 1.7 | 9 → 2 | 9 → 1 | 9.1 → 3.1 | 9.1 → 3.1 |
| stairs up, stand, down | red → red | 6.9 → 5.4 | 6.9 → 5.4 | 0.7 → 0.3 | 12 → 8 | 19 → 19 | 13.6 → 12.3 | 9.6 → 10.0 |
| slow walk (half stick), stop | red → green | 6.1 → 2.2 | 6.1 → 2.2 | 1.3 → 1.3 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.7 → 2.5 |
| jog, 45° and back, stop | green → green | 4.3 → 1.8 | 4.3 → 1.8 | 0.7 → 0.3 | 0 → 1 | 0 → 0 | 0.0 → 0.0 | 1.8 → 2.8 |
| stand still 6 s | green → green | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 0.0 → 0.0 |
| gaits: walk → jog → sprint → jog → walk → stop | red → red | 6.8 → 7.4 | 7.2 → 9.4 | 1.6 → 1.3 | 10 → 0 | 7 → 6 | 4.1 → 4.1 | 1.7 → 1.7 |
| starts and stops, walk and run | red → red | 10.1 → 10.8 | 15.2 → 16.1 | 1.7 → 1.7 | 14 → 7 | 5 → 5 | 8.4 → 5.0 | 8.4 → 3.0 |
| setting off the other way | red → red | 8.4 → 8.4 | 8.9 → 11.3 | 0.9 → 1.1 | 8 → 5 | 6 → 3 | 8.0 → 4.1 | 6.6 → 4.1 |
| pivots standing: 90° each way, 180° | red → red | 5.4 → 4.9 | 5.4 → 4.9 | 0.1 → 0.2 | 5 → 1 | 4 → 1 | 6.2 → 3.4 | 6.2 → 3.4 |
| pivot 180° at a jog, and at a sprint | red → red | 8.5 → 9.5 | 14.1 → 21.1 | 1.8 → 1.2 | 22 → 6 | 15 → 15 | 8.5 → 7.3 | 8.5 → 5.1 |
| curve: the stick round a circle at a jog | green → green | 4.3 → 2.2 | 4.3 → 2.2 | 0.7 → 0.3 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.6 → 2.1 |
| down the ramp, stop on it | red → red | 4.7 → 3.3 | 4.7 → 3.3 | 0.6 → 1.1 | 13 → 5 | 9 → 6 | 6.3 → 5.8 | 6.3 → 4.9 |
| stairs at a run | red → red | 6.9 → 9.1 | 6.9 → 9.1 | 1.4 → 0.1 | 19 → 10 | 14 → 12 | 40.4 → 22.7 | 3.6 → 7.9 |

red runs 12 → 10 of 16; limits failed 45 → 34; mean slide p95 5.8 → 5.1 cm; mean pops 8.0 → 3.0 /min; mean jolts
6.3 → 4.7 /min; mean worst boundary 5.3 → 3.7 cm. Matching (`?mm=1`): limits failed 79 → 77, pops 10.7 → 6.6, jolts
11.7 → 10.7, boundary 9.5 → 7.7 cm, but slide p95 12.8 → 17.7 cm (two runs: standing on the ramp a foot the matched
clip never puts down creeps 86 cm, and a standing pivot's settling step 26 cm).

In the game (Mac, muted headless Chrome, Medium, two runs each, before → after):

| world | pops /min | jolts /min | boundary (cm) | slide p95 (cm) | held (cm) | crossed |
|---|---|---|---|---|---|---|
| the desert's dunes | 31, 31 → 11, 11 | 20, 20 → 13, 15 | 8.5, 8.6 → 7.6, 7.6 | 7.5, 7.5 → 8.1, 8.1 | 2.4, 1.2 → 1.2, 1.2 | 13, 8 → 5, 5 % |
| the Signal Market's street | 26, 27 → 7, 7 | 14, 17 → 13, 13 | 8.5, 8.7 → 7.0, 5.8 | 7.1, 7.5 → 8.4, 9.0 | 1.4, 1.4 → 1.8, 0.9 | 8, 6 → 5, 5 % |
| the Arena's floor | 26, 27 → 8, 10 | 15, 15 → 10, 15 | 7.7, 8.2 → 6.8, 6.7 | 5.9, 7.2 → 9.8, 8.2 | 1.1, 1.1 → 1.2, 1.1 | 6, 6 → 9, 5 % |

A held foot moved under 2 cm in all six runs after (the 2-3 cm slip at #288's 90° jog start not seen); every stop
settled in 0.95-0.98 s.

**Left red**, with numbers: the sprint's steps slide (p95 7.4 cm in node, 8-10 cm in the game, 5-6 before: a foot
held two frames at 8 m/s and let go early touches down at 10 m/s and lifts with its toe on the floor; the trade for
the knee no longer snapping, 10 pops a minute to 0); the stairs (19 jolts a minute and a 10 cm boundary: a swinging
foot still rises 8 cm in a frame passing a riser at a jog, the legs fold to a fifth of their length climbing at 3.8
m/s, and the stop on them never settles); the stairs at a run (10 pops a minute, a 23 cm jolt); starts and stops at a
run (slide max 16 cm: the sprint from standing goes from 0 to 8 m/s in 0.4 s); the 180° pivots at a sprint (slide max
21 cm, 15 jolts a minute); the standing pivots' crossed feet (10 % of the frames) and the ramp's last boundary (3.1 cm,
the run-to-stop move's hand). In the game only, the running 180° turn flicks a forearm or a hand 180-220 rad/s in a
frame (the game's traveller's hands; not in node's), before and after.

**Worlds tried and left out**: the City-Shaft. From its landing every way the script runs into a railing or a house
within the sprint, and he climbs it.

**Issue #47 on B3** (2026-10-15). The QC moved to the B3 traveller on 14 October, and four runs green on v1 were not on
him: every pop a calf, 14-19 rad/s at a lift-off or touchdown, and 38-45 at the gaits' stop. Frame by frame:

- **The knee reaching straight** at a walk's and a ramp's lift-off: B3's leg reached straight within v1's 2 % soft zone;
  `FEET.soft` 0.02 → 0.035 (0.03 and 0.04-0.05 tried: each green on a different set; lower release rates were worse),
  narrowed back to 0.02 standing (`FEET.softStand`, eased in from 0.3 to 1 m/s: wider, a held ball crept 5 mm at idle).
- **Planted and let go in one frame**: stopping, a foot half eased off its old hold (w 0.56) touched down out of the
  leg's reach and was let go again in the same frame: thrown onto its whole hold for that frame and off again, 38-45
  rad/s. It now goes on easing off from where it was (`FEET.relockKeep`: on the out-of-reach release only; a fully free
  foot keeps the old behaviour, which the ramp's stop needs).
- **An early touchdown at a lift-off**: a foot "coming down" within 2.5 cm of the ground plants early; with a stale
  `aloft` at a start move's first lift-off it planted for one frame as its contact fell (19 rad/s): only while the
  contact isn't falling.
- **Standing flickering off for a frame** as a pivot ended (its gait passing 0.25 on its way down): the settling step
  under way was cut short and set down again the next frame (25 rad/s). Standing stays standing while the gait settles,
  to `restGait + restKeep` (0.05); not as it rises (setting off from a pivot, it held a foot 2-3 cm too long in the
  Arena).
- **A stepping foot's turn** kept continuous from frame to frame (a half turn's place swinging past the back flipped
  `yawBetween` from +π to -π: setting off the other way's 9.8 cm jolt → 3.9).

Node, the default way (`diff.mjs`, before on 0006cfe7): red runs 11 → 9 of 16, limits failed 39 → 29, pops 3.9 → 2.7 a
minute, jolts 5.0 → 4.4, slide p95 5.3 → 4.9 cm, boundary 4.0 → 3.5 cm. Green now: the slow walk (pops 5 → 0), up the
ramp (6 → 3). Every gait: pops 7 → 2, boundary 7.6 → 1.9 cm. The standing pivots: pops 3 → 0, worst jolt 5.2 → 0,
boundary 3.7 → 1.6, slide p95 6.0 → 4.5 (red only for crossed feet, 9 %). Matching: limits failed 75 → 74, pops 6.8 →
6.3. `tests/motion-qc.test.js`: the B3 test is no longer todo, with these limits.

In the game (Mac, muted headless Chrome, Medium, the desert and the Arena, the default way): within the runs' noise,
pops 9, 11 → 9-10, 5-6, jolts 19, 12 → 13-16, 11-15 a minute; the walk's start pops (15-19 rad/s) gone; the pivot
into a jog at 90° (`jog2`, a calf 25-34 rad/s) and the sprint reversed's forearm flip (160-250 rad/s, the game's hands)
as before.

**Left red** (node, the todo test): the stairs (8 pops, 18 jolts a minute, a 12.6 cm jolt, a 10.1 cm boundary, the
stop never settles) and at a run (9 pops, a 30.6 cm jolt, 4.7 cm sink); the sprint's steps (slide p95 9.7 cm in every
gait, max 31.4; 11.3 in starts and stops; 9.4 at the sprint's 180° pivot, max 20.9, 13 jolts a minute); walk → run →
180° → stop (slide p95 10.1, 8 jolts a minute); the standing pivots' crossed feet (9 %, mid-turn); setting off the other
way (slide p95 10.3, a half turn's step round flicking the foot 83 rad/s); down the ramp's 4.6 cm boundary.

**Issue #47 on B3, the second round** (2026-10-15). Frame by frame again, node and the game:

- **A sprint's touchdown lunged on.** A landing foot was planted where the clip's foot was that frame, 5-6 cm on from
  where it was drawn the frame before (the clip's foot still travels at touchdown), and the landing's hold-back
  (`landBack`) stopped at 14 of the 22 cm the sprint's foot covers in its last moments. A free foot touching down within
  22 cm of where it was drawn, drawn moving under 6 m/s, now holds there (`FEET.plantShown`: a faster one, a swing
  through a pivot at 12 m/s, still stops on the clip's place, or it stopped dead and jolted); `landBack` 0.14 → 0.2.
- **A foot left behind as a run set off** was let go out of the leg's reach and eased toward the clip's foot along
  the floor, 3-10 cm a frame, its ball still on the ground. Let go out of reach under 5.5 m/s with the clip's foot still
  down, it rises at least 3 cm as it eases off (`releaseMin`, `dragSpeed`: on the sprint's push-off too, the knee
  popped).
- **A stop's last step set down out of reach** was let go in the frame it landed and planted again four frames on,
  27-36 rad/s: for its first 0.1 s, under 1 m/s, a foot lets go only past the hips' whole drop (`reachGrace`).
- **The standing pivots' crossed feet** (9 %): the step round went in a straight line from where it was to its place
  on the far side while the body turned over it, across the held foot. It keeps 12 cm to its own side of the other foot
  on its way (`stepPathGap`, eased at `stepPathRate`, gone before it comes down), and its place keeps its side of a
  foot that is stepping too.
- **Stairs at a run.** `StepLag` eased the drawn body onto each riser at 12/s, so up a flight it trailed the climb by
  its speed / 12: 18 cm at a jog, 38 at a sprint; the legs folded to reach the treads, the swinging foot was lifted out
  of reach (the calf 93 rad/s) and the soles sank 4.7 cm. The flight's climb, read over 0.15 s (`STEP_LAG.climb`), now
  carries the drawn body with it, never past the floor's height, from 4.5 to 6.5 m/s along the ground (`STEP_LAG.fast`:
  at a jog the easing alone keeps up well enough, and carried there the hips rose less smoothly, the pelvis's jerk 2.5 →
  4.3 km/s³). A swinging foot passing over a stair's edge eased down
  it at 25/s from its full speed, 4-5 m/s in a frame: now a critically damped spring (`rideSpring`).
- **The forearm turning over** in a sprint reversed and the running 180° (166-233 rad/s, the game and node):
  `shareWristRoll` gave the forearm half the hand's roll, read in (-π, π]; passing a half turn it flipped sign and the
  forearm went half a turn the other way and back. The roll is kept on its side from frame to frame.
- **The walk back** (locked on): the pack's slow walk could not keep up with the lock's pace. It is now the loops' own
  gait run backwards (`LOCK_MOVE.backRun`; `Animator.update`'s `s.reverse` runs the shared phase the other way, no
  touchdown read ahead): the stance sweeps forward under the hips as fast as the body goes back.
- **The recorder** (`sample.mjs`) reads the joints against the drawn body, not the controller's place, which steps a
  riser in a frame: on the stairs every joint "jolted" by half a riser, 9 cm, where nothing on screen did. The stairs'
  stands (1 s) were shorter than a stop's limit and the 0.3 s it must stay still: the motion QC's run of it stands 1.6
  and 1.8 s (`scenarios.mjs`), and its stops settle in 0.9 s.

Node, the default way (`diff.mjs`, before on b653f6eb): red runs 9 → 7 of 16, limits failed 29 → 16, slide p95 4.9 →
3.4 cm, pops 2.7 → 2.2 a minute, jolts 4.4 → 1.8, boundary 3.5 → 2.9 cm. Green now: every gait (slide p95 9.7 → 5.2 cm,
max 31.3 → 5.5, jolts 5 → 0), the standing pivots (crossed 9 → 0 %). Slides green in every run: starts and stops 11.3 →
5.3, walk → run → 180° 10.1 → 5.4, the 180° pivots 9.4 → 5.2 (max 20.9 → 7.5), setting off the other way 10.3 → 5.3. The
stairs at a jog: pops 8 → 7, jolts 18 → 5 (9 of them the recorder's), boundary 10.1 → 3.9, the stops settle; at a run:
sink 4.7 → 0, worst jolt 30.6 → 7.2, pops 9 → 5. Locked on, walking back (node, 6 s): slide median 11.2 → 1.1 cm, held
5.7 → 1.0, jolts 14 → 2 (pops 15 → 14). `tests/motion-qc.test.js` and `tests/strafe.test.js` hold these.

In the game (Mac, muted headless Chrome, Medium, the desert and the Arena; before once, after twice): the Arena slide p95
8.8 → 5.5-6.0 cm, pops 8 → 4, jolts 10 → 5-6 a minute; the desert 8.0 → 7.8-8.5, pops 7, jolts 14 → 13; crossed feet 6-7
→ 0 % (one Arena run 7 %); the sprint reversed's forearm flip (166-182 rad/s) gone. Without it a calf shows at the
reversal's start, 20-32 rad/s (it was hidden under the forearm's pop, the worst of a frame kept).

**Left red** (node, the todo tests): the stairs (7 pops, 5 jolts a minute, a 3.9 cm boundary: a step down's touchdown
out of reach, a held foot on the lower step let go at full stretch climbing) and at a run (5 pops, 8 jolts, a 5.9 cm
boundary: a riser every 2-3 frames at a sprint); the 180° turns at a run and a sprint (4 jolts a minute, a 4.6 / 5.6 cm
boundary as the running turn's move comes in, a foot planted with its weight thrown on, the calf 38 rad/s; easing it on
instead slid the pivots' steps); the sprint's push-off calves at 14-15 rad/s (starts and stops: 4 pops); setting off the
other way (5 pops, the half turn's step round); down the ramp a 3.2 cm boundary; the walk back's calves at each
backwards lift-off (14 pops in 8 s); in the game the pivot into a jog at 90° (`jog2`, a calf 26-34 rad/s).

**Issue #47 on B3, the third round** (2026-10-15). Frame by frame again, node and the game:

- **Stood up for a frame in a running reversal.** Turning round at a run, the body's speed passes through nothing for a
  frame on its way from 8 m/s one way to the other; under 0.25 m/s the Animator's blend aims at the standing pose, and
  the idle took 15 % of the pose in that frame: every swinging foot dropped 7-10 cm and rose again (the 4.6 cm boundary
  as the running turn's move came in). With the stick held and the loops already over half the pose, the blend keeps
  the gait's own weights for that frame (`GAIT_HOLD`, the player passes `steering`).
- **A foot planted in its release's arc.** A foot still easing off an old hold is drawn in the release's arc
  (`releaseArc`), 8-12 cm over the clip's foot; as the clip's foot neared the ground it was planted early from there
  and thrown onto the ground with its whole weight in a frame, the calf 38 rad/s. A foot 5 % or more on an old hold
  plants early only once it is drawn near the ground too (`FEET.earlyShown`), and one held where it is drawn comes down
  from the height it is drawn at (`FEET.dropShown`). The facing's speed-up, at a run (the loops over half the pose),
  comes in over a few frames (`FACE.jerk`, 12000 rad/s³; at once from standing as before: a pivot down the ramp or the
  other way then stepped late), and a pivot is not begun with the loops over 0.9 of the pose (`LOCO.pivotGait`): the speed
  passing under 2.6 m/s for a frame on its way back up made a pivot of one frame, the held foot's knee swung round with
  it (a calf 29 rad/s and crossed feet in 4-7 % of the reversal's frames in the Arena).
- **The arm's clearance flipping.** The traveller's walk and jog hold his arms out from his sides by the arm's angle seen
  from the front (`relaxWalkArms`); an arm swung up behind, as the running turn throws it, passed straight up there and
  its angle flipped from +180° to -180°: the whole arm turned 40° and back in a frame, the forearm 60-80 rad/s. The
  clearance is for an arm that hangs: it fades out as the arm comes up level (`ARM_HANG`, src/characters/tripo-walk.js).
- **A landing foot eased off its speed.** In its last moments over the ground a foot was held back toward where it was
  as it came over the ground, by the share of `landTime` gone: met two or three frames before touchdown, it kept a third
  of its speed in the first frame (a running turn's foot, swung round at 13 m/s, stopped from 22 cm a frame to 7). The
  share of its place's travel it keeps now falls from 1 to 0 over the moments left (`FEET.landEase`), and `landBack` is
  reached smoothly (tanh), not clamped.
- **A release's toe-off let go at its end.** A foot let go leaves its hold along the ground more slowly than it rises,
  as w^0.7; at a sprint the last 3 % of a release still drew the foot 13 cm back toward a hold 1.5 m behind, and it jumped
  on 15 cm in the frame it touched down. As 1 - (1 - w)^(1 / 0.7) instead (`FEET.toeOffTail`): as slow at first, gone at
  the end. Slides at every gait 5.2 → 3.4 cm (p95), and the sprint's push-off calves (14-15 rad/s) gone.
- **A pivot's step round.** Its foot turns half a turn in 0.17 s, 35 rad/s; held to `footRate` (12 rad/s) it fell 1.5
  rad behind and was set to the clip's turn in a frame, 85-93 rad/s. It falls no more than `FEET.footLag` (0.5 rad)
  behind. A step cut short as the pivot ends lands only where the gait has the foot down (`FEET.landPlanted`): set down
  and let go in the same frame, it dropped its step's height, 3-4 cm, and rose again (the calf 21 rad/s, a pivot into a jog).
- **The stairs.** Down a flight, a foot set on the step below before the body came down was out of reach and let go in
  the frame it landed: thrown onto its hold and off (26-31 rad/s), it then slid the step through. A foot set down under
  the body's floor by 8 cm or more lets go out of reach only past the hips' whole drop for its first 0.1 s (`reachGrace`'s
  third). A swinging foot rises toward the next stair as a critically damped spring from rest (`FEET.rideAheadSpring`,
  at 60/s: eased at 30/s, it set off at its full speed in the frame it lifted).
- **The walk back** (locked on): the loops' gait run backwards lifts a foot where it came down, in front of the hips,
  with the leg at its full length; let go there, the knee snapped bent, a calf pop at every step back. A foot walking back
  lets go a moment before the leg is straight, as a sprint's push-off does (`FEET.pushOffBack`, 2.5-3.5 m/s, within
  10 % of the leg; the player's `o.reverse`).

Tried and left out: the drawn body's stair lag as a critically damped spring (`StepLag`: 18-50/s each moved the stairs'
pops by one either way, no clear gain); the hips coming down from the leg's soft zone (`dropAt` 0.965-0.975: the slow
walk's held foot crept 6 cm); a landing not held back while the body spins fast (the running turn's foot then slid 7
cm); landing by the drawn foot's clearance down a slope (no change on the ramp); a longer `landTime` (0.1-0.13: the
running turn's boundary 4.6 cm); a foot coming down from its lift over a stair's edge (no change); a rate limit on the
forearm's share of the wrist's roll (the flip was the arm's clearance, above).

Node, the default way (`diff.mjs`, before on 8ca3618f):

| scenario · way | verdict | slide p95 (cm) | slide max (cm) | held (cm) | pops /min | jolts /min | worst jolt (cm) | boundary (cm) |
|---|---|---|---|---|---|---|---|---|
| walk → run → 180° turn → stop | red → red | 5.4 → 3.6 | 5.4 → 3.6 | 0.8 → 0.8 | 2 → 0 | 4 → 2 | 4.6 → 4.0 | 4.6 → 4.0 |
| walk, 90° turn, stop | green → green | 1.0 → 1.0 | 1.0 → 1.0 | 0.8 → 0.8 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.2 → 1.2 |
| turn round on the spot | green → green | 3.9 → 3.9 | 3.9 → 3.9 | 0.1 → 0.1 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.7 → 1.7 |
| up the ramp, stand | green → green | 1.7 → 1.7 | 1.7 → 1.7 | 1.4 → 1.5 | 1 → 2 | 0 → 0 | 0.0 → 0.0 | 3.0 → 2.7 |
| stairs up, stand, down | red → red | 2.1 → 2.0 | 2.1 → 2.0 | 1.1 → 1.1 | 7 → 5 | 5 → 2 | 6.9 → 3.9 | 3.9 → 3.9 |
| slow walk (half stick), stop | green → green | 2.1 → 1.7 | 2.1 → 1.7 | 1.0 → 1.0 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 2.7 → 1.9 |
| jog, 45° and back, stop | green → green | 1.3 → 0.8 | 1.3 → 0.8 | 0.8 → 0.8 | 1 → 0 | 0 → 0 | 0.0 → 0.0 | 2.9 → 2.0 |
| stand still 6 s | green → green | 0.1 → 0.1 | 0.1 → 0.1 | 0.1 → 0.1 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 0.0 → 0.0 |
| gaits: walk → jog → sprint → jog → walk → stop | green → green | 5.2 → 3.4 | 5.5 → 3.6 | 1.0 → 1.7 | 2 → 0 | 0 → 0 | 0.0 → 0.0 | 1.7 → 1.7 |
| starts and stops, walk and run | red → green | 5.3 → 3.7 | 12.0 → 4.2 | 1.3 → 1.3 | 4 → 2 | 2 → 0 | 3.3 → 0.0 | 2.8 → 2.7 |
| setting off the other way | red → red | 5.3 → 5.3 | 10.0 → 7.3 | 1.2 → 1.3 | 5 → 3 | 4 → 2 | 4.3 → 3.5 | 3.8 → 3.5 |
| pivots standing: 90° each way, 180° | green → green | 5.5 → 5.5 | 5.5 → 5.5 | 0.4 → 0.4 | 1 → 1 | 0 → 0 | 0.0 → 0.0 | 1.5 → 1.5 |
| pivot 180° at a jog, and at a sprint | red → green | 5.2 → 3.8 | 7.5 → 4.4 | 1.0 → 1.0 | 5 → 2 | 4 → 1 | 6.1 → 3.5 | 5.6 → 2.6 |
| curve: the stick round a circle at a jog | green → green | 1.0 → 0.8 | 1.0 → 0.8 | 0.8 → 0.8 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.5 → 1.5 |
| down the ramp, stop on it | red → red | 3.7 → 2.7 | 3.7 → 2.7 | 1.4 → 1.3 | 2 → 2 | 2 → 2 | 4.7 → 4.7 | 3.2 → 3.2 |
| stairs at a run | red → red | 5.4 → 3.4 | 5.4 → 3.4 | 0.2 → 0.1 | 5 → 4 | 8 → 6 | 7.2 → 9.1 | 5.9 → 2.9 |

red runs 7 → 5 of 16; limits failed 16 → 7; mean slide p95 3.4 → 2.7 cm; mean pops 2.2 → 1.3 /min; mean jolts 1.8 → 0.9 /min; mean worst boundary 2.9 → 2.3 cm

Green now: starts and stops (pops 4 → 2, slide max 12.0 → 4.2 cm), the 180° pivots at a jog and a sprint (boundary 5.6 →
2.6 cm, pops 5 → 2). Locked on, walking back (node, 8 s, `tests/strafe.test.js`): pops 14 → 2, a held foot over its hold
1.0 → 0.2 cm; strafing unchanged (2 pops in 10 s). `tests/motion-qc.test.js` ("the 180° turns at a run, starts and
stops…", the facing's jerk, `GAIT_HOLD`) and `tests/strafe.test.js` (the walk back's pops, no longer todo) hold these.

In the game (Mac, muted headless Chrome, Medium, the desert and the Arena; before once, after twice):

| world | pops /min | jolts /min | boundary (cm) | slide p95 (cm) | held (cm) | crossed |
|---|---|---|---|---|---|---|
| the desert's dunes | 9 → 2, 5 | 12 → 6, 9 | 6.7 → 5.2, 6.0 | 5.2 → 6.0, 5.8 | 1.8 → 1.8, 1.8 | 0 → 0, 0 % |
| the Arena's floor | 5 → 3, 2 | 4 → 6, 5 | 6.1 → 4.5, 4.4 | 6.0 → 4.4, 4.2 | 2.0 → 1.0, 0.9 | 7 → 0, 0 % |

The sprint's push-off calves (14-18 rad/s, 5 in the desert, 2 in the Arena) gone but one; the pivot into a jog at 90°
(`jog2`): its calf 33-37 → 21-26 rad/s (one desert run none); the sprint reversed's calf 20-21 → 19-21 rad/s (one Arena run
none): as it was. The desert's slides read 5.2 before and 6.0, 5.8 after (the second round's after: 7.8-8.5): within the
runs' spread on the dunes.

**Left red** (node, the todo tests): the stairs (5 pops a minute, a 3.9 cm boundary: a foot lifting off the lower step
for the next one, let go as the clip's ball passes the riser, rises 10 cm a frame at once, the calf 26 rad/s) and at a run
(4 pops, 6 jolts a minute, a 9 cm jolt: a riser every 2-3 frames, the drawn body climbing 6-10 cm a frame by turns);
walk → run → 180° turn → stop (a 4.0 cm boundary: the running turn's swinging foot, swung round at 13 m/s by the body
turning 30 rad/s, eased to nothing over the 3 frames before it touches down); setting off the other way (a 3.5 cm
boundary, the pivot into a jog's lift-off); down the ramp (a 3.2 cm boundary, a calf 23 rad/s at a touchdown downhill, the
drawn foot at the leg's soft reach). In the game: the pivot into a jog at 90° (a calf 21-26 rad/s) and the sprint
reversed's calf (19-21).

**Issue #47 on B3, the fourth round** (2026-10-15):

- **The running 180° turn's foot.** Turning round at a run the facing came round at 28 rad/s at its fastest, and the
  swinging foot, carried round the body at 11-13 m/s, met the ground with its landing's hold-back at its 20 cm limit:
  it stopped in the three frames before touchdown (the 4.0 cm boundary). Running, the facing turns no faster than
  `FACE.runMax` (18 rad/s; 16 made him face back in 0.37 s, over the 0.35 s `tests/locomotion.test.js` holds him to), and
  a landing foot is held back by up to 30 cm (`FEET.landBack` 0.2 → 0.3). The chest is half way round in 0.18 s (0.15).
- **A pivot's step cut short.** A turn on the spot that becomes a walk or a jog (setting off the other way, down the
  ramp) ended the pivot with its step round 0.78 of the way: cut there, the foot was set down or let go where it was,
  stopped dead from 1-2 m/s in a frame (3.2-3.5 cm). A pivot's step past half way finishes first (`FEET.pivotFinish`), then
  lands or goes with the stride.
- **A captured move's weight.** A move eased in and out along a straight ramp, which starts and stops the pose's drift
  toward the loops at once: the arm 3.5 cm off its curve as a turn into a jog at 90° ended. Laid on along a smoothstep of
  the ramp (`MOVES.smooth`, src/loco-moves.js); every blend boundary of the course came down (every gait 1.7 → 1.0 cm).
- **The stairs at a jog.** Lifting off the lower step, the clip's foot is already over the next one: let go at
  `releaseRate`, the foot's pull toward it came in fully in two frames and it rose 11 cm a frame, the calf 35 rad/s. A foot
  let go from a level tread with the clip's place 6 cm or more over it eases off toward a goal itself eased (`FEET.releaseLag`,
  40/s; `releaseLagRise`, `releaseLagLevel`: up a dune's slope the later release made the sprint's knee pop). Stepping
  down, a free foot followed the stair it was over and met the one below 9 cm up (the calf 24 rad/s): under 6 m/s and
  over a level tread it rides down toward the floor ahead too (`FEET.rideDownAhead`; down the ramp it set the feet down
  early and they sank; at a sprint its stride lands well past the edge it looked over).

Tried and left out: a longer, smoothstepped landing for a fast foot (`landTime` stretched by its speed: the running
turn's boundary 4.6 cm); the stairs at a run's drawn body as a critically damped spring with the flight's climb as its
speed (it overshot the landing by 22 cm), or eased a second time (27 cm jolts); the floor ahead read against the body's
own climb (a riser then lifted the foot in a frame); a least fold of the leg (a 9 cm jolt down to 5, others up); rides
up eased (`rideUp`) with a held foot's ride its own floor's height; the eased release for every foot or every stretched
one (the starts and stops, the 180° pivots red).

Node, the default way (`diff.mjs`, before on a9a8ed0f):

| scenario | verdict | slide p95 (cm) | slide max (cm) | held (cm) | pops /min | jolts /min | worst jolt (cm) | boundary (cm) |
|---|---|---|---|---|---|---|---|---|
| walk → run → 180° turn → stop | red → green | 3.6 → 3.7 | 3.6 → 3.7 | 0.8 → 0.8 | 0 → 1 | 2 → 1 | 4.0 → 3.2 | 4.0 → 2.7 |
| walk, 90° turn, stop | green → green | 1.0 → 1.0 | 1.0 → 1.0 | 0.8 → 0.8 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.2 → 1.2 |
| turn round on the spot | green → green | 3.9 → 3.9 | 3.9 → 3.9 | 0.1 → 0.1 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.7 → 1.7 |
| up the ramp, stand | green → green | 1.7 → 1.7 | 1.7 → 1.7 | 1.5 → 1.5 | 2 → 2 | 0 → 0 | 0.0 → 0.0 | 2.7 → 2.1 |
| stairs up, stand, down | red → green | 2.0 → 2.0 | 2.0 → 2.0 | 1.1 → 1.1 | 5 → 3 | 2 → 2 | 3.9 → 3.7 | 3.9 → 2.5 |
| slow walk (half stick), stop | green → green | 1.7 → 1.7 | 1.7 → 1.7 | 1.0 → 1.0 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.9 → 1.9 |
| jog, 45° and back, stop | green → green | 0.8 → 0.8 | 0.8 → 0.8 | 0.8 → 0.8 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 2.0 → 2.0 |
| stand still 6 s | green → green | 0.1 → 0.1 | 0.1 → 0.1 | 0.1 → 0.1 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 0.0 → 0.0 |
| gaits: walk → jog → sprint → jog → walk → stop | green → green | 3.4 → 3.5 | 3.6 → 3.7 | 1.7 → 1.7 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.7 → 1.0 |
| starts and stops, walk and run | green → green | 3.7 → 4.3 | 4.2 → 4.8 | 1.3 → 1.3 | 2 → 2 | 0 → 0 | 0.0 → 0.0 | 2.7 → 2.2 |
| setting off the other way | red → green | 5.3 → 5.3 | 7.3 → 7.3 | 1.3 → 1.3 | 3 → 3 | 2 → 0 | 3.5 → 0.0 | 3.5 → 2.4 |
| pivots standing: 90° each way, 180° | green → green | 5.5 → 5.5 | 5.5 → 5.5 | 0.4 → 0.4 | 1 → 1 | 0 → 0 | 0.0 → 0.0 | 1.5 → 1.5 |
| pivot 180° at a jog, and at a sprint | green → green | 3.8 → 3.8 | 4.4 → 4.4 | 1.0 → 1.0 | 2 → 1 | 1 → 0 | 3.5 → 0.0 | 2.6 → 2.4 |
| curve: the stick round a circle at a jog | green → green | 0.8 → 0.8 | 0.8 → 0.8 | 0.8 → 0.8 | 0 → 0 | 0 → 0 | 0.0 → 0.0 | 1.5 → 0.9 |
| down the ramp, stop on it | red → green | 2.7 → 2.7 | 2.7 → 2.7 | 1.3 → 1.3 | 2 → 2 | 2 → 1 | 4.7 → 4.7 | 3.2 → 2.4 |
| stairs at a run | red → red | 3.4 → 3.6 | 3.4 → 3.6 | 0.1 → 0.1 | 4 → 4 | 6 → 6 | 9.1 → 9.1 | 2.9 → 2.8 |

red runs 5 → 1 of 16; limits failed 7 → 2; mean slide p95 2.7 → 2.8 cm; mean pops 1.3 → 1.2 /min; mean jolts 0.9 → 0.6 /min; mean worst boundary 2.3 → 1.9 cm

Under matching (`?mm=1`) nothing changed (15 of 16 red before and after). In the game (Mac, muted headless Chrome,
Medium, every world's course; before once, the desert twice; after three times, the machine's load 8-29):

| world | pops /min | jolts /min | boundary (cm) | crossed |
|---|---|---|---|---|
| the desert's dunes | 3, 7 → 2, 4, 5 | 10, 12 → 7, 5, 7 | 4.4, 14.2 → 5.3, 3.4, 4.5 | 0, 4 → 0, 0, 3 % |
| the Signal Market's street | 3 → 2, 2, 3 | 5 → 5, 8, 3 | 6.0 → 2.6, 4.4, 3.8 | 0 → 0, 11, 0 % |
| the Arena's floor | 3 → 1, 3, 2 | 4 → 2, 4, 2 | 4.8 → 2.8, 4.6, 4.3 | 0 → 0, 0, 0 % |

The Arena's floor came out within every limit in one run, the first time. The street's 11 % was one standing 90° pivot
in one run (the Arena's pivot read 0-7 % from run to run in the second round).

**Left red** (node, the todo test): the stairs at a run, 4 pops and 6 jolts a minute (a 9.1 cm jolt). A riser passes
under him every two or three frames: the drawn body (`StepLag`) rises 6 cm one frame and 10 the next by turns, and the
held feet and knees read against it jolt 3-7 cm; the sprint's kick-back, lifted over the floor ahead, comes within 11-18 cm
of the hip, where the knee's bend is barely defined, and the thigh turns 45 rad/s in a frame. In the game: the pivot into
a jog at 90° (`jog2`, a calf 21-27 rad/s, a 4.4-6.7 cm jolt at its blend; node's turn into a jog at 90° has its 16-23 rad/s
calf too, within the limit's count) and the sprint reversed's calf (15-16).

**Issue #47 on B3, the fifth round: a flight at a run** (2026-10-16). Round 4's last red needed a redesign of how the
drawn body and the swinging foot follow a fast flight, not more tuning. Frame by frame (node), at 8.2 m/s on the course's
18 cm × 32 cm stairs: a riser every 2.3 frames, a climb of 4.6 m/s, and the sprint's stride takes the eight steps in two
footfalls (the first on step 1, the next on step 8).

- **The drawn body on the stairs' line** (`StairLine`, src/locomotion.js, inside `StepLag`). Eased after each riser, the
  body climbed 3.8, 7.7, 6.1, 9.5, 7.4 cm a frame by turns and stopped dead at the landing from 4.6 m/s up. Now, from 4.5
  to 6.5 m/s along the ground (`STAIR_LINE.fast`), the floor ahead is read (a ray every 8 cm to 0.6 m ahead, each jump of
  3-60 cm bisected to a centimetre; a slope's jump shrinks as it is bisected and is not a riser), and each riser is kept
  where it was found (a point and the way he was going: its distance along that way stays put as he turns) until it is a
  window behind him. The body rides the floor's profile smoothed by a window `width` (0.45 m) either side, read `lead`
  (0.15 m) ahead: Σ rise · C((lead - s) / width), C a smootherstep from 0 to 1, s each riser's distance ahead. On an even
  flight that is the line through the treads' middles (its ripple under 3 mm for treads of 25-36 cm); it bends onto a
  landing over the window's length; and it is continuous as the controller steps each riser (its height jumps a riser,
  the offset back by as much). Its share is eased in and out at 6/s; off in the air, on a moving floor, and when the
  risers kept disagree with the floor he is on by more than half a riser and 20 cm. On the level, slopes and dunes it
  finds nothing and adds nothing. Cost: 8 rays a frame at a run, 3 more for each riser found. Read 0.15 m ahead, the
  hips are over the tread he steps onto (read where he is, the landing legs stretched further down a flight).
- **The kick-back over a higher floor** (`FEET.rideOver`). The swinging foot rode the floor under it and ahead
  (`gRide`) on top of its own height: up a flight the sprint's kick-back, 40 cm up in the clip, rose another 20-30 cm
  and came within 11 cm of the hip. Now, from 4.5 to 6.5 m/s, a free foot over a higher floor rises only to clear it by
  min(its own height, 10 cm): a smooth max (6 cm soft) of its own height and that. Not as it comes in to land: from
  0.2 s before touchdown, fully by 0.1 s, it rises onto the tread by the floor's whole rise (cut there, the first foot
  onto the stairs dipped 5 cm and rose again). The nearest a foot comes to its hip on the flight: 11 → 31 cm.
- **A foot let go while still coming down** (`FEET.dropKeep`). The top stair's foot met the tread 14 cm up (its
  `dropIn`), was let go two frames on, and its drop was zeroed: it fell 8 cm in a frame, the foot 25-38 rad/s. It now
  goes on coming down as it eases off.
- **The knee on a flight** (`FEET.softFlight`; `o.flight` from the player, the line's share × its pitch). Down a flight
  the landing leg reached the tread below 95 % straight, where the knee's bend changes fastest with the leg's length, and
  the body coming down onto it at 4.6 m/s bent the knee 8 cm in the frame it landed (a 5.5 cm jolt, the calf 21 rad/s).
  On a flight at a run the legs' soft zone widens from `softFast`'s 5 % to 12 % (the pitch from 0.15 to 0.4): the jolt
  3.5 cm, no pop. Widened at every run it did as well on the course, but it would change every sprint: on flights only.

Tried and left out: a hard clamp on the swinging foot's distance from the hip, a least one (35-40 % of the leg: the foot
kinked off its path, new pops of 14-24 rad/s) and a most (85-90 %: held up, the foot was planted on the tread from higher
and the knee jolted 9-14 cm); the line read further ahead down a flight than up one (0.25-0.35 m: the lifting foot,
drawn under the tread it stood on, was lifted out of it in a frame, an 8 cm sink and a 9 cm jolt); a landing kept 10 cm
off a stair's edge (the first foot comes down with its ball a centimetre onto step 1, the heel over the riser: moved
over the landing's 0.07 s the foot jolted 5 cm, and over 0.15 s toward a predicted hold it got only half way and popped,
14 rad/s); the line's window 0.55-0.65 m (no clearer gain). Treads chosen by stride (every second or third step, as
people run stairs) would need a shorter, quicker stride at the controller's 8.2 m/s than the sprint loop has: at that
speed and cadence a stride covers seven or eight treads.

Node, the default way (`diff.mjs`, before on 87277301): the stairs at a run red → green, pops 4 → 1, jolts 6 → 2, the
worst jolt 9.1 → 4.2 cm, slide p95 3.6 → 3.6 cm, held 0.1 → 0.5 cm, boundary 2.8 → 2.8 cm; the drawn body's climb changes
by at most 5.5 → 2.3 cm a frame from one frame to the next. The other 15 runs read exactly as before. Red runs 1 → 0 of
16; limits failed 2 → 0; mean pops 1.2 → 1.0, jolts 0.6 → 0.4 a minute. Of what is left in the run, two are on the flat
as he sets off (a calf at 5 m/s, a ball at 7.5 m/s, before the stairs) and one the descent's touchdown, 3.5 cm. Under
matching (`?mm=1`): 15 of 16 red before and after, limits failed 65 → 65, pops 4.9 → 4.4 and jolts 7.3 → 6.9 a minute;
its stairs at a run's worst jolt 60.8 → 12.6 cm.

In the game (Mac, muted headless Chrome, Medium, every world's course: none has a flight, so nothing should change; three
runs each way, the change switched off with the skill's new `TUNE` and on; the machine's load 10-15):

| world | slide p95 (cm) | pops /min | jolts /min | boundary (cm) |
|---|---|---|---|---|
| the desert's dunes | 5.0, 5.6, 4.6 → 7.7, 5.7, 4.4 | 4, 5, 4 → 4, 6, 5 | 9, 10, 8 → 8, 8, 6 | 3.1, 5.6, 3.0 → 6.0, 4.4, 3.9 |
| the Signal Market's street | 4.6, 4.5, 7.3 → 6.0, 5.0, 4.7 | 2, 1, 1 → 2, 3, 3 | 3, 6, 3 → 1, 3, 3 | 3.6, 4.5, 5.0 → 4.4, 5.6, 3.5 |
| the Arena's floor | 4.6, 4.2, 6.6 → 4.4, 4.3, 7.8 | 3, 2, 2 → 1, 2, 2 | 6, 5, 3 → 3, 3, 2 | 3.9, 2.8, 4.7 → 5.7, 4.6, 6.1 |

Within the runs' spread, with the same events either way: the pivot into a jog at 90° (`jog2`, a calf 14-27 rad/s, its
blend 4.4-6.1 cm) and the sprint reversed (a calf 14-21). `tests/motion-qc.test.js` ("fifth round": the run green, the
body's climb, the feet's distance from the hips; and `StairLine` on a made-up flight) holds these; no test is todo now.

**Left red**: none in node. In the game, as in round 4: the pivot into a jog at 90° (`jog2`) and the sprint reversed's
calf, every world's course over the 3 cm boundary in most runs.

**Issue #47 on B3, the sixth round: the game's reds** (2026-10-16). The node QC was all green after the fifth round;
the game's (the desert, the Signal Market's street, the Arena) was not: the pivot into a jog at 90° (`jog2`, a calf
20-27 rad/s and a 4.4-6.7 cm jolt at its blend in every run), the sprint reversed (a calf 14-21 rad/s, 3-4 cm), jolts
by the handful at a sprint. What the game has that node hadn't: its frames. In headless Chrome a frame is 15-19 ms,
not 16.7, and on a busy machine 30-50 ms by the hundred.

- **The judgement at the frames' own times** (scripts/motion-qc/lib.mjs `cubicWeights`). A jolt is a joint off the cubic
  through its places two frames either side; the cubic took the frames as evenly spaced, so a smooth swing at a run,
  sampled unevenly, read 2-4 cm off its curve. It is now the cubic through the four frames at their times (Lagrange), each
  pose at the end of its frame (both recorders stamp a sample at its frame's start). Evenly spaced, the weights are the
  old ones, and node's runs read as before. In node at uneven frames, eight runs' jolts 55 → 22; the fifth round's game
  runs, judged again, 0-1 fewer a minute (their frames were steadier than the seeded walk).
- **The game's frames in node** (scripts/motion-qc/scenarios.mjs `WORLDS_FLAT`, `unevenFrames`; run.mjs `frames`): the
  worlds' course on the node course's flat ground at seeded 15-19 ms frames. It plays the game's reds: every seed had the
  `jog2` calf pop and its 5-7 cm blend, which a run at even frames never showed.
- **The pivot into a jog at 90°** (`FEET.lateRelease`). Turning on the spot holds both feet; turning into a jog, the
  pivot ends when the body passes 2.9 m/s, and the gait under it has the held foot nearly at the end of its swing by then.
  Let go two or three frames before the jog's touchdown for it, 60 cm from where the jog sets it down, the foot was pulled
  9 cm toward there in a frame, planted again where it was drawn and stopped dead: the calf 22-29 rad/s. Whether the pivot
  ended six frames before that touchdown or two was the frames' timing. Now a foot let go (by the gait or out of reach)
  with the clip's touchdown under 0.1 s away lands only once little (15 %) is left on its old hold: it goes over to the
  clip's place in its release's arc, and lands there.
- **The sprint reversed**: a frame of no speed (`WARP_HOLD`, src/locomotion.js `gaitFeet`). The body's speed passes
  through nothing for a frame on its way from 8 m/s one way to the other, and the stride's warp (the body's speed over the
  loops' sweep) fell back to 1 there: the clip's feet reached out their whole stride for one frame, a swinging foot 8 cm on
  and 16 back (an 11.6 cm jolt). With the gait over half the pose the warp of the frame before is kept (`Animator`'s
  `GAIT_HOLD` keeps the gait's weights through the same frame).
- **The foot held through a half turn** (`FEET.ballTurn`). The running 180° turns the body round over its held foot, and
  as that foot was let go its knee, bent over toes pointing back, swung across to the front, 7-8 cm a frame, the calf 18-21
  rad/s. Moving, a held foot turned more than 0.4 rad from the clip's way turns on its ball toward it at up to 14 rad/s, as
  a pivoting foot does.
- **A push-off braking** (`FEET.pushOffBrake`). A sprint's held foot lets go once the hips, a moment ahead at the body's
  speed, would have its leg at full length; at a reversal's first frame, braking from 8 m/s at 100 m/s², that let the
  stance foot go with the clip's contact still full, and it skimmed the floor 5-12 cm a frame as the body came round (the
  Arena's 21-31 cm slides). The hips' lead counts the braking.
- **A settling step lifts before it moves** (`FEET.stepMove`): it goes over between 10 % and 85 % of its time, so its ball
  never travels on the floor. Not a pivot's quick steps: the walk back's first step then popped its calf (16 rad/s).
- **Unsteady runs** (the skill's run.mjs): a browser run with over 2 % of its frames longer than 22 ms is printed
  UNSTEADY and marked so in motion-world.json. A desert run with 219 such frames read 8 pops and 17 jolts a minute, a steady
  one 2-3 and 4-6: the springs and the contacts' timing then measure the machine.

Tried and left out: a landing counted by where a fast fall will have it (`landFall`: the running reversal's foot meets
the landing window in its last frame; counted earlier, the sprint's slides grew 1 cm everywhere and down the ramp a 3.3 cm
blend; only while braking, a jog's speeding into a sprint jolted 8.9 cm); a pivot setting off past `pivotStepSpeed`
letting its held foot go at once (blends of 4.8-4.9 cm); the late release faster, or lifting at once, or its ball held
longer (each moved the slide to the next step); a pivot's quick step set down later or steeper (the pivots' slides 5.5 →
1.0 cm, but 4-8 pops a minute); the step's path push let go sooner; a knee's way turned back slower than the hold's weight;
the jog and the walk loops smoothed like the sprint (no change).

Node, the QC's course (`diff.mjs`, before on 72377dec9): every run green before and after; mean slide p95 2.8 → 2.6 cm
(up the ramp 1.7 → 0.8, the stairs 2.0 → 1.0, down the ramp 2.7 → 2.2: the settling steps), every other measure as it was.
Matching: 15 of 16 red before and after. The worlds' course at the game's frames (six seeds, the change off → on): red
runs 6 → 2, pops 11 → 4, the `jog2` calf 22-29 → at most 15 rad/s, its blend 5.4-6.7 cm → under 3 in every seed.

In the game (Mac, muted headless Chrome, Medium; before: the fifth round's three runs on 72377dec9, judged again with the
new judgement; after: four runs, the steady ones only, the machine shared with a Unity build):

| world | pops /min | jolts /min | boundary (cm) | slide p95 (cm) |
|---|---|---|---|---|
| the desert's dunes | 4, 6, 5 → 3 | 7, 7, 6 → 6 | 6.0, 4.5, 3.9 → 3.3 | 7.7, 5.7, 4.4 → 5.7 |
| the Signal Market's street | 2, 3, 3 → 0, 0, 3, 1 | 2, 3, 2 → 2, 1, 3, 2 | 4.4, 5.6, 3.5 → 3.6, 3.5, 3.8, 2.4 | 6.0, 5.0, 4.7 → 5.5, 4.5, 4.9, 5.3 |
| the Arena's floor | 1, 2, 2 → 1, 1, 0 | 3, 2, 2 → 1, 2, 1 | 5.8, 4.4, 6.0 → 3.7, 2.4, 3.7 | 4.4, 4.3, 7.8 → 6.6, 4.3, 4.7 |

The street and the Arena each came out within every limit in one run (the Arena once in the fifth round, the street
never). `tests/motion-qc.test.js` ("sixth round": the uneven-frame course at four seeds, the judgement at uneven frames,
the warp held) holds these.

**Left red**, in the game: the sprint reversed's landing (a 3.3-3.8 cm blend: its foot, swung round, falls its last 20-30
cm in four frames and meets the landing window only in its last frame), a settling step after a pivot touching down
3-4 cm a frame (slide p95 6-7 cm in some runs), and on the dunes the sprint's feet over the slopes (jolts 4-5 cm, 6 a
minute).

**Issue #699: Breath of the Wild's direction, no matching** (2026-10-26; the study, its sources and numbers:
docs/design/locomotion-botw-study.md). Motion matching is set aside; the loops, the captured moves and feet.js stay. Link sets
off as quickly as the traveller (~0.3 s to a run against 90 % of the speed in 0.28 s) and runs at the same cadence (0.83 s a
cycle), but carries his chest well forward, and stops over two braking strides in ~0.8 s where the traveller stopped in 0.34 m.

- **The chest at a run** (`LOCO.leanRun`, `LOCO.leanCarry`): setting off into a run the chest may tip to 14° (9° before), and at a
  run it is carried 3.4° forward. The hips keep the old lean's share (`Locomotion.leanHips`): tipped from the hips, a sprint's
  planted feet slid 8-10 cm in the game.
- **The bank** grows from a jog to a sprint (`LOCO.bankRun`): 7.2° round a sprint's circle (5.0°); at a walk as before (a pivot
  into a walk back popped the calf with it).
- **The carried stop**, a switch (src/loco-moves.js `STOP_FEEL`, `braking`, `stopSetting`; `?stop=carry`, the dev menu's Story
  tab): from 3.2 m/s or more the speed falls by at most 16 m/s², 1.9 m and 0.63 s from a sprint; the captured stop is played by the
  distance left at that rate (`LocoMoves.brake`). Off, the controller brakes exactly as before.
- **Tools**: `node scripts/motion-qc/feel.mjs [--carry]` (the controller's numbers: starts, stops, the reversal, the lean and the
  bank), `node scripts/motion-qc/worlds-flat.mjs` (the worlds' course at the game's uneven frames, six seeds), the QC's way
  `carry` (node and the browser), and `CDP_PORT` for the browser run.

The node course stays 16 of 16 green with every mean as it was; the game's three worlds are within their run-to-run spread.
Tried for the last reds and left out: a touchdown cushion, the stride warp eased, the cadence held through a reversal, a longer
blend-in of the captured moves (the study says what each did).

**Issue #704: Kevin Iglesias's sprint, a switch** (2026-10-27). The author's try of a sprint closer to Breath of the Wild's:
the sprint from Kevin Iglesias's *Human Basic Motions FREE* (docs/motion-data.md) in the library sprint's place, for the
traveller only (the people keep Sprint_Loop). Over each rig's standing pose it leans 43° to the library's 32°, the hands swing
0.78 of the body's height front to back (0.44), the elbows come up past the shoulders.

- **The clip**: `node scripts/mocap/build-sprint.mjs` (scripts/mocap/kevin-sprint.js) reads the pack's FBX with the Mixamo
  pipeline (fbx.js, the rig's map `KEVIN_MAP`: one spine bone and the chest, so spine_02 and spine_03 both take the chest),
  retargets it onto the UAL skeleton on the spot (root `fixed`, the head's turn kept for the head nod), closes the loop (the
  last frame the first, the drift taken out evenly: 0.1°) and writes `public/anim/sprint-kevin.glb` (33 frames at 60 a
  second, 14 KB) with build-library's skeleton, so it binds onto the library's. No contact labels: on the spot a planted
  ball sweeps back at the run's speed; the Animator measures its feet itself (`gaitOf`).
- **The switch** (src/animator.js `SPRINTS`, `sprintSetting`, `loadSprintClip`, `sprintFrom`, `Animator.useSprint`):
  `?sprint=kevin` / `?sprint=ual`, the dev menu's Story tab ("Kevin Iglesias's sprint", at once), kept on this device; the
  engines read the same setting (`-js-on kevinSprint` in a Unity batch, `-sprint-shots 8` for eight pictures of a sprint; their dev
  menu has no motion tab). `useSprint` swaps the loop's action, measures its
  feet and shifts its phase so its left touchdown falls where the library sprint's does (the jog's blend into it keeps the
  feet together). Smoothed as the library's sprint (`SMOOTH_LOOPS`), its legs a little more (0.045 s: keyed at 60 a second,
  his foot slapped flat in a frame).
- **The stride** (`SPRINTS.kevin.strideK` 1.1): his own stride is short (3.1 m a cycle on the library body against 5.8), so at
  8.2 m/s he runs 2.3 cycles a second (the library's 1.9). At his own cadence (strideK 1.4) the long stance left the planted
  foot out of reach behind him and it skidded 20-46 cm stopping; at the library's 0.75 his knees popped 20-40 times a minute.
- **feet.js `relockSlow`**: a foot let go out of reach at a run's speed (over 5 m/s) with the contact still full plants again
  once the body is under 3 m/s and the clip's foot within 3 cm of the ground. His sprint reversed as a long stance pushed off
  skidded the foot 29 cm with the body (walk → run → 180°: 7.5 cm now). The default way's numbers are unchanged.
- **The lean**: left as it is (`LOCO.leanCarry`'s 3.4° on top): the drawn chest at a steady sprint, pelvis to neck, is 44.8°
  with his sprint, 32.5° with the library's (the Arena, side on); the author judges.

The node course (17 scenarios with the new "curve at a sprint"), default against `--ways kevin`:

| scenario | default: slide p95/max, pops, jolts /min, boundary | kevin |
|---|---|---|
| walk → run → 180° turn → stop | 3.7/3.7 cm, 1, 1, 2.8 cm | red: 4.1/7.5 cm, 4 pops, 0, 2.3 cm |
| gaits: walk → jog → sprint → jog → walk → stop | 3.5/3.7, 0, 0, 1.0 | 3.5/3.6, 1, 0, 1.6 |
| starts and stops, walk and run | 4.3/4.8, 2, 0, 2.2 | red: 3.5/5.7, 3, 1, 3.3 (a hand at the stop's blend-in) |
| pivot 180° at a jog, and at a sprint | 3.8/4.4, 1, 0, 2.4 | red: 5.1/5.7, 0, 1, 3.2 (a hand) |
| curve at a sprint | 3.6/3.8, 1, 1, 2.8 | 4.8/4.9, 2, 0, 2.3 |
| stairs at a run | 3.6/3.6, 1, 2, 2.8 | red: 4.8/4.8, 7 pops, 4 jolts, 3.1 (the feet, 14-30 rad/s) |

Default 17 of 17 green, kevin 13 of 17 (the rest identical). In the game (the skill's run, desert / bazaar / arena, both ways
red on this machine): slide p95 4.8 / 5.4 / 4.4 cm (default 5.3 / 7.2 / 4.1), pops 6 / 4 / 5 a minute (3 / 0 / 2), jolts 2 / 0 / 2
(8 / 2 / 2), the arena's held foot 4.3 cm (1.0). What is left: his feet flick a little more at touchdown (the clip's own
slap, 14-16 rad/s against the 14 limit), the hands' faster swing crossing a captured stop's blend-in by 3.2-3.3 cm, and the
stairs at a sprint. Tried and left out: more blur on the feet alone (fewer pops, more slide), strideK 1.0-1.5 and leg blur
0.035-0.07 (a chaotic trade between the two).

## The Motion page: the loops against motion matching (`motion.html`, `src/motion/`)

A page of its own to watch the traveller's two ways of moving and the people's walks, and see where
each wins: `motion.html` (`npm run dev` at `/motion.html`, on GitHub Pages at `…/hiraeth/motion.html`,
from the character studio's header, or the dev menu's *Motion* section in the game). It is the third
entry of the build (`BUILD_INPUT`), drawn by the game's own pipeline (`src/pipeline.js`: shadow
cascades, the G-buffer materials, the ink pass, FXAA), and loads no world: the test course of the gait
harness (flat ground with a metre grid, the 12° ramp, the 18 cm stairs) with a few pillars and crates
to walk round, the people's assets, and the captured motion. It lists and plays whatever
`anim/locomotion.glb` holds, so Mixamo's clips show up once the library is rebuilt with them.

- **Side by side**: two travellers in two lanes (the loops at +x, matching at -x), driven by the same
  input at the same time: your keyboard or pad (camera-relative, as in the game), or a scripted run of
  the harness (the eight of `compare.mjs`, and starts and stops over and over). The controller never
  depends on the animation, so both bodies move exactly alike; only the poses differ. Split screen (each
  half follows its own traveller, the other hidden), one view of both, or either alone; from the side,
  from behind (swinging round after the body) or orbiting.
- **One, toggled**: one traveller and a loops / motion matching switch, to compare in place, with the
  matcher's live state (the clip and frame it plays, mirrored or not, the cost against `maxCost`, its
  share of the pose and why the loops took over, the playback warp, jumps and searches) and on the
  ground: the stick's predicted trajectory (`MotionMatcher.predict`) now and as it was 1 s ago, the
  matched clip's own path ahead (the database's trajectory features of the frame playing), the path
  walked, and each foot planted (filled, with a cross where feet.js holds it and a line if the ball has
  left it), stepping (a ring) or down by the gait but not held (a faint ring).
- **People's walks**: a row of walkers (the studio's blank body, no robe over the legs), each on the
  library's walk or any captured walk (`Animator.useWalk`), with its speed; *Every walk* puts all
  thirteen at their captured pace. One plain gait style for all unless *their own gait style* is on.
- **Numbers**, live: the harness's measures (`src/gait-course.js measure`: slide max / mean, held,
  sink, head jerk, the biggest bone turn) over the run so far and the whole last run (your control:
  the last 20 s), the better in bold; and how far the stick's prediction and the matched clip's path
  were, 1/3, 2/3 and 1 s on, from where the body got to. A whole scripted run gives the harness's own
  numbers (the walk → run → 180° turn: 0.16 / 0.051, 0.003, 0, 2.63 against 0.27 / 0.086, 0.012,
  0.001, 3.18, as `compare.mjs`): the page steps at the harness's fixed 60 Hz, so slow motion (0.5×,
  0.25×) shows each step for longer, and *Step* (or `.`) plays one.
- Every setting is in the URL (`src/motion/state.js`, only what differs from the defaults), e.g.
  `motion.html?mode=solo&mm=true&run=stairs&rate=0.25&view=behind` or
  `?mode=people&walkers=library:1.25,cmu_142_07:0.6`.

The course, the runs and the measures moved from `tests/gait-sim.js` into `src/gait-course.js`
(browser-safe), which the harness, `compare.mjs` and the page share; the harness's output is unchanged.

## Locked on: the steps in place (v1.77, issue #360)

The author: "when fighting the mother snapper and straffing left and right I get a very choppy animation". Recorded
frame by frame in the Mother's Hall (muted headless Chrome, the traveller strafing left and right at full stick,
locked on): his heading turned an even 0.007 rad a frame, the lock's line and the camera moved smoothly (under 9 mm of
second difference), the frame step was even; but his hips jumped 1.2–1.3 m in one frame every 20 frames, and his feet
10 cm at each wrap. The Sword and Shield pack's strafes and walk back (`LOCK_MOVE`'s clips) came out of the mocap
pipeline with their root held still (`root: 'fixed'`) and their whole travel left in the pelvis, 1.27–1.36 m a cycle;
played round and round at the lock's pace (3.7 times their own), the body slid that far off the controller's place over
each cycle and snapped back as the loop wrapped. Their last frames were also up to 12° off their first at the feet and
calves. `loopInPlace` (`src/motion-match.js`, as the moves load) takes a loop with no ground track of its own, removes
the pelvis's drift from first frame to last evenly over the cycle about its middle, and turns each bone's last frame
back onto its first the same way. `tests/strafe.test.js`: every shipped loop closes and stays on the spot; locked on,
left and right, the hips move at most 10 cm against the body in a frame (was 121.6, now 4.5), no joint jolts 20 cm
(was 66, now 8), the facing turns smoothly. Left after #360: the feet's holds at the strafe's 3.7-times cadence still popped the calves (~45 a minute in Node, ~100 in
the game); fixed in v1.78, below.

### Locked on, sideways: the side-run (v1.78, issue #47)

Frame by frame (node and the Mother's Hall), the pack's two "strafes" step **forward and back**, not sideways: with the
body facing the foe, the planted foot swept 46 cm along the facing while the body went 3.8 m/s across it. Every held
foot was dragged sideways off its hold (8-9 cm) and let go at full stretch, at 3.7 times the clip's cadence. Sideways
(`left` / `right`) the strafe clip is no longer played: the loops' own jog or run plays under him, and the drawn body
is turned the way he goes (`Player.sideRunTurn`, on the object's facing, so the animator, the feet and the loops all
see legs running forward), by the angle from the facing to the velocity (up to `LOCK_MOVE.sideRun`, 1.6 rad), times the
side's weight, eased as a critically damped spring (`yawK` 20/s: following the weight, a change of side turned the hips
0.4 rad a frame over both held feet). The back is then turned round again over spine_01..03 (`LOCK_MOVE.twist`, 0.3 /
0.35 / 0.35) after the hands are posed, so the chest, the arms and the head face the foe (the hands posed after the
twist kept the legs' way and the forearm flipped 180° in a frame). The travel angle is read only while the velocity is
on the playing side's side (reversing, it swung through the facing in a frame as the old side faded). feet.js gets the
legs' way as `fwd`. The walk back keeps its clip, played at most `rateMax` (2.4) times its pace with the rest in a
longer step (`strafeRate`; feet.js `o.reach` scales the feet's reach along the way he goes, at most `reachMax`), and
the feet count a step played over the loops as walking (`o.gait` at least its weight: its clip has no path, so the gait
share fell to nothing and the feet held on as if standing).

| strafing | pops | jolts | held (cm) | steps' slide p50 / p95 (cm) |
|---|---|---|---|---|
| the game, Mother's Hall, 16.9 s | 101 → 2 | 99 → 2 | 8.7 → 0.8 | 18.7 → 0.5 / 55.6 → 11.1 |
| node, left and right, 8 s | 41 → 3 | 46 → 1 | 7.9 → 0.5 | 18.9 → 0.5 / 58.0 → 3.6 |
| node, the walk back, 6 s | 31 → 9 | 37 → 10 | 9.0 → 1.6 | 17.4 → 15.6 / 47.8 → 60.6 |

`tests/strafe.test.js`: the side-run's pops (≤ 5), jolts, held foot (< 2 cm), median slide (< 3 cm), the hips turned
and the chest within 25° of the foe; `strafeRate`; the bone-jump test now reads the drawn skeleton (the animator's calf
there is the run loop's own push-off, 0.63 rad in a frame, as when running anywhere). The walk back slid (16 cm at the
median: the clip's feet sweep 3.3 m/s at most); since the second round of issue #47 it is the loops' gait run backwards
(`LOCK_MOVE.backRun`, above): 1.1 cm at the median, its calves' pops left as a todo test.

## Combat transitions (v0.89)

Combat uses explicit wind-up, active and recovery timings, rather than searching the locomotion database.
`Animator.playCombat` applies full-body grounded swings after the locomotion layers, and blends from the
last displayed pose over 90 ms when a combat clip changes or releases control. Guard and airborne cuts
remain upper-body. Clip weights ease in/out and the existing foot contacts place grounded feet. This
works with default blended locomotion and the optional matcher; it does not change the matcher default
or claim to fix the speed/database mismatch measured above.

## People greeting you and getting out of your way (October 2026)

- **The wave** (`src/wave.js` `layWave`, from `NPC.pose`): for `WAVE.dur` (2.2 s) after someone greets
  you, their left arm comes out to the side and a little forward (`lift` 1.95 rad from hanging: the
  elbow about at the shoulder), the forearm stands up from it and swings side to side across the front
  (`fore` ± `sway` at `rate` 2.3 Hz), each joint slerped from wherever the clip had it by an eased weight
  (`waveWeight`: in over 0.35 s, out over 0.45). It used to set the Euler angles outright: the arm up
  past the head, the forearm bending about its own x, which with the arm raised swung the hand toward
  the face and back, and a snap to hanging at the first frame. `tests/wave.test.js`.
- **Stepping aside** (`crowd.js` `ASIDE`, `stepSide`; `NPC.sidestep`): a standing crowd person within
  1.25 m of their spot steps off it (at most 1 m) at no more than 1.1 m/s, and with you walking past,
  70 % of the way is out of your path to their side (your movement read from your place frame to
  frame) rather than straight back from you. Their step in their own frame (`p.stepDir`: left, right,
  back) has the near tier's body play the traveller's captured sidesteps or step back (`LOCK_MOVE`),
  their time following the ground covered, under Mixamo's breathing idle above the legs (the steps were
  captured with sword and shield: their raised arms threw the cape over the shoulders), and the cloth
  is told the way they really go. They used to slide at up to 2-3 m/s with the forward walk playing.
  `tests/close-contact.test.js`.


## Idle posture after short walks (#551)

The traveller's three captured idle variants start after seven seconds standing. Their original torso leans assume
the captured pelvis and foot movement, but the game keeps the standing legs planted. Overlaying the captured spine
above those legs made the traveller arch backwards during the look-around. `Animator.update` now requests each
traveller idle variant with `spine: false`: the standing pelvis/spine remain balanced while the arms and head gesture.
This includes the library look-around as well as the two Mixamo variants. The base standing weight shift, walking,
stopping and conversation overlays are unchanged. Both engines use this shared Animator.

`tests/idle-posture.test.js` runs two walk/long-idle cycles through all three variants and compares pelvis/spine
transforms with the base idle, while checking that arm gestures remain animated. Muted browser captures repeat
short walks and inspect immediate stops and ten-second waits from the side.
