// #800 family B (the flyers: the cloud jelly, the lamp moth, the storm ray): what their prepare.mjs scripts share, the
// steps of the skill's recipe (.claude/skills/enemy-rework/references/tripo-rebuild.md section 2), as the four trials'
// prepare scripts did them one by one:
//
// - read the untouched export, drop the loose shells it adds (the storm ray's drawn shadow), into the game's frame
//   (+z ahead, +y up, metres) at the size asked for;
// - each texel's role from its colour (a median filter, a foe's own rule by hue and lightness, then the commonest role
//   round it, 7 × 7: the specks and thin strokes in the creases go);
// - decimated by the geometry alone (meshoptimizer, the UV seams kept: weighting colour borders keeps crease noise);
// - a part cut exactly along a surface (splitAlong: each triangle across F = 0 split on it, a shared vertex an edge);
// - the texture repainted, one flat colour a role per part (a foe's own rule), the texels between islands filled from
//   the nearest island (no colour bleeds in at the small mips), swatches for added parts, COLOR_0 from it;
// - one GLB: the mesh with its triangles grouped by part (extras.parts: name → [first, count]) and the landmarks.
//
// Deterministic: the same input writes the same bytes.
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { readTripo } from '../shellback-tripo/glb.mjs';

export { writeGlb } from '../shellback-tripo/glb.mjs';
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const lumOf = (r, g, b) => r * 0.3 + g * 0.59 + b * 0.11;
/** Hue (degrees), saturation-ish (max − min) and lightness (0..255) of an sRGB byte colour. */
export function hsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1;
  const h = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { h, s: mx - mn, l: (mx + mn) / 2 };
}

/**
 * The export in the game's frame. o: { ahead: 'x' | 'z' (Tripo's axis the foe faces), size: { axis: 0|1|2, metres }
 * (the extent along that game axis it is scaled to), keep(component) (which loose shells stay: default all) }.
 * Returns { P, N, UV (game frame, Float32), I, image, tex, scale, lo (min y, Tripo) }; positions feet-up: the lowest
 * point on y = 0, centred on x and z by its box.
 */
export async function loadExport(file, o) {
  const m = await readTripo(file);
  const n = m.P.length / 3;
  // the loose shells (welded across UV seams): kept by o.keep
  let I = m.I;
  if (o.keep) {
    const weld = new Int32Array(n), map = new Map();
    for (let v = 0; v < n; v++) { const k = `${Math.round(m.P[v * 3] * 1e4)},${Math.round(m.P[v * 3 + 1] * 1e4)},${Math.round(m.P[v * 3 + 2] * 1e4)}`; if (!map.has(k)) map.set(k, v); weld[v] = map.get(k); }
    const par = Int32Array.from({ length: n }, (_, i) => i), f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
    for (let t = 0; t < I.length; t += 3) { const a = f(weld[I[t]]); par[f(weld[I[t + 1]])] = a; par[f(weld[I[t + 2]])] = a; }
    const comps = new Map();
    for (let t = 0; t < I.length; t += 3) { const r = f(weld[I[t]]); if (!comps.has(r)) comps.set(r, { tris: [], lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }); const c = comps.get(r); c.tris.push(t);
      for (let k = 0; k < 3; k++) { const v = I[t + k]; for (let i = 0; i < 3; i++) { c.lo[i] = Math.min(c.lo[i], m.P[v * 3 + i]); c.hi[i] = Math.max(c.hi[i], m.P[v * 3 + i]); } } }
    const kept = [...comps.values()].sort((a, b) => b.tris.length - a.tris.length).filter((c, i) => o.keep(c, i));
    const out = []; for (const c of kept) for (const t of c.tris) out.push(I[t], I[t + 1], I[t + 2]);
    I = Uint32Array.from(out);
  }
  // (a proper turn: Tripo's x ahead → the game's z, its z → the game's −x; or its z already ahead)
  const turn = o.ahead === 'x' ? (x, y, z) => [-z, y, x] : (x, y, z) => [x, y, z];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const used = new Uint8Array(n); for (const v of I) used[v] = 1;
  for (let v = 0; v < n; v++) { if (!used[v]) continue; const p = turn(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } }
  const S = o.size.metres / (hi[o.size.axis] - lo[o.size.axis]);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const p = turn(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]), q = turn(m.N[v * 3], m.N[v * 3 + 1], m.N[v * 3 + 2]);
    P[v * 3] = (p[0] - (lo[0] + hi[0]) / 2) * S; P[v * 3 + 1] = (p[1] - lo[1]) * S; P[v * 3 + 2] = (p[2] - (lo[2] + hi[2]) / 2) * S;
    N[v * 3] = q[0]; N[v * 3 + 1] = q[1]; N[v * 3 + 2] = q[2];
  }
  /** a Tripo point into the game's frame (for landmarks read off inspect.mjs's splats) */
  const toGame = (x, y, z) => { const p = turn(x, y, z); return [(p[0] - (lo[0] + hi[0]) / 2) * S, (p[1] - lo[1]) * S, (p[2] - (lo[2] + hi[2]) / 2) * S]; };
  return { P, N, UV: m.UV, I, image: m.image, tex: m.tex, scale: S, toGame, sourceTriangles: m.I.length / 3, sourceVertices: n };
}

/** Each texel's role (TEX², median 5, roleOfRGB, then the commonest role in a 7 × 7 window). Returns { role, W, H, px }. */
export async function texelRoles(imageBytes, roleOfRGB, nRoles, TEX = 1024, R = 3) {
  const { data: px, info } = await sharp(imageBytes).resize(TEX, TEX, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, src = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) src[i] = roleOfRGB(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
  const role = new Uint8Array(W * H), cnt = new Uint16Array(nRoles);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    cnt.fill(0);
    for (let j = Math.max(0, y - R); j <= Math.min(H - 1, y + R); j++) for (let i = Math.max(0, x - R); i <= Math.min(W - 1, x + R); i++) cnt[src[j * W + i]]++;
    let best = src[y * W + x]; for (let k = 0; k < nRoles; k++) if (cnt[k] > cnt[best]) best = k;
    role[y * W + x] = best;
  }
  return { role, W, H, px };
}
export const roleAtUV = (T, u, v) => T.role[Math.min(T.H - 1, Math.max(0, Math.floor(v * T.H))) * T.W + Math.min(T.W - 1, Math.max(0, Math.floor(u * T.W)))];

/** Decimated to `target` triangles by the geometry alone (UV seams and borders kept). Returns { P, N, UV, I, error }. */
export async function decimate(src, target) {
  await MS.ready;
  const [simp, err] = MS.simplify(src.I, src.P, 3, Math.min(src.I.length, target * 3), 0.05, ['LockBorder']);
  const n0 = src.P.length / 3, used = new Int32Array(n0).fill(-1); let nv = 0;
  for (const i of simp) if (used[i] < 0) used[i] = nv++;
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2);
  for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue; P.set(src.P.subarray(v * 3, v * 3 + 3), j * 3); N.set(src.N.subarray(v * 3, v * 3 + 3), j * 3); UV.set(src.UV.subarray(v * 2, v * 2 + 2), j * 2); }
  return { P, N, UV, I: Uint32Array.from(simp, (i) => used[i]), error: err };
}

/**
 * A growable mesh (arrays) the splits add vertices to: { P, N, UV } as plain arrays, and split(tri, F) → { inside,
 * outside } (triangle index triples): each triangle across F = 0 (F > 0 inside) cut exactly on it, a new vertex on each
 * crossed edge found by bisection on F itself and shared by the edge's two triangles; the winding kept.
 */
export function splitter(mesh) {
  const V = { P: Array.from(mesh.P), N: Array.from(mesh.N), UV: Array.from(mesh.UV) };
  const onEdge = new Map();
  const pos = (v) => [V.P[v * 3], V.P[v * 3 + 1], V.P[v * 3 + 2]];
  const cross = (a, b, F, tag) => {
    const key = `${tag}|${a < b ? `${a}:${b}` : `${b}:${a}`}`; if (onEdge.has(key)) return onEdge.get(key);
    const A = pos(a), B = pos(b), at = (t) => [0, 1, 2].map((k) => A[k] + (B[k] - A[k]) * t), fa = F(A) > 0;
    let t0 = 0, t1 = 1; for (let i = 0; i < 24; i++) { const t = (t0 + t1) / 2; if ((F(at(t)) > 0) === fa) t0 = t; else t1 = t; }
    const t = (t0 + t1) / 2, j = V.P.length / 3;
    V.P.push(...at(t));
    const nn = [0, 1, 2].map((k) => V.N[a * 3 + k] + (V.N[b * 3 + k] - V.N[a * 3 + k]) * t), nl = Math.hypot(...nn) || 1; V.N.push(...nn.map((x) => x / nl));
    for (let k = 0; k < 2; k++) V.UV.push(V.UV[a * 2 + k] + (V.UV[b * 2 + k] - V.UV[a * 2 + k]) * t);
    onEdge.set(key, j); return j;
  };
  /** tris: flat array of indices; F(p) > 0 inside; tag: a name per surface (its edge vertices are its own). */
  const split = (tris, F, tag = 'cut') => {
    const inside = [], outside = [];
    for (let t = 0; t < tris.length; t += 3) {
      const tri = [tris[t], tris[t + 1], tris[t + 2]], up = tri.map((v) => F(pos(v)) > 0), nUp = up.filter(Boolean).length;
      if (nUp === 3) { inside.push(...tri); continue; }
      if (nUp === 0) { outside.push(...tri); continue; }
      const lone = nUp === 1 ? up.indexOf(true) : up.indexOf(false), [a, b, d] = [tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]];
      const ab = cross(a, b, F, tag), ad = cross(a, d, F, tag);
      const [loneSide, pairSide] = nUp === 1 ? [inside, outside] : [outside, inside];
      loneSide.push(a, ab, ad); pairSide.push(ab, b, d, ab, d, ad);
    }
    return { inside, outside };
  };
  return { V, pos, split, count: () => V.P.length / 3 };
}

/** A triangle's centroid and mean normal. */
export function triInfo(V, tri) {
  const c = [0, 0, 0], nn = [0, 0, 0];
  for (const v of tri) for (let k = 0; k < 3; k++) { c[k] += V.P[v * 3 + k] / 3; nn[k] += V.N[v * 3 + k] / 3; }
  return { c, n: nn };
}

/**
 * The texture repainted: every texel a triangle's UV covers painted paintOf(t, texelRole, p (its point on the mesh),
 * normal) → a palette key; the rest filled from the nearest painted texel (breadth first); `swatches` (key → [u, v])
 * (k: the texel, T.px its filtered colour) written as 3 × 3 blocks where nothing draws. Returns { paint (RGB bytes), png, W, H }.
 */
export async function repaint({ V, I, T, PAL, paintOf, swatches = {} }) {
  const W = T.W, H = T.H, paint = Buffer.alloc(W * H * 3), owner = new Int32Array(W * H).fill(-1);
  for (const pass of [0, 1]) for (let t = 0; t < I.length / 3; t++) {
    const [a, b, d] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], U = (v) => [V.UV[v * 2] * W - 0.5, V.UV[v * 2 + 1] * H - 0.5];
    const A = U(a), B = U(b), D = U(d), area = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
    if (Math.abs(area) < 1e-12) continue;
    const mid = [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3].map(Math.round);
    const x0 = pass ? mid[0] : Math.max(0, Math.floor(Math.min(A[0], B[0], D[0]))), x1 = pass ? mid[0] : Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], D[0])));
    const y0 = pass ? mid[1] : Math.max(0, Math.floor(Math.min(A[1], B[1], D[1]))), y1 = pass ? mid[1] : Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], D[1])));
    const nrm = [0, 1, 2].map((k) => (V.N[a * 3 + k] + V.N[b * 3 + k] + V.N[d * 3 + k]) / 3);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      let w1 = ((B[0] - x) * (D[1] - y) - (B[1] - y) * (D[0] - x)) / area, w2 = ((D[0] - x) * (A[1] - y) - (D[1] - y) * (A[0] - x)) / area, w3 = 1 - w1 - w2;
      if (pass) { if (owner[y * W + x] >= 0) continue; w1 = w2 = w3 = 1 / 3; }
      else if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
      const k = y * W + x, inside = !pass && w1 >= 0 && w2 >= 0 && w3 >= 0;
      if (owner[k] >= 0 && !inside) continue;
      const p = [0, 1, 2].map((i) => w1 * V.P[a * 3 + i] + w2 * V.P[b * 3 + i] + w3 * V.P[d * 3 + i]);
      const key = paintOf(t, T.role[k], p, nrm, inside, k);
      owner[k] = t; const col = PAL[key]; paint[k * 3] = col[0]; paint[k * 3 + 1] = col[1]; paint[k * 3 + 2] = col[2];
    }
  }
  // the swatches: blocks where no triangle draws (the nearest free 3 × 3 to the uv asked)
  const placed = {};
  for (const [key, [u0, v0]] of Object.entries(swatches)) {
    let found = null;
    for (let r = 0; r < 200 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
      const cx = Math.round(u0 * W) + dx * 3, cy = Math.round(v0 * H) + dy * 3; let free = true;
      for (let j = -2; j <= 2 && free; j++) for (let i = -2; i <= 2 && free; i++) { const x = cx + i, y = cy + j; if (x < 0 || y < 0 || x >= W || y >= H || owner[y * W + x] >= 0) free = false; }
      if (free) found = [cx, cy];
    }
    if (!found) throw new Error(`no room for the ${key} swatch`);
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const k = (found[1] + j) * W + found[0] + i; owner[k] = -2; const col = PAL[key]; paint[k * 3] = col[0]; paint[k * 3 + 1] = col[1]; paint[k * 3 + 2] = col[2]; }
    placed[key] = [+((found[0] + 0.5) / W).toFixed(5), +((found[1] + 0.5) / H).toFixed(5)];
  }
  // the texels nothing owns: filled from the nearest owned one (breadth first)
  { let front = []; for (let k = 0; k < W * H; k++) if (owner[k] !== -1) front.push(k);
    const done = Uint8Array.from(owner, (o) => (o !== -1 ? 1 : 0));
    while (front.length) { const next = []; for (const k of front) { const x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (done[j]) continue; done[j] = 1; paint.copy(paint, j * 3, k * 3, k * 3 + 3); next.push(j); } } front = next; } }
  const png = await sharp(paint, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: 16, dither: 0 }).toBuffer();
  return { paint, png, W, H, swatches: placed };
}

/** COLOR_0 from the repainted texture: a vertex's texel a little inside one of its triangles (`order`: which first). */
export function vertexColours({ V, I, paint, W, H, order, own = null }) {
  const n = V.P.length / 3, COL = new Uint8Array(n * 4), done = new Uint8Array(n);
  for (const t of order ?? Array.from({ length: I.length / 3 }, (_, k) => k)) {
    const tri = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], cu = tri.reduce((s, v) => s + V.UV[v * 2], 0) / 3, cv = tri.reduce((s, v) => s + V.UV[v * 2 + 1], 0) / 3;
    for (const v of tri) {
      if (done[v]) continue; done[v] = 1;
      const fixed = own?.(t); if (fixed) { COL.set([...fixed, 255], v * 4); continue; }
      const u = V.UV[v * 2] * 0.85 + cu * 0.15, w = V.UV[v * 2 + 1] * 0.85 + cv * 0.15;
      const k = Math.min(H - 1, Math.max(0, Math.floor(w * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(u * W)));
      for (let i = 0; i < 3; i++) COL[v * 4 + i] = paint[k * 3 + i]; COL[v * 4 + 3] = 255;
    }
  }
  return COL;
}

/** Least squares fit of a closed curve r(a) (or y(a)) as a Fourier series of order `order`. */
export function fourier(pts, key, order = 3) {
  const basis = (a) => [1, ...Array.from({ length: order }, (_, k) => [Math.cos((k + 1) * a), Math.sin((k + 1) * a)]).flat()];
  const nb = 1 + 2 * order, A = Array.from({ length: nb }, () => new Float64Array(nb + 1));
  for (const p of pts) { const f = basis(p.a); for (let i = 0; i < nb; i++) { for (let j = 0; j < nb; j++) A[i][j] += f[i] * f[j]; A[i][nb] += f[i] * p[key]; } }
  for (let i = 0; i < nb; i++) { let pv = i; for (let r = i + 1; r < nb; r++) if (Math.abs(A[r][i]) > Math.abs(A[pv][i])) pv = r; [A[i], A[pv]] = [A[pv], A[i]];
    for (let r = 0; r < nb; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let k = i; k <= nb; k++) A[r][k] -= f * A[i][k]; } }
  const co = A.map((row, i) => row[nb] / row[i]);
  return { co, at: (a) => basis(a).reduce((s, f, i) => s + f * co[i], 0) };
}
export const r4 = (a) => a.map((x) => +(+x).toFixed(4));
