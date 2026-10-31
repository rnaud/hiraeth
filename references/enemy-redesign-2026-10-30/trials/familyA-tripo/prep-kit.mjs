// The family A prepare steps (#800: the toad, the centipede, the skitter), shared; each foe's prepare-<foe>.mjs gives
// its frame, size, roles and landmarks. The recipe of .claude/skills/enemy-rework/references/tripo-rebuild.md §2, as
// the shellback's prepare.mjs did it:
//
// 1. into the game's frame (Tripo's +x ahead → the game's +z, feet on y 0, scaled to the foe's height);
// 2. decimated to the target by geometry alone (meshoptimizer, borders locked: a colour weighting keeps crease noise);
// 3. the texture repainted by part, one flat colour a role: each texel's role by its hue and lightness (a median filter
//    first) and where it lies on the body (the foe's own `role(p, n, texel)`), the dark specks and painted lines folded
//    into the role round them, the painted eyes painted out (they become their own parts); the texels no triangle owns
//    filled from the nearest island (no other colour bleeds in at the small mips);
// 4. COLOR_0 sampled from the repainted texture (the engines' VMs decode no picture).
// Deterministic: the same input writes the same bytes.
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { readTripo } from '../shellback-tripo/glb.mjs';

export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Hue (deg), saturation and lightness of an sRGB byte triple. */
export function hsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, d = mx - mn;
  const s = d === 0 ? 0 : d / 255 / (1 - Math.abs(2 * l - 1) || 1);
  const h = d === 0 ? 0 : (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return [h, s, l];
}

/** The export in the game's frame: { m (the raw read), P, N (game frame), n, S (scale), lo (Tripo's lowest y), toGame }. */
export async function framed(file, height, { ahead = 'x' } = {}) {
  const m = await readTripo(file), n = m.P.length / 3;
  let lo = Infinity, hi = -Infinity;
  for (let v = 0; v < n; v++) { lo = Math.min(lo, m.P[v * 3 + 1]); hi = Math.max(hi, m.P[v * 3 + 1]); }
  const S = height / (hi - lo);
  // (Tripo's +x ahead → the game's +z; its +z → the game's −x)
  const toGame = ahead === 'x' ? (x, y, z) => [-z * S, (y - lo) * S, x * S] : (x, y, z) => [x * S, (y - lo) * S, z * S];
  const rot = ahead === 'x' ? (x, y, z) => [-z, y, x] : (x, y, z) => [x, y, z];
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    P.set(toGame(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]), v * 3);
    N.set(rot(m.N[v * 3], m.N[v * 3 + 1], m.N[v * 3 + 2]), v * 3);
  }
  return { m, P, N, n, S, lo, toGame };
}

/** Decimated to `target` triangles by geometry alone: { P, N, UV, I, n, error } (vertices renumbered, the kept ones). */
export async function decimate(src, P, N, target) {
  await MS.ready;
  const m = src;
  const [simp, error] = MS.simplify(m.I, P, 3, Math.min(m.I.length, target * 3), 0.05, ['LockBorder']);
  const n0 = P.length / 3, used = new Int32Array(n0).fill(-1); let nv = 0;
  for (const i of simp) if (used[i] < 0) used[i] = nv++;
  const out = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2), n: nv, error };
  for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue;
    out.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); out.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); out.UV.set(m.UV.subarray(v * 2, v * 2 + 2), j * 2); }
  out.I = Uint32Array.from(simp, (i) => used[i]);
  return out;
}

/** Only the largest connected pieces (by triangles, welded by position): drops the stray bits a picture's lettering makes. */
export function keepPieces(mesh, minShare = 0.01) {
  const { P, I } = mesh, nv = P.length / 3, parent = new Int32Array(nv).map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const weld = new Map();
  for (let v = 0; v < nv; v++) { const k = `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`; if (weld.has(k)) parent[find(v)] = find(weld.get(k)); else weld.set(k, v); }
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]); parent[find(I[t + 1])] = a; parent[find(I[t + 2])] = a; }
  const count = new Map(); for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); count.set(r, (count.get(r) ?? 0) + 1); }
  const total = I.length / 3, keep = new Set([...count].filter(([, c]) => c >= total * minShare).map(([r]) => r));
  const out = []; for (let t = 0; t < I.length; t += 3) if (keep.has(find(I[t]))) out.push(I[t], I[t + 1], I[t + 2]);
  const dropped = total - out.length / 3;
  mesh.I = Uint32Array.from(out);
  return dropped;
}

/** The source texture brought to `size`², median filtered: { px (RGB bytes), W, H }. */
export async function texture(m, size = 1024, median = 5) {
  const { data, info } = await sharp(m.image.bytes).resize(size, size, { kernel: 'lanczos3' }).median(median).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { px: data, W: info.width, H: info.height };
}

/**
 * The texture repainted by part. role(p, n, rgb, t) → a key of `palette`, or null (a dark speck or painted line: filled
 * from the roles round it, on the same triangles' texels), or '!' + key (a painted-out texel: painted key, and its
 * point recorded in `removed`). Returns { paint (RGB bytes), owner, removed: [p…] }.
 */
export function repaint(mesh, tex, palette, role) {
  const { P, N, UV, I } = mesh, { px, W, H } = tex;
  const PAL = Object.fromEntries(Object.entries(palette).map(([k, h]) => [k, hex(h)]));
  const paint = Buffer.alloc(W * H * 3), owner = new Int32Array(W * H).fill(-1), known = new Uint8Array(W * H), removed = [];
  for (const pass of [0, 1]) for (let t = 0; t < I.length / 3; t++) {
    const [a, b, d] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], U = (v) => [UV[v * 2] * W - 0.5, UV[v * 2 + 1] * H - 0.5];
    const A = U(a), B = U(b), D = U(d), area = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
    if (Math.abs(area) < 1e-12) continue;
    const mid = [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3].map(Math.round);
    const x0 = pass ? mid[0] : Math.max(0, Math.floor(Math.min(A[0], B[0], D[0]))), x1 = pass ? mid[0] : Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], D[0])));
    const y0 = pass ? mid[1] : Math.max(0, Math.floor(Math.min(A[1], B[1], D[1]))), y1 = pass ? mid[1] : Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], D[1])));
    const nrm = [0, 1, 2].map((i) => (N[a * 3 + i] + N[b * 3 + i] + N[d * 3 + i]) / 3);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      let w1 = ((B[0] - x) * (D[1] - y) - (B[1] - y) * (D[0] - x)) / area, w2 = ((D[0] - x) * (A[1] - y) - (D[1] - y) * (A[0] - x)) / area, w3 = 1 - w1 - w2;
      if (pass) { if (owner[y * W + x] >= 0) continue; w1 = w2 = w3 = 1 / 3; }
      else if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
      const k = y * W + x, inside = !pass && w1 >= 0 && w2 >= 0 && w3 >= 0;
      if (owner[k] >= 0 && !inside) continue;
      const p = [0, 1, 2].map((i) => w1 * P[a * 3 + i] + w2 * P[b * 3 + i] + w3 * P[d * 3 + i]);
      let r = role(p, nrm, [px[k * 3], px[k * 3 + 1], px[k * 3 + 2]], t);
      owner[k] = t;
      if (r && r[0] === '!') { r = r.slice(1); if (inside) removed.push(p); }
      if (!r) { known[k] = 0; continue; }
      known[k] = 1; const c = PAL[r]; paint[k * 3] = c[0]; paint[k * 3 + 1] = c[1]; paint[k * 3 + 2] = c[2];
    }
  }
  // the specks and lines (owned, no role): from the known texels round them, breadth first, owned texels only
  { let front = []; for (let k = 0; k < W * H; k++) if (known[k]) front.push(k);
    while (front.length) { const next = []; for (const k of front) { const x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (known[j] || owner[j] < 0) continue; known[j] = 1; paint.copy(paint, j * 3, k * 3, k * 3 + 3); next.push(j); } } front = next; } }
  // the texels no triangle owns: from the nearest owned one (breadth first)
  { let front = []; for (let k = 0; k < W * H; k++) if (known[k]) front.push(k);
    const done = Uint8Array.from(known);
    while (front.length) { const next = []; for (const k of front) { const x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (done[j]) continue; done[j] = 1; paint.copy(paint, j * 3, k * 3, k * 3 + 3); next.push(j); } } front = next; } }
  return { paint, owner, removed };
}

/** COLOR_0 from the repainted texture: each vertex's texel a little inside one of its triangles (an island's edge reads the next). */
export function vertexColours(mesh, paint, W, H) {
  const { UV, I } = mesh, n = UV.length / 2, COL = new Uint8Array(n * 4), done = new Uint8Array(n);
  for (let t = 0; t < I.length / 3; t++) {
    const tri = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], cu = tri.reduce((s, v) => s + UV[v * 2], 0) / 3, cv = tri.reduce((s, v) => s + UV[v * 2 + 1], 0) / 3;
    for (const v of tri) { if (done[v]) continue; done[v] = 1;
      const u = UV[v * 2] * 0.85 + cu * 0.15, w = UV[v * 2 + 1] * 0.85 + cv * 0.15;
      const k = Math.min(H - 1, Math.max(0, Math.floor(w * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(u * W)));
      for (let i = 0; i < 3; i++) COL[v * 4 + i] = paint[k * 3 + i]; COL[v * 4 + 3] = 255; }
  }
  return COL;
}

/** The flat texture as an 8-colour palette PNG. */
export const flatPng = (paint, W, H) => sharp(paint, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: 8, dither: 0 }).toBuffer();

/** Centroid and spans of a list of points. */
export function cloud(q) {
  if (!q.length) return null;
  const mid = [0, 1, 2].map((i) => q.reduce((t, p) => t + p[i], 0) / q.length), lo = [0, 1, 2].map((i) => Math.min(...q.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...q.map((p) => p[i])));
  return { at: mid.map((x) => +x.toFixed(4)), lo: lo.map((x) => +x.toFixed(4)), hi: hi.map((x) => +x.toFixed(4)), n: q.length };
}

/**
 * Every triangle across the surface F(p) = 0 split exactly on it (a few bisections on F itself, not a straight line),
 * (`from`: each new triangle's old one) the vertices on the cut made twice, one copy a side, so a flat colour a side stays sharp in COLOR_0. Returns the
 * triangles' sides (1: F > 0) and the mesh with its new vertices (P, N, UV, I, n). `only(t)` limits the split to some
 * triangles (the rest keep the side of their middle).
 */
export function splitAlong(mesh, F, only = () => true) {
  const P = Array.from(mesh.P), N = Array.from(mesh.N), UV = Array.from(mesh.UV), I0 = mesh.I;
  const f = new Float64Array(mesh.n); for (let v = 0; v < mesh.n; v++) f[v] = F([mesh.P[v * 3], mesh.P[v * 3 + 1], mesh.P[v * 3 + 2]]);
  const onEdge = new Map();
  const cross = (a, b, side) => {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}:${side}`; if (onEdge.has(key)) return onEdge.get(key);
    let t0 = 0, t1 = 1; const fa = f[a] > 0;
    const at = (t, k) => mesh.P[a * 3 + k] + (mesh.P[b * 3 + k] - mesh.P[a * 3 + k]) * t;
    for (let i = 0; i < 24; i++) { const t = (t0 + t1) / 2; if ((F([at(t, 0), at(t, 1), at(t, 2)]) > 0) === fa) t0 = t; else t1 = t; }
    const t = (t0 + t1) / 2, j = P.length / 3;
    for (let k = 0; k < 3; k++) P.push(at(t, k));
    const nn = [0, 1, 2].map((k) => mesh.N[a * 3 + k] + (mesh.N[b * 3 + k] - mesh.N[a * 3 + k]) * t), nl = Math.hypot(...nn) || 1; N.push(...nn.map((x) => x / nl));
    for (let k = 0; k < 2; k++) UV.push(mesh.UV[a * 2 + k] + (mesh.UV[b * 2 + k] - mesh.UV[a * 2 + k]) * t);
    onEdge.set(key, j); return j;
  };
  const I = [], side = [], from = [];
  for (let t = 0; t < I0.length / 3; t++) {
    const tri = [I0[t * 3], I0[t * 3 + 1], I0[t * 3 + 2]], up = tri.map((v) => f[v] > 0), nUp = up.filter(Boolean).length;
    if (nUp === 3 || nUp === 0 || !only(t)) { I.push(...tri); side.push(nUp >= 2 ? 1 : 0); from.push(t); continue; }
    const lone = nUp === 1 ? up.indexOf(true) : up.indexOf(false), [a, b, d] = [tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]];
    const loneSide = nUp === 1 ? 1 : 0, pairSide = 1 - loneSide;
    I.push(a, cross(a, b, loneSide), cross(a, d, loneSide)); side.push(loneSide); from.push(t);
    const ab = cross(a, b, pairSide), ad = cross(a, d, pairSide);
    I.push(ab, b, d, ab, d, ad); side.push(pairSide, pairSide); from.push(t, t);
  }
  return { mesh: { P: Float32Array.from(P), N: Float32Array.from(N), UV: Float32Array.from(UV), I: Uint32Array.from(I), n: P.length / 3, error: mesh.error }, side, from, split: onEdge.size };
}

/** Distance from p to the segment a–b (arrays). */
export function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / Math.max(1e-12, ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}
