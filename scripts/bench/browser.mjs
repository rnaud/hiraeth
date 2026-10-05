// Real Chrome with the GPU for the benchmark's browser sides (the three.js game, Unity's WebGL build):
// headed (headless can fall back to software rendering), ANGLE on Metal, no vsync and no frame-rate
// limit (requestAnimationFrame runs as fast as the frame allows), device scale 1 (a 1280 × 720 page is
// 1280 × 720 pixels), precise JS heap numbers.
//
// INSTRUMENT is injected before the page's own scripts: it wraps requestAnimationFrame to time each
// frame (the interval between animation frames, the callbacks' CPU time) and, where WebGL 2 has
// EXT_disjoint_timer_query_webgl2, the GPU time of the commands each frame issues; and it records the
// renderer's draw calls and triangles after each frame (three.js: renderer.info).
import { mkdirSync, rmSync } from 'node:fs';
import { pidsOf } from './lib.mjs';

export const PLAYWRIGHT = process.env.PLAYWRIGHT ?? '/private/tmp/claude-501/-Users-anf-projects-moebius/79b266a7-36c4-4810-b5a3-d753e92ed428/scratchpad/node_modules/playwright-core/index.mjs';
export const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const CHROME_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
  '--force-device-scale-factor=1', '--enable-precise-memory-info', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--enable-unsafe-webgpu', '--no-first-run', '--no-default-browser-check'];

export async function launch({ w, h, profile, extraArgs = [] }) {
  const { chromium } = await import(PLAYWRIGHT);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: CHROME, headless: false, viewport: { width: w, height: h }, deviceScaleFactor: 1,
    args: [...CHROME_ARGS, `--window-size=${w},${h + 120}`, ...extraArgs],
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.addInitScript(INSTRUMENT);
  return { ctx, page, pids: () => pidsOf(profile) };
}

/** what the GPU is (WebGL's unmasked renderer string): must be the real GPU, not SwiftShader */
export const glInfo = (page) => page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2'); const d = gl?.getExtension('WEBGL_debug_renderer_info');
  return { renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, timerQuery: !!gl?.getExtension('EXT_disjoint_timer_query_webgl2'), webgpu: !!navigator.gpu, ua: navigator.userAgent };
});

export const INSTRUMENT = `(() => {
  const B = window.__bench = { rec: false, frames: [], cpu: [], gpu: [], calls: [], tris: [], marks: [], pre: null, gl: null, ext: null, tickTs: -1, tickCpu: 0, pending: [], free: [], byTs: new Map() };
  const getCtx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = getCtx.call(this, type, ...a);
    if (c && type === 'webgl2' && (!B.gl || this.width * this.height >= B.gl.canvas.width * B.gl.canvas.height)) { B.gl = c; B.ext = c.getExtension('EXT_disjoint_timer_query_webgl2'); }
    return c;
  };
  // (Unity's Debug.Log goes to the console: its bench marks the start and end of each recording)
  const log = console.log;
  console.log = function (...a) { const s = String(a[0] ?? ''); if (s.includes('Memento: bench rec ')) B.marks.push([s.includes('rec start') ? 'start' : 'end', performance.now(), B.frames.length]); return log.apply(this, a); };
  function poll() {
    const gl = B.gl, ext = B.ext; if (!gl || !ext) return;
    while (B.pending.length && gl.getQueryParameter(B.pending[0].q, gl.QUERY_RESULT_AVAILABLE)) {
      const { q, ts } = B.pending.shift();
      const ok = !gl.getParameter(ext.GPU_DISJOINT_EXT);
      const e = B.byTs.get(ts);
      if (e) { if (ok) e.sum += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; else e.bad = true; if (--e.left === 0) { if (!e.bad && e.rec) B.gpu.push(e.sum); B.byTs.delete(ts); } }
      B.free.push(q);
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => {
    if (ts !== B.tickTs) {
      if (B.tickTs >= 0 && B.rec) {
        B.frames.push(ts - B.tickTs); B.cpu.push(B.tickCpu);
        const info = window.renderer?.info?.render; if (info) { B.calls.push(info.calls); B.tris.push(info.triangles); }
      }
      B.tickTs = ts; B.tickCpu = 0;
      poll();
      if (B.pre) try { B.pre(ts); } catch (e) { B.preError = String(e); }
    }
    const gl = B.gl, ext = B.ext;
    let q = null;
    if (gl && ext && B.timeGpu !== false && B.pending.length < 24) {
      q = B.free.pop() ?? gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      const e = B.byTs.get(ts) ?? { sum: 0, left: 0, rec: B.rec }; e.left++; B.byTs.set(ts, e);
    }
    const t0 = performance.now();
    try { cb(ts); } finally {
      B.tickCpu += performance.now() - t0;
      if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); B.pending.push({ q, ts }); }
    }
  });
  B.reset = () => { B.frames = []; B.cpu = []; B.gpu = []; B.calls = []; B.tris = []; };
})();`;
