// #800 family F: an export's colours and where they lie, for placing its parts' cuts. The export framed as the game's
// (prep-kit.mjs framed: Tripo's +x ahead → +z, feet on y 0, scaled to `height`), each vertex's texel sampled, k-means
// clusters of the colours (k of them), each cluster's count, mean colour, hue / saturation / lightness and box.
//
//   node references/enemy-redesign-2026-10-30/trials/familyF-tripo/probe.mjs <model.glb> <height> [k 6]
import { sample } from '../shellback-tripo/glb.mjs';
import { framed, hsl } from '../familyA-tripo/prep-kit.mjs';

const [IN, H, K = '6'] = process.argv.slice(2);
const F = await framed(IN, +H), k = +K, c = [0, 0, 0];
const col = new Float32Array(F.n * 3);
for (let v = 0; v < F.n; v++) { sample(F.m.tex, F.m.UV[v * 2], F.m.UV[v * 2 + 1], c); col.set(c, v * 3); }
// (k-means, seeded from the colours spread through the list: deterministic)
let mu = Array.from({ length: k }, (_, i) => Array.from(col.subarray(Math.floor((i + 0.5) / k * F.n) * 3, Math.floor((i + 0.5) / k * F.n) * 3 + 3)));
const lab = new Uint8Array(F.n);
for (let it = 0; it < 25; it++) {
  const s = mu.map(() => [0, 0, 0, 0]);
  for (let v = 0; v < F.n; v++) { let b = 0, d = Infinity; for (let j = 0; j < k; j++) { const e = (col[v * 3] - mu[j][0]) ** 2 + (col[v * 3 + 1] - mu[j][1]) ** 2 + (col[v * 3 + 2] - mu[j][2]) ** 2; if (e < d) { d = e; b = j; } } lab[v] = b; s[b][0] += col[v * 3]; s[b][1] += col[v * 3 + 1]; s[b][2] += col[v * 3 + 2]; s[b][3]++; }
  mu = s.map((x, j) => (x[3] ? [x[0] / x[3], x[1] / x[3], x[2] / x[3]] : mu[j]));
}
const hex = (q) => '#' + q.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < F.n; v++) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], F.P[v * 3 + i]); hi[i] = Math.max(hi[i], F.P[v * 3 + i]); }
console.log('vertices', F.n, 'triangles', F.m.I.length / 3, 'scale', F.S.toFixed(4), 'box', lo.map((x) => x.toFixed(3)).join(' '), '…', hi.map((x) => x.toFixed(3)).join(' '));
for (let j = 0; j < k; j++) {
  const bl = [Infinity, Infinity, Infinity], bh = [-Infinity, -Infinity, -Infinity], m = [0, 0, 0]; let n = 0;
  for (let v = 0; v < F.n; v++) if (lab[v] === j) { n++; for (let i = 0; i < 3; i++) { const p = F.P[v * 3 + i]; bl[i] = Math.min(bl[i], p); bh[i] = Math.max(bh[i], p); m[i] += p; } }
  const [h, s, l] = hsl(...mu[j]);
  console.log(`${hex(mu[j])} n${n} h${h.toFixed(0)} s${s.toFixed(2)} l${l.toFixed(2)}  mid ${m.map((x) => (x / n).toFixed(3)).join(' ')}  box ${bl.map((x) => x.toFixed(3)).join(' ')} … ${bh.map((x) => x.toFixed(3)).join(' ')}`);
}
