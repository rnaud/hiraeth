import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { GenerateMeshBVHWorker } from 'three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

export class Physics {
  /**
   * @param scene  static level geometry is baked from here
   * @param base   optional heightfield with heightAt(x, z) (desert terrain),
   *               combined with the mesh collision in groundAt()
   */
  /** Build the BVH in a web worker (keeps the page responsive while loading). */
  static async create(scene, base = null) {
    const p = new Physics(scene, base, true);
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

  constructor(scene, base = null, deferBVH = false) {
    this.base = base;
    scene.updateMatrixWorld(true);
    const geos = [];
    scene.traverse((obj) => {
      if (!obj.isMesh || isExcluded(obj)) return;
      const src = obj.geometry;
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
    });
    this.geometry = geos.length ? mergeGeometries(geos) : new THREE.BufferGeometry();
    this.bvh = geos.length && !deferBVH ? new MeshBVH(this.geometry) : null;
    this.triangles = this.geometry.attributes.position ? this.geometry.attributes.position.count / 3 : 0;
  }

  /** Height of the first surface below (x, fromY, z), or -Infinity. */
  groundAt(x, fromY, z, maxDrop = 600) {
    const b = this.base ? this.base.heightAt(x, z) : -Infinity;
    if (!this.bvh) return b;
    // a tiny offset keeps the ray off shared vertices (e.g. the centre of a
    // cylinder cap), where it could slip between triangles
    _ray.origin.set(x + 1.37e-4, fromY, z + 2.91e-4);
    _ray.direction.set(0, -1, 0);
    const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, maxDrop);
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
    return { distance: hit.distance, point: hit.point.clone(), normal };
  }

  /**
   * Height of the feet above the ground along an arbitrary "up" (for levels
   * with changing gravity). Uses the heightfield too when up is +Y.
   */
  heightAbove(pos, up, step = 0.6) {
    if (up.y > 0.999) return pos.y - this.groundAt(pos.x, pos.y + step, pos.z);
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
