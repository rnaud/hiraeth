import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Lorn's route pieces' shared shapes (src/lorn-canopy.js, src/lorn-flood.js, src/lorn-veins.js): plain geometries in
// world metres, no materials. Every one is non-indexed with a position and a normal only, so a builder can merge any of
// them by material (Bucket).
//
//   quads(list)                    faces from quads [p0, p1, p2, p3, want]: each wound so its normal points along `want`
//   helix({ cx, cz, ri, ro, y0, y1, a0, dir, slope, th }) → { geo, at(a), a1, rise }   a ramp wound round a trunk
//   ring({ cx, cz, ri, ro, y, th, gap })                       a deck round a trunk (gap: [a0, a1, r] no deck inside r)
//   ribbon(points, w, th)                                     a walkway along points (a bridge's deck)
//   rope(points, r)                                           a tube along points
//   Bucket                                                    geometries by material, merged at the end

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), DOWN = V(0, -1, 0);
export const plain = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
};

/** Triangles from quads [p0, p1, p2, p3, want]: each wound so its face normal points along `want` (flat-shaded). */
export function quads(list) {
  const pos = [], nrm = [], e1 = V(), e2 = V(), n = V();
  for (const [a, b, c, d, want] of list) {
    e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2);
    const q = n.dot(want) >= 0 ? [a, b, c, d] : [a, d, c, b];
    n.crossVectors(e1.subVectors(q[1], q[0]), e2.subVectors(q[2], q[0])).normalize();
    for (const p of [q[0], q[1], q[2], q[0], q[2], q[3]]) { pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

/**
 * A ramp wound round a trunk at (cx, cz): its band from radius ri to ro, rising from y0 at angle a0 to y1, `dir` the
 * way round (+1: the angle grows), `slope` its pitch (rad) at the band's middle, `th` thick. → { geo, at(a): the band's
 * middle at angle a (clamped to the ramp), a1 (the angle it ends at), rise (m a radian), steps }
 */
export function helix({ cx, cz, ri, ro, y0, y1, a0 = 0, dir = 1, slope = 0.47, th = 0.35, step = 0.07 }) {
  const rm = (ri + ro) / 2, rise = rm * Math.tan(slope), A = (y1 - y0) / rise, n = Math.max(2, Math.ceil(A / step));
  const P = (a, r, y) => V(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
  const L = [];
  for (let i = 0; i < n; i++) {
    const aA = a0 + dir * A * (i / n), aB = a0 + dir * A * ((i + 1) / n), yA = y0 + (y1 - y0) * (i / n), yB = y0 + (y1 - y0) * ((i + 1) / n);
    const iA = P(aA, ri, yA), oA = P(aA, ro, yA), iB = P(aB, ri, yB), oB = P(aB, ro, yB);
    const bi = (p) => p.clone().setY(p.y - th);
    const out = V(Math.cos((aA + aB) / 2), 0, Math.sin((aA + aB) / 2));
    L.push([iA, oA, oB, iB, UP], [bi(iA), bi(oA), bi(oB), bi(iB), DOWN], [oA, oB, bi(oB), bi(oA), out], [iA, iB, bi(iB), bi(iA), out.clone().negate()]);
    if (i === 0 || i === n - 1) {
      const tan = V(-Math.sin(i ? aB : aA), 0, Math.cos(i ? aB : aA)).multiplyScalar(dir * (i ? 1 : -1));
      const [a, b] = i ? [iB, oB] : [iA, oA];
      L.push([a, b, bi(b), bi(a), tan]);
    }
  }
  const a1 = a0 + dir * A;
  const at = (a) => { const k = THREE.MathUtils.clamp((a - a0) / (dir * A), 0, 1); return P(a0 + dir * A * k, rm, y0 + (y1 - y0) * k); };
  return { geo: quads(L), at, a1, a0, dir, rise, rm, ri, ro, y0, y1, cx, cz, A };
}

/**
 * A deck round a trunk: a flat ring from ri to ro, its top at y, th thick. `gaps`: [[a0, a1, r]…] angles (a0 < a1,
 * radians) where nothing is laid inside radius r (a stair comes up through it).
 */
export function ring({ cx, cz, ri, ro, y, th = 0.5, gaps = [], step = 0.1 }) {
  const P = (a, r, yy) => V(cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r);
  const n = Math.ceil((Math.PI * 2) / step), L = [];
  const inGap = (a) => gaps.find(([g0, g1]) => { const m = (x) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); const s = m(a - g0); return s <= m(g1 - g0); });
  const gs = Array.from({ length: n }, (_, i) => inGap(((i + 0.5) / n) * Math.PI * 2));
  const b = (p) => p.clone().setY(y - th);
  for (let i = 0; i < n; i++) {
    const aA = (i / n) * Math.PI * 2, aB = ((i + 1) / n) * Math.PI * 2, g = gs[i], r0 = g ? g[2] : ri;
    const tA = P(aA, r0, y), tB = P(aB, r0, y), uA = P(aA, ro, y), uB = P(aB, ro, y);
    const out = V(Math.cos((aA + aB) / 2), 0, Math.sin((aA + aB) / 2));
    L.push([tA, uA, uB, tB, UP], [b(tA), b(uA), b(uB), b(tB), DOWN], [uA, uB, b(uB), b(uA), out], [tA, tB, b(tB), b(tA), out.clone().negate()]);
    // (a gap's side, where the inner band stops or starts again)
    const gp = gs[(i + n - 1) % n];
    if (!!gp !== !!g) { const s = P(aA, ri, y), e = P(aA, (gp ?? g)[2], y); L.push([s, e, b(e), b(s), V(-Math.sin(aA), 0, Math.cos(aA)).multiplyScalar(g ? 1 : -1)]); }
  }
  return quads(L);
}

/** A walkway w wide and th thick along points (Vector3: the middle of its top), level across. */
export function ribbon(points, w, th = 0.25) {
  const L = [], side = V();
  const edge = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    side.set(b.z - a.z, 0, -(b.x - a.x)).normalize().multiplyScalar(w / 2);
    return [p.clone().add(side), p.clone().sub(side)];
  });
  const b = (p) => p.clone().setY(p.y - th);
  for (let i = 0; i < points.length - 1; i++) {
    const [l0, r0] = edge[i], [l1, r1] = edge[i + 1];
    const s = V().subVectors(l0, r0).normalize();
    L.push([l0, r0, r1, l1, UP], [b(l0), b(r0), b(r1), b(l1), DOWN], [l0, l1, b(l1), b(l0), s], [r0, r1, b(r1), b(r0), s.clone().negate()]);
  }
  const t0 = V().subVectors(points[0], points[1]).setY(0).normalize(), t1 = V().subVectors(points.at(-1), points.at(-2)).setY(0).normalize();
  L.push([edge[0][0], edge[0][1], b(edge[0][1]), b(edge[0][0]), t0], [edge.at(-1)[0], edge.at(-1)[1], b(edge.at(-1)[1]), b(edge.at(-1)[0]), t1]);
  return quads(L);
}

/** A tube r round along points (a rope, a rail). */
export const rope = (points, r, radial = 4) => plain(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(2, points.length * 2), r, radial, false));

/** A bar r round from a to b (Vector3s). */
export function bar(a, b, r, radial = 5) {
  const d = b.clone().sub(a), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, radial, 1, false).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return plain(g.translate(a.x, a.y, a.z));
}

/** Geometries by material: add(key, geo); meshes(materials, { solid }) → the merged meshes, one a material. */
export class Bucket {
  constructor() { this.by = new Map(); }
  add(key, ...geos) { if (!this.by.has(key)) this.by.set(key, []); for (const g of geos) this.by.get(key).push(plain(g)); return this; }
  meshes(mats, { solid = true, name = '' } = {}) {
    const out = [];
    for (const [k, list] of this.by) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeometries(list), mats[k]);
      m.name = name ? `${name} (${k})` : k;
      if (!solid) m.userData.noCollide = true;
      out.push(m);
    }
    return out;
  }
}
