// A Chromium performance trace of the Xbox app's gameplay frames, from the Mac, through the console's Device Portal
// (docs/systems/xbox.md, "Why 20 fps"): the DevTools Tracing domain on the WebView2 browser target the portal relays
// at /msedge, every process of the app (the renderer, the GPU process, the browser) in one trace.
//
//   node scripts/xbox-trace.mjs record [secs] [out.json] [--walk]   → trace secs (default 5) of whatever is on screen;
//                                                                       --walk holds the stick forward meanwhile
//   node scripts/xbox-trace.mjs profile [secs] [out.cpuprofile]     → V8's sampling profiler: self time per function and
//                                                                       per kind (JS, WebGL calls, GC), ms per frame
//   node scripts/xbox-trace.mjs summarize <file.cpuprofile> [frames] → the same summary of a saved profile
//   node scripts/xbox-trace.mjs analyze <trace.json>                → per frame: the renderer's main thread split into
//                                                                       JS, GC, WebGL waits, style/layout, idle; the GPU
//                                                                       process's main thread (CrGpuMain) busy share
//
// The same analysis reads a trace from Chrome on the Mac (any trace with traceEvents), for the comparison.
// XBOX_PORTAL as scripts/xbox-devtools.mjs. The game must be running (scripts/xbox-devtools.mjs launch / load).
import { readFileSync, writeFileSync } from 'node:fs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';   // (the portal's certificate is self-signed)
const PORTAL = process.env.XBOX_PORTAL ?? 'https://192.168.68.64:11443';
const [cmd = 'record', ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--'))), pos = rest.filter((a) => !a.startsWith('--'));

export const CATEGORIES = ['toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'v8.execute',
  'disabled-by-default-v8.gc', 'blink', 'gpu', 'gpu.service', 'gpu.angle', 'disabled-by-default-gpu.service', 'cc', 'viz',
  'ipc', 'mojom', 'renderer.scheduler', '__metadata'];

async function socket(url) {
  const ws = new WebSocket(url);
  let id = 0; const wait = new Map(), on = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } else on.forEach((f) => f(m)); };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, on: (f) => on.push(f), close: () => ws.close() };
}

async function record(secs, out, walk) {
  const list = await (await fetch(`${PORTAL}/msedge`)).json();
  const b = list.find((x) => x.targets?.some((t) => t.type === 'page' && t.url.includes('hiraeth.example')));
  if (!b) throw new Error('the game\'s page is not open: is Hiraeth running?');
  const page = b.targets.find((t) => t.type === 'page' && t.url.includes('hiraeth.example'));
  const browser = await socket(b.version.webSocketDebuggerUrl);
  const pg = await socket(page.webSocketDebuggerUrl);
  const ev = async (expression) => (await pg.send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  const events = [];
  let done;
  const finished = new Promise((r) => { done = r; });
  browser.on((m) => {
    if (m.method === 'Tracing.dataCollected') events.push(...m.params.value);
    if (m.method === 'Tracing.tracingComplete') done();
  });
  const r = await browser.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { recordMode: 'recordContinuously', includedCategories: CATEGORIES } });
  if (r.error) throw new Error(JSON.stringify(r.error));
  // (walking: the game's own input reads this hook if present, else a held key on the page)
  if (walk) await ev(`(() => { const e = (t) => window.dispatchEvent(new KeyboardEvent(t, { code: 'KeyW', key: 'w', bubbles: true })); e('keydown'); window.__walkKey = e; return true; })()`);
  const readout0 = await ev(`document.getElementById('fps')?.textContent`);
  await new Promise((res) => setTimeout(res, secs * 1000));
  const readout1 = await ev(`document.getElementById('fps')?.textContent`);
  if (walk) await ev(`(window.__walkKey?.('keyup'), true)`);
  await browser.send('Tracing.end');
  await finished;
  writeFileSync(out, JSON.stringify({ traceEvents: events, meta: { secs, walk, readout: [readout0, readout1], date: new Date().toISOString() } }));
  console.log(`${events.length} events in ${out}\nreadout: ${readout0}\n         ${readout1}`);
  browser.close(); pg.close();
}

/** Self time per event name on one thread, over [t0, t1] (µs), from X and B/E events. */
function selfTimes(evs) {
  const spans = [];
  const open = [];
  for (const e of evs) {
    if (e.ph === 'X' && e.dur != null) spans.push({ name: e.name, cat: e.cat, ts: e.ts, end: e.ts + e.dur, args: e.args });
    else if (e.ph === 'B') open.push(e);
    else if (e.ph === 'E') { const b = open.pop(); if (b) spans.push({ name: b.name, cat: b.cat, ts: b.ts, end: e.ts, args: b.args }); }
  }
  spans.sort((a, b) => a.ts - b.ts || b.end - a.end);
  const self = new Map(), stack = [];
  const add = (s, d) => self.set(s.name, (self.get(s.name) ?? 0) + d);
  for (const s of spans) {
    while (stack.length && stack.at(-1).end <= s.ts) stack.pop();
    const parent = stack.at(-1);
    if (parent) add(parent, -(Math.min(s.end, parent.end) - s.ts));
    add(s, s.end - s.ts);
    stack.push(s);
  }
  return { self, spans };
}

// what a self-time name counts as (the renderer's main thread)
const KIND = [
  [/GC|Scavenge|Mark|Sweep|Compact|V8\.GC|Heap/i, 'gc'],
  [/WaitForGetOffset|WaitForToken|WaitForCmd|SyncChannel|SyncCall|Send.*Sync|Sync.*Send|Fence|ClientWait|Finish|WaitSync|ReadPixels|GpuChannelHost::Send|CommandBufferProxyImpl::|GLES2Implementation::|WebGL.*(Wait|Sync)|EnsureWorkVisible/i, 'gl-wait'],
  [/CommandBufferHelper|Flush|OrderingBarrier/i, 'gl-flush'],
  [/UpdateLayoutTree|RecalcStyle|Layout|ParseHTML|UpdateLayer|Paint|PrePaint|Layerize|HitTest/i, 'style-layout-paint'],
  [/FunctionCall|v8\.callFunction|V8\.Execute|EvaluateScript|v8\.run|v8\.compile|V8\.Compile|FireAnimationFrame|TimerFire|EventDispatch|RunMicrotasks|v8\.execute|V8\.Run/i, 'js'],
];
const kind = (n) => KIND.find(([re]) => re.test(n))?.[1] ?? 'other';

export function analyze(file, { print = true } = {}) {
  const t = JSON.parse(readFileSync(file, 'utf8'));
  const evs = t.traceEvents ?? t;
  const names = new Map();   // pid:tid → thread name
  const pnames = new Map();
  for (const e of evs) {
    if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
    if (e.ph === 'M' && e.name === 'process_name') pnames.set(e.pid, e.args.name);
  }
  const byThread = new Map();
  for (const e of evs) { if (e.ph === 'M') continue; const k = `${e.pid}:${e.tid}`; (byThread.get(k) ?? byThread.set(k, []).get(k)).push(e); }
  // the game's main thread: the CrRendererMain with the most animation frames
  const frames = (list) => list.filter((e) => /FireAnimationFrame|AnimationFrameFired/.test(e.name) && (e.ph === 'X' || e.ph === 'B'));
  const mains = [...byThread.keys()].filter((k) => names.get(k) === 'CrRendererMain');
  const main = mains.sort((a, b) => frames(byThread.get(b)).length - frames(byThread.get(a)).length)[0];
  if (!main) throw new Error('no CrRendererMain in the trace');
  const mainEvs = byThread.get(main);
  const ts = evs.filter((e) => e.ts > 0 && e.ph !== 'M').map((e) => e.ts);
  // (one frame can fire several animation-frame callbacks: the ones within 2 ms of the last are the same frame)
  const fr = frames(mainEvs).sort((a, b) => a.ts - b.ts).filter((e, i, a) => i === 0 || e.ts - a[i - 1].ts > 2000);
  const t0 = fr[0]?.ts ?? Math.min(...ts), t1 = fr.at(-1)?.ts ?? Math.max(...ts);
  const wall = (t1 - t0) / 1000, nFrames = Math.max(fr.length - 1, 1);
  const inWin = (list) => list.filter((e) => e.ts >= t0 && e.ts < t1);
  const report = { file, meta: t.meta, frames: nFrames, wall_ms: +wall.toFixed(0), fps: +(nFrames / wall * 1000).toFixed(1), threads: {} };

  const thread = (k) => {
    const { self, spans } = selfTimes(inWin(byThread.get(k)));
    // busy = the union of top-level spans
    let busy = 0, end = -Infinity;
    for (const s of spans) { if (s.ts >= end) { busy += s.end - s.ts; end = s.end; } else if (s.end > end) { busy += s.end - end; end = s.end; } }
    const top = [...self.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const kinds = {};
    for (const [n, v] of top) kinds[kind(n)] = (kinds[kind(n)] ?? 0) + v;
    const perFrame = (us) => +(us / 1000 / nFrames).toFixed(2);
    return {
      name: names.get(k), process: pnames.get(+k.split(':')[0]),
      busy_ms_per_frame: perFrame(busy), busy_share: +(busy / 1000 / wall).toFixed(2),
      kinds_ms_per_frame: Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([n, v]) => [n, perFrame(v)])),
      top_self_ms_per_frame: top.slice(0, 25).map(([n, v]) => [n, perFrame(v)]),
    };
  };
  report.threads.renderer_main = thread(main);
  const rendererPid = main.split(':')[0];
  for (const [k, n] of names) {
    if (!byThread.has(k)) continue;
    const want = n === 'CrGpuMain' || n === 'VizCompositorThread' || n === 'CrBrowserMain' || n === 'Compositor' && k.startsWith(rendererPid + ':') || /ThreadPoolForeg|DedicatedWorker/.test(n) && k.startsWith(rendererPid + ':');
    if (!want) continue;
    const r = thread(k);
    if (r.busy_ms_per_frame < 0.2) continue;
    report.threads[`${n} ${k}`] = r;
  }
  // frame intervals from the animation frames
  const gaps = fr.slice(1).map((e, i) => (e.ts - fr[i].ts) / 1000).sort((a, b) => a - b);
  report.frame_ms = { median: gaps[Math.floor(gaps.length / 2)], p95: gaps[Math.floor(gaps.length * 0.95)], max: gaps.at(-1) };
  if (print) console.log(JSON.stringify(report, null, 1));
  return report;
}

/** V8's sampling profiler on the page for secs: self time by function (WebGL calls are native functions without a
 *  script, named as the method), and by kind; saves the raw profile next to out. */
async function profile(secs, out) {
  const list = await (await fetch(`${PORTAL}/msedge`)).json();
  const page = list.flatMap((b) => b.targets ?? []).find((t) => t.type === 'page' && t.url.includes('hiraeth.example'));
  if (!page) throw new Error('the game\'s page is not open: is Hiraeth running?');
  const pg = await socket(page.webSocketDebuggerUrl);
  const ev = async (expression) => (await pg.send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  await pg.send('Profiler.enable');
  await pg.send('Profiler.setSamplingInterval', { interval: 250 });
  const f0 = await ev('window.renderer?.info?.render?.frame ?? null');
  await pg.send('Profiler.start');
  await new Promise((r) => setTimeout(r, secs * 1000));
  const { result } = await pg.send('Profiler.stop');
  const f1 = await ev('window.renderer?.info?.render?.frame ?? null');
  const readout = await ev(`document.getElementById('fps')?.textContent`);
  pg.close();
  writeFileSync(out, JSON.stringify(result.profile));
  summarizeProfile(result.profile, f0 != null && f1 != null ? f1 - f0 : null, readout);
}
const GL = new Set(typeof WebGL2RenderingContext === 'undefined' ? [] : Object.getOwnPropertyNames(WebGL2RenderingContext.prototype));
export function summarizeProfile(p, frames, readout) {
  const nodes = new Map(p.nodes.map((n) => [n.id, n]));
  const dt = new Map();
  for (let i = 0; i < p.samples.length; i++) dt.set(p.samples[i], (dt.get(p.samples[i]) ?? 0) + (p.timeDeltas[i + 1] ?? 0));
  const total = (p.endTime - p.startTime) / 1000;
  const byFn = new Map(), byKind = {};
  const isGl = (cf) => !cf.url && /^[a-z][A-Za-z0-9]+$/.test(cf.functionName) && (GL.size ? GL.has(cf.functionName) : /^(uniform|draw|bind|buffer|tex|vertexAttrib|enable|disable|blend|depth|clear|use|get|framebuffer|read|invalidate|color|stencil|cull|front|viewport|scissor|polygon|active|pixel|create|delete|is|copy|blit|compressed|generate|line|sample|end|begin|fence|client|wait|flush|finish)/.test(cf.functionName));
  for (const [id, us] of dt) {
    const n = nodes.get(id), cf = n.callFrame;
    const k = cf.functionName.startsWith('(') ? cf.functionName : isGl(cf) ? 'webgl' : cf.url ? 'js' : 'native';
    byKind[k] = (byKind[k] ?? 0) + us;
    const key = `${cf.functionName || '(anonymous)'} ${cf.url ? `${cf.url.split('/').pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1}` : ''}`;
    byFn.set(key, (byFn.get(key) ?? 0) + us);
  }
  const per = (us) => +(us / 1000 / (frames || 1)).toFixed(2);
  console.log(`profile ${total.toFixed(0)} ms, ${frames ?? '?'} frames (ms per frame below${frames ? '' : ': total ms'})`);
  if (readout) console.log(`readout: ${readout}`);
  console.log('by kind:', Object.fromEntries(Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, per(v)])));
  for (const [k, v] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(String(per(v)).padStart(7), k);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (cmd === 'profile') await profile(+pos[0] || 5, pos[1] ?? `xbox-profile-${Date.now()}.cpuprofile`);
  else if (cmd === 'summarize') summarizeProfile(JSON.parse(readFileSync(pos[0], 'utf8')), +pos[1] || null);
  else if (cmd === 'record') await record(+pos[0] || 5, pos[1] ?? `xbox-trace-${Date.now()}.json`, flags.has('--walk'));
  else if (cmd === 'analyze') analyze(pos[0]);
  else { console.error('usage: node scripts/xbox-trace.mjs record [secs] [out.json] [--walk] | analyze <trace.json>'); process.exit(1); }
  process.exit(0);
}
