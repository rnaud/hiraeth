// Lorn's crystals as the picked sheet draws them (references/surfaces/crystals/sheet-1.jpg, issue #693): long six-sided
// prisms with pointed tips, a few to a cluster at their own heights and leans, worn by time: corners chipped off, an edge
// bevelled part of the way, now and then the tip broken off flat. Each crystal is a convex solid cut by planes (a chip is
// a plane through a corner), so it stays closed and every face flat.
//
// The facets' frame (S_CRYSTAL, src/surface-marks.js) rides in the uv: each face is drawn as a fan round its middle, u 0
// on the face's edges and 1 at its middle (so u / fwidth(u) is how many pixels a point lies from the nearest edge: the
// rim and the chips go by it), v up the crystal from its root (0) to where its point is (1). Faces with no frame (the
// buried foot) get v = -1: their tone only.
//
//   crystalPrism({ r, h, sides, tip, taper, chips, broken, base }, rand) → a non-indexed BufferGeometry (position, normal,
//                                                                        uv), its root at the origin, up +y
//   crystalCluster({ r, h, companions }, rand)                            → [{ geo, main }]: one main crystal and a few
//                                                                        smaller ones leaning out round its foot
//   crystalSeed(x, z)                                                     → a seed from a place (the shapes take their
//                                                                        own dice, never the world's)
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

/** The shapes' tuning: the sides, how long the point is (× the radius), the taper, the irregular cross-section, how many
 *  chips and how deep (× the radius), the share of broken tips, the companions round a main crystal. */
export const CRYSTAL_FORM = { sides: 6, tip: [1.1, 1.7], taper: 0.9, wobble: 0.16, chips: [1, 3], chip: [0.12, 0.3], broken: 0.18,
  companions: { height: [0.3, 0.68], radius: [0.42, 0.72], lean: [0.22, 0.6], dist: [0.55, 1.0] } };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;

/** A seed from a place (x, z): the same crystal every load. */
export function crystalSeed(x, z, k = 0) {
  return (Math.imul(Math.round(x * 16) | 0, 73856093) ^ Math.imul(Math.round(z * 16) | 0, 19349663) ^ Math.imul(k + 1, 83492791)) >>> 0;
}
export const crystalRand = (x, z, k) => mulberry32(crystalSeed(x, z, k));

/** Newell's normal of a polygon (unnormalised). */
function polyNormal(pts) {
  const n = V();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y);
  }
  return n;
}
const centroid = (pts) => pts.reduce((s, p) => s.add(p), V()).multiplyScalar(1 / pts.length);

/** Cut a convex solid (its faces, each a polygon wound outward) by the plane n·x = c, keeping n·x ≤ c; the cut is a new face. */
export function clipSolid(faces, n, c, eps = 1e-7) {
  const out = [], cut = [];
  for (const f of faces) {
    const P = f.pts, res = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], da = n.dot(a) - c, db = n.dot(b) - c;
      if (da <= eps) res.push(a);
      if (Math.abs(da) <= eps) cut.push(a);
      if ((da < -eps && db > eps) || (da > eps && db < -eps)) { const p = a.clone().lerp(b, da / (da - db)); res.push(p); cut.push(p); }
    }
    if (res.length >= 3) out.push({ ...f, pts: res });
  }
  // the new face: the cut's points (each found from both faces of its edge), round their middle, wound outward (along n)
  const pts = [];
  for (const p of cut) if (!pts.some((q) => q.distanceToSquared(p) < 1e-10)) pts.push(p);
  if (pts.length >= 3 && out.length < faces.length + 1) {
    const m = centroid(pts), u = V(1, 0, 0);
    if (Math.abs(n.x) > 0.9) u.set(0, 1, 0);
    u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
    const w = n.clone().cross(u);
    const ang = (p) => { const d = p.clone().sub(m); return Math.atan2(w.dot(d), u.dot(d)); };
    out.push({ kind: 'chip', pts: pts.map((p) => [ang(p), p]).sort((a, b) => a[0] - b[0]).map((q) => q[1]) });
  }
  return out;
}

/**
 * One crystal: a `sides`-sided prism (its cross-section a little irregular, narrowing by `taper` to its shoulder) with a
 * pointed tip `tip` long (its point a little off the axis), chipped `chips` times (a corner, an edge part of the way, or
 * a little of the point), its tip broken off flat with the chance `broken`. Its root at the origin, up +y; v (the glow's
 * height) runs over h even when the tip is broken.
 */
export function crystalPrism({ r, h, sides = CRYSTAL_FORM.sides, tip, taper = CRYSTAL_FORM.taper, chips, broken = CRYSTAL_FORM.broken, base = true, wobble = CRYSTAL_FORM.wobble } = {}, rand = Math.random) {
  const F = CRYSTAL_FORM;
  tip ??= Math.min(r * lerp(F.tip[0], F.tip[1], rand()), h * 0.45);
  chips ??= F.chips[0] + Math.floor(rand() * (F.chips[1] - F.chips[0] + 1));
  const hb = h - tip, step = (Math.PI * 2) / sides, a0 = rand() * step;
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = a0 + i * step + (rand() - 0.5) * step * 0.35, k = r * (1 + (rand() - 0.5) * 2 * wobble);
    ring.push([Math.cos(a) * k, Math.sin(a) * k]);
  }
  const b = ring.map(([x, z]) => V(x, 0, z)), t = ring.map(([x, z]) => V(x * taper, hb, z * taper));
  const apex = V((rand() - 0.5) * 0.3 * r * taper, h, (rand() - 0.5) * 0.3 * r * taper);
  let faces = [];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    faces.push({ kind: 'side', pts: [b[i], b[j], t[j], t[i]] });
    faces.push({ kind: 'tip', pts: [t[i], t[j], apex] });
  }
  faces.push({ kind: 'base', pts: [...b] });
  // every face wound outward (the solid is convex: away from its middle)
  const mid = V(0, h * 0.4, 0);
  for (const f of faces) if (polyNormal(f.pts).dot(centroid(f.pts).sub(mid)) < 0) f.pts.reverse();
  // worn: chips off its corners, its edges and its point. A chip is a plane cutting a little off near its anchor; one
  // that would reach further (past the anchor's neighbourhood) is left out, so a crystal never loses more than a corner.
  const scale = Math.min(r, tip);
  const verts = () => faces.flatMap((f) => f.pts);
  const cutNear = (n, c, anchor, reach) => {
    n.normalize();
    for (const p of verts()) if (n.dot(p) > c + 1e-6 && p.distanceTo(anchor) > reach) return false;
    faces = clipSolid(faces, n, c);
    return true;
  };
  for (let k = 0; k < chips; k++) {
    const kind = rand(), i = Math.floor(rand() * sides), d = scale * lerp(F.chip[0], F.chip[1], rand()), q = rand(), q2 = rand();
    const o = V(t[i].x, 0, t[i].z).normalize();
    if (kind < 0.45) {   // a shoulder's corner (where an edge meets the point), cut off at a slant
      const n = o.clone().add(V(0, lerp(0.3, 0.9, q), 0)).add(V(-o.z, 0, o.x).multiplyScalar((q2 - 0.5) * 0.6)).normalize();
      cutNear(n, n.dot(t[i]) - d, t[i], d * 3);
    } else if (kind < 0.8) {   // an edge worn into a bevel from part way up it to the shoulder
      const y0 = hb * lerp(0.35, 0.8, q), s = d / Math.max(hb - y0, 0.1);
      const n = o.clone().add(V(0, s, 0)).normalize();
      cutNear(n, n.dot(t[i]) - d * n.dot(o), t[i], hb - y0 + d * 3);
    } else {   // its point blunted, a little chip off it
      const n = V((q - 0.5) * 1.4, 1, (q2 - 0.5) * 1.4).normalize();
      cutNear(n, n.dot(apex) - tip * lerp(0.08, 0.22, q), apex, tip * 0.6);
    }
  }
  if (rand() < broken) {   // its tip broken off, a slanted break
    const n = V((rand() - 0.5) * 1.2, 1, (rand() - 0.5) * 1.2).normalize(), P = V(apex.x * 0.5, lerp(hb + tip * 0.2, hb + tip * 0.6, rand()), apex.z * 0.5);
    cutNear(n, n.dot(P), P, tip * 1.2 + r);
  }
  return facesToGeometry(faces, h, base);
}

/** Faces → a non-indexed geometry: each face a fan round its middle (u 0 on its edges, 1 at its middle; v its height / h),
 *  the foot a plain fan (v −1). */
function facesToGeometry(faces, h, base) {
  const pos = [], uv = [];
  const put = (p, u, v) => { pos.push(p.x, p.y, p.z); uv.push(u, v); };
  for (const f of faces) {
    const P = f.pts;
    if (f.kind === 'base') {
      if (!base) continue;
      for (let i = 1; i < P.length - 1; i++) { put(P[0], 0, -1); put(P[i], 0, -1); put(P[i + 1], 0, -1); }
      continue;
    }
    const m = centroid(P);
    for (let i = 0; i < P.length; i++) {
      const a = P[i], c = P[(i + 1) % P.length];
      put(m, 1, m.y / h); put(a, 0, a.y / h); put(c, 0, c.y / h);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * A cluster as the sheet's: the main crystal (r, h, upright: the caller leans the whole) and `companions` smaller ones
 * round its foot, each leaning out its own way, sunk a little so their feet stay under the ground. → [{ geo, main }].
 */
export function crystalCluster({ r, h, companions, sides, broken } = {}, rand = Math.random) {
  const C = CRYSTAL_FORM.companions;
  const out = [{ geo: crystalPrism({ r, h, sides, broken }, rand), main: true }];
  companions ??= h < 10 ? 1 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 2);
  const a0 = rand() * Math.PI * 2;
  for (let k = 0; k < companions; k++) {
    const phi = a0 + (k + (rand() - 0.5) * 0.6) * (Math.PI * 2) / companions;
    const hc = h * lerp(C.height[0], C.height[1], rand()), rc = r * lerp(C.radius[0], C.radius[1], rand());
    const lean = lerp(C.lean[0], C.lean[1], rand()), dist = r * lerp(C.dist[0], C.dist[1], rand());
    const g = crystalPrism({ r: rc, h: hc, sides, broken }, rand);
    const axis = V(Math.sin(phi), 0, -Math.cos(phi));   // (up × the way out: a turn about it leans the crystal out)
    g.rotateY(rand() * Math.PI * 2);
    g.translate(0, -rc * 0.5, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationAxis(axis, lean));
    g.translate(Math.cos(phi) * dist, 0, Math.sin(phi) * dist);
    out.push({ geo: g, main: false });
  }
  return out;
}

/**
 * What the crystals' collision needs of them (issue #693): each face once as a plain fan (not the fan round its middle the
 * facet frame draws), the buried feet left out, positions only: under half the triangles, the same solid. From a drawn
 * crystal geometry (merged, moved: any), as facesToGeometry wrote it (a face's triangles in a row, their middle first).
 */
export function crystalCollider(geo) {
  const P = geo.attributes.position, U = geo.attributes.uv, out = [];
  const same = (i, j) => P.getX(i) === P.getX(j) && P.getY(i) === P.getY(j) && P.getZ(i) === P.getZ(j);
  const push = (i) => out.push(P.getX(i), P.getY(i), P.getZ(i));
  for (let t = 0; t < P.count / 3;) {
    if (U.getY(t * 3) < -0.5) { t++; continue; }   // (the foot, under the ground)
    // the face: the triangles that share this middle; its corners in order
    let e = t + 1;
    while (e < P.count / 3 && U.getX(e * 3) === 1 && same(e * 3, t * 3) && U.getY(e * 3) >= -0.5) e++;
    const corners = [];
    for (let k = t; k < e; k++) corners.push(k * 3 + 1);
    for (let k = 1; k < corners.length - 1; k++) { push(corners[0]); push(corners[k]); push(corners[k + 1]); }
    t = e;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}
