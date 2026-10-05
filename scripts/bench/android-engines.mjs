// The web game on the handheld in two engines, same build, same desert viewpoints and paths
// (viewpoints.json), Handheld preset (docs/benchmark-web-vs-unity.md, "On the Retroid: WebView 109 vs
// Chrome 154"):
//   - webview: the app's own engine, the system WebView, in a side-by-side debug build of the app
//     (com.rnaud.moebius.perf, scripts/bench/webview-apk.sh), reached through
//     adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>;
//   - chrome: the device's Chrome, in a tab of our own (adb forward tcp:9333 localabstract:chrome_devtools_remote).
// Both load http://localhost:5253/ (this Mac, `node scripts/bench/serve.mjs --port 5253`, adb reverse).
//
//   node scripts/bench/android-engines.mjs [--rounds 3] [--modes fixed,dynamic] [--engines webview,chrome]
//        [--only spawn,camps] [--secs 10] [--startC 45] [--raw dir]
// then node scripts/bench/android-engines-summary.mjs <raw dir>.
//
// Per run (one engine, one mode): load to the first frame, then every view and path with the page logic
// of the Mac run (web-page.mjs): frame intervals, JS time per frame (the animation-frame callbacks),
// draw calls; between recordings the GPU's busy share and clock (kgsl), temperatures and the thermal
// status, the processes' CPU (renderer, the GPU's host process) and memory (dumpsys meminfo), the JS
// heap, and for mode `dynamic` the render scale the game's dynamic resolution chose. A trace of V8's
// garbage collector runs alongside (disabled-by-default-v8.gc: only events during a GC) for the pauses
// on the page's main thread. At the end a shader-compile test: every program the game linked, compiled
// again (made unique, so no cache helps) in a fresh WebGL 2 context, one by one and in parallel.
// Modes: `fixed` (dynamic resolution off, render scale 0.75 on both: equal pixels), `dynamic` (the
// Handheld preset as shipped, starting from 0.75).
//
// Device rules: it starts, stops and forwards to com.rnaud.moebius.perf only, and never touches
// com.rnaud.moebius (the player's app) or a system setting; in Chrome it opens one tab of its own and
// closes it at the end (other tabs are left alone); it removes its own adb forward / reverse rules.
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { options, viewpoints, sleep, ROOT } from './lib.mjs';
import { INSTRUMENT } from './browser.mjs';
import { prepareStorage, conditions, runAll, gpuEstimate } from './web-page.mjs';
import { Page, thermal, ADB, fullscreen } from '../handheld-perf/lib.mjs';

const opt = options();
const PKG = 'com.rnaud.moebius.perf', ACTIVITY = `${PKG}/com.rnaud.moebius.MainActivity`;
const PORT = +(opt.port ?? 5253), DTP = +(opt.devtools ?? 9333);
const BASE = `http://localhost:${PORT}/`, DT = `http://localhost:${DTP}`;
const VP = viewpoints();
const secs = +(opt.secs ?? VP.secs), warmup = +(opt.warmup ?? VP.warmup);
const rounds = +(opt.rounds ?? 3);
const modes = String(opt.modes ?? 'fixed,dynamic').split(',');
const engines = String(opt.engines ?? 'webview,chrome').split(',');
const only = typeof opt.only === 'string' ? opt.only.split(',') : null;
const startC = +(opt.startC ?? 45);   // the GPU's temperature to cool down to before a run (°C)
const RAW = resolve(opt.raw ?? `${ROOT}/scripts/bench/results/raw/android-engines-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`);
mkdirSync(RAW, { recursive: true });

// ------------------------------------------------------------------ adb, guarded
/** adb, refusing anything that names the player's app (com.rnaud.moebius without .perf) */
function adb(args, { quiet = false } = {}) {
  const line = args.join(' ');
  if (/com\.rnaud\.moebius(?![.\w])/.test(line)) throw new Error(`refusing to touch the player's app: adb ${line}`);
  if (/\b(settings\s+put|pm\s+(clear|uninstall|disable)|uninstall)\b/.test(line) && !line.includes(PKG)) throw new Error(`refusing: adb ${line}`);
  try { return execFileSync(ADB[0], [...ADB.slice(1), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'pipe'] }); } catch (e) { return String(e.stdout ?? ''); }
}
const sh = (cmd) => adb(['shell', cmd], { quiet: true });

/**
 * Once a second: the GPU's busy share and clock (Qualcomm kgsl, read-only) and, given the page's renderer,
 * the core its main thread (CrRendererMain: not the process's first thread, which is Android's) last ran on
 * (this SoC: 0-2 little, 3-6 mid, 7 prime), sampled 4 times a second.
 */
function gpuSampler(rendererPid = null, mainTid = null) {
  const proc = rendererPid && mainTid ? ` $(for k in 1 2 3 4; do sed 's/.*) //' /proc/${rendererPid}/task/${mainTid}/stat 2>/dev/null | cut -d' ' -f37; sleep 0.25; done | tr '\n' ',')` : '';
  const kid = spawn(ADB[0], [...ADB.slice(1), 'shell', `while true; do echo $(cat /sys/class/kgsl/kgsl-3d0/gpu_busy_percentage) $(cat /sys/class/kgsl/kgsl-3d0/devfreq/cur_freq)${proc}; sleep 1; done`]);
  let rows = [], buf = '';
  kid.stdout.on('data', (d) => { buf += d; const ls = buf.split('\n'); buf = ls.pop(); for (const l of ls) { const m = l.match(/(\d+)\s*%\s+(\d+)(?:\s+([\d,]+))?/); if (m) rows.push([+m[1], +m[2] / 1e6, m[3] ? m[3].split(',').filter(Boolean).map(Number) : []]); } });
  const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null);
  const mean = (a) => (a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : null);
  return {
    take() {
      const cores = rows.flatMap((x) => x[2]);
      const share = (f) => +(cores.filter(f).length / cores.length * 100).toFixed(0);
      const r = { gpuBusy: med(rows.map((x) => x[0])), gpuBusyMean: mean(rows.map((x) => x[0])), gpuMHz: med(rows.map((x) => x[1])), gpuMHzMin: rows.length ? Math.min(...rows.map((x) => x[1])) : null,
        mainThreadCores: cores.length ? { little: share((c) => c <= 2), mid: share((c) => c >= 3 && c <= 6), prime: share((c) => c === 7), n: cores.length, byCore: Object.fromEntries([...new Set(cores)].sort().map((c) => [c, cores.filter((x) => x === c).length])) } : null };
      rows = []; return r;
    },
    stop() { kid.kill(); },
  };
}

/** the processes worth watching: the app's (WebView: hosts the GPU thread), Chrome's browser and GPU processes, every renderer */
function processes() {
  const out = sh('ps -A -o PID,NAME');
  const list = [];
  for (const l of out.split('\n')) {
    const m = l.trim().match(/^(\d+)\s+(\S+)$/); if (!m) continue;
    const [pid, name] = [+m[1], m[2]];
    if (name === PKG) list.push({ pid, role: 'app', name });
    else if (name === 'com.android.chrome') list.push({ pid, role: 'browser', name });
    else if (name === 'com.android.chrome:privileged_process0') list.push({ pid, role: 'gpu', name });
    else if (/^com\.android\.(chrome|webview):sandboxed_process/.test(name)) list.push({ pid, role: 'renderer', name, engine: name.includes('webview') ? 'webview' : 'chrome' });
  }
  return list;
}
const CLK = 100;   // USER_HZ
/** CPU jiffies (user + system) per pid */
function jiffies(pids) {
  const out = sh(pids.map((p) => `cat /proc/${p}/stat 2>/dev/null`).join('; '));
  const r = {};
  for (const l of out.split('\n')) { const m = l.match(/^(\d+) \(.*\) \S+ (.*)$/); if (!m) continue; const f = m[2].split(' '); r[+m[1]] = +f[10] + +f[11]; }
  return r;
}
/** TOTAL PSS and the graphics share (dumpsys meminfo's App Summary), MB */
function meminfo(pid) {
  const out = sh(`dumpsys meminfo ${pid}`);
  const n = (re) => { const m = out.match(re); return m ? +(+m[1] / 1024).toFixed(1) : null; };
  return { pssMB: n(/TOTAL PSS:\s+(\d+)/) ?? n(/TOTAL\s+(\d+)/), graphicsMB: n(/Graphics:\s+(\d+)/), glMB: n(/GL mtrack\s+(\d+)/), javaHeapMB: n(/Java Heap:\s+(\d+)/), nativeHeapMB: n(/Native Heap:\s+(\d+)/) };
}
const temps = () => { const t = thermal(); return { gpuC: +t['gpuss-0'] / 1000, cpuC: +t['cpu-1-0'] / 1000, batteryC: +t.battery / 1000, thermal: t.Thermal, gpuMHz: +t.gpufreq / 1e6 }; };

async function coolDown(label) {
  const t0 = Date.now();
  let t = temps();
  while (t.gpuC > startC && Date.now() - t0 < 6 * 60000) {
    console.log(`${label}: GPU ${t.gpuC} °C > ${startC}: cooling…`);
    await sleep(30000); t = temps();
  }
  return { ...t, waited: Math.round((Date.now() - t0) / 1000) };
}

// ------------------------------------------------------------------ the two engines
const opened = new Set();   // our own Chrome tabs (closed at the end)
const json = async (path) => (await fetch(DT + path)).json();

async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const page = new Page(ws);
  // (the connection goes when anything restarts the adb server: every pending call fails then, at once)
  ws.addEventListener('close', () => { page.closed = true; for (const { rej } of page.pending.values()) rej(new Error('DevTools connection closed')); page.pending.clear(); });
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  page.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled') page.log?.(m.params.type, m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    else if (m.method === 'Runtime.exceptionThrown') page.log?.('exception', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });
  page.targetId = target.id;
  return page;
}

/**
 * Our two port rules, kept: another adb client on this Mac (a Unity build, another session) may restart
 * the adb server, which drops every forward and reverse; they are put back within a second or two.
 */
let forwardTo = null;
function forward(socket) { forwardTo = socket; adb(['forward', `tcp:${DTP}`, socket]); }
function keepRules() {
  if (!adb(['reverse', '--list'], { quiet: true }).includes(`tcp:${PORT}`)) adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`], { quiet: true });
  if (forwardTo && !adb(['forward', '--list'], { quiet: true }).includes(`tcp:${DTP} ${forwardTo}`)) adb(['forward', `tcp:${DTP}`, forwardTo], { quiet: true });
}
const keeper = setInterval(keepRules, 1500);

/** back to the same page after the connection went (the page itself kept running) */
async function reconnect(targetId) {
  keepRules();
  for (let i = 0; i < 40; i++) {
    try { const t = (await json('/json')).find((p) => p.id === targetId); if (t) return await connect(t); } catch { /* */ }
    await sleep(500); keepRules();
  }
  throw new Error('the page is gone');
}

async function bringUp(engine) {
  adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);   // (again each run: another adb client may have restarted the server)
  if (engine === 'webview') {
    adb(['shell', 'am', 'force-stop', PKG]);   // (ours: every run starts with a fresh app process)
    await sleep(1000);
    adb(['shell', 'am', 'start', '-n', ACTIVITY]);
    let pid = '';
    for (let i = 0; i < 80 && !pid; i++) { await sleep(250); pid = sh(`pidof ${PKG}`).trim(); }
    if (!pid) throw new Error('the perf app did not start');
    for (let i = 0; i < 80; i++) { if (sh('cat /proc/net/unix').includes(`webview_devtools_remote_${pid}`)) break; await sleep(250); }
    forward(`localabstract:webview_devtools_remote_${pid}`);
    for (let i = 0; i < 80; i++) {
      try { const t = (await json('/json')).find((p) => p.type === 'page'); if (t) return { page: await connect(t), version: await json('/json/version'), appPid: +pid }; } catch { /* */ }
      await sleep(250);
    }
    throw new Error('no WebView page');
  }
  forward('localabstract:chrome_devtools_remote');
  let t = (await json('/json')).find((p) => p.type === 'page' && p.url.startsWith(BASE));
  if (!t) {
    adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', BASE + 'manifest.webmanifest', 'com.android.chrome']);
    for (let i = 0; i < 80 && !t; i++) { await sleep(250); t = (await json('/json')).find((p) => p.type === 'page' && p.url.startsWith(BASE)); }
    if (!t) throw new Error('no Chrome tab');
    opened.add(t.id);
  } else {
    if (!opened.size) opened.add(t.id);   // (left over from an interrupted run of ours: localhost:5253 is our port)
    adb(['shell', 'am', 'start', '-n', 'com.android.chrome/com.google.android.apps.chrome.Main']);
    await sleep(1500);
  }
  await fetch(`${DT}/json/activate/${t.id}`);
  return { page: await connect(t), version: await json('/json/version') };
}

/** a GC trace from the browser target (all processes; the page's own main thread is found by its marks) */
async function startTrace() {
  const v = await json('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const page = new Page(ws), events = [];
  let done;
  const complete = new Promise((r) => { done = r; });
  page.on((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); else if (m.method === 'Tracing.tracingComplete') done(); });
  try {
    await page.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { recordMode: 'recordContinuously', includedCategories: ['disabled-by-default-v8.gc', 'blink.user_timing', '__metadata'], excludedCategories: ['*'] } });
  } catch (e) { ws.close(); return { error: String(e.message ?? e), stop: async () => null }; }
  return {
    async stop() {
      await page.send('Tracing.end');
      await Promise.race([complete, sleep(60000)]);
      ws.close();
      return events;
    },
  };
}

/** GC pauses on the page's main thread per recording window (marks bench:start / bench:end, in order) */
function gcPauses(events) {
  if (!events?.length) return null;
  const marks = events.filter((e) => e.cat?.includes('blink.user_timing') && /^bench:(start|end)$/.test(e.name)).sort((a, b) => a.ts - b.ts);
  if (!marks.length) return { error: 'no marks in the trace' };
  const { pid, tid } = marks[0];
  const gcs = events.filter((e) => e.pid === pid && e.tid === tid && e.cat?.includes('v8.gc') && (e.ph === 'X' || e.ph === 'B' || e.ph === 'E')).sort((a, b) => a.ts - b.ts);
  // complete events, and B/E pairs, as intervals; nested ones merged into pauses
  const iv = [], open = [];
  for (const e of gcs) {
    if (e.ph === 'X') iv.push([e.ts, e.ts + (e.dur ?? 0), e.name]);
    else if (e.ph === 'B') open.push(e);
    else { const b = open.pop(); if (b) iv.push([b.ts, e.ts, b.name]); }
  }
  iv.sort((a, b) => a[0] - b[0]);
  const pauses = [];
  for (const [s, e, n] of iv) { const p = pauses[pauses.length - 1]; if (p && s <= p.e + 300) { p.e = Math.max(p.e, e); } else pauses.push({ s, e, n }); }   // (steps under 0.3 ms apart: one pause)
  const names = {};
  for (const [s, e, n] of iv) names[n] = (names[n] ?? 0) + 1;
  const windows = [];
  for (let i = 0; i < marks.length; i++) if (marks[i].name === 'bench:start') { const end = marks.slice(i + 1).find((m) => m.name === 'bench:end'); if (end) windows.push([marks[i].ts, end.ts]); }
  return {
    pid, tid,
    windows: windows.map(([a, b]) => {
      const ps = pauses.filter((p) => p.s >= a && p.s < b).map((p) => (p.e - p.s) / 1000);
      const kind = (n) => iv.filter(([s, , m]) => m === n && s >= a && s < b).length;
      return { secs: +((b - a) / 1e6).toFixed(1), scavenges: kind('V8.GC_SCAVENGER'), markCompacts: kind('V8.GC_MARK_COMPACTOR'), incrementalSteps: kind('V8.GC_MC_INCREMENTAL'), count: ps.length, totalMs: +ps.reduce((s, x) => s + x, 0).toFixed(1), maxMs: ps.length ? +Math.max(...ps).toFixed(2) : 0, over4ms: ps.filter((x) => x > 4).length, over8ms: ps.filter((x) => x > 8).length };
    }),
    eventNames: names,
  };
}

// the page side added to INSTRUMENT: marks for the trace, the render scale, visibility, every program's sources
const EXTRA = `(() => {
  const B = window.__bench;
  const reset = B.reset;
  B.reset = () => { performance.mark('bench:start'); B.scales = []; B.hidden = 0; reset(); };
  B.scales = []; B.hidden = 0;
  setInterval(() => { if (B.rec && window.quality) B.scales.push(window.quality.renderScale); }, 250);
  document.addEventListener('visibilitychange', () => { if (document.hidden) B.hidden++; });
  // the sources of every program linked in the game's context (the shader-compile test)
  const src = new WeakMap(), att = new WeakMap();
  B.programs = []; B.linkMs = 0;
  const P = WebGL2RenderingContext.prototype;
  const ss = P.shaderSource, as = P.attachShader, lp = P.linkProgram, gp = P.getProgramParameter;
  P.shaderSource = function (s, t) { src.set(s, t); return ss.call(this, s, t); };
  P.attachShader = function (p, s) { (att.get(p) ?? att.set(p, []).get(p)).push(s); return as.call(this, p, s); };
  P.linkProgram = function (p) { if (this === B.gl) { const sh = att.get(p) ?? []; const v = sh.find((s) => this.getShaderParameter(s, this.SHADER_TYPE) === this.VERTEX_SHADER), f = sh.find((s) => this.getShaderParameter(s, this.SHADER_TYPE) === this.FRAGMENT_SHADER); if (v && f) B.programs.push([src.get(v), src.get(f), performance.now()]); } return lp.call(this, p); };
  P.getProgramParameter = function (p, n) { const t = performance.now(); try { return gp.call(this, p, n); } finally { if (this === B.gl && n === this.LINK_STATUS) B.linkMs += performance.now() - t; } };
})();`;

/** compile and link every program the game linked, again, in a fresh context: made unique (a uniform of its own) so no cache can serve it */
const shaderTest = (ev) => ev(async () => {
  const progs = window.__bench.programs.filter(([v, f]) => v && f);
  const tag = Math.random().toString(36).slice(2, 8);
  const unique = (src, k, kind) => {
    const name = `u_bench_${tag}_${k}`, i = src.indexOf('void main'), j = src.lastIndexOf('}');
    if (i < 0 || j < i) return src;
    return src.slice(0, i) + `uniform float ${name};\n` + src.slice(i, j) + (kind === 'v' ? `gl_Position.x += ${name};` : `if (${name} > 1.0) discard;`) + '\n' + src.slice(j);
  };
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const gl = c.getContext('webgl2');
  const build = (v, f) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, v], [gl.FRAGMENT_SHADER, f]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); gl.attachShader(p, sh); } gl.linkProgram(p); return p; };
  // one by one, waiting for each (as a game that compiles on first use)
  let t0 = performance.now(), worst = 0, failed = 0;
  const each = [];
  progs.forEach(([v, f], k) => { const t = performance.now(); const p = build(unique(v, k, 'v'), unique(f, k, 'f')); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) failed++; const d = performance.now() - t; each.push(d); worst = Math.max(worst, d); });
  const serialMs = performance.now() - t0;
  // the same sources again (a cache may serve them now)
  t0 = performance.now();
  progs.forEach(([v, f], k) => { const p = build(unique(v, k, 'v'), unique(f, k, 'f')); gl.getProgramParameter(p, gl.LINK_STATUS); });
  const againMs = performance.now() - t0;
  // the game's own sources, as they are (what a persistent shader cache, the engine's or the driver's, has seen at load)
  t0 = performance.now();
  progs.forEach(([v, f]) => { const p = build(v, f); gl.getProgramParameter(p, gl.LINK_STATUS); });
  const originalMs = performance.now() - t0;
  // all at once, polled (KHR_parallel_shader_compile, as three.js's compileAsync), with new names
  const par = gl.getExtension('KHR_parallel_shader_compile');
  let parallelMs = null;
  if (par) {
    const tag2 = tag + 'p';
    t0 = performance.now();
    const ps = progs.map(([v, f], k) => build(unique(v, k, 'v').replaceAll(tag, tag2), unique(f, k, 'f').replaceAll(tag, tag2)));
    while (!ps.every((p) => gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR))) await new Promise((r) => setTimeout(r, 2));
    parallelMs = performance.now() - t0;
  }
  each.sort((a, b) => a - b);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const r = (x) => (x == null ? null : +x.toFixed(1));
  return { programs: progs.length, failed, serialMs: r(serialMs), medianMs: r(each[each.length >> 1]), p95Ms: r(each[Math.floor(each.length * 0.95)]), worstMs: r(worst), againMs: r(againMs), originalMs: r(originalMs), parallelMs: r(parallelMs), parallelExt: !!par,
    sourceKB: Math.round(progs.reduce((s, [v, f]) => s + v.length + f.length, 0) / 1024), atLoad: { programs: progs.filter((p) => p[2] < (window.__moebiusBootedAt ?? Infinity)).length, linkStatusWaitMs: r(window.__bench.linkMs) } };
});

/** what each engine offers the game (WebGL 2 limits and extensions, a few web platform features) */
const features = (ev) => ev(() => {
  const gl = window.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info');
  const P = (n) => gl.getParameter(gl[n]);
  return {
    ua: navigator.userAgent, renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, version: gl.getParameter(gl.VERSION), glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    view: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio, canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    extensions: gl.getSupportedExtensions().sort(),
    limits: Object.fromEntries(['MAX_TEXTURE_SIZE', 'MAX_RENDERBUFFER_SIZE', 'MAX_SAMPLES', 'MAX_DRAW_BUFFERS', 'MAX_COLOR_ATTACHMENTS', 'MAX_VERTEX_UNIFORM_VECTORS', 'MAX_FRAGMENT_UNIFORM_VECTORS', 'MAX_UNIFORM_BLOCK_SIZE', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'MAX_3D_TEXTURE_SIZE', 'MAX_ARRAY_TEXTURE_LAYERS'].map((n) => [n, P(n)])),
    contextAttributes: gl.getContextAttributes(),
    web: {
      webgpu: !!navigator.gpu, offscreenCanvas: typeof OffscreenCanvas !== 'undefined', offscreenWebgl2: (() => { try { return !!new OffscreenCanvas(1, 1).getContext('webgl2'); } catch { return false; } })(),
      gamepads: !!navigator.getGamepads, wakeLock: 'wakeLock' in navigator, fullscreen: !!document.documentElement.requestFullscreen, performanceMemory: !!performance.memory,
      measureUserAgentSpecificMemory: !!performance.measureUserAgentSpecificMemory, scheduler: 'scheduler' in window, schedulerYield: !!window.scheduler?.yield, compressionStreams: 'DecompressionStream' in window,
      structuredClone: typeof structuredClone === 'function', arrayFindLast: !!Array.prototype.findLast, objectGroupBy: !!Object.groupBy, arrayToSorted: !!Array.prototype.toSorted, promiseWithResolvers: !!Promise.withResolvers,
      setUnion: !!Set.prototype.union, iteratorHelpers: typeof Iterator !== 'undefined' && !!Iterator.prototype?.map, cssHas: CSS.supports('selector(:has(a))'), cssContainer: CSS.supports('container-type: inline-size'),
      cssNesting: CSS.supports('selector(&)'), viewTransitions: !!document.startViewTransition, popover: 'popover' in HTMLElement.prototype, dialog: typeof HTMLDialogElement !== 'undefined',
      requestVideoFrameCallback: 'requestVideoFrameCallback' in HTMLVideoElement.prototype, sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined', crossOriginIsolated: !!window.crossOriginIsolated,
      audioWorklet: typeof AudioWorkletNode !== 'undefined', webAssemblySimd: (() => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch { return false; } })(),
      capacitor: !!window.Capacitor?.isNativePlatform?.(),
    },
  };
});

/** the share of 60 Hz refreshes missed: a 33 ms frame is one refresh shown twice */
export function missedShare(frames, period = 1000 / 60) {
  let shown = 0, missed = 0;
  for (const f of frames) { const k = Math.max(1, Math.round(f / period)); shown += k; missed += k - 1; }
  return shown ? +(missed / shown * 100).toFixed(2) : null;
}

async function run(engine, mode, round) {
  const label = `r${round} ${engine} ${mode}`;
  const cool = await coolDown(label);
  console.log(`${label}: start at GPU ${cool.gpuC} °C, CPU ${cool.cpuC} °C, battery ${cool.batteryC} °C, ${cool.thermal}`);
  let { page, version, appPid } = await bringUp(engine);
  const ev = (fn, arg) => page.eval(fn, arg);
  const errors = [], warnings = [];
  const logTo = (type, t) => { if (type === 'exception' || type === 'error') errors.push(t.slice(0, 200)); else if (type === 'warning') warnings.push(t.slice(0, 200)); };
  page.log = logTo;
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT + '\n' + EXTRA });
  await page.goto(BASE + 'bench-blank.html');
  await prepareStorage(ev, 'handheld');
  const tNav = Date.now();
  await page.goto(BASE + '?level=desert');
  await page.waitFor('!!(window.__moebiusBooted && window.renderFrame && window.player)', 300000, 250);
  const load = await ev(() => {
    const n = performance.getEntriesByType('navigation')[0], res = performance.getEntriesByType('resource');
    return { firstFrame: +((window.__moebiusBootedAt ?? NaN) / 1000).toFixed(2), responseEnd: +(n.responseEnd / 1000).toFixed(2), domContentLoaded: +(n.domContentLoadedEventEnd / 1000).toFixed(2),
      resources: res.length, transferMB: +(res.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0) / 1e6).toFixed(1), programsAtFirstFrame: window.__bench.programs.length };
  });
  load.wallToBooted = +((Date.now() - tNav) / 1000).toFixed(1);
  if (engine === 'chrome') await fullscreen(page).catch(() => 0);
  await sleep(5000);
  const dyn = mode === 'dynamic';
  if (dyn) await ev(() => { window.__dyn = window.preset().dynamic; return true; });
  const canvas = await conditions(ev, { hour: VP.hour, weather: VP.weather, scale: 0.75 });
  if (dyn) await ev(() => { window.preset().dynamic = window.__dyn; return true; });
  // the desert's intro page (a first visit: the bench's storage is fresh) holds the game "busy", and a busy
  // game doesn't adapt its resolution: closed, in both modes, as a player would
  await ev(() => { window.story?.closePage?.(); return true; });
  // the game's own frame readout on (top right), over the hidden HUD, so the run can be watched on the device
  await ev(() => {
    window.settings.set('showFps', true);
    const st = document.createElement('style'); st.textContent = '#fps { visibility: visible !important; }'; document.head.appendChild(st);
    return true;
  });
  const feat = await features(ev);
  // the page's renderer: the busiest of this engine's over two seconds; where it and the GPU's host may run
  let procs = processes(), last = jiffies(procs.map((p) => p.pid)), lastT = Date.now();
  await sleep(2000);
  const busy = jiffies(procs.map((p) => p.pid));
  const mine = procs.filter((p) => p.role === 'renderer' && p.engine === engine).sort((a, b) => (busy[b.pid] - last[b.pid]) - (busy[a.pid] - last[a.pid]))[0];
  const gpuHost = procs.find((p) => (engine === 'webview' ? p.role === 'app' : p.role === 'gpu'));
  const mainTid = mine ? +(sh(`grep -l CrRendererMain /proc/${mine.pid}/task/*/comm`).trim().split('/')[4]) || null : null;
  const placement = { mainTid };
  for (const [k, p] of [['renderer', mine], ['host', gpuHost]]) if (p) placement[k] = { pid: p.pid, name: p.name, cgroup: sh(`grep -E 'cpuset|cpu:' /proc/${p.pid}/cgroup`).trim().replace(/\s+/g, ' '), allowed: sh(`grep Cpus_allowed_list /proc/${p.pid}/status`).trim().split(/\s+/)[1] };
  last = busy; lastT = Date.now();
  const onEach = async () => {
    const pageSide = await ev(() => {
      performance.mark('bench:end');
      const B = window.__bench, m = performance.memory, s = B.scales.slice().sort((a, b) => a - b);
      return { hidden: B.hidden, visible: document.visibilityState, fpsText: document.getElementById('fps')?.textContent, busy: { page: !!window.story?.pageOpen, story: !!window.storyRt?.busy?.(), dialogue: !!window.dialogue?.open }, scale: window.quality.renderScale, scales: s.length ? { median: s[s.length >> 1], min: s[0], max: s[s.length - 1], end: window.quality.renderScale, n: s.length } : null,
        heapMB: m ? +(m.usedJSHeapSize / 1e6).toFixed(1) : null, heapTotalMB: m ? +(m.totalJSHeapSize / 1e6).toFixed(1) : null };
    });
    const g = gs.take(), th = temps();
    // CPU since the last reading (the view's warm-up and its recording), cores
    const now = jiffies(procs.map((p) => p.pid)), dt = (Date.now() - lastT) / 1000;
    const cpu = procs.map((p) => ({ ...p, cores: now[p.pid] != null && last[p.pid] != null ? +((now[p.pid] - last[p.pid]) / CLK / dt).toFixed(2) : null }));
    const renderer = cpu.filter((p) => p.role === 'renderer' && p.engine === engine).sort((a, b) => (b.cores ?? 0) - (a.cores ?? 0))[0];
    const host = cpu.find((p) => (engine === 'webview' ? p.role === 'app' : p.role === 'gpu'));
    const browser = engine === 'chrome' ? cpu.find((p) => p.role === 'browser') : null;
    const mem = { renderer: renderer ? meminfo(renderer.pid) : null, host: host ? meminfo(host.pid) : null };
    return { ...g, ...th, ...pageSide, proc: { renderer: renderer && { pid: renderer.pid, cores: renderer.cores }, host: host && { pid: host.pid, cores: host.cores, name: host.name }, browser: browser && { cores: browser.cores } }, mem };
  };
  // each view and path on its own, with its own GC trace; when the connection goes (an adb server
  // restart) or the page was sent to the background, that one again (three tries)
  const items = [...VP.views.map((v) => v.name), ...(opt.paths !== '0' ? VP.paths.map((p) => p.name) : [])].filter((n) => !only || only.includes(n));
  const views = [];
  let gs = null;
  for (const name of items) {
    let v = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let trace = null;
      try {
        if (page.closed) { page = await reconnect(page.targetId); page.log = logTo; if (!(await ev('!!window.__benchSet'))) throw new Error('the page was reloaded'); }
        trace = await startTrace();
        gs = gpuSampler(mine?.pid, mainTid);
        procs = processes(); last = jiffies(procs.map((p) => p.pid)); lastT = Date.now();
        const one = { ...VP, views: VP.views.filter((x) => x.name === name), paths: VP.paths.filter((x) => x.name === name) };
        [v] = await runAll(ev, one, { secs, warmup, tag: label, onEach });
        gs.stop();
        const gc = trace.error ? { error: trace.error } : gcPauses(await trace.stop());
        v.gc = gc?.windows?.[0] ?? (gc?.error ? { error: gc.error } : null);
        v.missedShare = missedShare(v.raw.frame); v.over20 = +(v.raw.frame.filter((x) => x > 20).length / v.raw.frame.length * 100).toFixed(2);
        v.interrupted = v.hidden > 0 || v.visible !== 'visible' || v.raw.frame.some((x) => x > 1000);
        v.attempt = attempt;
        if (!v.interrupted) break;
        console.error(`${label} ${name}: interrupted (sent to the background), again`);
        if (engine === 'chrome') { adb(['shell', 'am', 'start', '-n', 'com.android.chrome/com.google.android.apps.chrome.Main']); await sleep(1500); await fetch(`${DT}/json/activate/${page.targetId}`).catch(() => 0); }
        else adb(['shell', 'am', 'start', '-n', ACTIVITY]);
        await sleep(3000);
      } catch (err) {
        gs?.stop();
        console.error(`${label} ${name}: ${String(err.message ?? err).slice(0, 120)} (attempt ${attempt})`);
        if (/reloaded|gone/.test(String(err.message))) throw err;
        await sleep(3000);
      }
    }
    if (v) views.push(v);
  }
  // the tests after the views, each tried again on a new connection if the old one went
  const safe = async (f) => {
    for (let i = 0; ; i++) {
      try { if (page.closed) { page = await reconnect(page.targetId); page.log = logTo; } return await f(); }
      catch (e) { if (i >= 2 || !page.closed) return { error: String(e.message ?? e) }; await sleep(3000); }
    }
  };
  // (once per engine and round: it takes the best part of a minute on the WebView)
  const shaders = mode === modes[0] ? await safe(() => shaderTest(ev)) : null;
  // plain JS speed on the page's main thread (three.js math and short-lived objects, as a frame makes), best of 5 × 300 ms
  const js = await safe(() => ev(() => {
    const { THREE } = window, a = new THREE.Matrix4(), b = new THREE.Matrix4().makeRotationY(0.3), v = new THREE.Vector3();
    let best = 0, sink = 0;
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now(); let n = 0;
      while (performance.now() - t0 < 300) { for (let i = 0; i < 1000; i++) { a.multiply(b); v.set(i, 1, 2).applyMatrix4(a); const o = { x: v.x, y: [v.y, v.z] }; sink += o.y[1]; } n++; }
      best = Math.max(best, n / 300);
    }
    return { kIterPerMs: +best.toFixed(2), sink: Number.isFinite(sink) };
  }));
  const gpuEst = await safe(() => gpuEstimate(ev));
  const end = temps();
  // nothing of ours left running between runs: the tab on an empty page, the perf app stopped
  if (engine === 'chrome') await page.goto(BASE + 'bench-blank.html').catch(() => 0);
  page.close();
  if (engine === 'webview') adb(['shell', 'am', 'force-stop', PKG]);
  const result = { engine, mode, round, placement, js, browser: version.Browser, package: version['Android-Package'], v8: version['V8-Version'], features: feat, canvas, load, shaders, gpuEstimate: gpuEst,
    start: cool, end, errors: errors.slice(0, 10), warnings: [...new Set(warnings)].slice(0, 10), time: new Date().toISOString(), appPid, views };
  writeFileSync(`${RAW}/r${round}-${engine}-${mode}.json`, JSON.stringify(result) + '\n');
  console.log(`${label}: first frame ${load.firstFrame} s; shaders ${shaders?.programs} programs ${shaders?.serialMs} ms serial, ${shaders?.parallelMs} ms parallel; ${views.filter((v) => v.interrupted).length} interrupted; end GPU ${end.gpuC} °C`);
  return result;
}

// ------------------------------------------------------------------ the rounds, alternating
/** after a failed run: the perf app stopped, our tab on an empty page */
async function idle() {
  adb(['shell', 'am', 'force-stop', PKG]);
  try {
    forward('localabstract:chrome_devtools_remote');
    for (const id of opened) { const t = (await json('/json')).find((p) => p.id === id); if (t && !t.url.endsWith('bench-blank.html')) { const pg = await connect(t); await pg.goto(BASE + 'bench-blank.html'); pg.close(); } }
  } catch { /* */ }
}
const refresh = sh('dumpsys SurfaceFlinger | grep -m1 refresh-rate').trim();
console.log(`device ${sh('getprop ro.product.model').trim()}, ${refresh}; raw results in ${RAW}`);
adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
let failed = 0;
try {
  for (let r = 1; r <= rounds; r++) {
    const order = [];
    for (const m of modes) { const e = r % 2 ? engines : engines.slice().reverse(); for (const x of e) order.push([x, m]); }
    for (const [e, m] of order) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { await run(e, m, r); break; }
        catch (err) { console.error(`r${r} ${e} ${m} failed (attempt ${attempt}): ${err.stack ?? err}`); if (attempt === 3) failed++; await idle(); }
      }
    }
  }
} finally {
  // ours only: the perf app stopped, our Chrome tab closed, our port rules removed
  clearInterval(keeper);
  adb(['shell', 'am', 'force-stop', PKG]);
  try { forward('localabstract:chrome_devtools_remote'); for (const id of opened) await fetch(`${DT}/json/close/${id}`); } catch { /* */ }
  adb(['forward', '--remove', `tcp:${DTP}`]);
  adb(['reverse', '--remove', `tcp:${PORT}`]);
  console.log(`done (${failed} failed runs); node scripts/bench/android-engines-summary.mjs ${RAW}`);
}
process.exit(0);
