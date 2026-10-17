import * as THREE from 'three';

// What the camera sees, for the kit's detail tiers (src/motion-kit/rig.js; docs/systems/procedural-animation.md,
// "Phase 7, LOD and style") and the fires' tongues (src/story/flames.js): the game sets it once a frame (src/main.js,
// after drawing; engine/game.js after the mirror's frame: the next frame's rigs read it), every rig asks whether its
// body is in it. Unset (node, the tests, a page without the game's loop), everything is in view.

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

/** Is a sphere (its centre c, r m round) in view? (Unset: yes.) */
export function sphereInView(c, r) {
  if (!VIEW.set) return true;
  _s.center.copy(c); _s.radius = r;
  return _f.intersectsSphere(_s);
}

/** Is a body standing at p (its feet), r m round, in view? (r is padded by the caller for its shadow.) */
export function inView(p, r) {
  if (!VIEW.set) return true;
  _s.center.set(p.x, p.y + r * 0.5, p.z); _s.radius = r;
  return _f.intersectsSphere(_s);
}

const _fNow = new THREE.Frustum(), _mNow = new THREE.Matrix4(), _sNow = new THREE.Sphere();
/**
 * The camera's frustum as it stands now (this frame's, placed but not yet drawn), for inViewNow: the people's offView
 * (src/main.js), where the last frame's view (VIEW) let somebody come into a fast turn of the camera a frame late.
 */
export function viewNow(camera, out = _fNow) {
  camera.updateMatrixWorld();
  return out.setFromProjectionMatrix(_mNow.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
}

/** Is a body standing at p (its feet), r m round, in the frustum f (viewNow)? As inView. */
export function inViewNow(f, p, r) {
  _sNow.center.set(p.x, p.y + r * 0.5, p.z); _sNow.radius = r;
  return f.intersectsSphere(_sNow);
}
