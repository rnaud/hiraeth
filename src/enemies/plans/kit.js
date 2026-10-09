import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeMaterial, releaseMaterial } from '../../materials.js';
import { surfaceFor } from '../surfaces.js';

// Shared pieces for the archetypes' body builders (src/enemies/plans/): the game's ink materials per skin, meshes
// placed in one call, tubes along points, and the finishing pass every model gets. A body is drawn in the Moebius
// ink look: makeMaterial's G-buffer surfaces, so the post pass inks their contours (docs/systems/rendering.md).

let serial = 0;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const pair = (fn) => [-1, 1].map(fn);
export const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp, smooth = THREE.MathUtils.smoothstep;
/** A frame-rate free ease toward a target (rate per second). */
export const ease = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));

/**
 * The materials of one foe's body: shared ones by skin (`mat(name, color, o)`: one per archetype, skin and name),
 * and its own ones that it recolours as it fights (`own(name, color, o)`: an eye, a glowing bell), released with it.
 * Given the skin itself (skinOf), each part wears its painted surface by its name (src/enemies/surfaces.js).
 */
export function materials(archetype, skin) {
  const owned = [], id = typeof skin === 'string' ? skin : skin?.id;
  // the part's painted surface (src/enemies/surfaces.js, drawn by src/foe-surface.js): patterns, colour zones, glow, gloss
  const paint = (name, o) => {
    if (o.foeSurface !== undefined || typeof skin !== 'object') return o;
    const s = surfaceFor(archetype, skin, name);
    if (!s) return o;
    const { mat: extra, ...fs } = s;
    return { ...o, ...extra, ...(Object.keys(fs).length ? { foeSurface: fs } : {}) };
  };
  const mat = (name, color, o = {}) => makeMaterial({ color, flat: o.flat ?? false, hatch: 0.45, patches: 0, ...paint(name, o), key: `arch.${archetype}.${id}.${name}` });
  const own = (name, color, o = {}) => { const m = makeMaterial({ color, flat: true, ...paint(name, o), key: `arch.${archetype}.${name}.${serial++}` }); owned.push(m); return m; };
  return { mat, own, dispose: () => { for (const m of owned) releaseMaterial(m); owned.length = 0; } };
}

/** A mesh of geo in mat, added to parent at (x, y, z). */
export function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
}
/** A tube along points ([x, y, z] or vectors), radius r (tapering to r1 at its end): its geometry, in the points' frame. */
export function tubeGeometry(points, r, r1 = r) {
  const pts = points.map((p) => (Array.isArray(p) ? V(...p) : p));
  if (r1 === r) return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 5), r, 6, false);
  // (tapering: a few cylinders along the curve, merged into one geometry: one draw, not one a cylinder)
  const curve = new THREE.CatmullRomCurve3(pts), n = Math.max(4, pts.length * 3), parts = [], q = new THREE.Quaternion(), m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = curve.getPoint(i / n), b = curve.getPoint((i + 1) / n), d = b.clone().sub(a), l = d.length();
    const ra = lerp(r, r1, i / n), rb = lerp(r, r1, (i + 1) / n);
    q.setFromUnitVectors(V(0, 1, 0), d.normalize());
    parts.push(new THREE.CylinderGeometry(rb, ra, l * 1.08, 7).applyMatrix4(m.compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1))));
  }
  return merged(parts);
}
/** A tube along points ([x, y, z] or vectors), radius r (tapering to r1 at its end), as one mesh in parent. */
export const tube = (parent, points, r, mat, r1 = r) => add(parent, tubeGeometry(points, r, r1), mat);
/** Geometries merged into one (their own transforms applied: one draw for many small parts of one material). */
export function merged(geos) {
  // (indexed when every one is: the fewest vertices; only position, normal and uv kept, so any primitives merge)
  const indexed = geos.every((g) => g.index);
  const flat = geos.map((g) => { const x = indexed ? g : g.index ? g.toNonIndexed() : g; for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); return x; });
  const out = mergeGeometries(flat, false);
  for (const g of geos) g.dispose();
  return out;
}
/** Many small parts of one material (tubes, cones, spheres: each a geometry already placed in parent's frame) as one mesh. */
export const many = (parent, geos, mat, x = 0, y = 0, z = 0) => add(parent, merged(geos), mat, x, y, z);
/** A segment (a cylinder) from a to b, radius r (r1 at b). */
export function rod(parent, a, b, r, mat, r1 = r) {
  const A = Array.isArray(a) ? V(...a) : a, B = Array.isArray(b) ? V(...b) : b, d = B.clone().sub(A);
  const m = add(parent, new THREE.CylinderGeometry(r1, r, d.length(), 8), mat, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return m;
}
/** A pivot group at (x, y, z) in parent. */
export function pivot(parent, x = 0, y = 0, z = 0, name = '') {
  const g = new THREE.Group(); g.position.set(x, y, z); g.name = name; parent.add(g); return g;
}

/** The eyes' colour by the fight: orange winding up, pale blue stunned, else its own. */
export const eyeColor = (f, base, wind = '#f3a361') => (f.state === 'wind' ? wind : f.stunned > 0 ? '#bfe9ff' : base);

/** The finishing pass: nothing in the body blocks the camera or the physics; every mesh casts and takes shadows. */
export function finish(group) {
  group.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.updateMatrixWorld(true);
  return group;
}
