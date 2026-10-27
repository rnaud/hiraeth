// Nothing through the ship where it stands (issue #706, the author: "we had a plant go through the stairs of the ship, we
// should make sure there is nothing clipping through the ship and stairs on every level we land on").
//
// Three volumes round the parked ship (docs/systems/ship.md, "Clear ground"):
//   the hull     its plan (HALF_W either side of its centre line, NOSE_Z to STERN_Z) from the belly to the roof;
//   the ramp     from the hinge down to its foot, RAMP_HALF either side, from its treads up a head's height;
//   the walk off WALK m on from the foot along the ramp's way, WALK_HALF either side, at the height of a shin and up.
//
// clearLanding(): the walk-through scenery scattered by the instance (shrubs, agaves, tufts, flowers: noCollide, static)
// that reaches into one of them is left out where the ship stands, as the levels clear their own paths
// (src/temples/attachment.js clearInstances). Ship calls it once it is placed, before the world is tiled.
// landingIntruders(): everything else drawn there, vertex by vertex, against the ship's own surfaces (a point is in the
// hull when the ship is both over and under it): what a level must move itself. tests/landing-clear.test.js runs it on
// every world the ship lands in.
import * as THREE from 'three';
import { BELLY as HULL_BELLY } from './hull.js';

export const RAMP_HALF = 1.8, WALK = 6, WALK_HALF = 1.6, SHIN = 0.6, HEAD = 2.2;

/** The volumes of a placed ship (Ship: parked, layout, hinge, rampFoot, outDir), with tests for a world point. */
export function landingZones(ship) {
  const L = ship.layout, g = ship.parked.group, BELLY = L.BELLY ?? HULL_BELLY;   // (the original hull's layout names no belly)
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert();
  const H = ship.hinge, F = ship.rampFoot, out = ship.outDir.clone().setY(0).normalize(), side = new THREE.Vector3(out.z, 0, -out.x);
  const run = Math.hypot(F.x - H.x, F.z - H.z);
  const lp = new THREE.Vector3();
  /** Along the ramp's way from the hinge (m), and how far off its middle line, of world (x, z). */
  const along = (x, z) => { const dx = x - H.x, dz = z - H.z; return [dx * out.x + dz * out.z, Math.abs(dx * side.x + dz * side.z)]; };
  /** The ramp's tread height at `a` m from the hinge (the foot's beyond it). */
  const treadAt = (a) => H.y + (F.y - H.y) * Math.min(1, Math.max(0, a / run));
  return {
    run, inv, out, side,
    /** World p in the ship's frame. */
    local: (p) => lp.copy(p).applyMatrix4(inv),
    /** A sphere (world centre c, radius r) reaching into the hull's box: its plan, from the belly to the roof. */
    hullSphere(c, r) {
      const q = lp.copy(c).applyMatrix4(inv);
      return Math.abs(q.x) < L.HALF_W + r && q.z > L.NOSE_Z - r && q.z < L.STERN_Z + r && q.y + r > BELLY && q.y - r < L.ROOF;
    },
    /** A sphere reaching over the ramp's treads, or up into the walk off its foot. */
    rampSphere(c, r) {
      const [a, s] = along(c.x, c.z);
      if (a > -r && a < run && s < RAMP_HALF + r) return c.y + r > treadAt(a) + 0.02 && c.y - r < treadAt(a) + HEAD;
      if (a >= run && a < run + WALK + r && s < WALK_HALF + r) return c.y + r > F.y + SHIN && c.y - r < F.y + HEAD;
      return false;
    },
    /** Which volume a world point is in by the boxes alone: 'hull' (its box: the caller checks the surfaces), 'ramp', 'walk' or null. */
    boxOf(p, groundAt = null) {
      const q = lp.copy(p).applyMatrix4(inv);
      if (Math.abs(q.x) <= L.HALF_W && q.z >= L.NOSE_Z && q.z <= L.STERN_Z && q.y > BELLY && q.y < L.ROOF + 0.5) return 'hull';
      const [a, s] = along(p.x, p.z);
      if (a > 0 && a < run && s < RAMP_HALF) return p.y > treadAt(a) + 0.04 && p.y < treadAt(a) + HEAD ? 'ramp' : null;
      if (a >= run && a < run + WALK && s < WALK_HALF) {
        const g = groundAt?.(p.x, p.z);
        const y0 = Number.isFinite(g) ? g : F.y;
        return p.y > y0 + SHIN && p.y < y0 + HEAD ? 'walk' : null;
      }
      return null;
    },
  };
}

const offCollision = (o) => { for (let p = o; p; p = p.parent) if (p.userData.noCollide) return true; return false; };
const within = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
const zeroed = (e) => e[0] === 0 && e[1] === 0 && e[2] === 0 && e[5] === 0;

/**
 * Leave out every walk-through instance (noCollide, static, not the ship's own) reaching into the hull, over the ramp or
 * into the walk off it: scaled to nothing where it stood, as clearInstances does. Returns how many.
 */
export function clearLanding(scene, ship) {
  const Z = landingZones(ship), root = ship.parked.group;
  const m = new THREE.Matrix4(), w = new THREE.Matrix4(), s = new THREE.Sphere();
  let n = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isInstancedMesh || o.userData.dynamic || o.instanceMatrix.usage === THREE.DynamicDrawUsage || within(o, root) || !offCollision(o)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const gs = o.geometry.boundingSphere;
    if (!gs || !Number.isFinite(gs.radius)) return;
    let changed = false;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      if (zeroed(m.elements)) continue;
      s.copy(gs).applyMatrix4(w.multiplyMatrices(o.matrixWorld, m));
      if (s.radius > 12 || !(Z.hullSphere(s.center, s.radius * 0.8) || Z.rampSphere(s.center, s.radius * 0.8))) continue;
      const e = m.elements;
      e[0] = e[1] = e[2] = e[4] = e[5] = e[6] = e[8] = e[9] = e[10] = 0;
      o.setMatrixAt(i, m);
      changed = true; n++;
    }
    if (changed) o.instanceMatrix.needsUpdate = true;
  });
  return n;
}

/**
 * Whatever is drawn in the ship's volumes (a test's and a developer's tool, not run in the game): [{ name, where, n, at,
 * solid, instance }] by mesh (and instance), checked vertex by vertex; a point in the hull's box counts only when the
 * ship's own surfaces are both over and under it (the rounded caravan doesn't fill its box). `skip`: meshes to leave
 * out (the ground's own).
 */
export async function landingIntruders(scene, ship, { groundAt = null, skip = [] } = {}) {
  const { MeshBVH } = await import('three-mesh-bvh');
  const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
  const Z = landingZones(ship), root = ship.parked.group, ramp = ship.parked.ramp;
  // the ship's own surfaces (not its ramp) in one BVH, in the world
  const geos = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || (ramp && within(o, ramp))) return;
    let q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(q.attributes)) if (k !== 'position') q.deleteAttribute(k);
    q.morphAttributes = {};
    if (o.isInstancedMesh) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); geos.push(q.clone().applyMatrix4(m.premultiply(o.matrixWorld))); }
      return;
    }
    geos.push(q.applyMatrix4(o.matrixWorld));
  });
  const bvh = new MeshBVH(mergeGeometries(geos));
  const ray = new THREE.Ray(), UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
  const shipBoth = (p) => [UP, DOWN].every((d) => { ray.origin.copy(p); ray.direction.copy(d); return !!bvh.raycastFirst(ray, THREE.DoubleSide); });
  const where = (p) => { const k = Z.boxOf(p, groundAt); return k === 'hull' ? (shipBoth(p) ? 'hull' : null) : k; };
  const leave = new Set(skip.filter(Boolean));
  const centre = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld);
  const reach = Math.hypot(ship.layout.STERN_Z - ship.layout.NOSE_Z, 2 * ship.layout.HALF_W) / 2 + Z.run + WALK + 4;
  const found = [], s = new THREE.Sphere(), m = new THREE.Matrix4(), wm = new THREE.Matrix4(), v = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible || within(o, root) || leave.has(o) || o.isSkinnedMesh || !o.geometry?.attributes?.position || o.userData.sea) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const gs = o.geometry.boundingSphere, pos = o.geometry.attributes.position;
    if (!gs || !Number.isFinite(gs.radius)) return;
    const look = (mat, instance) => {
      s.copy(gs).applyMatrix4(mat);
      if (s.radius > 600 || s.center.distanceTo(centre) > reach + s.radius) return;
      let n = 0, kind = null, at = null;
      for (let i = 0; i < pos.count; i++) {
        const k = where(v.fromBufferAttribute(pos, i).applyMatrix4(mat));
        if (k) { n++; kind ??= k; at ??= v.clone(); }
      }
      if (n) found.push({ name: o.name || o.parent?.name || '(unnamed)', where: kind, n, at, solid: !offCollision(o), instance });
    };
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); if (!zeroed(m.elements)) look(wm.multiplyMatrices(o.matrixWorld, m), i); }
    } else look(o.matrixWorld, null);
  });
  return found;
}
