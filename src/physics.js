import * as THREE from 'three';
import { MeshBVH, ExtendedTriangle } from 'three-mesh-bvh';
import { GenerateMeshBVHWorker } from 'three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { runSteps, runStepsAsync } from './load-steps.js';

// Collision against the real level geometry. Every static mesh in the scene
// (minus anything flagged userData.noCollide, e.g. moving vehicles, plants or
// the heightfield terrain, which has its own exact lookup) is baked into one
// world-space geometry with a BVH. Characters and vehicles then use:
//   - groundAt(): a downward ray, so you can stand on rocks, roofs, domes
//   - pushCapsule(): push a vertical capsule out of walls and ceilings
//   - rayDistance(): camera line of sight, so the camera never clips inside

const _ray = new THREE.Ray();
const _seg = new THREE.Line3();
const _box = new THREE.Box3();
const _tri = new THREE.Vector3();
const _cap = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _Y = new THREE.Vector3(0, 1, 0);

function isExcluded(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData.noCollide) return true;
  return false;
}

/**
 * Positions only, non-indexed, end to end: what mergeGeometries makes of the baked meshes, copied a
 * few meshes a step (anything else, say a position that isn't three floats, goes through it as before).
 */
function* concatPositions(geos) {
  if (!geos.every((g) => g.attributes.position?.itemSize === 3 && g.attributes.position.array instanceof Float32Array && !g.index && Object.keys(g.attributes).length === 1)) return mergeGeometries(geos);
  let n = 0;
  for (const g of geos) n += g.attributes.position.array.length;
  const out = new Float32Array(n);
  let o = 0, k = 0;
  for (const g of geos) {
    out.set(g.attributes.position.array, o);
    o += g.attributes.position.array.length;
    if ((++k & 31) === 0) yield;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  return geo;
}

export class Physics {
  /**
   * @param scene  static level geometry is baked from here
   * @param base   optional heightfield with heightAt(x, z) (desert terrain),
   *               combined with the mesh collision in groundAt()
   */
  /** Build the BVH in a web worker (keeps the page responsive while loading). */
  static async create(scene, base = null, slice = null) {
    // (baked a mesh a step when given a slicer, src/load-steps.js: the copy of every triangle in the
    // world into one buffer was a single long task; the BVH itself is built in a worker)
    const p = Object.create(Physics.prototype);
    if (slice) await runStepsAsync(p.bake(scene, base, true), slice); else runSteps(p.bake(scene, base, true));
    if (p.geometry.attributes.position) {
      try {
        const worker = new GenerateMeshBVHWorker();
        p.bvh = await worker.generate(p.geometry);
        worker.dispose();
      } catch (e) {
        // the worker took (transferred) the geometry's buffers with it, so
        // bake the scene again rather than building a BVH over nothing
        console.warn('BVH worker failed, building on the main thread', e);
        return new Physics(scene, base);
      }
    }
    return p;
  }

  constructor(scene, base = null, deferBVH = false) { runSteps(this.bake(scene, base, deferBVH)); }

  /** Every solid triangle of the scene in one world-space geometry (and its BVH unless deferred), a mesh a step. */
  *bake(scene, base = null, deferBVH = false) {
    this.base = base;
    scene.updateMatrixWorld(true);
    const geos = [], objs = [];
    scene.traverse((obj) => { if (obj.isMesh && !isExcluded(obj)) objs.push(obj); });
    for (const obj of objs) {
      yield;
      const src = obj.geometry.userData.lodSource ?? obj.geometry;   // a level of detail (lod.js) bakes as its full mesh
      const base = new THREE.BufferGeometry();
      base.setAttribute('position', src.attributes.position);
      if (src.index) base.setIndex(src.index);
      if (obj.isInstancedMesh) {
        for (let i = 0; i < obj.count; i++) {
          obj.getMatrixAt(i, _m);
          _m.premultiply(obj.matrixWorld);
          geos.push(base.index ? base.clone().applyMatrix4(_m).toNonIndexed() : base.clone().applyMatrix4(_m));
        }
      } else {
        geos.push(base.index ? base.clone().applyMatrix4(obj.matrixWorld).toNonIndexed() : base.clone().applyMatrix4(obj.matrixWorld));
      }
    }
    this.geometry = geos.length ? yield* concatPositions(geos) : new THREE.BufferGeometry();
    this.bvh = geos.length && !deferBVH ? new MeshBVH(this.geometry) : null;
    this.triangles = this.geometry.attributes.position ? this.geometry.attributes.position.count / 3 : 0;
  }

  /**
   * Static collision added after loading (the ship and its interior): the
   * meshes under `object` (minus noCollide) get their own BVH, and every query
   * below sees them together with the level. Returns a handle for removeCollider.
   */
  addCollider(object) {
    object.updateMatrixWorld(true);
    const geos = [];
    object.traverse((obj) => {
      if (!obj.isMesh || isExcluded(obj)) return;
      const src = obj.geometry.userData.lodSource ?? obj.geometry;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position);
      if (src.index) g.setIndex(src.index);
      const w = g.clone().applyMatrix4(obj.matrixWorld);   // (clone: the attributes belong to the visible mesh)
      geos.push(w.index ? w.toNonIndexed() : w);
    });
    if (!geos.length) return null;
    const geometry = mergeGeometries(geos);
    geometry.computeBoundingBox();
    const extra = { bvh: new MeshBVH(geometry), box: geometry.boundingBox.clone().expandByScalar(0.5), triangles: geometry.attributes.position.count / 3 };
    this.composite();
    this.extras.push(extra);
    return extra;
  }

  /** From here on the level's BVH sits behind compositeBVH, with the colliders added later. */
  composite() {
    if (this.extras) return;
    this.extras = [];
    this.levelBVH = this.bvh;
    this.bvh = compositeBVH(this);
  }

  /**
   * A collider that moves as a whole (the Buried Machine's great wheel, which turns for ever): the meshes
   * under `object` (minus noCollide below it) as drawn, in the object's own frame, with their own BVH.
   * Every query sees them where the object stood at the last syncMovers(): a ray or a capsule is met by
   * the turned shape, not a still stand-in, and moverVelocity() says how fast its surface moves at a point
   * (src/carriers.js: what you stand or climb on carries you). Returns a handle for removeCollider.
   * Cost: nothing to a query that does not come near it (one box test, as any added collider).
   * o.all: every mesh under it, noCollide or not (a moving piece flagged noCollide to keep it out of the bake).
   */
  addMover(object, { all = false } = {}) {
    object.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
    const geos = [];
    object.traverse((obj) => {
      if (!obj.isMesh) return;
      if (!all) for (let o = obj; o && o !== object; o = o.parent) if (o.userData.noCollide) return;
      const src = obj.geometry.userData.lodSource ?? obj.geometry;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position);
      if (src.index) g.setIndex(src.index);
      const w = g.clone().applyMatrix4(_m.multiplyMatrices(inv, obj.matrixWorld));
      geos.push(w.index ? w.toNonIndexed() : w);
    });
    if (!geos.length) return null;
    const geometry = mergeGeometries(geos);
    geometry.computeBoundingBox();
    const e = {
      moving: true, object, bvh: new MeshBVH(geometry), local: geometry.boundingBox.clone(), box: new THREE.Box3(),
      matrix: new THREE.Matrix4(), inverse: new THREE.Matrix4(), step: new THREE.Matrix4(), dt: 0,
      triangles: geometry.attributes.position.count / 3,
    };
    syncMover(e, 0, true);
    this.composite();
    this.extras.push(e);
    return e;
  }

  /** The moving colliders to where their objects are now (once a frame, before anyone moves: main.js). */
  syncMovers(dt) {
    for (const e of this.extras ?? []) if (e.moving) syncMover(e, dt);
  }

  removeCollider(handle) {
    const i = this.extras?.indexOf(handle) ?? -1;
    if (i >= 0) this.extras.splice(i, 1);
  }

  /** Height of the first surface below (x, fromY, z), or -Infinity. */
  groundAt(x, fromY, z, maxDrop = 600) {
    const b = this.base ? this.base.heightAt(x, z) : -Infinity;
    this.groundMover = null;
    if (!this.bvh) return b;
    // a tiny offset keeps the ray off shared vertices (e.g. the centre of a
    // cylinder cap), where it could slip between triangles
    _ray.origin.set(x + 1.37e-4, fromY, z + 2.91e-4);
    _ray.direction.set(0, -1, 0);
    const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, maxDrop);
    // (what the ground is, when it is a moving collider: src/carriers.js groundCarrier)
    this.groundMover = hit?.mover && hit.point.y >= b ? hit.mover : null;
    return hit ? Math.max(hit.point.y, b) : b;
  }

  /**
   * First hit along a ray: { distance, point, normal } with the normal facing
   * back toward the ray origin, or null.
   */
  rayHit(origin, dir, far) {
    if (!this.bvh) return null;
    _ray.origin.copy(origin);
    _ray.direction.copy(dir);
    const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
    if (!hit) return null;
    const normal = hit.face.normal.clone();
    if (normal.dot(dir) > 0) normal.negate();
    return { distance: hit.distance, point: hit.point.clone(), normal, mover: hit.mover ?? null };
  }

  /**
   * Height of the feet above the ground along an arbitrary "up" (for levels
   * with changing gravity). Uses the heightfield too when up is +Y.
   */
  heightAbove(pos, up, step = 0.6) {
    if (up.y > 0.999) return pos.y - this.groundAt(pos.x, pos.y + step, pos.z);
    this.groundMover = null;
    _cap.copy(pos).addScaledVector(up, step);
    _dir.copy(up).negate();
    return this.rayDistance(_cap, _dir, 600) - step;
  }

  /** Surface normal of the ground at (x, z) below fromY (meshes or the heightfield). */
  groundNormal(x, fromY, z, out = new THREE.Vector3()) {
    const b = this.base ? this.base.heightAt(x, z) : -Infinity;
    if (this.bvh) {
      _ray.origin.set(x + 1.37e-4, fromY, z + 2.91e-4);
      _ray.direction.set(0, -1, 0);
      const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, 600);
      if (hit && hit.point.y >= b) { out.copy(hit.face.normal).transformDirection(_m.identity()); if (out.y < 0) out.negate(); return out; }
    }
    if (!this.base) return out.set(0, 1, 0);
    const e = 0.35, H = (a, c) => this.base.heightAt(a, c);
    return out.set(H(x - e, z) - H(x + e, z), 2 * e, H(x, z - e) - H(x, z + e)).normalize();
  }

  /** Distance along a ray to the first hit (or Infinity). */
  rayDistance(origin, dir, far) {
    if (!this.bvh) return Infinity;
    _ray.origin.copy(origin);
    _ray.direction.copy(dir);
    const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
    return hit ? hit.distance : Infinity;
  }

  /**
   * Push a capsule (from pos + up * bottom to pos + up * top, radius r) out of
   * the geometry. Modifies pos; returns the push vector (or null).
   */
  pushCapsule(pos, r, bottom, top, out = new THREE.Vector3(), up = _Y) {
    if (!this.bvh) return null;
    _seg.start.copy(pos).addScaledVector(up, bottom + r);
    _seg.end.copy(pos).addScaledVector(up, top - r);
    const sx = _seg.start.x, sy = _seg.start.y, sz = _seg.start.z;
    _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end);
    _box.min.addScalar(-r);
    _box.max.addScalar(r);
    this.bvh.shapecast({
      bounds: _box,   // (the query's box: an added collider nowhere near it is skipped, compositeBVH)
      intersectsBounds: (box) => box.intersectsBox(_box),
      intersectsTriangle: (tri) => {
        const d = tri.closestPointToSegment(_seg, _tri, _cap);
        if (d < r) {
          _dir.subVectors(_cap, _tri).normalize().multiplyScalar(r - d);
          _seg.start.add(_dir);
          _seg.end.add(_dir);
        }
      },
    });
    out.set(_seg.start.x - sx, _seg.start.y - sy, _seg.start.z - sz);
    if (out.lengthSq() < 1e-10) return null;
    pos.add(out);
    return out;
  }

  /** Swept pushCapsule from `from` to `pos` (see sweepCapsule below). */
  sweepCapsule(pos, from, r, bottom, top, out = new THREE.Vector3(), up = _Y) {
    return sweepCapsule(this, pos, from, r, bottom, top, out, up);
  }

  /**
   * Is this point inside closed solid geometry (a building, a rock)? Rays in
   * the six axis directions must all leave through the back of a face; any
   * ray that escapes to open space, or first meets a front face (the outside
   * of something, or a room seen from within), means it's free.
   */
  embedded(p, far = 400) {
    if (!this.bvh) return false;
    for (const d of AXES) {
      _ray.origin.copy(p);
      _ray.direction.copy(d);
      const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
      if (!hit) return false;
      if (hit.face.normal.dot(d) > 0) continue;
      // a front face first: but a building's floor often lies flush on the
      // street (or a setback on its roof), and either of two coplanar faces
      // may come first, so look for a back face at the same distance
      const near = this.bvh.raycast(_ray, THREE.DoubleSide, 0, hit.distance + 0.02);
      if (!near.some((h) => h.face.normal.dot(d) > 0)) return false;
    }
    return true;
  }

  /**
   * embedded(), and sure of it: also an odd number of surfaces crossed on the
   * way out, up and sideways. (A mesh with its faces turned inside out, or an
   * overhang above an open slope, can look like solid to embedded() alone:
   * the faces' sides lie, the count does not.) For deciding to remove things.
   */
  buried(p, far = 1000) {
    if (!this.embedded(p)) return false;
    // above the terrain, over a solid whose floor is under it: a landmark half sunk in the dunes,
    // whose inside is out in the open air here (the terrain is not in the BVH)
    if (this.base && p.y > this.base.heightAt(p.x, p.z) && p.y - this.rayDistance(p, AXES[5], far) < this.base.heightAt(p.x, p.z)) return false;
    for (const d of [AXES[0], AXES[1]]) {
      _ray.origin.copy(p);
      _ray.direction.copy(d);
      const hits = this.bvh.raycast(_ray, THREE.DoubleSide, 0, far).map((h) => h.distance).sort((a, b) => a - b);
      let n = 0, last = -1;
      for (const t of hits) { if (t - last > 1e-3) n++; last = t; }   // (coplanar twins and shared edges count once)
      if (n % 2 === 0) return false;
    }
    return true;
  }

  /**
   * The nearest free spot outside the solid that `centre` is buried in:
   * walks out along the horizontal directions (and up, onto the top) to where
   * a capsule of radius r (half-height `half`) fits. Returns the new centre,
   * or null when nothing is found within `maxMove`.
   */
  escape(centre, r, up = _Y, half = r, maxMove = 60) {
    if (!this.bvh) return null;
    const side = _esA.set(1, 0, 0);
    if (Math.abs(side.dot(up)) > 0.9) side.set(0, 0, 1);
    side.addScaledVector(up, -side.dot(up)).normalize();
    const other = _esB.crossVectors(up, side);
    let best = null, bestD = maxMove;
    const dirs = [up];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      dirs.push(new THREE.Vector3().copy(side).multiplyScalar(Math.cos(a)).addScaledVector(other, Math.sin(a)));
    }
    for (const d of dirs) {
      const clear = d === up ? half : r;
      let s = 0;
      for (let hop = 0; hop < 8 && s < bestD; hop++) {
        _ray.origin.copy(centre).addScaledVector(d, s);
        _ray.direction.copy(d);
        const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, bestD - s);
        if (!hit) break;
        s += hit.distance + 0.02;
        if (hit.face.normal.dot(d) <= 0) continue;          // entering something else on the way out
        const move = s + clear + 0.08;
        if (move >= bestD) break;
        const c = _esC.copy(centre).addScaledVector(d, move);
        if (this.embedded(c)) continue;
        const probe = _esD.copy(c);
        const push = this.pushCapsule(probe, r, -half, half, _esE, up);
        if (push && push.length() > r * 0.5) continue;
        best = (best ?? new THREE.Vector3()).copy(probe);
        bestD = move;
        break;
      }
    }
    return best;
  }
}

/** A moving collider to where its object stands now; `step` is what moved it since the last sync. */
function syncMover(e, dt, first = false) {
  e.object.updateWorldMatrix(true, false);
  if (first) e.step.identity();
  else e.step.multiplyMatrices(e.object.matrixWorld, e.inverse);   // (now · before⁻¹)
  e.matrix.copy(e.object.matrixWorld);
  e.inverse.copy(e.matrix).invert();
  e.box.copy(e.local).applyMatrix4(e.matrix).expandByScalar(0.5);
  e.dt = dt;
}

/** How fast a moving collider's surface moves at world point p (m/s, into out): zero when it stood still. */
export function moverVelocity(e, p, out = new THREE.Vector3()) {
  if (!e?.dt) return out.set(0, 0, 0);
  return out.copy(p).applyMatrix4(e.step).sub(p).divideScalar(e.dt);
}

/** The level's BVH plus the colliders added later, behind the same three calls. */
const _cr = new THREE.Vector3(), _lr = new THREE.Ray(), _wb = new THREE.Box3(), _wt = new ExtendedTriangle();
/** A hit in a moving collider's frame, back in the world's (rigid: the distance stands). */
function worldHit(h, e) {
  h.point.applyMatrix4(e.matrix);
  h.face?.normal.transformDirection(e.matrix);
  h.mover = e;
  return h;
}
function compositeBVH(physics) {
  const reach = (box, ray, far) => {
    if (box.containsPoint(ray.origin)) return true;
    const p = ray.intersectBox(box, _cr);
    return !!p && p.distanceTo(ray.origin) <= far;
  };
  const cast = (e, ray, side, near, far) => {
    if (!e.moving) return e.bvh.raycastFirst(ray, side, near, far);
    const h = e.bvh.raycastFirst(_lr.copy(ray).applyMatrix4(e.inverse), side, near, far);
    return h ? worldHit(h, e) : null;
  };
  return {
    raycastFirst(ray, side, near, far) {
      let best = physics.levelBVH ? physics.levelBVH.raycastFirst(ray, side, near, far) : null;
      for (const e of physics.extras) {
        if (!reach(e.box, ray, best ? best.distance : far)) continue;
        const h = cast(e, ray, side, near, best ? best.distance : far);
        if (h && (!best || h.distance < best.distance)) best = h;
      }
      return best;
    },
    raycast(ray, side, near, far) {
      const out = physics.levelBVH ? physics.levelBVH.raycast(ray, side, near, far) : [];
      for (const e of physics.extras) {
        if (!reach(e.box, ray, far)) continue;
        if (e.moving) out.push(...e.bvh.raycast(_lr.copy(ray).applyMatrix4(e.inverse), side, near, far).map((h) => worldHit(h, e)));
        else out.push(...e.bvh.raycast(ray, side, near, far));
      }
      return out;
    },
    shapecast(cb) {
      physics.levelBVH?.shapecast(cb);
      for (const e of physics.extras) {
        if (cb.bounds && !e.box.intersectsBox(cb.bounds)) continue;   // (a query that says where it looks)
        if (!e.moving) { e.bvh.shapecast(cb); continue; }
        // (its boxes and triangles handed over in the world's frame: a box turned is boxed again, so the
        // query's own test stays conservative; one box test for a query that is nowhere near it)
        const M = e.matrix;
        e.bvh.shapecast({
          intersectsBounds: (box, ...rest) => cb.intersectsBounds(_wb.copy(box).applyMatrix4(M), ...rest),
          intersectsTriangle: (t, ...rest) => {
            _wt.a.copy(t.a).applyMatrix4(M); _wt.b.copy(t.b).applyMatrix4(M); _wt.c.copy(t.c).applyMatrix4(M);
            _wt.needsUpdate = true;
            return cb.intersectsTriangle(_wt, ...rest);
          },
        });
      }
    },
  };
}

// up first: in the open it escapes to the sky, so most checks cost one ray
const AXES = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)];
const _esA = new THREE.Vector3(), _esB = new THREE.Vector3(), _esC = new THREE.Vector3(), _esD = new THREE.Vector3(), _esE = new THREE.Vector3();
const _swD = new THREE.Vector3(), _swP = new THREE.Vector3(), _swN = new THREE.Vector3();

/**
 * Swept capsule collision: moves `pos` from `from` to where it is now in
 * sub-steps no longer than half the radius, pushing it out of the geometry
 * at each, and sliding the rest of the motion along any wall it meets. A
 * single push at the end of a long step can't tell which side of a wall the
 * capsule came from (it pops out on the far side, or deeper inside a solid);
 * a half-radius step never crosses a surface. Works with any physics that
 * has pushCapsule (also test doubles). Returns the total push, or null.
 */
export function sweepCapsule(physics, pos, from, r, bottom, top, out = new THREE.Vector3(), up = _Y) {
  const delta = _swD.subVectors(pos, from);
  const len = delta.length();
  const steps = Math.min(Math.ceil(len / (r * 0.5)), 48) || 1;
  delta.divideScalar(steps);
  pos.copy(from);
  out.set(0, 0, 0);
  let hit = false;
  for (let i = 0; i < steps; i++) {
    pos.add(delta);
    const push = physics.pushCapsule(pos, r, bottom, top, _swP, up);
    if (!push) continue;
    hit = true;
    if (!push.isVector3) continue;
    out.add(push);
    const n = _swN.copy(push).normalize(), into = delta.dot(n);
    if (into < 0) delta.addScaledVector(n, -into);
  }
  return hit ? out : null;
}

const _ub = new THREE.Vector3();
/**
 * A vehicle (pos, vel, speed, physics) that ended up inside something solid:
 * back to `from`, where it last was free, or out through the nearest face.
 */
export function unbury(v, from, r) {
  const P = v.physics;
  if (!P.embedded(_ub.copy(from).setY(from.y + 0.3))) v.pos.copy(from);
  else v.pos.copy(P.escape(_ub, r, _Y, r) ?? from);
  v.vel.set(0, 0, 0);
  v.speed = 0;
}

const _dbM = new THREE.Matrix4(), _dbW = new THREE.Matrix4(), _dbX = new THREE.Vector3(), _dbB = new THREE.Box3();
const SIDES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];

/** Is the solid around p only `box`'s own collider (an invisible trunk inside a drawn tree)? */
function ownCollider(physics, p, box) {
  for (const d of SIDES) {
    const h = physics.rayHit(p, d, 80);
    if (!h || !box.containsPoint(h.point)) return false;
  }
  return true;
}

/**
 * Instances of a walk-through mesh (trees in a town, shrubs in a garden)
 * that stand inside something solid, a tree planted in a house, are dropped
 * (scaled to nothing). Each is tested at `heights` (in the geometry's own y,
 * on its axis): dropped when any of them (or, with all: true, every one) is
 * inside a solid that is not just its own collider. Returns how many.
 */
export function dropBuriedInstances(mesh, physics, heights, o = {}) { return runSteps(dropBuriedInstancesSteps(mesh, physics, heights, o)); }
/** dropBuriedInstances a few instances a step (each is a dozen rays through the collision): for a world's load. */
export function* dropBuriedInstancesSteps(mesh, physics, heights, { all = false, ring = 0 } = {}) {
  let n = 0;
  mesh.updateMatrixWorld();
  const gb = geoBox(mesh.geometry);
  const cx = (gb.min.x + gb.max.x) / 2, cz = (gb.min.z + gb.max.z) / 2;
  for (let i = 0; i < mesh.count; i++) {
    if ((i & 7) === 7) yield;
    mesh.getMatrixAt(i, _dbM);
    _dbW.multiplyMatrices(mesh.matrixWorld, _dbM);
    if (Math.abs(_dbW.determinant()) < 1e-9) continue;   // (already gone)
    _dbB.copy(gb).applyMatrix4(_dbW).expandByScalar(0.15);
    const at = (x, h, z) => { _dbX.set(x, h, z).applyMatrix4(_dbW); return (physics.buried ?? physics.embedded).call(physics, _dbX) && !ownCollider(physics, _dbX, _dbB); };
    // (on its axis; with a ring, also round it: a crown pushed through a wall beside its trunk)
    const inside = (h) => at(cx, h, cz) || (ring > 0 && (at(cx + ring, h, cz) || at(cx - ring, h, cz) || at(cx, h, cz + ring) || at(cx, h, cz - ring)));
    // (or wholly under the terrain, which is not in the BVH: a rock under a mesa)
    const top = _dbB.max.y - 0.15, H = (x, z) => physics.base.heightAt(x, z) - 0.6 > top;   // (the drawn terrain is a coarser mesh than heightAt: a margin)
    const under = !!physics.base && H((_dbB.min.x + _dbB.max.x) / 2, (_dbB.min.z + _dbB.max.z) / 2) && H(_dbB.min.x, _dbB.min.z) && H(_dbB.max.x, _dbB.min.z) && H(_dbB.min.x, _dbB.max.z) && H(_dbB.max.x, _dbB.max.z);
    // (a leaning blade or a tumbled rock: only when buried root, middle and tip, along its own axis)
    const e = _dbW.elements, upright = e[5] / Math.hypot(e[4], e[5], e[6]) > 0.95;
    if (!under && !((upright || (all && heights.length > 2)) && heights.length && (all ? heights.every(inside) : heights.some(inside)))) continue;
    _dbM.elements[0] = _dbM.elements[1] = _dbM.elements[2] = _dbM.elements[4] = _dbM.elements[5] = _dbM.elements[6] = _dbM.elements[8] = _dbM.elements[9] = _dbM.elements[10] = 0;   // (scaled to nothing where it stood)
    mesh.setMatrixAt(i, _dbM);
    n++;
  }
  if (n) mesh.instanceMatrix.needsUpdate = true;
  return n;
}

/**
 * Walk-through instanced things (trees, shrubs, tufts: noCollide, static)
 * buried in a solid are dropped: a clump of trees that landed on a house
 * (the tall ones by their trunk and middle), a tuft inside a pyramid (the
 * short ones only when wholly inside: a rock half sunk in a slope stays).
 * Returns how many.
 */
export function dropBuriedFlora(scene, physics, o = {}) { return runSteps(dropBuriedFloraSteps(scene, physics, o)); }
/** dropBuriedFlora a few instances a step (src/load-steps.js). */
export function* dropBuriedFloraSteps(scene, physics, { minHeight = 2, maxCount = 6000 } = {}) {
  let n = 0;
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isInstancedMesh || o.userData.dynamic || o.userData.keepBuried || o.instanceMatrix.usage === THREE.DynamicDrawUsage || !isExcluded(o)) return;
    const gb = geoBox(o.geometry);
    if (o.count <= maxCount && gb.max.y - gb.min.y > 0.05) meshes.push(o);
  });
  for (const o of meshes) {
    const b = geoBox(o.geometry), h = b.max.y - b.min.y;
    // (a tree by its trunk and middle; a tuft, a blade or a stone only when buried root to tip)
    const fr = h >= minHeight ? [0.3, 0.55] : [0.35, 0.65, 0.95];
    n += yield* dropBuriedInstancesSteps(o, physics, fr.map((f) => b.min.y + h * f), { all: true });
  }
  return n;
}

const _geoBoxes = new WeakMap();
/** A geometry's own box, from its vertices (a stored boundingBox may have been widened, e.g. for swaying grass). */
export function geoBox(geo) {
  let b = _geoBoxes.get(geo);
  if (!b) { b = new THREE.Box3().setFromBufferAttribute(geo.attributes.position); _geoBoxes.set(geo, b); }
  return b;
}
