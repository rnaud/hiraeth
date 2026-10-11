// Each Graphics preset in turn at the spot the traveller stands on (docs/systems/xbox.md, "Why 20 fps"): set through
// the game's settings, 12 s to settle (loads, the dynamic scale), then 8 s of frames: their interval, the main thread's
// time in the frame callbacks, draw calls. The setting is put back as it was at the end.
// Run: node scripts/xbox-devtools.mjs js @scripts/xbox-probes/presets.js
// window.__presetList = ['handheld', ...] before it picks the presets (default below).
(async () => {
  const { settings } = window;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const list = window.__presetList ?? ['handheld', 'low', 'deck', 'medium', 'auto'];
  const was = settings.quality, out = [];
  const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  for (const q of list) {
    settings.set('quality', q);
    await sleep(12000);
    const iv = [], cpu = [];
    let last = 0, stop = false;
    const raf = window.requestAnimationFrame.bind(window);
    // (the frame's work: the time from this callback to the next idle moment is not visible here, so the
    //  readout's own cpu figure is read as well: the game's frame callback timed by the game)
    const tick = (ts) => { if (last) iv.push(ts - last); last = ts; if (!stop) raf(tick); };
    raf(tick);
    const readouts = [];
    for (let i = 0; i < 8; i++) { await sleep(1000); readouts.push(document.getElementById('fps')?.textContent ?? ''); }
    stop = true;
    const draws = [];
    for (const r of readouts) { const m = /cpu ([\d.]+)/.exec(r); if (m) cpu.push(+m[1]); const d = /(\d+) calls/.exec(r); if (d) draws.push(+d[1]); }
    const med = pct(iv, 0.5);
    out.push({ preset: q, key: window.preset().key, scale: window.quality.renderScale, fps: +(1000 / med).toFixed(1), ms_median: +med.toFixed(1), ms_p95: +pct(iv, 0.95).toFixed(1),
      cpu_ms: +pct(cpu, 0.5).toFixed(1), draw_calls: pct(draws, 0.5), readout: readouts.at(-1) });
  }
  settings.set('quality', was);
  return out;
})()
