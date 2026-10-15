// Where a world's load goes (docs/systems/performance.md, "Where a load goes"): the built game (dist/, `npx vite
// build` first; DIST=… another build) served on its own port, each world opened in a fresh headless muted Chrome on
// the GPU (ANGLE on Metal), with a probe on the WebGL calls from the page's first line. Per world:
//   stages     the loading screen's stages (main.js `load:` lines), ms
//   programs   how many programs were linked, the surface ones (materials.js), and their sources' size (kB)
//   phases     the load by kind of work (phasesOf): modules (the page and its scripts, up to main.js's start),
//              assets (waiting on the models' files), world creation, collision, characters, shaders (compile, link,
//              first use), GPU warm-up (the passage's draws, the first frame's uploads), the rest; and the first
//              playable frame (the first of ten frames in a row under 50 ms apart once the world is up)
//   memory     the JS heap in use, and what the scene holds for the GPU (geometry and texture MB, renderer counts)
//   gl         time inside the calls that compile (shaderSource/compile/link), that block on a program (its
//              status, log and uniforms queried), and that upload (buffers, textures), ms
//
//   node scripts/load-breakdown.mjs [--worlds desert,garage,lantern] [--preset high] [--json out.json]
//     [--dump dir]       writes each world's programs (their final GLSL, as the driver got it) to dir/<world>.json,
//                        for scripts/xbox-shaders.mjs to time on the console
//     [--slow ms]        simulates a slow shader compiler (the Xbox's ANGLE on D3D11): a program links in
//                        `ms` + its fragment's size × --slow-kb ms per kB (default 4), --slow-par at a time
//                        (default 2), and asking for its status, log or uniforms before blocks till it has
//     [--runs n]         each world n times (the median of each number)
//     [--gpu s]          then the frame's GPU time for s seconds at the spawn (EXT_disjoint_timer_query_webgl2 round
//                        each animation frame; the hour held at 10, uncapped): median and 90th percentile, ms
//     [--warm]           with --xbox: shaders not salted (a second load, the GPU process's cache kept)
//     [--salt word]      with --xbox: this salt, not a random one (run twice: a cold load, then a warm one of the same)
//     [--after s]        wait s seconds after the first frame before reading (what comes after it: warm rest)
//     [--cpu n]          the page's main thread slowed n times (with --preset handheld: the Retroid's recipe, docs/systems/performance.md)
//     [--query k=v&…]    added to the page's address (an A/B in one build: defer=0, batch=0)
//     [--traverse s]     then s seconds of fast traversal (the traveller carried at --speed m/s, 40 by default, past a
//                        hoverbike's top speed, along the camera's heading and back near the world's edge, after a
//                        quick full turn of the camera): the frame intervals' p50/p95/p99/max and the frames over 50
//                        and 100 ms (with --disable-gpu-vsync an interval is the frame's own work)
//     [--keys]           with --dump, each live program's three.js key and the materials using it (dir/<world>.keys.json)
//     [--xbox https://hiraeth.example/perf-new.html]   on the Xbox instead (its page navigated there through the Device
//                        Portal's DevTools relay, scripts/xbox-shaders.mjs connect): the app opens only its own origin,
//                        so a build is put beside the console's (its index as perf-new.html and the assets the console
//                        lacks, through the portal's file API: docs/systems/performance.md "Where a load goes"); every
//                        shader salted with a #define of its own (a first launch: the GPU process's cache can't answer),
//                        the console's own preset. The game must be running.
//     [--gecko cold,warm,session] [--apk] [--cool °C]   on the handheld over adb instead, in the GeckoView test app
//                        (scripts/bench/gecko-load.mjs: cold its data cleared, warm relaunched, session loaded again in
//                        the same app; --apk the game bundled in it as it ships); memory is the app's processes' PSS
// PORT (default 5471) is the server's, CDP its + 1. Never the author's dev server.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tempDir, ownProcess } from './temp-dirs.mjs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(process.env.DIST ?? join(ROOT, 'dist'));
const PORT = Number(process.env.PORT ?? 5471), CDP = Number(process.env.CDP ?? PORT + 1);
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const WORLDS = arg('worlds', 'desert,garage,lantern').split(',').filter(Boolean);
const PRESET = arg('preset', 'high');
const RUNS = Number(arg('runs', 1));
const WARM = args.includes('--warm'), OUT = arg('json'), DUMP = arg('dump'), KEYS = args.includes('--keys'), GPU = Number(arg('gpu', 0));
const SLOW = arg('slow') ? { base: Number(arg('slow')), perKb: Number(arg('slow-kb', 4)), par: Number(arg('slow-par', 2)) } : null;
const LIMIT = Number(arg('limit', 400)) * 1000;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2' };
/** dist/ served (host: 0.0.0.0 for a console on the network to load it). */
export function serveDist(dist = DIST, port = PORT, host = '127.0.0.1') {
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`no ${dist}/index.html: run npx vite build first`);
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dist, p);
    if (!f.startsWith(dist) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
    createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(port, host, () => r(server)));
}

/**
 * The probe, run before the page's own scripts: times the WebGL calls by kind, keeps each program's sources,
 * and (slow) makes the driver as slow as the console's.
 */
export const PROBE = (slow, salt = false) => `(() => {
  const G = window.__gl = { compile: 0, block: 0, upload: 0, uploadBytes: 0, srcBytes: 0, links: 0, blocks: 0, longestBlock: 0, programs: [] };
  const salt = ${salt ? `'${typeof salt === 'string' ? salt : Math.random().toString(36).slice(2, 10)}'` : 'null'};
  const slow = ${JSON.stringify(slow)};
  const C = WebGL2RenderingContext.prototype;
  G.long = [];   // (every call over 300 ms: its name, when, how long)
  const wrap = (name, kind, f) => { const o = C[name]; C[name] = function (...a) { const t = performance.now(); try { return f ? f.call(this, o, a) : o.apply(this, a); } finally { const d = performance.now() - t; G[kind] += d; if (d > 300) G.long.push([name, Math.round(t), Math.round(d)]); if (kind === 'block') { G.blocks++; if (d > G.longestBlock) G.longestBlock = d; } } }; };
  const src = new WeakMap(), ready = new WeakMap(), type = new WeakMap(), pindex = new WeakMap();
  // each program's first draw into each kind of target (its colour attachments: ANGLE on D3D11 compiles the pixel
  // shader again, on the GPU process's main thread, for a target with more outputs than its first)
  G.firstDraws = [];
  G.indexOf = (p) => pindex.get(p);
  { let cur = null, fbo = null; const targets = new WeakMap(), seen = new Set();
    const uo = C.useProgram; C.useProgram = function (p) { cur = p; return uo.call(this, p); };
    const bf = C.bindFramebuffer; C.bindFramebuffer = function (t, f) { if (t === this.FRAMEBUFFER || t === this.DRAW_FRAMEBUFFER) fbo = f; return bf.call(this, t, f); };
    const db = C.drawBuffers; C.drawBuffers = function (b) { if (fbo) targets.set(fbo, b.filter((x) => x !== this.NONE).length); return db.call(this, b); };
    for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const o = C[n];
      C[n] = function (...a) {
        const i = pindex.get(cur), k = fbo ? targets.get(fbo) ?? 1 : 0, key = i + ':' + k;
        if (i !== undefined && !seen.has(key)) {
          seen.add(key);
          const t = performance.now();
          try { return o.apply(this, a); } finally { G.firstDraws.push([i, k, Math.round(t)]); }
        }
        return o.apply(this, a);
      };
    }
  }
  { const o = C.createShader; C.createShader = function (t) { const s = o.call(this, t); if (s) type.set(s, t); return s; }; }
  let lanes = slow ? new Array(slow.par).fill(0) : null;
  wrap('shaderSource', 'compile', function (o, [s, text]) { src.set(s, text); G.srcBytes += text.length; return o.call(this, s, salt ? text.replace(/^(#version[^\\n]*\\n)/, '$1#define LOAD_SALT_' + salt + '\\n') : text); });
  wrap('compileShader', 'compile');
  wrap('linkProgram', 'compile', function (o, [p]) {
    G.links++;
    const sh = this.getAttachedShaders(p) ?? [];
    const kinds = sh.map((s) => [type.get(s), src.get(s) ?? '']);
    const vs = kinds.find((k) => k[0] === this.VERTEX_SHADER)?.[1] ?? '', fs = kinds.find((k) => k[0] === this.FRAGMENT_SHADER)?.[1] ?? '';
    pindex.set(p, G.programs.length);
    G.programs.push({ at: Math.round(performance.now()), vs, fs });
    if (slow) {   // ready when a lane is free and its cost has passed
      const cost = slow.base + slow.perKb * fs.length / 1024, now = performance.now();
      const i = lanes.indexOf(Math.min(...lanes)), start = Math.max(now, lanes[i]);
      lanes[i] = start + cost; ready.set(p, lanes[i]);
    }
    return o.call(this, p);
  });
  const waitFor = (p) => { const t = ready.get(p); if (t) while (performance.now() < t) { /* the driver, blocking */ } };
  const blocking = (name) => wrap(name, 'block', function (o, a) { if (slow && a[0] instanceof WebGLProgram) { if (!(name === 'getProgramParameter' && a[1] === 0x91B1)) waitFor(a[0]); else if ((ready.get(a[0]) ?? 0) > performance.now()) return false; } return o.apply(this, a); });
  for (const n of ['getProgramParameter', 'getProgramInfoLog', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib', 'getAttribLocation', 'getUniformBlockIndex']) blocking(n);
  wrap('getShaderParameter', 'block'); wrap('getShaderInfoLog', 'block');
  for (const n of ['bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'compressedTexImage2D', 'texStorage2D', 'texStorage3D'])
    wrap(n, 'upload', function (o, a) { const b = a.find((x) => x && x.byteLength !== undefined); if (b) G.uploadBytes += b.byteLength; return o.apply(this, a); });
  const info = console.info, warn = console.warn;
  G.stages = []; G.lines = [];
  G.frames = [];   // (every animation frame's time: the first playable frame, the traversal's intervals)
  { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => raf((t) => { if (t !== G.lastT && G.frames.length < 200000) { G.lastT = t; G.frames.push(performance.now()); } return f(t); }); }
  console.info = function (...a) { const s = String(a[0] ?? ''); if (s.startsWith('load: ')) { G.stages.push(s.slice(6)); G.lines.push(Math.round(performance.now()) + ' ' + s); } else if (/^(shaders|passage|bounds|bake|load steps|warm rest|distant detail)/.test(s)) G.lines.push(Math.round(performance.now()) + ' ' + s); return info.apply(this, a); };
  console.warn = function (...a) { const s = String(a[0] ?? ''); if (/passage|pacer|bake/.test(s)) G.lines.push('warn: ' + s); return warn.apply(this, a); };
})();`;

/** A program's defines (its prefix's #define lines: the material's and three.js' own). */
export const definesOf = (vs) => [...vs.matchAll(/^#define ([A-Z_][A-Z0-9_]*)(?: (.*))?$/gm)].map((m) => (m[2] ? `${m[1]}=${m[2]}` : m[1]));

/** Which kind of work a load step is (main.js's stages and their setStep names). */
const KIND = {
  world: 'world', openings: 'world', water: 'world', ship: 'world', reactive: 'world', tiling: 'world', flora: 'world', grass: 'world', batches: 'world',
  bake: 'collision', 'level init': 'collision', 'buried flora': 'collision',
  player: 'characters', traveller: 'characters', npcs: 'characters', crowd: 'characters', 'crowd pool': 'characters', 'wildlife, foes': 'characters',
  'assets wait': 'assets',
  surfaces: 'shaders', post: 'shaders', shadows: 'shaders', 'first use': 'shaders',
  passage: 'gpu warm-up',
  'near detail': 'world',
};
const SHADER_STAGE = /^mixing/;
/**
 * The load by kind of work, ms: main.js's window.__loadLog ({ stage, ms, steps: [[name, ms]] }), its start (loadT0,
 * from the navigation) and the first frame. A stage's time its steps don't cover goes to `other`, as do the stages'
 * frames for the loading screen; the time from "ready" to the first frame is `first frame`.
 */
export function phasesOf(log, loadT0, firstFrame) {
  const out = { modules: loadT0, assets: 0, world: 0, collision: 0, characters: 0, shaders: 0, 'gpu warm-up': 0, other: 0, 'first frame': 0 };
  let sum = 0;
  for (const { stage, ms, steps } of log) {
    let covered = 0;
    for (const [name, t] of steps ?? []) {
      const kind = SHADER_STAGE.test(stage) && name === 'water' ? 'shaders' : KIND[name] ?? 'other';
      out[kind] += t; covered += t;
    }
    out.other += Math.max(0, ms - covered); sum += ms;
  }
  out['first frame'] = Math.max(0, firstFrame - loadT0 - sum);
  for (const k of Object.keys(out)) out[k] = Math.round(out[k]);
  return out;
}
/** The q-th quantile (0..1) of a list. */
export const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
/** The first playable frame: the first frame from `from` on that begins `run` frames in a row each under `ms` apart. */
export function firstPlayable(times, from, { run = 10, ms = 50 } = {}) {
  const t = times.filter((x) => x >= from);
  for (let i = 0; i + run < t.length; i++) {
    let ok = true;
    for (let j = i; j < i + run; j++) if (t[j + 1] - t[j] >= ms) { ok = false; break; }
    if (ok) return t[i];
  }
  return null;
}

/** The Xbox's game page (scripts/xbox-shaders.mjs connect), shaped as chrome()'s. */
async function xboxPage() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const { connect } = await import('./xbox-shaders.mjs');
  const c = await connect();
  const ev = async (expression) => {
    const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  return { send: c.send, ev, errors: [], close: async () => c.close() };
}

export async function chrome() {
  const profile = tempDir('hiraeth-load-');
  const proc = ownProcess(spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu-shader-disk-cache', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' }));
  let tabs;
  for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
  if (!tabs) throw new Error('Chrome did not start');
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map(); const errors = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description ?? 'exception');
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression.slice(0, 90)}…: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  const close = async () => {
    try { ws.close(); } catch { /* gone */ }
    const gone = new Promise((r) => proc.once('exit', r));
    proc.kill('SIGTERM');
    await Promise.race([gone, sleep(5000)]);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });   // (Chrome's helpers can still be writing into it)
  };
  // the resident memory of this Chrome's renderer and GPU processes, MB (ps, by the profile's directory on their command line)
  const processes = () => {
    try {
      const out = { renderer: 0, gpu: 0 };
      for (const l of execFileSync('ps', ['-A', '-o', 'rss=,command='], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n')) {
        if (!l.includes(profile)) continue;
        const rss = Number(l.trim().split(/\s+/)[0]) / 1024;
        if (l.includes('--type=renderer')) out.renderer += rss; else if (l.includes('--type=gpu-process')) out.gpu += rss;
      }
      return { rendererMB: Math.round(out.renderer), gpuMB: Math.round(out.gpu) };
    } catch { return null; }
  };
  return { send, ev, errors, close, processes };
}

const storage = (preset, fps = false) => `localStorage.clear();
  localStorage.setItem('hiraeth.muted', '1');
  localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ ${preset ? `quality: '${preset}', ` : ''}showFps: ${fps}, hudV: 1, music: 0, effects: 0, voices: 0, soundV: 1 }));`;

/** One world's load, in a fresh Chrome (or `page`: a page of the same shape, the handheld's, scripts/bench/gecko-load.mjs). */
export async function measure(world, { base, preset = PRESET, slow = SLOW, dump = false, xbox = false, page: given = null } = {}) {
  const c = given ?? (xbox ? await xboxPage() : await chrome());
  const gecko = !!c.gecko;
  try {
    await c.send('Page.enable');
    const page = base;   // (or a page of its own: a build put beside the console's, perf-new.html)
    const root = page.replace(/[^/]*$/, '');
    await c.send('Page.navigate', { url: `${root}manifest.webmanifest` }); await sleep(xbox ? 1500 : 300);
    await c.ev(`${storage(xbox ? null : preset, gecko)}; true`);   // (on the handheld the frame readout on, as every measure there)
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE(slow, xbox && !WARM && (arg('salt') ?? true)) });
    if (!xbox && arg('cpu')) await c.send('Emulation.setCPUThrottlingRate', { rate: Number(arg('cpu')) });   // (the handheld recipe: the main thread slowed n times)
    const t0 = Date.now();
    await c.send('Page.navigate', { url: `${page}?level=${world}${arg('query') ? `&${arg('query')}` : ''}` });
    let up = false;
    while (!up && Date.now() - t0 < LIMIT) { try { up = await c.ev('!!window.__hiraethBooted', 10000); } catch { /* loading */ } if (!up) await sleep(250); }
    if (!up) throw new Error(`${world}: no first frame in ${LIMIT / 1000} s (${c.errors.slice(-1)[0] ?? 'no error'})`);
    const wall = Date.now() - t0;
    if (gecko) {   // (the handheld's speaker: the game must be silent)
      const s = await c.ev('[window.sound?.musicVol, window.sound?.fxVol, window.sound?.voiceVol]');
      if (s.some((v) => v > 0)) throw new Error(`${world}: the game's sound is not at 0 (${s})`);
    }
    await sleep(500 + Number(arg('after', 0)) * 1000);
    const gpu = GPU && !xbox ? await c.ev(`(async () => {
      if (window.sky) { sky.hour = 10; sky.speed = 0; window.updateSky?.(); }
      const gl = renderer.getContext(), X = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!X) return null;
      await new Promise((r) => setTimeout(r, 3000));   // (settled: the grass placed, the first frames' uploads done)
      const raf = window.requestAnimationFrame.bind(window), qs = [], out = [];
      let on = true;
      window.requestAnimationFrame = (f) => raf((t) => { if (!on) return f(t); const q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q); try { f(t); } finally { gl.endQuery(X.TIME_ELAPSED_EXT); qs.push(q); } });
      const t1 = performance.now();
      while (performance.now() - t1 < ${GPU * 1000}) {
        await new Promise((r) => setTimeout(r, 50));
        while (qs.length && gl.getQueryParameter(qs[0], gl.QUERY_RESULT_AVAILABLE)) { const q = qs.shift(); if (!gl.getParameter(X.GPU_DISJOINT_EXT)) out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
      }
      on = false;
      out.sort((a, b) => a - b);
      return { frames: out.length, median: +out[out.length >> 1].toFixed(2), p90: +out[Math.floor(out.length * 0.9)].toFixed(2) };
    })()`) : null;
    // what the page holds: the JS heap, and the scene's geometry and textures (each counted once)
    const memory = await c.ev(`(() => { const geos = new Set(), arrays = new Set(), texs = new Set(); let gb = 0, tb = 0;
      const arr = (x) => { if (x && !arrays.has(x)) { arrays.add(x); gb += x.byteLength ?? 0; } };
      const tex = (v) => { if (v?.isTexture && !texs.has(v)) { texs.add(v); const i = v.image; tb += (i?.width ?? 0) * (i?.height ?? 0) * (i?.depth ?? 1) * 4; } };
      scene.traverse((o) => { const g = o.geometry; if (g && !geos.has(g)) { geos.add(g); for (const a of Object.values(g.attributes ?? {})) arr(a.array ?? a.data?.array); arr(g.index?.array); }
        for (const m of [o.material].flat()) { if (!m) continue; for (const v of Object.values(m)) tex(v); for (const u of Object.values(m.uniforms ?? {})) tex(u?.value); } });
      return { geometryMB: +(gb / 2 ** 20).toFixed(1), textureMB: +(tb / 2 ** 20).toFixed(1), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 2 ** 20).toFixed(1) : null }; })()`);
    Object.assign(memory, c.processes?.() ?? {});
    try { const h = await c.send('Runtime.getHeapUsage'); const u = h.usedSize ?? h.result?.usedSize; if (u) memory.heapMB = +(u / 2 ** 20).toFixed(1); } catch { /* not there */ }
    // the levels of detail and the queue of distant detail (src/deferred.js) at the first frame, and after the traversal
    const stateAt = () => c.ev(`(() => { const L = window.lod?.()?.stats, D = window.deferred, LC = window.physics?.late; return { lod: L ? { meshes: L.meshes, built: L.built, packMs: Math.round(L.packMs), pending: L.pending } : null, deferred: D ? { pending: D.pending, done: D.done, ms: Math.round(D.ms), forced: D.forced } : null, late: LC ? { pending: LC.pending, made: LC.made, ms: Math.round(LC.ms), forced: LC.forced, parts: LC.parts.length, triangles: LC.triangles } : null }; })()`);
    const atBoot = await stateAt();
    const TRAV = Number(arg('traverse', 0)), SPEED = Number(arg('speed', 40));
    const traverse = TRAV ? await c.ev(`(async () => {
      const T = THREE, P = player, start = P.pos.clone(), lim = (level.limit ?? 1900) * 0.7;
      const dir = new T.Vector3(); camera.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
      const up = new T.Vector3(0, 1, 0), at = start.clone(), t0 = performance.now(), from = window.__gl.frames.length;
      let last = t0, turned = 0;
      await new Promise((done) => { const step = () => {
        const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
        if (now - t0 > ${TRAV * 1000}) return done();
        if (turned < Math.PI * 2) { const d = Math.min(Math.PI * 2 - turned, dt * Math.PI * 2); rig.yaw -= d; turned += d; }   // (a full turn in a second)
        else {
          at.addScaledVector(dir, ${SPEED} * dt);
          if (Math.hypot(at.x, at.z) > lim) { dir.negate(); at.addScaledVector(dir, ${SPEED} * dt * 2); }
          const g = physics.groundAt(at.x, at.y + 60, at.z, 400);
          if (Number.isFinite(g)) at.y = g + 0.1;
          P.teleport(at, up, dir, { speed: ${SPEED} });
          rig.yaw = Math.atan2(-dir.x, -dir.z);
        }
        requestAnimationFrame(step); };
        requestAnimationFrame(step); });
      const f = window.__gl.frames.slice(from), iv = [];
      for (let i = 1; i < f.length; i++) iv.push(f[i] - f[i - 1]);
      return { iv, metres: Math.round(at.distanceTo(start)) };
    })()`) : null;
    let trav = null;
    const afterTrav = TRAV ? await stateAt() : null;
    if (traverse) { const iv = traverse.iv; trav = { frames: iv.length, p50: +quantile(iv, 0.5).toFixed(1), p95: +quantile(iv, 0.95).toFixed(1), p99: +quantile(iv, 0.99).toFixed(1), max: +Math.max(...iv).toFixed(1), over50: iv.filter((x) => x > 50).length, over100: iv.filter((x) => x > 100).length, speed: SPEED }; }
    const g = await c.ev(`(() => { const G = window.__gl; return { ...G, frames: [], loadLog: window.__loadLog ?? [], loadT0: window.__loadT0 ?? 0, frameTimes: G.frames.filter((x) => x >= (window.__hiraethBootedAt ?? 0)).slice(0, 2000), programs: G.programs.map((p) => ({ at: p.at, vs: ${dump} ? p.vs : p.vs.slice(0, 6000), fs: ${dump} ? p.fs : '', vsLen: p.vs.length, fsLen: p.fs.length })), nav: Math.round(performance.getEntriesByType('navigation')[0]?.responseEnd ?? 0), now: Math.round(window.__hiraethBootedAt ?? performance.now()), live: renderer.info.programs.length }; })()`);
    const keys = KEYS ? await c.ev(`(() => { const r = renderer, by = new Map();
      scene.traverse((o) => { for (const m of [o.material].flat()) { if (!m) continue; const p = r.properties.get(m).currentProgram; if (!p) continue; if (!by.has(p)) by.set(p, new Set()); by.get(p).add((m.name || m.type) + ' ' + (m.userData?.cacheKey ?? '').slice(0, 120) + ' obc:' + (m.onBeforeCompile?.toString().length ?? 0)); } });
      return r.info.programs.map((p) => ({ key: p.cacheKey, mats: [...(by.get(p) ?? [])].slice(0, 6) })); })()`) : null;
    // the programs the spawn's view draws: the meshes in the camera's frustum (as the passage warm-up's first batch) and
    // the shadow casters round it, against every program compiled
    const view = await c.ev(`(() => { const T = THREE, r = renderer, f = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const progs = new Set(), all = new Set(); let meshes = 0;
      scene.traverse((o) => { if (!(o.isMesh || o.isPoints || o.isLine) || !o.material) return; for (const m of [o.material].flat()) { const p = r.properties.get(m).currentProgram; if (!p) continue; all.add(p);
        let vis = true; for (let q = o; q; q = q.parent) if (q.visible === false) { vis = false; break; }
        let inV = false; try { inV = !o.frustumCulled || f.intersectsObject(o); } catch { inV = false; }
        if (vis && inV && (!o.isInstancedMesh || o.count > 0)) { progs.add(p); meshes++; } } });
      const idx = [...progs].map((p) => window.__gl.indexOf(p.program)).filter((i) => i !== undefined).sort((a, b) => a - b);
      return { inView: progs.size, meshesInView: meshes, used: all.size, compiled: r.info.programs.length, idx }; })()`);
    const stages = Object.fromEntries(g.stages.map((s) => { const m = s.match(/^(.*) (\d+) ms/); return m ? [m[1], +m[2]] : [s, 0]; }).filter(([k]) => k !== 'start'));
    const surface = g.programs.filter((p) => /\bSURFACE_SPEC\b|uWearLite/.test(p.vs) || p.fsLen > 100000);
    const playable = firstPlayable(g.frameTimes, g.now);
    return {
      world, preset, wall, firstFrame: g.now, firstPlayable: playable === null ? null : Math.round(playable), phases: phasesOf(g.loadLog, g.loadT0, g.now), memory, traverse: trav, atBoot, afterTrav,
      stages, lines: g.lines, gpu,
      programs: { linked: g.links, live: g.live, surface: surface.length, fsKb: Math.round(g.programs.reduce((n, p) => n + p.fsLen, 0) / 1024), vsKb: Math.round(g.programs.reduce((n, p) => n + p.vsLen, 0) / 1024), srcKb: Math.round(g.srcBytes / 1024) },
      gl: { compile: Math.round(g.compile), block: Math.round(g.block), blocks: g.blocks, longestBlock: Math.round(g.longestBlock), upload: Math.round(g.upload), uploadMB: +(g.uploadBytes / 2 ** 20).toFixed(1) },
      view, long: g.long, links: g.programs.map((p) => p.at), firstDraws: g.firstDraws,
      list: g.programs.map((p) => ({ at: p.at, vsLen: p.vsLen, fsLen: p.fsLen, defines: definesOf(p.vs), ...(dump ? { vs: p.vs, fs: p.fs } : {}) })),
      errors: c.errors.slice(0, 5), keys,
    };
  } finally { await c.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const XBOX = arg('xbox');
  // --gecko cold,warm,session: on the handheld over adb, in the GeckoView test app (scripts/bench/gecko-load.mjs), each
  // world loaded each way in turn (cold: the test app's data cleared; warm: relaunched; session: loaded again in the
  // same app); --apk: the game bundled in the test app, as it ships, else served from the Mac; --cool °C (48)
  const GECKO = arg('gecko') ? arg('gecko').split(',') : null;
  const G = GECKO ? await import('./bench/gecko-load.mjs') : null;
  const gecko = GECKO ? await G.geckoServer(DIST, { apk: args.includes('--apk') }) : null;
  const server = XBOX || GECKO ? null : await serveDist();
  const base = XBOX ? (/\.html$/.test(XBOX) ? XBOX : XBOX.replace(/\/?$/, '/')) : GECKO ? gecko.base : `http://127.0.0.1:${PORT}/`;
  if (GECKO) for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { gecko.close(); process.exit(130); });
  const all = [];
  try {
    for (const w of WORLDS) for (const how of GECKO ?? [null]) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        if (how) await gecko.ensure();
        const cool = how ? await G.coolDown(`${w} ${how}`, Number(arg('cool', 48))) : null;
        const page = how ? await gecko.open(how) : null;
        runs.push({ ...(await measure(w, { base, dump: !!DUMP && i === 0, xbox: !!XBOX, page })), ...(how ? { how, cool, after: G.temps() } : {}) });
        if (how) await gecko.rest();   // (the game off the screen while the next one waits to cool)
      }
      const r = runs[0];
      if (RUNS > 1) {
        r.wall = median(runs.map((x) => x.wall)); r.firstFrame = median(runs.map((x) => x.firstFrame));
        for (const k of Object.keys(r.stages)) r.stages[k] = median(runs.map((x) => x.stages[k] ?? 0));
        for (const k of Object.keys(r.gl)) r.gl[k] = median(runs.map((x) => x.gl[k]));
        for (const k of Object.keys(r.phases)) r.phases[k] = median(runs.map((x) => x.phases[k]));
        r.firstPlayable = median(runs.map((x) => x.firstPlayable ?? Infinity));
        for (const k of ['heapMB', 'geometryMB', 'textureMB', 'rendererMB', 'gpuMB', 'tabMB', 'parentMB', 'totalMB']) r.memory[k] = median(runs.map((x) => x.memory[k]));
        if (r.traverse) for (const k of ['p50', 'p95', 'p99', 'max', 'over50', 'over100']) r.traverse[k] = median(runs.map((x) => x.traverse[k]));
      }
      if (DUMP) { mkdirSync(DUMP, { recursive: true }); writeFileSync(join(DUMP, `${w}.json`), JSON.stringify(r.list)); if (r.view) writeFileSync(join(DUMP, `${w}.view.json`), JSON.stringify(r.view.idx)); if (r.keys) writeFileSync(join(DUMP, `${w}.keys.json`), JSON.stringify(r.keys, null, 1)); }
      console.log(`${w}${r.how ? ` ${r.how}` : ''} (${XBOX ? 'xbox' : GECKO ? `gecko${args.includes('--apk') ? ' apk' : ''} ${PRESET}` : PRESET}${arg('cpu') ? `, CPU ×${arg('cpu')}` : ''}${arg('query') ? `, ${arg('query')}` : ''}${SLOW ? `, slow ${SLOW.base}+${SLOW.perKb}/kB ×${SLOW.par}` : ''}): first frame ${r.firstFrame} ms`);
      console.log(`  phases  ${Object.entries(r.phases).map(([k, v]) => `${k} ${v}`).join(' · ')} · first playable ${r.firstPlayable ?? '-'}`);
      console.log(`  memory  heap ${r.memory.heapMB} MB · geometry ${r.memory.geometryMB} MB (${r.memory.geometries}) · textures ${r.memory.textureMB} MB (${r.memory.textures})${r.memory.tabMB ? ` · PSS: tab ${r.memory.tabMB} MB, GPU ${r.memory.gpuMB} MB, parent ${r.memory.parentMB} MB (${r.memory.totalMB})` : r.memory.gpuMB ? ` · processes: renderer ${r.memory.rendererMB} MB, GPU ${r.memory.gpuMB} MB` : ''}`);
      const st = (x) => [x?.lod && `levels of detail: ${x.lod.meshes} meshes, ${x.lod.built} built (${x.lod.packMs} ms packing), ${x.lod.pending} waiting`, x?.deferred && `distant detail: ${x.deferred.done} done (${x.deferred.ms} ms, ${x.deferred.forced} forced), ${x.deferred.pending} left`,
        x?.late && `late collision: ${x.late.made} pieces made (${x.late.ms} ms, ${x.late.forced} by a query), ${x.late.pending} left, ${x.late.triangles} triangles in ${x.late.parts} parts`].filter(Boolean).join(' · ');
      console.log(`  boot    ${st(r.atBoot)}`);
      if (r.afterTrav) console.log(`  after   ${st(r.afterTrav)}`);
      if (r.traverse) console.log(`  travel  ${r.traverse.frames} frames at ${r.traverse.speed} m/s: p50 ${r.traverse.p50} · p95 ${r.traverse.p95} · p99 ${r.traverse.p99} · max ${r.traverse.max} ms · ${r.traverse.over50} > 50, ${r.traverse.over100} > 100`);
      console.log(`  stages  ${Object.entries(r.stages).map(([k, v]) => `${k.replace(/…$/, '')} ${v}`).join(' · ')}`);
      console.log(`  programs ${r.programs.linked} linked (${r.programs.surface} surface), fragment ${r.programs.fsKb} kB, vertex ${r.programs.vsKb} kB`);
      console.log(`  gl      compile ${r.gl.compile} ms · blocked ${r.gl.block} ms (${r.gl.blocks} calls, longest ${r.gl.longestBlock}) · upload ${r.gl.upload} ms (${r.gl.uploadMB} MB)`);
      for (const l of r.lines) console.log(`  ${l}`);
      if (r.view) console.log(`  view    ${r.view.inView} programs draw the spawn's view (${r.view.meshesInView} meshes), ${r.view.used} used by the scene, ${r.view.compiled} compiled`);
      if (r.gpu) console.log(`  gpu     ${r.gpu.median} ms a frame (90%: ${r.gpu.p90}, ${r.gpu.frames} frames)`);
      if (r.errors.length) console.log(`  errors  ${r.errors.join(' | ').slice(0, 300)}`);
      delete r.list;
      all.push(r);
    }
  } finally { server?.close(); gecko?.close(); }
  if (OUT) writeFileSync(OUT, JSON.stringify(all, null, 1));
  process.exit(0);   // (the console's DevTools socket would keep it running)
}
