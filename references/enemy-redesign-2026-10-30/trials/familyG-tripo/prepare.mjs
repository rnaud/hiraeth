// #800 family G: a foe's rigged Tripo export (<concept>/tripo/rigged.glb, untouched: Tripo's biped rig, Mixamo names, 23
// joints, no fingers) made into the game's asset, public/enemies/<id>/body.glb, and its skeleton, skeleton.json beside it
// (src/enemies/foe-assets.js loads the two; src/enemies/plans/tripo-biped.js poses the rig on them). The dune mummer's
// recipe (trials/mummer-tripo/prepare.mjs), its steps shared, each foe's numbers and parts in FOES (foes.mjs):
//
// 1. The game's frame (Tripo: +x ahead; the game: +z ahead), scaled so the top is HEIGHT m over the ground at size 1,
//    the feet on y = 0.
// 2. The 2048² baked texture: 1024², a median filter, k-means into K colours over the texels the mesh uses; each
//    cluster given its role by the foe's table (CLUSTERS: the cluster's hex → its role), printed when the table is
//    missing (--probe) so it is written by looking, never guessed.
// 3. Decimated to TARGET triangles by geometry alone (meshoptimizer, LockBorder: UV seams kept, no colour weighting:
//    the wood cutter's lesson), so every kept vertex keeps Tripo's own joints and weights.
// 4. The hands: optionally widened (WIDEN: the T-pose sheets drew them narrower than the approved image) and each
//    hand's centre measured (where a haft goes through it).
// 5. Repainted by part: each texel's part from its cluster's role, its triangle's limb (from the weights) and its place
//    (the foe's partAt), painted in the reference's own flat colour for that part (PALETTE, measured off the approved
//    image); the gaps between UV islands filled from the nearest island; COLOR_0 from the repainted texture (a texel a
//    little inside one of the vertex's triangles).
// 6. The joints' bind places (the inverse of the inverse bind matrices) in the game's frame, and the foe's landmarks
//    (its painted eyes' places, its props' anchors: the foe's `landmarks`), into skeleton.json.
//
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/prepare.mjs <mummerking|sentinel|hulk> [--probe]
// Deterministic: the same input writes the same bytes. The flat texture stays here (<id>-texture.png): the game draws
// the vertex colours.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { FOES } from './foes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const id = process.argv[2], F = FOES[id];
if (!F) throw new Error(`which foe? ${Object.keys(FOES).join(', ')}`);
const PROBE = process.argv.includes('--probe') || !F.clusters;
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30', F.concept, 'tripo/rigged.glb');
const OUTDIR = join(ROOT, 'public/enemies', id);
const TARGET = F.target ?? 12000, K = F.k ?? 10, TEX = 1024;
const smooth = (w) => w * w * (3 - 2 * w);
await MS.ready;

// ------------------------------------------------------------------ the rigged export
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
const CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const b = readFileSync(IN), jn = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const view = (i) => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const arr = new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT));
  if (a.normalized && A !== Float32Array) { const max = A === Uint8Array ? 255 : 65535; return Float32Array.from(arr, (x) => x / max); }
  return arr; };
const prim = json.meshes[0].primitives[0], skin = json.skins[0];
const P0 = acc(prim.attributes.POSITION), N0 = acc(prim.attributes.NORMAL), UV = acc(prim.attributes.TEXCOORD_0), I0 = Uint32Array.from(acc(prim.indices));
const J0 = acc(prim.attributes.JOINTS_0), W0 = acc(prim.attributes.WEIGHTS_0), IBM = acc(skin.inverseBindMatrices);
const img = json.images[json.textures[json.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source];
const imgBytes = Buffer.from(view(img.bufferView));
const { data: srcPx, info: srcInfo } = await sharp(imgBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const srcTex = { px: srcPx, w: srcInfo.width, h: srcInfo.height };
const meshNode = json.nodes.find((n) => n.mesh === 0);
if (meshNode.matrix || meshNode.rotation || meshNode.scale || meshNode.translation) throw new Error('the mesh node has a transform');
const n0 = P0.length / 3;
let lo = Infinity, hi = -Infinity;
for (let v = 0; v < n0; v++) { lo = Math.min(lo, P0[v * 3 + 1]); hi = Math.max(hi, P0[v * 3 + 1]); }
const S = F.height / (hi - lo);
/** Tripo's frame → the game's (x ahead → z ahead; y up; the feet on 0), m. */
const toGame = (x, y, z) => [-z * S, (y - lo) * S, x * S];

// ------------------------------------------------------------------ 2. the flat clusters
const { data: px, info } = await sharp(imgBytes).resize(TEX, TEX, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const usedIdx = new Set();
for (let v = 0; v < n0; v++) { const x = Math.min(TEX - 1, Math.floor(UV[v * 2] * TEX)), y = Math.min(TEX - 1, Math.floor(UV[v * 2 + 1] * TEX)); usedIdx.add(y * TEX + x); }
const sampleIdx = [...usedIdx].sort((a, b2) => a - b2);
const lum = (i) => px[i * 3] * 0.3 + px[i * 3 + 1] * 0.59 + px[i * 3 + 2] * 0.11;
const sorted = sampleIdx.slice().sort((a, b2) => lum(a) - lum(b2) || a - b2);
let C = Array.from({ length: K }, (_, k) => { const i = sorted[Math.floor(((k + 0.5) / K) * sorted.length)]; return [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]; });
const near = (r, g, b2) => { let best = 0, d = Infinity; for (let k = 0; k < C.length; k++) { const e = (r - C[k][0]) ** 2 + (g - C[k][1]) ** 2 + (b2 - C[k][2]) ** 2; if (e < d) { d = e; best = k; } } return best; };
for (let it = 0; it < 24; it++) {
  const sum = C.map(() => [0, 0, 0, 0]);
  for (const i of sampleIdx) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); sum[k][0] += px[i * 3]; sum[k][1] += px[i * 3 + 1]; sum[k][2] += px[i * 3 + 2]; sum[k][3]++; }
  C = C.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
}
C = C.map((c) => c.map(Math.round));
const hexOf = (c) => '#' + [...c].map((y) => y.toString(16).padStart(2, '0')).join('');
const flat = Buffer.alloc(px.length), cluster = new Uint8Array(info.width * info.height);
for (let i = 0; i < info.width * info.height; i++) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); cluster[i] = k; flat[i * 3] = C[k][0]; flat[i * 3 + 1] = C[k][1]; flat[i * 3 + 2] = C[k][2]; }

// ------------------------------------------------------------------ 1. positions in the game's frame; each vertex's cluster
const P = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3), c = [0, 0, 0], vClu = new Uint8Array(n0), vRGB = new Uint8Array(n0 * 3);
for (let v = 0; v < n0; v++) {
  const [x, y, z] = toGame(P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]);
  P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
  N[v * 3] = -N0[v * 3 + 2]; N[v * 3 + 1] = N0[v * 3 + 1]; N[v * 3 + 2] = N0[v * 3];
  sample(srcTex, UV[v * 2], UV[v * 2 + 1], c); vClu[v] = near(c[0], c[1], c[2]); for (let q = 0; q < 3; q++) vRGB[v * 3 + q] = Math.round(c[q]);
}

// ------------------------------------------------------------------ 3. decimated by geometry alone (the weights ride their vertices)
const [simp, err] = MS.simplify(I0, P, 3, Math.min(I0.length, TARGET * 3), 0.05, ['LockBorder']);
const used = new Int32Array(n0).fill(-1); let nv = 0;
for (const i of simp) if (used[i] < 0) used[i] = nv++;
const out = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2), COL: new Uint8Array(nv * 4), J: new Uint16Array(nv * 4), W: new Float32Array(nv * 4), clu: new Uint8Array(nv) };
for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue;
  out.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); out.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); out.UV.set(UV.subarray(v * 2, v * 2 + 2), j * 2); out.clu[j] = vClu[v];
  let s = 0; for (let k = 0; k < 4; k++) s += W0[v * 4 + k];
  for (let k = 0; k < 4; k++) { out.J[j * 4 + k] = J0[v * 4 + k]; out.W[j * 4 + k] = s > 0 ? W0[v * 4 + k] / s : k === 0 ? 1 : 0; } }
const I = Uint32Array.from(simp, (i) => used[i]);

// ------------------------------------------------------------------ 6. the skeleton (bind places, game frame)
const inv4 = (m) => {
  const a = m, o = new Float64Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06, d = 1 / det;
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  return o;
};
const parent = new Map();
json.nodes.forEach((nd, i) => { for (const ch of nd.children ?? []) parent.set(ch, i); });
const r4 = (x) => +x.toFixed(4);
const joints = skin.joints.map((ni, j) => {
  const m = inv4(IBM.subarray(j * 16, j * 16 + 16)), at = toGame(m[12], m[13], m[14]).map(r4);
  const pi = parent.get(ni), pj = skin.joints.indexOf(pi);
  return { name: json.nodes[ni].name.replace(/^mixamorig:/, ''), parent: pj >= 0 ? json.nodes[skin.joints[pj]].name.replace(/^mixamorig:/, '') : null, at };
});
// (another rig model's names (the hulk's v2.5 rig: tripo::…_Limb_n) made the Mixamo ones by the foe's table, F.rename)
if (F.rename) for (const x of joints) { const r = F.rename(x, joints); x.tripo = x.name; x.name = r; }
for (const x of joints) if (x.parent && F.rename) x.parent = joints.find((y) => y.tripo === x.parent)?.name ?? x.parent;
// (centred: the hips over x 0, as the game stands it; the T-pose sheets drew some a little off the middle)
const dx = -joints.find((x) => x.name === 'Hips').at[0];
for (const x of joints) x.at[0] = r4(x.at[0] + dx);
for (let v = 0; v < nv; v++) out.P[v * 3] += dx;
for (let v = 0; v < n0; v++) P[v * 3] += dx;
/** The rig joint each of Tripo's carries (the model folds its weights onto these): Mixamo names, or the foe's table. */
const FOLD = { Root: 'torso', Hips: 'torso', Spine: 'torso', Spine1: 'torso', Spine2: 'torso', LeftShoulder: 'torso', RightShoulder: 'torso', Neck: 'head', Head: 'head',
  LeftArm: 'arm1', LeftForeArm: 'elbow1', LeftHand: 'hand1', RightArm: 'arm0', RightForeArm: 'elbow0', RightHand: 'hand0',
  LeftUpLeg: 'leg1', LeftLeg: 'knee1', LeftFoot: 'foot1', LeftToeBase: 'foot1', RightUpLeg: 'leg0', RightLeg: 'knee0', RightFoot: 'foot0', RightToeBase: 'foot0' };
for (const x of joints) { x.fold = FOLD[x.name] ?? F.fold?.(x.name); if (!x.fold) throw new Error(`${id}: joint ${x.name} folds onto nothing`); }
const at = Object.fromEntries(joints.map((x) => [x.name, x.at]));
const jname = joints.map((x) => x.name);
const FOLDOF = Object.fromEntries(joints.map((x) => [x.name, x.fold]));
const groupOf = (name) => { const f = FOLDOF[name]; return /^(arm|elbow|hand)/.test(f) ? 'arm' : /^(leg|knee|foot)/.test(f) ? 'leg' : f === 'head' ? 'head' : 'body'; };
const topJoint = (v) => { let b2 = 0; for (let q = 1; q < 4; q++) if (out.W[v * 4 + q] > out.W[v * 4 + b2]) b2 = q; return jname[out.J[v * 4 + b2]]; };

if (PROBE) {
  // each cluster: its colour, its share of the used texels, and where its vertices are (mean, and by limb)
  const stat = C.map((col) => ({ hex: hexOf(col), texels: 0, verts: 0, at: [0, 0, 0], groups: {} }));
  for (const i of sampleIdx) stat[cluster[i]].texels++;
  for (let v = 0; v < nv; v++) { const s = stat[out.clu[v]]; s.verts++; for (let q = 0; q < 3; q++) s.at[q] += out.P[v * 3 + q]; const g = groupOf(topJoint(v)); s.groups[g] = (s.groups[g] ?? 0) + 1; }
  for (const s of stat) s.at = s.at.map((x) => +(x / Math.max(1, s.verts)).toFixed(3));
  // the small painted features no cluster holds: dark (eyes, slits, mouths) and amber (a lens) vertices over the chest, by side
  const spots = {};
  for (let v = 0; v < n0; v++) {
    if (used[v] < 0) continue;
    const r = vRGB[v * 3], g = vRGB[v * 3 + 1], b2 = vRGB[v * 3 + 2], L = 0.3 * r + 0.59 * g + 0.11 * b2, p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    const kind = L < 60 ? 'dark' : r > 190 && g > 110 && g < 210 && b2 < 110 ? 'amber' : null;
    if (!kind || p[1] < F.height * (F.spotY ?? 0.55) || Math.abs(p[0]) > 0.6 || p[2] < (F.spotZ ?? -9)) continue;
    const key = `${kind} ${p[0] >= 0 ? '+x' : '-x'} y${(Math.floor(p[1] / 0.05) * 0.05).toFixed(2)}`, s = (spots[key] ??= { n: 0, min: [9, 9, 9], max: [-9, -9, -9] });
    s.n++; for (let q = 0; q < 3; q++) { s.min[q] = Math.min(s.min[q], +p[q].toFixed(3)); s.max[q] = Math.max(s.max[q], +p[q].toFixed(3)); }
  }
  console.log(JSON.stringify({ id, scale: S, joints: Object.fromEntries(Object.entries(at)), clusters: stat, spots }, null, 1));
  await sharp(flat, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toFile(join(HERE, `${id}-probe.png`));
  process.exit(0);
}

// ------------------------------------------------------------------ 4. the hands: widened, their centres
const handOf = (v, j) => { let w = 0; for (let k = 0; k < 4; k++) if (out.J[v * 4 + k] === j) w += out.W[v * 4 + k]; return w; };
const widened = {};
for (const side of ['Left', 'Right']) {
  const j = jname.indexOf(`${side}Hand`), s = side === 'Left' ? 1 : -1, wrist = at[`${side}Hand`], mid = [0, 0, 0];
  let k = 0;
  for (let v = 0; v < nv; v++) if (handOf(v, j) > 0.5) { for (let q = 0; q < 3; q++) mid[q] += out.P[v * 3 + q]; k++; }
  for (let q = 0; q < 3; q++) mid[q] /= k;
  let moved = 0;
  const WIDEN = F.widen;
  if (WIDEN) for (let v = 0; v < nv; v++) {
    const w = handOf(v, j); if (w <= 0) continue;
    const along = s * (out.P[v * 3] - wrist[0]), u = Math.min(1, Math.max(0, along / WIDEN.span)), e = smooth(w);
    const ky = 1 + e * (WIDEN.thick[0] + WIDEN.thick[1] * u), kz = 1 + e * (WIDEN.broad[0] + WIDEN.broad[1] * u), kx = along > 0 ? 1 + e * WIDEN.long : 1;
    out.P[v * 3] = wrist[0] + (out.P[v * 3] - wrist[0]) * kx;
    out.P[v * 3 + 1] = mid[1] + (out.P[v * 3 + 1] - mid[1]) * ky;
    out.P[v * 3 + 2] = mid[2] + (out.P[v * 3 + 2] - mid[2]) * kz;
    const nn = [out.N[v * 3] / kx, out.N[v * 3 + 1] / ky, out.N[v * 3 + 2] / kz], nl = Math.hypot(...nn) || 1;
    for (let q = 0; q < 3; q++) out.N[v * 3 + q] = nn[q] / nl;
    moved++;
  }
  widened[side] = moved;
}

// ------------------------------------------------------------------ 5. repainted by part
const clusterRole = C.map((col) => { const r = F.clusters[hexOf(col)]; if (!r) throw new Error(`${id}: a cluster ${hexOf(col)} with no role (the source changed? --probe)`); return r; });
const PAL = Object.fromEntries(Object.entries(F.palette).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
const vGroup = new Array(nv), vJoint = new Array(nv);
for (let v = 0; v < nv; v++) { vJoint[v] = topJoint(v); vGroup[v] = groupOf(vJoint[v]); }
const ctx = { at, hands: null };
const TW = info.width, TH = info.height;
const paint = Buffer.alloc(TW * TH * 3), owner = new Int32Array(TW * TH).fill(-1), area = {}, tracked = {};
for (const pass of [0, 1]) for (let t = 0; t < I.length / 3; t++) {
  const [a, b2, d] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], U = (v) => [out.UV[v * 2] * TW - 0.5, out.UV[v * 2 + 1] * TH - 0.5];
  const A = U(a), B = U(b2), D = U(d), ar = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
  if (Math.abs(ar) < 1e-12) continue;
  const group = vGroup[b2] === vGroup[d] ? vGroup[b2] : vGroup[a], joint = vJoint[b2] === vJoint[d] ? vJoint[b2] : vJoint[a];
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
    const p = [0, 1, 2].map((i) => w1 * out.P[a * 3 + i] + w2 * out.P[b2 * 3 + i] + w3 * out.P[d * 3 + i]);
    const nrm = [0, 1, 2].map((i) => w1 * out.N[a * 3 + i] + w2 * out.N[b2 * 3 + i] + w3 * out.N[d * 3 + i]);
    const part = F.partAt(clusterRole[cluster[k]], group, p, ctx, joint, nrm, px.subarray(k * 3, k * 3 + 3));
    if (!PAL[part]) throw new Error(`${id}: part ${part} has no colour`);
    if (owner[k] < 0) area[part] = (area[part] ?? 0) + 1;
    // (the painted features the game rebuilds as parts of their own (eyes, lenses): where their texels lie, by side)
    if (inside && F.track?.includes(part)) { const key = `${part}${p[0] >= 0 ? '+x' : '-x'}`, s = (tracked[key] ??= { n: 0, sum: [0, 0, 0], min: [9, 9, 9], max: [-9, -9, -9] });
      s.n++; for (let q = 0; q < 3; q++) { s.sum[q] += p[q]; s.min[q] = Math.min(s.min[q], p[q]); s.max[q] = Math.max(s.max[q], p[q]); } }
    owner[k] = t; paint.set(PAL[part], k * 3);
  }
}
{ let front = []; for (let k = 0; k < TW * TH; k++) if (owner[k] >= 0) front.push(k);
  const done = Uint8Array.from(owner, (o) => (o >= 0 ? 1 : 0));
  while (front.length) { const next = []; for (const k of front) { const x = k % TW, y = (k / TW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= TW || yy >= TH) continue; const j = yy * TW + xx; if (done[j]) continue; done[j] = 1; paint.copy(paint, j * 3, k * 3, k * 3 + 3); next.push(j); } } front = next; } }
const png = await sharp(paint, { raw: { width: TW, height: TH, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: Object.keys(PAL).length, dither: 0 }).toBuffer();
writeFileSync(join(HERE, `${id}-texture.png`), png);
{ const done = new Uint8Array(nv);
  for (let t = 0; t < I.length / 3; t++) {
    const tri = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], cu = tri.reduce((s2, v) => s2 + out.UV[v * 2], 0) / 3, cv = tri.reduce((s2, v) => s2 + out.UV[v * 2 + 1], 0) / 3;
    for (const v of tri) {
      if (done[v]) continue; done[v] = 1;
      const u = out.UV[v * 2] * 0.85 + cu * 0.15, w = out.UV[v * 2 + 1] * 0.85 + cv * 0.15;
      const k = Math.min(TH - 1, Math.max(0, Math.floor(w * TH))) * TW + Math.min(TW - 1, Math.max(0, Math.floor(u * TW)));
      for (let i = 0; i < 3; i++) out.COL[v * 4 + i] = paint[k * 3 + i];
      out.COL[v * 4 + 3] = 255;
    }
  } }

// the hands' centres: the mean of the vertices weighted most to each hand, and their extent
const hands = {};
for (const side of ['Left', 'Right']) {
  const j = joints.findIndex((x) => x.name === `${side}Hand`), a = [0, 0, 0], mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  let k = 0;
  for (let v = 0; v < nv; v++) { let best = 0; for (let q = 1; q < 4; q++) if (out.W[v * 4 + q] > out.W[v * 4 + best]) best = q; if (out.J[v * 4 + best] !== j || out.W[v * 4 + best] < 0.5) continue;
    for (let q = 0; q < 3; q++) { const x = out.P[v * 3 + q]; a[q] += x; mn[q] = Math.min(mn[q], x); mx[q] = Math.max(mx[q], x); } k++; }
  hands[side] = { centre: a.map((x) => r4(x / k)), min: mn.map(r4), max: mx.map(r4), vertices: k };
}
// the foe's own landmarks (measured off the mesh: its painted eyes, its props' anchors)
const vertsOf = (want) => { const list = []; for (let v = 0; v < nv; v++) { const p = [out.P[v * 3], out.P[v * 3 + 1], out.P[v * 3 + 2]]; if (want(p, v)) list.push(p); } return list; };
const spots = Object.fromEntries(Object.entries(tracked).map(([k, s]) => [k, { texels: s.n, centre: s.sum.map((x) => r4(x / s.n)), min: s.min.map(r4), max: s.max.map(r4) }]));
const landmarks = F.landmarks ? F.landmarks({ at, hands, spots, vertsOf, colourOf: (v) => hexOf([out.COL[v * 4], out.COL[v * 4 + 1], out.COL[v * 4 + 2]]), palette: F.palette, nv, P: out.P, r4 }) : {};
const skeleton = { frame: 'game: +z ahead, +y up, metres, feet on y 0', source: `references/enemy-redesign-2026-10-30/${F.concept}/tripo/rigged.glb`, scale: +S.toFixed(5), height: F.height,
  joints, hands, widen: F.widen ?? null, widened, clusters: C.map(hexOf), palette: F.palette, landmarks };
mkdirSync(OUTDIR, { recursive: true });
writeFileSync(join(OUTDIR, 'skeleton.json'), JSON.stringify(skeleton, null, 1) + '\n');
if (nv > 65535) throw new Error('too many vertices for 16-bit indices');
const task = JSON.parse(readFileSync(join(ROOT, 'references/enemy-redesign-2026-10-30', F.concept, 'tripo/task.json'), 'utf8'));
const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, COLOR_0: out.COL, JOINTS_0: out.J, WEIGHTS_0: out.W }, indices: Uint16Array.from(I), image: null, name: `${id} tripo`,
  extras: { source: skeleton.source, tasks: { generation: task.generation.task, rig: task.rig.task }, triangles: I.length / 3, simplifyError: +err.toFixed(5), joints: joints.map((x) => x.name) } });
writeFileSync(join(OUTDIR, 'body.glb'), glb);
const sha = (x) => createHash('sha256').update(x).digest('hex').slice(0, 16);
console.log(JSON.stringify({ id, source: { vertices: n0, triangles: I0.length / 3, texture: [srcTex.w, srcTex.h], joints: joints.length }, lod: { vertices: nv, triangles: I.length / 3, error: +err.toFixed(5), bytes: glb.length, sha: sha(glb) },
  texture: { size: TEX, clusters: skeleton.clusters, texels: area, pngBytes: png.length }, hands, widened, landmarks, scale: S }));
