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

const args = process.argv.slice(2), pi = args.indexOf('--placement');
const placementDir = pi >= 0 ? resolve(args[pi + 1]) : null;
if (pi >= 0) args.splice(pi, 2);
const dir = resolve(args[0]);
const out = resolve(args[1] ?? `${ROOT}/scripts/bench/results/android-webview-vs-chrome.json`);
const runs = readdirSync(dir).filter((f) => /^r\d+-(webview|chrome)-(fixed|dynamic)\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const med = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(3); };
const range = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)); return s.length ? [Math.min(...s), Math.max(...s)] : null; };
const r1 = (x) => (x == null ? null : +x.toFixed(1));

/** one view of one run, flat */
function flat(run, v) {
  return {
    engine: run.engine, mode: run.mode, round: run.round, view: v.name, kind: v.kind, interrupted: v.interrupted,
    median: v.frame?.median, p95: v.frame?.p95, p99: v.frame?.p99, mean: v.frame?.mean, fps: v.fps, missed: v.missedShare, over20: v.over20, hitches: v.hitches,
    js: v.cpu?.median, jsP95: v.cpu?.p95,
    gcMsPerS: v.gc ? +(v.gc.totalMs / v.gc.secs).toFixed(2) : null, gcMax: v.gc?.maxMs, gcOver4: v.gc?.over4ms, scavengesPerS: v.gc ? +(v.gc.scavenges / v.gc.secs).toFixed(2) : null, markCompacts: v.gc?.markCompacts,
    gpuBusy: v.gpuBusy, gpuMHz: v.gpuMHz, gpuC: v.gpuC, cpuC: v.cpuC, thermal: v.thermal,
    scale: v.scales?.median, scaleMin: v.scales?.min, scaleMax: v.scales?.max,
    heapMB: v.heapMB, rendererMB: v.mem?.renderer?.pssMB, hostMB: v.mem?.host?.pssMB, hostGraphicsMB: v.mem?.host?.graphicsMB,
    rendererCores: v.proc?.renderer?.cores, hostCores: v.proc?.host?.cores,
    draws: v.draws, tris: v.tris,
  };
}
const all = runs.flatMap((run) => run.views.map((v) => flat(run, v)));
const kept = all.filter((x) => !x.interrupted);
const KEYS = ['median', 'p95', 'p99', 'mean', 'fps', 'missed', 'over20', 'hitches', 'js', 'jsP95', 'gcMsPerS', 'gcMax', 'gcOver4', 'scavengesPerS', 'markCompacts', 'gpuBusy', 'gpuMHz', 'gpuC', 'cpuC',
  'scale', 'scaleMin', 'scaleMax', 'heapMB', 'rendererMB', 'hostMB', 'hostGraphicsMB', 'rendererCores', 'hostCores', 'draws', 'tris'];
const names = [...new Set(all.map((x) => x.view))];
const rows = [];
for (const mode of ['fixed', 'dynamic']) for (const engine of ['webview', 'chrome']) for (const view of names) {
  const xs = kept.filter((x) => x.engine === engine && x.mode === mode && x.view === view);
  if (!xs.length) continue;
  const row = { engine, mode, view, kind: xs[0].kind, rounds: xs.length };
  for (const k of KEYS) { row[k] = med(xs.map((x) => x[k])); const rg = range(xs.map((x) => x[k])); if (rg && rg[0] !== rg[1]) row[k + 'Range'] = rg; }
  rows.push(row);
}
const perRun = runs.map((r) => ({
  engine: r.engine, mode: r.mode, round: r.round, browser: r.browser, v8: r.v8, time: r.time, load: r.load, shaders: r.shaders, js: r.js, placement: r.placement,
  start: r.start, end: r.end, gpuEstimate: r.gpuEstimate, errors: r.errors, warnings: r.warnings, interrupted: r.views.filter((v) => v.interrupted).map((v) => v.name),
})).sort((a, b) => a.round - b.round || a.mode.localeCompare(b.mode) || a.engine.localeCompare(b.engine));
const engineSummary = {};
for (const engine of ['webview', 'chrome']) {
  const rs = perRun.filter((r) => r.engine === engine);
  const sh = rs.map((r) => r.shaders).filter((s) => s && !s.error);
  const f = runs.find((r) => r.engine === engine)?.features;
  engineSummary[engine] = {
    browser: rs[0]?.browser, v8: rs[0]?.v8, ua: f?.ua, gl: f && { renderer: f.renderer, version: f.version, view: f.view, dpr: f.dpr, limits: f.limits, extensions: f.extensions, contextAttributes: f.contextAttributes }, web: f?.web,
    placement: rs[0]?.placement,
    load: { firstFrameS: med(rs.map((r) => r.load?.firstFrame)), firstFrameRange: range(rs.map((r) => r.load?.firstFrame)), runs: rs.length, transferMB: med(rs.map((r) => r.load?.transferMB)), programsAtFirstFrame: med(rs.map((r) => r.load?.programsAtFirstFrame)) },
    shaders: sh.length ? { programs: sh[0].programs, sourceKB: sh[0].sourceKB, serialMs: med(sh.map((s) => s.serialMs)), serialRange: range(sh.map((s) => s.serialMs)), medianMs: med(sh.map((s) => s.medianMs)), worstMs: med(sh.map((s) => s.worstMs)), againMs: med(sh.map((s) => s.againMs)), originalMs: med(sh.map((s) => s.originalMs)), parallelExt: sh[0].parallelExt, parallelMs: med(sh.map((s) => s.parallelMs)), runs: sh.length } : null,
    jsKIterPerMs: med(rs.map((r) => r.js?.kIterPerMs)), jsRange: range(rs.map((r) => r.js?.kIterPerMs)),
    warnings: [...new Set(rs.flatMap((r) => r.warnings ?? []))], errors: [...new Set(rs.flatMap((r) => r.errors ?? []))],
  };
}
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
