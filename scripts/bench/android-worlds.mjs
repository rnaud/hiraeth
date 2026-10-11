// Every world on the handheld, in GeckoView (the app's engine): the GeckoView test app
// (com.rnaud.moebius.gecko, scripts/bench/gecko-apk.sh), driven through the page itself (gecko-bridge.mjs),
// Handheld preset (docs/systems/performance.md, "Every world on the Retroid, in GeckoView").
//   node scripts/bench/android-worlds.mjs --serve dist [--worlds desert,incal,...] [--modes fixed,dynamic]
//        [--secs 10] [--warmup 3] [--only spawn,crowd] [--raw dir] [--port 6253] [--startC 48]
//        [--profile 1]            the main thread's time per frame by system (a few seconds more per view)
//        [--toggles base,noShadow,...]   in-page A/B of what the GPU and CPU spend (each renderFrame() timed
//                                 in a synced loop, each toggle between two base runs)
//        [--apk 1]                the game from the APK (its own server on http://127.0.0.1:6281/)
//        [--pick 1]               choose the views of worlds that have none yet (viewpoints-worlds.json)
//        [--quality handheld]     the Graphics setting to run (auto: what the game picks on the device; high, xbox, ...)
//        [--scale 0.75]           the render scale to hold (or start from, mode dynamic); 'preset': the preset's own
//        [--foes brute,drone,cart]  those foes stood 7-11 m in front of the traveller (posed every frame, still; the
//                                 world's own foes removed), as scripts/enemy-roster/bench.mjs does; with --spawn 1
//        [--tag name]             added to the result's file name
//        [--spawn 1]              the world as booted instead of its views: the boot camera held, then 40 m walked on
// Per world: the app started afresh, the world loaded (navigation to the first frame), the memory of the
// app's three processes (its content process, where the page runs; its GPU process, where WebGL runs
// remoted; the parent), then every view of the world (viewpoints-worlds.json; the desert's are
// viewpoints.json's views and paths) placed, warmed up and recorded with the page logic of the other runs
// (web-page.mjs): frame intervals, missed 60 Hz refreshes, the JS time of the animation-frame callbacks,
// draw calls and triangles; between recordings the GPU's busy share and clock (kgsl), temperatures, the
// processes' CPU and memory and, in mode `dynamic`, the render scale the game chose. The game's own frame
// readout (F) stays on for whoever watches the device; the game's sound is at 0.
// Device rules: only com.rnaud.moebius.gecko is started and stopped, never com.rnaud.moebius (the player's
// app) nor a system setting; only this script's own port rules are added and removed.
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { options, viewpoints, sleep, ROOT, stats } from './lib.mjs';
import { INSTRUMENT } from './browser.mjs';
import { conditions, runAll } from './web-page.mjs';
import { thermal, ADB } from '../handheld-perf/lib.mjs';
import { Bridge, GeckoPage } from './gecko-bridge.mjs';
import { staticHandler } from './serve.mjs';

const opt = options();
const GPKG = 'com.rnaud.moebius.gecko', GACTIVITY = `${GPKG}/com.rnaud.memento.gecko.MainActivity`;
const PORT = +(opt.port ?? 6253), BASE = `http://localhost:${PORT}/`, APK_BASE = 'http://127.0.0.1:6281/';
const apk = opt.apk === '1' || opt.apk === true;
const ORIGIN = apk ? APK_BASE : BASE;
const VP = viewpoints();
const VIEWS = resolve(ROOT, String(opt.views ?? 'scripts/bench/viewpoints-worlds.json'));
const secs = +(opt.secs ?? VP.secs), warmup = +(opt.warmup ?? VP.warmup);
const modes = String(opt.modes ?? 'fixed').split(',');
const WORLDS = String(opt.worlds ?? 'desert,incal,bazaar,arzach,arzach2,garage,buried,edena,spheres,perdide,perdide2,home').split(',');
const only = typeof opt.only === 'string' ? opt.only.split(',') : null;
const toggles = typeof opt.toggles === 'string' ? opt.toggles.split(',') : null;
const startC = +(opt.startC ?? 48);
const QUALITY = String(opt.quality ?? 'handheld');
const SCALE = opt.scale === 'preset' ? 'preset' : +(opt.scale ?? 0.75);
const RAW = resolve(opt.raw ?? `${ROOT}/scripts/bench/results/raw/android-worlds-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`);
mkdirSync(RAW, { recursive: true });

// ------------------------------------------------------------------ adb, guarded
function adb(args, { quiet = false } = {}) {
  const line = args.join(' ');
  if (/com\.rnaud\.moebius(?![.\w])/.test(line)) throw new Error(`refusing to touch the player's app: adb ${line}`);
  if (/\b(settings\s+put|setprop|pm\s+(clear|uninstall|disable)|uninstall)\b/.test(line)) throw new Error(`refusing: adb ${line}`);
  try { return execFileSync(ADB[0], [...ADB.slice(1), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'pipe'] }); } catch (e) { return String(e.stdout ?? ''); }
}
const sh = (cmd) => adb(['shell', cmd], { quiet: true });
const stopApp = () => adb(['shell', 'am', 'force-stop', GPKG]);

/** the GPU's busy share and clock once a second (Qualcomm kgsl, read-only) */
function gpuSampler() {
  const kid = spawn(ADB[0], [...ADB.slice(1), 'shell', 'while true; do echo $(cat /sys/class/kgsl/kgsl-3d0/gpu_busy_percentage) $(cat /sys/class/kgsl/kgsl-3d0/devfreq/cur_freq); sleep 1; done']);
  let rows = [], buf = '';
  kid.stdout.on('data', (d) => { buf += d; const ls = buf.split('\n'); buf = ls.pop(); for (const l of ls) { const m = l.match(/(\d+)\s*%\s+(\d+)/); if (m) rows.push([+m[1], +m[2] / 1e6]); } });
  const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null);
  return { reset() { rows = []; }, take() { const r = { gpuBusy: med(rows.map((x) => x[0])), gpuMHz: med(rows.map((x) => x[1])) }; rows = []; return r; }, stop() { kid.kill(); } };
}
/** GeckoView's processes: the parent (the app), its GPU process, its content processes */
function processes() {
  const list = [];
  for (const l of sh('ps -A -o PID,NAME').split('\n')) {
    const m = l.trim().match(/^(\d+)\s+(\S+)$/); if (!m) continue;
    const [pid, name] = [+m[1], m[2]];
    if (name === GPKG) list.push({ pid, role: 'parent' });
    else if (name.startsWith(GPKG + ':gpu')) list.push({ pid, role: 'gpu' });
    else if (name.startsWith(GPKG + ':tab')) list.push({ pid, role: 'tab' });
  }
  return list;
}
const jiffies = (pids) => {
  const r = {};
  for (const l of sh(pids.map((p) => `cat /proc/${p}/stat 2>/dev/null`).join('; ')).split('\n')) { const m = l.match(/^(\d+) \(.*\) \S+ (.*)$/); if (m) { const f = m[2].split(' '); r[+m[1]] = +f[10] + +f[11]; } }
  return r;
};
function meminfo(pid) {
  const out = sh(`dumpsys meminfo ${pid}`);
  const n = (re) => { const m = out.match(re); return m ? +(+m[1] / 1024).toFixed(1) : null; };
  return { pssMB: n(/TOTAL PSS:\s+(\d+)/) ?? n(/TOTAL\s+(\d+)/), graphicsMB: n(/Graphics:\s+(\d+)/), nativeHeapMB: n(/Native Heap:\s+(\d+)/) };
}
/** the busiest content process (the page's) and the others, their memory */
function memory(procs, busy = null) {
  const tabs = procs.filter((p) => p.role === 'tab');
  const tab = busy ? tabs.sort((a, b) => (busy[b.pid] ?? 0) - (busy[a.pid] ?? 0))[0] : tabs[0];
  const gpu = procs.find((p) => p.role === 'gpu'), parent = procs.find((p) => p.role === 'parent');
  const m = { tab: tab ? meminfo(tab.pid) : null, gpu: gpu ? meminfo(gpu.pid) : null, parent: parent ? meminfo(parent.pid) : null };
  m.totalMB = +((m.tab?.pssMB ?? 0) + (m.gpu?.pssMB ?? 0) + (m.parent?.pssMB ?? 0)).toFixed(1);
  return m;
}
const temps = () => { const t = thermal(); return { gpuC: +t['gpuss-0'] / 1000, cpuC: +t['cpu-1-0'] / 1000, batteryC: +t.battery / 1000, thermal: t.Thermal }; };
async function coolDown(label) {
  const t0 = Date.now();
  let t = temps();
  while (t.gpuC > startC && Date.now() - t0 < 6 * 60000) { console.log(`${label}: GPU ${t.gpuC} °C > ${startC}: cooling…`); await sleep(20000); t = temps(); }
  return { ...t, waited: Math.round((Date.now() - t0) / 1000) };
}
export const missedShare = (frames, period = 1000 / 60) => {
  let shown = 0, missed = 0;
  for (const f of frames) { const k = Math.max(1, Math.round(f / period)); shown += k; missed += k - 1; }
  return shown ? +(missed / shown * 100).toFixed(2) : null;
};

// ------------------------------------------------------------------ the page side
// the render scale while recording, sent to the background or not
const EXTRA = `(() => {
  const B = window.__bench, reset = B.reset;
  B.reset = () => { B.scales = []; B.hidden = 0; reset(); };
  B.scales = []; B.hidden = 0;
  setInterval(() => { if (B.rec && window.quality) B.scales.push(window.quality.renderScale); }, 250);
  document.addEventListener('visibilitychange', () => { if (document.hidden) B.hidden++; });
})();`;

/** the storage of the test app's origin: the prologue done, the preset, the frame readout on, every volume at 0 */
const prepare = (ev) => ev((q) => {
  localStorage.clear();
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: q, showFps: true, hudV: 1, music: 0, effects: 0, voices: 0 }));
  localStorage.setItem('moebius.muted', '1');
  return true;
}, QUALITY);

/** views of a world that has none yet: the boot camera, its two densest knots of people, a wide look, a walk */
const pickViews = (ev) => ev(() => {
  const { THREE, camera, player } = window; const r = (a) => a.map((x) => +x.toFixed(2));
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  const start = { name: 'start', player: r(player.pos.toArray()), heading: +player.heading.toFixed(4), eye: r(camera.position.toArray()), target: r(camera.position.clone().addScaledVector(d, 10).toArray()), fov: camera.fov };
  const pts = [];
  for (const n of window.npcs) if (n.object?.visible !== false) pts.push(n.object.getWorldPosition(new THREE.Vector3()));
  for (const p of window.crowd?.people ?? []) pts.push(p.pos.clone());
  const near = (c, R) => pts.filter((p) => p.distanceTo(c) < R).length;
  let best = null, best2 = null;
  for (const p of pts) { const k = near(p, 25); if (!best || k > best.k) best = { c: p, k }; }
  if (best) for (const p of pts) { if (p.distanceTo(best.c) < 60) continue; const k = near(p, 25); if (!best2 || k > best2.k) best2 = { c: p, k }; }
  const views = [start];
  const look = (name, b, dist, up) => {
    const c = b.c, dir = new THREE.Vector3().subVectors(c, player.pos).setY(0); if (dir.lengthSq() < 1) dir.set(0, 0, 1); dir.normalize();
    const eye = c.clone().addScaledVector(dir, -dist); eye.y = c.y + up;
    views.push({ name, player: r(c.clone().addScaledVector(dir, -dist * 0.6).toArray()), heading: +Math.atan2(dir.x, dir.z).toFixed(4), eye: r(eye.toArray()), target: r([c.x, c.y + 1.2, c.z]), fov: 55, people: b.k });
  };
  if (best) look('crowd', best, 14, 4);
  if (best2) look('crowd2', best2, 20, 10);
  const cen = new THREE.Vector3(); for (const p of pts) cen.add(p); if (pts.length) cen.divideScalar(pts.length);
  const eye = camera.position.clone(); eye.y += 25;
  views.push({ name: 'wide', player: start.player, heading: start.heading, eye: r(eye.toArray()), target: r((pts.length ? cen : camera.position.clone().addScaledVector(d, 200)).toArray()), fov: 55 });
  // a walk: 40 m on from the start along the traveller's heading, on the ground, the camera behind
  const up = new THREE.Vector3(0, 1, 0), f = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  const points = [];
  for (let i = 0; i <= 40; i++) {
    const p = player.pos.clone().addScaledVector(f, i);
    const y = window.physics.groundAt?.(p.x, p.y + 30, p.z, 80); if (Number.isFinite(y)) p.y = y + 1.2;
    const e = p.clone().addScaledVector(f, -4.5).addScaledVector(up, 2.2), t = p.clone().addScaledVector(f, 6).addScaledVector(up, 0.6);
    points.push({ p: r(p.toArray()), h: +player.heading.toFixed(4), eye: r(e.toArray()), target: r(t.toArray()) });
  }
  return { views, paths: [{ name: 'walk', note: '40 m on from the start, walking pace', speed: 4, secs: 10, step: 1, fov: 55, points }] };
});

/** the main thread's time per frame by system: the world's updates and the passes of renderFrame() (renderer.render) */
const PROFILE = `(() => {
  if (window.__prof) return true;
  const acc = {}, P = window.__prof = { on: false, acc, frames: 0 };
  const wrap = (name, obj, key) => {
    if (!obj || typeof obj[key] !== 'function' || obj[key].__w) return;
    const f = obj[key];
    const w = function (...a) { if (!P.on) return f.apply(this, a); const t = performance.now(); try { return f.apply(this, a); } finally { acc[name] = (acc[name] || 0) + performance.now() - t; } };
    w.__w = 1; obj[key] = w;
  };
  const W = window;
  for (const [n, o, k] of [['crowd', W.crowd, 'update'], ['player', W.player, 'update'], ['rig', W.rig, 'update'], ['story', W.storyRt, 'update'], ['wind', W.wind, 'update'],
    ['level', W.level, 'update'], ['reactive', W.reactiveWorld, 'update'], ['wildlife', W.wildlife, 'update'], ['waters', W.waters, 'update'], ['sound', W.sound, 'update'],
    ['ship', W.ship, 'update'], ['boxes', W.boxes, 'update'], ['tool', W.tool, 'update'], ['weather', W.weather, 'update'], ['scout', W.scout, 'update'], ['relics', W.relics, 'update'],
    ['storyPages', W.story, 'update'], ['flammables', W.flammables, 'update'], ['errands', W.errands, 'update'], ['sky', W, 'updateSky'],
    ['r.flora', W.flora, 'update'], ['r.grass', W.blades?.grass, 'update'], ['r.lod', W.lod?.(), 'update'], ['r.skinnedLods', W.skinnedLods, 'update'], ['r.interior', W.interiorCull, 'hide'],
    ['r.shadowCull', W.shadowCull, 'begin'], ['r.bloom', W.bloom, 'render'], ['r.waters', W.waters, 'renderOver']]) wrap(n, o, k);
  for (const n of W.npcs) wrap('npcs', n, 'update');
  for (const n of W.npcs) wrap('npcs.balloon', n, 'placeBalloon');
  for (const f of W.flocks ?? []) wrap('flocks', f, 'update');
  for (const v of W.player.vehicles ?? []) wrap('vehicles', v, 'update');
  // the passes, by what they draw
  const R = W.renderer, render = R.render;
  R.render = function (sc, cam) {
    if (!P.on) return render.call(this, sc, cam);
    const k = sc.overrideMaterial ? 'r.pass.shadow' : sc === W.scene ? 'r.pass.gbuffer' : sc === W.post.scene ? 'r.pass.composite' : 'r.pass.other';
    const t = performance.now(); try { return render.call(this, sc, cam); } finally { acc[k] = (acc[k] || 0) + performance.now() - t; }
  };
  return true;
})()`;
const profileView = async (ev, seconds = 4) => {
  await ev(PROFILE);
  await ev(() => { const P = window.__prof; for (const k of Object.keys(P.acc)) delete P.acc[k]; window.__bench.reset(); window.__bench.rec = true; P.on = true; return true; });
  await sleep(seconds * 1000);
  return ev(() => {
    const P = window.__prof, B = window.__bench; P.on = false; B.rec = false;
    const n = B.cpu.length, total = B.cpu.reduce((s, x) => s + x, 0);
    const per = Object.fromEntries(Object.entries(P.acc).map(([k, v]) => [k, +(v / n).toFixed(2)]).sort((a, b) => b[1] - a[1]));
    const sum = Object.entries(P.acc).filter(([k]) => !k.startsWith('r.pass.') || true).reduce((s, [, v]) => s + v, 0);
    return { frames: n, jsPerFrame: +(total / n).toFixed(2), bySystem: per, rest: +((total - sum) / n).toFixed(2) };
  });
};

// in-page A/B: each renderFrame() of a synced loop (closed by a readPixels), each toggle between two base runs
const TOG = {
  base: ['', ''],
  noShadow: ['window.__ev ??= { n: preset().nearEvery, f: preset().farEvery }; preset().nearEvery = preset().farEvery = 1e9', 'preset().nearEvery = window.__ev.n; preset().farEvery = window.__ev.f'],
  noNear: ['window.__ev2 ??= preset().nearEvery; preset().nearEvery = 1e9', 'preset().nearEvery = window.__ev2'],
  noFar: ['window.__ev3 ??= preset().farEvery; preset().farEvery = 1e9', 'preset().farEvery = window.__ev3'],
  noCrowd: ['window.__cr ??= { ...crowd.range }; crowd.range.far = 0', 'Object.assign(crowd.range, window.__cr)'],
  noNpc: ['npcs.forEach((n) => { if (n.object.visible) { n.__h = 1; n.object.visible = false; } })', 'npcs.forEach((n) => { if (n.__h) { n.object.visible = true; n.__h = 0; } })'],
  noPlayer: ['window.__pv = player.object?.visible ?? player.mesh?.visible; (player.object ?? player.mesh).visible = false', '(player.object ?? player.mesh).visible = true'],
  noFlora: ['window.__ff ??= preset().floraFar; preset().floraFar = 0.0001', 'preset().floraFar = window.__ff'],
  noWind: ['wind.scene.visible = false', 'wind.scene.visible = true'],
  noBloom: ['window.__br ??= bloom.render; bloom.render = () => {}', 'bloom.render = window.__br'],
  postAlbedo: ['post.uniforms.uDebug.value = 2', 'post.uniforms.uDebug.value = 0'],
  noSpot: ['window.__sp ??= post.uniforms.uSpot.value; post.uniforms.uSpot.value = [0, 3, 0.3, 0.2]', 'post.uniforms.uSpot.value = window.__sp'],
  scale05: ['window.__sc ??= quality.renderScale; quality.renderScale = window.__sc * 0.5; resize()', 'quality.renderScale = window.__sc; resize()'],
  noWear: ['window.__we ??= (() => { const l = []; scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) if (m.uniforms?.uWeather?.value > 0) l.push([m, m.uniforms.uWeather.value]); }); return l; })(); for (const [m] of window.__we) m.uniforms.uWeather.value = 0', 'for (const [m, v] of window.__we) m.uniforms.uWeather.value = v'],
};
const timeSync = (ev, n) => ev((n) => {
  const gl = window.renderer.getContext(), px = new Uint8Array(4);
  const run = () => { const t0 = performance.now(); for (let i = 0; i < n; i++) window.renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / n; };
  run();
  const fs = window.frameStats; fs.calls = fs.tris = fs.n = 0;
  const a = [run(), run()];
  return { ms: a, calls: Math.round(fs.calls / Math.max(fs.n, 1)), ktris: Math.round(fs.tris / Math.max(fs.n, 1) / 1000) };
}, n);
async function toggleView(ev, rounds = 4, per = 8) {
  const S = {}, D = {}, C = {};
  await ev(() => { window.__hold = true; return true; });
  for (let k = 0; k < rounds; k++) {
    let prev = await timeSync(ev, per);
    (S.base ??= []).push(...prev.ms); C.base = prev;
    const tgs = toggles.filter((t) => t !== 'base'); if (k % 2) tgs.reverse();
    for (const tg of tgs) {
      const [on, off] = TOG[tg] ?? [tg, ''];
      if (on) await ev(on + '; true');
      const r = await timeSync(ev, per);
      if (off) await ev(off + '; true');
      const after = await timeSync(ev, per);
      (S[tg] ??= []).push(...r.ms); C[tg] = r;
      const b = (prev.ms[0] + prev.ms[1] + after.ms[0] + after.ms[1]) / 4;
      (D[tg] ??= []).push((r.ms[0] + r.ms[1]) / 2 - b);
      S.base.push(...after.ms); prev = after;
    }
  }
  await ev(() => { window.__hold = false; return true; });
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return +s[s.length >> 1].toFixed(2); };
  return Object.fromEntries(Object.keys(S).map((k) => [k, { ms: med(S[k]), diff: D[k] ? med(D[k]) : null, calls: C[k].calls, ktris: C[k].ktris }]));
}
// the page's own loop held while the synced loops run (so they don't share the frame with it)
const HOLD = `(() => { if (window.__holdSet) return; window.__holdSet = 1; const raf = window.requestAnimationFrame; window.__hold = false;
  window.requestAnimationFrame = (cb) => raf((ts) => { if (window.__hold) { setTimeout(() => window.requestAnimationFrame(cb), 30); return; } cb(ts); }); })();`;

// ------------------------------------------------------------------ the server, the app
const bridge = new Bridge();
const dist = resolve(ROOT, String(opt.serve ?? 'dist'));
const files = staticHandler([['/', dist]], { inject: (req) => bridge.tagFor(req) });
const server = createServer((req, res) => { if (!bridge.handle(req, res)) files(req, res); });
await new Promise((r) => server.listen(PORT, r));
console.log(`serving ${dist} on ${BASE} (with the Gecko page bridge)${apk ? '; the game itself from the APK' : ''}`);
const keepRules = () => { if (!adb(['reverse', '--list'], { quiet: true }).includes(`tcp:${PORT}`)) adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`], { quiet: true }); };
const keeper = setInterval(keepRules, 1500);
adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);

async function bringUp() {
  stopApp();
  await sleep(1000);
  const seen = bridge.seen;
  const url = apk ? ['--es', 'url', 'bundled:/bench-blank.html', '--es', 'inject', `${BASE}__bridge/init.js`] : ['--es', 'url', BASE + 'bench-blank.html'];
  adb(['shell', 'am', 'start', '-n', GACTIVITY, ...url]);
  await bridge.waitPage(ORIGIN, seen);
  return new GeckoPage(bridge);
}

const cleanup = () => { clearInterval(keeper); stopApp(); adb(['reverse', '--remove', `tcp:${PORT}`]); server.close(); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { console.error(`${sig}: stopping the test app`); cleanup(); process.exit(130); });

const picked = existsSync(VIEWS) ? JSON.parse(readFileSync(VIEWS, 'utf8')) : { about: 'Views per world for scripts/bench/android-worlds.mjs (picked by --pick 1: the boot camera, the two densest knots of people, a wide look, a walk); the desert uses viewpoints.json', worlds: {} };

async function runWorld(world, mode) {
  const label = `${world} ${mode}`;
  const cool = await coolDown(label);
  const page = await bringUp();
  const ev = (fn, arg) => page.eval(fn, arg);
  const errors = [];
  page.log = (type, t) => { if (type === 'exception' || type === 'error') errors.push(t.slice(0, 200)); };
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT + '\n' + EXTRA + '\n' + HOLD });
  await prepare(ev);
  const tNav = Date.now();
  await page.goto(`${ORIGIN}?level=${world}&fps=1`);
  await page.waitFor('!!(window.__moebiusBooted && window.renderFrame && window.player)', 300000, 250);
  const load = await ev(() => ({ firstFrame: +((window.__moebiusBootedAt ?? NaN) / 1000).toFixed(2), programs: window.renderer.info.programs?.length, geometries: window.renderer.info.memory.geometries, textures: window.renderer.info.memory.textures }));
  load.wall = +((Date.now() - tNav) / 1000).toFixed(1);
  await sleep(4000);
  let procs = processes();
  const j0 = jiffies(procs.map((p) => p.pid)); await sleep(1500); const j1 = jiffies(procs.map((p) => p.pid));
  const busy = Object.fromEntries(procs.map((p) => [p.pid, (j1[p.pid] ?? 0) - (j0[p.pid] ?? 0)]));
  const memLoaded = memory(procs, busy);
  const tabPid = procs.filter((p) => p.role === 'tab').sort((a, b) => busy[b.pid] - busy[a.pid])[0]?.pid;
  await ev(() => { window.story?.closePage?.(); return true; });
  // the views
  let W = world === 'desert' ? { views: VP.views, paths: VP.paths } : picked.worlds[world];
  if (typeof opt.foes === 'string') {
    const made = await ev((pack) => {
      const { THREE, player, foes } = window;
      const P = player.pos.clone(), f = new THREE.Vector3(Math.sin(player.heading ?? 0), 0, Math.cos(player.heading ?? 0)), r = new THREE.Vector3(f.z, 0, -f.x);
      foes.update = () => { for (const x of foes.list) foes.look(x, 1 / 60); };
      for (const x of [...foes.list]) foes.remove(x);
      return pack.map((id, i) => { const at = P.clone().addScaledVector(f, 7 + (i % 3) * 2.2).addScaledVector(r, ((i / 3) | 0) * 2.4 - 3.6); try { const x = foes.add(id, at); if (x) { x.heading = Math.atan2(-f.x, -f.z); x.provoked = true; foes.look(x, 0); } return x ? id : null; } catch (e) { return 'x:' + id + ' ' + e.message; } });
    }, opt.foes.split(',').filter((x) => x && x !== 'none'));
    console.log(`${world}: foes ${JSON.stringify(made)}`);
  }
  if (opt.spawn) { const P = await pickViews(ev); W = { views: P.views.filter((v) => v.name === 'start'), paths: P.paths }; }
  // what the game chose on the device: the preset, its scale, the pixel ratio; and the sound, which must be silent
  const chosen = await ev(() => ({ preset: window.preset().key, label: window.preset().label, setting: window.settings.quality, scale: window.quality.renderScale,
    dynamic: window.preset().dynamic, dpr: window.devicePixelRatio, canvas: [window.renderer.domElement.width, window.renderer.domElement.height],
    gpu: (() => { const gl = window.renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : null; })(),
    sound: { music: window.sound?.musicVol, fx: window.sound?.fxVol, voices: window.sound?.voiceVol, muted: window.sound?.muted, settings: [window.settings.music, window.settings.effects, window.settings.voices] } }));
  console.log(`${world}: preset ${chosen.preset} (${chosen.label}), scale ${chosen.scale}, dpr ${chosen.dpr}, canvas ${chosen.canvas}, ${chosen.gpu}; sound ${JSON.stringify(chosen.sound)}`);
  if ([chosen.sound.music, chosen.sound.fx, chosen.sound.voices].some((v) => v > 0)) throw new Error(`the game's sound is not at 0: ${JSON.stringify(chosen.sound)}`);
  if (!W && opt.pick) {
    W = await pickViews(ev);
    picked.worlds[world] = W;
    writeFileSync(VIEWS, JSON.stringify(picked, null, 1) + '\n');
    console.log(`${world}: picked ${W.views.map((v) => v.name + (v.people ? ` (${v.people} people)` : '')).join(', ')}`);
  }
  if (!W) throw new Error(`no views for ${world}: --pick 1`);
  const dyn = mode === 'dynamic';
  if (dyn) await ev(() => { window.__dyn = window.preset().dynamic; return true; });
  const canvas = await conditions(ev, { hour: VP.hour, weather: VP.weather, scale: SCALE === 'preset' ? chosen.scale : SCALE });
  if (dyn) await ev(() => { window.preset().dynamic = window.__dyn; return true; });
  await ev(() => { const st = document.createElement('style'); st.textContent = '#fps { visibility: visible !important; }'; document.head.appendChild(st); return true; });
  const gs = gpuSampler();
  let last = jiffies(procs.map((p) => p.pid)), lastT = Date.now();
  const onEach = async () => {
    const pageSide = await ev(() => {
      const B = window.__bench, s = B.scales.slice().sort((a, b) => a - b);
      return { hidden: B.hidden, fpsText: document.getElementById('fps')?.textContent, scale: window.quality.renderScale, scales: s.length ? { median: s[s.length >> 1], min: s[0], max: s[s.length - 1] } : null };
    });
    const g = gs.take();
    const now = jiffies(procs.map((p) => p.pid)), dt = (Date.now() - lastT) / 1000;
    const cores = Object.fromEntries(procs.map((p) => [p.role === 'tab' ? (p.pid === tabPid ? 'tab' : 'tab-other') : p.role, now[p.pid] != null && last[p.pid] != null ? +((now[p.pid] - last[p.pid]) / 100 / dt).toFixed(2) : null]));
    last = now; lastT = Date.now();
    return { ...g, ...temps(), ...pageSide, cores, mem: memory(procs.map((p) => p), { [tabPid]: 1 }) };
  };
  const items = [...W.views.map((v) => v.name), ...(W.paths ?? []).map((p) => p.name)].filter((n) => !only || only.includes(n));
  const views = [];
  for (const name of items) {
    await ev((l) => { window.__benchLabel = l; return true; }, `${world} ${name} ${mode}`).catch(() => 0);
    const one = { ...VP, views: W.views.filter((x) => x.name === name), paths: (W.paths ?? []).filter((x) => x.name === name) };
    gs.reset(); last = jiffies(procs.map((p) => p.pid)); lastT = Date.now();
    const [v] = await runAll(ev, one, { secs, warmup, tag: label, onEach });
    v.missedShare = missedShare(v.raw.frame);
    v.jsSpikes = v.raw.cpu.filter((x) => x > 2 * (v.cpu?.median ?? 99) && x > 8).length;   // (main-thread frames over twice the usual: GC, a compile, a load)
    if (opt.profile) {
      // held where the view is (a path at its end)
      v.profile = await profileView(ev);
      console.log(`  ${name} profile: js ${v.profile.jsPerFrame} ms ` + Object.entries(v.profile.bySystem).slice(0, 12).map(([k, x]) => `${k} ${x}`).join(', ') + ` rest ${v.profile.rest}`);
    }
    if (toggles) {
      v.toggles = await toggleView(ev);
      console.log(`  ${name} toggles: ` + Object.entries(v.toggles).map(([k, r]) => `${k} ${r.ms}${r.diff != null ? ` (Δ ${r.diff})` : ''} ${r.calls}c ${r.ktris}k`).join(' | '));
    }
    console.log(`  ${name}: fps ${v.fps}, p95 ${v.frame?.p95}, missed ${v.missedShare} %, js ${v.cpu?.median} ms, gpu ${v.gpuBusy} % @${v.gpuMHz}, ${v.draws} draws ${Math.round(v.tris / 1000)}k tris, scale ${v.scales?.median ?? v.scale}, tab ${v.mem?.tab?.pssMB} MB, ${v.gpuC} °C`);
    delete v.raw.gpu;
    views.push(v);
  }
  gs.stop();
  const memEnd = memory(processes(), { [tabPid]: 1 });
  stopApp();
  const result = { world, mode, apk, quality: QUALITY, chosen, load, memLoaded, memEnd, canvas, start: cool, end: temps(), errors: [...new Set(errors)].slice(0, 10), time: new Date().toISOString(), views };
  writeFileSync(`${RAW}/${world}-${mode}${QUALITY !== 'handheld' ? '-' + QUALITY : ''}${opt.tag ? '-' + opt.tag : ''}${apk ? '-apk' : ''}.json`, JSON.stringify(result) + '\n');
  console.log(`${label}: first frame ${load.firstFrame} s; memory after load: tab ${memLoaded.tab?.pssMB} MB, gpu ${memLoaded.gpu?.pssMB} MB, parent ${memLoaded.parent?.pssMB} MB${errors.length ? `; ${errors.length} errors: ${errors[0]}` : ''}`);
  return result;
}

console.log(`device ${sh('getprop ro.product.model').trim()}; raw results in ${RAW}`);
let failed = 0;
try {
  for (const mode of modes) for (const world of WORLDS) {
    if (opt.resume && existsSync(`${RAW}/${world}-${mode}${QUALITY !== 'handheld' ? '-' + QUALITY : ''}${apk ? '-apk' : ''}.json`)) continue;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { await runWorld(world, mode); break; } catch (err) { console.error(`${world} ${mode} failed (attempt ${attempt}): ${err.stack ?? err}`); stopApp(); if (attempt === 2) failed++; }
    }
  }
} finally {
  cleanup();
  console.log(`done (${failed} failed); the test app stopped`);
}
process.exit(0);
