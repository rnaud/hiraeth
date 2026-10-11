// How much of renderFrame() is the WebGL calls themselves (docs/systems/xbox.md, "Why 20 fps"): renderFrame() timed
// back to back as it is, then with the state, uniform and draw calls made no-ops (nothing reaches the GPU process:
// what is left is three.js's and the game's JavaScript), then as it is again. The page's picture is redrawn by the
// next real frame. Run: node scripts/xbox-devtools.mjs js @scripts/xbox-probes/gl-noop.js
(() => {
  const P = WebGL2RenderingContext.prototype, saved = {};
  const NOOP = /^(draw|uniform|bind|useProgram|bufferSubData|bufferData|texSubImage|texImage|texParameter|enable|disable|blend|depth|colorMask|viewport|scissor|activeTexture|clear|polygonOffset|stencil|cullFace|frontFace|vertexAttrib|enableVertexAttrib|disableVertexAttrib|invalidateFramebuffer|drawBuffers|pixelStorei|lineWidth|readBuffer|blitFramebuffer|generateMipmap)/;
  const time = (n) => { const t = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); window.renderFrame(); t.push(performance.now() - t0); } t.sort((a, b) => a - b); return +t[Math.floor(n / 2)].toFixed(1); };
  const real0 = time(6);
  for (const k of Object.getOwnPropertyNames(P)) if (NOOP.test(k) && typeof Object.getOwnPropertyDescriptor(P, k).value === 'function') { saved[k] = P[k]; P[k] = function () {}; }
  let noop;
  try { noop = time(6); } finally { for (const k in saved) P[k] = saved[k]; }
  const real1 = time(6);
  return { renderFrame_median_ms: real0, gl_noop_median_ms: noop, again_ms: real1, nooped: Object.keys(saved).length };
})()
