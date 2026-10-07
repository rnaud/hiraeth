# Movement and camera (October 2026, third feedback round)

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
  (0.13 rad), which is also where the jets fly level (`JET.level`). The wheel and LB + the right stick still
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

## The jets fly like Superman (`src/player.js`: `JET`, `jetFlight`, `jetPose`)

Hold RT / R2 or the left mouse button (not aiming) to fire the jets. The left stick (WASD)
flies you where the camera looks, in 3D. `jetFlight(f, s, camF, camR, U, pitch)` turns
the stick and the rig's pitch into a flight direction:

- The stick's forward goes along the camera's look. Its elevation is
  `-(pitch - JET.level) * JET.gain`, clamped to ±90°. The follow camera's usual look down
  (`JET.level`, 0.22 rad) flies level. Looking up climbs, looking down dives, and a pitch
  of about 1.3 (the steepest look down) drops you straight down.
- The stick's side strafes. With the stick neutral the jets hover: the fall is braked to
  `JET.hover` (0 m/s) and you drift to a stop.
- Holding jump as well (A / ×, or Space with the mouse) climbs straight up at `JET.rise`.
  Space on its own, on the keyboard or touch, still thrusts and climbs to `JET_MAX_UP`.
- Speed is `JET.speed` (`JET.run` with L3 / Shift). The jets push up by at most
  `JET_THRUST`, so a dive is gravity's: steeper dives go up to `JET.dive` faster before
  the jets brake them.
- From the ground, RT lifts you off (`JET.takeoff`). The lift-off is decided before the
  pace is chosen, so flying low over rising ground skims it at the jets' speed. A dive into
  the ground (flight direction more than ~17° down) lands you, and you walk.
- `player.update(dt, input, camYaw, camPitch)`: main.js passes `rig.pitch`. Without it
  (tests, older callers) the flight is level.

The pose (`jetPose(hs, vu)`) leans the body along the flight, about the hips
(`JET_PIVOT`, 1 m up). The faster you fly, the more it leans: upright while hovering or
climbing straight up, flat out (about 1.4 rad) flying level, head first (up to 2.75 rad) in
a dive. The arms reach overhead along the flight and the legs trail together.

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
