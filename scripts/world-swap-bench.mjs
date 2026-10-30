// The world swap's check and timing (issue #790, docs/systems/world-swap.md): the game is loaded in a headless, muted
// Chrome, then swapped between a few worlds in place many times (src/world-travel.js travel, as a flight or the Debug
// menu's cards do), and after each swap, once garbage is collected, what the page holds is read: the JS heap, the
// renderer's geometries, textures and programs, the worlds alive (the players, renderers and sounds in memory), the
// WebGL contexts alive, the window's listeners, the page's elements, and the sound's context (one, running, the same
// from the first world on). It fails if more than the world playing and the one just let go are alive, if the heap
// (beyond --heap-slack MB) or any count grows from the first round trips to the last, if a swap is not a swap (a page
// load), or if the sound's context changes or stops.
// Each swap's time (the address changed → the next world's first frame) is set against the page load of the same
// world (a navigation → its first frame).
//
//   node scripts/world-swap-bench.mjs [--build] [--port 6203] [--worlds desert,arzach,lantern] [--trips 10] [--gpu]
//   --base http://127.0.0.1:5401/   a running server instead of dist/ served (the dev server: never 5173)
//   --gpu      the Mac's own GPU (default: SwiftShader, as the other headless checks)
//   --json <file>   the numbers written out
//
// Exits 1 on a leak, a lost context or a failed swap. Chrome: $CHROME, else the usual install paths.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { tempDir, ownProcess, removeTemp } from './temp-dirs.mjs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(`--${k}`);
const PORT = Number(arg('port', 6203)), CDP = PORT + 1;
const WORLDS = arg('worlds', 'desert,arzach,lantern').split(',').filter(Boolean);
const TRIPS = Number(arg('trips', 10));
const LIMIT = Number(arg('limit', 180)) * 1000;
/** How much the heap may grow from the second round trip to the last (MB) before it counts as a leak. */
const HEAP_SLACK = Number(arg('heap-slack', 80));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = process.env.CHROME ?? ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
if (!CHROME) { console.error('world-swap-bench: no Chrome found (set $CHROME)'); process.exit(1); }

// ------------------------------------------------------------------ the game, served
let BASE = arg('base', null), server = null;
if (!BASE) {
  const DIST = join(ROOT, 'dist');
  if (flag('build')) execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (!existsSync(join(DIST, 'index.html'))) { console.error('world-swap-bench: dist/ is missing: run `npx vite build` (or pass --build)'); process.exit(1); }
  const TYPES = { '.html': 'text/html', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ktx2': 'image/ktx2' };
  server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(DIST, path));
    if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise((r, j) => { server.once('error', j); server.listen(PORT, '127.0.0.1', r); });
  BASE = `http://127.0.0.1:${PORT}/`;
}

const profile = tempDir('hiraeth-swap-chrome-');
const gpu = flag('gpu') ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const chrome = ownProcess(spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--window-size=1280,720', ...gpu, '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--js-flags=--expose-gc',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' }));
let finished = false, ws = null;
async function shutdown(code) {
  if (finished) return; finished = true;
  try { ws?.close(); } catch { /* gone */ }
  const gone = new Promise((r) => chrome.once('exit', r));
  chrome.kill('SIGTERM');
  await Promise.race([gone, sleep(5000)]);
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
  server?.close();
  removeTemp(profile);
  process.exit(code);
}
process.on('SIGINT', () => shutdown(130));

let tabs;
for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
if (!tabs) { console.error('world-swap-bench: Chrome did not start'); await shutdown(1); }
ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
let id = 0;
const waits = new Map(), listeners = new Set();
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
  if (d.method) for (const fn of listeners) fn(d);
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
await send('Page.enable'); await send('Runtime.enable'); await send('HeapProfiler.enable');
const errors = [];
listeners.add((d) => {
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? d.params.exceptionDetails?.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
});
let navigations = 0;
listeners.add((d) => { if (d.method === 'Page.frameNavigated' && !d.params.frame.parentId) navigations++; });

// silent (review mute as the audio is built: the saved setting), the low preset, a save past the prologue
const STORAGE = `localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('hiraeth.muted', '1');
  localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'low', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 }));
  true`;
// (before the page's own scripts: when each world plays, and every WebGL context made, to count those still alive)
const PROBE = `(() => {
  window.__worldAt = []; window.__gl = [];
  addEventListener('hiraeth:world', (e) => window.__worldAt.push({ level: e.detail.level, t: performance.now() }));
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, o) { const c = get.call(this, kind, o); if (c && /webgl/.test(kind) && !window.__gl.some((r) => r.deref() === c)) window.__gl.push(new WeakRef(c)); return c; };
})();`;

const until = async (expr, ms = LIMIT) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evaluate(expr).catch(() => false)) return true; await sleep(250); } return false; };

/** What the page holds now, garbage collected first. */
async function sample() {
  for (let i = 0; i < 3; i++) { await send('HeapProfiler.collectGarbage'); await sleep(200); }
  const heap = await send('Runtime.getHeapUsage');
  const page = await evaluate(`(() => {
    const m = window.renderer?.info?.memory ?? {}, gl = window.__gl.map((r) => r.deref()).filter(Boolean);
    const ctx = window.sound?.ctx ?? null;
    window.__ctxs ??= []; if (ctx && !window.__ctxs.includes(ctx)) window.__ctxs.push(ctx);
    return { geometries: m.geometries ?? -1, textures: m.textures ?? -1, programs: window.renderer?.info?.programs?.length ?? -1,
      glAlive: gl.filter((c) => !c.isContextLost()).length, nodes: document.getElementsByTagName('*').length, canvases: document.querySelectorAll('canvas').length,
      audio: ctx ? ctx.state : 'none', contexts: window.__ctxs.length, level: window.level?.id ?? null, swaps: window.__swaps?.().length ?? 0 };
  })()`);
  const { result } = await send('Runtime.evaluate', { expression: 'window', objectGroup: 'bench' });
  const { listeners: ls } = await send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  const { result: d } = await send('Runtime.evaluate', { expression: 'document', objectGroup: 'bench' });
  const { listeners: dl } = await send('DOMDebugger.getEventListeners', { objectId: d.objectId });
  // how many worlds are in memory: the players, scenes, renderers and sounds alive (the one playing, and at most the
  // one just let go while its sound fades out)
  const alive = {};
  for (const [k, expr] of [['players', 'window.player.constructor.prototype'], ['renderers', 'window.renderer.constructor.prototype'], ['sounds', 'window.sound.constructor.prototype']]) {
    try {
      const { result: p } = await send('Runtime.evaluate', { expression: expr, objectGroup: 'bench' });
      const { objects } = await send('Runtime.queryObjects', { prototypeObjectId: p.objectId, objectGroup: 'bench' });
      alive[k] = (await send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function () { return this.length; }', returnByValue: true })).result.value;
    } catch { alive[k] = -1; }
  }
  await send('Runtime.releaseObjectGroup', { objectGroup: 'bench' });
  return { heapMB: +(heap.usedSize / 1048576).toFixed(1), winListeners: ls.length, docListeners: dl.length, ...alive, ...page };
}

/** A page load of `world` (a navigation → its first frame), ms. */
async function pageLoad(world) {
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` });
  await sleep(300);
  await evaluate(STORAGE);
  const t = await send('Page.navigate', { url: `${BASE}?level=${world}` });
  void t;
  if (!await until('window.__worldAt?.length > 0')) throw new Error(`${world}: no first frame on a page load`);
  return evaluate('window.__worldAt[0].t');   // (performance.now() counts from the navigation)
}

/** A swap to `world` in place: ms from the travel to its first frame. */
async function swapTo(world) {
  const before = navigations;
  const n = await evaluate('window.__worldAt.length');
  const t0 = await evaluate(`(() => { const t = performance.now(); window.__travel('?level=${world}'); return t; })()`);
  if (!await until(`window.__worldAt.length > ${n}`)) throw new Error(`swap to ${world}: no first frame`);
  if (navigations !== before) throw new Error(`swap to ${world}: the page was loaded, not swapped`);
  return (await evaluate(`window.__worldAt[${n}].t`)) - t0;
}

const out = { base: BASE, gpu: flag('gpu') ? 'Mac GPU' : 'SwiftShader', worlds: WORLDS, trips: TRIPS, loads: {}, swaps: [], samples: [] };
let failed = 0;
try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  // the page loads (each world once), for the comparison
  for (const w of WORLDS) { out.loads[w] = Math.round(await pageLoad(w)); console.log(`page load  ${w.padEnd(12)} ${out.loads[w]} ms`); await sleep(1500); }
  // then from the first world, swapped round the others TRIPS times
  await pageLoad(WORLDS[0]);
  await sleep(2000);
  out.samples.push({ trip: 0, ...await sample() });
  for (let trip = 1; trip <= TRIPS; trip++) {
    for (const w of [...WORLDS.slice(1), WORLDS[0]]) {
      const ms = Math.round(await swapTo(w));
      out.swaps.push({ trip, to: w, ms });
      await sleep(1500);
    }
    await sleep(2500);   // (the last world's sound faded out and let go)
    const s = { trip, ...await sample() };
    out.samples.push(s);
    console.log(`trip ${String(trip).padStart(2)}  heap ${s.heapMB} MB · worlds alive ${s.players} (renderers ${s.renderers}, sounds ${s.sounds}) · geometries ${s.geometries} · textures ${s.textures} · programs ${s.programs} · GL alive ${s.glAlive} · canvases ${s.canvases} · nodes ${s.nodes} · window listeners ${s.winListeners} · document ${s.docListeners} · audio ${s.audio} (${s.contexts} context${s.contexts === 1 ? '' : 's'}) · swap ${out.swaps.slice(-WORLDS.length).map((x) => `${x.to} ${x.ms} ms`).join(', ')}`);
  }
  // the checks: nothing grows from the first round trips to the last (the median of three, as the last world let go
  // may still be held a moment by its sound fading out or a load step under way); one context, running; one GL context
  const median = (l) => { const v = [...l].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  const early = out.samples.slice(1, 4), late = out.samples.slice(-3);
  const grow = (k, slack = 0) => {
    const a = median(early.map((x) => x[k])), z = median(late.map((x) => x[k]));
    if (z > a + slack) { console.log(`LEAK ${k}: ${a} over trips ${early[0].trip}-${early.at(-1).trip} → ${z} over trips ${late[0].trip}-${late.at(-1).trip}`); failed++; }
  };
  const z = out.samples.at(-1);
  grow('heapMB', HEAP_SLACK); grow('geometries', 2); grow('textures', 2); grow('nodes', 50); grow('winListeners', 2); grow('docListeners', 2); grow('canvases');
  // (no old world kept: every sample holds the world playing and at most the one just let go)
  const most = Math.max(...out.samples.map((x) => x.players)), mostR = Math.max(...out.samples.map((x) => x.renderers));
  if (most > 2 || mostR > 2) { console.log(`LEAK worlds: up to ${most} players and ${mostR} renderers alive at once`); failed++; }
  if (late.every((x) => x.players > 1)) { console.log('LEAK worlds: an old world is still held at each of the last samples'); failed++; }
  if (z.glAlive > 2) { console.log(`LEAK GL contexts: ${z.glAlive} alive`); failed++; }
  if (z.contexts !== 1 || z.audio !== 'running') { console.log(`SOUND: ${z.contexts} contexts, the last ${z.audio}`); failed++; }
  if (errors.length) console.log(`page errors (${errors.length}):\n  ${[...new Set(errors)].slice(0, 12).join('\n  ')}`);
  const mean = (l) => Math.round(l.reduce((s, x) => s + x, 0) / Math.max(1, l.length));
  out.summary = Object.fromEntries(WORLDS.map((w) => [w, { pageLoad: out.loads[w], swapMean: mean(out.swaps.filter((s) => s.to === w).map((s) => s.ms)) }]));
  for (const [w, r] of Object.entries(out.summary)) console.log(`${w.padEnd(12)} page load ${r.pageLoad} ms · swap ${r.swapMean} ms (mean of ${TRIPS})`);
  out.errors = [...new Set(errors)];
} catch (e) {
  console.error('world-swap-bench:', e.message);
  failed++;
}
if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(out, null, 2));
console.log(failed ? `world-swap-bench: ${failed} problem(s)` : `world-swap-bench: ${out.swaps.length} swaps, nothing grew`);
await shutdown(failed ? 1 : 0);
