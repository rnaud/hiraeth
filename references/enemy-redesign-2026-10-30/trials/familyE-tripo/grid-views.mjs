// A GLB's triangles rasterised in its texture's colours (or its COLOR_0, or clay) in three orthographic views with a
// 0.1-unit grid over them (labelled), for reading where a part lies before writing a prepare script's landmarks
// (#800 family E). Works in the file's own frame: Tripo's raw export (+x ahead) or a prepared body (+z ahead).
//
//   node grid-views.mjs <body.glb> <out.png> [--clay] [--step 0.1] [--x0 a --x1 b ...]   (front: from +x, side: from +z, top: from +y)
import sharp from 'sharp';
import { readTripo, sample } from '../shellback-tripo/glb.mjs';

const args = process.argv.slice(2), [IN, OUT] = args, clay = args.includes('--clay'), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? +args[i + 1] : d; };
const step = opt('--step', 0.1), S = opt('--size', 640);
const m = await readTripo(IN), n = m.P.length / 3;
// (--box x0,x1,y0,y1,z0,z1: only the triangles whose first corner lies in it, framed to it)
const BOX = args.includes('--box') ? args[args.indexOf('--box') + 1].split(',').map(Number) : null;
if (BOX) { const inB = (v) => [0, 1, 2].every((k) => m.P[v * 3 + k] >= BOX[k * 2] && m.P[v * 3 + k] <= BOX[k * 2 + 1]); const I = []; for (let t = 0; t < m.I.length; t += 3) if (inB(m.I[t])) I.push(m.I[t], m.I[t + 1], m.I[t + 2]); m.I = Uint32Array.from(I); }
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (const v of m.I) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.P[v * 3 + k]); hi[k] = Math.max(hi[k], m.P[v * 3 + k]); }
const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2), span = Math.max(...[0, 1, 2].map((k) => hi[k] - lo[k])) * 0.56;
// (a view: the axis to the right, the axis up, toward the camera; each as [axis index, sign])
const VIEWS = { 'front (from +x)': [[2, -1], [1, 1], [0, 1]], 'side (from +z)': [[0, 1], [1, 1], [2, 1]], 'top (from +y)': [[2, -1], [0, 1], [1, 1]], 'back (from -x)': [[2, 1], [1, 1], [0, -1]] };
const c = [0, 0, 0], tiles = [];
// (--bones: each triangle in its first corner's bone's colour, JOINTS_0: for checking the cuts)
let BONE = null;
if (args.includes('--bones')) { const j = m.json, a = j.accessors[j.meshes[0].primitives[0].attributes.JOINTS_0], bv = j.bufferViews[a.bufferView], fs = await import('node:fs'), b = fs.readFileSync(IN), jn = b.readUInt32LE(12), bin = b.subarray(28 + jn);
  BONE = new Uint8Array(bin.buffer.slice(bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0), bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0) + a.count * 4)); }
const HUES = [[230, 230, 230], [240, 120, 60], [60, 160, 240], [60, 220, 120], [230, 200, 60], [180, 80, 220], [240, 90, 160], [90, 230, 230], [150, 110, 60], [120, 120, 250], [250, 150, 150], [100, 100, 100], [200, 250, 120], [30, 90, 60]];
for (const [name, [R, U, F]] of Object.entries(VIEWS)) {
  const px = Buffer.alloc(S * S * 3, 250), depth = new Float32Array(S * S).fill(-Infinity);
  const X = (p) => ((p[R[0]] - mid[R[0]]) * R[1] / span * 0.5 + 0.5) * S, Y = (p) => (0.5 - (p[U[0]] - mid[U[0]]) * U[1] / span * 0.5) * S, Z = (p) => p[F[0]] * F[1];
  const proj = (v) => { const p = [m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]]; return [X(p), Y(p), Z(p)]; };
  for (let t = 0; t < m.I.length; t += 3) {
    const [a, b, d] = [m.I[t], m.I[t + 1], m.I[t + 2]], A = proj(a), B = proj(b), D = proj(d);
    const area = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]); if (Math.abs(area) < 1e-9) continue;
    const nn = [0, 1, 2].map((k) => m.N[a * 3 + k] + m.N[b * 3 + k] + m.N[d * 3 + k]), nl = Math.hypot(...nn) || 1;
    const shade = 0.6 + 0.4 * Math.abs(nn[F[0]] * F[1] / nl);
    if (BONE) { const h = HUES[BONE[a * 4] % HUES.length]; c[0] = h[0]; c[1] = h[1]; c[2] = h[2]; }
    else if (clay) c[0] = c[1] = c[2] = 215;
    else if (m.tex) { const u = (m.UV[a * 2] + m.UV[b * 2] + m.UV[d * 2]) / 3, w = (m.UV[a * 2 + 1] + m.UV[b * 2 + 1] + m.UV[d * 2 + 1]) / 3; sample(m.tex, u, w, c); }
    else if (m.COL) for (let k = 0; k < 3; k++) c[k] = (m.COL[a * 4 + k] + m.COL[b * 4 + k] + m.COL[d * 4 + k]) / 3;
    else c[0] = c[1] = c[2] = 200;
    for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], D[1]))); y <= Math.min(S - 1, Math.ceil(Math.max(A[1], B[1], D[1]))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], D[0]))); x <= Math.min(S - 1, Math.ceil(Math.max(A[0], B[0], D[0]))); x++) {
        const w1 = ((B[0] - x) * (D[1] - y) - (B[1] - y) * (D[0] - x)) / area, w2 = ((D[0] - x) * (A[1] - y) - (D[1] - y) * (A[0] - x)) / area, w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        const z = w1 * A[2] + w2 * B[2] + w3 * D[2], k = y * S + x; if (z <= depth[k]) continue; depth[k] = z;
        for (let i = 0; i < 3; i++) px[k * 3 + i] = Math.min(255, c[i] * shade);
      }
  }
  // the grid: every `step` along the view's two axes, labelled
  const lines = [];
  const axisName = (q) => 'xyz'[q[0]];
  for (let g = Math.ceil(lo[R[0]] / step) * step; g <= hi[R[0]] + 1e-9; g += step) { const p = [0, 0, 0]; p[R[0]] = g; const x = X(p).toFixed(1); lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${S}" stroke="#e33" stroke-opacity="0.35" stroke-width="1"/><text x="${x}" y="${S - 4}" font-size="11" fill="#c00">${g.toFixed(2)}</text>`); }
  for (let g = Math.ceil(lo[U[0]] / step) * step; g <= hi[U[0]] + 1e-9; g += step) { const p = [0, 0, 0]; p[U[0]] = g; const y = Y(p).toFixed(1); lines.push(`<line x1="0" y1="${y}" x2="${S}" y2="${y}" stroke="#33e" stroke-opacity="0.35" stroke-width="1"/><text x="2" y="${(+y - 2).toFixed(1)}" font-size="11" fill="#00c">${g.toFixed(2)}</text>`); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${lines.join('')}<text x="${S / 2 - 80}" y="16" font-size="14" fill="#000">${name}: right ${R[1] > 0 ? '+' : '-'}${axisName(R)}, up ${axisName(U)}</text></svg>`;
  tiles.push(await sharp(px, { raw: { width: S, height: S, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer());
}
await sharp({ create: { width: S * 2, height: S * 2, channels: 3, background: '#ffffff' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % 2) * S, top: Math.floor(i / 2) * S }))).png().toFile(OUT);
console.log(OUT, { lo: lo.map((x) => +x.toFixed(3)), hi: hi.map((x) => +x.toFixed(3)), vertices: n, triangles: m.I.length / 3 });
