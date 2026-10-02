import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
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
  constructor(scene, base = null) {
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
    this.bvh = geos.length ? new MeshBVH(this.geometry) : null;
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
}
