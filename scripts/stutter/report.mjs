// The stutter harness's report (issue #468): every run recorded in a folder (scripts/stutter/run.mjs: <name>.unity.tsv
// and <name>.js.json) read by engine/stutter.js: each run's frame numbers (p50, p99, max, frames over 33 and 50 ms), its
// spikes with their causes and what was happening, and the causes ranked by the time they cost over all runs.
//   node scripts/stutter/report.mjs <dir> [--top 25]
// Writes <dir>/report.md and <dir>/report.json, and prints the report.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseTsv, analyse, rank } from '../../engine/stutter.js';

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = resolve(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'output/stutter/mac');
const TOP = +arg('top', 25);
// (--spike ms: the spike line; the Mac is 4-8 times the handhelds' speed, so 16.7 there finds what costs them 33-100)
const SPIKE = +arg('spike', 33);

const results = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.unity.tsv')).sort()) {
  const name = f.replace(/\.unity\.tsv$/, ''), jsFile = join(DIR, `${name}.js.json`);
  const unity = parseTsv(readFileSync(join(DIR, f), 'utf8'));
  const js = existsSync(jsFile) ? JSON.parse(readFileSync(jsFile, 'utf8')) : null;
  results.push(analyse(unity, js, name, { spikeMs: SPIKE }));
}
const ranked = rank(results);

const L = [];
L.push(`# Stutters: ${DIR}`, '', `Spikes: frames over ${SPIKE} ms. The load (before the first played frame) and its tail (the next 2 s) are left out of the numbers.`, '', '| run | frames | p50 ms | p99 ms | max ms | > 33 ms | > 50 ms | spikes | V8 full GCs | load: frames, max ms | tail: max ms |', '|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) L.push(`| ${r.route} | ${r.play.frames} | ${r.play.p50} | ${r.play.p99} | ${r.play.max} | ${r.play.over33} | ${r.play.over50} | ${r.spikes.length} | ${r.fullGcs} | ${r.load.frames}, ${r.load.max} | ${r.tail.max} |`);
L.push('', '## The causes, by the time they cost (ms over the run\'s median, summed)', '', '| cause | spikes | worst ms | ms lost | runs | at | the worst\'s evidence |', '|---|---|---|---|---|---|---|');
for (const g of ranked) L.push(`| ${g.cause} | ${g.n} | ${g.max} | ${g.lost} | ${g.routes} | ${g.at} | ${g.evidence} |`);
L.push('', `## The ${TOP} longest spikes`, '', '| run | frame | t s | ms | cause | at | evidence |', '|---|---|---|---|---|---|---|');
for (const s of results.flatMap((r) => r.spikes).sort((a, b) => b.ms - a.ms).slice(0, TOP)) L.push(`| ${s.route} | ${s.frame} | ${(+s.t).toFixed(1)} | ${s.ms} | ${s.cause} | ${s.at} | ${s.evidence} |`);
const md = L.join('\n') + '\n';
writeFileSync(join(DIR, 'report.md'), md);
writeFileSync(join(DIR, 'report.json'), JSON.stringify({ results, ranked }, null, 1));
process.stdout.write(md);
