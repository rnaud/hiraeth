// The load's smoke test (docs/systems/testing.md, docs/systems/performance.md "The loading pen"): a guard
// for the Steam Deck's "mixing the inks…" hang (53ac1e80: the GPU pacer waited its whole 250 ms on fences the
// driver never signalled, 741 times, minutes on one stage). The built game (dist/) is served and a few worlds
// are loaded in a headless, muted Chrome (SwiftShader: no GPU needed) under two broken drivers:
//
//   fences   WebGL2 fences never signal (getSyncParameter says UNSIGNALED, clientWaitSync times out)
//   noraf    requestAnimationFrame never fires (a window the compositor doesn't show)
//
// Each load must reach its first frame (the "load: total" line main.js logs at 'ready') within --limit
// seconds; with the fences broken the pacer must also have given up (its warning) having waited at most
// PACER_MOST ms in all, a check that doesn't depend on how fast SwiftShader compiles (most of a load's time
// here: the shaders). tests/load-awaits.test.js checks the load statically (every await is bounded).
//
//   node scripts/load-smoke.mjs [--build] [--port 6201] [--limit 120] [--worlds desert,garage,lantern] [--modes fences,noraf]
//   node scripts/load-smoke.mjs --runs desert:fences,garage:noraf      (world:mode pairs instead of every world × mode)
//   --verbose prints each load's stages
//
// --build runs `vite build` first (else dist/ must be there). Chrome: $CHROME, else the usual install
// paths; none found is a failure, never a silent pass. Exits 1 if a load fails or runs over.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(`--${k}`);
const PORT = Number(arg('port', 6201)), CDP = PORT + 1;
const LIMIT = Number(arg('limit', 120)) * 1000;
const WORLDS = arg('worlds', 'desert,garage,lantern').split(',').filter(Boolean);
const MODES = arg('modes', 'fences,noraf').split(',').filter(Boolean);
const RUNS = arg('runs', null)?.split(',').filter(Boolean).map((r) => r.split(':')) ?? WORLDS.flatMap((w) => MODES.map((m) => [w, m]));
/** The most the GPU pacer may wait in all once fences never signal (src/load-steps.js: 3 s budget, 3 full waits of 250 ms, and the wait under way). */
const PACER_MOST = 4000;
for (const [w, m] of RUNS) if (!w || !['fences', 'noraf'].includes(m)) { console.error(`load-smoke: bad run "${w}:${m}" (modes: fences, noraf)`); process.exit(1); }
const DIST = join(ROOT, 'dist');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The broken drivers, as scripts run in the page before its own. */
export const BREAKS = {
  // a driver whose fences never signal (the Steam Deck's ANGLE under gamescope, seemingly)
  fences: `(() => {
    for (const C of [globalThis.WebGL2RenderingContext].filter(Boolean)) {
      const get = C.prototype.getSyncParameter;
      C.prototype.getSyncParameter = function (sync, pname) { return pname === this.SYNC_STATUS ? this.UNSIGNALED : get.call(this, sync, pname); };
      C.prototype.clientWaitSync = function () { return this.TIMEOUT_EXPIRED; };
    }
    window.__smokeBreak = 'fences';
  })();`,
  // a window that runs no frame callbacks at all
  noraf: `(() => {
    let n = 0;
    window.requestAnimationFrame = () => ++n;
    window.cancelAnimationFrame = () => {};
    window.__smokeBreak = 'noraf';
  })();`,
};

// ------------------------------------------------------------------ Chrome
const CHROME = process.env.CHROME ?? ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
if (!CHROME || !existsSync(CHROME)) {
  console.error('load-smoke: no Chrome found (set $CHROME to a Chrome or Chromium binary). The smoke test cannot run, so it fails.');
  process.exit(1);
}

// ------------------------------------------------------------------ the built game, served
if (flag('build')) execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('load-smoke: dist/index.html is missing: run `npx vite build` first (or pass --build).');
  process.exit(1);
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(DIST, path));
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r, j) => { server.once('error', j); server.listen(PORT, '127.0.0.1', r); });
const BASE = `http://127.0.0.1:${PORT}/`;

const profile = mkdtempSync(join(tmpdir(), 'hiraeth-smoke-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--mute-audio', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--window-size=1280,720',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-gpu-shader-disk-cache', 'about:blank'], { stdio: 'ignore' });
let finished = false;
async function shutdown(code) {
  if (finished) return; finished = true;
  try { ws?.close(); } catch { /* gone */ }
  const gone = new Promise((r) => chrome.once('exit', r));
  chrome.kill('SIGTERM');
  await Promise.race([gone, sleep(5000)]);
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
  server.close();
  rmSync(profile, { recursive: true, force: true });
  process.exit(code);
}
process.on('SIGINT', () => shutdown(130));

let tabs;
for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
if (!tabs) { console.error(`load-smoke: Chrome (${CHROME}) did not start`); await shutdown(1); }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
let id = 0;
const waits = new Map(), listeners = new Set();
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
  if (d.method) for (const fn of listeners) fn(d);
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');

/** What the page holds before it loads: silent, the low preset, a save past the prologue. */
const STORAGE = `localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('moebius.muted', '1');
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'low', showFps: false, music: 0, effects: 0, voices: 0 }));
  true`;

/** One world under one broken driver: { ok, ms, lines }. */
async function load(world, mode) {
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` });
  await sleep(300);
  await send('Runtime.evaluate', { expression: STORAGE });
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', { source: BREAKS[mode] });
  const lines = [];
  let total = null, broke = false;
  const t0 = Date.now();
  const on = (d) => {
    if (d.method === 'Runtime.consoleAPICalled') {
      const text = d.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (/^load: |gpu pacer|still on/.test(text)) lines.push(text);
      const m = text.match(/^load: total (\d+) ms/);
      if (m) total = Number(m[1]);
    } else if (d.method === 'Runtime.exceptionThrown') {
      lines.push(`exception: ${d.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? d.params.exceptionDetails?.text}`);
    }
  };
  listeners.add(on);
  try {
    await send('Page.navigate', { url: `${BASE}?level=${world}` });
    while (total === null && Date.now() - t0 < LIMIT) await sleep(250);
    const check = await send('Runtime.evaluate', { expression: 'window.__smokeBreak ?? null', returnByValue: true }).catch(() => null);
    broke ||= check?.result?.value === mode;
  } finally {
    listeners.delete(on);
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
  // fences that never signal: the pacer gave up, and soon
  const pacer = lines.map((l) => l.match(/gpu pacer: .*\((\d+) ms waited\)/)).find(Boolean);
  const waited = pacer ? Number(pacer[1]) : null;
  const pacerOk = mode !== 'fences' || (waited !== null && waited <= PACER_MOST);
  return { ok: total !== null && broke && pacerOk, ms: Date.now() - t0, total, broke, waited, pacerOk, lines };
}

let failed = 0;
const rows = [];
try {
  for (const [world, mode] of RUNS) {
    const r = await load(world, mode);
    rows.push({ world, mode, ...r });
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${world.padEnd(10)} ${mode.padEnd(7)} ${r.total !== null ? `first frame in ${(r.ms / 1000).toFixed(1)} s (load: total ${r.total} ms)` : `no first frame in ${LIMIT / 1000} s`}${r.waited !== null ? ` · the pacer gave up after ${r.waited} ms of waiting` : ''}`);
    if (!r.broke) console.log('     the broken driver was not in place (the init script did not run)');
    if (!r.pacerOk) console.log(`     the GPU pacer ${r.waited === null ? 'never gave up' : `waited ${r.waited} ms (at most ${PACER_MOST})`} with fences that never signal`);
    if (!r.ok) failed++;
    if (!r.ok || flag('verbose')) for (const l of r.lines.slice(r.ok ? 0 : -12)) console.log(`     ${l}`);
  }
} catch (e) {
  console.error('load-smoke:', e);
  failed++;
}
console.log(failed ? `load-smoke: ${failed} load(s) failed` : `load-smoke: all ${rows.length} loads reached their first frame within ${LIMIT / 1000} s`);
await shutdown(failed ? 1 : 0);
