// Slices of a Tripo GLB, for placing a rig's landmarks: at each level along an axis, the connected clusters of the
// vertices in a thin slab (their centroid, box, count and mean texture colour). Legs show as separate columns.
//
//   node slices.mjs <model.glb> [axis y] [from -0.45] [to 0.45] [step 0.05] [cell 0.02]
import { readTripo, sample } from '../shellback-tripo/glb.mjs';

const [IN, axisArg = 'y', from = '-0.45', to = '0.45', step = '0.05', cellArg = '0.02'] = process.argv.slice(2);
const m = await readTripo(IN), n = m.P.length / 3, cell = +cellArg;
const ax = { x: 0, y: 1, z: 2 }[axisArg], o = [0, 1, 2].filter((k) => k !== ax);
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.P[v * 3 + k]); hi[k] = Math.max(hi[k], m.P[v * 3 + k]); }
console.log('box', lo.map((x) => x.toFixed(3)), hi.map((x) => x.toFixed(3)));
const c = [0, 0, 0];
for (let y0 = +from; y0 <= +to + 1e-9; y0 += +step) {
  const pts = []; for (let v = 0; v < n; v++) if (Math.abs(m.P[v * 3 + ax] - y0) < 0.012) pts.push(v);
  const key = (v) => `${Math.floor(m.P[v * 3 + o[0]] / cell)},${Math.floor(m.P[v * 3 + o[1]] / cell)}`;
  const cells = new Map(); for (const v of pts) { const k = key(v); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(v); }
  const seen = new Set(), out = [];
  for (const k of cells.keys()) {
    if (seen.has(k)) continue;
    const q = [k], vs = []; seen.add(k);
    while (q.length) { const kk = q.pop(); vs.push(...cells.get(kk)); const [a, b] = kk.split(',').map(Number); for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const nk = `${a + da},${b + db}`; if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); } } }
    if (vs.length < 6) continue;
    const mn = [Infinity, Infinity], mx = [-Infinity, -Infinity], s = [0, 0], col = [0, 0, 0];
    for (const v of vs) { for (let i = 0; i < 2; i++) { const p = m.P[v * 3 + o[i]]; mn[i] = Math.min(mn[i], p); mx[i] = Math.max(mx[i], p); s[i] += p; } sample(m.tex, m.UV[v * 2], m.UV[v * 2 + 1], c); for (let i = 0; i < 3; i++) col[i] += c[i]; }
    out.push(`[${'xyz'[o[0]]} ${(s[0] / vs.length).toFixed(3)} (${mn[0].toFixed(2)}..${mx[0].toFixed(2)}) ${'xyz'[o[1]]} ${(s[1] / vs.length).toFixed(3)} (${mn[1].toFixed(2)}..${mx[1].toFixed(2)}) n${vs.length} #${col.map((x) => Math.round(x / vs.length).toString(16).padStart(2, '0')).join('')}]`);
  }
  console.log(`${axisArg}=${y0.toFixed(3)}`, out.join(' '));
}
