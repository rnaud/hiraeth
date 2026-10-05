import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';

// Geometry helpers for the round ship. Ship-local frame: origin at the centre
// of the hull sphere, +y up. Azimuth `a` works like a heading: a = 0 points to
// +z, a = PI/2 to +x. A polar point is (sin a * r, y, cos a * r).

export const polar = (r, a, y, out = new THREE.Vector3()) => out.set(Math.sin(a) * r, y, Math.cos(a) * r);
const TAU = Math.PI * 2;
const wrap = (a) => ((a % TAU) + TAU) % TAU;

/** Push one quad (two triangles) into `pos`, wound so its face normal points along `hint`. */
function quad(pos, p1, p2, p3, p4, hint) {
  const e1 = _a.subVectors(p2, p1), e2 = _b.subVectors(p3, p1);
  const n = _c.crossVectors(e1, e2);
  const tri = n.dot(hint) >= 0 ? [p1, p2, p3, p1, p3, p4] : [p1, p3, p2, p1, p4, p3];
  for (const p of tri) pos.push(p.x, p.y, p.z);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _h = new THREE.Vector3();

const toGeo = (pos, normals) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else g.computeVertexNormals();
  return g;
};

/**
 * A spherical shell surface (one side) with rectangular holes in
 * (azimuth, height) space. Hole and patch edges are exact grid lines, so
 * frames fit them. Smooth radial normals.
 * @param holes [{ a0, a1, y0, y1 }]  azimuth range (radians) and height range
 * @param patch optional { a0, a1, y0, y1 }: build only this region
 */
export function shell({ r, holes = [], aSeg = 72, tSeg = 40, inward = false, patch = null, yMin = -r, yMax = r }) {
  const A = new Set(), Y = new Set();
  if (patch) {
    const n = Math.max(2, Math.ceil(((patch.a1 - patch.a0) / TAU) * aSeg));
    for (let i = 0; i <= n; i++) A.add(patch.a0 + ((patch.a1 - patch.a0) * i) / n);
    yMin = Math.max(yMin, patch.y0); yMax = Math.min(yMax, patch.y1);
  } else {
    for (let i = 0; i < aSeg; i++) A.add((i / aSeg) * TAU);
    for (const h of holes) { A.add(wrap(h.a0)); A.add(wrap(h.a1)); }
  }
  for (let i = 0; i <= tSeg; i++) { const y = r * Math.cos((i / tSeg) * Math.PI); if (y >= yMin && y <= yMax) Y.add(y); }
  Y.add(yMin); Y.add(yMax);
  for (const h of holes) for (const y of [h.y0, h.y1]) if (y > yMin && y < yMax) Y.add(y);
  const as = [...A].sort((p, q) => p - q);
  if (!patch) as.push(as[0] + TAU);
  const ys = [...Y].sort((p, q) => q - p);
  const inHole = (a, y) => holes.some((h) => {
    const lo = h.a0, hi = h.a1, aa = wrap(a - lo) + lo;
    return aa >= lo && aa <= hi && y >= h.y0 && y <= h.y1;
  });
  const pos = [], nrm = [];
  const P = (a, y) => polar(Math.sqrt(Math.max(r * r - y * y, 0)), a, y, new THREE.Vector3());
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < as.length - 1; i++) {
      const am = (as[i] + as[i + 1]) / 2, ym = (ys[j] + ys[j + 1]) / 2;
      if (inHole(am, ym)) continue;
      const p1 = P(as[i], ys[j]), p2 = P(as[i + 1], ys[j]), p3 = P(as[i + 1], ys[j + 1]), p4 = P(as[i], ys[j + 1]);
      const hint = P(am, ym).multiplyScalar(inward ? -1 : 1);
      const before = pos.length;
      quad(pos, p1, p2, p3, p4, hint);
      for (let k = before; k < pos.length; k += 3) {
        _h.set(pos[k], pos[k + 1], pos[k + 2]).normalize().multiplyScalar(inward ? -1 : 1);
        nrm.push(_h.x, _h.y, _h.z);
      }
    }
  }
  return toGeo(pos, nrm);
}

/** The faces lining a hole through a shell between radii ri and ro (sill, lintel, jambs). */
export function holeReveal(h, ri, ro, seg = 8, { sill = true } = {}) {
  const pos = [];
  const P = (r, a, y) => polar(Math.sqrt(Math.max(r * r - y * y, 0)), a, y, new THREE.Vector3());
  const mid = (h.a0 + h.a1) / 2, ym = (h.y0 + h.y1) / 2;
  for (let i = 0; i < seg; i++) {
    const a = h.a0 + ((h.a1 - h.a0) * i) / seg, b = h.a0 + ((h.a1 - h.a0) * (i + 1)) / seg;
    if (sill) quad(pos, P(ri, a, h.y0), P(ri, b, h.y0), P(ro, b, h.y0), P(ro, a, h.y0), new THREE.Vector3(0, 1, 0));
    quad(pos, P(ri, a, h.y1), P(ri, b, h.y1), P(ro, b, h.y1), P(ro, a, h.y1), new THREE.Vector3(0, -1, 0));
  }
  for (let j = 0; j < seg; j++) {
    const y0 = h.y0 + ((h.y1 - h.y0) * j) / seg, y1 = h.y0 + ((h.y1 - h.y0) * (j + 1)) / seg;
    for (const [a, sgn] of [[h.a0, 1], [h.a1, -1]]) {
      const t = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(sgn);
      quad(pos, P(ri, a, y0), P(ro, a, y0), P(ro, a, y1), P(ri, a, y1), t);
    }
  }
  void mid; void ym;
  return toGeo(pos);
}

/** A tube following the rim of a hole on a sphere of radius r (a frame). */
export function holeFrame(h, r, thick = 0.12, seg = 10) {
  const pts = [];
  const P = (a, y) => polar(Math.sqrt(Math.max(r * r - y * y, 0)), a, y, new THREE.Vector3());
  for (let i = 0; i < seg; i++) pts.push(P(h.a0 + ((h.a1 - h.a0) * i) / seg, h.y0));
  for (let i = 0; i < seg; i++) pts.push(P(h.a1, h.y0 + ((h.y1 - h.y0) * i) / seg));
  for (let i = 0; i < seg; i++) pts.push(P(h.a1 - ((h.a1 - h.a0) * i) / seg, h.y1));
  for (let i = 0; i < seg; i++) pts.push(P(h.a0, h.y1 - ((h.y1 - h.y0) * i) / seg));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.1);
  return new THREE.TubeGeometry(curve, seg * 8, thick, 5, true);
}

/** A latitude ring (tube) on a sphere at height y. */
export function latitudeRing(r, y, thick = 0.1, a0 = 0, a1 = TAU, seg = 96) {
  const rh = Math.sqrt(Math.max(r * r - y * y, 0));
  const pts = [];
  const closed = a1 - a0 >= TAU - 1e-6;
  const n = closed ? seg : seg + 1;
  for (let i = 0; i < n; i++) pts.push(polar(rh, a0 + ((a1 - a0) * i) / seg, y, new THREE.Vector3()));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), seg, thick, 5, closed);
}

/** A meridian arc (tube) on a sphere at azimuth a, between heights y0 and y1. */
export function meridian(r, a, y0, y1, thick = 0.08, seg = 24) {
  const pts = [];
  const t0 = Math.acos(THREE.MathUtils.clamp(y1 / r, -1, 1)), t1 = Math.acos(THREE.MathUtils.clamp(y0 / r, -1, 1));
  for (let i = 0; i <= seg; i++) { const t = t0 + ((t1 - t0) * i) / seg; pts.push(polar(r * Math.sin(t), a, r * Math.cos(t), new THREE.Vector3())); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, thick, 5, false);
}

/**
 * An annular sector prism: r0..r1, azimuth a0..a1, height y0..y1 (curved
 * walls, desks, benches, the corridor wall). Flat-shaded.
 */
export function sector({ r0, r1, a0, a1, y0, y1, seg }) {
  const n = seg ?? Math.max(2, Math.ceil((Math.abs(a1 - a0) / TAU) * 64));
  const full = Math.abs(a1 - a0) >= TAU - 1e-6;
  const pos = [];
  const P = (r, a, y) => polar(r, a, y, new THREE.Vector3());
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, b = a0 + ((a1 - a0) * (i + 1)) / n, m = (a + b) / 2;
    const out = P(1, m, 0), inn = P(-1, m, 0);
    quad(pos, P(r1, a, y0), P(r1, b, y0), P(r1, b, y1), P(r1, a, y1), out);
    if (r0 > 0.01) quad(pos, P(r0, a, y0), P(r0, b, y0), P(r0, b, y1), P(r0, a, y1), inn);
    quad(pos, P(r0, a, y1), P(r1, a, y1), P(r1, b, y1), P(r0, b, y1), new THREE.Vector3(0, 1, 0));
    quad(pos, P(r0, a, y0), P(r1, a, y0), P(r1, b, y0), P(r0, b, y0), new THREE.Vector3(0, -1, 0));
  }
  if (!full) {
    for (const [a, sgn] of [[a0, -1], [a1, 1]]) {
      const t = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(sgn * Math.sign(a1 - a0));
      quad(pos, P(r0, a, y0), P(r1, a, y0), P(r1, a, y1), P(r0, a, y1), t);
    }
  }
  return toGeo(pos);
}

/**
 * A straight wall along the radius at azimuth a, from r0 out to a sphere of
 * radius `rs` (its outer edge follows the curve), heights y0..y1, thickness t.
 */
export function radialWall({ a, r0, rs, y0, y1, t = 0.22, overlap = 0.25, steps = 10 }) {
  const shape = new THREE.Shape();
  const rAt = (y) => Math.sqrt(Math.max(rs * rs - y * y, 0)) + overlap;
  shape.moveTo(r0, y0);
  for (let i = 0; i <= steps; i++) { const y = y0 + ((y1 - y0) * i) / steps; shape.lineTo(rAt(y), y); }
  shape.lineTo(r0, y1);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  g.rotateY(a - Math.PI / 2);
  return g.index ? g.toNonIndexed() : g;
}

/**
 * Point on a sphere of radius r from tangent-plane coordinates (u, v) in
 * metres around a centre direction (u along the latitude, v up the meridian).
 */
export function tangentFrame(a, y, r) {
  const c = polar(Math.sqrt(r * r - y * y), a, y, new THREE.Vector3()).normalize();
  const u = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
  const v = new THREE.Vector3().crossVectors(c, u).normalize();
  if (v.y < 0) v.negate();
  return (du, dv, lift = 0, out = new THREE.Vector3()) =>
    out.copy(c).multiplyScalar(r).addScaledVector(u, du).addScaledVector(v, dv).normalize().multiplyScalar(r + lift);
}

/** A filled polygon (fan from its centroid) drawn on a sphere through a tangent frame. */
export function surfacePoly(T, pts2, lift) {
  const pos = [];
  const cx = pts2.reduce((s, p) => s + p[0], 0) / pts2.length, cy = pts2.reduce((s, p) => s + p[1], 0) / pts2.length;
  const C = T(cx, cy, lift);
  const out = C.clone();
  for (let i = 0; i < pts2.length; i++) {
    const p = pts2[i], q = pts2[(i + 1) % pts2.length];
    const A = T(p[0], p[1], lift), B = T(q[0], q[1], lift);
    const tri = [C, A, B];
    const n = new THREE.Vector3().crossVectors(_a.subVectors(A, C), _b.subVectors(B, C));
    if (n.dot(out) < 0) tri.reverse();
    for (const v of tri) pos.push(v.x, v.y, v.z);
  }
  return toGeo(pos);
}

/** An irregular blob outline (scorch marks, stains). */
export function blob(rx, ry, n = 18, rough = 0.25, seed = 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const k = 1 + rough * (Math.sin(t * 3 + seed) * 0.5 + Math.sin(t * 7 + seed * 2.3) * 0.3 + Math.sin(t * 11 + seed * 5.1) * 0.2);
    out.push([Math.cos(t) * rx * k, Math.sin(t) * ry * k]);
  }
  return out;
}

/** A thick arc stroke (a ribbon polygon) in tangent coordinates. */
export function arcStroke(cx, cy, radius, t0, t1, width, n = 20) {
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const w = width * (0.75 + 0.25 * Math.sin((i / n) * Math.PI));   // a brush stroke: thicker in the middle
    outer.push([cx + Math.cos(t) * (radius + w / 2), cy + Math.sin(t) * (radius + w / 2)]);
    inner.push([cx + Math.cos(t) * (radius - w / 2), cy + Math.sin(t) * (radius - w / 2)]);
  }
  return [outer, inner];
}

/** A ribbon between two polylines of tangent points, on the sphere. */
export function surfaceRibbon(T, outer, inner, lift) {
  const pos = [];
  const ref = T(outer[0][0], outer[0][1], lift).clone();
  for (let i = 0; i < outer.length - 1; i++) {
    const a = T(outer[i][0], outer[i][1], lift).clone(), b = T(outer[i + 1][0], outer[i + 1][1], lift).clone();
    const c = T(inner[i + 1][0], inner[i + 1][1], lift).clone(), d = T(inner[i][0], inner[i][1], lift).clone();
    quad(pos, a, b, c, d, ref);
  }
  return toGeo(pos);
}

/**
 * Collects geometry per material and merges it into one mesh each (few draw
 * calls). Material entries are makeMaterial options; `tag` keeps a material
 * unique to one ship so its colour / glow can be animated.
 */
export class Batch {
  constructor(materials) { this.materials = materials; this.parts = new Map(); }
  add(key, geo, m) {
    if (!this.materials[key]) throw new Error(`ship: unknown material ${key}`);
    if (m) geo.applyMatrix4(m);
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return g;
  }
  /** One mesh per material, added to `parent`. Options per key: { noCollide, visible }. */
  build(parent, flags = {}) {
    const meshes = {};
    for (const [key, geos] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), this.materials[key].isMaterial ? this.materials[key] : makeMaterial(this.materials[key]));
      Object.assign(mesh.userData, flags[key] ?? {});
      if (flags[key]?.visible === false) mesh.visible = false;
      mesh.name = `ship-${key}`;
      parent.add(mesh);
      meshes[key] = mesh;
    }
    return meshes;
  }
}

/** Matrix helper: an object built in a local frame (+z radial outward, +x along the tangent) at polar (r, a, y). */
export function placeAt(r, a, y, spin = 0, scale = 1) {
  const m = new THREE.Matrix4().makeRotationY(a + spin);
  if (scale !== 1) m.scale(new THREE.Vector3(scale, scale, scale));
  m.setPosition(polar(r, a, y));
  return m;
}
