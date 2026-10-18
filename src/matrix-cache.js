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

/**
 * For the Unity bridge's mirror (engine/mirror.js stillMatrices; off on the web, where nothing reads it): each world
 * matrix the walks here change outside the mirror's own pass is stamped on its drawable's mirror node (`__mirror.mw`,
 * the stamp's `n` then), so the mirror knows which of the still ones it need not compare again.
 */
export const WORLD_STAMP = { on: false, n: 0 };

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
  // (a walk entered from outside one, over a subtree that has not changed since its last walk: down its list, issue #457)
  if (walking === 0 && EDITS.on) { const L = listFor(this); if (L !== null) { L.walk(this, force); return; } }
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
        if (changed && WORLD_STAMP.on) { const nd = this.__mirror; if (nd) nd.mw = WORLD_STAMP.n; }
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
 * The scene graph's edits (Object3D's add, remove and attach count them: engine/scene-matrices.js watchSceneEdits, which
 * sets `on`). While they are counted, a subtree walked again and again (a rig, from its root, its pelvis, its arm: the
 * traveller's 1 000 visits a frame, a person's 200-300) is walked down a list of it made once (SubtreeList), not by the
 * walk's own recursion, until the next edit anywhere.
 */
export const EDITS = { n: 0, on: false };

// Why a list (issue #457, the Steam Deck's script thread): each visit of the recursion reads a dozen properties
// (parent, matrixAutoUpdate, position, quaternion, scale, _pqs, children, its updateMatrixWorld…) off an object whose
// shape is one of hundreds (meshes, groups, bones, each with what the game hung on it), so in V8 every one of them is a
// megamorphic read: the walks were ~10 % of the script there, for the people and the traveller. The list holds what
// does not change between edits (each object's position, quaternion and scale, the numbers its matrix was composed from,
// its matrix and world matrix, its parent in the list, its subtree's end) in arrays of one kind each, as
// engine/scene-matrices.js does for the whole scene; a visit then reads three flags off the object itself
// (matrixAutoUpdate, matrixWorldNeedsUpdate, matrixWorldAutoUpdate), and the same matrices come out in the same order.
// The list of a subtree is made on its second walk after an edit (the first is the recursion, which also brings every
// object's remembered parent, _mcParent, up to date, so no object in a list was given another parent since it was
// made); one whose objects are not their listed parents' children (a holder lending its children to a render: the hero
// map's scene, a passage's) or too small to pay for its look-up is walked as before. The lists are kept in a WeakMap,
// not on the objects (#455: a property put on three's objects slows every other read of them).

const LISTS = new WeakMap();
/** Under this many objects a subtree is walked by the recursion: its list costs more than it saves. */
const LIST_MIN = 8;

class SubtreeList {
  constructor() { this.epoch = -1; this.ok = false; this.n = 0; this.kids = null; this.kidCount = 0; }

  /** Listed depth first, as the recursion visits (each object after its parent; end[i] one past i's subtree). */
  build(root) {
    const objs = [], parent = [], end = [];
    let ok = true;
    const walk = (o, p) => {
      const i = objs.length;
      objs.push(o); parent.push(p); end.push(0);
      if (p >= 0 && o.parent !== objs[p]) ok = false;   // (a child lent: its world matrix is its own parent's)
      const ch = o.children;
      for (let k = 0; k < ch.length; k++) walk(ch[k], i);
      end[i] = objs.length;
    };
    walk(root, -1);
    const n = this.n = objs.length;
    this.ok = ok && n >= LIST_MIN;
    this.kids = root.children; this.kidCount = root.children.length;
    if (!this.ok) { this.objs = null; return; }
    this.objs = objs; this.parent = Int32Array.from(parent); this.end = Int32Array.from(end);
    this.own = new Uint8Array(n); this.changed = new Uint8Array(n);
    const P = this.P = new Array(n), Q = this.Q = new Array(n), S = this.S = new Array(n), K = this.K = new Array(n);
    const M = this.M = new Array(n), MW = this.MW = new Array(n), WE = this.WE = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = objs[i];
      P[i] = o.position; Q[i] = o.quaternion; S[i] = o.scale;
      K[i] = o._pqs ??= new Float64Array(10).fill(NaN);
      M[i] = o.matrix; MW[i] = o.matrixWorld; WE[i] = o.matrixWorld.elements;
      // (its own updateMatrixWorld: a camera, a skinned mesh, the part batches; called as the recursion calls it. Not
      // the root's: the walk is in it already, through super)
      this.own[i] = i > 0 && o.updateMatrixWorld !== updateMatrixWorldCached ? 1 : 0;
    }
  }

  /** root.updateMatrixWorld(force), as the recursion would make it. */
  walk(root, force) {
    const counted = force === true || root.parent !== null;
    if (counted) { force = true; forcedWalk++; }
    walking++;
    try {
      const { objs, parent, end, own, P, Q, S, K, M, MW, WE, changed } = this;
      for (let i = 0, n = this.n; i < n; i++) {
        const o = objs[i];
        const f = i === 0 ? !!force : changed[parent[i]] === 1;
        if (own[i] === 1) {
          // (its own walk, and its subtree with it, as the recursion hands it over)
          o.updateMatrixWorld(f);
          i = end[i] - 1;
          continue;
        }
        if (o.matrixAutoUpdate) {
          const p = P[i], q = Q[i], s = S[i], k = K[i];
          if (k[0] !== p.x || k[1] !== p.y || k[2] !== p.z || k[3] !== q._x || k[4] !== q._y || k[5] !== q._z || k[6] !== q._w
            || k[7] !== s.x || k[8] !== s.y || k[9] !== s.z) {
            k[0] = p.x; k[1] = p.y; k[2] = p.z; k[3] = q._x; k[4] = q._y; k[5] = q._z; k[6] = q._w; k[7] = s.x; k[8] = s.y; k[9] = s.z;
            M[i].compose(p, q, s);
            o.matrixWorldNeedsUpdate = true;
          }
        } else if (forcedWalk > 0) o.matrixWorldNeedsUpdate = true;
        let ch = 0;
        const needs = o.matrixWorldNeedsUpdate;
        if (needs || f) {
          if (o.matrixWorldAutoUpdate === true) {
            const w = WE[i];
            if (needs) ch = 1;
            else for (let k = 0; k < 16; k++) _old[k] = w[k];
            if (i === 0) {
              if (root.parent === null) MW[0].copy(M[0]);
              else MW[0].multiplyMatrices(root.parent.matrixWorld, M[0]);
            } else MW[i].multiplyMatrices(MW[parent[i]], M[i]);
            if (ch === 0) for (let k = 0; k < 16; k++) if (_old[k] !== w[k]) { ch = 1; break; }
            if (ch === 1 && WORLD_STAMP.on) { const nd = o.__mirror; if (nd) nd.mw = WORLD_STAMP.n; }
          } else ch = 1;
          o.matrixWorldNeedsUpdate = false;
        }
        changed[i] = ch;
      }
    } finally { walking--; if (counted) forcedWalk--; }
  }
}

/** The list to walk `o`'s subtree down, or null: walk it by the recursion (an edit since its last walk, not worth one). */
function listFor(o) {
  let L = LISTS.get(o);
  if (L === undefined) { LISTS.set(o, L = new SubtreeList()); L.epoch = EDITS.n; return null; }
  if (L.epoch !== EDITS.n) { L.epoch = EDITS.n; L.objs = null; L.kids = null; return null; }   // (this walk by the recursion, the list made at the next)
  if (L.kids === null) L.build(o);
  else if (L.kids !== o.children || L.kidCount !== o.children.length) { L.kids = null; return null; }   // (a holder's children swapped)
  return L.ok ? L : null;
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
    if (changed && WORLD_STAMP.on) { const nd = o.__mirror; if (nd) nd.mw = WORLD_STAMP.n; }
  } else changed = true;
  o.matrixWorldNeedsUpdate = false;
  if (changed) { const c = o.children; for (let i = 0, l = c.length; i < l; i++) c[i].matrixWorldNeedsUpdate = true; }
}

/**
 * Object3D.updateWorldMatrix made the cache's way (installMatrixCache() puts it on the prototype). three's own is what
 * getWorldPosition, getWorldQuaternion, attach and lookAt call (updateWorldMatrix(true, false)): it multiplies the
 * object's parents' world matrices again without a word to their other children, so the next walk, finding those
 * parents' world matrices already what it makes them, did not force the children, and they kept the matrices of where
 * the parent was. Issue #184: the hoverbike's socket read while it was ridden moved its body and left every mesh on it
 * at the spot it was boarded, out of sight behind the rider. Here the way down is updateChain's (the children off the
 * way flagged where a world matrix changed), the object itself made as three makes it, its children flagged if its own
 * changed, and updateChildren walks them as three does.
 */
export function updateWorldMatrixCached(updateParents, updateChildren) {
  if (updateParents === true && this.parent !== null) updateChain(this.parent);
  chainStep(this, true);
  if (updateChildren === true) { const c = this.children; for (let i = 0, l = c.length; i < l; i++) c[i].updateWorldMatrix(false, true); }
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
  proto.updateWorldMatrix = updateWorldMatrixCached;   // (issue #184: three's flags no sibling of what it makes)
  if (proto === THREE.Object3D.prototype) installed = true;
}
