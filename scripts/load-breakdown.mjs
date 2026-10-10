// Where a world's load goes (docs/systems/performance.md, "Where a load goes"): the built game (dist/, `npx vite
// build` first; DIST=… another build) served on its own port, each world opened in a fresh headless muted Chrome on
// the GPU (ANGLE on Metal), with a probe on the WebGL calls from the page's first line. Per world:
//   stages     the loading screen's stages (main.js `load:` lines), ms
//   programs   how many programs were linked, the surface ones (materials.js), and their sources' size (kB)
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
//     [--keys]           with --dump, each live program's three.js key and the materials using it (dir/<world>.keys.json)
//     [--xbox https://hiraeth.example/perf-new.html]   on the Xbox instead (its page navigated there through the Device
//                        Portal's DevTools relay, scripts/xbox-shaders.mjs connect): the app opens only its own origin,
//                        so a build is put beside the console's (its index as perf-new.html and the assets the console
//                        lacks, through the portal's file API: docs/systems/performance.md "Where a load goes"); every
//                        shader salted with a #define of its own (a first launch: the GPU process's cache can't answer),
//                        the console's own preset. The game must be running.
// PORT (default 5471) is the server's, CDP its + 1. Never the author's dev server.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
  console.info = function (...a) { const s = String(a[0] ?? ''); if (s.startsWith('load: ')) { G.stages.push(s.slice(6)); G.lines.push(Math.round(performance.now()) + ' ' + s); } else if (/^(shaders|passage|bounds|bake|load steps|warm rest)/.test(s)) G.lines.push(Math.round(performance.now()) + ' ' + s); return info.apply(this, a); };
  console.warn = function (...a) { const s = String(a[0] ?? ''); if (/passage|pacer|bake/.test(s)) G.lines.push('warn: ' + s); return warn.apply(this, a); };
})();`;

/** A program's defines (its prefix's #define lines: the material's and three.js' own). */
export const definesOf = (vs) => [...vs.matchAll(/^#define ([A-Z_][A-Z0-9_]*)(?: (.*))?$/gm)].map((m) => (m[2] ? `${m[1]}=${m[2]}` : m[1]));

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

async function chrome() {
  const profile = mkdtempSync(join(tmpdir(), 'hiraeth-load-'));
  const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu-shader-disk-cache', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
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
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, ev, errors, close };
}

const storage = (preset) => `localStorage.clear();
  localStorage.setItem('moebius.muted', '1');
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ ${preset ? `quality: '${preset}', ` : ''}showFps: false, music: 0, effects: 0, voices: 0 }));`;

/** One world's load, in a fresh Chrome. */
export async function measure(world, { base, preset = PRESET, slow = SLOW, dump = false, xbox = false } = {}) {
  const c = xbox ? await xboxPage() : await chrome();
  try {
    await c.send('Page.enable');
    const page = base;   // (or a page of its own: a build put beside the console's, perf-new.html)
    const root = page.replace(/[^/]*$/, '');
    await c.send('Page.navigate', { url: `${root}manifest.webmanifest` }); await sleep(xbox ? 1500 : 300);
    await c.ev(`${storage(xbox ? null : preset)}; true`);
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE(slow, xbox && !WARM && (arg('salt') ?? true)) });
    const t0 = Date.now();
    await c.send('Page.navigate', { url: `${page}?level=${world}` });
    let up = false;
    while (!up && Date.now() - t0 < LIMIT) { try { up = await c.ev('!!window.__moebiusBooted'); } catch { /* loading */ } if (!up) await sleep(250); }
    if (!up) throw new Error(`${world}: no first frame in ${LIMIT / 1000} s (${c.errors.slice(-1)[0] ?? 'no error'})`);
    const wall = Date.now() - t0;
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
    const g = await c.ev(`(() => { const G = window.__gl; return { ...G, programs: G.programs.map((p) => ({ at: p.at, vs: ${dump} ? p.vs : p.vs.slice(0, 6000), fs: ${dump} ? p.fs : '', vsLen: p.vs.length, fsLen: p.fs.length })), nav: Math.round(performance.getEntriesByType('navigation')[0]?.responseEnd ?? 0), now: Math.round(window.__moebiusBootedAt ?? performance.now()), live: renderer.info.programs.length }; })()`);
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
    return {
      world, preset, wall, firstFrame: g.now, stages, lines: g.lines, gpu,
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
  const server = XBOX ? null : await serveDist();
  const base = XBOX ? (/\.html$/.test(XBOX) ? XBOX : XBOX.replace(/\/?$/, '/')) : `http://127.0.0.1:${PORT}/`;
  const all = [];
  try {
    for (const w of WORLDS) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await measure(w, { base, dump: !!DUMP && i === 0, xbox: !!XBOX }));
      const r = runs[0];
      if (RUNS > 1) {
        r.wall = median(runs.map((x) => x.wall)); r.firstFrame = median(runs.map((x) => x.firstFrame));
        for (const k of Object.keys(r.stages)) r.stages[k] = median(runs.map((x) => x.stages[k] ?? 0));
        for (const k of Object.keys(r.gl)) r.gl[k] = median(runs.map((x) => x.gl[k]));
      }
      if (DUMP) { mkdirSync(DUMP, { recursive: true }); writeFileSync(join(DUMP, `${w}.json`), JSON.stringify(r.list)); if (r.view) writeFileSync(join(DUMP, `${w}.view.json`), JSON.stringify(r.view.idx)); if (r.keys) writeFileSync(join(DUMP, `${w}.keys.json`), JSON.stringify(r.keys, null, 1)); }
      console.log(`${w} (${XBOX ? 'xbox' : PRESET}${SLOW ? `, slow ${SLOW.base}+${SLOW.perKb}/kB ×${SLOW.par}` : ''}): first frame ${r.firstFrame} ms`);
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
  } finally { server?.close(); }
  if (OUT) writeFileSync(OUT, JSON.stringify(all, null, 1));
  process.exit(0);   // (the console's DevTools socket would keep it running)
}
