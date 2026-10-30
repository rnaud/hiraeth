// #800 phase 2b: the hound's Tripo export made into the trial's game asset (tripo-lod.glb beside this script) and its
// rig landmarks (landmarks.json). The shellback's prepare.mjs, with one change: the source is Tripo's own quadruped rig
// of the model (the hound folder's tripo/rigged.glb, untouched; the same mesh as model.glb, 54 joints), and its skin
// weights are kept, gathered onto the game's bones:
//
// 1. Into the game's frame (Tripo's rig: +z ahead, +y up, feet on 0, as the game's) and scaled to the direct hound's
//    height (HOUND.height m, the horns' top), so both are built to the same size.
// 2. The 2048² texture flattened: 1024², a median filter, every texel snapped to the nearest of K flat colours (k-means).
// 3. Vertex colours sampled from it (COLOR_0): the engines' VMs decode no JPEG/PNG (#264).
// 4. Tripo's weights gathered onto the game's bones (BONES below: the body, neck, head, four tail joints, each leg's
//    thigh, shin and foot): each Tripo joint is mapped to the game bone carrying the same stretch of the body (its
//    duplicated left hind chain and stray tail branches onto the bones they lie along), summed, the four largest kept,
//    normalised. Written as JOINTS_0 / WEIGHTS_0 in BONES's order.
// 5. Decimated to TARGET triangles (meshoptimizer, colour borders and UV seams kept; the weights ride on the kept vertices).
// 6. The landmarks the trial's rig is fitted to (game frame, m): each leg's hip, knee, ankle and foot, the neck, head,
//    jaw line, eyes and the tail's joints, from the rig's own joints (their inverse bind matrices) and the mesh.
//
//   node references/enemy-redesign-2026-10-30/trials/hound-tripo/prepare.mjs [--target 12000]
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
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/hound/tripo/rigged.glb');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TARGET = +opt('--target', 12000), K = +opt('--colours', 7), TEX = 1024;
/** The direct hound's top (src/enemies/plans/broad-hound.js HOUND.height). */
const HEIGHT = 1.69;
/** The game's bones, in the asset's JOINTS_0 order. Legs: 0 front right, 1 front left, 2 hind right, 3 hind left (as the kit builds them). */
export const BONES = ['body', 'neck', 'head', 'tail0', 'tail1', 'tail2', 'tail3', ...[0, 1, 2, 3].flatMap((k) => [`leg${k}_thigh`, `leg${k}_shin`, `leg${k}_foot`])];
/** Tripo's joints → the game's bones (names as Tripo's rig gives them; its unnamed bone_N by where they lie). */
const MAP = {
  'tripo::Root': 'body', 'tripo::Spine_0': 'body', 'tripo::Spine_1': 'body', 'tripo::Spine_2': 'body', bone_12: 'body', bone_18: 'body', bone_19: 'body', 'tripo::1_Left_Limb_0': 'body',
  bone_3: 'neck', 'tripo::Head_0': 'neck', 'tripo::Head_1': 'head',
  'tripo::0_Left_Limb_0': 'leg1_thigh', 'tripo::0_Left_Limb_1': 'leg1_shin', 'tripo::0_Left_Limb_2': 'leg1_foot', 'tripo::0_Left_Limb_3': 'leg1_foot', 'tripo::0_Left_Limb_4': 'leg1_foot',
  'tripo::0_Right_Limb_0': 'leg0_thigh', 'tripo::0_Right_Limb_1': 'leg0_shin', 'tripo::0_Right_Limb_2': 'leg0_foot', 'tripo::0_Right_Limb_3': 'leg0_foot', 'tripo::0_Right_Limb_4': 'leg0_foot',
  'tripo::1_Right_Limb_0': 'leg2_thigh', 'tripo::1_Right_Limb_1': 'leg2_shin', 'tripo::1_Right_Limb_2': 'leg2_foot', 'tripo::1_Right_Limb_3': 'leg2_foot', 'tripo::1_Right_Limb_4': 'leg2_foot', 'tripo::1_Right_Limb_5': 'leg2_foot',
  // (the left hind leg twice over: bone_20… and bone_47…, both along the same leg)
  bone_20: 'leg3_thigh', bone_21: 'leg3_shin', bone_22: 'leg3_foot', bone_23: 'leg3_foot', bone_24: 'leg3_foot', bone_25: 'leg3_foot',
  bone_47: 'leg3_thigh', bone_48: 'leg3_thigh', bone_49: 'leg3_shin', bone_50: 'leg3_foot', bone_51: 'leg3_foot', bone_52: 'leg3_foot', bone_53: 'leg3_foot',
  bone_32: 'tail0', bone_33: 'tail0', bone_34: 'tail0', bone_35: 'tail0', 'tripo::Tail_0': 'tail1', bone_45: 'tail1', 'tripo::Tail_1': 'tail2', bone_42: 'tail2', bone_43: 'tail2', bone_44: 'tail2',
  'tripo::Tail_2': 'tail3', bone_39: 'tail3', bone_40: 'tail3', bone_41: 'tail3',
};
await MS.ready;

// ------------------------------------------------------------------ the rigged GLB: mesh, texture, skin
const b = readFileSync(IN), jn = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)); };
const prim = json.meshes[0].primitives[0];
const SP = acc(prim.attributes.POSITION), SN = acc(prim.attributes.NORMAL), SUV = acc(prim.attributes.TEXCOORD_0), SJ = acc(prim.attributes.JOINTS_0), SW = acc(prim.attributes.WEIGHTS_0);
let SI = acc(prim.indices); if (!(SI instanceof Uint32Array)) SI = Uint32Array.from(SI);
const img = json.images[json.textures[json.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source];
const iv = json.bufferViews[img.bufferView], imageBytes = Buffer.from(bin.subarray(iv.byteOffset ?? 0, (iv.byteOffset ?? 0) + iv.byteLength));
const { data: srcPx, info: srcInfo } = await sharp(imageBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const srcTex = { px: srcPx, w: srcInfo.width, h: srcInfo.height };
const skin = json.skins[0], IBM = acc(skin.inverseBindMatrices);
const jointName = skin.joints.map((n) => json.nodes[n].name);
for (const n of jointName) if (!MAP[n]) throw new Error(`unmapped Tripo joint ${n}`);
const jointToBone = jointName.map((n) => BONES.indexOf(MAP[n]));
/** A Tripo joint's rest position (its inverse bind's inverse translation), Tripo frame. */
const jointAt = (name) => { const k = jointName.indexOf(name), m = IBM.subarray(k * 16, k * 16 + 16); return [0, 1, 2].map((c) => -(m[c * 4] * m[12] + m[c * 4 + 1] * m[13] + m[c * 4 + 2] * m[14])); };
const n0 = SP.length / 3;
let lo = Infinity, hi = -Infinity;
for (let v = 0; v < n0; v++) { lo = Math.min(lo, SP[v * 3 + 1]); hi = Math.max(hi, SP[v * 3 + 1]); }
const S = HEIGHT / (hi - lo);
const toGame = (x, y, z) => [x * S, (y - lo) * S, z * S];

// ------------------------------------------------------------------ 2. the flat texture
const { data: px, info } = await sharp(imageBytes).resize(TEX, TEX, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const sampleIdx = []; for (let i = 0; i < info.width * info.height; i += 7) sampleIdx.push(i);
const lum = (i) => px[i * 3] * 0.3 + px[i * 3 + 1] * 0.59 + px[i * 3 + 2] * 0.11;
const sorted = sampleIdx.slice().sort((a, c) => lum(a) - lum(c));
let C = Array.from({ length: K }, (_, k) => { const i = sorted[Math.floor(((k + 0.5) / K) * sorted.length)]; return [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]; });
const near = (r, g, bl) => { let best = 0, d = Infinity; for (let k = 0; k < C.length; k++) { const e = (r - C[k][0]) ** 2 + (g - C[k][1]) ** 2 + (bl - C[k][2]) ** 2; if (e < d) { d = e; best = k; } } return best; };
for (let it = 0; it < 18; it++) {
  const sum = C.map(() => [0, 0, 0, 0]);
  for (const i of sampleIdx) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); sum[k][0] += px[i * 3]; sum[k][1] += px[i * 3 + 1]; sum[k][2] += px[i * 3 + 2]; sum[k][3]++; }
  C = C.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
}
C = C.map((c) => c.map(Math.round));
const flat = Buffer.alloc(px.length);
for (let i = 0; i < info.width * info.height; i++) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); flat[i * 3] = C[k][0]; flat[i * 3 + 1] = C[k][1]; flat[i * 3 + 2] = C[k][2]; }
const png = await sharp(flat, { raw: { width: info.width, height: info.height, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: K, dither: 0 }).toBuffer();
writeFileSync(join(HERE, 'flat-texture.png'), png);

// ------------------------------------------------------------------ 1, 3, 4. positions, colours, weights on the game's bones
const P = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3), COL = new Uint8Array(n0 * 4), ATT = new Float32Array(n0 * 3), J = new Uint8Array(n0 * 4), W = new Float32Array(n0 * 4), c = [0, 0, 0];
for (let v = 0; v < n0; v++) {
  const [x, y, z] = toGame(SP[v * 3], SP[v * 3 + 1], SP[v * 3 + 2]);
  P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
  N.set(SN.subarray(v * 3, v * 3 + 3), v * 3);
  sample(srcTex, SUV[v * 2], SUV[v * 2 + 1], c);
  const k = near(c[0], c[1], c[2]);
  COL[v * 4] = C[k][0]; COL[v * 4 + 1] = C[k][1]; COL[v * 4 + 2] = C[k][2]; COL[v * 4 + 3] = 255;
  ATT[v * 3] = C[k][0] / 255; ATT[v * 3 + 1] = C[k][1] / 255; ATT[v * 3 + 2] = C[k][2] / 255;
  const sum = new Float32Array(BONES.length);
  for (let i = 0; i < 4; i++) sum[jointToBone[SJ[v * 4 + i]]] += SW[v * 4 + i];
  const top = [...sum.keys()].sort((a, d) => sum[d] - sum[a] || a - d).slice(0, 4), tot = top.reduce((s, i) => s + sum[i], 0) || 1;
  top.forEach((bi, i) => { J[v * 4 + i] = bi; W[v * 4 + i] = sum[bi] / tot; });
}

// ------------------------------------------------------------------ 5. decimated
const [simp, err] = MS.simplifyWithAttributes(SI, P, 3, ATT, 3, [0.6, 0.6, 0.6], null, Math.min(SI.length, TARGET * 3), 0.05, ['LockBorder']);
const used = new Int32Array(n0).fill(-1); let nv = 0;
for (const i of simp) if (used[i] < 0) used[i] = nv++;
const out = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2), COL: new Uint8Array(nv * 4), J: new Uint8Array(nv * 4), W: new Float32Array(nv * 4) };
for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue;
  out.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); out.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); out.UV.set(SUV.subarray(v * 2, v * 2 + 2), j * 2);
  out.COL.set(COL.subarray(v * 4, v * 4 + 4), j * 4); out.J.set(J.subarray(v * 4, v * 4 + 4), j * 4); out.W.set(W.subarray(v * 4, v * 4 + 4), j * 4); }
const I = Uint32Array.from(simp, (i) => used[i]);

// ------------------------------------------------------------------ 6. landmarks (game frame)
const T = (a) => toGame(...a).map((x) => +x.toFixed(4));
const J3 = (n) => T(jointAt(n));
const legs = [
  { side: -1, front: true, hip: J3('tripo::0_Right_Limb_0'), knee: J3('tripo::0_Right_Limb_1'), ankle: J3('tripo::0_Right_Limb_2'), toe: J3('tripo::0_Right_Limb_4') },
  { side: 1, front: true, hip: J3('tripo::0_Left_Limb_0'), knee: J3('tripo::0_Left_Limb_1'), ankle: J3('tripo::0_Left_Limb_2'), toe: J3('tripo::0_Left_Limb_4') },
  { side: -1, front: false, hip: J3('tripo::1_Right_Limb_0'), knee: J3('tripo::1_Right_Limb_1'), ankle: J3('tripo::1_Right_Limb_2'), toe: J3('tripo::1_Right_Limb_5') },
  { side: 1, front: false, hip: J3('bone_20'), knee: J3('bone_21'), ankle: J3('bone_22'), toe: J3('bone_25') },
];
// (the foot under the ankle, on the ground)
for (const l of legs) l.foot = [l.ankle[0], 0, l.ankle[2]];
// the eyes: the palest small texels on the head's front (Tripo painted two pale slits under the brow)
const headAt = J3('tripo::Head_1'), neckAt = J3('tripo::Head_0'), neckRoot = J3('bone_3');
const pale = C.map((x, k) => [x[0] + x[1] + x[2], k]).sort((a, d) => d[0] - a[0])[0][1];
const eyes = [1, -1].map((s) => { const a = [0, 0, 0]; let k = 0;
  for (let v = 0; v < n0; v++) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    if (x * s < 0.02 || Math.abs(x) > 0.16 || y < headAt[1] - 0.05 || y > headAt[1] + 0.16 || z < headAt[2] + 0.02 || z > headAt[2] + 0.2) continue;
    sample(srcTex, SUV[v * 2], SUV[v * 2 + 1], c); const r = c[0], g = c[1], bl = c[2];
    if (!(r + g + bl > 420 && near(r, g, bl) === pale)) continue; a[0] += x; a[1] += y; a[2] += z; k++; }
  return k ? { side: s, at: a.map((x) => +(x / k).toFixed(4)), n: k } : null; });
const tail = ['bone_32', 'tripo::Tail_0', 'tripo::Tail_1', 'tripo::Tail_2', 'bone_41'].map(J3);
const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0', scale: +S.toFixed(5), height: HEIGHT, bones: BONES, legs,
  neck: neckRoot, headBase: neckAt, head: headAt, eyes, tail, palette: C.map((x) => '#' + x.map((y) => y.toString(16).padStart(2, '0')).join('')) };
writeFileSync(join(HERE, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');

const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: out.COL, JOINTS_0: out.J, WEIGHTS_0: out.W }, indices: I, image: png, name: 'hound tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/hound/tripo/rigged.glb', task: '09f5de9e-79ff-4d16-ab12-be8784944eb4', rigTask: '66154a67-3bdc-426a-88ff-f1dc00b93ee9', bones: BONES, triangles: I.length / 3, simplifyError: +err.toFixed(5) } });
writeFileSync(join(HERE, 'tripo-lod.glb'), glb);
const sha = (x) => createHash('sha256').update(x).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: n0, triangles: SI.length / 3, texture: [srcTex.w, srcTex.h] }, lod: { vertices: nv, triangles: I.length / 3, error: +err.toFixed(5), bytes: glb.length, sha: sha(glb) }, texture: { size: TEX, colours: landmarks.palette, pngBytes: png.length }, scale: S, eyes: eyes.map((e) => e && e.n) }));
