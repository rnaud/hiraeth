// Every world on the handheld, before and after (scripts/bench/android-worlds.mjs raw runs):
//   node scripts/bench/android-worlds-summary.mjs <before dir> <after dir> [--mode fixed] [--out file] [--label "a → b"]
// writes scripts/bench/results/android-worlds.json (no per-frame lists) and prints the tables of
// docs/systems/performance.md ("Every world on the Retroid, in GeckoView").
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { ROOT, options } from './lib.mjs';

const args = process.argv.slice(2), [A, B] = args.slice(0, 2).map((d) => resolve(d)), opt = options(args.slice(2));
const mode = opt.mode ?? 'fixed', out = resolve(opt.out ?? `${ROOT}/scripts/bench/results/android-worlds.json`);
const read = (d, w) => { const f = `${d}/${w}-${mode}.json`; return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
const worlds = [...new Set(readdirSync(B).filter((f) => f.endsWith(`-${mode}.json`)).map((f) => f.replace(`-${mode}.json`, '')))].sort();
const slim = (v) => v && { fps: v.fps, p50: v.frame?.median, p95: v.frame?.p95, p99: v.frame?.p99, missed: v.missedShare, js: v.cpu?.median, jsP95: v.cpu?.p95, jsSpikes: v.jsSpikes,
  gpuBusy: v.gpuBusy, gpuMHz: v.gpuMHz, draws: v.draws, tris: v.tris, scale: v.scales?.median ?? v.scale, gpuC: v.gpuC, tabMB: v.mem?.tab?.pssMB, profile: v.profile?.bySystem };
const rows = [];
for (const w of worlds) {
  const a = read(A, w), b = read(B, w);
  rows.push({ world: w, load: { before: a?.load.firstFrame, after: b.load.firstFrame }, memoryMB: { before: a?.memLoaded, after: b.memLoaded },
    views: b.views.map((v) => ({ view: v.name, before: slim(a?.views.find((x) => x.name === v.name)), after: slim(v) })) });
}
writeFileSync(out, JSON.stringify({ about: 'Memento on the Retroid Pocket Nova, every world, GeckoView 157 test app (com.rnaud.moebius.gecko), Handheld preset; scripts/bench/android-worlds.mjs',
  mode, before: relative(ROOT, A), after: relative(ROOT, B), label: opt.label ?? null, time: new Date().toISOString(), rows }, null, 1) + '\n');
const f = (x, d = 1) => (x == null ? '–' : (+x).toFixed(d));
const pair = (r, k, d = 1) => `${r.before ? f(r.before[k], d) + ' → ' : ''}${f(r.after[k], d)}`;
console.log('| world | view | fps | p95 ms | missed % | JS ms | GPU busy % | draws |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) for (const v of r.views) console.log(`| ${r.world} | ${v.view} | ${pair(v, 'fps', 0)} | ${pair(v, 'p95')} | ${pair(v, 'missed', 0)} | ${pair(v, 'js')} | ${pair(v, 'gpuBusy', 0)} | ${f(v.after.draws, 0)} |`);
console.log('\n| world | load s | memory after load MB (content + GPU + parent process) |');
console.log('|---|---|---|');
for (const r of rows) { const m = r.memoryMB; console.log(`| ${r.world} | ${f(r.load.before)} → ${f(r.load.after)} | ${f(m.before?.totalMB, 0)} → ${f(m.after.totalMB, 0)} (${f(m.after.tab?.pssMB, 0)} + ${f(m.after.gpu?.pssMB, 0)} + ${f(m.after.parent?.pssMB, 0)}) |`); }
