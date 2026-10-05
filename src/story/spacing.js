import * as THREE from 'three';

// Room to talk: a conversation opened nose to nose first puts a comfortable
// gap between the two (src/story/index.js, as the camera cuts to the two-shot,
// so nobody sees the step).
//
//   talkSpace(npc)                              → { want, min } (m, feet to feet, on the ground)
//   stepBack({ a, b, want, min, physics, … })   → where `a` stands instead (a Vector3), or null
//
// The one who moves goes straight back from the other, or round them a little
// when that way is blocked; never into a wall (the capsule must fit, the way
// there must be clear), never off a ledge or up a step (the ground is followed
// along the way), never onto a bystander. The traveller moves first; only when
// he has nowhere to go (his back to a wall) does the other step back instead.

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _r = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _push = new THREE.Vector3();

/** The gap the two-shot wants: about 1.45 m; a little less for a child, more for a giant, more for someone seated (their knees). */
export function talkSpace(npc) {
  if (npc?.talkGap) return { want: npc.talkGap, min: npc.talkGap - 0.3 };   // (someone who says how much room they need: an alien's threads or legs, src/aliens/)
  const s = THREE.MathUtils.clamp(npc?.object?.scale?.y ?? 1, 0.8, 1.6);
  const want = 1.45 * (0.55 + 0.45 * s) + (npc?.seat ? 0.3 : 0);
  return { want, min: want - 0.25 };
}

/** Feet-to-feet distance on the ground (gravity along +y). */
export const gapOf = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Angles tried round the other (rad): straight back first, then a little to either side. */
const FAN = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.5, -1.5];

/**
 * Where `a` should stand so it is `want` from `b`, or null when it is already
 * at least `min` away, or when there is nowhere it could go.
 * @param a, b       feet positions (a moves)
 * @param physics    the level (groundAt, rayDistance, pushCapsule)
 * @param radius, height, step  the mover's capsule, and the highest step it may take up or down
 * @param others     bystanders' feet: not to be stepped onto
 * @param facing     a direction for `a` to back along when the two stand on the same spot
 */
export function stepBack({ a, b, want = 1.45, min = 1.2, physics = null, radius = 0.45, height = 2.2, step = 0.45, others = [], facing = null }) {
  const gap = gapOf(a, b);
  if (gap >= min) return null;
  _d.set(a.x - b.x, 0, a.z - b.z);
  if (_d.lengthSq() < 1e-6) { if (facing) _d.set(-facing.x, 0, -facing.z); if (_d.lengthSq() < 1e-6) _d.set(0, 0, 1); }
  _d.normalize();
  for (const ang of FAN) {
    const c = Math.cos(ang), s = Math.sin(ang);
    _r.set(_d.x * c - _d.z * s, 0, _d.x * s + _d.z * c);
    const to = new THREE.Vector3(b.x + _r.x * want, a.y, b.z + _r.z * want);
    if (reach(a, to, { physics, radius, height, step }) && clearOf(to, others, b, radius)) return to;
  }
  return null;
}

/** Nobody else stands there (and it is the other's own spot that is kept away from, not theirs). */
function clearOf(p, others, b, radius) {
  for (const o of others) if (o !== b && gapOf(p, o) < radius + 0.35 && Math.abs(p.y - o.y) < 2) return false;
  return true;
}

/**
 * Can the mover walk from `a` to `to` (and stand there)? The ground followed along the way
 * (no drop or rise of more than a step), nothing in the way at the knee, waist or head, and
 * the capsule fitting where it ends. Sets `to.y` to the ground there.
 */
export function reach(a, to, { physics = null, radius = 0.45, height = 2.2, step = 0.45 } = {}) {
  if (!physics) return true;
  const len = gapOf(a, to);
  const n = Math.max(1, Math.ceil(len / 0.2));
  let y = a.y;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = a.x + (to.x - a.x) * t, z = a.z + (to.z - a.z) * t;
    const g = physics.groundAt(x, y + step + 0.05, z, 6);
    if (!Number.isFinite(g) || Math.abs(g - y) > step) return false;   // a ledge, a hole, or a wall's foot
    y = g;
  }
  to.y = y;
  // the way there: a body's width of clear air at three heights (the wall a ray from the feet would miss)
  _p.set(to.x - a.x, 0, to.z - a.z);
  if (_p.lengthSq() > 1e-6) {
    _p.normalize();
    for (const h of [0.55, 1.1, 1.7]) {
      _q.copy(a).addScaledVector(UP, h);
      if (physics.rayDistance(_q, _p, len + radius) < len + radius) return false;
    }
  }
  // and room to stand there: the capsule (above the step) is not pushed out of anything
  _q.copy(to);
  const out = physics.pushCapsule ? physics.pushCapsule(_q, radius, step, height, _push) : null;
  return !out || out.length() < 0.05;
}
