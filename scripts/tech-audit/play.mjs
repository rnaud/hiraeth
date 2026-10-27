// The technical audit's play recording (docs/audits/technical-v2.28.md; docs/systems/performance.md, "The technical
// audit's play recording"): the shipped bundle (dist/, `npx vite build` first) served on its own port, one MUTED
// headless Chrome on the real GPU (ANGLE on Metal; SwiftShader refused), and per world one scripted minute of play
// with real key presses, every frame recorded with what the GPU process was asked for in it:
//   idle   4 s standing at the arrival, the game's own camera
//   run    14 s running (W + Shift held), the camera swung left and right as a stick would (±0.9 rad/s)
//   spin   standing, the camera turned once all the way round in 240 frames of 1.5° (new things into view: LOD and
//          culling, uploads): by frames, so every build draws the same headings
//   night  3 s at 21:00 (the lamps, the night's passes)
//   storm  3 s in the world's own weather at full strength
//   menu   the pause menu (O) and the journal (J), opened and shut
//   fight  4 s of blade cuts (F) and shots (G)
// Per frame: its interval (uncapped by default: no vsync, no frame-rate limit, so an interval is the frame's work;
// --paced 1 keeps vsync, as a player's Chrome), the callbacks' CPU time, the programs linked and shaders compiled in
// it (a compile mid-play is a hitch), the ms spent in WebGL calls that wait on the GPU process for a program
// (getProgramParameter, getUniformLocation, getShaderParameter: three's first use), texture and buffer bytes
// uploaded, and the long tasks (over 50 ms) with when they ran.
//
//   PORT=5425 node scripts/tech-audit/play.mjs [--preset high|handheld|deck] [--worlds desert,incal] [--res 1280x720]
//        [--paced 1] [--root <a checkout with its dist/ built>] [--query k=v&…] [--shots dir] [--out file.json]
//        [--sweep 12] (then the camera held at 12 headings, 1.5 s each: phases yaw0, yaw30…)
// --shots dir: the same play with a screenshot every 0.25 s of the run and spin (for contact sheets; its timings are
// not measurements: a screenshot stalls the frame).
// The summary (src-free, tested: scripts/tech-audit/stats.mjs) is printed per world and phase: mean and median fps,
// 1% and 0.1% lows, p95/p99/worst ms, frames over 33 and 50 ms, the stutter count (a frame over twice its
// neighbours' median and over 25 ms), programs linked after the first frame.
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, ownProcess } from '../temp-dirs.mjs';
import { INSTRUMENT } from '../bench/browser.mjs';
import { summarize, stutters, blame } from './stats.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PRESET = arg('preset', 'high'), [W, H] = arg('res', '1280x720').split('x').map(Number), PACED = arg('paced', '0') === '1';
const SERVE = resolve(arg('root', ROOT)), SHOTS = arg('shots', null), QUERY = arg('query', ''), CPUPROF = arg('cpuprof', '0') === '1', DIST = arg('dist', 'dist'), WHO = arg('who', '0') === '1', EVAL = arg('eval', null), SWEEP = +arg('sweep', 0);
const PORT = Number(process.env.PORT ?? 5425), CDP = Number(process.env.CDP ?? PORT + 1);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
if (!existsSync(resolve(SERVE, DIST, 'index.html'))) throw new Error(`no ${SERVE}/${DIST}: run \`npx vite build\` first (--dist: another outDir, e.g. an unminified one for --cpuprof)`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const route = await import(join(ROOT, 'src/levels/names.js')), DISC = route.DISCARDED ?? [];
const WORLDS = (arg('worlds') ?? [...new Set([...(route.ORDER ?? []), 'home'])].filter((w) => !DISC.includes(w)).join(',')).split(',').filter(Boolean);

// (what the GPU process is asked for, frame by frame: wrapped before the page's own scripts)
const GLPROBE = `(() => {
  const B = window.__bench; const G = window.__glp = { link: 0, comp: 0, waitMs: 0, tex: 0, buf: 0, rows: [], longs: [] };
  const P = WebGL2RenderingContext.prototype;
  const wrapCount = (name, f) => { const o = P[name]; P[name] = function (...a) { f(a); return o.apply(this, a); }; };
  wrapCount('linkProgram', () => { G.link++; if (B.rec && G.cur) (G.who ??= []).push(G.cur()); if (B.rec) (G.stacks ??= []).push((((Error.stackTraceLimit = 40), new Error()).stack ?? '').split(String.fromCharCode(10)).slice(2, 30).map((l) => l.trim().replace(/[(]?https?:[/][/][^/]+[/](assets[/])?/, '(')).join(' < ')); });
  wrapCount('compileShader', () => { G.comp++; });
  for (const n of ['getProgramParameter', 'getShaderParameter', 'getUniformLocation', 'getProgramInfoLog', 'getActiveUniform']) {
    const o = P[n]; P[n] = function (...a) { const t = performance.now(); try { return o.apply(this, a); } finally { G.waitMs += performance.now() - t; } };
  }
  const bytes = (a) => { for (const x of a) if (x && x.byteLength) return x.byteLength; const w = a.find((x) => typeof x === 'number' && x > 4), i = a.indexOf(w); return w && typeof a[i + 1] === 'number' ? w * a[i + 1] * 4 : 0; };
  for (const n of ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'compressedTexImage2D']) wrapCount(n, (a) => { G.tex += bytes(a); });
  // (a big upload mid-play, over 1 MB: where from, its stack kept as a link's is)
  const stackOf = () => { Error.stackTraceLimit = 40; return (new Error().stack ?? '').split(String.fromCharCode(10)).slice(3, 30).map((l) => l.trim().replace(/[(]?https?:[/][/][^/]+[/](assets[/])?/, '(')).join(' < '); };
  for (const n of ['bufferData', 'bufferSubData']) wrapCount(n, (a) => { const d = n === 'bufferData' ? a[1] : a[2], e = d?.BYTES_PER_ELEMENT ?? 1;
    const b = typeof d === 'number' ? d : n === 'bufferData' ? (d?.byteLength ?? 0) : a[4] ? a[4] * e : (d?.byteLength ?? 0) - (a[3] ?? 0) * e; G.buf += b; if (b > 1e6 && B.rec) (G.big ??= []).push([n, b, stackOf()]); });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) G.longs.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  // one row a frame, in step with __bench.frames: taken at the start of the next frame, for the frame before
  const raf = window.requestAnimationFrame;
  let last = -1;
  window.requestAnimationFrame = (cb) => raf((ts) => {
    if (ts !== last) {
      if (last >= 0 && B.rec) {
        // (a program linked: which, by three's names of the programs it holds, new since the last frame)
        let names = null;
        if (G.link) { const ps = window.renderer?.info?.programs ?? []; names = ps.slice(G.nprog ?? ps.length).map((p) => p.name || p.cacheKey?.slice(0, 40)); }
        G.rows.push([G.link, G.comp, +G.waitMs.toFixed(2), G.tex, G.buf, G.phase ?? '', +(last - (G.t0 ?? 0)).toFixed(1), names, G.mark ?? 0]);
      }
      G.nprog = window.renderer?.info?.programs?.length; G.link = G.comp = G.waitMs = G.tex = G.buf = G.mark = 0; last = ts;
    }
    return cb(ts);
  });
})();`;

const { preview } = await import(join(SERVE, 'node_modules/vite/dist/node/index.js'));
const server = await preview({ root: SERVE, configFile: join(SERVE, 'vite.config.js'), logLevel: 'error', build: { outDir: DIST }, preview: { port: PORT, strictPort: true, host: '127.0.0.1' } });
const BASE = `http://127.0.0.1:${PORT}/`;
const profile = tempDir('tech-audit-chrome-');
const proc = ownProcess(spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(PACED ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']),
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-precise-memory-info', '--disable-features=BackForwardCache', '--no-first-run', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' }));
const bail = (e) => { if (e instanceof Error) console.error(e); server.httpServer.close(() => process.exit(1)); setTimeout(() => process.exit(1), 2000).unref(); };
process.on('uncaughtException', bail); process.on('unhandledRejection', bail); process.on('SIGINT', bail); process.on('SIGTERM', bail);
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
if (!tabs) throw new Error(`Chrome did not start (debugging port ${CDP})`);
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), errors = [], consoleLines = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled') { const t = (d.params.args ?? []).map((a) => a.value ?? '').join(' '); if (/^(late surfaces|passage warm-up|shaders:|load: total)/.test(t)) consoleLines.push(t.slice(0, 200)); }
  if (d.method === 'Runtime.exceptionThrown') { const s = d.params.exceptionDetails?.exception?.description ?? ''; if (!s.includes('chrome-extension://')) errors.push(s.slice(0, 200)); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return d.result?.exceptionDetails ? null : d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT + '\n' + GLPROBE });

const KEYS = { KeyW: ['w', 87], ShiftLeft: ['Shift', 16], KeyF: ['f', 70], KeyG: ['g', 71], KeyO: ['o', 79], KeyJ: ['j', 74], Escape: ['Escape', 27] };
const key = (code, type) => send('Input.dispatchKeyEvent', { type, code, key: KEYS[code][0], windowsVirtualKeyCode: KEYS[code][1], modifiers: code === 'ShiftLeft' && type === 'keyDown' ? 8 : 0 });
const tap = async (code, hold = 90) => { await key(code, 'keyDown'); await sleep(hold); await key(code, 'keyUp'); };
let curWorld = '';
const snap = async (name) => { if (!SHOTS) return; const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); if (r.result?.data) writeFileSync(join(SHOTS, `${curWorld}-phase-${name}.jpg`), Buffer.from(r.result.data, 'base64')); };
const phase = async (p) => { await snap(p); return phaseMark(p); };
const phaseMark = (p) => ev(`window.__glp.phase = ${JSON.stringify(p)}; window.__glp.marks = (window.__glp.marks ?? []); window.__glp.marks.push([${JSON.stringify(p)}, performance.now()]); true`);
let commit = null; try { commit = execSync('git rev-parse --short HEAD', { cwd: SERVE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a checkout */ }
const out = { preset: PRESET, res: `${W}x${H}`, paced: PACED, query: QUERY, date: new Date().toISOString(), commit, gpu: null, load: (await import('node:os')).loadavg(), worlds: [] };

// the camera swung by a stick: a per-frame hook (__bench.pre) turns the rig, so the run curves as a player's would
const swing = (rate, kind) => ev(`(() => { const r = window.rig; let t0 = null, p = null; window.__bench.pre = (ts) => { if (t0 === null) { t0 = ts; p = ts; }
  const dt = Math.min(0.1, (ts - p) / 1000), t = (ts - t0) / 1000; p = ts;
  r.yaw += ${kind === 'spin' ? `${rate}` : `${rate} * Math.sin(t * 1.3)`} * dt; }; return true; })()`);
const still = () => ev('window.__bench.pre = null; true');
let shotN = 0;
async function shoot(world, ms) {
  if (!SHOTS) return sleep(ms);
  const end = Date.now() + ms;
  while (Date.now() < end) { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); if (r.result?.data) writeFileSync(join(SHOTS, `${world}-${String(shotN++).padStart(4, '0')}.jpg`), Buffer.from(r.result.data, 'base64')); await sleep(250); }
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

for (const world of WORLDS) {
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted','1');
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0, soundV: 1, volume: 0, showFps: false }));
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'item.blade': true, 'item.gun': true, 'items.v': 2 }, keepsakes: [] })); true`);
  errors.length = 0; consoleLines.length = 0; shotN = 0; curWorld = world;
  const t0 = Date.now();
  await send('Page.navigate', { url: `${BASE}?level=${world}${QUERY ? `&${QUERY}` : ''}` });
  let load = null;
  for (let i = 0; i < 1200; i++) { if (await ev('!!window.__hiraethBooted && !!window.player && !!window.renderer')) { load = Date.now() - t0; break; } await sleep(100); }
  if (load === null) { out.worlds.push({ world, error: 'never booted', errors: errors.slice(0, 4) }); console.log(world, 'never booted'); continue; }
  out.gpu ??= await ev(`(() => { const g = window.renderer.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); })()`);
  if (/swiftshader|software|llvmpipe/i.test(out.gpu ?? '')) throw new Error(`software rendering (${out.gpu})`);
  // muted, a fixed morning, clear sky; the dynamic resolution off (its steps would be the measure's own noise)
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); const p = window.preset?.(); if (p) p.dynamic = null; if (window.sky) { window.sky.hour = 10; window.sky.speed = 0; window.updateSky?.(); }
    if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; } window.story?.closePage?.(); window.dialogue?.close?.(); return true; })()`);
  // (which object a program is linked for: three's renderBufferDirect, an instance method, wrapped)
  if (WHO) await ev(`(() => { const R = window.renderer, G = window.__glp, o = R.renderBufferDirect; R.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
    G.cur = () => ({ obj: obj?.name || obj?.type, parent: obj?.parent?.name || obj?.parent?.type, grand: obj?.parent?.parent?.name, mat: mat?.name || mat?.type, matId: mat?.id, attrs: Object.keys(geo?.attributes ?? {}).join(','), inst: !!obj?.isInstancedMesh, skinned: !!obj?.isSkinnedMesh, batched: !!obj?.isBatchedMesh, inScene: (() => { let p = obj; while (p?.parent) p = p.parent; return p === window.scene; })(), target: R.getRenderTarget()?.texture?.name ?? (R.getRenderTarget() ? 'rt' : 'canvas'), override: !!sc?.overrideMaterial });
    try { return o.apply(this, arguments); } finally { G.cur = null; } }; return true; })()`);
  // (--eval file: a probe of one's own, run once the world is up; whatever it leaves in window.__probe is kept, and what
  // it counts in window.__glp.mark is kept a frame: `mark` on each frame)
  if (EVAL) await ev(readFileSync(EVAL, 'utf8'));
  const p0 = await ev('window.renderer.info.programs.length');
  await ev('(() => { window.__bench.reset(); window.__glp.rows = []; window.__glp.longs = []; window.__glp.marks = []; window.__glp.t0 = performance.now(); window.__bench.rec = true; return true; })()');
  let prof0 = null;
  if (CPUPROF) { await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 250 }); await send('Profiler.start'); prof0 = await ev('performance.now() - window.__glp.t0'); }
  await phase('idle'); await shoot(world, 4000);
  await phase('run'); await swing(0.9, 'sway'); await key('ShiftLeft', 'keyDown'); await key('KeyW', 'keyDown');
  await shoot(world, 14000);
  await key('KeyW', 'keyUp'); await key('ShiftLeft', 'keyUp'); await still();
  // (the turn by frames, not by time: 240 frames of 1.5° each, so every build draws the same headings, however long a
  // frame takes; by time, a hitch skipped the headings after it and a slower build drew fewer of the costly ones)
  await phase('spin'); await ev(`(() => { const r = window.rig; let k = 0; window.__spun = false; window.__bench.pre = () => { if (k < 240) { r.yaw += Math.PI / 120; k++; } else window.__spun = true; }; return true; })()`);
  { const t0 = Date.now(); if (SHOTS) await shoot(world, 3000); while (!(await ev('window.__spun')) && Date.now() - t0 < 30000) await sleep(100); }
  await still();
  await phase('night'); await ev('window.sky.hour = 21; window.updateSky?.(); true'); await sleep(3000);
  await ev('window.sky.hour = 10; window.updateSky?.(); true');
  await phase('storm'); const kind = await ev('(() => { const w = window.weather, k = w?.kinds?.[0]; if (!k) return null; w.mode = k; w.kind = k; w.intensity = 1; w.target = 1; return k; })()'); await sleep(3000);
  await ev("(() => { const w = window.weather; if (w) { w.mode = 'clear'; w.intensity = 0; } return true; })()");
  // (shut with Escape while anything pauses the game: the menu's own keys toggle differently by page)
  const shut = async () => { for (let i = 0; i < 4 && await ev('window.paused?.()'); i++) { await tap('Escape'); await sleep(400); } };
  await phase('menu'); await tap('KeyO'); await sleep(1500); await shut();
  await tap('KeyJ'); await sleep(1500); await shut(); await sleep(400);
  await phase('fight'); for (let i = 0; i < 6; i++) { await tap('KeyF', 60); await sleep(350); } for (let i = 0; i < 3; i++) { await tap('KeyG', 60); await sleep(300); }
  await sleep(800);
  // (--sweep n: then the camera held at n headings round the traveller, 1.5 s each (phases yaw0, yaw30…): what each
  // direction costs once everything in it has been seen, apart from the turn's own first sights)
  if (SWEEP) { const y0 = await ev('window.rig.yaw'); for (let k = 0; k < SWEEP; k++) { const deg = Math.round(k * 360 / SWEEP);
    await ev(`window.rig.yaw = ${y0} + ${deg} * Math.PI / 180; true`); await sleep(300); await phase(`yaw${deg}`); await sleep(1500); } }
  await snap('end');
  const r = await ev(`(() => { const B = window.__bench, G = window.__glp; B.rec = false; B.pre = null;
    return { t: B.frames, cpu: B.cpu, rows: G.rows, longs: G.longs.filter((x) => x[0] >= G.t0).map((x) => [+(x[0] - G.t0).toFixed(1), +x[1].toFixed(1)]), marks: G.marks.map((m) => [m[0], +(m[1] - G.t0).toFixed(1)]),
      programs: window.renderer.info.programs.length, calls: B.calls, stacks: G.stacks ?? [], who: G.who ?? [], big: (G.big ?? []).slice(0, 12), probe: window.__probe ?? null }; })()`);
  // the programs linked in play: which objects use them (their names, materials and parents), to find what the load's
  // warm-up missed (src/warm-shaders.js programKind)
  const late = await ev(`(() => { const R = window.renderer, ps = R.info.programs.slice(${p0}), keys = new Set(ps.map((p) => p.cacheKey)), out = [];
    window.scene.traverse((o) => { for (const m of [o.material].flat().filter(Boolean)) { const pr = R.properties.get(m)?.currentProgram;
      if (pr && keys.has(pr.cacheKey)) out.push({ obj: o.name || o.type, parent: o.parent?.name || o.parent?.type, mat: m.name || m.type, visible: o.visible, layers: o.layers?.mask, inst: !!o.isInstancedMesh, skinned: !!o.isSkinnedMesh, batched: !!o.isBatchedMesh, prog: pr.name }); } });
    return { programs: ps.map((p) => p.name), users: out.slice(0, 30) }; })()`);
  const n = Math.min(r.t.length, r.rows.length);
  const frames = Array.from({ length: n }, (_, i) => ({ ms: +r.t[i].toFixed(2), cpu: +(r.cpu[i] ?? 0).toFixed(2), link: r.rows[i][0], comp: r.rows[i][1], wait: r.rows[i][2], tex: r.rows[i][3], buf: r.rows[i][4], phase: r.rows[i][5], at: r.rows[i][6], ...(r.rows[i][7] ? { programs: r.rows[i][7] } : {}), ...(r.rows[i][8] ? { mark: r.rows[i][8] } : {}) }));
  // (with --cpuprof: what ran in each stutter, by the functions' own time in its window)
  let blamed = null;
  if (CPUPROF) { const pr = (await send('Profiler.stop')).result?.profile; await send('Profiler.disable');
    if (pr) blamed = stutters(frames.map((f) => f.ms)).map((i) => ({ i, at: frames[i].at, ms: frames[i].ms, phase: frames[i].phase, top: blame(pr, prof0, frames[i].at, frames[i].at + frames[i].ms) })); }
  const row = { world, load_ms: load, console: [...consoleLines], late, linkStacks: r.stacks, linkedFor: r.who, bigUploads: r.big, probe: r.probe, blamed, weather: kind, programs_at_start: p0, programs_at_end: r.programs, longs: r.longs, marks: r.marks, summary: summarize(frames), frames, errors: errors.slice(0, 4) };
  out.worlds.push(row);
  const s = row.summary.all;
  console.log(`${world.padEnd(12)} load ${(load / 1000).toFixed(1)} s · ${s.frames} frames · ${s.fps_mean} fps mean · 1% low ${s.low1_fps} · p99 ${s.p99} ms · worst ${s.worst} ms · >50 ms ${s.over50} · stutters ${s.stutters} · programs +${r.programs - p0} (${s.links} links in play) · long tasks ${r.longs.length}${row.errors.length ? ` · ${row.errors.length} errors` : ''}`);
  for (const [p, v] of Object.entries(row.summary.phases)) console.log(`   ${p.padEnd(6)} ${v.fps_mean} fps · 1% ${v.low1_fps} · p99 ${v.p99} · worst ${v.worst} · links ${v.links} · stutters ${v.stutters}`);
}
out.load_after = (await import('node:os')).loadavg();
const file = arg('out', join(tmpdir(), `tech-play-${PRESET}-${Date.now()}.json`));
writeFileSync(file, JSON.stringify(out));
console.log(`GPU ${out.gpu} · ${PRESET} · ${W}x${H}${PACED ? ' paced' : ' uncapped'} · commit ${commit} · load ${out.load.map((x) => x.toFixed(1)).join('/')} → ${out.load_after.map((x) => x.toFixed(1)).join('/')} · written ${file}`);
ws.close(); proc.kill('SIGTERM'); await sleep(1000); rmSync(profile, { recursive: true, force: true });
await new Promise((r) => server.httpServer.close(r));
process.exit(0);
