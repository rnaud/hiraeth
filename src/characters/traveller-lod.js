import * as T from 'three';
import { TRAVELLER_LOD, lodInput, simplifyLevels, pickTravellerLevel } from './traveller-lod-core.js';

// The traveller's levels of detail (traveller-lod-core.js says what a level is and when it's drawn).
// Built after he is made, off the main thread; until they are ready, and wherever there's no worker
// (the engine bridges, tests without one), he draws his full meshes. main.js adds the result to
// skinnedLods, which picks each frame's level as it does for the people.

const PENDING = 'pending';

/**
 * One index for the full list `base` and its `levels` ([{ index, error }]): the full list first, then
 * each level's. Its `levels` are [{ start, count, error }] (the full list first); the attribute keeps
 * its base as `lodBase` (the glove, Humanoid.wearGlove, makes its own index from the base, never from this).
 */
export function combineLevels(base, levels, vertexCount) {
  const n = base.count, total = n + levels.reduce((s, l) => s + l.index.length, 0);
  const Arr = vertexCount > 65535 || base.array instanceof Uint32Array ? Uint32Array : Uint16Array;
  const index = new Arr(total);
  index.set(base.array.subarray(0, n), 0);
  const list = [{ start: 0, count: n, error: 0 }];
  let at = n;
  for (const l of levels) { index.set(l.index, at); list.push({ start: at, count: l.index.length, error: l.error }); at += l.index.length; }
  const attr = new T.BufferAttribute(index, 1);
  attr.lodBase = base;
  return { attr, base, levels: list };
}

/**
 * Picks and sets each mesh's level a frame (the skinnedLods interface: h, j, stats, update). A mesh's
 * levels belong to the index list they were made from: whoever sets another (the glove leaves the
 * hand under it out of the body's) has that one's levels made in turn, its full mesh drawn meanwhile.
 */
export class TravellerLod {
  /** build(input) → the levels of a lodInput() (or a promise of them; null: none) */
  constructor(humanoid, build) {
    this.h = humanoid;
    this.build = build;
    this.entries = [];
    this.jobs = new Set();
    this.j = -Infinity;
    this.stats = { tris: 0, full: 0 };
  }

  /** A mesh to give levels to; its current index's levels are asked for at once. */
  add(mesh) {
    const e = { mesh, geometry: mesh.geometry, cur: 0, byBase: new Map() };
    this.entries.push(e);
    this.request(e, mesh.geometry.index);
    return e;
  }

  request(e, base) {
    e.byBase.set(base, PENDING);
    let input;
    try { input = lodInput(e.geometry, base); } catch (err) { e.byBase.set(base, null); return; }
    const job = Promise.resolve(this.build(input)).then(
      (levels) => e.byBase.set(base, levels?.length ? combineLevels(base, levels, e.geometry.attributes.position.count) : null),
      () => e.byBase.set(base, null));
    this.jobs.add(job);
    job.finally(() => this.jobs.delete(job));
  }

  /** Every level asked for so far, built (tests, the first build). */
  async ready() { while (this.jobs.size) await Promise.all([...this.jobs]); return this; }

  /** The levels a mesh draws now (setting its index to theirs), or null: its full mesh. */
  current(e) {
    const g = e.geometry, idx = g.index;
    if (!idx) return null;
    const base = idx.lodBase ?? idx, rec = e.byBase.get(base);
    if (rec === undefined) this.request(e, base);
    if (!rec || rec === PENDING) {
      if (idx !== base) g.setIndex(base);
      return null;
    }
    if (idx !== rec.attr) g.setIndex(rec.attr);
    g.userData.travellerLevels = rec.levels;
    return rec.levels;
  }

  /** d: the camera's distance from his feet (m); size: his scale; pxPerRad, px as for every level (lod.js). */
  update(d, size, pxPerRad, px) {
    let tris = 0, full = 0, coarse = -Infinity;
    for (const e of this.entries) {
      const g = e.mesh.geometry;
      if (g !== e.geometry) continue;   // (something gave the mesh another geometry: it's left alone)
      const L = this.current(e);
      if (!L) {
        e.cur = 0;
        if (g.drawRange.start !== 0 || g.drawRange.count !== Infinity) g.setDrawRange(0, Infinity);
        const n = (g.index?.count ?? 0) / 3; tris += n; full += n;
        continue;
      }
      e.cur = pickTravellerLevel(L.slice(1), e.cur, d, size, pxPerRad, px);
      const l = L[e.cur];
      if (g.drawRange.start !== l.start || g.drawRange.count !== l.count) g.setDrawRange(l.start, l.count);
      tris += l.count / 3; full += L[0].count / 3;
      if (e.cur > 0) coarse = Math.max(coarse, e.cur);
    }
    this.j = coarse;
    this.stats.tris = tris; this.stats.full = full;
    return coarse;
  }

  /** Back to the full meshes (their own index lists). */
  reset() {
    for (const e of this.entries) {
      const g = e.geometry, idx = g.index;
      if (idx?.lodBase) g.setIndex(idx.lodBase);
      g.setDrawRange(0, Infinity);
      e.cur = 0;
    }
    this.j = -Infinity;
  }
}

/** His meshes worth levels: the body, the head, the overshirt (its shadow shares its geometry). */
export function lodMeshes(character) {
  return [character.mesh, character.head, character.cloth?.garment]
    .filter((m) => m?.geometry?.index && m.geometry.index.count / 3 >= TRAVELLER_LOD.minTris);
}

let worker = null, nextId = 1;
const jobs = new Map();
function levelsInWorker(input) {
  if (!worker) {
    worker = new Worker(new URL('./traveller-lod-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = jobs.get(data.id); jobs.delete(data.id); job?.(data.levels);
      if (!jobs.size) { worker?.terminate(); worker = null; }   // (made again if a level is asked for later)
    };
    worker.onerror = (e) => { console.warn('traveller lod: the worker failed', e.message ?? e); for (const job of jobs.values()) job(null); jobs.clear(); worker?.terminate(); worker = null; };
  }
  const id = nextId++;
  return new Promise((resolve) => {
    jobs.set(id, resolve);
    worker.postMessage({ id, input, ratios: TRAVELLER_LOD.ratios }, [input.index.buffer, input.position.buffer, input.attrs.buffer]);
  });
}

/**
 * His levels of detail: a TravellerLod once the first are built (null where they can't be: no worker,
 * or it failed). `simplifier` (meshoptimizer's MeshoptSimplifier, ready) builds them here instead (tests).
 */
export async function buildTravellerLod(character, { simplifier = null } = {}) {
  const meshes = lodMeshes(character);
  if (!meshes.length) return null;
  if (!simplifier && typeof Worker === 'undefined') return null;
  const lod = new TravellerLod(character.humanoid, simplifier ? (input) => simplifyLevels(simplifier, input) : levelsInWorker);
  const t0 = performance.now();
  for (const m of meshes) lod.add(m);
  await lod.ready();
  const built = lod.entries.map((e) => [e, [...e.byBase.values()].find((r) => r && r !== PENDING)]).filter(([, r]) => r);
  if (!built.length) { console.warn('traveller lod: not built'); return null; }
  console.info(`traveller lod (${Math.round(performance.now() - t0)} ms${simplifier ? '' : ', in a worker'}):`, built.map(([e, r]) => `${e.mesh.name} ` + r.levels.map((l) => `${Math.round(l.count / 3)}${l.error ? ` (${(l.error * 1000).toFixed(1)} mm)` : ''}`).join(' / ')).join(', '));
  return lod;
}
