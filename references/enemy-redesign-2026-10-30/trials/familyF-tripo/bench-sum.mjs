// #800 family F: bench-world.sh's runs (familyA-tripo) summed: per preset, before and after, what six of a kind add over
// none (draw calls, triangles, the script's and the frame's ms), the mean of the rounds.
//
//   node references/enemy-redesign-2026-10-30/trials/familyF-tripo/bench-sum.mjs <bench.jsonl>
import { readFileSync } from 'node:fs';

const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const pick = (r, ...k) => { for (const x of k) { const v = x.split('.').reduce((o, p) => o?.[p], r); if (typeof v === 'number') return v; } return null; };
const key = (r) => `${r.quality} ${r.who}`;
const groups = new Map();
for (const r of rows) { const k = key(r); if (!groups.has(k)) groups.set(k, { none: [], six: [] }); groups.get(k)[r.pack].push(r); }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const FIELDS = { draws: ['calls'], triangles: ['tris'], cpu: ['cpu'], gpu: ['gpu'] };
console.log('| preset | who | runs | ' + Object.keys(FIELDS).map((f) => `+${f}`).join(' | ') + ' |');
for (const [k, g] of [...groups].sort()) {
  const out = Object.entries(FIELDS).map(([, ks]) => { const a = mean(g.six.map((r) => pick(r, ...ks)).filter((x) => x !== null)), b = mean(g.none.map((r) => pick(r, ...ks)).filter((x) => x !== null)); return Number.isFinite(a - b) ? (a - b).toFixed(Math.abs(a - b) > 100 ? 0 : 2) : '-'; });
  console.log(`| ${k.split(' ').join(' | ')} | ${g.six.length}/${g.none.length} | ${out.join(' | ')} |`);
}
console.log('fields of a run:', Object.keys(rows[0]).join(' '));
