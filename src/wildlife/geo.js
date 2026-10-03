import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Tiny modelling kit for the wildlife: primitives with a flat printed colour
// per piece (vertex colours), merged into one geometry per moving part.
// Local axes: +z is the creature's nose, +y its back, +x its right side.

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();

function finish(g, color, at, rot, scale) {
  if (scale) g.scale(scale[0], scale[1], scale[2]);
  if (rot) g.applyMatrix4(_m.makeRotationFromEuler(_e.set(rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0)));
  if (at) g.translate(at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  _c.set(color);
  const n = out.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/** ellipsoid with radii r = [x, y, z] */
export const ell = (r, color, at, rot, seg = [10, 7]) => finish(new THREE.SphereGeometry(1, seg[0], seg[1]), color, at, rot, r);
/** half ellipsoid (dome, flat side down) */
export const dome = (r, color, at, rot, seg = [10, 4]) => finish(new THREE.SphereGeometry(1, seg[0], seg[1], 0, Math.PI * 2, 0, Math.PI / 2), color, at, rot, r);
export const box = (s, color, at, rot) => finish(new THREE.BoxGeometry(s[0], s[1], s[2]), color, at, rot);
/** cylinder along y: top radius, bottom radius, height */
export const cyl = (rt, rb, h, color, at, rot, seg = 7) => finish(new THREE.CylinderGeometry(rt, rb, h, seg, 1), color, at, rot);
export const cone = (r, h, color, at, rot, seg = 7) => finish(new THREE.ConeGeometry(r, h, seg, 1), color, at, rot);
/** torus in the xy plane (its hole looks along z) */
export const torus = (R, r, color, at, rot, seg = [5, 18]) => finish(new THREE.TorusGeometry(R, r, seg[0], seg[1]), color, at, rot);
/** octahedron with radii [x, y, z] (diamonds, kites, crystals, stars) */
export const oct = (r, color, at, rot) => finish(new THREE.OctahedronGeometry(1, 0), color, at, rot, r);
/** a tube through points */
export const tube = (pts, radius, color, segs = 12, radial = 5) =>
  finish(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), segs, radius, radial, false), color);

/** a thin leg from hip to foot (a tapered cylinder) */
export function leg(hip, foot, r, color) {
  const a = new THREE.Vector3(...hip), b = new THREE.Vector3(...foot);
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r * 0.75, r, len, 5, 1).translate(0, -len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q).translate(a.x, a.y, a.z);
  return finish(g, color);
}

/** pairs of mirrored pieces: fn(side) for side = -1, 1 */
export const both = (fn) => [fn(-1), fn(1)];

/** merge any nesting of pieces into one geometry */
export function merge(...pieces) {
  const g = mergeGeometries(pieces.flat(3));
  g.computeBoundingSphere();
  return g;
}
