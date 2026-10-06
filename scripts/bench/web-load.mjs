// What a world costs to open on the desktop: how long it takes to load, what it holds in memory, and
// how big its crowd is (docs/systems/animation.md, "Locomotion"). The companion to web-bench.mjs,
// which measures the frame; this measures the load and the memory, in headless Chrome on the real GPU
// (ANGLE on Metal: --headless=new keeps it), against the production build.
//
//   npx vite build && node scripts/bench/serve.mjs &
//   node scripts/bench/web-load.mjs [--worlds bazaar,incal,desert] [--url http://localhost:5245/]
//     [--preset high|handheld] [--res 1280x720] [--runs 2] [--out results/load.json]
//
// Per world and run: the page's own timings (navigation to the first frame, to the world ready), the
// JS heap after a forced collection (--enable-precise-memory-info), three.js' renderer.info.memory
// (geometries and textures live on the GPU) and its programs, the people and crowd it holds, and the
// median frame time of a ten-second uncapped sample at the spawn (no vsync, no frame-rate limit).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = (arg('url', 'http://localhost:5245/')).replace(/\/?$/, '/');
const WORLDS = arg('worlds', 'bazaar,incal,desert').split(',');
const PRESET = arg('preset', 'high'), RUNS = +arg('runs', 2);
const [W, H] = arg('res', '1280x720').split('x').map(Number);
const OUT = arg('out', null) && resolve(arg('out'));
const CDP = +arg('cdp', 6351);
const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

const profile = mkdtempSync(join(tmpdir(), 'memento-load-'));
const chrome = spawn(CHROME, ['--headless=new', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist',
  '--enable-precise-memory-info', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--mute-audio', '--disable-gpu-vsync', '--disable-frame-rate-limit', `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--no-first-run',
  '--no-default-browser-check', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const waits = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${e.slice(0, 80)}: ${r.exceptionDetails.exception?.description}`);
  return r.result.value;
};
const until = async (e, secs = 300) => { for (let t = 0; t < secs * 4; t++) { try { if (await ev(e)) return true; } catch { /* between loads */ } await sleep(250); } throw new Error(`timed out: ${e}`); };
const QUIET = (preset) => `localStorage.setItem('moebius.muted','1'); localStorage.setItem('moebius.settings.v1', JSON.stringify({ music: 0, effects: 0, voices: 0, quality: '${preset}' }));`;

const rows = [];
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); break; } catch { await sleep(250); } }
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  // the first frame the page draws, timed from the navigation, before any of the game runs
  await send('Page.addScriptToEvaluateOnNewDocument', { source:
    `try { ${QUIET(PRESET)} } catch {}
     window.__firstFrame = null;
     requestAnimationFrame(() => requestAnimationFrame(() => { window.__firstFrame = performance.now(); }));` });
  await send('Page.navigate', { url: `${BASE}?blank` }); await sleep(400);
  await ev(`localStorage.clear(); ${QUIET(PRESET)} true`);
  const gl = await ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g?.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; })()`);
  if (/SwiftShader|llvmpipe|Software/i.test(gl)) { console.error(`software rendering: ${gl}`); process.exit(2); }
  console.log(`${gl}, ${W}×${H}, the ${PRESET} preset, ${RUNS} runs a world\n`);
  for (const world of WORLDS) {
    for (let run = 0; run < RUNS; run++) {
      await send('Page.navigate', { url: `${BASE}?blank` }); await sleep(300);
      await send('Page.navigate', { url: `${BASE}?level=${world}&items=all` });
      await until('!!window.__moebiusBooted && !!window.level && !!window.renderer');
      await sleep(12000);   // (it settles: the levels' workers, the crowd's bodies, the shader compiles)
      await send('HeapProfiler.collectGarbage');   // (the heap after a collection, not wherever the GC happened to be)
      await sleep(500);
      const r = await ev(`(() => {
        const nav = performance.getEntriesByType('navigation')[0] ?? { responseEnd: 0 };
        const info = window.renderer.info;
        const people = (window.npcs?.length ?? 0) + (window.crowd?.people?.length ?? 0);
        return {
          firstFrame: Math.round(window.__firstFrame ?? -1),
          ready: Math.round(window.__moebiusBootedAt ?? -1),
          transfer: Math.round((performance.getEntriesByType('resource').reduce((n, e) => n + (e.transferSize || 0), 0) + (nav.transferSize || 0)) / 1024),
          heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
          geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0,
          npcs: window.npcs?.length ?? 0, crowd: window.crowd?.people?.length ?? 0, people,
        };
      })()`);
      // a ten-second sample of the frame at the spawn
      await ev(`(() => { window.__t = []; const f = () => { window.__t.push(performance.now()); requestAnimationFrame(f); }; requestAnimationFrame(f); return true; })()`);
      await sleep(10000);
      const frames = await ev(`(() => { const t = window.__t; const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]); return d; })()`);
      const row = { world, run, ...r, frameMs: +median(frames).toFixed(2), frames: frames.length };
      rows.push(row);
      console.log(`${world} run ${run + 1}: first frame ${row.firstFrame} ms, world ready ${row.ready} ms, ${row.transfer} kB over the wire; `
        + `heap ${row.heapMB} MB, ${row.geometries} geometries, ${row.textures} textures, ${row.programs} programs; `
        + `${row.people} people (${row.npcs} story, ${row.crowd} crowd); frame ${row.frameMs} ms`);
    }
  }
  if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify({ gl, res: [W, H], preset: PRESET, rows }, null, 2)); console.log(`\n${OUT}`); }
} finally {
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill();
}
