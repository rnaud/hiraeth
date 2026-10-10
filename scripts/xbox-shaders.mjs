// Shaders timed on the Xbox's own compiler (docs/systems/performance.md, "Where a load goes"): programs dumped from a
// load on the Mac (scripts/load-breakdown.mjs --dump dir: their final GLSL, as the driver got it) are compiled and
// linked in a WebGL2 context of their own inside the game's page on the console, through the Device Portal's
// DevTools relay (as scripts/xbox-devtools.mjs), each salted with a #define of its own so the GPU process can't
// answer from its cache (a first launch's cost). Per program: compile + link until COMPLETION_STATUS_KHR, ms.
//
//   node scripts/xbox-shaders.mjs <dir/world.json> [--only 0,1,74] [--first 6] [--par 1] [--json out.json]
//   --par n   n programs queued at once (the time for the batch, and per program)
//   --each    one line per program (else a summary by kind)
//   --draw n  then n draws with it into a G-buffer like the game's, each waited for (the driver's work at first draw)
// XBOX_PORTAL as xbox-devtools.mjs. The game must be running (on the title is best: little else on the GPU).
import { readFileSync, writeFileSync } from 'node:fs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';   // (the portal's certificate is self-signed)
const PORTAL = process.env.XBOX_PORTAL ?? 'https://192.168.68.64:11443';

export async function connect(portal = PORTAL) {
  const tabs = await (await fetch(`${portal}/msedge`)).json();
  const page = tabs.flatMap((b) => b.targets ?? []).find((t) => t.type === 'page' && t.url.includes('hiraeth.example'));
  if (!page) throw new Error('the game\'s page is not open: is Hiraeth running?');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const wait = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  return { send, ev, close: () => ws.close() };
}

/** In the page: compile and link these programs (salted), n at once, timed to their completion. */
export const BENCH = `window.__shaderBench = async (progs, opts = {}) => {
  const cv = (window.__benchCanvas ??= document.createElement('canvas'));
  const gl = (window.__benchGl ??= cv.getContext('webgl2'));
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  const salt = (s, k) => s.replace(/^(#version[^\\n]*\\n)/, '$1#define BENCH_SALT_' + k + '\\n');
  const t0 = performance.now(), out = [];
  const made = progs.map((p) => {
    const k = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const t = performance.now();
    const vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, salt(p.vs, k)); gl.shaderSource(fs, salt(p.fs, k));
    gl.compileShader(vs); gl.compileShader(fs);
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    return { p, pr, vs, fs, t, queued: performance.now() - t };
  });
  for (const m of made) {
    while (ext && !gl.getProgramParameter(m.pr, ext.COMPLETION_STATUS_KHR)) await new Promise((r) => setTimeout(r, 5));
    const done = performance.now();
    const pl = gl.getProgramInfoLog(m.pr) ?? '';
    const ok = gl.getProgramParameter(m.pr, gl.LINK_STATUS) && !/too many|error/i.test(pl);   // (ANGLE may link a program it can't draw: "Too many attributes")
    const log = ok && !opts.log ? '' : (gl.getProgramInfoLog(m.pr) + gl.getShaderInfoLog(m.fs) + gl.getShaderInfoLog(m.vs)).slice(0, opts.log ? 200000 : 300);
    const dbg = opts.log && gl.getExtension('WEBGL_debug_shaders');
    let draws = null;
    if (opts.draw && ok) {
      // the first draws after the link, each waited for (a pixel read back): into a G-buffer like the game's (three
      // half-float colour targets and a depth buffer), every active attribute fed from a small float buffer
      gl.getExtension('EXT_color_buffer_float');   // (half-float targets: else the framebuffer is incomplete and nothing is drawn)
      const fb = (window.__benchFb2 ??= (() => {
        const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        for (let k = 0; k < 3; k++) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, 4, 4); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0); }
        const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, 4, 4); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
        return f; })());
      // (a program dumped with packed: true writes one RGBA32UI target instead: the packed G-buffer's repro)
      const fbP = (window.__benchFbPacked ??= (() => {
        const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32UI, 4, 4); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, 4, 4); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
        return f; })());
      gl.bindFramebuffer(gl.FRAMEBUFFER, m.p.packed ? fbP : fb);
      gl.drawBuffers(m.p.packed ? [gl.COLOR_ATTACHMENT0] : [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
      gl.viewport(0, 0, 4, 4);
      gl.useProgram(m.pr);
      // (each sampler on a unit of its own: two kinds of sampler on one unit and WebGL refuses the draw)
      const nu = gl.getProgramParameter(m.pr, gl.ACTIVE_UNIFORMS);
      const SAMPLERS = [gl.SAMPLER_2D, gl.SAMPLER_2D_SHADOW, gl.SAMPLER_2D_ARRAY, gl.SAMPLER_3D, gl.SAMPLER_CUBE, gl.INT_SAMPLER_2D, gl.UNSIGNED_INT_SAMPLER_2D];
      for (let k = 0; k < 16; k++) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, null); }   // (nothing left from the last program)
      gl.activeTexture(gl.TEXTURE0);
      let unit = 0;
      for (let k = 0; k < nu; k++) { const u = gl.getActiveUniform(m.pr, k); if (SAMPLERS.includes(u.type)) { while (gl.getError());  const l = gl.getUniformLocation(m.pr, u.name); const units = Array.from({ length: u.size }, () => unit++); gl.uniform1iv(l, units);
        if (u.type === gl.SAMPLER_2D_SHADOW) for (const un of units) {   // (a shadow sampler wants a depth texture that compares)
          gl.activeTexture(gl.TEXTURE0 + un); const dt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dt); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 1, 1);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }
        gl.activeTexture(gl.TEXTURE0); } }
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(3 * 16), gl.STATIC_DRAW);
      const na = gl.getProgramParameter(m.pr, gl.ACTIVE_ATTRIBUTES);
      for (let k = 0; k < na; k++) { const a = gl.getActiveAttrib(m.pr, k), loc = gl.getAttribLocation(m.pr, a.name); const slots = a.type === gl.FLOAT_MAT4 ? 4 : 1; for (let s = 0; s < slots; s++) { gl.enableVertexAttribArray(loc + s); gl.vertexAttribPointer(loc + s, 4, gl.FLOAT, false, 0, 0); } }
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('the G-buffer is incomplete');
      const pre = gl.getError();
      const px = new Uint8Array(4); draws = pre ? ['setup' + pre] : [];
      for (let n = 0; n < (opts.draw | 0 || 2); n++) {
        const t = performance.now();
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // (waits for the GPU process)
        draws.push(Math.round(performance.now() - t));
        const e = gl.getError(); if (e) draws.push('err' + e);
      }
      gl.bindVertexArray(null); gl.deleteVertexArray(vao); gl.deleteBuffer(buf); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    out.push({ i: m.p.i, ms: Math.round(done - m.t), queued: Math.round(m.queued), ok, log, draws, hlsl: dbg ? dbg.getTranslatedShaderSource(m.fs) : null });
    gl.deleteProgram(m.pr); gl.deleteShader(m.vs); gl.deleteShader(m.fs);
  }
  return { all: Math.round(performance.now() - t0), out, parallel: !!ext };
};`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
  const file = args.find((a) => a.endsWith('.json') && a !== arg('json'));
  if (!file) { console.error('usage: node scripts/xbox-shaders.mjs <dump.json> [--only i,j] [--first n] [--par n] [--json out]'); process.exit(1); }
  let list = JSON.parse(readFileSync(file, 'utf8')).map((p, i) => ({ i, ...p }));
  if (arg('only')) { const keep = new Set(arg('only').split(',').map(Number)); list = list.filter((p) => keep.has(p.i)); }
  if (arg('first')) list = list.slice(0, Number(arg('first')));
  const PAR = Number(arg('par', 1));
  const c = await connect();
  await c.ev(`${BENCH}; true`);
  const res = [];
  for (let k = 0; k < list.length; k += PAR) {
    const batch = list.slice(k, k + PAR);
    const r = await c.ev(`window.__shaderBench(${JSON.stringify(batch.map((p) => ({ i: p.i, vs: p.vs, fs: p.fs, packed: !!p.packed })))}, { log: ${!!arg('log')}, draw: ${Number(arg('draw', 0))} })`);
    if (arg('log')) for (const o of r.out) writeFileSync(`${arg('log')}/${o.i}.log`, `${o.log}\n\n----- translated -----\n${o.hlsl ?? '(no WEBGL_debug_shaders)'}`);
    for (const o of r.out) {
      const p = list.find((x) => x.i === o.i);
      const row = { i: o.i, ms: o.ms, draws: o.draws, batch: r.all, fsKb: Math.round(p.fsLen / 1024), vsKb: Math.round(p.vsLen / 1024), defines: (p.defines ?? []).filter((d) => /^(S_|SURFACE|USE_|DOUBLE|METAL|FLUID|INK|FACE|GARMENT|CROWD|WATER|SWAY|MAKERS|CHIME|BLADE|POST|STANDARD)/.test(d)).join(' '), ok: o.ok, log: o.log };
      res.push(row);
      if (args.includes('--each') || !o.ok) console.log(`${String(o.i).padStart(3)} ${String(o.ms).padStart(6)} ms${o.draws ? `  draws ${o.draws.join(' ')} ms` : ''}  fs ${row.fsKb} kB  ${row.defines}${o.ok ? '' : `  FAILED ${o.log}`}`);
    }
  }
  const sum = res.reduce((n, r) => n + r.ms, 0);
  const batches = [...new Set(res.map((r) => r.batch))];
  console.log(`${res.length} programs: ${(sum / 1000).toFixed(1)} s one by one${PAR > 1 ? `, batches of ${PAR}: ${(res.filter((r, i) => i % PAR === 0).reduce((n, r) => n + r.batch, 0) / 1000).toFixed(1)} s` : ''}, median ${res.map((r) => r.ms).sort((a, b) => a - b)[res.length >> 1]} ms`);
  void batches;
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify(res, null, 1));
  c.close();
  process.exit(0);
}
