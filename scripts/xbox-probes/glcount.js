// Every WebGL2 call for 5 s, counted and timed (performance.now round each, from the page's main thread): which calls
// a frame makes, how many, and how long the main thread spends inside them (blocked on the GPU process or not).
// The wrapper costs about a microsecond a call itself. Run: node scripts/xbox-devtools.mjs js @scripts/xbox-probes/glcount.js
// (docs/systems/xbox.md, "Why 20 fps")
new Promise((done) => {
  const P = WebGL2RenderingContext.prototype, orig = {}, stat = {};
  for (const k of Object.getOwnPropertyNames(P)) {
    const d = Object.getOwnPropertyDescriptor(P, k); if (typeof d.value !== 'function' || k === 'constructor') continue;
    orig[k] = d.value;
    P[k] = function (...a) { const t = performance.now(); try { return orig[k].apply(this, a); } finally { const s = (stat[k] ??= [0, 0]); s[0]++; s[1] += performance.now() - t; } };
  }
  const f0 = window.renderer.info.render.frame, t0 = performance.now();
  setTimeout(() => {
    for (const k in orig) P[k] = orig[k];
    const n = window.renderer.info.render.frame - f0, wall = performance.now() - t0;
    const rows = Object.entries(stat).map(([k, [c, t]]) => [k, +(c / n).toFixed(1), +(t / n).toFixed(3)]).sort((a, b) => b[2] - a[2]);
    const tot = rows.reduce((s, r) => s + r[2], 0), calls = rows.reduce((s, r) => s + r[1], 0);
    done({ frames: n, ms_per_frame: +(wall / n).toFixed(1), gl_ms_per_frame: +tot.toFixed(2), gl_calls_per_frame: Math.round(calls), top: rows.slice(0, 30) });
  }, 5000);
})
