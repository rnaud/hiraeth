// #800 phase 2a: the shellback's Tripo export (the shellback folder's tripo/model.glb, untouched) made into the trial's
// game asset (tripo-lod.glb beside this script) and its rig landmarks (landmarks.json):
//
// 1. Turned into the game's frame (Tripo: +x ahead, +y up; the game: +z ahead) and scaled to the direct shellback's
//    height (SHELLBACK.height m, feet on y = 0), so both are built to the same size.
// 2. The 2048² baked texture flattened: brought down to 1024², a median filter over the brush noise, then every texel
//    snapped to the nearest of a few flat colours (k-means over the texture: the dome's ochre, the cream legs and face,
//    the red feet and claws, the green collar, the eyes' black, the shadow under the rim). Remove Lighting was on
//    (the API's `delight`), so what shading it still has is broad; the snap takes most of what is left.
// 3. Vertex colours sampled from the flat texture (COLOR_0): the engines' VMs decode no PNG/JPEG (#264).
// 4. Decimated to TARGET triangles with meshoptimizer's attribute-aware simplifier (the colour zones' borders and the
//    UV seams kept), collapsing onto existing vertices.
// 5. The landmarks the trial's rig is fitted to (game frame, m): each leg's hip, knee, ankle and foot; each claw's
//    shoulder, knuckle, inner finger, blade tip; the eyes; the dome's lip and crown. Measured from the mesh's own
//    vertex columns (inspect.mjs's splats and the leg columns above each foot), not guessed from the direct model.
// 6. The dome cut along its lip by geometry (the phase 2a fixes): the lip is the dome's outermost edge, measured per
//    azimuth and smoothed into one closed curve (a low Fourier series), every triangle across it split exactly on it,
//    and what lies over it and joins the crown is the dome (its triangles first in the index; landmarks.domeTriangles).
//    Phase 2a cut by colour, triangle by triangle: a ragged line half way down the dome, lit and shadowed apart.
// 7. The texture repainted by part, one flat colour a role (the reference's own, as the direct body wears them): the
//    k-means' second ochre, second cream, the yellow-green and darker ochre of the borders (the shading Tripo left)
//    folded into their role; nothing ochre under the lip (its underside dark, the face and back cream); the painted
//    eyes painted out (the eyes are their own parts now, they look at the traveller), the texels between the islands
//    filled from their nearest island (no other colour bleeds in as the texture's smaller mips are read).
//
//   node references/enemy-redesign-2026-10-30/trials/shellback-tripo/prepare.mjs [--target 12000]
// Deterministic: the same input writes the same bytes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { readTripo, sample, writeGlb } from './glb.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/shellback/tripo/model.glb');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TARGET = +opt('--target', 12000), K = +opt('--colours', 9), TEX = 1024;
/** The direct shellback's crown over the ground (src/enemies/plans/shellback.js SHELLBACK.height). */
const HEIGHT = 1.55;
/** One flat colour a role: the reference's own (the direct shellback's home skin, plans/shellback.js OWN.arzach2). */
export const PALETTE = { shell: '#df9f45', leg: '#f1e2ae', claw: '#c75f3a', collar: '#6f9d72', dark: '#3a2c22' };
/** The lip's cut under its outermost edge (m): the edge's own roll stays on the dome. */
const LIP_DROP = 0.025;
await MS.ready;

const m = await readTripo(IN);
const n0 = m.P.length / 3;
let lo = Infinity, hi = -Infinity;
for (let v = 0; v < n0; v++) { lo = Math.min(lo, m.P[v * 3 + 1]); hi = Math.max(hi, m.P[v * 3 + 1]); }
const S = HEIGHT / (hi - lo);
/** Tripo's frame → the game's (x ahead → z ahead; y up; the feet on 0), m. */
const toGame = (x, y, z) => [-z * S, (y - lo) * S, x * S];

// ------------------------------------------------------------------ 2. the flat colours (k-means)
const { data: px, info } = await sharp(m.image.bytes).resize(TEX, TEX, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
// k-means over every 7th texel, seeded deterministically by luminance quantiles
const sampleIdx = []; for (let i = 0; i < info.width * info.height; i += 7) sampleIdx.push(i);
const lum = (i) => px[i * 3] * 0.3 + px[i * 3 + 1] * 0.59 + px[i * 3 + 2] * 0.11;
const sorted = sampleIdx.slice().sort((a, b) => lum(a) - lum(b));
let C = Array.from({ length: K }, (_, k) => { const i = sorted[Math.floor(((k + 0.5) / K) * sorted.length)]; return [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]; });
const near = (r, g, b) => { let best = 0, d = Infinity; for (let k = 0; k < C.length; k++) { const e = (r - C[k][0]) ** 2 + (g - C[k][1]) ** 2 + (b - C[k][2]) ** 2; if (e < d) { d = e; best = k; } } return best; };
for (let it = 0; it < 18; it++) {
  const sum = C.map(() => [0, 0, 0, 0]);
  for (const i of sampleIdx) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); sum[k][0] += px[i * 3]; sum[k][1] += px[i * 3 + 1]; sum[k][2] += px[i * 3 + 2]; sum[k][3]++; }
  C = C.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
}
C = C.map((c) => c.map(Math.round));
const W = info.width, H = info.height;
/** Each texel's cluster. */
const cluster = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) cluster[i] = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
/** Each cluster's role, by its hue (the k-means finds two ochres, two creams and the borders' in-betweens). */
const roleOf = C.map(([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
  if (l < 0.25) return 'dark';
  const d = mx - mn || 1, h = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return h < 28 ? 'claw' : h < 46 ? 'shell' : h < 85 ? 'leg' : 'collar';
});

// ------------------------------------------------------------------ 1, 3. positions in the game's frame, colours
const P = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3), COL = new Uint8Array(n0 * 4), ATT = new Float32Array(n0 * 3), c = [0, 0, 0];
for (let v = 0; v < n0; v++) {
  const [x, y, z] = toGame(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]);
  P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
  N[v * 3] = -m.N[v * 3 + 2]; N[v * 3 + 1] = m.N[v * 3 + 1]; N[v * 3 + 2] = m.N[v * 3];
  sample(m.tex, m.UV[v * 2], m.UV[v * 2 + 1], c);   // (the median'd source, snapped: no blend across a zone's border)
  const k = near(c[0], c[1], c[2]);
  COL[v * 4] = C[k][0]; COL[v * 4 + 1] = C[k][1]; COL[v * 4 + 2] = C[k][2]; COL[v * 4 + 3] = 255;
  ATT[v * 3] = C[k][0] / 255; ATT[v * 3 + 1] = C[k][1] / 255; ATT[v * 3 + 2] = C[k][2] / 255;
}

// ------------------------------------------------------------------ 4. decimated
const [simp, err] = MS.simplifyWithAttributes(m.I, P, 3, ATT, 3, [0.6, 0.6, 0.6], null, Math.min(m.I.length, TARGET * 3), 0.05, ['LockBorder']);
const used = new Int32Array(n0).fill(-1); let nv = 0;
for (const i of simp) if (used[i] < 0) used[i] = nv++;
const lod = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2), COL: new Uint8Array(nv * 4) };
for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue;
  lod.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); lod.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); lod.UV.set(m.UV.subarray(v * 2, v * 2 + 2), j * 2); lod.COL.set(COL.subarray(v * 4, v * 4 + 4), j * 4); }
const I0 = Uint32Array.from(simp, (i) => used[i]);
const decimated = I0.length / 3;

// ------------------------------------------------------------------ 5. landmarks (Tripo frame, then the game's)
// (the leg columns over each foot: shin straight up from the foot to y -0.15, the knee's outer bulge at y -0.07,
//  the thigh in under the rim at |z| 0.2; feet at x -0.204, 0.018, 0.183, the front pair nearer in, |z| 0.31)
const T = (x, y, z) => toGame(x, y, z).map((a) => +a.toFixed(4));
const legs = [];
for (const s of [1, -1]) for (const [x, fz] of [[0.183, 0.306], [0.018, 0.425], [-0.204, 0.426]]) {
  const front = x > 0.1;
  legs.push({ side: s, hip: T(x, 0.0, s * 0.19), knee: T(x + (front ? -0.01 : 0), -0.07, s * (front ? 0.29 : 0.355)), ankle: T(x, -0.235, s * (fz - 0.02)), foot: T(x, lo, s * fz) });
}
// each claw (game frame, from the claw's own red surface walked out from where it joins the body: geodesic bands of
// 15 cm, their centroids): a ball pressed against the face's side (the shoulder, its top where it joins the body), the
// inner finger rising from its front up to the knuckle at the top of the arch, the blade hanging from the knuckle in
// front to its tip. The jaw is the gap under the arch, between the inner finger and the blade.
const claws = [1, -1].map((s) => { const g = (x, y, z) => [+(-s * x).toFixed(4), y, z];
  return { side: s, shoulder: g(0.40, 0.73, 0.60), elbow: g(0.39, 0.47, 0.63), knuckle: g(0.53, 0.92, 0.90), finger: g(0.45, 0.56, 0.71), hand: g(0.5809, 0.8696, 1.0808), tip: g(0.5674, 0.2832, 1.1943) }; });

// ------------------------------------------------------------------ 6. the dome cut along its lip
const cz = (legs[0].hip[2] + legs[2].hip[2]) / 2;   // (the body's middle, between the front and back hips)
const az = (x, z) => Math.atan2(x, z - cz);
const isRole = (v, r) => roleOf[near(lod.COL[v * 4], lod.COL[v * 4 + 1], lod.COL[v * 4 + 2])] === r;
// its outermost edge per azimuth (the dome's widest point there, among its own surface: over 0.6 m and ochre)
const BINS = 48, edge = Array.from({ length: BINS }, () => null);
for (let v = 0; v < nv; v++) {
  const x = lod.P[v * 3], y = lod.P[v * 3 + 1], z = lod.P[v * 3 + 2]; if (y < 0.6 || !isRole(v, 'shell')) continue;
  const a = az(x, z), b = Math.floor(((a + Math.PI) / (2 * Math.PI)) * BINS) % BINS, r = Math.hypot(x, z - cz);
  if (!edge[b] || r > edge[b].r) edge[b] = { a, r, y };
}
// one closed curve through them: a Fourier series of order 3 by least squares, the stray points (a claw's root, a
// fold) dropped twice
const ORDER = 3, basis = (a) => [1, ...Array.from({ length: ORDER }, (_, k) => [Math.cos((k + 1) * a), Math.sin((k + 1) * a)]).flat()];
function fit(pts, key) {
  const nb = 1 + 2 * ORDER, A = Array.from({ length: nb }, () => new Float64Array(nb + 1));
  for (const p of pts) { const f = basis(p.a); for (let i = 0; i < nb; i++) { for (let j = 0; j < nb; j++) A[i][j] += f[i] * f[j]; A[i][nb] += f[i] * p[key]; } }
  for (let i = 0; i < nb; i++) { let pv = i; for (let r = i + 1; r < nb; r++) if (Math.abs(A[r][i]) > Math.abs(A[pv][i])) pv = r; [A[i], A[pv]] = [A[pv], A[i]];
    for (let r = 0; r < nb; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let k = i; k <= nb; k++) A[r][k] -= f * A[i][k]; } }
  return A.map((row, i) => row[nb] / row[i]);
}
const evalF = (co, a) => basis(a).reduce((s, f, i) => s + f * co[i], 0);
let pts = edge.filter(Boolean), rimY = fit(pts, 'y');
for (let round = 0; round < 2; round++) { pts = pts.filter((p) => Math.abs(p.y - evalF(rimY, p.a)) < 0.045); rimY = fit(pts, 'y'); }
const rimR = fit(pts, 'r');
const cut = (x, y, z) => y - (evalF(rimY, az(x, z)) - LIP_DROP);   // (over 0: above the cut)
// the triangles that reach over the cut and join the crown (welded across UV seams), flood filled from the crown
const weld = new Int32Array(nv); { const seen = new Map(); for (let v = 0; v < nv; v++) { const k = `${Math.round(lod.P[v * 3] * 2e4)},${Math.round(lod.P[v * 3 + 1] * 2e4)},${Math.round(lod.P[v * 3 + 2] * 2e4)}`; if (!seen.has(k)) seen.set(k, v); weld[v] = seen.get(k); } }
const F = new Float32Array(nv); for (let v = 0; v < nv; v++) F[v] = cut(lod.P[v * 3], lod.P[v * 3 + 1], lod.P[v * 3 + 2]);
const triOf = new Map(); for (let t = 0; t < decimated; t++) for (let k = 0; k < 3; k++) { const w = weld[I0[t * 3 + k]]; if (!triOf.has(w)) triOf.set(w, []); triOf.get(w).push(t); }
let crown = 0; for (let v = 0; v < nv; v++) if (lod.P[v * 3 + 1] > lod.P[crown * 3 + 1]) crown = v;
const reach = new Uint8Array(decimated), queue = [...triOf.get(weld[crown])];
for (const t of queue) reach[t] = 1;
while (queue.length) {
  const t = queue.pop();
  for (let k = 0; k < 3; k++) { const v = I0[t * 3 + k]; if (F[v] <= 0) continue; for (const u of triOf.get(weld[v])) if (!reach[u]) { reach[u] = 1; queue.push(u); } }
}
// split the reached triangles across the cut: a new vertex on each crossed edge (shared by the edge's two triangles)
const V = { P: Array.from(lod.P), N: Array.from(lod.N), UV: Array.from(lod.UV), COL: Array.from(lod.COL) };
const onEdge = new Map();
const cross = (a, b) => {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`; if (onEdge.has(key)) return onEdge.get(key);
  // (the crossing found on the curve itself, not on a straight F: a few bisections)
  let t0 = 0, t1 = 1; const fa = F[a];
  const at = (t, k) => lod.P[a * 3 + k] + (lod.P[b * 3 + k] - lod.P[a * 3 + k]) * t;
  for (let i = 0; i < 24; i++) { const t = (t0 + t1) / 2, f = cut(at(t, 0), at(t, 1), at(t, 2)); if ((f > 0) === (fa > 0)) t0 = t; else t1 = t; }
  const t = (t0 + t1) / 2, j = V.P.length / 3;
  for (let k = 0; k < 3; k++) V.P.push(at(t, k));
  const nn = [0, 1, 2].map((k) => lod.N[a * 3 + k] + (lod.N[b * 3 + k] - lod.N[a * 3 + k]) * t), nl = Math.hypot(...nn) || 1; V.N.push(...nn.map((x) => x / nl));
  for (let k = 0; k < 2; k++) V.UV.push(lod.UV[a * 2 + k] + (lod.UV[b * 2 + k] - lod.UV[a * 2 + k]) * t);
  for (let k = 0; k < 4; k++) V.COL.push(lod.COL[(fa > 0 ? b : a) * 4 + k]);
  onEdge.set(key, j); return j;
};
const domeIdx = [], restIdx = [];
for (let t = 0; t < decimated; t++) {
  const tri = [I0[t * 3], I0[t * 3 + 1], I0[t * 3 + 2]];
  if (!reach[t]) { restIdx.push(...tri); continue; }
  const up = tri.map((v) => F[v] > 0), nUp = up.filter(Boolean).length;
  if (nUp === 3) { domeIdx.push(...tri); continue; }
  if (nUp === 0) { restIdx.push(...tri); continue; }
  // (rotated so the lone vertex comes first, the winding kept)
  const lone = nUp === 1 ? up.indexOf(true) : up.indexOf(false), [a, b, d] = [tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]];
  const ab = cross(a, b), ad = cross(a, d);
  const [loneSide, pairSide] = nUp === 1 ? [domeIdx, restIdx] : [restIdx, domeIdx];
  loneSide.push(a, ab, ad); pairSide.push(ab, b, d, ab, d, ad);
}
const nV = V.P.length / 3;
const out = { P: Float32Array.from(V.P), N: Float32Array.from(V.N), UV: Float32Array.from(V.UV), COL: Uint8Array.from(V.COL) };
const I = Uint32Array.from([...domeIdx, ...restIdx]);
const domeTriangles = domeIdx.length / 3;

// ------------------------------------------------------------------ 7. the texture repainted by part
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, hex(h)]));
const paint = Buffer.alloc(W * H * 3), owner = new Int32Array(W * H).fill(-1);   // (owner: the triangle whose texel it is)
const removed = [];   // (the painted eyes' texels: where they were, the eye parts' places)
const isDomeTri = (t) => t < domeTriangles;
// (two passes: every texel whose middle is in a triangle, then, for a triangle too small to hold one, the texel under
//  its own middle if no other owns it)
for (const pass of [0, 1]) for (let t = 0; t < I.length / 3; t++) {
  const [a, b, d] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], U = (v) => [out.UV[v * 2] * W - 0.5, out.UV[v * 2 + 1] * H - 0.5];
  const A = U(a), B = U(b), D = U(d), area = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
  if (Math.abs(area) < 1e-12) continue;
  const mid = [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3].map(Math.round);
  const x0 = pass ? mid[0] : Math.max(0, Math.floor(Math.min(A[0], B[0], D[0]))), x1 = pass ? mid[0] : Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], D[0])));
  const y0 = pass ? mid[1] : Math.max(0, Math.floor(Math.min(A[1], B[1], D[1]))), y1 = pass ? mid[1] : Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], D[1])));
  const ny = (out.N[a * 3 + 1] + out.N[b * 3 + 1] + out.N[d * 3 + 1]) / 3;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    let w1 = ((B[0] - x) * (D[1] - y) - (B[1] - y) * (D[0] - x)) / area, w2 = ((D[0] - x) * (A[1] - y) - (D[1] - y) * (A[0] - x)) / area, w3 = 1 - w1 - w2;
    if (pass) { if (owner[y * W + x] >= 0) continue; w1 = w2 = w3 = 1 / 3; }
    else if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;   // (a hair over the edge: the border texels the sampler reads)
    const k = y * W + x, inside = !pass && w1 >= 0 && w2 >= 0 && w3 >= 0;
    if (owner[k] >= 0 && !inside) continue;
    const p = [0, 1, 2].map((i) => w1 * out.P[a * 3 + i] + w2 * out.P[b * 3 + i] + w3 * out.P[d * 3 + i]);
    let role = roleOf[cluster[k]];
    if (isDomeTri(t)) role = 'shell';
    else if (role === 'shell') role = ny < -0.15 || p[1] > evalF(rimY, az(p[0], p[2])) - LIP_DROP - 0.05 ? 'dark' : 'leg';   // (nothing ochre under the lip)
    else if (role === 'leg' && C[cluster[k]][2] > 110 && C[cluster[k]][0] < 200) role = p[1] < 0.6 ? 'collar' : 'leg';   // (the yellow-green of a border)
    // (the face, under the lip between the claws: all cream, the painted eyes and their borders' specks painted out)
    if (!isDomeTri(t) && Math.abs(p[0]) < 0.24 && p[2] > 0.6 && p[1] > 0.62 && p[1] < evalF(rimY, az(p[0], p[2])) - LIP_DROP - 0.03) { if (role === 'dark' && inside) removed.push(p); role = 'leg'; }
    owner[k] = t; const col = PAL[role]; paint[k * 3] = col[0]; paint[k * 3 + 1] = col[1]; paint[k * 3 + 2] = col[2];
  }
}
// the texels no triangle owns: filled from the nearest owned one (breadth first), so no mip mixes another island in
{ let front = []; for (let k = 0; k < W * H; k++) if (owner[k] >= 0) front.push(k);
  const done = Uint8Array.from(owner, (o) => (o >= 0 ? 1 : 0));
  while (front.length) { const next = []; for (const k of front) { const x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (done[j]) continue; done[j] = 1; paint.copy(paint, j * 3, k * 3, k * 3 + 3); next.push(j); } } front = next; } }
const png = await sharp(paint, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: 8, dither: 0 }).toBuffer();
writeFileSync(join(HERE, 'flat-texture.png'), png);
// the vertex colours from the repainted texture: its texel a little inside one of the vertex's triangles (a vertex on an
// island's edge would read the next island's), the skin's triangles first (the lip's vertices are both meshes', and
// the dome is drawn in one flat colour of its own)
{ const done = new Uint8Array(nV), order = [...Array.from({ length: I.length / 3 - domeTriangles }, (_, k) => k + domeTriangles), ...Array.from({ length: domeTriangles }, (_, k) => k)];
  for (const t of order) {
    const tri = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], cu = tri.reduce((s, v) => s + out.UV[v * 2], 0) / 3, cv = tri.reduce((s, v) => s + out.UV[v * 2 + 1], 0) / 3;
    for (const v of tri) { if (done[v]) continue; done[v] = 1;
      if (t < domeTriangles) { out.COL.set([...PAL.shell, 255], v * 4); continue; }   // (the dome's own: all ochre)
      const u =out.UV[v * 2] * 0.85 + cu * 0.15, w = out.UV[v * 2 + 1] * 0.85 + cv * 0.15;
      const k = Math.min(H - 1, Math.max(0, Math.floor(w * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(u * W)));
      for (let i = 0; i < 3; i++) out.COL[v * 4 + i] = paint[k * 3 + i]; out.COL[v * 4 + 3] = 255; }
  } }
// the eyes where they were painted: each side's removed texels, their middle, height and width
const eyes = [1, -1].map((s) => { const q = removed.filter((p) => -s * p[0] > 0.02); if (!q.length) return null;
  const mid = [0, 1, 2].map((i) => q.reduce((t, p) => t + p[i], 0) / q.length), span = (i) => Math.max(...q.map((p) => p[i])) - Math.min(...q.map((p) => p[i]));
  return { side: s, at: mid.map((x) => +x.toFixed(4)), size: [+span(0).toFixed(3), +span(1).toFixed(3)], texels: q.length }; });

let rim = -Infinity; for (let v = 0; v < n0; v++) if (Math.abs(m.P[v * 3 + 2]) < 0.02 && m.P[v * 3] < -0.4) rim = Math.max(rim, m.P[v * 3 + 1]);
const r4 = (a) => a.map((x) => +x.toFixed(5));
const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0', scale: +S.toFixed(5), height: HEIGHT, legs, claws, eyes,
  rimBack: +((rim - lo) * S).toFixed(4), crown: HEIGHT,
  lip: { centre: [0, +cz.toFixed(4)], drop: LIP_DROP, order: ORDER, y: r4(rimY), r: r4(rimR), note: 'y and r of the lip at azimuth a = atan2(x, z - centre z): c0 + Σ ck cos(ka) + sk sin(ka), (c0, c1, s1, c2, s2, …); the cut is LIP_DROP under y' },
  domeTriangles, palette: PALETTE, clusters: C.map((c, k) => ({ colour: '#' + c.map((x) => x.toString(16).padStart(2, '0')).join(''), role: roleOf[k] })) };
writeFileSync(join(HERE, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');

const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: out.COL }, indices: I, image: png, name: 'shellback tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/shellback/tripo/model.glb', task: '5f2aa15f-678e-4969-b6d9-39852b47c598', triangles: I.length / 3, domeTriangles, simplifyError: +err.toFixed(5) } });
writeFileSync(join(HERE, 'tripo-lod.glb'), glb);
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: n0, triangles: m.I.length / 3, texture: [m.tex.w, m.tex.h] }, lod: { vertices: nV, triangles: I.length / 3, decimated, dome: domeTriangles, split: onEdge.size, error: +err.toFixed(5), bytes: glb.length, sha: sha(glb) },
  lip: { points: pts.length, of: edge.filter(Boolean).length }, texture: { size: TEX, clusters: landmarks.clusters, pngBytes: png.length }, scale: S, eyes }));
