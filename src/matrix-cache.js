// Object3D.updateMatrixWorld without recomposing what has not moved.
//
// three recomposes every object's local matrix from its position, quaternion and scale on every
// updateMatrixWorld (matrixAutoUpdate), and so multiplies its world matrix again too, moved or not. A
// frame walks the whole scene once (main.js renderFrame) and parts of it several more times (the
// traveller's rig four times, every cab, each posed person): in the desert's camps 12 000 visits a frame
// for 750 objects that had actually moved. Here each object keeps the ten numbers its matrix was last
// composed from and recomposes only when one differs; its world matrix is multiplied when its own matrix
// changed, it was flagged (matrixWorldNeedsUpdate), or its parent's changed (force), as three does. The
// results are the same matrices: an object that did not move gets the matrix it already had. (On the
// Steam Deck, ~1.3 ms of a 33 ms frame of the main thread at the camps: docs/systems/performance.md.)
//
// What three already does is kept: matrixAutoUpdate false leaves the local matrix to its owner (who sets
// matrixWorldNeedsUpdate), matrixWorldAutoUpdate false leaves the world matrix alone. Code that writes
// .matrix directly on an object that recomposes it anyway would see its write survive until the object
// moves (three would overwrite it at once); every such write in the game turns matrixAutoUpdate off first.
//
// Three places where the matrix is not what the remembered numbers say (issue #105, as 80bc70c0 for the Unity
// bridge): a matrix composed outside the walk, by updateMatrix (updateWorldMatrix: world-read.js updateRig poses a
// rig for a moment, then its numbers are put back) keeps the numbers it came from, so the walk does not take the pose
// put back for the one it already has; a walk entered below the scene's root (a rig, a vehicle) is forced, as three's
// own recomputes it from its parent, which may have moved since; and so is an object given another parent (a carried
// thing changing hands: its own numbers the same, its world matrix not). Bones are Object3Ds: the same walk.
// tests/matrix-cache.test.js and tests/pose-exact-web.test.js check every matrix against three's own.
import * as THREE from 'three';

const plainMatrix = THREE.Object3D.prototype.updateMatrix;
/** updateMatrix, remembering the numbers it composed from (installMatrixCache() puts it on the prototype). */
export function updateMatrixCached() {
  plainMatrix.call(this);
  const k = this._pqs;
  if (k !== undefined) {
    const p = this.position, q = this.quaternion, s = this.scale;
    k[0] = p.x; k[1] = p.y; k[2] = p.z; k[3] = q._x; k[4] = q._y; k[5] = q._z; k[6] = q._w; k[7] = s.x; k[8] = s.y; k[9] = s.z;
  }
}

// how deep in a walk: 0 is a walk's entry, which is forced below the root
let walking = 0;
// inside a walk asked to be forced (updateMatrixWorld(true), or entered below the root): every object whose own
// matrix is its owner's (matrixAutoUpdate false) is multiplied again, as three would, since its owner may have
// written .matrix without flagging it
let forcedWalk = 0;
const _old = new Float64Array(16);

/**
 * The patched method (exported for the tests); installMatrixCache() puts it on Object3D's prototype.
 *
 * A forced object's world matrix is multiplied again, but its children are forced only when that changed it: a child
 * whose own numbers and parent's world matrix are both what they were already has its world matrix (issue #111: the
 * traveller's rig was walked forced six or seven times a frame, 373 objects multiplied each time, unmoved).
 */
export function updateMatrixWorldCached(force) {
  const counted = walking === 0 && (force === true || this.parent !== null);
  if (counted) { force = true; forcedWalk++; }
  try {
    if (this._mcParent !== this.parent) { this._mcParent = this.parent; force = true; this.matrixWorldNeedsUpdate = true; }
    if (this.matrixAutoUpdate) {
      const p = this.position, q = this.quaternion, s = this.scale;
      let k = this._pqs;
      if (k === undefined) k = this._pqs = new Float64Array(10).fill(NaN);
      if (k[0] !== p.x || k[1] !== p.y || k[2] !== p.z || k[3] !== q._x || k[4] !== q._y || k[5] !== q._z || k[6] !== q._w
        || k[7] !== s.x || k[8] !== s.y || k[9] !== s.z) {
        k[0] = p.x; k[1] = p.y; k[2] = p.z; k[3] = q._x; k[4] = q._y; k[5] = q._z; k[6] = q._w; k[7] = s.x; k[8] = s.y; k[9] = s.z;
        this.matrix.compose(p, q, s);
        this.matrixWorldNeedsUpdate = true;
      }
    } else if (forcedWalk > 0) this.matrixWorldNeedsUpdate = true;
    let changed = false;
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) {
        const w = this.matrixWorld.elements;
        if (this.matrixWorldNeedsUpdate) changed = true;   // (its own matrix changed: so does its world matrix)
        else for (let i = 0; i < 16; i++) _old[i] = w[i];
        if (this.parent === null) this.matrixWorld.copy(this.matrix);
        else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
        if (!changed) for (let i = 0; i < 16; i++) if (_old[i] !== w[i]) { changed = true; break; }
      } else changed = true;   // (its owner keeps its world matrix: the children are judged against whatever it is now)
      this.matrixWorldNeedsUpdate = false;
    }
    const children = this.children;
    if (children.length === 0) return;
    walking++;
    try { for (let i = 0, l = children.length; i < l; i++) children[i].updateMatrixWorld(changed); } finally { walking--; }
  } finally { if (counted) forcedWalk--; }
}

/**
 * The way from `top` down to `o` made now, as `top.updateMatrixWorld(true)` would make it, without walking the rest
 * of top's subtree: for code that walked a whole rig to read one object in it (a joint's parent, a foot; issue #111:
 * the traveller's 363 objects walked six times a frame, the people's rigs from each joint as it turned). top is made as
 * a forced walk's first object is (its parent's world matrix taken as it is), each object below it on the way if its
 * numbers changed, it was flagged, or its parent changed; where a world matrix changed, the children off the way are
 * flagged (matrixWorldNeedsUpdate), so the next walk over them makes them as the walk from top would have: the same
 * numbers, the rest of the work left to that walk. (o not under top: from the scene's root.) Without the cache
 * (installMatrixCache not run): three's updateWorldMatrix(true, false).
 */
export function updateChain(o, top = null) {
  if (o.updateMatrixWorld !== updateMatrixWorldCached) { o.updateWorldMatrix(true, false); return; }
  if (o !== top && o.parent !== null) updateChain(o.parent, top);
  chainStep(o, o === top);
}

const _was = new Float64Array(16);
function chainStep(o, first) {
  let forced = first;
  if (o._mcParent !== o.parent) { o._mcParent = o.parent; o.matrixWorldNeedsUpdate = true; }
  if (o.matrixAutoUpdate) {
    const p = o.position, q = o.quaternion, s = o.scale;
    let k = o._pqs;
    if (k === undefined) k = o._pqs = new Float64Array(10).fill(NaN);
    if (k[0] !== p.x || k[1] !== p.y || k[2] !== p.z || k[3] !== q._x || k[4] !== q._y || k[5] !== q._z || k[6] !== q._w
      || k[7] !== s.x || k[8] !== s.y || k[9] !== s.z) {
      k[0] = p.x; k[1] = p.y; k[2] = p.z; k[3] = q._x; k[4] = q._y; k[5] = q._z; k[6] = q._w; k[7] = s.x; k[8] = s.y; k[9] = s.z;
      o.matrix.compose(p, q, s);
      o.matrixWorldNeedsUpdate = true;
    }
  } else forced = true;   // (its owner's matrix, maybe written without a flag: made again, as a forced walk does)
  if (!o.matrixWorldNeedsUpdate && !forced) return;
  let changed = o.matrixWorldNeedsUpdate;
  if (o.matrixWorldAutoUpdate === true) {
    const w = o.matrixWorld.elements;
    if (!changed) for (let i = 0; i < 16; i++) _was[i] = w[i];
    if (o.parent === null) o.matrixWorld.copy(o.matrix);
    else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
    if (!changed) for (let i = 0; i < 16; i++) if (_was[i] !== w[i]) { changed = true; break; }
  } else changed = true;
  o.matrixWorldNeedsUpdate = false;
  if (changed) { const c = o.children; for (let i = 0, l = c.length; i < l; i++) c[i].matrixWorldNeedsUpdate = true; }
}

/** An object's own updateMatrixWorld called as a walk would call it, from inside one (engine/scene-matrices.js's list). */
export function updateInWalk(o, force) {
  walking++;
  try { o.updateMatrixWorld(force); } finally { walking--; }
}

let installed = false;
/** Once, at startup (main.js): every Object3D (and Camera, Bone… through super) walks with the cache. */
export function installMatrixCache(proto = THREE.Object3D.prototype) {
  if (installed && proto === THREE.Object3D.prototype) return;
  proto.updateMatrixWorld = updateMatrixWorldCached;
  proto.updateMatrix = updateMatrixCached;
  if (proto === THREE.Object3D.prototype) installed = true;
}
