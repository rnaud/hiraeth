// GeckoView against the system WebView 109 (both measured in the same session) and Chrome 154 (the
// earlier run, scripts/bench/results/android-webview-vs-chrome.json), on the handheld:
//   node scripts/bench/android-gecko-summary.mjs <raw dir> [--apk <raw dir of gecko-apk runs>] [--out file]
// writes scripts/bench/results/android-gecko.json (no per-frame lists) and prints the tables of
// docs/benchmark-web-vs-unity.md ("On the Retroid: GeckoView").
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { ROOT, options } from './lib.mjs';
import { med, readRuns, rowsOf, perRunOf, engineSummaryOf } from './android-engines-stats.mjs';

const args = process.argv.slice(2);
const dir = resolve(args[0]);
const opt = options(args.slice(1));
const out = resolve(opt.out ?? `${ROOT}/scripts/bench/results/android-gecko.json`);
const earlier = JSON.parse(readFileSync(`${ROOT}/scripts/bench/results/android-webview-vs-chrome.json`, 'utf8'));

const runs = [...readRuns(dir, ['gecko', 'webview']), ...(opt.apk ? readRuns(resolve(opt.apk), ['gecko-apk']) : [])];
const engines = ['gecko', 'webview', 'gecko-apk'].filter((e) => runs.some((r) => r.engine === e));
const { rows, names, all, kept } = rowsOf(runs, engines);
const perRun = perRunOf(runs);
const summary = Object.fromEntries(engines.map((e) => [e, engineSummaryOf(runs, perRun, e)]));
// Chrome 154 and the WebView of the earlier session, as they were measured
const chromeRows = earlier.rows.filter((r) => r.engine === 'chrome'), webviewBefore = earlier.rows.filter((r) => r.engine === 'webview');
const C = earlier.engines.chrome, W0 = earlier.engines.webview;

const extOnly = (a, b) => (a?.gl?.extensions ?? []).filter((x) => !(b?.gl?.extensions ?? []).includes(x));
const webDiff = (a, b) => Object.keys(a?.web ?? {}).filter((k) => a.web[k] !== b?.web?.[k]).map((k) => ({ feature: k, a: a.web[k], b: b?.web?.[k] }));
const result = {
  about: 'Memento on the Retroid Pocket Nova: the same web build in GeckoView 157 (com.rnaud.moebius.gecko, the game from this Mac, and from its APK: gecko-apk) and in the system WebView 109 (com.rnaud.moebius.perf), same session, rounds alternating; Chrome 154 from the earlier session; Handheld preset; scripts/bench/android-engines.mjs',
  from: relative(ROOT, dir), apkFrom: opt.apk ? relative(ROOT, resolve(opt.apk)) : null, build: earlier.build, time: new Date().toISOString(),
  method: { ...earlier.method, gc: 'Chromium only (V8 trace); GeckoView has no DevTools trace', heap: 'Chromium only (performance.memory)' },
  engines: summary, chrome: C,
  differences: { extensionsOnlyGecko: extOnly(summary.gecko, summary.webview), extensionsOnlyWebView: extOnly(summary.webview, summary.gecko), extensionsOnlyChrome: extOnly(C, summary.gecko), extensionsOnlyGeckoVsChrome: extOnly(summary.gecko, C), webGeckoVsWebView: webDiff(summary.gecko, summary.webview) },
  rows, chromeRows, webviewBefore, runs: perRun,
};
writeFileSync(out, JSON.stringify(result, null, 1) + '\n');

// ------------------------------------------------------------------ the tables (markdown)
const row = (e, m, v) => (e === 'chrome' ? chromeRows : e === 'webview-before' ? webviewBefore : rows).find((x) => (e === 'chrome' || e === 'webview-before' || x.engine === e) && x.mode === m && x.view === v);
const f = (x, d = 1) => (x == null ? '–' : (+x).toFixed(d));
const rg = (r, k, d = 0) => (r?.[k + 'Range'] ? ` (${f(r[k + 'Range'][0], d)}–${f(r[k + 'Range'][1], d)})` : '');
const fr = (r) => `${f(r?.median)} / ${f(r?.p95)} / ${f(r?.p99)}`;
console.log('\n#### Equal pixels (render scale 0.75)\n');
console.log('| Where | GeckoView 157: median / p95 / p99 ms | missed | JS ms | WebView 109: median / p95 / p99 ms | missed | JS ms | Chrome 154 (earlier): median / p95 / p99 ms | missed | JS ms | GPU busy G / W / C |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const v of names) {
  const g = row('gecko', 'fixed', v), w = row('webview', 'fixed', v), c = row('chrome', 'fixed', v);
  if (!g && !w) continue;
  console.log(`| ${v} | ${fr(g)} | ${f(g?.missed, 0)} %${rg(g, 'missed')} | ${f(g?.js)} | ${fr(w)} | ${f(w?.missed, 0)} %${rg(w, 'missed')} | ${f(w?.js)} | ${fr(c)} | ${f(c?.missed, 0)} % | ${f(c?.js)} | ${f(g?.gpuBusy, 0)} / ${f(w?.gpuBusy, 0)} / ${f(c?.gpuBusy, 0)} % |`);
}
console.log('\n(the WebView in the earlier session, for comparison: ' + names.map((v) => { const b = row('webview-before', 'fixed', v); return b ? `${v} ${f(b.missed, 0)} % / ${f(b.js)} ms` : null; }).filter(Boolean).join(', ') + ')');
console.log('\n#### As shipped (dynamic resolution)\n');
console.log('| Where | GeckoView: scale | median / p95 ms | missed | WebView: scale | median / p95 ms | missed | Chrome (earlier): scale | median / p95 ms | missed |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
const sc = (r) => (r ? (r.scaleMin !== r.scaleMax && r.scaleMin != null ? `${f(r.scale, 2)} (${f(r.scaleMin, 2)}–${f(r.scaleMax, 2)})` : f(r.scale, 2)) : '–');
for (const v of names) {
  const g = row('gecko', 'dynamic', v), w = row('webview', 'dynamic', v), c = row('chrome', 'dynamic', v);
  if (!g && !w) continue;
  console.log(`| ${v} | ${sc(g)} | ${f(g?.median)} / ${f(g?.p95)} | ${f(g?.missed, 0)} % | ${sc(w)} | ${f(w?.median)} / ${f(w?.p95)} | ${f(w?.missed, 0)} % | ${sc(c)} | ${f(c?.median)} / ${f(c?.p95)} | ${f(c?.missed, 0)} % |`);
}
if (summary['gecko-apk']) {
  console.log('\n#### GeckoView with the game bundled in the APK (fixed 0.75)\n');
  console.log('| Where | median / p95 / p99 ms | missed | JS ms |\n|---|---|---|---|');
  for (const v of names) { const a = row('gecko-apk', 'fixed', v); if (a) console.log(`| ${v} | ${fr(a)} | ${f(a.missed, 0)} % | ${f(a.js)} |`); }
}
console.log('\n#### Load, shaders, JS, memory\n');
const G = summary.gecko, W = summary.webview, A = summary['gecko-apk'];
const memMed = (e, k) => med(rows.filter((x) => x.engine === e && x.mode === 'fixed').map((x) => x[k]));
const memC = (k) => med(chromeRows.filter((x) => x.mode === 'fixed').map((x) => x[k]));
const ld = (s) => (s ? `${f(s.load.firstFrameS)} s (${s.load.firstFrameRange?.map((x) => f(x)).join('–')})` : '–');
const shd = (s) => (s?.shaders ? `${f(s.shaders.serialMs / 1000)} s (median ${f(s.shaders.medianMs, 0)} ms, worst ${f(s.shaders.worstMs, 0)} ms)` : '–');
console.log('| | GeckoView 157 | WebView 109 | Chrome 154 (earlier) |\n|---|---|---|---|');
console.log(`| load, navigation to the first frame (9.6 MB over USB) | ${ld(G)} | ${ld(W)} | ${ld(C)} |`);
if (A) console.log(`| load, the game from the APK (the app's loopback server) | ${ld(A)} | | |`);
console.log(`| shader test: ${G.shaders?.programs} programs made unique, one by one | ${shd(G)} | ${shd(W)} | ${shd(C)} |`);
console.log(`| the same again | ${f(G.shaders?.againMs / 1000)} s | ${f(W.shaders?.againMs / 1000)} s | ${f(C.shaders?.againMs / 1000)} s |`);
console.log(`| the game's own sources, as loaded | ${f(G.shaders?.originalMs / 1000)} s | ${f(W.shaders?.originalMs / 1000)} s | ${f(C.shaders?.originalMs / 1000)} s |`);
console.log(`| KHR_parallel_shader_compile | ${G.shaders?.parallelExt ? 'yes' : 'no'} | ${W.shaders?.parallelExt ? 'yes' : 'no'} | ${C.shaders?.parallelExt ? 'yes' : 'no'} |`);
console.log(`| plain JS (a three.js matrix loop), k iterations per ms | ${f(G.jsKIterPerMs)} | ${f(W.jsKIterPerMs)} | ${f(C.jsKIterPerMs)} |`);
console.log(`| JS heap used | – (no performance.memory) | ${f(memMed('webview', 'heapMB'), 0)} MB | ${f(memC('heapMB'), 0)} MB |`);
console.log(`| page process PSS (Gecko: its content process) | ${f(memMed('gecko', 'rendererMB'), 0)} MB | ${f(memMed('webview', 'rendererMB'), 0)} MB | ${f(memC('rendererMB'), 0)} MB |`);
console.log(`| GPU host PSS (Gecko: its GPU process; WebView: the app; Chrome: its GPU process) | ${f(memMed('gecko', 'hostMB'), 0)} MB | ${f(memMed('webview', 'hostMB'), 0)} MB | ${f(memC('hostMB'), 0)} MB |`);
console.log(`| Gecko's parent (the app's own process) PSS | ${f(memMed('gecko', 'parentMB'), 0)} MB | | |`);
console.log(`| page process CPU, cores busy (median over views) | ${f(memMed('gecko', 'rendererCores'), 2)} | ${f(memMed('webview', 'rendererCores'), 2)} | ${f(memC('rendererCores'), 2)} |`);
console.log(`| GPU host CPU, cores busy | ${f(memMed('gecko', 'hostCores'), 2)} | ${f(memMed('webview', 'hostCores'), 2)} | ${f(memC('hostCores'), 2)} |`);
console.log(`| cores the page process may run on | ${G.placement?.renderer?.allowed} | ${W.placement?.renderer?.allowed} | ${C.placement?.renderer?.allowed} |`);
console.log(`\nWebGL 2 extensions only in Gecko (vs the WebView): ${result.differences.extensionsOnlyGecko.join(', ') || 'none'}; only in the WebView: ${result.differences.extensionsOnlyWebView.join(', ') || 'none'}; only in Chrome (vs Gecko): ${result.differences.extensionsOnlyChrome.join(', ') || 'none'}`);
console.log(`web features, Gecko vs WebView: ${result.differences.webGeckoVsWebView.map((d) => `${d.feature} ${d.a}/${d.b}`).join(', ')}`);
console.log(`Gecko warnings: ${G.warnings.join(' | ')}; errors: ${G.errors.join(' | ') || 'none'}`);
console.log(`\nwrote ${out} (${rows.length} rows from ${runs.length} runs, ${all.length - kept.length} interrupted views left out)`);
