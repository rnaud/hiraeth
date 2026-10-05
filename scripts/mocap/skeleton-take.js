// Takes from a three.js skeleton playing a clip: what BVH (bvh.js) and FBX (fbx.js) files become
// once three's own loaders have read them. Every bone's world position (its joint) and its world
// rotation relative to the skeleton's rest pose, sampled at `fps`; then turned so the body stands
// up +y and faces +z (left = +x), whatever the file's axes were.
import * as THREE from 'three';
import { newTake } from './take.js';

/**
 * @param root   the skeleton's top Object3D (bones under it), in its rest pose
 * @param clip   a THREE.AnimationClip for it
 * @param o.fps  the sampling rate; o.name; o.landmarks (point names, see take.js) to find its axes
 * @param o.bones the bones to record (default: every bone / object under root)
 */
export function sampleSkeleton(root, clip, { fps = 30, name = clip.name, landmarks, bones = null } = {}) {
  const list = [];
  root.traverse((o) => { if (o !== root && (!bones || bones.includes(o.name)) && (o.isBone || o.type === 'Object3D' || o.isObject3D)) list.push(o); });
  root.updateMatrixWorld(true);
  const restQ = new Map(list.map((o) => [o, o.getWorldQuaternion(new THREE.Quaternion())]));
  const names = list.map((o) => o.name);
  const n = Math.max(1, Math.floor(clip.duration * fps + 1e-6) + 1);
  const take = newTake({ name, fps, n, points: names, rotations: names });
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    mixer.setTime(Math.min(i / fps, clip.duration));
    root.updateMatrixWorld(true);
    for (const o of list) {
      take.setPoint(o.name, i, o.getWorldPosition(p));
      o.getWorldQuaternion(q).multiply(_qi.copy(restQ.get(o)).invert());
      take.setRotation(o.name, i, q);
    }
  }
  action.stop();
  take.parents = Object.fromEntries(list.map((o) => [o.name, o.parent && o.parent !== root ? o.parent.name : null]));
  take.landmarks = landmarks;
  if (landmarks) uprightTake(take);
  return take;
}
const _qi = new THREE.Quaternion();

/**
 * Turn the whole take (positions and rotations) so the body stands along +y and faces +z, from
 * frame 0's landmarks: up = hips -> head, left = right hip -> left hip.
 */
export function uprightTake(take) {
  const L = take.landmarks, P = (k) => take.point(k, 0);
  const hipL = P(L.hipL), hipR = P(L.hipR), head = P(L.head);
  const mid = hipL.clone().add(hipR).multiplyScalar(0.5);
  const up = head.clone().sub(mid).normalize();
  const left = hipL.clone().sub(hipR);
  left.addScaledVector(up, -left.dot(up)).normalize();
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
  // the basis (left, up, fwd) should be (x, y, z): A maps it there
  const M = new THREE.Matrix4().makeBasis(left, up, fwd);
  const A = new THREE.Quaternion().setFromRotationMatrix(M).invert();
  if (A.angleTo(new THREE.Quaternion()) < 1e-3) return take;
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), Ai = A.clone().invert();
  for (const k in take.points) for (let i = 0; i < take.n; i++) take.setPoint(k, i, take.point(k, i, v).applyQuaternion(A));
  for (const k in take.rotations) for (let i = 0; i < take.n; i++) take.setRotation(k, i, take.rotation(k, i, q).premultiply(A).multiply(Ai));
  return take;
}
