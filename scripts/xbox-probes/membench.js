// Memory latency as JavaScript sees it (docs/systems/xbox.md, "Why 20 fps"): a random cycle through an Int32Array of
// each size, ns per dependent load (each load's address is the last one's value: no overlap), and the same walk over
// plain JS objects (what a scene graph is). Best of three. Run on the console with
// node scripts/xbox-devtools.mjs js @scripts/xbox-probes/membench.js, and in Chrome on the Mac to compare.
(() => {
  const out = {};
  const cycle = (n) => { const a = new Int32Array(n), p = new Int32Array(n); for (let i = 0; i < n; i++) p[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < n; i++) a[p[i]] = p[(i + 1) % n]; return a; };
  for (const kb of [16, 128, 1024, 4096, 16384, 65536]) {
    const n = (kb * 1024) / 4, a = cycle(n), hops = 2e6;
    let best = Infinity, k = 0;
    for (let r = 0; r < 3; r++) { const t = performance.now(); for (let i = 0; i < hops; i++) k = a[k]; best = Math.min(best, performance.now() - t); }
    window.__k = k;
    out[`i32_${kb}kB`] = +((best * 1e6) / hops).toFixed(2);
  }
  for (const count of [1000, 10000, 100000]) {
    const objs = Array.from({ length: count }, (_, i) => ({ i, next: null, x: Math.random(), y: 0, z: 0 }));
    for (let i = objs.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = objs[i]; objs[i] = objs[j]; objs[j] = t; }
    for (let i = 0; i < count; i++) objs[i].next = objs[(i + 1) % count];
    const hops = 2e6; let best = Infinity, o = objs[0], s = 0;
    for (let r = 0; r < 3; r++) { const t = performance.now(); for (let i = 0; i < hops; i++) { s += o.x; o = o.next; } best = Math.min(best, performance.now() - t); }
    window.__s = s;
    out[`obj_${count}`] = +((best * 1e6) / hops).toFixed(2);
  }
  // performance.now() itself (the frame timers and the glcount wrapper call it)
  { const n = 2e5, t = performance.now(); let x = 0; for (let i = 0; i < n; i++) x += performance.now(); window.__x = x; out.perfNow_ns = +(((performance.now() - t) * 1e6) / n).toFixed(1); }
  return out;
})()
