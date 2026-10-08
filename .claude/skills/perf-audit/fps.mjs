// The performance audit's frame and load numbers on this Mac (.claude/skills/perf-audit/SKILL.md): the
// production build (dist/, `npx vite build` first) served on its own port, a MUTED headless Chrome on the
// real GPU (ANGLE on Metal; the renderer string is checked and SwiftShader refused), no vsync and no frame-rate
// limit, so a frame's interval is its work. Per world: the load (navigation to the game booted), then at
// each benchmark view (scripts/bench/viewpoints.json for the desert, viewpoints-worlds.json for the rest,
// the boot camera elsewhere) the frame intervals, the draw calls, triangles and the JS heap.
//
//   node .claude/skills/perf-audit/fps.mjs [--preset high|handheld|deck|low] [--worlds desert,incal] [--secs 6]
//        [--warmup 2] [--res 1280x720] [--out file.json]          PORT (default 5492; Chrome's is PORT + 1)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PRESET = arg('preset', 'high'), SECS = +arg('secs', 6), WARM = +arg('warmup', 2), [W, H] = arg('res', '1280x720').split('x').map(Number);
const PORT = Number(process.env.PORT ?? 5492), CDP = PORT + 1;
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
if (!existsSync(join(ROOT, 'dist/index.html'))) throw new Error('no dist/: run `npx vite build` first (the audit measures the shipped bundle)');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VW = JSON.parse(readFileSync(join(ROOT, 'scripts/bench/viewpoints-worlds.json'), 'utf8')).worlds;
const VD = JSON.parse(readFileSync(join(ROOT, 'scripts/bench/viewpoints.json'), 'utf8')).views;
const route = await import(join(ROOT, 'src/levels/names.js')), ids = [...(route.ORDER ?? []), ...(route.SIDE ?? []), 'home', 'lantern'];
const WORLDS = (arg('worlds') ?? [...new Set(ids)].join(',')).split(',').filter(Boolean);
const viewsOf = (id) => (id === 'desert' ? VD : VW[id]?.views ?? []).filter((v) => v.eye && v.target).slice(0, 4);

const { preview } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await preview({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', preview: { port: PORT, strictPort: true, host: '127.0.0.1' } });
const BASE = `http://127.0.0.1:${PORT}/`;

const profile = mkdtempSync(join(tmpdir(), 'perf-audit-chrome-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-precise-memory-info', '--no-first-run', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 200)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return d.result?.exceptionDetails ? null : d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
// (every frame's interval, from the first script on)
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__pf = { on: false, t: [], last: 0 };
  (function loop(t) { const P = window.__pf; if (P.on && P.last) P.t.push(t - P.last); P.last = t; requestAnimationFrame(loop); })(performance.now());` });

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const out = { preset: PRESET, res: `${W}x${H}`, date: new Date().toISOString(), commit: null, gpu: null, worlds: [] };
try { out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { /* not a checkout */ }

for (const world of WORLDS) {
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0, showFps: false }));
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
  errors.length = 0;
  const t0 = Date.now();
  await send('Page.navigate', { url: `${BASE}?level=${world}` });
  let load = null;
  for (let i = 0; i < 1200; i++) { if (await ev('!!window.__moebiusBooted && !!window.player && !!window.renderer')) { load = Date.now() - t0; break; } await sleep(100); }
  if (load === null) { out.worlds.push({ world, error: 'never booted', errors: errors.slice(0, 4) }); console.log(world, 'never booted'); continue; }
  out.gpu ??= await ev(`(() => { const g = window.renderer.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); })()`);
  if (/swiftshader|software|llvmpipe/i.test(out.gpu ?? '')) throw new Error(`Chrome fell back to software rendering (${out.gpu}): numbers would be meaningless`);
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); const p = window.preset?.(); if (p) p.dynamic = null; if (window.sky) { window.sky.hour = 10; window.sky.speed = 0; window.updateSky?.(); }
    if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; } window.story?.closePage?.(); return true; })()`);
  const views = viewsOf(world), rows = [];
  for (const v of views.length ? views : [{ name: 'boot' }]) {
    if (v.eye) await ev(`(() => { const { THREE, camera, player } = window, up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
      const e = new THREE.Vector3(...${JSON.stringify(v.eye)}), t = new THREE.Vector3(...${JSON.stringify(v.target)});
      const pin = { e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov: ${v.fov ?? 55} };
      const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
      camera.updateMatrixWorld = function (f) { this.position.copy(pin.e); this.quaternion.copy(pin.q); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } return base.call(this, f); };
      ${v.player ? `player.teleport?.(new THREE.Vector3(...${JSON.stringify(v.player)}), up, new THREE.Vector3(0, 0, 1)); player.heading = ${v.heading ?? 0};` : ''} return true; })()`);
    await sleep(WARM * 1000);
    await ev('(() => { window.__pf.t = []; window.__pf.on = true; return true; })()');
    await sleep(SECS * 1000);
    const r = await ev(`(() => { const P = window.__pf; P.on = false; const i = window.renderer.info, m = performance.memory;
      return { t: P.t, calls: i.render.calls, tris: i.render.triangles, programs: i.programs?.length ?? null, heap: m ? Math.round(m.usedJSHeapSize / 2 ** 20) : null }; })()`);
    const t = r?.t ?? [], med = pct(t, 0.5);
    rows.push({ view: v.name, frames: t.length, ms_median: med && +med.toFixed(2), ms_p95: t.length ? +pct(t, 0.95).toFixed(2) : null, ms_worst: t.length ? +Math.max(...t).toFixed(1) : null,
      fps: med ? +(1000 / med).toFixed(1) : null, calls: r?.calls, tris: r?.tris, programs: r?.programs, heap_mb: r?.heap });
  }
  const row = { world, load_ms: load, views: rows, errors: errors.slice(0, 4) };
  out.worlds.push(row);
  console.log(`${world.padEnd(16)} load ${(load / 1000).toFixed(1)} s · ${rows.map((x) => `${x.view} ${x.fps ?? '?'} fps (p95 ${x.ms_p95} ms, ${x.calls} draws)`).join(' · ')}${row.errors.length ? ` · ${row.errors.length} errors` : ''}`);
}
console.log(`GPU: ${out.gpu} · preset ${PRESET} · ${W}x${H} · commit ${out.commit}`);
const file = arg('out', join(tmpdir(), `perf-${PRESET}-${Date.now()}.json`));
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`written ${file}`);
ws.close(); proc.kill('SIGTERM'); await sleep(1000); rmSync(profile, { recursive: true, force: true });
await new Promise((r) => server.httpServer.close(r));
process.exit(0);
