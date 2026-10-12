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
- The camera QC (browser, Medium) after the change: the train, the Signal Market, the City-Shaft's pillar and the two
  locks green, the open framing 30–33 % wherever it is judged; train-run 2 one-frame spins at a sleeping car's door at a
  run (the node walk finds the same door spots before and after: 11 events before, 9 now); desert-open and desert-shop
  red as before (the dunes' pops, smaller now: 3.9 m at most against 5.7; the shop's look jumps unchanged).
- Nothing new moves the view: no bob, no roll; the roof's tilt and every arm are eased.
- The Unity bridge draws the game's own rig (engine/mirror.js `camera`), so it follows; the C# port's own rig
  (`unity/Hiraeth/.../CameraRig.cs`) had kept the 9.5 m arm and now has the same numbers (4.8 m, 1.7 m, 9.2°).
- Tests: `tests/camera-framing.test.js` (the open framing's share, the roof's tilt in and out, the rides' arms);
  the camera QC judges the framing in `desert-open` (`framing`: the median share on foot in the open within 0.28–0.40).

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
(the right stick, the mouse) as you land gives it up. Tested in `tests/jets.test.js`.

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
