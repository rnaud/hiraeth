// Orthographic splats of a Tripo GLB's vertices in their sampled colours (top, front, side) with a 0.05 grid, for
// placing the rig's landmarks by eye.  node inspect.mjs <model.glb> <out-prefix>
import sharp from 'sharp';
import { readTripo, sample } from './glb.mjs';

const [IN, OUT] = process.argv.slice(2);
const m = await readTripo(IN);
const n = m.P.length / 3, c = [0, 0, 0];
const views = { top: [0, 2], front: [2, 1], side: [0, 1] };   // (axes drawn: x right, y up in the picture)
const S = 900, half = 0.55;
for (const [name, [ax, ay]] of Object.entries(views)) {
  const px = Buffer.alloc(S * S * 3, 255), depth = new Float32Array(S * S).fill(-Infinity);
  const dz = 3 - ax - ay;
  for (let i = 0; i < S; i += 1) for (let j = 0; j < S; j++) { const x = (i / S) * 2 * half - half, y = half - (j / S) * 2 * half; if (Math.abs(x * 20 - Math.round(x * 20)) < 0.02 || Math.abs(y * 20 - Math.round(y * 20)) < 0.02) { const k = (j * S + i) * 3; px[k] = px[k + 1] = px[k + 2] = Math.round(x * 20) === 0 || Math.round(y * 20) === 0 ? 120 : 215; } }
  for (let v = 0; v < n; v++) {
    const X = m.P[v * 3 + ax], Y = m.P[v * 3 + ay], D = name === 'top' ? m.P[v * 3 + 1] : name === 'front' ? m.P[v * 3] : -m.P[v * 3 + 2];
    sample(m.tex, m.UV[v * 2], m.UV[v * 2 + 1], c);
    const ci = Math.round(((X + half) / (2 * half)) * S), cj = Math.round(((half - (name === 'top' ? -Y : Y)) / (2 * half)) * S);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const i = ci + a, j = cj + b; if (i < 0 || j < 0 || i >= S || j >= S) continue; const k = j * S + i; if (D < depth[k]) continue; depth[k] = D; px[k * 3] = c[0]; px[k * 3 + 1] = c[1]; px[k * 3 + 2] = c[2]; }
  }
  await sharp(px, { raw: { width: S, height: S, channels: 3 } }).png().toFile(`${OUT}-${name}.png`);
}
console.log('verts', n, 'tris', m.I.length / 3, 'texture', m.tex.w, m.tex.h);
