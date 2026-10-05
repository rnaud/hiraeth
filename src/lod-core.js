// The array side of levels of detail (lod.js): vertex clustering over plain typed arrays, with no
// three.js, so the worker (lod-worker.js) that builds the levels stays small.

// the grid is offset by an odd fraction of a cell: modelled coordinates (0, whole and half metres)
// never sit on a cell's edge, where float noise would split coincident vertices into two cells
const GRID_OFF = 0.3719;

/** One of 26 directions (each axis -, 0, +) for a normal: hard edges stay apart, smooth ones merge. */
function dirOf(x, y, z) {
  const l = Math.hypot(x, y, z) || 1, k = 0.38 * l;
  return (x > k ? 2 : x < -k ? 0 : 1) * 9 + (y > k ? 2 : y < -k ? 0 : 1) * 3 + (z > k ? 2 : z < -k ? 0 : 1);
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
