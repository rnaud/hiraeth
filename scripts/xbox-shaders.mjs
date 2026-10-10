// Shaders timed on the Xbox's own compiler (docs/systems/performance.md, "Where a load goes"): programs dumped from a
// load on the Mac (scripts/load-breakdown.mjs --dump dir: their final GLSL, as the driver got it) are compiled and
// linked in a WebGL2 context of their own inside the game's page on the console, through the Device Portal's
// DevTools relay (as scripts/xbox-devtools.mjs), each salted with a #define of its own so the GPU process can't
// answer from its cache (a first launch's cost). Per program: compile + link until COMPLETION_STATUS_KHR, ms.
//
//   node scripts/xbox-shaders.mjs <dir/world.json> [--only 0,1,74] [--first 6] [--par 1] [--json out.json]
//   --par n   n programs queued at once (the time for the batch, and per program)
//   --each    one line per program (else a summary by kind)
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
    out.push({ i: m.p.i, ms: Math.round(done - m.t), queued: Math.round(m.queued), ok, log, hlsl: dbg ? dbg.getTranslatedShaderSource(m.fs) : null });
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
    const r = await c.ev(`window.__shaderBench(${JSON.stringify(batch.map((p) => ({ i: p.i, vs: p.vs, fs: p.fs })))}, { log: ${!!arg('log')} })`);
    if (arg('log')) for (const o of r.out) writeFileSync(`${arg('log')}/${o.i}.log`, `${o.log}\n\n----- translated -----\n${o.hlsl ?? '(no WEBGL_debug_shaders)'}`);
    for (const o of r.out) {
      const p = list.find((x) => x.i === o.i);
      const row = { i: o.i, ms: o.ms, batch: r.all, fsKb: Math.round(p.fsLen / 1024), vsKb: Math.round(p.vsLen / 1024), defines: (p.defines ?? []).filter((d) => /^(S_|SURFACE|USE_|DOUBLE|METAL|FLUID|INK|FACE|GARMENT|CROWD|WATER|SWAY|MAKERS|CHIME|BLADE|POST|STANDARD)/.test(d)).join(' '), ok: o.ok, log: o.log };
      res.push(row);
      if (args.includes('--each') || !o.ok) console.log(`${String(o.i).padStart(3)} ${String(o.ms).padStart(6)} ms  fs ${row.fsKb} kB  ${row.defines}${o.ok ? '' : `  FAILED ${o.log}`}`);
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
