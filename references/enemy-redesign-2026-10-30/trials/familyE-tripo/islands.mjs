// A Tripo export's colour islands (#800 family E): each vertex's role by its texture colour (the roles given as name=#hex,
// nearest in RGB), then the connected pieces of each role (welded by position, joined through edges whose two ends share
// the role), largest first: centroid, box, vertex count. The machines' parts show as islands: a dark ball at each joint,
// a sage thigh, a cream shin, the orange lens. For placing the landmarks a prepare script cuts at.
//
//   node islands.mjs <model.glb> name=#hex … [--min 30]
import { readTripo, sample } from '../shellback-tripo/glb.mjs';

const args = process.argv.slice(2), IN = args[0], min = args.includes('--min') ? +args[args.indexOf('--min') + 1] : 30;
const roles = args.filter((a) => a.includes('=#')).map((a) => { const [k, h] = a.split('='); return [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]; });
const m = await readTripo(IN), n = m.P.length / 3, c = [0, 0, 0], role = new Uint8Array(n);
for (let v = 0; v < n; v++) { sample(m.tex, m.UV[v * 2], m.UV[v * 2 + 1], c); let best = 0, d = Infinity; roles.forEach(([, r], k) => { const e = (r[0] - c[0]) ** 2 + (r[1] - c[1]) ** 2 + (r[2] - c[2]) ** 2; if (e < d) { d = e; best = k; } }); role[v] = best; }
const parent = new Int32Array(n).map((_, i) => i), find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
const weld = new Map();
for (let v = 0; v < n; v++) { const k = `${Math.round(m.P[v * 3] * 1e4)},${Math.round(m.P[v * 3 + 1] * 1e4)},${Math.round(m.P[v * 3 + 2] * 1e4)}`; if (weld.has(k)) { const w = weld.get(k); if (role[w] === role[v]) parent[find(v)] = find(w); } else weld.set(k, v); }
for (let t = 0; t < m.I.length; t += 3) for (let k = 0; k < 3; k++) { const a = m.I[t + k], b = m.I[t + (k + 1) % 3]; if (role[a] === role[b]) parent[find(a)] = find(b); }
const groups = new Map();
for (let v = 0; v < n; v++) { const r = find(v); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(v); }
const out = [...groups.values()].filter((g) => g.length >= min).sort((a, b) => b.length - a.length).map((g) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], s = [0, 0, 0];
  for (const v of g) for (let k = 0; k < 3; k++) { const p = m.P[v * 3 + k]; lo[k] = Math.min(lo[k], p); hi[k] = Math.max(hi[k], p); s[k] += p; }
  const f = (a) => a.map((x) => x.toFixed(3)).join(' ');
  return `${roles[role[g[0]]][0].padEnd(7)} n${String(g.length).padStart(5)}  at ${f(s.map((x) => x / g.length))}  lo ${f(lo)}  hi ${f(hi)}`;
});
console.log(out.join('\n'));
