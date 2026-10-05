import * as THREE from 'three';
import { cluster, thinParts } from './lod-core.js';

// Levels of detail: a distant building, rock or tree drawn with fewer triangles.
//
// simplify(): vertex clustering on a grid (Rossignac & Borrel), with each cell's
// vertex placed where it best fits the planes of the triangles around it (a quadric,
// as in Lindstrom's out-of-core simplification), so corners and edges stay where they
// were instead of rounding off. Every vertex in a cell moves to the same point, so
// surfaces that met still meet (no cracks); vertices are only kept apart when their
// normals (26 directions) or other attributes differ, so hard edges, colours and the
// shader's own attributes are never blended. Triangles with two corners in one cell
// disappear. Long parts thinner than a cell (poles, cables, limbs) are only thinned out
// along their length, so they never fold away. The error is under a cell: a level whose
// cell is under a pixel on screen looks the same, outline included (the ink pass draws
// the silhouette). The clustering itself is in lod-core.js (plain arrays, for the worker).
//
// LodManager: every static mesh worth it (merged blocks, kits, rocks, instanced props)
// gets levels whose cells double: 2^j units in the mesh's own space. Each frame its
// distance from the camera says how big a cell may be (`px` pixels: the preset's
// lodPx), and the mesh draws the coarsest level that fits, by swapping its geometry:
// no extra objects or draw calls, the instances, materials and visibility untouched.
// A switch waits for the distance to pass the threshold by ~10 % (no flicker on the
// edge); levels are built the first time they are wanted, a few milliseconds a frame.
// Shadow passes may go coarser still: a level whose cell is under a texel of the map
// casts the same shadow (shadowPass(texel) / viewPass()). Rendering only: the
// collision was baked from the full meshes at load, and a level's geometry points
// back at its source (userData.lodSource) for anything baked later (physics.js).

const MIN_CELL = 0.04;   // m: no level finer than this (it would save nothing)
const _n = new THREE.Vector3(), _w = new THREE.Vector3();

const triCount = (g) => {
  const n = g.index ? g.index.count : g.attributes.position?.count ?? 0;
  return Math.floor(Math.max(0, Math.min(n - g.drawRange.start, g.drawRange.count)) / 3);
};

/**
 * The part of a geometry its triangles use, as plain arrays (what the worker gets): positions,
 * the other attributes, triangles renumbered over just those vertices, and the lock.
 */
export function pack(geo, lock = null) {
  const P = geo.attributes.position, idx = geo.index?.array ?? null;
  const total = idx ? idx.length : P.count;
  const start = Math.min(geo.drawRange.start, total), end = Math.min(total, start + geo.drawRange.count);
  const nTri = Math.floor((end - start) / 3);
  const remap = new Int32Array(P.count).fill(-1), used = [];
  const tri = new Uint32Array(nTri * 3);
  for (let k = 0; k < nTri * 3; k++) {
    const v = idx ? idx[start + k] : start + k;
    let r = remap[v];
    if (r < 0) { r = remap[v] = used.length; used.push(v); }
    tri[k] = r;
  }
  const n = used.length;
  const read = (A) => {
    const s = A.itemSize, out = new Float32Array(n * s);
    if (!A.isInterleavedBufferAttribute && !A.normalized) {
      const a = A.array;
      for (let i = 0; i < n; i++) { const o = used[i] * s; for (let c = 0; c < s; c++) out[i * s + c] = a[o + c]; }
    } else {
      for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) out[i * s + c] = A.getComponent(used[i], c);
    }
    return out;
  };
  const attrs = [];
  for (const [name, A] of Object.entries(geo.attributes)) {
    if (name === 'position' || A.isInstancedBufferAttribute) continue;   // (per instance: the mesh keeps its own)
    attrs.push({ name, itemSize: A.itemSize, normalized: A.normalized, type: (A.isInterleavedBufferAttribute ? A.data.array : A.array).constructor.name, array: read(A) });
  }
  let lk = null;
  if (lock) { lk = new Uint8Array(n); for (let i = 0; i < n; i++) lk[i] = lock[used[i]]; }
  return { pos: read(P), tri, attrs, lock: lk };
}

const TYPES = { Float32Array, Float64Array, Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array };
/** A geometry from cluster()'s arrays, with the source's bounds and a pointer back at it. */
export function unpack(r, src) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
  for (const A of r.attrs) {
    // back to the source's own array type (colours in bytes, ids in ints)
    const T = TYPES[A.type] ?? Float32Array;
    let arr = A.array;
    if (T !== Float32Array) {
      arr = new T(A.array.length);
      if (A.normalized) {
        const max = T === Uint8Array ? 255 : T === Uint16Array ? 65535 : T === Int8Array ? 127 : T === Int16Array ? 32767 : 1;
        for (let i = 0; i < arr.length; i++) arr[i] = Math.round(A.array[i] * max);
      } else arr.set(A.array.map(Math.round));
    }
    g.setAttribute(A.name, new THREE.BufferAttribute(arr, A.itemSize, A.normalized));
  }
  g.setIndex(new THREE.BufferAttribute(r.index, 1));
  if (!src.boundingBox) src.computeBoundingBox();
  if (!src.boundingSphere) src.computeBoundingSphere();
  g.boundingBox = src.boundingBox.clone();
  g.boundingSphere = src.boundingSphere.clone();
  g.userData.lodSource = src.userData.lodSource ?? src;
  g.userData.lodCell = r.cell;
  g.name = `${src.name || src.type} lod ${r.cell}`;
  return g;
}

/**
 * A simplified copy of `geo`: vertices clustered on a grid of `cell` (in the geometry's units).
 * @param o.lock  Uint8Array over source vertices: these keep their place (where tiles of one
 *                mesh meet: both sides keep the same border)
 * @param o.minRatio  null if the copy keeps more than this share of the triangles
 * @returns BufferGeometry (indexed, same attributes, the source's bounds,
 *          userData.lodSource = geo, userData.lodCell = cell) or null
 */
export function simplify(geo, cell, { lock = null, minRatio = 1 } = {}) {
  if (!geo.attributes.position || !(cell > 0)) return null;
  const r = cluster(pack(geo, lock), cell, minRatio);
  return r && unpack(r, geo);
}

// ------------------------------------------------------------------ choosing a level
/**
 * The level for a mesh `d` metres away: levels are cells of 2^j units (× `scale` metres per
 * unit), and a cell may be `px` pixels on screen (pxPerRad: pixels per radian). Keeps `cur`
 * while the distance is within ~10 % (2^hyst) of its range. Returns j (-Infinity: full detail).
 */
export function pickLevel(cur, d, scale, pxPerRad, px, { hyst = 0.15, min = -Infinity, max = Infinity } = {}) {
  if (!(px > 0) || !(d > 0)) return -Infinity;
  const x = Math.log2((d * px) / (pxPerRad * scale));   // the cell that fits, as a power of two
  let j = Math.floor(x);
  if (cur !== -Infinity && x >= cur - hyst && x < cur + 1 + hyst) j = cur;   // within its band: stay
  else if (cur === -Infinity && x < min + hyst) return -Infinity;            // only just far enough: stay full
  if (j < min) return -Infinity;
  return Math.min(j, max);
}

// ------------------------------------------------------------------ the manager
/** Vertices of a shared position buffer that more than one of these meshes use (the seams between tiles). */
function sharedVertices(meshes) {
  const P = meshes[0].geometry.attributes.position, owner = new Int32Array(P.count).fill(-1), lock = new Uint8Array(P.count);
  meshes.forEach((m, mi) => {
    const g = m.geometry, idx = g.index?.array;
    if (!idx) return;
    for (let k = 0; k < idx.length; k++) { const v = idx[k]; if (owner[v] === -1) owner[v] = mi; else if (owner[v] !== mi) lock[v] = 1; }
  });
  return lock;
}

/** Largest scale among an InstancedMesh's instances. */
function instanceScale(o) {
  let s = 0;
  const a = o.instanceMatrix.array;
  for (let i = 0; i < o.count; i++) {
    const e = i * 16;
    s = Math.max(s, Math.hypot(a[e], a[e + 1], a[e + 2]), Math.hypot(a[e + 4], a[e + 5], a[e + 6]), Math.hypot(a[e + 8], a[e + 9], a[e + 10]));
  }
  return s || 1;
}

const PENDING = Symbol('pending');

/**
 * Builds levels off the main thread (src/lod-worker.js) where there are workers, else here
 * within the frame's budget. A job is packed here (just the triangles' own vertices) and
 * comes back as arrays.
 */
class Builder {
  constructor(useWorker) {
    this.worker = null; this.jobs = new Map(); this.next = 1;
    if (useWorker && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./lod-worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = ({ data }) => { const job = this.jobs.get(data.id); this.jobs.delete(data.id); job?.(data.r); };
        this.worker.onerror = (e) => { console.warn('lod: the worker failed; building on the main thread', e.message ?? e); this.worker = null; for (const job of this.jobs.values()) job(undefined); this.jobs.clear(); };
      } catch (e) { this.worker = null; }
    }
  }
  get busy() { return this.jobs.size; }
  /** done(r): r = cluster() arrays, null (not worth it) or undefined (failed: try again later) */
  run(packed, cell, minRatio, done) {
    if (!this.worker) { done(cluster(packed, cell, minRatio)); return; }
    const id = this.next++;
    this.jobs.set(id, done);
    const transfer = [packed.pos.buffer, packed.tri.buffer, ...packed.attrs.map((a) => a.array.buffer)];
    if (packed.lock) transfer.push(packed.lock.buffer);
    this.worker.postMessage({ id, packed, cell, minRatio }, transfer);
  }
  dispose() { this.worker?.terminate(); this.worker = null; this.jobs.clear(); }
}

let sharedBuilder = null, syncBuilder = null;
/** The levels' worker, shared (skinned-lod.js builds the people's levels there too); sync: build here, now. */
export function levelBuilder(sync = false) {
  if (sync) return (syncBuilder ??= new Builder(false));
  return (sharedBuilder ??= new Builder(true));
}

export class LodManager {
  /**
   * @param o.keep     roots whose meshes are left alone (the player, people, vehicles)
   * @param o.exclude  meshes left alone (the terrain: it is dug into at runtime)
   * @param o.minTris  meshes under this many triangles (instances included) aren't worth it
   * @param o.minEach  nor ones whose geometry has fewer than this
   * @param o.budget   ms a frame for packing (and, without a worker, building) levels
   * @param o.worker   build in a web worker where possible
   */
  constructor(scene, { keep = [], exclude = [], minTris = 400, minEach = 48, budget = 2, worker = true } = {}) {
    this.scene = scene; this.keep = new Set(keep.filter(Boolean)); this.exclude = new Set(exclude.filter(Boolean));
    this.minTris = minTris; this.minEach = minEach; this.budget = budget;
    this.entries = []; this.levels = new Map();   // full geometry → Map(j → geometry | null | PENDING)
    this.locks = new Map();                        // shared position attribute → the vertices on its tiles' seams
    this.queue = []; this.queued = new Set();
    this.builder = new Builder(worker);
    this.stats = { meshes: 0, switched: 0, built: 0, packMs: 0, pending: 0, saved: 0, coarse: 0 };
    this.n = -1;
  }

  /** The full geometry of a mesh a coarser level stands in for now (undefined if none). */
  fullOf(o) { const e = this.entries.find((x) => x.o === o); return e && e.cur !== e.full ? e.full : undefined; }

  kept(o) { for (let p = o; p; p = p.parent) if (this.keep.has(p) || p.userData.noLod) return true; return false; }

  /** (Re)collect the meshes worth levels; entries already known keep their state. */
  collect() {
    const known = new Map(this.entries.map((e) => [e.o, e]));
    const entries = [], byPos = new Map();
    this.scene.updateMatrixWorld();
    this.scene.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || this.exclude.has(o)) return;
      if (known.has(o)) { entries.push(known.get(o)); return; }
      const g = o.geometry, ud = o.userData;
      if (!g?.attributes?.position || ud.dynamic || g.userData.lodSource || Object.keys(g.morphAttributes).length || g.groups.length > 1) return;
      if (g.attributes.position.usage === THREE.DynamicDrawUsage) return;
      if (o.isInstancedMesh && (o.instanceMatrix.usage === THREE.DynamicDrawUsage || !o.frustumCulled)) return;
      if (o.material?.allowOverride === false || o.material?.wireframe || !(o.material?.isShaderMaterial || o.material?.isMeshStandardMaterial || o.material?.isMeshBasicMaterial || o.material?.isMeshLambertMaterial)) return;
      const each = triCount(g), total = each * (o.isInstancedMesh ? o.count : 1);
      if (each < this.minEach || total < this.minTris || this.kept(o)) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (o.isInstancedMesh && !o.boundingSphere) o.computeBoundingSphere();
      if (!g.boundingSphere || !Number.isFinite(g.boundingSphere.radius)) return;
      const r = g.boundingSphere.radius;
      const e = { o, full: g, cur: g, j: -Infinity, shadow: false, each, inst: o.isInstancedMesh ? instanceScale(o) : 1,
        min: Math.floor(Math.log2(Math.max(r / 4000, 1e-4))), max: Math.floor(Math.log2(Math.max(r * 0.35, 1e-4))), d: 0 };
      entries.push(e);
      const P = g.attributes.position;
      if (!byPos.has(P)) byPos.set(P, []);
      byPos.get(P).push(o);
    });
    // tiles of one mesh (perf.js tileScene) share its vertices: the ones on their seams stay put
    for (const [P, list] of byPos) if (list.length > 1 && new Set(list.map((m) => m.geometry)).size > 1 && !this.locks.has(P)) this.locks.set(P, sharedVertices(list));
    this.entries = entries;
    this.stats.meshes = entries.length;
    this.n = this.scene.children.length;
  }

  /** Level j of an entry: a geometry, null (not worth it), PENDING, or undefined (not asked for yet). */
  get(e, j) { return this.levels.get(e.full)?.get(j); }

  ask(e, j) {
    if (this.get(e, j) !== undefined || this.queued.has(`${e.full.id}:${j}`)) return;
    this.queued.add(`${e.full.id}:${j}`);
    this.queue.push([e, j]);
  }

  build(e, j) {
    this.queued.delete(`${e.full.id}:${j}`);
    let m = this.levels.get(e.full);
    if (!m) this.levels.set(e.full, (m = new Map()));
    if (m.has(j)) return;
    // a coarser level not worth it: neither is this one
    for (const [k, g] of m) if (k > j && g === null) { m.set(j, null); return; }
    m.set(j, PENDING);
    const t0 = performance.now();
    const packed = pack(e.full, this.locks.get(e.full.attributes.position) ?? null);
    this.stats.packMs += performance.now() - t0;
    this.builder.run(packed, 2 ** j, 0.8, (r) => {
      if (r === undefined) { m.delete(j); return; }   // the worker died: ask again
      const g = r ? unpack(r, e.full) : null;
      if (g) this.stats.built++;
      m.set(j, g);
    });
  }

  /** The coarsest ready level at or under j (the full geometry if none); asks for j if missing. */
  best(e, j) {
    if (j === -Infinity) return e.full;
    const m = this.levels.get(e.full);
    const g = m?.get(j);
    if (g === undefined) this.ask(e, j);
    if (g && g !== PENDING) return g;
    if (g === null) return e.full;
    if (m) for (let i = j - 1; i >= e.min; i--) { const f = m.get(i); if (f === null) break; if (f && f !== PENDING) return f; }
    return e.full;
  }

  /** The power-of-two cell (in the mesh's units) a distance allows. */
  want(e, d, sc, pxPerRad, px, cur) {
    return pickLevel(cur, d, sc, pxPerRad, px, { min: Math.max(e.min, Math.floor(Math.log2(MIN_CELL / sc))), max: e.max });
  }

  /**
   * Once a frame before rendering: each mesh's level for this view.
   * @param pxPerRad pixels per radian at the render resolution
   * @param px  how many pixels a cell may be (the preset's lodPx; 0 = full detail everywhere)
   */
  update(camera, pxPerRad, px) {
    if (this.n !== this.scene.children.length) this.collect();
    const cam = camera.position;
    let switched = 0, saved = 0, coarse = 0;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i], o = e.o;
      if (o.geometry !== e.cur) { this.entries.splice(i--, 1); continue; }   // someone else changed its geometry: theirs now
      if (!o.visible) continue;
      const s = o.isInstancedMesh ? o.boundingSphere : e.full.boundingSphere;
      if (!s || s.radius < 0) continue;
      const k = o.matrixWorld.getMaxScaleOnAxis();
      _w.copy(s.center).applyMatrix4(o.matrixWorld);
      const d = (e.d = Math.max(cam.distanceTo(_w) - s.radius * k, 0));
      e.j = px > 0 ? this.want(e, d, k * e.inst, pxPerRad, px, e.j) : -Infinity;
      const g = this.best(e, e.j);
      if (g !== o.geometry) { o.geometry = g; e.cur = g; switched++; }
      if (g !== e.full) { coarse++; saved += (e.each - triCount(g)) * (o.isInstancedMesh ? o.count : 1); }
    }
    this.pump();
    Object.assign(this.stats, { switched, saved, coarse, pending: this.queue.length + this.builder.busy });
  }

  /** Start the levels asked for: a few ms a frame, two in the worker at a time. */
  pump(budget = this.budget) {
    const t0 = performance.now();
    while (this.queue.length && this.builder.busy < 2 && performance.now() - t0 < budget) {
      const [e, j] = this.queue.pop();   // the latest asked first: what the view wants now
      this.build(e, j);
    }
  }

  /** Build everything waiting (measuring, tests); resolves once the worker is done too. */
  async flush() {
    for (;;) {
      while (this.queue.length) { const [e, j] = this.queue.pop(); this.build(e, j); if (this.builder.busy >= 4) break; }
      if (!this.queue.length && !this.builder.busy) return;
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  /**
   * Before a shadow pass whose texel is `texel` metres: what a texel can't show, the shadow
   * doesn't need (each mesh at least as coarse as in the view). viewPass() puts the view's back.
   */
  shadowPass(texel) {
    for (const e of this.entries) {
      const o = e.o;
      if (!o.visible || o.geometry !== e.cur) continue;
      const sc = o.matrixWorld.getMaxScaleOnAxis() * e.inst;
      const jt = Math.min(Math.floor(Math.log2(texel / sc)), e.max);
      if (jt < e.min || jt <= e.j) continue;
      const g = this.best(e, jt);
      if (g !== o.geometry) { o.geometry = g; e.cur = g; e.shadow = true; }
    }
  }
  viewPass() {
    for (const e of this.entries) {
      if (!e.shadow) continue;
      e.shadow = false;
      if (e.o.geometry !== e.cur) continue;
      e.o.geometry = e.cur = this.best(e, e.j);
    }
  }

  /** Everything back to full detail. */
  reset() {
    for (const e of this.entries) if (e.o.geometry === e.cur) { e.o.geometry = e.cur = e.full; e.j = -Infinity; }
  }

  dispose() {
    this.reset();
    this.builder.dispose();
    for (const m of this.levels.values()) for (const g of m.values()) if (g && g !== PENDING) g.dispose();
    this.levels.clear();
  }
}

// ------------------------------------------------------------------ the frame's scale, for those that pick their own detail
/** This frame's pixels per radian and the preset's lodPx (main.js sets them before rendering). */
export const lodView = { pxPerRad: 0, px: 0 };

/** How far (x radius) a closed convex mesh round the origin falls inside its sphere: its worst flat face. */
export function sphereError(geo) {
  const P = geo.attributes.position, idx = geo.index?.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  let r = 0, m = Infinity;
  for (let i = 0; i < P.count; i++) r = Math.max(r, a.fromBufferAttribute(P, i).length());
  const nT = (idx ? idx.length : P.count) / 3;
  for (let t = 0; t < nT; t++) {
    const v = (k) => (idx ? idx[t * 3 + k] : t * 3 + k);
    a.fromBufferAttribute(P, v(0)); b.fromBufferAttribute(P, v(1)); c.fromBufferAttribute(P, v(2));
    n.subVectors(c, b).cross(_w.subVectors(a, b));
    if (n.lengthSq() > 0) m = Math.min(m, Math.abs(n.normalize().dot(a)));
  }
  return r > 0 && Number.isFinite(m) ? 1 - m / r : 1;
}

// ------------------------------------------------------------------ one far geometry (instanced sets refilled each frame)
/**
 * For meshes that sort their own instances by distance (flora.js): a coarser copy of `geo`
 * that keeps at most `ratio` of the triangles, from the finest power-of-two cell that does,
 * no coarser than `maxCell`. Returns { geometry, cell } or null.
 */
export function farLevel(geo, { ratio = 0.55, minCell = 1 / 64, maxCell = 1 } = {}) {
  const full = triCount(geo);
  if (full < 24) return null;
  for (let c = minCell; c <= maxCell; c *= 2) {
    const g = simplify(geo, c);
    if (g && triCount(g) <= full * ratio) return { geometry: g, cell: c };
  }
  return null;
}

/** Hysteresis for one switch distance: far once past `d` × 1.1, near again under `d` / 1.1. */
export function farSide(wasFar, dist, d, hyst = 1.1) {
  return wasFar ? dist > d / hyst : dist > d * hyst;
}

export { triCount, cluster, thinParts };
