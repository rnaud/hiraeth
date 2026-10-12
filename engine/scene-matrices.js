// The scene's world matrices for the mirror's frame (engine/mirror.js sync), as src/matrix-cache.js's walk makes them,
// from a flat list of the scene instead of a walk down it.
//
// The walk (updateMatrixWorldCached, the web game's own) visits ~3 900 objects a frame in the City-Shaft; each visit
// reads a dozen properties off an object whose shape is one of hundreds (meshes, groups, bones, each with what the game
// hung on it), so in V8 every read is a megamorphic one: 3.1 ms a frame on the Steam Deck for ~45 objects that moved.
// Here the scene is listed once, depth first (each object after its parent), with what each visit needs held in arrays
// of one kind each (its position, quaternion and scale, the numbers its matrix was composed from, its matrix and world
// matrix), and the frame runs down the list: three reads a frame off the object itself (matrixAutoUpdate,
// matrixWorldNeedsUpdate, matrixWorldAutoUpdate).
//
// The same matrices as the walk, in the same order: an object recomposed when its numbers differ from those its matrix
// was composed from (its _pqs, shared with updateMatrixCached), its world matrix multiplied when its matrix changed, it
// was flagged, or its parent's world matrix changed this frame. The list is made again (by the walk itself, that frame)
// whenever an object is added, removed or attached anywhere (Object3D's add / remove / attach count an epoch), so a
// reparented object is the walk's case. An object with an updateMatrixWorld of its own (a camera, the part batches,
// a positional sound) is called as the walk would and its subtree left to it.
// tests/scene-matrices.test.js: every matrix the same as the walk's, through moves, flags, reparenting and hooks.
//
// skipHidden (the Unity bridge's mirror, issue #113: ~40 % of the City-Shaft's list, 1 750 of 4 330 objects, is under
// something hidden): a hidden object's subtree is stepped over, its matrices left as they were, unless something in it
// has an updateMatrixWorld of its own (a positional sound, a camera: called as ever). Nothing draws them; what reads
// them through three (getWorldPosition, updateWorldMatrix: src/matrix-cache.js updateChain) still gets them made as the
// walk would, since a hidden object whose parent's world matrix changed is flagged (matrixWorldNeedsUpdate), and so is
// made again by the first walk, read or frame that reaches it, the frame it is shown among them. Only a direct read of a
// hidden object's .matrixWorld sees it as it was when it was hidden (or last read).
import * as THREE from 'three';
import { updateMatrixWorldCached, updateInWalk } from '../src/matrix-cache.js';

let epoch = 0;
let installed = false;
/** Count the scene graph's changes (once: add, remove and attach on Object3D's prototype). */
export function watchSceneEdits(proto = THREE.Object3D.prototype) {
  if (installed) return;
  installed = true;
  for (const name of ['add', 'remove', 'attach']) {
    const plain = proto[name];
    proto[name] = function (...args) { epoch++; return plain.apply(this, args); };
  }
}

const _old = new Float64Array(16);

class SceneList {
  constructor(scene) {
    this.scene = scene; this.epoch = -1; this.n = 0; this.built = 0; this.seen = -1; this.churn = 0;
    this.objs = []; this.parent = new Int32Array(0); this.end = new Int32Array(0); this.own = new Uint8Array(0); this.owns = new Int32Array(1);
    this.P = []; this.Q = []; this.S = []; this.K = []; this.M = []; this.ME = []; this.WE = []; this.changed = new Uint8Array(0);
  }

  build() {
    const objs = [], parent = [], end = [];
    // (depth first, children in order: the walk's order; end[i] is one past the last of i's subtree)
    const walk = (o, p) => {
      const i = objs.length;
      objs.push(o); parent.push(p); end.push(0);
      const ch = o.children;
      for (let k = 0; k < ch.length; k++) walk(ch[k], i);
      end[i] = objs.length;
    };
    walk(this.scene, -1);
    const n = this.n = objs.length;
    this.built++;
    this.objs = objs;
    this.parent = Int32Array.from(parent); this.end = Int32Array.from(end);
    this.own = new Uint8Array(n); this.changed = new Uint8Array(n);
    const P = this.P = new Array(n), Q = this.Q = new Array(n), S = this.S = new Array(n), K = this.K = new Array(n);
    const M = this.M = new Array(n), ME = this.ME = new Array(n), WE = this.WE = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = objs[i];
      P[i] = o.position; Q[i] = o.quaternion; S[i] = o.scale;
      K[i] = o._pqs ??= new Float64Array(10).fill(NaN);
      M[i] = o.matrix; ME[i] = o.matrix.elements; WE[i] = o.matrixWorld.elements;
      this.own[i] = o.updateMatrixWorld !== updateMatrixWorldCached ? 1 : 0;
    }
    // (how many own walks before each index: a subtree has one when the count moves across it)
    const owns = this.owns = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) owns[i + 1] = owns[i] + this.own[i];
  }

  /** One frame's matrices. @return whether it ran from the list (false: the walk, the list made again after it) */
  update(skipHidden = false) {
    if (this.epoch !== epoch) {
      this.scene.updateMatrixWorld();
      // (edits frame after frame, a burst of things spawned: the walk alone until they stop, not the list made again
      //  each frame; churn halves each frame, so an edit two frames after another still makes the list at once)
      if (this.seen !== epoch) { this.seen = epoch; this.churn += 1; }
      if (this.churn < 1.5) { this.epoch = epoch; this.build(); }
      this.churn *= 0.5;
      return false;
    }
    this.churn *= 0.5;
    const { objs, parent, end, own, owns, P, Q, S, K, M, ME, WE, changed } = this;
    for (let i = 0, n = this.n; i < n; i++) {
      const o = objs[i], pi = parent[i];
      const force = pi >= 0 && changed[pi] === 1;
      if (skipHidden && o.visible === false && owns[end[i]] === owns[i]) {
        // (hidden, no own walk in it: stepped over; flagged if its parent moved, so whatever reaches it next makes it)
        if (force) o.matrixWorldNeedsUpdate = true;
        changed[i] = 0;
        i = end[i] - 1;
        continue;
      }
      if (own[i] === 1) {
        // (its own updateMatrixWorld, as the walk calls it, and its subtree with it; its children judged changed)
        updateInWalk(o, force);
        for (let j = i, e = end[i]; j < e; j++) changed[j] = 1;
        i = end[i] - 1;
        continue;
      }
      let flagged = o.matrixWorldNeedsUpdate;
      if (o.matrixAutoUpdate) {
        const p = P[i], q = Q[i], s = S[i], k = K[i];
        if (k[0] !== p.x || k[1] !== p.y || k[2] !== p.z || k[3] !== q._x || k[4] !== q._y || k[5] !== q._z || k[6] !== q._w
          || k[7] !== s.x || k[8] !== s.y || k[9] !== s.z) {
          k[0] = p.x; k[1] = p.y; k[2] = p.z; k[3] = q._x; k[4] = q._y; k[5] = q._z; k[6] = q._w; k[7] = s.x; k[8] = s.y; k[9] = s.z;
          M[i].compose(p, q, s);
          flagged = true;
        }
      }
      let ch = 0;
      if (flagged || force) {
        if (o.matrixWorldAutoUpdate === true) {
          const w = WE[i];
          if (flagged) ch = 1;
          else for (let k = 0; k < 16; k++) _old[k] = w[k];
          if (pi < 0) { const m = ME[i]; for (let k = 0; k < 16; k++) w[k] = m[k]; }
          else mul(w, WE[pi], ME[i]);
          if (ch === 0) for (let k = 0; k < 16; k++) if (_old[k] !== w[k]) { ch = 1; break; }
        } else ch = 1;
        o.matrixWorldNeedsUpdate = false;
      }
      changed[i] = ch;
    }
    return true;
  }
}

/** three's multiplyMatrices (out = a × b, column-major), the same products in the same order. */
function mul(te, ae, be) {
  const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
  const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
  const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
  const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
  const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
  const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
  const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
  const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
  te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
  te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
  te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
  te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
  te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
  te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
  te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
  te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
  te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
  te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
  te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
  te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
  te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
  te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
  te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
  te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
}

/**
 * The scene's list as it stands this frame (after updateSceneMatrices), or null when an edit since made it stale: its
 * objects depth first (objs, n), each subtree's end, each world matrix's elements (WE), how often it was made (built).
 * The mirror walks it instead of the scene (engine/mirror.js sync).
 */
export function sceneList(scene) {
  const L = scene.__sceneList;
  return L && L.epoch === epoch ? L : null;
}

/** The scene's matrices this frame (its list kept on it); skipHidden: hidden subtrees stepped over (above). */
export function updateSceneMatrices(scene, skipHidden = false) {
  if (!installed) { scene.updateMatrixWorld(); return false; }   // (no edits counted: a list could not know it is stale)
  const L = scene.__sceneList ??= new SceneList(scene);
  return L.update(skipHidden);
}
