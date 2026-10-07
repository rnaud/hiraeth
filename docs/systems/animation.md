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
lands on the ground under it (one `heightAbove` ray per sub-step, from where it
was, so nothing overhead counts as ground, along any "up"), with friction that
lets it come to rest on slopes up to ~20°; the trunk is pushed out of walls as
a capsule once a frame. `apply(humanoid)` turns the whole body with the trunk
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
  knuckles), so both hands and both bodies take the same numbers.
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
  them from its own state.
- **The wrists** (`Humanoid.update`, `Humanoid.turnHand`): the retarget poses each hand at its rest
  turn on the forearm every frame (`wristOf`); a clip then sets the wrist (`poseHands`), aiming turns it
  along the line of fire, and the glide's spread arms (`Player.spreadArms`) turn it with `turnHand`:
  fingers on along the forearm, palms down, the thumb's edge a little up, blended in and out with the
  wings. The hand bone used to keep its local turn from the last frame, and the arms' IK (which keeps
  a hand's world turn) fed the forearm's change back into it: gliding, the hands spun about 10° a
  frame.
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
  clip looks 15° down, at the ground; he now looks 0–12° down (7° on average), ahead as drawn.
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

## Vael's bird: standing, folding, flying (`src/bird.js`)

She stands tall on long wading legs (drumstick, hock, tarsus, three toes and a back one), as the Sky Stones'
sheets draw her: `FOOT` is the middle toe's base on the leg, `STAND` the height her body rides over the
ground (the legs' reach and a toe's thickness), used wherever she is put down, landed or held over the ground.
Her wings' pose is one function, `poseWings(wings, fold, flap, amp, flare, flapPower)`, shared with the
reference views: spread (fold 0) they beat; folded (fold 1, `FOLD`) each arm rolls about its own length,
sweeps back along her flank, its feathers drawn in to half their depth and the hand to a third of its size,
so the folded wing lies against her side and ends at her tail (the shoulder turns in YXZ order for that:
roll first, then sweep). Vael's bow (`src/story/arzach.js`) opens the fold the same way. `tests/birds.test.js`
holds a standing bird's wings within a hand of her side and her feet on the ground; `tests/references.test.js`
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
  loads with the game; `locomotion.glb` (the matching database, 75 clips, 202 s, 1.05 MB) only when
  matching is on, and in the character studio, which lists every clip (`mm:` and `walk:`).

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

## The Motion page: the loops against motion matching (`motion.html`, `src/motion/`)

A page of its own to watch the traveller's two ways of moving and the people's walks, and see where
each wins: `motion.html` (`npm run dev` at `/motion.html`, on GitHub Pages at `…/moebius/motion.html`,
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
