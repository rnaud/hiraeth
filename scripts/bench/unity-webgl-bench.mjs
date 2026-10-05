// The third column: Unity's WebGL (WebGPU) build in the same Chrome as the web game (browser.mjs). The
// player runs its own benchmark mode (Bench.cs, `?bench&benchPreset=high` in the address) and prints its
// results on the console; this adds what the page sees: each frame's interval and the CPU time of
// Unity's requestAnimationFrame callback (the whole player loop), sliced by the player's own
// "rec start / rec end" marks, the GPU time where WebGL 2 can time it, memory and load.
//   node scripts/bench/serve.mjs &      (serves dist/ at / and the WebGL build at /unity-webgl/ on 5245)
//   node scripts/bench/unity-webgl-bench.mjs --preset high --res 1280x720 --out result.json
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ROOT, options, stats, hitches, memorySampler, sizeOf, sleep } from './lib.mjs';
import { launch, glInfo } from './browser.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:5245/unity-webgl/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'high';
const [w, h] = (opt.res ?? '1280x720').split('x').map(Number);
const out = resolve(opt.out ?? `unity-webgl-${preset}-${w}x${h}.json`);
mkdirSync(dirname(out), { recursive: true });
const profile = resolve(dirname(out), `.chrome-${process.pid}`);
const { ctx, page, pids } = await launch({ w, h, profile, paced: !!opt.paced });
const mem = memorySampler(pids, 3000);
const logs = [], pieces = []; let json = null;
// (--shots folder: the page after each recording, to check it sees what the other sides see)
const shots = typeof opt.shots === 'string' ? resolve(opt.shots) : null; let shotN = 0;
if (shots) mkdirSync(shots, { recursive: true });
page.on('console', (m) => {
  const t = m.text();
  // (the player prints its results in numbered pieces: "MEMENTO_BENCH_JSON 3/12 …")
  const pm = t.match(/^MEMENTO_BENCH_JSON (\d+)\/(\d+) /);
  if (pm) {
    pieces[+pm[1] - 1] = t.slice(pm[0].length).replace(/\n$/, "");   // (the player ends each log line with a newline)
    if (pieces.filter((x) => x !== undefined).length === +pm[2]) { try { json = JSON.parse(pieces.join('')); } catch (e) { logs.push('bad results: ' + e.message); json = { error: 'unreadable results' }; } }
  }
  else if (/Memento:|error|exception/i.test(t)) logs.push(t.slice(0, 200));
  if (shots && t.includes('Memento: bench rec end')) page.screenshot({ path: resolve(shots, `unity-webgl-${preset}-${++shotN}.png`) }).catch(() => {});
});
page.on('pageerror', (e) => logs.push('pageerror ' + String(e).slice(0, 200)));
await page.goto('about:blank');
const gl = await glInfo(page);
// (the template's canvas made the page's size: w × h pixels at device scale 1)
await page.addInitScript(() => {
  window.__bench.rec = true; window.__bench.timeGpu = true;
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = 'html, body { margin: 0; overflow: hidden; } #unity-container, #unity-canvas { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; height: 100vh !important; transform: none !important; } #unity-footer, #unity-warning, #unity-loading-bar { display: none !important; }';
    document.head.appendChild(s);
  });
});
const extra = [opt.paced && 'benchVsync', opt.secs && `benchSecs=${opt.secs}`, opt.warmup && `benchWarmup=${opt.warmup}`, typeof opt.only === 'string' && `benchOnly=${opt.only}`].filter(Boolean).join('&');
const t0 = Date.now();
await page.goto(`${BASE}index.html?bench&benchPreset=${preset}${extra ? '&' + extra : ''}`, { waitUntil: 'load' });
const timeout = +(opt.timeout ?? 900) * 1000;
while (!json && Date.now() - t0 < timeout) await sleep(1000);
const wall = (Date.now() - t0) / 1000;
const page_ = await page.evaluate(() => {
  const B = window.__bench, m = performance.memory;
  return { frames: B.frames, cpu: B.cpu, marks: B.marks, canvas: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; })(), heap: m ? { used: m.usedJSHeapSize, total: m.totalJSHeapSize } : null,
    wasmMB: (() => { try { return Math.round((window.unityInstance?.Module?.HEAP8?.length ?? 0) / 1e6); } catch { return null; } })() };
}).catch(() => null);
const m = mem.stop();
await ctx.close();
rmSync(profile, { recursive: true, force: true });
if (!json) { console.error(`unity-webgl: no results after ${wall} s; ${logs.slice(-8).join(' | ')}`); writeFileSync(out, JSON.stringify({ engine: 'unity-webgl', side: 'unity-webgl', error: 'no results', logs: logs.slice(-30), gl }) + '\n'); process.exit(3); }
// the page's own frame times, per recording (the player's marks)
const starts = page_?.marks.filter((x) => x[0] === 'start') ?? [], ends = page_?.marks.filter((x) => x[0] === 'end') ?? [];
(json.views ?? []).forEach((v, i) => {
  if (!starts[i] || !ends[i]) return;
  const f = page_.frames.slice(starts[i][2], ends[i][2]), c = page_.cpu.slice(starts[i][2], ends[i][2]);
  const fs = stats(f);
  Object.assign(v, { page: { frame: fs, cpu: stats(c), fps: +(f.length / (f.reduce((a, b) => a + b, 0) / 1000)).toFixed(1), hitches: fs ? hitches(f, fs.median) : null } });
});
const build = resolve(ROOT, 'unity/Memento/Builds/WebGL');
Object.assign(json, {
  engine: 'unity-webgl', side: 'unity-webgl', gl, canvas: page_?.canvas, wallSecs: wall,
  load: { ...json.load, wall },
  process: { peakFootprintMB: Math.round(m.peak.total / 1e6), peakGraphicsMB: Math.round(m.peak.graphics / 1e6), processes: m.peak.processes },
  memPage: { jsHeapUsed: page_?.heap?.used, wasmHeapMB: page_?.wasmMB },
  size: { buildMB: Math.round(sizeOf(resolve(build, 'Build')) / 1e6), streamingAssetsMB: Math.round(sizeOf(resolve(build, 'StreamingAssets')) / 1e6) },
  logs: logs.slice(-10),
});
writeFileSync(out, JSON.stringify(json) + '\n');
for (const v of json.views ?? []) console.log(`unity-webgl ${preset} ${w}x${h} ${v.name.padEnd(11)} frame ${v.frame?.median} ms (page: median ${v.page?.frame?.median}, mean ${v.page?.frame?.mean}, p95 ${v.page?.frame?.p95}) cpu ${v.page?.cpu?.median} draws ${v.draws} tris ${v.tris}`);
console.log(`unity-webgl: first frame ${json.load?.firstFrame} s, wall ${wall} s, canvas ${page_?.canvas}, peak ${json.process.peakFootprintMB} MB; ${out}`);
process.exit(0);
