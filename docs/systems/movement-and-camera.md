# Movement and camera (October 2026, third feedback round; the jets reworked in v0.89)

## The follow camera: Ocarina in the open, Uncharted close in (v0.82, `CameraRig` in `src/player.js`)

The author: "the default camera is a bit too far away; closer, like Ocarina of Time, and closer as well in
closed spaces, like Uncharted." Measured in the running game (1280 × 720 and the Retroid's 730 × 410, the
camera put behind the traveller, FOV 55°):

| | arm | camera height | look down | traveller's height in frame |
|---|---|---|---|---|
| open, before | 9.5 m | 3.9 m | 12.6° | 0.17 (head at the centre) |
| open, now | 6.4 m (`OPEN_DIST`) | 3.0 m | 7.4° (`OPEN_PITCH`) | 0.26, head at 0.55, feet at 0.81 |
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
