import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Distant procedural detail, finished after the first frame (docs/systems/performance.md, "Distant detail after the
// first frame"; issue #14).
//
// A world's load used to finish every piece of its detail, wherever it stood, before the first frame: the City-Shaft's
// check for trees a clump had put inside a house (a dozen rays through the collision for each of thousands of trees)
// was 2.5 s of its 6.7 s on this Mac. Work like that, which decides how something far away looks and nothing about
// where you can walk, the story or the routes, is queued here instead, a job at a place:
// - before the first frame, every job within DEFER.near of where the traveller will stand (a saved place, an arrival
//   by ship, the spawn) and of the ship and every way through (`needSteps`, sliced like the rest of the load);
// - after it, the nearest jobs to the traveller first, within DEFER.budget ms a frame (`run`),
//   found by walking rings of 32 m cells out from his, so a teleport, a passage or a fast ride is followed;
// - whatever is within DEFER.guard of him is done that frame whatever it costs (`run`'s guard, and `need` for a
//   passage's far side before it is shown), so nothing near is ever seen unfinished;
// - `cancel` drops what is left (a world left, a test).
// The jobs are plain functions: each must be safe to run late, once, in any order (a tree dropped). A job may say how
// far round its place what it makes reaches (`add`'s r: a piece of the drifts' collision, a stretch of a crowd's walk),
// so it counts as near when its edge is; one run by the guard or a passage (`need`) sees `urgent` set, so a job that is
// one part of something bigger (a walk's chunk) finishes the whole of it there and then.
// What goes through it: the trees-in-houses and buried-flora checks (src/physics.js), the drifts' collision
// (src/late-collision.js) and the crowd's strollers (src/crowd.js buildPeopleSteps).
// ---------------------------------------------------------------------------

export const DEFER = {
  /** ms of queued work a frame after the first. */
  budget: 2,
  /** m round where the first frame looks from (and the ship, the ways through): done before it. */
  near: 140,
  /** m round the traveller: done in the frame it comes within, whatever the budget. */
  guard: 70,
};

/** A cell of the queue's grid (x, z, in CELL m squares). */
const CELL = 32;
const keyOf = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

export class DeferredWork {
  constructor({ budget = DEFER.budget, guard = DEFER.guard, now = () => performance.now() } = {}) {
    this.budget = budget; this.guard = guard; this.now = now;
    // (the jobs by grid cell: the nearest found by walking rings of cells out from the traveller's, no sorting)
    this.cells = new Map();
    this.count = 0;
    this.ring = { key: null, r: 0, list: null };   // (where the walk is: rings inside r are empty round that cell)
    this.done = 0; this.ms = 0; this.queued = 0; this.forced = 0;
    this.maxR = 0;   // (the widest job's reach: a lookup round a point looks that much further)
    this.urgent = false;   // (while a forced job runs: see _do)
  }
  get pending() { return this.count; }
  /**
   * Queue fn, for the place (x, y, z); tag: what it is (cancel by it); r: how far round that place what it makes
   * reaches (a piece of collision 20 m across: it is near when its edge is, not only its middle).
   */
  add(x, y, z, fn, tag = '', r = 0) {
    const k = keyOf(Math.floor(x / CELL), Math.floor(z / CELL));
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = []));
    c.push({ x, y, z, fn, tag, r });
    if (r > this.maxR) this.maxR = r;
    this.count++; this.queued++;
    this.ring.key = null;   // (the walk starts again: this cell may be inside its rings)
    return this;
  }
  /** (urgent: the job is forced, by the guard or a place about to be shown: `urgent` tells it, a job in parts finishes all of them) */
  _do(j, urgent = false) {
    const t = this.now(), was = this.urgent;
    this.urgent = urgent;
    try { j.fn(); } catch (e) { console.warn('deferred job failed', e); } finally { this.urgent = was; }
    this.ms += this.now() - t; this.done++;
  }
  /** The jobs within r of p (their own reach added), taken out of the queue. */
  _take(p, r) {
    const out = [];
    if (!this.count) return out;
    const R = r + this.maxR;
    const x0 = Math.floor((p.x - R) / CELL), x1 = Math.floor((p.x + R) / CELL), z0 = Math.floor((p.z - R) / CELL), z1 = Math.floor((p.z + R) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = keyOf(cx, cz), c = this.cells.get(k);
      if (!c) continue;
      const keep = [];
      for (const j of c) ((j.x - p.x) ** 2 + (j.y - p.y) ** 2 + (j.z - p.z) ** 2 <= (r + j.r) ** 2 ? out : keep).push(j);
      if (keep.length) this.cells.set(k, keep); else this.cells.delete(k);
    }
    this.count -= out.length;
    return out;
  }
  /** Every job within r of p, now (what a passage is about to show, or a ride got ahead of). Returns how many. */
  need(p, r) {
    const due = this._take(p, r);
    for (const j of due) this._do(j, true);
    this.forced += due.length;
    return due.length;
  }
  /** need() a few jobs a step (src/load-steps.js), round each of `points` in turn. */
  *needSteps(points, r, per = 8) {
    let n = 0;
    for (const p of points) {
      if (!p) continue;
      const due = this._take(p, r);
      for (let i = 0; i < due.length; i++) { this._do(due[i], true); n++; if (i % per === per - 1) yield; }
    }
    return n;
  }
  /** The cells of ring r round cell (cx, cz) that hold jobs. */
  _ringCells(cx, cz, r) {
    const out = [];
    const at = (x, z) => { const k = keyOf(x, z); if (this.cells.has(k)) out.push(k); };
    if (r === 0) { at(cx, cz); return out; }
    for (let i = -r; i <= r; i++) { at(cx + i, cz - r); at(cx + i, cz + r); }
    for (let i = -r + 1; i <= r - 1; i++) { at(cx - r, cz + i); at(cx + r, cz + i); }
    return out;
  }
  /** A frame's share: what is within the guard of p, then the nearest to p for up to `budget` ms. Returns how many. */
  run(p, budget = this.budget) {
    if (!this.count) return 0;
    let n = this.guard > 0 ? this.need(p, this.guard) : 0;
    const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL), key = keyOf(cx, cz), R = this.ring;
    if (R.key !== key) { R.key = key; R.r = 0; R.list = null; }
    const t0 = this.now();
    while (this.count && this.now() - t0 < budget) {
      if (!R.list?.length) {
        R.list = this._ringCells(cx, cz, R.r);
        if (!R.list.length) { R.r++; R.list = null; if (R.r > 4096) break; continue; }
      }
      const k = R.list[R.list.length - 1], c = this.cells.get(k);
      if (!c?.length) { R.list.pop(); this.cells.delete(k); continue; }
      const j = c.pop(); this.count--;
      if (!c.length) { this.cells.delete(k); R.list.pop(); }
      this._do(j); n++;
    }
    return n;
  }
  /** Drop what is left (all of it, or one tag's). Returns how many. */
  cancel(tag = null) {
    const before = this.count;
    if (tag === null) this.cells.clear();
    else for (const [k, c] of this.cells) { const keep = c.filter((j) => j.tag !== tag); if (keep.length) this.cells.set(k, keep); else this.cells.delete(k); }
    this.count = 0; for (const c of this.cells.values()) this.count += c.length;
    this.ring.key = null;
    return before - this.count;
  }
  /** Everything left, now (tests, the studio, a page without frames). Returns how many. */
  flush() {
    const all = [...this.cells.values()].flat();
    this.cells.clear(); this.count = 0; this.ring.key = null;
    for (const j of all) this._do(j);
    return all.length;
  }
}

// An instanced mesh cut into tiles (perf.js tileSceneSteps) draws from copies of its instances: a job that drops one of
// the source's instances later (a buried tree) drops its copy too.
/** source mesh → for each of its instances, [tile, index in the tile] */
export const INSTANCE_COPIES = new WeakMap();
const _m = new THREE.Matrix4();

/** Scale instance i of `mesh` to nothing where it stands, and its tile's copy (the drop dropBuriedInstances makes). */
export function dropInstance(mesh, i) {
  mesh.getMatrixAt(i, _m);
  const e = _m.elements;
  e[0] = e[1] = e[2] = e[4] = e[5] = e[6] = e[8] = e[9] = e[10] = 0;
  set(mesh, i);
  const c = INSTANCE_COPIES.get(mesh)?.[i];
  if (c) set(c[0], c[1]);
}
/** (only that instance's 16 floats sent again, not the mesh's whole buffer: a few trees a frame) */
function set(mesh, i) {
  mesh.setMatrixAt(i, _m);
  mesh.instanceMatrix.addUpdateRange(i * 16, 16);
  mesh.instanceMatrix.needsUpdate = true;
}
