# Movement and camera (October 2026, third feedback round)

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
