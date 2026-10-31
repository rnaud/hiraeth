// #800 family D: a Tripo export's connected pieces (welded by place), in the game's frame scaled to H m: each one's
// triangles, box and mean colour (a separate piece is a part cut for free).   node islands.mjs <model.glb> <H>
import { readTripo, sample } from '../shellback-tripo/glb.mjs';
const [IN, H0] = process.argv.slice(2), H = +H0;
const m = await readTripo(IN), n = m.P.length / 3;
let lo = Infinity, hi = -Infinity; for (let v = 0; v < n; v++) { lo = Math.min(lo, m.P[v * 3 + 1]); hi = Math.max(hi, m.P[v * 3 + 1]); }
const S = H / (hi - lo), at = (v) => [-m.P[v * 3 + 2] * S, (m.P[v * 3 + 1] - lo) * S, m.P[v * 3] * S];
const key = new Map(), weld = new Int32Array(n);
for (let v = 0; v < n; v++) { const k = `${Math.round(m.P[v * 3] * 1e5)},${Math.round(m.P[v * 3 + 1] * 1e5)},${Math.round(m.P[v * 3 + 2] * 1e5)}`; if (!key.has(k)) key.set(k, v); weld[v] = key.get(k); }
const parent = new Int32Array(n).map((_, i) => i), find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
for (let t = 0; t < m.I.length; t += 3) { const a = find(weld[m.I[t]]), b = find(weld[m.I[t + 1]]), c = find(weld[m.I[t + 2]]); parent[b] = a; parent[find(c)] = a; }
const groups = new Map(), c = [0, 0, 0];
for (let t = 0; t < m.I.length; t += 3) { const r = find(weld[m.I[t]]); if (!groups.has(r)) groups.set(r, { tris: 0, lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity], col: [0, 0, 0] }); const G = groups.get(r); G.tris++;
  for (let k = 0; k < 3; k++) { const v = m.I[t + k], p = at(v); for (let i = 0; i < 3; i++) { G.lo[i] = Math.min(G.lo[i], p[i]); G.hi[i] = Math.max(G.hi[i], p[i]); } }
  sample(m.tex, m.UV[m.I[t] * 2], m.UV[m.I[t] * 2 + 1], c); for (let i = 0; i < 3; i++) G.col[i] += c[i]; }
const list = [...groups.values()].sort((a, b) => b.tris - a.tris);
console.log('pieces', list.length);
for (const G of list.slice(0, 40)) console.log(String(G.tris).padStart(6), 'x', G.lo[0].toFixed(2), G.hi[0].toFixed(2), 'y', G.lo[1].toFixed(2), G.hi[1].toFixed(2), 'z', G.lo[2].toFixed(2), G.hi[2].toFixed(2), 'rgb', G.col.map((x) => (x / G.tris) | 0).join(','));
