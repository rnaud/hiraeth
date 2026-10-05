// The Lab's fixed viewpoints timed on the GPU (docs/systems/materials.md, "Faster surfaces"): headless Chrome on ANGLE
// Metal (the renderer string is checked: never SwiftShader), muted, no vsync or frame-rate limit.
// Per view: the frame interval (median, 95th percentile), the main thread's share, the GPU time of
// the frame (one EXT_disjoint_timer_query around each animation frame) and the frame's throughput
// (six frames back to back, then a one-pixel read that waits for the GPU).
//   npx vite --port 5250 --strictPort &
//   node scripts/lab-perf/lab-perf.mjs --preset high|handheld [--res 1920x1080] [--only 'mat:|room:'] [--out lab.json]
//        [--ab]   per view, the surface shader as before (no SURFACE_SPEC: every feature compiled, all
//                 eight light slots) against now, alternating in the same page (the machine's noise cancels)
//        [--shots dir]
// The world is held still: the traveller pinned where the view says, the camera through updateMatrixWorld.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { options, sleep, median } from '../bench/lib.mjs';
import { PLAYWRIGHT, CHROME } from '../bench/browser.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:5250/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'high';
const [w, h] = (opt.res ?? '1920x1080').split('x').map(Number);
const scale = preset === 'handheld' ? 0.75 : 1.5;
const rounds = +(opt.rounds ?? 3);

// ---------------------------------------------------------------- the views
const SPACING = 9, MATS = ['flat', 'smooth', 'rock strata', 'cracked', 'facade', 'tiles', 'leaves', 'brush', 'grid', 'glyphs', 'glow', 'lamp', 'steel', 'brushed', 'chrome', 'brass', 'copper', 'iron', 'painted', 'dissolve'];
const mx = (i) => (i - (MATS.length - 1) / 2) * SPACING;
const HUB = [
  { name: 'spawn', player: [0, 0, 4], eye: [0, 2.6, 10], target: [0, 1.4, -6] },
  { name: 'row', player: [0, 0, -12], eye: [0, 4, -8], target: [0, 1, -24] },
  ...MATS.map((m, i) => ({ name: 'mat:' + m, player: [mx(i), 0, -15], eye: [mx(i), 2.2, -17.5], target: [mx(i), 1.2, -24] })),
  ...MATS.map((m, i) => ({ name: 'full:' + m, player: [mx(i) - 2.4, 0, -19], eye: [mx(i) - 2.4, 1.6, -22.3], target: [mx(i) - 2.4, 1.6, -24], fov: 40 })),   // its sphere fills the frame
  { name: 'pool', player: [66, 0, -22], eye: [70, 7, -16], target: [86, 3, -30] },
  { name: 'meadow', player: [116.5, 0.3, -21], eye: [116.5, 2, -16], target: [116.5, 0.3, -24] },
  { name: 'faces', player: [0, 0, 22], eye: [0, 3, 18], target: [0, 6, 46] },
  { name: 'walkway', player: [0, 5.1, 42.6], eye: [-2, 7, 39], target: [6, 7.5, 47] },
  { name: 'doors', player: [0, 0, 52], eye: [0, 2.5, 48], target: [0, 2.5, 64] },
];

// ---------------------------------------------------------------- in the page
const PAGE = `(() => {
  const L = window.__lab = {};
  const { THREE, renderer, camera } = window;
  const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let rec = false, frames = [], cpu = [], gpu = [], pending = [], tickTs = -1, tickCpu = 0, cur = null;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => {
    if (ts !== tickTs) {
      if (tickTs >= 0 && rec) { frames.push(ts - tickTs); cpu.push(tickCpu); }
      tickTs = ts; tickCpu = 0;
      // (one query per callback; a frame's GPU time is the sum over its callbacks)
      while (pending.length && gl.getQueryParameter(pending[0].q, gl.QUERY_RESULT_AVAILABLE)) {
        const { q, f } = pending.shift();
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) f.bad = true; else f.sum += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
        gl.deleteQuery(q);
        if (--f.left === 0 && f.rec && !f.bad) gpu.push(f.sum);
      }
      cur = { sum: 0, left: 0, rec, bad: false };
      if (L.hold) { window.player.pos.set(...L.hold); window.player.vel.set(0, 0, 0); }
    }
    const q = ext && cur && pending.length < 40 ? gl.createQuery() : null;
    if (q) { gl.beginQuery(ext.TIME_ELAPSED_EXT, q); cur.left++; }
    const t0 = performance.now();
    try { cb(ts); } finally { tickCpu += performance.now() - t0; if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ q, f: cur }); } }
  });
  window.preset().dynamic = null;
  window.quality.renderScale = ${scale}; window.resize();
  window.sky.hour = 11; window.sky.speed = 0; window.updateSky?.();
  window.weather.mode = 'clear'; window.weather.intensity = 0;
  const hide = document.createElement('style');
  hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }';
  document.head.appendChild(hide);
  const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  let pin = null;
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) {
    if (pin) { this.position.copy(pin.eye); this.quaternion.copy(pin.q); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } }
    return base.call(this, force);
  };
  L.view = (v) => {
    window.player.teleport(new THREE.Vector3(...v.player), up, new THREE.Vector3(0, 0, 1));
    L.hold = v.player;
    const e = new THREE.Vector3(...v.eye), t = new THREE.Vector3(...v.target);
    pin = { eye: e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov: v.fov ?? 55 };
  };
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(3) : null; };
  L.sample = (n) => new Promise((res) => {
    frames = []; cpu = []; gpu = []; rec = true;
    const t0 = performance.now();
    const chk = () => { if (frames.length >= n || performance.now() - t0 > 20000) { rec = false; setTimeout(() => res({ frame: q(frames, 0.5), p95: q(frames, 0.95), cpu: q(cpu, 0.5), gpu: q(gpu.filter((x) => x > 0.05), 0.5) }), 100); } else setTimeout(chk, 50); };
    chk();
  });
  const px = new Uint8Array(4);
  L.wall = (k = 6, n = 8) => new Promise((res) => {
    const out = [];
    const step = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let j = 0; j < k; j++) window.renderFrame();
      renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      out.push((performance.now() - t0) / k);
      if (out.length < n) raf(step); else res(q(out, 0.5));
    };
    raf(step);
  });
  // the surface shader as before (--ab): no SURFACE_SPEC, so every feature compiled; all light slots looked at
  const mats = new Set();
  window.scene.traverse((o) => { if (o.material) for (const mm of [o.material].flat()) if (mm.uniforms?.uMode && mm.defines?.SURFACE_SPEC) mats.add(mm); });
  const lc = window.sharedUniforms.uLightCount; let lcv = lc?.value, all = false;   // (a build from before it: none)
  if (lc) Object.defineProperty(lc, 'value', { get: () => (all ? 8 : lcv), set: (x) => { lcv = x; } });
  L.before = (on) => {
    for (const mm of mats) {
      mm.userData.labDefines ??= { ...mm.defines };
      mm.defines = on ? Object.fromEntries(Object.entries(mm.userData.labDefines).filter(([k]) => k !== 'SURFACE_SPEC' && !/^S_|^METAL_BRUSHED$/.test(k))) : { ...mm.userData.labDefines };
      mm.needsUpdate = true;
    }
    all = on;
  };
  L.rooms = () => window.level.rooms.map((r) => ({ name: 'room:' + r.def.id, player: r.arrive.toArray(), eye: [r.arrive.x, r.arrive.y + 3, r.arrive.z + 6], target: [r.arrive.x, r.arrive.y + 1, r.arrive.z - 20] }));
})();`;

// ---------------------------------------------------------------- run
const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ executablePath: CHROME, headless: true,
  args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.goto(BASE + 'manifest.webmanifest');
const gl = await ev(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return c.getParameter(d.UNMASKED_RENDERER_WEBGL); });
if (/SwiftShader|llvmpipe|Software/i.test(gl)) { console.error('software rendering: ' + gl); process.exit(2); }
await ev((quality) => {
  localStorage.clear();
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality, showFps: false, music: 0, effects: 0, voices: 0 }));
}, preset);
await page.goto(BASE + '?level=lab', { waitUntil: 'load' });
await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player, null, { timeout: 300000, polling: 100 });
await ev(PAGE);
await sleep(2500);
const only = opt.only ? new RegExp(opt.only) : null;
const views = [...HUB, ...(await ev(() => window.__lab.rooms()))].filter((v) => !only || only.test(v.name));
if (opt.shots) mkdirSync(opt.shots, { recursive: true });
console.log(gl, preset, await ev(() => [window.renderer.domElement.width, window.renderer.domElement.height]));
const out = [];
for (const v of views) {
  await ev((v) => window.__lab.view(v), v);
  await sleep(1000);
  const sides = opt.ab ? ['before', 'now'] : ['now'];
  const S = Object.fromEntries(sides.map((k) => [k, []]));
  for (let r = 0; r < (opt.ab ? rounds : 1); r++) for (const k of sides) {
    if (opt.ab) { await ev((on) => window.__lab.before(on), k === 'before'); await sleep(600); }
    const s = await ev(() => window.__lab.sample(120));
    s.wall = await ev(() => window.__lab.wall());
    S[k].push(s);
  }
  const row = { name: v.name };
  for (const k of sides) row[k] = Object.fromEntries(['frame', 'p95', 'cpu', 'gpu', 'wall'].map((f) => [f, median(S[k].map((s) => s[f]))]));
  out.push(row);
  console.log(v.name.padEnd(18), sides.map((k) => `${k}: frame ${row[k].frame} p95 ${row[k].p95} cpu ${row[k].cpu} gpu ${row[k].gpu} wall ${row[k].wall}`).join(' | '));
  if (opt.shots) await page.screenshot({ path: join(opt.shots, `${preset}-${v.name.replace(/[:\s]/g, '_')}.png`) });
}
if (opt.out) writeFileSync(opt.out, JSON.stringify({ gl, preset, res: [w, h], scale, views: out }, null, 1) + '\n');
await browser.close();
