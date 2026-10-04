import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// Building vehicles in flat comic colours with few draw calls (the hoverbike,
// the skiff, the taxis). Every plain-coloured part is "paint": it goes into
// one vertex-coloured mesh per shading (faceted or smooth), so a vehicle of
// thirty parts is drawn in two calls; the ink pass outlines the colour
// boundaries like a printed plate. Moving parts (a rudder, a flag, a driver)
// and parts that glow get their own small meshes.

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

/** Transform a geometry in place: scale, rotate (XYZ Euler), then move. */
export function T(geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  const sc = typeof s === 'number' ? _s.set(s, s, s) : _s.set(s[0], s[1], s[2]);
  return geo.applyMatrix4(_m.compose(_p.set(p[0], p[1], p[2]), _q, sc));
}

/** A geometry with only position, normal and a flat colour (non-indexed, ready to merge). */
export function painted(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  _c.set(color);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

const MATS = {};
/** The shared vertex-coloured material: faceted (flat) or smooth, one- or two-sided. */
export function paintMaterial({ smooth = false, side = THREE.FrontSide, glow = 0 } = {}) {
  const k = `${smooth}.${side}.${glow}`;
  return MATS[k] ??= makeMaterial({ color: '#ffffff', vertexColors: true, ...(smooth ? {} : { flat: true }), ...(side !== THREE.FrontSide ? { side } : {}), ...(glow ? { glow } : {}) });
}

/** Collects painted parts; mesh() merges them into one vertex-coloured mesh. */
export class Paint {
  constructor() { this.parts = []; }
  /** add(geometry, colour, { at, rot, scale }) — the transform is applied to the geometry. */
  add(geo, color, { at, rot, scale } = {}) {
    if (at || rot || scale) T(geo, at, rot, scale);
    this.parts.push(painted(geo, color));
    return this;
  }
  get empty() { return !this.parts.length; }
  geometry() { return this.parts.length ? mergeGeometries(this.parts) : null; }
  mesh(opts = {}) {
    const g = this.geometry();
    if (!g) return null;
    const m = new THREE.Mesh(g, opts.material ?? paintMaterial(opts));
    return m;
  }
}

/** A lathe along +z (profile [radius, z] from back to front), squashed to `sx` wide and `sy` tall. */
export function spindle(profile, { seg = 14, sx = 1, sy = 1 } = {}) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 0.001), z)), seg);
  // lathe runs along +y: lay it along +z
  g.rotateX(Math.PI / 2);
  g.scale(sx, sy, 1);
  return g;
}

/** A flat 2D outline (points [x, y]) extruded `depth` thick, centred on z = 0. */
export function plate(points, depth = 0.06) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Triangles and draw calls of an object (visible meshes), for the budget tests. */
export function budget(obj) {
  let tris = 0, draws = 0;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    draws++;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { tris: Math.round(tris), draws };
}
