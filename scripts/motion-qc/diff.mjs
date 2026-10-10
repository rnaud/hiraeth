#!/usr/bin/env node
// Two motion QC runs side by side (.claude/skills/motion-qc/SKILL.md): before → after, per scenario and way, the
// measures that matter, as a markdown table (for the docs and the changelog's numbers).
//   node scripts/motion-qc/diff.mjs <before>/motion.json <after>/motion.json [--way moves]
import { readFileSync } from 'node:fs';

const [a, b, ...rest] = process.argv.slice(2);
const way = rest.includes('--way') ? rest[rest.indexOf('--way') + 1] : null;
const A = JSON.parse(readFileSync(a, 'utf8')).results, B = JSON.parse(readFileSync(b, 'utf8')).results;
const cm = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) : '∞');
const n1 = (x) => (Number.isFinite(x) ? x.toFixed(0) : '∞');
const arrow = (x, y, f) => `${f(x)} → ${f(y)}`;
const rows = [];
const sum = { a: { red: 0, fails: 0, p95: 0, pops: 0, jolts: 0, bnd: 0, n: 0 }, b: { red: 0, fails: 0, p95: 0, pops: 0, jolts: 0, bnd: 0, n: 0 } };
for (const k of Object.keys(B)) {
  if (!A[k] || (way && !k.endsWith(`· ${way}`))) continue;
  const x = A[k].measures, y = B[k].measures;
  for (const [s, r] of [[sum.a, A[k]], [sum.b, B[k]]]) { s.red += r.green ? 0 : 1; s.fails += r.fails.length; s.p95 += r.measures.slideP95; s.pops += r.measures.popsPerMin; s.jolts += r.measures.joltsPerMin; s.bnd += r.measures.boundaryMax; s.n++; }
  rows.push(`| ${k} | ${A[k].green ? 'green' : 'red'} → ${B[k].green ? 'green' : 'red'} | ${arrow(x.slideP95, y.slideP95, cm)} | ${arrow(x.slideMax, y.slideMax, cm)} | ${arrow(x.held, y.held, cm)} | ${arrow(x.popsPerMin, y.popsPerMin, n1)} | ${arrow(x.joltsPerMin, y.joltsPerMin, n1)} | ${arrow(x.joltMax, y.joltMax, cm)} | ${arrow(x.boundaryMax, y.boundaryMax, cm)} |`);
}
console.log('| scenario · way | verdict | slide p95 (cm) | slide max (cm) | held (cm) | pops /min | jolts /min | worst jolt (cm) | boundary (cm) |');
console.log('|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
const avg = (s, k) => s[k] / Math.max(1, s.n);
console.log(`\nred runs ${sum.a.red} → ${sum.b.red} of ${sum.b.n}; limits failed ${sum.a.fails} → ${sum.b.fails}; mean slide p95 ${cm(avg(sum.a, 'p95'))} → ${cm(avg(sum.b, 'p95'))} cm; mean pops ${avg(sum.a, 'pops').toFixed(1)} → ${avg(sum.b, 'pops').toFixed(1)} /min; mean jolts ${avg(sum.a, 'jolts').toFixed(1)} → ${avg(sum.b, 'jolts').toFixed(1)} /min; mean worst boundary ${cm(avg(sum.a, 'bnd'))} → ${cm(avg(sum.b, 'bnd'))} cm`);
