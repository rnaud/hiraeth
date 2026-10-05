// The runs of android-engines.mjs (one engine, one mode, one round each) reduced to medians over rounds,
// shared by android-engines-summary.mjs (WebView vs Chrome) and android-gecko-summary.mjs (GeckoView).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const med = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(3); };
export const range = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)); return s.length ? [Math.min(...s), Math.max(...s)] : null; };

/** the run files of a raw directory, for the engines given */
export const readRuns = (dir, engines) => readdirSync(dir).filter((f) => new RegExp(`^r\\d+-(${engines.join('|')})-(fixed|dynamic)\\.json$`).test(f)).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

/** one view of one run, flat */
export function flat(run, v) {
  return {
    engine: run.engine, mode: run.mode, round: run.round, view: v.name, kind: v.kind, interrupted: v.interrupted,
    median: v.frame?.median, p95: v.frame?.p95, p99: v.frame?.p99, mean: v.frame?.mean, fps: v.fps, missed: v.missedShare, over20: v.over20, hitches: v.hitches,
    js: v.cpu?.median, jsP95: v.cpu?.p95,
    gcMsPerS: v.gc && !v.gc.error ? +(v.gc.totalMs / v.gc.secs).toFixed(2) : null, gcMax: v.gc?.maxMs, gcOver4: v.gc?.over4ms, scavengesPerS: v.gc && !v.gc.error ? +(v.gc.scavenges / v.gc.secs).toFixed(2) : null, markCompacts: v.gc?.markCompacts,
    gpuBusy: v.gpuBusy, gpuMHz: v.gpuMHz, gpuC: v.gpuC, cpuC: v.cpuC, thermal: v.thermal,
    scale: v.scales?.median, scaleMin: v.scales?.min, scaleMax: v.scales?.max,
    heapMB: v.heapMB, rendererMB: v.mem?.renderer?.pssMB, hostMB: v.mem?.host?.pssMB, hostGraphicsMB: v.mem?.host?.graphicsMB, parentMB: v.mem?.parent?.pssMB,
    rendererCores: v.proc?.renderer?.cores, hostCores: v.proc?.host?.cores, parentCores: v.proc?.parent?.cores,
    draws: v.draws, tris: v.tris,
  };
}
export const KEYS = ['median', 'p95', 'p99', 'mean', 'fps', 'missed', 'over20', 'hitches', 'js', 'jsP95', 'gcMsPerS', 'gcMax', 'gcOver4', 'scavengesPerS', 'markCompacts', 'gpuBusy', 'gpuMHz', 'gpuC', 'cpuC',
  'scale', 'scaleMin', 'scaleMax', 'heapMB', 'rendererMB', 'hostMB', 'hostGraphicsMB', 'parentMB', 'rendererCores', 'hostCores', 'parentCores', 'draws', 'tris'];

/** medians (and ranges where the rounds differ) per engine, mode and view, interrupted views left out */
export function rowsOf(runs, engines) {
  const all = runs.flatMap((run) => run.views.map((v) => flat(run, v)));
  const kept = all.filter((x) => !x.interrupted);
  const names = [...new Set(all.map((x) => x.view))];
  const rows = [];
  for (const mode of ['fixed', 'dynamic']) for (const engine of engines) for (const view of names) {
    const xs = kept.filter((x) => x.engine === engine && x.mode === mode && x.view === view);
    if (!xs.length) continue;
    const row = { engine, mode, view, kind: xs[0].kind, rounds: xs.length };
    for (const k of KEYS) { row[k] = med(xs.map((x) => x[k])); const rg = range(xs.map((x) => x[k])); if (rg && rg[0] !== rg[1]) row[k + 'Range'] = rg; }
    rows.push(row);
  }
  return { rows, names, all, kept };
}

export const perRunOf = (runs) => runs.map((r) => ({
  engine: r.engine, mode: r.mode, round: r.round, browser: r.browser, v8: r.v8, time: r.time, load: r.load, shaders: r.shaders, js: r.js, placement: r.placement,
  start: r.start, end: r.end, gpuEstimate: r.gpuEstimate, errors: r.errors, warnings: r.warnings, interrupted: r.views.filter((v) => v.interrupted).map((v) => v.name),
})).sort((a, b) => a.round - b.round || a.mode.localeCompare(b.mode) || a.engine.localeCompare(b.engine));

/** per engine: what it is, its load, the shader test, the plain-JS loop, its warnings */
export function engineSummaryOf(runs, perRun, engine) {
  const rs = perRun.filter((r) => r.engine === engine);
  const sh = rs.map((r) => r.shaders).filter((s) => s && !s.error);
  const f = runs.find((r) => r.engine === engine)?.features;
  return {
    browser: rs[0]?.browser, v8: rs[0]?.v8, ua: f?.ua, gl: f && { renderer: f.renderer, version: f.version, view: f.view, dpr: f.dpr, limits: f.limits, extensions: f.extensions, contextAttributes: f.contextAttributes }, web: f?.web,
    placement: rs[0]?.placement,
    load: { firstFrameS: med(rs.map((r) => r.load?.firstFrame)), firstFrameRange: range(rs.map((r) => r.load?.firstFrame)), runs: rs.length, transferMB: med(rs.map((r) => r.load?.transferMB)), programsAtFirstFrame: med(rs.map((r) => r.load?.programsAtFirstFrame)) },
    shaders: sh.length ? { programs: sh[0].programs, sourceKB: sh[0].sourceKB, serialMs: med(sh.map((s) => s.serialMs)), serialRange: range(sh.map((s) => s.serialMs)), medianMs: med(sh.map((s) => s.medianMs)), worstMs: med(sh.map((s) => s.worstMs)), againMs: med(sh.map((s) => s.againMs)), originalMs: med(sh.map((s) => s.originalMs)), parallelExt: sh[0].parallelExt, parallelMs: med(sh.map((s) => s.parallelMs)), runs: sh.length } : null,
    jsKIterPerMs: med(rs.map((r) => r.js?.kIterPerMs)), jsRange: range(rs.map((r) => r.js?.kIterPerMs)),
    warnings: [...new Set(rs.flatMap((r) => r.warnings ?? []))], errors: [...new Set(rs.flatMap((r) => r.errors ?? []))],
  };
}
