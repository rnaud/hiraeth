import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The plant builder's kit (src/flora.js): small inked shapes in flat colours,
// each part painted one colour per vertex so a plant of several colours is one
// geometry (one InstancedMesh, one draw call per patch of ground). Plants are
// built standing on y = 0 at their nominal height in metres.

const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** A small seeded random source (so every plant of a species is built the same). */
export function seeded(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One colour over a part (or a colour per vertex: fn(x, y, z) -> hex): non-indexed, positions, normals and colours only. */
export function paint(g, hex) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  const P = out.attributes.position, n = P.count, a = new Float32Array(n * 3);
  if (typeof hex !== 'function') _c.set(hex);
  for (let i = 0; i < n; i += 3) {
    // a whole triangle takes one colour (its centre's), so bands stay crisp
    if (typeof hex === 'function') _c.set(hex((P.getX(i) + P.getX(i + 1) + P.getX(i + 2)) / 3, (P.getY(i) + P.getY(i + 1) + P.getY(i + 2)) / 3, (P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2)) / 3));
    for (let k = 0; k < 3 && i + k < n; k++) a.set([_c.r, _c.g, _c.b], (i + k) * 3);
  }
  out.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return out;
}

/** Move, turn (tilt x / z first, then yaw y) and scale a part. */
export function put(g, at = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  _e.set(rot[0], rot[1], rot[2], 'YXZ');
  _s.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  _m.compose(_v.set(...at), _q.setFromEuler(_e), _s);
  return g.applyMatrix4(_m);
}

/** Merge painted parts into one plant geometry. */
export function merge(parts) {
  const g = mergeGeometries(parts.flat());
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------ shapes (all painted)
export const cyl = (r0, r1, h, col, sides = 6, at = [0, 0, 0], rot) => put(paint(new THREE.CylinderGeometry(r1, r0, h, sides, 1).translate(0, h / 2, 0), col), at, rot);
export const cone = (r, h, col, sides = 6, at = [0, 0, 0], rot) => put(paint(new THREE.ConeGeometry(r, h, sides, 1).translate(0, h / 2, 0), col), at, rot);
// (small balls stay twenty-sided: a bead's roundness doesn't show at its size)
export const ball = (r, col, at = [0, 0, 0], detail = 0, scale = 1) => put(paint(new THREE.IcosahedronGeometry(r, r < 0.16 ? 0 : detail), col), at, [0, 0, 0], scale);
export const ell = (rx, ry, rz, col, at = [0, 0, 0], rot, w = 7, h = 4) => put(paint(new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz), col), at, rot);
/** A half ellipsoid sitting on y = 0 (a cushion, a mound). */
export const dome = (rx, ry, rz, col, at = [0, 0, 0], w = 9, h = 3) => put(paint(new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2).scale(rx, ry, rz), col), at);
/** A lathe from [[r, y], ...] (bottom to top). */
export const lathe = (profile, col, sides = 8, at = [0, 0, 0], rot) => put(paint(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), sides), col), at, rot);
/** A box standing on y = 0. */
export const box = (w, h, d, col, at = [0, 0, 0], rot) => put(paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), col), at, rot);
/** A flat disc of `sides` (or a toothed / starred one: k(angle) -> radius factor). */
export function disc(r, h, col, sides = 10, at = [0, 0, 0], rot, k = null) {
  const g = new THREE.CylinderGeometry(r, r, h, sides, 1).translate(0, h / 2, 0);
  if (k) {
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), d = Math.hypot(x, z);
      if (d < 1e-4) continue;
      const f = k(Math.atan2(z, x));
      P.setX(i, x * f); P.setZ(i, z * f);
    }
    g.computeVertexNormals();
  }
  return put(paint(g, col), at, rot);
}

/** A tube along points [[x, y, z], ...], tapering from r0 to r1. */
export function tube(pts, r0, r1, col, sides = 5, segs = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, segs, 1, sides, false);
  const P = g.attributes.position, ring = sides + 1, c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const r = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j < ring; j++) {
      const k = i * ring + j;
      P.setXYZ(k, c.x + (P.getX(k) - c.x) * r, c.y + (P.getY(k) - c.y) * r, c.z + (P.getZ(k) - c.z) * r);
    }
  }
  return paint(g, col);
}

/**
 * A leaf: a flattened ellipsoid from the origin along +z (len long, wid wide), its tip
 * drooping by droop × len, then pitched up by `up` and turned to `yaw`.
 */
export function leaf(len, wid, thick, col, { up = 0.5, yaw = 0, droop = 0.2, at = [0, 0, 0], w = 6, h = 3 } = {}) {
  const g = new THREE.SphereGeometry(1, w, h).scale(wid / 2, thick / 2, len / 2).translate(0, 0, len / 2);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const t = P.getZ(i) / len; P.setY(i, P.getY(i) - droop * len * t * t); }
  g.computeVertexNormals();
  return put(paint(g, col), at, [-up, yaw, 0]);
}

/** A flat pointed blade standing up (a four-sided cone squashed thin), leaning `lean` toward `yaw`. */
export const blade = (len, wid, col, { lean = 0, yaw = 0, at = [0, 0, 0], thin = 0.22 } = {}) =>
  put(paint(new THREE.ConeGeometry(wid / 2, len, 4, 1).translate(0, len / 2, 0).scale(1, 1, thin), col), at, [lean, yaw, 0]);

/** Ribs on a lathe: the radius swells and dips `ribs` times round. */
export function ribbed(profile, ribs, depth, col, sides = 24, at = [0, 0, 0]) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), sides);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), f = 1 + depth * Math.cos(ribs * Math.atan2(z, x));
    P.setX(i, x * f); P.setZ(i, z * f);
  }
  g.computeVertexNormals();
  return put(paint(g, col), at);
}

/** A point along a quadratic-ish arc from the base: out `reach` toward yaw, up `rise`, the tip falling back by `fall`. */
export function arc(reach, rise, yaw, fall = 0, n = 5, from = [0, 0, 0]) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, d = reach * t, y = rise * Math.sin(t * Math.PI / 2) - fall * t * t;
    pts.push([from[0] + Math.sin(yaw) * d, from[1] + y, from[2] + Math.cos(yaw) * d]);
  }
  return pts;
}
