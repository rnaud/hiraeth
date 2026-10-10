// Rising air: the one ride every column of it shares (the temples' Updraft, src/temples/pieces.js; Vael's wind up the
// lone tower, src/story/arzach.js; the trials' wind columns, src/trials/winds.js; the City-Shaft's air pillars,
// src/shaft-pillars.js). Open wings in a column and you go straight up (the author, 2026-10-10: "when in an air
// shaft I should go just up, not keep going forward"): the glide's forward run stops, the column settles you onto its
// axis, and the stick drifts you slowly the way it points, so you can always steer out. Near its top the lift eases
// to nothing and you hang there until you steer off; once out of it the glide takes up again from UPDRAFT.exit.
//
//   rideColumn(P, dt, col)       per frame while P is in the column and gliding: the lift, and P.updraft for the glide
//   columnDrift(out, move, pos, axis)   the glide's flat velocity inside one (pure: player.js)
//   liftAt(lift, top, y, ease)   how fast open wings rise at height y (pure)

/**
 * steer: how fast the stick drifts you across a column (m/s); centre: how fast it settles you onto its axis with the
 * stick let go (1/s); exit: the glide's speed as you leave it (m/s, up to its cruise from there); fresh: how long a
 * column's mark on the traveller holds (s: columns run after the traveller each frame, so his next frame reads it);
 * bellows: how much quicker the Warden's bellows lift open wings (src/items.js).
 */
export const UPDRAFT = { steer: 3.6, centre: 1.5, exit: 9, fresh: 0.12, bellows: 1.25 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How fast open wings rise at height y in a column topping out at `top`: `lift` low down, easing to 0 over its top `ease` m (pure). */
export function liftAt(lift, top, y, ease = 3) {
  return lift * clamp01((top - y) / ease);
}

/** The vertical speed one frame on, in a column that wants `want` m/s up (pure: quick to catch a fall, smooth to its speed). */
export function riseToward(vy, want, dt) {
  return Math.max(vy, want * 0.5) + (want - vy) * Math.min(1, dt * 3);
}

/**
 * Ride a column: lift the traveller toward its speed at his height, and mark it on him (`P.updraft`) so his glide
 * goes straight up instead of on along his heading (player.js). col: { x, z (its axis), top, lift, ease, r, bellows
 * (false: the Warden's bellows do not quicken it: Vael's tower wind, whose crest is timed to set you on the balcony) }.
 * hold: false lifts without the mark (a column whose crest carries you off somewhere: Vael's tower).
 * Returns the speed it wants (m/s).
 */
export function rideColumn(P, dt, col, { hold = true } = {}) {
  const want = liftAt(col.lift, col.top, P.pos.y, col.ease ?? 3) * (col.bellows !== false && P.has?.('wardenbellows') ? UPDRAFT.bellows : 1);
  P.vel.y = riseToward(P.vel.y, want, dt);
  if (hold) P.updraft = { x: col.x, z: col.z, r: col.r ?? 4, at: P.time ?? 0 };
  return want;
}

/** Is the column's mark on P still fresh (set by a column this frame or the last)? */
export function inColumn(P) {
  return !!P.updraft && (P.time ?? 0) - P.updraft.at <= UPDRAFT.fresh;
}

/**
 * The glide's flat velocity in a column (pure): the stick (`move`, flat, length 0..1) drifts you at UPDRAFT.steer;
 * with it let go the column draws you onto its axis. Pushing the stick lets go of the pull, so you always get out.
 * out, move, pos, axis: { x, z } (out may be a Vector3: only x and z are set).
 */
export function columnDrift(out, move, pos, axis) {
  const m = Math.min(1, Math.hypot(move.x, move.z));
  const pull = UPDRAFT.centre * (1 - m);
  out.x = move.x * UPDRAFT.steer + (axis.x - pos.x) * pull;
  out.z = move.z * UPDRAFT.steer + (axis.z - pos.z) * pull;
  return out;
}
