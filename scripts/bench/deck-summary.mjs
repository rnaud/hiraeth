// The Steam Deck's runs side by side (scripts/bench/deck-worlds.mjs raw files), a world a row:
//   node scripts/bench/deck-summary.mjs "High 1.5×=dir/deck-worlds.json:fixed" "Deck=dir2/deck-worlds.json:fixed" … [--views 1]
// Each column: the views' median fps (the worst view's in brackets), the JS and GPU ms a frame (medians
// over the views), and for a dynamic run the render scale the game chose (the lowest view's median).
// --views 1: a row a view as well. Prints the tables of docs/systems/performance.md ("The Steam Deck").
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const perView = process.argv.includes('--views');
const med = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const f = (x, d = 0) => (x == null ? '–' : (+x).toFixed(d));
const cols = args.map((a) => {
  const [label, spec] = a.split('=');
  const [file, mode = 'fixed'] = spec.split(':');
  const runs = JSON.parse(readFileSync(file, 'utf8')).runs.filter((r) => r.mode === mode);
  return { label, mode, runs: new Map(runs.map((r) => [r.world, r])) };
});
const worlds = [...new Set(cols.flatMap((c) => [...c.runs.keys()]))];
const cell = (views, dyn) => {
  if (!views?.length) return '–';
  const fps = views.map((v) => v.fps), js = med(views.map((v) => v.cpu?.median)), gpu = med(views.map((v) => v.gpu?.median));
  const scale = dyn ? Math.min(...views.map((v) => v.scales?.median ?? v.scale ?? 1)) : null;
  return `${f(med(fps))} (${f(Math.min(...fps))}); ${f(js, 1)} / ${f(gpu, 1)}${dyn ? `; ×${f(scale, 2)}` : ''}`;
};
console.log(`| world | ${cols.map((c) => c.label).join(' | ')} |`);
console.log(`|---|${cols.map(() => '---').join('|')}|`);
for (const w of worlds) {
  console.log(`| ${w} | ${cols.map((c) => { const r = c.runs.get(w); return r?.error ? 'failed' : cell(r?.views, c.mode === 'dynamic'); }).join(' | ')} |`);
  if (!perView) continue;
  const names = [...new Set(cols.flatMap((c) => (c.runs.get(w)?.views ?? []).map((v) => v.name)))];
  for (const n of names) console.log(`| · ${n} | ${cols.map((c) => cell(c.runs.get(w)?.views?.filter((v) => v.name === n), c.mode === 'dynamic')).join(' | ')} |`);
}
