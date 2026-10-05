import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// The fluid's splats (fluid-tool.js Splats): decals projected onto the surface a glob hit, so they
// follow it over curves, steps and edges instead of floating in front of it as a flat disc.
//
// A splat is a box in front of and behind the hit point, its axes the hit normal and a random turn
// round it (decalBasis). The world's own triangles inside that box are gathered (the collision BVH,
// which is baked from the drawn meshes, and the ground's heightfield, whose triangles are the drawn
// terrain's), clipped to the box (clipTriangle, Sutherland-Hodgman, as three.js DecalGeometry does)
// and kept where they face the shot and nothing in front of them hides them from it (the back of a
// thin wall, the floor under a railing). Each kept corner carries its spot in the splat's own plane
// (x / sx, y / sy): the shader draws the lumpy blob and its drops there (splatShape, below) and grows
// and shrinks it in place, so the geometry is built once per shot. The triangles lie exactly on the
// surface (no lift): the material's polygon offset keeps them in front without z-fighting.

/** The blob's satellite drops in the splat's plane: [x, y, radius] (units of the splat's size). */
export const SPLAT_DROPS = (() => {
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 5 }, () => { const a = rnd() * Math.PI * 2, d = 1.25 + rnd() * 0.45; return [Math.cos(a) * d, Math.sin(a) * d, 0.12 + rnd() * 0.12]; });
})();
/** How far the shape reaches from its centre (drops, their lumps and the pop's overshoot): the box's half-size. */
export const SPLAT_REACH = 2.25;

/** The main blob's outline radius at angle a (its lumps), for a splat's phase. */
export function blobRadius(a, phase) {
  return 1 + 0.32 * (0.5 * Math.sin(a * 3 + phase) + 0.3 * Math.sin(a * 5 + phase * 2) + 0.14 * Math.sin(a * 7 + phase * 3.1));
}

/** The splat's scale at age t (s) of a life (s): pops out with a little overshoot, holds, shrinks away. Matches the shader. */
export function splatGrowth(t, life) {
  const grow = t < 0.14 ? (Math.sin((t / 0.14) * Math.PI * 0.62) / Math.sin(Math.PI * 0.62)) * 1.12 : 1.12 - 0.12 * Math.min(1, (t - 0.14) / 0.2);
  return Math.max(0, grow * (1 - THREE.MathUtils.smoothstep(t, life - 1.1, life)));
}

/** Is (x, y) (splat units) inside the splat grown to k? 0 outside, 1 in the outer tone, 2 in the inner one (kInner). */
export function splatShape(x, y, k, kInner, phase) {
  const r = Math.hypot(x, y), a = Math.atan2(y, x), b = blobRadius(a, phase);
  if (r < 0.5 * kInner * b) return 2;
  if (r < k * b) return 1;
  for (const [dx, dy, dr] of SPLAT_DROPS) if (Math.hypot(x - dx * k, y - dy * k) < dr * k * (1 + 0.15 * Math.sin(a * 4 + phase))) return 1;
  return 0;
}

/**
 * The splat's frame: n (the surface normal, unit), and u, v across it, turned by `angle` round n.
 * A right-handed orthonormal basis: u × v = n.
 */
export function decalBasis(normal, angle, u = new THREE.Vector3(), v = new THREE.Vector3()) {
  const n = normal;
  // the world axis least along n, so the frame never degenerates
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  const ref = ax <= ay && ax <= az ? _X : ay <= az ? _Y : _Z;
  const t = _t.crossVectors(ref, n).normalize(), b = _b.crossVectors(n, t);
  const c = Math.cos(angle), s = Math.sin(angle);
  u.copy(t).multiplyScalar(c).addScaledVector(b, s);
  v.crossVectors(n, u);
  return { u, v, n };
}
const _X = new THREE.Vector3(1, 0, 0), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
const _t = new THREE.Vector3(), _b = new THREE.Vector3();

/** Clip a polygon (flat [x, y, z, ...] in the splat's frame) to coordinate axis <= limit (sign 1) or >= -limit (sign -1). */
function clipAxis(poly, axis, sign, limit) {
  const out = [], n = poly.length / 3;
  if (!n) return out;
  const d = (i) => limit - sign * poly[i * 3 + axis];   // >= 0 inside
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, di = d(i), dj = d(j);
    if (di >= 0) out.push(poly[i * 3], poly[i * 3 + 1], poly[i * 3 + 2]);
    if ((di >= 0) !== (dj >= 0)) {
      const t = di / (di - dj);
      for (let k = 0; k < 3; k++) out.push(poly[i * 3 + k] + (poly[j * 3 + k] - poly[i * 3 + k]) * t);
    }
  }
  return out;
}

/**
 * A triangle (in the splat's frame) clipped to the box |x| <= hx, |y| <= hy, -back <= z <= front.
 * Returns the polygon left (flat [x, y, z, ...], 0 or 3+ corners).
 */
export function clipTriangle(a, b, c, hx, hy, front, back) {
  let p = [...a, ...b, ...c];
  p = clipAxis(p, 0, 1, hx); p = clipAxis(p, 0, -1, hx);
  p = clipAxis(p, 1, 1, hy); p = clipAxis(p, 1, -1, hy);
  p = clipAxis(p, 2, 1, front); p = clipAxis(p, 2, -1, back);
  return p.length >= 9 ? p : [];
}

/**
 * The triangles that may reach into a splat's box, as drawn: the static meshes on screen there
 * (`drawn`, a DrawnSurfaces) and the ground heightfield's own (physics.base: the Terrain's grid
 * triangles when it has them, else a grid laid on heightAt). Where the drawn world has nothing
 * (no scene given), the collision BVH's (physics.bvh.shapecast): it is baked from the drawn meshes,
 * but in places from coarser hidden stand-ins (a dome's collider, a trunk's), so a splat on those
 * could hide inside the drawn surface or float off it.
 * Returns a flat Float32Array [ax, ay, az, bx, ..., cz] per triangle, with .oneSided (a Uint8Array,
 * 1 per triangle drawn one-sided: its winding says which way it faces; 0 double-sided or unknown).
 */
export function gatherTriangles(physics, center, basis, hx, hy, front, back, { drawn = null, max = 4000 } = {}) {
  const box = splatBox(center, basis, hx, hy, front, back);
  const out = [], sides = [];
  if (drawn) drawn.gather(box, out, max, sides);
  const base = physics?.base;
  if (base?.heightAt && out.length < max * 9) heightfieldTriangles(base, box, out, max, sides);
  const bvh = physics?.bvh;
  if (!out.length && bvh?.shapecast) {
    const tb = new THREE.Box3();
    bvh.shapecast({
      intersectsBounds: (b) => b.intersectsBox(box),
      intersectsTriangle: (tri) => {
        tb.makeEmpty().expandByPoint(tri.a).expandByPoint(tri.b).expandByPoint(tri.c);
        if (!tb.intersectsBox(box)) return false;
        out.push(tri.a.x, tri.a.y, tri.a.z, tri.b.x, tri.b.y, tri.b.z, tri.c.x, tri.c.y, tri.c.z);
        sides.push(0);   // (the collision has no inside or outside)
        return out.length >= max * 9;
      },
    });
  }
  const tris = new Float32Array(out);
  tris.oneSided = Uint8Array.from(sides);
  return tris;
}
const _p = new THREE.Vector3();

/** The world box round a splat's box (its frame, half-sizes and depth). */
export function splatBox(center, basis, hx, hy, front, back, box = new THREE.Box3()) {
  const { u, v, n } = basis;
  box.makeEmpty();
  for (const sx of [-hx, hx]) for (const sy of [-hy, hy]) for (const sz of [-back, front])
    box.expandByPoint(_p.copy(center).addScaledVector(u, sx).addScaledVector(v, sy).addScaledVector(n, sz));
  return box;
}

/**
 * One geometry's triangles (as drawn: its index and draw range) that reach into a world box, pushed in
 * world space, wound as they face (a mirroring matrix turns them back); sides gets `side` per triangle.
 */
export function trianglesInBox(geo, matrix, box, out, max = 4000, sides = null, side = 0) {
  const P = geo.attributes.position, idx = geo.index;
  const total = idx ? idx.count : P.count;
  const start = Math.max(0, geo.drawRange.start), end = Math.min(total, start + geo.drawRange.count);
  if (end - start < 3) return;
  // the box in the geometry's own space (its bounds there)
  const lb = _lb.copy(box).applyMatrix4(_inv.copy(matrix).invert());
  const x0 = lb.min.x, y0 = lb.min.y, z0 = lb.min.z, x1 = lb.max.x, y1 = lb.max.y, z1 = lb.max.z;
  const inter = P.isInterleavedBufferAttribute, A = inter ? P.data.array : P.array, st = inter ? P.data.stride : 3, off = inter ? P.offset : 0, I = idx?.array;
  const e = matrix.elements, mirror = matrix.determinant() < 0;
  const put = (x, y, z) => out.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
  for (let i = start; i + 2 < end; i += 3) {
    const a = (I ? I[i] : i) * st + off, b = (I ? I[i + 1] : i + 1) * st + off, c = (I ? I[i + 2] : i + 2) * st + off;
    const ax = A[a], bx = A[b], cx = A[c];
    if ((ax < x0 && bx < x0 && cx < x0) || (ax > x1 && bx > x1 && cx > x1)) continue;
    const ay = A[a + 1], by = A[b + 1], cy = A[c + 1];
    if ((ay < y0 && by < y0 && cy < y0) || (ay > y1 && by > y1 && cy > y1)) continue;
    const az = A[a + 2], bz = A[b + 2], cz = A[c + 2];
    if ((az < z0 && bz < z0 && cz < z0) || (az > z1 && bz > z1 && cz > z1)) continue;
    put(ax, ay, az);
    if (mirror) { put(cx, cy, cz); put(bx, by, bz); } else { put(bx, by, bz); put(cx, cy, cz); }
    sides?.push(side);
    if (out.length >= max * 9) return;
  }
}
const _inv = new THREE.Matrix4(), _lb = new THREE.Box3(), _im = new THREE.Matrix4(), _ws = new THREE.Sphere(), _bc = new THREE.Vector3();

/**
 * The scene's static drawn surfaces, for splats to land on: every mesh that stands still (not
 * skinned, not flagged dynamic, not plants, water, lights or the like), found once and again when
 * the scene changes. A mesh that has moved since it was found (a vehicle, someone's gear) is
 * passed over, as are hidden ones (the collision stand-ins, rooms off the map).
 * exclude(mesh): leave more out (the ground's own mesh: its triangles come exactly from its heightfield).
 */
export class DrawnSurfaces {
  constructor(scene, { exclude = null } = {}) { this.scene = scene; this.exclude = exclude; this.items = null; this.n = -1; }
  collect() {
    const items = [];
    this.scene.updateMatrixWorld();
    this.scene.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.geometry?.attributes?.position) return;
      for (let p = o; p; p = p.parent) if (p.userData.dynamic || p.userData.flora || p.userData.noSplat) return;
      const m = o.material, U = m?.uniforms;
      if (!m || m.allowOverride === false || m.transparent || m.wireframe || (U?.uGlow?.value ?? 0) >= 0.8 || U?.uMode?.value === 3) return;
      if (this.exclude?.(o)) return;
      items.push({ o, m: o.matrixWorld.clone() });
    });
    this.items = items;
    this.n = this.scene.children.length;
  }
  gather(box, out, max = 4000, sides = null) {
    if (!this.items || this.n !== this.scene.children.length) this.collect();
    const c = box.getCenter(_bc), r = box.max.distanceTo(box.min) / 2;
    for (const it of this.items) {
      const o = it.o, g = o.geometry;
      if (!o.matrixWorld.equals(it.m)) continue;   // it moved since: not a surface to paint
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (o.isInstancedMesh) {
        if (!o.count) continue;
        if (o.boundingSphere && _ws.copy(o.boundingSphere).applyMatrix4(o.matrixWorld).distanceToPoint(c) > r) continue;
      } else if (_ws.copy(g.boundingSphere).applyMatrix4(o.matrixWorld).distanceToPoint(c) > r) continue;
      let shown = true;
      for (let p = o; p; p = p.parent) if (!p.visible) { shown = false; break; }
      if (!shown) continue;
      const side = o.material.side === THREE.FrontSide ? 1 : 0;   // drawn one-sided: its back is never seen
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, _im); _im.premultiply(o.matrixWorld);
          if (_ws.copy(g.boundingSphere).applyMatrix4(_im).distanceToPoint(c) > r) continue;
          trianglesInBox(g, _im, box, out, max, sides, side);
        }
      } else trianglesInBox(g, o.matrixWorld, box, out, max, sides, side);
      if (out.length >= max * 9) return;
    }
  }
}

/**
 * Where the drawn surface is under a hit on the collision: along -normal from `reach` m in front
 * of it, the first of the triangles. Returns { point, normal } (the face's normal, turned to the
 * shot) or null when none is within 2 × reach.
 */
export function drawnHit(tris, point, normal, reach = 0.6) {
  const o = _o.copy(point).addScaledVector(normal, reach), ray = _ray.set(o, _d.copy(normal).negate());
  let best = Infinity, bn = null;
  for (let i = 0; i + 8 < tris.length; i += 9) {
    _ta.set(tris[i], tris[i + 1], tris[i + 2]); _tb.set(tris[i + 3], tris[i + 4], tris[i + 5]); _tc.set(tris[i + 6], tris[i + 7], tris[i + 8]);
    if (!ray.intersectTriangle(_ta, _tb, _tc, false, _hit)) continue;
    const t = _hit.distanceTo(o);
    if (t < best) { best = t; bn = _fn.subVectors(_tb, _ta).cross(_e2.subVectors(_tc, _ta)).normalize().clone(); }
  }
  if (!bn || best > reach * 2) return null;
  if (bn.dot(normal) < 0) bn.negate();
  return { point: o.clone().addScaledVector(ray.direction, best), normal: bn };
}
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _ray = new THREE.Ray(), _hit = new THREE.Vector3(), _fn = new THREE.Vector3(), _e2 = new THREE.Vector3();
const _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tc = new THREE.Vector3();

/** The heightfield's triangles under a world box (pushed into out). */
export function heightfieldTriangles(base, box, out, max = 4000, sides = null) {
  const push = (x0, z0, x1, z1, x2, z2, h) => {
    const y0 = h(x0, z0), y1 = h(x1, z1), y2 = h(x2, z2);
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) return;
    if (Math.max(y0, y1, y2) < box.min.y || Math.min(y0, y1, y2) > box.max.y) return;
    out.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);   // (wound to face up)
    sides?.push(1);
  };
  if (base.heights && base.step && base.n && base.size) {
    // the drawn terrain's own triangles (world.js Terrain: a, c, b and b, c, d per cell)
    const half = base.size / 2, st = base.step, n = base.n, H = base.heights;
    const i0 = Math.max(0, Math.floor((box.min.x + half) / st)), i1 = Math.min(base.seg - 1, Math.floor((box.max.x + half) / st));
    const j0 = Math.max(0, Math.floor((box.min.z + half) / st)), j1 = Math.min(base.seg - 1, Math.floor((box.max.z + half) / st));
    const at = (ix, iz) => H[iz * n + ix];
    for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
      if (out.length >= max * 9) return;
      const x0 = -half + ix * st, z0 = -half + iz * st, x1 = x0 + st, z1 = z0 + st;
      const h = (x, z) => at(Math.round((x + half) / st), Math.round((z + half) / st));
      push(x0, z0, x0, z1, x1, z0, h);   // a, c, b
      push(x1, z0, x0, z1, x1, z1, h);   // b, c, d
    }
    return;
  }
  // any other heightfield: a fine grid laid on it
  const sx = box.max.x - box.min.x, sz = box.max.z - box.min.z;
  const N = Math.max(2, Math.min(24, Math.ceil(Math.max(sx, sz) / 0.25)));
  const h = (x, z) => base.heightAt(x, z);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (out.length >= max * 9) return;
    const x0 = box.min.x + (sx * i) / N, x1 = box.min.x + (sx * (i + 1)) / N, z0 = box.min.z + (sz * j) / N, z1 = box.min.z + (sz * (j + 1)) / N;
    push(x0, z0, x0, z1, x1, z0, h);
    push(x1, z0, x0, z1, x1, z1, h);
  }
}

/**
 * Project a splat onto triangles (gatherTriangles' flat array).
 * @param o.center    the hit point
 * @param o.basis     decalBasis(normal, angle)
 * @param o.sx, o.sy  the splat's size along u and v (m): one unit of its shape
 * @param o.front, o.back  how far the box reaches in front of / behind the hit point along n (m)
 * @param o.minFacing triangles more side-on to the shot than this (|cos|) are left out (the shape is laid out by
 *                    true distance from the hit, so steep faces take it at its size: only the edge-on are left out)
 * @param o.occlude   leave out what the other triangles hide from the shot (along n, within the box):
 *                    the back of a thin wall, the ground under a rock's overhang. Tested piece by piece
 *                    (each face is cut into a grid of cells first), so a rock on the ground hides only
 *                    the ground under it
 * @param o.occluded  (point, n, far) => true: an extra test of the same kind (a ray from each piece)
 * Returns { positions, normals, coords, count } (count corners, three per triangle): coords are the
 * corners' spots in the splat's shape (x / sx, y / sy).
 */
export function projectSplat(tris, { center, basis, sx, sy, front, back, minFacing = 0.06, occlude = true, occluded = null, oneSided = tris.oneSided ?? null, reach = SPLAT_REACH, cells = 4, refine = 3 }) {
  const { u, v, n } = basis;
  const hx = sx * reach, hy = sy * reach;
  const T = tris.length / 9 | 0;
  // every corner in the splat's frame
  const L = new Float32Array(T * 9);
  for (let i = 0; i < T * 3; i++) {
    const dx = tris[i * 3] - center.x, dy = tris[i * 3 + 1] - center.y, dz = tris[i * 3 + 2] - center.z;
    L[i * 3] = dx * u.x + dy * u.y + dz * u.z; L[i * 3 + 1] = dx * v.x + dy * v.y + dz * v.z; L[i * 3 + 2] = dx * n.x + dy * n.y + dz * n.z;
  }
  const inBox = new Uint8Array(T);
  for (let t = 0; t < T; t++) {
    const o = t * 9;
    const xa = L[o], xb = L[o + 3], xc = L[o + 6], ya = L[o + 1], yb = L[o + 4], yc = L[o + 7], za = L[o + 2], zb = L[o + 5], zc = L[o + 8];
    inBox[t] = !(Math.max(xa, xb, xc) < -hx || Math.min(xa, xb, xc) > hx || Math.max(ya, yb, yc) < -hy || Math.min(ya, yb, yc) > hy
      || Math.max(za, zb, zc) < -back || Math.min(za, zb, zc) > front + 0.05) ? 1 : 0;
  }
  // the occluders filed by grid cell (their bounds across the splat's plane)
  const G = cells, cw = (2 * hx) / G, ch = (2 * hy) / G;
  const cellX = (x) => Math.min(G - 1, Math.max(0, Math.floor((x + hx) / cw))), cellY = (y) => Math.min(G - 1, Math.max(0, Math.floor((y + hy) / ch)));
  let grid = null;
  if (occlude) {
    grid = Array.from({ length: G * G }, () => []);
    for (let t = 0; t < T; t++) {
      if (!inBox[t]) continue;
      const o = t * 9;
      const i0 = cellX(Math.min(L[o], L[o + 3], L[o + 6])), i1 = cellX(Math.max(L[o], L[o + 3], L[o + 6]));
      const j0 = cellY(Math.min(L[o + 1], L[o + 4], L[o + 7])), j1 = cellY(Math.max(L[o + 1], L[o + 4], L[o + 7]));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * G + i].push(t);
    }
  }
  /** Does a triangle other than `self` lie over (x, y) between z and the box's front? */
  const hidden = (x, y, z, self) => {
    for (const t of grid[cellY(y) * G + cellX(x)]) {
      if (t === self) continue;
      const o = t * 9, ax = L[o], ay = L[o + 1], bx = L[o + 3] - ax, by = L[o + 4] - ay, cx = L[o + 6] - ax, cy = L[o + 7] - ay;
      const det = bx * cy - by * cx;
      if (Math.abs(det) < 1e-9) continue;   // side-on: covers no area across the plane
      const px = x - ax, py = y - ay, s = (px * cy - py * cx) / det, r = (bx * py - by * px) / det;
      if (s < -1e-4 || r < -1e-4 || s + r > 1 + 1e-4) continue;
      const zt = L[o + 2] + s * (L[o + 5] - L[o + 2]) + r * (L[o + 8] - L[o + 2]);
      if (zt > z + 0.01 && zt <= front + 0.05) return true;
    }
    return false;
  };
  /** Could any other triangle lie over this face's bounds (across the plane, and in front of its lowest point)? */
  const overlapped = (self, x0, x1, y0, y1, z0, i0, i1, j0, j1) => {
    const e = 1e-3;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const t of grid[j * G + i]) {
      if (t === self) continue;
      const o = t * 9;
      if (Math.max(L[o + 2], L[o + 5], L[o + 8]) <= z0 + 0.01) continue;
      if (Math.max(L[o], L[o + 3], L[o + 6]) <= x0 + e || Math.min(L[o], L[o + 3], L[o + 6]) >= x1 - e) continue;
      if (Math.max(L[o + 1], L[o + 4], L[o + 7]) <= y0 + e || Math.min(L[o + 1], L[o + 4], L[o + 7]) >= y1 - e) continue;
      // side-on faces cover nothing
      const bx = L[o + 3] - L[o], by = L[o + 4] - L[o + 1], cx = L[o + 6] - L[o], cy = L[o + 7] - L[o + 1];
      if (Math.abs(bx * cy - by * cx) < 1e-9) continue;
      return true;
    }
    return false;
  };
  const P = [], N = [], C = [];
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), w = new THREE.Vector3();
  const emit = (poly, flip, wn) => {
    const k = poly.length / 3;
    for (let i = 1; i + 1 < k; i++) {
      // (a cut along a cell's edge through a corner leaves slivers with no area)
      const ux = poly[i * 3] - poly[0], uy = poly[i * 3 + 1] - poly[1], vx = poly[i * 3 + 3] - poly[0], vy = poly[i * 3 + 4] - poly[1];
      const uz = poly[i * 3 + 2] - poly[2], vz = poly[i * 3 + 5] - poly[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz < 1e-14) continue;
      const ids = flip ? [0, i + 1, i] : [0, i, i + 1];
      for (const id of ids) {
        const x = poly[id * 3], y = poly[id * 3 + 1], z = poly[id * 3 + 2];
        P.push(center.x + u.x * x + v.x * y + n.x * z, center.y + u.y * x + v.y * y + n.y * z, center.z + u.z * x + v.z * y + n.z * z);
        N.push(wn[0], wn[1], wn[2]);
        // its spot in the shape, at its true distance from the hit (not its shadow on the plane): over a
        // fold or round a curve the blob keeps its size instead of stretching out to the box's sides
        const rp = Math.hypot(x, y), k = rp > 1e-6 ? Math.hypot(rp, z) / rp : 1;
        C.push((x / sx) * k, (y / sy) * k);
      }
    }
  };
  const middle = (poly) => {
    const k = poly.length / 3;
    let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < k; i++) { mx += poly[i * 3]; my += poly[i * 3 + 1]; mz += poly[i * 3 + 2]; }
    return [mx / k, my / k, mz / k];
  };
  const seen = (x, y, z, self) => {
    if (grid && hidden(x, y, z, self)) return false;
    if (occluded) {
      w.copy(center).addScaledVector(u, x).addScaledVector(v, y).addScaledVector(n, z + 0.02);
      if (occluded(w, n, front - z + 0.02)) return false;
    }
    return true;
  };
  /**
   * Keep what of a piece the shot sees: its middle and its corners (a little inside) are tested;
   * if they disagree (an occluder's edge crosses it) it is cut in four and each quarter tested again,
   * down to `depth` more times (a few centimetres), so a rock on the ground leaves no gap round its foot.
   */
  const place = (poly, self, flip, wn, depth) => {
    const [mx, my, mz] = middle(poly), k = poly.length / 3;
    const vm = seen(mx, my, mz, self);
    let mixed = false;
    if (depth > 0) for (let i = 0; i < k && !mixed; i++) {
      const x = poly[i * 3] + (mx - poly[i * 3]) * 0.1, y = poly[i * 3 + 1] + (my - poly[i * 3 + 1]) * 0.1, z = poly[i * 3 + 2] + (mz - poly[i * 3 + 2]) * 0.1;
      if (seen(x, y, z, self) !== vm) mixed = true;
    }
    if (!mixed) { if (vm) emit(poly, flip, wn); return; }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < poly.length; i += 3) { x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]); y0 = Math.min(y0, poly[i + 1]); y1 = Math.max(y1, poly[i + 1]); }
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    for (const [sxn, sxl] of [[1, xm], [-1, -xm]]) {
      const half = clipAxis(poly, 0, sxn, sxl);
      if (half.length < 9) continue;
      for (const [syn, syl] of [[1, ym], [-1, -ym]]) {
        const q = clipAxis(half, 1, syn, syl);
        if (q.length >= 9) place(q, self, flip, wn, depth - 1);
      }
    }
  };
  for (let t = 0; t < T; t++) {
    if (!inBox[t]) continue;
    const o = t * 9;
    a[0] = L[o]; a[1] = L[o + 1]; a[2] = L[o + 2]; b[0] = L[o + 3]; b[1] = L[o + 4]; b[2] = L[o + 5]; c[0] = L[o + 6]; c[1] = L[o + 7]; c[2] = L[o + 8];
    // its normal in the splat's frame, turned towards the shot (the collision is double-sided)
    e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    fn.crossVectors(e1, e2);
    const len = fn.length();
    if (len < 1e-10) continue;
    fn.divideScalar(len);
    const single = oneSided?.[t] === 1;
    let flip = false;
    if (fn.z < 0) {
      if (single) continue;   // drawn one-sided and facing away from the shot: its back, never seen (a thin wall's far side)
      fn.negate(); flip = true;
    }
    if (fn.z < minFacing) continue;
    const poly = clipTriangle(a, b, c, hx, hy, front, back);
    if (!poly.length) continue;
    const wn = [u.x * fn.x + v.x * fn.y + n.x * fn.z, u.y * fn.x + v.y * fn.y + n.y * fn.z, u.z * fn.x + v.z * fn.y + n.z * fn.z];
    // a one-sided face turned to the shot is seen (what might lie over it in front is the same solid's
    // other side, or a fold of it): only the double-sided (the collision's) are tested for what hides them
    if (single || (!grid && !occluded)) { emit(poly, flip, wn); continue; }
    // a face over more than one cell is cut along the grid, so each piece is tested on its own
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity;
    for (let i = 0; i < poly.length; i += 3) { x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]); y0 = Math.min(y0, poly[i + 1]); y1 = Math.max(y1, poly[i + 1]); z0 = Math.min(z0, poly[i + 2]); }
    const i0 = cellX(x0), i1 = cellX(x1 - 1e-7), j0 = cellY(y0), j1 = cellY(y1 - 1e-7);
    // nothing over it at all (most faces): whole, uncut
    if (!occluded && !overlapped(t, x0, x1, y0, y1, z0, i0, i1, j0, j1)) { emit(poly, flip, wn); continue; }
    if (i0 === i1 && j0 === j1) { place(poly, t, flip, wn, refine); continue; }
    for (let i = i0; i <= i1; i++) {
      let col = poly;
      if (i > i0) col = clipAxis(col, 0, -1, -(-hx + i * cw));
      if (i < i1) col = clipAxis(col, 0, 1, -hx + (i + 1) * cw);
      if (col.length < 9) continue;
      for (let j = j0; j <= j1; j++) {
        let piece = col;
        if (j > j0) piece = clipAxis(piece, 1, -1, -(-hy + j * ch));
        if (j < j1) piece = clipAxis(piece, 1, 1, -hy + (j + 1) * ch);
        if (piece.length >= 9) place(piece, t, flip, wn, refine);
      }
    }
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N), coords: new Float32Array(C), count: P.length / 3 };
}

/** A flat square in the splat's plane (where nothing could be gathered: no collision to project on). */
export function flatSplat({ center, basis, sx, sy, lift = 0.03, reach = SPLAT_REACH }) {
  const { u, v, n } = basis, P = [], N = [], C = [];
  const corner = (x, y) => {
    P.push(center.x + u.x * x * sx + v.x * y * sy + n.x * lift, center.y + u.y * x * sx + v.y * y * sy + n.y * lift, center.z + u.z * x * sx + v.z * y * sy + n.z * lift);
    N.push(n.x, n.y, n.z); C.push(x, y);
  };
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) corner(x * reach, y * reach);
  return { positions: new Float32Array(P), normals: new Float32Array(N), coords: new Float32Array(C), count: 6 };
}

/**
 * The splats' material: the surface shader (flat colour, self-lit like the old splats) with the
 * shape drawn in the fragment: per corner aSplat = (x, y, born, life) and aSplat2 = (phase, inner
 * tone r, g, b); uSplatTime is the splats' clock. Outside the shape grown to its age it discards;
 * the inner blob takes the second tone (no second layer to fight the first).
 */
export function splatMaterial() {
  const base = makeMaterial({ color: '#ffffff', flat: true, glow: 0.55, side: THREE.DoubleSide, vertexColors: true });
  const drops = SPLAT_DROPS.map(([x, y, r]) => `vec3(${x.toFixed(5)}, ${y.toFixed(5)}, ${r.toFixed(5)})`).join(', ');
  const vs = patch(base.vertexShader, [
    ['void main() {', 'in vec4 aSplat;\n  in vec4 aSplat2;\n  out vec4 vSplat;\n  out vec4 vSplat2;\n  void main() {\n    vSplat = aSplat; vSplat2 = aSplat2;'],
  ]);
  const fs = patch(base.fragmentShader, [
    ['void main() {', /* glsl */ `in vec4 vSplat;
  in vec4 vSplat2;
  uniform float uSplatTime;
  const vec3 SPLAT_DROPS[5] = vec3[5](${drops});
  float splatGrowth(float t, float life) {
    float grow = t < 0.14 ? sin(t / 0.14 * 3.14159265 * 0.62) / sin(3.14159265 * 0.62) * 1.12 : 1.12 - 0.12 * min(1.0, (t - 0.14) / 0.2);
    return max(0.0, grow * (1.0 - smoothstep(life - 1.1, life, t)));
  }
  float splatBlob(float a, float ph) {
    return 1.0 + 0.32 * (0.5 * sin(a * 3.0 + ph) + 0.3 * sin(a * 5.0 + ph * 2.0) + 0.14 * sin(a * 7.0 + ph * 3.1));
  }
  void main() {
    vec2 sp = vSplat.xy;
    float sAge = uSplatTime - vSplat.z, sK = splatGrowth(sAge, vSplat.w), sKi = splatGrowth(sAge, vSplat.w * 0.85);
    float sR = length(sp), sA = atan(sp.y, sp.x), sB = splatBlob(sA, vSplat2.x);
    float splatInner = sR < 0.5 * sKi * sB ? 1.0 : 0.0;
    bool sIn = sR < sK * sB;
    for (int i = 0; i < 5; i++) sIn = sIn || length(sp - SPLAT_DROPS[i].xy * sK) < SPLAT_DROPS[i].z * sK * (1.0 + 0.15 * sin(sA * 4.0 + vSplat2.x));
    if (!sIn && splatInner < 0.5) discard;`],
    ['vec3 instColor = vInstColor;', 'vec3 instColor = mix(vInstColor, vSplat2.yzw, splatInner);'],
  ]);
  const mat = new THREE.ShaderMaterial({
    glslVersion: base.glslVersion, vertexShader: vs, fragmentShader: fs, side: base.side,
    uniforms: { ...base.uniforms, uSplatTime: { value: 0 } },   // (the shared uniforms stay the same objects)
    defines: { ...base.defines },
  });
  mat.vertexColors = true;
  // on the surface itself: pulled in front of it in depth, not lifted off it
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -4;
  return mat;
}

/** Replace each [find, with] once; throws if the surface shader no longer has the line (tests catch it). */
function patch(src, pairs) {
  for (const [find, repl] of pairs) {
    if (!src.includes(find)) throw new Error(`splatMaterial: the surface shader has no "${find}" any more`);
    src = src.replace(find, repl);
  }
  return src;
}
