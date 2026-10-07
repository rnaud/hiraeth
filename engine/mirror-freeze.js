// The scene mirror's still subtrees (engine/mirror.js, docs/systems/engine-bridge.md "Still subtrees").
//
// Most of a world stands still: the landmarks, the buildings, the ship. Walking those each frame (a world matrix
// compared a drawable, its materials, its geometry's version) and recomposing their matrices (three's
// updateMatrixWorld) was a third of the mirror's time. A subtree whose drawables have not moved for a while is
// frozen: the walk takes it whole (its drawables seen, its materials' live values checked) without going in, and
// three's matrix update stops at its root while the root's parent stays where it was.
//
// Nothing in a frozen subtree may change unseen, so each object in it is watched, and any change thaws the
// subtree at once, before the next frame's matrices: its position and scale (their x, y, z made accessors), its
// rotation and quaternion (their change callbacks), its visibility, a child added or removed, the root taken out
// or put elsewhere, its parent's world matrix. What has no hook (a geometry rewritten in place, a render hook set
// later) is looked at round the frozen subtrees, all of them every few frames. A subtree that thaws soon after
// freezing waits longer each time before it is frozen again.

/** Frames a drawable stays put before its subtree may freeze. */
export const STILL_FRAMES = 45;
/** How often (frames) the scene is surveyed for subtrees to freeze. */
export const SURVEY_EVERY = 30;
/** Every frozen subtree's geometries and hooks are looked at within this many frames. */
export const CHECK_ROUND = 8;

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** One frozen subtree. */
export class Frozen {
  constructor(mirror, root) {
    this.mirror = mirror;
    this.root = root;
    this.dead = false;
    this.seen = -1;          // the frame the walk last took it (its drawables seen then)
    this.drawn = 0;          // its drawables shown
    this.nodes = [];         // the mirror's nodes of those
    this.mats = [];          // their materials, once each (their live values checked each frame)
    this.objects = [];       // everything watched
    this.parentMatrix = new Float64Array(16);
    this._thaw = () => this.thaw();
    this._onChild = () => this.thaw();
  }

  /** Watch everything in the subtree; false (and nothing changed) if something in it cannot be watched. */
  freeze(frame) {
    const root = this.root, mirror = this.mirror;
    if (!root.parent) return false;
    this.parentMatrix.set(root.parent.matrixWorld.elements);
    const mats = new Set();
    const visit = (o, shown) => {
      o.__frozen = this;
      this.objects.push(o);
      watchVector(o.position, this);
      watchVector(o.scale, this);
      watchTurn(o, this);
      watchVisible(o, this);
      o.addEventListener('childadded', this._onChild);
      o.addEventListener('childremoved', this._onChild);
      const node = o.__mirror;
      const on = shown && o.visible;
      if (node && on && node.shown && node.owner === mirror && !node.dead) {
        node.frozen = this;
        this.nodes.push(node);
        this.drawn++;
        const M = o.material;
        if (Array.isArray(M)) { for (const m of M) if (m) mats.add(m); } else if (M) mats.add(M);
      }
      const ch = o.children;
      for (let i = 0; i < ch.length; i++) visit(ch[i], on);
    };
    visit(root, true);
    this.mats = [...mats];
    root.addEventListener('removed', this._thaw);
    root.addEventListener('added', this._thaw);
    // three's matrix update stops here while the parent stays put
    const rec = this;
    root.updateMatrixWorld = function frozenUpdate(force) {
      if (!rec.dead) {
        const p = this.parent, e = p ? p.matrixWorld.elements : null, m = rec.parentMatrix;
        if (e && e[0] === m[0] && e[1] === m[1] && e[2] === m[2] && e[4] === m[4] && e[5] === m[5] && e[6] === m[6]
          && e[8] === m[8] && e[9] === m[9] && e[10] === m[10] && e[12] === m[12] && e[13] === m[13] && e[14] === m[14]
          && e[3] === m[3] && e[7] === m[7] && e[11] === m[11] && e[15] === m[15]) return;
        rec.thaw();
      }
      return Object.getPrototypeOf(this).updateMatrixWorld.call(this, force);
    };
    this.seen = frame;
    mirror.stats.frozen = (mirror.stats.frozen ?? 0) + 1;
    return true;
  }

  /** Something in it changed (or might have): everything back as it was, walked again from the next frame. */
  thaw() {
    if (this.dead) return;
    this.dead = true;
    const mirror = this.mirror, f = mirror.frameNo;
    for (const o of this.objects) {
      if (o.__frozen === this) o.__frozen = null;
      unwatchVector(o.position);
      unwatchVector(o.scale);
      unwatchTurn(o);
      unwatchVisible(o);
      o.removeEventListener('childadded', this._onChild);
      o.removeEventListener('childremoved', this._onChild);
    }
    const root = this.root;
    root.removeEventListener('removed', this._thaw);
    root.removeEventListener('added', this._thaw);
    if (hasOwn(root, 'updateMatrixWorld')) delete root.updateMatrixWorld;
    for (const node of this.nodes) {
      if (node.frozen !== this) continue;
      node.frozen = null;
      // (seen this frame: what left the scene is hidden by the next walk, which does not reach it)
      if (node.seen < this.seen) node.seen = this.seen;
      node.changedAt = f;
    }
    // (thawed soon after it froze: a longer wait before the next time)
    const n = root.__mirrorThaws = (root.__mirrorThaws ?? 0) + 1;
    root.__mirrorCool = f + STILL_FRAMES * Math.min(1 << Math.min(n, 6), 64);
    this.objects = []; this.nodes = []; this.mats = [];
    mirror.stats.frozen = Math.max(0, (mirror.stats.frozen ?? 1) - 1); mirror.stats.thaws = (mirror.stats.thaws ?? 0) + 1;
    mirror._frozenDirty = true;
  }

  /** What has no hook: a geometry rewritten or swapped, a render hook or face keys put on since. */
  check(frame, attrVersion) {
    for (const node of this.nodes) {
      const o = node.object, geo = o.geometry;
      if (geo !== node.geo || (geo && node.gv !== attrVersion(geo, frame)) || hasOwn(o, 'onBeforeRender') || o.userData.keyWeights || o.matrixAutoUpdate === false) { this.thaw(); return; }
    }
  }
}

// ---------------------------------------------------------------- the watches

/** A vector's x, y, z as accessors: a value that differs thaws. */
function watchVector(v, rec) {
  if (!v || v.__watch) return;
  const w = v.__watch = { rec, x: v.x, y: v.y, z: v.z };
  Object.defineProperties(v, {
    x: { configurable: true, enumerable: true, get() { return w.x; }, set(a) { if (a !== w.x) { w.x = a; w.rec.thaw(); } } },
    y: { configurable: true, enumerable: true, get() { return w.y; }, set(a) { if (a !== w.y) { w.y = a; w.rec.thaw(); } } },
    z: { configurable: true, enumerable: true, get() { return w.z; }, set(a) { if (a !== w.z) { w.z = a; w.rec.thaw(); } } },
  });
}
function unwatchVector(v) {
  const w = v?.__watch;
  if (!w) return;
  delete v.x; delete v.y; delete v.z;
  v.x = w.x; v.y = w.y; v.z = w.z;
  v.__watch = null;
}

/** The rotation's and the quaternion's change callbacks: a turn that differs thaws. */
function watchTurn(o, rec) {
  const q = o.quaternion, r = o.rotation;
  if (!q || !r || o.__turnWatch || typeof q._onChangeCallback !== 'function' || typeof r._onChangeCallback !== 'function') return;
  const w = o.__turnWatch = { qcb: q._onChangeCallback, rcb: r._onChangeCallback, x: q._x, y: q._y, z: q._z, w: q._w };
  const moved = () => { if (q._x !== w.x || q._y !== w.y || q._z !== w.z || q._w !== w.w) rec.thaw(); };
  q._onChangeCallback = function () { w.qcb.call(this); moved(); };
  r._onChangeCallback = function () { w.rcb.call(this); moved(); };
}
function unwatchTurn(o) {
  const w = o.__turnWatch;
  if (!w) return;
  o.quaternion._onChangeCallback = w.qcb;
  o.rotation._onChangeCallback = w.rcb;
  o.__turnWatch = null;
}

/** visible as an accessor: a change thaws. */
function watchVisible(o, rec) {
  if (o.__visWatch) return;
  const w = o.__visWatch = { rec, v: o.visible };
  Object.defineProperty(o, 'visible', { configurable: true, enumerable: true, get() { return w.v; }, set(a) { if (a !== w.v) { w.v = a; w.rec.thaw(); } } });
}
function unwatchVisible(o) {
  const w = o.__visWatch;
  if (!w) return;
  delete o.visible;
  o.visible = w.v;
  o.__visWatch = null;
}

// ---------------------------------------------------------------- the survey

/**
 * Can o's subtree be frozen now? Plain groups and meshes whose drawables have stayed put STILL_FRAMES, with no
 * render hook, face keys, own matrix (matrixAutoUpdate off), skeleton, instances, lines or points.
 */
function stillAt(o, f, memo) {
  if (o.__frozen && !o.__frozen.dead) return o.__frozen.root === o;
  let ok = true;
  if (typeof o.addEventListener !== 'function' || !o.position || !o.scale) ok = false;
  else if (o.isBone || o.isSkinnedMesh || o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite || o.isLight || o.isCamera || o.isScene) ok = false;
  else if (!(o.isMesh || o.type === 'Group' || o.type === 'Object3D')) ok = false;
  else if (o.matrixAutoUpdate === false || o.matrixWorldAutoUpdate === false || hasOwn(o, 'onBeforeRender') || hasOwn(o, 'updateMatrixWorld') || o.userData?.keyWeights) ok = false;
  else if ((o.__mirrorCool ?? 0) > f) ok = false;
  else if (o.isMesh) {
    if (o.geometry?.isInstancedBufferGeometry || o.morphTargetInfluences?.length) ok = false;
    else if (o.visible) { const n = o.__mirror; if (!n || !n.shown || f - (n.changedAt ?? f) < STILL_FRAMES) ok = false; }
  }
  const ch = o.children;
  for (let i = 0; i < ch.length; i++) if (!stillAt(ch[i], f, memo)) ok = false;
  memo.set(o, ok);
  return ok;
}

/** The scene's largest still subtrees frozen (the ones inside a bigger one thawed first, then taken in it). */
export function survey(mirror, scene, f) {
  const memo = new Map();
  stillAt(scene, f, memo);
  const pick = (o) => {
    const ch = o.children;
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i];
      if (memo.get(c) || (c.__frozen && !c.__frozen.dead && c.__frozen.root === c)) {
        if (c.__frozen && !c.__frozen.dead) continue;   // (already)
        {
          // (frozen ones inside: thawed quietly, their wait not lengthened, and taken in this one)
          c.traverse((x) => { const fr = x.__frozen; if (fr && !fr.dead && fr.root === x) { const n = x.__mirrorThaws ?? 0, cool = x.__mirrorCool; fr.thaw(); x.__mirrorThaws = n; x.__mirrorCool = cool; } });
          const rec = new Frozen(mirror, c);
          if (rec.freeze(f)) mirror._frozen.push(rec);
        }
      } else pick(c);
    }
  };
  pick(scene);
}

