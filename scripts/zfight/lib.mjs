// Z-fighting, found by geometry (.claude/skills/zfight-qc/SKILL.md, docs/systems/rendering.md "Z-fighting"):
// two faces of different materials that lie in the same plane and overlap draw in an order the depth buffer can't
// decide, so they flicker and stripe as the camera moves. This finds them from the triangles alone, no GPU: every
// triangle of every visible mesh in world space, bucketed by its plane, and each pair from two different materials
// whose planes are within `eps` m, facing the same way (or either drawn double-sided), and overlapping by more than
// `minArea` m² once projected into the plane. Plain objects in, plain objects out (tests/zfight.test.js).
//
//   const tris = trianglesOf(root, { THREE })        [{ a, b, c (world [x, y, z]), mat, mesh, side }]
//   const fights = coplanarOverlaps(tris, opts)      [{ meshA, meshB, matA, matB, area, at, normal }] (one per site)
//   visibleSites(fights, ray)                        the ones a player standing somewhere near could see
//   summarise(fights)                                { count, area, worst: [...] }

/** Every triangle of every visible mesh under `root`, in world space. Instanced meshes, points, lines, sprites and
 * anything invisible or `userData.zfightIgnore` are left out (moving pieces are dynamic: `userData.dynamic`, left
 * out unless `dynamic: true`). mat: the material's identity (a material per group when the mesh has several). */
export function trianglesOf(root, { THREE, dynamic = false, filter = null } = {}) {
  root.updateMatrixWorld(true);
  const out = [];
  const v = new THREE.Vector3();
  const seen = (o) => { for (let p = o; p; p = p.parent) if (p.visible === false || p.userData?.zfightIgnore) return false; return true; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry?.attributes?.position) return;
    if (!dynamic && o.userData?.dynamic) return;
    if (!seen(o) || (filter && !filter(o))) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every((m) => !m || m.visible === false || m.colorWrite === false)) return;
    const g = o.geometry, P = g.attributes.position, I = g.index;
    const n = I ? I.count : P.count;
    const groups = g.groups?.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
    const name = meshName(o);
    for (const gr of groups) {
      const m = mats[gr.materialIndex ?? 0] ?? mats[0];
      if (!m || m.visible === false || m.colorWrite === false) continue;
      const side = m.side ?? 0, offset = !!m.polygonOffset;
      // (a vertex-coloured material, the temples' paint: each colour is a look of its own)
      const C = m.vertexColors ? g.attributes.color : null;
      const end = Math.min(n, gr.start + gr.count);
      for (let i = gr.start; i + 2 < end; i += 3) {
        const t = [];
        for (let k = 0; k < 3; k++) { const idx = I ? I.getX(i + k) : i + k; v.fromBufferAttribute(P, idx).applyMatrix4(o.matrixWorld); t.push([v.x, v.y, v.z]); }
        const i0 = I ? I.getX(i) : i;
        const tint = C ? `:${C.getX(i0).toFixed(2)},${C.getY(i0).toFixed(2)},${C.getZ(i0).toFixed(2)}` : '';
        out.push({ a: t[0], b: t[1], c: t[2], mat: m.uuid + tint, mesh: name, side, offset, matName: (m.name || m.userData?.key || m.type) + tint });
      }
    }
  });
  return out;
}
function meshName(o) {
  const parts = [];
  for (let p = o; p && parts.length < 3; p = p.parent) if (p.name) parts.push(p.name);
  return `${parts.reverse().join(' / ') || o.type}#${o.id}`;
}

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];

/** A triangle's plane: unit normal n, offset d (n·p = d), its area. Null when degenerate. */
export function planeOf(t) {
  const n = cross(sub(t.b, t.a), sub(t.c, t.a)), l = Math.hypot(...n);
  if (l < 1e-9) return null;
  const u = [n[0] / l, n[1] / l, n[2] / l];
  return { n: u, d: dot(u, t.a), area: l / 2 };
}

/** The 2D polygon (in the plane's own basis) of a triangle. */
function basis(n) {
  const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(n, a), lu = Math.hypot(...u), U = [u[0] / lu, u[1] / lu, u[2] / lu];
  return [U, cross(n, U)];
}
const to2 = (p, [U, W]) => [dot(p, U), dot(p, W)];
function area2(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; }
/** Sutherland-Hodgman: the part of `subject` inside the convex, counter-clockwise `clip`. */
export function clipPolygon(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length];
    const inside = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]) >= -1e-9;
    const cut = (p, q) => { const x1 = p[0], y1 = p[1], x2 = q[0], y2 = q[1], dx = B[0] - A[0], dy = B[1] - A[1]; const den = (x2 - x1) * dy - (y2 - y1) * dx; const t = den === 0 ? 0 : ((A[0] - x1) * dy - (A[1] - y1) * dx) / den; return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]; };
    const inp = out; out = [];
    for (let k = 0; k < inp.length; k++) {
      const P = inp[k], Q = inp[(k + 1) % inp.length], pi = inside(P), qi = inside(Q);
      if (pi) { out.push(P); if (!qi) out.push(cut(P, Q)); } else if (qi) out.push(cut(P, Q));
    }
  }
  return out;
}
const ccw = (poly) => (area2(poly) < 0 ? poly.slice().reverse() : poly);
/** The area two coplanar triangles share (m²), in the plane of normal n. */
export function overlapArea(t1, t2, n) {
  const B = basis(n);
  const p = ccw([to2(t1.a, B), to2(t1.b, B), to2(t1.c, B)]), q = ccw([to2(t2.a, B), to2(t2.b, B), to2(t2.c, B)]);
  const r = clipPolygon(p, q);
  return r.length >= 3 ? Math.abs(area2(r)) : 0;
}
/** The shared polygon's area and its centre (world), for two coplanar triangles. */
export function overlapOf(t1, t2, n) {
  const B = basis(n);
  const p = ccw([to2(t1.a, B), to2(t1.b, B), to2(t1.c, B)]), q = ccw([to2(t2.a, B), to2(t2.b, B), to2(t2.c, B)]);
  const r = clipPolygon(p, q);
  if (r.length < 3) return { area: 0, at: null };
  const cx = r.reduce((s, x) => s + x[0], 0) / r.length, cy = r.reduce((s, x) => s + x[1], 0) / r.length;
  const d = dot(n, t1.a), [U, W] = B;
  return { area: Math.abs(area2(r)), at: [U[0] * cx + W[0] * cy + n[0] * d, U[1] * cx + W[1] * cy + n[1] * d, U[2] * cx + W[2] * cy + n[2] * d] };
}

/**
 * The pairs of meshes whose faces fight. Options: eps (m: how near two planes count as one; the depth buffer at
 * 50 m can't tell much under half a centimetre), cos (how parallel), minArea (m²: a pair's total shared area under
 * this is not counted), minTri (m²: triangles smaller than this are left out), sameMaterial (count two meshes of
 * one material too: false, they shade alike and the fight can't be seen), site (m: overlaps of the same two looks
 * within this many metres are one site; a temple's walls are one merged mesh). A face whose material has polygonOffset
 * set is drawn pulled toward the eye and fights nothing.
 */
export function coplanarOverlaps(tris, { eps = 0.004, cos = 0.9995, minArea = 0.05, minTri = 1e-4, sameMaterial = false, cell = 4, site = 3 } = {}) {
  // bucket by plane: the normal (canonical: its largest component positive) rounded, and d in steps of eps
  const buckets = new Map();
  const items = [];
  for (const t of tris) {
    if (t.offset) continue;
    const pl = planeOf(t);
    if (!pl || pl.area < minTri) continue;
    let { n, d } = pl, flip = false;
    const big = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2;
    if (n[big] < 0) { n = [-n[0], -n[1], -n[2]]; d = -d; flip = true; }
    const it = { t, n, d, flip, area: pl.area, i: items.length };
    items.push(it);
    const key = `${Math.round(n[0] * 40)},${Math.round(n[1] * 40)},${Math.round(n[2] * 40)}|${Math.floor(d / eps)}`;
    let b = buckets.get(key); if (!b) buckets.set(key, (b = [])); b.push(it);
  }
  const pairs = new Map();
  const tested = new Set();
  const box = (t) => [Math.min(t.a[0], t.b[0], t.c[0]), Math.min(t.a[1], t.b[1], t.c[1]), Math.min(t.a[2], t.b[2], t.c[2]), Math.max(t.a[0], t.b[0], t.c[0]), Math.max(t.a[1], t.b[1], t.c[1]), Math.max(t.a[2], t.b[2], t.c[2])];
  const hit = (A, B) => A[0] <= B[3] + 1e-4 && B[0] <= A[3] + 1e-4 && A[1] <= B[4] + 1e-4 && B[1] <= A[4] + 1e-4 && A[2] <= B[5] + 1e-4 && B[2] <= A[5] + 1e-4;
  for (const [key, list] of buckets) {
    const [nk, dk] = key.split('|');
    const next = buckets.get(`${nk}|${+dk + 1}`) ?? [];
    const all = list.concat(next);
    if (all.length < 2) continue;
    // a coarse grid in the plane's dominant axes, so a great floor of tiles isn't every tile against every other
    const grid = new Map();
    for (const it of all) {
      it.box ??= box(it.t);
      const b = it.box;
      for (let x = Math.floor(b[0] / cell); x <= Math.floor(b[3] / cell); x++) for (let y = Math.floor(b[1] / cell); y <= Math.floor(b[4] / cell); y++) for (let z = Math.floor(b[2] / cell); z <= Math.floor(b[5] / cell); z++) {
        const g = `${x},${y},${z}`; let c = grid.get(g); if (!c) grid.set(g, (c = [])); c.push(it);
      }
    }
    for (const c of grid.values()) {
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
        const A = c[i], B = c[j];
        if (A.t.mesh === B.t.mesh && A.t.mat === B.t.mat) continue;
        if (!sameMaterial && A.t.mat === B.t.mat) continue;
        if (Math.abs(A.d - B.d) > eps) continue;
        const nd = dot(A.n, B.n);
        if (nd < cos) continue;
        // facing: the same way, or opposite with either double-sided (both drawn from one side)
        if (A.flip !== B.flip && A.t.side !== 2 && B.t.side !== 2) continue;
        const k = A.i < B.i ? `${A.i}:${B.i}` : `${B.i}:${A.i}`;
        if (tested.has(k)) continue;
        tested.add(k);
        if (!hit(A.box, B.box)) continue;
        const ov = overlapOf(A.t, B.t, A.n), ar = ov.area;
        if (ar < 1e-5) continue;
        const [m1, m2] = [A.t, B.t].sort((x, y) => (`${x.mesh}|${x.mat}` < `${y.mesh}|${y.mat}` ? -1 : 1));
        // (one site per pair of looks per few metres: a temple's walls are one merged mesh, its trims another)
        const ctr = A.t.a.map((x, q) => Math.floor((x + A.t.b[q] + A.t.c[q]) / 3 / site));
        const pk = `${m1.mesh}|${m1.mat}||${m2.mesh}|${m2.mat}|${ctr.join(',')}`;
        let p = pairs.get(pk);
        if (!p) pairs.set(pk, (p = { meshA: m1.mesh, meshB: m2.mesh, matA: m1.matName, matB: m2.matName, area: 0, at: null, best: 0, normal: A.n, samples: [], two: A.t.side === 2 || B.t.side === 2 }));
        p.area += ar;
        // (where to look for it from: the overlap's centre, and the way its faces look out)
        const face = A.flip ? A.n.map((x) => -x) : A.n;
        p.samples.push({ p: ov.at, n: face, area: ar });
        if (p.samples.length > 6) { p.samples.sort((x, y) => y.area - x.area); p.samples.length = 4; }
        if (ar > p.best) { p.best = ar; p.at = A.t.a.map((x) => +x.toFixed(2)); p.normal = A.n.map((x) => +x.toFixed(2)); }
      }
    }
  }
  return [...pairs.values()].filter((p) => p.area >= minArea).map(({ best, ...p }) => ({ ...p, area: +p.area.toFixed(3) })).sort((a, b) => b.area - a.area);
}

/**
 * Keep only the sites someone standing in the world could see: from places to stand round each site (a grid of
 * points `eye` m over a floor, within `reach` m: a ray down finds a floor facing up under it, a ray up no ceiling
 * lower than `head`), a clear line to one of the site's samples on the side its faces look out of. A fight
 * buried under a floor, inside a wall or behind the temple's shell is no fight. `ray(origin, dir, far)` -> null or
 * { distance, normal, back } (the first face hit, either side; back: met from behind it): the caller's BVH (audit.mjs). stand(eye) -> false leaves a
 * place out (a temple's roof: no one stands up there).
 */
export function visibleSites(fights, ray, { reach = 24, step = 3, eye = 1.6, head = 1.9, floor = 3.5, stand = null } = {}) {
  const N = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const out = [];
  for (const f of fights) {
    let seen = null;
    for (const s of f.samples ?? []) {
      if (seen) break;
      const p = s.p, n = s.n;
      // stand points: a grid on the faces' side, flat round the sample
      for (let dx = -reach; dx <= reach && !seen; dx += step) for (let dz = -reach; dz <= reach && !seen; dz += step) for (const lift of [0, -4, 4, -9, 9]) {
        const o = [p[0] + dx + n[0] * 0.6, p[1] + lift + 2, p[2] + dz + n[2] * 0.6];
        const down = ray(o, [0, -1, 0], floor + 2);
        if (!down || down.back || down.normal[1] < 0.6) continue;   // (no floor, or inside a wall: its bottom met from within)
        const e = [o[0], o[1] - down.distance + eye, o[2]];
        const up = ray([e[0], e[1] - eye + 0.1, e[2]], [0, 1, 0], head);
        if (up || (stand && !stand(e))) continue;
        // (inside a wall drawn in stacked courses, there's no face under you to tell: any way out sideways meets a back)
        if ([[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].some((d) => ray(e, d, 30)?.back)) continue;
        const to = [p[0] + n[0] * 0.01 - e[0], p[1] + n[1] * 0.01 - e[1], p[2] + n[2] * 0.01 - e[2]], d = Math.hypot(...to);
        if (d < 0.3 || d > reach * 1.6) continue;
        const u = N(to);
        if (!f.two && -(u[0] * n[0] + u[1] * n[1] + u[2] * n[2]) < 0.05) continue;   // (from behind: culled)
        const hit = ray(e, u, d);
        if (!hit || hit.distance > d - 0.05) { seen = { from: e.map((x) => +x.toFixed(2)), at: p.map((x) => +x.toFixed(2)) }; break; }
      }
    }
    if (seen) out.push({ ...f, seen });
  }
  return out;
}

/** A world's count: how many pairs of meshes fight, their shared area, the worst few. */
export function summarise(fights, worst = 12) {
  return { count: fights.length, area: +fights.reduce((s, f) => s + f.area, 0).toFixed(2), worst: fights.slice(0, worst) };
}
