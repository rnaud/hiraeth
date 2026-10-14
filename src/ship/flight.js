// The ship's take-off and landing as a lander flies them (issue #354: "When the ship flies away it should go up with
// boosters then forward. The reverse for landing. Arrive then land vertically for the final part").
//
// Pure numbers, no engine: where the ship is (metres ahead along its bow, metres back along it, metres up from where it
// rests) and how its nose is pitched (rad, + nose up) at a time t. src/ship/cinematics.js (TakeoffDirector,
// ArrivalDirector) places the web game's ship with them; scripts/unity-export/export-world.mjs writes the same
// numbers for Unity's ShipTravel.cs, which evaluates the same curves. docs/systems/cinematics.md, "Take-off and landing".

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

/**
 * The take-off: straight up on the belly's jets off its feet to a hover `hover` m up in `rise` s (eased in and out: it
 * lifts gently, it settles), the dust blown out under it all the while; then the nose dips (`dip` rad) as the jets tip
 * it forward, and it powers away along its bow, `away` m in the remaining time, climbing `climb` m, its nose coming up
 * to `nose` rad. `dur` s in all; the warp opens at `warp` s.
 */
export const TAKEOFF = { dur: 5.2, rise: 2.0, hover: 15, dip: 0.14, nose: 0.12, away: 340, climb: 80, warp: 4.4 };

/** Where the taking-off ship is at t s: { ahead, up (m), pitch (rad, + nose up) }. */
export function takeoffPose(t, T = TAKEOFF) {
  if (t <= T.rise) return { ahead: 0, up: T.hover * smooth(t / T.rise), pitch: 0 };
  const s = clamp01((t - T.rise) / (T.dur - T.rise));
  // (from a standstill: the forward speed grows as the jets tip it; the nose dips first, then comes up as it goes)
  const ahead = T.away * s * s, up = T.hover + T.climb * s * s * s;
  const dip = s < 0.45 ? T.dip * Math.sin(Math.PI * s / 0.45) : 0;
  const pitch = -dip + T.nose * smooth((s - 0.3) / 0.5);
  return { ahead, up, pitch };
}

/**
 * The landing, its reverse: the ship comes in nose first along its bow, from `back` m behind where it will stand and
 * `high` m up, slowing all the way, its nose flared up (`flare` rad at most) as it brakes, and stops `hover` m over
 * its spot in `glide` s; it hangs there `hold` s; then it comes straight down on its jets in `drop` s, eased in and
 * out, onto its feet at rest (under 1 m/s its last 0.1 s, when the director calls the touchdown). The short arrival (APPROACH.sky out of the clouds, then the low shot) flies all of it;
 * the first arrival in a world (arrival-view.js WIDE) flies the glide in its wide shot and the drop in the low one.
 */
export const LANDING = { back: 300, high: 175, hover: 32, glide: 3.6, hold: 0.35, drop: 2.6, flare: 0.12 };

/** Where the landing ship is t s into its arrival over the site: { back, up (m), pitch (rad, + nose up), phase }. */
export function landingPose(t, L = LANDING) {
  if (t < L.glide) {
    const s = clamp01(t / L.glide), f = (1 - s) * (1 - s);
    // (the flare: the nose up as it brakes, most two thirds of the way in, level again over its spot)
    return { back: L.back * f, up: L.hover + (L.high - L.hover) * f, pitch: L.flare * 6.75 * s * s * (1 - s), phase: 'glide' };
  }
  if (t < L.glide + L.hold) return { back: 0, up: L.hover, pitch: 0, phase: 'hover' };
  // (smootherstep: it eases off the hover and comes onto its feet with next to no speed left)
  const u = clamp01((t - L.glide - L.hold) / L.drop), e = u * u * u * (u * (6 * u - 15) + 10);
  return { back: 0, up: L.hover * (1 - e), pitch: 0, phase: u >= 1 ? 'down' : 'drop' };
}

/** The whole landing's length (s). */
export const landingDur = (L = LANDING) => L.glide + L.hold + L.drop;
