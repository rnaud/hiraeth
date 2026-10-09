import * as THREE from 'three';

// A person's wave (src/npc.js pose: a greeting, for ~2 s once you come near), laid over the clip's pose.
//
// It used to set the arm's and the forearm's Euler angles outright: the arm swung up past the head
// (150°) and the forearm bent about its own x, which with the arm up swung the hand toward the face
// and away again (a chop, seen side on), never side to side; and since the angles were set, not
// blended, the arm snapped from the clip's pose to hanging straight at the first frame and back at
// the last. Now the upper arm comes out to the side and a little forward, the elbow a little above
// the shoulder; the forearm stands up from it and swings side to side across the body's front plane
// (the hand waving), and the whole of it is eased in and out of whatever the clip was doing.

export const WAVE = {
  dur: 2.2,          // s
  in: 0.35, out: 0.45,   // s to raise the arm, to lower it
  lift: 1.95,        // rad: the upper arm from hanging (out to the side: the elbow a little over the shoulder)
  ahead: 0.35,       // how far forward of the body's side the arm comes (a hand raised to someone in front)
  fore: 0.2,         // rad: the forearm's lean out from straight up, on average
  sway: 0.42,        // rad: the hand's swing either side of that
  rate: 2.3,         // swings a second (Hz)
};

const DOWN = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qr = new THREE.Quaternion();
const _d = new THREE.Vector3();

/** How far the arm is up at `t` s into the wave (0..1): eased in, held, eased down. */
export function waveWeight(t, W = WAVE) {
  if (!(t >= 0) || t >= W.dur) return 0;
  const s = THREE.MathUtils.smoothstep;
  return Math.min(s(t, 0, W.in), 1 - s(t, W.dur - W.out, W.dur));
}

/**
 * The arm's and the forearm's directions at `t` (the body's own frame: x its left, y up, z ahead), for
 * the arm on side `side` (+1 the body's left, -1 its right). Out: { arm, fore } unit vectors.
 */
export function waveDirs(t, side = 1, W = WAVE, out = { arm: new THREE.Vector3(), fore: new THREE.Vector3() }) {
  out.arm.set(side * Math.sin(W.lift), -Math.cos(W.lift), W.ahead).normalize();
  const a = W.fore + W.sway * Math.sin(t * W.rate * Math.PI * 2);
  // up, leaning out to the side and back in across the front (a little forward of the body's plane)
  out.fore.set(side * Math.sin(a), Math.cos(a), 0.18).normalize();
  return out;
}

const _dirs = { arm: new THREE.Vector3(), fore: new THREE.Vector3() };
/**
 * Lay the wave over the rig's pose (a buildCharacter rig, posed this frame): arm `i` (0 the body's
 * right, 1 its left) of `c`, its root `root`, `t` s into the wave. Each joint turns toward the wave
 * by its weight (waveWeight) from where the clip left it, so it never snaps. Returns the weight.
 */
export function layWave(c, root, t, i = 1, W = WAVE) {
  const k = waveWeight(t, W);
  if (k <= 0) return 0;
  const arm = c.arms[i], elbow = c.elbows[i], side = i === 1 ? 1 : -1;
  const d = waveDirs(t, side, W, _dirs);
  root.updateMatrixWorld(true);
  // the body's frame (the root's turn) into the arm's parent's (the chest, leaning and turning with the walk)
  const rootQ = root.getWorldQuaternion(_qr);
  const parentQi = arm.parent.getWorldQuaternion(_qp).invert();
  const armQ = _qa.setFromUnitVectors(DOWN, _d.copy(d.arm).applyQuaternion(rootQ).applyQuaternion(parentQi));
  arm.quaternion.slerp(armQ, k);
  arm.updateMatrixWorld(true);
  const armWi = arm.getWorldQuaternion(_qp).invert();
  const foreQ = _q.setFromUnitVectors(DOWN, _d.copy(d.fore).applyQuaternion(rootQ).applyQuaternion(armWi));
  elbow.quaternion.slerp(foreQ, k);
  elbow.updateMatrixWorld(true);
  return k;
}
