// #800 phase 2b: the wood cutter's Tripo export (keep-brute/tripo/model.glb, untouched) made into the trial's game asset
// (tripo-lod.glb beside this script) and its rig landmarks (landmarks.json), as the shellback's prepare.mjs:
//
// 1. Turned into the game's frame (Tripo: +x ahead, +y up; the game: +z ahead), scaled to the direct wood cutter's
//    height (WOODCUTTER.height m, feet on y = 0) and centred between its feet (Tripo centres the box, saw and all).
// 2. The 2048² baked texture flattened: 1024², a median filter, every texel snapped to the nearest of K flat colours
//    (k-means: the sage hull, its dark-green shade and joints, the cream head, the visor's black, the rust saw, the
//    ochre vent, the olive bands). Remove Lighting was on (`delight`).
// 3. Vertex colours sampled from the flat texture (COLOR_0) for the engines' VMs.
// 4. Decimated to TARGET triangles (meshoptimizer, the colour borders and UV seams kept).
// 5. The landmarks its machine rig is fitted to (game frame, m): each arm's shoulder, elbow, wrist and tool or hand's
//    end, each leg's hip, knee, ankle and foot, the head's centre and radius, the vent, the pauldrons. Measured from the
//    mesh's own vertex clusters (horizontal and sideways slices, and inspect.mjs's splats in the game frame), not taken
//    from the direct model.
//
//   node references/enemy-redesign-2026-10-30/trials/woodcutter-tripo/prepare.mjs [--target 12000]
// Deterministic: the same input writes the same bytes.
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { readTripo, sample, writeGlb } from '../shellback-tripo/glb.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-brute/tripo/model.glb');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TARGET = +opt('--target', 12000), K = +opt('--colours', 8), TEX = 1024;
/** The direct wood cutter's height (src/enemies/plans/woodcutter.js WOODCUTTER.height). */
const HEIGHT = 2.4;
await MS.ready;

const m = await readTripo(IN);
const n0 = m.P.length / 3;
let lo = Infinity, hi = -Infinity;
for (let v = 0; v < n0; v++) { lo = Math.min(lo, m.P[v * 3 + 1]); hi = Math.max(hi, m.P[v * 3 + 1]); }
const S = HEIGHT / (hi - lo);
// (the middle between its feet: the vertices under 6 cm, their x and z extents' centre)
let fx0 = Infinity, fx1 = -Infinity, fz0 = Infinity, fz1 = -Infinity;
for (let v = 0; v < n0; v++) { if ((m.P[v * 3 + 1] - lo) * S > 0.06) continue; const x = -m.P[v * 3 + 2] * S, z = m.P[v * 3] * S; fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); fz0 = Math.min(fz0, z); fz1 = Math.max(fz1, z); }
const CX = (fx0 + fx1) / 2, CZ = (fz0 + fz1) / 2;
/** Tripo's frame → the game's (x ahead → z ahead; y up; the feet on 0, centred between them), m. */
const toGame = (x, y, z) => [-z * S - CX, (y - lo) * S, x * S - CZ];

// ------------------------------------------------------------------ 2. the flat texture
const { data: px, info } = await sharp(m.image.bytes).resize(TEX, TEX, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const sampleIdx = []; for (let i = 0; i < info.width * info.height; i += 7) sampleIdx.push(i);
const lum = (i) => px[i * 3] * 0.3 + px[i * 3 + 1] * 0.59 + px[i * 3 + 2] * 0.11;
const sorted = sampleIdx.slice().sort((a, b) => lum(a) - lum(b));
let C = Array.from({ length: K }, (_, k) => { const i = sorted[Math.floor(((k + 0.5) / K) * sorted.length)]; return [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]; });
// (seeds for the small zones a luminance spread misses: the saw's rust, the vent's ochre, the head's cream)
C.push([140, 60, 40], [200, 150, 60], [232, 205, 180]);
const near = (r, g, b) => { let best = 0, d = Infinity; for (let k = 0; k < C.length; k++) { const e = (r - C[k][0]) ** 2 + (g - C[k][1]) ** 2 + (b - C[k][2]) ** 2; if (e < d) { d = e; best = k; } } return best; };
for (let it = 0; it < 18; it++) {
  const sum = C.map(() => [0, 0, 0, 0]);
  for (const i of sampleIdx) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); sum[k][0] += px[i * 3]; sum[k][1] += px[i * 3 + 1]; sum[k][2] += px[i * 3 + 2]; sum[k][3]++; }
  C = C.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
}
// (the hull's greens come out as several near shades of one: the baked shading Remove Lighting left. Those nearer than
//  MERGE in RGB are one colour, weighted by their texels, so the hull reads as one sage, its joints and bands their dark green)
const MERGE = +opt('--merge', 40);
{
  const cnt = C.map(() => 0); for (const i of sampleIdx) cnt[near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])]++;
  let L = C.map((c, k) => ({ c, n: cnt[k] })).filter((x) => x.n > 0);
  for (let merged = true; merged;) {
    merged = false;
    let best = null;
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) { const d = Math.hypot(...L[a].c.map((x, t) => x - L[b].c[t])); if (d < MERGE && (!best || d < best.d)) best = { a, b, d }; }
    if (best) { const A = L[best.a], B = L[best.b], n = A.n + B.n; A.c = A.c.map((x, t) => (x * A.n + B.c[t] * B.n) / n); A.n = n; L.splice(best.b, 1); merged = true; }
  }
  C = L.map((x) => x.c);
}
C = C.map((c) => c.map(Math.round));
const flat = Buffer.alloc(px.length);
for (let i = 0; i < info.width * info.height; i++) { const k = near(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); flat[i * 3] = C[k][0]; flat[i * 3 + 1] = C[k][1]; flat[i * 3 + 2] = C[k][2]; }
const png = await sharp(flat, { raw: { width: info.width, height: info.height, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: C.length, dither: 0 }).toBuffer();
writeFileSync(join(HERE, 'flat-texture.png'), png);

// ------------------------------------------------------------------ 1, 3. positions in the game's frame, colours
const P = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3), COL = new Uint8Array(n0 * 4), ATT = new Float32Array(n0 * 3), c = [0, 0, 0];
for (let v = 0; v < n0; v++) {
  const [x, y, z] = toGame(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]);
  P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
  N[v * 3] = -m.N[v * 3 + 2]; N[v * 3 + 1] = m.N[v * 3 + 1]; N[v * 3 + 2] = m.N[v * 3];
  sample(m.tex, m.UV[v * 2], m.UV[v * 2 + 1], c);
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

// ------------------------------------------------------------------ 5. landmarks (game frame, centred; measured)
// (from the slices: the left arm hangs straight, a dark band at the elbow at 1.56 m, the hand from 1.0 to 0.64 m; the
//  saw arm's upper arm hangs a little back, its forearm held forward level at 1.4 m, the disc at its end facing out and
//  ahead, centred 1.32 m up; the legs nearly straight, a short thigh into the barrel at 0.9 m, a dark knee band at 0.7 m,
//  the boots from 0.25 m down to a broad round sole; the head a cream dome 0.6 m across sunk in the barrel's top)
const r3 = (a) => a.map((x) => +x.toFixed(3));
const arms = [
  { side: -1, shoulder: r3([-0.7, 1.92, -0.12]), elbow: r3([-0.84, 1.42, -0.14]), wrist: r3([-0.98, 1.38, 0.3]), end: r3([-1.15, 1.32, 0.56]), tool: 'saw', sawR: 0.38 },
  { side: 1, shoulder: r3([0.68, 1.92, -0.1]), elbow: r3([0.84, 1.56, -0.08]), wrist: r3([0.86, 1.0, 0.1]), end: r3([0.86, 0.64, 0.14]), tool: 'clamp' },
];
const legs = [-1, 1].map((s) => ({ side: s, hip: r3([s * 0.42, 0.9, -0.02]), knee: r3([s * 0.46, 0.68, 0.0]), ankle: r3([s * 0.5, 0.25, 0.0]), foot: r3([s * 0.55, 0, 0.0]) }));
// the head: the cream vertices' centre and reach
const cream = C.reduce((b, c2, k) => (c2[0] + c2[1] + c2[2] > C[b][0] + C[b][1] + C[b][2] ? k : b), 0);
const hc = [0, 0, 0]; let hn = 0, top = 0;
for (let v = 0; v < n0; v++) { const k = near(COL[v * 4], COL[v * 4 + 1], COL[v * 4 + 2]); if (k !== cream || P[v * 3 + 1] < 1.7) continue; hc[0] += P[v * 3]; hc[1] += P[v * 3 + 1]; hc[2] += P[v * 3 + 2]; hn++; top = Math.max(top, P[v * 3 + 1]); }
const head = { centre: r3(hc.map((x) => x / Math.max(1, hn))), top: +top.toFixed(3), r: 0.32, n: hn };
const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0, centred between the feet', scale: +S.toFixed(5), shift: r3([CX, CZ]), height: HEIGHT, arms, legs, head,
  vent: r3([0, 1.2, 0.52]), pauldronY: 1.74, chestY: [1.62, 1.98], palette: C.map((c2) => '#' + c2.map((x) => x.toString(16).padStart(2, '0')).join('')) };
writeFileSync(join(HERE, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');

const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: out.COL }, indices: I, image: png, name: 'wood cutter tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/keep-brute/tripo/model.glb', task: '32ba0f6c-65ed-4cb9-8685-bdfb19b47047', triangles: I.length / 3, simplifyError: +err.toFixed(5) } });
writeFileSync(join(HERE, 'tripo-lod.glb'), glb);
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: n0, triangles: m.I.length / 3, texture: [m.tex.w, m.tex.h] }, centre: [CX, CZ], lod: { vertices: nv, triangles: I.length / 3, error: +err.toFixed(5), bytes: glb.length, sha: sha(glb) }, texture: { size: TEX, colours: landmarks.palette, pngBytes: png.length }, scale: S, head }));
