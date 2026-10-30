// The bench's runs (bench-trial.mjs's JSON lines) as a table: per preset and variant, 1 and 6 foes, draws, triangles,
// CPU and GPU ms over the empty Arena's (the mean of the two rounds).  node bench-table.mjs <bench.jsonl>
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((x) => x.r && !x.r.error);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const pick = (q, c, v, n, k) => mean(rows.filter((x) => x.q === q && x.case === c && x.variant === v && x.n === n).map((x) => x.r[k]));
const f = (x, d = 0) => (x >= 0 ? '+' : '') + x.toFixed(d);
console.log('| Preset | Variant | Draws, 1 · 6 | Triangles (all passes), 1 · 6 | CPU ms, 1 · 6 | GPU ms, 1 · 6 |\n|---|---|---|---|---|---|');
for (const q of ['high', 'handheld']) {
  const base = Object.fromEntries(['calls', 'tris', 'cpu', 'gpu'].map((k) => [k, pick(q, 'none', 'current', 1, k)]));
  console.log(`| ${q} | empty Arena | ${base.calls.toFixed(0)} | ${(base.tris / 1000).toFixed(0)}k | ${base.cpu.toFixed(2)} | ${base.gpu.toFixed(2)} |`);
  for (const v of ['current', 'direct', 'tripo']) {
    const d = (k, n) => pick(q, rows.find((x) => x.case !== 'none')?.case, v, n, k) - base[k];
    console.log(`| ${q} | ${v} | ${f(d('calls', 1))} · ${f(d('calls', 6))} | ${f(d('tris', 1) / 1000, 1)}k · ${f(d('tris', 6) / 1000, 1)}k | ${f(d('cpu', 1), 2)} · ${f(d('cpu', 6), 2)} | ${f(d('gpu', 1), 2)} · ${f(d('gpu', 6), 2)} |`);
  }
}
console.log(`\n(${rows.length} runs; load ${Math.min(...rows.map((x) => x.load))}–${Math.max(...rows.map((x) => x.load))})`);
