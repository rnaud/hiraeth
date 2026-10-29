// The first moments on the ground, as rules (pure: tests/landing.test.js):
//   - nobody talks over a ship's scene: no balloon and no talk prompt until the player has the
//     controls back (the crash, the landing, the take-off, a recording: main.js);
//   - whoever waits at the wreck in a new game (Marrow, src/story/desert.js) stands well clear of
//     where the ship comes down and ploughs in, in front of the hatch and away from its furrow;
//   - boarding is your own walk: up the ramp and into the rooms on your feet (no button since issue #87, no walk the
//     ship takes over since issue #775; so nothing to hold back after stepping out either).

/** Balloons and talk prompts may show: not while a ship's scene plays (the player isn't in control). */
export const talkAllowed = ({ shipPlaying = false } = {}) => !shipPlaying;

import { HALF_W, NOSE_Z, STERN_Z } from './hull.js';

/**
 * Where Marrow waits at the wreck: how far from the ship's origin (m, the hatch's middle on its centre line); the
 * furrow's half width (m); how far clear of the hull's plan he stands at least (m: the ship twice the size since issue
 * #338, 52 m long, a ring round its origin crossed its bow and stern).
 */
export const BYSTANDER = { dist: 22, furrow: 18, off: 0.7, clear: 6 };

/**
 * How far a point (dx, dz from the ship's origin) is from the hull's plan, the ramp's way being `out` (unit; the hull's
 * local -x): across it HALF_W either side of the centre line, along it from NOSE_Z to STERN_Z (aft: (out.z, -out.x)).
 */
export function planGap(dx, dz, out, layout = { HALF_W, NOSE_Z, STERN_Z }) {
  const { HALF_W: half, NOSE_Z: nose, STERN_Z: stern } = layout;
  const across = dx * out.x + dz * out.z, aft = dx * out.z - dz * out.x;
  return Math.hypot(Math.max(Math.abs(across) - half, 0), Math.max(nose - aft, 0, aft - stern));
}

/** Whether a point (relative to the hull's centre) is in the furrow the ship ploughed coming in along heading `travel`. */
export function inFurrow(dx, dz, travel, half = BYSTANDER.furrow) {
  const tx = Math.sin(travel), tz = Math.cos(travel);
  const along = dx * tx + dz * tz, lateral = Math.abs(dx * tz - dz * tx);
  return along < 0 && lateral < half;
}

/**
 * A spot by the wreck for someone who watched it come down: BYSTANDER.dist from the ship's origin, clear of its plan, a
 * little to one side of the way the hatch faces (seen as you step out, not in your path: BYSTANDER.off
 * rad), never in the furrow behind the ship (it slid along `travel`, a heading). { x, z }.
 * @param o { out: {x,z} the way the ramp faces (unit), hull: {x,z} the ship's origin (Ship.restPos), travel?: heading }
 */
export function bystanderSpot({ out, hull, travel = null, layout }, B = BYSTANDER) {
  let best = null, score = -Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, dx = Math.sin(a) * B.dist, dz = Math.cos(a) * B.dist;
    if (travel !== null && inFurrow(dx, dz, travel, B.furrow)) continue;
    if (planGap(dx, dz, out, layout) < B.clear) continue;
    // (the hatch's way turned B.off to either side: whichever is nearer)
    const c = Math.cos(B.off), sn = Math.sin(B.off);
    const s = Math.max(dx * (out.x * c + out.z * sn) + dz * (out.z * c - out.x * sn), dx * (out.x * c - out.z * sn) + dz * (out.z * c + out.x * sn)) / B.dist;
    if (s > score) { score = s; best = { x: hull.x + dx, z: hull.z + dz }; }
  }
  return best ?? { x: hull.x + out.x * B.dist, z: hull.z + out.z * B.dist };
}
