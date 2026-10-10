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
// (An explicit updateMatrix() needs nothing: it composes from the same numbers, or newer ones the walk
// will see differ from its cache and compose again.)
import * as THREE from 'three';

/** The patched method (exported for the tests); installMatrixCache() puts it on Object3D's prototype. */
export function updateMatrixWorldCached(force) {
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
  }
  if (this.matrixWorldNeedsUpdate || force) {
    if (this.matrixWorldAutoUpdate === true) {
      if (this.parent === null) this.matrixWorld.copy(this.matrix);
      else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    }
    this.matrixWorldNeedsUpdate = false;
    force = true;
  }
  const children = this.children;
  for (let i = 0, l = children.length; i < l; i++) children[i].updateMatrixWorld(force);
}

let installed = false;
/** Once, at startup (main.js): every Object3D (and Camera, Bone… through super) walks with the cache. */
export function installMatrixCache(proto = THREE.Object3D.prototype) {
  if (installed && proto === THREE.Object3D.prototype) return;
  proto.updateMatrixWorld = updateMatrixWorldCached;
  if (proto === THREE.Object3D.prototype) installed = true;
}
