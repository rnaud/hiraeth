import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { mulberry32 } from '../noise.js';

// ---------------------------------------------------------------------------
// The Lab's room kit: what a biome room (src/levels/lab-rooms.js) builds with.
// A room is authored in its own frame (the group sits at the room's centre,
// y = 0 on its ground), so a world's builders that take a scene and a terrain
// (desertMesa, edenaTree, ...) can be handed the room's group and ground.
//
//   kit.add(mat, geo, { solid })   static geometry, merged per material when the
//                                  room is finished (a few draw calls a room)
//   kit.mesh(geo, mat)             a mesh of its own (for what moves)
//   kit.light(x, y, z, r)          a local light (glowing crystals, eggs, lamps)
//   kit.mover(fn)                  fn(t) each frame while the room is shown
// ---------------------------------------------------------------------------

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

/** A geometry ready to merge: non-indexed, position + normal (+ colour), nothing else. */
export function mergeable(g, keepColor = true) {
  if (!g.attributes.normal) g.computeVertexNormals();   // (before un-indexing, so smooth shapes stay smooth)
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && !(keepColor && k === 'color')) n.deleteAttribute(k);
  return n;
}

/** Move a geometry: position, yaw, uniform or per-axis scale, then tilt. */
export function put(g, x, y, z, ry = 0, s = 1, rx = 0, rz = 0) {
  const sc = typeof s === 'number' ? _s.setScalar(s) : _s.set(s[0], s[1], s[2]);
  return g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), sc));
}

export class RoomKit {
  /**
   * @param o.group   the room's group (at the room's centre)
   * @param o.ground  the room's Terrain (local frame), or null for rooms that stand on their own meshes
   * @param o.centre  the room's centre in the world (for lights)
   * @param o.seed
   */
  constructor({ group, ground = null, centre, seed = 1 }) {
    this.group = group; this.ground = ground; this.centre = centre;
    this.rng = mulberry32(seed);
    this.buckets = new Map();
    this.mats = new Map();
    this.lights = [];
    this.movers = [];
    this.noShadow = [];
    this.avoid = [];   // [x, z, r] (local) where no plant grows
  }
  R(a, b) { return a + this.rng() * (b - a); }
  pick(a) { return a[Math.floor(this.rng() * a.length)]; }
  /** Ground height here (local), or 0 without a ground. */
  H(x, z) { return this.ground ? this.ground.heightAt(x, z) : 0; }
  /** Lowest ground round a circle (local): where a wide thing should stand. */
  base(x, z, r) { return this.ground ? this.ground.baseAt(x, z, r) : 0; }
  /** A material, shared by every use of the same options in this room. */
  mat(o) {
    const k = JSON.stringify(o, (key, v) => (typeof v === 'number' ? +v.toFixed(3) : v));
    if (!this.mats.has(k)) this.mats.set(k, makeMaterial(o));
    return this.mats.get(k);
  }
  /** Static geometry: merged with the rest of its material at finish(). solid: false walks through it. */
  add(mat, geo, { solid = true, shadow = true } = {}) {
    const g = mergeable(geo);
    const key = `${mat.uuid}|${solid ? 1 : 0}|${shadow ? 1 : 0}|${g.attributes.color ? 1 : 0}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { mat, solid, shadow, list: [] }));
    b.list.push(g);
    return g;
  }
  /** A mesh of its own in the room (local frame). */
  mesh(geo, mat, { solid = true, shadow = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (!solid) m.userData.noCollide = true;
    if (!shadow) this.noShadow.push(m);
    this.group.add(m);
    return m;
  }
  /** A local light, at a point of the room (local). */
  light(x, y, z, r) { this.lights.push(new THREE.Vector4(this.centre.x + x, this.centre.y + y, this.centre.z + z, r)); }
  mover(fn) { this.movers.push(fn); }
  /** Merge the buckets into the room's meshes. */
  finish() {
    for (const b of this.buckets.values()) {
      const m = new THREE.Mesh(mergeGeometries(b.list), b.mat);
      if (!b.solid) m.userData.noCollide = true;
      if (!b.shadow) this.noShadow.push(m);
      this.group.add(m);
    }
    this.buckets.clear();
  }
}
