// The painted relief's review (issue #696, src/relief.js): for each fixed view of tools/relief-review/views.json, the same
// pinned frame with the relief off and on (the shared uRelief switched in the page: one build, one load, nothing else
// differs) and what it costs a frame on High and on the Handheld preset, written to tools/relief-review/ (webp pictures
// and data.json) for tools/relief-review.html. A muted headless Chrome on the real GPU (ANGLE on Metal) and a Vite of its own.
//   node tools/relief-shots.mjs [--port 5453] [--cdp 9792] [--only name,name] [--perf 0] [--pairs 6] [--preset high] [--out dir] [--png 1]
// (--preset medium: the pictures at render scale 1, as the Unity port draws; High draws at 1.5 and scales down, issue #700;
// --png 1 keeps the lossless pictures beside the webp ones, for a before/after diff)
// Frame time: 24 renderFrame() closed by a readPixels, the median of five, off and on in turns (`pairs` times each), so a
// drift hits both alike; the machine's load is recorded with each (the numbers mean little over ~12).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { loadavg } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, ownProcess, viteCacheDir } from '../scripts/temp-dirs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1']] : a), []));
const PORT = +(A.port ?? 5453), CDP = +(A.cdp ?? 9792), W = 1280, H = 720;
if (PORT === 5173) throw new Error('5173 is the author’s own dev server');
const OUT = resolve(ROOT, A.out ?? 'tools/relief-review');
const views = JSON.parse(readFileSync(existsSync(join(OUT, 'views.json')) ? join(OUT, 'views.json') : join(ROOT, 'tools/relief-review/views.json'), 'utf8'));
const only = A.only ? new Set(A.only.split(',')) : null;
const perf = A.perf !== '0', pairs = +(A.pairs ?? 6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false, cacheDir: viteCacheDir('relief-shots-' + PORT),
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}/`;
const profile = tempDir('relief-shots-chrome-');
const proc = ownProcess(spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
  '--no-first-run', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' }));
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description?.slice(0, 400)); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

// a world booted muted (no music, effects or voices in its settings before the audio is made; Chrome muted too), the HUD hidden
async function boot(v, preset) {
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted','1');
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${preset}', music: 0, effects: 0, voices: 0, soundV: 1, enemies: 'off' }));
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
  await send('Page.navigate', { url: `${BASE}?level=${v.world}${v.extra ?? ''}` });
  let up = false; for (let i = 0; i < 1800 && !up; i++) { up = (await ev('!!window.__hiraethBooted && !!window.player').catch(() => false)) === true; if (!up) await sleep(100); }
  if (!up) throw new Error(`${v.world} never booted`);
  await sleep(2500);
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
    const p = window.preset?.(); if (p) p.dynamic = null;
    const s = document.createElement('style'); s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(s);
    if (window.sky) { window.sky.hour = ${v.hour ?? 12}; window.sky.speed = 0; window.updateSky?.(); }
    const { THREE, camera } = window, up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
    const e = new THREE.Vector3(...${JSON.stringify(v.eye)}), t = new THREE.Vector3(...${JSON.stringify(v.target)}), q = new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov = ${v.fov ?? 55};
    const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
    camera.updateMatrixWorld = function (f) { this.position.copy(e); this.quaternion.copy(q); if (this.fov !== fov) { this.fov = fov; this.updateProjectionMatrix(); } return base.call(this, f); };
    ${v.setup ?? ''}
    return true; })()`);
  await sleep(v.settle ?? 4000);
}
const relief = (on) => ev(`window.sharedUniforms.uRelief.value = ${on ? 1 : 0}; true`);
const shot = async (file) => { const png = Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'); writeFileSync(file, png); };
const timeIt = () => ev(`(() => { const gl = window.renderer.getContext(), px = new Uint8Array(4);
  const run = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) window.renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / n; };
  run(24); const a = [run(24), run(24), run(24), run(24), run(24)].sort((x, y) => x - y); return +a[2].toFixed(3); })()`);
const med = (xs) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
async function measure() {
  const off = [], on = [], load = [];
  for (let i = 0; i < pairs; i++) {
    load.push(+loadavg()[0].toFixed(1));
    await relief(false); off.push(await timeIt());
    await relief(true); on.push(await timeIt());
  }
  await relief(false);
  const o = med(off), n = med(on);
  return { off: o, on: n, deltaMs: +(n - o).toFixed(3), deltaPct: +(100 * (n - o) / o).toFixed(1), load: med(load), maxLoad: Math.max(...load), all: { off, on } };
}

const dataFile = join(OUT, 'data.json');
const data = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : { views: {} };
data.commit = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD']).toString().trim();
data.res = `${W}x${H}`;
const tmp = tempDir('relief-shots-png-');
for (const v of views) {
  if (only && !only.has(v.name)) continue;
  const row = (data.views[v.name] ??= {});
  console.log('view', v.name);
  await boot(v, A.preset ?? 'high');
  if (!data.gpu) data.gpu = await ev(`(() => { const gl = window.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; })()`);
  for (const on of [false, true]) {
    await relief(on); await sleep(1200);
    const png = join(tmp, `${v.name}-${on ? 'on' : 'off'}.png`);
    await shot(png);
    execFileSync('cwebp', ['-quiet', '-q', '82', png, '-o', join(OUT, `${v.name}-${on ? 'on' : 'off'}.webp`)]);
    if (A.png === '1') writeFileSync(join(OUT, `${v.name}-${on ? 'on' : 'off'}.png`), readFileSync(png));
  }
  await relief(false);
  row.shot = { date: new Date().toISOString(), load: +loadavg()[0].toFixed(1) };
  if (perf) {
    row.high = await measure(); console.log('  high', JSON.stringify({ ...row.high, all: undefined }));
    await boot(v, 'handheld');
    row.handheld = await measure(); console.log('  handheld', JSON.stringify({ ...row.handheld, all: undefined }));
  }
  writeFileSync(dataFile, JSON.stringify(data, null, 1));
}
writeFileSync(dataFile, JSON.stringify(data, null, 1));
ws.close(); proc.kill('SIGTERM'); await server.close();
rmSync(tmp, { recursive: true, force: true });
await sleep(500);
rmSync(profile, { recursive: true, force: true });
console.log('written', dataFile);
process.exit(0);
