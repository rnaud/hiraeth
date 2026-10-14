import * as THREE from 'three';

// Reading an object's world position or turn where its world matrix is known to be current (the people's posing:
// animator.js, humanoid.js). three's getWorldPosition / getWorldQuaternion recompute every parent's matrix up to the
// scene first; in a pass that has just updated them (an updateMatrixWorld over the rig, or the library skeleton's),
// that is the same arithmetic again, a few hundred matrices a person a frame. These read the matrix as it is: the same
// numbers, since nothing between changed it. Each read makes only what it reads (updateChain, src/matrix-cache.js) and
// the rest is left to the next walk (issue #111). (The walks and three's recomputing as they were, kept behind
// __POSE_EXACT__ / __POSE_WALKS__ for two lockstep tests, went once those refactors had shipped; the matrix cache
// against three's own walk: tests/pose-exact-web.test.js.)
// (an object and its parents made for a read, the rest of its rig left to the next walk: src/matrix-cache.js)
export { updateChain } from './matrix-cache.js';
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** o's world position (its world matrix current). */
export function worldPos(o, out) { return out.setFromMatrixPosition(o.matrixWorld); }

/** o's world turn (its world matrix current). */
export function worldQuat(o, out) { o.matrixWorld.decompose(_p, out, _s); return out; }

/**
 * root's world matrices, and everything under it but a person's body (userData.poseSkip: the Humanoid's model, which
 * Humanoid.update makes again from the rig): updateMatrixWorld(true) less the body's bones.
 */
export function updateRig(root) {
  root.updateWorldMatrix(false, false);
  const go = (o) => { for (const c of o.children) { if (c.userData.poseSkip) continue; c.updateWorldMatrix(false, false); if (c.children.length) go(c); } };
  go(root);
}

