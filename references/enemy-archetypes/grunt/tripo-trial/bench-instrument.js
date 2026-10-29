// Reused from scripts/bench/browser.mjs INSTRUMENT; no browser automation.
(() => {
  const B = window.__bench = { rec: false, frames: [], cpu: [], gpu: [], calls: [], tris: [], marks: [], pre: null, gl: null, ext: null, tickTs: -1, tickCpu: 0, pending: [], free: [], byTs: new Map() };
  const getCtx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = getCtx.call(this, type, ...a);
    if (c && type === 'webgl2' && (!B.gl || this.width * this.height >= B.gl.canvas.width * B.gl.canvas.height)) { B.gl = c; B.ext = c.getExtension('EXT_disjoint_timer_query_webgl2'); }
    return c;
  };
  // (Unity's Debug.Log goes to the console: its bench marks the start and end of each recording)
  const log = console.log;
  console.log = function (...a) { const s = String(a[0] ?? ''); if (s.includes('Hiraeth: bench rec ')) B.marks.push([s.includes('rec start') ? 'start' : 'end', performance.now(), B.frames.length]); return log.apply(this, a); };
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
})();