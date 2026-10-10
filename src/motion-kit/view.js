import * as THREE from 'three';

// What the camera sees, for the kit's detail tiers (src/motion-kit/rig.js; docs/systems/procedural-animation.md,
// "Phase 7, LOD and style"): the game sets it once a frame (src/main.js, after drawing: the next frame's rigs read
// it), every rig asks whether its body is in it. Unset (node, the tests, a page without the game's loop), everything
// is in view.

const _f = new THREE.Frustum(), _m = new THREE.Matrix4(), _s = new THREE.Sphere();
export const VIEW = { set: false, frame: 0 };

/** The camera's frustum for this frame. */
export function setView(camera) {
  camera.updateMatrixWorld();
  _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _f.setFromProjectionMatrix(_m);
  VIEW.set = true; VIEW.frame++;
}

/** Forget the camera (everything in view again). */
export function clearView() { VIEW.set = false; }

/** Is a body standing at p (its feet), r m round, in view? (r is padded by the caller for its shadow.) */
export function inView(p, r) {
  if (!VIEW.set) return true;
  _s.center.set(p.x, p.y + r * 0.5, p.z); _s.radius = r;
  return _f.intersectsSphere(_s);
}
