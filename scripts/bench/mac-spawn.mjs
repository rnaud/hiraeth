// The Xbox's measurements repeated on the Mac (docs/systems/xbox.md, "Why 20 fps"): the production build (dist/,
// `npx vite build` first) served on its own port, a muted headless Chrome on the real GPU (ANGLE on Metal; SwiftShader
// refused), 1280 × 720 CSS pixels at a pixel ratio of 1.5 as the console's WebView2 (a 1920 × 1080 canvas), the desert's
// spawn at a preset with a fresh save, vsync on as on the TV (or --uncapped). Then, as on the console:
//   - the frame readout (fps, ms, the main thread's ms, draw calls) for 8 s;
//   - scripts/xbox-probes/cpubench.js and membench.js (the same JavaScript timed) and glcount.js (the WebGL calls per frame), gl-noop.js (renderFrame with and without its WebGL calls);
//   - --trace out.json: 5 s of Chromium trace, analysed as scripts/xbox-trace.mjs analyze does;
//   - --profile out.cpuprofile: 5 s of V8's sampling profiler, summarised as scripts/xbox-trace.mjs summarize.
//
//   node scripts/bench/mac-spawn.mjs [--preset xbox] [--trace f] [--profile f] [--uncapped] [--slow 4]
//   --slow n: the CPU slowed n times (Emulation.setCPUThrottlingRate), a weaker machine's main thread
// PORT (default 5494; Chrome's is PORT + 1). Never 5173 (the author's dev server).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, summarizeProfile, CATEGORIES } from '../xbox-trace.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PRESET = arg('preset', 'xbox'), TRACE = arg('trace'), PROFILE = arg('profile'), SLOW = +arg('slow', 1), UNCAPPED = args.includes('--uncapped');
const PORT = Number(process.env.PORT ?? 5494), CDP = PORT + 1;
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
if (!existsSync(join(ROOT, 'dist/index.html'))) throw new Error('no dist/: run `npx vite build` first');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { preview } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await preview({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', preview: { port: PORT, strictPort: true, host: '127.0.0.1' } });
const BASE = `http://127.0.0.1:${PORT}/`;
const profileDir = mkdtempSync(join(tmpdir(), 'mac-spawn-chrome-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profileDir}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist',
  ...(UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--no-first-run', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
const version = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();

async function socket(url) {
  const ws = new WebSocket(url);
  let id = 0; const wait = new Map(), on = [];
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else on.forEach((f) => f(d)); });
  await new Promise((r) => ws.addEventListener('open', r));
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, on: (f) => on.push(f), close: () => ws.close() };
}
const pg = await socket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
const ev = async (e) => { const d = await pg.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return d.result?.exceptionDetails ? { error: d.result.exceptionDetails.exception?.description } : d.result?.result?.value; };
await pg.send('Page.enable'); await pg.send('Runtime.enable'); await pg.send('Emulation.setFocusEmulationEnabled', { enabled: true });
await pg.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });

await pg.send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0, showFps: true }));
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
const t0 = Date.now();
await pg.send('Page.navigate', { url: `${BASE}?level=desert&fps=1` });
for (let i = 0; i < 1800; i++) { if (await ev('!!window.__moebiusBooted && !!window.player && !!window.renderer')) break; await sleep(100); }
const out = { preset: PRESET, slow: SLOW, uncapped: UNCAPPED, load_ms: Date.now() - t0, chrome: version.Browser };
out.gpu = await ev(`(() => { const g = window.renderer.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(x.UNMASKED_RENDERER_WEBGL); })()`);
if (/swiftshader|software|llvmpipe/i.test(out.gpu ?? '')) throw new Error(`software rendering (${out.gpu})`);
// (the console's view: the traveller at the spawn, the game's camera behind him; the sky as there)
await ev(`(() => { window.story?.closePage?.(); return true; })()`);
if (SLOW > 1) await pg.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
await sleep(12000);
out.state = await ev(`({ p: player.pos.toArray().map((x) => +x.toFixed(2)), cam: camera.position.toArray().map((x) => +x.toFixed(2)), scale: quality.renderScale, key: preset().key, canvas: [renderer.domElement.width, renderer.domElement.height], npcs: npcs.length, foes: foes.list.length })`);
const readouts = [];
for (let i = 0; i < 8; i++) { await sleep(1000); readouts.push(await ev(`document.getElementById('fps')?.textContent`)); }
const num = (re) => readouts.map((r) => +(re.exec(r ?? '')?.[1] ?? NaN)).filter(Number.isFinite).sort((a, b) => a - b);
const med = (a) => a[Math.floor(a.length / 2)];
out.readout = { fps: med(num(/ (\d+) fps/)), ms: med(num(/([\d.]+) ms \(/)), cpu_ms: med(num(/cpu ([\d.]+)/)), calls: med(num(/(\d+) calls/)), last: readouts.at(-1) };
console.log(`${PRESET}${SLOW > 1 ? ` ×${SLOW} slower CPU` : ''}: ${out.readout.last}`);
if (SLOW === 1) {
  out.cpubench = await ev(readFileSync(join(ROOT, 'scripts/xbox-probes/cpubench.js'), 'utf8'));
  console.log('cpubench', JSON.stringify(out.cpubench));
  out.membench = await ev(readFileSync(join(ROOT, 'scripts/xbox-probes/membench.js'), 'utf8'));
  console.log('membench', JSON.stringify(out.membench));
}
out.glcount = await ev(readFileSync(join(ROOT, 'scripts/xbox-probes/glcount.js'), 'utf8'));
console.log('glcount', JSON.stringify({ ...out.glcount, top: out.glcount?.top?.slice(0, 8) }));
out.glnoop = await ev(readFileSync(join(ROOT, 'scripts/xbox-probes/gl-noop.js'), 'utf8'));
console.log('gl-noop', JSON.stringify(out.glnoop));
if (PROFILE) {
  await pg.send('Profiler.enable'); await pg.send('Profiler.setSamplingInterval', { interval: 250 });
  const f0 = await ev('renderer.info.render.frame');
  await pg.send('Profiler.start'); await sleep(5000);
  const { result } = await pg.send('Profiler.stop');
  const f1 = await ev('renderer.info.render.frame');
  writeFileSync(PROFILE, JSON.stringify(result.profile));
  summarizeProfile(result.profile, f1 - f0, null);
}
if (TRACE) {
  const br = await socket(version.webSocketDebuggerUrl);
  const events = []; let done; const fin = new Promise((r) => { done = r; });
  br.on((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') done(); });
  await br.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { recordMode: 'recordContinuously', includedCategories: CATEGORIES } });
  await sleep(5000);
  await br.send('Tracing.end'); await fin;
  writeFileSync(TRACE, JSON.stringify({ traceEvents: events, meta: { mac: true, preset: PRESET } }));
  const r = analyze(TRACE, { print: false });
  out.trace = { frames: r.frames, fps: r.fps, frame_ms: r.frame_ms, threads: Object.fromEntries(Object.entries(r.threads).map(([k, t]) => [k, { busy_ms_per_frame: t.busy_ms_per_frame, busy_share: t.busy_share, kinds: t.kinds_ms_per_frame, top: t.top_self_ms_per_frame.slice(0, 5) }])) };
  console.log(JSON.stringify(out.trace, null, 1));
  br.close();
}
const file = arg('out'); if (file) writeFileSync(file, JSON.stringify(out, null, 2));
pg.close(); proc.kill('SIGTERM'); await sleep(800); rmSync(profileDir, { recursive: true, force: true });
await new Promise((r) => server.httpServer.close(r));
process.exit(0);
