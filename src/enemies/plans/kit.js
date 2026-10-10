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
/**
 * Many moving parts of one material as one skinned mesh (one draw, the motion kept): each mesh's geometry is bound to
 * its parent, the joint that moves it (a leg's thigh, shin and foot, a feeler's pivot: the kit keeps moving those), each
 * tinted by its own material's colour over `mat`'s (vertex colours: `mat` needs vertexColors), and the meshes are taken
 * out. owner: where it goes (the model's root, built at rest). Returns the skinned mesh.
 */
export function skinned(owner, meshes, mat, shared = null) {
  owner.updateMatrixWorld(true);
  // (shared: { bones, index, skeleton } of the model's other skinned meshes, so their joints' matrices go up once a frame)
  const bones = shared?.bones ?? [], index = shared?.index ?? new Map(), geos = [], inv = new THREE.Matrix4().copy(owner.matrixWorld).invert(), m = new THREE.Matrix4();
  const base = mat.uniforms?.uColor?.value ?? new THREE.Color(1, 1, 1);
  for (const mesh of meshes) {
    const bone = mesh.parent;
    if (!index.has(bone)) { index.set(bone, bones.length); bones.push(bone); }
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    g.applyMatrix4(m.multiplyMatrices(inv, mesh.matrixWorld));
    const c = mesh.material?.uniforms?.uColor?.value ?? base, b = index.get(bone);
    const col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r / Math.max(base.r, 1e-3); col[i * 3 + 1] = c.g / Math.max(base.g, 1e-3); col[i * 3 + 2] = c.b / Math.max(base.b, 1e-3);
      si[i * 4] = b; sw[i * 4] = 1;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geos.push(g);
    mesh.removeFromParent(); mesh.geometry.dispose();
  }
  const sm = new THREE.SkinnedMesh(mergeGeometries(geos, false), mat);
  for (const g of geos) g.dispose();
  sm.name = 'skinned'; sm.frustumCulled = false;   // (its bounds move with its joints)
  owner.add(sm);
  sm.updateMatrixWorld(true);
  sm.bind(shared?.skeleton ?? new THREE.Skeleton(bones));
  // its bounds as its joints move (a gallery frames it, a box is taken of it): each joint's own box of its vertices, at
  // the joint's place now (three's would skin every vertex once, with the joints as they were then, and keep that)
  const local = bones.map(() => new THREE.Box3()), pos = sm.geometry.attributes.position, idx = sm.geometry.attributes.skinIndex, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) local[idx.getX(i)].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[idx.getX(i)]));
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => {
    sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => {
      const L = local[i]; if (L.isEmpty()) return;
      b.updateWorldMatrix(true, false);
      for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? L.max.x : L.min.x, k & 2 ? L.max.y : L.min.y, k & 4 ? L.max.z : L.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back));
    });
    return box;
  };
  sm.userData.boneBoxes = { bones, local };   // (each joint's box of its own vertices, in its frame: the body the blade meets, src/foe-body.js)
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => bounds().getBoundingSphere(sphere), set() {} });
  return sm;
}

/**
 * The whole body's moving parts by material as a few skinned meshes: sets [{ from: [materials built with], into: the
 * skinned mesh's material (vertexColors) }]; every mesh under owner in one of `from` goes into its set's mesh (its own
 * colour kept as a tint). Returns the skinned meshes, in the sets' order (null for a set with no mesh).
 */
export function skinBy(owner, sets) {
  const lists = sets.map(() => []);
  owner.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh) return; const i = sets.findIndex((s) => s.from.includes(o.material)); if (i >= 0) lists[i].push(o); });
  // (one skeleton for all of them: every joint any of them hangs on, so the model's joints are uploaded once a frame)
  const shared = { bones: [], index: new Map() };
  for (const l of lists) for (const mesh of l) if (!shared.index.has(mesh.parent)) { shared.index.set(mesh.parent, shared.bones.length); shared.bones.push(mesh.parent); }
  owner.updateMatrixWorld(true);
  shared.skeleton = new THREE.Skeleton(shared.bones);
  return sets.map((s, i) => (lists[i].length ? skinned(owner, lists[i], s.into, shared) : null));
}

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
