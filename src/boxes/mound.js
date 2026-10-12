import * as THREE from 'three';

// The mound a major chest stands on (issue #162, the author: "an elevated surface but with a smooth incline, not steps,
// so it's easy to get on without janky animations. Make that the default for all the major chests across the world"):
// a low round plinth whose side is one gentle ramp from the floor to its flat top, walked up from any side with no step
// to climb. The desert's first chest under Qanat's tree, the lift valve's in the giant's chest, the Givers' gun's, and
// every temple's chest stand on one (docs/systems/boxes.md "The mound"). What it is drawn with collides as drawn: the
// side is a frustum, the top a disc, so the feet stand where the eye sees the stone.

/** The temples' mound: the chest's top at 0.62 m as on their old two-step daises (so every gadget site stands where it did). */
export const MOUND = { h: 0.62, top: 1.4, foot: 3.3 };
/** The steepest a mound's side may be (its rise over its run): about 20°, a ramp, never a step. */
export const MOUND_MAX_SLOPE = 0.4;

/**
 * The mound's profile for a lathe, [r, y] from its foot to the middle of its top: the foot a hair under the floor, the
 * side one straight ramp, its top edge rounded a little (no lip a foot catches on).
 */
export function moundProfile({ h = MOUND.h, top = MOUND.top, foot = MOUND.foot } = {}) {
  const run = foot - top, k = 0.12;   // (the rounding: the last 12 cm of the run)
  return [[foot + 0.02, -0.05], [foot, 0], [top + k, h - (h / run) * k * 0.5], [top + k * 0.35, h - 0.005], [top, h], [0.01, h]];
}

/**
 * A mound at (x, y, z) (its foot's height y): [drawn, solid] geometries for a kit's both(material, drawn, solid). Seg
 * sides round (the solid as many as the drawn: the feet stand on its edge).
 */
export function chestMound(x, y, z, { h = MOUND.h, top = MOUND.top, foot = MOUND.foot, seg = 36 } = {}) {
  const drawn = new THREE.LatheGeometry(moundProfile({ h, top, foot }).map(([r, yy]) => new THREE.Vector2(Math.max(r, 0.001), yy)), seg).translate(x, y, z);
  const solid = new THREE.CylinderGeometry(top, foot, h, seg).translate(x, y + h / 2, z);
  return [drawn, solid];
}

/** Its slope (rise over run). */
export const moundSlope = ({ h = MOUND.h, top = MOUND.top, foot = MOUND.foot } = {}) => h / (foot - top);
