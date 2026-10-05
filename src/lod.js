import * as THREE from 'three';

// Levels of detail: a distant building, rock or tree drawn with fewer triangles.
//
// simplify(): vertex clustering on a grid (Rossignac & Borrel), with each cell's
// vertex placed where it best fits the planes of the triangles around it (a quadric,
// as in Lindstrom's out-of-core simplification), so corners and edges stay where they
// were instead of rounding off. Every vertex in a cell moves to the same point, so
// surfaces that met still meet (no cracks); vertices are only kept apart when their
// normals (26 directions) or other attributes differ, so hard edges, colours and the
// shader's own attributes are never blended. Triangles with two corners in one cell
// disappear. The error is under a cell: a level whose cell is under a pixel on screen
// looks the same, outline included (the ink pass draws the silhouette).
//
// LodManager: every static mesh worth it (merged blocks, kits, rocks, instanced props)
// gets levels whose cells double: 2^j units in the mesh's own space. Each frame its
// distance from the camera says how big a cell may be (`px` pixels: the preset's
// lodPx), and the mesh draws the coarsest level that fits, by swapping its geometry:
// no extra objects or draw calls, the instances, materials and visibility untouched.
// A switch waits for the distance to pass the threshold by ~10 % (no flicker on the
// edge); levels are built the first time they are wanted, a few milliseconds a frame.
// Shadow passes may go coarser still: a level whose cell is under a texel of the map
// casts the same shadow (shadowPass(texel) / viewPass()). Rendering only: the
// collision was baked from the full meshes at load, and a level's geometry points
// back at its source (userData.lodSource) for anything baked later (physics.js).

const MIN_CELL = 0.04;   // m: no level finer than this (it would save nothing)
const GRID_OFF = 0.3719;
const _n = new THREE.Vector3(), _w = new THREE.Vector3();

const triCount = (g) => {
  const n = g.index ? g.index.count : g.attributes.position?.count ?? 0;
  return Math.floor(Math.max(0, Math.min(n - g.drawRange.start, g.drawRange.count)) / 3);
};

/** One of 26 directions (each axis -, 0, +) for a normal: hard edges stay apart, smooth ones merge. */
function dirOf(x, y, z) {
  const l = Math.hypot(x, y, z) || 1, k = 0.38 * l;
  return (x > k ? 2 : x < -k ? 0 : 1) * 9 + (y > k ? 2 : y < -k ? 0 : 1) * 3 + (z > k ? 2 : z < -k ? 0 : 1);
}

/**
 * The part of a geometry its triangles use, as plain arrays (what the worker gets): positions,
 * the other attributes, triangles renumbered over just those vertices, and the lock.
 */
export function pack(geo, lock = null) {
  const P = geo.attributes.position, idx = geo.index?.array ?? null;
  const total = idx ? idx.length : P.count;
  const start = Math.min(geo.drawRange.start, total), end = Math.min(total, start + geo.drawRange.count);
  const nTri = Math.floor((end - start) / 3);
  const remap = new Int32Array(P.count).fill(-1), used = [];
  const tri = new Uint32Array(nTri * 3);
  for (let k = 0; k < nTri * 3; k++) {
    const v = idx ? idx[start + k] : start + k;
    let r = remap[v];
    if (r < 0) { r = remap[v] = used.length; used.push(v); }
    tri[k] = r;
  }
  const n = used.length;
  const read = (A) => {
    const s = A.itemSize, out = new Float32Array(n * s);
    if (!A.isInterleavedBufferAttribute && !A.normalized) {
      const a = A.array;
      for (let i = 0; i < n; i++) { const o = used[i] * s; for (let c = 0; c < s; c++) out[i * s + c] = a[o + c]; }
    } else {
      for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) out[i * s + c] = A.getComponent(used[i], c);
    }
    return out;
  };
  const attrs = [];
  for (const [name, A] of Object.entries(geo.attributes)) {
    if (name === 'position' || A.isInstancedBufferAttribute) continue;   // (per instance: the mesh keeps its own)
    attrs.push({ name, itemSize: A.itemSize, normalized: A.normalized, type: (A.isInterleavedBufferAttribute ? A.data.array : A.array).constructor.name, array: read(A) });
  }
  let lk = null;
  if (lock) { lk = new Uint8Array(n); for (let i = 0; i < n; i++) lk[i] = lock[used[i]]; }
  return { pos: read(P), tri, attrs, lock: lk };
}

/**
 * Line-like parts: connected pieces (vertices joined by triangles or by sharing a position)
 * longer than `cell` but thinner than it across (their vertices' spread round their long axis).
 * Returns null if none, else { rod: Int32Array (each vertex's rod, -1 for the rest),
 * axes: Float64Array (per rod: mean xyz, long axis xyz, two cross axes xyz), end: Uint8Array
 * (the vertices at either end of a rod) }.
 */
export function thinParts(P, T, cell) {
  const nV = P.length / 3, nTri = T.length / 3;
  // weld exact positions (merged flat meshes repeat a vertex for every triangle), then join along triangles
  const bits = new Int32Array(P.buffer, P.byteOffset, P.length);
  let size = 1024; while (size < nV * 2) size *= 2;
  const mask = size - 1, slot = new Int32Array(size).fill(-1), parent = new Int32Array(nV), canon = new Uint8Array(nV);
  for (let v = 0; v < nV; v++) {
    const x = bits[v * 3], y = bits[v * 3 + 1], z = bits[v * 3 + 2];
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & mask;
    for (;;) {
      const w = slot[h];
      if (w < 0) { slot[h] = v; parent[v] = v; canon[v] = 1; break; }
      if (bits[w * 3] === x && bits[w * 3 + 1] === y && bits[w * 3 + 2] === z) { parent[v] = w; break; }
      h = (h + 1) & mask;
    }
  }
  const find = (v) => { while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; } return v; };
  for (let t = 0; t < nTri; t++) {
    const a = find(T[t * 3]), b = find(T[t * 3 + 1]), c = find(T[t * 3 + 2]);
    if (a !== b) parent[b] = a;
    const r = find(a);
    if (r !== c) parent[c] = r;
  }
  // each part's spread (covariance of its distinct vertices): a rod has one long axis and is
  // thin across both others; a shell (a dome, a wall) is wide across two
  const root = new Int32Array(nV), part = new Int32Array(nV).fill(-1);
  let nP = 0;
  for (let v = 0; v < nV; v++) { const r = find(v); if (part[r] < 0) part[r] = nP++; root[v] = part[r]; }
  if (nP < 1) return null;
  const M = new Float64Array(nP * 10);   // n, sum x y z, sum xx xy xz yy yz zz
  for (let v = 0; v < nV; v++) {
    if (!canon[v]) continue;
    const m = root[v] * 10, x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    M[m]++; M[m + 1] += x; M[m + 2] += y; M[m + 3] += z;
    M[m + 4] += x * x; M[m + 5] += x * y; M[m + 6] += x * z; M[m + 7] += y * y; M[m + 8] += y * z; M[m + 9] += z * z;
  }
  // and its thickness: twice its volume over its area (a cylinder's radius, give or take; the
  // volume of the cones from its centre to its faces, so open tubes count too)
  const AV = new Float64Array(nP * 2);
  for (let t = 0; t < nTri; t++) {
    const p = root[T[t * 3]], m = p * 10, n = M[m] || 1, cx = M[m + 1] / n, cy = M[m + 2] / n, cz = M[m + 3] / n;
    const i = T[t * 3] * 3, j = T[t * 3 + 1] * 3, k = T[t * 3 + 2] * 3;
    const ax = P[i] - cx, ay = P[i + 1] - cy, az = P[i + 2] - cz, bx = P[j] - cx, by = P[j + 1] - cy, bz = P[j + 2] - cz, qx = P[k] - cx, qy = P[k + 1] - cy, qz = P[k + 2] - cz;
    const ux = bx - ax, uy = by - ay, uz = bz - az, wx = qx - ax, wy = qy - ay, wz = qz - az;
    AV[p * 2] += 0.5 * Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
    AV[p * 2 + 1] += (ax * (by * qz - bz * qy) + ay * (bz * qx - bx * qz) + az * (bx * qy - by * qx)) / 6;
  }
  const lineLike = new Int32Array(nP).fill(-1), axes = [];
  let any = false;
  for (let p = 0; p < nP; p++) {
    const m = p * 10, n = M[m];
    if (n < 4) continue;
    const thick = AV[p * 2] > 0 ? (2 * Math.abs(AV[p * 2 + 1])) / AV[p * 2] : 0;
    const mx = M[m + 1] / n, my = M[m + 2] / n, mz = M[m + 3] / n;
    const cxx = M[m + 4] / n - mx * mx, cxy = M[m + 5] / n - mx * my, cxz = M[m + 6] / n - mx * mz;
    const cyy = M[m + 7] / n - my * my, cyz = M[m + 8] / n - my * mz, czz = M[m + 9] / n - mz * mz;
    const tr = cxx + cyy + czz;
    if (!(tr > 0)) continue;
    // the largest eigenvalue, by power iteration
    let ax = 1, ay = 0.7, az = 0.4, l1 = 0;
    for (let k = 0; k < 24; k++) {
      const bx = cxx * ax + cxy * ay + cxz * az, by = cxy * ax + cyy * ay + cyz * az, bz = cxz * ax + cyz * ay + czz * az;
      l1 = Math.hypot(bx, by, bz);
      if (!(l1 > 0)) break;
      ax = bx / l1; ay = by / l1; az = bz / l1;
    }
    const across = Math.sqrt(Math.max(tr - l1, 0)), along = Math.sqrt(l1);   // ~ its radius; ~ its length / 3.5
    if (!(along * 3.4 > cell && thick * 2 < cell && along > across * 2.5)) continue;
    // two axes across it
    let ux = Math.abs(ax) < 0.9 ? 1 : 0, uy = ux ? 0 : 1, uz = 0;
    const d = ux * ax + uy * ay;
    ux -= d * ax; uy -= d * ay; uz -= d * az;
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const wx = ay * uz - az * uy, wy = az * ux - ax * uz, wz = ax * uy - ay * ux;
    lineLike[p] = axes.length / 12;
    axes.push(mx, my, mz, ax, ay, az, ux, uy, uz, wx, wy, wz);
    any = true;
  }
  if (!any) return null;
  const rod = new Int32Array(nV), A = Float64Array.from(axes), nR = A.length / 12;
  for (let v = 0; v < nV; v++) rod[v] = lineLike[root[v]];
  // each rod's two ends along its axis (they keep their place: it keeps its length)
  const ends = new Float64Array(nR * 2).fill(Infinity);
  for (let r = 0; r < nR; r++) ends[r * 2 + 1] = -Infinity;
  const along = (v, a) => (P[v * 3] - A[a]) * A[a + 3] + (P[v * 3 + 1] - A[a + 1]) * A[a + 4] + (P[v * 3 + 2] - A[a + 2]) * A[a + 5];
  for (let v = 0; v < nV; v++) {
    const r = rod[v];
    if (r < 0) continue;
    const t = along(v, r * 12);
    if (t < ends[r * 2]) ends[r * 2] = t;
    if (t > ends[r * 2 + 1]) ends[r * 2 + 1] = t;
  }
  const end = new Uint8Array(nV);
  for (let v = 0; v < nV; v++) {
    const r = rod[v];
    if (r < 0) continue;
    const t = along(v, r * 12), e = (ends[r * 2 + 1] - ends[r * 2]) * 1e-4 + 1e-6;
    if (t <= ends[r * 2] + e || t >= ends[r * 2 + 1] - e) end[v] = 1;
  }
  return { rod, axes: A, end };
}

/**
 * Vertex clustering over packed arrays (pack()); plain arrays out, or null when the result keeps
 * more than `minRatio` of the triangles (or none). Runs in the worker as well as here.
 */
export function cluster({ pos: P, tri: T, attrs, lock }, cell, minRatio = 1) {
  const nV = P.length / 3, nTri = T.length / 3;
  if (!(cell > 0) || nTri < 1) return null;
  const inv = 1 / cell;
  // 0. poles, cables, antennas, limbs: parts thinner than a cell but longer are only simplified
  //    along their length, never across (clustered on the grid they would fold into a line and
  //    vanish, and the ink draws them): cells along the rod's axis and eight sectors round it
  const thin = thinParts(P, T, cell);
  const N = attrs.find((a) => a.name === 'normal' && a.itemSize === 3)?.array ?? null;
  const others = attrs.filter((a) => a.name !== 'normal');

  // (a rod's slices along its axis, and each slice's centre: the sectors turn round that, so a
  // sagging cable keeps its whole cross-section all along)
  let slice = null, sliceC = null;
  if (thin) {
    slice = new Int32Array(nV); sliceC = new Map();
    const A = thin.axes;
    for (let v = 0; v < nV; v++) {
      const r = thin.rod[v];
      if (r < 0) continue;
      const a = r * 12, b = Math.floor(((P[v * 3] - A[a]) * A[a + 3] + (P[v * 3 + 1] - A[a + 1]) * A[a + 4] + (P[v * 3 + 2] - A[a + 2]) * A[a + 5]) * inv + GRID_OFF);
      slice[v] = b;
      const k = r * 4194304 + b;
      let c = sliceC.get(k);
      if (!c) sliceC.set(k, (c = [0, 0, 0, 0]));
      c[0] += P[v * 3]; c[1] += P[v * 3 + 1]; c[2] += P[v * 3 + 2]; c[3]++;
    }
  }
  // 1. each vertex's cell (locked ones: a cell of their own), through an open-addressed hash of (ix, iy, iz)
  const cellOf = new Int32Array(nV);
  let size = 1024; while (size < nV * 2) size *= 2;
  const mask = size - 1, slot = new Int32Array(size).fill(-1), KX = new Int32Array(nV), KY = new Int32Array(nV), KZ = new Int32Array(nV);
  let nCells = 0;
  for (let v = 0; v < nV; v++) {
    if ((lock && lock[v]) || (thin && thin.end[v])) { KX[nCells] = 0x7fffffff; cellOf[v] = nCells++; continue; }
    let ix, iy, iz;
    const r = thin ? thin.rod[v] : -1;
    if (r >= 0) {
      const A = thin.axes, a = r * 12, c = sliceC.get(r * 4194304 + slice[v]);
      const ox = P[v * 3] - c[0] / c[3], oy = P[v * 3 + 1] - c[1] / c[3], oz = P[v * 3 + 2] - c[2] / c[3];
      ix = 0x40000000 + r;
      iy = slice[v];
      iz = Math.floor((Math.atan2(ox * A[a + 9] + oy * A[a + 10] + oz * A[a + 11], ox * A[a + 6] + oy * A[a + 7] + oz * A[a + 8]) / (Math.PI * 2) + 1) * 8 + GRID_OFF) % 8;
    } else {
      // (the grid is offset by an odd fraction: modelled coordinates (0, whole and half metres) never sit on a cell edge,
      // where float noise would split coincident vertices into two cells and open a seam)
      ix = Math.floor(P[v * 3] * inv + GRID_OFF); iy = Math.floor(P[v * 3 + 1] * inv + GRID_OFF); iz = Math.floor(P[v * 3 + 2] * inv + GRID_OFF);
      if (Math.abs(ix) > 1e9 || Math.abs(iy) > 1e9 || Math.abs(iz) > 1e9 || !Number.isFinite(ix + iy + iz)) return null;
    }
    let h = (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & mask, c;
    for (;;) {
      c = slot[h];
      if (c < 0) { slot[h] = c = nCells; KX[c] = ix; KY[c] = iy; KZ[c] = iz; nCells++; break; }
      if (KX[c] === ix && KY[c] === iy && KZ[c] === iz) break;
      h = (h + 1) & mask;
    }
    cellOf[v] = c;
  }

  // 2. each cell's quadric (planes of its triangles, area-weighted), mean and bounds;
  //    the triangles that survive (corners in three different cells)
  const Q = new Float64Array(nCells * 10);   // a11 a12 a13 a22 a23 a33 b1 b2 b3 weight
  const S = new Float64Array(nCells * 4);    // sum of positions, count
  const B = new Float64Array(nCells * 6);    // bounds of the cell's vertices
  for (let c = 0; c < nCells; c++) { const b = c * 6; B[b] = B[b + 1] = B[b + 2] = Infinity; B[b + 3] = B[b + 4] = B[b + 5] = -Infinity; }
  for (let v = 0; v < nV; v++) {
    const c = cellOf[v], s = c * 4, b = c * 6, x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    S[s] += x; S[s + 1] += y; S[s + 2] += z; S[s + 3]++;
    if (x < B[b]) B[b] = x; if (y < B[b + 1]) B[b + 1] = y; if (z < B[b + 2]) B[b + 2] = z;
    if (x > B[b + 3]) B[b + 3] = x; if (y > B[b + 4]) B[b + 4] = y; if (z > B[b + 5]) B[b + 5] = z;
  }
  const keep = new Int32Array(nTri), kdir = new Uint8Array(nTri);
  let nKeep = 0;
  for (let t = 0; t < nTri; t++) {
    const v0 = T[t * 3], v1 = T[t * 3 + 1], v2 = T[t * 3 + 2];
    const ax = P[v0 * 3], ay = P[v0 * 3 + 1], az = P[v0 * 3 + 2];
    const bx = P[v1 * 3], by = P[v1 * 3 + 1], bz = P[v1 * 3 + 2];
    const cx = P[v2 * 3], cy = P[v2 * 3 + 1], cz = P[v2 * 3 + 2];
    // (c - b) x (a - b): three.js's face normal
    const ux = cx - bx, uy = cy - by, uz = cz - bz, wx = ax - bx, wy = ay - by, wz = az - bz;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const area = Math.hypot(nx, ny, nz);
    if (area > 0) {
      nx /= area; ny /= area; nz /= area;
      const d = -(nx * ax + ny * ay + nz * az), w = area;
      const a11 = w * nx * nx, a12 = w * nx * ny, a13 = w * nx * nz, a22 = w * ny * ny, a23 = w * ny * nz, a33 = w * nz * nz;
      const b1 = -w * d * nx, b2 = -w * d * ny, b3 = -w * d * nz;
      for (let j = 0; j < 3; j++) {
        const q = cellOf[T[t * 3 + j]] * 10;
        Q[q] += a11; Q[q + 1] += a12; Q[q + 2] += a13; Q[q + 3] += a22; Q[q + 4] += a23; Q[q + 5] += a33;
        Q[q + 6] += b1; Q[q + 7] += b2; Q[q + 8] += b3; Q[q + 9] += w;
      }
    }
    const c0 = cellOf[v0], c1 = cellOf[v1], c2 = cellOf[v2];
    if (c0 !== c1 && c1 !== c2 && c0 !== c2) { keep[nKeep] = t; kdir[nKeep++] = area > 0 ? dirOf(nx, ny, nz) : 13; }
  }
  if (nKeep === 0 || nKeep > nTri * minRatio) return null;

  // 3. each cell's point: the best fit to its planes, pulled to the mean where they don't decide it,
  //    and never outside the cell's own vertices (a locked vertex keeps its place)
  const cpos = new Float32Array(nCells * 3);
  for (let c = 0; c < nCells; c++) {
    const s = c * 4, n = S[s + 3] || 1, mx = S[s] / n, my = S[s + 1] / n, mz = S[s + 2] / n;
    const q = c * 10, w = Q[q + 9];
    let x = mx, y = my, z = mz;
    if (w > 0 && n > 1) {
      const lam = 1e-3 * (Q[q] + Q[q + 3] + Q[q + 5]) + 1e-12;
      const a11 = Q[q] + lam, a12 = Q[q + 1], a13 = Q[q + 2], a22 = Q[q + 3] + lam, a23 = Q[q + 4], a33 = Q[q + 5] + lam;
      const b1 = Q[q + 6] + lam * mx, b2 = Q[q + 7] + lam * my, b3 = Q[q + 8] + lam * mz;
      const c11 = a22 * a33 - a23 * a23, c12 = a13 * a23 - a12 * a33, c13 = a12 * a23 - a13 * a22;
      const det = a11 * c11 + a12 * c12 + a13 * c13, tr = a11 + a22 + a33;
      if (Math.abs(det) > 1e-14 * tr * tr * tr) {
        const c22 = a11 * a33 - a13 * a13, c23 = a12 * a13 - a11 * a23, c33 = a11 * a22 - a12 * a12;
        x = (c11 * b1 + c12 * b2 + c13 * b3) / det;
        y = (c12 * b1 + c22 * b2 + c23 * b3) / det;
        z = (c13 * b1 + c23 * b2 + c33 * b3) / det;
      }
      const b = c * 6;
      x = Math.min(Math.max(x, B[b]), B[b + 3]); y = Math.min(Math.max(y, B[b + 1]), B[b + 4]); z = Math.min(Math.max(z, B[b + 2]), B[b + 5]);
      if (!Number.isFinite(x + y + z)) { x = mx; y = my; z = mz; }
    }
    cpos[c * 3] = x; cpos[c * 3 + 1] = y; cpos[c * 3 + 2] = z;
  }

  // 4. output vertices: one per cell and look (normal direction and every other attribute's values)
  const sigOf = (v, faceDir) => {
    let h = N ? dirOf(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) : faceDir;
    for (const A of others) {
      const s = A.itemSize, a = A.array;
      for (let i = 0; i < s; i++) h = Math.imul(h ^ Math.round(a[v * s + i] * 64), 0x9e3779b1) >>> 0;
    }
    return h & 0x1fffff;
  };
  // (cell, look) pairs through a second hash
  let osz = 1024; while (osz < nKeep * 3) osz *= 2;
  const omask = osz - 1, oslot = new Int32Array(osz).fill(-1), OC = new Int32Array(nKeep * 3), OS = new Int32Array(nKeep * 3);
  const rep = new Int32Array(nKeep * 3);
  let nOut = 0;
  const out = new Uint32Array(nKeep * 3);
  for (let i = 0; i < nKeep; i++) {
    const t = keep[i];
    for (let j = 0; j < 3; j++) {
      const v = T[t * 3 + j], c = cellOf[v], sg = sigOf(v, kdir[i]);
      let h = (Math.imul(c, 0x9e3779b1) ^ Math.imul(sg, 0x85ebca6b)) & omask, o;
      for (;;) {
        o = oslot[h];
        if (o < 0) { oslot[h] = o = nOut++; OC[o] = c; OS[o] = sg; rep[o] = v; break; }
        if (OC[o] === c && OS[o] === sg) break;
        h = (h + 1) & omask;
      }
      out[i * 3 + j] = o;
    }
  }
  const ocell = OC;
  const pos = new Float32Array(nOut * 3);
  for (let o = 0; o < nOut; o++) { const c = ocell[o] * 3; pos[o * 3] = cpos[c]; pos[o * 3 + 1] = cpos[c + 1]; pos[o * 3 + 2] = cpos[c + 2]; }
  // normals: the mean of the merged vertices' (they share a direction); the rest: the first vertex's
  let nsum = null;
  if (N) {
    nsum = new Float32Array(nOut * 3);
    for (let i = 0; i < nKeep; i++) {
      const t = keep[i];
      for (let j = 0; j < 3; j++) { const v = T[t * 3 + j], o = out[i * 3 + j]; nsum[o * 3] += N[v * 3]; nsum[o * 3 + 1] += N[v * 3 + 1]; nsum[o * 3 + 2] += N[v * 3 + 2]; }
    }
    for (let o = 0; o < nOut; o++) {
      let x = nsum[o * 3], y = nsum[o * 3 + 1], z = nsum[o * 3 + 2], l = Math.hypot(x, y, z);
      if (!(l > 0)) { const v = rep[o]; x = N[v * 3]; y = N[v * 3 + 1]; z = N[v * 3 + 2]; l = Math.hypot(x, y, z) || 1; }
      nsum[o * 3] = x / l; nsum[o * 3 + 1] = y / l; nsum[o * 3 + 2] = z / l;
    }
  }
  const outAttrs = attrs.map((A) => {
    if (A.name === 'normal' && nsum) return { ...A, array: nsum };
    const s = A.itemSize, a = new Float32Array(nOut * s);
    for (let o = 0; o < nOut; o++) { const v = rep[o]; for (let i = 0; i < s; i++) a[o * s + i] = A.array[v * s + i]; }
    return { ...A, array: a };
  });
  return { pos, index: nOut < 65536 ? Uint16Array.from(out) : out, attrs: outAttrs, tris: nKeep, cell };
}

const TYPES = { Float32Array, Float64Array, Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array };
/** A geometry from cluster()'s arrays, with the source's bounds and a pointer back at it. */
export function unpack(r, src) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
  for (const A of r.attrs) {
    // back to the source's own array type (colours in bytes, ids in ints)
    const T = TYPES[A.type] ?? Float32Array;
    let arr = A.array;
    if (T !== Float32Array) {
      arr = new T(A.array.length);
      if (A.normalized) {
        const max = T === Uint8Array ? 255 : T === Uint16Array ? 65535 : T === Int8Array ? 127 : T === Int16Array ? 32767 : 1;
        for (let i = 0; i < arr.length; i++) arr[i] = Math.round(A.array[i] * max);
      } else arr.set(A.array.map(Math.round));
    }
    g.setAttribute(A.name, new THREE.BufferAttribute(arr, A.itemSize, A.normalized));
  }
  g.setIndex(new THREE.BufferAttribute(r.index, 1));
  if (!src.boundingBox) src.computeBoundingBox();
  if (!src.boundingSphere) src.computeBoundingSphere();
  g.boundingBox = src.boundingBox.clone();
  g.boundingSphere = src.boundingSphere.clone();
  g.userData.lodSource = src.userData.lodSource ?? src;
  g.userData.lodCell = r.cell;
  g.name = `${src.name || src.type} lod ${r.cell}`;
  return g;
}

/**
 * A simplified copy of `geo`: vertices clustered on a grid of `cell` (in the geometry's units).
 * @param o.lock  Uint8Array over source vertices: these keep their place (where tiles of one
 *                mesh meet: both sides keep the same border)
 * @param o.minRatio  null if the copy keeps more than this share of the triangles
 * @returns BufferGeometry (indexed, same attributes, the source's bounds,
 *          userData.lodSource = geo, userData.lodCell = cell) or null
 */
export function simplify(geo, cell, { lock = null, minRatio = 1 } = {}) {
  if (!geo.attributes.position || !(cell > 0)) return null;
  const r = cluster(pack(geo, lock), cell, minRatio);
  return r && unpack(r, geo);
}

// ------------------------------------------------------------------ choosing a level
/**
 * The level for a mesh `d` metres away: levels are cells of 2^j units (× `scale` metres per
 * unit), and a cell may be `px` pixels on screen (pxPerRad: pixels per radian). Keeps `cur`
 * while the distance is within ~10 % (2^hyst) of its range. Returns j (-Infinity: full detail).
 */
export function pickLevel(cur, d, scale, pxPerRad, px, { hyst = 0.15, min = -Infinity, max = Infinity } = {}) {
  if (!(px > 0) || !(d > 0)) return -Infinity;
  const x = Math.log2((d * px) / (pxPerRad * scale));   // the cell that fits, as a power of two
  let j = Math.floor(x);
  if (cur !== -Infinity && x >= cur - hyst && x < cur + 1 + hyst) j = cur;   // within its band: stay
  else if (cur === -Infinity && x < min + hyst) return -Infinity;            // only just far enough: stay full
  if (j < min) return -Infinity;
  return Math.min(j, max);
}

// ------------------------------------------------------------------ the manager
/** Vertices of a shared position buffer that more than one of these meshes use (the seams between tiles). */
function sharedVertices(meshes) {
  const P = meshes[0].geometry.attributes.position, owner = new Int32Array(P.count).fill(-1), lock = new Uint8Array(P.count);
  meshes.forEach((m, mi) => {
    const g = m.geometry, idx = g.index?.array;
    if (!idx) return;
    for (let k = 0; k < idx.length; k++) { const v = idx[k]; if (owner[v] === -1) owner[v] = mi; else if (owner[v] !== mi) lock[v] = 1; }
  });
  return lock;
}

/** Largest scale among an InstancedMesh's instances. */
function instanceScale(o) {
  let s = 0;
  const a = o.instanceMatrix.array;
  for (let i = 0; i < o.count; i++) {
    const e = i * 16;
    s = Math.max(s, Math.hypot(a[e], a[e + 1], a[e + 2]), Math.hypot(a[e + 4], a[e + 5], a[e + 6]), Math.hypot(a[e + 8], a[e + 9], a[e + 10]));
  }
  return s || 1;
}

const PENDING = Symbol('pending');

/**
 * Builds levels off the main thread (src/lod-worker.js) where there are workers, else here
 * within the frame's budget. A job is packed here (just the triangles' own vertices) and
 * comes back as arrays.
 */
class Builder {
  constructor(useWorker) {
    this.worker = null; this.jobs = new Map(); this.next = 1;
    if (useWorker && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./lod-worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = ({ data }) => { const job = this.jobs.get(data.id); this.jobs.delete(data.id); job?.(data.r); };
        this.worker.onerror = (e) => { console.warn('lod: the worker failed; building on the main thread', e.message ?? e); this.worker = null; for (const job of this.jobs.values()) job(undefined); this.jobs.clear(); };
      } catch (e) { this.worker = null; }
    }
  }
  get busy() { return this.jobs.size; }
  /** done(r): r = cluster() arrays, null (not worth it) or undefined (failed: try again later) */
  run(packed, cell, minRatio, done) {
    if (!this.worker) { done(cluster(packed, cell, minRatio)); return; }
    const id = this.next++;
    this.jobs.set(id, done);
    const transfer = [packed.pos.buffer, packed.tri.buffer, ...packed.attrs.map((a) => a.array.buffer)];
    if (packed.lock) transfer.push(packed.lock.buffer);
    this.worker.postMessage({ id, packed, cell, minRatio }, transfer);
  }
  dispose() { this.worker?.terminate(); this.worker = null; this.jobs.clear(); }
}

export class LodManager {
  /**
   * @param o.keep     roots whose meshes are left alone (the player, people, vehicles)
   * @param o.exclude  meshes left alone (the terrain: it is dug into at runtime)
   * @param o.minTris  meshes under this many triangles (instances included) aren't worth it
   * @param o.minEach  nor ones whose geometry has fewer than this
   * @param o.budget   ms a frame for packing (and, without a worker, building) levels
   * @param o.worker   build in a web worker where possible
   */
  constructor(scene, { keep = [], exclude = [], minTris = 400, minEach = 48, budget = 2, worker = true } = {}) {
    this.scene = scene; this.keep = new Set(keep.filter(Boolean)); this.exclude = new Set(exclude.filter(Boolean));
    this.minTris = minTris; this.minEach = minEach; this.budget = budget;
    this.entries = []; this.levels = new Map();   // full geometry → Map(j → geometry | null | PENDING)
    this.locks = new Map();                        // shared position attribute → the vertices on its tiles' seams
    this.queue = []; this.queued = new Set();
    this.builder = new Builder(worker);
    this.stats = { meshes: 0, switched: 0, built: 0, packMs: 0, pending: 0, saved: 0, coarse: 0 };
    this.n = -1;
  }

  kept(o) { for (let p = o; p; p = p.parent) if (this.keep.has(p) || p.userData.noLod) return true; return false; }

  /** (Re)collect the meshes worth levels; entries already known keep their state. */
  collect() {
    const known = new Map(this.entries.map((e) => [e.o, e]));
    const entries = [], byPos = new Map();
    this.scene.updateMatrixWorld();
    this.scene.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || this.exclude.has(o)) return;
      if (known.has(o)) { entries.push(known.get(o)); return; }
      const g = o.geometry, ud = o.userData;
      if (!g?.attributes?.position || ud.dynamic || g.userData.lodSource || Object.keys(g.morphAttributes).length || g.groups.length > 1) return;
      if (g.attributes.position.usage === THREE.DynamicDrawUsage) return;
      if (o.isInstancedMesh && (o.instanceMatrix.usage === THREE.DynamicDrawUsage || !o.frustumCulled)) return;
      if (o.material?.allowOverride === false || o.material?.wireframe || !(o.material?.isShaderMaterial || o.material?.isMeshStandardMaterial || o.material?.isMeshBasicMaterial || o.material?.isMeshLambertMaterial)) return;
      const each = triCount(g), total = each * (o.isInstancedMesh ? o.count : 1);
      if (each < this.minEach || total < this.minTris || this.kept(o)) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (o.isInstancedMesh && !o.boundingSphere) o.computeBoundingSphere();
      if (!g.boundingSphere || !Number.isFinite(g.boundingSphere.radius)) return;
      const r = g.boundingSphere.radius;
      const e = { o, full: g, cur: g, j: -Infinity, shadow: false, each, inst: o.isInstancedMesh ? instanceScale(o) : 1,
        min: Math.floor(Math.log2(Math.max(r / 4000, 1e-4))), max: Math.floor(Math.log2(Math.max(r * 0.35, 1e-4))), d: 0 };
      entries.push(e);
      const P = g.attributes.position;
      if (!byPos.has(P)) byPos.set(P, []);
      byPos.get(P).push(o);
    });
    // tiles of one mesh (perf.js tileScene) share its vertices: the ones on their seams stay put
    for (const [P, list] of byPos) if (list.length > 1 && new Set(list.map((m) => m.geometry)).size > 1 && !this.locks.has(P)) this.locks.set(P, sharedVertices(list));
    this.entries = entries;
    this.stats.meshes = entries.length;
    this.n = this.scene.children.length;
  }

  /** Level j of an entry: a geometry, null (not worth it), PENDING, or undefined (not asked for yet). */
  get(e, j) { return this.levels.get(e.full)?.get(j); }

  ask(e, j) {
    if (this.get(e, j) !== undefined || this.queued.has(`${e.full.id}:${j}`)) return;
    this.queued.add(`${e.full.id}:${j}`);
    this.queue.push([e, j]);
  }

  build(e, j) {
    this.queued.delete(`${e.full.id}:${j}`);
    let m = this.levels.get(e.full);
    if (!m) this.levels.set(e.full, (m = new Map()));
    if (m.has(j)) return;
    // a coarser level not worth it: neither is this one
    for (const [k, g] of m) if (k > j && g === null) { m.set(j, null); return; }
    m.set(j, PENDING);
    const t0 = performance.now();
    const packed = pack(e.full, this.locks.get(e.full.attributes.position) ?? null);
    this.stats.packMs += performance.now() - t0;
    this.builder.run(packed, 2 ** j, 0.8, (r) => {
      if (r === undefined) { m.delete(j); return; }   // the worker died: ask again
      const g = r ? unpack(r, e.full) : null;
      if (g) this.stats.built++;
      m.set(j, g);
    });
  }

  /** The coarsest ready level at or under j (the full geometry if none); asks for j if missing. */
  best(e, j) {
    if (j === -Infinity) return e.full;
    const m = this.levels.get(e.full);
    const g = m?.get(j);
    if (g === undefined) this.ask(e, j);
    if (g && g !== PENDING) return g;
    if (g === null) return e.full;
    if (m) for (let i = j - 1; i >= e.min; i--) { const f = m.get(i); if (f === null) break; if (f && f !== PENDING) return f; }
    return e.full;
  }

  /** The power-of-two cell (in the mesh's units) a distance allows. */
  want(e, d, sc, pxPerRad, px, cur) {
    return pickLevel(cur, d, sc, pxPerRad, px, { min: Math.max(e.min, Math.floor(Math.log2(MIN_CELL / sc))), max: e.max });
  }

  /**
   * Once a frame before rendering: each mesh's level for this view.
   * @param pxPerRad pixels per radian at the render resolution
   * @param px  how many pixels a cell may be (the preset's lodPx; 0 = full detail everywhere)
   */
  update(camera, pxPerRad, px) {
    if (this.n !== this.scene.children.length) this.collect();
    const cam = camera.position;
    let switched = 0, saved = 0, coarse = 0;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i], o = e.o;
      if (o.geometry !== e.cur) { this.entries.splice(i--, 1); continue; }   // someone else changed its geometry: theirs now
      if (!o.visible) continue;
      const s = o.isInstancedMesh ? o.boundingSphere : e.full.boundingSphere;
      if (!s || s.radius < 0) continue;
      const k = o.matrixWorld.getMaxScaleOnAxis();
      _w.copy(s.center).applyMatrix4(o.matrixWorld);
      const d = (e.d = Math.max(cam.distanceTo(_w) - s.radius * k, 0));
      e.j = px > 0 ? this.want(e, d, k * e.inst, pxPerRad, px, e.j) : -Infinity;
      const g = this.best(e, e.j);
      if (g !== o.geometry) { o.geometry = g; e.cur = g; switched++; }
      if (g !== e.full) { coarse++; saved += (e.each - triCount(g)) * (o.isInstancedMesh ? o.count : 1); }
    }
    this.pump();
    Object.assign(this.stats, { switched, saved, coarse, pending: this.queue.length + this.builder.busy });
  }

  /** Start the levels asked for: a few ms a frame, two in the worker at a time. */
  pump(budget = this.budget) {
    const t0 = performance.now();
    while (this.queue.length && this.builder.busy < 2 && performance.now() - t0 < budget) {
      const [e, j] = this.queue.pop();   // the latest asked first: what the view wants now
      this.build(e, j);
    }
  }

  /** Build everything waiting (measuring, tests); resolves once the worker is done too. */
  async flush() {
    for (;;) {
      while (this.queue.length) { const [e, j] = this.queue.pop(); this.build(e, j); if (this.builder.busy >= 4) break; }
      if (!this.queue.length && !this.builder.busy) return;
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  /**
   * Before a shadow pass whose texel is `texel` metres: what a texel can't show, the shadow
   * doesn't need (each mesh at least as coarse as in the view). viewPass() puts the view's back.
   */
  shadowPass(texel) {
    for (const e of this.entries) {
      const o = e.o;
      if (!o.visible || o.geometry !== e.cur) continue;
      const sc = o.matrixWorld.getMaxScaleOnAxis() * e.inst;
      const jt = Math.min(Math.floor(Math.log2(texel / sc)), e.max);
      if (jt < e.min || jt <= e.j) continue;
      const g = this.best(e, jt);
      if (g !== o.geometry) { o.geometry = g; e.cur = g; e.shadow = true; }
    }
  }
  viewPass() {
    for (const e of this.entries) {
      if (!e.shadow) continue;
      e.shadow = false;
      if (e.o.geometry !== e.cur) continue;
      e.o.geometry = e.cur = this.best(e, e.j);
    }
  }

  /** Everything back to full detail. */
  reset() {
    for (const e of this.entries) if (e.o.geometry === e.cur) { e.o.geometry = e.cur = e.full; e.j = -Infinity; }
  }

  dispose() {
    this.reset();
    this.builder.dispose();
    for (const m of this.levels.values()) for (const g of m.values()) if (g && g !== PENDING) g.dispose();
    this.levels.clear();
  }
}

// ------------------------------------------------------------------ the frame's scale, for those that pick their own detail
/** This frame's pixels per radian and the preset's lodPx (main.js sets them before rendering). */
export const lodView = { pxPerRad: 0, px: 0 };

/** How far (x radius) a closed convex mesh round the origin falls inside its sphere: its worst flat face. */
export function sphereError(geo) {
  const P = geo.attributes.position, idx = geo.index?.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  let r = 0, m = Infinity;
  for (let i = 0; i < P.count; i++) r = Math.max(r, a.fromBufferAttribute(P, i).length());
  const nT = (idx ? idx.length : P.count) / 3;
  for (let t = 0; t < nT; t++) {
    const v = (k) => (idx ? idx[t * 3 + k] : t * 3 + k);
    a.fromBufferAttribute(P, v(0)); b.fromBufferAttribute(P, v(1)); c.fromBufferAttribute(P, v(2));
    n.subVectors(c, b).cross(_w.subVectors(a, b));
    if (n.lengthSq() > 0) m = Math.min(m, Math.abs(n.normalize().dot(a)));
  }
  return r > 0 && Number.isFinite(m) ? 1 - m / r : 1;
}

// ------------------------------------------------------------------ one far geometry (instanced sets refilled each frame)
/**
 * For meshes that sort their own instances by distance (flora.js): a coarser copy of `geo`
 * that keeps at most `ratio` of the triangles, from the finest power-of-two cell that does,
 * no coarser than `maxCell`. Returns { geometry, cell } or null.
 */
export function farLevel(geo, { ratio = 0.55, minCell = 1 / 64, maxCell = 1 } = {}) {
  const full = triCount(geo);
  if (full < 24) return null;
  for (let c = minCell; c <= maxCell; c *= 2) {
    const g = simplify(geo, c);
    if (g && triCount(g) <= full * ratio) return { geometry: g, cell: c };
  }
  return null;
}

/** Hysteresis for one switch distance: far once past `d` × 1.1, near again under `d` / 1.1. */
export function farSide(wasFar, dist, d, hyst = 1.1) {
  return wasFar ? dist > d / hyst : dist > d * hyst;
}

export { triCount };
