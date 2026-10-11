// renderFrame() run back to back inside one task (docs/systems/xbox.md, "Why 20 fps"): the first call after the game's
// own frame, then the next seven, each timed, the GPU waited for only at the end (a pixel read back). If the later calls
// are much quicker, the frame's cost is the caches (the renderer's working set evicted between frames), not the work.
// Also every renderer.render() call timed by pass. Run: node scripts/xbox-devtools.mjs js @scripts/xbox-probes/warm-frames.js
(() => {
  const gl = window.renderer.getContext(), px = new Uint8Array(4), t = [];
  for (let i = 0; i < 8; i++) { const t0 = performance.now(); window.renderFrame(); t.push(+(performance.now() - t0).toFixed(1)); }
  const t0 = performance.now(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { renderFrame_ms: t, readPixels_wait_ms: +(performance.now() - t0).toFixed(1) };
})()
