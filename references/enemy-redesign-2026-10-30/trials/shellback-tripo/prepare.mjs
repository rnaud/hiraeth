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
//    shoulder, hand and tip; the eyes; the dome's rim and crown. Measured from the mesh's own vertex columns
//    (inspect.mjs's splats and the leg columns above each foot), not guessed from the direct model.
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
await MS.ready;

const m = await readTripo(IN);
const n0 = m.P.length / 3;
let lo = Infinity, hi = -Infinity;
for (let v = 0; v < n0; v++) { lo = Math.min(lo, m.P[v * 3 + 1]); hi = Math.max(hi, m.P[v * 3 + 1]); }
const S = HEIGHT / (hi - lo);
/** Tripo's frame → the game's (x ahead → z ahead; y up; the feet on 0), m. */
const toGame = (x, y, z) => [-z * S, (y - lo) * S, x * S];

// ------------------------------------------------------------------ 2. the flat texture
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
const flat = Buffer.alloc(px.length);
for (let i = 0; i < info.width * info.height; i++) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); flat[i * 3] = C[k][0]; flat[i * 3 + 1] = C[k][1]; flat[i * 3 + 2] = C[k][2]; }
const png = await sharp(flat, { raw: { width: info.width, height: info.height, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: K, dither: 0 }).toBuffer();
writeFileSync(join(HERE, 'flat-texture.png'), png);
const flatTex = { px: flat, w: info.width, h: info.height };

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
const out = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2), COL: new Uint8Array(nv * 4) };
for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue;
  out.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); out.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); out.UV.set(m.UV.subarray(v * 2, v * 2 + 2), j * 2); out.COL.set(COL.subarray(v * 4, v * 4 + 4), j * 4); }
const I = Uint32Array.from(simp, (i) => used[i]);

// ------------------------------------------------------------------ 5. landmarks (Tripo frame, then the game's)
// (the leg columns over each foot: shin straight up from the foot to y -0.15, the knee's outer bulge at y -0.07,
//  the thigh in under the rim at |z| 0.2; feet at x -0.204, 0.018, 0.183, the front pair nearer in, |z| 0.31)
const T = (x, y, z) => toGame(x, y, z).map((a) => +a.toFixed(4));
const legs = [];
for (const s of [1, -1]) for (const [x, fz] of [[0.183, 0.306], [0.018, 0.425], [-0.204, 0.426]]) {
  const front = x > 0.1;
  legs.push({ side: s, hip: T(x, 0.0, s * 0.19), knee: T(x + (front ? -0.01 : 0), -0.07, s * (front ? 0.29 : 0.355)), ankle: T(x, -0.235, s * (fz - 0.02)), foot: T(x, lo, s * fz) });
}
const claws = [1, -1].map((s) => ({ side: s, shoulder: T(0.31, 0.02, s * 0.19), hand: T(0.40, 0.035, s * 0.215), tip: T(0.442, -0.182, s * 0.21) }));
// the eyes: the black texels' vertices on the face (ahead, under the rim, near the middle)
const eyes = [1, -1].map((s) => { const a = [0, 0, 0]; let k = 0;
  for (let v = 0; v < n0; v++) { const x = m.P[v * 3], y = m.P[v * 3 + 1], z = m.P[v * 3 + 2]; if (x < 0.15 || Math.abs(z) > 0.15 || z * s < 0.01 || y < -0.15 || y > 0.06) continue;
    sample(m.tex, m.UV[v * 2], m.UV[v * 2 + 1], c); if (c[0] + c[1] + c[2] > 160) continue; a[0] += x; a[1] += y; a[2] += z; k++; }
  return k ? { side: s, at: T(a[0] / k, a[1] / k, a[2] / k), n: k } : null; });
let rim = -Infinity; for (let v = 0; v < n0; v++) if (Math.abs(m.P[v * 3 + 2]) < 0.02 && m.P[v * 3] < -0.4) rim = Math.max(rim, m.P[v * 3 + 1]);
const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0', scale: +S.toFixed(5), height: HEIGHT, legs, claws, eyes,
  rimBack: +((rim - lo) * S).toFixed(4), crown: HEIGHT, palette: C.map((c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('')) };
writeFileSync(join(HERE, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');

const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: out.COL }, indices: I, image: png, name: 'shellback tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/shellback/tripo/model.glb', task: '5f2aa15f-678e-4969-b6d9-39852b47c598', triangles: I.length / 3, simplifyError: +err.toFixed(5) } });
writeFileSync(join(HERE, 'tripo-lod.glb'), glb);
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: n0, triangles: m.I.length / 3, texture: [m.tex.w, m.tex.h] }, lod: { vertices: nv, triangles: I.length / 3, error: +err.toFixed(5), bytes: glb.length, sha: sha(glb) }, texture: { size: TEX, colours: landmarks.palette, pngBytes: png.length }, scale: S, eyes: eyes.map((e) => e && e.n) }));
