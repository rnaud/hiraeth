// #800 family H (the two-legged foes): the shared steps of a biped's prepare (the dune mummer's recipe,
// ../mummer-tripo/prepare.mjs, with the skill's later rules: decimated by geometry alone, its parts painted by place):
//
// 1. Tripo's rigged export (biped, Mixamo names, 23 joints, no fingers) turned into the game's frame (Tripo: +x ahead,
//    +y up; the game: +z ahead) and scaled so its top is `height` m over the ground at size 1, feet on y = 0.
// 2. Decimated to `target` triangles by geometry alone (meshoptimizer `simplify`, LockBorder: the UV seams kept),
//    collapsing onto existing vertices, so every kept vertex keeps Tripo's own joints and weights.
// 3. The texture repainted by part: a median filter, k-means over the texels the mesh uses (deterministic), each
//    texel's part from its cluster, the triangle's limb (its weights) and its place on the mesh (`partAt`), painted in
//    the reference's own flat colour for that part (`palette`); the painted eyes painted out (they become their own
//    parts in the game); the texels between the UV islands filled from the nearest island.
// 4. COLOR_0 from the repainted texture (the engines' VMs decode no picture).
// 5. The skeleton: each joint's bind place (the inverse of its inverse bind matrix) in the game's frame and its parent;
//    the hands' measured centres (where a haft goes through); the painted eyes' measured centres and sizes.
// 6. Two files: the trial's `<foe>-lod.glb` (with its 1024² texture, for the trial page) and the game's
//    `public/enemies/<id>/body.glb` (16-bit indices, no picture, no UVs) with `skeleton.json` beside it.
//
// Deterministic: the same input writes the same bytes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '../../../..');
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
const CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
export const hexOf = (c) => '#' + [...c].map((y) => Math.round(y).toString(16).padStart(2, '0')).join('');
export const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const r4 = (x) => +x.toFixed(4);

/** The rigged export's arrays, its texture, its joints (Tripo's frame). */
export async function readRigged(file) {
  const b = readFileSync(file), jn = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
  const view = (i) => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
  const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const arr = new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT));
    if (a.normalized && A !== Float32Array) { const max = A === Uint8Array ? 255 : 65535; return Float32Array.from(arr, (x) => x / max); }
    return arr; };
  const prim = json.meshes[0].primitives[0], skin = json.skins[0];
  const meshNode = json.nodes.find((n) => n.mesh === 0);
  if (meshNode.matrix || meshNode.rotation || meshNode.scale || meshNode.translation) throw new Error('the mesh node has a transform');
  const img = json.images[json.textures[json.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source];
  const parent = new Map();
  json.nodes.forEach((nd, i) => { for (const ch of nd.children ?? []) parent.set(ch, i); });
  const names = skin.joints.map((ni) => json.nodes[ni].name.replace(/^mixamorig:/, ''));
  return { P: acc(prim.attributes.POSITION), N: acc(prim.attributes.NORMAL), UV: acc(prim.attributes.TEXCOORD_0), I: Uint32Array.from(acc(prim.indices)),
    J: acc(prim.attributes.JOINTS_0), W: acc(prim.attributes.WEIGHTS_0), IBM: acc(skin.inverseBindMatrices), image: Buffer.from(view(img.bufferView)),
    names, parents: skin.joints.map((ni) => { const pj = skin.joints.indexOf(parent.get(ni)); return pj >= 0 ? names[pj] : null; }) };
}

/** A rigid-plus-scale 4×4 (column major) inverted in general. */
function inv4(a) {
  const o = new Float64Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d;
  return o;
}

/**
 * Triangles split along a field's zero (f[v] < 0 inside, per vertex): each crossed edge gets a point on the line, twice
 * (one vertex for each side), its position, normal, uv, weights and every channel interpolated along the edge (the two
 * ends' weights mixed, the four largest kept, normalised). `triIn` each triangle's inside bits: a split one's pieces
 * keep their parent's, bit `bit` set by their side. Returns the new arrays, indices, channels and bits.
 */
export function cutAlong(out, I, f, channels, triIn, bit) {
  const P = [...out.P], N = [...out.N], UV = [...out.UV], J = [...out.J], W = [...out.W], chs = channels.map((c) => [...c]), made = new Map();
  const point = (a, b, inside) => {
    const key = `${Math.min(a, b)},${Math.max(a, b)},${inside ? 1 : 0}`;
    if (made.has(key)) return made.get(key);
    const t = f[a] / (f[a] - f[b]), id = P.length / 3;
    for (let q = 0; q < 3; q++) P.push(out.P[a * 3 + q] + (out.P[b * 3 + q] - out.P[a * 3 + q]) * t);
    const nn = [0, 1, 2].map((q) => out.N[a * 3 + q] + (out.N[b * 3 + q] - out.N[a * 3 + q]) * t), nl = Math.hypot(...nn) || 1;
    N.push(...nn.map((x) => x / nl));
    for (let q = 0; q < 2; q++) UV.push(out.UV[a * 2 + q] + (out.UV[b * 2 + q] - out.UV[a * 2 + q]) * t);
    const acc = new Map();
    for (const [v, k] of [[a, 1 - t], [b, t]]) for (let q = 0; q < 4; q++) { const w = out.W[v * 4 + q] * k; if (w > 0) acc.set(out.J[v * 4 + q], (acc.get(out.J[v * 4 + q]) ?? 0) + w); }
    const top = [...acc].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, 4), s = top.reduce((m, x) => m + x[1], 0) || 1;
    for (let q = 0; q < 4; q++) { J.push(top[q]?.[0] ?? 0); W.push(top[q] ? top[q][1] / s : 0); }
    channels.forEach((c, k) => chs[k].push(c === f ? 0 : c[a] + (c[b] - c[a]) * t));
    made.set(key, id);
    return id;
  };
  const tris = [], bits = [], on = 1 << bit;
  for (let t = 0; t < I.length; t += 3) {
    let [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    const ins = [a, b, c].map((v) => f[v] < 0), n = ins.filter(Boolean).length, was = triIn[t / 3] & ~on;
    // (whole: its side by its vertices' mean, a vertex on the line counting nothing)
    if (n === 0 || n === 3) { tris.push(a, b, c); bits.push(was | (f[a] + f[b] + f[c] < 0 ? on : 0)); continue; }
    // (the one alone on its side first, the winding kept)
    const lone = n === 1 ? ins.indexOf(true) : ins.indexOf(false);
    [a, b, c] = [[a, b, c], [b, c, a], [c, a, b]][lone];
    const inA = f[a] < 0;
    const ab = [point(a, b, inA), point(a, b, !inA)], ac = [point(a, c, inA), point(a, c, !inA)];
    tris.push(a, ab[0], ac[0], ab[1], b, c, ab[1], c, ac[1]);
    bits.push(was | (inA ? on : 0), was | (inA ? 0 : on), was | (inA ? 0 : on));
  }
  return { arrays: { P: Float32Array.from(P), N: Float32Array.from(N), UV: Float32Array.from(UV), COL: new Uint8Array((P.length / 3) * 4), J: Uint16Array.from(J), W: Float32Array.from(W) },
    I: Uint32Array.from(tris), channels: chs.map((c) => Float64Array.from(c)), triIn: Uint8Array.from(bits) };
}

/**
 * The whole preparation. cfg: { id, concept, rigged, height, target, K, tex, clusters: { hex: role }, palette: { part: hex },
 *   partAt(role, group, p, L) → part (L: the landmarks so far: at (joints), neckY, …), eyes: (p, role, L) → 0 | 1 | 2 (which
 *   painted eye a texel is), eyePaint: the part an eye is painted out to, extra(L, out) → more landmarks (the tail) }
 */
export async function prepare(cfg) {
  await MS.ready;
  const R = await readRigged(join(ROOT, cfg.rigged));
  const n0 = R.P.length / 3;
  let lo = Infinity, hi = -Infinity;
  for (let v = 0; v < n0; v++) { lo = Math.min(lo, R.P[v * 3 + 1]); hi = Math.max(hi, R.P[v * 3 + 1]); }
  const S = cfg.height / (hi - lo);
  // (centred on the hips: the rig stands its torso over its origin, and the ragdoll lays the body under the pelvis by the
  //  hips' height straight down its trunk; Tripo centres the box, and the prowler's long tail put its hips 34 cm ahead)
  const hips = inv4(R.IBM.subarray(R.names.indexOf('Hips') * 16, R.names.indexOf('Hips') * 16 + 16)).slice(12, 15);
  const cx = cfg.centre === false ? 0 : -hips[2] * S, cz = cfg.centre === false ? 0 : hips[0] * S;
  const toGame = (x, y, z) => [-z * S - cx, (y - lo) * S, x * S - cz];
  // ---------------------------------------------------------------- 1. the game's frame
  const P = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3);
  for (let v = 0; v < n0; v++) {
    const g = toGame(R.P[v * 3], R.P[v * 3 + 1], R.P[v * 3 + 2]); P.set(g, v * 3);
    N[v * 3] = -R.N[v * 3 + 2]; N[v * 3 + 1] = R.N[v * 3 + 1]; N[v * 3 + 2] = R.N[v * 3];
  }
  // ---------------------------------------------------------------- 2. decimated by geometry alone
  const [simp, err] = MS.simplify(R.I, P, 3, Math.min(R.I.length, cfg.target * 3), 0.05, ['LockBorder']);
  const used = new Int32Array(n0).fill(-1); let nv = 0;
  for (const i of simp) if (used[i] < 0) used[i] = nv++;
  const out = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2), COL: new Uint8Array(nv * 4), J: new Uint16Array(nv * 4), W: new Float32Array(nv * 4) };
  for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue;
    out.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); out.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); out.UV.set(R.UV.subarray(v * 2, v * 2 + 2), j * 2);
    let s = 0; for (let k = 0; k < 4; k++) s += R.W[v * 4 + k];
    for (let k = 0; k < 4; k++) { out.J[j * 4 + k] = R.J[v * 4 + k]; out.W[j * 4 + k] = s > 0 ? R.W[v * 4 + k] / s : k === 0 ? 1 : 0; } }
  let I = Uint32Array.from(simp, (i) => used[i]);
  const nvKept = nv;   // (the k-means samples the decimated mesh's own vertices, before any cut)
  // ---------------------------------------------------------------- 3. the texture: k-means, then each texel's part
  const TEX = cfg.tex ?? 1024, K = cfg.K;
  const { data: px, info } = await sharp(R.image).resize(TEX, TEX, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const usedIdx = new Set();
  for (let v = 0; v < nvKept; v++) { const x = Math.min(TEX - 1, Math.floor(out.UV[v * 2] * TEX)), y = Math.min(TEX - 1, Math.floor(out.UV[v * 2 + 1] * TEX)); usedIdx.add(y * TEX + x); }
  const sampleIdx = [...usedIdx].sort((a, b) => a - b);
  const lum = (i) => px[i * 3] * 0.3 + px[i * 3 + 1] * 0.59 + px[i * 3 + 2] * 0.11;
  const sorted = sampleIdx.slice().sort((a, b) => lum(a) - lum(b) || a - b);
  let C = Array.from({ length: K }, (_, k) => { const i = sorted[Math.floor(((k + 0.5) / K) * sorted.length)]; return [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]; });
  const near = (r, g, b) => { let best = 0, d = Infinity; for (let k = 0; k < C.length; k++) { const e = (r - C[k][0]) ** 2 + (g - C[k][1]) ** 2 + (b - C[k][2]) ** 2; if (e < d) { d = e; best = k; } } return best; };
  for (let it = 0; it < 24; it++) {
    const sum = C.map(() => [0, 0, 0, 0]);
    for (const i of sampleIdx) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); sum[k][0] += px[i * 3]; sum[k][1] += px[i * 3 + 1]; sum[k][2] += px[i * 3 + 2]; sum[k][3]++; }
    C = C.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
  }
  C = C.map((c) => c.map(Math.round));
  // (each cluster the part of the nearest of cfg.clusters' colours, within 16 of it in each channel: the decimation's
  //  rounding moves a cluster by a unit or two)
  const anchors = Object.entries(cfg.clusters).map(([h, role]) => [rgbOf(h), role]);
  const clusterRole = C.map((c) => { let best = null, d = Infinity; for (const [a, role] of anchors) { const e = Math.max(...a.map((x, i) => Math.abs(x - c[i]))); if (e < d) { d = e; best = role; } } return d <= 16 ? best : undefined; });
  if (clusterRole.some((r) => !r)) throw new Error(`clusters with no part: ${C.map((c, k) => `${hexOf(c)}=${clusterRole[k] ?? '?'}`).join(' ')}`);
  const TW = info.width, TH = info.height, cluster = new Uint8Array(TW * TH);
  for (let i = 0; i < TW * TH; i++) cluster[i] = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
  // ---------------------------------------------------------------- 2b. the parts' edges cut exactly on their lines
  // (cfg.cuts: [{ name, field(p) }: a field of the place, negative inside the part (the warlord's belly oval), or
  //  { name, roles, smooth }: the texture's own border round those roles, its vertices' share smoothed over their
  //  neighbours `smooth` times so the line runs clean through Tripo's ragged edge]. Every triangle across a cut's zero is
  //  split on it, the vertices on the cut made twice, one for each side, so each side's flat colour stops on the line
  //  (vertex colours would blend across a triangle); each triangle knows which parts it is inside: partAt's `inside`)
  const cuts = cfg.cuts ?? [];
  const texel = (v) => Math.min(TEX - 1, Math.floor(out.UV[v * 2 + 1] * TEX)) * TEX + Math.min(TEX - 1, Math.floor(out.UV[v * 2] * TEX));
  const pOf = (v) => [out.P[v * 3], out.P[v * 3 + 1], out.P[v * 3 + 2]];
  let ch = cuts.map((c) => {
    if (c.field) return Float64Array.from({ length: nv }, (_, v) => c.field(pOf(v)));
    let f = Float64Array.from({ length: nv }, (_, v) => (c.roles.includes(clusterRole[cluster[texel(v)]]) && (!c.only || c.only(pOf(v))) ? 1 : 0));
    const nb = Array.from({ length: nv }, () => new Set());
    for (let t = 0; t < I.length; t += 3) for (let q = 0; q < 3; q++) { nb[I[t + q]].add(I[t + (q + 1) % 3]); nb[I[t + q]].add(I[t + (q + 2) % 3]); }
    // (the welded neighbours too: a UV seam's twin vertices smooth as one surface)
    const key = (v) => pOf(v).map((x) => Math.round(x * 1e4)).join(','), twins = new Map();
    for (let v = 0; v < nv; v++) { const k = key(v); if (!twins.has(k)) twins.set(k, []); twins.get(k).push(v); }
    for (const list of twins.values()) if (list.length > 1) for (const v of list) for (const u of list) if (u !== v) for (const w of nb[u]) nb[v].add(w);
    for (let it = 0; it < (c.smooth ?? 4); it++) { const g = new Float64Array(nv); for (let v = 0; v < nv; v++) { let sum = f[v], k = 1; for (const u of nb[v]) { sum += f[u]; k++; } g[v] = sum / k; } f = g; }
    // (twins one value: the line crosses a seam at one point on both sides)
    for (const list of twins.values()) if (list.length > 1) { const m = list.reduce((s, v) => s + f[v], 0) / list.length; for (const v of list) f[v] = m; }
    return f.map((x) => 0.5 - x);
  });
  let triIn = new Uint8Array(I.length / 3);
  cuts.forEach((c, ci) => {
    const r = cutAlong(out, I, ch[ci], ch, triIn, ci);
    Object.assign(out, r.arrays); I = r.I; ch = r.channels; triIn = r.triIn;
  });
  nv = out.P.length / 3;
  const joints = R.names.map((name, j) => ({ name, parent: R.parents[j], at: toGame(...inv4(R.IBM.subarray(j * 16, j * 16 + 16)).slice(12, 15)).map(r4) }));
  const at = Object.fromEntries(joints.map((x) => [x.name, x.at]));
  const groupOf = (name) => (/(Arm|Hand)$/.test(name) ? 'arm' : /(UpLeg|Leg|Foot|ToeBase)$/.test(name) ? 'leg' : name === 'Head' || name === 'Neck' ? 'head' : 'body');
  const vGroup = new Array(nv);
  for (let v = 0; v < nv; v++) { let b = 0; for (let q = 1; q < 4; q++) if (out.W[v * 4 + q] > out.W[v * 4 + b]) b = q; vGroup[v] = groupOf(R.names[out.J[v * 4 + b]]); }
  const L = { at, scale: S, height: cfg.height, neckY: at.Neck[1], hipY: at.Hips[1] };
  const PAL = Object.fromEntries(Object.entries(cfg.palette).map(([k, h]) => [k, rgbOf(h)]));
  const paint = Buffer.alloc(TW * TH * 3), owner = new Int32Array(TW * TH).fill(-1), area = {};
  const eyePts = [[], [], []], markPts = {};
  const inside_ = (t) => Object.fromEntries(cuts.map((c, ci) => [c.name, !!(triIn[t] & (1 << ci))]));
  for (const pass of [0, 1]) for (let t = 0; t < I.length / 3; t++) {
    const [a, b, d] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], U = (v) => [out.UV[v * 2] * TW - 0.5, out.UV[v * 2 + 1] * TH - 0.5];
    const A = U(a), B = U(b), D = U(d), ar = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
    if (Math.abs(ar) < 1e-12) continue;
    const group = vGroup[b] === vGroup[d] ? vGroup[b] : vGroup[a];
    const mid = [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3].map(Math.round);
    const x0 = pass ? mid[0] : Math.max(0, Math.floor(Math.min(A[0], B[0], D[0]))), x1 = pass ? mid[0] : Math.min(TW - 1, Math.ceil(Math.max(A[0], B[0], D[0])));
    const y0 = pass ? mid[1] : Math.max(0, Math.floor(Math.min(A[1], B[1], D[1]))), y1 = pass ? mid[1] : Math.min(TH - 1, Math.ceil(Math.max(A[1], B[1], D[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= TW || y >= TH) continue;
      let w1 = ((B[0] - x) * (D[1] - y) - (B[1] - y) * (D[0] - x)) / ar, w2 = ((D[0] - x) * (A[1] - y) - (D[1] - y) * (A[0] - x)) / ar, w3 = 1 - w1 - w2;
      if (pass) { if (owner[y * TW + x] >= 0) continue; w1 = w2 = w3 = 1 / 3; }
      else if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
      const k = y * TW + x, inside = !pass && w1 >= 0 && w2 >= 0 && w3 >= 0;
      if (owner[k] >= 0 && !inside) continue;
      const p = [0, 1, 2].map((i) => w1 * out.P[a * 3 + i] + w2 * out.P[b * 3 + i] + w3 * out.P[d * 3 + i]), role = clusterRole[cluster[k]];
      const eye = cfg.eyes?.(p, role, L) ?? 0, mark = cfg.marks?.(p, role, L, inside_(t)) ?? null;
      const part = eye ? cfg.eyePaint : mark ? cfg.markPaint : cfg.partAt(role, group, p, L, inside_(t));
      if (eye && owner[k] < 0) eyePts[eye].push(p);
      if (mark && owner[k] < 0) (markPts[mark] ??= []).push(p);
      if (owner[k] < 0) area[part] = (area[part] ?? 0) + 1;
      owner[k] = t; paint.set(PAL[part], k * 3);
    }
  }
  { let front = []; for (let k = 0; k < TW * TH; k++) if (owner[k] >= 0) front.push(k);
    const done = Uint8Array.from(owner, (o) => (o >= 0 ? 1 : 0));
    while (front.length) { const next = []; for (const k of front) { const x = k % TW, y = (k / TW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= TW || yy >= TH) continue; const j = yy * TW + xx; if (done[j]) continue; done[j] = 1; paint.copy(paint, j * 3, k * 3, k * 3 + 3); next.push(j); } } front = next; } }
  const png = await sharp(paint, { raw: { width: TW, height: TH, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: Object.keys(PAL).length, dither: 0 }).toBuffer();
  // ---------------------------------------------------------------- 4. COLOR_0 from the repainted texture
  { const done = new Uint8Array(nv);
    for (let t = 0; t < I.length / 3; t++) {
      const tri = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], cu = tri.reduce((s, v) => s + out.UV[v * 2], 0) / 3, cv = tri.reduce((s, v) => s + out.UV[v * 2 + 1], 0) / 3;
      for (const v of tri) {
        if (done[v]) continue; done[v] = 1;
        const u = out.UV[v * 2] * 0.85 + cu * 0.15, w = out.UV[v * 2 + 1] * 0.85 + cv * 0.15;
        const k = Math.min(TH - 1, Math.max(0, Math.floor(w * TH))) * TW + Math.min(TW - 1, Math.max(0, Math.floor(u * TW)));
        for (let i = 0; i < 3; i++) out.COL[v * 4 + i] = paint[k * 3 + i];
        out.COL[v * 4 + 3] = 255;
      }
    } }
  // ---------------------------------------------------------------- 5. hands, eyes, the foe's own landmarks
  const hands = {};
  for (const side of ['Left', 'Right']) {
    const j = R.names.indexOf(`${side}Hand`), a = [0, 0, 0], mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    let k = 0;
    for (let v = 0; v < nv; v++) { let best = 0; for (let q = 1; q < 4; q++) if (out.W[v * 4 + q] > out.W[v * 4 + best]) best = q; if (out.J[v * 4 + best] !== j || out.W[v * 4 + best] < 0.5) continue;
      for (let q = 0; q < 3; q++) { const x = out.P[v * 3 + q]; a[q] += x; mn[q] = Math.min(mn[q], x); mx[q] = Math.max(mx[q], x); } k++; }
    hands[side] = { centre: a.map((x) => r4(x / k)), min: mn.map(r4), max: mx.map(r4), vertices: k };
  }
  const eyes = [1, 2].map((e) => { const pts = eyePts[e]; if (!pts.length) return null;
    const mn = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), mx = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
    return { centre: [0, 1, 2].map((i) => r4((mn[i] + mx[i]) / 2)), size: [0, 1, 2].map((i) => r4(mx[i] - mn[i])), front: r4(mx[2]), texels: pts.length }; });
  // (a painted line, the prowler's mouth: its texels binned 1 cm across x, each bin's middle; drawn as its own part)
  const marks = Object.fromEntries(Object.entries(markPts).map(([name, pts]) => { const bins = new Map();
    for (const p of pts) { const k = Math.round(p[0] * 100); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(p); }
    return [name, [...bins.keys()].sort((a, b) => a - b).filter((k) => bins.get(k).length >= 3).map((k) => { const b = bins.get(k); return [0, 1, 2].map((i) => r4(b.reduce((s, p) => s + p[i], 0) / b.length)); })]; }));
  // (each limb bone's girth: the vertices it leads, their distance off its segment to the next joint, the median and the
  //  most, m; what a plate of armour or a bracer is fitted to)
  const CHILD = { LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot' };
  const limbs = Object.fromEntries(Object.entries(CHILD).map(([name, child]) => {
    const j = R.names.indexOf(name), a = at[name], b = at[child], ab = [0, 1, 2].map((k) => b[k] - a[k]), l2 = ab.reduce((s, x) => s + x * x, 0), d = [];
    for (let v = 0; v < nv; v++) { let best = 0; for (let q = 1; q < 4; q++) if (out.W[v * 4 + q] > out.W[v * 4 + best]) best = q; if (out.J[v * 4 + best] !== j || out.W[v * 4 + best] < 0.6) continue;
      const ap = [0, 1, 2].map((k) => out.P[v * 3 + k] - a[k]), u = Math.max(0, Math.min(1, ap.reduce((s, x, k) => s + x * ab[k], 0) / l2));
      d.push(Math.hypot(...ap.map((x, k) => x - ab[k] * u))); }
    d.sort((x, y) => x - y);
    return [name, { median: r4(d[d.length >> 1] ?? 0), most: r4(d.at(-1) ?? 0), vertices: d.length }];
  }));
  const extra = { limbs, ...(cfg.extra ? cfg.extra({ ...L, joints, P: out.P, J: out.J, W: out.W, names: R.names, nv }) : {}) };
  const skeleton = { frame: 'game: +z ahead, +y up, metres, feet on y 0', source: cfg.rigged, tasks: cfg.tasks, scale: +S.toFixed(5), height: cfg.height,
    joints, hands, eyes, ...(Object.keys(marks).length ? { marks } : {}), ...extra, clusters: C.map(hexOf), palette: cfg.palette };
  // ---------------------------------------------------------------- 6. the files
  if (cfg.dry) return { report: null, out, I, L, skeleton };
  const trial = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: out.COL, JOINTS_0: out.J, WEIGHTS_0: out.W }, indices: I, image: png, name: `${cfg.id} tripo lod`,
    extras: { source: cfg.rigged, tasks: cfg.tasks, triangles: I.length / 3, simplifyError: +err.toFixed(5), joints: R.names } });
  writeFileSync(join(HERE, `${cfg.id}-lod.glb`), trial);
  writeFileSync(join(HERE, `${cfg.id}-texture.png`), png);
  if (nv > 65535) throw new Error('too many vertices for 16-bit indices');
  const game = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, COLOR_0: out.COL, JOINTS_0: out.J, WEIGHTS_0: out.W }, indices: Uint16Array.from(I), name: `${cfg.id} tripo body`,
    extras: { source: cfg.rigged, tasks: cfg.tasks, triangles: I.length / 3, joints: R.names } });
  const dir = join(ROOT, 'public/enemies', cfg.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'body.glb'), game);
  writeFileSync(join(dir, 'skeleton.json'), JSON.stringify(skeleton, null, 1) + '\n');
  const sha = (x) => createHash('sha256').update(x).digest('hex').slice(0, 16);
  const report = { source: { vertices: n0, triangles: R.I.length / 3, joints: joints.length }, lod: { vertices: nv, triangles: I.length / 3, error: +err.toFixed(5), trialBytes: trial.length, gameBytes: game.length, sha: sha(game) },
    texture: { size: TEX, clusters: skeleton.clusters, texels: area, pngBytes: png.length }, hands, eyes, extra: Object.keys(extra), scale: S };
  return { report, out, I, L, skeleton };
}
