// The WebView-vs-Chrome runs on the handheld (android-engines.mjs) in one file, the medians over rounds:
//   node scripts/bench/android-engines-summary.mjs scripts/bench/results/raw/android-engines-<date> [out.json] [--placement <raw dir>]
// (--placement: a later run whose samples of the page's main thread name the cores it ran on; the main runs
// of 2026-10-05 sampled the renderer's first thread, Android's, instead, so their core shares are left out)
// writes scripts/bench/results/android-webview-vs-chrome.json (no per-frame lists) and prints the tables
// of docs/benchmark-web-vs-unity.md ("On the Retroid: WebView 109 vs Chrome 154").
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';
import { med, readRuns, rowsOf, perRunOf, engineSummaryOf } from './android-engines-stats.mjs';

const args = process.argv.slice(2), pi = args.indexOf('--placement');
const placementDir = pi >= 0 ? resolve(args[pi + 1]) : null;
if (pi >= 0) args.splice(pi, 2);
const dir = resolve(args[0]);
const out = resolve(args[1] ?? `${ROOT}/scripts/bench/results/android-webview-vs-chrome.json`);
const runs = readRuns(dir, ['webview', 'chrome']);
const { rows, names, all, kept } = rowsOf(runs, ['webview', 'chrome']);
const perRun = perRunOf(runs);
const engineSummary = {};
for (const engine of ['webview', 'chrome']) engineSummary[engine] = engineSummaryOf(runs, perRun, engine);
const extOnly = (a, b) => (engineSummary[a].gl?.extensions ?? []).filter((x) => !(engineSummary[b].gl?.extensions ?? []).includes(x));
const webDiff = Object.keys(engineSummary.chrome.web ?? {}).filter((k) => engineSummary.chrome.web[k] !== engineSummary.webview.web?.[k]).map((k) => ({ feature: k, chrome: engineSummary.chrome.web[k], webview: engineSummary.webview.web?.[k] }));
// where the page's main thread ran (the placement run): share of samples per core, per engine and view
let placementCheck = null;
if (placementDir) {
  const pr = readdirSync(placementDir).filter((f) => /^r\d+-(webview|chrome)-\w+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(placementDir, f), 'utf8')));
  placementCheck = { from: relative(ROOT, placementDir), runs: pr.map((r) => ({ engine: r.engine, mode: r.mode, placement: r.placement, js: r.js,
    views: r.views.map((v) => ({ view: v.name, js: v.cpu?.median, median: v.frame?.median, missed: v.missedShare, cores: v.mainThreadCores })) })) };
  for (const r of placementCheck.runs) {
    const all = {}; for (const v of r.views) for (const [c, n] of Object.entries(v.cores?.byCore ?? {})) all[c] = (all[c] ?? 0) + n;
    const n = Object.values(all).reduce((a, b) => a + b, 0);
    r.mainThreadByCore = Object.fromEntries(Object.entries(all).map(([c, k]) => [`cpu${c}`, +(k / n * 100).toFixed(0)]));
  }
}
let build = null;
try { build = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* */ }
const result = {
  about: 'Memento on the Retroid Pocket Nova: the same web build in the system WebView 109 (the app\'s engine, a side-by-side debug build com.rnaud.moebius.perf) and in Chrome 154; Handheld preset; scripts/bench/android-engines.mjs',
  from: relative(ROOT, dir), build, time: new Date().toISOString(),
  method: { secs: runs[0]?.views?.[0]?.secs, rounds: Math.max(...runs.map((r) => r.round)), modes: { fixed: 'dynamic resolution off, render scale 0.75 on both (equal pixels)', dynamic: 'the Handheld preset as shipped (dynamic resolution 0.5–0.9), starting at 0.75' },
    missed: 'share of 60 Hz refreshes missed: each frame interval counts round(interval / 16.7) refreshes, all but one missed', js: 'median time of the animation-frame callbacks (the game\'s whole frame on the main thread)',
    gc: 'V8 GC pauses on the page\'s main thread (trace category disabled-by-default-v8.gc; steps under 0.3 ms apart merged)' },
  engines: engineSummary, differences: { extensionsOnlyChrome: extOnly('chrome', 'webview'), extensionsOnlyWebView: extOnly('webview', 'chrome'), web: webDiff },
  rows, runs: perRun, placementCheck,
};
writeFileSync(out, JSON.stringify(result, null, 1) + '\n');

// ------------------------------------------------------------------ the tables (markdown)
const row = (e, m, v) => rows.find((x) => x.engine === e && x.mode === m && x.view === v);
const f = (x, d = 1) => (x == null ? '–' : (+x).toFixed(d));
const rg = (r, k, d = 1) => (r?.[k + 'Range'] ? ` (${f(r[k + 'Range'][0], d)}–${f(r[k + 'Range'][1], d)})` : '');
console.log('\n#### Fixed 0.75 (equal pixels)\n');
console.log('| Where | WebView 109: median / p95 / p99 ms | missed | JS ms | Chrome 154: median / p95 / p99 ms | missed | JS ms | GPU busy W / C | GC ms/s W / C (max) |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const v of names) {
  const w = row('webview', 'fixed', v), c = row('chrome', 'fixed', v);
  if (!w && !c) continue;
  console.log(`| ${v} | ${f(w?.median)} / ${f(w?.p95)} / ${f(w?.p99)} | ${f(w?.missed, 0)} %${rg(w, 'missed', 0)} | ${f(w?.js)} | ${f(c?.median)} / ${f(c?.p95)} / ${f(c?.p99)} | ${f(c?.missed, 0)} %${rg(c, 'missed', 0)} | ${f(c?.js)} | ${f(w?.gpuBusy, 0)} / ${f(c?.gpuBusy, 0)} % | ${f(w?.gcMsPerS)} (${f(w?.gcMax)}) / ${f(c?.gcMsPerS)} (${f(c?.gcMax)}) |`);
}
console.log('\n#### Dynamic resolution (the Handheld preset as shipped)\n');
console.log('| Where | WebView: scale | median / p95 ms | missed | Chrome: scale | median / p95 ms | missed |');
console.log('|---|---|---|---|---|---|---|');
for (const v of names) {
  const w = row('webview', 'dynamic', v), c = row('chrome', 'dynamic', v);
  if (!w && !c) continue;
  const sc = (r) => (r ? (r.scaleMin !== r.scaleMax ? `${f(r.scale, 2)} (${f(r.scaleMin, 2)}–${f(r.scaleMax, 2)})` : f(r.scale, 2)) : '–');
  console.log(`| ${v} | ${sc(w)} | ${f(w?.median)} / ${f(w?.p95)} | ${f(w?.missed, 0)} % | ${sc(c)} | ${f(c?.median)} / ${f(c?.p95)} | ${f(c?.missed, 0)} % |`);
}
console.log('\n#### Load, shaders, JS, memory\n');
const W = engineSummary.webview, C = engineSummary.chrome;
const memMed = (e, k) => med(rows.filter((x) => x.engine === e && x.mode === 'fixed').map((x) => x[k]));
console.log('| | WebView 109 | Chrome 154 |\n|---|---|---|');
console.log(`| load, navigation to first frame | ${f(W.load.firstFrameS)} s (${W.load.firstFrameRange?.map((x) => f(x)).join('–')}) | ${f(C.load.firstFrameS)} s (${C.load.firstFrameRange?.map((x) => f(x)).join('–')}) |`);
console.log(`| shader test: ${W.shaders?.programs} programs, made unique, one by one | ${f(W.shaders?.serialMs / 1000)} s (median ${f(W.shaders?.medianMs, 0)} ms, worst ${f(W.shaders?.worstMs, 0)} ms) | ${f(C.shaders?.serialMs / 1000)} s (median ${f(C.shaders?.medianMs, 0)} ms, worst ${f(C.shaders?.worstMs, 0)} ms) |`);
console.log(`| the same again (a cache could serve them) | ${f(W.shaders?.againMs / 1000)} s | ${f(C.shaders?.againMs / 1000)} s |`);
console.log(`| the game's own sources, as loaded (a persistent cache could serve them) | ${f(W.shaders?.originalMs / 1000)} s | ${f(C.shaders?.originalMs / 1000)} s |`);
console.log(`| KHR_parallel_shader_compile | ${W.shaders?.parallelExt ? 'yes' : 'no'} | ${C.shaders?.parallelExt ? 'yes' : 'no'} |`);
console.log(`| plain JS (three.js math loop), k iterations / ms | ${f(W.jsKIterPerMs)} | ${f(C.jsKIterPerMs)} |`);
console.log(`| JS heap used (median over views) | ${f(memMed('webview', 'heapMB'), 0)} MB | ${f(memMed('chrome', 'heapMB'), 0)} MB |`);
console.log(`| renderer process PSS | ${f(memMed('webview', 'rendererMB'), 0)} MB | ${f(memMed('chrome', 'rendererMB'), 0)} MB |`);
console.log(`| GPU host PSS (WebView: the app's process; Chrome: its GPU process) | ${f(memMed('webview', 'hostMB'), 0)} MB | ${f(memMed('chrome', 'hostMB'), 0)} MB |`);
console.log(`| renderer allowed cores | ${W.placement?.renderer?.allowed} | ${C.placement?.renderer?.allowed} |`);
if (placementCheck) for (const r of placementCheck.runs) console.log(`main thread (${r.engine}, allowed ${r.placement?.renderer?.allowed}): ${Object.entries(r.mainThreadByCore).map(([c, p]) => `${c} ${p} %`).join(', ')}; JS loop ${r.js?.kIterPerMs}`);
console.log(`\nextensions only in Chrome: ${result.differences.extensionsOnlyChrome.join(', ')}; only in the WebView: ${result.differences.extensionsOnlyWebView.join(', ') || 'none'}`);
console.log(`web features that differ: ${webDiff.map((d) => `${d.feature} (Chrome ${d.chrome}, WebView ${d.webview})`).join(', ')}`);
console.log(`\nwrote ${out} (${rows.length} rows from ${runs.length} runs, ${all.length - kept.length} interrupted views left out)`);
