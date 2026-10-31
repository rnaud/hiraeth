// A game-frame GLB's triangles rasterised in their texture's colours, lit from the camera's side (front, side, top,
// three-quarter; fitted to the body), for checking a prepared body's parts and colours before it is rigged.
//
//   node splat.mjs <body.glb> <out-prefix> [--clay]
import sharp from 'sharp';
import { readTripo, sample } from '../shellback-tripo/glb.mjs';

const [IN, OUT] = process.argv.slice(2), clay = process.argv.includes('--clay');
const m = await readTripo(IN), n = m.P.length / 3;
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.P[v * 3 + k]); hi[k] = Math.max(hi[k], m.P[v * 3 + k]); }
const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2), span = Math.max(...[0, 1, 2].map((k) => hi[k] - lo[k])) * 0.6;
const S = 700;
// (a view: right and up vectors, toward the camera)
const views = { front: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]], side: [[0, 0, 1], [0, 1, 0], [1, 0, 0]], top: [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  q3: [[-0.7071, 0, 0.7071], [-0.2, 0.96, -0.2], [0.68, 0.28, 0.68]], back: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const c = [0, 0, 0];
for (const [name, [R, U, F]] of Object.entries(views)) {
  const px = Buffer.alloc(S * S * 3, 245), depth = new Float32Array(S * S).fill(-Infinity);
  const proj = (v) => { const p = [m.P[v * 3] - mid[0], m.P[v * 3 + 1] - mid[1], m.P[v * 3 + 2] - mid[2]]; return [(dot(p, R) / span * 0.5 + 0.5) * S, (0.5 - dot(p, U) / span * 0.5) * S, dot(p, F)]; };
  for (let t = 0; t < m.I.length; t += 3) {
    const [a, b, d] = [m.I[t], m.I[t + 1], m.I[t + 2]], A = proj(a), B = proj(b), D = proj(d);
    const area = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]); if (Math.abs(area) < 1e-9) continue;
    const nn = [0, 1, 2].map((k) => m.N[a * 3 + k] + m.N[b * 3 + k] + m.N[d * 3 + k]), nl = Math.hypot(...nn) || 1;
    const shade = 0.55 + 0.45 * Math.abs(dot(nn, F) / nl);
    const u = (m.UV[a * 2] + m.UV[b * 2] + m.UV[d * 2]) / 3, w = (m.UV[a * 2 + 1] + m.UV[b * 2 + 1] + m.UV[d * 2 + 1]) / 3;
    if (clay) c[0] = c[1] = c[2] = 220; else sample(m.tex, u, w, c);
    for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], D[1]))); y <= Math.min(S - 1, Math.ceil(Math.max(A[1], B[1], D[1]))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], D[0]))); x <= Math.min(S - 1, Math.ceil(Math.max(A[0], B[0], D[0]))); x++) {
        const w1 = ((B[0] - x) * (D[1] - y) - (B[1] - y) * (D[0] - x)) / area, w2 = ((D[0] - x) * (A[1] - y) - (D[1] - y) * (A[0] - x)) / area, w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        const z = w1 * A[2] + w2 * B[2] + w3 * D[2], k = y * S + x; if (z < depth[k]) continue; depth[k] = z;
        for (let i = 0; i < 3; i++) px[k * 3 + i] = Math.min(255, c[i] * shade);
      }
  }
  await sharp(px, { raw: { width: S, height: S, channels: 3 } }).png().toFile(`${OUT}-${name}.png`);
}
console.log('box', lo.map((x) => x.toFixed(3)), hi.map((x) => x.toFixed(3)));
