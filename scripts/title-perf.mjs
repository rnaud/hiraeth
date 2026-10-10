// How fast the title screen answers (docs/systems/ui.md, "The title screen", Boot): serves the built game (dist/,
// `npx vite build` first; DIST=… another build, an older commit's, to compare) from its own small server, never
// the author's dev server, opens the title in a fresh headless muted Chrome on the GPU at 1280 × 720 for each run
// (Chrome's GPU process keeps compiled programs between pages: a second load in the same one is a warm start),
// presses ↓ every 700 ms from the moment the page starts (more than src/title.js TITLE_QUIET, so the world builds
// between presses), and reports, from navigation, over the first 20 s:
//   shown      the name and the menu painted (window.title.timing.shown)
//   tti        time to interactive: the menu shown, and no main-thread task after it over 100 ms (a press answered
//              within 100 ms from then on, RAIL's response budget): the end of the last such task
//   longest    the longest main-thread task (ms), and where it went (long animation frames' scripts)
//   inputMax   the slowest of the ↓ presses, from Chrome sending it to the page handling it (ms)
//   world      the world faded in behind the menu
//
//   node scripts/title-perf.mjs [--shot A4] [--presets high,handheld] [--runs 3] [--cpu 4] [--frames 3] [--json out.json]
// --cpu N slows Chrome's CPU N times (a handheld's, roughly). PORT (default 5361) is the server's, CDP its + 1.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(process.env.DIST ?? join(ROOT, 'dist'));   // (DIST: another build, e.g. an older commit's, to compare)
process.env.PORT ??= '5361';
process.env.CDP ??= String(Number(process.env.PORT) + 1);
const PORT = Number(process.env.PORT);
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SHOT = arg('shot', 'A4');
const PRESETS = arg('presets', 'high,handheld').split(',');
const RUNS = Number(arg('runs', 3));
const CPU = Number(arg('cpu', 1));
const OUT = arg('json');
const EVERY = Number(arg('every', 700));   // ms between presses
const WINDOW = 20000, RESPONSE = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.woff2': 'font/woff2' };
function serveDist() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('no dist/: run npx vite build first');
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(DIST, p);
    if (!f.startsWith(DIST) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(PORT, '127.0.0.1', () => r(server)));
}

// what the page records from its first line: long tasks, long animation frames (with their scripts), slow events
const PROBE = `(() => {
  const P = window.__titlePerf = { long: [], loaf: [], events: [] };
  const watch = (type, f) => { try { new PerformanceObserver((l) => { for (const e of l.getEntries()) f(e); }).observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 16 } : {}) }); } catch {} };
  watch('longtask', (e) => P.long.push([Math.round(e.startTime), Math.round(e.duration)]));
  watch('long-animation-frame', (e) => P.loaf.push({ at: Math.round(e.startTime), ms: Math.round(e.duration), block: Math.round(e.blockingDuration),
    scripts: e.scripts.map((s) => ({ ms: Math.round(s.duration), fn: s.sourceFunctionName, src: (s.sourceURL || '').split('/').pop(), char: s.sourceCharPosition, kind: s.invokerType, inv: s.invoker })).sort((a, b) => b.ms - a.ms).slice(0, 4) }));
  watch('event', (e) => { if (e.name === 'keydown') P.events.push([Math.round(e.startTime), Math.round(e.processingStart - e.startTime), Math.round(e.duration)]); });
})();`;

async function measure(c, preset) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await c.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/manifest.webmanifest` }); await sleep(300);
  await c.ev(`localStorage.clear(); localStorage.setItem('moebius.muted', '1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${preset}', showFps: false, music: 0, effects: 0, voices: 0 })); true`);
  const probe = await c.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  const t0 = Date.now();
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?shot=${SHOT}` });
  // ↓ every EVERY ms: how long Chrome waits for the page to take each one (a busy main thread holds it)
  const presses = [];
  let pressing = true;
  (async () => {
    while (pressing) {
      const s = Date.now();
      try {
        await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
        await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
      } catch { /* navigating */ }
      presses.push([s - t0, Date.now() - s]);
      await sleep(EVERY);
    }
  })();
  await sleep(WINDOW);
  pressing = false;
  await sleep(300);
  await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: probe.identifier });
  const r = JSON.parse(await c.ev(`JSON.stringify({ timing: window.title?.timing ?? null, perf: window.__titlePerf ?? null, nav: performance.timeOrigin, vista: document.querySelector('#title')?.className ?? null })`));
  const long = (r.perf?.long ?? []).filter(([at]) => at < WINDOW);
  const shown = r.timing?.shown ?? null;
  // tti: the menu shown, and the end of the last task over RESPONSE ms
  const tti = Math.max(shown ?? 0, ...long.filter(([, d]) => d > RESPONSE).map(([at, d]) => at + d));
  const longest = long.reduce((m, [, d]) => Math.max(m, d), 0);
  const worst = (r.perf?.loaf ?? []).sort((a, b) => b.ms - a.ms).slice(0, Number(arg('frames', 3)));
  const steady = presses.filter(([at]) => at > 1500);   // (the navigation itself is not the title's)
  return {
    preset, shown: shown && Math.round(shown), tti: Math.round(tti), longest, longTasks: long.length,
    inputMax: Math.max(0, ...steady.map(([, ms]) => ms)), inputOver100: steady.filter(([, ms]) => ms > 100).length,
    eventDelayMax: Math.max(0, ...(r.perf?.events ?? []).map(([, d]) => d)),
    world: r.timing?.world && Math.round(r.timing.world), stages: r.timing?.stages, state: r.vista, worst, long,
  };
}

const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const server = await serveDist();
const { chrome } = await import('./changelog-shots.mjs');
const results = [];
try {
  for (const preset of PRESETS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const c = await chrome();
      const m = await measure(c, preset).finally(() => c.close());
      runs.push(m);
      console.log(`${preset} #${i + 1}: shown ${m.shown} ms, tti ${m.tti} ms, longest task ${m.longest} ms (${m.longTasks} long), slowest press ${m.inputMax} ms (${m.inputOver100} over 100 ms), world ${m.world} ms`);
      for (const w of m.worst) console.log(`    frame ${w.ms} ms at ${w.at}: ${w.scripts.map((s) => `${s.ms} ms ${s.fn || s.kind}@${s.src}:${s.char}`).join(', ')}`);
    }
    const sum = { preset, cpu: CPU, shot: SHOT, runs: RUNS };
    for (const k of ['shown', 'tti', 'longest', 'inputMax', 'world']) sum[k] = median(runs.map((r) => r[k]));
    results.push({ ...sum, all: runs });
    console.log(`${preset} (median of ${RUNS}): shown ${sum.shown} ms, tti ${sum.tti} ms, longest ${sum.longest} ms, slowest press ${sum.inputMax} ms, world ${sum.world} ms`);
  }
} finally {
  server.close();
}
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
