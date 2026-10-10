// The performance audit's frame and load numbers on this Mac (.claude/skills/perf-audit/SKILL.md): the
// production build (dist/, `npx vite build` first) served on its own port, a MUTED headless Chrome on the
// real GPU (ANGLE on Metal; the renderer string is checked and SwiftShader refused), no vsync and no frame-rate
// limit, so a frame's interval is its work. Per world: the load (navigation to the game booted), then at
// each benchmark view (scripts/bench/viewpoints.json for the desert, viewpoints-worlds.json for the rest,
// the boot camera elsewhere) the frame intervals, the CPU time of the frame's callbacks and the GPU time
// (scripts/bench/browser.mjs INSTRUMENT, EXT_disjoint_timer_query_webgl2 where Chrome has it), the draw calls and
// triangles (the median frame's and the busiest's, every shadow map redrawn), shader programs (and any compiled while recording: a hitch), and the JS heap after a collection.
// Then the rooms a player spends time in (--extras, on by default): inside the temple's door and in its first
// room, at a shop's counter, with the game's own camera following the traveller; and the Arena (world `arena`)
// with the whole roster (every archetype, its home skin) standing in front of the camera.
//
//   node .claude/skills/perf-audit/fps.mjs [--preset high|handheld|deck|low] [--worlds desert,incal,arena] [--secs 6]
//        [--warmup 2] [--res 1280x720] [--extras 0] [--root <a checkout with its dist/ built>] [--out file.json]
//        PORT (default 5492; Chrome's is PORT + 1)
// --root measures another build (an older commit's `git archive` with its own dist/) with this checkout's views,
// for an A/B in one session.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTRUMENT } from '../../../scripts/bench/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PRESET = arg('preset', 'high'), SECS = +arg('secs', 6), WARM = +arg('warmup', 2), [W, H] = arg('res', '1280x720').split('x').map(Number);
const EXTRAS = arg('extras', '1') !== '0', SERVE = resolve(arg('root', ROOT));
const PORT = Number(process.env.PORT ?? 5492), CDP = PORT + 1;
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
if (!existsSync(join(SERVE, 'dist/index.html'))) throw new Error(`no ${SERVE}/dist: run \`npx vite build\` first (the audit measures the shipped bundle)`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VW = JSON.parse(readFileSync(join(ROOT, 'scripts/bench/viewpoints-worlds.json'), 'utf8')).worlds;
const VD = JSON.parse(readFileSync(join(ROOT, 'scripts/bench/viewpoints.json'), 'utf8')).views;
const route = await import(join(ROOT, 'src/levels/names.js')), ids = [...(route.ORDER ?? []), ...(route.SIDE ?? []), 'home', 'lantern', 'arena'];
const WORLDS = (arg('worlds') ?? [...new Set(ids)].join(',')).split(',').filter(Boolean);
const viewsOf = (id) => (id === 'desert' ? VD : VW[id]?.views ?? []).filter((v) => v.eye && v.target).slice(0, 4);
// the Arena's pack: every archetype of the roster (src/enemies/archetypes.js), each in its home skin
const ROSTER = ['crab', 'skitter', 'centipede', 'toad', 'lizard', 'heron', 'roller', 'rootknot', 'jelly', 'moth', 'ray', 'worm', 'tripod', 'cart', 'bell', 'drone', 'brute', 'blot', 'shade', 'hound', 'marionette'];

const { preview } = await import(join(SERVE, 'node_modules/vite/dist/node/index.js'));
const server = await preview({ root: SERVE, configFile: join(SERVE, 'vite.config.js'), logLevel: 'error', preview: { port: PORT, strictPort: true, host: '127.0.0.1' } });
const BASE = `http://127.0.0.1:${PORT}/`;

const profile = mkdtempSync(join(tmpdir(), 'perf-audit-chrome-'));
// (no back-forward cache: each world's page let go when the next loads, so the heap is that world's, not the run's)
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-precise-memory-info', '--disable-features=BackForwardCache', '--no-first-run', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
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
// (every frame's interval, its callbacks' CPU time and its GPU time, from the first script on)
await send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT });

const pct = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const r2 = (x) => (x == null ? null : +x.toFixed(2));
const out = { preset: PRESET, res: `${W}x${H}`, date: new Date().toISOString(), commit: null, root: SERVE, gpu: null, timer: null, worlds: [] };
try { out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: SERVE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a checkout */ }

/** Measure what is on screen now: SECS of frames after WARM of warm-up. */
async function record(name) {
  await sleep(WARM * 1000);
  const p0 = await ev('window.renderer.info.programs?.length ?? null');
  await ev('(() => { window.__bench.reset(); window.__bench.rec = true; return true; })()');
  await sleep(SECS * 1000);
  const r = await ev(`(() => { const B = window.__bench; B.rec = false; const i = window.renderer.info;
    return { t: B.frames, cpu: B.cpu, gpu: B.gpu, callsAll: B.calls, trisAll: B.tris, programs: i.programs?.length ?? null,
      geometries: i.memory.geometries, textures: i.memory.textures, timer: !!B.ext }; })()`);
  await send('HeapProfiler.collectGarbage');
  const heap = await ev('performance.memory ? Math.round(performance.memory.usedJSHeapSize / 2 ** 20) : null');
  const t = r?.t ?? [], med = pct(t, 0.5);
  out.timer ??= r?.timer ?? null;
  return { view: name, frames: t.length, ms_median: r2(med), ms_p95: r2(pct(t, 0.95)), ms_worst: t.length ? +Math.max(...t).toFixed(1) : null,
    fps: med ? +(1000 / med).toFixed(1) : null, cpu_ms: r2(pct(r?.cpu ?? [], 0.5)), gpu_ms: r2(pct((r?.gpu ?? []).filter((x) => x > 0), 0.5)),   // (ANGLE on Metal reports 0 for some frames' queries: left out)
   
    // (draws and triangles over the frames recorded: the median frame, and the busiest, when every shadow map is drawn again)
    calls: r?.callsAll?.length ? Math.max(...r.callsAll) : null, calls_med: pct(r?.callsAll ?? [], 0.5), tris: r?.trisAll?.length ? Math.max(...r.trisAll) : null, tris_med: pct(r?.trisAll ?? [], 0.5),
    programs: r?.programs, new_programs: p0 != null && r?.programs != null ? r.programs - p0 : null,
    geometries: r?.geometries, textures: r?.textures, heap_mb: heap };
}
const unpin = `delete window.camera.updateMatrixWorld;`;
/** Put the traveller at a spot (an exact one: inside a room) with the game's own camera behind; false if there is none. */
const stand = (expr) => ev(`(() => { const { THREE, player, level } = window; ${unpin}
  const s = (${expr}); if (!s || !s.pos) return false; const p = s.pos.isVector3 ? s.pos.clone() : new THREE.Vector3(...s.pos);
  if (player.ride) player.dismount?.(true);
  player.teleport(p, level.gravityAt?.(p)?.clone?.() ?? new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); player.heading = s.heading ?? 0; player.vel?.set(0, 0, 0);
  if (window.rig) { window.rig.yaw = 0; window.rig.pitch = 0.25; } return true; })()`);

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
  const views = world === 'arena' ? [] : viewsOf(world), rows = [];
  for (const v of views.length || world === 'arena' ? views : [{ name: 'boot' }]) {
    if (v.eye) await ev(`(() => { const { THREE, camera, player } = window, up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
      const e = new THREE.Vector3(...${JSON.stringify(v.eye)}), t = new THREE.Vector3(...${JSON.stringify(v.target)});
      const pin = { e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov: ${v.fov ?? 55} };
      const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
      camera.updateMatrixWorld = function (f) { this.position.copy(pin.e); this.quaternion.copy(pin.q); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } return base.call(this, f); };
      ${v.player ? `player.teleport?.(new THREE.Vector3(...${JSON.stringify(v.player)}), up, new THREE.Vector3(0, 0, 1)); player.heading = ${v.heading ?? 0};` : ''} return true; })()`);
    rows.push(await record(v.name));
  }
  if (world === 'arena') {
    // the whole roster in rows in front of the traveller, standing and posed each frame (the Arena's waves stopped)
    const made = await ev(`(() => { const { THREE, camera, player, foes } = window; ${unpin}
      const P = player.pos.clone(), f = new THREE.Vector3(Math.sin(player.heading ?? 0), 0, Math.cos(player.heading ?? 0)), r = new THREE.Vector3(f.z, 0, -f.x);
      foes.update = () => { for (const x of foes.list) foes.look(x, 1 / 60); };
      for (const x of [...foes.list]) foes.remove(x);
      const ids = ${JSON.stringify(ROSTER)}, made = [];
      ids.forEach((id, i) => { const at = P.clone().addScaledVector(f, 7 + (i % 3) * 2.4).addScaledVector(r, Math.floor(i / 3) * 2.2 - 6.6);
        try { const x = foes.add(id, at); if (x) { x.heading = Math.atan2(-f.x, -f.z); x.provoked = true; foes.look(x, 0); made.push(id); } } catch { /* not in this build */ } });
      const eye = P.clone().addScaledVector(f, -3).add(new THREE.Vector3(0, 3.6, 0)), at = P.clone().addScaledVector(f, 9).add(new THREE.Vector3(0, 0.8, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new THREE.Vector3(0, 1, 0)));
      const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
      camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); return base.call(this, force); };
      return made.length; })()`);
    rows.push({ ...(await record('pack')), pack: made });
  } else if (EXTRAS) {
    // inside the temple's door, then its first room's mark (src/world-debug.js gatherPoints reads the same)
    if (await stand('level.temple?.arrival')) rows.push(await record('temple'));
    if (await stand('(() => { const m = level.temple?.marks?.[0]; return m && { pos: m.spot ?? m.pos, heading: m.heading }; })()')) rows.push(await record('temple-room'));
    if (await stand('(() => { const s = (level.shops ?? []).find((x) => x.counter?.at); return s && { pos: s.counter.at, heading: Math.PI }; })()')) rows.push(await record('shop'));
  }
  const row = { world, load_ms: load, views: rows, errors: errors.slice(0, 4) };
  out.worlds.push(row);
  console.log(`${world.padEnd(16)} load ${(load / 1000).toFixed(1)} s · ${rows.map((x) => `${x.view} ${x.fps ?? '?'} fps (p95 ${x.ms_p95}, cpu ${x.cpu_ms}, gpu ${x.gpu_ms} ms, ${x.calls} draws, ${x.programs} progs)`).join(' · ')}${row.errors.length ? ` · ${row.errors.length} errors` : ''}`);
}
console.log(`GPU: ${out.gpu} · timer query ${out.timer} · preset ${PRESET} · ${W}x${H} · commit ${out.commit}`);
const file = arg('out', join(tmpdir(), `perf-${PRESET}-${Date.now()}.json`));
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`written ${file}`);
ws.close(); proc.kill('SIGTERM'); await sleep(1000); rmSync(profile, { recursive: true, force: true });
await new Promise((r) => server.httpServer.close(r));
process.exit(0);
