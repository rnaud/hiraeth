import * as THREE from 'three';

// Reading an object's world position or turn where its world matrix is known to be current (the people's posing:
// animator.js, humanoid.js). three's getWorldPosition / getWorldQuaternion recompute every parent's matrix up to the
// scene first; in a pass that has just updated them (an updateMatrixWorld over the rig, or the library skeleton's),
// that is the same arithmetic again, a few hundred matrices a person a frame. These read the matrix as it is: the same
// numbers, since nothing between changed it. __POSE_EXACT__ (a global, before the game loads) recomputes as three
// does: tests/pose-exact.test.js poses the people both ways and compares every bone.

// walks: the rigs walked as before issue #111, from their roots at each read and each joint's subtree after it turns
// (__POSE_WALKS__, or __POSE_EXACT__); else each read makes only what it reads (updateChain, src/matrix-cache.js) and the
// rest is left to the next walk. tests/pose-exact-shaft.test.js poses the people both ways: the same matrices, bit for bit.
export const POSE = { exact: !!globalThis.__POSE_EXACT__, walks: !!(globalThis.__POSE_EXACT__ || globalThis.__POSE_WALKS__) };
// (an object and its parents made for a read, the rest of its rig left to the next walk: src/matrix-cache.js)
export { updateChain } from './matrix-cache.js';
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** o's world position (its world matrix current). */
export function worldPos(o, out) { return POSE.exact ? o.getWorldPosition(out) : out.setFromMatrixPosition(o.matrixWorld); }

/** o's world turn (its world matrix current). */
export function worldQuat(o, out) { if (POSE.exact) return o.getWorldQuaternion(out); o.matrixWorld.decompose(_p, out, _s); return out; }

/**
 * root's world matrices, and everything under it but a person's body (userData.poseSkip: the Humanoid's model, which
 * Humanoid.update makes again from the rig): updateMatrixWorld(true) less the body's bones.
 */
export function updateRig(root) {
  if (POSE.exact) { root.updateMatrixWorld(true); return; }
  root.updateWorldMatrix(false, false);
  const go = (o) => { for (const c of o.children) { if (c.userData.poseSkip) continue; c.updateWorldMatrix(false, false); if (c.children.length) go(c); } };
  go(root);
}

