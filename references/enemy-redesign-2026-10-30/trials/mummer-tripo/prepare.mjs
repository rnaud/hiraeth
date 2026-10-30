// #800 phase 2: the dune mummer's rigged Tripo export (keep-mummer/tripo/rigged.glb, untouched: Tripo's biped rig,
// Mixamo names, 23 joints, no fingers) made into the trial's game asset (tripo-lod.glb beside this script) and its
// skeleton (skeleton.json):
//
// 1. Turned into the game's frame (Tripo: +x ahead, +y up; the game: +z ahead) and scaled so the gourd's top is
//    HEIGHT m over the ground at size 1 (the archetype's ×1.5, #741, makes it 1.8 m), feet on y = 0.
// 2. The 2048² baked texture flattened: 1024², a median filter, every texel snapped to the nearest of K flat colours
//    (k-means: the sage gourd, its olive shade, the cream mask, the salmon patch, the rust gauntlets and boots, the
//    sand toe caps, the black slits and wrist bands). Remove Lighting was on (`delight`); the snap takes what is left.
// 3. Vertex colours sampled from the flat texture (COLOR_0): the engines' VMs decode no PNG/JPEG (#264).
// 4. Decimated to TARGET triangles (meshoptimizer, attribute-aware: the colour zones' borders and UV seams kept),
//    collapsing onto existing vertices, so every kept vertex keeps Tripo's own joints and weights (JOINTS_0, WEIGHTS_0).
// 5. The skeleton: each joint's bind position (the inverse of its inverse bind matrix) in the game's frame, its parent,
//    and the measured hand centres (the mitten's palm, where a haft goes through it), for the trial's model.js, which
//    stands the humanoid foe rig's joints at these places and skins the mesh to them with these weights.
//
//   node references/enemy-redesign-2026-10-30/trials/mummer-tripo/prepare.mjs [--target 12000] [--colours 8]
// Deterministic: the same input writes the same bytes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-mummer/tripo/rigged.glb');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TARGET = +opt('--target', 12000), K = +opt('--colours', 8), TEX = 1024;
/** The gourd's top over the ground at size 1 (m): the direct body's (src/enemies/plans/dune-mummer.js GOURD). */
const HEIGHT = 1.2;
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
// (the mesh node carries no transform of its own: checked)
const meshNode = json.nodes.find((n) => n.mesh === 0);
if (meshNode.matrix || meshNode.rotation || meshNode.scale || meshNode.translation) throw new Error('the mesh node has a transform');
const n0 = P0.length / 3;
let lo = Infinity, hi = -Infinity;
for (let v = 0; v < n0; v++) { lo = Math.min(lo, P0[v * 3 + 1]); hi = Math.max(hi, P0[v * 3 + 1]); }
const S = HEIGHT / (hi - lo);
/** Tripo's frame → the game's (x ahead → z ahead; y up; the feet on 0), m. */
const toGame = (x, y, z) => [-z * S, (y - lo) * S, x * S];

// ------------------------------------------------------------------ 2. the flat texture
const { data: px, info } = await sharp(imgBytes).resize(TEX, TEX, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
// (k-means over the texels the mesh uses: every texel under a vertex's uv, so the atlas's empty margin has no say)
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
const flat = Buffer.alloc(px.length);
for (let i = 0; i < info.width * info.height; i++) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); flat[i * 3] = C[k][0]; flat[i * 3 + 1] = C[k][1]; flat[i * 3 + 2] = C[k][2]; }
const png = await sharp(flat, { raw: { width: info.width, height: info.height, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: K, dither: 0 }).toBuffer();
writeFileSync(join(HERE, 'flat-texture.png'), png);

// ------------------------------------------------------------------ 1, 3. positions in the game's frame, colours
const P = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3), COL = new Uint8Array(n0 * 4), ATT = new Float32Array(n0 * 3), c = [0, 0, 0];
for (let v = 0; v < n0; v++) {
  const [x, y, z] = toGame(P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]);
  P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
  N[v * 3] = -N0[v * 3 + 2]; N[v * 3 + 1] = N0[v * 3 + 1]; N[v * 3 + 2] = N0[v * 3];
  sample(srcTex, UV[v * 2], UV[v * 2 + 1], c);
  // (the source's colour, median'd by the flat texture's snap: the nearest flat colour, no blend across a border)
  const k = near(c[0], c[1], c[2]);
  COL[v * 4] = C[k][0]; COL[v * 4 + 1] = C[k][1]; COL[v * 4 + 2] = C[k][2]; COL[v * 4 + 3] = 255;
  ATT[v * 3] = C[k][0] / 255; ATT[v * 3 + 1] = C[k][1] / 255; ATT[v * 3 + 2] = C[k][2] / 255;
}

// ------------------------------------------------------------------ 4. decimated (the weights ride their vertices)
const [simp, err] = MS.simplifyWithAttributes(I0, P, 3, ATT, 3, [0.6, 0.6, 0.6], null, Math.min(I0.length, TARGET * 3), 0.05, ['LockBorder']);
const used = new Int32Array(n0).fill(-1); let nv = 0;
for (const i of simp) if (used[i] < 0) used[i] = nv++;
const out = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2), COL: new Uint8Array(nv * 4), J: new Uint16Array(nv * 4), W: new Float32Array(nv * 4) };
for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue;
  out.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); out.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); out.UV.set(UV.subarray(v * 2, v * 2 + 2), j * 2); out.COL.set(COL.subarray(v * 4, v * 4 + 4), j * 4);
  let s = 0; for (let k = 0; k < 4; k++) s += W0[v * 4 + k];
  for (let k = 0; k < 4; k++) { out.J[j * 4 + k] = J0[v * 4 + k]; out.W[j * 4 + k] = s > 0 ? W0[v * 4 + k] / s : k === 0 ? 1 : 0; } }
const I = Uint32Array.from(simp, (i) => used[i]);

// ------------------------------------------------------------------ 5. the skeleton (bind places, game frame)
const inv4 = (m) => {   // (a rigid-plus-scale 4×4, column major: inverted in general)
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
// the mitten's centre: the mean of the vertices weighted most to each hand (game frame), and its size
const hands = {};
for (const side of ['Left', 'Right']) {
  const j = joints.findIndex((x) => x.name === `${side}Hand`), a = [0, 0, 0], mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  let k = 0;
  for (let v = 0; v < nv; v++) { let best = 0; for (let q = 1; q < 4; q++) if (out.W[v * 4 + q] > out.W[v * 4 + best]) best = q; if (out.J[v * 4 + best] !== j || out.W[v * 4 + best] < 0.5) continue;
    for (let q = 0; q < 3; q++) { const x = out.P[v * 3 + q]; a[q] += x; mn[q] = Math.min(mn[q], x); mx[q] = Math.max(mx[q], x); } k++; }
  hands[side] = { centre: a.map((x) => r4(x / k)), min: mn.map(r4), max: mx.map(r4), vertices: k };
}
const skeleton = { frame: 'game: +z ahead, +y up, metres, feet on y 0', source: 'references/enemy-redesign-2026-10-30/keep-mummer/tripo/rigged.glb', scale: +S.toFixed(5), height: HEIGHT,
  joints, hands, palette: C.map((x) => '#' + x.map((y) => y.toString(16).padStart(2, '0')).join('')) };
writeFileSync(join(HERE, 'skeleton.json'), JSON.stringify(skeleton, null, 1) + '\n');

const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: out.COL, JOINTS_0: out.J, WEIGHTS_0: out.W }, indices: I, image: png, name: 'dune mummer tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/keep-mummer/tripo/rigged.glb', tasks: { generation: '126e68e7-5536-4dc8-ac59-bad4f20e2977', rig: '34054a6c-90f3-417f-a3f8-d0b2bb7b0d09' }, triangles: I.length / 3, simplifyError: +err.toFixed(5), joints: joints.map((x) => x.name) } });
writeFileSync(join(HERE, 'tripo-lod.glb'), glb);
const sha = (x) => createHash('sha256').update(x).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: n0, triangles: I0.length / 3, texture: [srcTex.w, srcTex.h], joints: joints.length }, lod: { vertices: nv, triangles: I.length / 3, error: +err.toFixed(5), bytes: glb.length, sha: sha(glb) },
  texture: { size: TEX, colours: skeleton.palette, pngBytes: png.length }, scale: S }));
