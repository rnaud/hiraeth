import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

// ---------------------------------------------------------------------------
// Collision made after the first frame (docs/systems/performance.md, "Distant detail after the first frame"; #14).
//
// Some collision is a world's own detail, worked out from what is drawn: the sand banked against the walls collides
// where its skirt stands over the ground's height (src/sand-drifts.js `misfits`, 0.6 s of the Buried Machine's load).
// A piece of it is queued (src/deferred.js) at its place and made when its turn comes: the near pieces before the first
// frame, the rest after it, nearest first, and anything within the guard of the traveller in the frame he comes near.
// Three things keep it exact, so a drained queue answers every query as if it had all been baked at load:
// - **A query never misses a piece.** Every piece waiting is listed in the 16 m squares its box covers, and every ray,
//   capsule or box through the collision (physics.js compositeBVH) first makes the pieces in the squares it crosses
//   (`touchRay`, `touchBox`): a tree's burial check at load, a person's footing far away, a long ray across the map.
// - **A piece is made once**, whoever asks first (the queue, a query, a passage's far side).
// - **What a piece makes is fixed** when it is queued (its triangles copied, the height it is tested against frozen).
// What is made goes into a few colliders (`extras`, tested after physics.extras: every query tests each one's box), merged as they come like a
// binary counter: a new part, then two parts of about the same size into one, so there are never more than a dozen and
// each triangle is built into a BVH a few times in all. The big merges are built in a worker, the parts they replace
// answering till it is done. Once nothing is left, one collider holds it all.
// ---------------------------------------------------------------------------

const CELL = 8;
const keyOf = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
/** Triangles in a part at or over which a merge is built in a worker (the page keeps its frames). */
const WORKER_TRIS = 6000;

export class LateCollision {
  /** @param physics src/physics.js Physics: the parts go into its extras (as `ground`: the world's own, for footsteps). */
  constructor(physics, { worker = null } = {}) {
    this.physics = physics;
    physics.composite();
    physics.late = this;
    this.cells = new Map();
    this.pending = 0;
    this.parts = [];          // [{ tris: Float32Array, extra }], biggest first
    this.extras = [];         // (their colliders: physics.js compositeBVH tests them after physics.extras)
    this.merging = 0;
    this.triangles = 0;
    this.made = 0; this.ms = 0; this.forced = 0;
    // (a worker for the big merges, or none: tests, a page without workers)
    this.makeWorker = worker ?? (typeof Worker !== 'undefined' ? () => import('three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js').then((m) => new m.GenerateMeshBVHWorker()) : null);
  }

  /**
   * A piece to make later: `box` [x0, z0, x1, z1], what its triangles can cover; make() → its world-space triangles
   * (a Float32Array, nine floats each) or null. Returns the piece: piece.run() makes it (once).
   */
  add(box, make) {
    const piece = { box, make, done: false, run: () => this._run(piece) };
    const [x0, z0, x1, z1] = box;
    piece.keys = [];
    for (let cx = Math.floor((x0 - 0.1) / CELL); cx <= Math.floor((x1 + 0.1) / CELL); cx++)
      for (let cz = Math.floor((z0 - 0.1) / CELL); cz <= Math.floor((z1 + 0.1) / CELL); cz++) {
        const k = keyOf(cx, cz);
        let c = this.cells.get(k);
        if (!c) this.cells.set(k, (c = []));
        c.push(piece);
        piece.keys.push(k);
      }
    this.pending++;
    return piece;
  }

  _run(piece) {
    if (piece.done) return;
    piece.done = true;
    for (const k of piece.keys) {
      const c = this.cells.get(k);
      if (!c) continue;
      const i = c.indexOf(piece);
      if (i >= 0) c.splice(i, 1);
      if (!c.length) this.cells.delete(k);
    }
    this.pending--;
    const t = typeof performance !== 'undefined' ? performance.now() : 0;
    const tris = piece.make();
    if (tris?.length) this._part(tris);
    this.made++;
    this.ms += (typeof performance !== 'undefined' ? performance.now() : 0) - t;
    if (!this.pending) this._settle();
  }

  /** Make the pieces listed in square (cx, cz). */
  _cell(cx, cz) {
    const c = this.cells.get(keyOf(cx, cz));
    if (!c) return;
    for (const p of [...c]) { this.forced++; p.run(); }
  }

  /** Every piece a box (THREE.Box3) could touch, made now. */
  touchBox(box) {
    if (!this.pending) return;
    if (!box || box.isEmpty()) { this.flush(); return; }
    const x0 = Math.floor(box.min.x / CELL), x1 = Math.floor(box.max.x / CELL), z0 = Math.floor(box.min.z / CELL), z1 = Math.floor(box.max.z / CELL);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4 * this.cells.size) { for (const k of [...this.cells.keys()]) this._key(k, x0, x1, z0, z1); return; }
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) this._cell(cx, cz);
  }
  _key(k, x0, x1, z0, z1) {
    const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768;
    if (cx >= x0 && cx <= x1 && cz >= z0 && cz <= z1) this._cell(cx, cz);
  }

  /** Every piece a ray (THREE.Ray, from near to far along it) could meet, made now: the squares it crosses. */
  touchRay(ray, near = 0, far = Infinity) {
    if (!this.pending) return;
    const o = ray.origin, d = ray.direction;
    const h = Math.hypot(d.x, d.z);
    if (h < 1e-9) { this._cell(Math.floor(o.x / CELL), Math.floor(o.z / CELL)); return; }
    // (an endless ray: as far as the squares that are still waiting reach)
    if (!Number.isFinite(far)) far = 1e5;
    let x = o.x + d.x * near, z = o.z + d.z * near;
    const len = (far - near) * h, ux = d.x / h, uz = d.z / h;
    // the squares along the line, in order (a grid walk: each square it passes through, once)
    let cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const sx = ux > 0 ? 1 : ux < 0 ? -1 : 0, sz = uz > 0 ? 1 : uz < 0 ? -1 : 0;
    const dtx = sx ? CELL / Math.abs(ux) : Infinity, dtz = sz ? CELL / Math.abs(uz) : Infinity;
    let tx = sx > 0 ? ((cx + 1) * CELL - x) / ux : sx < 0 ? (cx * CELL - x) / ux : Infinity;
    let tz = sz > 0 ? ((cz + 1) * CELL - z) / uz : sz < 0 ? (cz * CELL - z) / uz : Infinity;
    // (past the last square anything waits in, nothing more to find)
    const n = Math.min(Math.ceil(len / CELL) * 2 + 2, 4096);
    for (let i = 0; i < n && this.pending; i++) {
      this._cell(cx, cz);
      // (a line through a corner touches the two squares beside it too)
      if (Math.abs(tx - tz) < 1e-6) { this._cell(cx + sx, cz); this._cell(cx, cz + sz); }
      const t = Math.min(tx, tz);
      if (t > len) break;
      if (tx <= tz) { cx += sx; tx += dtx; } else { cz += sz; tz += dtz; }
    }
  }

  /** Everything still waiting, now. */
  flush() {
    for (const c of [...this.cells.values()]) for (const p of [...c]) p.run();
  }

  // ---- the parts
  _extra(tris, bvh = null) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(tris, 3));
    bvh ??= new MeshBVH(g);
    g.computeBoundingBox();
    return { bvh, box: g.boundingBox.clone().expandByScalar(0.5), triangles: tris.length / 9, ground: true, late: true };
  }
  _part(tris) {
    const part = { tris, extra: this._extra(tris) };
    this.extras.push(part.extra);
    this.parts.push(part);
    this.triangles += tris.length / 9;
    this._merge();
  }
  /** Two parts of about the same size into one, from the small end (a binary counter's carry). */
  _merge(all = false) {
    for (;;) {
      const free = this.parts.filter((p) => !p.busy);
      if (free.length < 2) return;
      const a = free[free.length - 2], b = free[free.length - 1];
      if (!all && b.tris.length * 2 < a.tris.length) return;
      this._join(a, b);
    }
  }
  _join(a, b) {
    const tris = new Float32Array(a.tris.length + b.tris.length);
    tris.set(a.tris); tris.set(b.tris, a.tris.length);
    const swap = (extra) => {
      const X = this.extras;
      for (const p of [a, b]) { const i = X.indexOf(p.extra); if (i >= 0) X.splice(i, 1); this.parts.splice(this.parts.indexOf(p), 1); }
      X.push(extra);
      const part = { tris, extra };
      // (biggest first: the order the counter merges in)
      let i = this.parts.findIndex((p) => p.tris.length < tris.length);
      if (i < 0) i = this.parts.length;
      this.parts.splice(i, 0, part);
    };
    if (tris.length / 9 < WORKER_TRIS || !this.makeWorker) { swap(this._extra(tris)); return; }
    a.busy = b.busy = true; this.merging++;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(tris.slice(), 3));   // (the worker takes its buffer)
    Promise.resolve(this.makeWorker()).then(async (w) => {
      try { const bvh = await w.generate(geo); swap(this._extra(bvh.geometry.attributes.position.array, bvh)); }
      finally { w.dispose(); }
    }).catch((e) => {
      console.warn('late collision: worker merge failed, merging here', e);
      swap(this._extra(tris));
    }).finally(() => { this.merging--; a.busy = b.busy = false; this._merge(!this.pending); });
  }
  /** Nothing left to make: the parts into one. */
  _settle() { this._merge(true); }
}

/**
 * Pieces of collision (src/sand-drifts.js lateFitPieces: { x, y, z, r, box, make }) queued as distant detail
 * (src/deferred.js DeferredWork, tag 'collision') and made into physics' late collision. Returns how many.
 */
export function queueLateCollision(physics, defer, pieces) {
  if (!pieces.length) return 0;
  const late = physics.late ?? new LateCollision(physics);
  for (const p of pieces) { const piece = late.add(p.box, p.make); defer.add(p.x, p.y, p.z, piece.run, 'collision', p.r); }
  return pieces.length;
}
