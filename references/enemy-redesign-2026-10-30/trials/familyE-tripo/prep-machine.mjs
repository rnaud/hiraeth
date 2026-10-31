// The family E prepare steps (#800: the droids, the tripod, the drone, the crawler), shared; each foe's prepare-<foe>.mjs
// gives its frame, size, parts and cuts. The machine family's recipe (.claude/skills/enemy-rework/references/
// tripo-rebuild.md §2, §3 "Machine"), on family A's kit (../familyA-tripo/prep-kit.mjs: decimation by geometry,
// splitAlong):
//
// 1. the export read, the pieces that are not the body dropped (the picture's shadow Tripo built as a disc);
// 2. into the game's frame by a turn about y, a scale and a shift (+z ahead, feet on y 0), measured landmarks too;
// 3. decimated by geometry alone;
// 4. cut into rigid parts by geometry, exactly on each cut (splitAlong): the triangles each whole in one part;
// 5. each triangle's colour role from its texels (the majority of a few samples), the reference's flat colours, the
//    lone triangles folded into their neighbours';
// 6. the skin's weights baked (JOINTS_0 / WEIGHTS_0): each vertex 1 on its part's bone, blended over `blend` m either
//    side of each cut by its signed distance (the same for the two copies splitAlong makes on the cut, so a bent joint
//    stays closed).
// Deterministic: the same input writes the same bytes.
import { readTripo, sample } from '../shellback-tripo/glb.mjs';
import { decimate, splitAlong, hsl } from '../familyA-tripo/prep-kit.mjs';

export { decimate, splitAlong, hsl };
export const r4 = (a) => a.map((x) => +x.toFixed(4));
export const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  mid: (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
};

/** The texture's role of a texel colour: the nearest of `roles` ({ name: '#hex' }, Tripo's own tones), in RGB. */
export function nearestRole(roles) {
  const R = Object.entries(roles).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]);
  return (c) => { let best = null, d = Infinity; for (const [k, r] of R) { const e = (r[0] - c[0]) ** 2 + (r[1] - c[1]) ** 2 + (r[2] - c[2]) ** 2; if (e < d) { d = e; best = k; } } return best; };
}

/** Welded connected pieces of an indexed mesh: an array of triangle-index lists. */
export function pieces(P, I) {
  const nv = P.length / 3, parent = new Int32Array(nv).map((_, i) => i), find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const weld = new Map();
  for (let v = 0; v < nv; v++) { const k = `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`; if (weld.has(k)) parent[find(v)] = find(weld.get(k)); else weld.set(k, v); }
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]); parent[find(I[t + 1])] = a; parent[find(I[t + 2])] = a; }
  const by = new Map(); for (let t = 0; t < I.length / 3; t++) { const r = find(I[t * 3]); if (!by.has(r)) by.set(r, []); by.get(r).push(t); }
  return [...by.values()];
}

/**
 * The raw export read, the pieces `drop(piece)` names left out (piece: { tris, lo, hi, role } with its texels' commonest
 * role), then into the game's frame: toGame(x, y, z) (Tripo's frame) → [x, y, z] game; normals by `turn` (the rotation
 * part alone). Returns { m (I filtered), P, N, n, dropped }.
 */
export async function readFramed(file, { roleOf, drop, toGame, turn }) {
  const m = await readTripo(file), n = m.P.length / 3, c = [0, 0, 0];
  const keep = [];
  let dropped = 0;
  for (const tris of pieces(m.P, m.I)) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], count = {};
    for (const t of tris) for (let k = 0; k < 3; k++) { const v = m.I[t * 3 + k]; for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.P[v * 3 + a]); hi[a] = Math.max(hi[a], m.P[v * 3 + a]); } }
    for (const t of tris) { const v = m.I[t * 3]; sample(m.tex, m.UV[v * 2], m.UV[v * 2 + 1], c); const r = roleOf(c); count[r] = (count[r] ?? 0) + 1; }
    const role = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    if (drop({ tris: tris.length, lo, hi, role })) { dropped += tris.length; continue; }
    keep.push(...tris);
  }
  keep.sort((a, b) => a - b);
  m.I = Uint32Array.from(keep.flatMap((t) => [m.I[t * 3], m.I[t * 3 + 1], m.I[t * 3 + 2]]));
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    P.set(toGame(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]), v * 3);
    const q = turn(m.N[v * 3], m.N[v * 3 + 1], m.N[v * 3 + 2]), l = Math.hypot(q[0], q[1], q[2]) || 1;
    N.set([q[0] / l, q[1] / l, q[2] / l], v * 3);
  }
  return { m, P, N, n, dropped };
}

/** Each triangle's colour role from its texels (its corners pulled 25 % in, and its middle): the majority; `fix(role, p, t)` maps it. */
export function triangleRoles(mesh, tex, roleOf, fix = (r) => r) {
  const { P, UV, I } = mesh, nt = I.length / 3, out = new Array(nt), c = [0, 0, 0];
  for (let t = 0; t < nt; t++) {
    const vs = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], cu = vs.reduce((s, v) => s + UV[v * 2], 0) / 3, cv = vs.reduce((s, v) => s + UV[v * 2 + 1], 0) / 3;
    const count = {};
    for (const [u, w] of [[cu, cv], ...vs.map((v) => [UV[v * 2] * 0.75 + cu * 0.25, UV[v * 2 + 1] * 0.75 + cv * 0.25])]) { sample(tex, u, w, c); const r = roleOf(c); count[r] = (count[r] ?? 0) + 1; }
    const r = Object.entries(count).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
    const p = [0, 1, 2].map((k) => vs.reduce((s, v) => s + P[v * 3 + k], 0) / 3);
    out[t] = fix(r, p, t);
  }
  return out;
}

/** The triangles' neighbours across their edges (welded by position). */
export function neighbours(mesh) {
  const { P, I } = mesh, nt = I.length / 3, key = (v) => `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`, edges = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const a = key(I[t * 3 + k]), b = key(I[t * 3 + (k + 1) % 3]), e = a < b ? a + '|' + b : b + '|' + a; if (!edges.has(e)) edges.set(e, []); edges.get(e).push(t); }
  const nb = Array.from({ length: nt }, () => []); for (const ts of edges.values()) for (const t of ts) for (const u of ts) if (u !== t) nb[t].push(u);
  return nb;
}

/** Lone triangles (none of their neighbours shares their role, within the same `group`) folded into their neighbours' commonest; `passes` times. */
export function foldLone(roles, nb, group = null, passes = 3, keep = () => false) {
  let r = roles.slice();
  for (let pass = 0; pass < passes; pass++) {
    const next = r.slice();
    for (let t = 0; t < r.length; t++) {
      if (keep(r[t], t)) continue;
      const n = nb[t].filter((u) => !group || group[u] === group[t]).map((u) => r[u]);
      if (n.length && n.every((x) => x !== r[t])) { const cnt = {}; for (const x of n) cnt[x] = (cnt[x] ?? 0) + 1; next[t] = Object.entries(cnt).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]; }
    }
    r = next;
  }
  return r;
}

/** Carry a per-triangle array through a split (splitAlong's `from`). */
export const carry = (arr, split) => split.from.map((t) => arr[t]);

/**
 * The skin's weights: each vertex 1 on its triangle's part's bone (every vertex's triangles share a part: the cuts split
 * them), then across each joint { a: bone before, b: bone past, F(p) (signed: > 0 past the cut), near(p) } blended over
 * `blend` m either side: w_b = smoothstep(F, −blend, blend). Returns { J (Uint8 × 4), W (Uint8 × 4, normalised: a byte each,
 * the two summing to 255), boneOf (per vertex) }.
 */
export function bakeWeights(mesh, triBone, joints, blend) {
  const { P, I } = mesh, n = P.length / 3, boneOf = new Int16Array(n).fill(-1);
  for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) { const v = I[t * 3 + k]; if (boneOf[v] < 0) boneOf[v] = triBone[t]; }
  const J = new Uint8Array(n * 4), W = new Uint8Array(n * 4);
  for (let v = 0; v < n; v++) {
    const b = Math.max(0, boneOf[v]), p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    J[v * 4] = b; W[v * 4] = 255;
    for (const j of joints) {
      if (b !== j.a && b !== j.b) continue;
      if (j.near && !j.near(p)) continue;
      const s = j.F(p); if (Math.abs(s) >= blend) continue;
      const x = Math.min(1, Math.max(0, (s + blend) / (2 * blend))), w = x * x * (3 - 2 * x);
      // (the larger weight first: a vertex's first joint is the bone that carries it most)
      const hi = Math.round(Math.max(w, 1 - w) * 255);
      if (w >= 0.5) { J[v * 4] = j.b; J[v * 4 + 1] = j.a; } else { J[v * 4] = j.a; J[v * 4 + 1] = j.b; }
      W[v * 4] = hi; W[v * 4 + 1] = 255 - hi;
      break;
    }
  }
  return { J, W, boneOf };
}

/** The triangles grouped by `order` of a per-triangle key: { indices, parts: { key: [first, count] } }. */
export function grouped(mesh, key, order) {
  const out = [], parts = {};
  for (const k of order) { const first = out.length / 3; key.forEach((q, t) => { if (q === k) out.push(mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]); }); parts[k] = [first, out.length / 3 - first]; }
  return { indices: Uint32Array.from(out), parts };
}

/** COLOR_0 (RGBA bytes) by each triangle's role, the palette's. */
export function roleColours(mesh, role, palette) {
  const PAL = Object.fromEntries(Object.entries(palette).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
  const COL = new Uint8Array((mesh.P.length / 3) * 4);
  role.forEach((q, t) => { for (let k = 0; k < 3; k++) COL.set([...PAL[q], 255], mesh.I[t * 3 + k] * 4); });
  return COL;
}

/** Points' box. */
export function box(points) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  return { lo, hi, mid: V.mid(lo, hi) };
}
