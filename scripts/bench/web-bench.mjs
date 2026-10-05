// The web side of the benchmark: the three.js game in real Chrome on the GPU (browser.mjs), the same
// viewpoints and paths as the Unity player (viewpoints.json), the same hour and weather, the HUD hidden.
// Uncapped: Chrome runs without vsync or a frame-rate limit, so requestAnimationFrame comes as fast as
// a frame is done; each frame's interval, its CPU time (the game's frame() and anything else on that
// animation frame) and its GPU time (EXT_disjoint_timer_query_webgl2) are recorded.
//   npx vite build && npx vite preview --port 5245 --strictPort &
//   node scripts/bench/web-bench.mjs --preset high --res 1280x720 --out result.json [--url http://localhost:5245/]
//        [--secs 10] [--warmup 3] [--only spawn,camps] [--shots dir] [--label run1]
// --preset high | handheld: the game's own Graphics presets, at a fixed render scale (High 1.0, not its
// usual 1.5× supersampling; Handheld 0.75, without its dynamic resolution) so both sides draw the
// same number of pixels (docs/benchmark-web-vs-unity.md).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ROOT, viewpoints, stats, hitches, median, memorySampler, sizeOf, sleep } from './lib.mjs';
import { launch, glInfo } from './browser.mjs';

const opt = Object.fromEntries(process.argv.slice(2).join(' ').split(/\s*--/).filter(Boolean).map((s) => { const [k, ...v] = s.split(/\s+/); return [k, v.join(' ') || true]; }));
const BASE = (opt.url ?? 'http://localhost:5245/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'high';
const [w, h] = (opt.res ?? '1280x720').split('x').map(Number);
const out = resolve(opt.out ?? `web-${preset}-${w}x${h}.json`);
mkdirSync(dirname(out), { recursive: true });
const VP = viewpoints();
const secs = +(opt.secs ?? VP.secs), warmup = +(opt.warmup ?? VP.warmup);
const only = typeof opt.only === 'string' ? opt.only.split(',') : null;
const SCALE = { high: 1, handheld: 0.75 }[preset] ?? 1;
const shots = typeof opt.shots === 'string' ? resolve(opt.shots) : null;
if (shots) mkdirSync(shots, { recursive: true });

const profile = resolve(dirname(out), `.chrome-${process.pid}`);
const { ctx, page, pids } = await launch({ w, h, profile });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const mem = memorySampler(pids, 3000);

// the tab's storage: the prologue done, the preset, no fps line (its GPU timer would collide with ours), sound off
await page.goto(BASE + 'manifest.webmanifest');
const gl = await glInfo(page);
if (/SwiftShader|llvmpipe|Software/i.test(gl.renderer ?? '')) { console.error('software rendering: ' + gl.renderer); process.exit(2); }
await page.evaluate((quality) => {
  localStorage.clear();
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality, showFps: false, music: 0, effects: 0, voices: 0 }));
}, preset);

const t0 = Date.now();
await page.goto(BASE + '?level=desert', { waitUntil: 'load' });
await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player, null, { timeout: 300000, polling: 100 });
const wallLoad = (Date.now() - t0) / 1000;
const load = await page.evaluate(() => ({
  firstFrame: (window.__moebiusBootedAt ?? NaN) / 1000,
  resources: performance.getEntriesByType('resource').map((r) => ({ url: r.name, bytes: r.decodedBodySize, transfer: r.transferSize })),
}));
await sleep(4000);

// the conditions
await page.evaluate(({ hour, weather, scale }) => {
  const { THREE, camera } = window;
  const p = window.preset(); p.dynamic = null;           // (no dynamic resolution: a fixed scale)
  window.quality.renderScale = scale; window.resize();
  window.sky.hour = hour; window.sky.speed = 0; window.updateSky?.();
  window.weather.mode = weather; window.weather.intensity = 0;
  // the HUD and everything over the canvas out of the frame (as the Unity side hides its canvases)
  const hide = document.createElement('style');
  hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }';
  document.head.appendChild(hide);
  document.querySelectorAll('body > *').forEach((e) => { if (e.tagName !== 'CANVAS' && e.querySelector('canvas')) e.style.setProperty('visibility', 'visible', 'important'); });
  // the camera pinned where the bench says, whatever the rig or a scene does with it
  const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  window.__benchCam = null;
  window.__benchSet = (eye, target, fov) => {
    const e = new THREE.Vector3(...eye), t = new THREE.Vector3(...target);
    window.__benchCam = { eye: e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov };
  };
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) {
    const c = window.__benchCam;
    if (c) { this.position.copy(c.eye); this.quaternion.copy(c.q); if (this.fov !== c.fov) { this.fov = c.fov; this.updateProjectionMatrix(); } }
    return base.call(this, force);
  };
  window.__benchPlace = (p, h) => {
    window.player.teleport(new THREE.Vector3(...p), up, new THREE.Vector3(0, 0, 1));
    window.player.heading = h;
  };
}, { hour: VP.hour, weather: VP.weather, scale: SCALE });
const canvas = await page.evaluate(() => { const c = window.renderer.domElement; return [c.width, c.height]; });

async function record(seconds) {
  await page.evaluate(() => { window.__bench.reset(); window.__bench.rec = true; });
  await sleep(seconds * 1000);
  return page.evaluate(() => {
    const B = window.__bench; B.rec = false;
    const m = performance.memory;
    return { frames: B.frames, cpu: B.cpu, gpu: B.gpu, calls: B.calls, tris: B.tris, heap: m ? { used: m.usedJSHeapSize, total: m.totalJSHeapSize } : null, preError: B.preError };
  });
}
function summarise(name, kind, seconds, r) {
  const f = stats(r.frames);
  const v = {
    name, kind, secs: seconds, frames: r.frames.length, fps: +(r.frames.length / (r.frames.reduce((a, b) => a + b, 0) / 1000)).toFixed(1),
    frame: f, cpu: stats(r.cpu), gpu: stats(r.gpu), hitches: f ? hitches(r.frames, f.median) : null,
    draws: median(r.calls), tris: median(r.tris), mem: { jsHeapUsed: r.heap?.used, jsHeapTotal: r.heap?.total },
    raw: { frame: r.frames.map((x) => +x.toFixed(2)), gpu: r.gpu.map((x) => +x.toFixed(2)), cpu: r.cpu.map((x) => +x.toFixed(2)) },
  };
  if (r.preError) v.error = r.preError;
  console.log(`web ${preset} ${w}x${h} ${name.padEnd(11)} frame ${f?.median} ms (mean ${f?.mean}, p95 ${f?.p95}, p99 ${f?.p99}) cpu ${v.cpu?.median} gpu ${v.gpu?.median} draws ${v.draws} tris ${v.tris}`);
  return v;
}

const views = [];
let first = true;
for (const v of VP.views) {
  if (only && !only.includes(v.name)) continue;
  await page.evaluate((v) => { window.__benchPlace(v.player, v.heading); window.__benchSet(v.eye, v.target, v.fov); }, v);
  await sleep((warmup + (first ? 2 : 0)) * 1000); first = false;
  const r = await record(secs);
  views.push(summarise(v.name, 'view', secs, r));
  if (shots) await page.screenshot({ path: join(shots, `web-${preset}-${v.name}.png`) });
}
if (opt.paths !== '0') for (const p of VP.paths) {
  if (only && !only.includes(p.name)) continue;
  // each animation frame: the traveller and the camera moved along the path by the time since it started
  await page.evaluate((p) => {
    const pts = p.points, n = pts.length;
    const at = (s) => {
      const k = Math.min(Math.max(s, 0), n - 1.001), i = Math.floor(k), u = k - i, a = pts[i], b = pts[i + 1];
      const L = (x, y) => x.map((c, j) => c + (y[j] - c) * u);
      let dh = b.h - a.h; dh = ((dh + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      return { p: L(a.p, b.p), h: a.h + dh * u, eye: L(a.eye, b.eye), target: L(a.target, b.target) };
    };
    const s0 = at(0);
    window.__benchPlace(s0.p, s0.h); window.__benchSet(s0.eye, s0.target, p.fov);
    window.__benchPath = { at, speed: p.speed, t0: null };
    window.__bench.pre = () => {
      const P = window.__benchPath; if (P.t0 === null) return;
      const s = at(((performance.now() - P.t0) / 1000) * P.speed);
      window.player.pos.set(...s.p); window.player.vel.set(0, 0, 0); window.player.heading = s.h;
      window.__benchSet(s.eye, s.target, p.fov);
    };
  }, p);
  await sleep(warmup * 1000);
  await page.evaluate(() => { window.__benchPath.t0 = performance.now(); });
  const r = await record(p.secs);
  await page.evaluate(() => { window.__bench.pre = null; });
  views.push(summarise(p.name, 'path', p.secs, r));
  if (shots) await page.screenshot({ path: join(shots, `web-${preset}-${p.name}-end.png`) });
}

// what the GPU holds (an estimate: every geometry's and instance buffer's bytes in the scene) and the textures
const gpuEstimate = await page.evaluate(() => {
  const geo = new Set(); let inst = 0;
  window.scene.traverse((o) => { if (o.geometry) geo.add(o.geometry); if (o.instanceMatrix) inst += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); });
  let bytes = 0;
  for (const g of geo) { for (const a of Object.values(g.attributes)) bytes += a.array?.byteLength ?? a.data?.array?.byteLength ?? 0; if (g.index) bytes += g.index.array.byteLength; }
  const info = window.renderer.info.memory;
  return { geometryMB: +((bytes + inst) / 1e6).toFixed(1), geometries: info.geometries, textures: info.textures, programs: window.renderer.info.programs?.length };
});
const m = mem.stop();
await ctx.close();

// what the desert downloads: the files it fetched, their size and their size gzipped (as GitHub Pages serves them)
const dist = resolve(ROOT, 'dist');
let fetched = 0, gz = 0;
for (const r of load.resources) {
  const u = new URL(r.url); if (u.origin !== new URL(BASE).origin) continue;
  const f = join(dist, decodeURIComponent(u.pathname));
  if (existsSync(f) && !f.endsWith('/')) { try { const b = readFileSync(f); fetched += b.length; gz += gzipSync(b, { level: 6 }).length; } catch { /* a folder */ } }
}
const result = {
  engine: 'web', side: 'web', preset, screen: [w, h], renderScale: SCALE, canvas, gl, label: opt.label ?? '', time: new Date().toISOString(),
  load: { firstFrame: load.firstFrame, firstFrameWall: wallLoad },
  process: { peakFootprintMB: Math.round(m.peak.total / 1e6), peakGraphicsMB: Math.round(m.peak.graphics / 1e6), processes: m.peak.processes },
  gpuEstimate, errors: errors.slice(0, 5),
  size: { distMB: +(sizeOf(dist) / 1e6).toFixed(1), fetchedMB: +(fetched / 1e6).toFixed(1), fetchedGzipMB: +(gz / 1e6).toFixed(1), files: load.resources.length },
  views,
};
writeFileSync(out, JSON.stringify(result) + '\n');
console.log(`web: first frame ${load.firstFrame?.toFixed(2)} s after navigation (wall ${wallLoad}), canvas ${canvas.join('×')}, peak ${result.process.peakFootprintMB} MB; ${out}`);
process.exit(0);
