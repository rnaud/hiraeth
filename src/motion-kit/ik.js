import * as THREE from 'three';

// Inverse kinematics for legs and chains (docs/systems/procedural-animation.md, "Legs: two-bone IK is enough").
//   twoBone  analytic, law of cosines; the bend plane comes from a pole fixed to the body ("knees out and up",
//            "hocks back"), never from the current knee, so a straight leg never flips
//   fabrik   Aristidou & Lasenby's forward-and-backward reaching, for chains of three or more joints
//   aim      point a rigid segment (built along +Y from its origin) from one joint to the next
// Plain THREE.Vector3 maths, no scene graph: tested in node (tests/motion-kit.test.js).

const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _alt = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
/** How far short of full stretch a leg stops (a share of its length): a fully straight leg has no defined bend. */
export const REACH_EPS = 0.002;

/**
 * Two-bone IK: the knee for a hip, a target, the two lengths and a pole (the side the knee bends towards).
 * Writes the knee into outKnee and the reached end into outEnd (the target, or the nearest reachable point on
 * the line to it when it is out of reach or too close). Returns how far the end is from the target (0 = reached).
 */
export function twoBone(hip, target, lenA, lenB, pole, outKnee, outEnd = null) {
  _d.subVectors(target, hip);
  let dist = _d.length();
  const want = dist;
  if (dist < 1e-9) { _d.set(0, -1, 0); dist = 0; } else _d.divideScalar(dist);
  const max = (lenA + lenB) * (1 - REACH_EPS), min = Math.abs(lenA - lenB) + (lenA + lenB) * REACH_EPS;
  dist = Math.min(max, Math.max(min, dist));
  // the bend plane: the pole made perpendicular to the leg; a pole along the leg falls back to any perpendicular
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_p.lengthSq() < 1e-10) {
    _alt.crossVectors(_d, Math.abs(_d.y) < 0.9 ? UP : FWD);
    _p.crossVectors(_alt, _d);
  }
  _p.normalize();
  const cosA = Math.max(-1, Math.min(1, (lenA * lenA + dist * dist - lenB * lenB) / (2 * lenA * dist)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  outKnee.copy(hip).addScaledVector(_d, lenA * cosA).addScaledVector(_p, lenA * sinA);
  if (outEnd) outEnd.copy(hip).addScaledVector(_d, dist);
  return Math.abs(want - dist);
}

/** The knee's bend (rad) at a solved pose: π is a straight leg. */
export function bendAngle(hip, knee, end) {
  const a = _d.subVectors(hip, knee), b = _p.subVectors(end, knee);
  return a.angleTo(b);
}

/**
 * FABRIK for a chain of points (points[0] is the fixed root). lengths[i] is the distance from points[i] to
 * points[i + 1]. Moves the chain in place towards the target; out of reach it stretches straight at it.
 * Returns the end's distance from the target.
 */
export function fabrik(points, lengths, target, iterations = 12, tolerance = 1e-3) {
  const n = points.length;
  if (n < 2) return Infinity;
  const root = _alt.copy(points[0]);
  let total = 0;
  for (const l of lengths) total += l;
  if (root.distanceTo(target) >= total) {
    for (let i = 0; i < n - 1; i++) {
      const r = points[i].distanceTo(target) || 1e-9;
      points[i + 1].lerpVectors(points[i], target, lengths[i] / r);
    }
    return points[n - 1].distanceTo(target);
  }
  for (let it = 0; it < iterations; it++) {
    if (points[n - 1].distanceTo(target) < tolerance) break;
    points[n - 1].copy(target);   // backward: from the target to the root
    for (let i = n - 2; i >= 0; i--) {
      const r = points[i + 1].distanceTo(points[i]) || 1e-9;
      points[i].lerpVectors(points[i + 1], points[i], lengths[i] / r);
    }
    points[0].copy(root);   // forward: from the root to the end
    for (let i = 0; i < n - 1; i++) {
      const r = points[i + 1].distanceTo(points[i]) || 1e-9;
      points[i + 1].lerpVectors(points[i], points[i + 1], lengths[i] / r);
    }
  }
  return points[n - 1].distanceTo(target);
}

/** Put a rigid segment (modelled along +Y from its origin) at `from`, pointing at `to` (both in its parent's frame). */
export function aim(obj, from, to) {
  obj.position.copy(from);
  _d.subVectors(to, from);
  const l = _d.length();
  if (l > 1e-9) obj.quaternion.setFromUnitVectors(UP, _d.divideScalar(l));
  return l;
}
