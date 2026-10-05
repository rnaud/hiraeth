import { pack, unpack, pickLevel, triCount, levelBuilder } from './lod.js';

// Levels of detail for the people's skinned bodies (~12.5 k triangles each, the costume pieces on
// top). A body far off draws a simplified copy of each skinned mesh: the same vertex clustering as
// the static levels (lod.js, lod-core.js), with every cell's bone weights merged (lod-core.js
// mergeSkin), so a level is still a skinned mesh on the same skeleton and bends with it, nothing
// tearing at the joints. Levels are chosen by the same rule as everything else (a cell no bigger
// than the Graphics preset's lodPx on screen), so up close a body is always its full mesh: the
// face, the eyes, the hands as modelled. Far enough that an eye is under half a pixel, the eyes and
// the brows are hidden (they are separate meshes; the face's own drawing stays on the body).
//
// Levels are built once per geometry (the builds' shapes are shared, so most people share them),
// in the levels' worker, when first wanted; until then the finer one draws. The swap is only the
// geometry: no extra objects, draw calls, skeletons or materials. Anything that reshapes the body
// (a build, a face, a costume) first puts the full meshes back (Humanoid calls lod.reset()).

export const SKIN_LOD = {
  min: -6, max: -3,      // cells of 1/64 .. 1/8 m (x the body's size)
  minTris: 300,          // meshes smaller than this aren't worth it
  hideFace: -4,          // from 1/16 m cells (an eye is under half a pixel): no eyes or brows
  keep: 0.85,            // a level must drop at least 15 % of the triangles
};
const PENDING = Symbol('pending');
const LEVELS = new WeakMap();   // full geometry -> Map(j -> geometry | null | PENDING)

/** Level j of a full geometry: a geometry, null (not worth it), or undefined (asked for; not ready). */
function level(full, j, sync) {
  let m = LEVELS.get(full);
  if (!m) LEVELS.set(full, (m = new Map()));
  const g = m.get(j);
  if (g !== undefined) return g === PENDING ? undefined : g;
  // a coarser level not worth it: nor is this one
  for (const [k, v] of m) if (k > j && v === null) { m.set(j, null); return null; }
  m.set(j, PENDING);
  const done = (r) => {
    if (r === undefined) { m.delete(j); return; }   // the worker failed: ask again
    m.set(j, r ? unpack(r, full) : null);
  };
  levelBuilder(sync).run(pack(full), 2 ** j, SKIN_LOD.keep, done);
  const now = m.get(j);
  return now === PENDING ? undefined : now;
}

export class SkinnedLod {
  /** @param humanoid a Humanoid; o.sync builds levels at once (tests) */
  constructor(humanoid, { sync = false } = {}) {
    this.h = humanoid;
    this.sync = sync;
    this.j = -Infinity;
    this.entries = null;
    this.faceHidden = false;
    this.stats = { tris: 0, full: 0 };
  }

  /** The skinned meshes worth levels (the body, costume pieces), and the face's (eyes, brows). */
  collect() {
    const h = this.h, list = [];
    h.model.traverse((o) => {
      if (!o.isSkinnedMesh || o === h.eyeMesh || o === h.browMesh || Array.isArray(o.material)) return;
      if (triCount(o.geometry) < SKIN_LOD.minTris || Object.keys(o.geometry.morphAttributes).length) return;
      list.push({ mesh: o, full: o.geometry, cur: o.geometry });
    });
    this.entries = list;
    this.face = [h.eyeMesh, h.browMesh].filter(Boolean);
  }

  /** Back to the full meshes (before anything reshapes the body: Humanoid.reshapeBody, dress, setFace). */
  reset() {
    if (this.entries) for (const e of this.entries) if (e.mesh.geometry === e.cur) e.mesh.geometry = e.full;
    this.entries = null;
    this.j = -Infinity;
    this.showFace(true);
  }

  showFace(on) {
    if (on === !this.faceHidden) return;
    for (const m of this.face ?? []) m.visible = on;
    this.faceHidden = !on;
  }

  /**
   * Pick this frame's level: d = the body's distance from the camera (m), size = its scale,
   * pxPerRad and px as for the static levels (lod.js lodView; px 0: full detail).
   */
  update(d, size, pxPerRad, px) {
    if (!this.entries) this.collect();
    const j = (this.j = px > 0 && pxPerRad > 0 ? pickLevel(this.j, d, size, pxPerRad, px, { min: SKIN_LOD.min, max: SKIN_LOD.max }) : -Infinity);
    let tris = 0, full = 0;
    for (const e of this.entries) {
      // someone else changed the mesh (a new build or costume): that is the full one now
      if (e.mesh.geometry !== e.cur) { e.full = e.cur = e.mesh.geometry; }
      let g = e.full;
      if (j !== -Infinity) {
        // the coarsest ready level at or under j
        for (let i = j; i >= SKIN_LOD.min; i--) {
          const l = level(e.full, i, this.sync);
          if (l) { g = l; break; }
          if (l === null) break;
        }
      }
      if (g !== e.mesh.geometry) e.mesh.geometry = e.cur = g;
      tris += triCount(g); full += triCount(e.full);
    }
    this.showFace(!(j >= SKIN_LOD.hideFace));
    this.stats.tris = tris; this.stats.full = full;
    return j;
  }
}

// ------------------------------------------------------------------ every body, once a frame
const BODIES = new Set();
export const skinnedLods = {
  add(lod) { BODIES.add(lod); return lod; },
  remove(lod) { BODIES.delete(lod); },
  /** Before rendering (main.js renderFrame): each shown body's level for this camera. */
  update(camera, pxPerRad, px) {
    const cam = camera.position;
    let tris = 0, full = 0, coarse = 0;
    for (const L of BODIES) {
      const root = L.h.char.root;
      if (!root.visible || !root.parent) continue;
      L.update(cam.distanceTo(root.position), root.scale.y, pxPerRad, px);
      tris += L.stats.tris; full += L.stats.full;
      if (L.j !== -Infinity) coarse++;
    }
    this.stats = { bodies: BODIES.size, coarse, tris, full };
  },
  stats: { bodies: 0, coarse: 0, tris: 0, full: 0 },
};
